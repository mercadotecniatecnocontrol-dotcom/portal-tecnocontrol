// flotilla-reglas.js v5 (admins fijos + reintentos al cargar el rol) — Roles de Flotilla centralizados en la colección `usuarios`
// El rol/permisos de cada persona viven en su documento en `usuarios`:
//   - rolFlotilla: 'administrador' | 'lector' | (legado: 'aprobador'|'pagos'|'flotilla') | '' | null
//   - permisosFlotilla: array de acciones concedidas explícitamente (granular),
//     asignado desde el panel "Roles de Flotilla" del portal (index.html).
//
// Compatibilidad: si un usuario NO tiene permisosFlotilla todavía (no lo han
// tocado desde el panel nuevo), sus permisos se derivan de su rolFlotilla
// legado con el mismo mapeo que existía antes de v4 — nadie pierde acceso
// solo por este cambio. En cuanto Glen edita sus casillas en el panel, ese
// usuario pasa a usar permisosFlotilla explícito de ahí en adelante.

let _flRolCache = '';
let _flPermisosCache = null; // null = usar mapeo legado; array = permisos explícitos

const FL_ACCIONES_LEGADO = {
  administrador: ['crear_solicitud','validar','cotizar','asignar_taller','aprobar','rechazar','gestionar_pagos','subir_comprobante','cerrar','enviar_cierre','subir_cotizacion','eliminar'],
  aprobador:     ['crear_solicitud','aprobar','rechazar'],
  pagos:         ['crear_solicitud','gestionar_pagos','subir_comprobante'],
  flotilla:      ['crear_solicitud','validar','cotizar','asignar_taller','cerrar','enviar_cierre','subir_cotizacion'],
  lector:        [],
  '':            ['crear_solicitud'], // técnico base — cualquiera con cuenta puede crear una solicitud
};

// Administradores fijos de Flotilla: tienen acceso total SIEMPRE, aunque la
// lectura de su documento en `usuarios` falle (cuota de Firestore, red, etc.).
// Antes, si esa lectura fallaba, el catch los dejaba como "técnico base" en
// silencio y solo podían crear solicitudes, no modificarlas.
const FL_ADMINS_FIJOS = [
  'c.acosta@tecnocontrol.com.mx',
  'flotilla@tecnocontrol.com.mx',
  'glen@tecnocontrol.com.mx',
  'mercadotecnia@tecnocontrol.com.mx',
];
function flEmailActual() {
  return (window.auth?.currentUser?.email || '').toLowerCase().trim();
}

// Debe llamarse justo después de que el login se confirma
// (en index.html, junto a cargarUsuariosFirestore()). Reintenta 3 veces
// antes de rendirse, para no degradar permisos por un fallo pasajero.
window.flCargarRolActual = async function() {
  const uid = window.auth?.currentUser?.uid;
  if (!uid) { _flRolCache = ''; _flPermisosCache = null; return; }

  let ultimoError = null;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const fbFL = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const snap = await fbFL.getDoc(fbFL.doc(db, 'usuarios', uid));
      if (snap.exists() && snap.data().activo !== false) {
        const d = snap.data();
        _flRolCache = d.rolFlotilla || '';
        _flPermisosCache = Array.isArray(d.permisosFlotilla) ? d.permisosFlotilla : null;
      } else {
        _flRolCache = ''; _flPermisosCache = null;
      }
      ultimoError = null;
      break;
    } catch(e) {
      ultimoError = e;
      console.warn('[FL-REGLAS] Intento ' + intento + '/3 al cargar rolFlotilla falló:', e.code || '', e.message);
      if (intento < 3) await new Promise(r => setTimeout(r, 1000 * intento));
    }
  }
  if (ultimoError) {
    console.error('[FL-REGLAS] No se pudo cargar rolFlotilla tras 3 intentos:', ultimoError.code || '', ultimoError.message);
    _flRolCache = ''; _flPermisosCache = null;
  }

  // Los admins fijos siempre quedan como administrador
  if (FL_ADMINS_FIJOS.includes(flEmailActual())) {
    _flRolCache = 'administrador';
    _flPermisosCache = null;
  }
};

window.flTienePermiso = function(accion) {
  if (accion === 'crear_solicitud') return true; // siempre permitido con cuenta activa
  if (_flRolCache === 'administrador') return true; // admin total de Flotilla, sin excepción
  if (_flRolCache === 'lector') return false; // lector nunca modifica nada, solo ve

  if (Array.isArray(_flPermisosCache)) {
    // Permisos explícitos asignados desde el panel — fuente de verdad para este usuario
    return _flPermisosCache.includes(accion);
  }
  // Sin permisos explícitos todavía → comportamiento legado por rol
  const acciones = FL_ACCIONES_LEGADO[_flRolCache] || FL_ACCIONES_LEGADO[''];
  return acciones.includes(accion);
};

window.flGetRolActual = function() {
  if (_flRolCache === 'administrador') return 'Administrador';
  if (_flRolCache === 'lector') return 'Lector (solo lectura)';
  if (Array.isArray(_flPermisosCache) && _flPermisosCache.length) return 'Personalizado';
  const map = { aprobador: 'Contraloría', pagos: 'Pagos', flotilla: 'Flotilla' };
  return map[_flRolCache] || 'Técnico';
};

// Reemplaza a FLOTILLA_ADMINS/hAdm() de flotilla.js
window.flEsAdmin = function() { return _flRolCache === 'administrador'; };
