-- TecnoLab — Cuarto de Control de Equipos (14-nov-2026)
-- 1) Solicitudes de equipo (quién lo usa, servicio, razón social, desde/hasta con hora) que autoriza la responsable.
-- 2) Comentarios y reportes de falla por equipo, con archivos (bucket viaticos-comprobantes, carpeta tecnolab/).
-- La configuración de calibración se guarda en la propia pieza (ops_herramientas.extra.calibracion): no necesita tabla.

create table if not exists public.tecnolab_solicitudes (
  id                bigint generated always as identity primary key,
  herramienta_id    text not null,
  herramienta_folio text,
  herramienta_desc  text,
  folio_id          text,              -- servicio del Calendario (ops_folios)
  servicio_txt      text,
  razon_social      text,
  tecnico_id        text,
  tecnico_nombre    text,
  tecnico_correo    text,
  desde             timestamptz not null,
  hasta             timestamptz not null,
  notas             text,
  estatus           text not null default 'Pendiente',  -- Pendiente, Aprobada, Rechazada, Entregada, Devuelta, Cancelada
  solicito_nombre   text,
  solicito_correo   text,
  respuesta         text,
  respondio         text,
  respondido_en     timestamptz,
  entrego           text,
  entregado_en      timestamptz,
  recibio           text,
  devuelto_en       timestamptz,
  creado_en         timestamptz default now(),
  actualizado_en    timestamptz default now()
);
create index if not exists tecnolab_sol_herr  on public.tecnolab_solicitudes (herramienta_id);
create index if not exists tecnolab_sol_folio on public.tecnolab_solicitudes (folio_id);

create table if not exists public.tecnolab_comentarios (
  id                bigint generated always as identity primary key,
  herramienta_id    text not null,
  herramienta_folio text,
  tipo              text default 'comentario',   -- comentario, falla, problema, calibracion, otro
  texto             text,
  archivos          jsonb default '[]'::jsonb,   -- [{ruta, nombre, tipo, tam}]
  autor_nombre      text,
  autor_correo      text,
  origen            text default 'portal',       -- portal | app
  creado_en         timestamptz default now()
);
create index if not exists tecnolab_com_herr on public.tecnolab_comentarios (herramienta_id, creado_en);

alter table public.tecnolab_solicitudes enable row level security;
alter table public.tecnolab_comentarios enable row level security;

-- Misma forma de acceso que ya usan el portal y la app (llave pública)
drop policy if exists "tl_sol_all" on public.tecnolab_solicitudes;
create policy "tl_sol_all" on public.tecnolab_solicitudes for all to anon, authenticated using (true) with check (true);
drop policy if exists "tl_com_all" on public.tecnolab_comentarios;
create policy "tl_com_all" on public.tecnolab_comentarios for all to anon, authenticated using (true) with check (true);
