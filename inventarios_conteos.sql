-- ============================================================================
-- inventarios_conteos.sql · Conteos físicos por partes (lotes) — Inventarios
-- ----------------------------------------------------------------------------
-- Correr UNA vez en Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede volver a correr sin romper nada (usa IF NOT EXISTS).
--
--  inv_conteos            = la campaña (ej. "Conteo Fuerza Aérea dic-2026")
--  inv_conteo_lotes       = las partes en que se divide (por ubicación, línea o bloques)
--  inv_conteo_renglones   = cada producto a contar, con la existencia de Aspel
--                           congelada al momento de crear la campaña
-- Tiempo real: las 3 tablas se agregan a la publicación supabase_realtime.
-- ============================================================================

create table if not exists public.inv_conteos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  cve_alm       integer not null,
  almacen       text,
  criterio      text default 'con',          -- con | criticos | sin_mov | todos
  division      text default 'ubicacion',    -- ubicacion | linea | bloques
  ciego         boolean default true,        -- el contador no ve la existencia de Aspel
  estatus       text default 'abierto',      -- abierto | cerrado
  creado_por    text,
  creado        timestamptz default now(),
  cerrado_por   text,
  cerrado       timestamptz
);

create table if not exists public.inv_conteo_lotes (
  id            uuid primary key default gen_random_uuid(),
  conteo_id     uuid not null references public.inv_conteos(id) on delete cascade,
  nombre        text not null,
  orden         integer default 0,
  estatus       text default 'pendiente',    -- pendiente | contando | revision | aprobado
  asignado_a    text,                         -- correo o nombre de quien debe contarlo
  tomado_por    text,                         -- correo de quien lo está contando
  tomado_en     timestamptz,
  enviado_en    timestamptz,
  aprobado_por  text,
  aprobado_en   timestamptz,
  actualizado   timestamptz default now()
);
create index if not exists inv_conteo_lotes_conteo on public.inv_conteo_lotes(conteo_id);

create table if not exists public.inv_conteo_renglones (
  id               uuid primary key default gen_random_uuid(),
  conteo_id        uuid not null references public.inv_conteos(id) on delete cascade,
  lote_id          uuid not null references public.inv_conteo_lotes(id) on delete cascade,
  orden            integer default 0,
  cve_art          text not null,
  descr            text,
  linea            text,
  uni_med          text,
  ubicacion        text,
  existencia_aspel numeric default 0,
  costo            numeric default 0,
  contado          numeric,                   -- null = falta contar
  contado_por      text,
  contado_en       timestamptz,
  reconteo         boolean default false,     -- el supervisor pidió volver a contar
  nota             text,
  unique (lote_id, cve_art)
);
create index if not exists inv_conteo_renglones_conteo on public.inv_conteo_renglones(conteo_id);
create index if not exists inv_conteo_renglones_lote   on public.inv_conteo_renglones(lote_id);

-- Para que el tiempo real mande la fila completa en cambios
alter table public.inv_conteos          replica identity full;
alter table public.inv_conteo_lotes     replica identity full;
alter table public.inv_conteo_renglones replica identity full;

-- Seguridad: solo usuarios con sesión iniciada en el portal
alter table public.inv_conteos          enable row level security;
alter table public.inv_conteo_lotes     enable row level security;
alter table public.inv_conteo_renglones enable row level security;

drop policy if exists "inv_conteos_all" on public.inv_conteos;
create policy "inv_conteos_all" on public.inv_conteos for all to authenticated using (true) with check (true);
drop policy if exists "inv_conteo_lotes_all" on public.inv_conteo_lotes;
create policy "inv_conteo_lotes_all" on public.inv_conteo_lotes for all to authenticated using (true) with check (true);
drop policy if exists "inv_conteo_renglones_all" on public.inv_conteo_renglones;
create policy "inv_conteo_renglones_all" on public.inv_conteo_renglones for all to authenticated using (true) with check (true);

-- Tiempo real (si ya estaban agregadas, se ignora el error)
do $$ begin
  begin alter publication supabase_realtime add table public.inv_conteos;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.inv_conteo_lotes;     exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.inv_conteo_renglones; exception when duplicate_object then null; end;
end $$;
