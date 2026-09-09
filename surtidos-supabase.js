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
    });
    return _clientePromesa;
  }

  // ── Conversión de nombres de columnas (snake_case) ↔ campos que ya
  //    espera el resto del código (camelCase, mismos nombres que traía
  //    Firestore) — así almacen.js casi no necesita cambiar su forma de
  //    leer los datos, solo de dónde vienen. ──
  function filaASurtido(row) {
    if (!row) return null;
    return {
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
    };
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
      return (r.data || []).map(function (h) { return { de: h.de, a: h.a, por: h.por, ts: h.ts, nota: h.nota }; });
    });
  };

  // ── Documentos adjuntos ──────────────────────────────────────────────
  window.tcSbListarDocumentos = function (id) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_documentos').select('*').eq('surtido_id', id).order('subido_en', { ascending: true });
    }).then(function (r) {
      if (r.error) throw r.error;
      return (r.data || []).map(function (d) { return { nombre: d.nombre, archivo: d.archivo, subidoEn: d.subido_en, subidoPor: d.subido_por }; });
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
      return (r.data || []).map(function (e) { return { tipo: e.tipo, imagen: e.imagen, nombre: e.nombre, url: e.url, subidoEn: e.subido_en, subidoPor: e.subido_por }; });
    });
  };
  window.tcSbAgregarEvidencia = function (id, datos) {
    return cargarSupabase().then(function (sb) {
      return sb.from('surtido_evidencias').insert({
        surtido_id: id, tipo: datos.tipo || null, imagen: datos.imagen || null,
        nombre: datos.nombre || null, url: datos.url || null, subido_por: datos.subidoPor || null,
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
