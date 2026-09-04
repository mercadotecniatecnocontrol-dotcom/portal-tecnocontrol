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
  var ORIGEN_LABEL = { kiosco:'Kiosco (técnico en campo)', operaciones:'Operaciones', ventas:'Ventas' };
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
  var NEXT       = { esperando_autorizacion:'pendiente' };
  var PREV       = { pendiente:'esperando_autorizacion' };

  // Tablero simplificado a 2 columnas: Solicitud Recibida (incluye "en preparación")
  // y Entrega Parcial Pendiente. "Entregado" cierra el pedido y sale del tablero.
  var COLUMNAS = [
    { estados:['esperando_autorizacion','pendiente','en_preparacion'], titulo:'Solicitud Recibida', sub:'Por atender', color:COLORS.azul },
    { estados:['parcial'], titulo:'Entrega Parcial Pendiente', sub:'Falta completar', color:COLORS.naranja }
  ];
  var ACCION = {
    esperando_autorizacion:'Autorizar'
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
  var _storage = null;
  function cargarStorage(){
    if (_storage) return Promise.resolve(_storage);
    return import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js').then(function(m){
      _storage = { mod:m, storage: m.getStorage(window.app) };
      return _storage;
    });
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
  function fmt(ms){
    var s = Math.max(0, Math.floor(ms/1000));
    var dias = Math.floor(s/86400);
    var horas = Math.floor((s%86400)/3600);
    var min = Math.floor((s%3600)/60);
    var seg = s%60;
    function p2(n){ return String(n).padStart(2,'0'); }
    return (dias>0 ? dias+'d ' : '') + p2(horas)+':'+p2(min)+':'+p2(seg);
  }

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
    if (p.estado==='parcial')                return COLORS.naranja;
    var mins=(now()-p.createdAt)/60000, sla=SLA[p.prioridad]||30;
    if (mins>sla)               return COLORS.rojo;
    if (mins>SEMAFORO.naranja)  return COLORS.naranja;
    if (mins>SEMAFORO.amarillo) return COLORS.amarillo;
    if (p.estado==='en_preparacion') return COLORS.verde;
    return COLORS.azul;
  }
  // Clasificación de tiempo para las alertas: 'ok' | 'porvencer' | 'retrasado'
  function estadoSLA(p){
    if (['esperando_autorizacion','parcial','entregado','finalizado','cancelado'].indexOf(p.estado)!==-1) return 'ok';
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
    // Abrir la pestaña YA, en el mismo clic (si se espera a la consulta de Firestore
    // antes de abrirla, Safari y otros navegadores la bloquean por no verla "inmediata").
    var w = window.open('', '_blank');
    cargarFirestore().then(function(fs){
      if (!window.db) throw new Error('Firestore no disponible');
      return fs.getDoc(fs.doc(window.db,'surtidos',id,'adjuntos','pdf_original'));
    }).then(function(snap){
      if (!snap.exists() || !(snap.data()||{}).archivo){
        if (w) w.close();
        if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','Este pedido no tiene PDF adjunto todav\u00eda','\u26a0\ufe0f');
        return;
      }
      if (w){ w.document.write('<iframe src="'+(snap.data().archivo)+'" style="border:none;width:100%;height:100%;"></iframe>'); w.document.close(); }
    }).catch(function(err){
      console.error('[almacen] verPDF:',err);
      if (w) w.close();
      if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','No se pudo abrir el PDF','\u26a0\ufe0f');
    });
  };

  // ── Car\u00e1tula de env\u00edo profesional (capturada en Ventas, aqu\u00ed solo se ve/imprime) ──
  function filaCE(label, valor){ return '<tr><td class="ce-k">' + esc(label) + '</td><td class="ce-v">' + esc(valor || '\u2014') + '</td></tr>'; }
  var LOGO_TECNOCONTROL_B64 = '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';
  window.LOGO_TECNOCONTROL_B64 = LOGO_TECNOCONTROL_B64; // expuesto para que operaciones.js pueda usar el logo en sus PDFs de auditoría

  function construirCaratulaHTML(c){
    function fila(label, valor){ return '<tr><td class="ce-k">' + esc(label) + '</td><td class="ce-v">' + esc(valor || '\u2014') + '</td></tr>'; }
    var R = c.remitente || {}, D = c.destinatario || {};
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Car\u00e1tula de env\u00edo ' + esc(c.folio) + '</title><style>'
      + '@page{size:letter portrait;margin:12mm;}'
      + '*{box-sizing:border-box;}'
      + '*,*::before,*::after{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}'
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
      + '</body></html>';
  }
  window.__almVerCaratula = function(id){
    var p = buscarP(id); if (!p || !p.caratulaEnvio) return;
    var w = window.open();
    if (w){ w.document.write(construirCaratulaHTML(p.caratulaEnvio)); w.document.close(); }
  };

  // ── Documentos adicionales (\u00f3rdenes de compra, etc.) que Ventas adjunt\u00f3 al subir el pedido ──
  var _docsCache = {}; // id -> [{id,tipo,archivo,nombre,subidoPor}]
  window.__almVerDocumentos = function(id){
    cargarFirestore().then(function(fs){
      if (!window.db) throw new Error('Firestore no disponible');
      return fs.getDocs(fs.collection(window.db,'surtidos',id,'documentos'));
    }).then(function(snap){
      var items = [];
      snap.forEach(function(d){ items.push(Object.assign({id:d.id}, d.data())); });
      _docsCache[id] = items;
      construirModalHistorial();
      var box = document.getElementById('alm-modal-hist-box');
      box.classList.remove('wide');
      if (!items.length){
        box.innerHTML = '<h4>Documentos adjuntos<button onclick="window.__almCerrarModal()">&times;</button></h4><div class="alm-empty">Sin documentos adjuntos.</div>';
      } else {
        box.innerHTML = '<h4>Documentos adjuntos<button onclick="window.__almCerrarModal()">&times;</button></h4>'
          + '<div>' + items.map(function(it,idx){
              return '<div class="alm-doc-row"><span class="n">'+esc(it.nombre||('Documento '+(idx+1)))+'</span>'
                + '<button type="button" class="alm-rep-btn sec" onclick="window.__almVerUnDocumento(\''+id+'\','+idx+')">Ver</button></div>';
            }).join('') + '</div>';
      }
      document.getElementById('alm-modal-hist').classList.add('show');
    }).catch(function(err){
      console.error('[almacen] verDocumentos:',err);
      if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','No se pudieron cargar los documentos','\u26a0\ufe0f');
    });
  };
  window.__almVerUnDocumento = function(id, idx){
    var it = (_docsCache[id]||[])[idx]; if (!it || !it.archivo) return;
    var w = window.open();
    if (!w) return;
    if ((it.tipo||'')==='imagen') w.document.write('<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="'+it.archivo+'" style="max-width:100%;max-height:100vh;"></body>');
    else w.document.write('<iframe src="'+it.archivo+'" style="border:none;width:100%;height:100%;"></iframe>');
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
      if (ev.imagen){
        return '<img class="alm-evid-thumb" src="'+esc(ev.imagen)+'" onclick="window.__almVerEvidencia(\''+p.id+'\','+idx+')">';
      }
      return '<a href="'+esc(ev.url||'#')+'" target="_blank" class="alm-evid-thumb alm-evid-doc" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;color:#334155;background:#f8fafc;">'
        + '<span style="font-size:20px;">\ud83d\udcc4</span><span style="font-size:9px;text-align:center;padding:0 3px;word-break:break-word;">'+esc(ev.nombre||'Documento')+'</span></a>';
    }).join('');
  }
  window.__almSubirEvidencia = function(id){
    var input=document.getElementById('alm-evid-file-'+id); if (!input) return;
    input.onchange = function(){
      var file=input.files&&input.files[0]; input.value='';
      if (!file) return;
      var esImagen = file.type && file.type.indexOf('image/')===0;
      var subida = esImagen
        ? comprimirImagen(file).then(function(dataUrl){
            return cargarFirestore().then(function(fs){
              if (!window.db) throw new Error('Firestore no disponible');
              return fs.addDoc(fs.collection(window.db,'surtidos',id,'evidencias'), {
                tipo:'imagen', imagen:dataUrl, subidoPor:yoNombre(), subidoPorEmail:yoEmail(), subidoEn:fs.serverTimestamp()
              });
            });
          })
        // Documento (PDF/Word/etc.): va a Firebase Storage — un documento normal no cabe
        // en un documento de Firestore (límite 1MB), a diferencia de la foto comprimida.
        : cargarStorage().then(function(st){
            var ruta = 'evidencias/' + id + '/' + Date.now() + '_' + file.name;
            var sref = st.mod.ref(st.storage, ruta);
            return st.mod.uploadBytes(sref, file).then(function(){ return st.mod.getDownloadURL(sref); });
          }).then(function(url){
            return cargarFirestore().then(function(fs){
              if (!window.db) throw new Error('Firestore no disponible');
              return fs.addDoc(fs.collection(window.db,'surtidos',id,'evidencias'), {
                tipo:'archivo', nombre:file.name, url:url, mimeType:file.type||null,
                subidoPor:yoNombre(), subidoPorEmail:yoEmail(), subidoEn:fs.serverTimestamp()
              });
            });
          });
      subida.then(function(){
        delete _evidenciasCache[id];
        return cargarEvidencias(id);
      }).then(function(){
        render();
        if (window.mostrarPush) window.mostrarPush(esImagen?'📷 Evidencia agregada':'📄 Documento agregado','','✅');
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
    + '.tv-ruta-anim{stroke-dasharray:1 9;stroke-linecap:round;animation:almRutaFlow 900ms linear infinite;}'
    + '@keyframes almRutaFlow{to{stroke-dashoffset:-20;}}'
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
    + '.alm-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:11px;}'
    + '.alm-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;cursor:pointer;border-radius:9px;font-size:12.5px;font-weight:800;padding:9px 10px;transition:filter .12s;}'
    + '.alm-btn-icon{flex:0 0 34px;width:34px;height:34px;padding:0;}'
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
    + '.alm-mat-lista{margin-top:9px;border-top:1px dashed #e6ebf2;padding-top:8px;}'
    + '.alm-mat-lista .lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;}'
    + '.alm-mat-item{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#1e293b;padding:3px 0;}'
    + '.alm-mat-item .d{flex:1;}'
    + '.alm-mat-item .c{font-weight:800;color:#0f172a;white-space:nowrap;}'
    + '.alm-firma-mini{margin-top:10px;border-top:1px dashed #e6ebf2;padding-top:8px;}'
    + '.alm-firma-mini .lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;}'
    + '.alm-firma-mini img{max-width:100%;max-height:70px;border:1px solid #e6ebf2;border-radius:8px;background:#fff;cursor:zoom-in;display:block;}'
    + '.alm-modal-ov{display:none;position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9999;align-items:center;justify-content:center;padding:20px;}'
    + '.alm-modal-ov.show{display:flex;}'
    + '.alm-modal-box{background:#fff;border-radius:14px;max-width:480px;width:100%;max-height:82vh;overflow:auto;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,.25);}'
    + '.alm-modal-box.wide{max-width:1400px;width:96vw;max-height:90vh;}'
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
    + '.alm-rep-wrap{max-height:56vh;overflow:auto;border:1px solid #e6ebf2;border-radius:10px;}'
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
    + '.alm-doc-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;}'
    + '.alm-doc-row:last-child{border-bottom:none;}'
    + '.alm-doc-row .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155;font-weight:600;}'
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

  // ── Subir evidencia desde el celular: genera un enlace (+ QR) a una página
  // independiente (evidencia-salida.html) donde cualquiera con el link puede
  // fotografiar y subir evidencia de salida para ESTE pedido específico, sin
  // necesidad de entrar al portal completo desde el teléfono. ──
  window.__almAbrirLinkMovilEvidencia = function(id){
    var p = buscarP(id);
    var base = window.location.href.replace(/[^/]*$/, ''); // carpeta actual, sin el archivo
    var link = base + 'evidencia-salida.html?id=' + encodeURIComponent(id);
    var qrSrc = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(link);
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.remove('wide');
    box.innerHTML = '<h4>Subir evidencia desde el celular<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div style="text-align:center;padding:6px 0 14px;">'
      +   '<div style="font-size:12.5px;color:#64748b;margin-bottom:12px;">'+(p?('Folio <b>'+esc(p.folio)+'</b> — '):'')+'Escanea con la cámara del celular o comparte el enlace.</div>'
      +   '<img src="'+qrSrc+'" alt="Código QR" style="border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff;">'
      +   '<div style="margin-top:14px;display:flex;gap:6px;">'
      +     '<input type="text" readonly value="'+esc(link)+'" id="alm-link-evid-movil" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:11.5px;color:#475569;" onclick="this.select()">'
      +     '<button onclick="navigator.clipboard.writeText(document.getElementById(\'alm-link-evid-movil\').value).then(function(){ if(window.mostrarPush) window.mostrarPush(\'Enlace copiado\',\'\',\'📋\'); })" style="background:#f1f5f9;border:none;color:#334155;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;white-space:nowrap;">Copiar</button>'
      +   '</div>'
      +   '<a href="https://wa.me/?text='+encodeURIComponent('📷 Sube la evidencia de salida aquí: '+link)+'" target="_blank" style="display:inline-block;margin-top:10px;background:#25D366;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-size:12.5px;font-weight:600;">💬 Enviar por WhatsApp</a>'
      + '</div>';
    document.getElementById('alm-modal-hist').classList.add('show');
  };

  // ═══════════════════════════════════════════════════════════════════
  //  CATÁLOGO DE PAQUETERÍAS — reutiliza el mismo catálogo genérico
  //  puntos_referencia que ya usa almacen-pdf.js (tipo:'paqueteria'), a
  //  través de sus funciones ya expuestas (window.tcCargarCatalogoPuntos /
  //  window.tcGeocodificarDireccion) — no se duplica el catálogo ni la
  //  geocodificación. Al vivir en esa misma colección compartida, cualquier
  //  paquetería que se dé de alta aquí o desde Ventas se ve del otro lado
  //  automáticamente — no hay nada más que sincronizar.
  // ═══════════════════════════════════════════════════════════════════
  window.__almAbrirPaqueterias = function(){
    if (!window.tcCargarCatalogoPuntos){
      if (window.mostrarPush) window.mostrarPush('Almacén','El catálogo de puntos todavía está cargando — intenta de nuevo en un momento.','⚠️');
      return;
    }
    _almPaqCoordManual = null;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.add('wide');
    box.innerHTML = '<h4>📦 Catálogo de paqueterías<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div id="alm-paq-lista" style="max-height:260px;overflow-y:auto;margin-bottom:14px;"><div class="alm-empty">Cargando…</div></div>'
      + '<div style="border-top:1px dashed #e2e8f0;padding-top:12px;">'
      +   '<div style="font-weight:700;font-size:12.5px;color:#1e293b;margin-bottom:8px;">+ Registrar paquetería nueva</div>'
      +   '<input id="alm-paq-nombre" placeholder="Nombre (ej. Estafeta Sucursal Centro)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">'
      +   '<input id="alm-paq-dir" placeholder="Dirección (calle, colonia, ciudad)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">'
      +   '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;">'
      +     '<button type="button" class="alm-evid-add" onclick="window.__almPaqAgregar()">📍 Geocodificar por dirección</button>'
      +     '<button type="button" class="alm-evid-add" onclick="window.__almPaqMostrarMapa()">🗺️ Marcar en mapa</button>'
      +   '</div>'
      +   '<div id="alm-paq-mapa-wrap"></div>'
      +   '<div id="alm-paq-msg" style="font-size:11.5px;margin-top:6px;"></div>'
      + '</div>';
    document.getElementById('alm-modal-hist').classList.add('show');
    __almPaqRenderLista();
  };

  var _almPaqCoordManual = null;
  window.__almPaqMostrarMapa = function(){
    var wrap = document.getElementById('alm-paq-mapa-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div id="alm-paq-mapa" style="height:220px;border-radius:10px;overflow:hidden;margin-top:6px;"></div><div style="font-size:10.5px;color:#64748b;margin-top:4px;">Toca el mapa para marcar el punto exacto (se puede arrastrar el pin).</div>';
    cargarLeafletAlm().then(function(){
      var centro = _almPaqCoordManual ? [_almPaqCoordManual.lat, _almPaqCoordManual.lng] : [28.6353, -106.0889];
      var mapa = L.map('alm-paq-mapa').setView(centro, 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapa);
      var marcador = L.marker(centro, { draggable:true }).addTo(mapa);
      function actualizar(latlng){
        _almPaqCoordManual = { lat: latlng.lat, lng: latlng.lng };
        var msgEl = document.getElementById('alm-paq-msg');
        if (msgEl){ msgEl.textContent = '✓ Punto marcado: ' + latlng.lat.toFixed(5) + ', ' + latlng.lng.toFixed(5); msgEl.style.color = '#16a34a'; }
      }
      marcador.on('dragend', function(){ actualizar(marcador.getLatLng()); });
      mapa.on('click', function(e){ marcador.setLatLng(e.latlng); actualizar(e.latlng); });
      setTimeout(function(){ mapa.invalidateSize(); }, 80);
    }).catch(function(err){
      wrap.innerHTML = '<div style="font-size:11px;color:#dc2626;">No se pudo cargar el mapa: '+(err&&err.message||err)+'</div>';
    });
  };

  function __almPaqRenderLista(){
    var cont = document.getElementById('alm-paq-lista');
    if (!cont) return;
    window.tcCargarCatalogoPuntos().then(function(lista){
      var cont2 = document.getElementById('alm-paq-lista'); if (!cont2) return;
      var paqs = lista.filter(function(p){ return p.tipo === 'paqueteria'; });
      cont2.innerHTML = paqs.length ? paqs.map(function(p){
        return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #f1f5f9;">'
          + '<div style="min-width:0;"><div style="font-weight:700;font-size:12.5px;color:#1e293b;">'+esc(p.nombre)+'</div>'
          +   '<div style="font-size:11px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(p.direccion||'Sin dirección')+'</div></div>'
          + '<button type="button" onclick="window.__almPaqEliminar(\''+p.id+'\')" style="flex-shrink:0;background:#fef2f2;border:none;color:#dc2626;padding:5px 9px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;">Eliminar</button>'
          + '</div>';
      }).join('') : '<div class="alm-empty">Aún no hay paqueterías registradas.</div>';
    });
  }

  window.__almPaqAgregar = function(){
    var nombre = (document.getElementById('alm-paq-nombre')||{}).value || '';
    var direccion = (document.getElementById('alm-paq-dir')||{}).value || '';
    nombre = nombre.trim(); direccion = direccion.trim();
    var msgEl = document.getElementById('alm-paq-msg');
    if (!nombre){ if (msgEl){ msgEl.textContent = 'Falta el nombre.'; msgEl.style.color = '#dc2626'; } return; }
    // Si ya se marcó un punto en el mapa, se usa ese en vez de geocodificar la dirección escrita.
    var coordPromesa = _almPaqCoordManual ? Promise.resolve(_almPaqCoordManual) : (function(){
      if (!direccion){ if (msgEl){ msgEl.textContent = 'Falta la dirección (o marca el punto en el mapa).'; msgEl.style.color = '#dc2626'; } return Promise.resolve(null); }
      if (msgEl){ msgEl.textContent = 'Geocodificando…'; msgEl.style.color = '#0e7490'; }
      return window.tcGeocodificarDireccion(direccion);
    })();
    coordPromesa.then(function(coord){
      if (!coord){ if (msgEl && msgEl.textContent.indexOf('Falta')===-1){ msgEl.textContent = 'No se encontró la dirección — revísala o marca el punto en el mapa.'; msgEl.style.color = '#dc2626'; } return; }
      return cargarFirestore().then(function(fs){
        if (!window.db) throw new Error('Firestore no disponible');
        return fs.addDoc(fs.collection(window.db,'puntos_referencia'), {
          nombre: nombre, tipo: 'paqueteria', direccion: direccion, lat: coord.lat, lng: coord.lng,
          creadoPor: yoNombre(), creadoEn: new Date().toISOString()
        });
      }).then(function(){
        if (window.__almInvalidarCachePuntos) window.__almInvalidarCachePuntos();
        _almPaqCoordManual = null;
        document.getElementById('alm-paq-nombre').value = '';
        document.getElementById('alm-paq-dir').value = '';
        document.getElementById('alm-paq-mapa-wrap').innerHTML = '';
        if (msgEl){ msgEl.textContent = '✓ Guardada'; msgEl.style.color = '#16a34a'; }
        __almPaqRenderLista();
      });
    }).catch(function(err){
      console.error('[almacen] paqueteria agregar:', err);
      if (msgEl){ msgEl.textContent = 'No se pudo guardar: ' + (err && err.message || err); msgEl.style.color = '#dc2626'; }
    });
  };

  window.__almPaqEliminar = function(id){
    if (!confirm('¿Eliminar esta paquetería del catálogo?')) return;
    cargarFirestore().then(function(fs){
      if (!window.db) throw new Error('Firestore no disponible');
      return fs.deleteDoc(fs.doc(window.db,'puntos_referencia',id));
    }).then(function(){
      if (window.__almInvalidarCachePuntos) window.__almInvalidarCachePuntos();
      __almPaqRenderLista();
    }).catch(function(err){
      console.error('[almacen] paqueteria eliminar:', err);
      if (window.mostrarPush) window.mostrarPush('Almacén','No se pudo eliminar','⚠️');
    });
  };

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
      +   '<button class="alm-notif-btn" title="Logística y Rutas (Chihuahua)" onclick="window.__logAbrirLogistica && window.__logAbrirLogistica()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></button>'
      +   '<button class="alm-notif-btn" title="Catálogo de paqueterías" onclick="window.__almAbrirPaqueterias()">📦</button>'
      +   '<button class="alm-notif-btn" title="KPIs de tiempos de surtido" onclick="window.__almAbrirKPIs()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></button>'
      +   '<button class="alm-notif-btn" title="Cumplea\u00f1os del equipo (para la TV)" onclick="window.__almAbrirCumpleanos()"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="12" width="16" height="8" rx="1"/><path d="M4 16h16"/><path d="M8 12V9a1 1 0 0 1 2 0v3"/><path d="M14 12V9a1 1 0 0 1 2 0v3"/><path d="M9 6c0-1 1-1 1-2s-1-1-1-2"/><path d="M15 6c0-1 1-1 1-2s-1-1-1-2"/></svg></button>'
      + '</div>'
      + '<div class="alm-kpis" id="alm-kpis"></div>'
      + '<div style="display:flex;gap:14px;align-items:flex-start;">'
      +   '<div class="alm-board" id="alm-board" style="flex:1;min-width:0;"></div>'
      +   '<div id="alm-mapa-rutas-panel" style="flex:0 0 32%;min-width:340px;background:#fff;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;position:sticky;top:0;box-shadow:0 1px 3px rgba(0,0,0,0.06);">'
      +     '<div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">'
      +       '<span style="font-weight:700;font-size:13px;color:#1e293b;">🗺️ Rutas pendientes</span>'
      +       '<button onclick="window.__almRefrescarMapaEmbed()" title="Actualizar" style="background:#f1f5f9;border:none;color:#475569;width:24px;height:24px;border-radius:6px;cursor:pointer;font-size:12px;">↻</button>'
      +     '</div>'
      +     '<div id="alm-mapa-rutas-embed" style="height:560px;position:relative;"></div>'
      +     '<div id="alm-mapa-rutas-embed-leyenda" style="padding:8px 12px;font-size:10.5px;color:#334155;display:flex;flex-wrap:wrap;gap:6px 10px;border-top:1px solid #e2e8f0;"></div>'
      +   '</div>'
      + '</div>'
      + '</div>';
  }

  var _almMapaEmbedIniciado = false;
  function render(){
    var cont=contenedor(); if(!cont) return;
    construirShell();
    if(!_almMapaEmbedIniciado && cont.querySelector('#alm-mapa-rutas-embed')){
      _almMapaEmbedIniciado = true;
      window.__almRefrescarMapaEmbed();
    }
    var kpisEl=cont.querySelector('#alm-kpis'), boardEl=cont.querySelector('#alm-board');
    if(!kpisEl||!boardEl) return;

    var activos = pedidos.filter(function(p){ return ['finalizado','cancelado','entregado'].indexOf(p.estado)===-1; });
    var visibles = activos.filter(pasaFiltro);

    var kRecibidos = activos.filter(function(p){ return ['esperando_autorizacion','pendiente','en_preparacion'].indexOf(p.estado)!==-1; }).length;
    var kParcial = activos.filter(function(p){ return p.estado==='parcial'; }).length;
    var enTiempo=activos.filter(enSLA).length;
    var retras=activos.length-enTiempo;
    var kPzas=activos.reduce(function(a,p){return a+piezas(p);},0);
    var h0=inicioDeHoy();
    var kEntregadosHoy = pedidos.filter(function(p){ return p.estado==='entregado' && p.entregadoEn>=h0; }).length;

    kpisEl.innerHTML =
        kpi(COLORS.azul,    kRecibidos, 'Solicitud recibida')
      + kpi(COLORS.naranja, kParcial,   'Entrega parcial')
      + kpi(COLORS.verde,   enTiempo,   'En SLA')
      + kpi(COLORS.rojo,    retras,     'Retrasados')
      + kpi('#0f172a',      kPzas,      'Piezas pendientes')
      + kpi(COLORS.teal,    kEntregadosHoy, 'Entregados hoy');

    var html='';
    COLUMNAS.forEach(function(col){
      var lista=ordenar(visibles.filter(function(p){return col.estados.indexOf(p.estado)!==-1;}));
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
    var prods=Array.isArray(p.productos)?p.productos:[];
    var total=prods.length;

    // El detalle de productos ya no se captura desde Ventas (se valida abriendo el PDF),
    // así que en Ventas solo mostramos firma y evidencia al expandir — nada de checklist.
    // Las solicitudes de MATERIAL sí traen el detalle completo (kiosco / Operaciones),
    // así que aquí SIEMPRE se muestra la lista de artículos: es el resumen que Almacén
    // necesita para saber qué surtir, sin depender de un PDF externo.
    var prodHtml='';
    if (p.tipo==='material' && prods.length){
      prodHtml += '<div class="alm-mat-lista"><span class="lbl">Artículos solicitados ('+total+')</span>'
        + prods.map(function(it){
            return '<div class="alm-mat-item"><span class="d">'+esc(it.desc||'—')+(it.clave?(' <span style="color:#94a3b8;">('+esc(it.clave)+')</span>'):'')+'</span><span class="c">×'+esc(it.cant||0)+'</span></div>';
          }).join('')
        + '</div>';
    }
    if (abierta){
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
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:2px;">'
        +   '<button type="button" class="alm-evid-add" onclick="window.__almSubirEvidencia(\''+p.id+'\')">+ Agregar foto o documento</button>'
        +   (p.remisionado
              ? '<span style="font-size:11px;font-weight:700;color:#16a34a;">✓ Remisionado'+(p.remisionadoPor?(' · '+esc(p.remisionadoPor)):'')+'</span>'
              : '<button type="button" class="alm-evid-add" style="border-style:solid;border-color:#16a34a;color:#16a34a;" onclick="window.__almConfirmarRemision(\''+p.id+'\')">✅ Confirmar y remisionar</button>')
        + '</div>'
        + '<input type="file" accept="image/*,.pdf,.doc,.docx" id="alm-evid-file-'+p.id+'" style="display:none">'
        + '</div>';
    }

    var goCls='alm-btn alm-btn-go';
    var tipoTag='<span class="alm-tipo-tag '+(p.tipo==='material'?'mat':'ven')+'">'+(p.tipo==='material'?'Material':'Venta')+'</span>';
    var esperandoFirma = !!p.entregaPendienteFirma;
    var accionHtml = '';
    if (esperandoFirma){
      accionHtml = '<button class="alm-btn alm-btn-ghost" title="Cancelar solicitud de firma" onclick="window.__almCancelarFirmaEntrega(\''+p.id+'\')" style="color:#dc2626;">✍️ Esperando firma… ✕</button>';
    } else if (p.estado==='esperando_autorizacion'){
      accionHtml = '<button class="'+goCls+'" onclick="window.__almGo(\''+p.id+'\')">Autorizar ›</button>';
    } else if (p.estado==='pendiente'){
      accionHtml = '<button class="'+goCls+'" onclick="window.__almDescargarPDF(\''+p.id+'\')">'+(p.tienePdfOriginal?'📥 Descargar PDF':'▶️ Iniciar preparación')+'</button>';
    } else if (p.estado==='en_preparacion'){
      accionHtml = '<button class="'+goCls+'" onclick="window.__almAbrirEntrega(\''+p.id+'\')">✅ Entregar pedido</button>';
    } else if (p.estado==='parcial'){
      accionHtml = '<button class="'+goCls+'" onclick="window.__almAbrirEntrega(\''+p.id+'\')">✅ Completar entrega</button>';
    }
    var badgePrep = (p.estado==='en_preparacion') ? '<span class="alm-tipo-tag" style="background:#eff6ff;color:#1473E6;">En preparación</span>' : '';
    var slaCls = estadoSLA(p)==='retrasado' ? ' vencido' : (estadoSLA(p)==='porvencer' ? ' porvencer' : '');
    return '<div class="alm-card'+(urg?' urg':'')+slaCls+'" data-id="'+p.id+'" style="border-left-color:'+ac+'">'
      + '<div class="top"><span class="folio">'+esc(p.folio||'—')+'</span>'
      +   '<span class="alm-chip'+(urg?' urg':'')+'" style="background:'+pc+'">'+esc(PRIO_LABEL[p.prioridad]||p.prioridad||'Normal')+'</span></div>'
      + '<div class="cli">'+esc(p.cliente||'Sin cliente')+' '+tipoTag+badgePrep+'</div>'
      + '<div class="vend">Vendedor: '+esc(p.vendedor||'—')+'</div>'
      + destinoHtml(p)
      + (p.comentariosAlmacen ? ('<div class="alm-destino"><span class="alm-destino-chip" style="background:#8B4FD61c;color:#8B4FD6;border-color:#8B4FD655;">\ud83d\udcac '+esc(p.comentariosAlmacen)+'</span></div>') : '')
      + (p.entregaObservaciones ? ('<div class="alm-destino"><span class="alm-destino-chip" style="background:#F26B211c;color:#F26B21;border-color:#F26B2155;">⚠ '+esc(p.entregaObservaciones)+'</span></div>') : '')
      + '<div class="alm-meta"><span>⏱ <span class="alm-timer" data-id="'+p.id+'" style="color:'+ac+'">'+fmt(now()-p.createdAt)+'</span></span>'
      +   (total?('<span><b>'+piezas(p)+'</b> pzas</span>'):'')+'</div>'
      + prodHtml
      + '<div class="alm-actions">'
      +   (PREV[p.estado]?'<button class="alm-btn alm-btn-back" title="Regresar etapa" onclick="window.__almBack(\''+p.id+'\')">‹</button>':'')
      +   '<button class="alm-btn alm-btn-ghost" onclick="window.__almToggle(\''+p.id+'\')">'+(abierta?'Ocultar':'Ver')+'</button>'
      +   '<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Ver historial" onclick="window.__almVerHistorial(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></button>'
      +   (!esperandoFirma?'<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Cancelar pedido" onclick="window.__almAbrirCancelar(\''+p.id+'\')" style="color:#dc2626;">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>':'')
      +   (p.tienePdfOriginal?('<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Ver PDF original" onclick="window.__almVerPDF(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></button>'):'')
      +   (p.numOrdenesCompra?('<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Documentos adjuntos ('+p.numOrdenesCompra+')" onclick="window.__almVerDocumentos(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>'):'')
      +   (p.caratulaEnvio?('<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Ver car\u00e1tula de env\u00edo" onclick="window.__almVerCaratula(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></button>'):'')
      +   (p.tipo==='material'?('<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Imprimir solicitud (PDF)" onclick="window.__almImprimirSolicitudMaterial(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>'):'')
      +   (p.tipo==='material'?('<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Enviar por WhatsApp" onclick="window.__almWhatsAppSolicitudMaterial(\''+p.id+'\')" style="color:#25D366;">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.85 1h.005a7.94 7.94 0 0 0 5.55-13.6zm-5.55 12.2h-.003a6.6 6.6 0 0 1-3.37-.92l-.24-.14-2.5.65.67-2.44-.16-.25a6.58 6.58 0 0 1 10.2-8.18 6.55 6.55 0 0 1 1.94 4.66 6.6 6.6 0 0 1-6.53 6.62zm3.6-4.93c-.2-.1-1.17-.58-1.35-.64s-.31-.1-.44.1-.5.64-.62.77-.23.15-.43.05a5.4 5.4 0 0 1-1.59-.98 6 6 0 0 1-1.1-1.37c-.12-.2 0-.3.09-.4s.2-.23.29-.35a1.3 1.3 0 0 0 .2-.33.37.37 0 0 0 0-.35c0-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.33h-.37a.72.72 0 0 0-.52.24 2.2 2.2 0 0 0-.68 1.63 3.8 3.8 0 0 0 .8 2.02 8.7 8.7 0 0 0 3.33 2.95c.46.2.82.32 1.1.4.46.15.88.13 1.21.08.37-.06 1.17-.48 1.33-.94s.16-.86.11-.94-.18-.13-.38-.23z"/></svg></button>'):'')
      +   '<button class="alm-btn alm-btn-ghost alm-btn-icon" title="Subir evidencia desde el celular (QR / enlace)" onclick="window.__almAbrirLinkMovilEvidencia(\''+p.id+'\')" style="color:#0e7490;">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/></svg></button>'
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

  // ── Confirmar y remisionar: marca el pedido como formalmente remisionado y
  //    deja un registro en `pedido_notificaciones` dirigido a quien lo generó
  //    (vendedor o solicitante), mismo patrón que ya usa flotilla_notificaciones
  //    en este portal — no se inventa un mecanismo nuevo de notificación.
  //    OJO: hoy nada en Ventas está escuchando esta colección todavía — el
  //    aviso queda registrado y listo para que Ventas lo muestre en cuanto
  //    se agregue ahí un listener, pero por ahora no llega como push real. ──
  window.__almConfirmarRemision = function(id){
    var p = buscarP(id);
    var eHist = (_repEntregas||[]).find(function(x){ return x.id===id; });
    var ref = p || eHist; if (!ref) return;
    if (!confirm('¿Confirmar y remisionar el pedido '+(ref.folio||'')+'?')) return;
    cargarFirestore().then(function(fs){
      if (!window.db) throw new Error('Firestore no disponible');
      return fs.updateDoc(fs.doc(window.db,'surtidos',id), {
        remisionado: true, remisionadoPor: yoNombre(), remisionadoPorEmail: yoEmail(), remisionadoEn: fs.serverTimestamp()
      }).then(function(){
        return fs.addDoc(fs.collection(window.db,'pedido_notificaciones'), {
          surtidoId: id, folio: ref.folio || null,
          destinatarioNombre: ref.solicitante || ref.solicito || ref.vendedor || null,
          destinatarioEmail: ref.solicitanteEmail || null,
          tipo: 'remisionado',
          mensaje: 'Tu pedido ' + (ref.folio||'') + ' fue confirmado y remisionado por Almacén.',
          leido: false, creadoPor: yoNombre(), creadoEn: fs.serverTimestamp()
        }).catch(function(err){ console.warn('[almacen] no se pudo registrar la notificación:', err); });
      });
    }).then(function(){
      if (p){ p.remisionado = true; p.remisionadoPor = yoNombre(); render(); }
      if (eHist){ eHist.remisionado = true; eHist.remisionadoPor = yoNombre(); if (document.getElementById('alm-hist-evid-'+id)) window.__almVerDetalleHistorial(id); if (document.getElementById('alm-rep-tbody')) renderTablaReporte(); }
      if (window.mostrarPush) window.mostrarPush('✅ Remisionado', (ref.folio||''), '✅');
    }).catch(function(err){
      console.error('[almacen] confirmarRemision:', err);
      if (window.mostrarPush) window.mostrarPush('Almacén','No se pudo confirmar la remisión','⚠️');
    });
  };

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

  // ── "Descargar PDF" en Solicitud Recibida: abre el PDF (si existe) y avanza a "en preparación" automáticamente ──
  window.__almDescargarPDF = function(id){
    var p=buscarP(id); if(!p) return;
    var origen=p.estado;
    if (p.tienePdfOriginal) window.__almVerPDF(id);
    cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('Firestore no disponible');
      return fs.updateDoc(fs.doc(window.db,'surtidos',id), {estado:'en_preparacion'}).then(function(){
        try{
          fs.addDoc(fs.collection(window.db,'surtidos',id,'historial'),
            { de:origen, a:'en_preparacion', por:yoNombre(), porEmail:yoEmail(), ts:fs.serverTimestamp() });
        }catch(e){}
      });
    }).catch(function(err){
      console.error('[almacen] descargarPDF:',err);
      if(window.mostrarPush) window.mostrarPush('Almac\u00e9n','No se pudo iniciar la preparaci\u00f3n','\u26a0\ufe0f');
    });
  };

  // ── Entregar pedido: evidencia + observaciones + completo/parcial ──
  window.__almAbrirEntrega = function(id){
    var p=buscarP(id); if(!p) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.remove('wide');
    box.innerHTML='<h4>Entregar pedido · '+esc(p.folio||'')+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div style="font-size:12.5px;color:#64748b;font-weight:700;margin-bottom:12px">'+esc(p.cliente||'')+' \u00b7 '+piezas(p)+' piezas</div>'
      + '<div class="alm-evid-block" style="border-top:none;padding-top:0;"><span class="lbl">Evidencia fotogr\u00e1fica (embarque / entrega)</span>'
      +   '<div class="alm-evid-grid" id="alm-evid-grid-'+p.id+'">'+renderEvidenciasThumbs(p)+'</div>'
      +   '<button type="button" class="alm-evid-add" onclick="window.__almSubirEvidencia(\''+p.id+'\')">+ Agregar foto o documento</button>'
      +   '<input type="file" accept="image/*,.pdf,.doc,.docx" id="alm-evid-file-'+p.id+'" style="display:none">'
      + '</div>'
      + '<label style="display:block;font-size:11px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#64748b;margin:14px 0 6px">Observaciones</label>'
      + '<textarea id="alm-entrega-obs" placeholder="Ej. Se entreg\u00f3 completo / falta 1 pieza que se enviar\u00e1 despu\u00e9s\u2026" style="width:100%;min-height:70px;padding:11px 13px;border:2px solid #e6ebf2;border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">'+esc(p.entregaObservaciones||'')+'</textarea>'
      + '<label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:12.5px;font-weight:700;color:#334155;cursor:pointer;"><input type="checkbox" id="alm-entrega-firma"> Solicitar firma de quien recibe (en el kiosko)</label>'
      + '<div style="font-size:12.5px;font-weight:700;color:#dc2626;margin-top:8px" id="alm-entrega-msg"></div>'
      + '<div style="display:flex;gap:10px;margin-top:16px">'
      +   '<button type="button" id="alm-entrega-parcial" onclick="window.__almGuardarEntrega(\''+p.id+'\', false)" style="flex:1;padding:12px;border:none;border-radius:11px;background:#F26B21;color:#fff;font-weight:800;font-size:13px;cursor:pointer">Entrega parcial</button>'
      +   '<button type="button" id="alm-entrega-completa" onclick="window.__almGuardarEntrega(\''+p.id+'\', true)" style="flex:1;padding:12px;border:none;border-radius:11px;background:#12A150;color:#fff;font-weight:800;font-size:13px;cursor:pointer">Entrega completa</button>'
      + '</div>';
    document.getElementById('alm-modal-hist').classList.add('show');
    if (!_evidenciasCache[id]){
      cargarEvidencias(id).then(function(){
        var g=document.getElementById('alm-evid-grid-'+id); if(g) g.innerHTML=renderEvidenciasThumbs(buscarP(id));
      });
    }
  };

  window.__almGuardarEntrega = function(id, completo){
    var p=buscarP(id); if(!p) return;
    var obsEl=document.getElementById('alm-entrega-obs');
    var obs=(obsEl&&obsEl.value||'').trim();
    if (!completo && !obs){
      var msgEl=document.getElementById('alm-entrega-msg');
      if(msgEl) msgEl.textContent='Escribe qu\u00e9 falta por entregar.';
      return;
    }
    var pedirFirma = !!(document.getElementById('alm-entrega-firma')||{}).checked;
    var nuevoEstado = completo ? 'entregado' : 'parcial';
    var origen = p.estado;
    var btnP=document.getElementById('alm-entrega-parcial'), btnC=document.getElementById('alm-entrega-completa');
    if(btnP) btnP.disabled=true; if(btnC) btnC.disabled=true;
    cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('Firestore no disponible');
      var datos={ estado:nuevoEstado, entregaObservaciones:obs };
      if (completo) datos.entregadoEn = fs.serverTimestamp();
      return fs.updateDoc(fs.doc(window.db,'surtidos',id), datos).then(function(){
        try{
          fs.addDoc(fs.collection(window.db,'surtidos',id,'historial'),
            { de:origen, a:nuevoEstado, por:yoNombre(), porEmail:yoEmail(), nota:obs, ts:fs.serverTimestamp() });
        }catch(e){}
        if (pedirFirma) window.__almPedirFirmaEntrega(id);
      });
    }).then(function(){
      if(window.mostrarPush) window.mostrarPush(completo?'\u2705 Pedido entregado':'\ud83d\udce6 Entrega parcial registrada', (p.folio||''), completo?'\u2705':'\u26a0\ufe0f');
      window.__almCerrarModal();
    }).catch(function(err){
      console.error('[almacen] guardarEntrega:',err);
      var msgEl=document.getElementById('alm-entrega-msg');
      if(msgEl) msgEl.textContent='No se pudo registrar. Intenta de nuevo.';
      if(btnP) btnP.disabled=false; if(btnC) btnC.disabled=false;
    });
  };

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
            tienePdfOriginal:!!d.tienePdfOriginal, numOrdenesCompra:Number(d.numOrdenesCompra)||0,
            caratulaEnvio:d.caratulaEnvio||null,
            entregaObservaciones:d.entregaObservaciones||'', entregadoEn: d.entregadoEn ? toMs(d.entregadoEn) : 0,
            comentariosAlmacen:d.comentariosAlmacen||'',
            // Campos propios de Solicitud de Material (origen 'operaciones'/'kiosco') —
            // sin esto, _almConstruirPDFSolicitudMaterial / _almResumenTextoSolicitud
            // reciben el pedido "recortado" de esta caché en vez del documento completo
            // y el PDF/WhatsApp salen con Área, Uso y Folio de servicio en blanco.
            solicitante:d.solicitante||'', area:d.area||'', uso:d.uso||'', destino:d.destino||'',
            folioServicio:d.folioServicio||'', origen:d.origen||'',
            tecnicoId:d.tecnicoId||'', tecnicoNumero:d.tecnicoNumero||'', tecnicoNombre:d.tecnicoNombre||'',
            folioNum:d.folioNum||'', folioPrefijo:d.folioPrefijo||'',
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
          productos: Array.isArray(d.productos)?d.productos:[],
          remisionado: !!d.remisionado, remisionadoPor: d.remisionadoPor||''
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
        + (e.firma ? '<span class="alm-rep-firma" onclick="event.stopPropagation();window.__almVerFirmaId(\''+e.id+'\',\'sol\')">solicitud</span>' : '')
        + (e.firma && e.firmaEntrega ? ' · ' : '')
        + (e.firmaEntrega ? '<span class="alm-rep-firma" onclick="event.stopPropagation();window.__almVerFirmaId(\''+e.id+'\',\'entrega\')">entrega</span>' : '')
        || '<span style="color:#cbd5e1">—</span>';
      var colRecibio = esCancelado
        ? '<span class="alm-rep-tag" style="background:rgba(220,38,38,.1);color:#dc2626">CANCELADO</span><br><span style="font-size:11px;color:#64748b">'+esc(e.motivoCancelacion||'—')+'</span>'
        : esc(e.recibio||'—');
      var colFechaFin = esCancelado ? fmtFecha(e.canceladoMs) : fmtFecha(e.entregadoMs);
      var accionesHtml = '<div style="display:flex;flex-direction:column;gap:4px;margin-top:6px;align-items:flex-start;">'
        + '<button type="button" onclick="event.stopPropagation();window.__almSubirEvidencia(\''+e.id+'\');setTimeout(function(){window.__almRefrescarEvidHist(\''+e.id+'\');},1200);" style="border:1px dashed #cbd5e1;background:#fff;color:#475569;border-radius:6px;font-size:10.5px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap;">+ Evidencia</button>'
        + (e.remisionado
            ? '<span style="font-size:10.5px;font-weight:700;color:#16a34a;white-space:nowrap;">✓ Remisionado</span>'
            : '<button type="button" onclick="event.stopPropagation();window.__almConfirmarRemision(\''+e.id+'\')" style="border:1px solid #16a34a;background:#fff;color:#16a34a;border-radius:6px;font-size:10.5px;font-weight:700;padding:3px 8px;cursor:pointer;white-space:nowrap;">✅ Remisionar</button>')
        + '</div>'
        + '<input type="file" accept="image/*,.pdf,.doc,.docx" id="alm-evid-file-'+e.id+'" style="display:none">';
      return '<tr style="cursor:pointer;" onclick="window.__almVerDetalleHistorial(\''+e.id+'\')" title="Ver detalle completo">'
        + '<td><b>'+esc(e.folio)+'</b><br>'+tag+accionesHtml+'</td>'
        + '<td>'+esc(e.cliente||'—')+'</td>'
        + '<td>'+esc(e.solicito||'—')+'</td>'
        + '<td>'+colRecibio+'</td>'
        + '<td>'+fmtFecha(e.creadoMs)+'</td>'
        + '<td>'+colFechaFin+'</td>'
        + '<td>'+e.piezas+' pzas'+(esCancelado?'':('<br>'+firmasHtml))+'</td>'
        + '</tr>';
    }).join('');
  }

  // ── Ventana emergente con el detalle completo de una solicitud del historial:
  // productos, firmas y evidencia de entrega (fotos), en una sola vista. ──
  window.__almVerDetalleHistorial = function(id){
    var e = (_repEntregas||[]).find(function(x){ return x.id===id; });
    if(!e) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.classList.add('wide');
    var esCancelado = e.estado==='cancelado';
    box.innerHTML = '<h4>'+esc(e.folio)+' · '+(e.tipo==='material'?'Material':'Venta')+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<div style="font-size:13px;color:#334155;line-height:1.9;margin-bottom:12px;">'
      +   '<div><strong>Cliente:</strong> '+esc(e.cliente||'—')+'</div>'
      +   '<div><strong>Solicitó:</strong> '+esc(e.solicito||'—')+'</div>'
      +   (esCancelado
            ? '<div><strong>Cancelado:</strong> '+fmtFecha(e.canceladoMs)+' · '+esc(e.motivoCancelacion||'—')+'</div>'
            : '<div><strong>Recibió:</strong> '+esc(e.recibio||'—')+' · <strong>Entregado:</strong> '+fmtFecha(e.entregadoMs)+'</div>')
      +   '<div><strong>Fecha de solicitud:</strong> '+fmtFecha(e.creadoMs)+'</div>'
      + '</div>'
      + '<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Artículos ('+e.piezas+' pzas)</div>'
      + '<div style="margin-bottom:14px;">'
      +   (e.productos.length ? e.productos.map(function(it){
            return '<div style="display:flex;justify-content:space-between;font-size:12.5px;color:#1e293b;padding:3px 0;border-bottom:1px solid #f1f5f9;"><span>'+esc(it.desc||'—')+(it.clave?(' <span style="color:#94a3b8;">('+esc(it.clave)+')</span>'):'')+'</span><span style="font-weight:700;">×'+esc(it.cant||0)+'</span></div>';
          }).join('') : '<div style="color:#94a3b8;font-size:12px;">Sin artículos capturados.</div>')
      + '</div>'
      + (e.firma ? '<div style="margin-bottom:10px;"><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px;">FIRMA DEL SOLICITANTE</div><img src="'+esc(e.firma)+'" style="max-width:220px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;" onclick="window.__almVerFirmaId(\''+e.id+'\',\'sol\')"></div>' : '')
      + (e.firmaEntrega ? '<div style="margin-bottom:14px;"><div style="font-size:11px;font-weight:700;color:#94a3b8;margin-bottom:4px;">FIRMA DE ENTREGA</div><img src="'+esc(e.firmaEntrega)+'" style="max-width:220px;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;" onclick="window.__almVerFirmaId(\''+e.id+'\',\'entrega\')"></div>' : '')
      + '<div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Evidencia de entrega'+(e.remisionado?' · <span style="color:#16a34a;">✓ Remisionado</span>':'')+'</div>'
      + '<div class="alm-evid-grid" id="alm-hist-evid-'+e.id+'"><div style="color:#94a3b8;font-size:12px;">Cargando…</div></div>';
    document.getElementById('alm-modal-hist').classList.add('show');
    window.__almRefrescarEvidHist(e.id);
  };

  window.__almRefrescarEvidHist = function(id){
    delete _evidenciasCache[id];
    cargarEvidencias(id).then(function(list){
      var cont=document.getElementById('alm-hist-evid-'+id);
      if(!cont) return; // el modal ya se cerró
      cont.innerHTML = list.length
        ? list.map(function(ev){
            if (ev.imagen) return '<img class="alm-evid-thumb" src="'+esc(ev.imagen)+'" onclick="window.open(this.src,\'_blank\')">';
            return '<a href="'+esc(ev.url||'#')+'" target="_blank" class="alm-evid-thumb alm-evid-doc" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;color:#334155;background:#f8fafc;"><span style="font-size:20px;">📄</span><span style="font-size:9px;text-align:center;padding:0 3px;word-break:break-word;">'+esc(ev.nombre||'Documento')+'</span></a>';
          }).join('')
        : '<div style="color:#94a3b8;font-size:12px;">Sin evidencias.</div>';
    });
  };

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

  // =====================================================================
  //  CUMPLEAÑOS DEL EQUIPO — alimenta la decoración de la TV (pedidos-almacen.html)
  // =====================================================================
  var _cumpleCache = null;
  function cargarCumpleanos(){
    if (_cumpleCache) return Promise.resolve(_cumpleCache);
    return cargarFirestore().then(function(fs){
      if (!window.db) { _cumpleCache=[]; return []; }
      return fs.getDoc(fs.doc(window.db,'config','cumpleanos')).then(function(snap){
        var lista = (snap.exists() && Array.isArray((snap.data()||{}).lista)) ? snap.data().lista : [];
        _cumpleCache = lista;
        return lista;
      });
    }).catch(function(){ _cumpleCache=[]; return []; });
  }
  function guardarCumpleanos(lista){
    return cargarFirestore().then(function(fs){
      if (!window.db) throw new Error('Firestore no disponible');
      return fs.setDoc(fs.doc(window.db,'config','cumpleanos'), { lista:lista }, { merge:false });
    }).then(function(){ _cumpleCache = lista; });
  }
  // ═══════════════════════════════════════════════════════════════════
  //  MAPA DE RUTAS EN ALMACÉN — panel embebido permanente (3ra columna,
  //  igual que en la pantalla de TV), NO modal. Usa
  //  window.tcObtenerPuntosLogisticos() (logistica.js) — la única fuente
  //  de esta información en todo el portal — así que las categorías y
  //  colores son siempre los mismos, se vea desde donde se vea.
  // ═══════════════════════════════════════════════════════════════════
  var _almMapaLeaflet = null, _almMapaMarkers = [], _almMapaLineas = [];
  var _almTruckMarkers = [], _almTruckAnimId = null;
  function _almIconoCamion(color){
    var c = color || '#0f172a';
    return L.divIcon({
      className:'',
      html:'<div style="width:20px;height:20px;background:'+c+';border-radius:6px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.4);">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'
        + '</div>',
      iconSize:[20,20], iconAnchor:[10,10]
    });
  }
  function _almIniciarCamiones(rutas){
    if (_almTruckAnimId){ cancelAnimationFrame(_almTruckAnimId); _almTruckAnimId=null; }
    _almTruckMarkers.forEach(function(t){ t.marker.remove(); });
    _almTruckMarkers = rutas.map(function(r){
      return { origen:r.origen, destino:r.destino, marker: L.marker(r.origen, {icon:_almIconoCamion(r.color), interactive:false, zIndexOffset:500}).addTo(_almMapaLeaflet) };
    });
    if (!_almTruckMarkers.length) return;
    var DURACION_MS = 7000;
    function paso(ts){
      var fase = (ts % DURACION_MS) / DURACION_MS;
      _almTruckMarkers.forEach(function(t){
        var lat = t.origen[0] + (t.destino[0]-t.origen[0])*fase;
        var lng = t.origen[1] + (t.destino[1]-t.origen[1])*fase;
        t.marker.setLatLng([lat,lng]);
      });
      _almTruckAnimId = requestAnimationFrame(paso);
    }
    _almTruckAnimId = requestAnimationFrame(paso);
  }
  window.__almRefrescarMapaEmbed = function(){
    var cont = document.getElementById('alm-mapa-rutas-embed');
    if(!cont) return; // el panel no está en el DOM todavía (pantalla de Almacén no abierta)
    if(!window.tcObtenerPuntosLogisticos){
      cont.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;font-size:12px;text-align:center;padding:12px;">El módulo de Logística (logistica.js) todavía está cargando…</div>';
      return;
    }
    cargarLeafletAlm().then(function(){
      return window.tcObtenerPuntosLogisticos({ incluirClientes: true });
    }).then(function(puntos){
      var contAhora = document.getElementById('alm-mapa-rutas-embed');
      if(!contAhora) return; // se cerró/recargó la pantalla mientras cargaba
      if(!_almMapaLeaflet){
        _almMapaLeaflet = L.map('alm-mapa-rutas-embed', {zoomControl:false}).setView([28.63,-106.07], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_almMapaLeaflet);
      }
      _almMapaMarkers.forEach(function(m){ m.remove(); });
      _almMapaMarkers = [];
      _almMapaLineas.forEach(function(l){ l.remove(); });
      _almMapaLineas = [];
      var ESTILO = {
        venta:{color:'#1473E6',label:'Pedido de Ventas'}, material:{color:'#8B4FD6',label:'Solicitud de Material'},
        traslado:{color:'#D99000',label:'Traspaso entre almacenes'}, tecnico:{color:'#0FB5A6',label:'Entrega a técnico'},
        paqueteria:{color:'#F26B21',label:'Paquetería'}, recoleccion:{color:'#DB2777',label:'Recolección'},
        cliente:{color:'#64748B',label:'Cliente de Ventas'}
      };
      var rutasParaCamion = [];
      // Líneas primero, así los pines quedan encima.
      puntos.forEach(function(p){
        if (!p.ruta || !p.origen) return;
        var est = ESTILO[p.categoria] || ESTILO.venta;
        var l = L.polyline([p.origen, [p.lat,p.lng]], { color:est.color, weight:2, opacity:0.5, className:'tv-ruta-anim', interactive:false }).addTo(_almMapaLeaflet);
        _almMapaLineas.push(l);
        rutasParaCamion.push({ origen:p.origen, destino:[p.lat,p.lng], color:est.color });
      });
      _almIniciarCamiones(rutasParaCamion);
      var usados = {};
      puntos.forEach(function(p){
        var est = ESTILO[p.categoria] || ESTILO.venta;
        usados[p.categoria] = est;
        var m = L.circleMarker([p.lat,p.lng], {radius:7, color:est.color, fillColor:est.color, fillOpacity:0.85, weight:2}).addTo(_almMapaLeaflet);
        m.bindPopup('<b style="color:'+est.color+'">'+est.label+'</b><br>'+(p.popupHtml||''));
        _almMapaMarkers.push(m);
      });
      var leyEl = document.getElementById('alm-mapa-rutas-embed-leyenda');
      if(leyEl){
        var keys = Object.keys(usados);
        leyEl.innerHTML = keys.length ? keys.map(function(k){
          var e = usados[k];
          return '<span style="display:flex;align-items:center;gap:4px;"><span style="width:8px;height:8px;border-radius:50%;background:'+e.color+';display:inline-block;"></span>'+e.label+'</span>';
        }).join('') : '<span style="color:#94a3b8;">Sin pendientes ubicados ahora mismo.</span>';
      }
      var todosLosPuntos = puntos.map(function(p){return [p.lat,p.lng];}).concat(rutasParaCamion.map(function(r){return r.origen;}));
      if(todosLosPuntos.length) _almMapaLeaflet.fitBounds(todosLosPuntos, {padding:[24,24]});
      setTimeout(function(){ if(_almMapaLeaflet) _almMapaLeaflet.invalidateSize(); }, 80);
    }).catch(function(err){
      console.error('[almacen] mapa de rutas:', err);
      var c2 = document.getElementById('alm-mapa-rutas-embed');
      if(c2) c2.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#dc2626;font-size:12px;">No se pudo cargar el mapa.</div>';
    });
  };
  function cargarLeafletAlm(){
    if(window.L) return Promise.resolve(window.L);
    if(!document.querySelector('link[href*="leaflet"]')){
      var link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    return new Promise(function(resolve, reject){
      var s = document.createElement('script');
      s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload = function(){ resolve(window.L); };
      s.onerror = function(){ reject(new Error('No se pudo cargar Leaflet')); };
      document.head.appendChild(s);
    });
  }

  window.__almAbrirCumpleanos = function(){
    cargarCumpleanos().then(function(lista){
      construirModalHistorial();
      var box=document.getElementById('alm-modal-hist-box');
      box.classList.remove('wide');
      var filas = lista.map(function(c,idx){
        var dd = String(c.dia||'').padStart(2,'0'), mm = String(c.mes||'').padStart(2,'0');
        return '<div class="alm-doc-row"><span class="n">'+esc(c.nombre||'—')+' \u00b7 '+dd+'/'+mm+'</span>'
          + '<button type="button" class="alm-rep-btn sec" style="color:#dc2626;" onclick="window.__almQuitarCumpleanos('+idx+')">Quitar</button></div>';
      }).join('') || '<div class="alm-empty">A\u00fan no hay cumplea\u00f1os registrados.</div>';
      box.innerHTML = '<h4>\ud83c\udf82 Cumplea\u00f1os del equipo<button onclick="window.__almCerrarModal()">&times;</button></h4>'
        + '<div style="font-size:12px;color:#64748b;margin-bottom:10px;">El d\u00eda que le toque a alguien, la TV de Almac\u00e9n lo muestra con un detalle discreto en la franja de abajo.</div>'
        + '<div id="alm-cumple-lista">'+filas+'</div>'
        + '<button type="button" class="alm-addrow" style="margin-top:10px;" onclick="window.__almAgregarCumpleanos()">+ Agregar cumplea\u00f1os</button>';
      document.getElementById('alm-modal-hist').classList.add('show');
    });
  };
  window.__almAgregarCumpleanos = function(){
    var nombre = prompt('Nombre de la persona:');
    if (!nombre || !nombre.trim()) return;
    var fecha = prompt('Fecha de cumplea\u00f1os (formato DD/MM, ej. 24/12):');
    if (!fecha) return;
    var partes = fecha.split('/');
    var dia = parseInt(partes[0],10), mes = parseInt(partes[1],10);
    if (!dia || !mes || dia<1 || dia>31 || mes<1 || mes>12){
      alert('Fecha no v\u00e1lida. Usa el formato D\u00cdA/MES, por ejemplo 24/12.');
      return;
    }
    cargarCumpleanos().then(function(lista){
      var nueva = lista.concat([{ nombre:nombre.trim(), dia:dia, mes:mes }]);
      return guardarCumpleanos(nueva);
    }).then(function(){
      if (window.mostrarPush) window.mostrarPush('\ud83c\udf82 Cumplea\u00f1os agregado', nombre.trim(), '\u2705');
      window.__almAbrirCumpleanos();
    }).catch(function(err){
      console.error('[almacen] agregarCumpleanos:',err);
      if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','No se pudo guardar','\u26a0\ufe0f');
    });
  };
  window.__almQuitarCumpleanos = function(idx){
    cargarCumpleanos().then(function(lista){
      var nueva = lista.slice(); nueva.splice(idx,1);
      return guardarCumpleanos(nueva);
    }).then(function(){
      window.__almAbrirCumpleanos();
    }).catch(function(err){
      console.error('[almacen] quitarCumpleanos:',err);
      if (window.mostrarPush) window.mostrarPush('Almac\u00e9n','No se pudo quitar','\u26a0\ufe0f');
    });
  };

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

  // ── PDF profesional de Solicitud de Material (carta completa, con logo) ──
  // A diferencia de __almImprimirEtiqueta (media carta, genérica para Ventas y Material),
  // esta plantilla es específica de MATERIAL: trae los datos completos del formulario
  // (solicitante, área, destino, uso, folio de servicio si viene de Operaciones) y el
  // detalle línea por línea de artículos, más la firma del solicitante. Pensada para
  // que Almacén la abra, la imprima y sepa exactamente qué surtir — el mismo espíritu
  // que la cotización de Ventas (portalGenerarPDFCot en ventas.js).
  //
  // Colores de marca Tecnocontrol (perfil de empresa / PPTX corporativo):
  var TC_AZUL = '#1D2E73';
  var TC_ROJO = '#E7402B';

  // ── Resuelve el pedido (caché local o Firestore) y llama al callback con los datos ──
  function _almResolverPedido(id, cb){
    var p = buscarP(id);
    if(p){ cb(p); return; }
    // El caché local (pedidos) solo se llena cuando se ha abierto Almacén en esta
    // sesión. Si nos llaman desde otro módulo (p.ej. Operaciones) sin pasar por ahí,
    // se hace una lectura puntual a Firestore en vez de fallar.
    cargarFirestore().then(function(fs){
      if(!window.db) throw new Error('Firestore no disponible');
      return fs.getDoc(fs.doc(window.db,'surtidos',id));
    }).then(function(snap){
      if(!snap.exists()){ if(window.mostrarPush) window.mostrarPush('Almacén','No se encontró la solicitud','⚠️'); return; }
      cb(Object.assign({id:snap.id}, snap.data()));
    }).catch(function(err){
      console.error('[almacen] _almResolverPedido:', err);
      if(window.mostrarPush) window.mostrarPush('Almacén','No se pudo cargar la solicitud','⚠️');
    });
  }

  window.__almImprimirSolicitudMaterial = function(id){
    _almResolverPedido(id, function(p){
      if(!window.jspdf){ if(window.mostrarPush) window.mostrarPush('Almacén','Librería PDF no cargada','⚠️'); return; }
      var docu = _almConstruirPDFSolicitudMaterial(p);
      if(!docu) return;
      try{ window.open(docu.output('bloburl'), '_blank'); }
      catch(e){ docu.save('Solicitud_'+(p.folio||'material')+'.pdf'); }
    });
  };

  // ── Enviar por WhatsApp: intenta compartir el PDF de forma nativa (funciona en
  // Android/iOS con Web Share API — ahí WhatsApp aparece como destino con el archivo
  // ya adjunto). En escritorio esa API casi nunca soporta archivos, así que se abre el
  // PDF en una pestaña nueva (para adjuntarlo a mano) y WhatsApp con el resumen de texto
  // ya redactado — igual que el botón de WhatsApp del flujo de Ventas (almacen-pdf.js),
  // que tampoco adjunta el PDF automáticamente porque WhatsApp no lo permite vía enlace web. ──
  window.__almWhatsAppSolicitudMaterial = function(id){
    _almResolverPedido(id, function(p){
      var resumen = _almResumenTextoSolicitud(p);

      // 1) SIEMPRE se abre primero el resumen en WhatsApp vía wa.me/?text= — es la
      //    única vía 100% confiable para el texto. WhatsApp (Android/iOS) normalmente
      //    IGNORA el "text" de Web Share cuando también recibe un archivo, así que no
      //    podemos depender de mandar archivo+texto juntos en un solo navigator.share.
      window.open('https://wa.me/?text='+encodeURIComponent(resumen), '_blank');

      if(!window.jspdf) return;
      var docu = _almConstruirPDFSolicitudMaterial(p);
      if(!docu) return;
      var archivoNombre = 'Solicitud_'+(p.folio||'material').replace(/\s+/g,'_')+'.pdf';

      // 2) El PDF se comparte/abre por separado — el resumen de texto ya quedó
      //    garantizado en el paso anterior, así que aquí NO se manda "text" de nuevo.
      try{
        var blob = docu.output('blob');
        var file = new File([blob], archivoNombre, {type:'application/pdf'});
        if(navigator.canShare && navigator.canShare({files:[file]})){
          navigator.share({ files:[file], title:'Solicitud '+(p.folio||'') }).catch(function(){});
          if(window.mostrarPush) window.mostrarPush('WhatsApp','Se abrió el resumen en WhatsApp y el cuadro para compartir el PDF — elige WhatsApp otra vez ahí para adjuntarlo a la misma conversación.', 'ℹ️');
          return;
        }
      }catch(e){ /* Web Share con archivos no soportado — se usa el respaldo abajo */ }

      try{ window.open(docu.output('bloburl'), '_blank'); }catch(e){}
      if(window.mostrarPush) window.mostrarPush('WhatsApp','Se abrió el resumen en WhatsApp y el PDF en otra pestaña — adjunta el PDF manualmente, WhatsApp no permite adjuntarlo automático desde un enlace web.', 'ℹ️');
    });
  };

  function _almResumenTextoSolicitud(p){
    var prods = Array.isArray(p.productos)?p.productos:[];
    var lineas = [
      '📦 Solicitud de Material — '+String(p.folio||'—'),
      'Solicitante: '+(p.solicitante||p.vendedor||'—'),
      (p.area?('Área: '+p.area):null),
      'Destino: '+(p.destino||p.cliente||'—'),
      'Prioridad: '+(PRIO_LABEL[p.prioridad]||p.prioridad||'Normal'),
      (p.folioServicio?('Folio de servicio: '+p.folioServicio):null),
      '',
      'Artículos:'
    ].filter(Boolean);
    prods.forEach(function(it){ lineas.push('• '+(it.desc||'—')+' ×'+(it.cant||0)+(it.clave?(' ('+it.clave+')'):'')); });
    if(p.uso) lineas.push('', 'Uso: '+p.uso);
    return lineas.join('\n');
  }

  function _almConstruirPDFSolicitudMaterial(p){
    if(!window.jspdf) return null;
    var jsPDF = window.jspdf.jsPDF;
    var docu = new jsPDF({ orientation:'portrait', unit:'mm', format:'letter' });
    var PW=215.9, PH=279.4, ML=14, MR=14;
    var azul = hexRGB(TC_AZUL), rojo = hexRGB(TC_ROJO);

    // ── Encabezado: fondo BLANCO (el logo trae texto azul marino/negro sobre
    // transparencia — sobre fondo navy se vuelve ilegible) con un margen navy
    // elegante como acento, no un bloque sólido. Logo con su proporción real
    // (420×125 px ≈ 3.36:1) para que no salga comprimido/deformado.
    docu.setFillColor(azul.r,azul.g,azul.b); docu.rect(0,0,PW,3,'F'); // franja superior, solo acento
    try{ docu.addImage('data:image/png;base64,'+LOGO_TECNOCONTROL_B64,'PNG',ML,9,30,8.93); }catch(e){}
    docu.setTextColor(azul.r,azul.g,azul.b); docu.setFont('helvetica','bold'); docu.setFontSize(9.5);
    docu.text('Solicitud de Material · Almacén / Operaciones', ML+34, 14.5);
    docu.setTextColor(120,120,120); docu.setFont('helvetica','normal'); docu.setFontSize(7.5);
    docu.text('Generado: '+new Date().toLocaleString('es-MX'), PW-MR, 14.5, {align:'right'});
    // Fecha real de captura de la solicitud (distinta de "Generado", que es cuando se
    // abrió/imprimió este PDF) — información de seguimiento pedida explícitamente.
    var fechaCaptura = '—';
    try{
      if(p.createdAt && typeof p.createdAt.toDate === 'function') fechaCaptura = p.createdAt.toDate().toLocaleString('es-MX');
      else if(p.createdAt) fechaCaptura = new Date(p.createdAt).toLocaleString('es-MX');
    }catch(e){}
    docu.setFontSize(7);
    docu.text('Capturado: '+fechaCaptura+'  ·  Origen: '+(ORIGEN_LABEL[p.origen]||p.origen||'—'), PW-MR, 19.5, {align:'right'});
    docu.setDrawColor(226,232,240); docu.line(ML,24,PW-MR,24);

    // ── Folio + prioridad (rojo si es urgente, azul de marca en cualquier otro caso) ──
    var esUrgente = p.prioridad === 'urgente';
    var rgb = esUrgente ? rojo : azul;
    docu.setFillColor(rgb.r,rgb.g,rgb.b); docu.roundedRect(ML,32,PW-ML-MR,16,3,3,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(13);
    docu.text(String(p.folio||'—'), ML+6, 42);
    docu.setFontSize(9.5);
    docu.text('Prioridad: '+(PRIO_LABEL[p.prioridad]||p.prioridad||'Normal'), PW-MR-6, 42, {align:'right'});

    // ── Datos de la solicitud ──
    var y = 56;
    docu.setTextColor(30,41,59);
    function campo2col(x1,x2,label,valor){
      docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
      docu.text(label.toUpperCase(), x1, y);
      docu.setFont('helvetica','normal'); docu.setFontSize(10.5); docu.setTextColor(15,23,42);
      docu.text(String(valor||'—'), x1, y+5.5);
    }
    var xMid = ML + (PW-ML-MR)/2 + 4;
    campo2col(ML, xMid, p.solicitante!==undefined?'Solicitante':'Vendedor', p.solicitante||p.vendedor);
    campo2col(xMid, xMid, 'Área', p.area||'—');
    y += 14;
    campo2col(ML, xMid, 'Operación destino', p.destino||p.cliente);
    campo2col(xMid, xMid, 'Folio de servicio', p.folioServicio||'—');
    y += 14;
    // Técnico/destinatario: antes no aparecía en el PDF impreso, aunque ya se capturaba
    // en el sistema (tecnicoNombre) — es la información de seguimiento más pedida por
    // Almacén ("¿para quién es esto?"). "Estado" ayuda a saber de un vistazo si esta
    // copia sigue vigente o ya fue surtida sin tener que abrir el portal.
    var destinatario = p.tecnicoNombre || (p.solicitaParaSiMismo ? (p.solicitante||p.vendedor||'—') : 'Sin técnico asignado');
    var estadoTxt = p.estado ? (p.estado.charAt(0).toUpperCase()+p.estado.slice(1).replace(/_/g,' ')) : 'Pendiente';
    campo2col(ML, xMid, 'Técnico / destinatario', destinatario);
    campo2col(xMid, xMid, 'Estado actual', estadoTxt);
    y += 14;
    if(p.solicitanteEmail){
      docu.setFont('helvetica','normal'); docu.setFontSize(7); docu.setTextColor(148,163,184);
      docu.text('Solicitante verificado por sesión: '+p.solicitanteEmail, ML, y-3);
    }
    docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
    docu.text('¿PARA QUÉ SE USARÁ EL MATERIAL?', ML, y);
    docu.setFont('helvetica','normal'); docu.setFontSize(10); docu.setTextColor(15,23,42);
    var usoLns = docu.splitTextToSize(String(p.uso||'—'), PW-ML-MR);
    docu.text(usoLns, ML, y+5.5);
    y += 8 + usoLns.length*5.2;

    // ── Tabla de artículos (encabezado en azul de marca) ──
    y += 4;
    docu.setDrawColor(226,232,240); docu.line(ML,y,PW-MR,y); y+=8;
    docu.setFillColor(azul.r,azul.g,azul.b); docu.rect(ML,y-5,PW-ML-MR,8,'F');
    docu.setFont('helvetica','bold'); docu.setFontSize(8.5); docu.setTextColor(255,255,255);
    docu.text('CLAVE', ML+2, y);
    docu.text('DESCRIPCIÓN', ML+32, y);
    docu.text('CANT.', PW-MR-2, y, {align:'right'});
    y += 8;
    var prods = Array.isArray(p.productos)?p.productos:[];
    docu.setFont('helvetica','normal'); docu.setFontSize(9.5); docu.setTextColor(15,23,42);
    prods.forEach(function(it, idx){
      var lns = docu.splitTextToSize(String(it.desc||'—'), PW-ML-MR-32-20);
      if(y + lns.length*5 > PH-55){ docu.addPage(); y=20; }
      if(idx%2===1){ docu.setFillColor(248,250,252); docu.rect(ML,y-4,PW-ML-MR,lns.length*5+2,'F'); }
      docu.setTextColor(15,23,42);
      docu.text(String(it.clave||'—'), ML+2, y);
      docu.text(lns, ML+32, y);
      docu.text('×'+String(it.cant||0), PW-MR-2, y, {align:'right'});
      y += Math.max(6, lns.length*5+1.5);
    });
    if(!prods.length){ docu.text('Sin artículos capturados.', ML+2, y); y+=6; }

    // ── Firma del solicitante ──
    y += 6;
    if(y > PH-60){ docu.addPage(); y=20; }
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
    docu.text('FIRMA DEL SOLICITANTE', ML, y); y += 4;
    if(p.firma){
      try{ docu.addImage(p.firma,'PNG',ML,y,60,26); }catch(e){}
    } else {
      docu.setDrawColor(203,213,225); docu.line(ML,y+20,ML+60,y+20);
    }

    // ── Recuadro para Almacén (recibió / entregó) — etiqueta en rojo de marca ──
    var xAlm = ML+80;
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(rojo.r,rojo.g,rojo.b);
    docu.text('SURTIÓ / ENTREGÓ (ALMACÉN)', xAlm, y);
    docu.setDrawColor(203,213,225); docu.line(xAlm,y+20,xAlm+70,y+20);
    docu.setFont('helvetica','normal'); docu.setFontSize(7); docu.setTextColor(100,116,139); docu.text('Nombre y firma', xAlm, y+24);

    // ── Pie de página (azul de marca, limpio — sin franja roja) ──
    docu.setFillColor(azul.r,azul.g,azul.b); docu.rect(0,PH-10,PW,10,'F');
    docu.setTextColor(255,255,255); docu.setFontSize(7);
    docu.text('Tecnocontrol · '+String(p.folio||'')+' · '+new Date().toLocaleString('es-MX'), PW/2, PH-4, {align:'center'});

    return docu;
  }

  function hexRGB(hex){
    hex = (hex||'#1473E6').replace('#','');
    if(hex.length===3) hex = hex.split('').map(function(c){return c+c;}).join('');
    var num = parseInt(hex,16);
    return { r:(num>>16)&255, g:(num>>8)&255, b:num&255 };
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
