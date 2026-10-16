'use strict';
/**
 * sincronizar-productos-aspel.js — Portal Operativo Tecnocontrol (16-oct-2026)
 * ---------------------------------------------------------------------------
 * Copia el catálogo de productos de Aspel SAE (tabla INVE01) a Supabase
 * (tabla aspel_productos). Regla: la CLAVE y la DESCRIPCIÓN de Aspel son
 * siempre las correctas; el portal las usa para todos los surtidos.
 *
 *  - En Aspel NO escribe nada (solo SELECT).
 *  - Usa el MISMO aspel-sync.config.json que sincronizar-aspel.js
 *    (misma carpeta "ASPEL - TECNOCONTROL"). No hay que configurar nada nuevo.
 *  - Solo manda a Supabase lo que cambió desde la última vez.
 *
 * Uso:
 *   node sincronizar-productos-aspel.js --prueba    lee Aspel y muestra ejemplos; NO escribe
 *   node sincronizar-productos-aspel.js --una-vez   sincroniza una vez y termina
 *   node sincronizar-productos-aspel.js --todo      vuelve a mandar todo el catálogo
 *   node sincronizar-productos-aspel.js             se queda trabajando (cada 30 min)
 *
 * Independiente de sincronizar-aspel.js y vigilar-firebird.js.
 */

let Firebird;
try { Firebird = require('node-firebird'); } catch (e) {
  console.error('\nFalta la libreria node-firebird. En esta carpeta corre:  npm install node-firebird\n');
  process.exit(1);
}
const fs = require('fs');
const path = require('path');

const ARGS = process.argv.slice(2);
const MODO_PRUEBA = ARGS.includes('--prueba');
const TODO = ARGS.includes('--todo');
const UNA_VEZ = ARGS.includes('--una-vez') || MODO_PRUEBA;
const DIR = __dirname;
const ARCH_CONFIG = path.join(DIR, 'aspel-sync.config.json');
const ARCH_ESTADO = path.join(DIR, 'productos-aspel.estado.json');
const ARCH_LOG = path.join(DIR, 'productos-aspel.log');

function log(msg) {
  const linea = '[' + new Date().toLocaleString('es-MX') + '] ' + msg;
  console.log(linea);
  try { fs.appendFileSync(ARCH_LOG, linea + '\n', 'utf8'); } catch (e) { /* sin log en disco */ }
}

function leerConfig() {
  if (!fs.existsSync(ARCH_CONFIG)) {
    console.error('\nNo encuentro aspel-sync.config.json en ' + DIR +
      '\nEste archivo debe ir en la misma carpeta que sincronizar-aspel.js.\n');
    process.exit(1);
  }
  let c;
  try { c = JSON.parse(fs.readFileSync(ARCH_CONFIG, 'utf8')); }
  catch (e) { console.error('\naspel-sync.config.json tiene un error de formato: ' + e.message + '\n'); process.exit(1); }
  c.empresa = String(c.empresa || '01');
  c.intervaloProductosMinutos = Math.max(5, Number(c.intervaloProductosMinutos) || 30);
  if (!MODO_PRUEBA) {
    const k = (c.supabase && c.supabase.llaveSecreta) || '';
    if (!k || k.indexOf('PEGA_AQUI') >= 0 || /^sb_publishable_/.test(k)) {
      console.error('\nFalta la llave SECRETA de Supabase en aspel-sync.config.json.\n');
      process.exit(1);
    }
    if (typeof fetch !== 'function') {
      console.error('\nEsta version de Node es muy vieja (no trae fetch). Usa Node 18 o mas nuevo.\n');
      process.exit(1);
    }
  }
  return c;
}

// Aspel guarda el texto en Windows-1252 / Latin-1. Se pide como bytes
// (OCTETS) y se convierte aquí, para que Ñ y acentos salgan bien.
const DEC = new TextDecoder('windows-1252');
function texto(v) {
  if (v == null) return '';
  if (Buffer.isBuffer(v)) return DEC.decode(v).replace(/\0+$/, '').trim();
  return String(v).trim();
}

function leerAspel(cfg) {
  const tabla = 'INVE' + cfg.empresa;
  const sql =
    'SELECT CAST(CVE_ART AS VARCHAR(64) CHARACTER SET OCTETS) AS CLAVE, ' +
    '       CAST(DESCR   AS VARCHAR(255) CHARACTER SET OCTETS) AS DESCR, ' +
    '       CAST(UNI_MED AS VARCHAR(32) CHARACTER SET OCTETS) AS UNIDAD, ' +
    '       CAST(LIN_PROD AS VARCHAR(32) CHARACTER SET OCTETS) AS LINEA, ' +
    '       STATUS FROM ' + tabla;
  const opciones = Object.assign({ lowercase_keys: false }, cfg.firebird);
  return new Promise((ok, ko) => {
    Firebird.attach(opciones, (err, db) => {
      if (err) return ko(err);
      db.query(sql, [], (err2, filas) => {
        db.detach();
        if (err2) return ko(err2);
        ok((filas || []).map(f => ({
          clave: texto(f.CLAVE),
          descripcion: texto(f.DESCR),
          unidad: texto(f.UNIDAD),
          linea: texto(f.LINEA),
          status: texto(f.STATUS),
        })).filter(p => p.clave));
      });
    });
  });
}

function leerEstado() {
  if (TODO) return {};
  try { return JSON.parse(fs.readFileSync(ARCH_ESTADO, 'utf8')) || {}; } catch (e) { return {}; }
}
function huella(p) { return [p.descripcion, p.unidad, p.linea, p.status].join('\u0001'); }

async function subir(cfg, filas) {
  const url = cfg.supabase.url.replace(/\/+$/, '') + '/rest/v1/aspel_productos?on_conflict=empresa,clave';
  for (let i = 0; i < filas.length; i += 500) {
    const lote = filas.slice(i, i + 500);
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: cfg.supabase.llaveSecreta,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(lote),
    });
    if (!r.ok) throw new Error('Supabase respondio ' + r.status + ': ' + (await r.text()).slice(0, 300));
  }
}

async function ciclo(cfg) {
  const productos = await leerAspel(cfg);
  if (MODO_PRUEBA) {
    log('PRUEBA: ' + productos.length + ' productos en INVE' + cfg.empresa + '. Ejemplos:');
    productos.filter(p => /BOTE/i.test(p.clave)).concat(productos.slice(0, 5)).slice(0, 8)
      .forEach(p => console.log('   ' + p.clave + '  ·  ' + p.descripcion + '  ·  ' + p.unidad + '  ·  ' + p.status));
    return;
  }
  const estado = leerEstado();
  const ahora = new Date().toISOString();
  const cambios = productos.filter(p => estado[p.clave] !== huella(p))
    .map(p => Object.assign({ empresa: cfg.empresa, actualizado_en: ahora }, p));
  if (!cambios.length) { log('Sin cambios (' + productos.length + ' productos).'); return; }
  await subir(cfg, cambios);
  const nuevo = {};
  productos.forEach(p => { nuevo[p.clave] = huella(p); });
  fs.writeFileSync(ARCH_ESTADO, JSON.stringify(nuevo), 'utf8');
  log('Listo: ' + cambios.length + ' productos nuevos o cambiados enviados (de ' + productos.length + ').');
}

async function main() {
  const cfg = leerConfig();
  log('Sincronizador de productos Aspel → Supabase (empresa ' + cfg.empresa + ')' + (MODO_PRUEBA ? ' — MODO PRUEBA' : ''));
  const correr = () => ciclo(cfg).catch(e => log('ERROR: ' + (e && e.message ? e.message : e)));
  await correr();
  if (UNA_VEZ) return;
  log('Siguiente revision cada ' + cfg.intervaloProductosMinutos + ' min. Deja esta ventana abierta (o minimizada).');
  setInterval(correr, cfg.intervaloProductosMinutos * 60 * 1000);
}
main();
