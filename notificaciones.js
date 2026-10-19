/* ════════════════════════════════════════════════════════════════════
   notificaciones.js — Centro de notificaciones del portal (19-oct-2026)
   ────────────────────────────────────────────────────────────────────
   Un solo sistema para TODO el portal:
     · Tarjetas abajo a la derecha, en 3 estilos (los que eligió Glen):
         normal    → borde azul, "ding" suave de 2 notas
         urgente   → borde naranja, se sacude, 3 notas (solo lo que vence)
         pendiente → borde gris, "toc" grave y corto
     · Se juntan: si llegan varias del mismo módulo seguidas, la tarjeta
       dice "3 nuevas" en vez de encimar tarjetas.
     · Clic en la notificación → te lleva directo a lo que avisa
       (la tarea, el servicio, la solicitud o el módulo).
     · Campanita (abajo a la derecha): todas las notificaciones,
       agrupadas por módulo, con "Marcar todo como leído".
   API:
     window.tcNotif.agregar({ titulo, texto, nivel, modulo, ir, grupo })
       nivel: 'normal' | 'urgente' | 'pendiente'
       ir:    { tipo:'tarea', id, area } | { tipo:'ops_folio', id } | { tipo:'ops_tab', tab }
              | { tipo:'flotilla_sol', id } | { tipo:'modulo', area } | { tipo:'url', url }
     window.mostrarPush(...) se redirige aquí (todo lo existente sigue funcionando).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.tcNotif) return;
  var MAX = 200, GRUPO_SEG = 90;
  var lista = [], panelAbierto = false, tarjetas = {};
  var ESTILO = {
    normal:    { borde: '#185FA5', icono: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>' },
    urgente:   { borde: '#D85A30', icono: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6M22 6l-3-3"/>' },
    ok:        { borde: '#3B6D11', icono: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>' },
    error:     { borde: '#A32D2D', icono: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>' },
    pendiente: { borde: '#888780', icono: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/>' }
  };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function yo() {
    try {
      var u = (window.auth && window.auth.currentUser) || (window.firebase && window.firebase.auth && window.firebase.apps && window.firebase.apps.length && window.firebase.auth().currentUser);
      return ((u && u.email) || window.TC_NOTIF_USUARIO || '').toLowerCase();
    } catch (e) { return ''; }
  }
  function clave() { return 'tc_notif_v2_' + (yo() || 'anon'); }
  function guardar() { try { localStorage.setItem(clave(), JSON.stringify(lista.slice(0, MAX))); } catch (e) {} }
  function cargar() { try { lista = JSON.parse(localStorage.getItem(clave()) || '[]') || []; } catch (e) { lista = []; } }
  function hace(iso) {
    var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'ahora'; if (m < 60) return 'hace ' + m + ' min';
    var h = Math.round(m / 60); if (h < 24) return 'hace ' + h + ' h';
    return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  // ── Sonidos (los mismos de la muestra) ──
  var _ctx = null;
  function ac() { if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)(); if (_ctx.state === 'suspended') _ctx.resume(); return _ctx; }
  function nota(f, t0, d, v, tipo) {
    try {
      var c = ac(), o = c.createOscillator(), g = c.createGain();
      o.type = tipo || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, c.currentTime + t0); g.gain.linearRampToValueAtTime(v, c.currentTime + t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + t0 + d);
      o.connect(g); g.connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + d + 0.05);
    } catch (e) {}
  }
  var SONIDO = {
    normal: function () { nota(880, 0, 0.35, 0.18); nota(1175, 0.16, 0.45, 0.15); },
    urgente: function () { [784, 988, 1319].forEach(function (f, i) { nota(f, i * 0.18, 0.3, 0.22); }); },
    pendiente: function () { nota(392, 0, 0.22, 0.16, 'triangle'); nota(523, 0.09, 0.28, 0.10); }
  };

  // ── Estilos (una sola vez) ──
  function css() {
    if (document.getElementById('tcn-css')) return;
    var s = document.createElement('style'); s.id = 'tcn-css';
    s.textContent = [
      '#tcn-pila{position:fixed;right:18px;bottom:78px;z-index:99990;display:flex;flex-direction:column-reverse;gap:8px;width:350px;max-width:calc(100vw - 28px);pointer-events:none;font-family:inherit}',
      '.tcn-card{pointer-events:auto;display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #cbd5e1;border-left:4px solid #185FA5;padding:10px 12px;box-shadow:0 8px 24px rgba(15,23,42,.16);cursor:pointer;animation:tcnIn .18s ease}',
      '.tcn-card.urgente{border:2px solid #D85A30;border-radius:8px}',
      '.tcn-card.sacude{animation:tcnSac 1.6s ease-in-out 3}',
      '.tcn-t1{font-size:13px;font-weight:700;color:#1e293b;margin:0;line-height:1.3}',
      '.tcn-t2{font-size:12px;color:#475569;margin:2px 0 0;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}',
      '.tcn-mod{font-size:10.5px;color:#64748b;margin-top:3px}',
      '.tcn-acts{display:flex;gap:6px;margin-top:8px}',
      '.tcn-acts button{font-size:12px;padding:4px 10px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;border-radius:7px;cursor:pointer;font-family:inherit}',
      '.tcn-acts button:hover{background:#f1f5f9}',
      '#tcn-campana{position:fixed;right:18px;bottom:18px;z-index:99991;width:48px;height:48px;border-radius:50%;border:none;background:#1D2E73;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(15,23,42,.28)}',
      '#tcn-badge{position:absolute;top:-3px;right:-3px;background:#E7402B;color:#fff;font-size:11px;font-weight:800;min-width:19px;height:19px;border-radius:10px;display:none;align-items:center;justify-content:center;padding:0 5px;border:2px solid #fff;box-sizing:border-box}',
      '#tcn-panel{position:fixed;right:18px;bottom:76px;z-index:99992;width:400px;max-width:calc(100vw - 28px);max-height:calc(100vh - 110px);background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 50px rgba(15,23,42,.25);display:flex;flex-direction:column;font-family:inherit}',
      '.tcn-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid #f1f5f9;cursor:pointer}',
      '.tcn-item:hover{background:#f8fafc}',
      '@keyframes tcnIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '@keyframes tcnSac{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}}',
      '@media (max-width:768px){#tcn-campana{bottom:84px}#tcn-pila{left:12px;right:12px;width:auto;bottom:' + (window.TC_NOTIF_ABAJO_MOVIL || 142) + 'px}#tcn-panel{bottom:142px}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function pila() { var p = document.getElementById('tcn-pila'); if (!p) { p = document.createElement('div'); p.id = 'tcn-pila'; document.body.appendChild(p); } return p; }
  function svg(path, color) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px">' + path + '</svg>'; }

  // ── Campanita ──
  function campana() {
    if (document.getElementById('tcn-campana') || !document.body || window.TC_NOTIF_SIN_CAMPANA) return;
    css();
    var b = document.createElement('button'); b.id = 'tcn-campana'; b.title = 'Notificaciones'; b.setAttribute('aria-label', 'Notificaciones');
    b.innerHTML = svg(ESTILO.normal.icono, '#fff') + '<span id="tcn-badge"></span>';
    b.onclick = function () { panelAbierto ? cerrarPanel() : abrirPanel(); };
    b.style.display = yo() ? 'flex' : 'none'; // en la pantalla de inicio de sesión no se muestra
    document.body.appendChild(b);
    pintarBadge();
  }
  function sinLeer() { return lista.filter(function (n) { return !n.leida; }).length; }
  function pintarBadge() { var b = document.getElementById('tcn-badge'); if (!b) return; var n = sinLeer(); b.textContent = n > 99 ? '99+' : n; b.style.display = n ? 'flex' : 'none'; }

  // ── Tarjeta en la esquina (se junta por grupo) ──
  function tarjeta(n) {
    css();
    // Se juntan las del mismo módulo y del mismo tipo (lo urgente nunca se mezcla con lo normal)
    var g = n.grupo + '|' + n.nivel, t = tarjetas[g], est = ESTILO[n.nivel] || ESTILO.normal;
    var mismas = lista.filter(function (x) { return x.grupo + '|' + x.nivel === g && !x.leida && (Date.now() - new Date(x.en).getTime()) < GRUPO_SEG * 1000; }).length;
    if (!t) {
      t = document.createElement('div');
      tarjetas[g] = t;
      pila().appendChild(t);
    }
    t.className = 'tcn-card' + (n.nivel === 'urgente' ? ' urgente sacude' : '');
    if (n.nivel !== 'urgente') t.style.borderLeftColor = est.borde;
    var titulo = mismas > 1 ? (n.modulo || 'Portal') + ' · ' + mismas + ' nuevas' : n.titulo;
    t.innerHTML = svg(est.icono, est.borde) +
      '<div style="flex:1;min-width:0">' +
      '<p class="tcn-t1">' + esc(titulo) + '</p>' +
      '<p class="tcn-t2">' + esc(mismas > 1 ? n.titulo + ': ' + (n.texto || '') : (n.texto || '')) + '</p>' +
      (n.modulo && mismas <= 1 ? '<div class="tcn-mod">' + esc(n.modulo) + ' · ahora</div>' : '') +
      '<div class="tcn-acts"><button data-a="ver">' + (mismas > 1 ? 'Ver las ' + mismas : 'Abrir') + '</button>' +
      '<button data-a="ok">' + (n.nivel === 'urgente' ? 'Ya lo vi' : n.nivel === 'pendiente' ? 'Después' : 'Entendido') + '</button></div></div>';
    t.onclick = function (ev) {
      var a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-a');
      if (a === 'ok') { ev.stopPropagation(); quitarTarjeta(g); return; }
      quitarTarjeta(g);
      if (mismas > 1) abrirPanel(n.grupo); else abrir(n.id);
    };
    // Normal y pendiente se ocultan solas a los 15 s (quedan en la campanita); urgente se queda.
    clearTimeout(t._tm);
    if (n.nivel !== 'urgente') t._tm = setTimeout(function () { quitarTarjeta(g); }, 15000);
    else {
      clearTimeout(t._rep);
      t._rep = setTimeout(function () { if (tarjetas[g]) { SONIDO.urgente(); t.classList.remove('sacude'); void t.offsetWidth; t.classList.add('sacude'); } }, 30000);
    }
  }
  function quitarTarjeta(g) { var t = tarjetas[g]; if (t) { clearTimeout(t._tm); clearTimeout(t._rep); t.remove(); delete tarjetas[g]; } }

  // ── Panel de la campanita (agrupado por módulo) ──
  function abrirPanel(soloGrupo) {
    panelAbierto = true; css();
    Object.keys(tarjetas).forEach(quitarTarjeta); // con la campanita abierta no quedan tarjetas encimadas
    var p = document.getElementById('tcn-panel'); if (!p) { p = document.createElement('div'); p.id = 'tcn-panel'; document.body.appendChild(p); }
    pintarPanel(soloGrupo);
  }
  function cerrarPanel() { panelAbierto = false; var p = document.getElementById('tcn-panel'); if (p) p.remove(); }
  function pintarPanel(soloGrupo) {
    var p = document.getElementById('tcn-panel'); if (!p) return;
    var grupos = {}, orden = [];
    lista.forEach(function (n) { var k = n.modulo || 'Portal'; if (!grupos[k]) { grupos[k] = []; orden.push(k); } grupos[k].push(n); });
    var html = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e2e8f0">' +
      '<div><div style="font-size:15px;font-weight:800;color:#1e293b">Notificaciones</div><div style="font-size:11.5px;color:#64748b">' + sinLeer() + ' sin leer · clic en una para ir a lo que avisa</div></div>' +
      '<div style="display:flex;gap:6px"><button id="tcn-leidas" style="border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:5px 9px;font-size:11.5px;cursor:pointer;font-family:inherit">Marcar todo como leído</button>' +
      '<button id="tcn-cerrar" aria-label="Cerrar" style="border:none;background:#f1f5f9;border-radius:7px;width:28px;cursor:pointer;font-size:15px">×</button></div></div>' +
      '<div style="overflow-y:auto;flex:1">';
    if (!lista.length) html += '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px">No tienes notificaciones.</div>';
    orden.forEach(function (k) {
      var items = grupos[k], nuevas = items.filter(function (n) { return !n.leida; }).length;
      var abierto = !soloGrupo || items.some(function (n) { return n.grupo === soloGrupo; });
      html += '<details ' + (abierto ? 'open' : '') + ' style="border-bottom:1px solid #e2e8f0">' +
        '<summary style="list-style:none;cursor:pointer;padding:9px 14px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center">' +
        '<b style="font-size:12.5px;color:#1e293b">' + esc(k) + '</b><span style="font-size:11.5px;color:' + (nuevas ? '#E7402B' : '#94a3b8') + ';font-weight:700">' + (nuevas ? nuevas + (nuevas === 1 ? ' nueva · ' : ' nuevas · ') : '') + items.length + '</span></summary>' +
        items.slice(0, 40).map(function (n) {
          var est = ESTILO[n.nivel] || ESTILO.normal;
          return '<div class="tcn-item" data-id="' + esc(n.id) + '" style="background:' + (n.leida ? '#fff' : '#f5f8ff') + '">' +
            '<div style="width:4px;align-self:stretch;background:' + est.borde + ';flex-shrink:0"></div>' +
            '<div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:' + (n.leida ? 600 : 800) + ';color:#1e293b">' + esc(n.titulo) + '</div>' +
            '<div style="font-size:12px;color:#475569;margin-top:2px">' + esc(n.texto || '') + '</div>' +
            '<div style="font-size:10.5px;color:#94a3b8;margin-top:3px">' + hace(n.en) + ((n.ir || (n.modulo && n.modulo !== 'Portal')) ? ' · <span style="color:#185FA5;font-weight:700">Abrir</span>' : '') + '</div></div></div>';
        }).join('') + '</details>';
    });
    html += '</div>';
    p.innerHTML = html;
    p.querySelector('#tcn-cerrar').onclick = cerrarPanel;
    p.querySelector('#tcn-leidas').onclick = function () { lista.forEach(function (n) { n.leida = true; }); guardar(); pintarBadge(); pintarPanel(); };
    Array.prototype.forEach.call(p.querySelectorAll('.tcn-item'), function (el) { el.onclick = function () { abrir(el.getAttribute('data-id')); }; });
  }

  // ── Ir a lo que avisa ──
  function botonArea(area) { return document.querySelector('.sitem[onclick*="\'' + area + '\'"]'); }
  function irArea(area) { if (area && typeof window.verArea === 'function') { try { window.verArea(area, botonArea(area)); } catch (e) {} } }
  function cuando(cond, fn, intentos) {
    intentos = intentos || 40;
    (function paso() { var ok = false; try { ok = cond(); } catch (e) {} if (ok) { try { fn(); } catch (e) { console.warn('[notif] ir:', e); } } else if (--intentos > 0) setTimeout(paso, 250); })();
  }
  function abrir(id) {
    var n = lista.filter(function (x) { return x.id === id; })[0]; if (!n) return;
    n.leida = true; guardar(); pintarBadge(); cerrarPanel();
    var ir = n.ir || (n.modulo ? { tipo: 'modulo', area: n.modulo } : null);
    if (!ir) return;
    if (ir.tipo === 'tarea') {
      var t = (window.localDB || []).filter(function (x) { return x.id === ir.id; })[0];
      irArea(ir.area || (t && t.area));
      cuando(function () { return typeof window.abrirChat === 'function'; }, function () { window.abrirChat(ir.id, (t && t.actividad) || ir.nombre || 'Tarea', ir.area || (t && t.area) || ''); });
    } else if (ir.tipo === 'ops_folio') {
      irArea('Operaciones');
      cuando(function () { return typeof window.opsAbrirPanelFolio === 'function' && document.getElementById('ops-tab-content'); }, function () { window.opsAbrirPanelFolio(ir.id); }, 60);
    } else if (ir.tipo === 'ops_tab') {
      irArea('Operaciones');
      cuando(function () { return typeof window.opsCambiarTab === 'function' && document.getElementById('ops-tab-content'); }, function () { window.opsCambiarTab(ir.tab); }, 60);
    } else if (ir.tipo === 'flotilla_sol') {
      irArea('Flotilla');
      cuando(function () { return typeof window.flVerSol === 'function'; }, function () { window.flVerSol(ir.id); }, 60);
    } else if (ir.tipo === 'fn' && typeof window[ir.fn] === 'function') {
      window[ir.fn].apply(null, ir.args || []);
    } else if (ir.tipo === 'url') {
      window.open(ir.url, '_blank', 'noopener');
    } else if (ir.tipo === 'modulo') {
      irArea(ir.area);
    }
  }

  // ── Agregar ──
  function agregar(o) {
    if (!document.body) return;
    campana();
    var n = {
      id: o.id || ('n' + Date.now() + Math.floor(Math.random() * 1000)),
      titulo: String(o.titulo || 'Notificación').replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\s*/u, ''),
      texto: o.texto || '', nivel: ESTILO[o.nivel] ? o.nivel : 'normal',
      modulo: o.modulo || 'Portal', ir: o.ir || null, en: new Date().toISOString(), leida: false
    };
    n.grupo = o.grupo || n.modulo;
    if (lista.some(function (x) { return x.id === n.id; })) return;
    lista.unshift(n); lista = lista.slice(0, MAX); guardar(); pintarBadge();
    if (panelAbierto) pintarPanel(); else tarjeta(n);
    if (!o.silencio) (SONIDO[n.nivel] || SONIDO.normal)();
    return n.id;
  }
  function nivelDe(titulo, texto, extra) {
    var t = (String(titulo) + ' ' + String(texto)).toLowerCase();
    if (extra && extra.nivel) return extra.nivel;
    if (/venc|urgente|rechaz|cancel|alarma|sin evidencia/.test(t)) return 'urgente';
    if (/pendiente|recordatorio|sin cerrar|por autorizar|por revisar/.test(t)) return 'pendiente';
    return 'normal';
  }
  function irDesdeDatos(area, d, extra) {
    if (extra && extra.tareaId) return { tipo: 'tarea', id: extra.tareaId, area: extra.area || area, nombre: extra.tareaNombre };
    d = d || {};
    if (d.folioId) return { tipo: 'ops_folio', id: d.folioId };
    var sol = d.solicitudId || d.solId || d.solicitud_id;
    if (sol && (area === 'Flotilla' || /flotilla|servicio|validada|aprobada|pag/.test(String(d.tipo || '')))) return { tipo: 'flotilla_sol', id: sol };
    return area ? { tipo: 'modulo', area: area } : null;
  }

  // ── Confirmaciones del portal (mostrarToast) con el mismo diseño ──
  window.mostrarToast = function (titulo, mensaje, icono) {
    var t = String(titulo || '') + ' ' + String(icono || '');
    aviso(mensaje, /⚠|❌|🔒|error|no se pudo|restringido/i.test(t + ' ' + mensaje) ? 'error' : /✅|guardad|listo|enviad|eliminad|🗑/i.test(t + ' ' + mensaje) ? 'ok' : 'info', titulo);
  };
  // ── Todo lo existente (mostrarPush) entra aquí ──
  window.mostrarPush = function (titulo, mensaje, icono, esMencion, extra) {
    extra = extra || {};
    var area = extra.area || '';
    agregar({
      titulo: titulo, texto: (extra.tareaNombre && !String(mensaje || '').includes(extra.tareaNombre) ? mensaje + ' · ' + extra.tareaNombre : mensaje),
      nivel: nivelDe(titulo, mensaje, extra), modulo: area || (esMencion ? 'Menciones' : 'Portal'),
      ir: irDesdeDatos(area, extra.datos, extra), grupo: extra.grupo || area || 'Portal'
    });
  };

  // ── Avisos rápidos (confirmaciones: "Guardado", "No se pudo…") con el mismo diseño ──
  // No suenan ni se guardan en la campanita; se quitan solos.
  var nAviso = 0;
  function aviso(texto, tipo, titulo) {
    if (!document.body) return;
    css();
    var t0 = String(tipo || 'info').toLowerCase();
    var est = /^(ok|exito|éxito|success|verde)$/.test(t0) ? 'ok' : /^(err|error|danger|rojo|fail)$/.test(t0) ? 'error' : /^(warn|aviso|pendiente|ambar|ámbar)$/.test(t0) ? 'pendiente' : 'normal';
    var E = ESTILO[est];
    var limpio = function (x) { return String(x == null ? '' : x).replace(/^[\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F]+\s*/u, '').trim(); };
    var tt = limpio(titulo), tx = limpio(texto);
    if (!tt) { tt = tx; tx = ''; }
    var c = document.createElement('div'), id = 'tcn-av-' + (++nAviso);
    c.className = 'tcn-card'; c.id = id; c.style.borderLeftColor = E.borde;
    c.innerHTML = svg(E.icono, E.borde) + '<div style="flex:1;min-width:0"><p class="tcn-t1">' + esc(tt) + '</p>' + (tx ? '<p class="tcn-t2">' + esc(tx) + '</p>' : '') + '</div>' +
      '<button aria-label="Cerrar" style="border:none;background:none;color:#94a3b8;font-size:16px;cursor:pointer;line-height:1;padding:0 2px">×</button>';
    c.querySelector('button').onclick = function (ev) { ev.stopPropagation(); c.remove(); };
    c.onclick = function () { c.remove(); };
    pila().appendChild(c);
    var avisos = pila().querySelectorAll('[id^="tcn-av-"]'); if (avisos.length > 3) avisos[0].remove();
    setTimeout(function () { if (c.parentNode) c.remove(); }, (tt + tx).length > 70 || est === 'error' ? 7000 : 4000);
  }

  window.tcNotif = { agregar: agregar, aviso: aviso, abrir: abrir, abrirPanel: abrirPanel, cerrarPanel: cerrarPanel };
  function iniciar() { cargar(); campana(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  // Cuando cambia el usuario (login), se cargan sus notificaciones
  var ultimo = '';
  setInterval(function () {
    var y = yo(), b = document.getElementById('tcn-campana');
    if (b) b.style.display = y ? 'flex' : 'none';
    if (y !== ultimo) { ultimo = y; cargar(); pintarBadge(); if (panelAbierto) pintarPanel(); }
  }, 2000);
})();
