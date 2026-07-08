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
  function piezas(p){ return (Array.isArray(p.productos)?p.productos:[]).reduce(function(a,x){ return a+(Number(x.cant)||0); },0); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function fmt(ms){ var s=Math.max(0,Math.floor(ms/1000)); return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }
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
  function ordenar(list){
    return list.slice().sort(function(a,b){ return (PRIO_RANK[b.prioridad]-PRIO_RANK[a.prioridad])||(a.createdAt-b.createdAt); });
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
        snap.forEach(function(docu){
          var d=docu.data()||{};
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
