// ═══════════════════════════════════════════════════════════════════════
//  portal-supabase.js — Portal Operativo Tecnocontrol  (Paso 1, sep-2026)
// ═══════════════════════════════════════════════════════════════════════
//  Saca de Firestore lo que TODO usuario leía al entrar al portal:
//    · actividades          (tareas del dashboard, chat, parrilla, Ventas, Flotilla)
//    · eventos_calendario   (Calendario 360)
//    · flotilla_notificaciones → tabla portal_notificaciones
//  El listener de `actividades` (≈800 lecturas por cada recarga de cada
//  usuario) era lo que agotaba la cuota diaria del plan Spark.
//
//  API global:
//    window.tcAct.suscribir(cb)          cb recibe un "snapshot" compatible
//                                         ({ docs:[{ id, data() }] }) — así
//                                         el código de index.html casi no cambia
//    window.tcAct.lista()                copia en memoria (camelCase)
//    window.tcAct.obtener(id)            → objeto o null
//    window.tcAct.crear(obj)             → id nuevo
//    window.tcAct.actualizar(id, cambios)
//    window.tcAct.agregarComentario(id, comentario)   (atómico, como arrayUnion)
//    window.tcAct.borrar(id)
//    window.tcEventosCal.suscribir(cb) / .crear(obj)
//    window.tcNotificar(datos)           reemplaza addDoc(flotilla_notificaciones)
//    window.tcSbNotifSuscribir(cb)       cb(datos) por cada notificación NUEVA
//    window.tcMigrarPaso1()              copia única Firestore → Supabase
//
//  Matriz de notificaciones (Fase 1, oct-2026) — tablas notif_* en Supabase:
//    window.tcNotifModulo(aviso)          → 'Operaciones' | 'Flotilla' | … | 'Sin clasificar'
//    window.tcNotifPermitida(correo, {modulo, personal, tipo})  → true/false
//    window.tcNotificarEvento(evento, datos)  avisa a los destinatarios de la matriz
//    window.tcNotifRecargar()             vuelve a leer la configuración
//    window.tcNotifConfig()               copia de la configuración cargada
//  Si las tablas no existen o fallan, TODO se entrega como antes (nunca se pierde un aviso).
//
//  Aspel (Fase 2, oct-2026) — datos confidenciales, solo con sesión real del portal:
//    window.tcSbSesion()                  cliente de Supabase que manda la sesión de Firebase
//    window.tcAspel.diagnostico()         ¿Supabase me reconoce? ¿puedo leer Aspel?
//    window.tcAspel.estadoCuenta(clave?)  saldo, vencido, semáforo (todos o un cliente)
//    window.tcAspel.facturas({cliente, plaza, estatus, desde, limite})
//    window.tcAspel.documento(tipDoc, cveDoc) · calidadClientes() · estadoSincronizacion()
//
//  El `id` que ve el resto del código es `firestore_id` (los ids de Firestore
//  de siempre; las tareas nuevas reciben un UUID) — así los vínculos que ya
//  existen (parrilla → tareaId, compartidos, etc.) siguen funcionando.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SUPABASE_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
  var _promesa = null;
  function sb() {
    if (window.tcSupabase) return Promise.resolve(window.tcSupabase);
    if (_promesa) return _promesa;
    _promesa = import('https://esm.sh/@supabase/supabase-js@2').then(function (mod) {
      if (window.tcSupabase) return window.tcSupabase;
      var c = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.tcSupabase = c;
      return c;
    }).catch(function (e) { _promesa = null; throw e; });
    return _promesa;
  }
  window.tcSb = sb;

  function snake(k) { return k.replace(/[A-Z]/g, function (m) { return '_' + m.toLowerCase(); }); }
  function camel(k) { return k.replace(/_([a-z0-9])/g, function (_, c) { return c.toUpperCase(); }); }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  }
  function limpiar(v) {
    // Firestore aceptaba undefined/funciones en algunos lados; JSON no.
    return v === undefined ? null : JSON.parse(JSON.stringify(v));
  }

  // ═════════════════════════ ACTIVIDADES ═════════════════════════
  var ACT_COLS = { actividad: 1, area: 1, origen: 1, docId: 1, empresa: 1, responsable: 1, encargado: 1, prioridad: 1, estatus: 1, comentarios: 1, fechaCreacion: 1, fechaInicio: 1, fechaLimite: 1, fechaFinalizacion: 1 };
  var ACT_FECHAS = { fecha_inicio: 1, fecha_limite: 1 };
  var ACT_TS = { fecha_creacion: 1, fecha_finalizacion: 1 };

  function filaAAct(row) {
    var o = {};
    if (row.extra && typeof row.extra === 'object') Object.keys(row.extra).forEach(function (k) { o[k] = row.extra[k]; });
    Object.keys(row).forEach(function (k) {
      if (k === 'extra' || k === 'id' || k === 'firestore_id' || k === 'actualizado_en') return;
      var v = row[k];
      if (v === null && o[camel(k)] !== undefined) return;
      o[camel(k)] = v;
    });
    if (!Array.isArray(o.comentarios)) o.comentarios = o.comentarios || [];
    o.id = row.firestore_id || row.id;
    o._uuid = row.id;
    return o;
  }
  function actAFila(fid, obj) {
    var fila = { firestore_id: fid, extra: {} };
    Object.keys(obj).forEach(function (k) {
      if (k === 'id' || k === '_uuid') return;
      var v = limpiar(obj[k]);
      if (ACT_COLS[k]) {
        var s = snake(k);
        if ((ACT_FECHAS[s] || ACT_TS[s]) && (v === '' || v === undefined)) v = null;
        if (ACT_FECHAS[s] && typeof v === 'string') v = v.slice(0, 10);
        fila[s] = v;
      } else {
        fila.extra[k] = v;
      }
    });
    if (fila.comentarios === undefined) fila.comentarios = [];
    return fila;
  }
  function actAPatch(cambios) {
    var p = {};
    Object.keys(cambios).forEach(function (k) {
      if (k === 'id' || k === '_uuid') return;
      p[ACT_COLS[k] ? snake(k) : k] = limpiar(cambios[k]);
    });
    return p;
  }

  var _act = {};          // firestore_id → objeto
  var _uuidAFid = {};     // uuid → firestore_id (para DELETE en tiempo real)
  var _actSubs = [];
  var _actCanal = null, _actCargado = false, _actCargando = null, _emitTimer = null;

  function actOrdenadas() {
    return Object.keys(_act).map(function (k) { return _act[k]; }).sort(function (a, b) {
      return String(b.fechaCreacion || '').localeCompare(String(a.fechaCreacion || ''));
    });
  }
  function emitir() {
    clearTimeout(_emitTimer);
    _emitTimer = setTimeout(function () {
      var lista = actOrdenadas();
      var snap = { docs: lista.map(function (o) { return { id: o.id, data: function () { return o; } }; }), size: lista.length };
      _actSubs.slice().forEach(function (cb) { try { cb(snap); } catch (e) { console.error('[tcAct] suscriptor:', e); } });
    }, 120);
  }
  function guardarEnCache(row) {
    var o = filaAAct(row);
    _act[o.id] = o;
    _uuidAFid[row.id] = o.id;
    return o;
  }
  function cargarTodo() {
    if (_actCargando) return _actCargando;
    _actCargando = sb().then(function (c) {
      var todos = [], desde = 0;
      function pagina() {
        return c.from('actividades').select('*').order('fecha_creacion', { ascending: false }).range(desde, desde + 999).then(function (r) {
          if (r.error) throw r.error;
          todos = todos.concat(r.data || []);
          if (r.data && r.data.length === 1000) { desde += 1000; return pagina(); }
        });
      }
      return pagina().then(function () {
        _act = {}; _uuidAFid = {};
        todos.forEach(guardarEnCache);
        _actCargado = true;
        return actOrdenadas();
      });
    }).finally(function () { _actCargando = null; });
    return _actCargando;
  }
  function recargarFila(uuidRow) {
    return sb().then(function (c) { return c.from('actividades').select('*').eq('id', uuidRow).maybeSingle(); })
      .then(function (r) { if (r.data) { guardarEnCache(r.data); emitir(); } });
  }
  function conectarTiempoReal() {
    if (_actCanal) return;
    sb().then(function (c) {
      _actCanal = c.channel('tc-actividades')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'actividades' }, function (p) {
          if (p.eventType === 'DELETE') {
            var fid = p.old && _uuidAFid[p.old.id];
            if (fid) { delete _act[fid]; delete _uuidAFid[p.old.id]; emitir(); }
            return;
          }
          // Se vuelve a leer la fila completa: los comentarios con adjuntos pueden
          // exceder el tamaño máximo de un evento de Realtime.
          if (p.new && p.new.id) recargarFila(p.new.id);
        })
        .subscribe(function (estado) {
          if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') console.warn('[tcAct] Realtime:', estado);
        });
    });
    // Al regresar a la pestaña, se refresca por si se perdió algún evento.
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && _actCargado) cargarTodo().then(emitir).catch(function () {});
    });
  }

  window.tcAct = {
    suscribir: function (cb) {
      _actSubs.push(cb);
      conectarTiempoReal();
      if (_actCargado) emitir();
      else cargarTodo().then(emitir).catch(function (e) {
        console.error('[tcAct] no se pudieron cargar las actividades:', e);
        if (window.mostrarPush) window.mostrarPush('Portal', 'No se pudieron cargar las actividades (Supabase). Revisa tu conexión.', '⚠️');
      });
      return function () { _actSubs = _actSubs.filter(function (x) { return x !== cb; }); };
    },
    lista: function () { return actOrdenadas().map(function (o) { return Object.assign({}, o); }); },
    cargar: function () { return _actCargado ? Promise.resolve(window.tcAct.lista()) : cargarTodo().then(function () { return window.tcAct.lista(); }); },
    obtener: function (id) {
      if (_act[id]) return Promise.resolve(Object.assign({}, _act[id]));
      return sb().then(function (c) { return c.from('actividades').select('*').eq('firestore_id', id).maybeSingle(); })
        .then(function (r) { if (r.error) throw r.error; return r.data ? guardarEnCache(r.data) : null; });
    },
    crear: function (obj) {
      var fid = uuid();
      var datos = Object.assign({}, obj);
      if (!datos.fechaCreacion) datos.fechaCreacion = datos.creadoEn || new Date().toISOString();
      var fila = actAFila(fid, datos);
      return sb().then(function (c) { return c.from('actividades').insert(fila).select().single(); })
        .then(function (r) { if (r.error) throw r.error; guardarEnCache(r.data); emitir(); return fid; });
    },
    actualizar: function (id, cambios) {
      if (_act[id]) { Object.assign(_act[id], cambios); emitir(); }
      return sb().then(function (c) { return c.rpc('actividad_patch', { fid: id, patch: actAPatch(cambios) }); })
        .then(function (r) { if (r.error) throw r.error; });
    },
    agregarComentario: function (id, comentario) {
      var com = limpiar(comentario);
      if (_act[id]) { _act[id].comentarios = (_act[id].comentarios || []).concat([com]); emitir(); }
      return sb().then(function (c) { return c.rpc('actividad_agregar_comentario', { fid: id, comentario: com }); })
        .then(function (r) { if (r.error) throw r.error; });
    },
    borrar: function (id) {
      if (_act[id]) { delete _act[id]; emitir(); }
      return sb().then(function (c) { return c.from('actividades').delete().eq('firestore_id', id); })
        .then(function (r) { if (r.error) throw r.error; });
    },
  };

  // ═════════════════════ EVENTOS DEL CALENDARIO 360 ═════════════════════
  function filaAEvento(row) {
    var o = Object.assign({}, row.extra || {});
    ['f', 'n', 't', 'p', 'a', 'r', 'fuente'].forEach(function (k) { o[k] = row[k]; });
    o.creadoPor = row.creado_por; o.creadoEn = row.creado_en;
    o.firestoreId = row.id;
    return o;
  }
  window.tcEventosCal = {
    suscribir: function (cb) {
      var cargar = function () {
        return sb().then(function (c) { return c.from('eventos_calendario').select('*'); })
          .then(function (r) { if (r.error) throw r.error; cb((r.data || []).map(filaAEvento)); })
          .catch(function (e) { console.warn('[tcEventosCal]', e.message || e); });
      };
      cargar();
      sb().then(function (c) {
        c.channel('tc-eventos-cal').on('postgres_changes', { event: '*', schema: 'public', table: 'eventos_calendario' }, function () { cargar(); }).subscribe();
      });
    },
    crear: function (obj) {
      var fila = { f: obj.f, n: obj.n, t: obj.t, p: obj.p, a: obj.a, r: obj.r, fuente: obj.fuente || 'Manual', creado_por: obj.creadoPor || null, creado_en: obj.creadoEn || new Date().toISOString() };
      return sb().then(function (c) { return c.from('eventos_calendario').insert(fila); })
        .then(function (r) { if (r.error) throw r.error; });
    },
  };

  // ═════════════════════════ NOTIFICACIONES ═════════════════════════
  // Mismo formato que se escribía en flotilla_notificaciones:
  //   { tipo, para, mensaje, vehiculoEco, leido, creadaEn, ...otros campos }
  window.tcNotificar = function (datos) {
    var d = Object.assign({}, datos || {});
    var fila = {
      tipo: d.tipo || null, para: d.para ? String(d.para).toLowerCase().trim() : null, mensaje: d.mensaje || null,
      vehiculo_eco: d.vehiculoEco || null, leido: !!d.leido, creada_en: d.creadaEn || new Date().toISOString(),
    };
    ['tipo', 'para', 'mensaje', 'vehiculoEco', 'leido', 'creadaEn'].forEach(function (k) { delete d[k]; });
    fila.datos = Object.keys(d).length ? limpiar(d) : null;
    return sb().then(function (c) { return c.from('portal_notificaciones').insert(fila); })
      .then(function (r) { if (r.error) throw r.error; });
  };
  // Oct-2026: la app de técnicos ya lee sus avisos de Supabase (portal_notificaciones,
  // vía flotilla-supabase.js), así que ya NO se escribe copia en Firestore.
  // Se conserva la firma (fs, db, datos) para no tocar a quien la llama.
  window.tcNotificar2 = function (fs, db, datos) {
    var d = Object.assign({}, datos || {});
    if (!d.creadaEn) d.creadaEn = new Date().toISOString();
    return window.tcNotificar(d);
  };
  function filaANotif(row) {
    var o = Object.assign({}, row.datos || {});
    o.tipo = row.tipo; o.para = row.para; o.mensaje = row.mensaje; o.vehiculoEco = row.vehiculo_eco;
    o.leido = row.leido; o.creadaEn = row.creada_en ? new Date(row.creada_en).toISOString() : ''; o.id = row.id;
    return o;
  }
  // ── Voz para avisos (22-oct-2026): "Operaciones programó tu servicio", material para Almacén/Compras.
  // Usa la mejor voz en español del equipo; si no hay voz en español, solo queda la ventana.
  if (!window.tcHablar) (function () {
    var cola = [];
    function sig() {
      if (!cola.length || !('speechSynthesis' in window)) return;
      if (window.speechSynthesis.speaking) { setTimeout(sig, 800); return; }
      var frase = cola.shift();
      try {
        var voces = window.speechSynthesis.getVoices().filter(function (v) { return /^es([-_]|$)/i.test(v.lang); });
        if (!voces.length) { cola = []; return; }
        var pts = function (v) { return (/natural|neural|online/i.test(v.name) ? 100 : 0) + (/google/i.test(v.name) ? 40 : 0) + (/es[-_]mx/i.test(v.lang) ? 10 : 0); };
        var v = voces.sort(function (a, b) { return pts(b) - pts(a); })[0];
        var u = new SpeechSynthesisUtterance(frase); u.voice = v; u.lang = v.lang; u.rate = 1; u.pitch = 1.05; u.volume = 0.85;
        u.onend = function () { setTimeout(sig, 300); };
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
    window.tcHablar = function (frase) {
      frase = String(frase || '').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, '').trim(); if (!frase || cola.length > 4) return;
      cola.push(frase.slice(0, 220)); setTimeout(sig, 700);
    };
    if ('speechSynthesis' in window) { try { window.speechSynthesis.getVoices(); } catch (e) {} }
  })();
  window.tcSbNotifSuscribir = function (cb) {
    var vistos = {};
    return sb().then(function (c) {
      c.channel('tc-portal-notif')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'portal_notificaciones' }, function (p) {
          if (!p.new || vistos[p.new.id]) return;
          vistos[p.new.id] = 1;
          var o = filaANotif(p.new);
          try { cb(o); } catch (e) { console.error('[tcSbNotif]', e); }
          // Aviso con voz (22-oct-2026): solo a quien va dirigido y solo si el aviso lo pide (datos.voz).
          try {
            var yo = String((window.auth && window.auth.currentUser && window.auth.currentUser.email) || '').toLowerCase();
            if (o.voz && yo && String(o.para || '').toLowerCase() === yo && window.tcHablar) window.tcHablar(typeof o.voz === 'string' ? o.voz : o.mensaje);
          } catch (e) {}
        })
        .subscribe();
    });
  };
  window.tcNotifListar = function (email, limite) {
    return sb().then(function (c) {
      var q = c.from('portal_notificaciones').select('*').order('creada_en', { ascending: false }).limit(limite || 50);
      if (email) q = q.eq('para', String(email).toLowerCase());
      return q;
    }).then(function (r) { if (r.error) throw r.error; return (r.data || []).map(filaANotif); });
  };

  // ═════════════ SESIÓN DEL PORTAL EN SUPABASE (Fase 2, oct-2026) ═════════════
  // Segundo cliente que manda la sesión real de Firebase a Supabase, para leer
  // datos confidenciales (Aspel: saldos, RFC) que la llave pública NO puede ver.
  // El cliente de siempre (tcSb) no cambia: todo lo demás sigue igual.
  // Requiere en Supabase: Authentication → Third-party Auth → Firebase (tecnocontrol-1c42f).
  var _promesaSesion = null;
  function sbSesion() {
    if (window.tcSupabaseSesion) return Promise.resolve(window.tcSupabaseSesion);
    if (_promesaSesion) return _promesaSesion;
    _promesaSesion = import('https://esm.sh/@supabase/supabase-js@2').then(function (mod) {
      if (window.tcSupabaseSesion) return window.tcSupabaseSesion;
      var c = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        accessToken: function () {
          var u = window.auth && window.auth.currentUser;
          return u ? u.getIdToken() : Promise.resolve(null);
        },
      });
      window.tcSupabaseSesion = c;
      return c;
    }).catch(function (e) { _promesaSesion = null; throw e; });
    return _promesaSesion;
  }
  window.tcSbSesion = sbSesion;

  // Lecturas de Aspel (solo para quien está en aspel_lectores).
  function aspelSel(tabla, armar) {
    return sbSesion().then(function (c) {
      var q = c.from(tabla).select('*');
      if (armar) q = armar(q);
      return q;
    }).then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  window.tcAspel = {
    // Prueba rápida desde la consola (F12):  tcAspel.diagnostico()
    diagnostico: function () {
      return sbSesion().then(function (c) { return c.rpc('aspel_quien_soy'); })
        .then(function (r) {
          if (r.error) throw r.error;
          var d = r.data || {};
          console.log('[Aspel] Supabase te reconoce como:', d.correo || '(sin sesión)', '· puede leer Aspel:', !!d.puede_leer_aspel, d);
          return d;
        });
    },
    estadoCuenta: function (clave, empresa) {
      return aspelSel('v_aspel_estado_cuenta', function (q) {
        q = q.eq('empresa', empresa || '01');
        return clave ? q.eq('clave', String(clave).trim()) : q.order('vencido', { ascending: false });
      });
    },
    facturas: function (filtros) {
      var f = filtros || {};
      return aspelSel('v_aspel_facturas', function (q) {
        q = q.eq('empresa', f.empresa || '01');
        if (f.cliente) q = q.eq('cve_clpv', String(f.cliente).trim());
        if (f.plaza) q = q.eq('plaza', f.plaza);
        if (f.estatus) q = q.eq('estatus_cobro', f.estatus);
        if (f.desde) q = q.gte('fecha_doc', f.desde);
        return q.order('fecha_doc', { ascending: false }).limit(f.limite || 200);
      });
    },
    documento: function (tipDoc, cveDoc, empresa) {
      return aspelSel('aspel_documentos', function (q) {
        return q.eq('empresa', empresa || '01').eq('tip_doc', tipDoc).eq('cve_doc', String(cveDoc).trim());
      }).then(function (l) { return l[0] || null; });
    },
    calidadClientes: function (empresa) {
      return aspelSel('v_aspel_calidad_clientes', function (q) { return q.eq('empresa', empresa || '01').order('nombre'); })
        .then(function (l) { return l.filter(function (x) { return (x.problemas || []).length; }); });
    },
    estadoSincronizacion: function () {
      return aspelSel('aspel_sync_estado', function (q) { return q.order('tabla'); });
    },
  };

  // ═════════════ MATRIZ DE NOTIFICACIONES (Fase 1, oct-2026) ═════════════
  // Quién recibe qué vive en Supabase (notif_preferencias, notif_tipos,
  // notif_matriz) y se edita desde el panel de notif-matriz.js.
  // El filtro "duro" de los avisos dirigidos a una persona lo hace la base
  // (trigger trg_notif_filtrar); aquí se filtra lo que el portal muestra a
  // los administradores que "ven todo".
  var _nPref = {}, _nTipos = [], _nMatriz = {}, _nCarga = null;

  function nPatronARegex(patron) {
    var s = String(patron || ''), r = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i);
      if (ch === '%') r += '.*';
      else if (ch === '_') r += '.';
      else if (/[A-Za-z0-9]/.test(ch)) r += ch;
      else r += '\\' + ch;
    }
    return new RegExp('^' + r + '$');
  }
  function nOrdenTipos(a, b) {
    var ca = a.patron.indexOf('%') >= 0, cb = b.patron.indexOf('%') >= 0;
    if (ca !== cb) return ca ? 1 : -1;            // exactos primero
    return b.patron.length - a.patron.length;     // luego el patrón más largo
  }
  function nTipo(tipo) {
    var t = String(tipo || '');
    for (var i = 0; i < _nTipos.length; i++) { if (_nTipos[i]._re.test(t)) return _nTipos[i]; }
    return null;
  }
  function nCargar() {
    _nCarga = sb().then(function (c) {
      return Promise.all([
        c.from('notif_preferencias').select('*').eq('activo', true),
        c.from('notif_tipos').select('*'),
        c.from('notif_matriz').select('*'),
      ]);
    }).then(function (rs) {
      var err = rs[0].error || rs[1].error || rs[2].error;
      if (err) throw err;
      var p = {};
      (rs[0].data || []).forEach(function (r) { p[String(r.correo || '').toLowerCase().trim()] = r; });
      var t = (rs[1].data || []).map(function (r) { r._re = nPatronARegex(r.patron); return r; }).sort(nOrdenTipos);
      var m = {};
      (rs[2].data || []).forEach(function (r) { m[r.evento] = r; });
      _nPref = p; _nTipos = t; _nMatriz = m;
      return true;
    }).catch(function (e) {
      console.warn('[notif matriz] no se pudo leer la configuración — se entregan todos los avisos como antes:', e.message || e);
      _nCarga = null;
      return false;
    });
    return _nCarga;
  }
  window.tcNotifRecargar = nCargar;
  window.tcNotifConfig = function () {
    return { preferencias: Object.assign({}, _nPref), tipos: _nTipos.slice(), matriz: Object.assign({}, _nMatriz) };
  };

  // Módulo de un aviso: el que trae el propio aviso, si no por su tipo.
  window.tcNotifModulo = function (aviso) {
    var a = aviso || {};
    if (a.modulo) return a.modulo;
    var t = nTipo(a.tipo);
    return t ? t.modulo : 'Sin clasificar';
  };

  // ¿Esta persona debe ver este aviso? Sin preferencia guardada = sí (como hoy).
  window.tcNotifPermitida = function (correo, info) {
    var pref = _nPref[String(correo || '').toLowerCase().trim()];
    if (!pref || pref.modo !== 'solo') return true;
    var i = info || {};
    if (i.personal && pref.incluir_personales) return true;
    if (i.tipo && pref.incluir_acciones) { var t = nTipo(i.tipo); if (t && t.requiere_accion) return true; }
    // Avisos especiales a los que la persona está suscrita con su correo: le llegan aunque no sean de sus módulos.
    if (i.tipo && _nMatriz[i.tipo] && (_nMatriz[i.tipo].destinatarios || []).map(function (x) { return String(x).toLowerCase(); }).indexOf(String(correo || '').toLowerCase().trim()) >= 0) return true;
    return (pref.modulos || []).indexOf(i.modulo || 'Sin clasificar') >= 0;
  };

  // Avisa a todos los destinatarios de un evento de la matriz.
  // Uso: tcNotificarEvento('listo_para_facturar', { mensaje: '…', folio: 'CHH123' })
  // Devuelve cuántos avisos se enviaron.
  window.tcNotificarEvento = function (evento, datos) {
    return (_nCarga || nCargar()).then(function () {
      var ev = _nMatriz[evento];
      if (!ev || !ev.activo) { console.warn('[notif matriz] evento sin destinatarios o apagado:', evento); return 0; }
      var vistos = {}, dest = [];
      (ev.destinatarios || []).forEach(function (x) {
        var e = String(x || '').toLowerCase().trim();
        if (e && !vistos[e]) { vistos[e] = 1; dest.push(e); }
      });
      var d = datos || {};
      return Promise.all(dest.map(function (para) {
        return window.tcNotificar(Object.assign({}, d, {
          tipo: d.tipo || evento, para: para, modulo: d.modulo || ev.modulo, evento: evento,
        })).then(function () { return 1; }, function (e) {
          console.warn('[notif matriz] aviso a ' + para + ' falló:', e.message || e); return 0;
        });
      })).then(function (r) { return r.reduce(function (a, b) { return a + b; }, 0); });
    });
  };

  nCargar();
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') nCargar();
  });

  // ═════════════════ MIGRACIÓN ÚNICA Firestore → Supabase ═════════════════
  // Correr UNA vez desde la consola (F12), con sesión de administrador y con
  // la cuota de Firestore ya reiniciada:   tcMigrarPaso1()
  window.tcMigrarPaso1 = async function () {
    var fsMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    var appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    var db = window.db || fsMod.getFirestore(appMod.getApps()[0]);
    var c = await sb();
    var res = { actividades: 0, eventos: 0, errores: [] };

    console.log('[Paso 1] Leyendo actividades de Firestore…');
    var snap = await fsMod.getDocs(fsMod.collection(db, 'actividades'));
    var filas = snap.docs.map(function (d) {
      var o = d.data();
      if (!o.fechaCreacion) o.fechaCreacion = o.creadoEn || null;
      return actAFila(d.id, o);
    });
    for (var i = 0; i < filas.length; i += 200) {
      var r = await c.from('actividades').upsert(filas.slice(i, i + 200), { onConflict: 'firestore_id' });
      if (r.error) res.errores.push('actividades ' + i + ': ' + r.error.message); else res.actividades += Math.min(200, filas.length - i);
    }

    console.log('[Paso 1] Leyendo eventos_calendario de Firestore…');
    var snapE = await fsMod.getDocs(fsMod.collection(db, 'eventos_calendario'));
    var filasE = snapE.docs.map(function (d) {
      var o = d.data(), extra = {};
      Object.keys(o).forEach(function (k) { if (['f', 'n', 't', 'p', 'a', 'r', 'fuente', 'creadoPor', 'creadoEn'].indexOf(k) < 0) extra[k] = o[k]; });
      return { id: d.id, f: o.f || null, n: o.n || null, t: o.t || null, p: o.p || null, a: o.a || null, r: o.r || null, fuente: o.fuente || 'Manual', creado_por: o.creadoPor || null, creado_en: o.creadoEn || null, extra: Object.keys(extra).length ? limpiar(extra) : null };
    });
    if (filasE.length) {
      var rE = await c.from('eventos_calendario').upsert(filasE, { onConflict: 'id' });
      if (rE.error) res.errores.push('eventos: ' + rE.error.message); else res.eventos = filasE.length;
    }
    console.log('[Paso 1] Resultado:', res);
    await cargarTodo(); emitir();
    alert('Migración Paso 1 terminada:\n' + res.actividades + ' actividades\n' + res.eventos + ' eventos del calendario' + (res.errores.length ? '\n\nErrores:\n' + res.errores.join('\n') : ''));
    return res;
  };
})();
