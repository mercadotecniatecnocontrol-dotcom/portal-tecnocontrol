/* ============================================================================
 * inventarios-3d.js · Vista 3D de un almacén físico — Departamento de Inventarios
 * ----------------------------------------------------------------------------
 * La carga inventarios.js solo cuando se abre una bodega física.
 * Expone: window.Inv3D.montar(contenedor, opciones) -> { destruir() }
 *
 * opciones = {
 *   almacen: { id, cve_alm, nombre },
 *   ubicaciones: [{ ubicacion, productos, unidades }]   // inv_ubicaciones_aspel (normalizadas)
 *   esAdmin: bool,
 *   onCelda: function(codigo)                           // abre la lista de productos
 * }
 *
 * La distribución (nave, racks, mezzanines, oficinas, zonas) se guarda en la tabla
 * inv_ubicaciones (tipo 'rack' o 'area'). Medidas en metros:
 *   x, y = centro (y = fondo de la nave) · ancho = largo · alto = fondo
 *   altura = alto real · elevacion = metros sobre el piso · rotacion en grados.
 * Si el almacén no tiene distribución guardada, se muestra una propuesta inicial
 * (en Fuerza Aérea se arma con los racks que aparecen en Aspel).
 * ============================================================================*/
(function () {
  'use strict';
  if (window.Inv3D) return;

  var NAVY = '#1D2E73', RED = '#E7402B';
  var URL_THREE = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var URL_ORBIT = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
  var COL = {
    fondo: 0xeef2f7, piso: 0xe2e8f0, muro: 0xf8fafc, poste: 0x1e293b, viga: 0xf59e0b,
    charola: 0xcbd5e1, conProd: 0xfbbf24, sel: 0x1d2e73, hover: 0x3b82f6, mezz: 0x94a3b8,
    madera: 0xc8a165, oficina: 0xffffff, puerta: 0x1d2e73
  };

  // ------------------------------------------------------------ carga de three.js
  var _cargando = null;
  function cargarScript(src) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { ok(); };
      s.onerror = function () { mal(new Error('No se pudo cargar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function cargarThree() {
    if (window.THREE && window.THREE.OrbitControls) return Promise.resolve(window.THREE);
    if (_cargando) return _cargando;
    _cargando = (window.THREE ? Promise.resolve() : cargarScript(URL_THREE))
      .then(function () { return window.THREE.OrbitControls ? null : cargarScript(URL_ORBIT); })
      .then(function () { return window.THREE; })
      .catch(function (e) { _cargando = null; throw e; });
    return _cargando;
  }

  // ------------------------------------------------------------ utilidades
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v, d) { v = Number(v); return isFinite(v) ? v : d; }
  function num(v) { return (Number(v) || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 }); }
  function letra(i) { return String.fromCharCode(64 + i); }          // 1 -> A
  function idxLetra(l) { return l ? l.toUpperCase().charCodeAt(0) - 64 : 0; }

  // Agrupa las ubicaciones de Aspel por rack / sección / nivel
  function estadisticas(ubicaciones) {
    var racks = {}, otros = [];
    (ubicaciones || []).forEach(function (u) {
      var m = /^([A-Z]+):R(\d+)S(\d+):N([A-Z])$/.exec(u.ubicacion || '');
      if (!m) { otros.push(u); return; }
      var key = m[1] + ':R' + Number(m[2]);
      var r = racks[key] || (racks[key] = { area: m[1], rack: Number(m[2]), maxS: 0, maxN: 0, productos: 0, celdas: {} });
      var s = Number(m[3]), nv = idxLetra(m[4]);
      r.maxS = Math.max(r.maxS, s); r.maxN = Math.max(r.maxN, nv);
      r.productos += Number(u.productos) || 0;
      r.celdas[s + '-' + nv] = { productos: Number(u.productos) || 0, unidades: Number(u.unidades) || 0, codigo: u.ubicacion };
    });
    return { racks: racks, otros: otros };
  }

  // ------------------------------------------------------------ propuesta inicial
  function propuestaInicial(alm, est) {
    var items = [];
    function area(o) { items.push(Object.assign({ tipo: 'area', rotacion: 0, elevacion: 0, meta: {} }, o)); }
    if (Number(alm.cve_alm) !== 1) {
      area({ codigo: 'NAVE', nombre: 'Nave', x: 15, y: 25, ancho: 30, alto: 50, altura: 7, meta: { forma: 'nave' } });
      area({ codigo: 'PUERTA-1', nombre: 'Entrada', x: 15, y: 0.3, ancho: 4, alto: 0.6, altura: 0.2, meta: { forma: 'puerta' } });
      return items;
    }
    // Fuerza Aérea — modelo del arquitecto (ALMACEN.pdf, ALMACEN_planta_baja.pdf y ALMACEN_3D.pdf):
    // nave en L de 34.25 m de frente, 33.60 m de fondo y muro oriente en diagonal (43.26 m abajo).
    // Niveles: 0 = planta baja · 1 = piso 2 (racks) a 3.40 m · 2 = mezzanine a 6.40 m. Alturas ajustables en el editor.
    var P = [[0, 0], [34.25, 0], [43.26, 33.6], [17.88, 33.6], [17.88, 16.8], [0, 16.8]];
    var E1 = 3.4, E2 = 6.4, P1 = E1 + 0.25;
    area({ codigo: 'NAVE', nombre: 'Nave Fuerza Aérea', x: 21.63, y: 16.8, ancho: 43.26, alto: 33.6, altura: 8, meta: { forma: 'nave', poligono: P } });
    // ---- Planta baja
    function pb(o) { o.meta = Object.assign({ nivel: 0 }, o.meta); area(o); }
    pb({ codigo: 'PUERTA-1', nombre: 'Andén', x: 0.3, y: 6, ancho: 4, alto: 0.6, altura: 0.2, rotacion: 90, meta: { forma: 'puerta' } });
    pb({ codigo: 'PB-1', nombre: 'Planta baja · cuarto 1', x: 5.9, y: 4.22, ancho: 11.79, alto: 8.43, altura: 0, meta: { forma: 'piso', color: '#dbeafe' } });
    pb({ codigo: 'PB-2', nombre: 'Planta baja · cuarto 2', x: 14.81, y: 4.22, ancho: 5.84, alto: 8.43, altura: 0, meta: { forma: 'piso', color: '#e0e7ff' } });
    pb({ codigo: 'PB-3', nombre: 'Planta baja · cuarto 3', x: 5.9, y: 12.67, ancho: 11.79, alto: 8.27, altura: 0, meta: { forma: 'piso', color: '#e0e7ff' } });
    pb({ codigo: 'PB-4', nombre: 'Planta baja · cuarto norte', x: 29.2, y: 1.97, ancho: 11.4, alto: 3.93, altura: 0, meta: { forma: 'piso', color: '#fef3c7' } });
    pb({ codigo: 'PB-5', nombre: 'Planta baja · cuarto sur', x: 36.6, y: 31.45, ancho: 10, alto: 4.2, altura: 0, meta: { forma: 'piso', color: '#fef3c7' } });
    pb({ codigo: 'ESC-1', nombre: 'Escalera a piso 2', x: 15.4, y: 16.15, ancho: 4.6, alto: 1.3, altura: E1, elevacion: 0, meta: { forma: 'escalera' } });
    // ---- Piso 2 (losa completa) y mezzanine
    area({ codigo: 'PISO-2', nombre: 'Piso 2', x: 0, y: 0, ancho: 43.26, alto: 33.6, altura: 0.25, elevacion: E1, meta: { forma: 'mezzanine', nivel: 1, poligono: P } });
    area({ codigo: 'ESC-2', nombre: 'Escalera a mezzanine', x: 38.7, y: 19.4, ancho: 2.6, alto: 1.2, altura: E2 - P1, elevacion: P1, rotacion: 90, meta: { forma: 'escalera', nivel: 1 } });
    area({ codigo: 'MEZZ-1', nombre: 'Mezzanine', x: 8.94, y: 8.4, ancho: 17.88, alto: 16.8, altura: 0.25, elevacion: E2, meta: { forma: 'mezzanine', nivel: 2 } });

    function rack(cod, x, y, rot, largo, fondo, S, N, h, elev, nivel) {
      var r = /^R\d+$/.test(cod) ? est.racks['A:' + cod] : null;
      items.push({ tipo: 'rack', codigo: cod, nombre: 'Rack ' + cod, x: x, y: y, rotacion: rot, ancho: largo, alto: fondo,
        secciones: Math.max(S, r ? r.maxS : 0), niveles: Math.max(N, r ? r.maxN : 0), altura: h, elevacion: elev, meta: { area: 'A', nivel: nivel } });
    }
    // Planta baja: 4 racks en el cuarto norte (R1–R4) y anaquel junto a la escalera
    rack('R1', 25.6, 0.9, 0, 2.4, 1.6, 1, 3, 2.5, 0, 0);
    rack('R2', 28.0, 0.9, 0, 2.4, 1.6, 1, 3, 2.5, 0, 0);
    rack('R3', 25.8, 4.9, 0, 2.4, 1.6, 1, 3, 2.5, 0, 0);
    rack('R4', 28.2, 4.9, 0, 2.4, 1.6, 1, 3, 2.5, 0, 0);
    rack('B9', 17.23, 11.7, 90, 4.93, 0.66, 2, 4, 2.2, 0, 0);
    // Piso 2: filas verticales (R5–R14), sencillas cafés y dobles blancas
    rack('R5', 18.55, 24.32, 90, 15.53, 0.93, 13, 4, 2.8, P1, 1);
    rack('R6', 20.91, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R7', 21.75, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R8', 24.42, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R9', 25.25, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R10', 27.88, 24.98, 90, 16.85, 0.97, 13, 4, 2.8, P1, 1);
    rack('R11', 30.42, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R12', 31.26, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R13', 33.9, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    rack('R14', 34.72, 25.06, 90, 17.0, 0.84, 7, 4, 2.8, P1, 1);
    // Piso 2: 5 filas largas dobles (R15–R24), 6 secciones de 2.44 m
    [0.08, 3.62, 6.48, 9.22, 12.0].forEach(function (y0, k) {
      rack('R' + (15 + k * 2), 26.84, y0 + 0.4, 0, 14.64, 0.8, 6, 4, 2.8, P1, 1);
      rack('R' + (16 + k * 2), 26.84, y0 + 1.2, 0, 14.64, 0.8, 6, 4, 2.8, P1, 1);
    });
    // Piso 2: 8 racks ligeros (cafés), bajo el mezzanine
    [4.93, 6.32, 7.71, 9.1, 10.44, 11.87, 13.22, 14.53].forEach(function (y, k) {
      rack('B' + (k + 1), 15.17, y, 0, 5.0, 0.65, 2, 4, 2.2, P1, 1);
    });
    return items;
  }

  // ------------------------------------------------------------ etiquetas
  function etiqueta(THREE, texto, sub, colorFondo) {
    var c = document.createElement('canvas'); c.width = 512; c.height = sub ? 200 : 140;
    var g = c.getContext('2d');
    g.fillStyle = colorFondo || NAVY;
    var r = 36, w = c.width, h = c.height;
    g.beginPath(); g.moveTo(r, 0); g.lineTo(w - r, 0); g.quadraticCurveTo(w, 0, w, r); g.lineTo(w, h - r);
    g.quadraticCurveTo(w, h, w - r, h); g.lineTo(r, h); g.quadraticCurveTo(0, h, 0, h - r); g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0); g.fill();
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 72px system-ui, -apple-system, Segoe UI, sans-serif';
    g.fillText(texto, w / 2, sub ? 70 : h / 2);
    if (sub) { g.font = '600 44px system-ui, -apple-system, Segoe UI, sans-serif'; g.fillText(sub, w / 2, 150); }
    var t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    sp.renderOrder = 10;
    sp.scale.set(2.6, 2.6 * c.height / c.width, 1);
    return sp;
  }

  // ------------------------------------------------------------ construcción de la escena
  function construir(THREE, items, est, op) {
    var raiz = new THREE.Group();
    var hits = [];              // objetos que se pueden tocar
    var nave = items.find(function (i) { return i.meta && i.meta.forma === 'nave'; }) || { ancho: 30, alto: 50, altura: 7 };
    var NW = n(nave.ancho, 30), ND = n(nave.alto, 50);
    var ox = -NW / 2, oz = -ND / 2;   // el centro de la nave queda en el origen
    var matCache = {};
    function mat(color, extra) {
      var k = color + JSON.stringify(extra || {});
      if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.8, metalness: 0.05 }, extra || {}));
      return matCache[k];
    }
    function caja(w, h, d, m) { var o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.castShadow = true; o.receiveShadow = true; return o; }

    // Piso y muros cortados (para ver adentro)
    var poli = nave.meta && Array.isArray(nave.meta.poligono) && nave.meta.poligono.length >= 3 ? nave.meta.poligono : null;
    var piso;
    if (poli) {
      var sh = new THREE.Shape();
      poli.forEach(function (p, k) { var px = ox + n(p[0], 0), pz = -(oz + n(p[1], 0)); if (k) sh.lineTo(px, pz); else sh.moveTo(px, pz); });
      piso = new THREE.Mesh(new THREE.ShapeGeometry(sh), mat(COL.piso));
    } else piso = new THREE.Mesh(new THREE.PlaneGeometry(NW, ND), mat(COL.piso));
    piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; raiz.add(piso);
    var grid = new THREE.GridHelper(Math.max(NW, ND), Math.round(Math.max(NW, ND) / 2), 0x94a3b8, 0xcbd5e1);
    grid.material.transparent = true; grid.material.opacity = 0.25; grid.position.y = 0.005;
    grid.scale.set(NW / Math.max(NW, ND), 1, ND / Math.max(NW, ND));
    raiz.add(grid);
    var hm = 1.4, gm = 0.25, mm = mat(COL.muro);
    if (poli) {
      for (var w = 0; w < poli.length; w++) {
        var p1 = poli[w], p2 = poli[(w + 1) % poli.length];
        var x1 = ox + n(p1[0], 0), z1 = oz + n(p1[1], 0), x2 = ox + n(p2[0], 0), z2 = oz + n(p2[1], 0);
        var lg = Math.hypot(x2 - x1, z2 - z1); if (lg < 0.01) continue;
        var mu = caja(lg + gm, hm, gm, mm);
        mu.position.set((x1 + x2) / 2, hm / 2, (z1 + z2) / 2);
        mu.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
        raiz.add(mu);
      }
    } else [[NW, ND / 2 + gm / 2, 0, 0], [NW, -ND / 2 - gm / 2, 0, 0], [ND + gm * 2, 0, NW / 2 + gm / 2, 1], [ND + gm * 2, 0, -NW / 2 - gm / 2, 1]].forEach(function (w) {
      var m = caja(w[3] ? gm : w[0], hm, w[3] ? w[0] : gm, mm);
      m.position.set(w[2], hm / 2, w[1]); raiz.add(m);
    });

    items.forEach(function (it, idx) {
      var g = new THREE.Group();
      var W = n(it.ancho, 1), D = n(it.alto, 1), H = n(it.altura, 0), E = n(it.elevacion, 0);
      g.position.set(ox + n(it.x, 0), 0, oz + n(it.y, 0));
      g.rotation.y = -n(it.rotacion, 0) * Math.PI / 180;
      g.userData = { item: idx };
      var forma = it.tipo === 'rack' ? 'rack' : ((it.meta && it.meta.forma) || 'piso');
      if (forma === 'nave') return;
      if (op.nivel != null && it.meta && it.meta.nivel != null && Number(it.meta.nivel) > op.nivel) return;

      if (forma === 'piso') {
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(new THREE.Color((it.meta && it.meta.color) || '#e0e7ff').getHex(), { transparent: true, opacity: 0.85 }));
        pl.rotation.x = -Math.PI / 2; pl.position.y = 0.02; pl.receiveShadow = true; g.add(pl);
        var lp = etiqueta(THREE, it.nombre || it.codigo, null, '#475569'); lp.position.set(0, 0.8, 0); lp.scale.multiplyScalar(1.2); g.add(lp);
        pl.userData = { item: idx }; hits.push(pl);
      } else if (forma === 'puerta') {
        var pu = caja(W, 0.12, Math.max(D, 0.4), mat(COL.puerta)); pu.position.y = 0.06; g.add(pu);
        var lpu = etiqueta(THREE, it.nombre || 'Puerta', null, NAVY); lpu.position.set(0, 1.4, 0); g.add(lpu);
        pu.userData = { item: idx }; hits.push(pu);
      } else if (forma === 'oficina') {
        var hO = H || 3;
        var of = caja(W, hO, D, mat(COL.oficina, { transparent: true, opacity: 0.92 })); of.position.y = E + hO / 2; g.add(of);
        var lo = etiqueta(THREE, it.nombre || 'Oficina', null, '#64748b'); lo.position.set(0, E + hO + 0.7, 0); g.add(lo);
        of.userData = { item: idx }; hits.push(of);
      } else if (forma === 'escalera') {
        var subir = H || 3, pasos = Math.max(6, Math.round(subir / 0.19)), lp2 = W / pasos, me = mat(0x64748b);
        for (var ps = 0; ps < pasos; ps++) {
          var hs = subir * (ps + 1) / pasos;
          var es = caja(lp2, 0.08, D, me); es.position.set(-W / 2 + (ps + 0.5) * lp2, E + hs - 0.04, 0); g.add(es);
          es.userData = { item: idx }; hits.push(es);
        }
        var le = etiqueta(THREE, it.nombre || 'Escalera', null, '#475569'); le.position.set(0, E + subir + 0.8, 0); le.scale.multiplyScalar(0.8); g.add(le);
      } else if (forma === 'mezzanine' && it.meta && Array.isArray(it.meta.poligono)) {
        var espP = H || 0.25, shp = new THREE.Shape(), cx2 = 0, cz2 = 0;
        it.meta.poligono.forEach(function (pt, k) { if (k) shp.lineTo(n(pt[0], 0), -n(pt[1], 0)); else shp.moveTo(n(pt[0], 0), -n(pt[1], 0)); cx2 += n(pt[0], 0); cz2 += n(pt[1], 0); });
        cx2 /= it.meta.poligono.length; cz2 /= it.meta.poligono.length;
        var losa = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: espP, bevelEnabled: false }),
          mat(COL.mezz, { transparent: true, opacity: op.ocultarMezz ? 0.1 : 0.45, depthWrite: false }));
        losa.rotation.x = -Math.PI / 2; losa.position.y = E; losa.receiveShadow = true; g.add(losa);
        var orilla = new THREE.LineSegments(new THREE.EdgesGeometry(losa.geometry), new THREE.LineBasicMaterial({ color: 0x334155 }));
        orilla.rotation.x = -Math.PI / 2; orilla.position.y = E; g.add(orilla);
        var lpz = etiqueta(THREE, it.nombre || 'Piso', 'a ' + E + ' m', '#334155'); lpz.position.set(cx2, E + 1.2, cz2); g.add(lpz);
        losa.userData = { item: idx }; hits.push(losa);
      } else if (forma === 'mezzanine') {
        var esp = H || 0.25, madera = it.meta && it.meta.madera;
        var pm = mat(madera ? COL.madera : COL.mezz, { transparent: true, opacity: op.ocultarMezz ? 0.12 : 0.55, depthWrite: false });
        var pla = caja(W, esp, D, pm); pla.position.y = E + esp / 2; pla.castShadow = !op.ocultarMezz; g.add(pla);
        var cols = Math.max(2, Math.round(W / 6) + 1), filas = Math.max(2, Math.round(D / 6) + 1);
        for (var a = 0; a < cols; a++) for (var b = 0; b < filas; b++) {
          var po = caja(0.18, E, 0.18, mat(madera ? 0x7c2d12 : 0x475569));
          po.position.set(-W / 2 + 0.2 + a * (W - 0.4) / (cols - 1), E / 2, -D / 2 + 0.2 + b * (D - 0.4) / (filas - 1));
          g.add(po);
        }
        var bar = mat(0xf59e0b);
        [[W, 0, -D / 2], [W, 0, D / 2]].forEach(function (r) { var rb = caja(r[0], 0.06, 0.06, bar); rb.position.set(0, E + esp + 1, r[2]); g.add(rb); });
        var lm = etiqueta(THREE, it.nombre || 'Mezzanine', 'a ' + E + ' m', madera ? '#92400e' : '#334155');
        lm.position.set(0, E + esp + 1.8, 0); g.add(lm);
        pla.userData = { item: idx }; hits.push(pla);
      } else if (forma === 'rack') {
        var S = Math.max(1, Math.round(n(it.secciones, 2))), N = Math.max(1, Math.round(n(it.niveles, 3)));
        var HR = H || 3, bw = W / S, lh = HR / N, base = E;
        var area = (it.meta && it.meta.area) || 'A';
        var esR = /^R\d+$/i.test(String(it.codigo || '').trim());
        var rnum = esR ? Number(String(it.codigo).replace(/\D/g, '')) : 0;
        var st = esR ? est.racks[area + ':R' + rnum] : null;
        var mPoste = mat(COL.poste), mViga = mat(COL.viga), mChar = mat(COL.charola);
        for (var s = 0; s <= S; s++) {
          [-D / 2 + 0.04, D / 2 - 0.04].forEach(function (z) {
            var up = caja(0.08, HR, 0.08, mPoste); up.position.set(-W / 2 + s * bw, base + HR / 2, z); g.add(up);
          });
        }
        for (var lv = 1; lv <= N; lv++) {
          var yb = base + (lv - 1) * lh + 0.1;
          [-D / 2 + 0.04, D / 2 - 0.04].forEach(function (z) {
            var vg = caja(W, 0.09, 0.06, mViga); vg.position.set(0, yb, z); g.add(vg);
          });
          var ch = caja(W - 0.02, 0.03, D - 0.1, mChar); ch.position.set(0, yb + 0.05, 0); ch.castShadow = false; g.add(ch);
          for (var sc = 1; sc <= S; sc++) {
            var cel = st && st.celdas[sc + '-' + lv];
            var cx = -W / 2 + (sc - 0.5) * bw;
            if (cel) {
              var hb = Math.min(lh * 0.62, 0.35 + cel.productos * 0.08);
              var bx = caja(bw * 0.78, hb, D * 0.72, mat(COL.conProd).clone());
              bx.position.set(cx, yb + 0.08 + hb / 2, 0);
              bx.userData = { item: idx, s: sc, n: lv, codigo: cel.codigo, celda: cel, caja: true };
              g.add(bx); hits.push(bx);
            }
            var hit = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.96, lh * 0.9, D), new THREE.MeshBasicMaterial({ visible: false }));
            hit.position.set(cx, yb + lh * 0.45, 0);
            hit.userData = { item: idx, s: sc, n: lv, codigo: area + ':R' + rnum + 'S' + sc + ':N' + letra(lv), celda: cel || null };
            g.add(hit); hits.push(hit);
          }
        }
        var lr = etiqueta(THREE, it.codigo || 'Rack', st ? st.productos + ' productos' : 'sin productos', st ? NAVY : '#94a3b8');
        lr.position.set(0, base + HR + 0.9, 0); g.add(lr);
      }
      raiz.add(g);
    });
    return { raiz: raiz, hits: hits, NW: NW, ND: ND };
  }

  // ------------------------------------------------------------ componente
  function montar(cont, opciones) {
    var op = Object.assign({ ocultarMezz: false }, opciones || {});
    var est = estadisticas(op.ubicaciones);
    var vivo = true, THREE = null, renderer, scene, camera, controls, escena = null, raf = 0, ro = null;
    var items = [], guardados = [], editando = false, seleccion = null, hover = null, arrastre = null, propuesta = false;

    cont.innerHTML =
      '<div class="i3d" style="position:relative;width:100%;height:min(70vh,620px);min-height:420px;border-radius:14px;overflow:hidden;background:#eef2f7;border:1px solid #e2e8f0">' +
        '<div class="i3d-canvas" style="position:absolute;inset:0"></div>' +
        '<div class="i3d-bar" style="position:absolute;top:10px;left:10px;right:10px;display:flex;gap:6px;flex-wrap:wrap;pointer-events:none"></div>' +
        '<div class="i3d-panel" style="position:absolute;top:58px;right:10px;width:min(340px,calc(100% - 20px));max-height:calc(100% - 120px);overflow:auto;background:#fff;border-radius:14px;box-shadow:0 10px 30px rgba(15,23,42,.18);display:none;font-size:13px"></div>' +
        '<div class="i3d-ley" style="position:absolute;left:10px;bottom:10px;background:rgba(255,255,255,.92);border-radius:12px;padding:8px 10px;font-size:11px;color:#334155;display:flex;gap:10px;flex-wrap:wrap;max-width:calc(100% - 20px)"></div>' +
        '<div class="i3d-msg" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:14px">Cargando vista 3D…</div>' +
      '</div>';
    var box = cont.querySelector('.i3d'), lienzo = cont.querySelector('.i3d-canvas'), barra = cont.querySelector('.i3d-bar'),
      panel = cont.querySelector('.i3d-panel'), ley = cont.querySelector('.i3d-ley'), msg = cont.querySelector('.i3d-msg');

    function boton(txt, tip, fn, activo) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = txt; b.title = tip; b.setAttribute('aria-label', tip);
      b.style.cssText = 'pointer-events:auto;padding:8px 12px;min-height:36px;border-radius:10px;font-weight:700;font-size:12px;font-family:inherit;cursor:pointer;border:1.5px solid ' + NAVY + ';' +
        (activo ? 'background:' + NAVY + ';color:#fff' : 'background:rgba(255,255,255,.95);color:' + NAVY);
      b.onclick = fn; barra.appendChild(b); return b;
    }
    function pintarBarra() {
      barra.innerHTML = '';
      if (!editando) {
        boton('Vista 3D', 'Ver el almacén en perspectiva', function () { vistaCam('3d'); });
        boton('Vista de planta', 'Ver el almacén desde arriba', function () { vistaCam('planta'); });
        boton(op.ocultarMezz ? 'Mostrar mezzanines' : 'Transparentar mezzanines', 'Ver lo que hay debajo de los mezzanines', function () { op.ocultarMezz = !op.ocultarMezz; reconstruir(); pintarBarra(); });
        boton('Pantalla completa', 'Ver el mapa en pantalla completa', pantallaCompleta);
        var niveles = {};
        items.forEach(function (i) { if (i.meta && i.meta.nivel != null) niveles[Number(i.meta.nivel)] = true; });
        var lista = Object.keys(niveles).map(Number).sort();
        if (lista.length > 1) {
          var nombres = { 0: 'Planta baja', 1: 'Piso 2', 2: 'Mezzanine' };
          boton('Todo', 'Ver todos los niveles', function () { op.nivel = null; reconstruir(); pintarBarra(); }, op.nivel == null);
          lista.forEach(function (nv) {
            boton(nombres[nv] || ('Nivel ' + nv), 'Ver hasta ' + (nombres[nv] || ('el nivel ' + nv)) + ' (oculta lo de arriba)', function () { op.nivel = nv; reconstruir(); pintarBarra(); }, op.nivel === nv);
          });
        }
        if (op.esAdmin) boton('Editar distribución', 'Mover racks y áreas a su lugar real y guardarlo', entrarEdicion);
      } else {
        boton('+ Rack', 'Agregar un rack', function () { agregar('rack'); }, true);
        boton('+ Zona de piso', 'Agregar una zona marcada en el piso', function () { agregar('piso'); });
        boton('+ Mezzanine', 'Agregar un mezzanine o planta alta', function () { agregar('mezzanine'); });
        boton('+ Oficina', 'Agregar una oficina o cuarto', function () { agregar('oficina'); });
        boton('+ Puerta', 'Agregar una puerta o andén', function () { agregar('puerta'); });
        boton('Tamaño de la nave', 'Cambiar largo y ancho de la nave', function () { var i = items.findIndex(function (x) { return x.meta && x.meta.forma === 'nave'; }); if (i >= 0) seleccionar(i); });
        boton('Guardar', 'Guardar la distribución en el portal', guardar, true);
        boton('Cancelar', 'Salir sin guardar', function () { salirEdicion(true); });
      }
    }
    function pintarLeyenda() {
      var sinRack = est.otros.filter(function (o) { return o.ubicacion !== 'SIN UBICACIÓN'; });
      var sinUb = est.otros.find(function (o) { return o.ubicacion === 'SIN UBICACIÓN'; });
      ley.innerHTML =
        '<span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#fbbf24;vertical-align:-1px"></i> Con productos (según Aspel)</span>' +
        '<span><i style="display:inline-block;width:11px;height:11px;border-radius:3px;background:#cbd5e1;vertical-align:-1px"></i> Charola vacía</span>' +
        (sinUb ? '<span>' + num(sinUb.productos) + ' productos sin ubicación en Aspel</span>' : '') +
        (sinRack.length ? '<span>' + sinRack.length + ' ubicaciones que no son de rack: ' + esc(sinRack.slice(0, 3).map(function (o) { return o.ubicacion; }).join(', ')) + (sinRack.length > 3 ? '…' : '') + '</span>' : '') +
        (propuesta ? '<span style="color:' + RED + ';font-weight:700">Distribución propuesta: ajústala con "Editar distribución"</span>' : '');
    }

    function vistaCam(tipo) {
      if (!camera || !escena) return;
      var m = Math.max(escena.NW, escena.ND);
      if (tipo === 'planta') { camera.position.set(0, m * 1.25, 0.01); }
      else { camera.position.set(-escena.NW * 0.9, m * 0.75, escena.ND * 0.85); }
      controls.target.set(0, 0, 0); controls.update();
    }
    function pantallaCompleta() {
      var el = box;
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    }

    function reconstruir() {
      if (!scene) return;
      if (escena) { scene.remove(escena.raiz); limpiar(escena.raiz); }
      escena = construir(THREE, items, est, op);
      scene.add(escena.raiz);
      marcarSeleccion();
    }
    function limpiar(obj) {
      obj.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); }); }
      });
    }

    // ---------- selección y panel
    function grupoDe(obj) { while (obj && !(obj.userData && obj.userData.item != null && obj.parent === escena.raiz)) obj = obj.parent; return obj; }
    function marcarSeleccion() {
      if (!escena) return;
      escena.raiz.children.forEach(function (g) {
        g.traverse(function (o) {
          if (o.userData && o.userData.caja && o.material && o.material.emissive) {
            var sel = seleccion && seleccion.item === g.userData.item;
            var celSel = sel && seleccion.s === o.userData.s && seleccion.n === o.userData.n;
            o.material.emissive.setHex(celSel ? 0x1d4ed8 : (sel ? 0x3b2f00 : 0x000000));
          }
        });
      });
    }
    function seleccionar(idx, s, nv) {
      seleccion = { item: idx, s: s || null, n: nv || null };
      marcarSeleccion();
      if (editando) panelEdicion(idx); else panelInfo(idx, s, nv);
    }
    function cerrarPanel() { panel.style.display = 'none'; seleccion = null; marcarSeleccion(); }
    function cabeceraPanel(titulo, sub) {
      return '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:12px 12px 6px">' +
        '<div><div style="font-weight:800;font-size:15px;color:' + NAVY + '">' + esc(titulo) + '</div>' + (sub ? '<div style="font-size:12px;color:#64748b">' + esc(sub) + '</div>' : '') + '</div>' +
        '<button type="button" class="i3d-x" aria-label="Cerrar" title="Cerrar" style="border:none;background:#f1f5f9;border-radius:9px;width:34px;height:34px;cursor:pointer;font-size:16px;color:#334155">&#x2715;</button></div>';
    }
    function panelInfo(idx, s, nv) {
      var it = items[idx]; if (!it) return;
      panel.style.display = 'block';
      if (it.tipo !== 'rack') {
        var fm = it.meta && it.meta.forma;
        panel.innerHTML = cabeceraPanel(it.nombre || it.codigo, fm === 'mezzanine' ? 'Losa a ' + it.elevacion + ' m de altura' : fm === 'escalera' ? 'Escalera' : 'Área del almacén') +
          '<div style="padding:0 12px 12px;color:#475569">Medidas: ' + num(it.ancho) + ' × ' + num(it.alto) + ' m.</div>';
        panel.querySelector('.i3d-x').onclick = cerrarPanel; return;
      }
      if (!/^R\d+$/i.test(String(it.codigo || '').trim())) {
        panel.innerHTML = cabeceraPanel(it.codigo + ' · ' + (it.nombre || ''), Math.round(n(it.secciones, 1)) + ' secciones × ' + Math.round(n(it.niveles, 1)) + ' niveles') +
          '<div style="padding:0 12px 12px;color:#475569">Este rack todavía no tiene código en Aspel. Cuando se le asigne uno (por ejemplo R25), cámbialo en "Editar distribución" para ver sus productos aquí.</div>';
        panel.querySelector('.i3d-x').onclick = cerrarPanel; return;
      }
      var area = (it.meta && it.meta.area) || 'A', rnum = Number(String(it.codigo).replace(/\D/g, '')) || 0;
      var st = est.racks[area + ':R' + rnum], S = Math.round(n(it.secciones, 2)), N = Math.round(n(it.niveles, 3));
      var h = cabeceraPanel(it.codigo + ' · ' + (it.nombre || ''), (st ? st.productos + ' productos registrados' : 'Sin productos registrados en Aspel') + ' · ' + S + ' secciones × ' + N + ' niveles') +
        '<div style="padding:0 12px 6px;font-size:12px;color:#475569">Toca un espacio para ver sus productos. El nivel A es el de abajo.</div>' +
        '<div style="padding:0 12px 12px;overflow-x:auto"><table style="border-collapse:separate;border-spacing:4px;width:100%"><tr><th></th>';
      for (var sc = 1; sc <= S; sc++) h += '<th style="font-size:11px;color:#64748b">S' + sc + '</th>';
      h += '</tr>';
      for (var lv = N; lv >= 1; lv--) {
        h += '<tr><th style="font-size:11px;color:#64748b;text-align:right">N' + letra(lv) + '</th>';
        for (var s2 = 1; s2 <= S; s2++) {
          var cel = st && st.celdas[s2 + '-' + lv], codigo = area + ':R' + rnum + 'S' + s2 + ':N' + letra(lv);
          var marcado = s === s2 && nv === lv;
          h += '<td><button type="button" data-cod="' + esc(codigo) + '" title="' + esc(codigo) + '" style="width:100%;min-width:52px;min-height:44px;border-radius:9px;cursor:pointer;font-weight:700;font-size:12px;font-family:inherit;border:2px solid ' + (marcado ? NAVY : 'transparent') + ';' +
            (cel ? 'background:#fef3c7;color:#92400e' : 'background:#f1f5f9;color:#94a3b8') + '">' + (cel ? cel.productos + '<div style="font-size:10px;font-weight:600">prod.</div>' : '—') + '</button></td>';
        }
        h += '</tr>';
      }
      h += '</table></div>';
      var extra = st ? Object.keys(st.celdas).filter(function (k) { var p = k.split('-'); return Number(p[0]) > S || Number(p[1]) > N; }) : [];
      if (extra.length) h += '<div style="padding:0 12px 12px;font-size:12px;color:' + RED + '">Aspel tiene productos en ' + extra.length + ' espacio(s) que este rack no tiene dibujados. Revisa sus secciones y niveles.</div>';
      panel.innerHTML = h;
      panel.querySelector('.i3d-x').onclick = cerrarPanel;
      panel.querySelectorAll('[data-cod]').forEach(function (b) { b.onclick = function () { if (op.onCelda) op.onCelda(b.getAttribute('data-cod')); }; });
    }

    // ---------- edición
    function campo(lbl, key, val, tipo, extra) {
      return '<label style="display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:700;color:#475569">' + esc(lbl) +
        '<input data-k="' + key + '" type="' + (tipo || 'number') + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') +
        ' style="padding:8px 10px;border:1.5px solid #cbd5e1;border-radius:9px;font-size:14px;font-family:inherit;min-height:38px;box-sizing:border-box;width:100%"></label>';
    }
    function panelEdicion(idx) {
      var it = items[idx]; if (!it) return;
      var forma = it.tipo === 'rack' ? 'rack' : (it.meta && it.meta.forma);
      panel.style.display = 'block';
      var h = cabeceraPanel('Editar ' + (forma === 'rack' ? 'rack' : forma === 'nave' ? 'nave' : 'área'), 'Arrastra en el mapa para moverlo o escribe las medidas en metros') +
        '<div style="padding:0 12px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      if (forma !== 'nave') h += campo('Código', 'codigo', it.codigo, 'text', forma === 'rack' ? 'placeholder="R13"' : '');
      if (forma !== 'rack') h += campo('Nombre', 'nombre', it.nombre, 'text');
      var conPoli = it.meta && it.meta.poligono;
      if (conPoli) h += '<div style="grid-column:1/-1;font-size:12px;color:#475569">La forma viene del plano del arquitecto. Mide ' + num(it.ancho) + ' × ' + num(it.alto) + ' m en su parte más amplia.</div>';
      else {
        h += campo(forma === 'nave' ? 'Ancho (m)' : 'Largo (m)', 'ancho', it.ancho, 'number', 'step="0.1" min="0.3"');
        h += campo(forma === 'nave' ? 'Largo (m)' : 'Fondo (m)', 'alto', it.alto, 'number', 'step="0.1" min="0.3"');
      }
      if (forma === 'rack' || forma === 'oficina') h += campo('Alto (m)', 'altura', it.altura, 'number', 'step="0.1" min="0.5"');
      if (forma === 'rack' || forma === 'mezzanine' || forma === 'oficina' || forma === 'escalera') h += campo('Elevación (m)', 'elevacion', it.elevacion, 'number', 'step="0.1" min="0"');
      if (forma !== 'nave') h += campo('Nivel (0 PB, 1 piso 2, 2 mezz.)', 'nivel', it.meta && it.meta.nivel != null ? it.meta.nivel : '', 'number', 'step="1" min="0" max="5"');
      if (forma === 'rack') { h += campo('Secciones', 'secciones', it.secciones, 'number', 'step="1" min="1" max="20"'); h += campo('Niveles', 'niveles', it.niveles, 'number', 'step="1" min="1" max="10"'); h += campo('Área Aspel', 'area', (it.meta && it.meta.area) || 'A', 'text'); }
      if (forma === 'piso') h += campo('Color', 'color', (it.meta && it.meta.color) || '#e0e7ff', 'color');
      if (forma !== 'nave' && !conPoli) { h += campo('Posición X (m)', 'x', it.x, 'number', 'step="0.25"'); h += campo('Posición Y (m)', 'y', it.y, 'number', 'step="0.25"'); }
      h += '</div><div style="padding:0 12px 12px;display:flex;gap:6px;flex-wrap:wrap">';
      if (forma !== 'nave') {
        h += '<button type="button" data-a="rot" style="' + estBtn() + '">Girar 90°</button>';
        h += '<button type="button" data-a="dup" style="' + estBtn() + '">Duplicar</button>';
        h += '<button type="button" data-a="del" style="' + estBtn(RED) + '">Quitar</button>';
      }
      h += '</div>';
      if (forma === 'rack') h += '<div style="padding:0 12px 12px;font-size:11px;color:#64748b">El código debe ser igual al de Aspel: R13 corresponde a A:R13S…:N…</div>';
      panel.innerHTML = h;
      panel.querySelector('.i3d-x').onclick = cerrarPanel;
      panel.querySelectorAll('input[data-k]').forEach(function (inp) {
        inp.onchange = function () {
          var k = inp.getAttribute('data-k'), v = inp.value;
          if (k === 'nivel') { it.meta = Object.assign({}, it.meta, { nivel: v === '' ? null : Math.max(0, Math.round(Number(v))) }); }
          else if (k === 'color' || k === 'area') { it.meta = Object.assign({}, it.meta, k === 'area' ? { area: v.toUpperCase().trim() || 'A' } : { color: v }); }
          else if (k === 'codigo') it.codigo = v.toUpperCase().trim();
          else if (k === 'nombre') it.nombre = v;
          else if (k === 'secciones' && it.tipo === 'rack') {
            var bahia = n(it.ancho, 2.4) / Math.max(1, n(it.secciones, 1));
            it.secciones = Math.max(1, Math.round(Number(v)) || 1);
            it.ancho = +(it.secciones * bahia).toFixed(2);
          }
          else it[k] = Number(v);
          reconstruir(); panelEdicion(idx);
        };
      });
      panel.querySelectorAll('[data-a]').forEach(function (b) {
        b.onclick = function () {
          var a = b.getAttribute('data-a');
          if (a === 'rot') { it.rotacion = (n(it.rotacion, 0) + 90) % 360; reconstruir(); }
          if (a === 'dup') { var c = JSON.parse(JSON.stringify(it)); delete c.id; c.codigo = siguienteCodigo(it.tipo === 'rack' ? 'R' : prefijo(it)); c.x = n(c.x, 0) + 1.5; c.y = n(c.y, 0) + 1.5; items.push(c); reconstruir(); seleccionar(items.length - 1); return; }
          if (a === 'del') { if (!confirm('¿Quitar ' + (it.codigo || 'este elemento') + ' del mapa?')) return; items.splice(idx, 1); cerrarPanel(); reconstruir(); return; }
          panelEdicion(idx);
        };
      });
    }
    function estBtn(c) { c = c || NAVY; return 'padding:8px 12px;min-height:36px;border-radius:9px;border:1.5px solid ' + c + ';background:#fff;color:' + c + ';font-weight:700;font-size:12px;font-family:inherit;cursor:pointer'; }
    function prefijo(it) { var f = it.meta && it.meta.forma; return f === 'mezzanine' ? 'MEZZ-' : f === 'oficina' ? 'OFI-' : f === 'puerta' ? 'PUERTA-' : 'ZONA-'; }
    function siguienteCodigo(pref) {
      var max = 0;
      items.forEach(function (i) { if (String(i.codigo || '').indexOf(pref) === 0) { var v = Number(String(i.codigo).slice(pref.length)) || 0; if (v > max) max = v; } });
      return pref + (max + 1);
    }
    function agregar(forma) {
      var nave = items.find(function (i) { return i.meta && i.meta.forma === 'nave'; }) || { ancho: 30, alto: 50 };
      var c = { x: +(nave.ancho / 2).toFixed(2), y: +(nave.alto / 2).toFixed(2), rotacion: 0, elevacion: 0, meta: {} };
      if (forma === 'rack') Object.assign(c, { tipo: 'rack', codigo: siguienteCodigo('R'), nombre: '', ancho: 4.8, alto: 1.1, altura: 3.5, secciones: 2, niveles: 4, meta: { area: 'A' } });
      else Object.assign(c, { tipo: 'area', ancho: forma === 'puerta' ? 4 : 6, alto: forma === 'puerta' ? 0.6 : 4, altura: forma === 'oficina' ? 3 : forma === 'mezzanine' ? 0.25 : 0,
        elevacion: forma === 'mezzanine' ? 3.2 : 0, nombre: forma === 'puerta' ? 'Puerta' : forma === 'oficina' ? 'Oficina' : forma === 'mezzanine' ? 'Mezzanine' : 'Zona', meta: { forma: forma } });
      if (c.tipo === 'area') c.codigo = siguienteCodigo(prefijo(c));
      items.push(c); reconstruir(); seleccionar(items.length - 1);
    }
    function entrarEdicion() { editando = true; cerrarPanel(); pintarBarra(); vistaCam('planta'); controls.enableRotate = false; }
    function salirEdicion(recargar) {
      editando = false; arrastre = null; cerrarPanel(); controls.enableRotate = true; pintarBarra();
      if (recargar) cargarDistribucion().then(function () { reconstruir(); pintarLeyenda(); vistaCam('3d'); });
    }

    async function guardar() {
      var sb = window.tcSupabase; if (!sb) { alert('No hay conexión con la base de datos.'); return; }
      var codigos = {}, dup = null;
      items.forEach(function (i) { var k = String(i.codigo || '').trim(); if (!k) dup = dup || '(sin código)'; if (codigos[k]) dup = dup || k; codigos[k] = true; });
      if (dup) { alert('Hay un código repetido o vacío: ' + dup + '. Cada rack y área necesita un código único.'); return; }
      var ahora = new Date().toISOString();
      var filas = items.map(function (i) {
        return {
          almacen_id: op.almacen.id, tipo: i.tipo === 'rack' ? 'rack' : 'area', codigo: String(i.codigo).trim(), nombre: i.nombre || null,
          x: n(i.x, 0), y: n(i.y, 0), ancho: n(i.ancho, 1), alto: n(i.alto, 1), altura: i.altura == null ? null : n(i.altura, 0),
          elevacion: n(i.elevacion, 0), rotacion: n(i.rotacion, 0), secciones: i.tipo === 'rack' ? Math.round(n(i.secciones, 1)) : null,
          niveles: i.tipo === 'rack' ? Math.round(n(i.niveles, 1)) : null, meta: i.meta || {}, activo: true, actualizado: ahora
        };
      });
      try {
        var r = await sb.from('inv_ubicaciones').upsert(filas, { onConflict: 'almacen_id,codigo' }).select('codigo');
        if (r.error) throw r.error;
        if (!r.data || r.data.length !== filas.length) throw new Error('No tienes permiso para guardar la distribución de este almacén.');
        var quitar = guardados.filter(function (g) { return !codigos[g.codigo]; }).map(function (g) { return g.codigo; });
        if (quitar.length) {
          var r2 = await sb.from('inv_ubicaciones').update({ activo: false, actualizado: ahora }).eq('almacen_id', op.almacen.id).in('codigo', quitar);
          if (r2.error) throw r2.error;
        }
        propuesta = false;
        alert('Distribución guardada.');
        salirEdicion(true);
      } catch (e) { alert('No se pudo guardar: ' + (e.message || e)); }
    }

    async function cargarDistribucion() {
      var sb = window.tcSupabase, filas = [];
      if (sb && op.almacen.id) {
        var r = await sb.from('inv_ubicaciones').select('*').eq('almacen_id', op.almacen.id).eq('activo', true).in('tipo', ['rack', 'area']);
        if (r.error) throw r.error;
        filas = r.data || [];
      }
      guardados = filas.map(function (f) { return { codigo: f.codigo }; });
      if (filas.length) {
        propuesta = false;
        items = filas.map(function (f) {
          return { id: f.id, tipo: f.tipo, codigo: f.codigo, nombre: f.nombre, x: n(f.x, 0), y: n(f.y, 0), ancho: n(f.ancho, 1), alto: n(f.alto, 1),
            altura: f.altura == null ? null : n(f.altura, 0), elevacion: n(f.elevacion, 0), rotacion: n(f.rotacion, 0),
            secciones: f.secciones, niveles: f.niveles, meta: f.meta || {} };
        });
        if (!items.some(function (i) { return i.meta && i.meta.forma === 'nave'; })) items.unshift({ tipo: 'area', codigo: 'NAVE', nombre: 'Nave', x: 15, y: 25, ancho: 30, alto: 50, altura: 7, rotacion: 0, elevacion: 0, meta: { forma: 'nave' } });
      } else {
        propuesta = true;
        items = propuestaInicial(op.almacen, est);
      }
    }

    // ---------- interacción con el mouse / dedo
    var ray, mouse, planoArrastre, pIni = null;
    function ponerMouse(ev) {
      var r = renderer.domElement.getBoundingClientRect();
      mouse.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, camera);
    }
    function tocado() { var hs = ray.intersectObjects(escena.hits, false); return hs.length ? hs[0] : null; }
    function onDown(ev) {
      pIni = { x: ev.clientX, y: ev.clientY };
      if (!editando) return;
      ponerMouse(ev);
      var h = tocado(); if (!h) return;
      var g = grupoDe(h.object); if (!g) return;
      var idx = g.userData.item, it = items[idx];
      if (it.meta && (it.meta.forma === 'nave' || it.meta.poligono)) return;
      planoArrastre.constant = 0;
      var p = new THREE.Vector3(); ray.ray.intersectPlane(planoArrastre, p);
      arrastre = { idx: idx, dx: g.position.x - p.x, dz: g.position.z - p.z, g: g };
      controls.enabled = false;
      seleccionar(idx);
    }
    function onMove(ev) {
      if (!escena) return;
      ponerMouse(ev);
      if (arrastre) {
        var p = new THREE.Vector3();
        if (!ray.ray.intersectPlane(planoArrastre, p)) return;
        var nx = Math.round((p.x + arrastre.dx) * 4) / 4, nz = Math.round((p.z + arrastre.dz) * 4) / 4;
        arrastre.g.position.x = nx; arrastre.g.position.z = nz;
        var it = items[arrastre.idx];
        it.x = +(nx + escena.NW / 2).toFixed(2); it.y = +(nz + escena.ND / 2).toFixed(2);
        return;
      }
      if (ev.pointerType === 'touch') return;
      var h = tocado();
      renderer.domElement.style.cursor = h ? 'pointer' : (editando ? 'default' : 'grab');
    }
    function onUp(ev) {
      if (arrastre) { arrastre = null; controls.enabled = true; if (seleccion) panelEdicion(seleccion.item); return; }
      if (!pIni || Math.abs(ev.clientX - pIni.x) + Math.abs(ev.clientY - pIni.y) > 6) return;
      ponerMouse(ev);
      var h = tocado();
      if (!h) { if (!editando) cerrarPanel(); return; }
      var g = grupoDe(h.object); if (!g) return;
      var u = h.object.userData || {};
      seleccionar(g.userData.item, u.s, u.n);
    }

    function animar() {
      if (!vivo) return;
      raf = requestAnimationFrame(animar);
      controls.update();
      renderer.render(scene, camera);
    }
    function ajustar() {
      if (!renderer) return;
      var w = lienzo.clientWidth || 600, h = lienzo.clientHeight || 420;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }

    cargarThree().then(function (T) {
      if (!vivo) return;
      THREE = T;
      return cargarDistribucion();
    }).then(function () {
      if (!vivo || !THREE) return;
      msg.style.display = 'none';
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
      lienzo.appendChild(renderer.domElement);
      scene = new THREE.Scene(); scene.background = new THREE.Color(COL.fondo);
      camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.85));
      var sol = new THREE.DirectionalLight(0xffffff, 0.75);
      sol.position.set(-30, 60, 25); sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      var sc = sol.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 200;
      scene.add(sol);
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 4; controls.maxDistance = 220;
      ray = new THREE.Raycaster(); mouse = new THREE.Vector2(); planoArrastre = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointermove', onMove);
      renderer.domElement.addEventListener('pointerup', onUp);
      reconstruir(); pintarBarra(); pintarLeyenda();
      ajustar(); vistaCam('3d');
      if (window.ResizeObserver) { ro = new ResizeObserver(ajustar); ro.observe(lienzo); } else window.addEventListener('resize', ajustar);
      animar();
    }).catch(function (e) {
      console.error('[inventarios-3d]', e);
      msg.innerHTML = '<div style="color:' + RED + ';padding:16px;text-align:center">No se pudo abrir la vista 3D: ' + esc(e.message || e) + '</div>';
    });

    return {
      destruir: function () {
        vivo = false; cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', ajustar);
        if (escena) limpiar(escena.raiz);
        if (renderer) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); }
        cont.innerHTML = '';
      }
    };
  }

  window.Inv3D = { montar: montar, _estadisticas: estadisticas, _propuesta: propuestaInicial, _construir: construir };
})();
