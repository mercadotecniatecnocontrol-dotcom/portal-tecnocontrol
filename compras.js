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

  function toast(msg){
    if(window.mostrarPush){ window.mostrarPush('Compras', msg, '🛒'); return; }
    var t=document.createElement('div');
    t.textContent=msg;
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0A1628;color:#fff;padding:10px 18px;border-radius:9px;font-size:13px;z-index:3000';
    document.body.appendChild(t);
    setTimeout(function(){ t.remove(); },3000);
  }

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
      '<div style="max-width:1180px;margin:0 auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">' +
          '<h2 style="font-size:17px;font-weight:700;margin:0;color:#0A1628">Requisiciones de compra</h2>' +
          '<button onclick="window.__cpExportarAspel()" style="padding:7px 14px;border-radius:9px;border:1px solid #E2E8F0;background:#fff;color:#0A1628;font-size:12px;font-weight:700;cursor:pointer">Exportar JSON (Aspel)</button>' +
        '</div>' +
        '<div id="cp-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px"></div>' +
        '<div style="display:flex;gap:6px;margin-bottom:10px">' +
          '<button id="cp-tab-activas" onclick="window.__cpSetTab(false)" style="padding:7px 14px;border-radius:9px;border:1px solid #E23B2E;background:#E23B2E;color:#fff;font-size:12.5px;font-weight:600;cursor:pointer">Activas</button>' +
          '<button id="cp-tab-rechazadas" onclick="window.__cpSetTab(true)" style="padding:7px 14px;border-radius:9px;border:1px solid #E2E8F0;background:#fff;color:#5C7089;font-size:12.5px;font-weight:600;cursor:pointer">Rechazadas</button>' +
        '</div>' +
        '<div id="cp-board" style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px"></div>' +
      '</div>' +
      '<div id="cp-detalle-overlay" style="display:none;position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2000;align-items:center;justify-content:center;padding:24px">' +
        '<div id="cp-detalle-panel" style="background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:88vh;overflow-y:auto;padding:22px"></div>' +
      '</div>';
  }

  function escuchar(){
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
    a.style.background = rechazadas?'#fff':'#E23B2E'; a.style.color = rechazadas?'#5C7089':'#fff'; a.style.borderColor = rechazadas?'#E2E8F0':'#E23B2E';
    r.style.background = rechazadas?'#E23B2E':'#fff'; r.style.color = rechazadas?'#fff':'#5C7089'; r.style.borderColor = rechazadas?'#E23B2E':'#E2E8F0';
    renderBoard();
  };

  function renderKPIs(){
    var activas = docs.filter(function(d){ return d.estatus!=='rechazada' && d.estatus!=='recibida'; });
    var urgentes = activas.filter(function(d){ return d.urgencia==='alta'; }).length;
    var pendientes = docs.filter(function(d){ return (d.estatus||'pendiente')==='pendiente'; }).length;
    var cotizando = docs.filter(function(d){ return d.estatus==='cotizando'; }).length;
    var el=document.getElementById('cp-kpis'); if(!el) return;
    function kpi(label,val,color){
      return '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px">' +
        '<p style="font-size:11px;color:#5C7089;margin:0 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.3px">'+label+'</p>' +
        '<p style="font-size:24px;font-weight:700;margin:0;color:'+(color||'#0A1628')+'">'+val+'</p></div>';
    }
    el.innerHTML = kpi('En proceso',activas.length) + kpi('Urgentes',urgentes,'#E23B2E') + kpi('Por autorizar',pendientes,'#D99000') + kpi('Cotizando',cotizando,'#1473E6');
  }

  function renderBoard(){
    var board=document.getElementById('cp-board'); if(!board) return;
    var fuente = verRechazadas ? docs.filter(function(d){ return d.estatus==='rechazada'; }) : docs.filter(function(d){ return d.estatus!=='rechazada'; });
    if(verRechazadas){
      board.style.gridTemplateColumns='1fr';
      board.innerHTML = fuente.length ? fuente.map(cardHTML).join('') : '<div style="text-align:center;padding:30px;color:#94a3b8;font-size:13px">Sin requisiciones rechazadas.</div>';
      return;
    }
    board.style.gridTemplateColumns='repeat(5,1fr)';
    board.innerHTML = ESTADOS.map(function(col){
      var ds = fuente.filter(function(d){ return (d.estatus||'pendiente')===col.id; });
      return '<div style="background:#F8FAFD;border-radius:12px;padding:10px;min-height:110px">' +
        '<p style="font-size:10.5px;font-weight:700;color:#5C7089;margin:0 0 8px;text-transform:uppercase;letter-spacing:.2px">'+col.label+' · '+ds.length+'</p>' +
        (ds.length ? ds.map(cardHTML).join('') : '<p style="font-size:11px;color:#B7C0CC;margin:0">Vacío</p>') +
        '</div>';
    }).join('');
  }

  function cardHTML(d){
    var urgColor = d.urgencia==='alta'?'#E23B2E':d.urgencia==='media'?'#D99000':'#5C7089';
    var urgBg = d.urgencia==='alta'?'#FCEBEB':d.urgencia==='media'?'#FAEEDA':'#F1F5F9';
    return '<div onclick="window.__cpAbrirDetalle(\''+d.id+'\')" style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:10px;margin-bottom:8px;cursor:pointer">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<span style="font-size:12px;font-weight:700">'+esc(d.folio||d.id)+'</span>' +
      '<span style="background:'+urgBg+';color:'+urgColor+';font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:6px">'+esc((d.urgencia||'—').toUpperCase())+'</span></div>' +
      '<p style="font-size:11.5px;color:#5C7089;margin:0">'+esc(d.empresa||'—')+' · '+esc(d.motivo||'—')+'</p></div>';
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
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">';
    html += '<div><h2 style="font-size:18px;margin:0">'+esc(d.folio||d.id)+' · '+esc(d.empresa||'—')+'</h2>';
    html += '<p style="font-size:12px;color:#5C7089;margin:4px 0 0">'+esc(d.solicitante||'—')+' · '+esc(d.origen||'—')+'</p></div>';
    html += '<button onclick="window.__cpCerrarDetalle()" style="background:#F1F5F9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">✕</button></div>';

    html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
    html += '<span style="background:#F1F5F9;color:#0A1628;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px">'+esc((d.urgencia||'—').toUpperCase())+'</span>';
    html += '<span style="background:#F1F5F9;color:#0A1628;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px">'+esc((d.tipoCompra||'—').toUpperCase())+'</span>';
    var estLabel = (ESTADOS.find(function(e){ return e.id===(d.estatus||'pendiente'); })||{}).label || d.estatus || '—';
    html += '<span style="background:#F1F5F9;color:#0A1628;font-size:11px;font-weight:600;padding:4px 10px;border-radius:8px">'+esc(estLabel)+'</span></div>';
    html += '<p style="font-size:11.5px;color:#5C7089;margin:0 0 14px">'+esc(tipoInfo.entrada)+' · '+esc(tipoInfo.factura)+'</p>';

    html += '<table style="width:100%;font-size:12.5px;border-collapse:collapse;margin-bottom:14px">';
    html += '<tr style="color:#5C7089;text-align:left"><td style="padding:4px 0">Cant.</td><td>Descripción</td><td style="text-align:right">Proveedor</td></tr>';
    (d.items||[]).forEach(function(it){
      html += '<tr style="border-top:1px solid #E2E8F0"><td style="padding:6px 0">'+esc(it.cant)+' '+esc(it.unidad||'')+'</td><td>'+esc(it.desc)+'</td><td style="text-align:right">'+esc(it.proveedor||'—')+'</td></tr>';
    });
    html += '</table>';

    html += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Flujo de autorización</p><div style="display:flex;gap:6px;margin-bottom:16px">';
    flujo.forEach(function(f){
      var bg = f.estatus==='aprobado'?'#EAF3DE':(f===pasoActivo?'#FAEEDA':'#F1F5F9');
      var col = f.estatus==='aprobado'?'#3B6D11':(f===pasoActivo?'#633806':'#5C7089');
      html += '<div style="flex:1;text-align:center;padding:8px 4px;border-radius:9px;background:'+bg+'">' +
        '<p style="font-size:10.5px;font-weight:700;margin:0;color:'+col+'">'+esc(f.label)+'</p>' +
        '<p style="font-size:9.5px;margin:2px 0 0;color:#5C7089">'+(f.estatus==='aprobado'?'Aprobado':(f===pasoActivo?'Tu turno':'En espera'))+'</p></div>';
    });
    html += '</div>';

    if(d.firma) html += '<img src="'+d.firma+'" style="height:50px;border:1px solid #E2E8F0;border-radius:8px;margin-bottom:14px">';

    if(d.estatus==='rechazada'){
      html += '<div style="background:#FCEBEB;border-radius:9px;padding:10px 12px;font-size:12px;color:#791F1F;margin-bottom:12px"><b>Rechazada:</b> '+esc(d.motivoRechazo||'Sin motivo registrado')+'</div>';
    }

    if(pasoActivo && d.estatus!=='rechazada' && d.estatus!=='recibida'){
      html += '<div id="cp-rechazo-motivo" style="display:none;margin-bottom:10px"><textarea id="cp-motivo-txt" rows="2" placeholder="Motivo del rechazo" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;box-sizing:border-box"></textarea></div>';
      html += '<div style="display:flex;gap:8px">';
      html += '<button onclick="window.__cpAutorizar(\''+d.id+'\')" style="flex:1;padding:11px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer">Autorizar</button>';
      html += '<button onclick="document.getElementById(\'cp-rechazo-motivo\').style.display=\'block\';document.getElementById(\'cp-confirmar-rechazo\').style.display=\'block\'" style="flex:1;padding:11px;background:#fff;color:#E23B2E;border:1px solid #F0997B;border-radius:9px;font-weight:600;cursor:pointer">Rechazar</button></div>';
      html += '<button id="cp-confirmar-rechazo" onclick="window.__cpRechazar(\''+d.id+'\')" style="display:none;width:100%;margin-top:8px;padding:11px;background:#E23B2E;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer">Confirmar rechazo</button>';
    }

    if(d.estatus==='cotizando'){
      html += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:14px 0 8px">Cotizaciones</p><div id="cp-cotizaciones-list" style="margin-bottom:8px"></div>';
      html += '<div style="display:flex;gap:6px;margin-bottom:10px">';
      html += '<input id="cp-cot-proveedor" placeholder="Proveedor" style="flex:1;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">';
      html += '<input id="cp-cot-monto" placeholder="Monto" type="number" style="width:100px;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">';
      html += '<label style="padding:8px 12px;border:1px solid #E2E8F0;border-radius:8px;font-size:11.5px;cursor:pointer;background:#fff">Adjuntar<input id="cp-cot-file" type="file" accept="image/*,application/pdf" style="display:none"></label></div>';
      html += '<button onclick="window.__cpAgregarCotizacion(\''+d.id+'\')" style="width:100%;padding:9px;border:1.5px dashed #E2E8F0;background:#fff;color:#1473E6;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:12px">+ Agregar cotización</button>';
    }
    if(d.estatus==='orden_generada'){
      html += '<button onclick="window.__cpMarcarRecibida(\''+d.id+'\')" style="width:100%;margin-top:10px;padding:11px;background:#12A150;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer">Marcar como recibida</button>';
    }
    if(d.estatus==='orden_generada' || d.estatus==='recibida'){
      html += '<button onclick="window.__cpDescargarOC(\''+d.id+'\')" style="width:100%;margin-top:8px;padding:11px;background:#fff;color:#0A1628;border:1px solid #E2E8F0;border-radius:9px;font-weight:600;cursor:pointer">Descargar orden de compra (PDF)</button>';
    }

    p.innerHTML = html;
    ov.style.display='flex';
    if(d.estatus==='cotizando') cargarCotizaciones(d.id);
  };
  window.__cpCerrarDetalle = function(){
    document.getElementById('cp-detalle-overlay').style.display='none';
    detalleId=null;
  };

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
      // NOTA: si no era el último paso, el flujo avanza pero todavía no hay
      // en el portal un mapeo "rol de aprobador → persona" por departamento
      // para notificar exactamente a quién sigue — pendiente para una
      // siguiente entrega (pantalla de configuración de flujos).
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), update).then(function(){
        if(esUltimo) toast('Requisición autorizada — pasa a Cotizando');
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
  window.__cpElegirGanadora = function(id,cotId){
    cargarFirestore().then(function(fs){
      fs.getDoc(fs.doc(window.db,'requisiciones_compra',id,'cotizaciones',cotId)).then(function(snap){
        if(!snap.exists()) return;
        var c=snap.data();
        fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {
          estatus:'orden_generada',
          cotizacionGanadora:{proveedor:c.proveedor,monto:c.monto,cotizacionId:cotId},
          ocFolio:'OC-'+String(Date.now()).slice(-6),
        }).then(function(){ toast('Orden de compra generada'); });
      });
    });
  };
  window.__cpMarcarRecibida = function(id){
    cargarFirestore().then(function(fs){
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {estatus:'recibida'}).then(function(){ toast('Marcada como recibida'); });
    });
  };

  // ── ORDEN DE COMPRA EN PDF ──────────────────────────────────────
  window.__cpDescargarOC = function(id){
    var d = docs.find(function(x){ return x.id===id; });
    if(!d || !window.jspdf) return;
    var jsPDF = window.jspdf.jsPDF;
    var docu = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
    var PW=215.9, MR=14, ML=14;
    docu.setFillColor(10,22,40); docu.rect(0,0,PW,26,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(11);
    docu.text('Orden de compra', ML, 15);
    docu.setFont('helvetica','normal'); docu.setFontSize(8);
    docu.text((d.empresa||'TECNOCONTROL')+' · Requisición '+(d.folio||''), ML, 20.5);
    docu.text(String(d.ocFolio||'OC'), PW-MR, 15, {align:'right'});
    docu.text(new Date().toLocaleDateString('es-MX'), PW-MR, 20.5, {align:'right'});

    var y=42;
    docu.setTextColor(15,23,42); docu.setFont('helvetica','bold'); docu.setFontSize(10);
    docu.text('Proveedor ganador: '+((d.cotizacionGanadora&&d.cotizacionGanadora.proveedor)||'—'), ML, y); y+=6;
    docu.setFont('helvetica','normal');
    docu.text('Monto: $'+((d.cotizacionGanadora&&d.cotizacionGanadora.monto)||'—'), ML, y); y+=10;

    docu.setFillColor(10,22,40); docu.rect(ML,y-5,PW-ML-MR,8,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(8);
    docu.text('CANT.',ML+2,y); docu.text('DESCRIPCIÓN',ML+25,y); y+=8;
    docu.setTextColor(15,23,42); docu.setFont('helvetica','normal'); docu.setFontSize(9.5);
    (d.items||[]).forEach(function(it){
      var lns = docu.splitTextToSize(String(it.desc||'—'), PW-ML-MR-25);
      docu.text(String(it.cant||'—'),ML+2,y); docu.text(lns,ML+25,y);
      y += Math.max(6, lns.length*5+1.5);
    });
    docu.save((d.ocFolio||'OC')+'.pdf');
  };

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
