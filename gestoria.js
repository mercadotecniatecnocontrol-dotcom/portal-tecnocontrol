// GESTORÍA — módulo de departamento (Portal Tecnocontrol)
// Archivo nombrado como el departamento (mismo patrón que rh.js,
// ventas.js, flotilla.js) porque Gestoría alojará más de un sistema:
//   - SASISOPA (implementado abajo)
//   - SGM — Sistema de Gestión de Medición
//   - Bitácoras (PL2853) — bitácoras de operación, mantenimiento y
//     limpieza; a diferencia de SASISOPA/SGM no usa resaltado amarillo,
//     el encabezado (razón social/PL/domicilio) se ubica por etiqueta
//     o por párrafo completo — ver BITACORAS_CAMPOS_POR_ETIQUETA.
//   - Certificado TECNOLAB — llenado y exportación (PDF/Word/XML)

(function () {

    const SECCIONES_GESTORIA = [
        { id: 'sasisopa', titulo: 'SASISOPA', activa: true },
        { id: 'sgm', titulo: 'SGM', activa: true },
        { id: 'bitacoras', titulo: 'Bitácoras', activa: true },
        { id: 'certificado', titulo: 'Certificado TECNOLAB', activa: true },
    ];
    let _seccionActual = 'sasisopa';

    const SASISOPA_RUTA_MACHOTES = 'sasisopa-machotes/sasisopa-machotes/';
    const SASISOPA_COLECCION = 'sasisopa_clientes';

    let _fsFns = null;
    let _clienteActualId = null;
    let _clientesCache = [];
    let _logoDataUrlActual = null;
    let _firmasDataUrlActual = { ELABORA: null, REVISO: null, APRUEBA: null };
    let _filtroTexto = '';

    // ── Estado del editor visual de organigrama ──
    let _organigramaCanvas = null; // { nodos:[{id,texto,nombre,x,y,w,padre,clave}], conectores:[{a,b}] }
    let _orgaModoConector = false;
    let _orgaConectorOrigen = null;
    let _orgaArrastre = null;
    let _orgaIdSeq = 1;

    async function fsFns() {
        if (_fsFns) return _fsFns;
        _fsFns = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        return _fsFns;
    }

    // ÍCONOS (SVG inline, mismo estilo que el resto del portal)
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

    // CATÁLOGO DE REEMPLAZO (idéntico a mapeo_valores.py)
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

    // Roles seleccionables
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

    // Artículo gramaticalmente correcto para anteponer a cada puesto
    // (p.ej. "La Alta Dirección", "El Representante Técnico") — se usa
    // para armar frases donde el puesto se elige dinámicamente en vez de
    // venir fijo en el machote (ver P-07, punto 4.1.5).
    const SASISOPA_ARTICULO_ROL = {
        ROL_ALTA_DIRECCION: "La",
        ROL_REPRESENTANTE_TECNICO: "El",
        ROL_SUPERVISOR_ESTACION: "El",
        ROL_DESPACHADOR: "El",
        ROL_ASISTENTE_ADMIN: "El",
        ROL_FACTURISTA: "El",
        ROL_MANTENIMIENTO: "El",
        ROL_INTENDENCIA: "La",
    };


    // Placeholder del catálogo genérico de SASISOPA (Responsabilidades/
    // Funciones/Autoridad/Interrelaciones por puesto).
    const SASISOPA_CATALOGO_GENERICO = {};

    // Jerarquía por defecto para el organigrama gráfico de SASISOPA
    const SASISOPA_JERARQUIA_ORGANIGRAMA = [
        ["ROL_ALTA_DIRECCION"],
        ["ROL_REPRESENTANTE_TECNICO", "ROL_SUPERVISOR_ESTACION"],
        ["ROL_ASISTENTE_ADMIN", "ROL_FACTURISTA", "ROL_MANTENIMIENTO", "ROL_INTENDENCIA", "ROL_DESPACHADOR"],
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
        { titulo: "Firmas de control", icono: ICONO.usuarios, campos: [
            ["NOMBRE_ELABORA", "Nombre de quien elabora", ""],
            ["PUESTO_ELABORA", "Puesto de quien elabora", ""],
            ["NOMBRE_REVISO", "Nombre de quien revisa", ""],
            ["PUESTO_REVISO", "Puesto de quien revisa", ""],
            ["NOMBRE_APRUEBA", "Nombre de quien aprueba", ""],
            ["PUESTO_APRUEBA", "Puesto de quien aprueba", ""],
        ]},
        { titulo: "Organigrama y nomenclatura de puestos", icono: ICONO.usuarios, tipo: "checklist_con_nombre", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Escolaridad mínima por puesto (F-06-02)", icono: ICONO.graduacion, tipo: "escolaridad_dinamica", fuente: SASISOPA_ROLES_DISPONIBLES, ejemplos: {
            ESCOLARIDAD_ALTA_DIRECCION: "Preparatoria", ESCOLARIDAD_REPRESENTANTE_TECNICO: "Licenciatura o Ingeniería.",
            ESCOLARIDAD_SUPERVISOR: "Licenciatura.", ESCOLARIDAD_ASISTENTE_ADMIN: "Preparatoria.",
            ESCOLARIDAD_MANTENIMIENTO: "Secundaria.", ESCOLARIDAD_FACTURISTA: "Secundaria.",
            ESCOLARIDAD_INTENDENCIA: "Primaria.", ESCOLARIDAD_DESPACHADOR: "Primaria.",
        }},
        { titulo: "Apartado nombre (Cliente) F-07-04 Atención a Quejas y Sugerencias", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "F0704_ROL_CLIENTE", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto 4.1.5 (P-07 Comunicación, Participación y Consulta) — Puesto responsable", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P07_ROL_4_1_5", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Puntos 3.1 y 4.4.2 (P-08.2 Control de Documentos) — Quién revisa", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P082_ROL_REVISA", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Puntos 3.1 y 4.4.2 (P-08.2 Control de Documentos) — Quién aprueba/autoriza", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P082_ROL_APRUEBA", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto 1 Objetivo (P-18 Informes de Desempeño) — Puesto responsable", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P18_ROL_1_1", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto 3.1 (P-18 Informes de Desempeño) — Puesto de máxima autoridad", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P18_ROL_3_1", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "P-11 Integridad Mecánica — Puesto en lugar de Alta Dirección", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P11_ROL_ALTA_DIRECCION", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto 3.1 (P-14.1 Monitoreo y Medición) — Puesto responsable", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P141_ROL_3_1", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto 3.1 (P-14.2 Evaluación del Cumplimiento de RL) — Puesto responsable", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P142_ROL_3_1", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto 4 (P-15 Auditoria Interna) — Quién firma el Plan de Auditoría", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "P15_ROL_4", opciones: SASISOPA_ROLES_DISPONIBLES },
        { titulo: "Punto I (M-11 Integridad Mecánica) — Puesto en lugar de Alta Dirección", icono: ICONO.usuarios,
          tipo: "selector_rol_documento", clave: "M11_ROL_ALTA_DIRECCION", opciones: SASISOPA_ROLES_DISPONIBLES },
    ];

    // NUMERO_PERMISO ya no es obligatorio: puede decir "PERMISO EN PROCESO"
    // cuando el trámite del cliente todavía está en curso, y eso no debe
    // bloquear la generación de documentos.
    const SASISOPA_CAMPOS_OBLIGATORIOS = ["RAZON_SOCIAL", "RFC", "DOMICILIO_ESTACION", "CIUDAD_ESTADO", "FECHA_ELABORACION", "NOMBRE_ELABORA"];

    // SGM — Sistema de Gestión de las Mediciones (ISO 10012:2003)
    const SGM_RUTA_MACHOTES = 'sgm-machotes/';
    const SGM_COLECCION = 'sgm_clientes';

    const SGM_MAPEO = {
        "FELIX RUIZ GONZALEZ": "NOMBRE_REPRESENTANTE_MAYUS",
        "FELIX RUIZ GONZALEZ.": "NOMBRE_REPRESENTANTE_MAYUS",
        "Félix Ruiz González": "NOMBRE_REPRESENTANTE",
        "Félix": "__SKIP__",
        "Ruiz González": "__SKIP__",
        "FR": "__SKIP__",
        "PL/9693/EXP/ES/2015": "NUMERO_PERMISO",
        "Lezlie Anahy Gutierrez Armendáriz.": "NOMBRE_ELABORA",
        "16/12/2024": "FECHA_ELABORACION",
        "El Tule, Chihuahua": "CIUDAD_ESTADO_NOMBRAMIENTO",
        "LOGO": "__LOGO__",
    };

    // Roles seleccionables por checklist — cada cliente marca cuáles
    // aplican en su estructura y captura el nombre de quien lo ocupa.
    // Si un cliente combina roles, se marcan ambos con el mismo nombre.
    const SGM_ROLES_DISPONIBLES = [
        { clave: "ROL_ALTA_DIRECCION",        etiqueta: "Alta Dirección",        obligatorio: true  },
        { clave: "ROL_REPRESENTANTE_TECNICO", etiqueta: "Representante Técnico", obligatorio: false },
        { clave: "ROL_ADMINISTRATIVO",        etiqueta: "Administrativo",        obligatorio: false },
        { clave: "ROL_ENCARGADO_ESTACION",    etiqueta: "Encargado de estación", obligatorio: false },
        { clave: "ROL_ENCARGADO_PROYECTO",    etiqueta: "Encargado de proyecto", obligatorio: false },
        { clave: "ROL_MANTENIMIENTO",         etiqueta: "Mantenimiento",         obligatorio: false },
        { clave: "ROL_DESPACHADOR",           etiqueta: "Despachador",           obligatorio: false },
        { clave: "ROL_INTENDENCIA",           etiqueta: "Intendencia",           obligatorio: false },
    ];

    // Jerarquía fija del organigrama (según el propio MGM: "Le reportan:
    // Encargado de estación, Encargado de Proyecto, Representante
    // Técnico, Despachadores, Mantenimiento e Intendencia" bajo
    // Administrativo). Los puestos personalizados se agregan como un
    // nivel adicional, reportando a Administrativo.
    const SGM_JERARQUIA_ORGANIGRAMA = [
        ["ROL_ALTA_DIRECCION"],
        ["ROL_ADMINISTRATIVO"],
        ["ROL_ENCARGADO_ESTACION", "ROL_ENCARGADO_PROYECTO", "ROL_REPRESENTANTE_TECNICO", "ROL_DESPACHADOR", "ROL_MANTENIMIENTO", "ROL_INTENDENCIA"],
    ];

    // ── Frases de "puesto(s) responsable(s)" que ahora admiten elegir
    // dos o más puestos (retroalimentación SGM: PROC-G-003/004/005/008).
    // Cada frase se ubica por un fragmento distintivo de su propio texto
    // (no por nombre de archivo), porque el mismo patrón de redacción se
    // repite en varios machotes. `match` se prueba contra el texto plano
    // del párrafo completo; el reemplazo toca solo los runs resaltados
    // en amarillo que haya dentro de ese párrafo.
    const SGM_FRASES_MULTIPUESTO = [
        { id: 'registros_gestion', etiqueta: 'Control de registros de gestión (PROC-G-003)',
          soloRol: true,
          match: /el\s+control\s+de\s+los\s+registros\s+de\s+gesti[oó]n\s+es\s+realizado\s+por/i },
        { id: 'registros_tecnicos', etiqueta: 'Control de registros técnicos (PROC-G-003)',
          soloRol: true,
          match: /el\s+control\s+de\s+los\s+registros\s+t[eé]cnicos\s+es\s+realizado\s+por/i },
        { id: 'proteccion_registros_impresos', etiqueta: 'Protección de registros impresos y contraseñas (PROC-G-003, 4.1 h)',
          soloRol: true,
          match: /registros\s+impresos\s+se\s+protegen\s+en\s+oficinas/i },
        { id: 'resguardo_claves_acceso', etiqueta: 'Resguardo de claves de acceso electrónico (PROC-G-003, 4.2)',
          soloRol: true,
          match: /claves\s+de\s+acceso\s+son\s+resguardadas\s+por/i },
        { id: 'entrega_solicitud_compra', etiqueta: 'Entrega de solicitud de compra (PROC-G-004)',
          soloRol: true,
          match: /llevar\s+la\s+solicitud\s+firmada\s+en\s+duplicado\s+al/i },
        { id: 'asignacion_acciones_prevencion', etiqueta: 'Asignación de acciones preventivas (PROC-G-005, 4.1)',
          soloRol: true,
          match: /asigna\s+responsables\s+y\s+fechas\s+de\s+implantaci[oó]n\s+de\s+acciones\s+de\s+prevenci[oó]n/i },
        { id: 'eficacia_acciones_mejora', etiqueta: 'Eficacia de acciones de mejora (PROC-G-005, 4.2)',
          soloRol: true,
          match: /coordinada\s+y\s+asegurada\s+su\s+eficacia\s+por/i },
        { id: 'vigilancia_acciones_correctivas', etiqueta: 'Vigilancia de acciones correctivas (PROC-G-008, 4.2)',
          soloRol: true,
          match: /responsable\s+de\s+vigilar\s+la\s+aplicaci[oó]n\s+de\s+acciones\s+correctivas\s+efectivas/i },
        { id: 'supervision_personal_tecnico', etiqueta: 'Supervisión del personal técnico de área operativa (PROC-T-001, 4.5)',
          soloRol: true,
          match: /a\s+cargo\s+del\s+[ÁA]rea\s+operativa,?\s*es\s+decir,?/i },
        { id: 'notificacion_anomalia_equipo', etiqueta: 'Notificación de anomalías del equipo (PROC-T-005, 5.1)',
          soloRol: true,
          match: /se\s+le\s+notifica\s+inmediatamente\s+a/i },
    ];

    // Documentos donde el índice/tabla de contenido debe listar TODOS los
    // puestos disponibles, sin filtrar por los que el cliente marcó en el
    // organigrama (a diferencia del resto de SGM, donde sí se filtran).
    const RE_INDICE_TODOS_LOS_PUESTOS_SGM = /^PROC-T-001/i;

    // Documentos de procedimiento (PROC-G-*/PROC-T-*) que traen su propio
    // diagrama de proceso (no un organigrama) y por lo tanto NO deben
    // pasar por el reemplazo automático del organigrama gráfico.
    const RE_SIN_ORGANIGRAMA_SGM = /^PROC-/i;
    // SASISOPA: documentos que traen su propio pict/drawing incidental
    // (no un organigrama real) y por lo tanto NO deben pasar por el
    // reemplazo automático del organigrama gráfico. Se agrega cada
    // archivo aquí conforme se detecta el problema — no hay un patrón
    // general como en SGM (PROC-*), varía documento por documento.
    const RE_SIN_ORGANIGRAMA_SASISOPA = /^F-07-01|^F-07-04|^F-10_1-02|^P-10_2|^P-10_3/i;

    const SGM_CATALOGO_GENERICO = {
        "ROL_ALTA_DIRECCION": {
                "responsabilidades": [
                        "Asegurar que la Organización sea una entidad con responsabilidad legal ante las autoridades competentes y la sociedad en general.",
                        "Asegurar de que se dispone de los recursos humanos y materiales necesarios para establecer, mantener y mejorar la FM y el SGM.",
                        "Es la máxima autoridad de la organización, es quien dispone los recursos necesarios para el correcto funcionamiento de la empresa, asigna responsabilidades y autoridad del RT."
                ],
                "funciones": [
                        "Definir la estructura de la Organización, funciones y responsabilidades del personal del SGM.",
                        "Proveer los recursos humanos y materiales requeridos por el SGM y la FM.",
                        "Facilitar mecanismos para que el personal del SGM comprenda la relevancia de satisfacer los requisitos especificados por la norma ISO 10012:2003, los clientes (internos y/o externos) y las autoridades competentes.",
                        "Aprobar políticas y objetivos del SGM.",
                        "Realizar o coordinar que se realicen periódicamente revisiones por la alta dirección al SGM.",
                        "Proveer mecanismos y recursos para asegurar la competencia de todo el personal del SGM.",
                        "Proveer mecanismos y recursos para asegurar la confiabilidad de los procesos y equipos de medición del SGM."
                ],
                "autoridad": [
                        "Máximo nivel de jerarquía en la Organización."
                ],
                "interrelaciones": [
                        "Coordina de manera directa a las gerencias de la empresa y la dirección de la FM."
                ]
        },
        "ROL_ADMINISTRATIVO": {
                "responsabilidades": [
                        "Establecer, documentar, mantener y dirigir el SGM y mejorar su eficacia de forma continua.",
                        "Representar todas las actividades realizadas por la FM.",
                        "Encargado de asistir en toda la organización y gestión de los recursos de la empresa, además de tratar, administrar o gestionar información importante directamente con clientes y/o proveedores.",
                        "Definir, implementar y mejorar los procesos de selección, contratación, inducción, formación continua, seguridad y retiro del personal de la Organización."
                ],
                "funciones": [
                        "Definir y establecer políticas y objetivos medibles del SGM.",
                        "Asegurar la confiabilidad de los resultados generados por el SGM.",
                        "Planificar, controlar y monitorear los procesos y equipos de medición del SGM.",
                        "Gestionar los recursos humanos y materiales necesarios para la operación del SGM y cumplimiento de objetivos.",
                        "Implementar acciones para asegurar y mantener la competencia del personal del SGM.",
                        "Apoyar en las revisiones por la alta dirección de la Organización, en caso requerido.",
                        "Realizar las contrataciones de personal requeridas por la Organización.",
                        "Mantener registros actualizados de los perfiles de los puestos de trabajo del personal directivo, técnico y de apoyo del SGM."
                ],
                "autoridad": [
                        "Reporta a la Alta Dirección.",
                        "Le reportan: Encargado de estación, Encargado de Proyecto, Representante Técnico, Despachadores, Mantenimiento e Intendencia."
                ],
                "interrelaciones": [
                        "Relación directa con el Alta Dirección y otras gerencias de la Organización."
                ]
        },
        "ROL_ENCARGADO_ESTACION": {
                "responsabilidades": [
                        "Asegurar la calidad de los productos y/o servicios realizados por la Organización, conforme el SGM.",
                        "Supervisar las operaciones diarias de la estación de servicio, garantizar que se satisfagan las necesidades de los clientes y mantener un alto nivel de eficiencia."
                ],
                "funciones": [
                        "Asegurar el cumplimiento de los requisitos de calidad en el SGM.",
                        "Programar y coordinar auditorías de calidad.",
                        "Supervisar la calidad en otras áreas de la Organización.",
                        "Apoyar en las revisiones por la Alta Dirección de la Organización, en caso requerido."
                ],
                "autoridad": [
                        "Reporta al Administrativo y Alta Dirección."
                ],
                "interrelaciones": [
                        "Mantiene una estrecha relación con el Administrativo, Alta Dirección y otras jefaturas."
                ]
        },
        "ROL_ENCARGADO_PROYECTO": {
                "responsabilidades": [
                        "Supervisar las operaciones diarias de la estación de servicio, garantizar que se satisfagan las necesidades de los clientes y mantener un alto nivel de eficiencia.",
                        "Dar seguimiento, dirigir y gestionar el proyecto; planifica y además coordina las tareas y fechas de ejecución de las actividades, asumiendo un rol de liderazgo."
                ],
                "funciones": [
                        "Supervisar las operaciones diarias de la estación de servicio.",
                        "Coordinar las actividades de inserción, conservación y retiro de instalaciones, maquinaria y equipo de medición del SGM.",
                        "Llevar el control operativo de las instalaciones, maquinaria y equipos de medición del SGM."
                ],
                "autoridad": [
                        "Reporta al Administrativo y Alta Dirección."
                ],
                "interrelaciones": [
                        "Mantiene una estrecha relación con el Encargado de estación y otras jefaturas de la Administración y Alta Dirección."
                ]
        },
        "ROL_REPRESENTANTE_TECNICO": {
                "responsabilidades": [
                        "Informar a la Alta Dirección de las necesidades de recursos, materiales y de personal, para el cumplimiento de lo establecido."
                ],
                "funciones": [
                        "Coordinar las actividades de gestión y planeación logística de la Organización.",
                        "Coordinar las actividades de transporte y distribución de materia prima y productos relacionados con el SGM, dentro y fuera de la Organización."
                ],
                "autoridad": [
                        "Reporta a la Alta Dirección."
                ],
                "interrelaciones": [
                        "Mantiene una estrecha relación con el Administrativo y otras jefaturas de la Alta Dirección."
                ]
        },
        "ROL_DESPACHADOR": {
                "responsabilidades": [
                        "Realizar labores de suministro y cobros de la venta de combustibles, la atención y asesoramiento al cliente, así como limpieza y mantenimiento preventivo de la estación de servicio."
                ],
                "funciones": [
                        "Realizar actividades de mantenimiento y conservación de instalaciones, maquinaria y equipo de medición del SGM a su cargo.",
                        "Apoyar a Mantenimiento en otras actividades técnicas no consideradas dentro del SGM."
                ],
                "autoridad": [
                        "Reporta a Mantenimiento."
                ],
                "interrelaciones": [
                        "Mantiene una estrecha relación con Mantenimiento y personal de otras jefaturas de la Administración y Alta Dirección."
                ]
        },
        "ROL_MANTENIMIENTO": {
                "responsabilidades": [
                        "Asegurar la apropiada instalación, operación, conservación y retiro de las instalaciones, maquinaria y equipo de medición del SGM a su cargo.",
                        "Mantener los equipos de trabajo, maquinaria e instalaciones en óptimas condiciones de operación, y atender las fallas emergentes."
                ],
                "funciones": [
                        "Realizar actividades de mantenimiento y conservación de las instalaciones, maquinaria y equipo de medición del SGM a su cargo.",
                        "Apoyar a Despachadores y Administrativo en otras actividades técnicas no consideradas dentro del SGM."
                ],
                "autoridad": [
                        "Reporta al Encargado De Estación, Administrativo y Alta Dirección."
                ],
                "interrelaciones": [
                        "Mantiene una estrecha relación con el personal de otras jefaturas de la Administración y Alta Dirección."
                ]
        },
        "ROL_INTENDENCIA": {
                "responsabilidades": [
                        "Respetar la programación de limpieza asignada.",
                        "Garantizar la limpieza de todas las áreas asignadas de la estación de servicio, asegurando estándares de orden e higiene.",
                        "Usar correctamente los productos y herramientas de limpieza, evitando desperdicios y daños."
                ],
                "funciones": [
                        "Realizar labores de limpieza en las áreas designadas.",
                        "Mantener una actitud de servicio y colaborar con otros departamentos en actividades que contribuyan al buen funcionamiento de la estación de servicio."
                ],
                "autoridad": [
                        "Reporta al Encargado De Estación, Administrativo y Alta Dirección."
                ],
                "interrelaciones": [
                        "Mantiene una estrecha relación con el personal de otras jefaturas de la Administración y Alta Dirección."
                ]
        }
};

    // Equipo de medición: lista abierta (varía por estación), sin
    // catálogo fijo de tipos — el usuario agrega tantas filas como
    // equipos tenga instalados.
    const SGM_CAMPOS_EQUIPO = [
        { clave: "tipo", etiqueta: "Tipo de equipo", ejemplo: "Consola de tanque" },
        { clave: "marca", etiqueta: "Marca", ejemplo: "VEEDER-ROOT" },
        { clave: "modelo", etiqueta: "Modelo", ejemplo: "TLS-300C" },
        { clave: "numero_serie", etiqueta: "Número de serie", ejemplo: "G04180392705001" },
    ];

    // Patrones y equipos de medida (tabla distinta, propia de PROC-T-005/006):
    // misma lógica de captura abierta, pero sin columna "tipo" — el machote
    // ya trae una columna "No." con la numeración secuencial automática.
    const SGM_CAMPOS_PATRONES = [
        { clave: "marca", etiqueta: "Marca", ejemplo: "WAYNE" },
        { clave: "modelo", etiqueta: "Modelo", ejemplo: "H(N/LU)11-11GR" },
        { clave: "numero_serie", etiqueta: "No. de serie", ejemplo: "39351E E21" },
    ];

    // NUMERO_PERMISO ya no es obligatorio (mismo criterio que SASISOPA):
    // el permiso puede estar en trámite y eso no debe impedir generar
    // los documentos del cliente.
    const SGM_CAMPOS_OBLIGATORIOS = ["NOMBRE_REPRESENTANTE", "NOMBRE_ELABORA", "FECHA_ELABORACION"];

    const SGM_SECCIONES_FORM = [
        { titulo: "Identidad del cliente", icono: ICONO.edificio, campos: [
            ["NOMBRE_REPRESENTANTE", "Razón Social", "A LA GAS, S.A. DE C.V."],
            ["NUMERO_PERMISO", "Número de permiso CRE/ASEA (PL)", "PL/9693/EXP/ES/2015"],
        ]},
        { titulo: "Control de documentos", icono: ICONO.usuarios, campos: [
            ["FECHA_ELABORACION", "Fecha de elaboración (dd/mm/aaaa)", "16/12/2024"],
        ]},
        { titulo: "Nombramiento", icono: ICONO.usuarios, campos: [
            ["CIUDAD_ESTADO_NOMBRAMIENTO", "Ciudad, Estado", "El Tule, Chihuahua"],
        ]},
        { titulo: "Firmas de control (hojas Excel y Word SGM)", icono: ICONO.usuarios, campos: [
            ["NOMBRE_ELABORA", "Nombre de quien elabora", "Lezlie Anahy Gutierrez Armendáriz."],
            ["PUESTO_ELABORA", "Puesto de quien elabora", "Administrativo"],
            ["NOMBRE_REVISO", "Nombre de quien revisa", "Félix Ruiz González"],
            ["PUESTO_REVISO", "Puesto de quien revisa", "Alta Dirección"],
            ["NOMBRE_APRUEBA", "Nombre de quien aprueba", "Félix Ruiz González"],
            ["PUESTO_APRUEBA", "Puesto de quien aprueba", "Alta Dirección"],
        ]},
        { titulo: "Organigrama y nomenclatura de puestos", icono: ICONO.usuarios, tipo: "checklist_con_nombre", opciones: SGM_ROLES_DISPONIBLES },
        { titulo: "Puestos responsables de procesos específicos", icono: ICONO.usuarios, tipo: "multiselect_por_frase", fuente: SGM_FRASES_MULTIPUESTO },
        { titulo: "Equipo de medición por estación", icono: ICONO.graduacion, tipo: "tabla_dinamica", clave: "EQUIPOS", columnas: SGM_CAMPOS_EQUIPO },
        { titulo: "Patrones y equipos de medida (PROC-T-005/006)", icono: ICONO.graduacion, tipo: "tabla_dinamica", clave: "PATRONES_EQUIPOS", columnas: SGM_CAMPOS_PATRONES },
    ];

    // BITÁCORAS — bitácoras de operación, mantenimiento y limpieza
    // (PL2853). A diferencia de SASISOPA/SGM, los 9 machotes + el
    // índice NO usan resaltado amarillo: el encabezado repetido trae
    // directamente los datos del cliente de referencia (Servicio
    // Chavo, S.A. de C.V.) como texto plano. Por eso el reemplazo se
    // ubica por la etiqueta que antecede al valor (Ciudad o
    // población:, Domicilio:, etc.) o, para razón social y PL, por
    // coincidencia del párrafo completo — ver procesarCamposBitacoras.
    const BITACORAS_RUTA_MACHOTES = 'bitacoras-machotes/';
    const BITACORAS_COLECCION = 'bitacoras_clientes';

    const BITACORAS_SECCIONES_FORM = [
        { titulo: "Identidad del cliente", icono: ICONO.edificio, campos: [
            ["RAZON_SOCIAL", "Razón Social completa", "Servicio Chavo, S.A. de C.V."],
            ["NUMERO_PERMISO", "Número de permiso ASEA (PL)", "PL/2853/EXP/ES/2015"],
            ["CIUDAD", "Ciudad o población", "Cuauhtémoc"],
            ["DOMICILIO_ESTACION", "Domicilio completo de la estación", "Carretera a Guerrero s/n Km. 107.800"],
            ["NUMERO_EXTERIOR", "Número exterior", "N/A"],
            ["NUMERO_INTERIOR", "Número interior", "N/A"],
            ["CODIGO_POSTAL", "Código postal", "31500"],
            ["ESTADO", "Estado", "Chihuahua"],
        ]},
    ];

    // NUMERO_PERMISO no es obligatorio (puede estar en trámite, igual
    // que en SASISOPA); número exterior/interior tampoco (suele ser N/A).
    const BITACORAS_CAMPOS_OBLIGATORIOS = ["RAZON_SOCIAL", "CIUDAD", "DOMICILIO_ESTACION", "CODIGO_POSTAL", "ESTADO"];

    // Valor de referencia de razón social tal como aparece en los
    // machotes (párrafo completo, sin etiqueta) — se compara ignorando
    // el punto final porque algunos machotes lo traen en un run aparte.
    const BITACORAS_VALOR_RAZON_SOCIAL_REF = 'Servicio Chavo, S.A. de C.V.';
    const BITACORAS_VALOR_PL_REF = /^PL\/2853\/EXP\/ES\/2015$/;

    // Campos que sí llevan etiqueta dentro del mismo párrafo — el
    // reemplazo toca solo los runs que vienen DESPUÉS de la etiqueta,
    // dejando la etiqueta misma intacta.
    const BITACORAS_CAMPOS_POR_ETIQUETA = [
        { etiqueta: /ciudad\s+o\s+poblaci[oó]n\s*:/i, clave: 'CIUDAD' },
        { etiqueta: /domicilio\s*:/i, clave: 'DOMICILIO_ESTACION' },
        { etiqueta: /n[uú]mero\s+exterior\s*:/i, clave: 'NUMERO_EXTERIOR' },
        { etiqueta: /n[uú]mero\s+interior\s*:/i, clave: 'NUMERO_INTERIOR' },
        { etiqueta: /c[oó]digo\s+postal\s*:/i, clave: 'CODIGO_POSTAL' },
        { etiqueta: /estado\s*:/i, clave: 'ESTADO' },
    ];

    // ── Config activa según la sección elegida en el riel lateral ──
    function sistemaActivo() {
        if (_seccionActual === 'bitacoras') {
            return {
                id: 'bitacoras', nombre: 'Bitácoras', subtitulo: 'Bitácoras de operación, mantenimiento y limpieza (PL2853)',
                mapeo: {}, seccionesForm: BITACORAS_SECCIONES_FORM,
                camposObligatorios: BITACORAS_CAMPOS_OBLIGATORIOS,
                rutaMachotes: BITACORAS_RUTA_MACHOTES, coleccion: BITACORAS_COLECCION,
                campoNombre: 'RAZON_SOCIAL', campoOrden: 'RAZON_SOCIAL',
                catalogoGenerico: {},
                jerarquiaOrganigrama: [], rolesOrganigrama: [],
                columnasTabla: [
                    { titulo: 'Cliente', valor: c => c.RAZON_SOCIAL || '(sin razón social)' },
                    { titulo: 'Ciudad', valor: c => c.CIUDAD || '—' },
                    { titulo: 'PL', valor: c => c.NUMERO_PERMISO || '—' },
                ],
            };
        }
        if (_seccionActual === 'sgm') {
            return {
                id: 'sgm', nombre: 'SGM', subtitulo: 'Sistema de Gestión de las Mediciones',
                mapeo: SGM_MAPEO, seccionesForm: SGM_SECCIONES_FORM,
                camposObligatorios: SGM_CAMPOS_OBLIGATORIOS,
                rutaMachotes: SGM_RUTA_MACHOTES, coleccion: SGM_COLECCION,
                campoNombre: 'NOMBRE_REPRESENTANTE', campoOrden: 'NOMBRE_REPRESENTANTE',
                catalogoGenerico: SGM_CATALOGO_GENERICO,
                jerarquiaOrganigrama: SGM_JERARQUIA_ORGANIGRAMA,
                rolesOrganigrama: SGM_ROLES_DISPONIBLES,
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
            catalogoGenerico: SASISOPA_CATALOGO_GENERICO,
            jerarquiaOrganigrama: SASISOPA_JERARQUIA_ORGANIGRAMA,
            rolesOrganigrama: SASISOPA_ROLES_DISPONIBLES,
            columnasTabla: [
                { titulo: 'Cliente', valor: c => c.RAZON_SOCIAL || '(sin razón social)' },
                { titulo: 'RFC', valor: c => c.RFC || '—' },
                { titulo: 'Ubicación', valor: c => c.CIUDAD_ESTADO || '—' },
            ],
        };
    }

    // Derivación de variantes (mayúsculas, coma, fechas)
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

    // Contextos donde un rol (p.ej. "Alta Dirección", "Supervisor de
    // Estación") se está usando como referencia institucional al PUESTO
    // en sí, dentro de una oración narrativa — no como un espacio para
    // insertar el nombre de quien lo ocupa. En estos casos se conserva
    // el título del puesto tal cual venía en el machote, en vez de
    // sustituirlo por el nombre de la persona capturada en el checklist.
    const RE_CONTEXTO_ROL_INSTITUCIONAL = /(autorizad[oa]s?\s+por\s+la\s*$|autorizad[oa]s?\s+por\s+el\s*$|en\s+colaboraci[oó]n\s+con\s+el\s*$|en\s+colaboraci[oó]n\s+con\s+la\s*$|a\s+cargo\s+de\s+la\s*$|a\s+cargo\s+del\s*$|responsabilidad\s+de\s+la\s*$|responsabilidad\s+del\s*$)/i;

    // Campos que dejaron de ser obligatorios (p.ej. NUMERO_PERMISO, que puede
    // estar en trámite) pero que, si el cliente los deja vacíos, deben salir
    // en blanco en el documento final — no como el dato del cliente de
    // referencia que traía el machote original.
    const CAMPOS_BLANCO_SI_VACIO = ['NUMERO_PERMISO'];

    function valorNuevoPara(valorOriginal, datos) {
        const mapeo = sistemaActivo().mapeo;
        const clave = mapeo[valorOriginal];
        if (clave === undefined) {
            // SGM: un placeholder resaltado que dice literalmente el
            // nombre de un rol del organigrama (p.ej. "Mantenimiento",
            // "Alta Dirección", o su variante en minúsculas "alta
            // dirección" dentro de un párrafo narrativo), se sustituye
            // por el nombre real de quien ocupa ese rol — aplica a
            // cualquier mención de un rol reconocido, sin importar
            // mayúsculas/acentos (ver PROC-G-001 1.1/1.2/4.2/4.3, y 5.1
            // de PROC-T-006, p.ej.).
            if (_seccionActual === 'sgm') {
                const normAcentosRol = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                const rolMencionado = SGM_ROLES_DISPONIBLES.find(r => normAcentosRol(r.etiqueta) === normAcentosRol(valorOriginal.trim()));
                if (rolMencionado && datos[rolMencionado.clave]) return datos[rolMencionado.clave];
            }
            return intentarCoincidenciaFlexible(valorOriginal, datos);
        }
        if (clave === '__SKIP__') return '__SKIP__';
        if (clave === '__LOGO__') return '__LOGO__';
        const valor = datos[clave] || derivarValor(clave, datos);
        if (!valor && CAMPOS_BLANCO_SI_VACIO.includes(clave)) return '';
        return valor;
    }

    function intentarCoincidenciaFlexible(texto, datos) {
        if (_seccionActual === 'sgm') return null; // SGM no requiere fuzzy-match de razón social/domicilio
        if (RE_NOMBRE_PLACEHOLDER.test(texto.trim())) return '__SKIP__';
        let nuevo = texto, cambiado = false;
        if (datos.RAZON_SOCIAL && RE_RAZON_SOCIAL.test(nuevo)) { nuevo = nuevo.replace(RE_RAZON_SOCIAL, datos.RAZON_SOCIAL); cambiado = true; }
        if (datos.DOMICILIO_ESTACION && RE_DOMICILIO.test(nuevo)) { nuevo = nuevo.replace(RE_DOMICILIO, datos.DOMICILIO_ESTACION); cambiado = true; }
        if (cambiado) return nuevo;

        const textoTrim = texto.trim();
        if (datos.FECHA_ELABORACION && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(textoTrim)) {
            return datos.FECHA_ELABORACION;
        }
        if (datos.FECHA_ELABORACION && /^\d{1,2}\s+del\s+mes\s+de\s+[a-záéíóúñ]+\s+del\s+año\s+\d{4}\.?$/i.test(textoTrim)) {
            return derivarValorSASISOPA('FECHA_PROSA', datos);
        }
        return null;
    }

    // MANIPULACIÓN XML DEL .DOCX
    const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    function textoDeRun(run) { return Array.from(run.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join(''); }

    function esNegrita(run) {
        const rPr = run.getElementsByTagNameNS(NS_W, 'rPr')[0];
        if (!rPr) return false;
        return rPr.getElementsByTagNameNS(NS_W, 'b').length > 0;
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

    // Inserción real de imagen (logo) en el .docx
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
        zip.file(path, xml, { createFolders: false });
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
        zip.file(rutaRels, xml, { createFolders: false });
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

    async function insertarImagenEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg, altoObjetivoPx, anchoMaximoPx) {
        const { bytes, mime, ext } = dataUrlABytes(dataUrl);
        await asegurarContentType(zip, ext, mime);
        ctxImg.contador++;
        const mediaFilename = `logoGen${ctxImg.contador}.${ext}`;
        zip.file('word/media/' + mediaFilename, bytes, { createFolders: false });
        const rId = await agregarRelacionImagen(zip, rutaXml, mediaFilename);

        const { width, height } = await medirImagenDataUrl(dataUrl);
        let anchoPx = width * (altoObjetivoPx / height);
        let altoPx = altoObjetivoPx;
        if (anchoPx > anchoMaximoPx) { altoPx = altoPx * (anchoMaximoPx / anchoPx); anchoPx = anchoMaximoPx; }
        const cx = Math.round(anchoPx * 9525);
        const cy = Math.round(altoPx * 9525);

        const nodoDrawing = nodosDesdeXml(xmlDoc, construirDrawingXml(rId, cx, cy, 1000 + ctxImg.contador));
        const primerRun = grupoRuns[0];
        Array.from(primerRun.getElementsByTagNameNS(NS_W, 't')).forEach(t => t.remove());
        Array.from(primerRun.getElementsByTagNameNS(NS_W, 'drawing')).forEach(d => d.parentNode && d.parentNode.removeChild(d));
        Array.from(primerRun.getElementsByTagNameNS(NS_W, 'pict')).forEach(d => d.parentNode && d.parentNode.removeChild(d));
        quitarResaltado(primerRun);
        primerRun.appendChild(nodoDrawing);
        for (let k = 1; k < grupoRuns.length; k++) { setTextoRun(grupoRuns[k], ''); quitarResaltado(grupoRuns[k]); }
    }

    // Quita cualquier imagen que YA existiera en la celda del logo antes de
    // insertar el logo del cliente — el machote de referencia trae ahí la
    // insignia "SUPERSERVICIO 4 CAMINOS" incrustada como mockup, y si no se
    // quita, el logo del cliente queda encimado con esa insignia vieja
    // (se ve como si "saliera el logo equivocado").
    function limpiarImagenesPreviasEnCelda(elementoRun) {
        let celda = elementoRun.parentNode;
        while (celda && celda.localName !== 'tc') celda = celda.parentNode;
        if (!celda) return;
        Array.from(celda.getElementsByTagNameNS(NS_W, 'drawing')).forEach(d => {
            if (d.parentNode !== elementoRun && d.parentNode) d.parentNode.removeChild(d);
        });
        Array.from(celda.getElementsByTagNameNS(NS_W, 'pict')).forEach(pict => {
            if (pict.parentNode) pict.parentNode.removeChild(pict);
        });
    }

    // Ubica el "contenedor" (celda de tabla o párrafo suelto) que trae la
    // insignia de referencia sin gancho de texto "LOGO" resaltado:
    //   - Encabezado de los 9 machotes de Bitácoras: primera celda de la
    //     primera fila de la primera tabla (patrón original, también usado
    //     por SASISOPA en F-05-01 Organigrama).
    //   - ÍNDICE_Y_PORTADA_PRINCIPAL de Bitácoras: no tiene tabla — el
    //     logo es un párrafo suelto en el cuerpo del documento. Este
    //     barrido más amplio (buscar cualquier párrafo con imagen) se
    //     activa SOLO para Bitácoras, para no atrapar imágenes ajenas en
    //     manuales largos de SASISOPA que no tengan nada que ver con el logo.
    function localizarContenedorLogo(xmlDoc) {
        const tablas = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'));
        if (tablas.length) {
            const primeraFila = Array.from(tablas[0].getElementsByTagNameNS(NS_W, 'tr'))[0];
            const celda = primeraFila ? Array.from(primeraFila.getElementsByTagNameNS(NS_W, 'tc'))[0] : null;
            const tieneImagen = celda && (celda.getElementsByTagNameNS(NS_W, 'drawing').length > 0 || celda.getElementsByTagNameNS(NS_W, 'pict').length > 0);
            if (tieneImagen) return celda;
        }
        if (_seccionActual === 'bitacoras') {
            for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
                if (p.getElementsByTagNameNS(NS_W, 'drawing').length > 0 || p.getElementsByTagNameNS(NS_W, 'pict').length > 0) return p;
            }
        }
        return null;
    }

    async function insertarLogoEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg) {
        // La celda "LOGO" del encabezado SGM mide 104px de ancho total
        // (incluyendo bordes y márgenes internos de la celda); dejamos
        // ~19px de margen para que no toque los bordes.
        // SASISOPA usa una celda de logo más grande y aproximadamente
        // cuadrada (como el círculo "SUPERSERVICIO 4 CAMINOS" del
        // machote de referencia) — con el tamaño de SGM se veía chico.
        // Bitácoras (PL2853) usa una celda rectangular y ancha (la
        // insignia "Servicio Chavo" de referencia mide ~196x48px) —
        // con las medidas de SASISOPA (cuadradas) el logo se veía
        // diminuto dentro de ese espacio.
        if (_seccionActual === 'sgm') {
            await insertarImagenEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg, 40, 85);
        } else if (_seccionActual === 'bitacoras') {
            // La celda real del encabezado mide ~256px de ancho (3837 dxa)
            // y la fila donde vive ~47px de alto (700 dxa) — el tamaño
            // anterior (48x196) dejaba bastante espacio sin usar a los
            // lados. Se agranda para ocupar casi todo el ancho disponible
            // de la celda, sin acercarse al alto de la fila (para no
            // forzarla a crecer y mover el resto del encabezado).
            await insertarImagenEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg, 60, 245);
        } else {
            await insertarImagenEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg, 105, 105);
        }
        limpiarImagenesPreviasEnCelda(grupoRuns[0]);
    }

    // Inserta una firma dentro de una celda de tabla (columna "Firma"
    // de Elaboró/Revisó/Aprobó). Si la celda no tiene ningún run
    // todavía (queda vacía en el machote), se crea uno primero.
    async function insertarFirmaEnCelda(zip, xmlDoc, rutaXml, celda, dataUrl, ctxImg) {
        let parrafo = celda.getElementsByTagNameNS(NS_W, 'p')[0];
        if (!parrafo) {
            parrafo = xmlDoc.createElementNS(NS_W, 'w:p');
            celda.appendChild(parrafo);
        }
        let runs = Array.from(parrafo.getElementsByTagNameNS(NS_W, 'r'));
        if (!runs.length) {
            const run = xmlDoc.createElementNS(NS_W, 'w:r');
            parrafo.appendChild(run);
            runs = [run];
        }
        await insertarImagenEnGrupo(zip, xmlDoc, rutaXml, runs, dataUrl, ctxImg, 26, 90);
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
                const textoLimpio = textoOriginal.trim();
                let nuevo = valorNuevoPara(textoLimpio, datos);

                // Guarda de contexto (solo SASISOPA): si el placeholder resuelve
                // al nombre de quien ocupa un rol (ROL_*, sin variante _MAYUS) pero
                // la oración lo usa como referencia institucional al puesto (p.ej.
                // "autorizada por la Alta Dirección", "en colaboración con el
                // Supervisor de Estación"), se conserva el título del puesto tal
                // cual venía en el machote en vez de sustituirlo por el nombre de
                // la persona capturada en el checklist.
                if (_seccionActual !== 'sgm' && nuevo && nuevo !== '__SKIP__' && nuevo !== '__LOGO__') {
                    const claveMapeo = SASISOPA_MAPEO[textoLimpio];
                    if (claveMapeo && claveMapeo.indexOf('ROL_') === 0 && claveMapeo.indexOf('_MAYUS') === -1) {
                        const textoPrevio = runs.slice(0, i).map(textoDeRun).join('');
                        if (RE_CONTEXTO_ROL_INSTITUCIONAL.test(textoPrevio)) {
                            nuevo = null;
                        }
                    }
                }

                if (nuevo === '__SKIP__') {
                    stats.placeholdersOmitidos++;
                    grupo.forEach(quitarResaltado);
                } else if (nuevo === '__LOGO__') {
                    if (datos.LOGO_BASE64) {
                        await insertarLogoEnGrupo(ctx.zip, p.ownerDocument, ctx.ruta, grupo, datos.LOGO_BASE64, ctx.imagen);
                        stats.logosInsertados++;
                    } else {
                        setTextoRun(grupo[0], '');
                        for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                        grupo.forEach(quitarResaltado);
                        stats.logosPendientes++;
                    }
                } else if (nuevo === null || nuevo === undefined) {
                    stats.pendientes.push(textoLimpio);
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
    // NOTA: "volumen" se quitó de este patrón — solo coincidía con
    // PROC-T-005/006, que deben usar exclusivamente
    // procesarTablaPatronesSGM (tabla "Patrones y equipos de medida"),
    // nunca esta función de equipo general de estación.
    const RE_ARCHIVOS_CON_TABLA_EQUIPO = /inventario_de_equipo|etiquetas_de_identificaci[oó]n/i;

    function procesarTablaEquipoSGM(xmlDoc, datos, stats) {
        const tablas = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'));
        if (!tablas.length) return;
        const tabla = tablas[tablas.length - 1];
        const filas = Array.from(tabla.getElementsByTagNameNS(NS_W, 'tr'));
        const filasPlantilla = filas.filter(f => f.getElementsByTagNameNS(NS_W, 'tc').length >= 2 && Array.from(f.getElementsByTagNameNS(NS_W, 'r')).some(esResaltadoAmarillo));
        if (!filasPlantilla.length) return;
        const filaPlantilla = filasPlantilla[0];

        if (!datos.EQUIPOS || !datos.EQUIPOS.length) {
            // Estación nueva sin equipos capturados: todas las filas de
            // ejemplo (con los datos del cliente de referencia, p.ej.
            // VEEDER-ROOT/PERMATANK) se dejan en blanco, en vez de salir
            // con esos datos de ejemplo tal cual venían en el machote.
            filasPlantilla.forEach(fila => {
                Array.from(fila.getElementsByTagNameNS(NS_W, 'tc')).forEach(celda => {
                    const runs = Array.from(celda.getElementsByTagNameNS(NS_W, 'r'));
                    if (!runs.length) return;
                    setTextoRun(runs[0], '');
                    runs.forEach(quitarResaltado);
                    for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
                });
            });
            stats.pendientes.push('Tabla de equipo de medición sin capturar (se dejó en blanco para estación nueva)');
            return;
        }

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
        // Si había más filas de ejemplo que equipos capturados (el machote
        // trae varias filas reales del cliente de referencia), se eliminan
        // las filas de ejemplo sobrantes para no dejar datos ajenos.
        filasPlantilla.slice(1).forEach(fila => { if (fila.parentNode) fila.parentNode.removeChild(fila); });
    }

    // ── SGM: tabla de "Patrones y equipos de medida" (PROC-T-005/006) ──
    // Es una tabla distinta a la de equipo de la estación: no tiene columna
    // "Tipo de equipo", trae una columna "No." con numeración secuencial, y
    // puede convivir en el mismo documento junto con la otra tabla — por
    // eso se ubica por su propio encabezado, no por "la última tabla del
    // archivo" (que es como se ubica la de equipo de estación).
    function procesarTablaPatronesSGM(xmlDoc, datos, stats) {
        const norm = t => (t || '').trim().toLowerCase();
        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const filas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'));
            if (filas.length < 2) continue;
            const encabezado = Array.from(filas[0].getElementsByTagNameNS(NS_W, 'tc')).map(c => norm(textoDeCelda(c)));
            const tieneNo = encabezado.some(t => t === 'no.' || t === 'no');
            const tieneMarca = encabezado.some(t => t === 'marca');
            const tieneModelo = encabezado.some(t => t === 'modelo');
            const tieneSerie = encabezado.some(t => t.includes('serie'));
            const tieneTipoEquipo = encabezado.some(t => t.includes('tipo de equipo'));
            if (!(tieneNo && tieneMarca && tieneModelo && tieneSerie) || tieneTipoEquipo) continue;

            const idxNo = encabezado.findIndex(t => t === 'no.' || t === 'no');
            const idxMarca = encabezado.findIndex(t => t === 'marca');
            const idxModelo = encabezado.findIndex(t => t === 'modelo');
            const idxSerie = encabezado.findIndex(t => t.includes('serie'));
            const filasDatos = filas.slice(1);
            if (!filasDatos.length) continue;
            const filaPlantilla = filasDatos[0];

            const limpiarCelda = (celda) => {
                const runs = Array.from(celda.getElementsByTagNameNS(NS_W, 'r'));
                if (!runs.length) return;
                setTextoRun(runs[0], '');
                runs.forEach(quitarResaltado);
                for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
            };
            const ponerValor = (celda, val) => {
                const runs = Array.from(celda.getElementsByTagNameNS(NS_W, 'r'));
                if (!runs.length) return;
                setTextoRun(runs[0], val);
                runs.forEach(quitarResaltado);
                for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
            };

            // "Patrones y equipos de medida" tiene su propia sección en el
            // formulario (PATRONES_EQUIPOS), pero en la práctica los
            // operadores capturan el equipo en "Equipo de medición por
            // estación" (EQUIPOS) — la sección dedicada casi nunca se usa.
            // Si PATRONES_EQUIPOS está vacío, se usa EQUIPOS como respaldo;
            // ambos comparten las mismas claves (marca/modelo/numero_serie),
            // solo se ignora "tipo" porque esta tabla no tiene esa columna.
            const patronesDatos = (datos.PATRONES_EQUIPOS && datos.PATRONES_EQUIPOS.length)
                ? datos.PATRONES_EQUIPOS
                : (datos.EQUIPOS || []);

            if (!patronesDatos.length) {
                filasDatos.forEach(fila => {
                    Array.from(fila.getElementsByTagNameNS(NS_W, 'tc')).forEach((celda, i) => {
                        if (i === idxNo) return; // conserva la numeración secuencial fija
                        limpiarCelda(celda);
                    });
                });
                stats.pendientes.push('Tabla de patrones y equipos de medida sin capturar (se dejó en blanco)');
                continue;
            }

            patronesDatos.forEach((patron, idx) => {
                const filaNueva = idx === 0 ? filaPlantilla : filaPlantilla.cloneNode(true);
                const celdas = Array.from(filaNueva.getElementsByTagNameNS(NS_W, 'tc'));
                if (idxNo !== -1 && celdas[idxNo]) ponerValor(celdas[idxNo], String(idx + 1));
                if (idxMarca !== -1 && celdas[idxMarca]) ponerValor(celdas[idxMarca], patron.marca || '');
                if (idxModelo !== -1 && celdas[idxModelo]) ponerValor(celdas[idxModelo], patron.modelo || '');
                if (idxSerie !== -1 && celdas[idxSerie]) ponerValor(celdas[idxSerie], patron.numero_serie || '');
                if (idx > 0) filaPlantilla.parentNode.insertBefore(filaNueva, filaPlantilla.nextSibling);
                stats.reemplazos++;
            });
            filasDatos.slice(1).forEach(fila => { if (fila !== filaPlantilla && fila.parentNode) fila.parentNode.removeChild(fila); });
        }
    }


    const UMBRAL_CHARS_TABLA_GENERICA = 300;

    function neutralizarTablasDescriptivasSGM(xmlDoc) {
        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const runsAmarillos = Array.from(tbl.getElementsByTagNameNS(NS_W, 'r')).filter(esResaltadoAmarillo);
            // Antes se sumaban los caracteres de TODOS los runs amarillos
            // de la tabla — una tabla con muchas tarjetas repetidas (p.ej.
            // FOR-T-008, con 24 tarjetas de "FELIX RUIZ GONZALEZ") suma
            // fácilmente cientos de caracteres aunque cada placeholder sea
            // corto y legítimo, y terminaba neutralizando todos por error.
            // Ahora se mide el run MÁS LARGO individual: un bloque de
            // texto descriptivo mal resaltado por accidente normalmente
            // es un párrafo largo en un solo run, no muchos placeholders
            // cortos repetidos.
            const maxChars = runsAmarillos.reduce((max, r) => Math.max(max, textoDeRun(r).length), 0);
            if (maxChars >= UMBRAL_CHARS_TABLA_GENERICA) {
                runsAmarillos.forEach(quitarResaltado);
            }
        }
    }

    function resolverNombreFirma(puestoTexto, nombreTexto, datos) {
        const norm = t => (t || '').trim().toLowerCase().replace(/[.:]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const puestoNorm = norm(puestoTexto);
        const nombreNorm = norm(nombreTexto);
        if (nombreTexto && nombreTexto.trim() && nombreNorm !== puestoNorm) return nombreTexto.trim();
        const roles = sistemaActivo().rolesOrganigrama || [];
        const rol = roles.find(r => norm(r.etiqueta) === puestoNorm);
        if (rol && datos[rol.clave]) return datos[rol.clave];
        return (nombreTexto || '').trim();
    }

    const ALIAS_COL_PUESTO = ['puesto o función', 'puesto o funcion', 'función', 'funcion', 'puesto'];
    const ALIAS_FILA_FIRMA = {
        elabora: 'elaboró', elaboro: 'elaboró', 'elaboró': 'elaboró',
        revisa: 'revisó', reviso: 'revisó', 'revisó': 'revisó',
        autoriza: 'aprobó', aprueba: 'aprobó', aprobo: 'aprobó', 'aprobó': 'aprobó', aprobado: 'aprobó',
    };

    function procesarTablaDocumentoControlado(xmlDoc, datos, celdasFirmaPendientes) {
        const norm = t => (t || '').trim().toLowerCase();
        const esSgm = _seccionActual === 'sgm';
        // En SASISOPA no aplicamos los nombres de respaldo pensados para SGM
        // (Lezlie/Félix): si el cliente no capturó el dato, se deja en blanco
        // en vez de filtrar un nombre que no le corresponde.
        const val = (clave, porDefecto) => (datos[clave] && String(datos[clave]).trim()) ? String(datos[clave]).trim() : (esSgm ? porDefecto : '');
        const puestoElabora = val('PUESTO_ELABORA', 'Administrativo');
        const puestoReviso = val('PUESTO_REVISO', 'Alta Dirección');
        const puestoAprueba = val('PUESTO_APRUEBA', 'Alta Dirección');
        const filasInfo = {
            'elaboró': { nombre: resolverNombreFirma(puestoElabora, val('NOMBRE_ELABORA', 'Lezlie Anahy Gutierrez Armendáriz.'), datos), puesto: puestoElabora, firma: datos.FIRMA_ELABORA_BASE64 },
            'revisó': { nombre: resolverNombreFirma(puestoReviso, val('NOMBRE_REVISO', 'Félix Ruiz Gonzalez'), datos), puesto: puestoReviso, firma: datos.FIRMA_REVISO_BASE64 },
            'aprobó': { nombre: resolverNombreFirma(puestoAprueba, val('NOMBRE_APRUEBA', 'Félix Ruiz Gonzalez'), datos), puesto: puestoAprueba, firma: datos.FIRMA_APRUEBA_BASE64 },
        };
        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const filas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'));
            if (!filas.length) continue;
            const encabezado = Array.from(filas[0].getElementsByTagNameNS(NS_W, 'tc')).map(textoDeCelda);
            const esTablaDocumentoControlado = encabezado.some(t => norm(t) === 'nombre')
                && encabezado.some(t => ALIAS_COL_PUESTO.includes(norm(t)));
            if (!esTablaDocumentoControlado) continue;

            const idxNombre = encabezado.findIndex(t => norm(t) === 'nombre');
            const idxPuesto = encabezado.findIndex(t => ALIAS_COL_PUESTO.includes(norm(t)));
            const idxFirma = encabezado.findIndex(t => norm(t) === 'firma');
            for (const fila of filas) {
                const celdas = Array.from(fila.getElementsByTagNameNS(NS_W, 'tc'));
                const claveCruda = norm(textoDeCelda(celdas[0])).replace(/:$/, '');
                const primeraCelda = ALIAS_FILA_FIRMA[claveCruda] || claveCruda;
                const info = filasInfo[primeraCelda];
                if (!info) continue;
                if (celdas[idxNombre]) reemplazarTextoCelda(celdas[idxNombre], info.nombre);
                if (celdas[idxPuesto]) reemplazarTextoCelda(celdas[idxPuesto], info.puesto);
                if (celdas[idxFirma]) {
                    Array.from(celdas[idxFirma].getElementsByTagNameNS(NS_W, 'r')).forEach(quitarResaltado);
                    if (info.firma && celdasFirmaPendientes) celdasFirmaPendientes.push({ celda: celdas[idxFirma], dataUrl: info.firma });
                }
            }
            // Solo se llena la PRIMERA tabla que coincida — es la tabla
            // real de "Documento Controlado" al inicio del documento.
            // Algunos machotes (p.ej. PROC-G-002, sección 4.3) incluyen
            // una segunda tabla IDÉNTICA como ejemplo ilustrativo dentro
            // del propio texto del procedimiento ("...lleva el siguiente
            // recuadro, ej.:") — esa NO debe llenarse con los datos
            // reales del cliente, debe quedar como muestra genérica.
            break;
        }
    }

    function procesarControlDeCambiosSGM(xmlDoc, datos) {
        const norm = t => (t || '').trim().toLowerCase();
        const val = (clave, porDefecto) => (datos[clave] && String(datos[clave]).trim()) ? String(datos[clave]).trim() : porDefecto;
        const puestoElabora = val('PUESTO_ELABORA', 'Administrativo');
        const puestoReviso = val('PUESTO_REVISO', 'Alta Dirección');
        const puestoAprueba = val('PUESTO_APRUEBA', 'Alta Dirección');
        const inicialesRealizo = iniciales(resolverNombreFirma(puestoElabora, val('NOMBRE_ELABORA', 'Lezlie Anahy Gutierrez Armendáriz.'), datos));
        const inicialesRevisoCol = iniciales(resolverNombreFirma(puestoReviso, val('NOMBRE_REVISO', 'Félix Ruiz Gonzalez'), datos));
        const inicialesApruebaCol = iniciales(resolverNombreFirma(puestoAprueba, val('NOMBRE_APRUEBA', 'Félix Ruiz Gonzalez'), datos));

        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const filas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'));
            if (!filas.length) continue;
            const encabezado = Array.from(filas[0].getElementsByTagNameNS(NS_W, 'tc')).map(textoDeCelda);
            const esControlCambios = encabezado.some(t => norm(t).replace(/:$/, '') === 'realizó')
                && encabezado.some(t => norm(t).replace(/:$/, '') === 'revisó')
                && encabezado.some(t => norm(t).replace(/:$/, '') === 'aprobó');
            if (!esControlCambios) continue;

            const idxRealizo = encabezado.findIndex(t => norm(t).replace(/:$/, '') === 'realizó');
            const idxRevisoCol = encabezado.findIndex(t => norm(t).replace(/:$/, '') === 'revisó');
            const idxApruebaCol = encabezado.findIndex(t => norm(t).replace(/:$/, '') === 'aprobó');
            for (const fila of filas.slice(1)) {
                const celdas = Array.from(fila.getElementsByTagNameNS(NS_W, 'tc'));
                const tieneContenido = celdas[idxRealizo] && textoDeCelda(celdas[idxRealizo]).trim();
                if (!tieneContenido) continue;
                if (celdas[idxRealizo]) reemplazarTextoCelda(celdas[idxRealizo], inicialesRealizo);
                if (celdas[idxRevisoCol]) reemplazarTextoCelda(celdas[idxRevisoCol], inicialesRevisoCol);
                if (celdas[idxApruebaCol]) reemplazarTextoCelda(celdas[idxApruebaCol], inicialesApruebaCol);
            }
        }
    }

    function reemplazarTextoCelda(celda, textoNuevo) {
        let parrafo = celda.getElementsByTagNameNS(NS_W, 'p')[0];
        if (!parrafo) {
            // La celda no tiene ni un párrafo (caso muy raro) — se crea uno.
            parrafo = celda.ownerDocument.createElementNS(NS_W, 'w:p');
            celda.appendChild(parrafo);
        }
        const runs = Array.from(parrafo.getElementsByTagNameNS(NS_W, 'r'));
        const primero = runs[0];
        runs.slice(1).forEach(r => r.parentNode && r.parentNode.removeChild(r));
        if (primero) {
            quitarResaltado(primero);
            Array.from(primero.getElementsByTagNameNS(NS_W, 't')).forEach(t => t.parentNode.removeChild(t));
            const t = primero.ownerDocument.createElementNS(NS_W, 'w:t');
            t.setAttribute('xml:space', 'preserve');
            t.textContent = textoNuevo;
            primero.appendChild(t);
        } else {
            // Celda vacía: el párrafo no tiene ningún run (pasa en tablas
            // de firmas de SASISOPA, p.ej. la columna "Nombre" de M-00,
            // donde el machote nunca escribió nada ahí). Se crea un run
            // nuevo, copiando la fuente/formato del párrafo si existe
            // (w:pPr > w:rPr), para que el texto no salga con la fuente
            // por default de Word.
            const nuevoRun = parrafo.ownerDocument.createElementNS(NS_W, 'w:r');
            const pPr = parrafo.getElementsByTagNameNS(NS_W, 'pPr')[0];
            const rPrParrafo = pPr ? pPr.getElementsByTagNameNS(NS_W, 'rPr')[0] : null;
            if (rPrParrafo) nuevoRun.appendChild(rPrParrafo.cloneNode(true));
            const t = parrafo.ownerDocument.createElementNS(NS_W, 'w:t');
            t.setAttribute('xml:space', 'preserve');
            t.textContent = textoNuevo;
            nuevoRun.appendChild(t);
            parrafo.appendChild(nuevoRun);
        }
    }

    function textoParrafo(p) {
        return Array.from(p.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('');
    }

    // ── SASISOPA: resolución de bloques "NOMBRE" + etiqueta de puesto ──
    // En varios machotes (p.ej. P-05, F-07-03) aparece un bloque de dos
    // líneas: la primera dice literalmente "NOMBRE" (resaltada en amarillo)
    // y la segunda es la etiqueta del puesto (p.ej. "Representante
    // Técnico"). Ahí sí se debe sustituir "NOMBRE" por el nombre de quien
    // ocupa ese puesto. En cualquier otro lugar donde aparezca "NOMBRE"
    // suelto (encabezados de columna, etc.) se deja tal cual — solo se le
    // quita el resaltado en la limpieza final.
    // Agrupa los runs de un párrafo en "etiquetas": tramos de runs
    // consecutivos con texto no vacío, separados por runs que son
    // puramente espacio en blanco (el patrón que usan los machotes para
    // alinear varias etiquetas en la misma línea con tabulaciones).
    function agruparEnEtiquetas(p) {
        const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
        const grupos = [];
        let actual = [];
        for (const r of runs) {
            if (textoDeRun(r).trim() === '') {
                if (actual.length) { grupos.push(actual); actual = []; }
            } else {
                actual.push(r);
            }
        }
        if (actual.length) grupos.push(actual);
        return grupos.map(g => ({ runs: g, texto: g.map(textoDeRun).join('').trim() }));
    }

    // Fuerza el centrado real de un párrafo: asegura que exista
    // jc="center" (algunos machotes, como F-07-04, nunca lo declararon —
    // sin esto Word alinea a la izquierda por default sin importar la
    // sangría) y normaliza sangría izquierda/derecha desiguales a 0
    // (residuo de cómo se armó la línea de firma originalmente, que con
    // jc="center" desplaza el punto real de centrado hacia un lado).
    function normalizarCentradoParrafo(p) {
        let pPr = p.getElementsByTagNameNS(NS_W, 'pPr')[0];
        if (!pPr) {
            pPr = p.ownerDocument.createElementNS(NS_W, 'w:pPr');
            p.insertBefore(pPr, p.firstChild);
        }
        let jc = pPr.getElementsByTagNameNS(NS_W, 'jc')[0];
        if (!jc) {
            jc = p.ownerDocument.createElementNS(NS_W, 'w:jc');
            pPr.appendChild(jc);
        }
        jc.setAttributeNS(NS_W, 'w:val', 'center');
        const ind = pPr.getElementsByTagNameNS(NS_W, 'ind')[0];
        if (ind && ind.getAttributeNS(NS_W, 'left') !== ind.getAttributeNS(NS_W, 'right')) {
            ind.setAttributeNS(NS_W, 'w:left', '0');
            ind.setAttributeNS(NS_W, 'w:right', '0');
        }
    }

    // Cuadros de texto flotantes (w:pict/w:drawing) usados como línea de
    // firma — p.ej. F-07-01, con dos cajas de texto lado a lado (CONVOCA/
    // ELABORA), cada una con el nombre del puesto adentro. A diferencia
    // de la mención en un párrafo narrativo (donde debe quedarse como
    // título del puesto — ver RE_CONTEXTO_ROL_INSTITUCIONAL), aquí SÍ
    // corresponde mostrar el nombre real de quien lo ocupa. Estas cajas
    // no siempre traen el resaltado amarillo (a veces solo una de las
    // dos lo tiene, como en F-07-01), así que se detectan por texto
    // exacto dentro de la forma, sin depender del resaltado.
    // P-07, punto 4.1.5: "La Alta Dirección empoderará al personal..." — el
    // puesto venía fijo en el machote ("Alta Dirección"). Ahora es
    // seleccionable (P07_ROL_4_1_5); si no se elige nada, se mantiene
    // "Alta Dirección" por default, PERO como puesto (no como nombre de
    // persona) — se le quita el resaltado para que el motor genérico no
    // lo convierta a nombre, mismo criterio que en SGM para menciones de
    // rol en párrafos narrativos.
    function procesarPuestoDinamicoP07(xmlDoc, datos, nombreArchivo, stats) {
        if (!/^P-07(?!\d)/i.test(nombreArchivo || '')) return;
        const claveRol = datos.P07_ROL_4_1_5 || 'ROL_ALTA_DIRECCION';
        const rol = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === claveRol);
        if (!rol) return;
        const articulo = SASISOPA_ARTICULO_ROL[rol.clave] || 'El';
        const norm = t => (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            if (!textoParrafo(p).includes('empoderará al personal')) continue;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            let i = 0;
            while (i < runs.length) {
                if (!esResaltadoAmarillo(runs[i])) { i++; continue; }
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                const grupo = runs.slice(i, j);
                const textoGrupo = grupo.map(textoDeRun).join('').trim();

                // El artículo puede venir DENTRO del mismo grupo resaltado
                // ("La Alta Dirección" completo, como en el machote real)
                // o AFUERA, en el run anterior sin resaltar ("La " +
                // "Alta Dirección" resaltado por separado) — se manejan
                // ambos casos. La comparación siempre es contra el texto
                // FIJO de referencia del machote ("Alta Dirección"), sin
                // importar qué puesto se haya elegido para sustituirlo.
                if (norm(textoGrupo) === norm('La Alta Dirección') || norm(textoGrupo) === norm('El Alta Dirección')) {
                    setTextoRun(grupo[0], articulo + ' ' + rol.etiqueta);
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    grupo.forEach(quitarResaltado);
                    stats.reemplazos++;
                    i = j;
                    continue;
                }
                if (norm(textoGrupo) !== norm('Alta Dirección')) { i = j; continue; }

                setTextoRun(grupo[0], rol.etiqueta);
                for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                grupo.forEach(quitarResaltado);

                if (i > 0) {
                    const anterior = runs[i - 1];
                    const textoAnterior = textoDeRun(anterior);
                    if (/\bla\b/i.test(textoAnterior)) {
                        setTextoRun(anterior, textoAnterior.replace(/\bLa\b/i, articulo));
                    }
                }
                stats.reemplazos++;
                i = j;
            }
        }
    }

    // P-08.2, puntos 3.1 y 4.4.2: "El Representante Técnico... revisar...
    // y de la Alta Dirección autorizarlos" / "...revisados por el
    // Representante Técnico y aprobados por la Alta Dirección..." — dos
    // puestos fijos (quién revisa, quién aprueba) que ahora son
    // seleccionables. "Representante Técnico" nunca tuvo resaltado (se
    // ubica por texto exacto); "Alta Dirección" sí lo tenía y por lo
    // tanto se convertía al nombre de la persona sin querer (mismo bug
    // que P-07) — aquí también se protege quitándole el resaltado.
    function procesarRolesDinamicosP082(xmlDoc, datos, nombreArchivo, stats) {
        if (!/^P-08_2/i.test(nombreArchivo || '')) return;
        const rolRevisa = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === (datos.P082_ROL_REVISA || 'ROL_REPRESENTANTE_TECNICO'));
        const rolAprueba = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === (datos.P082_ROL_APRUEBA || 'ROL_ALTA_DIRECCION'));
        if (!rolRevisa || !rolAprueba) return;
        const artRevisa = SASISOPA_ARTICULO_ROL[rolRevisa.clave] || 'El';
        const artAprueba = SASISOPA_ARTICULO_ROL[rolAprueba.clave] || 'El';
        const norm = t => (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const ajustarArticuloAnterior = (runs, idx, articuloMayus) => {
            if (idx <= 0) return;
            const anterior = runs[idx - 1];
            const t = textoDeRun(anterior);
            const m = /\b(el|la)(\s*)$/i.exec(t);
            if (!m) return;
            // Conservar mayúscula/minúscula según cómo estaba el
            // artículo ORIGINAL (mayúscula solo si es inicio de oración).
            const esMayus = m[1][0] === m[1][0].toUpperCase() && m[1][0] !== m[1][0].toLowerCase();
            const articulo = esMayus ? articuloMayus : articuloMayus.toLowerCase();
            // "de" + "el" contrae obligatoriamente a "del" en español
            // ("de la Alta Dirección" está bien, pero "de el Representante"
            // debe ser "del Representante").
            const textoPrevioADeArticulo = t.slice(0, m.index);
            if (articulo.toLowerCase() === 'el' && /\bde\s*$/i.test(textoPrevioADeArticulo)) {
                const conDel = textoPrevioADeArticulo.replace(/\bde\s*$/i, esMayus ? 'Del ' : 'del ');
                setTextoRun(anterior, conDel);
                return;
            }
            setTextoRun(anterior, textoPrevioADeArticulo + articulo + m[2]);
        };

        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const texto = textoParrafo(p);
            if (!texto.includes('revisar los documentos controlados') && !texto.includes('serán revisados por') && !texto.includes('Establecer claves de acceso')) continue;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));

            for (let i = 0; i < runs.length; i++) {
                const textoRun = textoDeRun(runs[i]);
                // Antes se exigía que el run dijera EXACTAMENTE
                // "Representante Técnico" — pero en el punto 8 de 4.2.2
                // viene pegado en el mismo run junto con " y " ("...el
                // Representante Técnico y ..."), así que se busca como
                // subcadena y se reemplaza solo esa parte, respetando el
                // resto del texto del run.
                const idxMencion = textoRun.search(/Representante\s+T[eé]cnico/i);
                if (idxMencion === -1) continue;
                const mencion = /Representante\s+T[eé]cnico/i.exec(textoRun)[0];
                setTextoRun(runs[i], textoRun.replace(mencion, rolRevisa.etiqueta));
                quitarResaltado(runs[i]);
                if (textoRun.trim() === mencion) ajustarArticuloAnterior(runs, i, artRevisa);
                stats.reemplazos++;
            }

            let i = 0;
            while (i < runs.length) {
                if (!esResaltadoAmarillo(runs[i])) { i++; continue; }
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                const grupo = runs.slice(i, j);
                const textoGrupo = grupo.map(textoDeRun).join('').trim();

                // El artículo puede venir DENTRO del mismo grupo resaltado
                // ("la Alta Dirección" completo) o AFUERA, en el run
                // anterior sin resaltar — se manejan ambos casos, igual
                // que en P-07.
                if (norm(textoGrupo) === norm('la Alta Dirección') || norm(textoGrupo) === norm('el Alta Dirección')) {
                    const primeraLetra = textoDeRun(grupo[0]).trim()[0];
                    const esMayus = primeraLetra === primeraLetra.toUpperCase() && primeraLetra !== primeraLetra.toLowerCase();
                    const art = esMayus ? artAprueba : artAprueba.toLowerCase();
                    // Si el run anterior (sin resaltar) termina en "de " y
                    // el nuevo artículo es masculino, contrae a "del".
                    if (art.toLowerCase() === 'el' && i > 0 && /\bde\s*$/i.test(textoDeRun(runs[i - 1]))) {
                        const anterior = runs[i - 1];
                        const tAnterior = textoDeRun(anterior);
                        const esMayusDe = /\bDe\s*$/.test(tAnterior);
                        setTextoRun(anterior, tAnterior.replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                        setTextoRun(grupo[0], rolAprueba.etiqueta);
                    } else {
                        setTextoRun(grupo[0], art + ' ' + rolAprueba.etiqueta);
                    }
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    grupo.forEach(quitarResaltado);
                    stats.reemplazos++;
                    i = j;
                    continue;
                }
                if (norm(textoGrupo) !== norm('Alta Dirección')) { i = j; continue; }
                setTextoRun(grupo[0], rolAprueba.etiqueta);
                for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                grupo.forEach(quitarResaltado);
                ajustarArticuloAnterior(runs, i, artAprueba);
                stats.reemplazos++;
                i = j;
            }
        }
    }

    // P-18, punto 1 (Objetivo): "...por parte de la Alta Dirección, y
    // definir..." — mismo patrón de artículo que P-07/P-08.2 (puede venir
    // separado sin resaltar, o incluido dentro del mismo resaltado según
    // el machote real). Punto 3.1 (Responsables): "Alta Dirección (máxima
    // autoridad), Representante Técnico y todo el personal..." — sin
    // ningún artículo (es una lista de roles), así que ahí se sustituye
    // el rol tal cual, sin agregar artículo.
    function procesarRolesDinamicosP18(xmlDoc, datos, nombreArchivo, stats) {
        if (!/^P-18/i.test(nombreArchivo || '')) return;
        const norm = t => (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        // Punto 1 (Objetivo) — con artículo.
        const rol11 = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === (datos.P18_ROL_1_1 || 'ROL_ALTA_DIRECCION'));
        if (rol11) {
            const art11 = SASISOPA_ARTICULO_ROL[rol11.clave] || 'El';
            for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
                if (!textoParrafo(p).includes('definir la vía de comunicarlo')) continue;
                const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
                let i = 0;
                while (i < runs.length) {
                    if (!esResaltadoAmarillo(runs[i])) { i++; continue; }
                    let j = i + 1;
                    while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                    const grupo = runs.slice(i, j);
                    const textoGrupo = grupo.map(textoDeRun).join('').trim();
                    if (norm(textoGrupo) === norm('la Alta Dirección') || norm(textoGrupo) === norm('el Alta Dirección')) {
                        const esMayus = /^[A-ZÁÉÍÓÚÑ]/.test(textoDeRun(grupo[0]).trim());
                        const art = esMayus ? art11 : art11.toLowerCase();
                        if (art.toLowerCase() === 'el' && i > 0 && /\bde\s*$/i.test(textoDeRun(runs[i - 1]))) {
                            const anterior = runs[i - 1];
                            const esMayusDe = /\bDe\s*$/.test(textoDeRun(anterior));
                            setTextoRun(anterior, textoDeRun(anterior).replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                            setTextoRun(grupo[0], rol11.etiqueta);
                        } else {
                            setTextoRun(grupo[0], art + ' ' + rol11.etiqueta);
                        }
                        for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                        grupo.forEach(quitarResaltado);
                        stats.reemplazos++;
                        i = j;
                        continue;
                    }
                    if (norm(textoGrupo) !== norm('Alta Dirección')) { i = j; continue; }
                    setTextoRun(grupo[0], rol11.etiqueta);
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    grupo.forEach(quitarResaltado);
                    if (i > 0) {
                        const anterior = runs[i - 1];
                        const t = textoDeRun(anterior);
                        const m = /\b(el|la)(\s*)$/i.exec(t);
                        if (m) {
                            const esMayus = m[1][0] === m[1][0].toUpperCase();
                            const art = esMayus ? art11 : art11.toLowerCase();
                            const previo = t.slice(0, m.index);
                            if (art.toLowerCase() === 'el' && /\bde\s*$/i.test(previo)) {
                                const esMayusDe = /\bDe\s*$/.test(previo);
                                setTextoRun(anterior, previo.replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                            } else {
                                setTextoRun(anterior, previo + art + m[2]);
                            }
                        }
                    }
                    stats.reemplazos++;
                    i = j;
                }
            }
        }

        // Punto 3.1 (Responsables) — sin artículo, lista de roles.
        const rol31 = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === (datos.P18_ROL_3_1 || 'ROL_ALTA_DIRECCION'));
        if (rol31) {
            for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
                if (!textoParrafo(p).includes('máxima autoridad')) continue;
                const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
                for (const r of runs) {
                    if (norm(textoDeRun(r)) !== norm('Alta Dirección')) continue;
                    setTextoRun(r, rol31.etiqueta);
                    quitarResaltado(r);
                    stats.reemplazos++;
                }
            }
        }
    }

    // P-11, tres menciones narrativas: "...designado por la Alta
    // Dirección...", "...que designe la Alta Dirección...", "...que la
    // Alta Dirección designe...". Las tres comparten el mismo puesto
    // (Alta Dirección, con artículo separado sin resaltar) y ahora usan
    // un solo selector — la persona que ocupa el rol elegido puede
    // sustituir a Alta Dirección en las tres a la vez.
    function procesarRolAltaDireccionP11(xmlDoc, datos, nombreArchivo, stats) {
        if (!/^P-11(?!\d)/i.test(nombreArchivo || '')) return;
        const rol = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === (datos.P11_ROL_ALTA_DIRECCION || 'ROL_ALTA_DIRECCION'));
        if (!rol) return;
        const articulo = SASISOPA_ARTICULO_ROL[rol.clave] || 'El';
        const norm = t => (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const ANCLAS = ['personal designado por', 'personal que designe', 'personal que la'];

        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const texto = textoParrafo(p);
            if (!ANCLAS.some(a => texto.includes(a))) continue;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            let i = 0;
            while (i < runs.length) {
                if (!esResaltadoAmarillo(runs[i])) { i++; continue; }
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                const grupo = runs.slice(i, j);
                const textoGrupo = grupo.map(textoDeRun).join('').trim();

                if (norm(textoGrupo) === norm('la Alta Dirección') || norm(textoGrupo) === norm('el Alta Dirección')) {
                    const esMayus = /^[A-ZÁÉÍÓÚÑ]/.test(textoDeRun(grupo[0]).trim());
                    const art = esMayus ? articulo : articulo.toLowerCase();
                    if (art.toLowerCase() === 'el' && i > 0 && /\bde\s*$/i.test(textoDeRun(runs[i - 1]))) {
                        const anterior = runs[i - 1];
                        const esMayusDe = /\bDe\s*$/.test(textoDeRun(anterior));
                        setTextoRun(anterior, textoDeRun(anterior).replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                        setTextoRun(grupo[0], rol.etiqueta);
                    } else {
                        setTextoRun(grupo[0], art + ' ' + rol.etiqueta);
                    }
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    grupo.forEach(quitarResaltado);
                    stats.reemplazos++;
                    i = j;
                    continue;
                }
                if (norm(textoGrupo) !== norm('Alta Dirección')) { i = j; continue; }

                setTextoRun(grupo[0], rol.etiqueta);
                for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                grupo.forEach(quitarResaltado);
                if (i > 0) {
                    const anterior = runs[i - 1];
                    const t = textoDeRun(anterior);
                    const m = /\b(el|la)(\s*)$/i.exec(t);
                    if (m) {
                        const esMayus = m[1][0] === m[1][0].toUpperCase();
                        const art = esMayus ? articulo : articulo.toLowerCase();
                        const previo = t.slice(0, m.index);
                        if (art.toLowerCase() === 'el' && /\bde\s*$/i.test(previo)) {
                            const esMayusDe = /\bDe\s*$/.test(previo);
                            setTextoRun(anterior, previo.replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                        } else {
                            setTextoRun(anterior, previo + art + m[2]);
                        }
                    }
                }
                stats.reemplazos++;
                i = j;
            }
        }
    }

    // Protege una lista de roles mencionados en un párrafo narrativo
    // (p.ej. P-10.8 3.1: "...la Alta Dirección, Representante Técnico,
    // Supervisor de Estación.") para que se queden como título del
    // puesto — algunos vienen resaltados (se convertirían al nombre de
    // la persona sin esto) y otros no, sin ningún patrón consistente
    // entre ellos. Uso genérico: solo se necesita el archivo y la frase
    // ancla del párrafo.
    function protegerListaDeRolesSASISOPA(xmlDoc, nombreArchivo, patronArchivo, ancla) {
        if (!patronArchivo.test(nombreArchivo || '')) return;
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            if (!textoParrafo(p).includes(ancla)) continue;
            Array.from(p.getElementsByTagNameNS(NS_W, 'r'))
                .filter(esResaltadoAmarillo)
                .forEach(quitarResaltado);
        }
    }

    // Versión GENÉRICA de las correcciones anteriores (P-07, P-08.2,
    // P-18, P-11) — antes cada documento nuevo necesitaba su propia
    // función de ~60 líneas; ahora solo se necesita indicar las frases
    // ancla del párrafo, la clave del selector en el formulario, y si la
    // mención lleva artículo o no (algunas son narrativas con "la Alta
    // Dirección"; otras son listas de roles sin artículo, como "Alta
    // Dirección, Representante Técnico y..."). Se encarga de detectar el
    // artículo venga separado o incluido en el mismo resaltado, ajustar
    // mayúscula/minúscula, y contraer "de"+"el"="del" cuando aplica.
    function procesarMencionRolNarrativaSASISOPA(xmlDoc, datos, stats, opciones) {
        const { nombreArchivo, patronArchivo, anclas, clave, rolPorDefecto, conArticulo, mencionOriginal } = opciones;
        if (!patronArchivo.test(nombreArchivo || '')) return;
        const rol = SASISOPA_ROLES_DISPONIBLES.find(r => r.clave === (datos[clave] || rolPorDefecto));
        if (!rol) return;
        const articulo = SASISOPA_ARTICULO_ROL[rol.clave] || 'El';
        const norm = t => (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const mencion = mencionOriginal || 'Alta Dirección';

        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const texto = textoParrafo(p);
            if (!anclas.some(a => texto.includes(a))) continue;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            let i = 0;
            while (i < runs.length) {
                if (!esResaltadoAmarillo(runs[i])) { i++; continue; }
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                const grupo = runs.slice(i, j);
                const textoGrupo = grupo.map(textoDeRun).join('').trim();

                if (conArticulo && (norm(textoGrupo) === norm('la ' + mencion) || norm(textoGrupo) === norm('el ' + mencion))) {
                    const esMayus = /^[A-ZÁÉÍÓÚÑ]/.test(textoDeRun(grupo[0]).trim());
                    const art = esMayus ? articulo : articulo.toLowerCase();
                    if (art.toLowerCase() === 'el' && i > 0 && /\bde\s*$/i.test(textoDeRun(runs[i - 1]))) {
                        const anterior = runs[i - 1];
                        const esMayusDe = /\bDe\s*$/.test(textoDeRun(anterior));
                        setTextoRun(anterior, textoDeRun(anterior).replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                        setTextoRun(grupo[0], rol.etiqueta);
                    } else {
                        setTextoRun(grupo[0], art + ' ' + rol.etiqueta);
                    }
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    grupo.forEach(quitarResaltado);
                    stats.reemplazos++;
                    i = j;
                    continue;
                }
                if (norm(textoGrupo) !== norm(mencion)) { i = j; continue; }

                setTextoRun(grupo[0], rol.etiqueta);
                for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                grupo.forEach(quitarResaltado);
                if (conArticulo && i > 0) {
                    const anterior = runs[i - 1];
                    const t = textoDeRun(anterior);
                    const m = /\b(el|la)(\s*)$/i.exec(t);
                    if (m) {
                        const esMayus = m[1][0] === m[1][0].toUpperCase();
                        const art = esMayus ? articulo : articulo.toLowerCase();
                        const previo = t.slice(0, m.index);
                        if (art.toLowerCase() === 'el' && /\bde\s*$/i.test(previo)) {
                            const esMayusDe = /\bDe\s*$/.test(previo);
                            setTextoRun(anterior, previo.replace(/\bde\s*$/i, esMayusDe ? 'Del ' : 'del '));
                        } else {
                            setTextoRun(anterior, previo + art + m[2]);
                        }
                    }
                }
                stats.reemplazos++;
                i = j;
            }
        }
    }

    function resolverRolesEnFormasSASISOPA(xmlDoc, datos, stats) {
        const sis = sistemaActivo();
        const roles = sis.rolesOrganigrama || [];
        const norm = t => (t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const contenedores = [
            ...Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'pict')),
            ...Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'drawing')),
        ];
        for (const contenedor of contenedores) {
            // La etiqueta del rol puede venir partida en varios runs
            // (p.ej. "Representante" + " Técnico" en F-07-01, por cómo
            // Word divide el texto internamente) — se agrupan los runs
            // consecutivos con texto no vacío antes de comparar, igual
            // que agruparEnEtiquetas de arriba.
            const runs = Array.from(contenedor.getElementsByTagNameNS(NS_W, 'r'));
            let grupo = [];
            const procesarGrupo = () => {
                if (!grupo.length) return;
                const texto = grupo.map(textoDeRun).join('').trim();
                const rol = roles.find(rr => norm(rr.etiqueta) === norm(texto));
                if (rol) {
                    const nombre = datos[rol.clave];
                    if (nombre) {
                        setTextoRun(grupo[0], nombre);
                        for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                        grupo.forEach(quitarResaltado);
                        stats.reemplazos++;
                    }
                }
                grupo = [];
            };
            for (const r of runs) {
                if (textoDeRun(r).trim() === '') procesarGrupo();
                else grupo.push(r);
            }
            procesarGrupo();
        }
    }

    function resolverNombresPorRolSASISOPA(xmlDoc, datos, stats, nombreArchivo) {
        const sis = sistemaActivo();
        const roles = sis.rolesOrganigrama || [];
        const extras = Array.isArray(datos.ROLES_EXTRA) ? datos.ROLES_EXTRA : [];
        const norm = t => (t || '').replace(/[.:]+\s*$/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const nombrePorEtiqueta = etiqueta => {
            // F-07-04: el "NOMBRE" junto a la etiqueta "Cliente" no
            // corresponde a ningún rol interno fijo — el cliente decide
            // qué puesto de su organización debe llenar esa firma, vía el
            // apartado "Apartado nombre (Cliente) F-07-04" del formulario.
            if (norm(etiqueta) === 'cliente' && /^F-07-04/i.test(nombreArchivo || '') && datos.F0704_ROL_CLIENTE) {
                const rolElegido = roles.find(r => r.clave === datos.F0704_ROL_CLIENTE);
                if (rolElegido) return datos[rolElegido.clave] || '';
            }
            const rol = roles.find(r => norm(r.etiqueta) === norm(etiqueta));
            if (rol) return datos[rol.clave] || '';
            const extra = extras.find(e => norm(e.etiqueta) === norm(etiqueta));
            return extra ? (extra.nombre || '') : null;
        };
        const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
        // Ventana de búsqueda del puesto relacionado con "NOMBRE": antes se
        // exigía que fuera el párrafo INMEDIATO siguiente, pero en los
        // machotes de Manual y Procedimiento a veces hay un párrafo vacío
        // de por medio, o el puesto viene ANTES en vez de después — se
        // busca en ambas direcciones, saltando párrafos en blanco.
        const VENTANA = 3;
        const buscarEtiquetaCercana = i => {
            for (let j = i + 1; j <= i + VENTANA && j < parrafos.length; j++) {
                const t2 = textoParrafo(parrafos[j]).trim();
                if (!t2) continue; // párrafo vacío, se sigue buscando
                const nombre = nombrePorEtiqueta(t2);
                return nombre !== null ? { texto: t2, nombre } : buscarHaciaAtras(i);
            }
            return buscarHaciaAtras(i);
        };
        const buscarHaciaAtras = i => {
            for (let j = i - 1; j >= i - VENTANA && j >= 0; j--) {
                const t2 = textoParrafo(parrafos[j]).trim();
                if (!t2) continue;
                const nombre = nombrePorEtiqueta(t2);
                return nombre !== null ? { texto: t2, nombre } : null;
            }
            return null;
        };
        // Misma búsqueda de arriba, pero para el caso de VARIOS "NOMBRE"
        // en la misma línea (p.ej. F-07-04: "NOMBRE" / "NOMBRE" con
        // "Representante Técnico" / "Cliente" debajo, cada etiqueta bajo
        // su propio NOMBRE) — busca un párrafo cercano cuyo número de
        // grupos de etiquetas coincida con el número de "NOMBRE" pedidos.
        const buscarEtiquetasMultiplesCercanas = (i, cantidad) => {
            for (let j = i + 1; j <= i + VENTANA && j < parrafos.length; j++) {
                const grupos = agruparEnEtiquetas(parrafos[j]);
                if (!grupos.length) continue;
                if (grupos.length === cantidad) return grupos;
                return null;
            }
            for (let j = i - 1; j >= i - VENTANA && j >= 0; j--) {
                const grupos = agruparEnEtiquetas(parrafos[j]);
                if (!grupos.length) continue;
                if (grupos.length === cantidad) return grupos;
                return null;
            }
            return null;
        };
        parrafos.forEach((p, i) => {
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            const runsNombre = runs.filter(r => esResaltadoAmarillo(r) && norm(textoDeRun(r)) === 'nombre');

            // Caso: varios "NOMBRE" resaltados en el mismo párrafo (en
            // vez de un párrafo dedicado solo a decir "NOMBRE"). Cada uno
            // se resuelve por separado, según la etiqueta que le
            // corresponda por posición.
            if (runsNombre.length > 1) {
                const etiquetas = buscarEtiquetasMultiplesCercanas(i, runsNombre.length);
                if (!etiquetas) return;
                // A diferencia del caso de un solo "NOMBRE" (que ocupa su
                // propio párrafo dedicado y se beneficia de forzar el
                // centrado), aquí varios "NOMBRE" comparten la misma
                // línea, cada uno ya posicionado con espacios para caer
                // justo arriba de su propio puesto — centrar el párrafo
                // completo como un solo bloque los desalinea a todos de
                // su renglón correspondiente. Se deja la alineación
                // original del machote intacta.
                runsNombre.forEach((run, k) => {
                    const etiqueta = etiquetas[k];
                    const nombre = nombrePorEtiqueta(etiqueta.texto);
                    // El espaciado entre dos "NOMBRE" en la misma línea a
                    // veces vive en un run separado (F-10_1-02), pero en
                    // otros machotes (F-10_1-01) va pegado como espacios
                    // finales DENTRO del mismo run que dice "NOMBRE" — si
                    // se reemplaza todo el texto del run sin más, ese
                    // espaciado se pierde y el nombre queda pegado al
                    // siguiente. Se conserva cualquier texto que venga
                    // después de "NOMBRE" en el mismo run (normalmente
                    // solo espacios) al armar el reemplazo.
                    const textoOriginalRun = textoDeRun(run);
                    const sufijo = textoOriginalRun.replace(/^\s*NOMBRE/i, '');
                    // El nombre real casi siempre es más largo que la
                    // palabra "NOMBRE" (6 letras) que sustituye — si se
                    // conserva el espaciado ORIGINAL completo, la línea
                    // combinada crece y el siguiente nombre se recorre
                    // más allá del margen de la página, envolviéndose a
                    // la línea de abajo (se ve como si "se juntaran" o
                    // "el nombre saliera en otro lado"). Se recorta el
                    // espaciado por la diferencia de tamaño, para que el
                    // siguiente nombre arranque aproximadamente en la
                    // misma posición que tenía previsto el machote.
                    // El exceso se calcula sobre TODOS los nombres de la
                    // línea (no solo el actual), porque el ancho total
                    // de la línea depende de la suma de todos — un solo
                    // nombre largo en cualquier posición puede hacer que
                    // toda la línea se desborde.
                    const excesoTotal = runsNombre.reduce((acc, r, idx) => {
                        const n = nombrePorEtiqueta(etiquetas[idx].texto);
                        return acc + (n ? Math.max(0, n.length - 6) : 0);
                    }, 0);
                    const exceso = excesoTotal;
                    const sufijoAjustado = exceso > 0 ? sufijo.replace(/ {1,}/, m => ' '.repeat(Math.max(1, m.length - exceso))) : sufijo;
                    // Algunos machotes (F-10_1-02) además tienen runs de
                    // espacio SEPARADOS entre los dos "NOMBRE" (no
                    // pegados al primero) — también se recortan por la
                    // misma diferencia de tamaño, repartiendo el recorte
                    // entre todos los que haya antes del siguiente NOMBRE.
                    if (exceso > 0) {
                        const idxEnRuns = runs.indexOf(run);
                        const idxSiguienteNombre = runsNombre[k + 1] ? runs.indexOf(runsNombre[k + 1]) : runs.length;
                        let restante = exceso;
                        for (let m = idxEnRuns + 1; m < idxSiguienteNombre && restante > 0; m++) {
                            const rIntermedio = runs[m];
                            const tIntermedio = textoDeRun(rIntermedio);
                            if (tIntermedio.trim() !== '') continue; // no es un run puramente de espacios
                            const recorte = Math.min(restante, Math.max(0, tIntermedio.length - 1));
                            if (recorte > 0) {
                                setTextoRun(rIntermedio, ' '.repeat(tIntermedio.length - recorte));
                                restante -= recorte;
                            }
                        }
                    }
                    if (nombre) {
                        setTextoRun(run, nombre + sufijoAjustado);
                        quitarResaltado(run);
                        stats.reemplazos++;
                    } else if (nombre === null) {
                        // Etiqueta no reconocida (p.ej. "Cliente", una
                        // persona externa sin dato capturado) — se deja
                        // en blanco, sin resaltado, para llenarse a mano.
                        setTextoRun(run, sufijo);
                        quitarResaltado(run);
                    } else {
                        quitarResaltado(run);
                        stats.pendientes.push(`Nombre de ${etiqueta.texto} (sin dato capturado)`);
                    }
                });
                return;
            }

            const texto = textoParrafo(p).trim();
            if (norm(texto) !== 'nombre') return;
            if (!runs.some(esResaltadoAmarillo)) return;
            const encontrado = buscarEtiquetaCercana(i);
            if (!encontrado) return; // no es un bloque de firma por puesto conocido; se deja tal cual
            if (encontrado.nombre) {
                reemplazarTextoParrafo(p, encontrado.nombre);
                normalizarCentradoParrafo(p);
                stats.reemplazos++;
            } else {
                runs.forEach(quitarResaltado);
                stats.pendientes.push(`Nombre de ${encontrado.texto} (sin dato capturado)`);
            }
        });
    }

    // ── SGM: puestos responsables de procesos específicos (multi-select) ──
    function procesarFrasesMultiPuestoSGM(xmlDoc, datos, stats) {
        if (!datos.MULTIPUESTO && !datos.MULTIPUESTO_EXTRA) return;
        datos.MULTIPUESTO = datos.MULTIPUESTO || {};
        const roles = SGM_ROLES_DISPONIBLES;

        const construirTexto = (frase) => {
            const clavesElegidas = datos.MULTIPUESTO[frase.id];
            // Cada puesto elegido se muestra como "Rol Nombre" (el título
            // del puesto seguido del nombre real de quien lo ocupa según
            // el organigrama) — aplica a cualquier rol que el cliente
            // elija aquí, no solo Administrativo, y si no eligió ninguno
            // se deja en blanco (mismo comportamiento de antes).
            const etiquetas = (clavesElegidas || []).map(c => {
                const rol = roles.find(r => r.clave === c);
                if (!rol) return null;
                if (frase.soloRol) return rol.etiqueta;
                const nombre = datos[c];
                return nombre ? `${rol.etiqueta} ${nombre}` : rol.etiqueta;
            }).filter(Boolean);
            // Puesto o rol adicional escrito a mano por el cliente (no
            // forma parte del catálogo fijo de 8 roles) — se agrega al
            // final de la lista, tal cual lo escribió.
            const extra = (datos.MULTIPUESTO_EXTRA || {})[frase.id];
            if (extra) etiquetas.push(extra);
            const textoNuevo = etiquetas.length > 1
                ? etiquetas.slice(0, -1).join(', ') + ' y ' + etiquetas[etiquetas.length - 1]
                : (etiquetas[0] || '');
            return { etiquetas, textoNuevo };
        };

        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const texto = textoParrafo(p);
            const fraseGeneral = SGM_FRASES_MULTIPUESTO.find(f => f.match.test(texto));
            if (!fraseGeneral) continue;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));

            // Un mismo párrafo puede contener más de una frase multi-puesto
            // (p.ej. PROC-G-003 junta "registros de gestión" y "registros
            // técnicos" en una sola oración seguida) — antes se tomaba solo
            // la PRIMERA frase que calzara con el texto COMPLETO del
            // párrafo y esa misma selección se aplicaba a TODOS los
            // placeholders del párrafo por igual, así que el segundo
            // terminaba mostrando el puesto del primero. Ahora se
            // determina la frase correcta para cada grupo de resaltado
            // según el texto acumulado justo antes de ese grupo.
            let huboResaltado = false;
            let acumulado = '';
            let i = 0;
            while (i < runs.length) {
                if (!esResaltadoAmarillo(runs[i])) { acumulado += textoDeRun(runs[i]); i++; continue; }
                huboResaltado = true;
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                const grupo = runs.slice(i, j);

                // La frase debe coincidir justo AL FINAL del texto
                // acumulado (inmediatamente antes de este placeholder), no
                // en cualquier parte — si solo se revisara ".test(acumulado)"
                // sin anclar al final, la PRIMERA frase de la lista que
                // alguna vez apareciera en el texto (aunque fuera de una
                // oración anterior ya resuelta) seguiría "ganando" para
                // todos los placeholders siguientes del mismo párrafo.
                const fraseLocal = SGM_FRASES_MULTIPUESTO.find(f => new RegExp(f.match.source + '\\s*$', f.match.flags).test(acumulado));
                if (!fraseLocal) {
                    // Ninguna frase conocida coincide justo antes de este
                    // placeholder específico — puede ser una mención
                    // totalmente distinta dentro del mismo párrafo (p.ej.
                    // "vía Administrativo o quien éste designe" junto a
                    // "...es decir, Mantenimiento y Despachadores" en
                    // PROC-T-001). Antes se usaba fraseGeneral como
                    // respaldo ciego, lo que aplicaba la frase equivocada a
                    // placeholders no relacionados; ahora se deja intacto
                    // para que el motor genérico (valorNuevoPara) lo
                    // resuelva por su cuenta.
                    acumulado += grupo.map(textoDeRun).join('');
                    i = j;
                    continue;
                }
                const { etiquetas, textoNuevo } = construirTexto(fraseLocal);
                if (etiquetas.length) {
                    setTextoRun(grupo[0], textoNuevo);
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    stats.reemplazos++;
                    acumulado += textoNuevo;
                } else {
                    // Sin puesto seleccionado: se deja en blanco (no el
                    // texto de referencia original del machote).
                    setTextoRun(grupo[0], '');
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    stats.pendientes.push(`Puesto(s) responsable(s) sin capturar: ${fraseLocal.etiqueta}`);
                }
                grupo.forEach(quitarResaltado);
                i = j;
            }
            // Respaldo: si el párrafo coincidió con la frase pero no tenía
            // ningún resaltado amarillo (el placeholder solo viene en
            // negritas, como "Mantenimiento" en PROC-T-005), se busca el
            // run en negritas cuyo texto sea exactamente el nombre de algún
            // puesto conocido y se reemplaza igual. Este respaldo asume un
            // solo puesto por párrafo (usa fraseGeneral), como ya era antes.
            if (!huboResaltado) {
                const { etiquetas, textoNuevo } = construirTexto(fraseGeneral);
                if (etiquetas.length) {
                    const normRol = t => (t || '').trim().toLowerCase().replace(/\.$/, '');
                    for (const r of runs) {
                        if (!esNegrita(r)) continue;
                        const textoRun = textoDeRun(r);
                        const esNombreDeAlgunPuesto = roles.some(rol => normRol(textoRun) === normRol(rol.etiqueta));
                        if (!esNombreDeAlgunPuesto) continue;
                        const conPunto = /\.\s*$/.test(textoRun.trim());
                        setTextoRun(r, textoNuevo + (conPunto ? '.' : ''));
                        stats.reemplazos++;
                    }
                }
            }
        }
    }

    // ── SGM: puesto inmediato después de Alta Dirección ──
    // En varios documentos SGM (PROC-G-007, PROC-G-008, PROC-T-002, etc.) el
    // cuerpo del texto hace referencia fija a "Administrativo" en negritas,
    // pero en realidad debe ser el puesto que reporta inmediatamente después
    // de Alta Dirección en el organigrama real del cliente (no siempre es
    // literalmente "Administrativo" — depende de qué puestos haya marcado el
    // cliente). Este reemplazo corre en TODOS los documentos SGM como
    // respaldo universal; las 8 frases de "Puestos responsables de procesos
    // específicos" tienen prioridad cuando el cliente eligió algo puntual
    // para esa oración en particular (procesarFrasesMultiPuestoSGM corre
    // primero y ya deja resuelto lo que le corresponde).
    function rolInmediatoDespuesDeAltaDireccion(datos) {
        const jerarquia = SGM_JERARQUIA_ORGANIGRAMA;
        for (let i = 1; i < jerarquia.length; i++) {
            for (const clave of jerarquia[i]) {
                if (datos[clave]) {
                    const rol = SGM_ROLES_DISPONIBLES.find(r => r.clave === clave);
                    if (rol) return rol;
                }
            }
        }
        return SGM_ROLES_DISPONIBLES.find(r => r.clave === 'ROL_ADMINISTRATIVO') || null;
    }

    const RE_ARCHIVO_INMEDIATO_SIGUIENTE_SGM = /^PROC-G-007/i;

    function procesarInmediatoSiguienteSGM(xmlDoc, datos, nombreArchivo, stats) {
        const rolInmediato = rolInmediatoDespuesDeAltaDireccion(datos);
        if (!rolInmediato) return null;
        const norm = t => (t || '').trim().toLowerCase().replace(/\.$/, '');
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            for (const r of Array.from(p.getElementsByTagNameNS(NS_W, 'r'))) {
                if (!esNegrita(r)) continue;
                const texto = textoDeRun(r);
                if (norm(texto) !== 'administrativo') continue;
                const conPunto = /\.\s*$/.test(texto.trim());
                setTextoRun(r, rolInmediato.etiqueta + (conPunto ? '.' : ''));
                quitarResaltado(r);
                stats.reemplazos++;
            }
        }
        return rolInmediato;
    }

    // ── SGM: cláusula "Organización: se refiere a la organización [nombre]"
    // ── Esta oración de "2.2 Notaciones" está copiada de forma prácticamente
    // idéntica en todos los documentos SGM (G-001 a G-008, T-002 a T-006).
    // El nombre de referencia a veces no queda catalogado por coincidencia
    // exacta en SGM_MAPEO (el resaltado del machote puede venir cortado en
    // runs no contiguos), así que aquí se resuelve de forma robusta: se
    // ubica el punto del párrafo donde termina la frase fija y se sustituye
    // todo lo que sigue (el nombre) por la Razón Social capturada,
    // respetando mayúsculas si el original estaba en mayúsculas.
    const RE_FRASE_ORGANIZACION_SGM = /se\s+refiere\s+a\s+la\s+organizaci[oó]n\s*$/i;

    function procesarNotacionOrganizacionSGM(xmlDoc, datos, stats) {
        if (!datos.NOMBRE_REPRESENTANTE) return;
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            if (!runs.length) continue;
            let acumulado = '';
            let idxInicio = -1;
            for (let i = 0; i < runs.length; i++) {
                acumulado += textoDeRun(runs[i]);
                if (RE_FRASE_ORGANIZACION_SGM.test(acumulado)) { idxInicio = i + 1; break; }
            }
            if (idxInicio === -1 || idxInicio >= runs.length) continue;
            const grupo = runs.slice(idxInicio);
            const textoOriginal = grupo.map(textoDeRun).join('');
            if (!textoOriginal.trim()) continue;
            // El primer run del grupo puede traer un espacio pegado antes
            // del nombre (p.ej. " A LA GAS..."); se conserva ese espacio en
            // vez de perderlo, para no dejar "organizaciónA LA GAS" junto.
            const espacioInicial = /^\s+/.exec(textoOriginal);
            const textoSinEspacio = textoOriginal.replace(/^\s+/, '');
            const esMayusculas = textoSinEspacio === textoSinEspacio.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(textoSinEspacio);
            const terminaConPunto = /\.\s*$/.test(textoSinEspacio);
            let nuevoNombre = esMayusculas ? datos.NOMBRE_REPRESENTANTE.toUpperCase() : datos.NOMBRE_REPRESENTANTE;
            if (terminaConPunto && !/\.\s*$/.test(nuevoNombre)) nuevoNombre += '.';
            if (espacioInicial) nuevoNombre = espacioInicial[0] + nuevoNombre;
            setTextoRun(grupo[0], nuevoNombre);
            for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
            grupo.forEach(quitarResaltado);
            stats.reemplazos++;
        }
    }

    // "Localización del documento: Estación de servicio." — en la mayoría
    // de los machotes SGM esta frase vive en una tabla de 2 columnas
    // (etiqueta | valor). A petición del cliente, este campo SIEMPRE debe
    // decir el texto genérico "Estación de servicio", sin importar la
    // razón social de cada cliente — es un descriptor de categoría, no
    // un dato personalizable. Se ubica por estructura (celda siguiente en
    // la misma fila de tabla) para asegurar el texto correcto incluso si
    // algún machote llegó con una variante distinta ya escrita ahí.
    function procesarLocalizacionDocumentoSGM(xmlDoc, datos, stats) {
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            if (!runs.length) continue;
            const textoParrafo = runs.map(textoDeRun).join('');
            if (!textoParrafo.includes('Localización del documento')) continue;

            let celda = p.parentNode;
            while (celda && celda.localName !== 'tc') celda = celda.parentNode;
            if (!celda) continue;
            let fila = celda.parentNode;
            while (fila && fila.localName !== 'tr') fila = fila.parentNode;
            if (!fila) continue;

            const celdas = Array.from(fila.getElementsByTagNameNS(NS_W, 'tc'));
            const idx = celdas.indexOf(celda);
            const celdaValor = celdas[idx + 1];
            if (!celdaValor) continue;

            const runsValor = Array.from(celdaValor.getElementsByTagNameNS(NS_W, 'r'));
            if (!runsValor.length) continue;
            const textoOriginal = runsValor.map(textoDeRun).join('');
            if (!textoOriginal.trim()) continue;

            const terminaConPunto = /\.\s*$/.test(textoOriginal);
            let nuevoValor = 'Estación de servicio';
            if (terminaConPunto) nuevoValor += '.';

            setTextoRun(runsValor[0], nuevoValor);
            for (let k = 1; k < runsValor.length; k++) setTextoRun(runsValor[k], '');
            runsValor.forEach(quitarResaltado);
            stats.reemplazos++;
            // Solo se llena la PRIMERA ocurrencia — es la tabla real de
            // "Documento Controlado". Si el documento menciona
            // "Localización del documento" de nuevo más adelante como
            // ejemplo ilustrativo (ver PROC-G-002 4.3), no debe tocarse.
            break;
        }
    }

    // "Atentamente" — el nombre que sigue debajo (p.ej. en FOR-T-005
    // "Nombramiento") viene con el mismo texto de referencia genérico
    // ("Félix Ruiz González") que en el resto del sistema mapea a la
    // Razón Social — pero aquí, en un nombramiento firmado, debe ser el
    // nombre de quien ocupa Alta Dirección, no la razón social. Se
    // ubica por estructura (párrafo siguiente a "Atentamente") en vez de
    // por el texto genérico del mapeo, para no afectar el resto de usos
    // de ese mismo texto de referencia en otros documentos.
    function procesarFirmaAtentamenteSGM(xmlDoc, datos, stats) {
        const nombreAltaDireccion = datos.ROL_ALTA_DIRECCION;
        if (!nombreAltaDireccion) return;
        const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
        for (let i = 0; i < parrafos.length; i++) {
            if (textoParrafo(parrafos[i]).trim() !== 'Atentamente') continue;
            const siguiente = parrafos[i + 1];
            if (!siguiente) continue;
            const runs = Array.from(siguiente.getElementsByTagNameNS(NS_W, 'r'));
            if (!runs.length) continue;
            const textoOriginal = runs.map(textoDeRun).join('');
            if (!textoOriginal.trim()) continue;
            setTextoRun(runs[0], nombreAltaDireccion);
            for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
            runs.forEach(quitarResaltado);
            stats.reemplazos++;
        }
    }

    // PROC-G-001, 4.2 "Realización de la revisión por la dirección" — a
    // diferencia de 1.1, 1.2 y 4.3 del mismo documento (donde "alta
    // dirección" sí debe convertirse al nombre de la persona), aquí debe
    // quedarse como el título del puesto. Se ubica este párrafo por su
    // texto distintivo y se le quita el resaltado a sus menciones de rol
    // para que el motor genérico no las convierta a nombre.
    // PROC-G-001 — puntos donde "alta dirección" debe quedarse como el
    // título del puesto (no convertirse al nombre de la persona), a
    // diferencia de 1.1, 1.2 y otros puntos del mismo documento donde sí
    // debe ser el nombre. Cada párrafo se ubica por su texto distintivo.
    // Menciones de "Alta Dirección" que deben quedarse como título del
    // puesto (no convertirse al nombre de la persona) — cada una se
    // ubica por su texto distintivo, sin importar en qué documento SGM
    // aparezca (el mismo criterio ya usado para 4.2/4.3 de PROC-G-001).
    // Retro de Glen (sesión de limpieza):
    //   - PROC-G-001, 1.1 (Objetivo) y 1.2 (Alcance): antes se dejaban
    //     sin proteger a propósito (se asumía que ahí sí debía ir el
    //     nombre) — corregido: también deben quedarse como puesto.
    //   - PROC-G-002, 4.2 (Disponibilidad de documentos): "Alta
    //     Dirección se asegura:" tampoco estaba protegido en ningún
    //     documento distinto a PROC-G-001, así que aquí se convertía al
    //     nombre por error.
    function procesarRevisionPorDireccionSGM(xmlDoc) {
        const TEXTOS_DISTINTIVOS = [
            'reunión en la que participa',      // PROC-G-001, 4.2 Realización de la revisión por la dirección
            'tiene la responsabilidad de asegurarse', // PROC-G-001, 4.3 Registros de hallazgos de la revisión por la dirección
            'planear y conducir las revisiones', // PROC-G-001, 1.1 Objetivo
            'con respecto al Sistema de Gestión de Mediciones', // PROC-G-001, 1.2 Alcance
            'Alta Dirección se asegura:',        // PROC-G-002, 4.2 Disponibilidad de documentos
        ];
        const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
        for (const p of parrafos) {
            const texto = textoParrafo(p);
            if (!TEXTOS_DISTINTIVOS.some(t => texto.includes(t))) continue;
            Array.from(p.getElementsByTagNameNS(NS_W, 'r'))
                .filter(esResaltadoAmarillo)
                .forEach(quitarResaltado);
        }
    }

    // Artículos sueltos antes de una mención de rol ("la alta dirección",
    // "el representante técnico") — cuando el motor genérico convierta el
    // rol resaltado al nombre real de la persona, ese artículo suelto
    // (que casi siempre vive en el run ANTERIOR, sin resaltar, por eso el
    // motor genérico nunca lo toca) se queda pegado y se lee mal ("La
    // Yamile Corral Lozano tiene la responsabilidad..."). Se ubica el run
    // resaltado que coincide con un rol conocido, se revisa si el run
    // inmediatamente anterior en el MISMO párrafo termina en un artículo
    // suelto ("la ", "el ", "los ", "las "), y si el rol sí tiene nombre
    // asignado (o sea, si SÍ se va a convertir a nombre), se quita esa
    // porción del artículo para que el resultado final se lea natural.
    // Se ejecuta ANTES del motor genérico, y respeta los casos donde ya
    // se decidió dejar el rol como puesto (esos runs ya perdieron su
    // resaltado antes de llegar aquí, así que este ajuste no los toca).
    function limpiarArticulosAntesDeRolSGM(xmlDoc, datos) {
        const RE_ARTICULO_FINAL = /\b(la|el|los|las)\s+$/i;
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            for (let i = 1; i < runs.length; i++) {
                if (!esResaltadoAmarillo(runs[i])) continue;
                const texto = textoDeRun(runs[i]).trim();
                const rol = SGM_ROLES_DISPONIBLES.find(r => r.etiqueta.toLowerCase() === texto.toLowerCase());
                if (!rol || !datos[rol.clave]) continue;
                const anterior = runs[i - 1];
                if (esResaltadoAmarillo(anterior)) continue; // es parte del mismo placeholder, no un artículo suelto
                const textoAnterior = textoDeRun(anterior);
                const m = RE_ARTICULO_FINAL.exec(textoAnterior);
                if (!m) continue;
                setTextoRun(anterior, textoAnterior.slice(0, m.index));
            }
        }
    }

    // "N. RESPONSABILIDADES" — los subtítulos "N.M Rol." se comportan
    // igual que antes (se muestran solo si el rol tiene nombre asignado,
    // se eliminan si no), PERO ahora además el título se reemplaza por
    // el nombre real de la persona en vez del nombre del rol. A
    // diferencia de una versión anterior de esta función, aquí NO se
    // agregan subsecciones nuevas para roles que no tenían una plantilla
    // propia en el documento (p.ej. "Alta Dirección" no aparece si el
    // machote nunca trajo esa subsección) — se respeta el conjunto de
    // roles original del documento, solo renombrado y filtrado.
    //
    // Se ejecuta ANTES de filtrarListasDeRolesSGM a propósito: una vez
    // que los encabezados dicen el nombre de la persona (no el rol),
    // filtrarListasDeRolesSGM ya no los reconoce como "N.M Rol." y los
    // deja intactos, sin necesidad de excluir nada explícitamente.
    function reconstruirResponsabilidadesSGM(xmlDoc, datos, stats) {
        const RE_TITULO_RESPONSABILIDADES = /^(\d+)\.\s*RESPONSABILIDADES\.?\s*$/i;
        const RE_SUBSECCION = /^(\d+)\.(\d+)\s+([^.]+?)\.?\s*$/;
        const RE_SECCION_TOP = /^\d+\.\s*[A-ZÁÉÍÓÚÑ]/;
        const normAcentos = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const rolPorEtiqueta = etiqueta => SGM_ROLES_DISPONIBLES.find(r => normAcentos(r.etiqueta) === normAcentos(etiqueta));

        const renombrarEncabezado = (runs, numeroNuevo, nombre) => {
            if (!runs.length) return;
            setTextoRun(runs[0], `${numeroNuevo} ${nombre}.`);
            for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
            runs.forEach(quitarResaltado);
        };

        (function procesarCuerpo() {
            const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
            let idxHeading = -1, seccionNum = null;
            for (let i = 0; i < parrafos.length; i++) {
                // El mismo texto "N. RESPONSABILIDADES." también aparece
                // como fila del índice (dentro de una tabla); ese caso lo
                // procesa procesarIndice() más abajo. Aquí solo interesa
                // el encabezado real del cuerpo, cuyo párrafo NO vive
                // dentro de una celda de tabla.
                if (parrafos[i].parentNode && parrafos[i].parentNode.localName === 'tc') continue;
                const m = RE_TITULO_RESPONSABILIDADES.exec(textoParrafo(parrafos[i]).trim());
                if (m) { idxHeading = i; seccionNum = m[1]; break; }
            }
            if (idxHeading === -1) return;

            let idxFin = parrafos.length;
            for (let j = idxHeading + 1; j < parrafos.length; j++) {
                const t = textoParrafo(parrafos[j]).trim();
                if (RE_SUBSECCION.test(t)) continue;
                if (RE_SECCION_TOP.test(t)) { idxFin = j; break; }
            }

            const existentes = [];
            for (let j = idxHeading + 1; j < idxFin; j++) {
                const m = RE_SUBSECCION.exec(textoParrafo(parrafos[j]).trim());
                if (!m) continue;
                const rol = rolPorEtiqueta(m[3].trim());
                if (!rol) continue;
                existentes.push({ clave: rol.clave, idx: j });
            }
            if (!existentes.length) return;
            existentes.forEach((e, k) => { e.fin = (k + 1 < existentes.length) ? existentes[k + 1].idx : idxFin; });

            // Solo se conservan los roles que YA existían como subsección
            // en el documento, en el mismo orden en que aparecen — no se
            // inserta nada nuevo.
            const conservados = existentes.filter(e => !!datos[e.clave]);
            if (!conservados.length) return;

            const bloques = conservados.map((e, i) => {
                const numeroNuevo = `${seccionNum}.${i + 1}`;
                const headingNodo = parrafos[e.idx];
                const contenidoNodos = [];
                for (let j = e.idx + 1; j < e.fin; j++) contenidoNodos.push(parrafos[j]);
                renombrarEncabezado(Array.from(headingNodo.getElementsByTagNameNS(NS_W, 'r')), numeroNuevo, datos[e.clave]);
                return { headingNodo, contenidoNodos };
            });

            const padre = parrafos[idxHeading].parentNode;
            const referencia = idxFin < parrafos.length ? parrafos[idxFin] : null;
            existentes.forEach(e => {
                for (let j = e.idx; j < e.fin; j++) {
                    const p = parrafos[j];
                    if (p.parentNode) p.parentNode.removeChild(p);
                }
            });
            bloques.forEach(b => {
                padre.insertBefore(b.headingNodo, referencia);
                b.contenidoNodos.forEach(c => padre.insertBefore(c, referencia));
            });
            stats.reemplazos += bloques.length;
        })();

        (function procesarIndice() {
            for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
                const filas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'));
                let idxHeading = -1, seccionNum = null;
                for (let i = 0; i < filas.length; i++) {
                    const celdas = Array.from(filas[i].getElementsByTagNameNS(NS_W, 'tc'));
                    if (!celdas.length) continue;
                    const m = RE_TITULO_RESPONSABILIDADES.exec(textoDeCelda(celdas[0]).trim());
                    if (m) { idxHeading = i; seccionNum = m[1]; break; }
                }
                if (idxHeading === -1) continue;

                let idxFin = filas.length;
                for (let j = idxHeading + 1; j < filas.length; j++) {
                    const celdas = Array.from(filas[j].getElementsByTagNameNS(NS_W, 'tc'));
                    const t = celdas.length ? textoDeCelda(celdas[0]).trim() : '';
                    if (RE_SUBSECCION.test(t)) continue;
                    if (RE_SECCION_TOP.test(t)) { idxFin = j; break; }
                }

                const existentes = [];
                for (let j = idxHeading + 1; j < idxFin; j++) {
                    const celdas = Array.from(filas[j].getElementsByTagNameNS(NS_W, 'tc'));
                    if (!celdas.length) continue;
                    const m = RE_SUBSECCION.exec(textoDeCelda(celdas[0]).trim());
                    if (!m) continue;
                    const rol = rolPorEtiqueta(m[3].trim());
                    if (!rol) continue;
                    existentes.push({ clave: rol.clave, idx: j });
                }
                if (!existentes.length) continue;

                const conservados = existentes.filter(e => !!datos[e.clave]);
                if (!conservados.length) continue;

                const filasConservadas = conservados.map((e, i) => {
                    const numeroNuevo = `${seccionNum}.${i + 1}`;
                    const filaNodo = filas[e.idx];
                    const celdas = Array.from(filaNodo.getElementsByTagNameNS(NS_W, 'tc'));
                    if (celdas.length) renombrarEncabezado(Array.from(celdas[0].getElementsByTagNameNS(NS_W, 'r')), numeroNuevo, datos[e.clave]);
                    return filaNodo;
                });

                const padre = filas[idxHeading].parentNode;
                const referencia = idxFin < filas.length ? filas[idxFin] : null;
                existentes.forEach(e => {
                    const f = filas[e.idx];
                    if (f.parentNode) f.parentNode.removeChild(f);
                });
                filasConservadas.forEach(f => padre.insertBefore(f, referencia));
            }
        })();
    }


    function filtrarListasDeRolesSGM(xmlDoc, datos, nombreArchivo) {
        // PROC-T-001: el índice debe listar TODOS los puestos siempre,
        // sin filtrar por los que el cliente marcó en el organigrama.
        if (RE_INDICE_TODOS_LOS_PUESTOS_SGM.test(nombreArchivo || '')) return;

        const normAcentos = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const etiquetas = SGM_ROLES_DISPONIBLES.map(r => r.etiqueta);

        // PROC-G-007: en el apartado de responsabilidades del índice,
        // "Alta Dirección" y el puesto inmediato siguiente en el
        // organigrama del cliente deben aparecer siempre, sin importar si
        // ese puesto quedó marcado o no en el checklist general.
        const siempreVisibles = new Set([normAcentos('Alta Dirección')]);
        if (RE_ARCHIVO_INMEDIATO_SIGUIENTE_SGM.test(nombreArchivo || '')) {
            const rolInmediato = rolInmediatoDespuesDeAltaDireccion(datos);
            if (rolInmediato) siempreVisibles.add(normAcentos(rolInmediato.etiqueta));
        }

        // Un puesto cuenta como "capturado" si tiene nombre asignado en el
        // organigrama principal, O si el cliente lo eligió en cualquiera de
        // las frases de "Puestos responsables de procesos específicos" —
        // antes solo se revisaba lo primero, así que un puesto elegido
        // únicamente ahí (sin nombre en el organigrama) desaparecía del
        // índice aunque sí estuviera "capturado" en ese sentido.
        const rolFueElegidoEnAlgunaFrase = clave => {
            if (!datos.MULTIPUESTO) return false;
            return Object.values(datos.MULTIPUESTO).some(claves => Array.isArray(claves) && claves.includes(clave));
        };
        const estaCapturado = etiqueta => {
            if (siempreVisibles.has(normAcentos(etiqueta))) return true;
            const rol = SGM_ROLES_DISPONIBLES.find(r => normAcentos(r.etiqueta) === normAcentos(etiqueta));
            if (!rol) return true;
            return !!datos[rol.clave] || rolFueElegidoEnAlgunaFrase(rol.clave);
        };
        const esRolConocido = etiqueta => etiquetas.some(e => normAcentos(e) === normAcentos(etiqueta));

        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            for (const fila of Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'))) {
                const celdas = Array.from(fila.getElementsByTagNameNS(NS_W, 'tc'));
                if (!celdas.length) continue;
                const texto = textoDeCelda(celdas[0]).trim();
                const m = /^\d+\.\d+\s+([^.]+?)\.?\s*$/.exec(texto);
                if (!m || !esRolConocido(m[1].trim())) continue;
                if (estaCapturado(m[1].trim())) {
                    celdas.forEach(c => Array.from(c.getElementsByTagNameNS(NS_W, 'r')).forEach(quitarResaltado));
                } else if (fila.parentNode) {
                    fila.parentNode.removeChild(fila);
                }
            }
        }

        const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
        const titulos = [];
        parrafos.forEach((p, i) => {
            const texto = textoParrafo(p).trim();
            const m = /^(\d+)\.(\d+)\s+([^.]+?)\.?\s*$/.exec(texto);
            // Distinguir si este "N.M Rol." es una fila del ÍNDICE (dentro
            // de una celda de tabla) o del CUERPO (párrafo suelto). Antes
            // se mezclaban en la misma lista/agrupación, y el rango
            // calculado para un rol del índice podía terminar apuntando al
            // siguiente rol encontrado en el CUERPO —a veces cientos de
            // párrafos después—, arrastrando y despojando de resaltado
            // todo lo que había en medio (ver bug en PROC-G-002, sección
            // 4.2, corregido aquí).
            const esIndice = p.parentNode && p.parentNode.localName === 'tc';
            if (m && esRolConocido(m[3].trim())) titulos.push({ idx: i, seccion: m[1], rol: m[3].trim(), esIndice });
        });
        if (!titulos.length) return;

        const finDeSeccion = (desde, seccion) => {
            for (let j = desde + 1; j < parrafos.length; j++) {
                const t = textoParrafo(parrafos[j]).trim();
                if (/^\d+\.\d+\s+[^.]+\.?\s*$/.test(t)) continue;
                if (/^\d+\.\s*[A-ZÁÉÍÓÚÑ]/.test(t)) return j;
            }
            return parrafos.length;
        };

        const porSeccion = {};
        titulos.forEach(t => { const clave = t.seccion + (t.esIndice ? '-indice' : '-cuerpo'); (porSeccion[clave] = porSeccion[clave] || []).push(t); });

        const paraEliminar = new Set();
        for (const grupo of Object.values(porSeccion)) {
            for (let k = 0; k < grupo.length; k++) {
                const item = grupo[k];
                const idxFin = (k + 1 < grupo.length) ? grupo[k + 1].idx : finDeSeccion(item.idx, item.seccion);
                if (estaCapturado(item.rol)) {
                    for (let j = item.idx; j < idxFin; j++) {
                        Array.from(parrafos[j].getElementsByTagNameNS(NS_W, 'r')).forEach(quitarResaltado);
                    }
                } else {
                    for (let j = item.idx; j < idxFin; j++) paraEliminar.add(parrafos[j]);
                }
            }
        }
        paraEliminar.forEach(p => p.parentNode && p.parentNode.removeChild(p));
    }

    // Roles personalizados (ROLES_EXTRA) en la sección "N. RESPONSABILIDADES":
    // los roles fijos del catálogo (Alta Dirección, Administrativo, etc.)
    // se siguen mostrando/ocultando exactamente igual que hace
    // filtrarListasDeRolesSGM de arriba — comportamiento sin cambios.
    // Esta función SOLO agrega, al final de la sección, una subsección
    // nueva por cada rol personalizado que el cliente haya creado en el
    // organigrama (ej. "Alta administrativa"), usando la etiqueta del
    // rol como título (igual que los roles fijos, sin poner el nombre de
    // la persona) y el texto genérico de responsabilidad.
    function agregarRolesExtraResponsabilidadesSGM(xmlDoc, datos, stats) {
        const normAcentos = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const extras = Array.isArray(datos.ROLES_EXTRA) ? datos.ROLES_EXTRA.filter(e => e.etiqueta && e.nombre) : [];

        const RE_TITULO_RESPONSABILIDADES = /^(\d+)\.\s*RESPONSABILIDADES\.?\s*$/i;
        const RE_SUBSECCION = /^(\d+)\.(\d+)\s+([^.]+?)\.?\s*$/;
        const RE_SECCION_TOP = /^\d+\.\s*[A-ZÁÉÍÓÚÑ]/;
        const TEXTO_GENERICO = 'Aplicar el presente documento en su ámbito de responsabilidad.';

        // Orden final: primero los roles fijos del catálogo que tengan
        // nombre, respetando el orden JERÁRQUICO de SGM_ROLES_DISPONIBLES
        // (Alta Dirección primero, etc.) — reutilizando su subsección si
        // ya existía en la plantilla, o creándola si no (p.ej. "Alta
        // Dirección" en documentos que nunca la tuvieron). Al final, los
        // roles personalizados (ROLES_EXTRA) en el orden en que el
        // cliente los agregó. Todo se renumera de corrido (8.1, 8.2...).
        (function cuerpo() {
            const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
            let idxHeading = -1, seccionNum = null;
            for (let i = 0; i < parrafos.length; i++) {
                if (parrafos[i].parentNode && parrafos[i].parentNode.localName === 'tc') continue;
                const m = RE_TITULO_RESPONSABILIDADES.exec(textoParrafo(parrafos[i]).trim());
                if (m) { idxHeading = i; seccionNum = m[1]; break; }
            }
            if (idxHeading === -1) return;

            let idxFin = parrafos.length;
            const existentes = []; // { headingNodo, contenidoNodos, etiqueta }
            for (let j = idxHeading + 1; j < parrafos.length; j++) {
                const t = textoParrafo(parrafos[j]).trim();
                const mSub = RE_SUBSECCION.exec(t);
                if (mSub) {
                    const contenidoNodos = [];
                    for (let k = j + 1; k < parrafos.length; k++) {
                        const tk = textoParrafo(parrafos[k]).trim();
                        if (RE_SUBSECCION.test(tk) || RE_SECCION_TOP.test(tk)) break;
                        contenidoNodos.push(parrafos[k]);
                    }
                    existentes.push({ headingNodo: parrafos[j], contenidoNodos, etiqueta: mSub[3].trim() });
                    continue;
                }
                if (RE_SECCION_TOP.test(t)) { idxFin = j; break; }
            }
            if (!existentes.length) return;

            const porEtiqueta = {};
            existentes.forEach(e => { porEtiqueta[normAcentos(e.etiqueta)] = e; });
            const plantillaHeading = existentes[0].headingNodo;
            const plantillaContenido = existentes[0].contenidoNodos;

            // Orden final jerárquico: roles fijos con nombre (en orden de
            // SGM_ROLES_DISPONIBLES) + roles personalizados al final.
            const ordenFinal = [];
            SGM_ROLES_DISPONIBLES.forEach(rol => {
                if (!datos[rol.clave]) return;
                const existente = porEtiqueta[normAcentos(rol.etiqueta)];
                ordenFinal.push({ etiqueta: rol.etiqueta, existente: existente || null });
            });
            extras.forEach(extra => { ordenFinal.push({ etiqueta: extra.etiqueta, existente: null }); });
            if (!ordenFinal.length) return;

            const padre = parrafos[idxHeading].parentNode;
            const referencia = idxFin < parrafos.length ? parrafos[idxFin] : null;

            // Sacar TODAS las subsecciones existentes de su posición actual
            existentes.forEach(e => {
                if (e.headingNodo.parentNode) e.headingNodo.parentNode.removeChild(e.headingNodo);
                e.contenidoNodos.forEach(c => { if (c.parentNode) c.parentNode.removeChild(c); });
            });

            // Reinsertar en el orden final, renumerado de corrido
            ordenFinal.forEach((item, i) => {
                const numeroNuevo = `${seccionNum}.${i + 1}`;
                let headingNodo, contenidoNodos;
                if (item.existente) {
                    headingNodo = item.existente.headingNodo;
                    contenidoNodos = item.existente.contenidoNodos;
                } else {
                    headingNodo = plantillaHeading.cloneNode(true);
                    contenidoNodos = plantillaContenido.map(p => {
                        const clon = p.cloneNode(true);
                        const runs = Array.from(clon.getElementsByTagNameNS(NS_W, 'r'));
                        if (runs.length) {
                            setTextoRun(runs[0], TEXTO_GENERICO);
                            for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
                        }
                        return clon;
                    });
                    stats.reemplazos++;
                }
                const runsHeading = Array.from(headingNodo.getElementsByTagNameNS(NS_W, 'r'));
                if (runsHeading.length) {
                    setTextoRun(runsHeading[0], `${numeroNuevo} ${item.etiqueta}.`);
                    for (let k = 1; k < runsHeading.length; k++) setTextoRun(runsHeading[k], '');
                    runsHeading.forEach(quitarResaltado);
                }
                padre.insertBefore(headingNodo, referencia);
                contenidoNodos.forEach(c => padre.insertBefore(c, referencia));
            });
        })();

        (function indice() {
            for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
                const filas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tr'));
                let idxHeading = -1, seccionNum = null;
                for (let i = 0; i < filas.length; i++) {
                    const celdas = Array.from(filas[i].getElementsByTagNameNS(NS_W, 'tc'));
                    if (!celdas.length) continue;
                    const m = RE_TITULO_RESPONSABILIDADES.exec(textoDeCelda(celdas[0]).trim());
                    if (m) { idxHeading = i; seccionNum = m[1]; break; }
                }
                if (idxHeading === -1) continue;

                let idxFin = filas.length;
                const existentes = [];
                for (let j = idxHeading + 1; j < filas.length; j++) {
                    const celdas = Array.from(filas[j].getElementsByTagNameNS(NS_W, 'tc'));
                    const t = celdas.length ? textoDeCelda(celdas[0]).trim() : '';
                    const mSub = RE_SUBSECCION.exec(t);
                    if (mSub) {
                        existentes.push({ filaNodo: filas[j], celda0: celdas[0], etiqueta: mSub[3].trim() });
                        continue;
                    }
                    if (RE_SECCION_TOP.test(t)) { idxFin = j; break; }
                }
                if (!existentes.length) continue;

                const porEtiqueta = {};
                existentes.forEach(e => { porEtiqueta[normAcentos(e.etiqueta)] = e; });
                const filaPlantilla = existentes[0].filaNodo;

                const ordenFinal = [];
                SGM_ROLES_DISPONIBLES.forEach(rol => {
                    if (!datos[rol.clave]) return;
                    const existente = porEtiqueta[normAcentos(rol.etiqueta)];
                    ordenFinal.push({ etiqueta: rol.etiqueta, existente: existente || null });
                });
                extras.forEach(extra => { ordenFinal.push({ etiqueta: extra.etiqueta, existente: null }); });
                if (!ordenFinal.length) continue;

                const padre = filas[idxHeading].parentNode;
                const referencia = idxFin < filas.length ? filas[idxFin] : null;

                existentes.forEach(e => { if (e.filaNodo.parentNode) e.filaNodo.parentNode.removeChild(e.filaNodo); });

                ordenFinal.forEach((item, i) => {
                    const numeroNuevo = `${seccionNum}.${i + 1}`;
                    const filaNodo = item.existente ? item.existente.filaNodo : filaPlantilla.cloneNode(true);
                    const celdas = Array.from(filaNodo.getElementsByTagNameNS(NS_W, 'tc'));
                    if (celdas.length) {
                        const runs = Array.from(celdas[0].getElementsByTagNameNS(NS_W, 'r'));
                        if (runs.length) {
                            setTextoRun(runs[0], `${numeroNuevo} ${item.etiqueta}.`);
                            for (let k = 1; k < runs.length; k++) setTextoRun(runs[k], '');
                            runs.forEach(quitarResaltado);
                        }
                    }
                    padre.insertBefore(filaNodo, referencia);
                });
            }
        })();
    }

    function textoDeCelda(celda) {
        if (!celda) return '';
        return Array.from(celda.getElementsByTagNameNS(NS_W, 't')).map(t => t.textContent).join('');
    }

    function aplicarGradoEstudiosSGM(xmlDoc, datos) {
        if (!datos.GRADO_ESTUDIOS) return;
        const norm = t => (t || '').replace(/[.:]+\s*$/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const rolPorEtiqueta = etiqueta => (SGM_ROLES_DISPONIBLES.find(r => norm(r.etiqueta) === norm(etiqueta)) || {}).clave;

        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const celdas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tc'));
            if (celdas.length !== 1) continue;
            const celda = celdas[0];
            const textoTabla = textoDeCelda(celda);
            if (!textoTabla.includes('COMPETENCIA TÉCNICA') && !textoTabla.includes('COMPETENCIA TECNICA')) continue;

            const parrafos = Array.from(celda.children).filter(n => n.localName === 'p');
            let rolActual = null;
            let primerItemDeCadaRol = {};
            parrafos.forEach((p, i) => {
                const texto = textoParrafo(p).trim();
                if (!texto) return;
                const claveRol = rolPorEtiqueta(texto);
                if (claveRol) {
                    rolActual = claveRol;
                    // Estos encabezados de rol ("Alta Dirección",
                    // "Administrativo", etc.) son títulos de una tabla de
                    // requisitos POR PUESTO — deben quedarse como el
                    // nombre del rol, no convertirse al nombre de la
                    // persona. Se les quita el resaltado para que el
                    // motor genérico (que sí convierte menciones sueltas
                    // de roles a nombres en otros contextos) no los toque.
                    Array.from(p.getElementsByTagNameNS(NS_W, 'r')).forEach(quitarResaltado);
                    return;
                }
                if (rolActual && !(rolActual in primerItemDeCadaRol)) {
                    primerItemDeCadaRol[rolActual] = { idx: i, esEscolaridad: /^escolaridad\b/i.test(texto) };
                }
            });

            for (const [clave, grado] of Object.entries(datos.GRADO_ESTUDIOS)) {
                const info = primerItemDeCadaRol[clave];
                if (!info) continue;
                const plantilla = parrafos[info.idx];
                const textoNuevo = `Escolaridad: ${grado}.`;
                if (info.esEscolaridad) {
                    reemplazarTextoParrafo(plantilla, textoNuevo);
                } else {
                    const nuevo = plantilla.cloneNode(true);
                    reemplazarTextoParrafo(nuevo, textoNuevo);
                    plantilla.parentNode.insertBefore(nuevo, plantilla);
                }
            }
        }
    }

    function reemplazarTextoParrafo(p, textoNuevo) {
        const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
        runs.slice(1).forEach(r => r.parentNode.removeChild(r));
        if (runs[0]) {
            quitarResaltado(runs[0]);
            Array.from(runs[0].getElementsByTagNameNS(NS_W, 't')).forEach(t => t.parentNode.removeChild(t));
            const t = p.ownerDocument.createElementNS(NS_W, 'w:t');
            t.setAttribute('xml:space', 'preserve');
            t.textContent = textoNuevo;
            runs[0].appendChild(t);
        }
        const pPr = p.getElementsByTagNameNS(NS_W, 'pPr')[0];
        if (pPr) {
            const rPrMarca = pPr.getElementsByTagNameNS(NS_W, 'rPr')[0];
            const hl = rPrMarca ? rPrMarca.getElementsByTagNameNS(NS_W, 'highlight')[0] : null;
            if (hl) rPrMarca.removeChild(hl);
        }
    }

    // ── BITÁCORAS: reemplazo del encabezado por etiqueta / párrafo completo ──
    function reemplazarValorTrasEtiqueta(p, etiquetaRegex, valorNuevo) {
        const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
        let acumulado = '';
        let idxValorInicio = -1;
        for (let i = 0; i < runs.length; i++) {
            acumulado += textoDeRun(runs[i]);
            if (idxValorInicio === -1 && etiquetaRegex.test(acumulado)) { idxValorInicio = i + 1; break; }
        }
        if (idxValorInicio === -1 || idxValorInicio >= runs.length) return false;
        // El primer run después de la etiqueta absorbe el valor nuevo (aunque
        // originalmente fuera solo un salto de línea); el resto se vacía —
        // así no importa si el valor de referencia venía partido en varios
        // runs (p.ej. "Cuauhtémo" + "c").
        setTextoRun(runs[idxValorInicio], valorNuevo);
        for (let k = idxValorInicio + 1; k < runs.length; k++) setTextoRun(runs[k], '');
        return true;
    }

    function procesarCamposBitacoras(xmlDoc, datos, stats) {
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const texto = textoParrafo(p).trim();
            if (!texto) continue;

            // Razón social y PL: el párrafo completo ES el valor (sin
            // etiqueta), viven en su propia celda del encabezado.
            if (datos.RAZON_SOCIAL && texto.replace(/\.$/, '') === BITACORAS_VALOR_RAZON_SOCIAL_REF.replace(/\.$/, '')) {
                reemplazarTextoParrafo(p, datos.RAZON_SOCIAL);
                stats.reemplazos++;
                continue;
            }
            if (datos.NUMERO_PERMISO && BITACORAS_VALOR_PL_REF.test(texto)) {
                reemplazarTextoParrafo(p, datos.NUMERO_PERMISO);
                stats.reemplazos++;
                continue;
            }

            for (const campo of BITACORAS_CAMPOS_POR_ETIQUETA) {
                if (campo.etiqueta.test(texto) && datos[campo.clave] !== undefined) {
                    if (reemplazarValorTrasEtiqueta(p, campo.etiqueta, datos[campo.clave] || '')) stats.reemplazos++;
                    break;
                }
            }
        }
    }

    const CATS_CATALOGO = ['responsabilidades', 'funciones', 'autoridad', 'interrelaciones'];

    function reconstruirTarjetasPuestosSGM(xmlDoc, datos) {
        const norm = t => (t || '').replace(/[.:]+\s*$/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const rolPorEtiqueta = etiqueta => (SGM_ROLES_DISPONIBLES.find(r => norm(r.etiqueta) === norm(etiqueta)) || {}).clave;
        // Encabezado de tarjeta de puesto dentro del catálogo, p.ej.
        // "4.  Encargado de Proyecto:" — distinto del patrón "5.1 Alta
        // Dirección." que usa filtrarListasDeRolesSGM en el índice.
        const esEncabezadoRol = texto => {
            const t = texto.trim();
            const m = /^\d+\.\s*([^:]+):?\s*$/.exec(t);
            if (m) return rolPorEtiqueta(m[1].trim());
            return rolPorEtiqueta(t); // encabezado sin numeración ni dos puntos
        };

        for (const tbl of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'tbl'))) {
            const celdas = Array.from(tbl.getElementsByTagNameNS(NS_W, 'tc'));
            if (celdas.length !== 1) continue;
            const celda = celdas[0];
            const parrafos = Array.from(celda.children).filter(n => n.localName === 'p');
            if (!parrafos.length) continue;
            const totalChars = parrafos.reduce((acc, p) => acc + textoParrafo(p).length, 0);
            if (totalChars < UMBRAL_CHARS_TABLA_GENERICA) continue;

            // 1) Ubicar el tramo [inicio, fin) de cada tarjeta de puesto.
            const tramos = [];
            parrafos.forEach((p, i) => {
                const texto = textoParrafo(p).trim();
                if (!texto) return;
                const claveRol = esEncabezadoRol(texto);
                if (claveRol) tramos.push({ clave: claveRol, inicio: i });
            });
            if (!tramos.length) continue;
            tramos.forEach((t, k) => { t.fin = (k + 1 < tramos.length) ? tramos[k + 1].inicio : parrafos.length; });

            // 2) Los puestos que el cliente NO marcó/capturó pierden la
            // tarjeta completa (encabezado + Responsabilidades/Funciones/
            // Autoridad/Interrelaciones); antes se quedaba con el texto
            // genérico del machote aunque el puesto no existiera ahí.
            const paraEliminar = new Set();
            tramos.forEach(t => {
                if (!datos[t.clave]) {
                    for (let j = t.inicio; j < t.fin; j++) paraEliminar.add(parrafos[j]);
                }
            });
            paraEliminar.forEach(p => p.parentNode && p.parentNode.removeChild(p));
            if (!datos.CATALOGO_PUESTOS) continue;

            // 3) Para los puestos que sí quedaron, aplicar el catálogo
            // personalizado de responsabilidades/funciones/etc. si existe.
            let rolActual = null, catActual = null;
            const bloques = [];
            parrafos.forEach((p, i) => {
                if (paraEliminar.has(p)) return;
                const texto = textoParrafo(p).trim();
                if (!texto) return;
                const claveRol = esEncabezadoRol(texto);
                if (claveRol) { rolActual = claveRol; catActual = null; return; }
                const catMatch = CATS_CATALOGO.find(c => norm(c) === norm(texto));
                if (catMatch) { catActual = catMatch; bloques.push({ clave: rolActual, cat: catActual, items: [] }); return; }
                if (rolActual && catActual && bloques.length) bloques[bloques.length - 1].items.push(i);
            });

            for (const bloque of bloques) {
                const catalogoRol = datos.CATALOGO_PUESTOS[bloque.clave];
                if (!catalogoRol) continue;
                const itemsNuevos = (catalogoRol[bloque.cat] || []).filter(it => it.incluido !== false && (it.texto || '').trim());
                if (!bloque.items.length) continue;
                const plantilla = parrafos[bloque.items[0]];
                const nuevosNodos = itemsNuevos.map(it => {
                    const clon = plantilla.cloneNode(true);
                    const runs = Array.from(clon.getElementsByTagNameNS(NS_W, 'r'));
                    runs.slice(1).forEach(r => r.parentNode.removeChild(r));
                    if (runs[0]) {
                        quitarResaltado(runs[0]);
                        Array.from(runs[0].getElementsByTagNameNS(NS_W, 't')).forEach(t => t.parentNode.removeChild(t));
                        const t = clon.ownerDocument.createElementNS(NS_W, 'w:t');
                        t.setAttribute('xml:space', 'preserve');
                        t.textContent = it.texto.trim();
                        runs[0].appendChild(t);
                    }
                    const pPrClon = clon.getElementsByTagNameNS(NS_W, 'pPr')[0];
                    if (pPrClon) {
                        const rPrMarca = pPrClon.getElementsByTagNameNS(NS_W, 'rPr')[0];
                        const hl = rPrMarca ? rPrMarca.getElementsByTagNameNS(NS_W, 'highlight')[0] : null;
                        if (hl) rPrMarca.removeChild(hl);
                    }
                    return clon;
                });
                const ultimoOriginal = parrafos[bloque.items[bloque.items.length - 1]];
                nuevosNodos.forEach(n => celda.insertBefore(n, ultimoOriginal));
                bloque.items.forEach(i => { const p = parrafos[i]; if (p.parentNode) p.parentNode.removeChild(p); });
            }
        }
    }

    // ── Organigrama gráfico (imagen de cajas + conectores embebida en
    // el .docx). Si el cliente guardó un layout en el editor visual
    // (ORGANIGRAMA_CANVAS), se usa ese; si no, se calcula automático
    // con la jerarquía por defecto del sistema activo (SGM/SASISOPA).
    const NS_WPG = 'http://schemas.microsoft.com/office/word/2010/wordprocessingGroup';
    const NS_WPS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape';

    function construirOrganigramaXml(datos) {
        if (datos.ORGANIGRAMA_CANVAS && Array.isArray(datos.ORGANIGRAMA_CANVAS.nodos) && datos.ORGANIGRAMA_CANVAS.nodos.length) {
            return construirOrganigramaXmlDesdeCanvas(datos.ORGANIGRAMA_CANVAS);
        }
        const EMU_PX = 9525;
        const boxW = 1500000, boxH = 560000, gapH = 180000, gapV = 420000, margen = 60000;
        const sis = sistemaActivo();
        const rolesDisponibles = sis.rolesOrganigrama || [];
        const jerarquiaBase = sis.jerarquiaOrganigrama || [];

        const nombreDe = clave => (datos[clave] || '').trim();
        const etiquetaDe = clave => (rolesDisponibles.find(r => r.clave === clave) || {}).etiqueta || clave;

        const niveles = jerarquiaBase
            .map(nivel => nivel.filter(clave => !!nombreDe(clave)))
            .filter(nivel => nivel.length);

        const extras = Array.isArray(datos.ROLES_EXTRA) ? datos.ROLES_EXTRA.filter(r => r.etiqueta || r.nombre) : [];
        if (extras.length) niveles.push(extras.map((_, i) => `EXTRA_${i}`));

        if (!niveles.length) return null;

        const anchoNivel = n => n.length * boxW + (n.length - 1) * gapH;
        const anchoTotal = Math.max(...niveles.map(anchoNivel)) + margen * 2;

        let cajas = [];
        let lineas = [];
        let y = margen;
        let cajasPorClave = {};
        niveles.forEach((nivel, iNivel) => {
            const anchoEsteNivel = anchoNivel(nivel);
            let x = (anchoTotal - anchoEsteNivel) / 2;
            nivel.forEach(clave => {
                const esExtra = clave.startsWith('EXTRA_');
                const idx = esExtra ? parseInt(clave.split('_')[1], 10) : null;
                const etiqueta = esExtra ? (extras[idx].etiqueta || 'Puesto') : etiquetaDe(clave);
                const nombre = esExtra ? (extras[idx].nombre || '') : nombreDe(clave);
                const caja = { x, y, w: boxW, h: boxH, etiqueta, nombre };
                cajas.push(caja);
                cajasPorClave[clave] = caja;
                x += boxW + gapH;
            });
            if (iNivel > 0) {
                const nivelArriba = niveles[iNivel - 1];
                if (nivelArriba.length === 1) {
                    const padre = cajasPorClave[nivelArriba[0]];
                    const xPadre = padre.x + padre.w / 2, yPadre = padre.y + padre.h;
                    nivel.forEach(clave => {
                        const hijo = cajasPorClave[clave];
                        const xHijo = hijo.x + hijo.w / 2, yHijo = hijo.y;
                        const yMedio = yPadre + (yHijo - yPadre) / 2;
                        lineas.push({ x1: xPadre, y1: yPadre, x2: xPadre, y2: yMedio });
                        lineas.push({ x1: xPadre, y1: yMedio, x2: xHijo, y2: yMedio });
                        lineas.push({ x1: xHijo, y1: yMedio, x2: xHijo, y2: yHijo });
                    });
                }
            }
            y += boxH + gapV;
        });
        const altoTotal = y - gapV + boxH / 2 + margen;

        let idc = 9100;
        const shapesXml = cajas.map(c => `
            <wps:wsp>
                <wps:cNvPr id="${idc++}" name="Puesto"/>
                <wps:cNvSpPr/>
                <wps:spPr>
                    <a:xfrm><a:off x="${Math.round(c.x)}" y="${Math.round(c.y)}"/><a:ext cx="${Math.round(c.w)}" cy="${Math.round(c.h)}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    <a:solidFill><a:srgbClr val="1F5AA8"/></a:solidFill>
                    <a:ln w="9525"><a:solidFill><a:srgbClr val="123863"/></a:solidFill></a:ln>
                </wps:spPr>
                <wps:txbx><w:txbxContent>
                    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
                        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${escaparXml(c.etiqueta)}</w:t></w:r>
                    </w:p>
                    <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
                        <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="FFFFFF"/><w:sz w:val="14"/></w:rPr><w:t xml:space="preserve">${escaparXml(c.nombre)}</w:t></w:r>
                    </w:p>
                </w:txbxContent></wps:txbx>
                <wps:bodyPr wrap="square" lIns="45720" tIns="27432" rIns="45720" bIns="27432" anchor="ctr"><a:noAutofit/></wps:bodyPr>
            </wps:wsp>`).join('');

        const GROSOR_LINEA = 57150;
        const lineasXml = lineas.map(l => {
            const esVertical = Math.abs(l.x2 - l.x1) < 1000;
            const esPunto = Math.abs(l.x2 - l.x1) < 1000 && Math.abs(l.y2 - l.y1) < 1000;
            if (esPunto) return '';
            const x = esVertical ? Math.round(l.x1 - GROSOR_LINEA / 2) : Math.round(Math.min(l.x1, l.x2));
            const y = Math.round(Math.min(l.y1, l.y2));
            const cx = esVertical ? GROSOR_LINEA : Math.round(Math.abs(l.x2 - l.x1));
            const cy = esVertical ? Math.round(Math.abs(l.y2 - l.y1)) : GROSOR_LINEA;
            return `
            <wps:wsp>
                <wps:cNvPr id="${idc++}" name="Linea"/>
                <wps:cNvSpPr/>
                <wps:spPr>
                    <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${Math.max(cx,1)}" cy="${Math.max(cy,1)}"/></a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                    <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
                    <a:ln><a:noFill/></a:ln>
                </wps:spPr>
                <wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:txbxContent></wps:txbx>
                <wps:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></wps:bodyPr>
            </wps:wsp>`;
        }).join('');

        const cx = Math.round(anchoTotal), cy = Math.round(altoTotal);
        const xml = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="9099" name="Organigrama"/>
            <a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup">
                <wpg:wgp>
                    <wpg:cNvGrpSpPr/>
                    <wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></wpg:grpSpPr>
                    ${lineasXml}
                    ${shapesXml}
                </wpg:wgp>
            </a:graphicData></a:graphic>
        </wp:inline></w:drawing>`;
        return { xml, cx, cy };
    }

    function construirOrganigramaXmlDesdeCanvas(canvas) {
        const EMU_PX = 9525;
        const ALTO_NODO_PX = 90;
        const nodos = canvas.nodos;
        if (!nodos.length) return null;

        const minX = Math.min(...nodos.map(n => n.x));
        const minY = Math.min(...nodos.map(n => n.y));
        const maxX = Math.max(...nodos.map(n => n.x + n.w));
        const maxY = Math.max(...nodos.map(n => n.y + ALTO_NODO_PX));
        const margen = 20;
        const porId = {};
        nodos.forEach(n => porId[n.id] = n);

        // Si el organigrama dibujado en el editor visual (en píxeles) es
        // más ancho que el área útil de una página tamaño carta con
        // márgenes normales (~6.1 pulgadas), Word no puede centrarlo — se
        // queda pegado al margen izquierdo y se corta a la derecha. Se
        // escala todo proporcionalmente para que siempre quepa, sin
        // importar qué tan grande se haya dibujado en el editor.
        const MAX_ANCHO_EMU = 5500000; // ~6.01 pulgadas, con margen de seguridad
        const anchoTotalPxCrudo = (maxX - minX + margen * 2);
        const escala = Math.min(1, MAX_ANCHO_EMU / (anchoTotalPxCrudo * EMU_PX));
        const EMU_EFECTIVO = EMU_PX * escala;

        let idc = 9100;
        const shapesXml = nodos.map(n => {
            const x = Math.round((n.x - minX + margen) * EMU_EFECTIVO);
            const y = Math.round((n.y - minY + margen) * EMU_EFECTIVO);
            const w = Math.round(n.w * EMU_EFECTIVO);
            const h = Math.round(ALTO_NODO_PX * EMU_EFECTIVO);
            return `
                <wps:wsp>
                    <wps:cNvPr id="${idc++}" name="Puesto"/>
                    <wps:cNvSpPr/>
                    <wps:spPr>
                        <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                        <a:solidFill><a:srgbClr val="1F5AA8"/></a:solidFill>
                        <a:ln w="9525"><a:solidFill><a:srgbClr val="123863"/></a:solidFill></a:ln>
                    </wps:spPr>
                    <wps:txbx><w:txbxContent>
                        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
                            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${escaparXml(n.texto || 'Puesto')}</w:t></w:r>
                        </w:p>
                        <w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
                            <w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="FFFFFF"/><w:sz w:val="14"/></w:rPr><w:t xml:space="preserve">${escaparXml(n.nombre || '')}</w:t></w:r>
                        </w:p>
                    </w:txbxContent></wps:txbx>
                    <wps:bodyPr wrap="square" lIns="45720" tIns="27432" rIns="45720" bIns="27432" anchor="ctr"><a:noAutofit/></wps:bodyPr>
                </wps:wsp>`;
        }).join('');

        const puntoAbajo = n => ({ x: n.x - minX + margen + n.w / 2, y: n.y - minY + margen + ALTO_NODO_PX });
        const puntoArriba = n => ({ x: n.x - minX + margen + n.w / 2, y: n.y - minY + margen });
        const puntoCentro = n => ({ x: n.x - minX + margen + n.w / 2, y: n.y - minY + margen + ALTO_NODO_PX / 2 });

        let lineasCoords = [];
        nodos.forEach(n => {
            if (n.padre && porId[n.padre]) lineasCoords.push(...segmentosElbow(puntoAbajo(porId[n.padre]), puntoArriba(n)));
            if (n.padreSecundario && porId[n.padreSecundario]) lineasCoords.push(...segmentosElbow(puntoCentro(porId[n.padreSecundario]), puntoCentro(n)));
        });
        (canvas.conectores || []).forEach(c => {
            const a = porId[c.a], b = porId[c.b];
            if (a && b) lineasCoords.push(...segmentosElbow(puntoCentro(a), puntoCentro(b)));
        });

        const GROSOR_LINEA = 38100;
        const lineasXml = lineasCoords.map(l => {
            const esVertical = Math.abs(l.x2 - l.x1) < 0.5;
            const x = esVertical ? Math.round((l.x1 * EMU_EFECTIVO) - GROSOR_LINEA / 2) : Math.round(Math.min(l.x1, l.x2) * EMU_EFECTIVO);
            const y = Math.round(Math.min(l.y1, l.y2) * EMU_EFECTIVO);
            const cx = esVertical ? GROSOR_LINEA : Math.round(Math.abs(l.x2 - l.x1) * EMU_EFECTIVO);
            const cy = esVertical ? Math.round(Math.abs(l.y2 - l.y1) * EMU_EFECTIVO) : GROSOR_LINEA;
            return `
                <wps:wsp>
                    <wps:cNvPr id="${idc++}" name="Linea"/>
                    <wps:cNvSpPr/>
                    <wps:spPr>
                        <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${Math.max(cx,1)}" cy="${Math.max(cy,1)}"/></a:xfrm>
                        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                        <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
                        <a:ln><a:noFill/></a:ln>
                    </wps:spPr>
                    <wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p></w:txbxContent></wps:txbx>
                    <wps:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"><a:noAutofit/></wps:bodyPr>
                </wps:wsp>`;
        }).join('');

        const cx = Math.round((maxX - minX + margen * 2) * EMU_EFECTIVO), cy = Math.round((maxY - minY + margen * 2) * EMU_EFECTIVO);
        const xml = `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="9099" name="Organigrama"/>
            <a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup">
                <wpg:wgp>
                    <wpg:cNvGrpSpPr/>
                    <wpg:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/><a:chOff x="0" y="0"/><a:chExt cx="${cx}" cy="${cy}"/></a:xfrm></wpg:grpSpPr>
                    ${lineasXml}
                    ${shapesXml}
                </wpg:wgp>
            </a:graphicData></a:graphic>
        </wp:inline></w:drawing>`;
        return { xml, cx, cy };
    }

    function segmentosElbow(a, b) {
        if (Math.abs(a.x - b.x) < 0.5) return [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }];
        const yMedio = a.y + (b.y - a.y) / 2;
        return [
            { x1: a.x, y1: a.y, x2: a.x, y2: yMedio },
            { x1: a.x, y1: yMedio, x2: b.x, y2: yMedio },
            { x1: b.x, y1: yMedio, x2: b.x, y2: b.y },
        ];
    }

    function escaparXml(t) {
        return (t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function nodosDesdeXmlOrganigrama(xmlDoc, xmlString) {
        const NS_DECL = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
            'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
            'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
            'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
            'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';
        const wrapper = new DOMParser().parseFromString(`<wrapper ${NS_DECL}>${xmlString}</wrapper>`, 'application/xml');
        return xmlDoc.importNode(wrapper.documentElement.firstChild, true);
    }

    function reemplazarOrganigramaMGM(xmlDoc, datos) {
        // El organigrama original puede venir en formato moderno (w:drawing)
        // o en el formato VML antiguo (w:pict) — algunos machotes usan uno,
        // otros el otro. Antes los w:pict solo se borraban sin insertar
        // nada en su lugar, dejando el espacio en blanco cuando ese era el
        // único formato presente en el documento (p.ej. en la sección
        // "5.1 Función metrológica" del Manual).
        const esFormaOcultaVacia = pict => {
            const shape = pict.getElementsByTagName('v:shape')[0] || pict.getElementsByTagName('shape')[0];
            if (!shape) return false;
            const style = shape.getAttribute('style') || '';
            // Word deja formas de conector ocultas y sin imagen real como
            // plantilla invisible (v:shapetype "_x0000_t34", sin
            // v:imagedata) — no son el organigrama, hay que ignorarlas.
            return /visibility\s*:\s*hidden/i.test(style) && pict.getElementsByTagName('v:imagedata').length === 0 && pict.getElementsByTagName('imagedata').length === 0;
        };
        const parrafosConPict = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'pict'))
            .filter(pict => !esFormaOcultaVacia(pict))
            .map(pict => {
                let nodo = pict.parentNode;
                while (nodo && nodo.localName !== 'p') nodo = nodo.parentNode;
                return nodo;
            })
            .filter(p => p && !estaDentroDeTabla(p));

        const parrafosConDrawing = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))
            .filter(p => !estaDentroDeTabla(p) && p.getElementsByTagNameNS(NS_W, 'drawing').length > 0);

        const parrafosAReemplazar = Array.from(new Set([...parrafosConPict, ...parrafosConDrawing]));
        if (!parrafosAReemplazar.length) return;

        const generado = construirOrganigramaXml(datos);
        const primero = parrafosAReemplazar[0];
        if (generado) {
            const nuevoRun = xmlDoc.createElementNS(NS_W, 'w:r');
            nuevoRun.appendChild(nodosDesdeXmlOrganigrama(xmlDoc, generado.xml));
            const nuevoParrafo = xmlDoc.createElementNS(NS_W, 'w:p');
            const pPr = xmlDoc.createElementNS(NS_W, 'w:pPr');
            const jc = xmlDoc.createElementNS(NS_W, 'w:jc');
            jc.setAttributeNS(NS_W, 'w:val', 'center');
            pPr.appendChild(jc);
            nuevoParrafo.appendChild(pPr);
            nuevoParrafo.appendChild(nuevoRun);
            primero.parentNode.insertBefore(nuevoParrafo, primero);
        }
        parrafosAReemplazar.forEach(p => p.parentNode && p.parentNode.removeChild(p));
    }

    function estaDentroDeTabla(p) {
        let n = p.parentNode;
        while (n) { if (n.nodeType === 1 && n.localName === 'tc') return true; n = n.parentNode; }
        return false;
    }

    // SGM: motor de personalización de Excel (SOFT-G / SOFT-T)
    const NS_S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
    const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';

    function iniciales(nombreCompleto) {
        return (nombreCompleto || '').trim().split(/\s+/).filter(Boolean).map(p => p[0]).join('').toUpperCase();
    }

    function fechaAExcelSerial(ddmmyyyy) {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((ddmmyyyy || '').trim());
        if (!m) return null;
        const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10), anio = parseInt(m[3], 10);
        const fecha = Date.UTC(anio, mes - 1, dia);
        const epoca = Date.UTC(1899, 11, 30);
        return Math.round((fecha - epoca) / 86400000);
    }

    function celdaXlsx(sheetDoc, ref) {
        return Array.from(sheetDoc.getElementsByTagNameNS(NS_S, 'c')).find(c => c.getAttribute('r') === ref);
    }

    function ponerTextoCeldaXlsx(c, texto) {
        if (!c) return;
        Array.from(c.getElementsByTagNameNS(NS_S, 'v')).forEach(v => v.remove());
        Array.from(c.getElementsByTagNameNS(NS_S, 'is')).forEach(is => is.remove());
        c.setAttribute('t', 'inlineStr');
        const is = c.ownerDocument.createElementNS(NS_S, 'is');
        const t = c.ownerDocument.createElementNS(NS_S, 't');
        t.textContent = texto;
        is.appendChild(t);
        c.appendChild(is);
    }

    function ponerFechaCeldaXlsx(c, serial) {
        if (!c || serial == null) return;
        c.removeAttribute('t');
        Array.from(c.getElementsByTagNameNS(NS_S, 'is')).forEach(is => is.remove());
        let v = c.getElementsByTagNameNS(NS_S, 'v')[0];
        if (!v) { v = c.ownerDocument.createElementNS(NS_S, 'v'); c.appendChild(v); }
        v.textContent = String(serial);
    }

    // Antes se reconocía solo el amarillo EXACTO "FFFF00" — algunos
    // machotes (p.ej. F-16-04, con fill "FCF600") usan un tono de
    // amarillo ligeramente distinto que no coincidía con esa comparación
    // literal, así que ese relleno nunca se limpiaba. Se detecta ahora
    // por "se ve amarillo" (rojo y verde altos, azul bajo) en vez de por
    // el valor hexadecimal exacto, para cubrir esta variante y cualquier
    // otra que aparezca en futuros machotes.
    function pareceRellenoAmarilloXlsx(rgbHex) {
        const hex = (rgbHex || '').slice(-6);
        if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return false;
        const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
        return r > 200 && g > 200 && b < 100;
    }

    function quitarRellenoAmarilloXlsx(stylesDoc) {
        for (const fill of Array.from(stylesDoc.getElementsByTagNameNS(NS_S, 'fill'))) {
            const fg = fill.getElementsByTagNameNS(NS_S, 'fgColor')[0];
            if (fg && pareceRellenoAmarilloXlsx(fg.getAttribute('rgb'))) {
                const patt = fill.getElementsByTagNameNS(NS_S, 'patternFill')[0];
                if (patt) {
                    patt.setAttribute('patternType', 'none');
                    Array.from(patt.getElementsByTagNameNS(NS_S, 'fgColor')).forEach(n => n.remove());
                    Array.from(patt.getElementsByTagNameNS(NS_S, 'bgColor')).forEach(n => n.remove());
                }
            }
        }
    }

    function asegurarEstiloSinRojoXlsx(stylesDoc, c) {
        if (!c) return;
        const sOriginal = c.getAttribute('s');
        if (sOriginal === null) return;
        const cellXfs = stylesDoc.getElementsByTagNameNS(NS_S, 'cellXfs')[0];
        const xfs = Array.from(cellXfs.children);
        const xfOriginal = xfs[parseInt(sOriginal, 10)];
        if (!xfOriginal) return;
        const fonts = stylesDoc.getElementsByTagNameNS(NS_S, 'fonts')[0];
        const fontsArr = Array.from(fonts.children);
        const fontOriginal = fontsArr[parseInt(xfOriginal.getAttribute('fontId'), 10)];
        const color = fontOriginal ? fontOriginal.getElementsByTagNameNS(NS_S, 'color')[0] : null;
        const esRojo = color && (color.getAttribute('rgb') || '').toUpperCase().includes('FF0000');
        if (!esRojo) return;

        const fontNuevo = fontOriginal.cloneNode(true);
        const colorNuevo = fontNuevo.getElementsByTagNameNS(NS_S, 'color')[0];
        if (colorNuevo) { colorNuevo.removeAttribute('rgb'); colorNuevo.removeAttribute('indexed'); colorNuevo.setAttribute('rgb', 'FF000000'); }
        fonts.appendChild(fontNuevo);
        fonts.setAttribute('count', String(fontsArr.length + 1));

        const xfNuevo = xfOriginal.cloneNode(true);
        xfNuevo.setAttribute('fontId', String(fontsArr.length));
        cellXfs.appendChild(xfNuevo);
        cellXfs.setAttribute('count', String(xfs.length + 1));
        c.setAttribute('s', String(xfs.length));
    }

    async function insertarImagenesXlsxSGM(zip, sheetDoc, rutaSheet, imagenes, ctxImg) {
        const rutaRelsSheet = rutaRelsPara(rutaSheet);

        // Si la hoja YA tiene un <drawing> (p.ej. los cuadros de texto de
        // ELABORÓ/REVISÓ de F-04-01 en SASISOPA), NO se puede agregar un
        // segundo elemento <drawing> — Excel solo admite uno por hoja, y
        // tener dos deja ambos sin mostrarse correctamente. En ese caso,
        // la(s) imagen(es) se fusionan dentro del dibujo YA existente en
        // vez de crear uno nuevo en conflicto.
        const drawingExistente = sheetDoc.getElementsByTagNameNS(NS_S, 'drawing')[0];
        let rutaDrawing, rutaRelsDrawing, esNuevo;

        if (drawingExistente) {
            const rIdExistente = drawingExistente.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
            let xmlRelsSheetLectura;
            try { xmlRelsSheetLectura = await zip.file(rutaRelsSheet).async('string'); } catch (e) { xmlRelsSheetLectura = ''; }
            const m = new RegExp(`Id="${rIdExistente}"[^>]*Target="([^"]+)"`).exec(xmlRelsSheetLectura);
            if (!m) return; // no se pudo resolver el dibujo existente — no arriesgar romper nada
            // Target viene relativo a xl/worksheets/ (p.ej. "../drawings/drawing1.xml")
            const partesSheet = rutaSheet.split('/'); partesSheet.pop();
            const segmentos = (partesSheet.join('/') + '/' + m[1]).split('/');
            const resuelto = [];
            for (const seg of segmentos) {
                if (seg === '..') resuelto.pop(); else if (seg !== '.') resuelto.push(seg);
            }
            rutaDrawing = resuelto.join('/');
            rutaRelsDrawing = rutaRelsPara(rutaDrawing);
            esNuevo = false;
        } else {
            rutaDrawing = 'xl/drawings/drawingSgm.xml';
            rutaRelsDrawing = 'xl/drawings/_rels/drawingSgm.xml.rels';
            esNuevo = true;
        }

        let relsDrawingXml;
        try { relsDrawingXml = await zip.file(rutaRelsDrawing).async('string'); }
        catch (e) { relsDrawingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'; }

        let anchorsXml = '';
        for (const img of imagenes) {
            const { bytes, mime, ext } = dataUrlABytes(img.dataUrl);
            await asegurarContentType(zip, ext, mime);
            ctxImg.contador++;
            const mediaFilename = `logoGen${ctxImg.contador}.${ext}`;
            zip.file('xl/media/' + mediaFilename, bytes, { createFolders: false });

            const idsDrawing = Array.from(relsDrawingXml.matchAll(/Id="rId(\d+)"/g)).map(m => parseInt(m[1], 10));
            const rIdImg = 'rId' + ((idsDrawing.length ? Math.max(...idsDrawing) : 0) + 1);
            relsDrawingXml = relsDrawingXml.replace('</Relationships>',
                `<Relationship Id="${rIdImg}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaFilename}"/></Relationships>`);

            const { width, height } = await medirImagenDataUrl(img.dataUrl);
            let anchoPx = width * (img.maxAlto / height);
            let altoPx = img.maxAlto;
            if (anchoPx > img.maxAncho) { altoPx = altoPx * (img.maxAncho / anchoPx); anchoPx = img.maxAncho; }
            const cx = Math.round(anchoPx * 9525);
            const cy = Math.round(altoPx * 9525);

            const anchoColPx = img.anchoColPx || 0;
            const colOffX = anchoColPx > anchoPx ? Math.round(((anchoColPx - anchoPx) / 2) * 9525) : 19050;
            const rowOffY = img.altoFilaPx > altoPx ? Math.round(((img.altoFilaPx - altoPx) / 2) * 9525) : 19050;

            anchorsXml += `<xdr:oneCellAnchor>` +
                `<xdr:from><xdr:col>${img.col}</xdr:col><xdr:colOff>${colOffX}</xdr:colOff><xdr:row>${img.fila}</xdr:row><xdr:rowOff>${rowOffY}</xdr:rowOff></xdr:from>` +
                `<xdr:ext cx="${cx}" cy="${cy}"/>` +
                `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${2000 + ctxImg.contador}" name="Imagen${ctxImg.contador}"/><xdr:cNvPicPr/></xdr:nvPicPr>` +
                `<xdr:blipFill><a:blip r:embed="${rIdImg}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
                `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
                `<xdr:clientData/></xdr:oneCellAnchor>`;
        }

        if (esNuevo) {
            let xmlRelsSheet;
            try { xmlRelsSheet = await zip.file(rutaRelsSheet).async('string'); }
            catch (e) { xmlRelsSheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'; }
            const idsSheet = Array.from(xmlRelsSheet.matchAll(/Id="rId(\d+)"/g)).map(m => parseInt(m[1], 10));
            const rIdDrawing = 'rId' + ((idsSheet.length ? Math.max(...idsSheet) : 0) + 1);
            xmlRelsSheet = xmlRelsSheet.replace('</Relationships>',
                `<Relationship Id="${rIdDrawing}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawingSgm.xml"/></Relationships>`);
            zip.file(rutaRelsSheet, xmlRelsSheet, { createFolders: false });

            const drawingEl = sheetDoc.createElementNS(NS_S, 'drawing');
            drawingEl.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:id', rIdDrawing);
            sheetDoc.documentElement.appendChild(drawingEl);

            const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchorsXml}</xdr:wsDr>`;
            zip.file(rutaDrawing, drawingXml, { createFolders: false });
        } else {
            // Fusionar: insertar los anchors nuevos justo antes de </xdr:wsDr>
            // del dibujo ya existente, sin tocar nada de lo que ya tenía
            // (las figuras de ELABORÓ/REVISÓ, etc.) — reemplazo directo de
            // texto, sin parsear/regenerar el XML completo del dibujo.
            let drawingXmlActual = await zip.file(rutaDrawing).async('string');
            // El dibujo existente puede no haber necesitado nunca el
            // namespace "r:" (p.ej. si solo tenía cuadros de texto, sin
            // imágenes) — el <a:blip r:embed="..."/> que se inserta abajo
            // SÍ lo necesita. Si no está declarado en la raíz, Excel
            // rechaza el archivo completo como corrupto (visto en
            // pruebas reales). Se agrega solo si falta.
            if (!/xmlns:r=/.test(drawingXmlActual)) {
                drawingXmlActual = drawingXmlActual.replace(
                    /<xdr:wsDr\b/,
                    '<xdr:wsDr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
                );
            }
            drawingXmlActual = drawingXmlActual.replace('</xdr:wsDr>', anchorsXml + '</xdr:wsDr>');
            zip.file(rutaDrawing, drawingXmlActual, { createFolders: false });
        }

        zip.file(rutaRelsDrawing, relsDrawingXml, { createFolders: false });

        let ct = await zip.file('[Content_Types].xml').async('string');
        const nombreDrawing = rutaDrawing.split('/').pop();
        if (!ct.includes('/xl/drawings/' + nombreDrawing)) {
            ct = ct.replace('</Types>', `<Override PartName="/xl/drawings/${nombreDrawing}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
            zip.file('[Content_Types].xml', ct, { createFolders: false });
        }
    }

    async function procesarXlsxSGM(buffer, datos, stats, ctxImg) {
        const zip = await JSZip.loadAsync(buffer);
        const rutaSheet = 'xl/worksheets/sheet1.xml';
        let sheetXmlTexto, stylesXmlTexto;
        try {
            sheetXmlTexto = await zip.file(rutaSheet).async('string');
            stylesXmlTexto = await zip.file('xl/styles.xml').async('string');
        } catch (e) {
            return await zip.generateAsync({ type: 'blob' });
        }

        const parser = new DOMParser();
        const sheetDoc = parser.parseFromString(sheetXmlTexto, 'application/xml');
        const stylesDoc = parser.parseFromString(stylesXmlTexto, 'application/xml');

        quitarRellenoAmarilloXlsx(stylesDoc);

        const val = (clave, porDefecto) => (datos[clave] && String(datos[clave]).trim()) ? String(datos[clave]).trim() : porDefecto;
        const puestoElabora = val('PUESTO_ELABORA', 'Administrativo');
        const puestoReviso = val('PUESTO_REVISO', 'Alta Dirección');
        const puestoAprueba = val('PUESTO_APRUEBA', 'Alta Dirección');
        const nombreElabora = resolverNombreFirma(puestoElabora, val('NOMBRE_ELABORA', 'Lezlie Anahy Gutierrez Armendáriz.'), datos);
        const nombreReviso = resolverNombreFirma(puestoReviso, val('NOMBRE_REVISO', 'Félix Ruiz Gonzalez'), datos);
        const nombreAprueba = resolverNombreFirma(puestoAprueba, val('NOMBRE_APRUEBA', 'Félix Ruiz Gonzalez'), datos);
        const nombreRepresentante = (val('NOMBRE_REPRESENTANTE', 'Felix Ruiz Gonzalez')).toUpperCase();

        const celdaC4 = celdaXlsx(sheetDoc, 'C4');
        ponerTextoCeldaXlsx(celdaC4, nombreRepresentante);
        asegurarEstiloSinRojoXlsx(stylesDoc, celdaC4);

        // "Localización del documento: Estación de servicio" (fila 21) —
        // a petición del cliente, este campo SIEMPRE debe decir el texto
        // genérico "Estación de servicio", no la Razón Social de cada
        // cliente — es un descriptor de categoría, no un dato
        // personalizable (mismo criterio que procesarLocalizacionDocumentoSGM
        // para los .docx).
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'D21'), 'Estación de servicio');

        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'B18'), nombreElabora);
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'D18'), puestoElabora);
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'B19'), nombreReviso);
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'D19'), puestoReviso);
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'B20'), nombreAprueba);
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'D20'), puestoAprueba);

        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'E28'), iniciales(nombreElabora));
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'F28'), iniciales(nombreReviso));
        ponerTextoCeldaXlsx(celdaXlsx(sheetDoc, 'G28'), iniciales(nombreAprueba));

        const serial = fechaAExcelSerial(datos.FECHA_ELABORACION);
        if (serial != null) {
            ['F5', 'G18', 'G19', 'G20', 'B28'].forEach(ref => ponerFechaCeldaXlsx(celdaXlsx(sheetDoc, ref), serial));
        } else {
            stats.pendientes.push('Fecha de elaboración no asignada (hoja Excel)');
        }

        const celdaLogo = celdaXlsx(sheetDoc, 'A1');
        ponerTextoCeldaXlsx(celdaLogo, '');
        asegurarEstiloSinRojoXlsx(stylesDoc, celdaLogo);

        const imagenes = [];
        if (datos.LOGO_BASE64) { imagenes.push({ dataUrl: datos.LOGO_BASE64, col: 0, fila: 0, maxAncho: 130, maxAlto: 75 }); stats.logosInsertados++; }
        else stats.logosPendientes++;
        if (datos.FIRMA_ELABORA_BASE64) imagenes.push({ dataUrl: datos.FIRMA_ELABORA_BASE64, col: 5, fila: 17, maxAncho: 90, maxAlto: 26, anchoColPx: 118, altoFilaPx: 37 });
        if (datos.FIRMA_REVISO_BASE64) imagenes.push({ dataUrl: datos.FIRMA_REVISO_BASE64, col: 5, fila: 18, maxAncho: 90, maxAlto: 26, anchoColPx: 118, altoFilaPx: 50 });
        if (datos.FIRMA_APRUEBA_BASE64) imagenes.push({ dataUrl: datos.FIRMA_APRUEBA_BASE64, col: 5, fila: 19, maxAncho: 90, maxAlto: 26, anchoColPx: 118, altoFilaPx: 52 });
        if (imagenes.length) await insertarImagenesXlsxSGM(zip, sheetDoc, rutaSheet, imagenes, ctxImg);

        const xmlSerializer = new XMLSerializer();
        zip.file(rutaSheet, xmlSerializer.serializeToString(sheetDoc), { createFolders: false });
        zip.file('xl/styles.xml', xmlSerializer.serializeToString(stylesDoc), { createFolders: false });

        stats.reemplazos += 11;
        return await zip.generateAsync({ type: 'blob' });
    }

    // SASISOPA: motor de personalización de Excel (F-04-01, etc.)
    // ══════════════════════════════════════════════════════════════
    // A diferencia de SGM (un puñado de plantillas .xlsx con layout fijo,
    // por eso se usan celdas exactas como B18/D18), SASISOPA trae decenas
    // de .xlsx con layouts distintos entre sí — aquí se ubica todo por el
    // CONTENIDO de cada celda (coincidencia con SASISOPA_MAPEO, igual que
    // en los .docx vía resaltado amarillo), no por referencia fija.

    function leerSharedStringsXlsx(sharedStringsXmlTexto) {
        if (!sharedStringsXmlTexto) return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(sharedStringsXmlTexto, 'application/xml');
        return Array.from(doc.getElementsByTagNameNS(NS_S, 'si')).map(si =>
            Array.from(si.getElementsByTagNameNS(NS_S, 't')).map(t => t.textContent).join('')
        );
    }

    function textoCeldaXlsxGenerico(celda, sharedStrings) {
        if (!celda) return '';
        const tipo = celda.getAttribute('t');
        if (tipo === 'inlineStr') {
            const is = celda.getElementsByTagNameNS(NS_S, 'is')[0];
            return is ? Array.from(is.getElementsByTagNameNS(NS_S, 't')).map(t => t.textContent).join('') : '';
        }
        if (tipo === 's') {
            const v = celda.getElementsByTagNameNS(NS_S, 'v')[0];
            const idx = v ? parseInt(v.textContent, 10) : -1;
            return (idx >= 0 && sharedStrings[idx] !== undefined) ? sharedStrings[idx] : '';
        }
        const v = celda.getElementsByTagNameNS(NS_S, 'v')[0];
        return v ? v.textContent : '';
    }

    function colLetraDeRef(ref) { const m = /^([A-Z]+)(\d+)$/.exec(ref || ''); return m ? m[1] : ''; }
    function filaNumDeRef(ref) { const m = /^([A-Z]+)(\d+)$/.exec(ref || ''); return m ? parseInt(m[2], 10) : -1; }
    // Ancho de columna / alto de fila reales en píxeles, a partir de las
    // definiciones <col>/<row> de la hoja — necesario para poder CENTRAR
    // una imagen dentro de su celda (sin esto, insertarImagenesXlsxSGM
    // usa un desplazamiento fijo pequeño, no un centrado real).
    function anchoColumnaPx(sheetDoc, colIndiceBase0) {
        const colNum = colIndiceBase0 + 1;
        const cols = Array.from(sheetDoc.getElementsByTagNameNS(NS_S, 'col'));
        for (const c of cols) {
            const min = parseInt(c.getAttribute('min'), 10);
            const max = parseInt(c.getAttribute('max'), 10);
            if (colNum >= min && colNum <= max) {
                const w = parseFloat(c.getAttribute('width'));
                if (!isNaN(w)) return Math.round(w * 7 + 5);
            }
        }
        return 64; // ancho de columna por default (~8.43 caracteres)
    }
    function altoFilaPx(sheetDoc, filaIndiceBase0) {
        const filaNum = filaIndiceBase0 + 1;
        const filas = Array.from(sheetDoc.getElementsByTagNameNS(NS_S, 'row'));
        for (const f of filas) {
            if (parseInt(f.getAttribute('r'), 10) === filaNum) {
                const h = parseFloat(f.getAttribute('ht'));
                if (!isNaN(h)) return Math.round(h * 96 / 72);
            }
        }
        return 20; // alto de fila por default (~15 puntos)
    }
    function colLetraANumero(col) {
        let n = 0;
        for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
        return n;
    }
    function colNumeroALetra(n) {
        let s = '';
        while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
        return s;
    }

    // Mapea nombre de pestaña -> ruta de su sheetN.xml, leyendo
    // xl/workbook.xml y su .rels. Necesario porque el número de hoja
    // (sheet4.xml, sheet5.xml...) puede variar entre copias del mismo
    // machote — el NOMBRE de la pestaña ("Desmantelamiento", "Abandono
    // del sitio") es lo único estable para ubicarlas.
    async function mapaNombresHojasXlsx(zip) {
        let workbookXml, relsXml;
        try {
            workbookXml = await zip.file('xl/workbook.xml').async('string');
            relsXml = await zip.file('xl/_rels/workbook.xml.rels').async('string');
        } catch (e) { return {}; }
        const relPorId = {};
        for (const m of relsXml.matchAll(/<Relationship\s+Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
            relPorId[m[1]] = m[2].replace(/^\.?\/?/, '');
        }
        const mapa = {};
        for (const m of workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="(rId\d+)"[^>]*\/>|<sheet\b[^>]*\br:id="(rId\d+)"[^>]*\bname="([^"]+)"[^>]*\/>/g)) {
            const nombre = m[1] || m[4];
            const rId = m[2] || m[3];
            const target = relPorId[rId];
            if (nombre && target) mapa[nombre] = 'xl/' + target;
        }
        return mapa;
    }

    // F-02-02: las hojas "Desmantelamiento" y "Abandono del sitio" no
    // traen ninguna celda "LOGO" — el logo de referencia en esas dos
    // etapas vive únicamente en el encabezado de impresión (oddHeader)
    // del machote, como parte de la insignia de "SUPERSERVICIO CUATRO
    // CAMINOS" incrustada ahí. Tocar ese encabezado de impresión con
    // VML ya se intentó antes y Excel rechazó el archivo las 3 veces —
    // así que en vez de eso se inserta el logo del cliente como imagen
    // normal (DrawingML, el mismo mecanismo ya probado que se usa para
    // el resto de logos de SASISOPA/SGM) directamente en la esquina
    // donde debería verse, sin tocar el encabezado de impresión.
    const NOMBRES_HOJAS_LOGO_FLOTANTE_F0202 = ['Desmantelamiento', 'Abandono del sitio'];

    async function insertarLogoFlotanteHojasF0202(zip, datos, stats, ctxImg) {
        const mapa = await mapaNombresHojasXlsx(zip);
        const parser = new DOMParser();
        const xmlSerializer = new XMLSerializer();
        for (const nombreHoja of NOMBRES_HOJAS_LOGO_FLOTANTE_F0202) {
            const rutaSheet = mapa[nombreHoja];
            if (!rutaSheet) continue;
            let sheetXmlTexto;
            try { sheetXmlTexto = await zip.file(rutaSheet).async('string'); } catch (e) { continue; }
            const sheetDoc = parser.parseFromString(sheetXmlTexto, 'application/xml');
            if (datos.LOGO_BASE64) {
                await insertarImagenesXlsxSGM(zip, sheetDoc, rutaSheet, [
                    { dataUrl: datos.LOGO_BASE64, col: 0, fila: 0, maxAncho: 150, maxAlto: 90,
                      anchoColPx: anchoColumnaPx(sheetDoc, 0), altoFilaPx: altoFilaPx(sheetDoc, 0) },
                ], ctxImg);
                stats.logosInsertados++;
            } else {
                stats.logosPendientes++;
            }
            zip.file(rutaSheet, xmlSerializer.serializeToString(sheetDoc), { createFolders: false });
        }
    }

    async function procesarXlsxSASISOPA(buffer, datos, stats, ctxImg, nombreArchivo) {
        const zip = await JSZip.loadAsync(buffer);
        let stylesXmlTexto, sharedXmlTexto;
        try {
            stylesXmlTexto = await zip.file('xl/styles.xml').async('string');
        } catch (e) {
            return await zip.generateAsync({ type: 'blob' });
        }
        try { sharedXmlTexto = await zip.file('xl/sharedStrings.xml').async('string'); } catch (e) { sharedXmlTexto = null; }

        const parser = new DOMParser();
        const xmlSerializer = new XMLSerializer();
        const stylesDoc = parser.parseFromString(stylesXmlTexto, 'application/xml');
        const sharedStrings = leerSharedStringsXlsx(sharedXmlTexto);

        quitarRellenoAmarilloXlsx(stylesDoc);

        const roles = SASISOPA_ROLES_DISPONIBLES;
        const norm = t => (t || '').replace(/[.:]+\s*$/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const rolPorEtiqueta = etiqueta => roles.find(r => norm(r.etiqueta) === norm(etiqueta));

        // Algunos machotes (p.ej. F-02-02) traen VARIAS hojas — una por
        // etapa: Operación, Mantenimiento, Desmantelamiento, Abandono
        // del sitio... — cada una con su propio encabezado/fecha/AÑO
        // que personalizar. Antes solo se procesaba "sheet1.xml" y el
        // resto se copiaba intacto (por eso esas hojas nunca recibían
        // ningún reemplazo). Se procesan TODAS las hojas del libro.
        const rutasHojas = Object.keys(zip.files).filter(p => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p));

        for (const rutaSheet of rutasHojas) {
        let sheetXmlTexto;
        try { sheetXmlTexto = await zip.file(rutaSheet).async('string'); } catch (e) { continue; }
        const sheetDoc = parser.parseFromString(sheetXmlTexto, 'application/xml');

        const celdas = Array.from(sheetDoc.getElementsByTagNameNS(NS_S, 'c'));
        const celdasLogo = [];
        const celdasNombre = [];

        for (const celda of celdas) {
            const texto = textoCeldaXlsxGenerico(celda, sharedStrings).trim();
            if (!texto) continue;

            // 1) Coincidencia literal directa contra el catálogo (razón
            // social, RFC, domicilio, fecha, roles institucionales, etc.)
            const clave = SASISOPA_MAPEO[texto];
            if (clave !== undefined) {
                if (clave === '__LOGO__') { celdasLogo.push(celda); continue; }
                if (clave === '__SKIP__') continue;
                const valor = datos[clave] || derivarValorSASISOPA(clave, datos);
                if (valor) {
                    ponerTextoCeldaXlsx(celda, valor);
                    stats.reemplazos++;
                } else if (CAMPOS_BLANCO_SI_VACIO.includes(clave)) {
                    ponerTextoCeldaXlsx(celda, '');
                    stats.reemplazos++;
                } else {
                    stats.pendientes.push(texto);
                }
                continue;
            }

            // 2) Fuzzy: razón social / domicilio con variaciones de formato.
            if (datos.RAZON_SOCIAL && RE_RAZON_SOCIAL.test(texto)) {
                ponerTextoCeldaXlsx(celda, texto.replace(RE_RAZON_SOCIAL, datos.RAZON_SOCIAL));
                stats.reemplazos++;
                continue;
            }
            if (datos.DOMICILIO_ESTACION && RE_DOMICILIO.test(texto)) {
                ponerTextoCeldaXlsx(celda, texto.replace(RE_DOMICILIO, datos.DOMICILIO_ESTACION));
                stats.reemplazos++;
                continue;
            }
            // 3) Fecha suelta dd/mm/aaaa no catalogada explícitamente.
            if (datos.FECHA_ELABORACION && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(texto)) {
                ponerTextoCeldaXlsx(celda, datos.FECHA_ELABORACION);
                stats.reemplazos++;
                continue;
            }
            // 3.5) "AÑO 2025" (encabezados de tablas de metas/programas
            // anuales) — siempre debe reflejar el año real en que se
            // genera el documento (hoy), no el año de referencia fijo
            // del machote. Se recalcula cada vez, sin depender de ningún
            // dato capturado en el formulario.
            if (/^A[ÑN]O\s+\d{4}$/i.test(texto)) {
                const anioActual = new Date().getFullYear();
                ponerTextoCeldaXlsx(celda, texto.replace(/\d{4}/, String(anioActual)));
                stats.reemplazos++;
                continue;
            }
            // 3.6) Bloque "Revisión: 0 / Página X de Y / Efectivo:
            // dd/mm/aaaa" — texto de referencia sin marcar. Solo se
            // actualiza la fecha de "Efectivo:" (a la fecha de
            // elaboración capturada, o a hoy si no se capturó); el
            // número de revisión y la paginación se dejan igual.
            if (/efectivo\s*:\s*\d{1,2}\/\d{1,2}\/\d{4}/i.test(texto)) {
                const hoy = new Date();
                const fechaHoy = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
                const fechaNueva = datos.FECHA_ELABORACION || fechaHoy;
                const textoNuevo = texto.replace(/(efectivo\s*:\s*)\d{1,2}\/\d{1,2}\/\d{4}/i, `$1${fechaNueva}`);
                ponerTextoCeldaXlsx(celda, textoNuevo);
                stats.reemplazos++;
                continue;
            }

            // 4) Bloques "NOMBRE" — el puesto suele estar en la celda de
            // abajo o a la derecha (se resuelve después, ya con todas las
            // celdas mapeadas por referencia).
            if (norm(texto) === 'nombre') { celdasNombre.push(celda); continue; }
        }

        // Resolver bloques NOMBRE usando la celda vecina (abajo o a la
        // derecha) como etiqueta de puesto — igual patrón que en los .docx.
        for (const celdaNombre of celdasNombre) {
            const ref = celdaNombre.getAttribute('r');
            const col = colLetraDeRef(ref), fila = filaNumDeRef(ref);
            if (!col || fila < 0) continue;
            const refsVecinos = [
                colNumeroALetra(colLetraANumero(col)) + (fila + 1), // abajo
                colNumeroALetra(colLetraANumero(col) + 1) + fila,   // derecha
            ];
            for (const refVecino of refsVecinos) {
                const celdaVecina = celdas.find(c => c.getAttribute('r') === refVecino);
                if (!celdaVecina) continue;
                const textoVecino = textoCeldaXlsxGenerico(celdaVecina, sharedStrings).trim();
                const rol = rolPorEtiqueta(textoVecino);
                if (!rol) continue;
                const nombre = datos[rol.clave];
                if (nombre) {
                    ponerTextoCeldaXlsx(celdaNombre, nombre);
                    stats.reemplazos++;
                } else {
                    stats.pendientes.push(`Nombre de ${textoVecino} (sin dato capturado, hoja Excel)`);
                }
                break;
            }
        }

        // Logo: se inserta en la primera celda "LOGO" encontrada.
        if (celdasLogo.length) {
            const celda = celdasLogo[0];
            ponerTextoCeldaXlsx(celda, '');
            asegurarEstiloSinRojoXlsx(stylesDoc, celda);
            if (datos.LOGO_BASE64) {
                const ref = celda.getAttribute('r');
                const col = colLetraANumero(colLetraDeRef(ref)) - 1;
                const fila = filaNumDeRef(ref) - 1;
                await insertarImagenesXlsxSGM(zip, sheetDoc, rutaSheet, [
                    { dataUrl: datos.LOGO_BASE64, col, fila, maxAncho: 130, maxAlto: 100,
                      anchoColPx: anchoColumnaPx(sheetDoc, col), altoFilaPx: altoFilaPx(sheetDoc, fila) },
                ], ctxImg);
                stats.logosInsertados++;
            } else {
                stats.logosPendientes++;
            }
        }

        zip.file(rutaSheet, xmlSerializer.serializeToString(sheetDoc), { createFolders: false });
        } // fin del ciclo por cada hoja (rutasHojas)

        // Cuadros de texto flotantes (capa de dibujo) — algunos machotes
        // SASISOPA (p.ej. F-04-01) usan un cuadro de texto flotante para
        // la firma de "ELABORÓ/REVISÓ" en vez de una tabla de celdas. El
        // texto literal "NOMBRE" ahí debe convertirse en el nombre real
        // de quien ocupa el puesto indicado en el siguiente run de texto
        // dentro del mismo cuadro. Se hace por reemplazo directo de texto
        // (no parseando/regenerando el XML completo del dibujo) para no
        // arriesgar romper el formato estricto que Excel espera ahí —
        // el mismo criterio ya usado en otros arreglos delicados.
        for (const rutaDrawing of Object.keys(zip.files).filter(p => /^xl\/drawings\/drawing\d*\.xml$/i.test(p))) {
            let texto;
            try { texto = await zip.file(rutaDrawing).async('string'); } catch (e) { continue; }
            let resultado = texto;
            let cambios = false;
            const RE_NOMBRE = /<a:t>NOMBRE<\/a:t>/g;
            let m;
            while ((m = RE_NOMBRE.exec(texto)) !== null) {
                const finNombre = m.index + m[0].length;
                const siguiente = /<a:t>([^<]*)<\/a:t>/.exec(texto.slice(finNombre));
                if (!siguiente) continue;
                const rolTexto = siguiente[1].trim();
                const rol = rolPorEtiqueta(rolTexto);
                if (!rol) continue;
                const nombre = datos[rol.clave];
                cambios = true;
                if (nombre) {
                    resultado = resultado.replace('<a:t>NOMBRE</a:t>', '<a:t>' + escaparXml(nombre) + '</a:t>');
                    stats.reemplazos++;
                } else {
                    stats.pendientes.push(`Nombre de ${rolTexto} (cuadro de texto, hoja Excel)`);
                }
            }
            // Quitar el fondo amarillo de los cuadros de texto (p.ej.
            // ELABORÓ/REVISÓ), para que se vean sin relleno — como el
            // resto del documento — en vez de con el amarillo del
            // machote de referencia.
            if (/<a:srgbClr val="ffff00"\/>/i.test(resultado)) {
                resultado = resultado.replace(/<a:solidFill><a:srgbClr val="ffff00"\/><\/a:solidFill>/gi, '<a:noFill/>');
                cambios = true;
            }
            if (cambios) zip.file(rutaDrawing, resultado, { createFolders: false });
        }

        zip.file('xl/styles.xml', xmlSerializer.serializeToString(stylesDoc), { createFolders: false });

        // F-02-02: logo flotante en Desmantelamiento y Abandono del
        // sitio (ver comentario en insertarLogoFlotanteHojasF0202) —
        // esas dos hojas no tienen celda "LOGO", así que no las cubre
        // el bucle genérico de arriba.
        if (/^F-02-02/i.test(nombreArchivo || '')) {
            await insertarLogoFlotanteHojasF0202(zip, datos, stats, ctxImg);
        }

        return await zip.generateAsync({ type: 'blob' });
    }

    // Metadatos internos del .docx (docProps/core.xml)
    // El cuerpo del documento (word/document.xml) ya se personaliza vía los
    // resaltados amarillos, pero el título/asunto interno del archivo
    // (los mismos que Google Drive, Windows o Word muestran en vistas
    // previas y en la pestaña del navegador) viven en docProps/core.xml y
    // NUNCA se tocaban — por eso seguía apareciendo el nombre y el permiso
    // del cliente de referencia (p.ej. "FELIX RUIZ PL-9693") aunque el
    // cuerpo del documento ya estuviera bien personalizado.
    function personalizarTextoMetadatos(texto, datos) {
        let out = texto;
        const mapeo = sistemaActivo().mapeo;
        for (const [literal, clave] of Object.entries(mapeo)) {
            if (clave === '__SKIP__' || clave === '__LOGO__') continue;
            if (!out.includes(literal)) continue;
            let valor = datos[clave] || derivarValor(clave, datos) || '';
            if (!valor && CAMPOS_BLANCO_SI_VACIO.includes(clave)) valor = '';
            out = out.split(literal).join(valor);
        }
        if (_seccionActual !== 'sgm') {
            if (datos.RAZON_SOCIAL) out = out.replace(RE_RAZON_SOCIAL, datos.RAZON_SOCIAL);
            if (datos.DOMICILIO_ESTACION) out = out.replace(RE_DOMICILIO, datos.DOMICILIO_ESTACION);
        }
        return out;
    }

    async function procesarMetadatosDocx(zip, datos) {
        const ruta = 'docProps/core.xml';
        const archivo = zip.file(ruta);
        if (!archivo) return;
        let xml = await archivo.async('string');
        xml = personalizarTextoMetadatos(xml, datos);
        zip.file(ruta, xml, { createFolders: false });
    }

    async function procesarDocx(arrayBuffer, nombreArchivo, datos, stats, zip) {
        const parser = new DOMParser();
        const serializer = new XMLSerializer();
        const ctxImagen = { contador: 0 };

        await procesarMetadatosDocx(zip, datos);

        const rutasXml = Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/i.test(p));
        for (const ruta of rutasXml) {
            const xmlTexto = await zip.file(ruta).async('string');
            const xmlDoc = parser.parseFromString(xmlTexto, 'application/xml');
            const ctx = { zip, ruta, imagen: ctxImagen };

            const celdasFirmaPendientes = [];
            // La tabla de control de documentos (Elaboró/Revisó/Aprobó·Autorizó,
            // con columnas Nombre/Puesto o Función/Firma/Fecha) se procesa para
            // ambos sistemas: SASISOPA y SGM comparten el mismo patrón de tabla.
            procesarTablaDocumentoControlado(xmlDoc, datos, celdasFirmaPendientes);
            if (_seccionActual === 'sgm') {
                procesarNotacionOrganizacionSGM(xmlDoc, datos, stats);
                procesarLocalizacionDocumentoSGM(xmlDoc, datos, stats);
                procesarFirmaAtentamenteSGM(xmlDoc, datos, stats);
                procesarRevisionPorDireccionSGM(xmlDoc);
                limpiarArticulosAntesDeRolSGM(xmlDoc, datos);
                procesarControlDeCambiosSGM(xmlDoc, datos);
                neutralizarTablasDescriptivasSGM(xmlDoc);
                reconstruirTarjetasPuestosSGM(xmlDoc, datos);
                aplicarGradoEstudiosSGM(xmlDoc, datos);
                // reconstruirResponsabilidadesSGM(xmlDoc, datos, stats); // DESACTIVADO a petición: sección 8 vuelve a mostrar puesto (no nombre), solo se muestran/ocultan roles fijos + se agregan roles extra al final (ver agregarRolesExtraResponsabilidadesSGM)
                filtrarListasDeRolesSGM(xmlDoc, datos, nombreArchivo);
                agregarRolesExtraResponsabilidadesSGM(xmlDoc, datos, stats);
                procesarFrasesMultiPuestoSGM(xmlDoc, datos, stats);
                procesarInmediatoSiguienteSGM(xmlDoc, datos, nombreArchivo, stats);
            } else if (_seccionActual === 'sasisopa') {
                procesarPuestoDinamicoP07(xmlDoc, datos, nombreArchivo, stats);
                procesarRolesDinamicosP082(xmlDoc, datos, nombreArchivo, stats);
                procesarRolesDinamicosP18(xmlDoc, datos, nombreArchivo, stats);
                procesarRolAltaDireccionP11(xmlDoc, datos, nombreArchivo, stats);
                procesarMencionRolNarrativaSASISOPA(xmlDoc, datos, stats, {
                    nombreArchivo, patronArchivo: /^P-14_1(?!\d)/i,
                    anclas: ['en conjunto con el Representante'],
                    clave: 'P141_ROL_3_1', rolPorDefecto: 'ROL_ALTA_DIRECCION', conArticulo: false,
                });
                procesarMencionRolNarrativaSASISOPA(xmlDoc, datos, stats, {
                    nombreArchivo, patronArchivo: /^P-14_2/i,
                    anclas: [', Representante Técnico.'],
                    clave: 'P142_ROL_3_1', rolPorDefecto: 'ROL_ALTA_DIRECCION', conArticulo: false,
                });
                procesarMencionRolNarrativaSASISOPA(xmlDoc, datos, stats, {
                    nombreArchivo, patronArchivo: /^P-15/i,
                    anclas: ['firmado por la'],
                    clave: 'P15_ROL_4', rolPorDefecto: 'ROL_ALTA_DIRECCION', conArticulo: true,
                });
                protegerListaDeRolesSASISOPA(xmlDoc, nombreArchivo, /^P-10[._]8/i, 'correcta aplicación de este procedimiento');
                // M-11, punto I: "el Supervisor de Estación" viene
                // resaltado en las 2 menciones junto con "Alta
                // Dirección" — se queda como puesto (no se convierte a
                // nombre), mientras que Alta Dirección sí es
                // seleccionable más abajo.
                if (/^M-11/i.test(nombreArchivo || '')) {
                    for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
                        const t = textoParrafo(p);
                        if (!t.includes('designado por la') && !t.includes('que designe la')) continue;
                        const norm2 = x => (x || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        for (const r of Array.from(p.getElementsByTagNameNS(NS_W, 'r'))) {
                            if (esResaltadoAmarillo(r) && (norm2(textoDeRun(r)) === 'supervisor' || norm2(textoDeRun(r)) === 'de estación')) {
                                quitarResaltado(r);
                            }
                        }
                    }
                }
                procesarMencionRolNarrativaSASISOPA(xmlDoc, datos, stats, {
                    nombreArchivo, patronArchivo: /^M-11/i,
                    anclas: ['designado por la', 'que designe la'],
                    clave: 'M11_ROL_ALTA_DIRECCION', rolPorDefecto: 'ROL_ALTA_DIRECCION', conArticulo: true,
                });
                resolverRolesEnFormasSASISOPA(xmlDoc, datos, stats);
                resolverNombresPorRolSASISOPA(xmlDoc, datos, stats, nombreArchivo);
            } else if (_seccionActual === 'bitacoras') {
                procesarCamposBitacoras(xmlDoc, datos, stats);
            }
            // PROC-G-*/PROC-T-* traen su propio diagrama de proceso (no un
            // organigrama) y no deben pasar por el reemplazo automático del
            // organigrama gráfico — solo aplica a manuales/formatos que sí
            // llevan el organigrama real de la organización. Bitácoras
            // tampoco lleva organigrama.
            if (_seccionActual !== 'bitacoras'
                && !(_seccionActual === 'sgm' && RE_SIN_ORGANIGRAMA_SGM.test(nombreArchivo))
                && !(_seccionActual === 'sasisopa' && RE_SIN_ORGANIGRAMA_SASISOPA.test(nombreArchivo))) {
                reemplazarOrganigramaMGM(xmlDoc, datos);
            }

            // Respaldo de logo: algunos documentos (p.ej. F-05-01 Organigrama,
            // los 9 machotes de Bitácoras, y el ÍNDICE_Y_PORTADA_PRINCIPAL
            // de Bitácoras que no tiene tabla) no traen el texto "LOGO"
            // resaltado — solo la insignia decorativa del machote de
            // referencia como imagen fija (en celda o en párrafo suelto),
            // sin ningún gancho de texto para sustituirla por el flujo
            // normal. Se detecta ese caso puntual: si el cliente subió
            // logo, se sustituye ahí; si NO subió logo, se quita la
            // insignia de referencia igualmente para no dejar el logo del
            // cliente equivocado (ej. "Servicio Chavo") en el documento final.
            if (_seccionActual !== 'sgm') {
                const contenedorLogo = localizarContenedorLogo(xmlDoc);
                if (contenedorLogo) {
                    const tieneTextoLogo = /\blogo\b/i.test(textoDeCelda(contenedorLogo));
                    if (!tieneTextoLogo) {
                        if (datos.LOGO_BASE64) {
                            let parrafo = contenedorLogo.localName === 'p' ? contenedorLogo : contenedorLogo.getElementsByTagNameNS(NS_W, 'p')[0];
                            if (!parrafo) { parrafo = xmlDoc.createElementNS(NS_W, 'w:p'); contenedorLogo.appendChild(parrafo); }
                            let run = parrafo.getElementsByTagNameNS(NS_W, 'r')[0];
                            if (!run) { run = xmlDoc.createElementNS(NS_W, 'w:r'); parrafo.appendChild(run); }
                            if (contenedorLogo.localName === 'p') {
                                // Párrafo suelto (ÍNDICE_Y_PORTADA_PRINCIPAL): el
                                // espacio original del logo ahí es más grande
                                // (~357x87px) que en el encabezado de los 9
                                // machotes (~196x48px) — se respeta ese tamaño.
                                await insertarImagenEnGrupo(zip, xmlDoc, ruta, [run], datos.LOGO_BASE64, ctxImagen, 190, 750);
                            } else {
                                await insertarLogoEnGrupo(zip, xmlDoc, ruta, [run], datos.LOGO_BASE64, ctxImagen);
                            }
                            stats.logosInsertados++;
                        } else {
                            // Sin logo cargado: se quita la insignia de referencia
                            // por completo y se deja el espacio en blanco.
                            Array.from(contenedorLogo.getElementsByTagNameNS(NS_W, 'drawing')).forEach(d => d.parentNode && d.parentNode.removeChild(d));
                            Array.from(contenedorLogo.getElementsByTagNameNS(NS_W, 'pict')).forEach(d => d.parentNode && d.parentNode.removeChild(d));
                            stats.logosPendientes++;
                        }
                    }
                }
            }

            for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
                await procesarParrafo(p, datos, stats, ctx);
            }
            for (const { celda, dataUrl } of celdasFirmaPendientes) {
                await insertarFirmaEnCelda(zip, xmlDoc, ruta, celda, dataUrl, ctxImagen);
            }
            if (ruta === 'word/document.xml' && nombreArchivo.startsWith('F-06-02')) {
                procesarEscolaridadF0602(xmlDoc, datos, stats);
            }
            if (ruta === 'word/document.xml' && _seccionActual === 'sgm' && RE_ARCHIVOS_CON_TABLA_EQUIPO.test(nombreArchivo)) {
                procesarTablaEquipoSGM(xmlDoc, datos, stats);
            }
            if (ruta === 'word/document.xml' && _seccionActual === 'sgm') {
                procesarTablaPatronesSGM(xmlDoc, datos, stats);
            }
            // Barrido final de seguridad: cualquier resaltado amarillo que
            // haya sobrevivido a todo lo anterior (placeholder sin catalogar,
            // celda que no encajó en ningún patrón, etc.) se elimina aquí y
            // se reporta como pendiente. Antes solo corría para SGM; ahora
            // corre siempre, para que a SASISOPA no le sigan quedando
            // rastros de amarillo en el .docx final.
            Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'r')).filter(esResaltadoAmarillo).forEach(r => {
                const texto = textoDeRun(r).trim();
                if (texto) stats.pendientes.push(texto);
                quitarResaltado(r);
            });
            Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'pPr')).forEach(pPr => {
                const rPr = pPr.getElementsByTagNameNS(NS_W, 'rPr')[0];
                const hl = rPr ? rPr.getElementsByTagNameNS(NS_W, 'highlight')[0] : null;
                if (hl && hl.getAttributeNS(NS_W, 'val') === 'yellow') rPr.removeChild(hl);
            });
            zip.file(ruta, serializer.serializeToString(xmlDoc), { createFolders: false });
        }
        return await zip.generateAsync({ type: 'blob' });
    }

    // FIRESTORE
    async function listarClientes() {
        const { collection, getDocs, query, orderBy } = await fsFns();
        const sis = sistemaActivo();
        const snap = await getDocs(query(collection(window.db, sis.coleccion), orderBy(sis.campoOrden)));
        _clientesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return _clientesCache;
    }

    // Recorre el formulario actual y devuelve TODAS las claves que
    // podrían llegar a existir en Firestore para este cliente (roles del
    // checklist, campos de texto, tablas dinámicas) — sin importar si
    // ahora mismo están marcadas/llenas o no. Se usa para saber qué
    // campos hay que BORRAR explícitamente al guardar (ver guardarCliente).
    function calcularCamposPosiblesDelFormulario(cont) {
        const claves = new Set();
        cont.querySelectorAll('#gs-columna-form [data-clave]').forEach(el => claves.add(el.dataset.clave));
        cont.querySelectorAll('[data-clave-tabla]').forEach(el => claves.add(el.dataset.claveTabla));
        return Array.from(claves);
    }

    // `setDoc(..., {merge:true})` NUNCA borra un campo que ya existía en
    // Firestore si ese campo simplemente no viene en el objeto nuevo —
    // solo agrega/actualiza lo que sí viene. Por eso, si el cliente
    // desmarca un puesto del checklist, borra todas las filas de "Equipo
    // de medición", o deja en blanco un campo de texto que antes tenía
    // valor, el dato viejo se quedaba guardado para siempre (merge no
    // "ve" una ausencia como una instrucción de borrar). Se le pasan
    // aquí TODAS las claves que el formulario podría llegar a guardar
    // (`camposPosibles`) y, para las que no vengan en `datos` esta vez,
    // se marcan con `deleteField()` para que Firestore sí las quite.
    async function guardarCliente(id, datos, camposPosibles) {
        const { collection, doc, setDoc, serverTimestamp, deleteField } = await fsFns();
        const sis = sistemaActivo();
        const ref = id ? doc(window.db, sis.coleccion, id) : doc(collection(window.db, sis.coleccion));
        const payload = { ...datos, actualizado: serverTimestamp() };
        (camposPosibles || []).forEach(clave => {
            if (!(clave in payload)) payload[clave] = deleteField();
        });
        await setDoc(ref, payload, { merge: true });
        return ref.id;
    }

    // ESTILOS (tokens tomados de las variables CSS del portal)
    function inyectarEstilosGestoria() {
        if (document.getElementById('gestoria-estilos')) return;
        const style = document.createElement('style');
        style.id = 'gestoria-estilos';
        style.textContent = `
        #gestoria-dashboard{margin-left:240px;min-height:100vh;background:#f6f8fc;font-family:'DM Sans',sans-serif;}
        @media(max-width:900px){ #gestoria-dashboard{margin-left:200px;} }
        @media(max-width:768px){ #gestoria-dashboard{margin-left:0;} .gs-grid{grid-template-columns:1fr !important;} .gs-form-grid{grid-template-columns:1fr !important;} }

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
        #gestoria-dashboard .gs-rol-fila{display:grid;grid-template-columns:220px 1fr auto auto;align-items:center;gap:12px;padding:8px 10px;border-radius:10px;background:#fbfcfe;border:1px solid rgba(59,130,246,0.1);}
        #gestoria-dashboard .gs-rol-check{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text);}
        #gestoria-dashboard .gs-rol-check input[type="checkbox"]{width:16px;height:16px;accent-color:var(--teal);}
        #gestoria-dashboard .gs-rol-fila input[type="text"]{padding:9px 12px;border:1px solid rgba(59,130,246,0.16);border-radius:9px;font-size:13px;font-family:'DM Sans',sans-serif;color:var(--text);background:#fff;}
        #gestoria-dashboard .gs-rol-fila input[type="text"]:disabled{background:#f1f5f9;color:var(--text3);}
        #gestoria-dashboard .gs-equipo-fila{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed rgba(59,130,246,0.15);}
        #gestoria-dashboard .gs-btn-quitar-equipo{padding:9px 12px;color:#ef4444;font-weight:700;}
        #gestoria-dashboard .gs-rail-divisor{width:32px;height:1px;background:rgba(255,255,255,0.14);margin:8px 0;flex-shrink:0;}

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

        /* ── Editor visual del organigrama (mapa conceptual arrastrable) ── */
        .gs-orga-overlay{position:fixed;inset:0;z-index:200001;background:rgba(15,23,42,0);pointer-events:none;transition:background 0.22s ease;display:flex;align-items:center;justify-content:center;}
        .gs-orga-overlay.abierto{background:rgba(15,23,42,0.55);pointer-events:auto;}
        .gs-orga-panel{width:94vw;height:90vh;background:#fff;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden;transform:scale(0.96);opacity:0;transition:all 0.22s ease;}
        .gs-orga-overlay.abierto .gs-orga-panel{transform:scale(1);opacity:1;}
        .gs-orga-toolbar{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(59,130,246,0.12);flex-wrap:wrap;gap:10px;}
        .gs-orga-titulo{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:14.5px;color:#1e293b;display:flex;align-items:center;gap:8px;}
        .gs-orga-acciones{display:flex;gap:8px;flex-wrap:wrap;}
        .gs-orga-hint{padding:8px 18px;font-size:11.5px;color:var(--text3);background:#f8fafc;border-bottom:1px solid rgba(59,130,246,0.08);}
        .gs-orga-lienzo-wrap{flex:1;overflow:auto;position:relative;background-image:linear-gradient(90deg,rgba(59,130,246,0.06) 1px,transparent 1px),linear-gradient(rgba(59,130,246,0.06) 1px,transparent 1px);background-size:24px 24px;}
        .gs-orga-svg{position:absolute;top:0;left:0;pointer-events:none;}
        .gs-orga-lienzo{position:relative;min-width:100%;min-height:100%;}
        .gs-orga-nodo{position:absolute;background:#0f172a;border-radius:12px;padding:8px 12px 12px;box-shadow:0 4px 14px rgba(0,0,0,0.18);display:flex;flex-direction:column;gap:6px;}
        .gs-orga-nodo.gs-orga-nodo-origen{outline:2px solid #facc15;}
        .gs-orga-nodo-drag{cursor:grab;color:rgba(255,255,255,0.5);font-size:13px;text-align:center;user-select:none;}
        .gs-orga-nodo input,.gs-orga-nodo select{width:100%;padding:6px 8px;border-radius:7px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#fff;font-size:12px;font-family:'DM Sans',sans-serif;}
        .gs-orga-nodo input::placeholder{color:rgba(255,255,255,0.4);}
        .gs-orga-nodo select option{color:#0f172a;}
        .gs-orga-nodo-borrar{align-self:flex-end;background:none;border:none;color:rgba(255,255,255,0.5);cursor:pointer;font-size:12px;}
        .gs-orga-nodo-borrar:hover{color:#f87171;}

        /* ── Certificado TECNOLAB ─────────────────────────────────── */
        #gestoria-dashboard .gs-cert-seccion-titulo{font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:var(--teal2);margin:18px 0 10px;}
        #gestoria-dashboard .gs-cert-seccion-titulo:first-child{margin-top:0;}
        #gestoria-dashboard .gs-cert-resultado-fila{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:10px;align-items:end;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed rgba(59,130,246,0.15);}
        #gestoria-dashboard .gs-cert-preview-frame{border:1px solid rgba(59,130,246,0.12);background:#fff;}
        @media(max-width:768px){ #gestoria-dashboard .gs-cert-resultado-fila{grid-template-columns:1fr 1fr;} }
        `;
        document.head.appendChild(style);
    }

    // UI
    function renderRail() {
        return `
        <div class="gs-rail">
            <div class="gs-rail-logo">${ICONO.edificio}</div>
            ${SECCIONES_GESTORIA.map(s => `
                <button class="gs-rail-btn${_seccionActual === s.id ? ' activo' : ''}" data-seccion="${s.id}" ${s.activa ? '' : 'disabled'}>
                    ${s.id === 'sasisopa' ? ICONO.carpeta : s.id === 'sgm' ? ICONO.graduacion : s.id === 'bitacoras' ? ICONO.reloj : ICONO.certificado}
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

    // Panel flotante de la Parrilla de Documentos 
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
        if (sec.tipo === 'selector_rol_documento') {
            const valorActual = cliente[sec.clave] || '';
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div class="gs-subtitle" style="margin-bottom:10px;">Elige qué puesto de la organización del cliente debe aparecer ahí — se toma el nombre ya capturado en el organigrama de arriba.</div>
                    <div class="gs-field">
                        <label>Puesto</label>
                        <select data-clave="${sec.clave}" style="padding:10px 13px;border:1px solid rgba(59,130,246,0.16);border-radius:10px;font-size:13.5px;font-family:'DM Sans',sans-serif;color:var(--text);background:#fbfcfe;">
                            <option value="">Selecciona un puesto…</option>
                            ${sec.opciones.map(op => `<option value="${op.clave}" ${valorActual === op.clave ? 'selected' : ''}>${op.etiqueta}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>`;
        }
        if (sec.tipo === 'escolaridad_dinamica') {
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div class="gs-subtitle" style="margin-bottom:10px;">Solo aparecen los roles marcados en el organigrama de arriba.</div>
                    <div class="gs-grid">
                        ${sec.fuente.map(rol => {
                            const oculto = !cliente[rol.clave];
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
        if (sec.tipo === 'multiselect_por_frase') {
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div class="gs-subtitle" style="margin-bottom:10px;">Marca uno o más puestos responsables para cada proceso. Aplica a documentos donde antes solo se podía asignar un puesto.</div>
                    ${sec.fuente.map(frase => {
                        const seleccion = (cliente.MULTIPUESTO || {})[frase.id] || [];
                        const extra = (cliente.MULTIPUESTO_EXTRA || {})[frase.id] || '';
                        return `
                        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px dashed rgba(59,130,246,0.15);">
                            <div style="font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:8px;">${frase.etiqueta}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px;">
                                ${SGM_ROLES_DISPONIBLES.map(rol => `
                                    <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text2);">
                                        <input type="checkbox" data-multipuesto="${frase.id}" data-multipuesto-rol="${rol.clave}" ${seleccion.includes(rol.clave) ? 'checked' : ''}>
                                        ${rol.etiqueta}
                                    </label>`).join('')}
                            </div>
                            <input type="text" data-multipuesto-extra="${frase.id}" value="${extra}" placeholder="Agregar otro puesto o rol (opcional)" style="font-size:12.5px;padding:6px 10px;border:1px solid rgba(59,130,246,0.25);border-radius:8px;width:260px;max-width:100%;">
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }
        if (sec.tipo === 'checklist_con_nombre') {
            const extras = Array.isArray(cliente.ROLES_EXTRA) ? cliente.ROLES_EXTRA : [];
            return `
            <div class="gs-card">
                <div class="gs-card-header">
                    <span class="gs-card-icon">${sec.icono}</span>
                    <span class="gs-card-title">${sec.titulo}</span>
                    <button type="button" class="gs-btn gs-btn-secondary" id="gs-btn-editor-organigrama" style="margin-left:auto;font-size:12px;padding:8px 14px;">${ICONO.carpeta} Editor visual del organigrama</button>
                </div>
                <div class="gs-card-body">
                    <div class="gs-subtitle" style="margin-bottom:10px;">Marca los roles que existen en esta estación y el nombre de quien los ocupa. Si una persona cubre dos roles, marca ambos y repite el nombre.</div>
                    <div class="gs-checklist-roles" id="gs-roles-fijos">
                        ${sec.opciones.map(op => {
                            const valorActual = cliente[op.clave] || '';
                            const marcado = !!valorActual || op.obligatorio;
                            const conCatalogo = true;
                            const conGradoDropdown = _seccionActual === 'sgm';
                            return `
                            <div>
                                <div class="gs-rol-fila" data-rol="${op.clave}">
                                    <label class="gs-rol-check">
                                        <input type="checkbox" data-rol-check="${op.clave}" ${marcado ? 'checked' : ''} ${op.obligatorio ? 'disabled' : ''}>
                                        <span>${op.etiqueta}${op.obligatorio ? '<span class="gs-req">*</span>' : ''}</span>
                                    </label>
                                    <input type="text" data-clave="${op.clave}" placeholder="Nombre de quien ocupa este rol"
                                        value="${valorActual.replace(/"/g,'&quot;')}" ${marcado ? '' : 'disabled'}>
                                    ${conGradoDropdown ? `<select data-grado-estudios="${op.clave}" ${marcado ? '' : 'disabled'} style="font-size:11.5px;padding:8px 8px;border-radius:8px;border:1px solid rgba(59,130,246,0.16);">
                                        <option value="">Último grado de estudios</option>
                                        ${SGM_GRADOS_ESTUDIO.map(g => `<option value="${g}" ${((cliente.GRADO_ESTUDIOS||{})[op.clave] === g) ? 'selected' : ''}>${g}</option>`).join('')}
                                    </select>` : ''}
                                    ${conCatalogo ? `<button type="button" class="gs-btn gs-btn-ghost gs-btn-toggle-catalogo" data-rol-toggle="${op.clave}" style="font-size:11px;padding:6px 10px;white-space:nowrap;" ${marcado ? '' : 'disabled'}>Responsabilidades ▾</button>` : ''}
                                </div>
                                ${conCatalogo ? renderPanelCatalogo(op.clave, obtenerCatalogoPuesto(cliente, op.clave)) : ''}
                            </div>`;
                        }).join('')}
                    </div>
                    <div id="gs-roles-extra" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
                        ${extras.map((ex, idx) => `
                        <div data-idx="${idx}">
                            <div class="gs-rol-fila-extra" style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:center;">
                                <input type="text" data-rol-extra-etiqueta placeholder="Nombre del puesto" value="${(ex.etiqueta||'').replace(/"/g,'&quot;')}">
                                <input type="text" data-rol-extra-nombre placeholder="Nombre de quien lo ocupa" value="${(ex.nombre||'').replace(/"/g,'&quot;')}">
                                <button type="button" class="gs-btn gs-btn-ghost gs-btn-toggle-catalogo" data-rol-toggle="EXTRA_${idx}" style="font-size:11px;padding:6px 10px;white-space:nowrap;">Responsabilidades ▾</button>
                                <button type="button" class="gs-btn gs-btn-ghost gs-btn-quitar-rol-extra" title="Quitar este puesto">✕</button>
                            </div>
                            ${renderPanelCatalogo(`EXTRA_${idx}`, obtenerCatalogoPuesto(cliente, `EXTRA_${idx}`))}
                        </div>`).join('')}
                    </div>
                    <button type="button" id="gs-btn-add-rol" class="gs-btn gs-btn-ghost" style="margin-top:10px;">${ICONO.mas} Agregar nuevo puesto</button>
                </div>
            </div>`;
        }
        if (sec.tipo === 'tabla_dinamica') {
            const filas = Array.isArray(cliente[sec.clave]) && cliente[sec.clave].length ? cliente[sec.clave] : [{}];
            return `
            <div class="gs-card">
                <div class="gs-card-header"><span class="gs-card-icon">${sec.icono}</span><span class="gs-card-title">${sec.titulo}</span></div>
                <div class="gs-card-body">
                    <div id="gs-equipo-filas-${sec.clave}" data-clave-tabla="${sec.clave}">
                        ${filas.map((fila, idx) => renderFilaEquipo(sec.columnas, fila, idx)).join('')}
                    </div>
                    <button type="button" data-btn-add-equipo="${sec.clave}" class="gs-btn gs-btn-ghost" style="margin-top:10px;">${ICONO.mas} Agregar fila</button>
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

    const SGM_GRADOS_ESTUDIO = [
        "Sin estudios formales", "Primaria", "Secundaria",
        "Bachillerato/preparatoria trunca", "Bachillerato/preparatoria terminada",
        "Técnico o carrera técnica", "Licenciatura", "Maestría", "Doctorado",
    ];

    const CATS_CATALOGO_UI = [['responsabilidades', 'Responsabilidades'], ['funciones', 'Funciones'], ['autoridad', 'Autoridad'], ['interrelaciones', 'Interrelaciones']];

    function obtenerCatalogoPuesto(cliente, clave) {
        const guardado = (cliente.CATALOGO_PUESTOS || {})[clave];
        if (guardado) return guardado;
        const generico = sistemaActivo().catalogoGenerico[clave];
        const out = {};
        CATS_CATALOGO_UI.forEach(([k]) => { out[k] = generico ? (generico[k] || []).map(texto => ({ texto, incluido: true })) : []; });
        return out;
    }

    function renderPanelCatalogo(clave, catalogo) {
        return `<div class="gs-catalogo-puesto" data-rol-catalogo="${clave}" style="display:none;margin:6px 0 12px 0;padding:12px 14px;background:#f8fafc;border-radius:10px;border:1px solid rgba(59,130,246,0.12);">
            ${CATS_CATALOGO_UI.map(([key, label]) => `
            <div style="margin-bottom:12px;">
                <div style="font-size:11.5px;font-weight:700;color:var(--text2);margin-bottom:6px;">${label}</div>
                <div class="gs-catalogo-items" data-cat="${key}">
                    ${(catalogo[key] || []).map(item => `
                    <div class="gs-catalogo-item" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px;">
                        <input type="checkbox" data-item-incluido ${item.incluido !== false ? 'checked' : ''} style="margin-top:5px;flex-shrink:0;">
                        <textarea data-item-texto rows="1" style="flex:1;font-size:12px;padding:6px 8px;border:1px solid rgba(59,130,246,0.16);border-radius:6px;resize:vertical;font-family:'DM Sans',sans-serif;">${(item.texto || '').replace(/</g, '&lt;')}</textarea>
                        <button type="button" class="gs-btn gs-btn-ghost gs-btn-quitar-item" style="padding:4px 9px;flex-shrink:0;">✕</button>
                    </div>`).join('')}
                </div>
                <button type="button" class="gs-btn gs-btn-ghost gs-btn-add-item" data-cat="${key}" style="font-size:11px;padding:4px 10px;">+ agregar</button>
            </div>`).join('')}
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
        const btnEditorOrga = cont.querySelector('#gs-btn-editor-organigrama');
        if (btnEditorOrga) btnEditorOrga.addEventListener('click', () => abrirEditorOrganigrama(cont));

        cont.querySelectorAll('[data-multipuesto]').forEach(chk => {
            chk.addEventListener('change', () => actualizarPreview(cont));
        });

        cont.querySelectorAll('[data-multipuesto-extra]').forEach(inp => {
            inp.addEventListener('input', () => actualizarPreview(cont));
        });

        cont.querySelectorAll('.gs-rol-fila').forEach(fila => {
            const check = fila.querySelector('input[type="checkbox"]');
            const texto = fila.querySelector('input[type="text"]');
            const btnCatalogo = fila.querySelector('.gs-btn-toggle-catalogo');
            const selectGrado = fila.querySelector('[data-grado-estudios]');
            check.addEventListener('change', () => {
                texto.disabled = !check.checked;
                if (!check.checked) texto.value = '';
                if (btnCatalogo) btnCatalogo.disabled = !check.checked;
                if (selectGrado) selectGrado.disabled = !check.checked;
                cont.querySelectorAll(`[data-depende-de="${fila.dataset.rol}"]`).forEach(campo => {
                    campo.style.display = check.checked ? '' : 'none';
                    if (!check.checked) { const inp = campo.querySelector('input'); if (inp) inp.value = ''; }
                });
                actualizarPreview(cont);
            });
        });
        function bindToggleCatalogo(btn) {
            btn.addEventListener('click', () => {
                const panel = cont.querySelector(`.gs-catalogo-puesto[data-rol-catalogo="${btn.dataset.rolToggle}"]`);
                if (!panel) return;
                const visible = panel.style.display !== 'none';
                panel.style.display = visible ? 'none' : '';
                btn.textContent = visible ? 'Responsabilidades ▾' : 'Responsabilidades ▴';
            });
        }
        function bindPanelCatalogo(panel) {
            const nuevaFilaItem = () => `<div class="gs-catalogo-item" style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px;">
                <input type="checkbox" data-item-incluido checked style="margin-top:5px;flex-shrink:0;">
                <textarea data-item-texto rows="1" style="flex:1;font-size:12px;padding:6px 8px;border:1px solid rgba(59,130,246,0.16);border-radius:6px;resize:vertical;font-family:'DM Sans',sans-serif;"></textarea>
                <button type="button" class="gs-btn gs-btn-ghost gs-btn-quitar-item" style="padding:4px 9px;flex-shrink:0;">✕</button>
            </div>`;
            const bindQuitar = () => {
                panel.querySelectorAll('.gs-btn-quitar-item').forEach(b => {
                    b.onclick = () => { b.closest('.gs-catalogo-item').remove(); };
                });
            };
            panel.querySelectorAll('.gs-btn-add-item').forEach(btnAdd => {
                btnAdd.onclick = () => {
                    const lista = panel.querySelector(`.gs-catalogo-items[data-cat="${btnAdd.dataset.cat}"]`);
                    lista.insertAdjacentHTML('beforeend', nuevaFilaItem());
                    bindQuitar();
                };
            });
            bindQuitar();
        }
        cont.querySelectorAll('.gs-btn-toggle-catalogo').forEach(bindToggleCatalogo);
        cont.querySelectorAll('.gs-catalogo-puesto').forEach(bindPanelCatalogo);
        const contRolesExtra = cont.querySelector('#gs-roles-extra');
        const btnAddRol = cont.querySelector('#gs-btn-add-rol');
        if (contRolesExtra && btnAddRol) {
            const reindexarRoles = () => {
                contRolesExtra.querySelectorAll('.gs-rol-fila-extra').forEach((f, i) => f.dataset.idx = i);
                contRolesExtra.querySelectorAll('.gs-btn-quitar-rol-extra').forEach(b => {
                    b.onclick = () => { b.closest('.gs-rol-fila-extra').remove(); reindexarRoles(); actualizarPreview(cont); };
                });
                contRolesExtra.querySelectorAll('input').forEach(inp => { inp.oninput = () => actualizarPreview(cont); });
            };
            btnAddRol.addEventListener('click', () => {
                const idx = contRolesExtra.children.length;
                contRolesExtra.insertAdjacentHTML('beforeend', `
                    <div data-idx="${idx}">
                        <div class="gs-rol-fila-extra" style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:center;">
                            <input type="text" data-rol-extra-etiqueta placeholder="Nombre del puesto">
                            <input type="text" data-rol-extra-nombre placeholder="Nombre de quien lo ocupa">
                            <button type="button" class="gs-btn gs-btn-ghost gs-btn-toggle-catalogo" data-rol-toggle="EXTRA_${idx}" style="font-size:11px;padding:6px 10px;white-space:nowrap;">Responsabilidades ▾</button>
                            <button type="button" class="gs-btn gs-btn-ghost gs-btn-quitar-rol-extra" title="Quitar este puesto">✕</button>
                        </div>
                        ${renderPanelCatalogo(`EXTRA_${idx}`, { responsabilidades: [], funciones: [], autoridad: [], interrelaciones: [] })}
                    </div>`);
                reindexarRoles();
                const nuevoToggle = contRolesExtra.querySelector(`.gs-btn-toggle-catalogo[data-rol-toggle="EXTRA_${idx}"]`);
                const nuevoPanel = contRolesExtra.querySelector(`.gs-catalogo-puesto[data-rol-catalogo="EXTRA_${idx}"]`);
                if (nuevoToggle) bindToggleCatalogo(nuevoToggle);
                if (nuevoPanel) bindPanelCatalogo(nuevoPanel);
            });
            reindexarRoles();
        }
        const seccionesTabla = sistemaActivo().seccionesForm.filter(s => s.tipo === 'tabla_dinamica');
        seccionesTabla.forEach(sec => {
            const contEquipo = cont.querySelector(`#gs-equipo-filas-${sec.clave}`);
            const btnAdd = cont.querySelector(`[data-btn-add-equipo="${sec.clave}"]`);
            if (!contEquipo || !btnAdd) return;
            const columnas = sec.columnas;
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
        });
    }

    // EDITOR VISUAL DEL ORGANIGRAMA (mapa conceptual arrastrable)
    function nodosDesdeChecklist(cont) {
        const sis = sistemaActivo();
        const nodos = [];
        let i = 0;
        const porFila = 4;
        cont.querySelectorAll('.gs-rol-fila').forEach(fila => {
            const check = fila.querySelector('input[type="checkbox"]');
            if (!check.checked) return;
            const clave = fila.dataset.rol;
            const spanEtiqueta = fila.querySelector('.gs-rol-check span');
            const texto = (spanEtiqueta ? spanEtiqueta.textContent : clave).replace('*', '').trim();
            const nombre = (fila.querySelector('input[type="text"]') || {}).value || '';
            nodos.push({ id: 'rol_' + clave, texto, nombre, x: 60 + (i % porFila) * 260, y: 60 + Math.floor(i / porFila) * 160, w: 220, padre: '', clave });
            i++;
        });
        const contRolesExtra = cont.querySelector('#gs-roles-extra');
        if (contRolesExtra) {
            Array.from(contRolesExtra.querySelectorAll('.gs-rol-fila-extra')).forEach((fila, idx) => {
                const texto = (fila.querySelector('[data-rol-extra-etiqueta]') || {}).value || 'Puesto';
                const nombre = (fila.querySelector('[data-rol-extra-nombre]') || {}).value || '';
                if (!texto.trim() && !nombre.trim()) return;
                nodos.push({ id: 'extra_' + idx, texto, nombre, x: 60 + (i % porFila) * 260, y: 60 + Math.floor(i / porFila) * 160, w: 220, padre: '' });
                i++;
            });
        }
        const jerarquia = sis.jerarquiaOrganigrama || [];
        const nivelDeClave = {};
        jerarquia.forEach((nivel, iNivel) => nivel.forEach(clave => { nivelDeClave[clave] = iNivel; }));
        nodos.forEach(n => {
            if (n.clave && nivelDeClave[n.clave] > 0) {
                const clavePadre = (jerarquia[nivelDeClave[n.clave] - 1] || [])[0];
                const nodoPadre = nodos.find(x => x.clave === clavePadre);
                if (nodoPadre) n.padre = nodoPadre.id;
            }
        });
        const porNivel = {};
        nodos.forEach(n => {
            const nivel = (n.clave && nivelDeClave[n.clave] !== undefined) ? nivelDeClave[n.clave] : jerarquia.length;
            (porNivel[nivel] = porNivel[nivel] || []).push(n);
        });
        Object.keys(porNivel).sort((a, b) => a - b).forEach(nivel => {
            porNivel[nivel].forEach((n, idx) => { n.x = 60 + idx * 260; n.y = 60 + Number(nivel) * 160; });
        });
        return nodos;
    }

    function abrirEditorOrganigrama(cont) {
        const sis = sistemaActivo();
        if (!_organigramaCanvas || !Array.isArray(_organigramaCanvas.nodos)) {
            _organigramaCanvas = { nodos: [], conectores: [] };
        }
        if (!_organigramaCanvas.nodos.length) {
            _organigramaCanvas.nodos = nodosDesdeChecklist(cont);
        }
        _orgaIdSeq = _organigramaCanvas.nodos.reduce((m, n) => {
            const num = parseInt((n.id || '').replace(/\D/g, ''), 10);
            return isNaN(num) ? m : Math.max(m, num + 1);
        }, 1);
        _orgaModoConector = false;
        _orgaConectorOrigen = null;

        let overlay = document.getElementById('gs-orga-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'gs-orga-overlay';
            overlay.className = 'gs-orga-overlay';
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div class="gs-orga-panel">
                <div class="gs-orga-toolbar">
                    <span class="gs-orga-titulo">${ICONO.usuarios} Editor visual del organigrama — ${sis.nombre}</span>
                    <div class="gs-orga-acciones">
                        <button type="button" class="gs-btn gs-btn-secondary" id="gs-orga-cargar-checklist">${ICONO.mas} Cargar desde checklist</button>
                        <button type="button" class="gs-btn gs-btn-secondary" id="gs-orga-add-recuadro">${ICONO.mas} Recuadro en blanco</button>
                        <button type="button" class="gs-btn gs-btn-secondary" id="gs-orga-modo-conector">${ICONO.flecha} Conectar recuadros</button>
                        <button type="button" class="gs-btn gs-btn-primary" id="gs-orga-guardar">${ICONO.check} Guardar organigrama</button>
                        <button type="button" class="gs-btn gs-btn-ghost" id="gs-orga-cerrar">${ICONO.cerrar}</button>
                    </div>
                </div>
                <div class="gs-orga-hint" id="gs-orga-hint">Arrastra los recuadros por el icono ⠿ para acomodarlos. Usa "Reporta a" dentro del recuadro para conectarlo automáticamente a su jefe, o el botón "Conectar recuadros" para dibujar una línea libre entre dos recuadros cualesquiera.</div>
                <div class="gs-orga-lienzo-wrap" id="gs-orga-lienzo-wrap">
                    <svg class="gs-orga-svg" id="gs-orga-svg"></svg>
                    <div class="gs-orga-lienzo" id="gs-orga-lienzo"></div>
                </div>
            </div>`;
        requestAnimationFrame(() => overlay.classList.add('abierto'));

        overlay.querySelector('#gs-orga-cerrar').addEventListener('click', () => overlay.classList.remove('abierto'));
        overlay.querySelector('#gs-orga-cargar-checklist').addEventListener('click', () => {
            const existentes = new Set(_organigramaCanvas.nodos.map(n => n.id));
            const nuevos = nodosDesdeChecklist(cont).filter(n => !existentes.has(n.id));
            _organigramaCanvas.nodos.push(...nuevos);
            renderLienzoOrganigrama();
        });
        overlay.querySelector('#gs-orga-add-recuadro').addEventListener('click', () => {
            const id = 'manual_' + (_orgaIdSeq++);
            _organigramaCanvas.nodos.push({ id, texto: 'Puesto', nombre: '', x: 80, y: 80, w: 220, padre: '' });
            renderLienzoOrganigrama();
        });
        const btnConector = overlay.querySelector('#gs-orga-modo-conector');
        btnConector.addEventListener('click', () => {
            _orgaModoConector = !_orgaModoConector;
            _orgaConectorOrigen = null;
            const hint = overlay.querySelector('#gs-orga-hint');
            hint.textContent = _orgaModoConector
                ? 'Modo conectar: haz clic en el primer recuadro y luego en el segundo para unirlos con una línea libre. Vuelve a pulsar "Conectar recuadros" para salir del modo.'
                : 'Arrastra los recuadros por el icono ⠿ para acomodarlos. Usa "Reporta a" dentro del recuadro para conectarlo automáticamente a su jefe, o el botón "Conectar recuadros" para dibujar una línea libre entre dos recuadros cualesquiera.';
            renderLienzoOrganigrama();
        });
        overlay.querySelector('#gs-orga-guardar').addEventListener('click', () => {
            actualizarPreview(cont);
            overlay.classList.remove('abierto');
        });

        renderLienzoOrganigrama();
    }

    function renderLienzoOrganigrama() {
        const lienzo = document.getElementById('gs-orga-lienzo');
        if (!lienzo) return;
        lienzo.innerHTML = _organigramaCanvas.nodos.map(nodo => `
            <div class="gs-orga-nodo${_orgaConectorOrigen === nodo.id ? ' gs-orga-nodo-origen' : ''}" data-id="${nodo.id}" style="left:${nodo.x}px;top:${nodo.y}px;width:${nodo.w}px;">
                <div class="gs-orga-nodo-drag" title="Arrastrar">⠿</div>
                <input type="text" class="gs-orga-nodo-texto" data-campo="texto" value="${(nodo.texto || '').replace(/"/g, '&quot;')}" placeholder="Puesto">
                <input type="text" class="gs-orga-nodo-nombre" data-campo="nombre" value="${(nodo.nombre || '').replace(/"/g, '&quot;')}" placeholder="Nombre de quien ocupa">
                <select class="gs-orga-nodo-padre" data-campo="padre">
                    <option value="">Sin jefe (raíz)</option>
                    ${_organigramaCanvas.nodos.filter(n => n.id !== nodo.id).map(n => `<option value="${n.id}" ${nodo.padre === n.id ? 'selected' : ''}>${(n.texto || 'Puesto').slice(0, 28)}</option>`).join('')}
                </select>
                <select class="gs-orga-nodo-padre-secundario" data-campo="padreSecundario">
                    <option value="">Reporta también a... (opcional)</option>
                    ${_organigramaCanvas.nodos.filter(n => n.id !== nodo.id && n.id !== nodo.padre).map(n => `<option value="${n.id}" ${nodo.padreSecundario === n.id ? 'selected' : ''}>${(n.texto || 'Puesto').slice(0, 28)}</option>`).join('')}
                </select>
                <button type="button" class="gs-orga-nodo-borrar" title="Quitar recuadro">✕</button>
            </div>`).join('');
        lienzo.querySelectorAll('.gs-orga-nodo').forEach(el => bindNodoOrganigrama(el));
        dibujarConectoresOrganigrama();
    }

    function bindNodoOrganigrama(el) {
        const id = el.dataset.id;
        const nodo = _organigramaCanvas.nodos.find(n => n.id === id);
        if (!nodo) return;

        el.querySelector('[data-campo="texto"]').addEventListener('input', (e) => {
            nodo.texto = e.target.value;
            document.querySelectorAll('.gs-orga-nodo-padre').forEach(sel => {
                const opt = sel.querySelector(`option[value="${id}"]`);
                if (opt) opt.textContent = (nodo.texto || 'Puesto').slice(0, 28);
            });
        });
        el.querySelector('[data-campo="nombre"]').addEventListener('input', (e) => { nodo.nombre = e.target.value; });
        el.querySelector('[data-campo="padre"]').addEventListener('change', (e) => {
            nodo.padre = e.target.value;
            if (nodo.padreSecundario === nodo.padre) nodo.padreSecundario = '';
            renderLienzoOrganigrama();
        });
        const selPadreSecundario = el.querySelector('[data-campo="padreSecundario"]');
        if (selPadreSecundario) {
            selPadreSecundario.addEventListener('change', (e) => { nodo.padreSecundario = e.target.value; dibujarConectoresOrganigrama(); });
        }
        el.querySelector('.gs-orga-nodo-borrar').addEventListener('click', () => {
            _organigramaCanvas.nodos = _organigramaCanvas.nodos.filter(n => n.id !== id);
            _organigramaCanvas.nodos.forEach(n => {
                if (n.padre === id) n.padre = '';
                if (n.padreSecundario === id) n.padreSecundario = '';
            });
            _organigramaCanvas.conectores = (_organigramaCanvas.conectores || []).filter(c => c.a !== id && c.b !== id);
            renderLienzoOrganigrama();
        });

        el.addEventListener('click', (e) => {
            if (!_orgaModoConector || e.target.closest('input,select,button')) return;
            if (!_orgaConectorOrigen) {
                _orgaConectorOrigen = id;
                renderLienzoOrganigrama();
            } else if (_orgaConectorOrigen !== id) {
                const existe = (_organigramaCanvas.conectores || []).some(c =>
                    (c.a === _orgaConectorOrigen && c.b === id) || (c.a === id && c.b === _orgaConectorOrigen));
                if (!existe) {
                    _organigramaCanvas.conectores = _organigramaCanvas.conectores || [];
                    _organigramaCanvas.conectores.push({ a: _orgaConectorOrigen, b: id });
                }
                _orgaConectorOrigen = null;
                renderLienzoOrganigrama();
            }
        });

        const asa = el.querySelector('.gs-orga-nodo-drag');
        asa.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            const lienzo = document.getElementById('gs-orga-lienzo');
            const rectLienzo = lienzo.getBoundingClientRect();
            _orgaArrastre = { id, offsetX: e.clientX - rectLienzo.left - nodo.x, offsetY: e.clientY - rectLienzo.top - nodo.y };
            const mover = (ev) => {
                if (!_orgaArrastre) return;
                nodo.x = Math.max(0, ev.clientX - rectLienzo.left - _orgaArrastre.offsetX);
                nodo.y = Math.max(0, ev.clientY - rectLienzo.top - _orgaArrastre.offsetY);
                el.style.left = nodo.x + 'px';
                el.style.top = nodo.y + 'px';
                dibujarConectoresOrganigrama();
            };
            const soltar = () => {
                _orgaArrastre = null;
                document.removeEventListener('pointermove', mover);
                document.removeEventListener('pointerup', soltar);
            };
            document.addEventListener('pointermove', mover);
            document.addEventListener('pointerup', soltar);
        });
    }

    function dibujarConectoresOrganigrama() {
        const svg = document.getElementById('gs-orga-svg');
        const lienzo = document.getElementById('gs-orga-lienzo');
        if (!svg || !lienzo) return;
        const ALTO_NODO_PX = 90;
        const porId = {};
        _organigramaCanvas.nodos.forEach(n => porId[n.id] = n);
        const centroAbajo = n => ({ x: n.x + n.w / 2, y: n.y + ALTO_NODO_PX });
        const centroArriba = n => ({ x: n.x + n.w / 2, y: n.y });
        const centro = n => ({ x: n.x + n.w / 2, y: n.y + ALTO_NODO_PX / 2 });

        let lineasHtml = '';
        _organigramaCanvas.nodos.forEach(n => {
            if (n.padre && porId[n.padre]) lineasHtml += trazoElbowSvg(centroAbajo(porId[n.padre]), centroArriba(n), '#2563eb', false);
            if (n.padreSecundario && porId[n.padreSecundario]) lineasHtml += trazoElbowSvg(centro(porId[n.padreSecundario]), centro(n), '#0ea5e9', true);
        });
        (_organigramaCanvas.conectores || []).forEach(c => {
            const a = porId[c.a], b = porId[c.b];
            if (a && b) lineasHtml += trazoElbowSvg(centro(a), centro(b), '#64748b', true);
        });

        const maxX = Math.max(600, ..._organigramaCanvas.nodos.map(n => n.x + n.w + 60));
        const maxY = Math.max(400, ..._organigramaCanvas.nodos.map(n => n.y + ALTO_NODO_PX + 60));
        svg.setAttribute('width', maxX);
        svg.setAttribute('height', maxY);
        lienzo.style.width = maxX + 'px';
        lienzo.style.height = maxY + 'px';
        svg.innerHTML = lineasHtml;
    }

    function trazoElbowSvg(a, b, color, punteado) {
        const dash = punteado ? 'stroke-dasharray="5,4"' : '';
        if (Math.abs(a.x - b.x) < 4) {
            return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="2" ${dash}/>`;
        }
        const yMedio = a.y + (b.y - a.y) / 2;
        return `<line x1="${a.x}" y1="${a.y}" x2="${a.x}" y2="${yMedio}" stroke="${color}" stroke-width="2" ${dash}/>` +
               `<line x1="${a.x}" y1="${yMedio}" x2="${b.x}" y2="${yMedio}" stroke="${color}" stroke-width="2" ${dash}/>` +
               `<line x1="${b.x}" y1="${yMedio}" x2="${b.x}" y2="${b.y}" stroke="${color}" stroke-width="2" ${dash}/>`;
    }

    function renderFormularioCliente(cont, clienteId) {
        _clienteActualId = clienteId;
        const sis = sistemaActivo();
        const cliente = clienteId ? (_clientesCache.find(c => c.id === clienteId) || {}) : {};
        _logoDataUrlActual = cliente.LOGO_BASE64 || null;
        _firmasDataUrlActual = {
            ELABORA: cliente.FIRMA_ELABORA_BASE64 || null,
            REVISO: cliente.FIRMA_REVISO_BASE64 || null,
            APRUEBA: cliente.FIRMA_APRUEBA_BASE64 || null,
        };
        _organigramaCanvas = cliente.ORGANIGRAMA_CANVAS ? JSON.parse(JSON.stringify(cliente.ORGANIGRAMA_CANVAS)) : null;

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

                        <div class="gs-card" style="${_seccionActual === 'bitacoras' ? 'display:none;' : ''}">
                            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.imagen}</span><span class="gs-card-title">Firmas de control</span></div>
                            <div class="gs-card-body">
                                ${['ELABORA', 'REVISO', 'APRUEBA'].map(rol => `
                                <div style="margin-bottom:12px;">
                                    <label style="font-size:11.5px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">${rol === 'ELABORA' ? 'Elaboró' : rol === 'REVISO' ? 'Revisó' : 'Aprobó / Autorizó'}</label>
                                    <div id="gs-dropzone-firma-${rol}" class="gs-dropzone" style="min-height:56px;padding:8px;">
                                        <input type="file" id="gs-input-firma-${rol}" accept="image/png,image/jpeg" style="display:none;">
                                        <div id="gs-dropzone-firma-${rol}-contenido"></div>
                                    </div>
                                </div>`).join('')}
                                <div class="gs-subtitle" style="font-size:11px;">${_seccionActual === 'sgm' ? 'Se insertan en la tabla de firmas de las hojas Excel (SOFT-G/SOFT-T) y en la tabla de control del documento Word.' : 'Se insertan en la tabla de control (Elabora/Revisa/Autoriza) de cada machote Word.'} PNG con fondo transparente recomendado.</div>
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
        cont.querySelectorAll('#gs-columna-form input[data-clave], #gs-columna-form input[data-equipo-campo], #gs-columna-form select[data-clave]').forEach(inp => {
            inp.addEventListener('input', () => actualizarPreview(cont));
        });
        cont.querySelector('#gs-btn-volver').addEventListener('click', cargarGestoria);
        cont.querySelector('#gs-btn-guardar').addEventListener('click', async () => {
            const datos = leerFormulario(cont);
            const id = await guardarCliente(_clienteActualId, datos, calcularCamposPosiblesDelFormulario(cont));
            _clienteActualId = id;
            mostrarProgreso(cont, 'ok', ICONO.check + ' Guardado correctamente.');
        });
        cont.querySelector('#gs-btn-generar').addEventListener('click', () => generarDocumentos(cont));
    }

    function renderDropzone(cont) {
        renderDropzoneGenerico(cont, '#gs-dropzone', '#gs-input-logo', '#gs-dropzone-contenido',
            () => _logoDataUrlActual, v => _logoDataUrlActual = v,
            'Arrastra el logo aquí', 'o haz clic para seleccionar — PNG o JPG', 'Cambiar logotipo', 'gs-logo-preview');

        // Las firmas de control (Elabora/Revisa/Autoriza·Aprueba) aplican a
        // ambos sistemas: SASISOPA y SGM comparten el mismo patrón de tabla
        // de control de documentos dentro de los machotes .docx.
        ['ELABORA', 'REVISO', 'APRUEBA'].forEach(rol => {
            renderDropzoneGenerico(cont, `#gs-dropzone-firma-${rol}`, `#gs-input-firma-${rol}`, `#gs-dropzone-firma-${rol}-contenido`,
                () => _firmasDataUrlActual[rol], v => _firmasDataUrlActual[rol] = v,
                'Arrastra la firma aquí', 'PNG o JPG', 'Cambiar firma', 'gs-firma-preview');
        });
    }

    function renderDropzoneGenerico(cont, selDz, selInput, selContenido, obtener, asignar, tituloVacio, subVacio, tituloConImagen, claseImg) {
        const dz = cont.querySelector(selDz);
        const contenido = cont.querySelector(selContenido);
        const input = cont.querySelector(selInput);
        if (!dz || !contenido || !input) return;

        function pintar() {
            const actual = obtener();
            contenido.innerHTML = actual
                ? `<div class="${claseImg}"><img src="${actual}" style="max-height:34px;max-width:100%;"><span style="font-size:11px;color:var(--teal2);font-weight:700;">${tituloConImagen}</span></div>`
                : `${ICONO.imagen}<div class="gs-dz-titulo" style="font-size:12px;">${tituloVacio}</div><div class="gs-dz-sub" style="font-size:10.5px;">${subVacio}</div>`;
        }
        pintar();

        dz.addEventListener('click', () => input.click());
        dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('gs-dragover'); });
        dz.addEventListener('dragleave', () => dz.classList.remove('gs-dragover'));
        dz.addEventListener('drop', async (e) => {
            e.preventDefault(); dz.classList.remove('gs-dragover');
            if (e.dataTransfer.files[0]) { asignar(await redimensionarImagen(e.dataTransfer.files[0])); pintar(); }
        });
        input.addEventListener('change', async () => {
            if (input.files[0]) { asignar(await redimensionarImagen(input.files[0])); pintar(); }
        });
    }

    function actualizarPreview(cont) {
        const datos = leerFormulario(cont);
        const body = cont.querySelector('#gs-preview-body');
        if (!body) return;
        let filas;
        if (_seccionActual === 'sgm') {
            filas = [
                ['Razón Social', datos.NOMBRE_REPRESENTANTE],
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
        cont.querySelectorAll('#gs-columna-form select[data-clave]').forEach(sel => {
            if (sel.disabled || !sel.value) return;
            datos[sel.dataset.clave] = sel.value;
        });
        cont.querySelectorAll('[data-clave-tabla]').forEach(contTabla => {
            const claveTabla = contTabla.dataset.claveTabla;
            const filas = Array.from(contTabla.querySelectorAll('.gs-equipo-fila')).map(fila => {
                const obj = {};
                fila.querySelectorAll('input[data-equipo-campo]').forEach(inp => { obj[inp.dataset.equipoCampo] = inp.value.trim(); });
                return obj;
            }).filter(e => Object.values(e).some(v => v));
            if (filas.length) datos[claveTabla] = filas;
        });
        const contRolesExtra = cont.querySelector('#gs-roles-extra');
        if (contRolesExtra) {
            const roles = Array.from(contRolesExtra.querySelectorAll('.gs-rol-fila-extra')).map(fila => ({
                etiqueta: (fila.querySelector('[data-rol-extra-etiqueta]') || {}).value?.trim() || '',
                nombre: (fila.querySelector('[data-rol-extra-nombre]') || {}).value?.trim() || '',
            })).filter(r => r.etiqueta || r.nombre);
            if (roles.length) datos.ROLES_EXTRA = roles;
        }
        const grados = {};
        cont.querySelectorAll('[data-grado-estudios]').forEach(sel => {
            if (!sel.disabled && sel.value) grados[sel.dataset.gradoEstudios] = sel.value;
        });
        if (Object.keys(grados).length) datos.GRADO_ESTUDIOS = grados;

        const multipuesto = {};
        cont.querySelectorAll('[data-multipuesto]').forEach(chk => {
            if (!chk.checked) return;
            const fraseId = chk.dataset.multipuesto;
            (multipuesto[fraseId] = multipuesto[fraseId] || []).push(chk.dataset.multipuestoRol);
        });
        if (Object.keys(multipuesto).length) datos.MULTIPUESTO = multipuesto;

        const multipuestoExtra = {};
        cont.querySelectorAll('[data-multipuesto-extra]').forEach(inp => {
            const valor = (inp.value || '').trim();
            if (valor) multipuestoExtra[inp.dataset.multipuestoExtra] = valor;
        });
        if (Object.keys(multipuestoExtra).length) datos.MULTIPUESTO_EXTRA = multipuestoExtra;

        const catalogos = {};
        cont.querySelectorAll('.gs-catalogo-puesto').forEach(panel => {
            const clave = panel.dataset.rolCatalogo;
            const cats = {};
            panel.querySelectorAll('.gs-catalogo-items').forEach(lista => {
                const cat = lista.dataset.cat;
                cats[cat] = Array.from(lista.querySelectorAll('.gs-catalogo-item')).map(fila => ({
                    texto: (fila.querySelector('[data-item-texto]') || {}).value?.trim() || '',
                    incluido: !!(fila.querySelector('[data-item-incluido]') || {}).checked,
                })).filter(it => it.texto);
            });
            catalogos[clave] = cats;
        });
        if (Object.keys(catalogos).length) datos.CATALOGO_PUESTOS = catalogos;
        if (_logoDataUrlActual) datos.LOGO_BASE64 = _logoDataUrlActual;
        if (_firmasDataUrlActual.ELABORA) datos.FIRMA_ELABORA_BASE64 = _firmasDataUrlActual.ELABORA;
        if (_firmasDataUrlActual.REVISO) datos.FIRMA_REVISO_BASE64 = _firmasDataUrlActual.REVISO;
        if (_firmasDataUrlActual.APRUEBA) datos.FIRMA_APRUEBA_BASE64 = _firmasDataUrlActual.APRUEBA;
        if (_organigramaCanvas && Array.isArray(_organigramaCanvas.nodos) && _organigramaCanvas.nodos.length) {
            datos.ORGANIGRAMA_CANVAS = _organigramaCanvas;
        }
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

        const id = await guardarCliente(_clienteActualId, datos, calcularCamposPosiblesDelFormulario(cont));
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
                } else if (nombreArchivo.toLowerCase().endsWith('.xlsx') && _seccionActual === 'sgm') {
                    const ctxImg = { contador: 0 };
                    const blobSalida = await procesarXlsxSGM(buffer, datos, stats, ctxImg);
                    zipSalida.file(nombreArchivo, blobSalida);
                } else if (nombreArchivo.toLowerCase().endsWith('.xlsx')) {
                    const ctxImg = { contador: 0 };
                    const blobSalida = await procesarXlsxSASISOPA(buffer, datos, stats, ctxImg, nombreArchivo);
                    zipSalida.file(nombreArchivo, blobSalida);
                } else {
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
                'se reemplaza automáticamente por el generado en el editor visual o,',
                'si no se guardó ninguno, por la jerarquía calculada de forma automática.',
                '',
                'RECORDATORIO: si algún "pendiente" de la lista de arriba es un título',
                'de puesto usado como referencia institucional (p.ej. "Alta Dirección"',
                'dentro de una oración narrativa), es correcto que se haya dejado tal',
                'cual — no se sustituye por el nombre de la persona en esos casos.',
            ] : sis.id === 'bitacoras' ? [
                'RECORDATORIO: "Persona Responsable" y "Firma" se dejan en blanco a',
                'propósito en los 9 machotes — los llena el operador al usar la',
                'bitácora, no son datos de configuración del cliente.',
                '',
                'RECORDATORIO: el logo se inserta donde vivía la insignia de',
                '"Servicio Chavo" en el encabezado de cada machote (no requiere',
                'el texto "LOGO" resaltado, a diferencia de SASISOPA/SGM).',
            ] : [
                'RECORDATORIO: las hojas .xlsx (SOFT-) se copiaron sin personalizar la',
                'hoja "Control" — pendiente de implementar.',
                '',
                'RECORDATORIO: PROC-G-003/004/005/008 ahora usan los puestos elegidos',
                'en "Puestos responsables de procesos específicos"; PROC-T-003/004',
                'conservan su diagrama original (no se les pone el organigrama);',
                'PROC-T-001 siempre lista todos los puestos en su índice; y en',
                'PROC-G-007 el puesto inmediato después de Alta Dirección se calcula',
                'de forma dinámica según el organigrama real del cliente.',
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

    // CERTIFICADO TECNOLAB — llenado y exportación (PDF / Word / XML)
    // ══════════════════════════════════════════════════════════
    // A diferencia de SASISOPA/SGM (que personalizan machotes .docx
    // existentes por cliente y guardan un directorio en Firestore),
    // este sistema NO gestiona una lista de clientes ni persiste nada:
    // es una sola pantalla de llenado que reproduce el diseño fijo del
    // Certificado de Calibración de TECNOLAB y lo exporta en el acto.
    // Recargar la página pierde lo capturado — es intencional.

    const TECNOLAB_LOGO_B64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABOAAAAInCAYAAAAxhiZGAAAACXBIWXMAAAsSAAALEgHS3X78AAAgAElEQVR4nOzdPW7b2BrGcc7FdCqcuwJ7VmAPuAArgPpoABXqLJeqoqwgygqiVCojdyoEjNwLiLwAYewVjL2CGxWqc3E8DzO0rA9+HJKH5P8HGLlzE9sSJVLkw/e87y8/fvzwAFRXw+82Q0/ujed5F3ue7KG/i+q753n3O/7t9v//uFlNH3nbAQAAAADqgAAOKKGG3z3zPO9sKzS70H8blyV6VutQOPeoL2OpP+83q+n3gh4bAAAAAACpEcABjlLlWhCwnYW+Tmv6mj2EKum+K6D7vllNd1XcAQAAAADgDAI4oEChSrZw2Ga+TnhdYnlS5dwyqKLbrKZLiz8fAAAAAIDECOCAnKiiLahmI2jLx5Mq5n5+0XsOAAAAAJA3AjggA6GwLfg6Zzs7I+g5t9QXPeYAAAAAAJkigANSavjdIGRrEraV1kM4lKNKDgAAAABgEwEcEJOq25qh0I1lpNWzDlXILRn0AAAAAABIggAOOCIUuJmvS7ZXLZlAbk6FHAAAAAAgCQI4YIuWlJqwrU3ghj2egkBus5rO2UgAAAAAgEMI4FB7Db97FgrcWFKKJG5DgRzVcQAAAACAFwjgUEuqcuspcGNoAmwyAx0m9I4DAAAAAAQI4FALDb/7JlTl1qbKDTkJlqpOCOMAAAAAoL4I4FBZCt2CwO0drzQKRhgHAAAAAODVFAIdKIXRDSTxpmeqEnnEAAAAAUH0EcCg9QjeU3EMojPvOiwkAAAAA1UMAh9Jq+N0eoRsq5lZB3JwXFgAAAACqgwAOpdLwu01NL2WQAqos6Bc3YokqAAAAAJQfARyc1/C7ZwrdzNcprxhq5k5VcRNeeAAAAAAoJwI4OEtLTM3XJa8S4K1NRRyDGwAAAACgfAjg4BRVuw0UvLHEFNjtVstTl2wfAAAAAHAfARycQLUbkIjpFTdkeSoAAAAAuI0ADoWhtxtgTbA81VTFfWezAgAAAIBbCOCQu9Ak0yu2PmDdjari6BMHAAAAAI4ggENuWGYK5Io+cQAAAADgCAI4ZKrhd994ntc2FTksMwUKcaeKOII4AAAAACgIARwyoeBtoC+mmQLFI4gDAAAAgIIQwMEqDVYYaKkpwRvgHoI4AAAAAMgZARysUPA2ZLACUBoEcQAAAACQEwI4pELwBpQeQRwAAAAAZIwADokQvAGVQxAHAAAAABkhgEMsGq4wIngDKuvW9HHcrKaPvMQAAAAAYAcBHCJhqilQOzcK4r7z0gMAAABAOgRwOKrhd4cEb0AtrVXxOiKIAwAAAIDkCOCwV8Pv9tTn7ZStBNTak/rDTeq+IQAAAAAgCQI4vAABv9tW5dtp7Z48AGSHvnAAAAAAnMQS1JypQuNrrZ40AOTrzvO8Nn3hAAAAALiCCrgCqTKD8A0AsnVpqoy11B8AAAAACkcFXE6YdAoAuVurEm7JpgcAAABQJAK4jDHpFAAKd71ZTSe8DAAAAACKQgCXIcI3OGKtibuB7Wqg71t/n8SZvsLM8r83+u8zho6gYF82q+mAFwEAAABAEQjgMqLeQxPCN2TsyfO8xx1fnqvL7hp+Nwjr3iikM5r687LAh4bqu/E8b8BwBgAAAAB5I4DLgMI3E36cVO7JoSh3oZDNvLe+b1bTtFVrTlLl6EWoqi7434TZsOHBBL6EcAAAAADyRABnGeEbUgqWiy715/1mNX1ko/5D+1cQyjX1J/sa4nrQcAb2LQAAAAC5IICziPANCTzpPbNU2FbJqrYsaUnrRSiUYxkrolirEo59DgAAAEDmCOAsIXxDROHAbUkFTja0PzZDX+yX2IUQDgAAAEAuCOAsaPjdnud5X0v/RJCV21DgxoV+AQjkcMT1ZjWdsJEAAAAAZIUALiXCN+zwoMBt7uok0rpTINfWF8Md4BHCAQAAAMgSAVwKhG8IuQ2FbiwrLRFNXQ3COKrj6o0QDgAAAEAmCOASInyrvXUQuCl0+173DVIVDb/bDgVyhHH1c7NZTXt13wgAAAAA7CKAS0AX6H+W7oEjrXUocJuzNauPMK62COEAAAAAWEUAFxPTTmvpVqEbS9NqTGGcCWXe1X1b1AQhHAAAAABrCOBiIHyrlTvP8yYsL8W2UM+4AQMcKo8QDgAAAIAVBHAREb7VwpNCtwmDFBCFjgs9fXFsqCZCOAAAAACpEcBFQPhWeTcK3ZZle6KLcce8N9/oP8P/+43+O+zM87zTlL/ywfO87YrA+9D/913/bTy2+rPaBJkazEJVXDURwgEAAABIhQDuCC03eyR8qxxT7TZS8ObkEtPFuHOm0OwiFKi90VfZQp47/XkfCum+t/qz0oWexyiwN0HclduPFDERwgEAAABIjADuAIVvSypaKsUMVBi5Vu22GHeaCtguFLpdOvCw8rJWIPeor2UVqud0/BjoiwC/GgjhAAAAACRCALcH4VulrNXbbeRCbzdVtgWBW5P32F5BMPfzq9Wf3Sf8WYXS8tShhSXAKB4hHAAAAIDYCOD2aPjdued575x8cIjqSaFHoZNMQ4Fb8EUIk86dArmlQrnSVMrRJ64yCOEAAAAAxEIAt0PD707o31Rqd+rtNiniSSzGnTcK2toEbrl4Uhj3/FWGQK7hd5sKh+u01LhqCOEAAAAAREYAt6Xhe/cXHbUwZQ6qEd4bB3g9J0oiKMoU/ByGWZ3PMLbXA+t5r4djcgD3zoWnG+u0GHfeoJ5s+q0kPn3rKuTk9/w8bJ8/GLoWmMz3G/kBW/z/AAlfKAAA/gVAAAAA';
    const TECNOLAB_ACCENT = '#1e3a5f';

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
    let _certFirmasDataUrl = { CALIBRO: null, APROBO: null };

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
    function vCert(s) { const t = (s || '').trim(); return t ? escHtmlCert(t) : '<span style="color:#94a3b8;font-style:italic">—</span>'; }

    let _qrLibPromesa = null;
    function cargarLibQR() {
        if (window.qrcode) return Promise.resolve();
        if (_qrLibPromesa) return _qrLibPromesa;
        _qrLibPromesa = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
            s.onload = () => resolve();
            s.onerror = () => resolve();
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

    // FORMULARIO
    function renderCertificadoTecnolab(cont) {
        if (!_certDatos) _certDatos = certificadoDatosDefault();

        cont.innerHTML = `<div class="gs-shell">${renderRail()}<div class="gs-content">
            <div class="gs-topbar"><div><div class="gs-eyebrow">Gestoría</div><div class="gs-title">Certificado TECNOLAB</div><div class="gs-subtitle">Llenado del Certificado de Calibración — se exporta al instante, no se guarda en el portal</div></div></div>
            <div class="gs-body">
                <div class="gs-form-grid" style="grid-template-columns:0.85fr 1.5fr;">
                    <div id="gs-cert-form"></div>
                    <div id="gs-cert-lateral">
                        <div class="gs-card">
                            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.imagen}</span><span class="gs-card-title">Firmas</span></div>
                            <div class="gs-card-body">
                                ${['CALIBRO', 'APROBO'].map(rol => `
                                <div style="margin-bottom:12px;">
                                    <label style="font-size:11.5px;font-weight:700;color:var(--text2);display:block;margin-bottom:4px;">${rol === 'CALIBRO' ? 'Calibró (Metrólogo)' : 'Aprobó'}</label>
                                    <div id="gs-cert-dropzone-firma-${rol}" class="gs-dropzone" style="min-height:56px;padding:8px;">
                                        <input type="file" id="gs-cert-input-firma-${rol}" accept="image/png,image/jpeg" style="display:none;">
                                        <div id="gs-cert-dropzone-firma-${rol}-contenido"></div>
                                    </div>
                                </div>`).join('')}
                                <div class="gs-subtitle" style="font-size:11px;">PNG con fondo transparente recomendado.</div>
                            </div>
                        </div>
                        <div class="gs-card">
                            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.certificado}</span><span class="gs-card-title">Vista previa</span></div>
                            <div class="gs-card-body" style="background:#e7ebf3;padding:16px;display:flex;justify-content:center;">
                                <div style="width:653px;height:1568px;overflow:hidden;position:relative;box-shadow:0 4px 18px rgba(0,0,0,.18);">
                                    <iframe id="gs-cert-iframe" class="gs-cert-preview-frame" style="width:816px;height:1960px;border:0;transform:scale(0.8);transform-origin:top left;"></iframe>
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
        renderDropzoneGenerico(cont, '#gs-cert-dropzone-firma-CALIBRO', '#gs-cert-input-firma-CALIBRO', '#gs-cert-dropzone-firma-CALIBRO-contenido',
            () => _certFirmasDataUrl.CALIBRO, v => { _certFirmasDataUrl.CALIBRO = v; actualizarPreviewCertificado(cont); },
            'Arrastra la firma aquí', 'PNG o JPG', 'Cambiar firma', 'gs-firma-preview');
        renderDropzoneGenerico(cont, '#gs-cert-dropzone-firma-APROBO', '#gs-cert-input-firma-APROBO', '#gs-cert-dropzone-firma-APROBO-contenido',
            () => _certFirmasDataUrl.APROBO, v => { _certFirmasDataUrl.APROBO = v; actualizarPreviewCertificado(cont); },
            'Arrastra la firma aquí', 'PNG o JPG', 'Cambiar firma', 'gs-firma-preview');
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
            <div class="gs-card-header"><span class="gs-card-icon">${ICONO.usuarios}</span><span class="gs-card-title">Firmas — nombres</span></div>
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

    // CONSTRUCCIÓN DEL HTML DEL CERTIFICADO
    function construirHTMLCertificado(d, qrDataUrl) {
        const acc = TECNOLAB_ACCENT;
        const qrImg = qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR de verificación" style="width:92px;height:92px;display:block;">`
            : `<div style="width:92px;height:92px;background:repeating-linear-gradient(45deg,#eef2f8,#eef2f8 4px,#dde5f0 4px,#dde5f0 8px)"></div>`;
        const qrImgChica = qrDataUrl
            ? `<img src="${qrDataUrl}" alt="QR" style="width:60px;height:60px;display:block;">`
            : `<div style="width:60px;height:60px;background:repeating-linear-gradient(45deg,#eef2f8,#eef2f8 4px,#dde5f0 4px,#dde5f0 8px)"></div>`;

        const filasResultados = (d.resultados && d.resultados.length ? d.resultados : [{}]).map(r => `
            <tr>
                <td style="padding:5px 6px;height:15px;border:1px solid #cbd5e1;font-size:10px;text-align:center;">${escHtmlCert(r.patron)}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;font-size:10px;text-align:center;">${escHtmlCert(r.ibc)}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;font-size:10px;text-align:center;">${escHtmlCert(r.error)}</td>
                <td style="padding:5px 6px;border:1px solid #cbd5e1;font-size:10px;text-align:center;">${escHtmlCert(r.incertidumbre)}</td>
            </tr>`).join('');

        const refsHtml = TECNOLAB_REFERENCIAS.map(r => `<li style="margin-bottom:2px;">${escHtmlCert(r)}</li>`).join('');

        const firmaImg = (dataUrl) => dataUrl ? `<img src="${dataUrl}" style="max-height:32px;max-width:150px;display:block;margin:0 auto 2px;">` : '';

        const firmaCalibro = `
            <div style="flex:1;text-align:center;">
                ${firmaImg(d.firmaCalibroBase64)}
                <div style="border-bottom:1px solid #64748b;height:${d.firmaCalibroBase64 ? '2px' : '34px'};margin:0 6px;"></div>
                <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${acc};margin-top:5px;">Calibró</div>
                <div style="font-size:9px;color:#475569;margin-top:2px;">${vCert(d.calibroNombre)} · Metrólogo</div>
            </div>`;
        const firmaAprobo = `
            <div style="flex:1;text-align:center;">
                ${firmaImg(d.firmaAproboBase64)}
                <div style="border-bottom:1px solid #64748b;height:${d.firmaAproboBase64 ? '2px' : '34px'};margin:0 6px;"></div>
                <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${acc};margin-top:5px;">Aprobó</div>
                <div style="font-size:9px;color:#475569;margin-top:2px;">${vCert(d.aproboNombre)} · ${vCert(d.aproboPuesto)}</div>
            </div>`;

        return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;}
  body{margin:0;background:#ccc;font-family:'IBM Plex Sans',system-ui,sans-serif;}
  .hoja{width:816px;min-height:1056px;background:#fff;padding:48px;color:#1e293b;line-height:1.35;margin:0 auto 12px;}
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
      <div style="font-size:9.5px;color:#475569;margin-top:3px;">Avenida Fuerza Aérea Mexicana No. 7030 Int. B2, colonia Tabalaopa · Tel. 614 176 1255</div>
      <div style="font-size:9.5px;color:#475569;">calidad@tecnolab.com.mx</div>
      <div style="font-size:8.5px;color:#64748b;margin-top:3px;">Número de Acreditación y Entidad de Acreditación: <span style="color:#94a3b8;font-style:italic;">ema — Clave D-000-000</span></div>
    </div>
    <div style="width:118px;min-width:118px;border:1px solid #cbd5e1;border-radius:4px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div style="width:92px;height:92px;display:flex;align-items:center;justify-content:center;background:#fff;">${qrImg}</div>
      <div style="font-size:7px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;text-align:center;line-height:1.3;">Verificación en línea</div>
    </div>
  </div>

  <div style="background:${acc};color:#fff;text-align:center;padding:8px;margin-top:10px;border-radius:2px;">
    <div style="font-family:'IBM Plex Serif',Georgia,serif;font-weight:700;font-size:18px;letter-spacing:.14em;">CERTIFICADO DE CALIBRACIÓN</div>
  </div>

  <table style="margin-top:8px;">
    <tr>
      <td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;width:24%;">CERTIFICADO NO.</td>
      <td style="padding:5px 8px;font-size:11px;color:#1e293b;border:1px solid #cbd5e1;width:26%;font-family:'IBM Plex Mono',monospace;font-weight:500;">${vCert(d.folio)}</td>
      <td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;width:24%;">Fecha de calibración</td>
      <td style="padding:5px 8px;font-size:10.5px;color:#1e293b;border:1px solid #cbd5e1;">${vCert(d.fechaCalibracion)}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">FECHA DE EMISIÓN</td>
      <td style="padding:5px 8px;font-size:10.5px;color:#1e293b;border:1px solid #cbd5e1;">${vCert(d.fechaEmision)}</td>
      <td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Vigencia / próxima calibración</td>
      <td style="padding:5px 8px;font-size:10.5px;color:#1e293b;border:1px solid #cbd5e1;">${vCert(d.vigencia)}</td>
    </tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos del cliente</div>
  <table>
    <tr><td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;width:24%;">Nombre o razón social</td><td style="padding:5px 8px;font-size:10.5px;color:#1e293b;border:1px solid #cbd5e1;">${vCert(d.clienteRazonSocial)}</td></tr>
    <tr><td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;letter-spacing:.03em;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Dirección</td><td style="padding:5px 8px;font-size:10.5px;color:#1e293b;border:1px solid #cbd5e1;">${vCert(d.clienteDireccion)}</td></tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos del instrumento calibrado</div>
  <table style="table-layout:fixed;">
    <tr>
      <td style="border:1px solid #cbd5e1;background:#dce4f0;width:22%;"></td>
      <th style="padding:5px 8px;background:#dce4f0;font-size:9px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">Sonda de temperatura</th>
      <th style="padding:5px 8px;background:#dce4f0;font-size:9px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">Consola o lector</th>
    </tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Marca</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instSondaMarca)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instConsolaMarca)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Modelo</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instSondaModelo)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instConsolaModelo)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">No. de Serie</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instSondaSerie)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instConsolaSerie)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Identificación</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instSondaId)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instConsolaId)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Resolución</td><td colspan="2" style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instResolucion)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Tipo de tanque</td><td colspan="2" style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instTipoTanque)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Tipo de líquido</td><td colspan="2" style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.instTipoLiquido)}</td></tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos de los patrones y equipos de medida utilizados</div>
  <table style="table-layout:fixed;">
    <tr>
      <td style="border:1px solid #cbd5e1;background:#dce4f0;width:22%;"></td>
      <th style="padding:5px 8px;background:#dce4f0;font-size:9px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">TEP</th>
      <th style="padding:5px 8px;background:#dce4f0;font-size:9px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">Cinta con plomada</th>
    </tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Marca</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patTepMarca)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patCintaMarca)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Modelo</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patTepModelo)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patCintaModelo)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">No. de Serie</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patTepSerie)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patCintaSerie)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Identificación</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patTepId)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patCintaId)}</td></tr>
    <tr><td style="padding:4px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Trazabilidad metrológica</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patTepTrazabilidad)}</td><td style="padding:4px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.patCintaTrazabilidad)}</td></tr>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Datos de la calibración</div>
  <table>
    <tr><td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;width:24%;">Lugar de calibración</td><td style="padding:5px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.lugarCalibracion)}</td></tr>
    <tr><td style="padding:5px 8px;background:#eef2f8;font-weight:600;font-size:8.5px;text-transform:uppercase;color:#475569;border:1px solid #cbd5e1;">Método de calibración</td><td style="padding:5px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.metodoCalibracion)}</td></tr>
  </table>
  <table style="table-layout:fixed;margin-top:-1px;">
    <tr>
      <th style="padding:5px 8px;background:#dce4f0;font-size:8.5px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">Temperatura ambiente (°C)</th>
      <th style="padding:5px 8px;background:#dce4f0;font-size:8.5px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">Humedad Relativa (%HR)</th>
      <th style="padding:5px 8px;background:#dce4f0;font-size:8.5px;font-weight:700;color:${acc};border:1px solid #cbd5e1;text-align:left;">Presión Atmosférica (Pa)</th>
    </tr>
    <tr>
      <td style="padding:5px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.tempAmbiente)}</td>
      <td style="padding:5px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.humedad)}</td>
      <td style="padding:5px 8px;font-size:10.5px;border:1px solid #cbd5e1;">${vCert(d.presion)}</td>
    </tr>
  </table>

  <div style="display:flex;gap:24px;margin-top:22px;">${firmaCalibro}${firmaAprobo}</div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:6px;border-top:1px solid #cbd5e1;font-family:'IBM Plex Mono',monospace;font-size:7.5px;color:#94a3b8;">
    <span>FOR-023 rev0 / Ref: PROC-006</span><span>Página 1 de 2</span>
  </div>
</div>

<div class="hoja">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid ${acc};padding-bottom:8px;">
    <div>
      <div style="font-family:'IBM Plex Serif',Georgia,serif;font-weight:700;font-size:13px;color:${acc};">TECNOLAB ENSAYO Y CALIBRACIÓN S.A. DE C.V.</div>
      <div style="font-size:9px;color:#475569;">Certificado de Calibración · <span style="font-style:italic;color:#94a3b8;">${escHtmlCert(d.folio || '—')}</span></div>
    </div>
    <div style="width:60px;height:60px;display:flex;align-items:center;justify-content:center;">${qrImgChica}</div>
  </div>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:12px;">Resultados de calibración</div>
  <div style="font-size:10px;color:#475569;margin:7px 2px;">En la siguiente tabla se muestran los resultados de calibración:</div>
  <table style="table-layout:fixed;">
    <thead>
      <tr>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #94a8c2;line-height:1.25;">Temperatura del Patrón</th>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #94a8c2;line-height:1.25;">Temperatura del IBC</th>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #94a8c2;line-height:1.25;">Error</th>
        <th style="padding:5px 6px;background:${acc};color:#fff;font-size:8.5px;font-weight:600;border:1px solid #94a8c2;line-height:1.25;">Incertidumbre k=2</th>
      </tr>
      <tr>
        <th style="padding:2px;background:#dce4f0;color:#475569;font-size:8px;font-weight:600;border:1px solid #cbd5e1;">°C</th>
        <th style="padding:2px;background:#dce4f0;color:#475569;font-size:8px;font-weight:600;border:1px solid #cbd5e1;">°C</th>
        <th style="padding:2px;background:#dce4f0;color:#475569;font-size:8px;font-weight:600;border:1px solid #cbd5e1;">°C</th>
        <th style="padding:2px;background:#dce4f0;color:#475569;font-size:8px;font-weight:600;border:1px solid #cbd5e1;">°C</th>
      </tr>
    </thead>
    <tbody>${filasResultados}</tbody>
  </table>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:14px;">(8) Observaciones</div>
  <ul style="margin:8px 0 0;padding-left:18px;font-size:9.5px;color:#1e293b;line-height:1.5;">
    <li>Los resultados mostrados se relacionan solamente con el ítem bajo calibración indicado en esta hoja.</li>
    <li>El Laboratorio es responsable de la información emitida en el informe, a excepción de la información otorgada por el cliente.</li>
    ${d.observacionAdicional && d.observacionAdicional.trim() ? `<li>${escHtmlCert(d.observacionAdicional.trim())}</li>` : ''}
  </ul>

  <div style="background:${acc};color:#fff;font-size:9.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;margin-top:14px;">(9) Referencias</div>
  <ol style="margin:8px 0 0;padding-left:20px;font-size:8px;color:#475569;line-height:1.45;">${refsHtml}</ol>

  <div style="display:flex;gap:24px;margin-top:20px;">${firmaCalibro}${firmaAprobo}</div>

  <div style="margin-top:16px;padding:8px 10px;background:#eef2f8;border-left:3px solid ${acc};font-size:8.5px;color:#475569;font-style:italic;">El presente documento no debe de ser reproducido o alterado en forma parcial o total sin la autorización expresa y por escrito del Laboratorio.</div>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:6px;border-top:1px solid #cbd5e1;font-family:'IBM Plex Mono',monospace;font-size:7.5px;color:#94a3b8;">
    <span>FOR-023 rev0 / Ref: PROC-006</span><span>Página 2 de 2</span>
  </div>
</div>

</body></html>`;
    }

    function actualizarPreviewCertificado(cont) {
        const iframe = cont.querySelector('#gs-cert-iframe');
        if (!iframe) return;
        const d = { ..._certDatos || certificadoDatosDefault(), firmaCalibroBase64: _certFirmasDataUrl.CALIBRO, firmaAproboBase64: _certFirmasDataUrl.APROBO };
        const url = 'https://tecnolab.com.mx/verificar?folio=' + encodeURIComponent(d.folio || '');
        _certQrDataUrl = generarQrDataUrl(d.folio ? url : null);
        iframe.srcdoc = construirHTMLCertificado(d, _certQrDataUrl);
    }

    // EXPORTACIÓN — PDF (impresión del navegador, mismo HTML que la vista previa)
    function exportarCertificadoPDF(cont) {
        _certDatos = leerCertificadoDeFormulario(cont);
        const faltantes = TECNOLAB_CAMPOS_OBLIGATORIOS.filter(k => !(_certDatos[k] || '').trim());
        if (faltantes.length) {
            mostrarProgresoCert(cont, 'error', ICONO.alerta + ' Completa Certificado No., Fecha de calibración y Fecha de emisión antes de generar.');
            return;
        }
        const d = { ..._certDatos, firmaCalibroBase64: _certFirmasDataUrl.CALIBRO, firmaAproboBase64: _certFirmasDataUrl.APROBO };
        const url = 'https://tecnolab.com.mx/verificar?folio=' + encodeURIComponent(d.folio || '');
        const qr = generarQrDataUrl(url);
        const html = construirHTMLCertificado(d, qr);

        const ventana = window.open('', '_blank');
        if (!ventana) {
            mostrarProgresoCert(cont, 'error', ICONO.alerta + ' El navegador bloqueó la ventana de impresión. Permite pop-ups para este sitio e inténtalo de nuevo.');
            return;
        }
        ventana.document.open();
        ventana.document.write(html);
        ventana.document.close();
        ventana.document.title = 'Certificado ' + (d.folio || 'TECNOLAB');
        const lanzarImpresion = () => { ventana.focus(); ventana.print(); };
        if (ventana.document.readyState === 'complete') setTimeout(lanzarImpresion, 300);
        else ventana.addEventListener('load', () => setTimeout(lanzarImpresion, 300));
        mostrarProgresoCert(cont, 'ok', ICONO.check + ' Se abrió la vista de impresión — elige "Guardar como PDF" en el diálogo del navegador.');
    }

    // EXPORTACIÓN — WORD (.doc editable vía HTML con espacio de nombres de Office)
    function exportarCertificadoWord(cont) {
        _certDatos = leerCertificadoDeFormulario(cont);
        const faltantes = TECNOLAB_CAMPOS_OBLIGATORIOS.filter(k => !(_certDatos[k] || '').trim());
        if (faltantes.length) {
            mostrarProgresoCert(cont, 'error', ICONO.alerta + ' Completa Certificado No., Fecha de calibración y Fecha de emisión antes de exportar.');
            return;
        }
        const d = { ..._certDatos, firmaCalibroBase64: _certFirmasDataUrl.CALIBRO, firmaAproboBase64: _certFirmasDataUrl.APROBO };
        const url = 'https://tecnolab.com.mx/verificar?folio=' + encodeURIComponent(d.folio || '');
        const qr = generarQrDataUrl(url);
        const cuerpo = construirHTMLCertificado(d, qr).replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
        const docHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Certificado ${escHtmlCert(d.folio || '')}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>@page{size:8.5in 11in;margin:0.5in;} body{font-family:'IBM Plex Sans',Calibri,sans-serif;}</style>
</head><body>${cuerpo}</body></html>`;
        const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Certificado_TECNOLAB_${(d.folio || 'sin_folio').replace(/[^a-z0-9]+/gi, '_')}.doc`;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
        mostrarProgresoCert(cont, 'ok', ICONO.check + ' Word descargado. Word puede tardar unos segundos en abrirlo la primera vez.');
    }

    // EXPORTACIÓN — XML (datos estructurados, no es CFDI/timbrado)
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
        <calibro><nombre>${escXmlCert(d.calibroNombre)}</nombre><puesto>Metrólogo</puesto><firmaAdjunta>${_certFirmasDataUrl.CALIBRO ? 'true' : 'false'}</firmaAdjunta></calibro>
        <aprobo><nombre>${escXmlCert(d.aproboNombre)}</nombre><puesto>${escXmlCert(d.aproboPuesto)}</puesto><firmaAdjunta>${_certFirmasDataUrl.APROBO ? 'true' : 'false'}</firmaAdjunta></aprobo>
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