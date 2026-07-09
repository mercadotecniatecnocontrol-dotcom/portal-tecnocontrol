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
    + '.alm-modal-box h4{margin:0 0 14px;font-size:15px;font-weight:800;color:#0f172a;display:flex;align-items:center;justify-content:space-between;}'
    + '.alm-modal-box h4 button{border:none;background:#f1f5f9;color:#475569;width:26px;height:26px;border-radius:8px;cursor:pointer;font-size:15px;line-height:1;}'
    + '.alm-hist-row{display:flex;flex-direction:column;gap:2px;padding:9px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;}'
    + '.alm-hist-row:last-child{border-bottom:none;}'
    + '.alm-hist-row .cambio{font-weight:800;color:#0f172a;}'
    + '.alm-hist-row .meta{color:#94a3b8;font-size:11px;}'
    + '.alm-modal-box img.alm-firma-full{max-width:100%;border:1px solid #e6ebf2;border-radius:10px;background:#fff;margin-bottom:14px;}'
    + '@keyframes almPulse{0%{box-shadow:0 0 0 0 rgba(18,161,80,.5);}70%{box-shadow:0 0 0 8px rgba(18,161,80,0);}100%{box-shadow:0 0 0 0 rgba(18,161,80,0);}}'
    + '@keyframes almBlink{0%,100%{opacity:1;}50%{opacity:.55;}}';
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

    var activos = pedidos.filter(function(p){ return p.estado!=='finalizado'; });
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
    }

    var goCls='alm-btn alm-btn-go'+((p.estado==='en_preparacion'&&!completo)?' wait':'');
    var tipoTag='<span class="alm-tipo-tag '+(p.tipo==='material'?'mat':'ven')+'">'+(p.tipo==='material'?'Material':'Venta')+'</span>';
    return '<div class="alm-card'+(urg?' urg':'')+'" data-id="'+p.id+'" style="border-left-color:'+ac+'">'
      + '<div class="top"><span class="folio">'+esc(p.folio||'—')+'</span>'
      +   '<span class="alm-chip'+(urg?' urg':'')+'" style="background:'+pc+'">'+esc(PRIO_LABEL[p.prioridad]||p.prioridad||'Normal')+'</span></div>'
      + '<div class="cli">'+esc(p.cliente||'Sin cliente')+' '+tipoTag+'</div>'
      + '<div class="vend">Vendedor: '+esc(p.vendedor||'—')+'</div>'
      + '<div class="alm-meta"><span>⏱ <span class="alm-timer" data-id="'+p.id+'" style="color:'+ac+'">'+fmt(now()-p.createdAt)+'</span></span>'
      +   '<span><b>'+piezas(p)+'</b> pzas</span>'+(total?'<span><b>'+hechas+'</b>/'+total+' líneas</span>':'')+'</div>'
      + progHtml + prodHtml
      + '<div class="alm-actions">'
      +   (PREV[p.estado]?'<button class="alm-btn alm-btn-back" title="Regresar etapa" onclick="window.__almBack(\''+p.id+'\')">‹</button>':'')
      +   '<button class="alm-btn alm-btn-ghost" onclick="window.__almToggle(\''+p.id+'\')">'+(abierta?'Ocultar':'Ver')+'</button>'
      +   '<button class="alm-btn alm-btn-ghost" title="Ver historial" onclick="window.__almVerHistorial(\''+p.id+'\')">'
      +     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg></button>'
      +   (sig?'<button class="'+goCls+'" onclick="window.__almGo(\''+p.id+'\')">'+esc(ACCION[p.estado]||'Avanzar')+' ›</button>':'')
      + '</div></div>';
  }

  function tickTimers(){
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

  // Handlers globales
  window.__almGo     = function(id){ var p=buscarP(id); if(p) moverEstado(id,NEXT[p.estado]); };
  window.__almBack   = function(id){ var p=buscarP(id); if(p&&PREV[p.estado]) moverEstado(id,PREV[p.estado]); };
  window.__almToggle = function(id){ expandido[id]=!expandido[id]; render(); };
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

  window.__almVerFirma = function(id){
    var p=buscarP(id); if(!p||!p.firma) return;
    construirModalHistorial();
    var box=document.getElementById('alm-modal-hist-box');
    box.innerHTML='<h4>Firma · '+esc(p.folio||'')+'<button onclick="window.__almCerrarModal()">&times;</button></h4>'
      + '<img class="alm-firma-full" src="'+esc(p.firma)+'" alt="Firma">';
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
      return fs.getDoc(fs.doc(window.db,'catalogo','productos','imagenes',k));
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
          return fs.setDoc(fs.doc(window.db,'catalogo','productos','imagenes',k), {
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

  console.log('[almacen.js] ✅ Centro de Surtido cargado (flujo + picking + SLA)');
})();
