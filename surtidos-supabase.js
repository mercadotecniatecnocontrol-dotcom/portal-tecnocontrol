// ═══════════════════════════════════════════════════════════════════════
//  surtidos-supabase.js — Portal Operativo Tecnocontrol
// ═══════════════════════════════════════════════════════════════════════
//  Reemplaza el acceso a Firestore para la colección `surtidos` (y sus
//  antiguas subcolecciones: documentos, evidencias, historial, adjuntos)
//  por las tablas equivalentes en Supabase.
//
//  Expone funciones con el mismo espíritu que ya usaba almacen.js vía
//  cargarFirestore(), pero apuntando a Supabase — así los cambios dentro
//  de almacen.js quedan como reemplazos pequeños y localizados, en vez de
//  reescribir toda la lógica de negocio.
//
//  Todo lo que NO es `surtidos` (puntos_referencia, estaciones_servicio,
//  etc.) sigue viviendo en Firestore por ahora — este archivo no los toca.
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var SUPABASE_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  // Llave pública ("Publishable key") — segura de exponer en el navegador,
  // el acceso real lo controla Row Level Security en la base de datos.
  var SUPABASE_ANON_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';

  var _clientePromesa = null;
  function cargarSupabase() {
    if (_clientePromesa) return _clientePromesa;
    _clientePromesa = import('https://esm.sh/@supabase/supabase-js@2').then(function (mod) {
      var cliente = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.tcSupabase = cliente; // disponible globalmente por si otro módulo lo necesita
      return cliente;
      // Nota: ya no se intenta iniciar sesión anónima aquí — desde que las
      // políticas de seguridad permiten escribir con el rol "anon" (ver
      // migración 0006), no hace falta, y el intento fallaba siempre con un
      // error 500 ajeno a nuestro código (revisar Postgres Logs cuando haya
      // tiempo, probablemente un trigger de otra app en el mismo proyecto).
      //
      // REVERTIDO (21-sep-2026): se probó mandar el ID token de Firebase
      // como accessToken (para que auth.jwt() funcionara en RLS de
      // Fundación) y causó "canceling statement due to statement timeout"
      // en TODAS las consultas de Supabase, incluida la TV de Almacén —
      // quedó fuera de servicio unos minutos. No se vuelve a intentar
      // hasta diagnosticar la causa exacta con calma (probablemente la
      // validación del JWT de Firebase contra el JWKS es lenta o se
      // reintenta en cada request, no algo puntual de una tabla).
    }).catch(function (err) {
      // Si falla la carga (red/CDN), NO dejar la promesa rechazada en caché:
      // el siguiente intento vuelve a probar en vez de fallar para siempre.
      _clientePromesa = null;
      throw err;
    });
    return _clientePromesa;
  }

  // ── Conversión de nombres de columnas (snake_case) ↔ campos que ya
  //    espera el resto del código (camelCase, mismos nombres que traía
  //    Firestore) — así almacen.js casi no necesita cambiar su forma de
  //    leer los datos, solo de dónde vienen. ──
  function filaASurtido(row) {
    if (!row) return null;
    var base = row.extra && typeof row.extra === 'object' ? Object.assign({}, row.extra) : {};
    return Object.assign(base, {
      id: row.id,
      folio: row.folio || '—', cliente: row.cliente || '', vendedor: row.vendedor || '',
      prioridad: row.prioridad || 'normal', estado: row.estado || 'pendiente',
      productos: Array.isArray(row.productos) ? row.productos : [],
      check: row.check || {},
      tipo: row.tipo || 'venta', firma: row.firma || '', fechaEntrega: row.fecha_entrega || '',
      recibioNombre: row.recibio_nombre || '', firmaEntrega: row.firma_entrega || '',
      entregaPendienteFirma: !!row.entrega_pendiente_firma,
      cotizacionOrigen: row.cotizacion_origen || '', motivoCancelacion: row.motivo_cancelacion || '',
      destinoTipo: row.destino_tipo || '', destinoPaqueteria: row.destino_paqueteria || '', destinoGuia: row.destino_guia || '',
      destinoDireccion: row.destino_direccion || '', destinoAlmacenOrigen: row.destino_almacen_origen || '', destinoAlmacenDestino: row.destino_almacen_destino || '',
      destino: row.destino || '',
      tienePdfOriginal: !!row.tiene_pdf_original, numOrdenesCompra: Number(row.num_ordenes_compra) || 0,
      caratulaEnvio: row.caratula_envio || null,
      entregaObservaciones: row.entrega_observaciones || '',
      entregadoEn: row.entregado_en ? new Date(row.entregado_en).getTime() : 0,
      comentariosAlmacen: row.comentarios_almacen || '',
      solicitante: row.solicitante || '', area: row.area || '', uso: row.uso || '', destinoKiosco: row.destino || '',
      folioServicio: row.folio_servicio || '', origen: row.origen || '',
      tecnicoId: row.tecnico_id || '', tecnicoNumero: row.tecnico_numero || '', tecnicoNombre: row.tecnico_nombre || '',
      folioNum: row.folio_num || '', folioPrefijo: row.folio_prefijo || '',
      remisionado: !!row.remisionado, remisionadoPor: row.remisionado_por || '',
      remisionadoPorEmail: row.remisionado_por_email || '', remisionadoEn: row.remisionado_en,
      remisionAspelFolio: row.remision_aspel_folio || '', remisionAspelFecha: row.remision_aspel_fecha || '',
      solicitanteEmail: row.solicitante_email || '',
      almacen: row.almacen || '', entrega: row.entrega || '', total: row.total || '', creadoPor: row.creado_por || '',
      eliminada: !!row.eliminada, fechaEliminacion: row.fecha_eliminacion || null, usuarioElimino: row.usuario_elimino || null,
      motivoEliminacion: row.motivo_eliminacion || null, fechaProgramadaEliminacion: row.fecha_programada_eliminacion || null,
      solicitanteTecnicoId: row.solicitante_tecnico_id || null, solicitaParaSiMismo: !!row.solicita_para_si_mismo,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : 0,
    });
  }

  // Convierte un objeto de cambios en camelCase (como los mandaba el
  // código viejo a fs.updateDoc) al formato snake_case de la tabla.
  var MAPA_CAMPOS = {
    folio: 'folio', cliente: 'cliente', tipo: 'tipo', vendedor: 'vendedor',
    solicitante: 'solicitante', solicitanteEmail: 'solicitante_email',
    estado: 'estado', prioridad: 'prioridad', productos: 'productos', check: 'check',
    numAlma: 'num_alma', cotizacionOrigen: 'cotizacion_origen',
    destinoTipo: 'destino_tipo', destinoLat: 'destino_lat', destinoLng: 'destino_lng',
    fechaEntrega: 'fecha_entrega', entregadoEn: 'entregado_en', canceladoEn: 'cancelado_en',
    motivoCancelacion: 'motivo_cancelacion', recibioNombre: 'recibio_nombre',
    firma: 'firma', firmaEntrega: 'firma_entrega',
    remisionado: 'remisionado', remisionadoPor: 'remisionado_por', remisionadoPorEmail: 'remisionado_por_email',
    remisionadoEn: 'remisionado_en', remisionAspelFolio: 'remision_aspel_folio', remisionAspelFecha: 'remision_aspel_fecha',
    destinoPaqueteria: 'destino_paqueteria', destinoGuia: 'destino_guia', destinoDireccion: 'destino_direccion',
    destinoAlmacenOrigen: 'destino_almacen_origen', destinoAlmacenDestino: 'destino_almacen_destino', destino: 'destino',
    tienePdfOriginal: 'tiene_pdf_original', numOrdenesCompra: 'num_ordenes_compra', caratulaEnvio: 'caratula_envio',
    entregaObservaciones: 'entrega_observaciones', entregaPendienteFirma: 'entrega_pendiente_firma',
    comentariosAlmacen: 'comentarios_almacen', area: 'area', uso: 'uso', folioServicio: 'folio_servicio',
    origen: 'origen', tecnicoId: 'tecnico_id', tecnicoNumero: 'tecnico_numero', tecnicoNombre: 'tecnico_nombre',
    folioNum: 'folio_num', folioPrefijo: 'folio_prefijo',
    razonSocial: 'razon_social', clienteId: 'cliente_id',
    estacionId: 'estacion_id', estacionNombre: 'estacion_nombre',
    direccion: 'direccion', lat: 'lat', lng: 'lng', tecnicoCorreo: 'tecnico_correo',
    createdAt: 'created_at',
    almacen: 'almacen', entrega: 'entrega', total: 'total', creadoPor: 'creado_por',
    eliminada: 'eliminada', fechaEliminacion: 'fecha_eliminacion', usuarioElimino: 'usuario_elimino',
    motivoEliminacion: 'motivo_eliminacion', fechaProgramadaEliminacion: 'fecha_programada_eliminacion',
    solicitanteTecnicoId: 'solicitante_tecnico_id', solicitaParaSiMismo: 'solicita_para_si_mismo',
  };
  function aColumnas(datosCamelCase) {
    var out = {};
    Object.keys(datosCamelCase || {}).forEach(function (k) {
      var col = MAPA_CAMPOS[k];
      if (col) out[col] = datosCamelCase[k];
      else out['extra'] = Object.assign({}, out['extra'], (function () { var o = {}; o[k] = datosCamelCase[k]; return o; })());
    });
    return out;
  }

  // Todas las columnas EXCEPTO pdf_original (base64 pesado). Se lee aparte con
  // tcSbObtenerPdfOriginal. Evita 'statement timeout' en las listas.
  var COLS_SURTIDO = 'id,folio,cliente,tipo,vendedor,solicitante,solicitante_email,estado,prioridad,productos,check,num_alma,cotizacion_origen,destino_tipo,destino_lat,destino_lng,created_at,fecha_entrega,entregado_en,cancelado_en,motivo_cancelacion,recibio_nombre,firma,firma_entrega,remisionado,remisionado_por,remisionado_por_email,remisionado_en,remision_aspel_folio,remision_aspel_fecha,updated_at,destino_paqueteria,destino_guia,destino_direccion,destino_almacen_origen,destino_almacen_destino,destino,tiene_pdf_original,num_ordenes_compra,caratula_envio,entrega_observaciones,entrega_pendiente_firma,comentarios_almacen,area,uso,folio_servicio,origen,tecnico_id,tecnico_numero,tecnico_nombre,folio_num,folio_prefijo,extra,razon_social,cliente_id,estacion_id,estacion_nombre,direccion,lat,lng,tecnico_correo,almacen,entrega,total,creado_por,eliminada,fecha_eliminacion,usuario_elimino,motivo_eliminacion,fecha_programada_eliminacion,solicitante_tecnico_id,solicita_para_si_mismo';

  // v4 (8-oct-2026): las LISTAS ya no descargan las firmas (firma y
  // firma_entrega son imágenes base64, ~90% del peso de la tabla). La lista
  // llega ligera y rápida, y las firmas se piden aparte, en grupos pequeños,
  // y se guardan en memoria: solo se vuelven a pedir si el pedido cambió
  // (updated_at distinto). Así, volver a la pestaña o reconectar ya no
  // re-descarga megas de firmas cada vez.
  var COLS_LISTA = COLS_SURTIDO.replace(',firma,firma_entrega,', ',');
  var _firmasCache = new Map(); // id -> { u: updated_at, firma, firma_entrega }
  var LOTE_FIRMAS = 40;

  function guardarFirmasEnCache(row) {
    if (!row || !row.id || !('firma' in row)) return;
    _firmasCache.set(row.id, { u: row.updated_at || '', firma: row.firma || '', firma_entrega: row.firma_entrega || '' });
  }
  // Pone las firmas que ya tenemos en memoria; regresa los ids que faltan.
  function aplicarFirmasCache(rows) {
    var faltan = [];
    (rows || []).forEach(function (row) {
      if (!row || 'firma' in row) return;
      var c = _firmasCache.get(row.id);
      if (c && c.u === (row.updated_at || '')) { row.firma = c.firma; row.firma_entrega = c.firma_entrega; }
      else faltan.push(row.id);
    });
    return faltan;
  }
  // Descarga las firmas que falten, en lotes, y las pega a las filas.
  function hidratarFirmas(sb, rows) {
    var faltan = aplicarFirmasCache(rows);
    if (!faltan.length) return Promise.resolve(rows);
    var porId = new Map();
    (rows || []).forEach(function (r) { if (r) porId.set(r.id, r); });
    var lotes = [];
    for (var i = 0; i < faltan.length; i += LOTE_FIRMAS) lotes.push(faltan.slice(i, i + LOTE_FIRMAS));
    // Secuencial a propósito: no golpear la base con muchas consultas pesadas a la vez.
    return lotes.reduce(function (prom, lote) {
      return prom.then(function () {
        return sb.from('surtidos').select('id,firma,firma_entrega,updated_at').in('id', lote).then(function (r) {
          if (r.error) { console.warn('[surtidos] firmas:', r.error.message || r.error); return; }
          (r.data || []).forEach(function (f) {
            guardarFirmasEnCache(f);
            var row = porId.get(f.id);
            if (row) { row.firma = f.firma || ''; row.firma_entrega = f.firma_entrega || ''; }
          });
        });
      });
    }, Promise.resolve()).then(function () { return rows; });
  }
  // Para consultas de una sola vez (Cobranza, historial): lista ligera + firmas.
  function listaConFirmas(sb, consulta) {
    return consulta.then(function (r) {
      if (r.error) throw r.error;
      return hidratarFirmas(sb, r.data || []);
    }).then(function (rows) { return rows.map(filaASurtido); });
  }

  // ── Feed en tiempo real (reemplaza fs.onSnapshot) ───────────────────
  // v3: carga la lista UNA vez y luego, por cada evento de Realtime, solo
  // vuelve a pedir el/los pedido(s) que cambiaron (agrupados en 300 ms).
  // Antes cada cambio hacía que TODAS las pantallas abiertas descargaran la
  // tabla completa, lo que saturaba Supabase ("statement timeout").
  // Se recarga completo solo al conectar/reconectar o al volver la pestaña
  // a primer plano, para no perder eventos si la TV se durmió.
  function crearFeedSurtidos(nombreCanal, filtroServidor, filtroLocal, onChange, onError) {
    var canal = null, sbRef = null, mapa = new Map(), pendientes = new Set();
    var timer = null, yaConectado = false, activo = true;
    var ultimaCargaTotal = 0, MIN_ENTRE_CARGAS = 60000; // 1 min

    function emitir() {
      if (!activo) return;
      var arr = [];
      mapa.forEach(function (row) { if (!filtroLocal || filtroLocal(row)) arr.push(filaASurtido(row)); });
      onChange(arr);
    }
    function cargarTodo() {
      if (!sbRef || !activo) return;
      ultimaCargaTotal = Date.now();
      var q = sbRef.from('surtidos').select(COLS_LISTA);
      if (filtroServidor) q = filtroServidor(q);
      q.then(function (r) {
        if (r.error) { if (onError) onError(r.error); return; }
        var filas = r.data || [];
        aplicarFirmasCache(filas);
        mapa.clear();
        filas.forEach(function (row) { mapa.set(row.id, row); });
        emitir(); // la lista aparece de inmediato, sin esperar las firmas
        hidratarFirmas(sbRef, filas).then(function () { if (activo) emitir(); });
      });
    }
    // Volver a la pestaña / reconectar: solo recarga completa si pasó más de
    // 1 minuto desde la última (Realtime ya mantiene la lista al día).
    function cargarTodoSiHaceFalta() {
      if (Date.now() - ultimaCargaTotal < MIN_ENTRE_CARGAS) return;
      cargarTodo();
    }
    function procesarPendientes() {
      timer = null;
      var ids = Array.from(pendientes); pendientes.clear();
      if (!ids.length || !sbRef) return;
      sbRef.from('surtidos').select(COLS_SURTIDO).in('id', ids).then(function (r) {
        if (r.error) { if (onError) onError(r.error); return; }
        var vistos = new Set();
        (r.data || []).forEach(function (row) { guardarFirmasEnCache(row); mapa.set(row.id, row); vistos.add(row.id); });
        ids.forEach(function (id) { if (!vistos.has(id)) mapa.delete(id); });
        emitir();
      });
    }
    function alVolver() { if (document.visibilityState === 'visible') cargarTodoSiHaceFalta(); }

    cargarSupabase().then(function (sb) {
      sbRef = sb;
      cargarTodo();
      canal = sb.channel(nombreCanal)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'surtidos' }, function (p) {
          var id = (p.new && p.new.id) || (p.old && p.old.id);
          if (!id) { cargarTodo(); return; }
          if (p.eventType === 'DELETE') { mapa.delete(id); emitir(); return; }
          pendientes.add(id);
          if (!timer) timer = setTimeout(procesarPendientes, 300);
        })
        .subscribe(function (status) {
          if (status === 'SUBSCRIBED') {
            if (yaConectado) cargarTodoSiHaceFalta(); // reconexión: recuperar lo que se haya perdido
            yaConectado = true;
          }
        });
      document.addEventListener('visibilitychange', alVolver);
      window.addEventListener('online', cargarTodoSiHaceFalta);
    }).catch(function (err) { if (onError) onError(err); });

    // Función para cancelar la suscripción — igual que el "unsubscribe" que devolvía onSnapshot.
    return function detener() {
      activo = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', cargarTodoSiHaceFalta);
      if (canal) cargarSupabase().then(function (sb) { sb.removeChannel(canal); });
    };
  }

  window.tcSbSuscribirSurtidos = function (onChange, onError) {
    return crearFeedSurtidos('surtidos-cambios', null, null, onChange, onError);
  };

  // ── Cola de entregas esperando firma en el kiosko (Confirmar recepción) ──
  // Carga inicial filtrada en servidor; los cambios se filtran localmente para
  // que no se escape la transición cuando un pedido DEJA de estar pendiente.
  window.tcSbEscucharEntregasPendientesFirma = function (onChange, onError) {
    return crearFeedSurtidos('surtidos-entrega-firma',
      function (q) { return q.eq('entrega_pendiente_firma', true); },
      function (row) { return !!row.entrega_pendiente_firma; },
      onChange, onError);
  };

  window.tcSbObtenerSurtido = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').select(COLS_SURTIDO).eq('id', id).maybeSingle();
    }).then(function (r) {
      if (r.error) throw r.error;
      guardarFirmasEnCache(r.data);
      return filaASurtido(r.data);
    });
  };

  window.tcSbActualizarSurtido = function (id, datosCamelCase) {
    var columnas = aColumnas(datosCamelCase);
    // Los campos sin columna propia van a "extra": se MEZCLAN con lo que ya tiene
    // (un trigger en la base lo hace al ver __merge), así no se borran otros datos.
    if (columnas.extra) columnas.extra = Object.assign({ __merge: true }, columnas.extra);
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').update(columnas).eq('id', id);
    }).then(function (r) { if (r.error) throw r.error; });
  };

  // ── Historial de cambios de estado ──────────────────────────────────
  window.tcSbAgregarHistorial = function (id, entrada) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_historial').insert({
        surtido_id: id, de: entrada.de || null, a: entrada.a || null, por: entrada.por || null,
        nota: entrada.nota || entrada.motivo || null,
      });
    }).then(function (r) { if (r.error) throw r.error; });
  };
  window.tcSbListarHistorial = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_historial').select('*').eq('surtido_id', id).order('ts', { ascending: true });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(function (h) { return { id: h.id, de: h.de, a: h.a, por: h.por, ts: h.ts, nota: h.nota }; });
    });
  };

  // ── Todos los pedidos (para vistas de solo lectura tipo "Pedidos de Almacén" en Cobranza) ─
  window.tcSbListarTodosSurtidos = function () {
    return cargarSupabase().then(function (sb) {
      return listaConFirmas(sb, sb.from('surtidos').select(COLS_LISTA).order('created_at', { ascending: false }));
    });
  };

  // ── Pedidos de un cliente específico (solo lectura, ej. Cobranza) ────────
  window.tcSbSurtidosPorCliente = function (clienteNombre) {
    return cargarSupabase().then(function (sb) {
      return listaConFirmas(sb, sb.from('surtidos').select(COLS_LISTA).eq('cliente', clienteNombre).order('created_at', { ascending: false }));
    });
  };

  // ── Documentos adjuntos ──────────────────────────────────────────────
  window.tcSbListarDocumentos = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_documentos').select('*').eq('surtido_id', id).order('subido_en', { ascending: true });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(function (d) { return { id: d.id, nombre: d.nombre, archivo: d.archivo, subidoEn: d.subido_en, subidoPor: d.subido_por }; });
    });
  };
  window.tcSbAgregarDocumento = function (id, datos) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_documentos').insert({
        surtido_id: id, nombre: datos.nombre || null, archivo: datos.archivo || datos.url || null, subido_por: datos.subidoPor || null,
      });
    }).then(function (r) { if (r.error) throw r.error; });
  };

  // ── Evidencia de entrega ────────────────────────────────────────────
  window.tcSbListarEvidencias = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_evidencias').select('*').eq('surtido_id', id).order('subido_en', { ascending: true });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(function (e) { return { id: e.id, tipo: e.tipo, imagen: e.imagen, nombre: e.nombre, url: e.url, subidoEn: e.subido_en, subidoPor: e.subido_por, categoria: e.categoria || 'general' }; });
    });
  };
  // Fotos de evidencia (oct-2026): ya NO se guardan en base64 dentro de la base.
  // Se suben al bucket público portal_evidencias y en la tabla queda solo la liga.
  // Si la subida falla, se guarda como antes (base64) para no perder la foto.
  var BUCKET_EVID = 'portal_evidencias';
  function dataUrlABlob(dataUrl) {
    var partes = String(dataUrl).split(','), mime = (partes[0].match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    var bin = atob(partes[1] || ''), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  function subirImagenEvidencia(sb, surtidoId, dataUrl) {
    var blob = dataUrlABlob(dataUrl);
    var ext = /png/.test(blob.type) ? 'png' : (/webp/.test(blob.type) ? 'webp' : 'jpg');
    var ruta = 'surtidos/' + surtidoId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    return sb.storage.from(BUCKET_EVID).upload(ruta, blob, { contentType: blob.type, upsert: false }).then(function (res) {
      if (res.error) throw res.error;
      return sb.storage.from(BUCKET_EVID).getPublicUrl(ruta).data.publicUrl;
    });
  }
  window.tcSbSubirImagenEvidencia = function (surtidoId, dataUrl) {
    return cargarSupabase().then(function (sb) { return subirImagenEvidencia(sb, surtidoId, dataUrl); });
  };
  window.tcSbAgregarEvidencia = function (id, datos) {
    return cargarSupabase().then(function (sb) {
      var img = datos.imagen || null;
      if (img && /^data:image\//.test(img)) {
        return subirImagenEvidencia(sb, id, img).then(function (url) { return { sb: sb, img: url }; })
          .catch(function (e) { console.warn('[surtidos] evidencia a Storage fall\u00f3, se guarda en la base:', e && e.message); return { sb: sb, img: img }; });
      }
      return { sb: sb, img: img };
    }).then(function (x) {
      var sb = x.sb;
      return sb.from('surtido_evidencias').insert({
        surtido_id: id, tipo: datos.tipo || null, imagen: x.img,
        nombre: datos.nombre || null, url: datos.url || null, subido_por: datos.subidoPor || null,
        categoria: datos.categoria || 'general',
      });
    }).then(function (r) { if (r.error) throw r.error; });
  };

  // ── PDF original (antes: doc único surtidos/{id}/adjuntos/pdf_original) ─
  window.tcSbObtenerPdfOriginal = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').select('pdf_original').eq('id', id).maybeSingle();
    }).then(function (r) {
      if (r.error) throw r.error;
      return r.data ? { archivo: r.data.pdf_original } : null;
    });
  };
  window.tcSbGuardarPdfOriginal = function (id, base64) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').update({ pdf_original: base64, tiene_pdf_original: true }).eq('id', id);
    }).then(function (r) { if (r.error) throw r.error; });
  };

  // ── Consultas por estado (ej. Historial de entregas en Cobranza/Almacén) ─
  window.tcSbSurtidosPorEstados = function (estados) {
    return cargarSupabase().then(function (sb) {
      return listaConFirmas(sb, sb.from('surtidos').select(COLS_LISTA).in('estado', estados));
    });
  };

  // ── Notificaciones de pedido ─────────────────────────────────────────
  window.tcSbAgregarNotificacion = function (datos) {
    return cargarSupabase().then(function (sb) {
      return sb.from('pedido_notificaciones').insert({
        surtido_id: datos.surtidoId || null, folio: datos.folio || null,
        destinatario_nombre: datos.destinatarioNombre || null, destinatario_email: datos.destinatarioEmail || null,
        tipo: datos.tipo || null, mensaje: datos.mensaje || null, leido: false, creado_por: datos.creadoPor || null,
      });
    }).then(function (r) { if (r.error) throw r.error; });
  };

  // ── ¿Ya existe un folio activo? (chequeo suave de duplicados) ──────────
  window.tcSbExisteFolioActivo = function (folio) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').select('estado').eq('folio', folio);
    }).then(function (r) {
      if (r.error) return false; // no bloqueante ante error, igual que antes
      return (r.data || []).some(function (row) { return row.estado !== 'finalizado' && row.estado !== 'entregado'; });
    }).catch(function () { return false; });
  };

  // ── Siguiente folio de material por prefijo (ej. "VENTAS") — antes:
  //    consulta a Firestore buscando el folioNum más alto con ese prefijo.
  window.tcSbSiguienteFolioMaterial = function (prefijo) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').select('folio_num').eq('folio_prefijo', prefijo)
        .order('folio_num', { ascending: false }).limit(1).maybeSingle();
    }).then(function (r) {
      if (r.error) throw r.error;
      var max = (r.data && r.data.folio_num) || 0;
      return max + 1;
    });
  };

  // ── Escucha en vivo (para cuando el detalle de un pedido está abierto) ──
  // A diferencia de tcSbListar*, estas SÍ se quedan escuchando cambios —
  // úsalas mientras el panel de detalle esté visible, y llama a la función
  // que regresan para dejar de escuchar cuando se cierre.
  function _escucharTabla(tabla, mapear, surtidoId, onChange){
    var canal = null;
    cargarSupabase().then(function (sb) {
      function refrescar(){
        sb.from(tabla).select('*').eq('surtido_id', surtidoId).order(tabla==='surtido_historial'?'ts':'subido_en', { ascending: true })
          .then(function (r) { if (!r.error) onChange((r.data || []).map(mapear)); });
      }
      refrescar();
      canal = sb.channel(tabla + '-' + surtidoId)
        .on('postgres_changes', { event: '*', schema: 'public', table: tabla, filter: 'surtido_id=eq.' + surtidoId }, refrescar)
        .subscribe();
    });
    return function detener(){ if (canal) cargarSupabase().then(function (sb) { sb.removeChannel(canal); }); };
  }
  window.tcSbEscucharEvidencias = function (surtidoId, onChange) {
    return _escucharTabla('surtido_evidencias', function (e) {
      return { id: e.id, tipo: e.tipo, imagen: e.imagen, nombre: e.nombre, url: e.url, subidoEn: e.subido_en, subidoPor: e.subido_por, categoria: e.categoria || 'general' };
    }, surtidoId, onChange);
  };
  window.tcSbEscucharHistorial = function (surtidoId, onChange) {
    return _escucharTabla('surtido_historial', function (h) {
      return { id: h.id, de: h.de, a: h.a, por: h.por, ts: h.ts, nota: h.nota };
    }, surtidoId, onChange);
  };
  window.tcSbEscucharDocumentos = function (surtidoId, onChange) {
    return _escucharTabla('surtido_documentos', function (d) {
      return { id: d.id, nombre: d.nombre, archivo: d.archivo, subidoEn: d.subido_en, subidoPor: d.subido_por };
    }, surtidoId, onChange);
  };

  // ── Resumen en bloque: qué evidencias/documentos tiene cada pedido de una
  //    lista (para pintar palomitas en la tabla de historial sin hacer una
  //    consulta por fila) ──────────────────────────────────────────────
  window.tcSbResumenEvidenciasDocs = function (ids) {
    if (!ids || !ids.length) return Promise.resolve({ evidencias: {}, documentos: {} });
    return cargarSupabase().then(function (sb) {
      return Promise.all([
        sb.from('surtido_evidencias').select('surtido_id,categoria,imagen,url,nombre,subido_en').in('surtido_id', ids),
        sb.from('surtido_documentos').select('surtido_id').in('surtido_id', ids),
      ]);
    }).then(function (r) {
      if (r[0].error) throw r[0].error;
      if (r[1].error) throw r[1].error;
      var evid = {}, docs = {};
      (r[0].data || []).forEach(function (e) {
        var cat = e.categoria || 'general';
        evid[e.surtido_id] = evid[e.surtido_id] || {};
        // Guarda la más reciente de cada categoría, para poder previsualizarla directo.
        if (!evid[e.surtido_id][cat]) evid[e.surtido_id][cat] = { imagen: e.imagen, url: e.url, nombre: e.nombre };
      });
      (r[1].data || []).forEach(function (d) { docs[d.surtido_id] = (docs[d.surtido_id] || 0) + 1; });
      return { evidencias: evid, documentos: docs };
    });
  };

  // ── Migración única: evidencias viejas en base64 → Storage ───────────
  //    Uso (consola del portal): tcSbMigrarEvidenciasAStorage()
  window.tcSbMigrarEvidenciasAStorage = function () {
    var hechas = 0, fallas = 0;
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_evidencias').select('id,surtido_id').like('imagen', 'data:image/%').then(function (r) {
        if (r.error) throw r.error;
        var filas = r.data || [];
        console.log('[evidencias] por mover:', filas.length);
        return filas.reduce(function (p, f, i) {
          return p.then(function () {
            return sb.from('surtido_evidencias').select('imagen').eq('id', f.id).maybeSingle().then(function (r2) {
              if (r2.error || !r2.data || !/^data:image\//.test(r2.data.imagen || '')) return;
              return subirImagenEvidencia(sb, f.surtido_id, r2.data.imagen).then(function (url) {
                return sb.from('surtido_evidencias').update({ imagen: url }).eq('id', f.id);
              }).then(function (r3) { if (r3 && r3.error) throw r3.error; hechas++; });
            }).catch(function (e) { fallas++; console.warn('[evidencias] fall\u00f3', f.id, e && e.message); })
              .then(function () { if ((i + 1) % 10 === 0) console.log('[evidencias]', i + 1, '/', filas.length); return new Promise(function (res) { setTimeout(res, 200); }); });
          });
        }, Promise.resolve());
      });
    }).then(function () { console.log('[evidencias] TERMINADO \u00b7 movidas:', hechas, '\u00b7 con error:', fallas); return { movidas: hechas, errores: fallas }; });
  };

  // ── Borrado permanente (solo para la limpieza automática de la papelera) ─
  window.tcSbEliminarSurtido = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').delete().eq('id', id);
    }).then(function (r) { if (r.error) throw r.error; });
  };

  // ── Crear un pedido nuevo ────────────────────────────────────────────
  // Envío directo a Supabase. Un reintento con el mismo id NO crea duplicado
  // (ON CONFLICT DO NOTHING). Si la red no responde en 12 s se considera falla de red.
  function _enviarSurtido(id, datosSinId) {
    var columnas = aColumnas(datosSinId);
    columnas.id = id;
    var envio = cargarSupabase().then(function (sb) {
      return sb.from('surtidos').upsert(columnas, { onConflict: 'id', ignoreDuplicates: true });
    }).then(function (r) {
      if (r.error) { var e = r.error; e.status = r.status; throw e; }
      return id;
    });
    var limite = new Promise(function (_, rej) {
      setTimeout(function () { var e = new Error('Guardado tardó más de 12 s'); e.__tcTimeout = true; rej(e); }, 12000);
    });
    return Promise.race([envio, limite]);
  }

  // ¿La falla es de conexión (se puede reintentar) o un error real de datos?
  // Errores de datos de PostgREST traen code (ej. '22003', '23502') → NO se encolan.
  function _esFallaDeRed(err) {
    if (!err) return false;
    if (err.__tcTimeout) return true;
    if (err instanceof TypeError) return true;
    if (err.code === '57014') return true;                 // statement timeout
    if (typeof err.status === 'number' && (err.status === 0 || err.status >= 500)) return true;
    return !err.code;                                       // sin código = no llegó a la base
  }

  // ── Cola local de respaldo (29-sep-2026) ─────────────────────────────
  // Si una SOLICITUD DE MATERIAL no se puede enviar por conexión, se guarda en
  // este equipo y se reenvía sola (al volver la red, cada 60 s y al abrir la
  // página). Aplica a Kiosco, Ventas, Flotilla y Operaciones. Los surtidos de
  // Almacén (tipo 'venta', con PDF/documentos adjuntos) NO se encolan: siguen
  // mostrando error para que se reintenten en el momento.
  var COLA_KEY = 'tc_surtidos_pendientes';
  var FALLIDOS_KEY = 'tc_surtidos_fallidos';
  function _leer(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }
  function _guardar(k, a) { try { localStorage.setItem(k, JSON.stringify(a)); } catch (e) { console.error('[surtidos] no se pudo guardar respaldo local', e); } }

  function _pintarAviso() {
    if (!document.body) return;
    var pend = _leer(COLA_KEY).length, fall = _leer(FALLIDOS_KEY).length;
    var el = document.getElementById('tc-aviso-cola-surtidos');
    if (!pend && !fall) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'tc-aviso-cola-surtidos';
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:99999;max-width:92vw;display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:12px;font:600 12.5px/1.35 system-ui,-apple-system,sans-serif;color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);';
      document.body.appendChild(el);
    }
    var icono = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>';
    if (fall) {
      el.style.background = '#E7402B';
      el.innerHTML = icono + '<span>' + fall + ' solicitud(es) de material no se pudieron registrar. Avisa a Sistemas antes de borrar datos de este equipo.</span>';
    } else {
      el.style.background = '#1D2E73';
      el.innerHTML = icono + '<span>' + pend + ' solicitud(es) de material guardada(s) en este equipo. Se enviarán solas al volver la conexión — no las captures de nuevo.</span>';
    }
  }

  var _reintentando = false;
  function _reintentarCola() {
    if (_reintentando) return Promise.resolve();
    var pend = _leer(COLA_KEY);
    if (!pend.length) { _pintarAviso(); return Promise.resolve(); }
    _reintentando = true;
    var quedan = [], fallidos = _leer(FALLIDOS_KEY);
    return pend.reduce(function (cadena, item) {
      return cadena.then(function () {
        return _enviarSurtido(item.id, item.datos).then(function () {
          console.info('[surtidos] respaldo enviado a Supabase:', item.datos && item.datos.folio);
        }).catch(function (err) {
          if (_esFallaDeRed(err)) quedan.push(item);
          else { console.error('[surtidos] respaldo rechazado por la base:', err); item.error = String(err.message || err.code || err); fallidos.push(item); }
        });
      });
    }, Promise.resolve()).then(function () {
      // Por si se encoló algo nuevo mientras se reintentaba
      var ids = pend.map(function (x) { return x.id; });
      var nuevos = _leer(COLA_KEY).filter(function (x) { return ids.indexOf(x.id) < 0; });
      _guardar(COLA_KEY, quedan.concat(nuevos));
      _guardar(FALLIDOS_KEY, fallidos);
      _reintentando = false;
      _pintarAviso();
    });
  }
  window.tcSbReintentarColaSurtidos = _reintentarCola;
  window.addEventListener('online', function () { _reintentarCola(); });
  setInterval(_reintentarCola, 60000);
  setTimeout(_reintentarCola, 5000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _pintarAviso); else _pintarAviso();

  window.tcSbCrearSurtido = function (datosCamelCase) {
    var datos = Object.assign({}, datosCamelCase);
    var id = datos.id || ((window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
    delete datos.id;
    window.tcSbUltimoEnCola = false;
    return _enviarSurtido(id, datos).catch(function (err) {
      if (datos.tipo === 'material' && _esFallaDeRed(err)) {
        console.warn('[surtidos] sin conexión — solicitud guardada en este equipo:', datos.folio, err);
        var cola = _leer(COLA_KEY).filter(function (x) { return x.id !== id; });
        cola.push({ id: id, datos: datos, encoladoEn: new Date().toISOString() });
        _guardar(COLA_KEY, cola);
        window.tcSbUltimoEnCola = true;
        _pintarAviso();
        return id;
      }
      throw err;
    });
  };
  // ═══════════════════════════════════════════════════════════════════════
  //  COLECCIONES QUE ANTES VIVÍAN EN FIRESTORE (oct-2026):
  //    puntos_referencia · recolecciones_locales · tv_avisos
  //  Mismo "estilo Firestore" (doc.id, doc.data(), snap.forEach, onSnapshot)
  //  para que los módulos cambien lo mínimo. Cada fila guarda el documento
  //  completo en `datos` (jsonb) y su id en `ref` (texto, conserva los ids
  //  originales de Firestore, que ya están congelados dentro de los pedidos).
  // ═══════════════════════════════════════════════════════════════════════
  var TABLAS_DOCS = { puntos_referencia: 1, recolecciones_locales: 1, tv_avisos: 1, config_portal: 1, destinos_envio: 1 };
  function _chkTabla(t) { if (!TABLAS_DOCS[t]) throw new Error('Colección no migrada a Supabase: ' + t); }
  function _nuevoIdDoc() {
    var c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', s = '', a = new Uint8Array(20);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a); else for (var i = 0; i < 20; i++) a[i] = Math.floor(Math.random() * 256);
    for (var j = 0; j < 20; j++) s += c[a[j] % 62];
    return s;
  }
  function _limpiarDoc(o) { return JSON.parse(JSON.stringify(o || {})); }
  function _docSnap(row) {
    var datos = row ? Object.assign({}, row.datos || {}) : null;
    return { id: row ? row.ref : null, exists: function () { return !!row; }, data: function () { return datos ? Object.assign({}, datos) : undefined; } };
  }
  function _querySnap(rows) {
    var docs = (rows || []).map(_docSnap);
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (fn) { docs.forEach(fn); } };
  }
  // filtro: { campo: valor } o { campo: [valores] } — compara contra datos->>campo
  function _aplicarFiltroDocs(q, filtro) {
    Object.keys(filtro || {}).forEach(function (k) {
      var v = filtro[k], col = 'datos->>' + k;
      q = Array.isArray(v) ? q.in(col, v.map(String)) : q.eq(col, String(v));
    });
    return q;
  }
  function _conTiempo(p, ms, que) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error((que || 'Supabase') + ' tardó más de ' + Math.round(ms / 1000) + ' s')); }, ms); })]);
  }

  window.tcSbDocs = {
    getDocs: function (tabla, filtro) {
      _chkTabla(tabla);
      return _conTiempo(cargarSupabase().then(function (sb) {
        return _aplicarFiltroDocs(sb.from(tabla).select('ref,datos'), filtro).order('creado_en', { ascending: true });
      }), 20000, 'Leer ' + tabla).then(function (r) { if (r.error) throw r.error; return _querySnap(r.data); });
    },
    getDoc: function (tabla, id) {
      _chkTabla(tabla);
      return _conTiempo(cargarSupabase().then(function (sb) {
        return sb.from(tabla).select('ref,datos').eq('ref', id).maybeSingle();
      }), 20000, 'Leer ' + tabla).then(function (r) { if (r.error) throw r.error; return _docSnap(r.data); });
    },
    addDoc: function (tabla, datos) {
      _chkTabla(tabla);
      var ref = _nuevoIdDoc();
      return _conTiempo(cargarSupabase().then(function (sb) {
        return sb.from(tabla).insert({ ref: ref, datos: _limpiarDoc(datos) });
      }), 20000, 'Guardar en ' + tabla).then(function (r) { if (r.error) throw r.error; return { id: ref }; });
    },
    // Igual que updateDoc de Firestore: mezcla campos; falla si el documento no existe.
    updateDoc: function (tabla, id, cambios) {
      _chkTabla(tabla);
      return _conTiempo(cargarSupabase().then(function (sb) {
        return sb.rpc('tc_doc_merge', { p_tabla: tabla, p_ref: id, p_patch: _limpiarDoc(cambios), p_borrar: [] });
      }), 20000, 'Actualizar ' + tabla).then(function (r) { if (r.error) throw r.error; });
    },
    deleteDoc: function (tabla, id) {
      _chkTabla(tabla);
      return _conTiempo(cargarSupabase().then(function (sb) {
        return sb.from(tabla).delete().eq('ref', id);
      }), 20000, 'Borrar en ' + tabla).then(function (r) { if (r.error) throw r.error; });
    },
    // Reemplaza onSnapshot: carga inicial + recarga (agrupada) en cada cambio
    // de Realtime, al reconectar y al volver la pestaña a primer plano.
    onSnapshot: function (tabla, filtro, onChange, onError) {
      _chkTabla(tabla);
      var canal = null, timer = null, activo = true, yaConectado = false;
      function recargar() {
        if (!activo) return;
        window.tcSbDocs.getDocs(tabla, filtro).then(function (snap) { if (activo) onChange(snap); })
          .catch(function (err) { if (onError) onError(err); });
      }
      function programar() { if (!timer) timer = setTimeout(function () { timer = null; recargar(); }, 300); }
      function alVolver() { if (document.visibilityState === 'visible') recargar(); }
      cargarSupabase().then(function (sb) {
        if (!activo) return;
        recargar();
        canal = sb.channel(tabla + '-cambios-' + Math.random().toString(36).slice(2, 8))
          .on('postgres_changes', { event: '*', schema: 'public', table: tabla }, programar)
          .subscribe(function (status) {
            if (status === 'SUBSCRIBED') { if (yaConectado) recargar(); yaConectado = true; }
          });
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener('online', recargar);
      }).catch(function (err) { if (onError) onError(err); });
      return function detener() {
        activo = false;
        if (timer) clearTimeout(timer);
        document.removeEventListener('visibilitychange', alVolver);
        window.removeEventListener('online', recargar);
        if (canal) cargarSupabase().then(function (sb) { sb.removeChannel(canal); });
      };
    }
  };
})();
