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

  // ── Geocodificación de direcciones escritas a mano (destinos "fuera del
  //    catálogo") usando Nominatim/OpenStreetMap — gratis, sin API key.
  //    Solo se usa como PUNTO DE PARTIDA: el pin siempre queda arrastrable
  //    para corregirlo si el resultado no es exacto (las direcciones libres
  //    no siempre geocodifican bien). Uso ligero y ocasional (clic manual
  //    por pedido), dentro de la política de uso justo de Nominatim. ──
  function geocodificarDireccion(direccion) {
    var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q='
      + encodeURIComponent(direccion + ', Chihuahua, México');
    return fetch(url, { headers: { 'Accept-Language': 'es' } })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (rows && rows[0]) return { lat: parseFloat(rows[0].lat), lng: parseFloat(rows[0].lon), encontrado: true };
        return { encontrado: false };
      })
      .catch(function (err) {
        console.warn('[logistica] geocodificación falló:', err);
        return { encontrado: false };
      });
  }

  // ── Estado del módulo ──
  var estado = {
    pedidos: [],       // surtidos activos con destinoTipo === 'entrega_chihuahua'
    recolecciones: [], // recolecciones_locales pendientes (ver sección "Recolección Local")
    estaciones: {},    // { estacionId: {..., id} } — catálogo indexado por id (caché de sesión)
    cargando: true,
    pinEstacionId: null,
    pinColeccion: 'estaciones_servicio', // 'estaciones_servicio' o 'recolecciones_locales' — a qué colección se guarda el pin actual
    pinOnGuardado: null, // callback opcional(lat,lng) — para módulos externos (ej. Ventas) que llaman a __logAbrirPin
    pinCampoLat: 'lat',
    pinCampoLng: 'lng',
    mapaPin: null,     // instancia Leaflet del modal de pin
    markerPin: null,
    evidenciaArchivo: null // {tipo, nombre, data} temporal mientras se llena el formulario de recolección
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
      + '.log-btn-ok:disabled{opacity:.5;cursor:not-allowed;}'
      + '.log-nueva-btn{background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:800;cursor:pointer;margin-right:8px;}'
      + '.log-recol-item{border-left:4px solid #7c3aed;}'
      + '.log-recol-item .tag{display:inline-block;background:#ede9fe;color:#5b21b6;font-size:10px;font-weight:800;border-radius:6px;padding:2px 7px;margin-bottom:3px;}'
      + '.log-prio{font-size:10px;font-weight:800;border-radius:999px;padding:4px 9px;white-space:nowrap;}'
      + '.log-prio-urgente{background:#fee2e2;color:#991b1b;}'
      + '.log-prio-alta{background:#ffedd5;color:#9a3412;}'
      + '.log-prio-normal{background:#fef9c3;color:#854d0e;}'
      + '.log-prio-programado{background:#dcfce7;color:#166534;}'
      + '.log-form-row{margin-bottom:14px;}'
      + '.log-form-row label{display:block;font-size:11.5px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;}'
      + '.log-form-row input[type=text], .log-form-row input[type=url], .log-form-row textarea, .log-form-row select{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:13.5px;font-family:inherit;box-sizing:border-box;}'
      + '.log-form-row textarea{resize:vertical;min-height:56px;}'
      + '.log-form-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;}'
      + '.log-evid-tabs{display:flex;gap:8px;margin-bottom:8px;}'
      + '.log-evid-tab{flex:1;text-align:center;padding:8px;border:1px solid #cbd5e1;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;color:#475569;background:#f8fafc;}'
      + '.log-evid-tab.active{background:#0f766e;border-color:#0f766e;color:#fff;}'
      + '.log-evid-preview{font-size:11.5px;color:#059669;margin-top:6px;font-weight:700;}'
      + '.log-required{color:#dc2626;}';
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
      var qRecolecciones = fs.query(
        fs.collection(window.db, 'recolecciones_locales'),
        fs.where('estado', '==', 'pendiente')
      );
      return Promise.all([
        fs.getDocs(qPedidos),
        fs.getDocs(fs.collection(window.db, 'estaciones_servicio')),
        fs.getDocs(qRecolecciones)
      ]).then(function (r) {
        var snapPedidos = r[0], snapEst = r[1], snapRecol = r[2];
        var ESTADOS_CERRADOS = ['finalizado', 'cancelado', 'entregado'];
        estado.pedidos = snapPedidos.docs
          .map(function (d) { return Object.assign({ id: d.id }, d.data()); })
          .filter(function (p) { return ESTADOS_CERRADOS.indexOf(p.estado) === -1; });
        var idx = {};
        snapEst.forEach(function (d) { idx[d.id] = Object.assign({ id: d.id }, d.data()); });
        estado.estaciones = idx;
        estado.recolecciones = snapRecol.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
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
      if (est) {
        if (est.lat != null && est.lng != null) { conUbicacion++; } else { sinUbicacion++; }
      } else {
        if (p.destinoLat != null && p.destinoLng != null) { conUbicacion++; } else { sinCatalogo++; }
      }
    });

    var totalRecol = estado.recolecciones.length;

    var resumen = '<div class="log-resumen">'
      + '<div class="log-chip"><b>' + total + '</b> pedidos en cola</div>'
      + '<div class="log-chip"><b>' + conUbicacion + '</b> listos para ruta (con ubicación)</div>'
      + (sinUbicacion ? '<div class="log-chip warn"><b>' + sinUbicacion + '</b> necesitan ubicación</div>' : '')
      + (sinCatalogo ? '<div class="log-chip warn"><b>' + sinCatalogo + '</b> con dirección manual sin ubicar</div>' : '')
      + (totalRecol ? '<div class="log-chip" style="background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6;"><b>' + totalRecol + '</b> recolecciones locales pendientes</div>' : '')
      + '</div>';

    if (!total && !totalRecol) {
      body.innerHTML = resumen + '<div class="log-empty">No hay pedidos ni recolecciones pendientes.</div>';
      return;
    }

    var html = resumen;

    if (totalRecol) {
      html += '<div class="log-zona"><div class="log-zona-tit">📦 Recolecciones locales · ' + totalRecol + '</div>';
      var ORDEN_PRIO = { urgente: 0, alta: 1, normal: 2, programado: 3 };
      var recolOrdenadas = estado.recolecciones.slice().sort(function (a, b) {
        return (ORDEN_PRIO[a.prioridad] != null ? ORDEN_PRIO[a.prioridad] : 9) - (ORDEN_PRIO[b.prioridad] != null ? ORDEN_PRIO[b.prioridad] : 9);
      });
      recolOrdenadas.forEach(function (r) {
        html += renderItemRecoleccion(r);
      });
      html += '</div>';
    }

    if (!total) { body.innerHTML = html; return; }

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
          if (p.destinoLat != null && p.destinoLng != null) {
            badge = '<span class="log-badge ok">📍 Ubicada</span>';
          } else {
            badge = '<button type="button" class="log-badge falta" onclick="window.__logAsignarUbicacionManual(\'' + p.id + '\')">🔍 Buscar ubicación</button>';
          }
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

  var PRIO_LABEL = { urgente: '🔴 Urgente', alta: '🟠 Alta', normal: '🟡 Normal', programado: '🟢 Programado' };

  function renderItemRecoleccion(r) {
    var prioClase = 'log-prio-' + (r.prioridad || 'normal');
    var prioTxt = PRIO_LABEL[r.prioridad] || '🟡 Normal';
    var evid = '';
    if (r.evidenciaTipo === 'liga' && r.evidenciaData) {
      evid = '<a href="' + esc(r.evidenciaData) + '" target="_blank" rel="noopener" style="font-size:11.5px;color:#0e7490;font-weight:700;">🔗 Ver liga</a>';
    } else if ((r.evidenciaTipo === 'imagen' || r.evidenciaTipo === 'documento') && r.evidenciaData) {
      evid = '<a href="' + r.evidenciaData + '" download="' + esc(r.evidenciaNombre || 'evidencia') + '" style="font-size:11.5px;color:#0e7490;font-weight:700;">📎 ' + (r.evidenciaTipo === 'imagen' ? 'Ver imagen' : 'Ver documento') + '</a>';
    }
    var badgeUbic = (r.lat != null && r.lng != null)
      ? '<span class="log-badge ok">📍 Ubicada</span>'
      : '<button type="button" class="log-badge falta" onclick="window.__logAbrirPin(\'' + r.id + '\', null, \'recolecciones_locales\')">📍 Asignar ubicación</button>';
    return '<div class="log-item log-recol-item">'
      + '<div class="info">'
      +   '<div class="tag">RECOLECCIÓN LOCAL</div>'
      +   '<div class="est">' + esc(r.lugar || '—') + '</div>'
      +   '<div class="dir">' + esc(r.direccion || '—') + '</div>'
      +   '<div class="dir">📦 ' + esc(r.materialARecoger || '—') + ' · 🕑 ' + esc(r.horario || '—') + '</div>'
      +   (r.dirigirseCon ? '<div class="dir">💁 ' + esc(r.dirigirseCon) + '</div>' : '')
      +   (r.comentario ? '<div class="dir">💬 ' + esc(r.comentario) + '</div>' : '')
      +   (evid ? '<div style="margin-top:4px;">' + evid + '</div>' : '')
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">'
      +   '<span class="log-prio ' + prioClase + '">' + prioTxt + '</span>'
      +   badgeUbic
      +   '<button type="button" class="log-badge ok" style="border:none;cursor:pointer;" onclick="window.__logCompletarRecoleccion(\'' + r.id + '\')">✔ Marcar completada</button>'
      + '</div>'
      + '</div>';
  }

  window.__logCompletarRecoleccion = function (id) {
    cargarFirestore().then(function (fs) {
      return fs.updateDoc(fs.doc(window.db, 'recolecciones_locales', id), {
        estado: 'completada',
        completadoPor: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '',
        completadoEn: new Date().toISOString()
      });
    }).then(function () {
      if (window.mostrarPush) window.mostrarPush('✔ Recolección marcada como completada', '', '✅');
      estado.recolecciones = estado.recolecciones.filter(function (r) { return r.id !== id; });
      render();
    }).catch(function (err) {
      console.error('[logistica] error completando recolección:', err);
      alert('No se pudo marcar como completada: ' + err.message);
    });
  };

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
      +     '<div style="display:flex;align-items:center;">'
      +       '<button class="log-nueva-btn" onclick="window.__logAbrirMapa()">🗺️ Ver mapa</button>'
      +       '<button class="log-nueva-btn" onclick="window.__logAbrirNuevaRecoleccion()">+ Nueva recolección local</button>'
      +       '<button class="log-x" onclick="window.__logCerrarCola()">&times;</button>'
      +     '</div>'
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

  // window.__logAbrirPin(id, onGuardado?, coleccion?)
  //   - id: id del doc (en estaciones_servicio o, si coleccion='recolecciones_locales', en esa colección).
  //   - onGuardado(lat,lng): callback OPCIONAL, para módulos externos (ej. Ventas)
  //     que necesitan reflejar la ubicación en su propia colección (ventas_clientes)
  //     además de guardarse en el catálogo maestro. Si no llama desde este módulo,
  //     igual funciona: busca el documento aunque no esté en la caché local (por si
  //     se invoca sin haber abierto antes la cola de Logística).
  //   - coleccion: 'estaciones_servicio' (default) o 'recolecciones_locales'.
  window.__logAbrirPin = function (id, onGuardado, coleccion) {
    estado.pinOnGuardado = (typeof onGuardado === 'function') ? onGuardado : null;
    estado.pinColeccion = coleccion || 'estaciones_servicio';
    estado.pinCampoLat = 'lat';
    estado.pinCampoLng = 'lng';
    var esRecoleccion = estado.pinColeccion === 'recolecciones_locales';
    var cache = esRecoleccion
      ? estado.recolecciones.find(function (r) { return r.id === id; })
      : estado.estaciones[id];

    injectStyles();
    construirModalPin();
    var modal = document.getElementById('log-pin-modal');
    modal.style.display = 'flex';
    document.getElementById('log-pin-info').innerHTML = 'Cargando…';
    document.getElementById('log-pin-msg').textContent = '';
    document.getElementById('log-pin-coords').textContent = 'Cargando mapa…';

    var pDoc = cache
      ? Promise.resolve(cache)
      : cargarFirestore().then(function (fs) {
          return fs.getDoc(fs.doc(window.db, estado.pinColeccion, id)).then(function (snap) {
            return snap.exists() ? Object.assign({ id: snap.id }, snap.data()) : null;
          });
        });

    pDoc.then(function (item) {
      if (!item) {
        document.getElementById('log-pin-info').innerHTML = 'No se encontró el registro.';
        document.getElementById('log-pin-coords').textContent = '';
        return;
      }
      if (esRecoleccion) {
        var idx = estado.recolecciones.findIndex(function (r) { return r.id === id; });
        if (idx >= 0) estado.recolecciones[idx] = item; else estado.recolecciones.push(item);
      } else {
        estado.estaciones[id] = item;
      }
      estado.pinEstacionId = id;

      document.getElementById('log-pin-info').innerHTML = esRecoleccion
        ? ('<b>📦 ' + esc(item.lugar) + '</b><br>' + esc(item.direccion))
        : ('<b>' + esc(item.razonSocial) + '</b><br>' + esc(item.direccionNormalizada));

      cargarLeaflet().then(function (L) {
        // Si ya tiene una ubicación guardada, se abre centrado ahí (permite corregir el pin);
        // si no, se centra en el municipio (o en el estado si no aplica) como punto de partida.
        var municipioRef = esRecoleccion ? '' : (item.municipio || '');
        var centro = (item.lat != null && item.lng != null)
          ? [item.lat, item.lng]
          : (CENTRO_MUNICIPIO[municipioRef.toUpperCase()] || CENTRO_ESTADO);

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
    }).catch(function (err) {
      console.error('[logistica] error buscando el registro:', err);
      document.getElementById('log-pin-info').innerHTML = 'Error al buscar el registro.';
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
    estado.pinOnGuardado = null;
    estado.pinColeccion = 'estaciones_servicio';
    estado.pinCampoLat = 'lat';
    estado.pinCampoLng = 'lng';
  };

  window.__logGuardarPin = function () {
    if (!estado.pinEstacionId || !estado.markerPin) return;
    var latlng = estado.markerPin.getLatLng();
    var coleccion = estado.pinColeccion;
    var id = estado.pinEstacionId;
    var campoLat = estado.pinCampoLat || 'lat';
    var campoLng = estado.pinCampoLng || 'lng';
    var btn = document.getElementById('log-pin-guardar');
    var msg = document.getElementById('log-pin-msg');
    btn.disabled = true;
    msg.style.color = '#0e7490';
    msg.textContent = 'Guardando…';

    var datosGuardar = {};
    datosGuardar[campoLat] = latlng.lat;
    datosGuardar[campoLng] = latlng.lng;
    datosGuardar.ubicacionCapturadaPor = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
    datosGuardar.ubicacionCapturadaEn = new Date().toISOString();

    cargarFirestore().then(function (fs) {
      return fs.updateDoc(fs.doc(window.db, coleccion, id), datosGuardar);
    }).then(function () {
      // Refleja el cambio también en la caché en memoria de este módulo.
      if (coleccion === 'recolecciones_locales') {
        var idx = estado.recolecciones.findIndex(function (r) { return r.id === id; });
        if (idx >= 0) { estado.recolecciones[idx].lat = latlng.lat; estado.recolecciones[idx].lng = latlng.lng; }
      } else if (coleccion === 'surtidos') {
        var idxP = estado.pedidos.findIndex(function (p) { return p.id === id; });
        if (idxP >= 0) { estado.pedidos[idxP][campoLat] = latlng.lat; estado.pedidos[idxP][campoLng] = latlng.lng; }
      } else if (estado.estaciones[id]) {
        estado.estaciones[id].lat = latlng.lat;
        estado.estaciones[id].lng = latlng.lng;
      }
      msg.style.color = '#059669';
      msg.textContent = '✔ Ubicación guardada.';
      if (window.mostrarPush) window.mostrarPush('📍 Ubicación guardada', '', '✅');
      var callback = estado.pinOnGuardado;
      setTimeout(function () {
        window.__logCerrarPin();
        render(); // no-op seguro si la cola de Logística no está abierta en esta pantalla
        if (typeof callback === 'function') callback(latlng.lat, latlng.lng);
      }, 500);
    }).catch(function (err) {
      console.error('[logistica] error guardando ubicación:', err);
      msg.style.color = '#dc2626';
      msg.textContent = 'No se pudo guardar. Revisa permisos de Firestore.';
      btn.disabled = false;
    });
  };

  // window.__logAsignarUbicacionManual(pedidoId)
  //   Para pedidos con destino escrito a mano (fuera del catálogo de estaciones):
  //   busca la dirección en Nominatim/OpenStreetMap y abre el pin ya centrado
  //   ahí, listo para ajustar y confirmar. Guarda en `surtidos/{pedidoId}` como
  //   destinoLat/destinoLng (no en `lat`/`lng`, para no mezclarse con otros
  //   campos del documento del pedido).
  window.__logAsignarUbicacionManual = function (pedidoId) {
    var p = estado.pedidos.find(function (x) { return x.id === pedidoId; });
    if (!p) return;

    estado.pinOnGuardado = null;
    estado.pinColeccion = 'surtidos';
    estado.pinCampoLat = 'destinoLat';
    estado.pinCampoLng = 'destinoLng';
    estado.pinEstacionId = pedidoId;

    injectStyles();
    construirModalPin();
    var modal = document.getElementById('log-pin-modal');
    modal.style.display = 'flex';
    document.getElementById('log-pin-info').innerHTML =
        '<b>' + esc(p.destinoEstacionRazonSocial || p.cliente || p.folio || 'Pedido') + '</b><br>' + esc(p.destinoDireccion || '');
    document.getElementById('log-pin-msg').textContent = '';
    document.getElementById('log-pin-coords').textContent = 'Buscando la dirección en el mapa…';

    var direccion = p.destinoDireccion || '';
    var pCentro = (p.destinoLat != null && p.destinoLng != null)
      ? Promise.resolve({ lat: p.destinoLat, lng: p.destinoLng, encontrado: true })
      : geocodificarDireccion(direccion);

    pCentro.then(function (resultado) {
      var centro = resultado.encontrado ? [resultado.lat, resultado.lng] : CENTRO_ESTADO;

      cargarLeaflet().then(function (L) {
        if (estado.mapaPin) { estado.mapaPin.remove(); estado.mapaPin = null; }
        var mapa = L.map('log-pin-mapa').setView(centro, resultado.encontrado ? 15 : 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(mapa);

        var marker = L.marker(centro, { draggable: true }).addTo(mapa);
        function actualizarTexto() {
          var latlng = marker.getLatLng();
          var base = 'Lat: ' + latlng.lat.toFixed(6) + '  ·  Lng: ' + latlng.lng.toFixed(6);
          document.getElementById('log-pin-coords').textContent = base
            + (resultado.encontrado ? '' : ' — no se encontró automáticamente esta dirección, ajusta el pin a mano');
        }
        marker.on('dragend', actualizarTexto);
        mapa.on('click', function (e) { marker.setLatLng(e.latlng); actualizarTexto(); });

        estado.mapaPin = mapa;
        estado.markerPin = marker;
        actualizarTexto();

        setTimeout(function () { mapa.invalidateSize(); }, 80);
      }).catch(function (err) {
        console.error('[logistica] error cargando Leaflet:', err);
        document.getElementById('log-pin-coords').textContent = 'No se pudo cargar el mapa. Revisa tu conexión.';
      });
    });
  };

  // =====================================================================
  //  FORMULARIO — Nueva recolección local (libre, sin depender del catálogo)
  //  Cualquier persona con acceso al portal puede registrar una recolección:
  //  lugar, dirección, horario, material, con quién y prioridad, más UNA
  //  evidencia opcional (imagen, documento o liga). Se guarda en su propia
  //  colección `recolecciones_locales` y aparece mezclada en esta misma cola.
  // =====================================================================
  var MAX_BYTES_ARCHIVO = 650 * 1024; // ~650KB crudo -> ~870KB en base64, deja margen bajo el límite de 1MB/doc de Firestore

  function construirModalNuevaRecoleccion() {
    if (document.getElementById('log-recol-modal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'log-recol-modal';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100070;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.6);';
    wrap.innerHTML =
        '<div class="log-card" style="width:640px;">'
      +   '<div class="log-head" style="background:linear-gradient(135deg,#6d28d9,#7c3aed);">'
      +     '<h3>📦 Nueva recolección local</h3>'
      +     '<button class="log-x" onclick="window.__logCerrarNuevaRecoleccion()">&times;</button>'
      +   '</div>'
      +   '<div class="log-body">'
      +     '<div class="log-form-2col">'
      +       '<div class="log-form-row"><label>📍 Lugar <span class="log-required">*</span></label><input type="text" id="log-recol-lugar" placeholder="Ej. CIMAV"></div>'
      +       '<div class="log-form-row"><label>🕑 Horario para recolección</label><input type="text" id="log-recol-horario" placeholder="Ej. 9:00am a 5pm aprox"></div>'
      +     '</div>'
      +     '<div class="log-form-row"><label>📌 Dirección <span class="log-required">*</span></label><input type="text" id="log-recol-direccion" placeholder="Dirección completa del lugar"></div>'
      +     '<div class="log-form-2col">'
      +       '<div class="log-form-row"><label>📍 Lugar para entregar el material</label><input type="text" id="log-recol-entrega" placeholder="Ej. Almacén Tecnocontrol"></div>'
      +       '<div class="log-form-row"><label>Prioridad</label><select id="log-recol-prioridad">'
      +         '<option value="urgente">🔴 Urgente</option>'
      +         '<option value="alta">🟠 Alta</option>'
      +         '<option value="normal" selected>🟡 Normal</option>'
      +         '<option value="programado">🟢 Programado</option>'
      +       '</select></div>'
      +     '</div>'
      +     '<div class="log-form-row"><label>📦 Material a recoger <span class="log-required">*</span></label><input type="text" id="log-recol-material" placeholder="Ej. 3 equipos de tierras físicas"></div>'
      +     '<div class="log-form-row"><label>💁 Dirigirse con quién</label><input type="text" id="log-recol-quien" placeholder="Ej. En caseta, lo reciben con ACUSE"></div>'
      +     '<div class="log-form-row"><label>Comentario</label><textarea id="log-recol-comentario" placeholder="Notas adicionales"></textarea></div>'
      +     '<div class="log-form-row">'
      +       '<label>Evidencia (opcional)</label>'
      +       '<div class="log-evid-tabs">'
      +         '<div class="log-evid-tab active" data-tipo="imagen" onclick="window.__logRecolCambiarTab(\'imagen\')">🖼️ Imagen</div>'
      +         '<div class="log-evid-tab" data-tipo="documento" onclick="window.__logRecolCambiarTab(\'documento\')">📄 Documento</div>'
      +         '<div class="log-evid-tab" data-tipo="liga" onclick="window.__logRecolCambiarTab(\'liga\')">🔗 Liga</div>'
      +       '</div>'
      +       '<div id="log-recol-evid-campo"></div>'
      +       '<div class="log-evid-preview" id="log-recol-evid-preview"></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="log-foot">'
      +     '<span class="log-msg" id="log-recol-msg"></span>'
      +     '<button class="log-btn log-btn-sec" onclick="window.__logCerrarNuevaRecoleccion()">Cancelar</button>'
      +     '<button class="log-btn log-btn-ok" id="log-recol-guardar" onclick="window.__logGuardarRecoleccion()">Guardar recolección</button>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(wrap);
  }

  window.__logRecolCambiarTab = function (tipo) {
    estado.evidenciaArchivo = null;
    document.getElementById('log-recol-evid-preview').textContent = '';
    var tabs = document.querySelectorAll('#log-recol-modal .log-evid-tab');
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tipo') === tipo); });
    var campo = document.getElementById('log-recol-evid-campo');
    if (tipo === 'liga') {
      campo.innerHTML = '<input type="url" id="log-recol-evid-liga" placeholder="https://…">';
    } else {
      var accept = tipo === 'imagen' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx';
      campo.innerHTML = '<input type="file" id="log-recol-evid-file" accept="' + accept + '" onchange="window.__logRecolArchivoElegido(this,\'' + tipo + '\')">';
    }
  };

  window.__logRecolArchivoElegido = function (input, tipo) {
    var preview = document.getElementById('log-recol-evid-preview');
    var file = input.files && input.files[0];
    if (!file) { estado.evidenciaArchivo = null; preview.textContent = ''; return; }
    if (file.size > MAX_BYTES_ARCHIVO) {
      preview.style.color = '#dc2626';
      preview.textContent = 'El archivo pesa ' + Math.round(file.size / 1024) + 'KB — el máximo es ' + Math.round(MAX_BYTES_ARCHIVO / 1024) + 'KB (límite de Firestore). Usa "Liga" para archivos más grandes (ej. Google Drive).';
      input.value = '';
      estado.evidenciaArchivo = null;
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      estado.evidenciaArchivo = { tipo: tipo, nombre: file.name, data: reader.result };
      preview.style.color = '#059669';
      preview.textContent = '✔ ' + file.name + ' (' + Math.round(file.size / 1024) + 'KB) listo para subir.';
    };
    reader.onerror = function () {
      preview.style.color = '#dc2626';
      preview.textContent = 'No se pudo leer el archivo.';
    };
    reader.readAsDataURL(file);
  };

  window.__logAbrirNuevaRecoleccion = function () {
    injectStyles();
    construirModalNuevaRecoleccion();
    ['log-recol-lugar', 'log-recol-horario', 'log-recol-direccion', 'log-recol-entrega', 'log-recol-material', 'log-recol-quien', 'log-recol-comentario'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.getElementById('log-recol-prioridad').value = 'normal';
    document.getElementById('log-recol-msg').textContent = '';
    estado.evidenciaArchivo = null;
    window.__logRecolCambiarTab('imagen');
    document.getElementById('log-recol-modal').style.display = 'flex';
  };

  window.__logCerrarNuevaRecoleccion = function () {
    var m = document.getElementById('log-recol-modal');
    if (m) m.style.display = 'none';
    estado.evidenciaArchivo = null;
  };

  window.__logGuardarRecoleccion = function () {
    var lugar = (document.getElementById('log-recol-lugar').value || '').trim();
    var direccion = (document.getElementById('log-recol-direccion').value || '').trim();
    var material = (document.getElementById('log-recol-material').value || '').trim();
    var msg = document.getElementById('log-recol-msg');

    if (!lugar || !direccion || !material) {
      msg.style.color = '#dc2626';
      msg.textContent = 'Lugar, dirección y material a recoger son obligatorios.';
      return;
    }

    var tabActiva = document.querySelector('#log-recol-modal .log-evid-tab.active');
    var tipoEvid = tabActiva ? tabActiva.getAttribute('data-tipo') : null;
    var evidenciaTipo = null, evidenciaData = null, evidenciaNombre = null;

    if (tipoEvid === 'liga') {
      var liga = (document.getElementById('log-recol-evid-liga').value || '').trim();
      if (liga) { evidenciaTipo = 'liga'; evidenciaData = liga; }
    } else if (estado.evidenciaArchivo) {
      evidenciaTipo = estado.evidenciaArchivo.tipo;
      evidenciaData = estado.evidenciaArchivo.data;
      evidenciaNombre = estado.evidenciaArchivo.nombre;
    }

    var data = {
      lugar: lugar,
      direccion: direccion,
      horario: (document.getElementById('log-recol-horario').value || '').trim(),
      lugarEntrega: (document.getElementById('log-recol-entrega').value || '').trim(),
      materialARecoger: material,
      dirigirseCon: (document.getElementById('log-recol-quien').value || '').trim(),
      prioridad: document.getElementById('log-recol-prioridad').value,
      comentario: (document.getElementById('log-recol-comentario').value || '').trim(),
      evidenciaTipo: evidenciaTipo,
      evidenciaData: evidenciaData,
      evidenciaNombre: evidenciaNombre,
      estado: 'pendiente',
      lat: null,
      lng: null,
      creadoPor: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '',
      creadoEn: new Date().toISOString()
    };

    var btn = document.getElementById('log-recol-guardar');
    btn.disabled = true;
    msg.style.color = '#0e7490';
    msg.textContent = 'Guardando…';

    cargarFirestore().then(function (fs) {
      return fs.addDoc(fs.collection(window.db, 'recolecciones_locales'), data);
    }).then(function (ref) {
      msg.style.color = '#059669';
      msg.textContent = '✔ Recolección registrada.';
      if (window.mostrarPush) window.mostrarPush('📦 Recolección local registrada', lugar, '✅');
      estado.recolecciones.push(Object.assign({ id: ref.id }, data));
      setTimeout(function () {
        window.__logCerrarNuevaRecoleccion();
        render();
      }, 500);
    }).catch(function (err) {
      console.error('[logistica] error guardando recolección:', err);
      msg.style.color = '#dc2626';
      msg.textContent = 'No se pudo guardar: ' + err.message;
      btn.disabled = false;
    });
  };

  // =====================================================================
  //  MAPA COMBINADO — todas las paradas que ya tienen ubicación (entregas +
  //  recolecciones), para ver de un vistazo qué se le compartiría a un
  //  repartidor. NO genera ruta ni orden de paradas todavía — es solo la
  //  vista de conjunto, paso previo a construir la ruta óptima.
  // =====================================================================
  var mapaCombinado = null;

  function construirModalMapa() {
    if (document.getElementById('log-mapa-modal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'log-mapa-modal';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100065;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.6);';
    wrap.innerHTML =
        '<div class="log-card" style="width:820px;max-width:96vw;">'
      +   '<div class="log-head" style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);">'
      +     '<h3>🗺️ Paradas listas para ruta</h3>'
      +     '<button class="log-x" onclick="window.__logCerrarMapa()">&times;</button>'
      +   '</div>'
      +   '<div class="log-body">'
      +     '<div id="log-mapa-leyenda" class="log-resumen"></div>'
      +     '<div id="log-mapa-combinado" style="width:100%;height:420px;border-radius:12px;border:1px solid #e2e8f0;"></div>'
      +     '<div id="log-mapa-vacio" class="log-empty" style="display:none;">Todavía no hay ninguna parada con ubicación asignada.</div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(wrap);
  }

  window.__logAbrirMapa = function () {
    injectStyles();
    construirModalMapa();
    document.getElementById('log-mapa-modal').style.display = 'flex';

    var entregas = estado.pedidos
      .map(function (p) { return { p: p, est: p.destinoEstacionId ? estado.estaciones[p.destinoEstacionId] : null }; })
      .filter(function (x) { return x.est && x.est.lat != null && x.est.lng != null; });

    var entregasManuales = estado.pedidos
      .filter(function (p) { return !p.destinoEstacionId && p.destinoLat != null && p.destinoLng != null; });

    var recolecciones = estado.recolecciones.filter(function (r) { return r.lat != null && r.lng != null; });

    var totalPuntos = entregas.length + entregasManuales.length + recolecciones.length;
    var leyenda = document.getElementById('log-mapa-leyenda');
    leyenda.innerHTML =
        '<div class="log-chip"><b>' + (entregas.length + entregasManuales.length) + '</b> entregas ubicadas</div>'
      + '<div class="log-chip" style="background:#f5f3ff;border-color:#ddd6fe;color:#5b21b6;"><b>' + recolecciones.length + '</b> recolecciones ubicadas</div>';

    var vacio = document.getElementById('log-mapa-vacio');
    var cont = document.getElementById('log-mapa-combinado');
    if (!totalPuntos) {
      cont.style.display = 'none';
      vacio.style.display = 'block';
      return;
    }
    cont.style.display = 'block';
    vacio.style.display = 'none';

    cargarLeaflet().then(function (L) {
      if (mapaCombinado) { mapaCombinado.remove(); mapaCombinado = null; }
      mapaCombinado = L.map('log-mapa-combinado');
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapaCombinado);

      var puntos = [];

      entregas.forEach(function (x) {
        var m = L.marker([x.est.lat, x.est.lng]).addTo(mapaCombinado);
        m.bindPopup('<b>' + esc(x.p.folio || '') + '</b><br>' + esc(x.est.razonSocial) + '<br>' + esc(x.est.direccionNormalizada));
        puntos.push([x.est.lat, x.est.lng]);
      });

      entregasManuales.forEach(function (p) {
        var m = L.marker([p.destinoLat, p.destinoLng]).addTo(mapaCombinado);
        m.bindPopup('<b>' + esc(p.folio || '') + '</b><br>' + esc(p.destinoEstacionRazonSocial || p.cliente || '') + '<br>' + esc(p.destinoDireccion || ''));
        puntos.push([p.destinoLat, p.destinoLng]);
      });

      var iconoRecoleccion = L.divIcon({
        html: '<div style="background:#7c3aed;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #7c3aed;"></div>',
        className: '', iconSize: [16, 16], iconAnchor: [8, 8]
      });
      recolecciones.forEach(function (r) {
        var m = L.marker([r.lat, r.lng], { icon: iconoRecoleccion }).addTo(mapaCombinado);
        var prioTxt = PRIO_LABEL[r.prioridad] || '🟡 Normal';
        m.bindPopup('<b>📦 ' + esc(r.lugar) + '</b><br>' + esc(r.materialARecoger) + '<br>' + prioTxt);
        puntos.push([r.lat, r.lng]);
      });

      if (puntos.length === 1) {
        mapaCombinado.setView(puntos[0], 14);
      } else {
        mapaCombinado.fitBounds(puntos, { padding: [30, 30] });
      }

      setTimeout(function () { mapaCombinado.invalidateSize(); }, 80);
    }).catch(function (err) {
      console.error('[logistica] error cargando Leaflet para el mapa combinado:', err);
    });
  };

  window.__logCerrarMapa = function () {
    var m = document.getElementById('log-mapa-modal');
    if (m) m.style.display = 'none';
  };

})();
