// flotilla-reglas.js v2 — Reglas de permisos por rol para Flotilla Vehicular
// Flujo: Solicitud → Validación → Aprobación → Pagos → Cierre → Cerrada

const FL_ROLES = {
  // Solo pueden Aprobar/Devolver desde Aprobación
  aprobadores: [
    'p.pinedo@tecnocontrol.com.mx',
    'c.acosta@tecnocontrol.com.mx',
  ],
  // Gestión de pagos: subir comprobante, programar, marcar pagado
  pagos: [
    'pagos@tecnocontrol.com.mx',
  ],
  // Flotilla: validar, cotizar, cerrar servicio (Fátima)
  flotilla: [
    'fatima@tecnocontrol.com.mx',
  ],
  // Solo lectura: puede ENTRAR y VER todo (vehículos, historial, uso,
  // solicitudes) pero no puede crear, validar, aprobar, pagar ni cerrar nada.
  // El acceso a la pestaña Flotilla en sí lo controla EMAIL_ACCESO_EXTRA en
  // index.html — esta lista solo bloquea acciones dentro del módulo.
  lectores: [
    'miguel@tecnocontrol.com.mx',
  ],
  // Administradores: todo lo anterior + eliminar + acceso a todas las vistas
  administradores: [
    'mercadotecniatecnocontrol@gmail.com',
    'mercadotecnia@tecnocontrol.com.mx',
    'c.acosta@tecnocontrol.com.mx',
    'rh@tecnocontrol.com.mx',
    'm.delao@tecnocontrol.com.mx',
    'p.pinedo@tecnocontrol.com.mx',
    'fatima@tecnocontrol.com.mx',
    'nicolas@tecnocontrol.com.mx',
  ]
};

window.flTienePermiso = function(accion) {
  const email = (window.auth?.currentUser?.email || '').toLowerCase();
  const isAdmin = FL_ROLES.administradores.map(e=>e.toLowerCase()).includes(email);
  const isFlotilla = FL_ROLES.flotilla.map(e=>e.toLowerCase()).includes(email);
  const isAprobador = FL_ROLES.aprobadores.map(e=>e.toLowerCase()).includes(email);
  const isPagos = FL_ROLES.pagos.map(e=>e.toLowerCase()).includes(email);
  const isLector = FL_ROLES.lectores.map(e=>e.toLowerCase()).includes(email);

  // Un lector nunca puede modificar nada, sin importar la acción — solo ver.
  if(isLector && !isAdmin) return false;

  switch(accion) {
    // Cualquier usuario autenticado puede crear solicitudes (excepto lectores)
    case 'crear_solicitud':
      return true;

    // Fátima y admins pueden validar (Solicitud → Validación)
    case 'validar':
    case 'cotizar':
    case 'asignar_taller':
      return isFlotilla || isAdmin;

    // Solo Contraloría puede aprobar/devolver (Validación → Aprobación)
    case 'aprobar':
    case 'rechazar':
      return isAprobador || isAdmin;

    // Solo Pagos puede gestionar pagos (Aprobación → Pagos → Cierre)
    case 'gestionar_pagos':
    case 'subir_comprobante':
      return isPagos || isAdmin;

    // Fátima y admins cierran el servicio (Cierre → Cerrada)
    case 'cerrar':
    case 'enviar_cierre':
    case 'subir_cotizacion':
      return isFlotilla || isAdmin;

    // Solo admins pueden eliminar
    case 'eliminar':
      return isAdmin;

    default:
      return isAdmin;
  }
};

window.flGetRolActual = function() {
  const email = (window.auth?.currentUser?.email || '').toLowerCase();
  if (FL_ROLES.aprobadores.map(e=>e.toLowerCase()).includes(email)) return 'Contraloría';
  if (FL_ROLES.pagos.map(e=>e.toLowerCase()).includes(email)) return 'Pagos';
  if (FL_ROLES.flotilla.map(e=>e.toLowerCase()).includes(email)) return 'Flotilla';
  if (FL_ROLES.administradores.map(e=>e.toLowerCase()).includes(email)) return 'Administrador';
  if (FL_ROLES.lectores.map(e=>e.toLowerCase()).includes(email)) return 'Lector (solo lectura)';
  return 'Técnico';
};
