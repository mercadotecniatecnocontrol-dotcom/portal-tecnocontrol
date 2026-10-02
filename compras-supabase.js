// ═══════════════════════════════════════════════════════════════════════
//  compras-supabase.js — Portal Operativo Tecnocontrol  (oct-2026)
// ═══════════════════════════════════════════════════════════════════════
//  Saca Compras de Firestore. Expone un "puente" con LA MISMA FORMA que la
//  librería modular de Firestore (collection, doc, getDocs, onSnapshot,
//  updateDoc, arrayUnion…), así compras.js, firmar.html, el kiosco
//  (requisicion-compra.html) y Flotilla móvil casi no cambian: solo piden
//  sus funciones a este puente en lugar de a Firestore.
//
//  Va a Supabase (tablas compras_*):
//    requisiciones_compra (+ fotos, cotizaciones) · solicitudes_cotizacion
//    (+ fotos, adjuntos) · proveedores · config_flujo_compras · presupuestos
//    · presupuestos_historial
//  Sigue en Firestore (se pasa tal cual a la librería original):
//    colaboradores, config_organigrama, empresas_requisicion,
//    pagos_cuentas_por_pagar, flotilla_notificaciones, ventas_clientes, …
//
//  Precios y montos viven en tablas *_comercial aparte (ver compras_supabase.sql);
//  el puente las une al leer y las separa al escribir.
//
//  API global:
//    window.tcComprasFS(moduloFirestore|null) → Promise<puente>
//    window.tcCpSiguienteFolio('RC'|'RCC'|'SC') → Promise<'RC-0081'>
//    window.tcCpNotificar(datos)              → aviso en portal_notificaciones
//    window.tcCpClientesNombres()             → nombres de ventas_clientes
//    window.tcMigrarCompras({sobrescribir})   → copia única Firestore → Supabase
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.tcComprasFS) return;

  var SUPABASE_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
  var _cli = null;
  function sb() {
    if (window.tcSupabase) return Promise.resolve(window.tcSupabase);
    if (_cli) return _cli;
    _cli = import('https://esm.sh/@supabase/supabase-js@2').then(function (mod) {
      if (!window.tcSupabase) window.tcSupabase = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.tcSupabase;
    }).catch(function (e) { _cli = null; throw e; });
    return _cli;
  }

  // ── Qué colección va a qué tabla ──────────────────────────────────────
  var CONF = {
    'requisiciones_compra': {
      tabla: 'compras_requisiciones',
      cols: { folio: 'folio', folioNum: 'folio_num', folioPrefijo: 'folio_prefijo', estatus: 'estatus', empresa: 'empresa',
        solicitante: 'solicitante', solicitanteEmail: 'solicitante_email', departamento: 'departamento', origen: 'origen',
        urgencia: 'urgencia', tipoCompra: 'tipo_compra', motivo: 'motivo', cliente: 'cliente', razonSocial: 'razon_social',
        ciudad: 'ciudad', estacionId: 'estacion_id', estacionNombre: 'estacion_nombre', direccion: 'direccion', lat: 'lat', lng: 'lng',
        vehiculoEco: 'vehiculo_eco', firma: 'firma', items: 'items', flujoAutorizacion: 'flujo_autorizacion', comentarios: 'comentarios',
        bitacora: 'bitacora', autorizacionDirecta: 'autorizacion_directa', envio: 'envio', recepcion: 'recepcion', cotizacionSC: 'cotizacion_sc',
        ocFolio: 'oc_folio', motivoRechazo: 'motivo_rechazo', createdAt: 'created_at', ordenGeneradaEn: 'orden_generada_en',
        recibidaEn: 'recibida_en', rechazadaEn: 'rechazada_en' },
      tipos: { folio_num: 'int', lat: 'num', lng: 'num', created_at: 'ts', orden_generada_en: 'ts', recibida_en: 'ts', rechazada_en: 'ts',
        items: 'json', flujo_autorizacion: 'json', comentarios: 'json', bitacora: 'json', autorizacion_directa: 'json', envio: 'json',
        recepcion: 'json', cotizacion_sc: 'json' },
      noNulos: { items: [], flujo_autorizacion: [], comentarios: [], bitacora: [], estatus: 'pendiente', created_at: 'ahora' },
      agregar: { comentarios: 'req', bitacora: 'req' },
      comercial: { tabla: 'compras_requisiciones_comercial', fk: 'requisicion_id',
        cols: { cotizacionGanadora: 'cotizacion_ganadora', cotizacionPropuesta: 'cotizacion_propuesta', montoEstimado: 'monto_estimado' },
        tipos: { cotizacion_ganadora: 'json', cotizacion_propuesta: 'json', monto_estimado: 'num' } },
    },
    'requisiciones_compra/*/fotos': {
      tabla: 'compras_requisicion_fotos', fk: 'requisicion_id',
      cols: { src: 'src', origen: 'origen', autor: 'autor', autorEmail: 'autor_email', creadoEn: 'creado_en', fecha: 'creado_en' },
      tipos: { creado_en: 'ts' }, noNulos: { src: '', creado_en: 'ahora' },
    },
    'requisiciones_compra/*/cotizaciones': {
      tabla: 'compras_requisicion_cotizaciones', fk: 'requisicion_id',
      cols: { proveedor: 'proveedor', monto: 'monto', archivoBase64: 'archivo_base64', desdeSC: 'desde_sc', porUid: 'por_uid', creadaEn: 'creada_en' },
      tipos: { monto: 'num', creada_en: 'ts' }, noNulos: { creada_en: 'ahora' },
    },
    'solicitudes_cotizacion': {
      tabla: 'compras_solicitudes',
      cols: { folio: 'folio', estatus: 'estatus', origen: 'origen', departamento: 'departamento', empresa: 'empresa', tipoCompra: 'tipo_compra',
        cliente: 'cliente', fechaRequerida: 'fecha_requerida', urgencia: 'urgencia', urgenciaMotivo: 'urgencia_motivo', notas: 'notas',
        partidas: 'partidas', solicitante: 'solicitante', requisicionId: 'requisicion_id', requisicionFolio: 'requisicion_folio',
        motivoCancelacion: 'motivo_cancelacion', historial: 'historial', numFotos: 'num_fotos', createdAt: 'created_at' },
      tipos: { fecha_requerida: 'date', partidas: 'json', solicitante: 'json', historial: 'json', num_fotos: 'int', created_at: 'ts' },
      noNulos: { partidas: [], historial: [], num_fotos: 0, estatus: 'nueva', created_at: 'ahora' },
      agregar: { historial: 'sol' },
      comercial: { tabla: 'compras_solicitudes_comercial', fk: 'solicitud_id',
        cols: { proveedoresInvitados: 'proveedores_invitados', respuestas: 'respuestas', compartidas: 'compartidas', mostrarProveedor: 'mostrar_proveedor',
          notaCompras: 'nota_compras', elegidaId: 'elegida_id', recordatorio: 'recordatorio', fechaLimiteRespuesta: 'fecha_limite_respuesta' },
        tipos: { proveedores_invitados: 'json', respuestas: 'json', compartidas: 'json', mostrar_proveedor: 'bool', recordatorio: 'json', fecha_limite_respuesta: 'date' },
        noNulos: { proveedores_invitados: [], respuestas: [], compartidas: [], mostrar_proveedor: false } },
    },
    'solicitudes_cotizacion/*/fotos': {
      tabla: 'compras_solicitud_archivos', fk: 'solicitud_id', fijo: { tipo: 'foto' },
      cols: { src: 'data', origen: 'origen', subidaPor: 'subido_por', fecha: 'creado_en' },
      tipos: { creado_en: 'ts' }, noNulos: { data: '', creado_en: 'ahora' },
    },
    'solicitudes_cotizacion/*/adjuntos': {
      tabla: 'compras_solicitud_archivos', fk: 'solicitud_id', fijo: { tipo: 'adjunto' },
      cols: { data: 'data', nombre: 'nombre', tipo: 'mime', subidoPor: 'subido_por', fecha: 'creado_en' },
      tipos: { creado_en: 'ts' }, noNulos: { data: '', creado_en: 'ahora' },
    },
    'proveedores': {
      tabla: 'compras_proveedores',
      cols: { nombre: 'nombre', categoria: 'categoria', contacto: 'contacto', telefono: 'telefono', correo: 'correo', calificacion: 'calificacion', creadoEn: 'creado_en' },
      tipos: { calificacion: 'num', creado_en: 'ts' }, noNulos: { nombre: '', creado_en: 'ahora' },
    },
    'config_flujo_compras': { tabla: 'compras_config', pk: 'clave', blob: 'valor' },
    'presupuestos': { tabla: 'compras_presupuestos', pk: 'departamento', blob: 'datos' },
    'presupuestos_historial': { tabla: 'compras_presupuestos_historial', blob: 'datos', cols: { fecha: 'fecha' }, tipos: { fecha: 'ts' }, noNulos: { fecha: 'ahora' } },
  };
  function patronDe(segs) { return segs.map(function (s, i) { return i % 2 === 1 ? '*' : s; }).join('/'); }

  // ── Utilidades de datos ───────────────────────────────────────────────
  var TS = { __sbTs: true };
  function esTs(v) { return v && v.__sbTs === true; }
  function esUnion(v) { return v && Array.isArray(v.__sbU); }
  function esFsTsCompat(v) { // FieldValue.serverTimestamp() de la librería compat (Flotilla)
    return v && typeof v === 'object' && (v._methodName === 'FieldValue.serverTimestamp' || v._methodName === 'serverTimestamp');
  }
  function esPlano(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    var pr = Object.getPrototypeOf(v);
    return pr === null || (pr.constructor && pr.constructor.name === 'Object');
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  }
  // Convierte cualquier valor a algo que JSON/Postgres acepte.
  function limpiar(v) {
    if (v === undefined || typeof v === 'function') return undefined;
    if (v === null) return null;
    if (esTs(v) || esFsTsCompat(v)) return new Date().toISOString();
    if (esUnion(v)) return v.__sbU.map(limpiar);
    if (v instanceof Date) return isNaN(v) ? null : v.toISOString();
    if (typeof v === 'object' && typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return null; } }
    if (typeof v === 'object' && typeof v.seconds === 'number' && typeof v.nanoseconds === 'number' && Object.keys(v).length <= 2) return new Date(v.seconds * 1000).toISOString();
    if (Array.isArray(v)) return v.map(function (x) { var y = limpiar(x); return y === undefined ? null : y; });
    if (typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { var y = limpiar(v[k]); if (y !== undefined) o[k] = y; }); return o; }
    if (typeof v === 'number' && !isFinite(v)) return null;
    return v;
  }
  var INVALIDO = { invalido: true };
  function coercer(tipo, v) {
    if (v === null || v === undefined) return null;
    switch (tipo) {
      case 'ts': { if (v === '') return null; var d = new Date(v); return isNaN(d) ? INVALIDO : d.toISOString(); }
      case 'date': { if (v === '') return null; var s = String(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : INVALIDO; }
      case 'int': { var n = Number(v); return isFinite(n) && v !== '' ? Math.round(n) : (v === '' ? null : INVALIDO); }
      case 'num': { var m = Number(v); return isFinite(m) && v !== '' ? m : (v === '' ? null : INVALIDO); }
      case 'bool': return !!v;
      case 'json': return v;
      default: return (typeof v === 'object') ? INVALIDO : String(v);
    }
  }
  // objeto (forma Firestore) → fila(s)
  function aFila(conf, obj, completo) {
    var datos = limpiar(obj) || {};
    if (conf.blob) {
      var rb = {}; rb[conf.blob] = datos;
      Object.keys(conf.cols || {}).forEach(function (k) {
        var col = conf.cols[k], c = coercer((conf.tipos || {})[col], datos[k]);
        if (c !== INVALIDO && c !== null) rb[col] = c;
      });
      if (completo) aplicarNoNulos(conf, rb);
      return { fila: rb, com: null };
    }
    var fila = { extra: {} }, com = conf.comercial ? {} : null, hayCom = false;
    Object.keys(datos).forEach(function (k) {
      var v = datos[k];
      if (com && conf.comercial.cols[k]) {
        var cc = conf.comercial.cols[k], x = coercer((conf.comercial.tipos || {})[cc], v);
        com[cc] = x === INVALIDO ? null : x; hayCom = true; return;
      }
      var col = (conf.cols || {})[k];
      if (col) {
        var y = coercer((conf.tipos || {})[col], v);
        if (y === INVALIDO) fila.extra[k] = v; else fila[col] = y;
        return;
      }
      fila.extra[k] = v;
    });
    if (completo) aplicarNoNulos(conf, fila);
    if (com && completo && conf.comercial.noNulos) Object.keys(conf.comercial.noNulos).forEach(function (c) { if (com[c] === null || com[c] === undefined) com[c] = conf.comercial.noNulos[c]; });
    return { fila: fila, com: hayCom ? com : null };
  }
  function aplicarNoNulos(conf, fila) {
    var nn = conf.noNulos || {};
    Object.keys(nn).forEach(function (c) {
      if (fila[c] === null || fila[c] === undefined) fila[c] = nn[c] === 'ahora' ? new Date().toISOString() : JSON.parse(JSON.stringify(nn[c]));
    });
  }
  // fila(s) → objeto (forma Firestore)
  function deFila(conf, fila, com) {
    if (!fila) return null;
    if (conf.blob) return Object.assign({}, fila[conf.blob] || {});
    var o = Object.assign({}, fila.extra && typeof fila.extra === 'object' ? fila.extra : {});
    Object.keys(conf.cols || {}).forEach(function (k) { var v = fila[conf.cols[k]]; if (v !== null && v !== undefined) o[k] = v; });
    if (com && conf.comercial) Object.keys(conf.comercial.cols).forEach(function (k) { var v = com[conf.comercial.cols[k]]; if (v !== null && v !== undefined) o[k] = v; });
    return o;
  }
  function pkDe(conf) { return conf.pk || 'id'; }
  function colFiltro(conf, campo) {
    if (campo === '__name__' || campo === 'id') return pkDe(conf);
    if (conf.cols && conf.cols[campo]) return conf.cols[campo];
    return (conf.blob || 'extra') + '->>' + campo;
  }
  function err(r) { if (r && r.error) { var e = new Error(r.error.message || 'Error de Supabase'); e.code = r.error.code; e.details = r.error.details; throw e; } return r; }

  // ── Referencias ───────────────────────────────────────────────────────
  function refCol(segs) {
    var conf = CONF[patronDe(segs)];
    return { __sb: true, tipo: 'col', segs: segs, path: segs.join('/'), id: segs[segs.length - 1], conf: conf, padre: segs.length > 1 ? segs[segs.length - 2] : null };
  }
  function refDoc(segs) {
    var c = refCol(segs.slice(0, -1));
    return { __sb: true, tipo: 'doc', segs: segs, path: segs.join('/'), id: segs[segs.length - 1], conf: c.conf, padre: c.padre, col: c };
  }

  // ── Lecturas ──────────────────────────────────────────────────────────
  function base(c, colRef) {
    var q = c.from(colRef.conf.tabla).select('*');
    if (colRef.conf.fk) q = q.eq(colRef.conf.fk, colRef.padre);
    if (colRef.conf.fijo) Object.keys(colRef.conf.fijo).forEach(function (k) { q = q.eq(k, colRef.conf.fijo[k]); });
    return q;
  }
  function aplicarFiltros(q, conf, cons) {
    (cons || []).forEach(function (k) {
      if (k.__c !== 'where') return;
      var col = colFiltro(conf, k.f), v = k.v;
      if (conf.comercial && conf.comercial.cols[k.f]) return; // se filtra después, en memoria
      if (k.op === '==') q = q.eq(col, v);
      else if (k.op === '!=') q = q.neq(col, v);
      else if (k.op === 'in') q = q.in(col, v);
      else if (k.op === 'not-in') q = q.not(col, 'in', '(' + v.map(function (x) { return '"' + String(x).replace(/"/g, '') + '"'; }).join(',') + ')');
      else if (k.op === '<') q = q.lt(col, v);
      else if (k.op === '<=') q = q.lte(col, v);
      else if (k.op === '>') q = q.gt(col, v);
      else if (k.op === '>=') q = q.gte(col, v);
      else if (k.op === 'array-contains') q = q.contains(col, [v]);
    });
    return q;
  }
  function cumple(obj, cons) {
    return (cons || []).every(function (k) {
      if (k.__c !== 'where') return true;
      var v = k.f === '__name__' ? obj.__id : obj[k.f];
      switch (k.op) {
        case '==': return v === k.v; case '!=': return v !== k.v;
        case 'in': return k.v.indexOf(v) > -1; case 'not-in': return k.v.indexOf(v) === -1;
        case '<': return v < k.v; case '<=': return v <= k.v; case '>': return v > k.v; case '>=': return v >= k.v;
        case 'array-contains': return Array.isArray(v) && v.indexOf(k.v) > -1;
      }
      return true;
    });
  }
  function traerComercial(c, conf, ids) {
    if (!conf.comercial || !ids.length) return Promise.resolve({});
    var mapa = {}, trozos = [];
    for (var i = 0; i < ids.length; i += 150) trozos.push(ids.slice(i, i + 150));
    return Promise.all(trozos.map(function (t) {
      return c.from(conf.comercial.tabla).select('*').in(conf.comercial.fk, t).then(err).then(function (r) {
        (r.data || []).forEach(function (row) { mapa[row[conf.comercial.fk]] = row; });
      });
    })).then(function () { return mapa; });
  }
  function leerFilas(colRef, cons) {
    var conf = colRef.conf;
    return sb().then(function (c) {
      var ords = (cons || []).filter(function (k) { return k.__c === 'orderBy'; });
      var lim = (cons || []).filter(function (k) { return k.__c === 'limit'; }).map(function (k) { return k.n; })[0];
      function armar() {
        var q = aplicarFiltros(base(c, colRef), conf, cons);
        ords.forEach(function (o) { q = q.order(colFiltro(conf, o.f), { ascending: o.dir !== 'desc' }); });
        if (!ords.length) q = q.order(pkDe(conf), { ascending: true });
        return q;
      }
      var filas = [];
      function pagina(desde) {
        var q = armar();
        q = lim ? q.limit(lim) : q.range(desde, desde + 999);
        return q.then(err).then(function (r) {
          filas = filas.concat(r.data || []);
          if (!lim && r.data && r.data.length === 1000) return pagina(desde + 1000);
        });
      }
      return pagina(0).then(function () {
        var pk = pkDe(conf);
        return traerComercial(c, conf, filas.map(function (f) { return f[pk]; })).then(function (com) {
          return filas.map(function (f) { var o = deFila(conf, f, com[f[pk]]); return { id: f[pk], obj: o }; })
            .filter(function (x) { x.obj.__id = x.id; var ok = cumple(x.obj, cons); delete x.obj.__id; return ok; });
        });
      });
    });
  }
  function leerUno(docRef) {
    var conf = docRef.conf;
    return sb().then(function (c) {
      return c.from(conf.tabla).select('*').eq(pkDe(conf), docRef.id).maybeSingle().then(err).then(function (r) {
        if (!r.data) return null;
        if (!conf.comercial) return { fila: r.data, obj: deFila(conf, r.data, null) };
        return c.from(conf.comercial.tabla).select('*').eq(conf.comercial.fk, docRef.id).maybeSingle().then(err).then(function (rc) {
          return { fila: r.data, com: rc.data, obj: deFila(conf, r.data, rc.data) };
        });
      });
    });
  }
  function docSnap(ref, obj) {
    return { id: ref.id, ref: ref, exists: function () { return !!obj; }, data: function () { return obj ? JSON.parse(JSON.stringify(obj)) : undefined; }, get: function (k) { return obj ? obj[k] : undefined; }, metadata: { fromCache: false, hasPendingWrites: false } };
  }
  function querySnap(colRef, lista, cambios) {
    var ds = lista.map(function (x) { return docSnap(refDoc(colRef.segs.concat([x.id])), x.obj); });
    return {
      docs: ds, size: ds.length, empty: ds.length === 0, metadata: { fromCache: false, hasPendingWrites: false },
      forEach: function (fn) { ds.forEach(fn); },
      docChanges: function () { return cambios || ds.map(function (d) { return { type: 'added', doc: d }; }); },
    };
  }

  // ── Escrituras ────────────────────────────────────────────────────────
  function rpcAgregar(c, conf, id, campo, items) {
    var tipo = conf.agregar[campo];
    return items.reduce(function (p, it) {
      return p.then(function () {
        var item = limpiar(it);
        return (tipo === 'req'
          ? c.rpc('compras_req_agregar', { p_id: id, p_campo: campo, p_item: item })
          : c.rpc('compras_sol_agregar_historial', { p_id: id, p_item: item })).then(err);
      });
    }, Promise.resolve());
  }
  function guardarComercial(c, conf, id, com) {
    if (!com || !conf.comercial) return Promise.resolve();
    var fila = Object.assign({}, com); fila[conf.comercial.fk] = id;
    return c.from(conf.comercial.tabla).upsert(fila, { onConflict: conf.comercial.fk }).then(err);
  }
  function addDocSb(colRef, datos) {
    var conf = colRef.conf, id = uuid();
    return sb().then(function (c) {
      var r = aFila(conf, datos, true), fila = r.fila;
      fila[pkDe(conf)] = id;
      if (conf.fk) fila[conf.fk] = colRef.padre;
      if (conf.fijo) Object.assign(fila, conf.fijo);
      return c.from(conf.tabla).insert(fila).then(err).then(function () { return guardarComercial(c, conf, id, r.com); })
        .then(function () { return refDoc(colRef.segs.concat([id])); });
    });
  }
  function setDocSb(docRef, datos, opts) {
    var conf = docRef.conf;
    if (opts && opts.merge) {
      return leerUno(docRef).then(function (act) {
        if (!act) return setDocSb(docRef, datos, null);
        return updateDocSb(docRef, datos);
      });
    }
    return sb().then(function (c) {
      var r = aFila(conf, datos, true), fila = r.fila;
      fila[pkDe(conf)] = docRef.id;
      if (conf.fk) fila[conf.fk] = docRef.padre;
      if (conf.fijo) Object.assign(fila, conf.fijo);
      return c.from(conf.tabla).upsert(fila, { onConflict: pkDe(conf) }).then(err).then(function () { return guardarComercial(c, conf, docRef.id, r.com); });
    });
  }
  function ponerRuta(obj, ruta, valor) {
    var partes = ruta.split('.'), o = obj;
    for (var i = 0; i < partes.length - 1; i++) { if (!o[partes[i]] || typeof o[partes[i]] !== 'object') o[partes[i]] = {}; o = o[partes[i]]; }
    o[partes[partes.length - 1]] = valor;
  }
  function updateDocSb(docRef, cambios) {
    var conf = docRef.conf, pk = pkDe(conf);
    var agregados = [], directos = {}, ocupaActual = !!conf.blob;
    Object.keys(cambios || {}).forEach(function (k) {
      var v = cambios[k];
      if (v === undefined) return;
      if (esUnion(v) && conf.agregar && conf.agregar[k]) { agregados.push([k, v.__sbU]); return; }
      if (esUnion(v) || k.indexOf('.') > -1) ocupaActual = true;
      else if (!conf.blob && !(conf.cols && conf.cols[k]) && !(conf.comercial && conf.comercial.cols[k])) ocupaActual = true; // cae en "extra"
      directos[k] = v;
    });
    return sb().then(function (c) {
      var paso = ocupaActual ? leerUno(docRef) : Promise.resolve(null);
      return paso.then(function (act) {
        if (ocupaActual && !act) { var e = new Error('No existe el documento ' + docRef.path); e.code = 'not-found'; throw e; }
        var actual = act ? act.obj : {};
        var nuevos = {};
        Object.keys(directos).forEach(function (k) {
          var v = directos[k];
          if (k.indexOf('.') > -1) {
            var top = k.split('.')[0];
            if (!(top in nuevos)) nuevos[top] = JSON.parse(JSON.stringify(actual[top] || {}));
            ponerRuta(nuevos, k, limpiar(v));
          } else if (esUnion(v)) {
            var previo = Array.isArray(actual[k]) ? actual[k].slice() : [];
            var vistos = previo.map(function (x) { return JSON.stringify(x); });
            limpiar(v).forEach(function (x) { if (vistos.indexOf(JSON.stringify(x)) === -1) previo.push(x); });
            nuevos[k] = previo;
          } else nuevos[k] = v;
        });
        var escrituras = Promise.resolve();
        if (Object.keys(nuevos).length) {
          var r;
          if (conf.blob) { r = aFila(conf, Object.assign({}, actual, limpiar(nuevos)), true); }
          else {
            r = aFila(conf, nuevos, false);
            if (Object.keys(r.fila.extra).length) r.fila.extra = Object.assign({}, (act && act.fila && act.fila.extra) || {}, r.fila.extra);
            else delete r.fila.extra;
          }
          var fila = r.fila;
          if (Object.keys(fila).length) escrituras = escrituras.then(function () { return c.from(conf.tabla).update(fila).eq(pk, docRef.id).then(err); });
          if (r.com) escrituras = escrituras.then(function () { return guardarComercial(c, conf, docRef.id, r.com); });
        }
        agregados.forEach(function (a) { escrituras = escrituras.then(function () { return rpcAgregar(c, conf, docRef.id, a[0], a[1]); }); });
        return escrituras;
      });
    });
  }
  function deleteDocSb(docRef) {
    return sb().then(function (c) { return c.from(docRef.conf.tabla).delete().eq(pkDe(docRef.conf), docRef.id).then(err); });
  }

  // ── Tiempo real (equivalente a onSnapshot de una consulta) ────────────
  var _canalN = 0;
  function onSnapshotSb(q, alCambio, alError) {
    var colRef = q.tipo === 'query' ? q.col : q, cons = q.tipo === 'query' ? q.cons : [], conf = colRef.conf;
    var estado = {}, vivo = true, canal = null, cliente = null, pendientes = {}, ocultoDesde = 0;
    function emitir(cambios) {
      var lista = Object.keys(estado).map(function (id) { return { id: id, obj: estado[id] }; });
      try { alCambio(querySnap(colRef, lista, cambios)); } catch (e) { console.error('[compras-supabase] suscriptor:', e); }
    }
    function recargarTodo(inicial) {
      return leerFilas(colRef, cons).then(function (lista) {
        if (!vivo) return;
        var cambios = [], nuevos = {};
        lista.forEach(function (x) {
          nuevos[x.id] = x.obj;
          if (!estado[x.id]) cambios.push({ type: 'added', doc: docSnap(refDoc(colRef.segs.concat([x.id])), x.obj) });
          else if (JSON.stringify(estado[x.id]) !== JSON.stringify(x.obj)) cambios.push({ type: 'modified', doc: docSnap(refDoc(colRef.segs.concat([x.id])), x.obj) });
        });
        Object.keys(estado).forEach(function (id) { if (!nuevos[id]) cambios.push({ type: 'removed', doc: docSnap(refDoc(colRef.segs.concat([id])), estado[id]) }); });
        estado = nuevos;
        if (inicial || cambios.length) emitir(cambios);
      });
    }
    function refrescarUno(id) {
      if (pendientes[id]) return;
      pendientes[id] = setTimeout(function () {
        delete pendientes[id];
        var ref = refDoc(colRef.segs.concat([id]));
        leerUno(ref).then(function (act) {
          if (!vivo) return;
          var obj = act ? act.obj : null;
          if (obj) { obj.__id = id; var ok = cumple(obj, cons); delete obj.__id; if (!ok) obj = null; }
          if (obj) {
            var tipo = estado[id] ? 'modified' : 'added';
            if (tipo === 'modified' && JSON.stringify(estado[id]) === JSON.stringify(obj)) return;
            estado[id] = obj; emitir([{ type: tipo, doc: docSnap(ref, obj) }]);
          } else if (estado[id]) {
            var viejo = estado[id]; delete estado[id];
            emitir([{ type: 'removed', doc: docSnap(ref, viejo) }]);
          }
        }).catch(function (e) { console.warn('[compras-supabase] refrescar', id, e.message); });
      }, 150);
    }
    function alVisible() {
      if (document.visibilityState === 'hidden') { ocultoDesde = Date.now(); return; }
      if (ocultoDesde && Date.now() - ocultoDesde > 60000) recargarTodo(false).catch(function () {});
      ocultoDesde = 0;
    }
    recargarTodo(true).catch(function (e) { if (alError) alError(e); else console.error(e); });
    sb().then(function (c) {
      if (!vivo) return;
      cliente = c;
      var pk = pkDe(conf);
      canal = c.channel('tccp-' + conf.tabla + '-' + (++_canalN) + '-' + Date.now());
      canal.on('postgres_changes', { event: '*', schema: 'public', table: conf.tabla }, function (p) {
        var row = (p.new && Object.keys(p.new).length) ? p.new : p.old;
        var id = row && row[pk]; if (id) refrescarUno(id);
      });
      if (conf.comercial) canal.on('postgres_changes', { event: '*', schema: 'public', table: conf.comercial.tabla }, function (p) {
        var row = (p.new && Object.keys(p.new).length) ? p.new : p.old;
        var id = row && row[conf.comercial.fk]; if (id) refrescarUno(id);
      });
      canal.subscribe(function (st) { if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') console.warn('[compras-supabase] tiempo real:', st); });
    });
    document.addEventListener('visibilitychange', alVisible);
    return function () {
      vivo = false;
      document.removeEventListener('visibilitychange', alVisible);
      if (canal && cliente) { try { cliente.removeChannel(canal); } catch (e) {} }
    };
  }

  // ── El puente: misma forma que la librería modular de Firestore ───────
  function crearPuente(real) {
    function sinReal(que) { var e = new Error('Esta pantalla no tiene Firestore para ' + que); e.code = 'unavailable'; throw e; }
    function aReal(v) {
      if (!real) return v;
      if (esTs(v)) return real.serverTimestamp();
      if (esUnion(v)) return real.arrayUnion.apply(null, v.__sbU.map(aReal));
      if (Array.isArray(v)) return v.map(aReal);
      if (esPlano(v)) { var o = {}; Object.keys(v).forEach(function (k) { o[k] = aReal(v[k]); }); return o; }
      return v;
    }
    function consReales(cons) {
      return cons.map(function (k) {
        if (k.__c === 'where') return real.where(k.f, k.op, k.v);
        if (k.__c === 'orderBy') return real.orderBy(k.f, k.dir || 'asc');
        if (k.__c === 'limit') return real.limit(k.n);
        return k;
      });
    }
    var P = {
      __puenteCompras: true,
      collection: function (db) {
        var segs = Array.prototype.slice.call(arguments, 1);
        if (db && db.__sb && db.tipo === 'doc') segs = db.segs.concat(segs);
        if (CONF[patronDe(segs)]) return refCol(segs);
        if (!real) sinReal(segs.join('/'));
        return real.collection.apply(null, arguments);
      },
      doc: function (a) {
        var resto = Array.prototype.slice.call(arguments, 1);
        if (a && a.__sb && a.tipo === 'col') {
          var segs = a.segs.concat(resto.length ? resto : [uuid()]);
          return refDoc(segs);
        }
        if (a && a.__sb && a.tipo === 'doc') return refDoc(a.segs.concat(resto));
        if (resto.length && CONF[patronDe(resto.slice(0, -1))]) return refDoc(resto);
        if (!real) sinReal(resto.join('/'));
        return real.doc.apply(null, arguments);
      },
      where: function (f, op, v) { return { __c: 'where', f: f, op: op, v: v }; },
      orderBy: function (f, dir) { return { __c: 'orderBy', f: f, dir: dir || 'asc' }; },
      limit: function (n) { return { __c: 'limit', n: n }; },
      query: function (ref) {
        var cons = Array.prototype.slice.call(arguments, 1);
        if (ref && ref.__sb) return { __sb: true, tipo: 'query', col: ref.tipo === 'query' ? ref.col : ref, cons: (ref.cons || []).concat(cons), path: ref.path };
        return real.query.apply(null, [ref].concat(consReales(cons)));
      },
      arrayUnion: function () { return { __sbU: Array.prototype.slice.call(arguments) }; },
      serverTimestamp: function () { return TS; },
      getDocs: function (q) {
        if (q && q.__sb) { var colRef = q.tipo === 'query' ? q.col : q; return leerFilas(colRef, q.cons || []).then(function (l) { return querySnap(colRef, l); }); }
        return real.getDocs(q);
      },
      getDoc: function (ref) {
        if (ref && ref.__sb) return leerUno(ref).then(function (act) { return docSnap(ref, act ? act.obj : null); });
        return real.getDoc(ref);
      },
      addDoc: function (ref, datos) { if (ref && ref.__sb) return addDocSb(ref, datos); return real.addDoc(ref, aReal(datos)); },
      setDoc: function (ref, datos, opts) { if (ref && ref.__sb) return setDocSb(ref, datos, opts); return opts ? real.setDoc(ref, aReal(datos), opts) : real.setDoc(ref, aReal(datos)); },
      updateDoc: function (ref, datos) { if (ref && ref.__sb) return updateDocSb(ref, datos); return real.updateDoc(ref, aReal(datos)); },
      deleteDoc: function (ref) { if (ref && ref.__sb) return deleteDocSb(ref); return real.deleteDoc(ref); },
      onSnapshot: function (q, ok, ko) {
        if (q && q.__sb) return onSnapshotSb(q, ok, ko);
        return real.onSnapshot(q, ok, ko);
      },
      writeBatch: function (db) {
        var ops = [];
        var b = {
          set: function (ref, d, o) { ops.push(function () { return P.setDoc(ref, d, o); }); return b; },
          update: function (ref, d) { ops.push(function () { return P.updateDoc(ref, d); }); return b; },
          delete: function (ref) { ops.push(function () { return P.deleteDoc(ref); }); return b; },
          commit: function () { return ops.reduce(function (p, f) { return p.then(f); }, Promise.resolve()); },
        };
        return b;
      },
      runTransaction: function (db, fn) {
        var cola = [];
        var tx = {
          get: function (ref) { return P.getDoc(ref); },
          set: function (ref, d, o) { cola.push(function () { return P.setDoc(ref, d, o); }); return tx; },
          update: function (ref, d) { cola.push(function () { return P.updateDoc(ref, d); }); return tx; },
          delete: function (ref) { cola.push(function () { return P.deleteDoc(ref); }); return tx; },
        };
        return Promise.resolve(fn(tx)).then(function (res) { return cola.reduce(function (p, f) { return p.then(f); }, Promise.resolve()).then(function () { return res; }); });
      },
    };
    return P;
  }

  window.tcComprasFS = function (moduloFirestore) {
    return sb().then(function () { return crearPuente(moduloFirestore || null); });
  };

  // ── Folios atómicos ───────────────────────────────────────────────────
  window.tcCpSiguienteFolio = function (prefijo) {
    return sb().then(function (c) { return c.rpc('compras_siguiente_folio', { p_prefijo: prefijo }); })
      .then(err).then(function (r) { return r.data; });
  };

  // ── Avisos (mismo formato que tcNotificar de portal-supabase.js) ──────
  window.tcCpNotificar = function (datos) {
    if (window.tcNotificar) return window.tcNotificar(datos);
    var d = Object.assign({}, datos || {});
    var fila = { tipo: d.tipo || null, para: d.para ? String(d.para).toLowerCase().trim() : null, mensaje: d.mensaje || null,
      vehiculo_eco: d.vehiculoEco || null, leido: !!d.leido, creada_en: d.creadaEn || new Date().toISOString() };
    ['tipo', 'para', 'mensaje', 'vehiculoEco', 'leido', 'creadaEn'].forEach(function (k) { delete d[k]; });
    fila.datos = Object.keys(d).length ? limpiar(d) : null;
    return sb().then(function (c) { return c.from('portal_notificaciones').insert(fila); }).then(err);
  };

  // ── Nombres de clientes (ya viven en Supabase desde la fase de Catálogos) ──
  window.tcCpClientesNombres = function () {
    return sb().then(function (c) {
      var nombres = [];
      function pagina(desde) {
        return c.from('ventas_clientes').select('nombre').range(desde, desde + 999).then(err).then(function (r) {
          (r.data || []).forEach(function (x) { if (x.nombre) nombres.push(x.nombre); });
          if (r.data && r.data.length === 1000) return pagina(desde + 1000);
        });
      }
      return pagina(0).then(function () { return nombres; });
    });
  };

  // ═════════════════ COPIA ÚNICA Firestore → Supabase ═════════════════
  // Correr UNA vez desde la consola (F12) del portal, con sesión iniciada y
  // con la cuota de Firestore ya reiniciada:   tcMigrarCompras()
  // Por defecto NO pisa lo que ya exista en Supabase (se puede volver a
  // correr sin riesgo). tcMigrarCompras({sobrescribir:true}) sí lo pisa.
  window.tcMigrarCompras = async function (opts) {
    opts = opts || {};
    var fsMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    var appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    var db = window.db || fsMod.getFirestore(appMod.getApps()[0]);
    var c = await sb();
    var res = { requisiciones: 0, fotos: 0, cotizaciones: 0, solicitudes: 0, archivos: 0, proveedores: 0, config: 0, presupuestos: 0, historial: 0, errores: [] };
    var lecturas = 0;
    var subir = async function (tabla, filas, conflicto) {
      for (var i = 0; i < filas.length; i += 25) {
        var r = await c.from(tabla).upsert(filas.slice(i, i + 25), { onConflict: conflicto, ignoreDuplicates: !opts.sobrescribir });
        if (r.error) { res.errores.push(tabla + ' [' + i + ']: ' + r.error.message); console.error(tabla, r.error); }
      }
    };
    var leer = async function (segs) {
      var s = await fsMod.getDocs(fsMod.collection.apply(null, [db].concat(segs)));
      lecturas += Math.max(1, s.size);
      return s.docs;
    };
    var filaDe = function (patron, id, datos, padre) {
      var conf = CONF[patron], r = aFila(conf, datos, true);
      r.fila[pkDe(conf)] = id;
      if (conf.fk) r.fila[conf.fk] = padre;
      if (conf.fijo) Object.assign(r.fila, conf.fijo);
      if (r.com) r.com[conf.comercial.fk] = id;
      return r;
    };
    var maxFolio = { RC: 0, RCC: 0, SC: 0 };
    var notarFolio = function (folio, num, pref) {
      var m = String(folio || '').match(/^(RC|RCC|SC)-(\d+)$/);
      var p = pref || (m && m[1]); var n = typeof num === 'number' ? num : (m ? Number(m[2]) : 0);
      if (p && maxFolio[p] !== undefined && n > maxFolio[p]) maxFolio[p] = n;
    };

    console.log('[Compras] Leyendo requisiciones de Firestore…');
    var reqs = await leer(['requisiciones_compra']);
    var filas = [], coms = [], fotos = [], cots = [];
    for (var i = 0; i < reqs.length; i++) {
      var d = reqs[i], x = d.data();
      notarFolio(x.folio, x.folioNum, x.folioPrefijo === 'RC' || /^RC-/.test(x.folio || '') ? 'RC' : (/^RCC-/.test(x.folio || '') ? 'RCC' : null));
      var r = filaDe('requisiciones_compra', d.id, x);
      filas.push(r.fila); if (r.com) coms.push(r.com);
      (await leer(['requisiciones_compra', d.id, 'fotos'])).forEach(function (f) { fotos.push(filaDe('requisiciones_compra/*/fotos', f.id, f.data(), d.id).fila); });
      (await leer(['requisiciones_compra', d.id, 'cotizaciones'])).forEach(function (f) { cots.push(filaDe('requisiciones_compra/*/cotizaciones', f.id, f.data(), d.id).fila); });
      if (i % 10 === 9) console.log('[Compras] …' + (i + 1) + ' de ' + reqs.length);
    }
    await subir('compras_requisiciones', filas, 'id'); res.requisiciones = filas.length;
    await subir('compras_requisiciones_comercial', coms, 'requisicion_id');
    await subir('compras_requisicion_fotos', fotos, 'id'); res.fotos = fotos.length;
    await subir('compras_requisicion_cotizaciones', cots, 'id'); res.cotizaciones = cots.length;

    console.log('[Compras] Leyendo solicitudes de cotización…');
    var sols = [];
    try { sols = await leer(['solicitudes_cotizacion']); } catch (e) { console.warn('solicitudes_cotizacion:', e.message); }
    var fs2 = [], cs2 = [], ar2 = [];
    for (var j = 0; j < sols.length; j++) {
      var s = sols[j], sx = s.data(); notarFolio(sx.folio, null, 'SC');
      var rs = filaDe('solicitudes_cotizacion', s.id, sx); fs2.push(rs.fila); if (rs.com) cs2.push(rs.com);
      (await leer(['solicitudes_cotizacion', s.id, 'fotos'])).forEach(function (f) { ar2.push(filaDe('solicitudes_cotizacion/*/fotos', f.id, f.data(), s.id).fila); });
      (await leer(['solicitudes_cotizacion', s.id, 'adjuntos'])).forEach(function (f) { ar2.push(filaDe('solicitudes_cotizacion/*/adjuntos', f.id, f.data(), s.id).fila); });
    }
    await subir('compras_solicitudes', fs2, 'id'); res.solicitudes = fs2.length;
    await subir('compras_solicitudes_comercial', cs2, 'solicitud_id');
    await subir('compras_solicitud_archivos', ar2, 'id'); res.archivos = ar2.length;

    console.log('[Compras] Proveedores, configuración y presupuestos…');
    var prov = (await leer(['proveedores'])).map(function (p) { return filaDe('proveedores', p.id, p.data()).fila; });
    await subir('compras_proveedores', prov, 'id'); res.proveedores = prov.length;
    var cfg = [];
    (await leer(['config_flujo_compras'])).forEach(function (k) {
      var v = k.data();
      if (k.id === 'contador_cotizaciones') { notarFolio(null, Number(v.n) || 0, 'SC'); return; }
      if (k.id === 'contador_rcc') { notarFolio(null, Number(v.n) || 0, 'RCC'); return; }
      cfg.push(filaDe('config_flujo_compras', k.id, v).fila);
    });
    await subir('compras_config', cfg, 'clave'); res.config = cfg.length;
    var pres = (await leer(['presupuestos'])).map(function (p) { return filaDe('presupuestos', p.id, p.data()).fila; });
    await subir('compras_presupuestos', pres, 'departamento'); res.presupuestos = pres.length;
    var hist = (await leer(['presupuestos_historial'])).map(function (p) { return filaDe('presupuestos_historial', p.id, p.data()).fila; });
    await subir('compras_presupuestos_historial', hist, 'id'); res.historial = hist.length;

    // Contadores de folio: arrancan donde va hoy (nunca hacia atrás).
    var act = await c.from('compras_folios').select('*');
    var ya = {}; (act.data || []).forEach(function (f) { ya[f.prefijo] = f.ultimo; });
    var folios = Object.keys(maxFolio).map(function (p) { return { prefijo: p, ultimo: Math.max(maxFolio[p], ya[p] || 0) }; });
    var rf = await c.from('compras_folios').upsert(folios, { onConflict: 'prefijo' });
    if (rf.error) res.errores.push('folios: ' + rf.error.message);
    res.folios = folios.map(function (f) { return f.prefijo + ' → siguiente ' + f.prefijo + '-' + String(f.ultimo + 1).padStart(4, '0'); }).join(', ');
    res.lecturasFirestore = lecturas;

    console.log('[Compras] Resultado:', res);
    alert('Copia de Compras terminada:\n' + res.requisiciones + ' requisiciones (' + res.fotos + ' fotos, ' + res.cotizaciones + ' cotizaciones)\n' +
      res.solicitudes + ' solicitudes de cotización\n' + res.proveedores + ' proveedores · ' + res.config + ' configuraciones · ' + res.presupuestos + ' presupuestos\n' +
      'Folios: ' + res.folios + '\nLecturas usadas de Firestore: ' + lecturas + (res.errores.length ? '\n\nERRORES:\n' + res.errores.join('\n') : '\n\nSin errores.'));
    return res;
  };
})();
