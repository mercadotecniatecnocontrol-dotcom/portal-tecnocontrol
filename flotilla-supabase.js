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
  const ESTADOS_CERRADOS = ['Cerrada','Completada','Finalizada','Liberada','Rechazada','Cancelada'];

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
      evidencias: fotos.map(url),
      evidenciasMeta: fotos.map(function(e){ return Object.assign({}, e.meta || {}, { nota: e.nota || '', categoria: e.categoria, posicion: e.posicion || null }); }),
      videos: videos.map(function(e){ return { url: url(e), nota: e.nota || '', mime: e.mime || '', tamano: e.tamano_bytes || 0, meta: e.meta || {} }; }),
      evidenciasServicio: servicio.map(function(e){ return { url: url(e), medio: e.medio, nota: e.nota || '', mime: e.mime || '', tamano: e.tamano_bytes || 0, meta: e.meta || {}, seguimientoId: e.seguimiento_id || null, creadoEn: e.creado_en }; }),
      seguimiento: seg,
      tallerInterno: !!row.taller_interno,
      tallerExterno: !!row.taller_externo,
      costoTotal: Number(row.costo_total) || 0,
      liberadoPor: row.liberado_por || '',
      liberadoEn: row.liberado_en || '',
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
    aFormaApp: aFormaApp,
  };
  console.log('[tcFlSb] Puente Flotilla → Supabase listo');
})();
