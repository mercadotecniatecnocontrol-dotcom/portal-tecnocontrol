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
    const COL_HERR_TRASPASOS = "ops_herramienta_traspasos"; // Solicitudes de traspaso técnico-a-técnico que requieren aceptación (mismo patrón que flotilla_transferencias)
    // Almacenes como entidad real (sep-2026, a petición de Glen): Almacén General +
    // un almacén por técnico activo, en vocabulario "traspaso entre almacenes" — así
    // cuando se conecte con Aspel es una traducción directa, no una reconstrucción.
    // El almacén de un técnico usa EL MISMO id que su doc en ops_tecnicos — no existe
    // tabla de cruce, tecnicoActualId ES la referencia al almacén (o null = general).
    const COL_ALMACENES = "ops_almacenes";
    const ALMACEN_GENERAL_ID = "general";
    // Equipo que requiere autorización previa (ej. equipo de calibración TecnoLab)
    // antes de poder asignarse/traspasarse — a petición de Glen (sep-2026).
    const COL_CONFIG_CALIBRACION = "ops_config_calibracion";
    // Quién puede revisar CUALQUIER almacén de herramienta desde Flotilla móvil
    // (no solo el propio) — lista editable, a petición explícita de Glen (sep-2026):
    // administrativos de Operaciones + administrativos de la plataforma juntos.
    const COL_CONFIG_REVISION = "ops_config_revision";
    // Catálogo de servicios / Planeación Operativa (sep-2026): recetas parametrizadas
    // por tipo de servicio (materiales, personal por rol, vehículos, herramienta,
    // seguridad, costo). Fase 1 — modelo de datos + import real del Excel de Paloma;
    // el motor de cálculo/calendario/disponibilidad quedan para fases siguientes.
    const COL_SERVICIOS_CATALOGO = "ops_servicios_catalogo";
    const COL_TARIFAS_PERSONAL = "ops_tarifas_personal"; // doc por rol (lider/tecnico/obra_civil) — nunca por nombre de empleado
    const COL_AUSENCIAS = "ops_tecnico_ausencias"; // calendario propio de vacaciones/incapacidad/permiso por técnico (sep-2026, a petición de Glen)
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

    // ── Acceso al kiosco de Solicitud de Material (Firebase Auth real) ──────
    // El kiosco (solicitud-material.html) dejó de usar auth anónima; ahora cada
    // técnico necesita una cuenta real para identificar quién solicita y para
    // quién. Reutiliza el mismo patrón que la alta de usuarios del portal en
    // index.html: app secundaria de Firebase para crear la cuenta sin cerrar la
    // sesión del admin. El UID resultante se guarda en ops_tecnicos.firebaseUid
    // — el mismo campo que ya existía para "sincronización con RH" — así que
    // también sirve para saber de un vistazo quién ya tiene acceso al kiosco.
    // Esta cuenta NO da acceso al portal: se crea con rol:"tecnico_campo" y sin
    // departamento en usuarios/{uid}, así que si por error entra a index.html no
    // encuentra ningún área asignada.
    function opsPasswordSugerida(t) {
        const digitos = String(t.numeroOperativo || "").replace(/\D/g, "") || "000";
        return digitos + "Tecno1";
    }

    window.opsAbrirModalAccesoKiosco = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        if (!t.correo) { alert("Primero captura el correo del técnico (✏️ Editar perfil) — sin correo no se puede crear el acceso al kiosco."); return; }
        if (t.firebaseUid) { alert("Este técnico ya tiene acceso al kiosco.\nCorreo: " + t.correo); return; }
        const wrap = document.getElementById("ops-modal-wrap");
        const passSugerida = opsPasswordSugerida(t);
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">🔑 Crear acceso al kiosco</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Esta cuenta solo sirve para iniciar sesión en el kiosco de Solicitud de Material — no da acceso al portal.</div>
                <div style="background:#f8fafc;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12.5px;color:#334155;">
                    <div><strong>${opsEsc(t.nombre)}</strong></div>
                    <div style="color:#64748b;">${opsEsc(t.correo)}</div>
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Contraseña inicial</label>
                <input id="ops-acceso-pass" value="${opsEsc(passSugerida)}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;">
                <div style="font-size:10.5px;color:#94a3b8;margin-bottom:14px;">Mínimo 6 caracteres. Dísela al técnico de palabra — no se vuelve a mostrar después de crear la cuenta.</div>
                <div id="ops-acceso-msg" style="color:#E7402B;font-size:11.5px;margin-bottom:8px;"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button id="ops-acceso-btn" onclick="opsCrearAccesoKiosco('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Crear acceso</button>
                </div>
            </div>
        </div>`;
    };

    window.opsCrearAccesoKiosco = async function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const passInput = document.getElementById("ops-acceso-pass");
        const msgEl = document.getElementById("ops-acceso-msg");
        const btn = document.getElementById("ops-acceso-btn");
        const pass = passInput ? passInput.value : "";
        if (!pass || pass.length < 6) { if (msgEl) msgEl.textContent = "La contraseña debe tener al menos 6 caracteres."; return; }
        if (!window.firebaseConfig) { if (msgEl) msgEl.textContent = "Falta window.firebaseConfig en index.html — no se puede crear la cuenta."; return; }
        if (msgEl) msgEl.textContent = "";
        if (btn) { btn.textContent = "Creando…"; btn.disabled = true; }

        let secondaryApp = null;
        try {
            const { appMod, authMod } = await opsGetAuthHerramientas();
            secondaryApp = appMod.initializeApp(window.firebaseConfig, "acceso-kiosco-" + Date.now());
            const secondaryAuth = authMod.getAuth(secondaryApp);
            const cred = await authMod.createUserWithEmailAndPassword(secondaryAuth, t.correo, pass);
            const uid = cred.user.uid;
            await authMod.signOut(secondaryAuth);

            const { db, fs } = await opsGetFB();
            await fs.setDoc(fs.doc(db, "usuarios", uid), {
                correo: t.correo, nombre: t.nombre, departamento: null, rol: "tecnico_campo", activo: true,
                tecnicoId: idInterno, creadoPor: opsUsuarioActual(), creadoEn: opsFechaHora(),
            });
            await fs.updateDoc(fs.doc(db, COL_TECNICOS, idInterno), { firebaseUid: uid });
            await opsAuditar("tecnico", idInterno, "firebaseUid", null, uid);

            const snapTec = await fs.getDocs(fs.collection(db, COL_TECNICOS));
            cacheTec = snapTec.docs.map(d => ({ id: d.id, ...d.data() }));
            document.getElementById("ops-modal-wrap").innerHTML = "";
            if (window.mostrarPush) window.mostrarPush("Acceso creado", `${t.nombre} ya puede entrar al kiosco con ${t.correo}.`, "🔑");
            else alert(`Acceso creado.\nCorreo: ${t.correo}\nContraseña: ${pass}`);
            opsAbrirFichaTecnico(idInterno, "rh");
        } catch (e) {
            const msgs = {
                "auth/email-already-in-use": "Ese correo ya tiene una cuenta (revisa si ya existe acceso al portal o a otro técnico).",
                "auth/invalid-email": "Correo inválido — revisa el campo Correo en el perfil del técnico.",
                "auth/weak-password": "Contraseña muy débil (mínimo 6 caracteres).",
            };
            if (msgEl) msgEl.textContent = msgs[e.code] || ("Error al crear el acceso: " + e.message);
        } finally {
            if (btn) { btn.textContent = "Crear acceso"; btn.disabled = false; }
            if (secondaryApp) { try { const { appMod } = await opsGetAuthHerramientas(); await appMod.deleteApp(secondaryApp); } catch (_e) { /* no crítico */ } }
        }
    };

    const UBICACIONES = ["Almacén central", "Estación / cliente", "Vehículo", "Taller de reparación"];

    const ESTADOS_HERRAMIENTA = {
        disponible:  { label: "Disponible",       bg: "#dcfce7", fg: "#166534" },
        asignada:    { label: "Asignada",         bg: "#e0f2fe", fg: "#075985" },
        prestamo:    { label: "En préstamo",      bg: "#e0e7ff", fg: "#3730a3" },
        revision:    { label: "En revisión",      bg: "#fef9c3", fg: "#854d0e" },
        reparacion:  { label: "En reparación",    bg: "#fef3c7", fg: "#92400e" },
        danada:      { label: "Dañada",           bg: "#fee2e2", fg: "#E7402B" },
        extraviada:  { label: "Extraviada",       bg: "#fce7f3", fg: "#9d174d" },
        garantia:    { label: "En garantía",      bg: "#ede9fe", fg: "#5b21b6" },
        baja:        { label: "Baja",             bg: "#e5e7eb", fg: "#374151" },
    };

    // Campos "enterprise" de alta (Glen, sep-2026): departamento de uso, condición
    // (nueva/usada/reacondicionada) y unidad de peso. Son opcionales — piezas ya
    // existentes simplemente no los tienen y se muestran como "—".
    const DEPARTAMENTOS_HERRAMIENTA = ["Operaciones", "Almacén", "Flotilla", "Ventas", "Mantenimiento", "Construcción / Desarrollos", "Administración", "Otro"];
    const CONDICIONES_HERRAMIENTA = {
        nueva:           { label: "Nueva",           bg: "#dcfce7", fg: "#166534" },
        usada:           { label: "Usada",           bg: "#fef9c3", fg: "#854d0e" },
        reacondicionada: { label: "Reacondicionada", bg: "#e0e7ff", fg: "#3730a3" },
    };
    const UNIDADES_PESO = ["kg", "g", "lb"];

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
        lock:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
        unlock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/></svg>',
        camera: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z"/><circle cx="12" cy="13" r="4"/></svg>',
        file:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
        xCircle:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
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
    let unsubHerr = null, unsubTec = null, unsubMov = null, unsubSurt = null, unsubSurtPoll = null, unsubFolios = null, unsubNotif = null, unsubTraspasos = null, unsubConfigCalibracion = null, unsubServiciosCatalogo = null, unsubTarifasPersonal = null, unsubAusencias = null, unsubAlmacenes = null, unsubConfigRevision = null, unsubRevisiones = null;
    let cacheHerr = [], cacheTec = [], cacheMov = [], cacheSurtidos = [], cacheFolios = [];
    let cacheServiciosCatalogo = [], cacheTarifasPersonal = {};
    let cacheAusencias = [];
    let cacheAlmacenes = []; // TODOS los almacenes (general/técnico/ubicación) — para las ubicaciones físicas tipo "Banco de trabajo Saltillo"
    let cacheRevisoresHerramienta = []; // [{email,nombre}] — quién puede revisar CUALQUIER almacén desde Flotilla móvil
    let cacheRevisionesHerr = []; // últimas revisiones/checklists de herramienta, de cualquier origen (Portal o Flotilla)
    let cacheTraspasosPend = []; // ops_herramienta_traspasos con estatus "Pendiente recepción" — bloquea la pieza hasta que el receptor acepte/rechace/venza
    let cacheAutorizadoresCalibracion = []; // [{email,nombre}] — quién puede aprobar mover equipo con requiereAutorizacion=true
    let filtroFolios = "", filtroFolioSemaforo = "todos";
    let tabActual = "dashboard";
    let filtroHerr = "", filtroTec = "";
    let filtroCat = { busca: "", categoria: "", departamento: "", estado: "", condicion: "" };

    async function opsGetFB() {
        if (opsFB) return opsFB;
        const fs = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        opsFB = { db: window.db, fs };
        return opsFB;
    }

    // Carga perezosa de firebase-app/firebase-auth — solo se usan al crear el
    // acceso al kiosco de un técnico (operación poco frecuente), así que no vale
    // la pena importarlos junto con el resto del módulo.
    let opsAuthTools = null;
    async function opsGetAuthHerramientas() {
        if (opsAuthTools) return opsAuthTools;
        const appMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
        const authMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        opsAuthTools = { appMod, authMod };
        return opsAuthTools;
    }

    // Carga perezosa de firebase-storage — solo se usa al guardar fotos de
    // evidencia de una revisión de herramienta. Reutiliza la app por defecto
    // (la misma que ya inicializó window.db en index.html).
    let opsStorageTools = null;
    async function opsGetStorage() {
        if (opsStorageTools) return opsStorageTools;
        const appMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
        const stMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js");
        const storage = stMod.getStorage(appMod.getApp());
        opsStorageTools = { storage, stMod };
        return opsStorageTools;
    }

    // Redimensiona/comprime una imagen en el navegador antes de subirla —
    // "buen tamaño" para el PDF de auditoría, sin subir fotos de 8-12MB
    // directo de la cámara del celular. Máximo ~1600px de lado mayor, JPEG 0.82.
    function opsComprimirImagen(file, maxLado, calidad) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                img.onerror = reject;
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxLado || height > maxLado) {
                        if (width >= height) { height = Math.round(height * (maxLado / width)); width = maxLado; }
                        else { width = Math.round(width * (maxLado / height)); height = maxLado; }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width; canvas.height = height;
                    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => resolve(blob), "image/jpeg", calidad);
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Sin plan Blaze no hay Firebase Storage — las fotos se guardan comprimidas
    // directo en Firestore como base64 (mismo criterio histórico del resto del
    // portal). Tamaño moderado (~700px, calidad .6) para quedar típicamente en
    // 60-150KB por foto — muy por debajo del límite de 1MB por documento.
    function opsComprimirImagenBase64(file, maxLado, calidad) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                img.onerror = reject;
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxLado || height > maxLado) {
                        if (width >= height) { height = Math.round(height * (maxLado / width)); width = maxLado; }
                        else { width = Math.round(width * (maxLado / height)); height = maxLado; }
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = width; canvas.height = height;
                    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL("image/jpeg", calidad));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
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
    let fichaTecActual = null;
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
        try {
            // Mismo puente que ya usan Ventas y Almacén — antes esto contaba folios
            // directo en Firestore, en una colección que Almacén ya no lee desde que
            // `surtidos` vive en Supabase. Corregido sep-2026 (mismo bug que en Flotilla).
            const siguiente = await window.tcSbSiguienteFolioMaterial("OPERACIONES");
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
            // Mismo dato que tecnicoAnterior/NuevoId, en vocabulario de almacenes
            // ("traspaso entre almacenes") — listo para el puente con Aspel sin
            // tener que reconstruir el historial después.
            almacenOrigenId: opsAlmacenIdDe(datos.tecnicoAnteriorId),
            almacenDestinoId: opsAlmacenIdDe(datos.tecnicoNuevoId),
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
        if (!silencioso && window.mostrarPush) mostrarPush("Herramientas", "Responsiva PDF generada: " + nombreArchivo, ICON.file);
    }
    window.opsGenerarResponsivaPDF = opsGenerarResponsivaPDF;

    function opsNombreTecnico(idInterno) {
        if (!idInterno) return "Sin asignar";
        const t = cacheTec.find(x => x.id === idInterno);
        return t ? `${t.nombre} (${t.numeroOperativo})` : "Técnico desconocido";
    }

    // Traspaso técnico-a-técnico pendiente de aceptación para esta pieza, si hay uno.
    // Mientras exista, la pieza queda bloqueada: nadie puede iniciar otro movimiento
    // sobre ella salvo cancelar este traspaso (Almacén/Operaciones).
    function opsTraspasoPendientePara(herramientaId) {
        return cacheTraspasosPend.find(t => t.herramientaId === herramientaId) || null;
    }

    // El almacén de una pieza se DERIVA de tecnicoActualId — no es un campo aparte
    // que se pueda desincronizar. null/vacío = Almacén General.
    // Retrocompatible: si se le pasa el objeto herramienta completo, respeta su
    // almacenId explícito (piezas en una ubicación física, ej. "Banco de trabajo
    // Saltillo", sin técnico asignado) — si se le pasa solo un id de técnico
    // (como ya hacía antes en movimientos/traspasos), se comporta igual que siempre.
    function opsAlmacenIdDe(tecnicoIdOrHerramienta) {
        if (tecnicoIdOrHerramienta && typeof tecnicoIdOrHerramienta === "object") {
            return tecnicoIdOrHerramienta.tecnicoActualId || tecnicoIdOrHerramienta.almacenId || ALMACEN_GENERAL_ID;
        }
        return tecnicoIdOrHerramienta || ALMACEN_GENERAL_ID;
    }
    function opsNombreAlmacen(tecnicoId) {
        return tecnicoId ? opsNombreTecnico(tecnicoId) : "Almacén General";
    }

    // Equipo con requiereAutorizacion=true (ej. calibración TecnoLab) solo lo puede
    // mover/asignar/traspasar alguien de esta lista — configurable sin tocar código.
    function opsEsAutorizadorCalibracion() {
        const correo = opsUsuarioActual();
        return (window.esAdminTotal && window.esAdminTotal(correo)) || cacheAutorizadoresCalibracion.some(a => (a.email || "").toLowerCase() === correo);
    }

    window.opsAbrirConfigCalibracion = function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:420px;max-width:92vw;max-height:88vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Autorización de equipo especializado</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:14px;">Solo estas personas (o un Administrador) pueden asignar/traspasar una pieza marcada como "Requiere autorización previa" — ej. equipo de calibración de TecnoLab.</div>
                <div id="ops-config-calib-lista" style="margin-bottom:12px;">
                    ${cacheAutorizadoresCalibracion.length ? cacheAutorizadoresCalibracion.map((a, i) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:8px 11px;margin-bottom:6px;">
                            <div><div style="font-size:12.5px;font-weight:600;color:#1e293b;">${opsEsc(a.nombre || a.email)}</div><div style="font-size:10.5px;color:#94a3b8;">${opsEsc(a.email)}</div></div>
                            <button onclick="opsQuitarAutorizadorCalibracion(${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;">${ICON.close}</button>
                        </div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Nadie configurado todavía — por ahora solo Administradores pueden autorizar.</div>'}
                </div>
                <div style="display:flex;gap:6px;">
                    <input id="ops-config-calib-nombre" placeholder="Nombre" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                    <input id="ops-config-calib-email" placeholder="correo@tecnocontrol.com.mx" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                    <button onclick="opsAgregarAutorizadorCalibracion()" style="background:#1D2E73;color:#fff;border:none;padding:0 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">Agregar</button>
                </div>
                <div style="text-align:right;margin-top:16px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                </div>
            </div>
        </div>`;
    };

    async function opsGuardarAutorizadoresCalibracion() {
        const { db, fs } = await opsGetFB();
        await fs.setDoc(fs.doc(db, COL_CONFIG_CALIBRACION, "general"), { autorizadores: cacheAutorizadoresCalibracion }, { merge: true });
    }

    window.opsAgregarAutorizadorCalibracion = function () {
        const nombre = document.getElementById("ops-config-calib-nombre").value.trim();
        const email = document.getElementById("ops-config-calib-email").value.trim().toLowerCase();
        if (!email) { alert("Captura el correo"); return; }
        cacheAutorizadoresCalibracion = [...cacheAutorizadoresCalibracion, { nombre, email }];
        opsGuardarAutorizadoresCalibracion().catch(err => alert("No se pudo guardar: " + err.message));
        opsAbrirConfigCalibracion();
    };
    window.opsQuitarAutorizadorCalibracion = function (idx) {
        cacheAutorizadoresCalibracion = cacheAutorizadoresCalibracion.filter((_, i) => i !== idx);
        opsGuardarAutorizadoresCalibracion().catch(err => alert("No se pudo guardar: " + err.message));
        opsAbrirConfigCalibracion();
    };

    // ── Configuración: quién puede revisar CUALQUIER almacén desde Flotilla ──
    window.opsAbrirConfigRevision = function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:420px;max-width:92vw;max-height:88vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Quién puede revisar herramienta (Flotilla)</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:14px;">Administrativos de Operaciones + administrativos de la plataforma que pueden usar "Revisar herramienta" en Flotilla móvil para cualquier almacén (no solo el propio).</div>
                <div id="ops-config-rev-lista" style="margin-bottom:12px;">
                    ${cacheRevisoresHerramienta.length ? cacheRevisoresHerramienta.map((a, i) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;border:1px solid #e2e8f0;border-radius:8px;padding:8px 11px;margin-bottom:6px;">
                            <div><div style="font-size:12.5px;font-weight:600;color:#1e293b;">${opsEsc(a.nombre || a.email)}</div><div style="font-size:10.5px;color:#94a3b8;">${opsEsc(a.email)}</div></div>
                            <button onclick="opsQuitarRevisorHerramienta(${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;">${ICON.close}</button>
                        </div>`).join("") : `<div style="color:#94a3b8;font-size:12px;margin-bottom:8px;">Nadie configurado todavía.</div><button onclick="opsSembrarRevisoresIniciales()" style="background:#eef2f7;border:none;color:#1D2E73;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">Cargar la lista que me diste (8 personas)</button>`}
                </div>
                <div style="display:flex;gap:6px;">
                    <input id="ops-config-rev-nombre" placeholder="Nombre" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                    <input id="ops-config-rev-email" placeholder="correo@tecnocontrol.com.mx" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                    <button onclick="opsAgregarRevisorHerramienta()" style="background:#1D2E73;color:#fff;border:none;padding:0 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">Agregar</button>
                </div>
                <div style="text-align:right;margin-top:16px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                </div>
            </div>
        </div>`;
    };

    async function opsGuardarRevisoresHerramienta() {
        const { db, fs } = await opsGetFB();
        await fs.setDoc(fs.doc(db, COL_CONFIG_REVISION, "general"), { revisores: cacheRevisoresHerramienta }, { merge: true });
    }
    window.opsAgregarRevisorHerramienta = function () {
        const nombre = document.getElementById("ops-config-rev-nombre").value.trim();
        const email = document.getElementById("ops-config-rev-email").value.trim().toLowerCase();
        if (!email) { alert("Captura el correo"); return; }
        cacheRevisoresHerramienta = [...cacheRevisoresHerramienta, { nombre, email }];
        opsGuardarRevisoresHerramienta().catch(err => alert("No se pudo guardar: " + err.message));
        opsAbrirConfigRevision();
    };
    window.opsQuitarRevisorHerramienta = function (idx) {
        cacheRevisoresHerramienta = cacheRevisoresHerramienta.filter((_, i) => i !== idx);
        opsGuardarRevisoresHerramienta().catch(err => alert("No se pudo guardar: " + err.message));
        opsAbrirConfigRevision();
    };
    // Precarga exacta de la lista que Glen dio (sep-2026) — un clic, sin tener
    // que capturar 8 correos a mano. Nombres puestos donde ya los conocemos.
    window.opsSembrarRevisoresIniciales = function () {
        cacheRevisoresHerramienta = [
            { nombre: "", email: "clientes@tecnocontrol.com.mx" },
            { nombre: "Magali Chávez", email: "magali@tecnocontrol.com.mx" },
            { nombre: "Miguel", email: "miguel@tecnocontrol.com.mx" },
            { nombre: "Ulises Núñez", email: "u.nunez@tecnocontrol.com.mx" },
            { nombre: "Paloma Pinedo", email: "p.pinedo@tecnocontrol.com.mx" },
            { nombre: "Martín de la O", email: "m.delao@tecnocontrol.com.mx" },
            { nombre: "Cristina Acosta", email: "c.acosta@tecnocontrol.com.mx" },
            { nombre: "", email: "mercadotecnia@tecnocontrol.com.mx" },
        ];
        opsGuardarRevisoresHerramienta().catch(err => alert("No se pudo guardar: " + err.message));
        opsAbrirConfigRevision();
    };

    window.opsSolicitarAutorizacion = async function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        if (!h) return;
        if (!cacheAutorizadoresCalibracion.length) { alert("No hay autorizadores configurados todavía — pide a un Administrador que los agregue."); return; }
        try {
            const { db, fs } = await opsGetFB();
            await Promise.all(cacheAutorizadoresCalibracion.map(a => fs.addDoc(fs.collection(db, "flotilla_notificaciones"), {
                tipo: "autorizacion_equipo_especializado", para: a.email,
                mensaje: `${opsNombreActual()} solicita autorización para mover/asignar ${h.folio} — ${h.descripcion}.`,
                leido: false, creadaEn: opsFechaHora(),
            }).catch(() => {})));
            document.getElementById("ops-modal-wrap").innerHTML = "";
            alert("Solicitud enviada a: " + cacheAutorizadoresCalibracion.map(a => a.nombre || a.email).join(", "));
        } catch (err) {
            alert("No se pudo enviar la solicitud: " + err.message);
        }
    };

    async function opsAsegurarAlmacenGeneral(db, fs) {
        await fs.setDoc(fs.doc(db, COL_ALMACENES, ALMACEN_GENERAL_ID), {
            nombre: "Almacén General", tipo: "general", tecnicoId: null, activo: true,
        }, { merge: true });
    }
    async function opsCrearAlmacenTecnico(db, fs, tecnicoId, nombreTecnico) {
        await fs.setDoc(fs.doc(db, COL_ALMACENES, tecnicoId), {
            nombre: nombreTecnico, tipo: "tecnico", tecnicoId, activo: true,
        }, { merge: true });
    }

    // Backfill: crea el almacén de cualquier técnico activo que ya existiera antes
    // de este cambio y todavía no tenga su ops_almacenes/{id}. Idempotente — se
    // puede correr las veces que haga falta, con merge:true no duplica nada.
    // Importa el equipo especializado que Glen listó (sep-2026): el banco de
    // trabajo físico de Saltillo y el equipo de calibración de TecnoLab (FOR-011,
    // Zaira) — ambos como ubicaciones físicas reales, no técnicos, para que la
    // revisión desde Flotilla tenga algo real que revisar en esos dos almacenes.
    window.opsImportarEquipoEspecializado = async function () {
        if (!confirm("Esto crea (si no existen) el 'Banco de trabajo 1 (Saltillo)' y el equipo de calibración de TecnoLab, con sus piezas. ¿Continuar?")) return;
        try {
            const { db, fs } = await opsGetFB();

            await fs.setDoc(fs.doc(db, COL_ALMACENES, "banco-trabajo-1-saltillo"), { nombre: "Banco de trabajo 1 (Saltillo)", tipo: "ubicacion", tecnicoId: null, activo: true, requiereAutorizacion: false }, { merge: true });
            await fs.setDoc(fs.doc(db, COL_ALMACENES, "tecnolab-cuarto-control"), { nombre: "TecnoLab — Cuarto de Control de Equipos", tipo: "ubicacion", tecnicoId: null, activo: true, requiereAutorizacion: true }, { merge: true });

            const saltillo = [
                "Demoledor 2", "Demoledor chico", "Compresor neumático", "Escalera chica 2",
                "Dron", 'Estación total (triple prisma)', "Zozo", 'Llave 36', 'Llave 24',
                'Tarraja 3/4', "Tarraja de pulgada",
            ];
            const tecnolab = [
                ["TEC-001", "Medidor de flujo másico", "Emerson Micro Motion", "CMF200M420NU", "455044"],
                ["TEC-002", "Medidor de flujo másico", "Emerson Micro Motion", "CMF300M425N2BAS2ZZ", "14054682"],
                ["TEC-003", "Medidor de desplazamiento positivo", "Liquid Controls", "M-30-1", "117105505"],
                ["TEC-004", "Estación total", "EFIX", "ETSR4", "604278"],
                ["TEC-005", "Termómetro de lectura directa (digital)", "Thermoprobe", "TP7-D", "7D-42427"],
                ["TEC-006", "Cinta plomada", "NOKA", "", ""],
                ["TEC-007", "Cinta plomada", "NOKA", "", ""],
                ["TEC-008", "Higrotermómetro", "LUTRON", "MHB-382SD", "AM.59932"],
                ["TEC-009", "Medidor de bajos valores de resistencia (probador de tierra)", "ETCR", "ETCR3100C", "3100240346"],
                ["TEC-010", "Telurómetro", "ETCR", "ETCR2100A+", "2101250764"],
                ["TEC-011", "Manovacuómetro digital", "Fande", "", "210707-1-5"],
                ["TEC-012", "Medida volumétrica 20L", "Volaimex", "JP20-1", "1901"],
                ["TEC-013", "Probeta de 380 mL", "", "", ""],
                ["TEC-014", "Densímetro ASTM 83H", "ALLA FRANCE", "ASTM 83H", "333284"],
                ["TEC-015", "Densímetro ASTM 85H", "ALLA FRANCE", "ASTM 85H", "351219"],
                ["TEC-016", "Densímetro ASTM 88H", "CHASE USA", "ASTM 88H", "247925"],
                ["TEC-017", "Probeta de 100 mL", "PYREX", "3025", ""],
                ["TEC-018", "Transmisor de presión estática", "ROSEMOUNT", "3051S1TA4A3A11A1AD A2E5M5Q4Q8T1", "0728330"],
                ["TEC-019", "Transmisor de temperatura", "ROSEMOUNT", "3144PD1A1E5M5T1C4Q4XA", "0865266"],
            ];

            let n = 0;
            for (const nombre of saltillo) {
                const folio = await opsSiguienteFolioHerramienta();
                await fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, folio), {
                    folio, descripcion: nombre, marca: "", modelo: "", categoria: "Equipo especializado",
                    numeroSerie: "", departamento: null, condicion: null, uso: null, peso: null, pesoUnidad: null, medida: null,
                    estado: "disponible", ubicacionActual: "Banco de trabajo 1 (Saltillo)", almacenId: "banco-trabajo-1-saltillo",
                    tecnicoActualId: null, fechaAsignacion: null, folioLegado: null, observaciones: null,
                    fechaAlta: opsHoy(), requiereAutorizacion: false,
                    externalId: null, sourceSystem: "manual", lastSync: null, syncStatus: "no_sincronizado",
                });
                n++;
            }
            for (const [tecId, nombre, marca, modelo, serie] of tecnolab) {
                const folio = await opsSiguienteFolioHerramienta();
                await fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, folio), {
                    folio, descripcion: nombre, marca, modelo, categoria: "Calibración TecnoLab",
                    numeroSerie: serie, departamento: null, condicion: null, uso: null, peso: null, pesoUnidad: null, medida: null,
                    estado: "disponible", ubicacionActual: "TecnoLab — Cuarto de Control de Equipos", almacenId: "tecnolab-cuarto-control",
                    tecnicoActualId: null, fechaAsignacion: null, folioLegado: tecId, observaciones: "Importado de FOR-011 (TecnoLab Ensayo y Calibración)",
                    fechaAlta: opsHoy(), requiereAutorizacion: true,
                    externalId: null, sourceSystem: "manual", lastSync: null, syncStatus: "no_sincronizado",
                });
                n++;
            }
            alert(`Listo — ${n} pieza(s) creada(s) en los dos almacenes nuevos.`);
        } catch (err) {
            console.error("[operaciones.js] error al importar equipo especializado:", err);
            alert("No se pudo importar: " + err.message);
        }
    };

    window.opsBackfillAlmacenes = async function () {
        const { db, fs } = await opsGetFB();
        await opsAsegurarAlmacenGeneral(db, fs);
        let n = 0;
        for (const t of cacheTec.filter(x => x.estatus === "activo")) {
            await opsCrearAlmacenTecnico(db, fs, t.id, t.nombre);
            n++;
        }
        alert(`Listo — Almacén General verificado y ${n} almacén(es) de técnico verificado(s)/creado(s).`);
    };

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
        if (unsubSurtPoll) { clearInterval(unsubSurtPoll); unsubSurtPoll = null; }
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
        catalogo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
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
            <div style="background:#1D2E73;border-bottom:3px solid #062F73;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:10px;color:#fff;">
                    <span style="width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${ICON.wrench}</span>
                    <div>
                        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;">Operaciones</div>
                        <div style="font-size:10.5px;color:#C7CEE0;">Hedma Tecnocontrol · Rol: ${rolLabel}</div>
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
        if (activo) { activo.style.color = "#1D2E73"; activo.style.background = "#E9ECF5"; activo.style.borderLeftColor = "#1D2E73"; }
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
        opsAsegurarAlmacenGeneral(db, fs).catch(err => console.warn("[operaciones.js] no se pudo asegurar el Almacén General:", err));
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
            // Antes escuchaba Firestore directo; `surtidos` ya vive en Supabase desde
            // la migración — mismo puente que ya usa almacen.js (tcSbSuscribirSurtidos),
            // con respaldo de sondeo cada 30s por si se pierde un evento en vivo.
            unsubSurt = window.tcSbSuscribirSurtidos(lista => {
                cacheSurtidos = lista || [];
                if (tabActual === "resumen") opsRenderResumen();
                if (tabActual === "solicitudes") opsRenderSolicitudes();
                if (tabActual === "alertas") opsRenderAlertas();
            }, err => { console.warn("[operaciones.js] error en suscripción de Supabase (surtidos):", err && err.message); });
            if (!unsubSurtPoll) {
                unsubSurtPoll = setInterval(() => {
                    if (window.tcSbListarTodosSurtidos) {
                        window.tcSbListarTodosSurtidos().then(lista => {
                            cacheSurtidos = lista || [];
                            if (tabActual === "resumen") opsRenderResumen();
                            if (tabActual === "solicitudes") opsRenderSolicitudes();
                            if (tabActual === "alertas") opsRenderAlertas();
                        }).catch(() => {});
                    }
                }, 30000);
            }
        }
        if (!unsubFolios) {
            unsubFolios = fs.onSnapshot(fs.collection(db, COL_FOLIOS), snap => {
                cacheFolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "folios") opsRenderFolios();
                if (tabActual === "resumen") opsRenderResumen();
                if (opsFoliosVigilanciaBase) opsVigilarFoliosSeveridad();
            }, () => { /* si aún no existe la colección, Folios simplemente inicia vacío */ });
        }
        if (!unsubTraspasos) {
            // Sin orderBy para no exigir un índice compuesto — el volumen de traspasos
            // pendientes a la vez es bajo, se ordena si hiciera falta en el cliente.
            unsubTraspasos = fs.onSnapshot(fs.query(fs.collection(db, COL_HERR_TRASPASOS), fs.where("estatus", "==", "Pendiente recepción")), snap => {
                cacheTraspasosPend = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "dashboard") opsRenderDashboard();
            }, () => { cacheTraspasosPend = []; });
        }
        if (!unsubConfigCalibracion) {
            unsubConfigCalibracion = fs.onSnapshot(fs.doc(db, COL_CONFIG_CALIBRACION, "general"), snap => {
                cacheAutorizadoresCalibracion = snap.exists() ? (snap.data().autorizadores || []) : [];
            }, () => { cacheAutorizadoresCalibracion = []; });
        }
        if (!unsubServiciosCatalogo) {
            unsubServiciosCatalogo = fs.onSnapshot(fs.collection(db, COL_SERVICIOS_CATALOGO), snap => {
                cacheServiciosCatalogo = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "servicios") opsRenderCatalogoRecetas();
            }, () => { cacheServiciosCatalogo = []; });
        }
        if (!unsubTarifasPersonal) {
            unsubTarifasPersonal = fs.onSnapshot(fs.collection(db, COL_TARIFAS_PERSONAL), snap => {
                cacheTarifasPersonal = {};
                snap.docs.forEach(d => { cacheTarifasPersonal[d.id] = d.data(); });
                if (tabActual === "servicios") opsRenderCatalogoRecetas();
            }, () => { cacheTarifasPersonal = {}; });
        }
        if (!unsubAusencias) {
            unsubAusencias = fs.onSnapshot(fs.collection(db, COL_AUSENCIAS), snap => {
                cacheAusencias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "tecnicos") opsRenderTecnicos();
                if (fichaTecActual) opsRenderFichaTecContenido(fichaTecActual);
            }, () => { cacheAusencias = []; });
        }
        if (!unsubAlmacenes) {
            unsubAlmacenes = fs.onSnapshot(fs.collection(db, COL_ALMACENES), snap => {
                cacheAlmacenes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "dashboard") opsRenderDashboard();
            }, () => { cacheAlmacenes = []; });
        }
        if (!unsubConfigRevision) {
            unsubConfigRevision = fs.onSnapshot(fs.doc(db, COL_CONFIG_REVISION, "general"), snap => {
                cacheRevisoresHerramienta = snap.exists() ? (snap.data().revisores || []) : [];
                if (tabActual === "dashboard") opsRenderDashboard();
            }, () => { cacheRevisoresHerramienta = []; });
        }
        if (!unsubRevisiones) {
            unsubRevisiones = fs.onSnapshot(fs.query(fs.collection(db, COL_REVISIONES), fs.orderBy("fecha", "desc"), fs.limit(150)), snap => {
                cacheRevisionesHerr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "dashboard" && vistaHerr === "revisiones") opsRenderDashboard();
            }, () => { cacheRevisionesHerr = []; });
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
                            opsMostrarFlotanteGenerica(n.mensaje || "Nueva notificación de Operaciones.", n.esPrueba ? "#8B4FD6" : "#1D2E73");
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
            const bg = activo ? "#1D2E73" : "#94a3b8";
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
            const color = { asignacion: "#0891b2", transferencia: "#0891b2", devolucion: "#059669", baja: "#E7402B", danio: "#E7402B", perdida: "#E7402B", reparacion: "#b45309" }[m.tipo] || "#64748b";
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
                    <div style="background:#1D2E73;border-radius:12px;padding:16px 18px;color:#fff;">
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
            { label: "Dañadas / extraviadas", valor: (conteo.danada || 0) + (conteo.extraviada || 0), color: "#E7402B", icon: ICON.alert },
            { label: "Dadas de baja", valor: conteo.baja || 0, color: "#6b7280", icon: ICON.trash },
        ];

        const gestion = opsPuedeGestionar();
        let lista = cacheHerr.slice();
        const b = filtroCat.busca.trim().toLowerCase();
        if (b) lista = lista.filter(h => (h.folio || "").toLowerCase().includes(b) || (h.descripcion || "").toLowerCase().includes(b) || (h.marca || "").toLowerCase().includes(b) || opsNombreTecnico(h.tecnicoActualId).toLowerCase().includes(b));
        if (filtroCat.categoria) lista = lista.filter(h => (h.categoria || "") === filtroCat.categoria);
        if (filtroCat.departamento) lista = lista.filter(h => (h.departamento || "") === filtroCat.departamento);
        if (filtroCat.estado) lista = lista.filter(h => (h.estado || "disponible") === filtroCat.estado);
        if (filtroCat.condicion) lista = lista.filter(h => (h.condicion || "") === filtroCat.condicion);

        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px;">
                ${kpis.map(k => `
                    <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:13px 15px;display:flex;align-items:center;gap:11px;">
                        <span style="width:32px;height:32px;border-radius:9px;background:${k.color}15;color:${k.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${k.icon}</span>
                        <div><div style="font-size:19px;font-weight:700;color:#1e293b;line-height:1;">${k.valor}</div><div style="font-size:10.5px;color:#64748b;margin-top:3px;">${k.label}</div></div>
                    </div>`).join("")}
            </div>
            <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">
                <div style="display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 13px;flex:1;min-width:240px;max-width:420px;">
                    <span style="color:#94a3b8;">${ICON.search}</span>
                    <input type="text" id="ops-herr-buscar" value="${opsEsc(filtroCat.busca)}" placeholder="Buscar por folio, descripción, marca o técnico..." oninput="opsFiltrarCatalogo('busca', this.value)" style="border:none;outline:none;font-size:12.5px;flex:1;">
                </div>
                <div style="display:flex;gap:8px;align-items:center;">
                    <div style="display:flex;background:#eef2f7;border-radius:9px;padding:3px;">
                        <button onclick="opsCambiarVistaHerr('almacen')" style="border:none;background:${vistaHerr === "almacen" ? "#1D2E73" : "transparent"};color:${vistaHerr === "almacen" ? "#fff" : "#475569"};padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Por almacén</button>
                        <button onclick="opsCambiarVistaHerr('tipo')" style="border:none;background:${vistaHerr === "tipo" ? "#1D2E73" : "transparent"};color:${vistaHerr === "tipo" ? "#fff" : "#475569"};padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Por tipo de artículo</button>
                        <button onclick="opsCambiarVistaHerr('revisiones')" style="border:none;background:${vistaHerr === "revisiones" ? "#1D2E73" : "transparent"};color:${vistaHerr === "revisiones" ? "#fff" : "#475569"};padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Revisiones</button>
                    </div>
                    ${gestion ? `<button onclick="opsAbrirConfigCalibracion()" title="Configurar quién autoriza equipo especializado" style="background:#eef2f7;border:none;color:#475569;width:32px;height:32px;border-radius:8px;cursor:pointer;">${ICON.lock}</button>` : ""}
                    ${gestion ? `<button onclick="opsAbrirConfigRevision()" title="Configurar quién puede revisar herramienta desde Flotilla" style="background:#eef2f7;border:none;color:#475569;width:32px;height:32px;border-radius:8px;cursor:pointer;">${ICON.search}</button>` : ""}
                    ${gestion ? `
                    <button onclick="opsAbrirModalPieza()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nueva pieza</button>
                    <button onclick="opsSembrarCatalogoBase()" class="mkt-add-btn" style="background:#334155;">${ICON.box} Cargar catálogo base</button>
                    <button onclick="opsImportarExcelReal()" class="mkt-add-btn" style="background:#15803D;">${ICON.file} Importar Excel real (12 técnicos)</button>` : ""}
                </div>
            </div>
            ${vistaHerr === "almacen" ? opsFragmentoVistaAlmacen() : (vistaHerr === "revisiones" ? opsFragmentoVistaRevisiones() : opsFragmentoVistaTipo(lista))}
        `;
    }

    function opsFilaHerramienta(h, i, gestion) {
        const e = ESTADOS_HERRAMIENTA[h.estado] || ESTADOS_HERRAMIENTA.disponible;
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        const pend = opsTraspasoPendientePara(h.id);
        return `<tr style="background:${zebra};border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsAbrirFichaHerramienta('${h.id}')">
            <td style="padding:8px 10px;font-weight:600;color:#334155;">${opsEsc(h.folio)}</td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(h.descripcion)}${h.folioLegado ? ` <span style="color:#94a3b8;font-size:10.5px;">(ex ${opsEsc(h.folioLegado)})</span>` : ""}</td>
            <td style="padding:8px 10px;"><span style="background:${e.bg};color:${e.fg};font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:999px;">${e.label}</span>${pend ? ` <span title="Traspaso pendiente de aceptación" style="background:#fef3c7;color:#92400e;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:4px;">${ICON.lock} pendiente</span>` : ""}</td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(opsNombreTecnico(h.tecnicoActualId))}</td>
            <td style="padding:8px 10px;color:#64748b;">${opsEsc(h.ubicacionActual || "—")}</td>
            <td style="padding:8px 10px;text-align:right;" onclick="event.stopPropagation()">
                ${gestion && h.estado !== "baja" ? `<button onclick="opsAbrirModalMovimiento('${h.id}')" style="background:#eef2f7;border:none;color:#1f2937;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">${pend ? "Ver traspaso" : "Mover"}</button>` : ""}
            </td>
        </tr>`;
    }

    // Los buscadores en vivo (Herramientas, Catálogo, Técnicos) re-dibujan todo
    // el contenido de la pestaña en cada tecla — sin esto, el <input> se
    // reemplaza a sí mismo y pierde el foco después de la primera letra
    // (parecía que "no servía"). Se restaura el foco y la posición del cursor
    // sobre el input recién dibujado, usando su id.
    function opsRerenderConFoco(renderFn) {
        const el = document.activeElement;
        const id = el && el.id;
        const selStart = el && typeof el.selectionStart === "number" ? el.selectionStart : null;
        const selEnd = el && typeof el.selectionEnd === "number" ? el.selectionEnd : null;
        renderFn();
        if (id) {
            const nuevo = document.getElementById(id);
            if (nuevo) {
                nuevo.focus();
                if (selStart !== null && nuevo.setSelectionRange) {
                    try { nuevo.setSelectionRange(selStart, selEnd); } catch (_e) { /* input sin soporte de selección (ej. type=number) */ }
                }
            }
        }
    }

    window.opsFiltrarHerr = function (v) { filtroHerr = v || ""; opsRerenderConFoco(opsRenderDashboard); };

    // ── Almacenes (Almacén General + uno por técnico) ──────────────
    // ── Vista unificada de Herramientas: Almacenes + Catálogo fusionados ──
    // Antes eran 3 pestañas mostrando la misma información de formas distintas.
    // Ahora es una sola pantalla con un selector de agrupación; el detalle de
    // cada almacén o cada tipo de artículo abre el mismo panel de piezas.
    let vistaHerr = "almacen"; // "almacen" | "tipo"
    window.opsCambiarVistaHerr = function (v) { vistaHerr = v; opsRenderDashboard(); };

    function opsThumb(h, size) {
        return h.fotoBase64
            ? `<img src="${h.fotoBase64}" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:7px;border:1px solid #e2e8f0;flex-shrink:0;">`
            : `<span style="width:${size}px;height:${size}px;border-radius:7px;background:#E9ECF5;color:#1D2E73;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${ICON.wrench}</span>`;
    }

    // ── Vista: Revisiones (checklists de herramienta, cualquier origen) ────
    function opsFragmentoVistaRevisiones() {
        if (!cacheRevisionesHerr.length) {
            return `<div style="padding:40px;text-align:center;color:#94a3b8;background:#fff;border-radius:14px;border:1px solid #e2e8f0;">Sin revisiones registradas todavía — se llenan solas en cuanto alguien use "Revisar herramienta" en el Portal o en Flotilla.</div>`;
        }
        return cacheRevisionesHerr.map(r => {
            const faltantes = (r.herramientas || []).filter(h => h.estado !== "conforme");
            const conFoto = (r.herramientas || []).filter(h => h.tieneFoto).length;
            return `<div style="background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;border-left:4px solid ${faltantes.length ? "#E7402B" : "#15803D"};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
                    <div>
                        <span style="font-size:12.5px;font-weight:700;color:#1e293b;">${opsEsc(r.tecnicoNombre || r.almacenNombre || "—")}</span>
                        <span style="font-size:10.5px;color:#94a3b8;margin-left:6px;">${opsEsc((r.fecha || "").slice(0, 16).replace("T", " "))}</span>
                        ${r.origen === "flotilla_movil_admin" ? '<span style="background:#E9ECF5;color:#1D2E73;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:6px;">Desde Flotilla</span>' : '<span style="background:#f1f5f9;color:#475569;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:6px;">Desde el Portal</span>'}
                    </div>
                    <span style="font-size:10.5px;font-weight:700;color:${faltantes.length ? "#E7402B" : "#166534"};">${faltantes.length ? `${faltantes.length} con novedad` : "Todo conforme"}</span>
                </div>
                <div style="font-size:11px;color:#94a3b8;margin:4px 0;">Revisó: ${opsEsc(r.realizadoPor || "—")} · ${(r.herramientas || []).length} pieza(s)${conFoto ? ` · ${conFoto} foto(s)` : ""}</div>
                ${r.observacionesGenerales ? `<div style="font-size:11.5px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:6px;">${opsEsc(r.observacionesGenerales)}</div>` : ""}
                <div style="margin-top:8px;text-align:right;">
                    <button id="ops-rev-share-${r.id}" onclick="opsCompartirRevisionPDF('${r.id}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">${ICON.file} PDF / WhatsApp</button>
                </div>
            </div>`;
        }).join("");
    }

    function opsFragmentoVistaAlmacen() {
        const enGeneral = cacheHerr.filter(h => !h.tecnicoActualId && !h.almacenId && h.estado !== "baja");
        const tecnicosActivos = cacheTec.filter(t => t.estatus === "activo");
        const ubicaciones = cacheAlmacenes.filter(a => a.tipo === "ubicacion" && a.activo !== false);
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div style="font-size:11px;color:#94a3b8;">${ubicaciones.length} ubicación(es) física(s) además del almacén general y los de técnico.</div>
                <div style="display:flex;gap:10px;">
                    <a href="javascript:void(0)" onclick="opsImportarEquipoEspecializado()" style="font-size:11px;color:#E7402B;font-weight:600;text-decoration:underline;">Importar Saltillo + TecnoLab</a>
                    <a href="javascript:void(0)" onclick="opsAbrirModalNuevaUbicacion()" style="font-size:11px;color:#1D2E73;font-weight:600;text-decoration:underline;">+ Nueva ubicación física</a>
                    <a href="javascript:void(0)" onclick="opsBackfillAlmacenes()" style="font-size:11px;color:#94a3b8;text-decoration:underline;">Verificar/crear almacenes faltantes</a>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;">
                <div onclick="opsAbrirAlmacenPiezas(null)" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;border-left:4px solid #1D2E73;padding:15px 16px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='#1D2E73'" onmouseout="this.style.borderLeftColor='#1D2E73';this.style.borderColor='#e2e8f0';this.style.borderLeftColor='#1D2E73'">
                    <div style="font-size:13.5px;font-weight:700;color:#1e293b;">Almacén General</div>
                    <div style="font-size:11px;color:#94a3b8;margin:2px 0 10px;">Sin técnico asignado</div>
                    <div style="display:flex;align-items:baseline;gap:5px;">
                        <span style="font-size:22px;font-weight:800;color:#1D2E73;">${enGeneral.length}</span>
                        <span style="font-size:11px;color:#64748b;">pieza(s)</span>
                    </div>
                </div>
                ${ubicaciones.map(a => {
                    const n = cacheHerr.filter(h => h.almacenId === a.id && !h.tecnicoActualId && h.estado !== "baja").length;
                    return `<div onclick="opsAbrirAlmacenPiezas('${a.id}')" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;border-left:4px solid #E7402B;padding:15px 16px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='#1D2E73'" onmouseout="this.style.borderColor='#e2e8f0'">
                        <div style="font-size:13.5px;font-weight:700;color:#1e293b;">${opsEsc(a.nombre)}</div>
                        <div style="font-size:11px;color:#94a3b8;margin:2px 0 10px;">Ubicación física${a.requiereAutorizacion ? " · requiere autorización" : ""}</div>
                        <div style="display:flex;align-items:baseline;gap:5px;">
                            <span style="font-size:22px;font-weight:800;color:#1e293b;">${n}</span>
                            <span style="font-size:11px;color:#64748b;">pieza(s)</span>
                        </div>
                    </div>`;
                }).join("")}
                ${tecnicosActivos.map(t => {
                    const n = cacheHerr.filter(h => h.tecnicoActualId === t.id && h.estado !== "baja").length;
                    return `<div onclick="opsAbrirAlmacenPiezas('${t.id}')" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:15px 16px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='#1D2E73'" onmouseout="this.style.borderColor='#e2e8f0'">
                        <div style="font-size:13.5px;font-weight:700;color:#1e293b;">${opsEsc(t.nombre)}</div>
                        <div style="font-size:11px;color:#94a3b8;margin:2px 0 10px;">N.° ${opsEsc(t.numeroOperativo)}</div>
                        <div style="display:flex;align-items:baseline;gap:5px;">
                            <span style="font-size:22px;font-weight:800;color:#1e293b;">${n}</span>
                            <span style="font-size:11px;color:#64748b;">pieza(s)</span>
                        </div>
                    </div>`;
                }).join("")}
            </div>`;
    }

    window.opsAbrirModalNuevaUbicacion = function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:360px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">Nueva ubicación física</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre</label>
                <input id="ops-in-ubic-nombre" placeholder="Ej. Banco de trabajo 1 (Saltillo)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:#334155;cursor:pointer;margin-bottom:16px;">
                    <input type="checkbox" id="ops-in-ubic-autorizacion" style="width:15px;height:15px;">
                    Requiere autorización previa para mover herramienta de aquí
                </label>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsCrearUbicacion()" class="mkt-add-btn" style="background:#1D2E73;">Crear</button>
                </div>
            </div>
        </div>`;
    };
    window.opsCrearUbicacion = async function () {
        const nombre = document.getElementById("ops-in-ubic-nombre").value.trim();
        if (!nombre) { alert("Captura el nombre"); return; }
        const requiereAutorizacion = document.getElementById("ops-in-ubic-autorizacion").checked;
        try {
            const { db, fs } = await opsGetFB();
            const id = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            await fs.setDoc(fs.doc(db, COL_ALMACENES, id), { nombre, tipo: "ubicacion", tecnicoId: null, activo: true, requiereAutorizacion }, { merge: true });
            document.getElementById("ops-modal-wrap").innerHTML = "";
        } catch (err) {
            alert("No se pudo crear: " + err.message);
        }
    };

    // ── Panel: piezas de un almacén (General o de un técnico) ─────
    window.opsAbrirAlmacenPiezas = function (almacenId) {
        const ubicacion = almacenId ? cacheAlmacenes.find(a => a.id === almacenId && a.tipo === "ubicacion") : null;
        const esTecnico = almacenId && !ubicacion;
        const piezas = cacheHerr.filter(h => {
            if (h.estado === "baja") return false;
            if (esTecnico) return h.tecnicoActualId === almacenId;
            if (ubicacion) return !h.tecnicoActualId && h.almacenId === almacenId;
            return !h.tecnicoActualId && !h.almacenId; // Almacén General
        }).sort((a, b) => (a.folio || "").localeCompare(b.folio || ""));
        const nombre = esTecnico ? opsNombreTecnico(almacenId) : (ubicacion ? ubicacion.nombre : "Almacén General");
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:460px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(nombre)}</div>
                        <div style="font-size:11.5px;color:#94a3b8;">${piezas.length} pieza(s)</div>
                    </div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                ${piezas.length ? piezas.map(h => {
                    const e = ESTADOS_HERRAMIENTA[h.estado] || ESTADOS_HERRAMIENTA.disponible;
                    return `<div onclick="opsAbrirFichaHerramienta('${h.id}')" style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;display:flex;gap:10px;align-items:center;">
                        ${opsThumb(h, 38)}
                        <div style="min-width:0;flex:1;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:12.5px;font-weight:700;color:#334155;">${opsEsc(h.folio)}</span>
                                <span style="background:${e.bg};color:${e.fg};font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;">${e.label}</span>
                            </div>
                            <div style="font-size:11.5px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opsEsc(h.descripcion)}</div>
                        </div>
                    </div>`;
                }).join("") : '<div style="color:#94a3b8;font-size:12px;padding:10px 0;">Sin piezas en este almacén.</div>'}
            </div>
        </div>`;
    };

    // ── Catálogo agrupado (vista "por tipo de artículo") ────────────
    // No cambia el modelo de datos: sigue siendo un folio por pieza física
    // (trazabilidad completa por unidad). Esto solo AGRUPA esas piezas por
    // descripción para mostrar, ej., "Juego de dados: 31 en sistema" con
    // el desglose de cuántas tiene cada almacén técnico — como pidió Glen.
    let cacheGruposCatalogo = [];

    function opsClaveCatalogo(desc) {
        return (desc || "").trim().toUpperCase().replace(/\s+/g, " ");
    }

    function opsAgruparCatalogo(lista) {
        const grupos = new Map();
        lista.forEach(h => {
            const clave = opsClaveCatalogo(h.descripcion);
            if (!clave) return;
            if (!grupos.has(clave)) grupos.set(clave, { descripcion: h.descripcion, categoria: h.categoria || "", piezas: [] });
            grupos.get(clave).piezas.push(h);
        });
        return Array.from(grupos.values()).sort((a, b) => b.piezas.length - a.piezas.length || a.descripcion.localeCompare(b.descripcion));
    }

    window.opsFiltrarCatalogo = function (campo, valor) { filtroCat[campo] = valor; opsRerenderConFoco(opsRenderDashboard); };
    window.opsLimpiarFiltrosCatalogo = function () {
        filtroCat = { busca: filtroCat.busca, categoria: "", departamento: "", estado: "", condicion: "" };
        opsRenderDashboard();
    };

    function opsFragmentoVistaTipo(lista) {
        const categorias = [...new Set(cacheHerr.map(h => (h.categoria || "").trim()).filter(Boolean))].sort();
        cacheGruposCatalogo = opsAgruparCatalogo(lista);

        const selFiltro = (id, campo, opciones, valorActual) => `
            <select id="${id}" onchange="opsFiltrarCatalogo('${campo}', this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:12px;margin:4px 0 12px;background:#fff;">
                <option value="">Todos</option>
                ${opciones.map(o => `<option value="${opsEsc(o)}" ${valorActual === o ? "selected" : ""}>${opsEsc(o)}</option>`).join("")}
            </select>`;
        const selFiltroEstado = (valorActual) => `
            <select id="ops-cat-f-estado" onchange="opsFiltrarCatalogo('estado', this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:12px;margin:4px 0 12px;background:#fff;">
                <option value="">Todos</option>
                ${Object.keys(ESTADOS_HERRAMIENTA).map(k => `<option value="${k}" ${valorActual === k ? "selected" : ""}>${ESTADOS_HERRAMIENTA[k].label}</option>`).join("")}
            </select>`;
        const selFiltroCondicion = (valorActual) => `
            <select id="ops-cat-f-cond" onchange="opsFiltrarCatalogo('condicion', this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:12px;margin:4px 0 12px;background:#fff;">
                <option value="">Todas</option>
                ${Object.keys(CONDICIONES_HERRAMIENTA).map(k => `<option value="${k}" ${valorActual === k ? "selected" : ""}>${CONDICIONES_HERRAMIENTA[k].label}</option>`).join("")}
            </select>`;

        return `
            <div style="display:flex;gap:18px;align-items:flex-start;">
                <div style="width:200px;flex-shrink:0;background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px;">
                    <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px;">Categoría</div>
                    ${selFiltro("ops-cat-f-categoria", "categoria", categorias, filtroCat.categoria)}
                    <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px;">Departamento</div>
                    ${selFiltro("ops-cat-f-depto", "departamento", DEPARTAMENTOS_HERRAMIENTA, filtroCat.departamento)}
                    <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px;">Estado</div>
                    ${selFiltroEstado(filtroCat.estado)}
                    <div style="font-size:12px;font-weight:700;color:#1e293b;margin-bottom:2px;">Condición</div>
                    ${selFiltroCondicion(filtroCat.condicion)}
                    <button onclick="opsLimpiarFiltrosCatalogo()" style="width:100%;background:#f1f5f9;border:none;color:#475569;padding:8px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;margin-top:2px;">Limpiar filtros</button>
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:11px;color:#94a3b8;font-weight:600;margin-bottom:10px;">${cacheGruposCatalogo.length} artículo(s) · ${lista.length} pieza(s)</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
                        ${cacheGruposCatalogo.length ? cacheGruposCatalogo.map((g, i) => opsCardCatalogo(g, i)).join("") : `<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8;background:#fff;border-radius:14px;border:1px solid #e2e8f0;">Sin artículos que coincidan con el filtro.</div>`}
                    </div>
                </div>
            </div>`;
    }

    function opsCardCatalogo(g, idx) {
        const total = g.piezas.length;
        const enAlmacen = g.piezas.filter(p => !p.tecnicoActualId).length;
        const porTecnico = new Map();
        g.piezas.forEach(p => {
            if (!p.tecnicoActualId) return;
            porTecnico.set(p.tecnicoActualId, (porTecnico.get(p.tecnicoActualId) || 0) + 1);
        });
        const filasTec = Array.from(porTecnico.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
        const masOtros = porTecnico.size - filasTec.length;
        const condMuestra = g.piezas.find(p => p.condicion) ? g.piezas.find(p => p.condicion).condicion : null;
        const cond = condMuestra ? CONDICIONES_HERRAMIENTA[condMuestra] : null;
        const conFoto = g.piezas.find(p => p.fotoBase64);

        return `<div onclick="opsAbrirGrupoCatalogo(${idx})" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:15px 16px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='#1D2E73'" onmouseout="this.style.borderColor='#e2e8f0'">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div style="font-size:13.5px;font-weight:700;color:#1e293b;line-height:1.3;">${opsEsc(g.descripcion)}</div>
                ${opsThumb(conFoto || {}, 34)}
            </div>
            <div style="font-size:11px;color:#94a3b8;margin:2px 0 10px;">${opsEsc(g.categoria || "Sin categoría")}${cond ? ` · <span style="color:${cond.fg};font-weight:600;">${cond.label}</span>` : ""}</div>
            <div style="display:flex;align-items:baseline;gap:5px;margin-bottom:10px;">
                <span style="font-size:22px;font-weight:800;color:#1e293b;">${total}</span>
                <span style="font-size:11px;color:#64748b;">en sistema</span>
            </div>
            <div style="border-top:1px solid #f1f5f9;padding-top:9px;">
                <div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px;">Almacén técnico</div>
                ${filasTec.length ? filasTec.map(([tecId, n]) => `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:11.5px;color:#334155;">${opsEsc(opsNombreTecnico(tecId))}</span>
                        <span style="font-size:11.5px;font-weight:700;color:#1e293b;">${n}</span>
                    </div>`).join("") : '<div style="font-size:11px;color:#cbd5e1;">Ninguno asignado.</div>'}
                ${masOtros > 0 ? `<div style="font-size:10.5px;color:#94a3b8;">+${masOtros} técnico(s) más</div>` : ""}
                ${enAlmacen ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;padding-top:4px;border-top:1px dashed #eef1f5;"><span style="font-size:11.5px;color:#64748b;">Sin asignar (almacén)</span><span style="font-size:11.5px;font-weight:700;color:#64748b;">${enAlmacen}</span></div>` : ""}
            </div>
        </div>`;
    }

    // ── Panel: piezas individuales de un artículo del catálogo ─────
    window.opsAbrirGrupoCatalogo = function (idx) {
        const g = cacheGruposCatalogo[idx];
        if (!g || !g.piezas.length) return;
        const piezas = g.piezas.slice().sort((a, b) => (a.folio || "").localeCompare(b.folio || ""));
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:460px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                    <div>
                        <div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(piezas[0].descripcion)}</div>
                        <div style="font-size:11.5px;color:#94a3b8;">${piezas.length} pieza(s) en sistema</div>
                    </div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                ${piezas.map(h => {
                    const e = ESTADOS_HERRAMIENTA[h.estado] || ESTADOS_HERRAMIENTA.disponible;
                    return `<div onclick="opsAbrirFichaHerramienta('${h.id}')" style="border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin-bottom:8px;cursor:pointer;display:flex;gap:10px;align-items:center;">
                        ${opsThumb(h, 38)}
                        <div style="min-width:0;flex:1;">
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-size:12.5px;font-weight:700;color:#334155;">${opsEsc(h.folio)}</span>
                                <span style="background:${e.bg};color:${e.fg};font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;">${e.label}</span>
                            </div>
                            <div style="font-size:11.5px;color:#64748b;margin-top:3px;">${opsEsc(opsNombreTecnico(h.tecnicoActualId))} · ${opsEsc(h.ubicacionActual || "—")}</div>
                        </div>
                    </div>`;
                }).join("")}
            </div>
        </div>`;
    };

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

                <div style="margin:12px 0;">
                    ${h.fotoBase64
                        ? `<img id="ops-ficha-foto-img" src="${h.fotoBase64}" style="width:100%;height:170px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;display:block;">`
                        : `<div id="ops-ficha-foto-img" style="width:100%;height:110px;border-radius:10px;background:#E9ECF5;color:#1D2E73;display:flex;align-items:center;justify-content:center;">${ICON.wrench}</div>`}
                    ${gestion ? `
                    <label style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;font-size:11.5px;font-weight:600;color:#1D2E73;background:#E9ECF5;padding:7px 10px;border-radius:8px;cursor:pointer;">
                        ${ICON.camera} ${h.fotoBase64 ? "Cambiar foto" : "Agregar foto"}
                        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="opsSubirFotoHerramienta('${id}', this)">
                    </label>
                    <span id="ops-ficha-foto-estado" style="font-size:10.5px;color:#94a3b8;display:block;text-align:center;margin-top:3px;"></span>` : ""}
                </div>

                <span style="background:${e.bg};color:${e.fg};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;">${e.label}</span>
                ${h.condicion && CONDICIONES_HERRAMIENTA[h.condicion] ? `<span style="background:${CONDICIONES_HERRAMIENTA[h.condicion].bg};color:${CONDICIONES_HERRAMIENTA[h.condicion].fg};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-left:6px;">${CONDICIONES_HERRAMIENTA[h.condicion].label}</span>` : ""}
                ${h.requiereAutorizacion ? `<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;margin-left:6px;">${ICON.lock} Requiere autorización</span>` : ""}

                <div style="margin-top:16px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Categoría:</strong> ${opsEsc(h.categoria || "—")}</div>
                    <div><strong>Marca / modelo:</strong> ${opsEsc(h.marca || "—")} ${opsEsc(h.modelo || "")}</div>
                    <div><strong>N.° de serie:</strong> ${opsEsc(h.numeroSerie || "—")}</div>
                    <div><strong>Departamento:</strong> ${opsEsc(h.departamento || "—")}</div>
                    <div><strong>Uso:</strong> ${opsEsc(h.uso || "—")}</div>
                    <div><strong>Peso:</strong> ${h.peso != null ? opsEsc(h.peso) + " " + opsEsc(h.pesoUnidad || "") : "—"}</div>
                    <div><strong>Medida:</strong> ${opsEsc(h.medida || "—")}</div>
                    <div><strong>Ubicación actual:</strong> ${opsEsc(h.ubicacionActual || "—")}</div>
                    <div><strong>Técnico asignado:</strong> ${opsEsc(opsNombreTecnico(h.tecnicoActualId))}</div>
                    ${h.fechaAsignacion ? `<div><strong>Fecha de asignación:</strong> ${opsEsc(h.fechaAsignacion)}</div>` : ""}
                    ${h.folioLegado ? `<div><strong>Folio legado (migración):</strong> ${opsEsc(h.folioLegado)}</div>` : ""}
                    ${h.origenRequisicionFolio ? `<div><strong>Origen:</strong> Requisición de compra #${opsEsc(h.origenRequisicionFolio)}</div>` : ""}
                    ${h.observaciones ? `<div><strong>Observaciones:</strong> ${opsEsc(h.observaciones)}</div>` : ""}
                </div>

                ${gestion && h.estado !== "baja" ? `
                <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="opsAbrirModalMovimiento('${id}')" class="mkt-add-btn" style="background:#1D2E73;">${opsTraspasoPendientePara(id) ? `${ICON.lock} Ver traspaso pendiente` : "Registrar movimiento"}</button>
                    ${h.estado === "asignada" ? `<button onclick="opsGenerarResponsivaPDF('${id}')" class="mkt-add-btn" style="background:#334155;">Regenerar responsiva PDF</button>` : ""}
                    <button onclick="opsAbrirModalBaja('${id}')" class="mkt-add-btn" style="background:#E7402B;">${ICON.trash} Dar de baja</button>
                </div>` : ""}

                <div style="margin-top:22px;font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;">${ICON.clock} Historial de movimientos</div>
                <div style="margin-top:10px;border-left:2px solid #e2e8f0;padding-left:14px;">
                    ${historial.length ? historial.map(m => opsTimelineItem(m)).join("") : '<div style="color:#94a3b8;font-size:12px;padding:6px 0;">Sin movimientos registrados.</div>'}
                </div>
            </div>
        </div>`;
    };

    window.opsSubirFotoHerramienta = async function (id, inputEl) {
        const file = inputEl.files && inputEl.files[0];
        if (!file) return;
        const estadoEl = document.getElementById("ops-ficha-foto-estado");
        if (estadoEl) estadoEl.textContent = "Procesando...";
        try {
            const dataUrl = await opsComprimirImagenBase64(file, 700, 0.6);
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_HERRAMIENTAS, id), { fotoBase64: dataUrl });
            const idx = cacheHerr.findIndex(x => x.id === id);
            if (idx >= 0) cacheHerr[idx].fotoBase64 = dataUrl;
            const img = document.getElementById("ops-ficha-foto-img");
            if (img && img.tagName === "IMG") { img.src = dataUrl; }
            else if (img) { img.outerHTML = `<img id="ops-ficha-foto-img" src="${dataUrl}" style="width:100%;height:170px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;display:block;">`; }
            if (estadoEl) estadoEl.textContent = "Foto guardada";
        } catch (err) {
            console.error("[operaciones.js] error al guardar foto de herramienta:", err);
            if (estadoEl) estadoEl.textContent = "Error al guardar la foto (revisa que no sea muy pesada)";
        }
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
    // Se llena al buscar una requisición de compra en el modal de alta; vive
    // solo mientras el modal está abierto (igual que opsRevisionFotos).
    let opsRequisicionSeleccionada = null;

    window.opsAbrirModalPieza = function () {
        opsRequisicionSeleccionada = null;
        const tecnicosActivos = cacheTec.filter(t => t.estatus === "activo");
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;max-height:90vh;overflow-y:auto;padding:22px;">
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
                <input id="ops-in-serie" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Departamento</label>
                    <select id="ops-in-depto" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        <option value="">— Selecciona —</option>
                        ${DEPARTAMENTOS_HERRAMIENTA.map(d => `<option value="${opsEsc(d)}">${opsEsc(d)}</option>`).join("")}
                    </select></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Condición</label>
                    <select id="ops-in-cond" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        ${Object.keys(CONDICIONES_HERRAMIENTA).map(k => `<option value="${k}">${CONDICIONES_HERRAMIENTA[k].label}</option>`).join("")}
                    </select></div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Uso / para qué sirve (opcional)</label>
                <input id="ops-in-uso" placeholder="Ej. Apriete de tuercas hidráulicas" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Peso (opcional)</label>
                        <div style="display:flex;gap:6px;">
                            <input id="ops-in-peso" type="number" step="0.01" min="0" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                            <select id="ops-in-peso-unidad" style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 6px;font-size:13px;margin:4px 0 10px;">
                                ${UNIDADES_PESO.map(u => `<option value="${u}">${u}</option>`).join("")}
                            </select>
                        </div>
                    </div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Medida (opcional)</label>
                    <input id="ops-in-medida" placeholder="Ej. 45 x 12 x 8 cm" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>

                <div style="border-top:1px dashed #e2e8f0;margin:12px 0 10px;padding-top:10px;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Requisición de compra de origen (opcional)</label>
                    <div style="display:flex;gap:6px;margin:4px 0 4px;">
                        <input id="ops-in-requi-folio" placeholder="Folio de la requisición" style="flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                        <button type="button" onclick="opsBuscarRequisicionParaAlta()" style="background:#eef2f7;border:none;color:#1f2937;padding:0 12px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;">Buscar</button>
                    </div>
                    <div id="ops-requi-resultado" style="font-size:11px;color:#94a3b8;margin-bottom:8px;min-height:14px;"></div>

                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Asignar de inmediato a técnico (opcional)</label>
                    <select id="ops-in-tecnico-destino" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;">
                        <option value="">— Sin asignar (queda disponible en almacén) —</option>
                        ${tecnicosActivos.map(t => `<option value="${t.id}">${opsEsc(t.nombre)} (${opsEsc(t.numeroOperativo)})</option>`).join("")}
                    </select>

                    <label style="display:flex;align-items:center;gap:7px;margin-top:8px;font-size:12px;color:#334155;cursor:pointer;">
                        <input type="checkbox" id="ops-in-requiere-autorizacion" style="width:15px;height:15px;">
                        Requiere autorización previa para asignarse/traspasarse (ej. equipo de calibración)
                    </label>
                </div>

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button id="ops-pieza-btn-guardar" onclick="opsGuardarPieza()" class="mkt-add-btn" style="background:#1D2E73;">Generar folio y guardar</button>
                </div>
            </div>
        </div>`;
    };

    // Busca la requisición por folio en Compras. Si tu módulo de Compras no
    // guarda el campo con el nombre exacto "folio", ajusta el fs.where() de
    // abajo — el resto del flujo no depende de más campos que ese.
    window.opsBuscarRequisicionParaAlta = async function () {
        const folio = document.getElementById("ops-in-requi-folio").value.trim();
        const resEl = document.getElementById("ops-requi-resultado");
        opsRequisicionSeleccionada = null;
        if (!folio) { resEl.textContent = ""; return; }
        resEl.textContent = "Buscando...";
        try {
            const { db, fs } = await opsGetFB();
            const snap = await fs.getDocs(fs.query(fs.collection(db, "requisiciones_compra"), fs.where("folio", "==", folio)));
            if (snap.empty) {
                resEl.innerHTML = `<span style="color:#E7402B;">No se encontró una requisición con ese folio.</span>`;
                return;
            }
            const d = snap.docs[0];
            const data = d.data();
            opsRequisicionSeleccionada = { id: d.id, folio: data.folio || folio };
            resEl.innerHTML = `<span style="color:#166534;">✓ Vinculada a requisición ${opsEsc(opsRequisicionSeleccionada.folio)}${data.proveedor ? " · " + opsEsc(data.proveedor) : ""}</span>`;
        } catch (err) {
            console.error("[operaciones.js] error al buscar requisición de compra:", err);
            resEl.innerHTML = `<span style="color:#E7402B;">Error al buscar. Revisa el nombre del campo "folio" en Compras.</span>`;
        }
    };

    window.opsGuardarPieza = async function () {
        const descripcion = document.getElementById("ops-in-desc").value.trim();
        if (!descripcion) { alert("La descripción es obligatoria"); return; }
        const btnGuardar = document.getElementById("ops-pieza-btn-guardar");
        if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = "Guardando..."; }
        try {
            const marca = document.getElementById("ops-in-marca").value.trim();
            const modelo = document.getElementById("ops-in-modelo").value.trim();
            const categoria = document.getElementById("ops-in-cat").value.trim();
            const numeroSerie = document.getElementById("ops-in-serie").value.trim();
            const departamento = document.getElementById("ops-in-depto").value || null;
            const condicion = document.getElementById("ops-in-cond").value || null;
            const uso = document.getElementById("ops-in-uso").value.trim() || null;
            const pesoVal = document.getElementById("ops-in-peso").value;
            const peso = pesoVal ? Number(pesoVal) : null;
            const pesoUnidad = peso !== null ? document.getElementById("ops-in-peso-unidad").value : null;
            const medida = document.getElementById("ops-in-medida").value.trim() || null;
            const tecnicoDestinoId = document.getElementById("ops-in-tecnico-destino").value || null;
            const requiereAutorizacion = document.getElementById("ops-in-requiere-autorizacion").checked;
            const { db, fs } = await opsGetFB();
            const folio = await opsSiguienteFolioHerramienta();

            await fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, folio), {
                folio, descripcion, marca, modelo, categoria, numeroSerie,
                departamento, condicion, uso, peso, pesoUnidad, medida,
                estado: tecnicoDestinoId ? "asignada" : "disponible",
                ubicacionActual: UBICACIONES[0],
                tecnicoActualId: tecnicoDestinoId,
                fechaAsignacion: tecnicoDestinoId ? opsHoy() : null,
                folioLegado: null, observaciones: null,
                fechaAlta: opsHoy(),
                origenRequisicionId: opsRequisicionSeleccionada ? opsRequisicionSeleccionada.id : null,
                origenRequisicionFolio: opsRequisicionSeleccionada ? opsRequisicionSeleccionada.folio : null,
                requiereAutorizacion,
                externalId: null, sourceSystem: "manual", lastSync: null, syncStatus: "no_sincronizado",
            });
            await opsRegistrarMovimiento({
                herramientaId: folio, tipo: "alta", ubicacionNueva: UBICACIONES[0],
                tecnicoNuevoId: tecnicoDestinoId || null,
                observaciones: opsRequisicionSeleccionada ? `Origen: requisición de compra ${opsRequisicionSeleccionada.folio}` : null,
            });

            // Cierra el círculo del lado de Compras: la requisición queda marcada
            // con la pieza (folio) que resultó de ella y a quién se le entregó.
            // Solo escribe campos NUEVOS — no toca nada que ya use compras.js.
            if (opsRequisicionSeleccionada) {
                try {
                    await fs.updateDoc(fs.doc(db, "requisiciones_compra", opsRequisicionSeleccionada.id), {
                        herramientaId: folio,
                        herramientaDescripcion: descripcion,
                        herramientaAltaFecha: opsHoy(),
                        herramientaTecnicoDestinoId: tecnicoDestinoId || null,
                    });
                } catch (err) {
                    console.error("[operaciones.js] no se pudo actualizar la requisición de origen:", err);
                }
            }

            if (tecnicoDestinoId) {
                // opsGenerarResponsivaPDF lee de cacheHerr, que aún no tiene esta pieza
                // recién creada (el onSnapshot tarda unos ms) — se agrega en caliente,
                // igual que ya hace opsConfirmarMovimiento antes de generar el PDF.
                cacheHerr.push({
                    id: folio, folio, descripcion, marca, modelo, categoria, numeroSerie,
                    estado: "asignada", ubicacionActual: UBICACIONES[0],
                    tecnicoActualId: tecnicoDestinoId, fechaAsignacion: opsHoy(),
                });
                try { opsGenerarResponsivaPDF(folio, true); }
                catch (err) { console.error("[operaciones.js] la pieza se guardó, pero falló la responsiva PDF:", err); }
            }
            opsRequisicionSeleccionada = null;
            document.getElementById("ops-modal-wrap").innerHTML = "";
        } catch (err) {
            console.error("[operaciones.js] error al guardar la pieza:", err);
            alert("No se pudo guardar la pieza: " + (err && err.message ? err.message : err) + "\n\nRevisa la consola del navegador (F12) para más detalle — probablemente sea un problema de permisos en Firestore.");
            if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = "Generar folio y guardar"; }
        }
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
                await opsCrearAlmacenTecnico(db, fs, tecnicoId, tec.nombre);
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

        // Pieza con traspaso pendiente de aceptación: no se abre el formulario
        // normal — solo se puede ver el estatus o cancelarlo. Así "no se puede
        // saltar" la herramienta mientras el otro técnico no haya respondido.
        const pend = opsTraspasoPendientePara(herramientaId);
        if (pend) { return opsAbrirModalTraspasoPendiente(herramientaId, pend); }

        // Equipo que requiere autorización previa (ej. calibración TecnoLab):
        // si quien intenta moverlo no está en la lista, no ve el formulario —
        // solo puede pedir autorización a quien sí puede.
        if (h.requiereAutorizacion && !opsEsAutorizadorCalibracion()) {
            const wrap = document.getElementById("ops-modal-wrap");
            wrap.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
                <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                    <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">${ICON.lock} Requiere autorización</div>
                    <div style="font-size:12px;color:#64748b;margin-bottom:14px;">${opsEsc(h.folio)} · ${opsEsc(h.descripcion)}</div>
                    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:11px 13px;font-size:12.5px;color:#92400e;margin-bottom:16px;">
                        Esta pieza solo la puede mover/asignar/traspasar: ${cacheAutorizadoresCalibracion.length ? opsEsc(cacheAutorizadoresCalibracion.map(a => a.nombre || a.email).join(", ")) : "un Administrador (no hay autorizadores adicionales configurados)"}.
                    </div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                        <button onclick="opsSolicitarAutorizacion('${herramientaId}')" style="background:#1D2E73;color:#fff;border:none;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Solicitar autorización</button>
                    </div>
                </div>
            </div>`;
            return;
        }

        const tecnicosActivos = cacheTec.filter(t => t.estatus === "activo");
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;max-height:90vh;overflow-y:auto;padding:22px;">
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
                        ${tecnicosActivos.map(t => `<option value="${t.id}">${opsEsc(t.nombre)} (${opsEsc(t.numeroOperativo)})${t.correo ? "" : " — sin correo"}</option>`).join("")}
                    </select>
                </div>

                <div id="ops-campo-transferencia-info" style="display:none;background:#EDF0F7;border:1px solid #C7CEE0;border-radius:8px;padding:9px 11px;font-size:11px;color:#1D2E73;margin-bottom:12px;line-height:1.5;">
                    Esto NO mueve la pieza de inmediato: se envía un traspaso que el técnico receptor debe <strong>aceptar desde Flotilla</strong> (igual que un vehículo). Mientras tanto la pieza queda bloqueada.
                </div>

                <div id="ops-campo-ubicacion" style="display:none;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nueva ubicación</label>
                    <select id="ops-in-ubicacion" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                        ${UBICACIONES.map(u => `<option value="${opsEsc(u)}">${opsEsc(u)}</option>`).join("")}
                    </select>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Condición / observaciones</label>
                <textarea id="ops-in-obs" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;resize:vertical;"></textarea>

                <div id="ops-campo-evidencia-transferencia" style="display:none;margin-bottom:6px;">
                    <label style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#1D2E73;background:#E9ECF5;padding:6px 10px;border-radius:7px;cursor:pointer;width:fit-content;">
                        ${ICON.camera} Adjuntar foto de evidencia (opcional)
                        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="opsSeleccionarFotoTraspaso(this)">
                    </label>
                    <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                        <img id="ops-traspaso-thumb" style="display:none;width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;">
                        <span id="ops-traspaso-foto-estado" style="font-size:10.5px;color:#94a3b8;"></span>
                    </div>
                </div>

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button id="ops-mov-btn-confirmar" onclick="opsConfirmarMovimiento('${herramientaId}')" class="mkt-add-btn" style="background:#1D2E73;">Confirmar</button>
                </div>
            </div>
        </div>`;
        opsToggleCamposMovimiento();
    };

    // Info de solo-lectura + botón para cancelar, cuando la pieza ya tiene un
    // traspaso pendiente de aceptación — así nadie más puede "brincarse" el
    // paso de que el receptor acepte.
    function opsAbrirModalTraspasoPendiente(herramientaId, pend) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        const wrap = document.getElementById("ops-modal-wrap");
        const venceTxt = pend.venceEn ? new Date(pend.venceEn).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">${ICON.lock} Traspaso pendiente</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:14px;">${opsEsc(h ? h.folio : "")} · ${opsEsc(h ? h.descripcion : "")}</div>
                <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:11px 13px;font-size:12.5px;color:#92400e;line-height:1.7;margin-bottom:16px;">
                    <div><strong>De:</strong> ${opsEsc(pend.entregaNombre || "—")}</div>
                    <div><strong>Para:</strong> ${opsEsc(pend.receptorNombre || "—")}</div>
                    <div><strong>Vence:</strong> ${venceTxt}</div>
                    <div style="margin-top:4px;">Esta pieza está bloqueada hasta que ${opsEsc((pend.receptorNombre || "el receptor").split(" ")[0])} la acepte o la rechace desde Flotilla — o hasta que canceles el traspaso aquí.</div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                    <button onclick="opsCancelarTraspasoPendiente('${pend.id}')" style="background:#E7402B;color:#fff;border:none;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar traspaso</button>
                </div>
            </div>
        </div>`;
    }

    window.opsCancelarTraspasoPendiente = async function (traspasoId) {
        if (!confirm("¿Cancelar este traspaso? El técnico que lo inició deberá volver a intentarlo si aún quiere transferir la pieza.")) return;
        try {
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_HERR_TRASPASOS, traspasoId), {
                estatus: "Cancelado", canceladoEn: opsFechaHora(), canceladoPor: opsNombreActual(),
            });
            document.getElementById("ops-modal-wrap").innerHTML = "";
            window.mostrarPush ? mostrarPush("Herramientas", "Traspaso cancelado.", ICON.unlock) : alert("Traspaso cancelado.");
        } catch (err) {
            console.error("[operaciones.js] error al cancelar traspaso:", err);
            alert("No se pudo cancelar: " + (err && err.message ? err.message : err));
        }
    };

    // Foto de evidencia opcional al iniciar un traspaso desde el Portal — mismo
    // helper de compresión que ya usa la revisión de herramienta (Fase 2).
    let opsTraspasoFotoBase64 = null;
    window.opsSeleccionarFotoTraspaso = async function (inputEl) {
        const file = inputEl.files && inputEl.files[0];
        if (!file) return;
        const estadoEl = document.getElementById("ops-traspaso-foto-estado");
        if (estadoEl) estadoEl.textContent = "Procesando...";
        try {
            const dataUrl = await opsComprimirImagenBase64(file, 700, 0.6);
            opsTraspasoFotoBase64 = dataUrl;
            const thumb = document.getElementById("ops-traspaso-thumb");
            if (thumb) { thumb.src = dataUrl; thumb.style.display = "block"; }
            if (estadoEl) estadoEl.textContent = "Foto lista";
        } catch (err) {
            console.error("[operaciones.js] error al comprimir foto de traspaso:", err);
            if (estadoEl) estadoEl.textContent = "Error al procesar la foto";
        }
    };

    window.opsToggleCamposMovimiento = function () {
        const tipo = document.getElementById("ops-in-tipomov").value;
        document.getElementById("ops-campo-tecnico").style.display = (tipo === "asignacion" || tipo === "transferencia") ? "block" : "none";
        document.getElementById("ops-campo-ubicacion").style.display = (tipo === "cambio_ubicacion") ? "block" : "none";
        document.getElementById("ops-campo-transferencia-info").style.display = (tipo === "transferencia") ? "block" : "none";
        document.getElementById("ops-campo-evidencia-transferencia").style.display = (tipo === "transferencia") ? "block" : "none";
        const btn = document.getElementById("ops-mov-btn-confirmar");
        if (btn) btn.textContent = tipo === "transferencia" ? "Enviar traspaso" : "Confirmar";
    };

    window.opsConfirmarMovimiento = async function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        const tipo = document.getElementById("ops-in-tipomov").value;
        const obs = document.getElementById("ops-in-obs").value.trim();
        const btn = document.getElementById("ops-mov-btn-confirmar");

        // "Reasignar a otro técnico" ya NO mueve la pieza al instante: crea un
        // traspaso que el receptor debe aceptar desde Flotilla, igual que un
        // vehículo — así ninguna herramienta "brinca" de técnico sin que el
        // que la recibe lo confirme.
        if (tipo === "transferencia") {
            return opsIniciarTraspasoDesdeOperaciones(herramientaId, obs);
        }

        if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
        try {
            const { db, fs } = await opsGetFB();
            const ref = fs.doc(db, COL_HERRAMIENTAS, herramientaId);

            const mapaEstado = {
                asignacion: "asignada", devolucion: "disponible",
                reparacion: "reparacion", retorno_reparacion: "disponible",
                perdida: "extraviada", danio: "danada", cambio_ubicacion: h.estado,
            };
            const nuevoEstado = mapaEstado[tipo] || h.estado;
            const update = { estado: nuevoEstado, observaciones: obs || h.observaciones || null };
            let tecnicoNuevoId = h.tecnicoActualId;

            if (tipo === "asignacion") {
                tecnicoNuevoId = document.getElementById("ops-in-tecnico").value;
                if (!tecnicoNuevoId) { alert("Selecciona un técnico"); if (btn) { btn.disabled = false; btn.textContent = "Confirmar"; } return; }
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
                tecnicoNuevoId: tipo === "asignacion" ? tecnicoNuevoId : null,
                ubicacionAnterior: h.ubicacionActual,
                ubicacionNueva: update.ubicacionActual || h.ubicacionActual,
                observaciones: obs,
            });
            document.getElementById("ops-modal-wrap").innerHTML = "";
            const panel = document.getElementById("ops-panel-wrap");
            if (panel) panel.innerHTML = "";

            if (tipo === "asignacion") {
                // Refrescar caché local con los valores recién guardados antes de generar el PDF,
                // porque onSnapshot puede tardar unos ms en llegar.
                const idx = cacheHerr.findIndex(x => x.id === herramientaId);
                if (idx >= 0) cacheHerr[idx] = { ...cacheHerr[idx], ...update };
                opsGenerarResponsivaPDF(herramientaId);
            }
        } catch (err) {
            console.error("[operaciones.js] error al registrar movimiento:", err);
            alert("No se pudo registrar el movimiento: " + (err && err.message ? err.message : err));
            if (btn) { btn.disabled = false; btn.textContent = "Confirmar"; }
        }
    };

    // Crea la solicitud de traspaso (ops_herramienta_traspasos) en vez de mover
    // la pieza al instante. La acepta/rechaza el receptor desde Flotilla móvil
    // (herrAceptarTraspaso ya funciona igual sin importar quién inició el
    // traspaso — Almacén desde aquí, o el propio técnico desde su celular).
    async function opsIniciarTraspasoDesdeOperaciones(herramientaId, comentario) {
        const btn = document.getElementById("ops-mov-btn-confirmar");
        const h = cacheHerr.find(x => x.id === herramientaId);
        const tecnicoNuevoId = document.getElementById("ops-in-tecnico").value;
        if (!tecnicoNuevoId) { alert("Selecciona un técnico"); return; }
        if (tecnicoNuevoId === h.tecnicoActualId) { alert("Ese técnico ya tiene esta pieza asignada."); return; }

        const pendActual = opsTraspasoPendientePara(herramientaId);
        if (pendActual) { alert("Ya hay un traspaso pendiente para esta pieza. Cancélalo antes de iniciar otro."); return; }

        const receptor = cacheTec.find(t => t.id === tecnicoNuevoId);
        const entrega = cacheTec.find(t => t.id === h.tecnicoActualId);
        if (!receptor || !receptor.correo) {
            alert(`${receptor ? receptor.nombre : "Este técnico"} no tiene correo capturado en su ficha de Operaciones > Técnicos. Sin correo no puede ver ni aceptar el traspaso desde Flotilla — captúralo primero ahí.`);
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }
        try {
            const { db, fs } = await opsGetFB();
            const now = new Date();
            const venceEn = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const venceTxt = venceEn.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

            const traspasoRef = await fs.addDoc(fs.collection(db, COL_HERR_TRASPASOS), {
                herramientaId, folio: h.folio || "", descripcion: h.descripcion || "",
                entregaTecnicoId: h.tecnicoActualId || null,
                entregaEmail: entrega && entrega.correo ? entrega.correo : null,
                entregaNombre: entrega ? entrega.nombre : "Almacén",
                receptorTecnicoId: tecnicoNuevoId,
                receptorEmail: receptor.correo,
                receptorNombre: receptor.nombre,
                almacenOrigenId: opsAlmacenIdDe(h.tecnicoActualId),
                almacenDestinoId: opsAlmacenIdDe(tecnicoNuevoId),
                comentario: comentario || null,
                evidenciaBase64: opsTraspasoFotoBase64 || null,
                estatus: "Pendiente recepción",
                creadoEn: now.toISOString(), venceEn: venceEn.toISOString(),
                origen: "operaciones", creadoPorEmail: opsUsuarioActual(), creadoPorNombre: opsNombreActual(),
            });

            await fs.addDoc(fs.collection(db, "flotilla_notificaciones"), {
                tipo: "herramienta_traspaso_iniciada", traspasoId: traspasoRef.id, para: receptor.correo,
                mensaje: `${opsNombreActual()} te está traspasando la herramienta ${h.folio || ""} (${h.descripcion || ""}). Acéptala antes del ${venceTxt} desde Flotilla, o el traspaso vencerá.`,
                leido: false, creadaEn: now.toISOString(),
            }).catch(err => console.warn("[operaciones.js] no se pudo notificar al receptor:", err));

            opsTraspasoFotoBase64 = null;
            document.getElementById("ops-modal-wrap").innerHTML = "";
            window.mostrarPush ? mostrarPush("Herramientas", `Traspaso enviado a ${receptor.nombre} — pendiente de que lo acepte.`, ICON.lock) : alert(`Traspaso enviado a ${receptor.nombre}. Queda pendiente hasta que lo acepte desde Flotilla.`);
        } catch (err) {
            console.error("[operaciones.js] error al iniciar traspaso:", err);
            alert("No se pudo enviar el traspaso: " + (err && err.message ? err.message : err));
            if (btn) { btn.disabled = false; btn.textContent = "Enviar traspaso"; }
        }
    }

    // ── Baja de herramienta (nunca se elimina el documento) ────────
    window.opsAbrirModalBaja = function (herramientaId) {
        const h = cacheHerr.find(x => x.id === herramientaId);
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#E7402B;margin-bottom:4px;">Dar de baja</div>
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
                    <button onclick="opsConfirmarBaja('${herramientaId}')" class="mkt-add-btn" style="background:#E7402B;">Confirmar baja</button>
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
                    <input type="text" id="ops-tec-buscar" value="${opsEsc(filtroTec)}" placeholder="Buscar técnico..." oninput="opsFiltrarTec(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;font-size:12.5px;width:260px;outline:none;">
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${gestion ? `<button onclick="opsExportarInventarioPDF()" title="PDF de herramienta por técnico, para auditoría" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">🖨️ PDF auditoría</button>` : ""}
                        ${gestion ? `<button onclick="opsExportarInventarioExcel()" title="Excel de herramienta por técnico, para auditoría" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">📊 Excel auditoría</button>` : ""}
                        ${gestion ? `<button onclick="opsAbrirModalTecnico()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo técnico</button>` : ""}
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

    window.opsFiltrarTec = function (v) { filtroTec = v || ""; opsRerenderConFoco(opsRenderTecnicos); };

    function opsFilaTecnico(t, i) {
        const activo = t.estatus === "activo";
        const nHerr = cacheHerr.filter(h => h.tecnicoActualId === t.id).length;
        const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
        const hoy = opsHoy();
        const ausenteHoy = cacheAusencias.find(a => a.tecnicoId === t.id && a.fechaInicio <= hoy && a.fechaFin >= hoy);
        return `<tr style="background:${zebra};border-bottom:1px solid #eef1f5;cursor:pointer;" onclick="opsAbrirFichaTecnico('${t.id}')">
            <td style="padding:8px 10px;font-weight:600;color:#334155;">${opsEsc(t.numeroOperativo)}</td>
            <td style="padding:8px 10px;color:#334155;">${opsEsc(t.nombre)}${ausenteHoy ? ` <span style="background:#fef3c7;color:#b45309;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;margin-left:4px;">${opsEsc({ vacaciones: "Vacaciones", incapacidad: "Incapacidad", permiso: "Permiso" }[ausenteHoy.tipo] || ausenteHoy.tipo)}</span>` : ""}</td>
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
                    <button onclick="opsGuardarEdicionTecnico('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar cambios</button>
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
                    <button onclick="opsGuardarTecnico()" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
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

        const refTecNuevo = await fs.addDoc(fs.collection(db, COL_TECNICOS), {
            numeroOperativo, personaId, nombre: nombrePersona,
            puestoId, puesto: puesto ? puesto.nombre : "", departamento: puesto ? puesto.departamento : "",
            registroHistorico: vecesUsado + 1,
            estatus: "activo", fechaIngreso: opsHoy(), fechaBaja: null,
            supervisor: null, telefono: null, correo: null, observaciones: null,
            // Identificadores para hacer match confiable con RH/Flotilla/Firebase (no solo por nombre).
            employeeId: null, fleetUserId: null, firebaseUid: null,
        });
        await opsCrearAlmacenTecnico(db, fs, refTecNuevo.id, nombrePersona);
        // Abre el primer periodo en el historial de puesto de esta persona.
        await fs.addDoc(fs.collection(db, COL_HIST_PUESTO), { personaId, puestoId, desde: opsHoy(), hasta: null });
        cacheHistPuesto.push({ personaId, puestoId, desde: opsHoy(), hasta: null });

        document.getElementById("ops-modal-wrap").innerHTML = "";
    };


    window.opsAbrirFichaTecnico = async function (idInterno, tabInicial) {
        fichaTecActual = idInterno;
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
                ${guardiaActiva ? `<div style="background:#5b21b6;border-radius:12px;padding:10px 14px;margin-bottom:8px;color:#fff;font-size:11.5px;font-weight:700;">🛡 En guardia — herramienta ${opsEsc(guardiaActiva.herramientaId)}</div>` : ""}

                <div style="background:#fff;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;margin-top:8px;">
                    <div style="width:52px;height:52px;border-radius:50%;background:#1D2E73;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;">${opsEsc(iniciales)}</div>
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
                            ${activo ? `<button onclick="document.getElementById('ops-menu-tecnico').style.display='none';opsIniciarBajaTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border-top:1px solid #f1f5f9;border-bottom:none;border-left:none;border-right:none;padding:10px 14px;font-size:12.5px;color:#E7402B;cursor:pointer;">${ICON.trash} Dar de baja al técnico</button>` : ""}
                        </div>
                    </div>` : ""}
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">VEHÍCULO</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${vehActual ? opsEsc(vehActual.unidad) : "—"}</div></div>
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">MATERIAL</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${materiales.length}</div></div>
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">HERRAM.</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${asignadas.length}</div></div>
                </div>

                <div style="display:flex;gap:4px;margin:14px 0;overflow-x:auto;border-bottom:1px solid #e2e8f0;">
                    ${["resumen:Resumen", "rh:RH", "vehiculo:Vehículo", "herramientas:Herramientas", "ausencias:Ausencias", "auditoria:Auditoría", "historial:Historial"].map(x => {
                        const [id, label] = x.split(":");
                        const on = fichaTecTabActual === id;
                        return `<button onclick="opsFichaTecCambiarTab('${idInterno}','${id}')" style="background:none;border:none;padding:8px 10px;font-size:11.5px;font-weight:600;white-space:nowrap;color:${on ? "#1D2E73" : "#64748b"};border-bottom:2px solid ${on ? "#1D2E73" : "transparent"};cursor:pointer;">${label}</button>`;
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
                ${activo && opsPuedeHacer("solicitar_material") ? `<div style="margin-bottom:12px;"><button onclick="opsAbrirModalSolicitud('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Solicitar material</button></div>` : ""}
                <div style="background:#fff;border-radius:14px;padding:16px 18px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Departamento:</strong> ${opsEsc(t.departamento || "—")}</div>
                    <div><strong>Fecha de ingreso:</strong> ${opsEsc(t.fechaIngreso || "—")}</div>
                    ${t.fechaBaja ? `<div><strong>Fecha de baja:</strong> ${opsEsc(t.fechaBaja)}</div>` : ""}
                </div>`;
        } else if (fichaTecTabActual === "rh") {
            const sincronizado = !!(t.employeeId && t.firebaseUid);
            el.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-size:11.5px;font-weight:700;color:${t.firebaseUid ? "#166534" : "#b45309"};">${t.firebaseUid ? "🟢 Tiene acceso al kiosco" : "🟠 Sin acceso al kiosco"}</span>
                        ${!t.firebaseUid && opsPuedeGestionar() ? `<button onclick="opsAbrirModalAccesoKiosco('${idInterno}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">🔑 Crear acceso</button>` : ""}
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;">El kiosco de Solicitud de Material (solicitud-material.html) ahora exige inicio de sesión real — sin esta cuenta el técnico no puede pedir material desde ahí.</div>
                </div>
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
                <div style="background:#1D2E73;border-radius:14px;padding:16px 18px;margin-bottom:12px;color:#fff;">
                    <div style="font-size:10.5px;font-weight:700;opacity:0.85;">🚐 VEHÍCULO EN FLOTILLA (en vivo)</div>
                    ${vehFlotilla ? `<div style="font-size:14px;font-weight:700;margin-top:4px;">${opsEsc(vehFlotilla.unidad)} ${vehFlotilla.marca ? "— " + opsEsc(vehFlotilla.marca) + " " + opsEsc(vehFlotilla.modelo) : ""}</div><div style="font-size:11px;color:#C7CEE0;margin-top:2px;">Estado: ${opsEsc(vehFlotilla.estado)}</div>`
                        : `<div style="font-size:11.5px;color:#C7CEE0;margin-top:4px;">${t.correo ? "Sin vehículo vinculado en Flotilla para este correo." : "Captura el correo del técnico (⚙ Editar perfil) para hacer match con Flotilla."}</div>`}
                </div>
                <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Asignación manual (Operaciones)</div>
                        ${opsPuedeGestionar() ? `<button onclick="opsAbrirModalVehiculo('${idInterno}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">Asignar vehículo</button>` : ""}
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
                        ${asignadas.length && opsPuedeGestionar() ? `<button onclick="opsAbrirModalRevision('${idInterno}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">🔍 Registrar revisión</button>` : ""}
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
                    ${asignadas.length && opsPuedeGestionar() ? `<button onclick="opsAbrirModalRevision('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">🔍 Nueva revisión</button>` : ""}
                </div>
                ${revisiones.length ? revisiones.map(r => {
                    const faltantes = (r.herramientas || []).filter(h => h.estado !== "conforme");
                    const conFoto = (r.herramientas || []).filter(h => h.tieneFoto).length;
                    return `<div style="background:#fff;border-radius:14px;padding:14px 16px;margin-bottom:10px;border-left:4px solid ${faltantes.length ? "#E7402B" : "#16a34a"};">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                            <div style="font-size:12.5px;font-weight:700;color:#1e293b;">${opsEsc((r.fecha || "").slice(0, 10))}</div>
                            <span style="font-size:10.5px;font-weight:700;color:${faltantes.length ? "#E7402B" : "#166534"};">${faltantes.length ? `${ICON.alert} ${faltantes.length} con novedad` : `${ICON.check} Todo conforme`}</span>
                        </div>
                        <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">Revisó: ${opsEsc(r.realizadoPor || "—")}${conFoto ? ` · ${ICON.camera} ${conFoto} foto(s)` : ""}</div>
                        ${(r.herramientas || []).map(h => `<div style="font-size:11.5px;color:#334155;padding:2px 0;">${h.estado === "conforme" ? ICON.check : (h.estado === "faltante" ? ICON.xCircle : ICON.alert)} ${opsEsc(h.folio)} — ${opsEsc(h.descripcion)}${h.observacion ? ` · <em>${opsEsc(h.observacion)}</em>` : ""}${h.tieneFoto ? ` · ${ICON.camera}` : ""}</div>`).join("")}
                        ${r.observacionesGenerales ? `<div style="font-size:11.5px;color:#64748b;margin-top:6px;border-top:1px solid #f1f5f9;padding-top:6px;">${opsEsc(r.observacionesGenerales)}</div>` : ""}
                        <div style="margin-top:8px;text-align:right;">
                            <button id="ops-rev-share-${r.id}" onclick="opsCompartirRevisionPDF('${r.id}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">${ICON.file} PDF / WhatsApp</button>
                        </div>
                    </div>`;
                }).join("") : '<div style="background:#fff;border-radius:14px;padding:16px 18px;color:#94a3b8;font-size:12px;">Sin revisiones registradas todavía.</div>'}`;
            return;
        } else if (fichaTecTabActual === "ausencias") {
            const hoy = opsHoy();
            const ausenciasTec = cacheAusencias.filter(a => a.tecnicoId === idInterno).sort((a, b) => (a.fechaInicio < b.fechaInicio ? 1 : -1));
            const activasHoy = ausenciasTec.filter(a => a.fechaInicio <= hoy && a.fechaFin >= hoy);
            const tipoLabel = { vacaciones: "Vacaciones", incapacidad: "Incapacidad", permiso: "Permiso" };
            const tipoColor = { vacaciones: { bg: "#dbeafe", fg: "#1e40af" }, incapacidad: { bg: "#fee2e2", fg: "#E7402B" }, permiso: { bg: "#fef3c7", fg: "#b45309" } };
            el.innerHTML = `
                ${activasHoy.length ? `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:10px 13px;margin-bottom:12px;font-size:12px;color:#92400e;font-weight:600;">${activasHoy.map(a => `${tipoLabel[a.tipo] || a.tipo} activo hasta ${opsEsc(a.fechaFin)}`).join(" · ")}</div>` : ""}
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Vacaciones, incapacidades y permisos</div>
                        ${opsPuedeGestionar() ? `<button onclick="opsAbrirModalAusencia('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Registrar</button>` : ""}
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;margin-bottom:10px;">Calendario propio de Operaciones — todavía no se cruza automáticamente contra la planeación de servicios (no hay fecha de programación de trabajo todavía).</div>
                    ${ausenciasTec.length ? ausenciasTec.map(a => {
                        const c = tipoColor[a.tipo] || { bg: "#e5e7eb", fg: "#374151" };
                        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #f1f5f9;">
                            <div>
                                <span style="background:${c.bg};color:${c.fg};font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;">${opsEsc(tipoLabel[a.tipo] || a.tipo)}</span>
                                <div style="font-size:11.5px;color:#334155;margin-top:4px;">${opsEsc(a.fechaInicio)} → ${opsEsc(a.fechaFin)}${a.motivo ? ` · ${opsEsc(a.motivo)}` : ""}</div>
                            </div>
                            ${opsPuedeGestionar() ? `<button onclick="opsEliminarAusencia('${a.id}')" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                        </div>`;
                    }).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin registros.</div>'}
                </div>`;
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

    window.opsAbrirModalAusencia = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:360px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Registrar ausencia</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:14px;">${opsEsc(t ? t.nombre : "")}</div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Tipo</label>
                <select id="ops-in-ausencia-tipo" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                    <option value="vacaciones">Vacaciones</option>
                    <option value="incapacidad">Incapacidad</option>
                    <option value="permiso">Permiso</option>
                </select>

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Desde</label>
                    <input type="date" id="ops-in-ausencia-inicio" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Hasta</label>
                    <input type="date" id="ops-in-ausencia-fin" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;"></div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Motivo / observación (opcional)</label>
                <input id="ops-in-ausencia-motivo" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">

                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarAusencia('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarAusencia = async function (idInterno) {
        const tipo = document.getElementById("ops-in-ausencia-tipo").value;
        const fechaInicio = document.getElementById("ops-in-ausencia-inicio").value;
        const fechaFin = document.getElementById("ops-in-ausencia-fin").value;
        const motivo = document.getElementById("ops-in-ausencia-motivo").value.trim() || null;
        if (!fechaInicio || !fechaFin) { alert("Captura las dos fechas"); return; }
        if (fechaFin < fechaInicio) { alert("La fecha final no puede ser antes que la inicial"); return; }
        try {
            const { db, fs } = await opsGetFB();
            await fs.addDoc(fs.collection(db, COL_AUSENCIAS), {
                tecnicoId: idInterno, tipo, fechaInicio, fechaFin, motivo,
                creadoPor: opsNombreActual(), fechaAlta: opsHoy(),
            });
            document.getElementById("ops-modal-wrap").innerHTML = "";
        } catch (err) {
            alert("No se pudo guardar: " + err.message);
        }
    };

    window.opsEliminarAusencia = async function (id) {
        if (!confirm("¿Eliminar este registro?")) return;
        try {
            const { db, fs } = await opsGetFB();
            await fs.deleteDoc(fs.doc(db, COL_AUSENCIAS, id));
        } catch (err) {
            alert("No se pudo eliminar: " + err.message);
        }
    };

    // ── Auditoría física de herramienta: registra el estado de cada pieza asignada al
    // momento de la revisión (conforme / faltante / dañada), con foto, quién y
    // observaciones. Queda en ops_revisiones_herramienta como bitácora permanente.
    let opsRevisionFotos = new Map(); // herrId -> Blob comprimido, solo mientras el modal está abierto

    window.opsAbrirModalRevision = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        if (!t || !asignadas.length) return;
        opsRevisionFotos = new Map();
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
                            <label style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px;border-radius:7px;background:#fef2f2;color:#E7402B;cursor:pointer;"><input type="radio" name="rev-${h.id}" value="faltante" style="margin-right:4px;">Faltante</label>
                            <label style="flex:1;text-align:center;font-size:11px;font-weight:600;padding:6px;border-radius:7px;background:#fff7ed;color:#c2410c;cursor:pointer;"><input type="radio" name="rev-${h.id}" value="danada" style="margin-right:4px;">Dañada</label>
                        </div>
                        <input type="text" placeholder="Observación (opcional)" id="ops-rev-obs-${h.id}" style="width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:6px 9px;font-size:11.5px;box-sizing:border-box;margin-bottom:6px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <label style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:#1D2E73;background:#E9ECF5;padding:6px 10px;border-radius:7px;cursor:pointer;">
                                ${ICON.camera} Tomar/adjuntar foto
                                <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="opsSeleccionarFotoRevision('${h.id}', this)">
                            </label>
                            <img id="ops-rev-thumb-${h.id}" style="display:none;width:34px;height:34px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;">
                            <span id="ops-rev-foto-estado-${h.id}" style="font-size:10.5px;color:#94a3b8;"></span>
                        </div>
                    </div>`).join("")}
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Observaciones generales de la revisión</label>
                <textarea id="ops-rev-obs-generales" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 14px;resize:vertical;box-sizing:border-box;"></textarea>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button id="ops-rev-btn-guardar" onclick="opsGuardarRevision('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar revisión</button>
                </div>
            </div>
        </div>`;
    };

    window.opsSeleccionarFotoRevision = async function (herrId, inputEl) {
        const file = inputEl.files && inputEl.files[0];
        if (!file) return;
        const estadoEl = document.getElementById(`ops-rev-foto-estado-${herrId}`);
        if (estadoEl) estadoEl.textContent = "Procesando...";
        try {
            const dataUrl = await opsComprimirImagenBase64(file, 700, 0.6);
            opsRevisionFotos.set(herrId, dataUrl);
            const thumb = document.getElementById(`ops-rev-thumb-${herrId}`);
            if (thumb) { thumb.src = dataUrl; thumb.style.display = "block"; }
            if (estadoEl) estadoEl.textContent = "Foto lista";
        } catch (err) {
            console.error("[operaciones.js] error al comprimir foto de revisión:", err);
            if (estadoEl) estadoEl.textContent = "Error al procesar la foto";
        }
    };

    window.opsGuardarRevision = async function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        const btnGuardar = document.getElementById("ops-rev-btn-guardar");
        if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.textContent = "Guardando..."; }
        const filas = Array.from(document.querySelectorAll("#ops-revision-lista > div"));
        const { db, fs } = await opsGetFB();

        // Sin Storage (Spark, sin Blaze): cada foto se guarda como su propio
        // documento chico en una SUBCOLECCIÓN de la revisión — así, sin importar
        // cuántas piezas traigan foto, ningún documento se acerca al límite de
        // 1MB de Firestore (es el mismo patrón que ya usa el resto del portal
        // para fotos comprimidas). El documento de la revisión solo guarda
        // "tieneFoto: true/false" por pieza, no la imagen.
        const revisionRef = fs.doc(fs.collection(db, COL_REVISIONES));
        const herramientas = [];
        for (const div of filas) {
            const herrId = div.getAttribute("data-herr-id");
            const seleccionado = div.querySelector(`input[name="rev-${herrId}"]:checked`);
            const obsEl = document.getElementById(`ops-rev-obs-${herrId}`);
            const dataUrl = opsRevisionFotos.get(herrId);
            if (dataUrl) {
                try {
                    await fs.setDoc(fs.doc(fs.collection(revisionRef, "fotos"), herrId), { fotoBase64: dataUrl });
                } catch (err) {
                    console.error(`[operaciones.js] no se pudo guardar la foto de ${herrId}:`, err);
                }
            }
            herramientas.push({
                herramientaId: herrId,
                folio: div.getAttribute("data-folio") || "",
                descripcion: div.getAttribute("data-desc") || "",
                estado: seleccionado ? seleccionado.value : "conforme",
                observacion: (obsEl && obsEl.value.trim()) || null,
                tieneFoto: !!dataUrl,
            });
        }
        const observacionesGenerales = (document.getElementById("ops-rev-obs-generales") || {}).value || "";
        await fs.setDoc(revisionRef, {
            tecnicoId: idInterno,
            tecnicoNombre: t ? t.nombre : "—",
            tecnicoNumero: t ? t.numeroOperativo : "",
            fecha: opsFechaHora(),
            realizadoPor: opsNombreActual(),
            herramientas,
            observacionesGenerales: observacionesGenerales.trim() || null,
            createdAt: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
        });
        opsRevisionFotos = new Map();
        document.getElementById("ops-modal-wrap").innerHTML = "";
        window.mostrarPush ? mostrarPush("Auditoría", "Revisión de herramienta guardada.", ICON.search) : alert("Revisión guardada.");
        opsFichaTecCambiarTab(idInterno, "auditoria");
    };

    // ── PDF de una revisión (con fotos) + compartir por WhatsApp ───
    // Genera un PDF con las fotos de evidencia a buen tamaño (no thumbnails)
    // y ofrece compartirlo directo por WhatsApp vía Web Share API cuando el
    // navegador lo soporta (celular); si no, descarga el PDF y abre WhatsApp
    // para que Glen/el técnico lo adjunte manualmente en 1 paso más.
    async function opsImagenAB64(url) {
        try {
            const resp = await fetch(url);
            const blob = await resp.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.error("[operaciones.js] no se pudo descargar foto de evidencia:", err);
            return null;
        }
    }

    async function opsGenerarPDFRevision(revision, revisionId) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const M = 14, W = 216 - M * 2;
        let y = 16;
        doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text("REPORTE DE AUDITORÍA DE HERRAMIENTA", M, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90);
        doc.text("HEDMA TECNOCONTROL S.A. DE C.V.", M, y); y += 5;
        doc.text(`Técnico: ${revision.tecnicoNombre || "—"}  ·  N.° ${revision.tecnicoNumero || "—"}`, M, y); y += 5;
        doc.text(`Fecha: ${(revision.fecha || "").slice(0, 16).replace("T", " ")}  ·  Revisó: ${revision.realizadoPor || "—"}`, M, y); y += 8;
        doc.setTextColor(20);

        const cols = 2, imgW = (W - 6) / cols, imgH = 42;
        let col = 0;
        for (const h of (revision.herramientas || [])) {
            if (y > 250) { doc.addPage(); y = 16; }
            const x = M + col * (imgW + 6);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(x, y, imgW, imgH + 20, 2, 2);
            let imgY = y + 3;
            if (h.tieneFoto) {
                try {
                    const { db, fs } = await opsGetFB();
                    const fotoSnap = await fs.getDoc(fs.doc(db, COL_REVISIONES, revisionId, "fotos", h.herramientaId));
                    const b64 = fotoSnap.exists() ? fotoSnap.data().fotoBase64 : null;
                    if (b64) { try { doc.addImage(b64, "JPEG", x + 3, imgY, imgW - 6, imgH, undefined, "FAST"); } catch (_e) { /* formato no soportado, se omite */ } }
                } catch (err) { console.warn("[operaciones.js] no se pudo leer la foto de", h.herramientaId, err); }
            } else {
                doc.setFontSize(8); doc.setTextColor(180);
                doc.text("Sin foto", x + imgW / 2, imgY + imgH / 2, { align: "center" });
                doc.setTextColor(20);
            }
            const estadoLabel = { conforme: "Conforme", faltante: "Faltante", danada: "Dañada" }[h.estado] || h.estado;
            const estadoColor = h.estado === "conforme" ? [22, 101, 52] : (h.estado === "faltante" ? [185, 28, 28] : [194, 65, 12]);
            doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
            doc.text(`${h.folio} — ${h.descripcion}`, x + 3, imgY + imgH + 6, { maxWidth: imgW - 6 });
            doc.setFont("helvetica", "normal");
            doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2]);
            doc.text(estadoLabel, x + 3, imgY + imgH + 11);
            doc.setTextColor(90);
            if (h.observacion) doc.text(h.observacion, x + 3, imgY + imgH + 15.5, { maxWidth: imgW - 6 });
            doc.setTextColor(20);

            col++;
            if (col >= cols) { col = 0; y += imgH + 24; }
        }
        if (revision.observacionesGenerales) {
            if (col !== 0) { col = 0; y += imgH + 24; }
            if (y > 255) { doc.addPage(); y = 16; }
            doc.setFontSize(9.5); doc.setFont("helvetica", "bold");
            doc.text("Observaciones generales:", M, y); y += 5;
            doc.setFont("helvetica", "normal");
            doc.text(revision.observacionesGenerales, M, y, { maxWidth: W });
        }
        return doc;
    }

    window.opsCompartirRevisionPDF = async function (revisionId) {
        const btn = document.getElementById(`ops-rev-share-${revisionId}`);
        if (btn) { btn.disabled = true; btn.textContent = "Generando PDF..."; }
        try {
            const { db, fs } = await opsGetFB();
            const snap = await fs.getDoc(fs.doc(db, COL_REVISIONES, revisionId));
            if (!snap.exists()) { alert("No se encontró la revisión."); return; }
            const revision = snap.data();
            const doc = await opsGenerarPDFRevision(revision, revisionId);
            const nombreArchivo = `Auditoria_${(revision.tecnicoNumero || "tec").replace(/\s+/g, "_")}_${(revision.fecha || "").slice(0, 10)}.pdf`;
            const blob = doc.output("blob");
            const file = new File([blob], nombreArchivo, { type: "application/pdf" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: "Reporte de auditoría de herramienta",
                    text: `Auditoría de herramienta — ${revision.tecnicoNombre || ""} (${(revision.fecha || "").slice(0, 10)})`,
                });
            } else {
                doc.save(nombreArchivo);
                const texto = encodeURIComponent(`Reporte de auditoría de herramienta de ${revision.tecnicoNombre || ""} (${(revision.fecha || "").slice(0, 10)}). Adjunto el PDF "${nombreArchivo}" que se acaba de descargar.`);
                window.open(`https://wa.me/?text=${texto}`, "_blank");
            }
        } catch (err) {
            console.error("[operaciones.js] error al compartir PDF de revisión:", err);
            alert("No se pudo generar/compartir el PDF. Intenta de nuevo.");
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "PDF / WhatsApp"; }
        }
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
                    <button onclick="opsConfirmarVehiculo('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Asignar</button>
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
                <div style="background:#EDF0F7;border-radius:10px;padding:10px 12px;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
                    <span style="color:#1D2E73;">${ICON.user}</span>
                    <div><div style="font-size:12.5px;font-weight:700;color:#1e3a8a;">${opsEsc(t.nombre)}</div><div style="font-size:10.5px;color:#3b82f6;">Técnico N.° ${opsEsc(t.numeroOperativo)}</div></div>
                </div>

                <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:6px;">1 · Datos de la solicitud</div>
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

                <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:6px;">2 · Artículos solicitados</div>
                <input list="ops-datalist-prod" id="ops-in-buscarprod" placeholder="Busca un producto por nombre o clave..." style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin-bottom:8px;">
                <datalist id="ops-datalist-prod">${catalogoProductos.map(p => `<option data-clave="${opsEsc(p.clave || "")}" value="${opsEsc(p.desc || p.clave)}">`).join("")}</datalist>
                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <input id="ops-in-cantprod" type="number" min="1" value="1" style="width:70px;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;">
                    <button onclick="opsAgregarProductoCarrito()" style="flex:1;background:#f1f5f9;border:none;border-radius:8px;color:#334155;font-weight:600;font-size:12.5px;cursor:pointer;">+ Agregar al pedido</button>
                </div>
                <div id="ops-carrito-lista" style="margin-bottom:14px;"></div>

                <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:6px;">3 · Firma del solicitante</div>
                <div style="position:relative;border:1px dashed #cbd5e1;border-radius:10px;height:120px;overflow:hidden;">
                    <canvas id="ops-sign-canvas" style="width:100%;height:100%;touch-action:none;"></canvas>
                    <div id="ops-sign-hint" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11.5px;pointer-events:none;">Firma aquí con el dedo o el mouse</div>
                </div>
                <div style="display:flex;justify-content:flex-end;margin:6px 0 14px;">
                    <button onclick="opsLimpiarFirma()" style="background:none;border:none;color:#1D2E73;font-size:11.5px;font-weight:600;cursor:pointer;">Limpiar firma</button>
                </div>

                <div id="ops-solic-msg" style="color:#E7402B;font-size:11.5px;margin-bottom:8px;"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsEnviarSolicitudMaterial('${tecnicoId}')" class="mkt-add-btn" style="background:#1D2E73;">Enviar solicitud de material</button>
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
                <button onclick="opsQuitarProductoCarrito('${k}')" style="background:none;border:none;color:#E7402B;cursor:pointer;font-size:11px;">Quitar</button>
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

        const folioInfo = await opsSiguienteFolioMaterial();
        await window.tcSbCrearSurtido({
            tipo: "material", folio: folioInfo.folio, folioNum: folioInfo.folioNum, folioPrefijo: folioInfo.folioPrefijo,
            cliente: destino || "Almacén · Operaciones",
            solicitante, vendedor: solicitante,
            area, destino, uso,
            prioridad: "urgente", estado: "pendiente",
            productos, firma: opsFirmaBase64(),
            origen: "operaciones", // (el kiosco físico usa 'kiosco'; Operaciones usa 'operaciones' para distinguir origen sin romper nada)
            tecnicoId, tecnicoNumero: t.numeroOperativo, tecnicoNombre: t.nombre,
            folioServicio: folioServicio || null,
            createdAt: new Date().toISOString(), // Supabase, no serverTimestamp() de Firestore
        });
        document.getElementById("ops-modal-wrap").innerHTML = "";
        window.mostrarPush ? mostrarPush("Herramientas", `Solicitud ${folioInfo.folio} enviada a Almacén.`, ICON.box) : alert(`Solicitud ${folioInfo.folio} enviada a Almacén.`);
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
                    ${gestion ? `<button onclick="opsAbrirModalGuardia()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Asignar guardia</button>` : ""}
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Distinto de la herramienta de trabajo permanente — se asigna solo mientras dura la guardia y se cierra al devolver.</div>

                <div style="font-size:11.5px;font-weight:700;color:#1D2E73;margin-bottom:8px;">Guardias activas (${activas.length})</div>
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
                    <button onclick="opsGuardarGuardia()" class="mkt-add-btn" style="background:#1D2E73;">Asignar guardia</button>
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
                <span style="width:36px;height:36px;border-radius:9px;background:#e0e7ff;color:#1D2E73;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icono}</span>
                <div><div style="font-size:12.5px;font-weight:700;color:#1e293b;">${titulo}</div><div style="font-size:10.5px;color:#94a3b8;">${sub}</div></div>
            </div>`;
        }
        el.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:22px;">
                ${tarjeta(ICON.plus, "Nuevo servicio técnico", "Abre el formulario ya existente en Operaciones", "typeof abrirFormServicio==='function' && abrirFormServicio()", typeof window.abrirFormServicio === "function")}
                ${tarjeta(ICON.box, "Servicios / registros", "Ver la lista de servicios técnicos capturados", "typeof toggleListaServicios==='function' && toggleListaServicios()", typeof window.toggleListaServicios === "function")}
                ${tarjeta(NAV_ICONS.folios, "Folios de servicio", "Seguimiento de vencimiento, atención y solución (Connecteam)", "opsCambiarTab('folios')", true)}
                ${tarjeta(ICON.check, "Pólizas", "Próximamente — módulo aún no existe en el portal", "", false)}
                ${tarjeta(ICON.bell, "Servicios pendientes / completados", "Próximamente — requiere el módulo de Folios", "", false)}
                ${tarjeta(ICON.clock, "Historial y evidencias", "Próximamente — se conectará con Evidencias por asignación", "", false)}
            </div>
            <div style="border-top:1px solid #e2e8f0;padding-top:18px;">
                <div id="ops-catalogo-recetas-contenido"></div>
            </div>`;
        opsRenderCatalogoRecetas();
    }

    // ═══════════════════════ CATÁLOGO DE SERVICIOS (RECETAS) — vive dentro de Servicios ═══════════════════════

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
        rojo:     { bg: "#fee2e2", fg: "#E7402B", dot: "#E7402B" },
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
                        <button onclick="opsAbrirModalFolio()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo folio</button>
                        <button onclick="document.getElementById('ops-folios-import-input').click()" class="mkt-add-btn" style="background:#15803D;">📥 Importar Excel</button>
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
            <td style="padding:8px 10px;color:#334155;">
                <div style="font-size:9px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">O.S.</div>
                <div style="font-weight:600;margin-bottom:${f.folioClienteId ? "4px" : "0"};">${f.folioOS ? opsEsc(f.folioOS) : "—"}</div>
                ${f.folioClienteId ? `<div style="font-size:9px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:.3px;">ID Orden</div><div style="font-weight:600;">${opsEsc(f.folioClienteId)}</div>` : ""}
            </td>
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
                    ${f ? `<button onclick="opsEliminarFolio('${f.id}')" style="background:#fef2f2;border:none;color:#E7402B;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Eliminar</button>` : "<span></span>"}
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                        <button onclick="opsGuardarFolio('${id || ""}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
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
                    <button onclick="opsAgregarComentarioFolio('${f.id}')" style="margin-top:6px;background:#1D2E73;color:#fff;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Agregar comentario</button>
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
            return `<div style="border-left:3px solid ${c.tipo === "captura" ? "#94a3b8" : (esPosteriorCompromiso ? "#E7402B" : "#1D2E73")};padding:8px 12px;margin-bottom:8px;background:#f8fafc;border-radius:0 8px 8px 0;">
                <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
                    <span style="font-size:11.5px;font-weight:700;color:#1e293b;">${opsEsc(c.autor || "—")}</span>
                    <span style="font-size:10px;color:#94a3b8;white-space:nowrap;">${ts ? ts.toLocaleString("es-MX") : "—"}</span>
                </div>
                ${esPosteriorCompromiso ? `<div style="font-size:9.5px;font-weight:700;color:#E7402B;text-transform:uppercase;letter-spacing:.3px;margin:2px 0;">⚠ Posterior a la fecha de atención comprometida</div>` : ""}
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
                    ${gestion ? `<button onclick="opsAbrirModalCliente()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo cliente</button>` : ""}
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
                    ${c ? `<button onclick="opsEliminarCliente('${c.id}')" style="background:#fef2f2;border:none;color:#E7402B;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Eliminar</button>` : "<span></span>"}
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                        <button onclick="opsGuardarCliente('${id || ""}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
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
        rechazada:  { label: "Rechazada",  bg: "#fee2e2", fg: "#E7402B", siguiente: null },
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
                            return `<button onclick="opsFiltrarSolic('${id}')" style="background:${activo ? "#1D2E73" : "#f1f5f9"};color:${activo ? "#fff" : "#475569"};border:none;font-size:11px;font-weight:600;padding:6px 11px;border-radius:7px;cursor:pointer;">${label}</button>`;
                        }).join("")}
                        ${puedeEliminar ? `<button onclick="opsFiltrarSolic('papelera')" style="background:${filtroSolic === "papelera" ? "#E7402B" : "#fee2e2"};color:${filtroSolic === "papelera" ? "#fff" : "#E7402B"};border:none;font-size:11px;font-weight:600;padding:6px 11px;border-radius:7px;cursor:pointer;">${ICON.trash} Papelera (${enPapelera})</button>` : ""}
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
                        <thead><tr style="background:#1D2E73;color:#fff;text-align:left;">
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
        const prio = s.prioridad === "urgente" ? `<span style="color:#E7402B;font-weight:600;">Urgente</span>` : "Normal";
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
                       ${puedeEliminar ? `<button onclick="opsEnviarPapeleraSolicitud('${s.id}')" title="Enviar a papelera" style="background:#fef2f2;border:none;color:#E7402B;width:26px;height:26px;border-radius:7px;cursor:pointer;">${ICON.trash}</button>` : ""}`}
            </td>
        </tr>`;
    }

    // ── Papelera (soft delete) ─────────────────────────────────────
    // OJO: uso tcSbActualizarSurtido (genérico, ya probado en producción para
    // "estado") para escribir estos campos — pero no tengo evidencia de que la
    // tabla `surtidos` en Supabase tenga columnas `eliminada`/`fechaEliminacion`/etc.
    // Pruébalo: si falla o si Supabase las ignora silenciosamente, la papelera
    // dejaría de funcionar aunque no truene. Avísame el resultado.
    window.opsEnviarPapeleraSolicitud = async function (id) {
        const motivo = prompt("Motivo para enviar esta solicitud a la papelera (opcional):", "") || null;
        const dentroDe3Meses = new Date();
        dentroDe3Meses.setDate(dentroDe3Meses.getDate() + 90);
        await window.tcSbActualizarSurtido(id, {
            eliminada: true,
            fechaEliminacion: opsFechaHora(),
            usuarioElimino: opsUsuarioActual(),
            motivoEliminacion: motivo,
            fechaProgramadaEliminacion: dentroDe3Meses.toISOString(),
        });
        await opsAuditar("solicitud", id, "eliminada", false, true);
    };

    window.opsRestaurarSolicitud = async function (id) {
        await window.tcSbActualizarSurtido(id, {
            eliminada: false, fechaEliminacion: null, usuarioElimino: null,
            motivoEliminacion: null, fechaProgramadaEliminacion: null,
        });
        await opsAuditar("solicitud", id, "eliminada", true, false);
    };

    // Limpieza automática (borrado definitivo a 90 días): NO hay evidencia de que
    // exista una función tcSbEliminarSurtido — esto queda deshabilitado hasta
    // confirmar con Glen si Supabase ya soporta borrado definitivo de un surtido,
    // para no inventar una llamada a algo que quizá no existe.
    let opsPapeleraLimpiadaEnEstaSesion = false;
    async function opsLimpiarPapeleraVencida() {
        if (opsPapeleraLimpiadaEnEstaSesion) return;
        opsPapeleraLimpiadaEnEstaSesion = true;
        const ahora = new Date().toISOString();
        const vencidas = cacheSurtidos.filter(s => s.eliminada && s.fechaProgramadaEliminacion && s.fechaProgramadaEliminacion < ahora);
        if (!vencidas.length) return;
        if (!window.tcSbEliminarSurtido) {
            console.warn(`[operaciones.js] ${vencidas.length} solicitud(es) de la papelera ya vencieron sus 90 días, pero no hay función de borrado definitivo en Supabase todavía — no se borran solas.`);
            return;
        }
        for (const s of vencidas) {
            try { await window.tcSbEliminarSurtido(s.id); } catch (e) { console.warn("[operaciones.js] limpieza papelera:", e.message); }
        }
    }

    window.opsAbrirFichaSolicitud = async function (id) {
        const s = cacheSurtidos.find(x => x.id === id);
        if (!s) return;
        const prod = (s.productos && s.productos[0]) || {};
        const listaArticulos = Array.isArray(s.productos) ? s.productos : [];
        const estadoKey = s.estado || "pendiente";
        const e = ESTADOS_SOLICITUD[estadoKey] || ESTADOS_SOLICITUD.pendiente;
        let historial = [];
        try {
            historial = await window.tcSbListarHistorial(id); // tabla surtido_historial en Supabase, no subcolección de Firestore
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
                    ${historial.length ? historial.map(ev => `<div style="margin-bottom:12px;position:relative;"><div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#1D2E73;"></div><div style="font-size:12px;color:#334155;">${opsEsc(ev.de || "—")} → ${opsEsc(ev.a || "—")} · ${opsEsc(ev.por || "")}</div></div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin eventos registrados aún.</div>'}
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
        await window.tcSbActualizarSurtido(id, { estado: siguienteEstado });
        // Mismo patrón real que ya usa Almacén: tabla surtido_historial en Supabase, no subcolección de Firestore.
        await window.tcSbAgregarHistorial(id, { de: estadoAnterior, a: siguienteEstado, por: opsNombreActual(), porEmail: opsUsuarioActual() });
        // Notificación real cuando queda "listo" — Operaciones no depende de estar viendo la pantalla.
        // Esta SÍ sigue en Firestore (ops_notificaciones): es la campanita propia de
        // Operaciones, no la tabla de surtidos — no es parte de la migración a Supabase.
        if (siguienteEstado === "listo") {
            const { db, fs } = await opsGetFB();
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
                <button onclick="opsProbarAlerta()" style="background:#6d28d9;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;white-space:nowrap;">🔔 Probar alerta</button>
            </div>`
            + bloque("Críticas", "#E7402B", "#fee2e2", criticas)
            + bloque("Pendientes", "#b45309", "#fef3c7", pendientes)
            + bloque("Preventivas", "#854d0e", "#fef9c3", preventivas)
            + bloque("Información", "#1D2E73", "#e0e7ff", info)
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

    // ══════════════════════════════════════════════════════════
    // PLANEACIÓN OPERATIVA — Fase 1: modelo de datos + catálogo de
    // servicios (recetas parametrizadas), importado del Excel real de
    // Paloma. El motor de cálculo/calendario/disponibilidad son fases
    // siguientes — esto solo deja los datos bien estructurados y una
    // ficha para revisarlos, sin inventar cálculos todavía.
    // ══════════════════════════════════════════════════════════
    function _matBase(overoles, conFrecuencia) {
        const freq = conFrecuencia ? "frecuencia" : "proporcional";
        const notaFreq = conFrecuencia ? "se cambia cada 10 tanques" : null;
        const paramFreq = conFrecuencia ? 10 : null;
        return [
            { nombre: "Hule rojo 3.2mm", unidad: "m", costoUnitario: 0.01, cantidadBase: 80, reglaConsumo: "proporcional" },
            { nombre: "Silicón superseal marca FESTER", unidad: "pza", costoUnitario: 207.54, cantidadBase: 1, reglaConsumo: "proporcional" },
            { nombre: 'Tuercas 1/2" acero inoxidable', unidad: "pza", costoUnitario: 4.13, cantidadBase: 20, reglaConsumo: "proporcional" },
            { nombre: 'Arandela 1/2" acero inoxidable', unidad: "pza", costoUnitario: 2.10, cantidadBase: 20, reglaConsumo: "proporcional" },
            { nombre: "Desengrasante SIMPLE GREEN", unidad: "L", costoUnitario: 68.91, cantidadBase: 50, reglaConsumo: "proporcional" },
            { nombre: "Overol blanco desechable", unidad: "pza", costoUnitario: 43, cantidadBase: overoles, reglaConsumo: "proporcional" },
            { nombre: "Almohadillas para máscara 3M", unidad: "pza", costoUnitario: 36, cantidadBase: 6, reglaConsumo: "proporcional" },
            { nombre: "Cartuchos filtro 6003 3M", unidad: "pza", costoUnitario: 254, cantidadBase: 1.5, reglaConsumo: "proporcional" },
            { nombre: "Tambos 200L recolección de residuos", unidad: "pza", costoUnitario: 240, cantidadBase: 2, reglaConsumo: "proporcional" },
            { nombre: "Lata limpiador", unidad: "lata", costoUnitario: 453.60, cantidadBase: 0.33, reglaConsumo: "proporcional" },
            { nombre: "Lata líquido penetrante", unidad: "lata", costoUnitario: 510.30, cantidadBase: 0.33, reglaConsumo: "proporcional" },
            { nombre: "Lata líquido revelador", unidad: "lata", costoUnitario: 472.50, cantidadBase: 0.33, reglaConsumo: "proporcional" },
            { nombre: "Trapeador de microfibra", unidad: "pza", costoUnitario: 140, cantidadBase: 0.1, reglaConsumo: freq, parametroBase: paramFreq, nota: notaFreq },
            { nombre: "Escoba", unidad: "pza", costoUnitario: 100, cantidadBase: 0.1, reglaConsumo: freq, parametroBase: paramFreq, nota: notaFreq },
            { nombre: "Trapos de microfibra", unidad: "pza", costoUnitario: 20, cantidadBase: 0.1, reglaConsumo: freq, parametroBase: paramFreq, nota: notaFreq },
            { nombre: "Gasolina", unidad: "L", costoUnitario: 94.41, cantidadBase: 0.06, reglaConsumo: "proporcional" },
            { nombre: "Teflón", unidad: "pza", costoUnitario: 56.48, cantidadBase: 0.33, reglaConsumo: "proporcional" },
            { nombre: "Aceite penetrante", unidad: "pza", costoUnitario: 96.13, cantidadBase: 0.1, reglaConsumo: freq, parametroBase: paramFreq, nota: notaFreq },
        ];
    }
    const _herrBase = [
        "Juego básico de técnico", "Pistola eléctrica de impacto con dado de 3/4", "Distanciómetro digital de doble láser",
        "Linterna LED con lente ajustable", "Escalera articulada marca Cuprum", "Taladro inalámbrico brushless o neumático",
        "Carda tipo copa bañada en bronce de 2.5\" para taladro", "Medidor de ultrasonido", "Tripié con polipasto",
        "Pistola para silicón", "Llaves españolas de 3/4", "Escalera de 4.2 mts fija", "Bomba de diafragma neumática",
        "Bomba de diafragma eléctrica", "4 tótems de 1,000 litros (si hay pipa o autotanque)",
        "Tubería galvanizada o PVC 1\" extremos roscados", "Mangueras transparentes 1\" con conexiones Dixon",
        "Manguera de aire 1/4 x 30 mts", "Conexiones rápidas para aire 1/4", "Hidrolavadora eléctrica",
        "Manguera y pistola para hidrolavadora", "Porrón de 20 y 50 litros para SimpleGreen", "Pichancha de 1\"",
        "Manguera 1/2\" transparente 1.5 mts con conexiones tipo jardín", "Embudo de plástico 4\"",
        "Embudo metálico galvanizado 30cm", "2 reflectores LED con mica de plástico", "Soga 12.7mm x 8 mts con gancho",
        "3 cubetas de 19 litros", "2 palas antichispa", "Explosímetro", "Sobre tapa de plástico para cartucho", "Campana tipo cencerro",
    ];
    const _segBase = [
        { nombre: "Arnés de seguridad", cantidad: 2 },
        { nombre: "Máscara antigases 3M", cantidad: "1 por persona" },
        { nombre: "Botas de hule grandes", cantidad: 2 },
    ];
    const _vehBase = {
        sugerido: { nombre: "F-450 con remolque largo", razon: "Capacidad de carga y remolque para el equipo del servicio" },
        alternos: [{ nombre: "Camión Isuzu 450", condicion: "Si F-450 no está disponible" }, { nombre: "Silverado con remolque largo", condicion: "Si ninguno de los anteriores está disponible" }],
        duracionNota: "2 días de trabajo por tanque",
    };
    const _personalBase = [{ rol: "lider", cantidad: 1 }, { rol: "tecnico", cantidad: 2 }];

    // Datos reales tal como están en INTEGRIDAD_MECANICA.xlsx (Paloma, sep-2026) —
    // 9 pestañas = 9 recetas. Origen queda anotado por trazabilidad.
    function _recetasReales() {
        const base = (nombre, overoles, conFrecuencia, herrExtra) => ({
            nombre, categoria: "Mantenimiento a estaciones de servicio", tipoServicio: "ambos", activo: true,
            requiereObraCivil: false, requiereVehiculo: true, requiereRemolque: true,
            personal: _personalBase,
            materiales: _matBase(overoles, conFrecuencia),
            herramientaRequerida: [..._herrBase, ...(herrExtra || [])].map(d => ({ descripcion: d, cantidad: 1 })),
            equipoSeguridad: _segBase,
            vehiculos: _vehBase,
            origenImportacion: "Excel INTEGRIDAD_MECANICA.xlsx (Paloma, sep-2026)",
        });
        return [
            base("Remodelación de Instalación Eléctrica", 4, true),
            base("Cambio de Tubería Primaria", 4, true),
            base("Cambio de Contenedor", 3, false),
            base("Integridad Mecánica", 4, true, ["1 extensión de 30 mts", "2 extensiones de 10 mts (con dos tomacorrientes)"]),
            base("Retank", 3, false),
            base("Cambio de Contenedor de Motobomba", 4, true),
            base("Montaje de Dispensario", 4, true),
            base("Instalación de Cónsolas de Tanques", 4, true),
            {
                nombre: "Cambio de Botas de Contenedor", categoria: "Mantenimiento a estaciones de servicio",
                tipoServicio: "externo", activo: true, requiereObraCivil: true, requiereVehiculo: true, requiereRemolque: false,
                personal: [{ rol: "lider", cantidad: 1 }, { rol: "tecnico", cantidad: 1 }, { rol: "obra_civil", cantidad: 2 }],
                materiales: [
                    { nombre: "Bota BTR4015 (bota completa)", unidad: "pza", costoUnitario: 0.01, cantidadBase: 1, reglaConsumo: "proporcional" },
                    { nombre: "Bota BR4015 (solo parte interior)", unidad: "pza", costoUnitario: 0, cantidadBase: 1, reglaConsumo: "proporcional" },
                ],
                herramientaRequerida: [
                    { descripcion: "Extensión eléctrica (3 de 15 mts)", cantidad: 1, etapa: "tecnico" },
                    { descripcion: "Cegueta manual o sable eléctrico", cantidad: 1, etapa: "tecnico" },
                    { descripcion: "Juego de dados", cantidad: 1, etapa: "tecnico" },
                    { descripcion: 'Saca bocados de 6" para bota de 4.5"', cantidad: 1, etapa: "tecnico" },
                    { descripcion: "Kit de herramienta básica técnico", cantidad: 1, etapa: "tecnico" },
                    { descripcion: "Broca de 3/8", cantidad: 1, etapa: "tecnico" },
                    { descripcion: "Aspiradora", cantidad: 1, etapa: "tecnico" },
                    { descripcion: "Carrucha", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Demoledor de 25 kilos con punta", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Pala de punta", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Pala cuadrada", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Pico", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Barra", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Llana y flota", cantidad: 1, etapa: "obra_civil" },
                    { descripcion: "Retiro de escombro (se programa con proveedor o se lleva en la troca)", cantidad: 1, etapa: "obra_civil" },
                ],
                equipoSeguridad: _segBase,
                vehiculos: {
                    sugerido: { nombre: "RAM 700", razon: "Vehículo asignado en la receta original" },
                    alternos: [{ nombre: "L200", condicion: "Si RAM 700 no está disponible" }],
                    duracionNota: "2 días de trabajo por tanque",
                },
                origenImportacion: "Excel INTEGRIDAD_MECANICA.xlsx, pestaña CAMBIO DE BOTAS DE CONTENEDOR (Paloma, sep-2026) — datos de costo incompletos en el original, revisar antes de usarse para costeo real",
                notaImportacion: "Personal 'Pepito Ismael' de la hoja original no tenía sueldo capturado — Ismael y Pepito son quienes cubren técnico + obra civil, según lo platicado con Paloma.",
            },
        ];
    }

    window.opsAbrirModalNuevoServicio = function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">Nuevo servicio</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre del servicio</label>
                <input id="ops-in-nuevoserv-nombre" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Categoría</label>
                <input id="ops-in-nuevoserv-categoria" placeholder="Ej. Mantenimiento a estaciones de servicio" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Tipo</label>
                <select id="ops-in-nuevoserv-tipo" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">
                    <option value="ambos">Interno/Externo</option>
                    <option value="interno">Interno</option>
                    <option value="externo">Externo</option>
                </select>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsCrearServicioNuevo()" class="mkt-add-btn" style="background:#1D2E73;">Crear y editar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsCrearServicioNuevo = async function () {
        const nombre = document.getElementById("ops-in-nuevoserv-nombre").value.trim();
        if (!nombre) { alert("Captura el nombre"); return; }
        const categoria = document.getElementById("ops-in-nuevoserv-categoria").value.trim();
        const tipoServicio = document.getElementById("ops-in-nuevoserv-tipo").value;
        try {
            const { db, fs } = await opsGetFB();
            const id = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now().toString(36);
            const datos = {
                nombre, categoria, tipoServicio, activo: true,
                requiereObraCivil: false, requiereVehiculo: true, requiereRemolque: false,
                personal: [{ rol: "tecnico", cantidad: 1 }],
                materiales: [], herramientaRequerida: [], equipoSeguridad: [],
                vehiculos: { sugerido: { nombre: "", razon: "" }, alternos: [] },
                origenImportacion: "Creado manualmente en el portal", fechaAlta: opsHoy(), creadoPor: opsNombreActual(),
            };
            await fs.setDoc(fs.doc(db, COL_SERVICIOS_CATALOGO, id), datos);
            await fs.addDoc(fs.collection(db, COL_SERVICIOS_CATALOGO, id, "historial"), {
                usuario: opsNombreActual(), usuarioEmail: opsUsuarioActual(), fecha: opsFechaHora(), resumen: "Servicio creado",
            }).catch(() => {});
            document.getElementById("ops-modal-wrap").innerHTML = "";
            cacheServiciosCatalogo.push({ id, ...datos });
            opsAbrirFichaServicio(id);
        } catch (err) {
            alert("No se pudo crear: " + err.message);
        }
    };

    window.opsImportarRecetasReales = async function () {
        if (!confirm("Esto crea/actualiza las 9 recetas reales del Excel de Paloma en el catálogo de servicios. ¿Continuar?")) return;
        try {
            const { db, fs } = await opsGetFB();
            const recetas = _recetasReales();
            for (const r of recetas) {
                const id = r.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                await fs.setDoc(fs.doc(db, COL_SERVICIOS_CATALOGO, id), { ...r, fechaAlta: opsHoy(), creadoPor: opsNombreActual() }, { merge: true });
            }
            // Tarifas de personal — costo real por rol, calculado UNA vez a partir de
            // los 3 empleados del Excel (sueldo + IMSS patrón + INFONAVIT bimestral/2,
            // entre 30 días). Es un punto de partida editable, no un valor fijo — el
            // costo por nombre de empleado NO se guarda aquí, solo el promedio por rol.
            const tarifas = {
                lider: { costoDia: Math.round(((29594.78 + 4086.42 + 6072.61 / 2) / 30) * 100) / 100, nota: "Calculado de Sergio Mendoza (líder) en el Excel — ajustar si cambia el sueldo real." },
                tecnico: { costoDia: Math.round((((15502.10 + 2490.23 + 3034.22 / 2) / 30 + (16660.72 + 2747.93 + 3280.53 / 2) / 30) / 2) * 100) / 100, nota: "Promedio de Barraza y Luna (técnicos) en el Excel — ajustar si cambia el equipo." },
                obra_civil: { costoDia: Math.round((((15502.10 + 2490.23 + 3034.22 / 2) / 30 + (16660.72 + 2747.93 + 3280.53 / 2) / 30) / 2) * 100) / 100, nota: "Sin dato propio en el Excel — se usó el promedio de técnico como punto de partida. Ajustar." },
            };
            for (const rol in tarifas) {
                await fs.setDoc(fs.doc(db, COL_TARIFAS_PERSONAL, rol), tarifas[rol], { merge: true });
            }
            alert(`Listo — ${recetas.length} recetas de servicio importadas/actualizadas, y tarifas de personal por rol creadas (editables en Planeación).`);
        } catch (err) {
            console.error("[operaciones.js] error al importar recetas:", err);
            alert("No se pudo importar: " + err.message);
        }
    };

    function opsRenderCatalogoRecetas() {
        const el = document.getElementById("ops-catalogo-recetas-contenido");
        if (!el) return;
        const gestion = opsPuedeGestionar();
        el.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
                <div>
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Catálogo de servicios (recetas)</div>
                    <div style="font-size:11px;color:#94a3b8;">Fase 1 — modelo de datos y recetas. El cálculo automático por cantidad, el calendario y la disponibilidad son las siguientes fases.</div>
                </div>
                ${gestion ? `<div style="display:flex;gap:8px;"><button onclick="opsAbrirModalNuevoServicio()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo servicio</button><button onclick="opsImportarRecetasReales()" class="mkt-add-btn" style="background:#15803D;">${ICON.file} Importar recetas reales (9 servicios)</button></div>` : ""}
            </div>
            ${Object.keys(cacheTarifasPersonal).length ? `
            <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:13px 16px;margin-bottom:16px;">
                <div style="font-size:11.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Tarifas de personal por rol (costo-día, editable)</div>
                <div style="display:flex;gap:18px;flex-wrap:wrap;">
                    ${Object.entries(cacheTarifasPersonal).map(([rol, t]) => `
                        <div>
                            <div style="font-size:10.5px;color:#94a3b8;text-transform:uppercase;">${opsEsc(rol.replace("_", " "))}</div>
                            <div style="font-size:16px;font-weight:700;color:#1D2E73;">$${Number(t.costoDia || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}<span style="font-size:10.5px;color:#94a3b8;font-weight:400;">/día</span></div>
                        </div>`).join("")}
                </div>
                <div style="font-size:10px;color:#94a3b8;margin-top:8px;">Calculado del Excel de Paloma (sueldo + IMSS patrón + INFONAVIT/2, entre 30 días) — es un punto de partida, no un valor fijo de nómina.</div>
            </div>` : ""}
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
                ${cacheServiciosCatalogo.length ? cacheServiciosCatalogo.map(s => `
                    <div onclick="opsAbrirFichaServicio('${s.id}')" style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:15px 16px;cursor:pointer;transition:border-color .15s;" onmouseover="this.style.borderColor='#1D2E73'" onmouseout="this.style.borderColor='#e2e8f0'">
                        <div style="font-size:13.5px;font-weight:700;color:#1e293b;line-height:1.3;">${opsEsc(s.nombre)}</div>
                        <div style="font-size:11px;color:#94a3b8;margin:2px 0 10px;">${opsEsc(s.categoria || "Sin categoría")} · ${s.tipoServicio === "externo" ? "Externo" : (s.tipoServicio === "interno" ? "Interno" : "Interno/Externo")}</div>
                        <div style="font-size:11px;color:#334155;">${(s.personal || []).map(p => `${p.cantidad} ${p.rol.replace("_", " ")}`).join(" · ")}</div>
                        <div style="font-size:11px;color:#334155;margin-top:3px;">${(s.materiales || []).length} materiales · ${(s.herramientaRequerida || []).length} herramientas</div>
                    </div>`).join("") : `<div style="grid-column:1/-1;padding:40px;text-align:center;color:#94a3b8;background:#fff;border-radius:14px;border:1px solid #e2e8f0;">Sin servicios en el catálogo todavía.${gestion ? ' Usa "Importar recetas reales".' : ""}</div>`}
            </div>`;
    }

    // Ficha de servicio: editable de verdad (personal, materiales, herramienta,
    // seguridad, vehículos) + semáforo de disponibilidad real contra el catálogo
    // de herramientas y la flota de Flotilla. Horarios/vacaciones de técnico NO
    // se cruzan aquí — ese dato no existe todavía en ningún lado del portal.
    let servicioEditDraft = null;
    let servicioOriginalSnapshot = null; // para poder resumir qué cambió al guardar
    let dispoServicioActual = null; // null = aún cargando
    let fichaServTabActual = "resumen";
    let servicioHistorialCache = null; // null = no cargado todavía (se carga al abrir la pestaña Historial)

    window.opsFichaServCambiarTab = function (tab) {
        fichaServTabActual = tab;
        if (tab === "historial" && servicioHistorialCache === null) opsCargarHistorialServicio();
        opsRenderFichaServicio();
    };

    async function opsCargarHistorialServicio() {
        servicioHistorialCache = []; // evita relanzar la carga mientras resuelve
        try {
            const { db, fs } = await opsGetFB();
            const snap = await fs.getDocs(fs.query(fs.collection(db, COL_SERVICIOS_CATALOGO, servicioEditDraft.id, "historial"), fs.orderBy("fecha", "desc")));
            servicioHistorialCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
            console.warn("[operaciones.js] no se pudo cargar historial del servicio:", err);
            servicioHistorialCache = [];
        }
        if (fichaServTabActual === "historial") opsRenderFichaServicio();
    }

    function _resumenCambiosServicio(antes, despues) {
        const cambios = [];
        if (antes.nombre !== despues.nombre) cambios.push(`Nombre: "${antes.nombre}" → "${despues.nombre}"`);
        if (antes.categoria !== despues.categoria) cambios.push(`Categoría: "${antes.categoria || "—"}" → "${despues.categoria || "—"}"`);
        const campos = [["materiales", "Materiales"], ["herramientaRequerida", "Herramienta"], ["personal", "Roles de personal"], ["equipoSeguridad", "Equipo de seguridad"]];
        campos.forEach(([campo, label]) => {
            const nA = (antes[campo] || []).length, nD = (despues[campo] || []).length;
            if (nA !== nD) cambios.push(`${label}: ${nA} → ${nD}`);
            else if (JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo])) cambios.push(`${label} editado(s)`);
        });
        if (JSON.stringify(antes.vehiculos) !== JSON.stringify(despues.vehiculos)) cambios.push("Vehículos modificados");
        return cambios.length ? cambios.join(" · ") : "Guardado sin cambios de contenido detectados";
    }

    window.opsAbrirFichaServicio = function (id) {
        const s = cacheServiciosCatalogo.find(x => x.id === id);
        if (!s) return;
        servicioEditDraft = JSON.parse(JSON.stringify(s));
        servicioOriginalSnapshot = JSON.parse(JSON.stringify(s));
        dispoServicioActual = null;
        fichaServTabActual = "resumen";
        servicioHistorialCache = null;
        opsRenderFichaServicio();
        opsVerificarDisponibilidadServicio();
    };

    function opsServSet(ruta, valor) {
        const partes = ruta.split(".");
        let obj = servicioEditDraft;
        for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
        obj[partes[partes.length - 1]] = valor;
    }
    window.opsServCampo = function (ruta, valor, esNumero) { opsServSet(ruta, esNumero ? Number(valor) || 0 : valor); };

    window.opsServAgregarFila = function (lista, plantilla) {
        if (!servicioEditDraft[lista]) servicioEditDraft[lista] = [];
        servicioEditDraft[lista].push(JSON.parse(JSON.stringify(plantilla)));
        opsRenderFichaServicio();
    };
    window.opsServQuitarFila = function (lista, idx) {
        servicioEditDraft[lista].splice(idx, 1);
        opsRenderFichaServicio();
    };
    window.opsServAgregarAlterno = function () {
        if (!servicioEditDraft.vehiculos) servicioEditDraft.vehiculos = { sugerido: { nombre: "", razon: "" }, alternos: [] };
        if (!servicioEditDraft.vehiculos.alternos) servicioEditDraft.vehiculos.alternos = [];
        servicioEditDraft.vehiculos.alternos.push({ nombre: "", condicion: "" });
        opsRenderFichaServicio();
    };
    window.opsServQuitarAlterno = function (idx) {
        servicioEditDraft.vehiculos.alternos.splice(idx, 1);
        opsRenderFichaServicio();
    };

    window.opsGuardarServicio = async function () {
        const btn = document.getElementById("ops-serv-btn-guardar");
        if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
        try {
            const { db, fs } = await opsGetFB();
            const { id, ...datos } = servicioEditDraft;
            const resumen = _resumenCambiosServicio(servicioOriginalSnapshot, servicioEditDraft);
            await fs.setDoc(fs.doc(db, COL_SERVICIOS_CATALOGO, id), datos, { merge: false });
            await fs.addDoc(fs.collection(db, COL_SERVICIOS_CATALOGO, id, "historial"), {
                usuario: opsNombreActual(), usuarioEmail: opsUsuarioActual(),
                fecha: opsFechaHora(), resumen,
            }).catch(err => console.warn("[operaciones.js] no se pudo registrar el historial:", err));
            servicioOriginalSnapshot = JSON.parse(JSON.stringify(servicioEditDraft));
            servicioHistorialCache = null; // se recarga la próxima vez que se abra esa pestaña
            if (btn) { btn.disabled = false; btn.textContent = "Guardar cambios"; }
            window.mostrarPush ? mostrarPush("Planeación", "Receta de servicio guardada.", ICON.check) : alert("Guardado.");
        } catch (err) {
            console.error("[operaciones.js] error al guardar servicio:", err);
            alert("No se pudo guardar: " + err.message);
            if (btn) { btn.disabled = false; btn.textContent = "Guardar cambios"; }
        }
    };

    // Cruce best-effort: no hay ids compartidos entre la receta (texto libre,
    // copiado del Excel) y el catálogo real de herramientas/flota, así que se
    // compara por nombre normalizado. Es una ayuda para decidir, no un dato exacto.
    function _normTxt(s) { return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
    function _coincideTexto(a, b) {
        const na = _normTxt(a), nb = _normTxt(b);
        if (!na || !nb) return false;
        return na.includes(nb) || nb.includes(na);
    }

    async function opsVerificarDisponibilidadServicio() {
        const s = servicioEditDraft;
        const herramientaDispo = (s.herramientaRequerida || []).map(req => {
            const coincidencias = cacheHerr.filter(h => h.estado !== "baja" && _coincideTexto(h.descripcion, req.descripcion));
            const disponibles = coincidencias.filter(h => h.estado === "disponible").length;
            const total = coincidencias.length;
            let semaforo = "roja";
            if (total === 0) semaforo = "roja";
            else if (disponibles >= (req.cantidad || 1)) semaforo = "verde";
            else if (total >= (req.cantidad || 1)) semaforo = "amarilla";
            else semaforo = "roja";
            return { descripcion: req.descripcion, cantidad: req.cantidad || 1, total, disponibles, semaforo };
        });

        let vehiculosDispo = [];
        try {
            const { db, fs } = await opsGetFB();
            const snap = await fs.getDocs(fs.collection(db, "flotilla_vehiculos"));
            const flota = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const candidatos = [
                { nombre: s.vehiculos?.sugerido?.nombre, rol: "Sugerido" },
                ...((s.vehiculos?.alternos || []).map(v => ({ nombre: v.nombre, rol: "Alterno" }))),
            ].filter(c => c.nombre);
            vehiculosDispo = candidatos.map(c => {
                const match = flota.find(v => _coincideTexto((v.marca || "") + " " + (v.modelo || ""), c.nombre) || _coincideTexto(v.eco ? "eco " + v.eco : "", c.nombre));
                if (!match) return { ...c, encontrado: false, estatusTexto: "No se encontró en la flota (revisa el nombre)", semaforo: "gris" };
                const estatus = (match.estatus || match.estado || "").toLowerCase();
                const libre = estatus.includes("activo") || estatus.includes("disponible") || !estatus;
                return { ...c, encontrado: true, eco: match.eco, estatusTexto: match.estatus || match.estado || "—", semaforo: libre ? "verde" : "roja" };
            });
        } catch (err) {
            console.warn("[operaciones.js] no se pudo verificar flota:", err);
        }

        dispoServicioActual = { herramientaDispo, vehiculosDispo };
        opsRenderFichaServicio();
    }

    window.opsExportarServicioPDF = function () {
        const s = servicioEditDraft;
        if (!window.jspdf) { alert("jsPDF no está cargado."); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const M = 14, W = 216 - M * 2;
        let y = 16;
        doc.setFont("helvetica", "bold"); doc.setFontSize(14);
        doc.text(s.nombre.toUpperCase(), M, y); y += 6;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(90);
        doc.text("HEDMA TECNOCONTROL S.A. DE C.V. — Receta de servicio", M, y); y += 5;
        doc.text(`${s.categoria || ""} · ${s.tipoServicio === "externo" ? "Externo" : (s.tipoServicio === "interno" ? "Interno" : "Interno/Externo")}`, M, y); y += 8;
        doc.setTextColor(20);

        function seccion(titulo) {
            if (y > 260) { doc.addPage(); y = 16; }
            doc.setFont("helvetica", "bold"); doc.setFontSize(11);
            doc.setFillColor(29, 46, 115); doc.setTextColor(255);
            doc.rect(M, y - 4, W, 6, "F");
            doc.text(titulo, M + 2, y); y += 8;
            doc.setTextColor(20); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
        }
        function linea(txt) {
            if (y > 275) { doc.addPage(); y = 16; }
            doc.text(txt, M, y, { maxWidth: W }); y += 5;
        }

        seccion("PERSONAL");
        (s.personal || []).forEach(p => linea(`${p.cantidad} × ${p.rol.replace("_", " ")}`));
        y += 3;

        seccion("VEHÍCULO");
        linea(`Sugerido: ${s.vehiculos?.sugerido?.nombre || "—"} — ${s.vehiculos?.sugerido?.razon || ""}`);
        (s.vehiculos?.alternos || []).forEach(v => linea(`Alterno: ${v.nombre} — ${v.condicion || ""}`));
        y += 3;

        seccion(`MATERIALES (${(s.materiales || []).length})`);
        (s.materiales || []).forEach(m => linea(`${m.nombre} — ${m.cantidadBase} ${m.unidad} · $${m.costoUnitario}${m.nota ? " (" + m.nota + ")" : ""}`));
        y += 3;

        seccion("EQUIPO DE SEGURIDAD");
        (s.equipoSeguridad || []).forEach(e => linea(`${e.nombre} — ${e.cantidad}`));
        y += 3;

        seccion(`HERRAMIENTA REQUERIDA (${(s.herramientaRequerida || []).length})`);
        (s.herramientaRequerida || []).forEach(h => linea(`${h.etapa === "obra_civil" ? "[Obra civil] " : ""}${h.descripcion}${h.cantidad > 1 ? ` ×${h.cantidad}` : ""}`));

        doc.save(`Receta_${s.nombre.replace(/\s+/g, "_")}.pdf`);
    };

    window.opsExportarServicioCSV = function () {
        const s = servicioEditDraft;
        const filas = [["SECCIÓN", "DESCRIPCIÓN", "CANTIDAD", "UNIDAD", "COSTO UNITARIO", "NOTA"]];
        (s.personal || []).forEach(p => filas.push(["Personal", p.rol.replace("_", " "), p.cantidad, "", "", ""]));
        filas.push(["Vehículo", "Sugerido: " + (s.vehiculos?.sugerido?.nombre || ""), "", "", "", s.vehiculos?.sugerido?.razon || ""]);
        (s.vehiculos?.alternos || []).forEach(v => filas.push(["Vehículo", "Alterno: " + v.nombre, "", "", "", v.condicion || ""]));
        (s.materiales || []).forEach(m => filas.push(["Material", m.nombre, m.cantidadBase, m.unidad, m.costoUnitario, m.nota || ""]));
        (s.equipoSeguridad || []).forEach(e => filas.push(["Equipo de seguridad", e.nombre, e.cantidad, "", "", ""]));
        (s.herramientaRequerida || []).forEach(h => filas.push(["Herramienta", h.descripcion, h.cantidad, "", "", h.etapa === "obra_civil" ? "Obra civil" : ""]));
        const csv = filas.map(fila => fila.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
        const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }); // BOM para que Excel abra bien los acentos
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `Receta_${s.nombre.replace(/\s+/g, "_")}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const _colorSemaforo = { verde: "#15803D", amarilla: "#b45309", roja: "#E7402B", gris: "#94a3b8" };
    const _bgSemaforo = { verde: "#dcfce7", amarilla: "#fef3c7", roja: "#fee2e2", gris: "#f1f5f9" };

    function opsRenderFichaServicio() {
        const s = servicioEditDraft;
        if (!s) return;
        const wrap = document.getElementById("ops-panel-wrap");
        const gestion = opsPuedeGestionar();
        const inp = (val, ruta, esNumero, placeholder, ancho) => `<input value="${opsEsc(val ?? "")}" placeholder="${opsEsc(placeholder || "")}" ${esNumero ? 'type="number" step="any"' : ""} oninput="opsServCampo('${ruta}', this.value, ${!!esNumero})" style="width:${ancho || "100%"};border:1px solid #cbd5e1;border-radius:6px;padding:5px 7px;font-size:11.5px;" ${gestion ? "" : "disabled"}>`;

        const tabResumen = `
                <div style="margin-top:14px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Disponibilidad de herramienta</div>
                    ${dispoServicioActual === null ? '<div style="color:#94a3b8;font-size:11.5px;">Verificando contra el catálogo real...</div>' :
                        dispoServicioActual.herramientaDispo.map(d => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;">
                            <span style="font-size:11.5px;color:#334155;">${opsEsc(d.descripcion)}</span>
                            <span style="background:${_bgSemaforo[d.semaforo]};color:${_colorSemaforo[d.semaforo]};font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;">Necesarios ${d.cantidad} · Disponibles ${d.disponibles}/${d.total}</span>
                        </div>`).join("")}
                    ${dispoServicioActual && !dispoServicioActual.herramientaDispo.length ? '<div style="color:#94a3b8;font-size:11px;">Sin herramienta en la receta.</div>' : ""}
                    <div style="font-size:10px;color:#94a3b8;margin-top:6px;">Se compara por nombre contra tu catálogo de Herramientas — si no coincide exacto, revisa el nombre en ambos lados.</div>
                </div>

                <div style="margin-top:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Disponibilidad de vehículo</div>
                    ${dispoServicioActual === null ? '<div style="color:#94a3b8;font-size:11.5px;">Verificando contra Flotilla...</div>' :
                        (dispoServicioActual.vehiculosDispo.length ? dispoServicioActual.vehiculosDispo.map(v => `
                        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;">
                            <span style="font-size:11.5px;color:#334155;">${opsEsc(v.rol)}: ${opsEsc(v.nombre)}</span>
                            <span style="background:${_bgSemaforo[v.semaforo]};color:${_colorSemaforo[v.semaforo]};font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;">${opsEsc(v.estatusTexto)}</span>
                        </div>`).join("") : '<div style="color:#94a3b8;font-size:11px;">Sin vehículo configurado.</div>')}
                </div>

                <div style="margin-top:16px;background:#f8fafc;border-radius:8px;padding:9px 11px;font-size:10.5px;color:#64748b;">Personal y horarios: aún no se cruza contra la disponibilidad real — falta la fecha del servicio (Fase 5, calendario). Ya existe el calendario de vacaciones/incapacidad/permiso por técnico en su ficha (pestaña Ausencias).</div>

                <div style="margin-top:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Personal</div>
                    ${(s.personal || []).map((p, i) => `
                        <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center;">
                            <select onchange="opsServCampo('personal.${i}.rol', this.value)" style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:5px 7px;font-size:11.5px;" ${gestion ? "" : "disabled"}>
                                ${["lider", "tecnico", "obra_civil"].map(r => `<option value="${r}" ${p.rol === r ? "selected" : ""}>${r.replace("_", " ")}</option>`).join("")}
                            </select>
                            ${inp(p.cantidad, `personal.${i}.cantidad`, true, "Cant.", "60px")}
                            ${gestion ? `<button onclick="opsServQuitarFila('personal',${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                        </div>`).join("")}
                    ${gestion ? `<button onclick="opsServAgregarFila('personal',{rol:'tecnico',cantidad:1})" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">+ Agregar rol</button>` : ""}
                </div>

                <div style="margin-top:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Vehículo</div>
                    <div style="font-size:10.5px;color:#64748b;margin-bottom:3px;">Sugerido</div>
                    <div style="display:flex;gap:6px;margin-bottom:8px;">
                        ${inp(s.vehiculos?.sugerido?.nombre, "vehiculos.sugerido.nombre", false, "Nombre del vehículo")}
                        ${inp(s.vehiculos?.sugerido?.razon, "vehiculos.sugerido.razon", false, "Razón")}
                    </div>
                    <div style="font-size:10.5px;color:#64748b;margin-bottom:3px;">Alternos</div>
                    ${(s.vehiculos?.alternos || []).map((v, i) => `
                        <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center;">
                            ${inp(v.nombre, `vehiculos.alternos.${i}.nombre`, false, "Nombre")}
                            ${inp(v.condicion, `vehiculos.alternos.${i}.condicion`, false, "Condición")}
                            ${gestion ? `<button onclick="opsServQuitarAlterno(${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                        </div>`).join("")}
                    ${gestion ? `<button onclick="opsServAgregarAlterno()" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">+ Agregar alterno</button>` : ""}
                </div>`;

        const tabMateriales = `
                <div style="margin-top:14px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Materiales (${(s.materiales || []).length})</div>
                    ${(s.materiales || []).map((m, i) => `
                        <div style="border:1px solid #f1f5f9;border-radius:7px;padding:7px 8px;margin-bottom:6px;">
                            <div style="display:flex;gap:6px;margin-bottom:5px;">
                                ${inp(m.nombre, `materiales.${i}.nombre`, false, "Nombre del material")}
                                ${gestion ? `<button onclick="opsServQuitarFila('materiales',${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                            </div>
                            <div style="display:flex;gap:6px;">
                                ${inp(m.cantidadBase, `materiales.${i}.cantidadBase`, true, "Cant.", "60px")}
                                ${inp(m.unidad, `materiales.${i}.unidad`, false, "Unidad", "60px")}
                                ${inp(m.costoUnitario, `materiales.${i}.costoUnitario`, true, "Costo unit.", "70px")}
                                <select onchange="opsServCampo('materiales.${i}.reglaConsumo', this.value)" style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:5px 7px;font-size:11px;" ${gestion ? "" : "disabled"}>
                                    <option value="proporcional" ${m.reglaConsumo === "proporcional" ? "selected" : ""}>Proporcional</option>
                                    <option value="frecuencia" ${m.reglaConsumo === "frecuencia" ? "selected" : ""}>Por frecuencia</option>
                                </select>
                            </div>
                        </div>`).join("")}
                    ${gestion ? `<button onclick="opsServAgregarFila('materiales',{nombre:'',unidad:'pza',costoUnitario:0,cantidadBase:1,reglaConsumo:'proporcional'})" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">+ Agregar material</button>` : ""}
                </div>`;

        const tabHerramienta = `
                <div style="margin-top:14px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Equipo de seguridad</div>
                    ${(s.equipoSeguridad || []).map((e, i) => `
                        <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center;">
                            ${inp(e.nombre, `equipoSeguridad.${i}.nombre`, false, "Nombre")}
                            ${inp(e.cantidad, `equipoSeguridad.${i}.cantidad`, false, "Cant.", "90px")}
                            ${gestion ? `<button onclick="opsServQuitarFila('equipoSeguridad',${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                        </div>`).join("")}
                    ${gestion ? `<button onclick="opsServAgregarFila('equipoSeguridad',{nombre:'',cantidad:1})" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">+ Agregar equipo</button>` : ""}
                </div>

                <div style="margin-top:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Herramienta requerida (${(s.herramientaRequerida || []).length})</div>
                    ${(s.herramientaRequerida || []).map((h, i) => `
                        <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center;">
                            ${inp(h.descripcion, `herramientaRequerida.${i}.descripcion`, false, "Descripción")}
                            ${inp(h.cantidad, `herramientaRequerida.${i}.cantidad`, true, "Cant.", "55px")}
                            <select onchange="opsServCampo('herramientaRequerida.${i}.etapa', this.value)" style="border:1px solid #cbd5e1;border-radius:6px;padding:5px 7px;font-size:11px;" ${gestion ? "" : "disabled"}>
                                <option value="tecnico" ${h.etapa !== "obra_civil" ? "selected" : ""}>Técnico</option>
                                <option value="obra_civil" ${h.etapa === "obra_civil" ? "selected" : ""}>Obra civil</option>
                            </select>
                            ${gestion ? `<button onclick="opsServQuitarFila('herramientaRequerida',${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                        </div>`).join("")}
                    ${gestion ? `<button onclick="opsServAgregarFila('herramientaRequerida',{descripcion:'',cantidad:1,etapa:'tecnico'})" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">+ Agregar herramienta</button>` : ""}
                </div>`;

        const tabHistorial = `
                <div style="margin-top:14px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Historial de cambios</div>
                    ${servicioHistorialCache === null ? '<div style="color:#94a3b8;font-size:11.5px;">Cargando...</div>' :
                        (servicioHistorialCache.length ? servicioHistorialCache.map(h => `
                        <div style="border-left:2px solid #e2e8f0;padding-left:12px;margin-bottom:12px;position:relative;">
                            <div style="position:absolute;left:-5px;top:3px;width:8px;height:8px;border-radius:50%;background:#1D2E73;"></div>
                            <div style="font-size:11.5px;font-weight:600;color:#1e293b;">${opsEsc(h.usuario || h.usuarioEmail || "—")}</div>
                            <div style="font-size:10.5px;color:#94a3b8;margin-bottom:3px;">${opsEsc((h.fecha || "").replace("T", " ").slice(0, 16))}</div>
                            <div style="font-size:11.5px;color:#334155;">${opsEsc(h.resumen || "")}</div>
                        </div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin cambios registrados todavía — el historial empieza a llenarse desde el primer "Guardar cambios".</div>')}
                </div>`;

        const contenidoTab = { resumen: tabResumen, materiales: tabMateriales, herramienta: tabHerramienta, historial: tabHistorial }[fichaServTabActual];

        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99998;display:flex;align-items:center;justify-content:center;padding:26px;" onclick="if(event.target===this){document.getElementById('ops-panel-wrap').innerHTML='';servicioEditDraft=null;dispoServicioActual=null;}">
            <div style="background:#fff;width:640px;max-width:94vw;max-height:90vh;overflow-y:auto;border-radius:16px;padding:26px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div style="flex:1;">
                        ${inp(s.nombre, "nombre", false, "Nombre del servicio", "100%")}
                        <div style="font-size:11px;color:#94a3b8;margin-top:4px;">${opsEsc(s.categoria || "")}</div>
                    </div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML='';servicioEditDraft=null;dispoServicioActual=null;" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;margin-left:8px;">${ICON.close}</button>
                </div>

                <div style="display:flex;gap:6px;margin:12px 0 4px;">
                    <button onclick="opsExportarServicioPDF()" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">${ICON.file} PDF</button>
                    <button onclick="opsExportarServicioCSV()" style="background:#eef2f7;border:none;color:#1D2E73;padding:6px 11px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;">${ICON.file} Excel (CSV)</button>
                </div>

                <div style="display:flex;gap:2px;margin:12px 0;border-bottom:1px solid #e2e8f0;overflow-x:auto;">
                    ${["resumen:Resumen", "materiales:Materiales", "herramienta:Herramienta y seguridad", "historial:Historial"].map(x => {
                        const [tid, label] = x.split(":");
                        const on = fichaServTabActual === tid;
                        return `<button onclick="opsFichaServCambiarTab('${tid}')" style="background:none;border:none;padding:8px 9px;font-size:11px;font-weight:600;white-space:nowrap;color:${on ? "#1D2E73" : "#64748b"};border-bottom:2px solid ${on ? "#1D2E73" : "transparent"};cursor:pointer;">${label}</button>`;
                    }).join("")}
                </div>

                ${contenidoTab}

                ${fichaServTabActual !== "historial" && s.notaImportacion ? `<div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:11px;color:#92400e;">${opsEsc(s.notaImportacion)}</div>` : ""}
                ${fichaServTabActual !== "historial" ? `<div style="margin-top:10px;font-size:10px;color:#cbd5e1;">${opsEsc(s.origenImportacion || "")}</div>` : ""}

                ${gestion && fichaServTabActual !== "historial" ? `<div style="margin-top:18px;text-align:right;"><button id="ops-serv-btn-guardar" onclick="opsGuardarServicio()" class="mkt-add-btn" style="background:#1D2E73;">Guardar cambios</button></div>` : ""}
            </div>
        </div>`;
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
                <div style="background:#fff;border-radius:12px;padding:13px 15px;"><div style="font-size:10.5px;color:#94a3b8;">Incidencias (daño/pérdida/baja)</div><div style="font-size:19px;font-weight:700;color:#E7402B;">${kpiIncidencias}</div></div>
            </div>
            <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Central de movimientos</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${["todos:Todos", "hoy:Hoy", "semana:Semana", "mes:Mes", "trimestre:Últimos 3 meses"].map(r => {
                            const [id, label] = r.split(":");
                            const activo = filtroMovRango === id;
                            return `<button onclick="opsFiltrarMovRango('${id}')" style="background:${activo ? "#1D2E73" : "#f1f5f9"};color:${activo ? "#fff" : "#475569"};border:none;font-size:10.5px;font-weight:600;padding:6px 10px;border-radius:7px;cursor:pointer;">${label}</button>`;
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
        const color = { asignacion: "#1D2E73", transferencia: "#1D2E73", devolucion: "#059669", baja: "#E7402B", danio: "#E7402B", perdida: "#E7402B", reparacion: "#b45309", alta: "#64748b" }[m.tipo] || "#64748b";
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
