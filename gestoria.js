// ══════════════════════════════════════════════════════════════
// GESTORÍA — módulo de departamento (Portal Tecnocontrol)
// ══════════════════════════════════════════════════════════════
// Archivo nombrado como el departamento (mismo patrón que rh.js,
// ventas.js, flotilla.js) porque Gestoría alojará más de un sistema:
//   - SASISOPA (implementado abajo)
//   - SGM — Sistema de Gestión de Medición
//   - Certificado TECNOLAB — llenado y exportación (PDF/Word/XML)
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

    // Placeholder del catálogo genérico de SASISOPA (Responsabilidades/
    // Funciones/Autoridad/Interrelaciones por puesto). Se llena con el
    // contenido real de M-05_Funciones__responsabilidades_y_autoridad.docx
    // en cuanto Glen comparta ese documento.
    const SASISOPA_CATALOGO_GENERICO = {};

    // Jerarquía por defecto para el organigrama gráfico de SASISOPA
    // (se usa como fallback automático si el cliente no ha guardado
    // un layout propio en el editor visual).
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
    ];

    // NUMERO_PERMISO ya no es obligatorio: puede decir "PERMISO EN PROCESO"
    // cuando el trámite del cliente todavía está en curso, y eso no debe
    // bloquear la generación de documentos.
    const SASISOPA_CAMPOS_OBLIGATORIOS = ["RAZON_SOCIAL", "RFC", "DOMICILIO_ESTACION", "CIUDAD_ESTADO", "FECHA_ELABORACION", "NOMBRE_ELABORA"];

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
        "FR": "__SKIP__",
        "PL/9693/EXP/ES/2015": "NUMERO_PERMISO",
        "Lezlie Anahy Gutierrez Armendáriz.": "NOMBRE_ELABORA",
        "16/12/2024": "FECHA_ELABORACION",
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
          match: /el\s+control\s+de\s+los\s+registros\s+de\s+gesti[oó]n\s+es\s+realizado\s+por/i },
        { id: 'registros_tecnicos', etiqueta: 'Control de registros técnicos (PROC-G-003)',
          match: /el\s+control\s+de\s+los\s+registros\s+t[eé]cnicos\s+es\s+realizado\s+por/i },
        { id: 'proteccion_registros_impresos', etiqueta: 'Protección de registros impresos y contraseñas (PROC-G-003, 4.1 h)',
          match: /registros\s+impresos\s+se\s+protegen\s+en\s+oficinas/i },
        { id: 'resguardo_claves_acceso', etiqueta: 'Resguardo de claves de acceso electrónico (PROC-G-003, 4.2)',
          match: /claves\s+de\s+acceso\s+son\s+resguardadas\s+por/i },
        { id: 'entrega_solicitud_compra', etiqueta: 'Entrega de solicitud de compra (PROC-G-004)',
          match: /llevar\s+la\s+solicitud\s+firmada\s+en\s+duplicado\s+al/i },
        { id: 'asignacion_acciones_prevencion', etiqueta: 'Asignación de acciones preventivas (PROC-G-005, 4.1)',
          match: /asigna\s+responsables\s+y\s+fechas\s+de\s+implantaci[oó]n\s+de\s+acciones\s+de\s+prevenci[oó]n/i },
        { id: 'eficacia_acciones_mejora', etiqueta: 'Eficacia de acciones de mejora (PROC-G-005, 4.2)',
          match: /coordinada\s+y\s+asegurada\s+su\s+eficacia\s+por/i },
        { id: 'vigilancia_acciones_correctivas', etiqueta: 'Vigilancia de acciones correctivas (PROC-G-008, 4.2)',
          match: /responsable\s+de\s+vigilar\s+la\s+aplicaci[oó]n\s+de\s+acciones\s+correctivas\s+efectivas/i },
    ];

    // Documentos donde el índice/tabla de contenido debe listar TODOS los
    // puestos disponibles, sin filtrar por los que el cliente marcó en el
    // organigrama (a diferencia del resto de SGM, donde sí se filtran).
    const RE_INDICE_TODOS_LOS_PUESTOS_SGM = /^PROC-T-001/i;

    // Documentos de procedimiento (PROC-G-*/PROC-T-*) que traen su propio
    // diagrama de proceso (no un organigrama) y por lo tanto NO deben
    // pasar por el reemplazo automático del organigrama gráfico.
    const RE_SIN_ORGANIGRAMA_SGM = /^PROC-/i;

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

    // ── Config activa según la sección elegida en el riel lateral ──
    function sistemaActivo() {
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
        if (clave === undefined) return intentarCoincidenciaFlexible(valorOriginal, datos);
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

    // ══════════════════════════════════════════════════════════
    // MANIPULACIÓN XML DEL .DOCX
    // ══════════════════════════════════════════════════════════
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

    async function insertarImagenEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg, altoObjetivoPx, anchoMaximoPx) {
        const { bytes, mime, ext } = dataUrlABytes(dataUrl);
        await asegurarContentType(zip, ext, mime);
        ctxImg.contador++;
        const mediaFilename = `logoGen${ctxImg.contador}.${ext}`;
        zip.file('word/media/' + mediaFilename, bytes);
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
        quitarResaltado(primerRun);
        primerRun.appendChild(nodoDrawing);
        for (let k = 1; k < grupoRuns.length; k++) { setTextoRun(grupoRuns[k], ''); quitarResaltado(grupoRuns[k]); }
    }

    async function insertarLogoEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg) {
        // La celda "LOGO" del encabezado SGM mide 104px de ancho total
        // (incluyendo bordes y márgenes internos de la celda); dejamos
        // ~19px de margen para que no toque los bordes.
        await insertarImagenEnGrupo(zip, xmlDoc, rutaXml, grupoRuns, dataUrl, ctxImg, 40, 85);
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
    const RE_ARCHIVOS_CON_TABLA_EQUIPO = /volumen|inventario_de_equipo|etiquetas_de_identificaci[oó]n/i;

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

            if (!datos.PATRONES_EQUIPOS || !datos.PATRONES_EQUIPOS.length) {
                filasDatos.forEach(fila => {
                    Array.from(fila.getElementsByTagNameNS(NS_W, 'tc')).forEach((celda, i) => {
                        if (i === idxNo) return; // conserva la numeración secuencial fija
                        limpiarCelda(celda);
                    });
                });
                stats.pendientes.push('Tabla de patrones y equipos de medida sin capturar (se dejó en blanco)');
                continue;
            }

            datos.PATRONES_EQUIPOS.forEach((patron, idx) => {
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
            const totalChars = runsAmarillos.reduce((acc, r) => acc + textoDeRun(r).length, 0);
            if (totalChars >= UMBRAL_CHARS_TABLA_GENERICA) {
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
        const parrafo = celda.getElementsByTagNameNS(NS_W, 'p')[0];
        if (!parrafo) return;
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
    function resolverNombresPorRolSASISOPA(xmlDoc, datos, stats) {
        const sis = sistemaActivo();
        const roles = sis.rolesOrganigrama || [];
        const extras = Array.isArray(datos.ROLES_EXTRA) ? datos.ROLES_EXTRA : [];
        const norm = t => (t || '').replace(/[.:]+\s*$/, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const nombrePorEtiqueta = etiqueta => {
            const rol = roles.find(r => norm(r.etiqueta) === norm(etiqueta));
            if (rol) return datos[rol.clave] || '';
            const extra = extras.find(e => norm(e.etiqueta) === norm(etiqueta));
            return extra ? (extra.nombre || '') : null;
        };
        const parrafos = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'));
        parrafos.forEach((p, i) => {
            const texto = textoParrafo(p).trim();
            if (norm(texto) !== 'nombre') return;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            if (!runs.some(esResaltadoAmarillo)) return;
            const siguiente = parrafos[i + 1];
            if (!siguiente) return;
            const textoSig = textoParrafo(siguiente).trim();
            const nombre = nombrePorEtiqueta(textoSig);
            if (nombre === null) return; // no es un bloque de firma por puesto conocido; se deja tal cual
            if (nombre) {
                reemplazarTextoParrafo(p, nombre);
                stats.reemplazos++;
            } else {
                runs.forEach(quitarResaltado);
                stats.pendientes.push(`Nombre de ${textoSig} (sin dato capturado)`);
            }
        });
    }

    // ── SGM: puestos responsables de procesos específicos (multi-select) ──
    function procesarFrasesMultiPuestoSGM(xmlDoc, datos, stats) {
        if (!datos.MULTIPUESTO) return;
        const roles = SGM_ROLES_DISPONIBLES;
        for (const p of Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))) {
            const texto = textoParrafo(p);
            const frase = SGM_FRASES_MULTIPUESTO.find(f => f.match.test(texto));
            if (!frase) continue;
            const runs = Array.from(p.getElementsByTagNameNS(NS_W, 'r'));
            const clavesElegidas = datos.MULTIPUESTO[frase.id];
            const etiquetas = (clavesElegidas || []).map(c => (roles.find(r => r.clave === c) || {}).etiqueta).filter(Boolean);
            const textoNuevo = etiquetas.length > 1
                ? etiquetas.slice(0, -1).join(', ') + ' y ' + etiquetas[etiquetas.length - 1]
                : (etiquetas[0] || '');
            // Algunas frases mencionan el puesto responsable DOS veces en el
            // mismo párrafo (p.ej. "...vigilar la corrección... o en su
            // defecto por quien el Administrativo designe."). Se agrupan
            // solo los runs amarillos CONTIGUOS (no todos los del párrafo),
            // para que cada mención se resuelva de forma independiente.
            let huboResaltado = false;
            let i = 0;
            while (i < runs.length) {
                if (!esResaltadoAmarillo(runs[i])) { i++; continue; }
                huboResaltado = true;
                let j = i + 1;
                while (j < runs.length && esResaltadoAmarillo(runs[j])) j++;
                const grupo = runs.slice(i, j);
                if (etiquetas.length) {
                    setTextoRun(grupo[0], textoNuevo);
                    for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
                    stats.reemplazos++;
                }
                grupo.forEach(quitarResaltado);
                i = j;
            }
            if (huboResaltado && !etiquetas.length) {
                stats.pendientes.push(`Puesto(s) responsable(s) sin capturar: ${frase.etiqueta}`);
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
            const esMayusculas = textoOriginal === textoOriginal.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(textoOriginal);
            const terminaConPunto = /\.\s*$/.test(textoOriginal);
            let nuevoNombre = esMayusculas ? datos.NOMBRE_REPRESENTANTE.toUpperCase() : datos.NOMBRE_REPRESENTANTE;
            if (terminaConPunto && !/\.\s*$/.test(nuevoNombre)) nuevoNombre += '.';
            setTextoRun(grupo[0], nuevoNombre);
            for (let k = 1; k < grupo.length; k++) setTextoRun(grupo[k], '');
            grupo.forEach(quitarResaltado);
            stats.reemplazos++;
        }
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

        const estaCapturado = etiqueta => {
            if (siempreVisibles.has(normAcentos(etiqueta))) return true;
            const rol = SGM_ROLES_DISPONIBLES.find(r => normAcentos(r.etiqueta) === normAcentos(etiqueta));
            return rol ? !!datos[rol.clave] : true;
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
            if (m && esRolConocido(m[3].trim())) titulos.push({ idx: i, seccion: m[1], rol: m[3].trim() });
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
        titulos.forEach(t => { (porSeccion[t.seccion] = porSeccion[t.seccion] || []).push(t); });

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
                if (claveRol) { rolActual = claveRol; return; }
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

        let idc = 9100;
        const shapesXml = nodos.map(n => {
            const x = Math.round((n.x - minX + margen) * EMU_PX);
            const y = Math.round((n.y - minY + margen) * EMU_PX);
            const w = Math.round(n.w * EMU_PX);
            const h = Math.round(ALTO_NODO_PX * EMU_PX);
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
            const x = esVertical ? Math.round((l.x1 * EMU_PX) - GROSOR_LINEA / 2) : Math.round(Math.min(l.x1, l.x2) * EMU_PX);
            const y = Math.round(Math.min(l.y1, l.y2) * EMU_PX);
            const cx = esVertical ? GROSOR_LINEA : Math.round(Math.abs(l.x2 - l.x1) * EMU_PX);
            const cy = esVertical ? Math.round(Math.abs(l.y2 - l.y1) * EMU_PX) : GROSOR_LINEA;
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

        const cx = Math.round(maxX - minX + margen * 2), cy = Math.round(maxY - minY + margen * 2);
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
        Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'pict')).forEach(pict => {
            let nodo = pict.parentNode;
            while (nodo && nodo.localName !== 'p') nodo = nodo.parentNode;
            if (nodo && !estaDentroDeTabla(nodo)) {
                if (pict.parentNode) pict.parentNode.removeChild(pict);
            }
        });

        const parrafosConDrawing = Array.from(xmlDoc.getElementsByTagNameNS(NS_W, 'p'))
            .filter(p => !estaDentroDeTabla(p) && p.getElementsByTagNameNS(NS_W, 'drawing').length > 0);
        if (!parrafosConDrawing.length) return;

        const generado = construirOrganigramaXml(datos);
        const primero = parrafosConDrawing[0];
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
        parrafosConDrawing.forEach(p => p.parentNode && p.parentNode.removeChild(p));
    }

    function estaDentroDeTabla(p) {
        let n = p.parentNode;
        while (n) { if (n.nodeType === 1 && n.localName === 'tc') return true; n = n.parentNode; }
        return false;
    }

    // ══════════════════════════════════════════════════════════════
    // ── SGM: motor de personalización de Excel (SOFT-G / SOFT-T) ───
    // ══════════════════════════════════════════════════════════════
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

    function quitarRellenoAmarilloXlsx(stylesDoc) {
        for (const fill of Array.from(stylesDoc.getElementsByTagNameNS(NS_S, 'fill'))) {
            const fg = fill.getElementsByTagNameNS(NS_S, 'fgColor')[0];
            if (fg && (fg.getAttribute('rgb') || '').toUpperCase().endsWith('FFFF00')) {
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
        const rutaDrawing = 'xl/drawings/drawingSgm.xml';
        const rutaRelsDrawing = 'xl/drawings/_rels/drawingSgm.xml.rels';
        const rutaRelsSheet = rutaRelsPara(rutaSheet);

        let xmlRelsSheet;
        try { xmlRelsSheet = await zip.file(rutaRelsSheet).async('string'); }
        catch (e) { xmlRelsSheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'; }
        const idsSheet = Array.from(xmlRelsSheet.matchAll(/Id="rId(\d+)"/g)).map(m => parseInt(m[1], 10));
        const rIdDrawing = 'rId' + ((idsSheet.length ? Math.max(...idsSheet) : 0) + 1);
        xmlRelsSheet = xmlRelsSheet.replace('</Relationships>',
            `<Relationship Id="${rIdDrawing}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawingSgm.xml"/></Relationships>`);
        zip.file(rutaRelsSheet, xmlRelsSheet);

        const drawingEl = sheetDoc.createElementNS(NS_S, 'drawing');
        drawingEl.setAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'r:id', rIdDrawing);
        sheetDoc.documentElement.appendChild(drawingEl);

        let relsDrawingXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
        let anchorsXml = '';
        for (const img of imagenes) {
            const { bytes, mime, ext } = dataUrlABytes(img.dataUrl);
            await asegurarContentType(zip, ext, mime);
            ctxImg.contador++;
            const mediaFilename = `logoGen${ctxImg.contador}.${ext}`;
            zip.file('xl/media/' + mediaFilename, bytes);

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

        const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchorsXml}</xdr:wsDr>`;
        zip.file(rutaDrawing, drawingXml);
        zip.file(rutaRelsDrawing, relsDrawingXml);

        let ct = await zip.file('[Content_Types].xml').async('string');
        if (!ct.includes('/xl/drawings/drawingSgm.xml')) {
            ct = ct.replace('</Types>', `<Override PartName="/xl/drawings/drawingSgm.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
            zip.file('[Content_Types].xml', ct);
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
        zip.file(rutaSheet, xmlSerializer.serializeToString(sheetDoc));
        zip.file('xl/styles.xml', xmlSerializer.serializeToString(stylesDoc));

        stats.reemplazos += 10;
        return await zip.generateAsync({ type: 'blob' });
    }

    // ── Metadatos internos del .docx (docProps/core.xml) ────────
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
        zip.file(ruta, xml);
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
                procesarControlDeCambiosSGM(xmlDoc, datos);
                neutralizarTablasDescriptivasSGM(xmlDoc);
                reconstruirTarjetasPuestosSGM(xmlDoc, datos);
                aplicarGradoEstudiosSGM(xmlDoc, datos);
                filtrarListasDeRolesSGM(xmlDoc, datos, nombreArchivo);
                procesarFrasesMultiPuestoSGM(xmlDoc, datos, stats);
                procesarInmediatoSiguienteSGM(xmlDoc, datos, nombreArchivo, stats);
            } else {
                resolverNombresPorRolSASISOPA(xmlDoc, datos, stats);
            }
            // PROC-G-*/PROC-T-* traen su propio diagrama de proceso (no un
            // organigrama) y no deben pasar por el reemplazo automático del
            // organigrama gráfico — solo aplica a manuales/formatos que sí
            // llevan el organigrama real de la organización.
            if (!(_seccionActual === 'sgm' && RE_SIN_ORGANIGRAMA_SGM.test(nombreArchivo))) {
                reemplazarOrganigramaMGM(xmlDoc, datos);
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
                        return `
                        <div style="margin-bottom:14px;padding-bottom:14px;border-bottom:1px dashed rgba(59,130,246,0.15);">
                            <div style="font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:8px;">${frase.etiqueta}</div>
                            <div style="display:flex;flex-wrap:wrap;gap:12px;">
                                ${SGM_ROLES_DISPONIBLES.map(rol => `
                                    <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--text2);">
                                        <input type="checkbox" data-multipuesto="${frase.id}" data-multipuesto-rol="${rol.clave}" ${seleccion.includes(rol.clave) ? 'checked' : ''}>
                                        ${rol.etiqueta}
                                    </label>`).join('')}
                            </div>
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

    // ══════════════════════════════════════════════════════════
    // EDITOR VISUAL DEL ORGANIGRAMA (mapa conceptual arrastrable)
    // ══════════════════════════════════════════════════════════
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

                        <div class="gs-card">
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
                } else if (nombreArchivo.toLowerCase().endsWith('.xlsx') && _seccionActual === 'sgm') {
                    const ctxImg = { contador: 0 };
                    const blobSalida = await procesarXlsxSGM(buffer, datos, stats, ctxImg);
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

    // ══════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════
    // FORMULARIO
    // ══════════════════════════════════════════════════════════
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

    // ══════════════════════════════════════════════════════════
    // CONSTRUCCIÓN DEL HTML DEL CERTIFICADO
    // ══════════════════════════════════════════════════════════
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
