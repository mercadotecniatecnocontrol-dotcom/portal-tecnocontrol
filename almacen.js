/* ============================================================================
 * almacen.js · Módulo de Almacén — Centro de Surtido (flujo de pedidos)
 * ----------------------------------------------------------------------------
 * Responsabilidad ÚNICA: mostrar EN VIVO el flujo de pedidos de la colección
 * `surtidos` de Firestore dentro del departamento de Almacén y permitir al
 * personal AVANZAR cada pedido por sus etapas de surtido, con checklist de
 * picking línea por línea y trazabilidad en `surtidos/{id}/historial`.
 *
 * Ideas tomadas de un WMS profesional (Netlogistik/WEP), adaptadas a la escala
 * de Tecnocontrol: etapas claras (Recibo→Surtido→Verificación→Embarque),
 * surtido por pieza (checklist), priorización de urgentes, visibilidad SLA.
 *
 * NO sube PDFs — eso lo hace almacen-pdf.js (window.abrirSurtidoPDF), que vive
 * en Ventas. Aquí sólo se OPERA el surtido.
 *
 * Depende de globals del portal: window.db, window.auth, window.nombreUsuario.
 * Expone: window.abrirAlmacen(idContenedor)   ← contrato con irAlmacen()
 *
 * Esquema `surtidos` (compatible con almacen-pdf.js y pedidos-almacen.html):
 *   { folio, cliente, vendedor, prioridad, estado, productos:[{clave,cant,desc}],
 *     origen, creadoPor, createdAt,  check:{ "<idx>": true } }   ← check es NUEVO y opcional
 *
 * Máquina de estados (igual que la TV):
 *   esperando_autorizacion → pendiente → en_preparacion → listo → entregado → finalizado
 * ==========================================================================*/
(function () {
  'use strict';

  // ── Config compartida con la TV (pedidos-almacen.html) ──
  var SLA        = { urgente:15, muy_alta:20, alta:30, normal:60, baja:120 };
  var SEMAFORO   = { amarillo:20, naranja:30 };
  var COLORS     = { azul:'#1473E6', verde:'#12A150', teal:'#0FB5A6', amarillo:'#D99000', naranja:'#F26B21', rojo:'#E23B3B', morado:'#8B4FD6', gris:'#7C8CA1' };
  var PRIO_COLOR = { urgente:COLORS.rojo, muy_alta:COLORS.naranja, alta:COLORS.amarillo, normal:COLORS.azul, baja:COLORS.gris };
  var PRIO_RANK  = { urgente:5, muy_alta:4, alta:3, normal:2, baja:1 };
  var PRIO_LABEL = { urgente:'Urgente', muy_alta:'Muy alta', alta:'Alta', normal:'Normal', baja:'Baja' };
  // ── Destino de entrega del pedido ──
  var DESTINO_TIPOS = {
    recoger_oficinas:   'Recoger en oficinas Tecnocontrol',
    cliente_recoge:     'Cliente viene por \u00e9l',
    vendedor_recoge:    'Vendedor recoge en almac\u00e9n',
    queda_almacen:      'Se queda en almac\u00e9n',
    paqueteria:         'Enviar por paqueter\u00eda',
    entrega_chihuahua:  'Entrega en Chihuahua (estaci\u00f3n)',
    traslado_almacenes: 'Traslado entre almacenes'
  };
  var DESTINO_COLOR = {
    recoger_oficinas:   COLORS.azul,
    cliente_recoge:     COLORS.verde,
    vendedor_recoge:    COLORS.teal,
    queda_almacen:      COLORS.gris,
    paqueteria:         COLORS.naranja,
    entrega_chihuahua:  COLORS.morado,
    traslado_almacenes: COLORS.amarillo
  };
  var ALMACENES_DEFAULT = ['CHIHUAHUA','JU\u00c1REZ','PARRAL','MONTERREY','SONORA','JALISCO'];
  var NEXT       = { esperando_autorizacion:'pendiente', pendiente:'en_preparacion', en_preparacion:'listo', listo:'entregado', entregado:'finalizado' };
  var PREV       = { pendiente:'esperando_autorizacion', en_preparacion:'pendiente', listo:'en_preparacion', entregado:'listo' };

  // Columnas del tablero con nombres estilo WMS (finalizado se archiva)
  var COLUMNAS = [
    { estado:'pendiente',      titulo:'Por surtir',    sub:'Recibo',        color:COLORS.azul  },
    { estado:'en_preparacion', titulo:'En surtido',    sub:'Picking',       color:COLORS.verde },
    { estado:'listo',          titulo:'Verificado',    sub:'Listo',         color:COLORS.teal  },
    { estado:'entregado',      titulo:'Entregado',     sub:'Embarque',      color:COLORS.gris  }
  ];
  var ACCION = {
    esperando_autorizacion:'Autorizar',
    pendiente:'Iniciar surtido',
    en_preparacion:'Marcar listo',
    listo:'Marcar entregado',
    entregado:'Finalizar'
  };

  // ── Estado interno ──
  var contId    = 'vista-almacen';
  var pedidos   = [];
  var expandido = {};                 // {id:true}
  var filtro    = { q:'', prio:'', tipo:'' };   // búsqueda, prioridad y tipo
  var _unsub  = null, _tick = null, _fs = null, _cssOk = false;
  var _conocidos = null;             // Set de ids ya vistos (null = aún no hubo primera carga)
  var _almacenes = null;             // lista de almacenes para traslados (config/almacenes en Firestore)
  var _evidenciasCache = {};         // id -> [{id,imagen,subidoPor,subidoEn}]
  var _destinoEditId = null;         // id del pedido que se está editando en el modal de destino
  var _notifOn = (function(){ try{ return localStorage.getItem('alm_notif_on')!=='0'; }catch(e){ return true; } })();

  function cargarFirestore(){
    if (_fs) return Promise.resolve(_fs);
    return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js').then(function(m){ _fs=m; return m; });
  }

  // ── Helpers ──
  function now(){ return Date.now(); }
  function toMs(v){
    if (v == null) return now();
    if (typeof v === 'number') return v;
    if (typeof v === 'string'){ var t=Date.parse(v); return isNaN(t)?now():t; }
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v.seconds === 'number') return v.seconds*1000 + Math.floor((v.nanoseconds||0)/1e6);
    return now();
  }
  function esAdminActual(){
    try{
      var email = window.auth && window.auth.currentUser ? window.auth.currentUser.email : '';
      return !!(window.esAdminTotal && window.esAdminTotal(email));
    }catch(e){ return false; }
  }

  function piezas(p){ return (Array.isArray(p.productos)?p.productos:[]).reduce(function(a,x){ return a+(Number(x.cant)||0); },0); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmt(ms){ var s=Math.max(0,Math.floor(ms/1000)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }

  // ── Notificación sonora + push al llegar pedido nuevo ──
  function reproducirBeep(){
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = new Ctx();
      [0,0.16].forEach(function(delay,i){
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = i===0 ? 880 : 1180;
        osc.connect(gain); gain.connect(ctx.destination);
        var t0 = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.22, t0+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0+0.14);
        osc.start(t0); osc.stop(t0+0.15);
      });
      setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 500);
    }catch(e){ console.warn('[almacen] beep:',e); }
  }

  // Sonido de alerta por tiempo (distinto al de "pedido nuevo"): un tono suave para "por vencer",
  // tres tonos más agudos para "retrasado". Suena UNA VEZ al cruzar el umbral, no se repite en bucle.
  function reproducirAlertaSLA(tipo){
    try{
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      var ctx = new Ctx();
      var tonos = tipo==='retrasado' ? [700,700,700] : [520];
      tonos.forEach(function(f,i){
        var osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.connect(gain); gain.connect(ctx.destination);
        var t0 = ctx.currentTime + i*0.22;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.2, t0+0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0+0.18);
        osc.start(t0); osc.stop(t0+0.2);
      });
      setTimeout(function(){ try{ ctx.close(); }catch(e){} }, 900);
    }catch(e){ console.warn('[almacen] alerta SLA:',e); }
  }
  var _alertPorVencer = {};  // id -> true, ya avisado (para no repetir el sonido cada segundo)
  var _alertRetrasado = {};
  function revisarAlertasSLA(){
    pedidos.forEach(function(p){
      var st = estadoSLA(p);
      if (st==='porvencer'){
        if (_notifOn && !_alertPorVencer[p.id]){
          _alertPorVencer[p.id]=true;
          reproducirAlertaSLA('porvencer');
          if (window.mostrarPush) window.mostrarPush('\u23f3 Por vencer', (p.folio||'')+' \u00b7 '+(p.cliente||''), '\u23f3');
        }
      } else {
        delete _alertPorVencer[p.id];
      }
      if (st==='retrasado'){
        if (_notifOn && !_alertRetrasado[p.id]){
          _alertRetrasado[p.id]=true;
          reproducirAlertaSLA('retrasado');
          if (window.mostrarPush) window.mostrarPush('\ud83d\udea8 Pedido retrasado', (p.folio||'')+' \u00b7 '+(p.cliente||''), '\ud83d\udea8');
        }
      } else {
        delete _alertRetrasado[p.id];
      }
    });
  }

  function notificarPedidoNuevo(p){
    if(!_notifOn) return;
    reproducirBeep();
    try{
      if('Notification' in window && Notification.permission==='granted'){
        var n = new Notification('📦 Nuevo pedido — '+(p.folio||'—'), {
          body: (p.cliente||'Sin cliente')+' · '+(p.tipo==='material'?'Material':'Venta')+' · '+piezas(p)+' pzas',
          tag: 'alm-'+p.id,
          icon: undefined
        });
        n.onclick = function(){ window.focus(); try{ n.close(); }catch(e){} };
      }
    }catch(e){ console.warn('[almacen] Notification:',e); }
  }

  window.__almNotifToggle = function(){
    _notifOn = !_notifOn;
    try{ localStorage.setItem('alm_notif_on', _notifOn?'1':'0'); }catch(e){}
    if(_notifOn && 'Notification' in window && Notification.permission==='default'){
      Notification.requestPermission();
    }
    var btn = document.getElementById('alm-notif-btn');
    if(btn) btn.innerHTML = iconoCampana();
  };

  function iconoCampana(){
    return _notifOn
      ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="3" y1="3" x2="21" y2="21"/></svg>';
  }
  function yoEmail(){ return (window.auth && window.auth.currentUser && window.auth.currentUser.email) || ''; }
  function yoNombre(){ var e=yoEmail(); return (window.nombreUsuario?window.nombreUsuario(e):'')||e||'Usuario'; }
  function inicioDeHoy(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
  function enSLA(p){ return (now()-p.createdAt)/60000 <= (SLA[p.prioridad]||60); }

  function acento(p){
    if (p.estado==='esperando_autorizacion') return COLORS.morado;
    if (p.estado==='entregado')              return COLORS.gris;
    if (p.estado==='listo')                  return COLORS.teal;
    var mins=(now()-p.createdAt)/60000, sla=SLA[p.prioridad]||30;
    if (mins>sla)               return COLORS.rojo;
    if (mins>SEMAFORO.naranja)  return COLORS.naranja;
    if (mins>SEMAFORO.amarillo) return COLORS.amarillo;
    if (p.estado==='en_preparacion') return COLORS.verde;
    return COLORS.azul;
  }
  // Clasificación de tiempo para las alertas: 'ok' | 'porvencer' | 'retrasado'
  function estadoSLA(p){
    if (['esperando_autorizacion','listo','entregado','finalizado','cancelado'].indexOf(p.estado)!==-1) return 'ok';
    var mins=(now()-p.createdAt)/60000, sla=SLA[p.prioridad]||30;
    if (mins>sla) return 'retrasado';
    if (mins>SEMAFORO.amarillo) return 'porvencer';
    return 'ok';
  }
  function fechaEntregaMs(p){
    if(!p.fechaEntrega) return Infinity;         // sin fecha → al final dentro de su prioridad
    var d = new Date(p.fechaEntrega+'T00:00:00');
    return isNaN(d.getTime()) ? Infinity : d.getTime();
  }
  function ordenar(list){
    return list.slice().sort(function(a,b){
      return (PRIO_RANK[b.prioridad]-PRIO_RANK[a.prioridad])
        || (fechaEntregaMs(a)-fechaEntregaMs(b))
        || (a.createdAt-b.createdAt);
    });
  }
  function pasaFiltro(p){
    if (filtro.prio && p.prioridad !== filtro.prio) return false;
    if (filtro.tipo && p.tipo !== filtro.tipo) return false;
    if (filtro.q){
      var q=filtro.q.toLowerCase();
      var blob=((p.folio||'')+' '+(p.cliente||'')+' '+(p.vendedor||'')).toLowerCase();
      if (blob.indexOf(q)===-1) return false;
    }
    return true;
  }
  function nChecked(p){ var c=p.check||{}; var n=0; for (var k in c){ if(c[k]) n++; } return n; }

  // =====================================================================
  //  DESTINO DE ENTREGA
  // =====================================================================
  function iconoCaja(){
    return '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>';
  }
  function destinoResumen(p){
    if (p.destinoTipo==='paqueteria') return [p.destinoPaqueteria, (p.destinoGuia?('gu\u00eda '+p.destinoGuia):'')].filter(Boolean).join(' \u00b7 ');
    if (p.destinoTipo==='entrega_chihuahua') return p.destinoDireccion||'';
    if (p.destinoTipo==='traslado_almacenes') return (p.destinoAlmacenOrigen||'\u2014')+' \u2192 '+(p.destinoAlmacenDestino||'\u2014');
    return '';
  }
  // Solo lectura: el destino se registra desde Ventas / Solicitud de Material, no aqu\u00ed.
  function destinoHtml(p){
    var tipo=p.destinoTipo;
    if (!tipo) return '<div class="alm-destino"><span class="alm-destino-chip vacio">'+iconoCaja()+'Sin destino asignado</span></div>';
    var label = DESTINO_TIPOS[tipo]||tipo;
    var color = DESTINO_COLOR[tipo]||COLORS.gris;
    var sub = destinoResumen(p);
    return '<div class="alm-destino">'
      + '<span class="alm-destino-chip" style="background:'+color+'1c;color:'+color+';border-color:'+color+'55">'
      +   iconoCaja()+esc(label)
      + '</span>'
      + (sub?'<span class="alm-destino-sub">'+esc(sub)+'</span>':'')
      + '</div>';
  }
  function cargarAlmacenes(){
    if (_almacenes) return Promise.resolve(_almacenes);
    return cargarFirestore().then(function(fs){
      if (!window.db) { _almacenes=ALMACENES_DEFAULT.slice(); return _almacenes; }
      return fs.getDoc(fs.doc(window.db,'config','almacenes')).then(function(snap){
        var nombres = snap.exists() ? (snap.data()||{}).nombres : null;
        if (Array.isArray(nombres) && nombres.length){ _almacenes=nombres; }
        else {
          _almacenes = ALMACENES_DEFAULT.slice();
          fs.setDoc(fs.doc(window.db,'config','almacenes'), { nombres:_almacenes }, {merge:true}).catch(function(){});
        }
        return _almacenes;
      });
    }).catch(function(err){ console.warn('[almacen] cargarAlmacenes:',err); _almacenes=ALMACENES_DEFAULT.slice(); return _almacenes; });
  }
  function agregarAlmacen(nombre){
    return cargarAlmacenes().then(function(lista){
      if (lista.indexOf(nombre)!==-1) return lista;
      return cargarFirestore().then(function(fs){
        return fs.updateDoc(fs.doc(window.db,'config','almacenes'), { nombres: fs.arrayUnion(nombre) }).then(function(){
          _almacenes.push(nombre);
          return _almacenes;
        });
      });
    });
  }
  // Expuestas para que Ventas y Solicitud de Material (que a\u00fan no viven en este archivo)
  // puedan registrar el destino usando la misma lista de almacenes y el mismo esquema de datos.
  // Aqu\u00ed en Almac\u00e9n el destino es SOLO LECTURA \u2014 no se registra ni se edita desde este m\u00f3dulo.
  window.__almListaAlmacenes = function(){ return cargarAlmacenes(); };
  window.__almAgregarAlmacenGlobal = function(nombre){ return agregarAlmacen(String(nombre||'').trim().toUpperCase()); };

  // ── Ver el PDF original adjunto por Ventas al subir el pedido (solo lectura, para validar) ──
  window.__almVerPDF = function(id){
    cargarFirestore().then(function(fs){
      if (!window.db) throw new Error('Firestore no disponible');
      return fs.getDoc(fs.doc(window.db,'surtidos',id,'adjuntos','pdf_original'));
    }).then(function(snap){
      if (!snap.exists() || !(snap.data()||{}).archivo){
        if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','Este pedido no tiene PDF adjunto todav\u00eda','\u26a0\ufe0f');
        return;
      }
      var w = window.open();
      if (w) w.document.write('<iframe src="'+(snap.data().archivo)+'" style="border:none;width:100%;height:100%;"></iframe>');
    }).catch(function(err){
      console.error('[almacen] verPDF:',err);
      if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','No se pudo abrir el PDF','\u26a0\ufe0f');
    });
  };

  // =====================================================================
  //  EVIDENCIAS DE ENTREGA (fotos, además de la firma)
  // =====================================================================
  function cargarEvidencias(id){
    if (_evidenciasCache[id]) return Promise.resolve(_evidenciasCache[id]);
    return cargarFirestore().then(function(fs){
      if (!window.db) { _evidenciasCache[id]=[]; return []; }
      var col=fs.collection(window.db,'surtidos',id,'evidencias');
      var q; try{ q=fs.query(col, fs.orderBy('subidoEn','asc')); }catch(e){ q=col; }
      return fs.getDocs(q);
    }).then(function(snap){
      var list=[];
      if (snap && snap.forEach) snap.forEach(function(d){ list.push(Object.assign({id:d.id}, d.data())); });
      _evidenciasCache[id]=list;
      return list;
    }).catch(function(err){ console.warn('[almacen] cargarEvidencias:',err); _evidenciasCache[id]=[]; return []; });
  }
  function renderEvidenciasThumbs(p){
    var list=_evidenciasCache[p.id]||[];
    if (!list.length) return '<div class="alm-empty" style="padding:4px 0;">Sin evidencias a\u00fan</div>';
    return list.map(function(ev,idx){
      return '<img class="alm-evid-thumb" src="'+esc(ev.imagen)+'" onclick="window.__almVerEvidencia(\''+p.id+'\','+idx+')">';
    }).join('');
  }
  window.__almSubirEvidencia = function(id){
    var input=document.getElementById('alm-evid-file-'+id); if (!input) return;
    input.onchange = function(){
      var file=input.files&&input.files[0]; input.value='';
      if (!file) return;
      comprimirImagen(file).then(function(dataUrl){
        return cargarFirestore().then(function(fs){
          if (!window.db) throw new Error('Firestore no disponible');
          return fs.addDoc(fs.collection(window.db,'surtidos',id,'evidencias'), {
            imagen:dataUrl, subidoPor:yoNombre(), subidoPorEmail:yoEmail(), subidoEn:fs.serverTimestamp()
          });
        });
      }).then(function(){
        delete _evidenciasCache[id];
        return cargarEvidencias(id);
      }).then(function(){
        render();
        if (window.mostrarPush) window.mostrarPush('📷 Evidencia agregada','','✅');
      }).catch(function(err){
        console.error('[almacen] subirEvidencia:',err);
        if (window.mostrarPush) window.mostrarPush('Almacén','No se pudo subir la evidencia','⚠️');
      });
    };
    input.click();
  };
  window.__almVerEvidencia = function(id, idx){
    var list=_evidenciasCache[id]||[]; var ev=list[idx]; if (!ev) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.remove('wide');
    box.innerHTML = '<h4>Evidencia de entrega<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<img class="alm-firma-full" src="'+esc(ev.imagen)+'" alt="Evidencia">'
      + (ev.subidoPor?('<div style="font-size:12px;color:#64748b;font-weight:700;">Subida por '+esc(ev.subidoPor)+'</div>'):'');
    document.getElementById('alm-modal-hist').classList.add('show');
  };

  // =====================================================================
  //  CSS (una sola vez)
  // =====================================================================
  function inyectarCSS(){
    if (_cssOk) return; _cssOk = true;
    var css = ''
    + '.alm-wrap{--r:14px;}'
    + '.alm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:2px 0 18px;}'
    + '.alm-live{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;letter-spacing:.06em;color:#12A150;text-transform:uppercase;}'
    + '.alm-live .p{width:8px;height:8px;border-radius:99px;background:#12A150;animation:almPulse 1.8s infinite;}'
    + '.alm-search{flex:1;min-width:180px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e6ebf2;border-radius:10px;padding:8px 12px;}'
    + '.alm-search input{border:none;outline:none;width:100%;font-size:13px;color:#0f172a;background:transparent;}'
    + '.alm-fchips{display:flex;gap:6px;flex-wrap:wrap;}'
    + '.alm-notif-btn{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9px;border:1px solid #e6ebf2;background:#fff;color:#475569;cursor:pointer;flex-shrink:0;}'
    + '.alm-notif-btn:hover{background:#f1f5f9;}'
    + '.alm-fchip{cursor:pointer;border:1px solid #e6ebf2;background:#fff;color:#475569;border-radius:99px;font-size:11.5px;font-weight:800;padding:6px 12px;}'
    + '.alm-fchip.on{background:#0f172a;color:#fff;border-color:#0f172a;}'
    + '.alm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin:0 0 22px;}'
    + '.alm-kpi{background:#fff;border:1px solid #e6ebf2;border-radius:var(--r);padding:15px 17px;box-shadow:0 1px 3px rgba(16,24,40,.04);}'
    + '.alm-kpi .n{font-size:27px;font-weight:800;line-height:1;color:#0f172a;}'
    + '.alm-kpi .l{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin-top:8px;}'
    + '.alm-kpi .bar{height:4px;border-radius:99px;margin-bottom:12px;width:32px;}'
    + '.alm-board{display:grid;grid-template-columns:repeat(4,minmax(238px,1fr));gap:16px;align-items:start;}'
    + '@media(max-width:1100px){.alm-board{grid-template-columns:repeat(2,1fr);}}'
    + '@media(max-width:640px){.alm-board{grid-template-columns:1fr;}}'
    + '.alm-col{background:#f6f8fb;border:1px solid #e6ebf2;border-radius:var(--r);padding:12px;min-height:120px;}'
    + '.alm-col-h{display:flex;align-items:center;justify-content:space-between;margin:2px 4px 12px;}'
    + '.alm-col-h .t{display:flex;flex-direction:column;gap:1px;}'
    + '.alm-col-h .t .a{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#334155;}'
    + '.alm-col-h .t .b{font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#94a3b8;margin-left:17px;}'
    + '.alm-col-h .dot{width:9px;height:9px;border-radius:99px;}'
    + '.alm-col-h .c{background:#fff;border:1px solid #e6ebf2;border-radius:99px;font-size:12px;font-weight:800;color:#475569;padding:2px 9px;}'
    + '.alm-card{background:#fff;border:1px solid #e6ebf2;border-left:4px solid #cbd5e1;border-radius:11px;padding:12px 13px;margin-bottom:11px;box-shadow:0 1px 2px rgba(16,24,40,.04);}'
    + '.alm-card.urg{box-shadow:0 0 0 2px rgba(226,59,59,.18),0 1px 2px rgba(16,24,40,.04);}'
    + '.alm-card .top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px;}'
    + '.alm-card .folio{font-size:12px;font-weight:800;color:#0f172a;letter-spacing:.02em;}'
    + '.alm-chip{font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#fff;border-radius:99px;padding:3px 8px;white-space:nowrap;}'
    + '.alm-chip.urg{animation:almBlink 1.4s infinite;}'
    + '.alm-card .cli{font-size:14px;font-weight:700;color:#1e293b;line-height:1.25;}'
    + '.alm-card .vend{font-size:11.5px;color:#64748b;margin-top:2px;}'
    + '.alm-meta{display:flex;align-items:center;gap:14px;margin:9px 0 2px;font-size:12px;color:#475569;}'
    + '.alm-meta b{font-variant-numeric:tabular-nums;font-weight:800;color:#0f172a;}'
    + '.alm-timer{font-variant-numeric:tabular-nums;font-weight:800;}'
    + '.alm-prog{margin-top:9px;}'
    + '.alm-prog .lbl{display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;}'
    + '.alm-prog .track{height:6px;background:#eef2f7;border-radius:99px;overflow:hidden;}'
    + '.alm-prog .fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#0e7490,#12A150);transition:width .2s;}'
    + '.alm-prod{margin-top:10px;border-top:1px dashed #e6ebf2;padding-top:8px;}'
    + '.alm-prow{display:grid;grid-template-columns:22px auto 1fr auto;gap:9px;align-items:center;font-size:12px;padding:5px 0;color:#334155;border-bottom:1px solid #f1f5f9;}'
    + '.alm-prow:last-child{border-bottom:none;}'
    + '.alm-prow.done{opacity:.55;}'
    + '.alm-prow.done .k,.alm-prow.done .d{text-decoration:line-through;}'
    + '.alm-check{width:19px;height:19px;border-radius:6px;border:2px solid #cbd5e1;background:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;}'
    + '.alm-check.on{background:#12A150;border-color:#12A150;}'
    + '.alm-check svg{stroke:#fff;}'
    + '.alm-prow .k{font-weight:700;color:#0f172a;}'
    + '.alm-prow .q{font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums;}'
    + '.alm-actions{display:flex;gap:8px;margin-top:11px;}'
    + '.alm-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;cursor:pointer;border-radius:9px;font-size:12.5px;font-weight:800;padding:9px 10px;transition:filter .12s;}'
    + '.alm-btn:hover{filter:brightness(.96);}'
    + '.alm-btn-go{background:linear-gradient(135deg,#0e7490,#0891b2);color:#fff;}'
    + '.alm-btn-go.wait{background:#e2e8f0;color:#94a3b8;}'
    + '.alm-btn-ghost{flex:0 0 auto;background:#f1f5f9;color:#475569;}'
    + '.alm-btn-back{flex:0 0 auto;background:#fff;border:1px solid #e6ebf2;color:#94a3b8;}'
    + '.alm-empty{padding:14px 6px;text-align:center;color:#94a3b8;font-size:12px;}'
    + '.alm-loading{padding:50px;text-align:center;color:#94a3b8;font-size:13px;}'
    + '.alm-tipo-tag{display:inline-block;margin-left:6px;font-size:10px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;color:#fff;border-radius:6px;padding:2px 7px;vertical-align:middle;}'
    + '.alm-tipo-tag.ven{background:'+COLORS.azul+';}'
    + '.alm-tipo-tag.mat{background:'+COLORS.morado+';}'
    + '.alm-firma-mini{margin-top:10px;border-top:1px dashed #e6ebf2;padding-top:8px;}'
    + '.alm-firma-mini .lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;}'
    + '.alm-firma-mini img{max-width:100%;max-height:70px;border:1px solid #e6ebf2;border-radius:8px;background:#fff;cursor:zoom-in;display:block;}'
    + '.alm-modal-ov{display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;align-items:center;justify-content:center;padding:20px;}'
    + '.alm-modal-ov.show{display:flex;}'
    + '.alm-modal-box{background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:82vh;overflow:auto;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);}'
    + '.alm-modal-box.wide{max-width:860px;}'
    + '.alm-fotos-search{position:relative;margin-bottom:14px;}'
    + '.alm-fotos-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);pointer-events:none;}'
    + '.alm-fotos-search input{width:100%;padding:11px 14px 11px 38px;border:2px solid #e6ebf2;border-radius:10px;font-size:14px;font-family:inherit;outline:none;}'
    + '.alm-fotos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}'
    + '.alm-fcard{border:1px solid #e6ebf2;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;background:#fafcff;}'
    + '.alm-fcard .thumb{width:100%;aspect-ratio:1/1;border-radius:9px;background:#eef2f7;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#94a3b8;}'
    + '.alm-fcard .thumb img{width:100%;height:100%;object-fit:cover;}'
    + '.alm-fcard .d{font-size:12px;font-weight:700;color:#0f172a;line-height:1.3;min-height:30px;}'
    + '.alm-fcard .k{font-size:10.5px;color:#94a3b8;font-weight:700;}'
    + '.alm-fcard button{border:none;border-radius:8px;background:#eaf0ff;color:#1d4ed8;font-weight:800;font-size:11.5px;padding:7px;cursor:pointer;}'
    + '.alm-fcard button:disabled{opacity:.55;cursor:default;}'
    + '.alm-rep-filtros{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:flex-end;}'
    + '.alm-rep-fld{display:flex;flex-direction:column;gap:4px;}'
    + '.alm-rep-fld label{font-size:10.5px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#94a3b8;}'
    + '.alm-rep-fld input{border:2px solid #e6ebf2;border-radius:9px;padding:8px 10px;font-size:13px;font-family:inherit;outline:none;}'
    + '.alm-rep-fld.grow{flex:1;min-width:160px;}'
    + '.alm-rep-btn{border:none;border-radius:9px;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;font-weight:800;font-size:12.5px;padding:9px 16px;cursor:pointer;white-space:nowrap;}'
    + '.alm-rep-btn.sec{background:#f1f5f9;color:#475569;}'
    + '.alm-rep-summary{font-size:12px;color:#64748b;font-weight:700;margin-bottom:10px;}'
    + '.alm-rep-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}'
    + '.alm-rep-tbl th{text-align:left;font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#94a3b8;padding:7px 8px;border-bottom:2px solid #e6ebf2;position:sticky;top:0;background:#fff;}'
    + '.alm-rep-tbl td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;}'
    + '.alm-rep-tbl tr:hover td{background:#fafcff;}'
    + '.alm-rep-wrap{max-height:360px;overflow:auto;border:1px solid #e6ebf2;border-radius:10px;}'
    + '.alm-rep-firma{color:#0891b2;cursor:pointer;font-weight:700;text-decoration:underline;}'
    + '.alm-rep-tag{font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;letter-spacing:.3px;}'
    + '.alm-modal-box h4{margin:0 0 14px;font-size:15px;font-weight:800;color:#0f172a;display:flex;align-items:center;justify-content:space-between;}'
    + '.alm-modal-box h4 button{border:none;background:#f1f5f9;color:#475569;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1;}'
    + '.alm-hist-row{display:flex;flex-direction:column;gap:2px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;}'
    + '.alm-hist-row:last-child{border-bottom:none;}'
    + '.alm-hist-row .cambio{font-weight:800;color:#0f172a;}'
    + '.alm-hist-row .meta{color:#94a3b8;font-size:11px;}'
    + '.alm-modal-box img.alm-firma-full{max-width:100%;border:1px solid #e6ebf2;border-radius:10px;background:#fff;margin-bottom:14px;}'
    + '.alm-destino{margin-top:6px;display:flex;flex-direction:column;gap:3px;}'
    + '.alm-destino-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;border:1px solid;border-radius:99px;padding:4px 10px 4px 8px;width:fit-content;}'
    + '.alm-destino-chip.vacio{background:#f1f5f9;color:#94a3b8;border-color:#e6ebf2;}'
    + '.alm-destino-chip svg{flex-shrink:0;}'
    + '.alm-destino-sub{font-size:10.5px;color:#94a3b8;font-weight:700;margin-left:2px;}'
    + '.alm-destino-form{display:flex;flex-direction:column;gap:2px;}'
    + '.alm-destino-lbl{font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#64748b;margin-top:10px;margin-bottom:4px;}'
    + '.alm-destino-input{width:100%;padding:11px 13px;border:2px solid #e6ebf2;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;background:#fff;}'
    + '.alm-destino-caratula-prev{max-width:100%;max-height:140px;border:1px solid #e6ebf2;border-radius:8px;display:block;margin-top:4px;}'
    + '.alm-evid-block{margin-top:10px;border-top:1px dashed #e6ebf2;padding-top:8px;}'
    + '.alm-evid-block .lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;}'
    + '.alm-evid-grid{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}'
    + '.alm-evid-thumb{width:52px;height:52px;object-fit:cover;border-radius:8px;border:1px solid #e6ebf2;cursor:zoom-in;}'
    + '.alm-evid-add{border:1px dashed #cbd5e1;background:#fff;color:#475569;border-radius:8px;font-size:11.5px;font-weight:800;padding:6px 12px;cursor:pointer;}'
    + '@keyframes almPulse{0%{box-shadow:0 0 0 0 rgba(18,161,80,.5);}70%{box-shadow:0 0 0 8px rgba(18,161,80,0);}100%{box-shadow:0 0 0 0 rgba(18,161,80,0);}}'
    + '@keyframes almBlink{0%,100%{opacity:1;}50%{opacity:.55;}}'
    + '.alm-card.porvencer{animation:almBlinkWarn 1.3s infinite;}'
    + '.alm-card.vencido{animation:almBlinkDanger 1s infinite;}'
    + '@keyframes almBlinkWarn{0%,100%{box-shadow:0 0 0 0 rgba(217,144,0,0);}50%{box-shadow:0 0 0 4px rgba(217,144,0,.4);}}'
    + '@keyframes almBlinkDanger{0%,100%{box-shadow:0 0 0 0 rgba(226,59,59,0);}50%{box-shadow:0 0 0 5px rgba(226,59,59,.45);}}';
    var st=document.createElement('style'); st.id='alm-css'; st.textContent=css; document.head.appendChild(st);
  }

  // =====================================================================
  //  SHELL (toolbar fija) + RENDER de kpis/board
  // =====================================================================
  function contenedor(){ return document.getElementById(contId); }

  function construirModalHistorial(){
    if (document.getElementById('alm-modal-hist')) return;
    var ov=document.createElement('div');
    ov.id='alm-modal-hist';
    ov.className='alm-modal-ov';
    ov.innerHTML='<div class="alm-modal-box" id="alm-modal-hist-box"></div>';
    ov.addEventListener('click', function(e){ if(e.target===ov) window.__almCerrarModal(); });
    document.body.appendChild(ov);
  }

  function construirShell(){
    var cont=contenedor(); if(!cont) return;
    if (cont.querySelector('#alm-toolbar')) return; // ya construido → no perder foco del buscador
    var chips = '<span class="alm-fchip alm-fchip-prio on" data-prio="" onclick="window.__almPrio(\'\')">Todas</span>'
      + '<span class="alm-fchip alm-fchip-prio" data-prio="urgente" onclick="window.__almPrio(\'urgente\')">Urgentes</span>';
    var chipsTipo = '<span class="alm-fchip alm-fchip-tipo on" data-tipo="" onclick="window.__almTipo(\'\')">Todos</span>'
      + '<span class="alm-fchip alm-fchip-tipo" data-tipo="venta" onclick="window.__almTipo(\'venta\')">Venta</span>'
      + '<span class="alm-fchip alm-fchip-tipo" data-tipo="material" onclick="window.__almTipo(\'material\')">Material</span>';
    cont.innerHTML = '<div class="alm-wrap">'
      + '<div class="alm-bar" id="alm-toolbar">'
      +   '<span class="alm-live"><span class="p"></span>En vivo</span>'
      +   '<div class="alm-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      +     '<input id="alm-q" type="text" placeholder="Buscar folio, cliente o vendedor…" oninput="window.__almBuscar(this.value)"></div>'
      +   '<div class="alm-fchips">'+chipsTipo+'</div>'
      +   '<div class="alm-fchips">'+chips+'</div>'
      +   '<button id="alm-notif-btn" class="alm-notif-btn" title="Notificación sonora de pedidos nuevos" onclick="window.__almNotifToggle()">'+iconoCampana()+'</button>'
      +   (esAdminActual()?'<button class="alm-notif-btn" title="Fotos de catálogo (solo admin)" onclick="window.__almAbrirFotos()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>':'')
      +   '<button class="alm-notif-btn" title="Historial de entregas" onclick="window.__almAbrirHistorialEntregas()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H3v10h6"/><path d="M9 21h12V8l-5-5H9v6"/><line x1="13" y1="12" x2="17" y2="12"/><line x1="13" y1="16" x2="17" y2="16"/></svg></button>'
      +   '<button class="alm-notif-btn" title="KPIs de tiempos de surtido" onclick="window.__almAbrirKPIs()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>'
      + '</div>'
      + '<div class="alm-kpis" id="alm-kpis"></div>'
      + '<div class="alm-board" id="alm-board"></div>'
      + '</div>';
  }

  function render(){
    var cont=contenedor(); if(!cont) return;
    construirShell();
    var kpisEl=cont.querySelector('#alm-kpis'), boardEl=cont.querySelector('#alm-board');
    if(!kpisEl||!boardEl) return;

    var activos = pedidos.filter(function(p){ return p.estado!=='finalizado' && p.estado!=='cancelado'; });
    var visibles = activos.filter(pasaFiltro);

    var kPend=activos.filter(function(p){return p.estado==='pendiente';}).length;
    var kPrep=activos.filter(function(p){return p.estado==='en_preparacion';}).length;
    var enTiempo=activos.filter(enSLA).length;
    var retras=activos.length-enTiempo;
    var kPzas=activos.reduce(function(a,p){return a+piezas(p);},0);
    var h0=inicioDeHoy();
    var kFin=pedidos.filter(function(p){return p.estado==='finalizado'&&p.createdAt>=h0;}).length;

    kpisEl.innerHTML =
        kpi(COLORS.azul,  kPend,    'Por surtir')
      + kpi(COLORS.verde, kPrep,    'En surtido')
      + kpi(COLORS.verde, enTiempo, 'En SLA')
      + kpi(COLORS.rojo,  retras,   'Retrasados')
      + kpi('#0f172a',    kPzas,    'Piezas pendientes')
      + kpi(COLORS.teal,  kFin,     'Surtidos hoy');

    var html='';
    COLUMNAS.forEach(function(col){
      var lista=ordenar(visibles.filter(function(p){return p.estado===col.estado;}));
      html += '<div class="alm-col"><div class="alm-col-h">'
        + '<span class="t"><span class="a"><span class="dot" style="background:'+col.color+'"></span>'+col.titulo+'</span><span class="b">'+col.sub+'</span></span>'
        + '<span class="c">'+lista.length+'</span></div>';
      html += lista.length ? lista.map(tarjeta).join('') : '<div class="alm-empty">Sin pedidos</div>';
      html += '</div>';
    });
    boardEl.innerHTML=html;
  }

  function kpi(color,n,label){
    return '<div class="alm-kpi"><div class="bar" style="background:'+color+'"></div><div class="n">'+n+'</div><div class="l">'+label+'</div></div>';
  }

  function tarjeta(p){
    var ac=acento(p), pc=PRIO_COLOR[p.prioridad]||COLORS.azul;
    var urg=(p.prioridad==='urgente');
    var abierta=!!expandido[p.id];
    var sig=NEXT[p.estado];
    var prods=Array.isArray(p.productos)?p.productos:[];
    var total=prods.length, hechas=nChecked(p);
    var completo=(total>0 && hechas>=total);

    // Barra de progreso de surtido (sólo relevante en picking)
    var progHtml='';
    if (total>0 && (p.estado==='en_preparacion'||p.estado==='pendiente'||abierta)){
      var pct=total?Math.round(hechas/total*100):0;
      progHtml='<div class="alm-prog"><div class="lbl"><span>Surtido</span><span>'+hechas+'/'+total+' líneas</span></div>'
        + '<div class="track"><div class="fill" style="width:'+pct+'%"></div></div></div>';
    }

    var prodHtml='';
    if (abierta){
      prodHtml='<div class="alm-prod">'
        + (prods.length ? prods.map(function(it,idx){
            var on=!!(p.check&&p.check[idx]);
            return '<div class="alm-prow'+(on?' done':'')+'">'
              + '<button class="alm-check'+(on?' on':'')+'" onclick="window.__almCheck(\''+p.id+'\','+idx+')" title="Marcar surtido">'
              +   (on?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':'')
              + '</button>'
              + '<span class="k">'+esc(it.clave||'—')+'</span>'
              + '<span class="d">'+esc(it.desc||'')+'</span>'
              + '<span class="q">'+(Number(it.cant)||0)+'</span></div>';
          }).join('') : '<div class="alm-empty">Sin productos</div>')
        + '</div>';
      if (p.firma){
        prodHtml += '<div class="alm-firma-mini"><span class="lbl">Firma del solicitante</span>'
          + '<img src="'+esc(p.firma)+'" alt="Firma" onclick="window.__almVerFirma(\''+p.id+'\')"></div>';
      }
      if (p.firmaEntrega){
        prodHtml += '<div class="alm-firma-mini"><span class="lbl">Firma de entrega'+(p.recibioNombre?(' · recibió '+esc(p.recibioNombre)):'')+'</span>'
          + '<img src="'+esc(p.firmaEntrega)+'" alt="Firma de entrega" onclick="window.__almVerFirma(\''+p.id+'\',\'entrega\')"></div>';
      }
      prodHtml += '<div class="alm-evid-block"><span class="lbl">Evidencia de entrega</span>'
        + '<div class="alm-evid-grid" id="alm-evid-grid-'+p.id+'">'+renderEvidenciasThumbs(p)+'</div>'
        + '<button type="button" class="alm-evid-add" onclick="window.__almSubirEvidencia(\''+p.id+'\')">+ Agregar foto</button>'
        + '<input type="file" accept="image/*" capture="environment" id="alm-evid-file-'+p.id+'" style="display:none">'
        + '</div>';
    }

    var goCls='alm-btn alm-btn-go'+((p.estado==='en_preparacion'&&!completo)?' wait':'');
    var tipoTag='<span class="alm-tipo-tag '+(p.tipo==='material'?'mat':'ven')+'">'+(p.tipo==='material'?'Material':'Venta')+'</span>';
    var esperandoFirma = !!p.entregaPendienteFirma;
    var accionHtml = esperandoFirma
      ? '<button class="alm-btn alm-btn-ghost" title="Cancelar solicitud de firma" onclick="window.__almCancelarFirmaEntrega(\''+p.id+'\')" style="color:#dc2626;">✍️ Esperando firma… ✕</button>'
      : (sig?'<button class="'+goCls+'" onclick="window.__almGo(\''+p.id+'\')">'+esc(ACCION[p.estado]||'Avanzar')+' ›</button>':'');
    var slaCls = estadoSLA(p)==='retrasado' ? ' vencido' : (estadoSLA(p)==='porvencer' ? ' porvencer' : '');
    return '<div class="alm-card'+(urg?' urg':'')+slaCls+'" data-id="'+p.id+'" style="border-left-color:'+ac+'">'
      + '<div class="top"><span class="folio">'+esc(p.folio||'—')+'</span>'
      +   '<span class="alm-chip'+(urg?' urg':'')+'" style="background:'+pc+'">'+esc(PRIO_LABEL[p.prioridad]||p.prioridad||'Normal')+'</span></div>'
      + '<div class="cli">'+esc(p.cliente||'Sin cliente')+' '+tipoTag+'</div>'
      + '<div class="vend">Vendedor: '+esc(p.vendedor||'—')+'</div>'
      + destinoHtml(p)
      + '<div class="alm-meta"><span>⏱ <span class="alm-timer" data-id="'+p.id+'" style="color:'+ac+'">'+fmt(now()-p.createdAt)+'</span></span>'
      +   '<span><b>'+piezas(p)+'</b> pzas</span>'+(total?'<span><b>'+hechas+'</b>/'+total+' líneas</span>':'')+'</div>'
      + progHtml + prodHtml
      + '<div class="alm-actions">'
      +   (PREV[p.estado]?'<button class="alm-btn alm-btn-back" title="Regresar etapa" onclick="window.__almBack(\''+p.id+'\')">‹</button>':'')
      +   '<button class="alm-btn alm-btn-ghost" onclick="window.__almToggle(\''+p.id+'\')">'+(abierta?'Ocultar':'Ver')+'</button>'
      +   '<button class="alm-btn alm-btn-ghost" title="Ver historial" onclick="window.__almVerHistorial(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></button>'
      +   (!esperandoFirma&&p.estado!=='entregado'?'<button class="alm-btn alm-btn-ghost" title="Cancelar pedido" onclick="window.__almAbrirCancelar(\''+p.id+'\')" style="color:#dc2626;">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>':'')
      +   '<button class="alm-btn alm-btn-ghost" title="Imprimir etiqueta" onclick="window.__almImprimirEtiqueta(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>'
      +   (p.tienePdfOriginal?('<button class="alm-btn alm-btn-ghost" title="Ver PDF original" onclick="window.__almVerPDF(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button>'):'')
      +   accionHtml
      + '</div></div>';
  }

  function tickTimers(){
    revisarAlertasSLA();
    var cont=contenedor(); if(!cont) return;
    pedidos.forEach(function(p){
      if(p.estado==='finalizado') return;
      var el=cont.querySelector('.alm-timer[data-id="'+p.id+'"]');
      if(el) el.textContent=fmt(now()-p.createdAt);
    });
  }

  // =====================================================================
  //  ACCIONES → Firestore
  // =====================================================================
  function buscarP(id){ for(var i=0;i<pedidos.length;i++){ if(pedidos[i].id===id) return pedidos[i]; } return null; }

  function moverEstado(id,destino){
    var p=buscarP(id); if(!p||!destino) return;
    var origen=p.estado;
    cargarFirestore().then(function(fs){
      if(!window.db){ if(window.mostrarPush)window.mostrarPush('Almacén','Firestore no disponible','⚠️'); return; }
      var ref=fs.doc(window.db,'surtidos',id);
      return fs.updateDoc(ref,{estado:destino}).then(function(){
        try{
          fs.addDoc(fs.collection(window.db,'surtidos',id,'historial'),
            { de:origen, a:destino, por:yoNombre(), porEmail:yoEmail(), ts:fs.serverTimestamp() });
        }catch(e){}
        if(window.mostrarPush) window.mostrarPush('📦 Surtido', (p.folio||'')+' → '+destino.replace(/_/g,' '), '✅');
      });
    }).catch(function(err){ console.error('[almacen] moverEstado:',err); if(window.mostrarPush)window.mostrarPush('Almacén','No se pudo actualizar','⚠️'); });
  }

  function toggleCheck(id,idx){
    var p=buscarP(id); if(!p) return;
    var chk=Object.assign({},p.check||{});
    chk[idx]=!chk[idx];
    p.check=chk; render(); // respuesta inmediata (optimista)
    cargarFirestore().then(function(fs){
      if(!window.db) return;
      return fs.updateDoc(fs.doc(window.db,'surtidos',id),{check:chk});
    }).catch(function(err){ console.error('[almacen] check:',err); });
  }

  // ── Confirmación de entrega: Almacén SOLICITA la firma, quien recibe firma en el kiosko ──
  window.__almPedirFirmaEntrega = function(id){
    var p=buscarP(id); if(!p) return;
    cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('Firestore no disponible');
      return fs.updateDoc(fs.doc(window.db,'surtidos',id), {
        entregaPendienteFirma: true,
        entregaSolicitadaPor: yoNombre(),
        entregaSolicitadaEn: fs.serverTimestamp()
      });
    }).then(function(){
      if(window.mostrarPush) window.mostrarPush('📦 Esperando firma', (p.folio||'')+' · pídele a quien recibe que firme en el kiosko', '✍️');
    }).catch(function(err){
      console.error('[almacen] pedirFirmaEntrega:',err);
      if(window.mostrarPush) window.mostrarPush('Almacén','No se pudo enviar la solicitud de firma','⚠️');
    });
  };

  window.__almCancelarFirmaEntrega = function(id){
    cargarFirestore().then(function(fs){
      if(!window.db) return;
      return fs.updateDoc(fs.doc(window.db,'surtidos',id), { entregaPendienteFirma:false });
    }).catch(function(err){ console.error('[almacen] cancelarFirmaEntrega:',err); });
  };

  window.__almAbrirCancelar = function(id){
    var p=buscarP(id); if(!p) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.remove('wide');
    box.innerHTML='<h4>Cancelar pedido · '+esc(p.folio||'')+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div style="font-size:12.5px;color:#64748b;font-weight:700;margin-bottom:12px">'+esc(p.cliente||'')+' · '+piezas(p)+' piezas</div>'
      + '<label style="display:block;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#64748b;margin-bottom:6px">Motivo de cancelación *</label>'
      + '<textarea id="alm-cancel-motivo" placeholder="Ej. Cliente ya no lo requiere, pedido duplicado, error de captura…" style="width:100%;min-height:80px;padding:11px 13px;border:2px solid #e6ebf2;border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;"></textarea>'
      + '<div style="font-size:12.5px;font-weight:700;color:#dc2626;margin-top:8px" id="alm-cancel-msg"></div>'
      + '<div style="display:flex;gap:10px;margin-top:16px">'
      +   '<button type="button" onclick="window.__almCerrarModal()" style="flex:1;padding:12px;border:none;border-radius:11px;background:#f1f5f9;color:#475569;font-weight:800;font-size:13.5px;cursor:pointer">Volver</button>'
      +   '<button type="button" id="alm-cancel-ok" onclick="window.__almConfirmarCancelar(\''+id+'\')" style="flex:1;padding:12px;border:none;border-radius:11px;background:#dc2626;color:#fff;font-weight:800;font-size:13.5px;cursor:pointer">Cancelar pedido</button>'
      + '</div>';
    document.getElementById('alm-modal-hist').classList.add('show');
  };

  window.__almConfirmarCancelar = function(id){
    var p=buscarP(id); if(!p) return;
    var motivoEl=document.getElementById('alm-cancel-motivo');
    var motivo=(motivoEl&&motivoEl.value||'').trim();
    var msgEl=document.getElementById('alm-cancel-msg');
    if(!motivo){ if(msgEl) msgEl.textContent='Escribe el motivo de la cancelación.'; return; }
    var btn=document.getElementById('alm-cancel-ok'); if(btn){ btn.disabled=true; btn.textContent='Cancelando…'; }
    var origen=p.estado;
    cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('Firestore no disponible');
      return fs.updateDoc(fs.doc(window.db,'surtidos',id), {
        estado:'cancelado', motivoCancelacion:motivo, canceladoPor:yoNombre(), canceladoEn:fs.serverTimestamp()
      }).then(function(){
        try{
          fs.addDoc(fs.collection(window.db,'surtidos',id,'historial'),
            { de:origen, a:'cancelado', por:yoNombre(), porEmail:yoEmail(), motivo:motivo, ts:fs.serverTimestamp() });
        }catch(e){}
      });
    }).then(function(){
      if(window.mostrarPush) window.mostrarPush('✕ Pedido cancelado', (p.folio||''), '⚠️');
      window.__almCerrarModal();
    }).catch(function(err){
      console.error('[almacen] confirmarCancelar:',err);
      if(msgEl) msgEl.textContent='No se pudo cancelar. Intenta de nuevo.';
      if(btn){ btn.disabled=false; btn.textContent='Cancelar pedido'; }
    });
  };

  // Handlers globales
  window.__almGo     = function(id){
    var p=buscarP(id); if(!p) return;
    var destino = NEXT[p.estado];
    if(destino === 'entregado'){ window.__almPedirFirmaEntrega(id); return; }  // requiere firma de quien recibe, en el kiosko
    moverEstado(id,destino);
  };
  window.__almBack   = function(id){ var p=buscarP(id); if(p&&PREV[p.estado]) moverEstado(id,PREV[p.estado]); };
  window.__almToggle = function(id){
    expandido[id]=!expandido[id];
    render();
    if (expandido[id] && !_evidenciasCache[id]) cargarEvidencias(id).then(function(){ render(); });
  };
  window.__almCheck  = function(id,idx){ toggleCheck(id,idx); };
  window.__almBuscar = function(v){ filtro.q=v||''; render(); var i=document.getElementById('alm-q'); if(i){ i.focus(); i.value=filtro.q; } };
  window.__almPrio   = function(v){
    filtro.prio=v||'';
    var cont=contenedor(); if(cont){ cont.querySelectorAll('.alm-fchip-prio').forEach(function(el){ el.classList.toggle('on', (el.getAttribute('data-prio')||'')===filtro.prio); }); }
    render();
  };
  window.__almTipo   = function(v){
    filtro.tipo=v||'';
    var cont=contenedor(); if(cont){ cont.querySelectorAll('.alm-fchip-tipo').forEach(function(el){ el.classList.toggle('on', (el.getAttribute('data-tipo')||'')===filtro.tipo); }); }
    render();
  };

  window.__almCerrarModal = function(){
    var m=document.getElementById('alm-modal-hist');
    if(m) m.classList.remove('show');
  };

  window.__almVerFirma = function(id, cual){
    var p=buscarP(id); if(!p) return;
    var src = (cual==='entrega') ? p.firmaEntrega : p.firma;
    if(!src) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    var titulo = (cual==='entrega') ? ('Firma de entrega · '+esc(p.folio||'')+(p.recibioNombre?(' · recibió '+esc(p.recibioNombre)):'')) : ('Firma · '+esc(p.folio||''));
    box.innerHTML='<h4>'+titulo+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<img class="alm-firma-full" src="'+esc(src)+'" alt="Firma">';
    document.getElementById('alm-modal-hist').classList.add('show');
  };

  window.__almVerHistorial = function(id){
    var p=buscarP(id); if(!p) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.innerHTML='<h4>Historial · '+esc(p.folio||'')+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + (p.firma?'<img class="alm-firma-full" src="'+esc(p.firma)+'" alt="Firma">':'')
      + '<div id="alm-hist-list" class="alm-empty">Cargando…</div>';
    document.getElementById('alm-modal-hist').classList.add('show');

    cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('sin db');
      var col=fs.collection(window.db,'surtidos',id,'historial');
      var q; try{ q=fs.query(col, fs.orderBy('ts','asc')); }catch(e){ q=col; }
      return fs.getDocs(q);
    }).then(function(snap){
      var list=document.getElementById('alm-hist-list'); if(!list) return;
      if (snap.empty){ list.innerHTML='<div class="alm-empty">Sin cambios registrados todavía.</div>'; return; }
      var rows=[];
      snap.forEach(function(d){
        var h=d.data()||{};
        var fecha=toMs(h.ts); var fechaTxt=fecha?new Date(fecha).toLocaleString('es-MX'):'—';
        rows.push('<div class="alm-hist-row"><span class="cambio">'+esc((h.de||'—').replace(/_/g,' '))+' → '+esc((h.a||'—').replace(/_/g,' '))+'</span>'
          + '<span class="meta">'+esc(h.por||h.porEmail||'—')+' · '+esc(fechaTxt)+'</span></div>');
      });
      list.outerHTML='<div id="alm-hist-list">'+rows.join('')+'</div>';
    }).catch(function(err){
      console.error('[almacen] historial:',err);
      var list=document.getElementById('alm-hist-list'); if(list) list.innerHTML='<div class="alm-empty">No se pudo cargar el historial.</div>';
    });
  };

  // ── Panel de fotos de catálogo (solo admin) ──
  var _catalogo = null;       // [{clave,desc,precio}] — se carga una sola vez
  var _imgCache = {};         // key -> dataURL | null (null = ya se buscó, no hay)

  function keyProducto(it){ return ((it.clave||'')+'|'+(it.desc||'')).toLowerCase(); }
  /* Firestore no permite "/" dentro de un solo segmento de ruta (lo interpreta como sub-ruta) */
  function keyFirestore(k){ return k.replace(/\//g,'_'); }

  function cargarCatalogo(){
    if (_catalogo) return Promise.resolve(_catalogo);
    return cargarFirestore().then(function(fs){
      return fs.getDoc(fs.doc(window.db,'catalogo','productos')).then(function(snap){
        var d = snap.exists() ? (snap.data()||{}) : {};
        _catalogo = Array.isArray(d.items) ? d.items : [];
        return _catalogo;
      });
    });
  }

  window.__almAbrirFotos = function(){
    if (!esAdminActual()) return;
    construirModalHistorial();
    var box = document.getElementById('alm-modal-hist-box');
    box.classList.add('wide');
    box.innerHTML = '<h4>Fotos de catálogo<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div class="alm-fotos-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
      + '<input id="alm-fotos-q" type="text" placeholder="Busca un producto por nombre o clave…"></div>'
      + '<div id="alm-fotos-grid" class="alm-fotos-grid"><div class="alm-empty">Cargando catálogo…</div></div>'
      + '<input type="file" id="alm-fotos-file" accept="image/*" style="display:none">';
    document.getElementById('alm-modal-hist').classList.add('show');

    cargarCatalogo().then(function(){
      document.getElementById('alm-fotos-grid').innerHTML = '<div class="alm-empty">Escribe al menos 2 letras para buscar.</div>';
      document.getElementById('alm-fotos-q').addEventListener('input', function(){
        clearTimeout(window.__almFotosDeb);
        window.__almFotosDeb = setTimeout(function(){ renderGridFotos(this.value); }.bind(this), 120);
      });
    }).catch(function(err){
      document.getElementById('alm-fotos-grid').innerHTML = '<div class="alm-empty">No se pudo cargar el catálogo.</div>';
      console.error('[almacen] catálogo:',err);
    });
  };

  // Sobrescribe el cierre de modal para quitar la clase 'wide' al salir de este panel
  var _cerrarModalOrig = window.__almCerrarModal;
  window.__almCerrarModal = function(){
    var box=document.getElementById('alm-modal-hist-box'); if(box) box.classList.remove('wide');
    if (_cerrarModalOrig) _cerrarModalOrig();
  };

  function renderGridFotos(q){
    q = (q||'').trim().toLowerCase();
    var grid = document.getElementById('alm-fotos-grid'); if (!grid) return;
    if (q.length < 2){ grid.innerHTML = '<div class="alm-empty">Escribe al menos 2 letras para buscar.</div>'; return; }
    var res = (_catalogo||[]).filter(function(it){
      return (it.desc||'').toLowerCase().indexOf(q)!==-1 || (it.clave||'').toLowerCase().indexOf(q)!==-1;
    }).slice(0,24);
    if (!res.length){ grid.innerHTML = '<div class="alm-empty">Sin resultados.</div>'; return; }

    grid.innerHTML = res.map(function(it){
      var k = keyProducto(it);
      var cached = _imgCache[k];
      var thumb = cached ? '<img src="'+esc(cached)+'">' : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>';
      return '<div class="alm-fcard" data-k="'+esc(k)+'">'
        + '<div class="thumb">'+thumb+'</div>'
        + '<div class="d">'+esc(it.desc||'Sin descripción')+'</div>'
        + '<div class="k">'+(it.clave?('Clave '+esc(it.clave)):'Sin clave')+'</div>'
        + '<button type="button">'+(cached?'Cambiar foto':'Subir foto')+'</button>'
        + '</div>';
    }).join('');

    grid.querySelectorAll('.alm-fcard').forEach(function(card){
      var k = card.dataset.k;
      var it = res.find(function(r){ return keyProducto(r)===k; });
      card.querySelector('button').onclick = function(){ elegirFoto(k, card); };
      if (!(k in _imgCache)) buscarFotoExistente(k, card);
    });
  }

  function buscarFotoExistente(k, card){
    cargarFirestore().then(function(fs){
      return fs.getDoc(fs.doc(window.db,'catalogo','productos','imagenes',keyFirestore(k)));
    }).then(function(snap){
      var url = snap.exists() ? (snap.data()||{}).imagen : null;
      _imgCache[k] = url || null;
      if (url && card && card.isConnected){
        var thumb = card.querySelector('.thumb'); if (thumb) thumb.innerHTML = '<img src="'+esc(url)+'">';
        var btn = card.querySelector('button'); if (btn) btn.textContent = 'Cambiar foto';
      }
    }).catch(function(err){ console.warn('[almacen] foto existente:',err); });
  }

  function elegirFoto(k, card){
    var input = document.getElementById('alm-fotos-file'); if (!input) return;
    input.onchange = function(){
      var file = input.files && input.files[0]; input.value='';
      if (!file) return;
      var btn = card.querySelector('button');
      if (btn){ btn.disabled = true; btn.textContent = 'Subiendo…'; }
      comprimirImagen(file).then(function(dataUrl){
        return cargarFirestore().then(function(fs){
          return fs.setDoc(fs.doc(window.db,'catalogo','productos','imagenes',keyFirestore(k)), {
            imagen: dataUrl,
            actualizadoPor: (window.auth&&window.auth.currentUser?window.auth.currentUser.email:''),
            actualizado: fs.serverTimestamp()
          });
        }).then(function(){ return dataUrl; });
      }).then(function(dataUrl){
        _imgCache[k] = dataUrl;
        var thumb = card.querySelector('.thumb'); if (thumb) thumb.innerHTML = '<img src="'+esc(dataUrl)+'">';
        if (btn){ btn.disabled = false; btn.textContent = 'Cambiar foto'; }
      }).catch(function(err){
        console.error('[almacen] subir foto:',err);
        if (btn){ btn.disabled = false; btn.textContent = 'Reintentar'; }
      });
    };
    input.click();
  }

  function comprimirImagen(file){
    return new Promise(function(resolve,reject){
      var reader = new FileReader();
      reader.onload = function(e){
        var img = new Image();
        img.onload = function(){
          var maxW = 480;
          var scale = Math.min(1, maxW/img.width);
          var w = Math.max(1,Math.round(img.width*scale)), h = Math.max(1,Math.round(img.height*scale));
          var c = document.createElement('canvas'); c.width=w; c.height=h;
          var cx = c.getContext('2d');
          cx.fillStyle = '#ffffff'; cx.fillRect(0,0,w,h);
          cx.drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',0.72));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // =====================================================================
  //  CONEXIÓN EN VIVO
  // =====================================================================
  function suscribir(){
    if(_unsub) return;
    var cont=contenedor();
    if(cont && !cont.querySelector('#alm-toolbar')) cont.innerHTML='<div class="alm-loading">Conectando con Firestore…</div>';
    cargarFirestore().then(function(fs){
      if(!window.db){ if(cont) cont.innerHTML='<div class="alm-loading">Firestore no está inicializado (window.db).</div>'; return; }
      _unsub=fs.onSnapshot(fs.collection(window.db,'surtidos'),function(snap){
        var arr=[];
        var idsActuales={};
        snap.forEach(function(docu){
          var d=docu.data()||{};
          idsActuales[docu.id]=true;
          arr.push({
            id:docu.id,
            folio:d.folio||'—', cliente:d.cliente||'', vendedor:d.vendedor||'',
            prioridad:d.prioridad||'normal', estado:d.estado||'pendiente',
            productos:Array.isArray(d.productos)?d.productos:[],
            check:d.check||{},
            tipo:d.tipo||'venta', firma:d.firma||'', fechaEntrega:d.fechaEntrega||'',
            recibioNombre:d.recibioNombre||'', firmaEntrega:d.firmaEntrega||'',
            entregaPendienteFirma:!!d.entregaPendienteFirma,
            cotizacionOrigen:d.cotizacionOrigen||'', motivoCancelacion:d.motivoCancelacion||'',
            destinoTipo:d.destinoTipo||'', destinoPaqueteria:d.destinoPaqueteria||'', destinoGuia:d.destinoGuia||'',
            destinoDireccion:d.destinoDireccion||'', destinoAlmacenOrigen:d.destinoAlmacenOrigen||'', destinoAlmacenDestino:d.destinoAlmacenDestino||'',
            tienePdfOriginal:!!d.tienePdfOriginal,
            createdAt:toMs(d.createdAt)
          });
        });
        if(_conocidos===null){
          _conocidos = idsActuales;              // primera carga: no notificar nada retroactivo
        } else {
          arr.forEach(function(p){
            if(!_conocidos[p.id]) notificarPedidoNuevo(p);
          });
          _conocidos = idsActuales;
        }
        pedidos=arr; render();
      },function(err){ console.error('[almacen] onSnapshot:',err); if(cont) cont.innerHTML='<div class="alm-loading">Error al leer <b>surtidos</b>: '+esc(err.message||err)+'</div>'; });
    }).catch(function(err){ console.error('[almacen] Firestore load:',err); if(cont) cont.innerHTML='<div class="alm-loading">No se pudo cargar Firestore.</div>'; });
  }

  // =====================================================================
  //  ENTRADA PÚBLICA
  // =====================================================================
  window.abrirAlmacen=function(idContenedor){
    if(idContenedor) contId=idContenedor;
    inyectarCSS();
    suscribir();
    if(_unsub) render();   // reentrada al área: repinta de inmediato desde la caché
    if(!_tick) _tick=setInterval(tickTimers,1000);
  };

  // ── Historial de entregas: buscador por folio/cliente/solicitante/recibió + rango de fechas + exportar PDF ──
  var _repEntregas = null;   // caché de la última carga [{...}]

  function cargarEntregas(){
    return cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('Firestore no disponible');
      var q = fs.query(fs.collection(window.db,'surtidos'), fs.where('estado','in',['entregado','finalizado','cancelado']));
      return fs.getDocs(q);
    }).then(function(snap){
      var arr=[];
      snap.forEach(function(docu){
        var d=docu.data()||{};
        arr.push({
          id: docu.id,
          folio: d.folio||'—', cliente: d.cliente||'', tipo: d.tipo||'venta',
          estado: d.estado||'',
          solicito: d.tipo==='material' ? (d.solicitante||'—') : (d.vendedor||'—'),
          recibio: d.recibioNombre||'',
          motivoCancelacion: d.motivoCancelacion||'',
          firma: d.firma||'', firmaEntrega: d.firmaEntrega||'',
          creadoMs: toMs(d.createdAt),
          entregadoMs: d.entregadoEn ? toMs(d.entregadoEn) : null,
          canceladoMs: d.canceladoEn ? toMs(d.canceladoEn) : null,
          piezas: (Array.isArray(d.productos)?d.productos:[]).reduce(function(a,x){return a+(Number(x.cant)||0);},0),
          productos: Array.isArray(d.productos)?d.productos:[]
        });
      });
      arr.sort(function(a,b){ return (b.entregadoMs||b.canceladoMs||b.creadoMs)-(a.entregadoMs||a.canceladoMs||a.creadoMs); });
      _repEntregas = arr;
      return arr;
    });
  }

  function filtrarEntregas(lista, filtros){
    return lista.filter(function(e){
      var fechaRef = e.entregadoMs||e.canceladoMs||e.creadoMs;
      if(filtros.desde && fechaRef < filtros.desde) return false;
      if(filtros.hasta && fechaRef > filtros.hasta) return false;
      if(filtros.q){
        var blob=(e.folio+' '+e.cliente+' '+e.solicito+' '+e.recibio+' '+e.motivoCancelacion).toLowerCase();
        if(blob.indexOf(filtros.q)===-1) return false;
      }
      return true;
    });
  }

  function leerFiltrosReporte(){
    var dEl=document.getElementById('alm-rep-desde'), hEl=document.getElementById('alm-rep-hasta'), qEl=document.getElementById('alm-rep-q');
    var desde = dEl && dEl.value ? new Date(dEl.value+'T00:00:00').getTime() : null;
    var hasta = hEl && hEl.value ? new Date(hEl.value+'T23:59:59').getTime() : null;
    var q = qEl && qEl.value ? qEl.value.trim().toLowerCase() : '';
    return { desde:desde, hasta:hasta, q:q };
  }

  function fmtFecha(ms){ return ms ? new Date(ms).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) : '—'; }

  function renderTablaReporte(){
    if(!_repEntregas) return;
    var filtros = leerFiltrosReporte();
    var lista = filtrarEntregas(_repEntregas, filtros);
    var resumen = document.getElementById('alm-rep-resumen');
    if(resumen) resumen.textContent = lista.length + ' entrega'+(lista.length===1?'':'s')+' encontrada'+(lista.length===1?'':'s');
    var tbody = document.getElementById('alm-rep-tbody');
    if(!tbody) return;
    if(!lista.length){ tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Sin resultados para este filtro.</td></tr>'; return; }
    tbody.innerHTML = lista.map(function(e){
      var tag = e.tipo==='material'
        ? '<span class="alm-rep-tag" style="background:rgba(139,79,214,.12);color:#8B4FD6">MATERIAL</span>'
        : '<span class="alm-rep-tag" style="background:rgba(20,115,230,.1);color:#1473E6">VENTA</span>';
      var esCancelado = e.estado==='cancelado';
      var firmasHtml = ''
        + (e.firma ? '<span class="alm-rep-firma" onclick="window.__almVerFirmaId(\''+e.id+'\',\'sol\')">solicitud</span>' : '')
        + (e.firma && e.firmaEntrega ? ' · ' : '')
        + (e.firmaEntrega ? '<span class="alm-rep-firma" onclick="window.__almVerFirmaId(\''+e.id+'\',\'entrega\')">entrega</span>' : '')
        || '<span style="color:#cbd5e1">—</span>';
      var colRecibio = esCancelado
        ? '<span class="alm-rep-tag" style="background:rgba(220,38,38,.1);color:#dc2626">CANCELADO</span><br><span style="font-size:11px;color:#64748b">'+esc(e.motivoCancelacion||'—')+'</span>'
        : esc(e.recibio||'—');
      var colFechaFin = esCancelado ? fmtFecha(e.canceladoMs) : fmtFecha(e.entregadoMs);
      return '<tr>'
        + '<td><b>'+esc(e.folio)+'</b><br>'+tag+'</td>'
        + '<td>'+esc(e.cliente||'—')+'</td>'
        + '<td>'+esc(e.solicito||'—')+'</td>'
        + '<td>'+colRecibio+'</td>'
        + '<td>'+fmtFecha(e.creadoMs)+'</td>'
        + '<td>'+colFechaFin+'</td>'
        + '<td>'+e.piezas+' pzas'+(esCancelado?'':('<br>'+firmasHtml))+'</td>'
        + '</tr>';
    }).join('');
  }

  window.__almVerFirmaId = function(id, cual){
    var e = (_repEntregas||[]).find(function(x){ return x.id===id; });
    if(!e) return;
    var src = cual==='entrega' ? e.firmaEntrega : e.firma;
    if(!src) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.add('wide');
    var titulo = cual==='entrega' ? ('Firma de entrega · '+esc(e.folio)+(e.recibio?(' · recibió '+esc(e.recibio)):'')) : ('Firma de solicitud · '+esc(e.folio));
    box.innerHTML = '<h4>'+titulo+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<img class="alm-firma-full" src="'+esc(src)+'" alt="Firma">';
    document.getElementById('alm-modal-hist').classList.add('show');
  };

  window.__almAbrirHistorialEntregas = function(){
    construirModalHistorial();
    var box = document.getElementById('alm-modal-hist-box');
    box.classList.add('wide');
    box.innerHTML = '<h4>Historial de entregas<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div class="alm-rep-filtros">'
      +   '<div class="alm-rep-fld"><label>Desde</label><input type="date" id="alm-rep-desde"></div>'
      +   '<div class="alm-rep-fld"><label>Hasta</label><input type="date" id="alm-rep-hasta"></div>'
      +   '<div class="alm-rep-fld grow"><label>Buscar (folio, cliente, solicitó, recibió)</label><input type="text" id="alm-rep-q" placeholder="Ej. CHH0007635, Victor, Los Cachorros…"></div>'
      +   '<button class="alm-rep-btn sec" type="button" onclick="window.__almRecargarReporte()">↻ Recargar</button>'
      +   '<button class="alm-rep-btn" type="button" onclick="window.__almExportarReportePDF()">⬇ Exportar PDF</button>'
      + '</div>'
      + '<div class="alm-rep-summary" id="alm-rep-resumen">Cargando…</div>'
      + '<div class="alm-rep-wrap"><table class="alm-rep-tbl">'
      +   '<thead><tr><th>Folio</th><th>Cliente</th><th>Solicitó</th><th>Recibió / Motivo</th><th>Fecha solicitud</th><th>Fecha entrega / cancelación</th><th>Piezas / firmas</th></tr></thead>'
      +   '<tbody id="alm-rep-tbody"><tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Cargando…</td></tr></tbody>'
      + '</table></div>';
    document.getElementById('alm-modal-hist').classList.add('show');

    ['alm-rep-desde','alm-rep-hasta','alm-rep-q'].forEach(function(fid){
      document.getElementById(fid).addEventListener('input', function(){
        clearTimeout(window.__almRepDeb);
        window.__almRepDeb = setTimeout(renderTablaReporte, 150);
      });
    });
    window.__almRecargarReporte();
  };

  window.__almRecargarReporte = function(){
    var tbody = document.getElementById('alm-rep-tbody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px;">Cargando…</td></tr>';
    cargarEntregas().then(renderTablaReporte).catch(function(err){
      console.error('[almacen] cargarEntregas:',err);
      if(tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#dc2626;padding:20px;">No se pudo cargar el historial.</td></tr>';
    });
  };

  // ── KPIs de tiempos de surtido: % en SLA, promedio, desglose por persona y por día ──
  var SLA_MIN = { urgente:15, muy_alta:20, alta:30, normal:60, baja:120 };

  window.__almAbrirKPIs = function(){
    construirModalHistorial();
    var box = document.getElementById('alm-modal-hist-box');
    box.classList.add('wide');
    box.innerHTML = '<h4>KPIs de tiempos de surtido<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div class="alm-rep-filtros">'
      +   '<div class="alm-rep-fld"><label>Desde</label><input type="date" id="alm-kpi-desde"></div>'
      +   '<div class="alm-rep-fld"><label>Hasta</label><input type="date" id="alm-kpi-hasta"></div>'
      +   '<button class="alm-rep-btn sec" type="button" onclick="window.__almRecargarKPIs()">↻ Recargar</button>'
      + '</div>'
      + '<div id="alm-kpi-body"><div class="alm-empty">Cargando…</div></div>';
    document.getElementById('alm-modal-hist').classList.add('show');
    ['alm-kpi-desde','alm-kpi-hasta'].forEach(function(fid){
      document.getElementById(fid).addEventListener('input', renderKPIs);
    });
    window.__almRecargarKPIs();
  };

  window.__almRecargarKPIs = function(){
    var body=document.getElementById('alm-kpi-body');
    if(body) body.innerHTML='<div class="alm-empty">Cargando…</div>';
    cargarEntregas().then(renderKPIs).catch(function(err){
      console.error('[almacen] KPIs:',err);
      if(body) body.innerHTML='<div class="alm-empty">No se pudo cargar la información.</div>';
    });
  };

  function renderKPIs(){
    if(!_repEntregas) return;
    var dEl=document.getElementById('alm-kpi-desde'), hEl=document.getElementById('alm-kpi-hasta');
    var desde = dEl && dEl.value ? new Date(dEl.value+'T00:00:00').getTime() : null;
    var hasta = hEl && hEl.value ? new Date(hEl.value+'T23:59:59').getTime() : null;

    var entregados = _repEntregas.filter(function(e){
      if(e.estado!=='entregado' && e.estado!=='finalizado') return false;
      if(!e.entregadoMs) return false;
      var f = e.entregadoMs;
      if(desde && f<desde) return false;
      if(hasta && f>hasta) return false;
      return true;
    });

    var body=document.getElementById('alm-kpi-body'); if(!body) return;
    if(!entregados.length){ body.innerHTML='<div class="alm-empty">Sin entregas con datos de tiempo en este rango.</div>'; return; }

    var minutosArr = entregados.map(function(e){ return Math.max(0,(e.entregadoMs-e.creadoMs)/60000); });
    var promedioMin = minutosArr.reduce(function(a,b){return a+b;},0)/minutosArr.length;
    var enSLA = entregados.filter(function(e,i){ return minutosArr[i] <= (SLA_MIN[_repEntregasPrio(e)]||60); }).length;
    var pctSLA = Math.round((enSLA/entregados.length)*100);

    // Desglose por persona (solicitó)
    var porPersona = {};
    entregados.forEach(function(e,i){
      var k=e.solicito||'—';
      if(!porPersona[k]) porPersona[k]={n:0,sum:0};
      porPersona[k].n++; porPersona[k].sum+=minutosArr[i];
    });
    var filasPersona = Object.keys(porPersona).sort(function(a,b){ return porPersona[b].n-porPersona[a].n; }).map(function(k){
      var p=porPersona[k];
      return '<tr><td>'+esc(k)+'</td><td>'+p.n+'</td><td>'+Math.round(p.sum/p.n)+' min prom.</td></tr>';
    }).join('');

    // Pedidos por día
    var porDia = {};
    entregados.forEach(function(e){
      var k = new Date(e.entregadoMs).toLocaleDateString('es-MX',{day:'2-digit',month:'short'});
      porDia[k] = (porDia[k]||0)+1;
    });
    var diasOrdenados = Object.keys(porDia);
    var filasDia = diasOrdenados.map(function(k){ return '<tr><td>'+k+'</td><td>'+porDia[k]+' pedido'+(porDia[k]===1?'':'s')+'</td></tr>'; }).join('');

    body.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">'
      +   '<div class="alm-kpi"><div class="bar" style="background:'+COLORS.verde+'"></div><div class="n">'+pctSLA+'%</div><div class="l">Entregado dentro del SLA</div></div>'
      +   '<div class="alm-kpi"><div class="bar" style="background:'+COLORS.rojo+'"></div><div class="n">'+(100-pctSLA)+'%</div><div class="l">Fuera de SLA / retrasado</div></div>'
      +   '<div class="alm-kpi"><div class="bar" style="background:'+COLORS.azul+'"></div><div class="n">'+Math.round(promedioMin)+' min</div><div class="l">Tiempo promedio de surtido</div></div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">'
      +   '<div><div class="pq-sub" style="margin-bottom:8px;">POR SOLICITANTE / VENDEDOR</div>'
      +     '<div class="alm-rep-wrap" style="max-height:260px;"><table class="alm-rep-tbl"><thead><tr><th>Persona</th><th>Pedidos</th><th>Tiempo prom.</th></tr></thead><tbody>'+filasPersona+'</tbody></table></div></div>'
      +   '<div><div class="pq-sub" style="margin-bottom:8px;">PEDIDOS POR DÍA</div>'
      +     '<div class="alm-rep-wrap" style="max-height:260px;"><table class="alm-rep-tbl"><thead><tr><th>Día</th><th>Entregados</th></tr></thead><tbody>'+filasDia+'</tbody></table></div></div>'
      + '</div>';
  }

  function _repEntregasPrio(e){
    // La prioridad no se guarda en el objeto de reporte; se recupera del pedido en caché si aún existe
    var p = buscarP(e.id);
    return (p && p.prioridad) || 'normal';
  }

  // ── Impresión de etiqueta / orden de surtido (media carta, para pegar en la caja) ──
  window.__almImprimirEtiqueta = function(id){
    var p = buscarP(id); if(!p) return;
    if(!window.jspdf){ if(window.mostrarPush) window.mostrarPush('Almacén','Librería PDF no cargada','⚠️'); return; }
    var jsPDF = window.jspdf.jsPDF;
    var docu = new jsPDF({ orientation:'portrait', unit:'mm', format:[139.7,215.9] }); // media carta
    var PW=139.7, PH=215.9, ML=10, MR=10;

    docu.setFillColor(10,15,30); docu.rect(0,0,PW,22,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(13);
    docu.text('TECNOCONTROL', ML, 10);
    docu.setFont('helvetica','normal'); docu.setFontSize(8);
    docu.text('Orden de surtido', ML, 16);

    docu.setFillColor(p.tipo==='material'?139:20, p.tipo==='material'?79:115, p.tipo==='material'?214:230);
    docu.roundedRect(ML, 28, PW-ML-MR, 16, 3, 3, 'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(16);
    docu.text(String(p.folio||'—'), ML+5, 38);
    docu.setFontSize(9);
    docu.text(p.tipo==='material'?'MATERIAL':'VENTA', PW-MR-5, 38, {align:'right'});

    var y = 54;
    docu.setTextColor(30,41,59);
    function campo(label, valor){
      docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
      docu.text(label.toUpperCase(), ML, y);
      docu.setFont('helvetica','normal'); docu.setFontSize(11); docu.setTextColor(15,23,42);
      var lineas = docu.splitTextToSize(String(valor||'—'), PW-ML-MR);
      docu.text(lineas, ML, y+5.5);
      y += 6 + lineas.length*5.5;
    }
    campo('Cliente / destino', p.cliente);
    campo(p.tipo==='material'?'Solicitante':'Vendedor', p.vendedor);
    campo('Prioridad', (PRIO_LABEL[p.prioridad]||p.prioridad||'Normal'));
    if(p.fechaEntrega) campo('Fecha de entrega', p.fechaEntrega);
    if(p.destinoTipo){
      var destTxt = (DESTINO_TIPOS[p.destinoTipo]||p.destinoTipo);
      var destSub = destinoResumen(p);
      campo('Destino', destTxt + (destSub?(' — '+destSub):''));
    }
    if(p.cotizacionOrigen) campo('Cotización de origen', p.cotizacionOrigen);

    y += 2;
    docu.setDrawColor(226,232,240); docu.line(ML,y,PW-MR,y); y+=7;
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
    docu.text('ARTÍCULOS', ML, y); y+=6;
    var prods = Array.isArray(p.productos)?p.productos:[];
    docu.setFont('helvetica','normal'); docu.setFontSize(9); docu.setTextColor(15,23,42);
    prods.forEach(function(it){
      if(y > PH-18){ docu.addPage(); y=16; }
      var linea = (it.cant||0)+'x  '+(it.desc||'')+(it.clave?(' ('+it.clave+')'):'');
      var lns = docu.splitTextToSize(linea, PW-ML-MR);
      docu.text(lns, ML, y); y += lns.length*5.2+1.5;
    });
    if(!prods.length){ docu.text('Sin productos capturados.', ML, y); y+=6; }

    docu.setFillColor(10,15,30); docu.rect(0,PH-10,PW,10,'F');
    docu.setTextColor(180,180,180); docu.setFontSize(6.5);
    docu.text('Generado '+new Date().toLocaleString('es-MX'), PW/2, PH-4, {align:'center'});

    try{ window.open(docu.output('bloburl'), '_blank'); }
    catch(e){ docu.save('etiqueta-'+(p.folio||'surtido')+'.pdf'); }
  };

  window.__almExportarReportePDF = function(){
    if(!window.jspdf){ if(window.mostrarPush) window.mostrarPush('Almacén','Librería PDF no cargada','⚠️'); return; }
    var filtros = leerFiltrosReporte();
    var lista = filtrarEntregas(_repEntregas||[], filtros);
    var jsPDF = window.jspdf.jsPDF;
    var docu = new jsPDF({ orientation:'landscape', unit:'mm', format:'letter' });
    var PW=279.4, PH=215.9, ML=12, MR=12;

    function encabezado(){
      docu.setFillColor(10,15,30); docu.rect(0,0,PW,20,'F');
      docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(13);
      docu.text('TECNOCONTROL · Historial de Entregas', ML, 12);
      docu.setFont('helvetica','normal'); docu.setFontSize(8);
      var rango = (document.getElementById('alm-rep-desde').value||'—')+' a '+(document.getElementById('alm-rep-hasta').value||'—');
      docu.text('Rango: '+rango+'  ·  Generado: '+new Date().toLocaleString('es-MX'), PW-MR, 12, {align:'right'});
      docu.setTextColor(30,41,59);
    }
    function piePagina(n){
      docu.setFillColor(10,15,30); docu.rect(0,PH-9,PW,9,'F');
      docu.setTextColor(180,180,180); docu.setFontSize(7);
      docu.text('Página '+n+'  ·  '+lista.length+' registro(s)', PW/2, PH-4, {align:'center'});
    }
    function encabezadoTabla(y){
      docu.setFillColor(248,250,252); docu.rect(ML, y-4.5, PW-ML-MR, 7, 'F');
      docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(71,85,105);
      var cols=['FOLIO','TIPO','CLIENTE','SOLICITÓ','RECIBIÓ','F. SOLICITUD','F. ENTREGA','PZAS'];
      var xs=[ML+1, 40, 62, 108, 148, 188, 216, 248];
      cols.forEach(function(c,i){ docu.text(c, xs[i], y); });
      return xs;
    }

    var pageNum=1, y=30;
    encabezado(); var xs=encabezadoTabla(y); y+=7;
    docu.setFont('helvetica','normal'); docu.setFontSize(7.8); docu.setTextColor(30,41,59);

    lista.forEach(function(e){
      if(y > PH-16){ piePagina(pageNum); docu.addPage(); pageNum++; y=30; encabezado(); xs=encabezadoTabla(y); y+=7; docu.setFont('helvetica','normal'); docu.setFontSize(7.8); docu.setTextColor(30,41,59); }
      var esCancelado = e.estado==='cancelado';
      docu.text(String(e.folio||'—').slice(0,16), xs[0], y);
      docu.text(e.tipo==='material'?'Material':'Venta', xs[1], y);
      docu.text(String(e.cliente||'—').slice(0,22), xs[2], y);
      docu.text(String(e.solicito||'—').slice(0,18), xs[3], y);
      docu.text(esCancelado ? ('CANCELADO: '+String(e.motivoCancelacion||'—').slice(0,22)) : String(e.recibio||'—').slice(0,18), xs[4], y);
      docu.text(fmtFecha(e.creadoMs), xs[5], y);
      docu.text(esCancelado ? fmtFecha(e.canceladoMs) : fmtFecha(e.entregadoMs), xs[6], y);
      docu.text(String(e.piezas), xs[7], y);
      y += 6;
    });
    piePagina(pageNum);
    docu.save('historial-entregas-tecnocontrol.pdf');
  };

  console.log('[almacen.js] ✅ Centro de Surtido cargado (flujo + picking + SLA)');
})();
