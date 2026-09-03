/* ============================================================================
 * mis-pedidos.js · "Mi perfil" — mis pedidos (Ventas y Material)
 * ----------------------------------------------------------------------------
 * Responsabilidad ÚNICA: mostrarle a CADA usuario, en su propio perfil dentro
 * del portal, el estado de los pedidos que ÉL mismo subió (como vendedor) o
 * solicitó (como solicitante de material) — incluida la firma de entrega y la
 * evidencia fotográfica, en modo SOLO LECTURA.
 *
 * No crea ni edita nada en `surtidos` — eso lo hacen almacen.js, almacen-pdf.js
 * y (más adelante) solicitud-material.html. Aquí solo se LEE y se avisa.
 *
 * Depende de globals del portal: window.db, window.auth, window.nombreUsuario.
 * Expone: window.renderMisPedidos()  ← se llama desde navegar('mis-pedidos')
 * ==========================================================================*/
(function () {
  'use strict';

  var DESTINO_TIPOS = {
    recoger_oficinas:   'Recoger en oficinas Tecnocontrol',
    cliente_recoge:     'Cliente viene por \u00e9l',
    vendedor_recoge:    'Vendedor recoge en almac\u00e9n',
    queda_almacen:      'Se queda en almac\u00e9n',
    paqueteria:         'Enviar por paqueter\u00eda',
    entrega_chihuahua:  'Entrega en Chihuahua (estaci\u00f3n)',
    traslado_almacenes: 'Traslado entre almacenes'
  };

  var contId = 'vista-mis-pedidos';
  var _fs = null, _unsubV = null, _unsubM = null, _unsubC = null, _cssOk = false;
  var _pedidosVendedor = [], _pedidosSolicitante = [], _pedidosCreador = [];
  var _evidCache = {};
  var _histCache = {};
  var expandido = {};

  function cargarFirestore(){
    if (_fs) return Promise.resolve(_fs);
    return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(function(m){ _fs=m; return m; });
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function toMs(v){
    if (v == null) return Date.now();
    if (typeof v === 'number') return v;
    if (typeof v === 'string'){ var t=Date.parse(v); return isNaN(t)?Date.now():t; }
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds*1000;
    return Date.now();
  }
  function yoNombre(){
    var email = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
    return (window.nombreUsuario ? window.nombreUsuario(email) : '') || email;
  }
  function contenedor(){ return document.getElementById(contId); }

  function inyectarCSS(){
    if (_cssOk) return; _cssOk = true;
    var css = ''
    + '.mp-wrap{--r:14px;}'
    + '.mp-aviso{display:flex;align-items:center;gap:10px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;padding:12px 16px;margin-bottom:18px;font-size:12.5px;color:#92400E;font-weight:600;}'
    + '.mp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;}'
    + '.mp-card{background:#fff;border:1px solid #e6ebf2;border-radius:var(--r);padding:14px 16px;box-shadow:0 1px 3px rgba(16,24,40,.04);}'
    + '.mp-card.atencion{border-color:#F59E0B;box-shadow:0 0 0 2px rgba(245,158,11,.18);}'
    + '.mp-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;}'
    + '.mp-folio{font-size:12.5px;font-weight:800;color:#0f172a;}'
    + '.mp-estado{font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#fff;border-radius:99px;padding:3px 9px;}'
    + '.mp-cli{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:4px;}'
    + '.mp-meta{font-size:11.5px;color:#64748b;margin-bottom:8px;}'
    + '.mp-tag{display:inline-block;margin-left:6px;font-size:10px;font-weight:800;text-transform:uppercase;color:#fff;border-radius:6px;padding:2px 7px;}'
    + '.mp-destino{font-size:11.5px;font-weight:700;color:#334155;background:#f1f5f9;border-radius:8px;padding:6px 10px;margin-bottom:8px;}'
    + '.mp-atencion-badge{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:#92400E;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:6px 10px;margin-bottom:8px;}'
    + '.mp-btn{border:none;background:#f1f5f9;color:#475569;border-radius:8px;font-size:11.5px;font-weight:800;padding:6px 12px;cursor:pointer;}'
    + '.mp-firma-mini img,.mp-evid-thumb{max-height:64px;border:1px solid #e6ebf2;border-radius:8px;background:#fff;margin-top:8px;margin-right:6px;cursor:zoom-in;}'
    + '.mp-empty{padding:40px;text-align:center;color:#94a3b8;font-size:13px;}'
    + '.mp-modal-ov{display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:99999;align-items:center;justify-content:center;padding:20px;}'
    + '.mp-modal-ov.show{display:flex;}'
    + '.mp-modal-box{background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:82vh;overflow:auto;padding:20px;}'
    + '.mp-modal-box img{max-width:100%;border-radius:10px;}'
    + '.mp-timeline{display:flex;flex-direction:column;margin:8px 0 4px;}'
    + '.mp-tl-step{display:flex;gap:10px;position:relative;padding-bottom:16px;}'
    + '.mp-tl-step:last-child{padding-bottom:0;}'
    + '.mp-tl-step:not(:last-child)::before{content:\'\';position:absolute;left:13px;top:27px;bottom:0;width:2px;background:#e6ebf2;}'
    + '.mp-tl-step.done:not(:last-child)::before{background:#94a3b8;}'
    + '.mp-tl-dot{flex-shrink:0;width:27px;height:27px;border-radius:50%;background:#f1f5f9;border:2px solid #e6ebf2;display:flex;align-items:center;justify-content:center;font-size:12.5px;z-index:1;}'
    + '.mp-tl-step.current .mp-tl-dot{animation:mpPulseDot 1.6s ease-in-out infinite;}'
    + '@keyframes mpPulseDot{0%,100%{box-shadow:0 0 0 0 rgba(20,115,226,.35);}50%{box-shadow:0 0 0 6px rgba(20,115,226,0);}}'
    + '.mp-tl-label{font-size:12.5px;font-weight:800;color:#0f172a;}'
    + '.mp-tl-step.pending .mp-tl-label{color:#94a3b8;}'
    + '.mp-tl-meta{font-size:10.5px;color:#94a3b8;font-weight:600;margin-top:1px;}'
    + '.mp-tl-meta.pend{font-style:italic;}'
    + '.mp-panel-box{background:#fff;border-radius:16px;max-width:760px;width:95%;max-height:88vh;overflow:auto;}'
    + '.mp-panel-head{position:sticky;top:0;background:#fff;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #e6ebf2;font-size:15px;font-weight:800;color:#0f172a;}'
    + '.mp-panel-head button{border:none;background:#f1f5f9;color:#475569;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1;}'
    + '.mp-panel-body{padding:18px 20px;}';
    var st=document.createElement('style'); st.id='mp-css'; st.textContent=css; document.head.appendChild(st);
  }

  function estadoColor(estado){
    return { esperando_autorizacion:'#8B4FD6', pendiente:'#1473E6', en_preparacion:'#12A150',
      listo:'#0FB5A6', entregado:'#7C8CA1', finalizado:'#334155', cancelado:'#E23B3B' }[estado] || '#7C8CA1';
  }
  function estadoLabel(estado){
    return { esperando_autorizacion:'Esperando autorizaci\u00f3n', pendiente:'Por surtir', en_preparacion:'En surtido',
      listo:'Listo', entregado:'Entregado', finalizado:'Finalizado', cancelado:'Cancelado' }[estado] || estado;
  }
  function destinoResumen(p){
    if (p.destinoTipo==='paqueteria') return [p.destinoPaqueteria,(p.destinoGuia?('gu\u00eda '+p.destinoGuia):'')].filter(Boolean).join(' \u00b7 ');
    if (p.destinoTipo==='entrega_chihuahua') return p.destinoDireccion||'';
    if (p.destinoTipo==='traslado_almacenes') return (p.destinoAlmacenOrigen||'\u2014')+' \u2192 '+(p.destinoAlmacenDestino||'\u2014');
    return '';
  }

  function cargarEvidencias(id){
    if (_evidCache[id]) return Promise.resolve(_evidCache[id]);
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'surtidos',id,'evidencias'));
    }).then(function(snap){
      var list=[]; snap.forEach(function(d){ list.push(Object.assign({id:d.id}, d.data())); });
      _evidCache[id]=list; return list;
    }).catch(function(){ _evidCache[id]=[]; return []; });
  }

  function cargarHistorial(id){
    if (_histCache[id]) return Promise.resolve(_histCache[id]);
    return cargarFirestore().then(function(fs){
      var col = fs.collection(window.db,'surtidos',id,'historial');
      var q; try{ q = fs.query(col, fs.orderBy('ts','asc')); }catch(e){ q = col; }
      return fs.getDocs(q);
    }).then(function(snap){
      var list=[];
      snap.forEach(function(d){
        var x = d.data() || {};
        list.push({ de:x.de||'', a:x.a||'', por:x.por||'', nota:x.nota||'', ts: toMs(x.ts) });
      });
      _histCache[id]=list; return list;
    }).catch(function(){ _histCache[id]=[]; return []; });
  }

  function fechaHora(ms){
    if (!ms) return '';
    var d = new Date(ms);
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'}) + ' \u00b7 ' + d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  }

  // ── Seguimiento del pedido, estilo "Uber Eats": una l\u00ednea de tiempo con lo que ya pas\u00f3 y lo que falta ──
  function renderSeguimiento(p){
    var hist = _histCache[p.id] || [];
    function buscar(aEstado){
      for (var i=hist.length-1;i>=0;i--){ if (hist[i].a===aEstado) return hist[i]; }
      return null;
    }
    var pasos = [
      { key:'pendiente',      label:'Pedido recibido',  icon:'\ud83d\udce5', color:'#1473E6' },
      { key:'en_preparacion', label:'En preparaci\u00f3n',   icon:'\ud83d\udce6', color:'#12A150' }
    ];
    if (p.estado==='parcial' || buscar('parcial')) pasos.push({ key:'parcial', label:'Entrega parcial', icon:'\u26a0\ufe0f', color:'#F26B21' });
    pasos.push({ key:'entregado', label:'Entregado', icon:'\u2705', color:'#0FB5A6' });

    var orden = ['pendiente','en_preparacion','parcial','entregado'];
    var idxActual = orden.indexOf(p.estado);

    var html = '<div class="mp-timeline">';
    pasos.forEach(function(paso){
      var ev = paso.key==='pendiente' ? { ts:p.createdAt, por:(p.vendedor||p.solicitante||'') } : buscar(paso.key);
      var idxPaso = orden.indexOf(paso.key);
      var completado = paso.key==='pendiente' || (ev && idxPaso <= idxActual && p.estado!==paso.key);
      var esActual = (p.estado===paso.key);
      var estilo = completado ? 'done' : (esActual ? 'current' : 'pending');
      html += '<div class="mp-tl-step '+estilo+'">'
        + '<div class="mp-tl-dot"'+((completado||esActual)?(' style="background:'+paso.color+';border-color:'+paso.color+';"'):'')+'>'+paso.icon+'</div>'
        + '<div class="mp-tl-body"><div class="mp-tl-label">'+esc(paso.label)+'</div>'
        + (ev ? ('<div class="mp-tl-meta">'+fechaHora(ev.ts)+(ev.por?(' \u00b7 '+esc(ev.por)):'')+'</div>') : '<div class="mp-tl-meta pend">A\u00fan no llega a esta etapa</div>')
        + '</div></div>';
    });
    html += '</div>';
    return html;
  }

  window.__mpVerImagen = function(src){
    var ov=document.getElementById('mp-modal'); if(!ov) return;
    ov.querySelector('.mp-modal-box').innerHTML='<img src="'+esc(src)+'">';
    ov.classList.add('show');
  };
  window.__mpCerrarModal = function(){ var ov=document.getElementById('mp-modal'); if(ov) ov.classList.remove('show'); };
  function construirModal(){
    if (document.getElementById('mp-modal')) return;
    var ov=document.createElement('div'); ov.id='mp-modal'; ov.className='mp-modal-ov';
    ov.innerHTML='<div class="mp-modal-box"></div>';
    ov.addEventListener('click', function(e){ if(e.target===ov) window.__mpCerrarModal(); });
    document.body.appendChild(ov);
  }

  // Panel de "Mis Pedidos" como ventana emergente, abierto desde el ícono en Ventas.
  window.__mpCerrarPanel = function(){ var ov=document.getElementById('mp-panel-ov'); if(ov) ov.classList.remove('show'); };
  function construirPanel(){
    if (document.getElementById('mp-panel-ov')) return;
    var ov=document.createElement('div'); ov.id='mp-panel-ov'; ov.className='mp-modal-ov';
    ov.innerHTML='<div class="mp-panel-box"><div class="mp-panel-head"><span>Mis Pedidos</span><button onclick="window.__mpCerrarPanel()">&times;</button></div><div id="'+contId+'" class="mp-panel-body"></div></div>';
    ov.addEventListener('click', function(e){ if(e.target===ov) window.__mpCerrarPanel(); });
    document.body.appendChild(ov);
  }
  window.abrirMisPedidosVentas = function(){
    inyectarCSS();
    construirPanel();
    construirModal();
    document.getElementById('mp-panel-ov').classList.add('show');
    window.renderMisPedidos();
  };

  window.__mpToggle = function(id){
    expandido[id] = !expandido[id];
    if (expandido[id]){
      var tareas = [];
      if (!_evidCache[id]) tareas.push(cargarEvidencias(id));
      if (!_histCache[id]) tareas.push(cargarHistorial(id));
      if (tareas.length) Promise.all(tareas).then(render); else render();
    } else render();
  };

  function tarjeta(p){
    var abierta = !!expandido[p.id];
    var necesitaAtencion = !!p.entregaPendienteFirma;
    var tipoTag = '<span class="mp-tag" style="background:'+(p.tipo==='material'?'#8B4FD6':'#1473E6')+'">'+(p.tipo==='material'?'Material':'Venta')+'</span>';
    var destinoTxt = p.destinoTipo ? (DESTINO_TIPOS[p.destinoTipo]||p.destinoTipo) : '';
    var destinoSub = destinoResumen(p);
    var destinoHtml = destinoTxt ? ('<div class="mp-destino">\ud83d\udce6 '+esc(destinoTxt)+(destinoSub?(' \u2014 '+esc(destinoSub)):'')+'</div>') : '';
    var comentarioHtml = p.comentariosAlmacen ? ('<div class="mp-destino">\ud83d\udcac '+esc(p.comentariosAlmacen)+'</div>') : '';
    var atencionHtml = necesitaAtencion ? '<div class="mp-atencion-badge">\u270d\ufe0f Esperando que alguien firme de recibido</div>' : '';

    var detalle = '';
    if (abierta){
      detalle += (_histCache[p.id] ? renderSeguimiento(p) : '<div style="font-size:11.5px;color:#94a3b8;margin:8px 0;">Cargando seguimiento\u2026</div>');
      var prods = Array.isArray(p.productos)?p.productos:[];
      detalle += '<div style="margin-top:8px;border-top:1px dashed #e6ebf2;padding-top:8px;font-size:12px;color:#334155;">'
        + (prods.length ? prods.map(function(it){ return '<div>'+(Number(it.cant)||0)+'\u00d7 '+esc(it.desc||'')+'</div>'; }).join('') : 'Sin productos capturados.')
        + '</div>';
      if (p.firma){
        detalle += '<div class="mp-firma-mini"><div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Firma de la solicitud</div><img src="'+esc(p.firma)+'" onclick="window.__mpVerImagen(\''+esc(p.firma)+'\')"></div>';
      }
      if (p.firmaEntrega){
        detalle += '<div class="mp-firma-mini"><div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Firma de entrega'+(p.recibioNombre?(' \u00b7 recibi\u00f3 '+esc(p.recibioNombre)):'')+'</div><img src="'+esc(p.firmaEntrega)+'" onclick="window.__mpVerImagen(\''+esc(p.firmaEntrega)+'\')"></div>';
      }
      var evid = _evidCache[p.id];
      if (evid === undefined){
        detalle += '<div style="font-size:11.5px;color:#94a3b8;margin-top:8px;">Cargando evidencia de entrega\u2026</div>';
      } else if (evid.length){
        detalle += '<div style="margin-top:8px;"><div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Evidencia de entrega</div>'
          + evid.map(function(ev){ return '<img class="mp-evid-thumb" src="'+esc(ev.imagen)+'" onclick="window.__mpVerImagen(\''+esc(ev.imagen)+'\')">'; }).join('')
          + '</div>';
      } else if (p.estado==='entregado' || p.estado==='finalizado'){
        detalle += '<div style="font-size:11.5px;color:#94a3b8;margin-top:8px;">Todav\u00eda no hay fotos de evidencia para esta entrega.</div>';
      }
    }

    return '<div class="mp-card'+(necesitaAtencion?' atencion':'')+'">'
      + '<div class="mp-top"><span class="mp-folio">'+esc(p.folio||'\u2014')+tipoTag+'</span>'
      +   '<span class="mp-estado" style="background:'+estadoColor(p.estado)+'">'+esc(estadoLabel(p.estado))+'</span></div>'
      + '<div class="mp-cli">'+esc(p.cliente||'Sin cliente')+'</div>'
      + '<div class="mp-meta">'+(p.fechaEntrega?('Entrega: '+esc(p.fechaEntrega)):'Sin fecha de entrega capturada')+'</div>'
      + destinoHtml + comentarioHtml + atencionHtml
      + '<button class="mp-btn" onclick="window.__mpToggle(\''+p.id+'\')">'+(abierta?'Ocultar detalle':'Ver seguimiento')+'</button>'
      + detalle
      + '</div>';
  }

  function render(){
    var cont = contenedor(); if (!cont) return;
    inyectarCSS();
    var mapa = {};
    _pedidosVendedor.forEach(function(p){ mapa[p.id]=p; });
    _pedidosSolicitante.forEach(function(p){ mapa[p.id]=p; });
    _pedidosCreador.forEach(function(p){ mapa[p.id]=p; });
    var lista = Object.keys(mapa).map(function(k){ return mapa[k]; })
      .filter(function(p){ return p.estado!=='cancelado'; })
      .sort(function(a,b){ return b.createdAt - a.createdAt; });

    var pendientesFirma = lista.filter(function(p){ return p.entregaPendienteFirma; }).length;
    var aviso = pendientesFirma
      ? ('<div class="mp-aviso">\u270d\ufe0f Tienes '+pendientesFirma+' pedido(s) esperando que alguien firme de recibido.</div>')
      : '';

    cont.innerHTML = '<div class="mp-wrap">' + aviso
      + (lista.length
          ? ('<div class="mp-grid">'+lista.map(tarjeta).join('')+'</div>')
          : '<div class="mp-empty">Todav\u00eda no tienes pedidos registrados a tu nombre.</div>')
      + '</div>';
  }

  function mapDoc(docu){
    var d = docu.data() || {};
    return {
      id: docu.id,
      folio: d.folio||'\u2014', cliente: d.cliente||'', vendedor: d.vendedor||'', solicitante: d.solicitante||'',
      creadoPor: d.creadoPor||'',
      estado: d.estado||'pendiente', tipo: d.tipo||'venta', productos: Array.isArray(d.productos)?d.productos:[],
      fechaEntrega: d.fechaEntrega||'', firma: d.firma||'', firmaEntrega: d.firmaEntrega||'', recibioNombre: d.recibioNombre||'',
      entregaPendienteFirma: !!d.entregaPendienteFirma,
      destinoTipo: d.destinoTipo||'', destinoPaqueteria: d.destinoPaqueteria||'', destinoGuia: d.destinoGuia||'',
      destinoDireccion: d.destinoDireccion||'', destinoAlmacenOrigen: d.destinoAlmacenOrigen||'', destinoAlmacenDestino: d.destinoAlmacenDestino||'',
      comentariosAlmacen: d.comentariosAlmacen||'',
      createdAt: toMs(d.createdAt)
    };
  }

  window.renderMisPedidos = function(){
    var cont = contenedor();
    if (cont && !_unsubV) cont.innerHTML = '<div class="mp-empty">Cargando tus pedidos\u2026</div>';
    construirModal();
    var nombre = yoNombre();
    var email = (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '';
    if (!email){ if(cont) cont.innerHTML='<div class="mp-empty">Inicia sesi\u00f3n para ver tus pedidos.</div>'; return; }

    cargarFirestore().then(function(fs){
      if (!window.db) return;
      if (!_unsubV && nombre){
        _unsubV = fs.onSnapshot(fs.query(fs.collection(window.db,'surtidos'), fs.where('vendedor','==',nombre)), function(snap){
          _pedidosVendedor = snap.docs.map(mapDoc); render();
        }, function(err){ console.error('[mis-pedidos] vendedor:',err); });
      }
      if (!_unsubM && nombre){
        _unsubM = fs.onSnapshot(fs.query(fs.collection(window.db,'surtidos'), fs.where('solicitante','==',nombre)), function(snap){
          _pedidosSolicitante = snap.docs.map(mapDoc); render();
        }, function(err){ console.error('[mis-pedidos] solicitante:',err); });
      }
      if (!_unsubC){
        // El enlace más confiable: el correo de quien realmente subió/creó el pedido (creadoPor),
        // independiente de lo que diga el campo de texto "vendedor".
        _unsubC = fs.onSnapshot(fs.query(fs.collection(window.db,'surtidos'), fs.where('creadoPor','==',email)), function(snap){
          _pedidosCreador = snap.docs.map(mapDoc); render();
        }, function(err){ console.error('[mis-pedidos] creadoPor:',err); });
      }
    });
  };

  console.log('[mis-pedidos.js] \u2705 M\u00f3dulo de perfil cargado');
})();
