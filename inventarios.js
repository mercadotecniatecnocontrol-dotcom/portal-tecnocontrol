/* ============================================================================
 * inventarios.js · Departamento de Inventarios — Fase 3 (consulta)
 * ----------------------------------------------------------------------------
 * Mismo contrato que almacen.js / compras.js / cobranza.js: vive dentro de
 * index.html, que ya resuelve sesión y permisos de menú.
 * Expone: window.abrirInventarios(idContenedor)  ← contrato con verArea('Inventarios')
 *
 * Datos: Supabase (window.tcSupabase), tablas inv_* que llena el sincronizador
 * de Aspel en TECNOSERVER cada 5 minutos. Esta pantalla SOLO LEE.
 * Las funciones SQL (inv_resumen, inv_buscar, inv_producto…) revisan los
 * permisos por almacén de la tabla inv_permisos.
 *
 * Regla del diseño: el total por almacén lo da Aspel. El portal agregará
 * ubicaciones, conteos y ajustes en las siguientes fases.
 * ============================================================================*/
(function () {
  'use strict';

  var NAVY = '#1D2E73', RED = '#E7402B';
  var contId = 'vista-inventarios-area';
  var estado = {
    alms: [],               // tarjetas de almacenes (inv_resumen_almacenes)
    almResumen: '',         // filtro del Resumen
    prod: { texto: '', filtro: 'todos', alm: '', ubic: null, pagina: 0, tam: 25 },
    almSel: null,           // almacén abierto en la pestaña Almacenes
    buscaAlm: ''
  };
  var tabsCtl = null;

  var TIPOS = {
    fisico:         { t: 'Bodegas físicas', d: 'Lugares con anaqueles y racks. Tienen mapa.', c: NAVY },
    tecnico:        { t: 'Técnicos', d: 'Material a cargo de cada técnico.', c: '#0f766e' },
    proyecto:       { t: 'Proyectos u obras', d: 'Material asignado a un proyecto.', c: '#7c3aed' },
    cliente:        { t: 'Clientes', d: 'Material en sitio del cliente.', c: '#0891b2' },
    control:        { t: 'Control', d: 'Garantías, mantenimiento y otros controles.', c: '#64748b' },
    sin_clasificar: { t: 'Sin clasificar', d: 'Falta decir qué tipo de almacén es.', c: '#b45309' }
  };
  var ORDEN_TIPOS = ['tecnico', 'proyecto', 'cliente', 'control', 'sin_clasificar'];

  var ICO = {
    box: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    empty: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    money: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    up: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
    sync: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
    map: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
    list: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    home: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
  };

  // ---------------------------------------------------------------- estilos
  if (!document.getElementById('inv-estilos')) {
    var st = document.createElement('style');
    st.id = 'inv-estilos';
    st.textContent = [
      '.inv-wrap{font-family:inherit;color:#0f172a}',
      '.inv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
      '.inv-head h2{margin:0;font-size:20px;font-weight:800;color:' + NAVY + ';display:flex;align-items:center;gap:8px}',
      '.inv-head p{margin:4px 0 0;font-size:13px;color:#64748b;max-width:640px}',
      '.inv-sync{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;background:#ecfdf5;color:#047857}',
      '.inv-sync.tarde{background:#fff7ed;color:#c2410c}',
      '.inv-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 12px}',
      '.inv-in,.inv-sel{padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;color:#0f172a;min-height:40px}',
      '.inv-in:focus,.inv-sel:focus{outline:none;border-color:' + NAVY + '}',
      '.inv-search{position:relative;flex:1 1 260px}',
      '.inv-search .inv-in{width:100%;padding-left:34px;box-sizing:border-box}',
      '.inv-search svg{position:absolute;left:11px;top:50%;transform:translateY(-50%);color:#94a3b8}',
      '.inv-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:16px}',
      '.inv-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;cursor:pointer;text-align:left;font-family:inherit;transition:box-shadow .15s,border-color .15s}',
      '.inv-kpi:hover{border-color:' + NAVY + ';box-shadow:0 4px 14px rgba(29,46,115,.1)}',
      '.inv-kpi .k-i{display:inline-flex;width:30px;height:30px;border-radius:9px;align-items:center;justify-content:center;margin-bottom:8px}',
      '.inv-kpi .k-v{font-size:22px;font-weight:800;line-height:1.1}',
      '.inv-kpi .k-l{font-size:12px;color:#475569;font-weight:700;margin-top:3px}',
      '.inv-kpi .k-h{font-size:11px;color:#94a3b8;margin-top:2px}',
      '.inv-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '@media (max-width:860px){.inv-grid2{grid-template-columns:1fr}}',
      '.inv-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px}',
      '.inv-card h3{margin:0 0 4px;font-size:14px;font-weight:800;color:#0f172a}',
      '.inv-card .sub{font-size:12px;color:#64748b;margin:0 0 10px}',
      '.inv-li{display:flex;justify-content:space-between;gap:10px;padding:8px 6px;border-bottom:1px solid #f1f5f9;font-size:13px;cursor:pointer;border-radius:8px}',
      '.inv-li:hover{background:#f8fafc}',
      '.inv-li .n{font-weight:700;color:#0f172a}.inv-li .c{font-size:11px;color:#94a3b8}',
      '.inv-li .v{font-weight:800;white-space:nowrap}',
      '.inv-tbl-wrap{overflow-x:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px}',
      '.inv-tbl{width:100%;border-collapse:collapse;font-size:13px}',
      '.inv-tbl th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;white-space:nowrap}',
      '.inv-tbl td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}',
      '.inv-tbl tr.clic{cursor:pointer}.inv-tbl tr.clic:hover td{background:#f8fafc}',
      '.inv-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.inv-neg{color:' + RED + ';font-weight:800}',
      '.inv-pag{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;font-size:12px;color:#64748b;flex-wrap:wrap}',
      '.inv-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:10px;border:1.5px solid ' + NAVY + ';background:#fff;color:' + NAVY + ';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;min-height:38px}',
      '.inv-btn:disabled{opacity:.4;cursor:default}',
      '.inv-btn.pri{background:' + NAVY + ';color:#fff}',
      '.inv-sec{margin:18px 0 8px;font-size:13px;font-weight:800;color:#334155;display:flex;align-items:center;gap:8px}',
      '.inv-sec small{font-weight:600;color:#94a3b8}',
      '.inv-almgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}',
      '.inv-alm{background:#fff;border:1px solid #e2e8f0;border-left:4px solid #94a3b8;border-radius:12px;padding:12px;cursor:pointer;text-align:left;font-family:inherit;transition:box-shadow .15s}',
      '.inv-alm:hover{box-shadow:0 4px 14px rgba(15,23,42,.08)}',
      '.inv-alm .a-n{font-size:13px;font-weight:800;color:#0f172a}',
      '.inv-alm .a-e{font-size:11px;color:#64748b;margin-top:2px;min-height:14px}',
      '.inv-alm .a-s{display:flex;gap:12px;margin-top:8px;font-size:12px;color:#334155}',
      '.inv-alm .a-s b{font-size:14px}',
      '.inv-mapa{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;background:#f1f5f9;border-radius:14px;padding:12px}',
      '.inv-ub{border-radius:10px;padding:10px;cursor:pointer;border:1.5px solid transparent;text-align:left;font-family:inherit;background:#fef9c3;color:#713f12}',
      '.inv-ub:hover{border-color:' + NAVY + '}',
      '.inv-ub.vacio{background:#e2e8f0;color:#475569}',
      '.inv-ub .u-c{font-size:12px;font-weight:800;word-break:break-all}',
      '.inv-ub .u-d{font-size:11px;margin-top:4px}',
      '.inv-leyenda{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:#475569;margin:8px 0 0}',
      '.inv-leyenda span{display:inline-flex;align-items:center;gap:5px}',
      '.inv-leyenda i{width:12px;height:12px;border-radius:3px;display:inline-block}',
      '.inv-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:4000;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto}',
      '.inv-modal-box{background:#fff;border-radius:16px;max-width:980px;width:100%;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}',
      '.inv-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px}',
      '.inv-x{border:none;background:#f1f5f9;border-radius:10px;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#334155;flex:0 0 auto}',
      '.inv-chip{display:inline-block;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:#eef2ff;color:' + NAVY + ';margin:2px 4px 2px 0}',
      '.inv-nota{font-size:12px;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:10px 12px;margin:10px 0}',
      '.inv-err{color:' + RED + ';font-size:13px;padding:12px}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- utilidades
  function sb() { return window.tcSupabase || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n, dec) { n = Number(n) || 0; return n.toLocaleString('es-MX', { maximumFractionDigits: dec == null ? 2 : dec }); }
  function money(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fecha(s, conHora) {
    if (!s) return '—';
    var d = new Date(s); if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) + (conHora ? ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '');
  }
  function haceCuanto(s) {
    if (!s) return 'sin datos';
    var min = Math.round((Date.now() - new Date(s).getTime()) / 60000);
    if (min < 1) return 'hace menos de un minuto';
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.round(min / 60); if (h < 48) return 'hace ' + h + ' h';
    return 'hace ' + Math.round(h / 24) + ' días';
  }
  function el(id) { return document.getElementById(id); }
  function cargando(box, tipo) {
    if (!box) return;
    if (window.UI && window.UI.skeleton) window.UI.skeleton(box, tipo === 'cards' ? { type: 'cards', count: 6 } : {});
    else box.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px">Cargando…</div>';
  }
  function vacio(box, titulo, pista, kind) {
    if (!box) return;
    if (window.UI && window.UI.empty) window.UI.empty(box, { title: titulo, hint: pista || '', kind: kind || 'empty' });
    else box.innerHTML = '<div style="padding:20px;text-align:center;color:#64748b;font-size:13px"><b>' + esc(titulo) + '</b><br>' + esc(pista || '') + '</div>';
  }
  function badge(txt, tono) { return window.UI && window.UI.badge ? window.UI.badge(txt, tono) : '<span class="inv-chip">' + esc(txt) + '</span>'; }
  function tip(node, texto) { if (node && window.UI && window.UI.tip) window.UI.tip(node, texto); else if (node) node.title = texto; }
  async function rpc(nombre, params) {
    var c = sb(); if (!c) throw new Error('No hay conexión con la base de datos (Supabase no cargó). Recarga la página.');
    var r = await c.rpc(nombre, params || {});
    if (r.error) throw new Error(r.error.message || String(r.error));
    return r.data;
  }
  function errorEn(box, e) {
    console.error('[inventarios]', e);
    if (box) box.innerHTML = '<div class="inv-err">No se pudo cargar la información: ' + esc(e && e.message || e) + '</div>';
  }
  function esAdmin() {
    try { var u = window.auth && window.auth.currentUser; return !!(u && window.esAdminTotal && window.esAdminTotal(u.email)); } catch (e) { return false; }
  }
  function nombreAlm(cve) {
    var a = estado.alms.find(function (x) { return String(x.cve_alm) === String(cve); });
    return a ? a.nombre : ('Almacén ' + cve);
  }
  function opcionesAlm(sel, textoTodos) {
    var h = '<option value="">' + esc(textoTodos || 'Todos los almacenes') + '</option>';
    var grupos = ['fisico'].concat(ORDEN_TIPOS);
    grupos.forEach(function (t) {
      var lista = estado.alms.filter(function (a) { return (a.tipo || 'sin_clasificar') === t; });
      if (!lista.length) return;
      h += '<optgroup label="' + esc(TIPOS[t] ? TIPOS[t].t : t) + '">' + lista.map(function (a) {
        return '<option value="' + a.cve_alm + '"' + (String(sel) === String(a.cve_alm) ? ' selected' : '') + '>' + esc(a.nombre) + '</option>';
      }).join('') + '</optgroup>';
    });
    return h;
  }

  // ---------------------------------------------------------------- entrada
  async function abrirInventarios(id) {
    contId = id || contId;
    var box = el(contId); if (!box) return;
    box.innerHTML =
      '<div class="inv-wrap">' +
        '<div class="inv-head"><div>' +
          '<h2>' + ICO.box + ' Inventarios</h2>' +
          '<p>Aquí ves cuánto material hay en cada almacén según Aspel, dónde está y qué se mueve. ' +
          'Los datos se actualizan solos cada 5 minutos.</p>' +
        '</div><div id="inv-sync"></div></div>' +
        '<div id="inv-tabs"></div>' +
      '</div>';
    try {
      estado.alms = (await rpc('inv_resumen_almacenes')) || [];
    } catch (e) { errorEn(el('inv-tabs'), e); return; }

    if (!estado.alms.length) {
      vacio(el('inv-tabs'), 'Todavía no tienes almacenes asignados',
        'Pide a Administración que te dé acceso en Inventarios a los almacenes que manejas.');
      return;
    }

    var tabs = [
      { id: 'resumen', label: 'Resumen', tip: 'Números generales del inventario', render: pintarResumen },
      { id: 'almacenes', label: 'Almacenes', count: estado.alms.length, tip: 'Mapa de bodegas y almacenes de técnicos, proyectos y clientes', render: pintarAlmacenes },
      { id: 'productos', label: 'Productos', tip: 'Buscar cualquier producto y ver en qué almacén está', render: pintarProductos }
    ];
    var tb = el('inv-tabs');
    if (window.UI && window.UI.tabs) {
      tabsCtl = window.UI.tabs(tb, tabs, { active: 'resumen', rerender: true });
    } else {
      tb.innerHTML = '<div class="inv-row">' + tabs.map(function (t) { return '<button class="inv-btn" data-t="' + t.id + '">' + t.label + '</button>'; }).join('') + '</div><div id="inv-panel"></div>';
      var sel = function (id) { var t = tabs.find(function (x) { return x.id === id; }); t.render(el('inv-panel')); };
      tb.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { sel(b.getAttribute('data-t')); }; });
      tabsCtl = { select: sel };
      sel('resumen');
    }
  }

  function irAProductos(filtro, alm, ubic) {
    estado.prod.filtro = filtro || 'todos';
    estado.prod.alm = alm == null ? '' : String(alm);
    estado.prod.ubic = ubic || null;
    estado.prod.texto = '';
    estado.prod.pagina = 0;
    if (tabsCtl) tabsCtl.select('productos');
  }

  function pintarSync(ultima) {
    var b = el('inv-sync'); if (!b) return;
    var tarde = !ultima || (Date.now() - new Date(ultima).getTime()) > 20 * 60000;
    b.innerHTML = '<span class="inv-sync' + (tarde ? ' tarde' : '') + '">' + ICO.sync + ' Aspel: actualizado ' + esc(haceCuanto(ultima)) + '</span>';
    tip(b.firstChild, tarde
      ? 'Hace más de 20 minutos que no llegan datos de Aspel. Revisa que el guardián esté corriendo en TECNOSERVER.'
      : 'Última vez que llegaron datos de Aspel: ' + fecha(ultima, true));
  }

  // ---------------------------------------------------------------- Resumen
  async function pintarResumen(panel) {
    panel.innerHTML =
      '<div class="inv-row"><select id="inv-r-alm" class="inv-sel" aria-label="Almacén">' + opcionesAlm(estado.almResumen) + '</select>' +
      '<span style="font-size:12px;color:#64748b">Elige un almacén para ver solo sus números.</span></div>' +
      '<div id="inv-r-kpis" class="inv-kpis"></div>' +
      '<div class="inv-grid2"><div class="inv-card"><h3>Lo que más sale</h3><p class="sub">Productos con más salidas por remisión o factura en los últimos 90 días.</p><div id="inv-r-alta"></div></div>' +
      '<div class="inv-card"><h3>Lo que no se mueve</h3><p class="sub">Productos con existencia y con menos salidas en los últimos 90 días.</p><div id="inv-r-baja"></div></div></div>';
    el('inv-r-alm').onchange = function () { estado.almResumen = this.value; cargarResumen(); };
    cargarResumen();
  }

  async function cargarResumen() {
    var alm = estado.almResumen ? Number(estado.almResumen) : null;
    var k = el('inv-r-kpis'); cargando(k, 'cards');
    cargando(el('inv-r-alta')); cargando(el('inv-r-baja'));
    try {
      var r = await rpc('inv_resumen', { p_cve_alm: alm });
      pintarSync(r.ultima_sync);
      var tarjetas = [
        { v: num(r.productos, 0), l: 'Productos en catálogo', h: 'Solo productos físicos, sin servicios', i: ICO.box, c: NAVY, f: 'todos' },
        { v: num(r.con_existencia, 0), l: 'Con existencia', h: 'Hay al menos 1 pieza', i: ICO.check, c: '#047857', f: 'con' },
        { v: num(r.sin_existencia, 0), l: 'Sin existencia', h: 'En cero', i: ICO.empty, c: '#64748b', f: 'sin' },
        { v: num(r.criticos, 0), l: 'Bajo el mínimo', h: 'Menos que el stock mínimo de Aspel', i: ICO.alert, c: RED, f: 'criticos' },
        { v: num(r.sin_movimiento_90, 0), l: 'Sin movimiento', h: 'Con existencia y nada en 90 días', i: ICO.clock, c: '#b45309', f: 'sin_mov' },
        { v: money(r.valor), l: 'Valor del inventario', h: 'Existencia × costo promedio', i: ICO.money, c: NAVY, f: 'con' },
        { v: num(r.entradas_30), l: 'Entradas (30 días)', h: 'Piezas que entraron', i: ICO.down, c: '#047857', f: null },
        { v: num(r.salidas_30), l: 'Salidas (30 días)', h: 'Piezas que salieron', i: ICO.up, c: '#0891b2', f: null }
      ];
      if (Number(r.negativos) > 0) tarjetas.splice(3, 0, { v: num(r.negativos, 0), l: 'Existencia negativa', h: 'Aspel dice menos de cero: revisar', i: ICO.minus, c: RED, f: 'negativos' });
      k.removeAttribute('data-ui-state');
      k.innerHTML = tarjetas.map(function (t, i) {
        return '<button type="button" class="inv-kpi" data-i="' + i + '"><span class="k-i" style="background:' + t.c + '1a;color:' + t.c + '">' + t.i + '</span>' +
          '<div class="k-v" style="color:' + t.c + '">' + t.v + '</div><div class="k-l">' + esc(t.l) + '</div><div class="k-h">' + esc(t.h) + '</div></button>';
      }).join('');
      k.querySelectorAll('.inv-kpi').forEach(function (b) {
        var t = tarjetas[Number(b.getAttribute('data-i'))];
        tip(b, t.f ? 'Ver la lista de productos' : t.h);
        b.onclick = function () { if (t.f) irAProductos(t.f, estado.almResumen); };
      });
    } catch (e) { errorEn(k, e); }
    listaRotacion('inv-r-alta', 'alta', alm);
    listaRotacion('inv-r-baja', 'baja', alm);
  }

  async function listaRotacion(id, orden, alm) {
    var b = el(id);
    try {
      var filas = await rpc('inv_rotacion', { p_dias: 90, p_cve_alm: alm, p_orden: orden, p_limite: 10 });
      if (!filas || !filas.length) { vacio(b, 'Sin datos en este periodo', 'No hubo movimientos que mostrar.'); return; }
      b.removeAttribute('data-ui-state');
      b.innerHTML = filas.map(function (f) {
        return '<div class="inv-li" data-art="' + esc(f.cve_art) + '"><div><div class="n">' + esc(f.descr) + '</div><div class="c">' + esc(f.cve_art) +
          ' · existencia ' + num(f.existencia) + '</div></div><div class="v">' + num(f.salidas) + ' <span class="c">salidas</span></div></div>';
      }).join('');
      b.querySelectorAll('[data-art]').forEach(function (n) { n.onclick = function () { abrirFicha(n.getAttribute('data-art')); }; });
    } catch (e) { errorEn(b, e); }
  }

  // ---------------------------------------------------------------- Almacenes
  function pintarAlmacenes(panel) {
    if (estado.almSel != null) { pintarAlmacen(panel, estado.almSel); return; }
    var fis = estado.alms.filter(function (a) { return a.tipo === 'fisico'; });
    panel.innerHTML =
      '<div class="inv-sec">' + ICO.map + ' Bodegas físicas <small>Tienen mapa de ubicaciones</small></div>' +
      '<div class="inv-almgrid" id="inv-a-fis"></div>' +
      '<div class="inv-sec">' + ICO.list + ' Otros almacenes <small>Técnicos, proyectos, clientes y control</small></div>' +
      '<div class="inv-row"><div class="inv-search">' + ICO.search + '<input id="inv-a-busca" class="inv-in" placeholder="Buscar almacén, técnico o encargado" value="' + esc(estado.buscaAlm) + '"></div></div>' +
      '<div id="inv-a-otros"></div>';
    el('inv-a-fis').innerHTML = fis.length ? fis.map(tarjetaAlm).join('') : '';
    if (!fis.length) vacio(el('inv-a-fis'), 'No hay bodegas físicas', 'Marca un almacén como "Bodega física" para ver su mapa.');
    var inp = el('inv-a-busca');
    inp.oninput = function () { estado.buscaAlm = this.value; pintarOtros(); };
    pintarOtros();
    bindTarjetas(panel);
  }

  function pintarOtros() {
    var b = el('inv-a-otros'); if (!b) return;
    var q = (estado.buscaAlm || '').trim().toLowerCase();
    var h = '';
    ORDEN_TIPOS.forEach(function (t) {
      var lista = estado.alms.filter(function (a) {
        return (a.tipo || 'sin_clasificar') === t &&
          (!q || (a.nombre + ' ' + (a.encargado || '')).toLowerCase().indexOf(q) >= 0);
      });
      if (!lista.length) return;
      h += '<div style="margin:12px 0 6px;font-size:12px;font-weight:800;color:' + TIPOS[t].c + '">' + esc(TIPOS[t].t) +
        ' <span style="color:#94a3b8;font-weight:600">· ' + lista.length + ' · ' + esc(TIPOS[t].d) + '</span></div>' +
        '<div class="inv-almgrid">' + lista.map(tarjetaAlm).join('') + '</div>';
    });
    if (!h) { vacio(b, 'No se encontró ningún almacén', 'Prueba con otra palabra.', 'search'); return; }
    b.removeAttribute('data-ui-state');
    b.innerHTML = h;
    bindTarjetas(b);
  }

  function tarjetaAlm(a) {
    var t = TIPOS[a.tipo] || TIPOS.sin_clasificar;
    return '<button type="button" class="inv-alm" data-alm="' + a.cve_alm + '" style="border-left-color:' + t.c + '">' +
      '<div class="a-n">' + esc(a.nombre) + ' <span style="color:#94a3b8;font-weight:600">#' + a.cve_alm + '</span></div>' +
      '<div class="a-e">' + esc(a.encargado || 'Sin encargado en Aspel') + '</div>' +
      '<div class="a-s"><span><b>' + num(a.productos, 0) + '</b> productos</span><span><b>' + num(a.unidades, 0) + '</b> piezas</span></div>' +
      '<div class="a-s" style="margin-top:4px"><span>' + money(a.valor) + '</span>' +
      (Number(a.criticos) > 0 ? '<span style="color:' + RED + ';font-weight:700">' + num(a.criticos, 0) + ' bajo mínimo</span>' : '') + '</div>' +
      '</button>';
  }

  function bindTarjetas(scope) {
    scope.querySelectorAll('.inv-alm[data-alm]').forEach(function (b) {
      tip(b, 'Abrir este almacén');
      b.onclick = function () {
        estado.almSel = Number(b.getAttribute('data-alm'));
        var p = b.closest('[role="tabpanel"]') || el('inv-panel') || b.closest('.inv-wrap');
        pintarAlmacen(p, estado.almSel);
      };
    });
  }

  async function pintarAlmacen(panel, cve) {
    var a = estado.alms.find(function (x) { return x.cve_alm === cve; });
    if (!a) { estado.almSel = null; pintarAlmacenes(panel); return; }
    var t = TIPOS[a.tipo] || TIPOS.sin_clasificar;
    var adm = esAdmin();
    panel.innerHTML =
      '<div class="inv-row"><button class="inv-btn" id="inv-a-volver">' + ICO.back + ' Todos los almacenes</button></div>' +
      '<div class="inv-card" style="border-left:4px solid ' + t.c + ';margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
          '<div><h3 style="font-size:17px">' + esc(a.nombre) + ' <span style="color:#94a3b8">#' + a.cve_alm + '</span></h3>' +
          '<p class="sub" style="margin:0">' + esc(t.t) + ' · Encargado en Aspel: ' + esc(a.encargado || 'sin dato') +
          ' · Último movimiento: ' + esc(fecha(a.ultimo_mov)) + '</p></div>' +
          (adm ? '<label style="font-size:12px;color:#475569;display:flex;flex-direction:column;gap:4px">Tipo de almacén' +
            '<select id="inv-a-tipo" class="inv-sel">' + Object.keys(TIPOS).map(function (k) {
              return '<option value="' + k + '"' + ((a.tipo || 'sin_clasificar') === k ? ' selected' : '') + '>' + esc(TIPOS[k].t) + '</option>';
            }).join('') + '</select></label>' : '') +
        '</div>' +
        '<div class="inv-kpis" style="margin:12px 0 0">' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v">' + num(a.productos, 0) + '</div><div class="k-l">Productos con existencia</div></div>' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v">' + num(a.unidades, 0) + '</div><div class="k-l">Piezas</div></div>' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v">' + money(a.valor) + '</div><div class="k-l">Valor</div></div>' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v" style="color:' + (a.criticos > 0 ? RED : '#0f172a') + '">' + num(a.criticos, 0) + '</div><div class="k-l">Bajo el mínimo</div></div>' +
        '</div>' +
      '</div>' +
      (a.tipo === 'fisico' ? '<div class="inv-sec">' + ICO.map + ' Mapa de ubicaciones <small>Según el campo de ubicación de Aspel</small></div><div id="inv-a-mapa"></div>' : '') +
      '<div class="inv-sec">' + ICO.list + ' Productos en este almacén</div>' +
      '<div class="inv-row"><button class="inv-btn pri" id="inv-a-verprod">Ver todos los productos de ' + esc(a.nombre) + '</button></div>';
    el('inv-a-volver').onclick = function () { estado.almSel = null; pintarAlmacenes(panel); };
    el('inv-a-verprod').onclick = function () { irAProductos('con', a.cve_alm); };
    var selTipo = el('inv-a-tipo');
    if (selTipo) {
      tip(selTipo, 'Solo administradores. Cambia en qué grupo aparece este almacén.');
      selTipo.onchange = async function () {
        var nuevo = this.value;
        try {
          var r = await sb().from('inv_almacenes').update({ tipo: nuevo, actualizado: new Date().toISOString() })
            .eq('empresa', 1).eq('cve_alm', a.cve_alm).select('cve_alm');
          if (r.error) throw r.error;
          if (!r.data || !r.data.length) throw new Error('No tienes permiso para cambiar el tipo de este almacén.');
          a.tipo = nuevo;
          pintarAlmacen(panel, cve);
        } catch (e) { alert('No se pudo guardar: ' + (e.message || e)); this.value = a.tipo || 'sin_clasificar'; }
      };
    }
    if (a.tipo === 'fisico') pintarMapa(el('inv-a-mapa'), a);
  }

  async function pintarMapa(box, a) {
    cargando(box, 'cards');
    try {
      var ubs = (await rpc('inv_ubicaciones_aspel', { p_cve_alm: a.cve_alm })) || [];
      if (!ubs.length) { vacio(box, 'Este almacén no tiene productos con existencia', ''); return; }
      ubs.sort(function (x, y) {
        var sx = x.ubicacion === 'SIN UBICACIÓN', sy = y.ubicacion === 'SIN UBICACIÓN';
        if (sx !== sy) return sx ? 1 : -1;
        return x.ubicacion.localeCompare(y.ubicacion, 'es', { numeric: true });
      });
      box.removeAttribute('data-ui-state');
      box.innerHTML = '<div class="inv-mapa">' + ubs.map(function (u) {
        var sin = u.ubicacion === 'SIN UBICACIÓN';
        return '<button type="button" class="inv-ub' + (sin ? ' vacio' : '') + '" data-ub="' + esc(u.ubicacion) + '">' +
          '<div class="u-c">' + esc(u.ubicacion) + '</div><div class="u-d">' + num(u.productos, 0) + ' productos · ' + num(u.unidades, 0) + ' pzas</div></button>';
      }).join('') + '</div>' +
      '<div class="inv-leyenda"><span><i style="background:#fef9c3"></i> Con productos, falta contar</span>' +
      '<span><i style="background:#e2e8f0"></i> Sin ubicación asignada en Aspel</span>' +
      '<span><i style="background:#bbf7d0"></i> Contado y correcto (próxima fase)</span>' +
      '<span><i style="background:#fecaca"></i> Con diferencias (próxima fase)</span>' +
      '<span><i style="background:#bfdbfe"></i> Conteo en proceso (próxima fase)</span></div>' +
      '<div class="inv-nota">Este mapa usa las ubicaciones que ya existen en Aspel. En la siguiente fase podrás dibujar racks y pasillos reales y asignar cada producto a su lugar.</div>';
      box.querySelectorAll('[data-ub]').forEach(function (b) {
        tip(b, 'Ver los productos de esta ubicación');
        b.onclick = function () { irAProductos('todos', a.cve_alm, b.getAttribute('data-ub')); };
      });
    } catch (e) { errorEn(box, e); }
  }

  // ---------------------------------------------------------------- Productos
  var _tBusca = null;
  function pintarProductos(panel) {
    var p = estado.prod;
    panel.innerHTML =
      '<div class="inv-row">' +
        '<div class="inv-search">' + ICO.search + '<input id="inv-p-txt" class="inv-in" placeholder="Buscar por clave, descripción o código de barras" value="' + esc(p.texto) + '"></div>' +
        '<select id="inv-p-alm" class="inv-sel" aria-label="Almacén">' + opcionesAlm(p.alm) + '</select>' +
        '<select id="inv-p-fil" class="inv-sel" aria-label="Filtro">' +
          [['todos', 'Todos'], ['con', 'Con existencia'], ['sin', 'Sin existencia'], ['criticos', 'Bajo el mínimo'], ['sin_mov', 'Sin movimiento (90 días)'], ['negativos', 'Existencia negativa']]
            .map(function (o) { return '<option value="' + o[0] + '"' + (p.filtro === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
        '</select>' +
      '</div>' +
      (p.ubic ? '<div class="inv-row"><span class="inv-chip">Ubicación: ' + esc(p.ubic) + '</span><button class="inv-btn" id="inv-p-quitaub">Quitar ubicación</button></div>' : '') +
      '<div class="inv-tbl-wrap" data-ui-nopage><table class="inv-tbl"><thead><tr><th>Clave</th><th>Descripción</th><th>Línea</th><th class="inv-num">Existencia</th><th class="inv-num">Valor</th><th>Última venta</th></tr></thead><tbody id="inv-p-body"></tbody></table>' +
      '<div class="inv-pag" id="inv-p-pag"></div></div>';
    el('inv-p-txt').oninput = function () {
      var v = this.value; clearTimeout(_tBusca);
      _tBusca = setTimeout(function () { p.texto = v; p.pagina = 0; cargarProductos(); }, 350);
    };
    el('inv-p-alm').onchange = function () { p.alm = this.value; p.ubic = null; p.pagina = 0; pintarProductos(panel); };
    el('inv-p-fil').onchange = function () { p.filtro = this.value; p.pagina = 0; cargarProductos(); };
    var qu = el('inv-p-quitaub'); if (qu) qu.onclick = function () { p.ubic = null; p.pagina = 0; pintarProductos(panel); };
    cargarProductos();
  }

  async function cargarProductos() {
    var p = estado.prod, body = el('inv-p-body'), pag = el('inv-p-pag');
    if (!body) return;
    cargando(body);
    try {
      var filas = (await rpc('inv_buscar', {
        p_texto: p.texto || null, p_cve_alm: p.alm ? Number(p.alm) : null, p_filtro: p.filtro,
        p_ubicacion: p.ubic, p_limite: p.tam, p_offset: p.pagina * p.tam
      })) || [];
      var total = filas.length ? Number(filas[0].total) : 0;
      if (!filas.length) {
        vacio(body, p.texto ? 'No se encontró ningún producto' : 'No hay productos con este filtro',
          p.texto ? 'Revisa la clave o prueba con otra palabra.' : 'Cambia el filtro o el almacén.', p.texto ? 'search' : 'empty');
        pag.innerHTML = '';
        return;
      }
      body.innerHTML = filas.map(function (f) {
        var ex = Number(f.existencia);
        return '<tr class="clic" data-art="' + esc(f.cve_art) + '"><td><b>' + esc(f.cve_art) + '</b>' + (f.con_serie ? '<div class="inv-chip">Con número de serie</div>' : '') + '</td>' +
          '<td>' + esc(f.descr) + '</td><td>' + esc(f.linea || '—') + '</td>' +
          '<td class="inv-num' + (ex < 0 ? ' inv-neg' : '') + '">' + num(ex) + ' <span style="color:#94a3b8">' + esc(f.uni_med || '') + '</span></td>' +
          '<td class="inv-num">' + money(f.valor) + '</td><td>' + esc(fecha(f.fch_ultvta)) + '</td></tr>';
      }).join('');
      body.querySelectorAll('tr[data-art]').forEach(function (tr) { tr.onclick = function () { abrirFicha(tr.getAttribute('data-art')); }; });
      var desde = p.pagina * p.tam + 1, hasta = Math.min(total, (p.pagina + 1) * p.tam);
      pag.innerHTML = '<span>' + num(desde, 0) + '–' + num(hasta, 0) + ' de ' + num(total, 0) + ' productos (orden alfabético)</span>' +
        '<span style="display:flex;gap:8px"><button class="inv-btn" id="inv-p-ant"' + (p.pagina === 0 ? ' disabled' : '') + '>Anterior</button>' +
        '<button class="inv-btn" id="inv-p-sig"' + (hasta >= total ? ' disabled' : '') + '>Siguiente</button></span>';
      el('inv-p-ant').onclick = function () { if (p.pagina > 0) { p.pagina--; cargarProductos(); } };
      el('inv-p-sig').onclick = function () { if (hasta < total) { p.pagina++; cargarProductos(); } };
    } catch (e) { errorEn(body, e); pag.innerHTML = ''; }
  }

  // ---------------------------------------------------------------- Ficha
  async function abrirFicha(cve) {
    var m = document.createElement('div');
    m.className = 'inv-modal';
    m.innerHTML = '<div class="inv-modal-box" role="dialog" aria-modal="true"><div id="inv-f-cuerpo"></div></div>';
    document.body.appendChild(m);
    var cerrar = function () { m.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', function (e) { if (e.target === m) cerrar(); });
    var c = m.querySelector('#inv-f-cuerpo');
    cargando(c);
    try {
      var d = await rpc('inv_producto', { p_cve_art: cve });
      var p = d.producto || {};
      var exs = d.existencias || [], movs = d.movimientos || [];
      var total = exs.reduce(function (s, x) { return s + (Number(x.exist) || 0); }, 0);
      c.removeAttribute('data-ui-state');
      c.innerHTML =
        '<div class="inv-modal-head"><div>' +
          '<div style="font-size:12px;color:#64748b;font-weight:700">' + esc(p.cve_art || cve) + (p.linea ? ' · Línea ' + esc(p.linea) : '') + '</div>' +
          '<h3 style="margin:2px 0 6px;font-size:18px;color:' + NAVY + '">' + esc(p.descr || 'Producto') + '</h3>' +
          '<div>' + (p.con_serie ? '<span class="inv-chip">Con número de serie</span>' : '') +
            (p.status_aspel === 'B' ? badge('De baja en Aspel', 'danger') : '') +
            (d.claves_alternas || []).map(function (k) { return '<span class="inv-chip" title="Clave alterna o código de barras">' + esc(k) + '</span>'; }).join('') +
          '</div></div><button class="inv-x" id="inv-f-x" aria-label="Cerrar">' + ICO.close + '</button></div>' +
        '<div class="inv-kpis">' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v">' + num(total) + '</div><div class="k-l">Existencia total</div><div class="k-h">' + esc(p.uni_med || '') + '</div></div>' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v">' + money(p.costo_prom) + '</div><div class="k-l">Costo promedio</div></div>' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v">' + money(total * (Number(p.costo_prom) || 0)) + '</div><div class="k-l">Valor</div></div>' +
          '<div class="inv-kpi" style="cursor:default"><div class="k-v" style="font-size:15px">' + esc(fecha(p.fch_ultvta)) + '</div><div class="k-l">Última venta</div><div class="k-h">Última compra: ' + esc(fecha(p.fch_ultcom)) + '</div></div>' +
        '</div>' +
        '<div class="inv-sec">' + ICO.home + ' Existencia por almacén <small>Según Aspel</small></div>' +
        '<div class="inv-tbl-wrap" data-ui-nopage><table class="inv-tbl"><thead><tr><th>Almacén</th><th>Tipo</th><th>Ubicación</th><th class="inv-num">Existencia</th><th class="inv-num">Mín.</th><th class="inv-num">Por recibir</th><th class="inv-num">Por surtir</th></tr></thead><tbody>' +
        (exs.length ? exs.map(function (x) {
          var ex = Number(x.exist) || 0, bajo = Number(x.stock_min) > 0 && ex < Number(x.stock_min);
          return '<tr><td><b>' + esc(x.almacen) + '</b> <span style="color:#94a3b8">#' + x.cve_alm + '</span></td><td>' + esc((TIPOS[x.tipo] || TIPOS.sin_clasificar).t) + '</td>' +
            '<td>' + esc(x.ubicacion || '—') + '</td><td class="inv-num' + (ex < 0 || bajo ? ' inv-neg' : '') + '">' + num(ex) + '</td>' +
            '<td class="inv-num">' + (Number(x.stock_min) > 0 ? num(x.stock_min) : '—') + '</td><td class="inv-num">' + num(x.comp_x_rec || 0) + '</td><td class="inv-num">' + num(x.pend_surt || 0) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" style="color:#64748b">No hay existencia en ningún almacén que puedas ver.</td></tr>') +
        '</tbody></table></div>' +
        '<div class="inv-sec">' + ICO.list + ' Últimos movimientos <small>Kardex de Aspel · últimos 100</small></div>' +
        '<div class="inv-tbl-wrap" data-ui-nopage style="max-height:360px;overflow:auto"><table class="inv-tbl"><thead><tr><th>Fecha</th><th>Almacén</th><th>Concepto</th><th>Documento</th><th class="inv-num">Entrada</th><th class="inv-num">Salida</th><th class="inv-num">Queda</th></tr></thead><tbody>' +
        (movs.length ? movs.map(function (mv) {
          var ent = Number(mv.signo) === 1 ? num(mv.cant) : '', sal = Number(mv.signo) === -1 ? num(mv.cant) : '';
          return '<tr><td style="white-space:nowrap">' + esc(fecha(mv.fechaelab || mv.fecha_docu, true)) + '</td><td>' + esc(mv.almacen || '') + '</td>' +
            '<td>' + esc(mv.concepto || ('Concepto ' + mv.cve_cpto)) + '</td><td>' + esc(mv.refer || '—') + '</td>' +
            '<td class="inv-num" style="color:#047857">' + ent + '</td><td class="inv-num" style="color:#0891b2">' + sal + '</td><td class="inv-num">' + num(mv.existencia) + '</td></tr>';
        }).join('') : '<tr><td colspan="7" style="color:#64748b">Sin movimientos registrados.</td></tr>') +
        '</tbody></table></div>';
      c.querySelector('#inv-f-x').onclick = cerrar;
    } catch (e) {
      errorEn(c, e);
      var b = document.createElement('button'); b.className = 'inv-btn'; b.textContent = 'Cerrar'; b.onclick = cerrar; c.appendChild(b);
    }
  }

  window.abrirInventarios = abrirInventarios;
  window.invAbrirFicha = abrirFicha;
})();
