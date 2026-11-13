'use strict';
/**
 * guardian-aspel.js — Portal Operativo Tecnocontrol (13-nov-2026)
 * ---------------------------------------------------------------------------
 * Mantiene SIEMPRE corriendo los 4 procesos de Aspel, sin ventanas que se
 * puedan cerrar por error:
 *    vigilar-firebird.js            (marca pedidos como remisionados)
 *    sincronizar-aspel.js           (Aspel -> Supabase, cada 5 min)
 *    sincronizar-partidas-aspel.js  (partidas -> Supabase, cada 5 min)
 *    sincronizar-productos-aspel.js (catálogo -> Supabase, cada 30 min)
 *
 *  - Los arranca ocultos. Si uno se cae, lo vuelve a arrancar solo.
 *  - Si ya hay una copia corriendo en ventana (la forma vieja), NO abre otra:
 *    espera a que esa se cierre y entonces la reemplaza.
 *  - Solo puede haber UN guardián a la vez (si se lanza otro, se sale solo).
 *  - Cada minuto reporta a Supabase (tabla aspel_monitor) cómo está cada
 *    proceso; el portal avisa si algo deja de reportarse.
 *  - Bitácora propia: guardian-aspel.log (misma carpeta).
 *
 * Usa el mismo aspel-sync.config.json. No escribe nada en Aspel.
 *
 * v2 (13-nov-2026): cada proceso arranca con las variables (set NOMBRE=valor) de su
 *   .bat original (ej. ASPEL_SYSDBA_PASSWORD de arrancar-vigilante.bat), así que no
 *   hay contraseñas en este archivo. Si un proceso se cierra al arrancar, guarda sus
 *   últimas líneas en guardian-<id>.errores.log. Si este archivo se actualiza, el
 *   guardián se reinicia solo (la tarea programada lo vuelve a lanzar en <= 5 min).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { spawn, execFile } = require('child_process');

const DIR = __dirname;
const ARCH_CONFIG = path.join(DIR, 'aspel-sync.config.json');
const ARCH_LOG = path.join(DIR, 'guardian-aspel.log');
const PUERTO_CANDADO = 47391;          // evita dos guardianes al mismo tiempo
const CADA_MS = 60 * 1000;

// prefijo = cómo empieza el nombre de la bitácora de cada script
// limiteMin = minutos sin escribir en su bitácora para considerarlo "atorado"
const SCRIPTS = [
  { id: 'vigilante', bat: 'arrancar-vigilante.bat', archivo: 'vigilar-firebird.js', prefijo: 'vigilante-firebird', limiteMin: 5 },
  { id: 'aspel', bat: 'iniciar-sincronizador-aspel.bat', archivo: 'sincronizar-aspel.js', prefijo: 'aspel-sync', limiteMin: 15 },
  { id: 'partidas', bat: 'iniciar-sincronizador-partidas.bat', archivo: 'sincronizar-partidas-aspel.js', prefijo: 'partidas-aspel', limiteMin: 15 },
  { id: 'productos', bat: 'iniciar-sincronizador-productos.bat', archivo: 'sincronizar-productos-aspel.js', prefijo: 'productos-aspel', limiteMin: 75 },
];

function log(msg) {
  const linea = '[' + new Date().toLocaleString('es-MX') + '] ' + msg;
  try {
    if (fs.existsSync(ARCH_LOG) && fs.statSync(ARCH_LOG).size > 5 * 1024 * 1024) fs.renameSync(ARCH_LOG, ARCH_LOG + '.anterior');
    fs.appendFileSync(ARCH_LOG, linea + '\n', 'utf8');
  } catch (e) { /* sin log en disco */ }
}

function leerConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(ARCH_CONFIG, 'utf8'));
    if (c && c.supabase && c.supabase.url && c.supabase.llaveSecreta) return c;
  } catch (e) { /* abajo */ }
  log('AVISO: no pude leer la URL/llave de Supabase en aspel-sync.config.json; sigo cuidando los procesos pero sin reportar al portal.');
  return null;
}

// ── Procesos node que ya están corriendo (para no duplicar) ──
function procesosNode() {
  return new Promise((resolve) => {
    execFile('wmic', ['process', 'where', "name='node.exe'", 'get', 'ProcessId,CommandLine', '/format:csv'],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, salida) => {
        if (!err && salida) return resolve(String(salida));
        execFile('powershell', ['-NoProfile', '-Command',
          "Get-CimInstance Win32_Process -Filter \"name='node.exe'\" | ForEach-Object { $_.ProcessId.ToString() + ',' + $_.CommandLine }"],
          { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err2, salida2) => resolve(err2 ? '' : String(salida2 || '')));
      });
  });
}

// Variables "set NOMBRE=valor" del .bat original de cada proceso (contraseñas, rutas, etc.)
function variablesDelBat(nombreBat) {
  const vars = {};
  try {
    const txt = fs.readFileSync(path.join(DIR, nombreBat), 'utf8');
    txt.split(/\r?\n/).forEach((l) => {
      const m = l.match(/^\s*set\s+"?([A-Za-z_][A-Za-z0-9_]*)=(.*?)"?\s*$/i);
      if (m) vars[m[1]] = m[2].replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (x, n) => (vars[n] != null ? vars[n] : (process.env[n] || x)));
    });
  } catch (e) { /* sin .bat: sin variables extra */ }
  return vars;
}

const estado = {};
SCRIPTS.forEach((s) => { estado[s.id] = { hijo: null, pid: null, modo: 'detenido', reinicios: [], ultimoError: '', esperaHasta: 0, fallosSeguidos: 0 }; });

function arrancar(s) {
  const e = estado[s.id];
  const archErr = path.join(DIR, 'guardian-' + s.id + '.errores.log');
  let fdErr = 'ignore';
  try { fdErr = fs.openSync(archErr, 'a'); } catch (x) { /* sin archivo */ }
  let hijo;
  const ultimas = [];
  try {
    const env = Object.assign({}, process.env, variablesDelBat(s.bat));
    hijo = spawn(process.execPath, [path.join(DIR, s.archivo)], { cwd: DIR, env, windowsHide: true, stdio: ['ignore', 'pipe', fdErr] });
    hijo.stdout.on('data', (d) => { String(d).split(/\r?\n/).filter(Boolean).forEach((l) => { ultimas.push(l); if (ultimas.length > 20) ultimas.shift(); }); });
  } catch (x) {
    e.ultimoError = 'No arrancó: ' + x.message; log(s.archivo + ' — ' + e.ultimoError); return;
  }
  e.hijo = hijo; e.pid = hijo.pid; e.modo = 'guardian'; e.inicio = Date.now();
  log('Arrancado ' + s.archivo + ' (pid ' + hijo.pid + ')');
  hijo.on('exit', (codigo) => {
    const vivio = Date.now() - (e.inicio || Date.now());
    e.hijo = null; e.pid = null; e.modo = 'caido';
    e.ultimoError = 'Se detuvo (código ' + codigo + ') después de ' + Math.round(vivio / 1000) + ' s';
    e.reinicios.push(Date.now());
    e.fallosSeguidos = vivio < 120000 ? e.fallosSeguidos + 1 : 0;
    if (vivio < 120000 && ultimas.length) {
      try { fs.appendFileSync(archErr, '[' + new Date().toLocaleString('es-MX') + '] Últimas líneas antes de cerrarse:\n' + ultimas.join('\n') + '\n\n', 'utf8'); } catch (x) { /* nada */ }
      e.ultimoError += ' — ' + ultimas[ultimas.length - 1].slice(0, 150);
    }
    const espera = Math.min(300000, 10000 * Math.pow(2, e.fallosSeguidos)); // 10 s, 20 s, 40 s… máx 5 min
    e.esperaHasta = Date.now() + espera;
    log(s.archivo + ' — ' + e.ultimoError + '. Lo vuelvo a arrancar en ' + Math.round(espera / 1000) + ' s. Detalle en ' + path.basename(archErr));
    if (typeof fdErr === 'number') { try { fs.closeSync(fdErr); } catch (x) { /* nada */ } }
  });
}

function ultimaEscritura(prefijo) {
  let max = 0;
  try {
    fs.readdirSync(DIR).forEach((n) => {
      if (n.toLowerCase().startsWith(prefijo) && !/\.json$/i.test(n) && !/\.config/i.test(n)) {
        const t = fs.statSync(path.join(DIR, n)).mtimeMs; if (t > max) max = t;
      }
    });
  } catch (e) { /* nada */ }
  return max ? new Date(max).toISOString() : null;
}

async function revisar(cfg) {
  const lista = await procesosNode();
  const ahora = Date.now();
  for (const s of SCRIPTS) {
    const e = estado[s.id];
    if (e.hijo) continue; // ya lo cuida el guardián
    const linea = lista.split(/\r?\n/).find((l) => l.toLowerCase().indexOf(s.archivo.toLowerCase()) >= 0 && l.toLowerCase().indexOf('guardian-aspel') < 0);
    if (linea) {
      if (e.modo !== 'externo') log(s.archivo + ' ya está corriendo en una ventana; no abro otro. Lo tomo yo cuando esa se cierre.');
      e.modo = 'externo'; e.pid = (linea.match(/(\d+)\s*$/) || linea.match(/^(\d+),/) || [])[1] || null;
      continue;
    }
    if (ahora >= e.esperaHasta) arrancar(s);
  }
  if (cfg) await reportar(cfg);
}

async function reportar(cfg) {
  const ahora = Date.now();
  const datos = {};
  SCRIPTS.forEach((s) => {
    const e = estado[s.id];
    e.reinicios = e.reinicios.filter((t) => ahora - t < 3600000);
    const ult = ultimaEscritura(s.prefijo);
    datos[s.id] = {
      archivo: s.archivo,
      estado: e.modo,                 // guardian | externo | caido | detenido
      pid: e.pid,
      reinicios_ultima_hora: e.reinicios.length,
      ultimo_log: ult,
      atorado: !!(ult && ahora - new Date(ult).getTime() > s.limiteMin * 60000),
      limite_min: s.limiteMin,
      ultimo_error: e.ultimoError || null,
    };
  });
  const fila = { id: 'aspel-pc', equipo: os.hostname(), actualizado: new Date().toISOString(), datos };
  try {
    const r = await fetch(cfg.supabase.url.replace(/\/+$/, '') + '/rest/v1/aspel_monitor?on_conflict=id', {
      method: 'POST',
      headers: { apikey: cfg.supabase.llaveSecreta, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([fila]),
    });
    if (!r.ok) log('No pude reportar al portal: Supabase respondió ' + r.status + ' ' + (await r.text()).slice(0, 200));
  } catch (e) { log('No pude reportar al portal (sin internet?): ' + e.message); }
}

// ── Inicio: un solo guardián ──
const candado = net.createServer();
candado.once('error', () => { process.exit(0); }); // ya hay otro guardián corriendo
candado.listen(PUERTO_CANDADO, '127.0.0.1', () => {
  log('Guardián iniciado en ' + os.hostname() + ' (node ' + process.version + ').');
  const cfg = leerConfig();
  const ciclo = () => revisar(cfg).catch((e) => log('Error en revisión: ' + e.message));
  ciclo();
  setInterval(ciclo, CADA_MS);
  // Si guardian-aspel.js se actualiza, me salgo; la tarea programada arranca la versión nueva.
  let miVersion = 0; try { miVersion = fs.statSync(__filename).mtimeMs; } catch (e) { /* nada */ }
  setInterval(() => {
    try { if (fs.statSync(__filename).mtimeMs !== miVersion) { log('guardian-aspel.js cambió; me reinicio con la versión nueva.'); process.exit(0); } } catch (e) { /* nada */ }
  }, 30000);
});
process.on('uncaughtException', (e) => log('Error inesperado: ' + (e && e.stack || e)));
process.on('unhandledRejection', (e) => log('Error inesperado: ' + (e && e.stack || e)));
