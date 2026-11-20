-- =====================================================================
-- Sincroniza SUDI (tablas sudi_*) -> catálogo del portal
--   clientes_catalogo  : completa datos vacíos de los clientes SUDI
--   estaciones_servicio: actualiza las ya ligadas (sudi_id), liga por
--                        permiso PL las que no tenían sudi_id y da de
--                        alta las estaciones de SUDI que faltan.
-- Ventas, Operaciones, Flotilla, Almacén, Viáticos y la app de pólizas
-- ya leen estaciones_servicio + clientes_catalogo, así que con esto
-- todos ven la información de SUDI sin cambiar código.
--
-- Uso: correr este archivo completo una vez en el SQL Editor.
-- Después, la actualización se hace con el botón "Actualizar SUDI"
-- (importar-sudi.js) desde la página de SUDI: importa y sincroniza solo.
-- A mano también se puede:  select * from public.sync_sudi_a_portal();
-- =====================================================================

-- ---------- Tablas de apoyo: alertas y configuración de la importación ----------
create table if not exists public.sudi_alertas (
  id bigserial primary key,
  tipo text not null,
  clave text not null unique,
  titulo text,
  detalle text,
  datos jsonb,
  activa boolean not null default true,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  resuelta_en timestamptz
);
alter table public.sudi_alertas enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='sudi_alertas' and policyname='sudi_alertas_lectura') then
    create policy sudi_alertas_lectura on public.sudi_alertas for select to anon, authenticated using (true);
  end if;
end $$;

create table if not exists public.sudi_importacion_config (
  id int primary key default 1 check (id = 1),
  token text not null default md5(random()::text || clock_timestamp()::text) || md5(random()::text),
  importacion_iniciada timestamptz,
  ultima_importacion timestamptz
);
alter table public.sudi_importacion_config enable row level security;   -- sin políticas: nadie la lee desde la app
insert into public.sudi_importacion_config (id) values (1) on conflict (id) do nothing;

-- Fecha de la última importación (sin exponer el token), para avisar si SUDI está desactualizado
create or replace view public.sudi_estado as
  select ultima_importacion,
         (select count(*) from public.sudi_alertas where activa) as alertas_activas
  from public.sudi_importacion_config where id = 1;
grant select on public.sudi_estado to anon, authenticated;

create or replace function public.sync_sudi_a_portal()
returns table(paso text, filas int)
language plpgsql
as $$
declare n int; tipo_det text;
begin
  drop table if exists _map_cli; drop table if exists _est;
  -- 0) Mapa cliente SUDI -> clientes_catalogo (por RFC; si no, por razón social)
  create temp table _map_cli on commit drop as
  select distinct on (sc.sudi_id) sc.sudi_id as cli_sudi_id, cc.id as catalogo_id
  from public.sudi_clientes sc
  join public.clientes_catalogo cc
    on (nullif(upper(trim(sc.rfc)),'') is not null and upper(trim(cc.rfc)) = upper(trim(sc.rfc)))
    or regexp_replace(upper(trim(cc.razon_social)),'[.,\s]+','','g') = regexp_replace(upper(trim(sc.razon_social)),'[.,\s]+','','g')
  order by sc.sudi_id, (upper(trim(cc.rfc)) = upper(trim(sc.rfc))) desc nulls last, cc.activo desc nulls last;

  -- 1) Clientes nuevos de SUDI que no estén en el catálogo
  insert into public.clientes_catalogo (razon_social, nombre_comercial, rfc, representante, telefono, correo, activo, origen, creado_en, actualizado_en)
  select upper(trim(sc.razon_social)), sc.nombre_comercial, sc.rfc, sc.responsable, sc.telefono, sc.correo, true, 'sudi', now(), now()
  from public.sudi_clientes sc
  where sc.sudi_id not in (select cli_sudi_id from _map_cli)
    and nullif(trim(sc.razon_social),'') is not null
  on conflict do nothing;
  get diagnostics n = row_count; paso := 'clientes nuevos'; filas := n; return next;

  insert into _map_cli
  select sc.sudi_id, cc.id from public.sudi_clientes sc
  join public.clientes_catalogo cc on regexp_replace(upper(trim(cc.razon_social)),'[.,\s]+','','g') = regexp_replace(upper(trim(sc.razon_social)),'[.,\s]+','','g')
  where sc.sudi_id not in (select cli_sudi_id from _map_cli);

  -- 2) Completar datos vacíos de clientes existentes (no pisa lo capturado en el portal)
  update public.clientes_catalogo cc set
    rfc            = coalesce(nullif(cc.rfc,''), sc.rfc),
    nombre_comercial = coalesce(nullif(cc.nombre_comercial,''), sc.nombre_comercial),
    representante  = coalesce(nullif(cc.representante,''), sc.responsable),
    telefono       = coalesce(nullif(cc.telefono,''), sc.telefono),
    correo         = coalesce(nullif(cc.correo,''), sc.correo),
    actualizado_en = now()
  from _map_cli m join public.sudi_clientes sc on sc.sudi_id = m.cli_sudi_id
  where cc.id = m.catalogo_id
    and (nullif(cc.rfc,'') is null or nullif(cc.representante,'') is null or nullif(cc.telefono,'') is null or nullif(cc.correo,'') is null or nullif(cc.nombre_comercial,'') is null);
  get diagnostics n = row_count; paso := 'clientes completados'; filas := n; return next;

  -- 3) Datos limpios de cada estación SUDI (coordenadas válidas + dispensarios)
  create temp table _est on commit drop as
  with d as (
    select estacion_sudi_id,
           count(*) as n_disp,
           sum(coalesce(mangueras,0)) as n_mang,
           jsonb_agg(jsonb_build_object('n',numero,'marca',marca,'serie',serie,'modelo',modelo,'mangueras',mangueras::text,'aprobacion',dgn)
                     order by nullif(regexp_replace(numero,'\D','','g'),'')::int nulls last, numero) as detalle
    from public.sudi_dispensarios group by estacion_sudi_id
  ), c as (
    select s.*,
           case when s.lng between 86 and 118 then -s.lng else s.lng end as lng_ok
    from public.sudi_estaciones s
  )
  select c.*, m.catalogo_id,
         -- permiso real (PL/numero/...); "AUTOCONSUMO", "E0000", "N/A", "En proceso", etc. cuentan como sin permiso
         case when c.permiso_pl ~* '^\s*PL/\d+/' then upper(regexp_replace(c.permiso_pl,'\s','','g')) end as pl,
         case when c.numero_estacion ~* '^\s*(N/?A|E0+|null)?\s*$' then null else trim(c.numero_estacion) end as num_est,
         (c.lat between 14.5 and 33 and c.lng_ok between -118 and -86) as coord_ok,
         d.n_disp, d.n_mang, d.detalle,
         nullif(concat_ws(', ', nullif(c.calle,''), case when nullif(c.colonia,'') is not null then 'Col. '||c.colonia end, case when nullif(c.cp,'') is not null then 'C.P. '||c.cp end),'') as dir
  from c
  left join d on d.estacion_sudi_id = c.sudi_id
  left join _map_cli m on m.cli_sudi_id = c.cliente_sudi_id;

  -- 4) Ligar por permiso PL las estaciones del portal que aún no tienen sudi_id.
  --    Si el PL se repite en SUDI, se liga el registro con más dispensarios; el otro queda como duplicado.
  with par as (
    select es.id as es_id, e.sudi_id,
           row_number() over (partition by es.id order by e.n_disp desc nulls last, e.sudi_id::int) as r1,
           row_number() over (partition by e.sudi_id order by es.id) as r2
    from public.estaciones_servicio es
    join _est e on e.pl is not null and upper(regexp_replace(es.permiso,'\s','','g')) = e.pl
    where es.sudi_id is null
      and not exists (select 1 from public.estaciones_servicio x where x.sudi_id = e.sudi_id)
  )
  update public.estaciones_servicio es set sudi_id = par.sudi_id, actualizado_en = now()
  from par where es.id = par.es_id and par.r1 = 1 and par.r2 = 1;
  get diagnostics n = row_count; paso := 'estaciones ligadas por permiso'; filas := n; return next;

  -- 4b) Si una estación del portal quedó ligada a un registro SUDI duplicado con MENOS dispensarios
  --     que otro registro con el mismo PL, se cambia al registro con más dispensarios.
  with mejor as (
    select distinct on (e.pl) e.pl, e.sudi_id as mejor_id, coalesce(e.n_disp,0) as mejor_n
    from _est e where e.pl is not null
    order by e.pl, e.n_disp desc nulls last, e.sudi_id::int
  )
  update public.estaciones_servicio es set sudi_id = m.mejor_id, actualizado_en = now()
  from _est cur join mejor m on m.pl = cur.pl
  where es.sudi_id = cur.sudi_id
    and m.mejor_id <> cur.sudi_id
    and m.mejor_n > coalesce(cur.n_disp,0)
    and not exists (select 1 from public.estaciones_servicio x where x.sudi_id = m.mejor_id);
  get diagnostics n = row_count; paso := 'estaciones religadas al registro SUDI con más dispensarios'; filas := n; return next;

  -- 5) Actualizar estaciones ya ligadas con lo de SUDI
  --    Coordenadas de SUDI = oficiales, salvo que un técnico ya la haya verificado en sitio.
  update public.estaciones_servicio es set
    permiso             = case when nullif(es.permiso,'') is null and e.pl is not null
                                and not exists (select 1 from public.estaciones_servicio x where upper(regexp_replace(x.permiso,'\s','','g')) = e.pl)
                               then e.permiso_pl else es.permiso end,
    numero_estacion     = coalesce(nullif(es.numero_estacion,''), e.num_est),
    encargado           = coalesce(nullif(e.responsable,''), es.encargado),
    colonia             = coalesce(nullif(es.colonia,''), e.colonia),
    codigo_postal       = coalesce(nullif(es.codigo_postal,''), e.cp),
    municipio           = coalesce(nullif(es.municipio,''), e.municipio),
    estado              = coalesce(nullif(es.estado,''), e.estado),
    direccion_normalizada = coalesce(nullif(es.direccion_normalizada,''), e.dir),
    domicilio_raw       = coalesce(nullif(es.domicilio_raw,''), e.dir),
    cliente_id          = coalesce(es.cliente_id, e.catalogo_id::text),
    lat                 = case when e.coord_ok and coalesce(es.ubicacion_fuente,'') <> 'tecnico_en_sitio' then e.lat else es.lat end,
    lng                 = case when e.coord_ok and coalesce(es.ubicacion_fuente,'') <> 'tecnico_en_sitio' then e.lng_ok else es.lng end,
    ubicacion_verificada = case when e.coord_ok and coalesce(es.ubicacion_fuente,'') <> 'tecnico_en_sitio' then true else es.ubicacion_verificada end,
    ubicacion_fuente    = case when e.coord_ok and coalesce(es.ubicacion_fuente,'') <> 'tecnico_en_sitio' then 'sudi_utm' else es.ubicacion_fuente end,
    numero_dispensarios = coalesce(e.n_disp::int, es.numero_dispensarios),
    numero_mangueras    = coalesce(e.n_mang::int, es.numero_mangueras),
    fuente_datos       = case when coalesce(es.fuente_datos,'') ilike '%sudi%' then es.fuente_datos else concat_ws(' + ', nullif(es.fuente_datos,''), 'sudi') end,
    actualizado_en      = now()
  from _est e
  where es.sudi_id = e.sudi_id;
  get diagnostics n = row_count; paso := 'estaciones actualizadas'; filas := n; return next;

  -- 6) Alta de estaciones SUDI que no existen en el portal
  --    (se omiten las que repiten un permiso que ya está en el portal: son duplicados en SUDI)
  insert into public.estaciones_servicio (
    id, sudi_id, razon_social, nombre_comercial, permiso, numero_estacion, encargado,
    direccion_normalizada, domicilio_raw, colonia, codigo_postal, municipio, estado,
    lat, lng, ubicacion_verificada, ubicacion_fuente, ubicacion_en,
    numero_dispensarios, numero_mangueras,
    cliente_id, activo, origen, fuente_datos, creado_en, actualizado_en)
  select 'SUDI-'||e.sudi_id, e.sudi_id,
         coalesce(nullif(upper(trim(sc.razon_social)),''), nullif(upper(trim(e.nombre)),''), 'SIN NOMBRE (COMPLETAR)'),
         coalesce(nullif(trim(e.nombre),''), nullif(trim(sc.nombre_comercial),'')),
         case when e.pl is not null then trim(e.permiso_pl) end, e.num_est, nullif(e.responsable,''),
         e.dir, e.dir, e.colonia, e.cp, e.municipio, e.estado,
         case when e.coord_ok then e.lat end, case when e.coord_ok then e.lng_ok end,
         e.coord_ok, case when e.coord_ok then 'sudi_utm' end, case when e.coord_ok then now() end,
         e.n_disp::int, e.n_mang::int,
         e.catalogo_id::text, true, 'sudi', 'sudi', now(), now()
  from _est e
  left join public.sudi_clientes sc on sc.sudi_id = e.cliente_sudi_id
  where not exists (select 1 from public.estaciones_servicio x where x.sudi_id = e.sudi_id)
    -- PL real que ya está en el portal = duplicado en SUDI (queda pendiente de revisar)
    and not exists (select 1 from public.estaciones_servicio x
                    where e.pl is not null and upper(regexp_replace(x.permiso,'\s','','g')) = e.pl)
    -- si el PL real se repite dentro de SUDI, entra solo el registro con más dispensarios
    and (e.pl is null
         or e.sudi_id = (select y.sudi_id from _est y where y.pl = e.pl
                         order by y.n_disp desc nulls last, y.sudi_id::int limit 1))
  on conflict (id) do nothing;
  get diagnostics n = row_count; paso := 'estaciones nuevas'; filas := n; return next;

  -- 6b) Detalle de dispensarios (se adapta al tipo real de la columna: json, jsonb o texto)
  select format_type(a.atttypid, a.atttypmod) into tipo_det
  from pg_attribute a where a.attrelid = 'public.estaciones_servicio'::regclass and a.attname = 'dispensarios_detalle';
  execute format('update public.estaciones_servicio es set dispensarios_detalle = (e.detalle::text)::%s
                  from _est e where es.sudi_id = e.sudi_id and e.detalle is not null', tipo_det);
  get diagnostics n = row_count; paso := 'estaciones con detalle de dispensarios'; filas := n; return next;

  -- 7) Columna geográfica (búsquedas por cercanía) para las que cambiaron
  begin
    execute $g$ update public.estaciones_servicio
                set geog = st_setsrid(st_makepoint(lng, lat), 4326)::geography
                where lat is not null and lng is not null and ubicacion_fuente = 'sudi_utm' $g$;
  exception when others then null;  -- si geog la llena un trigger o es de otro tipo, no se toca
  end;

  -- 8) Estaciones SUDI que quedaron sin pasar (permiso duplicado) para revisarlas en SUDI
  select count(*) into n from _est e where not exists (select 1 from public.estaciones_servicio x where x.sudi_id = e.sudi_id);
  paso := 'pendientes: duplicados en SUDI (mismo PL que otra estación)'; filas := n; return next;

  -- 9) Alertas de duplicidad (se recalculan en cada corrida; las que ya no aplican se marcan resueltas)
  drop table if exists _al;
  create temp table _al (tipo text, clave text, titulo text, detalle text, datos jsonb) on commit drop;

  -- a) Mismo PL en varios registros de SUDI (si cambia el dueño, se avisa distinto)
  insert into _al
  select case when count(distinct regexp_replace(upper(coalesce(sc.razon_social,'')),'[.,\s]+','','g')) > 1 then 'pl_distinto_dueno' else 'pl_duplicado_sudi' end,
         'sudi_pl:'||e.pl,
         case when count(distinct regexp_replace(upper(coalesce(sc.razon_social,'')),'[.,\s]+','','g')) > 1
              then 'Mismo permiso con distinto dueño en SUDI: '||min(e.permiso_pl)
              else 'Estación dada de alta '||count(*)||' veces en SUDI: '||min(e.permiso_pl) end,
         string_agg('SUDI id '||e.sudi_id||' · '||coalesce(nullif(e.num_est,''),'sin núm.')||' · '||coalesce(nullif(e.nombre,''),'sin nombre')||' · '||coalesce(sc.razon_social,'')||' · '||coalesce(e.n_disp,0)||' disp.', ' | ' order by e.sudi_id::int),
         jsonb_agg(jsonb_build_object('sudi_id',e.sudi_id,'numero',e.num_est,'nombre',e.nombre,'razon_social',sc.razon_social,'dispensarios',coalesce(e.n_disp,0)))
  from _est e left join public.sudi_clientes sc on sc.sudi_id = e.cliente_sudi_id
  where e.pl is not null
  group by e.pl having count(*) > 1;

  -- b) Mismo PL en varias estaciones activas del portal
  insert into _al
  select 'pl_duplicado_portal', 'portal_pl:'||upper(regexp_replace(es.permiso,'\s','','g')),
         'Permiso repetido en el catálogo del portal: '||min(es.permiso),
         string_agg('id '||es.id||' · '||coalesce(es.nombre_comercial, es.razon_social,''), ' | ' order by es.id),
         jsonb_agg(jsonb_build_object('id',es.id,'nombre',coalesce(es.nombre_comercial,es.razon_social),'sudi_id',es.sudi_id))
  from public.estaciones_servicio es
  where coalesce(es.activo,true) and es.permiso ~* '^\s*PL/\d+/'
  group by upper(regexp_replace(es.permiso,'\s','','g')) having count(*) > 1;

  -- c) Mismo RFC en varios clientes activos del catálogo
  insert into _al
  select 'cliente_duplicado', 'cliente_rfc:'||upper(trim(cc.rfc)),
         'Cliente repetido (mismo RFC '||upper(trim(cc.rfc))||')',
         string_agg(cc.razon_social, ' | ' order by cc.razon_social),
         jsonb_agg(jsonb_build_object('id',cc.id,'razon_social',cc.razon_social))
  from public.clientes_catalogo cc
  where coalesce(cc.activo,true) and length(trim(coalesce(cc.rfc,''))) >= 12
  group by upper(trim(cc.rfc)) having count(*) > 1;

  -- d) Misma serie de dispensario en estaciones distintas (SUDI)
  insert into _al
  select 'serie_repetida', 'serie:'||upper(regexp_replace(d.serie,'\s','','g')),
         'Serie de dispensario repetida en '||count(distinct d.estacion_sudi_id)||' estaciones: '||min(d.serie),
         string_agg(distinct 'SUDI id '||d.estacion_sudi_id||' · '||coalesce(e.num_est,'')||' · '||coalesce(e.nombre,''), ' | '),
         jsonb_agg(distinct d.estacion_sudi_id)
  from public.sudi_dispensarios d left join _est e on e.sudi_id = d.estacion_sudi_id
  where length(regexp_replace(coalesce(d.serie,''),'\s','','g')) >= 5
  group by upper(regexp_replace(d.serie,'\s','','g')) having count(distinct d.estacion_sudi_id) > 1;

  update public.sudi_alertas a set activa = false, resuelta_en = now()
  where a.activa and not exists (select 1 from _al where _al.clave = a.clave);
  insert into public.sudi_alertas (tipo, clave, titulo, detalle, datos, activa, creada_en, actualizada_en)
  select tipo, clave, titulo, detalle, datos, true, now(), now() from _al
  on conflict (clave) do update set tipo = excluded.tipo, titulo = excluded.titulo, detalle = excluded.detalle,
    datos = excluded.datos, activa = true, resuelta_en = null,
    actualizada_en = case when sudi_alertas.detalle is distinct from excluded.detalle or not sudi_alertas.activa then now() else sudi_alertas.actualizada_en end;
  select count(*) into n from public.sudi_alertas where activa;
  paso := 'alertas de duplicidad activas'; filas := n; return next;
end;
$$;

revoke all on function public.sync_sudi_a_portal() from public, anon, authenticated;

-- ---------- Importación directa desde SUDI (la usa el botón "Actualizar SUDI") ----------
-- p_paso: 'inicio' | 'clientes' | 'estaciones' | 'dispensarios' | 'fin'
-- Protegida con el token de sudi_importacion_config (solo quien lo tenga puede importar).
create or replace function public.sudi_importar(p_token text, p_paso text, p_filas jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare n int := 0; ini timestamptz; res jsonb;
begin
  if p_token is null or not exists (select 1 from sudi_importacion_config where id = 1 and token = p_token) then
    raise exception 'Token de importación inválido';
  end if;

  if p_paso = 'inicio' then
    update sudi_importacion_config set importacion_iniciada = now() where id = 1;

  elsif p_paso = 'clientes' then
    insert into sudi_clientes (sudi_id, razon_social, nombre_comercial, rfc, responsable, telefono, correo, fiscal_razon_social, fiscal_nombre_comercial, fiscal_codigo, fiscal_rfc, forma_pago, calle, colonia, num_ext, num_int, cp, estado, municipio, contacto_nombre, contacto_telefono, contacto_correo, contacto_puesto, actualizado_en)
    select sudi_id, razon_social, nombre_comercial, rfc, responsable, telefono, correo, fiscal_razon_social, fiscal_nombre_comercial, fiscal_codigo, fiscal_rfc, forma_pago, calle, colonia, num_ext, num_int, cp, estado, municipio, contacto_nombre, contacto_telefono, contacto_correo, contacto_puesto, now()
    from jsonb_populate_recordset(null::sudi_clientes, p_filas) where sudi_id is not null
    on conflict (sudi_id) do update set razon_social = excluded.razon_social, nombre_comercial = excluded.nombre_comercial, rfc = excluded.rfc,
      responsable = excluded.responsable, telefono = excluded.telefono, correo = excluded.correo, fiscal_razon_social = excluded.fiscal_razon_social,
      fiscal_nombre_comercial = excluded.fiscal_nombre_comercial, fiscal_codigo = excluded.fiscal_codigo, fiscal_rfc = excluded.fiscal_rfc,
      forma_pago = excluded.forma_pago, calle = excluded.calle, colonia = excluded.colonia, num_ext = excluded.num_ext, num_int = excluded.num_int,
      cp = excluded.cp, estado = excluded.estado, municipio = excluded.municipio, contacto_nombre = excluded.contacto_nombre,
      contacto_telefono = excluded.contacto_telefono, contacto_correo = excluded.contacto_correo, contacto_puesto = excluded.contacto_puesto, actualizado_en = now();
    get diagnostics n = row_count;

  elsif p_paso = 'estaciones' then
    insert into sudi_estaciones (sudi_id, cliente_sudi_id, numero_estacion, permiso_pl, nombre, responsable, rfc, utm_x, utm_y, latitud, longitud, lat, lng, hemisferio, zona, calle, colonia, cp, estado, municipio, actualizado_en)
    select sudi_id, cliente_sudi_id, numero_estacion, permiso_pl, nombre, responsable, rfc, utm_x, utm_y, latitud, longitud, lat, lng, hemisferio, zona, calle, colonia, cp, estado, municipio, now()
    from jsonb_populate_recordset(null::sudi_estaciones, p_filas) r
    where sudi_id is not null and exists (select 1 from sudi_clientes c where c.sudi_id = r.cliente_sudi_id)
    on conflict (sudi_id) do update set cliente_sudi_id = excluded.cliente_sudi_id, numero_estacion = excluded.numero_estacion, permiso_pl = excluded.permiso_pl,
      nombre = excluded.nombre, responsable = excluded.responsable, rfc = excluded.rfc, utm_x = excluded.utm_x, utm_y = excluded.utm_y,
      latitud = excluded.latitud, longitud = excluded.longitud, lat = excluded.lat, lng = excluded.lng, hemisferio = excluded.hemisferio,
      zona = excluded.zona, calle = excluded.calle, colonia = excluded.colonia, cp = excluded.cp, estado = excluded.estado,
      municipio = excluded.municipio, actualizado_en = now();
    get diagnostics n = row_count;

  elsif p_paso = 'dispensarios' then
    insert into sudi_dispensarios (sudi_id, estacion_sudi_id, numero, serie, dgn, marca, modelo, mangueras, actualizado_en)
    select sudi_id, estacion_sudi_id, numero, serie, dgn, marca, modelo, mangueras, now()
    from jsonb_populate_recordset(null::sudi_dispensarios, p_filas) r
    where sudi_id is not null and exists (select 1 from sudi_estaciones s where s.sudi_id = r.estacion_sudi_id)
    on conflict (sudi_id) do update set estacion_sudi_id = excluded.estacion_sudi_id, numero = excluded.numero, serie = excluded.serie,
      dgn = excluded.dgn, marca = excluded.marca, modelo = excluded.modelo, mangueras = excluded.mangueras, actualizado_en = now();
    get diagnostics n = row_count;

  elsif p_paso = 'fin' then
    select importacion_iniciada into ini from sudi_importacion_config where id = 1;
    -- dispensarios que ya no existen en SUDI (no se actualizaron en esta importación)
    if ini is not null then delete from sudi_dispensarios where actualizado_en < ini; end if;
    update sudi_importacion_config set ultima_importacion = now() where id = 1;
    select jsonb_agg(jsonb_build_object('paso', x.paso, 'filas', x.filas)) into res from sync_sudi_a_portal() x;
    return res;
  else
    raise exception 'Paso desconocido: %', p_paso;
  end if;

  return jsonb_build_object('filas', n);
end;
$$;
revoke all on function public.sudi_importar(text, text, jsonb) from public;
grant execute on function public.sudi_importar(text, text, jsonb) to anon, authenticated;

select * from public.sync_sudi_a_portal();

-- Token para el botón "Actualizar SUDI" (cópialo; solo se pide una vez en esa computadora):
select token as token_importacion_sudi from public.sudi_importacion_config where id = 1;

-- Lista de las pendientes (correr aparte si se quiere ver):
-- select s.sudi_id, s.numero_estacion, s.permiso_pl, s.nombre, c.razon_social
-- from sudi_estaciones s join sudi_clientes c on c.sudi_id = s.cliente_sudi_id
-- where not exists (select 1 from estaciones_servicio x where x.sudi_id = s.sudi_id)
-- order by s.permiso_pl;
