'use strict';
/**
 * sincronizar-remisiones-aspel.js — Portal Operativo Tecnocontrol (21-nov-2026)
 * ---------------------------------------------------------------------------
 * Copia las REMISIONES de Aspel SAE (FACTR01 con TIP_DOC='R' + sus partidas
 * PAR_FACTR01) a Supabase (tabla aspel_remisiones). Con eso el portal, en
 * Almacén, muestra el número de remisión de cada pedido y arma el PDF de la
 * remisión sin que nadie la escanee ni la capture.
 *
 *  - En Aspel NO escribe nada (solo SELECT).
 *  - Usa el MISMO aspel-sync.config.json (carpeta "ASPEL - TECNOCONTROL").
 *  - Enlace con el pedido: DOC_ANT de la remisión = folio del portal (CHH...).
 *  - Cada 5 min revisa las remisiones de los últimos 60 días y solo manda
 *    a Supabase las nuevas o las que cambiaron (ej. canceladas).
 *
 * Uso:
 *   node sincronizar-remisiones-aspel.js --prueba    lee Aspel y muestra ejemplos; NO escribe
 *   node sincronizar-remisiones-aspel.js --una-vez   sincroniza una vez y termina
 *   node sincronizar-remisiones-aspel.js --todo      vuelve a mandar todo (últimos 400 días)
 *   node sincronizar-remisiones-aspel.js             se queda trabajando (cada 5 min)
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
const ARCH_ESTADO = path.join(DIR, 'remisiones-aspel.estado.json');
const ARCH_LOG = path.join(DIR, 'remisiones-aspel.log');

function log(msg) {
  const linea = '[' + new Date().toLocaleString('es-MX') + '] ' + msg;
  console.log(linea);
  try {
    if (fs.existsSync(ARCH_LOG) && fs.statSync(ARCH_LOG).size > 5 * 1024 * 1024) fs.renameSync(ARCH_LOG, ARCH_LOG + '.anterior');
    fs.appendFileSync(ARCH_LOG, linea + '\n', 'utf8');
  } catch (e) { /* sin log en disco */ }
}

function leerConfig() {
  if (!fs.existsSync(ARCH_CONFIG)) {
    console.error('\nNo encuentro aspel-sync.config.json en ' + DIR + '\n');
    process.exit(1);
  }
  let c;
  try { c = JSON.parse(fs.readFileSync(ARCH_CONFIG, 'utf8')); }
  catch (e) { console.error('\naspel-sync.config.json tiene un error de formato: ' + e.message + '\n'); process.exit(1); }
  c.empresa = String(c.empresa || '01');
  c.intervaloRemisionesMinutos = Math.max(1, Number(c.intervaloRemisionesMinutos) || 5);
  c.diasRemisiones = Math.max(7, Number(c.diasRemisiones) || 60);
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

// Aspel guarda texto en Windows-1252: se pide como bytes (OCTETS) y se convierte aquí.
const DEC = new TextDecoder('windows-1252');
function texto(v) {
  if (v == null) return '';
  if (Buffer.isBuffer(v)) return DEC.decode(v).replace(/\0+/g, '').trim();
  return String(v).trim();
}
function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function fecha(v) { if (!v) return null; const d = v instanceof Date ? v : new Date(v); return isNaN(d.getTime()) ? null : d.toISOString(); }
// ── Columnas reales de cada tabla (Aspel cambia nombres entre versiones) ──
// Se leen del catálogo de Firebird; si una columna no existe se pide NULL en su lugar.
const COLS = {};
async function cargarColumnas(db, tablas) {
  const faltan = tablas.filter((t) => !COLS[t]);
  if (!faltan.length) return;
  const filas = await consulta(db,
    'SELECT TRIM(RDB$RELATION_NAME) AS TABLA, TRIM(RDB$FIELD_NAME) AS CAMPO FROM RDB$RELATION_FIELDS ' +
    'WHERE TRIM(RDB$RELATION_NAME) IN (' + marcas(faltan.length) + ')', faltan);
  faltan.forEach((t) => { COLS[t] = new Set(); });
  filas.forEach((f) => { COLS[texto(f.TABLA)].add(texto(f.CAMPO)); });
}
function hay(tabla, col) { return !!(COLS[tabla] && COLS[tabla].has(col)); }
// Texto (bytes Windows-1252) o NULL si no existe
function T(alias, tabla, col, largo, como) {
  return (hay(tabla, col) ? 'CAST(' + alias + '.' + col + ' AS VARCHAR(' + (largo || 60) + ') CHARACTER SET OCTETS)' : 'CAST(NULL AS VARCHAR(1))') + ' AS ' + como;
}
// Número / fecha tal cual, o NULL si no existe
function N(alias, tabla, col, como) { return (hay(tabla, col) ? alias + '.' + col : 'NULL') + ' AS ' + como; }
// Primera columna que exista de una lista
function primera(tabla, lista) { return lista.find((c) => hay(tabla, c)) || lista[0]; }
function columnasFaltantes(tabla, lista) { return lista.filter((c) => !hay(tabla, c)); }

// ── Lectura de encabezados (barata, cada ciclo) ──
async function leerEncabezados(db, cfg, dias) {
  const F = 'FACTR' + cfg.empresa;
  const falt = columnasFaltantes(F, ['CVE_DOC', 'STATUS', 'DOC_ANT', 'CVE_CLPV', 'CVE_VEND', 'SU_REFER', 'CONDICION', 'FECHA_DOC', 'FECHA_ENT', 'CAN_TOT', 'IMP_TOT4', 'DES_TOT', 'IMPORTE', 'CVE_OBS', 'VERSION_SINC']);
  if (falt.length) log('Aviso: ' + F + ' no tiene ' + falt.join(', ') + ' (se dejan vacías).');
  const sql = 'SELECT ' + [
    T('F', F, 'CVE_DOC', 40, 'CVE_DOC'), T('F', F, 'STATUS', 4, 'STATUS'),
    T('F', F, 'DOC_ANT', 40, 'DOC_ANT'), T('F', F, 'TIP_DOC_ANT', 4, 'TIP_DOC_ANT'),
    T('F', F, 'CVE_CLPV', 20, 'CVE_CLPV'), T('F', F, 'CVE_VEND', 10, 'CVE_VEND'),
    T('F', F, primera(F, ['SU_REFER', 'SU_REFERENCIA', 'REFERENCIA']), 40, 'SU_REFER'),
    T('F', F, primera(F, ['CONDICION', 'CONDICIONES']), 40, 'CONDICION'),
    N('F', F, 'FECHA_DOC', 'FECHA_DOC'), N('F', F, 'FECHA_ENT', 'FECHA_ENT'),
    N('F', F, 'CAN_TOT', 'CAN_TOT'), N('F', F, 'IMP_TOT1', 'IMP_TOT1'), N('F', F, 'IMP_TOT2', 'IMP_TOT2'),
    N('F', F, 'IMP_TOT3', 'IMP_TOT3'), N('F', F, 'IMP_TOT4', 'IMP_TOT4'),
    N('F', F, 'DES_TOT', 'DES_TOT'), N('F', F, 'DES_FIN', 'DES_FIN'), N('F', F, 'IMPORTE', 'IMPORTE'),
    N('F', F, 'NUM_ALMA', 'NUM_ALMA'), N('F', F, 'NUM_MONED', 'NUM_MONED'), N('F', F, 'TIPCAMB', 'TIPCAMB'),
    N('F', F, 'CVE_OBS', 'CVE_OBS'), N('F', F, 'VERSION_SINC', 'VERSION_SINC'),
  ].join(', ') + ' FROM ' + F + ' F WHERE ' + (hay(F, 'TIP_DOC') ? 'F.TIP_DOC = \'R\' AND ' : '') +
    'F.FECHA_DOC >= (CURRENT_DATE - ' + Number(dias) + ')';
  const filas = await consulta(db, sql);
  return filas.map((f) => ({
    cve_doc: texto(f.CVE_DOC),
    status: texto(f.STATUS),
    doc_ant: texto(f.DOC_ANT), tip_doc_ant: texto(f.TIP_DOC_ANT),
    cve_clpv: texto(f.CVE_CLPV), cve_vend: texto(f.CVE_VEND),
    su_refer: texto(f.SU_REFER), condicion: texto(f.CONDICION),
    fecha_doc: fecha(f.FECHA_DOC), fecha_ent: fecha(f.FECHA_ENT),
    can_tot: num(f.CAN_TOT), imp1: num(f.IMP_TOT1), imp2: num(f.IMP_TOT2), imp3: num(f.IMP_TOT3), imp4: num(f.IMP_TOT4),
    descuento: num(f.DES_TOT) + num(f.DES_FIN), importe: num(f.IMPORTE),
    num_alma: f.NUM_ALMA == null ? null : num(f.NUM_ALMA), moneda: f.NUM_MONED == null ? null : num(f.NUM_MONED),
    tipcamb: f.TIPCAMB == null ? null : num(f.TIPCAMB),
    cve_obs: f.CVE_OBS == null ? null : num(f.CVE_OBS),
    version: String(f.VERSION_SINC instanceof Date ? f.VERSION_SINC.toISOString() : (f.VERSION_SINC || '')),
  })).filter((r) => r.cve_doc);
}
function huella(r) { return [r.status, r.importe, r.version, r.doc_ant].join('|'); }

// ── Detalle (solo para las remisiones nuevas o cambiadas) ──
async function leerPartidas(db, cfg, claves) {
  const P = 'PAR_FACTR' + cfg.empresa, I = 'INVE' + cfg.empresa;
  const porDoc = {};
  for (const lote of lotes(claves, 40)) {
    const sql = 'SELECT ' + [
      T('P', P, 'CVE_DOC', 40, 'CVE_DOC'), N('P', P, 'NUM_PAR', 'NUM_PAR'), T('P', P, 'CVE_ART', 64, 'CVE_ART'),
      T('I', I, 'DESCR', 255, 'DESCR'), T('P', P, primera(P, ['UNI_VENTA', 'UNI_MED']), 20, 'UNIDAD'),
      N('P', P, 'CANT', 'CANT'), N('P', P, 'PREC', 'PREC'), N('P', P, 'DESC1', 'DESC1'),
      N('P', P, 'TOT_PARTIDA', 'TOT_PARTIDA'), N('P', P, 'IMPU4', 'IMPU4'), N('P', P, 'TOTIMP4', 'TOTIMP4'),
      N('P', P, 'CVE_OBS', 'CVE_OBS'),
    ].join(', ') + ' FROM ' + P + ' P LEFT JOIN ' + I + ' I ON I.CVE_ART = P.CVE_ART ' +
      'WHERE TRIM(P.CVE_DOC) IN (' + marcas(lote.length) + ')' + (hay(P, 'NUM_PAR') ? ' ORDER BY P.CVE_DOC, P.NUM_PAR' : '');
    const filas = await consulta(db, sql, lote);
    filas.forEach((f) => {
      const doc = texto(f.CVE_DOC);
      const cant = num(f.CANT), prec = num(f.PREC), desc = num(f.DESC1);
      const bruto = f.TOT_PARTIDA != null ? num(f.TOT_PARTIDA) : cant * prec;
      (porDoc[doc] = porDoc[doc] || []).push({
        par: num(f.NUM_PAR), clave: texto(f.CVE_ART), descripcion: texto(f.DESCR),
        unidad: texto(f.UNIDAD), cantidad: cant, precio: prec, descuento_pct: desc,
        importe: Math.round(bruto * (1 - desc / 100) * 100) / 100,
        iva_pct: num(f.IMPU4), iva: num(f.TOTIMP4),
        cve_obs: f.CVE_OBS == null ? null : num(f.CVE_OBS), obs: '',
      });
    });
  }
  return porDoc;
}

async function leerObservaciones(db, cfg, cves) {
  const O = 'OBS_DOCF' + cfg.empresa;
  const mapa = {};
  if (!hay(O, 'CVE_OBS') || !hay(O, 'STR_OBS')) return mapa;
  const lista = cves.filter((x) => x);
  for (const lote of lotes(lista, 100)) {
    const filas = await consultaOpcional(db,
      'SELECT CVE_OBS, CAST(SUBSTRING(STR_OBS FROM 1 FOR 1500) AS VARCHAR(1500) CHARACTER SET OCTETS) AS OBS ' +
      'FROM ' + O + ' WHERE CVE_OBS IN (' + marcas(lote.length) + ')', lote, 'observaciones');
    filas.forEach((f) => { mapa[num(f.CVE_OBS)] = texto(f.OBS); });
  }
  return mapa;
}

async function leerClientes(db, cfg, claves) {
  const C = 'CLIE' + cfg.empresa;
  const mapa = {};
  if (!hay(C, 'CLAVE')) return mapa;
  for (const lote of lotes(claves.filter(Boolean), 100)) {
    const filas = await consultaOpcional(db, 'SELECT ' + [
      T('C', C, 'CLAVE', 20, 'CLAVE'), T('C', C, 'NOMBRE', 255, 'NOMBRE'), T('C', C, 'RFC', 20, 'RFC'),
      T('C', C, 'CALLE', 120, 'CALLE'), T('C', C, 'NUMEXT', 20, 'NUMEXT'), T('C', C, 'NUMINT', 20, 'NUMINT'),
      T('C', C, 'COLONIA', 80, 'COLONIA'), T('C', C, 'MUNICIPIO', 80, 'MUNICIPIO'), T('C', C, 'ESTADO', 60, 'ESTADO'),
      T('C', C, 'CODIGO', 10, 'CP'), T('C', C, 'TELEFONO', 40, 'TEL'),
    ].join(', ') + ' FROM ' + C + ' C WHERE TRIM(C.CLAVE) IN (' + marcas(lote.length) + ')', lote, 'clientes');
    filas.forEach((f) => {
      const calle = [texto(f.CALLE), texto(f.NUMEXT), texto(f.NUMINT) ? ('Int. ' + texto(f.NUMINT)) : ''].filter(Boolean).join(' ');
      const dir = [calle, texto(f.COLONIA) ? ('Col. ' + texto(f.COLONIA)) : '', texto(f.MUNICIPIO), texto(f.ESTADO), texto(f.CP) ? ('C.P. ' + texto(f.CP)) : '']
        .filter(Boolean).join(', ');
      mapa[texto(f.CLAVE)] = { nombre: texto(f.NOMBRE), rfc: texto(f.RFC), direccion: dir, telefono: texto(f.TEL) };
    });
  }
  return mapa;
}

async function leerVendedores(db, cfg) {
  const V = 'VEND' + cfg.empresa;
  const mapa = {};
  if (!hay(V, 'CVE_VEND') || !hay(V, 'NOMBRE')) return mapa;
  const filas = await consultaOpcional(db,
    'SELECT ' + T('V', V, 'CVE_VEND', 10, 'CVE') + ', ' + T('V', V, 'NOMBRE', 120, 'NOMBRE') + ' FROM ' + V + ' V', [], 'vendedores');
  filas.forEach((f) => { mapa[texto(f.CVE)] = texto(f.NOMBRE); });
  return mapa;
}

async function subir(cfg, filas) {
  const url = cfg.supabase.url.replace(/\/+$/, '') + '/rest/v1/aspel_remisiones?on_conflict=empresa,cve_doc';
  for (const lote of lotes(filas, 200)) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { apikey: cfg.supabase.llaveSecreta, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(lote),
    });
    if (!r.ok) throw new Error('Supabase respondio ' + r.status + ': ' + (await r.text()).slice(0, 300));
  }
}

function leerEstado() {
  if (TODO) return {};
  try { return JSON.parse(fs.readFileSync(ARCH_ESTADO, 'utf8')) || {}; } catch (e) { return {}; }
}

async function ciclo(cfg) {
  const db = await conectar(cfg);
  try {
    const dias = TODO ? 400 : cfg.diasRemisiones;
    const e = cfg.empresa;
    await cargarColumnas(db, ['FACTR' + e, 'PAR_FACTR' + e, 'INVE' + e, 'CLIE' + e, 'VEND' + e, 'OBS_DOCF' + e]);
    const enc = await leerEncabezados(db, cfg, dias);
    const estado = leerEstado();
    const cambios = MODO_PRUEBA ? enc.slice(-5) : enc.filter((r) => estado[r.cve_doc] !== huella(r));
    if (!cambios.length) { log('Sin cambios (' + enc.length + ' remisiones en los últimos ' + dias + ' días).'); return; }

    const partidas = await leerPartidas(db, cfg, cambios.map((r) => r.cve_doc));
    const obsIds = [];
    cambios.forEach((r) => { if (r.cve_obs) obsIds.push(r.cve_obs); (partidas[r.cve_doc] || []).forEach((p) => { if (p.cve_obs) obsIds.push(p.cve_obs); }); });
    const obs = await leerObservaciones(db, cfg, Array.from(new Set(obsIds)));
    const clientes = await leerClientes(db, cfg, Array.from(new Set(cambios.map((r) => r.cve_clpv))));
    const vendedores = await leerVendedores(db, cfg);
    const ahora = new Date().toISOString();

    const filas = cambios.map((r) => {
      const cli = clientes[r.cve_clpv] || {};
      const pars = (partidas[r.cve_doc] || []).map((p) => {
        const o = Object.assign({}, p, { obs: p.cve_obs ? (obs[p.cve_obs] || '') : '' });
        delete o.cve_obs; return o;
      });
      return {
        empresa: cfg.empresa, cve_doc: r.cve_doc,
        pedido_folio: r.doc_ant || '',
        status: r.status, fecha_doc: r.fecha_doc, fecha_ent: r.fecha_ent,
        cliente_clave: r.cve_clpv, cliente_nombre: cli.nombre || '', cliente_rfc: cli.rfc || '',
        cliente_direccion: cli.direccion || '', cliente_telefono: cli.telefono || '',
        vendedor: vendedores[r.cve_vend] || r.cve_vend || '',
        su_referencia: r.su_refer, condicion: r.condicion,
        almacen: r.num_alma, moneda: r.moneda, tipo_cambio: r.tipcamb,
        subtotal: r.can_tot, descuento: r.descuento,
        ieps: r.imp1, impuesto2: r.imp2, impuesto3: r.imp3, iva: r.imp4, total: r.importe,
        observaciones: r.cve_obs ? (obs[r.cve_obs] || '') : '',
        partidas: pars, actualizado_en: ahora,
      };
    });

    if (MODO_PRUEBA) {
      log('Columnas de FACTR' + cfg.empresa + ': ' + Array.from(COLS['FACTR' + cfg.empresa] || []).sort().join(', '));
      log('PRUEBA: ' + enc.length + ' remisiones en ' + dias + ' días. Últimas ' + filas.length + ':');
      filas.forEach((f) => console.log('   ' + f.cve_doc + ' · pedido ' + (f.pedido_folio || '—') + ' · ' + f.cliente_nombre +
        ' · ' + f.partidas.length + ' partidas · total $' + f.total.toFixed(2) + ' · status ' + f.status));
      if (filas[0]) console.log('\nEjemplo completo:\n' + JSON.stringify(filas[0], null, 2).slice(0, 2500));
      return;
    }

    await subir(cfg, filas);
    const nuevo = {};
    enc.forEach((r) => { nuevo[r.cve_doc] = huella(r); });
    fs.writeFileSync(ARCH_ESTADO, JSON.stringify(nuevo), 'utf8');
    log('Listo: ' + filas.length + ' remisiones nuevas o cambiadas enviadas (de ' + enc.length + ').');
  } finally {
    try { db.detach(); } catch (e) { /* nada */ }
  }
}

async function main() {
  const cfg = leerConfig();
  log('Sincronizador de remisiones Aspel → Supabase (empresa ' + cfg.empresa + ')' + (MODO_PRUEBA ? ' — MODO PRUEBA' : ''));
  let ocupado = false;
  const correr = async () => {
    if (ocupado) return; ocupado = true;
    try { await ciclo(cfg); } catch (e) { log('ERROR: ' + (e && e.message ? e.message : e)); }
    ocupado = false;
  };
  await correr();
  if (UNA_VEZ) return;
  log('Siguiente revision cada ' + cfg.intervaloRemisionesMinutos + ' min.');
  setInterval(correr, cfg.intervaloRemisionesMinutos * 60 * 1000);
}
main();
