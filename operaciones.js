// ══════════════════════════════════════════════════════════════════
// operaciones.js — Dueño único del módulo "Formularios Operaciones"
//
// v2 — Sistema Integral de Gestión y Trazabilidad de Herramientas.
// Reemplaza el catálogo plano de v1 (folio #017-XXX = técnico+pieza)
// por tres entidades independientes, exactamente como se acordó:
//
//   ops_tecnicos      → identidad de la PERSONA (idInterno = doc.id)
//   ops_herramientas  → identidad de la PIEZA   (folio HT-000001 = doc.id, permanente)
//   ops_movimientos   → historial inmutable (alta/asignación/devolución/
//                       reparación/pérdida/baja/transferencia...)
//
// El número operativo del técnico (TEC-017) SÍ se puede reutilizar;
// el idInterno (doc.id de ops_tecnicos) y el folio de herramienta
// (doc.id de ops_herramientas) NUNCA se reutilizan. Los movimientos
// siempre referencian idInterno, nunca el número operativo, así que
// reasignar TEC-017 a otra persona no mezcla el historial.
//
// Roles reutilizados de los ya existentes en index.html:
//   - esAdminTotal(email)              → Administrador (acceso total)
//   - USUARIOS_AREA['Almacen']         → Almacén (altas, asignaciones,
//                                        devoluciones, bajas)
//   - cualquier otro usuario autenticado → Consulta (solo lectura)
// (Supervisor/Auditor no existen como roles separados en el portal
// todavía; por ahora se tratan como Administrador de solo-consulta.
// Si Glen los define más adelante, solo hay que ajustar opsRolActual().)
// ══════════════════════════════════════════════════════════════════

(function () {

    const COL_TECNICOS     = "ops_tecnicos";
    const COL_HERRAMIENTAS = "ops_herramientas";
    const COL_MOVIMIENTOS  = "ops_movimientos";
    const COL_CONTADORES   = "ops_contadores";
    const COL_PERSONAS     = "ops_personas";
    const COL_PUESTOS      = "ops_puestos";
    const COL_HIST_PUESTO  = "ops_historial_puesto";
    const COL_ALMACEN_TEC  = "ops_almacen_tecnico";
    const COL_SURTIDOS     = "surtidos"; // colección REAL de Almacén (almacen.js / pedidos-almacen.html) — reutilizada, no duplicada
    const COL_CATALOGO_DOC = ["catalogo", "productos"]; // doc real de Almacén: catalogo/productos { items:[{clave,desc}] }
    const COL_AUDITORIA    = "ops_auditoria";     // bitácora: quién, qué, cuándo, valor anterior/nuevo
    const COL_NOTIFICACIONES = "ops_notificaciones"; // ej. "solicitud lista para surtir"
    const COL_GUARDIAS = "ops_guardias"; // herramienta de guardia: distinta de la asignación permanente

    // Capa de integración con RH — mismo patrón que opsAspelAdapter: placeholder documentado.
    // Cuando exista sincronización real de personas/altas/bajas/puestos, solo se reemplaza el interior.
    window.opsHRProvider = {
        async sincronizarPersona(personaId) {
            console.warn("[opsHRProvider] sincronizarPersona es un placeholder — no conectado a RH todavía.", personaId);
            return null;
        },
        async notificarBaja(personaId, motivo) {
            console.warn("[opsHRProvider] notificarBaja es un placeholder — no conectado a RH todavía.", personaId, motivo);
        },
    };

    // Capa de integración con Flotilla — mismo patrón que ASPEL/RH.
    // Cuando exista API o Firestore compartido con Flotilla, solo se reemplaza el interior.
    window.opsFlotillaProvider = {
        async obtenerVehiculoActual(tecnicoId) {
            console.warn("[opsFlotillaProvider] obtenerVehiculoActual es un placeholder — no conectado a Flotilla todavía.", tecnicoId);
            return null; // { unidad, placas, marca, modelo, estado, fechaAsignacion, ubicacion, ultimaActualizacion }
        },
        async obtenerUbicacionesEnCampo() {
            console.warn("[opsFlotillaProvider] obtenerUbicacionesEnCampo es un placeholder — no conectado a Flotilla todavía.");
            return []; // [{ tecnicoId, lat, lng, estado, folioActual, ultimaActualizacion }]
        },
    };
    async function opsAuditar(entidad, entidadId, campo, valorAnterior, valorNuevo) {
        const { db, fs } = await opsGetFB();
        await fs.addDoc(fs.collection(db, COL_AUDITORIA), {
            entidad, entidadId, campo,
            valorAnterior: valorAnterior ?? null, valorNuevo: valorNuevo ?? null,
            usuarioEmail: opsUsuarioActual(), usuarioNombre: opsNombreActual(),
            fecha: opsFechaHora(),
        });
    }

    // Catálogo de puestos (Operaciones + departamentos ya existentes en el portal).
    // No es rígido: es un catálogo en Firestore que se puede editar/ampliar sin tocar código.
    const PUESTOS_SEED = [
        { nombre: "Gerente de Operaciones",              departamento: "Operaciones", permisos: ["admin_operaciones", "eliminar_solicitudes"] },
        { nombre: "Subgerente / Coordinador de Operaciones", departamento: "Operaciones", permisos: ["gestionar_herramientas", "gestionar_tecnicos", "autorizar_material", "eliminar_solicitudes"] },
        { nombre: "Auxiliar Administrativa",             departamento: "Operaciones", permisos: ["gestionar_herramientas", "solicitar_material"] },
        { nombre: "Auxiliar de Subgerencia/Coordinación", departamento: "Operaciones", permisos: ["solicitar_material", "consulta"] },
        { nombre: "Técnico de Operaciones",               departamento: "Operaciones", permisos: ["consulta_propia"] },
        // Departamentos ya existentes en el portal (index.html) — puesto genérico por si se liga una persona de otro depto.
        ...["Ingresos","Egresos","Contabilidad","Recursos Humanos","Marketing","Administración","Ventas","Pagos","Gestoría","Almacén","Compras","Flotilla","Contraloría"]
            .map(d => ({ nombre: d, departamento: d, permisos: d === "Almacén" ? ["gestionar_herramientas", "autorizar_material"] : ["consulta"] })),
    ];

    // Capa de integración ASPEL — placeholder intencional.
    // La UI llama SIEMPRE estas funciones, nunca a ASPEL directamente.
    // El día que exista la integración real, solo se reemplaza el interior de estas funciones.
    window.opsAspelAdapter = {
        async obtenerExistencia(claveProducto) {
            // TODO: conectar con ASPEL. Por ahora no hay dato de existencia en vivo —
            // el catálogo actual (catalogo/productos) solo trae clave/descripción, no stock.
            return null;
        },
        async registrarSalida(claveProducto, cantidad, contexto) {
            // TODO: conectar con ASPEL (salida de almacén por consumo de técnico).
            console.warn("[opsAspelAdapter] registrarSalida es un placeholder — no conectado a ASPEL todavía.", claveProducto, cantidad, contexto);
        },
    };

    const UBICACIONES = ["Almacén central", "Estación / cliente", "Vehículo", "Taller de reparación"];

    const ESTADOS_HERRAMIENTA = {
        disponible:  { label: "Disponible",       bg: "#dcfce7", fg: "#166534" },
        asignada:    { label: "Asignada",         bg: "#e0f2fe", fg: "#075985" },
        prestamo:    { label: "En préstamo",      bg: "#e0e7ff", fg: "#3730a3" },
        revision:    { label: "En revisión",      bg: "#fef9c3", fg: "#854d0e" },
        reparacion:  { label: "En reparación",    bg: "#fef3c7", fg: "#92400e" },
        danada:      { label: "Dañada",           bg: "#fee2e2", fg: "#991b1b" },
        extraviada:  { label: "Extraviada",       bg: "#fce7f3", fg: "#9d174d" },
        garantia:    { label: "En garantía",      bg: "#ede9fe", fg: "#5b21b6" },
        baja:        { label: "Baja",             bg: "#e5e7eb", fg: "#374151" },
    };

    const ICON = {
        wrench: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        close:  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        plus:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
        user:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
        box:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
        check:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        alert:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
        trash:  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
        search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
        clock:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
        back:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
        gear:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        bell:   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    };

    // Catálogo base (mismo listado de "AYUDA VISUAL / HERRAMIENTA BÁSICA PARA SERVICIOS")
    // Se usa solo para el sembrado inicial; cada pieza recibe un folio HT-XXXXXX real.
    const CATALOGO_BASE = [
        ["Juego de dados Stanley", "Herramienta manual", "Juegos"],
        ["Jgo. llaves españolas std. de 9 piezas", "Herramienta manual", "Juegos"],
        ["Jgo. llaves españolas mm de 9 piezas", "Herramienta manual", "Juegos"],
        ["Llave Stilson 8\" Urrea", "Herramienta manual", "Llaves"],
        ["Llave Stilson 14\" Urrea", "Herramienta manual", "Llaves"],
        ["Llave Stilson 18\" Urrea", "Herramienta manual", "Llaves"],
        ["Juego llaves Allen std. tipo L", "Herramienta manual", "Juegos"],
        ["Juego llaves Allen mm tipo L", "Herramienta manual", "Juegos"],
        ["Pinzas electricista Urrea", "Herramienta manual", "Pinzas"],
        ["Pinzas de punta Urrea", "Herramienta manual", "Pinzas"],
        ["Juego desarmadores ámbar 8 piezas", "Herramienta manual", "Juegos"],
        ["Llave universal de cadena Urrea", "Herramienta manual", "Llaves"],
        ["Multímetro Steren MUL-108", "Instrumento de medición", "Eléctrico"],
        ["Llave ajustable 10\" (Crescent)", "Herramienta manual", "Llaves"],
        ["Llave ajustable 15\" (Crescent)", "Herramienta manual", "Llaves"],
        ["Marro 4 lb mango fibra de vidrio", "Herramienta manual", "Golpe"],
        ["Pinzas de presión 10\" (perras)", "Herramienta manual", "Pinzas"],
        ["Arco de segueta", "Herramienta manual", "Corte"],
        ["Caja de herramienta Husky 3 niveles", "Contenedor", "Almacenaje"],
        ["Pinzas de corte diagonal Urrea", "Herramienta manual", "Pinzas"],
        ["Taladro inalámbrico DeWalt brushless", "Herramienta eléctrica", "Taladros"],
        ["Sopladora de aire con cargador", "Herramienta eléctrica", "Sopladoras"],
    ];

    let opsFB = null;
    let unsubHerr = null, unsubTec = null, unsubMov = null, unsubSurt = null;
    let cacheHerr = [], cacheTec = [], cacheMov = [], cacheSurtidos = [];
    let tabActual = "dashboard";
    let filtroHerr = "", filtroTec = "";

    async function opsGetFB() {
        if (opsFB) return opsFB;
        const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        opsFB = { db: window.db, fs };
        return opsFB;
    }

    function opsEsc(s) {
        return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function opsHoy() { return new Date().toISOString().slice(0, 10); }
    function opsFechaHora() { return new Date().toISOString(); }
    function opsUsuarioActual() {
        return (window.auth && window.auth.currentUser && window.auth.currentUser.email) || "desconocido";
    }
    function opsNombreActual() {
        return (window.nombreUsuario && window.nombreUsuario(opsUsuarioActual())) || opsUsuarioActual();
    }

    // ── Roles / permisos (catálogo configurable de puestos, no fijo en código) ──
    let cachePuestos = [];
    let cachePersonas = [];
    let cacheHistPuesto = [];
    let cacheAlmacenTec = [];
    let cacheGuardias = [];
    let catalogoProductos = []; // de catalogo/productos (Almacén real), cargado bajo demanda

    async function opsSembrarPuestosSiNecesario() {
        const { db, fs } = await opsGetFB();
        const snap = await fs.getDocs(fs.collection(db, COL_PUESTOS));
        if (!snap.empty) return;
        for (const p of PUESTOS_SEED) {
            await fs.addDoc(fs.collection(db, COL_PUESTOS), p);
        }
    }

    function opsRolActual() {
        // Puente de compatibilidad con el esquema anterior (admin/almacén/consulta),
        // usado como respaldo cuando el usuario no tiene una Persona ligada todavía.
        const email = opsUsuarioActual();
        if (window.esAdminTotal && window.esAdminTotal(email)) return "administrador";
        const almacen = (window.USUARIOS_AREA && window.USUARIOS_AREA["Almacen"]) || [];
        if (almacen.map(e => e.toLowerCase()).includes(email.toLowerCase())) return "almacen";
        return "consulta";
    }

    function opsPermisosActuales() {
        if (window.esAdminTotal && window.esAdminTotal(opsUsuarioActual())) {
            return PUESTOS_SEED.flatMap(p => p.permisos).concat(["admin_operaciones"]); // acceso total
        }
        const rolLegado = opsRolActual();
        if (rolLegado === "almacen") return ["gestionar_herramientas", "autorizar_material", "solicitar_material"];
        return ["consulta"];
    }

    function opsPuedeHacer(accion) {
        return opsPermisosActuales().includes(accion) || opsPermisosActuales().includes("admin_operaciones");
    }
    // Alias de compatibilidad con el código ya escrito en este archivo.
    function opsPuedeGestionar() {
        return opsPuedeHacer("gestionar_herramientas");
    }

    // ── Contadores atómicos para folios permanentes ──────────────────
    async function opsSiguienteFolioHerramienta() {
        const { db, fs } = await opsGetFB();
        const ref = fs.doc(db, COL_CONTADORES, "herramientas");
        const n = await fs.runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const actual = snap.exists() ? (snap.data().valor || 0) : 0;
            const siguiente = actual + 1;
            tx.set(ref, { valor: siguiente }, { merge: true });
            return siguiente;
        });
        return "HT-" + String(n).padStart(6, "0");
    }
    async function opsSiguienteNumeroTecnico() {
        const { db, fs } = await opsGetFB();
        const ref = fs.doc(db, COL_CONTADORES, "tecnicos");
        const n = await fs.runTransaction(db, async (tx) => {
            const snap = await tx.get(ref);
            const actual = snap.exists() ? (snap.data().valor || 0) : 0;
            const siguiente = actual + 1;
            tx.set(ref, { valor: siguiente }, { merge: true });
            return siguiente;
        });
        return "TEC-" + String(n).padStart(3, "0");
    }

    // ── Registrar un movimiento (nunca se edita ni se borra) ──────────
    async function opsRegistrarMovimiento(datos) {
        const { db, fs } = await opsGetFB();
        await fs.addDoc(fs.collection(db, COL_MOVIMIENTOS), {
            herramientaId: datos.herramientaId,
            tecnicoAnteriorId: datos.tecnicoAnteriorId || null,
            tecnicoNuevoId: datos.tecnicoNuevoId || null,
            ubicacionAnterior: datos.ubicacionAnterior || null,
            ubicacionNueva: datos.ubicacionNueva || null,
            tipo: datos.tipo,
            motivo: datos.motivo || null,
            observaciones: datos.observaciones || null,
            usuarioEmail: opsUsuarioActual(),
            usuarioNombre: opsNombreActual(),
            fecha: opsFechaHora(),
        });
    }

    // ═══════════════ RESPONSIVA PDF INDIVIDUAL (jsPDF) ═══════════════
    // Genera un PDF de una sola pieza con los datos REALES de Firestore
    // (folio HT-XXXXXX, técnico, fecha de asignación) — mismo diseño
    // azul/rojo/gris ya aprobado. Se dispara sola al confirmar una
    // asignación/transferencia, y también desde un botón manual en la
    // ficha de la herramienta mientras esté "asignada".
    const PDF_AZUL = [10, 46, 92];
    const PDF_ROJO = [192, 24, 45];
    const PDF_GRIS = [88, 89, 91];
    const PDF_GRIS_LINEA = [191, 192, 194];
    const PDF_GRIS_CLARO = [233, 233, 234];

    function opsGenerarResponsivaPDF(herramientaId, silencioso) {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            console.error("[operaciones.js] jsPDF no está cargado.");
            return;
        }
        const h = cacheHerr.find(x => x.id === herramientaId);
        if (!h || !h.tecnicoActualId) return;
        const t = cacheTec.find(x => x.id === h.tecnicoActualId);
        if (!t) return;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "pt", format: "letter" });
        const W = 612, M = 46;
        let y;

        // Banda superior azul + filete rojo
        doc.setFillColor(...PDF_AZUL); doc.rect(0, 0, W, 68, "F");
        doc.setFillColor(...PDF_ROJO); doc.rect(0, 68, W, 3, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold"); doc.setFontSize(15);
        doc.text("HEDMA TECNOCONTROL", M, 30);
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
        doc.text("S.A. DE C.V.  ·  Chihuahua, Chihuahua, México", M, 46);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("Responsiva N.°: RH-" + h.folio, W - M, 27, { align: "right" });
        doc.setFont("helvetica", "normal");
        doc.text("Fecha: " + (h.fechaAsignacion || opsHoy()), W - M, 42, { align: "right" });

        y = 96;
        doc.setTextColor(...PDF_ROJO); doc.setFont("helvetica", "bold"); doc.setFontSize(15);
        doc.text("RESPONSIVA DE ASIGNACIÓN DE HERRAMIENTA", W / 2, y, { align: "center" });
        y += 16;
        doc.setTextColor(...PDF_GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
        doc.text("Departamento de Operaciones  |  Control de Herramientas", W / 2, y, { align: "center" });

        function seccion(titulo) {
            y += 22;
            doc.setFillColor(...PDF_AZUL); doc.rect(M, y - 12, W - 2 * M, 20, "F");
            doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
            doc.text(titulo, M + 8, y + 2);
            y += 18;
        }
        function campo(label, valor) {
            doc.setTextColor(...PDF_GRIS); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
            doc.text(label, M, y);
            doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "normal"); doc.setFontSize(10);
            doc.text(String(valor || "—"), M + 130, y);
            y += 16;
        }

        seccion("1  ·  DATOS DEL EMPLEADO");
        campo("Nombre completo:", t.nombre);
        campo("N.° operativo:", t.numeroOperativo);
        campo("Puesto:", t.puesto);
        campo("Departamento:", t.departamento);
        campo("Fecha de asignación:", h.fechaAsignacion || opsHoy());

        seccion("2  ·  HERRAMIENTA ASIGNADA");
        campo("Folio (permanente):", h.folio);
        campo("Descripción:", h.descripcion);
        campo("Marca / modelo:", (h.marca || "—") + " " + (h.modelo || ""));
        campo("N.° de serie:", h.numeroSerie || "—");
        campo("Ubicación:", h.ubicacionActual || "—");

        seccion("3  ·  TÉRMINOS DE LA RESPONSIVA");
        const clausulas = [
            "Recibo de conformidad la herramienta descrita arriba, en las condiciones señaladas, para uso exclusivo en mis funciones dentro de HEDMA TECNOCONTROL S.A. DE C.V.",
            "Me comprometo a dar buen uso, resguardo y mantenimiento a la herramienta, y a reportar de inmediato cualquier falla, pérdida, robo o extravío al Departamento de Operaciones.",
            "En caso de pérdida, extravío o daño por negligencia comprobada, acepto que el costo de reposición o reparación podrá ser descontado conforme a la política interna vigente.",
            "La herramienta es propiedad de HEDMA TECNOCONTROL S.A. DE C.V. y deberá devolverse íntegra al concluir la asignación o al término de la relación laboral, lo que ocurra primero.",
        ];
        doc.setDrawColor(...PDF_GRIS_LINEA); doc.setLineWidth(0.8);
        const cajaY0 = y - 4;
        doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "normal"); doc.setFontSize(8.7);
        clausulas.forEach(c => {
            const lineas = doc.splitTextToSize("•  " + c, W - 2 * M - 16);
            doc.text(lineas, M + 8, y);
            y += lineas.length * 11 + 5;
        });
        doc.rect(M, cajaY0, W - 2 * M, y - cajaY0 + 4);
        doc.setFillColor(...PDF_ROJO); doc.rect(M, cajaY0, 3, y - cajaY0 + 4, "F");
        y += 26;

        seccion("4  ·  FIRMAS DE ENTREGA-RECEPCIÓN");
        y += 34;
        const colW = (W - 2 * M - 20) / 2;
        doc.setDrawColor(...PDF_GRIS_LINEA);
        doc.line(M, y, M + colW, y);
        doc.line(M + colW + 20, y, M + 2 * colW + 20, y);
        y += 12;
        doc.setTextColor(...PDF_AZUL); doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text("QUIEN ENTREGA", M + colW / 2, y, { align: "center" });
        doc.text("QUIEN RECIBE", M + colW + 20 + colW / 2, y, { align: "center" });
        y += 12;
        doc.setTextColor(...PDF_GRIS); doc.setFont("helvetica", "normal"); doc.setFontSize(7.6);
        doc.text("Responsable de Operaciones / Almacén", M + colW / 2, y, { align: "center" });
        doc.text(t.nombre + " — Nombre y firma", M + colW + 20 + colW / 2, y, { align: "center" });

        doc.setTextColor(...PDF_GRIS); doc.setFontSize(7.3);
        doc.text("HEDMA TECNOCONTROL S.A. DE C.V. · Generado automáticamente desde Control de Herramientas · " + opsFechaHora().slice(0, 16).replace("T", " "), M, 770);

        const nombreArchivo = "Responsiva_" + h.folio + "_" + t.numeroOperativo + ".pdf";
        doc.save(nombreArchivo);
        if (!silencioso && window.mostrarPush) mostrarPush("Herramientas", "Responsiva PDF generada: " + nombreArchivo, "📄");
    }
    window.opsGenerarResponsivaPDF = opsGenerarResponsivaPDF;

    function opsNombreTecnico(idInterno) {
        if (!idInterno) return "Sin asignar";
        const t = cacheTec.find(x => x.id === idInterno);
        return t ? `${t.nombre} (${t.numeroOperativo})` : "Técnico desconocido";
    }

    // ═══════════════════════ MONTAJE / OVERLAY ═══════════════════════
    window.opsAbrirHerramientas = async function () {
        const cont = document.getElementById("ops-herramientas-overlay");
        if (!cont) return;
        cont.innerHTML = opsRenderShell();
        cont.style.display = "block";
        document.body.style.overflow = "hidden";
        await opsSembrarPuestosSiNecesario();
        await opsSuscribirTodo();
        opsCambiarTab("resumen");
    };

    window.opsCerrarHerramientas = function () {
        const cont = document.getElementById("ops-herramientas-overlay");
        if (cont) cont.style.display = "none";
        document.body.style.overflow = "";
        if (unsubHerr) { unsubHerr(); unsubHerr = null; }
        if (unsubTec)  { unsubTec();  unsubTec = null; }
        if (unsubMov)  { unsubMov();  unsubMov = null; }
        if (unsubSurt) { unsubSurt(); unsubSurt = null; }
    };

    function opsRenderShell() {
        const rol = opsRolActual();
        const rolLabel = { administrador: "Administrador", almacen: "Almacén", consulta: "Consulta" }[rol];
        return `
        <div style="position:fixed;inset:0;z-index:99997;background:#f1f5f9;overflow-y:auto;font-family:'Inter',sans-serif;">
            <div style="background:linear-gradient(135deg,#0B5FFF,#0842B0);border-bottom:3px solid #062F73;padding:16px 26px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:5;">
                <div style="display:flex;align-items:center;gap:10px;color:#fff;">
                    <span style="width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${ICON.wrench}</span>
                    <div>
                        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15.5px;">Operaciones</div>
                        <div style="font-size:11px;color:#9ca3af;">Operaciones · Hedma Tecnocontrol · Rol: ${rolLabel}</div>
                    </div>
                </div>
                <button onclick="opsCerrarHerramientas()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer;">${ICON.close}</button>
            </div>

            <div style="max-width:1200px;margin:0 auto;padding:18px 26px 60px;">
                <div style="display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid #e2e8f0;">
                    ${["resumen:Resumen", "dashboard:Herramientas", "guardias:Guardias", "tecnicos:Técnicos", "servicios:Servicios",
                       ...(opsPuedeHacer("autorizar_material") ? ["solicitudes:Solicitudes"] : []),
                       "alertas:Alertas", "movimientos:Movimientos"].map(t => {
                        const [id, label] = t.split(":");
                        return `<button onclick="opsCambiarTab('${id}')" id="ops-tab-${id}" class="ops-tab-btn" style="background:none;border:none;padding:9px 14px;font-size:12.5px;font-weight:600;color:#64748b;cursor:pointer;border-bottom:2px solid transparent;">${label}</button>`;
                    }).join("")}
                </div>
                <div id="ops-tab-content"></div>
            </div>
        </div>
        <div id="ops-modal-wrap"></div>
        <div id="ops-panel-wrap"></div>
        `;
    }

    window.opsCambiarTab = function (tab) {
        tabActual = tab;
        document.querySelectorAll(".ops-tab-btn").forEach(b => {
            b.style.color = "#64748b"; b.style.borderBottomColor = "transparent";
        });
        const activo = document.getElementById("ops-tab-" + tab);
        if (activo) { activo.style.color = "#0B5FFF"; activo.style.borderBottomColor = "#0B5FFF"; }
        if (tab === "resumen") opsRenderResumen();
        else if (tab === "dashboard") opsRenderDashboard();
        else if (tab === "guardias") opsRenderGuardias();
        else if (tab === "tecnicos") opsRenderTecnicos();
        else if (tab === "servicios") opsRenderServicios();
        else if (tab === "solicitudes") opsRenderSolicitudes();
        else if (tab === "alertas") opsRenderAlertas();
        else if (tab === "movimientos") opsRenderMovimientos();
    };

    // ── Suscripciones en tiempo real ──────────────────────────────
    async function opsSuscribirTodo() {
        const { db, fs } = await opsGetFB();
        if (!unsubHerr) {
            unsubHerr = fs.onSnapshot(fs.query(fs.collection(db, COL_HERRAMIENTAS), fs.orderBy("folio")), snap => {
                cacheHerr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "dashboard") opsRenderDashboard();
                if (tabActual === "resumen") opsRenderResumen();
            });
        }
        if (!unsubTec) {
            unsubTec = fs.onSnapshot(fs.query(fs.collection(db, COL_TECNICOS), fs.orderBy("numeroOperativo")), snap => {
                cacheTec = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "tecnicos") opsRenderTecnicos();
                if (tabActual === "dashboard") opsRenderDashboard();
                if (tabActual === "resumen") opsRenderResumen();
            });
        }
        if (!unsubMov) {
            unsubMov = fs.onSnapshot(fs.query(fs.collection(db, COL_MOVIMIENTOS), fs.orderBy("fecha", "desc"), fs.limit(200)), snap => {
                cacheMov = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "movimientos") opsRenderMovimientos();
                if (tabActual === "resumen") opsRenderResumen();
            });
        }
        if (!unsubSurt) {
            unsubSurt = fs.onSnapshot(fs.query(fs.collection(db, COL_SURTIDOS), fs.orderBy("createdAt", "desc"), fs.limit(100)), snap => {
                cacheSurtidos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "resumen") opsRenderResumen();
                if (tabActual === "solicitudes") opsRenderSolicitudes();
                if (tabActual === "alertas") opsRenderAlertas();
            }, () => { /* si aún no existe la colección o el índice, Resumen simplemente muestra 0 */ });
        }
        // Puestos, personas, historial de puesto y almacén de técnico: se leen una vez
        // por apertura (no cambian con la frecuencia de herramientas/movimientos).
        const snapPuestos = await fs.getDocs(fs.collection(db, COL_PUESTOS));
        cachePuestos = snapPuestos.docs.map(d => ({ id: d.id, ...d.data() }));
        const snapPersonas = await fs.getDocs(fs.collection(db, COL_PERSONAS));
        cachePersonas = snapPersonas.docs.map(d => ({ id: d.id, ...d.data() }));
        const snapHist = await fs.getDocs(fs.collection(db, COL_HIST_PUESTO));
        cacheHistPuesto = snapHist.docs.map(d => ({ id: d.id, ...d.data() }));
        const snapAlmTec = await fs.getDocs(fs.collection(db, COL_ALMACEN_TEC));
        cacheAlmacenTec = snapAlmTec.docs.map(d => ({ id: d.id, ...d.data() }));
        const snapGuardias = await fs.getDocs(fs.collection(db, COL_GUARDIAS));
        cacheGuardias = snapGuardias.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ═══════════════════════ TAB: DASHBOARD ═══════════════════════
    // ═══════════════════════ TAB: RESUMEN (vista general del departamento) ═══════════════════════
    function opsRenderResumen() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;

        const tecActivos = cacheTec.filter(t => t.estatus === "activo");
        const tecBaja = cacheTec.filter(t => t.estatus === "baja");
        const totalHerr = cacheHerr.length;
        const asignadas = cacheHerr.filter(h => h.estado === "asignada").length;
        const danadas = cacheHerr.filter(h => ["danada", "extraviada", "reparacion", "revision"].includes(h.estado)).length;
        const solicitudesOps = cacheSurtidos.filter(s => s.origen === "operaciones");
        const pendientes = solicitudesOps.filter(s => s.estado === "pendiente");
        const urgentes = pendientes.filter(s => s.prioridad === "urgente").length;

        // Cierre operativo pendiente: técnicos de baja que por alguna razón todavía
        // conservan herramientas o material (no debería pasar con el flujo nuevo,
        // pero sirve como red de seguridad ante datos migrados/manuales).
        const inconsistencias = tecBaja.map(t => {
            const herrPend = cacheHerr.filter(h => h.tecnicoActualId === t.id).length;
            const matPend = cacheAlmacenTec.filter(m => m.tecnicoId === t.id && m.cantidad > 0).length;
            return { t, herrPend, matPend };
        }).filter(x => x.herrPend > 0 || x.matPend > 0);

        const avatar = (nombre, activo) => {
            const ini = (nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
            const bg = activo ? "linear-gradient(135deg,#1f2937,#0a2e5c)" : "#94a3b8";
            return `<div style="width:34px;height:34px;border-radius:50%;background:${bg};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">${opsEsc(ini)}</div>`;
        };

        const listaTecnicos = [...tecActivos, ...tecBaja].slice(0, 6).map(t => {
            const activo = t.estatus === "activo";
            return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsCambiarTab('tecnicos');setTimeout(()=>opsAbrirFichaTecnico('${t.id}'),50)">
                ${avatar(t.nombre, activo)}
                <div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:600;color:#1e293b;">${opsEsc(t.nombre)}</div><div style="font-size:10.5px;color:#64748b;">${opsEsc(t.puesto || "—")} · N.° ${opsEsc(t.numeroOperativo)}</div></div>
                <span style="background:${activo ? "#dcfce7" : "#e5e7eb"};color:${activo ? "#166534" : "#374151"};font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;">${activo ? "Activo" : "Baja"}</span>
            </div>`;
        }).join("") || '<div style="color:#94a3b8;font-size:12px;padding:8px 0;">Sin técnicos registrados todavía.</div>';

        const actividad = cacheMov.slice(0, 5).map(m => {
            const color = { asignacion: "#0891b2", transferencia: "#0891b2", devolucion: "#059669", baja: "#b91c1c", danio: "#b91c1c", perdida: "#b91c1c", reparacion: "#b45309" }[m.tipo] || "#64748b";
            return `<div style="margin-bottom:10px;position:relative;">
                <div style="position:absolute;left:-17px;top:3px;width:7px;height:7px;border-radius:50%;background:${color};"></div>
                <div style="font-size:11.5px;color:#334155;">${opsEsc(m.tipo)} · ${opsEsc(m.herramientaId)}</div>
                <div style="font-size:10px;color:#94a3b8;">${opsEsc((m.fecha || "").slice(0, 16).replace("T", " "))}</div>
            </div>`;
        }).join("") || '<div style="color:#94a3b8;font-size:12px;">Sin actividad reciente.</div>';

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px;">
                <div style="background:#fff;border-radius:12px;padding:14px 16px;">
                    <div style="font-size:10.5px;color:#94a3b8;">Técnicos activos</div>
                    <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:2px;">${tecActivos.length}</div>
                </div>
                <div style="background:#fff;border-radius:12px;padding:14px 16px;">
                    <div style="font-size:10.5px;color:#94a3b8;">Herramientas asignadas</div>
                    <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:2px;">${asignadas} / ${totalHerr}</div>
                    <div style="height:4px;background:#e2e8f0;border-radius:99px;margin-top:6px;overflow:hidden;"><div style="height:100%;width:${totalHerr ? Math.round(asignadas / totalHerr * 100) : 0}%;background:#0891b2;"></div></div>
                </div>
                <div style="background:#fff;border-radius:12px;padding:14px 16px;">
                    <div style="font-size:10.5px;color:#94a3b8;">Solicitudes pendientes</div>
                    <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:2px;">${pendientes.length}</div>
                    ${urgentes ? `<div style="font-size:10px;color:#b45309;margin-top:3px;">${urgentes} urgente(s)</div>` : ""}
                </div>
                <div style="background:#fff;border-radius:12px;padding:14px 16px;">
                    <div style="font-size:10.5px;color:#94a3b8;">Reparación / dañadas</div>
                    <div style="font-size:20px;font-weight:700;color:#1e293b;margin-top:2px;">${danadas}</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px;">
                <div style="background:#fff;border-radius:12px;padding:16px 18px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Técnicos</div>
                        <span style="font-size:11px;color:#0891b2;cursor:pointer;" onclick="opsCambiarTab('tecnicos')">Ver todos</span>
                    </div>
                    ${listaTecnicos}
                </div>
                <div style="display:flex;flex-direction:column;gap:12px;">
                    <div style="background:#fff;border-radius:12px;padding:16px 18px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:10px;">Actividad reciente</div>
                        <div style="border-left:2px solid #e2e8f0;padding-left:12px;">${actividad}</div>
                    </div>
                    ${inconsistencias.length ? `
                    <div style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);border-radius:12px;padding:16px 18px;color:#fff;">
                        <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;">Cierre operativo pendiente</div>
                        ${inconsistencias.map(x => `<div style="font-size:11px;color:#d1d5db;line-height:1.5;">${opsEsc(x.t.nombre)} (baja) tiene ${x.herrPend ? x.herrPend + " herramienta(s)" : ""}${x.herrPend && x.matPend ? " y " : ""}${x.matPend ? x.matPend + " material(es)" : ""} sin devolver.</div>`).join("")}
                        <button onclick="opsCambiarTab('tecnicos')" style="margin-top:10px;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:11px;font-weight:600;padding:6px 12px;border-radius:7px;cursor:pointer;">Resolver ahora</button>
                    </div>` : ""}
                </div>
            </div>`;
    }

    function opsRenderDashboard() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        const total = cacheHerr.length;
        const conteo = {};
        cacheHerr.forEach(h => { conteo[h.estado] = (conteo[h.estado] || 0) + 1; });
        const kpis = [
            { label: "Total registradas", valor: total, color: "#1f2937", icon: ICON.box },
            { label: "Disponibles", valor: conteo.disponible || 0, color: "#059669", icon: ICON.check },
            { label: "Asignadas", valor: conteo.asignada || 0, color: "#0891b2", icon: ICON.user },
            { label: "En reparación / revisión", valor: (conteo.reparacion || 0) + (conteo.revision || 0), color: "#b45309", icon: ICON.alert },
            { label: "Dañadas / extraviadas", valor: (conteo.danada || 0) + (conteo.extraviada || 0), color: "#b91c1c", icon: ICON.alert },
            { label: "Dadas de baja", valor: conteo.baja || 0, color: "#6b7280", icon: ICON.trash },
        ];

        const gestion = opsPuedeGestionar();
        const filtro = filtroHerr.trim().toLowerCase();
        const lista = cacheHerr.filter(h => !filtro
            || (h.folio || "").toLowerCase().includes(filtro)
            || (h.descripcion || "").toLowerCase().includes(filtro)
            || (h.marca || "").toLowerCase().includes(filtro)
            || opsNombreTecnico(h.tecnicoActualId).toLowerCase().includes(filtro));

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
                ${kpis.map(k => `
                    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:13px 15px;display:flex;align-items:center;gap:11px;">
                        <span style="width:32px;height:32px;border-radius:9px;background:${k.color}15;color:${k.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${k.icon}</span>
                        <div><div style="font-size:19px;font-weight:700;color:#1e293b;line-height:1;">${k.valor}</div><div style="font-size:10.5px;color:#64748b;margin-top:3px;">${k.label}</div></div>
                    </div>`).join("")}
            </div>
            <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 18px;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="color:#94a3b8;">${ICON.search}</span>
                        <input type="text" placeholder="Buscar por folio, descripción, marca o técnico..." oninput="opsFiltrarHerr(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;font-size:12.5px;width:300px;outline:none;">
                    </div>
                    ${gestion ? `
                    <div style="display:flex;gap:8px;">
                        <button onclick="opsAbrirModalPieza()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">${ICON.plus} Nueva pieza</button>
                        <button onclick="opsSembrarCatalogoBase()" class="mkt-add-btn" style="background:linear-gradient(135deg,#0891b2,#0e7490);">${ICON.box} Cargar catálogo base</button>
                    </div>` : ""}
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12.3px;">
                        <thead><tr style="background:#1f2937;color:#fff;text-align:left;">
                            <th style="padding:8px 10px;border-radius:8px 0 0 8px;">Folio</th>
                            <th style="padding:8px 10px;">Descripción</th>
                            <th style="padding:8px 10px;">Estado</th>
                            <th style="padding:8px 10px;">Técnico asignado</th>
                            <th style="padding:8px 10px;">Ubicación</th>
                            <th style="padding:8px 10px;border-radius:0 8px 8px 0;text-align:right;">Acciones</th>
                        </tr></thead>
                        <tbody>${lista.length ? lista.map((h, i) => opsFilaHerramienta(h, i, gestion)).join("") : `<tr><td colspan="6" style="padding:22px;text-align:center;color:#94a3b8;">Sin herramienta registrada. ${gestion ? 'Usa "Cargar catálogo base" o "Nueva pieza".' : ''}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;

        const badge = document.getElementById("ops-badge-count-herr");
        if (badge) badge.textContent = String(total);
    }

    function opsFilaHerramienta(h, i, gestion) {
        const e = ESTADOS_HERRAMIENTA[h.estado] || ESTADOS_HERRAMIENTA.disponible;
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        return `<tr style="background:${zebra};border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsAbrirFichaHerramienta('${h.id}')">
            <td style="padding:8px 10px;font-weight:600;color:#334155;">${opsEsc(h.folio)}</td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(h.descripcion)}${h.folioLegado ? ` <span style="color:#94a3b8;font-size:10.5px;">(ex ${opsEsc(h.folioLegado)})</span>` : ""}</td>
            <td style="padding:8px 10px;"><span style="background:${e.bg};color:${e.fg};font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;">${e.label}</span></td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(opsNombreTecnico(h.tecnicoActualId))}</td>
            <td style="padding:8px 10px;color:#64748b;">${opsEsc(h.ubicacionActual || "—")}</td>
            <td style="padding:8px 10px;text-align:right;" onclick="event.stopPropagation()">
                ${gestion && h.estado !== "baja" ? `<button onclick="opsAbrirModalMovimiento('${h.id}')" style="background:#eef2f7;border:none;color:#1f2937;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">Mover</button>` : ""}
            </td>
        </tr>`;
    }

    window.opsFiltrarHerr = function (v) { filtroHerr = v || ""; opsRenderDashboard(); };

    // ── Ficha de herramienta (panel lateral) ──────────────────────
    window.opsAbrirFichaHerramienta = function (id) {
        const h = cacheHerr.find(x => x.id === id);
        if (!h) return;
        const e = ESTADOS_HERRAMIENTA[h.estado] || ESTADOS_HERRAMIENTA.disponible;
        const historial = cacheMov.filter(m => m.herramientaId === id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
        const gestion = opsPuedeGestionar();
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:440px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div>
                        <div style="font-size:11px;color:#94a3b8;font-weight:600;">${opsEsc(h.folio)}</div>
                        <div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(h.descripcion)}</div>
                    </div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                <span style="background:${e.bg};color:${e.fg};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;">${e.label}</span>

                <div style="margin-top:16px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Categoría:</strong> ${opsEsc(h.categoria || "—")}</div>
                    <div><strong>Marca / modelo:</strong> ${opsEsc(h.marca || "—")} ${opsEsc(h.modelo || "")}</div>
                    <div><strong>N.° de serie:</strong> ${opsEsc(h.numeroSerie || "—")}</div>
                    <div><strong>Ubicación actual:</strong> ${opsEsc(h.ubicacionActual || "—")}</div>
                    <div><strong>Técnico asignado:</strong> ${opsEsc(opsNombreTecnico(h.tecnicoActualId))}</div>
                    ${h.fechaAsignacion ? `<div><strong>Fecha de asignación:</strong> ${opsEsc(h.fechaAsignacion)}</div>` : ""}
                    ${h.folioLegado ? `<div><strong>Folio legado (migración):</strong> ${opsEsc(h.folioLegado)}</div>` : ""}
                    ${h.observaciones ? `<div><strong>Observaciones:</strong> ${opsEsc(h.observaciones)}</div>` : ""}
                </div>

                ${gestion && h.estado !== "baja" ? `
                <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="opsAbrirModalMovimiento('${id}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Registrar movimiento</button>
                    ${h.estado === "asignada" ? `<button onclick="opsGenerarResponsivaPDF('${id}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#0891b2,#0e7490);">Regenerar responsiva PDF</button>` : ""}
                    <button onclick="opsAbrirModalBaja('${id}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);">${ICON.trash} Dar de baja</button>
                </div>` : ""}

                <div style="margin-top:22px;font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;">${ICON.clock} Historial de movimientos</div>
                <div style="margin-top:10px;border-left:2px solid #e2e8f0;padding-left:14px;">
                    ${historial.length ? historial.map(m => opsTimelineItem(m)).join("") : '<div style="color:#94a3b8;font-size:12px;padding:6px 0;">Sin movimientos registrados.</div>'}
                </div>
            </div>
        </div>`;
    };

    function opsTimelineItem(m) {
        const tipoLabel = {
            alta: "Alta en almacén", asignacion: "Asignación", devolucion: "Devolución",
            reparacion: "Enviada a reparación", retorno_reparacion: "Regresó de reparación",
            perdida: "Reportada como pérdida", danio: "Reportada con daño",
            baja: "Baja", transferencia: "Transferencia",
        }[m.tipo] || m.tipo;
        return `<div style="margin-bottom:14px;position:relative;">
            <div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#1f2937;"></div>
            <div style="font-size:12px;font-weight:600;color:#1e293b;">${opsEsc(tipoLabel)}</div>
            <div style="font-size:11px;color:#64748b;">${opsEsc((m.fecha || "").slice(0, 16).replace("T", " "))} · ${opsEsc(m.usuarioNombre || m.usuarioEmail || "")}</div>
            ${m.tecnicoNuevoId ? `<div style="font-size:11.5px;color:#334155;">→ ${opsEsc(opsNombreTecnico(m.tecnicoNuevoId))}</div>` : ""}
            ${m.motivo ? `<div style="font-size:11.5px;color:#334155;">Motivo: ${opsEsc(m.motivo)}</div>` : ""}
            ${m.observaciones ? `<div style="font-size:11.5px;color:#64748b;">${opsEsc(m.observaciones)}</div>` : ""}
        </div>`;
    }

    // ── Alta de pieza nueva ────────────────────────────────────────
    window.opsAbrirModalPieza = function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">Nueva pieza de herramienta</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Descripción</label>
                <input id="ops-in-desc" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Marca</label>
                    <input id="ops-in-marca" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Modelo</label>
                    <input id="ops-in-modelo" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Categoría</label>
                <input id="ops-in-cat" placeholder="Ej. Herramienta eléctrica" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">N.° de serie (opcional)</label>
                <input id="ops-in-serie" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarPieza()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Generar folio y guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarPieza = async function () {
        const descripcion = document.getElementById("ops-in-desc").value.trim();
        if (!descripcion) { alert("La descripción es obligatoria"); return; }
        const marca = document.getElementById("ops-in-marca").value.trim();
        const modelo = document.getElementById("ops-in-modelo").value.trim();
        const categoria = document.getElementById("ops-in-cat").value.trim();
        const numeroSerie = document.getElementById("ops-in-serie").value.trim();
        const { db, fs } = await opsGetFB();
        const folio = await opsSiguienteFolioHerramienta();
        await fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, folio), {
            folio, descripcion, marca, modelo, categoria, numeroSerie,
            estado: "disponible", ubicacionActual: UBICACIONES[0],
            tecnicoActualId: null, fechaAsignacion: null,
            folioLegado: null, observaciones: null,
            fechaAlta: opsHoy(),
            externalId: null, sourceSystem: "manual", lastSync: null, syncStatus: "no_sincronizado",
        });
        await opsRegistrarMovimiento({ herramientaId: folio, tipo: "alta", ubicacionNueva: UBICACIONES[0] });
        document.getElementById("ops-modal-wrap").innerHTML = "";
    };

    // ── Sembrado del catálogo base (folios HT-XXXXXX reales) ──────
    window.opsSembrarCatalogoBase = async function () {
        if (cacheHerr.length > 0 && !confirm("Ya hay piezas registradas. ¿Agregar de todos modos el catálogo base (22 piezas)?")) return;
        const { db, fs } = await opsGetFB();
        for (const [descripcion, categoria, subcategoria] of CATALOGO_BASE) {
            const folio = await opsSiguienteFolioHerramienta();
            await fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, folio), {
                folio, descripcion, categoria, subcategoria, marca: "", modelo: "", numeroSerie: "",
                estado: "disponible", ubicacionActual: UBICACIONES[0],
                tecnicoActualId: null, fechaAsignacion: null,
                folioLegado: null, observaciones: null,
                fechaAlta: opsHoy(),
                externalId: null, sourceSystem: "manual", lastSync: null, syncStatus: "no_sincronizado",
            });
            await opsRegistrarMovimiento({ herramientaId: folio, tipo: "alta", ubicacionNueva: UBICACIONES[0], observaciones: "Sembrado desde catálogo base" });
        }
        window.mostrarPush ? mostrarPush("Herramientas", "Catálogo base cargado con folios HT-XXXXXX.", "✅") : alert("Catálogo base cargado.");
    };

    // ── Modal de movimiento (asignar / devolver / reparación / pérdida / transferencia) ──
    window.opsAbrirModalMovimiento = function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        if (!h) return;
        const tecnicosActivos = cacheTec.filter(t => t.estatus === "activo");
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Registrar movimiento</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:14px;">${opsEsc(h.folio)} · ${opsEsc(h.descripcion)}</div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Tipo de movimiento</label>
                <select id="ops-in-tipomov" onchange="opsToggleCamposMovimiento()" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                    ${h.estado === "asignada" ? '<option value="devolucion">Devolución al almacén</option><option value="transferencia">Reasignar a otro técnico</option>' : '<option value="asignacion">Asignar a técnico</option>'}
                    <option value="reparacion">Enviar a reparación</option>
                    <option value="retorno_reparacion">Regresa de reparación</option>
                    <option value="perdida">Reportar pérdida</option>
                    <option value="danio">Reportar daño</option>
                    <option value="cambio_ubicacion">Cambio de ubicación</option>
                </select>

                <div id="ops-campo-tecnico" style="display:none;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Técnico</label>
                    <select id="ops-in-tecnico" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                        <option value="">Selecciona un técnico...</option>
                        ${tecnicosActivos.map(t => `<option value="${t.id}">${opsEsc(t.nombre)} (${opsEsc(t.numeroOperativo)})</option>`).join("")}
                    </select>
                </div>

                <div id="ops-campo-ubicacion" style="display:none;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nueva ubicación</label>
                    <select id="ops-in-ubicacion" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                        ${UBICACIONES.map(u => `<option value="${opsEsc(u)}">${opsEsc(u)}</option>`).join("")}
                    </select>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Condición / observaciones</label>
                <textarea id="ops-in-obs" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;resize:vertical;"></textarea>

                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsConfirmarMovimiento('${herramientaId}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Confirmar</button>
                </div>
            </div>
        </div>`;
        opsToggleCamposMovimiento();
    };

    window.opsToggleCamposMovimiento = function () {
        const tipo = document.getElementById("ops-in-tipomov").value;
        document.getElementById("ops-campo-tecnico").style.display = (tipo === "asignacion" || tipo === "transferencia") ? "block" : "none";
        document.getElementById("ops-campo-ubicacion").style.display = (tipo === "cambio_ubicacion") ? "block" : "none";
    };

    window.opsConfirmarMovimiento = async function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        const tipo = document.getElementById("ops-in-tipomov").value;
        const obs = document.getElementById("ops-in-obs").value.trim();
        const { db, fs } = await opsGetFB();
        const ref = fs.doc(db, COL_HERRAMIENTAS, herramientaId);

        const mapaEstado = {
            asignacion: "asignada", transferencia: "asignada", devolucion: "disponible",
            reparacion: "reparacion", retorno_reparacion: "disponible",
            perdida: "extraviada", danio: "danada", cambio_ubicacion: h.estado,
        };
        const nuevoEstado = mapaEstado[tipo] || h.estado;
        const update = { estado: nuevoEstado, observaciones: obs || h.observaciones || null };
        let tecnicoNuevoId = h.tecnicoActualId;

        if (tipo === "asignacion" || tipo === "transferencia") {
            tecnicoNuevoId = document.getElementById("ops-in-tecnico").value;
            if (!tecnicoNuevoId) { alert("Selecciona un técnico"); return; }
            update.tecnicoActualId = tecnicoNuevoId;
            update.fechaAsignacion = opsHoy();
        } else if (tipo === "devolucion" || tipo === "perdida" || tipo === "danio") {
            update.tecnicoActualId = null;
            update.fechaAsignacion = null;
        } else if (tipo === "cambio_ubicacion") {
            update.ubicacionActual = document.getElementById("ops-in-ubicacion").value;
        }

        await fs.updateDoc(ref, update);
        await opsRegistrarMovimiento({
            herramientaId, tipo,
            tecnicoAnteriorId: h.tecnicoActualId,
            tecnicoNuevoId: (tipo === "asignacion" || tipo === "transferencia") ? tecnicoNuevoId : null,
            ubicacionAnterior: h.ubicacionActual,
            ubicacionNueva: update.ubicacionActual || h.ubicacionActual,
            observaciones: obs,
        });
        document.getElementById("ops-modal-wrap").innerHTML = "";
        const panel = document.getElementById("ops-panel-wrap");
        if (panel) panel.innerHTML = "";

        if (tipo === "asignacion" || tipo === "transferencia") {
            // Refrescar caché local con los valores recién guardados antes de generar el PDF,
            // porque onSnapshot puede tardar unos ms en llegar.
            const idx = cacheHerr.findIndex(x => x.id === herramientaId);
            if (idx >= 0) cacheHerr[idx] = { ...cacheHerr[idx], ...update };
            opsGenerarResponsivaPDF(herramientaId);
        }
    };

    // ── Baja de herramienta (nunca se elimina el documento) ────────
    window.opsAbrirModalBaja = function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#b91c1c;margin-bottom:4px;">Dar de baja</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:14px;">${opsEsc(h.folio)} · ${opsEsc(h.descripcion)}. Esta acción no elimina el registro; conserva el historial permanentemente.</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Motivo</label>
                <select id="ops-in-motivobaja" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                    <option>Daño irreparable</option><option>Pérdida</option><option>Robo</option>
                    <option>Desgaste</option><option>Obsolescencia</option><option>Fin de vida útil</option>
                    <option>Venta</option><option>Otro</option>
                </select>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Observaciones</label>
                <textarea id="ops-in-obsbaja" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;"></textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsConfirmarBaja('${herramientaId}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);">Confirmar baja</button>
                </div>
            </div>
        </div>`;
    };

    window.opsConfirmarBaja = async function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        const motivo = document.getElementById("ops-in-motivobaja").value;
        const obs = document.getElementById("ops-in-obsbaja").value.trim();
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, COL_HERRAMIENTAS, herramientaId), {
            estado: "baja", tecnicoActualId: null, fechaAsignacion: null,
        });
        await opsRegistrarMovimiento({ herramientaId, tipo: "baja", tecnicoAnteriorId: h.tecnicoActualId, motivo, observaciones: obs });
        document.getElementById("ops-modal-wrap").innerHTML = "";
        const panel = document.getElementById("ops-panel-wrap");
        if (panel) panel.innerHTML = "";
    };

    // ═══════════════════════ TAB: TÉCNICOS ═══════════════════════
    function opsRenderTecnicos() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        const gestion = opsPuedeGestionar();
        const filtro = filtroTec.trim().toLowerCase();
        const lista = cacheTec.filter(t => !filtro || (t.nombre || "").toLowerCase().includes(filtro) || (t.numeroOperativo || "").toLowerCase().includes(filtro));

        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 18px;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
                    <input type="text" placeholder="Buscar técnico..." oninput="opsFiltrarTec(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;font-size:12.5px;width:260px;outline:none;">
                    ${gestion ? `<button onclick="opsAbrirModalTecnico()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">${ICON.plus} Nuevo técnico</button>` : ""}
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12.3px;">
                        <thead><tr style="background:#1f2937;color:#fff;text-align:left;">
                            <th style="padding:8px 10px;border-radius:8px 0 0 8px;">N.° operativo</th>
                            <th style="padding:8px 10px;">Nombre</th>
                            <th style="padding:8px 10px;">Puesto</th>
                            <th style="padding:8px 10px;">Estatus</th>
                            <th style="padding:8px 10px;border-radius:0 8px 8px 0;">Herramientas actuales</th>
                        </tr></thead>
                        <tbody>${lista.length ? lista.map((t, i) => opsFilaTecnico(t, i)).join("") : '<tr><td colspan="5" style="padding:22px;text-align:center;color:#94a3b8;">Sin técnicos registrados.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    window.opsFiltrarTec = function (v) { filtroTec = v || ""; opsRenderTecnicos(); };

    function opsFilaTecnico(t, i) {
        const activo = t.estatus === "activo";
        const nHerr = cacheHerr.filter(h => h.tecnicoActualId === t.id).length;
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        return `<tr style="background:${zebra};border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsAbrirFichaTecnico('${t.id}')">
            <td style="padding:8px 10px;font-weight:600;color:#334155;">${opsEsc(t.numeroOperativo)}</td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(t.nombre)}</td>
            <td style="padding:8px 10px;color:#64748b;">${opsEsc(t.puesto || "—")}</td>
            <td style="padding:8px 10px;"><span style="background:${activo ? "#dcfce7" : "#e5e7eb"};color:${activo ? "#166534" : "#374151"};font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;">${activo ? "Activo" : "Baja"}</span></td>
            <td style="padding:8px 10px;color:#334155;">${nHerr}</td>
        </tr>`;
    }

    window.opsToggleMenuTecnico = function (ev) {
        ev.stopPropagation();
        const menu = document.getElementById("ops-menu-tecnico");
        if (!menu) return;
        const abrir = menu.style.display === "none";
        menu.style.display = abrir ? "block" : "none";
        if (abrir) {
            const cerrar = () => { menu.style.display = "none"; document.removeEventListener("click", cerrar); };
            setTimeout(() => document.addEventListener("click", cerrar), 0);
        }
    };

    window.opsAbrirModalEditarTecnico = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Editar datos generales</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Cada cambio queda registrado en la auditoría (usuario, fecha, valor anterior/nuevo).</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Puesto</label>
                <select id="ops-edit-puesto" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    ${cachePuestos.map(p => `<option value="${p.id}" ${p.id === t.puestoId ? "selected" : ""}>${opsEsc(p.nombre)} (${opsEsc(p.departamento)})</option>`).join("")}
                </select>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Observaciones</label>
                <textarea id="ops-edit-obs" rows="3" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">${opsEsc(t.observaciones || "")}</textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarEdicionTecnico('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Guardar cambios</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarEdicionTecnico = async function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const nuevoPuestoId = document.getElementById("ops-edit-puesto").value;
        const nuevoPuesto = cachePuestos.find(p => p.id === nuevoPuestoId);
        const nuevasObs = document.getElementById("ops-edit-obs").value.trim();
        const { db, fs } = await opsGetFB();
        const cambios = {};
        if (nuevoPuestoId !== t.puestoId) {
            cambios.puestoId = nuevoPuestoId; cambios.puesto = nuevoPuesto ? nuevoPuesto.nombre : "";
            cambios.departamento = nuevoPuesto ? nuevoPuesto.departamento : "";
            await opsAuditar("tecnico", idInterno, "puesto", t.puesto, cambios.puesto);
            // Cierra el periodo anterior en el historial de puesto y abre uno nuevo.
            if (t.personaId) {
                const abierto = cacheHistPuesto.find(h => h.personaId === t.personaId && !h.hasta);
                if (abierto && abierto.id) await fs.updateDoc(fs.doc(db, COL_HIST_PUESTO, abierto.id), { hasta: opsHoy() });
                await fs.addDoc(fs.collection(db, COL_HIST_PUESTO), { personaId: t.personaId, puestoId: nuevoPuestoId, desde: opsHoy(), hasta: null });
            }
        }
        if (nuevasObs !== (t.observaciones || "")) {
            cambios.observaciones = nuevasObs;
            await opsAuditar("tecnico", idInterno, "observaciones", t.observaciones, nuevasObs);
        }
        if (Object.keys(cambios).length) await fs.updateDoc(fs.doc(db, COL_TECNICOS, idInterno), cambios);
        document.getElementById("ops-modal-wrap").innerHTML = "";
        opsAbrirFichaTecnico(idInterno);
    };

    window.opsAbrirModalTecnico = function () {
        const personasActivas = cachePersonas.filter(p => p.estatus !== "baja");
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:420px;max-width:92vw;padding:22px;max-height:88vh;overflow-y:auto;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Nuevo técnico (asignación operativa)</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">La persona y el número operativo son entidades separadas: si el número se reutiliza más adelante, el historial de esta persona no se mezcla con el de quien lo tenga después.</div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Persona</label>
                <select id="ops-in-persona" onchange="opsToggleNuevaPersona()" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <option value="__nueva__">+ Nueva persona...</option>
                    ${personasActivas.map(p => `<option value="${p.id}">${opsEsc(p.nombre)}</option>`).join("")}
                </select>
                <div id="ops-campo-nueva-persona">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre completo (persona nueva)</label>
                    <input id="ops-in-nombretec" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">N.° de técnico (manual)</label>
                <input id="ops-in-numop" placeholder="Ej. 017" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Puesto</label>
                <select id="ops-in-puestotec" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">
                    ${cachePuestos.map(p => `<option value="${p.id}">${opsEsc(p.nombre)} (${opsEsc(p.departamento)})</option>`).join("")}
                </select>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarTecnico()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsToggleNuevaPersona = function () {
        const esNueva = document.getElementById("ops-in-persona").value === "__nueva__";
        document.getElementById("ops-campo-nueva-persona").style.display = esNueva ? "block" : "none";
    };

    window.opsGuardarTecnico = async function () {
        const numeroOperativo = document.getElementById("ops-in-numop").value.trim();
        if (!numeroOperativo) { alert("El número de técnico es obligatorio"); return; }

        // Validación anti-duplicado: no puede haber dos técnicos ACTIVOS con el mismo número.
        // Si el número perteneció a alguien dado de baja, sí se puede reutilizar (nuevo registro histórico).
        const yaActivo = cacheTec.find(t => t.numeroOperativo === numeroOperativo && t.estatus === "activo");
        if (yaActivo) { alert(`El número ${numeroOperativo} ya está activo (asignado a ${yaActivo.nombre}). Da de baja ese registro antes de reutilizarlo.`); return; }
        const vecesUsado = cacheTec.filter(t => t.numeroOperativo === numeroOperativo).length;

        const puestoId = document.getElementById("ops-in-puestotec").value;
        const puesto = cachePuestos.find(p => p.id === puestoId);
        const { db, fs } = await opsGetFB();

        let personaId = document.getElementById("ops-in-persona").value;
        let nombrePersona;
        if (personaId === "__nueva__") {
            nombrePersona = document.getElementById("ops-in-nombretec").value.trim();
            if (!nombrePersona) { alert("El nombre de la persona es obligatorio"); return; }
            const refPersona = await fs.addDoc(fs.collection(db, COL_PERSONAS), {
                nombre: nombrePersona, estatus: "activo", fechaAlta: opsHoy(), fechaBaja: null,
                telefono: null, correo: null, observaciones: null,
            });
            personaId = refPersona.id;
            cachePersonas.push({ id: personaId, nombre: nombrePersona, estatus: "activo" });
        } else {
            nombrePersona = (cachePersonas.find(p => p.id === personaId) || {}).nombre;
        }

        await fs.addDoc(fs.collection(db, COL_TECNICOS), {
            numeroOperativo, personaId, nombre: nombrePersona,
            puestoId, puesto: puesto ? puesto.nombre : "", departamento: puesto ? puesto.departamento : "",
            registroHistorico: vecesUsado + 1,
            estatus: "activo", fechaIngreso: opsHoy(), fechaBaja: null,
            supervisor: null, telefono: null, correo: null, observaciones: null,
            // Identificadores para hacer match confiable con RH/Flotilla/Firebase (no solo por nombre).
            employeeId: null, fleetUserId: null, firebaseUid: null,
        });
        // Abre el primer periodo en el historial de puesto de esta persona.
        await fs.addDoc(fs.collection(db, COL_HIST_PUESTO), { personaId, puestoId, desde: opsHoy(), hasta: null });
        cacheHistPuesto.push({ personaId, puestoId, desde: opsHoy(), hasta: null });

        document.getElementById("ops-modal-wrap").innerHTML = "";
    };


    window.opsAbrirFichaTecnico = async function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        const activo = t.estatus === "activo";
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        const buenEstado = asignadas.filter(h => h.estado === "asignada" && !["danada","extraviada"].includes(h.condicionFisica)).length;
        const materiales = cacheAlmacenTec.filter(m => m.tecnicoId === idInterno && m.cantidad > 0);
        const historial = cacheMov.filter(m => m.tecnicoAnteriorId === idInterno || m.tecnicoNuevoId === idInterno);
        const guardiaActiva = cacheGuardias.find(g => g.tecnicoId === idInterno && g.estado === "activa");
        const iniciales = (t.nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
        const vehiculo = await window.opsFlotillaProvider.obtenerVehiculoActual(idInterno);

        function kpiMini(label, valor, total, color) {
            const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
            return `<div style="flex:1;min-width:0;">
                <div style="font-size:10.5px;color:#94a3b8;margin-bottom:3px;">${label}</div>
                <div style="font-size:15px;font-weight:700;color:#1e293b;">${valor}</div>
                <div style="height:4px;background:#e2e8f0;border-radius:99px;margin-top:5px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};"></div></div>
            </div>`;
        }

        const bannerVehiculo = vehiculo ? `
            <div style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);border-radius:12px;padding:14px 16px;margin-top:12px;color:#fff;">
                <div style="font-size:11.5px;font-weight:700;">🚐 Vehículo asignado</div>
                <div style="font-size:13px;font-weight:700;margin-top:2px;">${opsEsc(vehiculo.unidad)} — ${opsEsc(vehiculo.marca)} ${opsEsc(vehiculo.modelo)}</div>
                <div style="font-size:11px;color:#dbeafe;margin-top:2px;">Estado: ${opsEsc(vehiculo.estado)}</div>
            </div>` : `
            <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:12px 16px;margin-top:12px;">
                <div style="font-size:11px;color:#94a3b8;">🚐 Vehículo asignado: sin conexión con Flotilla todavía. En cuanto exista la integración, este banner mostrará la unidad, placas y estado en tiempo real.</div>
            </div>`;

        const bloqueRH = `
            <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:12px 16px;margin-top:12px;">
                <div style="font-size:11px;color:#94a3b8;">👤 Información de RH: ${t.employeeId ? `ID empleado ${opsEsc(t.employeeId)}` : "sin match todavía"} — se conectará por correo/ID de empleado, no por nombre, cuando exista sincronización con RH.</div>
            </div>`;

        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#f1f5f9;width:480px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#fff;border:1px solid #e2e8f0;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                ${guardiaActiva ? `<div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:12px;padding:10px 14px;margin-bottom:8px;color:#fff;font-size:11.5px;font-weight:700;">🛡 En guardia — herramienta ${opsEsc(guardiaActiva.herramientaId)}</div>` : ""}
                <div style="background:#fff;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;margin-top:8px;">
                    <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0B5FFF,#0842B0);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">${opsEsc(iniciales)}</div>
                    <div style="min-width:0;flex:1;">
                        <div style="font-size:15.5px;font-weight:700;color:#1e293b;">${opsEsc(t.nombre)}</div>
                        <div style="font-size:11.5px;color:#64748b;">${opsEsc(t.puesto || "—")} · N.° ${opsEsc(t.numeroOperativo)}${t.registroHistorico > 1 ? ` (registro ${t.registroHistorico})` : ""}</div>
                        <span style="background:${activo ? "#dcfce7" : "#e5e7eb"};color:${activo ? "#166534" : "#374151"};font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;display:inline-block;margin-top:4px;">${activo ? "Activo" : "Baja"}</span>
                    </div>
                    ${opsPuedeGestionar() ? `
                    <div style="position:relative;">
                        <button onclick="opsToggleMenuTecnico(event)" title="Configuración" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#475569;display:flex;align-items:center;justify-content:center;">${ICON.gear}</button>
                        <div id="ops-menu-tecnico" style="display:none;position:absolute;right:0;top:38px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:190px;z-index:10;overflow:hidden;">
                            <button onclick="opsAbrirModalEditarTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border:none;padding:10px 14px;font-size:12.5px;color:#334155;cursor:pointer;">Editar datos generales</button>
                            ${activo ? `<button onclick="document.getElementById('ops-menu-tecnico').style.display='none';opsIniciarBajaTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border-top:1px solid #f1f5f9;border-bottom:none;border-left:none;border-right:none;padding:10px 14px;font-size:12.5px;color:#b91c1c;cursor:pointer;">${ICON.trash} Dar de baja al técnico</button>` : ""}
                        </div>
                    </div>` : ""}
                </div>

                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-top:12px;display:flex;gap:16px;">
                    ${kpiMini("Herramientas", asignadas.length, Math.max(asignadas.length, 1), "#0891b2")}
                    ${kpiMini("En buen estado", buenEstado, Math.max(asignadas.length, 1), "#059669")}
                    ${kpiMini("Material activo", materiales.length, Math.max(materiales.length, 1), "#7c3aed")}
                </div>

                ${bannerVehiculo}
                ${bloqueRH}

                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-top:12px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Departamento:</strong> ${opsEsc(t.departamento || "—")}</div>
                    <div><strong>Fecha de ingreso:</strong> ${opsEsc(t.fechaIngreso || "—")}</div>
                    ${t.fechaBaja ? `<div><strong>Fecha de baja:</strong> ${opsEsc(t.fechaBaja)}</div>` : ""}
                </div>

                ${activo && opsPuedeHacer("solicitar_material") ? `<div style="margin-top:12px;">
                    <button onclick="opsAbrirModalSolicitud('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Solicitar material</button>
                </div>` : ""}

                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-top:12px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Herramientas asignadas (${asignadas.length})</div>
                    ${asignadas.length ? asignadas.map(h => `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eef1f5;font-size:12px;"><span style="color:#059669;">${ICON.check}</span><strong>${opsEsc(h.folio)}</strong> — ${opsEsc(h.descripcion)}</div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Ninguna.</div>'}
                </div>

                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-top:12px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Almacén del técnico — material (${materiales.length})</div>
                    <div style="font-size:10.5px;color:#94a3b8;margin-bottom:8px;">Consumibles de uso operativo, distinto del control de activos/herramientas. Conectado a Almacén (surtidos) — la existencia en vivo vendrá de ASPEL cuando esa integración exista.</div>
                    ${materiales.length ? materiales.map(m => `<div style="padding:7px 0;border-bottom:1px solid #eef1f5;font-size:12px;">${opsEsc(m.productoDesc)} — <strong>${opsEsc(m.cantidad)}</strong></div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin material registrado todavía.</div>'}
                </div>

                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-top:12px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;margin-bottom:8px;">${ICON.clock} Historial</div>
                    <div style="border-left:2px solid #e2e8f0;padding-left:14px;">
                        ${historial.length ? historial.sort((a,b)=>(a.fecha<b.fecha?1:-1)).map(m => `
                        <div style="margin-bottom:12px;position:relative;">
                            <div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#1f2937;"></div>
                            <div style="font-size:12px;color:#334155;">${opsEsc((m.fecha||"").slice(0,10))} · ${opsEsc(m.tipo)} · ${opsEsc(m.herramientaId)}</div>
                        </div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin movimientos.</div>'}
                    </div>
                </div>
            </div>
        </div>`;
    };

    // ── Baja de técnico: bloquea si tiene herramientas o material pendiente ──
    window.opsIniciarBajaTecnico = function (idInterno) {
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        const materiales = cacheAlmacenTec.filter(m => m.tecnicoId === idInterno && m.cantidad > 0);
        if (asignadas.length > 0 || materiales.length > 0) {
            const partes = [];
            if (asignadas.length) partes.push(`${asignadas.length} herramienta(s) asignada(s)`);
            if (materiales.length) partes.push(`${materiales.length} material(es) pendiente(s) en su almacén`);
            alert(`NO SE PUEDE CERRAR EL EXPEDIENTE OPERATIVO.\nPendiente: ${partes.join(" y ")}.\nResuelve esto desde la ficha de cada herramienta / almacén del técnico antes de dar de baja.`);
            return;
        }
        if (!confirm("¿Confirmar baja de este técnico? El número operativo podrá reutilizarse en el futuro sin perder este historial (queda como registro histórico independiente).")) return;
        opsConfirmarBajaTecnico(idInterno);
    };

    window.opsConfirmarBajaTecnico = async function (idInterno) {
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, COL_TECNICOS, idInterno), { estatus: "baja", fechaBaja: opsHoy() });
        // Cierra el periodo abierto en el historial de puesto (hasta = hoy).
        const t = cacheTec.find(x => x.id === idInterno);
        if (t && t.personaId) {
            const abierto = cacheHistPuesto.find(h => h.personaId === t.personaId && !h.hasta);
            if (abierto && abierto.id) await fs.updateDoc(fs.doc(db, COL_HIST_PUESTO, abierto.id), { hasta: opsHoy() });
        }
        const panel = document.getElementById("ops-panel-wrap");
        if (panel) panel.innerHTML = "";
    };

    // ═══════════════ SOLICITUD DE MATERIAL — RÉPLICA FIEL del kiosco real ═══════════════
    // Mismo formato exacto de solicitud-material.html: Nombre del solicitante, Área,
    // Operación destino, Uso, carrito multi-producto {clave, cant, desc}, firma obligatoria.
    // Escribe en la MISMA colección `surtidos`, mismos nombres de campo (incluye "cant",
    // no "cantidad"), mismo folio "SM-", mismo estado inicial "pendiente".
    let opsCarritoSolicitud = {};

    async function opsCargarCatalogoProductos() {
        if (catalogoProductos.length) return catalogoProductos;
        const { db, fs } = await opsGetFB();
        try {
            const snap = await fs.getDoc(fs.doc(db, ...COL_CATALOGO_DOC));
            catalogoProductos = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
        } catch (e) {
            console.warn("[operaciones.js] No se pudo leer catalogo/productos:", e.message);
            catalogoProductos = [];
        }
        return catalogoProductos;
    }

    window.opsAbrirModalSolicitud = async function (tecnicoId) {
        const t = cacheTec.find(x => x.id === tecnicoId);
        await opsCargarCatalogoProductos();
        opsCarritoSolicitud = {};
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:460px;max-width:94vw;padding:22px;max-height:90vh;overflow-y:auto;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:2px;">Solicitud de material</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">Mismo formato que el kiosco de Almacén — técnico preseleccionado.</div>
                <div style="background:#eff6ff;border-radius:10px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <span style="color:#0B5FFF;">${ICON.user}</span>
                    <div><div style="font-size:12.5px;font-weight:700;color:#1e3a8a;">${opsEsc(t.nombre)}</div><div style="font-size:10.5px;color:#3b82f6;">Técnico N.° ${opsEsc(t.numeroOperativo)}</div></div>
                </div>

                <div style="font-size:11px;font-weight:700;color:#0B5FFF;margin-bottom:6px;">1 · Datos de la solicitud</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre del solicitante *</label>
                <input id="ops-in-solicitante" value="${opsEsc(opsNombreActual())}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Área *</label>
                <input id="ops-in-area" value="${opsEsc(t.departamento || "Operaciones")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Operación destino *</label>
                <input id="ops-in-destino" placeholder="Ej. Servicio técnico ${opsEsc(t.nombre)}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">¿Para qué se usará el material? *</label>
                <textarea id="ops-in-uso" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 6px;resize:vertical;"></textarea>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Folio de servicio / póliza (opcional)</label>
                <input id="ops-in-folioserv" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 14px;">

                <div style="font-size:11px;font-weight:700;color:#0B5FFF;margin-bottom:6px;">2 · Artículos solicitados</div>
                <input list="ops-datalist-prod" id="ops-in-buscarprod" placeholder="Busca un producto por nombre o clave..." style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:8px;">
                <datalist id="ops-datalist-prod">${catalogoProductos.map(p => `<option data-clave="${opsEsc(p.clave || "")}" value="${opsEsc(p.desc || p.clave)}">`).join("")}</datalist>
                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <input id="ops-in-cantprod" type="number" min="1" value="1" style="width:70px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                    <button onclick="opsAgregarProductoCarrito()" style="flex:1;background:#f1f5f9;border:none;border-radius:8px;color:#334155;font-weight:600;font-size:12.5px;cursor:pointer;">+ Agregar al pedido</button>
                </div>
                <div id="ops-carrito-lista" style="margin-bottom:14px;"></div>

                <div style="font-size:11px;font-weight:700;color:#0B5FFF;margin-bottom:6px;">3 · Firma del solicitante</div>
                <div style="position:relative;border:1px dashed #cbd5e1;border-radius:10px;height:120px;overflow:hidden;">
                    <canvas id="ops-sign-canvas" style="width:100%;height:100%;touch-action:none;"></canvas>
                    <div id="ops-sign-hint" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11.5px;pointer-events:none;">Firma aquí con el dedo o el mouse</div>
                </div>
                <div style="display:flex;justify-content:flex-end;margin:6px 0 14px;">
                    <button onclick="opsLimpiarFirma()" style="background:none;border:none;color:#0B5FFF;font-size:11.5px;font-weight:600;cursor:pointer;">Limpiar firma</button>
                </div>

                <div id="ops-solic-msg" style="color:#b91c1c;font-size:11.5px;margin-bottom:8px;"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsEnviarSolicitudMaterial('${tecnicoId}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Enviar solicitud de material</button>
                </div>
            </div>
        </div>`;
        opsInicializarFirma();
        opsRenderCarritoSolicitud();
    };

    window.opsAgregarProductoCarrito = function () {
        const input = document.getElementById("ops-in-buscarprod");
        const desc = input.value.trim();
        const cant = parseInt(document.getElementById("ops-in-cantprod").value, 10) || 1;
        if (!desc) return;
        const opt = Array.from(document.querySelectorAll("#ops-datalist-prod option")).find(o => o.value === desc);
        const clave = opt ? opt.dataset.clave : "";
        const key = (clave + "|" + desc).toLowerCase();
        if (!opsCarritoSolicitud[key]) opsCarritoSolicitud[key] = { clave, desc, cant: 0 };
        opsCarritoSolicitud[key].cant += cant;
        input.value = "";
        document.getElementById("ops-in-cantprod").value = 1;
        opsRenderCarritoSolicitud();
    };
    window.opsQuitarProductoCarrito = function (key) { delete opsCarritoSolicitud[key]; opsRenderCarritoSolicitud(); };

    function opsRenderCarritoSolicitud() {
        const el = document.getElementById("ops-carrito-lista");
        if (!el) return;
        const items = Object.entries(opsCarritoSolicitud);
        el.innerHTML = items.length ? items.map(([k, v]) => `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eef1f5;font-size:12px;">
                <div style="flex:1;">${opsEsc(v.desc)}</div>
                <div style="color:#64748b;">× ${opsEsc(v.cant)}</div>
                <button onclick="opsQuitarProductoCarrito('${k}')" style="background:none;border:none;color:#b91c1c;cursor:pointer;font-size:11px;">Quitar</button>
            </div>`).join("") : '<div style="color:#94a3b8;font-size:11.5px;">Tu pedido está vacío.</div>';
    }

    let opsFirmaCtx = null, opsFirmaDibujando = false, opsFirmaHay = false, opsFirmaLastX = 0, opsFirmaLastY = 0;
    function opsInicializarFirma() {
        const cv = document.getElementById("ops-sign-canvas");
        const r = cv.getBoundingClientRect();
        cv.width = r.width; cv.height = r.height;
        opsFirmaCtx = cv.getContext("2d");
        opsFirmaCtx.lineWidth = 2.4; opsFirmaCtx.lineCap = "round"; opsFirmaCtx.lineJoin = "round"; opsFirmaCtx.strokeStyle = "#0f172a";
        opsFirmaHay = false;
        function pos(e) { const rr = cv.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: p.clientX - rr.left, y: p.clientY - rr.top }; }
        function start(e) { e.preventDefault(); opsFirmaDibujando = true; const p = pos(e); opsFirmaLastX = p.x; opsFirmaLastY = p.y; }
        function move(e) {
            if (!opsFirmaDibujando) return; e.preventDefault();
            const p = pos(e);
            opsFirmaCtx.beginPath(); opsFirmaCtx.moveTo(opsFirmaLastX, opsFirmaLastY); opsFirmaCtx.lineTo(p.x, p.y); opsFirmaCtx.stroke();
            opsFirmaLastX = p.x; opsFirmaLastY = p.y;
            if (!opsFirmaHay) { opsFirmaHay = true; document.getElementById("ops-sign-hint").style.display = "none"; }
        }
        function end() { opsFirmaDibujando = false; }
        cv.addEventListener("mousedown", start); cv.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
        cv.addEventListener("touchstart", start, { passive: false }); cv.addEventListener("touchmove", move, { passive: false }); cv.addEventListener("touchend", end);
    }
    window.opsLimpiarFirma = function () {
        const cv = document.getElementById("ops-sign-canvas");
        opsFirmaCtx.clearRect(0, 0, cv.width, cv.height);
        opsFirmaHay = false;
        document.getElementById("ops-sign-hint").style.display = "flex";
    };
    function opsFirmaBase64() {
        const cv = document.getElementById("ops-sign-canvas");
        const tmp = document.createElement("canvas");
        const W = 600, H = Math.round(W * (cv.height / cv.width));
        tmp.width = W; tmp.height = H;
        const t = tmp.getContext("2d");
        t.fillStyle = "#ffffff"; t.fillRect(0, 0, W, H);
        t.drawImage(cv, 0, 0, W, H);
        return tmp.toDataURL("image/png");
    }

    window.opsEnviarSolicitudMaterial = async function (tecnicoId) {
        const t = cacheTec.find(x => x.id === tecnicoId);
        const solicitante = document.getElementById("ops-in-solicitante").value.trim();
        const area = document.getElementById("ops-in-area").value.trim();
        const destino = document.getElementById("ops-in-destino").value.trim();
        const uso = document.getElementById("ops-in-uso").value.trim();
        const folioServicio = document.getElementById("ops-in-folioserv").value.trim();
        const productos = Object.values(opsCarritoSolicitud).map(v => ({ clave: v.clave, cant: v.cant, desc: v.desc }));
        const msgEl = document.getElementById("ops-solic-msg");

        if (!solicitante) { msgEl.textContent = "Escribe el nombre del solicitante."; return; }
        if (!area) { msgEl.textContent = "Escribe el área."; return; }
        if (!destino) { msgEl.textContent = "Escribe la operación destino."; return; }
        if (!uso) { msgEl.textContent = "Describe para qué se usará el material."; return; }
        if (!productos.length) { msgEl.textContent = "Agrega al menos un artículo con descripción y cantidad."; return; }
        if (!opsFirmaHay) { msgEl.textContent = "Falta la firma del solicitante."; return; }
        msgEl.textContent = "";

        const { db, fs } = await opsGetFB();
        const folio = "SM-" + String(Date.now()).slice(-6);
        await fs.addDoc(fs.collection(db, COL_SURTIDOS), {
            tipo: "material", folio,
            cliente: destino || "Almacén · Operaciones",
            solicitante, vendedor: solicitante,
            area, destino, uso,
            prioridad: "urgente", estado: "pendiente",
            productos, firma: opsFirmaBase64(),
            origen: "operaciones", // (el kiosco físico usa 'kiosco'; Operaciones usa 'operaciones' para distinguir origen sin romper nada)
            tecnicoId, tecnicoNumero: t.numeroOperativo, tecnicoNombre: t.nombre,
            folioServicio: folioServicio || null,
            createdAt: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
        });
        document.getElementById("ops-modal-wrap").innerHTML = "";
        window.mostrarPush ? mostrarPush("Herramientas", `Solicitud ${folio} enviada a Almacén.`, "📦") : alert(`Solicitud ${folio} enviada a Almacén.`);
    };

    // ═══════════════════════ TAB: HERRAMIENTA DE GUARDIA ═══════════════════════
    // Módulo INDEPENDIENTE de las herramientas permanentes (ops_herramientas / ops_asignaciones).
    // Una guardia es una asignación temporal con fecha/hora de inicio y fin, distinta del
    // ciclo de vida normal de la herramienta de trabajo diaria.
    function opsRenderGuardias() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        const gestion = opsPuedeGestionar();
        const activas = cacheGuardias.filter(g => g.estado === "activa");
        const cerradas = cacheGuardias.filter(g => g.estado === "cerrada").sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));

        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Herramienta de guardia</div>
                    ${gestion ? `<button onclick="opsAbrirModalGuardia()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">${ICON.plus} Asignar guardia</button>` : ""}
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Distinto de la herramienta de trabajo permanente — se asigna solo mientras dura la guardia y se cierra al devolver.</div>

                <div style="font-size:11.5px;font-weight:700;color:#0B5FFF;margin-bottom:8px;">Guardias activas (${activas.length})</div>
                ${activas.length ? activas.map(g => opsFilaGuardia(g, true, gestion)).join("") : '<div style="color:#94a3b8;font-size:12px;padding:8px 0 16px;">Ninguna guardia activa.</div>'}

                <div style="font-size:11.5px;font-weight:700;color:#64748b;margin:18px 0 8px;">Historial de guardias (${cerradas.length})</div>
                ${cerradas.length ? cerradas.slice(0, 15).map(g => opsFilaGuardia(g, false, gestion)).join("") : '<div style="color:#94a3b8;font-size:12px;padding:8px 0;">Sin guardias cerradas todavía.</div>'}
            </div>`;
    }

    function opsFilaGuardia(g, activa, gestion) {
        const h = cacheHerr.find(x => x.id === g.herramientaId);
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eef1f5;font-size:12px;">
            <div style="flex:1;">
                <strong>${opsEsc(opsNombreTecnico(g.tecnicoId))}</strong> — ${opsEsc(h ? h.folio + " " + h.descripcion : g.herramientaId)}
                <div style="font-size:10.5px;color:#94a3b8;">${opsEsc(g.fechaInicio)} ${opsEsc(g.horaInicio || "")} → ${opsEsc(g.fechaFin || "en curso")} ${opsEsc(g.horaFin || "")}</div>
            </div>
            ${activa && gestion ? `<button onclick="opsCerrarGuardia('${g.id}')" style="background:#f1f5f9;border:none;color:#334155;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:10.5px;font-weight:600;">Devolver / cerrar</button>` : ""}
        </div>`;
    }

    window.opsAbrirModalGuardia = function () {
        const tecnicosActivos = cacheTec.filter(t => t.estatus === "activo");
        const disponibles = cacheHerr.filter(h => h.estado === "disponible");
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">Asignar herramienta de guardia</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Técnico</label>
                <select id="ops-in-tecguardia" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    ${tecnicosActivos.map(t => `<option value="${t.id}">${opsEsc(t.nombre)} (N.° ${opsEsc(t.numeroOperativo)})</option>`).join("")}
                </select>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Herramienta / equipo de guardia</label>
                <select id="ops-in-herrguardia" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    ${disponibles.map(h => `<option value="${h.id}">${opsEsc(h.folio)} — ${opsEsc(h.descripcion)}</option>`).join("")}
                </select>
                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha inicio</label>
                    <input id="ops-in-fechaini" type="date" value="${opsHoy()}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Hora inicio</label>
                    <input id="ops-in-horaini" type="time" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Condición de entrega</label>
                <select id="ops-in-condguardia" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <option>Nueva</option><option>Excelente</option><option selected>Buena</option><option>Regular</option>
                </select>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Observaciones</label>
                <textarea id="ops-in-obsguardia" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;"></textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarGuardia()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Asignar guardia</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarGuardia = async function () {
        const tecnicoId = document.getElementById("ops-in-tecguardia").value;
        const herramientaId = document.getElementById("ops-in-herrguardia").value;
        if (!tecnicoId || !herramientaId) { alert("Selecciona técnico y herramienta"); return; }
        const fechaInicio = document.getElementById("ops-in-fechaini").value;
        const horaInicio = document.getElementById("ops-in-horaini").value;
        const condicionEntrega = document.getElementById("ops-in-condguardia").value;
        const observaciones = document.getElementById("ops-in-obsguardia").value.trim();
        const { db, fs } = await opsGetFB();
        await fs.addDoc(fs.collection(db, COL_GUARDIAS), {
            tecnicoId, herramientaId, estado: "activa",
            fechaInicio, horaInicio, fechaFin: null, horaFin: null,
            condicionEntrega, condicionDevolucion: null, observaciones,
            usuarioAsigno: opsUsuarioActual(), fechaAsignacion: opsFechaHora(),
        });
        document.getElementById("ops-modal-wrap").innerHTML = "";
        const snapGuardias = await fs.getDocs(fs.collection(db, COL_GUARDIAS));
        cacheGuardias = snapGuardias.docs.map(d => ({ id: d.id, ...d.data() }));
        opsRenderGuardias();
    };

    window.opsCerrarGuardia = async function (guardiaId) {
        if (!confirm("¿Confirmar devolución y cierre de esta guardia?")) return;
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, COL_GUARDIAS, guardiaId), {
            estado: "cerrada", fechaFin: opsHoy(),
            horaFin: new Date().toTimeString().slice(0, 5),
            usuarioCerro: opsUsuarioActual(),
        });
        const snapGuardias = await fs.getDocs(fs.collection(db, COL_GUARDIAS));
        cacheGuardias = snapGuardias.docs.map(d => ({ id: d.id, ...d.data() }));
        opsRenderGuardias();
    };

    // ═══════════════════════ TAB: SERVICIOS (módulo padre, launcher) ═══════════════════════
    // Agrupa lo que hoy vive disperso en el panel de Operaciones de index.html
    // (Nuevo Servicio Técnico, Ver registros) bajo un solo lugar, sin duplicar esas
    // funciones — solo las invoca. Folios/Pólizas todavía no existen como módulos
    // propios en el portal; se dejan como "Próximamente" en vez de inventarlos.
    function opsRenderServicios() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        function tarjeta(icono, titulo, sub, onclick, disponible) {
            return `<div onclick="${disponible ? onclick : ""}" style="background:#fff;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px;cursor:${disponible ? "pointer" : "default"};opacity:${disponible ? "1" : "0.55"};">
                <span style="width:36px;height:36px;border-radius:9px;background:#e0e7ff;color:#0B5FFF;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icono}</span>
                <div><div style="font-size:12.5px;font-weight:700;color:#1e293b;">${titulo}</div><div style="font-size:10.5px;color:#94a3b8;">${sub}</div></div>
            </div>`;
        }
        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
                ${tarjeta(ICON.plus, "Nuevo servicio técnico", "Abre el formulario ya existente en Operaciones", "typeof abrirFormServicio==='function' && abrirFormServicio()", typeof window.abrirFormServicio === "function")}
                ${tarjeta(ICON.box, "Servicios / registros", "Ver la lista de servicios técnicos capturados", "typeof toggleListaServicios==='function' && toggleListaServicios()", typeof window.toggleListaServicios === "function")}
                ${tarjeta(ICON.clock, "Folios de servicio", "Próximamente — módulo aún no existe en el portal", "", false)}
                ${tarjeta(ICON.check, "Pólizas", "Próximamente — módulo aún no existe en el portal", "", false)}
                ${tarjeta(ICON.bell, "Servicios pendientes / completados", "Próximamente — requiere el módulo de Folios", "", false)}
                ${tarjeta(ICON.clock, "Historial y evidencias", "Próximamente — se conectará con Evidencias por asignación", "", false)}
            </div>`;
    }

    // ═══════════════════════ TAB: SOLICITUDES (bandeja de Almacén) ═══════════════════════
    // Estados REALES tal como los usa el kiosco/almacén: pendiente → listo → entregado.
    // rechazada/cancelada son extensiones de Operaciones (no rompen al kiosco, que solo
    // filtra por 'entregaPendienteFirma').
    const ESTADOS_SOLICITUD = {
        pendiente:  { label: "Pendiente",  bg: "#e0e7ff", fg: "#3730a3", siguiente: "listo" },
        listo:      { label: "Listo",      bg: "#cffafe", fg: "#155e75", siguiente: "entregado" },
        entregado:  { label: "Entregado",  bg: "#dcfce7", fg: "#166534", siguiente: null },
        rechazada:  { label: "Rechazada",  bg: "#fee2e2", fg: "#991b1b", siguiente: null },
        cancelada:  { label: "Cancelada",  bg: "#e5e7eb", fg: "#374151", siguiente: null },
    };
    let filtroSolic = "todas";

    function opsRenderSolicitudes() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        opsLimpiarPapeleraVencida(); // best-effort: borra en segundo plano lo que ya cumplió 3 meses
        const puedeEliminar = opsPuedeHacer("eliminar_solicitudes") || opsRolActual() === "administrador";
        const lista = cacheSurtidos.filter(s => {
            if (filtroSolic === "papelera") return !!s.eliminada;
            if (s.eliminada) return false; // el resto de filtros nunca muestra eliminadas
            if (filtroSolic === "pendientes") return !["entregado", "rechazada", "cancelada"].includes(s.estado || "pendiente");
            if (filtroSolic === "urgentes") return s.prioridad === "urgente";
            if (filtroSolic === "operaciones") return s.origen === "operaciones";
            return true;
        });
        const enPapelera = cacheSurtidos.filter(s => s.eliminada).length;

        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Solicitudes de material</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${["todas:Todas", "pendientes:Pendientes", "urgentes:Urgentes", "operaciones:Desde Operaciones"].map(f => {
                            const [id, label] = f.split(":");
                            const activo = filtroSolic === id;
                            return `<button onclick="opsFiltrarSolic('${id}')" style="background:${activo ? "#0B5FFF" : "#f1f5f9"};color:${activo ? "#fff" : "#475569"};border:none;font-size:11px;font-weight:600;padding:6px 11px;border-radius:7px;cursor:pointer;">${label}</button>`;
                        }).join("")}
                        ${puedeEliminar ? `<button onclick="opsFiltrarSolic('papelera')" style="background:${filtroSolic === "papelera" ? "#b91c1c" : "#fee2e2"};color:${filtroSolic === "papelera" ? "#fff" : "#991b1b"};border:none;font-size:11px;font-weight:600;padding:6px 11px;border-radius:7px;cursor:pointer;">${ICON.trash} Papelera (${enPapelera})</button>` : ""}
                    </div>
                </div>
                ${filtroSolic === "papelera" ? '<div style="font-size:10.5px;color:#94a3b8;margin-bottom:10px;">Las solicitudes eliminadas se conservan 3 meses antes de borrarse automáticamente.</div>' : ""}
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead><tr style="background:#0B5FFF;color:#fff;text-align:left;">
                            <th style="padding:7px 10px;border-radius:8px 0 0 8px;">Folio</th>
                            <th style="padding:7px 10px;">Técnico</th>
                            <th style="padding:7px 10px;">Producto</th>
                            <th style="padding:7px 10px;">Prioridad</th>
                            <th style="padding:7px 10px;">Estado</th>
                            <th style="padding:7px 10px;border-radius:0 8px 8px 0;text-align:right;">Acción</th>
                        </tr></thead>
                        <tbody>${lista.length ? lista.map((s, i) => opsFilaSolicitud(s, i, puedeEliminar)).join("") : '<tr><td colspan="6" style="padding:22px;text-align:center;color:#94a3b8;">Sin solicitudes en este filtro.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }
    window.opsFiltrarSolic = function (f) { filtroSolic = f; opsRenderSolicitudes(); };

    function opsFilaSolicitud(s, i, puedeEliminar) {
        const estadoKey = s.estado || "pendiente";
        const e = ESTADOS_SOLICITUD[estadoKey] || ESTADOS_SOLICITUD.pendiente;
        const prod = (s.productos && s.productos[0]) || {};
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        const prio = s.prioridad === "urgente" ? `<span style="color:#b91c1c;font-weight:600;">Urgente</span>` : "Normal";
        return `<tr style="background:${zebra};border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsAbrirFichaSolicitud('${s.id}')">
            <td style="padding:7px 10px;font-weight:600;color:#334155;">${opsEsc(s.folio)}</td>
            <td style="padding:7px 10px;color:#334155;">${opsEsc(s.tecnicoNombre || s.solicitante || "—")}</td>
            <td style="padding:7px 10px;color:#334155;">${opsEsc(prod.desc)} ${prod.cant ? `× ${opsEsc(prod.cant)}` : ""}</td>
            <td style="padding:7px 10px;">${prio}</td>
            <td style="padding:7px 10px;"><span style="background:${e.bg};color:${e.fg};font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;">${e.label}</span></td>
            <td style="padding:7px 10px;text-align:right;white-space:nowrap;" onclick="event.stopPropagation()">
                ${s.eliminada
                    ? (puedeEliminar ? `<button onclick="opsRestaurarSolicitud('${s.id}')" style="background:#dcfce715;border:1px solid #bbf7d0;color:#166534;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:10.5px;font-weight:600;">Restaurar</button>` : "")
                    : `${e.siguiente ? `<button onclick="opsAvanzarSolicitud('${s.id}','${e.siguiente}')" style="background:#0B5FFF15;border:none;color:#0B5FFF;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:10.5px;font-weight:600;margin-right:4px;">Avanzar</button>` : ""}
                       ${puedeEliminar ? `<button onclick="opsEnviarPapeleraSolicitud('${s.id}')" title="Enviar a papelera" style="background:#fef2f2;border:none;color:#b91c1c;width:26px;height:26px;border-radius:7px;cursor:pointer;">${ICON.trash}</button>` : ""}`}
            </td>
        </tr>`;
    }

    // ── Papelera (soft delete) ─────────────────────────────────────
    window.opsEnviarPapeleraSolicitud = async function (id) {
        const motivo = prompt("Motivo para enviar esta solicitud a la papelera (opcional):", "") || null;
        const { db, fs } = await opsGetFB();
        const dentroDe3Meses = new Date();
        dentroDe3Meses.setDate(dentroDe3Meses.getDate() + 90);
        await fs.updateDoc(fs.doc(db, COL_SURTIDOS, id), {
            eliminada: true,
            fechaEliminacion: opsFechaHora(),
            usuarioElimino: opsUsuarioActual(),
            motivoEliminacion: motivo,
            fechaProgramadaEliminacion: dentroDe3Meses.toISOString(),
        });
        await opsAuditar("solicitud", id, "eliminada", false, true);
    };

    window.opsRestaurarSolicitud = async function (id) {
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, COL_SURTIDOS, id), {
            eliminada: false, fechaEliminacion: null, usuarioElimino: null,
            motivoEliminacion: null, fechaProgramadaEliminacion: null,
        });
        await opsAuditar("solicitud", id, "eliminada", true, false);
    };

    // Limpieza automática: al no existir Cloud Functions en el plan Spark, esto se
    // ejecuta best-effort cada vez que alguien abre la bandeja de Solicitudes.
    // No sustituye un cron real, pero evita que la papelera crezca indefinidamente
    // mientras el módulo se siga usando con normalidad.
    let opsPapeleraLimpiadaEnEstaSesion = false;
    async function opsLimpiarPapeleraVencida() {
        if (opsPapeleraLimpiadaEnEstaSesion) return;
        opsPapeleraLimpiadaEnEstaSesion = true;
        const ahora = new Date().toISOString();
        const vencidas = cacheSurtidos.filter(s => s.eliminada && s.fechaProgramadaEliminacion && s.fechaProgramadaEliminacion < ahora);
        if (!vencidas.length) return;
        const { db, fs } = await opsGetFB();
        for (const s of vencidas) {
            try { await fs.deleteDoc(fs.doc(db, COL_SURTIDOS, s.id)); } catch (e) { console.warn("[operaciones.js] limpieza papelera:", e.message); }
        }
    }

    window.opsAbrirFichaSolicitud = async function (id) {
        const s = cacheSurtidos.find(x => x.id === id);
        if (!s) return;
        const prod = (s.productos && s.productos[0]) || {};
        const otros = (s.productos || []).slice(1);
        const estadoKey = s.estado || "pendiente";
        const e = ESTADOS_SOLICITUD[estadoKey] || ESTADOS_SOLICITUD.pendiente;
        const { db, fs } = await opsGetFB();
        let historial = [];
        try {
            const snapHist = await fs.getDocs(fs.query(fs.collection(db, COL_SURTIDOS, id, "historial"), fs.orderBy("ts", "desc")));
            historial = snapHist.docs.map(d => d.data());
        } catch (err) { historial = []; }
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:440px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div><div style="font-size:11px;color:#94a3b8;font-weight:600;">${opsEsc(s.folio)}</div><div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(prod.desc)}</div></div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                <span style="background:${e.bg};color:${e.fg};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;">${e.label}</span>
                <div style="margin-top:14px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Técnico:</strong> ${opsEsc(s.tecnicoNombre || s.solicitante || "—")} ${s.tecnicoNumero ? `(N.° ${opsEsc(s.tecnicoNumero)})` : ""}</div>
                    <div><strong>Cantidad:</strong> ${opsEsc(prod.cant)}${otros.length ? ` (+${otros.length} artículo(s) más)` : ""}</div>
                    <div><strong>Prioridad:</strong> ${opsEsc(s.prioridad)}</div>
                    <div><strong>Operación destino:</strong> ${opsEsc(s.destino || "—")}</div>
                    <div><strong>Folio de servicio:</strong> ${opsEsc(s.folioServicio || "—")}</div>
                    <div><strong>Uso:</strong> ${opsEsc(s.uso || "—")}</div>
                    ${s.recibioNombre ? `<div><strong>Recibió:</strong> ${opsEsc(s.recibioNombre)}</div>` : ""}
                </div>
                ${e.siguiente && opsPuedeHacer("autorizar_material") ? `<div style="margin-top:14px;"><button onclick="opsAvanzarSolicitud('${s.id}','${e.siguiente}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Avanzar a "${ESTADOS_SOLICITUD[e.siguiente].label}"</button></div>` : ""}
                <div style="margin-top:20px;font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;">${ICON.clock} Línea de tiempo</div>
                <div style="margin-top:10px;border-left:2px solid #e2e8f0;padding-left:14px;">
                    ${historial.length ? historial.map(ev => `<div style="margin-bottom:12px;position:relative;"><div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#0B5FFF;"></div><div style="font-size:12px;color:#334155;">${opsEsc(ev.de || "—")} → ${opsEsc(ev.a || "—")} · ${opsEsc(ev.por || "")}</div></div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin eventos registrados aún.</div>'}
                </div>
            </div>
        </div>`;
    };

    window.opsAvanzarSolicitud = async function (id, siguienteEstado) {
        const s = cacheSurtidos.find(x => x.id === id);
        const estadoAnterior = s.estado || "pendiente";
        const e = ESTADOS_SOLICITUD[siguienteEstado];
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, COL_SURTIDOS, id), { estado: siguienteEstado });
        // Mismo patrón real de historial: subcolección surtidos/{id}/historial, no array embebido.
        await fs.addDoc(fs.collection(db, COL_SURTIDOS, id, "historial"), {
            de: estadoAnterior, a: siguienteEstado, por: opsNombreActual(), porEmail: opsUsuarioActual(),
            ts: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
        });
        // Notificación real cuando queda "listo" — Operaciones no depende de estar viendo la pantalla.
        if (siguienteEstado === "listo") {
            const prod = (s.productos && s.productos[0]) || {};
            await fs.addDoc(fs.collection(db, COL_NOTIFICACIONES), {
                tipo: "solicitud_lista", solicitudId: id, folio: s.folio,
                mensaje: `Solicitud ${s.folio} lista para surtir — ${prod.desc || ""} para ${s.tecnicoNombre || s.solicitante || "—"}.`,
                leida: false, fecha: opsFechaHora(),
            });
            window.mostrarPush ? mostrarPush("Almacén", `Solicitud ${s.folio} lista para surtir.`, "🔔") : null;
        }
        const panel = document.getElementById("ops-panel-wrap");
        if (panel) panel.innerHTML = "";
    };

    // ═══════════════════════ TAB: CENTRO DE ALERTAS ═══════════════════════
    function opsRenderAlertas() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;

        const criticas = [];
        const pendientes = [];
        const preventivas = [];
        const info = [];

        cacheHerr.filter(h => ["danada", "extraviada"].includes(h.estado)).forEach(h =>
            criticas.push(`Herramienta ${h.folio} (${h.descripcion}) reportada ${h.estado === "danada" ? "dañada" : "extraviada"}.`));

        cacheHerr.filter(h => h.estado === "reparacion").forEach(h =>
            pendientes.push(`Herramienta ${h.folio} sigue en reparación.`));

        cacheSurtidos.filter(s => (s.prioridad === "urgente") && !["entregado", "rechazada", "cancelada"].includes(s.estado || "pendiente")).forEach(s =>
            pendientes.push(`Solicitud ${s.folio} urgente sin entregar (${(ESTADOS_SOLICITUD[s.estado || "pendiente"] || {}).label || "pendiente"}).`));

        cacheTec.filter(t => t.estatus === "baja").forEach(t => {
            const herrPend = cacheHerr.filter(h => h.tecnicoActualId === t.id).length;
            const matPend = cacheAlmacenTec.filter(m => m.tecnicoId === t.id && m.cantidad > 0).length;
            if (herrPend || matPend) criticas.push(`${t.nombre} (baja) tiene ${herrPend ? herrPend + " herramienta(s)" : ""}${herrPend && matPend ? " y " : ""}${matPend ? matPend + " material(es)" : ""} sin devolver.`);
        });

        cacheTec.filter(t => t.estatus === "activo" && t.fechaIngreso === opsHoy()).forEach(t => info.push(`Alta reciente: ${t.nombre} (N.° ${t.numeroOperativo}).`));

        function bloque(titulo, color, bg, items) {
            if (!items.length) return "";
            return `<div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:12px;">
                <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;"></span>${titulo} (${items.length})</div>
                ${items.map(txt => `<div style="font-size:12px;color:#334155;padding:6px 0;border-bottom:1px solid #eef1f5;">${opsEsc(txt)}</div>`).join("")}
            </div>`;
        }

        el.innerHTML = bloque("Críticas", "#b91c1c", "#fee2e2", criticas)
            + bloque("Pendientes", "#b45309", "#fef3c7", pendientes)
            + bloque("Preventivas", "#854d0e", "#fef9c3", preventivas)
            + bloque("Información", "#0B5FFF", "#e0e7ff", info)
            + (!criticas.length && !pendientes.length && !preventivas.length && !info.length
                ? '<div style="background:#fff;border-radius:12px;padding:24px;text-align:center;color:#94a3b8;font-size:12.5px;">Sin alertas activas — todo en orden.</div>' : "");
    }

    // ═══════════════════════ TAB: MOVIMIENTOS ═══════════════════════
    let filtroMovRango = "todos";
    let filtroMovTipo = "todos";

    function opsRenderMovimientos() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;

        const hoy = opsHoy();
        const haceNDias = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
        const rangos = { hoy: hoy, semana: haceNDias(7), mes: haceNDias(30), trimestre: haceNDias(90) };

        let lista = cacheMov.slice();
        if (filtroMovRango !== "todos" && rangos[filtroMovRango]) lista = lista.filter(m => (m.fecha || "").slice(0, 10) >= rangos[filtroMovRango]);
        if (filtroMovTipo !== "todos") lista = lista.filter(m => m.tipo === filtroMovTipo);

        const tipos = [...new Set(cacheMov.map(m => m.tipo))];
        const kpiAsignaciones = lista.filter(m => ["asignacion", "transferencia"].includes(m.tipo)).length;
        const kpiDevoluciones = lista.filter(m => m.tipo === "devolucion").length;
        const kpiIncidencias = lista.filter(m => ["danio", "perdida", "baja"].includes(m.tipo)).length;

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px;">
                <div style="background:#fff;border-radius:12px;padding:13px 15px;"><div style="font-size:10.5px;color:#94a3b8;">Asignaciones/transferencias</div><div style="font-size:19px;font-weight:700;color:#1e293b;">${kpiAsignaciones}</div></div>
                <div style="background:#fff;border-radius:12px;padding:13px 15px;"><div style="font-size:10.5px;color:#94a3b8;">Devoluciones</div><div style="font-size:19px;font-weight:700;color:#1e293b;">${kpiDevoluciones}</div></div>
                <div style="background:#fff;border-radius:12px;padding:13px 15px;"><div style="font-size:10.5px;color:#94a3b8;">Incidencias (daño/pérdida/baja)</div><div style="font-size:19px;font-weight:700;color:#b91c1c;">${kpiIncidencias}</div></div>
            </div>
            <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Central de movimientos</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${["todos:Todos", "hoy:Hoy", "semana:Semana", "mes:Mes", "trimestre:Últimos 3 meses"].map(r => {
                            const [id, label] = r.split(":");
                            const activo = filtroMovRango === id;
                            return `<button onclick="opsFiltrarMovRango('${id}')" style="background:${activo ? "#0B5FFF" : "#f1f5f9"};color:${activo ? "#fff" : "#475569"};border:none;font-size:10.5px;font-weight:600;padding:6px 10px;border-radius:7px;cursor:pointer;">${label}</button>`;
                        }).join("")}
                        <select onchange="opsFiltrarMovTipo(this.value)" style="border:1px solid #cbd5e1;border-radius:7px;padding:5px 8px;font-size:10.5px;">
                            <option value="todos">Todos los tipos</option>
                            ${tipos.map(t => `<option value="${opsEsc(t)}" ${filtroMovTipo === t ? "selected" : ""}>${opsEsc(t)}</option>`).join("")}
                        </select>
                    </div>
                </div>
                <div style="border-left:2px solid #e2e8f0;padding-left:14px;">
                    ${lista.length ? lista.slice(0, 200).map(m => opsItemMovimiento(m)).join("") : '<div style="color:#94a3b8;font-size:12.5px;">Sin movimientos en este filtro.</div>'}
                </div>
            </div>`;
    }
    window.opsFiltrarMovRango = function (r) { filtroMovRango = r; opsRenderMovimientos(); };
    window.opsFiltrarMovTipo = function (t) { filtroMovTipo = t; opsRenderMovimientos(); };

    function opsItemMovimiento(m) {
        const color = { asignacion: "#0B5FFF", transferencia: "#0B5FFF", devolucion: "#059669", baja: "#b91c1c", danio: "#b91c1c", perdida: "#b91c1c", reparacion: "#b45309", alta: "#64748b" }[m.tipo] || "#64748b";
        return `<div style="margin-bottom:12px;position:relative;cursor:pointer;" onclick="opsAbrirDetalleMovimiento('${m.id}')">
            <div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:${color};"></div>
            <div style="font-size:12.5px;font-weight:600;color:#1e293b;">${opsEsc(m.tipo)} — ${opsEsc(m.herramientaId)}</div>
            <div style="font-size:11px;color:#64748b;">${opsEsc((m.fecha || "").slice(0, 16).replace("T", " "))} · ${opsEsc(opsNombreTecnico(m.tecnicoNuevoId || m.tecnicoAnteriorId))} · ${opsEsc(m.usuarioNombre || m.usuarioEmail || "")}</div>
        </div>`;
    }

    window.opsAbrirDetalleMovimiento = function (id) {
        const m = cacheMov.find(x => x.id === id);
        if (!m) return;
        const h = cacheHerr.find(x => x.id === m.herramientaId);
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:420px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                    <div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(m.tipo)}</div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                <div style="font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Fecha:</strong> ${opsEsc((m.fecha || "").slice(0, 16).replace("T", " "))}</div>
                    <div><strong>Herramienta:</strong> ${opsEsc(m.herramientaId)} ${h ? "— " + opsEsc(h.descripcion) : ""}</div>
                    ${m.tecnicoAnteriorId ? `<div><strong>Técnico anterior:</strong> ${opsEsc(opsNombreTecnico(m.tecnicoAnteriorId))}</div>` : ""}
                    ${m.tecnicoNuevoId ? `<div><strong>Técnico nuevo:</strong> ${opsEsc(opsNombreTecnico(m.tecnicoNuevoId))}</div>` : ""}
                    ${m.ubicacionAnterior ? `<div><strong>Ubicación anterior:</strong> ${opsEsc(m.ubicacionAnterior)}</div>` : ""}
                    ${m.ubicacionNueva ? `<div><strong>Ubicación nueva:</strong> ${opsEsc(m.ubicacionNueva)}</div>` : ""}
                    <div><strong>Usuario:</strong> ${opsEsc(m.usuarioNombre || m.usuarioEmail)}</div>
                    ${m.motivo ? `<div><strong>Motivo:</strong> ${opsEsc(m.motivo)}</div>` : ""}
                    ${m.observaciones ? `<div><strong>Observaciones:</strong> ${opsEsc(m.observaciones)}</div>` : ""}
                </div>
            </div>
        </div>`;
    };

})();
