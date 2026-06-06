// flotilla-reglas.js — Reglas de permisos por rol para Flotilla Vehicular
// Este archivo centraliza quién puede hacer qué en cada etapa

// ── CORREOS AUTORIZADOS POR ROL ──
const FL_ROLES = {
  contraloria: [
    'p.pinedo@tecnocontrol.com.mx'
  ],
  flotilla: [
    'fatima@tecnocontrol.com.mx',
    'almacen@tecnocontrol.com.mx',
    'rh@tecnocontrol.com.mx',
    'c.acosta@tecnocontrol.com.mx',
    'mercadotecnia@tecnocontrol.com.mx',
    'mercadotecniatecnocontrol@gmail.com'
  ],
  administradores: [
    'mercadotecnia@tecnocontrol.com.mx',
    'mercadotecniatecnocontrol@gmail.com',
    'c.acosta@tecnocontrol.com.mx',
    'rh@tecnocontrol.com.mx',
    'm.delao@tecnocontrol.com.mx',
    'p.pinedo@tecnocontrol.com.mx',
    'fatima@tecnocontrol.com.mx',
    'almacen@tecnocontrol.com.mx'
  ]
};

// ── FUNCIÓN CENTRAL DE PERMISOS ──
window.flTienePermiso = function(accion) {
  const email = window.auth?.currentUser?.email || '';

  switch(accion) {
    case 'aprobar':
    case 'rechazar':
      return FL_ROLES.contraloria.includes(email);

    case 'validar':
    case 'subir_cotizacion':
    case 'asignar_taller':
    case 'enviar_cierre':
      return FL_ROLES.flotilla.includes(email) || FL_ROLES.administradores.includes(email);

    case 'subir_comprobante':
      return true; // Pagos — cualquier admin por ahora

    case 'crear_solicitud':
      return true; // Cualquier usuario autenticado

    case 'eliminar':
      return FL_ROLES.administradores.includes(email);

    default:
      return FL_ROLES.administradores.includes(email);
  }
};

// ── ETIQUETA DE ROL DEL USUARIO ACTUAL ──
window.flGetRolActual = function() {
  const email = window.auth?.currentUser?.email || '';
  if (FL_ROLES.contraloria.includes(email)) return 'Contraloría';
  if (FL_ROLES.flotilla.includes(email)) return 'Flotilla';
  if (FL_ROLES.administradores.includes(email)) return 'Administrador';
  return 'Usuario';
};
