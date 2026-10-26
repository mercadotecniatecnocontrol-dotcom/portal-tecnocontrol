-- ═══════════════════════════════════════════════════════════════════
-- Avisos (26-oct-2026) — correr en Supabase → SQL Editor → Run, ANTES de subir los archivos.
-- Solo agrega; no borra ni cambia nada existente.
--
-- 1) Interruptor de voz por persona en "Quién recibe qué" → Personas.
--    Quien no tiene regla, o la tiene sin tocar, sigue con voz (como hoy).
-- 2) Evento nuevo "servicio_programado_almacen": cuando Operaciones programa o
--    reprograma un servicio que lleva refacciones, avisa a Almacén con fecha, hora
--    y técnico. Se crea con los MISMOS destinatarios que ya tiene
--    "servicio_material_almacen" (lo puedes cambiar después en el panel → Eventos).
-- ═══════════════════════════════════════════════════════════════════
begin;

alter table public.notif_preferencias add column if not exists voz boolean not null default true;

do $$
declare cols text;
begin
  if exists (select 1 from public.notif_matriz where evento = 'servicio_programado_almacen') then return; end if;
  select string_agg(quote_ident(column_name), ', ') into cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'notif_matriz'
     and column_name not in ('id', 'evento', 'creado_en', 'creada_en', 'actualizado_en', 'actualizado_por', 'nombre', 'descripcion');
  execute format('insert into public.notif_matriz (evento, %s) select %L, %s from public.notif_matriz where evento = %L',
                 cols, 'servicio_programado_almacen', cols, 'servicio_material_almacen');
end $$;

commit;

-- Verificación: debe decir voz_lista = 1 y evento_nuevo = 1 (y mostrar a quién le llegará).
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'notif_preferencias' and column_name = 'voz') as voz_lista,
  (select count(*) from public.notif_matriz where evento = 'servicio_programado_almacen') as evento_nuevo,
  (select destinatarios::text from public.notif_matriz where evento = 'servicio_programado_almacen') as destinatarios_almacen;
