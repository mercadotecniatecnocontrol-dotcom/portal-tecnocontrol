/* ============================================================================
 * compras.js · Módulo de Compras — Autorización y seguimiento de requisiciones
 * ----------------------------------------------------------------------------
 * Mismo contrato que almacen.js: NO inicializa Firebase propio, NO tiene
 * login propio — vive dentro de index.html, que ya resuelve sesión y
 * permisos por departamento (verArea ya filtra quién puede llegar aquí).
 *
 * Depende de globals del portal: window.db, window.auth, window.jspdf.
 * Expone: window.abrirCompras(idContenedor)   ← contrato con verArea('Compras')
 *
 * Colección 'requisiciones_compra' — la misma que ya alimenta Flotilla móvil
 * (botón "Requisición de compra"). Este módulo es quien la opera del lado
 * de Compras: autorizar/rechazar, cotizar, generar orden de compra en PDF.
 * ============================================================================*/
(function(){

  var contId = 'vista-compras-area';
  var _fs = null, _unsub = null;
  var docs = [];
  var verRechazadas = false;
  var detalleId = null;

  const ESTADOS = [
    {id:'pendiente',      label:'Pendiente autorización'},
    {id:'autorizada',     label:'Autorizada'},
    {id:'cotizando',      label:'Cotizando'},
    {id:'orden_generada', label:'Orden generada'},
    {id:'recibida',       label:'Recibida'},
  ];
  const REQ_TIPO_INFO = {
    stock:   {entrada:'Mercancía que SÍ requiere entrada en Sistema', factura:'Factura debe salir como Adquisición de mercancía'},
    servicio:{entrada:'Mercancía que NO requiere entrada en Sistema', factura:'Factura debe salir como Gastos en general'},
    insumo:  {entrada:'Mercancía que NO requiere entrada en Sistema', factura:'Factura debe salir como Gastos en general'},
  };

  function cargarFirestore(){
    if(_fs) return Promise.resolve(_fs);
    return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(function(m){ _fs=m; return m; });
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // ── Correo → nombre (regla global 1.1) ─────────────────────────
  // Fuente única: colección 'colaboradores' (mismo catálogo que ya usa
  // Flotilla en flNombrePorCorreo). Se carga una sola vez y se reusa.
  var _colaboradoresCache = null;
  function cargarColaboradores(){
    if(_colaboradoresCache) return Promise.resolve(_colaboradoresCache);
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'colaboradores')).then(function(snap){
        _colaboradoresCache = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        return _colaboradoresCache;
      }).catch(function(){ _colaboradoresCache = []; return _colaboradoresCache; });
    });
  }
  function nombrePorCorreo(valor){
    if(!valor || typeof valor!=='string' || valor.indexOf('@')===-1) return valor;
    var correoNorm = valor.toLowerCase().trim();
    var col = (_colaboradoresCache||[]).find(function(x){ return (x.correo||x.id||'').toLowerCase()===correoNorm; });
    return (col && col.nombre) ? col.nombre : valor;
  }

  // ── Fotos de la requisición (subcolección) ─────────────────────
  function cargarFotos(id){
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'requisiciones_compra',id,'fotos')).then(function(snap){
        return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
      }).catch(function(){ return []; });
    });
  }

  function toast(msg){
    if(window.mostrarPush){ window.mostrarPush('Compras', msg, '🛒'); return; }
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0A1628;color:#fff;padding:10px 18px;border-radius:9px;font-size:13px;z-index:3000';
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); },3000);
  }

  // ── CONFIG DE FLUJO: quién es jefe de área por departamento, y quién
  //    puede autorizar el paso "Compras" — un solo doc, pocas lecturas ──
  var DEPTOS_CP = ["Ingresos","Egresos","Contabilidad","Recursos Humanos","Marketing","Administración","Ventas","Pagos","Gestoría","Almacén","Compras","Operaciones","Flotilla","Contraloría"];
  var _configFlujoCache = null;
  function cargarConfigFlujo(){
    if(_configFlujoCache) return Promise.resolve(_configFlujoCache);
    return cargarFirestore().then(function(fs){
      return fs.getDoc(fs.doc(window.db,'config_flujo_compras','general')).then(function(snap){
        _configFlujoCache = snap.exists() ? snap.data() : {jefesPorDepto:{}, aprobadoresCompras:[]};
        return _configFlujoCache;
      }).catch(function(){ _configFlujoCache = {jefesPorDepto:{}, aprobadoresCompras:[]}; return _configFlujoCache; });
    });
  }
  function departamentoPorCorreo(correo){
    var col = (_colaboradoresCache||[]).find(function(x){ return (x.correo||x.id||'').toLowerCase()===(correo||'').toLowerCase(); });
    return col ? col.departamento : null;
  }
  // ¿Puede ESTE usuario aprobar ESTE paso? Solicitante siempre puede (su propio
  // paso ya llega aprobado al crear la requisición). Jefe de área: debe ser el
  // asignado al departamento del solicitante. Compras: debe estar en la lista.
  function puedoAutorizarPaso(d, paso, miCorreo){
    if(!paso) return false;
    if(paso.label==='Solicitante') return true;
    var cfg = _configFlujoCache || {jefesPorDepto:{}, aprobadoresCompras:[]};
    if(paso.label==='Jefe de área'){
      var depto = departamentoPorCorreo(d.solicitante);
      var jefe = depto && cfg.jefesPorDepto ? cfg.jefesPorDepto[depto] : null;
      return !!(jefe && jefe.correo && jefe.correo.toLowerCase()===(miCorreo||'').toLowerCase());
    }
    if(paso.label==='Compras'){
      return (cfg.aprobadoresCompras||[]).some(function(a){ return a.correo && a.correo.toLowerCase()===(miCorreo||'').toLowerCase(); });
    }
    return false; // paso desconocido — no se asume permiso
  }

  // ── FIRMAS PENDIENTES — todas las requisiciones con un paso esperando a
  //    alguien, con quién es y botón para reenviar la liga (?firmar=id) ──
  window.__cpAbrirFirmasPendientes = function(){
    cargarFirestore().then(function(fs){
      Promise.all([cargarColaboradores(), cargarConfigFlujo()]).then(function(){
        var pendientes = docs.filter(function(d){
          return d.estatus!=='rechazada' && d.estatus!=='recibida' && (d.flujoAutorizacion||[]).some(function(f){ return f.estatus==='pendiente'; });
        });
        var ov = document.createElement('div');
        ov.id = 'cp-firmas-overlay';
        ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:18px';
        ov.innerHTML =
          '<div style="background:#fff;border-radius:14px;max-width:680px;width:100%;max-height:88vh;overflow-y:auto;padding:22px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;font-size:16px">Firmas pendientes</h3><button onclick="document.getElementById(\'cp-firmas-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
            '<div id="cp-firmas-list">' + (pendientes.length ? pendientes.map(function(d){
              var paso = (d.flujoAutorizacion||[]).find(function(f){ return f.estatus==='pendiente'; });
              var destinos = _cpDestinatariosPaso(d, paso);
              var quien = destinos.length ? destinos.map(function(p){return p.nombre||p.correo;}).join(', ') : 'sin asignar — configúralo en "⚙ Configurar flujo"';
              return '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F1F5F9;padding:10px 4px">' +
                '<div><p style="font-size:13px;font-weight:700;margin:0;color:#0A1628">'+esc(d.folio||d.id)+' · '+esc(paso.label)+'</p>' +
                '<p style="font-size:11.5px;color:#5C7089;margin:2px 0 0">Solicitó: '+esc(nombrePorCorreo(d.solicitante)||'—')+' · Falta: <b>'+esc(quien)+'</b></p></div>' +
                '<div style="display:flex;gap:6px;flex-shrink:0">' +
                '<button onclick="window.__cpCopiarLigaFirma(\''+d.id+'\',this)" style="padding:7px 13px;background:#F1F5F9;color:#0A1628;border:none;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer">Copiar liga</button>' +
                '<button '+(destinos.length?'':'disabled')+' onclick="window.__cpReenviarFirma(\''+d.id+'\',this)" style="padding:7px 13px;background:'+(destinos.length?'#0A1628':'#E2E8F0')+';color:'+(destinos.length?'#fff':'#94A3B8')+';border:none;border-radius:8px;font-size:11.5px;font-weight:700;cursor:'+(destinos.length?'pointer':'default')+'">Reenviar aviso (in-app)</button>' +
                '</div></div>';
            }).join('') : '<p style="font-size:12.5px;color:#94a3b8;text-align:center;padding:20px 0">No hay firmas pendientes 🎉</p>') + '</div>' +
          '</div>';
        document.body.appendChild(ov);
      });
    });
  };
  window.__cpCopiarLigaFirma = function(id, btn){
    var liga = location.origin + location.pathname.replace(/index\.html.*$/,'') + 'firmar.html?id=' + id;
    navigator.clipboard.writeText(liga).then(function(){
      var original = btn.textContent;
      btn.textContent = '✓ Copiada'; btn.style.background = '#EAF3DE'; btn.style.color = '#3B6D11';
      setTimeout(function(){ btn.textContent = original; btn.style.background = '#F1F5F9'; btn.style.color = '#0A1628'; }, 1800);
    });
  };
  window.__cpReenviarFirma = function(id, btn){
    var d = docs.find(function(x){ return x.id===id; }); if(!d) return;
    var paso = (d.flujoAutorizacion||[]).find(function(f){ return f.estatus==='pendiente'; }); if(!paso) return;
    var original = btn.textContent;
    btn.textContent = 'Enviando…'; btn.disabled = true;
    cargarFirestore().then(function(fs){
      _cpNotificarPaso(fs, d, paso);
      btn.textContent = '✓ Enviada'; btn.style.background = '#12A150';
      setTimeout(function(){ btn.textContent = original; btn.style.background = '#0A1628'; btn.disabled = false; }, 2000);
    });
  };


  window.__cpAbrirBuscador = function(){
    cargarColaboradores().then(function(){
      var ov = document.createElement('div');
      ov.id = 'cp-buscador-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:18px';
      ov.innerHTML =
        '<div style="background:#fff;border-radius:14px;max-width:1100px;width:100%;max-height:92vh;overflow-y:auto;padding:22px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;font-size:16px">Buscar / historial de requisiciones</h3><button onclick="document.getElementById(\'cp-buscador-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px;margin-bottom:6px">' +
            '<input id="cp-bq-texto" placeholder="Folio, solicitante, empresa, proveedor…" style="padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px;grid-column:span 2">' +
            '<select id="cp-bq-estatus" style="padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px"><option value="">Todos los estatus</option>'+ESTADOS.map(function(e){return '<option value="'+e.id+'">'+e.label+'</option>';}).join('')+'</select>' +
            '<input id="cp-bq-desde" type="date" style="padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">' +
            '<input id="cp-bq-hasta" type="date" style="padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">' +
          '</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:14px">' +
            '<button onclick="window.__cpEjecutarBusqueda()" style="padding:8px 16px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Buscar</button>' +
            '<button onclick="window.__cpExportarCSV()" style="padding:8px 16px;background:#12A150;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">⬇ Exportar a Excel (CSV)</button>' +
          '</div>' +
          '<div id="cp-bq-resumen" style="font-size:11.5px;color:#5C7089;margin-bottom:8px"></div>' +
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">' +
            '<thead><tr style="background:#0A1628;color:#fff;text-align:left"><th style="padding:7px 8px">Folio</th><th style="padding:7px 8px">Fecha</th><th style="padding:7px 8px">Solicitante</th><th style="padding:7px 8px">Empresa</th><th style="padding:7px 8px">Estatus</th><th style="padding:7px 8px">Proveedor</th><th style="padding:7px 8px">Monto</th><th style="padding:7px 8px"></th></tr></thead>' +
            '<tbody id="cp-bq-tbody"></tbody>' +
          '</table></div>' +
        '</div>';
      document.body.appendChild(ov);
      window.__cpEjecutarBusqueda();
    });
  };

  function _cpFechaDoc(d){
    if(d.createdAt && d.createdAt.toDate) return d.createdAt.toDate();
    if(d.createdAt) return new Date(d.createdAt);
    return null;
  }

  window.__cpEjecutarBusqueda = function(){
    var texto = (document.getElementById('cp-bq-texto').value||'').toLowerCase().trim();
    var estatusF = document.getElementById('cp-bq-estatus').value;
    var desde = document.getElementById('cp-bq-desde').value ? new Date(document.getElementById('cp-bq-desde').value+'T00:00:00') : null;
    var hasta = document.getElementById('cp-bq-hasta').value ? new Date(document.getElementById('cp-bq-hasta').value+'T23:59:59') : null;

    var resultados = docs.filter(function(d){
      if(estatusF && d.estatus!==estatusF) return false;
      var fecha = _cpFechaDoc(d);
      if(desde && fecha && fecha<desde) return false;
      if(hasta && fecha && fecha>hasta) return false;
      if(texto){
        var proveedor = (d.cotizacionGanadora&&d.cotizacionGanadora.proveedor) || (d.items||[]).map(function(i){return i.proveedor;}).join(' ');
        var bolsa = [d.folio, d.ocFolio, nombrePorCorreo(d.solicitante), d.solicitante, d.empresa, proveedor].join(' ').toLowerCase();
        if(bolsa.indexOf(texto)===-1) return false;
      }
      return true;
    });

    window.__cpResultadosActuales = resultados; // usado por la exportación CSV
    var estLabel = function(id){ return (ESTADOS.find(function(e){return e.id===id;})||{}).label || id || '—'; };
    document.getElementById('cp-bq-resumen').textContent = resultados.length+' requisiciones encontradas.';
    document.getElementById('cp-bq-tbody').innerHTML = resultados.map(function(d){
      var fecha = _cpFechaDoc(d);
      var monto = d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null ? ('$'+d.cotizacionGanadora.monto) : '—';
      var proveedor = (d.cotizacionGanadora&&d.cotizacionGanadora.proveedor) || '—';
      var puedeDescargar = d.estatus==='orden_generada' || d.estatus==='recibida';
      return '<tr style="border-bottom:1px solid #F1F5F9">' +
        '<td style="padding:6px 8px;font-weight:700">'+esc(d.folio||'—')+'</td>' +
        '<td style="padding:6px 8px">'+(fecha?fecha.toLocaleDateString('es-MX'):'—')+'</td>' +
        '<td style="padding:6px 8px">'+esc(nombrePorCorreo(d.solicitante)||'—')+'</td>' +
        '<td style="padding:6px 8px">'+esc(d.empresa||'—')+'</td>' +
        '<td style="padding:6px 8px">'+esc(estLabel(d.estatus))+'</td>' +
        '<td style="padding:6px 8px">'+esc(proveedor)+'</td>' +
        '<td style="padding:6px 8px">'+esc(monto)+'</td>' +
        '<td style="padding:6px 8px">'+(puedeDescargar?'<button onclick="window.__cpDescargarOC(\''+d.id+'\')" style="padding:5px 10px;background:#1473E6;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">PDF</button>':'<button onclick="document.getElementById(\'cp-buscador-overlay\').remove();window.__cpAbrirDetalle(\''+d.id+'\')" style="padding:5px 10px;background:#F1F5F9;color:#475569;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">Ver</button>') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="8" style="padding:14px;text-align:center;color:#94a3b8">Sin resultados con esos filtros.</td></tr>';
  };

  window.__cpExportarCSV = function(){
    var filas = window.__cpResultadosActuales || docs;
    var estLabel = function(id){ return (ESTADOS.find(function(e){return e.id===id;})||{}).label || id || '—'; };
    var encabezado = ['Folio','OC Folio','Fecha','Solicitante','Empresa','Ciudad','Urgencia','Tipo','Estatus','Motivo','Proveedor ganador','Monto'];
    var lineas = [encabezado.join(',')];
    filas.forEach(function(d){
      var fecha = _cpFechaDoc(d);
      var fila = [
        d.folio||'', d.ocFolio||'', fecha?fecha.toLocaleDateString('es-MX'):'',
        nombrePorCorreo(d.solicitante)||'', d.empresa||'', d.ciudad||'', d.urgencia||'', d.tipoCompra||'',
        estLabel(d.estatus), d.motivo||'', (d.cotizacionGanadora&&d.cotizacionGanadora.proveedor)||'',
        d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null?d.cotizacionGanadora.monto:'',
      ].map(function(v){ v=String(v).replace(/"/g,'""'); return /[,"\n]/.test(v)?'"'+v+'"':v; });
      lineas.push(fila.join(','));
    });
    var blob = new Blob(['\uFEFF'+lineas.join('\r\n')], {type:'text/csv;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'requisiciones_compra_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
  };

  window.__cpAbrirConfigFlujo = function(){
    Promise.all([cargarConfigFlujo(), cargarColaboradores()]).then(function(){
      var cfg = _configFlujoCache;
      var ov = document.createElement('div');
      ov.id = 'cp-config-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:24px';
      var opcionesColab = (_colaboradoresCache||[]).map(function(c){ return '<option value="'+esc(c.correo||c.id)+'">'+esc(c.nombre||c.correo||c.id)+'</option>'; }).join('');
      var filasDeptos = DEPTOS_CP.map(function(dep){
        var actual = (cfg.jefesPorDepto||{})[dep];
        return '<tr><td style="padding:6px 8px;font-size:12.5px">'+esc(dep)+'</td>' +
          '<td style="padding:6px 8px"><select class="cp-cfg-jefe" data-depto="'+esc(dep)+'" style="width:100%;padding:6px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px">' +
            '<option value="">— Sin asignar —</option>' + opcionesColab.replace('value="'+esc(actual&&actual.correo||'###')+'"', 'value="'+esc(actual&&actual.correo||'###')+'" selected') +
          '</select></td></tr>';
      }).join('');
      var listaAprobadores = (cfg.aprobadoresCompras||[]).map(function(a,i){
        return '<div style="display:flex;justify-content:space-between;align-items:center;background:#F8FAFD;border-radius:8px;padding:6px 10px;margin-bottom:5px"><span style="font-size:12.5px">'+esc(a.nombre||a.correo)+'</span><button onclick="window.__cpQuitarAprobadorCompras('+i+')" style="background:none;border:none;color:#E23B2E;cursor:pointer;font-size:12px">Quitar</button></div>';
      }).join('') || '<p style="font-size:12px;color:#94a3b8">Sin aprobadores de Compras todavía.</p>';
      ov.innerHTML =
        '<div style="background:#fff;border-radius:14px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;padding:22px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;font-size:16px">Configurar flujo de autorización</h3><button onclick="document.getElementById(\'cp-config-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
          '<p style="font-size:11.5px;color:#5C7089;margin:0 0 6px;font-weight:700">Jefe de área por departamento</p>' +
          '<p style="font-size:11px;color:#94a3b8;margin:0 0 10px">Se usa para saber quién puede autorizar el paso "Jefe de área" de cada requisición, según el departamento del solicitante.</p>' +
          '<table style="width:100%;border-collapse:collapse;margin-bottom:18px">'+filasDeptos+'</table>' +
          '<p style="font-size:11.5px;color:#5C7089;margin:0 0 6px;font-weight:700">Aprobadores de Compras</p>' +
          '<p style="font-size:11px;color:#94a3b8;margin:0 0 10px">Quien puede autorizar el paso final "Compras" — puede ser más de uno.</p>' +
          '<div id="cp-cfg-aprobadores-list" style="margin-bottom:8px">'+listaAprobadores+'</div>' +
          '<div style="display:flex;gap:6px;margin-bottom:18px"><select id="cp-cfg-nuevo-aprobador" style="flex:1;padding:7px;border:1px solid #E2E8F0;border-radius:7px;font-size:12px"><option value="">Elegir colaborador…</option>'+opcionesColab+'</select><button onclick="window.__cpAgregarAprobadorCompras()" style="padding:7px 14px;background:#0A1628;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">+ Agregar</button></div>' +
          '<button onclick="window.__cpGuardarConfigFlujo()" style="width:100%;padding:11px;background:#12A150;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Guardar configuración</button>' +
          '<div id="cp-cfg-msg" style="font-size:11.5px;margin-top:8px;text-align:center"></div>' +
        '</div>';
      document.body.appendChild(ov);
    });
  };
  window.__cpAgregarAprobadorCompras = function(){
    var sel = document.getElementById('cp-cfg-nuevo-aprobador');
    var correo = sel.value; if(!correo) return;
    var col = (_colaboradoresCache||[]).find(function(c){ return (c.correo||c.id)===correo; });
    _configFlujoCache.aprobadoresCompras = _configFlujoCache.aprobadoresCompras || [];
    if(_configFlujoCache.aprobadoresCompras.some(function(a){ return a.correo===correo; })) return;
    _configFlujoCache.aprobadoresCompras.push({correo:correo.toLowerCase().trim(), nombre: col?col.nombre:correo});
    document.getElementById('cp-config-overlay').remove();
    window.__cpAbrirConfigFlujo();
  };
  window.__cpQuitarAprobadorCompras = function(i){
    _configFlujoCache.aprobadoresCompras.splice(i,1);
    document.getElementById('cp-config-overlay').remove();
    window.__cpAbrirConfigFlujo();
  };
  window.__cpGuardarConfigFlujo = function(){
    var jefesPorDepto = {};
    document.querySelectorAll('.cp-cfg-jefe').forEach(function(sel){
      if(!sel.value) return;
      var col = (_colaboradoresCache||[]).find(function(c){ return (c.correo||c.id)===sel.value; });
      jefesPorDepto[sel.dataset.depto] = {correo:sel.value.toLowerCase().trim(), nombre: col?col.nombre:sel.value};
    });
    _configFlujoCache.jefesPorDepto = jefesPorDepto;
    var msgEl = document.getElementById('cp-cfg-msg');
    msgEl.textContent = 'Guardando…';
    cargarFirestore().then(function(fs){
      fs.setDoc(fs.doc(window.db,'config_flujo_compras','general'), _configFlujoCache).then(function(){
        msgEl.textContent = 'Guardado ✓'; msgEl.style.color = '#15803d';
        if(detalleId) window.__cpAbrirDetalle(detalleId);
        setTimeout(function(){ document.getElementById('cp-config-overlay')?.remove(); }, 900);
      }).catch(function(e){ msgEl.textContent = 'Error: '+(e.message||e); msgEl.style.color='#b91c1c'; });
    });
  };

  // ── Entry point — contrato con verArea('Compras') en index.html ──
  window.abrirCompras = function(idContenedor){
    contId = idContenedor || contId;
    var cont = document.getElementById(contId);
    if(!cont) return;
    if(!window.db){ cont.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8">Firestore no disponible.</div>'; return; }
    if(!cont.dataset.comprasInit){
      cont.dataset.comprasInit = '1';
      pintarShell(cont);
      escuchar();
    }
  };

  function pintarShell(cont){
    cont.innerHTML =
      '<div style="background:#EEF2F7;margin:-20px;padding:24px;min-height:100vh">' +
      '<div style="max-width:1180px;margin:0 auto;background:#fff;border:1px solid #E5EAF1;border-radius:16px;box-shadow:0 2px 8px rgba(10,22,40,.07);padding:24px 28px;min-height:70vh">' +

        '<div style="display:flex;gap:22px;margin-bottom:22px;border-bottom:1px solid #EEF2F7">' +
          '<button id="cp-mtab-req" onclick="window.__cpSetVistaModulo(\'req\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#0A1628;border-bottom:2px solid #0A1628;cursor:pointer">Requisiciones</button>' +
          '<button id="cp-mtab-prov" onclick="window.__cpSetVistaModulo(\'prov\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#94A3B8;border-bottom:2px solid transparent;cursor:pointer">Proveedores</button>' +
          '<button id="cp-mtab-cxp" onclick="window.__cpSetVistaModulo(\'cxp\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#94A3B8;border-bottom:2px solid transparent;cursor:pointer">Cuentas por pagar</button>' +
        '</div>' +

        '<div id="cp-vista-req">' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">' +
          '<div><h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628">Requisiciones de compra</h2>' +
          '<p style="font-size:12px;color:#94A3B8;margin:3px 0 0">Mostrando el mes en curso · <a href="#" onclick="window.__cpAbrirBuscador();return false" style="color:#1473E6;font-weight:600">ver historial completo →</a></p></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button onclick="window.__cpAbrirFirmasPendientes()" style="padding:9px 14px;border-radius:9px;border:1px solid #EEF2F7;background:#fff;color:#0A1628;font-size:11.5px;font-weight:700;cursor:pointer">🖊 Firmas pendientes</button>' +
          '<button onclick="window.__cpAbrirConfigFlujo()" style="padding:9px 14px;border-radius:9px;border:1px solid #EEF2F7;background:#fff;color:#0A1628;font-size:11.5px;font-weight:700;cursor:pointer">⚙ Configurar flujo</button>' +
          '<button onclick="window.__cpAbrirBuscador()" style="padding:9px 14px;border-radius:9px;border:1px solid #EEF2F7;background:#fff;color:#0A1628;font-size:11.5px;font-weight:700;cursor:pointer">🔍 Buscar</button>' +
          '<button onclick="window.__cpExportarAspel()" style="padding:9px 14px;border-radius:9px;border:1px solid #EEF2F7;background:#fff;color:#0A1628;font-size:11.5px;font-weight:700;cursor:pointer">Exportar Aspel</button>' +
          '</div>' +
        '</div>' +

        '<div style="background:#F8FAFC;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;flex-wrap:wrap;gap:0">' +
          '<div style="flex:1;min-width:110px;padding-right:16px"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">En proceso</p><p style="font-size:22px;font-weight:700;margin:0;color:#0A1628" id="cp-kpi-proceso">0</p></div>' +
          '<div style="flex:1;min-width:110px;padding:0 16px;border-left:1px solid #E2E8F0"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Urgentes</p><p style="font-size:22px;font-weight:700;margin:0;color:#E23B2E" id="cp-kpi-urgentes">0</p></div>' +
          '<div style="flex:1;min-width:110px;padding:0 16px;border-left:1px solid #E2E8F0"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Por autorizar</p><p style="font-size:22px;font-weight:700;margin:0;color:#B45309" id="cp-kpi-autorizar">0</p></div>' +
          '<div style="flex:1;min-width:110px;padding-left:16px;border-left:1px solid #E2E8F0"><p style="font-size:11px;color:#94A3B8;margin:0 0 4px">Cotizando</p><p style="font-size:22px;font-weight:700;margin:0;color:#1473E6" id="cp-kpi-cotizando">0</p></div>' +
        '</div>' +

        '<div style="display:flex;gap:6px;margin-bottom:16px">' +
          '<button id="cp-tab-activas" onclick="window.__cpSetTab(false)" style="padding:7px 15px;border-radius:20px;border:none;background:#0A1628;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Activas</button>' +
          '<button id="cp-tab-rechazadas" onclick="window.__cpSetTab(true)" style="padding:7px 15px;border-radius:20px;border:none;background:#F8FAFC;color:#5C7089;font-size:12px;font-weight:700;cursor:pointer">Rechazadas</button>' +
        '</div>' +
        '<div id="cp-board" style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px"></div>' +
        '</div>' +

        '<div id="cp-vista-prov" style="display:none">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px"><h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628">Proveedores</h2>' +
          '<button onclick="window.__cpAbrirNuevoProveedor()" style="padding:9px 16px;border-radius:9px;border:none;background:#0A1628;color:#fff;font-size:12px;font-weight:700;cursor:pointer">+ Nuevo proveedor</button></div>' +
          '<div id="cp-prov-lista" style="background:#F8FAFC;border-radius:12px;overflow:hidden"></div>' +
        '</div>' +

        '<div id="cp-vista-cxp" style="display:none">' +
          '<h2 style="font-size:19px;font-weight:700;margin:0 0 4px;color:#0A1628">Cuentas por pagar</h2>' +
          '<p style="font-size:12px;color:#94A3B8;margin:0 0 18px">Solo lectura — se administra desde Pagos.</p>' +
          '<p id="cp-cxp-resumen" style="font-size:12px;color:#5C7089;margin:0 0 12px;font-weight:600"></p>' +
          '<div style="background:#F8FAFC;border-radius:12px;overflow:hidden"><table style="width:100%;border-collapse:collapse;font-size:12.5px">' +
            '<thead><tr style="text-align:left"><th style="padding:11px 16px;font-size:10.5px;color:#94A3B8;text-transform:uppercase">Folio OC</th><th style="padding:11px 16px;font-size:10.5px;color:#94A3B8;text-transform:uppercase">Empresa</th><th style="padding:11px 16px;font-size:10.5px;color:#94A3B8;text-transform:uppercase">Proveedor</th><th style="padding:11px 16px;font-size:10.5px;color:#94A3B8;text-transform:uppercase">Monto</th><th style="padding:11px 16px;font-size:10.5px;color:#94A3B8;text-transform:uppercase">Estatus</th></tr></thead>' +
            '<tbody id="cp-cxp-tbody"></tbody>' +
          '</table></div>' +
        '</div>' +
      '</div></div>' +
      '<div id="cp-detalle-overlay" style="display:none;position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2000;align-items:center;justify-content:center;padding:24px">' +
        '<div id="cp-detalle-panel" style="background:#fff;border-radius:14px;max-width:920px;width:100%;max-height:88vh;overflow-y:auto;padding:22px"></div>' +
      '</div>';
  }

  window.__cpSetVistaModulo = function(vista){
    ['req','prov','cxp'].forEach(function(v){
      document.getElementById('cp-vista-'+v).style.display = v===vista?'block':'none';
      var tab = document.getElementById('cp-mtab-'+(v==='req'?'req':v));
      tab.style.color = v===vista?'#0A1628':'#94A3B8';
      tab.style.borderBottomColor = v===vista?'#0A1628':'transparent';
    });
    if(vista==='prov') cargarProveedores();
    if(vista==='cxp') cargarCuentasPorPagarVista();
  };

  // ── PROVEEDORES — catálogo propio de Compras; alimenta el autocompletar
  //    de "Proveedor" al cotizar, en vez de texto libre sin memoria ──
  var _proveedoresCache = null;
  function cargarProveedores(forzar){
    var el = document.getElementById('cp-prov-lista');
    if(el) el.innerHTML = '<p style="font-size:12px;color:#94a3b8">Cargando…</p>';
    cargarFirestore().then(function(fs){
      fs.getDocs(fs.query(fs.collection(window.db,'proveedores'), fs.orderBy('nombre'))).then(function(snap){
        _proveedoresCache = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        renderProveedores();
      }).catch(function(e){ if(el) el.innerHTML = '<p style="font-size:12px;color:#b91c1c">Error: '+esc(e.message||e)+'</p>'; });
    });
  }
  function renderProveedores(){
    var el = document.getElementById('cp-prov-lista'); if(!el) return;
    var lista = _proveedoresCache || [];
    el.innerHTML = lista.length ? lista.map(function(p){
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-bottom:1px solid #EEF2F7">' +
        '<div><p style="font-size:13px;font-weight:700;margin:0;color:#0A1628">'+esc(p.nombre)+'</p>' +
        '<p style="font-size:11px;color:#94A3B8;margin:2px 0 0">'+esc(p.categoria||'Sin categoría')+' · '+esc(p.contacto||'—')+' · '+esc(p.telefono||p.correo||'—')+'</p></div>' +
        '<button onclick="window.__cpEliminarProveedor(\''+p.id+'\')" style="padding:6px 12px;background:none;color:#E23B2E;border:none;font-size:11.5px;font-weight:700;cursor:pointer">Eliminar</button>' +
        '</div>';
    }).join('') : '<p style="font-size:12.5px;color:#94a3b8;text-align:center;padding:24px 0">Sin proveedores todavía — agrega el primero.</p>';
  }
  window.__cpAbrirNuevoProveedor = function(){
    var ov = document.createElement('div');
    ov.id = 'cp-prov-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:18px';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:400px;width:100%;padding:20px">' +
        '<h3 style="margin:0 0 14px;font-size:15px">Nuevo proveedor</h3>' +
        '<input id="cp-np-nombre" placeholder="Nombre / razón social" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">' +
        '<input id="cp-np-categoria" placeholder="Categoría (ej. Refacciones, Insumos)" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">' +
        '<input id="cp-np-contacto" placeholder="Nombre del contacto" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">' +
        '<input id="cp-np-telefono" placeholder="Teléfono" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">' +
        '<input id="cp-np-correo" placeholder="Correo" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;margin-bottom:14px;box-sizing:border-box">' +
        '<div style="display:flex;gap:8px"><button onclick="document.getElementById(\'cp-prov-overlay\').remove()" style="flex:1;padding:10px;background:#F1F5F9;color:#5C7089;border:none;border-radius:9px;font-weight:700;cursor:pointer">Cancelar</button>' +
        '<button onclick="window.__cpGuardarProveedor()" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Guardar</button></div>' +
      '</div>';
    document.body.appendChild(ov);
  };
  window.__cpGuardarProveedor = function(){
    var nombre = document.getElementById('cp-np-nombre').value.trim();
    if(!nombre){ alert('Escribe el nombre del proveedor.'); return; }
    var datos = {
      nombre:nombre, categoria:document.getElementById('cp-np-categoria').value.trim(),
      contacto:document.getElementById('cp-np-contacto').value.trim(), telefono:document.getElementById('cp-np-telefono').value.trim(),
      correo:document.getElementById('cp-np-correo').value.trim(), creadoEn:new Date().toISOString(),
    };
    cargarFirestore().then(function(fs){
      fs.addDoc(fs.collection(window.db,'proveedores'), datos).then(function(){
        document.getElementById('cp-prov-overlay').remove();
        cargarProveedores();
      }).catch(function(e){ alert('No se pudo guardar: '+(e.message||e)); });
    });
  };
  window.__cpEliminarProveedor = function(id){
    if(!confirm('¿Eliminar este proveedor?')) return;
    cargarFirestore().then(function(fs){
      fs.deleteDoc(fs.doc(window.db,'proveedores',id)).then(function(){ cargarProveedores(); });
    });
  };

  // ── CUENTAS POR PAGAR (vista de solo lectura dentro de Compras) ──
  function cargarCuentasPorPagarVista(){
    var tbody = document.getElementById('cp-cxp-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="padding:14px;text-align:center;color:#94a3b8">Cargando…</td></tr>';
    cargarFirestore().then(function(fs){
      fs.getDocs(fs.query(fs.collection(window.db,'pagos_cuentas_por_pagar'), fs.orderBy('creadaEn','desc'))).then(function(snap){
        var filas = snap.docs.map(function(d){ return d.data(); });
        var pendiente = filas.filter(function(f){ return f.estatusPago!=='pagado'; }).reduce(function(s,f){ return s+(Number(f.monto)||0); },0);
        document.getElementById('cp-cxp-resumen').textContent = filas.length+' cuentas · $'+pendiente.toLocaleString('es-MX')+' pendientes de pagar';
        tbody.innerHTML = filas.length ? filas.map(function(f){
          var col = f.estatusPago==='pagado'?'#12A150':f.estatusPago==='programado'?'#D99000':'#5C7089';
          return '<tr style="border-bottom:1px solid #F1F5F9">' +
            '<td style="padding:6px 8px;font-weight:700">'+esc(f.ocFolio||f.folio||'—')+'</td>' +
            '<td style="padding:6px 8px">'+esc(f.empresa||'—')+'</td>' +
            '<td style="padding:6px 8px">'+esc(f.proveedor||'—')+'</td>' +
            '<td style="padding:6px 8px">'+(f.monto!=null?'$'+Number(f.monto).toLocaleString('es-MX'):'—')+'</td>' +
            '<td style="padding:6px 8px;color:'+col+';font-weight:700">'+esc(f.estatusPago||'pendiente')+'</td></tr>';
        }).join('') : '<tr><td colspan="5" style="padding:14px;text-align:center;color:#94a3b8">Sin cuentas por pagar todavía.</td></tr>';
      }).catch(function(e){ tbody.innerHTML = '<tr><td colspan="5" style="padding:14px;color:#b91c1c">Error: '+esc(e.message||e)+'</td></tr>'; });
    });
  }

  function escuchar(){
    cargarColaboradores();
    cargarConfigFlujo();
    cargarProveedores();
    cargarFirestore().then(function(fs){
      var q = fs.query(fs.collection(window.db,'requisiciones_compra'), fs.orderBy('createdAt','desc'));
      _unsub = fs.onSnapshot(q, function(snap){
        docs = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        renderKPIs();
        renderBoard();
        if(detalleId) window.__cpAbrirDetalle(detalleId);
      }, function(err){
        console.error('[compras] onSnapshot:', err);
        var b=document.getElementById('cp-board');
        if(b) b.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#94a3b8">Error al leer requisiciones_compra: '+esc(err.message||err)+'</div>';
      });
    });
  }

  window.__cpSetTab = function(rechazadas){
    verRechazadas = rechazadas;
    var a=document.getElementById('cp-tab-activas'), r=document.getElementById('cp-tab-rechazadas');
    a.style.background = rechazadas?'#fff':'#0A1628'; a.style.color = rechazadas?'#5C7089':'#fff'; a.style.boxShadow = rechazadas?'none':'0 1px 3px rgba(10,22,40,.15)';
    r.style.background = rechazadas?'#0A1628':'#fff'; r.style.color = rechazadas?'#fff':'#5C7089'; r.style.boxShadow = rechazadas?'0 1px 3px rgba(10,22,40,.15)':'none';
    renderBoard();
  };

  function renderKPIs(){
    var activas = docs.filter(function(d){ return d.estatus!=='rechazada' && d.estatus!=='recibida'; });
    var urgentes = activas.filter(function(d){ return d.urgencia==='alta'; }).length;
    var pendientes = docs.filter(function(d){ return (d.estatus||'pendiente')==='pendiente'; }).length;
    var cotizando = docs.filter(function(d){ return d.estatus==='cotizando'; }).length;
    var elP=document.getElementById('cp-kpi-proceso'); if(!elP) return;
    elP.textContent = activas.length;
    document.getElementById('cp-kpi-urgentes').textContent = urgentes;
    document.getElementById('cp-kpi-autorizar').textContent = pendientes;
    document.getElementById('cp-kpi-cotizando').textContent = cotizando;
  }

  function renderBoard(){
    var board=document.getElementById('cp-board'); if(!board) return;
    // Solo el mes en curso por default — el histórico completo vive en
    // "🔍 Buscar / historial" para no saturar el tablero indefinidamente.
    var ahora = new Date();
    var fuente = docs.filter(function(d){
      var f = _cpFechaDoc(d);
      return f && f.getMonth()===ahora.getMonth() && f.getFullYear()===ahora.getFullYear();
    });
    fuente = verRechazadas ? fuente.filter(function(d){ return d.estatus==='rechazada'; }) : fuente.filter(function(d){ return d.estatus!=='rechazada'; });
    if(verRechazadas){
      board.style.gridTemplateColumns='1fr';
      board.innerHTML = fuente.length ? '<div style="background:#F8FAFC;border-radius:12px;overflow:hidden">'+fuente.map(cardHTML).join('')+'</div>' : '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px">Sin requisiciones rechazadas este mes.</div>';
      return;
    }
    board.style.gridTemplateColumns='repeat(5,minmax(0,1fr))';
    board.innerHTML = ESTADOS.map(function(col){
      var ds = fuente.filter(function(d){ return (d.estatus||'pendiente')===col.id; });
      return '<div style="min-width:0">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:0 2px">' +
        '<p style="font-size:10.5px;font-weight:700;color:#5C7089;margin:0;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+col.label+'</p>' +
        '<span style="color:#94A3B8;font-size:11px;font-weight:700;flex-shrink:0;margin-left:4px">'+ds.length+'</span></div>' +
        '<div style="background:#F8FAFC;border:1px solid #EEF2F7;border-radius:12px;min-height:60px;overflow:hidden">' +
        (ds.length ? ds.map(cardHTML).join('') : '<p style="font-size:11px;color:#CBD5E1;margin:0;text-align:center;padding:24px 0">Vacío</p>') +
        '</div></div>';
    }).join('');
  }

  function cardHTML(d){
    var urgColor = d.urgencia==='alta'?'#E23B2E':d.urgencia==='media'?'#B45309':'#94A3B8';
    var monto = d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null ? ('$'+Number(d.cotizacionGanadora.monto).toLocaleString('es-MX')) : null;
    var inicial = esc((d.folio||d.id||'?').replace(/[^0-9]/g,'').slice(-2) || '·');
    return '<div onclick="window.__cpAbrirDetalle(\''+d.id+'\')" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid #EEF2F7;cursor:pointer;transition:background .12s" onmouseover="this.style.background=\'#F1F5F9\'" onmouseout="this.style.background=\'transparent\'">' +
      '<div style="width:32px;height:32px;border-radius:9px;background:#fff;color:'+urgColor+';display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800;flex-shrink:0">'+inicial+'</div>' +
      '<div style="flex:1;min-width:0">' +
      '<p style="font-size:12px;font-weight:700;color:#0A1628;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(d.folio||d.id)+'</p>' +
      '<p style="font-size:10.5px;color:#64748B;margin:1px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(nombrePorCorreo(d.solicitante)||'—')+'</p>' +
      '</div>' +
      (monto?'<span style="font-size:11px;font-weight:700;color:#12A150;flex-shrink:0">'+monto+'</span>':'<span style="font-size:8.5px;font-weight:800;color:'+urgColor+';flex-shrink:0">'+esc((d.urgencia||'').toUpperCase())+'</span>') +
      '</div>';
  }

  // ── DETALLE / AUTORIZAR / RECHAZAR ─────────────────────────────
  window.__cpAbrirDetalle = function(id){
    detalleId = id;
    var d = docs.find(function(x){ return x.id===id; });
    if(!d) return;
    var ov=document.getElementById('cp-detalle-overlay'), p=document.getElementById('cp-detalle-panel');
    var tipoInfo = REQ_TIPO_INFO[d.tipoCompra] || REQ_TIPO_INFO.servicio;
    var flujo = d.flujoAutorizacion || [];
    var pasoActivo = flujo.find(function(f){ return f.estatus==='pendiente'; });

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">';
    html += '<div><h2 style="font-size:18px;margin:0">'+esc(d.folio||d.id)+' · '+esc(d.empresa||'—')+'</h2>';
    html += '<p style="font-size:12px;color:#5C7089;margin:4px 0 0">'+esc(nombrePorCorreo(d.solicitante)||'—')+' · '+esc(d.origen||'—')+'</p></div>';
    html += '<button onclick="window.__cpCerrarDetalle()" style="background:#F1F5F9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">✕</button></div>';

    // ── Barra de progreso general (5 etapas del documento completo) ──
    var ETAPAS_CP = [
      {id:'pendiente', label:'Solicitud'}, {id:'autorizacion', label:'Autorización'},
      {id:'cotizando', label:'Cotización'}, {id:'orden_generada', label:'Orden generada'},
      {id:'recibida', label:'Recibida'},
    ];
    var etapaActualIdx = d.estatus==='rechazada' ? -1
      : d.estatus==='recibida' ? 4 : d.estatus==='orden_generada' ? 3 : d.estatus==='cotizando' ? 2
      : pasoActivo && pasoActivo.orden>1 ? 1 : 0;
    html += '<div style="display:flex;align-items:center;margin-bottom:16px">' + ETAPAS_CP.map(function(e,i){
      var estado = d.estatus==='rechazada' ? 'rechazada' : (i<etapaActualIdx?'hecho':(i===etapaActualIdx?'actual':'espera'));
      var col = estado==='hecho'?'#12A150':estado==='actual'?'#1473E6':estado==='rechazada'?'#E23B2E':'#CBD5E1';
      var bg = estado==='hecho'?'#12A150':estado==='actual'?'#1473E6':estado==='rechazada'?'#E23B2E':'#F1F5F9';
      var fg = estado==='espera'?'#94A3B8':'#fff';
      return '<div style="flex:1;text-align:center">' +
          '<div style="width:24px;height:24px;border-radius:50%;background:'+bg+';color:'+fg+';font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;box-shadow:0 0 0 3px '+(estado==='actual'?'rgba(20,115,230,.15)':'transparent')+'">'+(estado==='hecho'?'✓':(i+1))+'</div>' +
          '<div style="font-size:9.5px;font-weight:700;color:'+col+'">'+esc(e.label)+'</div>' +
        '</div>' + (i<ETAPAS_CP.length-1?'<div style="flex:0.6;height:0;border-top:2px dotted '+(i<etapaActualIdx?'#12A150':'#E2E8F0')+';margin-bottom:16px"></div>':'');
    }).join('') + '</div>';
    if(d.estatus==='rechazada'){
      html += '<div style="background:#FCEBEB;border-radius:9px;padding:10px 12px;font-size:12px;color:#791F1F;margin-bottom:14px"><b>Rechazada:</b> '+esc(d.motivoRechazo||'Sin motivo registrado')+'</div>';
    }

    html += '<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">';

    // ══ COLUMNA IZQUIERDA — detalle, partidas, autorización, comentarios, fotos ══
    var htmlIzq = '';
    htmlIzq += '<p style="font-size:11.5px;color:#5C7089;margin:0 0 12px">'+esc(tipoInfo.entrada)+' · '+esc(tipoInfo.factura)+'</p>';

    // Partidas como tarjetas (no tabla plana)
    htmlIzq += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Partidas</p>';
    htmlIzq += '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' + (d.items||[]).map(function(it){
      return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;gap:10px">' +
        '<div style="min-width:0"><p style="font-size:13px;font-weight:600;color:#0A1628;margin:0;overflow-wrap:break-word">'+esc(it.desc||'—')+'</p>' +
        '<p style="font-size:11px;color:#94A3B8;margin:2px 0 0">Proveedor sugerido: '+esc(it.proveedor||'—')+'</p></div>' +
        '<span style="flex-shrink:0;background:#F1F5F9;color:#0A1628;font-size:12px;font-weight:800;padding:5px 10px;border-radius:8px;white-space:nowrap">×'+esc(it.cant||'—')+' '+esc(it.unidad||'')+'</span>' +
        '</div>';
    }).join('') + '</div>';

    htmlIzq += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Flujo de autorización</p><div style="display:flex;gap:6px;margin-bottom:16px">';
    flujo.forEach(function(f){
      var bg = f.estatus==='aprobado'?'#EAF3DE':(f===pasoActivo?'#FAEEDA':'#F1F5F9');
      var col = f.estatus==='aprobado'?'#3B6D11':(f===pasoActivo?'#633806':'#5C7089');
      htmlIzq += '<div style="flex:1;text-align:center;padding:8px 4px;border-radius:9px;background:'+bg+'">' +
        '<p style="font-size:10.5px;font-weight:700;margin:0;color:'+col+'">'+esc(f.label)+'</p>' +
        '<p style="font-size:9.5px;margin:2px 0 0;color:#5C7089">'+(f.estatus==='aprobado'?'Aprobado':(f===pasoActivo?'Tu turno':'En espera'))+'</p></div>';
    });
    htmlIzq += '</div>';

    if(d.firma) htmlIzq += '<img src="'+d.firma+'" style="height:50px;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:14px">';

    // ── Comentarios ──
    var comentarios = d.comentarios || [];
    htmlIzq += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Comentarios</p>';
    htmlIzq += '<div id="cp-comentarios-list" style="margin-bottom:8px">' + (comentarios.length ? comentarios.map(function(c){
      return '<div style="background:#F8FAFD;border-radius:8px;padding:8px 10px;margin-bottom:6px">' +
        '<p style="font-size:10.5px;font-weight:700;color:#1473E6;margin:0 0 2px">'+esc(nombrePorCorreo(c.autorEmail||c.autor)||'—')+' <span style="font-weight:400;color:#B7C0CC">'+esc((c.fecha||'').slice(0,10))+'</span></p>' +
        '<p style="font-size:12.5px;color:#0A1628;margin:0">'+esc(c.texto)+'</p></div>';
    }).join('') : '<p style="font-size:11.5px;color:#94a3b8;margin:0">Sin comentarios todavía.</p>') + '</div>';
    htmlIzq += '<div style="display:flex;gap:6px;margin-bottom:16px">' +
      '<input id="cp-comentario-txt" placeholder="Agregar un comentario…" style="flex:1;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">' +
      '<button onclick="window.__cpAgregarComentario(\''+d.id+'\')" style="padding:8px 14px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Agregar</button></div>';

    // ── Fotos (subidas por el técnico y/o por Compras) ──
    htmlIzq += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Fotos de referencia</p>';
    htmlIzq += '<div id="cp-fotos-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px"><p style="font-size:11px;color:#94a3b8;grid-column:1/-1">Cargando…</p></div>';
    htmlIzq += '<label style="display:inline-block;padding:8px 14px;border:1.5px dashed #E2E8F0;border-radius:8px;background:#fff;color:#1473E6;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:16px">+ Agregar foto (Compras)<input id="cp-foto-file" type="file" accept="image/*" multiple onchange="window.__cpAgregarFoto(\''+d.id+'\',this)" style="display:none"></label>';

    if(pasoActivo && d.estatus!=='rechazada' && d.estatus!=='recibida'){
      var miCorreo = window.auth && window.auth.currentUser ? window.auth.currentUser.email : '';
      var autorizado = puedoAutorizarPaso(d, pasoActivo, miCorreo);
      if(autorizado){
        htmlIzq += '<div id="cp-rechazo-motivo" style="display:none;margin-bottom:10px"><textarea id="cp-motivo-txt" rows="2" placeholder="Motivo del rechazo" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;box-sizing:border-box"></textarea></div>';
        htmlIzq += '<div style="display:flex;gap:8px">';
        htmlIzq += '<button onclick="window.__cpAutorizar(\''+d.id+'\')" style="flex:1;padding:11px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer">Autorizar</button>';
        htmlIzq += '<button onclick="document.getElementById(\'cp-rechazo-motivo\').style.display=\'block\';document.getElementById(\'cp-confirmar-rechazo\').style.display=\'block\'" style="flex:1;padding:11px;background:#fff;color:#E23B2E;border:1px solid #F0997B;border-radius:9px;font-weight:600;cursor:pointer">Rechazar</button></div>';
        htmlIzq += '<button id="cp-confirmar-rechazo" onclick="window.__cpRechazar(\''+d.id+'\')" style="display:none;width:100%;margin-top:8px;padding:11px;background:#E23B2E;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer">Confirmar rechazo</button>';
      } else {
        var cfg2 = _configFlujoCache || {jefesPorDepto:{}, aprobadoresCompras:[]};
        var quien = '—';
        if(pasoActivo.label==='Jefe de área'){
          var depto2 = departamentoPorCorreo(d.solicitante);
          var jefe2 = depto2 && cfg2.jefesPorDepto ? cfg2.jefesPorDepto[depto2] : null;
          quien = jefe2 ? jefe2.nombre : (depto2 ? 'sin jefe de área asignado para '+depto2 : 'departamento del solicitante desconocido — revisa su ficha en colaboradores');
        } else if(pasoActivo.label==='Compras'){
          quien = (cfg2.aprobadoresCompras||[]).map(function(a){return a.nombre||a.correo;}).join(', ') || 'sin aprobadores de Compras configurados';
        }
        htmlIzq += '<div style="background:#FFF7ED;border-radius:9px;padding:10px 12px;font-size:12px;color:#7C2D12">Este paso ("'+esc(pasoActivo.label)+'") solo lo puede autorizar: <b>'+esc(quien)+'</b>. Configúralo en "⚙ Configurar flujo" si falta.</div>';
      }
    }

    if(d.estatus==='cotizando'){
      htmlIzq += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:14px 0 8px">Cotizaciones</p><div id="cp-cotizaciones-list" style="margin-bottom:8px"></div>';
      htmlIzq += '<div style="display:flex;gap:6px;margin-bottom:10px">';
      htmlIzq += '<input id="cp-cot-proveedor" list="cp-proveedores-dl" placeholder="Proveedor" style="flex:1;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">' +
        '<datalist id="cp-proveedores-dl">'+(_proveedoresCache||[]).map(function(p){ return '<option value="'+esc(p.nombre)+'">'; }).join('')+'</datalist>';
      htmlIzq += '<input id="cp-cot-monto" placeholder="Monto" type="number" style="width:100px;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">';
      htmlIzq += '<label style="padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:11.5px;cursor:pointer;background:#fff">Adjuntar<input id="cp-cot-file" type="file" accept="image/*,application/pdf" style="display:none"></label></div>';
      htmlIzq += '<button onclick="window.__cpAgregarCotizacion(\''+d.id+'\')" style="width:100%;padding:9px;border:1.5px dashed #E2E8F0;background:#fff;color:#1473E6;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px">+ Agregar cotización</button>';
      htmlIzq += '<button onclick="window.__cpEnviarDirectoACompra(\''+d.id+'\')" style="width:100%;padding:10px;background:#12A150;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;margin-bottom:12px">✓ Enviar directo a compra (genera OC)</button>';
    }

    // ══ COLUMNA DERECHA — resumen fijo (como el "Payment Summary" de referencia) ══
    var estLabel = (ESTADOS.find(function(e){ return e.id===(d.estatus||'pendiente'); })||{}).label || d.estatus || '—';
    var htmlDer = '<div style="background:#F8FAFD;border-radius:12px;padding:16px;position:sticky;top:0">';
    htmlDer += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
    htmlDer += '<span style="background:#fff;border:1px solid #E2E8F0;color:#0A1628;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:7px">'+esc((d.urgencia||'—').toUpperCase())+'</span>';
    htmlDer += '<span style="background:#fff;border:1px solid #E2E8F0;color:#0A1628;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:7px">'+esc((d.tipoCompra||'—').toUpperCase())+'</span>';
    htmlDer += '<span style="background:#0A1628;color:#fff;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:7px">'+esc(estLabel)+'</span></div>';
    htmlDer += '<div style="border-top:1px solid #E2E8F0;padding-top:10px">';
    [['Proveedor ganador', (d.cotizacionGanadora&&d.cotizacionGanadora.proveedor)||'—'],
     ['Monto', d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null?('$'+Number(d.cotizacionGanadora.monto).toLocaleString('es-MX')):'—'],
     ['Ciudad', d.ciudad||'—'],
     ['Folio OC', d.ocFolio||'—']].forEach(function(row){
      htmlDer += '<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px"><span style="color:#5C7089">'+esc(row[0])+'</span><span style="font-weight:700;color:#0A1628">'+esc(row[1])+'</span></div>';
    });
    htmlDer += '</div>';
    if(d.estatus==='orden_generada'){
      htmlDer += '<button onclick="window.__cpMarcarRecibida(\''+d.id+'\')" style="width:100%;margin-top:12px;padding:11px;background:#12A150;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer;font-size:12.5px">Marcar como recibida</button>';
    }
    if(d.estatus==='orden_generada' || d.estatus==='recibida'){
      htmlDer += '<button onclick="window.__cpDescargarOC(\''+d.id+'\')" style="width:100%;margin-top:8px;padding:11px;background:#fff;color:#0A1628;border:1px solid #E2E8F0;border-radius:9px;font-weight:600;cursor:pointer;font-size:12.5px">Descargar orden de compra (PDF)</button>';
    }
    htmlDer += '</div>';

    html += '<div style="flex:1;min-width:280px">'+htmlIzq+'</div>';
    html += '<div style="width:250px;min-width:220px;flex-shrink:0">'+htmlDer+'</div>';
    html += '</div>';

    p.innerHTML = html;
    ov.style.display='flex';
    if(d.estatus==='cotizando') cargarCotizaciones(d.id);
    renderFotosGrid(d.id);
  };

  function renderFotosGrid(id){
    var grid = document.getElementById('cp-fotos-grid'); if(!grid) return;
    cargarFotos(id).then(function(fotos){
      grid = document.getElementById('cp-fotos-grid'); if(!grid) return; // el panel pudo cerrarse mientras cargaba
      grid.innerHTML = fotos.length ? fotos.map(function(f){
        return '<img src="'+f.src+'" onclick="window.open(this.src)" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;cursor:pointer" title="'+esc(f.origen==='compras'?'Subida por Compras':'Subida por el solicitante')+'">';
      }).join('') : '<p style="font-size:11px;color:#94a3b8;grid-column:1/-1;margin:0">Sin fotos todavía.</p>';
    });
  }

  window.__cpAgregarComentario = function(id){
    var input = document.getElementById('cp-comentario-txt');
    var texto = (input.value||'').trim();
    if(!texto) return;
    var d = docs.find(function(x){ return x.id===id; }); if(!d) return;
    var autorEmail = window.auth && window.auth.currentUser ? window.auth.currentUser.email : '';
    var comentario = {texto:texto, autor:nombrePorCorreo(autorEmail)||autorEmail, autorEmail:autorEmail, fecha:new Date().toISOString()};
    cargarFirestore().then(function(fs){
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {comentarios: fs.arrayUnion(comentario)}).then(function(){
        input.value='';
      }).catch(function(e){ alert('No se pudo agregar el comentario: '+(e.message||e)); });
    });
  };

  // Compresión de imágenes antes de subir — Firestore tope 1MB por doc de
  // subcolección; una foto de celular sin comprimir lo rebasa y el addDoc
  // fallaba en silencio (parecía que el botón "no servía").
  function _cpComprimirImagen(dataUrl, maxW, calidad){
    return new Promise(function(resolve){
      var img = new Image();
      img.onload = function(){
        var ratio = Math.min(1, maxW/img.width);
        var w = img.width*ratio, h = img.height*ratio;
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        try{ resolve(canvas.toDataURL('image/jpeg', calidad)); }catch(e){ resolve(dataUrl); }
      };
      img.onerror = function(){ resolve(dataUrl); };
      img.src = dataUrl;
    });
  }

  window.__cpAgregarFoto = function(id,input){
    var files = Array.from(input.files||[]);
    if(!files.length) return;
    var autorEmail = window.auth && window.auth.currentUser ? window.auth.currentUser.email : '';
    var autor = nombrePorCorreo(autorEmail)||autorEmail;
    cargarFirestore().then(function(fs){
      Promise.all(files.map(function(file){
        return new Promise(function(res){
          var r = new FileReader();
          r.onload = function(){
            _cpComprimirImagen(r.result, 1000, 0.72).then(function(comprimida){
              fs.addDoc(fs.collection(window.db,'requisiciones_compra',id,'fotos'), {
                src:comprimida, origen:'compras', autor:autor, autorEmail:autorEmail, creadoEn:new Date().toISOString()
              }).then(function(){ res(); }).catch(function(e){ alert('No se pudo subir una foto: '+(e.message||e)); res(); });
            });
          };
          r.readAsDataURL(file);
        });
      })).then(function(){ input.value=''; renderFotosGrid(id); });
    });
  };
  window.__cpCerrarDetalle = function(){
    document.getElementById('cp-detalle-overlay').style.display='none';
    detalleId=null;
  };

  // Resuelve quién debe autorizar un paso dado — reusado por el autorizar
  // automático y por "Reenviar liga" en el panel de firmas pendientes.
  function _cpDestinatariosPaso(d, paso){
    var cfg = _configFlujoCache || {jefesPorDepto:{}, aprobadoresCompras:[]};
    var out = [];
    if(paso.label==='Jefe de área'){
      var depto = departamentoPorCorreo(d.solicitante);
      var jefe = depto && cfg.jefesPorDepto ? cfg.jefesPorDepto[depto] : null;
      if(jefe && jefe.correo) out.push(jefe);
    } else if(paso.label==='Compras'){
      (cfg.aprobadoresCompras||[]).forEach(function(a){ if(a.correo) out.push(a); });
    }
    return out;
  }
  function _cpNotificarPaso(fs, d, paso){
    _cpDestinatariosPaso(d, paso).forEach(function(persona){
      fs.addDoc(fs.collection(window.db,'flotilla_notificaciones'), {
        para:(persona.correo||'').toLowerCase().trim(), tipo:'requisicion_autorizar',
        mensaje:'Requisición '+(d.folio||d.id)+' espera tu autorización',
        link:'firmar.html?id='+d.id,
        leido:false, creadaEn:new Date().toISOString(),
      }).catch(function(e){ console.warn('[compras] no se pudo notificar', e); });
    });
  }

  window.__cpAutorizar = function(id){
    var d = docs.find(function(x){ return x.id===id; }); if(!d) return;
    var flujo = (d.flujoAutorizacion||[]).map(function(f){ return Object.assign({},f); });
    var idx = flujo.findIndex(function(f){ return f.estatus==='pendiente'; });
    if(idx===-1) return;
    cargarFirestore().then(function(fs){
      flujo[idx].estatus='aprobado';
      flujo[idx].uid = window.auth && window.auth.currentUser ? window.auth.currentUser.uid : null;
      flujo[idx].fecha = new Date().toISOString();
      var esUltimo = idx===flujo.length-1;
      var update = {flujoAutorizacion:flujo};
      if(esUltimo) update.estatus='cotizando';
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), update).then(function(){
        if(esUltimo){ toast('Requisición autorizada — pasa a Cotizando'); return; }
        // Notifica a quien deba autorizar el SIGUIENTE paso, con liga directa
        // al documento (?firmar=id) — antes nadie se enteraba de que le tocaba.
        _cpNotificarPaso(fs, d, flujo[idx+1]);
      });
    });
  };

  window.__cpRechazar = function(id){
    var motivo = (document.getElementById('cp-motivo-txt').value||'').trim();
    if(!motivo){ alert('Escribe el motivo del rechazo'); return; }
    var d = docs.find(function(x){ return x.id===id; }); if(!d) return;
    cargarFirestore().then(function(fs){
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {estatus:'rechazada', motivoRechazo:motivo}).then(function(){
        if(d.solicitanteEmail){
          fs.addDoc(fs.collection(window.db,'flotilla_notificaciones'), {
            para:d.solicitanteEmail, tipo:'requisicion_rechazada',
            mensaje:'Tu requisición '+(d.folio||id)+' fue rechazada: '+motivo,
            leido:false, creadaEn:new Date().toISOString(),
          }).catch(function(e){ console.warn('[compras] no se pudo notificar al solicitante', e); });
        }
        window.__cpCerrarDetalle();
      });
    });
  };

  // ── COTIZACIONES ─────────────────────────────────────────────
  function cargarCotizaciones(id){
    var list=document.getElementById('cp-cotizaciones-list'); if(!list) return;
    list.innerHTML='<p style="font-size:11px;color:#5C7089">Cargando…</p>';
    cargarFirestore().then(function(fs){
      fs.getDocs(fs.collection(window.db,'requisiciones_compra',id,'cotizaciones')).then(function(snap){
        var cots = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        list.innerHTML = cots.length ? cots.map(function(c){
          return '<div style="display:flex;justify-content:space-between;align-items:center;background:#F8FAFD;border-radius:8px;padding:8px 10px;margin-bottom:6px">' +
            '<div style="font-size:12px"><b>'+esc(c.proveedor)+'</b> · $'+esc(c.monto)+'</div>' +
            '<button onclick="window.__cpElegirGanadora(\''+id+'\',\''+c.id+'\')" style="padding:5px 10px;background:#12A150;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">Elegir ganadora</button></div>';
        }).join('') : '<p style="font-size:11px;color:#5C7089">Sin cotizaciones todavía.</p>';
      });
    });
  }
  window.__cpAgregarCotizacion = function(id){
    var proveedor=document.getElementById('cp-cot-proveedor').value.trim();
    var monto=document.getElementById('cp-cot-monto').value.trim();
    var fileInput=document.getElementById('cp-cot-file');
    if(!proveedor||!monto){ alert('Escribe proveedor y monto'); return; }
    var leer = fileInput.files[0] ? new Promise(function(res){
      var r=new FileReader(); r.onload=function(){ res(r.result); }; r.readAsDataURL(fileInput.files[0]);
    }) : Promise.resolve(null);
    leer.then(function(archivoBase64){
      cargarFirestore().then(function(fs){
        fs.addDoc(fs.collection(window.db,'requisiciones_compra',id,'cotizaciones'), {
          proveedor:proveedor, monto:Number(monto), archivoBase64:archivoBase64,
          creadaEn:new Date().toISOString(), porUid: window.auth&&window.auth.currentUser?window.auth.currentUser.uid:null,
        }).then(function(){ cargarCotizaciones(id); });
      });
    });
  };
  function _cpMostrarExito(folio, id){
    var ov = document.createElement('div');
    ov.id = 'cp-exito-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.6);z-index:2200;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:16px;max-width:380px;width:100%;text-align:center;padding:0;overflow:hidden">' +
        '<div style="background:#F8FAFD;padding:28px 24px 22px">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:#EAF3DE;display:flex;align-items:center;justify-content:center;margin:0 auto 14px"><span style="font-size:26px;color:#12A150">✓</span></div>' +
          '<h3 style="margin:0 0 6px;font-size:17px;color:#0A1628">Orden generada</h3>' +
          '<p style="margin:0;font-size:12.5px;color:#5C7089">La orden de compra ya está lista para descargar.</p>' +
        '</div>' +
        '<div style="padding:20px 24px">' +
          '<div style="background:#FCEBEB;border-radius:9px;padding:10px;margin-bottom:16px"><p style="margin:0;font-size:10.5px;color:#94A3B8;font-weight:700">FOLIO</p><p style="margin:2px 0 0;font-size:15px;font-weight:800;color:#E23B2E">'+esc(folio)+'</p></div>' +
          '<button onclick="document.getElementById(\'cp-exito-overlay\').remove();window.__cpDescargarOC(\''+id+'\')" style="width:100%;padding:12px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px">Descargar PDF</button>' +
          '<button onclick="document.getElementById(\'cp-exito-overlay\').remove()" style="width:100%;padding:12px;background:#F1F5F9;color:#5C7089;border:none;border-radius:10px;font-weight:700;font-size:13px;cursor:pointer">Cerrar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
  }

  window.__cpElegirGanadora = function(id,cotId){
    cargarFirestore().then(function(fs){
      fs.getDoc(fs.doc(window.db,'requisiciones_compra',id,'cotizaciones',cotId)).then(function(snap){
        if(!snap.exists()) return;
        var c=snap.data();
        var cotizacionGanadora={proveedor:c.proveedor,monto:c.monto,cotizacionId:cotId};
        var ocFolio='OC-'+String(Date.now()).slice(-6);
        fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {
          estatus:'orden_generada', cotizacionGanadora:cotizacionGanadora, ocFolio:ocFolio,
        }).then(function(){
          toast('Orden de compra generada');
          var d = docs.find(function(x){ return x.id===id; });
          if(d) sincronizarCuentaPorPagar(Object.assign({},d,{estatus:'orden_generada',cotizacionGanadora:cotizacionGanadora,ocFolio:ocFolio}), 'orden_generada');
          _cpMostrarExito(ocFolio, id);
        });
      });
    });
  };
  // Atajo: guarda la cotización, la marca ganadora y descarga la OC en un
  // solo clic — sin pasar por la lista intermedia de "elegir ganadora".
  window.__cpEnviarDirectoACompra = function(id){
    var proveedor=document.getElementById('cp-cot-proveedor').value.trim();
    var monto=document.getElementById('cp-cot-monto').value.trim();
    if(!proveedor||!monto){ alert('Escribe proveedor y monto.'); return; }
    var d = docs.find(function(x){ return x.id===id; }); if(!d) return;
    var fileInput=document.getElementById('cp-cot-file');
    var leer = fileInput && fileInput.files[0] ? new Promise(function(res){
      var r=new FileReader(); r.onload=function(){ res(r.result); }; r.readAsDataURL(fileInput.files[0]);
    }) : Promise.resolve(null);
    leer.then(function(archivoBase64){
      cargarFirestore().then(function(fs){
        fs.addDoc(fs.collection(window.db,'requisiciones_compra',id,'cotizaciones'), {
          proveedor:proveedor, monto:Number(monto), archivoBase64:archivoBase64,
          creadaEn:new Date().toISOString(), porUid: window.auth&&window.auth.currentUser?window.auth.currentUser.uid:null,
        }).then(function(cotRef){
          var ocFolio='OC-'+String(Date.now()).slice(-6);
          var cotizacionGanadora={proveedor:proveedor,monto:Number(monto),cotizacionId:cotRef.id};
          fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {
            estatus:'orden_generada', cotizacionGanadora:cotizacionGanadora, ocFolio:ocFolio,
          }).then(function(){
            var dActualizado = Object.assign({}, d, {estatus:'orden_generada', cotizacionGanadora:cotizacionGanadora, ocFolio:ocFolio});
            sincronizarCuentaPorPagar(dActualizado, 'orden_generada');
            _cpMostrarExito(ocFolio, id);
          });
        });
      });
    });
  };
  // ── PUENTE COMPRAS → PAGOS ──────────────────────────────────────
  // Colección 'pagos_cuentas_por_pagar' — un doc por requisición (id =
  // requisicionId, upsert). Compras solo informa que existe una cuenta por
  // pagar y su monto; Pagos es dueño de estatusPago/fechaPago y nunca se
  // sobreescribe desde aquí. `aspelFolio` va vacío — es el campo que la
  // futura integración con Aspel llenará sola; el resto de la estructura ya
  // queda lista para ese día sin tener que rediseñar nada.
  function sincronizarCuentaPorPagar(d, estatusCompra){
    cargarFirestore().then(function(fs){
      var ref = fs.doc(window.db,'pagos_cuentas_por_pagar',d.id);
      fs.getDoc(ref).then(function(snap){
        var payload = {
          requisicionId:d.id, folio:d.folio||null, ocFolio:d.ocFolio||null,
          empresa:d.empresa||null, proveedor:(d.cotizacionGanadora&&d.cotizacionGanadora.proveedor)||null,
          monto:(d.cotizacionGanadora&&d.cotizacionGanadora.monto)!=null?d.cotizacionGanadora.monto:null,
          solicitante:nombrePorCorreo(d.solicitante)||null,
          estatusCompra:estatusCompra, actualizadaEn:new Date().toISOString(),
        };
        if(!snap.exists()){
          payload.estatusPago='pendiente'; payload.fechaPago=null; payload.aspelFolio=null;
          payload.creadaEn=new Date().toISOString();
        }
        fs.setDoc(ref, payload, {merge:true}).catch(function(e){ console.warn('[compras→pagos] no se pudo sincronizar', e); });
      });
    });
  }

  window.__cpMarcarRecibida = function(id){
    cargarFirestore().then(function(fs){
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {estatus:'recibida'}).then(function(){
        toast('Marcada como recibida');
        var d = docs.find(function(x){ return x.id===id; });
        if(d) sincronizarCuentaPorPagar(Object.assign({},d,{estatus:'recibida'}), 'recibida');
      });
    });
  };

  // ── ORDEN DE COMPRA EN PDF ──────────────────────────────────────
  // Incluye TODA la información de la requisición (regla global del portal):
  // datos generales, partidas, proveedor ganador, flujo de autorización
  // completo, firma, fotos y comentarios — multipágina, con "página X de Y".
  function _cpPrecargarDimensiones(fotos){
    return Promise.all((fotos||[]).map(function(f){
      return new Promise(function(res){
        var img = new Image();
        img.onload = function(){ res([f.src,{w:img.width,h:img.height}]); };
        img.onerror = function(){ res([f.src,{w:1,h:1}]); };
        img.src = f.src;
      });
    })).then(function(pares){
      var mapa={}; pares.forEach(function(p){ mapa[p[0]]=p[1]; }); return mapa;
    });
  }

  // ── Logo de la empresa (misma fuente que ya usa Requisición: empresas_requisicion.logoBase64) ──
  var _logosCache = null;
  function cargarLogoEmpresa(nombreEmpresa){
    var p = _logosCache ? Promise.resolve(_logosCache) : cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'empresas_requisicion')).then(function(snap){
        _logosCache = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        return _logosCache;
      }).catch(function(){ _logosCache=[]; return _logosCache; });
    });
    return p.then(function(lista){
      var emp = lista.find(function(e){ return e.nombre===nombreEmpresa; });
      return emp ? emp.logoBase64 : null;
    });
  }

  window.__cpDescargarOC = function(id){
    var d = docs.find(function(x){ return x.id===id; });
    if(!d || !window.jspdf) return;
    Promise.all([cargarFotos(id), cargarColaboradores(), cargarLogoEmpresa(d.empresa)]).then(function(res){
      var fotos = res[0], logo = res[2];
      return _cpPrecargarDimensiones(fotos).then(function(fotoDim){
        _cpConstruirYDescargarOC(d, fotos, fotoDim, logo);
      });
    }).catch(function(e){ console.error('[compras] error al generar OC:', e); alert('No se pudo generar el PDF: '+(e.message||e)); });
  };

  function _cpConstruirYDescargarOC(d, fotos, fotoDim, logo){
    var jsPDF = window.jspdf.jsPDF;
    var docu = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
    var PW=215.9, PH=279.4, ML=14, MR=14;
    var AZUL={r:10,g:22,b:40};
    var tipoInfo = REQ_TIPO_INFO[d.tipoCompra] || REQ_TIPO_INFO.servicio;
    var URG = {baja:{r:100,g:116,b:139},media:{r:180,g:83,b:9},alta:{r:185,g:28,b:28}}[d.urgencia] || {r:100,g:116,b:139};

    function nuevaPagina(){ docu.addPage(); return 20; }

    // ── Encabezado (con logo si la empresa tiene uno cargado) ──
    docu.setFillColor(AZUL.r,AZUL.g,AZUL.b); docu.rect(0,0,PW,26,'F');
    var xTexto = ML;
    if(logo){
      // Fondo blanco detrás del logo — el logo de TECNOCONTROL tiene texto
      // oscuro y se volvía invisible sobre la franja azul marino.
      try{
        docu.setFillColor(255,255,255); docu.roundedRect(ML,5,34,16,2,2,'F');
        docu.addImage(logo,ML+1,6,32,14,undefined,'FAST');
        xTexto = ML+38;
      }catch(e){}
    }
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(11);
    docu.text('Orden de compra', xTexto, 15);
    docu.setFont('helvetica','normal'); docu.setFontSize(8);
    docu.text((d.empresa||'TECNOCONTROL')+' · Requisición '+(d.folio||''), xTexto, 20.5);
    docu.text(String(d.ocFolio||'OC'), PW-MR, 15, {align:'right'});
    docu.text(new Date().toLocaleDateString('es-MX'), PW-MR, 20.5, {align:'right'});

    var y=36;
    // ── Badges de urgencia / tipo de compra / estatus ──
    docu.setFillColor(URG.r,URG.g,URG.b); docu.roundedRect(ML,y-5,PW-ML-MR,10,2,2,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(9);
    docu.text('Urgencia: '+String(d.urgencia||'—').toUpperCase(), ML+5, y+1.5);
    docu.text('Tipo: '+String(d.tipoCompra||'—').toUpperCase(), PW/2, y+1.5);
    var estLabel = (ESTADOS.find(function(e){ return e.id===(d.estatus||'pendiente'); })||{}).label || d.estatus || '—';
    docu.text(estLabel, PW-MR-5, y+1.5, {align:'right'});
    y += 12;
    docu.setFont('helvetica','italic'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
    docu.text(tipoInfo.entrada+' · '+tipoInfo.factura, ML, y); y += 9;

    // ── Datos generales ──
    function campo(x,label,valor){
      docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
      docu.text(String(label).toUpperCase(), x, y);
      docu.setFont('helvetica','normal'); docu.setFontSize(10); docu.setTextColor(15,23,42);
      var lns = docu.splitTextToSize(String(valor==null||valor===''?'—':valor), (PW-ML-MR)/2-6);
      docu.text(lns, x, y+5);
      return lns.length;
    }
    var xMid = ML+(PW-ML-MR)/2+4;
    var nSolicitante = campo(ML,'Solicitante', nombrePorCorreo(d.solicitante));
    var nCiudad = campo(xMid,'Ciudad', d.ciudad);
    y += Math.max(nSolicitante,nCiudad)*5 + 9;
    function campoAncho(label,valor){
      docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
      docu.text(String(label).toUpperCase(), ML, y);
      docu.setFont('helvetica','normal'); docu.setFontSize(10); docu.setTextColor(15,23,42);
      var lns = docu.splitTextToSize(String(valor==null||valor===''?'—':valor), PW-ML-MR);
      docu.text(lns, ML, y+5);
      y += 5+lns.length*5+6;
    }
    campoAncho('Cliente / razón social', d.razonSocial||d.cliente);
    if(d.estacionNombre||d.direccion) campoAncho('Estación / ubicación', d.estacionNombre||d.direccion);
    campoAncho('Motivo', d.motivo);
    var nProveedor = campo(ML,'Proveedor ganador', (d.cotizacionGanadora&&d.cotizacionGanadora.proveedor));
    var nMonto = campo(xMid,'Monto', d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null ? ('$'+d.cotizacionGanadora.monto) : null);
    y += Math.max(nProveedor,nMonto)*5 + 10;

    // ── Tabla de partidas (salto de página automático) ──
    if(y>PH-70){ y=nuevaPagina(); }
    docu.setFillColor(AZUL.r,AZUL.g,AZUL.b); docu.rect(ML,y-5,PW-ML-MR,8,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(8);
    docu.text('CANT.',ML+2,y); docu.text('UNIDAD',ML+18,y); docu.text('DESCRIPCIÓN',ML+42,y); docu.text('PROVEEDOR',PW-MR-2,y,{align:'right'});
    y+=8;
    docu.setFont('helvetica','normal'); docu.setFontSize(9.5);
    (d.items||[]).forEach(function(it,idx){
      var lns = docu.splitTextToSize(String(it.desc||'—'), PW-ML-MR-42-35);
      if(y+lns.length*5>PH-25){ y=nuevaPagina(); }
      if(idx%2===1){ docu.setFillColor(248,250,252); docu.rect(ML,y-4,PW-ML-MR,lns.length*5+2,'F'); }
      docu.setTextColor(15,23,42);
      docu.text(String(it.cant||'—'),ML+2,y); docu.text(String(it.unidad||'—'),ML+18,y);
      docu.text(lns,ML+42,y); docu.text(String(it.proveedor||'—'),PW-MR-2,y,{align:'right'});
      y += Math.max(6, lns.length*5+1.5);
    });

    // ── Flujo de autorización (con nombre resuelto donde hay correo) ──
    y+=8; if(y>PH-40){ y=nuevaPagina(); }
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
    docu.text('FLUJO DE AUTORIZACIÓN',ML,y); y+=6;
    (d.flujoAutorizacion||[]).forEach(function(p){
      if(y>PH-25){ y=nuevaPagina(); }
      docu.setFont('helvetica','normal'); docu.setFontSize(9); docu.setTextColor(15,23,42);
      var fechaTxt = p.fecha ? (' · '+new Date(p.fecha).toLocaleDateString('es-MX')) : '';
      docu.text((p.orden+'. '+p.label+fechaTxt), ML+2, y);
      var col = p.estatus==='aprobado' ? [21,128,61] : [180,83,9];
      docu.setTextColor(col[0],col[1],col[2]); docu.setFont('helvetica','bold');
      docu.text(p.estatus==='aprobado'?'Aprobado':'Pendiente', PW-MR-2, y, {align:'right'});
      y+=6;
    });

    if(d.estatus==='rechazada'){
      y+=4; if(y>PH-30){ y=nuevaPagina(); }
      docu.setFillColor(252,235,235); docu.rect(ML,y-5,PW-ML-MR,14,'F');
      docu.setTextColor(121,31,31); docu.setFont('helvetica','bold'); docu.setFontSize(8);
      docu.text('RECHAZADA', ML+3, y);
      docu.setFont('helvetica','normal'); docu.setFontSize(9);
      var lnsRech = docu.splitTextToSize(String(d.motivoRechazo||'Sin motivo registrado'), PW-ML-MR-6);
      docu.text(lnsRech, ML+3, y+5);
      y += 10 + lnsRech.length*5;
    }

    // ── Comentarios ──
    var comentarios = d.comentarios || [];
    if(comentarios.length){
      y+=6; if(y>PH-40){ y=nuevaPagina(); }
      docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
      docu.text('COMENTARIOS',ML,y); y+=6;
      comentarios.forEach(function(c){
        var autor = String(nombrePorCorreo(c.autorEmail||c.autor)||'—');
        var fechaTxt = c.fecha ? (' · '+new Date(c.fecha).toLocaleDateString('es-MX')) : '';
        var lns = docu.splitTextToSize(String(c.texto||''), PW-ML-MR);
        if(y+7+lns.length*5>PH-25){ y=nuevaPagina(); }
        docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(37,99,235);
        docu.text(autor+fechaTxt, ML, y); y+=5;
        docu.setFont('helvetica','normal'); docu.setFontSize(9); docu.setTextColor(15,23,42);
        docu.text(lns, ML, y);
        y += lns.length*5+5;
      });
    }

    // ── Fotos (grid 2 columnas, sin deformar) ──
    if(fotos.length){
      y+=6; if(y>PH-70){ y=nuevaPagina(); }
      docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
      docu.text('FOTOS', ML, y); y+=6;
      var colW=(PW-ML-MR-8)/2, boxH=60;
      for(var i=0;i<fotos.length;i+=2){
        if(y+boxH>PH-20){ y=nuevaPagina(); }
        for(var c=0;c<2;c++){
          var f=fotos[i+c]; if(!f) continue;
          var x=ML+c*(colW+8);
          try{
            var dim = fotoDim[f.src] || {w:1,h:1};
            var ratio = Math.min(colW/dim.w, boxH/dim.h);
            var w = dim.w*ratio, h = dim.h*ratio;
            docu.addImage(f.src,'JPEG', x+(colW-w)/2, y+(boxH-h)/2, w, h);
          }catch(e){}
          docu.setDrawColor(226,232,240); docu.rect(x,y,colW,boxH);
          docu.setFont('helvetica','normal'); docu.setFontSize(6.5); docu.setTextColor(148,163,184);
          docu.text(f.origen==='compras'?'Compras':'Solicitante', x+2, y+boxH-2);
        }
        y+=boxH+6;
      }
    }

    // ── Firma ──
    y+=8; if(y>PH-40){ y=nuevaPagina(); }
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
    docu.text('FIRMA DEL SOLICITANTE', ML, y); y+=4;
    if(d.firma){ try{ docu.addImage(d.firma,'PNG',ML,y,55,24); }catch(e){} }
    else { docu.setDrawColor(203,213,225); docu.line(ML,y+18,ML+55,y+18); }

    // ── Pie de página con folio + "página X de Y" en TODAS las páginas ──
    var totalPaginas = docu.internal.getNumberOfPages();
    for(var p=1;p<=totalPaginas;p++){
      docu.setPage(p);
      docu.setFillColor(AZUL.r,AZUL.g,AZUL.b); docu.rect(0,PH-10,PW,10,'F');
      docu.setTextColor(255,255,255); docu.setFontSize(7);
      docu.text(String(d.empresa||'')+' · '+String(d.ocFolio||d.folio||''), ML, PH-4);
      docu.text('Página '+p+' de '+totalPaginas, PW-MR, PH-4, {align:'right'});
    }
    docu.save((d.ocFolio||d.folio||'OC')+'.pdf');
  }

  // ── EXPORT PREVIEW PARA ASPEL (Fase 2) ─────────────────────────
  window.__cpExportarAspel = function(){
    var listas = docs.filter(function(d){ return d.estatus==='orden_generada'||d.estatus==='recibida'; });
    var payload = listas.map(function(d){
      return {folio:d.folio, empresa:d.empresa, proveedor:d.cotizacionGanadora&&d.cotizacionGanadora.proveedor,
        monto:d.cotizacionGanadora&&d.cotizacionGanadora.monto, items:d.items, ocFolio:d.ocFolio};
    });
    var blob = new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='compras_aspel_preview.json'; a.click();
    URL.revokeObjectURL(url);
  };

})();
