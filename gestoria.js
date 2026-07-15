// ══════════════════════════════════════════════════════════════
// GESTORÍA — módulo de departamento (Portal Tecnocontrol)
// ══════════════════════════════════════════════════════════════
// Archivo nombrado como el departamento (mismo patrón que rh.js,
// ventas.js, flotilla.js) porque Gestoría alojará más de un sistema:
//   - SASISOPA (implementado abajo)
//   - SGM — Sistema de Gestión de Medición (pendiente, sección propia)
// Cada sistema vive en su propia sub-sección dentro de este archivo,
// con su propia colección de Firestore y su propia carpeta de machotes,
// pero comparten el mismo punto de entrada window.cargarGestoria().
//
// Corre 100% en el navegador: no requiere backend ni Cloud Functions
// (compatible con GitHub Pages + Firestore plan Spark).
//
// Requiere que index.html haya cargado:
//   - window.db, window.auth (ya expuestos por el módulo principal)
//   - JSZip (https://cdnjs.cloudflare.com/ajax/libs/jszip/...)
//
// Los 91 machotes de SASISOPA viven en /sasisopa-machotes/ junto con
// un manifest.json que los lista (mismo patrón que manifest.json /
// manifest-flotilla.json ya usados en el portal).

(function () {

    // ── Secciones disponibles dentro de "Gestoría" ──────────────
    const SECCIONES_GESTORIA = [
        { id: 'sasisopa', titulo: 'SASISOPA', activa: true },
        { id: 'sgm', titulo: 'SGM (próximamente)', activa: false },
    ];
    let _seccionActual = 'sasisopa';

    const RUTA_MACHOTES = 'sasisopa-machotes/';
    const COLECCION = 'sasisopa_clientes';

    let _fsFns = null; // funciones de Firestore, cargadas por import() dinámico
    let _clienteActualId = null;
    let _clientesCache = [];

    async function fsFns() {
        if (_fsFns) return _fsFns;
        const mod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        _fsFns = mod;
        return mod;
    }

    // ── Catálogo de reemplazo (mismo que mapeo_valores.py) ──────
    const MAPEO = {
        "Superservicio Cuatro Caminos S.A. de C.V.": "RAZON_SOCIAL",
        "Superservicio Cuatro Caminos S.A de C.V.": "RAZON_SOCIAL",
        "Superservicio Cuatro Caminos S.A. De C.V.": "RAZON_SOCIAL",
        "Superservicio Cuatro Caminos S.A. de C.V.,": "RAZON_SOCIAL_COMA",
        "Superservicio Cuatro Caminos, S.A. de C.V.": "RAZON_SOCIAL_COMA2",
        "Superservico Cuatro Caminos S.A. de C.V.": "RAZON_SOCIAL",
        "SUPERSERVICIO CUATRO CAMINOS S.A DE C.V.": "RAZON_SOCIAL_MAYUS",
        "SUPERSERVICO CUATRO CAMINOS. S.A. DE C.V.": "RAZON_SOCIAL_MAYUS",
        "SCC940928636": "RFC",
        "KM. 13.5 CARRETERA PANAMERICANA S/N PUENTE ALTO, 32675, JUAREZ, CHIHUAHUA": "DOMICILIO_ESTACION",
        "Ciudad Juárez, Chihuahua": "CIUDAD_ESTADO",
        "PL/6125/EXP/ES/2015": "NUMERO_PERMISO",
        "Alta Dirección": "ROL_ALTA_DIRECCION",
        "Alta Dirección.": "ROL_ALTA_DIRECCION",
        "ALTA DIRECCIÓN": "ROL_ALTA_DIRECCION_MAYUS",
        "Representante Técnico": "ROL_REPRESENTANTE_TECNICO",
        "Supervisor de Estación": "ROL_SUPERVISOR_ESTACION",
        "SUPERVISOR DE ESTACIÓN": "ROL_SUPERVISOR_ESTACION_MAYUS",
        "Supervisor de Estación, Asistente Administrativo.": "ROL_SUPERVISOR_Y_ASISTENTE",
        "Despachador": "ROL_DESPACHADOR",
        "DESPACHADOR": "ROL_DESPACHADOR_MAYUS",
        "Asistente Administrativo": "ROL_ASISTENTE_ADMIN",
        "ASISTENTE ADMINISTRATIVO": "ROL_ASISTENTE_ADMIN_MAYUS",
        "Facturista": "ROL_FACTURISTA",
        "FACTURACIÓN": "ROL_FACTURACION_MAYUS",
        "MANTENIMIENTO": "ROL_MANTENIMIENTO_MAYUS",
        "Mantenimiento": "ROL_MANTENIMIENTO",
        "INTENDENCIA": "ROL_INTENDENCIA_MAYUS",
        "28/04/2025": "FECHA_ELABORACION",
        "17/07/2025": "FECHA_REVISION_SECUNDARIA_1",
        "29/09/2025": "FECHA_REVISION_SECUNDARIA_2",
        "28/04/2015": "FECHA_INCONSISTENTE_1",
        "28/042025": "FECHA_INCONSISTENTE_2",
        "29 del mes de septiembre del año 2025.": "FECHA_PROSA",
        "NOMBRE": "__SKIP__",
        "AÑO:": "__SKIP__",
        "LOGO": "__LOGO__",
    };

    const ROL_A_CLAVE_ESCOLARIDAD = {
        "ALTA DIRECCIÓN": "ESCOLARIDAD_ALTA_DIRECCION",
        "REPRESENTANTE TÉCNICO": "ESCOLARIDAD_REPRESENTANTE_TECNICO",
        "SUPERVISOR DE ESTACIÓN": "ESCOLARIDAD_SUPERVISOR",
        "ASISTENTE ADMINISTRATIVO": "ESCOLARIDAD_ASISTENTE_ADMIN",
        "MANTENIMIENTO": "ESCOLARIDAD_MANTENIMIENTO",
        "FACTURACIÓN": "ESCOLARIDAD_FACTURISTA",
        "INTENDENCIA": "ESCOLARIDAD_INTENDENCIA",
        "DESPACHADOR": "ESCOLARIDAD_DESPACHADOR",
    };

    const RE_RAZON_SOCIAL = /super\s*servici?c?o?\s+cuatro\s+caminos[.,]?\s*,?\s*s\.?\s*a\.?\s*(?:de)\s*c\.?\s*v\.?/gi;
    const RE_DOMICILIO = /km\.?\s*13\.?5\.?\s*,?\s*(?:carretera|carr\.?)\s*panamericana\s*s\/n\s*puente\s*alto(?:,\s*32675)?\s*,\s*juarez,\s*chihuahua/gi;
    const RE_NOMBRE_PLACEHOLDER = /^(nombre\s*){2,}$/i;

    const MESES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

    // ── Esquema del formulario (mismas 24 claves que el Excel) ──
    const SECCIONES_FORM = [
        { titulo: "Identidad del cliente", campos: [
            ["RAZON_SOCIAL", "Razón Social completa", "Superservicio Cuatro Caminos S.A. de C.V."],
            ["RFC", "RFC de la empresa", "SCC940928636"],
            ["DOMICILIO_ESTACION", "Domicilio completo de la estación", "KM. 13.5 CARRETERA PANAMERICANA S/N..."],
            ["CIUDAD_ESTADO", "Ciudad y Estado", "Ciudad Juárez, Chihuahua"],
            ["NUMERO_PERMISO", "Número de permiso CRE/ASEA (PL)", "PL/6125/EXP/ES/2015"],
            ["FECHA_ELABORACION", "Fecha de elaboración (dd/mm/aaaa)", "28/04/2025"],
        ]},
        { titulo: "Organigrama / nomenclatura de puestos", campos: [
            ["ROL_ALTA_DIRECCION", "Alta Dirección", "Alta Dirección"],
            ["ROL_REPRESENTANTE_TECNICO", "Representante Técnico", "Representante Técnico"],
            ["ROL_SUPERVISOR_ESTACION", "Supervisor de Estación", "Supervisor de Estación"],
            ["ROL_DESPACHADOR", "Despachador(es)", "Despachador"],
            ["ROL_ASISTENTE_ADMIN", "Asistente Administrativo", "Asistente Administrativo"],
            ["ROL_FACTURISTA", "Facturista", "Facturista"],
            ["ROL_MANTENIMIENTO", "Mantenimiento", "Mantenimiento"],
            ["ROL_INTENDENCIA", "Intendencia", "Intendencia"],
        ]},
        { titulo: "Escolaridad mínima por puesto (F-06-02)", campos: [
            ["ESCOLARIDAD_ALTA_DIRECCION", "Escolaridad — Alta Dirección", "Preparatoria"],
            ["ESCOLARIDAD_REPRESENTANTE_TECNICO", "Escolaridad — Representante Técnico", "Licenciatura o Ingeniería."],
            ["ESCOLARIDAD_SUPERVISOR", "Escolaridad — Supervisor de Estación", "Licenciatura."],
            ["ESCOLARIDAD_ASISTENTE_ADMIN", "Escolaridad — Asistente Administrativo", "Preparatoria."],
            ["ESCOLARIDAD_MANTENIMIENTO", "Escolaridad — Mantenimiento", "Secundaria."],
            ["ESCOLARIDAD_FACTURISTA", "Escolaridad — Facturación", "Secundaria."],
            ["ESCOLARIDAD_INTENDENCIA", "Escolaridad — Intendencia", "Primaria."],
            ["ESCOLARIDAD_DESPACHADOR", "Escolaridad — Despachador", "Primaria."],
        ]},
    ];

    // ── Derivación de variantes (mayúsculas, coma, fechas) ──────
    function derivarValor(clave, datos) {
        if (clave.endsWith('_MAYUS')) {
            const base = datos[clave.slice(0, -'_MAYUS'.length)];
            return base ? base.toUpperCase() : null;
        }
        if (clave === 'RAZON_SOCIAL_COMA') return datos.RAZON_SOCIAL ? datos.RAZON_SOCIAL + ',' : null;
        if (clave === 'RAZON_SOCIAL_COMA2') return datos.RAZON_SOCIAL || null;
        if (clave === 'ROL_SUPERVISOR_Y_ASISTENTE') {
            return (datos.ROL_SUPERVISOR_ESTACION && datos.ROL_ASISTENTE_ADMIN)
                ? `${datos.ROL_SUPERVISOR_ESTACION}, ${datos.ROL_ASISTENTE_ADMIN}.` : null;
        }
        if (['FECHA_INCONSISTENTE_1','FECHA_INCONSISTENTE_2','FECHA_REVISION_SECUNDARIA_1','FECHA_REVISION_SECUNDARIA_2'].includes(clave)) {
            return datos.FECHA_ELABORACION || null;
        }
        if (clave === 'FECHA_PROSA') {
            if (!datos.FECHA_ELABORACION) return null;
            const partes = datos.FECHA_ELABORACION.split('/');
            if (partes.length !== 3) return null;
            const [d, m, a] = partes;
            const mesTxt = MESES[parseInt(m, 10) - 1];
            if (!mesTxt) return null;
            return `${parseInt(d, 10)} del mes de ${mesTxt} del año ${a}.`;
        }
        return null;
    }

    function valorNuevoPara(valorOriginal, datos) {
        const clave = MAPEO[valorOriginal];
        if (clave === undefined) return intentarCoincidenciaFlexible(valorOriginal, datos);
        if (clave === '__SKIP__') return '__SKIP__';
        if (clave === '__LOGO__') return '__LOGO__';
        return datos[clave] || derivarValor(clave, datos);
    }

    function intentarCoincidenciaFlexible(texto, datos) {
        if (RE_NOMBRE_PLACEHOLDER.test(texto.trim())) return '__SKIP__';
        let nuevo = texto;
        let cambiado = false;
        if (datos.RAZON_SOCIAL && RE_RAZON_SOCIAL.test(nuevo)) {
            nuevo = nuevo.replace(RE_RAZON_SOCIAL, datos.RAZON_SOCIAL);
            cambiado = true;
        }
        if (datos.DOMICILIO_ESTACION && RE_DOMICILIO.test(nuevo)) {
            nuevo = nuevo.replace(RE_DOMICILIO, datos.DOMICILIO_ESTACION);
            cambiado = true;
        }
        return cambiado ? nuevo : null;
    }

    // ── Manipulación XML de un documento.xml/header*.xml/footer*.xml ──
    const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    function textoDeRun(run) {
        return Array.from(run.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('');
    }

    function esResaltadoAmarillo(run) {
        const rPr = run.getElementsByTagNameNS(NS_W, 'rPr')[0];
        if (!rPr) return false;
        const hl = rPr.getElementsByTagNameNS(NS_W, 'highlight')[0];
        return hl && hl.getAttributeNS(NS_W, 'val') === 'yellow';
    }

    function quitarResaltado(run) {
        const rPr = run.getElementsByTagNameNS(NS_W, 'rPr')[0];
        if (!rPr) return;
        const hl = rPr.getElementsByTagNameNS(NS_W, 'highlight')[0];
        if (hl) rPr.removeChild(hl);
    }

    function setTextoRun(run, texto) {
        const ts = run.getElementsByTagNameNS(NS_W, 't');
        if (ts.length === 0) return;
        ts[0].textContent = texto;
        ts[0].setAttribute('xml:space', 'preserve');
        for (let i = 1; i < ts.length; i++) ts[i].textContent = '';
    }

    function procesarParrafo(p, datos, stats) {
        const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
        let i = 0;
        while (i < runs.length) {
            if (esResaltadoAmarillo(runs[i])) {
                const grupo = [runs[i]];
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) { grupo.push(runs[j]); j++; }
                const textoOriginal = grupo.map(textoDeRun).join('');
                const nuevo = valorNuevoPara(textoOriginal.trim(), datos);
                if (nuevo === '__SKIP__') {
                    stats.placeholdersOmitidos++;
                } else if (nuevo === '__LOGO__') {
                    stats.logosPendientes++;
                } else if (nuevo === null || nuevo === undefined) {
                    stats.pendientes.push(textoOriginal.trim());
                } else {
                    setTextoRun(grupo[0], nuevo);
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    grupo.forEach(quitarResaltado);
                    stats.reemplazos++;
                }
                i = j;
            } else {
                i++;
            }
        }
    }

    // F-06-02: asocia cada tabla "Perfil de Puesto" con el encabezado en
    // MAYÚSCULAS que la precede, para fijar la escolaridad por puesto
    // (el mismo texto de escolaridad se repite entre puestos distintos).
    function procesarEscolaridadF0602(xmlDoc, datos, stats) {
        const body = xmlDoc.getElementsByTagNameNS(NS_W, 'body')[0];
        if (!body) return;
        let lastHeading = null;
        for (const child of Array.from(body.children)) {
            const local = child.localName;
            if (local === 'p') {
                const texto = Array.from(child.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('').trim();
                if (texto) lastHeading = texto.toUpperCase();
            } else if (local === 'tbl') {
                const claveEsc = ROL_A_CLAVE_ESCOLARIDAD[lastHeading];
                if (!claveEsc) continue;
                const filas = Array.from(child.getElementsByTagNameNS(NS_W, 'tr'));
                for (const fila of filas) {
                    const celdas = Array.from(fila.getElementsByTagNameNS(NS_W, 'tc'));
                    if (celdas.length < 2) continue;
                    const conceptoTxt = Array.from(celdas[0].getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('').trim();
                    if (conceptoTxt === 'Preparación Académica') {
                        const nuevoValor = datos[claveEsc];
                        const runs = Array.from(celdas[1].getElementsByTagNameNS(NS_W, 'r'));
                        if (nuevoValor) {
                            runs.forEach(r => { if (esResaltadoAmarillo(r)) { setTextoRun(r, ''); quitarResaltado(r); } });
                            if (runs.length) setTextoRun(runs[0], nuevoValor);
                            stats.reemplazos++;
                        } else {
                            stats.pendientes.push(`Escolaridad de ${lastHeading} (sin dato capturado)`);
                        }
                        break;
                    }
                }
            }
        }
    }

    async function procesarDocx(arrayBuffer, nombreArchivo, datos, stats) {
        const zip = await JSZip.loadAsync(arrayBuffer);
        const parser = new DOMParser();
        const serializer = new XMLSerializer();

        const rutasXml = Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(p));

        for (const ruta of rutasXml) {
            const xmlTexto = await zip.file(ruta).async('string');
            const xmlDoc = parser.parseFromString(xmlTexto, 'application/xml');

            const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
            parrafos.forEach(p => procesarParrafo(p, datos, stats));

            if (ruta === 'word/document.xml' && nombreArchivo.startsWith('F-06-02')) {
                procesarEscolaridadF0602(xmlDoc, datos, stats);
            }

            zip.file(ruta, serializer.serializeToString(xmlDoc));
        }

        return await zip.generateAsync({ type: 'blob' });
    }

    // ── Firestore: clientes ─────────────────────────────────────
    async function listarClientes() {
        const { collection, getDocs, query, orderBy } = await fsFns();
        const snap = await getDocs(query(collection(window.db, COLECCION), orderBy('RAZON_SOCIAL')));
        _clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return _clientesCache;
    }

    async function guardarCliente(id, datos) {
        const { collection, doc, setDoc, serverTimestamp } = await fsFns();
        const ref = id ? doc(window.db, COLECCION, id) : doc(collection(window.db, COLECCION));
        await setDoc(ref, { ...datos, actualizado: serverTimestamp() }, { merge: true });
        return ref.id;
    }

    // ── UI ───────────────────────────────────────────────────────
    function svgIcon(path) {
        return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    }

    function inyectarEstilosGestoria() {
        if (document.getElementById('gestoria-estilos')) return;
        const style = document.createElement('style');
        style.id = 'gestoria-estilos';
        style.textContent = `
            #gestoria-dashboard{margin-left:240px;padding:32px;min-height:100vh;background:#dde3ee;}
            @media(max-width:900px){ #gestoria-dashboard{margin-left:200px;} }
            @media(max-width:768px){ #gestoria-dashboard{margin-left:0;padding:16px;} .ss-grid-campos{grid-template-columns:1fr !important;} }
        `;
        document.head.appendChild(style);
    }

    async function cargarGestoria() {
        inyectarEstilosGestoria();
        const cont = document.getElementById('gestoria-dashboard');
        if (!cont) return;
        if (_seccionActual === 'sgm') {
            cont.innerHTML = renderTabsGestoria() + `<div style="padding-top:24px;color:#94a3b8;">SGM aún no está implementado.</div>`;
            bindTabsGestoria(cont);
            return;
        }
        cont.innerHTML = renderTabsGestoria() + `<div style="padding-top:24px;color:#94a3b8;">Cargando clientes...</div>`;
        bindTabsGestoria(cont);
        const clientes = await listarClientes();
        renderListaClientes(cont, clientes);
    }

    function renderTabsGestoria() {
        return `<div style="display:flex;gap:6px;margin:-32px -32px 0;padding:16px 32px 0;border-bottom:1px solid #e2e8f0;background:#dde3ee;">
            ${SECCIONES_GESTORIA.map(s => `
                <button data-seccion="${s.id}" style="padding:10px 16px;border:none;background:none;cursor:pointer;
                    font-weight:600;font-size:13px;color:${_seccionActual === s.id ? '#1d4ed8' : '#94a3b8'};
                    border-bottom:2px solid ${_seccionActual === s.id ? '#1d4ed8' : 'transparent'};">
                    ${s.titulo}
                </button>`).join('')}
        </div>`;
    }

    function bindTabsGestoria(cont) {
        cont.querySelectorAll('[data-seccion]').forEach(btn => {
            btn.addEventListener('click', () => {
                _seccionActual = btn.dataset.seccion;
                cargarGestoria();
            });
        });
    }

    function renderListaClientes(cont, clientes) {
        cont.innerHTML = renderTabsGestoria() + `
        <div style="padding-top:24px;max-width:1000px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h2 style="margin:0;font-size:20px;">SASISOPA</h2>
                <button id="ss-btn-nuevo" style="background:#1d4ed8;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:600;">+ Nuevo cliente</button>
            </div>
            <div id="ss-lista-clientes" style="display:flex;flex-direction:column;gap:10px;"></div>
        </div>`;
        bindTabsGestoria(cont);
        const lista = cont.querySelector('#ss-lista-clientes');
        if (clientes.length === 0) {
            lista.innerHTML = `<div style="color:#94a3b8;padding:16px;">Aún no hay clientes capturados.</div>`;
        } else {
            lista.innerHTML = clientes.map(c => `
                <div class="ss-cliente-card" data-id="${c.id}" style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                    <div>
                        <div style="font-weight:700;">${c.RAZON_SOCIAL || '(sin razón social)'}</div>
                        <div style="font-size:12px;color:#64748b;">${c.CIUDAD_ESTADO || ''} · RFC ${c.RFC || '—'}</div>
                    </div>
                    <span style="color:#1d4ed8;font-size:13px;font-weight:600;">Editar / Generar →</span>
                </div>`).join('');
            lista.querySelectorAll('.ss-cliente-card').forEach(el => {
                el.addEventListener('click', () => renderFormularioCliente(cont, el.dataset.id));
            });
        }
        cont.querySelector('#ss-btn-nuevo').addEventListener('click', () => renderFormularioCliente(cont, null));
    }

    function renderFormularioCliente(cont, clienteId) {
        _clienteActualId = clienteId;
        const cliente = clienteId ? (_clientesCache.find(c => c.id === clienteId) || {}) : {};

        const seccionesHtml = SECCIONES_FORM.map(sec => `
            <div style="margin-bottom:18px;">
                <div style="font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin-bottom:8px;">${sec.titulo}</div>
                <div class="ss-grid-campos" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    ${sec.campos.map(([clave, etiqueta, ejemplo]) => `
                        <label style="display:flex;flex-direction:column;gap:4px;font-size:13px;">
                            <span style="color:#334155;font-weight:600;">${etiqueta}</span>
                            <input type="text" data-clave="${clave}" placeholder="${ejemplo}"
                                value="${(cliente[clave] || '').replace(/"/g,'&quot;')}"
                                style="padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
                        </label>`).join('')}
                </div>
            </div>`).join('');

        cont.innerHTML = renderTabsGestoria() + `
        <div style="padding-top:24px;max-width:1000px;">
            <button id="ss-btn-volver" style="background:none;border:none;color:#1d4ed8;cursor:pointer;font-size:13px;margin-bottom:14px;">&larr; Volver a clientes</button>
            <h2 style="margin:0 0 16px;font-size:20px;">${clienteId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <div id="ss-form">${seccionesHtml}</div>
            <div style="display:flex;gap:10px;margin-top:10px;">
                <button id="ss-btn-guardar" style="background:#1d4ed8;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:600;">Guardar</button>
                <button id="ss-btn-generar" style="background:#059669;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:600;">Generar y descargar documentos</button>
            </div>
            <div id="ss-progreso" style="margin-top:16px;font-size:13px;color:#475569;white-space:pre-line;"></div>
        </div>`;
        bindTabsGestoria(cont);

        cont.querySelector('#ss-btn-volver').addEventListener('click', cargarGestoria);
        cont.querySelector('#ss-btn-guardar').addEventListener('click', async () => {
            const datos = leerFormulario(cont);
            const id = await guardarCliente(_clienteActualId, datos);
            _clienteActualId = id;
            cont.querySelector('#ss-progreso').textContent = 'Guardado correctamente.';
        });
        cont.querySelector('#ss-btn-generar').addEventListener('click', () => generarDocumentos(cont));
    }

    function leerFormulario(cont) {
        const datos = {};
        cont.querySelectorAll('#ss-form input[data-clave]').forEach(input => {
            if (input.value.trim()) datos[input.dataset.clave] = input.value.trim();
        });
        return datos;
    }

    async function generarDocumentos(cont) {
        const progreso = cont.querySelector('#ss-progreso');
        const datos = leerFormulario(cont);

        if (!datos.RAZON_SOCIAL) {
            progreso.textContent = 'Falta capturar al menos la Razón Social antes de generar.';
            return;
        }

        // Guarda automáticamente antes de generar
        const id = await guardarCliente(_clienteActualId, datos);
        _clienteActualId = id;

        progreso.textContent = 'Descargando lista de machotes...';
        let manifest;
        try {
            const resp = await fetch(RUTA_MACHOTES + 'manifest.json');
            manifest = await resp.json();
        } catch (e) {
            progreso.textContent = 'No se pudo leer ' + RUTA_MACHOTES + 'manifest.json — verifica que exista en el repositorio.';
            return;
        }

        const stats = { reemplazos: 0, placeholdersOmitidos: 0, logosPendientes: 0, pendientes: [] };
        const zipSalida = new JSZip();
        let procesados = 0, errores = [];

        for (const nombreArchivo of manifest.archivos) {
            progreso.textContent = `Procesando ${nombreArchivo} (${procesados + 1}/${manifest.archivos.length})...`;
            try {
                const resp = await fetch(RUTA_MACHOTES + nombreArchivo);
                const buffer = await resp.arrayBuffer();
                if (nombreArchivo.toLowerCase().endsWith('.docx')) {
                    const blobSalida = await procesarDocx(buffer, nombreArchivo, datos, stats);
                    zipSalida.file(nombreArchivo, blobSalida);
                } else {
                    zipSalida.file(nombreArchivo, buffer); // xlsx/otros: se copian tal cual
                }
                procesados++;
            } catch (e) {
                errores.push(`${nombreArchivo}: ${e.message}`);
            }
        }

        const reporte = [
            'REPORTE DE PERSONALIZACIÓN — PAQUETE SASISOPA',
            '='.repeat(60),
            `Archivos procesados: ${procesados}`,
            `Reemplazos aplicados: ${stats.reemplazos}`,
            `Placeholders operativos omitidos (NOMBRE/AÑO): ${stats.placeholdersOmitidos}`,
            `Logotipos pendientes de insertar manualmente: ${stats.logosPendientes}`,
            `Pendientes de revisión manual: ${stats.pendientes.length}`,
            '',
            ...(errores.length ? ['ARCHIVOS CON ERROR:', ...errores.map(e => '  - ' + e), ''] : []),
            ...(stats.pendientes.length ? ['PENDIENTES:', ...stats.pendientes.map(p => '  - "' + p + '"'), ''] : []),
            'RECORDATORIO: el organigrama gráfico embebido en P-05 (dibujo de Word)',
            'no es editado por este generador. Revisar manualmente si cambian los',
            'nombres de los puestos en el organigrama.',
        ].join('\n');
        zipSalida.file('reporte_personalizacion.txt', reporte);

        progreso.textContent = 'Generando paquete .zip final...';
        const blobFinal = await zipSalida.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blobFinal);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SASISOPA_${(datos.RAZON_SOCIAL || 'cliente').replace(/[^a-z0-9]+/gi, '_')}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        progreso.textContent = `Listo. ${stats.reemplazos} reemplazos aplicados, ${stats.pendientes.length} pendientes de revisión manual. Reporte incluido en el .zip descargado.`;
    }

    window.cargarGestoria = cargarGestoria;
})();
