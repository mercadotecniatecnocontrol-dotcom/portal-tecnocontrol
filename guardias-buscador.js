// ═════════════════════════════════════════════════════════════════
//  guardias-buscador.js — Portal Operativo Tecnocontrol  (21-nov-2026)
// ═════════════════════════════════════════════════════════════════
//  Buscador de folios para Operaciones → Guardias.
//  Sirve para cargar a una guardia los folios que el sistema no acomodó solo
//  (p. ej. folios de guardia que el técnico subió a la app días después).
//
//  Qué hace al "Asignar a guardia":
//   · Marca el folio como guardia (guardiaManual = true).
//   · Guarda la FECHA REAL en que se atendió (fechaEjecucion) → con eso
//     operaciones.js lo acomoda en el día y la semana de guardia correctos.
//   · Si ese día la guardia la tenía otra persona, registra que la persona
//     elegida CUBRIÓ ese día (coberturas del calendario de guardias), con confirmación.
//   · Deja historial: campo guardiaAsignacion + comentario en el folio.
//   · Avisa si la guardia de esa semana ya está aprobada/pagada (para no pagar doble)
//     y si el folio ya estaba cargado a otra guardia.
//  "Quitar de guardia" lo regresa a "No es guardia" con historial.
//
//  No toca variables de operaciones.js: lee/escribe en Supabase (ops_docs) por el
//  mismo puente window.tcOpsFS. El botón aparece junto a "+ Asignar guardia",
//  que solo ven quienes pueden gestionar Operaciones.
// ═════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.tcGdBuscador) return;

  var PLAZAS = ['Chihuahua', 'Juárez', 'Parral', 'Monterrey'];
  var TURNO_INI = 8, TURNO_FIN = 17;
  var POR_PAG = 50;
  var S = { folios: [], tecs: [], guardias: [], sel: {}, q: '', desde: '', hasta: '', soloGuardia: false, pag: 0, cargando: false };

  // ───────── utilidades ─────────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function plazaTxt(p) { var x = norm(p); return /juarez/.test(x) ? 'Juárez' : /parral/.test(x) ? 'Parral' : /monterrey/.test(x) ? 'Monterrey' : 'Chihuahua'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function local16(d) { return iso(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function aFecha(v) { if (!v) return null; var s = String(v); var d = new Date(s.length > 10 ? s : s + 'T12:00:00'); return isNaN(d) ? null : d; }
  function sumarDias(dia, n) { var d = new Date(dia + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function lunesDe(dia) { var d = new Date(dia + 'T12:00:00'); var w = d.getDay(); d.setDate(d.getDate() - (w === 0 ? 6 : w - 1)); return iso(d); }
  // Igual que operaciones.js: antes de las 8 a. m. cuenta como la noche anterior;
  // la semana de guardia va de viernes a jueves y se nombra por su lunes.
  function diaGuardia(d) { var x = new Date(d.getTime()); if (x.getHours() < TURNO_INI) x.setDate(x.getDate() - 1); return iso(x); }
  function semDeDia(dia) { return lunesDe(sumarDias(dia, 3)); }
  function fCorta(dia) { var d = new Date(dia + 'T12:00:00'); return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }); }
  function fHora(v) { var d = aFecha(v); return d ? d.toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'; }
  function semTxt(sem) { return fCorta(sumarDias(sem, -3)) + ' al ' + fCorta(sumarDias(sem, 3)); }
  function correo() { return (window.auth && window.auth.currentUser && window.auth.currentUser.email) || 'desconocido'; }
  function nombreYo() { var u = window.auth && window.auth.currentUser; var c = correo(); var t = S.tecs.find(function (x) { return norm(x.correo) === norm(c); }); return (t && t.nombre) || (u && u.displayName) || c; }
  function tec(id) { return S.tecs.find(function (t) { return t.id === id; }) || null; }
  function nomTec(id) { var t = tec(id); return t ? t.nombre : (id ? 'Técnico sin ficha' : 'Nadie'); }
  function tipoG(g) { return g && g.tipo === 'administrativa' ? 'administrativa' : 'tecnica'; }
  function guardiaDe(sem, plaza) { return S.guardias.find(function (g) { return g.semanaInicio === sem && tipoG(g) === 'tecnica' && plazaTxt(g.plaza) === plaza; }) || null; }
  function tecDelDia(g, dia) { return g ? ((g.coberturas || {})[dia] || g.tecnicoId || null) : null; }
  function evid(f) { return (Number(f.evidenciasFotos) || 0) + (Number(f.evidenciasDocumentos) || 0) + (Number(f.evidenciasVideos) || 0); }
  function atendio(f, tecId) {
    if (!tecId) return false;
    if ((f.tecnicosAsignadosIds || []).indexOf(tecId) >= 0 || f.tecnicoResponsableId === tecId) return true;
    var n = norm(nomTec(tecId)); if (!n) return false;
    var ns = [f.tecnicoResponsableNombre, f.completadoPor].concat(f.tecnicosAsignadosNombres || []).filter(Boolean).map(norm);
    // también nombre invertido ("Guerrero Gómez Jorge" vs "Jorge Guerrero Gómez")
    var partes = n.split(/\s+/).sort().join(' ');
    return ns.some(function (x) { return x === n || x.indexOf(n) >= 0 || n.indexOf(x) >= 0 || x.split(/\s+/).sort().join(' ') === partes; });
  }
  function refFolio(f) {
    var ej = f.fechaEjecucion && f.fechaEjecucion.por && f.fechaEjecucion.inicio;
    return aFecha(ej || f.fechaSolicitud);
  }
  function quienAtendio(f) { return f.tecnicoResponsableNombre || (f.tecnicosAsignadosNombres || [])[0] || f.completadoPor || ''; }
  function icono(p) { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;">' + p + '</svg>'; }
  var IC = {
    buscar: icono('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
    cerrar: icono('<path d="M18 6 6 18M6 6l12 12"/>'),
    alerta: icono('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>')
  };

  // ───────── datos (Supabase, tabla ops_docs) ─────────
  async function sb() { if (!window.tcSupabase) throw new Error('No cargó Supabase.'); return window.tcSupabase; }
  async function leerTodo(coleccion, campos, filtro) {
    var c = await sb(), out = [], desde = 0;
    for (;;) {
      var q = c.from('ops_docs').select(campos).eq('coleccion', coleccion);
      if (filtro) q = filtro(q);
      var r = await q.range(desde, desde + 999);
      if (r.error) throw r.error;
      out = out.concat(r.data || []);
      if (!r.data || r.data.length < 1000) break;
      desde += 1000;
    }
    return out;
  }
  var CAMPOS_FOLIO = ['doc_id', 'folioOS:datos->>folioOS', 'folioClienteId:datos->>folioClienteId', 'estacion:datos->>estacion', 'estacionNombre:datos->>estacionNombre',
    'cliente:datos->>clienteNombre', 'fechaSolicitud:datos->>fechaSolicitud', 'fechaEjecucion:datos->fechaEjecucion', 'guardiaManual:datos->guardiaManual',
    'guardiaAsignacion:datos->guardiaAsignacion', 'noProgramado:datos->noProgramado', 'categoriaServicio:datos->>categoriaServicio', 'cancelado:datos->cancelado',
    'tecnicoResponsableId:datos->>tecnicoResponsableId', 'tecnicoResponsableNombre:datos->>tecnicoResponsableNombre', 'tecnicosAsignadosIds:datos->tecnicosAsignadosIds',
    'tecnicosAsignadosNombres:datos->tecnicosAsignadosNombres', 'completadoPor:datos->>completadoPor', 'estatus:datos->>estatus',
    'evidenciasFotos:datos->evidenciasFotos', 'evidenciasDocumentos:datos->evidenciasDocumentos', 'evidenciasVideos:datos->evidenciasVideos'].join(',');
  async function cargar() {
    S.cargando = true; pintar();
    try {
      var desde = S.desde, hasta = S.hasta;
      var res = await Promise.all([
        leerTodo('ops_folios', CAMPOS_FOLIO, function (q) { q = q.gte('datos->>fechaSolicitud', desde); return q.lte('datos->>fechaSolicitud', hasta + 'T23:59:59.999Z'); }),
        leerTodo('ops_tecnicos', 'doc_id,datos'),
        leerTodo('ops_guardias_programadas', 'doc_id,datos')
      ]);
      S.folios = res[0].map(function (r) { var f = Object.assign({}, r); f.id = r.doc_id; return f; }).filter(function (f) { return f.cancelado !== true; })
        .sort(function (a, b) { return String(b.fechaSolicitud || '').localeCompare(String(a.fechaSolicitud || '')); });
      S.tecs = res[1].map(function (r) { return Object.assign({ id: r.doc_id }, r.datos); }).filter(function (t) { return t.nombre && t.activo !== false; })
        .sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
      S.guardias = res[2].map(function (r) { return Object.assign({ id: r.doc_id }, r.datos); });
    } catch (e) { alert('No se pudieron cargar los folios: ' + (e.message || e)); }
    S.cargando = false; S.pag = 0; pintar();
  }

  // ───────── estado de guardia de cada folio (solo informativo) ─────────
  function estadoGuardia(f) {
    var d = refFolio(f);
    if (f.guardiaManual === false) return { k: 'no', t: 'Quitado de guardia', c: '#475569', bg: '#f1f5f9' };
    var marcado = f.guardiaManual === true || (f.noProgramado && /^guardia$/i.test(String(f.categoriaServicio || '').trim()));
    if (!marcado) return { k: 'auto', t: 'El sistema decide', c: '#1D2E73', bg: '#e0e7ff' };
    if (!d) return { k: 'sinfecha', t: 'Guardia sin fecha', c: '#b45309', bg: '#fef3c7' };
    var dia = diaGuardia(d), sem = semDeDia(dia);
    var ga = f.guardiaAsignacion;
    var plaza = ga && ga.plaza ? ga.plaza : null;
    var cubre = null;
    PLAZAS.forEach(function (p) { if (cubre) return; var g = guardiaDe(sem, p); var t = tecDelDia(g, dia); if (t && atendio(f, t)) cubre = { p: p, t: t }; });
    if (cubre) return { k: 'ok', t: 'Guardia ' + cubre.p + ' · ' + nomTec(cubre.t).split(' ')[0] + ' · ' + fCorta(dia), c: '#15803d', bg: '#dcfce7' };
    return { k: 'fuera', t: 'Guardia sin dueño · ' + fCorta(dia) + (plaza ? ' (' + plaza + ')' : ''), c: '#b91c1c', bg: '#fee2e2' };
  }

  // ───────── pantalla principal ─────────
  function filtrados() {
    var q = norm(S.q);
    return S.folios.filter(function (f) {
      if (S.soloGuardia) { var e = estadoGuardia(f); if (e.k === 'auto' || e.k === 'no') return false; }
      if (!q) return true;
      var txt = norm([f.folioOS, f.folioClienteId, f.estacion, f.estacionNombre, f.cliente, f.tecnicoResponsableNombre, f.completadoPor].concat(f.tecnicosAsignadosNombres || []).join(' '));
      return q.split(/\s+/).every(function (p) { return txt.indexOf(p) >= 0; });
    });
  }
  function btn(onclick, txt, bg, color, extra) { return '<button onclick="' + onclick + '" style="border:1.5px solid ' + (bg === '#fff' ? '#cbd5e1' : bg) + ';background:' + bg + ';color:' + color + ';border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:800;cursor:pointer;' + (extra || '') + '">' + txt + '</button>'; }
  function pintar() {
    var w = document.getElementById('tc-gdb-wrap'); if (!w) return;
    var lista = filtrados(), nSel = Object.keys(S.sel).length;
    var total = lista.length, paginas = Math.max(1, Math.ceil(total / POR_PAG));
    if (S.pag >= paginas) S.pag = paginas - 1;
    var pag = lista.slice(S.pag * POR_PAG, S.pag * POR_PAG + POR_PAG);
    var cuerpo;
    if (S.cargando) {
      cuerpo = Array.from({ length: 6 }).map(function () { return '<div style="height:42px;border-radius:8px;background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9);margin-bottom:6px;"></div>'; }).join('');
    } else if (!total) {
      cuerpo = '<div style="text-align:center;padding:36px 10px;color:#64748b;"><div style="font-size:15px;font-weight:800;color:#334155;margin-bottom:4px;">No hay folios con esa búsqueda</div><div style="font-size:12.5px;">Prueba con otro número, otro técnico o amplía las fechas.</div></div>';
    } else {
      cuerpo = '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:12.5px;">' +
        '<thead><tr style="background:#f8fafc;color:#475569;text-align:left;">' +
        '<th style="padding:8px;width:28px;"><input type="checkbox" title="Seleccionar los de esta página" onchange="tcGdbSelPag(this.checked)"' + (pag.length && pag.every(function (f) { return S.sel[f.id]; }) ? ' checked' : '') + '></th>' +
        '<th style="padding:8px;">Folio / O.S.</th><th style="padding:8px;">Estación</th><th style="padding:8px;">Técnico</th><th style="padding:8px;">Se subió</th><th style="padding:8px;">Fecha real</th><th style="padding:8px;">Evid.</th><th style="padding:8px;">Guardia</th></tr></thead><tbody>' +
        pag.map(function (f) {
          var e = estadoGuardia(f), ej = f.fechaEjecucion && f.fechaEjecucion.inicio;
          return '<tr style="border-top:1px solid #f1f5f9;' + (S.sel[f.id] ? 'background:#eef2ff;' : '') + '">' +
            '<td style="padding:8px;"><input type="checkbox" onchange="tcGdbSel(\'' + esc(f.id) + '\',this.checked)"' + (S.sel[f.id] ? ' checked' : '') + '></td>' +
            '<td style="padding:8px;font-weight:800;color:#0f172a;">' + esc(f.folioOS || f.folioClienteId || 'Sin número') + (f.folioClienteId && String(f.folioOS || '').indexOf(f.folioClienteId) < 0 ? '<div style="font-size:11px;color:#64748b;font-weight:600;">Cliente: ' + esc(f.folioClienteId) + '</div>' : '') + '</td>' +
            '<td style="padding:8px;">' + esc(f.estacionNombre || f.estacion || '—') + '</td>' +
            '<td style="padding:8px;">' + esc(quienAtendio(f) || '—') + '</td>' +
            '<td style="padding:8px;white-space:nowrap;">' + esc(fHora(f.fechaSolicitud)) + '</td>' +
            '<td style="padding:8px;white-space:nowrap;">' + (ej ? esc(fHora(ej)) : '<span style="color:#94a3b8;">Sin capturar</span>') + '</td>' +
            '<td style="padding:8px;text-align:center;" title="Fotos, documentos y videos">' + evid(f) + '</td>' +
            '<td style="padding:8px;"><span title="' + esc(e.t) + '" style="display:inline-block;background:' + e.bg + ';color:' + e.c + ';border-radius:999px;padding:3px 9px;font-size:11px;font-weight:800;white-space:nowrap;">' + esc(e.t) + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (paginas > 1 ? '<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:10px;font-size:12px;">' +
          btn('tcGdbPag(-1)', 'Anterior', '#fff', '#334155', S.pag ? '' : 'opacity:.4;pointer-events:none;') +
          '<span>Página ' + (S.pag + 1) + ' de ' + paginas + '</span>' +
          btn('tcGdbPag(1)', 'Siguiente', '#fff', '#334155', S.pag < paginas - 1 ? '' : 'opacity:.4;pointer-events:none;') + '</div>' : '');
    }
    w.innerHTML = '<div style="position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:100001;display:flex;align-items:center;justify-content:center;padding:12px;">' +
      '<div style="background:#fff;border-radius:16px;width:1100px;max-width:98vw;max-height:94vh;display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="padding:14px 18px;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
        '<div><div style="font-size:18px;font-weight:900;color:#1D2E73;">Buscar folios y cargarlos a una guardia</div>' +
        '<div style="font-size:12px;color:#64748b;">1) Busca y marca los folios. 2) Da clic en «Asignar a guardia». 3) Elige a la persona y el día en que de verdad los atendió.</div></div>' +
        '<button onclick="tcGdbCerrar()" title="Cerrar" style="border:none;background:#f1f5f9;border-radius:8px;padding:6px;cursor:pointer;color:#334155;">' + IC.cerrar + '</button></div>' +
      '<div style="padding:12px 18px;display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;border-bottom:1px solid #f1f5f9;">' +
        '<label style="flex:1;min-width:220px;font-size:11.5px;font-weight:700;color:#334155;">Buscar (folio, O.S., técnico, estación)<div style="position:relative;margin-top:4px;"><span style="position:absolute;left:9px;top:8px;color:#94a3b8;">' + IC.buscar + '</span>' +
        '<input id="tc-gdb-q" value="' + esc(S.q) + '" oninput="tcGdbBuscar(this.value)" placeholder="Ej. 153585, OS 1347, Jorge Guerrero, Ponciano" style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:9px;padding:8px 8px 8px 30px;font-size:13px;"></div></label>' +
        '<label style="font-size:11.5px;font-weight:700;color:#334155;">Subidos desde<input type="date" value="' + esc(S.desde) + '" onchange="tcGdbFecha(\'desde\',this.value)" style="display:block;margin-top:4px;border:1px solid #cbd5e1;border-radius:9px;padding:7px;font-size:13px;"></label>' +
        '<label style="font-size:11.5px;font-weight:700;color:#334155;">hasta<input type="date" value="' + esc(S.hasta) + '" onchange="tcGdbFecha(\'hasta\',this.value)" style="display:block;margin-top:4px;border:1px solid #cbd5e1;border-radius:9px;padding:7px;font-size:13px;"></label>' +
        '<label title="Muestra solo los folios que ya están marcados como guardia" style="font-size:12px;font-weight:700;color:#334155;display:flex;align-items:center;gap:6px;padding-bottom:8px;"><input type="checkbox" onchange="tcGdbSoloG(this.checked)"' + (S.soloGuardia ? ' checked' : '') + '> Solo los marcados como guardia</label></div>' +
      '<div style="padding:12px 18px;overflow-y:auto;flex:1;">' + cuerpo + '</div>' +
      '<div style="padding:12px 18px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;background:#f8fafc;">' +
        '<div style="font-size:12.5px;color:#334155;"><b>' + nSel + '</b> folio(s) seleccionado(s) · ' + total + ' en la lista' + (nSel ? ' · <a href="#" onclick="event.preventDefault();tcGdbLimpiar()" style="color:#1D2E73;font-weight:700;">Quitar selección</a>' : '') + '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          btn('tcGdbQuitar()', 'Quitar de guardia', '#fff', '#b91c1c', nSel ? '' : 'opacity:.4;pointer-events:none;') +
          btn('tcGdbAsignarModal()', 'Asignar a guardia', '#E7402B', '#fff', nSel ? '' : 'opacity:.4;pointer-events:none;') + '</div></div>' +
      '</div></div>';
  }

  // ───────── ventana "Asignar a guardia" ─────────
  function seleccionados() { return S.folios.filter(function (f) { return S.sel[f.id]; }); }
  window.tcGdbAsignarModal = function () {
    var fs = seleccionados(); if (!fs.length) return;
    var t0 = fs[0].tecnicoResponsableId || (fs[0].tecnicosAsignadosIds || [])[0];
    var plaza0 = plazaTxt((tec(t0) || {}).plaza);
    var opcTec = S.tecs.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === t0 ? ' selected' : '') + '>' + esc(t.nombre) + (t.plaza ? ' (' + esc(plazaTxt(t.plaza)) + ')' : '') + '</option>'; }).join('');
    var w = document.getElementById('tc-gdb-wrap2'); if (!w) { w = document.createElement('div'); w.id = 'tc-gdb-wrap2'; document.body.appendChild(w); }
    w.innerHTML = '<div style="position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100003;display:flex;align-items:center;justify-content:center;padding:12px;">' +
      '<div style="background:#fff;border-radius:16px;width:720px;max-width:98vw;max-height:94vh;overflow-y:auto;padding:18px;">' +
      '<div style="font-size:17px;font-weight:900;color:#1D2E73;margin-bottom:2px;">Asignar ' + fs.length + ' folio(s) a guardia técnica</div>' +
      '<div style="font-size:12px;color:#64748b;margin-bottom:12px;">Pon el día y la hora en que <b>de verdad</b> se atendió cada folio. Con eso el folio cae en su día de guardia. Antes de las 8:00 a. m. cuenta como la noche anterior.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">' +
        '<label style="font-size:12px;font-weight:700;color:#334155;">Plaza de la guardia<select id="tc-gdb-plaza" onchange="tcGdbRevisar()" style="display:block;width:100%;margin-top:4px;border:1px solid #cbd5e1;border-radius:9px;padding:8px;font-size:13px;">' +
          PLAZAS.map(function (p) { return '<option' + (p === plaza0 ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select></label>' +
        '<label style="font-size:12px;font-weight:700;color:#334155;">Persona que estuvo de guardia<select id="tc-gdb-tec" onchange="tcGdbRevisar()" style="display:block;width:100%;margin-top:4px;border:1px solid #cbd5e1;border-radius:9px;padding:8px;font-size:13px;">' + opcTec + '</select></label></div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px;background:#f8fafc;border-radius:10px;padding:8px 10px;">' +
        '<label style="flex:1;font-size:12px;font-weight:700;color:#334155;">Misma fecha para todos (opcional)<input id="tc-gdb-todos" type="datetime-local" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #cbd5e1;border-radius:9px;padding:7px;font-size:13px;"></label>' +
        btn('tcGdbAplicarTodos()', 'Aplicar a todos', '#fff', '#1D2E73') + '</div>' +
      fs.map(function (f) {
        var ej = f.fechaEjecucion && f.fechaEjecucion.inicio ? String(f.fechaEjecucion.inicio).slice(0, 16) : '';
        return '<div style="border:1px solid #e2e8f0;border-radius:10px;padding:9px 10px;margin-bottom:7px;">' +
          '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center;">' +
          '<div><div style="font-weight:800;font-size:13px;color:#0f172a;">' + esc(f.folioOS || f.folioClienteId || 'Sin número') + '</div>' +
          '<div style="font-size:11.5px;color:#64748b;">' + esc(f.estacionNombre || f.estacion || '') + ' · ' + esc(quienAtendio(f)) + ' · se subió ' + esc(fHora(f.fechaSolicitud)) + ' · ' + evid(f) + ' evidencia(s)</div></div>' +
          '<input type="datetime-local" data-fid="' + esc(f.id) + '" class="tc-gdb-fecha" value="' + esc(ej) + '" oninput="tcGdbRevisar()" title="Día y hora en que se atendió" style="border:1px solid #cbd5e1;border-radius:9px;padding:7px;font-size:13px;"></div>' +
          '<div id="tc-gdb-msg-' + esc(f.id) + '" style="font-size:11.5px;margin-top:5px;"></div></div>';
      }).join('') +
      '<div id="tc-gdb-err" style="color:#b91c1c;font-size:12px;font-weight:700;min-height:16px;margin-top:6px;"></div>' +
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">' + btn('tcGdbCerrar2()', 'Cancelar', '#fff', '#334155') + btn('tcGdbGuardar()', 'Guardar asignación', '#1D2E73', '#fff') + '</div>' +
      '</div></div>';
    window.tcGdbRevisar();
  };
  window.tcGdbCerrar2 = function () { var w = document.getElementById('tc-gdb-wrap2'); if (w) w.innerHTML = ''; };
  window.tcGdbAplicarTodos = function () { var v = document.getElementById('tc-gdb-todos').value; if (!v) return; document.querySelectorAll('.tc-gdb-fecha').forEach(function (i) { i.value = v; }); window.tcGdbRevisar(); };

  // Revisa cada folio contra el calendario de guardias. Regresa el plan de guardado.
  function plan() {
    var plaza = document.getElementById('tc-gdb-plaza').value, persona = document.getElementById('tc-gdb-tec').value;
    return Array.prototype.map.call(document.querySelectorAll('.tc-gdb-fecha'), function (inp) {
      var f = S.folios.find(function (x) { return x.id === inp.dataset.fid; }), v = inp.value, r = { f: f, v: v, plaza: plaza, persona: persona, avisos: [], error: '' };
      if (!v) { r.error = 'Falta la fecha real.'; return r; }
      var d = aFecha(v); if (!d) { r.error = 'Fecha no válida.'; return r; }
      r.dia = diaGuardia(d); r.sem = semDeDia(r.dia); r.g = guardiaDe(r.sem, plaza);
      var wd = new Date(r.dia + 'T12:00:00').getDay(), h = d.getHours();
      if (wd !== 0 && wd !== 6 && h >= TURNO_INI && h < TURNO_FIN) r.avisos.push('Esa hora es horario de oficina (8:00 a 17:00); revisa que sea correcta.');
      if (!r.g) { r.error = 'No hay guardia técnica de ' + plaza + ' en la semana del ' + semTxt(r.sem) + '. Asígnala primero con «+ Asignar guardia».'; return r; }
      r.tecDia = tecDelDia(r.g, r.dia);
      if (r.tecDia !== persona) r.cobertura = true;
      if (!atendio(f, persona)) { r.error = nomTec(persona) + ' no aparece como técnico que atendió este folio, así que no se le puede pagar. Revisa el técnico del folio.'; return r; }
      var est = r.g.pago && r.g.pago.estado;
      if (est === 'pagado' || est === 'aprobado') r.avisos.push('La guardia de esa semana ya está ' + (est === 'pagado' ? 'PAGADA' : 'APROBADA') + '. Si sigues, revisa el pago para no pagar doble.');
      var ga = f.guardiaAsignacion;
      if (ga && ga.semana && (ga.semana !== r.sem || ga.plaza !== plaza || ga.tecnicoId !== persona)) r.avisos.push('Ya estaba cargado a la guardia de ' + (ga.plaza || '') + ' del ' + semTxt(ga.semana) + ' (' + nomTec(ga.tecnicoId) + '); se moverá aquí.');
      if (!evid(f)) r.avisos.push('No tiene evidencias: entre semana no se paga hasta que las tenga.');
      return r;
    });
  }
  window.tcGdbRevisar = function () {
    plan().forEach(function (r) {
      var el = document.getElementById('tc-gdb-msg-' + r.f.id); if (!el) return;
      if (r.error) { el.innerHTML = '<span style="color:#b91c1c;font-weight:700;">' + IC.alerta + ' ' + esc(r.error) + '</span>'; return; }
      if (!r.v) { el.innerHTML = ''; return; }
      var wd = new Date(r.dia + 'T12:00:00').getDay();
      var html = '<span style="color:#15803d;font-weight:700;">Cae en la guardia de ' + esc(r.plaza) + ' del ' + esc(fCorta(r.dia)) + ' (semana del ' + esc(semTxt(r.sem)) + ')' + (wd === 0 || wd === 6 ? ' · fin de semana: va incluido en el pago del día' : ' · entre semana: se paga por folio') + '.</span>';
      if (r.cobertura) html += '<div style="color:#b45309;font-weight:700;">Ese día la guardia la tenía ' + esc(nomTec(r.tecDia)) + '. Al guardar se registrará que ' + esc(nomTec(r.persona)) + ' cubrió ese día.</div>';
      r.avisos.forEach(function (a) { html += '<div style="color:#b45309;">' + IC.alerta + ' ' + esc(a) + '</div>'; });
      el.innerHTML = html;
    });
  };
  window.tcGdbGuardar = async function () {
    var P = plan(), err = document.getElementById('tc-gdb-err');
    var malos = P.filter(function (r) { return r.error; });
    if (malos.length) { err.textContent = 'Corrige los folios marcados en rojo (' + malos.length + ') antes de guardar.'; return; }
    var cob = {}; P.forEach(function (r) { if (r.cobertura) cob[r.g.id + '|' + r.dia] = r; });
    var cobs = Object.keys(cob).map(function (k) { return cob[k]; });
    var avisos = P.filter(function (r) { return r.avisos.length; });
    var txt = 'Se van a cargar ' + P.length + ' folio(s) a la guardia de ' + nomTec(P[0].persona) + ' (' + P[0].plaza + ').';
    if (cobs.length) txt += '\n\nTambién se registrará que cubrió: ' + cobs.map(function (r) { return fCorta(r.dia) + ' (en lugar de ' + nomTec(r.tecDia) + ')'; }).join(', ') + '. Esos días ya no se le pagan a la otra persona.';
    if (avisos.length) txt += '\n\nOjo: ' + avisos.length + ' folio(s) tienen avisos en amarillo.';
    if (!confirm(txt + '\n\n¿Continuar?')) return;
    err.textContent = 'Guardando…';
    try {
      var fs = await window.tcOpsFS(null), yo = nombreYo(), mail = correo(), ahora = new Date().toISOString();
      for (var i = 0; i < cobs.length; i++) {
        var r = cobs[i], c = Object.assign({}, r.g.coberturas || {}); c[r.dia] = r.persona;
        await fs.updateDoc(fs.doc(null, 'ops_guardias_programadas', r.g.id), { coberturas: c });
        r.g.coberturas = c;
      }
      for (var j = 0; j < P.length; j++) {
        var x = P[j], f = x.f, ini = x.v;
        var finViejo = f.fechaEjecucion && f.fechaEjecucion.fin && String(f.fechaEjecucion.fin) >= ini ? String(f.fechaEjecucion.fin).slice(0, 16) : local16(new Date(aFecha(ini).getTime() + 3600000));
        var fechaEjecucion = { inicio: ini, fin: finViejo, por: yo, en: ahora };
        var guardiaAsignacion = { tecnicoId: x.persona, tecnico: nomTec(x.persona), plaza: x.plaza, semana: x.sem, dia: x.dia, por: yo, porEmail: mail, en: ahora, desde: 'buscador' };
        await fs.updateDoc(fs.doc(null, 'ops_folios', f.id), { guardiaManual: true, fechaEjecucion: fechaEjecucion, guardiaAsignacion: guardiaAsignacion });
        Object.assign(f, { guardiaManual: true, fechaEjecucion: fechaEjecucion, guardiaAsignacion: guardiaAsignacion });
        fs.addDoc(fs.collection(null, 'ops_folios', f.id, 'comentarios'), { texto: '[Guardia] Se cargó a la guardia de ' + x.plaza + ' de ' + nomTec(x.persona) + ', día ' + fCorta(x.dia) + ' (atendido ' + ini.replace('T', ' ') + ').', autor: yo, autorEmail: mail, tipo: 'guardia', createdAt: ahora }).catch(function () {});
      }
      window.tcGdbCerrar2(); S.sel = {}; pintar();
      if (window.mostrarPush) window.mostrarPush('Guardias', P.length + ' folio(s) cargados a la guardia.', '');
      if (confirm('Listo: ' + P.length + ' folio(s) cargados.\n\nPara verlos en Guardias hay que recargar el portal. ¿Recargar ahora?')) location.reload();
    } catch (e) { err.textContent = 'No se pudo guardar: ' + (e.message || e); }
  };

  // ───────── quitar de guardia ─────────
  window.tcGdbQuitar = async function () {
    var fs_ = seleccionados(); if (!fs_.length) return;
    var motivo = prompt('¿Por qué se quitan ' + fs_.length + ' folio(s) de guardia? (queda en el historial)');
    if (motivo == null) return;
    try {
      var fs = await window.tcOpsFS(null), yo = nombreYo(), mail = correo(), ahora = new Date().toISOString();
      for (var i = 0; i < fs_.length; i++) {
        var f = fs_[i];
        await fs.updateDoc(fs.doc(null, 'ops_folios', f.id), { guardiaManual: false, guardiaAsignacion: null });
        f.guardiaManual = false; f.guardiaAsignacion = null;
        fs.addDoc(fs.collection(null, 'ops_folios', f.id, 'comentarios'), { texto: '[Guardia] Se quitó de guardia' + (motivo ? ': ' + motivo : '') + '.', autor: yo, autorEmail: mail, tipo: 'guardia', createdAt: ahora }).catch(function () {});
      }
      S.sel = {}; pintar();
      if (confirm('Listo: se quitaron de guardia.\n\n¿Recargar el portal para verlo en Guardias?')) location.reload();
    } catch (e) { alert('No se pudo guardar: ' + (e.message || e)); }
  };

  // ───────── controles ─────────
  var tBus = null;
  window.tcGdbBuscar = function (v) { S.q = v; S.pag = 0; clearTimeout(tBus); tBus = setTimeout(function () { pintar(); var i = document.getElementById('tc-gdb-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
  window.tcGdbFecha = function (k, v) { if (!v) return; S[k] = v; cargar(); };
  window.tcGdbSoloG = function (v) { S.soloGuardia = !!v; S.pag = 0; pintar(); };
  window.tcGdbSel = function (id, v) { if (v) S.sel[id] = true; else delete S.sel[id]; pintar(); };
  window.tcGdbSelPag = function (v) { var l = filtrados().slice(S.pag * POR_PAG, S.pag * POR_PAG + POR_PAG); l.forEach(function (f) { if (v) S.sel[f.id] = true; else delete S.sel[f.id]; }); pintar(); };
  window.tcGdbLimpiar = function () { S.sel = {}; pintar(); };
  window.tcGdbPag = function (n) { S.pag += n; pintar(); };
  window.tcGdbCerrar = function () { var w = document.getElementById('tc-gdb-wrap'); if (w) w.innerHTML = ''; window.tcGdbCerrar2(); };

  window.tcGdBuscador = function () {
    var w = document.getElementById('tc-gdb-wrap'); if (!w) { w = document.createElement('div'); w.id = 'tc-gdb-wrap'; document.body.appendChild(w); }
    var hoy = new Date(); S.hasta = iso(hoy); var d = new Date(); d.setDate(d.getDate() - 45); S.desde = iso(d);
    S.sel = {}; S.q = ''; S.pag = 0;
    cargar();
  };

  // ───────── botón junto a "+ Asignar guardia" (solo lo ven quienes gestionan) ─────────
  function ponerBoton() {
    var ancla = document.querySelector('button[onclick^="opsGdAsignarModal"]');
    if (!ancla || document.getElementById('tc-gdb-btn')) return;
    var b = document.createElement('button');
    b.id = 'tc-gdb-btn'; b.type = 'button'; b.title = 'Buscar folios y cargarlos a la guardia de alguien';
    b.innerHTML = IC.buscar + ' Buscar folios para guardia';
    b.style.cssText = 'border:1.5px solid #1D2E73;background:#fff;color:#1D2E73;border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:800;cursor:pointer;margin-right:6px;';
    b.onclick = window.tcGdBuscador;
    ancla.parentNode.insertBefore(b, ancla);
  }
  var tObs = null;
  new MutationObserver(function () { clearTimeout(tObs); tObs = setTimeout(ponerBoton, 120); }).observe(document.documentElement, { childList: true, subtree: true });
})();
