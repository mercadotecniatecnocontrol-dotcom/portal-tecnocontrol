// ═════════════════════════════════════════════════════════════════
//  supabase-cliente.js — Portal Operativo Tecnocontrol  (26-oct-2026)
// ═════════════════════════════════════════════════════════════════
//  P0-01 · Etapa A. UN SOLO cliente de Supabase para todo el portal, que manda
//  la sesión real de Firebase (Third-party Auth) en cada consulta.
//
//  Por qué existe: antes cada módulo (portal-supabase, operaciones-supabase,
//  surtidos-supabase, compras-supabase, almacén, RH, ventas, permisos…) creaba
//  su propio cliente SIN sesión (rol "anon"). Todos esos módulos ya revisan
//  primero `window.tcSupabase`; este archivo lo crea ANTES que ellos, así que
//  todos pasan a usar el mismo cliente con sesión sin tocar su código.
//
//  Seguridad de la transición:
//   · Si no hay usuario, el usuario es anónimo (kiosco/TV) o su token no trae
//     role = "authenticated", NO se manda token → se usa la llave pública
//     como hasta hoy. Nada deja de funcionar en esta etapa.
//   · Interruptor de emergencia (solo en esa computadora), en la consola F12:
//        localStorage.setItem('tc_sb_sin_sesion','1'); location.reload();
//     y para volver a encenderlo:
//        localStorage.removeItem('tc_sb_sin_sesion'); location.reload();
//   · Diagnóstico rápido en la consola F12:   tcSbEstado()
//
//  Requiere: supabase-js UMD (window.supabase) cargado justo antes, con versión
//  fija, en index.html. Si no cargó, este archivo no hace nada y cada módulo
//  crea su cliente como antes (sin sesión).
// ═════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.tcSupabase) return;

  var SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.warn('[Supabase] No cargó la librería; los módulos usarán su cliente sin sesión.');
    return;
  }

  var apagado = false;
  try { apagado = localStorage.getItem('tc_sb_sin_sesion') === '1'; } catch (e) { /* modo privado */ }

  var ultimo = { conSesion: false, motivo: 'sin consultas todavía' };

  function token() {
    if (apagado) { ultimo = { conSesion: false, motivo: 'interruptor de emergencia encendido' }; return Promise.resolve(null); }
    var u = window.auth && window.auth.currentUser;
    if (!u) { ultimo = { conSesion: false, motivo: 'sin sesión iniciada' }; return Promise.resolve(null); }
    if (u.isAnonymous) { ultimo = { conSesion: false, motivo: 'sesión anónima' }; return Promise.resolve(null); }
    // getIdTokenResult usa el token guardado y lo renueva solo cuando vence (1 h).
    return u.getIdTokenResult().then(function (r) {
      if (r && r.claims && r.claims.role === 'authenticated') {
        ultimo = { conSesion: true, motivo: 'ok', correo: r.claims.email || null };
        return r.token;
      }
      ultimo = { conSesion: false, motivo: 'el usuario no tiene el permiso "role: authenticated" en Firebase', correo: (r && r.claims && r.claims.email) || null };
      return null;
    }).catch(function (e) {
      ultimo = { conSesion: false, motivo: 'error al leer la sesión: ' + (e && e.message) };
      return null;
    });
  }

  window.tcSupabase = window.supabase.createClient(SB_URL, SB_KEY, { accessToken: token });

  // Diagnóstico: tcSbEstado()  →  dice si las consultas van con tu sesión y lo prueba contra la base.
  window.tcSbEstado = function () {
    return token().then(function () {
      return window.tcSupabase.from('ops_comisiones').select('id', { count: 'exact', head: true });
    }).then(function (r) {
      var out = {
        version: '2026-10-26 A',
        interruptor: apagado ? 'APAGADO (sin sesión)' : 'encendido',
        conSesion: ultimo.conSesion,
        motivo: ultimo.motivo,
        correo: ultimo.correo || null,
        prueba: r.error ? ('error: ' + r.error.message) : 'ok',
      };
      console.table(out);
      return out;
    });
  };
})();
