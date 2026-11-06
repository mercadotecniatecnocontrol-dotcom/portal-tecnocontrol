-- Envíos del formulario SERVICIO TECNICO de Connecteam (6-nov-2026).
-- Los usa Operaciones → Folios por programar → "Ya realizado" / "Ya en Connecteam".
create table if not exists public.connecteam_servicios (
  id text primary key,                 -- "ST-" + número de envío de Connecteam
  numero integer,
  formulario text,
  tecnico text,
  auxiliar text,
  enviado_en timestamptz,
  fecha_servicio timestamptz,
  cliente text,
  razon_social text,
  os text,
  ubicacion text,
  descripcion text,
  concluyo boolean,
  motivo_no text,
  material boolean,
  almacen text,
  nota text,
  status text,
  folios text[] default '{}',          -- números de folio encontrados (MC0536765, 146818…)
  orden_url text,
  evidencias jsonb default '[]',
  videos jsonb default '[]',
  firma_url text,
  folio_id text,                       -- folio del portal al que se ligó
  ligado_en timestamptz,
  importado_en timestamptz,
  importado_por text
);
create index if not exists connecteam_servicios_folios_idx on public.connecteam_servicios using gin (folios);

alter table public.connecteam_servicios enable row level security;
drop policy if exists "cts_select" on public.connecteam_servicios;
drop policy if exists "cts_insert" on public.connecteam_servicios;
drop policy if exists "cts_update" on public.connecteam_servicios;
create policy "cts_select" on public.connecteam_servicios for select to anon, authenticated using (true);
create policy "cts_insert" on public.connecteam_servicios for insert to anon, authenticated with check (true);
create policy "cts_update" on public.connecteam_servicios for update to anon, authenticated using (true) with check (true);
