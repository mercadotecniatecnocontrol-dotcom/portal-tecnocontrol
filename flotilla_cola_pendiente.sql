-- Solicitudes de Flotilla que se quedaron guardadas en el teléfono sin poder enviarse.
-- La app móvil reporta aquí su cola cada vez que tiene señal y borra la fila cuando la solicitud se envía.
create table if not exists public.flotilla_cola_pendiente (
  id             text primary key,          -- dispositivo + id de la solicitud
  dispositivo    text not null,
  usuario_email  text,
  usuario_nombre text,
  eco            text,
  tipo           text,
  creado_en      timestamptz,               -- cuándo la capturó el técnico
  num_fotos      int default 0,
  num_videos     int default 0,
  ultimo_error   text,
  error_en       timestamptz,
  app_instalada  boolean,
  user_agent     text,
  reportado_en   timestamptz default now()
);

create index if not exists flotilla_cola_pendiente_disp on public.flotilla_cola_pendiente (dispositivo);

alter table public.flotilla_cola_pendiente enable row level security;

-- Misma forma de acceso que ya usa la app móvil (llave pública anon)
drop policy if exists "cola_select" on public.flotilla_cola_pendiente;
drop policy if exists "cola_insert" on public.flotilla_cola_pendiente;
drop policy if exists "cola_update" on public.flotilla_cola_pendiente;
drop policy if exists "cola_delete" on public.flotilla_cola_pendiente;
create policy "cola_select" on public.flotilla_cola_pendiente for select to anon, authenticated using (true);
create policy "cola_insert" on public.flotilla_cola_pendiente for insert to anon, authenticated with check (true);
create policy "cola_update" on public.flotilla_cola_pendiente for update to anon, authenticated using (true) with check (true);
create policy "cola_delete" on public.flotilla_cola_pendiente for delete to anon, authenticated using (true);
