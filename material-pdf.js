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
 *   window.tcSubirPDFCompartido(blob, nombre)      → Promise<liga pública>
 *
 * PDF por liga (oct-2026): WhatsApp no deja que una página web le adjunte
 * archivos, así que el PDF se sube a Supabase Storage (espacio
 * "pdfs-compartidos") y su liga va dentro del mensaje. Funciona en WhatsApp
 * de escritorio, Web, celular, correo o cualquier chat. Los PDF se borran
 * solos a los 90 días (ver pdfs_compartidos.sql). Si la subida falla, todo
 * sigue funcionando como antes (PDF descargado + texto).
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
      docu.text(it.unidad ? ((Number(it.cant)||0)+' '+it.unidad) : ('×'+String(it.cant||0)), PW-MR-2, y, {align:'right'});
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
    ov.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.75);z-index:1000001;display:flex;flex-direction:column;padding:calc(14px + env(safe-area-inset-top,0px)) 14px calc(14px + env(safe-area-inset-bottom,0px))';
    ov.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'+
        '<div style="color:#fff;font-weight:700;font-size:13.5px">Vista previa · '+esc(folio||'')+'</div>'+
        '<button onclick="document.getElementById(\'tc-preview-ov\').remove()" style="background:rgba(255,255,255,.15);border:none;border-radius:8px;width:30px;height:30px;color:#fff;font-size:16px;cursor:pointer">✕</button>'+
      '</div>'+
      '<iframe src="'+url+'" style="flex:1;width:100%;border:none;border-radius:10px;background:#fff;-webkit-overflow-scrolling:touch"></iframe>'+
      '<a href="'+url+'" target="_blank" style="text-align:center;color:#fff;font-size:11.5px;font-weight:700;text-decoration:underline;margin-top:8px">Abrir en pantalla completa (con zoom) ↗</a>'+
      '<div style="display:flex;gap:8px;margin-top:10px">'+
        '<button onclick="document.getElementById(\'tc-preview-ov\').remove()" style="flex:1;padding:12px;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Seguir editando</button>'+
        '<button id="tc-preview-enviar" style="flex:2;padding:12px;background:#25D366;color:#fff;border:none;border-radius:9px;font-weight:700;cursor:pointer">Confirmar y enviar</button>'+
      '</div>';
    document.getElementById('tc-preview-enviar').onclick=function(){
      document.getElementById('tc-preview-ov').remove();
      if(onEnviarWhatsApp) onEnviarWhatsApp();
    };
  };

  /* ── ENVÍO / COMPARTIR (29-sep-2026) ──────────────────────────────────
     Antes: en escritorio abría wa.me + el PDF en otra pestaña (los navegadores
     bloqueaban esas ventanas porque se abrían después de guardar, sin clic),
     y en Mac el cuadro nativo de compartir no trae WhatsApp → el PDF se perdía.
     Ahora SIEMPRE aparece un panel con todas las opciones (cada una es un clic
     real del usuario, así que el navegador no la bloquea) y en computadora el
     PDF además se DESCARGA automáticamente para que nunca se pierda.
     El panel se puede volver a abrir con el botón "Enviar por WhatsApp". ── */
  function _esMovil(){
    var ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function _descargarBlob(blob, nombre){
    try{
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = nombre; a.rel = 'noopener'; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ a.remove(); URL.revokeObjectURL(url); }, 60000);
      return true;
    }catch(e){ console.warn('[compartir] no se pudo descargar', e); return false; }
  }
  var ICO = {
    share: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.4L3 21l2.1-5.3A8.4 8.4 0 1 1 21 11.5z"/></svg>',
    monitor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    globe: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>',
    down: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
  };

  // ── PDF por liga (Supabase Storage) ──
  var SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
  var BUCKET = 'pdfs-compartidos';
  var _sbProm = null;
  function _sb(){
    if (window.tcSupabase) return Promise.resolve(window.tcSupabase);
    if (_sbProm) return _sbProm;
    _sbProm = import('https://esm.sh/@supabase/supabase-js@2').then(function(mod){
      if (!window.tcSupabase) window.tcSupabase = mod.createClient(SB_URL, SB_KEY);
      return window.tcSupabase;
    }).catch(function(e){ _sbProm = null; throw e; });
    return _sbProm;
  }
  function _codigo(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
    var s = ''; for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16); return s;
  }
  // Sube el PDF y regresa su liga pública. La carpeta lleva un código largo al
  // azar, así que la liga no se puede adivinar.
  window.tcSubirPDFCompartido = function(blob, nombre){
    var limpio = String(nombre || 'documento.pdf').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_');
    if (!/\.pdf$/i.test(limpio)) limpio += '.pdf';
    var mes = new Date().toISOString().slice(0, 7);
    var ruta = mes + '/' + _codigo() + '/' + limpio;
    return _sb().then(function(c){
      return c.storage.from(BUCKET).upload(ruta, blob, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })
        .then(function(r){
          if (r.error) throw r.error;
          _limpiarViejos(c);
          return c.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
        });
    });
  };
  // Limpieza: una vez al día por equipo, borra los PDF de hace más de 90 días.
  // (La base de datos solo permite borrar los que ya pasaron de 90 días.)
  function _limpiarViejos(c){
    try{
      var hoy = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem('tc_pdfs_limpieza') === hoy) return;
      localStorage.setItem('tc_pdfs_limpieza', hoy);
    }catch(e){ return; }
    var limite = Date.now() - 90 * 86400000;
    var meses = [];
    for (var i = 3; i <= 14; i++) { var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
    meses.reduce(function(p, mes){
      return p.then(function(){
        return c.storage.from(BUCKET).list(mes, { limit: 1000 }).then(function(r){
          var carpetas = (r.data || []).map(function(x){ return mes + '/' + x.name; });
          return Promise.all(carpetas.map(function(cp){
            return c.storage.from(BUCKET).list(cp, { limit: 100 }).then(function(r2){
              var viejos = (r2.data || []).filter(function(f){ return f.created_at && new Date(f.created_at).getTime() < limite; }).map(function(f){ return cp + '/' + f.name; });
              if (viejos.length) return c.storage.from(BUCKET).remove(viejos);
            });
          }));
        });
      });
    }, Promise.resolve()).catch(function(e){ console.warn('[compartir] limpieza de PDFs', e && e.message); });
  }

  // Panel universal de envío. docu (jsPDF) es opcional: sin él, solo ofrece texto.
  window.tcAbrirPanelEnvio = function(docu, folio, resumenTexto){
    var textoBase = resumenTexto || '';
    var texto = textoBase;
    var liga = null;
    var nombre = 'Solicitud_' + String(folio || 'material').replace(/\s+/g, '_') + '.pdf';
    var blob = null, file = null;
    if (docu) {
      try { blob = docu.output('blob'); file = new File([blob], nombre, { type: 'application/pdf' }); }
      catch (e) { console.error('[compartir] no se pudo generar el PDF', e); }
    }
    var movil = _esMovil();
    var puedeCompartirArchivo = !!(file && navigator.canShare && (function(){ try { return navigator.canShare({ files: [file] }); } catch (e) { return false; } })());

    // En computadora: descarga automática para que el PDF nunca se pierda
    var descargado = false;
    if (blob && !movil) descargado = _descargarBlob(blob, nombre);

    var ov = document.getElementById('tc-envio-ov');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'tc-envio-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:1000002;display:flex;align-items:flex-end;justify-content:center;padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));font-family:system-ui,-apple-system,sans-serif';
    if (!movil) ov.style.alignItems = 'center';

    var btn = function(id, ico, titulo, sub, color){
      return '<button id="' + id + '" type="button" style="display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border:1px solid #e2e8f0;border-radius:11px;background:' + (color || '#fff') + ';color:' + (color ? '#fff' : '#0f172a') + ';cursor:pointer;font:inherit">' +
        '<span style="flex:none;display:flex">' + ico + '</span>' +
        '<span style="display:flex;flex-direction:column;gap:1px"><b style="font-size:14px">' + titulo + '</b>' + (sub ? '<span style="font-size:11.5px;opacity:.75">' + sub + '</span>' : '') + '</span></button>';
    };

    var html = '<div style="background:#fff;border-radius:16px;width:100%;max-width:420px;max-height:90vh;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:8px;box-shadow:0 20px 50px rgba(0,0,0,.3)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">' +
        '<b style="font-size:15px;color:#1D2E73">Enviar ' + esc(folio || '') + '</b>' +
        '<button id="tc-envio-x" type="button" aria-label="Cerrar" style="background:#f1f5f9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
      '</div>';
    if (blob) html += '<div id="tc-envio-liga" role="status" style="font-size:12px;color:#1e40af;background:#eff6ff;border-radius:9px;padding:8px 10px">Preparando la liga del PDF para que vaya dentro del mensaje…</div>';
    if (descargado) html += '<div style="font-size:11.5px;color:#475569;background:#f8fafc;border-radius:9px;padding:7px 10px">Además se descargó una copia en esta computadora (' + esc(nombre) + ').</div>';
    if (puedeCompartirArchivo) html += btn('tc-envio-share', ICO.share, 'Compartir PDF', movil ? 'Elige WhatsApp en la lista — va con el PDF adjunto' : 'Cuadro de compartir del sistema', '#25D366');
    if (texto) {
      if (movil) {
        html += btn('tc-envio-wa', ICO.chat, puedeCompartirArchivo ? 'Enviar también el resumen en texto' : 'WhatsApp', 'Abre WhatsApp con el resumen escrito', puedeCompartirArchivo ? null : '#25D366');
      } else {
        html += btn('tc-envio-wadesk', ICO.monitor, 'WhatsApp de escritorio', 'Abre la app instalada con el resumen escrito', '#25D366');
        html += btn('tc-envio-waweb', ICO.globe, 'WhatsApp Web', 'Abre web.whatsapp.com con el resumen escrito');
      }
    }
    if (blob) {
      html += btn('tc-envio-ver', ICO.eye, 'Ver PDF', 'Abrir en una pestaña nueva');
      html += btn('tc-envio-desc', ICO.down, descargado ? 'Descargar de nuevo' : 'Descargar PDF', nombre);
    }
    if (texto) html += btn('tc-envio-copiar', ICO.copy, 'Copiar resumen', 'Para pegarlo en cualquier chat');
    if (blob) html += btn('tc-envio-copliga', ICO.copy, 'Copiar liga del PDF', 'Para mandarla por correo u otro chat');
    html += '</div>';
    ov.innerHTML = html;
    document.body.appendChild(ov);

    var $e = function(id){ return document.getElementById(id); };
    var cerrar = function(){ var o = $e('tc-envio-ov'); if (o) o.remove(); };
    ov.addEventListener('click', function(ev){ if (ev.target === ov) cerrar(); });
    $e('tc-envio-x').onclick = cerrar;
    var abrir = function(url){ var w = window.open(url, '_blank'); if (!w) location.href = url; };

    // Mientras se sube el PDF, los botones de WhatsApp esperan (1–3 s) para que
    // el mensaje ya lleve la liga. Si tarda o falla, se envía como antes.
    var BOTONES_TEXTO = ['tc-envio-wa', 'tc-envio-wadesk', 'tc-envio-waweb', 'tc-envio-copiar'];
    var pausar = function(si){
      BOTONES_TEXTO.forEach(function(id){ var b = $e(id); if (!b) return; b.disabled = si; b.style.opacity = si ? '.55' : '1'; b.style.cursor = si ? 'wait' : 'pointer'; });
      var cl = $e('tc-envio-copliga'); if (cl) { cl.disabled = !liga; cl.style.opacity = liga ? '1' : '.55'; if (!liga) cl.style.display = si ? '' : 'none'; }
    };
    if (blob && texto) pausar(true); else if (blob) pausar(false);
    if (blob) {
      var terminado = false;
      var listo = function(url){
        if (terminado) return; terminado = true;
        liga = url || null;
        if (liga) texto = (textoBase ? textoBase + '\n\n' : '') + '📄 Ver PDF: ' + liga;
        var aviso = $e('tc-envio-liga');
        if (aviso) {
          if (liga) { aviso.style.color = '#047857'; aviso.style.background = '#ecfdf5'; aviso.textContent = 'Listo: el mensaje ya incluye la liga del PDF. Quien lo reciba solo la toca para verlo.'; }
          else { aviso.style.color = '#92400e'; aviso.style.background = '#fffbeb'; aviso.textContent = 'No se pudo preparar la liga del PDF. Puedes enviar el resumen y adjuntar el PDF descargado.'; }
        }
        pausar(false);
      };
      window.tcSubirPDFCompartido(blob, nombre).then(listo).catch(function(e){ console.warn('[compartir] no se pudo subir el PDF', e && (e.message || e)); listo(null); });
      setTimeout(function(){ listo(null); }, 12000); // sin internet o muy lento: no dejar los botones esperando
    }
    if ($e('tc-envio-share')) $e('tc-envio-share').onclick = function(){
      navigator.share({ files: [file], title: 'Solicitud ' + (folio || '') }).catch(function(e){
        if (e && e.name === 'AbortError') return;
        console.warn('[compartir] share falló, se descarga', e); _descargarBlob(blob, nombre);
      });
    };
    if ($e('tc-envio-wa')) $e('tc-envio-wa').onclick = function(){ abrir('https://wa.me/?text=' + encodeURIComponent(texto)); };
    if ($e('tc-envio-wadesk')) $e('tc-envio-wadesk').onclick = function(){ location.href = 'whatsapp://send?text=' + encodeURIComponent(texto); };
    if ($e('tc-envio-waweb')) $e('tc-envio-waweb').onclick = function(){ abrir('https://web.whatsapp.com/send?text=' + encodeURIComponent(texto)); };
    if ($e('tc-envio-ver')) $e('tc-envio-ver').onclick = function(){ abrir(URL.createObjectURL(blob)); };
    if ($e('tc-envio-desc')) $e('tc-envio-desc').onclick = function(){ _descargarBlob(blob, nombre); };
    if ($e('tc-envio-copliga')) $e('tc-envio-copliga').onclick = function(){
      if (!liga) return;
      var b = $e('tc-envio-copliga');
      var ok = function(){ b.querySelector('b').textContent = 'Liga copiada'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(liga).then(ok).catch(function(){ window.prompt('Copia la liga:', liga); });
      else window.prompt('Copia la liga:', liga);
    };
    if ($e('tc-envio-copiar')) $e('tc-envio-copiar').onclick = function(){
      var b = $e('tc-envio-copiar');
      var ok = function(){ b.querySelector('b').textContent = 'Resumen copiado'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok).catch(function(){ window.prompt('Copia el resumen:', texto); });
      else window.prompt('Copia el resumen:', texto);
    };
    return Promise.resolve();
  };

  // Compatibilidad: todos los módulos siguen llamando a esta función
  window.tcCompartirPDFWhatsApp = function(docu, folio, resumenTexto){
    return window.tcAbrirPanelEnvio(docu, folio, resumenTexto);
  };

})();
