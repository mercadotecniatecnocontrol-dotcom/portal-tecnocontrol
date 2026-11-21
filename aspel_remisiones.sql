-- ═══════════════════════════════════════════════════════════════════════
--  aspel_remisiones — remisiones de Aspel SAE (FACTR01 TIP_DOC='R') en Supabase
--  21-nov-2026 · La llena aspel-pc/sincronizar-remisiones-aspel.js (llave
--  secreta, cada 5 min). El portal (Almacén) la lee para mostrar el número
--  de remisión de cada pedido y regenerar el PDF de la remisión.
--  Enlace con el pedido: pedido_folio = DOC_ANT de Aspel (ej. CHH0000008265).
-- ═══════════════════════════════════════════════════════════════════════
create table if not exists public.aspel_remisiones (
  empresa           text        not null default '01',
  cve_doc           text        not null,              -- número de remisión
  pedido_folio      text        not null default '',   -- DOC_ANT (folio del portal)
  status            text        not null default '',   -- E emitida, C cancelada, O original
  fecha_doc         timestamptz,
  fecha_ent         timestamptz,
  cliente_clave     text        not null default '',
  cliente_nombre    text        not null default '',
  cliente_rfc       text        not null default '',
  cliente_direccion text        not null default '',
  cliente_telefono  text        not null default '',
  vendedor          text        not null default '',
  su_referencia     text        not null default '',
  condicion         text        not null default '',
  almacen           integer,
  moneda            integer,
  tipo_cambio       numeric,
  subtotal          numeric     not null default 0,   -- CAN_TOT
  descuento         numeric     not null default 0,   -- DES_TOT + DES_FIN
  ieps              numeric     not null default 0,   -- IMP_TOT1
  impuesto2         numeric     not null default 0,   -- IMP_TOT2
  impuesto3         numeric     not null default 0,   -- IMP_TOT3
  iva               numeric     not null default 0,   -- IMP_TOT4
  total             numeric     not null default 0,   -- IMPORTE
  observaciones     text        not null default '',
  partidas          jsonb       not null default '[]'::jsonb,
  actualizado_en    timestamptz not null default now(),
  primary key (empresa, cve_doc)
);

create index if not exists aspel_remisiones_pedido_idx on public.aspel_remisiones (pedido_folio);
create index if not exists aspel_remisiones_fecha_idx  on public.aspel_remisiones (fecha_doc desc);

alter table public.aspel_remisiones enable row level security;

-- Lectura: igual que surtidos (portal con llave pública)
drop policy if exists aspel_remisiones_lectura on public.aspel_remisiones;
create policy aspel_remisiones_lectura on public.aspel_remisiones
  for select to anon, authenticated using (true);

-- Escritura: ninguna política → solo la llave secreta (service_role) escribe.
revoke insert, update, delete on public.aspel_remisiones from anon, authenticated;
grant select on public.aspel_remisiones to anon, authenticated;
