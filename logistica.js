/* ============================================================================
 * logistica.js · Módulo de Logística y Rutas (Almacén)
 * ----------------------------------------------------------------------------
 * Responsabilidad ÚNICA de este primer corte: mostrar la cola de pedidos
 * pendientes con destino "Entrega en Chihuahua (estación)" agrupados por
 * zona de reparto, y permitir capturar la ubicación (lat/lng) de una
 * estación mediante un pin en un mapa — requisito previo indispensable
 * para poder generar rutas óptimas más adelante (sin coordenadas no hay
 * nada que optimizar).
 *
 * NO genera rutas todavía. NO toca el algoritmo de agrupamiento/orden de
 * paradas. Eso es el siguiente paso, una vez que haya cobertura de
 * coordenadas suficiente en las estaciones que se están usando de verdad.
 *
 * Fuente de datos:
 *   - `surtidos`            (colección REAL de Almacén, ya existente — solo
 *                             se LEE aquí, nunca se crea ni se edita)
 *   - `estaciones_servicio` (catálogo maestro compartido con Ventas — aquí
 *                             se lee Y se actualiza lat/lng cuando el
 *                             supervisor fija el pin; es la ÚNICA fuente de
 *                             dirección/ubicación, no se duplica en otra
 *                             colección)
 *
 * Depende de globals del portal: window.db, window.auth.
 * Expone: window.__logAbrirLogistica()
 * ==========================================================================*/
(function () {
  'use strict';

  // ── Firestore (SDK modular, misma versión que el resto del portal) ──
  var _fsPromise = null;
  function cargarFirestore() {
    if (_fsPromise) return _fsPromise;
    _fsPromise = import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    return _fsPromise;
  }

  // ── Leaflet: se reutiliza si el portal ya lo cargó (Ventas lo usa); si no,
  //    se carga una sola vez aquí mismo, para que este módulo no dependa de
  //    haber visitado antes la pantalla de Ventas. ──
  var _leafletPromise = null;
  function cargarLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (_leafletPromise) return _leafletPromise;
    _leafletPromise = new Promise(function (resolve, reject) {
      if (!document.getElementById('log-leaflet-css')) {
        var link = document.createElement('link');
        link.id = 'log-leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = function () { resolve(window.L); };
      script.onerror = function () { reject(new Error('No se pudo cargar Leaflet')); };
      document.head.appendChild(script);
    });
    return _leafletPromise;
  }

  // ── Centros aproximados de los municipios con más estaciones — SOLO para
  //    encuadrar la cámara del mapa al abrir el pin; no son la ubicación real
  //    de ninguna estación. El pin lo coloca el supervisor a mano. ──
  var CENTRO_MUNICIPIO = {
    'JUAREZ': [31.6904, -106.4245], 'JUÁREZ': [31.6904, -106.4245],
    'CHIHUAHUA': [28.6353, -106.0889],
    'CUAUHTEMOC': [28.4093, -106.8654], 'CUAUHTÉMOC': [28.4093, -106.8654],
    'DELICIAS': [28.1897, -105.4708],
    'HIDALGO DEL PARRAL': [26.9328, -105.6667], 'PARRAL': [26.9328, -105.6667],
    'CAMARGO': [27.6667, -105.1667],
    'NUEVO CASAS GRANDES': [30.4167, -107.9167],
    'OJINAGA': [29.5667, -104.4167],
    'MEOQUI': [28.2833, -105.4833],
    'AHUMADA': [30.6167, -106.5167],
    'JIMENEZ': [27.1333, -104.9167], 'JIMÉNEZ': [27.1333, -104.9167],
    'BOCOYNA': [27.8333, -107.6167],
    'GUACHOCHI': [26.8167, -107.0667],
    'ASCENSION': [30.9667, -107.9833], 'ASCENSIÓN': [30.9667, -107.9833],
    'CASAS GRANDES': [30.3833, -107.95],
    'GUADALUPE': [31.3667, -106.0833],
    'GUADALUPE Y CALVO': [26.1, -106.9667],
    'SAUCILLO': [28.0333, -105.2833],
    'ALDAMA': [28.85, -105.9],
    'JANOS': [30.8886, -108.1919],
    'SANTA BARBARA': [26.8, -105.8167], 'SANTA BÁRBARA': [26.8, -105.8167],
    'ALLENDE': [28.35, -105.0],
    'JULIMES': [28.4167, -105.55]
  };
  var CENTRO_ESTADO = [28.63, -106.07]; // fallback: centro aproximado del estado de Chihuahua

  // ── Estado del módulo ──
  var estado = {
    pedidos: [],       // surtidos activos con destinoTipo === 'entrega_chihuahua'
    estaciones: {},    // { estacionId: {..., id} } — catálogo indexado por id
    cargando: true,
    pinEstacionId: null,
    mapaPin: null,     // instancia Leaflet del modal de pin
    markerPin: null
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // =====================================================================
  //  ESTILOS
  // =====================================================================
  function injectStyles() {
    if (document.getElementById('log-styles')) return;
    var css = ''
      + '#log-modal{position:fixed;inset:0;z-index:100040;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);}'
      + '#log-modal.show{display:flex;}'
      + '.log-card{background:#fff;width:760px;max-width:96vw;max-height:92vh;border-radius:18px;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(2,20,50,.35);overflow:hidden;font-family:"DM Sans",system-ui,sans-serif;}'
      + '.log-head{padding:18px 22px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff;display:flex;align-items:center;justify-content:space-between;}'
      + '.log-head h3{font-size:16px;font-weight:800;letter-spacing:.3px;display:flex;align-items:center;gap:9px;}'
      + '.log-x{width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;cursor:pointer;font-size:16px;line-height:1;}'
      + '.log-body{padding:18px 22px;overflow-y:auto;}'
      + '.log-resumen{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;}'
      + '.log-chip{background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;border-radius:10px;padding:8px 14px;font-size:12.5px;font-weight:700;}'
      + '.log-chip b{font-size:15px;margin-right:4px;}'
      + '.log-chip.warn{background:#fffbeb;border-color:#fde68a;color:#92400e;}'
      + '.log-zona{margin-top:18px;}'
      + '.log-zona-tit{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;}'
      + '.log-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;border:1px solid #e2e8f0;border-radius:11px;margin-bottom:8px;background:#fff;}'
      + '.log-item .info{min-width:0;}'
      + '.log-item .folio{font-size:11.5px;font-weight:800;color:#0f766e;}'
      + '.log-item .est{font-size:13px;font-weight:700;color:#0f172a;margin-top:2px;}'
      + '.log-item .dir{font-size:11.5px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.log-badge{flex-shrink:0;font-size:10.5px;font-weight:800;padding:5px 10px;border-radius:999px;white-space:nowrap;}'
      + '.log-badge.ok{background:#d1fae5;color:#065f46;}'
      + '.log-badge.falta{background:#fef3c7;color:#92400e;cursor:pointer;border:none;}'
      + '.log-empty{text-align:center;color:#94a3b8;font-size:13px;padding:30px 0;}'
      + '#log-pin-mapa{width:100%;height:340px;border-radius:12px;margin-top:10px;border:1px solid #e2e8f0;}'
      + '.log-pin-info{font-size:12.5px;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-top:12px;}'
      + '.log-pin-info b{color:#0f172a;}'
      + '.log-pin-coords{font-size:11.5px;color:#64748b;margin-top:6px;font-family:monospace;}'
      + '.log-foot{padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end;align-items:center;}'
      + '.log-msg{margin-right:auto;font-size:12px;font-weight:700;}'
      + '.log-btn{padding:11px 20px;border:none;border-radius:11px;font-weight:800;font-size:13px;cursor:pointer;}'
      + '.log-btn-sec{background:#f1f5f9;color:#475569;}'
      + '.log-btn-ok{background:linear-gradient(135deg,#0d9488,#0f766e);color:#fff;}'
      + '.log-btn-ok:disabled{opacity:.5;cursor:not-allowed;}';
    var s = document.createElement('style');
    s.id = 'log-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // =====================================================================
  //  CARGA DE DATOS
  // =====================================================================
  function cargarDatos() {
    return cargarFirestore().then(function (fs) {
      if (!window.db) return;
      var qPedidos = fs.query(
        fs.collection(window.db, 'surtidos'),
        fs.where('destinoTipo', '==', 'entrega_chihuahua')
      );
      return Promise.all([
        fs.getDocs(qPedidos),
        fs.getDocs(fs.collection(window.db, 'estaciones_servicio'))
      ]).then(function (r) {
        var snapPedidos = r[0], snapEst = r[1];
        var ESTADOS_CERRADOS = ['finalizado', 'cancelado', 'entregado'];
        estado.pedidos = snapPedidos.docs
          .map(function (d) { return Object.assign({ id: d.id }, d.data()); })
          .filter(function (p) { return ESTADOS_CERRADOS.indexOf(p.estado) === -1; });
        var idx = {};
        snapEst.forEach(function (d) { idx[d.id] = Object.assign({ id: d.id }, d.data()); });
        estado.estaciones = idx;
        estado.cargando = false;
      });
    }).catch(function (err) {
      console.error('[logistica] error cargando datos:', err);
      estado.cargando = false;
    });
  }

  // =====================================================================
  //  RENDER — cola agrupada por zona
  // =====================================================================
  function render() {
    var body = document.getElementById('log-body-cola');
    if (!body) return;

    if (estado.cargando) {
      body.innerHTML = '<div class="log-empty">Cargando pedidos y catálogo…</div>';
      return;
    }

    var total = estado.pedidos.length;
    var conUbicacion = 0, sinUbicacion = 0, sinCatalogo = 0;
    var grupos = {}; // zona -> [ {pedido, estacion} ]

    estado.pedidos.forEach(function (p) {
      var est = p.destinoEstacionId ? estado.estaciones[p.destinoEstacionId] : null;
      var zona = est ? (est.zonaReparto || 'Sin zona asignada') : 'Fuera del catálogo (dirección manual)';
      if (!grupos[zona]) grupos[zona] = [];
      grupos[zona].push({ pedido: p, estacion: est });
      if (!est) { sinCatalogo++; }
      else if (est.lat != null && est.lng != null) { conUbicacion++; }
      else { sinUbicacion++; }
    });

    var resumen = '<div class="log-resumen">'
      + '<div class="log-chip"><b>' + total + '</b> pedidos en cola</div>'
      + '<div class="log-chip"><b>' + conUbicacion + '</b> listos para ruta (con ubicación)</div>'
      + (sinUbicacion ? '<div class="log-chip warn"><b>' + sinUbicacion + '</b> necesitan ubicación</div>' : '')
      + (sinCatalogo ? '<div class="log-chip warn"><b>' + sinCatalogo + '</b> con dirección manual (fuera del catálogo)</div>' : '')
      + '</div>';

    if (!total) {
      body.innerHTML = resumen + '<div class="log-empty">No hay pedidos pendientes con destino "Entrega en Chihuahua (estación)".</div>';
      return;
    }

    var zonasOrden = Object.keys(grupos).sort(function (a, b) {
      if (a === 'Sin zona asignada') return 1;
      if (b === 'Sin zona asignada') return -1;
      if (a === 'Fuera del catálogo (dirección manual)') return 1;
      if (b === 'Fuera del catálogo (dirección manual)') return -1;
      return a.localeCompare(b);
    });

    var html = resumen;
    zonasOrden.forEach(function (zona) {
      var items = grupos[zona];
      html += '<div class="log-zona"><div class="log-zona-tit">' + esc(zona) + ' · ' + items.length + '</div>';
      items.forEach(function (it) {
        var p = it.pedido, est = it.estacion;
        var nombre = est ? est.razonSocial : (p.destinoEstacionRazonSocial || p.cliente || '—');
        var dir = est ? est.direccionNormalizada : (p.destinoDireccion || '—');
        var badge;
        if (!est) {
          badge = '<span class="log-badge" style="background:#f1f5f9;color:#64748b;">Manual</span>';
        } else if (est.lat != null && est.lng != null) {
          badge = '<span class="log-badge ok">📍 Ubicada</span>';
        } else {
          badge = '<button type="button" class="log-badge falta" onclick="window.__logAbrirPin(\'' + est.id + '\')">📍 Asignar ubicación</button>';
        }
        html += '<div class="log-item">'
          + '<div class="info">'
          +   '<div class="folio">' + esc(p.folio || '—') + '</div>'
          +   '<div class="est">' + esc(nombre) + '</div>'
          +   '<div class="dir">' + esc(dir) + '</div>'
          + '</div>'
          + badge
          + '</div>';
      });
      html += '</div>';
    });

    body.innerHTML = html;
  }

  // =====================================================================
  //  MODAL PRINCIPAL — cola de logística
  // =====================================================================
  function construirModalCola() {
    if (document.getElementById('log-modal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'log-modal';
    wrap.innerHTML =
        '<div class="log-card">'
      +   '<div class="log-head">'
      +     '<h3>🚚 Logística — Cola de entregas (Chihuahua)</h3>'
      +     '<button class="log-x" onclick="window.__logCerrarCola()">&times;</button>'
      +   '</div>'
      +   '<div class="log-body" id="log-body-cola"></div>'
      + '</div>';
    document.body.appendChild(wrap);
  }

  window.__logAbrirLogistica = function () {
    injectStyles();
    construirModalCola();
    document.getElementById('log-modal').classList.add('show');
    estado.cargando = true;
    render();
    cargarDatos().then(render);
  };

  window.__logCerrarCola = function () {
    var m = document.getElementById('log-modal');
    if (m) m.classList.remove('show');
  };

  // =====================================================================
  //  MODAL DE PIN — capturar lat/lng de una estación arrastrando un marcador
  // =====================================================================
  function construirModalPin() {
    if (document.getElementById('log-pin-modal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'log-pin-modal';
    wrap.className = '';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100060;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.6);';
    wrap.innerHTML =
        '<div class="log-card" style="width:640px;">'
      +   '<div class="log-head" style="background:linear-gradient(135deg,#1d4ed8,#2563eb);">'
      +     '<h3>📍 Asignar ubicación</h3>'
      +     '<button class="log-x" onclick="window.__logCerrarPin()">&times;</button>'
      +   '</div>'
      +   '<div class="log-body">'
      +     '<div class="log-pin-info" id="log-pin-info"></div>'
      +     '<div id="log-pin-mapa"></div>'
      +     '<div class="log-pin-coords" id="log-pin-coords">Arrastra el pin sobre la ubicación exacta de la estación.</div>'
      +   '</div>'
      +   '<div class="log-foot">'
      +     '<span class="log-msg" id="log-pin-msg"></span>'
      +     '<button class="log-btn log-btn-sec" onclick="window.__logCerrarPin()">Cancelar</button>'
      +     '<button class="log-btn log-btn-ok" id="log-pin-guardar" onclick="window.__logGuardarPin()">Guardar ubicación</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(wrap);
  }

  window.__logAbrirPin = function (estacionId) {
    var est = estado.estaciones[estacionId];
    if (!est) return;
    estado.pinEstacionId = estacionId;

    injectStyles();
    construirModalPin();
    var modal = document.getElementById('log-pin-modal');
    modal.style.display = 'flex';

    document.getElementById('log-pin-info').innerHTML =
        '<b>' + esc(est.razonSocial) + '</b><br>' + esc(est.direccionNormalizada);
    document.getElementById('log-pin-msg').textContent = '';
    document.getElementById('log-pin-coords').textContent = 'Cargando mapa…';

    cargarLeaflet().then(function (L) {
      var centro = CENTRO_MUNICIPIO[(est.municipio || '').toUpperCase()] || CENTRO_ESTADO;

      // Si el modal se reabre, destruye el mapa anterior para no duplicar instancias Leaflet.
      if (estado.mapaPin) { estado.mapaPin.remove(); estado.mapaPin = null; }

      var mapa = L.map('log-pin-mapa').setView(centro, 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapa);

      var marker = L.marker(centro, { draggable: true }).addTo(mapa);
      marker.on('dragend', function () { actualizarCoordsTexto(marker.getLatLng()); });
      mapa.on('click', function (e) { marker.setLatLng(e.latlng); actualizarCoordsTexto(e.latlng); });

      estado.mapaPin = mapa;
      estado.markerPin = marker;
      actualizarCoordsTexto(marker.getLatLng());

      // Leaflet necesita recalcular el tamaño una vez que el contenedor ya es visible.
      setTimeout(function () { mapa.invalidateSize(); }, 80);
    }).catch(function (err) {
      console.error('[logistica] error cargando Leaflet:', err);
      document.getElementById('log-pin-coords').textContent = 'No se pudo cargar el mapa. Revisa tu conexión.';
    });
  };

  function actualizarCoordsTexto(latlng) {
    var el = document.getElementById('log-pin-coords');
    if (el) el.textContent = 'Lat: ' + latlng.lat.toFixed(6) + '  ·  Lng: ' + latlng.lng.toFixed(6);
  }

  window.__logCerrarPin = function () {
    var modal = document.getElementById('log-pin-modal');
    if (modal) modal.style.display = 'none';
    if (estado.mapaPin) { estado.mapaPin.remove(); estado.mapaPin = null; estado.markerPin = null; }
    estado.pinEstacionId = null;
  };

  window.__logGuardarPin = function () {
    if (!estado.pinEstacionId || !estado.markerPin) return;
    var latlng = estado.markerPin.getLatLng();
    var btn = document.getElementById('log-pin-guardar');
    var msg = document.getElementById('log-pin-msg');
    btn.disabled = true;
    msg.style.color = '#0e7490';
    msg.textContent = 'Guardando…';

    cargarFirestore().then(function (fs) {
      return fs.updateDoc(fs.doc(window.db, 'estaciones_servicio', estado.pinEstacionId), {
        lat: latlng.lat,
        lng: latlng.lng,
        ubicacionCapturadaPor: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '',
        ubicacionCapturadaEn: new Date().toISOString()
      });
    }).then(function () {
      // Refleja el cambio también en el catálogo en memoria de este módulo.
      if (estado.estaciones[estado.pinEstacionId]) {
        estado.estaciones[estado.pinEstacionId].lat = latlng.lat;
        estado.estaciones[estado.pinEstacionId].lng = latlng.lng;
      }
      msg.style.color = '#059669';
      msg.textContent = '✔ Ubicación guardada.';
      if (window.mostrarPush) window.mostrarPush('📍 Ubicación guardada', '', '✅');
      setTimeout(function () {
        window.__logCerrarPin();
        render();
      }, 500);
    }).catch(function (err) {
      console.error('[logistica] error guardando ubicación:', err);
      msg.style.color = '#dc2626';
      msg.textContent = 'No se pudo guardar. Revisa permisos de Firestore.';
      btn.disabled = false;
    });
  };

})();
