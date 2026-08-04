// flotilla-reglas.js v3 — Roles de Flotilla centralizados en la colección `usuarios`
// Ya NO hay listas de correos aquí. El rol de cada persona vive en un solo lugar:
// el campo `rolFlotilla` dentro de su documento en la colección `usuarios`.
// Valores posibles: 'administrador' | 'aprobador' | 'pagos' | 'flotilla' | 'lector' | (nada = Técnico)

let _flRolCache = '';

// Debe llamarse UNA VEZ justo después de que el login se confirma
// (en index.html, junto a cargarUsuariosFirestore()).
window.flCargarRolActual = async function() {
  try {
    const uid = window.auth?.currentUser?.uid;
    if (!uid) { _flRolCache = ''; return; }
    const fbFL = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await fbFL.getDoc(fbFL.doc(db, 'usuarios', uid));
    _flRolCache = (snap.exists() && snap.data().activo !== false) ? (snap.data().rolFlotilla || '') : '';
  } catch(e) {
    console.warn('[FL-REGLAS] No se pudo cargar rolFlotilla:', e.message);
    _flRolCache = '';
  }
};

window.flTienePermiso = function(accion) {
  const rol = _flRolCache || '';
  const isAdmin     = rol === 'administrador';
  const isAprobador = rol === 'aprobador';
  const isPagos     = rol === 'pagos';
  const isFlotilla  = rol === 'flotilla';
  const isLector    = rol === 'lector';

  if (isLector && !isAdmin) return false; // un lector nunca modifica nada, solo ve

  switch(accion) {
    case 'crear_solicitud':
      return true;
    case 'validar': case 'cotizar': case 'asignar_taller':
      return isFlotilla || isAdmin;
    case 'aprobar': case 'rechazar':
      return isAprobador || isAdmin;
    case 'gestionar_pagos': case 'subir_comprobante':
      return isPagos || isAdmin;
    case 'cerrar': case 'enviar_cierre': case 'subir_cotizacion':
      return isFlotilla || isAdmin;
    case 'eliminar':
      return isAdmin;
    default:
      return isAdmin;
  }
};

window.flGetRolActual = function() {
  const map = {
    administrador: 'Administrador',
    aprobador: 'Contraloría',
    pagos: 'Pagos',
    flotilla: 'Flotilla',
    lector: 'Lector (solo lectura)'
  };
  return map[_flRolCache] || 'Técnico';
};

// Reemplaza a FLOTILLA_ADMINS/hAdm() de flotilla.js
window.flEsAdmin = function() { return _flRolCache === 'administrador'; };