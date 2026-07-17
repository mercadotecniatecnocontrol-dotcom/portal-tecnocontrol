// ══════════════════════════════════════════════════════════════
// GESTORÍA — módulo de departamento (Portal Tecnocontrol)
// ══════════════════════════════════════════════════════════════
// Archivo nombrado como el departamento (mismo patrón que rh.js,
// ventas.js, flotilla.js) porque Gestoría alojará más de un sistema:
//   - SASISOPA (implementado abajo)
//   - SGM — Sistema de Gestión de Medición (pendiente, sección propia)
//
// Corre 100% en el navegador: no requiere backend ni Cloud Functions
// (compatible con GitHub Pages + Firestore plan Spark).
//
// Requiere que index.html haya cargado:
//   - window.db, window.auth (ya expuestos por el módulo principal)
//   - JSZip (https://cdnjs.cloudflare.com/ajax/libs/jszip/...)
//   - Variables CSS globales del portal (--teal, --teal2, --text, etc.)
//
// Los 91 machotes de SASISOPA viven en /sasisopa-machotes/ junto con
// un manifest.json que los lista (mismo patrón que manifest.json /
// manifest-flotilla.json ya usados en el portal).

(function () {

    const SECCIONES_GESTORIA = [
        { id: 'sasisopa', titulo: 'SASISOPA', activa: true },
        { id: 'sgm', titulo: 'SGM', activa: true },
    ];
    let _seccionActual = 'sasisopa';

    const SASISOPA_RUTA_MACHOTES = 'sasisopa-machotes/';
    const SASISOPA_COLECCION = 'sasisopa_clientes';

    let _fsFns = null;
    let _clienteActualId = null;
    let _clientesCache = [];
    let _logoDataUrlActual = null;
    let _filtroTexto = '';

    async function fsFns() {
        if (_fsFns) return _fsFns;
        _fsFns = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        return _fsFns;
    }

    // ══════════════════════════════════════════════════════════
    // ÍCONOS (SVG inline, mismo estilo que el resto del portal)
    // ══════════════════════════════════════════════════════════
    const ICONO = {
        mas:        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        buscar:     '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
        edificio:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><line x1="10" y1="6" x2="14" y2="6"/><line x1="10" y1="10" x2="14" y2="10"/><line x1="10" y1="14" x2="14" y2="14"/><line x1="10" y1="18" x2="14" y2="18"/></svg>',
        usuarios:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        graduacion: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12.5V17c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/></svg>',
        imagen:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
        descarga:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        editar:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
        flecha:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
        check:      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        alerta:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>',
        papelera:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
        candado:    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        carpeta:    '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
        reloj:      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        calendario: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        cerrar:     '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    };

    // ══════════════════════════════════════════════════════════
    // CATÁLOGO DE REEMPLAZO (idéntico a mapeo_valores.py)
    // ══════════════════════════════════════════════════════════
    const SASISOPA_MAPEO = {
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

    // Roles seleccionables — antes eran 8 campos de texto fijos;
    // ahora es un checklist como en SGM: el cliente marca cuáles
    // puestos existen realmente en su estación.
    const SASISOPA_ROLES_DISPONIBLES = [
        { clave: "ROL_ALTA_DIRECCION",        etiqueta: "Alta Dirección",          escolaridadClave: "ESCOLARIDAD_ALTA_DIRECCION",        obligatorio: false },
        { clave: "ROL_REPRESENTANTE_TECNICO", etiqueta: "Representante Técnico",   escolaridadClave: "ESCOLARIDAD_REPRESENTANTE_TECNICO", obligatorio: false },
        { clave: "ROL_SUPERVISOR_ESTACION",   etiqueta: "Supervisor de Estación",  escolaridadClave: "ESCOLARIDAD_SUPERVISOR",            obligatorio: false },
        { clave: "ROL_DESPACHADOR",           etiqueta: "Despachador(es)",         escolaridadClave: "ESCOLARIDAD_DESPACHADOR",           obligatorio: false },
        { clave: "ROL_ASISTENTE_ADMIN",       etiqueta: "Asistente Administrativo",escolaridadClave: "ESCOLARIDAD_ASISTENTE_ADMIN",       obligatorio: false },
        { clave: "ROL_FACTURISTA",            etiqueta: "Facturista",              escolaridadClave: "ESCOLARIDAD_FACTURISTA",            obligatorio: false },
        { clave: "ROL_MANTENIMIENTO",         etiqueta: "Mantenimiento",           escolaridadClave: "ESCOLARIDAD_MANTENIMIENTO",         obligatorio: false },
        { clave: "ROL_INTENDENCIA",           etiqueta: "Intendencia",             escolaridadClave: "ESCOLARIDAD_INTENDENCIA",           obligatorio: false },
    ];

    const SASISOPA_SECCIONES_FORM = [
        { titulo: "Identidad del cliente", icono: ICONO.edificio, campos: [
            ["RAZON_SOCIAL", "Razón Social completa", "Superservicio Cuatro Caminos S.A. de C.V."],
            ["RFC", "RFC de la empresa", "SCC940928636"],
            ["DOMICILIO_ESTACION", "Domicilio completo de la estación", "KM. 13.5 CARRETERA PANAMERICANA S/N..."],
            ["CIUDAD_ESTADO", "Ciudad y Estado", "Ciudad Juárez, Chihuahua"],
            ["NUMERO_PERMISO", "Número de permiso CRE/ASEA (PL)", "PL/6125/EXP/ES/2015"],
            ["FECHA_ELABORACION", "Fecha de elaboración (dd/mm/aaaa)", "28/04/2025"],
        ]},
        { titulo: "Organigrama y nomenclatura de puestos", icono: ICONO.usuarios, tipo: "checklist_con_nombre", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Escolaridad mínima por puesto (F-06-02)", icono: ICONO.graduacion, tipo: "escolaridad_dinamica", fuente: SASISOPA_ROLES_DISPONIBLES, ejemplos: {
            ESCOLARIDAD_ALTA_DIRECCION: "Preparatoria", ESCOLARIDAD_REPRESENTANTE_TECNICO: "Licenciatura o Ingeniería.",
            ESCOLARIDAD_SUPERVISOR: "Licenciatura.", ESCOLARIDAD_ASISTENTE_ADMIN: "Preparatoria.",
            ESCOLARIDAD_MANTENIMIENTO: "Secundaria.", ESCOLARIDAD_FACTURISTA: "Secundaria.",
            ESCOLARIDAD_INTENDENCIA: "Primaria.", ESCOLARIDAD_DESPACHADOR: "Primaria.",
        }},
    ];

    const SASISOPA_CAMPOS_OBLIGATORIOS = ["RAZON_SOCIAL", "RFC", "DOMICILIO_ESTACION", "CIUDAD_ESTADO", "NUMERO_PERMISO", "FECHA_ELABORACION"];

    // ══════════════════════════════════════════════════════════
    // SGM — Sistema de Gestión de las Mediciones (ISO 10012:2003)
    // ══════════════════════════════════════════════════════════
    const SGM_RUTA_MACHOTES = 'sgm-machotes/';
    const SGM_COLECCION = 'sgm_clientes';

    const SGM_MAPEO = {
        "FELIX RUIZ GONZALEZ": "NOMBRE_REPRESENTANTE_MAYUS",
        "FELIX RUIZ GONZALEZ.": "NOMBRE_REPRESENTANTE_MAYUS",
        "Félix Ruiz González": "NOMBRE_REPRESENTANTE",
        "Félix": "__SKIP__",
        "Ruiz González": "__SKIP__",
        "FRG": "INICIALES_REPRESENTANTE",
        "FR": "__SKIP__",
        "PL/9693/EXP/ES/2015": "NUMERO_PERMISO",
        "Lezlie Anahy Gutierrez Armendáriz.": "NOMBRE_ELABORA",
        "LAGA": "INICIALES_ELABORA",
        "16/12/2024": "FECHA_ELABORACION",
        "Alta Dirección.": "ROL_ALTA_DIRECCION",
        "Alta Dirección": "ROL_ALTA_DIRECCION",
        "alta dirección": "ROL_ALTA_DIRECCION",
        "Administrativo.": "ROL_ADMINISTRATIVO",
        "Administrativo": "ROL_ADMINISTRATIVO",
        "Encargado de estación.": "ROL_ENCARGADO_ESTACION",
        "Encargado de estación": "ROL_ENCARGADO_ESTACION",
        "Encargado de proyecto.": "ROL_ENCARGADO_PROYECTO",
        "Encargado de proyecto": "ROL_ENCARGADO_PROYECTO",
        "Mantenimiento.": "ROL_MANTENIMIENTO",
        "Mantenimiento": "ROL_MANTENIMIENTO",
        "Representante Técnico.": "ROL_REPRESENTANTE_TECNICO",
        "5.6 Representante Técnico.": "ROL_REPRESENTANTE_TECNICO",
        "Intendencia": "ROL_INTENDENCIA",
        "LOGO": "__LOGO__",
    };

    // Roles seleccionables por checklist — cada cliente marca cuáles
    // aplican en su estructura y captura el nombre de quien lo ocupa.
    // Si un cliente combina roles, se marcan ambos con el mismo nombre.
    const SGM_ROLES_DISPONIBLES = [
        { clave: "ROL_ALTA_DIRECCION",        etiqueta: "Alta Dirección",        obligatorio: true  },
        { clave: "ROL_REPRESENTANTE_TECNICO", etiqueta: "Representante Técnico", obligatorio: true  },
        { clave: "ROL_ADMINISTRATIVO",        etiqueta: "Administrativo",        obligatorio: false },
        { clave: "ROL_ENCARGADO_ESTACION",    etiqueta: "Encargado de estación", obligatorio: false },
        { clave: "ROL_ENCARGADO_PROYECTO",    etiqueta: "Encargado de proyecto", obligatorio: false },
        { clave: "ROL_MANTENIMIENTO",         etiqueta: "Mantenimiento",         obligatorio: false },
        { clave: "ROL_INTENDENCIA",           etiqueta: "Intendencia",           obligatorio: false },
    ];

    // Equipo de medición: lista abierta (varía por estación), sin
    // catálogo fijo de tipos — el usuario agrega tantas filas como
    // equipos tenga instalados.
    const SGM_CAMPOS_EQUIPO = [
        { clave: "tipo", etiqueta: "Tipo de equipo", ejemplo: "Consola de tanque" },
        { clave: "marca", etiqueta: "Marca", ejemplo: "VEEDER-ROOT" },
        { clave: "modelo", etiqueta: "Modelo", ejemplo: "TLS-300C" },
        { clave: "numero_serie", etiqueta: "Número de serie", ejemplo: "G04180392705001" },
    ];

    const SGM_CAMPOS_OBLIGATORIOS = ["NOMBRE_REPRESENTANTE", "NUMERO_PERMISO", "NOMBRE_ELABORA", "FECHA_ELABORACION"];

    const SGM_SECCIONES_FORM = [
        { titulo: "Identidad del cliente", icono: ICONO.edificio, campos: [
            ["NOMBRE_REPRESENTANTE", "Nombre completo del representante técnico", "Félix Ruiz González"],
            ["NUMERO_PERMISO", "Número de permiso CRE/ASEA (PL)", "PL/9693/EXP/ES/2015"],
        ]},
        { titulo: "Control de documentos", icono: ICONO.usuarios, campos: [
            ["NOMBRE_ELABORA", "Nombre de quien elabora", "Lezlie Anahy Gutierrez Armendáriz."],
            ["FECHA_ELABORACION", "Fecha de elaboración (dd/mm/aaaa)", "16/12/2024"],
        ]},
        { titulo: "Organigrama y nomenclatura de puestos", icono: ICONO.usuarios, tipo: "checklist_con_nombre", opciones: SGM_ROLES_DISPONIBLES },
        { titulo: "Equipo de medición por estación", icono: ICONO.graduacion, tipo: "tabla_dinamica", columnas: SGM_CAMPOS_EQUIPO },
    ];

    // ── Config activa según la sección elegida en el riel lateral ──
    function sistemaActivo() {
        if (_seccionActual === 'sgm') {
            return {
                id: 'sgm', nombre: 'SGM', subtitulo: 'Sistema de Gestión de las Mediciones',
                mapeo: SGM_MAPEO, seccionesForm: SGM_SECCIONES_FORM,
                camposObligatorios: SGM_CAMPOS_OBLIGATORIOS,
                rutaMachotes: SGM_RUTA_MACHOTES, coleccion: SGM_COLECCION,
                campoNombre: 'NOMBRE_REPRESENTANTE', campoOrden: 'NOMBRE_REPRESENTANTE',
                columnasTabla: [
                    { titulo: 'Cliente', valor: c => c.NOMBRE_REPRESENTANTE || '(sin nombre)' },
                    { titulo: 'Permiso', valor: c => c.NUMERO_PERMISO || '—' },
                ],
            };
        }
        return {
            id: 'sasisopa', nombre: 'SASISOPA', subtitulo: 'Personalización automática de machotes por cliente',
            mapeo: SASISOPA_MAPEO, seccionesForm: SASISOPA_SECCIONES_FORM,
            camposObligatorios: SASISOPA_CAMPOS_OBLIGATORIOS,
            rutaMachotes: SASISOPA_RUTA_MACHOTES, coleccion: SASISOPA_COLECCION,
            campoNombre: 'RAZON_SOCIAL', campoOrden: 'RAZON_SOCIAL',
            columnasTabla: [
                { titulo: 'Cliente', valor: c => c.RAZON_SOCIAL || '(sin razón social)' },
                { titulo: 'RFC', valor: c => c.RFC || '—' },
                { titulo: 'Ubicación', valor: c => c.CIUDAD_ESTADO || '—' },
            ],
        };
    }

    // ── Derivación de variantes (mayúsculas, coma, fechas) ──────
    function derivarValorSASISOPA(clave, datos) {
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

    function derivarValorSGM(clave, datos) {
        if (clave.endsWith('_MAYUS')) {
            const base = datos[clave.slice(0, -'_MAYUS'.length)];
            return base ? base.toUpperCase() : null;
        }
        if (clave.startsWith('INICIALES_')) {
            const baseClave = 'NOMBRE_' + clave.slice('INICIALES_'.length);
            const nombre = datos[baseClave];
            if (!nombre) return null;
            return nombre.replace(/\./g, '').split(/\s+/).filter(Boolean).map(p => p[0].toUpperCase()).join('');
        }
        return null;
    }

    function derivarValor(clave, datos) {
        return _seccionActual === 'sgm' ? derivarValorSGM(clave, datos) : derivarValorSASISOPA(clave, datos);
    }

    function valorNuevoPara(valorOriginal, datos) {
        const mapeo = sistemaActivo().mapeo;
        const clave = mapeo[valorOriginal];
        if (clave === undefined) return intentarCoincidenciaFlexible(valorOriginal, datos);
        if (clave === '__SKIP__') return '__SKIP__';
        if (clave === '__LOGO__') return '__LOGO__';
        return datos[clave] || derivarValor(clave, datos);
    }

    function intentarCoincidenciaFlexible(texto, datos) {
        if (_seccionActual === 'sgm') return null; // SGM no requiere fuzzy-match de razón social/domicilio
        if (RE_NOMBRE_PLACEHOLDER.test(texto.trim())) return '__SKIP__';
        let nuevo = texto, cambiado = false;
        if (datos.RAZON_SOCIAL && RE_RAZON_SOCIAL.test(nuevo)) { nuevo = nuevo.replace(RE_RAZON_SOCIAL, datos.RAZON_SOCIAL); cambiado = true; }
        if (datos.DOMICILIO_ESTACION && RE_DOMICILIO.test(nuevo)) { nuevo = nuevo.replace(RE_DOMICILIO, datos.DOMICILIO_ESTACION); cambiado = true; }
        return cambiado ? nuevo : null;
    }

    // ══════════════════════════════════════════════════════════
    // MANIPULACIÓN XML DEL .DOCX
    // ══════════════════════════════════════════════════════════
    const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    function textoDeRun(run) { return Array.from(run.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join(''); }

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

    // ── Inserción real de imagen (logo) en el .docx ─────────────
    function dataUrlABytes(dataUrl) {
        const [header, b64] = dataUrl.split(',');
        const mime = header.match(/data:([^;]+);/)[1];
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ext = mime === 'image/jpeg' ? 'jpeg' : 'png';
        return { bytes, mime, ext };
    }

    function medirImagenDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    async function asegurarContentType(zip, ext, mime) {
        const path = '[Content_Types].xml';
        let xml = await zip.file(path).async('string');
        if (xml.includes(`Extension="${ext}"`)) return;
        xml = xml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
        zip.file(path, xml);
    }

    function rutaRelsPara(rutaXml) {
        const partes = rutaXml.split('/');
        const nombre = partes.pop();
        return partes.join('/') + '/_rels/' + nombre + '.rels';
    }

    async function agregarRelacionImagen(zip, rutaXml, mediaFilename) {
        const rutaRels = rutaRelsPara(rutaXml);
        let xml;
        try { xml = await zip.file(rutaRels).async('string'); }
        catch (e) { xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'; }
        const ids = Array.from(xml.matchAll(/Id="rId(\d+)"/g)).map(m => parseInt(m[1], 10));
        const nuevoId = 'rId' + ((ids.length ? Math.max(...ids) : 0) + 1);
        const nuevaRel = `<Relationship Id="${nuevoId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaFilename}"/>`;
        xml = xml.includes('</Relationships>') ? xml.replace('</Relationships>', nuevaRel + '</Relationships>') : xml;
        zip.file(rutaRels, xml);
        return nuevoId;
    }

    function nodosDesdeXml(xmlDoc, xmlString) {
        const NS_DECL = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
            'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
            'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
        const wrapper = new DOMParser().parseFromString(`<wrapper ${NS_DECL}>${xmlString}</wrapper>`, 'application/xml');
        return xmlDoc.importNode(wrapper.documentElement.firstChild, true);
    }

    function construirDrawingXml(rId, cx, cy, id) {
        return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${id}" name="LogoCliente"/>
            <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="LogoCliente"/><pic:cNvPicPr/></pic:nvPicPr>
                <pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>
            </a:graphicData></a:graphic>
        </wp:inline></w:drawing>`;
    }

    async function insertarLogoEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg) {
        const { bytes, mime, ext } = dataUrlABytes(dataUrl);
        await asegurarContentType(zip, ext, mime);
        ctxImg.contador++;
        const mediaFilename = `logoGen${ctxImg.contador}.${ext}`;
        zip.file('word/media/' + mediaFilename, bytes);
        const rId = await agregarRelacionImagen(zip, rutaXml, mediaFilename);

        const { width, height } = await medirImagenDataUrl(dataUrl);
        const altoObjetivoPx = 46;
        let anchoPx = width * (altoObjetivoPx / height);
        let altoPx = altoObjetivoPx;
        if (anchoPx > 150) { altoPx = altoPx * (150 / anchoPx); anchoPx = 150; }
        const cx = Math.round(anchoPx * 9525);
        const cy = Math.round(altoPx * 9525);

        const nodoDrawing = nodosDesdeXml(xmlDoc, construirDrawingXml(rId, cx, cy, 1000 + ctxImg.contador));
        const primerRun = grupoRuns[0];
        Array.from(primerRun.getElementsByTagNameNS(NS_W, 't')).forEach(t => t.remove());
        quitarResaltado(primerRun);
        primerRun.appendChild(nodoDrawing);
        for (let k = 1; k < grupoRuns.length; k++) { setTextoRun(grupoRuns[k], ''); quitarResaltado(grupoRuns[k]); }
    }

    async function procesarParrafo(p, datos, stats, ctx) {
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
                    if (datos.LOGO_BASE64) {
                        await insertarLogoEnGrupo(ctx.zip, p.ownerDocument, ctx.ruta, grupo, datos.LOGO_BASE64, ctx.imagen);
                        stats.logosInsertados++;
                    } else {
                        stats.logosPendientes++;
                    }
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

    function procesarEscolaridadF0602(xmlDoc, datos, stats) {
        const body = xmlDoc.getElementsByTagNameNS(NS_W, 'body')[0];
        if (!body) return;
        let lastHeading = null;
        for (const child of Array.from(body.children)) {
            if (child.localName === 'p') {
                const texto = Array.from(child.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('').trim();
                if (texto) lastHeading = texto.toUpperCase();
            } else if (child.localName === 'tbl') {
                const claveEsc = ROL_A_CLAVE_ESCOLARIDAD[lastHeading];
                if (!claveEsc) continue;
                for (const fila of Array.from(child.getElementsByTagNameNS(NS_W, 'tr'))) {
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

    // ── SGM: inserción de la tabla dinámica de equipo de medición ──
    // Se activa solo en los machotes que sabemos contienen esta tabla
    // (confirmado en el análisis de campos: PROC-T-006, FOR-T-007,
    // FOR-T-008, y el pendiente de resolver "volumen del despacho").
    // Heurística: toma la ÚLTIMA tabla del documento (las tablas de
    // roles/organigrama van antes y ya se resuelven por MAPEO normal),
    // y la clona/llena una vez por cada equipo capturado.
    // ⚠️ Sin probar aún contra los machotes reales de sgm-machotes/ —
    // revisar con el primer cliente de prueba antes de usarlo en producción.
    const RE_ARCHIVOS_CON_TABLA_EQUIPO = /volumen|inventario_de_equipo|etiquetas_de_identificaci[oó]n/i;

    function procesarTablaEquipoSGM(xmlDoc, datos, stats) {
        if (!datos.EQUIPOS || !datos.EQUIPOS.length) return;
        const tablas = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'));
        if (!tablas.length) return;
        const tabla = tablas[tablas.length - 1];
        const filas = Array.from(tabla.getElementsByTagNameNS(NS_W, 'tr'));
        const filaPlantilla = filas.find(f => f.getElementsByTagNameNS(NS_W, 'tc').length >= 2 && Array.from(f.getElementsByTagNameNS(NS_W, 'r')).some(esResaltadoAmarillo));
        if (!filaPlantilla) return;

        datos.EQUIPOS.forEach((equipo, idx) => {
            const filaNueva = idx === 0 ? filaPlantilla : filaPlantilla.cloneNode(true);
            const celdas = Array.from(filaNueva.getElementsByTagNameNS(NS_W, 'tc'));
            const valores = [equipo.tipo || '', equipo.marca || '', equipo.modelo || '', equipo.numero_serie || ''];
            celdas.forEach((celda, i) => {
                if (valores[i] === undefined) return;
                const runs = Array.from(celda.getElementsByTagNameNS(NS_W, 'r'));
                if (!runs.length) return;
                setTextoRun(runs[0], valores[i]);
                runs.forEach(quitarResaltado);
                for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
            });
            if (idx > 0) filaPlantilla.parentNode.insertBefore(filaNueva, filaPlantilla.nextSibling);
            stats.reemplazos++;
        });
    }

    // ── SGM: neutralizar la tabla fija "DOCUMENTO CONTROLADO" ───
    // Esta tabla (Nombre / Puesto o función / Firma / Fecha, filas
    // Elaboró/Revisó/Aprobó) es idéntica en los 41 machotes y describe
    // al personal de METRyCAL/HEDMA que armó la plantilla — NO al
    // cliente. El texto resaltado en esa columna ("Administrativo.",
    // "Alta Dirección.") choca por casualidad con las mismas claves
    // que SGM_MAPEO usa para insertar los roles reales del cliente en
    // otras partes del documento. Aquí solo quitamos el resaltado y
    // dejamos el texto tal cual, para que el paso normal de reemplazo
    // ya no lo toque (esResaltadoAmarillo dejará de detectarlo).
    function neutralizarPuestoDocumentoControlado(xmlDoc) {
        const norm = t => (t || '').trim().toLowerCase();
        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const filas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'));
            if (!filas.length) continue;
            const encabezado = Array.from(filas[0].getElementsByTagNameNS(NS_W, 'tc')).map(textoDeCelda);
            const esTablaDocumentoControlado = encabezado.some(t => norm(t) === 'nombre')
                && encabezado.some(t => norm(t) === 'puesto o función');
            if (!esTablaDocumentoControlado) continue;

            const idxPuesto = encabezado.findIndex(t => norm(t) === 'puesto o función');
            for (const fila of filas) {
                const celdas = Array.from(fila.getElementsByTagNameNS(NS_W, 'tc'));
                const primeraCelda = norm(textoDeCelda(celdas[0]));
                if (!/^(elaboró|revisó|aprobó):?$/.test(primeraCelda)) continue;
                const celdaPuesto = celdas[idxPuesto];
                if (!celdaPuesto) continue;
                Array.from(celdaPuesto.getElementsByTagNameNS(NS_W, 'r')).forEach(quitarResaltado);
            }
        }
    }

    function textoDeCelda(celda) {
        if (!celda) return '';
        return Array.from(celda.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('');
    }

    async function procesarDocx(arrayBuffer, nombreArchivo, datos, stats, zip) {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();
        const ctxImagen = { contador: 0 };

        const rutasXml = Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(p));
        for (const ruta of rutasXml) {
            const xmlTexto = await zip.file(ruta).async('string');
            const xmlDoc = parser.parseFromString(xmlTexto, 'application/xml');
            const ctx = { zip, ruta, imagen: ctxImagen };

            if (_seccionActual === 'sgm') {
                neutralizarPuestoDocumentoControlado(xmlDoc);
            }

            for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
                await procesarParrafo(p, datos, stats, ctx);
            }
            if (ruta === 'word/document.xml' && nombreArchivo.startsWith('F-06-02')) {
                procesarEscolaridadF0602(xmlDoc, datos, stats);
            }
            if (ruta === 'word/document.xml' && _seccionActual === 'sgm' && RE_ARCHIVOS_CON_TABLA_EQUIPO.test(nombreArchivo)) {
                procesarTablaEquipoSGM(xmlDoc, datos, stats);
            }
            zip.file(ruta, serializer.serializeToString(xmlDoc));
        }
        return await zip.generateAsync({ type: 'blob' });
    }

    // ══════════════════════════════════════════════════════════
    // FIRESTORE
    // ══════════════════════════════════════════════════════════
    async function listarClientes() {
        const { collection, getDocs, query, orderBy } = await fsFns();
        const sis = sistemaActivo();
        const snap = await getDocs(query(collection(window.db, sis.coleccion), orderBy(sis.campoOrden)));
        _clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return _clientesCache;
    }

    async function guardarCliente(id, datos) {
        const { collection, doc, setDoc, serverTimestamp } = await fsFns();
        const sis = sistemaActivo();
        const ref = id ? doc(window.db, sis.coleccion, id) : doc(collection(window.db, sis.coleccion));
        await setDoc(ref, { ...datos, actualizado: serverTimestamp() }, { merge: true });
        return ref.id;
    }

    // ══════════════════════════════════════════════════════════
    // ESTILOS (tokens tomados de las variables CSS del portal)
    // ══════════════════════════════════════════════════════════
    function inyectarEstilosGestoria() {
        if (document.getElementById('gestoria-estilos')) return;
        const style = document.createElement('style');
        style.id = 'gestoria-estilos';
        style.textContent = `
        #gestoria-dashboard{margin-left:240px;min-height:100vh;background:#f6f8fc;font-family:'DM Sans',sans-serif;}
        @media(max-width:900px){ #gestoria-dashboard{margin-left:200px;} }
        @media(max-width:768px){ #gestoria-dashboard{margin-left:0;} .gs-grid{grid-template-columns:1fr !important;} .gs-form-grid{grid-template-columns:1fr !important;} }

        /* El riel queda ANCLADO al viewport (fixed), no al flujo de la página,
           para que nunca se desplace con el scroll — igual que el sidebar azul principal. */
        #gestoria-dashboard .gs-shell{display:block;min-height:100vh;}
        #gestoria-dashboard .gs-rail{position:fixed;top:0;left:240px;height:100vh;z-index:90;}
        @media(max-width:900px){ #gestoria-dashboard .gs-rail{left:200px;} }
        @media(max-width:768px){ #gestoria-dashboard .gs-rail{left:0;} }
        #gestoria-dashboard .gs-rail{width:64px;background:#0f172a;display:flex;flex-direction:column;align-items:center;padding:18px 0;gap:6px;flex-shrink:0;}
        #gestoria-dashboard .gs-rail-logo{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--teal),var(--teal2));display:flex;align-items:center;justify-content:center;color:#fff;margin-bottom:14px;flex-shrink:0;}
        #gestoria-dashboard .gs-rail-btn{width:44px;height:44px;border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.5);background:transparent;transition:all 0.18s;position:relative;}
        #gestoria-dashboard .gs-rail-btn.activo{background:var(--teal2);color:#fff;}
        #gestoria-dashboard .gs-rail-btn:not(.activo):not(:disabled):hover{background:rgba(37,99,235,0.35);color:#fff;}
        #gestoria-dashboard .gs-rail-btn:disabled{opacity:0.28;cursor:not-allowed;}
        #gestoria-dashboard .gs-rail-tooltip{position:absolute;left:56px;top:50%;transform:translateY(-50%);background:#0f172a;color:#fff;font-size:11px;font-weight:600;padding:6px 10px;border-radius:7px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.15s;z-index:20;box-shadow:0 4px 12px rgba(0,0,0,0.25);}
        #gestoria-dashboard .gs-rail-btn:hover .gs-rail-tooltip{opacity:1;}
        /* gs-content deja el hueco del riel fijo (64px) mediante margen, en vez de flex */
        #gestoria-dashboard .gs-content{margin-left:64px;min-width:0;min-height:100vh;}
        @media(max-width:768px){ #gestoria-dashboard .gs-rail{width:56px;} #gestoria-dashboard .gs-rail-btn{width:38px;height:38px;} #gestoria-dashboard .gs-content{margin-left:56px;} }


        #gestoria-dashboard .gs-topbar{display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;padding:28px 32px 20px;border-bottom:1px solid rgba(59,130,246,0.10);background:#ffffff;}
        #gestoria-dashboard .gs-eyebrow{font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--teal2);margin-bottom:6px;}
        #gestoria-dashboard .gs-title{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:700;color:var(--text);line-height:1.2;}
        #gestoria-dashboard .gs-subtitle{font-size:13px;color:var(--text2);margin-top:4px;}

        #gestoria-dashboard .gs-body{padding:28px 32px 60px;max-width:1240px;}

        #gestoria-dashboard .gs-btn{display:inline-flex;align-items:center;gap:8px;border:none;border-radius:10px;font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;cursor:pointer;transition:all 0.18s ease;white-space:nowrap;}
        #gestoria-dashboard .gs-btn-primary{background:linear-gradient(135deg,var(--teal),var(--teal2));color:#fff;padding:11px 20px;box-shadow:0 2px 10px rgba(37,99,235,0.28);}
        #gestoria-dashboard .gs-btn-primary:hover{box-shadow:0 4px 16px rgba(37,99,235,0.38);transform:translateY(-1px);}
        #gestoria-dashboard .gs-btn-primary:active{transform:translateY(0);box-shadow:0 1px 4px rgba(37,99,235,0.3);}
        #gestoria-dashboard .gs-btn-primary:disabled{background:#cbd5e1;box-shadow:none;cursor:not-allowed;transform:none;}
        #gestoria-dashboard .gs-btn-secondary{background:#fff;color:var(--text2);border:1px solid rgba(59,130,246,0.18);padding:10px 18px;}
        #gestoria-dashboard .gs-btn-secondary:hover{background:#f4f8ff;border-color:var(--teal);color:var(--teal2);}
        #gestoria-dashboard .gs-btn-ghost{background:none;color:var(--teal2);padding:8px 10px;}
        #gestoria-dashboard .gs-btn-ghost:hover{background:rgba(37,99,235,0.08);}

        #gestoria-dashboard .gs-searchbar{position:relative;max-width:340px;}
        #gestoria-dashboard .gs-searchbar svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--text3);}
        #gestoria-dashboard .gs-searchbar input{width:100%;padding:10px 14px 10px 36px;border:1px solid rgba(59,130,246,0.15);border-radius:10px;font-size:13px;font-family:'DM Sans',sans-serif;background:#fff;transition:0.18s;}
        #gestoria-dashboard .gs-searchbar input:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px rgba(37,99,235,0.12);}

        #gestoria-dashboard .gs-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;}
        #gestoria-dashboard .gs-kpi-card{background:#fff;border:1px solid rgba(59,130,246,0.12);border-radius:16px;padding:18px 20px;box-shadow:0 2px 8px rgba(37,99,235,0.05);}
        #gestoria-dashboard .gs-kpi-label{font-size:11.5px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;}
        #gestoria-dashboard .gs-kpi-value{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:var(--text);}

        #gestoria-dashboard .gs-card{background:#fff;border:1px solid rgba(59,130,246,0.12);border-radius:16px;box-shadow:0 2px 8px rgba(37,99,235,0.05);overflow:hidden;}
        #gestoria-dashboard .gs-card + .gs-card{margin-top:20px;}
        #gestoria-dashboard .gs-card-header{display:flex;align-items:center;gap:10px;padding:18px 22px;border-bottom:1px solid rgba(59,130,246,0.08);}
        #gestoria-dashboard .gs-card-header .gs-card-icon{width:32px;height:32px;border-radius:9px;background:rgba(37,99,235,0.10);color:var(--teal2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        #gestoria-dashboard .gs-card-title{font-family:'Space Grotesk',sans-serif;font-size:14.5px;font-weight:700;color:var(--text);}
        #gestoria-dashboard .gs-card-body{padding:22px;}

        #gestoria-dashboard table.gs-table{width:100%;border-collapse:collapse;}
        #gestoria-dashboard table.gs-table thead th{text-align:left;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--text3);padding:13px 22px;border-bottom:1px solid rgba(59,130,246,0.10);background:#fafbfd;}
        #gestoria-dashboard table.gs-table tbody td{padding:15px 22px;font-size:13.5px;color:var(--text);border-bottom:1px solid rgba(59,130,246,0.06);}
        #gestoria-dashboard table.gs-table tbody tr{transition:background 0.15s;cursor:pointer;}
        #gestoria-dashboard table.gs-table tbody tr:hover{background:#f5f8ff;}
        #gestoria-dashboard table.gs-table tbody tr:last-child td{border-bottom:none;}
        #gestoria-dashboard .gs-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;}
        #gestoria-dashboard .gs-badge-ok{background:rgba(34,197,94,0.12);color:#16803d;}
        #gestoria-dashboard .gs-badge-warn{background:rgba(245,158,11,0.14);color:#b45309;}

        #gestoria-dashboard .gs-empty{text-align:center;padding:64px 24px;color:var(--text3);}
        #gestoria-dashboard .gs-empty svg{margin-bottom:14px;opacity:0.6;}
        #gestoria-dashboard .gs-empty p{font-size:13.5px;margin-bottom:18px;}

        #gestoria-dashboard .gs-form-grid{display:grid;grid-template-columns:1.6fr 1fr;gap:20px;align-items:start;}
        #gestoria-dashboard .gs-field{display:flex;flex-direction:column;gap:6px;}
        #gestoria-dashboard .gs-field label{font-size:11.5px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px;}
        #gestoria-dashboard .gs-field label .gs-req{color:#ef4444;margin-left:2px;}
        #gestoria-dashboard .gs-field input{padding:10px 13px;border:1px solid rgba(59,130,246,0.16);border-radius:10px;font-size:13.5px;font-family:'DM Sans',sans-serif;color:var(--text);transition:0.15s;background:#fbfcfe;}
        #gestoria-dashboard .gs-field input:focus{outline:none;border-color:var(--teal);background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,0.12);}
        #gestoria-dashboard .gs-field input.gs-input-error{border-color:#ef4444;}
        #gestoria-dashboard .gs-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        #gestoria-dashboard .gs-checklist-roles{display:flex;flex-direction:column;gap:10px;}
        #gestoria-dashboard .gs-rol-fila{display:grid;grid-template-columns:220px 1fr;align-items:center;gap:12px;padding:8px 10px;border-radius:10px;background:#fbfcfe;border:1px solid rgba(59,130,246,0.1);}
        #gestoria-dashboard .gs-rol-check{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);}
        #gestoria-dashboard .gs-rol-check input[type="checkbox"]{width:16px;height:16px;accent-color:var(--teal);}
        #gestoria-dashboard .gs-rol-fila input[type="text"]{padding:9px 12px;border:1px solid rgba(59,130,246,0.16);border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:var(--text);background:#fff;}
        #gestoria-dashboard .gs-rol-fila input[type="text"]:disabled{background:#f1f5f9;color:var(--text3);}
        #gestoria-dashboard .gs-equipo-fila{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed rgba(59,130,246,0.15);}
        #gestoria-dashboard .gs-btn-quitar-equipo{padding:9px 12px;color:#ef4444;font-weight:700;}
        #gestoria-dashboard .gs-rail-divisor{width:32px;height:1px;background:rgba(255,255,255,0.14);margin:8px 0;flex-shrink:0;}

        /* ── Panel flotante de la Parrilla de Documentos ─────────── */
        .gs-parrilla-overlay{position:fixed;inset:0;z-index:200000;background:rgba(15,23,42,0);pointer-events:none;transition:background 0.28s ease;display:flex;justify-content:flex-end;}
        .gs-parrilla-overlay.abierto{background:rgba(15,23,42,0.45);pointer-events:auto;}
        .gs-parrilla-panel{width:520px;max-width:92vw;height:100%;background:#fff;box-shadow:-12px 0 40px rgba(0,0,0,0.18);display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.32s cubic-bezier(0.22,1,0.36,1);}
        .gs-parrilla-overlay.abierto .gs-parrilla-panel{transform:translateX(0);}
        .gs-parrilla-panel-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(59,130,246,0.1);font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14.5px;color:#1e293b;flex-shrink:0;}
        .gs-parrilla-panel-header span{display:flex;align-items:center;gap:8px;}
        .gs-parrilla-panel-body{flex:1;overflow-y:auto;padding:20px;}
        @media(max-width:640px){ .gs-parrilla-panel{width:100vw;} }
        @media(max-width:768px){ #gestoria-dashboard .gs-equipo-fila{grid-template-columns:1fr;} #gestoria-dashboard .gs-rol-fila{grid-template-columns:1fr;} }

        #gestoria-dashboard .gs-dropzone{border:2px dashed rgba(59,130,246,0.25);border-radius:14px;padding:26px 18px;text-align:center;cursor:pointer;transition:0.18s;background:#fafbff;}
        #gestoria-dashboard .gs-dropzone:hover, #gestoria-dashboard .gs-dropzone.gs-dragover{border-color:var(--teal);background:#f0f6ff;}
        #gestoria-dashboard .gs-dropzone svg{color:var(--teal2);margin-bottom:8px;}
        #gestoria-dashboard .gs-dropzone .gs-dz-titulo{font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;}
        #gestoria-dashboard .gs-dropzone .gs-dz-sub{font-size:11.5px;color:var(--text3);}
        #gestoria-dashboard .gs-logo-preview{display:flex;flex-direction:column;align-items:center;gap:10px;}
        #gestoria-dashboard .gs-logo-preview img{max-width:160px;max-height:80px;object-fit:contain;}

        #gestoria-dashboard .gs-summary-row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(59,130,246,0.07);font-size:12.5px;}
        #gestoria-dashboard .gs-summary-row:last-child{border-bottom:none;}
        #gestoria-dashboard .gs-summary-label{color:var(--text3);}
        #gestoria-dashboard .gs-summary-value{color:var(--text);font-weight:600;text-align:right;max-width:60%;}

        #gestoria-dashboard .gs-actions-bar{display:flex;align-items:center;gap:12px;margin-top:24px;padding-top:20px;border-top:1px solid rgba(59,130,246,0.10);}
        #gestoria-dashboard .gs-progreso{font-size:12.5px;color:var(--text2);display:flex;align-items:center;gap:8px;}
        #gestoria-dashboard .gs-progreso.gs-progreso-ok{color:#16803d;}
        #gestoria-dashboard .gs-progreso.gs-progreso-error{color:#b91c1c;}
        `;
        document.head.appendChild(style);
    }

    // ══════════════════════════════════════════════════════════
    // UI
    // ══════════════════════════════════════════════════════════
    function renderRail() {
        return `
        <div class="gs-rail">
            <div class="gs-rail-logo">${ICONO.edificio}</div>
            ${SECCIONES_GESTORIA.map(s => `
                <button class="gs-rail-btn${_seccionActual === s.id ? ' activo' : ''}" data-seccion="${s.id}" ${s.activa ? '' : 'disabled'}>
                    ${s.id === 'sasisopa' ? ICONO.carpeta : ICONO.graduacion}
                    <span class="gs-rail-tooltip">${s.titulo}${s.activa ? '' : ' (próximamente)'}</span>
                </button>`).join('')}
            <div class="gs-rail-divisor"></div>
            <button class="gs-rail-btn" data-accion="calendario">
                ${ICONO.calendario}
                <span class="gs-rail-tooltip">Parrilla de documentos</span>
            </button>
        </div>`;
    }

    function bindRail(cont) {
        cont.querySelectorAll('[data-seccion]').forEach(btn => {
            if (btn.disabled) return;
            btn.addEventListener('click', () => { _seccionActual = btn.dataset.seccion; cargarGestoria(); });
        });
        const btnCal = cont.querySelector('[data-accion="calendario"]');
        if (btnCal) btnCal.addEventListener('click', abrirPanelParrilla);
    }

    // ── Panel flotante de la Parrilla de Documentos ─────────────
    // Reutiliza el nodo real #area-parrilla-wrap (y toda su lógica ya
    // existente en index.html: listener de Firestore, renderCalAP,
    // etc.) en vez de duplicarla. Solo lo saca temporalmente de su
    // lugar mientras el panel está abierto, y lo regresa intacto al
    // cerrar para no afectar el comportamiento normal del portal en
    // otras áreas.
    let _parrillaNodoOriginal = { padre: null, siguiente: null };

    function crearOverlayParrilla() {
        let overlay = document.getElementById('gs-parrilla-overlay');
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = 'gs-parrilla-overlay';
        overlay.className = 'gs-parrilla-overlay';
        overlay.innerHTML = `
            <div class="gs-parrilla-panel">
                <div class="gs-parrilla-panel-header">
                    <span>${ICONO.calendario} Parrilla de documentos — Gestoría</span>
                    <button class="gs-btn gs-btn-ghost" id="gs-parrilla-cerrar">${ICONO.cerrar}</button>
                </div>
                <div class="gs-parrilla-panel-body" id="gs-parrilla-mount"></div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrarPanelParrilla(); });
        overlay.querySelector('#gs-parrilla-cerrar').addEventListener('click', cerrarPanelParrilla);
        return overlay;
    }

    function abrirPanelParrilla() {
        const nodo = document.getElementById('area-parrilla-wrap');
        const overlay = crearOverlayParrilla();
        const mount = overlay.querySelector('#gs-parrilla-mount');
        if (nodo) {
            if (!_parrillaNodoOriginal.padre) {
                _parrillaNodoOriginal.padre = nodo.parentNode;
                _parrillaNodoOriginal.siguiente = nodo.nextSibling;
            }
            mount.appendChild(nodo);
            nodo.style.display = 'block';
            nodo.style.margin = '0';
            if (window.apAreaActual !== undefined) window.apAreaActual = 'Gestoría';
            if (typeof window.actualizarLabelAP === 'function') window.actualizarLabelAP();
        } else {
            mount.innerHTML = `<div class="gs-empty">${ICONO.carpeta}<p>La Parrilla de Documentos no está disponible en esta página.</p></div>`;
        }
        requestAnimationFrame(() => overlay.classList.add('abierto'));
    }

    function cerrarPanelParrilla() {
        const overlay = document.getElementById('gs-parrilla-overlay');
        if (!overlay) return;
        overlay.classList.remove('abierto');
        setTimeout(() => {
            const nodo = document.getElementById('area-parrilla-wrap');
            if (nodo && _parrillaNodoOriginal.padre) {
                nodo.style.display = 'none';
                _parrillaNodoOriginal.padre.insertBefore(nodo, _parrillaNodoOriginal.siguiente);
            }
        }, 260);
    }

    async function cargarGestoria() {
        inyectarEstilosGestoria();
        const cont = document.getElementById('gestoria-dashboard');
        if (!cont) return;

        cont.innerHTML = `<div class="gs-shell">${renderRail()}<div class="gs-content"><div class="gs-body"><div class="gs-empty">Cargando clientes…</div></div></div></div>`;
        bindRail(cont);
        const clientes = await listarClientes();
        renderListaClientes(cont, clientes);
    }

    function clienteCompleto(c) {
        return sistemaActivo().camposObligatorios.every(k => (c[k] || '').trim());
    }

    function renderListaClientes(cont, clientes) {
        const sis = sistemaActivo();
        const filtrados = _filtroTexto
            ? clientes.filter(c => (c[sis.campoNombre] || '').toLowerCase().includes(_filtroTexto.toLowerCase()))
            : clientes;
        const completos = clientes.filter(clienteCompleto).length;

        cont.innerHTML = `<div class="gs-shell">${renderRail()}<div class="gs-content">
            <div class="gs-topbar"><div><div class="gs-eyebrow">Gestoría</div><div class="gs-title">${sis.nombre}</div><div class="gs-subtitle">${sis.subtitulo}</div></div></div>
            <div class="gs-body">
                <div class="gs-kpis">
                    <div class="gs-kpi-card"><div class="gs-kpi-label">Total de clientes</div><div class="gs-kpi-value">${clientes.length}</div></div>
                    <div class="gs-kpi-card"><div class="gs-kpi-label">Listos para generar</div><div class="gs-kpi-value">${completos}</div></div>
                    <div class="gs-kpi-card"><div class="gs-kpi-label">Datos incompletos</div><div class="gs-kpi-value">${clientes.length - completos}</div></div>
                </div>

                <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
                    <div class="gs-searchbar">${ICONO.buscar}<input id="gs-buscador" type="text" placeholder="Buscar cliente..." value="${_filtroTexto.replace(/"/g,'&quot;')}"></div>
                    <button id="gs-btn-nuevo" class="gs-btn gs-btn-primary">${ICONO.mas} Nuevo cliente</button>
                </div>

                <div class="gs-card">
                    <div id="gs-tabla-wrap"></div>
                </div>
            </div>
        </div></div>`;
        bindRail(cont);

        const wrap = cont.querySelector('#gs-tabla-wrap');
        if (filtrados.length === 0) {
            wrap.innerHTML = `<div class="gs-empty">
                ${ICONO.carpeta}
                <p>${clientes.length === 0 ? 'Aún no hay clientes capturados.' : 'Ningún cliente coincide con tu búsqueda.'}</p>
                ${clientes.length === 0 ? `<button class="gs-btn gs-btn-primary" id="gs-btn-nuevo-vacio">${ICONO.mas} Crear el primero</button>` : ''}
            </div>`;
            const btnVacio = wrap.querySelector('#gs-btn-nuevo-vacio');
            if (btnVacio) btnVacio.addEventListener('click', () => renderFormularioCliente(cont, null));
        } else {
            wrap.innerHTML = `
            <table class="gs-table">
                <thead><tr>${sis.columnasTabla.map(col => `<th>${col.titulo}</th>`).join('')}<th>Estado</th><th></th></tr></thead>
                <tbody>
                    ${filtrados.map(c => `
                        <tr data-id="${c.id}">
                            ${sis.columnasTabla.map((col, i) => i === 0
                                ? `<td style="display:flex;align-items:center;gap:10px;">
                                    ${c.LOGO_BASE64 ? `<img src="${c.LOGO_BASE64}" style="width:28px;height:28px;object-fit:contain;border-radius:6px;background:#f1f5f9;">` : `<div style="width:28px;height:28px;border-radius:6px;background:#eef2f9;display:flex;align-items:center;justify-content:center;color:var(--text3);">${ICONO.edificio}</div>`}
                                    <strong>${col.valor(c)}</strong>
                                   </td>`
                                : `<td>${col.valor(c)}</td>`).join('')}
                            <td>${clienteCompleto(c)
                                ? `<span class="gs-badge gs-badge-ok">${ICONO.check} Completo</span>`
                                : `<span class="gs-badge gs-badge-warn">${ICONO.alerta} Incompleto</span>`}</td>
                            <td><button class="gs-btn gs-btn-ghost" data-editar="${c.id}">${ICONO.editar} Editar</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
            wrap.querySelectorAll('tr[data-id]').forEach(tr => {
                tr.addEventListener('click', () => renderFormularioCliente(cont, tr.dataset.id));
            });
        }

        cont.querySelector('#gs-btn-nuevo').addEventListener('click', () => renderFormularioCliente(cont, null));
        const buscador = cont.querySelector('#gs-buscador');
        buscador.addEventListener('input', () => { _filtroTexto = buscador.value; renderListaClientes(cont, _clientesCache); });
        buscador.focus();
        buscador.setSelectionRange(buscador.value.length, buscador.value.length);
    }

    function redimensionarImagen(file, maxDim = 320) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    const escala = Math.min(1, maxDim / Math.max(width, height));
                    width = Math.round(width * escala);
                    height = Math.round(height * escala);
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function renderSeccionForm(sec, cliente) {
        if (sec.tipo === 'escolaridad_dinamica') {
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div class="gs-subtitle" style="margin-bottom:10px;">Solo aparecen los roles marcados en el organigrama de arriba.</div>
                    <div class="gs-grid">
                        ${sec.fuente.map(rol => {
                            const oculto = !cliente[rol.clave]; // se ajusta también al vuelo con bindSeccionesEspeciales
                            return `
                            <div class="gs-field" data-depende-de="${rol.clave}" style="${oculto ? 'display:none;' : ''}">
                                <label>Escolaridad — ${rol.etiqueta}</label>
                                <input type="text" data-clave="${rol.escolaridadClave}" placeholder="${sec.ejemplos[rol.escolaridadClave] || ''}"
                                    value="${(cliente[rol.escolaridadClave] || '').replace(/"/g,'&quot;')}">
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        }
        if (sec.tipo === 'checklist_con_nombre') {
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div class="gs-subtitle" style="margin-bottom:10px;">Marca los roles que existen en esta estación y el nombre de quien los ocupa. Si una persona cubre dos roles, marca ambos y repite el nombre.</div>
                    <div class="gs-checklist-roles">
                        ${sec.opciones.map(op => {
                            const valorActual = cliente[op.clave] || '';
                            const marcado = !!valorActual || op.obligatorio;
                            return `
                            <div class="gs-rol-fila" data-rol="${op.clave}">
                                <label class="gs-rol-check">
                                    <input type="checkbox" data-rol-check="${op.clave}" ${marcado ? 'checked' : ''} ${op.obligatorio ? 'disabled' : ''}>
                                    <span>${op.etiqueta}${op.obligatorio ? '<span class="gs-req">*</span>' : ''}</span>
                                </label>
                                <input type="text" data-clave="${op.clave}" placeholder="Nombre de quien ocupa este rol"
                                    value="${valorActual.replace(/"/g,'&quot;')}" ${marcado ? '' : 'disabled'}>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;
        }
        if (sec.tipo === 'tabla_dinamica') {
            const filas = Array.isArray(cliente.EQUIPOS) && cliente.EQUIPOS.length ? cliente.EQUIPOS : [{}];
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div id="gs-equipo-filas">
                        ${filas.map((fila, idx) => renderFilaEquipo(sec.columnas, fila, idx)).join('')}
                    </div>
                    <button type="button" id="gs-btn-add-equipo" class="gs-btn gs-btn-ghost" style="margin-top:10px;">${ICONO.mas} Agregar equipo</button>
                </div>
            </div>`;
        }
        return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div class="gs-grid">
                        ${sec.campos.map(([clave, etiqueta, ejemplo]) => `
                            <div class="gs-field">
                                <label>${etiqueta}${sistemaActivo().camposObligatorios.includes(clave) ? '<span class="gs-req">*</span>' : ''}</label>
                                <input type="text" data-clave="${clave}" placeholder="${ejemplo}"
                                    value="${(cliente[clave] || '').replace(/"/g,'&quot;')}">
                            </div>`).join('')}
                    </div>
                </div>
            </div>`;
    }

    function renderFilaEquipo(columnas, fila, idx) {
        return `<div class="gs-equipo-fila" data-idx="${idx}">
            ${columnas.map(col => `
                <div class="gs-field">
                    <label>${col.etiqueta}</label>
                    <input type="text" data-equipo-campo="${col.clave}" placeholder="${col.ejemplo}" value="${(fila[col.clave] || '').replace(/"/g,'&quot;')}">
                </div>`).join('')}
            <button type="button" class="gs-btn gs-btn-ghost gs-btn-quitar-equipo" title="Quitar este equipo">✕</button>
        </div>`;
    }

    function bindSeccionesEspeciales(cont) {
        cont.querySelectorAll('.gs-rol-fila').forEach(fila => {
            const check = fila.querySelector('input[type="checkbox"]');
            const texto = fila.querySelector('input[type="text"]');
            check.addEventListener('change', () => {
                texto.disabled = !check.checked;
                if (!check.checked) texto.value = '';
                cont.querySelectorAll(`[data-depende-de="${fila.dataset.rol}"]`).forEach(campo => {
                    campo.style.display = check.checked ? '' : 'none';
                    if (!check.checked) { const inp = campo.querySelector('input'); if (inp) inp.value = ''; }
                });
                actualizarPreview(cont);
            });
        });
        const contEquipo = cont.querySelector('#gs-equipo-filas');
        if (contEquipo) {
            const columnas = sistemaActivo().seccionesForm.find(s => s.tipo === 'tabla_dinamica').columnas;
            const btnAdd = cont.querySelector('#gs-btn-add-equipo');
            const reindexar = () => {
                contEquipo.querySelectorAll('.gs-equipo-fila').forEach((f, i) => f.dataset.idx = i);
                contEquipo.querySelectorAll('.gs-btn-quitar-equipo').forEach(b => {
                    b.onclick = () => { if (contEquipo.children.length > 1) { b.closest('.gs-equipo-fila').remove(); reindexar(); } };
                });
            };
            btnAdd.addEventListener('click', () => {
                contEquipo.insertAdjacentHTML('beforeend', renderFilaEquipo(columnas, {}, contEquipo.children.length));
                reindexar();
            });
            reindexar();
        }
    }

    function renderFormularioCliente(cont, clienteId) {
        _clienteActualId = clienteId;
        const sis = sistemaActivo();
        const cliente = clienteId ? (_clientesCache.find(c => c.id === clienteId) || {}) : {};
        _logoDataUrlActual = cliente.LOGO_BASE64 || null;

        const seccionesHtml = sis.seccionesForm.map(sec => renderSeccionForm(sec, cliente)).join('');

        cont.innerHTML = `<div class="gs-shell">${renderRail()}<div class="gs-content">
            <div class="gs-topbar"><div><div class="gs-eyebrow">Gestoría</div><div class="gs-title">${clienteId ? 'Editar cliente' : 'Nuevo cliente'}</div><div class="gs-subtitle">${sis.nombre}</div></div></div>
            <div class="gs-body">
                <button id="gs-btn-volver" class="gs-btn gs-btn-ghost" style="margin-bottom:14px;padding-left:0;">${ICONO.flecha} Volver a clientes</button>
                <div class="gs-form-grid">
                    <div id="gs-columna-form">${seccionesHtml}</div>

                    <div id="gs-columna-lateral">
                        <div class="gs-card">
                            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.imagen}</span><span class="gs-card-title">Logotipo del cliente</span></div>
                            <div class="gs-card-body">
                                <div id="gs-dropzone" class="gs-dropzone">
                                    <input type="file" id="gs-input-logo" accept="image/png,image/jpeg" style="display:none;">
                                    <div id="gs-dropzone-contenido"></div>
                                </div>
                                <div class="gs-subtitle" style="margin-top:10px;font-size:11px;">Se inserta automáticamente donde el machote dice "LOGO". PNG con fondo transparente recomendado.</div>
                            </div>
                        </div>

                        <div class="gs-card">
                            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.edificio}</span><span class="gs-card-title">Vista previa</span></div>
                            <div class="gs-card-body" id="gs-preview-body"></div>
                        </div>
                    </div>
                </div>

                <div class="gs-actions-bar">
                    <button id="gs-btn-guardar" class="gs-btn gs-btn-secondary">Guardar</button>
                    <button id="gs-btn-generar" class="gs-btn gs-btn-primary">${ICONO.descarga} Generar y descargar documentos</button>
                    <div id="gs-progreso" class="gs-progreso"></div>
                </div>
            </div>
        </div></div>`;

        bindRail(cont);
        renderDropzone(cont);
        bindSeccionesEspeciales(cont);
        actualizarPreview(cont);
        cont.querySelectorAll('#gs-columna-form input[data-clave], #gs-columna-form input[data-equipo-campo]').forEach(inp => {
            inp.addEventListener('input', () => actualizarPreview(cont));
        });
        cont.querySelector('#gs-btn-volver').addEventListener('click', cargarGestoria);
        cont.querySelector('#gs-btn-guardar').addEventListener('click', async () => {
            const datos = leerFormulario(cont);
            const id = await guardarCliente(_clienteActualId, datos);
            _clienteActualId = id;
            mostrarProgreso(cont, 'ok', ICONO.check + ' Guardado correctamente.');
        });
        cont.querySelector('#gs-btn-generar').addEventListener('click', () => generarDocumentos(cont));
    }

    function renderDropzone(cont) {
        const dz = cont.querySelector('#gs-dropzone');
        const contenido = cont.querySelector('#gs-dropzone-contenido');
        const input = cont.querySelector('#gs-input-logo');

        function pintar() {
            contenido.innerHTML = _logoDataUrlActual
                ? `<div class="gs-logo-preview"><img src="${_logoDataUrlActual}"><span style="font-size:11.5px;color:var(--teal2);font-weight:700;">Cambiar logotipo</span></div>`
                : `${ICONO.imagen}<div class="gs-dz-titulo">Arrastra el logo aquí</div><div class="gs-dz-sub">o haz clic para seleccionar — PNG o JPG</div>`;
        }
        pintar();

        dz.addEventListener('click', () => input.click());
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('gs-dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('gs-dragover'));
        dz.addEventListener('drop', async (e) => {
            e.preventDefault(); dz.classList.remove('gs-dragover');
            if (e.dataTransfer.files[0]) { _logoDataUrlActual = await redimensionarImagen(e.dataTransfer.files[0]); pintar(); }
        });
        input.addEventListener('change', async () => {
            if (input.files[0]) { _logoDataUrlActual = await redimensionarImagen(input.files[0]); pintar(); }
        });
    }

    function actualizarPreview(cont) {
        const datos = leerFormulario(cont);
        const body = cont.querySelector('#gs-preview-body');
        if (!body) return;
        let filas;
        if (_seccionActual === 'sgm') {
            filas = [
                ['Representante', datos.NOMBRE_REPRESENTANTE],
                ['Permiso', datos.NUMERO_PERMISO],
                ['Elabora', datos.NOMBRE_ELABORA],
                ['Fecha', datos.FECHA_ELABORACION],
                ['Roles capturados', SGM_ROLES_DISPONIBLES.filter(r => datos[r.clave]).length + ' de ' + SGM_ROLES_DISPONIBLES.length],
                ['Equipos capturados', (datos.EQUIPOS || []).filter(e => e.marca || e.modelo || e.numero_serie).length],
            ];
        } else {
            filas = [
                ['Razón Social', datos.RAZON_SOCIAL],
                ['RFC', datos.RFC],
                ['Domicilio', datos.DOMICILIO_ESTACION],
                ['Ciudad', datos.CIUDAD_ESTADO],
                ['Permiso', datos.NUMERO_PERMISO],
                ['Fecha', datos.FECHA_ELABORACION],
            ];
        }
        body.innerHTML = filas.map(([l, v]) => `
            <div class="gs-summary-row"><span class="gs-summary-label">${l}</span><span class="gs-summary-value">${v || '—'}</span></div>`).join('');
    }

    function leerFormulario(cont) {
        const datos = {};
        cont.querySelectorAll('#gs-columna-form input[data-clave]').forEach(input => {
            if (input.disabled) return;
            if (input.type === 'text' && input.value.trim()) datos[input.dataset.clave] = input.value.trim();
        });
        const contEquipo = cont.querySelector('#gs-equipo-filas');
        if (contEquipo) {
            const equipos = Array.from(contEquipo.querySelectorAll('.gs-equipo-fila')).map(fila => {
                const obj = {};
                fila.querySelectorAll('input[data-equipo-campo]').forEach(inp => { obj[inp.dataset.equipoCampo] = inp.value.trim(); });
                return obj;
            }).filter(e => Object.values(e).some(v => v));
            if (equipos.length) datos.EQUIPOS = equipos;
        }
        if (_logoDataUrlActual) datos.LOGO_BASE64 = _logoDataUrlActual;
        return datos;
    }

    function mostrarProgreso(cont, tipo, html) {
        const el = cont.querySelector('#gs-progreso');
        el.className = 'gs-progreso' + (tipo === 'ok' ? ' gs-progreso-ok' : tipo === 'error' ? ' gs-progreso-error' : '');
        el.innerHTML = html;
    }

    async function generarDocumentos(cont) {
        const sis = sistemaActivo();
        const datos = leerFormulario(cont);
        const faltantes = sis.camposObligatorios.filter(k => !datos[k]);
        if (faltantes.length) {
            mostrarProgreso(cont, 'error', ICONO.alerta + ' Completa los campos obligatorios marcados con * antes de generar.');
            cont.querySelectorAll('#gs-columna-form input[data-clave]').forEach(inp => {
                inp.classList.toggle('gs-input-error', faltantes.includes(inp.dataset.clave));
            });
            return;
        }

        const id = await guardarCliente(_clienteActualId, datos);
        _clienteActualId = id;

        mostrarProgreso(cont, '', ICONO.reloj + ' Descargando lista de machotes…');
        let manifest;
        try {
            manifest = await (await fetch(sis.rutaMachotes + 'manifest.json')).json();
        } catch (e) {
            mostrarProgreso(cont, 'error', ICONO.alerta + ' No se pudo leer ' + sis.rutaMachotes + 'manifest.json.');
            return;
        }

        const stats = { reemplazos: 0, placeholdersOmitidos: 0, logosInsertados: 0, logosPendientes: 0, pendientes: [] };
        const zipSalida = new JSZip();
        let procesados = 0, errores = [];

        for (const nombreArchivo of manifest.archivos) {
            mostrarProgreso(cont, '', ICONO.reloj + ` Procesando ${nombreArchivo} (${procesados + 1}/${manifest.archivos.length})…`);
            try {
                const buffer = await (await fetch(sis.rutaMachotes + nombreArchivo)).arrayBuffer();
                if (nombreArchivo.toLowerCase().endsWith('.docx')) {
                    const zipDoc = await JSZip.loadAsync(buffer);
                    const blobSalida = await procesarDocx(buffer, nombreArchivo, datos, stats, zipDoc);
                    zipSalida.file(nombreArchivo, blobSalida);
                } else {
                    // .xlsx (SOFT-) se copian sin personalizar por ahora —
                    // pendiente: aplicar el mismo motor a la hoja "Control".
                    zipSalida.file(nombreArchivo, buffer);
                }
                procesados++;
            } catch (e) {
                errores.push(`${nombreArchivo}: ${e.message}`);
            }
        }

        const reporte = [
            `REPORTE DE PERSONALIZACIÓN — PAQUETE ${sis.nombre}`,
            '='.repeat(60),
            `Archivos procesados: ${procesados}`,
            `Reemplazos aplicados: ${stats.reemplazos}`,
            `Logotipos insertados automáticamente: ${stats.logosInsertados}`,
            `Logotipos pendientes (no se cargó imagen): ${stats.logosPendientes}`,
            `Placeholders operativos omitidos (NOMBRE/AÑO): ${stats.placeholdersOmitidos}`,
            `Pendientes de revisión manual: ${stats.pendientes.length}`,
            '',
            ...(errores.length ? ['ARCHIVOS CON ERROR:', ...errores.map(e => '  - ' + e), ''] : []),
            ...(stats.pendientes.length ? ['PENDIENTES:', ...stats.pendientes.map(p => '  - "' + p + '"'), ''] : []),
            ...(sis.id === 'sasisopa' ? [
                'RECORDATORIO: el organigrama gráfico embebido en P-05 (dibujo de Word)',
                'no es editado por este generador.',
            ] : [
                'RECORDATORIO: las hojas .xlsx (SOFT-) se copiaron sin personalizar la',
                'hoja "Control" — pendiente de implementar.',
            ]),
        ].join('\n');
        zipSalida.file('reporte_personalizacion.txt', reporte);

        mostrarProgreso(cont, '', ICONO.reloj + ' Generando paquete .zip final…');
        const blobFinal = await zipSalida.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blobFinal);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sis.nombre}_${(datos[sis.campoNombre] || 'cliente').replace(/[^a-z0-9]+/gi, '_')}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);

        mostrarProgreso(cont, 'ok', `${ICONO.check} Listo: ${stats.reemplazos} reemplazos, ${stats.logosInsertados} logo(s) insertado(s), ${stats.pendientes.length} pendientes. Reporte incluido en el .zip.`);
    }

    window.cargarGestoria = cargarGestoria;
})();
