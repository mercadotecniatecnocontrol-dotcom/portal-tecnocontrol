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
    let unsubHerr = null, unsubTec = null, unsubMov = null;
    let cacheHerr = [], cacheTec = [], cacheMov = [];
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

    // ── Roles (reutiliza lo que ya existe en index.html) ─────────────
    function opsRolActual() {
        const email = opsUsuarioActual();
        if (window.esAdminTotal && window.esAdminTotal(email)) return "administrador";
        const almacen = (window.USUARIOS_AREA && window.USUARIOS_AREA["Almacen"]) || [];
        if (almacen.map(e => e.toLowerCase()).includes(email.toLowerCase())) return "almacen";
        return "consulta";
    }
    function opsPuedeGestionar() {
        const rol = opsRolActual();
        return rol === "administrador" || rol === "almacen";
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
        await opsSuscribirTodo();
        opsCambiarTab("dashboard");
    };

    window.opsCerrarHerramientas = function () {
        const cont = document.getElementById("ops-herramientas-overlay");
        if (cont) cont.style.display = "none";
        document.body.style.overflow = "";
        if (unsubHerr) { unsubHerr(); unsubHerr = null; }
        if (unsubTec)  { unsubTec();  unsubTec = null; }
        if (unsubMov)  { unsubMov();  unsubMov = null; }
    };

    function opsRenderShell() {
        const rol = opsRolActual();
        const rolLabel = { administrador: "Administrador", almacen: "Almacén", consulta: "Consulta" }[rol];
        return `
        <div style="position:fixed;inset:0;z-index:99997;background:#f1f5f9;overflow-y:auto;font-family:'Inter',sans-serif;">
            <div style="background:linear-gradient(135deg,#1f2937,#111827);border-bottom:3px solid #b91c1c;padding:16px 26px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:5;">
                <div style="display:flex;align-items:center;gap:10px;color:#fff;">
                    <span style="width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${ICON.wrench}</span>
                    <div>
                        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15.5px;">Control de Herramientas</div>
                        <div style="font-size:11px;color:#9ca3af;">Operaciones · Hedma Tecnocontrol · Rol: ${rolLabel}</div>
                    </div>
                </div>
                <button onclick="opsCerrarHerramientas()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer;">${ICON.close}</button>
            </div>

            <div style="max-width:1200px;margin:0 auto;padding:18px 26px 60px;">
                <div style="display:flex;gap:6px;margin-bottom:18px;border-bottom:1px solid #e2e8f0;">
                    ${["dashboard:Dashboard", "tecnicos:Técnicos", "movimientos:Movimientos"].map(t => {
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
        if (activo) { activo.style.color = "#1f2937"; activo.style.borderBottomColor = "#b91c1c"; }
        if (tab === "dashboard") opsRenderDashboard();
        else if (tab === "tecnicos") opsRenderTecnicos();
        else if (tab === "movimientos") opsRenderMovimientos();
    };

    // ── Suscripciones en tiempo real ──────────────────────────────
    async function opsSuscribirTodo() {
        const { db, fs } = await opsGetFB();
        if (!unsubHerr) {
            unsubHerr = fs.onSnapshot(fs.query(fs.collection(db, COL_HERRAMIENTAS), fs.orderBy("folio")), snap => {
                cacheHerr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "dashboard") opsRenderDashboard();
            });
        }
        if (!unsubTec) {
            unsubTec = fs.onSnapshot(fs.query(fs.collection(db, COL_TECNICOS), fs.orderBy("numeroOperativo")), snap => {
                cacheTec = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "tecnicos") opsRenderTecnicos();
                if (tabActual === "dashboard") opsRenderDashboard();
            });
        }
        if (!unsubMov) {
            unsubMov = fs.onSnapshot(fs.query(fs.collection(db, COL_MOVIMIENTOS), fs.orderBy("fecha", "desc"), fs.limit(200)), snap => {
                cacheMov = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                if (tabActual === "movimientos") opsRenderMovimientos();
            });
        }
    }

    // ═══════════════════════ TAB: DASHBOARD ═══════════════════════
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
                        <button onclick="opsAbrirModalPieza()" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">${ICON.plus} Nueva pieza</button>
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
                    <button onclick="opsAbrirModalMovimiento('${id}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">Registrar movimiento</button>
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
                    <button onclick="opsGuardarPieza()" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">Generar folio y guardar</button>
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
                    <button onclick="opsConfirmarMovimiento('${herramientaId}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">Confirmar</button>
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
                    ${gestion ? `<button onclick="opsAbrirModalTecnico()" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">${ICON.plus} Nuevo técnico</button>` : ""}
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

    window.opsAbrirModalTecnico = function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">Nuevo técnico</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre completo</label>
                <input id="ops-in-nombretec" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Puesto</label>
                <input id="ops-in-puestotec" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Departamento</label>
                <input id="ops-in-deptotec" value="Servicios Técnicos" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarTecnico()" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">Generar N.° y guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarTecnico = async function () {
        const nombre = document.getElementById("ops-in-nombretec").value.trim();
        if (!nombre) { alert("El nombre es obligatorio"); return; }
        const puesto = document.getElementById("ops-in-puestotec").value.trim();
        const departamento = document.getElementById("ops-in-deptotec").value.trim();
        const { db, fs } = await opsGetFB();
        const numeroOperativo = await opsSiguienteNumeroTecnico();
        await fs.addDoc(fs.collection(db, COL_TECNICOS), {
            numeroOperativo, nombre, puesto, departamento,
            estatus: "activo", fechaIngreso: opsHoy(), fechaBaja: null,
            supervisor: null, telefono: null, correo: null, observaciones: null,
        });
        document.getElementById("ops-modal-wrap").innerHTML = "";
    };

    window.opsAbrirFichaTecnico = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        const activo = t.estatus === "activo";
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        const historial = cacheMov.filter(m => m.tecnicoAnteriorId === idInterno || m.tecnicoNuevoId === idInterno);
        const wrap = document.getElementById("ops-panel-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:99998;display:flex;justify-content:flex-end;" onclick="if(event.target===this)document.getElementById('ops-panel-wrap').innerHTML=''">
            <div style="background:#fff;width:460px;max-width:92vw;height:100%;overflow-y:auto;padding:22px;box-shadow:-6px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <div>
                        <div style="font-size:11px;color:#94a3b8;font-weight:600;">${opsEsc(t.numeroOperativo)}</div>
                        <div style="font-size:16px;font-weight:700;color:#1e293b;">${opsEsc(t.nombre)}</div>
                    </div>
                    <button onclick="document.getElementById('ops-panel-wrap').innerHTML=''" style="background:#f1f5f9;border:none;width:28px;height:28px;border-radius:7px;cursor:pointer;">${ICON.close}</button>
                </div>
                <span style="background:${activo ? "#dcfce7" : "#e5e7eb"};color:${activo ? "#166534" : "#374151"};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;">${activo ? "Activo" : "Baja"}</span>

                <div style="margin-top:14px;font-size:12.5px;color:#334155;line-height:1.9;">
                    <div><strong>Puesto:</strong> ${opsEsc(t.puesto || "—")}</div>
                    <div><strong>Departamento:</strong> ${opsEsc(t.departamento || "—")}</div>
                    <div><strong>Fecha de ingreso:</strong> ${opsEsc(t.fechaIngreso || "—")}</div>
                    ${t.fechaBaja ? `<div><strong>Fecha de baja:</strong> ${opsEsc(t.fechaBaja)}</div>` : ""}
                </div>

                ${activo && opsPuedeGestionar() ? `<div style="margin-top:14px;"><button onclick="opsIniciarBajaTecnico('${idInterno}')" class="mkt-add-btn" style="background:linear-gradient(135deg,#b91c1c,#7f1d1d);">${ICON.trash} Dar de baja al técnico</button></div>` : ""}

                <div style="margin-top:20px;font-size:12.5px;font-weight:700;color:#1e293b;">Herramientas actualmente asignadas (${asignadas.length})</div>
                <div style="margin-top:8px;">
                    ${asignadas.length ? asignadas.map(h => `<div style="padding:8px 0;border-bottom:1px solid #eef1f5;font-size:12px;"><strong>${opsEsc(h.folio)}</strong> — ${opsEsc(h.descripcion)}</div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Ninguna.</div>'}
                </div>

                <div style="margin-top:20px;font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;">${ICON.clock} Historial</div>
                <div style="margin-top:10px;border-left:2px solid #e2e8f0;padding-left:14px;">
                    ${historial.length ? historial.sort((a,b)=>(a.fecha<b.fecha?1:-1)).map(m => `
                    <div style="margin-bottom:12px;position:relative;">
                        <div style="position:absolute;left:-19px;top:3px;width:8px;height:8px;border-radius:50%;background:#1f2937;"></div>
                        <div style="font-size:12px;color:#334155;">${opsEsc((m.fecha||"").slice(0,10))} · ${opsEsc(m.tipo)} · ${opsEsc(m.herramientaId)}</div>
                    </div>`).join("") : '<div style="color:#94a3b8;font-size:12px;">Sin movimientos.</div>'}
                </div>
            </div>
        </div>`;
    };

    // ── Baja de técnico: bloquea si tiene herramientas pendientes ──
    window.opsIniciarBajaTecnico = function (idInterno) {
        const asignadas = cacheHerr.filter(h => h.tecnicoActualId === idInterno);
        if (asignadas.length > 0) {
            alert(`No se puede dar de baja: este técnico tiene ${asignadas.length} herramienta(s) asignada(s). Primero devuélvelas o reasígnalas desde la ficha de cada herramienta.`);
            return;
        }
        if (!confirm("¿Confirmar baja de este técnico? El número operativo podrá reutilizarse en el futuro sin perder este historial.")) return;
        opsConfirmarBajaTecnico(idInterno);
    };

    window.opsConfirmarBajaTecnico = async function (idInterno) {
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, COL_TECNICOS, idInterno), { estatus: "baja", fechaBaja: opsHoy() });
        const panel = document.getElementById("ops-panel-wrap");
        if (panel) panel.innerHTML = "";
    };

    // ═══════════════════════ TAB: MOVIMIENTOS ═══════════════════════
    function opsRenderMovimientos() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 18px;">
                <div style="font-size:12.5px;font-weight:700;color:#1e293b;margin-bottom:12px;">Últimos 200 movimientos (más reciente primero)</div>
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:12px;">
                        <thead><tr style="background:#1f2937;color:#fff;text-align:left;">
                            <th style="padding:7px 10px;border-radius:8px 0 0 8px;">Fecha</th>
                            <th style="padding:7px 10px;">Tipo</th>
                            <th style="padding:7px 10px;">Herramienta</th>
                            <th style="padding:7px 10px;">Técnico</th>
                            <th style="padding:7px 10px;border-radius:0 8px 8px 0;">Usuario</th>
                        </tr></thead>
                        <tbody>${cacheMov.length ? cacheMov.map((m, i) => `
                            <tr style="background:${i % 2 === 0 ? "#fff" : "#f8fafc"};border-bottom:1px solid #eef1f5;">
                                <td style="padding:7px 10px;color:#64748b;">${opsEsc((m.fecha || "").slice(0, 16).replace("T", " "))}</td>
                                <td style="padding:7px 10px;color:#334155;font-weight:600;">${opsEsc(m.tipo)}</td>
                                <td style="padding:7px 10px;color:#334155;">${opsEsc(m.herramientaId)}</td>
                                <td style="padding:7px 10px;color:#334155;">${opsEsc(opsNombreTecnico(m.tecnicoNuevoId || m.tecnicoAnteriorId))}</td>
                                <td style="padding:7px 10px;color:#64748b;">${opsEsc(m.usuarioNombre || m.usuarioEmail)}</td>
                            </tr>`).join("") : '<tr><td colspan="5" style="padding:22px;text-align:center;color:#94a3b8;">Sin movimientos aún.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

})();
