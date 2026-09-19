// roles-modulos.js v1 — Roles centralizados por módulo (Pagos, Compras, etc.)
// Convención: usuarios/{uid}.roles = { pagos:'administrador'|'lector'|'', compras:'...', ... }
// Complementa (no reemplaza) rolFlotilla/permisosFlotilla de flotilla-reglas.js,
// que sigue siendo la fuente de verdad para Flotilla específicamente.

window.tcRolEnModulo = async function(modulo){
  try{
    const uid = window.auth?.currentUser?.uid;
    if(!uid) return '';
    const fbMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const snap = await fbMod.getDoc(fbMod.doc(db, 'usuarios', uid));
    if(!snap.exists() || snap.data().activo === false) return '';
    return (snap.data().roles && snap.data().roles[modulo]) || '';
  }catch(e){
    console.warn('[roles-modulos] no se pudo leer rol de', modulo, e.message);
    return '';
  }
};

window.tcEsAdminModulo = async function(modulo){
  return (await window.tcRolEnModulo(modulo)) === 'administrador';
};
