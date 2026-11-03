/* ════════════════════════════════════════════════════════════════════
   firebase-auth-supabase.js — Portal Tecnocontrol (Etapa 2a, nov-2026)
   ────────────────────────────────────────────────────────────────────
   index.html tiene un "import map" que manda aquí toda carga de
   https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js
   Así los módulos (ventas.js, pagos.js, contabilidad.js, operaciones.js…)
   siguen escribiendo getAuth(app), onAuthStateChanged(auth, …), etc. sin
   cambiar nada, pero por dentro ya es Supabase (window.tcAuth, de
   auth-supabase.js).

   Excepción temporal (hasta la etapa 2c): las altas de cuentas con una app
   SECUNDARIA de Firebase ("Agregar usuario" y "Acceso al kiosco" de
   técnicos) siguen usando el Firebase Auth real; al primer inicio de sesión
   esa cuenta pasa sola a Supabase con auth-migrar.
   ════════════════════════════════════════════════════════════════════ */

// "?original" hace que la dirección no coincida con el import map y se cargue el Firebase Auth real.
const REAL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js?original';
let _real = null;
const real = () => _real || (_real = import(REAL));

function esPrincipal(app) { return !app || app.name === '[DEFAULT]'; }
function tc() {
  if (!window.tcAuth) throw new Error('Falta auth-supabase.js antes del código del portal');
  return window.tcAuth;
}

// Auth de una app secundaria: envoltura que resuelve al Firebase Auth real cuando se usa.
function secundaria(app) {
  const p = real().then(m => m.getAuth(app));
  return { __secundaria: true, app, name: app.name, _p: p, get currentUser() { return null; } };
}

export function getAuth(app) { return esPrincipal(app) ? tc() : secundaria(app); }
export const initializeAuth = getAuth;

export function onAuthStateChanged(auth, fn) {
  if (auth && auth.__secundaria) { let quitar = () => {}; real().then(async m => { quitar = m.onAuthStateChanged(await auth._p, fn); }); return () => quitar(); }
  return tc().onAuthStateChanged(fn);
}

export async function signInWithEmailAndPassword(auth, correo, clave) {
  if (auth && auth.__secundaria) { const m = await real(); return m.signInWithEmailAndPassword(await auth._p, correo, clave); }
  return tc().signInWithEmailAndPassword(correo, clave);
}

export async function signOut(auth) {
  if (auth && auth.__secundaria) { const m = await real(); return m.signOut(await auth._p); }
  return tc().signOut();
}

export async function createUserWithEmailAndPassword(auth, correo, clave) {
  if (auth && auth.__secundaria) { const m = await real(); return m.createUserWithEmailAndPassword(await auth._p, correo, clave); }
  throw Object.assign(new Error('Para crear cuentas usa una app secundaria (no cierra tu sesión).'), { code: 'auth/operation-not-allowed' });
}

export function getIdToken(user, forzar) { return user.getIdToken(forzar); }
export function getIdTokenResult(user, forzar) { return user.getIdTokenResult(forzar); }

// Constantes que algunos módulos podrían pasar; aquí no hacen nada (Supabase guarda la sesión solo).
export const browserLocalPersistence = { type: 'LOCAL' };
export const browserSessionPersistence = { type: 'SESSION' };
export const inMemoryPersistence = { type: 'NONE' };
export async function setPersistence() {}
