// ═══════════════════════════════════════════════════════════════════════
//  notif-matriz.js — Panel "Quién recibe qué"  (Fase 1, oct-2026)
//  Portal Operativo Tecnocontrol
// ═══════════════════════════════════════════════════════════════════════
//  Administra en Supabase (tablas de fase1-notificaciones.sql):
//    · Personas  → notif_preferencias  (ej. Paloma: solo Operaciones)
//    · Eventos   → notif_matriz        (ej. "listo para facturar" → Ale)
//    · Retenidos → notif_retenidas     (avisos que no se entregaron, para revisar)
//    · Historial → notif_bitacora      (quién cambió qué y cuándo)
//  Solo administradores del portal (esAdminTotal).
//  Se abre con: window.abrirMatrizNotificaciones()
// ═══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';

  var MODULOS_RESPALDO = ['Administración', 'Almacén', 'Cobranza', 'Compras', 'Contabilidad', 'Contraloría', 'Desarrollos',
    'Egresos', 'Flotilla', 'Gestoría', 'Ingresos', 'Marketing', 'Operaciones', 'Pagos', 'Recursos Humanos', 'Ventas'];

  var I = {
    cerrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    persona: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    evento: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    retenido: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    historial: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    mas: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    quitar: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    aviso: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  };

  var C = { navy: '#1D2E73', rojo: '#E7402B', tinta: '#0F172A', gris: '#64748B', linea: '#E2E8F0', fondo: '#F8FAFC' };

  var E = { tab: 'personas', prefs: [], matriz: [], tipos: [], retenidas: [], bitacora: [], busca: '', error: '', cargando: false };

  var CAMPOS_LEGIBLES = {
    modo: 'modo', modulos: 'módulos', incluir_personales: 'lo personal', incluir_acciones: 'autorizaciones',
    activo: 'activo', nota: 'nota', destinatarios: 'destinatarios', modulo: 'módulo', requiere_accion: 'requiere firma',
    descripcion: 'descripción', nombre: 'nombre',
  };
  var TABLAS_LEGIBLES = { notif_preferencias: 'Persona', notif_matriz: 'Evento', notif_tipos: 'Tipo de aviso' };

  // ───────────────────────────── utilidades ─────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function yo() { return String((window.auth && window.auth.currentUser && window.auth.currentUser.email) || '').toLowerCase().trim(); }
  function alfa(a, b) { return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }); }
  function modulos() { return (window.DEPTOS_PORTAL || MODULOS_RESPALDO).slice().sort(alfa); }
  function nombreDe(correo) {
    var c = String(correo || '').toLowerCase();
    var mapa = window.NOMBRE_MAP || {};
    return mapa[c] || (typeof window.nombreUsuario === 'function' ? window.nombreUsuario(c) : c.split('@')[0]);
  }
  function correoValido(c) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c || '').trim()); }
  function fecha(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  }
  function correosConocidos() {
    var set = {};
    [window.NOMBRE_MAP, window.EMAIL_AREA_MAP_PORTAL].forEach(function (m) { Object.keys(m || {}).forEach(function (k) { set[k.toLowerCase()] = 1; }); });
    E.prefs.forEach(function (p) { set[p.correo] = 1; });
    E.matriz.forEach(function (m) { (m.destinatarios || []).forEach(function (d) { set[String(d).toLowerCase()] = 1; }); });
    return Object.keys(set).sort(alfa);
  }
  function toast(msg, color) {
    if (typeof window.mostrarToast === 'function') { window.mostrarToast(msg, '', ''); return; }
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:' + (color || C.navy) +
      ';color:#fff;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;z-index:100002';
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }
  function errorLegible(e) {
    var m = (e && (e.message || e.details)) || String(e);
    if (/does not exist|Could not find the table|schema cache/i.test(m)) {
      return 'Las tablas de la matriz todavía no existen en Supabase. Corre el archivo fase1-notificaciones.sql en Supabase → SQL Editor y vuelve a abrir este panel.';
    }
    return 'No se pudo leer o guardar en Supabase: ' + m;
  }

  // ───────────────────────────── datos ─────────────────────────────
  function cargar() {
    E.cargando = true; E.error = ''; pintar();
    return window.tcSb().then(function (c) {
      return Promise.all([
        c.from('notif_preferencias').select('*'),
        c.from('notif_matriz').select('*'),
        c.from('notif_tipos').select('*'),
        c.from('notif_retenidas').select('*').order('creada_en', { ascending: false }).limit(200),
        c.from('notif_bitacora').select('*').order('hecho_en', { ascending: false }).limit(150),
      ]);
    }).then(function (rs) {
      for (var i = 0; i < rs.length; i++) { if (rs[i].error) throw rs[i].error; }
      E.prefs = (rs[0].data || []).map(function (p) { p.correo = String(p.correo).toLowerCase(); p._nuevo = false; return p; });
      E.matriz = rs[1].data || [];
      E.tipos = rs[2].data || [];
      E.retenidas = rs[3].data || [];
      E.bitacora = rs[4].data || [];
    }).catch(function (e) {
      E.error = errorLegible(e);
    }).then(function () { E.cargando = false; pintar(); });
  }

  function guardarPersona(correo) {
    var p = E.prefs.find(function (x) { return x.correo === correo; });
    if (!p) return;
    if (p.modo === 'solo' && !(p.modulos || []).length) {
      alert('Elige al menos un módulo. Con "Solo estos módulos" y ninguno marcado, ' + nombreDe(correo) + ' no recibiría avisos de nada.');
      return;
    }
    var fila = {
      correo: p.correo, nombre: p.nombre || nombreDe(p.correo), modo: p.modo, modulos: p.modo === 'solo' ? p.modulos : [],
      incluir_personales: !!p.incluir_personales, incluir_acciones: !!p.incluir_acciones, activo: !!p.activo,
      nota: p.nota || null, actualizado_por: yo(), actualizado_en: new Date().toISOString(),
    };
    window.tcSb().then(function (c) { return c.from('notif_preferencias').upsert(fila, { onConflict: 'correo' }); })
      .then(function (r) {
        if (r.error) throw r.error;
        if (window.tcNotifRecargar) window.tcNotifRecargar();
        toast('Guardado: ' + nombreDe(correo));
        return cargar();
      })
      .catch(function (e) { alert(errorLegible(e)); });
  }

  function guardarEvento(evento) {
    var m = E.matriz.find(function (x) { return x.evento === evento; });
    if (!m) return;
    var fila = {
      evento: m.evento, modulo: m.modulo, descripcion: m.descripcion, destinatarios: m.destinatarios || [],
      activo: !!m.activo, actualizado_por: yo(), actualizado_en: new Date().toISOString(),
    };
    window.tcSb().then(function (c) { return c.from('notif_matriz').upsert(fila, { onConflict: 'evento' }); })
      .then(function (r) {
        if (r.error) throw r.error;
        if (window.tcNotifRecargar) window.tcNotifRecargar();
        toast('Guardado: ' + (m.descripcion || m.evento));
        return cargar();
      })
      .catch(function (e) { alert(errorLegible(e)); });
  }

  function clasificarTipo(tipo, modulo) {
    if (!modulo) { alert('Elige a qué módulo pertenece este aviso.'); return; }
    var fila = { patron: tipo, modulo: modulo, requiere_accion: false, descripcion: 'Clasificado desde el panel', actualizado_por: yo(), actualizado_en: new Date().toISOString() };
    window.tcSb().then(function (c) { return c.from('notif_tipos').upsert(fila, { onConflict: 'patron' }); })
      .then(function (r) {
        if (r.error) throw r.error;
        if (window.tcNotifRecargar) window.tcNotifRecargar();
        toast('"' + tipo + '" ahora cuenta como ' + modulo);
        return cargar();
      })
      .catch(function (e) { alert(errorLegible(e)); });
  }

  // ───────────────────────────── acciones (onclick) ─────────────────────────────
  var A = {
    tab: function (t) { E.tab = t; E.busca = ''; pintar(); },
    busca: function (v) { E.busca = v; pintarCuerpo(); },
    cerrar: function () { var ov = document.getElementById('nm-ov'); if (ov) ov.remove(); },
    recargar: function () { cargar(); },

    agregarPersona: function () {
      var inp = document.getElementById('nm-nueva-persona');
      var c = String((inp && inp.value) || '').toLowerCase().trim();
      if (!correoValido(c)) { alert('Escribe un correo completo, por ejemplo nombre@tecnocontrol.com.mx'); return; }
      if (E.prefs.some(function (p) { return p.correo === c; })) { alert(nombreDe(c) + ' ya tiene una regla en la lista.'); return; }
      E.prefs.push({ correo: c, nombre: nombreDe(c), modo: 'solo', modulos: [], incluir_personales: true, incluir_acciones: true, activo: true, nota: '', _nuevo: true });
      pintarCuerpo();
    },
    campoPersona: function (correo, campo, valor) {
      var p = E.prefs.find(function (x) { return x.correo === correo; });
      if (!p) return;
      p[campo] = valor;
      if (campo === 'modo') pintarCuerpo();
    },
    moduloPersona: function (correo, modulo, marcado) {
      var p = E.prefs.find(function (x) { return x.correo === correo; });
      if (!p) return;
      var l = (p.modulos || []).filter(function (m) { return m !== modulo; });
      if (marcado) l.push(modulo);
      p.modulos = l.sort(alfa);
    },
    guardarPersona: guardarPersona,

    campoEvento: function (evento, campo, valor) {
      var m = E.matriz.find(function (x) { return x.evento === evento; });
      if (m) m[campo] = valor;
    },
    agregarDestino: function (evento) {
      var inp = document.getElementById('nm-dest-' + evento);
      var c = String((inp && inp.value) || '').toLowerCase().trim();
      if (!correoValido(c)) { alert('Escribe un correo completo, por ejemplo nombre@tecnocontrol.com.mx'); return; }
      var m = E.matriz.find(function (x) { return x.evento === evento; });
      if (!m) return;
      if ((m.destinatarios || []).map(function (d) { return String(d).toLowerCase(); }).indexOf(c) >= 0) { alert(nombreDe(c) + ' ya está en este evento.'); return; }
      m.destinatarios = (m.destinatarios || []).concat([c]);
      pintarCuerpo();
    },
    quitarDestino: function (evento, correo) {
      var m = E.matriz.find(function (x) { return x.evento === evento; });
      if (!m) return;
      m.destinatarios = (m.destinatarios || []).filter(function (d) { return String(d).toLowerCase() !== correo; });
      pintarCuerpo();
    },
    guardarEvento: guardarEvento,

    clasificar: function (tipo) {
      var sel = document.getElementById('nm-clas-' + tipo);
      clasificarTipo(tipo, sel && sel.value);
    },
  };
  window.__nm = A;

  // ───────────────────────────── pintado ─────────────────────────────
  var S = {
    btn: 'padding:8px 14px;border-radius:8px;border:none;background:' + C.navy + ';color:#fff;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px',
    btnSec: 'padding:8px 12px;border-radius:8px;border:1.5px solid ' + C.linea + ';background:#fff;color:' + C.tinta + ';font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px',
    input: 'padding:8px 10px;border:1.5px solid ' + C.linea + ';border-radius:8px;font-family:inherit;font-size:13px;color:' + C.tinta + ';background:#fff;box-sizing:border-box',
    tarjeta: 'border:1px solid ' + C.linea + ';border-radius:12px;padding:14px 16px;margin-bottom:10px;background:#fff',
    ayuda: 'font-size:12px;color:' + C.gris + ';line-height:1.5',
  };

  function abrir() {
    if (typeof window.esAdminTotal === 'function' && !window.esAdminTotal(yo())) {
      alert('Solo los administradores del portal pueden cambiar quién recibe qué.');
      return;
    }
    if (typeof window.tcSb !== 'function') { alert('No se encontró la conexión a Supabase (portal-supabase.js).'); return; }
    A.cerrar();
    var ov = document.createElement('div');
    ov.id = 'nm-ov';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box';
    ov.innerHTML = '<div id="nm-caja" role="dialog" aria-label="Quién recibe qué" style="background:' + C.fondo + ';border-radius:16px;width:100%;max-width:880px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 70px rgba(15,23,42,.35);font-family:inherit"></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) A.cerrar(); });
    document.body.appendChild(ov);
    cargar();
  }
  window.abrirMatrizNotificaciones = abrir;

  function pintar() {
    var caja = document.getElementById('nm-caja');
    if (!caja) return;
    var sinClasificar = E.retenidas.filter(function (r) { return r.modulo === 'Sin clasificar'; }).length;
    var tabs = [
      ['personas', I.persona, 'Personas', E.prefs.length],
      ['eventos', I.evento, 'Eventos', E.matriz.length],
      ['retenidas', I.retenido, 'Avisos retenidos', E.retenidas.length],
      ['historial', I.historial, 'Historial', 0],
    ];
    caja.innerHTML =
      '<div style="background:' + C.navy + ';color:#fff;padding:18px 22px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">' +
        '<div><div style="font-size:17px;font-weight:800">Quién recibe qué</div>' +
        '<div style="font-size:12px;opacity:.8;margin-top:3px">Avisos de todo el portal. Lo que cambies aquí aplica en cuanto se guarda.</div></div>' +
        '<button onclick="__nm.cerrar()" aria-label="Cerrar" style="background:rgba(255,255,255,.12);border:none;color:#fff;border-radius:8px;padding:6px;cursor:pointer;display:flex">' + I.cerrar + '</button>' +
      '</div>' +
      '<div style="display:flex;gap:4px;padding:10px 16px 0;border-bottom:1px solid ' + C.linea + ';background:#fff;overflow-x:auto">' +
        tabs.map(function (t) {
          var act = E.tab === t[0];
          var badge = t[0] === 'retenidas' && sinClasificar ? '<span style="background:' + C.rojo + ';color:#fff;border-radius:9px;font-size:10.5px;padding:1px 7px;margin-left:4px">' + sinClasificar + ' sin clasificar</span>' : '';
          return '<button onclick="__nm.tab(\'' + t[0] + '\')" style="padding:9px 14px;border:none;background:none;font-family:inherit;font-size:13px;font-weight:' + (act ? '800' : '600') +
            ';color:' + (act ? C.navy : C.gris) + ';border-bottom:3px solid ' + (act ? C.navy : 'transparent') + ';cursor:pointer;display:flex;align-items:center;gap:6px;white-space:nowrap">' +
            t[1] + t[2] + badge + '</button>';
        }).join('') +
      '</div>' +
      '<div id="nm-cuerpo" style="padding:16px 20px;overflow-y:auto;flex:1"></div>';
    pintarCuerpo();
  }

  function pintarCuerpo() {
    var el = document.getElementById('nm-cuerpo');
    if (!el) return;
    if (E.cargando) { el.innerHTML = '<div style="' + S.ayuda + ';padding:30px;text-align:center">Cargando…</div>'; return; }
    if (E.error) {
      el.innerHTML = '<div style="display:flex;gap:10px;background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;border-radius:10px;padding:14px;font-size:13px;line-height:1.5">' +
        I.aviso + '<div>' + esc(E.error) + '<div style="margin-top:10px"><button onclick="__nm.recargar()" style="' + S.btnSec + '">Volver a intentar</button></div></div></div>';
      return;
    }
    if (E.tab === 'personas') el.innerHTML = vistaPersonas();
    else if (E.tab === 'eventos') el.innerHTML = vistaEventos();
    else if (E.tab === 'retenidas') el.innerHTML = vistaRetenidas();
    else el.innerHTML = vistaHistorial();
    var b = document.getElementById('nm-busca');
    if (b && document.activeElement !== b && E.busca) { b.focus(); b.setSelectionRange(E.busca.length, E.busca.length); }
  }

  function buscador(placeholder) {
    return '<input id="nm-busca" type="search" value="' + esc(E.busca) + '" placeholder="' + esc(placeholder) +
      '" oninput="__nm.busca(this.value)" style="' + S.input + ';width:100%;margin-bottom:12px">';
  }
  function coincide(texto) {
    var b = E.busca.toLowerCase().trim();
    return !b || String(texto).toLowerCase().indexOf(b) >= 0;
  }
  function datalist() {
    return '<datalist id="nm-correos">' + correosConocidos().map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(nombreDe(c)) + '</option>';
    }).join('') + '</datalist>';
  }

  function vistaPersonas() {
    var lista = E.prefs.filter(function (p) { return coincide(p.correo + ' ' + (p.nombre || '') + ' ' + nombreDe(p.correo)); })
      .sort(function (a, b) { return alfa(a.nombre || nombreDe(a.correo), b.nombre || nombreDe(b.correo)); });
    var mods = modulos();
    var html = '<p style="' + S.ayuda + ';margin:0 0 12px">Quien no aparece en esta lista recibe todo como hasta hoy. Agrega a una persona para limitar sus avisos a ciertos módulos.</p>' +
      buscador('Buscar persona…') +
      '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">' +
        '<input id="nm-nueva-persona" list="nm-correos" placeholder="correo@tecnocontrol.com.mx" style="' + S.input + ';flex:1;min-width:220px">' +
        '<button onclick="__nm.agregarPersona()" style="' + S.btnSec + '">' + I.mas + 'Agregar persona</button>' +
      '</div>' + datalist();
    if (!lista.length) return html + '<div style="' + S.ayuda + ';padding:20px;text-align:center">' + (E.busca ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay reglas. Todos reciben todo.') + '</div>';
    return html + lista.map(function (p) {
      var c = esc(p.correo);
      var solo = p.modo === 'solo';
      return '<div style="' + S.tarjeta + (p.activo ? '' : ';opacity:.65') + '">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">' +
          '<div><div style="font-size:14px;font-weight:800;color:' + C.tinta + '">' + esc(p.nombre || nombreDe(p.correo)) + (p._nuevo ? ' <span style="font-size:11px;color:' + C.rojo + ';font-weight:700">sin guardar</span>' : '') + '</div>' +
          '<div style="font-size:12px;color:' + C.gris + '">' + c + '</div></div>' +
          '<select onchange="__nm.campoPersona(\'' + c + '\',\'modo\',this.value)" style="' + S.input + '">' +
            '<option value="todas"' + (solo ? '' : ' selected') + '>Recibe todo (como hoy)</option>' +
            '<option value="solo"' + (solo ? ' selected' : '') + '>Solo estos módulos</option>' +
          '</select>' +
        '</div>' +
        (solo ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">' + mods.map(function (m) {
          var on = (p.modulos || []).indexOf(m) >= 0;
          return '<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:20px;border:1.5px solid ' + (on ? C.navy : C.linea) +
            ';background:' + (on ? '#EEF2FF' : '#fff') + ';font-size:12.5px;cursor:pointer;color:' + C.tinta + '">' +
            '<input type="checkbox"' + (on ? ' checked' : '') + ' onchange="__nm.moduloPersona(\'' + c + '\',\'' + esc(m) + '\',this.checked);this.parentNode.style.borderColor=this.checked?\'' + C.navy + '\':\'' + C.linea + '\';this.parentNode.style.background=this.checked?\'#EEF2FF\':\'#fff\'">' +
            esc(m) + '</label>';
        }).join('') + '</div>' : '') +
        '<div style="display:grid;gap:6px;margin-top:10px">' +
          casilla(c, 'incluir_personales', p.incluir_personales, 'También lo personal: tareas asignadas a esta persona y cuando la mencionan') +
          casilla(c, 'incluir_acciones', p.incluir_acciones, 'También autorizaciones que esperan su firma, aunque sean de otro módulo') +
          casilla(c, 'activo', p.activo, 'Regla activa (si la apagas, vuelve a recibir todo)') +
        '</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
          '<input value="' + esc(p.nota || '') + '" placeholder="Nota: por qué tiene esta regla" onchange="__nm.campoPersona(\'' + c + '\',\'nota\',this.value)" style="' + S.input + ';flex:1;min-width:200px">' +
          '<button onclick="__nm.guardarPersona(\'' + c + '\')" style="' + S.btn + '">Guardar</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  function casilla(correo, campo, valor, texto) {
    return '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:' + C.tinta + ';cursor:pointer">' +
      '<input type="checkbox"' + (valor ? ' checked' : '') + ' onchange="__nm.campoPersona(\'' + correo + '\',\'' + campo + '\',this.checked)" style="margin-top:2px">' +
      '<span>' + esc(texto) + '</span></label>';
  }

  function vistaEventos() {
    var lista = E.matriz.filter(function (m) { return coincide(m.evento + ' ' + (m.descripcion || '') + ' ' + m.modulo + ' ' + (m.destinatarios || []).join(' ')); })
      .sort(function (a, b) { return alfa(a.descripcion || a.evento, b.descripcion || b.evento); });
    var mods = modulos();
    var html = '<p style="' + S.ayuda + ';margin:0 0 12px">Cada evento avisa a las personas de su lista. Los eventos se van conectando en las siguientes fases (viáticos, facturación, comisiones).</p>' +
      buscador('Buscar evento o persona…') + datalist();
    if (!lista.length) return html + '<div style="' + S.ayuda + ';padding:20px;text-align:center">' + (E.busca ? 'Ningún evento coincide.' : 'No hay eventos todavía.') + '</div>';
    return html + lista.map(function (m) {
      var ev = esc(m.evento);
      var dest = (m.destinatarios || []).slice().sort(function (a, b) { return alfa(nombreDe(a), nombreDe(b)); });
      return '<div style="' + S.tarjeta + (m.activo ? '' : ';opacity:.65') + '">' +
        '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">' +
          '<div><div style="font-size:14px;font-weight:800;color:' + C.tinta + '">' + esc(m.descripcion || m.evento) + '</div>' +
          '<div style="font-size:11.5px;color:' + C.gris + '">Clave: ' + ev + '</div></div>' +
          '<select onchange="__nm.campoEvento(\'' + ev + '\',\'modulo\',this.value)" style="' + S.input + '" aria-label="Módulo">' +
            mods.map(function (x) { return '<option' + (x === m.modulo ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">' +
          (dest.length ? dest.map(function (d) {
            var dl = esc(String(d).toLowerCase());
            return '<span style="display:inline-flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;border-radius:20px;background:#EEF2FF;border:1px solid #C7D2FE;font-size:12.5px;color:' + C.tinta + '" title="' + dl + '">' +
              esc(nombreDe(d)) + '<button onclick="__nm.quitarDestino(\'' + ev + '\',\'' + dl + '\')" aria-label="Quitar" style="border:none;background:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + C.gris + ';padding:0">' + I.quitar + '</button></span>';
          }).join('') : '<span style="font-size:12.5px;color:' + C.rojo + '">Nadie recibe este evento.</span>') +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
          '<input id="nm-dest-' + ev + '" list="nm-correos" placeholder="Agregar correo" style="' + S.input + ';flex:1;min-width:200px">' +
          '<button onclick="__nm.agregarDestino(\'' + ev + '\')" style="' + S.btnSec + '">' + I.mas + 'Agregar</button>' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer"><input type="checkbox"' + (m.activo ? ' checked' : '') + ' onchange="__nm.campoEvento(\'' + ev + '\',\'activo\',this.checked)">Activo</label>' +
          '<button onclick="__nm.guardarEvento(\'' + ev + '\')" style="' + S.btn + '">Guardar</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function vistaRetenidas() {
    var mods = modulos();
    var tiposSin = {};
    E.retenidas.forEach(function (r) { if (r.modulo === 'Sin clasificar' && r.tipo) tiposSin[r.tipo] = (tiposSin[r.tipo] || 0) + 1; });
    var claves = Object.keys(tiposSin).sort(alfa);
    var lista = E.retenidas.filter(function (r) { return coincide((r.para || '') + ' ' + nombreDe(r.para) + ' ' + (r.modulo || '') + ' ' + (r.mensaje || '') + ' ' + (r.tipo || '')); });
    var html = '<p style="' + S.ayuda + ';margin:0 0 12px">Avisos que no se entregaron porque la persona tiene "Solo estos módulos". Revísalos de vez en cuando para confirmar que no se está perdiendo nada importante.</p>';
    if (claves.length) {
      html += '<div style="' + S.tarjeta + ';border-color:#FECACA;background:#FEF2F2">' +
        '<div style="display:flex;gap:8px;align-items:center;font-size:13.5px;font-weight:800;color:#991B1B;margin-bottom:6px">' + I.aviso + 'Avisos sin módulo</div>' +
        '<div style="font-size:12.5px;color:#7F1D1D;margin-bottom:10px">El portal no sabe a qué módulo pertenecen, así que se retuvieron. Elige su módulo y los siguientes ya se entregarán bien.</div>' +
        claves.map(function (t) {
          var te = esc(t);
          return '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 0;border-top:1px solid #FECACA">' +
            '<span style="font-size:13px;font-weight:700;color:' + C.tinta + ';flex:1;min-width:160px">' + te + ' <span style="font-weight:500;color:' + C.gris + '">(' + tiposSin[t] + ')</span></span>' +
            '<select id="nm-clas-' + te + '" style="' + S.input + '"><option value="">Elegir módulo…</option>' + mods.map(function (m) { return '<option>' + esc(m) + '</option>'; }).join('') + '</select>' +
            '<button onclick="__nm.clasificar(\'' + te + '\')" style="' + S.btn + '">Clasificar</button></div>';
        }).join('') + '</div>';
    }
    html += buscador('Buscar por persona, módulo o texto…');
    if (!lista.length) return html + '<div style="' + S.ayuda + ';padding:20px;text-align:center">' + (E.busca ? 'Ningún aviso coincide.' : 'No hay avisos retenidos.') + '</div>';
    return html + '<div style="overflow-x:auto;border:1px solid ' + C.linea + ';border-radius:10px;background:#fff">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:560px">' +
      '<thead><tr style="background:' + C.fondo + ';text-align:left;color:' + C.gris + '"><th style="padding:9px 10px">Cuándo</th><th style="padding:9px 10px">Para</th><th style="padding:9px 10px">Módulo</th><th style="padding:9px 10px">Aviso</th></tr></thead><tbody>' +
      lista.map(function (r) {
        return '<tr style="border-top:1px solid ' + C.linea + '">' +
          '<td style="padding:8px 10px;white-space:nowrap;color:' + C.gris + '">' + esc(fecha(r.creada_en)) + '</td>' +
          '<td style="padding:8px 10px;white-space:nowrap">' + esc(nombreDe(r.para)) + '</td>' +
          '<td style="padding:8px 10px;white-space:nowrap;' + (r.modulo === 'Sin clasificar' ? 'color:' + C.rojo + ';font-weight:700' : '') + '">' + esc(r.modulo) + '</td>' +
          '<td style="padding:8px 10px;color:' + C.tinta + '">' + esc(r.mensaje || r.tipo || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function resumenCambio(b) {
    if (b.accion === 'INSERT') return 'Creó la regla';
    if (b.accion === 'DELETE') return 'Borró la regla';
    var a = b.antes || {}, d = b.despues || {}, cambios = [];
    Object.keys(CAMPOS_LEGIBLES).forEach(function (k) {
      if (JSON.stringify(a[k]) !== JSON.stringify(d[k]) && (k in d)) {
        var v = d[k];
        if (Array.isArray(v)) v = v.length ? v.map(function (x) { return String(x).indexOf('@') > 0 ? nombreDe(x) : x; }).join(', ') : 'ninguno';
        if (v === true) v = 'sí'; if (v === false) v = 'no';
        if (k === 'modo') v = v === 'solo' ? 'solo estos módulos' : 'recibe todo';
        cambios.push(CAMPOS_LEGIBLES[k] + ': ' + v);
      }
    });
    return cambios.length ? cambios.join(' · ') : 'Guardó sin cambios';
  }
  function vistaHistorial() {
    var lista = E.bitacora.filter(function (b) { return coincide((b.hecho_por || '') + ' ' + nombreDe(b.hecho_por || '') + ' ' + (b.clave || '') + ' ' + nombreDe(b.clave || '')); });
    var html = '<p style="' + S.ayuda + ';margin:0 0 12px">Cada cambio a estas reglas queda registrado: quién lo hizo, cuándo y qué cambió.</p>' + buscador('Buscar por persona o regla…');
    if (!lista.length) return html + '<div style="' + S.ayuda + ';padding:20px;text-align:center">Sin cambios registrados.</div>';
    return html + '<div style="overflow-x:auto;border:1px solid ' + C.linea + ';border-radius:10px;background:#fff">' +
      '<table style="width:100%;border-collapse:collapse;font-size:12.5px;min-width:600px">' +
      '<thead><tr style="background:' + C.fondo + ';text-align:left;color:' + C.gris + '"><th style="padding:9px 10px">Cuándo</th><th style="padding:9px 10px">Quién</th><th style="padding:9px 10px">Regla</th><th style="padding:9px 10px">Cambio</th></tr></thead><tbody>' +
      lista.map(function (b) {
        var regla = (TABLAS_LEGIBLES[b.tabla] || b.tabla) + ': ' + (String(b.clave || '').indexOf('@') > 0 ? nombreDe(b.clave) : (b.clave || ''));
        return '<tr style="border-top:1px solid ' + C.linea + '">' +
          '<td style="padding:8px 10px;white-space:nowrap;color:' + C.gris + '">' + esc(fecha(b.hecho_en)) + '</td>' +
          '<td style="padding:8px 10px;white-space:nowrap">' + esc(b.hecho_por === 'fase1' ? 'Carga inicial' : nombreDe(b.hecho_por || '')) + '</td>' +
          '<td style="padding:8px 10px;white-space:nowrap">' + esc(regla) + '</td>' +
          '<td style="padding:8px 10px;color:' + C.tinta + '">' + esc(resumenCambio(b)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
})();
