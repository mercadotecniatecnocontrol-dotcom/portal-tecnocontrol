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

  // ── Acceso a datos ──
  // Desde oct-2026 Compras vive en Supabase. compras-supabase.js entrega un
  // "puente" con la misma forma que Firestore (collection, getDocs,
  // onSnapshot, updateDoc…): lo de Compras va a Supabase y lo demás
  // (colaboradores, logos de empresas, cuentas por pagar, avisos de Flotilla)
  // sigue yendo a Firestore sin cambios. Por eso el resto de este archivo
  // casi no cambió.
  var _fsPromesa = null;
  function _cpCargarPuente(){
    if(window.tcComprasFS) return Promise.resolve();
    return new Promise(function(ok, ko){
      var s=document.createElement('script'); s.src='compras-supabase.js?v=sb1';
      s.onload=function(){ ok(); }; s.onerror=function(){ ko(new Error('No se pudo cargar compras-supabase.js')); };
      document.head.appendChild(s);
    });
  }
  function cargarFirestore(){
    if(_fs) return Promise.resolve(_fs);
    if(_fsPromesa) return _fsPromesa;
    _fsPromesa = Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'),
      _cpCargarPuente(),
    ]).then(function(r){ return window.tcComprasFS(r[0]); })
      .then(function(puente){ _fs=_cpEnvolverFS(puente); return _fs; })
      .catch(function(e){ _fsPromesa=null; throw e; });
    return _fsPromesa;
  }

  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  // ══════════════════════════════════════════════════════════════════
  //  FASE 0 — CONSUMO DE FIREBASE (plan Spark: 50,000 lecturas y 20,000
  //  escrituras al día para TODO el proyecto, no solo Compras).
  //  · Todas las llamadas a Firestore de este módulo pasan por un envoltorio
  //    que (1) cuenta lecturas/escrituras del día en este navegador y
  //    (2) detecta "cuota agotada" para detener lo automático y avisar claro.
  //  · Cachés: colaboradores / proveedores / configuración en localStorage
  //    con caducidad; subcolecciones (fotos, cotizaciones) en memoria y se
  //    invalidan solas cuando alguien escribe en ellas desde este navegador.
  // ══════════════════════════════════════════════════════════════════
  var _cpCuotaAgotada = false;
  function _cpHoyClave(){ // el día de cuota de Firebase corre en hora del Pacífico
    var p = new Date(Date.now() - 8*3600000); return p.toISOString().slice(0,10);
  }
  function _cpUso(){ try{ return JSON.parse(localStorage.getItem('cp_uso_'+_cpHoyClave())||'{"l":0,"e":0}'); }catch(e){ return {l:0,e:0}; } }
  var _cpUsoMem = null, _cpUsoTimer = null;
  function _cpUsoSuma(tipo, n){
    if(!n) return;
    if(!_cpUsoMem) _cpUsoMem = _cpUso();
    _cpUsoMem[tipo] = (_cpUsoMem[tipo]||0) + n;
    clearTimeout(_cpUsoTimer);
    _cpUsoTimer = setTimeout(function(){ try{ localStorage.setItem('cp_uso_'+_cpHoyClave(), JSON.stringify(_cpUsoMem)); }catch(e){} }, 800);
  }
  window.cpConsumoHoy = function(){ return _cpUsoMem || _cpUso(); }; // para revisar desde la consola
  function _cpEsCuota(e){ var m=String((e&&e.message)||e||''); return !!e && (e.code==='resource-exhausted' || /quota|resource.exhausted|429/i.test(m)); }
  function _cpMarcarCuota(){
    if(_cpCuotaAgotada) return;
    _cpCuotaAgotada = true;
    console.warn('[compras] Cuota diaria de Firebase agotada — se pausan las tareas automáticas.');
    _cpPintarAvisoCuota();
  }
  var MSG_CUOTA = 'Hoy ya se usó el límite gratuito del sistema (Firebase). Lo que ves puede no estar al día y por ahora no se pueden guardar cambios. Se restablece solo en la madrugada (aprox. 1–2 a. m.). Si es urgente, avisa al administrador.';
  function _cpPintarAvisoCuota(){
    var html = '<div role="alert" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#FEF2F2;border:1.5px solid #FCA5A5;border-radius:12px;padding:12px 14px;margin-bottom:14px;color:#7F1D1D">' +
      '<span style="display:flex;color:#B91C1C">'+_cpIco('alerta')+'</span><div style="flex:1;min-width:240px;font-size:12.5px"><b>El sistema llegó a su límite de hoy.</b> '+esc(MSG_CUOTA)+'</div>' +
      '<button onclick="location.reload()" style="padding:8px 13px;border-radius:9px;border:1px solid #FCA5A5;background:#fff;color:#7F1D1D;font-size:12px;font-weight:700;cursor:pointer">Reintentar</button></div>';
    var el = document.getElementById('cp-aviso-cuota'); if(el) el.innerHTML = html;
    if(!el) toast('El sistema llegó a su límite gratuito de hoy. Intenta más tarde.');
  }
  // Mensaje para el usuario según el error.
  function _cpMsgError(e, accion){
    if(_cpEsCuota(e)) return MSG_CUOTA;
    var m = String((e&&e.message)||e||'');
    if(/permission/i.test(m)) return 'No tienes permiso para '+(accion||'hacer esto')+'. Si crees que es un error, avisa al administrador.';
    if(/offline|unavailable|network/i.test(m)) return 'No hay conexión. Revisa tu internet e inténtalo de nuevo.';
    return 'No se pudo '+(accion||'completar la acción')+': '+m;
  }

  // ── Caché simple en localStorage ──
  function _cpCacheGet(k, ttlMin){ try{ var x=JSON.parse(localStorage.getItem('cp_cache_'+k)||'null'); if(x && Date.now()-x.t < ttlMin*60000) return x.d; }catch(e){} return null; }
  function _cpCacheSet(k, d){ try{ localStorage.setItem('cp_cache_'+k, JSON.stringify({t:Date.now(), d:d})); }catch(e){} }
  function _cpCacheDel(k){ try{ localStorage.removeItem('cp_cache_'+k); }catch(e){} }
  // ── Caché en memoria de subcolecciones (fotos, cotizaciones, adjuntos) ──
  var _cpSubCache = {};
  function _cpRuta(ref){ return ref && (ref.path || (ref._path && ref._path.segments && ref._path.segments.join('/'))) || ''; }
  function _cpGetDocsCache(fs, colRef){
    var k=_cpRuta(colRef);
    if(k && _cpSubCache[k]) return Promise.resolve(_cpSubCache[k]);
    return fs.getDocs(colRef).then(function(snap){ var arr=snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }); if(k) _cpSubCache[k]=arr; return arr; });
  }
  function _cpInvalidarPorEscritura(ruta){
    if(!ruta) return;
    var partes = ruta.split('/');
    // ruta de colección (addDoc) o de documento (set/update/delete)
    var col = partes.length%2===1 ? ruta : partes.slice(0,-1).join('/');
    delete _cpSubCache[col];
    if(col==='proveedores'){ _cpCacheDel('prov'); _proveedoresCache=null; }
    if(col==='colaboradores') _cpCacheDel('colab');
    if(col==='config_flujo_compras') _cpCacheDel('cfg_'+partes[1]);
  }

  function _cpEnvolverFS(m){
    var w = Object.assign({}, m);
    var err = function(e){ if(_cpEsCuota(e)) _cpMarcarCuota(); throw e; };
    w.getDocs = function(q){ return m.getDocs(q).then(function(s){ _cpUsoSuma('l', s.metadata&&s.metadata.fromCache?0:Math.max(1,s.size)); return s; }, err); };
    w.getDoc = function(r){ return m.getDoc(r).then(function(s){ _cpUsoSuma('l', s.metadata&&s.metadata.fromCache?0:1); return s; }, err); };
    w.onSnapshot = function(q, ok, ko){
      return m.onSnapshot(q, function(s){ if(!(s.metadata&&s.metadata.fromCache)) _cpUsoSuma('l', Math.max(1, s.docChanges().length)); ok(s); },
        function(e){ if(_cpEsCuota(e)) _cpMarcarCuota(); if(ko) ko(e); });
    };
    ['addDoc','setDoc','updateDoc','deleteDoc'].forEach(function(fn){
      w[fn] = function(ref){ var args=arguments; return m[fn].apply(null, args).then(function(r){ _cpUsoSuma('e',1); _cpInvalidarPorEscritura(_cpRuta(ref)); return r; }, err); };
    });
    w.writeBatch = function(db){
      var b=m.writeBatch(db), n=0, rutas=[], wb={};
      ['set','update','delete'].forEach(function(op){ wb[op]=function(ref){ n++; rutas.push(_cpRuta(ref)); b[op].apply(b, arguments); return wb; }; });
      wb.commit=function(){ return b.commit().then(function(r){ _cpUsoSuma('e',n); rutas.forEach(_cpInvalidarPorEscritura); return r; }, err); };
      return wb;
    };
    w.runTransaction = function(db, fn){
      var lect=0, esc_=0, rutas=[];
      return m.runTransaction(db, function(tx){
        var wtx={ get:function(r){ lect++; return tx.get(r); } };
        ['set','update','delete'].forEach(function(op){ wtx[op]=function(ref){ esc_++; rutas.push(_cpRuta(ref)); tx[op].apply(tx, arguments); return wtx; }; });
        return fn(wtx);
      }).then(function(r){ _cpUsoSuma('l',lect); _cpUsoSuma('e',esc_); rutas.forEach(_cpInvalidarPorEscritura); return r; }, err);
    };
    return w;
  }

  // ── Colección "dividida": un solo listener en tiempo real SOLO para lo
  //    abierto + una lectura única (por sesión) de lo cerrado. Antes se
  //    escuchaba la colección completa, que crece sin parar. ──
  function _cpColeccionDividida(fs, nombre, abiertos, alCambiar, alError){
    var abiertas = {}, cerradas = {};
    var ref = fs.collection(window.db, nombre);
    var unsub = fs.onSnapshot(fs.query(ref, fs.where('estatus','in',abiertos)), function(snap){
      var cambiados = [];
      snap.docChanges().forEach(function(ch){
        var id = ch.doc.id; cambiados.push(id);
        if(ch.type==='removed'){
          delete abiertas[id];
          // Pasó a cerrado (o se borró): una sola lectura para saber cómo quedó.
          fs.getDoc(fs.doc(window.db, nombre, id)).then(function(s){
            if(s.exists()){ var x=Object.assign({id:id}, s.data()); if(abiertos.indexOf(x.estatus)===-1) cerradas[id]=x; else abiertas[id]=x; }
            alCambiar([id]);
          }).catch(function(){ alCambiar([id]); });
        } else {
          abiertas[id] = Object.assign({id:id}, ch.doc.data()); delete cerradas[id];
        }
      });
      alCambiar(cambiados);
    }, alError);
    var cargadas = false;
    function cargarCerradas(forzar){
      if(cargadas && !forzar) return Promise.resolve();
      cargadas = true;
      return fs.getDocs(fs.query(ref, fs.where('estatus','not-in',abiertos))).then(function(snap){
        snap.docs.forEach(function(d){ if(!abiertas[d.id]) cerradas[d.id]=Object.assign({id:d.id}, d.data()); });
        alCambiar([]);
      }).catch(function(e){ cargadas=false; console.warn('[compras] cerradas '+nombre, e); });
    }
    return {
      lista: function(){ return Object.keys(abiertas).map(function(k){ return abiertas[k]; }).concat(Object.keys(cerradas).map(function(k){ return cerradas[k]; })); },
      cargarCerradas: cargarCerradas, unsub: unsub,
    };
  }


  // ── Correo → nombre (regla global 1.1) ─────────────────────────
  // Fuente única: colección 'colaboradores' (mismo catálogo que ya usa
  // Flotilla en flNombrePorCorreo). Se carga una sola vez y se reusa.
  var _colaboradoresCache = null;
  function cargarColaboradores(){
    if(_colaboradoresCache) return Promise.resolve(_colaboradoresCache);
    var enCache = _cpCacheGet('colab', 12*60);
    if(enCache){ _colaboradoresCache = enCache; return Promise.resolve(_colaboradoresCache); }
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.collection(window.db,'colaboradores')).then(function(snap){
        _colaboradoresCache = snap.docs.map(function(d){ var x=d.data(); return {id:d.id, nombre:x.nombre||'', correo:x.correo||'', departamento:x.departamento||'', puesto:x.puesto||''}; });
        _cpCacheSet('colab', _colaboradoresCache);
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
      return _cpGetDocsCache(fs, fs.collection(window.db,'requisiciones_compra',id,'fotos')).catch(function(){ return []; });
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
    var enCache = _cpCacheGet('cfg_general', 10);
    if(enCache){ _configFlujoCache = enCache; return Promise.resolve(_configFlujoCache); }
    return cargarFirestore().then(function(fs){
      return fs.getDoc(fs.doc(window.db,'config_flujo_compras','general')).then(function(snap){
        _configFlujoCache = snap.exists() ? snap.data() : {jefesPorDepto:{}, aprobadoresCompras:[]};
        _cpCacheSet('cfg_general', _configFlujoCache);
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
        ov.id = 'cp-firmas-overlay'; ov.className='cp-scope'; _cpInyectarEstilos();
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
      _cpInyectarEstilos();
      pintarShell(cont);
      escuchar();
      escucharSC();
    }
  };

  function pintarShell(cont){
    cont.innerHTML =
      '<div style="background:#EEF2F7;margin:-20px;padding:24px;min-height:100vh">' +
      '<div style="max-width:1180px;margin:0 auto;background:#fff;border:1px solid #E5EAF1;border-radius:16px;box-shadow:0 2px 8px rgba(10,22,40,.07);padding:24px 28px;min-height:70vh">' +
        '<div id="cp-aviso-cuota"></div>' +

        '<div style="display:flex;gap:22px;margin-bottom:22px;border-bottom:1px solid #EEF2F7;overflow-x:auto">' +
          '<button id="cp-mtab-req" onclick="window.__cpSetVistaModulo(\'req\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#0A1628;border-bottom:2px solid #0A1628;cursor:pointer">Requisiciones</button>' +
          '<button id="cp-mtab-cot" onclick="window.__cpSetVistaModulo(\'cot\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#94A3B8;border-bottom:2px solid transparent;cursor:pointer;display:flex;align-items:center;gap:6px">Cotizaciones<span id="cp-mtab-cot-n" style="display:none;background:#E7402B;color:#fff;font-size:10px;font-weight:800;padding:1px 6px;border-radius:9px">0</span></button>' +
          '<button id="cp-mtab-ras" onclick="window.__cpSetVistaModulo(\'ras\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;color:#94A3B8;border-bottom:2px solid transparent;cursor:pointer">Rastreo</button>' +
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
          '<button class="cp-btn" onclick="window.__cpAbrirAutDirecta()" style="border-color:#C7D2FE;color:#3730A3">'+_cpIco('rayo')+'Autorización directa</button>' +
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

        '<div id="cp-vista-cot" class="cp-scope" style="display:none">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px"><div><h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628">Solicitudes de cotización</h2>' +
          '<p style="font-size:12px;color:#5C7089;margin:4px 0 0">Pide precios a proveedores, compáralos y responde a los departamentos que te los pidieron.</p></div>' +
          '<button class="cp-btn prim" onclick="window.__scNueva(\'Compras\')">+ Nueva cotización</button></div>' +
          '<div id="cp-sc-kpis" class="cp-kpis"></div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">' +
            '<input class="cp-in" type="search" style="flex:1 1 220px" placeholder="Buscar folio, pieza, número de parte, proveedor, cliente…" oninput="window.__scFiltroTexto(this.value)" aria-label="Buscar cotización">' +
            '<select id="cp-scf-depto" class="cp-in" onchange="window.__scFiltro(\'depto\',this.value)" aria-label="Departamento"><option value="">Todos los departamentos</option></select>' +
            '<input class="cp-in" placeholder="Proveedor" style="width:140px" oninput="window.__scFiltro(\'proveedor\',this.value)" aria-label="Proveedor">' +
            '<select class="cp-in" onchange="window.__scFiltro(\'categoria\',this.value)" aria-label="Tipo de compra"><option value="">Todo tipo</option>'+CATS_CP.map(function(c){ return '<option value="'+c.id+'">'+c.label+'</option>'; }).join('')+'</select>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#5C7089;font-weight:600">Desde <input class="cp-in" type="date" onchange="window.__scFiltro(\'desde\',this.value)"></label>' +
            '<label style="display:flex;align-items:center;gap:5px;font-size:11.5px;color:#5C7089;font-weight:600">hasta <input class="cp-in" type="date" onchange="window.__scFiltro(\'hasta\',this.value)"></label>' +
            '<input class="cp-in" type="number" min="0" placeholder="$ mín." style="width:90px" oninput="window.__scFiltro(\'montoMin\',this.value)" aria-label="Monto mínimo">' +
            '<input class="cp-in" type="number" min="0" placeholder="$ máx." style="width:90px" oninput="window.__scFiltro(\'montoMax\',this.value)" aria-label="Monto máximo">' +
          '</div>' +
          '<div id="cp-sc-lista"></div>' +
        '</div>' +

        '<div id="cp-vista-ras" class="cp-scope" style="display:none">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px"><div><h2 style="font-size:19px;font-weight:700;margin:0;color:#0A1628">¿Dónde vienen mis compras?</h2>' +
          '<p style="font-size:12px;color:#5C7089;margin:4px 0 0">Todo lo que ya se compró y aún no llega. Captura la guía y avisa a quien lo pidió en cada cambio.</p></div>' +
          '<div role="group" aria-label="Vista" style="display:flex;background:#F1F5F9;border-radius:9px;padding:3px"><button id="cp-ras-v-lista" onclick="window.__rasVista(\'lista\')" style="padding:6px 12px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">Lista</button><button id="cp-ras-v-mapa" onclick="window.__rasVista(\'mapa\')" style="padding:6px 12px;border:none;border-radius:7px;font-size:12px;font-weight:700;cursor:pointer">Mapa</button></div></div>' +
          '<div id="cp-ras-kpis" class="cp-kpis"></div>' +
          '<input class="cp-in" type="search" style="width:100%;margin-bottom:12px" placeholder="Buscar folio, guía, proveedor o pieza…" oninput="window.__rasTexto(this.value)" aria-label="Buscar envío">' +
          '<div id="cp-ras-lista"></div>' +
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
      '<div id="cp-detalle-overlay" class="cp-scope" style="display:none;position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2000;align-items:center;justify-content:center;padding:24px">' +
        '<div id="cp-detalle-panel" style="background:#fff;border-radius:14px;max-width:920px;width:100%;max-height:88vh;overflow-y:auto;padding:22px"></div>' +
      '</div>';
  }

  window.__cpSetVistaModulo = function(vista){
    ['req','cot','ras','prov','cxp','presup'].forEach(function(v){
      document.getElementById('cp-vista-'+v).style.display = v===vista?'block':'none';
      var tab = document.getElementById('cp-mtab-'+v);
      tab.style.color = v===vista?'#0A1628':'#94A3B8';
      tab.style.borderBottomColor = v===vista?'#0A1628':'transparent';
    });
    if(vista==='cot'){ escucharSC(); _scProveedores(); renderCotizaciones(); }
    if(vista==='ras') renderRastreo();
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
    var enCache = !forzar && _cpCacheGet('prov', 120);
    if(enCache){ _proveedoresCache = enCache; renderProveedores(); return; }
    if(el) el.innerHTML = '<p style="font-size:12px;color:#94a3b8">Cargando…</p>';
    cargarFirestore().then(function(fs){
      fs.getDocs(fs.query(fs.collection(window.db,'proveedores'), fs.orderBy('nombre'))).then(function(snap){
        _proveedoresCache = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        _cpCacheSet('prov', _proveedoresCache);
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

  var _cpEscuchando = false, _cpReqs = null;
  function escuchar(){
    if(_cpEscuchando){ renderKPIs(); renderBoard(); return; }
    _cpEscuchando = true;
    if(_cpCuotaAgotada) _cpPintarAvisoCuota();
    cargarProveedores();
    Promise.all([cargarColaboradores(), cargarConfigFlujo(), cargarAutDirecta()]).then(function(){ renderKPIs(); renderBoard(); _cpProgramarAutoDirectas(); });
    cargarFirestore().then(function(fs){
      var primera = true;
      _cpReqs = _cpColeccionDividida(fs, 'requisiciones_compra', ['pendiente','autorizada','cotizando','orden_generada'], function(cambiados){
        docs = _cpReqs.lista().sort(function(a,b){ return (_cpFechaDoc(b)||0)-(_cpFechaDoc(a)||0); });
        renderKPIs();
        renderBoard();
        renderRastreo();
        _cpdRender();
        _cpProgramarAutoDirectas();
        if(primera){ primera=false; _cpReqs.cargarCerradas(); }
        // Solo se vuelve a pintar el detalle si cambió ESA requisición
        // (antes se repintaba —y releía sus fotos— con cada cambio de cualquiera).
        if(detalleId && (cambiados.indexOf(detalleId)>-1) && !_cpEscribiendoEn('cp-detalle-panel')) window.__cpAbrirDetalle(detalleId);
        if(_scDetalleId && cambiados.length) _scRefrescarVistas();
      }, function(err){
        console.error('[compras] onSnapshot:', err);
        var b=document.getElementById('cp-board');
        if(b) b.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:#B91C1C;font-size:13px">'+esc(_cpMsgError(err,'leer las requisiciones'))+'</div>';
      });
      _unsub = _cpReqs.unsub;
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
      rayo:'<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
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
        if(f.estatus==='aprobado' && f.fecha && f.via!=='autorizacion_directa'){ var x=new Date(f.fecha); if(!isNaN(x) && (!base || x>base)) base=x; }
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
    var dir = _cpAbiertas().filter(_cpCandidataDirecta).length;
    if(dir){
      html += '<div role="status" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;padding:12px 14px;margin-bottom:12px;color:#312E81">' +
        '<span style="display:flex">'+_cpIco('rayo')+'</span><div style="flex:1;min-width:220px;font-size:12.5px"><b>'+dir+'</b> '+(dir===1?'requisición puede':'requisiciones pueden')+' pasar directo a Compras (quien las pidió tiene autorización directa).</div>' +
        (_cpPuedeAdministrar()?'<button class="cp-btn" onclick="window.__cpAbrirAutDirecta(\'permisos\')">Revisar y pasarlas</button>':'')+'</div>';
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
          '<td>'+esc(e.txt)+(d.autorizacionDirecta?'<div style="margin-top:3px">'+_cpChipDirecto(d)+'</div>':'')+(e.quien?'<div style="font-size:11px;color:#5C7089">Le toca a: <b>'+esc(e.quien)+'</b></div>':'')+(e.falta?'<div style="font-size:11px;color:#B45309;font-weight:700">Nadie asignado para aprobar</div>':'')+'</td>' +
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
      (d.autorizacionDirecta?'<div style="margin-top:6px">'+_cpChipDirecto(d)+'</div>':'') +
      (d.envio&&d.estatus==='orden_generada'?'<div style="margin-top:6px;font-size:11px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">'+_cpIco('camion')+_envCuentaSpan(d.envio)+_envChips(d.envio)+'</div>':(d.estatus==='orden_generada'?'<div style="margin-top:6px"><span class="cp-chip" style="background:#FEF3C7;color:#92400E">'+_cpIco('alerta')+'Falta la guía</span></div>':'')) +
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

  // ══════════════════════════════════════════════════════════════════
  //  FASE 2 — AUTORIZACIÓN DIRECTA (sin esperar al jefe)
  //  · Permisos por persona, por departamento o por rol ("todos los jefes
  //    de área"), con límite de monto y categorías.
  //  · Se aplica SOLO: si quien pide tiene permiso, el paso "Jefe de área"
  //    se da por aprobado y la requisición pasa directo a Compras.
  //  · Al momento de pedir casi nunca hay precio, así que el límite se revisa
  //    cuando Compras elige la cotización: si el precio real pasa el límite,
  //    la requisición REGRESA sola a que su jefe la apruebe.
  //  · Todo queda en bitácora: dentro de cada requisición (campo bitacora) y
  //    los cambios de permisos dentro de config_flujo_compras/autorizacion_directa
  //    — sin colecciones nuevas, para no tocar reglas de Firestore.
  //  · Compatible hacia atrás: el paso queda con estatus 'aprobado' (lo que
  //    ya entienden firmar.html, el PDF y Flotilla) + marca via:'autorizacion_directa'.
  // ══════════════════════════════════════════════════════════════════
  var CATS_CP = [
    {id:'insumo',   label:'Insumos y consumibles', ej:'papelería, limpieza, cafetería…'},
    {id:'servicio', label:'Servicios',             ej:'mantenimiento, reparaciones, fletes…'},
    {id:'stock',    label:'Mercancía para inventario', ej:'refacciones y piezas que entran al sistema'},
  ];
  var _autDirCache = null;
  function cargarAutDirecta(forzar){
    if(_autDirCache && !forzar) return Promise.resolve(_autDirCache);
    return cargarFirestore().then(function(fs){
      return fs.getDoc(fs.doc(window.db,'config_flujo_compras','autorizacion_directa')).then(function(snap){
        _autDirCache = snap.exists() ? snap.data() : {permisos:[], historial:[]};
        _autDirCache.permisos = _autDirCache.permisos || []; _autDirCache.historial = _autDirCache.historial || [];
        return _autDirCache;
      }).catch(function(e){ console.warn('[compras] autorizacion_directa:', e); _autDirCache = {permisos:[], historial:[]}; return _autDirCache; });
    });
  }
  function _cpMiCorreo(){ return (window.auth && window.auth.currentUser && window.auth.currentUser.email || '').toLowerCase(); }
  function _cpMiNombre(){ var c=_cpMiCorreo(); return nombrePorCorreo(c)||c; }
  function _cpMoney(n){ return '$'+Number(n||0).toLocaleString('es-MX',{maximumFractionDigits:2}); }
  function _cpCatLabel(id){ var c=CATS_CP.find(function(x){return x.id===id;}); return c?c.label:(id||'—'); }
  // ¿Quién puede dar/quitar permisos? Admin total del portal o aprobadores de Compras.
  function _cpPuedeAdministrar(){
    var yo = _cpMiCorreo(); if(!yo) return false;
    try{ if(typeof ADMIN_EMAILS!=='undefined' && ADMIN_EMAILS.map(function(x){return String(x).toLowerCase();}).indexOf(yo)>-1) return true; }catch(e){}
    var cfg = _configFlujoCache || {};
    return (cfg.aprobadoresCompras||[]).some(function(a){ return (a.correo||'').toLowerCase()===yo; });
  }
  // Correo de quien pidió (el kiosco guarda el NOMBRE en 'solicitante').
  function _cpCorreoDe(d){
    var c = correoSolicitante(d); if(c) return c.toLowerCase();
    var n = _cpNorm(d.solicitante);
    var col = (_colaboradoresCache||[]).find(function(x){ return x.nombre && _cpNorm(x.nombre)===n; });
    return col ? String(col.correo||col.id||'').toLowerCase() : '';
  }
  function _cpEsJefeDeArea(correo){
    var j = (_configFlujoCache||{}).jefesPorDepto || {};
    return Object.keys(j).some(function(k){ return j[k] && (j[k].correo||'').toLowerCase()===correo; });
  }
  function _cpDescPermiso(p){
    var quien = p.tipo==='persona' ? _cpTitulo(p.nombre||p.correo) : p.tipo==='rol' ? 'Todos los jefes de área' : 'Todo '+p.departamento;
    var lim = Number(p.limite)>0 ? 'hasta '+_cpMoney(p.limite) : 'sin límite de monto';
    var cats = (p.categorias||[]).indexOf('todas')>-1 || !(p.categorias||[]).length ? 'en todo' : 'en '+p.categorias.map(_cpCatLabel).join(', ').toLowerCase();
    return {quien:quien, regla:lim+' '+cats};
  }
  // Permiso que cubre ESTA requisición (persona > rol > departamento; el de mayor límite).
  function _cpPermisoPara(d){
    var cache = _autDirCache; if(!cache) return null;
    var correo = _cpCorreoDe(d), depto = deptoSolicitante(d), cat = d.tipoCompra || '';
    var cand = cache.permisos.filter(function(p){
      if(p.activo===false) return false;
      var cats = p.categorias||[];
      if(cats.length && cats.indexOf('todas')===-1 && cats.indexOf(cat)===-1) return false;
      if(p.tipo==='persona') return !!correo && (p.correo||'').toLowerCase()===correo;
      if(p.tipo==='rol' && p.rol==='jefes_area') return !!correo && _cpEsJefeDeArea(correo);
      if(p.tipo==='departamento') return !!depto && _cpNorm(p.departamento)===_cpNorm(depto);
      return false;
    });
    if(!cand.length) return null;
    var peso = {persona:3, rol:2, departamento:1};
    var lim = function(p){ return Number(p.limite)>0 ? Number(p.limite) : Infinity; };
    cand.sort(function(a,b){ return (peso[b.tipo]-peso[a.tipo]) || (lim(b)-lim(a)); });
    var p = cand[0];
    // Si ya trae un monto estimado que pasa el límite, no aplica.
    if(d.montoEstimado!=null && Number(p.limite)>0 && Number(d.montoEstimado)>Number(p.limite)) return null;
    return p;
  }
  function _cpCandidataDirecta(d){
    if((d.estatus||'pendiente')!=='pendiente' || d.autorizacionDirecta) return false;
    var paso = _cpPasoActivo(d);
    return !!(paso && paso.label==='Jefe de área' && _cpPermisoPara(d));
  }

  // ── Aplicación de la autorización directa ──
  // Antes: corría con CADA cambio en CADA navegador abierto, con una
  // transacción por requisición (1 lectura + 1 escritura) y reintentos
  // automáticos del SDK — cuando la cuota se agotó, eso generó la cascada
  // de errores 429. Ahora:
  //  · Solo la ejecutan administradores o aprobadores de Compras.
  //  · Automático: máximo una vez por requisición por sesión, 4 s después
  //    del último cambio (agrupa todo en un solo envío).
  //  · Se escribe en lotes (writeBatch) de 10: 0 lecturas, 1 escritura por
  //    requisición. Las escrituras son idempotentes (mismos valores y una
  //    entrada de bitácora idéntica que arrayUnion no duplica), así que un
  //    reintento o dos personas a la vez no duplican nada.
  //  · Si la cuota está agotada, no intenta y lo dice claro.
  function _cpEscribiendoEn(idPanel){
    var pnl=document.getElementById(idPanel), f=document.activeElement;
    return !!(pnl && f && pnl.contains(f) && /INPUT|TEXTAREA|SELECT/.test(f.tagName) && (f.value||'')!=='');
  }
  var _cpAutoIntentados = {}, _cpAutoTimer = null, _cpAutoCorriendo = false;
  function _cpProgramarAutoDirectas(){
    clearTimeout(_cpAutoTimer);
    _cpAutoTimer = setTimeout(function(){ _cpAutoDirectas(false); }, 4000);
  }
  function _cpEntradaBitacoraDirecta(permiso){
    var t=_cpDescPermiso(permiso), otorgo = permiso.otorgadoPor ? (permiso.otorgadoPor.nombre||permiso.otorgadoPor.correo) : '—';
    return {tipo:'autorizacion_directa', permisoId:permiso.id||'', por:'sistema',
      detalle:'Pasó directo a Compras sin esperar al jefe. Permiso: '+t.quien+' · '+t.regla+'. Otorgado por: '+otorgo};
  }
  function _cpAutoDirectas(manual, alProgreso){
    var fin = function(r){ if(alProgreso) alProgreso(r); return Promise.resolve(r); };
    if(!manual && !document.getElementById('cp-vista-req')) return fin(null);
    if(!_autDirCache || !_configFlujoCache || !_colaboradoresCache || !window.auth || !window.auth.currentUser) return fin(null);
    if(!_cpPuedeAdministrar()) return fin(manual?{error:'Solo el administrador o los aprobadores de Compras pueden pasarlas.'}:null);
    if(_cpCuotaAgotada && !manual) return fin(null);
    if(manual && _cpCuotaAgotada){ _cpCuotaAgotada=false; var av=document.getElementById('cp-aviso-cuota'); if(av) av.innerHTML=''; } // reintento manual: se vuelve a probar
    if(_cpAutoCorriendo) return fin(manual?{error:'Ya se están pasando, espera unos segundos.'}:null);
    var cand = docs.filter(function(d){ return _cpCandidataDirecta(d) && (manual || !_cpAutoIntentados[d.id]); });
    if(!cand.length) return fin(manual?{total:0, ok:0, fallidas:[]}:null);
    _cpAutoCorriendo = true;
    return cargarFirestore().then(function(fs){
      var lotes=[], TAM=10, ok=0, fallidas=[], aplicadas=[];
      for(var i=0;i<cand.length;i+=TAM) lotes.push(cand.slice(i,i+TAM));
      var ahora = new Date().toISOString();
      var siguiente = function(n){
        if(n>=lotes.length || _cpCuotaAgotada){
          if(_cpCuotaAgotada) lotes.slice(n).forEach(function(l){ l.forEach(function(d){ fallidas.push({folio:d.folio, motivo:'límite de hoy'}); }); });
          return Promise.resolve();
        }
        if(alProgreso) alProgreso({enCurso:true, total:cand.length, hechas:ok});
        var b = fs.writeBatch(window.db), incluidas=[];
        lotes[n].forEach(function(d){
          _cpAutoIntentados[d.id] = true;
          var permiso=_cpPermisoPara(d); if(!permiso) return;
          var flujo=(d.flujoAutorizacion||[]).map(function(f){ return Object.assign({},f); });
          var idx=flujo.findIndex(function(f){ return f.estatus==='pendiente'; });
          if(idx===-1 || flujo[idx].label!=='Jefe de área') return;
          var otorgo = permiso.otorgadoPor ? (permiso.otorgadoPor.nombre||permiso.otorgadoPor.correo) : '—';
          flujo[idx].estatus='aprobado'; flujo[idx].via='autorizacion_directa'; flujo[idx].fecha=ahora;
          flujo[idx].nota='Autorización directa — permiso otorgado por '+otorgo;
          for(var k=idx+1;k<flujo.length;k++){ if(flujo[k].estatus!=='aprobado') flujo[k].estatus='pendiente'; }
          var t=_cpDescPermiso(permiso);
          b.update(fs.doc(window.db,'requisiciones_compra',d.id), {
            flujoAutorizacion:flujo,
            autorizacionDirecta:{permisoId:permiso.id, tipo:permiso.tipo, limite:Number(permiso.limite)||0, categorias:permiso.categorias||[],
              descripcion:t.quien+' · '+t.regla, otorgadoPor:permiso.otorgadoPor||null, otorgadoEn:permiso.otorgadoEn||null,
              aplicadoEn:ahora, aplicadoPorSistema:true, sesion:_cpMiCorreo()},
            bitacora: fs.arrayUnion(_cpEntradaBitacoraDirecta(permiso)),
          });
          incluidas.push(d);
        });
        if(!incluidas.length) return siguiente(n+1);
        return b.commit().then(function(){ ok+=incluidas.length; aplicadas=aplicadas.concat(incluidas); },
          function(e){ incluidas.forEach(function(d){ fallidas.push({folio:d.folio, motivo:_cpEsCuota(e)?'límite de hoy':(e.message||String(e))}); }); console.warn('[compras] lote de autorización directa:', e); })
          .then(function(){ return siguiente(n+1); });
      };
      return siguiente(0).then(function(){
        _cpAutoCorriendo = false;
        if(aplicadas.length && window.tcNotificar2 && !_cpCuotaAgotada){
          var aprob = ((_configFlujoCache||{}).aprobadoresCompras||[]).filter(function(a){ return a.correo && a.correo.toLowerCase()!==_cpMiCorreo(); });
          var msg = aplicadas.length===1 ? 'Requisición '+(aplicadas[0].folio||'')+' llegó directo a Compras (autorización directa)' : aplicadas.length+' requisiciones llegaron directo a Compras (autorización directa)';
          aprob.forEach(function(a){ _cpAvisar(a.correo, msg, ''); });
        }
        if(aplicadas.length && !manual) toast(aplicadas.length===1 ? '1 requisición pasó directo a Compras' : aplicadas.length+' requisiciones pasaron directo a Compras');
        return fin({total:cand.length, ok:ok, fallidas:fallidas});
      });
    }).catch(function(e){ _cpAutoCorriendo=false; return fin({error:_cpMsgError(e,'pasar las requisiciones')}); });
  }

  // Si el precio real pasa el límite, regresa a su jefe. Devuelve true si regresó.
  function _cpRevisarLimiteDirecto(fs, d, cot){
    var ad = d.autorizacionDirecta;
    if(!ad || ad.revertida || !(Number(ad.limite)>0) || !(Number(cot.monto)>Number(ad.limite))) return Promise.resolve(false);
    var ahora = new Date().toISOString();
    var flujo = (d.flujoAutorizacion||[]).map(function(f){ return Object.assign({},f); });
    var jefeIdx = flujo.findIndex(function(f){ return f.label==='Jefe de área'; });
    flujo.forEach(function(f,i){
      if(i>=jefeIdx && jefeIdx>-1){ f.estatus='pendiente'; delete f.fecha; delete f.uid; delete f.via; delete f.nota; }
    });
    var revertida = {fecha:ahora, monto:Number(cot.monto), limite:Number(ad.limite), por:_cpMiCorreo()};
    return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',d.id), {
      estatus:'pendiente', flujoAutorizacion:flujo,
      'autorizacionDirecta.revertida': revertida,
      cotizacionPropuesta: cot,
      bitacora: fs.arrayUnion({tipo:'directo_revertido', fecha:ahora, por:_cpMiCorreo(),
        detalle:'El precio elegido ('+_cpMoney(cot.monto)+', '+(cot.proveedor||'')+') pasa el límite del permiso ('+_cpMoney(ad.limite)+'). Regresó a que su jefe la apruebe.'}),
    }).then(function(){
      if(jefeIdx>-1) _cpNotificarPaso(fs, d, flujo[jefeIdx]);
      alert('El precio ('+_cpMoney(cot.monto)+') pasa el límite de la autorización directa ('+_cpMoney(ad.limite)+').\n\nLa requisición regresó a que su jefe la apruebe. La cotización quedó guardada; cuando la aprueben, solo vuelve a elegirla.');
      return true;
    });
  }

  function _cpChipDirecto(d){
    var ad = d.autorizacionDirecta; if(!ad) return '';
    if(ad.revertida) return '<span class="cp-chip" style="background:#FEF3C7;color:#92400E" title="El precio pasó el límite del permiso">'+_cpIco('reloj')+'Regresó a su jefe</span>';
    return '<span class="cp-chip" style="background:#EEF2FF;color:#3730A3" title="'+esc(ad.descripcion||'')+'">'+_cpIco('rayo')+'Autorización directa</span>';
  }

  // ── Panel: permisos + bitácora ──
  var _cpAdTab = 'permisos';
  window.__cpAbrirAutDirecta = function(tab){
    if(tab) _cpAdTab = tab;
    Promise.all([cargarAutDirecta(true), cargarConfigFlujo(), cargarColaboradores()]).then(function(){
      var ov = document.getElementById('cp-ad-overlay');
      if(!ov){
        _cpInyectarEstilos();
        ov = document.createElement('div'); ov.id='cp-ad-overlay'; ov.className='cp-scope';
        ov.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2100;display:flex;align-items:center;justify-content:center;padding:18px';
        ov.onclick=function(e){ if(e.target===ov) ov.remove(); };
        document.body.appendChild(ov);
      }
      var admin = _cpPuedeAdministrar();
      var tabBtn = function(id,lbl){ var on=_cpAdTab===id; return '<button onclick="window.__cpAbrirAutDirecta(\''+id+'\')" style="padding:9px 2px;border:none;background:none;font-size:13px;font-weight:700;cursor:pointer;color:'+(on?'#0A1628':'#94A3B8')+';border-bottom:2px solid '+(on?'#0A1628':'transparent')+'">'+lbl+'</button>'; };
      var cuerpo = _cpAdTab==='bitacora' ? _cpAdBitacoraHTML() : _cpAdPermisosHTML(admin);
      ov.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Autorización directa" style="background:#fff;border-radius:14px;max-width:860px;width:100%;max-height:90vh;overflow-y:auto;padding:22px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:6px"><div><h3 style="margin:0;font-size:17px;color:#0A1628;display:flex;align-items:center;gap:8px">'+_cpIco('rayo')+'Autorización directa</h3>' +
        '<p style="font-size:12.5px;color:#5C7089;margin:4px 0 0">Las personas de esta lista <b>no esperan a su jefe</b>: su requisición pasa sola a Compras. Si el precio final pasa su límite, regresa sola a que su jefe la apruebe.</p></div>' +
        '<button aria-label="Cerrar" onclick="document.getElementById(\'cp-ad-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;flex-shrink:0">✕</button></div>' +
        '<div style="display:flex;gap:20px;border-bottom:1px solid #EEF2F7;margin:12px 0 16px">'+tabBtn('permisos','Quién tiene permiso')+tabBtn('bitacora','Bitácora')+'</div>' +
        cuerpo + '</div>';
    });
  };

  function _cpAdPermisosHTML(admin){
    var c = _autDirCache;
    var pend = docs.filter(_cpCandidataDirecta).length;
    var html = '';
    if(!admin) html += '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;font-size:12px;color:#5C7089;margin-bottom:12px">Solo el administrador del portal o los aprobadores de Compras pueden dar o quitar permisos. Tú puedes consultarlos.</div>';
    if(pend) html += '<div style="background:#EEF2FF;border-radius:10px;padding:10px 12px;font-size:12.5px;color:#3730A3;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap"><span style="flex:1"><b>'+pend+'</b> '+(pend===1?'requisición está esperando a su jefe pero ya puede':'requisiciones están esperando a su jefe pero ya pueden')+' pasar directo.</span>'+(admin?'<button class="cp-btn prim" id="cp-ad-pasar" onclick="window.__cpAplicarAhora()">Pasarlas ahora</button>':'')+'</div>';
    html += '<div id="cp-ad-progreso" aria-live="polite"></div>';
    html += c.permisos.length ? '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">' + c.permisos.map(function(p,i){
      var t = _cpDescPermiso(p), on = p.activo!==false;
      var otorgo = p.otorgadoPor ? _cpTitulo(p.otorgadoPor.nombre||p.otorgadoPor.correo) : '—';
      var usos = docs.filter(function(d){ return d.autorizacionDirecta && d.autorizacionDirecta.permisoId===p.id; }).length;
      return '<div style="border:1px solid #E5EAF1;border-left:4px solid '+(on?'#4F46E5':'#CBD5E1')+';border-radius:10px;padding:10px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;opacity:'+(on?1:.65)+'">' +
        '<div style="flex:1;min-width:220px"><p style="margin:0;font-size:13px;font-weight:800;color:#0A1628">'+esc(t.quien)+(on?'':' <span class="cp-chip" style="background:#F1F5F9;color:#5C7089">En pausa</span>')+'</p>' +
        '<p style="margin:2px 0 0;font-size:12px;color:#334155">Pasa directo '+esc(t.regla)+'</p>' +
        '<p style="margin:2px 0 0;font-size:11px;color:#94A3B8">Lo dio: '+esc(otorgo)+(p.otorgadoEn?' · '+new Date(p.otorgadoEn).toLocaleDateString('es-MX'):'')+' · Usado '+usos+' '+(usos===1?'vez':'veces')+(p.nota?' · '+esc(p.nota):'')+'</p></div>' +
        (admin ? '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="cp-btn" onclick="window.__cpAdForm('+i+')">Editar</button><button class="cp-btn" onclick="window.__cpAdPausar('+i+')">'+(on?'Pausar':'Reactivar')+'</button><button class="cp-btn" style="color:#B91C1C" onclick="window.__cpAdQuitar('+i+')">Quitar</button></div>' : '') +
      '</div>';
    }).join('') + '</div>'
    : '<div style="text-align:center;padding:24px 10px;color:#64748B;font-size:12.5px;background:#F8FAFC;border-radius:12px;margin-bottom:16px">Todavía nadie tiene autorización directa.<br>Agrega a los gerentes o personas que no deben esperar firma de su jefe.</div>';
    if(admin) html += '<div id="cp-ad-form"></div><button class="cp-btn" id="cp-ad-btn-nuevo" style="background:#0A1628;color:#fff;border-color:#0A1628" onclick="window.__cpAdForm(-1)">+ Dar permiso a alguien</button>';
    return html;
  }

  window.__cpAdForm = function(idx){
    var p = idx>-1 ? _autDirCache.permisos[idx] : {tipo:'persona', limite:'', categorias:['todas'], nota:''};
    var opcColab = (_colaboradoresCache||[]).filter(function(c){ return c.correo||c.id; }).sort(function(a,b){ return String(a.nombre||'').localeCompare(String(b.nombre||''),'es'); })
      .map(function(c){ var co=(c.correo||c.id).toLowerCase(); return '<option value="'+esc(co)+'"'+((p.correo||'').toLowerCase()===co?' selected':'')+'>'+esc(_cpTitulo(c.nombre||co))+(c.departamento?' · '+esc(c.departamento):'')+'</option>'; }).join('');
    var opcDep = DEPTOS_CP.map(function(dp){ return '<option'+(p.departamento===dp?' selected':'')+'>'+esc(dp)+'</option>'; }).join('');
    var cats = p.categorias||['todas'];
    var chk = function(id,lbl,ej){ return '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;color:#0A1628;cursor:pointer"><input type="checkbox" class="cp-ad-cat" value="'+id+'"'+(cats.indexOf(id)>-1?' checked':'')+' onchange="window.__cpAdCatCambio(this)" style="margin-top:2px"><span><b>'+lbl+'</b>'+(ej?'<br><span style="color:#94A3B8;font-size:11px">'+ej+'</span>':'')+'</span></label>'; };
    var lab = 'display:block;font-size:11.5px;font-weight:700;color:#5C7089;margin:0 0 5px';
    var inp = 'width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;box-sizing:border-box;font-family:inherit';
    document.getElementById('cp-ad-form').innerHTML =
      '<div style="border:1.5px solid #C7D2FE;background:#F8FAFF;border-radius:12px;padding:16px;margin-bottom:12px">' +
      '<p style="margin:0 0 12px;font-size:13.5px;font-weight:800;color:#0A1628">'+(idx>-1?'Editar permiso':'Dar autorización directa')+'</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:12px">' +
        '<div><label style="'+lab+'">¿A quién?</label><select id="cp-ad-tipo" style="'+inp+'" onchange="window.__cpAdTipoCambio(this.value)">' +
          '<option value="persona"'+(p.tipo==='persona'?' selected':'')+'>A una persona</option>' +
          '<option value="rol"'+(p.tipo==='rol'?' selected':'')+'>A todos los jefes de área</option>' +
          '<option value="departamento"'+(p.tipo==='departamento'?' selected':'')+'>A todo un departamento</option></select></div>' +
        '<div id="cp-ad-w-persona" style="display:'+(p.tipo==='persona'?'block':'none')+'"><label style="'+lab+'">Persona</label><select id="cp-ad-persona" style="'+inp+'"><option value="">Elegir…</option>'+opcColab+'</select></div>' +
        '<div id="cp-ad-w-depto" style="display:'+(p.tipo==='departamento'?'block':'none')+'"><label style="'+lab+'">Departamento</label><select id="cp-ad-depto" style="'+inp+'"><option value="">Elegir…</option>'+opcDep+'</select></div>' +
        '<div id="cp-ad-w-rol" style="display:'+(p.tipo==='rol'?'block':'none')+';font-size:11.5px;color:#5C7089;align-self:end;padding-bottom:6px">Aplica a quien esté registrado como jefe en "Configurar flujo".</div>' +
        '<div><label style="'+lab+'">Límite por compra (pesos)</label><input id="cp-ad-limite" type="number" min="0" step="100" inputmode="decimal" placeholder="Vacío = sin límite" value="'+(Number(p.limite)>0?Number(p.limite):'')+'" style="'+inp+'">' +
        '<span style="font-size:10.5px;color:#94A3B8">Si el precio final pasa esta cantidad, la requisición regresa a su jefe.</span></div>' +
      '</div>' +
      '<label style="'+lab+'">¿Para qué tipo de compras?</label>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px;margin-bottom:12px">' +
        chk('todas','Todo tipo de compra','') + CATS_CP.map(function(c){ return chk(c.id,c.label,c.ej); }).join('') +
      '</div>' +
      '<label style="'+lab+'">Nota (opcional)</label><input id="cp-ad-nota" value="'+esc(p.nota||'')+'" placeholder="Ej. Gerente de Flotilla — compras de taller" style="'+inp+';margin-bottom:12px">' +
      '<p id="cp-ad-error" role="alert" style="display:none;color:#B91C1C;font-size:12px;font-weight:700;margin:0 0 10px"></p>' +
      '<div style="display:flex;gap:8px"><button class="cp-btn" style="flex:1;justify-content:center;background:#12A150;color:#fff;border-color:#12A150" onclick="window.__cpAdGuardar('+idx+')">Guardar permiso</button>' +
      '<button class="cp-btn" onclick="document.getElementById(\'cp-ad-form\').innerHTML=\'\';document.getElementById(\'cp-ad-btn-nuevo\').style.display=\'\'">Cancelar</button></div></div>';
    document.getElementById('cp-ad-btn-nuevo').style.display='none';
    var _f=document.getElementById('cp-ad-form'); if(_f.scrollIntoView) _f.scrollIntoView({behavior:'smooth', block:'nearest'});
  };
  window.__cpAdTipoCambio = function(t){
    document.getElementById('cp-ad-w-persona').style.display = t==='persona'?'block':'none';
    document.getElementById('cp-ad-w-depto').style.display = t==='departamento'?'block':'none';
    document.getElementById('cp-ad-w-rol').style.display = t==='rol'?'block':'none';
  };
  window.__cpAdCatCambio = function(el){
    var all = document.querySelectorAll('.cp-ad-cat');
    if(el.value==='todas' && el.checked) all.forEach(function(x){ if(x.value!=='todas') x.checked=false; });
    if(el.value!=='todas' && el.checked) all.forEach(function(x){ if(x.value==='todas') x.checked=false; });
  };
  function _cpAdGuardarDoc(cambio){
    return cargarFirestore().then(function(fs){
      var c = _autDirCache;
      c.historial = (c.historial||[]).concat([Object.assign({fecha:new Date().toISOString(), por:{correo:_cpMiCorreo(), nombre:_cpMiNombre()}}, cambio)]).slice(-300);
      return fs.setDoc(fs.doc(window.db,'config_flujo_compras','autorizacion_directa'), {permisos:c.permisos, historial:c.historial});
    });
  }
  window.__cpAdGuardar = function(idx){
    if(!_cpPuedeAdministrar()) return;
    var err = function(m){ var e=document.getElementById('cp-ad-error'); e.textContent=m; e.style.display='block'; };
    var tipo = document.getElementById('cp-ad-tipo').value;
    var nuevo = {tipo:tipo};
    if(tipo==='persona'){
      var co = document.getElementById('cp-ad-persona').value; if(!co) return err('Elige a la persona.');
      nuevo.correo = co; nuevo.nombre = nombrePorCorreo(co)||co; nuevo.departamento = departamentoPorCorreo(co)||'';
    } else if(tipo==='departamento'){
      var dp = document.getElementById('cp-ad-depto').value; if(!dp) return err('Elige el departamento.');
      nuevo.departamento = dp;
    } else { nuevo.rol = 'jefes_area'; }
    var lim = document.getElementById('cp-ad-limite').value;
    if(lim!=='' && !(Number(lim)>=0)) return err('El límite debe ser un número (o déjalo vacío para "sin límite").');
    nuevo.limite = lim==='' ? 0 : Number(lim);
    var cats = Array.prototype.map.call(document.querySelectorAll('.cp-ad-cat:checked'), function(x){ return x.value; });
    if(!cats.length) return err('Elige al menos un tipo de compra.');
    nuevo.categorias = cats;
    nuevo.nota = (document.getElementById('cp-ad-nota').value||'').trim();
    var c = _autDirCache, antes = idx>-1 ? c.permisos[idx] : null;
    if(antes){
      nuevo = Object.assign({}, antes, nuevo);
    } else {
      nuevo.id = 'p'+Date.now(); nuevo.activo = true;
      nuevo.otorgadoPor = {correo:_cpMiCorreo(), nombre:_cpMiNombre()}; nuevo.otorgadoEn = new Date().toISOString();
    }
    if(antes) c.permisos[idx] = nuevo; else c.permisos.push(nuevo);
    var t = _cpDescPermiso(nuevo);
    _cpAdGuardarDoc({tipo:antes?'permiso_modificado':'permiso_otorgado', permisoId:nuevo.id, detalle:t.quien+' · '+t.regla}).then(function(){
      toast(antes?'Permiso actualizado':'Permiso otorgado a '+t.quien);
      window.__cpAbrirAutDirecta('permisos'); renderKPIs(); renderBoard(); _cpProgramarAutoDirectas();
    }).catch(function(e){ cargarAutDirecta(true); err('No se pudo guardar: '+(e.message||e)+'. Si dice "permission" o "policy", revisa las reglas (RLS) de la tabla compras_config en Supabase.'); });
  };
  window.__cpAdPausar = function(i){
    if(!_cpPuedeAdministrar()) return;
    var p = _autDirCache.permisos[i]; p.activo = p.activo===false;
    var t = _cpDescPermiso(p);
    _cpAdGuardarDoc({tipo:p.activo?'permiso_reactivado':'permiso_pausado', permisoId:p.id, detalle:t.quien+' · '+t.regla}).then(function(){ window.__cpAbrirAutDirecta('permisos'); renderKPIs(); renderBoard(); });
  };
  window.__cpAdQuitar = function(i){
    if(!_cpPuedeAdministrar()) return;
    var p = _autDirCache.permisos[i], t = _cpDescPermiso(p);
    if(!confirm('¿Quitar la autorización directa de '+t.quien+'?\n\nSus próximas requisiciones volverán a esperar a su jefe. Lo que ya pasó no cambia y queda en la bitácora.')) return;
    _autDirCache.permisos.splice(i,1);
    _cpAdGuardarDoc({tipo:'permiso_retirado', permisoId:p.id, detalle:t.quien+' · '+t.regla}).then(function(){ window.__cpAbrirAutDirecta('permisos'); renderKPIs(); renderBoard(); });
  };
  window.__cpAplicarAhora = function(){
    var box=document.getElementById('cp-ad-progreso'), btn=document.getElementById('cp-ad-pasar');
    var pintar=function(html, tono){
      var c={info:['#EFF6FF','#1E3A8A','#BFDBFE'], ok:['#F0FDF4','#14532D','#BBF7D0'], mal:['#FEF2F2','#7F1D1D','#FCA5A5']}[tono||'info'];
      if(box) box.innerHTML='<div role="status" style="background:'+c[0]+';color:'+c[1]+';border:1px solid '+c[2]+';border-radius:10px;padding:10px 12px;font-size:12.5px;margin-bottom:12px">'+html+'</div>';
    };
    if(btn){ btn.disabled=true; btn.textContent='Pasando…'; }
    pintar('Revisando cuáles pueden pasar…');
    _cpAutoDirectas(true, function(r){
      if(!r) return;
      if(r.enCurso){ pintar('Pasando <b>'+Math.min(r.total, r.hechas+10)+'</b> de <b>'+r.total+'</b>…'); return; }
      if(btn){ btn.disabled=false; btn.textContent='Pasarlas ahora'; }
      if(r.error){ pintar('<b>No se pudieron pasar.</b> '+esc(r.error), 'mal'); return; }
      if(!r.total){ pintar('No hay requisiciones pendientes que puedan pasar directo.', 'ok'); return; }
      if(!r.fallidas.length){ pintar('<b>Listo:</b> '+r.ok+' '+(r.ok===1?'requisición pasó':'requisiciones pasaron')+' directo a Compras. Quedó registrado en la bitácora.', 'ok'); }
      else {
        var cuota = r.fallidas.some(function(f){ return f.motivo==='límite de hoy'; });
        pintar((r.ok?'Pasaron <b>'+r.ok+'</b>. ':'')+'<b>'+r.fallidas.length+'</b> no se pudieron ('+esc(r.fallidas.map(function(f){return f.folio;}).join(', '))+'). '+
          (cuota?esc(MSG_CUOTA):'Puedes volver a intentarlo: no se duplica nada.')+' <button class="cp-btn" style="margin-left:6px" onclick="window.__cpAplicarAhora()">Reintentar</button>', 'mal');
      }
      setTimeout(function(){ if(document.getElementById('cp-ad-overlay') && !r.fallidas.length) window.__cpAbrirAutDirecta('permisos'); }, 2500);
    });
  };

  // Bitácora unificada: cambios de permisos + cada vez que se usó o se revirtió.
  function _cpBitacoraFilas(){
    var TIP = {permiso_otorgado:'Dio permiso', permiso_modificado:'Cambió permiso', permiso_pausado:'Pausó permiso', permiso_reactivado:'Reactivó permiso', permiso_retirado:'Quitó permiso',
               autorizacion_directa:'Pasó directo a Compras', directo_revertido:'Regresó a su jefe (pasó el límite)'};
    var filas = (_autDirCache.historial||[]).map(function(h){
      return {fecha:h.fecha, que:TIP[h.tipo]||h.tipo, folio:'', quien:(h.por&&(h.por.nombre||h.por.correo))||'—', detalle:h.detalle||'', otorgo:'', compro:''};
    });
    docs.forEach(function(d){
      (d.bitacora||[]).forEach(function(b){
        if(b.tipo!=='autorizacion_directa' && b.tipo!=='directo_revertido') return;
        var ad = d.autorizacionDirecta||{};
        filas.push({fecha:b.fecha || (b.tipo==='autorizacion_directa' && ad.aplicadoEn) || '', que:TIP[b.tipo], folio:d.folio||d.id, id:d.id, quien:_cpTitulo(nombrePorCorreo(d.solicitante)||'—'),
          detalle:b.detalle||'', otorgo:ad.otorgadoPor?_cpTitulo(ad.otorgadoPor.nombre||ad.otorgadoPor.correo):'—',
          compro:(d.items||[]).map(function(it){ return (it.cant||'')+' '+(it.unidad||'')+' '+(it.desc||''); }).join('; ')});
      });
    });
    return filas.sort(function(a,b){ return String(b.fecha).localeCompare(String(a.fecha)); });
  }
  function _cpAdBitacoraHTML(){
    var filas = _cpBitacoraFilas();
    if(!filas.length) return '<div style="text-align:center;padding:24px;color:#64748B;font-size:12.5px;background:#F8FAFC;border-radius:12px">Aún no hay movimientos. Aquí aparecerá quién dio cada permiso y cada requisición que pasó directo.</div>';
    return '<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="cp-btn" onclick="window.__cpAdExportar()">'+_cpIco('bajar')+'Exportar a Excel (CSV)</button></div>' +
      '<div style="overflow-x:auto;border:1px solid #EEF2F7;border-radius:12px"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:720px"><thead><tr style="background:#F8FAFC;text-align:left">' +
      ['Cuándo','Qué pasó','Requisición','Quién','Permiso dado por','Qué se pidió'].map(function(h){ return '<th style="padding:9px 10px;font-size:10.5px;color:#5C7089;text-transform:uppercase">'+h+'</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function(f){
        return '<tr style="border-top:1px solid #EEF2F7"><td style="padding:8px 10px;white-space:nowrap">'+(f.fecha?new Date(f.fecha).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}):'—')+'</td>' +
          '<td style="padding:8px 10px;font-weight:700">'+esc(f.que)+'<div style="font-weight:400;color:#64748B;font-size:11px">'+esc(f.detalle)+'</div></td>' +
          '<td style="padding:8px 10px;white-space:nowrap">'+(f.id?'<a href="#" onclick="document.getElementById(\'cp-ad-overlay\').remove();window.__cpAbrirDetalle(\''+f.id+'\');return false" style="color:#1473E6;font-weight:700">'+esc(f.folio)+'</a>':'—')+'</td>' +
          '<td style="padding:8px 10px">'+esc(f.quien)+'</td><td style="padding:8px 10px">'+esc(f.otorgo||'—')+'</td>' +
          '<td style="padding:8px 10px;color:#334155;max-width:240px">'+esc(f.compro||'—')+'</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  window.__cpAdExportar = function(){
    var filas = _cpBitacoraFilas();
    var lineas = [['Fecha','Qué pasó','Detalle','Requisición','Quién','Permiso dado por','Qué se pidió'].join(',')];
    filas.forEach(function(f){
      lineas.push([f.fecha?new Date(f.fecha).toLocaleString('es-MX'):'', f.que, f.detalle, f.folio, f.quien, f.otorgo, f.compro]
        .map(function(v){ v=String(v==null?'':v).replace(/"/g,'""'); return /[,"\n]/.test(v)?'"'+v+'"':v; }).join(','));
    });
    var blob = new Blob(['\uFEFF'+lineas.join('\r\n')], {type:'text/csv;charset=utf-8'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'bitacora_autorizacion_directa_'+new Date().toISOString().slice(0,10)+'.csv'; a.click();
  };

  // ══════════════════════════════════════════════════════════════════
  //  FASE 3 — SOLICITUDES DE COTIZACIÓN (bidireccionales)
  //  Colección 'solicitudes_cotizacion' (folio SC-0001…):
  //   · Cualquier departamento (p. ej. Ventas) pide un precio → Compras.
  //   · Compras pregunta a proveedores (correo / WhatsApp / copiar / PDF),
  //     registra respuestas, compara y manda opciones al solicitante.
  //   · El solicitante elige → se convierte sola en requisición (RCC-0001…)
  //     y desde ahí ve si ya se compró, si viene en camino o si hay que ir
  //     por ella a la paquetería.
  //   · Desde una requisición en "Buscando precios" también se puede abrir
  //     una solicitud; al aceptar una respuesta se genera la orden de compra
  //     y su PDF (se arma al momento, no se guarda en la base de datos).
  // ══════════════════════════════════════════════════════════════════
  var _scCol = null, _scDocs = [], _scUnsub = null, _scDetalleId = null, _scDetalleModo = 'compras';
  var _scF = {texto:'', depto:'', proveedor:'', categoria:'', desde:'', hasta:'', montoMin:'', montoMax:'', kpi:''};
  var EMPRESAS_CP = ['TECNOCONTROL','JOMAR','VH','TECNOLAB'];
  var SC_EST = {
    nueva:      {lbl:'Recibida, esperando a Compras',        corto:'Por atender',          col:'#B45309'},
    preguntando:{lbl:'Compras está preguntando a proveedores',corto:'Preguntando precios',  col:'#1473E6'},
    con_precios:{lbl:'Ya hay precios; Compras los compara',   corto:'Con precios',          col:'#1473E6'},
    lista:      {lbl:'Precio listo: te toca decidir',         corto:'Esperando al solicitante', col:'#6D28D9'},
    convertida: {lbl:'Ya es requisición',                     corto:'Convertida',           col:'#12A150'},
    cancelada:  {lbl:'Cancelada',                             corto:'Cancelada',            col:'#94A3B8'},
  };
  var SC_PASOS = ['Enviada','En cotización','Cotizada','Aprobación','Comprada','En camino','Recibida'];

  function _scFecha(x){ if(!x) return null; if(x.toDate) return x.toDate(); var f=new Date(x); return isNaN(f)?null:f; }
  function _scFmt(x, conHora){ var f=_scFecha(x); if(!f) return '—'; return conHora ? f.toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'}) : f.toLocaleDateString('es-MX'); }
  function _scAbierta(sc){ return sc.estatus!=='convertida' && sc.estatus!=='cancelada'; }
  // Precios y proveedores: Compras siempre; Ventas solo en lo que Ventas pidió; nadie más (oct-2026).
  function _scEsVentas(sc){ return _cpNorm(sc&&sc.departamento)==='ventas'; }
  function _scVePrecios(sc){ return _scDetalleModo==='compras' || _scEsVentas(sc); }
  // Historial sin precios ni nombres de proveedor para quien no debe verlos.
  function _scHistSeguro(e, ve){
    if(ve) return e.texto||'';
    switch(e.tipo){
      case 'creada': case 'comentario': case 'cancelada': case 'comprada': return e.texto||'';
      case 'enviada': return 'Compras pidió precio a un proveedor';
      case 'respuesta': return 'Compras recibió una cotización';
      case 'aceptada': case 'compartida': return 'Compras ya tiene precio';
      case 'convertida': { var m=String(e.texto||'').match(/requisici[oó]n\s+(\S+)/i); return 'Se convirtió en requisición'+(m?' '+m[1]:''); }
      default: return null;
    }
  }
  // Datos de referencia que trajo el solicitante (link, tienda, precio visto en la tienda).
  function _scRefPartida(pt){
    var r=[];
    if(pt.tiendaRef) r.push('<span class="cp-chip" style="background:#F1F5F9;color:#334155">'+esc(pt.tiendaRef)+'</span>');
    if(pt.precioRef) r.push('<span class="cp-chip" style="background:#F1F5F9;color:#334155">Precio visto: '+_cpMoney(pt.precioRef)+'</span>');
    if(pt.link) r.push('<a href="'+esc(pt.link)+'" target="_blank" rel="noopener" style="font-size:11.5px;color:#1473E6;font-weight:700;text-decoration:none">Ver producto</a>');
    return r.length?'<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:5px">'+r.join('')+'</div>':'';
  }
  function _scReq(sc){ return sc.requisicionId ? docs.find(function(d){ return d.id===sc.requisicionId; }) : null; }
  function _scMejor(sc){
    var rs = (sc.respuestas||[]).filter(function(r){ return r.estado!=='rechazada' && Number(r.precioTotal)>0; });
    if(!rs.length) return null;
    return rs.slice().sort(function(a,b){ return Number(a.precioTotal)-Number(b.precioTotal); })[0];
  }
  function _scAprobadoresCompras(){ return ((_configFlujoCache||{}).aprobadoresCompras||[]).filter(function(a){ return a.correo; }); }
  function _cpAvisar(para, mensaje, link){
    if(!para || !window.tcNotificar2) return;
    cargarFirestore().then(function(fs){
      window.tcNotificar2(fs, window.db, {para:String(para).toLowerCase().trim(), tipo:'compras_aviso', mensaje:mensaje, link:link||'', leido:false, creadaEn:new Date().toISOString()})
        .catch(function(e){ console.warn('[compras] aviso', e); });
    });
  }
  function _scAvisarCompras(mensaje){ _scAprobadoresCompras().forEach(function(a){ if(a.correo.toLowerCase()!==_cpMiCorreo()) _cpAvisar(a.correo, mensaje, ''); }); }
  function _scAvisarSolicitante(sc, mensaje){ var c = sc.solicitante && sc.solicitante.correo; if(c && c.toLowerCase()!==_cpMiCorreo()) _cpAvisar(c, mensaje, ''); }

  // Folio consecutivo con transacción (mismo patrón de contador atómico del portal).
  // Folio consecutivo atómico en Supabase (función compras_siguiente_folio):
  // nunca se repite aunque dos personas guarden al mismo tiempo.
  function _cpSiguienteFolio(fs, docId, prefijo){
    return window.tcCpSiguienteFolio(prefijo);
  }

  function escucharSC(){
    if(_scUnsub) return;
    _scUnsub = 'cargando';
    cargarFirestore().then(function(fs){
      var primera = true;
      _scCol = _cpColeccionDividida(fs, 'solicitudes_cotizacion', ['nueva','preguntando','con_precios','lista'], function(){
        _scDocs = _scCol.lista().sort(function(a,b){ return (_scFecha(b.createdAt)||0)-(_scFecha(a.createdAt)||0); });
        if(primera){ primera=false; _scCol.cargarCerradas(); }
        _scRefrescarVistas();
      }, function(err){
        console.error('[compras] solicitudes_cotizacion:', err);
        var el=document.getElementById('cp-sc-lista');
        if(el) el.innerHTML='<div style="padding:20px;text-align:center;color:#B91C1C;font-size:12.5px">'+esc(_cpMsgError(err,'leer las cotizaciones'))+(String(err.message||'').indexOf('ermission')>-1?'<br>Revisa las reglas (RLS) de la tabla <b>compras_solicitudes</b> en Supabase.':'')+'</div>';
      });
      _scUnsub = _scCol.unsub;
    });
  }

  function _scRefrescarVistas(){
    renderCotizaciones();
    _cpdRender();
    _scBadgeTab();
    if(_scDetalleId){
      var pnl = document.getElementById('sc-overlay-p');
      var foco = document.activeElement;
      var escribiendo = pnl && foco && pnl.contains(foco) && /INPUT|TEXTAREA|SELECT/.test(foco.tagName);
      if(!escribiendo) window.__scAbrirDetalle(_scDetalleId, _scDetalleModo, true);
    }
  }
  function _scBadgeTab(){
    var b=document.getElementById('cp-mtab-cot-n'); if(!b) return;
    var n=_scDocs.filter(function(s){ return s.estatus==='nueva'; }).length;
    b.textContent=n; b.style.display=n?'inline-block':'none';
  }

  // ── Línea de tiempo para quien pidió (incluye la requisición y el envío) ──
  function _scPasoIdx(sc){
    if(sc.estatus==='cancelada') return -1;
    var req = sc.estatus==='convertida' ? _scReq(sc) : null;
    if(req){
      if(req.estatus==='recibida') return 6;
      if(req.envio && ['enviado','en_camino','en_reparto','listo_recoger','detenido'].indexOf(req.envio.estado)>-1) return 5;
      if(req.estatus==='orden_generada') return 4;
      return 3;
    }
    return {nueva:0, preguntando:1, con_precios:2, lista:2, convertida:3}[sc.estatus] || 0;
  }
  function _scEstadoTexto(sc){
    var req = sc.estatus==='convertida' ? _scReq(sc) : null;
    if(req){
      if(req.estatus==='rechazada') return 'La requisición '+(req.folio||'')+' fue rechazada';
      if(req.envio && req.estatus!=='recibida') return (ENV_EST[req.envio.estado]||{}).lbl || 'En camino';
      return _cpEstadoAmigable(req).txt + ' ('+(req.folio||'')+')';
    }
    return (SC_EST[sc.estatus]||{}).lbl || sc.estatus;
  }
  function _scTimelineHTML(sc){
    var idx = _scPasoIdx(sc);
    if(idx<0) return '<div style="background:#F1F5F9;border-radius:9px;padding:9px 12px;font-size:12px;color:#5C7089;margin-bottom:12px"><b>Cancelada.</b> '+esc(sc.motivoCancelacion||'')+'</div>';
    return '<div style="display:flex;align-items:flex-start;margin:6px 0 14px;overflow-x:auto;padding-bottom:4px">' + SC_PASOS.map(function(p,i){
      var est = i<idx?'hecho':i===idx?'actual':'espera';
      var bg = est==='hecho'?'#12A150':est==='actual'?'#1473E6':'#F1F5F9', fg = est==='espera'?'#94A3B8':'#fff';
      return '<div style="flex:1;min-width:62px;text-align:center"><div style="width:22px;height:22px;border-radius:50%;background:'+bg+';color:'+fg+';font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 4px">'+(est==='hecho'?'✓':(i+1))+'</div>' +
        '<div style="font-size:9.5px;font-weight:700;color:'+(est==='espera'?'#94A3B8':est==='actual'?'#1473E6':'#12A150')+'">'+esc(p)+'</div></div>' +
        (i<SC_PASOS.length-1?'<div style="flex:.5;min-width:10px;border-top:2px dotted '+(i<idx?'#12A150':'#E2E8F0')+';margin-top:11px"></div>':'');
    }).join('') + '</div>';
  }
  function _scChipEstado(sc){
    var e = SC_EST[sc.estatus]||{corto:sc.estatus,col:'#94A3B8'};
    return '<span class="cp-chip" style="background:'+e.col+'1A;color:'+e.col+'">'+esc(e.corto)+'</span>';
  }

  // ── Proveedores (promesa con caché) ──
  function _scProveedores(){
    if(_proveedoresCache) return Promise.resolve(_proveedoresCache);
    var enCache = _cpCacheGet('prov', 120); if(enCache){ _proveedoresCache = enCache; return Promise.resolve(enCache); }
    return cargarFirestore().then(function(fs){
      return fs.getDocs(fs.query(fs.collection(window.db,'proveedores'), fs.orderBy('nombre'))).then(function(snap){
        _proveedoresCache = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }); _cpCacheSet('prov', _proveedoresCache); return _proveedoresCache;
      }).catch(function(){ return []; });
    });
  }

  // ══ FORMULARIO NUEVO (oct-2026): solicitud-cotizacion.js, compartido con la app
  //    de técnicos. Link de producto, foto/captura y PDF. Si no carga, se usa el clásico. ══
  var _scModPromesa=null;
  function _scCargarModulo(){
    if(window.tcScAbrirFormulario) return Promise.resolve();
    if(_scModPromesa) return _scModPromesa;
    _scModPromesa=new Promise(function(ok,ko){
      var s=document.createElement('script'); s.src='solicitud-cotizacion.js?v=1';
      s.onload=function(){ ok(); }; s.onerror=function(){ _scModPromesa=null; ko(new Error('No se pudo cargar solicitud-cotizacion.js')); };
      document.head.appendChild(s);
    });
    return _scModPromesa;
  }
  window.__scNueva = function(depto, desdeReqId){
    _scCargarModulo().then(function(){
      window.tcScAbrirFormulario({departamento:depto||'', fijarDepto:!!(depto && depto!=='Compras'), deptos:DEPTOS_CP, empresas:EMPRESAS_CP, categorias:CATS_CP,
        correo:_cpMiCorreo(), nombre:_cpMiNombre(), zIndex:2400,
        alGuardar:function(id){ escucharSC(); setTimeout(function(){ window.__scAbrirDetalle(id, depto==='Compras'?'compras':'solicitante'); }, 500); }});
    }).catch(function(e){ console.warn('[compras] formulario nuevo no disponible, uso el clásico:', e); _scNuevaClasica(depto, desdeReqId); });
  };
  // ══ FORMULARIO CLÁSICO (respaldo): pedir una cotización ══
  var _scFormFotos = [];
  function _scNuevaClasica(depto, desdeReqId){
    _scFormFotos = [];
    var ov=document.createElement('div'); ov.id='sc-form-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:2200;display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
    var inp='width:100%;padding:9px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff';
    var lab='display:block;font-size:12px;font-weight:700;color:#334155;margin:0 0 5px';
    var deptoSel = depto && depto!=='Compras' ? '<input type="hidden" id="sc-f-depto" value="'+esc(depto)+'"><p style="margin:0;font-size:13px;font-weight:700;color:#0A1628;padding:9px 0">'+esc(depto)+'</p>'
      : '<select id="sc-f-depto" style="'+inp+'">'+DEPTOS_CP.map(function(dp){ return '<option'+(dp==='Ventas'?' selected':'')+'>'+esc(dp)+'</option>'; }).join('')+'</select>';
    ov.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Pedir una cotización" style="background:#fff;border-radius:14px;max-width:760px;width:100%;padding:22px;margin:auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px"><h3 style="margin:0;font-size:18px;color:#0A1628">Pedir una cotización</h3>' +
      '<button aria-label="Cerrar" onclick="document.getElementById(\'sc-form-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">✕</button></div>' +
      '<p style="font-size:12.5px;color:#5C7089;margin:0 0 16px">Dinos qué necesitas y Compras te consigue el precio. Te avisaremos en cada paso.</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px">' +
        '<div><label style="'+lab+'">Empresa</label><select id="sc-f-empresa" style="'+inp+'">'+EMPRESAS_CP.map(function(e){ return '<option>'+e+'</option>'; }).join('')+'</select></div>' +
        '<div><label style="'+lab+'">Departamento que pide</label>'+deptoSel+'</div>' +
        '<div><label style="'+lab+'">¿Qué tipo de compra es?</label><select id="sc-f-tipo" style="'+inp+'">'+CATS_CP.map(function(c){ return '<option value="'+c.id+'"'+(c.id==='stock'?' selected':'')+'>'+esc(c.label)+'</option>'; }).join('')+'</select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px">' +
        '<div><label style="'+lab+'">¿Para qué cliente o estación? <span style="font-weight:400;color:#94A3B8">(opcional)</span></label><input id="sc-f-cliente" style="'+inp+'" placeholder="Ej. Gasolinera Las Torres">' +
          '<span style="font-size:10.5px;color:#94A3B8">Esto NO se comparte con los proveedores.</span></div>' +
        '<div><label style="'+lab+'">¿Para cuándo lo necesitas?</label><input id="sc-f-fecha" type="date" style="'+inp+'" onchange="window.__scRevisarUrgencia()"></div>' +
      '</div>' +
      '<p style="'+lab+'margin-top:6px">¿Qué piezas o productos?</p>' +
      '<div id="sc-f-partidas"></div>' +
      '<button type="button" class="cp-btn" style="padding:8px 12px;border:1.5px dashed #CBD5E1;color:#1473E6;margin-bottom:14px;background:#fff;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit" onclick="window.__scAgregarPartida()">+ Agregar otra pieza</button>' +
      '<div style="background:#F8FAFC;border-radius:10px;padding:12px;margin-bottom:14px">' +
        '<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;font-weight:700;color:#0A1628;cursor:pointer"><input type="checkbox" id="sc-f-urgente" onchange="window.__scRevisarUrgencia()"> Es urgente</label>' +
        '<p id="sc-f-urg-ayuda" style="font-size:11px;color:#5C7089;margin:4px 0 0">Se marca sola como urgente si la necesitas en 3 días o menos. Si no, explica por qué es urgente.</p>' +
        '<textarea id="sc-f-urg-motivo" rows="2" placeholder="¿Por qué es urgente? (obligatorio si la marcas)" style="'+inp+';margin-top:8px;display:none"></textarea>' +
      '</div>' +
      '<label style="'+lab+'">Notas para Compras <span style="font-weight:400;color:#94A3B8">(opcional)</span></label><textarea id="sc-f-notas" rows="2" style="'+inp+';margin-bottom:12px" placeholder="Marcas preferidas, si acepta equivalentes, etc."></textarea>' +
      '<label style="'+lab+'">Fotos de la pieza o placa <span style="font-weight:400;color:#94A3B8">(ayudan mucho)</span></label>' +
      '<label style="display:inline-flex;gap:6px;align-items:center;padding:9px 14px;border:1.5px dashed #CBD5E1;border-radius:9px;color:#1473E6;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:6px">+ Agregar fotos<input type="file" accept="image/*" multiple onchange="window.__scFotosForm(this)" style="display:none"></label>' +
      '<div id="sc-f-fotos" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px"></div>' +
      '<p id="sc-f-error" role="alert" style="display:none;color:#B91C1C;font-size:12.5px;font-weight:700;margin:0 0 10px"></p>' +
      '<button id="sc-f-enviar" onclick="window.__scGuardarNueva(\''+esc(desdeReqId||'')+'\')" style="width:100%;padding:13px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit">Mandar a Compras</button>' +
    '</div>';
    document.body.appendChild(ov);
    window.__scAgregarPartida();
  };
  window.__scAgregarPartida = function(){
    var cont=document.getElementById('sc-f-partidas'); if(!cont) return;
    var n = cont.children.length+1;
    var inp='padding:8px 9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;box-sizing:border-box;font-family:inherit;width:100%';
    var div=document.createElement('div'); div.className='sc-partida';
    div.style.cssText='border:1px solid #E5EAF1;border-radius:10px;padding:12px;margin-bottom:8px;background:#fff';
    div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:12px;color:#5C7089">Pieza '+n+'</b>'+(n>1?'<button type="button" onclick="this.closest(\'.sc-partida\').remove()" style="background:none;border:none;color:#B91C1C;font-size:12px;font-weight:700;cursor:pointer">Quitar</button>':'')+'</div>' +
      '<div style="display:grid;grid-template-columns:1fr 90px 110px;gap:8px;margin-bottom:8px">' +
        '<input class="sc-p-desc" placeholder="¿Qué es? Ej. Contactor 3 polos 32A" style="'+inp+'">' +
        '<input class="sc-p-cant" type="number" min="1" value="1" aria-label="Cantidad" style="'+inp+'">' +
        '<input class="sc-p-unidad" value="Pieza" aria-label="Unidad" style="'+inp+'">' +
      '</div>' +
      '<details><summary style="font-size:11.5px;color:#1473E6;font-weight:700;cursor:pointer">Es una pieza técnica: agregar número de parte, marca, modelo…</summary>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:8px">' +
          '<input class="sc-p-parte" placeholder="Número de parte" style="'+inp+'">' +
          '<input class="sc-p-marca" placeholder="Marca" style="'+inp+'">' +
          '<input class="sc-p-modelo" placeholder="Modelo" style="'+inp+'">' +
        '</div>' +
        '<textarea class="sc-p-espec" rows="2" placeholder="Especificaciones (voltaje, medidas, material…)" style="'+inp+';margin-top:8px"></textarea>' +
      '</details>';
    cont.appendChild(div);
  };
  window.__scRevisarUrgencia = function(){
    var f = document.getElementById('sc-f-fecha').value, chk = document.getElementById('sc-f-urgente'), mot = document.getElementById('sc-f-urg-motivo'), ay=document.getElementById('sc-f-urg-ayuda');
    var cerca = f && (new Date(f+'T23:59:59') - Date.now()) <= 3*86400000;
    if(cerca){ chk.checked = true; chk.disabled = true; mot.style.display='none'; ay.textContent='Marcada urgente sola: la necesitas en 3 días o menos.'; }
    else { chk.disabled = false; mot.style.display = chk.checked ? 'block' : 'none'; ay.textContent='Se marca sola como urgente si la necesitas en 3 días o menos. Si no, explica por qué es urgente.'; }
  };
  function _scPintarFotosForm(){
    var c=document.getElementById('sc-f-fotos'); if(!c) return;
    c.innerHTML=_scFormFotos.map(function(s,i){ return '<div style="position:relative"><img src="'+s+'" alt="Foto '+(i+1)+'" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0"><button type="button" aria-label="Quitar foto" onclick="window.__scQuitarFotoForm('+i+')" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#0A1628;color:#fff;font-size:11px;cursor:pointer">✕</button></div>'; }).join('');
  }
  window.__scFotosForm = function(input){
    Array.prototype.forEach.call(input.files||[], function(file){
      var r=new FileReader();
      r.onload=function(){ _cpComprimirImagen(r.result, 1100, 0.7).then(function(src){ _scFormFotos.push(src); _scPintarFotosForm(); }); };
      r.readAsDataURL(file);
    });
    input.value='';
  };
  window.__scQuitarFotoForm = function(i){ _scFormFotos.splice(i,1); _scPintarFotosForm(); };

  window.__scGuardarNueva = function(desdeReqId){
    var err=function(m){ var e=document.getElementById('sc-f-error'); e.textContent=m; e.style.display='block'; e.scrollIntoView&&e.scrollIntoView({block:'nearest'}); };
    var partidas = Array.prototype.map.call(document.querySelectorAll('.sc-partida'), function(el){
      var v=function(c){ var x=el.querySelector(c); return x?String(x.value||'').trim():''; };
      return {desc:v('.sc-p-desc'), cant:Number(v('.sc-p-cant'))||0, unidad:v('.sc-p-unidad')||'Pieza', numeroParte:v('.sc-p-parte'), marca:v('.sc-p-marca'), modelo:v('.sc-p-modelo'), especificaciones:v('.sc-p-espec')};
    }).filter(function(p){ return p.desc; });
    if(!partidas.length) return err('Escribe al menos una pieza o producto.');
    if(partidas.some(function(p){ return !(p.cant>0); })) return err('Cada pieza necesita una cantidad mayor a 0.');
    var fecha = document.getElementById('sc-f-fecha').value;
    var urgente = document.getElementById('sc-f-urgente').checked;
    var cerca = fecha && (new Date(fecha+'T23:59:59') - Date.now()) <= 3*86400000;
    var motivoUrg = (document.getElementById('sc-f-urg-motivo').value||'').trim();
    if(urgente && !cerca && !motivoUrg) return err('Explica por qué es urgente, o quita la marca de urgente.');
    var btn=document.getElementById('sc-f-enviar'); btn.disabled=true; btn.textContent='Mandando…';
    var depto = document.getElementById('sc-f-depto').value;
    var ahora = new Date().toISOString();
    cargarFirestore().then(function(fs){
      return _cpSiguienteFolio(fs,'contador_cotizaciones','SC').then(function(folio){
        var datos = {
          folio:folio, estatus:'nueva', origen: desdeReqId ? 'requisicion' : (depto==='Compras'?'compras':'departamento'),
          departamento:depto, empresa:document.getElementById('sc-f-empresa').value, tipoCompra:document.getElementById('sc-f-tipo').value,
          cliente:(document.getElementById('sc-f-cliente').value||'').trim(), fechaRequerida:fecha||'',
          urgencia: (urgente||cerca) ? 'alta' : 'normal', urgenciaMotivo: cerca ? 'Se necesita en 3 días o menos' : motivoUrg,
          notas:(document.getElementById('sc-f-notas').value||'').trim(), partidas:partidas,
          solicitante:{correo:_cpMiCorreo(), nombre:_cpMiNombre()}, proveedoresInvitados:[], respuestas:[],
          historial:[{tipo:'creada', fecha:ahora, por:_cpMiNombre(), texto:'Pidió la cotización'}],
          numFotos:_scFormFotos.length, createdAt:fs.serverTimestamp(), actualizadoEn:ahora,
        };
        return fs.addDoc(fs.collection(window.db,'solicitudes_cotizacion'), datos).then(function(ref){
          return Promise.all(_scFormFotos.map(function(src){
            return fs.addDoc(fs.collection(window.db,'solicitudes_cotizacion',ref.id,'fotos'), {src:src, origen:'solicitante', subidaPor:_cpMiCorreo(), fecha:ahora});
          })).then(function(){
            _scAvisarCompras('Nueva solicitud de cotización '+folio+' de '+depto+': '+partidas[0].desc+(partidas.length>1?' (+'+(partidas.length-1)+')':''));
            document.getElementById('sc-form-overlay').remove();
            toast('Listo. Tu cotización '+folio+' ya está con Compras.');
            escucharSC();
            setTimeout(function(){ window.__scAbrirDetalle(ref.id, depto==='Compras'?'compras':'solicitante'); }, 400);
          });
        });
      });
    }).catch(function(e){
      btn.disabled=false; btn.textContent='Mandar a Compras';
      err('No se pudo guardar: '+(e.message||e)+(String(e.message||e).indexOf('ermission')>-1?' — revisa las reglas (RLS) de compras_solicitudes en Supabase.':''));
    });
  };

  // Desde una requisición (Compras): crea la solicitud con sus partidas.
  window.__scDesdeRequisicion = function(reqId){
    var d = docs.find(function(x){ return x.id===reqId; }); if(!d) return;
    if(d.cotizacionSC && d.cotizacionSC.id){ window.__scAbrirDetalle(d.cotizacionSC.id,'compras'); return; }
    var ahora = new Date().toISOString();
    cargarFirestore().then(function(fs){
      return _cpSiguienteFolio(fs,'contador_cotizaciones','SC').then(function(folio){
        var correoSol = _cpCorreoDe(d);
        var datos = {
          folio:folio, estatus:'nueva', origen:'requisicion', requisicionId:d.id, requisicionFolio:d.folio||'',
          departamento:deptoSolicitante(d)||'', empresa:d.empresa||'', tipoCompra:d.tipoCompra||'', cliente:d.razonSocial||d.cliente||'',
          fechaRequerida:'', urgencia:d.urgencia==='alta'?'alta':'normal', urgenciaMotivo:'', notas:d.motivo||'',
          partidas:(d.items||[]).map(function(it){ return {desc:it.desc||'', cant:Number(it.cant)||1, unidad:it.unidad||'Pieza', numeroParte:it.numeroParte||'', marca:it.marca||'', modelo:it.modelo||'', especificaciones:''}; }),
          solicitante:{correo:correoSol, nombre:nombrePorCorreo(d.solicitante)||d.solicitante||''},
          proveedoresInvitados:[], respuestas:[], numFotos:0,
          historial:[{tipo:'creada', fecha:ahora, por:_cpMiNombre(), texto:'Compras abrió la cotización desde la requisición '+(d.folio||'')}],
          createdAt:fs.serverTimestamp(), actualizadoEn:ahora,
        };
        return fs.addDoc(fs.collection(window.db,'solicitudes_cotizacion'), datos).then(function(ref){
          return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',d.id), {cotizacionSC:{id:ref.id, folio:folio}}).then(function(){
            escucharSC(); toast('Cotización '+folio+' creada');
            setTimeout(function(){ window.__scAbrirDetalle(ref.id,'compras'); }, 400);
          });
        });
      });
    }).catch(function(e){ alert('No se pudo crear la cotización: '+(e.message||e)); });
  };

  // ── Escritura común: actualiza + agrega al historial ──
  function _scActualizar(id, cambios, evento){
    return cargarFirestore().then(function(fs){
      var upd = Object.assign({actualizadoEn:new Date().toISOString()}, cambios);
      if(evento) upd.historial = fs.arrayUnion(Object.assign({fecha:new Date().toISOString(), por:_cpMiNombre(), correo:_cpMiCorreo()}, evento));
      return fs.updateDoc(fs.doc(window.db,'solicitudes_cotizacion',id), upd);
    });
  }
  // ══ Estilos compartidos para ventanas que viven fuera del módulo ══
  function _cpInyectarEstilos(){
    if(document.getElementById('cp-estilos-globales')) return;
    var st=document.createElement('style'); st.id='cp-estilos-globales';
    st.textContent =
      '.cp-scope .cp-btn{padding:8px 13px;border-radius:9px;border:1px solid #E2E8F0;background:#fff;color:#0A1628;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;text-decoration:none}' +
      '.cp-scope .cp-btn:hover{background:#F8FAFC}.cp-scope .cp-btn[disabled]{opacity:.5;cursor:default}' +
      '.cp-scope .cp-btn.prim{background:#0A1628;color:#fff;border-color:#0A1628}.cp-scope .cp-btn.prim:hover{background:#1D2E73}' +
      '.cp-scope .cp-btn.ok{background:#12A150;color:#fff;border-color:#12A150}.cp-scope .cp-btn.peligro{color:#B91C1C}' +
      '.cp-scope .cp-btn:focus-visible,.cp-scope .cp-kpi:focus-visible,.cp-scope .cp-card:focus-visible,.cp-scope .cp-in:focus-visible{outline:3px solid rgba(20,115,230,.35);outline-offset:1px}' +
      '.cp-scope .cp-chip{display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:6px;white-space:nowrap}' +
      '.cp-scope .cp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}' +
      '.cp-scope .cp-kpi{text-align:left;background:#F8FAFC;border:1.5px solid transparent;border-radius:12px;padding:12px 14px;cursor:pointer;font-family:inherit}' +
      '.cp-scope .cp-kpi:hover{border-color:#CBD5E1}.cp-scope .cp-kpi.on{border-color:#0A1628;background:#fff;box-shadow:0 1px 4px rgba(10,22,40,.1)}' +
      '.cp-scope .cp-in{padding:8px 10px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;background:#fff;color:#0A1628;font-family:inherit;min-height:36px;box-sizing:border-box}' +
      '.cp-scope .cp-card{background:#fff;border:1px solid #E5EAF1;border-left:4px solid var(--c);border-radius:10px;padding:11px 13px;margin-bottom:8px;cursor:pointer;transition:box-shadow .15s}' +
      '.cp-scope .cp-card:hover{box-shadow:0 3px 10px rgba(10,22,40,.08)}' +
      '.cp-scope .cp-tabla{width:100%;border-collapse:collapse;font-size:12.5px;min-width:820px}' +
      '.cp-scope .cp-tabla th{padding:10px 12px;font-size:10.5px;color:#5C7089;text-transform:uppercase;text-align:left;background:#F8FAFC;letter-spacing:.3px}' +
      '.cp-scope .cp-tabla td{padding:10px 12px;border-top:1px solid #EEF2F7;vertical-align:middle}' +
      '.cp-scope .cp-tabla tr.cp-fila{cursor:pointer}.cp-scope .cp-tabla tr.cp-fila:hover td{background:#F8FAFC}' +
      '.cp-scope .cp-sec{border:1px solid #E5EAF1;border-radius:12px;padding:14px;margin-bottom:14px}' +
      '.cp-scope .cp-sec h4{margin:0 0 4px;font-size:13.5px;color:#0A1628;display:flex;align-items:center;gap:8px}' +
      '.cp-scope .cp-sec .cp-num{width:22px;height:22px;border-radius:50%;background:#0A1628;color:#fff;font-size:11px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '.cp-scope .cp-ayuda{font-size:11.5px;color:#5C7089;margin:0 0 10px}' +
      '@media (max-width:640px){.cp-scope .cp-dos{flex-direction:column}.cp-scope .cp-dos>div{width:100%!important}}';
    document.head.appendChild(st);
  }
  function _cpOverlay(id, z, ancho){
    _cpInyectarEstilos();
    var ov=document.getElementById(id);
    if(!ov){
      ov=document.createElement('div'); ov.id=id; ov.className='cp-scope';
      ov.style.cssText='position:fixed;inset:0;background:rgba(10,22,40,.55);z-index:'+z+';display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto';
      ov.innerHTML='<div role="dialog" aria-modal="true" id="'+id+'-p" style="background:#fff;border-radius:14px;max-width:'+(ancho||900)+'px;width:100%;padding:22px;margin:auto;box-sizing:border-box"></div>';
      ov.addEventListener('click', function(e){ if(e.target===ov){ ov.remove(); if(id==='sc-overlay') _scDetalleId=null; } });
      document.body.appendChild(ov);
    }
    return document.getElementById(id+'-p');
  }

  // ── Mensajes para proveedores ──
  function _scMensaje(sc, inv, tipo, nota){
    var saludo = 'Buen día'+(inv && (inv.contacto||inv.nombre) ? ' '+(inv.contacto||inv.nombre) : '')+',';
    if(tipo==='ajuste'){
      return saludo+'\n\nRespecto a nuestra solicitud de cotización '+sc.folio+', ¿nos podría ayudar a revisar su propuesta?\n\n'+(nota||'')+'\n\nQuedamos atentos.\n'+_cpMiNombre()+'\nCompras · '+(sc.empresa||'')+'\n'+_cpMiCorreo();
    }
    var lineas = (sc.partidas||[]).map(function(p,i){
      var extra = [p.numeroParte?'No. de parte: '+p.numeroParte:'', p.marca?'Marca: '+p.marca:'', p.modelo?'Modelo: '+p.modelo:'', p.especificaciones?'Especificaciones: '+p.especificaciones:''].filter(Boolean).join(' · ');
      return (i+1)+') '+p.cant+' '+(p.unidad||'')+' — '+p.desc+(extra?'\n   '+extra:'');
    }).join('\n');
    return saludo+'\n\nDe parte de '+(sc.empresa||'nuestra empresa')+' le solicitamos cotización de lo siguiente:\n\n'+lineas+
      '\n\nPor favor indíquenos: precio unitario y total (con IVA), moneda, tiempo de entrega, condiciones de pago y vigencia de la cotización.'+
      (sc.fechaLimiteRespuesta?'\nLe agradeceremos su respuesta a más tardar el '+_scFmt(sc.fechaLimiteRespuesta+'T12:00:00')+'.':'')+
      '\n\nReferencia: '+sc.folio+'\n\nGracias,\n'+_cpMiNombre()+'\nCompras · '+(sc.empresa||'')+'\n'+_cpMiCorreo();
  }
  function _scTelWA(t){ var d=String(t||'').replace(/\D/g,''); if(d.length===10) d='52'+d; return d.length>=11 ? d : ''; }
  function _cpCopiar(txt){ if(navigator.clipboard) return navigator.clipboard.writeText(txt); var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); return Promise.resolve(); }

  window.__scEnviar = function(id, idx, via){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var invs=(sc.proveedoresInvitados||[]).map(function(x){ return Object.assign({},x); });
    var inv=invs[idx]; if(!inv) return;
    var asunto='Solicitud de cotización '+sc.folio+' — '+(sc.empresa||'');
    var msg=_scMensaje(sc, inv, 'solicitud');
    if(via==='correo'){
      if(!inv.correo){ alert('Este proveedor no tiene correo. Agrégalo o usa WhatsApp.'); return; }
      window.open('mailto:'+encodeURIComponent(inv.correo)+'?subject='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(msg));
    } else if(via==='gmail'){
      if(!inv.correo){ alert('Este proveedor no tiene correo. Agrégalo o usa WhatsApp.'); return; }
      window.open('https://mail.google.com/mail/?view=cm&fs=1&to='+encodeURIComponent(inv.correo)+'&su='+encodeURIComponent(asunto)+'&body='+encodeURIComponent(msg),'_blank');
    } else if(via==='whatsapp'){
      var tel=_scTelWA(inv.telefono); if(!tel){ alert('Este proveedor no tiene un teléfono válido (10 dígitos).'); return; }
      window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(msg),'_blank');
    } else if(via==='copiar'){
      _cpCopiar(msg).then(function(){ toast('Mensaje copiado. Pégalo donde quieras.'); });
    } else if(via==='pdf'){
      _scPDF(sc); 
    }
    inv.enviadoEn = new Date().toISOString(); inv.via = via;
    var cambios = {proveedoresInvitados:invs};
    if(sc.estatus==='nueva') cambios.estatus='preguntando';
    var VIA = {correo:'correo',gmail:'Gmail',whatsapp:'WhatsApp',copiar:'mensaje copiado',pdf:'PDF'};
    _scActualizar(id, cambios, {tipo:'enviada', texto:'Pidió precio a '+inv.nombre+' por '+VIA[via]});
    if(sc.estatus==='nueva') _scAvisarSolicitante(sc, 'Tu cotización '+sc.folio+': Compras ya está preguntando precios a proveedores');
  };

  window.__scInvitar = function(id){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var sel=document.getElementById('sc-inv-catalogo'), nombre=(document.getElementById('sc-inv-nombre').value||'').trim();
    var invs=(sc.proveedoresInvitados||[]).slice(), nuevos=[];
    if(sel && sel.value){
      var p=(_proveedoresCache||[]).find(function(x){ return x.id===sel.value; });
      if(p) nuevos.push({proveedorId:p.id, nombre:p.nombre, correo:p.correo||'', telefono:p.telefono||'', contacto:p.contacto||''});
    }
    if(nombre){
      nuevos.push({proveedorId:'', nombre:nombre, correo:(document.getElementById('sc-inv-correo').value||'').trim(), telefono:(document.getElementById('sc-inv-tel').value||'').trim(), contacto:''});
    }
    if(!nuevos.length){ alert('Elige un proveedor del catálogo o escribe uno nuevo.'); return; }
    nuevos = nuevos.filter(function(n){ return !invs.some(function(i){ return _cpNorm(i.nombre)===_cpNorm(n.nombre); }); });
    if(!nuevos.length){ alert('Ese proveedor ya está en la lista.'); return; }
    var guardarCat = document.getElementById('sc-inv-guardar') && document.getElementById('sc-inv-guardar').checked;
    cargarFirestore().then(function(fs){
      var pasos = nuevos.map(function(n){
        n.id='i'+Date.now()+Math.floor(Math.random()*1000); n.agregadoEn=new Date().toISOString();
        if(guardarCat && !n.proveedorId){
          return fs.addDoc(fs.collection(window.db,'proveedores'), {nombre:n.nombre, correo:n.correo, telefono:n.telefono, contacto:'', categoria:'', creadoEn:new Date().toISOString()})
            .then(function(r){ n.proveedorId=r.id; _proveedoresCache=null; }).catch(function(){});
        }
        return Promise.resolve();
      });
      return Promise.all(pasos).then(function(){
        return _scActualizar(id, {proveedoresInvitados:invs.concat(nuevos)}, {tipo:'proveedor', texto:'Agregó a '+nuevos.map(function(n){return n.nombre;}).join(', ')});
      });
    });
  };
  window.__scQuitarInvitado = function(id, idx){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var invs=(sc.proveedoresInvitados||[]).slice(); var q=invs.splice(idx,1)[0];
    _scActualizar(id, {proveedoresInvitados:invs}, {tipo:'proveedor', texto:'Quitó a '+(q&&q.nombre)});
  };
  window.__scFechaLimite = function(id, v){ _scActualizar(id, {fechaLimiteRespuesta:v}, null); };

  // ── Respuestas de proveedores ──
  window.__scFormRespuesta = function(id, ridx){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var r = ridx>-1 ? sc.respuestas[ridx] : {moneda:'MXN', ivaIncluido:true};
    var inp='width:100%;padding:8px 9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;box-sizing:border-box;font-family:inherit';
    var lab='display:block;font-size:11.5px;font-weight:700;color:#5C7089;margin:0 0 4px';
    var nombres = (sc.proveedoresInvitados||[]).map(function(i){ return i.nombre; });
    var PAGOS=['Contado','Contado contra entrega','Anticipo 50%','Crédito 15 días','Crédito 30 días','Crédito 60 días','Otro'];
    document.getElementById('sc-resp-form').innerHTML =
      '<div style="background:#F8FAFF;border:1.5px solid #C7D2FE;border-radius:12px;padding:14px;margin-top:10px">' +
      '<p style="margin:0 0 10px;font-size:13px;font-weight:800">'+(ridx>-1?'Editar respuesta':'Registrar lo que respondió un proveedor')+'</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">' +
        '<div><label style="'+lab+'">Proveedor</label><input id="sc-r-prov" list="sc-r-prov-dl" value="'+esc(r.proveedor||'')+'" style="'+inp+'"><datalist id="sc-r-prov-dl">'+nombres.concat((_proveedoresCache||[]).map(function(p){return p.nombre;})).filter(function(v,i,a){return v&&a.indexOf(v)===i;}).map(function(n){ return '<option value="'+esc(n)+'">'; }).join('')+'</datalist></div>' +
        '<div><label style="'+lab+'">Precio total</label><input id="sc-r-precio" type="number" min="0" step="0.01" inputmode="decimal" value="'+(r.precioTotal!=null?r.precioTotal:'')+'" style="'+inp+'"></div>' +
        '<div><label style="'+lab+'">Moneda</label><select id="sc-r-moneda" style="'+inp+'"><option'+(r.moneda==='MXN'?' selected':'')+'>MXN</option><option'+(r.moneda==='USD'?' selected':'')+'>USD</option></select></div>' +
        '<div><label style="'+lab+'">¿Incluye IVA?</label><select id="sc-r-iva" style="'+inp+'"><option value="1"'+(r.ivaIncluido!==false?' selected':'')+'>Sí, ya incluye IVA</option><option value="0"'+(r.ivaIncluido===false?' selected':'')+'>No, más IVA</option></select></div>' +
        '<div><label style="'+lab+'">Tiempo de entrega (días)</label><input id="sc-r-dias" type="number" min="0" value="'+(r.tiempoEntregaDias!=null?r.tiempoEntregaDias:'')+'" style="'+inp+'"></div>' +
        '<div><label style="'+lab+'">Forma de pago</label><select id="sc-r-pago" style="'+inp+'">'+PAGOS.map(function(p){ return '<option'+(r.condicionesPago===p?' selected':'')+'>'+p+'</option>'; }).join('')+'</select></div>' +
        '<div><label style="'+lab+'">Válida hasta</label><input id="sc-r-vig" type="date" value="'+esc(r.vigencia||'')+'" style="'+inp+'"></div>' +
      '</div>' +
      '<label style="'+lab+';margin-top:10px">Notas <span style="font-weight:400">(marca ofrecida, si es equivalente, flete…)</span></label><input id="sc-r-notas" value="'+esc(r.notas||'')+'" style="'+inp+'">' +
      '<label style="display:inline-flex;gap:6px;align-items:center;margin-top:10px;padding:8px 12px;border:1.5px dashed #CBD5E1;border-radius:9px;color:#1473E6;font-size:12px;font-weight:700;cursor:pointer">Adjuntar su cotización (foto o PDF chico)<input id="sc-r-archivo" type="file" accept="image/*,application/pdf" style="display:none" onchange="document.getElementById(\'sc-r-archivo-n\').textContent=this.files[0]?this.files[0].name:\'\'"></label> <span id="sc-r-archivo-n" style="font-size:11.5px;color:#5C7089">'+esc(r.adjuntoNombre||'')+'</span>' +
      '<p id="sc-r-error" role="alert" style="display:none;color:#B91C1C;font-size:12px;font-weight:700;margin:8px 0 0"></p>' +
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="cp-btn ok" style="flex:1;justify-content:center" onclick="window.__scGuardarRespuesta(\''+id+'\','+ridx+')">Guardar respuesta</button><button class="cp-btn" onclick="document.getElementById(\'sc-resp-form\').innerHTML=\'\'">Cancelar</button></div></div>';
  };
  window.__scGuardarRespuesta = function(id, ridx){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var err=function(m){ var e=document.getElementById('sc-r-error'); e.textContent=m; e.style.display='block'; };
    var prov=(document.getElementById('sc-r-prov').value||'').trim(), precio=document.getElementById('sc-r-precio').value;
    if(!prov) return err('Escribe el proveedor.');
    if(!(Number(precio)>0)) return err('Escribe el precio total.');
    var file=document.getElementById('sc-r-archivo').files[0];
    if(file && file.size>700*1024) return err('El archivo pesa más de 700 KB. Súbelo como foto o comprímelo.');
    var resps=(sc.respuestas||[]).map(function(x){ return Object.assign({},x); });
    var base = ridx>-1 ? resps[ridx] : {id:'r'+Date.now(), estado:'recibida', registradaEn:new Date().toISOString(), por:_cpMiNombre()};
    var catP=(_proveedoresCache||[]).find(function(p){ return _cpNorm(p.nombre)===_cpNorm(prov); });
    Object.assign(base, {proveedor:prov, proveedorId:catP?catP.id:(base.proveedorId||''), precioTotal:Number(precio), moneda:document.getElementById('sc-r-moneda').value,
      ivaIncluido:document.getElementById('sc-r-iva').value==='1', tiempoEntregaDias:document.getElementById('sc-r-dias').value===''?null:Number(document.getElementById('sc-r-dias').value),
      condicionesPago:document.getElementById('sc-r-pago').value, vigencia:document.getElementById('sc-r-vig').value, notas:(document.getElementById('sc-r-notas').value||'').trim()});
    if(base.estado==='ajuste') base.estado='recibida';
    var leer = file ? new Promise(function(res){
      var r=new FileReader(); r.onload=function(){
        if(/^image\//.test(file.type)) _cpComprimirImagen(r.result, 1400, 0.72).then(res); else res(r.result);
      }; r.readAsDataURL(file);
    }) : Promise.resolve(null);
    leer.then(function(dataUrl){
      return cargarFirestore().then(function(fs){
        var subir = dataUrl ? fs.addDoc(fs.collection(window.db,'solicitudes_cotizacion',id,'adjuntos'), {data:dataUrl, nombre:file.name, tipo:file.type, subidoPor:_cpMiCorreo(), fecha:new Date().toISOString()})
          .then(function(ref){ base.adjuntoId=ref.id; base.adjuntoNombre=file.name; }) : Promise.resolve();
        return subir.then(function(){
          if(ridx>-1) resps[ridx]=base; else resps.push(base);
          var cambios={respuestas:resps};
          if(sc.estatus==='nueva'||sc.estatus==='preguntando') cambios.estatus='con_precios';
          var invs=(sc.proveedoresInvitados||[]).map(function(i){ return Object.assign({},i); });
          invs.forEach(function(i){ if(_cpNorm(i.nombre)===_cpNorm(prov)) i.respondioEn=new Date().toISOString(); });
          cambios.proveedoresInvitados=invs;
          return _scActualizar(id, cambios, {tipo:'respuesta', texto:(ridx>-1?'Corrigió':'Registró')+' precio de '+prov+': '+_cpMoney(precio)+' '+base.moneda});
        });
      });
    }).then(function(){ var f=document.getElementById('sc-resp-form'); if(f) f.innerHTML=''; toast('Respuesta guardada'); })
      .catch(function(e){ err('No se pudo guardar: '+(e.message||e)); });
  };
  window.__scVerAdjunto = function(id, adjId){
    cargarFirestore().then(function(fs){
      fs.getDoc(fs.doc(window.db,'solicitudes_cotizacion',id,'adjuntos',adjId)).then(function(s){
        if(!s.exists()) return alert('No se encontró el archivo.');
        var d=s.data(), partes=String(d.data).split(','), bin=atob(partes[1]||''), arr=new Uint8Array(bin.length);
        for(var i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
        window.open(URL.createObjectURL(new Blob([arr],{type:d.tipo||'application/octet-stream'})),'_blank');
      });
    });
  };
  function _scSetRespuesta(sc, respId, cambios){
    return (sc.respuestas||[]).map(function(r){ return r.id===respId ? Object.assign({}, r, cambios) : Object.assign({}, r); });
  }
  window.__scRechazar = function(id, respId){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var r=(sc.respuestas||[]).find(function(x){ return x.id===respId; });
    var m=prompt('¿Por qué descartas la opción de '+(r&&r.proveedor)+'? (opcional)'); if(m===null) return;
    _scActualizar(id, {respuestas:_scSetRespuesta(sc, respId, {estado:'rechazada', motivo:m})}, {tipo:'respuesta', texto:'Descartó la opción de '+(r&&r.proveedor)+(m?': '+m:'')});
  };
  window.__scAjuste = function(id, respId){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var r=(sc.respuestas||[]).find(function(x){ return x.id===respId; }); if(!r) return;
    var nota=prompt('¿Qué le quieres pedir a '+r.proveedor+'? Ej. "¿Nos mejora el precio?" o "¿Tiene entrega más rápida?"'); if(!nota) return;
    _scActualizar(id, {respuestas:_scSetRespuesta(sc, respId, {estado:'ajuste', ajustePedido:nota})}, {tipo:'ajuste', texto:'Le pidió ajuste a '+r.proveedor+': '+nota}).then(function(){
      var inv=(sc.proveedoresInvitados||[]).find(function(i){ return _cpNorm(i.nombre)===_cpNorm(r.proveedor); }) || {nombre:r.proveedor};
      var msg=_scMensaje(sc, inv, 'ajuste', nota), tel=_scTelWA(inv.telefono);
      var p=_cpOverlay('sc-msg-overlay', 2260, 520);
      p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0;font-size:15px">Mensaje para '+esc(r.proveedor)+'</h3><button aria-label="Cerrar" onclick="document.getElementById(\'sc-msg-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
        '<textarea id="sc-msg-txt" rows="9" style="width:100%;padding:10px;border:1px solid #E2E8F0;border-radius:9px;font-size:12.5px;box-sizing:border-box;font-family:inherit">'+esc(msg)+'</textarea>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
        '<button class="cp-btn prim" onclick="window.__cpCopiarDe(\'sc-msg-txt\')">Copiar</button>' +
        (tel?'<a class="cp-btn" target="_blank" rel="noopener" href="https://wa.me/'+tel+'?text='+encodeURIComponent(msg)+'">WhatsApp</a>':'') +
        (inv.correo?'<a class="cp-btn" href="mailto:'+encodeURIComponent(inv.correo)+'?subject='+encodeURIComponent('Cotización '+sc.folio)+'&body='+encodeURIComponent(msg)+'">Correo</a>':'') + '</div>';
    });
  };
  window.__cpCopiarDe = function(elId){ var el=document.getElementById(elId); if(el) _cpCopiar(el.value).then(function(){ toast('Copiado'); }); };
  window.__scRecordatorio = function(id){
    var f=document.getElementById('sc-rec-fecha').value, n=(document.getElementById('sc-rec-nota').value||'').trim();
    if(!f && !n) return;
    _scActualizar(id, {recordatorio: f?{fecha:f, nota:n, por:_cpMiNombre()}:null}, {tipo:'seguimiento', texto:(n||'Seguimiento')+(f?' · recordar el '+_scFmt(f+'T12:00:00'):'')})
      .then(function(){ toast('Seguimiento guardado'); });
  };
  window.__scComentar = function(id){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var el=document.getElementById('sc-com-txt'), t=(el.value||'').trim(); if(!t) return;
    el.value='';
    _scActualizar(id, {}, {tipo:'comentario', texto:t}).then(function(){
      var soySol = sc.solicitante && sc.solicitante.correo===_cpMiCorreo();
      if(soySol) _scAvisarCompras('Comentario en '+sc.folio+': '+t); else _scAvisarSolicitante(sc, 'Compras comentó en tu cotización '+sc.folio+': '+t);
    });
  };
  window.__scAgregarFoto = function(id, input){
    var files=Array.prototype.slice.call(input.files||[]); input.value='';
    cargarFirestore().then(function(fs){
      files.forEach(function(file){
        var r=new FileReader(); r.onload=function(){ _cpComprimirImagen(r.result,1100,0.7).then(function(src){
          fs.addDoc(fs.collection(window.db,'solicitudes_cotizacion',id,'fotos'), {src:src, origen:_scDetalleModo, subidaPor:_cpMiCorreo(), fecha:new Date().toISOString()}).then(function(){ _scPintarFotos(id); });
        }); }; r.readAsDataURL(file);
      });
    });
  };
  function _scPintarFotos(id){
    cargarFirestore().then(function(fs){
      _cpGetDocsCache(fs, fs.collection(window.db,'solicitudes_cotizacion',id,'fotos')).then(function(fotos){
        var g=document.getElementById('sc-fotos-grid'); if(!g) return;
        g.innerHTML = fotos.length ? fotos.map(function(d){ return '<img src="'+d.src+'" alt="Foto de referencia" onclick="window.open(this.src)" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;cursor:pointer">'; }).join('') : '<span style="font-size:11.5px;color:#94A3B8">Sin fotos.</span>';
      }).catch(function(){});
    });
  }
  window.__scCancelar = function(id){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var m=prompt('¿Por qué se cancela? (así le avisamos a la otra parte)'); if(m===null) return;
    _scActualizar(id, {estatus:'cancelada', motivoCancelacion:m}, {tipo:'cancelada', texto:'Canceló la solicitud'+(m?': '+m:'')}).then(function(){
      var soySol = sc.solicitante && sc.solicitante.correo===_cpMiCorreo();
      if(soySol) _scAvisarCompras('Se canceló la cotización '+sc.folio+(m?': '+m:'')); else _scAvisarSolicitante(sc, 'Compras canceló tu cotización '+sc.folio+(m?': '+m:''));
    });
  };
  window.__scCompartir = function(id){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var ids=Array.prototype.map.call(document.querySelectorAll('.sc-comp-chk:checked'), function(x){ return x.value; });
    if(!ids.length){ alert('Elige al menos una opción para mandar.'); return; }
    var mostrar=document.getElementById('sc-comp-prov').checked, nota=(document.getElementById('sc-comp-nota').value||'').trim();
    _scActualizar(id, {estatus:'lista', compartidas:ids, mostrarProveedor:mostrar, notaCompras:nota}, {tipo:'compartida', texto:'Mandó '+ids.length+' '+(ids.length===1?'opción':'opciones')+' al solicitante'+(nota?': '+nota:'')})
      .then(function(){ _scAvisarSolicitante(sc, 'Tu cotización '+sc.folio+' ya tiene precio. Entra a decidir.'); toast('Listo, se le avisó al solicitante'); });
  };
  window.__scPedirOtra = function(id){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var t=prompt('¿Qué necesitas diferente? Ej. "más barato", "que llegue antes", "otra marca"'); if(!t) return;
    _scActualizar(id, {estatus:'con_precios'}, {tipo:'comentario', texto:'Pidió otra opción: '+t}).then(function(){ _scAvisarCompras(sc.folio+': el solicitante pidió otra opción — '+t); toast('Le avisamos a Compras'); });
  };

  // ── Generar orden de compra desde una cotización (requisición ya autorizada) ──
  function _cpGenerarOCDesdeCot(fs, req, cot){
    return _cpRevisarLimiteDirecto(fs, req, cot).then(function(regreso){
      if(regreso) return false;
      var ocFolio='OC-'+String(Date.now()).slice(-6), ahora=new Date().toISOString();
      return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',req.id), {
        estatus:'orden_generada', cotizacionGanadora:cot, ocFolio:ocFolio, ordenGeneradaEn:ahora,
        bitacora: fs.arrayUnion({tipo:'orden_generada', fecha:ahora, por:_cpMiCorreo(), detalle:'Orden '+ocFolio+' con '+(cot.proveedor||'')+' por '+_cpMoney(cot.monto)+(cot.scFolio?' (cotización '+cot.scFolio+')':'')}),
      }).then(function(){
        sincronizarCuentaPorPagar(Object.assign({},req,{estatus:'orden_generada',cotizacionGanadora:cot,ocFolio:ocFolio}), 'orden_generada');
        var para = req.solicitanteEmail || _cpCorreoDe(req);
        if(para) _cpAvisar(para, 'Tu requisición '+(req.folio||'')+' ya se compró. Te avisaremos cuando venga en camino.', '');
        var sc = req.cotizacionSC && _scDocs.find(function(s){ return s.id===req.cotizacionSC.id; });
        var scId = (req.cotizacionSC && req.cotizacionSC.id) || cot.scId;
        if(scId) _scActualizar(scId, {estatus:'convertida', requisicionId:req.id, requisicionFolio:req.folio||''}, {tipo:'comprada', texto:'Se generó la orden '+ocFolio});
        if(sc) _scAvisarSolicitante(sc, 'Lo que pediste en '+sc.folio+' ya se compró ('+(req.folio||'')+')');
        _cpMostrarExito(ocFolio, req.id);
        return true;
      });
    });
  }

  // Aceptar una respuesta (Compras)
  window.__scAceptar = function(id, respId){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    var r=(sc.respuestas||[]).find(function(x){ return x.id===respId; }); if(!r) return;
    var req=_scReq(sc);
    var cot={proveedor:r.proveedor, monto:Number(r.precioTotal), moneda:r.moneda||'MXN', ivaIncluido:r.ivaIncluido!==false, tiempoEntregaDias:r.tiempoEntregaDias, condicionesPago:r.condicionesPago||'', vigencia:r.vigencia||'', scId:sc.id, scFolio:sc.folio, respuestaId:r.id};
    if(req){
      var autorizada = req.estatus==='cotizando' || req.estatus==='autorizada';
      if(!confirm('¿Aceptar la opción de '+r.proveedor+' por '+_cpMoney(r.precioTotal)+'?\n\n'+(autorizada?'Se genera la orden de compra de '+(req.folio||'')+' y su PDF.':'La requisición '+(req.folio||'')+' aún no está autorizada: en cuanto la autoricen, la orden se genera sola.'))) return;
      cargarFirestore().then(function(fs){
        return fs.addDoc(fs.collection(window.db,'requisiciones_compra',req.id,'cotizaciones'), {proveedor:r.proveedor, monto:Number(r.precioTotal), creadaEn:new Date().toISOString(), desdeSC:sc.folio, porUid:window.auth&&window.auth.currentUser?window.auth.currentUser.uid:null})
          .then(function(cref){
            cot.cotizacionId=cref.id;
            return _scActualizar(id, {respuestas:_scSetRespuesta(sc, respId, {estado:'aceptada'}), elegidaId:respId, estatus:'convertida'}, {tipo:'aceptada', texto:'Aceptó la opción de '+r.proveedor+' ('+_cpMoney(r.precioTotal)+')'})
              .then(function(){
                if(autorizada) return _cpGenerarOCDesdeCot(fs, req, cot);
                return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',req.id), {cotizacionPropuesta:cot, montoEstimado:cot.monto}).then(function(){ toast('Opción guardada. La orden se generará al autorizarse.'); });
              });
          });
      }).catch(function(e){ alert('No se pudo aceptar: '+(e.message||e)); });
      return;
    }
    // Sin requisición: se marca como elegida para mandarla al solicitante (o convertirla).
    _scActualizar(id, {respuestas:_scSetRespuesta(sc, respId, {estado:'elegida'})}, {tipo:'respuesta', texto:'Marcó como buena la opción de '+r.proveedor});
  };

  // Convertir en requisición (lo hace el solicitante al elegir, o Compras directo).
  window.__scConvertir = function(id, respId){
    var sc=_scDocs.find(function(x){ return x.id===id; }); if(!sc) return;
    if(sc.estatus==='convertida'){ alert('Esta cotización ya es requisición ('+(sc.requisicionFolio||'')+').'); return; }
    var r=(sc.respuestas||[]).find(function(x){ return x.id===respId; }); if(!r) return;
    if(!confirm('¿Comprar esta opción ('+_cpMoney(r.precioTotal)+' '+(r.moneda||'MXN')+')?\n\nSe crea la requisición y sigue el camino normal de aprobación. Te avisaremos en cada paso.')) return;
    var ahora=new Date().toISOString();
    Promise.all([cargarFirestore(), cargarConfigFlujo(), cargarColaboradores()]).then(function(arr){
      var fs=arr[0];
      return _cpSiguienteFolio(fs,'contador_rcc','RCC').then(function(folio){
        var sol = sc.solicitante||{};
        var flujo=[{label:'Solicitante',estatus:'aprobado',orden:1,fecha:ahora,uid:window.auth&&window.auth.currentUser?window.auth.currentUser.uid:null},{label:'Jefe de área',estatus:'pendiente',orden:2},{label:'Compras',estatus:'pendiente',orden:3}];
        var cot={proveedor:r.proveedor, monto:Number(r.precioTotal), moneda:r.moneda||'MXN', ivaIncluido:r.ivaIncluido!==false, tiempoEntregaDias:r.tiempoEntregaDias, condicionesPago:r.condicionesPago||'', vigencia:r.vigencia||'', scId:sc.id, scFolio:sc.folio, respuestaId:r.id};
        var req={
          folio:folio, estatus:'pendiente', origen:'cotizacion', empresa:sc.empresa||'', tipoCompra:sc.tipoCompra||'',
          solicitante:sol.correo||sol.nombre||'', solicitanteEmail:sol.correo||'', departamento:sc.departamento||'', departamentoSolicitante:sc.departamento||'',
          urgencia:sc.urgencia==='alta'?'alta':'media', motivo:(sc.cliente?'Para '+sc.cliente+'. ':'')+(sc.notas||''), cliente:sc.cliente||'',
          items:(sc.partidas||[]).map(function(p){ var x=[p.numeroParte?'No. parte '+p.numeroParte:'',p.marca,p.modelo].filter(Boolean).join(' · '); return {desc:p.desc+(x?' ('+x+')':''), cant:p.cant, unidad:p.unidad||'Pieza', proveedor:r.proveedor, numeroParte:p.numeroParte||'', marca:p.marca||'', modelo:p.modelo||''}; }),
          flujoAutorizacion:flujo, cotizacionPropuesta:cot, montoEstimado:cot.monto, cotizacionSC:{id:sc.id, folio:sc.folio},
          comentarios:[{autor:_cpMiNombre(), fecha:ahora.slice(0,10), texto:'Creada desde la cotización '+sc.folio+(r.notas?' · '+r.notas:'')}],
          bitacora:[{tipo:'creada_desde_cotizacion', fecha:ahora, por:_cpMiCorreo(), detalle:'Creada desde '+sc.folio+' con la opción de '+r.proveedor}],
          createdAt:fs.serverTimestamp(),
        };
        return fs.addDoc(fs.collection(window.db,'requisiciones_compra'), req).then(function(ref){
          return fs.addDoc(fs.collection(window.db,'requisiciones_compra',ref.id,'cotizaciones'), {proveedor:r.proveedor, monto:Number(r.precioTotal), creadaEn:ahora, desdeSC:sc.folio})
            .then(function(cref){ return fs.updateDoc(ref, {'cotizacionPropuesta.cotizacionId':cref.id}); })
            .then(function(){ // copia las fotos de referencia
              return fs.getDocs(fs.collection(window.db,'solicitudes_cotizacion',sc.id,'fotos')).then(function(snap){
                return Promise.all(snap.docs.slice(0,6).map(function(fd){ var f=fd.data(); return fs.addDoc(fs.collection(window.db,'requisiciones_compra',ref.id,'fotos'), {src:f.src, origen:'solicitante', subidaPor:f.subidaPor||'', fecha:ahora}); }));
              }).catch(function(){});
            })
            .then(function(){
              return _scActualizar(id, {estatus:'convertida', requisicionId:ref.id, requisicionFolio:folio, elegidaId:respId, respuestas:_scSetRespuesta(sc, respId, {estado:'aceptada'})}, {tipo:'convertida', texto:'Eligió la opción de '+r.proveedor+' → requisición '+folio});
            })
            .then(function(){
              _cpNotificarPaso(fs, Object.assign({id:ref.id}, req), flujo[1]);
              _scAvisarCompras(sc.folio+' se convirtió en la requisición '+folio+' ('+r.proveedor+', '+_cpMoney(r.precioTotal)+')');
              if(sc.solicitante && sc.solicitante.correo!==_cpMiCorreo()) _scAvisarSolicitante(sc, 'Tu cotización '+sc.folio+' ya es la requisición '+folio);
              toast('Listo: se creó la requisición '+folio);
            });
        });
      });
    }).catch(function(e){ alert('No se pudo crear la requisición: '+(e.message||e)); });
  };

  // ── PDF "Solicitud de cotización" para proveedores (se arma al momento) ──
  // No incluye el cliente ni precios internos.
  function _scPDF(sc){
    if(!window.jspdf){ alert('No se cargó la librería de PDF. Recarga la página.'); return; }
    cargarLogoEmpresa(sc.empresa).then(function(logo){
      var docu=new window.jspdf.jsPDF({unit:'mm', format:'letter'});
      var PW=docu.internal.pageSize.getWidth(), PH=docu.internal.pageSize.getHeight(), ML=16, MR=16, y=18;
      docu.setFillColor(29,46,115); docu.rect(0,0,PW,4,'F');
      if(logo){ try{ docu.addImage(logo, 'PNG', ML, 10, 38, 16, undefined, 'FAST'); }catch(e){} }
      docu.setFont('helvetica','bold'); docu.setFontSize(15); docu.setTextColor(15,23,42);
      docu.text('SOLICITUD DE COTIZACIÓN', PW-MR, 17, {align:'right'});
      docu.setFontSize(10); docu.setTextColor(231,64,43); docu.text(sc.folio||'', PW-MR, 23, {align:'right'});
      docu.setFont('helvetica','normal'); docu.setFontSize(9); docu.setTextColor(100,116,139);
      docu.text('Fecha: '+new Date().toLocaleDateString('es-MX'), PW-MR, 28, {align:'right'});
      y=36;
      var fila=function(l,v,x){ docu.setFont('helvetica','bold'); docu.setFontSize(7.5); docu.setTextColor(100,116,139); docu.text(l.toUpperCase(), x, y); docu.setFont('helvetica','normal'); docu.setFontSize(10); docu.setTextColor(15,23,42); docu.text(String(v||'—'), x, y+5); };
      fila('Empresa', sc.empresa, ML); fila('Contacto de Compras', _cpMiNombre(), ML+62); fila('Correo', _cpMiCorreo(), ML+124); y+=14;
      if(sc.fechaLimiteRespuesta){ fila('Responder a más tardar', _scFmt(sc.fechaLimiteRespuesta+'T12:00:00'), ML); y+=14; }
      docu.setFillColor(29,46,115); docu.rect(ML,y-5,PW-ML-MR,8,'F');
      docu.setTextColor(255,255,255); docu.setFont('helvetica','bold'); docu.setFontSize(8);
      docu.text('#',ML+2,y); docu.text('CANT.',ML+9,y); docu.text('UNIDAD',ML+24,y); docu.text('DESCRIPCIÓN Y DATOS TÉCNICOS',ML+46,y); y+=8;
      (sc.partidas||[]).forEach(function(p,i){
        var extra=[p.numeroParte?'No. de parte: '+p.numeroParte:'', p.marca?'Marca: '+p.marca:'', p.modelo?'Modelo: '+p.modelo:''].filter(Boolean).join('   ');
        var txt=p.desc+(extra?'\n'+extra:'')+(p.especificaciones?'\n'+p.especificaciones:'');
        var lns=docu.splitTextToSize(txt, PW-ML-MR-48);
        if(y+lns.length*4.6>PH-40){ docu.addPage(); y=20; }
        docu.setFont('helvetica','normal'); docu.setFontSize(9.5); docu.setTextColor(15,23,42);
        docu.text(String(i+1),ML+2,y); docu.text(String(p.cant),ML+9,y); docu.text(String(p.unidad||''),ML+24,y); docu.text(lns,ML+46,y);
        y+=Math.max(6, lns.length*4.6+2);
        docu.setDrawColor(226,232,240); docu.line(ML,y-3,PW-MR,y-3);
      });
      y+=6; if(y>PH-50){ docu.addPage(); y=20; }
      docu.setFillColor(248,250,252); docu.rect(ML,y-5,PW-ML-MR,30,'F');
      docu.setFont('helvetica','bold'); docu.setFontSize(9); docu.setTextColor(15,23,42); docu.text('Favor de incluir en su cotización:', ML+4, y+1);
      docu.setFont('helvetica','normal'); docu.setFontSize(9); docu.setTextColor(51,65,85);
      ['• Precio unitario y total (indicar si incluye IVA) y moneda','• Tiempo de entrega y lugar de entrega o envío','• Condiciones de pago y vigencia de la cotización','• Marca y modelo ofrecido (si es equivalente, indicarlo)'].forEach(function(t,i){ docu.text(t, ML+4, y+7+i*5); });
      y+=34;
      docu.setFontSize(8); docu.setTextColor(148,163,184);
      docu.text('Referencia: '+sc.folio+' · Favor de mencionarla en su respuesta.', ML, PH-12);
      docu.save('Solicitud_cotizacion_'+(sc.folio||'')+'.pdf');
    });
  }
  window.__scPDF = function(id){ var sc=_scDocs.find(function(x){ return x.id===id; }); if(sc) _scPDF(sc); };
  // ══ DETALLE de una solicitud de cotización ══
  // modo 'compras' = lo ve Compras (proveedores, comparador, acciones);
  // modo 'solicitante' = lo ve quien pidió (estado, opciones, decidir).
  window.__scAbrirDetalle = function(id, modo, silencioso, intento){
    _cpInyectarEstilos();
    var sc=_scDocs.find(function(x){ return x.id===id; });
    if(!sc){ escucharSC(); if((intento||0)<8) setTimeout(function(){ window.__scAbrirDetalle(id, modo, silencioso, (intento||0)+1); }, 400); return; }
    _scDetalleId=id; _scDetalleModo=modo||'compras';
    var esCompras = _scDetalleModo==='compras';
    var p=_cpOverlay('sc-overlay', 2150, 980);
    var scrollPrev = document.getElementById('sc-overlay').scrollTop;
    var req=_scReq(sc), mejor=_scMejor(sc);
    var h='';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px"><div>' +
      '<h2 style="margin:0;font-size:18px;color:#0A1628;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'+esc(sc.folio||'')+' '+_scChipEstado(sc)+(sc.urgencia==='alta'?'<span class="cp-chip" style="background:#FCEBEB;color:#B91C1C" title="'+esc(sc.urgenciaMotivo||'')+'">'+_cpIco('fuego')+'Urgente</span>':'')+'</h2>' +
      '<p style="margin:4px 0 0;font-size:12px;color:#5C7089">'+esc(sc.departamento||'—')+' · '+esc(_cpTitulo((sc.solicitante&&sc.solicitante.nombre)||'—'))+' · pedida el '+_scFmt(sc.createdAt)+'</p></div>' +
      '<div style="display:flex;gap:6px;flex-shrink:0">'+(esCompras?'<button class="cp-btn" onclick="window.__scPDF(\''+id+'\')" title="PDF para mandar a proveedores">'+_cpIco('bajar')+'PDF para proveedores</button>':'') +
      '<button aria-label="Cerrar" onclick="document.getElementById(\'sc-overlay\').remove();window.__scCerrar()" style="background:#F1F5F9;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer">✕</button></div></div>';
    h += _scTimelineHTML(sc);
    h += '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12.5px;color:#0A1628"><b>Ahora:</b> '+esc(_scEstadoTexto(sc))+
      (sc.fechaRequerida?' · <span style="color:#5C7089">Se necesita para el <b>'+_scFmt(sc.fechaRequerida+'T12:00:00')+'</b></span>':'')+'</div>';

    var izq='', der='';
    // Partidas
    izq += '<p style="font-size:11px;font-weight:700;color:#5C7089;margin:0 0 8px;text-transform:uppercase">Qué se pide</p>';
    izq += (sc.partidas||[]).map(function(pt){
      var x=[pt.numeroParte?'No. parte: '+pt.numeroParte:'', pt.marca?'Marca: '+pt.marca:'', pt.modelo?'Modelo: '+pt.modelo:''].filter(Boolean).join(' · ');
      return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px">'+(pt.miniatura?'<img src="'+pt.miniatura+'" alt="" style="width:54px;height:54px;object-fit:cover;border-radius:8px;flex-shrink:0">':'')+'<div style="min-width:0;flex:1"><p style="margin:0;font-size:13px;font-weight:700;color:#0A1628">'+esc(pt.desc)+'</p>'+(x?'<p style="margin:2px 0 0;font-size:11.5px;color:#5C7089">'+esc(x)+'</p>':'')+(pt.especificaciones?'<p style="margin:2px 0 0;font-size:11.5px;color:#64748B">'+esc(pt.especificaciones)+'</p>':'')+_scRefPartida(pt)+'</div>' +
        '<span style="flex-shrink:0;background:#F1F5F9;font-size:12px;font-weight:800;padding:5px 10px;border-radius:8px;height:fit-content">×'+esc(pt.cant)+' '+esc(pt.unidad||'')+'</span></div>';
    }).join('');
    if(sc.notas) izq += '<p style="font-size:12px;color:#334155;margin:4px 0 12px"><b>Notas:</b> '+esc(sc.notas)+'</p>';
    izq += '<div id="sc-fotos-grid" style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0"><span style="font-size:11.5px;color:#94A3B8">Cargando fotos…</span></div>' +
      '<label style="display:inline-flex;padding:7px 12px;border:1.5px dashed #CBD5E1;border-radius:9px;color:#1473E6;font-size:11.5px;font-weight:700;cursor:pointer;margin-bottom:16px">+ Agregar foto<input type="file" accept="image/*" multiple onchange="window.__scAgregarFoto(\''+id+'\',this)" style="display:none"></label>';

    if(esCompras && _scAbierta(sc)) izq += _scSeccionProveedores(sc);
    if(esCompras) izq += _scSeccionComparador(sc);
    if(esCompras && _scAbierta(sc) && !req) izq += _scSeccionCompartir(sc);
    if(!esCompras) izq += _scSeccionSolicitante(sc);
    if(req) izq += _scSeccionRequisicion(sc, req, esCompras);
    izq += _scSeccionConversacion(sc);

    // Columna derecha
    der += '<div style="background:#F8FAFD;border-radius:12px;padding:14px;position:sticky;top:0">';
    [['Empresa',sc.empresa],['Departamento',sc.departamento],['Tipo',_cpCatLabel(sc.tipoCompra)],['Para cuándo',sc.fechaRequerida?_scFmt(sc.fechaRequerida+'T12:00:00'):'—'],['Para qué / cliente',sc.cliente||'—'],['Requisición',sc.requisicionFolio||(req&&req.folio)||'—']]
      .concat(esCompras?[['Proveedores',(sc.proveedoresInvitados||[]).length+' preguntados · '+(sc.respuestas||[]).length+' respondieron'],['Mejor precio',mejor?_cpMoney(mejor.precioTotal)+' '+(mejor.moneda||''):'—']]:[])
      .forEach(function(r){ der += '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:12px;border-bottom:1px solid #EEF2F7"><span style="color:#5C7089">'+esc(r[0])+'</span><span style="font-weight:700;color:#0A1628;text-align:right">'+esc(r[1])+'</span></div>'; });
    if(esCompras && _scAbierta(sc)){
      var rec=sc.recordatorio, vencido = rec && rec.fecha && new Date(rec.fecha+'T23:59:59')<new Date();
      der += '<p style="font-size:11.5px;font-weight:800;color:#0A1628;margin:14px 0 6px">Dar seguimiento</p>' +
        (rec&&rec.fecha?'<p style="font-size:11.5px;margin:0 0 6px;color:'+(vencido?'#B91C1C':'#5C7089')+';font-weight:'+(vencido?'700':'400')+'">'+(vencido?'Ya toca: ':'Recordatorio: ')+_scFmt(rec.fecha+'T12:00:00')+(rec.nota?' — '+esc(rec.nota):'')+'</p>':'') +
        '<input id="sc-rec-fecha" type="date" class="cp-in" style="width:100%;margin-bottom:6px" value="'+esc(rec&&rec.fecha||'')+'" aria-label="Fecha del recordatorio">' +
        '<input id="sc-rec-nota" class="cp-in" style="width:100%;margin-bottom:6px" placeholder="Ej. Llamar a Proveedor X" value="'+esc(rec&&rec.nota||'')+'">' +
        '<button class="cp-btn" style="width:100%;justify-content:center" onclick="window.__scRecordatorio(\''+id+'\')">'+_cpIco('reloj')+'Guardar seguimiento</button>';
    }
    if(_scAbierta(sc)) der += '<button class="cp-btn peligro" style="width:100%;justify-content:center;margin-top:14px" onclick="window.__scCancelar(\''+id+'\')">Cancelar solicitud</button>';
    der += '</div>';

    h += '<div class="cp-dos" style="display:flex;gap:18px;align-items:flex-start"><div style="flex:1;min-width:0">'+izq+'</div><div style="width:260px;flex-shrink:0">'+der+'</div></div>';
    p.innerHTML=h;
    document.getElementById('sc-overlay').scrollTop = silencioso ? scrollPrev : 0;
    _scPintarFotos(id);
    if(esCompras) _scProveedores();
  };
  window.__scCerrar = function(){ _scDetalleId=null; };

  function _scSeccionProveedores(sc){
    var id=sc.id, invs=sc.proveedoresInvitados||[];
    var opc=(_proveedoresCache||[]).filter(function(p){ return !invs.some(function(i){ return _cpNorm(i.nombre)===_cpNorm(p.nombre); }); })
      .map(function(p){ return '<option value="'+p.id+'">'+esc(p.nombre)+(p.categoria?' · '+esc(p.categoria):'')+'</option>'; }).join('');
    var h='<div class="cp-sec"><h4><span class="cp-num">1</span>Pedir precios a proveedores</h4><p class="cp-ayuda">Agrega a quién le vas a preguntar y mándale la solicitud por el medio que prefieras.</p>';
    h += '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#334155;margin-bottom:10px;flex-wrap:wrap">Pedir respuesta a más tardar el <input type="date" class="cp-in" value="'+esc(sc.fechaLimiteRespuesta||'')+'" onchange="window.__scFechaLimite(\''+id+'\',this.value)"></label>';
    h += invs.length ? invs.map(function(inv,i){
      var estado = inv.respondioEn ? '<span class="cp-chip" style="background:#EAF3DE;color:#3B6D11">'+_cpIco('check')+'Respondió</span>'
        : inv.enviadoEn ? '<span class="cp-chip" style="background:#EFF6FF;color:#1E40AF">Enviado '+_scFmt(inv.enviadoEn,true)+'</span>'
        : '<span class="cp-chip" style="background:#FEF3C7;color:#92400E">Sin enviar</span>';
      return '<div style="border:1px solid #EEF2F7;border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><b style="font-size:13px">'+esc(inv.nombre)+'</b> '+estado+'<div style="font-size:11px;color:#94A3B8">'+esc([inv.correo,inv.telefono].filter(Boolean).join(' · ')||'Sin correo ni teléfono')+'</div></div>' +
        '<button onclick="window.__scQuitarInvitado(\''+id+'\','+i+')" aria-label="Quitar proveedor" style="background:none;border:none;color:#94A3B8;font-size:12px;cursor:pointer">Quitar</button></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' +
          '<button class="cp-btn" '+(inv.correo?'':'disabled')+' onclick="window.__scEnviar(\''+id+'\','+i+',\'correo\')">Correo</button>' +
          '<button class="cp-btn" '+(inv.correo?'':'disabled')+' onclick="window.__scEnviar(\''+id+'\','+i+',\'gmail\')">Gmail</button>' +
          '<button class="cp-btn" '+(_scTelWA(inv.telefono)?'':'disabled')+' onclick="window.__scEnviar(\''+id+'\','+i+',\'whatsapp\')" style="color:#15803D">WhatsApp</button>' +
          '<button class="cp-btn" onclick="window.__scEnviar(\''+id+'\','+i+',\'copiar\')">Copiar mensaje</button>' +
          '<button class="cp-btn" onclick="window.__scEnviar(\''+id+'\','+i+',\'pdf\')">'+_cpIco('bajar')+'PDF</button>' +
        '</div></div>';
    }).join('') : '<p style="font-size:12px;color:#94A3B8;margin:0 0 10px">Aún no agregas proveedores.</p>';
    h += '<div style="background:#F8FAFC;border-radius:10px;padding:10px;margin-top:6px">' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><select id="sc-inv-catalogo" class="cp-in" style="flex:1;min-width:200px"><option value="">Elegir del catálogo de proveedores…</option>'+opc+'</select></div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap"><input id="sc-inv-nombre" class="cp-in" placeholder="…o escribe uno nuevo" style="flex:1;min-width:140px"><input id="sc-inv-correo" class="cp-in" placeholder="Correo" style="flex:1;min-width:140px"><input id="sc-inv-tel" class="cp-in" placeholder="WhatsApp (10 dígitos)" style="width:150px"></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:8px"><label style="font-size:11.5px;color:#5C7089;display:flex;gap:6px;align-items:center"><input type="checkbox" id="sc-inv-guardar" checked> Guardar el nuevo en el catálogo</label>' +
      '<button class="cp-btn prim" onclick="window.__scInvitar(\''+id+'\')">+ Agregar proveedor</button></div></div>';
    h += '<p style="font-size:10.5px;color:#94A3B8;margin:8px 0 0">"Correo" y "Gmail" abren tu correo con todo escrito; adjunta el PDF si lo quieres mandar. El cliente nunca aparece en el mensaje.</p></div>';
    return h;
  }

  function _scSeccionComparador(sc){
    var id=sc.id, rs=sc.respuestas||[];
    var h='<div class="cp-sec"><h4><span class="cp-num">2</span>Comparar precios</h4>';
    if(!rs.length){
      h += '<p class="cp-ayuda">Cuando un proveedor te conteste, anota aquí su precio. Las compararemos lado a lado.</p>';
    } else {
      var validas=rs.filter(function(r){ return r.estado!=='rechazada'; });
      var mxn=validas.filter(function(r){ return (r.moneda||'MXN')==='MXN' && Number(r.precioTotal)>0; });
      var minP = mxn.length ? Math.min.apply(null, mxn.map(function(r){ return Number(r.precioTotal); })) : null;
      var conDias = validas.filter(function(r){ return r.tiempoEntregaDias!=null; });
      var minD = conDias.length ? Math.min.apply(null, conDias.map(function(r){ return Number(r.tiempoEntregaDias); })) : null;
      var calif = function(r){ var p=(_proveedoresCache||[]).find(function(x){ return x.id===r.proveedorId || _cpNorm(x.nombre)===_cpNorm(r.proveedor); }); return p && p.calificacion!=null ? Number(p.calificacion) : null; };
      var conCal = validas.map(calif).filter(function(c){ return c!=null; });
      var maxC = conCal.length ? Math.max.apply(null, conCal) : null;
      var hoy = new Date();
      var EST={recibida:['#F1F5F9','#475569','Recibida'], elegida:['#EAF3DE','#3B6D11','Buena opción'], aceptada:['#DCFCE7','#166534','Aceptada'], rechazada:['#FCEBEB','#B91C1C','Descartada'], ajuste:['#FEF3C7','#92400E','Pidió ajuste']};
      h += '<p class="cp-ayuda">Marcamos la más barata, la más rápida y la mejor calificada. '+(mxn.length<validas.filter(function(r){return Number(r.precioTotal)>0;}).length?'<b>Ojo:</b> hay precios en dólares; la "más barata" solo compara pesos.':'')+'</p>';
      h += '<div style="overflow-x:auto"><div style="display:grid;grid-template-columns:repeat('+rs.length+',minmax(210px,1fr));gap:10px;min-width:'+(rs.length*220)+'px">';
      h += rs.map(function(r, ri){
        var e=EST[r.estado]||EST.recibida, desc=r.estado==='rechazada';
        var vig = r.vigencia ? new Date(r.vigencia+'T23:59:59') : null, vencida = vig && vig<hoy, porVencer = vig && !vencida && (vig-hoy)<3*86400000;
        var badges = [];
        if(!desc && minP!=null && (r.moneda||'MXN')==='MXN' && Number(r.precioTotal)===minP) badges.push('<span class="cp-chip" style="background:#DCFCE7;color:#166534">'+_cpIco('check')+'Más barata</span>');
        if(!desc && minD!=null && Number(r.tiempoEntregaDias)===minD) badges.push('<span class="cp-chip" style="background:#DBEAFE;color:#1E40AF">'+_cpIco('camion')+'Más rápida</span>');
        if(!desc && maxC!=null && calif(r)===maxC) badges.push('<span class="cp-chip" style="background:#FEF9C3;color:#854D0E">★ Mejor calificada</span>');
        var c=calif(r);
        return '<div style="border:1.5px solid '+(r.estado==='aceptada'||r.estado==='elegida'?'#86EFAC':'#E5EAF1')+';border-radius:12px;padding:12px;opacity:'+(desc?.55:1)+';background:#fff">' +
          '<div style="display:flex;justify-content:space-between;gap:6px;align-items:flex-start"><b style="font-size:13px;color:#0A1628">'+esc(r.proveedor)+'</b><span class="cp-chip" style="background:'+e[0]+';color:'+e[1]+'">'+e[2]+'</span></div>' +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin:6px 0">'+badges.join('')+'</div>' +
          '<p style="margin:4px 0 0;font-size:20px;font-weight:800;color:#0A1628">'+_cpMoney(r.precioTotal)+' <span style="font-size:11px;color:#5C7089;font-weight:600">'+esc(r.moneda||'MXN')+(r.ivaIncluido===false?' + IVA':' con IVA')+'</span></p>' +
          '<div style="font-size:11.5px;color:#334155;margin-top:6px;line-height:1.6">' +
            '<div>Entrega: <b>'+(r.tiempoEntregaDias!=null?r.tiempoEntregaDias+' días':'—')+'</b></div>' +
            '<div>Pago: <b>'+esc(r.condicionesPago||'—')+'</b></div>' +
            '<div>Válida hasta: <b style="color:'+(vencida?'#B91C1C':porVencer?'#92400E':'inherit')+'">'+(vig?_scFmt(r.vigencia+'T12:00:00'):'—')+(vencida?' (vencida)':porVencer?' (vence pronto)':'')+'</b></div>' +
            '<div>Calificación: <b>'+(c!=null?'★ '+c.toFixed(1):'—')+'</b></div>' +
            (r.notas?'<div style="color:#64748B">'+esc(r.notas)+'</div>':'') +
            (r.ajustePedido&&r.estado==='ajuste'?'<div style="color:#92400E">Ajuste pedido: '+esc(r.ajustePedido)+'</div>':'') +
            (r.adjuntoId?'<div><a href="#" onclick="window.__scVerAdjunto(\''+id+'\',\''+r.adjuntoId+'\');return false" style="color:#1473E6;font-weight:700">Ver su cotización ('+esc(r.adjuntoNombre||'archivo')+')</a></div>':'') +
          '</div>' +
          (_scAbierta(sc) ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:10px">' +
            '<button class="cp-btn ok" style="justify-content:center" '+(desc?'disabled':'')+' onclick="window.__scAceptar(\''+id+'\',\''+r.id+'\')">Aceptar</button>' +
            '<button class="cp-btn peligro" style="justify-content:center" '+(desc?'disabled':'')+' onclick="window.__scRechazar(\''+id+'\',\''+r.id+'\')">Descartar</button>' +
            '<button class="cp-btn" style="justify-content:center" onclick="window.__scAjuste(\''+id+'\',\''+r.id+'\')">Pedir ajuste</button>' +
            '<button class="cp-btn" style="justify-content:center" onclick="window.__scFormRespuesta(\''+id+'\','+ri+')">Editar</button></div>' : '') +
        '</div>';
      }).join('') + '</div></div>';
    }
    if(_scAbierta(sc)) h += '<div id="sc-resp-form"></div><button class="cp-btn prim" style="margin-top:10px" onclick="window.__scFormRespuesta(\''+id+'\',-1)">+ Registrar respuesta de un proveedor</button>';
    h += '</div>';
    return h;
  }

  function _scSeccionCompartir(sc){
    var id=sc.id, rs=(sc.respuestas||[]).filter(function(r){ return r.estado!=='rechazada'; });
    var h='<div class="cp-sec"><h4><span class="cp-num">3</span>'+(sc.origen==='compras'?'Comprar':_scEsVentas(sc)?'Mandar opciones a quien pidió':'Elegir la ganadora')+'</h4>';
    if(!rs.length) return h+'<p class="cp-ayuda">Primero registra al menos un precio.</p></div>';
    if(sc.origen==='compras'){
      h += '<p class="cp-ayuda">Elige la opción para crear la requisición directamente.</p>';
      h += rs.map(function(r){ return '<button class="cp-btn" style="margin:0 6px 6px 0" onclick="window.__scConvertir(\''+id+'\',\''+r.id+'\')">Comprar a '+esc(r.proveedor)+' · '+_cpMoney(r.precioTotal)+'</button>'; }).join('');
      return h+'</div>';
    }
    if(!_scEsVentas(sc)){
      h += '<p class="cp-ayuda">La pidió <b>'+esc(sc.departamento||'otro departamento')+'</b>: quien la pidió no ve precios ni proveedores. Elige tú la ganadora y se convierte sola en requisición; al solicitante solo le avisamos que avanzó.</p>';
      h += rs.map(function(r){ return '<button class="cp-btn" style="margin:0 6px 6px 0" onclick="window.__scConvertir(\''+id+'\',\''+r.id+'\')">'+_cpIco('check')+'Elegir '+esc(r.proveedor)+' · '+_cpMoney(r.precioTotal)+(r.tiempoEntregaDias!=null?' · '+r.tiempoEntregaDias+' días':'')+'</button>'; }).join('');
      return h+'</div>';
    }
    var pre = (sc.compartidas&&sc.compartidas.length) ? sc.compartidas : rs.filter(function(r){ return r.estado==='elegida'; }).map(function(r){ return r.id; });
    if(!pre.length){ var m=_scMejor(sc); if(m) pre=[m.id]; }
    h += '<p class="cp-ayuda">Elige qué opciones verá '+esc(_cpTitulo((sc.solicitante&&sc.solicitante.nombre)||'el solicitante'))+'. Él decidirá y se convertirá sola en requisición.</p>';
    h += rs.map(function(r){ return '<label style="display:flex;gap:8px;align-items:center;font-size:12.5px;padding:6px 0;cursor:pointer"><input type="checkbox" class="sc-comp-chk" value="'+r.id+'"'+(pre.indexOf(r.id)>-1?' checked':'')+'> <b>'+esc(r.proveedor)+'</b> · '+_cpMoney(r.precioTotal)+' '+esc(r.moneda||'')+' · '+(r.tiempoEntregaDias!=null?r.tiempoEntregaDias+' días':'sin tiempo')+'</label>'; }).join('');
    h += '<label style="display:flex;gap:8px;align-items:center;font-size:12px;color:#5C7089;margin:6px 0"><input type="checkbox" id="sc-comp-prov"'+(sc.mostrarProveedor?' checked':'')+'> Mostrarle el nombre del proveedor</label>';
    h += '<input id="sc-comp-nota" class="cp-in" style="width:100%;margin-bottom:8px" placeholder="Nota para el solicitante (opcional). Ej. La opción 1 es original; la 2 es equivalente." value="'+esc(sc.notaCompras||'')+'">';
    h += '<button class="cp-btn prim" onclick="window.__scCompartir(\''+id+'\')">'+(sc.estatus==='lista'?'Actualizar lo que ve el solicitante':'Mandar al solicitante')+'</button>';
    return h+'</div>';
  }

  function _scSeccionSolicitante(sc){
    var id=sc.id, h='';
    if(sc.estatus==='lista' && _scEsVentas(sc)){
      var ops=(sc.respuestas||[]).filter(function(r){ return (sc.compartidas||[]).indexOf(r.id)>-1 && r.estado!=='rechazada'; });
      h += '<div class="cp-sec" style="border-color:#C4B5FD;background:#FAF5FF"><h4>'+_cpIco('check')+'Ya hay precio. ¿Cuál quieres?</h4>' +
        (sc.notaCompras?'<p class="cp-ayuda"><b>Compras dice:</b> '+esc(sc.notaCompras)+'</p>':'<p class="cp-ayuda">Elige una opción y se convierte en requisición.</p>');
      h += ops.map(function(r,i){
        return '<div style="background:#fff;border:1px solid #E9D5FF;border-radius:12px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<div><p style="margin:0;font-size:11px;font-weight:700;color:#6D28D9">OPCIÓN '+(i+1)+(sc.mostrarProveedor?' · '+esc(r.proveedor):'')+'</p>' +
          '<p style="margin:2px 0;font-size:20px;font-weight:800;color:#0A1628">'+_cpMoney(r.precioTotal)+' <span style="font-size:11px;color:#5C7089">'+esc(r.moneda||'MXN')+(r.ivaIncluido===false?' + IVA':' con IVA')+'</span></p>' +
          '<p style="margin:0;font-size:12px;color:#334155">Llega en '+(r.tiempoEntregaDias!=null?'<b>'+r.tiempoEntregaDias+' días</b>':'—')+(r.vigencia?' · Precio válido hasta '+_scFmt(r.vigencia+'T12:00:00'):'')+(r.notas?'<br><span style="color:#64748B">'+esc(r.notas)+'</span>':'')+'</p></div>' +
          '<button class="cp-btn ok" style="padding:11px 16px" onclick="window.__scConvertir(\''+id+'\',\''+r.id+'\')">Elegir esta y comprar</button></div>';
      }).join('');
      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px"><button class="cp-btn" onclick="window.__scPedirOtra(\''+id+'\')">Pedir otra opción</button><button class="cp-btn peligro" onclick="window.__scCancelar(\''+id+'\')">Ya no se necesita</button></div></div>';
    } else if(sc.estatus==='lista' || sc.estatus==='con_precios'){
      h += '<div class="cp-sec"><p style="margin:0;font-size:12.5px;color:#334155">'+_cpIco('check')+' Compras ya tiene precio y está eligiendo la mejor opción. Te avisaremos cuando se convierta en requisición. Puedes escribirles abajo.</p></div>';
    } else if(_scAbierta(sc)){
      h += '<div class="cp-sec"><p style="margin:0;font-size:12.5px;color:#334155">'+_cpIco('reloj')+' Compras está trabajando en tu cotización. Te llegará un aviso en cuanto haya precio. Puedes escribirles abajo.</p></div>';
    }
    return h;
  }

  function _scSeccionRequisicion(sc, req, esCompras){
    var e=_cpEstadoAmigable(req), env=req.envio, ve=esCompras||_scEsVentas(sc);
    var h='<div class="cp-sec" style="border-color:#BBF7D0;background:#F7FEF9"><h4>'+_cpIco('check')+'Requisición '+esc(req.folio||'')+'</h4>' +
      '<p style="margin:0 0 6px;font-size:12.5px;color:#0A1628"><b>'+esc(e.txt)+'</b>'+(e.quien?' — le toca a '+esc(e.quien):'')+'</p>' + _cpChipEspera(req);
    if(ve && req.cotizacionGanadora) h += '<p style="margin:8px 0 0;font-size:12px;color:#334155">Comprado a <b>'+esc(req.cotizacionGanadora.proveedor||'')+'</b> por <b>'+_cpMoney(req.cotizacionGanadora.monto)+'</b>'+(req.ocFolio?' · Orden '+esc(req.ocFolio):'')+'</p>';
    else if(ve && req.cotizacionPropuesta) h += '<p style="margin:8px 0 0;font-size:12px;color:#334155">Opción elegida: '+(esCompras||sc.mostrarProveedor?'<b>'+esc(req.cotizacionPropuesta.proveedor)+'</b> · ':'')+'<b>'+_cpMoney(req.cotizacionPropuesta.monto)+'</b>. En cuanto se autorice, se compra sola.</p>';
    if(env) h += '<div style="margin-top:10px">'+_envResumenHTML(req, false)+'</div>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">' +
      (esCompras?'<button class="cp-btn" onclick="document.getElementById(\'sc-overlay\').remove();window.__scCerrar();window.__cpAbrirDetalle(\''+req.id+'\')">Abrir requisición</button>':'<button class="cp-btn" onclick="window.__cpdVerReq(\''+req.id+'\')">Ver seguimiento</button>') +
      (ve?'<button class="cp-btn" onclick="window.__cpDescargarRequisicion(\''+req.id+'\')">'+_cpIco('bajar')+'PDF de la requisición</button>':'')+'</div></div>';
    return h;
  }

  function _scSeccionConversacion(sc){
    var ICO={creada:'persona', enviada:'firma', respuesta:'check', ajuste:'reloj', seguimiento:'reloj', comentario:'persona', compartida:'check', convertida:'check', aceptada:'check', comprada:'camion', cancelada:'alerta', proveedor:'persona'};
    var hist=(sc.historial||[]).slice().sort(function(a,b){ return String(a.fecha).localeCompare(String(b.fecha)); }), ve=_scVePrecios(sc);
    var h='<div class="cp-sec"><h4>'+_cpIco('historial')+'Conversación e historial</h4><div style="max-height:260px;overflow-y:auto;margin-bottom:10px">';
    h += hist.map(function(e){
      var com=e.tipo==='comentario', txt=_scHistSeguro(e, ve);
      if(txt===null) return '';
      return '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9"><span style="color:'+(com?'#1473E6':'#94A3B8')+';display:flex;padding-top:2px">'+_cpIco(ICO[e.tipo]||'reloj')+'</span>' +
        '<div style="font-size:12px;color:#0A1628;flex:1"><b>'+esc(_cpTitulo(e.por||''))+'</b> <span style="color:#94A3B8;font-size:10.5px">'+_scFmt(e.fecha,true)+'</span><div style="color:'+(com?'#0A1628':'#5C7089')+'">'+esc(txt||'')+'</div></div></div>';
    }).join('') || '<p style="font-size:12px;color:#94A3B8">Sin movimientos.</p>';
    h += '</div><div style="display:flex;gap:6px"><input id="sc-com-txt" class="cp-in" style="flex:1" placeholder="Escribe un mensaje…" onkeydown="if(event.key===\'Enter\')window.__scComentar(\''+sc.id+'\')"><button class="cp-btn prim" onclick="window.__scComentar(\''+sc.id+'\')">Enviar</button></div></div>';
    return h;
  }

  // ══ PESTAÑA "Cotizaciones" de Compras ══
  function _scPasaFiltros(sc){
    if(_scF.depto && sc.departamento!==_scF.depto) return false;
    if(_scF.categoria && sc.tipoCompra!==_scF.categoria) return false;
    if(_scF.proveedor){
      var t=_cpNorm(_scF.proveedor);
      var hay=(sc.proveedoresInvitados||[]).concat(sc.respuestas||[]).some(function(x){ return _cpNorm(x.nombre||x.proveedor).indexOf(t)>-1; });
      if(!hay) return false;
    }
    var f=_scFecha(sc.createdAt);
    if(_scF.desde && f && f<new Date(_scF.desde+'T00:00:00')) return false;
    if(_scF.hasta && f && f>new Date(_scF.hasta+'T23:59:59')) return false;
    var m=_scMejor(sc), mv=m?Number(m.precioTotal):null;
    if(_scF.montoMin && (mv==null || mv<Number(_scF.montoMin))) return false;
    if(_scF.montoMax && (mv==null || mv>Number(_scF.montoMax))) return false;
    if(_scF.texto){
      var bolsa=_cpNorm([sc.folio, sc.departamento, sc.cliente, sc.empresa, sc.solicitante&&sc.solicitante.nombre, sc.requisicionFolio,
        (sc.partidas||[]).map(function(p){ return [p.desc,p.numeroParte,p.marca,p.modelo].join(' '); }).join(' '),
        (sc.respuestas||[]).map(function(r){ return r.proveedor; }).join(' ')].join(' '));
      if(bolsa.indexOf(_cpNorm(_scF.texto))===-1) return false;
    }
    return true;
  }
  function _scRequiereSeguimiento(sc){
    if(!_scAbierta(sc)) return false;
    if(sc.recordatorio && sc.recordatorio.fecha && new Date(sc.recordatorio.fecha+'T23:59:59')<=new Date(Date.now()+86400000)) return true;
    if(sc.fechaLimiteRespuesta && new Date(sc.fechaLimiteRespuesta+'T23:59:59')<new Date() && (sc.proveedoresInvitados||[]).some(function(i){ return i.enviadoEn && !i.respondioEn; })) return true;
    return (sc.respuestas||[]).some(function(r){ if(!r.vigencia||r.estado==='rechazada') return false; var v=new Date(r.vigencia+'T23:59:59'); return v-Date.now()<3*86400000; });
  }
  window.__scFiltro = function(k,v){ _scF[k]=v; renderCotizaciones(); };
  window.__scKpi = function(k){ _scF.kpi = _scF.kpi===k?'':k; renderCotizaciones(); };
  var _scTimer=null; window.__scFiltroTexto=function(v){ clearTimeout(_scTimer); _scTimer=setTimeout(function(){ window.__scFiltro('texto',v); },180); };
  function renderCotizaciones(){
    var cont=document.getElementById('cp-sc-lista'); if(!cont) return;
    var dsel=document.getElementById('cp-scf-depto');
    if(dsel){ var act=dsel.value; var deps=_scDocs.map(function(s){ return s.departamento; }).filter(function(v,i,a){ return v&&a.indexOf(v)===i; }).sort();
      dsel.innerHTML='<option value="">Todos los departamentos</option>'+deps.map(function(d){ return '<option'+(d===act?' selected':'')+'>'+esc(d)+'</option>'; }).join(''); }
    var base=_scDocs.filter(_scPasaFiltros);
    var abiertas=base.filter(_scAbierta);
    var K=[
      {id:'',          lbl:'Abiertas',               n:abiertas.length,                                                         col:'#0A1628'},
      {id:'nueva',     lbl:'Por atender',            n:abiertas.filter(function(s){return s.estatus==='nueva';}).length,       col:'#B45309'},
      {id:'preguntando',lbl:'Preguntando precios',   n:abiertas.filter(function(s){return s.estatus==='preguntando';}).length, col:'#1473E6'},
      {id:'con_precios',lbl:'Con precios',           n:abiertas.filter(function(s){return s.estatus==='con_precios';}).length, col:'#1473E6'},
      {id:'lista',     lbl:'Esperando al solicitante',n:abiertas.filter(function(s){return s.estatus==='lista';}).length,      col:'#6D28D9'},
      {id:'seguimiento',lbl:'Requieren seguimiento', n:abiertas.filter(_scRequiereSeguimiento).length,                          col:'#B91C1C'},
      {id:'terminadas',lbl:'Terminadas',             n:base.filter(function(s){ return !_scAbierta(s); }).length,              col:'#12A150'},
    ];
    document.getElementById('cp-sc-kpis').innerHTML = K.map(function(k){
      var on=_scF.kpi===k.id;
      return '<button class="cp-kpi'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="window.__scKpi(\''+k.id+'\')"><span style="display:block;font-size:11px;color:#5C7089;font-weight:600;margin-bottom:4px">'+esc(k.lbl)+'</span><span style="display:block;font-size:24px;font-weight:800;color:'+k.col+'">'+k.n+'</span></button>';
    }).join('');
    var lista = _scF.kpi==='terminadas' ? base.filter(function(s){ return !_scAbierta(s); })
      : _scF.kpi==='seguimiento' ? abiertas.filter(_scRequiereSeguimiento)
      : _scF.kpi ? abiertas.filter(function(s){ return s.estatus===_scF.kpi; }) : abiertas;
    if(!lista.length){
      cont.innerHTML='<div style="text-align:center;padding:34px 10px;background:#F8FAFC;border-radius:12px"><p style="font-size:13px;color:#334155;margin:0 0 10px">'+(_scDocs.length?'No hay cotizaciones con estos filtros.':'Aún no hay solicitudes de cotización. Los departamentos pueden pedirlas con su botón "Cotizaciones", o créala tú aquí.')+'</p><button class="cp-btn prim" onclick="window.__scNueva(\'Compras\')">+ Nueva cotización</button></div>';
      return;
    }
    cont.innerHTML='<div style="overflow-x:auto;border:1px solid #EEF2F7;border-radius:12px"><table class="cp-tabla"><thead><tr><th>Folio</th><th>Pedida</th><th>De quién</th><th>Qué piden</th><th>Estado</th><th>Proveedores</th><th>Mejor precio</th><th>Para cuándo</th></tr></thead><tbody>' +
      lista.map(function(sc){
        var m=_scMejor(sc), seg=_scRequiereSeguimiento(sc);
        var pt=(sc.partidas||[])[0]||{};
        var dias = sc.fechaRequerida ? Math.ceil((new Date(sc.fechaRequerida+'T23:59:59')-Date.now())/86400000) : null;
        return '<tr class="cp-fila" tabindex="0" onclick="window.__scAbrirDetalle(\''+sc.id+'\',\'compras\')" onkeydown="if(event.key===\'Enter\')window.__scAbrirDetalle(\''+sc.id+'\',\'compras\')">' +
          '<td style="font-weight:800;white-space:nowrap">'+esc(sc.folio||'')+(sc.urgencia==='alta'?' <span class="cp-chip" style="background:#FCEBEB;color:#B91C1C">'+_cpIco('fuego')+'Urgente</span>':'')+'</td>' +
          '<td style="white-space:nowrap">'+_scFmt(sc.createdAt)+'</td>' +
          '<td>'+esc(sc.departamento||'—')+'<div style="font-size:11px;color:#5C7089">'+esc(_cpTitulo((sc.solicitante&&sc.solicitante.nombre)||''))+'</div></td>' +
          '<td style="max-width:240px"><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(pt.desc||'—')+'</div>'+((sc.partidas||[]).length>1?'<div style="font-size:11px;color:#94A3B8">+'+((sc.partidas||[]).length-1)+' más</div>':'')+'</td>' +
          '<td>'+_scChipEstado(sc)+(seg?'<div style="margin-top:3px"><span class="cp-chip" style="background:#FCEBEB;color:#B91C1C">'+_cpIco('reloj')+'Dar seguimiento</span></div>':'')+(sc.requisicionFolio?'<div style="font-size:11px;color:#12A150;font-weight:700">'+esc(sc.requisicionFolio)+'</div>':'')+'</td>' +
          '<td style="font-size:12px">'+(sc.proveedoresInvitados||[]).length+' preguntados<div style="font-size:11px;color:#5C7089">'+(sc.respuestas||[]).length+' respondieron</div></td>' +
          '<td style="font-weight:800;color:'+(m?'#12A150':'#94A3B8')+';white-space:nowrap">'+(m?_cpMoney(m.precioTotal)+' <span style="font-size:10px;color:#5C7089">'+esc(m.moneda||'')+'</span>':'—')+'</td>' +
          '<td style="white-space:nowrap;color:'+(dias!=null&&dias<=3&&_scAbierta(sc)?'#B91C1C':'inherit')+'">'+(sc.fechaRequerida?_scFmt(sc.fechaRequerida+'T12:00:00')+(dias!=null&&_scAbierta(sc)?'<div style="font-size:10.5px">'+(dias<0?'pasó hace '+(-dias)+' d':dias===0?'hoy':'en '+dias+' d')+'</div>':''):'—')+'</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  // ══════════════════════════════════════════════════════════════════
  //  FASE 4 — RASTREO DE ENVÍOS
  //  Se guarda en la requisición (campo 'envio'). Lo que es REAL: guía,
  //  paquetería, estado que capturan Compras/Almacén, enlace oficial de la
  //  paquetería y fecha estimada. Lo que es ESTIMADO: el punto en el mapa
  //  (se calcula por tiempo entre ciudad de origen y destino, no es GPS).
  //  'envio.rastreoAuto' queda reservado para conectar después un servicio
  //  de rastreo automático (requiere un servidor: p. ej. función de Supabase).
  // ══════════════════════════════════════════════════════════════════
  var ENV_PAQ = [
    {id:'dhl',n:'DHL',url:'https://www.dhl.com/mx-es/home/rastreo.html?tracking-id={g}'},
    {id:'fedex',n:'FedEx',url:'https://www.fedex.com/fedextrack/?trknbr={g}'},
    {id:'ups',n:'UPS',url:'https://www.ups.com/track?loc=es_MX&tracknum={g}'},
    {id:'estafeta',n:'Estafeta',url:'https://www.estafeta.com/'},
    {id:'paquetexpress',n:'Paquetexpress',url:'https://www.paquetexpress.com.mx/'},
    {id:'redpack',n:'Redpack',url:'https://www.redpack.com.mx/'},
    {id:'99minutos',n:'99minutos',url:'https://www.99minutos.com/'},
    {id:'castores',n:'Castores',url:'https://www.castores.com.mx/'},
    {id:'tresguerras',n:'Tres Guerras',url:'https://www.tresguerras.com.mx/'},
    {id:'otra',n:'Otra',url:''},
  ];
  var ENV_MOD = {
    domicilio:        {lbl:'Paquetería nos lo trae',                  pasos:['pedido','enviado','en_camino','en_reparto','entregado']},
    ocurre:           {lbl:'Paquetería: hay que recogerlo en sucursal',pasos:['pedido','enviado','en_camino','listo_recoger','entregado']},
    proveedor_entrega:{lbl:'El proveedor lo trae',                    pasos:['pedido','en_camino','entregado']},
    recoger_proveedor:{lbl:'Vamos por él con el proveedor',           pasos:['pedido','listo_recoger','entregado']},
  };
  var ENV_EST = {
    pedido:       {lbl:'Pedido al proveedor', corto:'Pedido'},
    enviado:      {lbl:'Ya salió',            corto:'Enviado'},
    en_camino:    {lbl:'Viene en camino',     corto:'En camino'},
    en_reparto:   {lbl:'En reparto: llega hoy',corto:'En reparto'},
    listo_recoger:{lbl:'Listo para recoger: hay que ir por él', corto:'Por recoger'},
    entregado:    {lbl:'Ya llegó',            corto:'Recibido'},
    detenido:     {lbl:'Detenido o con problema', corto:'Detenido'},
  };
  // Ciudades frecuentes (coordenadas aproximadas para el mapa estimado).
  var ENV_CIUDADES = {
    'Chihuahua':[28.632,-106.069],'Cd. Juárez':[31.690,-106.424],'Parral':[26.932,-105.666],'Delicias':[28.190,-105.470],'Cuauhtémoc':[28.405,-106.866],
    'Nuevo Casas Grandes':[30.415,-107.912],'Namiquipa':[29.250,-107.420],'Ojinaga':[29.564,-104.416],'Camargo':[27.667,-105.170],'Jiménez':[27.130,-104.917],
    'Monterrey':[25.686,-100.316],'Ciudad de México':[19.432,-99.133],'Guadalajara':[20.659,-103.349],'Querétaro':[20.588,-100.389],'León':[21.122,-101.686],
    'Puebla':[19.041,-98.206],'Torreón':[25.540,-103.406],'Saltillo':[25.423,-101.005],'Hermosillo':[29.072,-110.956],'Tijuana':[32.514,-117.038],
    'Mexicali':[32.624,-115.452],'Culiacán':[24.809,-107.394],'Durango':[24.027,-104.653],'San Luis Potosí':[22.156,-100.985],'Aguascalientes':[21.885,-102.291],
    'Toluca':[19.292,-99.657],'Veracruz':[19.173,-96.134],'Mérida':[20.967,-89.623],'Laredo':[27.530,-99.490],'El Paso, TX':[31.762,-106.485],'Houston, TX':[29.760,-95.370],
  };
  function _envPaq(e){ return ENV_PAQ.find(function(p){ return p.id===e.paqueteria; }) || {n:e.paqueteriaOtra||'Paquetería', url:''}; }
  function _envEta(e){
    if(!e || !e.fechaEstimada) return null;
    var f = new Date(e.fechaEstimada.length<=10 ? e.fechaEstimada+'T18:00:00' : e.fechaEstimada);
    return isNaN(f)?null:f;
  }
  function _envUltMov(e){ var ev=(e.eventos||[]); var f=ev.length?ev[ev.length-1].fecha:e.creadoEn; return f?new Date(f):null; }
  function _envDuracion(ms){
    var min=Math.round(Math.abs(ms)/60000), d=Math.floor(min/1440), h=Math.floor((min%1440)/60), m=min%60;
    if(d>0) return d+(d===1?' día':' días')+(h?' '+h+' h':'');
    if(h>0) return h+' h'+(m?' '+m+' min':'');
    return m+' min';
  }
  function _envCuentaTxt(e){
    if(!e) return '';
    if(e.estado==='entregado') return 'Ya llegó';
    if(e.estado==='listo_recoger') return 'Listo: hay que ir por él';
    var eta=_envEta(e); if(!eta) return 'Sin fecha estimada';
    var ms=eta-Date.now();
    return ms>=0 ? 'Llega en '+_envDuracion(ms) : 'Debió llegar hace '+_envDuracion(ms);
  }
  function _envAlertas(e){
    var out=[]; if(!e || e.estado==='entregado') return out;
    var eta=_envEta(e), ahora=Date.now();
    if(e.estado==='detenido') out.push({id:'detenido', txt:'Detenido o con problema', bg:'#FCEBEB', fg:'#B91C1C', ico:'alerta'});
    if(e.estado==='listo_recoger') out.push({id:'recoger', txt:'Hay que ir por él', bg:'#EDE9FE', fg:'#5B21B6', ico:'persona'});
    if(eta && eta<ahora && e.estado!=='listo_recoger') out.push({id:'retrasado', txt:'Retrasado', bg:'#FCEBEB', fg:'#B91C1C', ico:'alerta'});
    else if(eta && eta-ahora<=24*3600000 && eta>=ahora) out.push({id:'proximo', txt:'Llega pronto', bg:'#DCFCE7', fg:'#166534', ico:'camion'});
    var um=_envUltMov(e);
    if(um && ahora-um>=3*86400000 && ['enviado','en_camino'].indexOf(e.estado)>-1 && !out.some(function(a){return a.id==='retrasado';})) out.push({id:'sinmov', txt:'Sin movimiento hace '+_envDuracion(ahora-um), bg:'#FEF3C7', fg:'#92400E', ico:'reloj'});
    return out;
  }
  function _envChips(e){ return _envAlertas(e).map(function(a){ return '<span class="cp-chip" style="background:'+a.bg+';color:'+a.fg+'">'+_cpIco(a.ico)+esc(a.txt)+'</span>'; }).join(' '); }
  function _envCuentaSpan(e){
    var eta=_envEta(e), tarde = eta && eta<Date.now() && e.estado!=='entregado' && e.estado!=='listo_recoger';
    return '<span class="cp-cuenta" data-eta="'+(eta?eta.toISOString():'')+'" data-estado="'+esc(e.estado||'')+'" style="font-weight:800;color:'+(e.estado==='entregado'?'#12A150':tarde?'#B91C1C':'#0A1628')+'">'+esc(_envCuentaTxt(e))+'</span>';
  }
  // Actualiza los contadores cada minuto, sin volver a pintar nada más.
  setInterval(function(){
    Array.prototype.forEach.call(document.querySelectorAll('.cp-cuenta'), function(el){
      var e={estado:el.getAttribute('data-estado'), fechaEstimada:el.getAttribute('data-eta')||''};
      el.textContent=_envCuentaTxt(e);
    });
  }, 60000);

  function _envPasosHTML(e){
    var mod=ENV_MOD[e.modalidad]||ENV_MOD.domicilio, pasos=mod.pasos, idx=pasos.indexOf(e.estado);
    if(e.estado==='detenido') idx = Math.max(1, pasos.indexOf(e.estadoPrevio||'en_camino'));
    return '<div style="display:flex;align-items:flex-start;margin:8px 0 6px">' + pasos.map(function(p,i){
      var est = (e.estado==='detenido' && i===idx) ? 'alerta' : i<idx||e.estado==='entregado'?'hecho':i===idx?'actual':'espera';
      var bg = est==='hecho'?'#12A150':est==='actual'?'#1473E6':est==='alerta'?'#E23B2E':'#F1F5F9', fg=est==='espera'?'#94A3B8':'#fff';
      var lbl = p==='listo_recoger' ? (e.modalidad==='recoger_proveedor'?'Listo con proveedor':'En sucursal') : ENV_EST[p].corto;
      return '<div style="flex:1;min-width:52px;text-align:center"><div style="width:20px;height:20px;border-radius:50%;background:'+bg+';color:'+fg+';font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 3px">'+(est==='hecho'?'✓':est==='alerta'?'!':(i+1))+'</div><div style="font-size:9.5px;font-weight:700;color:'+(est==='espera'?'#94A3B8':'#334155')+'">'+esc(lbl)+'</div></div>' +
        (i<pasos.length-1?'<div style="flex:.5;min-width:8px;border-top:2px '+(i<idx||e.estado==='entregado'?'solid #12A150':'dotted #E2E8F0')+';margin-top:10px"></div>':'');
    }).join('') + '</div>';
  }
  // Resumen del envío (lo usan el detalle de Compras, el de cotización y el panel del departamento)
  function _envResumenHTML(req, conAcciones, idMapa){
    var e=req.envio; if(!e) return '';
    var paq=_envPaq(e), mod=ENV_MOD[e.modalidad]||ENV_MOD.domicilio;
    var h='<div style="border:1px solid #E5EAF1;border-radius:12px;padding:12px;background:#fff">' +
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start">' +
        '<div><p style="margin:0;font-size:13px;font-weight:800;color:#0A1628;display:flex;gap:6px;align-items:center">'+_cpIco('camion')+esc((ENV_EST[e.estado]||{}).lbl||e.estado)+'</p>' +
        '<p style="margin:2px 0 0;font-size:11.5px;color:#5C7089">'+esc(mod.lbl)+(e.paqueteria&&e.modalidad!=='proveedor_entrega'&&e.modalidad!=='recoger_proveedor'?' · '+esc(paq.n):'')+(e.guia?' · Guía <b>'+esc(e.guia)+'</b>':'')+'</p></div>' +
        '<div style="text-align:right">'+_envCuentaSpan(e)+(_envEta(e)&&e.estado!=='entregado'?'<div style="font-size:10.5px;color:#94A3B8">Estimado: '+_envEta(e).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})+'</div>':'')+'</div>' +
      '</div>' + _envPasosHTML(e) +
      '<div style="display:flex;gap:4px;flex-wrap:wrap">'+_envChips(e)+'</div>' +
      (e.lugarRecoger&&e.estado!=='entregado'?'<p style="margin:6px 0 0;font-size:12px;color:#5B21B6"><b>Dónde recoger:</b> '+esc(e.lugarRecoger)+'</p>':'') +
      (e.notas?'<p style="margin:6px 0 0;font-size:11.5px;color:#5C7089">'+esc(e.notas)+'</p>':'');
    if(idMapa) h += '<div id="'+idMapa+'" style="height:210px;border-radius:10px;margin-top:10px;background:#F1F5F9;overflow:hidden"></div><p style="font-size:10px;color:#94A3B8;margin:4px 0 0">'+_cpIco('alerta')+' Ubicación aproximada, calculada por tiempo entre '+esc(e.origen||'origen')+' y '+esc(e.destino||'destino')+'. No es GPS.</p>';
    var ev=(e.eventos||[]).slice().reverse();
    if(ev.length) h += '<details style="margin-top:8px"><summary style="font-size:11.5px;color:#1473E6;font-weight:700;cursor:pointer">Historial del envío ('+ev.length+')</summary>' +
      ev.map(function(x){ return '<div style="font-size:11.5px;padding:4px 0;border-bottom:1px solid #F1F5F9"><b>'+esc((ENV_EST[x.estado]||{}).corto||x.estado)+'</b> · '+_scFmt(x.fecha,true)+' · '+esc(_cpTitulo(x.por||''))+(x.nota?'<div style="color:#5C7089">'+esc(x.nota)+'</div>':'')+'</div>'; }).join('') + '</details>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">';
    if(e.guia && paq.url!=='' ) h += '<button class="cp-btn" onclick="window.__envAbrirPaq(\''+req.id+'\')">Ver en '+esc(paq.n)+'</button>';
    if(conAcciones && req.estatus!=='recibida'){
      h += '<button class="cp-btn" onclick="window.__envFormEstado(\''+req.id+'\')">Actualizar estado</button>' +
           '<button class="cp-btn" onclick="window.__envForm(\''+req.id+'\')">Editar datos</button>' +
           '<button class="cp-btn ok" onclick="window.__envRecibir(\''+req.id+'\')">'+_cpIco('check')+'Marcar como recibido</button>';
    }
    h += '</div><div id="env-form-'+req.id+'"></div></div>';
    return h;
  }
  window.__envAbrirPaq = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d||!d.envio) return;
    var paq=_envPaq(d.envio), g=d.envio.guia||'';
    _cpCopiar(g).then(function(){
      if(paq.url.indexOf('{g}')>-1) window.open(paq.url.replace('{g}', encodeURIComponent(g)),'_blank');
      else { toast('Guía '+g+' copiada. Pégala en el buscador de rastreo de '+paq.n+'.'); window.open(paq.url,'_blank'); }
    });
  };

  function _envMapa(divId, e){
    var el=document.getElementById(divId); if(!el) return;
    if(!window.L){ el.innerHTML='<p style="padding:20px;font-size:12px;color:#94A3B8;text-align:center">El mapa no está disponible.</p>'; return; }
    var o=ENV_CIUDADES[e.origen], dst=ENV_CIUDADES[e.destino];
    if(!o||!dst){ el.innerHTML='<p style="padding:20px;font-size:12px;color:#94A3B8;text-align:center">Elige ciudad de origen y destino para ver el mapa.</p>'; return; }
    if(el._mapa){ try{ el._mapa.remove(); }catch(x){} }
    var mapa=L.map(el,{zoomControl:true,attributionControl:true,scrollWheelZoom:false});
    el._mapa=mapa;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(mapa);
    L.polyline([o,dst],{color:'#1D2E73',weight:3,dashArray:'6 8',opacity:.8}).addTo(mapa);
    L.circleMarker(o,{radius:6,color:'#5C7089',fillColor:'#fff',fillOpacity:1,weight:2}).addTo(mapa).bindTooltip('Origen: '+e.origen);
    L.circleMarker(dst,{radius:7,color:'#12A150',fillColor:'#12A150',fillOpacity:1}).addTo(mapa).bindTooltip('Destino: '+e.destino);
    // Posición estimada por tiempo
    var t=0, salida = new Date(e.salidaEn || e.creadoEn || Date.now()), eta=_envEta(e);
    if(e.estado==='entregado'||e.estado==='listo_recoger'||e.estado==='en_reparto') t = e.estado==='en_reparto'?.95:1;
    else if(e.estado==='pedido') t=0;
    else if(eta && eta>salida) t=Math.max(.05, Math.min(.95,(Date.now()-salida)/(eta-salida)));
    else t=.5;
    var pos=[o[0]+(dst[0]-o[0])*t, o[1]+(dst[1]-o[1])*t];
    L.marker(pos,{icon:L.divIcon({className:'',html:'<div style="background:#E7402B;color:#fff;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3)">'+_cpIco('camion')+'</div>',iconSize:[26,26],iconAnchor:[13,13]})})
      .addTo(mapa).bindTooltip('Posición estimada ('+Math.round(t*100)+'% del camino)');
    mapa.fitBounds([o,dst],{padding:[24,24]});
    setTimeout(function(){ try{ mapa.invalidateSize(); }catch(x){} }, 120);
  }

  // ── Formulario de envío (alta / edición) ──
  window.__envForm = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d) return;
    var e=d.envio||{modalidad:'domicilio', destino:'Chihuahua', paqueteria:'estafeta'};
    var inp='width:100%;padding:8px 9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;box-sizing:border-box;font-family:inherit;background:#fff';
    var lab='display:block;font-size:11.5px;font-weight:700;color:#5C7089;margin:0 0 4px';
    var ciudades=Object.keys(ENV_CIUDADES);
    var selCiudad=function(idc,val){ return '<input id="'+idc+'" list="env-ciudades-dl" value="'+esc(val||'')+'" style="'+inp+'" placeholder="Ciudad">'; };
    var eta=_envEta(e), etaVal = eta ? new Date(eta.getTime()-eta.getTimezoneOffset()*60000).toISOString().slice(0,16) : '';
    var cont=document.getElementById('env-form-'+reqId) || document.getElementById('env-form-nuevo-'+reqId); if(!cont) return;
    cont.innerHTML='<div style="background:#F8FAFF;border:1.5px solid #C7D2FE;border-radius:12px;padding:14px;margin-top:10px">' +
      '<datalist id="env-ciudades-dl">'+ciudades.map(function(c){ return '<option value="'+esc(c)+'">'; }).join('')+'</datalist>' +
      '<p style="margin:0 0 10px;font-size:13px;font-weight:800">'+(d.envio?'Editar datos del envío':'¿Cómo va a llegar?')+'</p>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">' +
        '<div style="grid-column:1/-1"><label style="'+lab+'">Forma de entrega</label><select id="env-mod" style="'+inp+'" onchange="window.__envModCambio(this.value)">'+Object.keys(ENV_MOD).map(function(k){ return '<option value="'+k+'"'+(e.modalidad===k?' selected':'')+'>'+esc(ENV_MOD[k].lbl)+'</option>'; }).join('')+'</select></div>' +
        '<div class="env-w-paq"><label style="'+lab+'">Paquetería</label><select id="env-paq" style="'+inp+'">'+ENV_PAQ.map(function(p){ return '<option value="'+p.id+'"'+(e.paqueteria===p.id?' selected':'')+'>'+p.n+'</option>'; }).join('')+'</select></div>' +
        '<div class="env-w-paq"><label style="'+lab+'">Número de guía</label><input id="env-guia" value="'+esc(e.guia||'')+'" style="'+inp+'" placeholder="Ej. 1234567890"></div>' +
        '<div><label style="'+lab+'">¿Cuándo llega? (estimado)</label><input id="env-eta" type="datetime-local" value="'+etaVal+'" style="'+inp+'"></div>' +
        '<div><label style="'+lab+'">Sale de</label>'+selCiudad('env-origen', e.origen)+'</div>' +
        '<div><label style="'+lab+'">Llega a</label>'+selCiudad('env-destino', e.destino)+'</div>' +
        '<div class="env-w-rec" style="grid-column:1/-1"><label style="'+lab+'">¿Dónde hay que recogerlo?</label><input id="env-lugar" value="'+esc(e.lugarRecoger||'')+'" style="'+inp+'" placeholder="Sucursal, dirección u horario"></div>' +
      '</div>' +
      '<label style="'+lab+';margin-top:10px">Notas (opcional)</label><input id="env-notas" value="'+esc(e.notas||'')+'" style="'+inp+'">' +
      '<div style="display:flex;gap:8px;margin-top:12px"><button class="cp-btn ok" style="flex:1;justify-content:center" onclick="window.__envGuardar(\''+reqId+'\')">Guardar envío</button><button class="cp-btn" onclick="this.closest(\'div[id^=env-form]\').innerHTML=\'\'">Cancelar</button></div></div>';
    window.__envModCambio(e.modalidad||'domicilio');
  };
  window.__envModCambio = function(m){
    var paq = m==='domicilio'||m==='ocurre', rec = m==='ocurre'||m==='recoger_proveedor';
    Array.prototype.forEach.call(document.querySelectorAll('.env-w-paq'), function(x){ x.style.display=paq?'block':'none'; });
    Array.prototype.forEach.call(document.querySelectorAll('.env-w-rec'), function(x){ x.style.display=rec?'block':'none'; });
  };
  function _envNotificar(d, texto){
    var para = d.solicitanteEmail || _cpCorreoDe(d);
    if(para && para!==_cpMiCorreo()) _cpAvisar(para, 'Tu compra '+(d.folio||'')+': '+texto, '');
    var sc = d.cotizacionSC && _scDocs.find(function(s){ return s.id===d.cotizacionSC.id; });
    if(sc && sc.solicitante && sc.solicitante.correo && sc.solicitante.correo!==para) _scAvisarSolicitante(sc, 'Lo que pediste en '+sc.folio+' ('+(d.folio||'')+'): '+texto);
  }
  window.__envGuardar = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d) return;
    var v=function(i){ var el=document.getElementById(i); return el?String(el.value||'').trim():''; };
    var mod=v('env-mod'), usaPaq = mod==='domicilio'||mod==='ocurre';
    var guia=usaPaq?v('env-guia'):'', eta=v('env-eta');
    var previo=d.envio||null, ahora=new Date().toISOString();
    var estado = previo ? previo.estado : (guia ? 'enviado' : 'pedido');
    var e=Object.assign({}, previo||{}, {
      modalidad:mod, paqueteria:usaPaq?v('env-paq'):'', guia:guia, fechaEstimada:eta?new Date(eta).toISOString():'',
      origen:v('env-origen'), destino:v('env-destino'), lugarRecoger:v('env-lugar'), notas:v('env-notas'),
      estado:estado, actualizadoEn:ahora, actualizadoPor:_cpMiCorreo(), rastreoAuto:(previo&&previo.rastreoAuto)||null,
    });
    if(!previo){ e.creadoEn=ahora; e.salidaEn = estado==='enviado'?ahora:''; e.eventos=[{estado:estado, fecha:ahora, por:_cpMiNombre(), nota:guia?'Guía '+guia:'Envío registrado'}]; }
    else if(guia && !previo.guia && estado==='pedido'){ e.estado='enviado'; e.salidaEn=ahora; e.eventos=(previo.eventos||[]).concat([{estado:'enviado', fecha:ahora, por:_cpMiNombre(), nota:'Guía '+guia}]); }
    cargarFirestore().then(function(fs){
      return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',reqId), {envio:e}).then(function(){
        toast('Envío guardado');
        if(!previo || e.estado!==previo.estado) _envNotificar(d, (ENV_EST[e.estado]||{}).lbl+(e.fechaEstimada?' · llega aprox. el '+new Date(e.fechaEstimada).toLocaleDateString('es-MX'):''));
      });
    }).catch(function(err){ alert('No se pudo guardar: '+(err.message||err)); });
  };
  window.__envFormEstado = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d||!d.envio) return;
    var e=d.envio, mod=ENV_MOD[e.modalidad]||ENV_MOD.domicilio;
    var opciones=mod.pasos.filter(function(p){ return p!=='entregado'; }).concat(['detenido']);
    var sig = mod.pasos[Math.min(mod.pasos.length-2, Math.max(0, mod.pasos.indexOf(e.estado)+1))];
    var inp='padding:8px 9px;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px;font-family:inherit;box-sizing:border-box';
    document.getElementById('env-form-'+reqId).innerHTML='<div style="background:#F8FAFC;border-radius:10px;padding:12px;margin-top:10px">' +
      '<p style="margin:0 0 8px;font-size:12.5px;font-weight:800">¿Qué pasó con el envío?</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<select id="env-nuevo-estado" style="'+inp+';flex:1;min-width:180px">'+opciones.map(function(o){ return '<option value="'+o+'"'+(o===sig?' selected':'')+'>'+esc(ENV_EST[o].lbl)+'</option>'; }).join('')+'</select>' +
        '<input id="env-nueva-eta" type="datetime-local" style="'+inp+'" title="Nueva fecha estimada (opcional)" aria-label="Nueva fecha estimada">' +
      '</div>' +
      '<input id="env-nota-estado" placeholder="Nota (opcional): ej. Está en el CEDIS de Monterrey" style="'+inp+';width:100%;margin-top:8px">' +
      '<div style="display:flex;gap:8px;margin-top:10px"><button class="cp-btn prim" onclick="window.__envCambiarEstado(\''+reqId+'\')">Guardar y avisar</button><button class="cp-btn" onclick="document.getElementById(\'env-form-'+reqId+'\').innerHTML=\'\'">Cancelar</button></div></div>';
  };
  window.__envCambiarEstado = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d||!d.envio) return;
    var nuevo=document.getElementById('env-nuevo-estado').value, nota=(document.getElementById('env-nota-estado').value||'').trim(), neta=document.getElementById('env-nueva-eta').value;
    var ahora=new Date().toISOString();
    var e=Object.assign({}, d.envio, {estado:nuevo, actualizadoEn:ahora, actualizadoPor:_cpMiCorreo()});
    if(nuevo==='detenido') e.estadoPrevio=d.envio.estado;
    if(neta) e.fechaEstimada=new Date(neta).toISOString();
    if((nuevo==='enviado'||nuevo==='en_camino') && !e.salidaEn) e.salidaEn=ahora;
    e.eventos=(d.envio.eventos||[]).concat([{estado:nuevo, fecha:ahora, por:_cpMiNombre(), nota:nota}]);
    cargarFirestore().then(function(fs){
      return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',reqId), {envio:e}).then(function(){
        toast('Estado actualizado'); _envNotificar(d, ENV_EST[nuevo].lbl+(nota?' — '+nota:'')+(nuevo==='listo_recoger'&&e.lugarRecoger?' ('+e.lugarRecoger+')':''));
      });
    });
  };

  // ── Recibir (cierra el ciclo) ──
  var _envFotos=[];
  window.__envRecibir = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d) return;
    _envFotos=[];
    var p=_cpOverlay('env-rec-overlay', 2250, 520);
    p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="margin:0;font-size:16px">Recibir '+esc(d.folio||'')+'</h3><button aria-label="Cerrar" onclick="document.getElementById(\'env-rec-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer">✕</button></div>' +
      '<p style="font-size:12.5px;color:#5C7089;margin:0 0 12px">Toma foto de lo que llegó. Con esto se cierra la compra y se le avisa a quien la pidió.</p>' +
      '<p style="font-size:12px;font-weight:700;margin:0 0 6px">¿Cómo llegó?</p>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap"><label class="cp-btn" style="cursor:pointer"><input type="radio" name="env-cond" value="completo" checked> Completo y en buen estado</label><label class="cp-btn" style="cursor:pointer"><input type="radio" name="env-cond" value="con_detalles"> Con detalles / incompleto</label></div>' +
      '<label style="display:inline-flex;padding:9px 14px;border:1.5px dashed #CBD5E1;border-radius:9px;color:#1473E6;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:8px">+ Foto de evidencia<input type="file" accept="image/*" capture="environment" multiple onchange="window.__envFotoRec(this)" style="display:none"></label>' +
      '<div id="env-rec-fotos" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"></div>' +
      '<textarea id="env-rec-obs" rows="3" placeholder="Observaciones (qué faltó, quién lo recibió, etc.)" style="width:100%;padding:9px;border:1px solid #E2E8F0;border-radius:9px;font-size:12.5px;box-sizing:border-box;font-family:inherit"></textarea>' +
      '<p id="env-rec-err" role="alert" style="display:none;color:#B91C1C;font-size:12px;font-weight:700;margin:8px 0 0"></p>' +
      '<button id="env-rec-btn" class="cp-btn ok" style="width:100%;justify-content:center;padding:12px;margin-top:12px;font-size:13px" onclick="window.__envConfirmarRecibido(\''+reqId+'\')">'+_cpIco('check')+'Confirmar que llegó</button>';
  };
  window.__envFotoRec = function(input){
    Array.prototype.forEach.call(input.files||[], function(file){
      var r=new FileReader(); r.onload=function(){ _cpComprimirImagen(r.result,1100,0.7).then(function(src){
        _envFotos.push(src); var c=document.getElementById('env-rec-fotos'); if(c) c.innerHTML=_envFotos.map(function(s){ return '<img src="'+s+'" alt="Evidencia" style="width:64px;height:64px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0">'; }).join('');
      }); }; r.readAsDataURL(file);
    });
    input.value='';
  };
  window.__envConfirmarRecibido = function(reqId){
    var d=docs.find(function(x){ return x.id===reqId; }); if(!d) return;
    var cond=(document.querySelector('input[name="env-cond"]:checked')||{}).value||'completo';
    var obs=(document.getElementById('env-rec-obs').value||'').trim();
    if(cond==='con_detalles' && !obs){ var er=document.getElementById('env-rec-err'); er.textContent='Cuéntanos qué detalle tuvo.'; er.style.display='block'; return; }
    var btn=document.getElementById('env-rec-btn'); btn.disabled=true; btn.textContent='Guardando…';
    var ahora=new Date().toISOString();
    cargarFirestore().then(function(fs){
      return Promise.all(_envFotos.map(function(src){ return fs.addDoc(fs.collection(window.db,'requisiciones_compra',reqId,'fotos'), {src:src, origen:'recepcion', subidaPor:_cpMiCorreo(), fecha:ahora}); })).then(function(){
        var upd={estatus:'recibida', recibidaEn:ahora, recepcion:{por:_cpMiCorreo(), nombre:_cpMiNombre(), fecha:ahora, condicion:cond, observaciones:obs, fotos:_envFotos.length},
          bitacora: fs.arrayUnion({tipo:'recibida', fecha:ahora, por:_cpMiCorreo(), detalle:(cond==='completo'?'Llegó completo':'Llegó con detalles')+(obs?': '+obs:'')})};
        if(d.envio){ var e=Object.assign({}, d.envio, {estado:'entregado', actualizadoEn:ahora}); e.eventos=(d.envio.eventos||[]).concat([{estado:'entregado', fecha:ahora, por:_cpMiNombre(), nota:obs}]); upd.envio=e; }
        return fs.updateDoc(fs.doc(window.db,'requisiciones_compra',reqId), upd);
      }).then(function(){
        sincronizarCuentaPorPagar(Object.assign({},d,{estatus:'recibida'}), 'recibida');
        _envNotificar(d, cond==='completo' ? 'ya llegó y se recibió completo.' : 'ya llegó, pero con detalles: '+obs);
        if(d.cotizacionSC) _scActualizar(d.cotizacionSC.id, {}, {tipo:'comprada', texto:'Se recibió '+(d.folio||'')+(cond==='completo'?' completo':' con detalles')});
        document.getElementById('env-rec-overlay').remove();
        toast('Recibido. Se le avisó a quien lo pidió.');
      });
    }).catch(function(e){ btn.disabled=false; btn.textContent='Confirmar que llegó'; alert('No se pudo guardar: '+(e.message||e)); });
  };

  // ══ PESTAÑA "Rastreo" ══
  var _rasF={kpi:'', texto:'', vista:'lista'};
  window.__rasKpi=function(k){ _rasF.kpi=_rasF.kpi===k?'':k; renderRastreo(); };
  window.__rasTexto=function(v){ _rasF.texto=v; renderRastreo(); };
  window.__rasVista=function(v){ _rasF.vista=v; renderRastreo(); };
  var _rasMapa=null;
  function renderRastreo(){
    var cont=document.getElementById('cp-ras-lista'); if(!cont) return;
    var comprados = docs.filter(function(d){ return d.estatus==='orden_generada'; });
    var conEnvio = comprados.filter(function(d){ return d.envio; });
    var t=_cpNorm(_rasF.texto);
    var pasa=function(d){ if(!t) return true; return _cpNorm([d.folio,d.ocFolio,d.envio&&d.envio.guia,d.cotizacionGanadora&&d.cotizacionGanadora.proveedor,nombrePorCorreo(d.solicitante),(d.items||[]).map(function(i){return i.desc;}).join(' ')].join(' ')).indexOf(t)>-1; };
    var tiene=function(id){ return function(d){ return d.envio && _envAlertas(d.envio).some(function(a){ return a.id===id; }); }; };
    var K=[
      {id:'',         lbl:'Compras por llegar', fn:function(){return true;}, col:'#0A1628'},
      {id:'singuia',  lbl:'Sin datos de envío', fn:function(d){ return !d.envio; }, col:'#B45309'},
      {id:'camino',   lbl:'En camino',          fn:function(d){ return d.envio && ['enviado','en_camino','en_reparto'].indexOf(d.envio.estado)>-1; }, col:'#1473E6'},
      {id:'proximo',  lbl:'Llegan pronto',      fn:tiene('proximo'), col:'#12A150'},
      {id:'recoger',  lbl:'Hay que ir por ellos',fn:tiene('recoger'), col:'#5B21B6'},
      {id:'problema', lbl:'Retrasados o detenidos', fn:function(d){ return d.envio && _envAlertas(d.envio).some(function(a){ return ['retrasado','detenido','sinmov'].indexOf(a.id)>-1; }); }, col:'#B91C1C'},
    ];
    var base=comprados.filter(pasa);
    document.getElementById('cp-ras-kpis').innerHTML=K.map(function(k){ var on=_rasF.kpi===k.id; return '<button class="cp-kpi'+(on?' on':'')+'" aria-pressed="'+on+'" onclick="window.__rasKpi(\''+k.id+'\')"><span style="display:block;font-size:11px;color:#5C7089;font-weight:600;margin-bottom:4px">'+esc(k.lbl)+'</span><span style="display:block;font-size:24px;font-weight:800;color:'+k.col+'">'+base.filter(k.fn).length+'</span></button>'; }).join('');
    var kk=K.find(function(k){ return k.id===_rasF.kpi; })||K[0];
    var lista=base.filter(kk.fn).sort(function(a,b){ var ea=_envEta(a.envio), eb=_envEta(b.envio); return (ea?ea.getTime():9e15)-(eb?eb.getTime():9e15); });
    ['lista','mapa'].forEach(function(v){ var b=document.getElementById('cp-ras-v-'+v); if(b){ b.style.background=_rasF.vista===v?'#fff':'transparent'; b.style.boxShadow=_rasF.vista===v?'0 1px 3px rgba(10,22,40,.12)':'none'; } });
    if(_rasF.vista==='mapa'){
      cont.innerHTML='<div id="cp-ras-mapa" style="height:460px;border-radius:12px;background:#F1F5F9"></div><p style="font-size:10.5px;color:#94A3B8;margin:6px 0 0">Posiciones aproximadas calculadas por tiempo entre origen y destino. No es GPS.</p>';
      setTimeout(function(){ _rasPintarMapa(lista.filter(function(d){ return d.envio; })); }, 30);
      return;
    }
    if(!lista.length){
      cont.innerHTML='<div style="text-align:center;padding:34px 10px;background:#F8FAFC;border-radius:12px;font-size:13px;color:#334155">'+(comprados.length?'Nada en este filtro.':'No hay compras esperando llegar. Cuando se genere una orden de compra aparecerá aquí para que captures su guía.')+'</div>';
      return;
    }
    cont.innerHTML='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">'+lista.map(function(d){
      var item=(d.items||[])[0]||{};
      var head='<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px"><div style="min-width:0"><b style="font-size:13px">'+esc(d.folio||'')+'</b> <span style="font-size:11px;color:#5C7089">'+esc(d.ocFolio||'')+'</span>' +
        '<div style="font-size:11.5px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(item.desc||'')+'</div><div style="font-size:11px;color:#94A3B8">'+esc(_cpTitulo(nombrePorCorreo(d.solicitante)||''))+' · '+esc((d.cotizacionGanadora&&d.cotizacionGanadora.proveedor)||'')+'</div></div>' +
        '<button class="cp-btn" style="flex-shrink:0;height:fit-content" onclick="window.__cpAbrirDetalle(\''+d.id+'\')">Abrir</button></div>';
      if(!d.envio) return '<div class="cp-card" style="--c:#B45309;cursor:default">'+head+'<p style="font-size:12px;color:#92400E;margin:0 0 8px">'+_cpIco('alerta')+' Aún no tiene datos de envío.</p><button class="cp-btn prim" onclick="window.__cpAbrirDetalle(\''+d.id+'\')">Agregar guía</button></div>';
      var al=_envAlertas(d.envio), col = al.some(function(a){ return a.id==='retrasado'||a.id==='detenido'; })?'#E23B2E':al.some(function(a){return a.id==='recoger';})?'#5B21B6':'#1473E6';
      return '<div class="cp-card" style="--c:'+col+';cursor:default">'+head+_envResumenHTML(d, true)+'</div>';
    }).join('')+'</div>';
  }
  function _rasPintarMapa(lista){
    var el=document.getElementById('cp-ras-mapa'); if(!el||!window.L) return;
    if(_rasMapa){ try{ _rasMapa.remove(); }catch(x){} }
    _rasMapa=L.map(el,{scrollWheelZoom:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(_rasMapa);
    var pts=[];
    lista.forEach(function(d){
      var e=d.envio, o=ENV_CIUDADES[e.origen], dst=ENV_CIUDADES[e.destino]; if(!o||!dst) return;
      var salida=new Date(e.salidaEn||e.creadoEn||Date.now()), eta=_envEta(e), t=.5;
      if(e.estado==='pedido') t=0; else if(['listo_recoger','en_reparto'].indexOf(e.estado)>-1) t=.97; else if(eta&&eta>salida) t=Math.max(.05,Math.min(.95,(Date.now()-salida)/(eta-salida)));
      var pos=[o[0]+(dst[0]-o[0])*t, o[1]+(dst[1]-o[1])*t];
      L.polyline([o,dst],{color:'#94A3B8',weight:2,dashArray:'4 6'}).addTo(_rasMapa);
      var al=_envAlertas(e), c = al.some(function(a){ return a.id==='retrasado'||a.id==='detenido'; })?'#E23B2E':'#1D2E73';
      L.circleMarker(pos,{radius:8,color:'#fff',weight:2,fillColor:c,fillOpacity:1}).addTo(_rasMapa)
        .bindPopup('<b>'+esc(d.folio||'')+'</b><br>'+esc((ENV_EST[e.estado]||{}).lbl||'')+'<br>'+esc(_envCuentaTxt(e))+'<br><a href="#" onclick="window.__cpAbrirDetalle(\''+d.id+'\');return false">Abrir</a>');
      pts.push(o,dst);
    });
    if(pts.length) _rasMapa.fitBounds(pts,{padding:[30,30]}); else _rasMapa.setView(ENV_CIUDADES['Chihuahua'],6);
    setTimeout(function(){ try{ _rasMapa.invalidateSize(); }catch(x){} },120);
  }

  // Sección de envío dentro del detalle de la requisición (Compras).
  function _envSeccionDetalle(d){
    var h='<p style="font-size:11px;font-weight:700;color:#5C7089;margin:16px 0 8px;text-transform:uppercase">Rastreo del envío</p>';
    if(d.envio) return h + _envResumenHTML(d, d.estatus==='orden_generada', 'cp-env-mapa');
    if(d.estatus!=='orden_generada') return '';
    return h + '<div style="border:1.5px dashed #CBD5E1;border-radius:12px;padding:14px;text-align:center"><p style="font-size:12.5px;color:#334155;margin:0 0 10px">Ya se compró. Agrega cómo va a llegar para que todos puedan ver dónde viene.</p>' +
      '<button class="cp-btn prim" onclick="window.__envForm(\''+d.id+'\')">'+_cpIco('camion')+'Agregar datos de envío</button><div id="env-form-'+d.id+'" style="text-align:left"></div></div>';
  }

  // ══════════════════════════════════════════════════════════════════
  //  PANEL POR DEPARTAMENTO — botones "Cotizaciones" y "Mis requisiciones"
  //  que index.html muestra en cada área (contrato: window.cpAbrirPanelDepto).
  // ══════════════════════════════════════════════════════════════════
  var _cpdArea='', _cpdTab='cotizaciones';
  function _cpBotonPedirCot(){
    var c=document.getElementById('cp-depto-botones'); if(!c || document.getElementById('cp-btn-pedir-cot')) return;
    var b=document.createElement('button'); b.type='button'; b.id='cp-btn-pedir-cot';
    b.style.cssText='display:inline-flex;align-items:center;gap:7px;padding:9px 14px;border-radius:10px;border:1.5px solid #1D2E73;background:#1D2E73;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit';
    b.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Pedir cotización';
    b.onclick=function(){ window.__scNueva(typeof areaActual!=='undefined'?areaActual:''); };
    c.insertBefore(b, c.firstChild);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', _cpBotonPedirCot); else _cpBotonPedirCot();
  window.cpAbrirPanelDepto = function(tab, area){
    if(!window.db) return;
    _cpdArea = area || _cpdArea; _cpdTab = tab || _cpdTab;
    _cpInyectarEstilos(); escucharSC(); escuchar();
    var p=_cpOverlay('cpd-overlay', 2100, 980);
    p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px"><div><h2 style="margin:0;font-size:19px;color:#0A1628">Compras para '+esc(_cpdArea)+'</h2><p style="margin:3px 0 0;font-size:12.5px;color:#5C7089">Pide precios, sigue tus requisiciones y mira dónde viene lo que se compró.</p></div>' +
      '<button aria-label="Cerrar" onclick="document.getElementById(\'cpd-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:32px;height:32px;cursor:pointer;flex-shrink:0">✕</button></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;border-bottom:1px solid #EEF2F7;margin-bottom:14px">' +
        '<div style="display:flex;gap:20px"><button id="cpd-t-cotizaciones" onclick="window.cpAbrirPanelDepto(\'cotizaciones\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;cursor:pointer">Mis cotizaciones</button><button id="cpd-t-requisiciones" onclick="window.cpAbrirPanelDepto(\'requisiciones\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;cursor:pointer">Mis requisiciones</button><button id="cpd-t-camino" onclick="window.cpAbrirPanelDepto(\'camino\')" style="padding:10px 2px;border:none;background:none;font-size:13.5px;font-weight:700;cursor:pointer">En camino</button></div>' +
        '<button class="cp-btn prim" style="margin-bottom:8px" onclick="window.__scNueva(\''+esc(_cpdArea).replace(/'/g,"\\'")+'\')">+ Pedir una cotización</button></div>' +
      '<input class="cp-in" style="width:100%;margin-bottom:12px" placeholder="Buscar por folio o pieza…" oninput="window.__cpdBuscar(this.value)" id="cpd-buscar">' +
      '<div id="cpd-lista"><p style="text-align:center;color:#94A3B8;font-size:12.5px;padding:20px">Cargando…</p></div>';
    ['cotizaciones','requisiciones','camino'].forEach(function(t){ var b=document.getElementById('cpd-t-'+t); b.style.color=t===_cpdTab?'#0A1628':'#94A3B8'; b.style.borderBottom='2px solid '+(t===_cpdTab?'#0A1628':'transparent'); });
    _cpdRender();
  };
  var _cpdTexto='';
  window.__cpdBuscar=function(v){ _cpdTexto=v; _cpdRender(); };
  function _cpdEsMio(depto, correo){ return (_cpdArea && depto && _cpNorm(depto)===_cpNorm(_cpdArea)) || (correo && correo.toLowerCase()===_cpMiCorreo()); }
  function _cpdRender(){
    var cont=document.getElementById('cpd-lista'); if(!cont) return;
    var t=_cpNorm(_cpdTexto);
    if(_cpdTab==='cotizaciones'){
      var mias=_scDocs.filter(function(s){ return _cpdEsMio(s.departamento, s.solicitante&&s.solicitante.correo); })
        .filter(function(s){ return !t || _cpNorm([s.folio, s.requisicionFolio, (s.partidas||[]).map(function(p){return p.desc+' '+p.numeroParte;}).join(' ')].join(' ')).indexOf(t)>-1; });
      if(!mias.length){ cont.innerHTML='<div style="text-align:center;padding:30px 10px;background:#F8FAFC;border-radius:12px"><p style="font-size:13px;color:#334155;margin:0 0 4px"><b>Aún no tienes cotizaciones.</b></p><p style="font-size:12px;color:#5C7089;margin:0 0 12px">Por ejemplo: un cliente te pide el precio de una pieza. Pídela aquí y Compras te consigue el precio.</p><button class="cp-btn prim" onclick="window.__scNueva(\''+esc(_cpdArea).replace(/'/g,"\\'")+'\')">+ Pedir una cotización</button></div>'; return; }
      var orden=function(s){ return s.estatus==='lista'?0:_scAbierta(s)?1:s.estatus==='convertida'?2:3; };
      cont.innerHTML = mias.slice().sort(function(a,b){ return orden(a)-orden(b); }).map(function(s){
        var pt=(s.partidas||[])[0]||{}, req=s.estatus==='convertida'?_scReq(s):null, col=s.estatus==='lista'?'#6D28D9':(SC_EST[s.estatus]||{}).col||'#94A3B8';
        return '<div class="cp-card" style="--c:'+col+'" role="button" tabindex="0" onclick="window.__scAbrirDetalle(\''+s.id+'\',\'solicitante\')" onkeydown="if(event.key===\'Enter\')window.__scAbrirDetalle(\''+s.id+'\',\'solicitante\')">' +
          (pt.miniatura?'<img src="'+pt.miniatura+'" alt="" style="float:left;width:48px;height:48px;object-fit:cover;border-radius:8px;margin-right:10px">':'')+'<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div style="min-width:0"><b style="font-size:13px">'+esc(s.folio||'')+'</b> '+(s.estatus==='lista'?'<span class="cp-chip" style="background:#EDE9FE;color:#5B21B6">'+_cpIco('check')+'Te toca decidir</span>':'')+
          '<div style="font-size:12px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(pt.desc||'')+((s.partidas||[]).length>1?' (+'+((s.partidas||[]).length-1)+')':'')+'</div>' +
          '<div style="font-size:11.5px;color:#5C7089;margin-top:3px"><b>'+esc(_scEstadoTexto(s))+'</b></div></div>' +
          '<div style="text-align:right;font-size:11px;color:#94A3B8">'+_scFmt(s.createdAt)+(req&&req.envio&&req.estatus!=='recibida'?'<div>'+_envCuentaSpan(req.envio)+'</div>':'')+'</div></div>' +
          '<div style="margin-top:6px">'+_scTimelineMini(s)+'</div></div>';
      }).join('');
    } else {
      var reqs=docs.filter(function(d){ return _cpdEsMio(deptoSolicitante(d), _cpCorreoDe(d)); })
        .filter(function(d){ return _cpdTab!=='camino' || (d.envio && d.estatus!=='recibida' && d.estatus!=='rechazada'); })
        .filter(function(d){ return !t || _cpNorm([d.folio, d.ocFolio, (d.items||[]).map(function(i){return i.desc;}).join(' ')].join(' ')).indexOf(t)>-1; });
      if(!reqs.length){ cont.innerHTML='<div style="text-align:center;padding:30px 10px;background:#F8FAFC;border-radius:12px;font-size:13px;color:#334155">'+(_cpdTab==='camino'?'No hay nada en camino para '+esc(_cpdArea)+' ahorita.':'No hay requisiciones de '+esc(_cpdArea)+' todavía.')+'</div>'; return; }
      var ord=function(d){ return d.estatus==='recibida'||d.estatus==='rechazada'?1:0; };
      cont.innerHTML = reqs.slice().sort(function(a,b){ return ord(a)-ord(b) || ((_cpFechaDoc(b)||0)-(_cpFechaDoc(a)||0)); }).slice(0,80).map(function(d){
        var e=_cpEstadoAmigable(d), col=d.estatus==='rechazada'?'#E23B2E':_cpColDe(d).color, item=(d.items||[])[0]||{};
        return '<div class="cp-card" style="--c:'+col+'" role="button" tabindex="0" onclick="window.__cpdVerReq(\''+d.id+'\')" onkeydown="if(event.key===\'Enter\')window.__cpdVerReq(\''+d.id+'\')">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div style="min-width:0"><b style="font-size:13px">'+esc(d.folio||'')+'</b> '+_cpChipDirecto(d) +
          '<div style="font-size:12px;color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(item.desc||'')+'</div>' +
          '<div style="font-size:11.5px;color:#5C7089;margin-top:3px"><b>'+esc(d.envio&&d.estatus!=='recibida'?(ENV_EST[d.envio.estado]||{}).lbl:e.txt)+'</b>'+(e.quien?' — le toca a '+esc(e.quien):'')+'</div></div>' +
          '<div style="text-align:right">'+(d.envio&&d.estatus!=='recibida'?_envCuentaSpan(d.envio)+'<div>'+_envChips(d.envio)+'</div>':_cpChipEspera(d))+'</div></div></div>';
      }).join('');
    }
  }
  function _scTimelineMini(s){
    var idx=_scPasoIdx(s); if(idx<0) return '<span class="cp-chip" style="background:#F1F5F9;color:#5C7089">Cancelada</span>';
    return '<div style="display:flex;gap:3px" aria-label="Paso '+(idx+1)+' de '+SC_PASOS.length+': '+esc(SC_PASOS[idx])+'">'+SC_PASOS.map(function(p,i){ return '<div title="'+esc(p)+'" style="flex:1;height:5px;border-radius:3px;background:'+(i<idx?'#12A150':i===idx?'#1473E6':'#E2E8F0')+'"></div>'; }).join('')+'</div><div style="font-size:10.5px;color:#5C7089;margin-top:3px">Paso '+(idx+1)+' de '+SC_PASOS.length+': <b>'+esc(SC_PASOS[idx])+'</b></div>';
  }
  // Vista de seguimiento de una requisición para el departamento (solo lectura).
  window.__cpdVerReq = function(id){
    var d=docs.find(function(x){ return x.id===id; }); if(!d) return;
    var e=_cpEstadoAmigable(d), sig=_cpQueSigue(d);
    var p=_cpOverlay('cpd-req-overlay', 2160, 640);
    p.innerHTML='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px"><div><h3 style="margin:0;font-size:17px">'+esc(d.folio||'')+' · '+esc(d.empresa||'')+'</h3><p style="margin:3px 0 0;font-size:12px;color:#5C7089">'+esc(_cpTitulo(nombrePorCorreo(d.solicitante)||''))+'</p></div>' +
      '<button aria-label="Cerrar" onclick="document.getElementById(\'cpd-req-overlay\').remove()" style="background:#F1F5F9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer">✕</button></div>' +
      '<div style="background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12.5px"><b>Ahora:</b> '+esc(e.txt)+(e.quien?' — le toca a <b>'+esc(e.quien)+'</b>':'')+' '+_cpChipEspera(d)+(sig?'<div style="color:#5C7089;margin-top:4px"><b>Sigue:</b> '+esc(sig)+'</div>':'')+'</div>' +
      (d.autorizacionDirecta?'<div style="margin-bottom:10px">'+_cpChipDirecto(d)+'</div>':'') +
      (d.items||[]).map(function(it){ return '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:9px 12px;margin-bottom:6px;display:flex;justify-content:space-between;gap:8px;font-size:12.5px"><span>'+esc(it.desc||'')+'</span><b>×'+esc(it.cant||'')+' '+esc(it.unidad||'')+'</b></div>'; }).join('') +
      (d.envio?'<p style="font-size:11px;font-weight:700;color:#5C7089;margin:14px 0 8px;text-transform:uppercase">¿Dónde viene?</p>'+_envResumenHTML(d, false, 'cpd-env-mapa'):(d.estatus==='orden_generada'?'<p style="font-size:12px;color:#5C7089;margin:12px 0">Ya se compró. Compras capturará los datos del envío pronto.</p>':'')) +
      (d.recepcion?'<div style="background:#F0FDF4;border-radius:10px;padding:10px 12px;margin-top:12px;font-size:12px;color:#14532D"><b>Recibido</b> el '+_scFmt(d.recepcion.fecha,true)+' por '+esc(_cpTitulo(d.recepcion.nombre||''))+(d.recepcion.observaciones?' — '+esc(d.recepcion.observaciones):'')+'</div>':'') +
      ((d.origen==='cotizacion' && _cpNorm(deptoSolicitante(d))!=='ventas')?'':'<div style="display:flex;gap:6px;margin-top:14px"><button class="cp-btn" onclick="window.__cpDescargarRequisicion(\''+d.id+'\')">'+_cpIco('bajar')+'PDF</button></div>');
    if(d.envio) setTimeout(function(){ _envMapa('cpd-env-mapa', d.envio); }, 40);
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
      var ad = d.autorizacionDirecta;
      if(ad){
        var otg = ad.otorgadoPor ? _cpTitulo(ad.otorgadoPor.nombre||ad.otorgadoPor.correo) : '—';
        html += ad.revertida
          ? '<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#78350F"><b>Regresó a su jefe.</b> Había pasado directo, pero el precio elegido ('+_cpMoney(ad.revertida.monto)+') pasa el límite del permiso ('+_cpMoney(ad.revertida.limite)+'). La cotización quedó guardada; cuando la aprueben, solo vuelve a elegirla.</div>'
          : '<div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:12px;color:#312E81;display:flex;gap:8px;align-items:flex-start">'+_cpIco('rayo')+'<span><b>Autorización directa:</b> no esperó a su jefe. Permiso: '+esc(ad.descripcion||'')+' · lo dio '+esc(otg)+'.'+(Number(ad.limite)>0?' Si el precio final pasa de '+_cpMoney(ad.limite)+', regresará a su jefe.':'')+'</span></div>';
      }
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
      var dirF = f.via==='autorizacion_directa';
      var bg = dirF?'#EEF2FF':f.estatus==='aprobado'?'#EAF3DE':(f===pasoActivo?'#FAEEDA':'#F1F5F9');
      var col = f.estatus==='aprobado'?'#3B6D11':(f===pasoActivo?'#633806':'#5C7089');
      htmlIzq += '<div style="flex:1;text-align:center;padding:8px 4px;border-radius:9px;background:'+bg+'">' +
        '<p style="font-size:10.5px;font-weight:700;margin:0;color:'+col+'">'+esc(f.label)+'</p>' +
        '<p style="font-size:9.5px;margin:2px 0 0;color:'+(dirF?'#3730A3':'#5C7089')+'">'+(dirF?'Autorización directa':f.estatus==='aprobado'?'Aprobado':(f===pasoActivo?'Tu turno':'En espera'))+'</p></div>';
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
      htmlIzq += '<button onclick="window.__cpEnviarDirectoACompra(\''+d.id+'\')" style="width:100%;padding:10px;background:#12A150;color:#fff;border:none;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;margin-bottom:8px">Enviar directo a compra (genera OC)</button>';
      htmlIzq += '<button class="cp-btn" style="width:100%;justify-content:center;padding:10px;margin-bottom:12px" onclick="window.__scDesdeRequisicion(\''+d.id+'\')">'+(d.cotizacionSC?'Ver la cotización '+esc(d.cotizacionSC.folio||''):'Pedir precios a varios proveedores y compararlos')+'</button>';
    }

    if(d.cotizacionSC && d.estatus!=='cotizando') htmlIzq += '<p style="font-size:12px;margin:10px 0"><a href="#" onclick="window.__scAbrirDetalle(\''+d.cotizacionSC.id+'\',\'compras\');return false" style="color:#1473E6;font-weight:700">Ver la cotización '+esc(d.cotizacionSC.folio||'')+'</a></p>';
    if(d.estatus==='orden_generada' || d.estatus==='recibida') htmlIzq += _envSeccionDetalle(d);
    if(d.recepcion) htmlIzq += '<div style="background:#F0FDF4;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:12px;color:#14532D"><b>Recibido</b> el '+_scFmt(d.recepcion.fecha,true)+' por '+esc(_cpTitulo(d.recepcion.nombre||''))+' · '+(d.recepcion.condicion==='completo'?'completo':'con detalles')+(d.recepcion.observaciones?' — '+esc(d.recepcion.observaciones):'')+'</div>';

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
      htmlDer += '<button onclick="window.__envRecibir(\''+d.id+'\')" style="width:100%;margin-top:12px;padding:11px;background:#12A150;color:#fff;border:none;border-radius:9px;font-weight:600;cursor:pointer;font-size:12.5px">Marcar como recibida</button>';
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
    if(d.envio) setTimeout(function(){ _envMapa('cp-env-mapa', d.envio); }, 40);
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
        if(esUltimo){
          if(d.cotizacionPropuesta && !d.ocFolio){
            var dd = Object.assign({}, d, {flujoAutorizacion:flujo, estatus:'cotizando'});
            _cpGenerarOCDesdeCot(fs, dd, d.cotizacionPropuesta);
            return;
          }
          toast('Requisición autorizada — pasa a Cotizando'); return;
        }
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
      _cpGetDocsCache(fs, fs.collection(window.db,'requisiciones_compra',id,'cotizaciones')).then(function(cots){
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
        var dLim = docs.find(function(x){ return x.id===id; });
        _cpRevisarLimiteDirecto(fs, dLim||{id:id}, cotizacionGanadora).then(function(regreso){ if(regreso) return;
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
          var cotizacionGanadora={proveedor:proveedor,monto:Number(monto),cotizacionId:cotRef.id};
          return _cpRevisarLimiteDirecto(fs, d, cotizacionGanadora).then(function(regreso){ if(regreso) return;
          var ocFolio='OC-'+String(Date.now()).slice(-6);
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
    var cg = d.cotizacionGanadora || d.cotizacionPropuesta;
    if(cg && (cg.tiempoEntregaDias!=null || cg.condicionesPago || cg.vigencia || cg.scFolio)){
      campoAncho('Condiciones de la cotización', [cg.moneda?'Moneda: '+cg.moneda+(cg.ivaIncluido===false?' + IVA':' con IVA'):'', cg.tiempoEntregaDias!=null?'Entrega: '+cg.tiempoEntregaDias+' días':'', cg.condicionesPago?'Pago: '+cg.condicionesPago:'', cg.vigencia?'Vigencia: '+new Date(cg.vigencia+'T12:00:00').toLocaleDateString('es-MX'):'', cg.scFolio?'Cotización '+cg.scFolio:''].filter(Boolean).join(' · '));
    }
    if(d.autorizacionDirecta && !d.autorizacionDirecta.revertida) campoAncho('Autorización directa', d.autorizacionDirecta.descripcion||'Sí');
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
      docu.text(p.via==='autorizacion_directa'?'Autorización directa':p.estatus==='aprobado'?'Aprobado':'Pendiente', PW-MR-2, y, {align:'right'});
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
