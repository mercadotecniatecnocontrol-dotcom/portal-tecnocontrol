/* ════════════════════════════════════════════════════════════════════
   auth-supabase.js — Portal Tecnocontrol (Etapa 2a del login, nov-2026)
   ────────────────────────────────────────────────────────────────────
   El portal y la app de Flotilla ya NO entran con Firebase Auth: entran
   con Supabase Auth. Este archivo crea `window.tcAuth`, que se comporta
   igual que el `auth` de Firebase que usaba todo el código:

     tcAuth.currentUser                 → { uid, email, displayName, getIdToken(), … }
     tcAuth.onAuthStateChanged(fn)      → avisa al entrar / salir (regresa "dejar de escuchar")
     tcAuth.signInWithEmailAndPassword(correo, contraseña)
     tcAuth.signOut()

   · uid = el MISMO uid de Firebase de siempre (firebase_uid), para que
     colaboradores, permisos, flujos de Compras, etc. sigan igual.
   · getIdToken() da el token de Supabase: la base de datos lo reconoce
     con current_firebase_uid() (migración login_2a_firebase_uid_desde_supabase).
   · Si alguien todavía no tiene cuenta en Supabase, al escribir su
     contraseña de siempre se le pasa sola (Edge Function auth-migrar),
     mientras Firebase siga encendido (hasta la etapa 3).

   Requiere: sesion-supabase.js cargado ANTES (da el cliente de Supabase
   con la sesión guardada en 'tc-sesion-supabase').

   Diagnóstico en la consola F12:   tcAuthEstado()
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.tcAuth) return;

  var _usuario = null;        // objeto con la forma del usuario de Firebase
  var _sesion = null;         // sesión de Supabase
  var _listo = false;         // ya se sabe si hay sesión o no
  var _escuchas = [];
  var _avisadoUid;            // último uid avisado (undefined = nunca)
  var _listoP;
  var _entrando = false;      // durante el inicio de sesión no se avisa a medias

  function ses() {
    if (!window.tcSesion) throw new Error('Falta sesion-supabase.js antes de auth-supabase.js');
    return window.tcSesion;
  }

  function decodificar(jwt) {
    try {
      var p = String(jwt || '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      while (p.length % 4) p += '=';
      return JSON.parse(decodeURIComponent(escape(atob(p))));
    } catch (e) { return {}; }
  }

  function armarUsuario(u) {
    if (!u) return null;
    var am = u.app_metadata || {}, um = u.user_metadata || {};
    return {
      uid: am.firebase_uid || um.firebase_uid || u.id,
      supabaseId: u.id,
      email: u.email || null,
      displayName: um.nombre || um.full_name || um.name || null,
      photoURL: null,
      emailVerified: true,
      isAnonymous: false,
      providerData: [],
      getIdToken: function (forzar) { return token(!!forzar); },
      getIdTokenResult: function (forzar) {
        return token(!!forzar).then(function (t) {
          return { token: t, claims: decodificar(t), signInProvider: 'password' };
        });
      },
      reload: function () { return Promise.resolve(); }
    };
  }

  async function token(forzar) {
    var c = await ses().cliente();
    var r = forzar ? await c.auth.refreshSession() : await c.auth.getSession();
    var s = r && r.data && r.data.session;
    return s ? s.access_token : null;
  }

  function avisar() {
    var uid = _usuario ? _usuario.uid : null;
    if (uid === _avisadoUid) return;   // solo cuando cambia quién está dentro (no al renovar el token)
    _avisadoUid = uid;
    _escuchas.slice().forEach(function (fn) {
      try { fn(_usuario); } catch (e) { console.error('[tcAuth] onAuthStateChanged:', e); }
    });
  }

  function ponerSesion(s) {
    _sesion = s || null;
    _usuario = s && s.user ? armarUsuario(s.user) : null;
  }

  function iniciar() {
    if (_listoP) return _listoP;
    _listoP = ses().cliente().then(async function (c) {
      var r = await c.auth.getSession();
      ponerSesion(r && r.data && r.data.session);
      c.auth.onAuthStateChange(function (evento, s) {
        if (evento === 'INITIAL_SESSION') return;
        ponerSesion(s);
        if (_listo && !_entrando) avisar();
      });
    }).catch(function (e) {
      console.error('[tcAuth] no se pudo leer la sesión de Supabase:', e && e.message);
      ponerSesion(null);
    }).then(function () {
      _listo = true;
      avisar();
    });
    return _listoP;
  }

  function errorAuth(codigo, mensaje) {
    var e = new Error(mensaje);
    e.code = codigo;
    return e;
  }

  // Si la cuenta de Supabase no trae el uid de Firebase (cuentas creadas antes de auth-migrar v3),
  // se le pone ahora, con la contraseña que acaba de escribir.
  async function asegurarUid(correo, clave) {
    var c = await ses().cliente();
    var r = await c.auth.getUser();
    var u = r && r.data && r.data.user;
    if (!u || (u.app_metadata && u.app_metadata.firebase_uid)) return;
    try {
      var m = await fetch('https://vlbyjoqessxcmkejcujp.supabase.co/functions/v1/auth-migrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8', Authorization: 'Bearer sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8' },
        body: JSON.stringify({ email: correo, password: clave })
      });
      if (m.ok) await c.auth.refreshSession();
      else console.warn('[tcAuth] no se pudo ligar el uid de Firebase:', m.status);
    } catch (e) { console.warn('[tcAuth] ligar uid:', e && e.message); }
  }

  var tcAuth = {
    name: '[DEFAULT]',
    get currentUser() { return _usuario; },
    get app() { return { name: '[DEFAULT]' }; },

    onAuthStateChanged: function (fn) {
      if (typeof fn !== 'function') return function () {};
      _escuchas.push(fn);
      if (_listo) setTimeout(function () { try { fn(_usuario); } catch (e) { console.error(e); } }, 0);
      else iniciar();
      return function () { _escuchas = _escuchas.filter(function (x) { return x !== fn; }); };
    },

    authStateReady: function () { return iniciar(); },

    signInWithEmailAndPassword: async function (correo, clave) {
      correo = String(correo || '').trim().toLowerCase();
      if (!correo || correo.indexOf('@') < 0) throw errorAuth('auth/invalid-email', 'Correo inválido');
      if (!clave) throw errorAuth('auth/wrong-password', 'Escribe tu contraseña');
      _entrando = true;
      var r;
      try { r = await ses().entrar(correo, clave); }
      catch (e) { _entrando = false; throw errorAuth('auth/network-request-failed', 'Sin conexión con el servidor'); }
      if (!r.ok) {
        _entrando = false;
        if (r.status === 429) throw errorAuth('auth/too-many-requests', 'Demasiados intentos — espera un momento');
        if (r.red) throw errorAuth('auth/network-request-failed', 'Sin conexión con el servidor');
        if (r.status === 401 || r.status === 400) throw errorAuth('auth/wrong-password', 'Correo o contraseña incorrectos');
        throw errorAuth('auth/internal-error', r.error || 'No se pudo iniciar sesión');
      }
      try {
        await asegurarUid(correo, clave);
        await iniciar();
        var c = await ses().cliente();
        var s = await c.auth.getSession();
        ponerSesion(s && s.data && s.data.session);
      } finally { _entrando = false; }
      avisar();
      return { user: _usuario };
    },

    signOut: async function () {
      try { await ses().salir(); } catch (e) { console.warn('[tcAuth] salir:', e && e.message); }
      ponerSesion(null);
      avisar();
    }
  };

  window.tcAuth = tcAuth;

  window.tcAuthEstado = function () {
    return token(false).then(function (t) {
      var c = decodificar(t);
      var out = {
        version: '2026-11-03 2a',
        conSesion: !!_usuario,
        correo: _usuario ? _usuario.email : null,
        uid: _usuario ? _usuario.uid : null,
        supabaseId: _usuario ? _usuario.supabaseId : null,
        uidEnToken: (c.app_metadata && c.app_metadata.firebase_uid) || null,
        venceToken: c.exp ? new Date(c.exp * 1000).toLocaleString() : null
      };
      console.table(out);
      return out;
    });
  };

  iniciar();
})();
