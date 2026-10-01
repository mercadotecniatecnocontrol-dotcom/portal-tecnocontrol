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
  // Normaliza para comparar sin acentos/mayúsculas/espacios dobles.
  function _cpNorm(t){ return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
  // Departamento del solicitante de una requisición. Las del kiosco guardan
  // el NOMBRE en 'solicitante' y el correo en 'solicitanteEmail', así que se
  // intenta en orden: campo explícito → solicitanteEmail → solicitante como
  // correo → coincidencia por nombre en colaboradores. El resultado se ajusta
  // a la llave exacta usada en config_flujo_compras.jefesPorDepto.
  function deptoSolicitante(d){
    if(!d) return null;
    var depto = d.departamentoSolicitante || d.departamento || null;
    if(!depto && d.solicitanteEmail) depto = departamentoPorCorreo(d.solicitanteEmail);
    if(!depto && d.solicitante && String(d.solicitante).indexOf('@')>-1) depto = departamentoPorCorreo(d.solicitante);
    if(!depto && d.solicitante){
      var n = _cpNorm(d.solicitante);
      var col = (_colaboradoresCache||[]).find(function(x){ return x.nombre && _cpNorm(x.nombre)===n; });
      if(col) depto = col.departamento || null;
    }
    if(!depto) return null;
    var cfg = _configFlujoCache || {};
    var llaves = Object.keys(cfg.jefesPorDepto||{}).concat(DEPTOS_CP);
    var exacta = llaves.find(function(k){ return _cpNorm(k)===_cpNorm(depto); });
    return exacta || depto;
  }
  // Correo con el que se identificó al solicitante (para mensajes de ayuda).
  function correoSolicitante(d){
    if(d.solicitanteEmail) return d.solicitanteEmail;
    if(d.solicitante && String(d.solicitante).indexOf('@')>-1) return d.solicitante;
    return null;
  }
  // ¿Puede ESTE usuario aprobar ESTE paso? Solicitante siempre puede (su propio
  // paso ya llega aprobado al crear la requisición). Jefe de área: debe ser el
  // asignado al departamento del solicitante. Compras: debe estar en la lista.
  function puedoAutorizarPaso(d, paso, miCorreo){
    if(!paso) return false;
    if(paso.label==='Solicitante') return true;
    var cfg = _configFlujoCache || {jefesPorDepto:{}, aprobadoresCompras:[]};
    if(paso.label==='Jefe de área'){
      var depto = deptoSolicitante(d);
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
              var quien = destinos.length ? destinos.map(function(p){return p.nombre||p.correo;}).join(', ') : 'sin asignar — configúralo en "Configurar flujo"';
              return '<div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #F1F5F9;padding:10px 4px">' +
                '<div><p style="font-size:13px;font-weight:700;margin:0;color:#0A1628">'+esc(d.folio||d.id)+' · '+esc(paso.label)+'</p>' +
                '<p style="font-size:11.5px;color:#5C7089;margin:2px 0 0">Solicitó: '+esc(nombrePorCorreo(d.solicitante)||'—')+' · Falta: <b>'+esc(quien)+'</b></p></div>' +
                '<div style="display:flex;gap:6px;flex-shrink:0">' +
                '<button onclick="window.__cpCopiarLigaFirma(\''+d.id+'\',this)" style="padding:7px 13px;background:#F1F5F9;color:#0A1628;border:none;border-radius:8px;font-size:11.5px;font-weight:700;cursor:pointer">Copiar liga</button>' +
                '<button '+(destinos.length?'':'disabled')+' onclick="window.__cpReenviarFirma(\''+d.id+'\',this)" style="padding:7px 13px;background:'+(destinos.length?'#0A1628':'#E2E8F0')+';color:'+(destinos.length?'#fff':'#94A3B8')+';border:none;border-radius:8px;font-size:11.5px;font-weight:700;cursor:'+(destinos.length?'pointer':'default')+'">Reenviar aviso (in-app)</button>' +
                '</div></div>';
            }).join('') : '<p style="font-size:12.5px;color:#94a3b8;text-align:center;padding:20px 0">No hay firmas pendientes. ¡Todo al día!</p>') + '</div>' +
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
            '<button onclick="window.__cpExportarCSV()" style="padding:8px 16px;background:#12A150;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Exportar a Excel (CSV)</button>' +
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
          '<button id="cp-mtab-presup" onclick="window.__cpSetVistaModulo(\'presup\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#94A3B8;border-bottom:2px solid transparent;cursor:pointer">Presupuestos</button>' +
        '</div>' +

        '<div id="cp-vista-req">' +
        '<style>' +
          '#cp-vista-req .cp-btn{padding:9px 14px;border-radius:9px;border:1px solid #E2E8F0;background:#fff;color:#0A1628;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit}' +
          '#cp-vista-req .cp-btn:hover{background:#F8FAFC}' +
          '#cp-vista-req .cp-btn:focus-visible,#cp-vista-req .cp-kpi:focus-visible,#cp-vista-req .cp-card:focus-visible,#cp-vista-req .cp-in:focus-visible{outline:3px solid rgba(20,115,230,.35);outline-offset:1px}' +
          '#cp-vista-req .cp-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}' +
          '@media(max-width:900px){#cp-vista-req .cp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
          '#cp-vista-req .cp-kpi{text-align:left;background:#F8FAFC;border:1.5px solid transparent;border-radius:12px;padding:12px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s,background .15s}' +
          '#cp-vista-req .cp-kpi:hover{border-color:#CBD5E1}' +
          '#cp-vista-req .cp-kpi.on{border-color:#0A1628;background:#fff;box-shadow:0 1px 4px rgba(10,22,40,.1)}' +
          '#cp-vista-req .cp-tool{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center}' +
          '#cp-vista-req .cp-in{padding:8px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;background:#fff;color:#0A1628;font-family:inherit;min-height:36px;box-sizing:border-box}' +
          '#cp-vista-req .cp-board{display:grid;grid-template-columns:repeat(4,minmax(240px,1fr));gap:14px;overflow-x:auto;padding-bottom:6px}' +
          '#cp-vista-req .cp-col{background:#F8FAFC;border:1px solid #EEF2F7;border-radius:12px;padding:10px;min-height:140px;max-height:72vh;overflow-y:auto}' +
          '#cp-vista-req .cp-card{background:#fff;border:1px solid #E5EAF1;border-left:4px solid var(--c);border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:box-shadow .15s,transform .15s}' +
          '#cp-vista-req .cp-card:hover{box-shadow:0 3px 10px rgba(10,22,40,.08);transform:translateY(-1px)}' +
          '#cp-vista-req .cp-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap}' +
          '#cp-vista-req .cp-tabla{width:100%;border-collapse:collapse;font-size:12.5px;min-width:820px}' +
          '#cp-vista-req .cp-tabla th{padding:10px 12px;font-size:10.5px;color:#5C7089;text-transform:uppercase;text-align:left;background:#F8FAFC;letter-spacing:.3px}' +
          '#cp-vista-req .cp-tabla td{padding:10px 12px;border-top:1px solid #EEF2F7;vertical-align:middle}' +
          '#cp-vista-req .cp-tabla tr.cp-fila{cursor:pointer}#cp-vista-req .cp-tabla tr.cp-fila:hover td{background:#F8FAFC}' +
          '@media (prefers-reduced-motion:reduce){#cp-vista-req .cp-card,#cp-vista-req .cp-kpi{transition:none}#cp-vista-req .cp-card:hover{transform:none}}' +
        '</style>' +
        '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:12px">' +
          '<div><h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628;display:flex;align-items:center;gap:8px">Requisiciones de compra' +
            '<button onclick="window.__cpAyuda()" aria-label="¿Cómo funciona?" title="¿Cómo funciona?" style="width:22px;height:22px;border-radius:50%;border:1.5px solid #CBD5E1;background:#fff;color:#5C7089;font-size:12px;font-weight:800;cursor:pointer;line-height:1;padding:0">?</button></h2>' +
          '<p style="font-size:12px;color:#5C7089;margin:4px 0 0">Aquí ves <b>todo lo que sigue abierto</b>, sin importar el mes en que se pidió. Lo ya recibido o rechazado se filtra por mes.</p></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="cp-btn" onclick="window.__cpAbrirFirmasPendientes()">'+_cpIco('firma')+'Firmas pendientes</button>' +
          '<button class="cp-btn" onclick="window.__cpAbrirConfigFlujo()">'+_cpIco('engrane')+'Configurar flujo</button>' +
          '<button class="cp-btn" onclick="window.__cpAbrirBuscador()">'+_cpIco('historial')+'Historial completo</button>' +
          '<button class="cp-btn" onclick="window.__cpExportarAspel()">Exportar Aspel</button>' +
          '</div>' +
        '</div>' +

        '<div id="cp-alerta"></div>' +
        '<div id="cp-kpis" class="cp-kpis"></div>' +

        '<div class="cp-tool">' +
          '<div style="position:relative;flex:1 1 240px;min-width:200px">' +
            '<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94A3B8;display:flex">'+_cpIco('lupa')+'</span>' +
            '<input id="cp-f-texto" class="cp-in" type="search" aria-label="Buscar requisición" placeholder="Buscar por folio, persona, producto o proveedor…" oninput="window.__cpFiltroTexto(this.value)" style="width:100%;padding-left:32px">' +
          '</div>' +
          '<select id="cp-f-empresa" class="cp-in" aria-label="Empresa" onchange="window.__cpFiltro(\'empresa\',this.value)"><option value="">Todas las empresas</option></select>' +
          '<select id="cp-f-solicitante" class="cp-in" aria-label="Quién pidió" onchange="window.__cpFiltro(\'solicitante\',this.value)" style="max-width:210px"><option value="">Todas las personas</option></select>' +
          '<select id="cp-f-prioridad" class="cp-in" aria-label="Prioridad" onchange="window.__cpFiltro(\'prioridad\',this.value)"><option value="">Cualquier prioridad</option><option value="alta">Marcada urgente</option><option value="media">Media</option><option value="baja">Baja</option></select>' +
          '<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#5C7089;font-weight:600">Pedida desde <input id="cp-f-desde" class="cp-in" type="date" onchange="window.__cpFiltro(\'desde\',this.value)"></label>' +
          '<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#5C7089;font-weight:600">hasta <input id="cp-f-hasta" class="cp-in" type="date" onchange="window.__cpFiltro(\'hasta\',this.value)"></label>' +
        '</div>' +

        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">' +
          '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
            '<button id="cp-tab-activas" onclick="window.__cpSetTab(false)" style="padding:7px 15px;border-radius:20px;border:none;background:#0A1628;color:#fff;font-size:12px;font-weight:700;cursor:pointer">En curso</button>' +
            '<button id="cp-tab-rechazadas" onclick="window.__cpSetTab(true)" style="padding:7px 15px;border-radius:20px;border:none;background:#F8FAFC;color:#5C7089;font-size:12px;font-weight:700;cursor:pointer">Rechazadas</button>' +
            '<label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#5C7089;font-weight:600;margin-left:6px">Mes de lo ya terminado <input id="cp-f-mes" class="cp-in" type="month" onchange="window.__cpFiltro(\'mes\',this.value)"></label>' +
          '</div>' +
          '<div role="group" aria-label="Tipo de vista" style="display:flex;background:#F1F5F9;border-radius:9px;padding:3px">' +
            '<button id="cp-v-tablero" onclick="window.__cpVista(\'tablero\')" style="padding:6px 12px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">'+_cpIco('tablero')+'Tablero</button>' +
            '<button id="cp-v-lista" onclick="window.__cpVista(\'lista\')" style="padding:6px 12px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px">'+_cpIco('lista')+'Lista</button>' +
          '</div>' +
        '</div>' +
        '<div id="cp-filtro-activo"></div>' +
        '<div id="cp-board"></div>' +
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

        '<div id="cp-vista-presup" style="display:none">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628">Presupuestos por departamento</h2>' +
          '<button onclick="window.__cpAbrirEditarPresupuesto()" style="padding:9px 16px;border-radius:9px;border:none;background:#0A1628;color:#fff;font-size:12px;font-weight:700;cursor:pointer">✎ Editar presupuesto</button></div>' +
          '<p style="font-size:12px;color:#94A3B8;margin:0 0 18px">Mes en curso — el gastado se calcula de las órdenes de compra ya generadas este mes.</p>' +
          '<div id="cp-presup-lista" style="display:flex;flex-direction:column;gap:10px"></div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin:24px 0 10px"><h3 style="font-size:13.5px;font-weight:700;margin:0;color:#0A1628">Historial de cambios</h3></div>' +
          '<div id="cp-presup-historial" style="background:#F8FAFC;border-radius:12px;overflow:hidden"></div>' +
        '</div>' +
      '</div></div>' +
      '<div id="cp-detalle-overlay" style="display:none;position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2000;align-items:center;justify-content:center;padding:24px">' +
        '<div id="cp-detalle-panel" style="background:#fff;border-radius:14px;max-width:920px;width:100%;max-height:88vh;overflow-y:auto;padding:22px"></div>' +
      '</div>';
  }

  window.__cpSetVistaModulo = function(vista){
    ['req','prov','cxp','presup'].forEach(function(v){
      document.getElementById('cp-vista-'+v).style.display = v===vista?'block':'none';
      var tab = document.getElementById('cp-mtab-'+v);
      tab.style.color = v===vista?'#0A1628':'#94A3B8';
      tab.style.borderBottomColor = v===vista?'#0A1628':'transparent';
    });
    if(vista==='prov') cargarProveedores();
    if(vista==='cxp') cargarCuentasPorPagarVista();
    if(vista==='presup') cargarPresupuestos();
  };

  // ── PROVEEDORES — catálogo propio de Compras; alimenta el autocompletar
  //    de "Proveedor" al cotizar, en vez de texto libre sin memoria ──
  var _proveedoresCache = null;
  // ── PRESUPUESTOS — por departamento, mes en curso. El "gastado" se
  //    calcula solo (suma de OC ya generadas este mes por solicitantes de
  //    ese departamento) — nadie lo captura a mano. El monto asignado sí
  //    es editable, y cada cambio queda en presupuestos_historial (quién,
  //    cuándo, de cuánto a cuánto) — nunca se sobreescribe sin rastro.
  var _presupuestosCache = {};
  function cargarPresupuestos(){
    var elLista = document.getElementById('cp-presup-lista');
    if(elLista) elLista.innerHTML = '<p style="font-size:12px;color:#94a3b8">Cargando…</p>';
    Promise.all([cargarColaboradores()]).then(function(){
      cargarFirestore().then(function(fs){
        fs.getDocs(fs.collection(window.db,'presupuestos')).then(function(snap){
          _presupuestosCache = {};
          snap.docs.forEach(function(d){ _presupuestosCache[d.id] = d.data(); });
          renderPresupuestos();
        });
        fs.getDocs(fs.query(fs.collection(window.db,'presupuestos_historial'), fs.orderBy('fecha','desc'), fs.limit(20))).then(function(snap){
          renderHistorialPresupuesto(snap.docs.map(function(d){ return d.data(); }));
        }).catch(function(){ renderHistorialPresupuesto([]); });
      });
    });
  }

  function _cpGastadoPorDepto(){
    var ahora = new Date();
    var gastado = {};
    docs.forEach(function(d){
      if(d.estatus!=='orden_generada' && d.estatus!=='recibida') return;
      var f = _cpFechaDoc(d);
      if(!f || f.getMonth()!==ahora.getMonth() || f.getFullYear()!==ahora.getFullYear()) return;
      var depto = deptoSolicitante(d);
      if(!depto) return;
      var monto = d.cotizacionGanadora && d.cotizacionGanadora.monto!=null ? Number(d.cotizacionGanadora.monto) : 0;
      gastado[depto] = (gastado[depto]||0) + monto;
    });
    return gastado;
  }

  function renderPresupuestos(){
    var el = document.getElementById('cp-presup-lista'); if(!el) return;
    var gastado = _cpGastadoPorDepto();
    el.innerHTML = DEPTOS_CP.map(function(depto){
      var asignado = (_presupuestosCache[depto]&&_presupuestosCache[depto].montoMensual) || 0;
      var g = gastado[depto] || 0;
      var pct = asignado>0 ? Math.min(100, Math.round(g/asignado*100)) : 0;
      var color = pct>=100?'#E23B2E':pct>=75?'#B45309':'#12A150';
      return '<div style="background:#F8FAFC;border-radius:12px;padding:14px 16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">' +
        '<span style="font-size:13px;font-weight:700;color:#0A1628">'+esc(depto)+'</span>' +
        '<span style="font-size:12px;color:#5C7089">$'+g.toLocaleString('es-MX')+' de $'+asignado.toLocaleString('es-MX')+(asignado?' ('+pct+'%)':' — sin asignar')+'</span>' +
        '</div>' +
        '<div style="background:#E2E8F0;border-radius:6px;height:7px;overflow:hidden"><div style="width:'+pct+'%;height:100%;background:'+color+'"></div></div>' +
        '</div>';
    }).join('');
  }

  function renderHistorialPresupuesto(filas){
    var el = document.getElementById('cp-presup-historial'); if(!el) return;
    el.innerHTML = filas.length ? filas.map(function(h){
      var fecha = h.fecha ? new Date(h.fecha).toLocaleString('es-MX') : '—';
      return '<div style="padding:10px 16px;border-bottom:1px solid #EEF2F7;font-size:12px">' +
        '<span style="font-weight:700;color:#0A1628">'+esc(h.departamento)+'</span> — '+
        '$'+Number(h.montoAnterior||0).toLocaleString('es-MX')+' → <b>$'+Number(h.montoNuevo||0).toLocaleString('es-MX')+'</b>' +
        '<div style="color:#94A3B8;font-size:11px;margin-top:2px">'+esc(nombrePorCorreo(h.autorEmail)||h.autor||'—')+' · '+fecha+'</div></div>';
    }).join('') : '<p style="font-size:12px;color:#94a3b8;padding:14px 16px;margin:0">Sin cambios registrados todavía.</p>';
  }

  window.__cpAbrirEditarPresupuesto = function(){
    var ov = document.createElement('div');
    ov.id = 'cp-presup-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:18px';
    ov.innerHTML =
      '<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;max-height:88vh;overflow-y:auto;padding:22px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h3 style="margin:0;font-size:16px">Editar presupuestos</h3><button onclick="document.getElementById(\'cp-presup-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' +
        DEPTOS_CP.map(function(depto){
          var actual = (_presupuestosCache[depto]&&_presupuestosCache[depto].montoMensual) || '';
          return '<div style="display:flex;align-items:center;gap:8px"><span style="flex:1;font-size:12.5px;color:#0A1628">'+esc(depto)+'</span>' +
            '<input type="number" class="cp-presup-input" data-depto="'+esc(depto)+'" value="'+actual+'" placeholder="$0" style="width:120px;padding:7px 9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px"></div>';
        }).join('') +
        '</div>' +
        '<button onclick="window.__cpGuardarPresupuestos()" style="width:100%;padding:11px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Guardar cambios</button>' +
        '<div id="cp-presup-msg" style="font-size:11.5px;margin-top:8px;text-align:center"></div>' +
      '</div>';
    document.body.appendChild(ov);
  };

  window.__cpGuardarPresupuestos = function(){
    var msgEl = document.getElementById('cp-presup-msg');
    msgEl.textContent = 'Guardando…';
    var autorEmail = window.auth && window.auth.currentUser ? window.auth.currentUser.email : '';
    var autor = nombrePorCorreo(autorEmail) || autorEmail;
    var inputs = Array.prototype.slice.call(document.querySelectorAll('.cp-presup-input'));
    cargarFirestore().then(function(fs){
      var tareas = [];
      inputs.forEach(function(inp){
        var depto = inp.dataset.depto;
        var nuevo = Number(inp.value)||0;
        var anterior = (_presupuestosCache[depto]&&_presupuestosCache[depto].montoMensual) || 0;
        if(nuevo===anterior) return; // sin cambio, no genera historial de ruido
        tareas.push(
          fs.setDoc(fs.doc(window.db,'presupuestos',depto), {
            departamento:depto, montoMensual:nuevo, actualizadoPor:autor, actualizadoEmail:autorEmail, actualizadoEn:new Date().toISOString(),
          }, {merge:true}).then(function(){
            return fs.addDoc(fs.collection(window.db,'presupuestos_historial'), {
              departamento:depto, montoAnterior:anterior, montoNuevo:nuevo,
              autor:autor, autorEmail:autorEmail, fecha:new Date().toISOString(),
            });
          })
        );
      });
      if(!tareas.length){ msgEl.textContent = 'Sin cambios que guardar.'; return; }
      Promise.all(tareas).then(function(){
        msgEl.textContent = '✓ Guardado'; msgEl.style.color = '#15803d';
        setTimeout(function(){ document.getElementById('cp-presup-overlay')?.remove(); cargarPresupuestos(); }, 800);
      }).catch(function(e){ msgEl.textContent = 'Error: '+(e.message||e); msgEl.style.color='#b91c1c'; });
    });
  };

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

  // ══════════════════════════════════════════════════════════════════
  //  FASE 1 — Tablero que muestra TODO lo abierto (sin filtro de mes),
  //  antigüedad visible, contadores = lo que se ve, buscador/filtros y
  //  vista de lista. El filtro por mes solo aplica a lo ya terminado
  //  (recibidas / rechazadas).
  // ══════════════════════════════════════════════════════════════════
  var DIAS_AMARILLO = 3;   // a partir de aquí: "esperando de más"
  var DIAS_ROJO     = 7;   // a partir de aquí: "atrasada"
  var _hoy0 = new Date();
  var _cpF = {texto:'', empresa:'', solicitante:'', prioridad:'', desde:'', hasta:'', kpi:'',
              mes: _hoy0.getFullYear()+'-'+String(_hoy0.getMonth()+1).padStart(2,'0'), vista:'tablero'};

  // Columnas del tablero en lenguaje sencillo. 'autorizada' (casi no se usa:
  // al aprobar el último paso se pasa directo a 'cotizando') vive junto con
  // 'cotizando' para no tener una columna siempre vacía.
  var COLS_CP = [
    {id:'aprobacion', titulo:'Esperando aprobación', ayuda:'Su jefe o Compras deben dar el visto bueno', color:'#B45309', estatus:['pendiente']},
    {id:'precios',    titulo:'Buscando precios',     ayuda:'Compras está pidiendo cotizaciones',          color:'#1473E6', estatus:['autorizada','cotizando']},
    {id:'orden',      titulo:'Comprado, por llegar', ayuda:'Ya hay orden de compra; falta que llegue',    color:'#6D28D9', estatus:['orden_generada']},
    {id:'recibida',   titulo:'Recibido',             ayuda:'Ya llegó (del mes elegido)',                  color:'#12A150', estatus:['recibida']},
  ];
  var CERRADOS_CP = ['recibida','rechazada','cancelada'];

  function _cpIco(n){
    var a = 'width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    var P = {
      firma:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      engrane:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
      historial:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
      lupa:'<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
      tablero:'<rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/>',
      lista:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      reloj:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      alerta:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
      fuego:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.5 1.4 2.8 2.5 2.8Z"/>',
      persona:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      check:'<path d="M20 6 9 17l-5-5"/>',
      camion:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
      bajar:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    };
    return '<svg '+a+'>'+(P[n]||'')+'</svg>';
  }

  function _cpColDe(d){
    var st = d.estatus||'pendiente';
    return COLS_CP.find(function(c){ return c.estatus.indexOf(st)>-1; }) || COLS_CP[0];
  }
  function _cpPasoActivo(d){ return (d.flujoAutorizacion||[]).find(function(f){ return f.estatus==='pendiente'; }) || null; }
  // Desde cuándo espera: si está en aprobación, desde la última firma
  // registrada (o desde que se creó); en cualquier otro caso, desde que se creó.
  function _cpEsperaDesde(d){
    var base = _cpFechaDoc(d);
    if((d.estatus||'pendiente')==='pendiente'){
      (d.flujoAutorizacion||[]).forEach(function(f){
        if(f.estatus==='aprobado' && f.fecha){ var x=new Date(f.fecha); if(!isNaN(x) && (!base || x>base)) base=x; }
      });
    }
    return base;
  }
  function _cpDias(fecha){ if(!fecha) return 0; return Math.max(0, Math.floor((Date.now()-fecha.getTime())/86400000)); }
  function _cpTxtDias(n){ return n===1?'1 día':n+' días'; }
  function _cpFechaCierre(d){
    var f = d.recibidaEn || d.rechazadaEn || null;
    if(f){ var x = f.toDate ? f.toDate() : new Date(f); if(!isNaN(x)) return x; }
    return _cpFechaDoc(d);
  }
  function _cpEnMes(fecha){
    if(!fecha || !_cpF.mes) return !!fecha;
    var p = _cpF.mes.split('-');
    return fecha.getFullYear()===Number(p[0]) && (fecha.getMonth()+1)===Number(p[1]);
  }
  function _cpNombreCorto(n){ n=String(n||'').trim(); if(n.indexOf('@')>-1) return n.split('@')[0]; var w=n.split(/\s+/); return w.slice(0,2).join(' '); }
  function _cpTitulo(n){ return String(n||'').toLowerCase().replace(/(^|\s)\S/g,function(c){return c.toUpperCase();}); }

  // ¿En qué paso va? — en palabras sencillas, con a quién le toca.
  function _cpEstadoAmigable(d){
    var st = d.estatus||'pendiente';
    if(st==='pendiente'){
      var paso = _cpPasoActivo(d);
      if(!paso) return {txt:'Esperando aprobación', quien:'', falta:false};
      var dest = _cpDestinatariosPaso(d, paso);
      var quien = dest.map(function(p){ return _cpTitulo(_cpNombreCorto(p.nombre||p.correo)); }).join(', ');
      var txt = paso.label==='Jefe de área' ? 'Esperando que su jefe la apruebe' : paso.label==='Compras' ? 'Esperando visto bueno de Compras' : 'Esperando: '+paso.label;
      return {txt:txt, quien:quien, falta:!dest.length};
    }
    if(st==='autorizada' || st==='cotizando') return {txt:'Compras está buscando precios', quien:'', falta:false};
    if(st==='orden_generada'){ var pv = d.cotizacionGanadora&&d.cotizacionGanadora.proveedor; return {txt:'Comprado, falta que llegue'+(pv?' · '+pv:''), quien:'', falta:false}; }
    if(st==='recibida') return {txt:'Ya llegó', quien:'', falta:false};
    if(st==='rechazada') return {txt:'Rechazada'+(d.motivoRechazo?': '+d.motivoRechazo:''), quien:'', falta:false};
    return {txt:st, quien:'', falta:false};
  }
  function _cpQueSigue(d){
    var st = d.estatus||'pendiente';
    if(st==='pendiente'){ var p=_cpPasoActivo(d); return p&&p.label==='Jefe de área' ? 'Después la revisa Compras y empieza a buscar precios.' : 'Después Compras busca precios con proveedores.'; }
    if(st==='autorizada'||st==='cotizando') return 'Cuando se elija la mejor cotización se genera la orden de compra.';
    if(st==='orden_generada') return 'Cuando llegue, Compras la marca como recibida.';
    if(st==='recibida') return 'Proceso terminado.';
    return '';
  }

  // Chip de antigüedad — siempre con texto + ícono (nunca solo color).
  function _cpChipEspera(d){
    var st = d.estatus||'pendiente';
    if(st==='recibida' || st==='rechazada'){
      var fc = _cpFechaCierre(d);
      return '<span class="cp-chip" style="background:#F1F5F9;color:#5C7089">'+_cpIco('check')+(st==='recibida'?'Recibida':'Rechazada')+(fc?' el '+fc.toLocaleDateString('es-MX',{day:'numeric',month:'short'}):'')+'</span>';
    }
    var n = _cpDias(_cpEsperaDesde(d));
    var esperando = st==='pendiente';
    var txt = n===0 ? (esperando?'Esperando desde hoy':'Abierta hoy') : (esperando?'Lleva '+_cpTxtDias(n)+' esperando':'Abierta hace '+_cpTxtDias(n));
    if(n>=DIAS_ROJO)     return '<span class="cp-chip" style="background:#FCEBEB;color:#B91C1C">'+_cpIco('alerta')+txt+'</span>';
    if(n>=DIAS_AMARILLO) return '<span class="cp-chip" style="background:#FEF3C7;color:#92400E">'+_cpIco('reloj')+txt+'</span>';
    return '<span class="cp-chip" style="background:#F1F5F9;color:#5C7089">'+_cpIco('reloj')+txt+'</span>';
  }

  // ── Filtros ──
  function _cpHayFiltros(){ return !!(_cpF.texto||_cpF.empresa||_cpF.solicitante||_cpF.prioridad||_cpF.desde||_cpF.hasta); }
  function _cpPasaFiltros(d){
    if(_cpF.empresa && (d.empresa||'')!==_cpF.empresa) return false;
    if(_cpF.solicitante && (nombrePorCorreo(d.solicitante)||'')!==_cpF.solicitante) return false;
    if(_cpF.prioridad && (d.urgencia||'')!==_cpF.prioridad) return false;
    var f = _cpFechaDoc(d);
    if(_cpF.desde && f && f < new Date(_cpF.desde+'T00:00:00')) return false;
    if(_cpF.hasta && f && f > new Date(_cpF.hasta+'T23:59:59')) return false;
    if(_cpF.texto){
      var t = _cpNorm(_cpF.texto);
      var prov = (d.cotizacionGanadora&&d.cotizacionGanadora.proveedor)||'';
      var bolsa = _cpNorm([d.folio, d.ocFolio, nombrePorCorreo(d.solicitante), d.solicitante, d.empresa, d.ciudad, prov,
        (d.items||[]).map(function(i){ return (i.desc||'')+' '+(i.proveedor||''); }).join(' ')].join(' '));
      if(bolsa.indexOf(t)===-1) return false;
    }
    return true;
  }
  function _cpEsAtrasada(d){ return (d.estatus||'pendiente')==='pendiente' && _cpDias(_cpEsperaDesde(d))>=DIAS_ROJO; }
  function _cpPasaKpi(d){
    var k=_cpF.kpi; if(!k || k==='abiertas') return true;
    if(k==='atrasadas') return _cpEsAtrasada(d);
    return _cpColDe(d).id===k;
  }
  function _cpAbiertas(){ return docs.filter(function(d){ return CERRADOS_CP.indexOf(d.estatus||'pendiente')===-1; }); }

  window.__cpFiltro = function(k,v){ _cpF[k]=v; renderKPIs(); renderBoard(); };
  var _cpTimerTexto = null;
  window.__cpFiltroTexto = function(v){ clearTimeout(_cpTimerTexto); _cpTimerTexto=setTimeout(function(){ window.__cpFiltro('texto', v); },180); };
  window.__cpKpi = function(k){
    _cpF.kpi = (_cpF.kpi===k ? '' : k);
    if(verRechazadas){ window.__cpSetTab(false); }
    renderKPIs(); renderBoard();
  };
  window.__cpVista = function(v){ _cpF.vista=v; renderBoard(); };
  window.__cpLimpiarFiltros = function(){
    ['texto','empresa','solicitante','prioridad','desde','hasta'].forEach(function(k){ _cpF[k]=''; var el=document.getElementById('cp-f-'+k); if(el) el.value=''; });
    _cpF.kpi='';
    renderKPIs(); renderBoard();
  };

  window.__cpSetTab = function(rechazadas){
    verRechazadas = rechazadas;
    var a=document.getElementById('cp-tab-activas'), r=document.getElementById('cp-tab-rechazadas');
    a.style.background = rechazadas?'#F8FAFC':'#0A1628'; a.style.color = rechazadas?'#5C7089':'#fff';
    r.style.background = rechazadas?'#0A1628':'#F8FAFC'; r.style.color = rechazadas?'#fff':'#5C7089';
    renderBoard();
  };

  // Llena empresa / solicitante con lo que existe en los datos, sin perder
  // la selección actual (el listener se dispara en cada cambio).
  function _cpLlenarOpciones(){
    function llenar(id, valores, todos){
      var el=document.getElementById(id); if(!el) return;
      var actual = el.value;
      var lista = valores.filter(function(v,i,arr){ return v && arr.indexOf(v)===i; }).sort(function(x,y){ return x.localeCompare(y,'es'); });
      el.innerHTML = '<option value="">'+todos+'</option>' + lista.map(function(v){ return '<option value="'+esc(v)+'"'+(v===actual?' selected':'')+'>'+esc(v)+'</option>'; }).join('');
    }
    llenar('cp-f-empresa', docs.map(function(d){ return d.empresa||''; }), 'Todas las empresas');
    llenar('cp-f-solicitante', docs.map(function(d){ return nombrePorCorreo(d.solicitante)||''; }), 'Todas las personas');
    var m=document.getElementById('cp-f-mes'); if(m && !m.value) m.value=_cpF.mes;
  }

  // Aviso arriba: cuántas llevan mucho esperando y a quién le toca.
  function _cpRenderAlerta(){
    var el=document.getElementById('cp-alerta'); if(!el) return;
    var pend = _cpAbiertas().filter(function(d){ return (d.estatus||'pendiente')==='pendiente'; });
    var atras = pend.filter(_cpEsAtrasada);
    var sinQuien = pend.filter(function(d){ var p=_cpPasoActivo(d); return p && !_cpDestinatariosPaso(d,p).length; });
    var conteo = {};
    atras.forEach(function(d){
      var p=_cpPasoActivo(d); if(!p) return;
      _cpDestinatariosPaso(d,p).forEach(function(x){ var k=_cpTitulo(x.nombre||x.correo); conteo[k]=(conteo[k]||0)+1; });
    });
    var top = Object.keys(conteo).sort(function(a,b){ return conteo[b]-conteo[a]; })[0];
    var html='';
    if(atras.length){
      html += '<div role="status" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px 14px;margin-bottom:12px;color:#7F1D1D">' +
        '<span style="display:flex;color:#B91C1C">'+_cpIco('alerta')+'</span>' +
        '<div style="flex:1;min-width:220px;font-size:12.5px"><b>'+atras.length+' '+(atras.length===1?'requisición lleva':'requisiciones llevan')+' '+DIAS_ROJO+' días o más esperando aprobación.</b>' +
        (top?' La mayoría ('+conteo[top]+') espera a <b>'+esc(top)+'</b>.':'') + '</div>' +
        '<button class="cp-btn" onclick="window.__cpKpi(\'atrasadas\')">Ver solo esas</button>' +
        '<button class="cp-btn" onclick="window.__cpAbrirFirmasPendientes()">'+_cpIco('firma')+'Recordarles</button>' +
      '</div>';
    }
    if(sinQuien.length){
      html += '<div role="status" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px 14px;margin-bottom:12px;color:#78350F">' +
        '<span style="display:flex">'+_cpIco('persona')+'</span>' +
        '<div style="flex:1;min-width:220px;font-size:12.5px"><b>'+sinQuien.length+' '+(sinQuien.length===1?'requisición no tiene':'requisiciones no tienen')+' a nadie asignado para aprobarlas</b>, así que no pueden avanzar. Asigna al jefe de su departamento.</div>' +
        '<button class="cp-btn" onclick="window.__cpAbrirConfigFlujo()">'+_cpIco('engrane')+'Asignar ahora</button>' +
      '</div>';
    }
    el.innerHTML = html;
  }

  // Contadores = exactamente lo que se ve (respetan búsqueda y filtros);
  // al dar clic filtran el tablero.
  function renderKPIs(){
    var cont=document.getElementById('cp-kpis'); if(!cont) return;
    _cpLlenarOpciones();
    _cpRenderAlerta();
    var base = _cpAbiertas().filter(_cpPasaFiltros);
    var n = function(fn){ return base.filter(fn).length; };
    var K = [
      {id:'abiertas',   lbl:'Abiertas',                   val:base.length,                                         col:'#0A1628', ayuda:'Todo lo que aún no llega'},
      {id:'aprobacion', lbl:'Esperando aprobación',       val:n(function(d){ return _cpColDe(d).id==='aprobacion'; }), col:'#B45309', ayuda:'Falta el visto bueno'},
      {id:'atrasadas',  lbl:'Llevan '+DIAS_ROJO+'+ días esperando', val:n(_cpEsAtrasada),                         col:'#B91C1C', ayuda:'Necesitan atención'},
      {id:'precios',    lbl:'Buscando precios',           val:n(function(d){ return _cpColDe(d).id==='precios'; }),    col:'#1473E6', ayuda:'Cotizando con proveedores'},
      {id:'orden',      lbl:'Comprado, por llegar',       val:n(function(d){ return _cpColDe(d).id==='orden'; }),      col:'#6D28D9', ayuda:'Ya hay orden de compra'},
    ];
    cont.innerHTML = K.map(function(k){
      var on = _cpF.kpi===k.id || (!_cpF.kpi && k.id==='abiertas' && !verRechazadas);
      return '<button class="cp-kpi'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="window.__cpKpi(\''+k.id+'\')" title="Clic para ver solo estas">' +
        '<span style="display:block;font-size:11px;color:#5C7089;font-weight:600;margin-bottom:4px">'+esc(k.lbl)+'</span>' +
        '<span style="display:block;font-size:24px;font-weight:800;color:'+k.col+';line-height:1.1">'+k.val+'</span>' +
        '<span style="display:block;font-size:10.5px;color:#94A3B8;margin-top:3px">'+esc(k.ayuda)+'</span>' +
      '</button>';
    }).join('');
  }

  function _cpVacio(msg, conBoton){
    return '<div style="text-align:center;padding:26px 10px;color:#94A3B8">' +
      '<p style="font-size:12.5px;margin:0 0 '+(conBoton?'10px':'0')+';color:#64748B">'+msg+'</p>' +
      (conBoton?'<button class="cp-btn" onclick="window.__cpLimpiarFiltros()">Quitar filtros</button>':'') + '</div>';
  }

  function renderBoard(){
    var board=document.getElementById('cp-board'); if(!board) return;
    // Botones de vista
    var vt=document.getElementById('cp-v-tablero'), vl=document.getElementById('cp-v-lista');
    if(vt&&vl){
      vt.style.background = _cpF.vista==='tablero'?'#fff':'transparent'; vt.style.color = _cpF.vista==='tablero'?'#0A1628':'#5C7089'; vt.style.boxShadow=_cpF.vista==='tablero'?'0 1px 3px rgba(10,22,40,.12)':'none';
      vl.style.background = _cpF.vista==='lista'?'#fff':'transparent';   vl.style.color = _cpF.vista==='lista'?'#0A1628':'#5C7089';   vl.style.boxShadow=_cpF.vista==='lista'?'0 1px 3px rgba(10,22,40,.12)':'none';
    }
    var filtrando = _cpHayFiltros() || (_cpF.kpi && _cpF.kpi!=='abiertas');

    // ── Rechazadas (por mes) ──
    if(verRechazadas){
      var rech = docs.filter(function(d){ return d.estatus==='rechazada' && _cpEnMes(_cpFechaCierre(d)) && _cpPasaFiltros(d); });
      _cpBarraFiltro(rech.length, filtrando);
      board.className=''; board.style.cssText='';
      board.innerHTML = rech.length
        ? (_cpF.vista==='lista' ? _cpTablaHTML(rech) : '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">'+rech.map(cardHTML).join('')+'</div>')
        : _cpVacio('No hay requisiciones rechazadas en el mes elegido.', _cpHayFiltros());
      return;
    }

    var abiertas = _cpAbiertas().filter(_cpPasaFiltros).filter(_cpPasaKpi);
    var mostrarRecibidas = !_cpF.kpi || _cpF.kpi==='abiertas';
    var recibidas = mostrarRecibidas ? docs.filter(function(d){ return d.estatus==='recibida' && _cpEnMes(_cpFechaCierre(d)) && _cpPasaFiltros(d); }) : [];
    _cpBarraFiltro(abiertas.length, filtrando);

    // Lo que lleva más tiempo esperando va primero.
    var porEspera = function(a,b){ var fa=_cpEsperaDesde(a), fb=_cpEsperaDesde(b); return (fa?fa.getTime():0)-(fb?fb.getTime():0); };

    if(_cpF.vista==='lista'){
      board.className=''; board.style.cssText='';
      var filas = abiertas.slice().sort(porEspera).concat(recibidas.slice().sort(function(a,b){ return _cpFechaCierre(b)-_cpFechaCierre(a); }));
      board.innerHTML = filas.length ? _cpTablaHTML(filas) : _cpVacio(filtrando?'Ninguna requisición coincide con lo que buscas.':'No hay requisiciones abiertas. ¡Todo al día!', filtrando);
      return;
    }

    board.className='cp-board'; board.style.cssText='';
    var VACIOS = {
      aprobacion:'Nada esperando aprobación. ¡Todo al día!',
      precios:'Nadie está buscando precios ahora.',
      orden:'No hay compras en camino.',
      recibida: mostrarRecibidas ? 'Aún no llega nada en el mes elegido.' : 'Quita el filtro de arriba para ver lo recibido.',
    };
    board.innerHTML = COLS_CP.map(function(col){
      var ds = col.id==='recibida'
        ? recibidas.slice().sort(function(a,b){ return _cpFechaCierre(b)-_cpFechaCierre(a); })
        : abiertas.filter(function(d){ return _cpColDe(d).id===col.id; }).sort(porEspera);
      return '<section aria-label="'+esc(col.titulo)+'" style="min-width:0">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding:0 2px">' +
          '<p style="font-size:12px;font-weight:800;color:#0A1628;margin:0;display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:'+col.color+';display:inline-block"></span>'+esc(col.titulo)+'</p>' +
          '<span style="background:#F1F5F9;color:#475569;font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px">'+ds.length+'</span></div>' +
        '<p style="font-size:10.5px;color:#94A3B8;margin:0 2px 8px">'+esc(col.ayuda)+'</p>' +
        '<div class="cp-col">' + (ds.length ? ds.map(cardHTML).join('') : _cpVacio(filtrando&&col.id!=='recibida'?'Ninguna coincide con tu búsqueda.':VACIOS[col.id], false)) + '</div>' +
      '</section>';
    }).join('');
  }

  function _cpBarraFiltro(n, filtrando){
    var el=document.getElementById('cp-filtro-activo'); if(!el) return;
    if(!filtrando){ el.innerHTML=''; return; }
    var nombresKpi = {aprobacion:'Esperando aprobación', atrasadas:'Llevan '+DIAS_ROJO+'+ días esperando', precios:'Buscando precios', orden:'Comprado, por llegar'};
    el.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#EFF6FF;border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#1E3A8A">' +
      '<span>Mostrando <b>'+n+'</b> '+(n===1?'requisición':'requisiciones')+(_cpF.kpi&&nombresKpi[_cpF.kpi]?' · <b>'+esc(nombresKpi[_cpF.kpi])+'</b>':'')+(_cpHayFiltros()?' · con filtros':'')+'</span>' +
      '<button class="cp-btn" style="padding:5px 10px;font-size:11.5px" onclick="window.__cpLimpiarFiltros()">Quitar filtros</button></div>';
  }

  function _cpTablaHTML(lista){
    return '<div style="overflow-x:auto;border:1px solid #EEF2F7;border-radius:12px"><table class="cp-tabla"><thead><tr>' +
      '<th>Folio</th><th>Pedida</th><th>Quién pidió</th><th>Empresa</th><th>¿En qué paso va?</th><th>Tiempo</th><th>Prioridad</th><th>Monto</th><th></th></tr></thead><tbody>' +
      lista.map(function(d){
        var f=_cpFechaDoc(d), e=_cpEstadoAmigable(d), col=_cpColDe(d);
        var monto = d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null ? '$'+Number(d.cotizacionGanadora.monto).toLocaleString('es-MX') : '—';
        return '<tr class="cp-fila" tabindex="0" onclick="window.__cpAbrirDetalle(\''+d.id+'\')" onkeydown="if(event.key===\'Enter\')window.__cpAbrirDetalle(\''+d.id+'\')">' +
          '<td style="font-weight:800;color:#0A1628;white-space:nowrap"><span style="display:inline-block;width:4px;height:14px;border-radius:2px;background:'+(d.estatus==='rechazada'?'#E23B2E':col.color)+';vertical-align:middle;margin-right:7px"></span>'+esc(d.folio||d.id)+'</td>' +
          '<td style="white-space:nowrap">'+(f?f.toLocaleDateString('es-MX'):'—')+'</td>' +
          '<td>'+esc(_cpTitulo(nombrePorCorreo(d.solicitante)||'—'))+'</td>' +
          '<td>'+esc(d.empresa||'—')+'</td>' +
          '<td>'+esc(e.txt)+(e.quien?'<div style="font-size:11px;color:#5C7089">Le toca a: <b>'+esc(e.quien)+'</b></div>':'')+(e.falta?'<div style="font-size:11px;color:#B45309;font-weight:700">Nadie asignado para aprobar</div>':'')+'</td>' +
          '<td>'+_cpChipEspera(d)+'</td>' +
          '<td>'+(d.urgencia==='alta'?'<span class="cp-chip" style="background:#FCEBEB;color:#B91C1C">'+_cpIco('fuego')+'Urgente</span>':esc(d.urgencia?_cpTitulo(d.urgencia):'—'))+'</td>' +
          '<td style="white-space:nowrap;font-weight:700;color:'+(monto==='—'?'#94A3B8':'#12A150')+'">'+monto+'</td>' +
          '<td><span style="color:#1473E6;font-weight:700;font-size:12px">Ver</span></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function cardHTML(d){
    var col = _cpColDe(d);
    var color = d.estatus==='rechazada' ? '#E23B2E' : col.color;
    var e = _cpEstadoAmigable(d);
    var items = d.items||[];
    var resumen = items.length ? (items[0].desc||'') + (items.length>1?' (+'+(items.length-1)+' más)':'') : '';
    var monto = d.cotizacionGanadora&&d.cotizacionGanadora.monto!=null ? ('$'+Number(d.cotizacionGanadora.monto).toLocaleString('es-MX')) : null;
    return '<div class="cp-card" style="--c:'+color+'" role="button" tabindex="0" aria-label="Abrir '+esc(d.folio||d.id)+'" onclick="window.__cpAbrirDetalle(\''+d.id+'\')" onkeydown="if(event.key===\'Enter\')window.__cpAbrirDetalle(\''+d.id+'\')">' +
      '<div style="display:flex;align-items:center;gap:6px">' +
        '<span style="font-size:12.5px;font-weight:800;color:#0A1628">'+esc(d.folio||d.id)+'</span>' +
        (d.urgencia==='alta'?'<span class="cp-chip" style="background:#FCEBEB;color:#B91C1C" title="Marcada como urgente por quien la pidió">'+_cpIco('fuego')+'Urgente</span>':'') +
        '<span style="flex:1"></span>' +
        '<button title="Descargar requisición en PDF" aria-label="Descargar PDF" onclick="event.stopPropagation();window.__cpDescargarRequisicion(\''+d.id+'\')" style="flex-shrink:0;width:26px;height:26px;border:1px solid #E2E8F0;background:#fff;color:#1D2E73;border-radius:7px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">'+_cpIco('bajar')+'</button>' +
      '</div>' +
      '<p style="font-size:11.5px;color:#334155;margin:4px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(_cpTitulo(nombrePorCorreo(d.solicitante)||'—'))+(d.empresa?' · <span style="color:#94A3B8">'+esc(d.empresa)+'</span>':'')+'</p>' +
      (resumen?'<p style="font-size:11px;color:#64748B;margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(resumen)+'">'+esc(resumen)+'</p>':'') +
      '<p style="font-size:11px;color:#0A1628;margin:7px 0 0;font-weight:600">'+esc(e.txt)+'</p>' +
      (e.quien?'<p style="font-size:10.5px;color:#5C7089;margin:1px 0 0;display:flex;align-items:center;gap:4px">'+_cpIco('persona')+'Le toca a: <b>'+esc(e.quien)+'</b></p>':'') +
      (e.falta?'<p style="font-size:10.5px;color:#B45309;margin:1px 0 0;font-weight:700">Nadie asignado para aprobar</p>':'') +
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:8px;flex-wrap:wrap">'+_cpChipEspera(d)+(monto?'<span style="font-size:11.5px;font-weight:800;color:#12A150">'+monto+'</span>':'')+'</div>' +
    '</div>';
  }

  // ── Ayuda "¿Cómo funciona?" ──
  window.__cpAyuda = function(){
    var ov=document.createElement('div'); ov.id='cp-ayuda-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:18px';
    ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
    var pasos = [
      ['#B45309','Esperando aprobación','Alguien pidió algo. Su jefe (y luego Compras) deben decir que sí.'],
      ['#1473E6','Buscando precios','Compras pregunta a proveedores cuánto cuesta y elige la mejor opción.'],
      ['#6D28D9','Comprado, por llegar','Ya se hizo la orden de compra. Ahora solo falta que llegue.'],
      ['#12A150','Recibido','Ya llegó. ¡Listo!'],
    ];
    ov.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Cómo funciona Compras" style="background:#fff;border-radius:14px;max-width:520px;width:100%;padding:22px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0;font-size:16px;color:#0A1628">¿Cómo funciona?</h3><button aria-label="Cerrar" onclick="document.getElementById(\'cp-ayuda-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
      '<p style="font-size:12.5px;color:#5C7089;margin:0 0 14px">Cada pedido pasa por estos 4 pasos, de izquierda a derecha:</p>' +
      pasos.map(function(p,i){ return '<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px"><span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:'+p[0]+';color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center">'+(i+1)+'</span><div><p style="margin:0;font-size:13px;font-weight:700;color:#0A1628">'+p[1]+'</p><p style="margin:2px 0 0;font-size:12px;color:#5C7089">'+p[2]+'</p></div></div>'; }).join('') +
      '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;font-size:12px;color:#334155;margin-top:6px">' +
        '<b>Colores del tiempo:</b> gris = va bien · <span style="color:#92400E;font-weight:700">amarillo</span> = lleva '+DIAS_AMARILLO+' días o más · <span style="color:#B91C1C;font-weight:700">rojo</span> = lleva '+DIAS_ROJO+' días o más y necesita atención.<br>' +
        '<b>Tip:</b> da clic en cualquiera de los números de arriba para ver solo esas requisiciones.</div>' +
    '</div>';
    document.body.appendChild(ov);
  };

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
    html += '<div style="display:flex;gap:8px;align-items:center;flex-shrink:0">' +
      '<button onclick="window.__cpDescargarRequisicion(\''+d.id+'\')" style="display:flex;align-items:center;gap:6px;padding:0 12px;height:30px;background:#1D2E73;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar PDF</button>' +
      '<button onclick="window.__cpCerrarDetalle()" style="background:#F1F5F9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">✕</button></div></div>';

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
    (function(){ var e=_cpEstadoAmigable(d), sig=_cpQueSigue(d);
      html += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12.5px;color:#0A1628">' +
        '<span><b>Ahora:</b> '+esc(e.txt)+(e.quien?' — le toca a <b>'+esc(e.quien)+'</b>':'')+'</span>' + _cpChipEspera(d) +
        (sig?'<span style="color:#5C7089"><b>Sigue:</b> '+esc(sig)+'</span>':'') + '</div>';
    })();
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
          var depto2 = deptoSolicitante(d);
          var jefe2 = depto2 && cfg2.jefesPorDepto ? cfg2.jefesPorDepto[depto2] : null;
          quien = jefe2 ? jefe2.nombre : (depto2 ? 'sin jefe de área asignado para '+depto2 : 'departamento del solicitante desconocido — revisa que la ficha de '+(correoSolicitante(d)||nombrePorCorreo(d.solicitante)||'el solicitante')+' en colaboradores tenga departamento');
        } else if(pasoActivo.label==='Compras'){
          quien = (cfg2.aprobadoresCompras||[]).map(function(a){return a.nombre||a.correo;}).join(', ') || 'sin aprobadores de Compras configurados';
        }
        htmlIzq += '<div style="background:#FFF7ED;border-radius:9px;padding:10px 12px;font-size:12px;color:#7C2D12">Este paso ("'+esc(pasoActivo.label)+'") solo lo puede autorizar: <b>'+esc(quien)+'</b>. Configúralo en "Configurar flujo" si falta.</div>';
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
      var depto = deptoSolicitante(d);
      var jefe = depto && cfg.jefesPorDepto ? cfg.jefesPorDepto[depto] : null;
      if(jefe && jefe.correo) out.push(jefe);
    } else if(paso.label==='Compras'){
      (cfg.aprobadoresCompras||[]).forEach(function(a){ if(a.correo) out.push(a); });
    }
    return out;
  }
  function _cpNotificarPaso(fs, d, paso){
    _cpDestinatariosPaso(d, paso).forEach(function(persona){
      window.tcNotificar2(fs, window.db, {
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
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {estatus:'rechazada', motivoRechazo:motivo, rechazadaEn:new Date().toISOString()}).then(function(){
        if(d.solicitanteEmail){
          window.tcNotificar2(fs, window.db, {
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
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {estatus:'recibida', recibidaEn:new Date().toISOString()}).then(function(){
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

  // ── REQUISICIÓN EN PDF (cualquier etapa) ─────────────────────────
  // Documento distinto de la OC: mismo generador/paginación, pero con
  // título, folio y nombre de archivo de requisición.
  window.__cpDescargarRequisicion = function(id){
    var d = docs.find(function(x){ return x.id===id; });
    if(!d) return;
    if(!window.jspdf){ alert('No se cargó la librería de PDF. Recarga la página.'); return; }
    toast('Generando PDF de '+(d.folio||'requisición')+'…');
    Promise.all([cargarFotos(id), cargarColaboradores(), cargarLogoEmpresa(d.empresa)]).then(function(res){
      var fotos = res[0], logo = res[2];
      return _cpPrecargarDimensiones(fotos).then(function(fotoDim){
        _cpConstruirYDescargarOC(d, fotos, fotoDim, logo, 'requisicion');
      });
    }).catch(function(e){ console.error('[compras] error al generar requisición:', e); alert('No se pudo generar el PDF: '+(e.message||e)); });
  };

  function _cpConstruirYDescargarOC(d, fotos, fotoDim, logo, modo){
    var esReq = modo==='requisicion';
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
    docu.text(esReq ? 'Requisición de compra' : 'Orden de compra', xTexto, 15);
    docu.setFont('helvetica','normal'); docu.setFontSize(8);
    var fSol = _cpFechaDoc(d);
    docu.text(esReq
      ? (d.empresa||'TECNOCONTROL')+(fSol?' · Solicitada '+fSol.toLocaleDateString('es-MX'):'')+(d.origen?' · '+d.origen:'')
      : (d.empresa||'TECNOCONTROL')+' · Requisición '+(d.folio||''), xTexto, 20.5);
    docu.text(String(esReq ? (d.folio||d.id) : (d.ocFolio||'OC')), PW-MR, 15, {align:'right'});
    docu.text((esReq?'Impreso ':'')+new Date().toLocaleDateString('es-MX'), PW-MR, 20.5, {align:'right'});

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
    if(esReq && d.ocFolio){ campoAncho('Folio OC', d.ocFolio); y += 2; }

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
      docu.text(String(d.empresa||'')+' · '+String(esReq ? (d.folio||d.id) : (d.ocFolio||d.folio||'')), ML, PH-4);
      docu.text('Página '+p+' de '+totalPaginas, PW-MR, PH-4, {align:'right'});
    }
    docu.save(esReq ? ('Requisicion_'+(d.folio||d.id)+'.pdf') : ((d.ocFolio||d.folio||'OC')+'.pdf'));
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
