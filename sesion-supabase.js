/* ════════════════════════════════════════════════════════════════════
   sesion-supabase.js — Portal Tecnocontrol (Etapa 1 del login, nov-2026)
   ────────────────────────────────────────────────────────────────────
   Mientras el portal y la app de Flotilla siguen entrando con Firebase,
   este archivo abre ADEMÁS una sesión en Supabase Auth con el mismo
   correo y la misma contraseña. Si la cuenta todavía no existe en
   Supabase, la Edge Function `auth-migrar` comprueba la contraseña contra
   Firebase y crea la cuenta con esa misma contraseña. Nadie recibe correos
   ni cambia nada.

   La sesión se guarda con su propia llave (`tc-sesion-supabase`), separada
   de los demás clientes de Supabase del portal: en esta etapa nada de lo
   que ya funciona cambia de comportamiento. Si Supabase falla, Firebase
   sigue igual y nadie se queda fuera.

   API:
     tcSesion.entrar(correo, contraseña) → {ok, migrado, error}
     tcSesion.asegurar(correo)  → si no hay sesión de Supabase para ese
                                  correo, pide la contraseña UNA vez
     tcSesion.salir()           → cierra la sesión de Supabase
     tcSesion.correo()          → correo con sesión en Supabase o null
     tcSesion.cliente()         → cliente de Supabase con la sesión
     tcSesion.recordarClave(correo, contraseña)  → la usa `asegurar` sin
                                  preguntar (para el inicio de sesión normal)
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.tcSesion) return;

  var SB_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
  var SB_KEY = 'sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
  var FN_MIGRAR = SB_URL + '/functions/v1/auth-migrar';
  // Kioscos (nov-2026): cada kiosco guarda su sesión aparte para no mezclarse con la del portal.
  var LLAVE = window.TC_SESION_LLAVE || 'tc-sesion-supabase';
  var ALMACEN = window.TC_SESION_ALMACEN === 'sesion' ? window.sessionStorage : undefined; // 'sesion' = se borra al cerrar la pestaña
  var POSPUESTO = 'tcSesionPospuesta';

  var _cliP = null;
  var _claveLogin = null;   // {correo, clave} del formulario de inicio de sesión
  var _pidiendo = false;

  function norm(c) { return String(c || '').trim().toLowerCase(); }

  function cliente() {
    if (_cliP) return _cliP;
    _cliP = (window.supabase && window.supabase.createClient
      ? Promise.resolve(window.supabase)
      : import('https://esm.sh/@supabase/supabase-js@2')
    ).then(function (m) {
      return m.createClient(SB_URL, SB_KEY, {
        auth: { storageKey: LLAVE, storage: ALMACEN, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      });
    }).catch(function (e) { _cliP = null; throw e; });
    return _cliP;
  }

  async function correo() {
    var c = await cliente();
    var r = await c.auth.getSession();
    var s = r && r.data && r.data.session;
    return s && s.user ? norm(s.user.email) : null;
  }

  async function entrar(email, clave) {
    email = norm(email);
    if (!email || !clave) return { ok: false, error: 'Falta correo o contraseña' };
    try {
      var c = await cliente();
      var r = await c.auth.signInWithPassword({ email: email, password: clave });
      if (!r.error) return { ok: true, migrado: false };

      // No existe en Supabase o tiene otra contraseña: validar contra Firebase y migrar.
      var m = await fetch(FN_MIGRAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
        body: JSON.stringify({ email: email, password: clave })
      });
      var j = await m.json().catch(function () { return {}; });
      if (!m.ok) return { ok: false, error: j.error || ('Error ' + m.status), status: m.status };

      r = await c.auth.signInWithPassword({ email: email, password: clave });
      if (r.error) return { ok: false, error: r.error.message };
      console.log('[sesion-supabase] cuenta pasada a Supabase:', email);
      return { ok: true, migrado: true };
    } catch (e) {
      console.warn('[sesion-supabase] entrar:', e && e.message);
      return { ok: false, error: (e && e.message) || String(e), red: true };
    }
  }

  async function salir() {
    try { var c = await cliente(); await c.auth.signOut({ scope: 'local' }); }
    catch (e) { console.warn('[sesion-supabase] salir:', e && e.message); }
  }

  function recordarClave(email, clave) {
    _claveLogin = { correo: norm(email), clave: clave };
    // Se olvida sola en 2 minutos: solo sirve para el inicio de sesión que está en curso.
    setTimeout(function () { _claveLogin = null; }, 120000);
  }

  async function asegurar(email) {
    email = norm(email);
    if (!email) return;
    try { if ((await correo()) === email) return; }
    catch (e) { return; }   // Supabase no disponible: no molestar a nadie

    // Si viene de escribir su contraseña en el formulario, se usa esa sin preguntar.
    if (_claveLogin && _claveLogin.correo === email) {
      var clave = _claveLogin.clave; _claveLogin = null;
      var r = await entrar(email, clave);
      if (r.ok) return;
    }
    try { if (sessionStorage.getItem(POSPUESTO) === email) return; } catch (e) {}
    pedirClave(email);
  }

  // ───────────── ventana: pedir la contraseña una sola vez ─────────────
  function estilos() {
    if (document.getElementById('tc-ses-css')) return;
    var st = document.createElement('style');
    st.id = 'tc-ses-css';
    st.textContent =
      '#tc-ses-fondo{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}' +
      '#tc-ses-caja{background:#fff;border-radius:14px;max-width:400px;width:100%;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.25);color:#1e293b}' +
      '#tc-ses-caja h3{margin:0 0 6px;font-size:18px;color:#1D2E73;display:flex;align-items:center;gap:8px}' +
      '#tc-ses-caja p{margin:0 0 14px;font-size:14px;line-height:1.45;color:#475569}' +
      '#tc-ses-caja .corr{font-size:13px;color:#1D2E73;font-weight:600;margin-bottom:8px;word-break:break-all}' +
      '#tc-ses-caja input{width:100%;box-sizing:border-box;border:1.5px solid #cbd5e1;border-radius:10px;padding:12px;font-size:16px;outline:none}' +
      '#tc-ses-caja input:focus{border-color:#1D2E73}' +
      '#tc-ses-err{color:#E7402B;font-size:13px;min-height:18px;margin:8px 0 4px}' +
      '#tc-ses-caja .btns{display:flex;gap:10px;margin-top:6px}' +
      '#tc-ses-caja button{flex:1;border:0;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer}' +
      '#tc-ses-ok{background:#1D2E73;color:#fff}#tc-ses-ok:disabled{opacity:.6;cursor:default}' +
      '#tc-ses-luego{background:#f1f5f9;color:#475569}';
    document.head.appendChild(st);
  }

  function pedirClave(email) {
    if (_pidiendo || !document.body) return;
    _pidiendo = true;
    estilos();
    var fondo = document.createElement('div');
    fondo.id = 'tc-ses-fondo';
    fondo.innerHTML =
      '<div id="tc-ses-caja" role="dialog" aria-modal="true">' +
        '<h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1D2E73" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Confirma tu contraseña</h3>' +
        '<p>Estamos pasando tu cuenta a un sistema nuevo. Escribe <b>la misma contraseña con la que siempre entras</b>. Solo te lo pediremos esta vez.</p>' +
        '<div class="corr"></div>' +
        '<input id="tc-ses-clave" type="password" autocomplete="current-password" placeholder="Tu contraseña">' +
        '<div id="tc-ses-err"></div>' +
        '<div class="btns"><button id="tc-ses-luego" type="button">Más tarde</button><button id="tc-ses-ok" type="button">Confirmar</button></div>' +
      '</div>';
    fondo.querySelector('.corr').textContent = email;
    document.body.appendChild(fondo);

    var inp = fondo.querySelector('#tc-ses-clave');
    var ok = fondo.querySelector('#tc-ses-ok');
    var err = fondo.querySelector('#tc-ses-err');
    function cerrar() { fondo.remove(); _pidiendo = false; }

    async function confirmar() {
      var clave = inp.value;
      if (!clave) { err.textContent = 'Escribe tu contraseña.'; inp.focus(); return; }
      ok.disabled = true; ok.textContent = 'Revisando…'; err.textContent = '';
      var r = await entrar(email, clave);
      if (r.ok) { cerrar(); return; }
      ok.disabled = false; ok.textContent = 'Confirmar';
      err.textContent = r.status === 401 ? 'Esa no es tu contraseña. Es la misma con la que entras al portal.'
        : r.status === 429 ? 'Demasiados intentos. Espera unos minutos.'
        : 'No se pudo confirmar ahora. Puedes seguir trabajando y lo intentamos después.';
      inp.select();
    }
    ok.onclick = confirmar;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') confirmar(); });
    fondo.querySelector('#tc-ses-luego').onclick = function () {
      try { sessionStorage.setItem(POSPUESTO, email); } catch (e) {}
      cerrar();
    };
    setTimeout(function () { inp.focus(); }, 50);
  }

  window.tcSesion = { cliente: cliente, entrar: entrar, salir: salir, asegurar: asegurar, correo: correo, recordarClave: recordarClave };
})();
