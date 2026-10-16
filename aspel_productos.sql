-- ═══════════════════════════════════════════════════════════════════════
--  aspel_productos — catálogo oficial de Aspel SAE (INVE01) en Supabase
--  16-oct-2026 · Regla: la clave y la descripción de Aspel son siempre
--  las correctas. La llena sincronizar-productos-aspel.js (llave secreta).
--  Solo guarda clave, descripción, unidad, línea y estatus: sin precios
--  ni existencias, por eso se puede leer desde el portal y el kiosco.
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.aspel_productos (
  empresa        text        not null default '01',
  clave          text        not null,
  descripcion    text        not null default '',
  unidad         text        not null default '',
  linea          text        not null default '',
  status         text        not null default '',
  actualizado_en timestamptz not null default now(),
  primary key (empresa, clave)
);

create index if not exists aspel_productos_clave_upper_idx
  on public.aspel_productos (upper(clave));

alter table public.aspel_productos enable row level security;

-- Lectura: portal, kiosco, TV de Almacén y Flotilla (anon y authenticated)
drop policy if exists aspel_productos_lectura on public.aspel_productos;
create policy aspel_productos_lectura on public.aspel_productos
  for select to anon, authenticated using (true);

-- Escritura: ninguna política → solo la llave secreta (service_role) escribe.
revoke insert, update, delete on public.aspel_productos from anon, authenticated;
grant select on public.aspel_productos to anon, authenticated;
