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
    cargarColaboradores();
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
      '<p style="font-size:11.5px;color:#5C7089;margin:0">'+esc(nombrePorCorreo(d.solicitante)||'—')+' · '+esc(d.empresa||'—')+'</p></div>';
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
    html += '<p style="font-size:12px;color:#5C7089;margin:4px 0 0">'+esc(nombrePorCorreo(d.solicitante)||'—')+' · '+esc(d.origen||'—')+'</p></div>';
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

    // ── Comentarios ──
    var comentarios = d.comentarios || [];
    html += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Comentarios</p>';
    html += '<div id="cp-comentarios-list" style="margin-bottom:8px">' + (comentarios.length ? comentarios.map(function(c){
      return '<div style="background:#F8FAFD;border-radius:8px;padding:8px 10px;margin-bottom:6px">' +
        '<p style="font-size:10.5px;font-weight:700;color:#1473E6;margin:0 0 2px">'+esc(nombrePorCorreo(c.autorEmail||c.autor)||'—')+' <span style="font-weight:400;color:#B7C0CC">'+esc((c.fecha||'').slice(0,10))+'</span></p>' +
        '<p style="font-size:12.5px;color:#0A1628;margin:0">'+esc(c.texto)+'</p></div>';
    }).join('') : '<p style="font-size:11.5px;color:#94a3b8;margin:0">Sin comentarios todavía.</p>') + '</div>';
    html += '<div style="display:flex;gap:6px;margin-bottom:16px">' +
      '<input id="cp-comentario-txt" placeholder="Agregar un comentario…" style="flex:1;padding:8px;border:1px solid #E2E8F0;border-radius:8px;font-size:12px">' +
      '<button onclick="window.__cpAgregarComentario(\''+d.id+'\')" style="padding:8px 14px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Agregar</button></div>';

    // ── Fotos (subidas por el técnico y/o por Compras) ──
    html += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px">Fotos de referencia</p>';
    html += '<div id="cp-fotos-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px"><p style="font-size:11px;color:#94a3b8;grid-column:1/-1">Cargando…</p></div>';
    html += '<label style="display:inline-block;padding:8px 14px;border:1.5px dashed #E2E8F0;border-radius:8px;background:#fff;color:#1473E6;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:16px">+ Agregar foto (Compras)<input id="cp-foto-file" type="file" accept="image/*" multiple onchange="window.__cpAgregarFoto(\''+d.id+'\',this)" style="display:none"></label>';

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
      html += '<button onclick="window.__cpAgregarCotizacion(\''+d.id+'\')" style="width:100%;padding:9px;border:1.5px dashed #E2E8F0;background:#fff;color:#1473E6;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px">+ Agregar cotización</button>';
      html += '<button onclick="window.__cpEnviarDirectoACompra(\''+d.id+'\')" style="width:100%;padding:10px;background:#12A150;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;margin-bottom:12px">✓ Enviar directo a compra (genera OC)</button>';
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
            fs.addDoc(fs.collection(window.db,'requisiciones_compra',id,'fotos'), {
              src:r.result, origen:'compras', autor:autor, autorEmail:autorEmail, creadoEn:new Date().toISOString()
            }).then(function(){ res(); }).catch(function(){ res(); });
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
            toast('Orden de compra generada — descargando…');
            // No esperamos el onSnapshot (llega async) — armamos el objeto ya
            // actualizado a mano para generar el PDF de inmediato.
            var dActualizado = Object.assign({}, d, {estatus:'orden_generada', cotizacionGanadora:cotizacionGanadora, ocFolio:ocFolio});
            Promise.all([cargarFotos(id), cargarColaboradores(), cargarLogoEmpresa(dActualizado.empresa)]).then(function(res2){
              var fotos=res2[0], logo=res2[2];
              return _cpPrecargarDimensiones(fotos).then(function(fotoDim){
                _cpConstruirYDescargarOC(dActualizado, fotos, fotoDim, logo);
              });
            });
          });
        });
      });
    });
  };
  window.__cpMarcarRecibida = function(id){
    cargarFirestore().then(function(fs){
      fs.updateDoc(fs.doc(window.db,'requisiciones_compra',id), {estatus:'recibida'}).then(function(){ toast('Marcada como recibida'); });
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
    if(logo){ try{ docu.addImage(logo,ML,6,32,14,undefined,'FAST'); xTexto = ML+36; }catch(e){} }
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
    var nCliente = campo(ML,'Cliente / proyecto', d.cliente);
    var nMotivo = campo(xMid,'Motivo', d.motivo);
    y += Math.max(nCliente,nMotivo)*5 + 9;
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
