/* ════════════════════════════════════════════════════════════════════
   dc3.js — Portal Tecnocontrol · Gestoría · Constancias DC-3 (nov-2026)
   ────────────────────────────────────────────────────────────────────
   Genera el Formato DC-3 (STPS) en Word y PDF, uno o cientos a la vez.
   Datos: Supabase (tablas dc3_*, ver dc3_constancias.sql).
   Plantilla con firmas: Storage PRIVADO (dc3-privado/plantilla/...).

   Seguridad (lo que protege de verdad está en la base de datos; aquí
   solo se evita que la página sea la puerta de entrada):
     · Sin sesión del portal no se carga nada.
     · Nada que escriba el usuario o venga de Excel se mete como HTML:
       todo se pinta con textContent (sin innerHTML de datos).
     · Al llenar el Word, todo se escapa como XML.
     · Excel: solo .xlsx, máximo 8 MB, protección contra "bombas zip".
     · Búsquedas: se limpian antes de mandarlas a Supabase.
     · CSV exportado: sin fórmulas (=, +, -, @) para que Excel no las corra.
     · Si nadie mueve la página 20 minutos, se borra todo de la pantalla.
     · La página no se deja meter dentro de otra (clickjacking).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── No permitir que otra página nos meta en un marco (clickjacking) ──
  if (window.top !== window.self) {
    document.documentElement.textContent = '';
    throw new Error('DC-3 no se puede abrir dentro de otra página');
  }

  var LOGO = 'data:image/png;base64,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';
  var BUCKET = 'dc3-privado';
  var RUTA_PLANTILLA = 'plantilla/dc3-plantilla.docx';
  var MAX_XLSX = 8 * 1024 * 1024;
  var MAX_LOTE = 300;
  var MINUTOS_INACTIVO = 20;
  // Las firmas escaneadas que trae la plantilla solo sirven para estas personas.
  var FIRMANTES = {
    instructor: 'KENIA YADIRA GUZMAN NEAVE',
    patron: 'CRISTINA JUDITH ACOSTA CONTRERAS',
    rep: 'MARTIN ROBERTO DE LA O MAESE'
  };

  var OCUPACIONES = [
    '01.1 - AGRICULTURA Y SILVICULTURA', '01.2 - GANADERÍA', '01.3 - PESCA Y ACUACULTURA',
    '02.1 - EXPLORACIÓN', '02.2 - EXTRACCIÓN', '02.3 - REFINACIÓN Y BENEFICIO', '02.4 - PROVISIÓN DE ENERGÍA', '02.5 - PROVISIÓN DE AGUA',
    '03.1 - PLANEACIÓN Y DIRECCIÓN DE OBRAS', '03.2 - EDIFICACIÓN Y URBANIZACIÓN', '03.3 - ACABADO', '03.4 - INSTALACIÓN Y MANTENIMIENTO',
    '04.1 - MECÁNICA', '04.2 - ELECTRICIDAD', '04.3 - ELECTRÓNICA', '04.4 - INFORMÁTICA', '04.5 - TELECOMUNICACIONES', '04.6 - PROCESOS INDUSTRIALES',
    '05.1 - MINERALES NO METÁLICOS', '05.2 - METALES', '05.3 - ALIMENTOS Y BEBIDAS', '05.4 - TEXTILES Y PRENDAS DE VESTIR', '05.5 - MATERIA ORGÁNICA',
    '05.6 - PRODUCTOS QUÍMICOS', '05.7 - PRODUCTOS METÁLICOS Y DE HULE Y PLÁSTICO', '05.8 - PRODUCTOS ELÉCTRICOS Y ELECTRÓNICOS', '05.9 - PRODUCTOS IMPRESOS',
    '06.1 - FERROVIARIO', '06.2 - AUTOTRANSPORTE', '06.3 - AÉREO', '06.4 - MARÍTIMO Y FLUVIAL', '06.5 - SERVICIOS DE APOYO',
    '07.1 - COMERCIO', '07.2 - ALIMENTACIÓN Y HOSPEDAJE', '07.3 - TURISMO', '07.4 - DEPORTE Y ESPARCIMIENTO', '07.5 - SERVICIOS PERSONALES',
    '07.6 - REPARACIÓN DE ARTÍCULOS DE USO DOMÉSTICO Y PERSONAL', '07.7 - LIMPIEZA', '07.8 - SERVICIO POSTAL Y MENSAJERÍA',
    '08.1 - BOLSA, BANCA Y SEGUROS', '08.2 - ADMINISTRACIÓN', '08.3 - SERVICIOS LEGALES',
    '09.1 - SERVICIOS MÉDICOS', '09.2 - INSPECCIÓN SANITARIA Y DEL MEDIO AMBIENTE', '09.3 - SEGURIDAD SOCIAL', '09.4 - PROTECCIÓN DE BIENES Y/O PERSONAS',
    '10.1 - PUBLICACIÓN', '10.2 - RADIO, CINE, TELEVISIÓN Y TEATRO', '10.3 - INTERPRETACIÓN ARTÍSTICA', '10.4 - TRADUCCIÓN E INTERPRETACIÓN LINGÜÍSTICA',
    '10.5 - PUBLICIDAD, PROPAGANDA Y RELACIONES PÚBLICAS', '11.1 - INVESTIGACIÓN', '11.2 - ENSEÑANZA', '11.3 - DIFUSIÓN CULTURAL'
  ];
  var AREAS_TEMATICAS = [
    '1000 - PRODUCCIÓN GENERAL', '2000 - SERVICIOS', '3000 - ADMINISTRACIÓN, CONTABILIDAD Y ECONOMÍA', '4000 - COMERCIALIZACIÓN',
    '5000 - MANTENIMIENTO Y REPARACIÓN', '6000 - SEGURIDAD', '7000 - DESARROLLO PERSONAL Y FAMILIAR',
    '8000 - USO DE TECNOLOGÍAS DE LA INFORMACIÓN Y COMUNICACIÓN', '9000 - PARTICIPACIÓN SOCIAL'
  ];

  // ═════════════════════════════ NÚCLEO (sin pantalla) ═════════════════════════════
  var N = {};

  N.limpiar = function (s) {
    return String(s == null ? '' : s).normalize('NFC')
      .replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029\u200B-\u200F\uFEFF]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  };
  N.mayus = function (s) { return N.limpiar(s).toLocaleUpperCase('es-MX'); };
  N.recortar = function (s, max) { s = N.limpiar(s); return s.length > max ? s.slice(0, max) : s; };

  var RE_CURP = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d$/;
  var RE_RFC_EMP = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;
  var DIC_CURP = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

  N.normCurp = function (c) { return N.mayus(c).replace(/[^A-Z0-9Ñ]/g, ''); };
  N.digitoCurp = function (c17) {
    var suma = 0;
    for (var i = 0; i < 17; i++) {
      var v = DIC_CURP.indexOf(c17.charAt(i));
      if (v < 0) return null;
      suma += v * (18 - i);
    }
    return String((10 - (suma % 10)) % 10);
  };
  N.validarCurp = function (c) {
    c = N.normCurp(c);
    if (!c) return { ok: false, curp: c, motivo: 'Falta la CURP' };
    if (c.length !== 18) return { ok: false, curp: c, motivo: 'La CURP debe tener 18 letras y números (tiene ' + c.length + ')' };
    if (!RE_CURP.test(c)) return { ok: false, curp: c, motivo: 'La CURP no tiene la forma correcta' };
    var mm = +c.slice(6, 8), dd = +c.slice(8, 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { ok: false, curp: c, motivo: 'La fecha de nacimiento dentro de la CURP no existe' };
    if (N.digitoCurp(c.slice(0, 17)) !== c.charAt(17)) return { ok: true, curp: c, aviso: 'El último número de la CURP no cuadra: compárala con la CURP oficial (RENAPO)' };
    return { ok: true, curp: c };
  };
  // Nombre de persona: solo letras, espacios, punto, apóstrofo y guion
  N.nombreValido = function (s) { return /^[A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ .'\-]{2,149}$/.test(N.mayus(s)); };
  N.normRfc = function (r) { return N.mayus(r).replace(/[^A-Z0-9Ñ&]/g, ''); };
  N.validarRfcEmpresa = function (r) {
    r = N.normRfc(r);
    if (!r) return { ok: true, rfc: '' };
    return RE_RFC_EMP.test(r) ? { ok: true, rfc: r } : { ok: false, rfc: r, motivo: 'El RFC debe tener 12 (empresa) o 13 (persona) caracteres' };
  };

  // ── Nombre en el orden del DC-3 (apellido paterno, materno, nombres) usando la CURP ──
  var PARTICULAS = { DA: 1, DAS: 1, DE: 1, DEL: 1, DER: 1, DI: 1, DIE: 1, DD: 1, EL: 1, LA: 1, LOS: 1, LAS: 1, LE: 1, LES: 1, MAC: 1, MC: 1, VAN: 1, VON: 1, Y: 1 };
  var NOMBRES_COMUNES = { MARIA: 1, MA: 1, 'MA.': 1, JOSE: 1, 'J.': 1, J: 1 };
  function baseCurp(s) {
    return s.toUpperCase().replace(/Ñ/g, 'X').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z ]/g, '');
  }
  function sinParticulas(tokens) {
    var t = tokens.filter(function (x) { return !PARTICULAS[x]; });
    return t.length ? t : tokens;
  }
  // Palabras que RENAPO no permite: la 2a letra se cambia por X (ej. CACO → CXCO)
  var ALTISONANTES = ('BACA BAKA BUEI BUEY CACA CACO CAGA CAGO CAKA CAKO COGE COGI COJA COJE COJI COJO COLA CULO FALO FETO GETA GUEI GUEY JETA JOTO ' +
    'KACA KACO KAGA KAGO KAKA KAKO KOGE KOGI KOJA KOJE KOJI KOJO KOLA KULO LILO LOCA LOCO LOKA LOKO MAME MAMO MEAR MEAS MEON MIAR MION MOCO MOKO ' +
    'MULA MULO NACA NACO PEDA PEDO PENE PIPI PITO POPO PUTA PUTO QULO RATA ROBA ROBE ROBO RUIN SENO TETA VACA VAGA VAGO VAKA VUEI VUEY WUEI WUEY').split(' ');
  N.prefijoCurp = function (pat, mat, noms) {
    var p = sinParticulas(pat.map(baseCurp)).join('');
    var m = sinParticulas(mat.map(baseCurp)).join('');
    var n = noms.map(baseCurp);
    if (n.length > 1 && NOMBRES_COMUNES[n[0]]) n = n.slice(1);
    n = sinParticulas(n);
    if (!p || !n.length) return null;
    var vocal = (p.slice(1).match(/[AEIOU]/) || ['X'])[0];
    var r = p.charAt(0) + vocal + (m ? m.charAt(0) : 'X') + n[0].charAt(0);
    return ALTISONANTES.indexOf(r) >= 0 ? r.charAt(0) + 'X' + r.slice(2) : r;
  };
  // Cuántas palabras "de más" tienen los apellidos (sin contar DE, LA, DEL…): se prefiere la lectura más sencilla
  function costo(pat, mat) {
    return Math.max(0, pat.filter(function (x) { return !PARTICULAS[x]; }).length - 1) + Math.max(0, mat.filter(function (x) { return !PARTICULAS[x]; }).length - 1);
  }
  function mejor(cands) {
    if (!cands.length) return null;
    var min = Math.min.apply(null, cands.map(function (c) { return c.costo; }));
    var top = cands.filter(function (c) { return c.costo === min; }).map(function (c) { return c.nombre; });
    top = top.filter(function (x, i) { return top.indexOf(x) === i; });
    return { nombre: top[0], dudoso: top.length > 1, costo: min };
  }
  N.ordenarNombre = function (nombre, curp) {
    var limpio = N.mayus(nombre).replace(/[^A-ZÁÉÍÓÚÜÑ .'-]/g, ' ').replace(/\s+/g, ' ').trim();
    var t = limpio ? limpio.split(' ') : [];
    var obj = (curp || '').slice(0, 4);
    if (t.length < 2 || obj.length !== 4) return { nombre: limpio, estado: t.length < 2 ? 'incompleto' : 'sin_curp' };
    var dir = [], nat = [], n = t.length, a, b;
    // Un DE / LA / DEL nunca va al final de un bloque: siempre se pega a la palabra que sigue
    function mal(seg) { return seg.length > 0 && !!PARTICULAS[seg[seg.length - 1]]; }
    // Ya viene como DC-3: PATERNO MATERNO NOMBRES
    for (a = 1; a < n; a++) for (b = a; b < n; b++) {
      if (mal(t.slice(0, a)) || mal(t.slice(a, b))) continue;
      if (N.prefijoCurp(t.slice(0, a), t.slice(a, b), t.slice(b)) === obj) dir.push({ nombre: t.join(' '), costo: costo(t.slice(0, a), t.slice(a, b)) });
    }
    // Viene como NOMBRES PATERNO MATERNO → se acomoda
    for (a = 1; a < n; a++) for (b = a + 1; b <= n; b++) {
      if (mal(t.slice(0, a)) || mal(t.slice(a, b))) continue;
      if (N.prefijoCurp(t.slice(a, b), t.slice(b), t.slice(0, a)) === obj)
        nat.push({ nombre: t.slice(a, b).concat(t.slice(b), t.slice(0, a)).join(' '), costo: costo(t.slice(a, b), t.slice(b)) });
    }
    var d = mejor(dir), m = mejor(nat);
    if (d && (!m || d.costo <= m.costo)) return { nombre: d.nombre, estado: 'ok' };
    if (m) return { nombre: m.nombre, estado: 'reordenado', original: limpio, dudoso: m.dudoso };
    return { nombre: limpio, estado: 'no_coincide' };
  };

  // ── Texto seguro para XML (Word) ──
  N.xml = function (s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  };
  // ── CSV sin fórmulas ──
  N.csvCelda = function (v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  N.nombreArchivo = function (s) {
    return N.limpiar(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'archivo';
  };
  N.horasTxt = function (h) {
    var v = Number(h); if (!isFinite(v)) return '';
    return (Math.round(v * 100) / 100).toString() + (v === 1 ? ' HORA' : ' HORAS');
  };
  N.rfcCeldas = function (rfc) {
    rfc = N.normRfc(rfc);
    var c = [];
    if (rfc.length === 12) c = [' '].concat((rfc.slice(0, 3) + '-' + rfc.slice(3, 9) + '-' + rfc.slice(9)).split(''));
    else if (rfc.length === 13) c = (rfc.slice(0, 4) + '-' + rfc.slice(4, 10) + '-' + rfc.slice(10)).split('');
    else c = rfc.split('');
    while (c.length < 18) c.push('');
    return c.slice(0, 18);
  };
  N.fechaDigitos = function (iso) { return String(iso || '').replace(/[^0-9]/g, '').slice(0, 8).split(''); };

  // Datos planos de una constancia → marcadores de la plantilla
  N.marcadores = function (d) {
    var m = {
      NOMBRE: N.mayus(d.nombre), OCUPACION: N.mayus(d.ocupacion), PUESTO: N.mayus(d.puesto || ''),
      RAZON_SOCIAL: N.mayus(d.razon_social), CURSO: N.mayus(d.curso), HORAS: N.horasTxt(d.horas),
      AREA_TEMATICA: N.mayus(d.area_tematica), AGENTE: N.mayus(d.agente_capacitador),
      INSTRUCTOR: N.mayus(d.instructor), PATRON: N.mayus(d.patron), REP_TRAB: N.mayus(d.representante_trab || ''),
      FOLIO: d.folio ? '· FOLIO ' + d.folio : ''
    };
    var curp = N.normCurp(d.curp).split('');
    var rfc = N.rfcCeldas(d.rfc_empresa || '');
    var ini = N.fechaDigitos(d.fecha_inicio), fin = N.fechaDigitos(d.fecha_fin);
    for (var i = 1; i <= 18; i++) { m['C' + i] = curp[i - 1] || ''; m['R' + i] = rfc[i - 1] || ''; }
    for (i = 1; i <= 8; i++) { m['I' + i] = ini[i - 1] || ''; m['F' + i] = fin[i - 1] || ''; }
    return m;
  };

  // ── Word: llena la plantilla (los datos SIEMPRE se escapan) ──
  N.llenarDocx = async function (plantillaBytes, d) {
    var zip = await window.JSZip.loadAsync(plantillaBytes);
    var f = zip.file('word/document.xml');
    if (!f) throw new Error('La plantilla no es un Word válido');
    var xml = await f.async('string');
    var m = N.marcadores(d);
    xml = xml.replace(/\{\{([A-Z_0-9]+)\}\}/g, function (_, k) {
      return Object.prototype.hasOwnProperty.call(m, k) ? N.xml(m[k]) : '';
    });
    var firmas = d.firmas || {};
    var quitar = { FIRMA_INSTRUCTOR: !firmas.instructor, FIRMA_PATRON: !firmas.patron, FIRMA_REP: !firmas.rep };
    xml = xml.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, function (bloque) {
      var k = (bloque.match(/descr="(FIRMA_[A-Z]+)"/) || [])[1];
      return k && quitar[k] ? '' : bloque;
    });
    zip.file('word/document.xml', xml);
    var core = zip.file('docProps/core.xml');
    if (core) {
      var c = await core.async('string');
      c = c.replace(/<dc:title>[\s\S]*?<\/dc:title>|<dc:title\/>/, '');
      c = c.replace('</cp:coreProperties>', '<dc:title>' + N.xml('DC-3 ' + (d.folio || '') + ' ' + N.mayus(d.nombre)) + '</dc:title></cp:coreProperties>');
      zip.file('docProps/core.xml', c);
    }
    return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  };

  // ── Lee las imágenes (logo y firmas) que trae la plantilla, para el PDF ──
  N.recursosPlantilla = async function (plantillaBytes) {
    var zip = await window.JSZip.loadAsync(plantillaBytes);
    var rels = await zip.file('word/_rels/document.xml.rels').async('string');
    var doc = await zip.file('word/document.xml').async('string');
    var r = {};
    var blocks = doc.match(/<w:drawing>[\s\S]*?<\/w:drawing>/g) || [];
    for (var i = 0; i < blocks.length; i++) {
      var k = (blocks[i].match(/descr="(FIRMA_[A-Z]+)"/) || [])[1];
      var rid = (blocks[i].match(/r:embed="([^"]+)"/) || [])[1];
      if (!k || !rid) continue;
      var tgt = (rels.match(new RegExp('Id="' + rid + '"[^>]*Target="([^"]+)"')) || rels.match(new RegExp('Target="([^"]+)"[^>]*Id="' + rid + '"')) || [])[1];
      if (!tgt || !/^media\/[A-Za-z0-9_.-]+\.(png|jpe?g)$/i.test(tgt)) continue;
      var img = zip.file('word/' + tgt);
      if (!img) continue;
      var b64 = await img.async('base64');
      r[k] = 'data:image/' + (/png$/i.test(tgt) ? 'png' : 'jpeg') + ';base64,' + b64;
    }
    return r;
  };

  // ── PDF: dibuja el formato DC-3 (anverso) ──
  N.pdfPagina = function (pdf, d, rec) {
    var m = N.marcadores(d);
    var X = 14, W = 187.9, y;
    pdf.setDrawColor(0); pdf.setLineWidth(0.25); pdf.setTextColor(0);
    try { pdf.addImage(LOGO, 'PNG', 16, 11, 42, 12.45); } catch (e) {}
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
    pdf.text('FORMATO DC-3', 107.95, 31, { align: 'center' });
    pdf.text('CONSTANCIA DE COMPETENCIAS O DE HABILIDADES LABORALES', 107.95, 36, { align: 'center' });
    function cab(t, yy) {
      pdf.setFillColor(0, 0, 0); pdf.rect(X, yy, W, 5.6, 'F');
      pdf.setTextColor(255); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5);
      pdf.text(t, X + W / 2, yy + 3.9, { align: 'center' }); pdf.setTextColor(0);
      return yy + 5.6;
    }
    function etiqueta(t, x, yy) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.6); pdf.text(t, x + 1.4, yy + 3); }
    function valor(t, x, yy, max) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
      var s = String(t || ''); var ancho = max || 180;
      while (s && pdf.getTextWidth(s) > ancho && pdf.getFontSize() > 5.5) pdf.setFontSize(pdf.getFontSize() - 0.3);
      pdf.text(s, x + 3.5, yy + 7.6);
    }
    function cajas(chars, x, yy, ancho, alto) {
      var w = ancho / chars.length;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.6);
      for (var i = 0; i < chars.length; i++) {
        if (i > 0) pdf.line(x + i * w, yy, x + i * w, yy + alto);
        if (chars[i] && chars[i] !== ' ') pdf.text(chars[i], x + i * w + w / 2, yy + alto - 1.3, { align: 'center' });
      }
    }
    // 1. Trabajador
    y = cab('DATOS DEL TRABAJADOR', 39);
    var y0 = 39;
    etiqueta('Nombre (Anotar apellido paterno, apellido materno y nombre (s)', X, y); valor(m.NOMBRE, X, y); y += 9.5; pdf.line(X, y, X + W, y);
    var div = X + 98;
    etiqueta('Clave Única de Registro de Población', X, y);
    etiqueta('Ocupación específica (Catálogo Nacional de Ocupaciones) 1/', div, y);
    valor(m.OCUPACION, div, y + 1.5, W - (div - X) - 6);
    var cur = []; for (var i = 1; i <= 18; i++) cur.push(m['C' + i]);
    cajas(cur, X, y + 4.4, div - X, 5.6);
    pdf.line(div, y, div, y + 10); y += 10; pdf.line(X, y, X + W, y);
    etiqueta('Puesto*', X, y); valor(m.PUESTO, X, y); y += 9.5;
    pdf.rect(X, y0, W, y - y0);
    // 2. Empresa
    y += 2.5; y0 = y; y = cab('DATOS DE LA EMPRESA', y);
    etiqueta('Nombre o razón social (En caso de persona física, anotar apellido paterno, apellido materno y nombre(s))', X, y); valor(m.RAZON_SOCIAL, X, y); y += 9.5; pdf.line(X, y, X + W, y);
    etiqueta('Registro Federal de Contribuyentes con homoclave (SHCP)', X, y);
    var rf = []; for (i = 1; i <= 18; i++) rf.push(m['R' + i]);
    cajas(rf, X, y + 4.4, div - X, 5.6); pdf.line(div, y, div, y + 10);
    y += 10; pdf.rect(X, y0, W, y - y0);
    // 3. Programa
    y += 2.5; y0 = y; y = cab('DATOS DEL PROGRAMA DE CAPACITACIÓN, ADIESTRAMIENTO Y PRODUCTIVIDAD', y);
    etiqueta('Nombre del curso', X, y); valor(m.CURSO, X, y); y += 9.5; pdf.line(X, y, X + W, y);
    etiqueta('Duración en horas', X, y); valor(m.HORAS, X, y, 40);
    var px = X + 52; pdf.line(px, y, px, y + 11);
    pdf.setFontSize(6.6); pdf.text('Periodo de', px + 1.5, y + 4); pdf.text('ejecución:', px + 1.5, y + 7);
    var fx = px + 17, fw = X + W - fx, cw = fw / 18;
    pdf.line(fx, y, fx, y + 11);
    pdf.setFontSize(6.4);
    [['Año', 1, 4], ['Mes', 5, 2], ['Día', 7, 2], ['Año', 10, 4], ['Mes', 14, 2], ['Día', 16, 2]].forEach(function (g) {
      pdf.text(g[0], fx + (g[1] + g[2] / 2) * cw, y + 3.7, { align: 'center' });
    });
    pdf.line(fx, y + 5, X + W, y + 5);
    var fila = ['De'], k2;
    for (k2 = 1; k2 <= 8; k2++) fila.push(m['I' + k2]);
    fila.push('a'); for (k2 = 1; k2 <= 8; k2++) fila.push(m['F' + k2]);
    pdf.setFontSize(7.4);
    for (k2 = 0; k2 < 18; k2++) {
      if (k2 > 0) pdf.line(fx + k2 * cw, y + 5, fx + k2 * cw, y + 11);
      if ([1, 5, 7, 10, 14, 16].indexOf(k2) >= 0) pdf.line(fx + k2 * cw, y, fx + k2 * cw, y + 5);
      if (fila[k2]) pdf.text(fila[k2], fx + k2 * cw + cw / 2, y + 9.6, { align: 'center' });
    }
    y += 11; pdf.line(X, y, X + W, y);
    etiqueta('Área temática del curso 2/', X, y); valor(m.AREA_TEMATICA, X, y); y += 9.5; pdf.line(X, y, X + W, y);
    etiqueta('Nombre del agente capacitador o STPS 3/', X, y); valor(m.AGENTE, X, y); y += 9.5;
    pdf.rect(X, y0, W, y - y0);
    // 4. Firmas
    y += 2.5; y0 = y;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.4);
    pdf.text('Los datos se asientan en esta constancia bajo protesta de decir verdad, apercibidos de la responsabilidad en que incurre todo', X + W / 2, y + 5, { align: 'center' });
    pdf.text('aquel que no se conduce con verdad.', X + W / 2, y + 9, { align: 'center' });
    var col = W / 3, titulos = ['Instructor o tutor', 'Patrón o representante legal 4/', 'Representante de los trabajadores 5/'];
    var nombres = [m.INSTRUCTOR, m.PATRON, m.REP_TRAB], llaves = ['FIRMA_INSTRUCTOR', 'FIRMA_PATRON', 'FIRMA_REP'], usa = [(d.firmas || {}).instructor, (d.firmas || {}).patron, (d.firmas || {}).rep];
    for (var c = 0; c < 3; c++) {
      var cx = X + col * c + col / 2;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.2);
      pdf.text(titulos[c], cx, y + 17, { align: 'center' });
      if (usa[c] && rec && rec[llaves[c]]) {
        try {
          var ip = pdf.getImageProperties(rec[llaves[c]]);
          var ih = 15, iw = Math.min(36, ih * ip.width / ip.height);
          pdf.addImage(rec[llaves[c]], cx - iw / 2, y + 19, iw, iw * ip.height / ip.width);
        } catch (e) {}
      }
      pdf.setFontSize(7.6);
      var nm = nombres[c] || ''; while (nm && pdf.getTextWidth(nm) > col - 12 && pdf.getFontSize() > 5) pdf.setFontSize(pdf.getFontSize() - 0.3);
      pdf.text(nm, cx, y + 30.5, { align: 'center' });
      pdf.line(cx - col / 2 + 6, y + 31.6, cx + col / 2 - 6, y + 31.6);
      pdf.setFontSize(7.2); pdf.text('Nombre y firma', cx, y + 35, { align: 'center' });
    }
    y += 39; pdf.rect(X, y0, W, y - y0);
    // 5. Instrucciones
    y += 4.5;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.text('INSTRUCCIONES', X, y);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.2);
    var lin = ['-  Llenar a máquina o con letra de molde.',
      '-  Deberá entregarse al trabajador dentro de los veinte días hábiles siguientes al término del curso de capacitación aprobado.',
      '1/  Las áreas y subáreas ocupacionales del Catálogo Nacional de Ocupaciones se encuentran disponibles en el reverso de este formato y en la página www.stps.gob.mx',
      '2/  Las áreas temáticas de los cursos se encuentran disponibles en el reverso de este formato y en la página www.stps.gob.mx',
      '3/  Cursos impartidos por el área competente de la Secretaría del Trabajo y Previsión Social.',
      '4/  Para empresas con menos de 51 trabajadores. Para empresas con más de 50 trabajadores firmaría el representante del patrón ante la Comisión mixta de capacitación, adiestramiento y productividad.',
      '5/  Solo para empresas con más de 50 trabajadores.', '* Dato no obligatorio.'];
    lin.forEach(function (l) {
      var partes = pdf.splitTextToSize(l, W - 4);
      partes.forEach(function (p) { y += 3; pdf.text(p, X + 2, y); });
    });
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7);
    pdf.text('DC-3 ANVERSO' + (d.folio ? '   ·   FOLIO ' + d.folio : ''), X + W, 271, { align: 'right' });
  };
  N.pdf = function (lista, rec) {
    var pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'letter', compress: true });
    lista.forEach(function (d, i) { if (i) pdf.addPage('letter', 'portrait'); N.pdfPagina(pdf, d, rec); });
    pdf.setProperties({ title: 'Constancias DC-3', creator: 'Portal Tecnocontrol', author: 'HEDMA TECNOCONTROL' });
    return pdf;
  };

  // ── Excel (.xlsx) leído a mano con JSZip: sin librerías extra, sin macros ──
  N.revisarArchivo = function (nombre, bytes) {
    if (!/\.xlsx$/i.test(nombre || '')) return 'Solo se aceptan archivos de Excel .xlsx';
    if (bytes.byteLength > MAX_XLSX) return 'El archivo pesa más de 8 MB';
    var u = new Uint8Array(bytes.slice(0, 4));
    if (!(u[0] === 0x50 && u[1] === 0x4B && u[2] === 0x03 && u[3] === 0x04)) return 'El archivo no es un Excel real (.xlsx)';
    return null;
  };
  N.leerXlsx = async function (bytes) {
    var zip = await window.JSZip.loadAsync(bytes);
    var nombres = Object.keys(zip.files);
    if (nombres.length > 3000) throw new Error('El Excel trae demasiadas partes internas');
    var total = 0;
    nombres.forEach(function (n) { var f = zip.files[n]; total += (f._data && f._data.uncompressedSize) || 0; });
    if (total > 80 * 1024 * 1024) throw new Error('El Excel se infla demasiado al abrirlo (posible archivo dañado o malicioso)');
    var P = new DOMParser();
    function leer(ruta) { var f = zip.file(ruta); return f ? f.async('string') : Promise.resolve(null); }
    function parse(txt) {
      if (/<!DOCTYPE|<!ENTITY/i.test(txt)) throw new Error('El Excel trae contenido no permitido');
      var d = P.parseFromString(txt, 'application/xml');
      if (d.getElementsByTagName('parsererror').length) throw new Error('El Excel está dañado');
      return d;
    }
    var wbTxt = await leer('xl/workbook.xml');
    if (!wbTxt) throw new Error('El archivo no es un libro de Excel');
    var wb = parse(wbTxt);
    var relsTxt = await leer('xl/_rels/workbook.xml.rels');
    var rels = relsTxt ? parse(relsTxt) : null;
    var ss = [];
    var ssTxt = await leer('xl/sharedStrings.xml');
    if (ssTxt) {
      var si = parse(ssTxt).getElementsByTagName('si');
      for (var i = 0; i < si.length; i++) {
        var ts = si[i].getElementsByTagName('t'), s = '';
        for (var j = 0; j < ts.length; j++) {
          var anc = ts[j].parentNode; if (anc && anc.localName === 'rPh') continue;
          s += ts[j].textContent;
        }
        ss.push(s);
      }
    }
    var hojas = [], sheets = wb.getElementsByTagName('sheet');
    for (i = 0; i < sheets.length && i < 30; i++) {
      var rid = sheets[i].getAttribute('r:id') || sheets[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      var destino = null;
      if (rels) {
        var rs = rels.getElementsByTagName('Relationship');
        for (j = 0; j < rs.length; j++) if (rs[j].getAttribute('Id') === rid) destino = rs[j].getAttribute('Target');
      }
      if (!destino) destino = 'worksheets/sheet' + (i + 1) + '.xml';
      destino = destino.replace(/^\/?xl\//, '').replace(/^\//, '');
      if (destino.indexOf('..') >= 0) continue;
      var shTxt = await leer('xl/' + destino);
      if (!shTxt) continue;
      var sh = parse(shTxt), filas = [], rows = sh.getElementsByTagName('row');
      for (j = 0; j < rows.length && j < 20000; j++) {
        var fila = [], cs = rows[j].getElementsByTagName('c');
        for (var k = 0; k < cs.length; k++) {
          var ref = cs[k].getAttribute('r') || '', col = 0, letras = (ref.match(/^[A-Z]+/) || [''])[0];
          for (var q = 0; q < letras.length; q++) col = col * 26 + (letras.charCodeAt(q) - 64);
          col = letras ? col - 1 : k;
          if (col > 200) continue;
          var t = cs[k].getAttribute('t'), v = cs[k].getElementsByTagName('v')[0], val = '';
          if (t === 's') val = ss[+(v && v.textContent)] || '';
          else if (t === 'inlineStr') { var is = cs[k].getElementsByTagName('t'); for (q = 0; q < is.length; q++) val += is[q].textContent; }
          else val = v ? v.textContent : '';
          fila[col] = N.limpiar(val);
        }
        filas.push(fila);
      }
      hojas.push({ nombre: N.limpiar(sheets[i].getAttribute('name')), filas: filas });
    }
    return hojas;
  };
  var COLS = [
    ['curp', /^c\.?\s*u\.?\s*r\.?\s*p\.?$|^curp\b/i],
    ['nombre', /nombre/i],
    ['puesto', /puesto|descripci[oó]n de posici/i],
    ['rfc', /^r\.?\s*f\.?\s*c\.?$/i],
    ['region', /^regi[oó]n$/i],
    ['division', /divisi[oó]n/i],
    ['numero_personal', /n[uú]mero de personal|no\.?\s*de empleado|n[uú]m\.? empleado/i],
    ['ocupacion', /ocupaci[oó]n/i]
  ];
  N.interpretar = function (hojas) {
    for (var h = 0; h < hojas.length; h++) {
      var filas = hojas[h].filas;
      for (var r = 0; r < Math.min(filas.length, 40); r++) {
        var f = filas[r] || [], mapa = {};
        for (var c = 0; c < f.length; c++) {
          var txt = N.limpiar(f[c]);
          if (!txt) continue;
          for (var k = 0; k < COLS.length; k++) {
            if (mapa[COLS[k][0]] === undefined && COLS[k][1].test(txt)) { mapa[COLS[k][0]] = c; break; }
          }
        }
        if (mapa.curp !== undefined && mapa.nombre !== undefined) {
          var regs = [];
          for (var i = r + 1; i < filas.length; i++) {
            var fi = filas[i] || [];
            var o = {};
            COLS.forEach(function (cc) { if (mapa[cc[0]] !== undefined) o[cc[0]] = N.limpiar(fi[mapa[cc[0]]]); });
            if (!o.curp && !o.nombre) continue;
            o.fila = i + 1;
            regs.push(o);
          }
          return { hoja: hojas[h].nombre, encabezado: r + 1, mapa: mapa, registros: regs };
        }
      }
    }
    return null;
  };
  // Revisa y acomoda cada renglón importado
  N.prepararImportacion = function (regs, existentes) {
    var porCurp = {}, salida = [];
    (existentes || []).forEach(function (t) { porCurp[t.curp] = t; });
    var vistos = {};
    regs.forEach(function (o) {
      var r = { fila: o.fila, original: o };
      var v = N.validarCurp(o.curp);
      r.curp = v.curp;
      if (!v.ok) { r.estado = 'error'; r.motivo = v.motivo; salida.push(r); return; }
      var nm = N.ordenarNombre(o.nombre, v.curp);
      r.nombre = N.recortar(nm.nombre, 150);
      if (r.nombre.length < 3) { r.estado = 'error'; r.motivo = 'Falta el nombre'; salida.push(r); return; }
      r.puesto = N.recortar(N.mayus(o.puesto), 120) || null;
      r.rfc = N.normRfc(o.rfc).slice(0, 13) || null;
      r.region = N.recortar(N.mayus(o.region), 60) || null;
      r.division = N.recortar(N.mayus(o.division), 120) || null;
      r.numero_personal = N.recortar(o.numero_personal, 40) || null;
      r.ocupacion = o.ocupacion ? N.recortar(N.mayus(o.ocupacion), 120) : null;
      r.avisos = v.aviso ? [v.aviso] : [];
      if (nm.estado === 'reordenado') { r.reordenado = true; if (nm.dudoso) r.avisos.push('Se acomodó a apellidos primero, pero hay más de una forma posible: revísalo'); }
      if (nm.estado === 'no_coincide') r.avisos.push('El nombre no coincide con la CURP: revisa que esté bien escrito');
      if (vistos[v.curp]) { vistos[v.curp].estado = 'repetido'; vistos[v.curp].motivo = 'Se repite más abajo (se usa el último)'; }
      vistos[v.curp] = r;
      var ex = porCurp[v.curp];
      r.estado = !ex ? 'nuevo' : (ex.nombre === r.nombre && (ex.puesto || null) === r.puesto ? 'igual' : 'actualiza');
      salida.push(r);
    });
    return salida;
  };
  N.filtroSeguro = function (q) { return N.mayus(q).replace(/[^A-Z0-9ÁÉÍÓÚÜÑ \-]/g, '').slice(0, 60).trim(); };

  window.DC3Nucleo = N;

  // ═════════════════════════════ PANTALLA ═════════════════════════════
  var S = {
    sb: null, correo: '', rol: null,
    empresas: [], cursos: [], trabajadores: [],
    tab: 'generar',
    sel: {},                // id → true (personas elegidas)
    form: { curso_id: '', empresa_id: '', ini: '', fin: '', ocupacion: '07.1 - COMERCIO', filtroEmp: '', buscar: '', firmas: { instructor: true, patron: true, rep: true } },
    edCurso: {}, edEmp: {},
    previaIdx: 0, formato: 'ambos',
    plantilla: null, recursos: null,
    hist: [], histBuscar: ''
  };
  var app = document.getElementById('app');

  // ── Construir HTML seguro: los textos SIEMPRE van como texto ──
  function h(tag, at) {
    var el = document.createElement(tag);
    if (at) for (var k in at) {
      if (!Object.prototype.hasOwnProperty.call(at, k)) continue;
      var v = at[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (var i = 2; i < arguments.length; i++) poner(el, arguments[i]);
    return el;
  }
  function poner(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { poner(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var ICONOS = {
    buscar: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'M21 21l-4.35-4.35' }]],
    doc: [['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }], ['path', { d: 'M14 2v6h6M8 13h8M8 17h5' }]],
    personas: [['path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }]],
    curso: [['path', { d: 'M22 10L12 5 2 10l10 5 10-5z' }], ['path', { d: 'M6 12.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-4.5' }]],
    empresa: [['path', { d: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18' }], ['path', { d: 'M6 12H4a2 2 0 0 0-2 2v8h20v-8a2 2 0 0 0-2-2h-2M10 6h4M10 10h4M10 14h4M10 18h4' }]],
    historial: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 6v6l4 2' }]],
    ajustes: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }]],
    subir: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12' }]],
    bajar: [['path', { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3' }]],
    mas: [['path', { d: 'M12 5v14M5 12h14' }]],
    candado: [['rect', { x: 3, y: 11, width: 18, height: 11, rx: 2 }], ['path', { d: 'M7 11V7a5 5 0 0 1 10 0v4' }]],
    volver: [['path', { d: 'M19 12H5M12 19l-7-7 7-7' }]],
    izq: [['path', { d: 'M15 18l-6-6 6-6' }]], der: [['path', { d: 'M9 18l6-6-6-6' }]]
  };
  function ico(n, tam) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('width', tam || 18); s.setAttribute('height', tam || 18); s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    (ICONOS[n] || []).forEach(function (p) { var e = document.createElementNS(SVG_NS, p[0]); for (var k in p[1]) e.setAttribute(k, p[1][k]); s.appendChild(e); });
    return s;
  }
  function vaciar(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function aviso(titulo, texto, tipo) {
    var cont = document.getElementById('avisos');
    var a = h('div', { class: 'aviso ' + (tipo || '') , role: tipo === 'er' ? 'alert' : 'status' }, h('b', { text: titulo }), texto ? h('span', { text: texto }) : null);
    cont.appendChild(a);
    while (cont.children.length > 3) cont.removeChild(cont.firstChild);
    setTimeout(function () { a.remove(); }, tipo === 'er' ? 9000 : 5000);
  }
  function errTxt(e) {
    var m = (e && (e.message || e.error_description || e.details)) || String(e || 'Error');
    if (/JWT|token|401|permission denied|42501|row-level security/i.test(m)) return 'No tienes permiso para esto, o tu sesión venció. Vuelve a entrar al portal.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    if (/duplicate key/i.test(m)) return 'Ese registro ya existe.';
    return m.slice(0, 240);
  }
  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: nombre, rel: 'noopener' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function alfa(lista, campo) {
    return lista.slice().sort(function (a, b) { return String(a[campo] || '').localeCompare(String(b[campo] || ''), 'es', { sensitivity: 'base' }); });
  }
  function coincide(texto, q) {
    if (!q) return true;
    var t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    return q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().split(' ').every(function (p) { return t.indexOf(p) >= 0; });
  }
  function puedeEditar() { return S.rol === 'admin' || S.rol === 'editor'; }
  function hoyISO() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }

  function estado(titulo, texto, extra, cargando) {
    vaciar(app);
    app.appendChild(h('div', { class: 'estado' }, h('div', { class: 'caja' },
      cargando ? h('div', { class: 'girando', 'aria-label': 'Cargando' }) : ico('candado', 36),
      h('h2', { text: titulo }), texto ? h('p', { text: texto }) : null, extra || null)));
  }

  // ── Supabase ──
  async function todo(tabla, orden) {
    var filas = [], paso = 1000;
    for (var desde = 0; desde < 50000; desde += paso) {
      var r = await S.sb.from(tabla).select('*').order(orden).range(desde, desde + paso - 1);
      if (r.error) throw r.error;
      filas = filas.concat(r.data || []);
      if (!r.data || r.data.length < paso) break;
    }
    return filas;
  }
  async function cargarCatalogos() {
    var res = await Promise.all([todo('dc3_empresas', 'razon_social'), todo('dc3_cursos', 'nombre'), todo('dc3_trabajadores', 'nombre')]);
    S.empresas = alfa(res[0], 'razon_social'); S.cursos = alfa(res[1], 'nombre'); S.trabajadores = alfa(res[2], 'nombre');
    if (!S.form.empresa_id) { var hed = S.empresas.find(function (e) { return /HEDMA/i.test(e.razon_social) && e.activo; }); if (hed) S.form.empresa_id = hed.id; }
  }
  async function plantilla() {
    if (S.plantilla) return S.plantilla;
    var r = await S.sb.storage.from(BUCKET).download(RUTA_PLANTILLA);
    if (r.error || !r.data) throw new Error('No se pudo bajar la plantilla del DC-3. Un administrador debe subirla en Ajustes.');
    var bytes = new Uint8Array(await r.data.arrayBuffer());
    S.plantilla = bytes;
    S.recursos = await N.recursosPlantilla(bytes);
    return bytes;
  }

  // ── Inicio ──
  async function iniciar() {
    estado('Abriendo constancias DC-3…', null, null, true);
    if (!window.tcSesion || !window.supabase || !window.JSZip || !window.jspdf) {
      estado('No cargó la página completa', 'Recarga con Ctrl + Shift + R. Si sigue igual, revisa tu internet.');
      return;
    }
    try {
      S.sb = await window.tcSesion.cliente();
      var ses = (await S.sb.auth.getSession()).data.session;
      if (!ses || !ses.user || ses.user.is_anonymous) {
        estado('Primero entra al portal', 'Para usar las constancias DC-3 necesitas haber iniciado sesión en el Portal Tecnocontrol.',
          h('a', { class: 'btn azul', href: 'index.html' }, ico('volver'), 'Ir al portal'));
        return;
      }
      S.correo = String(ses.user.email || '').toLowerCase();
      var r = await S.sb.rpc('dc3_mi_rol');
      if (r.error) throw r.error;
      S.rol = r.data || null;
      if (!S.rol) {
        estado('No tienes acceso a DC-3', 'Tu cuenta (' + S.correo + ') no tiene permiso. Pídele a la gerencia de Gestoría que te dé acceso.',
          h('a', { class: 'btn', href: 'index.html' }, ico('volver'), 'Volver al portal'));
        return;
      }
      await cargarCatalogos();
      var f = S.form; if (!f.ini) { f.ini = hoyISO(); f.fin = hoyISO(); }
      if (!f.curso_id && S.cursos.length) { var c1 = S.cursos.find(function (c) { return c.activo; }); if (c1) f.curso_id = c1.id; }
      tomarCurso(); tomarEmpresa();
      pintar();
      vigilarInactividad();
    } catch (e) {
      estado('No se pudo abrir', errTxt(e), h('button', { class: 'btn azul', onclick: function () { location.reload(); } }, 'Reintentar'));
    }
  }

  function vigilarInactividad() {
    var t;
    function reiniciar() {
      clearTimeout(t);
      t = setTimeout(function () {
        S.trabajadores = []; S.hist = []; S.plantilla = null; S.recursos = null; S.sel = {};
        document.querySelectorAll('dialog').forEach(function (d) { try { d.close(); } catch (e) {} d.remove(); });
        estado('Pantalla bloqueada', 'Por seguridad se ocultaron los datos tras ' + MINUTOS_INACTIVO + ' minutos sin uso.',
          h('button', { class: 'btn azul', onclick: function () { location.reload(); } }, 'Volver a abrir'));
      }, MINUTOS_INACTIVO * 60000);
    }
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, reiniciar, { passive: true }); });
    reiniciar();
  }

  // ── Marco general ──
  var PESTANAS = [['generar', 'Generar constancias', 'doc'], ['personal', 'Personal', 'personas'], ['cursos', 'Cursos', 'curso'], ['empresas', 'Empresas', 'empresa'], ['historial', 'Historial', 'historial'], ['ajustes', 'Ajustes', 'ajustes']];
  var NOMBRE_ROL = { admin: 'Administrador', editor: 'Puede generar', lector: 'Solo consulta' };
  function pintar() {
    vaciar(app);
    var tabs = PESTANAS.filter(function (p) { return p[0] !== 'ajustes' || S.rol === 'admin'; })
      .filter(function (p) { return p[0] !== 'generar' || puedeEditar(); });
    if (!tabs.some(function (p) { return p[0] === S.tab; })) S.tab = tabs[0][0];
    app.appendChild(h('header', { class: 'barra' },
      h('div', { class: 'barra-in' },
        h('img', { src: LOGO, alt: 'Tecnocontrol' }), h('div', { class: 'sep' }),
        h('div', null, h('div', { class: 'depto', text: 'Gestoría' }), h('h1', { text: 'Constancias DC-3' })),
        h('div', { class: 'der' },
          h('span', { class: 'quien', text: S.correo, title: S.correo }),
          h('span', { class: 'rol', text: NOMBRE_ROL[S.rol] || S.rol }),
          h('a', { class: 'btn chico suave', href: 'index.html' }, ico('volver', 16), 'Portal'))),
      h('nav', { class: 'pestanas', role: 'tablist', 'aria-label': 'Secciones' }, tabs.map(function (p) {
        return h('button', { role: 'tab', 'aria-selected': S.tab === p[0] ? 'true' : 'false', onclick: function () { S.tab = p[0]; pintar(); } }, ico(p[2], 17), p[1]);
      }))));
    var main = h('main', { id: 'contenido' });
    app.appendChild(main);
    ({ generar: vGenerar, personal: vPersonal, cursos: vCursos, empresas: vEmpresas, historial: vHistorial, ajustes: vAjustes })[S.tab](main);
  }

  // ── Diálogos ──
  function dialogo(titulo, cuerpo, botones, ancho) {
    var d = h('dialog', { class: ancho ? 'ancho' : '', 'aria-label': titulo },
      h('div', { class: 'd-cab', text: titulo }), h('div', { class: 'd-cuerpo' }, cuerpo), h('div', { class: 'd-pie' }, botones || []));
    d.addEventListener('close', function () { setTimeout(function () { d.remove(); }, 0); });
    document.body.appendChild(d); d.showModal();
    return d;
  }
  function confirmar(titulo, texto, si, peligro) {
    return new Promise(function (ok) {
      var listo = false;
      var d = dialogo(titulo, h('p', { text: texto, style: 'margin:0 0 6px;white-space:pre-line' }), [
        h('button', { class: 'btn suave', onclick: function () { d.close(); } }, 'Cancelar'),
        h('button', { class: 'btn ' + (peligro ? 'peligro' : 'primario'), onclick: function () { listo = true; d.close(); } }, si || 'Aceptar')]);
      d.addEventListener('close', function () { ok(listo); });
    });
  }
  function progreso(titulo) {
    var barra = h('i'), txt = h('p', { style: 'margin:0', text: 'Preparando…' });
    var d = dialogo(titulo, [txt, h('div', { class: 'progreso' }, barra)], []);
    d.addEventListener('cancel', function (e) { e.preventDefault(); });
    return { poner: function (t, pct) { txt.textContent = t; barra.style.width = Math.max(0, Math.min(100, pct)) + '%'; }, cerrar: function () { d.close(); } };
  }
  function campo(et, input, ayuda) { return h('label', { class: 'campo' }, h('span', null, et, ayuda ? h('small', { text: ' · ' + ayuda }) : null), input); }
  function opciones(lista, actual, vacio) {
    var o = vacio ? [h('option', { value: '', text: vacio })] : [];
    lista.forEach(function (x) { var v = typeof x === 'string' ? x : x[0], t = typeof x === 'string' ? x : x[1]; o.push(h('option', { value: v, text: t, selected: v === actual })); });
    if (actual && !lista.some(function (x) { return (typeof x === 'string' ? x : x[0]) === actual; })) o.push(h('option', { value: actual, text: actual, selected: true }));
    return o;
  }

  // ═════════════ GENERAR ═════════════
  function cursoSel() { return S.cursos.find(function (c) { return c.id === S.form.curso_id; }); }
  function empresaSel() { return S.empresas.find(function (e) { return e.id === S.form.empresa_id; }); }
  function tomarCurso() {
    var c = cursoSel();
    S.edCurso = c ? { nombre: c.nombre, horas: String(c.horas), area_tematica: c.area_tematica, agente: c.agente_capacitador, instructor: c.instructor }
      : { nombre: '', horas: '', area_tematica: '6000 - SEGURIDAD', agente: 'HEDMA TECNOCONTROL S.A. DE C.V.', instructor: '' };
  }
  function tomarEmpresa() {
    var e = empresaSel();
    S.edEmp = e ? { razon_social: e.razon_social, rfc: e.rfc || '', patron: e.patron_representante || '', rep_trab: e.representante_trabajadores || '' }
      : { razon_social: '', rfc: '', patron: '', rep_trab: '' };
  }
  function firmaDisponible(k) {
    var n = k === 'instructor' ? S.edCurso.instructor : k === 'patron' ? S.edEmp.patron : S.edEmp.rep_trab;
    return N.mayus(n) === FIRMANTES[k] && !!(S.recursos && S.recursos[{ instructor: 'FIRMA_INSTRUCTOR', patron: 'FIRMA_PATRON', rep: 'FIRMA_REP' }[k]]);
  }
  function firmasActuales() {
    return { instructor: !!S.form.firmas.instructor && firmaDisponible('instructor'), patron: !!S.form.firmas.patron && firmaDisponible('patron'), rep: !!S.form.firmas.rep && firmaDisponible('rep') };
  }
  function seleccionados() { return S.trabajadores.filter(function (t) { return S.sel[t.id]; }); }
  function datosDe(t, folio) {
    return {
      folio: folio || '', nombre: t.nombre, curp: t.curp, puesto: t.puesto || '', ocupacion: t.ocupacion || S.form.ocupacion,
      razon_social: S.edEmp.razon_social, rfc_empresa: S.edEmp.rfc, curso: S.edCurso.nombre, horas: S.edCurso.horas,
      area_tematica: S.edCurso.area_tematica, agente_capacitador: S.edCurso.agente, instructor: S.edCurso.instructor,
      patron: S.edEmp.patron, representante_trab: S.edEmp.rep_trab, fecha_inicio: S.form.ini, fecha_fin: S.form.fin, firmas: firmasActuales()
    };
  }
  function problemas() {
    var p = [], c = S.edCurso, e = S.edEmp, f = S.form;
    if (N.limpiar(c.nombre).length < 2) p.push('Escribe el nombre del curso');
    if (!(Number(c.horas) > 0 && Number(c.horas) <= 1000)) p.push('Escribe cuántas horas duró el curso');
    if (!N.limpiar(c.area_tematica)) p.push('Elige el área temática');
    if (N.limpiar(c.agente).length < 2) p.push('Escribe el agente capacitador');
    if (N.limpiar(c.instructor).length < 3) p.push('Escribe el nombre del instructor');
    if (!f.ini || !f.fin) p.push('Pon las fechas del curso');
    else if (f.fin < f.ini) p.push('La fecha final no puede ser antes de la inicial');
    if (N.limpiar(e.razon_social).length < 2) p.push('Elige la empresa');
    var rv = N.validarRfcEmpresa(e.rfc); if (!rv.ok) p.push(rv.motivo);
    if (N.limpiar(e.patron).length < 3) p.push('Escribe el nombre del patrón o representante legal');
    if (!seleccionados().length) p.push('Elige al menos una persona');
    if (!N.limpiar(f.ocupacion) && seleccionados().some(function (t) { return !t.ocupacion; })) p.push('Elige la ocupación');
    return p;
  }

  var refrescar = function () {};
  function vGenerar(main) {
    if (!S.plantilla) plantilla().then(function () { refrescar(); }).catch(function (e) { S.errPlantilla = errTxt(e); refrescar(); });
    var izq = h('div'), der = h('div', { class: 'lado' });
    main.appendChild(h('div', { class: 'generar' }, izq, der));
    var marcas = {};
    function paso(n, titulo, ayuda, cuerpo) {
      var num = h('span', { class: 'n', text: String(n) }); marcas[n] = num;
      return h('section', { class: 'paso' }, h('h2', null, num, titulo), h('p', { class: 'ayuda', text: ayuda }), h('div', { class: 'cuerpo' }, cuerpo));
    }
    function inp(obj, k, at) {
      at = at || {};
      var el = h('input', Object.assign({ value: obj[k] || '', maxlength: at.maxlength || 200, autocomplete: 'off', spellcheck: 'false' }, at));
      el.addEventListener('input', function () { obj[k] = el.value; if (at.mayus) { var p = el.selectionStart; el.value = el.value.toLocaleUpperCase('es-MX'); obj[k] = el.value; try { el.setSelectionRange(p, p); } catch (e) {} } refrescar(); });
      return el;
    }
    // 1 curso
    var selCurso = h('select', { 'aria-label': 'Curso' }, opciones(S.cursos.filter(function (c) { return c.activo || c.id === S.form.curso_id; }).map(function (c) { return [c.id, c.nombre]; }), S.form.curso_id, '— Curso nuevo (escríbelo abajo) —'));
    var cajaCurso = h('div');
    function pintarCurso() {
      vaciar(cajaCurso);
      var areaSel = h('select', null, opciones(AREAS_TEMATICAS, S.edCurso.area_tematica, '— Elige —'));
      areaSel.addEventListener('change', function () { S.edCurso.area_tematica = areaSel.value; refrescar(); });
      var guardar = h('button', { class: 'btn chico', onclick: guardarCursoDesdeGenerar }, S.form.curso_id ? 'Guardar cambios del curso' : 'Guardar como curso nuevo');
      cajaCurso.appendChild(h('div', { class: 'rejilla', style: 'margin-top:12px' },
        h('div', { class: 'rejilla r2' }, campo('Nombre del curso', inp(S.edCurso, 'nombre', { mayus: true })), campo('Duración en horas', inp(S.edCurso, 'horas', { type: 'number', min: '0.5', max: '1000', step: '0.5', inputmode: 'decimal', maxlength: 6 }))),
        h('div', { class: 'rejilla r2' }, campo('Área temática', areaSel, 'catálogo STPS'), campo('Agente capacitador', inp(S.edCurso, 'agente', { mayus: true }))),
        campo('Instructor o tutor', inp(S.edCurso, 'instructor', { mayus: true, maxlength: 120 })),
        h('div', { class: 'fila-acc' }, guardar, h('span', { class: 'contador', text: 'Los cambios aquí solo aplican a esta emisión si no los guardas.' }))));
    }
    selCurso.addEventListener('change', function () { S.form.curso_id = selCurso.value; tomarCurso(); pintarCurso(); refrescar(); });
    pintarCurso();
    izq.appendChild(paso(1, 'Curso', 'Elige el curso. Sus datos se llenan solos; puedes cambiarlos si hace falta.', [campo('Curso', selCurso), cajaCurso]));

    // 2 fechas
    var fIni = h('input', { type: 'date', value: S.form.ini, min: '2000-01-01' }), fFin = h('input', { type: 'date', value: S.form.fin, min: '2000-01-01' });
    fIni.addEventListener('change', function () { S.form.ini = fIni.value; if (!S.form.fin || S.form.fin < S.form.ini) { S.form.fin = S.form.ini; fFin.value = S.form.ini; } refrescar(); });
    fFin.addEventListener('change', function () { S.form.fin = fFin.value; refrescar(); });
    izq.appendChild(paso(2, 'Fechas del curso', 'Día en que empezó y día en que terminó. Si fue un solo día, pon la misma fecha.', h('div', { class: 'rejilla r2' }, campo('Del', fIni), campo('Al', fFin))));

    // 3 empresa
    var selEmp = h('select', { 'aria-label': 'Empresa' }, opciones(S.empresas.filter(function (e) { return e.activo || e.id === S.form.empresa_id; }).map(function (e) { return [e.id, e.razon_social]; }), S.form.empresa_id, '— Elige la empresa —'));
    var cajaEmp = h('div');
    function pintarEmp() {
      vaciar(cajaEmp);
      cajaEmp.appendChild(h('div', { class: 'rejilla', style: 'margin-top:12px' },
        h('div', { class: 'rejilla r2' }, campo('Razón social', inp(S.edEmp, 'razon_social', { mayus: true })), campo('RFC', inp(S.edEmp, 'rfc', { mayus: true, maxlength: 15 }), '12 o 13 caracteres')),
        h('div', { class: 'rejilla r2' }, campo('Patrón o representante legal', inp(S.edEmp, 'patron', { mayus: true, maxlength: 120 })), campo('Representante de los trabajadores', inp(S.edEmp, 'rep_trab', { mayus: true, maxlength: 120 }), 'empresas de más de 50'))));
    }
    selEmp.addEventListener('change', function () { S.form.empresa_id = selEmp.value; tomarEmpresa(); pintarEmp(); refrescar(); });
    pintarEmp();
    izq.appendChild(paso(3, 'Empresa', 'La empresa donde trabaja el personal que tomó el curso.', [campo('Empresa', selEmp), cajaEmp]));

    // 4 personas
    var buscar = h('input', { type: 'search', placeholder: 'Buscar por nombre, CURP, puesto o división', value: S.form.buscar, maxlength: 60, 'aria-label': 'Buscar personal' });
    var filtroEmp = h('select', { class: 'filtro', 'aria-label': 'Filtrar por empresa' }, opciones(S.empresas.map(function (e) { return [e.id, e.razon_social]; }), S.form.filtroEmp, 'Todas las empresas'));
    var ocup = h('select', { 'aria-label': 'Ocupación' }, opciones(OCUPACIONES, S.form.ocupacion, '— Elige —'));
    ocup.addEventListener('change', function () { S.form.ocupacion = ocup.value; refrescar(); });
    var lista = h('div', { class: 'lista-personas', role: 'group', 'aria-label': 'Personal' }), cont = h('span', { class: 'contador' });
    var limite = 200;
    function visibles() {
      var q = N.limpiar(S.form.buscar);
      return S.trabajadores.filter(function (t) {
        if (!t.activo && !S.sel[t.id]) return false;
        if (S.form.filtroEmp && t.empresa_id !== S.form.filtroEmp) return false;
        return coincide([t.nombre, t.curp, t.puesto, t.division, t.region, t.numero_personal].join(' '), q);
      });
    }
    function pintarLista() {
      vaciar(lista);
      var v = visibles();
      if (!S.trabajadores.length) { lista.appendChild(h('div', { class: 'vacio-msg' }, h('b', { text: 'Todavía no hay personal' }), 'Ve a la pestaña Personal y sube el Excel o agrega a alguien.')); }
      else if (!v.length) lista.appendChild(h('div', { class: 'vacio-msg', text: 'Nadie coincide con la búsqueda.' }));
      var empNom = {}; S.empresas.forEach(function (e) { empNom[e.id] = e.razon_social; });
      v.slice(0, limite).forEach(function (t) {
        var cb = h('input', { type: 'checkbox', checked: !!S.sel[t.id], tabindex: '-1', 'aria-hidden': 'true' });
        var fila = h('div', { class: 'persona' + (S.sel[t.id] ? ' sel' : ''), role: 'checkbox', tabindex: '0', 'aria-checked': S.sel[t.id] ? 'true' : 'false' },
          cb, h('div', null, h('div', { class: 'nom', text: t.nombre }), h('div', { class: 'det', text: [t.puesto, t.division || t.region, empNom[t.empresa_id]].filter(Boolean).join(' · ') })),
          h('span', { class: 'mono', style: 'font-size:12px;color:#5b6b82', text: t.curp }));
        function alternar() { if (S.sel[t.id]) delete S.sel[t.id]; else S.sel[t.id] = true; cb.checked = !!S.sel[t.id]; fila.classList.toggle('sel', !!S.sel[t.id]); fila.setAttribute('aria-checked', S.sel[t.id] ? 'true' : 'false'); contar(); refrescar(); }
        fila.addEventListener('click', alternar);
        fila.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); alternar(); } });
        lista.appendChild(fila);
      });
      if (v.length > limite) lista.appendChild(h('div', { class: 'mas' }, h('button', { class: 'btn chico suave', onclick: function () { limite += 300; pintarLista(); } }, 'Mostrar más (' + (v.length - limite) + ' restantes)')));
      contar();
    }
    function contar() {
      vaciar(cont);
      var n = Object.keys(S.sel).length;
      cont.appendChild(document.createTextNode('Elegidos: ')); cont.appendChild(h('b', { text: String(n) }));
      cont.appendChild(document.createTextNode(' de ' + visibles().length + ' en la lista'));
    }
    var tBus;
    buscar.addEventListener('input', function () { clearTimeout(tBus); tBus = setTimeout(function () { S.form.buscar = buscar.value; limite = 200; pintarLista(); }, 150); });
    filtroEmp.addEventListener('change', function () { S.form.filtroEmp = filtroEmp.value; limite = 200; pintarLista(); });
    izq.appendChild(paso(4, 'Personal', 'Marca a quienes tomaron el curso. Puedes buscar y elegir a todos los que aparecen de un jalón.', [
      h('div', { class: 'fila-acc' }, h('div', { class: 'buscar' }, ico('buscar', 16), buscar), filtroEmp),
      h('div', { class: 'fila-acc', style: 'margin-top:10px' },
        h('button', { class: 'btn chico', onclick: function () { visibles().forEach(function (t) { S.sel[t.id] = true; }); pintarLista(); refrescar(); } }, 'Elegir a todos los de la lista'),
        h('button', { class: 'btn chico suave', onclick: function () { S.sel = {}; S.previaIdx = 0; pintarLista(); refrescar(); } }, 'Quitar a todos'), cont),
      lista,
      h('div', { style: 'margin-top:12px;max-width:520px' }, campo('Ocupación (catálogo nacional)', ocup, 'se usa para quien no tenga una propia'))]));
    pintarLista();

    // 5 firmas
    var cajaFirmas = h('div');
    izq.appendChild(paso(5, 'Firmas', 'Las firmas escaneadas solo se ponen si el nombre coincide con la persona que firmó la plantilla.', cajaFirmas));

    // Lado derecho: vista previa + emitir
    var marcoHoja = h('div', { class: 'hoja-escala' }), contHoja = h('div', { style: 'overflow:hidden' }, marcoHoja);
    var navPrev = h('div', { class: 'fila-acc' });
    der.appendChild(h('div', { class: 'previa-marco' }, h('div', { class: 'previa-cab' }, h('b', { text: 'Vista previa del DC-3' }), navPrev), contHoja));
    var lista_prob = h('div'), btnEmitir = h('button', { class: 'btn primario grande', onclick: emitir }, ico('bajar'), 'Emitir y descargar');
    var seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Formato' });
    [['ambos', 'Word y PDF'], ['word', 'Word'], ['pdf', 'PDF']].forEach(function (o) {
      seg.appendChild(h('button', { 'aria-pressed': S.formato === o[0] ? 'true' : 'false', onclick: function () { S.formato = o[0]; seg.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', ['ambos', 'word', 'pdf'][i] === S.formato ? 'true' : 'false'); }); } }, o[1]));
    });
    der.appendChild(h('div', { class: 'acciones' }, h('div', { class: 'fila-acc', style: 'justify-content:space-between' }, seg, btnEmitir), lista_prob));

    function escalar() {
      var hoja = marcoHoja.firstChild; if (!hoja) return;
      var esc = Math.min(1, contHoja.clientWidth / 816);
      marcoHoja.style.transform = 'scale(' + esc + ')';
      contHoja.style.height = (hoja.offsetHeight * esc) + 'px';
    }
    if (window.ResizeObserver) new ResizeObserver(escalar).observe(contHoja);

    refrescar = function () {
      // firmas
      vaciar(cajaFirmas);
      if (S.errPlantilla) cajaFirmas.appendChild(h('div', { class: 'nota er', text: S.errPlantilla }));
      else if (!S.recursos) cajaFirmas.appendChild(h('div', { class: 'nota', text: 'Cargando la plantilla con las firmas…' }));
      [['instructor', 'Instructor o tutor', S.edCurso.instructor], ['patron', 'Patrón o representante legal', S.edEmp.patron], ['rep', 'Representante de los trabajadores', S.edEmp.rep_trab]].forEach(function (f) {
        var disp = firmaDisponible(f[0]);
        var cb = h('input', { type: 'checkbox', checked: disp && !!S.form.firmas[f[0]], disabled: !disp });
        cb.addEventListener('change', function () { S.form.firmas[f[0]] = cb.checked; refrescar(); });
        cajaFirmas.appendChild(h('label', { class: 'check', style: 'margin:8px 0' }, cb, h('span', null, h('b', { text: f[1] + ': ' }), N.mayus(f[2]) || '—',
          disp ? null : h('small', { style: 'display:block;color:#5b6b82', text: 'Sin firma escaneada para este nombre: se imprime solo el nombre para firmar a mano.' }))));
      });
      // pasos listos
      var c = S.edCurso;
      marcas[1].classList.toggle('listo', N.limpiar(c.nombre).length > 1 && Number(c.horas) > 0 && !!c.area_tematica && N.limpiar(c.instructor).length > 2);
      marcas[2].classList.toggle('listo', !!S.form.ini && !!S.form.fin && S.form.fin >= S.form.ini);
      marcas[3].classList.toggle('listo', N.limpiar(S.edEmp.razon_social).length > 1 && N.limpiar(S.edEmp.patron).length > 2 && N.validarRfcEmpresa(S.edEmp.rfc).ok);
      marcas[4].classList.toggle('listo', seleccionados().length > 0);
      marcas[5].classList.toggle('listo', !!S.recursos);
      // vista previa
      var sel = seleccionados();
      if (S.previaIdx >= sel.length) S.previaIdx = Math.max(0, sel.length - 1);
      var t = sel[S.previaIdx] || { nombre: '', curp: '', puesto: '', ocupacion: '' };
      vaciar(marcoHoja); marcoHoja.appendChild(hojaHTML(datosDe(t, '')));
      vaciar(navPrev);
      if (sel.length > 1) {
        navPrev.appendChild(h('button', { class: 'btn chico suave', 'aria-label': 'Anterior', disabled: S.previaIdx === 0, onclick: function () { S.previaIdx--; refrescar(); } }, ico('izq', 16)));
        navPrev.appendChild(h('span', { class: 'contador', text: (S.previaIdx + 1) + ' de ' + sel.length }));
        navPrev.appendChild(h('button', { class: 'btn chico suave', 'aria-label': 'Siguiente', disabled: S.previaIdx >= sel.length - 1, onclick: function () { S.previaIdx++; refrescar(); } }, ico('der', 16)));
      }
      requestAnimationFrame(escalar);
      // problemas
      var p = problemas();
      vaciar(lista_prob);
      btnEmitir.disabled = p.length > 0;
      vaciar(btnEmitir); btnEmitir.appendChild(ico('bajar'));
      btnEmitir.appendChild(document.createTextNode(sel.length > 1 ? 'Emitir ' + sel.length + ' constancias' : 'Emitir y descargar'));
      if (p.length) lista_prob.appendChild(h('div', { class: 'nota av', style: 'margin-top:12px' }, h('b', { text: 'Antes de emitir falta:' }), h('ul', { style: 'margin:6px 0 0 18px;padding:0' }, p.map(function (x) { return h('li', { text: x }); }))));
      else lista_prob.appendChild(h('p', { class: 'contador', style: 'margin:12px 0 0', text: 'Cada constancia recibe un folio único y queda guardada en el Historial.' }));
    };
    refrescar();
  }

  // Vista previa fiel al formato (todo con textContent)
  function hojaHTML(d) {
    var m = N.marcadores(d);
    function caj(pref, n) { var c = []; for (var i = 1; i <= n; i++) c.push(h('span', { text: m[pref + i] || '' })); return h('div', { class: 'cajas' }, c); }
    function celda(et, val, sup) { return h('div', { class: 'celda' }, h('div', null, et, sup ? h('sup', { text: sup }) : null), h('div', { class: 'val' + (val ? '' : ' vacio'), text: val || '—' })); }
    function firma(tit, sup, nombre, llave, usar) {
      var img = usar && S.recursos && S.recursos[llave] ? h('img', { src: S.recursos[llave], alt: '' }) : null;
      return h('div', null, h('div', null, tit, sup ? h('sup', { text: sup }) : null), h('div', { class: 'zona' }, img), h('div', { class: 'nomf', text: nombre || '' }), h('div', { text: 'Nombre y firma', style: 'margin-top:2px' }));
    }
    var fe = [h('span', { text: '' }), h('span', { class: 'e', text: 'Año' }), h('span', { class: 'm', text: 'Mes' }), h('span', { class: 'm', text: 'Día' }), h('span', { text: '' }), h('span', { class: 'e', text: 'Año' }), h('span', { class: 'm', text: 'Mes' }), h('span', { class: 'm', text: 'Día' }), h('span', { text: 'De' })];
    for (var i = 1; i <= 8; i++) fe.push(h('span', { text: m['I' + i] }));
    fe.push(h('span', { text: 'a' }));
    for (i = 1; i <= 8; i++) fe.push(h('span', { text: m['F' + i] }));
    return h('div', { class: 'hoja', 'aria-label': 'Vista previa del formato DC-3' },
      h('img', { class: 'logo', src: LOGO, alt: 'Tecnocontrol' }),
      h('div', { class: 'tit' }, 'FORMATO DC-3', h('br'), 'CONSTANCIA DE COMPETENCIAS O DE HABILIDADES LABORALES'),
      h('div', { class: 'sec' }, h('div', { class: 'cab', text: 'DATOS DEL TRABAJADOR' }),
        celda('Nombre (Anotar apellido paterno, apellido materno y nombre (s)', m.NOMBRE),
        h('div', { class: 'lado2', style: 'border-top:1px solid #000' }, h('div', { style: 'padding:3px 0 0;font-size:9.5px' }, h('div', { style: 'padding-left:5px', text: 'Clave Única de Registro de Población' }), caj('C', 18)),
          h('div', { style: 'padding:3px 5px;font-size:9.5px' }, 'Ocupación específica (Catálogo Nacional de Ocupaciones) ', h('sup', { text: '1/' }), h('div', { class: 'val', text: m.OCUPACION }))),
        celda('Puesto*', m.PUESTO)),
      h('div', { class: 'sec' }, h('div', { class: 'cab', text: 'DATOS DE LA EMPRESA' }),
        celda('Nombre o razón social (En caso de persona física, anotar apellido paterno, apellido materno y nombre(s))', m.RAZON_SOCIAL),
        h('div', { class: 'lado2', style: 'border-top:1px solid #000' }, h('div', { style: 'padding:3px 0 0;font-size:9.5px' }, h('div', { style: 'padding-left:5px', text: 'Registro Federal de Contribuyentes con homoclave (SHCP)' }), caj('R', 18)), h('div'))),
      h('div', { class: 'sec' }, h('div', { class: 'cab', text: 'DATOS DEL PROGRAMA DE CAPACITACIÓN, ADIESTRAMIENTO Y PRODUCTIVIDAD' }),
        celda('Nombre del curso', m.CURSO),
        h('div', { class: 'periodo', style: 'border-top:1px solid #000' }, h('div', { style: 'padding:3px 5px;font-size:9.5px' }, 'Duración en horas', h('div', { class: 'val', text: m.HORAS })),
          h('div', { style: 'padding:3px 5px;font-size:9.5px' }, 'Periodo de ejecución:'), h('div', { class: 'fechas' }, fe)),
        celda('Área temática del curso ', m.AREA_TEMATICA, '2/'), celda('Nombre del agente capacitador o STPS ', m.AGENTE, '3/')),
      h('div', { class: 'firmas' }, h('div', { class: 'leyenda' }, 'Los datos se asientan en esta constancia bajo protesta de decir verdad, apercibidos de la responsabilidad en que incurre todo', h('br'), 'aquel que no se conduce con verdad.'),
        h('div', { class: 'tres' }, firma('Instructor o tutor', '', m.INSTRUCTOR, 'FIRMA_INSTRUCTOR', d.firmas.instructor), firma('Patrón o representante legal ', '4/', m.PATRON, 'FIRMA_PATRON', d.firmas.patron), firma('Representante de los trabajadores ', '5/', m.REP_TRAB, 'FIRMA_REP', d.firmas.rep))),
      h('div', { class: 'instr' }, h('b', { text: 'INSTRUCCIONES' }), h('br'), '- Llenar a máquina o con letra de molde.', h('br'), '- Deberá entregarse al trabajador dentro de los veinte días hábiles siguientes al término del curso de capacitación aprobado.'),
      h('div', { class: 'pie', text: 'DC-3 ANVERSO' + (d.folio ? ' · FOLIO ' + d.folio : ' · el folio se asigna al emitir') }));
  }

  async function guardarCursoDesdeGenerar() {
    var c = S.edCurso;
    var fila = { nombre: N.mayus(c.nombre), horas: Number(c.horas), area_tematica: N.mayus(c.area_tematica), agente_capacitador: N.mayus(c.agente), instructor: N.mayus(c.instructor) };
    if (fila.nombre.length < 2 || !(fila.horas > 0) || !fila.area_tematica || fila.agente_capacitador.length < 2 || fila.instructor.length < 3) { aviso('Faltan datos del curso', 'Llena nombre, horas, área, agente e instructor.', 'er'); return; }
    try {
      var r = S.form.curso_id ? await S.sb.from('dc3_cursos').update(fila).eq('id', S.form.curso_id).select().single()
        : await S.sb.from('dc3_cursos').insert(fila).select().single();
      if (r.error) throw r.error;
      S.cursos = alfa(S.cursos.filter(function (x) { return x.id !== r.data.id; }).concat([r.data]), 'nombre');
      S.form.curso_id = r.data.id; tomarCurso();
      aviso('Curso guardado', r.data.nombre, 'ok'); pintar();
    } catch (e) { aviso('No se guardó el curso', errTxt(e), 'er'); }
  }

  async function emitir() {
    var p = problemas(); if (p.length) return;
    var sel = seleccionados();
    var f = S.form;
    var ok = await confirmar('Emitir ' + sel.length + (sel.length === 1 ? ' constancia' : ' constancias'),
      'Curso: ' + N.mayus(S.edCurso.nombre) + ' (' + N.horasTxt(S.edCurso.horas) + ')\nEmpresa: ' + N.mayus(S.edEmp.razon_social) +
      '\nFechas: ' + f.ini + ' al ' + f.fin + '\n\nCada una recibe un folio y queda registrada a tu nombre. Si algo está mal después, un administrador la puede anular.', 'Sí, emitir');
    if (!ok) return;
    var pr = progreso('Emitiendo constancias');
    try {
      pr.poner('Bajando la plantilla…', 3);
      await plantilla();
      var emitidas = [];
      for (var i = 0; i < sel.length; i += MAX_LOTE) {
        var lote = sel.slice(i, i + MAX_LOTE);
        pr.poner('Asignando folios (' + Math.min(i + MAX_LOTE, sel.length) + ' de ' + sel.length + ')…', 5 + 25 * (i + lote.length) / sel.length);
        var r = await S.sb.rpc('dc3_emitir', { p: {
          curso: { id: S.form.curso_id || null, nombre: N.mayus(S.edCurso.nombre), horas: Number(S.edCurso.horas), area_tematica: N.mayus(S.edCurso.area_tematica), agente: N.mayus(S.edCurso.agente), instructor: N.mayus(S.edCurso.instructor) },
          empresa: { id: S.form.empresa_id || null, razon_social: N.mayus(S.edEmp.razon_social), rfc: N.normRfc(S.edEmp.rfc) || null, patron: N.mayus(S.edEmp.patron), rep_trab: N.mayus(S.edEmp.rep_trab) || null },
          fecha_inicio: f.ini, fecha_fin: f.fin, firmas: firmasActuales(),
          trabajadores: lote.map(function (t) { return { curp: t.curp, nombre: t.nombre, puesto: t.puesto || null, ocupacion: t.ocupacion || S.form.ocupacion }; })
        } });
        if (r.error) throw r.error;
        var porCurp = {}; (r.data || []).forEach(function (x) { porCurp[x.curp] = x.folio; });
        lote.forEach(function (t) { emitidas.push(datosDe(t, porCurp[t.curp])); });
      }
      await armarArchivos(emitidas, pr, 30);
      pr.cerrar();
      aviso(emitidas.length === 1 ? 'Constancia emitida' : emitidas.length + ' constancias emitidas', 'Folios ' + emitidas[0].folio + (emitidas.length > 1 ? ' a ' + emitidas[emitidas.length - 1].folio : ''), 'ok');
      S.hist = [];
    } catch (e) {
      pr.cerrar();
      aviso('No se emitieron', errTxt(e), 'er');
    }
  }

  async function armarArchivos(lista, pr, base) {
    var etiqueta = N.nombreArchivo(lista.length === 1 ? lista[0].folio + '_' + lista[0].nombre : 'DC3_' + N.mayus(lista[0].curso) + '_' + lista.length);
    var bytes = await plantilla();
    if (S.formato !== 'pdf') {
      if (lista.length === 1) {
        pr.poner('Armando el Word…', base + 30);
        var u = await N.llenarDocx(bytes, lista[0]);
        descargar(new Blob([u], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), etiqueta + '.docx');
      } else {
        var zip = new window.JSZip();
        for (var i = 0; i < lista.length; i++) {
          pr.poner('Armando Word ' + (i + 1) + ' de ' + lista.length + '…', base + 50 * (i + 1) / lista.length);
          zip.file(N.nombreArchivo(lista[i].folio + '_' + lista[i].nombre) + '.docx', await N.llenarDocx(bytes, lista[i]));
        }
        pr.poner('Comprimiendo…', base + 55);
        descargar(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), etiqueta + '_WORD.zip');
      }
    }
    if (S.formato !== 'word') {
      pr.poner('Armando el PDF…', 92);
      await new Promise(function (r) { setTimeout(r, 30); });
      descargar(N.pdf(lista, S.recursos).output('blob'), etiqueta + '.pdf');
    }
    pr.poner('Listo', 100);
  }

  // ═════════════ PERSONAL ═════════════
  function vPersonal(main) {
    var q = h('input', { type: 'search', placeholder: 'Buscar por nombre, CURP, puesto o división', maxlength: 60, 'aria-label': 'Buscar personal' });
    var fe = h('select', { class: 'filtro', 'aria-label': 'Empresa' }, opciones(S.empresas.map(function (e) { return [e.id, e.razon_social]; }), '', 'Todas las empresas'));
    var verBajas = h('input', { type: 'checkbox' });
    var cuerpo = h('div'), limite = 300;
    var empNom = {}; S.empresas.forEach(function (e) { empNom[e.id] = e.razon_social; });
    main.appendChild(h('div', { class: 'panel' },
      h('div', { class: 'panel-cab' }, h('h2', { text: 'Personal (' + S.trabajadores.length + ')' }),
        puedeEditar() ? h('button', { class: 'btn', onclick: importar }, ico('subir'), 'Subir Excel') : null,
        puedeEditar() ? h('button', { class: 'btn azul', onclick: function () { editarTrabajador(null); } }, ico('mas'), 'Agregar persona') : null),
      h('div', { class: 'fila-acc', style: 'margin-bottom:12px' }, h('div', { class: 'buscar' }, ico('buscar', 16), q), fe, h('label', { class: 'check' }, verBajas, 'Ver también dados de baja')),
      cuerpo));
    function pintarT() {
      vaciar(cuerpo);
      var txt = N.limpiar(q.value);
      var v = S.trabajadores.filter(function (t) { return (verBajas.checked || t.activo) && (!fe.value || t.empresa_id === fe.value) && coincide([t.nombre, t.curp, t.puesto, t.division, t.region, t.numero_personal].join(' '), txt); });
      if (!v.length) { cuerpo.appendChild(h('div', { class: 'vacio-msg' }, h('b', { text: S.trabajadores.length ? 'Nadie coincide' : 'Aún no hay personal' }), S.trabajadores.length ? 'Prueba con otra búsqueda.' : 'Sube el Excel con nombres y CURP, o agrega a alguien a mano.')); return; }
      var tb = h('tbody');
      v.slice(0, limite).forEach(function (t) {
        var vc = N.validarCurp(t.curp), nm = N.ordenarNombre(t.nombre, t.curp);
        tb.appendChild(h('tr', null,
          h('td', null, h('b', { text: t.nombre }), t.activo ? null : h('span', { class: 'etq gr', style: 'margin-left:6px', text: 'Baja' }),
            nm.estado === 'no_coincide' ? h('div', null, h('span', { class: 'etq av', text: 'El nombre no coincide con la CURP' })) : null),
          h('td', { class: 'mono' }, t.curp, !vc.ok ? h('div', null, h('span', { class: 'etq er', text: vc.motivo })) : vc.aviso ? h('div', null, h('span', { class: 'etq av', text: 'Revisar último dígito' })) : null),
          h('td', { text: t.puesto || '—' }), h('td', { text: empNom[t.empresa_id] || '—' }), h('td', { text: [t.division, t.region].filter(Boolean).join(' · ') || '—' }),
          h('td', null, puedeEditar() ? h('button', { class: 'btn chico suave', onclick: function () { editarTrabajador(t); } }, 'Editar') : null)));
      });
      cuerpo.appendChild(h('div', { class: 'tabla-c' }, h('table', null, h('thead', null, h('tr', null, ['Nombre', 'CURP', 'Puesto', 'Empresa', 'División / región', ''].map(function (x) { return h('th', { text: x }); }))), tb)));
      if (v.length > limite) cuerpo.appendChild(h('div', { class: 'mas' }, h('button', { class: 'btn chico suave', onclick: function () { limite += 500; pintarT(); } }, 'Mostrar más (' + (v.length - limite) + ')')));
    }
    var tq; q.addEventListener('input', function () { clearTimeout(tq); tq = setTimeout(function () { limite = 300; pintarT(); }, 150); });
    fe.addEventListener('change', pintarT); verBajas.addEventListener('change', pintarT);
    pintarT();
  }

  function editarTrabajador(t) {
    var o = t ? Object.assign({}, t) : { nombre: '', curp: '', puesto: '', ocupacion: '', empresa_id: S.form.empresa_id || '', region: '', division: '', numero_personal: '', rfc: '', activo: true };
    var iNom = h('input', { value: o.nombre, maxlength: 150, autocomplete: 'off' }), iCurp = h('input', { value: o.curp, maxlength: 18, autocomplete: 'off', class: 'mono', spellcheck: 'false' });
    var iPue = h('input', { value: o.puesto || '', maxlength: 120 }), iOcu = h('select', null, opciones(OCUPACIONES, o.ocupacion || '', 'Usar la que se elija al generar'));
    var iEmp = h('select', null, opciones(S.empresas.map(function (e) { return [e.id, e.razon_social]; }), o.empresa_id || '', '— Sin empresa —'));
    var iReg = h('input', { value: o.region || '', maxlength: 60 }), iDiv = h('input', { value: o.division || '', maxlength: 120 }), iNum = h('input', { value: o.numero_personal || '', maxlength: 40 }), iRfc = h('input', { value: o.rfc || '', maxlength: 13, class: 'mono' });
    var iAct = h('input', { type: 'checkbox', checked: o.activo !== false });
    var msg = h('div');
    function revisar() {
      vaciar(msg);
      var v = N.validarCurp(iCurp.value); iCurp.setAttribute('aria-invalid', iCurp.value && !v.ok ? 'true' : 'false');
      if (iCurp.value && !v.ok) msg.appendChild(h('div', { class: 'nota er', text: v.motivo }));
      if (v.ok && v.aviso) msg.appendChild(h('div', { class: 'nota av', text: v.aviso }));
      if (N.limpiar(iNom.value) && !N.nombreValido(iNom.value)) msg.appendChild(h('div', { class: 'nota er', text: 'El nombre solo puede llevar letras, espacios, punto, apóstrofo o guion.' }));
      if (v.ok && N.limpiar(iNom.value)) {
        var nm = N.ordenarNombre(iNom.value, v.curp);
        if (nm.estado === 'reordenado') msg.appendChild(h('div', { class: 'nota av' }, 'El DC-3 pide apellidos primero. ¿Quisiste decir ', h('b', { text: nm.nombre }), '? ',
          h('button', { class: 'btn chico', type: 'button', onclick: function () { iNom.value = nm.nombre; revisar(); } }, 'Usar así')));
        else if (nm.estado === 'no_coincide') msg.appendChild(h('div', { class: 'nota av', text: 'El nombre no coincide con las letras de la CURP. Revisa que ambos estén bien escritos.' }));
      }
      return v;
    }
    iCurp.addEventListener('input', function () { iCurp.value = iCurp.value.toUpperCase().replace(/[^A-Z0-9Ñ]/g, ''); revisar(); });
    iNom.addEventListener('input', revisar);
    var d = dialogo(t ? 'Editar persona' : 'Agregar persona', [
      h('div', { class: 'rejilla' },
        campo('Nombre completo', iNom, 'apellido paterno, materno y nombre(s)'),
        h('div', { class: 'rejilla r2' }, campo('CURP', iCurp), campo('Puesto', iPue)),
        h('div', { class: 'rejilla r2' }, campo('Empresa', iEmp), campo('Ocupación', iOcu)),
        h('div', { class: 'rejilla r3' }, campo('Región', iReg), campo('División', iDiv), campo('Número de personal', iNum)),
        h('div', { class: 'rejilla r2' }, campo('RFC de la persona', iRfc, 'opcional'), h('label', { class: 'check', style: 'align-self:end;padding-bottom:10px' }, iAct, 'Activo (si lo quitas, se da de baja)')),
        msg)], [
      h('button', { class: 'btn suave', onclick: function () { d.close(); } }, 'Cancelar'),
      h('button', { class: 'btn azul', onclick: guardar }, 'Guardar')]);
    revisar();
    async function guardar() {
      var v = revisar();
      if (!v.ok) { aviso('Revisa la CURP', v.motivo, 'er'); return; }
      var fila = { nombre: N.recortar(N.mayus(iNom.value), 150), curp: v.curp, puesto: N.recortar(N.mayus(iPue.value), 120) || null, ocupacion: iOcu.value || null,
        empresa_id: iEmp.value || null, region: N.recortar(N.mayus(iReg.value), 60) || null, division: N.recortar(N.mayus(iDiv.value), 120) || null,
        numero_personal: N.recortar(iNum.value, 40) || null, rfc: N.normRfc(iRfc.value).slice(0, 13) || null, activo: iAct.checked };
      if (!N.nombreValido(fila.nombre)) { aviso('Revisa el nombre', 'Solo letras, espacios, punto, apóstrofo o guion (mínimo 3).', 'er'); return; }
      try {
        var r = t ? await S.sb.from('dc3_trabajadores').update(fila).eq('id', t.id).select().single() : await S.sb.from('dc3_trabajadores').insert(fila).select().single();
        if (r.error) throw r.error;
        S.trabajadores = alfa(S.trabajadores.filter(function (x) { return x.id !== r.data.id; }).concat([r.data]), 'nombre');
        d.close(); aviso('Guardado', r.data.nombre, 'ok'); pintar();
      } catch (e) { aviso('No se guardó', /duplicate|unique/i.test(e.message || '') ? 'Ya existe una persona con esa CURP.' : errTxt(e), 'er'); }
    }
  }

  function importar() {
    var archivo = h('input', { type: 'file', accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var iEmp = h('select', null, opciones(S.empresas.filter(function (e) { return e.activo; }).map(function (e) { return [e.id, e.razon_social]; }), S.form.empresa_id || '', '— Elige la empresa —'));
    var res = h('div'), btn = h('button', { class: 'btn azul', disabled: true }, 'Guardar en el catálogo');
    var prep = null;
    var d = dialogo('Subir personal desde Excel', [
      h('p', { style: 'margin:0 0 12px;color:#5b6b82', text: 'El Excel debe tener una columna con el nombre y otra con la CURP. También se leen, si vienen: puesto (o "Descripción de posición"), RFC, región, división y número de personal. Si alguien ya existe (misma CURP), se actualiza.' }),
      h('div', { class: 'rejilla r2' }, campo('Archivo .xlsx', archivo, 'máximo 8 MB'), campo('¿De qué empresa es este personal?', iEmp)), res], [
      h('button', { class: 'btn suave', onclick: function () { d.close(); } }, 'Cancelar'), btn], true);
    archivo.addEventListener('change', async function () {
      vaciar(res); prep = null; btn.disabled = true;
      var f = archivo.files[0]; if (!f) return;
      res.appendChild(h('div', { class: 'nota', text: 'Leyendo ' + f.name + '…' }));
      try {
        if (f.size > MAX_XLSX) throw new Error('El archivo pesa más de 8 MB');
        var bytes = await f.arrayBuffer();
        var mal = N.revisarArchivo(f.name, bytes); if (mal) throw new Error(mal);
        var hojas = await N.leerXlsx(bytes);
        var it = N.interpretar(hojas);
        if (!it) throw new Error('No encontré las columnas de nombre y CURP en ninguna hoja.');
        prep = N.prepararImportacion(it.registros, S.trabajadores);
        vaciar(res);
        var cuenta = { nuevo: 0, actualiza: 0, igual: 0, error: 0, repetido: 0, avisos: 0 };
        cuenta.reord = 0;
        prep.forEach(function (r) { cuenta[r.estado]++; if (r.avisos && r.avisos.length) cuenta.avisos++; if (r.reordenado) cuenta.reord++; });
        res.appendChild(h('div', { class: 'fila-acc', style: 'margin:14px 0 10px' },
          h('span', { class: 'contador', text: 'Hoja "' + it.hoja + '", encabezados en el renglón ' + it.encabezado + ':' }),
          h('span', { class: 'etq ok', text: cuenta.nuevo + ' nuevos' }), h('span', { class: 'etq az', text: cuenta.actualiza + ' se actualizan' }),
          h('span', { class: 'etq gr', text: cuenta.igual + ' sin cambios' }), cuenta.repetido ? h('span', { class: 'etq gr', text: cuenta.repetido + ' repetidos' }) : null,
          cuenta.error ? h('span', { class: 'etq er', text: cuenta.error + ' con error (no se suben)' }) : null,
          cuenta.avisos ? h('span', { class: 'etq av', text: cuenta.avisos + ' para revisar' }) : null,
          cuenta.reord ? h('span', { class: 'etq gr', text: cuenta.reord + ' nombres acomodados a apellidos primero' }) : null));
        var orden = { error: 0, nuevo: 2, actualiza: 2, repetido: 3, igual: 4 };
        var muestra = prep.slice().sort(function (a, b) { return (orden[a.estado] - (a.avisos && a.avisos.length ? 1 : 0)) - (orden[b.estado] - (b.avisos && b.avisos.length ? 1 : 0)); }).slice(0, 400);
        var tb = h('tbody');
        var ET = { nuevo: ['ok', 'Nuevo'], actualiza: ['az', 'Actualiza'], igual: ['gr', 'Sin cambios'], error: ['er', 'Error'], repetido: ['gr', 'Repetido'] };
        muestra.forEach(function (r) {
          tb.appendChild(h('tr', null, h('td', { text: String(r.fila) }), h('td', null, h('span', { class: 'etq ' + ET[r.estado][0], text: ET[r.estado][1] })),
            h('td', null, h('b', { text: r.nombre || r.original.nombre || '' }), r.avisos && r.avisos.length ? h('div', { style: 'font-size:12.5px;color:#8a5a00', text: r.avisos.join(' · ') }) : null,
              r.motivo ? h('div', { style: 'font-size:12.5px;color:#b42318', text: r.motivo }) : null, r.original && r.nombre && r.original.nombre && N.mayus(r.original.nombre) !== r.nombre ? h('div', { style: 'font-size:12px;color:#5b6b82', text: 'En el Excel: ' + r.original.nombre }) : null),
            h('td', { class: 'mono', text: r.curp || '' }), h('td', { text: r.puesto || '' })));
        });
        res.appendChild(h('div', { class: 'tabla-c', style: 'max-height:46vh' }, h('table', null, h('thead', null, h('tr', null, ['Renglón', 'Estado', 'Nombre (como saldrá en el DC-3)', 'CURP', 'Puesto'].map(function (x) { return h('th', { text: x }); }))), tb)));
        if (prep.length > muestra.length) res.appendChild(h('p', { class: 'contador', text: 'Se muestran ' + muestra.length + ' de ' + prep.length + ' renglones (primero los que necesitan atención).' }));
        btn.disabled = !(cuenta.nuevo + cuenta.actualiza);
      } catch (e) { vaciar(res); res.appendChild(h('div', { class: 'nota er', text: e.message || String(e) })); }
    });
    btn.addEventListener('click', async function () {
      if (!prep) return;
      if (!iEmp.value) { aviso('Elige la empresa', 'Indica de qué empresa es este personal.', 'er'); return; }
      var porCurp = {}; S.trabajadores.forEach(function (t) { porCurp[t.curp] = t; });
      var filas = prep.filter(function (r) { return r.estado === 'nuevo' || r.estado === 'actualiza'; }).map(function (r) {
        var ex = porCurp[r.curp] || {};
        return { curp: r.curp, nombre: r.nombre, puesto: r.puesto || ex.puesto || null, ocupacion: r.ocupacion || ex.ocupacion || null, empresa_id: iEmp.value,
          region: r.region || ex.region || null, division: r.division || ex.division || null, numero_personal: r.numero_personal || ex.numero_personal || null, rfc: r.rfc || ex.rfc || null, activo: true };
      });
      btn.disabled = true;
      var pr = progreso('Guardando personal');
      try {
        for (var i = 0; i < filas.length; i += 250) {
          pr.poner('Guardando ' + Math.min(i + 250, filas.length) + ' de ' + filas.length + '…', 100 * (i + 250) / filas.length);
          var r = await S.sb.from('dc3_trabajadores').upsert(filas.slice(i, i + 250), { onConflict: 'curp' });
          if (r.error) throw r.error;
        }
        S.trabajadores = alfa(await todo('dc3_trabajadores', 'nombre'), 'nombre');
        pr.cerrar(); d.close(); aviso('Personal guardado', filas.length + ' personas', 'ok'); pintar();
      } catch (e) { pr.cerrar(); btn.disabled = false; aviso('No se guardó', errTxt(e), 'er'); }
    });
  }

  // ═════════════ CURSOS y EMPRESAS ═════════════
  function vCatalogo(main, cfg) {
    var q = h('input', { type: 'search', placeholder: 'Buscar', maxlength: 60, 'aria-label': 'Buscar' }), cuerpo = h('div');
    main.appendChild(h('div', { class: 'panel' }, h('div', { class: 'panel-cab' }, h('h2', { text: cfg.titulo }),
      puedeEditar() ? h('button', { class: 'btn azul', onclick: function () { cfg.editar(null); } }, ico('mas'), cfg.nuevo) : null),
      h('div', { class: 'fila-acc', style: 'margin-bottom:12px' }, h('div', { class: 'buscar' }, ico('buscar', 16), q)), cuerpo));
    function p() {
      vaciar(cuerpo);
      var v = cfg.lista().filter(function (x) { return coincide(cfg.cols.map(function (c) { return c[1](x); }).join(' '), N.limpiar(q.value)); });
      if (!v.length) { cuerpo.appendChild(h('div', { class: 'vacio-msg', text: 'No hay registros.' })); return; }
      var tb = h('tbody');
      v.forEach(function (x) {
        tb.appendChild(h('tr', null, cfg.cols.map(function (c) { return h('td', { text: c[1](x) || '—' }); }),
          h('td', null, x.activo ? h('span', { class: 'etq ok', text: 'Activo' }) : h('span', { class: 'etq gr', text: 'Inactivo' })),
          h('td', null, puedeEditar() ? h('button', { class: 'btn chico suave', onclick: function () { cfg.editar(x); } }, 'Editar') : null)));
      });
      cuerpo.appendChild(h('div', { class: 'tabla-c' }, h('table', null, h('thead', null, h('tr', null, cfg.cols.map(function (c) { return h('th', { text: c[0] }); }), h('th', { text: 'Estado' }), h('th'))), tb)));
    }
    q.addEventListener('input', p); p();
  }
  function vCursos(main) {
    vCatalogo(main, { titulo: 'Cursos', nuevo: 'Nuevo curso', lista: function () { return S.cursos; },
      cols: [['Curso', function (c) { return c.nombre; }], ['Horas', function (c) { return N.horasTxt(c.horas); }], ['Área temática', function (c) { return c.area_tematica; }], ['Instructor', function (c) { return c.instructor; }], ['Agente capacitador', function (c) { return c.agente_capacitador; }]],
      editar: editarCurso });
  }
  function editarCurso(c) {
    var iN = h('input', { value: c ? c.nombre : '', maxlength: 200 }), iH = h('input', { type: 'number', min: '0.5', max: '1000', step: '0.5', value: c ? c.horas : '' });
    var iA = h('select', null, opciones(AREAS_TEMATICAS, c ? c.area_tematica : '6000 - SEGURIDAD', '— Elige —'));
    var iG = h('input', { value: c ? c.agente_capacitador : 'HEDMA TECNOCONTROL S.A. DE C.V.', maxlength: 200 }), iI = h('input', { value: c ? c.instructor : '', maxlength: 120 });
    var iAct = h('input', { type: 'checkbox', checked: c ? c.activo : true });
    var d = dialogo(c ? 'Editar curso' : 'Nuevo curso', h('div', { class: 'rejilla' }, campo('Nombre del curso', iN), h('div', { class: 'rejilla r2' }, campo('Duración en horas', iH), campo('Área temática', iA)),
      campo('Agente capacitador', iG, 'quien imparte, o STPS'), campo('Instructor o tutor', iI), h('label', { class: 'check' }, iAct, 'Activo (aparece al generar)')), [
      h('button', { class: 'btn suave', onclick: function () { d.close(); } }, 'Cancelar'),
      h('button', { class: 'btn azul', onclick: async function () {
        var fila = { nombre: N.mayus(iN.value), horas: Number(iH.value), area_tematica: iA.value, agente_capacitador: N.mayus(iG.value), instructor: N.mayus(iI.value), activo: iAct.checked };
        if (fila.nombre.length < 2 || !(fila.horas > 0 && fila.horas <= 1000) || !fila.area_tematica || fila.agente_capacitador.length < 2 || fila.instructor.length < 3) { aviso('Faltan datos', 'Llena todos los campos.', 'er'); return; }
        try {
          var r = c ? await S.sb.from('dc3_cursos').update(fila).eq('id', c.id).select().single() : await S.sb.from('dc3_cursos').insert(fila).select().single();
          if (r.error) throw r.error;
          S.cursos = alfa(S.cursos.filter(function (x) { return x.id !== r.data.id; }).concat([r.data]), 'nombre');
          if (S.form.curso_id === r.data.id) tomarCurso();
          d.close(); aviso('Curso guardado', r.data.nombre, 'ok'); pintar();
        } catch (e) { aviso('No se guardó', /duplicate|unique/i.test(e.message || '') ? 'Ya existe un curso con ese nombre.' : errTxt(e), 'er'); }
      } }, 'Guardar')]);
  }
  function vEmpresas(main) {
    vCatalogo(main, { titulo: 'Empresas', nuevo: 'Nueva empresa', lista: function () { return S.empresas; },
      cols: [['Razón social', function (e) { return e.razon_social; }], ['RFC', function (e) { return e.rfc; }], ['Patrón o representante legal', function (e) { return e.patron_representante; }], ['Representante de los trabajadores', function (e) { return e.representante_trabajadores; }]],
      editar: editarEmpresa });
  }
  function editarEmpresa(e) {
    var iR = h('input', { value: e ? e.razon_social : '', maxlength: 200 }), iF = h('input', { value: e ? e.rfc || '' : '', maxlength: 15, class: 'mono' });
    var iP = h('input', { value: e ? e.patron_representante || '' : '', maxlength: 120 }), iT = h('input', { value: e ? e.representante_trabajadores || '' : '', maxlength: 120 });
    var iAct = h('input', { type: 'checkbox', checked: e ? e.activo : true });
    var d = dialogo(e ? 'Editar empresa' : 'Nueva empresa', h('div', { class: 'rejilla' }, campo('Razón social', iR), campo('RFC con homoclave', iF, '12 o 13 caracteres'),
      h('div', { class: 'rejilla r2' }, campo('Patrón o representante legal', iP), campo('Representante de los trabajadores', iT, 'si tiene más de 50')), h('label', { class: 'check' }, iAct, 'Activa')), [
      h('button', { class: 'btn suave', onclick: function () { d.close(); } }, 'Cancelar'),
      h('button', { class: 'btn azul', onclick: async function () {
        var rv = N.validarRfcEmpresa(iF.value);
        if (!rv.ok) { aviso('RFC inválido', rv.motivo, 'er'); return; }
        var fila = { razon_social: N.mayus(iR.value), rfc: rv.rfc || null, patron_representante: N.mayus(iP.value) || null, representante_trabajadores: N.mayus(iT.value) || null, activo: iAct.checked };
        if (fila.razon_social.length < 2) { aviso('Falta la razón social', null, 'er'); return; }
        try {
          var r = e ? await S.sb.from('dc3_empresas').update(fila).eq('id', e.id).select().single() : await S.sb.from('dc3_empresas').insert(fila).select().single();
          if (r.error) throw r.error;
          S.empresas = alfa(S.empresas.filter(function (x) { return x.id !== r.data.id; }).concat([r.data]), 'razon_social');
          if (S.form.empresa_id === r.data.id) tomarEmpresa();
          d.close(); aviso('Empresa guardada', r.data.razon_social, 'ok'); pintar();
        } catch (x) { aviso('No se guardó', /duplicate|unique/i.test(x.message || '') ? 'Ya existe una empresa con esa razón social.' : errTxt(x), 'er'); }
      } }, 'Guardar')]);
  }

  // ═════════════ HISTORIAL ═════════════
  function vHistorial(main) {
    var q = h('input', { type: 'search', placeholder: 'Buscar por folio, nombre, CURP o curso', maxlength: 60, value: S.histBuscar, 'aria-label': 'Buscar en el historial' });
    var cuerpo = h('div', null, h('div', { class: 'vacio-msg' }, h('div', { class: 'girando' })));
    var btnCsv = h('button', { class: 'btn suave', onclick: exportarCsv }, ico('bajar'), 'Exportar lista');
    main.appendChild(h('div', { class: 'panel' }, h('div', { class: 'panel-cab' }, h('h2', { text: 'Historial de constancias' }), btnCsv),
      h('div', { class: 'fila-acc', style: 'margin-bottom:12px' }, h('div', { class: 'buscar' }, ico('buscar', 16), q)), cuerpo));
    async function cargar() {
      var term = N.filtroSeguro(q.value); S.histBuscar = q.value;
      var cons = S.sb.from('dc3_constancias').select('*').order('emitida_en', { ascending: false }).limit(300);
      if (term) {
        var pat = '%' + term.replace(/ /g, '%') + '%';
        cons = cons.or(['folio', 'nombre', 'curp', 'curso', 'razon_social'].map(function (c) { return c + '.ilike.' + pat; }).join(','));
      }
      try { var r = await cons; if (r.error) throw r.error; S.hist = r.data || []; pintarH(); }
      catch (e) { vaciar(cuerpo); cuerpo.appendChild(h('div', { class: 'nota er', text: errTxt(e) })); }
    }
    function pintarH() {
      vaciar(cuerpo);
      if (!S.hist.length) { cuerpo.appendChild(h('div', { class: 'vacio-msg' }, h('b', { text: 'Sin constancias' }), 'Cuando emitas, aparecerán aquí con su folio.')); return; }
      var tb = h('tbody');
      S.hist.forEach(function (c) {
        tb.appendChild(h('tr', { style: c.anulada ? 'opacity:.6' : '' },
          h('td', { class: 'mono', text: c.folio }), h('td', null, h('b', { text: c.nombre }), h('div', { class: 'mono', style: 'font-size:12px;color:#5b6b82', text: c.curp })),
          h('td', null, c.curso, h('div', { style: 'font-size:12.5px;color:#5b6b82', text: c.razon_social })),
          h('td', { text: c.fecha_inicio === c.fecha_fin ? c.fecha_inicio : c.fecha_inicio + ' al ' + c.fecha_fin }),
          h('td', null, new Date(c.emitida_en).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }), h('div', { style: 'font-size:12px;color:#5b6b82', text: c.emitida_por })),
          h('td', null, c.anulada ? h('span', { class: 'etq er', text: 'Anulada', title: (c.motivo_anulacion || '') + ' — ' + (c.anulada_por || '') }) : h('span', { class: 'etq ok', text: 'Vigente' })),
          h('td', null, h('div', { class: 'fila-acc', style: 'flex-wrap:nowrap' },
            h('button', { class: 'btn chico suave', disabled: c.anulada, onclick: function () { redescargar(c, 'word'); } }, 'Word'),
            h('button', { class: 'btn chico suave', disabled: c.anulada, onclick: function () { redescargar(c, 'pdf'); } }, 'PDF'),
            S.rol === 'admin' && !c.anulada ? h('button', { class: 'btn chico peligro', onclick: function () { anular(c); } }, 'Anular') : null))));
      });
      cuerpo.appendChild(h('div', { class: 'tabla-c' }, h('table', null, h('thead', null, h('tr', null, ['Folio', 'Persona', 'Curso / empresa', 'Periodo', 'Emitida', 'Estado', ''].map(function (x) { return h('th', { text: x }); }))), tb)));
      if (S.hist.length >= 300) cuerpo.appendChild(h('p', { class: 'contador', text: 'Se muestran las 300 más recientes. Usa el buscador para encontrar otras.' }));
    }
    var tq; q.addEventListener('input', function () { clearTimeout(tq); tq = setTimeout(cargar, 300); });
    cargar();
  }
  function deFila(c) {
    return { folio: c.folio, nombre: c.nombre, curp: c.curp, puesto: c.puesto, ocupacion: c.ocupacion, razon_social: c.razon_social, rfc_empresa: c.rfc_empresa,
      curso: c.curso, horas: c.horas, area_tematica: c.area_tematica, agente_capacitador: c.agente_capacitador, instructor: c.instructor, patron: c.patron,
      representante_trab: c.representante_trab, fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin, firmas: c.firmas || {} };
  }
  async function redescargar(c, tipo) {
    var pr = progreso('Preparando ' + c.folio);
    var antes = S.formato;
    try { S.formato = tipo; await armarArchivos([deFila(c)], pr, 10); pr.cerrar(); }
    catch (e) { pr.cerrar(); aviso('No se pudo descargar', errTxt(e), 'er'); }
    finally { S.formato = antes; }
  }
  function anular(c) {
    var motivo = h('textarea', { rows: 3, maxlength: 300, style: 'width:100%;border:1.5px solid #cdd7e4;border-radius:10px;padding:10px' });
    var d = dialogo('Anular ' + c.folio, [h('p', { style: 'margin:0 0 10px', text: c.nombre + ' · ' + c.curso + '. La constancia no se borra: queda marcada como anulada, con tu nombre y el motivo.' }), campo('Motivo', motivo)], [
      h('button', { class: 'btn suave', onclick: function () { d.close(); } }, 'Cancelar'),
      h('button', { class: 'btn peligro', onclick: async function () {
        if (N.limpiar(motivo.value).length < 5) { aviso('Escribe el motivo', 'Al menos 5 letras.', 'er'); return; }
        var r = await S.sb.rpc('dc3_anular', { p_id: c.id, p_motivo: N.recortar(motivo.value, 300) });
        if (r.error) { aviso('No se anuló', errTxt(r.error), 'er'); return; }
        d.close(); aviso('Constancia anulada', c.folio, 'ok'); pintar();
      } }, 'Anular constancia')]);
  }
  function exportarCsv() {
    if (!S.hist.length) { aviso('No hay nada que exportar', null); return; }
    var cols = ['folio', 'nombre', 'curp', 'puesto', 'ocupacion', 'curso', 'horas', 'area_tematica', 'razon_social', 'fecha_inicio', 'fecha_fin', 'instructor', 'emitida_por', 'emitida_en', 'anulada', 'motivo_anulacion'];
    var txt = '\uFEFF' + cols.join(',') + '\r\n' + S.hist.map(function (c) { return cols.map(function (k) { return N.csvCelda(c[k]); }).join(','); }).join('\r\n');
    descargar(new Blob([txt], { type: 'text/csv;charset=utf-8' }), 'historial_DC3_' + hoyISO() + '.csv');
  }

  // ═════════════ AJUSTES (solo administradores) ═════════════
  function vAjustes(main) {
    var cuerpoP = h('div'), cuerpoT = h('div');
    main.appendChild(h('div', { class: 'rejilla', style: 'gap:18px' },
      h('div', { class: 'panel' }, h('div', { class: 'panel-cab' }, h('h2', { text: 'Plantilla del DC-3' })), cuerpoT),
      h('div', { class: 'panel' }, h('div', { class: 'panel-cab' }, h('h2', { text: 'Quién puede usar DC-3' })), cuerpoP)));
    // plantilla
    var arch = h('input', { type: 'file', accept: '.docx' });
    cuerpoT.appendChild(h('p', { style: 'margin:0 0 12px;color:#5b6b82', text: 'La plantilla (con logo y firmas escaneadas) se guarda en un espacio privado: solo la descargan quienes tienen acceso a DC-3. Nunca la subas al repositorio de GitHub.' }));
    cuerpoT.appendChild(h('div', { class: 'fila-acc' }, campo('Subir plantilla nueva (.docx)', arch),
      h('button', { class: 'btn suave', onclick: async function () { try { var b = await plantilla(); descargar(new Blob([b]), 'dc3-plantilla.docx'); } catch (e) { aviso('No hay plantilla', errTxt(e), 'er'); } } }, ico('bajar'), 'Descargar la actual')));
    arch.addEventListener('change', async function () {
      var f = arch.files[0]; if (!f) return;
      try {
        if (!/\.docx$/i.test(f.name) || f.size > 5 * 1024 * 1024) throw new Error('Debe ser un Word .docx de máximo 5 MB');
        var bytes = new Uint8Array(await f.arrayBuffer());
        if (!(bytes[0] === 0x50 && bytes[1] === 0x4B)) throw new Error('El archivo no es un Word real');
        var z = await window.JSZip.loadAsync(bytes);
        var x = z.file('word/document.xml'); if (!x) throw new Error('El archivo no es un Word válido');
        var xml = await x.async('string');
        var faltan = ['{{NOMBRE}}', '{{C1}}', '{{C18}}', '{{CURSO}}', '{{HORAS}}', '{{I1}}', '{{F8}}', '{{R1}}', '{{INSTRUCTOR}}', '{{PATRON}}'].filter(function (m) { return xml.indexOf(m) < 0; });
        if (faltan.length) throw new Error('A la plantilla le faltan marcadores: ' + faltan.join(', '));
        if (z.file('word/vbaProject.bin')) throw new Error('La plantilla trae macros: no se acepta');
        if (!(await confirmar('Reemplazar plantilla', 'Todas las constancias nuevas usarán este archivo. ¿Continuar?', 'Sí, reemplazar'))) return;
        var r = await S.sb.storage.from(BUCKET).upload(RUTA_PLANTILLA, new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), { upsert: true, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', cacheControl: '0' });
        if (r.error) throw r.error;
        S.plantilla = null; S.recursos = null; S.errPlantilla = null;
        aviso('Plantilla actualizada', null, 'ok');
      } catch (e) { aviso('No se subió la plantilla', errTxt(e), 'er'); }
      arch.value = '';
    });
    // permisos
    async function cargarP() {
      vaciar(cuerpoP);
      var r = await S.sb.from('dc3_permisos').select('*').order('email');
      if (r.error) { cuerpoP.appendChild(h('div', { class: 'nota er', text: errTxt(r.error) })); return; }
      var nuevo = h('input', { type: 'email', placeholder: 'correo@tecnocontrol.com.mx', maxlength: 120, autocomplete: 'off' });
      var nrol = h('select', null, opciones([['editor', 'Puede generar'], ['lector', 'Solo consulta'], ['admin', 'Administrador']], 'editor'));
      cuerpoP.appendChild(h('div', { class: 'fila-acc', style: 'margin-bottom:12px' }, h('div', { style: 'flex:1;min-width:220px' }, campo('Correo', nuevo)), campo('Permiso', nrol),
        h('button', { class: 'btn azul', style: 'align-self:end', onclick: async function () {
          var em = N.limpiar(nuevo.value).toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { aviso('Correo inválido', null, 'er'); return; }
          var x = await S.sb.from('dc3_permisos').upsert({ email: em, rol: nrol.value, activo: true, creado_por: S.correo }, { onConflict: 'email' });
          if (x.error) { aviso('No se guardó', errTxt(x.error), 'er'); return; }
          aviso('Acceso dado', em, 'ok'); cargarP();
        } }, ico('mas'), 'Dar acceso')));
      var tb = h('tbody');
      (r.data || []).forEach(function (p) {
        var s = h('select', { class: 'filtro', style: 'width:auto' }, opciones([['admin', 'Administrador'], ['editor', 'Puede generar'], ['lector', 'Solo consulta']], p.rol));
        var a = h('input', { type: 'checkbox', checked: p.activo });
        async function cambiar() {
          var x = await S.sb.from('dc3_permisos').update({ rol: s.value, activo: a.checked }).eq('email', p.email);
          if (x.error) { aviso('No se cambió', /administrador/i.test(x.error.message || '') ? 'Debe quedar al menos un administrador.' : errTxt(x.error), 'er'); cargarP(); return; }
          aviso('Permiso actualizado', p.email, 'ok');
        }
        s.addEventListener('change', cambiar); a.addEventListener('change', cambiar);
        tb.appendChild(h('tr', null, h('td', { text: p.email }), h('td', null, s), h('td', null, h('label', { class: 'check' }, a, 'Activo'))));
      });
      cuerpoP.appendChild(h('div', { class: 'tabla-c' }, h('table', null, h('thead', null, h('tr', null, h('th', { text: 'Correo' }), h('th', { text: 'Permiso' }), h('th', { text: 'Estado' }))), tb)));
    }
    cargarP();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
