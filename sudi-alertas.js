/* ════════════════════════════════════════════════════════════════════
   sudi-alertas.js — Alertas de duplicidad SUDI → Portal (nov-2026)
   ────────────────────────────────────────────────────────────────────
   Lee la tabla sudi_alertas de Supabase (la llena sync_sudi_a_portal()
   cada vez que se actualiza SUDI) y avisa con el centro de
   notificaciones del portal (tcNotif):
     · Estación dada de alta dos o más veces en SUDI (mismo PL)
     · Mismo PL con distinto dueño en SUDI
     · PL repetido en el catálogo de estaciones del portal
     · Cliente repetido (mismo RFC)
     · Serie de dispensario repetida en estaciones distintas
     · SUDI sin actualizarse en más de DIAS_AVISO días
   Al dar clic en el aviso se abre la lista completa (con buscador).
   Solo avisa a los correos de DESTINATARIOS; cualquiera puede abrir la
   lista con  tcSudiAlertasAbrir()  desde la consola.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.tcSudiAlertasAbrir) return;

  var DESTINATARIOS = [
    'mercadotecniatecnocontrol@gmail.com',
    'mercadotecnia@tecnocontrol.com.mx',
    'i.ruiz@jomarverifica.com.mx'
  ];
  var DIAS_AVISO = 7;
  var REVISAR_CADA_MIN = 30;
  var NOMBRE_TIPO = {
    pl_duplicado_sudi: 'Duplicado en SUDI',
    pl_distinto_dueno: 'Mismo PL, distinto dueño',
    pl_duplicado_portal: 'PL repetido en el portal',
    cliente_duplicado: 'Cliente repetido',
    serie_repetida: 'Serie de dispensario repetida'
  };
  var alertas = [], busca = '';

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function correo() {
    try {
      var u = window.auth && window.auth.currentUser;
      return ((u && u.email) || window.TC_NOTIF_USUARIO || '').toLowerCase();
    } catch (e) { return ''; }
  }
  function sb() { return window.tcSupabase || null; }
  function vistas() { try { return JSON.parse(localStorage.getItem('tc_sudi_alertas_vistas') || '{}') || {}; } catch (e) { return {}; } }
  function guardarVistas(o) { try { localStorage.setItem('tc_sudi_alertas_vistas', JSON.stringify(o)); } catch (e) {} }

  async function cargar() {
    var c = sb(); if (!c) return null;
    var r = await c.from('sudi_alertas').select('id,tipo,clave,titulo,detalle,actualizada_en').eq('activa', true).order('titulo');
    if (r.error) { console.warn('[sudi-alertas]', r.error.message); return null; }
    alertas = r.data || [];
    return alertas;
  }

  async function revisar() {
    var yo = correo();
    if (!yo || DESTINATARIOS.indexOf(yo) < 0 || !window.tcNotif) return;
    var lista = await cargar(); if (!lista) return;
    var v = vistas(), nuevas = lista.filter(function (a) { return v[a.clave] !== a.actualizada_en; });
    if (nuevas.length) {
      window.tcNotif.agregar({
        titulo: nuevas.length === 1 ? 'Alerta de duplicidad en SUDI' : nuevas.length + ' alertas de duplicidad en SUDI',
        texto: nuevas.length === 1 ? nuevas[0].titulo : 'Hay estaciones o clientes repetidos. Clic para ver la lista y corregirlos en SUDI.',
        nivel: 'urgente', modulo: 'SUDI', grupo: 'sudi-alertas', scfi: true,
        ir: { tipo: 'fn', fn: 'tcSudiAlertasAbrir' }
      });
      nuevas.forEach(function (a) { v[a.clave] = a.actualizada_en; });
      guardarVistas(v);
    }
    // ¿Cuándo se actualizó SUDI por última vez?
    try {
      var e = await sb().from('sudi_estado').select('ultima_importacion').maybeSingle();
      var f = e.data && e.data.ultima_importacion;
      var dias = f ? Math.floor((Date.now() - new Date(f).getTime()) / 86400000) : null;
      var hoy = new Date().toISOString().slice(0, 10);
      if ((dias === null || dias >= DIAS_AVISO) && localStorage.getItem('tc_sudi_aviso_viejo') !== hoy) {
        window.tcNotif.agregar({
          titulo: 'SUDI sin actualizar',
          texto: dias === null ? 'Todavía no se ha usado el botón "Actualizar SUDI".' : 'La información de SUDI tiene ' + dias + ' días sin actualizarse. Abre SUDI y da clic en "Actualizar SUDI".',
          nivel: 'pendiente', modulo: 'SUDI', grupo: 'sudi-viejo', scfi: true,
          ir: { tipo: 'url', url: 'https://sudi.jomarverifica.com.mx/' }
        });
        localStorage.setItem('tc_sudi_aviso_viejo', hoy);
      }
    } catch (e) {}
  }

  // ── Ventana con la lista completa ──
  function pintar() {
    var cont = document.getElementById('tc-sudi-al-lista'); if (!cont) return;
    var q = busca.toLowerCase();
    var filtro = alertas.filter(function (a) { return !q || (a.titulo + ' ' + a.detalle + ' ' + (NOMBRE_TIPO[a.tipo] || '')).toLowerCase().indexOf(q) >= 0; });
    var cnt = document.getElementById('tc-sudi-al-cnt'); if (cnt) cnt.textContent = filtro.length + ' de ' + alertas.length;
    cont.innerHTML = filtro.length ? filtro.map(function (a) {
      return '<div style="border:1px solid #e2e8f0;border-left:4px solid #D85A30;border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
        '<span style="display:inline-block;font-size:10.5px;font-weight:700;color:#D85A30;background:#fdf0ea;border-radius:20px;padding:2px 8px;margin-bottom:4px">' + esc(NOMBRE_TIPO[a.tipo] || a.tipo) + '</span>' +
        '<div style="font-weight:700;font-size:13px;color:#1e293b">' + esc(a.titulo) + '</div>' +
        '<div style="font-size:12px;color:#475569;margin-top:4px">' + esc(a.detalle).split(' | ').join('<br>') + '</div></div>';
    }).join('') : '<div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px">' + (alertas.length ? 'Ninguna alerta coincide con la búsqueda.' : 'No hay duplicados. Todo en orden.') + '</div>';
  }

  window.tcSudiAlertasAbrir = async function () {
    var viejo = document.getElementById('tc-sudi-al'); if (viejo) viejo.remove();
    var fondo = document.createElement('div'); fondo.id = 'tc-sudi-al';
    fondo.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    fondo.innerHTML = '<div style="background:#fff;border-radius:14px;width:680px;max-width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 50px rgba(0,0,0,.25);font-family:Inter,Arial,sans-serif">' +
      '<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:10px">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D85A30" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>' +
        '<div style="flex:1"><div style="font-weight:800;font-size:15px;color:#1D2E73">Alertas de duplicidad SUDI</div><div style="font-size:11.5px;color:#64748b">Se corrigen en SUDI; al volver a dar "Actualizar SUDI" desaparecen solas.</div></div>' +
        '<button id="tc-sudi-al-x" title="Cerrar" style="border:0;background:none;cursor:pointer;padding:4px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>' +
      '<div style="padding:10px 18px;display:flex;gap:10px;align-items:center"><input id="tc-sudi-al-q" placeholder="Buscar por permiso, estación o cliente…" style="flex:1;border:1px solid #cbd5e1;border-radius:9px;padding:8px 11px;font-size:13px"><span id="tc-sudi-al-cnt" style="font-size:12px;color:#64748b;white-space:nowrap"></span></div>' +
      '<div id="tc-sudi-al-lista" style="padding:4px 18px 16px;overflow:auto"><div style="padding:30px;text-align:center;color:#94a3b8;font-size:13px">Cargando…</div></div></div>';
    document.body.appendChild(fondo);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) fondo.remove(); });
    document.getElementById('tc-sudi-al-x').onclick = function () { fondo.remove(); };
    var q = document.getElementById('tc-sudi-al-q'); q.value = busca; q.oninput = function () { busca = q.value; pintar(); };
    var r = await cargar();
    if (!r) { document.getElementById('tc-sudi-al-lista').innerHTML = '<div style="padding:20px;color:#A32D2D;font-size:13px">No se pudieron cargar las alertas.</div>'; return; }
    pintar();
  };

  // Arranque: espera a que haya sesión y centro de notificaciones
  var intentos = 0;
  (function esperar() {
    if (correo() && window.tcNotif && sb()) { revisar(); setInterval(revisar, REVISAR_CADA_MIN * 60000); return; }
    if (++intentos < 120) setTimeout(esperar, 1000);
  })();
})();
