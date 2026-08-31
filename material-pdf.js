/* ============================================================================
 * material-pdf.js · Piezas COMPARTIDAS de Solicitud de Material
 * ----------------------------------------------------------------------------
 * Usado por: ventas.js (modal de Ventas), flotilla-movil.js (ventana flotante
 * de Flotilla) y solicitud-material.html (kiosco). Antes cada uno tenía su
 * propia lógica de PDF/WhatsApp (o no tenía ninguna) — esto evita duplicarla
 * una tercera vez, tal como se pidió.
 *
 * Depende de: window.db (Firestore compat, ya inicializado por cada host),
 * jsPDF (window.jspdf), y opcionalmente window.tcCargarCatalogoEstaciones /
 * tcCargarCatalogoPuntos / tcGeocodificarDireccion / tcCargarLeaflet
 * (expuestos por almacen-pdf.js cuando ese script ya está cargado en la
 * página — si no está, este módulo cae a su propia consulta directa).
 *
 * Expone:
 *   window.tcAbrirSelectorUbicacion(valorInicial, callback)
 *   window.tcConstruirPDFSolicitud(d)              → objeto jsPDF
 *   window.tcPrevisualizarPDF(docu, folio, onWhatsApp)
 *   window.tcCompartirPDFWhatsApp(docu, folio, resumenTexto)
 * ==========================================================================*/
(function(){
  'use strict';

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // ── Catálogo de estaciones (usa el de almacen-pdf.js si ya está cargado
  //    en la página; si no, hace su propia consulta a estaciones_servicio) ──
  var _estacionesFallback = null;
  function cargarEstaciones(){
    if(window.tcCargarCatalogoEstaciones) return window.tcCargarCatalogoEstaciones();
    if(_estacionesFallback) return Promise.resolve(_estacionesFallback);
    if(window.__tcModularFs){ // Kiosco (SDK modular)
      var mfs=window.__tcModularFs;
      return mfs.getDocs(mfs.collection(window.db,'estaciones_servicio')).then(function(snap){
        var lista=[]; snap.forEach(function(d){ lista.push(Object.assign({id:d.id},d.data())); });
        _estacionesFallback=lista; return lista;
      }).catch(function(){ return []; });
    }
    if(!window.db) return Promise.resolve([]);
    return window.db.collection('estaciones_servicio').get().then(function(snap){
      var lista=[]; snap.forEach(function(d){ lista.push(Object.assign({id:d.id},d.data())); });
      _estacionesFallback=lista; return lista;
    }).catch(function(){ return []; });
  }
  function geocodificar(direccion){
    if(window.tcGeocodificarDireccion) return Promise.resolve(window.tcGeocodificarDireccion(direccion));
    var url='https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q='+encodeURIComponent(direccion);
    return fetch(url,{headers:{'Accept-Language':'es'}}).then(function(r){return r.json();})
      .then(function(arr){ return (arr&&arr.length)?{lat:parseFloat(arr[0].lat),lng:parseFloat(arr[0].lon)}:null; })
      .catch(function(){ return null; });
  }
  function cargarLeaflet(){
    if(window.tcCargarLeaflet) return window.tcCargarLeaflet();
    if(window.L) return Promise.resolve(window.L);
    return new Promise(function(resolve,reject){
      if(!document.getElementById('tc-leaflet-css')){
        var link=document.createElement('link'); link.id='tc-leaflet-css'; link.rel='stylesheet';
        link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(link);
      }
      var s=document.createElement('script'); s.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      s.onload=function(){resolve(window.L);}; s.onerror=reject; document.head.appendChild(s);
    });
  }

  /* ── SELECTOR DE UBICACIÓN — 3 modos independientes ─────────────────────
     1) Elegir estación del catálogo (carga dirección/lat/lng automático)
     2) Escribir dirección a mano
     3) Marcar en el mapa (ubicación actual o puntero manual)
     callback recibe: {modo, estacionId, estacionNombre, direccion, lat, lng} */
  window.tcAbrirSelectorUbicacion = function(valorInicial, callback){
    var ov=document.getElementById('tc-ubic-ov');
    if(!ov){ ov=document.createElement('div'); ov.id='tc-ubic-ov'; document.body.appendChild(ov); }
    ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:1000000;display:flex;align-items:center;justify-content:center;padding:16px';
    ov.innerHTML=
      '<div style="background:#fff;border-radius:14px;width:420px;max-width:100%;max-height:90vh;overflow-y:auto;padding:20px">'+
        '<div style="font-weight:700;font-size:14.5px;color:#1e293b;margin-bottom:12px">Ubicación / estación</div>'+
        '<div style="display:flex;gap:6px;margin-bottom:14px">'+
          '<button id="tc-ub-tab-cat" onclick="window.__tcUbTab(\'cat\')" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid #cbd5e1;background:#0A1628;color:#fff;font-size:11.5px;font-weight:700;cursor:pointer">Catálogo</button>'+
          '<button id="tc-ub-tab-man" onclick="window.__tcUbTab(\'man\')" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:11.5px;font-weight:700;cursor:pointer">Dirección</button>'+
          '<button id="tc-ub-tab-map" onclick="window.__tcUbTab(\'map\')" style="flex:1;padding:8px 4px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#475569;font-size:11.5px;font-weight:700;cursor:pointer">Mapa</button>'+
        '</div>'+
        '<div id="tc-ub-cat">'+
          '<input id="tc-ub-buscar" placeholder="Busca una estación…" oninput="window.__tcUbBuscar()" style="width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box">'+
          '<div id="tc-ub-lista" style="max-height:260px;overflow-y:auto"></div>'+
        '</div>'+
        '<div id="tc-ub-man" style="display:none">'+
          '<label style="font-size:11px;color:#64748b;font-weight:600">Dirección</label>'+
          '<textarea id="tc-ub-dir" rows="2" style="width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;margin:4px 0 10px;box-sizing:border-box">'+esc(valorInicial&&valorInicial.direccion||'')+'</textarea>'+
          '<button onclick="window.__tcUbConfirmarManual()" style="width:100%;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer">Usar esta dirección</button>'+
        '</div>'+
        '<div id="tc-ub-map" style="display:none">'+
          '<div style="display:flex;gap:6px;margin-bottom:8px">'+
            '<button onclick="window.__tcUbMiUbicacion()" style="flex:1;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font-size:11.5px;font-weight:700;cursor:pointer">📍 Mi ubicación</button>'+
          '</div>'+
          '<div id="tc-ub-mapa-el" style="height:220px;border-radius:10px;overflow:hidden;background:#f1f5f9;margin-bottom:8px"></div>'+
          '<div id="tc-ub-mapa-hint" style="font-size:11px;color:#94a3b8;margin-bottom:8px">Toca el mapa para mover el puntero.</div>'+
          '<button onclick="window.__tcUbConfirmarMapa()" style="width:100%;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer">Confirmar ubicación</button>'+
        '</div>'+
        '<button onclick="document.getElementById(\'tc-ubic-ov\').remove()" style="width:100%;margin-top:10px;padding:9px;background:#f1f5f9;border:none;border-radius:8px;color:#475569;font-size:12px;font-weight:600;cursor:pointer">Cancelar</button>'+
      '</div>';

    var _cb=callback, _marker=null, _mapa=null;
    window.__tcUbTab=function(tab){
      ['cat','man','map'].forEach(function(t){
        document.getElementById('tc-ub-'+t).style.display = t===tab?'block':'none';
        var btn=document.getElementById('tc-ub-tab-'+t);
        btn.style.background = t===tab?'#0A1628':'#fff'; btn.style.color = t===tab?'#fff':'#475569';
      });
      if(tab==='map') setTimeout(initMapa,50);
    };
    window.__tcUbBuscar=function(){
      var q=(document.getElementById('tc-ub-buscar').value||'').trim().toLowerCase();
      var lista=document.getElementById('tc-ub-lista');
      cargarEstaciones().then(function(est){
        var res = q.length<2 ? est.slice(0,20) : est.filter(function(e){
          return (e.nombre||'').toLowerCase().includes(q) || (e.direccion||e.direccionNormalizada||'').toLowerCase().includes(q);
        }).slice(0,20);
        lista.innerHTML = res.length ? res.map(function(e){
          return '<div onclick=\'window.__tcUbElegirEstacion('+JSON.stringify({id:e.id,nombre:e.nombre,direccion:e.direccion||e.direccionNormalizada||'',lat:e.lat,lng:e.lng})+')\' style="padding:8px 10px;border-bottom:1px solid #f1f5f9;cursor:pointer">'+
            '<div style="font-size:12.5px;font-weight:700;color:#1e293b">'+esc(e.nombre||'—')+'</div>'+
            '<div style="font-size:11px;color:#94a3b8">'+esc(e.direccion||e.direccionNormalizada||'Sin dirección registrada')+'</div></div>';
        }).join('') : '<div style="padding:10px;font-size:12px;color:#94a3b8">Sin resultados.</div>';
      });
    };
    window.__tcUbElegirEstacion=function(e){
      _cb({modo:'estacion', estacionId:e.id, estacionNombre:e.nombre, direccion:e.direccion, lat:e.lat, lng:e.lng});
      document.getElementById('tc-ubic-ov').remove();
    };
    window.__tcUbConfirmarManual=function(){
      var dir=(document.getElementById('tc-ub-dir').value||'').trim();
      if(!dir){ alert('Escribe una dirección.'); return; }
      geocodificar(dir).then(function(coords){
        _cb({modo:'manual', direccion:dir, lat:coords&&coords.lat, lng:coords&&coords.lng});
        document.getElementById('tc-ubic-ov').remove();
      });
    };
    var _pinLatLng=null;
    function initMapa(){
      if(_mapa) return;
      cargarLeaflet().then(function(L){
        var centro=[28.6353,-106.0889]; // Chihuahua capital, por defecto
        if(valorInicial&&valorInicial.lat) centro=[valorInicial.lat,valorInicial.lng];
        _mapa=L.map('tc-ub-mapa-el').setView(centro,13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(_mapa);
        _marker=L.marker(centro,{draggable:true}).addTo(_mapa);
        _pinLatLng={lat:centro[0],lng:centro[1]};
        _marker.on('dragend',function(){ var p=_marker.getLatLng(); _pinLatLng={lat:p.lat,lng:p.lng}; });
        _mapa.on('click',function(ev){ _marker.setLatLng(ev.latlng); _pinLatLng={lat:ev.latlng.lat,lng:ev.latlng.lng}; });
      });
    }
    window.__tcUbMiUbicacion=function(){
      if(!navigator.geolocation) return;
      document.getElementById('tc-ub-mapa-hint').textContent='Obteniendo tu ubicación…';
      navigator.geolocation.getCurrentPosition(function(pos){
        var p={lat:pos.coords.latitude,lng:pos.coords.longitude};
        if(_mapa){ _mapa.setView([p.lat,p.lng],16); _marker.setLatLng([p.lat,p.lng]); }
        _pinLatLng=p;
        document.getElementById('tc-ub-mapa-hint').textContent='Puedes ajustar el puntero si no quedó exacto.';
      }, function(){ document.getElementById('tc-ub-mapa-hint').textContent='No se pudo obtener tu ubicación — mueve el puntero a mano.'; });
    };
    window.__tcUbConfirmarMapa=function(){
      if(!_pinLatLng){ alert('Marca un punto en el mapa.'); return; }
      _cb({modo:'mapa', direccion:null, lat:_pinLatLng.lat, lng:_pinLatLng.lng});
      document.getElementById('tc-ubic-ov').remove();
    };
    window.__tcUbBuscar();
  };

  /* ── PDF genérico de Solicitud de Material (mismo diseño que ya
     funcionaba en el kiosco — folio, franja de urgencia, datos, tabla,
     firma del solicitante + renglón de quien entrega, paginado) ── */
  window.tcConstruirPDFSolicitud = function(d, logoSrc){
    if(!window.jspdf) return null;
    var jsPDF = window.jspdf.jsPDF;
    var docu = new jsPDF({orientation:'portrait',unit:'mm',format:'letter'});
    var PW=215.9, PH=279.4, ML=14, MR=14;
    var AZUL={r:29,g:46,b:115}, ROJO={r:231,g:64,b:43};

    docu.setFillColor(AZUL.r,AZUL.g,AZUL.b); docu.rect(0,0,PW,3,'F');
    try{ if(logoSrc) docu.addImage(logoSrc,'PNG',ML,9,30,8.93); }catch(e){}
    docu.setTextColor(AZUL.r,AZUL.g,AZUL.b); docu.setFont('helvetica','bold'); docu.setFontSize(9.5);
    docu.text('Solicitud de Material · Almacén / Operaciones', ML+(logoSrc?34:0), 14.5);
    docu.setTextColor(120,120,120); docu.setFont('helvetica','normal'); docu.setFontSize(7.5);
    docu.text('Generado: '+new Date().toLocaleString('es-MX'), PW-MR, 14.5, {align:'right'});
    docu.setDrawColor(226,232,240); docu.line(ML,24,PW-MR,24);

    docu.setFillColor(ROJO.r,ROJO.g,ROJO.b); docu.roundedRect(ML,32,PW-ML-MR,16,3,3,'F');
    docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(13);
    docu.text(String(d.folio||'—'), ML+6, 42);
    docu.setFontSize(9.5);
    docu.text('Prioridad: '+String(d.prioridad||'—').toUpperCase(), PW-MR-6, 42, {align:'right'});

    var y=56;
    function campo(x,label,valor){
      docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
      docu.text(String(label).toUpperCase(), x, y);
      docu.setFont('helvetica','normal'); docu.setFontSize(10); docu.setTextColor(15,23,42);
      var lns=docu.splitTextToSize(String(valor==null||valor===''?'—':valor), (PW-ML-MR)/2-6);
      docu.text(lns, x, y+5.5);
      return lns.length;
    }
    var xMid = ML+(PW-ML-MR)/2+4;
    var n1=campo(ML,'Solicitante', d.solicitante), n2=campo(xMid,'Área', d.area);
    y += Math.max(n1,n2)*5.2 + 9;
    var n3=campo(ML,'Razón social', d.razonSocial), n4=campo(xMid,'Estación', d.estacionNombre);
    y += Math.max(n3,n4)*5.2 + 9;
    var n5=campo(ML,'Dirección / ubicación', d.direccion || (d.lat?('Lat '+d.lat.toFixed(5)+', Lng '+d.lng.toFixed(5)):null));
    y += n5*5.2 + 9;
    var n6=campo(ML,'Operación / destino', d.destino);
    y += n6*5.2 + 9;

    docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139);
    docu.text('¿PARA QUÉ SE USARÁ EL MATERIAL?', ML, y);
    docu.setFont('helvetica','normal'); docu.setFontSize(10); docu.setTextColor(15,23,42);
    var usoLns = docu.splitTextToSize(String(d.uso||'—'), PW-ML-MR);
    docu.text(usoLns, ML, y+5.5);
    y += 8 + usoLns.length*5.2 + 4;

    docu.setDrawColor(226,232,240); docu.line(ML,y,PW-MR,y); y+=8;
    docu.setFillColor(AZUL.r,AZUL.g,AZUL.b); docu.rect(ML,y-5,PW-ML-MR,8,'F');
    docu.setFont('helvetica','bold'); docu.setFontSize(8.5); docu.setTextColor(255,255,255);
    docu.text('CLAVE', ML+2, y); docu.text('DESCRIPCIÓN', ML+32, y); docu.text('CANT.', PW-MR-2, y, {align:'right'});
    y += 8;
    docu.setFont('helvetica','normal'); docu.setFontSize(9.5);
    (d.productos||[]).forEach(function(it,idx){
      var lns = docu.splitTextToSize(String(it.desc||'—'), PW-ML-MR-32-20);
      if(y+lns.length*5 > PH-55){ docu.addPage(); y=20; }
      if(idx%2===1){ docu.setFillColor(248,250,252); docu.rect(ML,y-4,PW-ML-MR,lns.length*5+2,'F'); }
      docu.setTextColor(15,23,42);
      docu.text(String(it.clave||'—'), ML+2, y);
      docu.text(lns, ML+32, y);
      docu.text('×'+String(it.cant||0), PW-MR-2, y, {align:'right'});
      y += Math.max(6, lns.length*5+1.5);
    });

    y += 6;
    if(y > PH-60){ docu.addPage(); y=20; }
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(100,116,139);
    docu.text('FIRMA DEL SOLICITANTE', ML, y); y += 4;
    if(d.firma){ try{ docu.addImage(d.firma,'PNG',ML,y,60,26); }catch(e){} }
    else { docu.setDrawColor(203,213,225); docu.line(ML,y+20,ML+60,y+20); }
    var xAlm = ML+80;
    docu.setFont('helvetica','bold'); docu.setFontSize(8); docu.setTextColor(ROJO.r,ROJO.g,ROJO.b);
    docu.text('SURTIÓ / ENTREGÓ (ALMACÉN)', xAlm, y);
    docu.setDrawColor(203,213,225); docu.line(xAlm,y+20,xAlm+70,y+20);
    docu.setFont('helvetica','normal'); docu.setFontSize(7); docu.setTextColor(100,116,139); docu.text('Nombre y firma', xAlm, y+24);

    var totalPaginas = docu.internal.getNumberOfPages();
    for(var p=1;p<=totalPaginas;p++){
      docu.setPage(p);
      docu.setFillColor(AZUL.r,AZUL.g,AZUL.b); docu.rect(0,PH-10,PW,10,'F');
      docu.setTextColor(255,255,255); docu.setFontSize(7);
      docu.text('Tecnocontrol · '+String(d.folio||''), ML, PH-4);
      docu.text('Página '+p+' de '+totalPaginas, PW-MR, PH-4, {align:'right'});
    }
    return docu;
  };

  /* ── PREVISUALIZACIÓN antes de enviar ── */
  window.tcPrevisualizarPDF = function(docu, folio, onEnviarWhatsApp){
    if(!docu) return;
    var url = docu.output('bloburl');
    var ov=document.getElementById('tc-preview-ov');
    if(!ov){ ov=document.createElement('div'); ov.id='tc-preview-ov'; document.body.appendChild(ov); }
    ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:1000001;display:flex;flex-direction:column;padding:14px';
    ov.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<div style="color:#fff;font-weight:700;font-size:13.5px">Vista previa · '+esc(folio||'')+'</div>'+
        '<button onclick="document.getElementById(\'tc-preview-ov\').remove()" style="background:rgba(255,255,255,.15);border:none;border-radius:8px;width:30px;height:30px;color:#fff;font-size:16px;cursor:pointer">✕</button>'+
      '</div>'+
      '<iframe src="'+url+'" style="flex:1;width:100%;border:none;border-radius:10px;background:#fff;-webkit-overflow-scrolling:touch"></iframe>'+
      '<a href="'+url+'" target="_blank" style="text-align:center;color:#fff;font-size:11.5px;font-weight:700;text-decoration:underline;margin-top:8px">Abrir en pantalla completa (con zoom) ↗</a>'+
      '<div style="display:flex;gap:8px;margin-top:10px">'+
        '<button onclick="document.getElementById(\'tc-preview-ov\').remove()" style="flex:1;padding:12px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Seguir editando</button>'+
        '<button id="tc-preview-enviar" style="flex:2;padding:12px;background:#25D366;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Confirmar y enviar por WhatsApp</button>'+
      '</div>';
    document.getElementById('tc-preview-enviar').onclick=function(){
      document.getElementById('tc-preview-ov').remove();
      if(onEnviarWhatsApp) onEnviarWhatsApp();
    };
  };

  /* ── ENVÍO POR WHATSAPP — mismo patrón probado en el kiosco: Web Share
     API con archivo (WhatsApp aparece como destino con el PDF adjunto en
     Android/iOS); en escritorio abre el PDF + WhatsApp con texto. ── */
  window.tcCompartirPDFWhatsApp = function(docu, folio, resumenTexto){
    if(!docu){ if(resumenTexto) window.open('https://wa.me/?text='+encodeURIComponent(resumenTexto),'_blank'); return Promise.resolve(); }
    var blob = docu.output('blob');
    var file = new File([blob], 'Solicitud_'+String(folio||'material').replace(/\s+/g,'_')+'.pdf', {type:'application/pdf'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      return navigator.share({files:[file], title:'Solicitud '+(folio||''), text:resumenTexto||''}).catch(function(){
        window.open(docu.output('bloburl'),'_blank');
        if(resumenTexto) window.open('https://wa.me/?text='+encodeURIComponent(resumenTexto),'_blank');
      });
    }
    window.open(docu.output('bloburl'),'_blank');
    if(resumenTexto) window.open('https://wa.me/?text='+encodeURIComponent(resumenTexto),'_blank');
    return Promise.resolve();
  };

})();
