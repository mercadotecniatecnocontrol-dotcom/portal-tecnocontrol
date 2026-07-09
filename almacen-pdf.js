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
    productos: [] // [{clave,cant,desc}]
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
      m = lineas[i].match(/Vendedor\s*:?\s*([^\s].*?)(?:\s+Vigencia|\s+Almacen|$)/i);
      if (m && m[1].trim()) { out.vendedor = m[1].replace(/\s{2,}/g, ' ').trim(); break; }
    }

    // ── Almacén ──
    for (i = 0; i < lineas.length; i++) {
      m = lineas[i].match(/Almacen\s*:?\s*(.+)$/i);
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
    var reProd = /^(\d+(?:\.\d+)?)\s+(\d{3,6})\s+(.+?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
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
      + '.alm-fld input,.alm-fld select{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;color:#1e293b;outline:none;background:#fff;}'
      + '.alm-fld input:focus,.alm-fld select:focus{border-color:#0891b2;}'
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
      + '@keyframes almspin{to{transform:rotate(360deg)}}';
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
      + '<div class="alm-fld" style="grid-column:1/3;"><label>Entrega / Observaciones</label><input id="alm-entrega" placeholder="Instrucciones de entrega"></div>'
      + '<div class="alm-fld"><label>Fecha de entrega *</label><input id="alm-fecha-entrega" type="date" required></div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin:6px 0 2px;">Productos</div>'
      + '<table class="alm-tbl"><thead><tr><th class="cclave">Clave</th><th class="ccant">Cant.</th><th>Descripción</th><th class="cdel"></th></tr></thead><tbody id="alm-rows"></tbody></table>'
      + '<button class="alm-addrow" onclick="window.__almPdfAddRow()">+ Agregar producto</button>'
      + '<details class="alm-raw"><summary>Ver texto extraído del PDF</summary><pre id="alm-raw"></pre></details>'
      + '</div>'
      + '</div>'
      + '<div class="alm-pdf-foot">'
      + '<span class="alm-msg" id="alm-msg"></span>'
      + '<button class="alm-btn alm-btn-sec" onclick="window.__almPdfCerrar()">Cancelar</button>'
      + '<button class="alm-btn alm-btn-ok" id="alm-confirm" style="display:none;" onclick="window.__almPdfConfirmar()">Confirmar y crear surtido</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(wrap);

    // Prioridades
    var sel = wrap.querySelector('#alm-prio');
    sel.innerHTML = PRIORIDADES.map(function (p) {
      return '<option value="' + p.v + '"' + (p.v === 'normal' ? ' selected' : '') + '>' + p.t + '</option>';
    }).join('');

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
    var fechaEntrega = (document.getElementById('alm-fecha-entrega').value || '').trim();
    var prioridad = document.getElementById('alm-prio').value || 'normal';
    var productos = estado.productos
      .map(function (p) { return { clave: (p.clave || '').trim(), cant: parseInt(p.cant, 10) || 0, desc: (p.desc || '').trim(), pu: p.pu || '', importe: p.importe || '' }; })
      .filter(function (p) { return p.cant > 0 && p.desc.length > 0; });

    if (!folio)   { msg('Falta el folio.', '#dc2626'); return; }
    if (!cliente) { msg('Falta el cliente.', '#dc2626'); return; }
    if (!fechaEntrega) { msg('Falta la fecha de entrega.', '#dc2626'); return; }
    if (!productos.length) { msg('Agrega al menos un producto con cantidad y descripción.', '#dc2626'); return; }

    if (!window.db) { msg('Firestore no está disponible (window.db).', '#dc2626'); return; }

    var btn = document.getElementById('alm-confirm');
    btn.disabled = true;
    btn.innerHTML = '<span class="alm-spin"></span>Guardando…';
    msg('Verificando folio…', '#0e7490');

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
        return fs.addDoc(col, {
          folio: folio,
          cliente: cliente,
          vendedor: vendedor,
          almacen: almacen,
          entrega: entrega,
          fechaEntrega: fechaEntrega,
          total: estado.total || '',
          prioridad: prioridad,
          estado: 'pendiente',
          productos: productos,
          tipo: 'venta',
          origen: 'pdf',
          creadoPor: yo,
          createdAt: fs.serverTimestamp()
        });
      });
    })
    .then(function () {
      msg('✔ Surtido ' + folio + ' creado.', '#059669');
      if (window.mostrarPush) window.mostrarPush('📦 Surtido creado', 'Folio ' + folio + ' · ' + cliente, '✅');
      setTimeout(window.__almPdfCerrar, 700);
    })
    .catch(function (e) {
      if (e && e.message === 'cancelado') { msg('Operación cancelada.', '#64748b'); }
      else { console.error('[almacen-pdf] error guardando:', e); msg('No se pudo guardar. Revisa permisos de Firestore.', '#dc2626'); }
    })
    .finally(function () {
      btn.disabled = false;
      btn.innerHTML = 'Confirmar y crear surtido';
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
    var up = document.getElementById('alm-step-upload');
    var rv = document.getElementById('alm-step-review');
    if (up) up.style.display = 'block';
    if (rv) rv.style.display = 'none';
    var cf = document.getElementById('alm-confirm');
    if (cf) cf.style.display = 'none';
    var fi = document.getElementById('alm-file');
    if (fi) fi.value = '';
    var fe = document.getElementById('alm-fecha-entrega');
    if (fe) fe.value = '';
    msg('', '#64748b');
    document.getElementById('alm-pdf-modal').classList.add('show');
  };

})();
