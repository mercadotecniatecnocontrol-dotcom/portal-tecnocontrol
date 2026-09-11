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
      // Sin esto, cualquier ESCRITURA (crear pedido, remisionar, mover estado)
      // se rechaza en silencio: las políticas de seguridad exigen una sesión
      // "authenticated", y sin iniciar sesión aquí el navegador nunca la tiene
      // — el login del portal es con Firebase, Supabase no se entera solo.
      // Una sesión anónima sí cuenta como "authenticated" en Supabase (igual
      // que exigía Firestore: cualquier sesión, ni siquiera tenía que ser real).
      return cliente.auth.getSession().then(function (r) {
        if (r.data && r.data.session) return cliente;
        return cliente.auth.signInAnonymously().then(function (res) {
          if (res.error) console.error('[surtidos-supabase] no se pudo iniciar sesión anónima:', res.error);
          return cliente;
        });
      });
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

  // ── Feed en tiempo real (reemplaza fs.onSnapshot) ───────────────────
  // Nota de diseño: ante cualquier cambio, se vuelve a pedir la lista
  // completa — más simple y confiable que reconstruir el estado a mano
  // con los eventos de Realtime, a costa de una consulta extra por
  // cambio. Para el volumen de pedidos activos de Almacén esto es
  // imperceptible.
  window.tcSbSuscribirSurtidos = function (onChange, onError) {
    var canal = null;
    cargarSupabase().then(function (sb) {
      function refrescar() {
        sb.from('surtidos').select('*').then(function (r) {
          if (r.error) { if (onError) onError(r.error); return; }
          onChange((r.data || []).map(filaASurtido));
        });
      }
      refrescar();
      canal = sb.channel('surtidos-cambios')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'surtidos' }, refrescar)
        .subscribe();
    }).catch(function (err) { if (onError) onError(err); });
    // Función para cancelar la suscripción — igual que el "unsubscribe" que devolvía onSnapshot.
    return function detener() {
      if (canal) cargarSupabase().then(function (sb) { sb.removeChannel(canal); });
    };
  };

  window.tcSbObtenerSurtido = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').select('*').eq('id', id).maybeSingle();
    }).then(function (r) {
      if (r.error) throw r.error;
      return filaASurtido(r.data);
    });
  };

  window.tcSbActualizarSurtido = function (id, datosCamelCase) {
    var columnas = aColumnas(datosCamelCase);
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
      return sb.from('surtidos').select('*').order('created_at', { ascending: false });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(filaASurtido);
    });
  };

  // ── Pedidos de un cliente específico (solo lectura, ej. Cobranza) ────────
  window.tcSbSurtidosPorCliente = function (clienteNombre) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').select('*').eq('cliente', clienteNombre).order('created_at', { ascending: false });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(filaASurtido);
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
  window.tcSbAgregarEvidencia = function (id, datos) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_evidencias').insert({
        surtido_id: id, tipo: datos.tipo || null, imagen: datos.imagen || null,
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
      return sb.from('surtidos').select('*').in('estado', estados);
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(filaASurtido);
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

  // ── Crear un pedido nuevo ────────────────────────────────────────────
  window.tcSbCrearSurtido = function (datosCamelCase) {
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2);
    var columnas = aColumnas(datosCamelCase);
    columnas.id = id;
    return cargarSupabase().then(function (sb) {
      return sb.from('surtidos').insert(columnas);
    }).then(function (r) { if (r.error) throw r.error; return id; });
  };
})();
