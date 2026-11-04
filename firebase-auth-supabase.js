/* ════════════════════════════════════════════════════════════════════
   firebase-auth-supabase.js — Portal Tecnocontrol (Etapa 2a, nov-2026)
   ────────────────────────────────────────────────────────────────────
   index.html tiene un "import map" que manda aquí toda carga de
   https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js
   Así los módulos (ventas.js, pagos.js, contabilidad.js, operaciones.js…)
   siguen escribiendo getAuth(app), onAuthStateChanged(auth, …), etc. sin
   cambiar nada, pero por dentro ya es Supabase (window.tcAuth, de
   auth-supabase.js).

   Etapa 2c (3-nov-2026): las altas de cuentas con una app SECUNDARIA
   ("Agregar usuario", "Acceso al kiosco" y admin-directorio) ya crean la
   cuenta directo en Supabase con la Edge Function crear-usuario; regresan
   { user: { uid } } igual que Firebase, así el código que las llama no cambia.
   ════════════════════════════════════════════════════════════════════ */

// "?original" hace que la dirección no coincida con el import map y se cargue el Firebase Auth real.
const REAL = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js?original';
let _real = null;
const real = () => _real || (_real = import(REAL));

// Las apps con nombre de los kioscos ('kiosco-material', 'kiosco-requisicion', 'admin-directorio'…) también
// son Supabase. Las apps temporales para CREAR cuentas usan la Edge Function crear-usuario (etapa 2c).
function esPrincipal(app) { return !app || !/^(alta-usuario|acceso-kiosco|crear-usuario)-/.test(String(app.name || '')); }
function tc() {
  if (!window.tcAuth) throw new Error('Falta auth-supabase.js antes del código del portal');
  return window.tcAuth;
}

// Auth de una app secundaria: envoltura que resuelve al Firebase Auth real cuando se usa.
// El Firebase real solo se carga si de verdad se usa (ya no para crear cuentas).
function secundaria(app) {
  let p = null;
  return { __secundaria: true, app, name: app.name, get _p() { return p || (p = real().then(m => m.getAuth(app))); }, get currentUser() { return null; } };
}
// Alta de cuenta en Supabase (Edge Function crear-usuario) con la sesión de quien la crea.
const FN_CREAR = 'https://vlbyjoqessxcmkejcujp.supabase.co/functions/v1/crear-usuario';
const SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
async function crearEnSupabase(correo, clave) {
  const yo = tc().currentUser;
  if (!yo) throw Object.assign(new Error('Inicia sesión para crear cuentas'), { code: 'auth/requires-recent-login' });
  const token = await yo.getIdToken();
  const r = await fetch(FN_CREAR, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + token }, body: JSON.stringify({ email: correo, password: clave }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.uid) throw Object.assign(new Error(j.error || ('No se pudo crear la cuenta (HTTP ' + r.status + ')')), { code: j.codigo || 'auth/internal-error' });
  return { user: { uid: j.uid, email: j.email || correo, getIdToken: async () => null } };
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
  if (auth && auth.__secundaria) return; // las cuentas nuevas no abren sesión: no hay nada que cerrar
  return tc().signOut();
}

export async function createUserWithEmailAndPassword(auth, correo, clave) {
  if (auth && auth.__secundaria) return crearEnSupabase(correo, clave);
  throw Object.assign(new Error('Para crear cuentas usa una app secundaria (no cierra tu sesión).'), { code: 'auth/operation-not-allowed' });
}

export function getIdToken(user, forzar) { return user.getIdToken(forzar); }
export function getIdTokenResult(user, forzar) { return user.getIdTokenResult(forzar); }

// Constantes que algunos módulos podrían pasar; aquí no hacen nada (Supabase guarda la sesión solo).
export const browserLocalPersistence = { type: 'LOCAL' };
export const browserSessionPersistence = { type: 'SESSION' };
export const inMemoryPersistence = { type: 'NONE' };
export async function setPersistence() {}
