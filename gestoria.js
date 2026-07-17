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
        { id: 'certificado', titulo: 'Certificado TECNOLAB', activa: true },
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
        certificado:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.5 13.5 6 22l6-3 6 3-2.5-8.5"/></svg>',
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

        /* ── Certificado TECNOLAB ─────────────────────────────────── */
        #gestoria-dashboard .gs-cert-seccion-titulo{font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--teal2);margin:18px 0 10px;}
        #gestoria-dashboard .gs-cert-seccion-titulo:first-child{margin-top:0;}
        #gestoria-dashboard .gs-cert-resultado-fila{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed rgba(59,130,246,0.15);}
        #gestoria-dashboard .gs-cert-preview-frame{border:1px solid rgba(59,130,246,0.12);background:#fff;}
        @media(max-width:768px){ #gestoria-dashboard .gs-cert-resultado-fila{grid-template-columns:1fr 1fr;} }
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
                    ${s.id === 'sasisopa' ? ICONO.carpeta : s.id === 'sgm' ? ICONO.graduacion : ICONO.certificado}
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

        if (_seccionActual === 'certificado') {
            renderCertificadoTecnolab(cont);
            return;
        }

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



    // ══════════════════════════════════════════════════════════
    // CERTIFICADO TECNOLAB — llenado y exportación (PDF / Word / XML)
    // ══════════════════════════════════════════════════════════
    // A diferencia de SASISOPA/SGM (que personalizan machotes .docx
    // existentes por cliente y guardan un directorio en Firestore),
    // este sistema NO gestiona una lista de clientes ni persiste nada:
    // es una sola pantalla de llenado que reproduce el diseño fijo del
    // Certificado de Calibración de TECNOLAB y lo exporta en el acto.
    // Recargar la página pierde lo capturado — es intencional (así se
    // pidió), pero queda documentado aquí por si luego se decide sumar
    // guardado/folio consecutivo.

    const TECNOLAB_LOGO_B64 = 'data:image/png;base64,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';
    const TECNOLAB_ACCENT = '#8a6d1f';

    const TECNOLAB_REFERENCIAS = [
        'NMX-CH-140-IMNC-2002. Guía para Evaluación de la Incertidumbre en los Resultados de las Mediciones.',
        'NMX-EC-17025-IMNC-2006 ISO/IEC 17025:2005. Requisitos generales para la competencia de laboratorios de ensayo y de calibración.',
        'Guía Técnica de Metrología para laboratorios de Calibración del Área Temperatura. Termómetros Automáticos Fijos para Tanques.',
        'API MPMS 7.3 — Manual of Petroleum Measurement Standards, Ch. 7.3 Temperature Determination — Fixed Automatic Tank Temperature System.',
        'ISO 4266:2023 — Measurement of level and temperature in storage tanks by automatic methods, Part 4: Measurement of temperature in atmospheric tanks.',
        'RES/811/2015 — Apartado 3. Sistemas de medición en tanques de almacenamiento.',
        'ISO 4268 — Petroleum and liquid petroleum products — Temperature Measurements — Manual Methods.',
        'OIML R 85 — Automatic level gauges for measuring the level of liquid in stationary tanks, Part 2: Metrological control and test.',
        'ISO 4266 — Part 1: Measurement of level in atmospheric tanks.',
        'API MPMS 3.1A — Práctica Estándar para la Medición Manual de Petróleo y Productos de Petróleo.',
    ];

    const TECNOLAB_CAMPOS_OBLIGATORIOS = ['folio', 'clienteRazonSocial', 'fechaCalibracion', 'fechaEmision'];

    let _certDatos = null;
    let _certQrDataUrl = null;

    function certificadoDatosDefault() {
        return {
            folio: '', fechaCalibracion: '', fechaEmision: '', vigencia: '',
            clienteRazonSocial: '', clienteDireccion: '',
            instSondaMarca: '', instSondaModelo: '', instSondaSerie: '', instSondaId: '',
            instConsolaMarca: '', instConsolaModelo: '', instConsolaSerie: '', instConsolaId: '',
            instResolucion: '', instTipoTanque: '', instTipoLiquido: '',
            patTepMarca: '', patTepModelo: '', patTepSerie: '', patTepId: '', patTepTrazabilidad: '',
            patCintaMarca: '', patCintaModelo: '', patCintaSerie: '', patCintaId: '', patCintaTrazabilidad: '',
            lugarCalibracion: '', metodoCalibracion: '', tempAmbiente: '', humedad: '', presion: '',
            resultados: [{ patron: '', ibc: '', error: '', incertidumbre: '' }],
            observacionAdicional: '',
            calibroNombre: '', aproboNombre: '', aproboPuesto: '',
        };
    }

    function escHtmlCert(s) {
        return (s === undefined || s === null ? '' : String(s))
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function escAttrCert(s) {
        return (s === undefined || s === null ? '' : String(s)).replace(/"/g, '&quot;');
    }
    function vCert(s) { const t = (s || '').trim(); return t ? escHtmlCert(t) : '<span style="color:#b7a577;font-style:italic">—</span>'; }

    // ── Carga perezosa de qrcode-generator (solo para vista previa / export) ──
    let _qrLibPromesa = null;
    function cargarLibQR() {
        if (window.qrcode) return Promise.resolve();
        if (_qrLibPromesa) return _qrLibPromesa;
        _qrLibPromesa = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
            s.onload = () => resolve();
            s.onerror = () => resolve(); // sin QR si falla — el certificado sigue siendo usable
            document.head.appendChild(s);
        });
        return _qrLibPromesa;
    }

    function generarQrDataUrl(texto) {
        if (!window.qrcode || !texto) return null;
        try {
            const qr = window.qrcode(0, 'M');
            qr.addData(texto);
            qr.make();
            const count = qr.getModuleCount();
            const cell = 6, quiet = 4;
            const px = (count + quiet * 2) * cell;
            const canvas = document.createElement('canvas');
            canvas.width = px; canvas.height = px;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, px, px);
            ctx.fillStyle = TECNOLAB_ACCENT;
            for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) {
                if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
            }
            return canvas.toDataURL('image/png');
        } catch (e) { return null; }
    }

    // ══════════════════════════════════════════════════════════
    // FORMULARIO
    // ══════════════════════════════════════════════════════════
    function renderCertificadoTecnolab(cont) {
        if (!_certDatos) _certDatos = certificadoDatosDefault();

        cont.innerHTML = `<div class="gs-shell">${renderRail()}<div class="gs-content">
            <div class="gs-topbar"><div><div class="gs-eyebrow">Gestoría</div><div class="gs-title">Certificado TECNOLAB</div><div class="gs-subtitle">Llenado del Certificado de Calibración — se exporta al instante, no se guarda en el portal</div></div></div>
            <div class="gs-body">
                <div class="gs-form-grid" style="grid-template-columns:1.3fr 1fr;">
                    <div id="gs-cert-form"></div>
                    <div id="gs-cert-lateral">
                        <div class="gs-card">
                            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.certificado}</span><span class="gs-card-title">Vista previa</span></div>
                            <div class="gs-card-body" style="background:#e7ebf3;padding:16px;display:flex;justify-content:center;">
                                <div style="width:380px;height:980px;overflow:hidden;position:relative;box-shadow:0 4px 18px rgba(0,0,0,.18);">
                                    <iframe id="gs-cert-iframe" class="gs-cert-preview-frame" style="width:816px;height:1960px;border:0;transform:scale(.4657);transform-origin:top left;"></iframe>
                                </div>
                            </div>
                            <div class="gs-card-body" style="border-top:1px solid rgba(59,130,246,.08);">
                                <div class="gs-actions-bar" style="margin-top:0;padding-top:0;border-top:none;flex-wrap:wrap;">
                                    <button class="gs-btn gs-btn-primary" id="gs-cert-pdf">${ICONO.descarga} Generar PDF</button>
                                    <button class="gs-btn gs-btn-secondary" id="gs-cert-word">${ICONO.descarga} Exportar Word</button>
                                    <button class="gs-btn gs-btn-secondary" id="gs-cert-xml">${ICONO.descarga} Exportar XML</button>
                                </div>
                                <div class="gs-progreso" id="gs-cert-progreso" style="margin-top:10px;"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div></div>`;

        bindRail(cont);
        cont.querySelector('#gs-cert-form').innerHTML = renderFormularioCertificado(_certDatos);
        bindFormularioCertificado(cont);
        cargarLibQR().then(() => actualizarPreviewCertificado(cont));
    }

    function campoCert(id, label, valor, placeholder, obligatorio) {
        return `<div class="gs-field">
            <label>${label}${obligatorio ? '<span class="gs-req">*</span>' : ''}</label>
            <input type="text" data-cert="${id}" placeholder="${placeholder ? escAttrCert(placeholder) : ''}" value="${escAttrCert(valor)}">
        </div>`;
    }

    function renderFormularioCertificado(d) {
        return `
        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.carpeta}</span><span class="gs-card-title">Identificación del certificado</span></div>
            <div class="gs-card-body">
                <div class="gs-grid">
                    ${campoCert('folio', 'Certificado No.', d.folio, 'TL-CAL-2026-0001', true)}
                    ${campoCert('fechaCalibracion', 'Fecha de calibración', d.fechaCalibracion, 'DD/MM/AAAA', true)}
                    ${campoCert('fechaEmision', 'Fecha de emisión', d.fechaEmision, 'DD/MM/AAAA', true)}
                    ${campoCert('vigencia', 'Vigencia / próxima calibración', d.vigencia, 'DD/MM/AAAA')}
                </div>
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.edificio}</span><span class="gs-card-title">Datos del cliente</span></div>
            <div class="gs-card-body">
                ${campoCert('clienteRazonSocial', 'Nombre o razón social', d.clienteRazonSocial, 'Razón social del cliente', true)}
                <div style="margin-top:12px;">${campoCert('clienteDireccion', 'Dirección', d.clienteDireccion, 'Domicilio del cliente')}</div>
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.graduacion}</span><span class="gs-card-title">Datos del instrumento calibrado</span></div>
            <div class="gs-card-body">
                <div class="gs-cert-seccion-titulo">Sonda de temperatura</div>
                <div class="gs-grid">
                    ${campoCert('instSondaMarca', 'Marca', d.instSondaMarca)}
                    ${campoCert('instSondaModelo', 'Modelo', d.instSondaModelo)}
                    ${campoCert('instSondaSerie', 'No. de serie', d.instSondaSerie)}
                    ${campoCert('instSondaId', 'Identificación', d.instSondaId)}
                </div>
                <div class="gs-cert-seccion-titulo">Consola o lector</div>
                <div class="gs-grid">
                    ${campoCert('instConsolaMarca', 'Marca', d.instConsolaMarca)}
                    ${campoCert('instConsolaModelo', 'Modelo', d.instConsolaModelo)}
                    ${campoCert('instConsolaSerie', 'No. de serie', d.instConsolaSerie)}
                    ${campoCert('instConsolaId', 'Identificación', d.instConsolaId)}
                </div>
                <div class="gs-cert-seccion-titulo">Comunes a ambos</div>
                <div class="gs-grid">
                    ${campoCert('instResolucion', 'Resolución', d.instResolucion)}
                    ${campoCert('instTipoTanque', 'Tipo de tanque', d.instTipoTanque)}
                </div>
                <div style="margin-top:12px;">${campoCert('instTipoLiquido', 'Tipo de líquido', d.instTipoLiquido)}</div>
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.graduacion}</span><span class="gs-card-title">Patrones y equipos de medida utilizados</span></div>
            <div class="gs-card-body">
                <div class="gs-cert-seccion-titulo">TEP</div>
                <div class="gs-grid">
                    ${campoCert('patTepMarca', 'Marca', d.patTepMarca)}
                    ${campoCert('patTepModelo', 'Modelo', d.patTepModelo)}
                    ${campoCert('patTepSerie', 'No. de serie', d.patTepSerie)}
                    ${campoCert('patTepId', 'Identificación', d.patTepId)}
                </div>
                <div style="margin-top:12px;">${campoCert('patTepTrazabilidad', 'Trazabilidad metrológica', d.patTepTrazabilidad)}</div>
                <div class="gs-cert-seccion-titulo">Cinta con plomada</div>
                <div class="gs-grid">
                    ${campoCert('patCintaMarca', 'Marca', d.patCintaMarca)}
                    ${campoCert('patCintaModelo', 'Modelo', d.patCintaModelo)}
                    ${campoCert('patCintaSerie', 'No. de serie', d.patCintaSerie)}
                    ${campoCert('patCintaId', 'Identificación', d.patCintaId)}
                </div>
                <div style="margin-top:12px;">${campoCert('patCintaTrazabilidad', 'Trazabilidad metrológica', d.patCintaTrazabilidad)}</div>
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.reloj}</span><span class="gs-card-title">Datos de la calibración</span></div>
            <div class="gs-card-body">
                ${campoCert('lugarCalibracion', 'Lugar de calibración', d.lugarCalibracion)}
                <div style="margin-top:12px;">${campoCert('metodoCalibracion', 'Método de calibración', d.metodoCalibracion)}</div>
                <div class="gs-grid" style="margin-top:12px;">
                    ${campoCert('tempAmbiente', 'Temperatura ambiente (°C)', d.tempAmbiente)}
                    ${campoCert('humedad', 'Humedad relativa (%HR)', d.humedad)}
                </div>
                <div style="margin-top:12px;max-width:calc(50% - 7px);">${campoCert('presion', 'Presión atmosférica (Pa)', d.presion)}</div>
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.graduacion}</span><span class="gs-card-title">Resultados de calibración</span></div>
            <div class="gs-card-body">
                <div id="gs-cert-resultados">${d.resultados.map((r, i) => renderFilaResultado(r, i)).join('')}</div>
                <button type="button" class="gs-btn gs-btn-secondary" id="gs-cert-add-resultado">${ICONO.mas} Agregar fila</button>
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.alerta}</span><span class="gs-card-title">Observaciones</span></div>
            <div class="gs-card-body">
                <div class="gs-subtitle" style="margin-bottom:10px;">Las dos notas estándar del formato se incluyen siempre. Aquí solo se agrega texto adicional específico de este certificado, si aplica.</div>
                ${campoCert('observacionAdicional', 'Observación adicional (opcional)', d.observacionAdicional)}
            </div>
        </div>

        <div class="gs-card">
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.usuarios}</span><span class="gs-card-title">Firmas</span></div>
            <div class="gs-card-body">
                <div class="gs-grid">
                    ${campoCert('calibroNombre', 'Calibró — Nombre (Metrólogo)', d.calibroNombre)}
                    ${campoCert('aproboNombre', 'Aprobó — Nombre', d.aproboNombre)}
                </div>
                <div style="margin-top:12px;max-width:calc(50% - 7px);">${campoCert('aproboPuesto', 'Aprobó — Puesto', d.aproboPuesto)}</div>
            </div>
        </div>
        `;
    }

    function renderFilaResultado(r, idx) {
        return `<div class="gs-cert-resultado-fila" data-idx="${idx}">
            <div class="gs-field"><label>Temp. patrón (°C)</label><input type="text" data-resultado-campo="patron" value="${escAttrCert(r.patron)}"></div>
            <div class="gs-field"><label>Temp. IBC (°C)</label><input type="text" data-resultado-campo="ibc" value="${escAttrCert(r.ibc)}"></div>
            <div class="gs-field"><label>Error (°C)</label><input type="text" data-resultado-campo="error" value="${escAttrCert(r.error)}"></div>
            <div class="gs-field"><label>Incertidumbre k=2 (°C)</label><input type="text" data-resultado-campo="incertidumbre" value="${escAttrCert(r.incertidumbre)}"></div>
            <button type="button" class="gs-btn gs-btn-ghost gs-btn-quitar-equipo" title="Quitar esta fila">✕</button>
        </div>`;
    }

    function leerCertificadoDeFormulario(cont) {
        const d = {};
        cont.querySelectorAll('#gs-cert-form input[data-cert]').forEach(inp => { d[inp.dataset.cert] = inp.value; });
        const contRes = cont.querySelector('#gs-cert-resultados');
        d.resultados = Array.from(contRes ? contRes.querySelectorAll('.gs-cert-resultado-fila') : []).map(fila => {
            const obj = {};
            fila.querySelectorAll('input[data-resultado-campo]').forEach(inp => { obj[inp.dataset.resultadoCampo] = inp.value; });
            return obj;
        });
        if (!d.resultados.length) d.resultados = [{ patron: '', ibc: '', error: '', incertidumbre: '' }];
        return d;
    }

    function bindFormularioCertificado(cont) {
        const actualizar = () => {
            _certDatos = leerCertificadoDeFormulario(cont);
            actualizarPreviewCertificado(cont);
        };
        cont.querySelectorAll('#gs-cert-form input[data-cert]').forEach(inp => inp.addEventListener('input', actualizar));

        const contRes = cont.querySelector('#gs-cert-resultados');
        const reindexarResultados = () => {
            contRes.querySelectorAll('.gs-cert-resultado-fila').forEach((f, i) => f.dataset.idx = i);
            contRes.querySelectorAll('.gs-btn-quitar-equipo').forEach(b => {
                b.onclick = () => {
                    if (contRes.children.length > 1) { b.closest('.gs-cert-resultado-fila').remove(); reindexarResultados(); actualizar(); }
                };
            });
            contRes.querySelectorAll('input[data-resultado-campo]').forEach(inp => {
                inp.removeEventListener('input', actualizar);
                inp.addEventListener('input', actualizar);
            });
        };
        cont.querySelector('#gs-cert-add-resultado').addEventListener('click', () => {
            contRes.insertAdjacentHTML('beforeend', renderFilaResultado({ patron: '', ibc: '', error: '', incertidumbre: '' }, contRes.children.length));
            reindexarResultados();
        });
        reindexarResultados();

        cont.querySelector('#gs-cert-pdf').addEventListener('click', () => exportarCertificadoPDF(cont));
        cont.querySelector('#gs-cert-word').addEventListener('click', () => exportarCertificadoWord(cont));
        cont.querySelector('#gs-cert-xml').addEventListener('click', () => exportarCertificadoXML(cont));
    }

    function mostrarProgresoCert(cont, tipo, html) {
        const el = cont.querySelector('#gs-cert-progreso');
        if (!el) return;
        el.className = 'gs-progreso' + (tipo === 'ok' ? ' gs-progreso-ok' : tipo === 'error' ? ' gs-progreso-error' : '');
        el.innerHTML = html;
    }

    // ══════════════════════════════════════════════════════════
    // CONSTRUCCIÓN DEL HTML DEL CERTIFICADO (fuente única para
    // vista previa, PDF y Word — así el diseño nunca se desincroniza)
    // ══════════════════════════════════════════════════════════
    function construirHTMLCertificado(d, qrDataUrl) {
        const acc = TECNOLAB_ACCENT;
        const qrImg = qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR de verificación" style="width:92px;height:92px;display:block;">`
            : `<div style="width:92px;height:92px;background:repeating-linear-gradient(45deg,#f3ecda,#f3ecda 4px,#e8dcbf 4px,#e8dcbf 8px)"></div>`;
        const qrImgChica = qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR" style="width:60px;height:60px;display:block;">`
            : `<div style="width:60px;height:60px;background:repeating-linear-gradient(45deg,#f3ecda,#f3ecda 4px,#e8dcbf 4px,#e8dcbf 8px)"></div>`;

        const filasResultados = (d.resultados && d.resultados.length ? d.resultados : [{}]).map(r => `
            <tr>
                <td style="padding:5px 6px;height:15px;border:1px solid #d9caa8;font-size:10px;text-align:center;">${escHtmlCert(r.patron)}</td>
                <td style="padding:5px 6px;border:1px solid #d9caa8;font-size:10px;text-align:center;">${escHtmlCert(r.ibc)}</td>
                <td style="padding:5px 6px;border:1px solid #d9caa8;font-size:10px;text-align:center;">${escHtmlCert(r.error)}</td>
                <td style="padding:5px 6px;border:1px solid #d9caa8;font-size:10px;text-align:center;">${escHtmlCert(r.incertidumbre)}</td>
            </tr>`).join('');

        const refsHtml = TECNOLAB_REFERENCIAS.map(r => `<li style="margin-bottom:2px;">${escHtmlCert(r)}</li>`).join('');

        const firmaCalibro = `
            <div style="flex:1;text-align:center;">
                <div style="border-bottom:1px solid #6e5a30;height:34px;margin:0 6px;"></div>
                <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${acc};margin-top:5px;">Calibró</div>
                <div style="font-size:9px;color:#6e5a30;margin-top:2px;">${vCert(d.calibroNombre)} · Metrólogo</div>
            </div>`;
        const firmaAprobo = `
            <div style="flex:1;text-align:center;">
                <div style="border-bottom:1px solid #6e5a30;height:34px;margin:0 6px;"></div>
                <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${acc};margin-top:5px;">Aprobó</div>
                <div style="font-size:9px;color:#6e5a30;margin-top:2px;">${vCert(d.aproboNombre)} · ${vCert(d.aproboPuesto)}</div>
            </div>`;

        return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:#ccc;font-family:'IBM Plex Sans',system-ui,sans-serif;}
  .hoja{width:816px;min-height:1056px;background:#fff;padding:48px;color:#33291a;line-height:1.35;margin:0 auto 12px;}
  table{border-collapse:collapse;width:100%;}
  @media print{
    body{background:#fff;}
    .hoja{margin:0;box-shadow:none;break-after:page;}
    .hoja:last-child{break-after:auto;}
  }
</style>
</head><body>

<div class="hoja">
  <div style="display:flex;gap:14px;align-items:stretch;border-bottom:3px solid ${acc};padding-bottom:10px;">
    <div style="width:238px;min-width:238px;height:99px;display:flex;align-items:center;justify-content:flex-start;"><img src="${TECNOLAB_LOGO_B64}" alt="TECNOLAB" style="max-width:100%;max-height:92px;object-fit:contain;display:block;"></div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
      <div style="font-family:'IBM Plex Serif',Georgia,serif;font-weight:700;font-size:15px;color:${acc};letter-spacing:.01em;">TECNOLAB ENSAYO Y CALIBRACIÓN S.A. DE C.V.</div>
      <div style="font-size:9.5px;color:#6e5a30;margin-top:3px;">Avenida Fuerza Aérea Mexicana No. 7030 Int. B2, colonia Tabalaopa · Tel. 614 176 1255</div>
      <div style="font-size:9.5px;color:#6e5a30;">calidad@tecnolab.com.mx</div>
      <div style="font-size:8.5px;color:#8a7647;margin-top:3px;">Número de Acreditación y Entidad de Acreditación: <span style="color:#b7a577;font-style:italic;">ema — Clave D-000-000</span></div>
    </div>
    <div style="width:118px;min-width:118px;border:1px solid #d9caa8;border-radius:4px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;background:#fff;">${qrImg}</div>
      <div style="font-size:7px;text-transform:uppercase;letter-spacing:.06em;color:#8a7647;text-align:center;line-height:1.3;">Verificación en línea</div>
    </div>
  </div>

  <div style="background:${acc};color:#fff;text-align:center;padding:8px;margin-top:10px;border-radius:2px;">
    <div style="font-family:'IBM Plex Serif',Georgia,serif;font-weight:700;font-size:18px;letter-spacing:.14em;">CERTIFICADO DE CALIBRACIÓN</div>
  </div>

  <table style="margin-top:8px;">
    <tr>
      <td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;width:24%;">CERTIFICADO NO.</td>
      <td style="padding:5px 8px;font-size:11px;color:#33291a;border:1px solid #d9caa8;width:26%;font-family:'IBM Plex Mono',monospace;font-weight:500;">${vCert(d.folio)}</td>
      <td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;width:24%;">Fecha de calibración</td>
      <td style="padding:5px 8px;font-size:10.5px;color:#33291a;border:1px solid #d9caa8;">${vCert(d.fechaCalibracion)}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">FECHA DE EMISIÓN</td>
      <td style="padding:5px 8px;font-size:10.5px;color:#33291a;border:1px solid #d9caa8;">${vCert(d.fechaEmision)}</td>
      <td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Vigencia / próxima calibración</td>
      <td style="padding:5px 8px;font-size:10.5px;color:#33291a;border:1px solid #d9caa8;">${vCert(d.vigencia)}</td>
    </tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos del cliente</div>
  <table>
    <tr><td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;width:24%;">Nombre o razón social</td><td style="padding:5px 8px;font-size:10.5px;color:#33291a;border:1px solid #d9caa8;">${vCert(d.clienteRazonSocial)}</td></tr>
    <tr><td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Dirección</td><td style="padding:5px 8px;font-size:10.5px;color:#33291a;border:1px solid #d9caa8;">${vCert(d.clienteDireccion)}</td></tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos del instrumento calibrado</div>
  <table style="table-layout:fixed;">
    <tr>
      <td style="border:1px solid #d9caa8;background:#e9dcc0;width:22%;"></td>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:9px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">Sonda de temperatura</th>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:9px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">Consola o lector</th>
    </tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Marca</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instSondaMarca)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instConsolaMarca)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Modelo</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instSondaModelo)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instConsolaModelo)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">No. de Serie</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instSondaSerie)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instConsolaSerie)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Identificación</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instSondaId)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instConsolaId)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Resolución</td><td colspan="2" style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instResolucion)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Tipo de tanque</td><td colspan="2" style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instTipoTanque)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Tipo de líquido</td><td colspan="2" style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.instTipoLiquido)}</td></tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos de los patrones y equipos de medida utilizados</div>
  <table style="table-layout:fixed;">
    <tr>
      <td style="border:1px solid #d9caa8;background:#e9dcc0;width:22%;"></td>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:9px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">TEP</th>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:9px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">Cinta con plomada</th>
    </tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Marca</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patTepMarca)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patCintaMarca)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Modelo</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patTepModelo)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patCintaModelo)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">No. de Serie</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patTepSerie)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patCintaSerie)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Identificación</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patTepId)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patCintaId)}</td></tr>
    <tr><td style="padding:4px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Trazabilidad metrológica</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patTepTrazabilidad)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.patCintaTrazabilidad)}</td></tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos de la calibración</div>
  <table>
    <tr><td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;width:24%;">Lugar de calibración</td><td style="padding:5px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.lugarCalibracion)}</td></tr>
    <tr><td style="padding:5px 8px;background:#efe6d1;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#6e5a30;border:1px solid #d9caa8;">Método de calibración</td><td style="padding:5px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.metodoCalibracion)}</td></tr>
  </table>
  <table style="table-layout:fixed;margin-top:-1px;">
    <tr>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:8.5px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">Temperatura ambiente (°C)</th>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:8.5px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">Humedad Relativa (%HR)</th>
      <th style="padding:5px 8px;background:#e9dcc0;font-size:8.5px;font-weight:700;color:${acc};border:1px solid #d9caa8;text-align:left;">Presión Atmosférica (Pa)</th>
    </tr>
    <tr>
      <td style="padding:5px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.tempAmbiente)}</td>
      <td style="padding:5px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.humedad)}</td>
      <td style="padding:5px 8px;font-size:10.5px;border:1px solid #d9caa8;">${vCert(d.presion)}</td>
    </tr>
  </table>

  <div style="display:flex;gap:24px;margin-top:22px;">${firmaCalibro}${firmaAprobo}</div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:6px;border-top:1px solid #d9caa8;font-family:'IBM Plex Mono',monospace;font-size:7.5px;color:#a08b57;">
    <span>FOR-023 rev0 / Ref: PROC-006</span><span>Página 1 de 2</span>
  </div>
</div>

<div class="hoja">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${acc};padding-bottom:8px;">
    <div>
      <div style="font-family:'IBM Plex Serif',Georgia,serif;font-weight:700;font-size:13px;color:${acc};">TECNOLAB ENSAYO Y CALIBRACIÓN S.A. DE C.V.</div>
      <div style="font-size:9px;color:#6e5a30;">Certificado de Calibración · <span style="font-style:italic;color:#b7a577;">${escHtmlCert(d.folio || '—')}</span></div>
    </div>
    <div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;">${qrImgChica}</div>
  </div>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Resultados de calibración</div>
  <div style="font-size:10px;color:#6e5a30;margin:7px 2px;">En la siguiente tabla se muestran los resultados de calibración:</div>
  <table style="table-layout:fixed;">
    <thead>
      <tr>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #c7b184;line-height:1.25;">Temperatura del Patrón</th>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #c7b184;line-height:1.25;">Temperatura del IBC</th>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #c7b184;line-height:1.25;">Error</th>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #c7b184;line-height:1.25;">Incertidumbre k=2</th>
      </tr>
      <tr>
        <th style="padding:2px;background:#e9dcc0;color:#6e5a30;font-size:8px;font-weight:600;border:1px solid #d9caa8;">°C</th>
        <th style="padding:2px;background:#e9dcc0;color:#6e5a30;font-size:8px;font-weight:600;border:1px solid #d9caa8;">°C</th>
        <th style="padding:2px;background:#e9dcc0;color:#6e5a30;font-size:8px;font-weight:600;border:1px solid #d9caa8;">°C</th>
        <th style="padding:2px;background:#e9dcc0;color:#6e5a30;font-size:8px;font-weight:600;border:1px solid #d9caa8;">°C</th>
      </tr>
    </thead>
    <tbody>${filasResultados}</tbody>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:14px;">(8) Observaciones</div>
  <ul style="margin:8px 0 0;padding-left:18px;font-size:9.5px;color:#33291a;line-height:1.5;">
    <li>Los resultados mostrados se relacionan solamente con el ítem bajo calibración indicado en esta hoja.</li>
    <li>El Laboratorio es responsable de la información emitida en el informe, a excepción de la información otorgada por el cliente.</li>
    ${d.observacionAdicional && d.observacionAdicional.trim() ? `<li>${escHtmlCert(d.observacionAdicional.trim())}</li>` : ''}
  </ul>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:14px;">(9) Referencias</div>
  <ol style="margin:8px 0 0;padding-left:20px;font-size:8px;color:#6e5a30;line-height:1.45;">${refsHtml}</ol>

  <div style="display:flex;gap:24px;margin-top:20px;">${firmaCalibro}${firmaAprobo}</div>

  <div style="margin-top:16px;padding:8px 10px;background:#efe6d1;border-left:3px solid ${acc};font-size:8.5px;color:#6e5a30;font-style:italic;">El presente documento no debe de ser reproducido o alterado en forma parcial o total sin la autorización expresa y por escrito del Laboratorio.</div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:6px;border-top:1px solid #d9caa8;font-family:'IBM Plex Mono',monospace;font-size:7.5px;color:#a08b57;">
    <span>FOR-023 rev0 / Ref: PROC-006</span><span>Página 2 de 2</span>
  </div>
</div>

</body></html>`;
    }

    function actualizarPreviewCertificado(cont) {
        const iframe = cont.querySelector('#gs-cert-iframe');
        if (!iframe) return;
        const d = _certDatos || certificadoDatosDefault();
        const url = 'https://tecnolab.com.mx/verificar?folio=' + encodeURIComponent(d.folio || '');
        _certQrDataUrl = generarQrDataUrl(d.folio ? url : null);
        iframe.srcdoc = construirHTMLCertificado(d, _certQrDataUrl);
    }

    // ══════════════════════════════════════════════════════════
    // EXPORTACIÓN — PDF (impresión del navegador, mismo HTML que la vista previa)
    // ══════════════════════════════════════════════════════════
    function exportarCertificadoPDF(cont) {
        _certDatos = leerCertificadoDeFormulario(cont);
        const faltantes = TECNOLAB_CAMPOS_OBLIGATORIOS.filter(k => !(_certDatos[k] || '').trim());
        if (faltantes.length) {
            mostrarProgresoCert(cont, 'error', ICONO.alerta + ' Completa Certificado No., Fecha de calibración y Fecha de emisión antes de generar.');
            return;
        }
        const url = 'https://tecnolab.com.mx/verificar?folio=' + encodeURIComponent(_certDatos.folio || '');
        const qr = generarQrDataUrl(url);
        const html = construirHTMLCertificado(_certDatos, qr);

        const ventana = window.open('', '_blank');
        if (!ventana) {
            mostrarProgresoCert(cont, 'error', ICONO.alerta + ' El navegador bloqueó la ventana de impresión. Permite pop-ups para este sitio e inténtalo de nuevo.');
            return;
        }
        ventana.document.open();
        ventana.document.write(html);
        ventana.document.close();
        ventana.document.title = 'Certificado ' + (_certDatos.folio || 'TECNOLAB');
        const lanzarImpresion = () => { ventana.focus(); ventana.print(); };
        if (ventana.document.readyState === 'complete') setTimeout(lanzarImpresion, 300);
        else ventana.addEventListener('load', () => setTimeout(lanzarImpresion, 300));
        mostrarProgresoCert(cont, 'ok', ICONO.check + ' Se abrió la vista de impresión — elige "Guardar como PDF" en el diálogo del navegador.');
    }

    // ══════════════════════════════════════════════════════════
    // EXPORTACIÓN — WORD (.doc editable vía HTML con espacio de nombres de Office)
    // ══════════════════════════════════════════════════════════
    function exportarCertificadoWord(cont) {
        _certDatos = leerCertificadoDeFormulario(cont);
        const faltantes = TECNOLAB_CAMPOS_OBLIGATORIOS.filter(k => !(_certDatos[k] || '').trim());
        if (faltantes.length) {
            mostrarProgresoCert(cont, 'error', ICONO.alerta + ' Completa Certificado No., Fecha de calibración y Fecha de emisión antes de exportar.');
            return;
        }
        const url = 'https://tecnolab.com.mx/verificar?folio=' + encodeURIComponent(_certDatos.folio || '');
        const qr = generarQrDataUrl(url);
        const cuerpo = construirHTMLCertificado(_certDatos, qr).replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
        const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Certificado ${escHtmlCert(_certDatos.folio || '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>@page{size:8.5in 11in;margin:0.5in;} body{font-family:'IBM Plex Sans',Calibri,sans-serif;}</style>
</head><body>${cuerpo}</body></html>`;
        const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Certificado_TECNOLAB_${(_certDatos.folio || 'sin_folio').replace(/[^a-z0-9]+/gi, '_')}.doc`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
        mostrarProgresoCert(cont, 'ok', ICONO.check + ' Word descargado. Word puede tardar unos segundos en abrirlo la primera vez.');
    }

    // ══════════════════════════════════════════════════════════
    // EXPORTACIÓN — XML (datos estructurados, no es CFDI/timbrado)
    // ══════════════════════════════════════════════════════════
    function escXmlCert(s) {
        return (s === undefined || s === null ? '' : String(s))
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function exportarCertificadoXML(cont) {
        _certDatos = leerCertificadoDeFormulario(cont);
        const d = _certDatos;
        const resultadosXml = (d.resultados || []).map(r => `
        <resultado>
            <temperaturaPatron>${escXmlCert(r.patron)}</temperaturaPatron>
            <temperaturaIBC>${escXmlCert(r.ibc)}</temperaturaIBC>
            <error>${escXmlCert(r.error)}</error>
            <incertidumbreK2>${escXmlCert(r.incertidumbre)}</incertidumbreK2>
        </resultado>`).join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<certificadoCalibracion xmlns="urn:tecnocontrol:gestoria:certificado-tecnolab:v1">
    <emisor>
        <razonSocial>TECNOLAB ENSAYO Y CALIBRACIÓN S.A. DE C.V.</razonSocial>
        <direccion>Avenida Fuerza Aérea Mexicana No. 7030 Int. B2, colonia Tabalaopa</direccion>
        <telefono>614 176 1255</telefono>
        <correo>calidad@tecnolab.com.mx</correo>
    </emisor>
    <identificacion>
        <folio>${escXmlCert(d.folio)}</folio>
        <fechaCalibracion>${escXmlCert(d.fechaCalibracion)}</fechaCalibracion>
        <fechaEmision>${escXmlCert(d.fechaEmision)}</fechaEmision>
        <vigencia>${escXmlCert(d.vigencia)}</vigencia>
    </identificacion>
    <cliente>
        <razonSocial>${escXmlCert(d.clienteRazonSocial)}</razonSocial>
        <direccion>${escXmlCert(d.clienteDireccion)}</direccion>
    </cliente>
    <instrumentoCalibrado>
        <sondaTemperatura>
            <marca>${escXmlCert(d.instSondaMarca)}</marca>
            <modelo>${escXmlCert(d.instSondaModelo)}</modelo>
            <numeroSerie>${escXmlCert(d.instSondaSerie)}</numeroSerie>
            <identificacion>${escXmlCert(d.instSondaId)}</identificacion>
        </sondaTemperatura>
        <consolaLector>
            <marca>${escXmlCert(d.instConsolaMarca)}</marca>
            <modelo>${escXmlCert(d.instConsolaModelo)}</modelo>
            <numeroSerie>${escXmlCert(d.instConsolaSerie)}</numeroSerie>
            <identificacion>${escXmlCert(d.instConsolaId)}</identificacion>
        </consolaLector>
        <resolucion>${escXmlCert(d.instResolucion)}</resolucion>
        <tipoTanque>${escXmlCert(d.instTipoTanque)}</tipoTanque>
        <tipoLiquido>${escXmlCert(d.instTipoLiquido)}</tipoLiquido>
    </instrumentoCalibrado>
    <patronesUtilizados>
        <tep>
            <marca>${escXmlCert(d.patTepMarca)}</marca>
            <modelo>${escXmlCert(d.patTepModelo)}</modelo>
            <numeroSerie>${escXmlCert(d.patTepSerie)}</numeroSerie>
            <identificacion>${escXmlCert(d.patTepId)}</identificacion>
            <trazabilidadMetrologica>${escXmlCert(d.patTepTrazabilidad)}</trazabilidadMetrologica>
        </tep>
        <cintaConPlomada>
            <marca>${escXmlCert(d.patCintaMarca)}</marca>
            <modelo>${escXmlCert(d.patCintaModelo)}</modelo>
            <numeroSerie>${escXmlCert(d.patCintaSerie)}</numeroSerie>
            <identificacion>${escXmlCert(d.patCintaId)}</identificacion>
            <trazabilidadMetrologica>${escXmlCert(d.patCintaTrazabilidad)}</trazabilidadMetrologica>
        </cintaConPlomada>
    </patronesUtilizados>
    <datosCalibracion>
        <lugarCalibracion>${escXmlCert(d.lugarCalibracion)}</lugarCalibracion>
        <metodoCalibracion>${escXmlCert(d.metodoCalibracion)}</metodoCalibracion>
        <temperaturaAmbiente>${escXmlCert(d.tempAmbiente)}</temperaturaAmbiente>
        <humedadRelativa>${escXmlCert(d.humedad)}</humedadRelativa>
        <presionAtmosferica>${escXmlCert(d.presion)}</presionAtmosferica>
    </datosCalibracion>
    <resultadosCalibracion>${resultadosXml}
    </resultadosCalibracion>
    <observaciones>
        <nota>Los resultados mostrados se relacionan solamente con el ítem bajo calibración indicado en esta hoja.</nota>
        <nota>El Laboratorio es responsable de la información emitida en el informe, a excepción de la información otorgada por el cliente.</nota>
        ${d.observacionAdicional && d.observacionAdicional.trim() ? `<nota>${escXmlCert(d.observacionAdicional.trim())}</nota>` : ''}
    </observaciones>
    <firmas>
        <calibro><nombre>${escXmlCert(d.calibroNombre)}</nombre><puesto>Metrólogo</puesto></calibro>
        <aprobo><nombre>${escXmlCert(d.aproboNombre)}</nombre><puesto>${escXmlCert(d.aproboPuesto)}</puesto></aprobo>
    </firmas>
</certificadoCalibracion>`;

        const blob = new Blob([xml], { type: 'application/xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Certificado_TECNOLAB_${(d.folio || 'sin_folio').replace(/[^a-z0-9]+/gi, '_')}.xml`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
        mostrarProgresoCert(cont, 'ok', ICONO.check + ' XML de datos estructurados descargado.');
    }

    window.cargarGestoria = cargarGestoria;
})();
