/* ============================================================================
 * almacen-pdf.js · Módulo de Surtido — Camino de PDF (formato CHH)
 * ----------------------------------------------------------------------------
 * Responsabilidad ÚNICA: subir un PDF de pedido (formato CHH), leerlo con
 * pdf.js, extraer cliente / folio / productos / cantidades, dejar que el
 * usuario REVISE y CONFIRME, y crear un documento en la colección `surtidos`
 * de Firestore con el mismo esquema que consume el portal y la TV.
 *
 * Depende de globals del portal: window.db, window.auth, window.nombreUsuario.
 * Expone: window.abrirSurtidoPDF()
 *
 * Esquema `surtidos` (igual que pedidos-almacen.html):
 *   { folio, cliente, vendedor, prioridad, estado:'pendiente',
 *     productos:[{clave,cant,desc}], origen:'pdf', createdAt, creadoPor }
 * ==========================================================================*/
(function () {
  'use strict';

  // ── Config compartida con la TV (SLA/prioridades) ──
  var PRIORIDADES = [
    { v: 'urgente',  t: 'Urgente' },
    { v: 'muy_alta', t: 'Muy alta' },
    { v: 'alta',     t: 'Alta' },
    { v: 'normal',   t: 'Normal' },
    { v: 'baja',     t: 'Baja' }
  ];

  // ── Destino de entrega (mismo esquema que lee Almac\u00e9n, en solo lectura, y la TV) ──
  var DESTINO_TIPOS = {
    recoger_oficinas:   'Recoger en oficinas Tecnocontrol',
    cliente_recoge:     'Cliente viene por \u00e9l',
    vendedor_recoge:    'Vendedor recoge en almac\u00e9n',
    queda_almacen:      'Se queda en almac\u00e9n',
    paqueteria:         'Enviar por paqueter\u00eda',
    entrega_chihuahua:  'Entrega en Chihuahua (estaci\u00f3n)',
    traslado_almacenes: 'Traslado entre almacenes'
  };
  var ALMACENES_FALLBACK = ['CHIHUAHUA','JU\u00c1REZ','PARRAL','MONTERREY','SONORA','JALISCO'];
  // Datos del remitente para la car\u00e1tula de env\u00edo (precargados, editables).
  var REMITENTE_DEFAULT = {
    nombre: 'Hedma Tecnocontrol, Mart\u00edn de la O.',
    rfc: 'HTE1107133B3',
    direccion: 'Avenida Fuerza A\u00e9rea Mexicana N\u00fam. 7030',
    colonia: 'Tabalaopa',
    cp: '31376',
    ciudadEstado: 'Chihuahua, Chihuahua, M\u00e9xico',
    telefono: '614-417-0152'
  };
  // Si almacen.js ya se carg\u00f3 en la p\u00e1gina, se reusa su funci\u00f3n; si no, se lee directo.
  function listaAlmacenes(){
    if (window.__almListaAlmacenes) return window.__almListaAlmacenes();
    return cargarFirestore().then(function(fs){
      if (!window.db) return ALMACENES_FALLBACK.slice();
      return fs.getDoc(fs.doc(window.db,'config','almacenes')).then(function(snap){
        var nombres = snap.exists() ? (snap.data()||{}).nombres : null;
        return (Array.isArray(nombres) && nombres.length) ? nombres : ALMACENES_FALLBACK.slice();
      }).catch(function(){ return ALMACENES_FALLBACK.slice(); });
    });
  }
  function agregarAlmacenNuevo(nombre){
    if (window.__almAgregarAlmacenGlobal) return window.__almAgregarAlmacenGlobal(nombre);
    return cargarFirestore().then(function(fs){
      if (!window.db) return;
      return fs.updateDoc(fs.doc(window.db,'config','almacenes'), { nombres: fs.arrayUnion(nombre) }).catch(function(){
        return fs.setDoc(fs.doc(window.db,'config','almacenes'), { nombres:[nombre] }, {merge:true});
      });
    });
  }

  // ── CDN de pdf.js (ESM). Se importa una sola vez. ──
  var PDFJS_VER = '4.5.136';
  var PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VER + '/build/';
  var _pdfjsPromise = null;

  function cargarPdfJs() {
    if (_pdfjsPromise) return _pdfjsPromise;
    _pdfjsPromise = import(PDFJS_BASE + 'pdf.min.mjs').then(function (mod) {
      var lib = mod && (mod.getDocument ? mod : (mod.default || mod));
      try { lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.mjs'; } catch (e) {}
      return lib;
    });
    return _pdfjsPromise;
  }

  // ── Firestore (SDK modular, misma versión que index.html) ──
  var _fsPromise = null;
  function cargarFirestore() {
    if (_fsPromise) return _fsPromise;
    _fsPromise = import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    return _fsPromise;
  }

  // ── Estado del modal actual ──
  var estado = {
    rawText: '',
    productos: [], // [{clave,cant,desc}]
    pdfBuffer: null, pdfSize: 0,     // para adjuntar el PDF original al surtido
    caratulaImg: null,               // foto de carátula comprimida (si el destino es "paquetería")
    documentosPendientes: [],        // [File, ...] órdenes de compra u otros documentos, aún sin subir
    ultimoGuardado: null             // {folio,cliente,...} del último surtido creado, para el botón de WhatsApp
  };

  // =====================================================================
  //  EXTRACCIÓN DE TEXTO (pdf.js) — reconstruye líneas por posición Y
  // =====================================================================
  function extraerTexto(pdfjs, arrayBuffer) {
    return pdfjs.getDocument({ data: arrayBuffer }).promise.then(function (pdf) {
      var tareas = [];
      for (var p = 1; p <= pdf.numPages; p++) tareas.push(pdf.getPage(p));
      return Promise.all(tareas).then(function (pages) {
        return Promise.all(pages.map(function (page) {
          return page.getTextContent().then(function (tc) { return lineasDePagina(tc); });
        }));
      }).then(function (paginas) {
        return paginas.join('\n');
      });
    });
  }

  // Agrupa items de texto por su coordenada Y y los ordena por X → líneas legibles
  function lineasDePagina(textContent) {
    // 1) Recolecta items con su posición real (y vertical, x horizontal)
    var items = [];
    textContent.items.forEach(function (it) {
      if (!it.str || !it.transform) return;
      items.push({ y: it.transform[5], x: it.transform[4], s: it.str });
    });
    // 2) De arriba hacia abajo (en pdf.js, y mayor = más arriba) y por x
    items.sort(function (a, b) { return (b.y - a.y) || (a.x - b.x); });
    // 3) Agrupa por cercanía en Y (tolerancia 5px). Esto UNE filas que el PDF
    //    parte en dos —p.ej. la clave en una línea y el resto en otra— sin
    //    fusionar renglones distintos (que van más separados).
    var TOL = 5, lineas = [], cur = null, refY = null;
    items.forEach(function (it) {
      if (cur && Math.abs(it.y - refY) <= TOL) { cur.push(it); }
      else { cur = [it]; lineas.push(cur); refY = it.y; }
    });
    // 4) Cada línea: ordena por X y concatena
    return lineas.map(function (ln) {
      return ln.sort(function (a, b) { return a.x - b.x; })
        .map(function (o) { return o.s; }).join(' ')
        .replace(/\s+/g, ' ').trim();
    }).filter(function (l) { return l.length > 0; }).join('\n');
  }

  // =====================================================================
  //  PARSEO HEURÍSTICO DEL FORMATO CHH  (best-effort, se revisa a mano)
  // =====================================================================
  function parsearCHH(texto) {
    var lineas = texto.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    var out = { folio: '', cliente: '', vendedor: '', almacen: '', entrega: '', total: '', productos: [] };
    var i, m, j;

    // ── Folio (anclado a "Folio:", NO a "Cotización") ──
    for (i = 0; i < lineas.length; i++) {
      m = lineas[i].match(/Folio\s*:?\s*([A-Z]{2,4}\d{4,})/i);
      if (m) { out.folio = m[1].toUpperCase(); break; }
    }

    // ── Cliente (quita el "( NN )" y corta la columna de Datos Bancarios) ──
    for (i = 0; i < lineas.length; i++) {
      m = lineas[i].match(/Cliente\s*:?\s*(.+)$/i);
      if (m) {
        var c = m[1].replace(/^\(\s*\d+\s*\)\s*/, '');
        c = c.split(/\b(?:BBVA|CUENTA|CLABE|DATOS\s+BANC)/i)[0];
        c = c.replace(/\s{2,}/g, ' ').trim();
        if (c.replace(/[^A-Za-zÁÉÍÓÚÑ]/gi, '').length >= 3) { out.cliente = c; break; }
      }
    }

    // ── Vendedor (corta si sigue "Vigencia" o "Almacen" en la misma línea) ──
    for (i = 0; i < lineas.length; i++) {
      m = lineas[i].match(/Vendedor\s*:?\s*([^\s].*?)(?:\s+Vigencia|\s+Alm\s*acen|$)/i);
      if (m && m[1].trim()) { out.vendedor = m[1].replace(/\s{2,}/g, ' ').trim(); break; }
    }

    // ── Almacén (tolera "Alm acen" con espacio, artefacto de reconstrucción del PDF) ──
    for (i = 0; i < lineas.length; i++) {
      m = lineas[i].match(/Alm\s*acen\s*:?\s*(.+)$/i);
      if (m) { out.almacen = m[1].replace(/\s{2,}/g, ' ').trim(); break; }
    }

    // ── Entrega / Observaciones (línea siguiente a "OBSERVACIONES GENERALES") ──
    for (i = 0; i < lineas.length; i++) {
      if (/OBSERVACIONES\s+GENERALES/i.test(lineas[i])) {
        for (j = i + 1; j < Math.min(i + 4, lineas.length); j++) {
          if (lineas[j] && !/GRACIAS/i.test(lineas[j])) { out.entrega = lineas[j].trim(); break; }
        }
        break;
      }
    }

    // ── Total ──
    for (i = 0; i < lineas.length; i++) {
      m = lineas[i].match(/^Total\s+([\d,]+\.\d{2})$/i);
      if (m) { out.total = m[1]; }
    }

    // ── Productos (tabla: Cantidad · Clave · Descripción · P/U · Importe) ──
    // La clave se conserva como TEXTO para no perder ceros a la izquierda (p.ej. "06023").
    var reProd = /^(\d+(?:\.\d+)?)\s+([A-Za-z0-9]{2,10})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
    var enTabla = false;
    lineas.forEach(function (ln) {
      if (/Cantidad.*Clave.*Descrip/i.test(ln)) { enTabla = true; return; }
      if (/^(Subtotal|I\.?V\.?A|Total)\b/i.test(ln)) { enTabla = false; }
      if (!enTabla) return;
      var mp = ln.match(reProd);
      if (mp) {
        var cant = parseFloat(mp[1]);
        if (cant === Math.floor(cant)) cant = Math.floor(cant);
        var desc = mp[3].replace(/\s{2,}/g, ' ').trim();
        if (cant > 0 && /[A-Za-zÁÉÍÓÚÑ]{2,}/.test(desc)) {
          out.productos.push({ clave: mp[2], cant: cant, desc: desc, pu: mp[4], importe: mp[5] });
        }
      }
    });

    return out;
  }

  // =====================================================================
  //  UI — Modal de subida / revisión / confirmación
  // =====================================================================
  function injectStyles() {
    if (document.getElementById('alm-pdf-styles')) return;
    var css = ''
      + '#alm-pdf-modal{position:fixed;inset:0;z-index:100050;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);}'
      + '#alm-pdf-modal.show{display:flex;}'
      + '.alm-pdf-card{background:#fff;width:720px;max-width:96vw;max-height:92vh;border-radius:18px;display:flex;flex-direction:column;box-shadow:0 24px 70px rgba(2,20,50,.35);overflow:hidden;font-family:"DM Sans",system-ui,sans-serif;}'
      + '.alm-pdf-head{padding:18px 22px;background:linear-gradient(135deg,#0e7490,#0891b2);color:#fff;display:flex;align-items:center;justify-content:space-between;}'
      + '.alm-pdf-head h3{font-size:16px;font-weight:800;letter-spacing:.3px;display:flex;align-items:center;gap:9px;}'
      + '.alm-pdf-x{width:30px;height:30px;border:none;border-radius:50%;background:rgba(255,255,255,.2);color:#fff;cursor:pointer;font-size:16px;line-height:1;}'
      + '.alm-pdf-body{padding:18px 22px;overflow-y:auto;}'
      + '.alm-drop{border:2px dashed #94a3b8;border-radius:14px;padding:34px 20px;text-align:center;color:#475569;cursor:pointer;transition:.2s;background:#f8fafc;}'
      + '.alm-drop:hover,.alm-drop.drag{border-color:#0891b2;background:#ecfeff;color:#0e7490;}'
      + '.alm-drop svg{width:38px;height:38px;stroke:#0891b2;margin-bottom:8px;}'
      + '.alm-drop b{color:#0e7490;}'
      + '.alm-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}'
      + '.alm-fld label{display:block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:4px;}'
      + '.alm-fld input,.alm-fld select,.alm-fld textarea{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;color:#1e293b;outline:none;background:#fff;font-family:inherit;box-sizing:border-box;resize:vertical;}'
      + '.alm-fld input:focus,.alm-fld select:focus,.alm-fld textarea:focus{border-color:#0891b2;}'
      + '.alm-tbl{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;}'
      + '.alm-tbl th{text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#64748b;padding:6px 8px;border-bottom:2px solid #e2e8f0;}'
      + '.alm-tbl td{padding:4px 6px;border-bottom:1px solid #eef2f7;}'
      + '.alm-tbl input{width:100%;border:1px solid transparent;border-radius:7px;padding:7px 8px;font-size:13px;background:#f8fafc;color:#1e293b;outline:none;}'
      + '.alm-tbl input:focus{border-color:#0891b2;background:#fff;}'
      + '.alm-tbl .cclave{width:88px;} .alm-tbl .ccant{width:70px;} .alm-tbl .cdel{width:34px;text-align:center;}'
      + '.alm-del{border:none;background:#fee2e2;color:#dc2626;border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:15px;line-height:1;}'
      + '.alm-addrow{margin-top:8px;border:1px dashed #cbd5e1;background:#fff;color:#0e7490;border-radius:9px;padding:8px 12px;font-size:12px;font-weight:700;cursor:pointer;}'
      + '.alm-raw{margin-top:14px;}'
      + '.alm-raw summary{cursor:pointer;font-size:12px;font-weight:700;color:#64748b;}'
      + '.alm-raw pre{margin-top:8px;max-height:180px;overflow:auto;background:#0f172a;color:#cbd5e1;padding:12px;border-radius:10px;font-size:11px;white-space:pre-wrap;}'
      + '.alm-pdf-foot{padding:14px 22px;border-top:1px solid #e2e8f0;display:flex;gap:10px;justify-content:flex-end;align-items:center;}'
      + '.alm-msg{margin-right:auto;font-size:12px;font-weight:700;}'
      + '.alm-btn{padding:11px 20px;border:none;border-radius:11px;font-weight:800;font-size:13px;cursor:pointer;}'
      + '.alm-btn-sec{background:#f1f5f9;color:#475569;}'
      + '.alm-btn-ok{background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;}'
      + '.alm-btn-ok:disabled{opacity:.5;cursor:not-allowed;}'
      + '.alm-spin{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:almspin .7s linear infinite;vertical-align:-2px;margin-right:6px;}'
      + '@keyframes almspin{to{transform:rotate(360deg)}}'
      + '.alm-destino-box{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:14px;background:#f8fafc;}'
      + '.alm-destino-sel{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;color:#1e293b;outline:none;background:#fff;}'
      + '.alm-destino-fld{margin-top:10px;}'
      + '.alm-destino-fld label{display:block;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:4px;}'
      + '.alm-destino-fld input,.alm-destino-fld select,.alm-destino-fld textarea{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;color:#1e293b;outline:none;background:#fff;box-sizing:border-box;font-family:inherit;}'
      + '.alm-destino-caratula-prev{max-width:100%;max-height:130px;border:1px solid #e2e8f0;border-radius:8px;display:block;margin-top:6px;}'
      + '.alm-whatsapp-btn{background:#25D366;color:#fff;}'
      + '.alm-docs-box{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:14px;background:#f8fafc;}'
      + '.alm-doc-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:9px;margin-bottom:6px;font-size:12.5px;color:#334155;}'
      + '.alm-doc-item .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'
      + '.alm-doc-item button{flex-shrink:0;border:none;background:#fee2e2;color:#dc2626;border-radius:7px;width:24px;height:24px;cursor:pointer;font-size:14px;line-height:1;}'
      + '.alm-caratula-box{border:1px solid #cbd5e1;border-radius:12px;padding:14px 16px;margin-top:6px;background:#fff;}'
      + '.alm-caratula-tit{font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;}'
      + '.alm-caratula-sub{font-size:10.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#0e7490;margin:12px 0 6px;border-top:1px dashed #e2e8f0;padding-top:10px;}'
      + '.alm-caratula-box .alm-caratula-sub:first-of-type{border-top:none;padding-top:0;margin-top:0;}';
    var s = document.createElement('style');
    s.id = 'alm-pdf-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function construirModal() {
    if (document.getElementById('alm-pdf-modal')) return;
    var wrap = document.createElement('div');
    wrap.id = 'alm-pdf-modal';
    wrap.innerHTML =
      '<div class="alm-pdf-card">'
      + '<div class="alm-pdf-head">'
      + '<h3><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Subir pedido · formato CHH</h3>'
      + '<button class="alm-pdf-x" onclick="window.__almPdfCerrar()">&times;</button>'
      + '</div>'
      + '<div class="alm-pdf-body">'
      + '<div id="alm-step-upload">'
      + '<div class="alm-drop" id="alm-drop">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
      + '<div>Arrastra el PDF aquí o <b>haz clic para elegir</b></div>'
      + '<div style="font-size:12px;color:#94a3b8;margin-top:6px;">Pedido de almacén en formato CHH (.pdf)</div>'
      + '</div>'
      + '<input type="file" id="alm-file" accept="application/pdf,.pdf" style="display:none;">'
      + '</div>'
      + '<div id="alm-step-review" style="display:none;">'
      + '<div class="alm-grid">'
      + '<div class="alm-fld"><label>Folio</label><input id="alm-folio" placeholder="Ej. 7599"></div>'
      + '<div class="alm-fld"><label>Prioridad</label><select id="alm-prio"></select></div>'
      + '<div class="alm-fld" style="grid-column:1/3;"><label>Cliente</label><input id="alm-cliente" placeholder="Nombre del cliente / estación"></div>'
      + '<div class="alm-fld" style="grid-column:1/3;"><label>Vendedor</label><input id="alm-vendedor" placeholder="Vendedor"></div>'
      + '<div class="alm-fld" style="grid-column:1/3;"><label>Almacén</label><input id="alm-almacen" placeholder="Almacén de salida"></div>'
      + '<div class="alm-fld" style="grid-column:1/3;"><label>Entrega / Observaciones <span style="font-weight:600;color:#94a3b8;text-transform:none;">(del PDF, informativo)</span></label><input id="alm-entrega" placeholder="Instrucciones de entrega"></div>'
      + '<div class="alm-fld" style="grid-column:1/3;"><label>Comentarios para Almac\u00e9n</label><textarea id="alm-comentarios" rows="2" placeholder="Ej. Entregar solo con firma del gerente, avisar antes de llegar, etc."></textarea></div>'
      + '<div class="alm-fld"><label>Fecha de entrega *</label><input id="alm-fecha-entrega" type="date" required></div>'
      + '</div>'
      + '<div class="alm-destino-box">'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin:6px 0 6px;">\u00bfA d\u00f3nde va este pedido?</div>'
      + '<select id="alm-destino-tipo" class="alm-destino-sel" onchange="window.__almPdfDestinoChange(this.value)"></select>'
      + '<div id="alm-destino-extra"></div>'
      + '</div>'
      + '<div class="alm-docs-box">'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin:6px 0 6px;">\u00d3rdenes de compra u otros documentos (opcional)</div>'
      + '<div id="alm-docs-list"></div>'
      + '<button type="button" class="alm-addrow" onclick="document.getElementById(\'alm-docs-file\').click()">+ Agregar documento(s) o foto(s)</button>'
      + '<input type="file" id="alm-docs-file" accept="application/pdf,image/*" multiple style="display:none">'
      + '</div>'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin:6px 0 2px;">Productos</div>'
      + '<table class="alm-tbl"><thead><tr><th class="cclave">Clave</th><th class="ccant">Cant.</th><th>Descripción</th><th class="cdel"></th></tr></thead><tbody id="alm-rows"></tbody></table>'
      + '<button class="alm-addrow" onclick="window.__almPdfAddRow()">+ Agregar producto</button>'
      + '<details class="alm-raw"><summary>Ver texto extraído del PDF</summary><pre id="alm-raw"></pre></details>'
      + '</div>'
      + '</div>'
      + '<div class="alm-pdf-foot">'
      + '<span class="alm-msg" id="alm-msg"></span>'
      + '<button class="alm-btn alm-btn-sec" id="alm-pdf-cancelbtn" onclick="window.__almPdfCerrar()">Cancelar</button>'
      + '<button class="alm-btn alm-whatsapp-btn" id="alm-whatsapp" style="display:none;" onclick="window.__almPdfWhatsApp()">Enviar por WhatsApp</button>'
      + '<button class="alm-btn alm-btn-ok" id="alm-confirm" style="display:none;" onclick="window.__almPdfConfirmar()">Confirmar y crear surtido</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(wrap);

    // Prioridades
    var sel = wrap.querySelector('#alm-prio');
    sel.innerHTML = PRIORIDADES.map(function (p) {
      return '<option value="' + p.v + '"' + (p.v === 'normal' ? ' selected' : '') + '>' + p.t + '</option>';
    }).join('');

    // Destino de entrega
    var selDestino = wrap.querySelector('#alm-destino-tipo');
    selDestino.innerHTML = '<option value="">\u2014 Selecciona \u2014</option>' + Object.keys(DESTINO_TIPOS).map(function (k) {
      return '<option value="' + k + '">' + esc(DESTINO_TIPOS[k]) + '</option>';
    }).join('');

    // Documentos adicionales (órdenes de compra, etc.)
    var docsFile = wrap.querySelector('#alm-docs-file');
    docsFile.addEventListener('change', function (e) {
      manejarDocumentosNuevos(e.target.files);
      docsFile.value = '';
    });

    // Eventos de subida
    var drop = wrap.querySelector('#alm-drop');
    var file = wrap.querySelector('#alm-file');
    drop.addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function (e) { if (e.target.files[0]) manejarArchivo(e.target.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('drag'); });
    });
    drop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) manejarArchivo(f);
    });
  }

  function msg(texto, color) {
    var el = document.getElementById('alm-msg');
    if (el) { el.textContent = texto || ''; el.style.color = color || '#64748b'; }
  }

  function manejarArchivo(f) {
    if (!f || f.type.indexOf('pdf') === -1 && !/\.pdf$/i.test(f.name)) {
      msg('El archivo debe ser un PDF.', '#dc2626');
      return;
    }
    msg('Leyendo PDF…', '#0e7490');
    var reader = new FileReader();
    reader.onload = function () {
      var buf = reader.result;
      // Guarda una copia del PDF (para poder adjuntarlo luego); pdf.js puede "consumir"
      // el ArrayBuffer original al leerlo, así que se clona antes de pasárselo.
      try { estado.pdfBuffer = buf.slice(0); estado.pdfSize = f.size; } catch (e) { estado.pdfBuffer = null; estado.pdfSize = 0; }
      cargarPdfJs()
        .then(function (pdfjs) { return extraerTexto(pdfjs, buf); })
        .then(function (texto) {
          estado.rawText = texto;
          var parsed = parsearCHH(texto);
          estado.productos = parsed.productos.slice();
          estado.total = parsed.total || '';
          pintarRevision(parsed);
          msg(parsed.productos.length
            ? ('Se detectaron ' + parsed.productos.length + ' productos. Revisa y corrige antes de confirmar.')
            : 'No se detectaron productos automáticamente. Captúralos manualmente abajo.',
            parsed.productos.length ? '#0e7490' : '#d97706');
        })
        .catch(function (e) {
          console.error('[almacen-pdf] error leyendo PDF:', e);
          msg('No se pudo leer el PDF. Revisa que no sea una imagen escaneada.', '#dc2626');
        });
    };
    reader.onerror = function () { msg('Error al leer el archivo.', '#dc2626'); };
    reader.readAsArrayBuffer(f);
  }

  function pintarRevision(parsed) {
    document.getElementById('alm-step-upload').style.display = 'none';
    document.getElementById('alm-step-review').style.display = 'block';
    document.getElementById('alm-confirm').style.display = 'inline-block';
    document.getElementById('alm-folio').value = parsed.folio || '';
    document.getElementById('alm-cliente').value = parsed.cliente || '';
    // Vendedor: usa el detectado, o el usuario actual del portal
    var yo = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
    document.getElementById('alm-vendedor').value = parsed.vendedor
      || (window.nombreUsuario ? window.nombreUsuario(yo) : '') || '';
    document.getElementById('alm-almacen').value = parsed.almacen || '';
    document.getElementById('alm-entrega').value = parsed.entrega || '';
    document.getElementById('alm-raw').textContent = estado.rawText || '(sin texto)';
    renderRows();
  }

  function renderRows() {
    var tb = document.getElementById('alm-rows');
    if (!tb) return;
    tb.innerHTML = estado.productos.map(function (p, i) {
      return '<tr>'
        + '<td class="cclave"><input value="' + esc(p.clave) + '" oninput="window.__almPdfEdit(' + i + ',\'clave\',this.value)"></td>'
        + '<td class="ccant"><input type="number" min="1" value="' + (p.cant || '') + '" oninput="window.__almPdfEdit(' + i + ',\'cant\',this.value)"></td>'
        + '<td><input value="' + esc(p.desc) + '" oninput="window.__almPdfEdit(' + i + ',\'desc\',this.value)"></td>'
        + '<td class="cdel"><button class="alm-del" title="Quitar" onclick="window.__almPdfDelRow(' + i + ')">&times;</button></td>'
        + '</tr>';
    }).join('');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // =====================================================================
  //  DESTINO DE ENTREGA — campos condicionales según el tipo elegido
  // =====================================================================
  function opcionesAlmacenesHtml(lista, selected){
    return (lista||ALMACENES_FALLBACK).map(function(a){
      return '<option value="' + esc(a) + '"' + (selected===a?' selected':'') + '>' + esc(a) + '</option>';
    }).join('');
  }

  window.__almPdfDestinoChange = function(tipo){
    var extra = document.getElementById('alm-destino-extra');
    if (!extra) return;
    if (tipo === 'paqueteria'){
      var prev = estado.caratulaImg
        ? '<img class="alm-destino-caratula-prev" id="alm-destino-caratula-img" src="' + esc(estado.caratulaImg) + '">'
        : '';
      var folioAct = (document.getElementById('alm-folio')||{}).value || '';
      var almacenAct = (document.getElementById('alm-almacen')||{}).value || '';
      var vendedorAct = (document.getElementById('alm-vendedor')||{}).value || '';
      var hoy = new Date().toLocaleDateString('es-MX');
      var R = REMITENTE_DEFAULT;
      extra.innerHTML =
          '<div class="alm-caratula-box">'
        +   '<div class="alm-caratula-tit">Car\u00e1tula de env\u00edo de mercanc\u00eda</div>'
        +   '<div class="alm-caratula-sub">Solicitante</div>'
        +   '<div class="alm-destino-fld"><input id="cx-solicitante" value="' + esc(vendedorAct) + '" placeholder="Nombre de qui\u00e9n solicita"></div>'
        +   '<div class="alm-caratula-sub">Datos del remitente</div>'
        +   '<div class="alm-destino-fld"><label>Nombre</label><input id="cx-rem-nombre" value="' + esc(R.nombre) + '"></div>'
        +   '<div class="alm-destino-fld"><label>RFC</label><input id="cx-rem-rfc" value="' + esc(R.rfc) + '"></div>'
        +   '<div class="alm-destino-fld"><label>Direcci\u00f3n</label><input id="cx-rem-dir" value="' + esc(R.direccion) + '"></div>'
        +   '<div class="alm-destino-fld"><label>Colonia</label><input id="cx-rem-col" value="' + esc(R.colonia) + '"></div>'
        +   '<div class="alm-destino-fld"><label>C.P.</label><input id="cx-rem-cp" value="' + esc(R.cp) + '"></div>'
        +   '<div class="alm-destino-fld"><label>Ciudad, Estado</label><input id="cx-rem-ciu" value="' + esc(R.ciudadEstado) + '"></div>'
        +   '<div class="alm-destino-fld"><label>Tel\u00e9fono</label><input id="cx-rem-tel" value="' + esc(R.telefono) + '"></div>'
        +   '<div class="alm-caratula-sub">Datos del destinatario</div>'
        +   '<div class="alm-destino-fld"><label>Nombre / Empresa</label><input id="cx-dest-nombre" placeholder="Nombre de la estaci\u00f3n o cliente"></div>'
        +   '<div class="alm-destino-fld"><label>RFC</label><input id="cx-dest-rfc"></div>'
        +   '<div class="alm-destino-fld"><label>R\u00e9gimen fiscal</label><input id="cx-dest-regimen"></div>'
        +   '<div class="alm-destino-fld"><label>Direcci\u00f3n</label><input id="cx-dest-dir"></div>'
        +   '<div class="alm-destino-fld"><label>Colonia</label><input id="cx-dest-col"></div>'
        +   '<div class="alm-destino-fld"><label>C.P.</label><input id="cx-dest-cp"></div>'
        +   '<div class="alm-destino-fld"><label>Ciudad, Estado</label><input id="cx-dest-ciu"></div>'
        +   '<div class="alm-destino-fld"><label>Tel\u00e9fono</label><input id="cx-dest-tel"></div>'
        +   '<div class="alm-destino-fld"><label>Correo</label><input id="cx-dest-correo"></div>'
        +   '<div class="alm-caratula-sub">Datos del env\u00edo</div>'
        +   '<div class="alm-destino-fld"><label>Paqueter\u00eda</label><input id="cx-paqueteria" placeholder="Ej. Mensajer\u00eda Express"></div>'
        +   '<div class="alm-destino-fld"><label>Gu\u00eda (opcional)</label><input id="cx-guia"></div>'
        +   '<div class="alm-destino-fld"><label>Tipo de env\u00edo</label><input id="cx-tipo-envio" placeholder="Ej. Terrestre, express"></div>'
        +   '<div class="alm-destino-fld"><label>Atenci\u00f3n a</label><input id="cx-atencion"></div>'
        +   '<div class="alm-destino-fld"><label>Recolecci\u00f3n</label><input id="cx-recoleccion" placeholder="D\u00f3nde y cu\u00e1ndo recoge la paqueter\u00eda"></div>'
        +   '<div class="alm-destino-fld"><label>Referencias</label><input id="cx-referencias"></div>'
        +   '<div class="alm-destino-fld"><label>Instrucciones especiales</label><textarea id="cx-instrucciones" rows="2"></textarea></div>'
        +   '<div class="alm-destino-fld"><label>Flete</label><select id="cx-flete"><option value="pagado">Flete pagado</option><option value="por_cobrar">Flete por cobrar</option></select></div>'
        +   '<div class="alm-destino-fld"><label>Entrega</label><select id="cx-entrega-tipo"><option value="oficina">Ocurre oficina</option><option value="domicilio">Domicilio</option></select></div>'
        +   '<div class="alm-destino-fld"><label>Almac\u00e9n / N\u00famero de pedido / Fecha</label><input value="' + esc(almacenAct) + ' \u00b7 ' + esc(folioAct) + ' \u00b7 ' + esc(hoy) + '" disabled style="color:#94a3b8;background:#f1f5f9;"></div>'
        +   '<button type="button" class="alm-addrow" style="margin-top:6px;" onclick="window.__almPdfVerCaratula()">\ud83d\udc41\ufe0f Vista previa de la car\u00e1tula</button>'
        + '</div>'
        + '<div class="alm-destino-fld" style="margin-top:12px;"><label>\u00bfYa tienes la car\u00e1tula en papel? (opcional)</label>' + prev
        + '<button type="button" class="alm-addrow" style="margin-top:6px;" onclick="window.__almPdfElegirCaratula()">' + (estado.caratulaImg?'Cambiar foto':'Subir foto en su lugar') + '</button>'
        + '<input type="file" id="alm-destino-caratula-file" accept="image/*" style="display:none"></div>';
    } else if (tipo === 'entrega_chihuahua'){
      extra.innerHTML =
        '<div class="alm-destino-fld"><label>Dirección de la estación</label><textarea id="alm-destino-dir" rows="2" placeholder="Dirección completa de la estación de servicio"></textarea></div>';
      var dirEl = document.getElementById('alm-destino-dir');
      var entregaEl = document.getElementById('alm-entrega');
      if (dirEl && !dirEl.value && entregaEl && entregaEl.value) dirEl.value = entregaEl.value;
    } else if (tipo === 'traslado_almacenes'){
      extra.innerHTML =
          '<div class="alm-destino-fld"><label>Almacén origen</label><select id="alm-destino-origen"></select></div>'
        + '<div class="alm-destino-fld"><label>Almacén destino</label><select id="alm-destino-destino"></select></div>'
        + '<button type="button" class="alm-addrow" style="margin-top:6px;" onclick="window.__almPdfAgregarAlmacen()">+ Agregar almacén nuevo</button>';
      listaAlmacenes().then(function(lista){
        var selO = document.getElementById('alm-destino-origen'), selD = document.getElementById('alm-destino-destino');
        if (selO) selO.innerHTML = opcionesAlmacenesHtml(lista);
        if (selD) selD.innerHTML = opcionesAlmacenesHtml(lista);
      });
    } else {
      extra.innerHTML = '';
    }
  };

  window.__almPdfAgregarAlmacen = function(){
    var nombre = prompt('Nombre del almacén nuevo (ej. TORREÓN):');
    if (!nombre) return;
    nombre = nombre.trim().toUpperCase();
    if (!nombre) return;
    agregarAlmacenNuevo(nombre).then(function(){
      return listaAlmacenes();
    }).then(function(lista){
      var selO = document.getElementById('alm-destino-origen'), selD = document.getElementById('alm-destino-destino');
      if (selO) selO.innerHTML = opcionesAlmacenesHtml(lista, nombre);
      if (selD) selD.innerHTML = opcionesAlmacenesHtml(lista, selD.value);
      if (window.mostrarPush) window.mostrarPush('Almacén', 'Almacén "' + nombre + '" agregado', '✅');
    }).catch(function(err){
      console.error('[almacen-pdf] agregar almacén:', err);
      if (window.mostrarPush) window.mostrarPush('Almacén', 'No se pudo agregar el almacén', '⚠️');
    });
  };

  window.__almPdfElegirCaratula = function(){
    var input = document.getElementById('alm-destino-caratula-file');
    if (!input) return;
    input.onchange = function(){
      var file = input.files && input.files[0]; input.value = '';
      if (!file) return;
      comprimirImagen(file).then(function(dataUrl){
        estado.caratulaImg = dataUrl;
        var img = document.getElementById('alm-destino-caratula-img');
        var boton = document.querySelector('#alm-destino-extra .alm-addrow');
        if (img) img.src = dataUrl;
        else if (boton) boton.insertAdjacentHTML('beforebegin', '<img class="alm-destino-caratula-prev" id="alm-destino-caratula-img" src="' + esc(dataUrl) + '">');
        if (boton) boton.textContent = 'Cambiar foto';
      }).catch(function(err){ console.error('[almacen-pdf] carátula:', err); });
    };
    input.click();
  };

  function comprimirImagen(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var maxW = 480;
          var scale = Math.min(1, maxW / img.width);
          var w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var cx = c.getContext('2d');
          cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Convierte el PDF (ArrayBuffer) a un data URL en base64, para adjuntarlo al pedido.
  function pdfABase64(buffer){
    var bytes = new Uint8Array(buffer);
    var binary = '', CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK){
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return 'data:application/pdf;base64,' + btoa(binary);
  }

  // =====================================================================
  //  CAR\u00c1TULA DE ENV\u00cdO — documento profesional (mismos datos, mejor dise\u00f1o)
  // =====================================================================
  function leerCaratulaDelFormulario(){
    function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    return {
      solicitante: v('cx-solicitante'),
      remitente: { nombre: v('cx-rem-nombre'), rfc: v('cx-rem-rfc'), direccion: v('cx-rem-dir'), colonia: v('cx-rem-col'), cp: v('cx-rem-cp'), ciudadEstado: v('cx-rem-ciu'), telefono: v('cx-rem-tel') },
      destinatario: { nombre: v('cx-dest-nombre'), rfc: v('cx-dest-rfc'), regimen: v('cx-dest-regimen'), direccion: v('cx-dest-dir'), colonia: v('cx-dest-col'), cp: v('cx-dest-cp'), ciudadEstado: v('cx-dest-ciu'), telefono: v('cx-dest-tel'), correo: v('cx-dest-correo') },
      paqueteria: v('cx-paqueteria'), guia: v('cx-guia'), tipoEnvio: v('cx-tipo-envio'), atencion: v('cx-atencion'),
      recoleccion: v('cx-recoleccion'), referencias: v('cx-referencias'), instrucciones: v('cx-instrucciones'),
      flete: (document.getElementById('cx-flete')||{}).value || 'pagado',
      entregaTipo: (document.getElementById('cx-entrega-tipo')||{}).value || 'oficina',
      folio: (document.getElementById('alm-folio')||{}).value || '', almacen: (document.getElementById('alm-almacen')||{}).value || '',
      fecha: new Date().toLocaleDateString('es-MX')
    };
  }

  function construirCaratulaHTML(c){
    function fila(label, valor){ return '<tr><td class="ce-k">' + esc(label) + '</td><td class="ce-v">' + esc(valor || '\u2014') + '</td></tr>'; }
    var R = c.remitente || {}, D = c.destinatario || {};
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Car\u00e1tula de env\u00edo ' + esc(c.folio) + '</title><style>'
      + 'body{font-family:"Segoe UI",Arial,sans-serif;color:#1e293b;margin:0;padding:32px;background:#fff;}'
      + '.ce-head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #0e7490;padding-bottom:14px;margin-bottom:18px;}'
      + '.ce-brand{font-size:22px;font-weight:800;color:#0e7490;letter-spacing:.5px;}'
      + '.ce-brand small{display:block;font-size:10px;font-weight:600;color:#64748b;letter-spacing:2px;}'
      + '.ce-meta{text-align:right;font-size:11px;color:#475569;}'
      + '.ce-meta b{color:#0f172a;}'
      + '.ce-title{font-size:15px;font-weight:800;color:#fff;background:#0e7490;padding:9px 16px;border-radius:8px;margin-bottom:16px;}'
      + '.ce-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:16px;}'
      + '.ce-box{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;}'
      + '.ce-box-h{background:#f1f5f9;color:#0f172a;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:8px 12px;border-bottom:1px solid #e2e8f0;}'
      + 'table{width:100%;border-collapse:collapse;}'
      + '.ce-k{width:36%;font-size:10.5px;font-weight:700;color:#64748b;padding:6px 12px;border-top:1px solid #f1f5f9;vertical-align:top;}'
      + '.ce-v{font-size:11.5px;color:#1e293b;padding:6px 12px;border-top:1px solid #f1f5f9;}'
      + '.ce-envio{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:16px;}'
      + '.ce-flags{display:flex;gap:14px;margin-top:14px;}'
      + '.ce-flag{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;font-size:11px;}'
      + '.ce-flag b{display:block;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}'
      + '.ce-check{color:#0e7490;font-weight:800;}'
      + '.ce-foot{margin-top:30px;font-size:9.5px;color:#94a3b8;text-align:center;}'
      + '@media print{body{padding:14px;}}'
      + '</style></head><body>'
      + '<div class="ce-head"><div class="ce-brand">TECNOCONTROL<small>SISTEMA DE ENV\u00cdOS</small></div>'
      +   '<div class="ce-meta"><div>Solicitante: <b>' + esc(c.solicitante) + '</b></div><div>N\u00fam. pedido: <b>' + esc(c.folio) + '</b></div>'
      +   '<div>Almac\u00e9n: <b>' + esc(c.almacen) + '</b></div><div>Fecha: <b>' + esc(c.fecha) + '</b></div></div></div>'
      + '<div class="ce-title">Car\u00e1tula de env\u00edo de mercanc\u00eda</div>'
      + '<div class="ce-grid">'
      +   '<div class="ce-box"><div class="ce-box-h">Datos del remitente</div><table>'
      +     fila('Nombre', R.nombre) + fila('RFC', R.rfc) + fila('Direcci\u00f3n', R.direccion) + fila('Colonia', R.colonia)
      +     fila('C.P.', R.cp) + fila('Ciudad, Estado', R.ciudadEstado) + fila('Tel\u00e9fono', R.telefono)
      +   '</table></div>'
      +   '<div class="ce-box"><div class="ce-box-h">Datos del destinatario</div><table>'
      +     fila('Nombre', D.nombre) + fila('RFC', D.rfc) + fila('R\u00e9gimen fiscal', D.regimen) + fila('Direcci\u00f3n', D.direccion)
      +     fila('Colonia', D.colonia) + fila('C.P.', D.cp) + fila('Ciudad, Estado', D.ciudadEstado) + fila('Tel\u00e9fono', D.telefono) + fila('Correo', D.correo)
      +   '</table></div>'
      + '</div>'
      + '<div class="ce-envio"><div class="ce-box-h">Datos del env\u00edo</div><table>'
      +   fila('Paqueter\u00eda', c.paqueteria) + fila('Gu\u00eda', c.guia) + fila('Tipo de env\u00edo', c.tipoEnvio) + fila('Atenci\u00f3n a', c.atencion)
      +   fila('Recolecci\u00f3n', c.recoleccion) + fila('Referencias', c.referencias) + fila('Instrucciones especiales', c.instrucciones)
      + '</table></div>'
      + '<div class="ce-flags">'
      +   '<div class="ce-flag"><b>Fletera</b>' + (c.flete==='pagado' ? '<span class="ce-check">\u2713</span> Flete pagado' : 'Flete pagado') + ' &nbsp;&nbsp; ' + (c.flete==='por_cobrar' ? '<span class="ce-check">\u2713</span> Flete por cobrar' : 'Flete por cobrar') + '</div>'
      +   '<div class="ce-flag"><b>Entrega</b>' + (c.entregaTipo==='oficina' ? '<span class="ce-check">\u2713</span> Ocurre oficina' : 'Ocurre oficina') + ' &nbsp;&nbsp; ' + (c.entregaTipo==='domicilio' ? '<span class="ce-check">\u2713</span> Domicilio' : 'Domicilio') + '</div>'
      + '</div>'
      + '<div class="ce-foot">Generado autom\u00e1ticamente por el Portal Operativo de Tecnocontrol \u00b7 ' + esc(c.fecha) + '</div>'
      + '<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>'
      + '</body></html>';
  }

  window.__almPdfVerCaratula = function(){
    var c = leerCaratulaDelFormulario();
    var w = window.open();
    if (w){ w.document.write(construirCaratulaHTML(c).replace('<script>window.onload=function(){setTimeout(function(){window.print();},300);}<\/script>','')); w.document.close(); }
  };


  var DOC_TAM_MAX = 700 * 1024; // ~700KB por archivo; deja margen para el tope de 1MB por documento en Firestore

  // =====================================================================
  //  DOCUMENTOS ADICIONALES (órdenes de compra, fotos, etc. — opcional)
  // =====================================================================
  function manejarDocumentosNuevos(fileList){
    var agregados = 0, rechazados = 0;
    Array.prototype.forEach.call(fileList || [], function (f) {
      var esPdf = f.type.indexOf('pdf') !== -1 || /\.pdf$/i.test(f.name);
      var esImagen = f.type.indexOf('image') === 0;
      if (!esPdf && !esImagen) { rechazados++; return; }
      if (esPdf && f.size > DOC_TAM_MAX) { rechazados++; return; } // las imágenes se comprimen, los PDF no
      estado.documentosPendientes.push(f);
      agregados++;
    });
    renderDocsList();
    if (rechazados) msg(agregados ? (agregados + ' documento(s) agregado(s); ' + rechazados + ' no se pudieron agregar (formato o tamaño no válido).') : 'Ese archivo no es un PDF o imagen válido, o pesa más de 700 KB.', '#d97706');
  }

  function renderDocsList(){
    var cont = document.getElementById('alm-docs-list');
    if (!cont) return;
    cont.innerHTML = estado.documentosPendientes.map(function (f, i) {
      return '<div class="alm-doc-item"><span class="n">' + esc(f.name) + '</span><button type="button" onclick="window.__almPdfDocDel(' + i + ')" title="Quitar">&times;</button></div>';
    }).join('');
  }

  window.__almPdfDocDel = function (i) {
    estado.documentosPendientes.splice(i, 1);
    renderDocsList();
  };

  function leerComoDataURL(file){
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function procesarDocumento(file){
    var esImagen = file.type.indexOf('image') === 0;
    if (esImagen) {
      return comprimirImagen(file).then(function (dataUrl) { return { tipo: 'imagen', archivo: dataUrl, nombre: file.name }; });
    }
    return leerComoDataURL(file).then(function (dataUrl) { return { tipo: 'pdf', archivo: dataUrl, nombre: file.name }; });
  }

  // Sube todos los documentos pendientes a surtidos/{id}/documentos y devuelve cuántos se guardaron bien.
  function subirDocumentosPendientes(fs, surtidoId, yo){
    if (!estado.documentosPendientes.length) return Promise.resolve(0);
    var col = fs.collection(window.db, 'surtidos', surtidoId, 'documentos');
    var tareas = estado.documentosPendientes.map(function (file) {
      return procesarDocumento(file).then(function (doc) {
        return fs.addDoc(col, Object.assign(doc, { subidoPor: yo, subidoEn: fs.serverTimestamp() }));
      }).catch(function (err) {
        console.warn('[almacen-pdf] no se pudo subir un documento:', file.name, err);
        return null;
      });
    });
    return Promise.all(tareas).then(function (resultados) {
      return resultados.filter(Boolean).length;
    });
  }

  // =====================================================================
  //  Handlers globales (invocados desde el HTML del modal)
  // =====================================================================
  window.__almPdfEdit = function (i, campo, val) {
    if (!estado.productos[i]) return;
    if (campo === 'cant') estado.productos[i].cant = parseInt(val, 10) || 0;
    else estado.productos[i][campo] = val;
  };
  window.__almPdfDelRow = function (i) { estado.productos.splice(i, 1); renderRows(); };
  window.__almPdfAddRow = function () { estado.productos.push({ clave: '', cant: 1, desc: '' }); renderRows(); };
  window.__almPdfCerrar = function () {
    var m = document.getElementById('alm-pdf-modal');
    if (m) m.classList.remove('show');
  };

  window.__almPdfConfirmar = function () {
    var folio = (document.getElementById('alm-folio').value || '').trim();
    var cliente = (document.getElementById('alm-cliente').value || '').trim();
    var vendedor = (document.getElementById('alm-vendedor').value || '').trim() || '—';
    var almacen = (document.getElementById('alm-almacen').value || '').trim();
    var entrega = (document.getElementById('alm-entrega').value || '').trim();
    var comentariosAlmacen = ((document.getElementById('alm-comentarios')||{}).value || '').trim();
    var fechaEntrega = (document.getElementById('alm-fecha-entrega').value || '').trim();
    var prioridad = document.getElementById('alm-prio').value || 'normal';
    var productos = estado.productos
      .map(function (p) { return { clave: (p.clave || '').trim(), cant: parseInt(p.cant, 10) || 0, desc: (p.desc || '').trim(), pu: p.pu || '', importe: p.importe || '' }; })
      .filter(function (p) { return p.cant > 0 && p.desc.length > 0; });

    // Destino de entrega (opcional, pero si se elige un tipo se guardan sus datos)
    var destinoTipo = (document.getElementById('alm-destino-tipo') || {}).value || '';
    var datosDestino = {};
    if (destinoTipo) {
      datosDestino.destinoTipo = destinoTipo;
      if (destinoTipo === 'paqueteria') {
        datosDestino.destinoPaqueteria = ((document.getElementById('cx-paqueteria') || {}).value || '').trim();
        datosDestino.destinoGuia = ((document.getElementById('cx-guia') || {}).value || '').trim();
        if (estado.caratulaImg) datosDestino.destinoCaratulaImg = estado.caratulaImg;
        if (document.getElementById('cx-dest-nombre')) datosDestino.caratulaEnvio = leerCaratulaDelFormulario();
      } else if (destinoTipo === 'entrega_chihuahua') {
        datosDestino.destinoDireccion = ((document.getElementById('alm-destino-dir') || {}).value || '').trim();
      } else if (destinoTipo === 'traslado_almacenes') {
        datosDestino.destinoAlmacenOrigen = (document.getElementById('alm-destino-origen') || {}).value || '';
        datosDestino.destinoAlmacenDestino = (document.getElementById('alm-destino-destino') || {}).value || '';
      }
    }

    if (!folio)   { msg('Falta el folio.', '#dc2626'); return; }
    if (!cliente) { msg('Falta el cliente.', '#dc2626'); return; }
    if (!fechaEntrega) { msg('Falta la fecha de entrega.', '#dc2626'); return; }
    if (!productos.length) { msg('Agrega al menos un producto con cantidad y descripción.', '#dc2626'); return; }

    if (!window.db) { msg('Firestore no está disponible (window.db).', '#dc2626'); return; }

    var btn = document.getElementById('alm-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="alm-spin"></span>Guardando…';
    msg('Verificando folio…', '#0e7490');

    var nuevoId = null;
    // El PDF solo se adjunta si cabe cómodo en un documento de Firestore (tope 1MB en base64).
    var adjuntarPdf = !!(estado.pdfBuffer && estado.pdfSize && estado.pdfSize < 700 * 1024);

    cargarFirestore().then(function (fs) {
      var col = fs.collection(window.db, 'surtidos');

      // Chequeo suave de folio duplicado activo (no bloqueante ante error)
      var dupCheck = fs.getDocs(fs.query(col, fs.where('folio', '==', folio)))
        .then(function (snap) {
          var activo = false;
          snap.forEach(function (d) {
            var e = (d.data() && d.data().estado) || '';
            if (e !== 'finalizado' && e !== 'entregado') activo = true;
          });
          return activo;
        })
        .catch(function () { return false; });

      return dupCheck.then(function (dup) {
        if (dup && !confirm('Ya existe un surtido activo con folio ' + folio + '. ¿Crear otro de todos modos?')) {
          throw new Error('cancelado');
        }
        var yo = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
        var doc = Object.assign({
          folio: folio,
          cliente: cliente,
          vendedor: vendedor,
          almacen: almacen,
          entrega: entrega,
          comentariosAlmacen: comentariosAlmacen,
          fechaEntrega: fechaEntrega,
          total: estado.total || '',
          prioridad: prioridad,
          estado: 'pendiente',
          productos: productos,
          tipo: 'venta',
          origen: 'pdf',
          creadoPor: yo,
          tienePdfOriginal: adjuntarPdf,
          createdAt: fs.serverTimestamp()
        }, datosDestino);
        return fs.addDoc(col, doc).then(function (ref) {
          nuevoId = ref.id;
          var tareas = [];
          if (adjuntarPdf) {
            // Adjunta el PDF original en una subcolección (no en el documento principal, para no saturarlo).
            tareas.push(fs.setDoc(fs.doc(window.db, 'surtidos', ref.id, 'adjuntos', 'pdf_original'), {
              archivo: pdfABase64(estado.pdfBuffer),
              subidoPor: yo,
              subidoEn: fs.serverTimestamp()
            }).catch(function (err) { console.warn('[almacen-pdf] no se pudo adjuntar el PDF:', err); }));
          }
          tareas.push(subirDocumentosPendientes(fs, ref.id, yo).then(function (n) {
            if (n > 0) return fs.updateDoc(ref, { numOrdenesCompra: n }).catch(function(){});
          }));
          return Promise.all(tareas);
        });
      });
    })
    .then(function () {
      msg('✔ Surtido ' + folio + ' creado.', '#059669');
      if (window.mostrarPush) window.mostrarPush('📦 Surtido creado', 'Folio ' + folio + ' · ' + cliente, '✅');
      estado.ultimoGuardado = { folio: folio, cliente: cliente, prioridad: prioridad, fechaEntrega: fechaEntrega, destinoTipo: destinoTipo };
      btn.style.display = 'none';
      var wa = document.getElementById('alm-whatsapp'); if (wa) wa.style.display = 'inline-block';
      var cancelBtn = document.getElementById('alm-pdf-cancelbtn'); if (cancelBtn) cancelBtn.textContent = 'Cerrar';
    })
    .catch(function (e) {
      if (e && e.message === 'cancelado') { msg('Operación cancelada.', '#64748b'); }
      else { console.error('[almacen-pdf] error guardando:', e); msg('No se pudo guardar. Revisa permisos de Firestore.', '#dc2626'); }
    })
    .finally(function () {
      btn.disabled = false;
      if (!estado.ultimoGuardado) btn.innerHTML = 'Confirmar y crear surtido';
    });
  };

  // =====================================================================
  //  Punto de entrada público
  // =====================================================================
  window.abrirSurtidoPDF = function () {
    injectStyles();
    construirModal();
    // Reset del estado y vista
    estado.rawText = '';
    estado.productos = [];
    estado.pdfBuffer = null; estado.pdfSize = 0;
    estado.caratulaImg = null;
    estado.documentosPendientes = [];
    estado.ultimoGuardado = null;
    var up = document.getElementById('alm-step-upload');
    var rv = document.getElementById('alm-step-review');
    if (up) up.style.display = 'block';
    if (rv) rv.style.display = 'none';
    var cf = document.getElementById('alm-confirm');
    if (cf) { cf.style.display = 'none'; cf.innerHTML = 'Confirmar y crear surtido'; }
    var wa = document.getElementById('alm-whatsapp'); if (wa) wa.style.display = 'none';
    var cancelBtn = document.getElementById('alm-pdf-cancelbtn'); if (cancelBtn) cancelBtn.textContent = 'Cancelar';
    var fi = document.getElementById('alm-file');
    if (fi) fi.value = '';
    var fe = document.getElementById('alm-fecha-entrega');
    if (fe) fe.value = '';
    var cmEl = document.getElementById('alm-comentarios'); if (cmEl) cmEl.value = '';
    var destinoSel = document.getElementById('alm-destino-tipo'); if (destinoSel) destinoSel.value = '';
    var destinoExtra = document.getElementById('alm-destino-extra'); if (destinoExtra) destinoExtra.innerHTML = '';
    renderDocsList();
    msg('', '#64748b');
    document.getElementById('alm-pdf-modal').classList.add('show');
  };

  // =====================================================================
  //  WhatsApp — notifica que se subió el pedido (el usuario elige a quién enviarlo)
  // =====================================================================
  window.__almPdfWhatsApp = function () {
    var g = estado.ultimoGuardado;
    if (!g) return;
    var lineas = [
      '\ud83d\udce6 Nuevo pedido subido a Almac\u00e9n',
      'Folio: ' + g.folio,
      'Cliente: ' + g.cliente,
      'Prioridad: ' + g.prioridad,
      'Fecha de entrega: ' + g.fechaEntrega
    ];
    if (g.destinoTipo) lineas.push('Destino: ' + (DESTINO_TIPOS[g.destinoTipo] || g.destinoTipo));
    var texto = lineas.join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
  };

})();
