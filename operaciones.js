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
    const COL_VEHICULOS_ASIG = "ops_vehiculo_asignaciones"; // historial real de vehículo por técnico (dato propio de Operaciones, no inventa GPS de Flotilla)
    const COL_FOLIOS = "ops_folios"; // Folios de servicio (Connecteam) con seguimiento de vencimiento/atención/solución
    const COL_CLIENTES = "ops_clientes"; // Catálogo de clientes con su tabla de SLA por prioridad (P1-P6, en horas)
    const COL_REVISIONES = "ops_revisiones_herramienta"; // Bitácora de auditorías físicas de herramienta por técnico (distinta de COL_AUDITORIA, que es el log de cambios de campos)
    const MIGUEL_EMAIL = "miguel@tecnocontrol.com.mx"; // dueño del seguimiento interno (fecha de atención / compromiso)

    // Administradores del departamento de Operaciones: acceso total DENTRO de este módulo
    // (subir/editar/cambiar todo). No son esAdminTotal, así que NO obtienen acceso a otros
    // departamentos del portal — el alcance queda limitado a operaciones.js.
    const OPS_ADMINS = [
        "miguel@tecnocontrol.com.mx",
        "clientes@tecnocontrol.com.mx",
        "u.nunez@tecnocontrol.com.mx",
        "magali@tecnocontrol.com.mx",
    ];

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

    // Flotilla vive en LA MISMA base de Firestore que Operaciones (fl_usuarios, flotilla_vehiculos,
    // flotilla_transferencias) — no es un sistema externo. Se lee directamente, sin adaptador ficticio.
    window.opsFlotillaProvider = {
        async obtenerVehiculoActual(tecnicoId) {
            const t = cacheTec.find(x => x.id === tecnicoId);
            if (!t || !t.correo) return null; // sin correo capturado todavía no hay forma de hacer match confiable
            try {
                const { db, fs } = await opsGetFB();
                const snapUser = await fs.getDocs(fs.query(fs.collection(db, "fl_usuarios"), fs.where("email", "==", t.correo)));
                if (snapUser.empty) return null;
                const flUser = snapUser.docs[0].data();
                const eco = flUser.ecoVinculado || (Array.isArray(flUser.ecosVinculados) ? flUser.ecosVinculados[0] : null);
                if (!eco) return null;
                let vehData = null;
                const directo = await fs.getDoc(fs.doc(db, "flotilla_vehiculos", String(eco)));
                if (directo.exists()) vehData = directo.data();
                else {
                    const snapVeh = await fs.getDocs(fs.query(fs.collection(db, "flotilla_vehiculos"), fs.where("eco", "==", String(eco))));
                    if (!snapVeh.empty) vehData = snapVeh.docs[0].data();
                }
                if (!vehData) return { unidad: "ECO " + eco, marca: "", modelo: "", estado: "Sin detalle en Flotilla" };
                return {
                    unidad: "ECO " + eco,
                    marca: vehData.marca || "", modelo: vehData.modelo || "",
                    estado: vehData.estatus || vehData.estado || "—",
                };
            } catch (e) {
                console.warn("[opsFlotillaProvider] No se pudo leer Flotilla:", e.message);
                return null;
            }
        },
        async obtenerUbicacionesEnCampo() {
            // Flotilla SÍ registra GPS en tiempo real desde hace unas semanas:
            // colección flotilla_ubicaciones, un documento por ECO, campos
            // {eco, lat, lng, precision, email, nombre, capturadoEn}. Se
            // sobreescribe cada vez que un técnico abre la app o se vincula
            // a un vehículo (no hay rastreo continuo en segundo plano —
            // limitación real de la PWA, no de este código).
            try {
                const { db, fs } = await opsGetFB();
                const snap = await fs.getDocs(fs.collection(db, "flotilla_ubicaciones"));
                return snap.docs
                    .map(d => d.data())
                    .filter(u => u.lat && u.lng)
                    .map(u => ({
                        lat: u.lat, lng: u.lng, eco: u.eco,
                        tecnicoNombre: u.nombre || u.email || ("ECO " + u.eco),
                        actualizadoEn: u.capturadoEn || null,
                    }));
            } catch (e) {
                console.warn("[opsFlotillaProvider] No se pudo leer flotilla_ubicaciones:", e.message);
                return [];
            }
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

    // Catálogo inicial de clientes con su tabla de SLA (horas por prioridad P1-P6).
    // OXXO GAS: 7 días=168h, 15 días=360h, 30 días=720h, 6 meses=4380h (30.4d/mes promedio).
    // "palabrasClave" se usa para detectar el cliente automáticamente por el nombre de la estación.
    const CLIENTES_SEED = [
        { nombre: "Petro Siete", palabrasClave: ["petro siete", "petrosiete"], horasSLA: { P1: 4, P2: 8, P3: 24, P4: 36, P5: 48, P6: 168 } },
        { nombre: "OXXO GAS", palabrasClave: ["oxxo"], horasSLA: { P1: 6, P2: 24, P3: 168, P4: 360, P5: 720, P6: 4380 } },
    ];
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
    // Dataset REAL importado del Excel HERRAMIENTA_TECNICOS.xlsx (12 técnicos, 354 piezas).
    // Folios EXACTOS del Excel (#01-001 etc.) se conservan como identificador permanente,
    // por decisión explícita — no se migran a HT-XXXXXX.
    const EXCEL_REAL_TECNICOS = [
        { numero: "01", nombre: "Ulises Nu\u00f1ez", items: [
            ["#01-001", "JUEGO DE DADOS", 1, null],
            ["#01-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#01-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#01-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#01-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#01-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#01-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, "NUEVO"],
            ["#01-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, "NUEVO"],
            ["#01-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#01-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, "NUEVO"],
            ["#01-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#01-013", "MULTIMETRO  TURPER MUL-33", 1, null],
            ["#01-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#01-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#01-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 2, null],
            ["#01-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, "NUEVO"],
            ["#01-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#01-019", "ARCO DE SEGUETA", 1, null],
            ["#01-022", "MARTILLO DE BOLA", 1, null],
            ["#01-023", "LLAVE DE BANDA", 1, null],
            ["#01-024", "PINZAS DE PUNTA PRETUL", 1, "NUEVO"],
            ["#01-025", "DESARMADOR DE CAJA 1/4", 1, null],
            ["#01-026", "CORTA TUBO PRETUL", 1, null],
            ["#01-027", "LIMA PLANA", 1, null],
            ["#01-028", "PORTA NAVAJA SIN NAVAJA", 1, null],
            ["#01-029", "CEPILLO DE ALMABRE", 1, null],
            ["#01-030", "LLAVES TROX", 1, null],
            ["#01-031", "PINZAS DE MECANICO", 1, "NUEVO"],
            ["#01-032", "LLAVE STILSON 10\" URREA", 1, "NUEVO"],
            ["#01-033", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, "NUEVO"],
            ["#01-034", "LLAVE DE CADENA 5/8\" GEARWRENCH", 1, "NUEVO / MERCADO LIBRE"],
            ["#01-035", "CABLE USB A SERIAL (PARA VEEDER ROOT)", 1, "STEREN 5/08/25  $290"],
            ["#01-036", "CAUTIN DE LAPIZ", 1, "STEREN 5/08/25  $190"],
            ["#01-034", "LLAVE DE CADENA 5/8\" GEARWRENCH", 1, null],
        ]},
        { numero: "02", nombre: "Alan Estrada", items: [
            ["#02-001", "JUEGO DE DADOS", 1, null],
            ["#02-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#02-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#02-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#02-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#02-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#02-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#02-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#02-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#02-010", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#02-011", "JUEGO DESARMADORES AMBAR", 1, null],
            ["#02-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#02-013", "MULTIMETRO  TURPER MUL-33", 1, null],
            ["#02-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#02-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#02-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 2, null],
            ["#02-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#02-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#02-019", "ARCO DE SEGUETA", 1, null],
            ["#02-022", "MARTILLO DE BOLA", 1, null],
            ["#02-023", "LLAVE DE BANDA", 1, null],
            ["#02-024", "PINZAS DE PUNTA PRETUL", 1, null],
            ["#02-025", "DESARMADOR DE CAJA 1/4", 1, null],
            ["#02-026", "CORTA TUBO PRETUL", 1, null],
            ["#02-027", "LIMA PLANA", 1, null],
            ["#02-028", "PORTA NAVAJA SIN NAVAJA", 1, null],
            ["#02-029", "CEPILLO DE ALMABRE", 1, null],
            ["#02-030", "LLAVES TROX", 1, null],
            ["#02-031", "PINZAS DE MECANICO", 1, null],
            ["#02-032", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
        ]},
        { numero: "03", nombre: "Roberto Mu\u00f1oz", items: [
            ["#03-001", "JUEGO DE DADOS", 1, null],
            ["#03-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#03-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#03-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#03-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#03-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#03-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#03-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#03-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#03-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#03-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#03-011", "JUEGO DESARMADORES AMBAR", 1, null],
            ["#03-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#03-013", "MULTIMETRO  TURPER MUL-33", 1, null],
            ["#03-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#03-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#03-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 2, null],
            ["#03-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#03-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#03-019", "ARCO DE SEGUETA", 1, null],
            ["#03-022", "MARTILLO DE BOLA", 1, null],
            ["#03-023", "LLAVE DE BANDA", 1, null],
            ["#03-024", "PINZAS DE PUNTA PRETUL", 1, null],
            ["#03-025", "DESARMADOR DE CAJA 1/4", 1, null],
            ["#03-026", "CORTA TUBO PRETUL", 1, null],
            ["#03-027", "LIMA PLANA", 1, null],
            ["#03-028", "PORTA NAVAJA SIN NAVAJA", 1, null],
            ["#03-029", "CEPILLO DE ALMABRE", 1, null],
            ["#03-030", "LLAVES TROX", 1, null],
            ["#03-031", "PINZAS DE MECANICO", 1, null],
            ["#03-032", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
        ]},
        { numero: "04", nombre: "Ricardo Gonzalez", items: [
            ["#04-001", "JUEGO DE DADOS", 1, null],
            ["#04-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, "DE 1/4 A 3/4 FALTA 7/16"],
            ["#04-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, "8,12,13,15,17,18,19,20"],
            ["#04-004", "LLAVE STILSON 8\" URREA", 1, "NUEVO"],
            ["#04-005", "LLAVE STILSON 14\" URREA", 1, "NUEVO"],
            ["#04-006", "LLAVE STILSON 18\" URREA", 1, "NUEVO"],
            ["#04-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#04-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, "AMARILLO COMBINADO"],
            ["#04-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, "NARAJNA COMBINADO"],
            ["#04-009", "PINZAS ELECTRICISTA URREA", 1, "NUEVO"],
            ["#04-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, "NUEVO"],
            ["#04-011", "JUEGO DESARMADORES AMBAR", 1, "2 DE PALETA 1 DE CRUZ"],
            ["#04-012", "JUEGO DESARMADORES ELECTRICISTA", 1, "2 PALETA 1 CRUZ"],
            ["#04-013", "MULTIMETRO  TURPER MUL-33", 1, null],
            ["#04-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, "NUEVO"],
            ["#04-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, "NUEVO"],
            ["#04-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 2, null],
            ["#04-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#04-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, "NUEVO"],
            ["#04-019", "ARCO DE SEGUETA", 1, "NUEVO"],
            ["#04-022", "MARTILLO DE BOLA", 1, null],
            ["#04-023", "LLAVE DE BANDA", 1, null],
            ["#04-024", "PINZAS DE PUNTA PRETUL", 1, null],
            ["#04-025", "DESARMADOR DE CAJA 1/4", 1, null],
            ["#04-026", "CORTA TUBO PRETUL", 1, null],
            ["#04-027", "LIMA PLANA", 1, null],
            ["#04-028", "PORTA NAVAJA SIN NAVAJA", 1, null],
            ["#04-029", "CEPILLO DE ALMABRE", 1, null],
            ["#04-030", "LLAVES TROX", 1, null],
            ["#04-031", "PINZAS DE MECANICO", 1, null],
            ["#04-032", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, "NUEVO"],
            ["#04-033", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
            ["#04-034", "SERRUCHO PARA PALMAS", 1, "HOME DEPOT 165"],
        ]},
        { numero: "05", nombre: "Jorge Uribe", items: [
            ["#05-001", "JUEGO DE DADOS STANLY", 1, null],
            ["#05-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#05-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#05-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#05-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#05-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#05-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#05-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#05-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#05-010", "PINZAS DE PUNTA URREA", 1, null],
            ["#05-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#05-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#05-013", "MULTIMETRO STEREN MUL-108", 1, null],
            ["#05-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#05-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#05-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 1, null],
            ["#05-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#05-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#05-019", "ARCO DE SEGUETA", 1, null],
            ["#05-020", "CAJA HERRAMIENTA SURTEK", 1, null],
            ["#05-021", "PINZAS DE CORTE DIAGONAL URREA", 1, null],
            ["#05-022", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
            ["#05-023", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, "3 JUL 25 HERRAMIENTAS DEL NORTE"],
            ["#05-024", "JUEGO DE DESARMADORES ELECTRICOS 10 PIEZAS", 1, "CHINA"],
            ["#05-025", "TESTER POLARIDAD ELECTRICA", 1, null],
            ["#05-026", "PINZAS DE PONCHADO RJ45 CAT 5", 1, null],
            ["#05-027", "PINZAS DE PONCHADO RJ45 CAT 6", 1, null],
            ["#05-028", "PONCHADORA DE IMPACTO RJ45", 1, null],
            ["#05-029", "PINZA DESFORRADORA MECANICA", 1, "CHINA"],
            ["#05-030", "PROBADOR CABLE DE RED RJ 45", 1, null],
            ["#05-031", "CAUTIN TIPO LAPIZ 25W CON AJUSTE DE POT", 1, "STEREN 04/07/2023 FACT 626292"],
            ["#05-032", "SOPLADORA DE AIRE CON CARGADOR", 1, null],
            ["#05-023", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, "#05-024 JUEGO DE DESARMADORES ELECTRICOS 10 PIEZAS"],
            ["#05-025", "TESTER POLARIDAD ELECTRICA", 1, null],
            ["#05-027", "PINZAS DE PONCHADO RJ45 CAT 6", 1, "#05-028 PONCHADORA DE IMPACTO RJ45"],
            ["#05-029", "PINZA DESFORRADORA MECANICA", 1, "#05-030 PROBADOR CABLE DE RED RJ 45"],
            ["#05-031", "CAUTIN TIPO LAPIZ 25W CON AJUSTE DE POT", 1, null],
        ]},
        { numero: "06", nombre: "Ismael Barraza", items: [
            ["#06-001", "JUEGO DE DADOS STANLY", 1, "*PEND"],
            ["#06-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#06-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#06-004", "LLAVE STILSON 8\" URREA", 1, "NUEVO"],
            ["#06-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#06-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#06-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, "NUEVO"],
            ["#06-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#06-009", "PINZAS ELECTRICISTA URREA", 1, "NUEVO"],
            ["#06-010", "PINZAS DE PUNTA URREA", 1, null],
            ["#06-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, "NUEVO"],
            ["#06-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#06-013", "MULTIMETRO STEREN MUL-108", 1, null],
            ["#06-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#06-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, "NUEVO"],
            ["#06-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 1, null],
            ["#06-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#06-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, "NUEVO"],
            ["#06-019", "ARCO DE SEGUETA", 1, "NUEVO"],
            ["#06-020", "CAJA HERRAMIENTA SURTEK", 1, null],
            ["#06-021", "PINZAS DE CORTE DIAGONAL URREA", 1, null],
            ["#06-022", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, "NUEVO"],
            ["#06-023", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
        ]},
        { numero: "07", nombre: "Roel Luna", items: [
            ["#07-001", "JUEGO DE DADOS STANLY", 1, null],
            ["#07-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#07-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#07-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#07-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#07-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#07-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#07-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#07-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#07-010", "PINZAS DE PUNTA URREA", 1, null],
            ["#07-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#07-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#07-013", "MULTIMETRO STEREN MUL-108", 1, null],
            ["#07-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#07-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#07-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 1, null],
            ["#07-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#07-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#07-019", "ARCO DE SEGUETA", 1, null],
            ["#07-020", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, "YA SE TIENE"],
            ["#07-021", "PINZAS DE CORTE DIAGONAL URREA", 1, null],
            ["#07-022", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, null],
            ["#07-023", "ASPIRADORA RIDGID 16", 1, "YA SE TIENE"],
            ["#07-024", "HIDROLAVADORA ELECTRICA 2,000 PSI CON MANGUERA (HOME DEPOT)", 1, "6464"],
            ["#07-025", "DADOS", 1, "30 JUN 25 CASA MYERS"],
            ["#07-026", "JUEGO DE 3 ADAPTADORES DE DADO PARA TALADRO TRUPER", 1, "FERRE MARGARITA HERNANDEZ DAVILA"],
            ["#07-027", "GAUGE DOBLE 120 PSI", 1, "04/08/2025 CASA MYERS"],
            ["#07-028", "MANGUERA 3 CAPAS DE 1/2\" X 25 MTS", 1, "07/08/2025 CASA MYERS - 28/AGOSTO"],
            ["#07-029", "MANGUERA DE USO RUDO 1/2\" 500 PSI CON CONEXIONES", 1, "PARKER SOTRE 30 AGO"],
        ]},
        { numero: "08", nombre: "Sergio Mendoza", items: [
            ["#08-001", "JUEGO DE DADOS", 1, null],
            ["#08-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#08-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#08-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#08-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#08-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#08-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, "NUEVO"],
            ["#08-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, "NUEVO"],
            ["#08-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#08-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, "NUEVO"],
            ["#08-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#08-013", "MULTIMETRO  TURPER MUL-33", 1, null],
            ["#08-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#08-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#08-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 2, null],
            ["#08-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, "NUEVO"],
            ["#08-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#08-019", "ARCO DE SEGUETA", 1, null],
            ["#08-022", "MARTILLO DE BOLA", 1, null],
            ["#08-023", "LLAVE DE BANDA", 1, null],
            ["#08-024", "PINZAS DE PUNTA PRETUL", 1, "NUEVO"],
            ["#08-025", "DESARMADOR DE CAJA 1/4", 1, null],
            ["#08-026", "CORTA TUBO PRETUL", 1, null],
            ["#08-027", "LIMA PLANA", 1, null],
            ["#08-028", "PORTA NAVAJA SIN NAVAJA", 1, null],
            ["#08-029", "CEPILLO DE ALMABRE", 1, null],
            ["#08-030", "LLAVES TROX", 1, null],
            ["#08-031", "PINZAS DE MECANICO", 1, "NUEVO"],
            ["#08-032", "LLAVE STILSON 10\" URREA", 1, "NUEVO"],
            ["#08-033", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
        ]},
        { numero: "09", nombre: "Enrique Arguelles", items: [
            ["#09-001", "JUEGO DE DADOS STANLY", 1, null],
            ["#09-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#09-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#09-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#09-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#09-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#09-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#09-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#09-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#09-010", "PINZAS DE PUNTA URREA", 1, null],
            ["#09-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#09-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#09-013", "MULTIMETRO STEREN MUL-108", 1, null],
            ["#09-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#09-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#09-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 1, null],
            ["#09-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#09-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#09-019", "ARCO DE SEGUETA", 1, null],
            ["#09-020", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
            ["#09-021", "PINZAS DE CORTE DIAGONAL URREA", 1, null],
            ["#09-022", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, null],
            ["#09-023", "SOPLADORA DE AIRE CON CARGADOR", 1, null],
        ]},
        { numero: "10", nombre: "Sergio Carmona", items: [
            ["#010-001", "JUEGO DE DADOS STANLY", 1, null],
            ["#010-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#010-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#010-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#010-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#010-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#010-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#010-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#010-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#010-010", "PINZAS DE PUNTA URREA", 1, null],
            ["#010-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#010-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#010-013", "MULTIMETRO STEREN MUL-108", 1, null],
            ["#010-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#010-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#010-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 1, null],
            ["#010-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#010-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#010-019", "ARCO DE SEGUETA", 1, null],
            ["#010-020", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
            ["#010-021", "PINZAS DE CORTE DIAGONAL URREA", 1, null],
            ["#010-022", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, null],
        ]},
        { numero: "11", nombre: "Ricardo Moriel", items: [
            ["#011-001", "ADAPTADOR PUNTA PARA DADO 3/8", 1, null],
            ["#011-002", "ARCO DE SEGUETA FIJO", 1, null],
            ["#011-003", "CINCEL 3/4 X 8\u201d", 1, "DA\u00d1ADO"],
            ["#011-004", "CORTATUBO CAP. DE 1 1/4\u201d", 1, null],
            ["#011-005", "DESARMADOR CRUZ TIPO TROMPO", 1, null],
            ["#011-006", "DESARMADOR PALETA TIPO TROMPO", 1, null],
            ["#011-007", "FLEXOMETRO 5 MTS.", 1, null],
            ["#011-008", "JGO DE DADOS 205 PZAS", 1, null],
            ["#011-009", "JGO. BROCAS AL TITANIO", 1, "4 DESARMADORES"],
            ["#011-010", "JGO. DE DESARMADORES", 1, null],
            ["#011-011", "JGO. DE LLAVES ALLEN MM.", 1, null],
            ["#011-012", "JGO. DE LLAVES ALLEN STD", 1, "INCOMPLETAS"],
            ["#011-013", "JGO. DESARMADORES DE ELECTRICISTA", 1, null],
            ["#011-014", "JGO. DESARMADORES DE JOYERO", 1, null],
            ["#011-015", "JGO. LIMAS", 1, null],
            ["#011-016", "JGO. LLAVES MIXTAS MM", 1, "INCOMPLETAS"],
            ["#011-017", "JGO. LLAVES MIXTAS STD", 1, null],
            ["#011-018", "JGO. LLAVES TORX", 1, null],
            ["#011-019", "LINTERNA LED", 1, null],
            ["#011-020", "LLAVE INGLESA 10\u201d", 1, "FALTA 1"],
            ["#011-021", "LLAVE INGLESA 15\u201d", 1, null],
            ["#011-022", "LLAVE STILLSON 14\u201d", 1, "FALTA 1"],
            ["#011-023", "LLAVE STILLSON 18\u201d", 1, null],
            ["#011-024", "LLAVE STILLSON 8\u201d", 1, null],
            ["#011-025", "LLAVE UNIVERSAL DE CADENA", 1, null],
            ["#011-026", "MAGNETO TELESCOPICO", 1, null],
            ["#011-027", "MARRO CON MANGO", 1, null],
            ["#011-028", "MARTILLO DE BOLA", 1, null],
            ["#011-029", "MULTIMETRO", 1, null],
            ["#011-030", "NAVAJA METALICA RETRACTIL", 1, null],
            ["#011-031", "PINZA MECANICA 8\u201d", 1, null],
            ["#011-032", "PINZAS DE CORTE DIAGONAL", 1, null],
            ["#011-033", "PINZAS DE ELECTRICISTA", 1, null],
            ["#011-034", "PINZAS DE PRESION 10\u201d", 1, null],
            ["#011-035", "PINZAS DE PUNTA", 1, null],
            ["#011-036", "QUITA FILTRO DE BANDA", 1, null],
            ["#011-037", "SUJETADOR", 1, null],
            ["#011-038", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, null],
            ["#011-039", "TERMO NEGRO 128 OZ", 1, null],
        ]},
        { numero: "13", nombre: "Jose Luis Valenzuela", items: [
            ["#013-001", "JUEGO DE DADOS STANLY", 1, null],
            ["#013-002", "JGO. LLAVES ESPA\u00d1OLAS STD DE 9 PIEZAS", 1, null],
            ["#013-003", "JGO. LLAVES ESPA\u00d1OLAS MM DE 9 PIEZAS", 1, null],
            ["#013-004", "LLAVE STILSON 8\" URREA", 1, null],
            ["#013-005", "LLAVE STILSON 14\" URREA", 1, null],
            ["#013-006", "LLAVE STILSON 18\" URREA", 1, null],
            ["#013-007", "JUEGO LLAVES ALLEN STD. TIPO L", 1, null],
            ["#013-008", "JUEGO LLAVES ALLEN MM. TIPO L", 1, null],
            ["#013-009", "PINZAS ELECTRICISTA URREA", 1, null],
            ["#013-010", "PINZAS DE PUNTA URREA", 1, null],
            ["#013-011", "JUEGO DESARMADORES AMBAR 8 PIEZAS", 1, null],
            ["#013-012", "JUEGO DESARMADORES ELECTRICISTA", 1, null],
            ["#013-013", "MULTIMETRO STEREN MUL-108", 1, null],
            ["#013-014", "LLAVE UNIVERSAL DE CADENA URREA", 1, null],
            ["#013-015", "LLAVE AJUSTABLE 10\" (CRECENT)", 1, null],
            ["#013-016", "LLAVE AJUSTABLE 15\" (CRECENT)", 1, null],
            ["#013-017", "MARRO 4LB MANGO FIBRA DE VIDRIO", 1, null],
            ["#013-018", "PINZAS DE PRESION 10\" (PERRAS)", 1, null],
            ["#013-019", "ARCO DE SEGUETA", 1, null],
            ["#013-020", "CAJA HERRAMIENTA HUSKY 3 NIVELES", 1, null],
            ["#013-021", "PINZAS DE CORTE DIAGONAL URREA", 1, null],
            ["#013-022", "TALADRO INALAMBRICO DEWALT BRUSHLESS", 1, null],
            ["#013-023", "SOPLADORA DE AIRE CON CARGADOR", 1, null],
        ]},
    ];

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
    let unsubHerr = null, unsubTec = null, unsubMov = null, unsubSurt = null, unsubFolios = null, unsubNotif = null;
    let cacheHerr = [], cacheTec = [], cacheMov = [], cacheSurtidos = [], cacheFolios = [];
    let filtroFolios = "", filtroFolioSemaforo = "todos";
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
    let cacheVehiculosAsig = [];
    let cacheClientes = [];
    let fichaTecTabActual = "resumen";
    let catalogoProductos = []; // de catalogo/productos (Almacén real), cargado bajo demanda

    async function opsSembrarPuestosSiNecesario() {
        const { db, fs } = await opsGetFB();
        const snap = await fs.getDocs(fs.collection(db, COL_PUESTOS));
        if (!snap.empty) return;
        for (const p of PUESTOS_SEED) {
            await fs.addDoc(fs.collection(db, COL_PUESTOS), p);
        }
    }

    async function opsSembrarClientesSiNecesario() {
        const { db, fs } = await opsGetFB();
        const snap = await fs.getDocs(fs.collection(db, COL_CLIENTES));
        if (!snap.empty) return;
        for (const c of CLIENTES_SEED) {
            await fs.addDoc(fs.collection(db, COL_CLIENTES), c);
        }
    }

    // Detecta el cliente por nombre de estación usando las palabras clave del catálogo.
    // No fuerza nada: si no hay coincidencia, regresa null y se captura manual.
    function opsDetectarClientePorNombre(estacion) {
        const texto = String(estacion || "").toLowerCase();
        if (!texto) return null;
        const match = cacheClientes.find(c => (c.palabrasClave || []).some(p => texto.includes(String(p).toLowerCase())));
        return match ? match.id : null;
    }

    function opsRolActual() {
        // Puente de compatibilidad con el esquema anterior (admin/almacén/consulta),
        // usado como respaldo cuando el usuario no tiene una Persona ligada todavía.
        const email = opsUsuarioActual();
        if (window.esAdminTotal && window.esAdminTotal(email)) return "administrador";
        if (OPS_ADMINS.includes((email || "").toLowerCase().trim())) return "administrador";
        const almacen = (window.USUARIOS_AREA && window.USUARIOS_AREA["Almacen"]) || [];
        if (almacen.map(e => e.toLowerCase()).includes(email.toLowerCase())) return "almacen";
        return "consulta";
    }

    // Permisos derivados del puesto REAL asignado al usuario en el módulo de Técnicos/Personas
    // (ops_tecnicos.puestoId → ops_puestos.permisos), haciendo match por correo con la sesión
    // actual. Esto es lo que faltaba: antes el catálogo de puestos existía pero nunca se
    // consultaba para decidir permisos de login — solo la lista fija OPS_ADMINS/Almacén.
    function opsPermisosPorPuestoDeCorreo(email) {
        if (!email) return [];
        const correo = String(email).toLowerCase().trim();
        const tec = cacheTec.find(t => t.estatus === "activo" && (t.correo || "").toLowerCase().trim() === correo);
        if (!tec || !tec.puestoId) return [];
        // Si cachePuestos aún no cargó (carrera de timing), se cae a PUESTOS_SEED emparejando
        // por nombre de puesto (PUESTOS_SEED no tiene id porque los ids los asigna Firestore).
        const puesto = (cachePuestos.length ? cachePuestos : PUESTOS_SEED)
            .find(p => (p.id && p.id === tec.puestoId) || p.nombre === tec.puesto);
        return puesto ? (puesto.permisos || []) : [];
    }

    function opsPermisosActuales() {
        const email = opsUsuarioActual();
        const rolLegado = opsRolActual();
        // "administrador" cubre tanto esAdminTotal (admin global del portal) como los
        // OPS_ADMINS (administradores solo de este departamento) — opsRolActual() ya
        // resuelve ambos casos, así que basta con leer su resultado una sola vez.
        if (rolLegado === "administrador") {
            return PUESTOS_SEED.flatMap(p => p.permisos).concat(["admin_operaciones"]); // acceso total
        }
        const basePorRolLegado = rolLegado === "almacen" ? ["gestionar_herramientas", "autorizar_material", "solicitar_material"] : [];
        // Unión: respaldo legado (Almacén) + puesto real asignado al correo actual. Así cualquier
        // usuario con un puesto que incluya el permiso lo tiene, sin depender de listas fijas en código.
        return [...new Set([...basePorRolLegado, ...opsPermisosPorPuestoDeCorreo(email), "consulta"])];
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
    // Folio consecutivo de Solicitud de Material: "OPERACIONES 0001", "OPERACIONES 0002"...
    // OJO: el kiosco público (solicitud-material.html) escribe con auth ANÓNIMA a Firestore,
    // por lo que NO puede compartir un contador atómico (ops_contadores) protegido para
    // usuarios autenticados — no sabemos si las reglas se lo permitirían. En vez de eso,
    // ambos puntos de entrada (kiosco y este módulo) calculan el folio leyendo el máximo
    // "folioNum" ya existente en `surtidos` con folioPrefijo:"OPERACIONES" y sumando 1.
    // Es "best effort" (no 100% atómico): si dos personas envían una solicitud en el mismo
    // instante podría repetirse un folio, igual que el resto de folios de este portal
    // (ver duplicado en almacen-pdf.js). Riesgo aceptado dado el volumen real de solicitudes.
    async function opsSiguienteFolioMaterial() {
        const { db, fs } = await opsGetFB();
        try {
            const snap = await fs.getDocs(fs.query(fs.collection(db, COL_SURTIDOS), fs.where("folioPrefijo", "==", "OPERACIONES")));
            let max = 0;
            snap.forEach(d => {
                const n = (d.data() || {}).folioNum;
                if (typeof n === "number" && n > max) max = n;
            });
            const siguiente = max + 1;
            return { folio: "OPERACIONES " + String(siguiente).padStart(4, "0"), folioNum: siguiente, folioPrefijo: "OPERACIONES" };
        } catch (e) {
            console.warn("[operaciones.js] no se pudo calcular el folio consecutivo, se usa respaldo temporal:", e && e.message);
            const respaldo = Date.now() % 10000;
            return { folio: "OPERACIONES " + String(respaldo).padStart(4, "0") + "-R", folioNum: null, folioPrefijo: "OPERACIONES" };
        }
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
        await opsSembrarClientesSiNecesario();
        await opsSuscribirTodo();
        opsIniciarVigilanciaFolios();
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
        if (unsubFolios) { unsubFolios(); unsubFolios = null; }
        if (unsubNotif) { unsubNotif(); unsubNotif = null; }
        opsDetenerVigilanciaFolios();
    };

    const NAV_ICONS = {
        resumen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
        dashboard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        guardias: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z"/></svg>',
        tecnicos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
        servicios: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7 12 3 4 7v10l8 4 8-4V7Z"/><path d="M4 7l8 4 8-4M12 11v10"/></svg>',
        solicitudes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h5m0-10v10m0-10h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-9"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>',
        alertas: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
        movimientos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
        folios: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="8" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>',
        clientes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/><path d="M9 8h.01M15 8h.01M12 8h.01"/></svg>',
    };

    function opsRenderShell() {
        const rol = opsRolActual();
        const rolLabel = { administrador: "Administrador", almacen: "Almacén", consulta: "Consulta" }[rol];
        const items = ["resumen:Resumen", "dashboard:Herramientas", "guardias:Guardias", "tecnicos:Técnicos", "servicios:Servicios",
            "folios:Folios", "clientes:Clientes",
            ...(opsPuedeHacer("autorizar_material") ? ["solicitudes:Solicitudes"] : []),
            "alertas:Alertas", "movimientos:Movimientos"];
        return `
        <div style="position:fixed;inset:0;z-index:99997;background:#f1f5f9;font-family:'Inter',sans-serif;display:flex;flex-direction:column;">
            <div style="background:linear-gradient(135deg,#0B5FFF,#0842B0);border-bottom:3px solid #062F73;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:10px;color:#fff;">
                    <span style="width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${ICON.wrench}</span>
                    <div>
                        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;">Operaciones</div>
                        <div style="font-size:10.5px;color:#dbeafe;">Hedma Tecnocontrol · Rol: ${rolLabel}</div>
                    </div>
                </div>
                <button onclick="opsCerrarHerramientas()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:30px;height:30px;border-radius:9px;cursor:pointer;">${ICON.close}</button>
            </div>

            <div style="flex:1;display:flex;overflow:hidden;">
                <div style="width:190px;background:#fff;border-right:1px solid #e2e8f0;padding:16px 10px;overflow-y:auto;flex-shrink:0;">
                    ${items.map(t => {
                        const [id, label] = t.split(":");
                        return `<button onclick="opsCambiarTab('${id}')" id="ops-tab-${id}" class="ops-tab-btn" style="width:100%;text-align:left;display:flex;align-items:center;gap:10px;background:none;border:none;border-left:3px solid transparent;padding:10px 11px;margin-bottom:2px;border-radius:0 8px 8px 0;font-size:12.5px;font-weight:600;color:#64748b;cursor:pointer;">
                            <span style="flex-shrink:0;display:flex;">${NAV_ICONS[id] || ""}</span>${label}
                        </button>`;
                    }).join("")}
                </div>
                <div style="flex:1;overflow-y:auto;padding:20px 26px 60px;">
                    <div id="ops-tab-content"></div>
                </div>
            </div>
        </div>
        <div id="ops-modal-wrap"></div>
        <div id="ops-panel-wrap"></div>
        `;
    }

    window.opsCambiarTab = function (tab) {
        tabActual = tab;
        document.querySelectorAll(".ops-tab-btn").forEach(b => {
            b.style.color = "#64748b"; b.style.background = "none"; b.style.borderLeftColor = "transparent";
        });
        const activo = document.getElementById("ops-tab-" + tab);
        if (activo) { activo.style.color = "#0B5FFF"; activo.style.background = "#eaf0ff"; activo.style.borderLeftColor = "#0B5FFF"; }
        if (tab === "resumen") opsRenderResumen();
        else if (tab === "dashboard") opsRenderDashboard();
        else if (tab === "guardias") opsRenderGuardias();
        else if (tab === "tecnicos") opsRenderTecnicos();
        else if (tab === "servicios") opsRenderServicios();
        else if (tab === "folios") opsRenderFolios();
        else if (tab === "clientes") opsRenderClientes();
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
        if (!unsubFolios) {
            unsubFolios = fs.onSnapshot(fs.collection(db, COL_FOLIOS), snap => {
                cacheFolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "folios") opsRenderFolios();
                if (tabActual === "resumen") opsRenderResumen();
                if (opsFoliosVigilanciaBase) opsVigilarFoliosSeveridad();
            }, () => { /* si aún no existe la colección, Folios simplemente inicia vacío */ });
        }
        if (!unsubNotif) {
            // Notificaciones generales (ej. "solicitud lista para surtir") — llegan a TODOS los
            // administradores que tengan Operaciones abierto en ese momento (onSnapshot en vivo),
            // con la misma alarma sonora (~10s) y ventana flotante que ya usan los folios vencidos.
            // "docChanges" con type:'added' es lo que evita una avalancha de alarmas al cargar:
            // solo se alerta por documentos genuinamente nuevos, nunca por los que ya existían.
            let notifBase = false;
            // Nota: solo filtro de igualdad (leida==false), sin orderBy — así Firestore no exige
            // crear un índice compuesto a mano; aquí no necesitamos orden, solo detectar altas nuevas.
            unsubNotif = fs.onSnapshot(fs.query(fs.collection(db, COL_NOTIFICACIONES), fs.where("leida", "==", false), fs.limit(30)), snap => {
                if (notifBase) {
                    snap.docChanges().forEach(ch => {
                        if (ch.type === "added") {
                            const n = { id: ch.doc.id, ...ch.doc.data() };
                            opsReproducirAlarmaFolio();
                            opsMostrarFlotanteGenerica(n.mensaje || "Nueva notificación de Operaciones.", n.esPrueba ? "#8B4FD6" : "#0B5FFF");
                        }
                    });
                }
                notifBase = true;
            }, () => { /* si aún no existe la colección o el índice, no pasa nada — se ignora */ });
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
        const snapVeh = await fs.getDocs(fs.collection(db, COL_VEHICULOS_ASIG));
        cacheVehiculosAsig = snapVeh.docs.map(d => ({ id: d.id, ...d.data() }));
        const snapClientes = await fs.getDocs(fs.collection(db, COL_CLIENTES));
        cacheClientes = snapClientes.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    // ═══════════════════════ TAB: DASHBOARD ═══════════════════════
    // ═══════════════════════ TAB: RESUMEN (vista general del departamento) ═══════════════════════
    async function opsRenderResumen() {
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

        const ubicacionesCampo = await window.opsFlotillaProvider.obtenerUbicacionesEnCampo();

        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">📍 Técnicos en campo — mapa en vivo</div>
                    <span style="font-size:10px;color:#94a3b8;">Fuente: Flotilla</span>
                </div>
                <div id="ops-mapa-resumen" style="height:220px;border-radius:10px;overflow:hidden;background:#e2e8f0;"></div>
                ${!ubicacionesCampo.length ? `<div style="font-size:10.5px;color:#94a3b8;margin-top:8px;">Sin conexión con Flotilla todavía — cuando exista GPS en tiempo real, aquí aparecerán los marcadores de cada técnico.</div>` : ""}
            </div>
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

        // Mapa real (Leaflet, ya usado en Flotilla) — centrado en Chihuahua, sin marcadores inventados.
        setTimeout(() => {
            const mapEl = document.getElementById("ops-mapa-resumen");
            if (!mapEl || !window.L) return;
            const mapa = L.map(mapEl, { zoomControl: false, attributionControl: false }).setView([28.6353, -106.0889], 12);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mapa);
            L.control.zoom({ position: "bottomright" }).addTo(mapa);
            ubicacionesCampo.forEach(u => {
                if (u.lat && u.lng) L.marker([u.lat, u.lng]).addTo(mapa).bindPopup(opsEsc(u.tecnicoNombre || u.tecnicoId));
            });
        }, 30);
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
                        <button onclick="opsImportarExcelReal()" class="mkt-add-btn" style="background:linear-gradient(135deg,#059669,#047857);">📥 Importar Excel real (12 técnicos)</button>
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
    // ── Importación REAL desde el Excel (folios exactos #01-001, permanentes) ──
    window.opsImportarExcelReal = async function () {
        const yaImportado = cacheHerr.some(h => /^#\d+-\d+$/.test(h.folio));
        if (yaImportado && !confirm("Parece que ya hay piezas con folio del Excel importadas. ¿Importar de todos modos? (los folios que ya existan se omiten, no se duplican)")) return;

        const { db, fs } = await opsGetFB();
        const foliosExistentes = new Set(cacheHerr.map(h => h.folio));
        let tecnicosCreados = 0, piezasCreadas = 0, piezasOmitidas = 0;

        for (const tec of EXCEL_REAL_TECNICOS) {
            // Buscar o crear el técnico por número operativo exacto del Excel.
            let tecnico = cacheTec.find(t => t.numeroOperativo === tec.numero);
            let tecnicoId;
            if (!tecnico) {
                const refPersona = await fs.addDoc(fs.collection(db, COL_PERSONAS), {
                    nombre: tec.nombre, estatus: "activo", fechaAlta: opsHoy(), fechaBaja: null,
                    telefono: null, correo: null, observaciones: "Importado desde Excel real",
                });
                const puestoTecnico = cachePuestos.find(p => p.nombre === "Técnico de Operaciones");
                const refTec = await fs.addDoc(fs.collection(db, COL_TECNICOS), {
                    numeroOperativo: tec.numero, personaId: refPersona.id, nombre: tec.nombre,
                    puestoId: puestoTecnico ? puestoTecnico.id : null,
                    puesto: puestoTecnico ? puestoTecnico.nombre : "Técnico de Operaciones",
                    departamento: "Operaciones", registroHistorico: 1,
                    estatus: "activo", fechaIngreso: opsHoy(), fechaBaja: null,
                    supervisor: null, telefono: null, correo: null, observaciones: "Importado desde Excel real",
                    employeeId: null, fleetUserId: null, firebaseUid: null,
                });
                tecnicoId = refTec.id;
                cacheTec.push({ id: tecnicoId, numeroOperativo: tec.numero, nombre: tec.nombre, estatus: "activo" });
                tecnicosCreados++;
            } else {
                tecnicoId = tecnico.id;
            }

            for (const [folio, descripcion, cantidad, observaciones] of tec.items) {
                if (foliosExistentes.has(folio)) { piezasOmitidas++; continue; }
                await fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, folio), {
                    folio, descripcion, cantidad, categoria: null, marca: "", modelo: "", numeroSerie: "",
                    condicionFisica: observaciones || null,
                    estado: "asignada", ubicacionActual: UBICACIONES[0],
                    tecnicoActualId: tecnicoId, fechaAsignacion: opsHoy(),
                    folioLegado: null, observaciones: observaciones || null,
                    fechaAlta: opsHoy(),
                    externalId: null, sourceSystem: "excel_import", lastSync: null, syncStatus: "no_sincronizado",
                });
                await opsRegistrarMovimiento({ herramientaId: folio, tipo: "alta", tecnicoNuevoId: tecnicoId, ubicacionNueva: UBICACIONES[0], observaciones: "Importado desde Excel real (HERRAMIENTA_TECNICOS.xlsx)" });
                foliosExistentes.add(folio);
                piezasCreadas++;
            }
        }
        // Refrescar cachés locales tras la importación masiva.
        const snapTec = await fs.getDocs(fs.collection(db, COL_TECNICOS));
        cacheTec = snapTec.docs.map(d => ({ id: d.id, ...d.data() }));
        const snapHerr = await fs.getDocs(fs.query(fs.collection(db, COL_HERRAMIENTAS), fs.orderBy("folio")));
        cacheHerr = snapHerr.docs.map(d => ({ id: d.id, ...d.data() }));

        const msg = `Importación completa: ${tecnicosCreados} técnico(s) nuevo(s), ${piezasCreadas} pieza(s) creada(s)${piezasOmitidas ? `, ${piezasOmitidas} omitida(s) por ya existir` : ""}.`;
        window.mostrarPush ? mostrarPush("Herramientas", msg, "📥") : alert(msg);
        opsRenderDashboard();
    };

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
    // ── Exportar inventario de herramienta por técnico (auditoría) — PDF y Excel ──
    // Glen: "un botón... para poder imprimir un PDF y un XML o Excel de qué herramienta
    // tiene cada técnico para poder hacer auditorías o revisiones a su herramienta".
    // Agrupa por técnico activo, listando cada pieza asignada con folio/descripción/
    // categoría/marca/modelo/serie/fecha de asignación.
    function opsInventarioPorTecnico() {
        const activos = cacheTec.filter(t => t.estatus === "activo").sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
        return activos.map(t => ({ tecnico: t, herramientas: cacheHerr.filter(h => h.tecnicoActualId === t.id) }));
    }

    window.opsExportarInventarioPDF = function () {
        if (!window.jspdf) { alert("Librería PDF no cargada."); return; }
        const { jsPDF } = window.jspdf;
        const docu = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const PW = 215.9, PH = 279.4, ML = 14, MR = 14;
        const AZUL = { r: 29, g: 46, b: 115 }, ROJO = { r: 231, g: 64, b: 43 };
        const grupos = opsInventarioPorTecnico();
        let y = 20;

        function encabezado(esPrimera) {
            // Fondo BLANCO: el logo trae texto azul marino/negro sobre transparencia —
            // sobre navy se vuelve ilegible. Proporción real del logo (420x125px, ~3.36:1)
            // para que no salga comprimido.
            docu.setFillColor(AZUL.r, AZUL.g, AZUL.b); docu.rect(0, 0, PW, 2.2, "F"); // acento, no bloque sólido
            try { if (window.LOGO_TECNOCONTROL_B64) docu.addImage("data:image/png;base64," + window.LOGO_TECNOCONTROL_B64, "PNG", ML, 6, 24, 7.14); } catch (e) {}
            docu.setTextColor(AZUL.r, AZUL.g, AZUL.b); docu.setFont("helvetica", "bold"); docu.setFontSize(9);
            docu.text(esPrimera ? "Inventario de herramienta por técnico · Auditoría" : "Inventario de herramienta por técnico (continuación)", ML + 28, 10.5);
            docu.setTextColor(120, 120, 120); docu.setFont("helvetica", "normal"); docu.setFontSize(7);
            docu.text("Generado: " + new Date().toLocaleString("es-MX"), PW - MR, 10.5, { align: "right" });
            docu.setDrawColor(226, 232, 240); docu.line(ML, 17, PW - MR, 17);
            return 25;
        }
        y = encabezado(true);

        grupos.forEach(g => {
            if (y > PH - 35) { docu.addPage(); y = encabezado(false); }
            docu.setFillColor(241, 245, 249); docu.rect(ML, y - 5, PW - ML - MR, 8, "F");
            docu.setFont("helvetica", "bold"); docu.setFontSize(10); docu.setTextColor(15, 23, 42);
            docu.text(`${g.tecnico.nombre}  ·  N.° ${g.tecnico.numeroOperativo || "—"}  ·  ${g.herramientas.length} herramienta(s)`, ML + 2, y);
            y += 9;
            if (!g.herramientas.length) {
                docu.setFont("helvetica", "italic"); docu.setFontSize(9); docu.setTextColor(148, 163, 184);
                docu.text("Sin herramienta asignada.", ML + 2, y); y += 7;
            } else {
                g.herramientas.forEach((h, idx) => {
                    if (y > PH - 20) { docu.addPage(); y = encabezado(false); }
                    if (idx % 2 === 1) { docu.setFillColor(248, 250, 252); docu.rect(ML, y - 4, PW - ML - MR, 6, "F"); }
                    docu.setFont("helvetica", "normal"); docu.setFontSize(8.5); docu.setTextColor(30, 41, 59);
                    const linea = `${h.folio || "—"}  ·  ${h.descripcion || "—"}${h.marca ? "  ·  " + h.marca + " " + (h.modelo || "") : ""}${h.numeroSerie ? "  ·  S/N " + h.numeroSerie : ""}`;
                    docu.text(linea, ML + 4, y);
                    docu.text(h.fechaAsignacion || "—", PW - MR - 2, y, { align: "right" });
                    y += 6;
                });
            }
            y += 4;
        });

        try { window.open(docu.output("bloburl"), "_blank"); }
        catch (e) { docu.save("Inventario_herramienta_por_tecnico.pdf"); }
    };

    window.opsExportarInventarioExcel = function () {
        if (typeof XLSX === "undefined") { alert("Falta cargar SheetJS (XLSX) en index.html."); return; }
        const grupos = opsInventarioPorTecnico();
        const filas = [];
        grupos.forEach(g => {
            if (!g.herramientas.length) {
                filas.push({ Técnico: g.tecnico.nombre, "N.° operativo": g.tecnico.numeroOperativo || "", Folio: "", Descripción: "(sin herramienta asignada)", Categoría: "", Marca: "", Modelo: "", "N.° de serie": "", "Fecha de asignación": "", Estado: "" });
            } else {
                g.herramientas.forEach(h => {
                    filas.push({
                        Técnico: g.tecnico.nombre, "N.° operativo": g.tecnico.numeroOperativo || "",
                        Folio: h.folio || "", Descripción: h.descripcion || "", Categoría: h.categoria || "",
                        Marca: h.marca || "", Modelo: h.modelo || "", "N.° de serie": h.numeroSerie || "",
                        "Fecha de asignación": h.fechaAsignacion || "", Estado: h.estado || "",
                    });
                });
            }
        });
        const ws = XLSX.utils.json_to_sheet(filas);
        ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 34 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario x técnico");
        XLSX.writeFile(wb, "Inventario_herramienta_por_tecnico_" + opsFechaHora().slice(0, 10) + ".xlsx");
    };

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
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${gestion ? `<button onclick="opsExportarInventarioPDF()" title="PDF de herramienta por técnico, para auditoría" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">🖨️ PDF auditoría</button>` : ""}
                        ${gestion ? `<button onclick="opsExportarInventarioExcel()" title="Excel de herramienta por técnico, para auditoría" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">📊 Excel auditoría</button>` : ""}
                        ${gestion ? `<button onclick="opsAbrirModalTecnico()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">${ICON.plus} Nuevo técnico</button>` : ""}
                    </div>
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
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;max-height:88vh;overflow-y:auto;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">✏️ Editar perfil</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Cada cambio queda registrado en la auditoría (usuario, fecha, valor anterior/nuevo).</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre</label>
                <input id="ops-edit-nombre" value="${opsEsc(t.nombre)}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">N.° de técnico</label>
                    <input id="ops-edit-numop" value="${opsEsc(t.numeroOperativo)}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">N.° de empleado (RH)</label>
                    <input id="ops-edit-empid" value="${opsEsc(t.employeeId || "")}" placeholder="EMP-0000" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Correo</label>
                <input id="ops-edit-correo" value="${opsEsc(t.correo || "")}" placeholder="nombre@tecnocontrol.com.mx" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
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
        const nuevoNombre = document.getElementById("ops-edit-nombre").value.trim();
        const nuevoNumOp = document.getElementById("ops-edit-numop").value.trim();
        const nuevoEmpId = document.getElementById("ops-edit-empid").value.trim();
        const nuevoCorreo = document.getElementById("ops-edit-correo").value.trim();
        const nuevoPuestoId = document.getElementById("ops-edit-puesto").value;
        const nuevoPuesto = cachePuestos.find(p => p.id === nuevoPuestoId);
        const nuevasObs = document.getElementById("ops-edit-obs").value.trim();
        const { db, fs } = await opsGetFB();
        const cambios = {};

        if (nuevoNombre && nuevoNombre !== t.nombre) { cambios.nombre = nuevoNombre; await opsAuditar("tecnico", idInterno, "nombre", t.nombre, nuevoNombre); }
        if (nuevoNumOp && nuevoNumOp !== t.numeroOperativo) {
            const dupActivo = cacheTec.find(x => x.id !== idInterno && x.numeroOperativo === nuevoNumOp && x.estatus === "activo");
            if (dupActivo) { alert(`El número ${nuevoNumOp} ya está activo (${dupActivo.nombre}).`); return; }
            cambios.numeroOperativo = nuevoNumOp;
            await opsAuditar("tecnico", idInterno, "numeroOperativo", t.numeroOperativo, nuevoNumOp);
        }
        if (nuevoEmpId !== (t.employeeId || "")) { cambios.employeeId = nuevoEmpId || null; await opsAuditar("tecnico", idInterno, "employeeId", t.employeeId, nuevoEmpId); }
        if (nuevoCorreo !== (t.correo || "")) { cambios.correo = nuevoCorreo || null; await opsAuditar("tecnico", idInterno, "correo", t.correo, nuevoCorreo); }
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
        const snapTec = await fs.getDocs(fs.collection(db, COL_TECNICOS));
        cacheTec = snapTec.docs.map(d => ({ id: d.id, ...d.data() }));
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


    window.opsAbrirFichaTecnico = async function (idInterno, tabInicial) {
        fichaTecTabActual = tabInicial || "resumen";
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        const activo = t.estatus === "activo";
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        const materiales = cacheAlmacenTec.filter(m => m.tecnicoId === idInterno && m.cantidad > 0);
        const guardiaActiva = cacheGuardias.find(g => g.tecnicoId === idInterno && g.estado === "activa");
        const iniciales = (t.nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();
        const vehActual = cacheVehiculosAsig.find(v => v.tecnicoId === idInterno && !v.fechaFin);

        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#f1f5f9;width:500px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#fff;border:1px solid #e2e8f0;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                ${guardiaActiva ? `<div style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:12px;padding:10px 14px;margin-bottom:8px;color:#fff;font-size:11.5px;font-weight:700;">🛡 En guardia — herramienta ${opsEsc(guardiaActiva.herramientaId)}</div>` : ""}

                <div style="background:#fff;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;margin-top:8px;">
                    <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#0B5FFF,#0842B0);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">${opsEsc(iniciales)}</div>
                    <div style="min-width:0;flex:1;">
                        <div style="font-size:15.5px;font-weight:700;color:#1e293b;">${opsEsc(t.nombre)}</div>
                        <div style="font-size:11.5px;color:#64748b;">${opsEsc(t.puesto || "—")} · Técnico N.° ${opsEsc(t.numeroOperativo)}${t.registroHistorico > 1 ? ` (registro ${t.registroHistorico})` : ""}${t.employeeId ? ` · ${opsEsc(t.employeeId)}` : ""}</div>
                        <span style="background:${activo ? "#dcfce7" : "#e5e7eb"};color:${activo ? "#166534" : "#374151"};font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;display:inline-block;margin-top:4px;">${activo ? "Activo" : "Baja"}</span>
                    </div>
                    ${opsPuedeGestionar() ? `
                    <div style="position:relative;">
                        <button onclick="opsToggleMenuTecnico(event)" title="Configuración" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#475569;display:flex;align-items:center;justify-content:center;">${ICON.gear}</button>
                        <div id="ops-menu-tecnico" style="display:none;position:absolute;right:0;top:38px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:190px;z-index:10;overflow:hidden;">
                            <button onclick="opsAbrirModalEditarTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border:none;padding:10px 14px;font-size:12.5px;color:#334155;cursor:pointer;">✏️ Editar perfil</button>
                            ${activo ? `<button onclick="document.getElementById('ops-menu-tecnico').style.display='none';opsIniciarBajaTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border-top:1px solid #f1f5f9;border-bottom:none;border-left:none;border-right:none;padding:10px 14px;font-size:12.5px;color:#b91c1c;cursor:pointer;">${ICON.trash} Dar de baja al técnico</button>` : ""}
                        </div>
                    </div>` : ""}
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">VEHÍCULO</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${vehActual ? opsEsc(vehActual.unidad) : "—"}</div></div>
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">MATERIAL</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${materiales.length}</div></div>
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">HERRAM.</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${asignadas.length}</div></div>
                </div>

                <div style="display:flex;gap:4px;margin:14px 0;overflow-x:auto;border-bottom:1px solid #e2e8f0;">
                    ${["resumen:Resumen", "rh:RH", "vehiculo:Vehículo", "herramientas:Herramientas", "auditoria:Auditoría", "historial:Historial"].map(x => {
                        const [id, label] = x.split(":");
                        const on = fichaTecTabActual === id;
                        return `<button onclick="opsFichaTecCambiarTab('${idInterno}','${id}')" style="background:none;border:none;padding:8px 10px;font-size:11.5px;font-weight:600;white-space:nowrap;color:${on ? "#0B5FFF" : "#64748b"};border-bottom:2px solid ${on ? "#0B5FFF" : "transparent"};cursor:pointer;">${label}</button>`;
                    }).join("")}
                </div>

                <div id="ops-ficha-tec-content"></div>
            </div>
        </div>`;
        opsRenderFichaTecContenido(idInterno);
    };

    window.opsFichaTecCambiarTab = function (idInterno, tab) {
        fichaTecTabActual = tab;
        opsAbrirFichaTecnico(idInterno, tab);
    };

    async function opsRenderFichaTecContenido(idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const el = document.getElementById("ops-ficha-tec-content");
        if (!el || !t) return;
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        const materiales = cacheAlmacenTec.filter(m => m.tecnicoId === idInterno && m.cantidad > 0);
        const historialMov = cacheMov.filter(m => m.tecnicoAnteriorId === idInterno || m.tecnicoNuevoId === idInterno).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
        const vehActual = cacheVehiculosAsig.find(v => v.tecnicoId === idInterno && !v.fechaFin);
        const vehHistorial = cacheVehiculosAsig.filter(v => v.tecnicoId === idInterno && v.fechaFin).sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));
        const activo = t.estatus === "activo";

        if (fichaTecTabActual === "resumen") {
            el.innerHTML = `
                ${activo && opsPuedeHacer("solicitar_material") ? `<div style="margin-bottom:12px;"><button onclick="opsAbrirModalSolicitud('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Solicitar material</button></div>` : ""}
                <div style="background:#fff;border-radius:14px;padding:16px 18px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Departamento:</strong> ${opsEsc(t.departamento || "—")}</div>
                    <div><strong>Fecha de ingreso:</strong> ${opsEsc(t.fechaIngreso || "—")}</div>
                    ${t.fechaBaja ? `<div><strong>Fecha de baja:</strong> ${opsEsc(t.fechaBaja)}</div>` : ""}
                </div>`;
        } else if (fichaTecTabActual === "rh") {
            const sincronizado = !!(t.employeeId && t.firebaseUid);
            el.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
                        <span style="font-size:11.5px;font-weight:700;color:${sincronizado ? "#166534" : "#b45309"};">${sincronizado ? "🟢 Sincronizado con RH" : "🟠 Pendiente de sincronización"}</span>
                    </div>
                    <div style="font-size:12.5px;color:#334155;line-height:1.9;">
                        <div><strong>Empleado:</strong> ${opsEsc(t.employeeId || "—")}</div>
                        <div><strong>Correo:</strong> ${opsEsc(t.correo || "—")}</div>
                        <div><strong>Fleet User ID:</strong> ${opsEsc(t.fleetUserId || "—")}</div>
                        <div><strong>Firebase UID:</strong> ${opsEsc(t.firebaseUid || "—")}</div>
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;margin-top:10px;">Estos identificadores permiten el match con RH/Flotilla por ID, no por nombre. Hoy no hay sincronización real conectada — se completan editando el perfil manualmente.</div>
                </div>`;
        } else if (fichaTecTabActual === "vehiculo") {
            el.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">Consultando Flotilla…</div>`;
            const vehFlotilla = await window.opsFlotillaProvider.obtenerVehiculoActual(idInterno);
            el.innerHTML = `
                <div style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);border-radius:14px;padding:16px 18px;margin-bottom:12px;color:#fff;">
                    <div style="font-size:10.5px;font-weight:700;opacity:0.85;">🚐 VEHÍCULO EN FLOTILLA (en vivo)</div>
                    ${vehFlotilla ? `<div style="font-size:14px;font-weight:700;margin-top:4px;">${opsEsc(vehFlotilla.unidad)} ${vehFlotilla.marca ? "— " + opsEsc(vehFlotilla.marca) + " " + opsEsc(vehFlotilla.modelo) : ""}</div><div style="font-size:11px;color:#dbeafe;margin-top:2px;">Estado: ${opsEsc(vehFlotilla.estado)}</div>`
                        : `<div style="font-size:11.5px;color:#dbeafe;margin-top:4px;">${t.correo ? "Sin vehículo vinculado en Flotilla para este correo." : "Captura el correo del técnico (⚙ Editar perfil) para hacer match con Flotilla."}</div>`}
                </div>
                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Asignación manual (Operaciones)</div>
                        ${opsPuedeGestionar() ? `<button onclick="opsAbrirModalVehiculo('${idInterno}')" style="background:#eef2f7;border:none;color:#0B5FFF;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">Asignar vehículo</button>` : ""}
                    </div>
                    <div style="font-size:10px;color:#94a3b8;margin-bottom:8px;">Este registro lo lleva Operaciones por separado del dato en vivo de Flotilla — útil si necesitas anotar algo que Flotilla todavía no refleja.</div>
                    ${vehActual ? `<div style="font-size:13px;font-weight:700;color:#1e293b;">${opsEsc(vehActual.unidad)}</div><div style="font-size:11px;color:#64748b;">Desde ${opsEsc(vehActual.fechaInicio)} · ${opsEsc(vehActual.motivo || "")}</div>`
                        : '<div style="color:#94a3b8;font-size:12px;">Sin registro manual.</div>'}
                </div>
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Historial (Operaciones)</div>
                    ${vehHistorial.length ? vehHistorial.map(v => `<div style="padding:7px 0;border-bottom:1px solid #eef1f5;font-size:12px;color:#334155;">${opsEsc(v.unidad)} · ${opsEsc(v.fechaInicio)} → ${opsEsc(v.fechaFin)}</div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin historial todavía.</div>'}
                </div>`;
            return;
        } else if (fichaTecTabActual === "herramientas") {
            el.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Herramientas asignadas (${asignadas.length})</div>
                        ${asignadas.length && opsPuedeGestionar() ? `<button onclick="opsAbrirModalRevision('${idInterno}')" style="background:#eef2f7;border:none;color:#0B5FFF;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">🔍 Registrar revisión</button>` : ""}
                    </div>
                    ${asignadas.length ? asignadas.map(h => `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #eef1f5;font-size:12px;"><span style="color:#059669;">${ICON.check}</span><strong>${opsEsc(h.folio)}</strong> — ${opsEsc(h.descripcion)}</div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Ninguna.</div>'}
                </div>
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Almacén del técnico — material (${materiales.length})</div>
                    ${materiales.length ? materiales.map(m => `<div style="padding:7px 0;border-bottom:1px solid #eef1f5;font-size:12px;">${opsEsc(m.productoDesc)} — <strong>${opsEsc(m.cantidad)}</strong></div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin material registrado.</div>'}
                </div>`;
        } else if (fichaTecTabActual === "auditoria") {
            el.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">Cargando historial de auditorías…</div>`;
            const { db, fs } = await opsGetFB();
            let revisiones = [];
            try {
                const snap = await fs.getDocs(fs.query(fs.collection(db, COL_REVISIONES), fs.where("tecnicoId", "==", idInterno), fs.orderBy("fecha", "desc")));
                revisiones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (err) { console.warn("[operaciones.js] no se pudo leer ops_revisiones_herramienta:", err.message); }
            if (fichaTecTabActual !== "auditoria") return; // el usuario cambió de pestaña mientras cargaba
            el.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Auditorías de herramienta (${revisiones.length})</div>
                    ${asignadas.length && opsPuedeGestionar() ? `<button onclick="opsAbrirModalRevision('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">🔍 Nueva revisión</button>` : ""}
                </div>
                ${revisiones.length ? revisiones.map(r => {
                    const faltantes = (r.herramientas || []).filter(h => h.estado !== "conforme");
                    return `<div style="background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;border-left:4px solid ${faltantes.length ? "#dc2626" : "#16a34a"};">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div style="font-size:12.5px;font-weight:700;color:#1e293b;">${opsEsc((r.fecha || "").slice(0, 10))}</div>
                            <span style="font-size:10.5px;font-weight:700;color:${faltantes.length ? "#b91c1c" : "#166534"};">${faltantes.length ? `⚠ ${faltantes.length} con novedad` : "✓ Todo conforme"}</span>
                        </div>
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Revisó: ${opsEsc(r.realizadoPor || "—")}</div>
                        ${(r.herramientas || []).map(h => `<div style="font-size:11.5px;color:#334155;padding:2px 0;">${h.estado === "conforme" ? "✓" : (h.estado === "faltante" ? "❌" : "⚠️")} ${opsEsc(h.folio)} — ${opsEsc(h.descripcion)}${h.observacion ? ` · <em>${opsEsc(h.observacion)}</em>` : ""}</div>`).join("")}
                        ${r.observacionesGenerales ? `<div style="font-size:11.5px;color:#64748b;margin-top:6px;border-top:1px solid #f1f5f9;padding-top:6px;">${opsEsc(r.observacionesGenerales)}</div>` : ""}
                    </div>`;
                }).join("") : '<div style="background:#fff;border-radius:14px;padding:16px 18px;color:#94a3b8;font-size:12px;">Sin revisiones registradas todavía.</div>'}`;
            return;
        } else if (fichaTecTabActual === "historial") {
            el.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;margin-bottom:8px;">${ICON.clock} Historial de movimientos</div>
                    <div style="border-left:2px solid #e2e8f0;padding-left:14px;">
                        ${historialMov.length ? historialMov.map(m => `
                        <div style="margin-bottom:12px;position:relative;">
                            <div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#1f2937;"></div>
                            <div style="font-size:12px;color:#334155;">${opsEsc((m.fecha||"").slice(0,10))} · ${opsEsc(m.tipo)} · ${opsEsc(m.herramientaId)}</div>
                        </div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin movimientos.</div>'}
                    </div>
                </div>`;
        }
    }

    // ── Auditoría física de herramienta: registra el estado de cada pieza asignada al
    // momento de la revisión (conforme / faltante / dañada), con quién y observaciones.
    // Queda en ops_revisiones_herramienta como bitácora permanente para auditorías.
    window.opsAbrirModalRevision = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        if (!t || !asignadas.length) return;
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:520px;max-width:94vw;max-height:88vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:2px;">Registrar revisión de herramienta</div>
                <div style="font-size:11.5px;color:#94a3b8;margin-bottom:14px;">${opsEsc(t.nombre)} · N.° ${opsEsc(t.numeroOperativo)} · ${asignadas.length} pieza(s) asignada(s)</div>
                <div id="ops-revision-lista">
                    ${asignadas.map(h => `
                    <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px;" data-herr-id="${h.id}" data-folio="${opsEsc(h.folio)}" data-desc="${opsEsc(h.descripcion)}">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:6px;">${opsEsc(h.folio)} — ${opsEsc(h.descripcion)}</div>
                        <div style="display:flex;gap:6px;margin-bottom:6px;">
                            <label style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px;border-radius:7px;background:#f0fdf4;color:#166534;cursor:pointer;"><input type="radio" name="rev-${h.id}" value="conforme" checked style="margin-right:4px;">Conforme</label>
                            <label style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px;border-radius:7px;background:#fef2f2;color:#b91c1c;cursor:pointer;"><input type="radio" name="rev-${h.id}" value="faltante" style="margin-right:4px;">Faltante</label>
                            <label style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px;border-radius:7px;background:#fff7ed;color:#c2410c;cursor:pointer;"><input type="radio" name="rev-${h.id}" value="danada" style="margin-right:4px;">Dañada</label>
                        </div>
                        <input type="text" placeholder="Observación (opcional)" id="ops-rev-obs-${h.id}" style="width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:6px 9px;font-size:11.5px;box-sizing:border-box;">
                    </div>`).join("")}
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Observaciones generales de la revisión</label>
                <textarea id="ops-rev-obs-generales" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 14px;resize:vertical;box-sizing:border-box;"></textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarRevision('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Guardar revisión</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarRevision = async function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const filas = Array.from(document.querySelectorAll("#ops-revision-lista > div"));
        const herramientas = filas.map(div => {
            const herrId = div.getAttribute("data-herr-id");
            const seleccionado = div.querySelector(`input[name="rev-${herrId}"]:checked`);
            const obsEl = document.getElementById(`ops-rev-obs-${herrId}`);
            return {
                herramientaId: herrId,
                folio: div.getAttribute("data-folio") || "",
                descripcion: div.getAttribute("data-desc") || "",
                estado: seleccionado ? seleccionado.value : "conforme",
                observacion: (obsEl && obsEl.value.trim()) || null,
            };
        });
        const observacionesGenerales = (document.getElementById("ops-rev-obs-generales") || {}).value || "";
        const { db, fs } = await opsGetFB();
        await fs.addDoc(fs.collection(db, COL_REVISIONES), {
            tecnicoId: idInterno,
            tecnicoNombre: t ? t.nombre : "—",
            tecnicoNumero: t ? t.numeroOperativo : "",
            fecha: opsFechaHora(),
            realizadoPor: opsNombreActual(),
            herramientas,
            observacionesGenerales: observacionesGenerales.trim() || null,
            createdAt: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
        });
        document.getElementById("ops-modal-wrap").innerHTML = "";
        window.mostrarPush ? mostrarPush("Auditoría", "Revisión de herramienta guardada.", "🔍") : alert("Revisión guardada.");
        opsFichaTecCambiarTab(idInterno, "auditoria");
    };

    // ── Vehículo: asignar (cierra automáticamente la asignación anterior) ──
    window.opsAbrirModalVehiculo = function (idInterno) {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Asignar vehículo</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Si el técnico ya tenía un vehículo, esa asignación se cierra automáticamente.</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Unidad / placas</label>
                <input id="ops-in-veh-unidad" placeholder="Ej. TC-017" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha de inicio</label>
                <input id="ops-in-veh-fecha" type="date" value="${opsHoy()}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Motivo / observaciones</label>
                <textarea id="ops-in-veh-motivo" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;"></textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsConfirmarVehiculo('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Asignar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsConfirmarVehiculo = async function (idInterno) {
        const unidad = document.getElementById("ops-in-veh-unidad").value.trim();
        if (!unidad) { alert("Indica la unidad/placas"); return; }
        const fechaInicio = document.getElementById("ops-in-veh-fecha").value || opsHoy();
        const motivo = document.getElementById("ops-in-veh-motivo").value.trim();
        const { db, fs } = await opsGetFB();
        const anterior = cacheVehiculosAsig.find(v => v.tecnicoId === idInterno && !v.fechaFin);
        if (anterior) await fs.updateDoc(fs.doc(db, COL_VEHICULOS_ASIG, anterior.id), { fechaFin: fechaInicio });
        await fs.addDoc(fs.collection(db, COL_VEHICULOS_ASIG), {
            tecnicoId: idInterno, unidad, fechaInicio, fechaFin: null, motivo: motivo || null,
            usuarioAsigno: opsUsuarioActual(),
        });
        const snapVeh = await fs.getDocs(fs.collection(db, COL_VEHICULOS_ASIG));
        cacheVehiculosAsig = snapVeh.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ops-modal-wrap").innerHTML = "";
        fichaTecTabActual = "vehiculo";
        opsAbrirFichaTecnico(idInterno, "vehiculo");
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
        const folioInfo = await opsSiguienteFolioMaterial();
        await fs.addDoc(fs.collection(db, COL_SURTIDOS), {
            tipo: "material", folio: folioInfo.folio, folioNum: folioInfo.folioNum, folioPrefijo: folioInfo.folioPrefijo,
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
        window.mostrarPush ? mostrarPush("Herramientas", `Solicitud ${folioInfo.folio} enviada a Almacén.`, "📦") : alert(`Solicitud ${folioInfo.folio} enviada a Almacén.`);
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
                ${tarjeta(NAV_ICONS.folios, "Folios de servicio", "Seguimiento de vencimiento, atención y solución (Connecteam)", "opsCambiarTab('folios')", true)}
                ${tarjeta(ICON.check, "Pólizas", "Próximamente — módulo aún no existe en el portal", "", false)}
                ${tarjeta(ICON.bell, "Servicios pendientes / completados", "Próximamente — requiere el módulo de Folios", "", false)}
                ${tarjeta(ICON.clock, "Historial y evidencias", "Próximamente — se conectará con Evidencias por asignación", "", false)}
            </div>`;
    }

    // ═══════════════════════ TAB: FOLIOS (seguimiento de vencimiento — reemplaza el Excel de Connecteam) ═══════════════════════
    // Jerarquía de fechas (regla del proceso real):
    //   1. FECHA DE SOLUCIÓN existe             → SOLUCIONADO, cierra el folio sin excepción.
    //   2. Inconsistencia entre fechas           → REVISAR DATOS (no se asume nada).
    //   3. FECHA DE ATENCIÓN existe (sin sol.)   → plazo activo = fecha de atención (compromiso INTERNO, no usa la tabla de clientes).
    //   4. Ninguna de las anteriores              → plazo activo = VENCIMIENTO original (automático: Cliente + Prioridad → tabla de horas).
    //
    // El vencimiento original YA NO se captura a mano cuando hay Cliente + Prioridad: se calcula
    // fecha/hora de solicitud + horas de SLA del cliente para esa prioridad. Esto es necesario porque
    // hay prioridades de 4-8 horas (Petro Siete P1/P2) — un cálculo a nivel de "día completo" sería
    // demasiado impreciso y escondería folios que ya vencieron hace varias horas.
    //
    // Rangos del semáforo — en HORAS restantes, no en días, precisamente por lo anterior:
    //   horas < 0 → rojo (VENCIDO) · horas 0-24 → naranja (URGENTE) ·
    //   horas 24-72 → amarillo (PRÓXIMO A VENCER) · horas > 72 → verde (EN PLAZO / EN ATENCIÓN)
    // Con esto, un folio P1 de Petro Siete (4h) se vuelve naranja casi de inmediato — correcto,
    // porque su ventana completa de respuesta ya está dentro del rango "urgente".
    const OPS_SEMAFORO = {
        verde:    { bg: "#dcfce7", fg: "#166534", dot: "#16a34a" },
        amarillo: { bg: "#fef9c3", fg: "#854d0e", dot: "#eab308" },
        naranja:  { bg: "#ffedd5", fg: "#9a3412", dot: "#ea580c" },
        rojo:     { bg: "#fee2e2", fg: "#991b1b", dot: "#dc2626" },
        gris:     { bg: "#e5e7eb", fg: "#374151", dot: "#9ca3af" },
    };
    const OPS_PRIORIDADES = ["P1", "P2", "P3", "P4", "P5", "P6"];

    // Convierte cualquiera de los dos formatos de fecha que usa este módulo a un objeto Date real:
    //  - "YYYY-MM-DD"        (fecha de atención / solución / folios importados o legacy) → medianoche local
    //  - "YYYY-MM-DDTHH:MM"  (fecha-hora de solicitud / vencimiento calculado)           → hora local exacta
    function opsAFechaObj(v) {
        if (!v) return null;
        const s = String(v);
        const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + "T00:00:00" : s);
        return isNaN(d.getTime()) ? null : d;
    }

    function opsHorasEntre(fechaLimite, ahora) {
        const fl = opsAFechaObj(fechaLimite);
        if (!fl) return null;
        return (fl.getTime() - ahora.getTime()) / (60 * 60 * 1000);
    }

    // Calcula el vencimiento original automático: fecha/hora de solicitud + horas de SLA
    // del cliente para esa prioridad. Si falta cliente, prioridad o solicitud, regresa null
    // (el vencimiento se queda como campo manual — folios legacy/importados sin clasificar).
    function opsCalcularVencimientoAutomatico(fechaHoraSolicitud, clienteId, prioridad) {
        if (!fechaHoraSolicitud || !clienteId || !prioridad) return null;
        const cliente = cacheClientes.find(c => c.id === clienteId);
        const horas = cliente?.horasSLA?.[prioridad];
        if (!cliente || !horas) return null;
        const base = opsAFechaObj(fechaHoraSolicitud);
        if (!base) return null;
        const venc = new Date(base.getTime() + horas * 60 * 60 * 1000);
        // Se guarda en formato "YYYY-MM-DDTHH:MM" (hora local, sin zona) — mismo criterio que el input datetime-local.
        const pad = n => String(n).padStart(2, "0");
        return `${venc.getFullYear()}-${pad(venc.getMonth() + 1)}-${pad(venc.getDate())}T${pad(venc.getHours())}:${pad(venc.getMinutes())}`;
    }

    function opsFormatoRestante(horas) {
        if (horas === null) return "—";
        const abs = Math.abs(horas);
        const vencido = horas < 0;
        if (abs < 48) {
            if (abs < 1) return (vencido ? "VENCIDO hace " : "") + Math.round(abs * 60) + " min" + (vencido ? "" : " restantes");
            const h = Math.floor(abs), m = Math.round((abs - h) * 60);
            const txt = `${h}h ${m}m`;
            return vencido ? `VENCIDO hace ${txt}` : `${txt} restantes`;
        }
        const dias = Math.round(abs / 24);
        return vencido ? `VENCIDO ${dias} día${dias === 1 ? "" : "s"}` : `${dias} día${dias === 1 ? "" : "s"}`;
    }

    function opsCalcularSemaforoFolio(f) {
        const ahora = new Date();
        const base = { fechaLimite: null, horas: null, diasTexto: "—", estado: "SIN FECHA", semaforo: "gris", motivo: null, enAtencion: false };

        // 1) Inconsistencias primero — nunca asumir certeza sobre datos contradictorios
        const fSol = opsAFechaObj(f.fechaSolicitud), fAt = opsAFechaObj(f.fechaAtencion),
              fSlc = opsAFechaObj(f.fechaSolucion), fVen = opsAFechaObj(f.vencimiento);
        const inc = [];
        if (fAt && fSol && fAt < fSol) inc.push("Atención anterior a la solicitud");
        if (fSlc && fSol && fSlc < fSol) inc.push("Solución anterior a la solicitud");
        if (fSlc && fAt && fSlc < fAt) inc.push("Solución anterior a la atención");
        if (fVen && fSol && fVen < fSol) inc.push("Vencimiento anterior a la solicitud");
        if (inc.length) return { ...base, estado: "REVISAR DATOS", semaforo: "gris", motivo: inc.join("; ") };

        // 2) Solución existe → cierra el folio definitivamente, sin importar lo demás
        if (f.fechaSolucion) return { ...base, fechaLimite: f.fechaSolucion, diasTexto: "Solucionado", estado: "SOLUCIONADO", semaforo: "verde" };

        // 3) Plazo activo: atención (compromiso interno) tiene prioridad sobre vencimiento (SLA cliente)
        const fechaLimite = f.fechaAtencion || f.vencimiento;
        const enAtencion = !!f.fechaAtencion;
        if (!fechaLimite) return base;

        const horas = opsHorasEntre(fechaLimite, ahora);
        const diasTexto = opsFormatoRestante(horas);

        let estado, semaforo;
        if (horas < 0) { estado = "VENCIDO"; semaforo = "rojo"; }
        else if (horas <= 24) { estado = "URGENTE"; semaforo = "naranja"; }
        else if (horas <= 72) { estado = "PRÓXIMO A VENCER"; semaforo = "amarillo"; }
        else { estado = enAtencion ? "EN ATENCIÓN" : "EN PLAZO"; semaforo = "verde"; }

        return { fechaLimite, horas, diasTexto, estado, semaforo, motivo: null, enAtencion };
    }
    window.opsCalcularSemaforoFolio = opsCalcularSemaforoFolio;

    function opsBadgeSemaforoFolio(info) {
        const c = OPS_SEMAFORO[info.semaforo] || OPS_SEMAFORO.gris;
        return `<span style="display:inline-flex;align-items:center;gap:6px;background:${c.bg};color:${c.fg};font-size:10.5px;font-weight:600;padding:3px 9px;border-radius:999px;white-space:nowrap;">
            <span style="width:7px;height:7px;border-radius:50%;background:${c.dot};flex-shrink:0;"></span>${opsEsc(info.estado)}
        </span>`;
    }

    function opsFmtFechaCorta(v) {
        const d = opsAFechaObj(v);
        if (!d) return "—";
        const esConHora = /T\d{2}:\d{2}/.test(String(v));
        return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) + (esConHora ? ` ${d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "");
    }

    function opsResponsableFolio(f) {
        if (f.tecnicoResponsableId) {
            const t = cacheTec.find(x => x.id === f.tecnicoResponsableId);
            if (t) return `${t.nombre}${t.correo ? " · " + t.correo : ""}`;
        }
        return f.responsable || "—";
    }

    // ── Alarma sonora (Web Audio, ~10 segundos, imposible de ignorar) ──────
    // Solo suena mientras el portal está abierto en esta pestaña — misma limitación
    // honesta que el resto de las alarmas del portal (Flotilla/siniestros).
    function opsReproducirAlarmaFolio() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            let tiempo = ctx.currentTime;
            const fin = tiempo + 10;
            function pulso(t) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = "square";
                osc.frequency.setValueAtTime(880, t);
                gain.gain.setValueAtTime(0.15, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
                osc.connect(gain).connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.3);
            }
            while (tiempo < fin) { pulso(tiempo); tiempo += 0.45; }
            setTimeout(() => { try { ctx.close(); } catch (e) {} }, 10500);
        } catch (e) { console.warn("[Folios] No se pudo reproducir la alarma:", e.message); }
    }

    // ── Ventana flotante imposible de ignorar (apilable, varias a la vez) ──
    function opsMostrarFlotanteFolio(f, info) {
        let cont = document.getElementById("ops-alertas-flotantes");
        if (!cont) {
            cont = document.createElement("div");
            cont.id = "ops-alertas-flotantes";
            cont.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483000;display:flex;flex-direction:column;gap:10px;max-width:340px;";
            document.body.appendChild(cont);
        }
        const c = OPS_SEMAFORO[info.semaforo] || OPS_SEMAFORO.rojo;
        const idFlot = "ops-flot-" + f.id + "-" + Date.now();
        const div = document.createElement("div");
        div.id = idFlot;
        div.style.cssText = `background:#fff;border-left:5px solid ${c.dot};border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.25);padding:14px 16px;animation:opsFlotIn .25s ease;`;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="font-size:11px;font-weight:700;color:${c.fg};text-transform:uppercase;letter-spacing:.4px;">${opsEsc(info.estado)}${info.enAtencion ? " · Seguimiento" : ""}</div>
                <button onclick="document.getElementById('${idFlot}').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;line-height:1;">✕</button>
            </div>
            <div style="font-size:13.5px;font-weight:700;color:#1e293b;margin-top:4px;">${opsEsc(f.estacion)}</div>
            <div style="font-size:11.5px;color:#64748b;margin-top:2px;">${f.folioOS ? "O.S. " + opsEsc(f.folioOS) + " · " : ""}${opsEsc(info.diasTexto)}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Responsable: ${opsEsc(opsResponsableFolio(f))}</div>
            <button onclick="window.opsCambiarTab('folios');document.getElementById('${idFlot}').remove();" style="margin-top:10px;background:${c.dot};border:none;color:#fff;padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Ver folio</button>
        `;
        cont.appendChild(div);
        setTimeout(() => { const el = document.getElementById(idFlot); if (el) el.remove(); }, 30000);
    }

    // ── Ventana flotante genérica (notificaciones de ops_notificaciones: "solicitud
    // lista para surtir", etc.) — mismo estilo/comportamiento que la de folios pero
    // sin datos de folio específicos, para cualquier mensaje de texto simple. ──
    function opsMostrarFlotanteGenerica(mensaje, colorHex) {
        let cont = document.getElementById("ops-alertas-flotantes");
        if (!cont) {
            cont = document.createElement("div");
            cont.id = "ops-alertas-flotantes";
            cont.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483000;display:flex;flex-direction:column;gap:10px;max-width:340px;";
            document.body.appendChild(cont);
        }
        const idFlot = "ops-flot-gen-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
        const div = document.createElement("div");
        div.id = idFlot;
        div.style.cssText = `background:#fff;border-left:5px solid ${colorHex};border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.25);padding:14px 16px;animation:opsFlotIn .25s ease;`;
        div.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="font-size:11px;font-weight:700;color:${colorHex};text-transform:uppercase;letter-spacing:.4px;">🔔 Operaciones</div>
                <button onclick="document.getElementById('${idFlot}').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:14px;line-height:1;">✕</button>
            </div>
            <div style="font-size:13px;color:#1e293b;margin-top:4px;">${opsEsc(mensaje)}</div>
        `;
        cont.appendChild(div);
        setTimeout(() => { const el = document.getElementById(idFlot); if (el) el.remove(); }, 30000);
    }


    // Escritura exacta al esquema ya usado por Flotilla: {tipo, para, mensaje, codigo, creadaEn}.
    // OJO: el campo de fecha se llama "creadaEn" (no "creadoEn") — la app móvil filtra por ese nombre exacto.
    async function opsNotificarFlotillaFolio(f, info) {
        const paraEmail = info.enAtencion ? MIGUEL_EMAIL : (f.tecnicoResponsableCorreo || null);
        if (!paraEmail) return; // sin correo confiable no se inventa destinatario
        try {
            const { db, fs } = await opsGetFB();
            await fs.addDoc(fs.collection(db, "flotilla_notificaciones"), {
                tipo: "ops_folio_alerta",
                codigo: f.folioOS || f.estacion,
                para: paraEmail.toLowerCase(),
                mensaje: `⚠ Folio ${f.folioOS ? "O.S. " + f.folioOS + " — " : ""}${f.estacion}: ${info.estado}${info.enAtencion ? " (fecha de atención / compromiso)" : ""}. ${info.diasTexto}.`,
                creadaEn: new Date().toISOString(),
            });
        } catch (e) { console.warn("[Folios] No se pudo notificar a Flotilla:", e.message); }
    }

    // ── Vigilancia en tiempo real: dispara alarma solo al CRUZAR hacia naranja/rojo ──
    // (nunca al cargar folios ya vencidos de antes — eso sería una avalancha de alarmas).
    const OPS_SEVERIDAD = { gris: 0, verde: 0, amarillo: 1, naranja: 2, rojo: 3 };
    let opsFoliosAlertaState = new Map(); // folioId -> última severidad ya vista
    let opsFoliosVigilanciaBase = false;
    let opsFoliosVigilanciaTimer = null;

    function opsVigilarFoliosSeveridad() {
        for (const f of cacheFolios) {
            const info = opsCalcularSemaforoFolio(f);
            const sev = OPS_SEVERIDAD[info.semaforo] ?? 0;
            const previa = opsFoliosAlertaState.get(f.id);
            if (opsFoliosVigilanciaBase && previa !== undefined && sev > previa && sev >= 2) {
                opsReproducirAlarmaFolio();
                opsMostrarFlotanteFolio(f, info);
                opsNotificarFlotillaFolio(f, info);
            }
            opsFoliosAlertaState.set(f.id, sev);
        }
        opsFoliosVigilanciaBase = true; // a partir de la primera pasada, sí se alerta en escaladas reales
    }
    function opsIniciarVigilanciaFolios() {
        opsVigilarFoliosSeveridad(); // primera pasada: solo establece la base, no alerta
        if (opsFoliosVigilanciaTimer) clearInterval(opsFoliosVigilanciaTimer);
        opsFoliosVigilanciaTimer = setInterval(opsVigilarFoliosSeveridad, 60000); // recheck cada minuto (el reloj avanza aunque no cambien datos)
    }
    function opsDetenerVigilanciaFolios() {
        if (opsFoliosVigilanciaTimer) { clearInterval(opsFoliosVigilanciaTimer); opsFoliosVigilanciaTimer = null; }
        opsFoliosVigilanciaBase = false;
        opsFoliosAlertaState.clear();
    }

    function opsRenderFolios() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        const gestion = opsPuedeHacer("gestionar_herramientas");

        const calc = cacheFolios.map(f => ({ f, info: opsCalcularSemaforoFolio(f) }));
        const kpis = [
            { label: "Total de folios", valor: calc.length, color: "#1f2937" },
            { label: "Solucionados", valor: calc.filter(x => x.info.estado === "SOLUCIONADO").length, color: OPS_SEMAFORO.verde.dot },
            { label: "Próximos a vencer", valor: calc.filter(x => x.info.semaforo === "amarillo").length, color: OPS_SEMAFORO.amarillo.dot },
            { label: "Urgentes", valor: calc.filter(x => x.info.semaforo === "naranja").length, color: OPS_SEMAFORO.naranja.dot },
            { label: "Vencidos", valor: calc.filter(x => x.info.semaforo === "rojo").length, color: OPS_SEMAFORO.rojo.dot },
            { label: "Por revisar", valor: calc.filter(x => x.info.estado === "REVISAR DATOS" || x.info.estado === "SIN FECHA").length, color: OPS_SEMAFORO.gris.dot },
        ];

        const filtroTexto = filtroFolios.trim().toLowerCase();
        let filtrados = calc.filter(({ f, info }) => {
            if (filtroFolioSemaforo !== "todos" && info.semaforo !== filtroFolioSemaforo) return false;
            if (!filtroTexto) return true;
            return `${f.estacion || ""} ${f.comentarios || ""} ${opsResponsableFolio(f)} ${f.folioOS || ""}`.toLowerCase().includes(filtroTexto);
        });
        const orden = { rojo: 0, naranja: 1, amarillo: 2, gris: 3, verde: 4 };
        filtrados.sort((a, b) => orden[a.info.semaforo] - orden[b.info.semaforo]);

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:18px;">
                ${kpis.map(k => `
                    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;border-top:3px solid ${k.color};padding:12px 14px;">
                        <div style="font-size:19px;font-weight:700;color:#1e293b;line-height:1;">${k.valor}</div>
                        <div style="font-size:10px;color:#64748b;margin-top:4px;">${k.label}</div>
                    </div>`).join("")}
            </div>
            <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 18px;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span style="color:#94a3b8;">${ICON.search}</span>
                        <input type="text" placeholder="Buscar estación, O.S., comentario o responsable..." value="${opsEsc(filtroFolios)}" oninput="opsFiltrarFolios(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;font-size:12.5px;width:280px;outline:none;">
                        <select onchange="opsFiltrarFolioSemaforo(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:12px;outline:none;">
                            <option value="todos" ${filtroFolioSemaforo === "todos" ? "selected" : ""}>Todos</option>
                            <option value="rojo" ${filtroFolioSemaforo === "rojo" ? "selected" : ""}>Vencidos</option>
                            <option value="naranja" ${filtroFolioSemaforo === "naranja" ? "selected" : ""}>Urgentes</option>
                            <option value="amarillo" ${filtroFolioSemaforo === "amarillo" ? "selected" : ""}>Próximos a vencer</option>
                            <option value="verde" ${filtroFolioSemaforo === "verde" ? "selected" : ""}>En plazo / Solucionados</option>
                            <option value="gris" ${filtroFolioSemaforo === "gris" ? "selected" : ""}>Por revisar / sin fecha</option>
                        </select>
                    </div>
                    ${gestion ? `
                    <div style="display:flex;gap:8px;">
                        <button onclick="opsAbrirModalFolio()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">${ICON.plus} Nuevo folio</button>
                        <button onclick="document.getElementById('ops-folios-import-input').click()" class="mkt-add-btn" style="background:linear-gradient(135deg,#059669,#047857);">📥 Importar Excel</button>
                        <input type="file" id="ops-folios-import-input" accept=".xlsx,.xls" style="display:none" onchange="opsImportarExcelFolios(this.files[0])">
                    </div>` : ""}
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12.3px;">
                        <thead><tr style="background:#1f2937;color:#fff;text-align:left;">
                            <th style="padding:8px 10px;border-radius:8px 0 0 8px;">O.S.</th>
                            <th style="padding:8px 10px;">Estación</th>
                            <th style="padding:8px 10px;">Cliente / Prioridad</th>
                            <th style="padding:8px 10px;">Solicitud</th>
                            <th style="padding:8px 10px;">Vencimiento (SLA)</th>
                            <th style="padding:8px 10px;">Atención</th>
                            <th style="padding:8px 10px;">Solución</th>
                            <th style="padding:8px 10px;">Responsable</th>
                            <th style="padding:8px 10px;">Plazo activo</th>
                            <th style="padding:8px 10px;">Estado</th>
                            <th style="padding:8px 10px;border-radius:0 8px 8px 0;"></th>
                        </tr></thead>
                        <tbody>${filtrados.length ? filtrados.map(({ f, info }, i) => opsFilaFolio(f, info, i, gestion)).join("") : `<tr><td colspan="11" style="padding:22px;text-align:center;color:#94a3b8;">Sin folios registrados. ${gestion ? 'Usa "Nuevo folio" o "Importar Excel".' : ""}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;
    }
    window.opsRenderFolios = opsRenderFolios;

    function opsFilaFolio(f, info, i, gestion) {
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        const filaVencida = info.semaforo === "rojo" ? "background:#fef2f2;" : `background:${zebra};`;
        const cp = [f.clienteNombre, f.prioridad].filter(Boolean).join(" · ") || "—";
        return `<tr style="${filaVencida}border-bottom:1px solid #eef1f5;cursor:pointer;" title="${info.motivo ? opsEsc(info.motivo) : ""}" onclick="opsAbrirFichaFolio('${f.id}')">
            <td style="padding:8px 10px;color:#334155;font-weight:600;">${f.folioOS ? opsEsc(f.folioOS) : (f.folioClienteId ? `<span style="color:#94a3b8;font-weight:500;">Cliente: </span>${opsEsc(f.folioClienteId)}` : "—")}</td>
            <td style="padding:8px 10px;font-weight:600;color:#334155;">${opsEsc(f.estacion)}</td>
            <td style="padding:8px 10px;color:#64748b;">${opsEsc(cp)}</td>
            <td style="padding:8px 10px;color:#64748b;">${opsFmtFechaCorta(f.fechaSolicitud)}</td>
            <td style="padding:8px 10px;color:#64748b;">${opsFmtFechaCorta(f.vencimiento)}</td>
            <td style="padding:8px 10px;color:#64748b;">${f.fechaAtencion ? opsFmtFechaCorta(f.fechaAtencion) : "—"}</td>
            <td style="padding:8px 10px;color:#64748b;">${f.fechaSolucion ? opsFmtFechaCorta(f.fechaSolucion) : "—"}</td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(opsResponsableFolio(f))}</td>
            <td style="padding:8px 10px;color:#334155;">
                ${info.enAtencion ? `<div style="font-size:9.5px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.3px;">Plazo de atención</div>` : ""}
                ${opsEsc(info.diasTexto)}
            </td>
            <td style="padding:8px 10px;">${opsBadgeSemaforoFolio(info)}</td>
            <td style="padding:8px 10px;text-align:right;" onclick="event.stopPropagation()">${gestion ? `<button onclick="opsAbrirModalFolio('${f.id}')" style="background:#eef2f7;border:none;color:#1f2937;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">Editar</button>` : ""}</td>
        </tr>`;
    }

    window.opsFiltrarFolios = function (v) { filtroFolios = v || ""; opsRenderFolios(); };
    window.opsFiltrarFolioSemaforo = function (v) { filtroFolioSemaforo = v || "todos"; opsRenderFolios(); };

    // Recalcula y refresca en vivo el preview de "Vencimiento (automático)" dentro del modal,
    // cada vez que cambia Cliente, Prioridad o Fecha/hora de solicitud.
    window.opsFolioActualizarVencimientoPreview = function () {
        const clienteId = document.getElementById("ops-fol-cliente").value || null;
        const prioridad = document.getElementById("ops-fol-prioridad").value || null;
        const fechaSolicitud = document.getElementById("ops-fol-solicitud").value || null;
        const preview = document.getElementById("ops-fol-vencimiento-preview");
        const manualWrap = document.getElementById("ops-fol-vencimiento-manual-wrap");
        const auto = opsCalcularVencimientoAutomatico(fechaSolicitud, clienteId, prioridad);
        if (auto) {
            preview.style.display = "block";
            manualWrap.style.display = "none";
            preview.dataset.valor = auto;
            const cliente = cacheClientes.find(c => c.id === clienteId);
            preview.innerHTML = `<strong>${opsFmtFechaCorta(auto)}</strong><div style="font-size:10.5px;color:#64748b;margin-top:2px;">Calculado: ${opsEsc(cliente?.nombre || "")} · ${opsEsc(prioridad)} · ${cliente.horasSLA[prioridad]}h desde la solicitud</div>`;
        } else {
            preview.style.display = "none";
            manualWrap.style.display = "block";
        }
    };

    window.opsDetectarClienteFolio = function () {
        const estacion = document.getElementById("ops-fol-estacion").value;
        const id = opsDetectarClientePorNombre(estacion);
        if (id) { document.getElementById("ops-fol-cliente").value = id; window.opsFolioActualizarVencimientoPreview(); }
        else if (window.mostrarPush) mostrarPush("Operaciones", "No se detectó un cliente por el nombre de la estación.", "🔍");
        else alert("No se detectó un cliente por el nombre de la estación.");
    };

    // ── Alta / edición manual de folio ──────────────────────────────
    window.opsAbrirModalFolio = function (id) {
        const f = id ? cacheFolios.find(x => x.id === id) : null;
        const wrap = document.getElementById("ops-modal-wrap");
        const solicitudDefault = f?.fechaSolicitud || (() => {
            const n = new Date(); const pad = x => String(x).padStart(2, "0");
            return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
        })();
        const vencAuto = f ? opsCalcularVencimientoAutomatico(f.fechaSolicitud, f.clienteId, f.prioridad) : null;
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:480px;max-width:92vw;max-height:90vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">${f ? "Editar folio" : "Nuevo folio"}</div>

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">O.S. (Orden de Servicio)</label>
                    <input id="ops-fol-os" value="${opsEsc(f?.folioOS || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:2;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Estación</label>
                    <input id="ops-fol-estacion" value="${opsEsc(f?.estacion || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Comentarios</label>
                <textarea id="ops-fol-comentarios" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;min-height:50px;">${opsEsc(f?.comentarios || "")}</textarea>

                <div style="display:flex;gap:8px;align-items:flex-end;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Cliente</label>
                    <select id="ops-fol-cliente" onchange="window.opsFolioActualizarVencimientoPreview()" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        <option value="">— Sin clasificar —</option>
                        ${cacheClientes.map(c => `<option value="${c.id}" ${f?.clienteId === c.id ? "selected" : ""}>${opsEsc(c.nombre)}</option>`).join("")}
                    </select></div>
                    <button type="button" onclick="window.opsDetectarClienteFolio()" style="background:#eef2f7;border:none;color:#1f2937;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;margin-bottom:10px;">Detectar</button>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Prioridad</label>
                <select id="ops-fol-prioridad" onchange="window.opsFolioActualizarVencimientoPreview()" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <option value="">— Sin prioridad —</option>
                    ${OPS_PRIORIDADES.map(p => `<option value="${p}" ${f?.prioridad === p ? "selected" : ""}>${p}</option>`).join("")}
                </select>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha y hora de solicitud</label>
                <input type="datetime-local" id="ops-fol-solicitud" value="${solicitudDefault}" oninput="window.opsFolioActualizarVencimientoPreview()" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Vencimiento original (SLA)</label>
                <div id="ops-fol-vencimiento-preview" style="display:none;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;color:#3730a3;"></div>
                <div id="ops-fol-vencimiento-manual-wrap" style="display:none;">
                    <input type="datetime-local" id="ops-fol-vencimiento" value="${f?.vencimiento && !vencAuto ? f.vencimiento : ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <div style="font-size:10px;color:#94a3b8;margin:-6px 0 10px;">Sin Cliente + Prioridad no se puede calcular automático — captúralo manual (folios legacy/importados).</div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha de atención (compromiso interno de seguimiento)</label>
                <input type="date" id="ops-fol-atencion" value="${f?.fechaAtencion || ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;">
                <div style="font-size:10px;color:#94a3b8;margin:0 0 10px;">Solo si el folio se cerró en tiempo pero quedó un pendiente. No usa la tabla de SLA del cliente.</div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha de solución (folio 100% cerrado)</label>
                <input type="date" id="ops-fol-solucion" value="${f?.fechaSolucion || ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Responsable (ligado a Técnicos)</label>
                <select id="ops-fol-tecnico" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <option value="">— Sin ligar / texto libre —</option>
                    ${cacheTec.map(t => `<option value="${t.id}" ${f?.tecnicoResponsableId === t.id ? "selected" : ""}>${opsEsc(t.nombre)}${t.correo ? " (" + opsEsc(t.correo) + ")" : ""}</option>`).join("")}
                </select>
                <input id="ops-fol-responsable-texto" placeholder="Nombre libre (solo si no está en Técnicos)" value="${opsEsc(!f?.tecnicoResponsableId ? (f?.responsable || "") : "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">

                <div style="display:flex;justify-content:space-between;gap:8px;">
                    ${f ? `<button onclick="opsEliminarFolio('${f.id}')" style="background:#fef2f2;border:none;color:#b91c1c;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Eliminar</button>` : "<span></span>"}
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                        <button onclick="opsGuardarFolio('${id || ""}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Guardar</button>
                    </div>
                </div>
            </div>
        </div>`;
        window.opsFolioActualizarVencimientoPreview();
    };

    window.opsGuardarFolio = async function (id) {
        const estacion = document.getElementById("ops-fol-estacion").value.trim();
        if (!estacion) { alert("La estación es obligatoria"); return; }
        const { db, fs } = await opsGetFB();

        const clienteId = document.getElementById("ops-fol-cliente").value || null;
        const prioridad = document.getElementById("ops-fol-prioridad").value || null;
        const fechaSolicitud = document.getElementById("ops-fol-solicitud").value || null;
        const vencAuto = opsCalcularVencimientoAutomatico(fechaSolicitud, clienteId, prioridad);
        const vencimiento = vencAuto || document.getElementById("ops-fol-vencimiento").value || null;
        const clienteNombre = clienteId ? (cacheClientes.find(c => c.id === clienteId)?.nombre || null) : null;

        const tecnicoResponsableId = document.getElementById("ops-fol-tecnico").value || null;
        const tec = tecnicoResponsableId ? cacheTec.find(t => t.id === tecnicoResponsableId) : null;

        const datos = {
            folioOS: document.getElementById("ops-fol-os").value.trim(),
            estacion,
            comentarios: document.getElementById("ops-fol-comentarios").value.trim(),
            clienteId, clienteNombre, prioridad,
            fechaSolicitud, vencimiento,
            fechaAtencion: document.getElementById("ops-fol-atencion").value || null,
            fechaSolucion: document.getElementById("ops-fol-solucion").value || null,
            tecnicoResponsableId,
            tecnicoResponsableNombre: tec?.nombre || null,
            tecnicoResponsableCorreo: tec?.correo || null,
            responsable: tec?.nombre || document.getElementById("ops-fol-responsable-texto").value.trim() || null,
        };
        if (id) {
            await fs.updateDoc(fs.doc(db, COL_FOLIOS, id), datos);
        } else {
            const nuevo = await fs.addDoc(fs.collection(db, COL_FOLIOS), { ...datos, origen: "manual", creadoPor: opsUsuarioActual(), creadoEn: opsFechaHora() });
            // Primer comentario automático: deja registrado quién capturó el folio y con qué datos,
            // como punto de partida del seguimiento (Glen: "creo que hace falta el primer comentario
            // desde la captura del folio").
            const notaCaptura = [
                `Folio capturado por ${opsNombreActual()}.`,
                `Estación: ${datos.estacion}.`,
                datos.clienteNombre ? `Cliente: ${datos.clienteNombre}${datos.prioridad ? " (" + datos.prioridad + ")" : ""}.` : null,
                datos.vencimiento ? `Vencimiento (SLA): ${opsFmtFechaCorta(datos.vencimiento)}.` : null,
                datos.fechaAtencion ? `Fecha de atención asignada: ${opsFmtFechaCorta(datos.fechaAtencion)}.` : null,
                datos.comentarios ? `Comentario inicial: ${datos.comentarios}` : null,
            ].filter(Boolean).join(" ");
            await fs.addDoc(fs.collection(db, COL_FOLIOS, nuevo.id, "comentarios"), {
                texto: notaCaptura, autor: opsNombreActual(), autorEmail: opsUsuarioActual(),
                tipo: "captura", createdAt: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
            });
        }
        document.getElementById("ops-modal-wrap").innerHTML = "";
        if (window.mostrarPush) mostrarPush("Operaciones", "Folio guardado.", "📋"); else alert("Folio guardado.");
    };

    window.opsEliminarFolio = async function (id) {
        if (!confirm("¿Eliminar este folio? Esta acción no se puede deshacer.")) return;
        const { db, fs } = await opsGetFB();
        await fs.deleteDoc(fs.doc(db, COL_FOLIOS, id));
        document.getElementById("ops-modal-wrap").innerHTML = "";
        if (window.mostrarPush) mostrarPush("Operaciones", "Folio eliminado.", "🗑️"); else alert("Folio eliminado.");
    };

    // ── Ficha de folio: línea de tiempo de comentarios/feedback (administradores, seguimiento
    // post-compromiso) — Glen: "que se despliegue información, comentarios de feedback por
    // parte de administradores después de la fecha compromiso... con fecha/hora, quién hizo
    // el comentario, etc." El primer comentario (captura) se guarda automático al crear el folio. ──
    window.opsAbrirFichaFolio = async function (id) {
        const f = cacheFolios.find(x => x.id === id);
        if (!f) return;
        const info = opsCalcularSemaforoFolio(f);
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:460px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div><div style="font-size:11px;color:#94a3b8;font-weight:600;">${opsEsc(f.folioOS || "Sin N.º de O.S.")}</div><div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(f.estacion)}</div></div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                <div style="margin-bottom:8px;">${opsBadgeSemaforoFolio(info)} ${info.enAtencion ? `<span style="font-size:9.5px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.3px;margin-left:6px;">Plazo de atención</span>` : ""}</div>
                <div style="font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Cliente:</strong> ${opsEsc(f.clienteNombre || "—")} ${f.prioridad ? `(${opsEsc(f.prioridad)})` : ""}</div>
                    <div><strong>Fecha de solicitud:</strong> ${opsFmtFechaCorta(f.fechaSolicitud)}</div>
                    <div><strong>Vencimiento (SLA cliente):</strong> ${opsFmtFechaCorta(f.vencimiento)}</div>
                    <div><strong>Fecha de atención (compromiso Miguel):</strong> ${f.fechaAtencion ? opsFmtFechaCorta(f.fechaAtencion) : "—"}</div>
                    <div><strong>Fecha de solución:</strong> ${f.fechaSolucion ? opsFmtFechaCorta(f.fechaSolucion) : "— (sigue abierto: " + opsEsc(info.diasTexto) + ")"}</div>
                    <div><strong>Responsable:</strong> ${opsEsc(opsResponsableFolio(f))}</div>
                </div>
                <div style="margin-top:18px;font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;">${ICON.clock} Comentarios y seguimiento</div>
                <div id="ops-folio-comentarios" style="margin-top:10px;">
                    <div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">Cargando…</div>
                </div>
                ${opsPuedeGestionar() ? `
                <div style="margin-top:12px;">
                    <textarea id="ops-nuevo-comentario-folio" rows="2" placeholder="Agregar comentario / feedback..." style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
                    <button onclick="opsAgregarComentarioFolio('${f.id}')" style="margin-top:6px;background:linear-gradient(135deg,#2E7CF6,#0B5FFF);color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Agregar comentario</button>
                </div>` : ""}
            </div>
        </div>`;
        opsRenderComentariosFolio(f.id, f.fechaAtencion);
    };

    async function opsRenderComentariosFolio(folioId, fechaAtencion) {
        const el = document.getElementById("ops-folio-comentarios");
        if (!el) return;
        const { db, fs } = await opsGetFB();
        let comentarios = [];
        try {
            const snap = await fs.getDocs(fs.query(fs.collection(db, COL_FOLIOS, folioId, "comentarios"), fs.orderBy("createdAt", "asc")));
            comentarios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) { console.warn("[operaciones.js] no se pudo leer comentarios del folio:", err.message); }
        if (!document.getElementById("ops-folio-comentarios")) return; // el panel ya se cerró mientras cargaba
        const atencionMs = fechaAtencion ? new Date(fechaAtencion).getTime() : null;
        el.innerHTML = comentarios.length ? comentarios.map(c => {
            const ts = c.createdAt && typeof c.createdAt.toDate === "function" ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
            const esPosteriorCompromiso = atencionMs && ts && ts.getTime() > atencionMs && c.tipo !== "captura";
            return `<div style="border-left:3px solid ${c.tipo === "captura" ? "#94a3b8" : (esPosteriorCompromiso ? "#dc2626" : "#0B5FFF")};padding:8px 12px;margin-bottom:8px;background:#f8fafc;border-radius:0 8px 8px 0;">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
                    <span style="font-size:11.5px;font-weight:700;color:#1e293b;">${opsEsc(c.autor || "—")}</span>
                    <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">${ts ? ts.toLocaleString("es-MX") : "—"}</span>
                </div>
                ${esPosteriorCompromiso ? `<div style="font-size:9.5px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.3px;margin:2px 0;">⚠ Posterior a la fecha de atención comprometida</div>` : ""}
                ${c.tipo === "captura" ? `<div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.3px;margin:2px 0;">📋 Captura inicial</div>` : ""}
                <div style="font-size:12.5px;color:#334155;margin-top:2px;">${opsEsc(c.texto)}</div>
            </div>`;
        }).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin comentarios todavía.</div>';
    }

    window.opsAgregarComentarioFolio = async function (folioId) {
        const ta = document.getElementById("ops-nuevo-comentario-folio");
        const texto = (ta?.value || "").trim();
        if (!texto) return;
        const { db, fs } = await opsGetFB();
        await fs.addDoc(fs.collection(db, COL_FOLIOS, folioId, "comentarios"), {
            texto, autor: opsNombreActual(), autorEmail: opsUsuarioActual(),
            tipo: "feedback", createdAt: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
        });
        if (ta) ta.value = "";
        const f = cacheFolios.find(x => x.id === folioId);
        opsRenderComentariosFolio(folioId, f ? f.fechaAtencion : null);
    };

    // ── Importación de folios desde Excel (idempotente por estación+solicitud+vencimiento) ──
    // Soporta DOS formatos, se detecta solo por hoja (probando encabezado en fila 1 y luego fila 6):
    //
    // FORMATO NUEVO (estandar desde ago-2026, "Base de Datos", encabezado en fila 1):
    //   ID ORDEN, O.S., Tareas a realizar, Estación, Cliente, Prioridad, Fecha de Solicitud,
    //   Hora de Emisión del Servicio, Vencimiento, Horario de Carga del Archivo,
    //   Feedback/Tareas pendientes, Fecha de Atención, Plazo de Días, Fecha de Solución,
    //   Días Disponibles, Estado Actual (las últimas 4 son fórmulas viejas, se ignoran).
    //   OJO: "O.S." (orden de servicio INTERNA de Tecnocontrol) y "ID ORDEN" (folio con el que
    //   el CLIENTE solicita el servicio desde su portal) son identificadores distintos — NO se
    //   sustituyen entre sí (aclarado por Glen). Se guardan ambos por separado.
    //   La hora exacta de vencimiento (aclarado por Glen) sale de "Hora de Emisión del Servicio",
    //   no de "Horario de Carga del Archivo".
    //
    // FORMATO VIEJO (reporte mensual de Connecteam, encabezado en fila 6):
    //   ESTACION, COMENTARIOS, FECHA DE SOLICITUD, PRIORIDAD, VENCIMIENTO, HORARIO, RESPONSABLE,
    //   FECHA DE ATENCION, PLAZO, FECHA DE SOLUCION, DIAS DISPONIBLES (fórmula vieja, se ignora),
    //   O.S., ESTADO ACTUAL (fórmula vieja, se ignora).
    //
    // Los folios importados NO se reclasifican con Cliente automáticamente (para no pisar el
    // vencimiento manual ya capturado) — Glen puede abrirlos y usar "Detectar" si quiere.
    // Requiere SheetJS cargado en index.html: <script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
    window.opsImportarExcelFolios = async function (file) {
        if (!file) return;
        if (typeof XLSX === "undefined") { alert("Falta cargar SheetJS (XLSX) en index.html para poder importar Excel."); return; }
        const { db, fs } = await opsGetFB();

        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: false });

        // Comparación SIEMPRE a nivel de fecha (sin hora): así, sin importar si el registro ya
        // guardado en Firestore es de antes (vencimiento a medianoche) o de ahora (con hora exacta
        // combinada), se sigue reconociendo como el mismo folio y no se duplica al reimportar.
        const clave = f => `${f.estacion}|${String(f.fechaSolicitud || "").slice(0, 10)}|${String(f.vencimiento || "").slice(0, 10)}`;
        const existentesSet = new Set(cacheFolios.map(clave));

        let importados = 0, omitidos = 0;

        // Quita acentos y normaliza para que "Estación"/"ESTACION", "Atención"/"ATENCION", etc.
        // hagan match sin importar si el encabezado del Excel trae tilde o no.
        const norm = s => String(s || "").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Conversión manual de serial de Excel (sistema 1900, con la fecha de referencia -25569
        // que usa Excel/Google Sheets) a milisegundos Unix — no depende de XLSX.SSF, que varía
        // entre builds de SheetJS y no siempre viene cargado.
        const toISO = (v) => {
            if (!v && v !== 0) return null;
            if (v instanceof Date) return v.toISOString().slice(0, 10);
            if (typeof v === "number") { const d = new Date(Math.round((v - 25569) * 86400000)); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); }
            const s = String(v).trim();
            const mDMA = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // DD/MM/YYYY, como texto en el formato nuevo
            if (mDMA) return `${mDMA[3]}-${mDMA[2].padStart(2, "0")}-${mDMA[1].padStart(2, "0")}`;
            const d = new Date(s); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
        };
        const horaDesdeCelda = (v) => {
            if (v === null || v === undefined || v === "") return null;
            if (v instanceof Date) return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
            // Serial de Excel para hora: la parte fraccionaria del día (ej. 0.325 = 7:48 a.m.).
            if (typeof v === "number") { const totalMin = Math.round((v % 1) * 1440); const H = Math.floor(totalMin / 60), M = totalMin % 60; return `${String(H).padStart(2, "0")}:${String(M).padStart(2, "0")}`; }
            const m = String(v).match(/^(\d{1,2}):(\d{2})/);
            return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
        };

        for (const nombreHoja of wb.SheetNames) {
            // Se prueba primero el encabezado en fila 1 (formato nuevo) y si no hay "ESTACION" ahí,
            // en fila 6 (formato viejo de Connecteam) — así conviven ambos formatos sin configurar nada.
            let encabezado = null, datos = null;
            for (const rango of [0, 5]) {
                const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja], { header: 1, range: rango, defval: null });
                const [enc, ...dat] = filas;
                if (enc && enc.some(h => norm(h).includes("ESTACION"))) { encabezado = enc; datos = dat; break; }
            }
            if (!encabezado) continue; // ninguno de los dos formatos coincide en esta hoja, se ignora

            // Busca la primera columna cuyo encabezado normalizado empiece con cualquiera de los candidatos.
            const idx = (...candidatos) => {
                const cs = candidatos.map(norm);
                return encabezado.findIndex(h => { const nh = norm(h); return cs.some(c => nh.startsWith(c)); });
            };
            const iEst = idx("ESTACION"), iCom = idx("TAREAS A REALIZAR", "COMENTARIOS"), iSol = idx("FECHA DE SOLICITUD"),
                  iPrio = idx("PRIORIDAD"), iVen = idx("VENCIMIENTO"), iHor = idx("HORA DE EMISION DEL SERVICIO", "HORARIO"),
                  iResp = idx("RESPONSABLE"), iAt = idx("FECHA DE ATENCION"), iSlc = idx("FECHA DE SOLUCION"),
                  iOS = idx("O.S."), iIdOrden = idx("ID ORDEN");

            for (const fila of datos) {
                if (!fila || !fila[iEst]) continue;
                let vencimiento = iVen >= 0 ? toISO(fila[iVen]) : null;
                const horaVence = iHor >= 0 ? horaDesdeCelda(fila[iHor]) : null;
                if (vencimiento && horaVence) vencimiento = `${vencimiento}T${horaVence}`; // fecha + hora exacta de vencimiento

                const registro = {
                    estacion: String(fila[iEst] || "").trim(),
                    comentarios: iCom >= 0 ? String(fila[iCom] || "").trim() : "",
                    responsable: iResp >= 0 ? String(fila[iResp] || "").trim() : "",
                    folioOS: iOS >= 0 ? String(fila[iOS] ?? "").trim() : "",
                    // Folio con el que el CLIENTE solicita el servicio desde su portal — distinto de folioOS.
                    folioClienteId: iIdOrden >= 0 && fila[iIdOrden] != null ? String(fila[iIdOrden]).trim() : "",
                    prioridad: iPrio >= 0 && OPS_PRIORIDADES.includes(String(fila[iPrio] || "").trim().toUpperCase()) ? String(fila[iPrio]).trim().toUpperCase() : null,
                    fechaSolicitud: iSol >= 0 ? toISO(fila[iSol]) : null,
                    vencimiento,
                    fechaAtencion: iAt >= 0 ? toISO(fila[iAt]) : null,
                    fechaSolucion: iSlc >= 0 ? toISO(fila[iSlc]) : null,
                };
                if (existentesSet.has(clave(registro))) { omitidos++; continue; }
                await fs.addDoc(fs.collection(db, COL_FOLIOS), { ...registro, origen: "connecteam", hojaOrigen: nombreHoja, creadoEn: opsFechaHora() });
                existentesSet.add(clave(registro));
                importados++;
            }
        }
        if (window.mostrarPush) mostrarPush("Operaciones", `Importación completa: ${importados} nuevos, ${omitidos} ya existían.`, "📥");
        else alert(`Importación completa: ${importados} nuevos, ${omitidos} ya existían.`);
    };

    // ═══════════════════════ TAB: CLIENTES (catálogo de SLA por prioridad) ═══════════════════════
    function opsRenderClientes() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        const gestion = opsPuedeHacer("gestionar_herramientas");
        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Clientes y su tabla de SLA (horas por prioridad)</div>
                    ${gestion ? `<button onclick="opsAbrirModalCliente()" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">${ICON.plus} Nuevo cliente</button>` : ""}
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12.3px;">
                        <thead><tr style="background:#1f2937;color:#fff;text-align:left;">
                            <th style="padding:8px 10px;border-radius:8px 0 0 8px;">Cliente</th>
                            <th style="padding:8px 10px;">Palabras clave</th>
                            ${OPS_PRIORIDADES.map(p => `<th style="padding:8px 10px;text-align:center;">${p}</th>`).join("")}
                            <th style="padding:8px 10px;border-radius:0 8px 8px 0;"></th>
                        </tr></thead>
                        <tbody>${cacheClientes.length ? cacheClientes.map((c, i) => `
                            <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};border-bottom:1px solid #eef1f5;">
                                <td style="padding:8px 10px;font-weight:600;color:#334155;">${opsEsc(c.nombre)}</td>
                                <td style="padding:8px 10px;color:#64748b;">${opsEsc((c.palabrasClave || []).join(", ") || "—")}</td>
                                ${OPS_PRIORIDADES.map(p => `<td style="padding:8px 10px;text-align:center;color:#334155;">${c.horasSLA?.[p] ?? "—"}h</td>`).join("")}
                                <td style="padding:8px 10px;text-align:right;">${gestion ? `<button onclick="opsAbrirModalCliente('${c.id}')" style="background:#eef2f7;border:none;color:#1f2937;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">Editar</button>` : ""}</td>
                            </tr>`).join("") : `<tr><td colspan="9" style="padding:22px;text-align:center;color:#94a3b8;">Sin clientes registrados.</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;
    }
    window.opsRenderClientes = opsRenderClientes;

    window.opsAbrirModalCliente = function (id) {
        const c = id ? cacheClientes.find(x => x.id === id) : null;
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:420px;max-width:92vw;max-height:88vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">${c ? "Editar cliente" : "Nuevo cliente"}</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre</label>
                <input id="ops-cli-nombre" value="${opsEsc(c?.nombre || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Palabras clave para detectar por nombre de estación (separadas por coma)</label>
                <input id="ops-cli-palabras" value="${opsEsc((c?.palabrasClave || []).join(", "))}" placeholder="ej. oxxo" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <div style="font-size:11.5px;color:#64748b;font-weight:600;margin-bottom:6px;">Horas de SLA por prioridad</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">
                    ${OPS_PRIORIDADES.map(p => `
                        <div><label style="font-size:10.5px;color:#94a3b8;">${p} (horas)</label>
                        <input type="number" min="0" id="ops-cli-${p}" value="${c?.horasSLA?.[p] ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 8px;font-size:12.5px;margin-top:3px;"></div>`).join("")}
                </div>
                <div style="display:flex;justify-content:space-between;gap:8px;">
                    ${c ? `<button onclick="opsEliminarCliente('${c.id}')" style="background:#fef2f2;border:none;color:#b91c1c;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Eliminar</button>` : "<span></span>"}
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                        <button onclick="opsGuardarCliente('${id || ""}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#2E7CF6,#0B5FFF);">Guardar</button>
                    </div>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarCliente = async function (id) {
        const nombre = document.getElementById("ops-cli-nombre").value.trim();
        if (!nombre) { alert("El nombre del cliente es obligatorio"); return; }
        const { db, fs } = await opsGetFB();
        const horasSLA = {};
        OPS_PRIORIDADES.forEach(p => {
            const v = document.getElementById(`ops-cli-${p}`).value;
            if (v !== "") horasSLA[p] = Number(v);
        });
        const datos = {
            nombre,
            palabrasClave: document.getElementById("ops-cli-palabras").value.split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
            horasSLA,
        };
        if (id) await fs.updateDoc(fs.doc(db, COL_CLIENTES, id), datos);
        else await fs.addDoc(fs.collection(db, COL_CLIENTES), datos);
        const snap = await fs.getDocs(fs.collection(db, COL_CLIENTES));
        cacheClientes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ops-modal-wrap").innerHTML = "";
        opsRenderClientes();
        if (window.mostrarPush) mostrarPush("Operaciones", "Cliente guardado.", "🏢"); else alert("Cliente guardado.");
    };

    window.opsEliminarCliente = async function (id) {
        if (!confirm("¿Eliminar este cliente? Los folios que ya lo tengan asignado conservan el nombre, pero perderán el vínculo para recalcular su SLA.")) return;
        const { db, fs } = await opsGetFB();
        await fs.deleteDoc(fs.doc(db, COL_CLIENTES, id));
        cacheClientes = cacheClientes.filter(c => c.id !== id);
        document.getElementById("ops-modal-wrap").innerHTML = "";
        opsRenderClientes();
        if (window.mostrarPush) mostrarPush("Operaciones", "Cliente eliminado.", "🗑️"); else alert("Cliente eliminado.");
    };

    // ═══════════════════════ TAB: SOLICITUDES (bandeja de Almacén) ═══════════════════════
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
    let solicBusqueda = "";
    let solicFechaDesde = "";
    let solicFechaHasta = "";

    function opsSolicFechaMs(s) {
        const c = s.createdAt;
        if (!c) return 0;
        if (typeof c.toDate === "function") return c.toDate().getTime();
        if (typeof c === "string") { const t = new Date(c).getTime(); return isNaN(t) ? 0 : t; }
        if (typeof c === "number") return c;
        return 0;
    }

    function opsSolicListaFiltrada() {
        const desdeMs = solicFechaDesde ? new Date(solicFechaDesde + "T00:00:00").getTime() : null;
        const hastaMs = solicFechaHasta ? new Date(solicFechaHasta + "T23:59:59").getTime() : null;
        const busq = solicBusqueda.trim().toLowerCase();
        return cacheSurtidos.filter(s => {
            if (filtroSolic === "papelera") { if (!s.eliminada) return false; }
            else { if (s.eliminada) return false; }
            if (filtroSolic === "pendientes" && ["entregado", "rechazada", "cancelada"].includes(s.estado || "pendiente")) return false;
            if (filtroSolic === "urgentes" && s.prioridad !== "urgente") return false;
            if (filtroSolic === "operaciones" && s.origen !== "operaciones") return false;
            const ms = opsSolicFechaMs(s);
            if (desdeMs !== null && (!ms || ms < desdeMs)) return false;
            if (hastaMs !== null && (!ms || ms > hastaMs)) return false;
            if (busq) {
                const prods = (s.productos || []).map(p => `${p.desc || ""} ${p.clave || ""}`).join(" ");
                const texto = `${s.folio || ""} ${s.tecnicoNombre || ""} ${s.solicitante || ""} ${s.destino || ""} ${s.area || ""} ${prods}`.toLowerCase();
                if (!texto.includes(busq)) return false;
            }
            return true;
        });
    }

    function opsFilaSolicitudLista(puedeEliminar) {
        const lista = opsSolicListaFiltrada();
        return lista.length
            ? lista.map((s, i) => opsFilaSolicitud(s, i, puedeEliminar)).join("")
            : '<tr><td colspan="7" style="padding:22px;text-align:center;color:#94a3b8;">Sin solicitudes en este filtro.</td></tr>';
    }

    function opsSolicRefrescarTabla() {
        const puedeEliminar = opsPuedeHacer("eliminar_solicitudes") || opsRolActual() === "administrador";
        const tbody = document.getElementById("ops-solic-tbody");
        if (tbody) tbody.innerHTML = opsFilaSolicitudLista(puedeEliminar);
        const limpiarBtn = document.getElementById("ops-solic-limpiar-wrap");
        if (limpiarBtn) limpiarBtn.innerHTML = (solicBusqueda || solicFechaDesde || solicFechaHasta)
            ? `<button onclick="opsSolicLimpiarFiltros()" style="background:#fff;border:1px solid #cbd5e1;color:#475569;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">Limpiar</button>` : "";
    }

    function opsRenderSolicitudes() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        opsLimpiarPapeleraVencida(); // best-effort: borra en segundo plano lo que ya cumplió 3 meses
        const puedeEliminar = opsPuedeHacer("eliminar_solicitudes") || opsRolActual() === "administrador";
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
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px;padding:10px 12px;background:#f8fafc;border-radius:10px;">
                    <div style="flex:1;min-width:180px;">
                        <label style="font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:4px;">Buscar</label>
                        <input id="ops-solic-buscar" type="text" placeholder="Folio, técnico, destino, artículo..." value="${opsEsc(solicBusqueda)}" oninput="opsSolicBuscarInput(this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 10px;font-size:12.5px;box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:4px;">Desde</label>
                        <input id="ops-solic-desde" type="date" value="${opsEsc(solicFechaDesde)}" onchange="opsSolicFechaInput('desde',this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 10px;font-size:12.5px;">
                    </div>
                    <div>
                        <label style="font-size:10px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;color:#94a3b8;display:block;margin-bottom:4px;">Hasta</label>
                        <input id="ops-solic-hasta" type="date" value="${opsEsc(solicFechaHasta)}" onchange="opsSolicFechaInput('hasta',this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 10px;font-size:12.5px;">
                    </div>
                    <div id="ops-solic-limpiar-wrap">${(solicBusqueda || solicFechaDesde || solicFechaHasta) ? `<button onclick="opsSolicLimpiarFiltros()" style="background:#fff;border:1px solid #cbd5e1;color:#475569;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">Limpiar</button>` : ""}</div>
                </div>
                ${filtroSolic === "papelera" ? '<div style="font-size:10.5px;color:#94a3b8;margin-bottom:10px;">Las solicitudes eliminadas se conservan 3 meses antes de borrarse automáticamente.</div>' : ""}
                <div style="font-size:10.5px;color:#94a3b8;margin-bottom:10px;">Esta vista es solo informativa: el estado (Pendiente / Listo / Entregado) lo controla Almacén — desde aquí no se puede avanzar el flujo.</div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead><tr style="background:#0B5FFF;color:#fff;text-align:left;">
                            <th style="padding:7px 10px;border-radius:8px 0 0 8px;">Folio</th>
                            <th style="padding:7px 10px;">Fecha</th>
                            <th style="padding:7px 10px;">Técnico</th>
                            <th style="padding:7px 10px;">Producto</th>
                            <th style="padding:7px 10px;">Prioridad</th>
                            <th style="padding:7px 10px;">Estado</th>
                            <th style="padding:7px 10px;border-radius:0 8px 8px 0;text-align:right;">Acción</th>
                        </tr></thead>
                        <tbody id="ops-solic-tbody">${opsFilaSolicitudLista(puedeEliminar)}</tbody>
                    </table>
                </div>
            </div>`;
    }
    window.opsFiltrarSolic = function (f) { filtroSolic = f; opsRenderSolicitudes(); };
    window.opsSolicBuscarInput = function (v) { solicBusqueda = v; opsSolicRefrescarTabla(); };
    window.opsSolicFechaInput = function (cual, v) { if (cual === "desde") solicFechaDesde = v; else solicFechaHasta = v; opsSolicRefrescarTabla(); };
    window.opsSolicLimpiarFiltros = function () { solicBusqueda = ""; solicFechaDesde = ""; solicFechaHasta = ""; opsRenderSolicitudes(); };

    function opsFilaSolicitud(s, i, puedeEliminar) {
        const estadoKey = s.estado || "pendiente";
        const e = ESTADOS_SOLICITUD[estadoKey] || ESTADOS_SOLICITUD.pendiente;
        const prod = (s.productos && s.productos[0]) || {};
        const otros = (s.productos || []).length - 1;
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        const prio = s.prioridad === "urgente" ? `<span style="color:#b91c1c;font-weight:600;">Urgente</span>` : "Normal";
        const ms = opsSolicFechaMs(s);
        const fecha = ms ? new Date(ms).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—";
        return `<tr style="background:${zebra};border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsAbrirFichaSolicitud('${s.id}')">
            <td style="padding:7px 10px;font-weight:600;color:#334155;">${opsEsc(s.folio)}</td>
            <td style="padding:7px 10px;color:#64748b;white-space:nowrap;">${fecha}</td>
            <td style="padding:7px 10px;color:#334155;">${opsEsc(s.tecnicoNombre || s.solicitante || "—")}</td>
            <td style="padding:7px 10px;color:#334155;">${opsEsc(prod.desc)}${prod.cant ? ` × ${opsEsc(prod.cant)}` : ""}${otros > 0 ? ` (+${otros})` : ""}</td>
            <td style="padding:7px 10px;">${prio}</td>
            <td style="padding:7px 10px;"><span style="background:${e.bg};color:${e.fg};font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;">${e.label}</span></td>
            <td style="padding:7px 10px;text-align:right;white-space:nowrap;" onclick="event.stopPropagation()">
                ${s.eliminada
                    ? (puedeEliminar ? `<button onclick="opsRestaurarSolicitud('${s.id}')" style="background:#dcfce715;border:1px solid #bbf7d0;color:#166534;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:10.5px;font-weight:600;">Restaurar</button>` : "")
                    : `<button onclick="opsImprimirSolicitud('${s.id}')" title="Imprimir PDF" style="background:#f1f5f9;border:none;color:#334155;width:26px;height:26px;border-radius:7px;cursor:pointer;margin-right:4px;">🖨️</button>
                       <button onclick="opsWhatsAppSolicitud('${s.id}')" title="Enviar por WhatsApp" style="background:#f0fdf4;border:none;color:#16a34a;width:26px;height:26px;border-radius:7px;cursor:pointer;margin-right:4px;">💬</button>
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
        const listaArticulos = Array.isArray(s.productos) ? s.productos : [];
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
                    <div><strong>Prioridad:</strong> ${opsEsc(s.prioridad)}</div>
                    <div><strong>Operación destino:</strong> ${opsEsc(s.destino || "—")}</div>
                    <div><strong>Folio de servicio:</strong> ${opsEsc(s.folioServicio || "—")}</div>
                    <div><strong>Uso:</strong> ${opsEsc(s.uso || "—")}</div>
                    ${s.recibioNombre ? `<div><strong>Recibió:</strong> ${opsEsc(s.recibioNombre)}</div>` : ""}
                </div>
                <div style="margin-top:12px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px;">Artículos solicitados (${listaArticulos.length})</div>
                    ${listaArticulos.length
                        ? listaArticulos.map(it => `<div style="display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#1e293b;padding:3px 0;border-bottom:1px solid #f1f5f9;"><span>${opsEsc(it.desc || "—")}${it.clave ? ` <span style="color:#94a3b8;">(${opsEsc(it.clave)})</span>` : ""}</span><span style="font-weight:700;white-space:nowrap;">×${opsEsc(it.cant || 0)}</span></div>`).join("")
                        : '<div style="color:#94a3b8;font-size:12px;">Sin artículos capturados.</div>'}
                </div>
                <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="opsImprimirSolicitud('${s.id}')" style="background:#f1f5f9;border:none;color:#334155;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">🖨️ Imprimir PDF</button>
                    <button onclick="opsWhatsAppSolicitud('${s.id}')" style="background:#f0fdf4;border:none;color:#16a34a;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">💬 Enviar por WhatsApp</button>
                </div>
                <div style="margin-top:20px;font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;">${ICON.clock} Línea de tiempo</div>
                <div style="margin-top:10px;border-left:2px solid #e2e8f0;padding-left:14px;">
                    ${historial.length ? historial.map(ev => `<div style="margin-bottom:12px;position:relative;"><div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#0B5FFF;"></div><div style="font-size:12px;color:#334155;">${opsEsc(ev.de || "—")} → ${opsEsc(ev.a || "—")} · ${opsEsc(ev.por || "")}</div></div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin eventos registrados aún.</div>'}
                </div>
            </div>
        </div>`;
    };

    // Reusa el generador de PDF profesional que vive en almacen.js (mismo esquema
    // `surtidos`, mismo folio) — evita duplicar la plantilla del PDF en dos módulos.
    // almacen.js siempre está cargado antes que operaciones.js en index.html, pero
    // se deja el aviso por si algún día cambia el orden de carga.
    window.opsImprimirSolicitud = function (id) {
        if (window.__almImprimirSolicitudMaterial) window.__almImprimirSolicitudMaterial(id);
        else alert("No se pudo generar el PDF: el módulo de Almacén no está cargado en esta sesión. Recarga la página e inténtalo de nuevo.");
    };
    window.opsWhatsAppSolicitud = function (id) {
        if (window.__almWhatsAppSolicitudMaterial) window.__almWhatsAppSolicitudMaterial(id);
        else alert("No se pudo abrir WhatsApp: el módulo de Almacén no está cargado en esta sesión. Recarga la página e inténtalo de nuevo.");
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

        el.innerHTML = `
            <div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <div style="font-size:11.5px;color:#64748b;max-width:520px;">🔔 Prueba el sistema de alertas: genera una notificación real que suena (~10s) y aparece como ventana flotante en <b>todas</b> las sesiones de Operaciones abiertas ahora mismo.</div>
                <button onclick="opsProbarAlerta()" style="background:linear-gradient(135deg,#8B4FD6,#6d28d9);border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;white-space:nowrap;">🔔 Probar alerta</button>
            </div>`
            + bloque("Críticas", "#b91c1c", "#fee2e2", criticas)
            + bloque("Pendientes", "#b45309", "#fef3c7", pendientes)
            + bloque("Preventivas", "#854d0e", "#fef9c3", preventivas)
            + bloque("Información", "#0B5FFF", "#e0e7ff", info)
            + (!criticas.length && !pendientes.length && !preventivas.length && !info.length
                ? '<div style="background:#fff;border-radius:12px;padding:24px;text-align:center;color:#94a3b8;font-size:12.5px;">Sin alertas activas — todo en orden.</div>' : "");
    }

    // ── Genera una notificación de PRUEBA real (misma colección ops_notificaciones que
    // usa "solicitud lista para surtir"), para que Glen vea la alarma + ventana flotante
    // funcionando de punta a punta. Se marca leida:true de inmediato así no se acumula
    // como pendiente real en el sistema. ──
    window.opsProbarAlerta = async function () {
        const { db, fs } = await opsGetFB();
        const ref = await fs.addDoc(fs.collection(db, COL_NOTIFICACIONES), {
            tipo: "prueba", esPrueba: true,
            mensaje: `Notificación de prueba generada por ${opsNombreActual()} — así se ve una alerta real.`,
            leida: false, fecha: opsFechaHora(),
        });
        // Se marca leída casi de inmediato para no dejar basura acumulada en la colección real
        // de notificaciones — el listener ya alcanzó a dispararse con leida:false antes de esto.
        setTimeout(() => { fs.updateDoc(ref, { leida: true }).catch(() => {}); }, 2000);
        window.mostrarPush ? mostrarPush("Operaciones", "Alerta de prueba enviada — deberías verla y escucharla en unos segundos.", "🔔") : null;
    };

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
