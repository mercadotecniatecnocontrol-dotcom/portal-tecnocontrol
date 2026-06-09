// flotilla-reglas.js — Reglas de permisos por rol para Flotilla Vehicular

const FL_ROLES = {
  // Solo pueden Aprobar y Rechazar
  aprobadores: [
    'p.pinedo@tecnocontrol.com.mx',
    'c.acosta@tecnocontrol.com.mx',
  ],
  // Pueden Validar, Cotizar, Enviar a Cierre, Cerrar
  flotilla: [
    'fatima@tecnocontrol.com.mx',
    'mercadotecniatecnocontrol@gmail.com',
    'mercadotecnia@tecnocontrol.com.mx',
    'rh@tecnocontrol.com.mx',
    'c.acosta@tecnocontrol.com.mx',
    'm.delao@tecnocontrol.com.mx',
    'p.pinedo@tecnocontrol.com.mx',
  ],
  // Pueden todo lo anterior + Eliminar
  administradores: [
    'mercadotecniatecnocontrol@gmail.com',
    'mercadotecnia@tecnocontrol.com.mx',
    'c.acosta@tecnocontrol.com.mx',
    'rh@tecnocontrol.com.mx',
    'm.delao@tecnocontrol.com.mx',
    'p.pinedo@tecnocontrol.com.mx',
    'fatima@tecnocontrol.com.mx',
  ]
};

window.flTienePermiso = function(accion) {
  const email = (window.auth?.currentUser?.email || '').toLowerCase();

  switch(accion) {
    case 'aprobar':
    case 'rechazar':
      return FL_ROLES.aprobadores.map(e=>e.toLowerCase()).includes(email);

    case 'validar':
    case 'cotizar':
    case 'subir_cotizacion':
    case 'asignar_taller':
    case 'enviar_cierre':
    case 'cerrar':
      return FL_ROLES.flotilla.map(e=>e.toLowerCase()).includes(email);

    case 'crear_solicitud':
      return true;

    case 'eliminar':
      return FL_ROLES.administradores.map(e=>e.toLowerCase()).includes(email);

    default:
      return FL_ROLES.administradores.map(e=>e.toLowerCase()).includes(email);
  }
};

window.flGetRolActual = function() {
  const email = (window.auth?.currentUser?.email || '').toLowerCase();
  if (FL_ROLES.aprobadores.map(e=>e.toLowerCase()).includes(email)) return 'Contraloría';
  if (FL_ROLES.administradores.map(e=>e.toLowerCase()).includes(email)) return 'Administrador';
  if (FL_ROLES.flotilla.map(e=>e.toLowerCase()).includes(email)) return 'Flotilla';
  return 'Usuario';
};
