// ═════════════════════════════════════════════════════════════════
//  operaciones-supabase.js — Portal Operativo Tecnocontrol  (oct-2026)
// ═════════════════════════════════════════════════════════════════
//  Saca Operaciones de Firestore. Igual que compras-supabase.js: expone un
//  "puente" con LA MISMA FORMA que la librería de Firestore, así el código de
//  operaciones.js (y lo que se liga a Operaciones en rh.js, ventas.js, el kiosco
//  y Flotilla móvil) casi no cambia.
//
//  Todo lo que empiece con "ops_" va a Supabase:
//    · ops_herramientas y ops_movimientos → sus tablas tipadas (ya eran Supabase)
//    · todo lo demás (folios + comentarios, técnicos, recetas, guardias, ausencias,
//      clientes, almacenes, puestos, notificaciones, contactos, configuración…) →
//      tabla ops_docs (una fila por documento, misma ruta que en Firestore,
//      con tiempo real).
//  Lo que NO empieza con "ops_" se pasa tal cual a Firestore (es de otro módulo:
//  Flotilla, usuarios/login).
//
//  API global:
//    window.tcOpsFS(moduloFirestore|null)  → Promise<puente modular>   (portal)
//    window.tcOpsCompat(dbCompat)          → db con .collection() enrutado (Flotilla móvil, SDK compat)
//    window.tcMigrarOperaciones({soloContar}) → copia única Firestore → Supabase
// ═════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.tcOpsFS) return;

  var SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
  var _sbProm = null;
  function sb() {
    if (window.tcSupabase) return Promise.resolve(window.tcSupabase);
    if (_sbProm) return _sbProm;
    _sbProm = (window.supabase && window.supabase.createClient
      ? Promise.resolve(window.supabase)
      : import('https://esm.sh/@supabase/supabase-js@2')
    ).then(function (mod) {
      if (window.tcSupabase) return window.tcSupabase;
      window.tcSupabase = mod.createClient(SB_URL, SB_KEY);
      return window.tcSupabase;
    }).catch(function (e) { _sbProm = null; throw e; });
    return _sbProm;
  }

  // ───────────── utilidades ─────────────
  function esOps(ruta) { return /^ops_/.test(String(ruta || '').split('/')[0]); }
  function autoId() {
    var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '';
    var a = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(20)) : null;
    for (var i = 0; i < 20; i++) s += c[(a ? a[i] : Math.floor(Math.random() * 256)) % c.length];
    return s;
  }
  function ahora() { return new Date().toISOString(); }
  function clonar(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function esObjetoPlano(v) { return v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !esCentinela(v); }
  function obtener(o, campo) {
    if (campo === '__name__') return o && o.__id;
    return String(campo).split('.').reduce(function (a, k) { return a == null ? undefined : a[k]; }, o);
  }
  function poner(o, campo, v) {
    var p = String(campo).split('.'), cur = o;
    for (var i = 0; i < p.length - 1; i++) { if (!esObjetoPlano(cur[p[i]])) cur[p[i]] = {}; cur = cur[p[i]]; }
    if (v === undefined) delete cur[p[p.length - 1]]; else cur[p[p.length - 1]] = v;
  }
  function igual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function comparar(a, b) {
    if (a === b) return 0;
    if (a == null) return -1; if (b == null) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  }

  // ───────────── centinelas (serverTimestamp, arrayUnion, increment…) ─────────────
  function C(op, v) { return { __tcOp: op, v: v }; }
  function esCentinela(v) { return v && typeof v === 'object' && (v.__tcOp || v._methodName || (v._delegate && v._delegate._methodName)); }
  // Convierte también los FieldValue reales del SDK (compat o modular) que lleguen por error.
  function normCentinela(v) {
    if (v.__tcOp) return v;
    var d = v._delegate || v, m = String(d._methodName || '');
    if (/serverTimestamp/.test(m)) return C('ts');
    if (/arrayUnion/.test(m)) return C('union', d._elements || d.ia || []);
    if (/arrayRemove/.test(m)) return C('remove', d._elements || d.ia || []);
    if (/increment/.test(m)) return C('inc', d._operand != null ? d._operand : (d.Ae || 1));
    if (/delete/.test(m)) return C('del');
    return C('ts');
  }
  function resolver(actual, v) {
    var c = normCentinela(v);
    if (c.__tcOp === 'ts') return ahora();
    if (c.__tcOp === 'del') return undefined;
    if (c.__tcOp === 'inc') return (Number(actual) || 0) + Number(c.v || 0);
    var arr = Array.isArray(actual) ? actual.slice() : [];
    if (c.__tcOp === 'union') { (c.v || []).forEach(function (x) { if (!arr.some(function (y) { return igual(x, y); })) arr.push(x); }); return arr; }
    if (c.__tcOp === 'remove') return arr.filter(function (y) { return !(c.v || []).some(function (x) { return igual(x, y); }); });
    return undefined;
  }
  // Limpia un objeto para JSON: fechas → ISO, Timestamp → ISO, referencias → ruta.
  function aJSON(v) {
    if (v === undefined) return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return null; } }
    if (v.latitude != null && v.longitude != null && Object.keys(v).length <= 3) return { latitude: v.latitude, longitude: v.longitude };
    if (v.path && v.id && v.firestore) return v.path;
    if (Array.isArray(v)) return v.map(aJSON).filter(function (x) { return x !== undefined; });
    var o = {};
    Object.keys(v).forEach(function (k) { var x = aJSON(v[k]); if (x !== undefined) o[k] = x; });
    return o;
  }
  // Aplica un "set" (con o sin merge) o un "update" (rutas con punto) sobre el documento actual.
  function aplicar(base, cambios, modo) {
    var out = modo === 'set' ? {} : clonar(base || {});
    function rec(dest, src, prefijo) {
      Object.keys(src).forEach(function (k) {
        var v = src[k], campo = prefijo ? prefijo + '.' + k : k;
        if (v === undefined) return;
        if (esCentinela(v)) { poner(out, campo, resolver(obtener(out, campo), v)); return; }
        if (modo === 'merge' && esObjetoPlano(v)) { if (!esObjetoPlano(obtener(out, campo))) poner(out, campo, {}); rec(dest, v, campo); return; }
        poner(out, campo, aJSONprofundo(v));
      });
    }
    function aJSONprofundo(v) {
      if (esCentinela(v)) return resolver(undefined, v);
      if (Array.isArray(v)) return v.map(aJSONprofundo);
      if (esObjetoPlano(v)) { var o = {}; Object.keys(v).forEach(function (k) { var x = aJSONprofundo(v[k]); if (x !== undefined) o[k] = x; }); return o; }
      return aJSON(v);
    }
    if (modo === 'update') {
      Object.keys(cambios).forEach(function (campo) {
        var v = cambios[campo];
        if (v === undefined) return;
        if (esCentinela(v)) poner(out, campo, resolver(obtener(out, campo), v));
        else poner(out, campo, aJSONprofundo(v));
      });
    } else rec(out, cambios, '');
    return out;
  }

  // ───────────── referencias y consultas ─────────────
  function CRef(ruta) { this.type = 'collection'; this.path = ruta; var s = ruta.split('/'); this.id = s[s.length - 1]; this.__tc = true; }
  function DRef(ruta) {
    this.type = 'document'; this.path = ruta; var s = ruta.split('/'); this.id = s[s.length - 1]; this.__tc = true;
    this.parent = new CRef(s.slice(0, -1).join('/'));
  }
  function Q(ref, filtros, orden, lim) { this.type = 'query'; this.ref = ref; this.filtros = filtros || []; this.orden = orden || []; this.lim = lim || null; this.__tc = true; this.path = ref.path; }
  function coleccionDe(x) { return x instanceof Q ? x.ref.path : x.path; }

  // ───────────── tablas tipadas (herramientas y movimientos ya vivían en Supabase) ─────────────
  var TIPADAS = {
    ops_herramientas: { pk: 'id', extra: true, cols: 'id,folio,descripcion,marca,modelo,categoria,subcategoria,numero_serie,departamento,condicion,uso,peso,peso_unidad,medida,foto_base64,estado,ubicacion_actual,almacen_id,tecnico_actual_id,fecha_asignacion,folio_legado,observaciones,fecha_alta,origen_requisicion_id,origen_requisicion_folio,requiere_autorizacion,external_id,source_system,last_sync,sync_status,cantidad,condicion_fisica'.split(','), num: ['peso', 'cantidad'] },
    ops_movimientos: { pk: 'id', extra: false, cols: 'herramienta_id,tecnico_anterior_id,tecnico_nuevo_id,almacen_origen_id,almacen_destino_id,ubicacion_anterior,ubicacion_nueva,tipo,motivo,observaciones,usuario_email,usuario_nombre,fecha'.split(','), num: [] },
  };
  function snake(k) { return String(k).replace(/([A-Z])/g, '_$1').toLowerCase(); }
  function camel(k) { return String(k).replace(/_([a-z0-9])/g, function (_, c) { return c.toUpperCase(); }); }
  function filaADoc(tabla, fila) {
    var o = {};
    Object.keys(fila || {}).forEach(function (k) { if (k === 'extra' || k === 'creado_en' || k === 'actualizado_en' || k === 'geog') return; o[camel(k)] = fila[k]; });
    if (fila && fila.extra && typeof fila.extra === 'object') Object.assign(o, fila.extra);
    var id = String(fila[TIPADAS[tabla].pk]); delete o.id;
    return { id: id, datos: o };
  }
  function docAFila(tabla, id, obj) {
    var T = TIPADAS[tabla], fila = {}, extra = {};
    if (id) fila[T.pk] = id;
    Object.keys(obj || {}).forEach(function (k) {
      if (k === 'id') return;
      var s = snake(k), v = obj[k];
      if (v === undefined) return;
      if (T.cols.indexOf(s) >= 0) {
        if (T.num.indexOf(s) >= 0 && v !== null) { var n = Number(v); if (v === '' || isNaN(n)) { if (v !== '') extra[k] = v; v = null; } else v = n; }
        fila[s] = v;
      } else if (T.extra) extra[k] = v;
    });
    if (T.extra) fila.extra = Object.keys(extra).length ? extra : null;
    if (tabla === 'ops_herramientas') fila.actualizado_en = ahora();
    return fila;
  }

  // ───────────── lectura ─────────────
  function cumpleFiltro(datos, f) {
    var v = obtener(datos, f.campo), x = f.valor;
    switch (f.op) {
      case '==': return v !== undefined && igual(v, x);
      case '!=': return v !== undefined && !igual(v, x);
      case '<': return v != null && comparar(v, x) < 0;
      case '<=': return v != null && comparar(v, x) <= 0;
      case '>': return v != null && comparar(v, x) > 0;
      case '>=': return v != null && comparar(v, x) >= 0;
      case 'in': return (x || []).some(function (y) { return igual(v, y); });
      case 'not-in': return v !== undefined && !(x || []).some(function (y) { return igual(v, y); });
      case 'array-contains': return Array.isArray(v) && v.some(function (y) { return igual(y, x); });
      case 'array-contains-any': return Array.isArray(v) && v.some(function (y) { return (x || []).some(function (z) { return igual(y, z); }); });
    }
    return true;
  }
  function aplicarConsulta(lista, q) {
    var r = lista;
    if (q && q.filtros.length) r = r.filter(function (d) { var x = Object.assign({ __id: d.id }, d.datos); return q.filtros.every(function (f) { return cumpleFiltro(x, f); }); });
    if (q && q.orden.length) {
      r = r.filter(function (d) { return q.orden.every(function (o) { return obtener(d.datos, o.campo) !== undefined || o.campo === '__name__'; }); });
      r = r.slice().sort(function (a, b) {
        for (var i = 0; i < q.orden.length; i++) {
          var o = q.orden[i], c = comparar(o.campo === '__name__' ? a.id : obtener(a.datos, o.campo), o.campo === '__name__' ? b.id : obtener(b.datos, o.campo));
          if (c) return o.dir === 'desc' ? -c : c;
        }
        return 0;
      });
    }
    if (q && q.lim) r = r.slice(0, q.lim);
    return r;
  }
  async function leerColeccion(coleccion, q) {
    var c = await sb();
    var base = coleccion.split('/')[0];
    if (TIPADAS[base] && coleccion === base) {
      var T = TIPADAS[base], todos = [], desde = 0;
      while (true) {
        var qq = c.from(base).select('*');
        (q ? q.filtros : []).forEach(function (f) {
          var s = snake(f.campo);
          if (f.op === '==' && T.cols.indexOf(s) >= 0) qq = f.valor === null ? qq.is(s, null) : qq.eq(s, f.valor);
        });
        var r = await qq.range(desde, desde + 999);
        if (r.error) throw r.error;
        todos = todos.concat(r.data || []);
        if (!r.data || r.data.length < 1000) break;
        desde += 1000;
      }
      return todos.map(function (f) { return filaADoc(base, f); });
    }
    var out = [], ini = 0;
    while (true) {
      var qb = c.from('ops_docs').select('doc_id,datos').eq('coleccion', coleccion);
      // Filtros de igualdad simples se hacen en el servidor (índice GIN); el resto aquí.
      (q ? q.filtros : []).forEach(function (f) {
        if (f.op === '==' && f.campo.indexOf('.') < 0 && f.campo !== '__name__' && f.valor !== null && typeof f.valor !== 'object') {
          var obj = {}; obj[f.campo] = f.valor; qb = qb.contains('datos', obj);
        }
      });
      var res = await qb.order('doc_id').range(ini, ini + 999);
      if (res.error) throw res.error;
      (res.data || []).forEach(function (r) { out.push({ id: r.doc_id, datos: r.datos || {} }); });
      if (!res.data || res.data.length < 1000) break;
      ini += 1000;
    }
    return out;
  }
  async function leerDoc(ruta) {
    var c = await sb(), s = ruta.split('/');
    var base = s[0];
    if (TIPADAS[base] && s.length === 2) {
      var r = await c.from(base).select('*').eq(TIPADAS[base].pk, s[1]).maybeSingle();
      if (r.error) throw r.error;
      return r.data ? filaADoc(base, r.data) : null;
    }
    var res = await c.from('ops_docs').select('doc_id,datos').eq('ruta', ruta).maybeSingle();
    if (res.error) throw res.error;
    return res.data ? { id: res.data.doc_id, datos: res.data.datos || {} } : null;
  }

  // ───────────── snapshots con la forma de Firestore ─────────────
  function DocSnap(ruta, d, compat) {
    var datos = d ? d.datos : undefined;
    this.id = ruta.split('/').pop(); this.ref = new DRef(ruta);
    if (compat) this.exists = !!d; else this.exists = function () { return !!d; };
    this.data = function () { return datos === undefined ? undefined : clonar(datos); };
    this.get = function (campo) { return datos === undefined ? undefined : clonar(obtener(datos, campo)); };
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  function QuerySnap(coleccion, lista, cambios, compat) {
    var docs = lista.map(function (d) { return new DocSnap(coleccion + '/' + d.id, d, compat); });
    this.docs = docs; this.size = docs.length; this.empty = !docs.length;
    this.forEach = function (fn) { docs.forEach(fn); };
    var ch = (cambios || docs.map(function (d, i) { return { type: 'added', doc: d, oldIndex: -1, newIndex: i }; }));
    this.docChanges = function () { return ch; };
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }

  // ───────────── tiempo real ─────────────
  // Una "fuente" por colección: carga una vez, se actualiza con Realtime y con las
  // escrituras propias al instante (como la compensación de latencia de Firestore).
  var fuentes = {};
  function fuente(coleccion) {
    if (fuentes[coleccion]) return fuentes[coleccion];
    var F = { mapa: new Map(), oyentes: new Set(), listo: null, canal: null, borrados: new Map() };
    F.notificar = function () { F.oyentes.forEach(function (o) { try { o(); } catch (e) { console.error('[operaciones-supabase] oyente:', e); } }); };
    F.poner = function (id, datos, remoto) {
      // Un evento remoto atrasado no debe "revivir" un documento que se acaba de borrar.
      if (datos === null) F.borrados.set(id, Date.now());
      else if (remoto && F.borrados.has(id) && Date.now() - F.borrados.get(id) < 5000) return;
      else F.borrados.delete(id);
      if (datos === null) F.mapa.delete(id); else F.mapa.set(id, datos);
      F.notificar();
    };
    F.recargar = function () {
      return leerColeccion(coleccion, null).then(function (lista) {
        F.mapa = new Map(lista.map(function (d) { return [d.id, d.datos]; })); F.notificar();
      }).catch(function (e) { console.warn('[operaciones-supabase] recarga', coleccion, e.message || e); });
    };
    F.listo = leerColeccion(coleccion, null).then(function (lista) { lista.forEach(function (d) { F.mapa.set(d.id, d.datos); }); });
    var base = coleccion.split('/')[0], tipada = TIPADAS[base] && coleccion === base;
    sb().then(function (c) {
      var nombre = 'ops-' + coleccion.replace(/[^a-zA-Z0-9]/g, '-') + '-' + Math.random().toString(36).slice(2, 7);
      var cfg = tipada ? { event: '*', schema: 'public', table: base } : { event: '*', schema: 'public', table: 'ops_docs', filter: 'coleccion=eq.' + coleccion };
      var t = null;
      F.canal = c.channel(nombre).on('postgres_changes', cfg, function (p) {
        if (tipada) { clearTimeout(t); t = setTimeout(F.recargar, 400); return; }
        if (p.eventType === 'DELETE') { var o = p.old || {}; if (o.ruta) { var rr = String(o.ruta); if (rr.indexOf(coleccion + '/') === 0 && rr.split('/').length === coleccion.split('/').length + 1) F.poner(rr.split('/').pop(), null); } else F.recargar(); return; }
        var n = p.new || {};
        if (n.doc_id && n.datos) F.poner(n.doc_id, n.datos, true);
        else if (n.ruta) leerDoc(n.ruta).then(function (d) { if (d) F.poner(d.id, d.datos, true); });
      });
      F.canal.subscribe(function (st) {
        if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') console.warn('[operaciones-supabase] tiempo real', coleccion, st);
        if (st === 'SUBSCRIBED') F.listo.then(F.recargar); // por si algo cambió entre la carga y la suscripción
      });
    }).catch(function () {});
    fuentes[coleccion] = F;
    return F;
  }
  function escrituraLocal(ruta, datos) {
    var s = ruta.split('/'), col = s.slice(0, -1).join('/'), id = s[s.length - 1];
    if (fuentes[col]) fuentes[col].poner(id, datos);
  }
  function suscribir(objetivo, alCambio, alError, compat) {
    var vivo = true, previo = null;
    if (objetivo instanceof DRef) {
      var s = objetivo.path.split('/'), col = s.slice(0, -1).join('/'), id = s[s.length - 1];
      var F1 = fuente(col);
      var emitir1 = function () { if (!vivo) return; var d = F1.mapa.get(id); alCambio(new DocSnap(objetivo.path, d ? { id: id, datos: d } : null, compat)); };
      F1.listo.then(function () { F1.oyentes.add(emitir1); emitir1(); }).catch(function (e) { if (alError) alError(e); });
      return function () { vivo = false; F1.oyentes.delete(emitir1); };
    }
    var q = objetivo instanceof Q ? objetivo : new Q(objetivo);
    var F = fuente(q.ref.path);
    var emitir = function () {
      if (!vivo) return;
      var lista = aplicarConsulta(Array.from(F.mapa, function (e) { return { id: e[0], datos: e[1] }; }), q);
      var cambios = null;
      if (previo) {
        cambios = [];
        var ahoraM = new Map(lista.map(function (d, i) { return [d.id, { d: d, i: i }]; }));
        lista.forEach(function (d, i) {
          var p = previo.get(d.id);
          if (!p) cambios.push({ type: 'added', doc: new DocSnap(q.ref.path + '/' + d.id, d, compat), oldIndex: -1, newIndex: i });
          else if (!igual(p.d.datos, d.datos)) cambios.push({ type: 'modified', doc: new DocSnap(q.ref.path + '/' + d.id, d, compat), oldIndex: p.i, newIndex: i });
        });
        previo.forEach(function (p, idp) { if (!ahoraM.has(idp)) cambios.push({ type: 'removed', doc: new DocSnap(q.ref.path + '/' + idp, p.d, compat), oldIndex: p.i, newIndex: -1 }); });
        if (!cambios.length) return; // nada visible cambió para esta consulta
      }
      previo = new Map(lista.map(function (d, i) { return [d.id, { d: { id: d.id, datos: clonar(d.datos) }, i: i }]; }));
      alCambio(new QuerySnap(q.ref.path, lista, cambios, compat));
    };
    F.listo.then(function () { F.oyentes.add(emitir); emitir(); }).catch(function (e) { if (alError) alError(e); else console.error(e); });
    return function () { vivo = false; F.oyentes.delete(emitir); };
  }

  // ───────────── escritura ─────────────
  async function escribir(ruta, cambios, modo) {
    var c = await sb(), s = ruta.split('/'), id = s[s.length - 1], col = s.slice(0, -1).join('/'), base = s[0];
    if (TIPADAS[base] && s.length === 2) {
      var actualT = modo === 'set' ? null : await leerDoc(ruta);
      if (modo === 'update' && !actualT) { var e1 = new Error('No document to update: ' + ruta); e1.code = 'not-found'; throw e1; }
      var datosT = aplicar(actualT ? actualT.datos : {}, cambios, modo);
      var filaT = docAFila(base, id, datosT);
      var rT = await c.from(base).upsert(filaT, { onConflict: TIPADAS[base].pk });
      if (rT.error) throw rT.error;
      if (fuentes[base]) fuentes[base].poner(id, datosT);
      return datosT;
    }
    var actual = modo === 'set' ? null : await leerDoc(ruta);
    if (modo === 'update' && !actual) { var e = new Error('No document to update: ' + ruta); e.code = 'not-found'; throw e; }
    var datos = aplicar(actual ? actual.datos : {}, cambios, modo);
    var r = await c.from('ops_docs').upsert({ ruta: ruta, coleccion: col, doc_id: id, datos: datos, actualizado_en: ahora() }, { onConflict: 'ruta' });
    if (r.error) throw r.error;
    escrituraLocal(ruta, datos);
    return datos;
  }
  async function agregar(coleccion, datos) {
    var base = coleccion.split('/')[0];
    if (TIPADAS[base] && coleccion === base) {
      var c = await sb(), fila = docAFila(base, base === 'ops_movimientos' ? null : autoId(), aplicar({}, datos, 'set'));
      var r = await c.from(base).insert(fila).select(TIPADAS[base].pk).single();
      if (r.error) throw r.error;
      var nid = String(r.data[TIPADAS[base].pk]);
      if (fuentes[base]) fuentes[base].recargar();
      return new DRef(coleccion + '/' + nid);
    }
    var id = autoId(), ruta = coleccion + '/' + id;
    await escribir(ruta, datos, 'set');
    return new DRef(ruta);
  }
  async function borrar(ruta) {
    var c = await sb(), s = ruta.split('/'), base = s[0];
    var r = (TIPADAS[base] && s.length === 2) ? await c.from(base).delete().eq(TIPADAS[base].pk, s[1]) : await c.from('ops_docs').delete().eq('ruta', ruta);
    if (r.error) throw r.error;
    escrituraLocal(ruta, null);
  }

  // ───────────── puente modular (forma de firebase-firestore.js) ─────────────
  // Los "where/orderBy/limit" y centinelas son propios; si la consulta es de una
  // colección que NO es de Operaciones, se traducen a los reales de Firestore.
  function crearPuente(real) {
    function realCentinelas(v) {
      if (!real) return v;
      if (v && v.__tcOp) {
        if (v.__tcOp === 'ts') return real.serverTimestamp();
        if (v.__tcOp === 'union') return real.arrayUnion.apply(null, v.v);
        if (v.__tcOp === 'remove') return real.arrayRemove.apply(null, v.v);
        if (v.__tcOp === 'inc') return real.increment(v.v);
        if (v.__tcOp === 'del') return real.deleteField();
      }
      if (Array.isArray(v)) return v.map(realCentinelas);
      if (esObjetoPlano(v)) { var o = {}; Object.keys(v).forEach(function (k) { o[k] = realCentinelas(v[k]); }); return o; }
      return v;
    }
    function sinReal(nombre) { throw new Error('Firestore no disponible para ' + nombre + ' (fuera de Operaciones)'); }
    var P = {
      __tcOps: true,
      collection: function (padre) {
        var seg = Array.prototype.slice.call(arguments, 1);
        if (padre instanceof DRef) return new CRef([padre.path].concat(seg).join('/'));
        if (padre instanceof CRef) return new CRef([padre.path].concat(seg).join('/'));
        if (esOps(seg[0])) return new CRef(seg.join('/'));
        return real ? real.collection.apply(null, arguments) : sinReal(seg.join('/'));
      },
      doc: function (padre) {
        var seg = Array.prototype.slice.call(arguments, 1);
        if (padre instanceof CRef) return new DRef(padre.path + '/' + (seg.length ? seg.join('/') : autoId()));
        if (padre instanceof DRef) return new DRef([padre.path].concat(seg).join('/'));
        if (esOps(seg[0])) return new DRef(seg.join('/'));
        return real ? real.doc.apply(null, arguments) : sinReal(seg.join('/'));
      },
      query: function (ref) {
        var cs = Array.prototype.slice.call(arguments, 1);
        if (ref instanceof CRef || ref instanceof Q) {
          var b = ref instanceof Q ? ref : new Q(ref), f = b.filtros.slice(), o = b.orden.slice(), l = b.lim;
          cs.forEach(function (x) { if (!x) return; if (x.__k === 'where') f.push(x); else if (x.__k === 'orderBy') o.push(x); else if (x.__k === 'limit') l = x.n; });
          return new Q(b.ref, f, o, l);
        }
        return real.query.apply(null, [ref].concat(cs.map(function (x) {
          if (!x || !x.__k) return x;
          if (x.__k === 'where') return real.where(x.campo, x.op, x.valor);
          if (x.__k === 'orderBy') return real.orderBy(x.campo, x.dir);
          if (x.__k === 'limit') return real.limit(x.n);
          return x;
        })));
      },
      where: function (campo, op, valor) { return { __k: 'where', campo: String(campo), op: op, valor: valor }; },
      orderBy: function (campo, dir) { return { __k: 'orderBy', campo: String(campo), dir: dir || 'asc' }; },
      limit: function (n) { return { __k: 'limit', n: n }; },
      documentId: function () { return '__name__'; },
      serverTimestamp: function () { return C('ts'); },
      arrayUnion: function () { return C('union', Array.prototype.slice.call(arguments)); },
      arrayRemove: function () { return C('remove', Array.prototype.slice.call(arguments)); },
      increment: function (n) { return C('inc', n); },
      deleteField: function () { return C('del'); },
      getDocs: async function (q) {
        if (!q.__tc) return real.getDocs(q);
        var col = coleccionDe(q), qq = q instanceof Q ? q : new Q(q);
        var lista = fuentes[col] ? await fuentes[col].listo.then(function () { return Array.from(fuentes[col].mapa, function (e) { return { id: e[0], datos: e[1] }; }); }) : await leerColeccion(col, qq);
        return new QuerySnap(col, aplicarConsulta(lista, qq));
      },
      getDoc: async function (ref) {
        if (!ref.__tc) return real.getDoc(ref);
        return new DocSnap(ref.path, await leerDoc(ref.path));
      },
      setDoc: async function (ref, datos, opt) {
        if (!ref.__tc) return real.setDoc(ref, realCentinelas(datos), opt);
        await escribir(ref.path, datos, opt && (opt.merge || opt.mergeFields) ? 'merge' : 'set');
      },
      updateDoc: async function (ref, datos) {
        if (!ref.__tc) return real.updateDoc.apply(null, [ref, realCentinelas(datos)].concat(Array.prototype.slice.call(arguments, 2)));
        if (typeof datos === 'string') { var o = {}, a = Array.prototype.slice.call(arguments, 1); for (var i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; datos = o; }
        await escribir(ref.path, datos, 'update');
      },
      addDoc: async function (ref, datos) {
        if (!ref.__tc) return real.addDoc(ref, realCentinelas(datos));
        return agregar(ref.path, datos);
      },
      deleteDoc: async function (ref) {
        if (!ref.__tc) return real.deleteDoc(ref);
        await borrar(ref.path);
      },
      onSnapshot: function (ref) {
        var a = Array.prototype.slice.call(arguments, 1);
        if (!ref.__tc) return real.onSnapshot.apply(null, arguments);
        var ok = typeof a[0] === 'function' ? a[0] : (a[0] && a[0].next) || (typeof a[1] === 'function' ? a[1] : null);
        var err = typeof a[0] === 'function' ? a[1] : (a[0] && a[0].error) || a[2];
        return suscribir(ref, ok, err, false);
      },
      runTransaction: async function (db, fn) {
        var cola = [];
        var tx = {
          get: function (ref) { return P.getDoc(ref); },
          set: function (ref, d, o) { cola.push(function () { return P.setDoc(ref, d, o); }); return tx; },
          update: function (ref, d) { cola.push(function () { return P.updateDoc(ref, d); }); return tx; },
          delete: function (ref) { cola.push(function () { return P.deleteDoc(ref); }); return tx; },
        };
        var r = await fn(tx);
        for (var i = 0; i < cola.length; i++) await cola[i]();
        return r;
      },
      writeBatch: function () {
        var cola = [];
        var b = {
          set: function (ref, d, o) { cola.push(function () { return P.setDoc(ref, d, o); }); return b; },
          update: function (ref, d) { cola.push(function () { return P.updateDoc(ref, d); }); return b; },
          delete: function (ref) { cola.push(function () { return P.deleteDoc(ref); }); return b; },
          commit: async function () { for (var i = 0; i < cola.length; i++) await cola[i](); },
        };
        return b;
      },
    };
    // Todo lo demás de la librería real (collectionGroup, Timestamp, etc.) pasa tal cual.
    if (real) Object.keys(real).forEach(function (k) { if (!(k in P)) P[k] = real[k]; });
    return P;
  }
  var _puente = null;
  window.tcOpsFS = function (moduloFirestore) {
    if (_puente && (!moduloFirestore || _puente.__real === moduloFirestore)) return Promise.resolve(_puente);
    _puente = crearPuente(moduloFirestore || null);
    _puente.__real = moduloFirestore || null;
    return Promise.resolve(_puente);
  };
  // Contador atómico en el servidor (para consecutivos).
  window.tcOpsIncrementar = async function (ruta, campo, n) {
    var c = await sb(), s = ruta.split('/');
    var r = await c.rpc('ops_docs_incrementar', { p_ruta: ruta, p_coleccion: s.slice(0, -1).join('/'), p_doc_id: s[s.length - 1], p_campo: campo, p_n: n || 1 });
    if (r.error) throw r.error;
    return Number(r.data);
  };

  // ───────────── adaptador para el SDK compat (Flotilla móvil) ─────────────
  function CompatQuery(ruta, q) {
    var self = this; q = q || new Q(new CRef(ruta));
    this.where = function (campo, op, valor) { return new CompatQuery(ruta, new Q(q.ref, q.filtros.concat([{ campo: String(campo), op: op, valor: valor }]), q.orden, q.lim)); };
    this.orderBy = function (campo, dir) { return new CompatQuery(ruta, new Q(q.ref, q.filtros, q.orden.concat([{ campo: String(campo), dir: dir || 'asc' }]), q.lim)); };
    this.limit = function (n) { return new CompatQuery(ruta, new Q(q.ref, q.filtros, q.orden, n)); };
    this.get = async function () {
      var lista = fuentes[ruta] ? await fuentes[ruta].listo.then(function () { return Array.from(fuentes[ruta].mapa, function (e) { return { id: e[0], datos: e[1] }; }); }) : await leerColeccion(ruta, q);
      return new QuerySnap(ruta, aplicarConsulta(lista, q), null, true);
    };
    this.onSnapshot = function (ok, err) {
      if (ok && typeof ok === 'object' && ok.next) { err = ok.error; ok = ok.next; }
      return suscribir(q, ok, err, true);
    };
    this.__q = q; void self;
  }
  function CompatDoc(ruta) {
    this.id = ruta.split('/').pop(); this.path = ruta;
    this.get = async function () { return new DocSnap(ruta, await leerDoc(ruta), true); };
    this.set = function (d, o) { return escribir(ruta, d, o && o.merge ? 'merge' : 'set').then(function () {}); };
    this.update = function (d) { return escribir(ruta, d, 'update').then(function () {}); };
    this.delete = function () { return borrar(ruta); };
    this.onSnapshot = function (ok, err) { return suscribir(new DRef(ruta), ok, err, true); };
    this.collection = function (sub) { return new CompatColl(ruta + '/' + sub); };
  }
  function CompatColl(ruta) {
    CompatQuery.call(this, ruta);
    this.id = ruta.split('/').pop(); this.path = ruta;
    this.doc = function (id) { return new CompatDoc(ruta + '/' + (id || autoId())); };
    this.add = function (d) { return agregar(ruta, d).then(function (ref) { return new CompatDoc(ref.path); }); };
  }
  window.tcOpsCompat = function (dbCompat) {
    return {
      collection: function (nombre) { return esOps(nombre) ? new CompatColl(nombre) : dbCompat.collection(nombre); },
      doc: function (ruta) { return esOps(ruta) ? new CompatDoc(ruta) : dbCompat.doc(ruta); },
      __real: dbCompat,
    };
  };

  // ───────────── copia única Firestore → Supabase ─────────────
  // Se corre UNA vez desde el portal (consola del navegador, sesión de administrador):
  //   await tcMigrarOperaciones()                → copia todo
  //   await tcMigrarOperaciones({ soloContar: true }) → solo cuenta, no escribe
  var OPS_COLECCIONES = ['ops_almacen_tecnico', 'ops_almacenes', 'ops_auditoria', 'ops_avisos_clientes', 'ops_clientes', 'ops_config_alertas',
    'ops_config_calibracion', 'ops_config_revision', 'ops_config_viaticos', 'ops_contactos', 'ops_contadores', 'ops_folios', 'ops_guardias',
    'ops_guardias_programadas', 'ops_herramienta_traspasos', 'ops_historial_puesto', 'ops_notificaciones', 'ops_personas', 'ops_puestos',
    'ops_revisiones_herramienta', 'ops_servicios_catalogo', 'ops_tarifas_personal', 'ops_tecnico_ausencias', 'ops_tecnicos', 'ops_vehiculo_asignaciones'];
  var OPS_SUBCOLECCIONES = [['ops_folios', 'comentarios'], ['ops_servicios_catalogo', 'historial'], ['ops_revisiones_herramienta', 'fotos']];
  window.tcMigrarOperaciones = async function (opc) {
    opc = opc || {};
    var fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    var db = window.db; if (!db) throw new Error('Abre el portal con sesión iniciada (window.db no existe).');
    var c = await sb(), resumen = {}, filas = [];
    function empujar(ruta, datos) { var s = ruta.split('/'); filas.push({ ruta: ruta, coleccion: s.slice(0, -1).join('/'), doc_id: s[s.length - 1], datos: aJSON(datos) || {}, actualizado_en: ahora() }); }
    for (var i = 0; i < OPS_COLECCIONES.length; i++) {
      var n = OPS_COLECCIONES[i];
      var snap = await fs.getDocs(fs.collection(db, n));
      resumen[n] = snap.size;
      snap.forEach(function (d) { empujar(n + '/' + d.id, d.data()); });
      console.log('[migrar] ' + n + ': ' + snap.size);
    }
    for (var j = 0; j < OPS_SUBCOLECCIONES.length; j++) {
      var padre = OPS_SUBCOLECCIONES[j][0], sub = OPS_SUBCOLECCIONES[j][1], cuenta = 0;
      var sg = await fs.getDocs(fs.collectionGroup(db, sub));
      sg.forEach(function (d) { if (d.ref.path.indexOf(padre + '/') === 0) { empujar(d.ref.path, d.data()); cuenta++; } });
      resumen[padre + '/*/' + sub] = cuenta;
      console.log('[migrar] ' + padre + '/*/' + sub + ': ' + cuenta);
    }
    if (opc.soloContar) { console.table(resumen); return resumen; }
    // Lotes por tamaño (las fotos en base64 pesan): ~1.5 MB por envío
    var lote = [], peso = 0, enviados = 0;
    async function enviar() {
      if (!lote.length) return;
      var r = await c.from('ops_docs').upsert(lote, { onConflict: 'ruta' });
      if (r.error) throw new Error('Supabase: ' + r.error.message + ' (lote desde ' + lote[0].ruta + ')');
      enviados += lote.length; console.log('[migrar] enviados ' + enviados + ' de ' + filas.length);
      lote = []; peso = 0;
    }
    for (var k = 0; k < filas.length; k++) {
      var t = JSON.stringify(filas[k].datos).length;
      if (lote.length && (peso + t > 1500000 || lote.length >= 300)) await enviar();
      lote.push(filas[k]); peso += t;
    }
    await enviar();
    resumen.total = enviados;
    console.table(resumen);
    return resumen;
  };
})();
