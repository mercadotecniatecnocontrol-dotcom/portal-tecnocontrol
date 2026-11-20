/* ════════════════════════════════════════════════════════════════════
   importar-sudi.js — Botón "Actualizar SUDI" (nov-2026)
   ────────────────────────────────────────────────────────────────────
   Se usa desde la página de SUDI (sudi.jomarverifica.com.mx) con la
   sesión de SUDI ya iniciada. Lee TODOS los clientes, estaciones y
   dispensarios de SUDI y los manda a Supabase con la función
   sudi_importar(). Al terminar, Supabase sincroniza solo el catálogo
   del portal (estaciones_servicio / clientes_catalogo) y recalcula las
   alertas de duplicidad.

   Solo LEE en SUDI: no cambia ni borra nada allá.
   La primera vez pide el "token de importación" (sale al correr
   sync_sudi_a_portal.sql en Supabase) y lo recuerda en esa computadora.
   Para olvidarlo:  localStorage.removeItem('tc_sudi_token')
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__tcSudiImportando) { alert('La actualización de SUDI ya está corriendo.'); return; }
  if (!/jomarverifica\.com\.mx$/i.test(location.hostname)) { alert('Abre primero SUDI (sudi.jomarverifica.com.mx) con tu sesión iniciada y vuelve a dar clic en "Actualizar SUDI".'); return; }
  if (!window.jQuery) { alert('Inicia sesión en SUDI y vuelve a intentarlo.'); return; }

  var SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
  var $ = window.jQuery;

  var token = '';
  try { token = localStorage.getItem('tc_sudi_token') || ''; } catch (e) {}
  if (!token) {
    token = (prompt('Pega el token de importación de SUDI (sale en Supabase al correr sync_sudi_a_portal.sql):') || '').trim();
    if (!token) return;
    try { localStorage.setItem('tc_sudi_token', token); } catch (e) {}
  }
  window.__tcSudiImportando = true;

  // ── Ventanita de avance ──
  var caja = document.createElement('div');
  caja.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483647;width:340px;background:#fff;border:1px solid #cbd5e1;border-left:5px solid #1D2E73;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:14px 16px;font:13px/1.45 Inter,Arial,sans-serif;color:#1e293b';
  caja.innerHTML = '<div style="font-weight:800;font-size:14px;color:#1D2E73;margin-bottom:6px">Actualizando SUDI → Portal</div><div id="tc-sudi-msg">Preparando…</div><div style="height:6px;background:#e2e8f0;border-radius:4px;margin-top:10px;overflow:hidden"><div id="tc-sudi-bar" style="height:100%;width:0;background:#1D2E73;transition:width .3s"></div></div>';
  document.body.appendChild(caja);
  function msg(t, pct) { var m = document.getElementById('tc-sudi-msg'); if (m) m.innerHTML = t; if (pct != null) { var b = document.getElementById('tc-sudi-bar'); if (b) b.style.width = Math.max(0, Math.min(100, pct)) + '%'; } }
  function cerrarEn(seg) { setTimeout(function () { caja.remove(); }, seg * 1000); }

  // ── Utilidades ──
  function post(url, datos) {
    return new Promise(function (ok, mal) { $.post(url, datos).done(ok).fail(function (x) { mal(new Error('SUDI respondió ' + (x && x.status))); }); });
  }
  function parse(h) { var d = document.createElement('div'); d.innerHTML = h; d.querySelectorAll('script,style').forEach(function (x) { x.remove(); }); return d; }
  function form(h) {
    var d = document.createElement('div'); d.innerHTML = h; var o = {};
    d.querySelectorAll('input,textarea').forEach(function (e) { if (e.name) o[e.name] = (e.value || '').trim(); });
    d.querySelectorAll('select').forEach(function (s) {
      if (!s.name) return;
      var op = Array.prototype.filter.call(s.querySelectorAll('option[selected]'), function (x) { return x.value !== '-1' && x.value !== 'invalid'; });
      o[s.name] = op.length ? op[op.length - 1].textContent.trim() : '';
    });
    return o;
  }
  function v(x) { x = (x == null ? '' : String(x)).replace(/\s+/g, ' ').trim(); return x === '' ? null : x; }
  function num(x) { x = (x || '').replace(/,/g, '').trim(); return /^-?\d+(\.\d+)?$/.test(x) ? Number(x) : null; }
  function ent(x) { x = (x || '').trim(); return /^\d+$/.test(x) ? parseInt(x, 10) : null; }
  function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function pool(items, n, fn) {
    var i = 0;
    await Promise.all(Array.from({ length: n }, async function () {
      while (i < items.length) {
        var it = items[i++];
        for (var t = 0; t < 3; t++) { try { await fn(it); break; } catch (e) { if (t === 2) errores.push(String(it.sudi_id || it.id)); await espera(1200); } }
      }
    }));
  }
  async function rpc(paso, filas) {
    var r = await fetch(SB_URL + '/rest/v1/rpc/sudi_importar', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_paso: paso, p_filas: filas || [] })
    });
    var t = await r.text(); var j = null; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) {
      var m = (j && (j.message || j.hint)) || t || ('HTTP ' + r.status);
      if (/token/i.test(m)) { try { localStorage.removeItem('tc_sudi_token'); } catch (e) {} }
      throw new Error(m);
    }
    return j;
  }
  async function enviar(paso, filas, desde, hasta) {
    for (var k = 0; k < filas.length; k += 200) {
      await rpc(paso, filas.slice(k, k + 200));
      msg('Guardando ' + paso + ' en Supabase… ' + Math.min(k + 200, filas.length) + ' / ' + filas.length, desde + (hasta - desde) * Math.min(1, (k + 200) / filas.length));
    }
  }

  var errores = [];
  (async function () {
    try {
      await rpc('inicio');
      // 1) Lista de clientes (todas las páginas)
      var ids = new Set(), pag = 1, total = 1;
      do {
        msg('Leyendo lista de clientes, página ' + pag + '…', 2);
        var d = parse(await post('/_sudi_v4/_sudiEngine/_engine/list_engine.php', { folder: '_adminAssets/_scfi/_clients', current_page: pag, list_search: 1, search_data: '', search_tb: 'cli_business_name', noUpBar: 1 }));
        d.querySelectorAll('.sudi_table_row').forEach(function (r) { var id = r.getAttribute('data-item'); if (id) ids.add(id); });
        var m = (d.textContent || '').match(/P[áa]g\.\s*\d+\s*de\s*(\d+)/i); if (m) total = parseInt(m[1], 10);
        pag++;
      } while (pag <= total && pag < 100);

      // 2) Ficha de cada cliente + sus estaciones
      var clientes = [], estaciones = [], hechos = 0, cids = Array.from(ids).map(function (id) { return { id: id }; });
      await pool(cids, 4, async function (c) {
        var f = form(await post('/_sudi_v4/_sudiEngine/_engine/manage_engine.php', { folder: '_adminAssets/_scfi/_clients', id: c.id }));
        var d = parse(await post('/_adminAssets/_scfi/_clients/assets/service_stations.php', { id: c.id }));
        clientes.push({
          sudi_id: c.id, razon_social: v(f.cli_business_name), nombre_comercial: v(f.cli_tradename), rfc: v(f.cli_rfc), responsable: v(f.cli_manager),
          telefono: v(f.cli_phone), correo: v(f.cli_email), fiscal_razon_social: v(f.data_bussines_name), fiscal_nombre_comercial: v(f.data_tradename),
          fiscal_codigo: v(f.data_code), fiscal_rfc: v(f.data_rfc), forma_pago: v(f.data_pay), calle: v(f.data_street), colonia: v(f.data_cologne),
          num_ext: v(f.data_num_ext), num_int: v(f.data_num_int), cp: v(f.data_cp), estado: v(f.data_stat_id), municipio: v(f.data_town_id),
          contacto_nombre: v(f.cont_name), contacto_telefono: v(f.cont_phone), contacto_correo: v(f.cont_email), contacto_puesto: v(f.cont_job)
        });
        d.querySelectorAll('.st_row').forEach(function (r) { var id = r.getAttribute('data-item'); if (id) estaciones.push({ sudi_id: id, cliente_sudi_id: c.id }); });
        hechos++; msg('Leyendo clientes de SUDI… ' + hechos + ' / ' + cids.length, 2 + 23 * hechos / cids.length);
      });

      // 3) Ficha y dispensarios de cada estación
      var dispensarios = []; hechos = 0;
      await pool(estaciones, 4, async function (s) {
        var f = form(await post('/_sudi_v4/_sudiEngine/_engine/manage_engine.php', { folder: '_adminAssets/_scfi/_service_stations', id: s.sudi_id, client: s.cliente_sudi_id }));
        Object.assign(s, {
          numero_estacion: v(f.serv_folio), permiso_pl: v(f.serv_pl), nombre: v(f.serv_name), responsable: v(f.serv_manager), rfc: v(f.serv_rfc),
          utm_x: v(f.serv_utm_x), utm_y: v(f.serv_utm_y), latitud: v(f.serv_lat), longitud: v(f.serv_long), lat: num(f.serv_lat), lng: num(f.serv_long),
          hemisferio: v(f.serv_hemisphere), zona: v(f.serv_zona), calle: v(f.serv_street), colonia: v(f.serv_cologne), cp: v(f.serv_cp),
          estado: v(f.serv_stat_id), municipio: v(f.serv_town_id)
        });
        try {
          var d = parse(await post('/_adminAssets/_scfi/_service_stations/assets/summary.php', { id: s.sudi_id }));
          d.querySelectorAll('.summary_row').forEach(function (r) {
            var id = r.getAttribute('data-item'); if (!id) return;
            var c = Array.prototype.map.call(r.querySelectorAll('.sudi_table_cell'), function (x) { return (x.innerText || x.textContent || '').trim(); });
            dispensarios.push({ sudi_id: id, estacion_sudi_id: s.sudi_id, numero: v(c[0]), serie: v(c[1]), dgn: v(c[2]), marca: v(c[3]), modelo: v(c[4]), mangueras: ent(c[5]) });
          });
        } catch (e) { errores.push(s.sudi_id); }
        hechos++; msg('Leyendo estaciones y dispensarios… ' + hechos + ' / ' + estaciones.length, 25 + 45 * hechos / Math.max(1, estaciones.length));
      });

      // 4) Guardar en Supabase y sincronizar el portal
      await enviar('clientes', clientes, 70, 76);
      await enviar('estaciones', estaciones, 76, 84);
      await enviar('dispensarios', dispensarios, 84, 94);
      msg('Sincronizando el catálogo del portal y revisando duplicados…', 96);
      var res = await rpc('fin') || [];
      var linea = function (p) { var x = res.filter(function (r) { return r.paso.indexOf(p) === 0; })[0]; return x ? x.filas : 0; };
      msg('<b style="color:#3B6D11">Listo.</b> ' + clientes.length + ' clientes, ' + estaciones.length + ' estaciones y ' + dispensarios.length + ' dispensarios leídos de SUDI.<br>' +
          'Estaciones nuevas en el portal: <b>' + linea('estaciones nuevas') + '</b><br>' +
          'Alertas de duplicidad activas: <b style="color:' + (linea('alertas') ? '#D85A30' : '#3B6D11') + '">' + linea('alertas') + '</b> (se ven en el portal)' +
          (errores.length ? '<br><span style="color:#A32D2D">SUDI no dejó abrir ' + errores.length + ' fichas: ' + errores.slice(0, 10).join(', ') + '</span>' : ''), 100);
      cerrarEn(25);
    } catch (e) {
      msg('<b style="color:#A32D2D">No se pudo terminar:</b> ' + (e && e.message || e) + '<br>No se perdió nada; vuelve a dar clic en "Actualizar SUDI".', 100);
      cerrarEn(40);
    } finally {
      window.__tcSudiImportando = false;
    }
  })();
})();
