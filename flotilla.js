// ══════════════════════════════════════════════════════════════
// flotilla.js — Flotilla Vehicular v4
// Portal Operativo Tecnocontrol
// Depende de: flotilla-reglas.js, Firebase (db, fs) del portal
// ══════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ── COLECCIONES FIRESTORE ──
  const COL_VEHS = 'flotilla_vehiculos';
  const COL_SOLS = 'flotilla_solicitudes';

  // ── ESTADO GLOBAL ──
  let flVehiculos   = [];
  let flSolicitudes = [];
  let flVehActivo   = null;
  let flTabActiva   = 'info';
  let flVistaActual = 'home';
  let flBusqueda    = '';
  let flFotosBase64 = [];

  // ── ÍCONOS SVG INLINE ──
  const ICO = {
    car:    `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
    truck:  `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    grid:   `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    list:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    info:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    doc:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    hist:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
    wrench: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
    check:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    x:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    plus:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    upload: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`,
  };

  // ── ESTILOS ──
  function flInyectarEstilos() {
    if (document.getElementById('fl-styles-v4')) return;
    const style = document.createElement('style');
    style.id = 'fl-styles-v4';
    style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

#flotilla-dashboard {
  display: none; margin-left: 240px; min-height: 100vh;
  background: #F5F4F1; font-family: 'DM Sans', -apple-system, sans-serif; color: #1A1917;
}
#flotilla-dashboard * { box-sizing: border-box; margin: 0; padding: 0; }
.fl-topbar { background:#fff; border-bottom:1px solid #E5E3DE; padding:0 28px; display:flex; align-items:center; gap:12px; height:60px; position:sticky; top:0; z-index:100; }
.fl-topbar-title { font-size:16px; font-weight:700; letter-spacing:-.3px; flex:1; display:flex; align-items:center; gap:8px; }
.fl-topbar-role { font-size:12px; padding:4px 10px; border-radius:100px; background:#E8EEFF; color:#1B4DFF; font-weight:600; }
.fl-btn-primary { display:flex; align-items:center; gap:6px; background:#1B4DFF; color:#fff; border:none; border-radius:8px; padding:9px 18px; font-size:13.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:background .18s,transform .18s; }
.fl-btn-primary:hover { background:#1840e0; transform:translateY(-1px); }
.fl-btn-ghost { display:flex; align-items:center; gap:6px; background:transparent; color:#7A7873; border:1px solid #E5E3DE; border-radius:8px; padding:8px 14px; font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all .18s; }
.fl-btn-ghost:hover { border-color:#1B4DFF; color:#1B4DFF; }
.fl-layout { display:grid; grid-template-columns:270px 1fr; min-height:calc(100vh - 60px); }
.fl-sidebar { background:#fff; border-right:1px solid #E5E3DE; padding:14px 10px; display:flex; flex-direction:column; gap:4px; overflow-y:auto; }
.fl-sidebar-section { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#7A7873; padding:10px 8px 4px; margin-top:4px; }
.fl-search-box { position:relative; margin-bottom:6px; }
.fl-search-box input { width:100%; padding:9px 12px 9px 34px; border:1.5px solid #E5E3DE; border-radius:8px; font-size:13px; font-family:inherit; color:#1A1917; background:#F5F4F1; outline:none; transition:border-color .18s; }
.fl-search-box input:focus { border-color:#1B4DFF; }
.fl-search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#7A7873; pointer-events:none; display:flex; }
.fl-sidebar-stats { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:4px; }
.fl-stat-mini { border-radius:10px; padding:10px 12px; }
.fl-stat-mini .num { font-size:20px; font-weight:700; line-height:1; }
.fl-stat-mini .lbl { font-size:11px; font-weight:600; margin-top:2px; }
.fl-veh-item { border-radius:8px; padding:10px; cursor:pointer; transition:all .18s; border:1.5px solid transparent; display:flex; align-items:center; gap:10px; }
.fl-veh-item:hover { background:#F5F4F1; }
.fl-veh-item.active { background:#E8EEFF; border-color:#1B4DFF; }
.fl-veh-avatar { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.fl-veh-name  { font-size:13px; font-weight:600; }
.fl-veh-plate { font-size:11px; color:#7A7873; font-family:'JetBrains Mono',monospace; }
.fl-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-left:auto; }
.fl-dot.activo   { background:#16A34A; }
.fl-dot.taller   { background:#D97706; }
.fl-dot.inactivo { background:#CBD5E1; }
.fl-badge { display:inline-flex; align-items:center; font-size:11.5px; font-weight:600; padding:3px 9px; border-radius:100px; white-space:nowrap; }
.fl-badge.activo,.fl-badge.Aprobada    { background:#DCFCE7; color:#16A34A; }
.fl-badge.taller,.fl-badge.proceso     { background:#FEF3C7; color:#D97706; }
.fl-badge.inactivo,.fl-badge.Cerrada   { background:#F1F5F9; color:#64748B; }
.fl-badge.pendiente,.fl-badge.Solicitud{ background:#EDE9FE; color:#7C3AED; }
.fl-badge.aprobado                     { background:#DCFCE7; color:#16A34A; }
.fl-badge.rechazado,.fl-badge.Rechazada{ background:#FEE2E2; color:#DC2626; }
.fl-badge.Validada  { background:#DBEAFE; color:#2563EB; }
.fl-badge.Cotizacin { background:#FEF3C7; color:#D97706; }
.fl-badge.Cierre    { background:#F3E8FF; color:#7C3AED; }
.fl-main { padding:28px 32px; overflow-y:auto; }
.fl-alerts { display:flex; flex-direction:column; gap:8px; margin-bottom:22px; }
.fl-alert { display:flex; align-items:center; gap:10px; padding:11px 14px; border-radius:8px; font-size:13.5px; font-weight:500; }
.fl-alert.warn  { background:#FEF3C7; color:#92400E; }
.fl-alert.error { background:#FEE2E2; color:#991B1B; }
.fl-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
.fl-kpi { background:#fff; border:1px solid #E5E3DE; border-radius:12px; padding:18px 20px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
.fl-kpi-label { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#7A7873; margin-bottom:6px; }
.fl-kpi-value { font-size:26px; font-weight:700; letter-spacing:-.5px; line-height:1; }
.fl-kpi-sub   { font-size:12px; color:#7A7873; margin-top:4px; }
.fl-tabs { display:flex; gap:2px; background:#F5F4F1; border-radius:10px; padding:4px; margin-bottom:22px; width:fit-content; }
.fl-tab-btn { padding:8px 18px; border-radius:8px; border:none; background:transparent; cursor:pointer; font-family:inherit; font-size:13.5px; font-weight:500; color:#7A7873; transition:all .18s; display:flex; align-items:center; gap:6px; white-space:nowrap; }
.fl-tab-btn:hover { color:#1A1917; }
.fl-tab-btn.active { background:#fff; color:#1A1917; box-shadow:0 1px 4px rgba(0,0,0,.08); }
.fl-det-header { display:flex; align-items:flex-start; gap:18px; margin-bottom:22px; }
.fl-det-avatar { width:60px; height:60px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0; }
.fl-det-eco { font-size:22px; font-weight:700; letter-spacing:-.4px; }
.fl-det-sub { font-size:13.5px; color:#7A7873; margin-top:5px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.fl-info-grid { display:grid; grid-template-columns:1fr 1fr; background:#fff; border:1px solid #E5E3DE; border-radius:12px; overflow:hidden; margin-bottom:24px; }
.fl-info-cell { padding:14px 18px; border-bottom:1px solid #E5E3DE; }
.fl-info-cell:nth-child(odd)       { border-right:1px solid #E5E3DE; }
.fl-info-cell:nth-last-child(-n+2) { border-bottom:none; }
.fl-info-cell dt { font-size:10.5px; text-transform:uppercase; letter-spacing:.6px; color:#7A7873; font-weight:700; margin-bottom:4px; }
.fl-info-cell dd { font-size:14px; font-weight:500; }
.fl-info-cell dd.mono { font-family:'JetBrains Mono',monospace; font-size:12.5px; }
.fl-vencs { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:18px; }
.fl-venc-card { padding:14px 16px; border-radius:10px; border:1.5px solid; }
.fl-venc-label { font-size:10.5px; text-transform:uppercase; letter-spacing:.5px; font-weight:700; margin-bottom:6px; }
.fl-venc-fecha { font-size:15px; font-weight:700; }
.fl-venc-dias  { font-size:12px; margin-top:3px; }
.fl-table-wrap { background:#fff; border:1px solid #E5E3DE; border-radius:12px; overflow:hidden; }
.fl-table { width:100%; border-collapse:collapse; font-size:13.5px; }
.fl-table th { background:#F5F4F1; padding:11px 15px; text-align:left; font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#7A7873; border-bottom:1px solid #E5E3DE; }
.fl-table td { padding:13px 15px; border-bottom:1px solid #E5E3DE; vertical-align:middle; }
.fl-table tr:last-child td { border-bottom:none; }
.fl-table tr:hover td { background:#F5F4F1; }
.fl-table tr { cursor:pointer; }
.fl-timeline { background:#fff; border:1px solid #E5E3DE; border-radius:12px; overflow:hidden; }
.fl-tl-item { display:grid; grid-template-columns:42px 1fr; gap:12px; padding:14px 16px; border-bottom:1px solid #E5E3DE; align-items:flex-start; }
.fl-tl-item:last-child { border-bottom:none; }
.fl-tl-icon  { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:16px; }
.fl-tl-title { font-size:14px; font-weight:600; }
.fl-tl-meta  { font-size:12px; color:#7A7873; margin-top:2px; }
.fl-tl-desc  { font-size:13px; margin-top:5px; }
.fl-action-row { display:flex; gap:6px; }
.fl-btn-ok  { padding:6px 12px; background:#DCFCE7; color:#16A34A; border:none; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .18s; }
.fl-btn-ok:hover  { background:#16A34A; color:#fff; }
.fl-btn-no  { padding:6px 12px; background:#FEE2E2; color:#DC2626; border:none; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .18s; }
.fl-btn-no:hover  { background:#DC2626; color:#fff; }
.fl-btn-sm  { padding:6px 12px; background:#F5F4F1; color:#7A7873; border:1px solid #E5E3DE; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .18s; }
.fl-btn-sm:hover  { border-color:#1B4DFF; color:#1B4DFF; }
.fl-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px); animation:flFadeIn .15s ease; }
@keyframes flFadeIn { from{opacity:0} to{opacity:1} }
.fl-modal { background:#fff; border-radius:16px; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; box-shadow:0 8px 40px rgba(0,0,0,.18); animation:flSlideUp .2s cubic-bezier(.4,0,.2,1); font-family:'DM Sans',sans-serif; color:#1A1917; }
@keyframes flSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
.fl-modal-head { padding:22px 24px 0; display:flex; align-items:center; justify-content:space-between; gap:12px; }
.fl-modal-head h3 { font-size:18px; font-weight:700; letter-spacing:-.3px; }
.fl-modal-close { width:30px; height:30px; border:none; background:#F5F4F1; border-radius:8px; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; transition:background .18s; }
.fl-modal-close:hover { background:#E5E3DE; }
.fl-modal-body { padding:18px 24px 24px; }
.fl-form { display:flex; flex-direction:column; gap:14px; }
.fl-field { display:flex; flex-direction:column; gap:5px; }
.fl-field label { font-size:12.5px; font-weight:700; }
.fl-field input,.fl-field select,.fl-field textarea { padding:10px 13px; border:1.5px solid #E5E3DE; border-radius:8px; font-family:inherit; font-size:14px; color:#1A1917; background:#F5F4F1; outline:none; transition:border-color .18s; width:100%; }
.fl-field input:focus,.fl-field select:focus,.fl-field textarea:focus { border-color:#1B4DFF; background:#fff; }
.fl-field textarea { min-height:90px; resize:vertical; }
.fl-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.fl-form-actions { display:flex; justify-content:flex-end; gap:10px; padding-top:10px; border-top:1px solid #E5E3DE; margin-top:4px; }
.fl-field-note { font-size:11.5px; color:#7A7873; }
.fl-sol-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; background:#F5F4F1; border-radius:10px; overflow:hidden; border:1px solid #E5E3DE; }
.fl-sol-cell { padding:12px 14px; }
.fl-sol-cell:nth-child(odd) { border-right:1px solid #E5E3DE; }
.fl-sol-cell dt { font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; color:#7A7873; margin-bottom:3px; }
.fl-sol-cell dd { font-size:13.5px; font-weight:500; }
.fl-sol-cell.full { grid-column:1/-1; }
.fl-upload-area { border:2px dashed #E5E3DE; border-radius:10px; padding:16px; text-align:center; cursor:pointer; transition:border-color .18s; color:#7A7873; font-size:13px; display:flex; align-items:center; justify-content:center; gap:8px; }
.fl-upload-area:hover { border-color:#1B4DFF; color:#1B4DFF; }
.fl-pills { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
.fl-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; background:#F5F4F1; border:1px solid #E5E3DE; border-radius:100px; font-size:12px; font-weight:500; cursor:pointer; transition:all .18s; font-family:inherit; color:#1A1917; }
.fl-pill:hover { border-color:#1B4DFF; color:#1B4DFF; }
.fl-section-title { font-size:15px; font-weight:700; letter-spacing:-.2px; margin-bottom:12px; }
.fl-sep { height:1px; background:#E5E3DE; margin:18px 0; }
.fl-loading { display:flex; align-items:center; justify-content:center; min-height:260px; color:#7A7873; gap:10px; font-size:14px; }
.fl-spinner { width:20px; height:20px; border:2px solid #E5E3DE; border-top-color:#1B4DFF; border-radius:50%; animation:flSpin .7s linear infinite; }
@keyframes flSpin { to{transform:rotate(360deg)} }
.fl-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:260px; gap:10px; color:#7A7873; text-align:center; }
.fl-empty-icon { font-size:44px; opacity:.3; margin-bottom:8px; }
.fl-empty h3 { font-size:17px; font-weight:700; color:#1A1917; }
.fl-empty p  { font-size:13.5px; max-width:280px; }
@media (max-width:900px) {
  #flotilla-dashboard { margin-left:0; }
  .fl-layout { grid-template-columns:1fr; }
  .fl-sidebar { border-right:none; border-bottom:1px solid #E5E3DE; max-height:240px; }
  .fl-kpis  { grid-template-columns:1fr 1fr; }
  .fl-vencs { grid-template-columns:1fr 1fr; }
  .fl-info-grid { grid-template-columns:1fr; }
  .fl-info-cell:nth-child(odd) { border-right:none; }
  .fl-info-cell:nth-last-child(-n+2) { border-bottom:1px solid #E5E3DE; }
  .fl-info-cell:last-child { border-bottom:none; }
  .fl-form-row { grid-template-columns:1fr; }
  .fl-main { padding:20px 16px; }
}
    `;
    document.head.appendChild(style);
  }

  // ── HTML BASE ──
  function flInyectarHTML() {
    const contenedor = document.getElementById('flotilla-dashboard');
    if (!contenedor) return;
    contenedor.innerHTML = `
      <div class="fl-topbar">
        <div class="fl-topbar-title">${ICO.truck} Flotilla Vehicular</div>
        <span class="fl-topbar-role" id="fl-rol-label">—</span>
        <button class="fl-btn-ghost" onclick="flVerSolicitudesGlobal()">${ICO.list} Todas las solicitudes</button>
        <button class="fl-btn-primary" id="fl-btn-nueva" onclick="flAbrirModalSolicitud()">${ICO.plus} Nueva solicitud</button>
      </div>
      <div class="fl-layout">
        <aside class="fl-sidebar">
          <div class="fl-search-box">
            <span class="fl-search-icon">${ICO.search}</span>
            <input type="text" id="fl-buscar" placeholder="Buscar vehículo…" oninput="flFiltrarVehiculos(this.value)">
          </div>
          <div class="fl-sidebar-stats">
            <div class="fl-stat-mini" style="background:#DCFCE7">
              <div class="num" style="color:#16A34A" id="fl-stat-activos">—</div>
              <div class="lbl" style="color:#16A34A">Activos</div>
            </div>
            <div class="fl-stat-mini" style="background:#FEF3C7">
              <div class="num" style="color:#D97706" id="fl-stat-taller">—</div>
              <div class="lbl" style="color:#D97706">En taller</div>
            </div>
          </div>
          <div class="fl-veh-item active" id="fl-home-btn" onclick="flVerHome()">
            <div class="fl-veh-avatar" style="background:#E8EEFF;color:#1B4DFF">${ICO.grid}</div>
            <div>
              <div class="fl-veh-name">Panel general</div>
              <div class="fl-veh-plate">Resumen de flotilla</div>
            </div>
          </div>
          <div class="fl-sidebar-section">Vehículos</div>
          <div id="fl-lista-vehs">
            <div class="fl-loading" style="min-height:60px;font-size:12px">
              <div class="fl-spinner"></div> Cargando…
            </div>
          </div>
        </aside>
        <main class="fl-main" id="fl-main-panel">
          <div class="fl-loading"><div class="fl-spinner"></div> Cargando flotilla…</div>
        </main>
      </div>
    `;
  }

  // ── HELPERS ──
  function flStatusBg(s)    { return s==='activo'?'#E8FAEA':s==='taller'?'#FEF9E7':'#F1F5F9'; }
  function flStatusClr(s)   { return s==='activo'?'#16A34A':s==='taller'?'#D97706':'#64748B'; }
  function flEmoji(tipo)    { return tipo==='camion'?'🚛':tipo==='van'?'🚐':'🚗'; }
  function flIconVeh(tipo)  { return tipo==='camion'?ICO.truck:ICO.car; }
  function flDias(f)        { if(!f) return null; return Math.round((new Date(f)-new Date())/86400000); }
  function flVencC(dias) {
    if (dias===null) return {bg:'#F1F5F9',text:'#64748B',border:'#CBD5E1'};
    if (dias<0)      return {bg:'#FEE2E2',text:'#DC2626',border:'#FECACA'};
    if (dias<60)     return {bg:'#FEF3C7',text:'#D97706',border:'#FDE68A'};
    return             {bg:'#DCFCE7',text:'#16A34A',border:'#BBF7D0'};
  }
  function flDiasLbl(d) {
    if (d===null) return '—';
    if (d<0)  return 'Vencido hace '+Math.abs(d)+' días';
    if (d===0) return 'Vence hoy';
    if (d<60)  return 'Vence en '+d+' días';
    return 'Vigente';
  }
  function flVencLbl(k) {
    return {seguro:'Seguro',verificacion:'Verificación',tenencia:'Tenencia',circulacion:'Tarjeta circ.'}[k]||k;
  }
  function flBadge(e) { const c=(e||'').replace(/[^a-zA-Z0-9]/g,''); return `<span class="fl-badge ${c}">${e||'—'}</span>`; }
  function flFecha(iso) { return iso?String(iso).substring(0,10):'—'; }

  // ── INICIALIZACIÓN ──
  window.cargarFlotilla = async function () {
    flInyectarEstilos();
    flInyectarHTML();
    flActualizarRol();
    await Promise.all([flCargarVehiculos(), flCargarSolicitudes()]);
    flRenderHome();
  };

  function flActualizarRol() {
    const rol = window.flGetRolActual ? window.flGetRolActual() : 'Usuario';
    const el = document.getElementById('fl-rol-label');
    if (el) el.textContent = rol;
    const btn = document.getElementById('fl-btn-nueva');
    if (btn) btn.style.display = (window.flTienePermiso ? window.flTienePermiso('crear_solicitud') : true) ? '' : 'none';
  }

  async function flCargarVehiculos() {
    try {
      const snap = await fs.getDocs(fs.collection(db, COL_VEHS));
      flVehiculos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.warn('[FLOTILLA] Sin flotilla_vehiculos:', e.message); flVehiculos = []; }
    flRenderSidebar();
  }

  async function flCargarSolicitudes() {
    try {
      const snap = await fs.getDocs(fs.collection(db, COL_SOLS));
      flSolicitudes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      flSolicitudes.sort((a,b) => (b.creadoEn||'').localeCompare(a.creadoEn||''));
    } catch (e) { console.warn('[FLOTILLA] Error solicitudes:', e.message); flSolicitudes = []; }
  }

  function flRenderSidebar() {
    const sa = document.getElementById('fl-stat-activos');
    const st = document.getElementById('fl-stat-taller');
    if (sa) sa.textContent = flVehiculos.filter(v=>v.status==='activo').length;
    if (st) st.textContent = flVehiculos.filter(v=>v.status==='taller').length;
    const lista = document.getElementById('fl-lista-vehs');
    if (!lista) return;
    const vehs = flVehiculos.filter(v => {
      if (!flBusqueda) return true;
      const q = flBusqueda.toLowerCase();
      return (v.eco||'').toLowerCase().includes(q)||(v.placas||'').toLowerCase().includes(q)
          || (v.modelo||'').toLowerCase().includes(q)||(v.responsable||'').toLowerCase().includes(q);
    });
    if (!vehs.length) { lista.innerHTML=`<div style="text-align:center;padding:20px;color:#7A7873;font-size:13px">${flVehiculos.length?'Sin resultados':'Sin vehículos registrados'}</div>`; return; }
    lista.innerHTML = vehs.map(v=>`
      <div class="fl-veh-item ${flVehActivo===v.id?'active':''}" onclick="flSeleccionarVehiculo('${v.id}')">
        <div class="fl-veh-avatar" style="background:${flStatusBg(v.status)};color:${flStatusClr(v.status)}">${flIconVeh(v.tipo)}</div>
        <div style="flex:1;min-width:0">
          <div class="fl-veh-name">${v.eco||'—'}</div>
          <div class="fl-veh-plate">${v.placas||''} · ${v.modelo||''}</div>
        </div>
        <div class="fl-dot ${v.status||'inactivo'}"></div>
      </div>`).join('');
  }

  window.flFiltrarVehiculos = function(val) { flBusqueda=val; flRenderSidebar(); };

  window.flVerHome = function() {
    flVehActivo=null; flVistaActual='home';
    document.querySelectorAll('#flotilla-dashboard .fl-veh-item').forEach(el=>el.classList.remove('active'));
    document.getElementById('fl-home-btn')?.classList.add('active');
    flRenderHome();
  };

  function flRenderHome() {
    const alertas=[];
    flVehiculos.forEach(v=>{
      Object.entries(v.vencimientos||{}).forEach(([k,val])=>{
        const d=flDias(val.fecha||val);
        if(d!==null&&d<60) alertas.push({nivel:d<0?'error':'warn',txt:`${v.eco} — ${flVencLbl(k)} ${d<0?'VENCIDO':'por vencer el '+(val.fecha||val)}`});
      });
    });
    const activas=flSolicitudes.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus||s.status));
    const pA=window.flTienePermiso?window.flTienePermiso('aprobar'):false;
    document.getElementById('fl-main-panel').innerHTML=`
      <div style="max-width:880px">
        <div style="font-size:22px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px">Panel de Flotilla</div>
        <div style="font-size:14px;color:#7A7873;margin-bottom:22px">Selecciona un vehículo del panel izquierdo para ver su detalle.</div>
        ${alertas.length?`<div class="fl-alerts">${alertas.map(a=>`<div class="fl-alert ${a.nivel}">${a.nivel==='error'?'🔴':'🟡'} ${a.txt}</div>`).join('')}</div>`:''}
        <div class="fl-kpis">
          <div class="fl-kpi"><div class="fl-kpi-label">Total flotilla</div><div class="fl-kpi-value">${flVehiculos.length}</div><div class="fl-kpi-sub">unidades</div></div>
          <div class="fl-kpi"><div class="fl-kpi-label">En operación</div><div class="fl-kpi-value" style="color:#16A34A">${flVehiculos.filter(v=>v.status==='activo').length}</div><div class="fl-kpi-sub">activas</div></div>
          <div class="fl-kpi"><div class="fl-kpi-label">En taller</div><div class="fl-kpi-value" style="color:#D97706">${flVehiculos.filter(v=>v.status==='taller').length}</div><div class="fl-kpi-sub">fuera de servicio</div></div>
          <div class="fl-kpi"><div class="fl-kpi-label">Solicitudes activas</div><div class="fl-kpi-value" style="color:#7C3AED">${activas.length}</div><div class="fl-kpi-sub">${pA?'requieren revisión':'en proceso'}</div></div>
        </div>
        <div class="fl-section-title">Solicitudes recientes</div>
        ${flRenderTabla(flSolicitudes.slice(0,15),pA)}
      </div>`;
  }

  window.flSeleccionarVehiculo = function(id) {
    flVehActivo=id; flTabActiva='info'; flVistaActual='detalle';
    document.querySelectorAll('#flotilla-dashboard .fl-veh-item').forEach(el=>el.classList.remove('active'));
    document.getElementById('fl-home-btn')?.classList.remove('active');
    document.querySelector(`#fl-lista-vehs .fl-veh-item[onclick="flSeleccionarVehiculo('${id}')"]`)?.classList.add('active');
    flRenderDetalle();
  };

  function flRenderDetalle() {
    const v=flVehiculos.find(x=>x.id===flVehActivo);
    if(!v){document.getElementById('fl-main-panel').innerHTML=`<div class="fl-empty"><div class="fl-empty-icon">🚗</div><h3>Vehículo no encontrado</h3></div>`;return;}
    const alertas=[];
    Object.entries(v.vencimientos||{}).forEach(([k,val])=>{const d=flDias(val.fecha||val);if(d!==null&&d<60)alertas.push({nivel:d<0?'error':'warn',txt:`${flVencLbl(k)} ${d<0?'VENCIDO':'por vencer el '+(val.fecha||val)}`});});
    const pA=window.flTienePermiso?window.flTienePermiso('aprobar'):false;
    document.getElementById('fl-main-panel').innerHTML=`
      <div style="max-width:820px">
        <div class="fl-det-header">
          <div class="fl-det-avatar" style="background:${flStatusBg(v.status)}"><span style="font-size:26px">${flEmoji(v.tipo)}</span></div>
          <div style="flex:1">
            <div class="fl-det-eco">${v.eco||'—'} — ${v.marca||''} ${v.modelo||''}</div>
            <div class="fl-det-sub">
              <span>${v.km?v.km.toLocaleString()+' km':'—'}</span><span>·</span>
              <span>👤 ${v.responsable||'Sin asignar'}</span><span>·</span>${flBadge(v.status)}
            </div>
          </div>
          <button class="fl-btn-ghost" onclick="flVerHome()">← Volver</button>
        </div>
        ${alertas.length?`<div class="fl-alerts">${alertas.map(a=>`<div class="fl-alert ${a.nivel}">${a.nivel==='error'?'🔴':'🟡'} ${a.txt}</div>`).join('')}</div>`:''}
        <div class="fl-tabs">
          <button class="fl-tab-btn ${flTabActiva==='info'       ?'active':''}" onclick="flTab('info')">${ICO.info} Información</button>
          <button class="fl-tab-btn ${flTabActiva==='docs'       ?'active':''}" onclick="flTab('docs')">${ICO.doc} Documentos</button>
          <button class="fl-tab-btn ${flTabActiva==='historial'  ?'active':''}" onclick="flTab('historial')">${ICO.hist} Historial</button>
          <button class="fl-tab-btn ${flTabActiva==='solicitudes'?'active':''}" onclick="flTab('solicitudes')">${ICO.wrench} Solicitudes</button>
        </div>
        <div id="fl-tab-content">
          ${flTabActiva==='info'        ?flTabInfo(v)        :''}
          ${flTabActiva==='docs'        ?flTabDocs(v)        :''}
          ${flTabActiva==='historial'   ?flTabHistorial(v)   :''}
          ${flTabActiva==='solicitudes' ?flTabSols(v,pA)     :''}
        </div>
      </div>`;
  }

  window.flTab = function(tab){flTabActiva=tab;flRenderDetalle();};
  window.flCambiarTab = window.flTab; // alias por compatibilidad

  function flTabInfo(v) {
    const vencs=v.vencimientos||{};
    return `
      <div class="fl-info-grid">
        <dl class="fl-info-cell"><dt>Número económico</dt><dd class="mono">${v.eco||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Placas</dt><dd class="mono">${v.placas||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Marca / Modelo</dt><dd>${v.marca||''} ${v.modelo||''}</dd></dl>
        <dl class="fl-info-cell"><dt>Año</dt><dd>${v.anio||v.año||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>VIN / Serie</dt><dd class="mono" style="font-size:11.5px">${v.vin||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Color</dt><dd>${v.color||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Combustible</dt><dd>${v.combustible||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Rendimiento</dt><dd>${v.rendimiento||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Kilometraje</dt><dd>${v.km?v.km.toLocaleString()+' km':'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Responsable</dt><dd>${v.responsable||'—'}</dd></dl>
      </div>
      ${Object.keys(vencs).length?`
        <div class="fl-section-title">Vencimientos</div>
        <div class="fl-vencs">
          ${Object.entries(vencs).map(([k,val])=>{const f=val.fecha||val,d=flDias(f),c=flVencC(d);return`<div class="fl-venc-card" style="background:${c.bg};border-color:${c.border}"><div class="fl-venc-label" style="color:${c.text}">${flVencLbl(k)}</div><div class="fl-venc-fecha" style="color:${c.text}">${f||'—'}</div><div class="fl-venc-dias" style="color:${c.text}">${flDiasLbl(d)}</div></div>`;}).join('')}
        </div>`:'<p style="color:#7A7873;font-size:13.5px">Sin vencimientos registrados.</p>'}`;
  }

  function flTabDocs(v) {
    const vencs=v.vencimientos||{};
    const docs=[{nombre:'Póliza de seguro',key:'seguro'},{nombre:'Verificación vehicular',key:'verificacion'},{nombre:'Tarjeta de circulación',key:'circulacion'},{nombre:'Tenencia',key:'tenencia'},{nombre:'Factura / Título',key:null}];
    return `<div class="fl-table-wrap"><table class="fl-table"><thead><tr><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Archivo</th></tr></thead><tbody>${
      docs.map(d=>{const val=d.key?(vencs[d.key]||{}):{}; const f=val.fecha||'—'; const d2=d.key?flDias(val.fecha):null; const cls=d2===null?'inactivo':d2<0?'rechazado':d2<60?'proceso':'aprobado'; const txt=d2===null?'—':d2<0?'Vencido':d2<60?'Por vencer':'Vigente'; return`<tr><td><strong style="font-size:13px">${d.nombre}</strong></td><td><span style="font-family:'JetBrains Mono',monospace;font-size:12.5px">${f}</span></td><td><span class="fl-badge ${cls}">${txt}</span></td><td><div class="fl-action-row"><button class="fl-pill">${ICO.doc} Ver PDF</button><button class="fl-pill">${ICO.upload} Subir</button></div></td></tr>`;}).join('')
    }</tbody></table></div>`;
  }

  function flTabHistorial(v) {
    const hist=v.historial||[];
    if(!hist.length) return `<div class="fl-empty"><div class="fl-empty-icon">📋</div><h3>Sin historial</h3><p>No hay registros de mantenimiento o incidencias.</p></div>`;
    const iMap={mantenimiento:'🔧',taller:'🏭',incidencia:'⚠️',servicio:'🔩'};
    const bMap={mantenimiento:'#FEF3C7',taller:'#FEE2E2',incidencia:'#FEF3C7',servicio:'#E8EEFF'};
    return `<div class="fl-timeline">${hist.map(h=>`<div class="fl-tl-item"><div class="fl-tl-icon" style="background:${bMap[h.tipo]||'#F5F4F1'}">${iMap[h.tipo]||'📋'}</div><div><div class="fl-tl-title">${h.titulo||'—'}</div><div class="fl-tl-meta">${h.fecha||''}${h.costo?' · '+h.costo:''}</div>${h.descripcion?`<div class="fl-tl-desc">${h.descripcion}</div>`:''}</div></div>`).join('')}</div>`;
  }

  function flTabSols(v,pA) {
    const sols=flSolicitudes.filter(s=>s.vehiculoId===v.id||(s.vehiculo||'').startsWith(v.eco));
    if(!sols.length) return `<div class="fl-empty"><div class="fl-empty-icon">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes para esta unidad.</p></div>`;
    return flRenderTabla(sols,pA);
  }

  window.flVerSolicitudesGlobal = function() {
    flVehActivo=null; flVistaActual='solicitudes';
    document.querySelectorAll('#flotilla-dashboard .fl-veh-item').forEach(el=>el.classList.remove('active'));
    document.getElementById('fl-home-btn')?.classList.remove('active');
    const pA=window.flTienePermiso?window.flTienePermiso('aprobar'):false;
    document.getElementById('fl-main-panel').innerHTML=`
      <div style="max-width:920px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div><div style="font-size:22px;font-weight:700;letter-spacing:-.4px">Todas las solicitudes</div><div style="font-size:14px;color:#7A7873">${flSolicitudes.length} registros</div></div>
          <button class="fl-btn-ghost" onclick="flVerHome()">← Panel general</button>
        </div>
        ${flRenderTabla(flSolicitudes,pA)}
      </div>`;
  };

  function flRenderTabla(sols,pA) {
    if(!sols.length) return `<div class="fl-empty"><div class="fl-empty-icon">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes registradas.</p></div>`;
    return `<div class="fl-table-wrap"><table class="fl-table"><thead><tr><th>Tipo</th><th>Vehículo</th><th>Solicitante</th><th>Cotización</th><th>Estado</th><th>Fecha</th>${pA?'<th>Acción</th>':''}</tr></thead><tbody>${
      sols.map(s=>`<tr onclick="flVerSolicitud('${s.id}')"><td><strong style="font-size:13px">${s.tipo||'—'}</strong></td><td><span style="font-family:'JetBrains Mono',monospace;font-size:12px">${s.vehiculo||s.eco||'—'}</span></td><td style="font-size:13px">${s.solicitante||s.creadoPor||'—'}</td><td style="font-weight:600">${s.cotizacion||s.montoEstimado||'—'}</td><td>${flBadge(s.estatus||s.status)}</td><td style="font-size:12px;color:#7A7873">${flFecha(s.creadoEn||s.fecha||'')}</td>${pA?`<td onclick="event.stopPropagation()">${(s.estatus==='Validada'||s.estatus==='Cotización')?`<div class="fl-action-row"><button class="fl-btn-ok" onclick="flAprobarSol('${s.id}')">${ICO.check} Aprobar</button><button class="fl-btn-no" onclick="flRechazarSol('${s.id}')">${ICO.x} Rechazar</button></div>`:'<span style="color:#CBD5E1;font-size:12px">—</span>'}</td>`:''}</tr>`).join('')
    }</tbody></table></div>`;
  }

  window.flVerSolicitud = function(id) {
    const s=flSolicitudes.find(x=>x.id===id); if(!s) return;
    const pA=window.flTienePermiso?window.flTienePermiso('aprobar'):false;
    const pV=window.flTienePermiso?window.flTienePermiso('validar'):false;
    const pC=window.flTienePermiso?window.flTienePermiso('subir_cotizacion'):false;
    const pE=window.flTienePermiso?window.flTienePermiso('eliminar'):false;
    const overlay=document.createElement('div');
    overlay.className='fl-modal-overlay';
    overlay.innerHTML=`<div class="fl-modal">
      <div class="fl-modal-head"><h3>Solicitud #${id.substring(0,6).toUpperCase()}</h3><button class="fl-modal-close" onclick="this.closest('.fl-modal-overlay').remove()">✕</button></div>
      <div class="fl-modal-body">
        <div class="fl-sol-grid">
          <dl class="fl-sol-cell"><dt>Tipo</dt><dd>${s.tipo||'—'}</dd></dl>
          <dl class="fl-sol-cell"><dt>Estado</dt><dd>${flBadge(s.estatus||s.status)}</dd></dl>
          <dl class="fl-sol-cell"><dt>Vehículo</dt><dd>${s.vehiculo||s.eco||'—'}</dd></dl>
          <dl class="fl-sol-cell"><dt>Cotización</dt><dd style="font-weight:700">${s.cotizacion||s.montoEstimado||'—'}</dd></dl>
          <dl class="fl-sol-cell"><dt>Taller / Proveedor</dt><dd>${s.taller||'—'}</dd></dl>
          <dl class="fl-sol-cell"><dt>Solicitante</dt><dd>${s.solicitante||s.creadoPor||'—'}</dd></dl>
          <dl class="fl-sol-cell full"><dt>Descripción</dt><dd>${s.descripcion||'—'}</dd></dl>
        </div>
        ${s.comentarioRechazo?`<div class="fl-sep"></div><div style="background:#FEE2E2;border-radius:8px;padding:12px 14px;font-size:13px;color:#991B1B"><strong>Motivo de rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
        ${s.evidencias&&s.evidencias.length?`<div class="fl-sep"></div><div class="fl-section-title" style="margin-bottom:8px">Evidencias (${s.evidencias.length})</div><div class="fl-pills">${s.evidencias.map((e,i)=>`<button class="fl-pill" onclick="flVerImagen('${e}')">${ICO.doc} Imagen ${i+1}</button>`).join('')}</div>`:''}
        <div class="fl-sep"></div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${(pV&&s.estatus==='Solicitud')?`<button class="fl-btn-ok" onclick="flCambiarEstatus('${s.id}','Validada');this.closest('.fl-modal-overlay').remove()">${ICO.check} Validar</button>`:''}
          ${((pC||pV)&&s.estatus==='Validada')?`<button class="fl-btn-sm" onclick="flPedirCotizacion('${s.id}')">Registrar cotización</button>`:''}
          ${(pA&&(s.estatus==='Validada'||s.estatus==='Cotización'))?`<button class="fl-btn-ok" onclick="flAprobarSol('${s.id}');this.closest('.fl-modal-overlay').remove()">${ICO.check} Aprobar</button><button class="fl-btn-no" onclick="flRechazarSol('${s.id}');this.closest('.fl-modal-overlay').remove()">${ICO.x} Rechazar</button>`:''}
          ${(pV&&s.estatus==='Aprobada')?`<button class="fl-btn-sm" onclick="flCambiarEstatus('${s.id}','Cierre');this.closest('.fl-modal-overlay').remove()">Enviar a cierre</button>`:''}
          ${(pV&&s.estatus==='Cierre')?`<button class="fl-btn-sm" onclick="flCambiarEstatus('${s.id}','Cerrada');this.closest('.fl-modal-overlay').remove()">Marcar cerrada</button>`:''}
          ${pE?`<button class="fl-btn-no" onclick="flEliminarSol('${s.id}');this.closest('.fl-modal-overlay').remove()" style="margin-left:auto">Eliminar</button>`:''}
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  };

  window.flAbrirModalSolicitud = function(editId=null) {
    const s=editId?flSolicitudes.find(x=>x.id===editId):null;
    flFotosBase64=[];
    const overlay=document.createElement('div');
    overlay.className='fl-modal-overlay';
    overlay.innerHTML=`<div class="fl-modal">
      <div class="fl-modal-head"><h3>${s?'Editar solicitud':'Nueva solicitud'}</h3><button class="fl-modal-close" onclick="this.closest('.fl-modal-overlay').remove()">✕</button></div>
      <div class="fl-modal-body">
        <div class="fl-form" id="fl-form-nueva">
          <div class="fl-field"><label>Tipo de solicitud *</label><select name="tipo" required><option value="">Seleccionar…</option>${['Mantenimiento preventivo','Mantenimiento correctivo','Reposición de llanta','Seguro — Reporte de accidente','Revisión de documentos','Otro'].map(o=>`<option ${s?.tipo===o?'selected':''}>${o}</option>`).join('')}</select></div>
          <div class="fl-field"><label>Unidad *</label><select name="vehiculoId" required><option value="">Seleccionar vehículo…</option>${flVehiculos.map(v=>`<option value="${v.id}" ${s?.vehiculoId===v.id?'selected':''}>${v.eco} — ${v.marca} ${v.modelo} (${v.placas})</option>`).join('')}</select></div>
          <div class="fl-form-row">
            <div class="fl-field"><label>Taller / Proveedor</label><input name="taller" value="${s?.taller||''}" placeholder="Nombre del taller…"></div>
            <div class="fl-field"><label>Cotización estimada</label><input name="cotizacion" value="${s?.cotizacion||''}" placeholder="$0.00"></div>
          </div>
          <div class="fl-field"><label>Descripción *</label><textarea name="descripcion" placeholder="Explica la falla o necesidad…" required>${s?.descripcion||''}</textarea></div>
          ${!s?`<div class="fl-field"><label>Evidencias (fotos)</label><div class="fl-upload-area" onclick="document.getElementById('fl-input-fotos').click()">${ICO.upload} Seleccionar imágenes</div><input type="file" id="fl-input-fotos" accept="image/*" multiple style="display:none" onchange="flPrevFotos(this)"><div id="fl-fotos-preview" class="fl-pills"></div><div class="fl-field-note">Máx. ~1MB por imagen. Se guardan como base64 en Firestore.</div></div>`:''}
          <div class="fl-form-actions">
            <button type="button" class="fl-btn-ghost" onclick="this.closest('.fl-modal-overlay').remove()">Cancelar</button>
            <button type="button" class="fl-btn-primary" id="fl-btn-guardar" onclick="flGuardarSolicitud('${editId||''}')">${s?'Guardar cambios':'Enviar solicitud'}</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
  };

  window.flPrevFotos = function(input) {
    flFotosBase64=[];
    const prev=document.getElementById('fl-fotos-preview'); if(!prev) return;
    prev.innerHTML='';
    Array.from(input.files).forEach(f=>{
      const r=new FileReader();
      r.onload=e=>{flFotosBase64.push(e.target.result);const p=document.createElement('span');p.className='fl-pill';p.textContent=f.name.substring(0,20);prev.appendChild(p);};
      r.readAsDataURL(f);
    });
  };

  window.flGuardarSolicitud = async function(editId) {
    const form=document.getElementById('fl-form-nueva'); if(!form) return;
    const get=n=>form.querySelector(`[name="${n}"]`)?.value?.trim()||'';
    const tipo=get('tipo'),vid=get('vehiculoId'),desc=get('descripcion');
    if(!tipo||!vid||!desc){alert('Completa tipo, vehículo y descripción.');return;}
    const veh=flVehiculos.find(v=>v.id===vid);
    const btn=document.getElementById('fl-btn-guardar');
    if(btn){btn.disabled=true;btn.textContent='Guardando…';}
    const data={tipo,vehiculoId:vid,vehiculo:veh?`${veh.eco} — ${veh.modelo}`:vid,taller:get('taller'),cotizacion:get('cotizacion'),descripcion:desc,solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Usuario',creadoPor:window.auth?.currentUser?.email||'',actualizadoEn:new Date().toISOString()};
    try {
      if(editId){await fs.updateDoc(fs.doc(db,COL_SOLS,editId),data);}
      else{data.estatus='Solicitud';data.creadoEn=new Date().toISOString();const ref=await fs.addDoc(fs.collection(db,COL_SOLS),data);if(flFotosBase64.length)await fs.updateDoc(fs.doc(db,COL_SOLS,ref.id),{evidencias:flFotosBase64});}
      document.querySelector('.fl-modal-overlay')?.remove();
      await flCargarSolicitudes();
      flRefrescarVista();
    } catch(e){console.error('[FLOTILLA]',e);alert('Error al guardar. Revisa la consola.');if(btn){btn.disabled=false;btn.textContent='Enviar solicitud';}}
  };

  window.flCambiarEstatus = async function(id,nuevoEstatus) {
    try{await fs.updateDoc(fs.doc(db,COL_SOLS,id),{estatus:nuevoEstatus,actualizadoEn:new Date().toISOString()});await flCargarSolicitudes();flRefrescarVista();}
    catch(e){console.error('[FLOTILLA]',e);}
  };

  window.flAprobarSol  = id => flCambiarEstatus(id,'Aprobada');

  window.flRechazarSol = async function(id) {
    const m=prompt('Motivo del rechazo:'); if(m===null) return;
    try{await fs.updateDoc(fs.doc(db,COL_SOLS,id),{estatus:'Rechazada',comentarioRechazo:m,actualizadoEn:new Date().toISOString()});await flCargarSolicitudes();flRefrescarVista();}
    catch(e){console.error('[FLOTILLA]',e);}
  };

  window.flEliminarSol = async function(id) {
    if(!confirm('¿Eliminar esta solicitud? No se puede deshacer.')) return;
    try{await fs.deleteDoc(fs.doc(db,COL_SOLS,id));await flCargarSolicitudes();flRefrescarVista();}
    catch(e){console.error('[FLOTILLA]',e);}
  };

  window.flPedirCotizacion = function(id) {
    const s=flSolicitudes.find(x=>x.id===id);
    const m=prompt('Monto de cotización:',s?.cotizacion||''); if(m===null) return;
    const t=prompt('Taller / Proveedor:',s?.taller||'');      if(t===null) return;
    fs.updateDoc(fs.doc(db,COL_SOLS,id),{cotizacion:m,taller:t,estatus:'Cotización',actualizadoEn:new Date().toISOString()})
      .then(async()=>{await flCargarSolicitudes();document.querySelector('.fl-modal-overlay')?.remove();flRefrescarVista();});
  };

  window.flVerImagen = function(src) {
    const ov=document.createElement('div');ov.className='fl-modal-overlay';ov.style.cursor='zoom-out';
    ov.innerHTML=`<img src="${src}" style="max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.4)">`;
    ov.onclick=()=>ov.remove();document.body.appendChild(ov);
  };

  function flRefrescarVista() {
    if(flVistaActual==='home')         flRenderHome();
    else if(flVistaActual==='detalle') flRenderDetalle();
    else                               flVerSolicitudesGlobal();
  }

  console.log('[FLOTILLA v4] Módulo cargado');
})();
