/* ============================================================================
 * inventarios-conteos.js · Conteos físicos por partes (lotes) — Inventarios
 * ----------------------------------------------------------------------------
 * Lo carga inventarios.js cuando se abre la pestaña "Conteos".
 * Expone: window.InvConteos.montar(panel, ctx) y window.InvConteos.salir()
 *
 * Flujo: Campaña → se divide en partes (por ubicación, línea o bloques) →
 * cada persona toma una parte y cuenta desde celular/iPad/laptop →
 * el supervisor revisa diferencias, pide reconteos y aprueba →
 * se exporta la lista de ajustes para capturar en Aspel.
 *
 * Datos: Supabase, tablas inv_conteos, inv_conteo_lotes, inv_conteo_renglones
 * (ver inventarios_conteos.sql). Todo se actualiza EN VIVO con Supabase Realtime.
 * La existencia de Aspel se congela al crear la campaña.
 * ============================================================================*/
(function () {
  'use strict';

  var NAVY = '#1D2E73', RED = '#E7402B', GREEN = '#047857', AMBER = '#b45309', BLUE = '#2563eb';
  var C = null;            // contexto que manda inventarios.js
  var panel = null;
  var canales = [];
  var st = { conteo: null, lotes: [], renglones: [], filtro: 'todos', vivo: false };
  var ui = { tablero: false, conteo: null, revision: null };   // qué está abierto
  var _tRep = null;

  var ESTADOS = {
    pendiente: { t: 'Pendiente', c: '#64748b', bg: '#f1f5f9' },
    contando:  { t: 'Contando', c: BLUE, bg: '#dbeafe' },
    revision:  { t: 'En revisión', c: AMBER, bg: '#fef3c7' },
    aprobado:  { t: 'Aprobado', c: GREEN, bg: '#dcfce7' }
  };
  var CRITERIOS = { con: 'Con existencia', criticos: 'Bajo el mínimo', sin_mov: 'Sin movimiento (90 días)', todos: 'Todo el catálogo del almacén' };

  // ---------------------------------------------------------------- estilos
  if (!document.getElementById('ic-estilos')) {
    var s = document.createElement('style');
    s.id = 'ic-estilos';
    s.textContent = [
      '.ic-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}',
      '.ic-top h3{margin:0;font-size:17px;font-weight:800;color:' + NAVY + '}',
      '.ic-top p{margin:2px 0 0;font-size:12px;color:#64748b}',
      '.ic-vivo{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;background:#f1f5f9;color:#64748b}',
      '.ic-vivo i{width:8px;height:8px;border-radius:50%;background:#94a3b8;display:inline-block}',
      '.ic-vivo.on{background:#ecfdf5;color:' + GREEN + '}.ic-vivo.on i{background:#10b981;animation:icPulso 1.4s infinite}',
      '@keyframes icPulso{0%{box-shadow:0 0 0 0 rgba(16,185,129,.6)}70%{box-shadow:0 0 0 8px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}',
      '.ic-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}',
      '.ic-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;transition:box-shadow .15s,transform .15s}',
      '.ic-card:hover{box-shadow:0 6px 18px rgba(15,23,42,.08)}',
      '.ic-card.clic{cursor:pointer}',
      '.ic-card .n{font-size:14px;font-weight:800;color:#0f172a;line-height:1.25}',
      '.ic-card .m{font-size:12px;color:#64748b}',
      '.ic-card .acc{display:flex;gap:6px;flex-wrap:wrap;margin-top:auto}',
      '.ic-est{display:inline-flex;align-items:center;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap}',
      '.ic-bar{height:8px;border-radius:99px;background:#e2e8f0;overflow:hidden;display:flex}',
      '.ic-bar>span{height:100%;transition:width .4s}',
      '.ic-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:12px}',
      '.ic-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}',
      '.ic-kpi .v{font-size:22px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}',
      '.ic-kpi .l{font-size:12px;color:#475569;font-weight:700;margin-top:3px}',
      '.ic-kpi .h{font-size:11px;color:#94a3b8;margin-top:2px}',
      '.ic-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}',
      '.ic-chip{border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700;color:#334155;cursor:pointer;font-family:inherit;min-height:34px}',
      '.ic-chip.on{background:' + NAVY + ';border-color:' + NAVY + ';color:#fff}',
      '.ic-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;border-radius:10px;border:1.5px solid ' + NAVY + ';background:#fff;color:' + NAVY + ';font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;min-height:38px}',
      '.ic-btn.pri{background:' + NAVY + ';color:#fff}',
      '.ic-btn.ok{background:' + GREEN + ';border-color:' + GREEN + ';color:#fff}',
      '.ic-btn.warn{border-color:' + AMBER + ';color:' + AMBER + '}',
      '.ic-btn.del{border-color:' + RED + ';color:' + RED + '}',
      '.ic-btn:disabled{opacity:.4;cursor:default}',
      '.ic-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:4100;display:flex;align-items:flex-start;justify-content:center;padding:20px 10px;overflow:auto}',
      '.ic-box{background:#fff;border-radius:16px;max-width:1000px;width:100%;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.25)}',
      '.ic-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '@media (max-width:640px){.ic-form{grid-template-columns:1fr}}',
      '.ic-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:700;color:#334155}',
      '.ic-in{padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:14px;font-family:inherit;background:#fff;color:#0f172a;min-height:42px;box-sizing:border-box;width:100%}',
      '.ic-in:focus{outline:none;border-color:' + NAVY + '}',
      '.ic-nota{font-size:12px;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:10px 12px;margin:10px 0}',
      '.ic-tbl-wrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px;max-height:60vh}',
      '.ic-tbl{width:100%;border-collapse:collapse;font-size:13px}',
      '.ic-tbl th{position:sticky;top:0;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.4px;color:#64748b;padding:9px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc;white-space:nowrap;z-index:1}',
      '.ic-tbl td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}',
      '.ic-num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}',
      '.ic-dot{display:inline-block;width:10px;height:10px;border-radius:50%}',
      /* ---- modo conteo (pantalla completa, pensado para celular) ---- */
      '.ic-full{position:fixed;inset:0;z-index:4200;background:#f1f5f9;display:flex;flex-direction:column;font-family:inherit;color:#0f172a}',
      '.ic-full-h{background:' + NAVY + ';color:#fff;padding:10px 12px calc(10px) 12px;padding-top:max(10px,env(safe-area-inset-top))}',
      '.ic-full-h .r1{display:flex;align-items:center;gap:10px}',
      '.ic-full-h .t{flex:1;min-width:0}',
      '.ic-full-h .t b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ic-full-h .t small{font-size:12px;opacity:.8}',
      '.ic-full-h .ic-bar{background:rgba(255,255,255,.25);margin-top:8px}',
      '.ic-ib{border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:10px;min-width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;font-weight:700;font-family:inherit;padding:0 10px}',
      '.ic-scan{display:flex;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #e2e8f0}',
      '.ic-scan .ic-in{flex:1}',
      '.ic-cam{border:none;background:' + NAVY + ';color:#fff;border-radius:10px;width:48px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
      '.ic-body{flex:1;overflow:auto;padding:12px;display:flex;justify-content:center}',
      '.ic-prod{background:#fff;border-radius:18px;box-shadow:0 4px 18px rgba(15,23,42,.08);padding:16px;width:100%;max-width:560px;align-self:flex-start;touch-action:pan-y}',
      '.ic-prod .ub{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:800;background:#fef9c3;color:#713f12;padding:4px 10px;border-radius:999px}',
      '.ic-prod .cl{font-size:13px;font-weight:800;color:#64748b;margin-top:10px}',
      '.ic-prod .ds{font-size:20px;font-weight:800;line-height:1.25;margin:2px 0 8px}',
      '.ic-prod .meta{display:flex;gap:6px;flex-wrap:wrap;font-size:12px;color:#475569}',
      '.ic-prod .meta span{background:#f1f5f9;border-radius:8px;padding:3px 8px}',
      '.ic-recon{background:#fef3c7;color:#78350f;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:700;margin-top:10px}',
      '.ic-ya{background:#ecfdf5;color:#065f46;border-radius:12px;padding:8px 12px;font-size:12px;font-weight:700;margin-top:10px}',
      '.ic-qty{display:grid;grid-template-columns:72px 1fr 72px;gap:10px;margin-top:16px;align-items:stretch}',
      '.ic-qty button{border:none;border-radius:16px;font-size:34px;font-weight:800;cursor:pointer;background:#e2e8f0;color:#0f172a;min-height:76px;touch-action:manipulation}',
      '.ic-qty button:active{transform:scale(.96)}',
      '.ic-qty input{width:100%;box-sizing:border-box;text-align:center;font-size:44px;font-weight:800;border:2px solid #cbd5e1;border-radius:16px;font-family:inherit;color:' + NAVY + ';min-height:76px;font-variant-numeric:tabular-nums}',
      '.ic-qty input:focus{outline:none;border-color:' + NAVY + '}',
      '.ic-uni{text-align:center;font-size:12px;color:#64748b;margin-top:4px}',
      '.ic-rap{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:10px}',
      '.ic-rap button{border:1.5px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 14px;font-weight:800;cursor:pointer;font-family:inherit;min-height:40px;touch-action:manipulation}',
      '.ic-foot{display:grid;grid-template-columns:56px 1fr 56px;gap:8px;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));background:#fff;border-top:1px solid #e2e8f0}',
      '.ic-foot button{border:none;border-radius:14px;min-height:56px;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;touch-action:manipulation}',
      '.ic-foot .nav{background:#e2e8f0;color:#0f172a;font-size:22px}',
      '.ic-foot .go{background:' + GREEN + ';color:#fff}',
      '.ic-envia{margin:0 12px 10px;border:none;border-radius:14px;min-height:50px;background:' + AMBER + ';color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit}',
      '.ic-cola{font-size:11px;font-weight:800;background:#fee2e2;color:#991b1b;border-radius:999px;padding:3px 8px}',
      '.ic-lista{position:fixed;inset:0;z-index:4300;background:rgba(15,23,42,.5);display:flex;justify-content:flex-end}',
      '.ic-lista-in{background:#fff;width:100%;max-width:440px;height:100%;display:flex;flex-direction:column}',
      '.ic-lista-in .hd{padding:12px;padding-top:max(12px,env(safe-area-inset-top));border-bottom:1px solid #e2e8f0;display:flex;gap:8px;align-items:center}',
      '.ic-lista-in .bd{flex:1;overflow:auto}',
      '.ic-it{display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid #f1f5f9;cursor:pointer}',
      '.ic-it.act{background:#eef2ff}',
      '.ic-it .x{flex:1;min-width:0}.ic-it .x b{display:block;font-size:13px}.ic-it .x small{display:block;font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.ic-it .q{font-weight:800;font-variant-numeric:tabular-nums}',
      '.ic-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:700;z-index:4500;max-width:90vw;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.25)}',
      '#ic-camara{width:100%;max-width:420px;margin:0 auto;border-radius:12px;overflow:hidden}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------- utilidades
  function sb() { return window.tcSupabase || null; }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n, d) { n = Number(n) || 0; return n.toLocaleString('es-MX', { maximumFractionDigits: d == null ? 2 : d }); }
  function money(n) { n = Number(n) || 0; return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function el(id) { return document.getElementById(id); }
  function yo() {
    try { var u = (window.auth && window.auth.currentUser) || (window.tcAuth && window.tcAuth.currentUser); return String(u && u.email || '').toLowerCase(); } catch (e) { return ''; }
  }
  function corto(e) { return e ? String(e).split('@')[0] : ''; }
  function hace(s) {
    if (!s) return '';
    var m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
    if (m < 1) return 'hace un momento'; if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60); return h < 48 ? 'hace ' + h + ' h' : 'hace ' + Math.round(h / 24) + ' días';
  }
  function toast(t) {
    var d = document.createElement('div'); d.className = 'ic-toast'; d.textContent = t;
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2600);
  }
  function chk(r) { if (r.error) throw new Error(r.error.message || String(r.error)); return r.data; }
  function err(box, e) { console.error('[conteos]', e); if (box) box.innerHTML = '<div style="color:' + RED + ';padding:12px;font-size:13px">No se pudo cargar: ' + esc(e && e.message || e) + '</div>'; }
  function estChip(e) { var x = ESTADOS[e] || ESTADOS.pendiente; return '<span class="ic-est" style="background:' + x.bg + ';color:' + x.c + '">' + x.t + '</span>'; }
  function esSuper() { return !!(C && C.esAdmin()) || !!(st.conteo && String(st.conteo.creado_por || '').toLowerCase() === yo()); }
  function dif(r) { return r.contado == null ? null : Number(r.contado) - Number(r.existencia_aspel || 0); }
  function semaforo(r) {
    var d = dif(r); if (d == null) return '#cbd5e1';
    if (d === 0) return '#10b981';
    var base = Math.max(Math.abs(Number(r.existencia_aspel) || 0), 1);
    return Math.abs(d) / base <= 0.05 ? '#f59e0b' : RED;
  }
  // Supabase entrega máximo 1000 filas por consulta: se pide por páginas
  async function todo(armar) {
    var out = [], de = 0, tam = 1000;
    while (true) {
      var f = chk(await armar().range(de, de + tam - 1)) || [];
      out = out.concat(f); if (f.length < tam) break; de += tam;
    }
    return out;
  }
  function cerrarCanales() {
    canales.forEach(function (ch) { try { sb().removeChannel(ch); } catch (e) { } });
    canales = [];
  }

  // ---------------------------------------------------------------- cola sin señal
  var COLA = 'ic-cola-v1';
  function leerCola() { try { return JSON.parse(localStorage.getItem(COLA) || '[]'); } catch (e) { return []; } }
  function guardarCola(c) { try { localStorage.setItem(COLA, JSON.stringify(c)); } catch (e) { } }
  async function vaciarCola() {
    var c = leerCola(); if (!c.length || !sb()) return;
    var resto = [];
    for (var i = 0; i < c.length; i++) {
      try { chk(await sb().from('inv_conteo_renglones').update(c[i].datos).eq('id', c[i].id)); }
      catch (e) { resto.push(c[i]); }
    }
    guardarCola(resto);
    if (c.length !== resto.length && !resto.length) toast('Conteos sin señal ya se guardaron');
    pintarColaChip();
  }
  window.addEventListener('online', vaciarCola);
  setInterval(vaciarCola, 20000);
  function pintarColaChip() {
    var b = el('ic-colachip'); if (!b) return;
    var n = leerCola().length;
    b.innerHTML = n ? '<span class="ic-cola">' + n + ' sin enviar</span>' : '';
  }

  // ---------------------------------------------------------------- entrada
  function montar(p, ctx) {
    C = ctx; panel = p;
    salir();
    vaciarCola();
    pintarLista();
  }
  function salir() {
    cerrarCanales(); ui.tablero = false;
    if (ui.conteo) cerrarModoConteo();
    if (ui.revision) { ui.revision.nodo.remove(); ui.revision = null; }
  }

  // ================================================================ LISTA DE CAMPAÑAS
  async function pintarLista() {
    cerrarCanales(); ui.tablero = false; st.conteo = null;
    panel.innerHTML =
      '<div class="ic-top"><div><h3>Conteos físicos por partes</h3>' +
      '<p>Divide un almacén en partes pequeñas, cada quien cuenta la suya desde su celular, iPad o laptop y todo se ve en vivo.</p></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><span id="ic-vivo" class="ic-vivo"><i></i> En vivo</span>' +
      '<button class="ic-btn pri" id="ic-nueva">+ Nueva campaña</button></div></div>' +
      '<div id="ic-camps" data-ui-off></div>';
    el('ic-nueva').onclick = abrirNueva;
    await cargarLista();
    var ch = sb().channel('ic-lista-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inv_conteos' }, function () { programar(cargarLista); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inv_conteo_lotes' }, function () { programar(cargarLista); })
      .subscribe(function (s) { var v = el('ic-vivo'); if (v) v.className = 'ic-vivo' + (s === 'SUBSCRIBED' ? ' on' : ''); });
    canales.push(ch);
  }
  var _tProg = null;
  function programar(fn) { clearTimeout(_tProg); _tProg = setTimeout(fn, 400); }

  async function cargarLista() {
    var box = el('ic-camps'); if (!box) return;
    try {
      var visibles = C.alms.map(function (a) { return Number(a.cve_alm); });
      var camps = chk(await sb().from('inv_conteos').select('*').in('cve_alm', visibles).order('creado', { ascending: false }).limit(60)) || [];
      if (!camps.length) {
        box.innerHTML = '<div class="ic-card" style="align-items:center;text-align:center;padding:30px">' +
          '<div class="n">Todavía no hay conteos</div><div class="m">Crea una campaña, elige el almacén y el portal lo parte en lotes listos para contar.</div>' +
          '<button class="ic-btn pri" id="ic-nueva2" style="margin-top:8px">+ Nueva campaña</button></div>';
        el('ic-nueva2').onclick = abrirNueva; return;
      }
      var ids = camps.map(function (c) { return c.id; });
      var lotes = await todo(function () { return sb().from('inv_conteo_lotes').select('conteo_id,estatus').in('conteo_id', ids); });
      var por = {};
      lotes.forEach(function (l) { (por[l.conteo_id] = por[l.conteo_id] || []).push(l); });
      var abiertas = camps.filter(function (c) { return c.estatus !== 'cerrado'; });
      var cerradas = camps.filter(function (c) { return c.estatus === 'cerrado'; });
      var tarjeta = function (c) {
        var ls = por[c.id] || [], n = ls.length || 1, cuenta = {};
        ls.forEach(function (l) { cuenta[l.estatus] = (cuenta[l.estatus] || 0) + 1; });
        var bar = ['aprobado', 'revision', 'contando'].map(function (k) {
          return '<span style="width:' + ((cuenta[k] || 0) / n * 100) + '%;background:' + ESTADOS[k].c + '"></span>';
        }).join('');
        return '<div class="ic-card clic" data-c="' + c.id + '">' +
          '<div style="display:flex;justify-content:space-between;gap:8px"><div class="n">' + esc(c.nombre) + '</div>' +
          (c.estatus === 'cerrado' ? '<span class="ic-est" style="background:#e2e8f0;color:#334155">Cerrada</span>' : '<span class="ic-est" style="background:#dbeafe;color:' + BLUE + '">Abierta</span>') + '</div>' +
          '<div class="m">' + esc(c.almacen || ('Almacén ' + c.cve_alm)) + ' · ' + esc(CRITERIOS[c.criterio] || '') + '</div>' +
          '<div class="ic-bar">' + bar + '</div>' +
          '<div class="m"><b style="color:' + GREEN + '">' + (cuenta.aprobado || 0) + '</b> aprobadas · <b style="color:' + AMBER + '">' + (cuenta.revision || 0) + '</b> en revisión · <b style="color:' + BLUE + '">' + (cuenta.contando || 0) + '</b> contando · ' + (cuenta.pendiente || 0) + ' pendientes de ' + ls.length + ' partes</div>' +
          '<div class="m">Creó ' + esc(corto(c.creado_por)) + ' · ' + esc(hace(c.creado)) + '</div></div>';
      };
      box.innerHTML =
        (abiertas.length ? '<div class="ic-grid">' + abiertas.map(tarjeta).join('') + '</div>' : '<div class="ic-nota">No hay campañas abiertas.</div>') +
        (cerradas.length ? '<div style="margin:18px 0 8px;font-size:13px;font-weight:800;color:#334155">Cerradas</div><div class="ic-grid">' + cerradas.map(tarjeta).join('') + '</div>' : '');
      box.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { abrirCampana(b.getAttribute('data-c')); }; });
    } catch (e) {
      if (/inv_conteos/.test(String(e.message)) && /exist|schema/i.test(String(e.message))) {
        box.innerHTML = '<div class="ic-nota" style="border-color:#fca5a5;background:#fef2f2;color:#7f1d1d"><b>Falta crear las tablas de conteos.</b> Corre el archivo inventarios_conteos.sql en Supabase (SQL Editor) una sola vez.</div>';
      } else err(box, e);
    }
  }

  // ================================================================ NUEVA CAMPAÑA
  function abrirNueva() {
    var m = document.createElement('div'); m.className = 'ic-modal'; m.setAttribute('data-ui-off', '');
    var hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    m.innerHTML = '<div class="ic-box" style="max-width:720px">' +
      '<div class="ic-top"><div><h3>Nueva campaña de conteo</h3><p>El portal toma la existencia actual de Aspel y la reparte en partes para contar.</p></div>' +
      '<button class="ic-btn" id="ic-n-x">Cerrar</button></div>' +
      '<div class="ic-form">' +
        '<label>Almacén<select id="ic-n-alm" class="ic-in">' + C.opcionesAlm('', 'Elige un almacén') + '</select></label>' +
        '<label>Nombre<input id="ic-n-nom" class="ic-in" placeholder="Ej. Conteo general"></label>' +
        '<label>¿Qué productos?<select id="ic-n-cri" class="ic-in">' + Object.keys(CRITERIOS).map(function (k) { return '<option value="' + k + '">' + CRITERIOS[k] + '</option>'; }).join('') + '</select></label>' +
        '<label>Dividir en partes por<select id="ic-n-div" class="ic-in"><option value="ubicacion">Ubicación (rack / anaquel)</option><option value="linea">Línea de producto</option><option value="bloques">Bloques del mismo tamaño</option></select></label>' +
        '<label>Máximo de productos por parte<input id="ic-n-tam" class="ic-in" type="number" min="5" max="300" value="40"></label>' +
        '<label style="flex-direction:row;align-items:center;gap:8px;margin-top:22px"><input type="checkbox" id="ic-n-ciego" checked style="width:20px;height:20px"> Conteo ciego (quien cuenta no ve lo que dice Aspel)</label>' +
      '</div>' +
      '<div id="ic-n-prev" class="ic-nota">Elige el almacén y presiona <b>Calcular partes</b>.</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap"><button class="ic-btn" id="ic-n-calc">Calcular partes</button><button class="ic-btn pri" id="ic-n-crear" disabled>Crear campaña</button></div>' +
      '</div>';
    document.body.appendChild(m);
    var plan = null;
    var cerrar = function () { m.remove(); };
    el('ic-n-x').onclick = cerrar;
    m.addEventListener('click', function (e) { if (e.target === m) cerrar(); });
    var invalida = function () { plan = null; el('ic-n-crear').disabled = true; };
    ['ic-n-alm', 'ic-n-cri', 'ic-n-div', 'ic-n-tam'].forEach(function (id) { el(id).onchange = invalida; });
    el('ic-n-alm').addEventListener('change', function () {
      var a = C.alms.find(function (x) { return String(x.cve_alm) === el('ic-n-alm').value; });
      if (a) el('ic-n-nom').value = 'Conteo ' + a.nombre + ' · ' + hoy;
    });
    el('ic-n-calc').onclick = async function () {
      var cve = Number(el('ic-n-alm').value);
      if (!cve) { toast('Elige un almacén'); return; }
      var prev = el('ic-n-prev'), btn = this; btn.disabled = true;
      try {
        plan = await armarPlan(cve, el('ic-n-cri').value, el('ic-n-div').value, Math.max(5, Number(el('ic-n-tam').value) || 40), function (t) { prev.innerHTML = esc(t); });
        if (!plan.total) { prev.innerHTML = '<b>No hay productos con ese criterio en este almacén.</b>'; plan = null; return; }
        prev.innerHTML = 'Se crearán <b>' + plan.lotes.length + ' partes</b> con <b>' + num(plan.total, 0) + ' productos</b> en total.' +
          '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;max-height:140px;overflow:auto">' +
          plan.lotes.map(function (l) { return '<span class="ic-est" style="background:#eef2ff;color:' + NAVY + '">' + esc(l.nombre) + ' · ' + l.items.length + '</span>'; }).join('') + '</div>';
        el('ic-n-crear').disabled = false;
      } catch (e) { err(prev, e); plan = null; }
      finally { btn.disabled = false; }
    };
    el('ic-n-crear').onclick = async function () {
      if (!plan) return;
      var btn = this; btn.disabled = true;
      var prev = el('ic-n-prev');
      try {
        var cve = Number(el('ic-n-alm').value);
        var a = C.alms.find(function (x) { return Number(x.cve_alm) === cve; }) || {};
        var conteo = chk(await sb().from('inv_conteos').insert({
          nombre: el('ic-n-nom').value.trim() || ('Conteo ' + (a.nombre || cve)), cve_alm: cve, almacen: a.nombre || null,
          criterio: el('ic-n-cri').value, division: el('ic-n-div').value, ciego: el('ic-n-ciego').checked, creado_por: yo()
        }).select('*').single());
        prev.innerHTML = 'Creando partes…';
        var lotes = chk(await sb().from('inv_conteo_lotes').insert(plan.lotes.map(function (l, i) {
          return { conteo_id: conteo.id, nombre: l.nombre, orden: i };
        })).select('id,orden')) || [];
        var idPorOrden = {}; lotes.forEach(function (l) { idPorOrden[l.orden] = l.id; });
        var filas = [];
        plan.lotes.forEach(function (l, i) {
          l.items.forEach(function (p, j) {
            var ex = Number(p.existencia) || 0;
            filas.push({
              conteo_id: conteo.id, lote_id: idPorOrden[i], orden: j, cve_art: p.cve_art, descr: p.descr, linea: p.linea || null,
              uni_med: p.uni_med || null, ubicacion: p.ubicacion || null, existencia_aspel: ex,
              costo: ex !== 0 ? (Number(p.valor) || 0) / ex : 0
            });
          });
        });
        for (var k = 0; k < filas.length; k += 500) {
          prev.innerHTML = 'Guardando productos ' + num(k, 0) + ' de ' + num(filas.length, 0) + '…';
          chk(await sb().from('inv_conteo_renglones').insert(filas.slice(k, k + 500)));
        }
        cerrar();
        toast('Campaña creada');
        abrirCampana(conteo.id);
      } catch (e) { err(prev, e); btn.disabled = false; }
    };
  }

  async function traer(cve, filtro, ubic) {
    var out = [], off = 0, tam = 200;
    while (true) {
      var f = (await C.rpc('inv_buscar', { p_texto: null, p_cve_alm: cve, p_filtro: filtro, p_ubicacion: ubic || null, p_limite: tam, p_offset: off })) || [];
      out = out.concat(f); if (f.length < tam || off > 30000) break; off += tam;
    }
    return out;
  }

  async function armarPlan(cve, criterio, division, tam, aviso) {
    aviso('Leyendo productos de Aspel…');
    var prods = await traer(cve, criterio, null);
    var vistos = {}; prods = prods.filter(function (p) { if (vistos[p.cve_art]) return false; vistos[p.cve_art] = 1; return true; });
    // Ubicación de cada producto (siempre ayuda para ordenar el recorrido)
    var ubs = [];
    try { ubs = (await C.rpc('inv_ubicaciones_aspel', { p_cve_alm: cve })) || []; } catch (e) { ubs = []; }
    var ubDe = {};
    var pend = ubs.slice(), hechos = 0;
    var trabajador = async function () {
      while (pend.length) {
        var u = pend.shift();
        var fs = await traer(cve, 'todos', u.ubicacion);
        fs.forEach(function (f) { if (!ubDe[f.cve_art]) ubDe[f.cve_art] = u.ubicacion; });
        hechos++; aviso('Leyendo ubicaciones ' + hechos + ' de ' + ubs.length + '…');
      }
    };
    await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
    prods.forEach(function (p) { p.ubicacion = ubDe[p.cve_art] || 'SIN UBICACIÓN'; });
    var cmp = function (a, b) { return String(a.ubicacion).localeCompare(String(b.ubicacion), 'es', { numeric: true }) || String(a.cve_art).localeCompare(String(b.cve_art), 'es', { numeric: true }); };
    prods.sort(cmp);

    var grupos = [];
    if (division === 'bloques') {
      for (var i = 0; i < prods.length; i += tam) grupos.push({ nombre: 'Bloque ' + (grupos.length + 1), items: prods.slice(i, i + tam) });
      grupos.forEach(function (g) {
        var a = g.items[0].ubicacion, b = g.items[g.items.length - 1].ubicacion;
        g.nombre += ' · ' + (a === b ? a : a + ' a ' + b);
      });
    } else {
      var llave = division === 'linea' ? function (p) { return p.linea ? 'Línea ' + p.linea : 'Sin línea'; } : function (p) { return p.ubicacion; };
      var mapa = {}, orden = [];
      prods.forEach(function (p) { var k = llave(p); if (!mapa[k]) { mapa[k] = []; orden.push(k); } mapa[k].push(p); });
      orden.sort(function (a, b) {
        var sa = /^SIN /.test(a), sb2 = /^SIN /.test(b); if (sa !== sb2) return sa ? 1 : -1;
        return a.localeCompare(b, 'es', { numeric: true });
      });
      orden.forEach(function (k) {
        var its = mapa[k], partes = Math.ceil(its.length / tam);
        for (var j = 0; j < partes; j++) grupos.push({ nombre: k + (partes > 1 ? ' (' + (j + 1) + '/' + partes + ')' : ''), items: its.slice(j * tam, (j + 1) * tam) });
      });
    }
    return { lotes: grupos, total: prods.length };
  }

  // ================================================================ TABLERO DE CAMPAÑA
  async function abrirCampana(id) {
    cerrarCanales();
    ui.tablero = true;
    panel.innerHTML = '<div id="ic-tab" data-ui-off></div>';
    var box = el('ic-tab');
    box.innerHTML = '<div style="padding:16px;color:#94a3b8;font-size:13px">Cargando campaña…</div>';
    try {
      st.conteo = chk(await sb().from('inv_conteos').select('*').eq('id', id).single());
      st.lotes = await todo(function () { return sb().from('inv_conteo_lotes').select('*').eq('conteo_id', id).order('orden'); });
      st.renglones = await todo(function () { return sb().from('inv_conteo_renglones').select('*').eq('conteo_id', id).order('orden'); });
    } catch (e) { err(box, e); return; }
    pintarTablero();
    suscribir(id);
  }

  function suscribir(id) {
    var f = 'conteo_id=eq.' + id;
    var ch = sb().channel('ic-c-' + id + '-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inv_conteo_renglones', filter: f }, function (p) { aplicar(st.renglones, p); repintar(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inv_conteo_lotes', filter: f }, function (p) { aplicar(st.lotes, p); st.lotes.sort(function (a, b) { return a.orden - b.orden; }); repintar(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inv_conteos', filter: 'id=eq.' + id }, function (p) {
        if (p.eventType === 'DELETE') {
          if (st.conteo && p.old && p.old.id === st.conteo.id) { toast('La campaña fue eliminada'); salir(); pintarLista(); }
          return;
        }
        st.conteo = p.new; repintar();
      })
      .subscribe(function (s) { st.vivo = s === 'SUBSCRIBED'; var v = el('ic-vivo'); if (v) v.className = 'ic-vivo' + (st.vivo ? ' on' : ''); });
    canales.push(ch);
  }
  function aplicar(arr, p) {
    if (p.eventType === 'DELETE') {
      var i = arr.findIndex(function (x) { return x.id === (p.old && p.old.id); }); if (i >= 0) arr.splice(i, 1); return;
    }
    var n = p.new, o = arr.find(function (x) { return x.id === n.id; });
    if (o) Object.assign(o, n); else arr.push(n);
  }
  function repintar() {
    clearTimeout(_tRep);
    _tRep = setTimeout(function () {
      if (ui.tablero && el('ic-tab')) pintarTableroCuerpo();
      if (ui.conteo) refrescarConteo();
      if (ui.revision) pintarRevisionTabla();
    }, 200);
  }

  function statsDe(rs) {
    var o = { total: rs.length, contados: 0, dif: 0, ok: 0, neto: 0, falt: 0, sobr: 0, recon: 0 };
    rs.forEach(function (r) {
      if (r.reconteo) o.recon++;
      var d = dif(r); if (d == null) return;
      o.contados++;
      if (d === 0) o.ok++; else {
        o.dif++; var imp = d * (Number(r.costo) || 0);
        o.neto += imp; if (imp < 0) o.falt += imp; else o.sobr += imp;
      }
    });
    o.pct = o.total ? Math.round(o.contados / o.total * 100) : 0;
    o.exact = o.contados ? Math.round(o.ok / o.contados * 1000) / 10 : 0;
    return o;
  }
  function renglonesDe(loteId) { return st.renglones.filter(function (r) { return r.lote_id === loteId; }).sort(function (a, b) { return a.orden - b.orden; }); }

  function pintarTablero() {
    var c = st.conteo, sup = esSuper(), cerrada = c.estatus === 'cerrado';
    el('ic-tab').innerHTML =
      '<div class="ic-top"><div style="display:flex;gap:10px;align-items:flex-start">' +
        '<button class="ic-btn" id="ic-t-volver">‹ Campañas</button>' +
        '<div><h3>' + esc(c.nombre) + '</h3><p>' + esc(c.almacen || ('Almacén ' + c.cve_alm)) + ' · ' + esc(CRITERIOS[c.criterio] || '') +
        (c.ciego ? ' · Conteo ciego' : '') + ' · Existencias de Aspel congeladas al ' + esc(new Date(c.creado).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</p></div></div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span id="ic-colachip"></span><span id="ic-vivo" class="ic-vivo' + (st.vivo ? ' on' : '') + '"><i></i> En vivo</span>' +
        '<button class="ic-btn" id="ic-t-csv">Exportar diferencias</button>' +
        (sup && !cerrada ? '<button class="ic-btn ok" id="ic-t-cerrar">Cerrar campaña</button>' : '') +
        (sup ? '<button class="ic-btn del" id="ic-t-borrar">Eliminar</button>' : '') + '</div></div>' +
      '<div id="ic-t-kpis" class="ic-kpis"></div>' +
      '<div id="ic-t-barra"></div>' +
      '<div class="ic-chips" id="ic-t-fil"></div>' +
      '<div class="ic-grid" id="ic-t-lotes"></div>';
    el('ic-t-volver').onclick = function () { salir(); pintarLista(); };
    el('ic-t-csv').onclick = exportarCSV;
    var bc = el('ic-t-cerrar'); if (bc) bc.onclick = cerrarCampana;
    var bb = el('ic-t-borrar'); if (bb) bb.onclick = borrarCampana;
    pintarColaChip();
    pintarTableroCuerpo();
  }

  function pintarTableroCuerpo() {
    var s = statsDe(st.renglones), c = st.conteo, cerrada = c.estatus === 'cerrado';
    var k = [
      { v: s.pct + '%', l: 'Avance', h: num(s.contados, 0) + ' de ' + num(s.total, 0) + ' productos', c: NAVY },
      { v: num(s.dif, 0), l: 'Con diferencia', h: s.recon ? s.recon + ' en reconteo' : 'Contado ≠ Aspel', c: s.dif ? RED : GREEN },
      { v: s.exact + '%', l: 'Exactitud', h: 'Contados que coinciden con Aspel', c: s.exact >= 95 ? GREEN : s.exact >= 85 ? AMBER : RED },
      { v: money(s.falt), l: 'Faltante', h: 'Costo promedio Aspel', c: RED },
      { v: money(s.sobr), l: 'Sobrante', h: 'Costo promedio Aspel', c: GREEN },
      { v: money(s.neto), l: 'Diferencia neta', h: 'Sobrante − faltante', c: s.neto < 0 ? RED : NAVY }
    ];
    var kb = el('ic-t-kpis'); if (!kb) return;
    kb.innerHTML = k.map(function (x) { return '<div class="ic-kpi"><div class="v" style="color:' + x.c + '">' + x.v + '</div><div class="l">' + x.l + '</div><div class="h">' + esc(x.h) + '</div></div>'; }).join('');

    var cuenta = { pendiente: 0, contando: 0, revision: 0, aprobado: 0 }, n = st.lotes.length || 1;
    st.lotes.forEach(function (l) { cuenta[l.estatus] = (cuenta[l.estatus] || 0) + 1; });
    el('ic-t-barra').innerHTML = '<div class="ic-bar" style="height:12px">' + ['aprobado', 'revision', 'contando'].map(function (e) {
      return '<span style="width:' + (cuenta[e] / n * 100) + '%;background:' + ESTADOS[e].c + '"></span>'; }).join('') + '</div>';

    var fil = [['todos', 'Todas · ' + st.lotes.length], ['mios', 'Mías'], ['pendiente', 'Pendientes · ' + cuenta.pendiente], ['contando', 'Contando · ' + cuenta.contando], ['revision', 'En revisión · ' + cuenta.revision], ['aprobado', 'Aprobadas · ' + cuenta.aprobado]];
    el('ic-t-fil').innerHTML = fil.map(function (f) { return '<button class="ic-chip' + (st.filtro === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('');
    el('ic-t-fil').querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { st.filtro = b.getAttribute('data-f'); pintarTableroCuerpo(); }; });

    var me = yo(), sup = esSuper();
    var lista = st.lotes.filter(function (l) {
      if (st.filtro === 'todos') return true;
      if (st.filtro === 'mios') return String(l.tomado_por || '').toLowerCase() === me || (l.asignado_a && me && String(l.asignado_a).toLowerCase().indexOf(corto(me)) >= 0);
      return l.estatus === st.filtro;
    });
    var box = el('ic-t-lotes');
    if (!lista.length) { box.innerHTML = '<div class="ic-nota">No hay partes con este filtro.</div>'; return; }
    box.innerHTML = lista.map(function (l) {
      var s2 = statsDe(renglonesDe(l.id)), e = ESTADOS[l.estatus] || ESTADOS.pendiente;
      var quien = l.tomado_por ? 'Cuenta ' + corto(l.tomado_por) : (l.asignado_a ? 'Asignada a ' + corto(l.asignado_a) : 'Sin asignar');
      var puedeContar = !cerrada && (l.estatus === 'pendiente' || l.estatus === 'contando') && (!l.tomado_por || String(l.tomado_por).toLowerCase() === me || sup);
      return '<div class="ic-card" style="border-top:4px solid ' + e.c + '">' +
        '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div class="n">' + esc(l.nombre) + '</div>' + estChip(l.estatus) + '</div>' +
        '<div class="m">' + esc(quien) + (l.tomado_en && l.estatus === 'contando' ? ' · ' + hace(l.tomado_en) : '') + '</div>' +
        '<div class="ic-bar"><span style="width:' + s2.pct + '%;background:' + e.c + '"></span></div>' +
        '<div class="m"><b>' + s2.contados + '</b> / ' + s2.total + ' contados' +
          (s2.dif ? ' · <b style="color:' + RED + '">' + s2.dif + ' con diferencia</b>' : '') +
          (s2.recon ? ' · <b style="color:' + AMBER + '">' + s2.recon + ' reconteo</b>' : '') + '</div>' +
        '<div class="acc">' +
          (puedeContar ? '<button class="ic-btn pri" data-contar="' + l.id + '">' + (l.estatus === 'contando' ? 'Seguir contando' : 'Contar') + '</button>' : '') +
          ((sup || l.estatus === 'aprobado') && l.estatus !== 'pendiente' ? '<button class="ic-btn' + (l.estatus === 'revision' ? ' warn' : '') + '" data-rev="' + l.id + '">' + (l.estatus === 'revision' && sup ? 'Revisar' : 'Ver detalle') + '</button>' : '') +
          (sup && !cerrada ? '<button class="ic-btn" data-asig="' + l.id + '">Asignar</button>' : '') +
        '</div></div>';
    }).join('');
    box.querySelectorAll('[data-contar]').forEach(function (b) { b.onclick = function () { tomarLote(b.getAttribute('data-contar')); }; });
    box.querySelectorAll('[data-rev]').forEach(function (b) { b.onclick = function () { abrirRevision(b.getAttribute('data-rev')); }; });
    box.querySelectorAll('[data-asig]').forEach(function (b) { b.onclick = function () { asignar(b.getAttribute('data-asig')); }; });
  }

  async function asignar(id) {
    var l = st.lotes.find(function (x) { return x.id === id; }); if (!l) return;
    var v = prompt('Correo de quien contará "' + l.nombre + '" (vacío = quitar)', l.asignado_a || '');
    if (v == null) return;
    try { chk(await sb().from('inv_conteo_lotes').update({ asignado_a: v.trim().toLowerCase() || null, actualizado: new Date().toISOString() }).eq('id', id)); toast('Asignada'); }
    catch (e) { alert('No se pudo asignar: ' + e.message); }
  }

  async function tomarLote(id) {
    var l = st.lotes.find(function (x) { return x.id === id; }); if (!l) return;
    var me = yo();
    if (String(l.tomado_por || '').toLowerCase() !== me) {
      if (l.tomado_por && !confirm('Esta parte la está contando ' + corto(l.tomado_por) + '. ¿Quieres tomarla tú?')) return;
      try {
        var q = sb().from('inv_conteo_lotes').update({
          tomado_por: me, tomado_en: new Date().toISOString(), estatus: 'contando', actualizado: new Date().toISOString()
        }).eq('id', id);
        if (!esSuper() && !l.tomado_por) q = q.is('tomado_por', null);
        var r = chk(await q.select('*'));
        if (!r || !r.length) { toast('Alguien más la acaba de tomar'); return; }
        Object.assign(l, r[0]);
      } catch (e) { alert('No se pudo tomar la parte: ' + e.message); return; }
    }
    abrirModoConteo(l);
  }

  // ================================================================ MODO CONTEO
  function abrirModoConteo(l) {
    var items = renglonesDe(l.id);
    var idx = items.findIndex(function (r) { return r.reconteo; });
    if (idx < 0) idx = items.findIndex(function (r) { return r.contado == null; });
    if (idx < 0) idx = 0;
    var nodo = document.createElement('div');
    nodo.className = 'ic-full'; nodo.setAttribute('data-ui-off', '');
    nodo.innerHTML =
      '<div class="ic-full-h"><div class="r1"><button class="ic-ib" id="ic-m-x" aria-label="Salir">✕</button>' +
      '<div class="t"><b>' + esc(l.nombre) + '</b><small id="ic-m-prog"></small></div><span id="ic-colachip"></span>' +
      '<button class="ic-ib" id="ic-m-lista">Lista</button></div><div class="ic-bar"><span id="ic-m-bar" style="background:#34d399"></span></div></div>' +
      '<div class="ic-scan"><input id="ic-m-busca" class="ic-in" placeholder="Escanea o escribe clave / descripción" autocomplete="off" enterkeyhint="search">' +
      '<button class="ic-cam" id="ic-m-cam" aria-label="Escanear con cámara"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg></button></div>' +
      '<div class="ic-body"><div class="ic-prod" id="ic-m-prod"></div></div>' +
      '<button class="ic-envia" id="ic-m-envia" style="display:none"></button>' +
      '<div class="ic-foot"><button class="nav" id="ic-m-ant" aria-label="Anterior">‹</button><button class="go" id="ic-m-ok">Guardar y siguiente</button><button class="nav" id="ic-m-sig" aria-label="Siguiente">›</button></div>';
    document.body.appendChild(nodo);
    document.body.style.overflow = 'hidden';
    ui.conteo = { nodo: nodo, lote: l, items: items, idx: idx, editando: false };

    el('ic-m-x').onclick = cerrarModoConteo;
    el('ic-m-ant').onclick = function () { mover(-1); };
    el('ic-m-sig').onclick = function () { mover(1); };
    el('ic-m-ok').onclick = function () { guardarActual(true); };
    el('ic-m-lista').onclick = abrirListaLote;
    el('ic-m-cam').onclick = abrirCamara;
    el('ic-m-envia').onclick = enviarRevision;
    var bus = el('ic-m-busca');
    bus.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); buscarCodigo(bus.value); } });
    // deslizar para cambiar de producto
    var x0 = null, prod = el('ic-m-prod');
    prod.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    prod.addEventListener('touchend', function (e) {
      if (x0 == null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 70 && !(e.target && e.target.tagName === 'INPUT')) mover(dx < 0 ? 1 : -1);
    });
    pintarProducto();
    pintarColaChip();
  }

  function cerrarModoConteo() {
    if (!ui.conteo) return;
    pararCamara();
    ui.conteo.nodo.remove(); ui.conteo = null;
    var li = document.querySelector('.ic-lista'); if (li) li.remove();
    document.body.style.overflow = '';
    if (ui.tablero) pintarTableroCuerpo();
  }

  function mover(d) {
    var m = ui.conteo; if (!m) return;
    var n = m.idx + d;
    if (n < 0 || n >= m.items.length) return;
    m.idx = n; pintarProducto();
  }
  function irA(i) { if (!ui.conteo) return; ui.conteo.idx = i; pintarProducto(); }

  function pintarProducto() {
    var m = ui.conteo; if (!m) return;
    var r = m.items[m.idx], prod = el('ic-m-prod');
    if (!r) { prod.innerHTML = '<div class="ic-nota">Esta parte no tiene productos.</div>'; pintarProgreso(); return; }
    m.llave = llave(r);
    var ciego = st.conteo && st.conteo.ciego;
    prod.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span class="ub">📍 ' + esc(r.ubicacion || 'Sin ubicación') + '</span>' +
      '<span style="font-size:12px;color:#94a3b8;font-weight:700">' + (m.idx + 1) + ' de ' + m.items.length + '</span></div>' +
      '<div class="cl">' + esc(r.cve_art) + '</div><div class="ds">' + esc(r.descr || '') + '</div>' +
      '<div class="meta">' + (r.linea ? '<span>Línea ' + esc(r.linea) + '</span>' : '') + (!ciego ? '<span>Aspel: <b>' + num(r.existencia_aspel) + '</b> ' + esc(r.uni_med || '') + '</span>' : '') + '</div>' +
      (r.reconteo ? '<div class="ic-recon">⚠ El supervisor pidió volver a contar este producto.</div>' : '') +
      (r.contado != null && !r.reconteo ? '<div class="ic-ya">✓ Contado: ' + num(r.contado) + ' por ' + esc(corto(r.contado_por)) + ' · ' + esc(hace(r.contado_en)) + '</div>' : '') +
      '<div class="ic-qty"><button id="ic-q-menos" aria-label="Menos">−</button>' +
      '<input id="ic-q" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + (r.contado != null && !r.reconteo ? esc(r.contado) : '') + '">' +
      '<button id="ic-q-mas" aria-label="Más">+</button></div>' +
      '<div class="ic-uni">' + esc(r.uni_med || 'piezas') + '</div>' +
      '<div class="ic-rap"><button data-s="5">+5</button><button data-s="10">+10</button><button data-s="cero">No hay (0)</button></div>' +
      '<input id="ic-q-nota" class="ic-in" style="margin-top:12px" placeholder="Nota (opcional): dañado, en otra ubicación…" value="' + esc(r.nota || '') + '">';
    var q = el('ic-q');
    var val = function () { var v = parseFloat(String(q.value).replace(',', '.')); return isNaN(v) ? 0 : v; };
    var poner = function (v) { q.value = String(Math.max(0, Math.round(v * 1000) / 1000)); if (navigator.vibrate) navigator.vibrate(8); };
    el('ic-q-mas').onclick = function () { poner(val() + 1); };
    el('ic-q-menos').onclick = function () { poner(val() - 1); };
    prod.querySelectorAll('[data-s]').forEach(function (b) {
      b.onclick = function () { var s = b.getAttribute('data-s'); if (s === 'cero') { poner(0); guardarActual(true); } else poner(val() + Number(s)); };
    });
    q.addEventListener('focus', function () { m.editando = true; q.select(); });
    q.addEventListener('blur', function () { m.editando = false; });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); guardarActual(true); } });
    if (window.matchMedia('(pointer:fine)').matches) setTimeout(function () { q.focus(); }, 50);
    pintarProgreso();
  }

  function pintarProgreso() {
    var m = ui.conteo; if (!m) return;
    var s = statsDe(m.items);
    var hechos = m.items.filter(function (r) { return r.contado != null && !r.reconteo; }).length;
    el('ic-m-prog').textContent = hechos + ' de ' + m.items.length + ' contados' + (s.recon ? ' · ' + s.recon + ' por recontar' : '');
    el('ic-m-bar').style.width = (m.items.length ? hechos / m.items.length * 100 : 0) + '%';
    var env = el('ic-m-envia'), fin = hechos === m.items.length && m.items.length > 0;
    env.style.display = fin && m.lote.estatus === 'contando' ? 'block' : 'none';
    env.textContent = '✓ Terminé · Enviar a revisión';
  }

  function refrescarConteo() {
    var m = ui.conteo; if (!m) return;
    var l = st.lotes.find(function (x) { return x.id === m.lote.id; });
    if (!l) { toast('Esta parte fue eliminada'); cerrarModoConteo(); return; }
    m.lote = l;
    var actual = m.items[m.idx] && m.items[m.idx].id;
    m.items = renglonesDe(l.id);
    var i = m.items.findIndex(function (r) { return r.id === actual; });
    if (i >= 0) m.idx = i;
    // Solo se vuelve a dibujar el producto si OTRA persona lo cambió (así no se borra lo que estás capturando)
    var r = m.items[m.idx];
    if (r && llave(r) !== m.llave && String(r.contado_por || '').toLowerCase() !== yo() && !m.editando) pintarProducto();
    else pintarProgreso();
  }
  function llave(r) { return [r.contado, r.reconteo, r.contado_por, r.nota].join('|'); }

  async function guardarActual(siguiente) {
    var m = ui.conteo; if (!m) return;
    var r = m.items[m.idx]; if (!r) return;
    var q = el('ic-q'), txt = String(q.value).trim();
    if (txt === '') { if (siguiente) siguientePendiente(); return; }
    var v = parseFloat(txt.replace(',', '.'));
    if (isNaN(v) || v < 0) { toast('Escribe una cantidad válida'); q.focus(); return; }
    var datos = { contado: v, contado_por: yo(), contado_en: new Date().toISOString(), reconteo: false, nota: (el('ic-q-nota').value || '').trim() || null };
    Object.assign(r, datos);  // se ve al instante, aunque no haya señal
    if (navigator.vibrate) navigator.vibrate(15);
    if (siguiente) siguientePendiente(); else pintarProducto();
    try {
      chk(await sb().from('inv_conteo_renglones').update(datos).eq('id', r.id));
    } catch (e) {
      var c = leerCola().filter(function (x) { return x.id !== r.id; }); c.push({ id: r.id, datos: datos }); guardarCola(c);
      pintarColaChip(); toast('Sin señal: se guardará solo al reconectar');
    }
  }

  function siguientePendiente() {
    var m = ui.conteo; if (!m) return;
    var n = m.items.length;
    for (var k = 1; k <= n; k++) {
      var i = (m.idx + k) % n, r = m.items[i];
      if (r.contado == null || r.reconteo) { m.idx = i; pintarProducto(); return; }
    }
    pintarProducto();
    toast('¡Todos contados! Ya puedes enviar a revisión');
  }

  async function enviarRevision() {
    var m = ui.conteo; if (!m) return;
    var falta = m.items.filter(function (r) { return r.contado == null || r.reconteo; }).length;
    if (falta && !confirm('Faltan ' + falta + ' productos. ¿Enviar así?')) return;
    if (leerCola().length) await vaciarCola();
    try {
      chk(await sb().from('inv_conteo_lotes').update({ estatus: 'revision', enviado_en: new Date().toISOString(), actualizado: new Date().toISOString() }).eq('id', m.lote.id));
      toast('Enviado a revisión');
      cerrarModoConteo();
    } catch (e) { alert('No se pudo enviar: ' + e.message); }
  }

  function abrirListaLote() {
    var m = ui.conteo; if (!m) return;
    var d = document.createElement('div'); d.className = 'ic-lista'; d.setAttribute('data-ui-off', '');
    var solo = false;
    d.innerHTML = '<div class="ic-lista-in"><div class="hd"><b style="flex:1">Productos de la parte</b>' +
      '<button class="ic-chip" id="ic-l-pend">Solo pendientes</button><button class="ic-btn" id="ic-l-x">Cerrar</button></div><div class="bd" id="ic-l-bd"></div></div>';
    document.body.appendChild(d);
    var pinta = function () {
      el('ic-l-bd').innerHTML = m.items.map(function (r, i) {
        if (solo && r.contado != null && !r.reconteo) return '';
        var ic = r.reconteo ? '<span class="ic-dot" style="background:' + AMBER + '"></span>' : r.contado != null ? '<span style="color:' + GREEN + ';font-weight:800">✓</span>' : '<span class="ic-dot" style="background:#cbd5e1"></span>';
        return '<div class="ic-it' + (i === m.idx ? ' act' : '') + '" data-i="' + i + '">' + ic + '<div class="x"><b>' + esc(r.cve_art) + '</b><small>' + esc(r.descr || '') + ' · ' + esc(r.ubicacion || '') + '</small></div>' +
          '<div class="q">' + (r.contado != null ? num(r.contado) : '—') + '</div></div>';
      }).join('') || '<div class="ic-nota" style="margin:12px">No hay pendientes.</div>';
      d.querySelectorAll('[data-i]').forEach(function (n) { n.onclick = function () { irA(Number(n.getAttribute('data-i'))); d.remove(); }; });
    };
    el('ic-l-x').onclick = function () { d.remove(); };
    el('ic-l-pend').onclick = function () { solo = !solo; this.className = 'ic-chip' + (solo ? ' on' : ''); pinta(); };
    d.addEventListener('click', function (e) { if (e.target === d) d.remove(); });
    pinta();
  }

  async function buscarCodigo(txt) {
    var m = ui.conteo; if (!m) return;
    var t = String(txt || '').trim(); if (!t) return;
    var T = t.toUpperCase();
    el('ic-m-busca').value = '';
    var i = m.items.findIndex(function (r) { return String(r.cve_art).toUpperCase() === T; });
    if (i < 0) i = m.items.findIndex(function (r) { return (String(r.cve_art) + ' ' + (r.descr || '')).toUpperCase().indexOf(T) >= 0; });
    if (i >= 0) { irA(i); return; }
    try {
      var res = (await C.rpc('inv_buscar', { p_texto: t, p_cve_alm: st.conteo.cve_alm, p_filtro: 'todos', p_ubicacion: null, p_limite: 5, p_offset: 0 })) || [];
      if (!res.length) { toast('No se encontró "' + t + '" en Aspel'); return; }
      var p = res[0];
      i = m.items.findIndex(function (r) { return r.cve_art === p.cve_art; });
      if (i >= 0) { irA(i); return; }
      var otro = st.renglones.find(function (r) { return r.cve_art === p.cve_art; });
      if (otro) {
        var lo = st.lotes.find(function (x) { return x.id === otro.lote_id; });
        toast(p.cve_art + ' está en la parte "' + (lo ? lo.nombre : '') + '"'); return;
      }
      if (!confirm(p.cve_art + ' · ' + p.descr + '\n\nNo está en esta parte. ¿Agregarlo como encontrado aquí?')) return;
      var ex = Number(p.existencia) || 0;
      var nuevo = chk(await sb().from('inv_conteo_renglones').insert({
        conteo_id: st.conteo.id, lote_id: m.lote.id, orden: m.items.length, cve_art: p.cve_art, descr: p.descr, linea: p.linea || null,
        uni_med: p.uni_med || null, ubicacion: 'ENCONTRADO EN ' + (m.items[m.idx] && m.items[m.idx].ubicacion || 'esta parte'),
        existencia_aspel: ex, costo: ex !== 0 ? (Number(p.valor) || 0) / ex : 0
      }).select('*').single());
      if (!st.renglones.find(function (r) { return r.id === nuevo.id; })) st.renglones.push(nuevo);
      m.items = renglonesDe(m.lote.id);
      irA(m.items.findIndex(function (r) { return r.id === nuevo.id; }));
    } catch (e) { toast('Error al buscar: ' + e.message); }
  }

  // ---------------------------------------------------------------- cámara (html5-qrcode, funciona en iPhone/iPad y Android)
  var _lector = null, _carga = null;
  function cargarLector() {
    if (window.Html5Qrcode) return Promise.resolve();
    if (_carga) return _carga;
    _carga = new Promise(function (ok, mal) {
      var sc = document.createElement('script');
      sc.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
      sc.onload = ok; sc.onerror = function () { _carga = null; mal(new Error('No se pudo cargar el lector de códigos')); };
      document.head.appendChild(sc);
    });
    return _carga;
  }
  async function abrirCamara() {
    var d = document.createElement('div'); d.className = 'ic-modal'; d.id = 'ic-cam-modal'; d.setAttribute('data-ui-off', ''); d.style.zIndex = 4400;
    d.innerHTML = '<div class="ic-box" style="max-width:460px"><div class="ic-top"><div><h3>Escanear código</h3><p>Apunta al código de barras o QR del producto.</p></div>' +
      '<button class="ic-btn" id="ic-cam-x">Cerrar</button></div><div id="ic-camara"></div></div>';
    document.body.appendChild(d);
    el('ic-cam-x').onclick = pararCamara;
    try {
      await cargarLector();
      _lector = new window.Html5Qrcode('ic-camara');
      await _lector.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 160 } }, function (codigo) {
        if (navigator.vibrate) navigator.vibrate(40);
        pararCamara();
        buscarCodigo(codigo);
      }, function () { });
    } catch (e) {
      el('ic-camara').innerHTML = '<div class="ic-nota">No se pudo abrir la cámara: ' + esc(e.message || e) + '. Revisa que el navegador tenga permiso de cámara, o escribe la clave.</div>';
    }
  }
  function pararCamara() {
    var d = el('ic-cam-modal');
    var l = _lector; _lector = null;
    if (l) { try { l.stop().then(function () { try { l.clear(); } catch (e) { } }).catch(function () { }); } catch (e) { } }
    if (d) d.remove();
  }

  // ================================================================ REVISIÓN (supervisor)
  function abrirRevision(loteId) {
    var l = st.lotes.find(function (x) { return x.id === loteId; }); if (!l) return;
    var d = document.createElement('div'); d.className = 'ic-modal'; d.setAttribute('data-ui-off', '');
    d.innerHTML = '<div class="ic-box"><div class="ic-top"><div><h3 id="ic-r-tit"></h3><p id="ic-r-sub"></p></div>' +
      '<button class="ic-btn" id="ic-r-x">Cerrar</button></div>' +
      '<div class="ic-chips" id="ic-r-fil"></div><div class="ic-tbl-wrap"><table class="ic-tbl"><thead><tr><th></th><th>Clave</th><th>Descripción</th><th>Ubicación</th>' +
      '<th class="ic-num">Aspel</th><th class="ic-num">Contado</th><th class="ic-num">Diferencia</th><th class="ic-num">Importe</th><th>Contó</th><th></th></tr></thead><tbody id="ic-r-body"></tbody></table></div>' +
      '<div id="ic-r-acc" style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px"></div></div>';
    document.body.appendChild(d);
    ui.revision = { nodo: d, loteId: loteId, filtro: 'dif' };
    var cerrar = function () { d.remove(); ui.revision = null; };
    el('ic-r-x').onclick = cerrar;
    d.addEventListener('click', function (e) { if (e.target === d) cerrar(); });
    pintarRevisionTabla();
  }

  function pintarRevisionTabla() {
    var R = ui.revision; if (!R) return;
    var l = st.lotes.find(function (x) { return x.id === R.loteId; });
    if (!l) { R.nodo.remove(); ui.revision = null; return; }
    var rs = renglonesDe(l.id), s = statsDe(rs), sup = esSuper(), cerrada = st.conteo.estatus === 'cerrado';
    el('ic-r-tit').innerHTML = esc(l.nombre) + ' ' + estChip(l.estatus);
    el('ic-r-sub').textContent = s.contados + ' de ' + s.total + ' contados · ' + s.dif + ' con diferencia · exactitud ' + s.exact + '% · neto ' + money(s.neto) +
      (l.tomado_por ? ' · Contó ' + corto(l.tomado_por) : '');
    var fil = [['dif', 'Con diferencia · ' + s.dif], ['sin', 'Sin contar · ' + (s.total - s.contados)], ['todos', 'Todos · ' + s.total]];
    el('ic-r-fil').innerHTML = fil.map(function (f) { return '<button class="ic-chip' + (R.filtro === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('');
    el('ic-r-fil').querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { R.filtro = b.getAttribute('data-f'); pintarRevisionTabla(); }; });
    var lista = rs.filter(function (r) {
      var dd = dif(r);
      return R.filtro === 'todos' || (R.filtro === 'dif' && ((dd != null && dd !== 0) || r.reconteo)) || (R.filtro === 'sin' && r.contado == null);
    });
    el('ic-r-body').innerHTML = lista.length ? lista.map(function (r) {
      var dd = dif(r), imp = dd == null ? null : dd * (Number(r.costo) || 0);
      return '<tr><td><span class="ic-dot" style="background:' + semaforo(r) + '"></span></td>' +
        '<td><b>' + esc(r.cve_art) + '</b></td><td>' + esc(r.descr || '') + (r.nota ? '<div style="font-size:11px;color:' + AMBER + '">📝 ' + esc(r.nota) + '</div>' : '') + '</td>' +
        '<td>' + esc(r.ubicacion || '') + '</td><td class="ic-num">' + num(r.existencia_aspel) + '</td>' +
        '<td class="ic-num"><b>' + (r.contado != null ? num(r.contado) : '—') + '</b></td>' +
        '<td class="ic-num" style="color:' + (dd == null ? '#94a3b8' : dd < 0 ? RED : dd > 0 ? GREEN : '#0f172a') + ';font-weight:800">' + (dd == null ? '—' : (dd > 0 ? '+' : '') + num(dd)) + '</td>' +
        '<td class="ic-num">' + (imp == null ? '—' : money(imp)) + '</td><td style="font-size:12px;color:#64748b">' + esc(corto(r.contado_por)) + '</td>' +
        '<td>' + (sup && !cerrada && l.estatus !== 'aprobado' ? (r.reconteo ? '<span class="ic-est" style="background:#fef3c7;color:' + AMBER + '">Reconteo pedido</span>' :
          '<button class="ic-btn warn" style="min-height:30px;padding:4px 10px;font-size:12px" data-rc="' + r.id + '">Reconteo</button>') : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="10" style="color:#64748b;padding:16px">Nada que mostrar con este filtro.</td></tr>';
    el('ic-r-body').querySelectorAll('[data-rc]').forEach(function (b) {
      b.onclick = async function () {
        b.disabled = true;
        try { chk(await sb().from('inv_conteo_renglones').update({ reconteo: true }).eq('id', b.getAttribute('data-rc'))); }
        catch (e) { alert('No se pudo: ' + e.message); b.disabled = false; }
      };
    });
    var acc = el('ic-r-acc');
    if (sup && !cerrada) {
      acc.innerHTML =
        (l.estatus === 'revision' || l.estatus === 'aprobado' ? '<button class="ic-btn warn" id="ic-r-regresa">Regresar a conteo' + (s.recon ? ' (' + s.recon + ' reconteos)' : '') + '</button>' : '') +
        (l.estatus !== 'aprobado' ? '<button class="ic-btn ok" id="ic-r-aprueba">Aprobar parte</button>' : '');
      var bR = el('ic-r-regresa'), bA = el('ic-r-aprueba');
      if (bR) bR.onclick = async function () {
        try { chk(await sb().from('inv_conteo_lotes').update({ estatus: 'contando', aprobado_por: null, aprobado_en: null, actualizado: new Date().toISOString() }).eq('id', l.id)); toast('Regresada a conteo'); }
        catch (e) { alert('No se pudo: ' + e.message); }
      };
      if (bA) bA.onclick = async function () {
        var falta = s.total - s.contados;
        if ((falta || s.recon) && !confirm((falta ? falta + ' sin contar' : '') + (falta && s.recon ? ' y ' : '') + (s.recon ? s.recon + ' en reconteo' : '') + '. ¿Aprobar de todos modos?')) return;
        try {
          chk(await sb().from('inv_conteo_lotes').update({ estatus: 'aprobado', aprobado_por: yo(), aprobado_en: new Date().toISOString(), actualizado: new Date().toISOString() }).eq('id', l.id));
          toast('Parte aprobada'); R.nodo.remove(); ui.revision = null;
        } catch (e) { alert('No se pudo: ' + e.message); }
      };
    } else acc.innerHTML = '';
  }

  // ================================================================ CIERRE
  function exportarCSV() {
    var c = st.conteo, lot = {};
    st.lotes.forEach(function (l) { lot[l.id] = l; });
    var filas = st.renglones.filter(function (r) { var d = dif(r); return d != null && d !== 0; });
    if (!filas.length) { toast('No hay diferencias que exportar'); return; }
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var head = ['Almacen', 'Clave', 'Descripcion', 'Ubicacion', 'Existencia Aspel', 'Contado', 'Diferencia', 'Costo promedio', 'Importe diferencia', 'Tipo de ajuste', 'Parte', 'Estatus parte', 'Conto', 'Nota'];
    var lineas = [head.join(',')].concat(filas.map(function (r) {
      var d = dif(r), l = lot[r.lote_id] || {};
      return [c.cve_alm, r.cve_art, r.descr, r.ubicacion, r.existencia_aspel, r.contado, d, (Number(r.costo) || 0).toFixed(4), (d * (Number(r.costo) || 0)).toFixed(2),
        d > 0 ? 'ENTRADA (sobrante)' : 'SALIDA (faltante)', l.nombre, (ESTADOS[l.estatus] || {}).t, r.contado_por, r.nota].map(q).join(',');
    }));
    var blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = ('ajustes_' + (c.nombre || 'conteo')).replace(/[^\w\-]+/g, '_') + '.csv';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  async function cerrarCampana() {
    var sinAprobar = st.lotes.filter(function (l) { return l.estatus !== 'aprobado'; }).length;
    if (!confirm((sinAprobar ? 'Hay ' + sinAprobar + ' partes sin aprobar. ' : '') + '¿Cerrar la campaña? Ya no se podrá contar ni aprobar.')) return;
    try {
      chk(await sb().from('inv_conteos').update({ estatus: 'cerrado', cerrado_por: yo(), cerrado: new Date().toISOString() }).eq('id', st.conteo.id));
      toast('Campaña cerrada. Exporta las diferencias para ajustar en Aspel.');
      pintarTablero();
    } catch (e) { alert('No se pudo cerrar: ' + e.message); }
  }

  async function borrarCampana() {
    if (!confirm('¿Eliminar "' + st.conteo.nombre + '" con todas sus partes y conteos? No se puede deshacer.')) return;
    try {
      chk(await sb().from('inv_conteos').delete().eq('id', st.conteo.id));
      toast('Campaña eliminada'); salir(); pintarLista();
    } catch (e) { alert('No se pudo eliminar: ' + e.message); }
  }

  window.InvConteos = { montar: montar, salir: salir };
})();
