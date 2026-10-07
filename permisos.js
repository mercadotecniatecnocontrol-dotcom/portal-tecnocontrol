// ══════════════════════════════════════════════════════════════════
// permisos.js — Permisos, vacaciones y ausencias (oct-2026)
// Módulo compartido (un solo dueño de las reglas) que usan:
//   · App de Flotilla:  window.tcPermisos.movil(contenedor, ctx)   → pedir y ver mis solicitudes
//   · Operaciones y RH: window.tcPermisos.panel(contenedor, opts)  → aprobar / rechazar, calendario, historial
// Reglas:
//   · Si otra persona del mismo departamento (y plaza) ya pidió esas fechas, o ya tiene una
//     ausencia registrada, la solicitud se BLOQUEA. Solo pasa si se marca como URGENTE con
//     motivo, y queda señalada para análisis interno.
//   · Lo mismo si se pide con menos días de anticipación de los configurados (salvo incapacidad).
//   · Al aprobar: se registra la ausencia en Operaciones (ops_tecnico_ausencias) para que el
//     calendario y la rotación de guardias ya no le asignen trabajo esas fechas.
//   · Historial completo (quién aprobó/rechazó y a qué hora) y avisos a RH, aprobadores y al
//     colaborador (campanita del portal y app de Flotilla).
// Formato impreso: HTC-FR-1201-13 "Solicitud de Permiso".
// Tablas (Supabase): rh_solicitudes_ausencia, rh_config_permisos.
// ══════════════════════════════════════════════════════════════════
(function () {
'use strict';
if (window.tcPermisos) return;

const SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
const SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
let _cli = null, _cliP = null;
function sb() {
  if (window.tcSupabase) return Promise.resolve(window.tcSupabase);
  if (_cli) return Promise.resolve(_cli);
  if (_cliP) return _cliP;
  _cliP = import('https://esm.sh/@supabase/supabase-js@2').then(m => { _cli = m.createClient(SB_URL, SB_KEY); return _cli; })
    .catch(e => { _cliP = null; throw e; });
  return _cliP;
}

const TIPOS = {
  vacaciones: { t: 'Vacaciones', d: 'Días de vacaciones', c: '#0e7490', bg: '#cffafe' },
  permiso: { t: 'Permiso', d: 'Con o sin goce de sueldo', c: '#1d4ed8', bg: '#dbeafe' },
  ausencia: { t: 'Ausencia', d: 'A cuenta de vacaciones o pago con horas', c: '#b45309', bg: '#fef3c7' },
  incapacidad: { t: 'Incapacidad', d: 'Con comprobante del IMSS', c: '#b91c1c', bg: '#fee2e2' },
};
const GOCE = {
  permiso: [['con_goce', 'Con goce de sueldo'], ['sin_goce', 'Sin goce de sueldo']],
  ausencia: [['a_cuenta_vacaciones', 'A cuenta de vacaciones'], ['pago_horas', 'Pago con horas'], ['sin_goce', 'Sin goce de sueldo']],
};
const GOCE_TXT = { con_goce: 'Con goce', sin_goce: 'Sin goce', a_cuenta_vacaciones: 'A cuenta de vacaciones', pago_horas: 'Pago con horas' };
const EST = { 'Pendiente': ['#b45309', '#fef3c7'], 'Aprobada': ['#15803d', '#dcfce7'], 'Rechazada': ['#b91c1c', '#fee2e2'], 'Cancelada': ['#64748b', '#f1f5f9'] };
const CFG_DEF = { correosRH: ['rh@tecnocontrol.com.mx'], aprobadores: [], maxMismoGrupo: 1, diasAnticipacion: 3 };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
function hoy() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function sumar(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function fCorta(iso) { if (!iso) return '—'; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); }
function fLarga(iso) { if (!iso) return ''; const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(); }
function fHora(iso) { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? iso : d.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
// Días hábiles lunes a sábado (domingo no cuenta).
function diasHabiles(ini, fin) { if (!ini || !fin || fin < ini) return 0; let n = 0, d = ini; while (d <= fin) { if (new Date(d + 'T12:00:00').getDay() !== 0) n++; d = sumar(d, 1); } return n; }
function chip(txt, c, bg) { return '<span style="display:inline-block;background:' + bg + ';color:' + c + ';font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap">' + esc(txt) + '</span>'; }
function chipEst(e) { const m = EST[e] || ['#334155', '#f1f5f9']; return chip(e, m[0], m[1]); }
function chipTipo(t) { const m = TIPOS[t] || { t: t, c: '#334155', bg: '#f1f5f9' }; return chip(m.t, m.c, m.bg); }
const ICO = {
  alerta: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  ok: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>',
  cerrar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  imprimir: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
};

// ── Datos ──
let cfg = Object.assign({}, CFG_DEF);
async function cargarCfg() {
  try { const c = await sb(); const r = await c.from('rh_config_permisos').select('datos').eq('id', 'general').maybeSingle(); if (r.data && r.data.datos) cfg = Object.assign({}, CFG_DEF, r.data.datos); } catch (e) {}
  return cfg;
}
async function perfilPorCorreo(correo) {
  try {
    const c = await sb();
    const r = await c.from('ops_tecnicos').select('id,nombre,correo,departamento,plaza,puesto,supervisor,estatus').ilike('correo', correo).limit(5);
    const l = (r.data || []).filter(t => t.estatus !== 'baja');
    return l[0] || (r.data || [])[0] || null;
  } catch (e) { return null; }
}
function mismoGrupo(a, b) {
  if (norm(a.departamento) !== norm(b.departamento)) return false;
  if (a.plaza && b.plaza && norm(a.plaza) !== norm(b.plaza)) return false;
  return true;
}
// Revisa traslapes: mismas fechas en el mismo grupo, propias duplicadas, ausencias ya registradas y guardias.
async function revisar(s) {
  const r = { propias: [], grupo: [], registradas: [], guardias: [], anticipacion: false };
  if (!s.fecha_inicio || !s.fecha_fin) return r;
  const c = await sb();
  const q = await c.from('rh_solicitudes_ausencia').select('id,folio,colaborador_email,colaborador_nombre,departamento,plaza,fecha_inicio,fecha_fin,estatus,tipo,urgente')
    .in('estatus', ['Pendiente', 'Aprobada']).lte('fecha_inicio', s.fecha_fin).gte('fecha_fin', s.fecha_inicio).limit(200);
  (q.data || []).forEach(o => {
    if (s.id && o.id === s.id) return;
    if (String(o.colaborador_email || '').toLowerCase() === String(s.colaborador_email || '').toLowerCase()) r.propias.push(o);
    else if (mismoGrupo(o, s)) r.grupo.push(o);
  });
  // Ausencias capturadas a mano en Operaciones para compañeros del mismo departamento.
  try {
    if (s.departamento) {
      const t = await c.from('ops_tecnicos').select('id,nombre,departamento,plaza,estatus').ilike('departamento', s.departamento).limit(300);
      const comp = (t.data || []).filter(x => x.estatus !== 'baja' && x.id !== s.tecnico_id && mismoGrupo(x, s));
      if (comp.length) {
        const a = await c.from('ops_tecnico_ausencias').select('id,tecnico_id,tipo,fecha_inicio,fecha_fin,motivo')
          .in('tecnico_id', comp.map(x => x.id)).lte('fecha_inicio', s.fecha_fin).gte('fecha_fin', s.fecha_inicio);
        const yaEnSolicitud = new Set(r.grupo.map(g => norm(g.colaborador_nombre)));
        (a.data || []).forEach(x => {
          const p = comp.find(y => y.id === x.tecnico_id);
          if (!/^PER-/.test(String(x.motivo || '')) && p && !yaEnSolicitud.has(norm(p.nombre))) r.registradas.push(Object.assign({ nombre: p.nombre }, x));
        });
      }
    }
  } catch (e) {}
  // Guardia programada en esas semanas.
  try {
    if (s.tecnico_id) {
      const g = await c.from('ops_guardias_programadas').select('semana_inicio,tecnico_id').eq('tecnico_id', s.tecnico_id)
        .gte('semana_inicio', sumar(s.fecha_inicio, -6)).lte('semana_inicio', s.fecha_fin);
      r.guardias = g.data || [];
    }
  } catch (e) {}
  r.anticipacion = s.tipo !== 'incapacidad' && s.fecha_inicio < sumar(hoy(), Number(cfg.diasAnticipacion || 0));
  return r;
}
function bloqueada(r) { return r.grupo.length + r.registradas.length >= Math.max(1, Number(cfg.maxMismoGrupo || 1)) || r.anticipacion; }
function revisionHTML(r, compacto) {
  const p = [];
  const caja = (c, bg, html) => '<div style="display:flex;gap:7px;background:' + bg + ';color:' + c + ';border-radius:10px;padding:9px 11px;font-size:12px;line-height:1.4;margin-top:8px">' + ICO.alerta + '<div>' + html + '</div></div>';
  if (r.propias.length) p.push(caja('#b91c1c', '#fef2f2', 'Ya hay una solicitud tuya en esas fechas: ' + r.propias.map(o => '<b>' + esc(o.folio || '') + '</b> (' + esc(o.estatus) + ', ' + fCorta(o.fecha_inicio) + ' a ' + fCorta(o.fecha_fin) + ')').join(', ') + '.'));
  if (r.grupo.length) p.push(caja('#92400e', '#fffbeb', '<b>Alguien más ya pidió esas fechas:</b> ' + r.grupo.map(o => esc(o.colaborador_nombre || o.colaborador_email) + ' — ' + fCorta(o.fecha_inicio) + ' a ' + fCorta(o.fecha_fin) + ' (' + esc(o.estatus) + (o.urgente ? ', urgente' : '') + ')').join('; ') + '.'));
  if (r.registradas.length) p.push(caja('#92400e', '#fffbeb', '<b>Ya hay ausencias registradas en tu área:</b> ' + r.registradas.map(o => esc(o.nombre) + ' — ' + esc(o.tipo) + ' ' + fCorta(o.fecha_inicio) + ' a ' + fCorta(o.fecha_fin)).join('; ') + '.'));
  if (r.anticipacion) p.push(caja('#92400e', '#fffbeb', 'Se pide con menos de <b>' + esc(cfg.diasAnticipacion) + ' día(s)</b> de anticipación.'));
  if (r.guardias.length) p.push(caja('#1d4ed8', '#eff6ff', 'Tienes <b>guardia programada</b> la semana del ' + r.guardias.map(g => fCorta(g.semana_inicio)).join(', ') + '. Hay que reasignarla.'));
  if (!p.length && !compacto) p.push('<div style="display:flex;gap:7px;background:#f0fdf4;color:#166534;border-radius:10px;padding:9px 11px;font-size:12px;margin-top:8px">' + ICO.ok + '<div>Nadie más de tu área pidió esas fechas.</div></div>');
  return p.join('');
}

function idNotif() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
async function avisarPortal(para, tipo, mensaje, datos) {
  if (!para) return;
  try { const c = await sb(); await c.from('portal_notificaciones').insert({ tipo: tipo, para: String(para).toLowerCase(), mensaje: mensaje, datos: Object.assign({ modulo: 'RH' }, datos || {}) }); } catch (e) { console.warn('[permisos] aviso portal', e); }
}
async function avisarApp(para, tipo, mensaje, s) {
  if (!para) return;
  try { const c = await sb(); await c.from('ops_notificaciones').insert({ id: idNotif(), tipo: tipo, para: String(para).toLowerCase(), mensaje: mensaje, folio: s.folio || null, solicitud_id: String(s.id), leida: false, fecha: new Date().toISOString() }); } catch (e) { console.warn('[permisos] aviso app', e); }
}
function correosAvisoNueva() {
  return [...new Set([].concat(cfg.correosRH || [], cfg.aprobadores || []).map(x => String(x).toLowerCase().trim()).filter(Boolean))];
}

async function crearSolicitud(s, r) {
  const c = await sb();
  const fila = Object.assign({}, s, {
    traslapes: [].concat(r.grupo.map(o => ({ tipo: 'solicitud', nombre: o.colaborador_nombre, folio: o.folio, inicio: o.fecha_inicio, fin: o.fecha_fin, estatus: o.estatus })),
      r.registradas.map(o => ({ tipo: 'ausencia', nombre: o.nombre, inicio: o.fecha_inicio, fin: o.fecha_fin, estatus: o.tipo })),
      r.guardias.map(g => ({ tipo: 'guardia', semana: g.semana_inicio })), r.anticipacion ? [{ tipo: 'anticipacion', dias: cfg.diasAnticipacion }] : []),
    estatus: 'Pendiente',
    historial: [{ accion: 'Solicitada' + (s.urgente ? ' (URGENTE)' : ''), por: s.colaborador_email, porNombre: s.colaborador_nombre, en: new Date().toISOString(), comentario: s.urgente ? s.urgente_motivo : null }],
  });
  const ins = await c.from('rh_solicitudes_ausencia').insert(fila).select().single();
  if (ins.error) throw ins.error;
  const folio = 'PER-' + String(ins.data.id).padStart(5, '0');
  await c.from('rh_solicitudes_ausencia').update({ folio: folio }).eq('id', ins.data.id);
  ins.data.folio = folio;
  const msg = (s.urgente ? 'URGENTE · ' : '') + s.colaborador_nombre + ' solicita ' + TIPOS[s.tipo].t.toLowerCase() + ' ' + folio + ': ' + fCorta(s.fecha_inicio) + (s.fecha_fin !== s.fecha_inicio ? ' a ' + fCorta(s.fecha_fin) : '') + (fila.traslapes.length ? ' · se empalma con otra solicitud o ausencia' : '') + '.';
  correosAvisoNueva().forEach(p => avisarPortal(p, s.urgente ? 'permiso_urgente' : 'permiso_solicitud', msg, { solicitudId: ins.data.id }));
  return ins.data;
}

async function resolver(s, estatus, usuario, comentario) {
  const c = await sb();
  const ahora = new Date().toISOString();
  const cambios = {
    estatus: estatus, resuelto_por: usuario.correo, resuelto_nombre: usuario.nombre, resuelto_en: ahora, comentario_resolucion: comentario || null, actualizado_en: ahora,
    historial: (s.historial || []).concat([{ accion: estatus, por: usuario.correo, porNombre: usuario.nombre, en: ahora, comentario: comentario || null }]),
  };
  // Al aprobar: se aparta en el calendario de Operaciones.
  if (estatus === 'Aprobada' && s.tecnico_id && !s.ausencia_ops_id) {
    const tipoOps = s.tipo === 'vacaciones' ? 'vacaciones' : s.tipo === 'incapacidad' ? 'incapacidad' : 'permiso';
    const a = await c.from('ops_tecnico_ausencias').insert({ tecnico_id: s.tecnico_id, tipo: tipoOps, fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, motivo: (s.folio || 'PER') + ' · ' + (s.motivo || ''), creado_por: usuario.nombre || usuario.correo, fecha_alta: hoy() }).select('id').single();
    if (!a.error && a.data) cambios.ausencia_ops_id = a.data.id;
  }
  if ((estatus === 'Cancelada' || estatus === 'Rechazada') && s.ausencia_ops_id) {
    await c.from('ops_tecnico_ausencias').delete().eq('id', s.ausencia_ops_id);
    cambios.ausencia_ops_id = null;
  }
  const u = await c.from('rh_solicitudes_ausencia').update(cambios).eq('id', s.id);
  if (u.error) throw u.error;
  Object.assign(s, cambios);
  const rango = fCorta(s.fecha_inicio) + (s.fecha_fin !== s.fecha_inicio ? ' a ' + fCorta(s.fecha_fin) : '');
  if (estatus !== 'Cancelada' || usuario.correo !== s.colaborador_email) {
    const m = 'Tu solicitud ' + s.folio + ' (' + TIPOS[s.tipo].t.toLowerCase() + ', ' + rango + ') fue ' + estatus.toUpperCase() + ' por ' + (usuario.nombre || usuario.correo) + (comentario ? '. Comentario: ' + comentario : '') + '.';
    avisarApp(s.colaborador_email, estatus === 'Aprobada' ? 'perm_tec_aprobada' : estatus === 'Rechazada' ? 'perm_tec_rechazada' : 'perm_tec_cancelada', m, s);
    avisarPortal(s.colaborador_email, 'permiso_' + estatus.toLowerCase(), m, { solicitudId: s.id });
  }
  (cfg.correosRH || []).forEach(p => avisarPortal(p, 'permiso_' + estatus.toLowerCase(), s.colaborador_nombre + ': ' + s.folio + ' ' + estatus.toLowerCase() + ' por ' + (usuario.nombre || usuario.correo) + ' (' + rango + ').', { solicitudId: s.id }));
}

// ── Formato HTC-FR-1201-13 (imprimible) ──
function imprimir(s) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permite ventanas emergentes para imprimir.'); return; }
  const x = v => v ? 'X' : '&nbsp;';
  const apr = (s.historial || []).slice().reverse().find(h => h.accion === 'Aprobada' || h.accion === 'Rechazada');
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(s.folio) + '</title><style>' +
    'body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:26px}table{width:100%;border-collapse:collapse;margin-bottom:10px}td,th{border:1px solid #444;padding:6px;vertical-align:top}' +
    'th{background:#1D2E73;color:#fff;text-align:left}.h{text-align:center;font-size:16px;font-weight:bold;margin:4px 0 12px}.l{color:#555;font-size:10.5px;display:block}.b{display:inline-block;width:16px;height:14px;border:1px solid #111;text-align:center;font-weight:bold;margin-right:4px}' +
    '.f{height:48px}.p{font-size:9.5px;color:#444}@media print{button{display:none}}</style></head><body>' +
    '<div style="display:flex;justify-content:space-between;font-size:10.5px"><b>HEDMA TECNOCONTROL SA DE CV</b><span>HTC-FR-1201-13 · ' + esc(s.folio || '') + '</span></div>' +
    '<div class="h">Solicitud de Permiso' + (s.urgente ? ' · URGENTE' : '') + '</div>' +
    '<table><tr><th colspan="2">Datos generales</th></tr><tr><td colspan="2"><span class="l">Nombre completo</span>' + esc(s.colaborador_nombre) + '</td></tr>' +
    '<tr><td><span class="l">Departamento</span>' + esc(s.departamento || '') + '</td><td><span class="l">Jefe inmediato</span>' + esc(s.jefe || '') + '</td></tr>' +
    '<tr><td><span class="l">Puesto</span>' + esc(s.puesto || '') + '</td><td><span class="l">Plaza / área</span>' + esc(s.plaza || '') + '</td></tr></table>' +
    '<table><tr><th colspan="2">Días solicitados</th></tr><tr><td><span class="l">Fecha de inicio</span>' + fLarga(s.fecha_inicio) + '</td><td><span class="l">Fecha de término</span>' + fLarga(s.fecha_fin) + '</td></tr>' +
    '<tr><td colspan="2"><span class="l">No. de días / No. de horas</span>' + esc(s.dias || '') + ' día(s)' + (s.horas ? ' · ' + esc(s.horas) + ' hora(s)' : '') + '</td></tr>' +
    '<tr><td><span class="b">' + x(s.tipo === 'ausencia' || s.tipo === 'pago_horas') + '</span>Ausencia &nbsp; <span class="b">' + x(s.goce === 'a_cuenta_vacaciones' || s.tipo === 'vacaciones') + '</span>A cuenta de vacaciones &nbsp; <span class="b">' + x(s.goce === 'pago_horas' || s.tipo === 'pago_horas') + '</span>Pago con horas</td>' +
    '<td><span class="b">' + x(s.tipo === 'permiso' || s.tipo === 'incapacidad') + '</span>Permiso &nbsp; <span class="b">' + x(s.goce === 'con_goce') + '</span>Con goce &nbsp; <span class="b">' + x(s.goce === 'sin_goce') + '</span>Sin goce</td></tr></table>' +
    '<table><tr><th>Motivo del permiso' + (s.tipo === 'vacaciones' ? ' (vacaciones)' : s.tipo === 'incapacidad' ? ' (incapacidad)' : '') + '</th></tr><tr><td style="min-height:40px">' + esc(s.motivo || '') + (s.urgente_motivo ? '<br><b>Urgente:</b> ' + esc(s.urgente_motivo) : '') + '</td></tr></table>' +
    '<table><tr><th>Observaciones</th></tr><tr><td>' + esc(s.como_repone || '') + (s.comentario_resolucion ? '<br>' + esc(s.comentario_resolucion) : '') + '</td></tr></table>' +
    '<table><tr><td><span class="l">Solicitante</span>' + esc(s.colaborador_nombre) + '<div class="f"></div><span class="l">Fecha de solicitud: ' + fHora(s.creado_en) + '</span></td>' +
    '<td><span class="l">Jefe inmediato / autoriza</span>' + esc(apr ? apr.porNombre || apr.por : '') + '<div class="f"></div><span class="l">' + (apr ? apr.accion + ': ' + fHora(apr.en) : 'Fecha de aprobación:') + '</span></td></tr></table>' +
    '<div class="p">Estatus en el portal: ' + esc(s.estatus) + '. Documento generado desde el Portal Operativo Tecnocontrol.</div>' +
    '<table style="margin-top:14px" class="p"><tr><th>Elaboró</th><th>Revisó</th><th>Autorizó</th></tr><tr><td>Oscar Perez · Gestor Ejecutivo del SGC</td><td>Paloma Pinedo · Representante Alta Dirección</td><td>Ing. Martin de la O · Director General</td></tr></table>' +
    '<button onclick="print()" style="margin-top:12px;padding:8px 16px">Imprimir</button></body></html>');
  w.document.close();
}

// ══════════════════════ APP DEL TÉCNICO ══════════════════════
const M = { cont: null, ctx: null, modo: 'lista', lista: [], f: null, rev: null, revT: null, perfil: null, enviando: false, error: '' };
function mEstilo(base) { return 'width:100%;box-sizing:border-box;border:1.5px solid #CBD5E1;border-radius:10px;padding:10px;font-family:inherit;font-size:14px;background:#fff;' + (base || ''); }
async function movil(cont, ctx) {
  M.cont = cont; M.ctx = ctx || {}; M.modo = 'lista'; M.error = '';
  cont.innerHTML = '<p style="text-align:center;color:#94A3B8;font-size:13px;padding:24px">Cargando…</p>';
  await cargarCfg();
  M.perfil = await perfilPorCorreo(M.ctx.correo) || {};
  await mCargar();
  mRender();
}
async function mCargar() {
  try { const c = await sb(); const r = await c.from('rh_solicitudes_ausencia').select('*').ilike('colaborador_email', M.ctx.correo).order('fecha_inicio', { ascending: false }).limit(60); M.lista = r.data || []; }
  catch (e) { M.lista = []; }
}
function mRender() {
  if (!M.cont) return;
  if (M.modo === 'nueva') return mRenderForm();
  const prox = M.lista.filter(s => s.estatus !== 'Cancelada' && s.fecha_fin >= hoy());
  const pasadas = M.lista.filter(s => !(s.estatus !== 'Cancelada' && s.fecha_fin >= hoy())).slice(0, 15);
  const card = s => '<div style="background:#fff;border:1.5px solid ' + (s.estatus === 'Rechazada' ? '#FECACA' : '#E2E8F0') + ';border-radius:14px;padding:12px 13px;margin-bottom:10px">' +
    '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div><div style="font-size:13.5px;font-weight:900;color:#0A1628">' + esc(TIPOS[s.tipo] ? TIPOS[s.tipo].t : s.tipo) + (s.goce ? ' · ' + esc(GOCE_TXT[s.goce] || s.goce) : '') + '</div>' +
    '<div style="font-size:12px;color:#475569">' + fCorta(s.fecha_inicio) + (s.fecha_fin !== s.fecha_inicio ? ' a ' + fCorta(s.fecha_fin) : '') + ' · ' + esc(s.dias || '') + ' día(s)' + (s.horas ? ' · ' + esc(s.horas) + ' h' : '') + '</div>' +
    '<div style="font-size:10.5px;color:#94A3B8">' + esc(s.folio || '') + (s.urgente ? ' · urgente' : '') + '</div></div>' + chipEst(s.estatus) + '</div>' +
    (s.resuelto_nombre && s.estatus !== 'Pendiente' ? '<div style="font-size:11.5px;color:#475569;margin-top:6px">' + esc(s.estatus) + ' por <b>' + esc(s.resuelto_nombre) + '</b> · ' + fHora(s.resuelto_en) + (s.comentario_resolucion ? '<br>"' + esc(s.comentario_resolucion) + '"' : '') + '</div>' : '') +
    (s.estatus === 'Pendiente' ? '<button onclick="tcPermisos._mCancelar(' + s.id + ')" style="margin-top:8px;padding:8px 12px;background:#fff;border:1.5px solid #FECACA;border-radius:9px;color:#B91C1C;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Cancelar solicitud</button>' : '') +
    '</div>';
  M.cont.innerHTML =
    '<button onclick="tcPermisos._mNueva()" style="width:100%;padding:13px;background:#1D2E73;border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:14px">+ Nueva solicitud</button>' +
    '<div style="font-size:12px;font-weight:800;color:#64748B;margin:0 0 6px">PRÓXIMAS Y PENDIENTES</div>' +
    (prox.length ? prox.map(card).join('') : '<div style="text-align:center;color:#94A3B8;font-size:13px;padding:14px;background:#fff;border-radius:12px;margin-bottom:12px">No tienes solicitudes próximas.</div>') +
    (pasadas.length ? '<div style="font-size:12px;font-weight:800;color:#64748B;margin:14px 0 6px">HISTORIAL</div>' + pasadas.map(card).join('') : '');
}
function mNueva() {
  const p = M.perfil || {};
  M.f = { tipo: 'vacaciones', goce: '', fecha_inicio: sumar(hoy(), Number(cfg.diasAnticipacion || 0)), fecha_fin: '', horas: '', motivo: '', como_repone: '', urgente: false, urgente_motivo: '' };
  M.f.fecha_fin = M.f.fecha_inicio;
  M.modo = 'nueva'; M.rev = null; M.error = '';
  void p; mRender(); mRevisar();
}
function mSolicitudBase() {
  const p = M.perfil || {}, f = M.f, ctx = M.ctx;
  return {
    colaborador_email: String(ctx.correo || '').toLowerCase(), colaborador_nombre: p.nombre || ctx.nombre || ctx.correo, tecnico_id: p.id || null,
    departamento: p.departamento || ctx.departamento || null, plaza: p.plaza || ctx.plaza || null, puesto: p.puesto || ctx.puesto || null, jefe: p.supervisor || ctx.jefe || null,
    tipo: f.tipo, goce: GOCE[f.tipo] ? (f.goce || GOCE[f.tipo][0][0]) : null, fecha_inicio: f.fecha_inicio, fecha_fin: f.fecha_fin, dias: diasHabiles(f.fecha_inicio, f.fecha_fin),
    horas: f.horas ? Number(f.horas) : null, motivo: f.motivo.trim(), como_repone: f.como_repone.trim() || null, urgente: !!f.urgente, urgente_motivo: f.urgente ? f.urgente_motivo.trim() : null, origen: 'app', creado_por: ctx.correo,
  };
}
function mRevisar() {
  clearTimeout(M.revT);
  M.revT = setTimeout(async () => {
    const el = document.getElementById('tcp-rev'); if (el) el.innerHTML = '<div style="font-size:12px;color:#64748B;margin-top:8px">Revisando si alguien más pidió esas fechas…</div>';
    try { M.rev = await revisar(mSolicitudBase()); } catch (e) { M.rev = null; }
    if (M.modo === 'nueva') mRenderForm();
  }, 350);
}
function mPuede() {
  const f = M.f, b = mSolicitudBase();
  const bloq = M.rev ? bloqueada(M.rev) : false, propia = M.rev && M.rev.propias.length;
  return !!(M.rev && !propia && b.motivo && b.fecha_fin >= b.fecha_inicio && (!bloq || (f.urgente && String(f.urgente_motivo || '').trim())));
}
// Habilita el botón mientras se escribe, sin repintar (repintar quitaba el foco y el primer toque).
function mBoton() {
  const btn = document.getElementById('tcp-enviar'); if (!btn || M.enviando) return;
  const ok = mPuede();
  btn.disabled = !ok; btn.style.background = ok ? (M.f.urgente ? '#B91C1C' : '#15803D') : '#94A3B8'; btn.style.cursor = ok ? 'pointer' : 'not-allowed';
  const nota = document.getElementById('tcp-nota-motivo'); if (nota) nota.style.display = M.f.motivo.trim() ? 'none' : 'block';
}
function mRenderForm() {
  const f = M.f, b = mSolicitudBase();
  const lbl = t => '<div style="font-size:11px;font-weight:800;color:#475569;margin:13px 0 5px;text-transform:uppercase">' + t + '</div>';
  const chipBtn = (k, txt, on, fn) => '<button onclick="' + fn + '" style="padding:9px 12px;border-radius:999px;border:1.5px solid ' + (on ? '#1D2E73' : '#CBD5E1') + ';background:' + (on ? '#1D2E73' : '#fff') + ';color:' + (on ? '#fff' : '#334155') + ';font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">' + txt + '</button>';
  const bloq = M.rev ? bloqueada(M.rev) : false, propia = M.rev && M.rev.propias.length;
  const puede = mPuede();
  let h = '<button onclick="tcPermisos._mVolver()" style="background:none;border:none;color:#1D4ED8;font-family:inherit;font-size:12.5px;font-weight:700;padding:0;margin-bottom:6px;cursor:pointer">← Mis solicitudes</button>';
  h += lbl('¿Qué necesitas?') + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + Object.keys(TIPOS).map(k => chipBtn(k, TIPOS[k].t, f.tipo === k, "tcPermisos._mSet('tipo','" + k + "')")).join('') + '</div>' +
    '<div style="font-size:11px;color:#64748B;margin-top:5px">' + esc(TIPOS[f.tipo].d) + '</div>';
  if (GOCE[f.tipo]) h += lbl('Modalidad') + '<div style="display:flex;flex-wrap:wrap;gap:6px">' + GOCE[f.tipo].map(g => chipBtn(g[0], g[1], (f.goce || GOCE[f.tipo][0][0]) === g[0], "tcPermisos._mSet('goce','" + g[0] + "')")).join('') + '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
    '<div>' + lbl('Desde') + '<input type="date" value="' + esc(f.fecha_inicio) + '" onchange="tcPermisos._mSet(\'fecha_inicio\',this.value)" style="' + mEstilo() + '"></div>' +
    '<div>' + lbl('Hasta') + '<input type="date" value="' + esc(f.fecha_fin) + '" min="' + esc(f.fecha_inicio) + '" onchange="tcPermisos._mSet(\'fecha_fin\',this.value)" style="' + mEstilo() + '"></div></div>' +
    '<div style="font-size:11.5px;color:#475569;margin-top:5px">' + b.dias + ' día(s) hábiles (lunes a sábado)</div>';
  if (f.fecha_inicio === f.fecha_fin && f.tipo !== 'vacaciones' && f.tipo !== 'incapacidad') h += lbl('¿Solo unas horas? (opcional)') + '<input type="number" inputmode="decimal" min="0" max="12" step="0.5" value="' + esc(f.horas) + '" oninput="tcPermisos._mSetSin(\'horas\',this.value)" placeholder="Ej. 3" style="' + mEstilo() + '">';
  h += lbl('Motivo') + '<input type="text" value="' + esc(f.motivo) + '" oninput="tcPermisos._mSetSin(\'motivo\',this.value)" placeholder="Ej. evento personal, trámite, consulta médica" style="' + mEstilo() + '">';
  if (f.tipo === 'ausencia' || f.tipo === 'permiso') h += lbl('¿Cómo lo repones? (opcional)') + '<input type="text" value="' + esc(f.como_repone) + '" oninput="tcPermisos._mSetSin(\'como_repone\',this.value)" placeholder="Ej. con 30 min de comida los días 2, 5 y 6" style="' + mEstilo() + '">';
  h += '<div id="tcp-rev">' + (M.rev ? revisionHTML(M.rev) : '<div style="font-size:12px;color:#64748B;margin-top:8px">Revisando…</div>') + '</div>';
  if (bloq && !propia) {
    h += '<div style="background:#fff;border:1.5px solid #FCA5A5;border-radius:12px;padding:11px 12px;margin-top:10px">' +
      '<div style="font-size:12.5px;color:#B91C1C;font-weight:800;margin-bottom:6px">Estas fechas están bloqueadas</div>' +
      '<div style="font-size:12px;color:#475569;line-height:1.4;margin-bottom:8px">Solo se puede enviar como <b>solicitud urgente</b>. Se revisará aparte para decidir si se aprueba.</div>' +
      '<label style="display:flex;gap:8px;align-items:center;font-size:13px;font-weight:700;color:#0A1628"><input type="checkbox" ' + (f.urgente ? 'checked' : '') + ' onchange="tcPermisos._mSet(\'urgente\',this.checked)" style="width:18px;height:18px"> Es urgente</label>' +
      (f.urgente ? '<input type="text" value="' + esc(f.urgente_motivo) + '" oninput="tcPermisos._mSetSin(\'urgente_motivo\',this.value)" placeholder="¿Por qué es urgente?" style="' + mEstilo('margin-top:8px') + '">' : '') + '</div>';
  }
  if (M.error) h += '<div style="font-size:12px;color:#B91C1C;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:9px 11px;margin-top:12px">' + esc(M.error) + '</div>';
  h += '<button id="tcp-enviar" onclick="tcPermisos._mEnviar()" ' + (!puede || M.enviando ? 'disabled' : '') + ' style="width:100%;margin-top:16px;padding:14px;background:' + (puede ? (f.urgente ? '#B91C1C' : '#15803D') : '#94A3B8') + ';border:none;border-radius:12px;color:#fff;font-family:inherit;font-size:14px;font-weight:900;cursor:' + (puede ? 'pointer' : 'not-allowed') + '">' + (M.enviando ? 'Enviando…' : f.urgente ? 'Enviar como URGENTE' : 'Enviar solicitud') + '</button>' +
    '<div id="tcp-nota-motivo" style="display:' + (b.motivo ? 'none' : 'block') + ';font-size:11px;color:#94A3B8;text-align:center;margin-top:6px">Escribe el motivo para poder enviar.</div>';
  M.cont.innerHTML = h;
}
async function mEnviar() {
  if (M.enviando) return;
  const b = mSolicitudBase();
  M.enviando = true; M.error = ''; mRenderForm();
  try {
    const r = await revisar(b); M.rev = r;
    if (r.propias.length) throw new Error('Ya tienes una solicitud en esas fechas.');
    if (bloqueada(r) && !(b.urgente && b.urgente_motivo)) throw new Error('Esas fechas se bloquearon; márcala como urgente con su motivo.');
    if (!bloqueada(r)) { b.urgente = !!b.urgente && !!b.urgente_motivo; }
    const s = await crearSolicitud(b, r);
    M.enviando = false; M.modo = 'lista';
    if (M.ctx.toast) M.ctx.toast('Solicitud ' + s.folio + ' enviada', 'ok');
    await mCargar(); mRender();
  } catch (e) { M.enviando = false; M.error = e.message || String(e); mRenderForm(); }
}

// ══════════════════════ PANEL (Operaciones / RH) ══════════════════════
const P = { cont: null, opts: null, lista: [], filtroEst: '', filtroDepto: '', busca: '', orden: 'nombre', buscaT: null };
async function panel(cont, opts) {
  P.cont = cont; P.opts = opts || {}; if (P.opts.filtroDepto != null && !P.filtroDepto) P.filtroDepto = P.opts.filtroDepto;
  cont.innerHTML = '<div style="padding:30px;color:#64748b;font-size:13px">Cargando solicitudes…</div>';
  await cargarCfg();
  await pCargar();
  pRender();
}
function pPuedeAprobar() {
  const u = String((P.opts.usuario || {}).correo || '').toLowerCase();
  return !!P.opts.puedeAprobar || (cfg.aprobadores || []).map(x => String(x).toLowerCase()).includes(u) || (cfg.correosRH || []).map(x => String(x).toLowerCase()).includes(u);
}
async function pCargar() {
  try { const c = await sb(); const r = await c.from('rh_solicitudes_ausencia').select('*').gte('fecha_fin', sumar(hoy(), -365)).order('fecha_inicio', { ascending: false }).limit(1500); P.lista = r.data || []; }
  catch (e) { P.lista = []; console.warn('[permisos] panel', e); }
}
function pRender() {
  if (!P.cont) return;
  const H = hoy();
  const deptos = [...new Set(P.lista.map(s => s.departamento).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const enDepto = s => !P.filtroDepto || norm(s.departamento) === norm(P.filtroDepto);
  const pend = P.lista.filter(s => s.estatus === 'Pendiente' && enDepto(s)).sort((a, b) => (b.urgente - a.urgente) || String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)));
  const ausentesHoy = P.lista.filter(s => s.estatus === 'Aprobada' && s.fecha_inicio <= H && s.fecha_fin >= H && enDepto(s));
  const prox30 = P.lista.filter(s => s.estatus === 'Aprobada' && s.fecha_inicio > H && s.fecha_inicio <= sumar(H, 30) && enDepto(s));
  const kpi = (t, v, c, sub) => '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px"><div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase">' + t + '</div><div style="font-size:20px;font-weight:800;color:' + c + '">' + v + '</div><div style="font-size:11px;color:#94a3b8">' + sub + '</div></div>';
  // Franja de 14 días: quién falta cada día.
  const dias = []; for (let i = 0; i < 14; i++) dias.push(sumar(H, i));
  const franja = '<div style="display:grid;grid-template-columns:repeat(14,minmax(70px,1fr));gap:4px;overflow-x:auto;padding-bottom:4px">' + dias.map(d => {
    const fuera = P.lista.filter(s => (s.estatus === 'Aprobada' || s.estatus === 'Pendiente') && s.fecha_inicio <= d && s.fecha_fin >= d && enDepto(s)).sort((a, b) => String(a.colaborador_nombre).localeCompare(String(b.colaborador_nombre), 'es'));
    const dom = new Date(d + 'T12:00:00').getDay() === 0;
    return '<div style="background:' + (dom ? '#f8fafc' : '#fff') + ';border:1px solid ' + (d === H ? '#1D2E73' : '#e2e8f0') + ';border-radius:9px;padding:6px;min-height:64px">' +
      '<div style="font-size:10.5px;font-weight:700;color:' + (d === H ? '#1D2E73' : '#64748b') + ';margin-bottom:4px">' + fCorta(d) + '</div>' +
      fuera.map(s => '<div onclick="tcPermisos._pVer(' + s.id + ')" title="' + esc(s.colaborador_nombre + ' · ' + (TIPOS[s.tipo] || {}).t + ' · ' + s.estatus) + '" style="cursor:pointer;font-size:10px;font-weight:700;padding:2px 5px;border-radius:5px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:' + (s.estatus === 'Pendiente' ? '#fef3c7' : (TIPOS[s.tipo] || {}).bg) + ';color:' + (s.estatus === 'Pendiente' ? '#92400e' : (TIPOS[s.tipo] || {}).c) + (s.estatus === 'Pendiente' ? ';border:1px dashed #f59e0b' : '') + '">' + esc(String(s.colaborador_nombre || '').split(' ').slice(0, 2).join(' ')) + '</div>').join('') + '</div>';
  }).join('') + '</div>';
  const tarjetaPend = s => {
    const tr = (s.traslapes || []).filter(t => t.tipo !== 'anticipacion' || true);
    return '<div style="background:#fff;border:1.5px solid ' + (s.urgente ? '#fca5a5' : '#e2e8f0') + ';border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer" onclick="tcPermisos._pVer(' + s.id + ')">' +
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-size:13.5px;font-weight:800;color:#1e293b">' + esc(s.colaborador_nombre) + ' ' + (s.urgente ? chip('URGENTE', '#b91c1c', '#fee2e2') : '') + '</div>' +
      '<div style="font-size:12px;color:#475569">' + chipTipo(s.tipo) + ' ' + (s.goce ? esc(GOCE_TXT[s.goce] || '') + ' · ' : '') + fCorta(s.fecha_inicio) + (s.fecha_fin !== s.fecha_inicio ? ' a ' + fCorta(s.fecha_fin) : '') + ' · ' + esc(s.dias) + ' día(s)</div>' +
      '<div style="font-size:11.5px;color:#64748b;margin-top:2px">' + esc(s.motivo || '') + '</div>' +
      (tr.length ? '<div style="font-size:11px;color:#b45309;font-weight:700;margin-top:4px">Se empalma: ' + esc(tr.map(t => t.tipo === 'guardia' ? 'guardia semana ' + t.semana : t.tipo === 'anticipacion' ? 'poca anticipación' : t.nombre).join(', ')) + '</div>' : '') +
      '</div><div style="text-align:right;font-size:10.5px;color:#94a3b8">' + esc(s.folio || '') + '<br>' + esc(s.departamento || '') + '<br>' + fHora(s.creado_en) + '</div></div>' +
      (pPuedeAprobar() ? '<div style="display:flex;gap:6px;margin-top:9px" onclick="event.stopPropagation()"><button onclick="tcPermisos._pResolver(' + s.id + ',\'Aprobada\')" style="background:#15803d;border:none;color:#fff;padding:6px 14px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700">Aprobar</button>' +
        '<button onclick="tcPermisos._pResolver(' + s.id + ',\'Rechazada\')" style="background:#fff;border:1px solid #fecaca;color:#b91c1c;padding:6px 14px;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700">Rechazar</button></div>' : '') +
      '</div>';
  };
  const q = P.busca.toLowerCase().trim();
  const hist = P.lista.filter(s => enDepto(s) && (!P.filtroEst || s.estatus === P.filtroEst) && (!q || [s.colaborador_nombre, s.folio, s.motivo, s.departamento, s.plaza].join(' ').toLowerCase().includes(q)))
    .sort(P.orden === 'fecha' ? (a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)) : (a, b) => String(a.colaborador_nombre || '').localeCompare(String(b.colaborador_nombre || ''), 'es') || String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)));
  const sel = 'border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:12.5px';
  P.cont.innerHTML =
    '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px"><div>' +
    '<div style="font-family:\'Space Grotesk\',sans-serif;font-size:19px;font-weight:700;color:#1D2E73">' + esc(P.opts.titulo || 'Permisos, vacaciones y ausencias') + '</div>' +
    '<div style="font-size:12px;color:#64748b">Los técnicos piden desde la app de Flotilla. Al aprobar se aparta en el calendario de Operaciones y se avisa a RH.</div></div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><select onchange="tcPermisos._pSet(\'filtroDepto\',this.value)" style="' + sel + '"><option value="">Todos los departamentos</option>' + deptos.map(d => '<option ' + (norm(d) === norm(P.filtroDepto) ? 'selected' : '') + '>' + esc(d) + '</option>').join('') + '</select>' +
    '<button onclick="tcPermisos._pNuevaPortal()" style="background:#fff;border:1px solid #cbd5e1;color:#334155;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600">+ Registrar por alguien</button>' +
    (pPuedeAprobar() ? '<button onclick="tcPermisos._pConfig()" style="background:#fff;border:1px solid #cbd5e1;color:#334155;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600">Reglas y avisos</button>' : '') + '</div></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px">' +
    kpi('Por aprobar', pend.length, pend.length ? '#b45309' : '#1D2E73', pend.filter(s => s.urgente).length + ' urgente(s)') +
    kpi('Fuera hoy', ausentesHoy.length, '#1D2E73', ausentesHoy.map(s => String(s.colaborador_nombre).split(' ')[0]).join(', ') || 'nadie') +
    kpi('Aprobadas próx. 30 días', prox30.length, '#15803d', 'ya apartadas en el calendario') + '</div>' +
    '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:14px"><div style="font-size:12.5px;font-weight:700;color:#1D2E73;margin-bottom:8px">Quién falta los próximos 14 días <span style="font-weight:500;color:#94a3b8;font-size:11px">(punteado = pendiente de aprobar)</span></div>' + franja + '</div>' +
    '<div style="font-size:13px;font-weight:800;color:#1D2E73;margin:4px 0 8px">Por aprobar (' + pend.length + ')</div>' +
    (pend.length ? pend.map(tarjetaPend).join('') : '<div style="color:#94a3b8;font-size:12.5px;padding:10px 0 14px">No hay solicitudes pendientes.</div>') +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:16px 0 8px"><div style="font-size:13px;font-weight:800;color:#1D2E73;margin-right:auto">Historial</div>' +
    '<select onchange="tcPermisos._pSet(\'filtroEst\',this.value)" style="' + sel + '"><option value="">Todos los estatus</option>' + Object.keys(EST).map(e => '<option ' + (P.filtroEst === e ? 'selected' : '') + '>' + e + '</option>').join('') + '</select>' +
    '<select onchange="tcPermisos._pSet(\'orden\',this.value)" style="' + sel + '"><option value="nombre" ' + (P.orden === 'nombre' ? 'selected' : '') + '>Orden: nombre (A-Z)</option><option value="fecha" ' + (P.orden === 'fecha' ? 'selected' : '') + '>Orden: fecha</option></select>' +
    '<input id="tcp-busca" value="' + esc(P.busca) + '" oninput="tcPermisos._pBuscar(this.value)" placeholder="Buscar persona, folio, motivo…" style="' + sel + ';min-width:220px"></div>' +
    '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px;color:#334155"><thead><tr style="background:#f8fafc;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase">' +
    '<th style="padding:9px 8px">Colaborador</th><th style="padding:9px 8px">Tipo</th><th style="padding:9px 8px">Fechas</th><th style="padding:9px 8px">Estatus</th><th style="padding:9px 8px">Resolvió</th></tr></thead><tbody>' +
    (hist.map(s => '<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer" onclick="tcPermisos._pVer(' + s.id + ')"><td style="padding:9px 8px"><b>' + esc(s.colaborador_nombre) + '</b><div style="font-size:10.5px;color:#94a3b8">' + esc([s.folio, s.departamento, s.plaza].filter(Boolean).join(' · ')) + '</div></td>' +
      '<td style="padding:9px 8px">' + chipTipo(s.tipo) + (s.urgente ? ' ' + chip('urgente', '#b91c1c', '#fee2e2') : '') + '</td><td style="padding:9px 8px;white-space:nowrap">' + fCorta(s.fecha_inicio) + (s.fecha_fin !== s.fecha_inicio ? ' a ' + fCorta(s.fecha_fin) : '') + '<div style="font-size:10.5px;color:#94a3b8">' + esc(s.dias) + ' día(s)</div></td>' +
      '<td style="padding:9px 8px">' + chipEst(s.estatus) + '</td><td style="padding:9px 8px;font-size:11.5px">' + esc(s.resuelto_nombre || '') + '<div style="font-size:10.5px;color:#94a3b8">' + fHora(s.resuelto_en) + '</div></td></tr>').join('') ||
      '<tr><td colspan="5" style="padding:22px;text-align:center;color:#94a3b8">Sin solicitudes.</td></tr>') + '</tbody></table></div>' +
    '<div id="tcp-modal"></div>';
}
function pModal(html, ancho) {
  const m = document.getElementById('tcp-modal'); if (!m) return;
  m.innerHTML = html ? '<div style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px"><div style="background:#fff;border-radius:14px;width:' + (ancho || 640) + 'px;max-width:96vw;max-height:92vh;overflow-y:auto;padding:22px">' + html + '</div></div>' : '';
}
async function pVer(id) {
  const s = P.lista.find(x => x.id === id); if (!s) return;
  const fila = (k, v) => v ? '<div style="display:flex;gap:12px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px"><div style="width:150px;color:#64748b;flex-shrink:0">' + k + '</div><div style="color:#1e293b;font-weight:600">' + v + '</div></div>' : '';
  const hist = (s.historial || []).slice().reverse().map(h => '<div style="font-size:11.5px;color:#475569;padding:5px 0;border-bottom:1px dashed #f1f5f9"><b>' + esc(h.accion) + '</b> · ' + esc(h.porNombre || h.por || '') + ' · ' + fHora(h.en) + (h.comentario ? '<br><span style="color:#64748b">' + esc(h.comentario) + '</span>' : '') + '</div>').join('');
  const puede = pPuedeAprobar();
  pModal('<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:17px;color:#1D2E73">' + esc(s.colaborador_nombre) + '</div>' +
    '<div style="font-size:12px;color:#64748b">' + esc([s.folio, s.puesto, s.departamento, s.plaza].filter(Boolean).join(' · ')) + '</div></div><div style="display:flex;gap:8px;align-items:center">' + chipEst(s.estatus) +
    '<button onclick="tcPermisos._pCerrarModal()" style="background:#f1f5f9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;color:#475569;display:inline-flex;align-items:center;justify-content:center">' + ICO.cerrar + '</button></div></div>' +
    (s.urgente ? '<div style="background:#fef2f2;color:#b91c1c;border-radius:9px;padding:8px 11px;font-size:12.5px;font-weight:700;margin:12px 0 0">URGENTE: ' + esc(s.urgente_motivo || '') + '</div>' : '') +
    '<div style="margin-top:12px">' + fila('Tipo', chipTipo(s.tipo) + (s.goce ? ' ' + esc(GOCE_TXT[s.goce] || s.goce) : '')) + fila('Fechas', fCorta(s.fecha_inicio) + (s.fecha_fin !== s.fecha_inicio ? ' a ' + fCorta(s.fecha_fin) : '') + ' · ' + esc(s.dias) + ' día(s)' + (s.horas ? ' · ' + esc(s.horas) + ' h' : '')) +
    fila('Motivo', esc(s.motivo || '')) + fila('Cómo lo repone', esc(s.como_repone || '')) + fila('Jefe inmediato', esc(s.jefe || '')) + fila('Solicitado', fHora(s.creado_en) + (s.origen === 'app' ? ' · desde la app' : ' · desde el portal')) + '</div>' +
    '<div id="tcp-rev-adm" style="margin-top:6px"><div style="font-size:12px;color:#64748b;margin-top:8px">Revisando empalmes al día de hoy…</div></div>' +
    (hist ? '<div style="font-size:12px;font-weight:700;color:#1D2E73;margin:14px 0 4px">Historial</div>' + hist : '') +
    (puede && s.estatus === 'Pendiente' ? '<label style="display:block;font-size:11.5px;font-weight:600;color:#475569;margin-top:14px">Comentario (obligatorio si rechazas)<textarea id="tcp-com" rows="2" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin-top:4px;font-family:inherit"></textarea></label>' : '') +
    '<div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">' +
    '<button onclick="tcPermisos._pImprimir(' + s.id + ')" style="background:#fff;border:1px solid #cbd5e1;color:#334155;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;display:inline-flex;gap:6px;align-items:center">' + ICO.imprimir + 'Formato HTC-FR-1201-13</button>' +
    (puede && (s.estatus === 'Aprobada' || s.estatus === 'Pendiente') ? '<button onclick="tcPermisos._pResolver(' + s.id + ',\'Cancelada\')" style="background:#fff;border:1px solid #cbd5e1;color:#64748b;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600">Cancelar</button>' : '') +
    (puede && s.estatus === 'Pendiente' ? '<button onclick="tcPermisos._pResolver(' + s.id + ',\'Rechazada\',true)" style="background:#fff;border:1px solid #fecaca;color:#b91c1c;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Rechazar</button><button onclick="tcPermisos._pResolver(' + s.id + ',\'Aprobada\',true)" style="background:#15803d;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Aprobar</button>' : '') +
    '</div>', 680);
  if (s.estatus === 'Pendiente' || s.estatus === 'Aprobada') {
    try { const r = await revisar(s); const el = document.getElementById('tcp-rev-adm'); if (el) el.innerHTML = revisionHTML({ propias: [], grupo: r.grupo, registradas: r.registradas, guardias: r.guardias, anticipacion: false }); } catch (e) {}
  } else { const el = document.getElementById('tcp-rev-adm'); if (el) el.innerHTML = ''; }
}
async function pResolver(id, estatus, desdeModal) {
  const s = P.lista.find(x => x.id === id); if (!s) return;
  let com = '';
  const el = document.getElementById('tcp-com');
  if (desdeModal && el) com = el.value.trim();
  if (estatus === 'Rechazada' && !com) { com = prompt('Motivo del rechazo (le llega al colaborador):', ''); if (com === null) return; com = com.trim(); if (!com) { alert('Escribe el motivo del rechazo.'); return; } }
  if (estatus === 'Cancelada' && !confirm('¿Cancelar esta solicitud?' + (s.estatus === 'Aprobada' ? ' Se libera su lugar en el calendario de Operaciones.' : ''))) return;
  if (estatus === 'Aprobada' && (s.traslapes || []).some(t => t.tipo === 'solicitud' || t.tipo === 'ausencia') && !confirm('Esta solicitud se empalma con otra persona de su área. ¿Aprobar de todos modos?')) return;
  try {
    await resolver(s, estatus, P.opts.usuario || {}, com);
    pModal('');
    pRender();
    if (P.opts.onCambio) P.opts.onCambio();
  } catch (e) { alert('No se pudo guardar: ' + (e.message || e)); }
}
// Registrar en nombre de alguien (por ejemplo, quien no tiene la app).
async function pNuevaPortal() {
  let tecs = [];
  try { const c = await sb(); const r = await c.from('ops_tecnicos').select('id,nombre,correo,departamento,plaza,puesto,supervisor,estatus').neq('estatus', 'baja').order('nombre').limit(500); tecs = (r.data || []).filter(t => t.correo); } catch (e) {}
  window.__tcpTecs = tecs;
  const inp = 'width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px';
  pModal('<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16px;color:#1D2E73;margin-bottom:4px">Registrar solicitud por alguien</div>' +
    '<div style="font-size:12px;color:#64748b;margin-bottom:12px">Pasa por las mismas reglas que la app. Solo aparecen colaboradores con correo en su ficha de Técnicos.</div>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Colaborador<select id="tcp-n-tec" style="' + inp + '">' + tecs.map((t, i) => '<option value="' + i + '">' + esc(t.nombre) + ' · ' + esc(t.departamento || '') + '</option>').join('') + '</select></label>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px"><label style="font-size:11.5px;font-weight:600;color:#475569">Tipo<select id="tcp-n-tipo" style="' + inp + '">' + Object.keys(TIPOS).map(k => '<option value="' + k + '">' + TIPOS[k].t + '</option>').join('') + '</select></label>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Modalidad<select id="tcp-n-goce" style="' + inp + '"><option value="">—</option>' + Object.keys(GOCE_TXT).map(k => '<option value="' + k + '">' + GOCE_TXT[k] + '</option>').join('') + '</select></label>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Desde<input type="date" id="tcp-n-ini" value="' + hoy() + '" style="' + inp + '"></label><label style="font-size:11.5px;font-weight:600;color:#475569">Hasta<input type="date" id="tcp-n-fin" value="' + hoy() + '" style="' + inp + '"></label></div>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Motivo<input id="tcp-n-mot" style="' + inp + '"></label>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Cómo lo repone (opcional)<input id="tcp-n-rep" style="' + inp + '"></label>' +
    '<label style="display:flex;gap:6px;align-items:center;font-size:12.5px;color:#334155;margin-bottom:6px"><input type="checkbox" id="tcp-n-urg"> Urgente</label><input id="tcp-n-urgm" placeholder="Motivo de la urgencia" style="' + inp + '">' +
    '<div id="tcp-n-err" style="font-size:12px;color:#b91c1c"></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button onclick="tcPermisos._pCerrarModal()" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600">Cancelar</button>' +
    '<button id="tcp-n-btn" onclick="tcPermisos._pGuardarNueva()" style="background:#1D2E73;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Revisar y registrar</button></div>', 560);
}
async function pGuardarNueva() {
  const t = (window.__tcpTecs || [])[Number(document.getElementById('tcp-n-tec').value)];
  const g = id => (document.getElementById(id).value || '').trim();
  const err = document.getElementById('tcp-n-err');
  if (!t) { err.textContent = 'Elige al colaborador.'; return; }
  const s = { colaborador_email: String(t.correo).toLowerCase(), colaborador_nombre: t.nombre, tecnico_id: t.id, departamento: t.departamento, plaza: t.plaza, puesto: t.puesto, jefe: t.supervisor,
    tipo: g('tcp-n-tipo'), goce: g('tcp-n-goce') || null, fecha_inicio: g('tcp-n-ini'), fecha_fin: g('tcp-n-fin'), motivo: g('tcp-n-mot'), como_repone: g('tcp-n-rep') || null,
    urgente: document.getElementById('tcp-n-urg').checked, urgente_motivo: g('tcp-n-urgm') || null, origen: 'portal', creado_por: (P.opts.usuario || {}).correo || null };
  s.dias = diasHabiles(s.fecha_inicio, s.fecha_fin);
  if (!s.fecha_inicio || !s.fecha_fin || s.fecha_fin < s.fecha_inicio) { err.textContent = 'Revisa las fechas.'; return; }
  if (!s.motivo) { err.textContent = 'Escribe el motivo.'; return; }
  const btn = document.getElementById('tcp-n-btn'); btn.disabled = true; btn.textContent = 'Revisando…';
  try {
    const r = await revisar(s);
    if (r.propias.length) throw new Error('Ya tiene una solicitud en esas fechas (' + r.propias.map(o => o.folio).join(', ') + ').');
    if (bloqueada(r) && !(s.urgente && s.urgente_motivo)) throw new Error('Fechas bloqueadas: ' + [r.grupo.map(o => o.colaborador_nombre).join(', '), r.registradas.map(o => o.nombre).join(', '), r.anticipacion ? 'poca anticipación' : ''].filter(Boolean).join(' · ') + '. Márcala como urgente con su motivo.');
    if (!bloqueada(r)) s.urgente = !!(s.urgente && s.urgente_motivo);
    await crearSolicitud(s, r);
    pModal(''); await pCargar(); pRender();
  } catch (e) { err.textContent = e.message || String(e); btn.disabled = false; btn.textContent = 'Revisar y registrar'; }
}
function pConfig() {
  const inp = 'width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px';
  pModal('<div style="font-family:\'Space Grotesk\',sans-serif;font-weight:700;font-size:16px;color:#1D2E73;margin-bottom:12px">Reglas y avisos</div>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Correos de RH que reciben todos los avisos (coma)<input id="tcp-c-rh" value="' + esc((cfg.correosRH || []).join(', ')) + '" style="' + inp + '"></label>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Pueden aprobar (además de los admins de Operaciones) (coma)<input id="tcp-c-apr" value="' + esc((cfg.aprobadores || []).join(', ')) + '" style="' + inp + '"></label>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px"><label style="font-size:11.5px;font-weight:600;color:#475569">Personas del mismo grupo fuera a la vez antes de bloquear<input type="number" min="1" id="tcp-c-max" value="' + esc(cfg.maxMismoGrupo || 1) + '" style="' + inp + '"></label>' +
    '<label style="font-size:11.5px;font-weight:600;color:#475569">Días mínimos de anticipación<input type="number" min="0" id="tcp-c-ant" value="' + esc(cfg.diasAnticipacion ?? 3) + '" style="' + inp + '"></label></div>' +
    '<div style="font-size:11.5px;color:#64748b;margin-bottom:12px">Grupo = mismo departamento y misma plaza. Con 1, en cuanto alguien ya pidió esas fechas, la siguiente solicitud solo pasa como urgente.</div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button onclick="tcPermisos._pCerrarModal()" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600">Cancelar</button>' +
    '<button onclick="tcPermisos._pGuardarConfig()" style="background:#1D2E73;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700">Guardar</button></div>', 560);
}
async function pGuardarConfig() {
  const lista = id => document.getElementById(id).value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  const datos = Object.assign({}, cfg, { correosRH: lista('tcp-c-rh'), aprobadores: lista('tcp-c-apr'), maxMismoGrupo: Math.max(1, Number(document.getElementById('tcp-c-max').value) || 1), diasAnticipacion: Math.max(0, Number(document.getElementById('tcp-c-ant').value) || 0) });
  try { const c = await sb(); const r = await c.from('rh_config_permisos').upsert({ id: 'general', datos: datos, actualizado_en: new Date().toISOString(), actualizado_por: (P.opts.usuario || {}).correo || null }); if (r.error) throw r.error; cfg = datos; pModal(''); pRender(); }
  catch (e) { alert('No se pudo guardar: ' + (e.message || e)); }
}
async function pendientes() {
  try { const c = await sb(); const r = await c.from('rh_solicitudes_ausencia').select('id', { count: 'exact', head: true }).eq('estatus', 'Pendiente'); return r.count || 0; } catch (e) { return 0; }
}

window.tcPermisos = {
  movil: movil, panel: panel, pendientes: pendientes, imprimir: imprimir, revisar: revisar,
  // Handlers de los onclick del HTML (tienen que ser globales).
  _mNueva: mNueva, _mVolver: () => { M.modo = 'lista'; mRender(); }, _mEnviar: mEnviar, _mRefrescar: () => mRenderForm(),
  _mSet: (k, v) => { M.f[k] = v; if (k === 'tipo') M.f.goce = ''; if (k === 'fecha_inicio' && (!M.f.fecha_fin || M.f.fecha_fin < v)) M.f.fecha_fin = v; mRenderForm(); if (['tipo', 'fecha_inicio', 'fecha_fin'].includes(k)) mRevisar(); },
  _mSetSin: (k, v) => { M.f[k] = v; mBoton(); },
  _mCancelar: async id => {
    const s = M.lista.find(x => x.id === id); if (!s || !confirm('¿Cancelar tu solicitud ' + (s.folio || '') + '?')) return;
    try { await resolver(s, 'Cancelada', { correo: M.ctx.correo, nombre: (M.perfil && M.perfil.nombre) || M.ctx.nombre }, 'Cancelada por el colaborador'); await mCargar(); mRender(); } catch (e) { alert(e.message || e); }
  },
  _pVer: pVer, _pResolver: pResolver, _pCerrarModal: () => pModal(''), _pImprimir: id => { const s = P.lista.find(x => x.id === id); if (s) imprimir(s); },
  _pSet: (k, v) => { P[k] = v; pRender(); }, _pBuscar: v => { P.busca = v; clearTimeout(P.buscaT); P.buscaT = setTimeout(() => { pRender(); const i = document.getElementById('tcp-busca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); },
  _pNuevaPortal: pNuevaPortal, _pGuardarNueva: pGuardarNueva, _pConfig: pConfig, _pGuardarConfig: pGuardarConfig,
};
console.log('[permisos.js] listo');
})();
