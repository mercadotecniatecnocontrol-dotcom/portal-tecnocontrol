// ══════════════════════════════════════════════════════════════════
// operaciones.js — Dueño único del módulo "Formularios Operaciones"
// Actualmente contiene: Control de Herramientas (overlay full-screen).
// A futuro, otros botones de Operaciones (Checklists, Inventario
// Operativo, etc.) se agregan AQUÍ, sin volver a tocar index.html
// más que un botón nuevo.
//
// Convenciones respetadas:
//  - SVG icons exclusivamente (sin emoji) en la UI de este módulo.
//  - Firestore vía dynamic import (este script NO es type="module").
//  - Colección: "operaciones_herramientas" (un doc por pieza).
// ══════════════════════════════════════════════════════════════════

(function () {

    const OPS_COLECCION = "operaciones_herramientas";
    const OPS_ICON = {
        wrench: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
        close: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        plus: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
        user: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
        box: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>',
        check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>',
        trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/></svg>',
        search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    };

    // Catálogo base — mismo listado de "AYUDA VISUAL / HERRAMIENTA BÁSICA PARA SERVICIOS"
    const OPS_CATALOGO_BASE = [
        ["#017-001", "Juego de dados Stanley", 1],
        ["#017-002", "Jgo. llaves españolas std. de 9 piezas", 1],
        ["#017-003", "Jgo. llaves españolas mm de 9 piezas", 1],
        ["#017-004", "Llave Stilson 8\" Urrea", 1],
        ["#017-005", "Llave Stilson 14\" Urrea", 1],
        ["#017-006", "Llave Stilson 18\" Urrea", 2],
        ["#017-007", "Juego llaves Allen std. tipo L", 1],
        ["#017-008", "Juego llaves Allen mm tipo L", 1],
        ["#017-009", "Pinzas electricista Urrea", 1],
        ["#017-010", "Pinzas de punta Urrea", 1],
        ["#017-011", "Juego desarmadores ámbar 8 piezas", 1],
        ["#017-012", "Llave universal de cadena Urrea", 1],
        ["#017-013", "Multímetro Steren MUL-108", 1],
        ["#017-014", "Llave ajustable 10\" (Crescent)", 1],
        ["#017-015", "Llave ajustable 15\" (Crescent)", 1],
        ["#017-016", "Marro 4 lb mango fibra de vidrio", 1],
        ["#017-017", "Pinzas de presión 10\" (perras)", 1],
        ["#017-018", "Arco de segueta", 1],
        ["#017-019", "Caja de herramienta Husky 3 niveles", 1],
        ["#017-020", "Pinzas de corte diagonal Urrea", 1],
        ["#017-021", "Taladro inalámbrico DeWalt brushless", 1],
        ["#017-022", "Sopladora de aire con cargador", 1],
    ];

    let opsFB = null;          // { db, fs }
    let opsUnsub = null;       // desuscriptor de onSnapshot activo
    let opsHerramientas = [];  // caché local en memoria
    let opsFiltro = "";

    async function opsGetFB() {
        if (opsFB) return opsFB;
        const fsMod = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        const db = window.db;
        opsFB = { db, fs: fsMod };
        return opsFB;
    }

    // ── Montaje / apertura del overlay ──────────────────────────────
    window.opsAbrirHerramientas = async function () {
        const cont = document.getElementById("ops-herramientas-overlay");
        if (!cont) return;
        if (!cont.dataset.montado) {
            cont.innerHTML = opsRenderShell();
            cont.dataset.montado = "1";
        }
        cont.style.display = "block";
        document.body.style.overflow = "hidden";
        await opsSuscribirCatalogo();
    };

    window.opsCerrarHerramientas = function () {
        const cont = document.getElementById("ops-herramientas-overlay");
        if (cont) cont.style.display = "none";
        document.body.style.overflow = "";
        if (opsUnsub) { opsUnsub(); opsUnsub = null; }
    };

    // ── Shell visual del overlay ─────────────────────────────────────
    function opsRenderShell() {
        return `
        <div style="position:fixed;inset:0;z-index:99997;background:#f1f5f9;overflow-y:auto;font-family:'Inter',sans-serif;">
            <div style="background:linear-gradient(135deg,#1f2937,#111827);border-bottom:3px solid #b91c1c;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:2;">
                <div style="display:flex;align-items:center;gap:10px;color:#fff;">
                    <span style="width:34px;height:34px;border-radius:9px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${OPS_ICON.wrench}</span>
                    <div>
                        <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;">Control de Herramientas</div>
                        <div style="font-size:11.5px;color:#9ca3af;">Operaciones · Hedma Tecnocontrol</div>
                    </div>
                </div>
                <button onclick="opsCerrarHerramientas()" style="background:rgba(255,255,255,0.08);border:none;color:#fff;width:34px;height:34px;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;">${OPS_ICON.close}</button>
            </div>

            <div style="max-width:1180px;margin:0 auto;padding:24px 28px 60px;">
                <div id="ops-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;"></div>

                <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:18px 20px;">
                    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="color:#94a3b8;">${OPS_ICON.search}</span>
                            <input id="ops-buscar" type="text" placeholder="Buscar por folio, descripción o responsable..." oninput="opsFiltrar(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 12px;font-size:12.5px;width:280px;outline:none;">
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="opsAbrirModalPieza()" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">${OPS_ICON.plus} Nueva pieza</button>
                            <button onclick="opsSembrarCatalogoBase()" class="mkt-add-btn" style="background:linear-gradient(135deg,#0891b2,#0e7490);">${OPS_ICON.box} Cargar catálogo base</button>
                        </div>
                    </div>
                    <div style="overflow-x:auto;">
                        <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                            <thead>
                                <tr style="background:#1f2937;color:#fff;text-align:left;">
                                    <th style="padding:9px 10px;border-radius:8px 0 0 8px;">Folio</th>
                                    <th style="padding:9px 10px;">Descripción</th>
                                    <th style="padding:9px 10px;text-align:center;">Cant.</th>
                                    <th style="padding:9px 10px;">Estado</th>
                                    <th style="padding:9px 10px;">Asignado a</th>
                                    <th style="padding:9px 10px;border-radius:0 8px 8px 0;text-align:right;">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="ops-tabla-body">
                                <tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;">Cargando herramienta…</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        <div id="ops-modal-pieza-wrap"></div>
        <div id="ops-modal-asignar-wrap"></div>
        `;
    }

    // ── Suscripción en tiempo real a Firestore ──────────────────────
    async function opsSuscribirCatalogo() {
        if (opsUnsub) return; // ya suscrito
        const { db, fs } = await opsGetFB();
        const q = fs.query(fs.collection(db, OPS_COLECCION), fs.orderBy("folio"));
        opsUnsub = fs.onSnapshot(q, (snap) => {
            opsHerramientas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            opsRenderKPIs();
            opsRenderTabla();
        }, (err) => {
            console.error("[operaciones.js] Error leyendo catálogo:", err);
            const tbody = document.getElementById("ops-tabla-body");
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="padding:20px;text-align:center;color:#b91c1c;">Error al cargar el catálogo. Verifica las reglas de Firestore.</td></tr>`;
        });
    }

    // ── KPIs ──────────────────────────────────────────────────────
    function opsRenderKPIs() {
        const total = opsHerramientas.length;
        const asignadas = opsHerramientas.filter(h => h.estado === "asignada").length;
        const disponibles = opsHerramientas.filter(h => !h.estado || h.estado === "disponible").length;
        const reparacion = opsHerramientas.filter(h => h.estado === "reparacion" || h.estado === "malo").length;

        const cards = [
            { label: "Piezas registradas", valor: total, color: "#1f2937", icon: OPS_ICON.box },
            { label: "Asignadas", valor: asignadas, color: "#0891b2", icon: OPS_ICON.user },
            { label: "Disponibles", valor: disponibles, color: "#059669", icon: OPS_ICON.check },
            { label: "En reparación / malas", valor: reparacion, color: "#b91c1c", icon: OPS_ICON.alert },
        ];
        const cont = document.getElementById("ops-kpis");
        if (!cont) return;
        cont.innerHTML = cards.map(c => `
            <div style="background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:14px 16px;display:flex;align-items:center;gap:12px;">
                <span style="width:34px;height:34px;border-radius:9px;background:${c.color}15;color:${c.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${c.icon}</span>
                <div>
                    <div style="font-size:20px;font-weight:700;color:#1e293b;line-height:1;">${c.valor}</div>
                    <div style="font-size:11px;color:#64748b;margin-top:3px;">${c.label}</div>
                </div>
            </div>
        `).join("");

        const badge = document.getElementById("ops-badge-count-herr");
        if (badge) badge.textContent = String(total);
    }

    // ── Tabla ─────────────────────────────────────────────────────
    function opsRenderTabla() {
        const tbody = document.getElementById("ops-tabla-body");
        if (!tbody) return;

        const filtro = opsFiltro.trim().toLowerCase();
        const lista = opsHerramientas.filter(h => {
            if (!filtro) return true;
            return (h.folio || "").toLowerCase().includes(filtro)
                || (h.descripcion || "").toLowerCase().includes(filtro)
                || (h.asignadoA || "").toLowerCase().includes(filtro);
        });

        if (!lista.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="padding:24px;text-align:center;color:#94a3b8;">Sin herramienta registrada todavía. Usa "Cargar catálogo base" o "Nueva pieza".</td></tr>`;
            return;
        }

        tbody.innerHTML = lista.map((h, i) => {
            const estado = opsEstadoInfo(h.estado);
            const zebra = i % 2 === 0 ? "#fff" : "#f8fafc";
            return `
            <tr style="background:${zebra};border-bottom:1px solid #eef1f5;">
                <td style="padding:9px 10px;font-weight:600;color:#334155;">${opsEsc(h.folio || "—")}</td>
                <td style="padding:9px 10px;color:#334155;">${opsEsc(h.descripcion || "—")}</td>
                <td style="padding:9px 10px;text-align:center;">${opsEsc(h.cantidad ?? 1)}</td>
                <td style="padding:9px 10px;"><span style="background:${estado.bg};color:${estado.fg};font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;">${estado.label}</span></td>
                <td style="padding:9px 10px;color:#334155;">${h.asignadoA ? opsEsc(h.asignadoA) : '<span style="color:#94a3b8;">Sin asignar</span>'}</td>
                <td style="padding:9px 10px;text-align:right;white-space:nowrap;">
                    <button onclick="opsAbrirModalAsignar('${h.id}')" title="Asignar / devolver" style="background:#eef2f7;border:none;color:#1f2937;width:28px;height:28px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;margin-right:5px;">${OPS_ICON.user}</button>
                    <button onclick="opsEliminarPieza('${h.id}')" title="Eliminar" style="background:#fef2f2;border:none;color:#b91c1c;width:28px;height:28px;border-radius:7px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;">${OPS_ICON.trash}</button>
                </td>
            </tr>`;
        }).join("");
    }

    function opsEstadoInfo(estado) {
        switch (estado) {
            case "asignada": return { label: "Asignada", bg: "#e0f2fe", fg: "#075985" };
            case "reparacion": return { label: "En reparación", bg: "#fef3c7", fg: "#92400e" };
            case "malo": return { label: "Baja / dañada", bg: "#fee2e2", fg: "#991b1b" };
            default: return { label: "Disponible", bg: "#dcfce7", fg: "#166534" };
        }
    }

    function opsEsc(str) {
        return String(str ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
    }

    window.opsFiltrar = function (valor) {
        opsFiltro = valor || "";
        opsRenderTabla();
    };

    // ── Alta de pieza nueva ───────────────────────────────────────
    window.opsAbrirModalPieza = function () {
        const wrap = document.getElementById("ops-modal-pieza-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99998;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">Nueva pieza de herramienta</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Folio</label>
                <input id="ops-in-folio" placeholder="#017-024" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;outline:none;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Descripción</label>
                <input id="ops-in-desc" placeholder="Descripción de la herramienta" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;outline:none;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Cantidad</label>
                <input id="ops-in-cant" type="number" min="1" value="1" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 18px;outline:none;">
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-pieza-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarPieza()" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">Guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarPieza = async function () {
        const folio = document.getElementById("ops-in-folio").value.trim();
        const descripcion = document.getElementById("ops-in-desc").value.trim();
        const cantidad = parseInt(document.getElementById("ops-in-cant").value, 10) || 1;
        if (!folio || !descripcion) {
            window.mostrarPush ? mostrarPush("Herramientas", "Folio y descripción son obligatorios", "⚠️") : alert("Folio y descripción son obligatorios");
            return;
        }
        const { db, fs } = await opsGetFB();
        await fs.addDoc(fs.collection(db, OPS_COLECCION), {
            folio, descripcion, cantidad,
            estado: "disponible",
            asignadoA: null,
            asignadoEmail: null,
            fechaAsignacion: null,
            creadoEn: fs.serverTimestamp ? fs.serverTimestamp() : new Date().toISOString(),
        });
        document.getElementById("ops-modal-pieza-wrap").innerHTML = "";
    };

    window.opsEliminarPieza = async function (id) {
        if (!confirm("¿Eliminar esta pieza del catálogo? Esta acción no se puede deshacer.")) return;
        const { db, fs } = await opsGetFB();
        await fs.deleteDoc(fs.doc(db, OPS_COLECCION, id));
    };

    // ── Asignación / devolución ──────────────────────────────────
    window.opsAbrirModalAsignar = function (id) {
        const pieza = opsHerramientas.find(h => h.id === id);
        if (!pieza) return;
        const wrap = document.getElementById("ops-modal-asignar-wrap");
        const asignadaAhora = pieza.estado === "asignada";
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99998;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">${asignadaAhora ? "Devolver herramienta" : "Asignar herramienta"}</div>
                <div style="font-size:12px;color:#64748b;margin-bottom:14px;">${opsEsc(pieza.folio)} · ${opsEsc(pieza.descripcion)}</div>
                ${asignadaAhora ? `
                    <div style="font-size:12.5px;color:#334155;margin-bottom:18px;">Actualmente asignada a <strong>${opsEsc(pieza.asignadoA)}</strong>. ¿Confirmas la devolución?</div>
                ` : `
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre del empleado</label>
                    <input id="ops-in-empleado" placeholder="Nombre completo" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;outline:none;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Correo (opcional)</label>
                    <input id="ops-in-empleado-email" placeholder="correo@tecnocontrol.com.mx" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 18px;outline:none;">
                `}
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-asignar-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="${asignadaAhora ? `opsConfirmarDevolucion('${id}')` : `opsConfirmarAsignacion('${id}')`}" class="mkt-add-btn" style="background:linear-gradient(135deg,#4b5563,#1f2937);">${asignadaAhora ? "Confirmar devolución" : "Asignar"}</button>
                </div>
            </div>
        </div>`;
    };

    window.opsConfirmarAsignacion = async function (id) {
        const nombre = document.getElementById("ops-in-empleado").value.trim();
        const email = document.getElementById("ops-in-empleado-email").value.trim();
        if (!nombre) {
            window.mostrarPush ? mostrarPush("Herramientas", "Indica el nombre del empleado", "⚠️") : alert("Indica el nombre del empleado");
            return;
        }
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, OPS_COLECCION, id), {
            estado: "asignada",
            asignadoA: nombre,
            asignadoEmail: email || null,
            fechaAsignacion: new Date().toISOString().slice(0, 10),
        });
        document.getElementById("ops-modal-asignar-wrap").innerHTML = "";
    };

    window.opsConfirmarDevolucion = async function (id) {
        const { db, fs } = await opsGetFB();
        await fs.updateDoc(fs.doc(db, OPS_COLECCION, id), {
            estado: "disponible",
            asignadoA: null,
            asignadoEmail: null,
            fechaAsignacion: null,
        });
        document.getElementById("ops-modal-asignar-wrap").innerHTML = "";
    };

    // ── Sembrado del catálogo base (solo si la colección está vacía) ─
    window.opsSembrarCatalogoBase = async function () {
        if (opsHerramientas.length > 0) {
            const continuar = confirm("Ya existen piezas registradas. ¿Agregar de todos modos el catálogo base (23 piezas)? Se omitirán los folios que ya existan.");
            if (!continuar) return;
        }
        const { db, fs } = await opsGetFB();
        const foliosExistentes = new Set(opsHerramientas.map(h => h.folio));
        let agregadas = 0;
        for (const [folio, descripcion, cantidad] of OPS_CATALOGO_BASE) {
            if (foliosExistentes.has(folio)) continue;
            await fs.addDoc(fs.collection(db, OPS_COLECCION), {
                folio, descripcion, cantidad,
                estado: "disponible",
                asignadoA: null,
                asignadoEmail: null,
                fechaAsignacion: null,
                creadoEn: fs.serverTimestamp ? fs.serverTimestamp() : new Date().toISOString(),
            });
            agregadas++;
        }
        window.mostrarPush ? mostrarPush("Herramientas", `Catálogo base cargado (${agregadas} piezas nuevas).`, "✅") : alert(`Catálogo base cargado (${agregadas} piezas nuevas).`);
    };

})();
