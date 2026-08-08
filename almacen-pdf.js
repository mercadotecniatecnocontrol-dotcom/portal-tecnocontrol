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
    nombre: 'Hedma Tecnocontrol',
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

  var LOGO_TECNOCONTROL_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAaQAAAB9CAYAAADtChdmAACFUklEQVR42u19eXxcVdn/9znnzky27rSlpezQ0rRNC2mhIBB8FUUFFDF1Q0FkEcQXN0BASEdQARFF3EABUQHtAK/44sKrKBFQtkDpkrZQlkI32tIt68w953l+f9xzJzeTyT5JA795+plP0snMveee5fk++wMUqUhFKlKRilSkIhWpSEUqUpGKVKQiFalIRSpSkYpUpCIVqUhFKlKRilSkIhWpSEUqUpGKVKQiFalIRSpSkYpUpCIVqUhFKlKRilSkIhWpSEUqUpGKVKQiFalIRSpSkYpUpLcR0Tvweai2trbTc6VSKQEQvrqbg07fq6yslGQy2d13ilSkIhWpSEXqAiaqpqbGq62t1UN1j8j1qTjlRSpSkYpU1JAQ0WSU03xs9A81NTUlu3fvnqaU2ltrPV1EDhORQwBMIKIEAE9EssBCRCwiFoBPRC0ANgF4iYiWi8h6Zt7Q0NCwKd/9e9G6ilSkIhWpSO9UQAo1oCgI1dTUeC0tLXNE5AStdaWIHAXgMKVUjKjzo4l0jxu5nwUAZoaI7BCR55RSLzDz01rrR5966qk3c0DQq6+vZwBc3E697rUieBepSEV62wJSqI1wyMyqqqomxWKxk5RSHxaR2UR0oNY6FgERSIA+3I/nlTyfIyIipRSICCICa+1bAF4F8CQR3bNly5bn161b1+6+oyLXKjLeDhoHYBSALQDSwzA3qigcFKlIRUAaCiDKakMLFix4v4h8RERqPc+bEGo9DoSM03RUCCYFGoeICAMQIlLuBSIK77tSRH4N4P6GhoaXo9pcrjnx/2MKfXt2GPd0USAoUpGKgFRYIJozZ864kpKSDwK4EMAxSikwM5g5BAkqMAD1BaDE3VuH2pO1dqeIPKyUuvGZZ55pcAwxHBf/f7yukmdMMgL3vAzz/WWYnlFGKF95p813kd5pgBTVKhYsWDABwAXMfJFSarJj+iIiHNGCRgKxiLBSygvBUkT+LSI3Pvfcc/8T0RAERTNSbwyDRggDK8wz1dVRbeMs2rJlJU2aNEtSqZUCJCN7QKi2NqW2bFlJAJD/M4OkujqF/z9SF/o93/WTGgWpJQxQEayKgNRlDASAq6urYyJyodb6S0R0sGPwLCJCRHoEz2MIOFGt6REiuvrZZ5/9N5ANfjDFLfcOpro6VfMoVH190gz+GottAZnlO1NLKMB819TUeQE4dfipi/T/KSBFtaLq6uoPAbhUa328M8vZEaYN9Q2ZnM/J8zxtrbVE9EsR+Z7zMQ2lKYUAyOzjrr9e69jxYvyMEAYA4jLAKe/pex1/s8qe1Vh/xVoAmHf89YcawY9I4GU/RF30IhEiRcIKpHIuxxABCApCAIKQ/p4niUgh+DRIYMmLx631H1zx2KXX1dXVqWRyABpKXZ1CcrGEAHLISTcnSlvsLII5EIL9QdiPRaYRaDwIMUCMgHaTyCYovE6g9az0OrHyysrHvv5GxwFZotFHrSkc+5zjrl+sdOz9wpYBenoXNV2+rj6ZBuqooNpXN4A357gbbiWl54B9I9kFy37MKBUvMdb/4crHL/ndgH2tOfO9cOH3S1tiNJNgDmTB/gDtC5JpEEygcL4Fu0C0gUReB/A6tPdqPOavavj7N3Z18KMlOpVaVPT97kHy9hQQhr6iefPmTdRa36KU+riIwPd963xDOjdUO4x2G4QWM2Bw7se9FYDwObTW+nxr7ceOOOKIuueee+4n7jMaBXfyO35OmKd16UIrAHXiBwICQboFDsnBS+oWaMKrdJ426WKB6xDLO/5vM5mK8JuGMEaRd5JSHgIcV9lv9CTSU567DUQ9ELHQXiksZ9YAQGPjrH4isRBqUwrJRRZIovKYG+ZpjTPQkn4vkZqrVAJEGkIC4lwBnKDc+ggEJBYW/s6q42/8Owv/nX2dakwt2h5hlD1K8OHYRTBbe+ULjd8ErUuPGZ3h6dXV532koQE2AOKhNVGRYL72So9gS6DsegYrIMLQsVKw+PsDwJYtlYOa7znH3lgNkk+1wL6PSM1WOgEVBrsK5+xSAki5kTCELfy0eqWq5sa/guX+ZY9d8s8AjISAxUMJ3kUaYYCkAHAqlbJOK7pZKXWwtdY6xq970D76cn0OPiphfpGCC+HuRbMBAp+QuHF0CpjoLxCGz+H7vlFKTfA878fV1dUntbW1ndvY2Lh5yCLxhFrZZJjZt0B0LsXxo/B3AESARBiGeyv4cwBf2TcCVSXyX+kEPl24fiecCq8DKNXhS1OiLbNtF7Yxx5VJxClJgcaD7H+kAxglC3CSB54Crhg+q2RvLeH4KXxTINaatCZI2wDUe40UWaRgq479zlGg2BUger/SiYSwAXNGjLEMUKiOUYdcQCIiYCK3rYQIRErRWKUTH1NiP8ZkF1cdd+NdQNutqdSiVzvu2fOeIUIbmzQLs/G5mbx4+QczdMjPgUs/HzDaoQUlIbSySTNbn7MSUcceM6wyHpgzg5nvWcddd4ym2BWAnKh0SdzNN6xvrQSLH+xICqc2e6rDRSAQlFLeQUrHL7SSvrDq+O89yYJrVzxGfwIggXZa1Jb2BDgMq4kOANfW1urq6urvEtFDAA42xhinNQzETyTOz2TgwrOVUtrzPK2U0iEQiUiGmZuYeTszb2PmbSKyU0RamNkGzFIpz/PC7yoAJCI2vPaAJEYiT0TE932rlDq5pKTkiXnz5p2YSqVsXV1dwU2SJFCBDQsKCH4ngnLiYfAeSDlmEbxHUHBh7eHfyL1P4efh3oN0/M19L/s5ggJJ5D4SuX74XicNhUCiiUiDRAOkiUSD3F4IQD37OxE0CFqp8PfgZ/B9Cr5H0AT3PhB8DnDXhs4+M6BIEDyzqH6dg5qaOg+plK1cWDe+qubGn4iKP6Z0/FQRTli/1bD12Yk0mggeCF4gHJB2864VkSbAI4IXjB9KRMT6rdaatAVkb+UlLgPKnp5z/Pe+tX9NXQlSKYteSmQF6xCsLYFiJtNqvFjp2XOOu+GOiJQwdGZwkc77Cx17JNxDAurf/WuXaKRStnJB3d5Vx3/v55q8x0h5H4Jw3PpthtlnV3pFu/n0SJEmBPMKIq1UZC0IGiBitmwybUbECqnYQq31Q3OP/97/zjr+upkBGNW97VwGRUDq8yGu8VKplJ07d+4BL7/88iNKqW9Ya9mFcHsuobWvLxERZmYrIuSAxANAzPyGtfYxY8xPfN//HIDjfN+vMsYc5vv+oZ7nTTfGTE+n0zOI6FAiOtRaW0lE1caYE40xXzXGpKy1z4nILh2QRxSIte6e3M/xEgDt+74FcJBS6q+HH374tyP+ioKtA1NndkMS1RK6t1RSXutmPpcXZY1q0qs9lKKMqgceFh1H9J6dzYXS/S95DZCBxtdDPd3+sxpCba2ur0+aquO/e4oXr1iqVOJCCMesabeACIi8gPlKzki6mhClyywJwYGriBXjt1qQ7KV14qoxMmpp1bHXn9ybhsQ580IEz2TajPZKPzf72Otd5Odicsx2iDiKdLve/TU0oK5OIbXIzj72+o94paOeVzpxvghTMN+QAOyhAsWz832y5mLpetlQYXfCAlmTZraGScVP1hR/as5xN3y5w2xXp4pQ8Q4y2YURZocffvjRRLREKTXN931DRN4AfDQWQTQbuQRVKyLPGWP+yMxPJxKJJ59++und/RxitF7d3wH8AACqq6sPZubjRGQBgI8qpfYmIu0Scq3jJSrf2EMLYfR9910GQFrrKw4//PADmpqazl67dm0aBaowoEJXL3Vm2d1PrUTAJZo+1dl/RDlGuhwzUcf1ibplAMFn/C7MOfibZC1auUApeUaMPKCYD6ZEug+06DdzRB0hlbSzj73hq0Te9wAo47cGwTddTM3U6VeKrIHkjqOLjw4Qp2FBrFjTykrFZ0Cr/51z/PXXlGe87z755O50Pj+HygO9QuJZv83EYmUfnn38jXes+Ffy7IgNt7DmOybAo45tJOhVbOlxvpNJnnvc9d+Eil0jEBi/zYRasXSzBztZeUMzr1DO2ufsa2detKbdQqlR2iv9QdVx36uMtb70xYaGpB+AUtGv9LYHJOcrMVVVVSeJSApAhe/7Jrx36OsJFCXkZerucxaA0lprZoa1dhkR/VlEfnPooYeuyfHHZAuwAtn2Ez2dCHJjpch3rIuMexnArxYsWHC1tfZoa+1nARytlJrmgIndWFVvoBT6tJymZTzP+1RFRcWEOXPmnLN8+fL1hQAlIWaIWAjZLiJ5rlaQPcFZnxJRgGk5LCTK+EUgxFHUCyA2wm2Fuug2Ua9PVzjM0daoC/MOakJRBIjCoUf5qXTVgCK+RHczcf4xgIis81P1NudUU1On6+uTZs7xN1ypdem11rQzhJkCM1F+QTw6GulO+6RuATUEJhBpZt8SaWhVclVzPP0XIPmffEySI0oKURQRxfNNm/G80rOqjr+ByjL6giffvziNZIGj71RE95PuV7rP833cDTeSV/Y1a1otRCgqxObY7aOClIiQQKTDc0rOoURE3QopwZ7WEBZr24wXLz83g+mj9q+p+9y6emSGIyikCEhDb6YzVVVVZyulfgFAWWs53FRZqbhb9V5CjYi01tpaC2vt/QB+/MILL9SHW37p0qWoqanxJk2aJGHdu34GDIgDoS7Hq6amRrnrvgXgIQAPVVdXj/F9/7NE9Dmt9eGuzl02TF16NE9lxTbP932jtX6/1vqxOXPmHLd8+fL1gw52ECpTXolmsI5G2fUWjUYAWBjCfg6z7BydJ6RI65ju7Vrd/Z0znYV4igJ2iGfSmXkpHVf5DIg9aW3oVouLqo+slVcCk2kv7XkfB8xx9nHXfdvzSq8wmVbrfBPUSTIniUjl4raCMIREAp0H2aCNDpMiBRhCFAXSrIwQ8lcoUTrmWdv+5RX/uuw/LumV+7SxO0yhnvVbjRevOLMFrWOQXPxR1C0mJAso/XN3BuiIMKJ64xvZ+b7Ji5V9xc+0msC3SL0lTwdRcqQ0kaZOUaYiELFgsQwBk/OThnEzLrakY7eIxEym2dex8k+M9rmitvaAj6QqFwPJ/qt6RRoBgBSa6ebOnXu+UurnTpPgzrsEPTFuAcBaa+0Y/gPM/L3ly5c/maN9CQAZoqRTdpW8O2ldqVRqF4Bb9t9//1+MGzfuDBH5uud5MyL5U7oHMIpqS5611nied4CI/KWysvJDqVTq9QHnwwAAqRXWtI0T6xsGdOcg7A4DnXTSS4SIyLLIZKX0gSI2Il9TZxMZc4tFemXwe67U25n9dRjhKIzoprgnLV3l5o4ovy5ag4CtaV8GojRJYA+UTkDZ+RtRXSy/ViZRP5UFtXsQeRkAKitrpauGv0SnUovMnOO+e47nlV1h/DYTOsU7lEw3qxKV0MGkoD1dokmprA1JchFbBMwZMFvrHPMK0qHHBbhEVnulnvVbrln++GU3o7ZWI5m03SOQizDMj8yen2kxXqzkI3OOu/FXy5P4XABGBZL+FYX6ZydBoFPCAfdkUQnme/ax1/2355V/xfcdGHXW9zrtFxFYpTytdNyDMKxpbwZkk5DshsC69SoXkb21jo8l5SlhH0EkahBk0VWoIQCIWb/F1175yas3v3oLUskLa2rqvEElPhdp+AEpBKPZs2cvAvBTay0jTwh1PoEn1IpchJw2xvxDRG5ZsWLFHyLyFQGww1zANKp1UU1Nja6vr29ft27dL2fMmPH7eDz+BSL6qtZ679znzffMEXAKNaXZnuf9pbKy8sPJZHJt/813ATNZ/tglXxvoA8459rpzlU7cZk2bBcHrfEKJlfIUc2b18n9ddtSgZjJHuu/kg0JH1gqRIgG3s1IfaKy/dPNQL3AySZzDHXUqcKjXkIr9JIh+Yw0o6qITdqh3lpTW2ktoa9osm/S/GfIiARsB7BASn5g0FEYRZIpA7UvAkV6sdDKEYW0GEGEQhabTEIxuXP74ZVe7cGTuUT3tVVsUz/ptVsfKPjv3eJWQxPc+v+xvaC2In4QBUV1llI40gh40pLo6lUousrOO+877lIrfaE27JeSAEUU16GDXeLEybf32zVba/gLgXwT772U6/Qo6AUedmnl0xb5Q6aPI+O8S4AOeV3oo2zREmIMk3rxmxZj1W42OlV0w5/jr19TXX3ZzX7XTIo0AQIr4jE4monvCSLNoHlB3mrdj0kZr7THzdgBXLF++/NYcRX8kbIRQIwsTfJsAfK+qquo+Zk4S0WcA9KgtdWYQ5Flrjda60vO8+6uqqo5ZtmxZKwbmU+p37Fh19XleQ8OtBrghls8mRhHBW4RUdfV5sYaG2wwGVpJGuq57x7DzXJBgOB78qVYBqaFY//yheJWVUlNTV7Kd8VMiFbeSsdTT5hViHSvVxrRvhUnfAsiflj1+2XO93fzwY66faiR9DCk6i0h9iLSn2KStENjzymLWtP1u+eOXXdKXBNmsnigBbEo3Zk4Q6cB8V/5xk24ZV1Oz+ENBuSIMDpSiUXZEXbSObhvDBAmpqDrxe+XczncQEBMw5+7ncK+IMCsdUwQSazPXKaN+/MKTX9vQvQU5yav+g3UA1gFYUv3e667OZDLnE9RVSnkVzJmcvL2osCHa2jSTqOtn1Hz3wTXJy9cVgxzeHoCkU6mUnT179nwA94iIcqY31Z1WFHlfEJTc8Zj5cSL6wgsvvLCyrq5ONTY20ght5xBqTaHG9CqAz86ZM+cvRPQjrfVexhijlPJ6ycuNglKVtfbeurq6jySTSQyA6ffb7FJRMUWCpMEbsgaoLF/JuTJlPw8Z6P3yKnchA5NcwwxAynP3qxy2QqG1tUtUKrnIbj/u+i9pr6zS+K2GSHndGZgJRMpLaLbpuwXq8mXZEkBCNTWLuxVK6ic1yvOpyzYCuA/AfVXH3fh+sP2m9hLHQnnaZlofbqtInBVoD7V9rrcWFSJI8gATAQLyfL/Fj8XK3rfDqDuBxWcGTHYQzJYDs10+sUh6EJdqa1MqlUxaOfa6L3uxsn2s32aDyEXJN92sdUIJ+E2x/jnLH7/socAyU+dFCqvmdnQmoI5qa4MCrPVByaAbqo6/8W8s9tfaK51t/TabG72X1SnZso6VJuLG3gBgUW1to+rqci7SSAIkhaBA6pRMJvMAgFHM3MVnlM/h70KhlVKKfN+/oampqW7dunXtNTU1XjL5trDXhhqTAkDLly+/t6qqarm19k7P8+YbY/LW5YuCtNMiPWOM8TzvlPvvv//7AL6yp4qy9p5jVDgiF5UH6WCW0QoSe2A5KZUirqy5YW8wLmObFpdUG61p0QFGQQ5ou7Xpry9/7NKfhMyxvh4MENfXw/R2v9ralEqlVsqyx77+cE1N3SNvSfnlZM0JGZbatX+9OI2/1qm++3gi2mYnoaIjrL8jRJpiJtNmdLz0jDnHAW3lN5+z9q/b/QH7lFTn6EoCuTqDPW2mOpVKLeI5NddNA+uvsDXskpfR2RcVVFNROqZE7CvM6dNWPH7lsmCuF9v6ejI9b+mkdIBIICjU13/9+cPe850TyMcDykscb03aWTU63KguoFRb085EidPmHHP9canUZY8Va98VngqV8JX1l2QymV8ppfZlZtOXAAYRsSpIKmoWkU+sWLHiMteFVb0Nq2MzAFtbW6uXLVu2Ih6PH2OM+aHWWru/SY5WlNUYIxqUZ4zxY7HYl2fNmnVBfX29qampGdYST9TdeaahvGEk0k4kNzpsWKm2NqUAiGb+uhcrnSDMtqMAUacZEoCYlCaGOX35Y5f+pKamzgPqXAXqvmoZJAFjSzJql+j6+qRZUX/pNcvrv/6eNf++rCkAh/5oLOL+das3hQa08BfPBhUdzihpSf9PB04MLCFUosAXFTS6ne9ZrsScukh7pROEg0oXuSZIgJjIA7PdSeS/pwOMkqb/4ElSX580qF2iVz9yxVuGSj7E7L+odUwHhRUpJ6eZICKilPKgKAkAqVRt0WQ3EgGppqZGA7CzZs1aTETvc6WAeq2+EPpYmHmDMeYDy5Yt+70rL7SnGtsVhJwZTzU0NPgrVqz4ijHmuy4pVpiDcnndvRxIe77vs1Lq2srKysqI9jW0pHvSSQiduMuQambD2XMxn3a0yB624DsTQLTIWl86pHWJSP6B6cjzSjVb/6oV/7rsz9XVt8bq65N2UL6FQOKOVFIYaPQbdQMCFMlZjSbvkmcyrcbzSj5QdXzFrwGiwHE/EFDql2ZLqdQiW1lTVwGRs9i2C7oIsh3aqNKeYjYXv1B/+Ws1Nf8cfMRbapGtqanzGusvaoa1Z4qwHxQpF6e3S9TMqaxNC4iOm3P8dXMAkoGCdpGGDpBUfX29mTlz5geJ6GpXJFX3BYyUUpqZ11lr39/Y2Pg4AM8x83dCnD8jCHrQK1euvMIY8/XwfVf6qCdQIpdvO56I7qyqqipHz0JmYcj2pVNe4YcgPRgIh3sjhP4eL67eo1XpvmL9wCtCUX0tKMyqvIQ2fuvflz922bW1tUt0Q8P5pkBDjrScGBgY9dTnRLrL/CPxrN9ulC759Jzjb7y7sqauAlgsgymd09tuqa1dEuSYcdmHlBefLEEuQacwRgf+Vnsl2vptf175xOW/rq1douvr310Qc1l9fdLU1NR5y5/4xpMs5ntaJxQELF2egAgSRD2S0BkAUPMoioBUQBqsKYgAoLKysoKIfplrvuvFTKdF5FURed+qVavWvkMb2IVBD7qxsfH7lZWV27XWd7iyQz0WbiQi5XKUjjTGfAfAxUNWITyPuadbs92QQkRXRwNBoCBeTU2dt3Ur1MSJdTxwxgPus/aiaYErAyGdcl46YtSVsDEC+hoApPYMfvYwj90PhUiTiHUprDnaDIlnTIsfi436BBkpRc3ij6EefQ90YAEUZ6tiRFh5R/H2PMYPBTo9MCL4TCS51UIEihRbv1VDXwIAqcqVBd2MQYThYlIlN37HtrWeTdrbW5gZEJU7QxALgSwAgPoTwKgvAslIASQFwIrIN7XWU0LtqLct68xXb1lrT129evVaAO/0bqpcXV0da2houHPmzJkHeJ53tbXW9GH+tQuI+NLMmTPvT6VS/0KBat51q9RJ94Uxe/zbgHlnmLgieYBRQQSSGc/b6v84PMEt9fWLLeqg6B+8QNgnCHfOMg3mwKpYqbam/U8rHv/GMqB25LQqCNdIui93K+xvIxXbS8QwuayhnM4hMT+92/e80g9XmdJfL8Nlnw7QpS+gxAEoiUQQOqgdFwyr89dTYU6V8EHChkhsnhA9YaVKNNu2J5Y+fkUjMBR5QCRBkMIlLbPfdf3tmrwrLbczqHMpLQiIOQNhOfTII28e/XTy4t14p3bkfTsBUiitH3bYYUcrpS52YNSb+souvPsta+3Jq1evXuHG8E7PfJaGhgYDQK9atapu5syZca31N1y5Id2LBhr2croFQDWG0rfmW4AYZDt8up1qb4sFrC1cbKbvR3zXua0DXY0d4Vh8C66cvfDaXWHxnU5GUYVO5WryobUWMHTcY0k/tvw/V/2re8ZapwDiWX+6Zpp4PJ9VGhBWnaqDi0CEhJRA2D4cmPkqqX6kSMmWgzKGzK6wKrK+PwGs9so027brRfy9PK/sMpNpMa5idu7Gi9l0i9Wx0k9WHf2dchOv+3RjfbK516RQw4BmIFubMhItKQi0J/e35uapBEAqF9aNF8P7Cvud5zsKsmDA4k4XkUhDEXKd6tCA/iR+5kqw1XkMj0qYRZGe2qxb5wP4R23tElWMttuzgESuZA8R0c1EVOICFHoz1bHW2rPWXrJ69eonndbgj+D5IRHB4sWLadas/N1EV65cKYsXLxYi6s1kE6YE6lWrVl1eWVk5Q2t9Wh9ASTGz1VpXVVZWfq6xsfEXQ2e6c8yCA0CKFg3NZgUVQkNK5ph4XABip9owrowhEWJal1zWuRyR+5jnhqM7y6gqVyMQho6VI92a+Q6Af9XUQAXmu1wpq5GQAmIxvTcLysUayVe+nCCaM21MbJYCQS7RyNHFbSBQWO7S9YgEAsUQsWr5f676xuyF397P0yWfNKbNUH5eoE26xcTiFadKu9xeU1P36fpkL8mzIgAzxAFi1JJJgmBvBb040da2Mag2bNUMUryXMHcKnIksqWa/TazQC0FEYt3QzHcQNSfsp18lsk2k9CgRG7aljGp7VscSHmzbIQD+sWXLymLPpD0JSGH78RkzZpyllFpgjMkGMvQku2mtPd/3b1m9evWdzmc04sCorq5OnXDCCQoA3v3ud5s+AA1cAivq6uq8E044AY8++ih3U4sutHsra+1FInIkEU11df5UL5qSMPM3p02bdn8qldo5JGaC4DgGlWsiTx3+TsSAFBAHfQA6VKwlyjg7Fcc2ttV0Oyl9el+ssGgl3NzjvkYtUkjBsJmoKeby40TnrCCT0orZbKBEfLWzO42ciFDhzmvYRSSygJUYAFrx5NLPzD5yTibmlZ1p/Nb8mpLA8zO7fU+XLtreBqmpWXxGENnWjZbp7k9OqOmi6EiHhtQyMdjzSvH+RAnFnOl0DrJ9ikkTi93tad4W/GWxdJZqCiZ/AgAaD2jcOue1OasJtMCFH1E+0FWQ8UUIGQGAlEqlpLq6Otbc3Pw1iaBQDz2NWCmlrbXPlJeXfwOArq+vHzEqbl1dnZo1axatXLlSkslkFExoyZIle3meN85aO05rXWKM0VprMDMrpdpFZGcsFttx6qmnbiUiE4KTiFAqlVLhNaNz4TScjYceeuh5nuf9Mce20ZOWtF95efkFAL7t9ILCziFbkLUg5i56QZCS6Mx5BUQkYkI0RYvyswmvK9voPGH5OqhHSp0SKdYs3KeIKGV4CnmAWO7a2FAQ9NBj3rT88ct3YKT5D1gA6tByO82N01DEMgOQwNR49VlzFiRZq8TnrE0bQLxcYCdBzHCr7+nSj29vZlRVfe/zy5Zdkr/2nWUE3UK4U3xgVqhhhsppNSM+xqs4QSwzUQcgZZOQSYNEdpWp0U3odpcUBs6BOoVU0qK68hVSsQWwtkuDWxKAhEHGlBQhZA8DUhgN19TU9GnP82a7iDHtDn7eRXb9jlqJ6NMNDQ2tXUTiPURLlizREydOpHe/+91ZCfzee+/dV2v9XqVUJYBjRGSWtbYiFotppRSCxrTu7DPD9332fb/5/vvvX3Pfffc9LiIriOhRInqlO8BIpVLWzeOfp0+f/l3P877ZF3+StVaI6LKDDz741y+//HJB+iflqkjCDOnIA42aqQDoLq0hCiPRR2uD94lr5Nlk6NKLoiNmTzpJ5r2S5bgodmPrIuULlADMrmp5HbkyNSNHQ2IONCGizvPgJPvOPpw6tfyZurPnHFEH7ZV8LiiR5NrDdAb4mLHNJhYr/7jPzWOrq887paFhscuPizy/uz9l+1eGa0AQt79yl0EECrbzmDvWVISUkDDvePLJr7UP9fSF5lxh3gYGhFnylTsTZoiIRpH2KCCR02w8ABdHkzl74nIu3+jnq1evfml4Qpd714gAYNGiwBF5//33T/M87z2+739GROaVl5dPICL4vg9jTAg8+cJMiYiUUmq053kLYrHYAmZGW1vb7lQqtZSIfqeU+j9jzBuLFi3KRL/o5lGn0+lvK6VOVUpV9WK6UwgKz47SWp8H4CpXP6+g5iJyrKNr9ouAJHgVDpB8wGr0wSrau61OOqwpnfsNBW9S0P2kjzewwbOy5G39TkMRbVggUiwgJUGjH+RfQ+Xm4aCDxnFDw0YXoLT481WHX63iXumZvt/mEyGWT1M1mSYT80rfb3jyb2pqTjgjiI6t1UBwpsM9QpJngaTz/TvIUPZ7XYYcXo+HNT+RIJbQdUxh+xYSgWIp+o4KvX8H8HmZPn36yVrrasdAdQ+xDKGp7iXf979VV1enUnvQ3i4itGTJEh2a5VKp1HseeOCBmwA853nerxKJxHs8z5vQ0tJim5qaTDqdZmutSIdaoMJXpBmfWGslnU5zc3OzaW1ttUqp0aWlpceXlJT8FMAqIqqKAmGUha5bt65dRL4sItJbAVa4brNEdHplZWWFA7XCHQrfDxzOxjmenXM8/F2sBUwBZYkMgmuzDa6d85I8v4u1EBO8sv9314ANTI7h/ykcb/ie6dvWIwGH3+s8B+56wd9cU7/FIwuZLAMm/3zCOC2kk4qS5FRqCQPAsuevOctmWn7uUTwmxth860Asnsm0WCWxj+/YcXyquvqyMcCSjooO1kLyjoGzY0No9n3NzTeDg30Q3Xe20zXE8Kjq6ltjQz19kybNCqyb1o6GMZH15+z+CveAWFuMrNvDgBQevq8E/N21J+ul8ysRXfbKK6/sSiaTe8zevmTJEk1EsmjRIrtkyZJ5999///3xePzvZWVlXyGiiW1tbTadTltjjDiQ9YKukpR1R4S153Lqz4Vh2cqZOjQzS1tbWyY4n/aPIrLMNd2TLqI4oNasWfNPZv67a4Nu8wBpOLfKWstKqZnGmA8FfoCawpoNODSjSZAzEpgmgqgpHgLNgKXTK/usTjIWjuTVsHT+AIuQBC+wiIR/ZxFYVw6DRdy1g997pCDwl31+K5wDMHfMBwsgTMIWIjx5xoxLRrkQjBEjKTPb7JwFJrrovDLECriL6TLQh+vq6tQLL3z7AuO3/NrTJVqYTaf5z64LtPHbfK0TH/HT6i7UplRY0UFYsnuGOn2XO+aSO29xsbZV2AIsJBzuOzd2AbE1gMg4YzaWo8+G3YEpRmH4NgmmibWACIkLEgnnMXwmES426tuDgKQB8IwZM+YT0VFOONA5DDPKQK2rNvDY6tWr/8fda9glChGhuro6tWjRInv33XePu++++24ioqfi8fhH29vbZdeuXcb3fbHWambWzEyu8ytcy3Tk/j/f+66rLUQExhiJxWLxtra211pbW8+PmOu6CwojEbnK+eMoCvC5FcHd+wLgHGf6K5zGaeF8DOL8AGHElDPBiC1wlJ2fjcgica8Q+Fjc+4H5UAWmOFLS8aKgazgRBz8VIj/dZ0lAJKKD5BaO9whHLhGFyd8Ea0DCqsMnE45RSKwvGpiaUOoQpyWNGEBSgXmr0/qFc6zcM6i8vjSSZDIpdahTy1dcdyabtttjqsQjYUMcSQcI10Y4ZtJNvlaxD89d2bAkKLmUZMVWh2uJqM/KrWVYkAcAYrHtQYM98HoxaZCwJmHJHTfEgoRHizSPG9r5DsZ2yCFfGk1sK4V9kFii7Fy6Pel8dAq8qwghhaU++5Bqa2uRSqXAzJ/0PC9hrTVE5Lm2CZ3AKMJogY74zGE/tHV1dYqIGIDcfffdn9ZaX+V53oyWlha0t7dbpZSGKwIbZfjd/R7Rirq8F/m/KKWkvb29JZPJfOLMM898S0TCceSFAedXe2r69OkprfUnbGAn1DkgFN5LO0D6r4MPPnjWyy+/vBKFCm5gP0ju6RSyG0TBBQWFNJQttIbEQTmertWpJcAcTlvh0wmxzdayVko4hiBivM9iL2lhWKUymY0BiHfT/jvotwRtva0WGdcbR0TlFMERsNGqJG6ktQrA0m7zmvaUyc4lxnY4wMIevE7g6F4ulCQWo7a2UadS1507p/JS31MlXzCmW59SzGRareeVfnTnlvaHqqq+djr70qbZadQ5USYShp0702k8Pl4AwJfYasWZ3QpqNCMaru5Se0VY6Xic282BAF6rRSMNTSuixQRASnXZ/mBMEfgI+hzm1lcUJdYHs7weNfMVafgAiVze0ShjzCeMMRDp1Kg4lymzUkr5vr8qkUg8hj1Qvbuurs5LJpPmzjvvHKu1/qHneWdaa7Fjxw5DRJqIdK4JONKXqIvJLBeMcoEp8n8zatSo2K5du648++yzn/rnP//pEfXYpwUpJ5qLyPW+79f2prmKiNVaewA+C+CympoaVRBNyQYGfYgNWs5FxIjAuWthpcDLmI2yc81BO0UkKIgwG2p/cvXq779VcFG4CwUm1bKx6Tdad9Aaolgl2IiEvVddY5xgbAwARwG4a0QxpMD01TGvuVVWu/iQumpKqZQwsJiWNyYvqJrxNc/TJecY224I4uXGkhNBG7/FxLyy9/sZ/y5imxCYjsCPXCN9JLiktHSTAMDKld6GqhntG0mp0cQ2uCp12u8SGEb5YwD+MVRT5wQLUfCrFZWQscaGfbAiiXGiSCtr2ndZRc8H53dlEZCGGZAUAGuMma6UmsrsKvLm14yyDfcA/KyxsTEz3IVTlyxZohctWmRuv/32gwD8Lh6PL2hqarIBbpCXh8F3CzY5wCMIqnVn/Ufo8CGBmW15eXls586djzQ3N//cJcr2xcZlAdBLL7209OCDD35UKfWesDVHVHuL+K7CDrz/hY6crgL451zIN3MHKEca5WVDwgtpslORkhCuLEQ2js/5HsgrqQDqdgxOE2ykwPneY/VsCbTVH7TNnf6VJ5XQTMvMoED4IldmlQDNth0QPr16+levTqVWbt/jLa2ztXRc8jIzQKqTz4/EFT7tNZcseNI6QCXXJM+dM/3LOqZLP+fbNkMgD6DAv+dOBAGe7zezptjpDAOxmQ53QOeqpM6HFOi3QefhWg0kLeTLb5DEDhMWIQrMtNzxPWKbAbGcNmPGJZel1tzQHNk0BSOn5YqwPV/IOLNjVlp1Mf9gRaRJeO2qVT9cF2zVYivzYTfZOUZ4Yrjro8wyh7mza8f9pu/796EjVHw4wcjecsstJ4rIHUQ0befOnSYfEPWVS7vINq21Js/ztFJhQFHgSzLGsIhwLBbzWlpaXheRsy6++OK0Mxn29dAoN6+3AnhPb5/lID/i8EMPPXT+Sy+99BQKkShrbKQOWUQSDkN2FYOGwGTXIW53sMOQCZAwVEa5Kt11GNzh791qvGVLJbnFfR6Qs6Nz0ZEpRcSwVuuSSWnbfjGQvKoGNV79SOjhZV0pJuZI1XbpqFJuIvlYPRaEI3H1R9TyF5NnVx1ysfJU4sxAUyKvU95X8EOxpAMUzJelLKFQZzvt0rAOoFhbD7EnwuUvdYTsAyAoFt96Kr53zG//CkDf6mjMVxiqRa1OIWmrDvzvkwneQuu3MyGSFxjNskYcwtIIADWo0/VIFoMbCkR9DWpgtxYfi/QzcvyEc/v5iGPCf3799dc3YRiTYG+99daYA6NPlZSU/NVaO625udlaaz1jDPr5Yt/3LQAVj8c1MyOdTr/Z3Nz89927d/969+7d97S0tDyZTqebiEjFYjGPmf10Ov2Z8847b30YXt4v9QSQTCbzuLV2N4JSTF2iGCOvsLnhkcHBrimAjy502Oa8LIcZ/oH0XbBCon722kHYdtd7Cw8vjw99QUTyD+O3tUBEo4tTn0Esiv12q0VdOnv/Lx5dj3pTg7oCdvatU7Wo7XcEJYdh1xxdSwnClbP/749pM4ieW7b25rOMab/DQ9wTZr/TWoW181hUdp9wJKrOdt1LHfO92AJAXOg31rSlSaDAVqLXEcsgZmVtmhXUZbP2v2BmfX3SDmR+uptrAJi7/8VjAbkZ1gVWcNdnJGbFNg3x7QMAMAmNRXPdMAMSAZD9999/bwCHhCajPK23o+YkEpHfYhgDGZYsWaLPP/98//vf//4nlFK/bm9vp/b2dmZmnRsd19PLGCPGGFZKqUQiodPp9BtNTU2/SKfTx2UymcMuuuiiEy+66KIzL7rook9fdNFFx3ieNyOdTn+amf/Z2tqavOiii/5VV1fnhUm3/fRr6Ndff30TET2klApNn91pqyFIVQHApEmTBn4w6iOGw5wQ39AfIcKFbz/hIxueHNQ5k0hobbSNQdswHomgS+rStbc0kph/KcRIgjjvjvDl4HcSsUQicU367sOmfnFCPZKFACUKGG2SU0jZ/jbHU+i6hllzenZN+wPylAWl5a/86PPWtN8WU4mYCBvqtF4uTD+aGJvdP2GibCjM5l6/TjW88qPXwfywhiawWESuodx8g1kUVJkmfTsASSHFg2keGA6gBo+qFFKWYX6kKXYQc4Yhoij3LAizgiYx/jpeN+HPABCMoUjDZrILC6kqpd4LYIy1lqlLi+EOAc2Fer+htX4WHRWuh5QcAJgbb7zxnFgs9rN0Oq2cdtHfzcpKKRWPx6m9vf1ZrfVt6XT6wUsuuWRLzv0UACSTST7//PM3AbjHvYK6ab0EMXRHNTU1VF9fDxH5PxH5VC9VMJTTTv9rxowZo1KpVBMG7UeKSNGU23/C1UgrcB6SCEPl1PvpCPBzDvC24T4WjRRYv+gG4swHiJmyEWuRxnMkUBYZ1ip+YCJGf5iz3wVn1r+efCUw/1RKP82LVItalULKppCys/e5oAoKx6x4I/lz55/qW0M6yyBEzK6dGqBLx5z2j2d3+JTWJc+v2v9C31OJLxrbbojI6zCxdtwr16TnVH0QcUelhvrQXBZEzYlSN7I1HwwCG6VTCShnwtPWpq2m2NFz9r/w1uXrtl4IJG20UsRANKN6JM2c/S68RJP3GWPbLUVLoeUEV0ApRSI3NiKZCdY5VUyOHU5A2rJlS7gkc92idFvexrWXUAD+vHbt2t0YigKgecAomUyab3/72x/VWv+ivb1dOHDKq/4xRrGJREIz847W1tZvNjc335FMJttD7SvSZiJaLJVEBKlUStXW1rJLmh0wxw59bdbah0VkOxGNl+6Lx4X5SgcZY/YDsHLQgMQMIZcAmk+Boz6ViuqnyU65sO+uPgfKmiuHO2Mg0ExWrks+Onva+Q94quSjxqTz1BoMQgGNbWetE8fC8uNz9r3wgtQbP30wCjKBJF0p+YCvNvu3QCM6BF9KlE7lcwD5lkeJ8bP2OT+xckPy5sBH1XtgEHNQmkc4EhXohiokEDAGFpdCkoSgFo06te6nF82ZdoGnVeL80KfUxzMWaEg5QRWhJrj81eRjs6ed/6CnEqcbm7GdfDgdG1sbZKynEudVTdtrfCx+3jkNr9y2KwAHoA+BKwTUUQCCSQuAZu/zheuVeJdaP2NBovL3SxZWFFPWb2/c7bX+EqhTqWIww/ADUsgkRWSmMxVRL+Y9iMhzUYl/qMEomUwep7X+tTPRdTJFdhc1lwtGpaWlOp1OP2GtvfDKK69cFl5/8eLFlois04i6fNVdr1CgKwBo3bp1mw844ICXlVLjnQCgu5lrq5TSxphDI4A0cP3IAkpzTg5LxzwGVaQL3H6CcorQRaRtAQHM0MxeDeq8rYCaiLqCM4EgGCGXuTQGEZRMV7Ck30egUjALCBQdI0RAIGVN2iqlp4Dxh9lTz78HpK5fseFny3qToMOwgsqJF1Zoj0+Fsl/WpBew+PBNm++p2A9n7XPu9voNv/hNn0Cpi2k1ErbI4rK9BjqFJCkIA4vV8vXJL1RNPV97OnGOsenO/ZS6Fn+LmAx7zIMixd4VVjIfJkBB3HznykUEbUyr0arkY36Gps+eet4XUhtv+0/k5lSDOt39OiclBWDW/hfMVAY3KfJOsjbNlD1n0gUFBWAo8SBy+bp1d7U7ACwC0jADEgGQadOmjQcw35mIutM8xOX2tBDRow7MhmzBamtrdTKZNFdcccVCrfUffd8vt9b21leo6wMSmUQi4bW0tPzs5Zdf/updd93V7oDOOrAb7jUJK1r8XUQW5MuBygUKIjoewB8GfWfmDrNcR4iz2wiOmRW8dJBFIAhznn4XCiSQ9Nhx2+rfHO5IppStRa1Obfz5mjmTz7tWe4nrjKR9EolFdnx2sARosT4LQJ6Kf8py5vTZe5+3kgRPgfgfwvKiiG5hbUxMlLIkJYrVPqLoaIK8i2BmEelpIoDldosgIN5jy6zJu3P23p9/q37z7X/uFZRc+4lOIcsgB5xwRUEHcywDCSKYm1vPnTP1vFaPEv9tuN0Q4AnIfUI6t73IgqN0w8aTDNTqZRt/8uKsyedcEfNKb/Cl3SiBl4trgfZMnrVtVlOsigSPztn7vH+x4Jcarf9c9uZvt3QX+XbI+E+PLouVzhei85CxH1AqNtradquC+NI8uhVBINajEs+37UtWbvrFH4umuj0MSEqpvQFM6sVcE+6ZN1599dWX0EXUKKhmpJLJpL3yyisP9DzvPmvt2HQ6zSqMx+67mc6UlZV5zc3NN1577bWXRIFuTy8MMz8RyXXq0VQmIrMKM99BHTRhgZB0UlgC8zkX1GTnA9AQkNhOPKsj6ZIhIp63c/vXZk05d4cIFHEgEeXyNKU7Y1yPiO8MyQwSUp4mNsuWb/nF310mqURMSVyLWp1689YbZk0+5yhPlZxmuN0nUCzCGXOFCRiTtiBKKFJHgNQRAF8gyoCEM1qUq01BcWhFCtopWgbGZthVR9QdHJgFIorg/W7WxM9/oH7r7U/0CEriWjx0qlId7Q7BMIMX7CWFFNehTiU3Ji+eM/mchKcS5/sSmO8YnXswhe5Icbls3O39w/n+5Y2zJ5+z0FOJj1pu90HBfEsXnya05TQTqbii2HuJ+L3MJW/N3vvcfxPLSibZQURGggzr0SSYDsJCIbU/kQ7m3KQtUQBGudgZ4DhbreLa2PZGq9svDMBoCe+BwjNFQAqXXym1FxFRT/6j0HwlIpvdcha4V0+nMSkRkcsvv/zWWCy2T2tr0MOF+yH5RcDoju9+97uXhH6iZDK5pyUfcXO+vg+BGeQ0pAkFAaSg729YQLOLXExZDenRgjxozM+AlcomHebwz9BHFvcoXpfVRlSnHx2fj3xdderOl7ub3a5UQd03TQmk4d8J4O+1WKRSne1JkkJKAELa//RZyqN9PUrMNxLxm0jeBdQkIlasIKyXQKQAikc1FhGfhYzjs0IEUtGgCXdtxbCsiEZpUn+cM+msE+q3/Gp5t4m4zOiu1XywsQSqMDtckkjCAcgXZk38vHg68QVj04ZyOs9KlMsrgeIegU4AoN1v+1yJhwM1xQ83nO6Yb+6ytkqExSLNCNIFJxD0KUTqFBUVcFw+XRDAZ0TEMIgUAbrTNXNM+Qoxzdbf5lv+6Jo3f/PWatTqXnxURRpCQAoX5hAntUt31RmQbSrKG/NYkge+6+sC3kPJANyW1NaqRcmkaWpq+kFpaemJTU1NnZJeu/MT5W60RCLhNTU13VFeXn5uXV2dqq2t5UWLFo2EjRZw4Xh8Q3t7+6awMkau7y5awUFEJk6cOLFi69atzRhQYMOjHYwaLneks5LsrOjKNV47AQVLRrICIUbXhrkd/zdot11L3XUDOv29O7EW6bFIJgN1au325O654z/7EVaS8ih+tJGQSXYdd5grSp26zYUGIYkqYgpZTSZSPkk6q4oEUiy+VaTHi6iH50w4+93L30q+mA+Usk34RKJifkeWqbjWDgXaq2Ho9cqtyQtmTzjb81T8HMvp0A6bMwZki6b2Zb7njD/nVEv+g1rFj7Dc7hOpWA7CRXeCi4yzwjDcJUQua6EPavRCRHeyAeaU4BSI0Yh5AK/32a9ds/2uNUVT3fD4K/oCSAdHN3wvjfneLBQgSR0UJcGUBEsd1LPnnRdblErZ2osvOTvueV9uaW4yxhjPGAPf97MN9cLfw/9HX5lMxniep9va2pbceOONnweAZDIpg4mOGwpAevHFF98SkVcjMn2XuQ87LwAYX1FRMXXQ886+Kw/EHaa73N8LqCEFaUgcuSfn3D8sZSQaIl7Hi4Of7F7S04t7/JsIe8TcS4JlkJv0wvZfb4Df9iFj049piXnMbISZu45bunseEhYScT+zn5WcZw5/t+EccKC1KghkG7T4wT7J06m203U61kwiicZc2GRjN446teKtO871bdvPlMS0m5vO+8b9zr2WLgrme/n2X66Hbv4g28wTGolY0A7Dcud5y30xBfsFbu07rb8WFhWMp7s1s8JsjRLPYzavGb/llNXb73qyBjVeEYxGCCAB2LtbmxF1KgsNEVlXoF2uKAl+rfbIA7d88vhDKQmef9ttfvtHqqZ/ML35pu0M60NpDem2H1NYUSJk4tZak0gkvEwm8xwznx9pmDfSVHDtTKAbOx6lxyGWp9PpCQURBFxAQ1aSjfQDGqrE2I7eN9F75blv9L1Ii4LO48z9vSM5s1P1gJBJdutk74ZJ7rpnx67tze9nm7ldi/ZISImwBbN0ma/cMXYZb3fPHH5fGCyWRCklSluTvssz249fvuXOV7rVhKO9h3LuIWGliSERogJQatx+14WW0z/24HlgNtExZJOrs1bRR3uZ71q9Ysvv3mTddJLl9juz8x1cV/LOL0v+de9xP4X7gS0JyEPcY87UW24/oXHXPUvRx5D7Ig0TIDHzGMfcJbdUUOT/yuX/bBwsk5e6OkUAr//40SeP1okGYfvM1o8f+7dNHz/25O2x8p9/cverY87e/AIm2nbarRPZVq7R5nnI+T8zczwe94wxyzKZzCk333zzTqcdjcTQzSCW3NpdebSi6Itc7UAiorGDN5+FHUVtR9me8LBypDsrTigcIrHtzKQ50tW00/87Sgt1HleeUkfRcjUSFhu1OWDEHc+LvvKaAJTWI9W2YuevzjG2/ePC9hUtniYRErZWxDKYBTb3mfKMsdNzZudcwJaFrSUhpaC1sFluTNuHVu6666wXdj240yV0SjeHNbKO3NGNNwQjscDQ9JUTICm1qNUrd9z1JWvab9LieQF45Kyn6euRC/KTGremmlfuuOtsK+kzxfI6LZ7nKmVYsJvv7LyG9zI5TQGjJapspDSVFWFrhVk0exqWm420Xy47Wt+3auc964KqGUUwGlGAFE0yzWX6ebSSnYMZUB2gkEzK1k8cMzUBdZsmjBPBmFKt3quB/41p/e63jMiMtp363M3LcNzON5BRGu2koCS/tuQKn5K1dosx5qM/+clPNrpIvRGdR6CUau9NMw1VJ6XU6MFqSEG3UZauLxEwRNh1YS2QyQ4AxIpIIOhk78funhL5yexawgbMJ/te+LuIdB6z5Hw38v3sNdxnejch5YISCKhTq3bfvUSkfYGx6e8y804tcU2sVGCWE8ssVlisMDMzC9vIM1oWdhIec/hZZjCIRKvA7GVXGT99ccmuHQtXNd37ZwdEPVaXZisdCxXOVzg32fkbOnNz4FOq1St3//ZrxqZ/pOF57tlELIuwlf7FOnXM98qdv/21oO0Ia9M3wkqTlpiGm++OOQzmsWM/dOyB7HxL9nMgJlIS0xCBtZnfCGeObNzxm+sakcoEya9FM91I1JA6MfqolhRh/mHEV+tgNKRTqqs1AZKx+O6omDel2WefRWS3b6wVkYxhIRZqFg0xjFO2vIiz3liKyekWtMTiLrxPssDpir3CaRzn3HLLLS+7PKMRn9TGzJl82lH09yD4UcDMscLcFARmDdeVFQyCCAmzcvXEVMEe0PfhaoaREigSEFyXV7AQJLg3Il1hEf4MP+e6FYSf6/RicR1jg+9J9v3s3xWJ0ADMWAIkuRa1unF3avuqpruvEPCRljNXM5u1YGYlWnuitRKlA5MbZbvbQsKOtqSUaKVFay1akygF5l2WzaMi5rOZmCxc1XLPjxrwUGtY367Xc8Xs7iGauGMe3RzpwHdlhzJmWeACHRqb777YcPonnnja3V+Rq2w0mPlubL77EsA/ylr/Wmb7CpjF6zTfFJT/CLoFu59EWpQi0UpDawWtKShPt4Ft+ucMfldj892fXdn8+1VBKaJiW4k9Qf0r+RHtk5PnM6E2MuCdXFurKZXy36g95txRMe+z2zO+VYpiLvJIsw1sv+zswyyCXfCwb9NOnLP7WTw1bh/U730Q2nQcZSYDBoSUsjHP83zf/9wtt9zyv2F1h7fJ+nC+eY+AEZgZLv1q8EzGighZCyAtwl6nEmgQhlgNSGHnTjjD+cPsIklQgCJXlJMI0ikKLew1K10VRInkrob/73RtsWxtjHhgjhUnPQc16JrufQnANYfgpBsSFWMOYs4cC+A9gBwAockCjAZJqYB04FGntBCaIeYtAm0S4HkofoREVqxqSW0O7+Eiu7ivkjoJW8vWECTDEE8FmyhsnWEAG6chLuflACQYe/O9F1WWfqJVkf5vgH0rtnSgyWyd5rv596sAXHUITrrWKx99qLJ4lyV+L0D7UZAzOQZAqVDQ5RFA2hKaSLBVQBtA8jhD/qZa5cVGpJrdbOuga3CyqBXtSV9FD6QB2KlTpz6gtT4tbFvei3mvZv369f9CP+vYSV2domSSN9YeWxnX8pQIynwnTYbO5xCIgqihMGoH2dbMpZkMtpSU4S/7zsRL4yejJN3Oo0tKVUu6/Qc333zzV4e7UeAgBQUzderUm7TWX+ll3q1SSjPzZzZs2PDb8LsD2AdySEXtRG31/h6xL51YedA0nAGtlWpd2XzYmpwIrwExmGqcXNZWVjp9uCZVoKnzQ1uxwp4n3psr23//BgZVC7BOBfXRugJHFc4oNyXpCaxptBLxLMFao1pLS/T25bvu2ZFvPVyhVe7HeAiATE/UHqh0bLyGMZ3XMGirZ+F5HvH6FS2/exMFaerYJ/4i08tPr4qJJiMqpsmub2xNbR6q+a6cWFshTbEJYs0oFRPP+rBxFWvZXdKyfd2uB/O4FMI2FkNmnqNet2aR+gdISqnTmNn0oFWFuTInb9iw4U/9ASQBCLW1CuNeUZt2JB6viHlH7k4bVoDisLw9d4CSsAQVbiKl74UFRoC4MSDDeHbSfvY/h1bqt7T3vwt37jy9AcBtt91m3iaLHwLSLUqpi3qZ97Cz7Cc2btz4+wECUkHMv7W1tQQAqVS/GOmIOQu1ta4QaioVqlwysDMVFu8E0CdQCZlrXz9fsLPfqfZBP3lDH492Ni2Vu7l/Ae5Zq4IitX2dv1odKWorQzDfuXuJ+3F2hrpDAhUQDMN4sk78aDgA6W6l1KeY2SJ/oU/AtZ4QkbM3btx4Z78AKTDV2fUfO/qb4+Oxa95q860CtES0oY48BrjIKnS8F2pMVmAtASwob2u3b42doLeJ/s57nnjiSpebp+jtURAxBKRfKqU+34uGxESkmPmkTZs2PYyBV1inmpoavXXrJNXYmMrkyhoLFx5d4vuJct/PKKXaRGstpaWldvv27S2NjY2Z3IvV1NR4kyZNkt7BqU4VcuJq0UgrK6EbGytNrg9g4cKFpb6fKPfS7RoA2pQSonhm7Fg059OcnUZtC8CwCKij3HGmhgR8+jKfQ8KE+zGugt+famtrVdiZoLm5mSoqKmRS/STpXGV9yJ9b1dTUqHx7qaqqqjwWi5VaG/jvYrEYM3NbQ0NDa5c9XBtobCNcsOuuEo8ahDDXN0CaMmXKTUqpr4hIT4BklFKetTa5adOmxX2V1EMw2nD6McfFCI8aw2Kc85PDfAEbMdFJAEqhViQsEBe4I9YBlhFYIcQzPpeSVs1G7o1x+oKDX3lll+BtAUrhvN+nlDqdmbsDpGw6PxEds2HDhicHAEgU9rwK3zjqqKMmi8gsZj4KwPFENFVERgGocCWk3A9hImoGsEtEXgfwuOd5/2lra1v5wgsv7IwesGE4XKq2tpYiz0HV1dWHa60XiMi7ARwiIuNznwFBNtRuADsRVEx/hIhWPv3008vC8brxD4XkSnuQ4fR2b8I7w5SUuy8KTrn7e+HCheNFpIqZj3N7bxKAMURUEjk7IKI2d3beJKKnmPnRWCzW+OSTT24YprMz0DUOwagMwOkAjgDQAuAvAJ4YzLX7CkgXE9EP+whIv9y8efO5fQEkERAW19Hrzz4yxoubZ+JEB7dmLBOgJJLYFs3EDqqfhP8PwAcOlMRCxAqF5jxmAhvmsaRUc8YubUnbj83fuvblEQ5K4UKqvffe+3Gl1NE9zHsISE1KqeoNGza8hH7UEHSb3QJAdXV1DMAHlVIfFpH3a62ndqxT/sRjoCP8PFqN3Fr7itb6/5j5d88++2x9vvsVWjoOr3vUUUdNttZ+HsAHAbxLa93vZ3BRpI8R0YOxWOzef//73xsLxBwUAJ4/f/4vALz17LPPfmOI5iS/juJSHRYsWPA9rfWx1lqfiDwR2dTS0vLJxsZG48Z3oed5n7HWGhHRBV0sotCSspWIPvP000/vdkz8Xcz8PRevTr1cI1LzV5iI2kVkFxE1OcFiA4BnmPnZiAYyKMm9h/XMXnP+/PkLAHwWwClKqf2jZ6K7OI5oGo0LYNpGRH9j5gcAPNjQ0OAX4OwoAFxdXX0wEf3G3ddqrT1mvvvpp5/+cT+uH/KXYwD8BMBmBHkgewH4FIAnAZwJoHUg893XKLs10crT3e0Th/qT+2ybXFSrKJW0605ZcEcFxQ7e0R405coGL0S1olAzsg58WCA20IpgYYUDrUqsiMvoUGSZiKF2GGNGiZonTH9pmDDjBLy1ZlMdoJIjWFOaNGnSRCI6OLIJ8i6NE7e2MfOGftiECQClUik7d+7csbFY7EIi+iyAGUqpsJV7yHhDaU562B8UYehaKXUQEX1BRM6fP3/+C0R0544dO25NpVLpAkt8CgCnUik7f/782SLyDWvtiVrrSQ4Y4fu+dfMkuePNYW5ht18CoLXWxwE4Lp1OX15dXf0Xa+13U6lUYy/mir7SIfF4/Jzq6uqmVCr17eEKtmlsbAyrqcxVSi1kZmitkclktmQymejZPlhrvTASwVkwck1X4fv+dqVUNlXBGDPB87yjB1NNPhqJaq2FUuqNBQsWLGXmHzc0NPxfgdaui3B15JFH1lprvwJgvtY6xsyw1nIYcZxv7+XZdwCgiGgvpdQnAXwSwOoFCxYsYeabUqnULidQDBhUrbUViUTi6FDo0lrD9/2ngU6NWPsCwEcC+B8A1wF4BUACwCMArgHwUwAPIcieV4UGpDDp8s0w/7IP2taU8Pn7Yqp75UNH1lYo9ZGdbRkDgRbLnX1DoUZknenOIusvcoAk5VA6YwUZn21MSMeYdKtl+EZEMQhWvN3W+KNZHZo2/q8AnLQYdUgiORLNEgRAPM+bKiJhyw/qaX0AvLVp06bWPqrJ4YGUww8//KNa6+uJ6JCwEoe11kY+o5RSOjcZOsoAcipJiIhYay1Za4WIPCKaR0Q3jxkz5hPV1dV1qVTqbwViDAoAV1ZWxktKSr4G4Jta67IICIXzo4io22fIowVaANYYEz7jBK31GSJyenV19c1a6+8+/fTTuwcpsbYYY1gpde0RRxyxob6+/lfDGQHKzK3GGGut9V3+WnPOR1qNMRlrrekDj9B59mRP68qup9rORCLBkfk3xhib0yG5r4JLbk13BcBTSu1LRPsqpU6ZP3/+7UR02TPPPPPWIPdeVJib5XneNSJymlIKzAzf903EjK5dFZVeQdrVFzRBPi+LO3uHKaWuBlA7b968y5PJ5IODOTtaazbG2A4ZwHgA0v2VKQD8AMB3ADwF4D8A7gSwCMBiAGcAeB7AqQD+2F8XgtfHz22z1rYopcqjGyZkSDkMampvlacFUJRK2Vfff9QBceFb2tOW2bACQJJjpsv6hrJAFJjpgkg7kTgTtVj7ADN+yGy3pY2arBifL/H5Ix5TRTOzaAsSK7GdbMwoq05cqg4683BO3imAHoacjAGZUY0x+yql0IuZFO4gbO2j3VYDsAsWLJjAzNcQ0QXhznTVOEhESDlyWkYTEW0ioi3MvJWItgDIAIgDmCgiE4hoEoC9iWicMwNAJKjB4Bi7aK2PFpGHjzjiiB+89dZbV65bt64dAwvAyJroqqurjxCRn3med2QIRE5jBBFprTUiz7DemXLWOZt9RkRKiGgqgP1EZAoR7aOUqiAiWGvDuWff94WISrXW37DWvnfu3LnnplKppQMcP0REu1JbRil129y5c1+rr69/dBhBSbmxMwAtIuqQQw7B2rVrw/GN0lrHmTneG4hHC7WG2k9v4O/md2I6nVY5+15HzNAIhaH+aF/uJSJiwgACAOR53uettUdVV1d/qqGhYfkAmXq29P38+fPPBnATEY1x2lD4zEREOgQoa+2bADYQ0Rsi8hqAXQ6sRovIvgD2JaJpAKZorT23X63LMWRmZqXUTM/z/jB//vxbW1tbv97Y2Ng8CFDVoeQoIpqZqR/PzgAmANgXwK8BHOveuxrAge5FAO4C8DEHSP2KnOyThrRx48ZNkydPbgSwILphctRr5cBqChEtBPB3dHQ/jV4w+G5NjfeaNP02Lnry7owJouqiQGSRY5pDR3CDBcBiYwzlM39x5qurfxq5xSoAj6b2mXnU3i3m7r3b5aAmAZMVJSyUZhaGXPospvwe2NQW6R820ui9uYDfwwFf2ptPMGR28+bNq7TW/kFrfagxJjxIHjNbpZTSWmtm3snMf2bmvyilHjnooIO29KINqHnz5k1QSh3h+/4iIvovrfUBITARkXLdfMnzvK+OHz/+qDFjxnxm2bJlr/ZX06ipqdGpVMpUVVV9XkR+TkReJpOxUUDVWisOqlr/CUBKKfV/DQ0Nb/Z0gGtra/W6deumGGM+DOBDInKS1lpba7OqXyaTsVrr+Vrrp+bNm3fh0qVLbx8IKIVrysyilIp5nnf/4Ycf/u76+vplGHiUZL9NZ6HZBkAIRuL205OZTGYvEfG78SGRA+uJRPTBcH6UUsTMK0TkWReEI/l8SCKiiGhHLBbLRIWoqKYNgIwxTwJYQ0S6B0GLECTKlTrh6EAimqq19kKhgoiU7/u+53mzrbV/mz9//oJnn332jX4y9VAjrygpKfkZgDPcHgvTLmwIRNbaTdbavwC4V2v9TENDQ0/tTVBVVVUej8enG2M+DeBkrfWMCDBpYwwTETzPO7+kpOSoefPmLVq6dOlLA9HS81V96SdVANgBoMnNvXHmu0oAn3HvbXNr0m/qCyCFwQlLASxwTkQVfcAI4wwdZdUOkLowyFRtrVqUStm13u5rJijvXdvbfUOAZ7lbk1wQ3BC+zwAbNmOgvR3G/mTOG2t+evMhhyS+vHZt+vjKyop0aempFvjUt4gOyChMSL60G/N2ZKgZBAXS7RBOQB1mUXo0AY/IMDGA/lhU3M9jwgKqufbxyMYi95l/97bO9fX1pqqq6igA/yMiU9LpdBi5xyLCjvluZebbANy1dOnSsOsvGhoasppJl/V00WdLly7dCuBhAA9XVlaOj8fjJwO4VGs9y1ob9tKidDptPM97FxE9Om/evFNTqdQLfWUMIajOnTv3K0qpmySw81gi0sxstNYeAPi+f49S6sfPPffcf3KZSpjvkfsM7mCvd47an8ybN+8YY8zXAHwUADnG4/m+z0qpmFLql3Pnzp3wwgsv3DAQzSY0gVtrrdZ6PIA/zJkz5/jly5dvwNA1twyBEE777lQWLASCZ5999ncAftfbdebNmzeXiD4ormKcUsozxvzx+eefv3IgvpgIk2SttTbG/Hzp0qV39efZjjrqqMnGmEMzmcyJWuv/VkqN5UCNi/m+bzzPm2yM+W11dfV7Tz75ZJtMJvtq5paFCxeWtrW1PURENc4srJwgHp6fbdbaH8bj8dufeeaZzbnPme/CqVSKly1b1uLMXM/PmDEjWVpaerKIXK61nuNAT5RSKpPJGK31PACPVlVVnZxKpZ4fjEA0QNoKYDKA/dy8xZ2m9AiAewAcD2AuOtoQFRSQopv4ldyIpTwPSG6DL8hhrgCAJbW1elEqZV85YV5NgujSne0ZK+zyjaIBCxEgCowmHT/ZCseZdLMxG9O++vY/a2q8d9fXp+fOnXtks+f9goiqAKDU+aB+OK0MP9rtI26DVSOAE4DaDT4YwCOPooYK1myuMKYUnjZt2j6ZTObgqP8oB/izn3fM5ZU8tvSoim7mzJlzBBE9RER7OT+RF0p1zoRyuzEmuXLlyjeiB8gFIACA9CCNkfuO2rJlC9XX128H8Ouqqqr7AXwVwKVKqYqQqRtjjFJqPxF5aObMmceuWrVqXR+YcAiqX1JK3RRqXBGG4DHzcmb+5vLly/8YBaDIM3AqlUJvz5BKpWTp0qX/BvDvqqqqk4jo+57nVbpADwolY6319XPmzEnX19ff3B/GYF2DPGfu0r7vW8/zDlRKLQFwHDo1ci8chc+epy0L+gLcuabfl156aWz0+85EVVZbW6ubmpq8UaNGmV7Gk72xMSY0P0el+Iq+Xivcq0899dSbjhk+Pm/evN+KyC+01jVOy/AcKB1vjDkvmUz+pA9aRjgPqqWl5bexWKzG930fQExErFJKK6XIGPMrIkq+8MILr4XCUzQPrw/3IJfD1ATg3urq6gd93/8aEV2mlCp3OaDh+Kcqpf5SVVX13mXLlq3oq6aUyWSyJtVw3frRG0vcurc6jegGAN9EEMCQBvAlAF8HUA2gFsBJ+TCgEIAUNod7IkyMdREinRil+z2UoE+cNGnS5C1btrwZZTQTXSQHC88sh/ZafPaJSWcDFjqZ6jpMdFlznXXyvIVqF3x+/rbVm6h+NebNm3cigPuttaNcKGtMaY0SK9gUE/xnjGdO2u57uyno0K2CikQTRqCZTgHgTCbzISfZZf1H4SaKgFIYPruKiF7LB0guKsfOnTv3SBF5CMBezqmpRcR4nudZa1+01l7c2Nj414jEKv00BUgOgwn9PC0Arpk7d+4DInKrUupdoaPcGGM8z5sWi8UemD59+vtffPHFt3pgwhqAmT179mlE9CNrrQ33mvNXKGvt4tbW1h+sXbt2d8QX0RMA9fYMCgCWLVv218rKyqeZ+etKqctDHwUAZYyxWusfzp49O71ixYqf95UxhLUJIzUKtWM0R1dVVd21bNmyM4Yy/yTUkEJmlEdi7su82aqqKpsTsgwR4VQqZWtqauivf/2r7e+4ctqrDORahCBBlerr619auHDhB1pbW1NKqQ+586SMMcLMl1dWVt6VSqV66rKc9VdWVVXdo5T6qO/7PhFlwUhENvm+f+GKFSv+EDk/3E+NWQBIfX09R+7ZCuCaqqqq/xGRHyql3uMEOc/3fau1ngzgwTlz5pyYSqVe6atWHZ3f6B7oh/VGAbgEwF8B3AzgIgRRdo3OZ/QggJsArB6Ipq/6elDLy8ufYebNIhJKiKHjF9baEG3JOfhGW2sXItLNHgBOqK+3ApBuNX/Y1px5rcyqmM1YloyAM4LsTz/ycu+LD1ifbYWvdGvG/Hze1hf/KoCaWVlZkclkfmytHZVOpzMAYtbajX4mc5f1zZeg5IiZzfZWDQ0lgQQbQL2MxJp27CToE0MzV3hIo3Pt5j8svFrvIuxy7eyUTCZRWVlZwcy/IqKJDgy0iBhnY/+ntbbGgZGGix4qgLkoBDSqqanxXnjhhZVlZWUnWmvvVkqFmplnjEl7nndEPB6/EYDkMwmGfsiZM2ceqpS63c0JRYv5GmMuXLZsWXLt2rW7nWZXiGdgAFxbW6sbGxu3L1++/AoR+SQiEWkioqy1rJT66bx58xakUinbnWmmNwYRgrTW+tNz5sz5vruWGqqN1ofOzwN5hgFrbaGWVYDxCABbX19vampqvCeffLKtvb39LGvtNqdNg5lFa72PUurDoVbcjTlRpVIpO2vWrCuVUp80QYROzPlbNTOvUErVrFix4g9u3cN8OCnU2Vm2bNmK1tbWDxlj7nFWAEtE2lVvOUhEfrdw4cLS3nzIBTLbhSHnzQDeDeBFB0Kr3OvrDqxuQkfQDIYCkNS6devaReQFJ8lwD11awzc+g5zEKAKkobraO/CZxs2mNf1f7Rm7NuYT2QyL+Az2BWyCn5JhcASgbMZyiQ/VlDavQszldTU1HgVDOQbA9Ewm4xNR3Bjzp0wmc+TKlSvPer5xxY/XPbvs+YkZPth0Wi0BQ94Kfh9Z5rqpU6fuC+CDbhp1xLSDbpr1vZBvM7pDxkR0ExHN9H3fiIjnHKWetfbRlpaW0xobGzfX1NR4jokXWhoXJynqJ598sm358uVn+L5/u1JKW2t9pVQinU7XE9H3HRh2qXdWV1eHysrKuFLqLhEZ5wQeFTE3fXblypU/c89Q8Iz8HObwO9/3zwgiczls+yEiQplM5hdVVVXl7hmoLwEFEY3ANS8Sz/d9o5T66qxZsy51kYSxoQSj3Ei5/pAxppNWw4Nsjx5+PyrwDoZCUHrxxRe3MfN9RERh5Jqb82OB/Dk4obY7e/bso4mozp0fHQYaWGtXish7ly5d+lJNTY1XIEEu79lZu3ZtesWKFZ/2ff+XDgiN2yu+UmrB7t27v+OEJ9XXOc7jP+wPKBGCCidfcj6jzyCIqlsA4F7kCWYrJCBFP3dvPgd77mddD6L3TJo06aAQ0MI/zneZx2Rjo5GWsTbDQFYTYiAd0ZQynP0daWFkQBljLzl817qd2zds0O5QvNdaK9Zanclkmn3f/8JLL7204cz99y85r7o69gQOmq2gTmgLpl4B0G1By8xVzkMnIwiQKJ1O1yilypB1eaG7LrhaRHwiejqPuU6nUil72GGHfYKIznWSnReaGZj5MaXUya+88souAGoYQo3DZ1GNjY3nGGMe8DwvZoy5QUTet3z58uXd+MDCJorfUEod7Z5DhblCzPyZxsbGe6qrq2PuGYZqLaW+vt5UV1fHVq1a9aC19tMusIdFRDvT3VxjTE+aXl6NwjEFcv5AFhHtQOn6mTNnntHQ0OAXGpRywLBg4DYYMMoHlIWg+vr6kIHeYYwJQ53htOz9Ip/porlVV1fHrLU3OH8RuUhCxcwbM5nMKStWrHiztrZWD/H5iZ6dc40x94dWBgAxZ8b78uzZs2scKOphEEbCOdUBC8UTAJ6LmNd5MEywz6YkEWlwG1nnPlhkE5EzyYw1xnwSgNQASgASgBpnV16+dmblfdbwn7TBXn6GRXwJGh5kEGhJESBy2pEd5SuvKW1/W9326v3/BLxb1q41TtWv8n2fmFkZYxrXrl27CQCdte4Ac1tDg5+AXFEGVSIQSwCXQMGHNAr2elYAWjRyIuysUzC/0N3cRl7WzfNz27Zte8FtDhvRlKSysnI8EX3HCYPKZY0TM28yxnxi2bJlLc7MMFzVKiTiXP2CtfaUxsbGy1xh1nwZ3QSADzrooDEi8iUXfq1Cc4m19vbGxsa7q6urY2F5laGmhoYGv6amxlu1atXvrbXXhOG+ALTzzZ1XWVl5ZCqVsnV13Rc5zQUDZt7BzGtc7pcA0C7/5KeHHXbYwoaGBr+/psD+MKXBMP/cawxG28oNSR4swEV4l3iet5GZ28IsVXePMVH+luOztC0tLZ90JZasO0PiksfPevHFF1+NaEbDdXYok8mcbYxZ7SJL2QElrLXfQR8CYQoI+hIFy1CgxiD5qerHzWn8+PGvAFjezSLm05IumDBhwqgvBn3SZPWMyq9OEv2dONPp2mCf5nYj8EWFfiLu5DMKNSXmeIZUU8ZsKDPmUgHU1kg2uLV2XMSvshGAPQ/V3rtRb57Gge8tAT7aDBskAAKIBc06fz8fDf6jvUgTw0gagEycOPEYIjo6ZEp9+N7DbgNkP1tTU6OdVfUTSqkDmTl7mAAo3/cXr1mzZuMwHqZc5kBr167dunLlyocim5jz2e8BSCwW+4pSaq9I8qH2ff+lRCLxDQC6oaFhWH2B9fX1tqamxisrK7vG9/3/OMZgI2HciwEgmUz2xWQnjjGkmflT1trVDnTF+QxHEdF906dPP6wv0m9/QCRqGhsoYwpNdlET0GBAJGpGKoTJLkotLS0ZN8/R++TTPAkAz5gxY5SIXBVgkZBLd9HW2htXr179tz3QW41ra2vV2rVrd4vIF6y1vhNglYsgPOawww47zZ2lvPskk8kUdL0i2MDoe1WNggGSXrt2bZqZf+02D/cgwSsX+78PM38q1ELE8Idb2qy/u9WkM+0slBHidIdGJGkGpzt+l4wAGREyQr7I2ZV4fVMq0GqyHUattaONMXCvNwFgChrsyzhojAfcQVAJ92GJg/Ru2E0V0D8GQCeMsCoN1tqrHJhzLxqSZuaMtfaOHOGA6uvrbXV1dZmInO8OkwrDu621f3nppZduGwYzQ6/CTUQ7y7eJVSqVspWVlXsDuCjUjiIa+MWRauLDbXKV+vp6cVrZla5XFYUBDkT0/unTp/9XT4whz3pWNDc3r2LmDzBzs3tWcqHt+yilHp4+ffpeTvgoeKBDIc12g9j7XaLsCkShvTshIiU5856vbYp2jP4MrfUhUWHDGLPRWnu1M3MPO+9wQom3evXqemb+kYvyY2QLL8g3Kisr433RkgYjiAy136I/0i201n+01jY5s530wDTJTdZVVeWTJwEgk7YPlhiKwYgnPktn85wLZvA7fEhsxVaI0m3gP83Ha/+3BNCLOtREmjp16qHW2n2ttczMEGu3CkBJgHeAbxwFtW8b2JKr7h0HgYCrp2Pt7iXBeyNhRTQAO3bs2BoReV/oR+jFXAcR+dvOnTtfR+fQSgVA2traFhJRVagVOVNdxlr7LQSO/z39zH3Ky2DmU5VSE9ycsFJKWWv/+eKLLz4ciabbU+ZVtWbNmn8y8yMqqECaHSMRfcwxN+qj6cSUl5ePW7NmzWvM/BkEieihidUS0X4A7on4kgbVPC+X8Q9WqykEqA0xkVJqCoDSUCt1Y96VM59UX19vKysr40R0Vlh5XMKqu0Q/XLt2bRp7tjVHWGPy+9baraG5zCWeL/B9/6jehKHcvfB2BiS1bdu2F4noH84W2xez3T7rE/4PCZC/rW/76Ztt/rUqA53IkLIZttHQ7jCgQaxAAPFAqhW8aRvMZwHgoI7xagDi+/6pzFxujLG+78Mz8gwB8m/sf1IZ1OebwUYBWiC2HMprAv/7cLx6ewTYRgKF5VqucY5y6SNTuR05ASPhdzOZzGdceLSEuRfMXL927donC2HnHaZDJ8aYsyJmLXJ5Oz9A//KLhozJOcD4vjN9KGc+gbX2mMrKyriToikfIOTREHwA9OKLL/7BGPMl558SF9lltNYn7t69++foiKYaMCgVMnggN+pzsOBWYO0oK6SJyKdcDl907290goOKfra9vX2GiBzpTJIKgY9wi7X2V92ZmIfzbNTU1KjVq1dvYuYUEZENJPLwnHx8uNZ+TwNS9iAS0XWh9N3dA0ZMSxbAJ8eOGfOtr2F9W9XWF69qz9h3ZXz7/OiM0sgI2wwLfJcYGzXkQkCg8r0Ru/Sf2L9kPuDfCsQI8Pfaa68pxpgLfN9na602vr9+YWn8bytQWZGAuhEg4iCYQjwQtYObPdD5BEjtyIms0wB47NixJwM4zmmUPQWMhOCydNeuXX9CRy2p7JRVVlbGReR4Zqbw5fLEflYI6XqY9qRMnz79MBGZa4wJq38oY8y6NWvW/HUEMIWomfRfvu8/7wBTnHlxju/7C/MIDJ0Yd8T3mf1TdXV1bO3atT/3ff8SZwY0zKwzmYwhorMPOuigWwbrTypUeHXoQwrzEMNcucGY7KLXK4D0rgHY6dOn7yUinwpN2NZa5cb+L6Ajyi7UaInoKLdG7IoEw1q7ZO3atVtDk96e3Hhh5KC19k8uclCF55yZP+DMdl2EId/3O+0712bmbQ1IDIC2b9/+JIA/55O28yCvYmYLpa6aMHbsGQrAEU0v/7upJf2uprS5WftQCSbyOy1ysC84eI2ugL5sAnT9szjwuPMBX0aNmmDaM/dZaw8yxvjMrMjw71Lr17c1ofVbY6BntXaY6mw5tMpArpiHV1YsCSp8jwQ9lQDI+PHjRyMo5y69SS2RSusPIKi4rXPX0vf9eQD2jVxHich2pdQjOYx0RFIorVprT1RKlYmIiVSoeApB/oPCnhcqpKamRjsTzl/c+CQs5snMc7oz2+WGXUfXvKGhwdbU1Hgvv/zyjdbaX7hkSOOkdKOUuujggw/+rBNEvAENvMBRdtFrFkJDytW26uvrB8LXsrl11trbAEwKA2OcZrtl165df4ieCVcpASJyao5QLUqpPzqT3kgQZhmAZDKZfzLzy65iS9i3bGo6nZ7cnfBZgOKqI09Dcj+/KyK+05h6VKdC5muBX4wdP37mEtTqY7A+PU9e/XIM9gO7iXeNhwIHDcuzvIZAsBDsgrUe6MgE8Mi/6YAbx7H9026YYxB0tEywMS9vH7v76hdwwPHloIubYa0CFAN2FJS3E/aB+Xjtx/8EvEUjhyFrAGyt/ZbrR8S565Ezr+LMOFuMMT/PFQZCxmetPRxBNrlxfVXAzI+6kjojgZH3SJMmTQorP8/Mk8T3x5E01ghzesJJ3zoSvXRUlMnlAlJupFt0nZ2pT2UymYt933+EiGKhb9E52X954IEHnuxAqd+aUq6GNBjGlHudQibGGmNCYIm+dJ5X9P2QYZv99ttvyoEHHvgrAKe50G3NzOzMXD92LXKiLS/4kEMOSTDzvIi2R9baLWVlZf9G772ehtPMr9evX98G4IUwudqZ7UpEZP/uAKmQaz9SAMkC0Dt27HiCmf8YakD5HKWRn8oV9Cyx1l60CClbCXgC6MPGb1n+oVHb6ffxVhoDyul7LmHtId0KZh+ITRLva0vaJh5Vk/HsbpvxfN9/Y7xPp8j6KeSDfq1BygY5T1ICUs2wLwJ0NgA8WqDQxAKBkRkzZkwtgIsdk9H5ktaidb2cWv7d5ubmrd2Bi4hMizC9EJAey7GVj1QKKy1oZp7nmBs5PwqMMUsjB3IkEDvT1X+Y+S031rACezUGXrVbAMj69evbSktLP2KtfcIJI+x8VR6AJQcddNCxyAn7H4yWM2guWUDm5mqtNTt20O5+Gve8ua/o+zj44INnHXTQQd/QWi8nojNdtKIWEeNKVjWk0+nv51ufTCYzlYj2ytHW1riK3COuoScz/ysniAwA5uNtSt5A94s7fFdYa08iojIAEjZ7ihZcjPxUDsGPBUCNgCXAjvW9mwxh9JWlTfbJmK+vbh2F8aKwA4yo51Y5f9BOGJ7Kmn6RmUh3q6bmP6rWTzaY5lVPY8LiCVD77wYbAjwFGA/kZUBfnI9XdgmgkyPDma8B2NGjRx/MzLcSEfdBMGBneltbUlLyy6ampi4HKZTWrbXTIoeaHFN/c4Cmjz1CU6dOHcvMh4QNz9yzbM9kMltHGCABAF5//fVd++233zal1F4RzWf8jBkzytesWdOUj5HlaklhJf1cKbixsbF5v/32qwXwDBHtE5btIqJSZn5g3333PfqNN954Gf2oNh69b38a4OWS7/sImyCGzxTZj/26VljtO9RKnAn0UwcccMBhjtkaIrKO6XJYBYiIPBEZpZSaDGA8EU01xszUWpeGfiB3dowrmdUkIp919R+jQp0CYJVSh4pIqRPmQpnu+ehnRthxeSEU+gGE/q5DezLZFcgsOqIAiQHopqamFysqKr5GRD8HEPbX6a5VQrjR4qG5qaysbK4FTiURHidK/a9ux6oKH19pr8CJfgKtAHxIVvwjgAikWyFog8hneVTZx7jiB63Y6zcKdEkzWFwXWFMO7e2CuW4+Xvv7kpHTGTY8ACWuudy40OcQ3TB5mETYivuqiJmB83wGIjLabTRytbsgIiOSkXdjDhbP88aIyNhwzK4q8evTpk3b8eabb46k8WZNPSLSFKlLBxEpsdaWIGhk1sVsEq32LSJobm7u1hrx+uuvb9pvv/0+jqCQ5Xh3P0tEE4no7mnTpn1w/fr12zGAis8hMHnewFhBbsfYAkXZKXcG3udeCCLrO3epDlsp5PIcEQnb2IeCQNie5HVmPm/9+vWNeeYqNHlPdSArkWuu7Y7B7+G9B2PMW25uohUoJuU772H7ieh8vZ3DvvMelubm5ltF5HYR8VzRv+4cZmEByTXhRlBKfY6ISgRgA6GxTFgPiy+W7sRVpbthSTAaBD9nZnUwcNoGVgJaMBb6RwSUcWCq4yDE2zwyH69dLoBaNHKCGBQArqio+AURvVdEwurbPZYJcua8J3bv3v27HqS0EJB0RAIiZobv+21vJ7XdCS06h8G/5ZJRR1qUYMgIWnLz8Jqamqg3QOiDc9kC8F5//fUnrLUfE5F2d46UtdYopY4ioiX7779/CXKq6/cEIkNR7bvQQQ0iYq21xr2stdYaYywzWxfqbE1AvrU2Y4zJMHOGmcNSUsr1+1LM/HtjzLHr169/GD3UWxOR0FyXLcvDzNtG6llxz2tzkl2pr3P8TgKkrClpzJgxXwLQqJTynKaUj1mG/XvudO+VATgtNOcBgQ0vAcJYUfh9rA0fL9+OBs/HZCjXw6jzJtIA0mBuCoqlgoNqDCoN3kqQc6RjYWQEMC0FwFRUVPxAKXWGAyMvDzPuAjIAjLX2v/vCcHJaVIS9b0Z63lEnSqfTlCcE2M8zLyNHXBWx0ZDanhh99DN9LN9iAHgbNmz4JzOf74S/bHVwAO/xff+X6GMlh9yAisFW+y6Ekzx3z4Y1MxEUBfaYWTGzdoEJ0Z8egnbZ8fBFRDEA2lrbZq19SEQ+8vrrr39i48aNb/Rm2hSRWG5IfBgcNBIpqPXKnFNyiXoSRga77iPRZNfJZLF+/fq20aNHnyoi9wGY55htlMkqFyn0q+bm5r8AQFlZ2WEA9gkl+eyEOYY8lhXWkcXZpTvwCb9ULkpXUIUo1RKEc+sIpw/aCAOiAUmA1C7wl47EutdGSAJsCCK2vLw8SURfdsl5Xcyb0Z8hk3M28itbW1uf6+UwkdNCw0oOoTEezKzxNiIiktycNsdkRiyJSDw63v5qA33h/w6Ufj1lypRDlVLfDIUapyl9eurUqas3btx4rdtbpiemFDV1FaK4aiFNdpH/ZxCkNygiKoukPYTkA9jhtJldRLRFRF4ioldF5BUReX7z5s2rcs9hL2PI5BnHiA0GstZ6LuClT3sp91yNNFDyCnANBqB27979cnl5+fsB3EFEH4pK+i466JctLS3nhxtKKXVktFpy7oQZAKUCEYB+FWte/26T+MzhJn7taKhjd4MFQcHWTlUKAjCyNx2J134vI8NvFI6Py8vLr1dKXRqa6fJtkpyfIRj9o7m5+Tvoo3+AmdMRB7kE/J1K306A5Hme7wpGKgTBMwAwzknCodluREXaMfOoaGCCa/XBPTGFAQCBBaA3bdp01ZQpUyYppc4Luwo7ULpm77333r558+af9gRKubXMCglIAyVjTDRAwjrecLW19lfxeNwzxizWWp8T5mQhSINoF5HPpNPpJ2OxmH3zzTdbujmDIRBJH55nZ6RmYmgGHzeChbeSkM/0VKMPCHxIOXt05Gl8BTyUqqWlZUtLS8vJRHQqMydF5McALiWi41paWs5FRwtcADioN/MLB2Y+jGf96Jlmff1qlLynGXJdAkQlICURwAlT92PQD8nI8DOEdmquqKj4sQOjEHypL/MpIm8aY85C30yPYUvvTZHNGZ6pCZFpGtGKhjs4TZEggdCOP23KlCljRho/iAh2o8LxuvlvA9DanYYyQEYe5sHoTZs2XWCt/UNUqHN1726ZPHlymKPk9QVMCpkYO0gtM/c627ds2fLm+vXrNyQSiS9Za190QlqY4DpKRG4mInFgpNCRl+RFhDjb173HzJsjUWvhWh04Ak3F5Ma3dyj0R+bwjb6u1zvNh5TLRAkANTU1/W9LS8vi5ubmLzU1NX2vqanp3xFJJVzUsj70/QGLoI3wbwFUCo32cLxyuYGcwsDyCigNgCV4iQdiBtcRIIv37ObxANiKioqJZWVldwP4ogv4UJE8le5eEul39LX29vY30I98FmPM5oiNWEQExpgpbycNadq0aTuY+dVIR1aIyEQAe41EYJ06deoUEZmU4wfZ6EKLe2W+/WQKYRdmEZEzrLXPAfCcH4FcHdDbp06dOgPdJM4WKpk17GGU2zW2EIDkEmNjAGj//fcvWbduXTuAM5i5yZ0hct1bD9Na/yDCz8K8JIP+BTMFLZq1XsvMGRcQFEapHhHVhkcSKInIwvCcOD8bRKSxL3P8TtaQcg9LNHvai2gLEjkU3BdAEhEQ83gCZAtASwA9D68+tAqZo1rBt5RCqQRIAbDx4Oee3DQuABCmpKTkeGZ+gog+5aJgvD6AUVj8McbMV7e0tNyNjhIofTpQRPRiKOFFNt3RI/RA5XsG3dDQ4IvI0o4zJJYCx9KcEQZIGgAZY2qctG7D/BUieiLyGSmwVsEA6M0332xJp9MfZeZ1cFGJDsAnGWP+On78+GnoJdChkFrNYAAprIyQwywFgKxbt84A0Js3b36Gmc901gMTMVV+fvLkyd/AIMophWu0cePG10VkWyf+QzRz2rRppegI8x8pZ0UAHBMRZMMmgku70+jyFC14RwNS1NZtcn7mTsyOHFtoT5v+JABSD8giwAbBCuvbDser/90K/hhD1pZCxZvBrxFwGQBaPPzqcxhwwKWlpV9USv2FiA7N5zPq4XmNM0nc3draeg36kewYMTk8zczbw4KLLurm3ZMnTy6PaLEjmUJTxJo8pWROHYEAKsx8VERKDSXr57sDz2jx0EEUEWUAeufOneuY+XRrbXMo1bsyOQcope6bOHFiBXKKvOaJIhu4WaSA18oXaZfDU7wtW7b8T9hW3IV+a2OMYeZvjxs37iQMsJxSBGzamHlNJGJNmHlyW1vbUeiIlh0JZ4SnTJmyFzPPdmAemrabtdYbugOk3Pl9J5vs+iWJAFiax1aba1sPW28fWVpaujDclIsA61qiq2q8ev8u2CMzsCe9hbYFR+DVZ9zO4mHaGJ57JptIJE4oLS39ExH9GEBZGJqbpwp6F+kkjJhi5r+3traeEzHTST8YFG3btm1TeKBcCDgT0URjzHv34Jr3l9FCKfWwtbbdhfaGppNjEQQ2jJS8Mh4zZsxYEflIZC8ra22LtfaZnrTSAgUDWADetm3bGpj5dGcWDlu9GyI6ipkfcHPWKWWgELlIocmuEGagsOJ4L9exAPS2bduuttY+7rRCdnxCKaXu7ItW2IvGC2b+H+mg8FqnjyANSQNAOp3+oIhMcaXbSILErTWbN2/ehm4CfwrVcv6dBEjhDDwFoA0dfZPymRLIqcwJAHdWVFTsFarlFETZ8RJAH4fXd8zDaw+/G5u21Q1P4z0VASJTVla2d2lp6Y1a60eI6IMR042KakPhJiAi5EQhhlUuniotLT0dQe0uoP/PEYL7A5Frh87O8/H2IAZAW7dufUFEVoc2O/cc+48bN+7EiFl4T58d8TzvFCKa5hhjGJX11Pbt21ehG99fvnqFgyADwNu+ffv/MfMXHRhZEfGstYaIThw3btyNUSbdjXmsICa7QS18740DQzNVmogWich6xz/gog33FpG73NnsU5JwN8LQE47BawTBIhCRRY7/WOx5oS6c6A+G5yM8NyLy++7Oh+/7BUtifqdpSNTW1rYZwFL3f+5hMysnpRxmrX2woqJiojuEhCDPiJ22pMNusUMMQmFAnwEwqqSk5FJmfo6IvhYyA+RE0uU+W450HGpGTymlTtm+fftuDK4oZ9jV13eFOLUru/9fY8aMqUYBinEO174Ukd+E2pHzjRCAr48QKVUcs/qqM9WFFZdJRB7v6XzlMt4eSgf1C5R27NjxC2NMEkEyqQmb+xHRl8aNG/cNuJyefBra2rVrCwJIhQpq6IEfsNOSNrkGjtlyQ+5Z/2vs2LHfG+A+F2dlWGWtXYmgTUXY5HJSLBb7/AjQkhQAO378+EoROTXs8cTM2lrbZoz5Y1808/8fouz6q3IyM98RaSCX14bs7LjatSk/xvf9x+Lx+GkRFV5c3yPQwKSinkwyYRipioCQxGKxufF4/KfxeHypiFwvIlOMMTZsQdDNM3RpZuZaRHgi8mh7e/tJkSreA90l4WF9SUQecBITOw00QUTX5zzfnjZ59Qisnufdw8xbnFBCTjB597hx4z65h4HVA8Djx48/k4jmRcKQFTPvAPDLnphCoTWLKCjt2rVrMTP/wIGSdVUOLIDvjh079iIn/HkjUUPqbzmlXbt2PQLgwohpXztT5ZfHjRt3Afof5BBqFm1E9ONIsAC5n5eMHj16PLppvDic50ZEriei0tCu6Nr83N/U1PQiei6N9P9VlF1/bN9UUlJyv4i84RIg85o2IiauUFOaQUQPxOPxR2Ox2CcAjEZH6XmObJbueqionFe0p0o0fyFUgy0ALikp2S8Wi30ukUj8WSn1NBFdQEQHuTEJEXXRinKjqSJVGCQ8VAAeaG9vPwXAzkGCUXTDirX2t5H7atf+4z2jR48+f4RoST2Z3RiAt3Xr1s0i8rOwG6sLFhBmvrGsrGzKHmIMCoCMGTNmrLX2cuf0DhmWYubbd+zY8UZPTCFX8Bpox9ZuzpXauXPnpcaYf4RmO2ZWTqD74ejRo+cz81u5pZkGQr7v5xUkB4Smke6zfRxXqBX+3Fr7u7BXVPisxpjrKyoqDkP/gxwsAIrH47+x1r4aRqu6quETAFwXCn57SBCyo0eP/qSInOwk4DAE3rixdWvqz2QyxaCGHpiR2rVr1w4ANyPigMuH2hHmriO2+uOVUvfG4/Hn4/H4PbFY7BOJROJgBDXyQm0mXw8VznlFe6pE8xdGx2KxWYlE4ouJROIhZn5OKXUHgA8AiDsg4qh5LlfyCP1EOf4iSwFpAD9Kp9OLADQXCIzCg6qampoettY+ETmo5Ex3i0tLS/fBwKORBguWBABjxowZ14s9PqzW/ENjzFvOfBKmC0zRWv8IHYnWNMzjt9baH4rIIZH8H8XMbxljbuptLfP0uiq0b8ESUS0zL8tJJNUici8zz4wmHY+kjrH9vBYjKCv0RWvtS04rhNMYRgG4dwDRpQJAvfnmmy0icnVEGAqFunPLy8sXIagY4g3j2Ql7qB0gIj90+y70FypmvnPHjh0rexKE3g4mO28P3psRdMX8aSwWO4+IpqOjQkGXTZoHRENgOgjAQUT0SRHJxGKxdUT0jIisFZGtSqk3iWiXtbYVQDsRtRGRceasEhEp1VqXi8hYIprEzFMAzAJQTUT75YzFRsbQa/2oPO8bd2haAFyZyWRujjC5Qu8Mn4i+KiKPhVqfiDAR7e153u8rKio+0tzcvA39Cy0vhAnUjho16jpr7ccrKiq+3Nzc/GBPGtSuXbt2jho16hoR+WFk/iyAj1VUVHyzubk5rN3Wp9Iwgxy/RlAg9woiOjMSgWXduL7e2tq6qS9MIdpGoZuWI4M6V7t3796eSCROi8Vi/0dEB4egRESHRNoOqJ72b39ApJt2M31XS6zNtkbIFeL68qxlZWWLAPyDiMY4rcYS0byWlpZfAvgU+he1ahG017m3oqLi00qpk8K1dmB3R0VFxebm5uZ/oZe6gQVUHCyAMmvt74hoUqQZn2Lm7Vrr76APJbXy+bOLgNTBcAhAm6tRVY+OKBrq4yIhsskIQaXfQwEcGo1kc90no5vNBnueYn1gDJ1AaBBMgt18L2Xm840xTyNPwnABmZLevXv30xUVFd8iomtdu/mYO6jvEpE/jhkz5kNOSx3qQxVOvq2oqPiGiFzmmM4fysvLv9XS0vJt5M+sD/tu3VxeXl6jlDotUiXdEtE1FRUV0tzc/G10JKDyEI0/rNZ+LhF9O1IGyhCRx8y/bm5u/lVfAT7XpFtAQMrOWzqdfiUWi53CzP8BMMoJcRT1RRTkIEfM0YXQkPo5JwxAt7a2Lq2oqDhbRP4n0tbFENEnKioqVjc3Nyf7uc/DvfRVZj4aQEXknJaLyP1lZWXvd0WPwxqLQ8WjzbRp00p37NjxOyI6KioIOQ34S7t27XqtL3tvJPqNRoLJrtNmam9vf4yZv8LMoXlJ8tk6u3kp9z3lvscuWCB8WfeehKo3M8eZOSwzH37HdvMd7V7UjzEhcm0btp1m5t9kMpnjHBgNtVTPCPpVfcda+28HRsaZ8AyAo33fv6+8vHxyxHxXaNNXmKfFAKSsrOyHIvJdNw5m5gwRXV1WVnZLN3b5rICitT7HWrvGOeRt5DmuLS8vvy5ijtUFHn8oNJjy8vKvichtoZkkEjSwXkQuQTdt5bssTJ4ouyEgC8Brbm5excxnRyt35KsYMiDbsPP7DEVQQ6g19fNZ/2Ct/QU6AjpCfrK4pKTk2H6aqcPzs0pEvugATiIBFHsB+L/y8vL3ODBSBeanWY28vLx88vbt2x8EcIrLNdORSu8/a2lpuae/glAxyq4X9dgYczOAxVEGNgizUG5Ag4qYxiTyin5Hd/OdwTwXuY28lJk/Zoz5LAJ/kR4GNT/7nFrrs5j55QgzD81e/yUi/yotLT0tAo5eAYCJIhqLGTVq1KFlZWUPA7jYmY48d7jjrmbdL3swNzAA2r1793al1EeZeUfIaMIIMhG5rKysbElJScn+6PBLDQZgo+O3iUTiwNLS0t+LyI1RpuTGsVlETmlpadkSGW+/me8QkQHgtbW1PQDgHGdyspGmhwWPstuDEXvWPet/M/M/3B4Lk2aFiH6TSCQOQP/yiCwA3dLScjczXxoCgQN0BjCBmR8qKSn5eo4VRA3y7GST7cvKyk5i5n8CODGy530AMWPMfa2trRf3ZiLu4xzTIF/vGEDKSiPGmKSIfCvCTIbCt1HwScwBgXDMGkCziFxnrT3OWns/OpfCH655VU1NTS8R0YeZ+c1Qs4gw9ekAHigpKflRaWnpVMfEJMKUVR/mKzdEPpyH0tLS0q/4vv+kiJzomKEKNTUR2S0ii9ra2p5Bz360UFptFJHTRGS3A/qwm64VkVoATyUSic+hI1gljOTr6Tmoh/HHEonE54noSQCL3HyFofRaRLYD+Ehra+vS/jCFfGkOQw1Kra2ttxtjvsHMntMaBh3ll9ugbzClg/JF2Q2g6CwDaFdKfcpa+2poNXGRkAeIyG8RNPHrz/m3ziT4PWa+PAJ0YXuKEiL6XklJycOxWOzwiOmZetl7uftOR4QyU1JSsm9JScltIvJnADMje90gqHX5SHt7+2eddiZ9EeBzo+xy5phzhPX+vt5RgBRuJmWtrWPmC12jrJDZ9LkQ6x56SURyClX7e4joXdbayyNa0VD4i/oCSl5LS8tKa+37rbWvRcKBtbWWXf7Ul6y1z8RisWsB7BdhytGNmk/7JOSEyAMYFYvFPhOPxx9j5ptEZHxYd8zd17PWbvJ9/wNtbW3PRrTiXiXg9vb2et/3P2St3Ry5nrbWGhGZDOCOeDz+cDwe/wiAEnRNCZAcoUS6Gf+n4/H4vwD80lXyts50G97vLd/3T2tra3sKfS+Am9d/NAx2fQPAy2Qy14vIvY6pmqHQagoZZTcAoGSn0bxprT03Ahrk/Envisfj30f/0x5C18J1xpjvuvWn0Kzvwq/fp5T6Tzwevy0ej1dGzk93ey9334UC1AGJROJaZn5KRM51oMHWWuUECY+ZH2prazsNrtIN+uE3zVM6SCJYMFDtqGA4MtIKbWYjsQDMVUr9gIjeHWFIwPCG+fYFRBHZ3LsB3GetvQVBFQrsQSDKJQ3AlpaWTrPW3g3g+MgzhPZn7YI8dgFYBuCvIvJwPB5f39LS8lYPZsbR8Xh8HxE5HMCnAcwjoqnuWjZyaMKGe3/SWl/Q39Ya0edIJBIHi8jdAI6KfJ8Q5ISF/pKXnXbzBwCNmUxmk1ujKKeLARgXi8UmA5iPoGbZPCLaJ2f80Ur2jwM4O5PJvIT+RSkqAOx53l+IKCwE6gHY6fv+dABbMXTNB8OzpTzPW0JEH3HSdUxEXjPGHAYg3cf7awDW87xjieixHHPVTb7vfw19DyDQAKzW+kNKqYeie1JELjTG/Az9D7rxABjP8y51yeAmsk4egE/7vn9PP9cuy5vi8fhHESQ/j4tcmyPnpx3AShF5RET+qLXekE6ntwLIbSBYVlJSMsEYM00p9T4AJwGYRUSjwkaFkfOhHaBc6/v+4py/9WnfxWKxOe5cIwKO20TkTQzc92oAJIjoRt/3b8Mgo3ZHauXn8KFIKXU2EX0ZwOycSaA9AE4SAZdohOIWAPdYa38OYE2OSs4jcF4TsVjsGnSU4bFRho6uHW13ENFaEXmdiN5i5nZ3+MYAmAxgOhHtmyMp5UqFod/sOt/3r8oZz0CfozwWi10P4Is5+yKf4CIisomINrhK874z3+wFYH8iGp9HKpbIuofrfavv+19x0ml/x58FJMd8wjD2ndbaoQYkRIC1TGv9NyI62s3LOmvtgABJRB4jInYpBZ6I3GStHRAgEdFDbjzs8vQGCkhZ8NBa/4aIzggZuPMnNRPRu3zfXzGANdQAbCwWmwfgF06ICfeeQv6E77Q7O5tFpNk9YzkRTSai/RDkTuZaAygixCkR2UJEl/i+/2v0rWFnXkASkWVDENUJAFcZY67FICN2PYxMyqI/M98O4HcAPk5EZwF4V864o4yjkP6hnoIfgKAu2FMi8msADwHYnGMGHQlaUXfzmvZ9/1Kt9d8AfIeI5kc/E1afQBAarwGME5EFABZ0t5kjvZzCvkyUczD/CuBqY8wzkTWyg3yOFt/3L9JaPwjgJiKaHZl7GzFFKVcNZKqITO3BlBF97uiaQ0RWALjKWvuHyDoPaPzMzERkI4xnOH2KGkCL53mf9X3/KQfE/iDOiHUO/jCkfKACmETmPzTRyyDPrrLWflEpdTgRzQqfU0RGicg9ABYi6OrbHy3dAtC+7y8FcILneV8Vka8S0dhwjp2fJwtgrjj0oSJyaBYxIykpkeKo0b0XAhGcsHs5gNcHaXEJ5zhqph2sDygUqjKF2KAjFZCQYw5rAXCHiNzhAOk9RFQNoAbAmG6+yzkSE/VhA0clinza1wYAj4nIswD+CeC5HMlpqPJgCj2v5A7r3wD8Uyn1cQf4H8wBkfBwSS8SWbSVN0U2/C5nLvtfF9QR1W6kwM+xUCn1GQCnE9F7c7Q1E0lq7s1S4EUPrIg8AeB3zHyn24dqsOvsGKKOzPXYYdT0LYIcpbUATiGivwCYOJD1MMZ4TmDRkWcrG9CgrI25ayHCtBOD3B8KwG5m/iQRPY6gzFhIc4jo9yKyyAmX/dFMswKRMeaaWCz2gGsceBqAQyJ7LwRs6cO+o5y91wIgBSBlrf1z1BQ50Anxfd/LneMCUMyNubRQduW3AxHyZ1ofAOAwAMe5174AJuWqwAPMIm9xWs9rAP4B4AkAjc6s0tu43i6UKxnOc1npHwUwvRuw7402A1hDRClmfhjA2mEwYeY+x3FEdDqA9yOo5BHvxx7wwzV3UvTjOcKRHeQ+FgCXAJjjGKFG0G7kMgT+LRqmvRQ+y3sBfBTAlyIam/RxvqcDuBIdkZklAP4E4N5+zFV4rXkAvhK5VhzAXQAeweDKaoXjOBXAx9BR8dw6gPoegGcHeA/K0ZTHaK3fy8yfAzAXwLR+Xm8XgJeI6D5mfhDA6jxWl8Gcj30BXFPgM8hu3e91a/+O9CH1tsEojxYEAAkA+zuQOhiB03EKgH3c7xVu8kJtxnfAs91pPxsAvAXgZQc+r+UxZ/R0/7cjUTdS/zQARwKY4YD/IAf25ejwBzU7gF4D4A03Z08A2JEzXxgGs1TUTxW99xwEgQ/7A5jp9sIYJ9lZBwIbALzk1vs/AF7IWffhKE00EgSSdyoN9XNmK3lE3qsAcDSAwx0QzHSaaLn7bNqdk1cBvOh4zr+cWW64z86IYkZv941GEaSWXj4bQ+fEz7Coql+ge+AdMp/dHYA4OvI42M1bph8gN5wA291B1k5wCW3xmW7WXw/hmncJuNiDwDAY6TtfyO9gk9oLca2+zPlQzHtv+z4Rmrjc3kx387mhNP8PVUHlgqzV2x2Q8j1PbmCD9GGyciP2hiTp620KTtTLHEbnTjCyQDs3T6I7rZbyAND/r+tepMKCU3gubC/aFd5BVpciIA3yWYvMZ+BzKMVnKFKRinuvSEUqUpGKVKQiFalIRSpSkYpUpCIVqUhFKlKRilSkIhWpSEUaCvp/V4KVfVOU1kYAAAAASUVORK5CYII=';

  function construirCaratulaHTML(c){
    function fila(label, valor){ return '<tr><td class="ce-k">' + esc(label) + '</td><td class="ce-v">' + esc(valor || '\u2014') + '</td></tr>'; }
    var R = c.remitente || {}, D = c.destinatario || {};
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Car\u00e1tula de env\u00edo ' + esc(c.folio) + '</title><style>'
      + '@page{size:letter portrait;margin:12mm;}'
      + '*{box-sizing:border-box;}'
      + 'body{font-family:"Segoe UI",Arial,sans-serif;color:#1e293b;margin:0;padding:20px;background:#fff;max-width:800px;}'
      + '.ce-head{display:flex;align-items:center;justify-content:space-between;border-bottom:4px solid #E2231A;padding-bottom:14px;margin-bottom:18px;gap:16px;}'
      + '.ce-logo{height:50px;display:block;}'
      + '.ce-meta{text-align:right;font-size:11px;color:#475569;flex-shrink:0;}'
      + '.ce-meta b{color:#13246B;}'
      + '.ce-title{font-size:15px;font-weight:800;color:#fff;background:linear-gradient(90deg,#13246B,#1D3FAE);padding:10px 16px;border-radius:8px;margin-bottom:16px;border-left:6px solid #E2231A;}'
      + '.ce-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:16px;}'
      + '.ce-box{border:1px solid #dbe3f5;border-radius:10px;overflow:hidden;}'
      + '.ce-box-h{background:#EEF2FF;color:#13246B;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:8px 12px;border-bottom:1px solid #dbe3f5;border-left:3px solid #E2231A;}'
      + 'table{width:100%;border-collapse:collapse;}'
      + '.ce-k{width:36%;font-size:10.5px;font-weight:700;color:#64748b;padding:6px 12px;border-top:1px solid #f1f5f9;vertical-align:top;}'
      + '.ce-v{font-size:11.5px;color:#1e293b;padding:6px 12px;border-top:1px solid #f1f5f9;}'
      + '.ce-envio{border:1px solid #dbe3f5;border-radius:10px;overflow:hidden;margin-bottom:16px;}'
      + '.ce-flags{display:flex;gap:14px;margin-top:14px;}'
      + '.ce-flag{flex:1;border:1px solid #dbe3f5;border-radius:10px;padding:10px 14px;font-size:11px;}'
      + '.ce-flag b{display:block;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}'
      + '.ce-check{color:#E2231A;font-weight:800;}'
      + '.ce-opt{display:inline-flex;align-items:center;margin-right:16px;}'
      + '.ce-box2{display:inline-block;width:12px;height:12px;border:1.6px solid #13246B;border-radius:2px;margin-right:6px;position:relative;flex-shrink:0;}'
      + '.ce-box2.on{background:#13246B;}'
      + '.ce-box2.on::after{content:"";position:absolute;left:3px;top:0px;width:4px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(40deg);}'
      + '.ce-foot{margin-top:30px;font-size:9.5px;color:#94a3b8;text-align:center;}'
      + '@media print{body{padding:6px;}}'
      + '</style></head><body>'
      + '<div class="ce-head"><img class="ce-logo" src="data:image/png;base64,' + LOGO_TECNOCONTROL_B64 + '" alt="Tecnocontrol">'
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
      +   fila('Paqueter\u00eda', c.paqueteria) + fila('Atenci\u00f3n a', c.atencion)
      +   fila('Recolecci\u00f3n', c.recoleccion) + fila('Referencias', c.referencias) + fila('Instrucciones especiales', c.instrucciones)
      + '</table></div>'
      + '<div class="ce-flags">'
      +   '<div class="ce-flag"><b>Fletera</b><span class="ce-opt"><span class="ce-box2' + (c.flete==='pagado'?' on':'') + '"></span>Flete pagado</span><span class="ce-opt"><span class="ce-box2' + (c.flete==='por_cobrar'?' on':'') + '"></span>Flete por cobrar</span></div>'
      +   '<div class="ce-flag"><b>Entrega</b><span class="ce-opt"><span class="ce-box2' + (c.entregaTipo==='oficina'?' on':'') + '"></span>Ocurre oficina</span><span class="ce-opt"><span class="ce-box2' + (c.entregaTipo==='domicilio'?' on':'') + '"></span>Domicilio</span></div>'
      + '</div>'
      + '<div class="ce-foot">www.tecnocontrol.com.mx</div>'
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
