/* ════════════════════════════════════════════════════════════════════
   flotilla-supabase.js — Puente de Flotilla a Supabase
   ────────────────────────────────────────────────────────────────────
   Solicitudes vehiculares de la app de técnicos:
     · Tabla  public.flotilla_solicitudes            (folio FS-0001…)
     · Tabla  public.flotilla_solicitud_evidencias   (una fila por foto/video)
     · Storage flotilla-fotos   → fotos (4 principales + adicionales)
     · Storage flotilla-videos  → videos en calidad original, sin comprimir
   Nada de esto toca Firebase.

   Se conecta como rol anon (mismo esquema que surtidos-supabase.js).
   Los videos grandes (> 6 MB) se suben por partes con TUS: si la señal
   se cae, la subida continúa donde se quedó en vez de empezar de cero.

   Expone window.tcFlSb.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  const SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnlqb3Flc3N4Y21rZWpjdWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjMzODcsImV4cCI6MjEwMTY5OTM4N30.T8rODqxRoj5HhDmvvDy9LtBBJS-fQZJRFLV3Mn10b_4';

  const BUCKET_FOTOS  = 'flotilla-fotos';
  const BUCKET_VIDEOS = 'flotilla-videos';
  const T_SOL  = 'flotilla_solicitudes';
  const T_EVID = 'flotilla_solicitud_evidencias';
  const T_SEG  = 'flotilla_solicitud_seguimiento';
  const T_PROV = 'flotilla_solicitud_proveedores';
  const T_VEST = 'flotilla_vehiculo_estado';
  const ESTADOS_CERRADOS = ['Cerrada','Rechazada','Cancelada'];
  const ESTADOS_TALLER = ['Servicio','Pagos','Cierre'];

  const TUS_UMBRAL = 6 * 1024 * 1024;   // arriba de esto se usa subida reanudable
  const TUS_CHUNK  = 6 * 1024 * 1024;   // Supabase exige bloques de exactamente 6 MB
  const TUS_LIB    = 'https://cdn.jsdelivr.net/npm/tus-js-client@4.3.1/dist/tus.min.js';
  const FIRMA_SEG  = 6 * 60 * 60;       // ligas firmadas válidas 6 horas

  function hdr(extra){
    return Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, extra || {});
  }

  function rutaUrl(path){
    return String(path).split('/').map(encodeURIComponent).join('/');
  }

  async function leerError(r){
    let txt = '';
    try { txt = await r.text(); } catch(e) {}
    let msg = txt;
    try { const j = JSON.parse(txt); msg = j.message || j.error || j.msg || txt; } catch(e) {}
    return new Error('Supabase ' + r.status + (msg ? ': ' + msg : ''));
  }

  async function rest(path, opts){
    opts = opts || {};
    const r = await fetch(SB_URL + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: hdr(Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {})),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!r.ok) throw await leerError(r);
    const txt = await r.text();
    return txt ? JSON.parse(txt) : null;
  }

  // ── Subida simple (fotos y archivos chicos) ──
  async function subirSimple(bucket, path, blob, contentType, onProgress){
    const r = await fetch(SB_URL + '/storage/v1/object/' + bucket + '/' + rutaUrl(path), {
      method: 'POST',
      headers: hdr({ 'Content-Type': contentType || blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '3600' }),
      body: blob,
    });
    if (!r.ok) throw await leerError(r);
    if (onProgress) onProgress(blob.size, blob.size);
    return path;
  }

  // ── Librería TUS (se carga solo cuando hay un video grande) ──
  let _tusProm = null;
  function cargarTus(){
    if (window.tus && window.tus.Upload) return Promise.resolve(window.tus);
    if (_tusProm) return _tusProm;
    _tusProm = new Promise(function(res, rej){
      const s = document.createElement('script');
      s.src = TUS_LIB;
      s.async = true;
      s.onload = function(){ (window.tus && window.tus.Upload) ? res(window.tus) : rej(new Error('TUS no disponible')); };
      s.onerror = function(){ _tusProm = null; rej(new Error('No se pudo cargar TUS')); };
      document.head.appendChild(s);
    });
    return _tusProm;
  }

  // ── Subida reanudable por partes (videos grandes) ──
  function subirReanudable(tus, bucket, path, blob, contentType, onProgress){
    return new Promise(function(res, rej){
      const up = new tus.Upload(blob, {
        endpoint: SB_URL + '/storage/v1/upload/resumable',
        retryDelays: [0, 3000, 5000, 10000, 20000, 30000, 60000],
        headers: { authorization: 'Bearer ' + SB_KEY, apikey: SB_KEY, 'x-upsert': 'true' },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: TUS_CHUNK,
        metadata: {
          bucketName: bucket,
          objectName: path,
          contentType: contentType || blob.type || 'application/octet-stream',
          cacheControl: '3600',
        },
        onError: function(err){ rej(err instanceof Error ? err : new Error(String(err))); },
        onProgress: function(enviados, total){ if (onProgress) onProgress(enviados, total); },
        onSuccess: function(){ res(path); },
      });
      up.findPreviousUploads().then(function(previos){
        if (previos && previos.length) up.resumeFromPreviousUpload(previos[0]);
        up.start();
      }).catch(function(){ up.start(); });
    });
  }

  async function subirArchivo(bucket, path, blob, contentType, onProgress){
    if (blob.size > TUS_UMBRAL){
      let tus = null;
      try { tus = await cargarTus(); } catch(e) { console.warn('[tcFlSb] TUS no cargó, se usa subida simple', e); }
      if (tus) return subirReanudable(tus, bucket, path, blob, contentType, onProgress);
    }
    return subirSimple(bucket, path, blob, contentType, onProgress);
  }

  // ── Ligas firmadas (los espacios son privados) ──
  async function firmarUrls(bucket, paths, segundos){
    const lista = (paths || []).filter(Boolean);
    if (!lista.length) return {};
    const r = await fetch(SB_URL + '/storage/v1/object/sign/' + bucket, {
      method: 'POST',
      headers: hdr({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: segundos || FIRMA_SEG, paths: lista }),
    });
    if (!r.ok) throw await leerError(r);
    const arr = await r.json();
    const out = {};
    (arr || []).forEach(function(x){
      if (x && x.signedURL && !x.error) out[x.path] = SB_URL + '/storage/v1' + x.signedURL;
    });
    return out;
  }

  // ── Solicitudes ──
  // Idempotente: si la solicitud ya existe (reintento), no se duplica.
  async function crearSolicitud(row){
    const res = await rest(T_SOL + '?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=ignore-duplicates' },
      body: row,
    });
    if (Array.isArray(res) && res.length) return res[0];
    const ya = await rest(T_SOL + '?id=eq.' + encodeURIComponent(row.id) + '&select=*');
    return (ya && ya[0]) || null;
  }

  async function registrarEvidencias(rows){
    if (!rows || !rows.length) return;
    await rest(T_EVID + '?on_conflict=solicitud_id,ruta', {
      method: 'POST',
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: rows,
    });
  }

  // Convierte una fila de Supabase a la misma forma que ya usa la app
  // (evidencias = arreglo de ligas, evidenciasMeta = arreglo de meta, etc.)
  function aFormaApp(row, firmas){
    const d = row.datos || {};
    const ev = (row.flotilla_solicitud_evidencias || []).slice();
    const ordenPos = { frente: 0, trasera: 1, derecho: 2, izquierdo: 3 };
    ev.sort(function(a, b){
      if (a.categoria !== b.categoria) return a.categoria === 'principal' ? -1 : 1;
      if (a.categoria === 'principal') return (ordenPos[a.posicion] || 0) - (ordenPos[b.posicion] || 0);
      return String(a.creado_en || '').localeCompare(String(b.creado_en || ''));
    });
    const url = function(e){ return (firmas[e.bucket] || {})[e.ruta] || ''; };
    const servicio = ev.filter(function(e){ return e.categoria === 'servicio'; });
    const deSol = ev.filter(function(e){ return e.categoria !== 'servicio'; });
    const fotos = deSol.filter(function(e){ return e.medio === 'foto'; });
    const videos = deSol.filter(function(e){ return e.medio === 'video'; });
    const seg = (row[T_SEG] || []).slice().sort(function(a, b){ return String(a.creado_en).localeCompare(String(b.creado_en)); });
    return Object.assign({}, d, {
      id: row.id,
      folio: row.folio || '',
      estatus: row.estado || d.estatus || 'Solicitud',
      creadoEn: d.creadoEn || row.creado_en,
      evidencias: (d.evidencias || []).concat(fotos.map(url)),
      evidenciasMeta: (d.evidenciasMeta || []).concat(fotos.map(function(e){ return Object.assign({}, e.meta || {}, { nota: e.nota || '', categoria: e.categoria, posicion: e.posicion || null }); })),
      videos: videos.map(function(e){ return { url: url(e), nota: e.nota || '', mime: e.mime || '', tamano: e.tamano_bytes || 0, meta: e.meta || {} }; }),
      evidenciasServicio: servicio.map(function(e){ return { url: url(e), medio: e.medio, nota: e.nota || '', mime: e.mime || '', tamano: e.tamano_bytes || 0, meta: e.meta || {}, seguimientoId: e.seguimiento_id || null, creadoEn: e.creado_en }; }),
      seguimiento: seg,
      tallerInterno: !!row.taller_interno,
      tallerExterno: !!row.taller_externo,
      costoTotal: Number(row.costo_total) || 0,
      liberadoPor: row.liberado_por || '',
      liberadoEn: row.liberado_en || '',
      enTaller: ESTADOS_TALLER.indexOf(row.estado) >= 0 && !row.liberado_en,
      eco: row.eco,
      _sb: true,
    });
  }

  async function consultar(filtro, limite){
    const rows = await rest(T_SOL + '?' + (filtro ? filtro + '&' : '') + 'select=*,' + T_EVID + '(*),' + T_SEG + '(*)&order=creado_en.desc&limit=' + (limite || 20)) || [];
    const porBucket = {};
    rows.forEach(function(r){
      (r[T_EVID] || []).forEach(function(e){ (porBucket[e.bucket] = porBucket[e.bucket] || []).push(e.ruta); });
    });
    const firmas = {};
    await Promise.all(Object.keys(porBucket).map(async function(b){
      try { firmas[b] = await firmarUrls(b, porBucket[b]); } catch(e) { console.warn('[tcFlSb] firmar', b, e); firmas[b] = {}; }
    }));
    return rows.map(function(r){ return aFormaApp(r, firmas); });
  }

  async function misSolicitudes(opts){
    opts = opts || {};
    if (opts.eco) return consultar('eco=eq.' + encodeURIComponent(String(opts.eco)), opts.limit);
    if (opts.email) return consultar('creado_por=eq.' + encodeURIComponent(String(opts.email)), opts.limit);
    return [];
  }

  // Todas las solicitudes (seguimiento de servicio). abiertas=true → sin las cerradas.
  async function listarSolicitudes(opts){
    opts = opts || {};
    const filtro = opts.abiertas ? 'estado=not.in.(' + ESTADOS_CERRADOS.map(encodeURIComponent).join(',') + ')' : '';
    return consultar(filtro, opts.limit || 100);
  }

  async function agregarSeguimiento(row){
    const res = await rest(T_SEG, { method: 'POST', headers: { Prefer: 'return=representation' }, body: row });
    return res && res[0];
  }

  async function actualizarSolicitud(id, cambios){
    const res = await rest(T_SOL + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: cambios });
    return res && res[0];
  }

  async function estadoVehiculo(eco){
    if (!eco) return null;
    const res = await rest(T_VEST + '?eco=eq.' + encodeURIComponent(String(eco)) + '&select=*');
    return (res && res[0]) || null;
  }

  window.tcFlSb = {
    BUCKET_FOTOS: BUCKET_FOTOS,
    BUCKET_VIDEOS: BUCKET_VIDEOS,
    subirArchivo: subirArchivo,
    firmarUrls: firmarUrls,
    crearSolicitud: crearSolicitud,
    registrarEvidencias: registrarEvidencias,
    misSolicitudes: misSolicitudes,
    listarSolicitudes: listarSolicitudes,
    agregarSeguimiento: agregarSeguimiento,
    actualizarSolicitud: actualizarSolicitud,
    estadoVehiculo: estadoVehiculo,
    ESTADOS_CERRADOS: ESTADOS_CERRADOS,
    ESTADOS_TALLER: ESTADOS_TALLER,
    _rest: rest, _hdr: hdr, _url: SB_URL, _firmar: firmarUrls, _consultar: consultar,
    aFormaApp: aFormaApp,
  };
  console.log('[tcFlSb] Puente Flotilla → Supabase listo');
})();

/* ════════════════════════════════════════════════════════════════════
   PORTAL — adaptador Firestore → Supabase para flotilla_solicitudes
   ────────────────────────────────────────────────────────────────────
   flotilla.js sigue escribiendo fs.collection / fs.doc / fs.updateDoc…
   como siempre. window.tcFlSbShim(moduloFirestore) devuelve el mismo
   módulo, pero todo lo que apunte a flotilla_solicitudes (y sus
   subcolecciones adjuntos / archivos_evaluacion / archivos_servicio)
   se lee y escribe en Supabase. Lo demás sigue igual.
   ════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  const B = window.tcFlSb;
  if (!B) return;
  const rest = B._rest;
  const T_SOL = 'flotilla_solicitudes', T_EVID = 'flotilla_solicitud_evidencias', T_SEG = 'flotilla_solicitud_seguimiento',
        T_SUB = 'flotilla_sol_sub', T_PROV = 'flotilla_solicitud_proveedores', T_VEST = 'flotilla_vehiculo_estado', T_VEX = 'flotilla_vehiculo_extra';
  const SEL_SOL = '*,' + T_EVID + '(*),' + T_SEG + '(*)';
  const MARK = '__flSb';

  function nuevoId(){
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch(e) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c){ const r = Math.random()*16|0; return (c === 'x' ? r : (r&0x3|0x8)).toString(16); });
  }
  const q = function(v){ return '"' + String(v).replace(/"/g, '') + '"'; };
  const enc = encodeURIComponent;
  const quitarUndef = function(o){ return JSON.parse(JSON.stringify(o, function(k, v){ return v === undefined ? null : v; })); };

  // ── Firmas de ligas en caché (no volver a firmar cada vez) ──
  const _firmas = {};   // bucket|ruta → {url, vence}
  async function firmarCache(rows){
    const falta = {};
    const ahora = Date.now();
    rows.forEach(function(e){
      const k = e.bucket + '|' + e.ruta;
      if (!_firmas[k] || _firmas[k].vence < ahora + 30*60*1000) (falta[e.bucket] = falta[e.bucket] || []).push(e.ruta);
    });
    await Promise.all(Object.keys(falta).map(async function(b){
      try {
        const m = await B._firmar(b, falta[b]);
        Object.keys(m).forEach(function(r){ _firmas[b + '|' + r] = { url: m[r], vence: ahora + 5.5*3600*1000 }; });
      } catch(e) { console.warn('[tcFlSbShim] firmar', e); }
    }));
    const out = {};
    rows.forEach(function(e){ const f = _firmas[e.bucket + '|' + e.ruta]; if (f) (out[e.bucket] = out[e.bucket] || {})[e.ruta] = f.url; });
    return out;
  }
  // De una liga firmada sacar bucket/ruta
  function rutaDeUrl(u){
    const m = String(u || '').match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
    return m ? { bucket: m[1], ruta: decodeURIComponent(m[2]) } : null;
  }

  // ── Fila → documento con la forma que espera flotilla.js ──
  async function filaADoc(row){
    const firmas = await firmarCache(row[T_EVID] || []);
    const app = B.aFormaApp(row, firmas);
    const d = Object.assign({}, row.datos || {});
    const evSol = (row[T_EVID] || []).filter(function(e){ return e.categoria !== 'servicio' && e.medio === 'foto'; });
    Object.assign(d, {
      estatus: row.estado || d.estatus || 'Solicitud',
      folio: row.folio || '',
      vehiculoEco: row.eco || d.vehiculoEco || '',
      tallerInterno: !!row.taller_interno,
      tallerExterno: !!row.taller_externo,
      costoTotal: Number(row.costo_total) || 0,
      liberadoPor: row.liberado_por || '',
      liberadoEn: row.liberado_en || '',
      creadoEn: d.creadoEn || row.creado_en,
      videos: app.videos,
      evidenciasServicio: app.evidenciasServicio,
      seguimiento: app.seguimiento,
      _sb: true,
    });
    if (d.desc == null && d.descripcion != null) d.desc = d.descripcion;
    if (d.prior == null && d.prioridad != null) d.prior = d.prioridad;
    // Fotos en línea (registros viejos): se les agregan las de Storage.
    // Si no hay en línea, se dejan sin definir: flCargarEvidenciasSol las trae de adjuntos/fotos.
    if (Array.isArray(d.evidencias) && evSol.length){
      d.evidencias = d.evidencias.concat(evSol.map(function(e){ return (firmas[e.bucket] || {})[e.ruta] || ''; }));
      d.evidenciasMeta = (d.evidenciasMeta || []).concat(evSol.map(function(e){ return Object.assign({}, e.meta || {}, { nota: e.nota || '' }); }));
    }
    return d;
  }

  // Campos del documento que además viven en columnas
  function columnasDe(data, esNuevo){
    const c = {};
    const has = function(k){ return Object.prototype.hasOwnProperty.call(data, k); };
    if (has('estatus')) c.estado = data.estatus || 'Solicitud';
    if (has('vehiculoEco')) c.eco = String(data.vehiculoEco || '');
    if (has('vehiculoId')) c.vehiculo_id = data.vehiculoId || null;
    if (has('tipo')) c.tipo = data.tipo || null;
    if (has('descripcion')) c.descripcion = data.descripcion || null;
    else if (has('desc')) c.descripcion = data.desc || null;
    if (has('creadoPor')) c.creado_por = data.creadoPor || null;
    if (has('solicitante')) c.creado_por_nombre = data.solicitante || null;
    if (has('kilometrajeReportado')) c.km = Number(data.kilometrajeReportado) || null;
    if (has('tallerInterno')) c.taller_interno = !!data.tallerInterno;
    if (has('tallerExterno')) c.taller_externo = !!data.tallerExterno;
    if (has('liberadoPor')) c.liberado_por = data.liberadoPor || null;
    if (has('liberadoEn')) c.liberado_en = data.liberadoEn || null;
    if (esNuevo && has('creadoEn') && data.creadoEn && !isNaN(Date.parse(data.creadoEn))) c.creado_en = data.creadoEn;
    return c;
  }
  // Campos calculados que nunca se guardan dentro de datos
  const NO_DATOS = ['folio','costoTotal','videos','evidenciasServicio','seguimiento','_sb','liberadoPor','liberadoEn','tallerInterno','tallerExterno'];

  function esBorrar(v){ return v && typeof v === 'object' && v.__flSbDel; }

  // ── Fotos de la etapa Solicitud: reconciliar el arreglo que manda el portal ──
  async function reconciliarEvidencias(id, row, entrantes, entrantesMeta){
    entrantes = Array.isArray(entrantes) ? entrantes : [];
    entrantesMeta = Array.isArray(entrantesMeta) ? entrantesMeta : [];
    const datos = row.datos || {};
    const subRes = await rest(T_SUB + '?solicitud_id=eq.' + enc(id) + '&subcol=eq.adjuntos&doc_id=eq.fotos&select=data');
    const sub = subRes && subRes[0] ? subRes[0].data : null;
    const inl = Array.isArray(datos.evidencias) ? datos.evidencias : null;
    const set = new Set(entrantes);
    const filtrar = function(arr, metas){
      const a = [], m = [];
      (arr || []).forEach(function(x, i){ if (set.has(x)) { a.push(x); m.push((metas || [])[i] || null); } });
      return { a: a, m: m };
    };
    const cambios = {};
    if (inl){ const f = filtrar(inl, datos.evidenciasMeta); cambios.evidencias = f.a; cambios.evidenciasMeta = f.m; }
    if (sub && Array.isArray(sub.evidencias)){
      const f = filtrar(sub.evidencias, sub.evidenciasMeta);
      if (f.a.length !== sub.evidencias.length){
        await rest(T_SUB + '?solicitud_id=eq.' + enc(id) + '&subcol=eq.adjuntos&doc_id=eq.fotos', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { data: Object.assign({}, sub, { evidencias: f.a, evidenciasMeta: f.m }) } });
      }
    }
    // Fotos de Storage que ya no vienen → se quitan del registro
    const rutasEntrantes = new Set(entrantes.map(rutaDeUrl).filter(Boolean).map(function(r){ return r.ruta; }));
    const tabla = (row[T_EVID] || []).filter(function(e){ return e.categoria !== 'servicio' && e.medio === 'foto'; });
    for (const e of tabla){
      if (!rutasEntrantes.has(e.ruta)) await rest(T_EVID + '?id=eq.' + enc(e.id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
    // Fotos nuevas (base64) → Storage
    const viejas = new Set([].concat(inl || [], (sub && sub.evidencias) || []));
    const nuevas = [];
    for (let i = 0; i < entrantes.length; i++){
      const x = entrantes[i];
      if (typeof x !== 'string' || x.indexOf('data:') !== 0 || viejas.has(x)) continue;
      const blob = await (await fetch(x)).blob();
      const mime = blob.type || 'image/jpeg';
      const ext = mime.indexOf('png') >= 0 ? 'png' : mime.indexOf('webp') >= 0 ? 'webp' : 'jpg';
      const ruta = 'solicitudes/' + String(row.eco || 'sin-eco').replace(/[^A-Za-z0-9_-]/g, '') + '/' + id + '/portal-' + Date.now() + '-' + i + '.' + ext;
      await B.subirArchivo(B.BUCKET_FOTOS, ruta, blob, mime);
      nuevas.push({ solicitud_id: id, categoria: 'adicional', posicion: null, medio: 'foto', bucket: B.BUCKET_FOTOS, ruta: ruta, mime: mime, tamano_bytes: blob.size, nota: null, subido_por: (window.auth && window.auth.currentUser && window.auth.currentUser.email) || '', meta: entrantesMeta[i] || {} });
    }
    if (nuevas.length) await B.registrarEvidencias(nuevas);
    return cambios;
  }

  // ── Operaciones sobre el documento principal ──
  async function leerFila(id){
    const r = await rest(T_SOL + '?id=eq.' + enc(id) + '&select=' + SEL_SOL);
    return r && r[0] || null;
  }
  async function insertarSol(id, data, merge){
    const limpio = quitarUndef(data);
    NO_DATOS.forEach(function(k){ delete limpio[k]; });
    Object.keys(limpio).forEach(function(k){ if (esBorrar(data[k])) delete limpio[k]; });
    const row = Object.assign({ id: id, estado: 'Solicitud', datos: limpio }, columnasDe(data, true));
    if (merge){
      const ya = await leerFila(id);
      if (ya){ await actualizarSol(id, data); return; }
    }
    await rest(T_SOL + '?on_conflict=id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: row });
  }
  async function actualizarSol(id, data){
    const row = await leerFila(id);
    if (!row) throw new Error('La solicitud ' + id + ' no existe');
    let datos = Object.assign({}, row.datos || {});
    let patchDatos = Object.assign({}, data);
    if (Object.prototype.hasOwnProperty.call(data, 'evidencias') && !esBorrar(data.evidencias)){
      const c = await reconciliarEvidencias(id, row, data.evidencias, data.evidenciasMeta);
      delete patchDatos.evidencias; delete patchDatos.evidenciasMeta;
      if (c.evidencias){ patchDatos.evidencias = c.evidencias; patchDatos.evidenciasMeta = c.evidenciasMeta; }
    }
    Object.keys(patchDatos).forEach(function(k){
      if (NO_DATOS.indexOf(k) >= 0) return;
      if (esBorrar(patchDatos[k])) { delete datos[k]; return; }
      if (k.indexOf('.') > 0){ // 'a.b' estilo Firestore
        const partes = k.split('.'); let o = datos;
        for (let i = 0; i < partes.length - 1; i++){ o[partes[i]] = (o[partes[i]] && typeof o[partes[i]] === 'object') ? Object.assign({}, o[partes[i]]) : {}; o = o[partes[i]]; }
        o[partes[partes.length - 1]] = patchDatos[k];
        return;
      }
      datos[k] = patchDatos[k];
    });
    const body = Object.assign({ datos: quitarUndef(datos) }, columnasDe(data, false));
    await rest(T_SOL + '?id=eq.' + enc(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: body });
    registrarModificacion(id, row, data);
  }

  // Bitácora automática de modificaciones hechas desde el portal
  const NOMBRES = { estatus: 'Estatus', tallerNombre: 'Taller', montoCotizacion: 'Monto cotizado', tallerInterno: 'Taller interno', tallerExterno: 'Taller externo',
    fechaIngresoTaller: 'Ingreso a taller', fechaEntregaEstimada: 'Entrega estimada', fechaEntregaReal: 'Entrega real', fechaPago: 'Fecha de pago', prioridad: 'Prioridad',
    descripcion: 'Descripción', tipo: 'Tipo', comentarioRechazo: 'Motivo de rechazo', comentariosEvaluacion: 'Comentarios de evaluación', comentariosServicio: 'Comentarios de servicio',
    facturas: 'Facturas', pagoProgramado: 'Pago programado', evidencias: 'Evidencias', kilometrajeReportado: 'KM' };
  const IGNORAR = ['actualizadoEn', 'evidenciasMeta', 'archivosEvaluacion', 'archivosServicio'];
  function registrarModificacion(id, row, data){
    try {
      const antes = Object.assign({}, row.datos || {}, { estatus: row.estado, tallerInterno: row.taller_interno, tallerExterno: row.taller_externo });
      const partes = [];
      Object.keys(data).forEach(function(k){
        if (IGNORAR.indexOf(k) >= 0 || NO_DATOS.indexOf(k) >= 0 && k !== 'tallerInterno' && k !== 'tallerExterno') return;
        const nv = data[k], ov = antes[k];
        const nombre = NOMBRES[k] || k;
        if (esBorrar(nv)) { if (ov !== undefined) partes.push(nombre + ' eliminado'); return; }
        if (nv === null || ['string','number','boolean'].indexOf(typeof nv) >= 0){
          if (String(ov == null ? '' : ov) !== String(nv == null ? '' : nv)){
            const f = function(x){ return typeof x === 'boolean' ? (x ? 'sí' : 'no') : (x == null || x === '' ? '—' : String(x).slice(0, 80)); };
            partes.push(nombre + ': ' + f(ov) + ' → ' + f(nv));
          }
        } else if (JSON.stringify(nv) !== JSON.stringify(ov)) partes.push(nombre + ' actualizado');
      });
      if (!partes.length) return;
      const u = window.auth && window.auth.currentUser;
      rest(T_SEG, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { solicitud_id: id, tipo: 'modificacion', texto: partes.join(' · ').slice(0, 900),
        autor: (u && u.email) || '', autor_nombre: (u && (u.displayName || u.email)) || '', datos: { campos: Object.keys(data) } } }).catch(function(){});
    } catch(e) {}
  }

  // ── Subdocumentos ──
  async function leerSub(id, subcol, docId){
    const r = await rest(T_SUB + '?solicitud_id=eq.' + enc(id) + '&subcol=eq.' + enc(subcol) + '&doc_id=eq.' + enc(docId) + '&select=data');
    return r && r[0] ? r[0].data : null;
  }
  async function escribirSub(id, subcol, docId, data, merge){
    let final = quitarUndef(data);
    if (merge){ const ya = await leerSub(id, subcol, docId); if (ya) final = Object.assign({}, ya, final); }
    await rest(T_SUB + '?on_conflict=solicitud_id,subcol,doc_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: { solicitud_id: id, subcol: subcol, doc_id: docId, data: final } });
  }

  // adjuntos/fotos + fotos de Storage (las que suben la app y el portal)
  async function leerAdjuntosFotos(id){
    const sub = await leerSub(id, 'adjuntos', 'fotos');
    const row = await leerFila(id);
    const ev = row ? (row[T_EVID] || []).filter(function(e){ return e.categoria !== 'servicio' && e.medio === 'foto'; }) : [];
    if (!ev.length) return sub;
    const ordenPos = { frente: 0, trasera: 1, derecho: 2, izquierdo: 3 };
    ev.sort(function(a, b){
      if (a.categoria !== b.categoria) return a.categoria === 'principal' ? -1 : 1;
      if (a.categoria === 'principal') return (ordenPos[a.posicion] || 0) - (ordenPos[b.posicion] || 0);
      return String(a.creado_en).localeCompare(String(b.creado_en));
    });
    const firmas = await firmarCache(ev);
    const base = Object.assign({}, sub || {});
    base.evidencias = (base.evidencias || []).concat(ev.map(function(e){ return (firmas[e.bucket] || {})[e.ruta] || ''; }));
    base.evidenciasMeta = (base.evidenciasMeta || []).concat(ev.map(function(e){ return Object.assign({}, e.meta || {}, { nota: e.nota || '' }); }));
    return base;
  }

  // ── Snapshots con la forma de Firestore ──
  function docSnap(ref, data){
    return { id: ref.id, ref: ref, exists: function(){ return data != null; }, data: function(){ return data == null ? undefined : Object.assign({}, data); }, get: function(k){ return data ? data[k] : undefined; } };
  }
  function querySnap(docs){
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function(fn){ docs.forEach(fn); }, docChanges: function(){ return docs.map(function(d){ return { type: 'added', doc: d }; }); } };
  }

  // ── Consulta de la colección de solicitudes (where/orderBy/limit) ──
  const COL = { estatus: 'estado', vehiculoEco: 'eco', vehiculoId: 'vehiculo_id', tipo: 'tipo', creadoPor: 'creado_por', creadoEn: 'creado_en', id: 'id' };
  function filtroDe(c){
    const campo = COL[c.f] || ('datos->>' + c.f);
    const v = c.v;
    switch (c.op){
      case '==': return campo + '=eq.' + enc(v);
      case '!=': return campo + '=neq.' + enc(v);
      case '<': return campo + '=lt.' + enc(v);
      case '<=': return campo + '=lte.' + enc(v);
      case '>': return campo + '=gt.' + enc(v);
      case '>=': return campo + '=gte.' + enc(v);
      case 'in': return campo + '=in.(' + (v || []).map(q).map(enc).join(',') + ')';
      case 'not-in': return campo + '=not.in.(' + (v || []).map(q).map(enc).join(',') + ')';
      case 'array-contains': return 'datos->' + c.f + '=cs.' + enc(JSON.stringify([v]));
      default: return '';
    }
  }
  async function consultarSols(ref){
    const partes = ['select=' + SEL_SOL];
    let orden = 'creado_en.desc', lim = '';
    (ref.cons || []).forEach(function(c){
      if (c.t === 'where'){ const f = filtroDe(c); if (f) partes.push(f); }
      else if (c.t === 'orderBy') orden = (COL[c.f] || ('datos->>' + c.f)) + '.' + (c.d === 'desc' ? 'desc' : 'asc');
      else if (c.t === 'limit') lim = 'limit=' + c.n;
    });
    partes.push('order=' + orden);
    if (lim) partes.push(lim);
    const rows = await rest(T_SOL + '?' + partes.join('&')) || [];
    const docs = [];
    for (const r of rows) docs.push(docSnap(refDoc([T_SOL, r.id]), await filaADoc(r)));
    return querySnap(docs);
  }

  // ── "Tiempo real": revisa cada 15 s qué cambió y solo baja eso ──
  const listeners = new Set();
  const cache = new Map();   // id → {act, data}
  let _timer = null, _corriendo = false, _pendiente = false, _primera = true;
  window.flSbVehEstado = window.flSbVehEstado || {};
  window.flSbVehExtra = window.flSbVehExtra || {};
  async function refrescar(){
    if (_corriendo){ _pendiente = true; return; }
    _corriendo = true;
    try {
      let lite = [];
      for (let off = 0; ; off += 1000){
        const pag = await rest(T_SOL + '?select=id,actualizado_en&order=id.asc&limit=1000&offset=' + off) || [];
        lite = lite.concat(pag);
        if (pag.length < 1000) break;
      }
      const vivos = new Set(lite.map(function(r){ return r.id; }));
      let hubo = _primera;
      Array.from(cache.keys()).forEach(function(id){ if (!vivos.has(id)){ cache.delete(id); hubo = true; } });
      const cambiados = lite.filter(function(r){ const c = cache.get(r.id); return !c || c.act !== r.actualizado_en; });
      for (let i = 0; i < cambiados.length; i += 60){
        const lote = cambiados.slice(i, i + 60);
        const rows = await rest(T_SOL + '?id=in.(' + lote.map(function(r){ return enc(q(r.id)); }).join(',') + ')&select=' + SEL_SOL) || [];
        for (const r of rows) cache.set(r.id, { act: r.actualizado_en, data: await filaADoc(r) });
        hubo = true;
      }
      try {
        const est = await rest(T_VEST + '?select=*') || [];
        const m = {}; est.forEach(function(e){ m[String(e.eco)] = e; });
        if (JSON.stringify(m) !== JSON.stringify(window.flSbVehEstado)){ window.flSbVehEstado = m; hubo = true; }
        const ex = await rest(T_VEX + '?select=*') || [];
        const mx = {}; ex.forEach(function(e){ mx[String(e.eco)] = e; });
        window.flSbVehExtra = mx;
      } catch(e) {}
      _primera = false;
      if (hubo){
        const docs = Array.from(cache.entries()).map(function(kv){ return docSnap(refDoc([T_SOL, kv[0]]), kv[1].data); });
        const snap = querySnap(docs);
        listeners.forEach(function(l){ try { l.next(snap); } catch(e) { console.error('[tcFlSbShim] listener', e); } });
      }
    } catch(e) {
      console.warn('[tcFlSbShim] refrescar', e);
      listeners.forEach(function(l){ if (_primera && l.error) try { l.error(e); } catch(x) {} });
    }
    _corriendo = false;
    if (_pendiente){ _pendiente = false; refrescar(); }
  }
  let _deb = null;
  function refrescarPronto(){ clearTimeout(_deb); _deb = setTimeout(refrescar, 250); }
  function suscribir(next, error){
    const l = { next: next, error: error };
    listeners.add(l);
    if (!_timer) _timer = setInterval(refrescar, 15000);
    if (cache.size && !_primera){
      const docs = Array.from(cache.entries()).map(function(kv){ return docSnap(refDoc([T_SOL, kv[0]]), kv[1].data); });
      setTimeout(function(){ next(querySnap(docs)); }, 0);
    } else refrescar();
    return function(){ listeners.delete(l); if (!listeners.size && _timer){ clearInterval(_timer); _timer = null; } };
  }

  // ── Referencias ──
  function refCol(segs){ return { [MARK]: true, kind: 'col', segs: segs, cons: [], id: segs[segs.length - 1], path: segs.join('/') }; }
  function refDoc(segs){ return { [MARK]: true, kind: 'doc', segs: segs, id: segs[segs.length - 1], path: segs.join('/') }; }
  const esSb = function(x){ return !!(x && x[MARK]); };

  async function getDoc(r){
    const s = r.segs;
    if (s.length === 2){ const row = await leerFila(s[1]); return docSnap(r, row ? await filaADoc(row) : null); }
    if (s.length === 4){
      const data = (s[2] === 'adjuntos' && s[3] === 'fotos') ? await leerAdjuntosFotos(s[1]) : await leerSub(s[1], s[2], s[3]);
      return docSnap(r, data);
    }
    throw new Error('Ruta no soportada: ' + r.path);
  }
  async function getDocs(r){
    const s = r.segs;
    if (s.length === 1) return consultarSols(r);
    if (s.length === 3){
      const rows = await rest(T_SUB + '?solicitud_id=eq.' + enc(s[1]) + '&subcol=eq.' + enc(s[2]) + '&select=doc_id,data&order=creado_en.asc') || [];
      return querySnap(rows.map(function(x){ return docSnap(refDoc([s[0], s[1], s[2], x.doc_id]), x.data); }));
    }
    throw new Error('Ruta no soportada: ' + r.path);
  }
  async function addDoc(c, data){
    const id = nuevoId();
    const ref = refDoc(c.segs.concat([id]));
    await setDoc(ref, data);
    return ref;
  }
  async function setDoc(r, data, opts){
    const s = r.segs, merge = !!(opts && opts.merge);
    if (s.length === 2) await insertarSol(s[1], data, merge);
    else if (s.length === 4) await escribirSub(s[1], s[2], s[3], data, merge);
    else throw new Error('Ruta no soportada: ' + r.path);
    refrescarPronto();
  }
  async function updateDoc(r, data){
    if (typeof data === 'string'){ // updateDoc(ref, 'campo', valor, …)
      const args = Array.prototype.slice.call(arguments, 1), o = {};
      for (let i = 0; i < args.length; i += 2) o[args[i]] = args[i + 1];
      data = o;
    }
    const s = r.segs;
    if (s.length === 2) await actualizarSol(s[1], data);
    else if (s.length === 4){
      const ya = await leerSub(s[1], s[2], s[3]);
      if (!ya) throw new Error('No existe ' + r.path);
      const nuevo = Object.assign({}, ya);
      Object.keys(data).forEach(function(k){ if (esBorrar(data[k])) delete nuevo[k]; else nuevo[k] = data[k]; });
      await escribirSub(s[1], s[2], s[3], nuevo, false);
    } else throw new Error('Ruta no soportada: ' + r.path);
    refrescarPronto();
  }
  async function deleteDoc(r){
    const s = r.segs;
    if (s.length === 2) await rest(T_SOL + '?id=eq.' + enc(s[1]), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    else if (s.length === 4) await rest(T_SUB + '?solicitud_id=eq.' + enc(s[1]) + '&subcol=eq.' + enc(s[2]) + '&doc_id=eq.' + enc(s[3]), { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    else throw new Error('Ruta no soportada: ' + r.path);
    refrescarPronto();
  }
  function onSnapshot(r, next, error){
    if (r.segs.length === 1 && !(r.cons || []).length){
      if (typeof next === 'object' && next) return suscribir(next.next.bind(next), next.error && next.error.bind(next));
      return suscribir(next, error);
    }
    // Consultas con filtros o un solo documento: se resuelven cada 15 s
    let vivo = true;
    const tick = async function(){
      if (!vivo) return;
      try { next(r.kind === 'doc' ? await getDoc(r) : await getDocs(r)); } catch(e) { if (error) error(e); }
    };
    tick();
    const t = setInterval(tick, 15000);
    return function(){ vivo = false; clearInterval(t); };
  }

  window.tcFlSbShim = function(F, opciones){
    if (!F || F.__flSbShim) return F;
    const SOLS = (opciones && opciones.SOLS) || T_SOL;
    const S = Object.assign({}, F);
    S.__flSbShim = true;
    S.collection = function(base){
      const p = Array.prototype.slice.call(arguments, 1);
      if (esSb(base)) return refCol(base.segs.concat(p));
      if (p[0] === SOLS) return p.length === 1 ? refCol([T_SOL]) : refCol([T_SOL].concat(p.slice(1)));
      return F.collection.apply(null, arguments);
    };
    S.doc = function(base){
      const p = Array.prototype.slice.call(arguments, 1);
      if (esSb(base)){ const segs = base.segs.concat(p); if (!p.length && base.kind === 'col') segs.push(nuevoId()); return refDoc(segs); }
      if (p[0] === SOLS) return refDoc([T_SOL].concat(p.length === 1 ? [nuevoId()] : p.slice(1)));
      return F.doc.apply(null, arguments);
    };
    const anotar = function(c, a){ try { Object.defineProperty(c, '__flSbC', { value: a }); } catch(e) {} return c; };
    S.where = function(f, op, v){ return anotar(F.where(f, op, v), { t: 'where', f: f, op: op, v: v }); };
    S.orderBy = function(f, d){ return anotar(F.orderBy(f, d), { t: 'orderBy', f: f, d: d }); };
    S.limit = function(n){ return anotar(F.limit(n), { t: 'limit', n: n }); };
    S.query = function(ref){
      const cons = Array.prototype.slice.call(arguments, 1);
      if (esSb(ref)) return Object.assign({}, ref, { cons: (ref.cons || []).concat(cons.map(function(c){ return c && c.__flSbC; }).filter(Boolean)) });
      return F.query.apply(null, arguments);
    };
    S.deleteField = function(){ const x = F.deleteField(); try { Object.defineProperty(x, '__flSbDel', { value: true }); } catch(e) {} return x; };
    S.getDoc = function(r){ return esSb(r) ? getDoc(r) : F.getDoc(r); };
    S.getDocs = function(r){ return esSb(r) ? getDocs(r) : F.getDocs(r); };
    S.addDoc = function(c, d){ return esSb(c) ? addDoc(c, d) : F.addDoc(c, d); };
    S.setDoc = function(r, d, o){ return esSb(r) ? setDoc(r, d, o) : F.setDoc(r, d, o); };
    S.updateDoc = function(r){ return esSb(r) ? updateDoc.apply(null, arguments) : F.updateDoc.apply(null, arguments); };
    S.deleteDoc = function(r){ return esSb(r) ? deleteDoc(r) : F.deleteDoc(r); };
    S.onSnapshot = function(r){ return esSb(r) ? onSnapshot.apply(null, arguments) : F.onSnapshot.apply(null, arguments); };
    return S;
  };
  window.tcFlSbRefrescar = refrescar;

  // ── Proveedores / facturación por solicitud ──
  B.listarProveedores = async function(solId){ return await rest(T_PROV + '?solicitud_id=eq.' + enc(solId) + '&select=*&order=creado_en.asc') || []; };
  B.proveedoresDe = async function(ids){
    if (!ids || !ids.length) return [];
    let out = [];
    for (let i = 0; i < ids.length; i += 80){
      const lote = ids.slice(i, i + 80);
      out = out.concat(await rest(T_PROV + '?solicitud_id=in.(' + lote.map(function(x){ return enc(q(x)); }).join(',') + ')&select=*&order=creado_en.asc') || []);
    }
    return out;
  };
  B.guardarProveedor = async function(p){
    const body = Object.assign({}, p, { actualizado_en: new Date().toISOString() });
    if (p.id){
      const id = p.id; delete body.id;
      await rest(T_PROV + '?id=eq.' + enc(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: body });
    } else await rest(T_PROV, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: body });
    refrescarPronto();
  };
  B.borrarProveedor = async function(id){ await rest(T_PROV + '?id=eq.' + enc(id), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); refrescarPronto(); };

  // ── Datos extra por vehículo ──
  B.guardarVehiculoExtra = async function(eco, datos){
    await rest(T_VEX + '?on_conflict=eco', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
      body: Object.assign({ eco: String(eco) }, datos, { actualizado_en: new Date().toISOString() }) });
    window.flSbVehExtra[String(eco)] = Object.assign({}, window.flSbVehExtra[String(eco)] || {}, datos, { eco: String(eco) });
  };

  // ── Copia única de Firestore → Supabase (solicitudes históricas) ──
  // Uso en la consola del portal: tcMigrarFlotillaSols()
  window.tcMigrarFlotillaSols = async function(){
    const F = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const db = window.db;
    if (!db) throw new Error('Entra primero al portal');
    console.log('[migración] leyendo flotilla_solicitudes de Firestore…');
    const snap = await F.getDocs(F.collection(db, 'flotilla_solicitudes'));
    const docs = snap.docs.map(function(d){ return { id: d.id, data: d.data() }; });
    docs.sort(function(a, b){ return String(a.data.creadoEn || '').localeCompare(String(b.data.creadoEn || '')); });
    console.log('[migración]', docs.length, 'solicitudes');
    let ok = 0, fallo = 0;
    for (const d of docs){
      try {
        const data = quitarUndef(d.data);
        const row = Object.assign({ id: d.id, estado: data.estatus || 'Solicitud', datos: data }, columnasDe(data, true));
        if (!row.eco) row.eco = String(data.vehiculoEco || '');
        await rest(T_SOL + '?on_conflict=id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: row });
        // Subcolecciones conocidas
        const subs = [];
        try { const a = await F.getDoc(F.doc(db, 'flotilla_solicitudes', d.id, 'adjuntos', 'fotos')); if (a.exists()) subs.push({ subcol: 'adjuntos', doc_id: 'fotos', data: quitarUndef(a.data()) }); } catch(e) {}
        for (const sc of ['archivos_evaluacion', 'archivos_servicio']){
          try { const ss = await F.getDocs(F.collection(db, 'flotilla_solicitudes', d.id, sc)); ss.docs.forEach(function(x){ subs.push({ subcol: sc, doc_id: x.id, data: quitarUndef(x.data()) }); }); } catch(e) {}
        }
        for (const sb of subs){
          await rest(T_SUB + '?on_conflict=solicitud_id,subcol,doc_id', { method: 'POST', headers: { Prefer: 'return=minimal,resolution=merge-duplicates' }, body: Object.assign({ solicitud_id: d.id }, sb) });
        }
        ok++;
        if (ok % 10 === 0) console.log('[migración]', ok, '/', docs.length);
      } catch(e) { fallo++; console.error('[migración] falló', d.id, e); }
    }
    console.log('[migración] terminado:', ok, 'copiadas,', fallo, 'con error');
    refrescar();
    return { ok: ok, fallo: fallo, total: docs.length };
  };

  console.log('[tcFlSbShim] Adaptador de solicitudes → Supabase listo');
})();
