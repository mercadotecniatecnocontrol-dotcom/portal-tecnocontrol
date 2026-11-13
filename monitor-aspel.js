/* ════════════════════════════════════════════════════════════════════
   monitor-aspel.js — Aviso si la sincronización con Aspel se detiene (13-nov-2026)
   ────────────────────────────────────────────────────────────────────
   El guardián de la PC de Aspel (guardian-aspel.js) escribe cada minuto en
   Supabase, tabla aspel_monitor (fila id = 'aspel-pc'). Este archivo la lee
   cada 2 minutos y, SOLO a los responsables (lista RESPONSABLES), les manda
   una notificación urgente al centro de notificaciones si:
     · el guardián lleva más de 10 min sin reportarse (PC apagada, sin
       internet, o el guardián se detuvo), o
     · algún proceso está caído, o su bitácora lleva demasiado sin moverse.
   Cuando todo vuelve a estar bien, avisa una vez en verde.
   No repite el mismo aviso más de una vez cada 30 minutos.
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.tcMonitorAspel) return;
  var RESPONSABLES = ['mercadotecniatecnocontrol@gmail.com', 'mercadotecnia@tecnocontrol.com.mx'];
  var SIN_REPORTE_MIN = 10, CADA_MS = 2 * 60 * 1000;
  var NOMBRES = { vigilante: 'Remisiones automáticas (vigilante)', aspel: 'Sincronizador Aspel', partidas: 'Sincronizador de partidas', productos: 'Sincronizador de productos' };
  var habiaFalla = false, ultimo = null;

  function yo() {
    try { var u = window.auth && window.auth.currentUser; return ((u && u.email) || '').toLowerCase(); } catch (e) { return ''; }
  }
  function cliente() { return window.tcSupabase || null; }
  function bloque30() { return Math.floor(Date.now() / (30 * 60 * 1000)); }

  function problemas(fila) {
    var lista = [];
    if (!fila) { lista.push({ clave: 'sin-fila', texto: 'El guardián de la PC de Aspel nunca se ha reportado. Revisa que esté instalado.' }); return lista; }
    var min = Math.round((Date.now() - new Date(fila.actualizado).getTime()) / 60000);
    if (min > SIN_REPORTE_MIN) {
      lista.push({ clave: 'sin-reporte', texto: 'La PC de Aspel no se reporta desde hace ' + min + ' min. Puede estar apagada, sin internet o con la sesión cerrada. Mientras tanto, los pedidos NO se marcan como remisionados.' });
      return lista;
    }
    var d = fila.datos || {};
    Object.keys(NOMBRES).forEach(function (k) {
      var p = d[k];
      if (!p) return;
      if (p.estado === 'caido' || p.estado === 'detenido') {
        lista.push({ clave: k + '-caido', texto: NOMBRES[k] + ' está detenido' + (p.ultimo_error ? ' (' + p.ultimo_error + ')' : '') + '. El guardián lo está volviendo a arrancar.' });
      } else if (p.atorado) {
        lista.push({ clave: k + '-atorado', texto: NOMBRES[k] + ' lleva más de ' + p.limite_min + ' min sin trabajar (su bitácora no avanza).' });
      } else if ((p.reinicios_ultima_hora || 0) >= 5) {
        lista.push({ clave: k + '-reinicios', texto: NOMBRES[k] + ' se ha reiniciado ' + p.reinicios_ultima_hora + ' veces en la última hora. Revisa guardian-' + k + '.errores.log en la PC de Aspel.' });
      }
    });
    return lista;
  }

  function revisar() {
    var c = cliente();
    if (!c || RESPONSABLES.indexOf(yo()) < 0 || !window.tcNotif) return;
    c.from('aspel_monitor').select('*').eq('id', 'aspel-pc').maybeSingle().then(function (r) {
      if (r.error) { console.warn('[monitor-aspel]', r.error.message); return; }
      ultimo = r.data || null;
      var lista = problemas(ultimo);
      if (lista.length) {
        habiaFalla = true;
        lista.forEach(function (p) {
          window.tcNotif.agregar({
            id: 'aspel-mon-' + p.clave + '-' + bloque30(),
            titulo: 'Sincronización con Aspel detenida',
            texto: p.texto, nivel: 'urgente', modulo: 'Aspel', grupo: 'Aspel', sinVoz: true
          });
        });
      } else if (habiaFalla) {
        habiaFalla = false;
        window.tcNotif.agregar({ id: 'aspel-mon-ok-' + Date.now(), titulo: 'Sincronización con Aspel funcionando', texto: 'Los 4 procesos de la PC de Aspel volvieron a trabajar normal.', nivel: 'normal', modulo: 'Aspel', grupo: 'Aspel', sinVoz: true });
      }
    }).catch(function (e) { console.warn('[monitor-aspel]', e && e.message); });
  }

  window.tcMonitorAspel = { revisar: revisar, estado: function () { return ultimo; } };
  setTimeout(revisar, 15000);
  setInterval(revisar, CADA_MS);
})();
