// ═══════════════════════════════════════════════════════════════════════
//  solicitud-cotizacion.js — Portal Operativo Tecnocontrol  (oct-2026)
// ═══════════════════════════════════════════════════════════════════════
//  "Pedir cotización" — un solo formulario para TODO el portal y la app de
//  técnicos (Flotilla). Lo cargan solos compras.js y flotilla-movil.js;
//  no hace falta agregarlo a index.html ni a flotilla-app.html.
//
//  Formas de capturar:
//    · Pegar link de producto  → trae nombre, foto, precio de referencia y
//      tienda (ayudante "leer-producto" en Supabase; si no puede, deja el
//      link guardado y pide escribir el nombre).
//    · Tomar foto / subir imagen o captura (también Ctrl+V o arrastrar).
//    · Subir PDF ya hecho → muestra sus renglones para elegir cuáles son
//      piezas; el PDF va adjunto para Compras.
//
//  Guarda en las mismas tablas de siempre (solicitudes_cotizacion vía el
//  puente compras-supabase.js). Las fotos grandes van a la tabla de fotos;
//  cada pieza lleva solo una miniatura ligera para las listas.
//
//  API global:
//    window.tcScAbrirFormulario(opciones)
//      opciones: { departamento, fijarDepto, deptos, empresas, categorias,
//                  correo, nombre, zIndex, alGuardar(id, folio) }
//    window.tcScMisCotizaciones(elemento, { correo, zIndex, alPedir })
//      Lista "Mis cotizaciones" para la app (sin precios).
//    window.tcScHistTexto(evento, vePrecios) → texto seguro del historial
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.tcScAbrirFormulario) return;

  var EMPRESAS_DEF = ['TECNOCONTROL', 'JOMAR', 'VH', 'TECNOLAB'];
  var CATS_DEF = [
    { id: 'insumo', label: 'Insumos y consumibles' },
    { id: 'servicio', label: 'Servicios' },
    { id: 'stock', label: 'Mercancía para inventario' },
  ];
  var UNIDADES = ['Pieza', 'Metro', 'Kilo', 'Litro', 'Rollo', 'Caja', 'Juego', 'Par', 'Paquete', 'Servicio'];
  var PASOS = ['Enviada', 'En cotización', 'Cotizada', 'Aprobación', 'Comprada', 'En camino', 'Recibida'];
  var MAX_PDF = 4 * 1024 * 1024;

  // ── Iconos (solo SVG) ─────────────────────────────────────────────────
  function ico(n, t) {
    t = t || 16;
    var P = {
      link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
      camara: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
      imagen: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
      pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>',
      cerrar: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      mas: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      basura: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      fuego: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.5 1 1.5 1.8 2.5 1.8z"/>',
      externo: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
      reloj: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
      chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
      atras: '<polyline points="15 18 9 12 15 6"/>',
      refrescar: '<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
      paquete: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    };
    return '<svg width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || '') + '</svg>';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function miCorreo() { return (window.auth && window.auth.currentUser && window.auth.currentUser.email || '').toLowerCase(); }
  function dinero(n) { var x = Number(n); return isFinite(x) && x > 0 ? '$' + x.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''; }
  function fecha(x, conHora) {
    if (!x) return '';
    var f = x.toDate ? x.toDate() : new Date(x); if (isNaN(f)) return '';
    return conHora ? f.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }
  function diasDesde(x) { var f = x ? new Date(x) : null; if (!f || isNaN(f)) return 0; return Math.max(0, Math.floor((Date.now() - f) / 86400000)); }

  // ── Puente a Supabase (compras-supabase.js) ───────────────────────────
  var _puente = null;
  function puente() {
    if (_puente) return _puente;
    _puente = (window.tcComprasFS ? Promise.resolve() : new Promise(function (ok, ko) {
      var s = document.createElement('script'); s.src = 'compras-supabase.js?v=sb1';
      s.onload = function () { ok(); }; s.onerror = function () { ko(new Error('No se pudo cargar compras-supabase.js')); };
      document.head.appendChild(s);
    })).then(function () { return window.tcComprasFS(null); }).catch(function (e) { _puente = null; throw e; });
    return _puente;
  }

  // ── Imágenes ──────────────────────────────────────────────────────────
  function comprimir(dataUrl, maxLado, calidad) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        var r = Math.min(1, maxLado / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
        var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
        cx.drawImage(img, 0, 0, c.width, c.height);
        try { ok(c.toDataURL('image/jpeg', calidad)); } catch (e) { ok(dataUrl); }
      };
      img.onerror = function () { ok(''); };
      img.src = dataUrl;
    });
  }
  function leerArchivo(file) {
    return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = ko; r.readAsDataURL(file); });
  }
  function fotoDesdeArchivo(file) {
    return leerArchivo(file).then(function (src) {
      return Promise.all([comprimir(src, 1100, 0.72), comprimir(src, 240, 0.66)]);
    }).then(function (r) { return { foto: r[0], miniatura: r[1] }; });
  }

  // ── Estilos (prefijo tcsc-) ───────────────────────────────────────────
  function estilos() {
    if (document.getElementById('tcsc-estilos')) return;
    var st = document.createElement('style'); st.id = 'tcsc-estilos';
    st.textContent = [
      '.tcsc-ov{position:fixed;inset:0;background:rgba(10,22,40,.55);display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto;font-family:inherit}',
      '.tcsc-pnl{background:#fff;border-radius:16px;max-width:820px;width:100%;margin:auto;box-shadow:0 20px 50px rgba(10,22,40,.25);color:#0A1628}',
      '.tcsc-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px 22px 0}',
      '.tcsc-hd h3{margin:0;font-size:19px;letter-spacing:-.2px}',
      '.tcsc-hd p{margin:4px 0 0;font-size:12.5px;color:#5C7089}',
      '.tcsc-x{background:#F1F5F9;border:none;border-radius:9px;width:34px;height:34px;cursor:pointer;color:#0A1628;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}',
      '.tcsc-bd{padding:16px 22px 22px}',
      '.tcsc-cap{background:#0A1628;border-radius:14px;padding:16px;color:#fff;margin-bottom:18px;transition:box-shadow .15s}',
      '.tcsc-cap.arrastrando{box-shadow:0 0 0 3px #1473E6}',
      '.tcsc-link{display:flex;gap:8px;margin-bottom:12px}',
      '.tcsc-link input{flex:1;min-width:0;padding:12px 13px;border-radius:10px;border:none;font-size:14px;font-family:inherit;color:#0A1628}',
      '.tcsc-link button{padding:0 16px;border-radius:10px;border:none;background:#E7402B;color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;white-space:nowrap;display:inline-flex;align-items:center;gap:6px}',
      '.tcsc-link button[disabled]{opacity:.6;cursor:default}',
      '.tcsc-modos{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}',
      '.tcsc-modo{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:11px;padding:12px 8px;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;font-family:inherit;text-align:center}',
      '.tcsc-modo:hover{background:rgba(255,255,255,.15)}',
      '.tcsc-modo span{font-weight:400;font-size:10.5px;color:#B8C4D6}',
      '.tcsc-tip{font-size:11px;color:#B8C4D6;margin:10px 0 0}',
      '.tcsc-msg{font-size:12px;border-radius:9px;padding:8px 11px;margin:10px 0 0;display:none}',
      '.tcsc-sub{display:flex;justify-content:space-between;align-items:center;margin:0 0 10px;gap:8px}',
      '.tcsc-sub b{font-size:14px}',
      '.tcsc-btn{padding:8px 12px;border-radius:9px;border:1px solid #E2E8F0;background:#fff;color:#0A1628;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit}',
      '.tcsc-btn:hover{background:#F8FAFC}',
      '.tcsc-vacio{border:1.5px dashed #CBD5E1;border-radius:12px;padding:20px;text-align:center;font-size:12.5px;color:#5C7089;margin-bottom:16px}',
      '.tcsc-pz{display:grid;grid-template-columns:92px 1fr;gap:12px;border:1px solid #E5EAF1;border-radius:12px;padding:12px;margin-bottom:10px;background:#fff}',
      '.tcsc-pz.leyendo{opacity:.6}',
      '.tcsc-foto{width:92px;height:92px;border-radius:10px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;color:#94A3B8}',
      '.tcsc-foto img{width:100%;height:100%;object-fit:cover}',
      '.tcsc-foto-acc{display:flex;gap:4px;margin-top:6px}',
      '.tcsc-foto-acc label{flex:1;display:inline-flex;align-items:center;justify-content:center;height:28px;border-radius:7px;background:#F1F5F9;color:#1D2E73;cursor:pointer}',
      '.tcsc-in{width:100%;padding:9px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;color:#0A1628}',
      '.tcsc-in:focus,.tcsc-link input:focus{outline:3px solid rgba(20,115,230,.3);outline-offset:0}',
      '.tcsc-fila{display:grid;grid-template-columns:1fr 78px 110px;gap:6px}',
      '.tcsc-ref{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:7px;font-size:11.5px;color:#5C7089}',
      '.tcsc-ref a{color:#1473E6;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:3px}',
      '.tcsc-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:#F1F5F9;color:#334155}',
      '.tcsc-mas{margin-top:7px}',
      '.tcsc-mas summary{font-size:11.5px;color:#1473E6;font-weight:700;cursor:pointer}',
      '.tcsc-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;margin-top:7px}',
      '.tcsc-quitar{background:none;border:none;color:#B91C1C;font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:0}',
      '.tcsc-gen{background:#F8FAFC;border-radius:12px;padding:14px;margin:6px 0 14px}',
      '.tcsc-gen-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:10px}',
      '.tcsc-lab{display:block;font-size:12px;font-weight:700;color:#334155;margin:0 0 5px}',
      '.tcsc-lab i{font-style:normal;font-weight:400;color:#94A3B8}',
      '.tcsc-urg{display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;cursor:pointer}',
      '.tcsc-enviar{width:100%;padding:14px;background:#0A1628;color:#fff;border:none;border-radius:11px;font-weight:800;font-size:14.5px;cursor:pointer;font-family:inherit}',
      '.tcsc-enviar[disabled]{opacity:.6;cursor:default}',
      '.tcsc-err{display:none;color:#B91C1C;font-size:12.5px;font-weight:700;margin:0 0 10px}',
      '.tcsc-adj{display:flex;align-items:center;gap:8px;background:#EEF4FF;border-radius:10px;padding:9px 12px;font-size:12px;margin-bottom:12px;color:#1D2E73}',
      '.tcsc-renglon{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #F1F5F9;font-size:12.5px;cursor:pointer}',
      '.tcsc-renglon input[type=number]{width:62px}',
      // Mis cotizaciones (app)
      '.tcsc-lista-card{display:grid;grid-template-columns:56px 1fr;gap:10px;background:#fff;border:1px solid #E5EAF1;border-left:4px solid var(--c);border-radius:12px;padding:10px;margin-bottom:8px;cursor:pointer}',
      '.tcsc-mini{width:56px;height:56px;border-radius:9px;background:#F1F5F9;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#94A3B8}',
      '.tcsc-mini img{width:100%;height:100%;object-fit:cover}',
      '.tcsc-barra{display:flex;gap:3px;margin-top:6px}',
      '.tcsc-barra div{flex:1;height:5px;border-radius:3px}',
      '.tcsc-pasos{display:flex;align-items:flex-start;margin:6px 0 14px;overflow-x:auto;padding-bottom:4px}',
      '.tcsc-paso{flex:1;min-width:52px;text-align:center}',
      '.tcsc-paso i{width:22px;height:22px;border-radius:50%;font-size:10.5px;font-weight:800;font-style:normal;display:flex;align-items:center;justify-content:center;margin:0 auto 4px}',
      '.tcsc-paso span{font-size:9.5px;font-weight:700}',
      '@media (max-width:600px){.tcsc-ov{padding:0}.tcsc-pnl{border-radius:0;min-height:100%}.tcsc-modos{grid-template-columns:1fr 1fr 1fr}.tcsc-pz{grid-template-columns:72px 1fr}.tcsc-foto{width:72px;height:72px}.tcsc-fila{grid-template-columns:1fr 64px}.tcsc-fila select{grid-column:1 / -1}}',
      '@media (prefers-reduced-motion:reduce){.tcsc-cap{transition:none}}',
    ].join('');
    document.head.appendChild(st);
  }

  // ══════════════════════════════════════════════════════════════════
  //  LEER LINK (ayudante en Supabase)
  // ══════════════════════════════════════════════════════════════════
  function esBusquedaGoogle(u) {
    try { var x = new URL(u); return /(^|\.)google\./.test(x.hostname) && /^\/(search|shopping)/.test(x.pathname); } catch (e) { return false; }
  }
  function leerLink(url) {
    return puente().then(function () {
      if (!window.tcSupabase || !window.tcSupabase.functions) throw new Error('sin-cliente');
      return window.tcSupabase.functions.invoke('leer-producto', { body: { url: url, conImagen: true } });
    }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {};
      if (!d.ok || !d.titulo) throw new Error(d.error || 'sin-datos');
      return d;
    });
  }

  // ══════════════════════════════════════════════════════════════════
  //  LEER PDF (renglones de texto, en el navegador, gratis)
  // ══════════════════════════════════════════════════════════════════
  var _pdfjs = null;
  function cargarPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_pdfjs) return _pdfjs;
    _pdfjs = new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        ok(window.pdfjsLib);
      };
      s.onerror = function () { _pdfjs = null; ko(new Error('No se pudo cargar el lector de PDF')); };
      document.head.appendChild(s);
    });
    return _pdfjs;
  }
  var RE_UNI = '(pzas?|piezas?|pz|pza\\.?|m|mts?|metros?|kg|kilos?|l|lts?|litros?|rollos?|cajas?|juegos?|pares?|paq|paquetes?)';
  function interpretarRenglon(t) {
    var m = t.match(new RegExp('^(\\d+(?:[.,]\\d+)?)\\s*' + RE_UNI + '?\\.?\\s+(.{3,})$', 'i'));
    if (m) return { cant: Number(m[1].replace(',', '.')), unidad: unidadDe(m[2]), desc: m[3].trim(), conCantidad: true };
    m = t.match(new RegExp('^(.{3,}?)\\s+(\\d+(?:[.,]\\d+)?)(?:\\s+' + RE_UNI + '\\.?)?$', 'i'));
    if (m && !/\$/.test(m[1])) return { cant: Number(m[2].replace(',', '.')), unidad: unidadDe(m[3]), desc: m[1].trim(), conCantidad: true };
    return { cant: 1, unidad: 'Pieza', desc: t, conCantidad: false };
  }
  function unidadDe(u) {
    u = String(u || '').toLowerCase();
    if (!u) return 'Pieza';
    if (/^m|^mt|^metro/.test(u)) return 'Metro';
    if (/^kg|^kilo/.test(u)) return 'Kilo';
    if (/^l|^lt|^litro/.test(u)) return 'Litro';
    if (/^rollo/.test(u)) return 'Rollo';
    if (/^caja/.test(u)) return 'Caja';
    if (/^juego/.test(u)) return 'Juego';
    if (/^par/.test(u)) return 'Par';
    if (/^paq/.test(u)) return 'Paquete';
    return 'Pieza';
  }
  function renglonesDePdf(dataUrl) {
    return cargarPdfJs().then(function (pdfjs) {
      var bin = atob(dataUrl.split(',')[1]); var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return pdfjs.getDocument({ data: arr }).promise;
    }).then(function (doc) {
      var paginas = [];
      for (var p = 1; p <= Math.min(doc.numPages, 10); p++) paginas.push(p);
      return Promise.all(paginas.map(function (n) { return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }); }));
    }).then(function (contenidos) {
      var lineas = [];
      contenidos.forEach(function (tc) {
        var porY = {};
        tc.items.forEach(function (it) {
          var y = Math.round(it.transform[5] / 3) * 3;
          (porY[y] = porY[y] || []).push({ x: it.transform[4], s: it.str });
        });
        Object.keys(porY).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
          var t = porY[y].sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s; }).join(' ').replace(/\s+/g, ' ').trim();
          if (t.length >= 3) lineas.push(t);
        });
      });
      return lineas;
    });
  }

  // ══════════════════════════════════════════════════════════════════
  //  FORMULARIO "PEDIR COTIZACIÓN"
  // ══════════════════════════════════════════════════════════════════
  var F = null; // estado del formulario abierto
  function nuevaPieza(base) {
    return Object.assign({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), desc: '', cant: 1, unidad: 'Pieza',
      marca: '', modelo: '', numeroParte: '', especificaciones: '', link: '', precioRef: null, monedaRef: '', tiendaRef: '',
      miniatura: '', foto: '', origenCaptura: 'manual', leyendo: false, aviso: '' }, base || {});
  }

  window.tcScAbrirFormulario = function (op) {
    op = op || {};
    estilos();
    cerrarFormulario();
    F = { op: op, piezas: [], pdf: null };
    var deptos = op.deptos && op.deptos.length ? op.deptos : [op.departamento || 'Operaciones'];
    var empresas = op.empresas && op.empresas.length ? op.empresas : EMPRESAS_DEF;
    var cats = op.categorias && op.categorias.length ? op.categorias : CATS_DEF;
    var depto = op.departamento || '';
    var deptoHTML = (op.fijarDepto || (depto && depto !== 'Compras'))
      ? '<input type="hidden" id="tcsc-depto" value="' + esc(depto) + '"><p style="margin:0;font-size:13px;font-weight:700;padding:9px 0">' + esc(depto) + '</p>'
      : '<select id="tcsc-depto" class="tcsc-in">' + deptos.map(function (d) { return '<option' + (d === 'Ventas' ? ' selected' : '') + '>' + esc(d) + '</option>'; }).join('') + '</select>';

    var ov = document.createElement('div');
    ov.className = 'tcsc-ov'; ov.id = 'tcsc-form'; ov.style.zIndex = String(op.zIndex || 2400);
    ov.innerHTML =
      '<div class="tcsc-pnl" role="dialog" aria-modal="true" aria-labelledby="tcsc-tit">' +
        '<div class="tcsc-hd"><div><h3 id="tcsc-tit">Pedir cotización</h3><p>Pega el link del producto, toma una foto o sube un PDF. Tú solo revisas y lo mandas a Compras.</p></div>' +
        '<button type="button" class="tcsc-x" aria-label="Cerrar" onclick="window.__tcscCerrar()">' + ico('cerrar') + '</button></div>' +
        '<div class="tcsc-bd">' +
          '<div class="tcsc-cap" id="tcsc-cap">' +
            '<div class="tcsc-link"><input id="tcsc-link" type="url" inputmode="url" placeholder="Pega aquí el link del producto (MercadoLibre, Steren, Home Depot…)" aria-label="Link del producto" onkeydown="if(event.key===\'Enter\'){event.preventDefault();window.__tcscTraerLink()}">' +
            '<button type="button" id="tcsc-link-btn" onclick="window.__tcscTraerLink()">' + ico('link', 15) + 'Traer datos</button></div>' +
            '<div class="tcsc-modos">' +
              '<label class="tcsc-modo">' + ico('camara', 22) + 'Tomar foto<span>Con la cámara</span><input type="file" accept="image/*" capture="environment" style="display:none" onchange="window.__tcscFotosNuevas(this)"></label>' +
              '<label class="tcsc-modo">' + ico('imagen', 22) + 'Imagen o captura<span>De tu galería o equipo</span><input type="file" accept="image/*" multiple style="display:none" onchange="window.__tcscFotosNuevas(this)"></label>' +
              '<label class="tcsc-modo">' + ico('pdf', 22) + 'Subir PDF<span>Una lista ya hecha</span><input type="file" accept="application/pdf" style="display:none" onchange="window.__tcscPdf(this)"></label>' +
            '</div>' +
            '<p class="tcsc-tip">En computadora también puedes pegar una captura con Ctrl+V o arrastrar archivos aquí.</p>' +
            '<p class="tcsc-msg" id="tcsc-cap-msg" role="status"></p>' +
          '</div>' +
          '<div class="tcsc-sub"><b id="tcsc-n">Piezas</b><button type="button" class="tcsc-btn" onclick="window.__tcscAgregar()">' + ico('mas', 14) + 'Escribir a mano</button></div>' +
          '<div id="tcsc-piezas"></div>' +
          '<div id="tcsc-adj"></div>' +
          '<div class="tcsc-gen">' +
            '<div class="tcsc-gen-g">' +
              '<div><label class="tcsc-lab" for="tcsc-empresa">Empresa</label><select id="tcsc-empresa" class="tcsc-in">' + empresas.map(function (e) { return '<option>' + esc(e) + '</option>'; }).join('') + '</select></div>' +
              '<div><label class="tcsc-lab">Departamento que pide</label>' + deptoHTML + '</div>' +
              '<div><label class="tcsc-lab" for="tcsc-tipo">Tipo de compra</label><select id="tcsc-tipo" class="tcsc-in">' + cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === 'insumo' ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') + '</select></div>' +
            '</div>' +
            '<div class="tcsc-gen-g">' +
              '<div><label class="tcsc-lab" for="tcsc-uso">¿Para qué se necesita? <i>(obra, cliente o uso)</i></label><input id="tcsc-uso" class="tcsc-in" placeholder="Ej. Mantenimiento estación Las Torres"></div>' +
              '<div><label class="tcsc-lab" for="tcsc-fecha">¿Para cuándo?</label><input id="tcsc-fecha" type="date" class="tcsc-in" onchange="window.__tcscUrgencia()"></div>' +
            '</div>' +
            '<label class="tcsc-urg"><input type="checkbox" id="tcsc-urgente" onchange="window.__tcscUrgencia()"><span style="display:inline-flex;align-items:center;gap:5px;color:#B91C1C">' + ico('fuego', 14) + 'Es urgente</span></label>' +
            '<p id="tcsc-urg-ayuda" style="font-size:11px;color:#5C7089;margin:4px 0 0">Se marca sola si la necesitas en 3 días o menos.</p>' +
            '<textarea id="tcsc-urg-motivo" rows="2" class="tcsc-in" style="margin-top:8px;display:none" placeholder="¿Por qué es urgente?"></textarea>' +
            '<label class="tcsc-lab" for="tcsc-notas" style="margin-top:12px">Notas para Compras <i>(opcional)</i></label>' +
            '<textarea id="tcsc-notas" rows="2" class="tcsc-in" placeholder="Marcas preferidas, si acepta equivalentes, etc."></textarea>' +
          '</div>' +
          '<p class="tcsc-err" id="tcsc-err" role="alert"></p>' +
          '<button type="button" class="tcsc-enviar" id="tcsc-enviar" onclick="window.__tcscEnviar()">Mandar a Compras</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov) window.__tcscCerrar(); });

    // Arrastrar y soltar
    var cap = document.getElementById('tcsc-cap');
    ['dragenter', 'dragover'].forEach(function (ev) { cap.addEventListener(ev, function (e) { e.preventDefault(); cap.classList.add('arrastrando'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { cap.addEventListener(ev, function (e) { e.preventDefault(); cap.classList.remove('arrastrando'); }); });
    cap.addEventListener('drop', function (e) { manejarArchivos(e.dataTransfer && e.dataTransfer.files); });
    document.addEventListener('paste', alPegar);
    pintarPiezas();
    setTimeout(function () { var l = document.getElementById('tcsc-link'); if (l && window.innerWidth > 640) l.focus(); }, 60);
  };

  function cerrarFormulario() {
    var v = document.getElementById('tcsc-form'); if (v) v.remove();
    document.removeEventListener('paste', alPegar);
    F = null;
  }
  window.__tcscCerrar = function () {
    if (F && F.piezas.some(function (p) { return p.desc || p.foto; }) && !confirm('¿Cerrar sin mandar? Se perderá lo que capturaste.')) return;
    cerrarFormulario();
  };

  function avisoCaptura(texto, tipo) {
    var m = document.getElementById('tcsc-cap-msg'); if (!m) return;
    if (!texto) { m.style.display = 'none'; return; }
    var c = { ok: ['#DCFCE7', '#14532D'], error: ['#FEE2E2', '#991B1B'], info: ['rgba(255,255,255,.12)', '#fff'] }[tipo || 'info'];
    m.style.background = c[0]; m.style.color = c[1]; m.textContent = texto; m.style.display = 'block';
  }

  function alPegar(e) {
    if (!F || !e.clipboardData) return;
    var archivos = Array.prototype.filter.call(e.clipboardData.files || [], function (f) { return /^image\//.test(f.type) || f.type === 'application/pdf'; });
    if (archivos.length) { e.preventDefault(); manejarArchivos(archivos); return; }
    var t = (e.clipboardData.getData('text') || '').trim();
    var enCampo = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.id !== 'tcsc-link';
    if (/^https?:\/\/\S+$/i.test(t) && !enCampo) {
      e.preventDefault();
      var l = document.getElementById('tcsc-link'); if (l) { l.value = t; window.__tcscTraerLink(); }
    }
  }
  function manejarArchivos(lista) {
    Array.prototype.forEach.call(lista || [], function (f) {
      if (f.type === 'application/pdf') procesarPdf(f);
      else if (/^image\//.test(f.type)) agregarFoto(f, null);
    });
  }

  // ── Piezas ────────────────────────────────────────────────────────────
  function pintarPiezas() {
    var c = document.getElementById('tcsc-piezas'); if (!c || !F) return;
    var n = document.getElementById('tcsc-n'); if (n) n.textContent = F.piezas.length ? 'Piezas (' + F.piezas.length + ')' : 'Piezas';
    if (!F.piezas.length) {
      c.innerHTML = '<div class="tcsc-vacio">Aún no hay piezas. Usa una de las opciones de arriba, o escribe a mano lo que necesitas.</div>';
      return;
    }
    c.innerHTML = F.piezas.map(function (p, i) {
      var ref = [];
      if (p.tiendaRef) ref.push('<span class="tcsc-chip">' + esc(p.tiendaRef) + '</span>');
      if (p.precioRef) ref.push('<span class="tcsc-chip">Precio visto: ' + esc(dinero(p.precioRef)) + (p.monedaRef && p.monedaRef !== 'MXN' ? ' ' + esc(p.monedaRef) : '') + '</span>');
      if (p.link) ref.push('<a href="' + esc(p.link) + '" target="_blank" rel="noopener">' + ico('externo', 12) + 'Ver producto</a>');
      return '<div class="tcsc-pz' + (p.leyendo ? ' leyendo' : '') + '" data-i="' + i + '">' +
        '<div><div class="tcsc-foto">' + (p.miniatura ? '<img src="' + p.miniatura + '" alt="Foto de ' + esc(p.desc || 'la pieza') + '">' : ico('imagen', 26)) + '</div>' +
          '<div class="tcsc-foto-acc">' +
            '<label title="Tomar foto" aria-label="Tomar foto">' + ico('camara', 14) + '<input type="file" accept="image/*" capture="environment" style="display:none" onchange="window.__tcscFotoPieza(' + i + ',this)"></label>' +
            '<label title="Subir imagen" aria-label="Subir imagen">' + ico('imagen', 14) + '<input type="file" accept="image/*" style="display:none" onchange="window.__tcscFotoPieza(' + i + ',this)"></label>' +
          '</div></div>' +
        '<div style="min-width:0">' +
          (p.leyendo ? '<p style="margin:0 0 6px;font-size:12px;color:#1473E6;font-weight:700">Leyendo la página del producto…</p>' : '') +
          (p.aviso ? '<p style="margin:0 0 6px;font-size:11.5px;color:#B45309;font-weight:700">' + esc(p.aviso) + '</p>' : '') +
          '<div class="tcsc-fila">' +
            '<input class="tcsc-in" placeholder="¿Qué es? Ej. Nivel láser 2 líneas" value="' + esc(p.desc) + '" oninput="window.__tcscCampo(' + i + ',\'desc\',this.value)" aria-label="Nombre de la pieza">' +
            '<input class="tcsc-in" type="number" min="0" step="any" value="' + esc(p.cant) + '" oninput="window.__tcscCampo(' + i + ',\'cant\',this.value)" aria-label="Cantidad">' +
            '<select class="tcsc-in" onchange="window.__tcscCampo(' + i + ',\'unidad\',this.value)" aria-label="Unidad">' + UNIDADES.map(function (u) { return '<option' + (u === p.unidad ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select>' +
          '</div>' +
          (ref.length ? '<div class="tcsc-ref">' + ref.join('') + '</div>' : '') +
          '<details class="tcsc-mas"' + (p.marca || p.modelo || p.numeroParte || p.especificaciones ? ' open' : '') + '><summary>Medida, marca, modelo o número de parte</summary>' +
            '<div class="tcsc-grid3">' +
              '<input class="tcsc-in" placeholder="Marca" value="' + esc(p.marca) + '" oninput="window.__tcscCampo(' + i + ',\'marca\',this.value)">' +
              '<input class="tcsc-in" placeholder="Modelo" value="' + esc(p.modelo) + '" oninput="window.__tcscCampo(' + i + ',\'modelo\',this.value)">' +
              '<input class="tcsc-in" placeholder="Número de parte" value="' + esc(p.numeroParte) + '" oninput="window.__tcscCampo(' + i + ',\'numeroParte\',this.value)">' +
            '</div>' +
            '<textarea class="tcsc-in" rows="2" style="margin-top:6px" placeholder="Medida y detalles (ej. 3/16 pulgada, negro, 220 V)" oninput="window.__tcscCampo(' + i + ',\'especificaciones\',this.value)">' + esc(p.especificaciones) + '</textarea>' +
            '<input class="tcsc-in" style="margin-top:6px" type="url" placeholder="Link de referencia (opcional)" value="' + esc(p.link) + '" oninput="window.__tcscCampo(' + i + ',\'link\',this.value)">' +
          '</details>' +
          '<div style="text-align:right;margin-top:6px"><button type="button" class="tcsc-quitar" onclick="window.__tcscQuitar(' + i + ')">' + ico('basura', 13) + 'Quitar</button></div>' +
        '</div></div>';
    }).join('');
  }
  window.__tcscCampo = function (i, campo, v) {
    if (!F || !F.piezas[i]) return;
    F.piezas[i][campo] = campo === 'cant' ? (v === '' ? '' : Number(v)) : v;
    if (campo === 'desc' && F.piezas[i].aviso && v) F.piezas[i].aviso = '';
  };
  window.__tcscAgregar = function () {
    if (!F) return;
    F.piezas.push(nuevaPieza());
    pintarPiezas();
    var ins = document.querySelectorAll('#tcsc-piezas .tcsc-pz:last-child input'); if (ins[0]) ins[0].focus();
  };
  window.__tcscQuitar = function (i) { if (!F) return; F.piezas.splice(i, 1); pintarPiezas(); };

  function agregarFoto(file, idx) {
    if (!F) return;
    var p;
    if (idx == null) {
      p = F.piezas.find(function (x) { return !x.foto && !x.leyendo; });
      if (!p) { p = nuevaPieza({ origenCaptura: 'foto' }); F.piezas.push(p); }
    } else p = F.piezas[idx];
    if (!p) return;
    fotoDesdeArchivo(file).then(function (r) {
      if (!F || F.piezas.indexOf(p) < 0) return;
      if (!r.foto) { avisoCaptura('No se pudo abrir esa imagen. Prueba con otra (JPG o PNG).', 'error'); return; }
      p.foto = r.foto; p.miniatura = r.miniatura;
      if (p.origenCaptura === 'manual') p.origenCaptura = 'foto';
      if (!p.desc) p.aviso = 'Escribe qué es (y la medida si aplica) para que Compras lo encuentre rápido.';
      pintarPiezas();
      avisoCaptura('', '');
    });
  }
  window.__tcscFotosNuevas = function (input) { Array.prototype.forEach.call(input.files || [], function (f) { agregarFoto(f, null); }); input.value = ''; };
  window.__tcscFotoPieza = function (i, input) { var f = input.files && input.files[0]; input.value = ''; if (f) agregarFoto(f, i); };

  // ── Link ──────────────────────────────────────────────────────────────
  window.__tcscTraerLink = function () {
    if (!F) return;
    var inp = document.getElementById('tcsc-link'), url = (inp.value || '').trim();
    if (!url) { avisoCaptura('Pega primero el link del producto.', 'error'); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try { new URL(url); } catch (e) { avisoCaptura('Eso no parece un link. Copia la dirección completa de la página del producto.', 'error'); return; }
    if (esBusquedaGoogle(url)) {
      avisoCaptura('Ese es un link de búsqueda de Google, no de un producto. Abre la tienda (por ejemplo Steren o MercadoLibre) y copia el link de esa página, o mejor sube una captura.', 'error');
      return;
    }
    var p = nuevaPieza({ link: url, origenCaptura: 'link', leyendo: true });
    F.piezas.push(p); pintarPiezas();
    inp.value = ''; avisoCaptura('', '');
    var btn = document.getElementById('tcsc-link-btn'); if (btn) btn.disabled = true;
    leerLink(url).then(function (d) {
      if (!F || F.piezas.indexOf(p) < 0) return;
      p.desc = String(d.titulo || '').slice(0, 180);
      p.precioRef = d.precio || null; p.monedaRef = d.moneda || 'MXN'; p.tiendaRef = d.tienda || '';
      p.marca = d.marca || p.marca; p.modelo = d.modelo || p.modelo;
      if (d.url) p.link = d.url;
      p.leyendo = false; p.aviso = '';
      var foto = d.imagen ? Promise.all([comprimir(d.imagen, 1100, 0.72), comprimir(d.imagen, 240, 0.66)]) : Promise.resolve(['', '']);
      return foto.then(function (r) {
        p.foto = r[0] || ''; p.miniatura = r[1] || '';
        pintarPiezas();
        avisoCaptura('Listo, revisa los datos y la cantidad.', 'ok');
      });
    }).catch(function () {
      if (!F || F.piezas.indexOf(p) < 0) return;
      p.leyendo = false;
      p.aviso = 'No pudimos leer esa página. El link sí se guardó: escribe el nombre a mano o agrega una captura.';
      pintarPiezas();
    }).then(function () { if (btn) btn.disabled = false; });
  };

  // ── PDF ───────────────────────────────────────────────────────────────
  window.__tcscPdf = function (input) { var f = input.files && input.files[0]; input.value = ''; if (f) procesarPdf(f); };
  function procesarPdf(file) {
    if (!F) return;
    if (file.size > MAX_PDF) { avisoCaptura('El PDF pesa más de 4 MB. Comprímelo o manda solo las hojas necesarias.', 'error'); return; }
    avisoCaptura('Leyendo el PDF…', 'info');
    leerArchivo(file).then(function (dataUrl) {
      F.pdf = { nombre: file.name, data: dataUrl, mime: file.type || 'application/pdf' };
      pintarAdjunto();
      return renglonesDePdf(dataUrl).then(function (lineas) {
        if (!lineas.length) { avisoCaptura('El PDF quedó adjunto para Compras, pero parece escaneado (no tiene texto que se pueda leer). Agrega las piezas a mano o con fotos.', 'info'); return; }
        avisoCaptura('', '');
        elegirRenglones(lineas);
      });
    }).catch(function () {
      avisoCaptura('No se pudo leer el PDF, pero quedó adjunto para Compras. Agrega las piezas a mano.', 'error');
    });
  }
  function pintarAdjunto() {
    var c = document.getElementById('tcsc-adj'); if (!c || !F) return;
    c.innerHTML = F.pdf ? '<div class="tcsc-adj">' + ico('pdf', 16) + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><b>' + esc(F.pdf.nombre) + '</b> va adjunto para Compras</span><button type="button" class="tcsc-quitar" onclick="window.__tcscQuitarPdf()">Quitar</button></div>' : '';
  }
  window.__tcscQuitarPdf = function () { if (F) { F.pdf = null; pintarAdjunto(); } };

  var _renglones = [];
  function elegirRenglones(lineas) {
    _renglones = lineas.slice(0, 120).map(interpretarRenglon);
    var ov = document.createElement('div');
    ov.className = 'tcsc-ov'; ov.id = 'tcsc-renglones';
    ov.style.zIndex = String(((F && F.op.zIndex) || 2400) + 10);
    ov.innerHTML = '<div class="tcsc-pnl" style="max-width:640px" role="dialog" aria-modal="true" aria-labelledby="tcsc-rtit">' +
      '<div class="tcsc-hd"><div><h3 id="tcsc-rtit">¿Cuáles renglones son piezas?</h3><p>Marcamos los que traen cantidad. Ajusta lo que haga falta.</p></div>' +
      '<button type="button" class="tcsc-x" aria-label="Cerrar" onclick="document.getElementById(\'tcsc-renglones\').remove()">' + ico('cerrar') + '</button></div>' +
      '<div class="tcsc-bd"><div style="max-height:55vh;overflow-y:auto;margin-bottom:12px">' +
      _renglones.map(function (r, i) {
        return '<label class="tcsc-renglon"><input type="checkbox" class="tcsc-r-chk" data-i="' + i + '"' + (r.conCantidad ? ' checked' : '') + ' style="margin-top:9px">' +
          '<input type="number" class="tcsc-in tcsc-r-cant" data-i="' + i + '" value="' + esc(r.cant) + '" min="0" step="any" aria-label="Cantidad">' +
          '<input class="tcsc-in tcsc-r-desc" data-i="' + i + '" value="' + esc(r.desc) + '" aria-label="Descripción"></label>';
      }).join('') +
      '</div><button type="button" class="tcsc-enviar" onclick="window.__tcscUsarRenglones()">Agregar los marcados</button></div></div>';
    document.body.appendChild(ov);
  }
  window.__tcscUsarRenglones = function () {
    if (!F) return;
    var n = 0;
    document.querySelectorAll('.tcsc-r-chk:checked').forEach(function (chk) {
      var i = chk.getAttribute('data-i'), r = _renglones[i];
      var d = document.querySelector('.tcsc-r-desc[data-i="' + i + '"]'), c = document.querySelector('.tcsc-r-cant[data-i="' + i + '"]');
      var desc = (d && d.value || '').trim(); if (!desc) return;
      F.piezas.push(nuevaPieza({ desc: desc, cant: Number(c && c.value) || 1, unidad: r.unidad, origenCaptura: 'pdf' })); n++;
    });
    var v = document.getElementById('tcsc-renglones'); if (v) v.remove();
    pintarPiezas();
    avisoCaptura(n ? 'Se agregaron ' + n + ' piezas del PDF. Revisa nombres y cantidades.' : 'No marcaste renglones. El PDF sigue adjunto para Compras.', n ? 'ok' : 'info');
  };

  // ── Urgencia ──────────────────────────────────────────────────────────
  function cercana(f) { return f && (new Date(f + 'T23:59:59') - Date.now()) <= 3 * 86400000; }
  window.__tcscUrgencia = function () {
    var f = document.getElementById('tcsc-fecha').value, chk = document.getElementById('tcsc-urgente'), mot = document.getElementById('tcsc-urg-motivo'), ay = document.getElementById('tcsc-urg-ayuda');
    if (cercana(f)) { chk.checked = true; chk.disabled = true; mot.style.display = 'none'; ay.textContent = 'Marcada urgente sola: la necesitas en 3 días o menos.'; }
    else { chk.disabled = false; mot.style.display = chk.checked ? 'block' : 'none'; ay.textContent = 'Se marca sola si la necesitas en 3 días o menos.'; }
  };

  // ── Enviar ────────────────────────────────────────────────────────────
  window.__tcscEnviar = function () {
    if (!F) return;
    var errEl = document.getElementById('tcsc-err');
    var err = function (m) { errEl.textContent = m; errEl.style.display = 'block'; errEl.scrollIntoView && errEl.scrollIntoView({ block: 'nearest' }); };
    errEl.style.display = 'none';
    if (F.piezas.some(function (p) { return p.leyendo; })) return err('Espera a que termine de leer el link.');
    var piezas = F.piezas.filter(function (p) { return String(p.desc || '').trim(); });
    if (!piezas.length) return err(F.piezas.length ? 'Escribe qué es cada pieza (el nombre).' : 'Agrega al menos una pieza.');
    if (F.piezas.length !== piezas.length) return err('Hay una pieza sin nombre. Escríbelo o quítala.');
    if (piezas.some(function (p) { return !(Number(p.cant) > 0); })) return err('Cada pieza necesita una cantidad mayor a 0.');
    var fechaReq = document.getElementById('tcsc-fecha').value;
    var urgente = document.getElementById('tcsc-urgente').checked, cerca = cercana(fechaReq);
    var motivo = (document.getElementById('tcsc-urg-motivo').value || '').trim();
    if (urgente && !cerca && !motivo) return err('Explica por qué es urgente, o quita la marca.');
    var correo = (F.op.correo || miCorreo()).toLowerCase();
    if (!correo) return err('No se encontró tu sesión. Vuelve a entrar e inténtalo de nuevo.');
    var nombre = F.op.nombre || correo;
    var depto = document.getElementById('tcsc-depto').value;
    var uso = (document.getElementById('tcsc-uso').value || '').trim();
    var btn = document.getElementById('tcsc-enviar'); btn.disabled = true; btn.textContent = 'Mandando…';
    var ahora = new Date().toISOString(), op = F.op, pdf = F.pdf, P;
    var partidas = piezas.map(function (p) {
      return { desc: String(p.desc).trim(), cant: Number(p.cant), unidad: p.unidad || 'Pieza', numeroParte: (p.numeroParte || '').trim(), marca: (p.marca || '').trim(),
        modelo: (p.modelo || '').trim(), especificaciones: (p.especificaciones || '').trim(), link: (p.link || '').trim(), precioRef: p.precioRef || null,
        monedaRef: p.precioRef ? (p.monedaRef || 'MXN') : '', tiendaRef: p.tiendaRef || '', miniatura: p.miniatura || '', origenCaptura: p.origenCaptura || 'manual' };
    });
    var folio;
    puente().then(function (pp) {
      P = pp;
      return window.tcCpSiguienteFolio('SC');
    }).then(function (f) {
      folio = f;
      var datos = {
        folio: folio, estatus: 'nueva', origen: depto === 'Compras' ? 'compras' : 'departamento', departamento: depto,
        empresa: document.getElementById('tcsc-empresa').value, tipoCompra: document.getElementById('tcsc-tipo').value,
        cliente: uso, usoDestino: uso, fechaRequerida: fechaReq || '',
        urgencia: (urgente || cerca) ? 'alta' : 'normal', urgenciaMotivo: cerca ? 'Se necesita en 3 días o menos' : motivo,
        notas: (document.getElementById('tcsc-notas').value || '').trim(), partidas: partidas,
        solicitante: { correo: correo, nombre: nombre }, proveedoresInvitados: [], respuestas: [],
        historial: [{ tipo: 'creada', fecha: ahora, por: nombre, correo: correo, texto: 'Pidió la cotización' + (op.app ? ' desde la app' : '') }],
        numFotos: piezas.filter(function (p) { return p.foto; }).length, createdAt: P.serverTimestamp(), actualizadoEn: ahora, capturadaEn: op.app ? 'app' : 'portal',
      };
      return P.addDoc(P.collection(null, 'solicitudes_cotizacion'), datos);
    }).then(function (ref) {
      var subidas = [];
      piezas.forEach(function (p, i) {
        if (p.foto) subidas.push(P.addDoc(P.collection(null, 'solicitudes_cotizacion', ref.id, 'fotos'), { src: p.foto, origen: 'solicitante', subidaPor: correo, fecha: ahora, partida: i, desc: partidas[i].desc }));
      });
      if (pdf) subidas.push(P.addDoc(P.collection(null, 'solicitudes_cotizacion', ref.id, 'adjuntos'), { data: pdf.data, nombre: pdf.nombre, tipo: pdf.mime, subidoPor: correo, fecha: ahora }));
      return Promise.all(subidas.map(function (s) { return s.catch(function (e) { console.warn('[cotizacion] archivo', e); return null; }); }))
        .then(function () { avisarCompras(P, folio, depto, partidas, correo); return ref; });
    }).then(function (ref) {
      cerrarFormulario();
      toast('Listo. Tu cotización ' + folio + ' ya está con Compras.');
      if (typeof op.alGuardar === 'function') { try { op.alGuardar(ref.id, folio); } catch (e) { console.error(e); } }
    }).catch(function (e) {
      btn.disabled = false; btn.textContent = 'Mandar a Compras';
      err('No se pudo mandar: ' + (e && e.message || e) + '. Revisa tu conexión e inténtalo de nuevo.');
    });
  };

  function avisarCompras(P, folio, depto, partidas, correo) {
    P.getDoc(P.doc(null, 'config_flujo_compras', 'general')).then(function (s) {
      var cfg = s.exists() ? s.data() : {};
      var msg = 'Nueva solicitud de cotización ' + folio + ' de ' + depto + ': ' + partidas[0].desc + (partidas.length > 1 ? ' (+' + (partidas.length - 1) + ')' : '');
      (cfg.aprobadoresCompras || []).forEach(function (a) {
        var para = String(a.correo || '').toLowerCase().trim();
        if (para && para !== correo && window.tcCpNotificar) window.tcCpNotificar({ para: para, tipo: 'compras_aviso', mensaje: msg, link: '', leido: false, creadaEn: new Date().toISOString() }).catch(function () {});
      });
    }).catch(function (e) { console.warn('[cotizacion] aviso a Compras', e); });
  }

  function toast(t) {
    if (typeof window.toast === 'function') { try { window.toast(t); return; } catch (e) {} }
    var d = document.createElement('div');
    d.textContent = t; d.setAttribute('role', 'status');
    d.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0A1628;color:#fff;padding:12px 18px;border-radius:11px;font-size:13px;font-weight:700;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center';
    document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3500);
  }

  // ══════════════════════════════════════════════════════════════════
  //  HISTORIAL SIN PRECIOS NI PROVEEDORES
  //  (para quien no debe verlos: todos menos Compras y Ventas)
  // ══════════════════════════════════════════════════════════════════
  window.tcScHistTexto = function (e, vePrecios) {
    e = e || {};
    if (vePrecios) return e.texto || '';
    switch (e.tipo) {
      case 'creada': case 'comentario': case 'cancelada': case 'comprada': return e.texto || '';
      case 'enviada': return 'Compras pidió precio a un proveedor';
      case 'respuesta': return 'Compras recibió una cotización';
      case 'aceptada': case 'compartida': return 'Compras ya tiene precio';
      case 'convertida': { var m = String(e.texto || '').match(/requisici[oó]n\s+(\S+)/i); return 'Se convirtió en requisición' + (m ? ' ' + m[1] : ''); }
      default: return null; // proveedor, ajuste, seguimiento: internos de Compras
    }
  };

  // ══════════════════════════════════════════════════════════════════
  //  MIS COTIZACIONES (app de técnicos) — sin precios
  // ══════════════════════════════════════════════════════════════════
  var EST = {
    nueva: { txt: 'Enviada, esperando a Compras', col: '#B45309' },
    preguntando: { txt: 'Compras está cotizando', col: '#1473E6' },
    con_precios: { txt: 'Cotizada, Compras está eligiendo', col: '#1473E6' },
    lista: { txt: 'Cotizada', col: '#6D28D9' },
    convertida: { txt: 'Ya es requisición', col: '#12A150' },
    cancelada: { txt: 'Cancelada', col: '#94A3B8' },
  };
  function pasoIdx(sc, req) {
    if (sc.estatus === 'cancelada') return -1;
    if (sc.estatus === 'convertida' && req) {
      if (req.estatus === 'recibida') return 6;
      if (req.envio && ['enviado', 'en_camino', 'en_reparto', 'listo_recoger', 'detenido'].indexOf(req.envio.estado) > -1) return 5;
      if (req.estatus === 'orden_generada') return 4;
      return 3;
    }
    return { nueva: 0, preguntando: 1, con_precios: 2, lista: 2, convertida: 3 }[sc.estatus] || 0;
  }
  function estadoTexto(sc, req) {
    if (sc.estatus === 'convertida' && req) {
      if (req.estatus === 'rechazada') return 'La requisición ' + (req.folio || '') + ' fue rechazada';
      if (req.estatus === 'recibida') return 'Recibida';
      if (req.envio && req.estatus !== 'recibida') return 'En camino';
      if (req.estatus === 'orden_generada') return 'Comprada, falta que la envíen';
      return 'En aprobación (' + (req.folio || '') + ')';
    }
    return (EST[sc.estatus] || {}).txt || sc.estatus;
  }
  function barraHTML(idx) {
    if (idx < 0) return '<span class="tcsc-chip">Cancelada</span>';
    return '<div class="tcsc-barra" aria-label="Paso ' + (idx + 1) + ' de ' + PASOS.length + ': ' + PASOS[idx] + '">' + PASOS.map(function (p, i) {
      return '<div title="' + p + '" style="background:' + (i < idx ? '#12A150' : i === idx ? '#1473E6' : '#E2E8F0') + '"></div>';
    }).join('') + '</div>';
  }
  function pasosHTML(idx) {
    if (idx < 0) return '';
    return '<div class="tcsc-pasos">' + PASOS.map(function (p, i) {
      var est = i < idx ? 'hecho' : i === idx ? 'actual' : 'espera';
      var bg = est === 'hecho' ? '#12A150' : est === 'actual' ? '#1473E6' : '#F1F5F9', fg = est === 'espera' ? '#94A3B8' : '#fff';
      return '<div class="tcsc-paso"><i style="background:' + bg + ';color:' + fg + '">' + (est === 'hecho' ? ico('check', 12) : (i + 1)) + '</i><span style="color:' + (est === 'espera' ? '#94A3B8' : est === 'actual' ? '#1473E6' : '#12A150') + '">' + p + '</span></div>';
    }).join('') + '</div>';
  }

  var M = null; // estado de "Mis cotizaciones"
  window.tcScMisCotizaciones = function (el, op) {
    estilos();
    M = { el: el, op: op || {}, lista: [], reqs: {}, detalle: null };
    el.innerHTML = '<p style="text-align:center;color:#94A3B8;font-size:13px;padding:24px">Cargando tus cotizaciones…</p>';
    cargarMias();
  };
  function cargarMias() {
    if (!M) return;
    var correo = (M.op.correo || miCorreo()).toLowerCase();
    puente().then(function () {
      return window.tcSupabase.from('compras_solicitudes')
        .select('id,folio,estatus,departamento,partidas,historial,requisicion_id,requisicion_folio,urgencia,fecha_requerida,motivo_cancelacion,created_at,updated_at')
        .eq('solicitante->>correo', correo).order('created_at', { ascending: false }).limit(60);
    }).then(function (r) {
      if (r.error) throw r.error;
      M.lista = r.data || [];
      var ids = M.lista.map(function (s) { return s.requisicion_id; }).filter(Boolean);
      if (!ids.length) return { data: [] };
      return window.tcSupabase.from('compras_requisiciones').select('id,folio,estatus,envio,recibida_en').in('id', ids);
    }).then(function (r) {
      M.reqs = {}; (r && r.data || []).forEach(function (q) { M.reqs[q.id] = q; });
      if (M.detalle) pintarDetalle(M.detalle); else pintarLista();
    }).catch(function (e) {
      M.el.innerHTML = '<div class="tcsc-vacio" style="color:#B91C1C">No se pudieron cargar tus cotizaciones: ' + esc(e && e.message || e) + '</div>';
    });
  }
  function pintarLista() {
    var h = '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button type="button" class="tcsc-enviar" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px" onclick="window.__tcscMisPedir()">' + ico('mas', 16) + 'Pedir cotización</button>' +
      '<button type="button" class="tcsc-btn" aria-label="Actualizar" onclick="window.__tcscMisRecargar()">' + ico('refrescar', 15) + '</button></div>';
    if (!M.lista.length) {
      h += '<div class="tcsc-vacio">Aún no has pedido cotizaciones. Pídele a Compras el precio de una pieza o consumible: con un link, una foto o un PDF.</div>';
    } else {
      var orden = function (s) { return s.estatus === 'cancelada' ? 3 : (s.estatus === 'convertida' && M.reqs[s.requisicion_id] && M.reqs[s.requisicion_id].estatus === 'recibida') ? 2 : 0; };
      h += M.lista.slice().sort(function (a, b) { return orden(a) - orden(b); }).map(function (s) {
        var req = M.reqs[s.requisicion_id], idx = pasoIdx(s, req), pt = (s.partidas || [])[0] || {};
        var col = idx < 0 ? '#94A3B8' : idx >= 6 ? '#12A150' : (EST[s.estatus] || {}).col || '#1473E6';
        var abierta = idx >= 0 && idx < 6, dias = diasDesde(s.created_at);
        return '<div class="tcsc-lista-card" style="--c:' + col + '" role="button" tabindex="0" onclick="window.__tcscMisVer(\'' + s.id + '\')" onkeydown="if(event.key===\'Enter\')window.__tcscMisVer(\'' + s.id + '\')">' +
          '<div class="tcsc-mini">' + (pt.miniatura ? '<img src="' + pt.miniatura + '" alt="">' : ico('paquete', 22)) + '</div>' +
          '<div style="min-width:0"><div style="display:flex;justify-content:space-between;gap:6px"><b style="font-size:13px">' + esc(s.folio || '') + '</b>' +
            (s.urgencia === 'alta' ? '<span class="tcsc-chip" style="background:#FEE2E2;color:#B91C1C">' + ico('fuego', 11) + 'Urgente</span>' : '') + '</div>' +
          '<div style="font-size:12.5px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(pt.desc || '') + ((s.partidas || []).length > 1 ? ' (+' + ((s.partidas || []).length - 1) + ')' : '') + '</div>' +
          '<div style="font-size:11.5px;color:#5C7089;margin-top:2px"><b>' + esc(estadoTexto(s, req)) + '</b>' + (abierta ? ' · hace ' + dias + (dias === 1 ? ' día' : ' días') : '') + '</div>' +
          barraHTML(idx) + '</div></div>';
      }).join('');
    }
    M.el.innerHTML = h;
  }
  window.__tcscMisRecargar = function () { if (M) { M.el.style.opacity = '.6'; cargarMias(); setTimeout(function () { if (M) M.el.style.opacity = ''; }, 500); } };
  window.__tcscMisPedir = function () {
    if (!M) return;
    if (typeof M.op.alPedir === 'function') { M.op.alPedir(); return; }
    window.tcScAbrirFormulario({ departamento: M.op.departamento, fijarDepto: true, correo: M.op.correo, nombre: M.op.nombre, zIndex: M.op.zIndex, app: true, alGuardar: function () { cargarMias(); } });
  };
  window.__tcscMisVer = function (id) { if (!M) return; M.detalle = id; pintarDetalle(id); };
  window.__tcscMisVolver = function () { if (!M) return; M.detalle = null; pintarLista(); };

  function pintarDetalle(id) {
    var s = M.lista.find(function (x) { return x.id === id; }); if (!s) { M.detalle = null; pintarLista(); return; }
    var req = M.reqs[s.requisicion_id], idx = pasoIdx(s, req);
    var hist = (s.historial || []).slice().sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); })
      .map(function (e) { return { e: e, t: window.tcScHistTexto(e, false) }; }).filter(function (x) { return x.t; });
    var h = '<button type="button" class="tcsc-btn" style="margin-bottom:10px" onclick="window.__tcscMisVolver()">' + ico('atras', 14) + 'Mis cotizaciones</button>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><h3 style="margin:0;font-size:17px">' + esc(s.folio || '') + '</h3><span style="font-size:11.5px;color:#5C7089">Pedida el ' + esc(fecha(s.created_at)) + '</span></div>' +
      pasosHTML(idx) +
      '<div style="background:#F1F5F9;border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px"><b>Ahora:</b> ' + esc(estadoTexto(s, req)) +
        (s.estatus === 'cancelada' && s.motivo_cancelacion ? '<br><span style="color:#5C7089">' + esc(s.motivo_cancelacion) + '</span>' : '') +
        (s.fecha_requerida ? '<br><span style="color:#5C7089">La necesitas para el ' + esc(fecha(s.fecha_requerida + 'T12:00:00')) + '</span>' : '') + '</div>' +
      (s.partidas || []).map(function (p) {
        var x = [p.marca, p.modelo, p.numeroParte, p.especificaciones].filter(Boolean).join(' · ');
        return '<div style="display:grid;grid-template-columns:56px 1fr;gap:10px;border:1px solid #E5EAF1;border-radius:11px;padding:9px;margin-bottom:7px">' +
          '<div class="tcsc-mini">' + (p.miniatura ? '<img src="' + p.miniatura + '" alt="">' : ico('paquete', 20)) + '</div>' +
          '<div style="min-width:0"><b style="font-size:12.5px">' + esc(p.desc) + '</b><div style="font-size:11.5px;color:#5C7089">' + esc(p.cant) + ' ' + esc(p.unidad || '') + (x ? ' · ' + esc(x) : '') + '</div>' +
          (p.link ? '<a href="' + esc(p.link) + '" target="_blank" rel="noopener" style="font-size:11.5px;color:#1473E6;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:3px">' + ico('externo', 11) + 'Ver producto</a>' : '') + '</div></div>';
      }).join('') +
      '<p style="font-size:12px;font-weight:800;margin:14px 0 6px;display:flex;align-items:center;gap:6px">' + ico('chat', 14) + 'Movimientos y mensajes</p>' +
      '<div style="border:1px solid #E5EAF1;border-radius:11px;padding:4px 10px;margin-bottom:8px;max-height:280px;overflow-y:auto">' +
      (hist.length ? hist.map(function (x) {
        var com = x.e.tipo === 'comentario';
        return '<div style="padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:12px"><b>' + esc(x.e.por || '') + '</b> <span style="color:#94A3B8;font-size:10.5px">' + esc(fecha(x.e.fecha, true)) + '</span><div style="color:' + (com ? '#0A1628' : '#5C7089') + '">' + esc(x.t) + '</div></div>';
      }).join('') : '<p style="font-size:12px;color:#94A3B8">Sin movimientos.</p>') + '</div>' +
      (s.estatus !== 'cancelada' ? '<div style="display:flex;gap:6px"><input id="tcsc-com" class="tcsc-in" placeholder="Escribe un mensaje para Compras" onkeydown="if(event.key===\'Enter\')window.__tcscMisComentar(\'' + s.id + '\')"><button type="button" class="tcsc-btn" style="background:#0A1628;color:#fff;border-color:#0A1628" onclick="window.__tcscMisComentar(\'' + s.id + '\')">Enviar</button></div>' : '');
    M.el.innerHTML = h;
  }
  window.__tcscMisComentar = function (id) {
    var inp = document.getElementById('tcsc-com'), t = (inp && inp.value || '').trim(); if (!t || !M) return;
    var s = M.lista.find(function (x) { return x.id === id; }); if (!s) return;
    inp.disabled = true;
    var correo = (M.op.correo || miCorreo()).toLowerCase(), nombre = M.op.nombre || correo, ahora = new Date().toISOString();
    puente().then(function (P) {
      return P.updateDoc(P.doc(null, 'solicitudes_cotizacion', id), { actualizadoEn: ahora, historial: P.arrayUnion({ tipo: 'comentario', fecha: ahora, por: nombre, correo: correo, texto: t }) })
        .then(function () { avisarCompras2(P, 'Comentario en ' + (s.folio || '') + ': ' + t, correo); });
    }).then(function () { cargarMias(); }).catch(function (e) { inp.disabled = false; alert('No se pudo enviar: ' + (e && e.message || e)); });
  };
  function avisarCompras2(P, msg, correo) {
    P.getDoc(P.doc(null, 'config_flujo_compras', 'general')).then(function (s) {
      ((s.exists() ? s.data() : {}).aprobadoresCompras || []).forEach(function (a) {
        var para = String(a.correo || '').toLowerCase().trim();
        if (para && para !== correo && window.tcCpNotificar) window.tcCpNotificar({ para: para, tipo: 'compras_aviso', mensaje: msg, link: '', leido: false, creadaEn: new Date().toISOString() }).catch(function () {});
      });
    }).catch(function () {});
  }
})();
