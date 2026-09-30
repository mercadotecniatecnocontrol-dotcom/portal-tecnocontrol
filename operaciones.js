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
    const COL_GUARDIAS_PROGRAMADAS = "ops_guardias_programadas"; // calendario de ROTACIÓN de guardia (quién está de guardia cada semana), distinto de la herramienta de guardia de arriba
    const COL_VEHICULOS_ASIG = "ops_vehiculo_asignaciones"; // historial real de vehículo por técnico (dato propio de Operaciones, no inventa GPS de Flotilla)
    const COL_FOLIOS = "ops_folios"; // Folios de servicio (Connecteam) con seguimiento de vencimiento/atención/solución
    // Campos planeados para Fase A/B del Calendario (sep-2026) — todavía NO se leen
    // ni escriben en ningún lado, es solo la reserva de nombres para cuando se
    // construya esa parte: vehiculoId, origen, destino, distanciaKm, casetasMonto,
    // horaSalida. Ninguno rompe folios existentes (todos opcionales).
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
    const COL_CONFIG_ALERTAS = "ops_config_alertas"; // doc "general": cuántos días de anticipación quiere Glen para cada tipo de aviso — editable desde la pestaña Alertas
    const COL_CONFIG_VIATICOS = "ops_config_viaticos"; // doc "general": tarifas para la calculadora automática de viáticos/hospedaje/casetas
    // Catálogo de servicios / Planeación Operativa (sep-2026): recetas parametrizadas
    // por tipo de servicio (materiales, personal por rol, vehículos, herramienta,
    // seguridad, costo). Fase 1 — modelo de datos + import real del Excel de Paloma;
    // el motor de cálculo/calendario/disponibilidad quedan para fases siguientes.
    const COL_SERVICIOS_CATALOGO = "ops_servicios_catalogo";
    const COL_TARIFAS_PERSONAL = "ops_tarifas_personal"; // doc por rol (lider/tecnico/obra_civil) — nunca por nombre de empleado
    const COL_AUSENCIAS = "ops_tecnico_ausencias"; // calendario propio de vacaciones/incapacidad/permiso por técnico (sep-2026, a petición de Glen)
    const MIGUEL_EMAIL = "miguel@tecnocontrol.com.mx"; // dueño del seguimiento interno (fecha de atención / compromiso)

    // ════════════ FASE 5 (sep-2026): Gestión de servicios — calendario, ════════════
    // habilidades de personal, sugerencia de técnico, y campos comerciales/contables
    // del folio. Mismos nombres de rol que ya usan las recetas del catálogo de
    // servicios (lider/tecnico/obra_civil) — así la sugerencia cruza directo, sin
    // tabla de traducción.
    const OPS_HABILIDADES = [
        { clave: "lider", nombre: "Líder de servicio" },
        { clave: "tecnico", nombre: "Técnico" },
        { clave: "obra_civil", nombre: "Obra civil" },
        { clave: "laboratorio", nombre: "Laboratorio / calibración" },
        { clave: "electrico", nombre: "Eléctrico" },
    ];
    const OPS_TIPOS_FOLIO = [
        { clave: "servicio", nombre: "Servicio técnico" },
        { clave: "laboratorio", nombre: "Laboratorio" },
        { clave: "inspeccion", nombre: "Visita de inspección" },
    ];
    // Programa de inspectores (Glen, sep-2026): visitas normativas — cada una liga a
    // una Norma/servicio específico. "SCFI" es la que además pide hologramas/precintos/
    // distintivos/viáticos (ver esSCFI en el folio).
    const OPS_NORMAS_INSPECCION = ["Anexo 21", "Anexo 22", "Anexo 21 y 22", "ASEA", "SCFI", "Calibración Medida Volumétrica", "Alto Flujo", "Laboratorio"];
    // Paleta vívida por tipo/Norma (Glen, sep-2026) — para identificar cada categoría de un
    // vistazo en el Calendario, sin perder el azul institucional para el servicio normal.
    const OPS_COLOR_NORMA = {
        "Anexo 21": "#f97316", "Anexo 22": "#ea580c", "Anexo 21 y 22": "#fb923c",
        "ASEA": "#db2777", "SCFI": "#059669", "Calibración Medida Volumétrica": "#0284c7",
        "Alto Flujo": "#0891b2", "Laboratorio": "#7c3aed",
    };
    function opsColorFolio(f) {
        if (f.tipoFolio === "laboratorio") return "#7c3aed";
        if (f.tipoFolio === "inspeccion") return OPS_COLOR_NORMA[f.normaInspeccion] || "#0e7490";
        return "#1D2E73";
    }
    // ═══════════ Sistema de color del CALENDARIO (centralizado, rediseño sep-2026) ═══════════
    // Un solo lugar decide el color de cada actividad. Ningún componente del calendario
    // pinta colores "a mano": todos preguntan a opsCalCategoriaFolio() y leen esta tabla.
    // Para cambiar un color o la regla de una categoría solo se toca este bloque.
    const OPS_CAL_CATEGORIAS = {
        jomar:       { nombre: "JOMAR",                 color: "#eab308", fondo: "#fefce8", texto: "#854d0e" },
        servicio:    { nombre: "Servicio Tecnocontrol", color: "#1d4ed8", fondo: "#eff6ff", texto: "#1e3a8a" },
        visita:      { nombre: "Visita / Atención",     color: "#16a34a", fondo: "#f0fdf4", texto: "#166534" },
        seguimiento: { nombre: "Seguimiento",           color: "#f97316", fondo: "#fff7ed", texto: "#9a3412" },
        vencido:     { nombre: "Vencido / Crítico",     color: "#dc2626", fondo: "#fef2f2", texto: "#991b1b" },
        facturar:    { nombre: "Listo para facturar",   color: "#0d9488", fondo: "#f0fdfa", texto: "#115e59" },
    };
    const OPS_CAL_ORDEN_CATEGORIAS = ["jomar", "servicio", "visita", "seguimiento", "vencido", "facturar"];
    const OPS_DEMO_SOURCE = "DEMO_CALENDAR"; // marca de los folios de prueba (ver seedDemoCalendar / clearDemoCalendar)

    // ── Color por TIPO de servicio (Glen, sep-2026) ──────────────────────────────
    // Cuando un folio de servicio SÍ está ligado a una receta del catálogo (Retank,
    // Póliza, Supervisión, Calibración, etc.), se pinta con un color propio de esa
    // categoría — así ya no todo el "servicio normal" se ve igual de azul. El color
    // sale de un hash del nombre de la categoría contra esta paleta fija: cualquier
    // categoría nueva que agregues al catálogo consigue color automático, sin tener
    // que venir aquí a agregarla a mano.
    const OPS_PALETA_CATEGORIAS_SERVICIO = [
        "#0891b2", "#059669", "#d97706", "#be185d", "#7c3aed", "#0284c7",
        "#65a30d", "#c2410c", "#4f46e5", "#0d9488", "#9333ea", "#ca8a04",
    ];
    function opsHashTexto(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
        return Math.abs(h);
    }
    function opsColorCategoriaServicio(categoria) {
        const color = OPS_PALETA_CATEGORIAS_SERVICIO[opsHashTexto(categoria) % OPS_PALETA_CATEGORIAS_SERVICIO.length];
        return { nombre: categoria, color, fondo: color + "14", texto: color };
    }

    // ¿El folio viene de JOMAR? Los folios que se cargan por Excel se guardan con origen "connecteam"
    // (opsImportarExcelFolios). También se reconoce por nombre de cliente o por la marca esJomar.
    function opsEsFolioJomar(f) {
        return f.tipoFolio === "inspeccion" || f.origen === "connecteam" || f.esJomar === true || /jo\s?mar/i.test(f.clienteNombre || "");
    }
    // "Listo para facturar": el folio ya está solucionado, tiene a quién facturarle y no está marcado como facturado.
    // (Hoy no existe un campo de estatus de factura; si algún día se agrega f.facturado, aquí se respeta.)
    function opsFolioListoFacturar(f) {
        return !!f.fechaSolucion && !!(f.facturarA && String(f.facturarA).trim()) && !f.facturado;
    }
    // Categoría única (una sola por folio) — el orden de las reglas es la prioridad visual.
    // Nota: para "servicio" con categoriaServicio capturada, la categoría real es dinámica
    // ("srv:<categoría>") — opsCalColorFolio() sabe resolverla, ver más abajo.
    function opsCalCategoriaFolio(f) {
        if (opsFolioListoFacturar(f)) return "facturar";
        const info = opsCalcularSemaforoFolio(f);
        if (info.semaforo === "rojo" || info.semaforo === "naranja") return "vencido"; // vencido o urgente (≤24 h)
        if (info.enAtencion && !f.fechaSolucion) return "seguimiento";
        if (f.tipoFolio === "inspeccion") return "visita";
        if (opsEsFolioJomar(f)) return "jomar";
        if (f.tipoFolio === "servicio" && f.categoriaServicio) return "srv:" + f.categoriaServicio;
        return "servicio";
    }
    // ═══ Dos canales de color (Glen, sep-2026) ═══
    // RELLENO = tipo de servicio (sale de la receta del catálogo; la receta puede
    // traer colorCalendario propio, si no se usa el hash del nombre de la receta).
    // TRAZO (borde izquierdo grueso) = estatus del folio. Vencido además va punteado.
    // opsCalCategoriaFolio() se conserva igual para el filtro legacy y el import.
    const OPS_CAL_ESTATUS = {
        programado: { nombre: "Programado",           color: "#334155" },
        atencion:   { nombre: "En atención",          color: "#f59e0b" },
        vencido:    { nombre: "Vencido / urgente",    color: "#dc2626", punteado: true },
        cerrado:    { nombre: "Cerrado",              color: "#16a34a" },
        facturar:   { nombre: "Listo para facturar",  color: "#0891b2" },
    };
    const OPS_CAL_ORDEN_ESTATUS = ["programado", "atencion", "vencido", "cerrado", "facturar"];
    function opsCalRecetaFolio(f) {
        return f.servicioCatalogoId ? (cacheServiciosCatalogo.find(x => x.id === f.servicioCatalogoId) || null) : null;
    }
    // ═══ Familias de servicio con color SÓLIDO fijo (Glen, sep-2026, estilo monday.com) ═══
    // Cada familia tiene su propio color — sin hash, sin colores repetidos. El texto
    // libre de los imports ("Visita CALIBRACIONES Y BAJADO DE BITACORAS…") se agrupa
    // por palabra clave, así la leyenda muestra ~20 familias y no 80 variantes.
    // Tecnocontrol = servicios; JOMAR Verificaciones = todas las visitas de inspección.
    const OPS_FAM_TECNO = [
        { k: "botas",        nombre: "Cambio de botas",           color: "#ff642e", t: x => /bota/.test(x) },
        { k: "contenedor",   nombre: "Cambio de contenedor",      color: "#fdab3d", t: x => /contenedor/.test(x) },
        { k: "retank",       nombre: "Retank",                    color: "#e2445c", t: x => /re-?\s?tank/.test(x) },
        { k: "integridad",   nombre: "Integridad mecánica",       color: "#a25ddc", t: x => /integridad/.test(x) },
        { k: "hermeticidad", nombre: "Hermeticidad",              color: "#784bd1", t: x => /hermetic/.test(x) },
        { k: "cableado",     nombre: "Cableado y canalización",   color: "#579bfc", t: x => /cablead|canaliz|conexi/.test(x) },
        { k: "sonda",        nombre: "Sondas y consolas",         color: "#00a8b5", t: x => /sonda|consola|termistor/.test(x) },
        { k: "calibracion",  nombre: "Calibración",               color: "#037f4c", t: x => /calibra/.test(x) },
        { k: "dispensario",  nombre: "Dispensarios y mangueras",  color: "#0073ea", t: x => /dispens|manguer/.test(x) },
        { k: "electrico",    nombre: "Eléctrico",                 color: "#ffcb00", t: x => /el[eé]ctric/.test(x) },
        { k: "mantenimiento",nombre: "Mantenimiento",             color: "#00c875", t: x => /manten|mtto/.test(x) },
        { k: "poliza",       nombre: "Pólizas",                   color: "#ff158a", t: x => /p[oó]liza/.test(x) },
        { k: "obra",         nombre: "Obra civil",                color: "#7f5347", t: x => /obra civil|pintura|losa|concreto/.test(x) },
        { k: "totem",        nombre: "Tótem e imagen",            color: "#bb3354", t: x => /t[oó]tem|imagen|anuncio/.test(x) },
        { k: "supervision",  nombre: "Supervisión",               color: "#175a63", t: x => /supervis/.test(x) },
    ];
    const OPS_FAM_TECNO_GENERAL = { k: "general", nombre: "Servicio técnico general", color: "#401694" };
    const OPS_FAM_JOMAR = [
        { k: "sinact",      nombre: "Sin actividad / cancelado", color: "#9aa1ad", t: x => /cancel|vacacion|d[ií]a libre|inh[aá]bil|incapac/.test(x) },
        { k: "altoflujo",   nombre: "Alto flujo",                color: "#225091", t: x => /alto flujo/.test(x) },
        { k: "calibracion", nombre: "Calibraciones",             color: "#4eccc6", t: x => /calib|cali+bra/.test(x) },
        { k: "scfi",        nombre: "SCFI",                      color: "#9cd326", t: x => /scfi/.test(x) },
        { k: "sasisopa",    nombre: "SASISOPA",                  color: "#5559df", t: x => /sasisopa/.test(x) },
        { k: "aseaanexo",   nombre: "ASEA + Anexo 21/22",        color: "#cab641", t: x => /asea/.test(x) && /an?e?n?xo|aenxo|aneo/.test(x) },
        { k: "anexo",       nombre: "Anexo 21 / 22",             color: "#ff7575", t: x => /an?e?n?xo|aenxo|aneo/.test(x) },
        { k: "asea",        nombre: "ASEA / OP y MTTO",          color: "#d974b0", t: x => /asea|op y mtto|op y mto/.test(x) },
        { k: "tanques",     nombre: "Bajada de tanques",         color: "#ff9a52", t: x => /tanque/.test(x) },
        { k: "supervision", nombre: "Supervisión / revisión",    color: "#2b76e5", t: x => /supervis|revisi/.test(x) },
    ];
    const OPS_FAM_JOMAR_GENERAL = { k: "general", nombre: "Visita de inspección", color: "#ff5ac4" };
    // Texto legible sobre relleno sólido: blanco u oscuro según la luminosidad del color.
    function opsCalTextoSobre(hex) {
        const h = hex.replace("#", "");
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) > 160 ? "#1f2937" : "#ffffff";
    }
    // Mezcla dos colores hex (t = 0 → a, t = 1 → b). Base de la paleta pastel de Operaciones.
    function opsMezclaColor(a, b, t) {
        const h = x => x.replace("#", ""), A = h(a), B = h(b);
        const c = i => Math.round(parseInt(A.slice(i, i + 2), 16) * (1 - t) + parseInt(B.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0");
        return "#" + c(0) + c(2) + c(4);
    }
    function opsPastel(color) { return opsMezclaColor(color, "#ffffff", 0.74); }
    function opsTonoOscuro(color) { return opsMezclaColor(color, "#111827", 0.5); }
    // Tarjetas del calendario en PASTEL (Glen, sep-2026): relleno pastel sólido (no transparente),
    // texto en el mismo tono oscurecido, borde fino del tono medio. La franja de estatus sí va saturada.
    function opsCalMkColor(clave, nombre, color, empresa) {
        const texto = opsTonoOscuro(color);
        return { clave, nombre, color, fondo: opsPastel(color), borde: opsMezclaColor(color, "#ffffff", 0.45), texto, suave: texto + "cc", empresa: empresa || "tecno" };
    }
    function opsCalNorm(x) { return String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
    function opsCalFamiliaDeTexto(texto, jomar) {
        const x = opsCalNorm(texto);
        const lista = jomar ? OPS_FAM_JOMAR : OPS_FAM_TECNO;
        return lista.find(fm => fm.t(x)) || (jomar ? OPS_FAM_JOMAR_GENERAL : OPS_FAM_TECNO_GENERAL);
    }
    function opsCalServicioFolio(f) {
        const receta = opsCalRecetaFolio(f);
        const jomar = opsEsFolioJomar(f);
        if (receta && receta.colorCalendario) return opsCalMkColor("srv:rec:" + receta.id, receta.nombre || "Servicio", receta.colorCalendario, jomar ? "jomar" : "tecno");
        if (f.tipoFolio === "laboratorio") return opsCalMkColor("srv:tecno:laboratorio", "Laboratorio", "#9d50dd", "tecno");
        // La receta manda: primero se clasifica solo por su nombre; si no cae en ninguna familia, se usa el texto del folio.
        let fam = receta ? opsCalFamiliaDeTexto(receta.nombre || "", jomar) : null;
        if (!fam || fam.k === "general") {
            const texto = [receta?.nombre, f.normaInspeccion, f.categoriaServicio, f.tipoServicioDemo, f.estacion, f.comentarios].filter(Boolean).join(" ");
            fam = opsCalFamiliaDeTexto(texto, jomar);
        }
        return opsCalMkColor("srv:" + (jomar ? "jomar:" : "tecno:") + fam.k, fam.nombre, fam.color, jomar ? "jomar" : "tecno");
    }
    function opsCalEstatusFolio(f) {
        let k = "programado";
        if (opsFolioListoFacturar(f)) k = "facturar";
        else if (f.fechaSolucion) k = "cerrado";
        else {
            const info = opsCalcularSemaforoFolio(f);
            if (info.semaforo === "rojo" || info.semaforo === "naranja") k = "vencido";
            else if (info.enAtencion) k = "atencion";
        }
        return { clave: k, ...OPS_CAL_ESTATUS[k] };
    }
    function opsCalColorFolio(f) {
        const srv = opsCalServicioFolio(f), est = opsCalEstatusFolio(f);
        return { ...srv, estClave: est.clave, estNombre: est.nombre, estColor: est.color, punteado: !!est.punteado };
    }
    // Filtro por chip de leyenda: "srv:..." = tipo de servicio, "est:..." = estatus, lo demás = categoría legacy.
    function opsCalCoincideCategoria(f, k) {
        if (k.startsWith("est:")) return opsCalEstatusFolio(f).clave === k.slice(4);
        if (k.startsWith("srv:")) return opsCalServicioFolio(f).clave === k;
        return opsCalCategoriaFolio(f) === k;
    }

    // ═══ Personal operativo vs administrativo (Paloma, sep-2026) ═══
    // Los administrativos/gerentes (tienen acceso a Operaciones pero no salen a campo)
    // NO aparecen en calendario, asignaciones, guardias ni listas de herramienta.
    // Regla: t.ocultarEnListas manda (true/false, se marca en "Personal administrativo");
    // si nunca se ha marcado, se decide por el puesto. Los de baja nunca aparecen.
    const OPS_RE_PUESTO_ADMIN = /gerente|subgerente|coordinador|auxiliar|consulta|administra|director|contab|compras|gestor|recursos humanos|ingresos|egresos|pagos|ventas|marketing|almac|flotilla|contralor/i;
    // Nombres que Paloma pidió ocultar — solo se usan para PRESELECCIONAR en la revisión; nada se oculta sin confirmar.
    const OPS_NOMBRES_ADMIN_SUGERIDOS = ["glen", "idaly", "kenia", "jaqueline", "paloma", "cristina acosta", "paola", "denisse", "martin", "ana", "ruth", "sandra", "magali", "miguel"];
    function opsEsAdministrativo(t) {
        if (t.ocultarEnListas === true) return true;
        if (t.ocultarEnListas === false) return false;
        const p = t.puesto || "";
        if (/t[ée]cnico/i.test(p)) return false;
        return OPS_RE_PUESTO_ADMIN.test(p);
    }
    function opsEsSugeridoAdmin(t) {
        const n = String(t.nombre || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const primero = n.split(/\s+/)[0];
        return OPS_NOMBRES_ADMIN_SUGERIDOS.some(x => x.includes(" ") ? n.includes(x) : primero === x);
    }
    function opsTecOperativos() {
        return cacheTec.filter(t => t.estatus === "activo" && !opsEsAdministrativo(t));
    }

    // Tipo de técnico (badge chico junto al nombre) — sale de las habilidades ya capturadas en su ficha.
    const OPS_TIPO_TECNICO = {
        lider:       { nombre: "Líder de servicio", color: "#1d4ed8" },
        laboratorio: { nombre: "Laboratorio",       color: "#7c3aed" },
        electrico:   { nombre: "Eléctrico",         color: "#0369a1" },
        obra_civil:  { nombre: "Obra civil",        color: "#b45309" },
        tecnico:     { nombre: "Técnico",           color: "#475569" },
    };
    function opsTecBadgeTipo(t) {
        const hab = t.habilidades || [];
        const prim = ["lider", "laboratorio", "electrico", "obra_civil", "tecnico"].find(k => hab.includes(k));
        if (!prim) return "";
        const c = OPS_TIPO_TECNICO[prim];
        const extra = hab.length > 1 ? ` +${hab.length - 1}` : "";
        return `<span title="${opsEsc(hab.map(h => (OPS_TIPO_TECNICO[h] || {}).nombre || h).join(", "))}" style="display:inline-flex;align-items:center;gap:4px;background:${c.color}14;color:${c.color};font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:999px;white-space:nowrap;"><span style="width:5px;height:5px;border-radius:50%;background:${c.color};"></span>${opsEsc(c.nombre)}${extra}</span>`;
    }
    // Avatar del técnico: foto de perfil (fotoPerfil, base64 en su documento de ops_tecnicos) o iniciales.
    function opsTecAvatarHTML(t, size) {
        const ini = (t.nombre || "?").split(" ").filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
        const base = `width:${size}px;height:${size}px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 2px #fff,0 0 0 3px #e2e8f0;`;
        if (t.fotoPerfil) return `<img src="${opsEsc(t.fotoPerfil)}" alt="${opsEsc(t.nombre)}" style="${base}object-fit:cover;background:#e2e8f0;">`;
        return `<span style="${base}background:linear-gradient(135deg,#1D2E73,#2d4494);color:#fff;font-size:${Math.max(8, Math.round(size * 0.36))}px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${opsEsc(ini)}</span>`;
    }

    // Notificación automática para folios de Laboratorio (Glen, sep-2026).
    // Alan Minjárez (MINJAREZ OCHOA ALBERTO ALAN) todavía no tiene correo real
    // capturado en Colaboradores (queda como "sincorreo_...") — en cuanto se le
    // dé de alta un correo real ahí, agrégalo a esta lista.
    const OPS_NOTIF_LABORATORIO = ["d.gutierrez@tecnocontrol.com.mx", "p.pinedo@tecnocontrol.com.mx"];
    const OPS_DIAS_ALERTA_EVIDENCIA = 3; // días sin evidencia antes de la alerta de acta administrativa

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

    // ════════════ FASE 0 — Preparación GPS (sep-2026, a petición de Glen) ════════════
    // Adaptador vacío, mismo patrón que opsHRProvider: placeholder documentado, se
    // reemplaza el interior el día que se conecte de verdad. NO se llama desde
    // ningún lado todavía — solo existe para que el código de las fases
    // siguientes (Calendario, panel de detalle) ya sepa contra qué función
    // programar, sin bloquear el resto mientras se decide el proveedor real.
    //
    // OJO — esto es DISTINTO de opsFlotillaProvider.obtenerUbicacionesEnCampo():
    // eso ya funciona hoy y da la posición actual de cada ECO (flotilla_ubicaciones,
    // sin rastreo continuo en segundo plano). opsGpsProvider es para lo que Flotilla
    // no hace: calcular una RUTA entre dos puntos (distancia, tiempo, casetas) —
    // necesita un proveedor de ruteo aparte, sea tu propia plataforma GPS u otro.
    // Elegido (Glen, sep-2026): OSRM (motor de ruteo de código abierto, gratis, sin
    // llave ni tarjeta) para distancia/tiempo REAL. Las casetas siguen siendo un
    // estimado por tarifa fija — ningún servicio gratuito trae datos reales de
    // casetas mexicanas, eso solo lo tienen los proveedores de paga (Google Routes).
    // Traccar (tu propio GPS) es para verificar el kilometraje YA recorrido después
    // del viaje — no sirve para planear antes, así que no se usa aquí.
    async function opsGeocodificarNominatim(direccion) {
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(direccion)}`);
            const data = await resp.json();
            if (!data || !data[0]) return null;
            return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        } catch (e) {
            console.error("[opsGeocodificarNominatim]", e);
            return null;
        }
    }
    window.opsGpsProvider = {
        // origen/destino: {lat,lng} o texto de dirección (se geocodifica solo, gratis,
        // vía Nominatim/OpenStreetMap). Regresa { distanciaKm, tiempoHrs, casetasMonto:
        // null, rutaPuntos } o null si no se pudo calcular — quien llama debe caer de
        // vuelta al estimado por tarifa fija en ese caso (casetas siempre, porque OSRM
        // no las conoce).
        async calcularRuta(origen, destino) {
            if (!origen || !destino) return null;
            try {
                const puntoA = typeof origen === "string" ? await opsGeocodificarNominatim(origen) : origen;
                const puntoB = typeof destino === "string" ? await opsGeocodificarNominatim(destino) : destino;
                if (!puntoA || !puntoB) { console.warn("[opsGpsProvider] No se pudo ubicar origen o destino."); return null; }
                const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${puntoA.lng},${puntoA.lat};${puntoB.lng},${puntoB.lat}?overview=false`);
                const data = await resp.json();
                const ruta = data.routes && data.routes[0];
                if (!ruta) { console.warn("[opsGpsProvider] OSRM no regresó ninguna ruta.", data); return null; }
                const distanciaKm = Math.round((ruta.distance || 0) / 100) / 10;
                const tiempoHrs = ruta.duration ? Math.round((ruta.duration / 3600) * 100) / 100 : null;
                return { distanciaKm, tiempoHrs, casetasMonto: null, rutaPuntos: null };
            } catch (e) {
                console.error("[opsGpsProvider] Error consultando OSRM:", e);
                return null;
            }
        },
        // Ningún servicio gratuito trae casetas reales de México — se queda como
        // estimado por tarifa fija, calculado en opsCalcularViaticos().
        async calcularCasetas(rutaPuntos) {
            return null;

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
        { nombre: "Consulta de Operaciones", departamento: "Operaciones", permisos: ["consulta"] },
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
        if (!t.correo) { alert("Primero captura el correo del técnico (botón Editar perfil) — sin correo no se puede crear el acceso al kiosco."); return; }
        if (t.firebaseUid) { alert("Este técnico ya tiene acceso al kiosco.\nCorreo: " + t.correo); return; }
        const wrap = document.getElementById("ops-modal-wrap");
        const passSugerida = opsPasswordSugerida(t);
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:380px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;display:flex;align-items:center;gap:6px;">${ICON.key} Crear acceso al kiosco</div>
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
        key:    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5 18 10M14 10l2 2"/></svg>',
        pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
        shield: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
        truck:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8Z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
        printer:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6Z"/></svg>',
        chat:   '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/></svg>',
        download:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
        sparkle:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>',
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
    let unsubHerr = null, unsubTec = null, unsubMov = null, unsubSurt = null, unsubSurtPoll = null, unsubFolios = null, unsubNotif = null, unsubTraspasos = null, unsubConfigCalibracion = null, unsubServiciosCatalogo = null, unsubTarifasPersonal = null, unsubAusencias = null, unsubAlmacenes = null, unsubConfigRevision = null, unsubRevisiones = null, unsubConfigAlertas = null, unsubConfigViaticos = null;
    let cacheHerr = [], cacheTec = [], cacheMov = [], cacheSurtidos = [], cacheFolios = [];
    let cacheServiciosCatalogo = [], cacheTarifasPersonal = {};
    let cacheAusencias = [];
    let opsTecVista = "operativos"; // pestaña Técnicos: operativos | administrativos | bajas
    let cacheAlmacenes = []; // TODOS los almacenes (general/técnico/ubicación) — para las ubicaciones físicas tipo "Banco de trabajo Saltillo"
    let cacheRevisoresHerramienta = []; // [{email,nombre}] — quién puede revisar CUALQUIER almacén desde Flotilla móvil
    // Días de anticipación por tipo de aviso — editable desde la pestaña Alertas (ops_config_alertas/general).
    const CONFIG_ALERTAS_DEFAULT = {
        anticipacionGuardiaDias: 3,      // avisar que a alguien le toca guardia en N días
        anticipacionAusenciaDias: 5,     // avisar que un técnico se ausenta en N días (para repartir su carga a tiempo)
        anticipacionFolioDias: 2,        // avisar que un folio se acerca a su fecha de atención comprometida
        anticipacionRevisionHerrDias: 30, // avisar que una herramienta lleva N días sin revisión física
    };
    let cacheConfigAlertas = { ...CONFIG_ALERTAS_DEFAULT };
    // Tarifas para la calculadora automática de viáticos (Glen, sep-2026) — editables desde el folio.
    const CONFIG_VIATICOS_DEFAULT = {
        viaticoDiario: 350,       // $ por día de viaje (comida, etc.)
        hospedajePorNoche: 900,   // $ por noche de hotel
        costoPorKm: 4.5,          // $ por km recorrido (gasolina) — estimado, no viene de GPS real todavía
        casetaPromedioPorTrayecto: 250, // $ estimado de casetas por trayecto (ida) — se usa solo si no hay ruta real (Google Routes)
        origenBaseDireccion: "Chihuahua, Chihuahua, México", // punto de partida para calcular ruta real — ajústalo a tu oficina real
    };
    let cacheConfigViaticos = { ...CONFIG_VIATICOS_DEFAULT };
    let cacheRevisionesHerr = []; // últimas revisiones/checklists de herramienta, de cualquier origen (Portal o Flotilla)
    let cacheTraspasosPend = []; // ops_herramienta_traspasos con estatus "Pendiente recepción" — bloquea la pieza hasta que el receptor acepte/rechace/venza
    let cacheAutorizadoresCalibracion = []; // [{email,nombre}] — quién puede aprobar mover equipo con requiereAutorizacion=true
    let filtroFolios = "", filtroFolioSemaforo = "todos", filtroFolioTipo = "servicio"; // servicio = folios normales (servicio+laboratorio); inspeccion = visitas de inspección — separados a propósito para no revolver a las personas
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
    let cacheGuardiasProgramadas = []; // calendario de rotación (quién está de guardia cada semana)
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
        // Contador atómico en Supabase (ops_contadores). "minimo" = el HT más alto que
        // ya existe, para que nunca se repita un folio aunque el contador se haya quedado atrás.
        const sb = await opsSb();
        const maxLocal = cacheHerr.reduce((m, h) => { const r = /^HT-(\d+)$/.exec(h.folio || h.id || ""); return r ? Math.max(m, Number(r[1])) : m; }, 0);
        for (let intento = 0; intento < 5; intento++) {
            const { data, error } = await sb.rpc("ops_siguiente_contador_min", { nombre_contador: "herramientas", minimo: maxLocal });
            if (error) throw new Error("Supabase (folio): " + error.message);
            const folio = "HT-" + String(data).padStart(6, "0");
            if (!cacheHerr.some(h => h.id === folio)) return folio;
        }
        throw new Error("No se pudo generar un folio HT libre.");
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
        const mov = {
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
        };
        const sb = await opsSb();
        const fila = {};
        Object.keys(mov).forEach(k => { fila[opsSnake(k)] = mov[k] === undefined ? null : mov[k]; });
        const { error } = await sb.from("ops_movimientos").insert(fila);
        if (error) throw new Error("Supabase (movimiento): " + error.message);
        cacheMov.unshift(mov);
        opsCopiaFirestore((db, fs) => fs.addDoc(fs.collection(db, COL_MOVIMIENTOS), mov).catch(() => {}));
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
            await Promise.all(cacheAutorizadoresCalibracion.map(a => window.tcNotificar2(fs, db, {
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
                await opsSbHerrGuardar(folio, {
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
                await opsSbHerrGuardar(folio, {
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
        try { opsIniciarReintentoPendientes(); } catch (e) { console.warn("[operaciones.js] cola de pendientes:", e); }
        await opsSembrarPuestosSiNecesario();
        await opsSembrarClientesSiNecesario();
        await opsSuscribirTodo();
        opsIniciarVigilanciaFolios();
        opsCambiarTab("calendario");
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
        viaticos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
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
        calendario: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    };

    function opsRenderShell() {
        const rol = opsRolActual();
        const rolLabel = { administrador: "Administrador", almacen: "Almacén", consulta: "Consulta" }[rol];
        const items = ["calendario:Calendario", "resumen:Resumen", "dashboard:Herramientas", "guardias:Guardias", "tecnicos:Técnicos", "servicios:Servicios",
            "folios:Folios", "clientes:Clientes",
            ...(opsPuedeHacer("autorizar_material") ? ["solicitudes:Solicitudes"] : []),
            "viaticos:Viáticos", "alertas:Alertas", "movimientos:Movimientos"];
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
        else if (tab === "calendario") opsRenderCalendario();
        else if (tab === "clientes") opsRenderClientes();
        else if (tab === "solicitudes") opsRenderSolicitudes();
        else if (tab === "alertas") opsRenderAlertas();
        else if (tab === "movimientos") opsRenderMovimientos();
        else if (tab === "viaticos") opsRenderViaticos();
    };

    // ── Suscripciones en tiempo real ──────────────────────────────
    async function opsSuscribirTodo() {
        const { db, fs } = await opsGetFB();
        opsAsegurarAlmacenGeneral(db, fs).catch(err => console.warn("[operaciones.js] no se pudo asegurar el Almacén General:", err));
        if (!unsubHerr) {
            unsubHerr = opsSbSuscribirHerr(); // Supabase (antes onSnapshot de Firestore)
            setTimeout(opsSbRespaldoTecAlm, 4000); // si Firestore no responde, técnicos/almacenes desde Supabase
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
            unsubMov = opsSbSuscribirMov(); // Supabase (antes onSnapshot de Firestore)
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
        if (!unsubConfigAlertas) {
            unsubConfigAlertas = fs.onSnapshot(fs.doc(db, COL_CONFIG_ALERTAS, "general"), snap => {
                cacheConfigAlertas = snap.exists() ? { ...CONFIG_ALERTAS_DEFAULT, ...snap.data() } : { ...CONFIG_ALERTAS_DEFAULT };
                if (tabActual === "alertas") opsRenderAlertas();
            }, () => { cacheConfigAlertas = { ...CONFIG_ALERTAS_DEFAULT }; });
        }
        if (!unsubConfigViaticos) {
            unsubConfigViaticos = fs.onSnapshot(fs.doc(db, COL_CONFIG_VIATICOS, "general"), snap => {
                cacheConfigViaticos = snap.exists() ? { ...CONFIG_VIATICOS_DEFAULT, ...snap.data() } : { ...CONFIG_VIATICOS_DEFAULT };
            }, () => { cacheConfigViaticos = { ...CONFIG_VIATICOS_DEFAULT }; });
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
        const snapGuardiasProg = await fs.getDocs(fs.collection(db, COL_GUARDIAS_PROGRAMADAS));
        cacheGuardiasProgramadas = snapGuardiasProg.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.semanaInicio < b.semanaInicio ? -1 : 1);
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
            const h = cacheHerr.find(x => x.id === m.herramientaId);
            const etiquetaHerr = h ? `${h.folio || ""}${h.folio && h.descripcion ? " — " : ""}${h.descripcion || ""}` : "(herramienta ya no existe)";
            return `<div style="margin-bottom:10px;position:relative;">
                <div style="position:absolute;left:-17px;top:3px;width:7px;height:7px;border-radius:50%;background:${color};"></div>
                <div style="font-size:11.5px;color:#334155;">${opsEsc(m.tipo)} · ${opsEsc(etiquetaHerr)}</div>
                <div style="font-size:10px;color:#94a3b8;">${opsEsc((m.fecha || "").slice(0, 16).replace("T", " "))}</div>
            </div>`;
        }).join("") || '<div style="color:#94a3b8;font-size:12px;">Sin actividad reciente.</div>';

        const ubicacionesCampo = await window.opsFlotillaProvider.obtenerUbicacionesEnCampo();

        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg> Técnicos en campo — mapa en vivo</div>
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
                        <button onclick="opsCambiarVistaHerr('galeria')" style="border:none;background:${vistaHerr === "galeria" ? "#1D2E73" : "transparent"};color:${vistaHerr === "galeria" ? "#fff" : "#475569"};padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Galería</button>
                        <button onclick="opsCambiarVistaHerr('revisiones')" style="border:none;background:${vistaHerr === "revisiones" ? "#1D2E73" : "transparent"};color:${vistaHerr === "revisiones" ? "#fff" : "#475569"};padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Revisiones</button>
                    </div>
                    ${gestion ? `<button onclick="opsAbrirModalCargaFotos()" title="Cargar varias fotos de golpe y emparejarlas con tu herramienta ya dada de alta" style="background:#0e7490;border:none;color:#fff;padding:0 13px;height:32px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.camera} Cargar fotos</button>` : ""}
                    ${gestion ? `<button onclick="opsAbrirConfigCalibracion()" title="Configurar quién autoriza equipo especializado" style="background:#eef2f7;border:none;color:#475569;width:32px;height:32px;border-radius:8px;cursor:pointer;">${ICON.lock}</button>` : ""}
                    ${gestion ? `<button onclick="opsAbrirConfigRevision()" title="Configurar quién puede revisar herramienta desde Flotilla" style="background:#eef2f7;border:none;color:#475569;width:32px;height:32px;border-radius:8px;cursor:pointer;">${ICON.search}</button>` : ""}
                    ${gestion ? `
                    <button onclick="opsAbrirModalPieza()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nueva pieza</button>
                    <button onclick="opsSembrarCatalogoBase()" class="mkt-add-btn" style="background:#334155;">${ICON.box} Cargar catálogo base</button>
                    <button onclick="opsImportarExcelReal()" class="mkt-add-btn" style="background:#15803D;">${ICON.file} Importar Excel real (12 técnicos)</button>` : ""}
                </div>
            </div>
            ${vistaHerr === "almacen" ? opsFragmentoVistaAlmacen() : (vistaHerr === "revisiones" ? opsFragmentoVistaRevisiones() : (vistaHerr === "galeria" ? opsFragmentoVistaGaleria(lista) : opsFragmentoVistaTipo(lista)))}
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
        const tecnicosActivos = opsTecOperativos();
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

    // Vista Galería — tarjetas con foto, al estilo "Panorama de vehículos" de Flotilla.
    function opsFragmentoVistaGaleria(lista) {
        if (!lista.length) return `<div style="padding:40px;text-align:center;color:#94a3b8;">Ninguna herramienta coincide con el filtro.</div>`;
        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:14px;">
            ${lista.map(h => {
                const e = ESTADOS_HERRAMIENTA[h.estado] || ESTADOS_HERRAMIENTA.disponible;
                return `<div onclick="opsAbrirFichaHerramienta('${h.id}')" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;cursor:pointer;box-shadow:0 1px 2px rgba(15,23,42,.04);transition:box-shadow .15s;">
                    <div style="position:relative;width:100%;height:120px;background:#f1f5f9;">
                        ${h.fotoBase64
                            ? `<img src="${h.fotoBase64}" style="width:100%;height:100%;object-fit:cover;display:block;">`
                            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;">${ICON.wrench}</div>`}
                        <span style="position:absolute;top:6px;left:6px;background:rgba(15,23,42,.75);color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;padding:2px 7px;border-radius:999px;">${opsEsc(h.categoria || "Sin categoría")}</span>
                    </div>
                    <div style="padding:9px 11px;">
                        <div style="font-size:9.5px;color:#94a3b8;font-weight:600;">${opsEsc(h.folio)}</div>
                        <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${opsEsc(h.descripcion)}</div>
                        <div style="font-size:10.5px;color:#64748b;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h.tecnicoActualId ? opsEsc(opsNombreTecnico(h.tecnicoActualId)) : "Sin asignar"}</div>
                        <span style="display:inline-block;margin-top:6px;background:${e.bg};color:${e.fg};font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:999px;">${e.label}</span>
                    </div>
                </div>`;
            }).join("")}
        </div>`;
    }

    // ══════════════ Carga masiva de fotos (Glen, sep-2026) ══════════════
    // Selecciona muchas fotos de golpe (el nombre del archivo ya suele ser el nombre real
    // de la herramienta), intenta emparejar cada una con una herramienta ya dada de alta
    // por nombre, y deja revisar/corregir antes de guardar todo junto.
    let opsCargaFotosItems = [];

    function opsNormalizaTexto(s) {
        return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
    }

    window.opsAbrirModalCargaFotos = function () {
        opsCargaFotosItems = [];
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:720px;max-width:96vw;max-height:90vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Carga masiva de fotos</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:14px;">Selecciona todas las fotos de la carpeta de una vez. El nombre del archivo se usa para proponer con cuál herramienta ya dada de alta va cada una — revisa y corrige antes de guardar.</div>
                <label style="display:flex;align-items:center;justify-content:center;gap:8px;border:2px dashed #cbd5e1;border-radius:10px;padding:22px;cursor:pointer;color:#475569;font-size:12.5px;font-weight:600;margin-bottom:16px;">
                    ${ICON.camera} Elegir fotos (puedes seleccionar varias a la vez)
                    <input type="file" accept="image/*" multiple style="display:none;" onchange="opsProcesarCargaFotos(this.files)">
                </label>
                <div id="ops-carga-fotos-lista"></div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                    <button id="ops-carga-fotos-guardar" onclick="opsGuardarCargaFotos()" class="mkt-add-btn" style="background:#0e7490;" disabled>Guardar todas</button>
                </div>
            </div>
        </div>`;
    };

    window.opsProcesarCargaFotos = function (files) {
        const activas = cacheHerr.filter(h => h.estado !== "baja");
        Array.from(files).forEach(file => {
            const nombreArchivo = file.name.replace(/\.[a-zA-Z0-9]+$/, "");
            const nq = opsNormalizaTexto(nombreArchivo);
            const partes = nq.split(" ").filter(Boolean);
            // mejor match: la herramienta cuya descripción comparte más palabras con el nombre del archivo
            let mejor = null, mejorPuntaje = 0;
            activas.forEach(h => {
                const nd = opsNormalizaTexto(h.descripcion);
                const puntaje = partes.filter(p => nd.includes(p)).length;
                if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = h; }
            });
            const reader = new FileReader();
            reader.onload = () => {
                opsCargaFotosItems.push({ file, nombreArchivo, previewUrl: reader.result, matchId: mejorPuntaje > 0 ? mejor.id : null });
                opsRenderCargaFotosLista();
            };
            reader.readAsDataURL(file);
        });
    };

    function opsRenderCargaFotosLista() {
        const el = document.getElementById("ops-carga-fotos-lista");
        if (!el) return;
        const activas = cacheHerr.filter(h => h.estado !== "baja");
        el.innerHTML = opsCargaFotosItems.map((it, i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <img src="${it.previewUrl}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;flex-shrink:0;">
                <div style="font-size:11px;color:#64748b;width:150px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${opsEsc(it.nombreArchivo)}">${opsEsc(it.nombreArchivo)}</div>
                <select onchange="opsCargaFotosCambiarMatch(${i}, this.value)" style="flex:1;border:1px solid ${it.matchId ? "#cbd5e1" : "#fca5a5"};border-radius:8px;padding:6px 8px;font-size:12px;">
                    <option value="">— No asignar / omitir —</option>
                    ${activas.map(h => `<option value="${h.id}" ${it.matchId === h.id ? "selected" : ""}>${opsEsc(h.folio)} — ${opsEsc(h.descripcion)}</option>`).join("")}
                </select>
                <button onclick="opsCargaFotosQuitar(${i})" style="background:#fef2f2;border:none;color:#E7402B;width:26px;height:26px;border-radius:7px;cursor:pointer;flex-shrink:0;">${ICON.trash}</button>
            </div>`).join("") || `<div style="color:#94a3b8;font-size:12px;padding:10px 0;">Todavía no eliges ninguna foto.</div>`;
        const btn = document.getElementById("ops-carga-fotos-guardar");
        if (btn) btn.disabled = !opsCargaFotosItems.some(it => it.matchId);
    }

    window.opsCargaFotosCambiarMatch = function (i, herramientaId) {
        if (opsCargaFotosItems[i]) opsCargaFotosItems[i].matchId = herramientaId || null;
        const btn = document.getElementById("ops-carga-fotos-guardar");
        if (btn) btn.disabled = !opsCargaFotosItems.some(it => it.matchId);
    };

    window.opsCargaFotosQuitar = function (i) {
        opsCargaFotosItems.splice(i, 1);
        opsRenderCargaFotosLista();
    };

    window.opsGuardarCargaFotos = async function () {
        const aplicar = opsCargaFotosItems.filter(it => it.matchId);
        if (!aplicar.length) return;
        const btn = document.getElementById("ops-carga-fotos-guardar");
        if (btn) { btn.disabled = true; btn.textContent = "Guardando…"; }
        try {
            const { db, fs } = await opsGetFB();
            let ok = 0, errores = 0;
            for (const it of aplicar) {
                try {
                    const comprimida = await opsComprimirImagenBase64(it.file, 700, 0.6);
                    await opsSbHerrActualizar(it.matchId, { fotoBase64: comprimida });
                    const h = cacheHerr.find(x => x.id === it.matchId);
                    if (h) h.fotoBase64 = comprimida;
                    ok++;
                } catch (e) { console.error("[opsGuardarCargaFotos]", it.nombreArchivo, e); errores++; }
            }
            document.getElementById("ops-modal-wrap").innerHTML = "";
            opsRenderDashboard();
            if (window.mostrarPush) window.mostrarPush("Operaciones", `${ok} foto(s) guardadas${errores ? `, ${errores} con error` : ""}.`, "✅");
        } catch (e) {
            console.error("[opsGuardarCargaFotos]", e);
            alert("No se pudo guardar: " + e.message);
        }
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
                    <button onclick="opsAbrirModalPieza('${id}')" class="mkt-add-btn" style="background:#475569;">${ICON.pencil} Editar datos</button>
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
            await opsSbHerrActualizar(id, { fotoBase64: dataUrl });
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

    window.opsAbrirModalPieza = function (id) {
        const h = id ? cacheHerr.find(x => x.id === id) : null;
        opsRequisicionSeleccionada = null;
        window.__opsFotoPiezaTmp = null; // se resetea cada vez que se abre el modal — no arrastra foto de una apertura anterior
        const tecnicosActivos = opsTecOperativos();
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;max-height:90vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:14px;">${h ? "Editar pieza de herramienta" : "Nueva pieza de herramienta"}</div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Foto (opcional)</label>
                <div style="display:flex;align-items:center;gap:10px;margin:4px 0 12px;">
                    <img id="ops-in-foto-preview" src="${h?.fotoBase64 || ""}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;background:#f8fafc;${h?.fotoBase64 ? "" : "display:none;"}">
                    <div style="flex:1;">
                        <input type="file" accept="image/*" capture="environment" id="ops-in-foto" onchange="opsPreviewFotoPieza(this)" style="font-size:11.5px;">
                        <div id="ops-in-foto-estado" style="font-size:10.5px;color:#94a3b8;margin-top:2px;"></div>
                    </div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Descripción</label>
                <input id="ops-in-desc" value="${opsEsc(h?.descripcion || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Marca</label>
                    <input id="ops-in-marca" value="${opsEsc(h?.marca || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Modelo</label>
                    <input id="ops-in-modelo" value="${opsEsc(h?.modelo || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Categoría</label>
                <input id="ops-in-cat" value="${opsEsc(h?.categoria || "")}" placeholder="Ej. Herramienta eléctrica" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">N.° de serie (opcional)</label>
                <input id="ops-in-serie" value="${opsEsc(h?.numeroSerie || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Departamento</label>
                    <select id="ops-in-depto" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        <option value="">— Selecciona —</option>
                        ${DEPARTAMENTOS_HERRAMIENTA.map(d => `<option value="${opsEsc(d)}" ${h?.departamento === d ? "selected" : ""}>${opsEsc(d)}</option>`).join("")}
                    </select></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Condición</label>
                    <select id="ops-in-cond" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        ${Object.keys(CONDICIONES_HERRAMIENTA).map(k => `<option value="${k}" ${h?.condicion === k ? "selected" : ""}>${CONDICIONES_HERRAMIENTA[k].label}</option>`).join("")}
                    </select></div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Uso / para qué sirve (opcional)</label>
                <input id="ops-in-uso" value="${opsEsc(h?.uso || "")}" placeholder="Ej. Apriete de tuercas hidráulicas" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Peso (opcional)</label>
                        <div style="display:flex;gap:6px;">
                            <input id="ops-in-peso" type="number" step="0.01" min="0" value="${h?.peso ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                            <select id="ops-in-peso-unidad" style="border:1px solid #cbd5e1;border-radius:8px;padding:8px 6px;font-size:13px;margin:4px 0 10px;">
                                ${UNIDADES_PESO.map(u => `<option value="${u}" ${h?.pesoUnidad === u ? "selected" : ""}>${u}</option>`).join("")}
                            </select>
                        </div>
                    </div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Medida (opcional)</label>
                    <input id="ops-in-medida" value="${opsEsc(h?.medida || "")}" placeholder="Ej. 45 x 12 x 8 cm" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>

                ${h ? `
                <label style="display:flex;align-items:center;gap:7px;margin-top:4px;font-size:12px;color:#334155;cursor:pointer;">
                    <input type="checkbox" id="ops-in-requiere-autorizacion" ${h.requiereAutorizacion ? "checked" : ""} style="width:15px;height:15px;">
                    Requiere autorización previa para asignarse/traspasarse (ej. equipo de calibración)
                </label>
                <div style="font-size:10.5px;color:#94a3b8;margin-top:10px;">Para reasignar a otro técnico o cambiar su ubicación, usa "Registrar movimiento" en la ficha — aquí solo se editan los datos de la pieza.</div>
                ` : `
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
                </div>`}

                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button id="ops-pieza-btn-guardar" onclick="opsGuardarPieza('${id || ""}')" class="mkt-add-btn" style="background:#1D2E73;">${h ? "Guardar cambios" : "Generar folio y guardar"}</button>
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
            resEl.innerHTML = `<span style="color:#166534;display:flex;align-items:center;gap:5px;">${ICON.check} Vinculada a requisición ${opsEsc(opsRequisicionSeleccionada.folio)}${data.proveedor ? " · " + opsEsc(data.proveedor) : ""}</span>`;
        } catch (err) {
            console.error("[operaciones.js] error al buscar requisición de compra:", err);
            resEl.innerHTML = `<span style="color:#E7402B;">Error al buscar. Revisa el nombre del campo "folio" en Compras.</span>`;
        }
    };

    window.opsPreviewFotoPieza = async function (inputEl) {
        const file = inputEl.files && inputEl.files[0];
        if (!file) return;
        const estadoEl = document.getElementById("ops-in-foto-estado");
        if (estadoEl) estadoEl.textContent = "Procesando...";
        try {
            const dataUrl = await opsComprimirImagenBase64(file, 700, 0.6);
            window.__opsFotoPiezaTmp = dataUrl;
            const img = document.getElementById("ops-in-foto-preview");
            if (img) { img.src = dataUrl; img.style.display = ""; }
            if (estadoEl) estadoEl.textContent = "Lista — se guarda junto con el resto del formulario.";
        } catch (err) {
            console.error("[opsPreviewFotoPieza]", err);
            if (estadoEl) estadoEl.textContent = "Error al procesar la foto (revisa que no sea muy pesada).";
        }
    };

    window.opsGuardarPieza = async function (id) {
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
            const requiereAutorizacion = document.getElementById("ops-in-requiere-autorizacion").checked;
            const { db, fs } = await opsGetFB();

            if (id) {
                // Edición: solo los datos propios de la pieza — estado, técnico y
                // ubicación se manejan por separado con "Registrar movimiento"/"Dar de baja".
                const datos = { descripcion, marca, modelo, categoria, numeroSerie, departamento, condicion, uso, peso, pesoUnidad, medida, requiereAutorizacion };
                if (window.__opsFotoPiezaTmp) datos.fotoBase64 = window.__opsFotoPiezaTmp;
                await opsSbHerrActualizar(id, datos);
                const idx = cacheHerr.findIndex(x => x.id === id);
                if (idx >= 0) cacheHerr[idx] = { ...cacheHerr[idx], ...datos };
                document.getElementById("ops-modal-wrap").innerHTML = "";
                if (document.getElementById("ops-panel-wrap")?.innerHTML) window.opsAbrirFichaHerramienta(id);
                return;
            }

            const tecnicoDestinoId = document.getElementById("ops-in-tecnico-destino").value || null;
            const req = opsRequisicionSeleccionada ? { id: opsRequisicionSeleccionada.id, folio: opsRequisicionSeleccionada.folio } : null;
            const pieza = {
                descripcion, marca, modelo, categoria, numeroSerie,
                departamento, condicion, uso, peso, pesoUnidad, medida,
                fotoBase64: window.__opsFotoPiezaTmp || null,
                requiereAutorizacion, tecnicoDestinoId, requisicion: req,
                fechaAlta: opsHoy(), capturadoPor: (typeof opsUsuarioActual === "function" ? opsUsuarioActual() : null),
            };

            try {
                const folio = await opsCrearPiezaNueva(pieza);
                if (tecnicoDestinoId) {
                    try { opsGenerarResponsivaPDF(folio, true); }
                    catch (err) { console.error("[operaciones.js] la pieza se guardó, pero falló la responsiva PDF:", err); }
                }
            } catch (err) {
                if (!opsEsErrorDeCuota(err)) throw err;
                // Firestore sin cuota (plan Spark): la pieza NO se pierde — se guarda en
                // este navegador y se sube sola en cuanto Firebase vuelva a aceptar escrituras.
                const guardada = opsGuardarPiezaPendiente(pieza);
                if (!guardada) throw new Error("Firebase sin cuota y no hubo espacio en el navegador para guardarla temporalmente (quita la foto e intenta de nuevo).");
                alert("Firebase está sin cuota por hoy, así que la pieza \"" + descripcion + "\" quedó guardada TEMPORALMENTE en este navegador.\n\n"
                    + "Se subirá sola (con su folio HT definitivo) en cuanto Firebase se reinicie (aprox. 1:00 a.m.). "
                    + "Solo abre Operaciones en ESTA misma computadora y navegador después de esa hora.\n\n"
                    + "No borres el historial/caché del navegador mientras tanto.");
                opsPintarAvisoPendientes();
            }
            opsRequisicionSeleccionada = null;
            document.getElementById("ops-modal-wrap").innerHTML = "";
        } catch (err) {
            console.error("[operaciones.js] error al guardar la pieza:", err);
            alert("No se pudo guardar la pieza: " + (err && err.message ? err.message : err) + "\n\nRevisa la consola del navegador (F12) para más detalle.");
            if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.textContent = "Generar folio y guardar"; }
        }
    };

    // ── Alta de pieza (compartida por el guardado normal y la cola de pendientes) ──
    async function opsCrearPiezaNueva(p) {
        const { db, fs } = await opsGetFB();
        const folio = await opsSiguienteFolioHerramienta();
        await opsSbHerrGuardar(folio, {
            folio, descripcion: p.descripcion, marca: p.marca, modelo: p.modelo, categoria: p.categoria, numeroSerie: p.numeroSerie,
            departamento: p.departamento, condicion: p.condicion, uso: p.uso, peso: p.peso, pesoUnidad: p.pesoUnidad, medida: p.medida,
            fotoBase64: p.fotoBase64 || null,
            estado: p.tecnicoDestinoId ? "asignada" : "disponible",
            ubicacionActual: UBICACIONES[0],
            tecnicoActualId: p.tecnicoDestinoId || null,
            fechaAsignacion: p.tecnicoDestinoId ? opsHoy() : null,
            folioLegado: null, observaciones: null,
            fechaAlta: p.fechaAlta || opsHoy(),
            origenRequisicionId: p.requisicion ? p.requisicion.id : null,
            origenRequisicionFolio: p.requisicion ? p.requisicion.folio : null,
            requiereAutorizacion: !!p.requiereAutorizacion,
            externalId: null, sourceSystem: "manual", lastSync: null, syncStatus: "no_sincronizado",
        });
        await opsRegistrarMovimiento({
            herramientaId: folio, tipo: "alta", ubicacionNueva: UBICACIONES[0],
            tecnicoNuevoId: p.tecnicoDestinoId || null,
            observaciones: p.requisicion ? `Origen: requisición de compra ${p.requisicion.folio}` : null,
        });
        // Cierra el círculo del lado de Compras: la requisición queda marcada
        // con la pieza (folio) que resultó de ella y a quién se le entregó.
        // Solo escribe campos NUEVOS — no toca nada que ya use compras.js.
        if (p.requisicion) {
            try {
                await fs.updateDoc(fs.doc(db, "requisiciones_compra", p.requisicion.id), {
                    herramientaId: folio,
                    herramientaDescripcion: p.descripcion,
                    herramientaAltaFecha: opsHoy(),
                    herramientaTecnicoDestinoId: p.tecnicoDestinoId || null,
                });
            } catch (err) {
                console.error("[operaciones.js] no se pudo actualizar la requisición de origen:", err);
            }
        }
        if (p.tecnicoDestinoId && !cacheHerr.some(x => x.id === folio)) {
            // opsGenerarResponsivaPDF lee de cacheHerr, que aún no tiene esta pieza
            // recién creada (el onSnapshot tarda unos ms) — se agrega en caliente.
            cacheHerr.push({
                id: folio, folio, descripcion: p.descripcion, marca: p.marca, modelo: p.modelo, categoria: p.categoria, numeroSerie: p.numeroSerie,
                estado: "asignada", ubicacionActual: UBICACIONES[0],
                tecnicoActualId: p.tecnicoDestinoId, fechaAsignacion: opsHoy(),
            });
        }
        return folio;
    }

    // ── Cola local de piezas pendientes (cuando Firestore se queda sin cuota) ──
    const OPS_LS_PENDIENTES = "ops_herr_pendientes_v1";
    let opsSincronizandoPendientes = false;
    let opsPendientesTimer = null;

    function opsEsErrorDeCuota(err) {
        const code = String((err && err.code) || "").toLowerCase();
        const msg = String((err && err.message) || err || "").toLowerCase();
        return code === "resource-exhausted" || code === "unavailable"
            || msg.includes("quota") || msg.includes("resource-exhausted") || msg.includes("too many requests");
    }
    function opsLeerPendientes() {
        try { return JSON.parse(localStorage.getItem(OPS_LS_PENDIENTES) || "[]") || []; } catch (e) { return []; }
    }
    function opsEscribirPendientes(lista) {
        try {
            if (lista.length) localStorage.setItem(OPS_LS_PENDIENTES, JSON.stringify(lista));
            else localStorage.removeItem(OPS_LS_PENDIENTES);
            return true;
        } catch (e) {
            console.error("[operaciones.js] no se pudo escribir la cola local de pendientes:", e);
            return false;
        }
    }
    function opsGuardarPiezaPendiente(pieza) {
        const lista = opsLeerPendientes();
        lista.push({ ...pieza, pendienteId: "PEND-" + Date.now() + "-" + Math.floor(Math.random() * 1000), encoladaEn: new Date().toISOString() });
        if (opsEscribirPendientes(lista)) return true;
        // Sin espacio: se reintenta sin la foto antes de rendirse.
        lista[lista.length - 1].fotoBase64 = null;
        return opsEscribirPendientes(lista);
    }
    function opsPintarAvisoPendientes() {
        const lista = opsLeerPendientes();
        let el = document.getElementById("ops-aviso-pendientes");
        if (!lista.length) { if (el) el.remove(); return; }
        if (!el) {
            el = document.createElement("div");
            el.id = "ops-aviso-pendientes";
            el.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:99999;background:#1D2E73;color:#fff;border-radius:10px;padding:10px 14px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;max-width:420px;";
            document.body.appendChild(el);
        }
        el.innerHTML = `<span>⏳ ${lista.length} pieza(s) guardada(s) en este navegador, pendientes de subir a Firebase.</span>
            <button onclick="opsSincronizarPiezasPendientes(true)" style="background:#E7402B;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-weight:600;cursor:pointer;white-space:nowrap;">Reintentar</button>`;
    }
    window.opsSincronizarPiezasPendientes = async function (manual) {
        if (opsSincronizandoPendientes) return;
        const lista = opsLeerPendientes();
        if (!lista.length) { opsPintarAvisoPendientes(); return; }
        opsSincronizandoPendientes = true;
        const subidas = [];
        let restantes = lista.slice();
        try {
            for (const p of lista) {
                try {
                    const folio = await opsCrearPiezaNueva(p);
                    subidas.push({ folio, descripcion: p.descripcion, asignada: !!p.tecnicoDestinoId });
                    restantes = restantes.filter(x => x.pendienteId !== p.pendienteId);
                    opsEscribirPendientes(restantes);
                } catch (err) {
                    console.warn("[operaciones.js] pieza pendiente aún no se pudo subir:", err && err.message);
                    break; // si Firebase sigue sin cuota, no tiene caso intentar las demás
                }
            }
        } finally {
            opsSincronizandoPendientes = false;
            opsPintarAvisoPendientes();
        }
        if (subidas.length) {
            const conResponsiva = subidas.filter(x => x.asignada);
            alert("Se subieron " + subidas.length + " pieza(s) pendientes:\n\n"
                + subidas.map(x => "• " + x.folio + " — " + x.descripcion).join("\n")
                + (conResponsiva.length ? "\n\nLas que se asignaron a técnico: abre su ficha y usa \"Regenerar responsiva PDF\"." : "")
                + (restantes.length ? "\n\nQuedan " + restantes.length + " pendiente(s); se reintentará en unos minutos." : ""));
        } else if (manual) {
            alert("Firebase todavía no acepta escrituras (sin cuota). Se reintentará solo cada 10 minutos mientras Operaciones esté abierto.");
        }
    };
    function opsIniciarReintentoPendientes() {
        opsPintarAvisoPendientes();
        if (!opsLeerPendientes().length) return;
        window.opsSincronizarPiezasPendientes(false);
        if (!opsPendientesTimer) opsPendientesTimer = setInterval(() => {
            if (!opsLeerPendientes().length) { clearInterval(opsPendientesTimer); opsPendientesTimer = null; return; }
            window.opsSincronizarPiezasPendientes(false);
        }, 10 * 60 * 1000);
    }

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
                await opsSbHerrGuardar(folio, {
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
        cacheHerr = await opsSbHerrListar();

        const msg = `Importación completa: ${tecnicosCreados} técnico(s) nuevo(s), ${piezasCreadas} pieza(s) creada(s)${piezasOmitidas ? `, ${piezasOmitidas} omitida(s) por ya existir` : ""}.`;
        window.mostrarPush ? mostrarPush("Herramientas", msg, "📥") : alert(msg);
        opsRenderDashboard();
    };

    window.opsSembrarCatalogoBase = async function () {
        if (cacheHerr.length > 0 && !confirm("Ya hay piezas registradas. ¿Agregar de todos modos el catálogo base (22 piezas)?")) return;
        const { db, fs } = await opsGetFB();
        for (const [descripcion, categoria, subcategoria] of CATALOGO_BASE) {
            const folio = await opsSiguienteFolioHerramienta();
            await opsSbHerrGuardar(folio, {
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

        const tecnicosActivos = opsTecOperativos();
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

            await opsSbHerrActualizar(herramientaId, update);
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

            await window.tcNotificar2(fs, db, {
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
        await opsSbHerrActualizar(herramientaId, {
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
        const activos = cacheTec.filter(t => t.estatus === "activo" && (!opsEsAdministrativo(t) || cacheHerr.some(h => h.tecnicoActualId === t.id))).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
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
        const grupos = {
            operativos: cacheTec.filter(t => t.estatus === "activo" && !opsEsAdministrativo(t)),
            administrativos: cacheTec.filter(t => t.estatus === "activo" && opsEsAdministrativo(t)),
            bajas: cacheTec.filter(t => t.estatus !== "activo"),
        };
        const lista = (grupos[opsTecVista] || grupos.operativos).filter(t => !filtro || (t.nombre || "").toLowerCase().includes(filtro) || (t.numeroOperativo || "").toLowerCase().includes(filtro));
        const segTec = [["operativos", "Operativos"], ["administrativos", "Administrativos"], ["bajas", "Bajas"]].map(([k, n]) => {
            const on = opsTecVista === k;
            return `<button onclick="opsTecCambiarVista('${k}')" style="border:none;background:${on ? "#1D2E73" : "transparent"};color:${on ? "#fff" : "#475569"};padding:6px 12px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">${n} <span style="opacity:.7;">${grupos[k].length}</span></button>`;
        }).join("");

        el.innerHTML = `
            <div style="background:#fff;border-radius:14px;border:1px solid #e2e8f0;padding:16px 18px;">
                <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;">
                    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <div style="display:flex;gap:3px;background:#f1f5f9;padding:3px;border-radius:9px;">${segTec}</div>
                    <input type="text" id="ops-tec-buscar" value="${opsEsc(filtroTec)}" placeholder="Buscar técnico..." oninput="opsFiltrarTec(this.value)" style="border:1px solid #cbd5e1;border-radius:8px;padding:7px 11px;font-size:12.5px;width:260px;outline:none;">
                    </div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${gestion ? `<button onclick="opsAbrirModalPersonalAdmin()" title="Quién NO debe aparecer en calendario ni asignaciones" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;">${ICON.user} Personal administrativo</button>` : ""}
                        ${gestion ? `<button onclick="opsExportarInventarioPDF()" title="PDF de herramienta por técnico, para auditoría" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.printer} PDF auditoría</button>` : ""}
                        ${gestion ? `<button onclick="opsExportarInventarioExcel()" title="Excel de herramienta por técnico, para auditoría" style="background:#eef2f7;border:none;color:#1f2937;padding:7px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.file} Excel auditoría</button>` : ""}
                        ${gestion ? `<button onclick="opsAbrirModalTecnico()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo técnico</button>` : ""}
                        ${opsPuedeHacer("admin_operaciones") ? `<button onclick="opsAbrirModalAccesos()" class="mkt-add-btn" style="background:#7c3aed;">${ICON.key} Accesos a Operaciones</button>` : ""}
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
                        <tbody>${lista.length ? lista.map((t, i) => opsFilaTecnico(t, i)).join("") : `<tr><td colspan="5" style="padding:22px;text-align:center;color:#94a3b8;">${opsTecVista === "bajas" ? "Sin técnicos dados de baja." : opsTecVista === "administrativos" ? "Nadie marcado como administrativo." : "Sin técnicos registrados."}</td></tr>`}</tbody>
                    </table>
                </div>
            </div>`;
    }

    window.opsFiltrarTec = function (v) { filtroTec = v || ""; opsRerenderConFoco(opsRenderTecnicos); };
    window.opsTecCambiarVista = function (v) { opsTecVista = v; opsRenderTecnicos(); };

    // Revisión de personal administrativo: una lista con interruptor por persona.
    window.opsAbrirModalPersonalAdmin = function () {
        const activos = cacheTec.filter(t => t.estatus === "activo").sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:560px;max-width:96vw;max-height:88vh;display:flex;flex-direction:column;">
                <div style="padding:20px 22px 10px;">
                    <div style="font-weight:700;font-size:15px;color:#1e293b;">Personal administrativo</div>
                    <div style="font-size:11.5px;color:#64748b;margin-top:4px;">Marcados = <b>no aparecen</b> en Calendario, asignación de folios, guardias ni listas de herramienta. Siguen teniendo su acceso a Operaciones. Los que dicen "sugerido" vienen de la lista de Paloma o de su puesto — revísalos antes de guardar.</div>
                </div>
                <div style="overflow-y:auto;padding:0 22px;flex:1;">
                    ${activos.map(t => {
                        const marcado = t.ocultarEnListas === true || (t.ocultarEnListas === undefined && (opsEsAdministrativo(t) || opsEsSugeridoAdmin(t)));
                        const sugerido = t.ocultarEnListas === undefined && (opsEsAdministrativo(t) || opsEsSugeridoAdmin(t));
                        return `<label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f1f5f9;cursor:pointer;">
                            <input type="checkbox" class="ops-admin-check" value="${t.id}" ${marcado ? "checked" : ""} style="width:16px;height:16px;">
                            ${opsTecAvatarHTML(t, 26)}
                            <span style="flex:1;min-width:0;"><span style="font-size:12.5px;font-weight:600;color:#1e293b;">${opsEsc(t.nombre)}</span><br><span style="font-size:10.5px;color:#94a3b8;">${opsEsc(t.puesto || "Sin puesto")}</span></span>
                            ${sugerido ? `<span style="background:#fef3c7;color:#92400e;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:999px;">sugerido</span>` : ""}
                        </label>`;
                    }).join("")}
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid #f1f5f9;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button id="ops-admin-guardar" onclick="opsGuardarPersonalAdmin()" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
                </div>
            </div>
        </div>`;
    };
    window.opsGuardarPersonalAdmin = async function () {
        const btn = document.getElementById("ops-admin-guardar");
        if (btn) { btn.disabled = true; btn.textContent = "Guardando..."; }
        try {
            const { db, fs } = await opsGetFB();
            const checks = Array.from(document.querySelectorAll(".ops-admin-check"));
            for (const c of checks) {
                const t = cacheTec.find(x => x.id === c.value);
                if (!t || t.ocultarEnListas === c.checked) continue;
                await fs.updateDoc(fs.doc(db, COL_TECNICOS, t.id), { ocultarEnListas: c.checked });
                t.ocultarEnListas = c.checked;
            }
            document.getElementById("ops-modal-wrap").innerHTML = "";
            opsRenderTecnicos();
        } catch (err) {
            console.error("[operaciones.js] error al guardar personal administrativo:", err);
            alert("No se pudo guardar: " + err.message);
            if (btn) { btn.disabled = false; btn.textContent = "Guardar"; }
        }
    };

    // Eliminar DEFINITIVAMENTE a un técnico dado de baja: borra su ficha, sus ausencias y
    // su almacén vacío. Los folios, movimientos y bitácoras conservan su nombre como texto
    // histórico. No se puede deshacer.
    window.opsEliminarTecnicoDefinitivo = async function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        if (t.estatus === "activo") { alert("Primero da de baja al técnico."); return; }
        const herr = cacheHerr.filter(h => h.tecnicoActualId === idInterno).length;
        const mat = cacheAlmacenTec.filter(m => m.tecnicoId === idInterno && m.cantidad > 0).length;
        if (herr || mat) { alert("No se puede eliminar: todavía tiene herramienta o material a su nombre."); return; }
        const escrito = prompt(`Esto borra para siempre la ficha de ${t.nombre}, sus ausencias y su almacén.\nLos folios e historial conservan su nombre como texto.\n\nNo se puede deshacer. Escribe ELIMINAR para confirmar:`);
        if ((escrito || "").trim().toUpperCase() !== "ELIMINAR") return;
        try {
            const { db, fs } = await opsGetFB();
            for (const a of cacheAusencias.filter(a => a.tecnicoId === idInterno)) await fs.deleteDoc(fs.doc(db, COL_AUSENCIAS, a.id));
            await fs.deleteDoc(fs.doc(db, COL_ALMACENES, idInterno)).catch(() => {});
            await fs.deleteDoc(fs.doc(db, COL_TECNICOS, idInterno));
            cacheTec = cacheTec.filter(x => x.id !== idInterno);
            cacheAusencias = cacheAusencias.filter(a => a.tecnicoId !== idInterno);
            const panel = document.getElementById("ops-panel-wrap");
            if (panel) panel.innerHTML = "";
            opsRenderTecnicos();
        } catch (err) {
            console.error("[operaciones.js] error al eliminar técnico:", err);
            alert("No se pudo eliminar: " + err.message);
        }
    };

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

    // Foto de perfil del técnico (rediseño Calendario, sep-2026). Se guarda comprimida y recortada
    // a cuadro (256×256, ~15-30 KB) como base64 dentro del propio documento del técnico en ops_tecnicos —
    // el mismo criterio que ya usan las fotos de herramientas (sin Firebase Storage, sin base nueva).
    // undefined = sin cambios · null = eliminar · "data:image/..." = nueva foto. Se aplica al guardar.
    let opsFotoTecnicoPendiente;
    function opsComprimirAvatar(file, lado) {
        return new Promise((resolve, reject) => {
            const img = new Image(); const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                img.onerror = reject;
                img.onload = () => {
                    const corte = Math.min(img.width, img.height);
                    const sx = (img.width - corte) / 2, sy = (img.height - corte) / 2;
                    const canvas = document.createElement("canvas"); canvas.width = lado; canvas.height = lado;
                    canvas.getContext("2d").drawImage(img, sx, sy, corte, corte, 0, 0, lado, lado);
                    resolve(canvas.toDataURL("image/jpeg", 0.82));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }
    window.opsElegirFotoTecnico = async function (idInterno, inputEl) {
        const file = inputEl.files && inputEl.files[0];
        if (!file) return;
        const estado = document.getElementById("ops-edit-foto-estado");
        try {
            if (estado) estado.textContent = "Procesando…";
            opsFotoTecnicoPendiente = await opsComprimirAvatar(file, 256);
            const t = cacheTec.find(x => x.id === idInterno) || {};
            const prev = document.getElementById("ops-edit-foto-preview");
            if (prev) prev.innerHTML = opsTecAvatarHTML({ ...t, fotoPerfil: opsFotoTecnicoPendiente }, 64);
            const btn = document.getElementById("ops-edit-foto-btn"); if (btn) btn.textContent = "Reemplazar fotografía";
            if (estado) estado.textContent = "Foto lista — presiona “Guardar cambios”.";
        } catch (e) {
            console.error("[opsElegirFotoTecnico]", e);
            if (estado) estado.textContent = "No se pudo leer esa imagen.";
        }
    };
    window.opsQuitarFotoTecnico = function (idInterno) {
        opsFotoTecnicoPendiente = null;
        const t = cacheTec.find(x => x.id === idInterno) || {};
        const prev = document.getElementById("ops-edit-foto-preview");
        if (prev) prev.innerHTML = opsTecAvatarHTML({ ...t, fotoPerfil: null }, 64);
        const btn = document.getElementById("ops-edit-foto-btn"); if (btn) btn.textContent = "Subir fotografía";
        const estado = document.getElementById("ops-edit-foto-estado"); if (estado) estado.textContent = "Se eliminará al presionar “Guardar cambios”.";
    };

    window.opsAbrirModalEditarTecnico = function (idInterno) {
        const t = cacheTec.find(x => x.id === idInterno);
        if (!t) return;
        opsFotoTecnicoPendiente = undefined; // cada apertura del modal empieza sin cambios de foto
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;max-height:88vh;overflow-y:auto;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;display:flex;align-items:center;gap:6px;">${ICON.pencil} Editar perfil</div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:14px;">Cada cambio queda registrado en la auditoría (usuario, fecha, valor anterior/nuevo).</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Foto de perfil</label>
                <div style="display:flex;align-items:center;gap:12px;margin:6px 0 14px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                    <div id="ops-edit-foto-preview">${opsTecAvatarHTML(t, 64)}</div>
                    <div style="display:flex;flex-direction:column;gap:6px;">
                        <label style="background:#1D2E73;color:#fff;font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:8px;cursor:pointer;text-align:center;">
                            <span id="ops-edit-foto-btn">${t.fotoPerfil ? "Reemplazar fotografía" : "Subir fotografía"}</span>
                            <input type="file" accept="image/*" style="display:none;" onchange="opsElegirFotoTecnico('${idInterno}', this)">
                        </label>
                        <button type="button" onclick="opsQuitarFotoTecnico('${idInterno}')" style="background:#fff;border:1px solid #e2e8f0;color:#E7402B;font-size:11.5px;font-weight:600;padding:5px 12px;border-radius:8px;cursor:pointer;">Eliminar fotografía</button>
                        <span id="ops-edit-foto-estado" style="font-size:10.5px;color:#94a3b8;">Se verá en el Calendario. Se guarda al presionar “Guardar cambios”.</span>
                    </div>
                </div>
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
        if (opsFotoTecnicoPendiente !== undefined && opsFotoTecnicoPendiente !== (t.fotoPerfil || null)) {
            cambios.fotoPerfil = opsFotoTecnicoPendiente; // string (nueva/reemplazo) o null (eliminar)
            await opsAuditar("tecnico", idInterno, "fotoPerfil", t.fotoPerfil ? "(foto)" : null, opsFotoTecnicoPendiente ? "(foto nueva)" : null); // no se guarda la imagen en la auditoría
        }
        opsFotoTecnicoPendiente = undefined;
        if (Object.keys(cambios).length) await fs.updateDoc(fs.doc(db, COL_TECNICOS, idInterno), cambios);
        const snapTec = await fs.getDocs(fs.collection(db, COL_TECNICOS));
        cacheTec = snapTec.docs.map(d => ({ id: d.id, ...d.data() }));
        document.getElementById("ops-modal-wrap").innerHTML = "";
        opsAbrirFichaTecnico(idInterno);
    };


    // ═══════════════════ Accesos a Operaciones (varios usuarios, con privilegios) ═══════════════════
    // Reutiliza el sistema de puestos/permisos que ya existe (ops_puestos), sin inventar uno nuevo.
    // Dar acceso = crear/actualizar una entrada en ops_tecnicos con el puesto correcto — así
    // opsPermisosPorPuestoDeCorreo() ya lo reconoce automáticamente, sin tocar nada más del código.
    window.opsAbrirModalAccesos = function () {
        const puestosOps = (cachePuestos.length ? cachePuestos : PUESTOS_SEED).filter(p => p.departamento === "Operaciones");
        const conAcceso = cacheTec.filter(t => t.estatus === "activo" && puestosOps.some(p => (p.id && p.id === t.puestoId) || p.nombre === t.puesto));
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:520px;max-width:94vw;max-height:88vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Accesos a Operaciones</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:6px;">Esto controla qué puede <b>hacer</b> alguien dentro de Operaciones. Para que además <b>vea</b> el módulo en su menú, su departamento en Recursos Humanos debe estar puesto como "Operaciones" — eso se ajusta desde RH, no desde aquí.</div>

                <div style="font-size:11.5px;font-weight:700;color:#1e293b;margin:14px 0 6px;">Quién tiene acceso hoy (${conAcceso.length})</div>
                <div style="border:1px solid #e2e8f0;border-radius:10px;max-height:200px;overflow-y:auto;margin-bottom:16px;">
                    ${conAcceso.length ? conAcceso.map(t => `
                        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;">
                            <div style="flex:1;">
                                <div style="font-weight:600;color:#1e293b;">${opsEsc(t.nombre)}</div>
                                <div style="font-size:10.5px;color:#94a3b8;">${opsEsc(t.correo || "sin correo")}</div>
                            </div>
                            <select onchange="opsCambiarPuestoAcceso('${t.id}', this.options[this.selectedIndex].dataset.nombre)" style="border:1px solid #cbd5e1;border-radius:7px;padding:4px 6px;font-size:11px;">
                                ${puestosOps.map(p => `<option value="${p.id || p.nombre}" data-nombre="${opsEsc(p.nombre)}" ${(p.id === t.puestoId || p.nombre === t.puesto) ? "selected" : ""}>${opsEsc(p.nombre)}</option>`).join("")}
                            </select>
                            <button onclick="opsRevocarAcceso('${t.id}')" title="Revocar acceso" style="background:#fef2f2;border:none;color:#E7402B;width:26px;height:26px;border-radius:7px;cursor:pointer;">${ICON.trash}</button>
                        </div>`).join("") : `<div style="padding:12px;color:#94a3b8;font-size:12px;">Nadie tiene un puesto de Operaciones asignado todavía.</div>`}
                </div>

                <div style="border-top:1px dashed #e2e8f0;padding-top:14px;">
                    <div style="font-size:11.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Dar acceso nuevo</div>
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Nombre</label>
                    <input id="ops-acc-nombre" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Correo (con este inicia sesión en el portal)</label>
                    <input id="ops-acc-correo" type="email" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Privilegios (puesto)</label>
                    <select id="ops-acc-puesto" onchange="opsMostrarDescPuesto(this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;">
                        ${puestosOps.map(p => `<option value="${p.id || p.nombre}" data-nombre="${opsEsc(p.nombre)}" data-permisos="${opsEsc((p.permisos || []).join(", "))}">${opsEsc(p.nombre)}</option>`).join("")}
                    </select>
                    <div id="ops-acc-desc" style="font-size:10.5px;color:#94a3b8;margin-bottom:14px;">${opsEsc((puestosOps[0]?.permisos || []).join(", "))}</div>
                    <div style="display:flex;gap:8px;justify-content:flex-end;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                        <button onclick="opsGuardarAcceso()" class="mkt-add-btn" style="background:#7c3aed;">Dar acceso</button>
                    </div>
                </div>
            </div>
        </div>`;
    };

    window.opsMostrarDescPuesto = function (valor) {
        const opt = document.querySelector(`#ops-acc-puesto option[value="${CSS.escape(valor)}"]`);
        const desc = document.getElementById("ops-acc-desc");
        if (opt && desc) desc.textContent = opt.dataset.permisos || "";
    };

    window.opsGuardarAcceso = async function () {
        const nombre = document.getElementById("ops-acc-nombre").value.trim();
        const correo = document.getElementById("ops-acc-correo").value.trim().toLowerCase();
        const selectPuesto = document.getElementById("ops-acc-puesto");
        const nombrePuesto = selectPuesto.options[selectPuesto.selectedIndex]?.dataset.nombre;
        if (!nombre || !correo) { alert("Nombre y correo son obligatorios."); return; }
        if (!nombrePuesto) { alert("Selecciona un puesto válido."); return; }
        // El id real (si ya existe en Firestore) se busca por nombre en este momento — pero aunque
        // no se encuentre, se guarda igual con el nombre: el motor de permisos empareja por nombre
        // como respaldo, así que nunca se queda sin acceso por un id desincronizado.
        const puestoIdReal = cachePuestos.find(p => p.nombre === nombrePuesto)?.id || null;
        const yaExiste = cacheTec.find(t => (t.correo || "").toLowerCase().trim() === correo);
        try {
            const { db, fs } = await opsGetFB();
            if (yaExiste) {
                await fs.updateDoc(fs.doc(db, COL_TECNICOS, yaExiste.id), { puestoId: puestoIdReal, puesto: nombrePuesto, departamento: "Operaciones" });
            } else {
                await fs.addDoc(fs.collection(db, COL_TECNICOS), {
                    nombre, correo, puestoId: puestoIdReal, puesto: nombrePuesto, departamento: "Operaciones",
                    estatus: "activo", fechaIngreso: opsHoy(), fechaBaja: null, numeroOperativo: null,
                    esPersonalOficina: nombrePuesto !== "Técnico de Operaciones",
                    habilidades: [], observaciones: "Alta desde \"Accesos a Operaciones\" — sin ficha completa de técnico de campo.",
                });
            }
            const snap = await fs.getDocs(fs.collection(db, COL_TECNICOS));
            cacheTec = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            if (window.mostrarPush) window.mostrarPush("Operaciones", "Acceso otorgado.", "✅");
            window.opsAbrirModalAccesos();
        } catch (e) {
            console.error("[opsGuardarAcceso]", e);
            alert("No se pudo dar el acceso: " + e.message);
        }
    };

    window.opsCambiarPuestoAcceso = async function (tecnicoId, nombrePuesto) {
        if (!nombrePuesto) return;
        const puestoIdReal = cachePuestos.find(p => p.nombre === nombrePuesto)?.id || null;
        try {
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_TECNICOS, tecnicoId), { puestoId: puestoIdReal, puesto: nombrePuesto });
            const t = cacheTec.find(x => x.id === tecnicoId);
            if (t) { t.puestoId = puestoIdReal; t.puesto = nombrePuesto; }
        } catch (e) {
            console.error("[opsCambiarPuestoAcceso]", e);
            alert("No se pudo cambiar: " + e.message);
        }
    };

    window.opsRevocarAcceso = async function (tecnicoId) {
        const t = cacheTec.find(x => x.id === tecnicoId);
        if (!t) return;
        if (!confirm(`¿Revocar el acceso de ${t.nombre} a Operaciones? (deja de contar como personal activo del departamento)`)) return;
        try {
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_TECNICOS, tecnicoId), { estatus: "baja", fechaBaja: opsHoy() });
            t.estatus = "baja"; t.fechaBaja = opsHoy();
            window.opsAbrirModalAccesos();
        } catch (e) {
            console.error("[opsRevocarAcceso]", e);
            alert("No se pudo revocar: " + e.message);
        }
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
            habilidades: [], // claves de OPS_HABILIDADES — se editan en la ficha, pestaña "Habilidades"
        });
        await opsCrearAlmacenTecnico(db, fs, refTecNuevo.id, nombrePersona);
        // Abre el primer periodo en el historial de puesto de esta persona.
        await fs.addDoc(fs.collection(db, COL_HIST_PUESTO), { personaId, puestoId, desde: opsHoy(), hasta: null });
        cacheHistPuesto.push({ personaId, puestoId, desde: opsHoy(), hasta: null });

        document.getElementById("ops-modal-wrap").innerHTML = "";
    };

    window.opsGuardarHabilidadesTecnico = async function (idInterno) {
        try {
            const marcadas = Array.from(document.querySelectorAll("#ops-hab-checks input[type=checkbox]:checked")).map(c => c.value);
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_TECNICOS, idInterno), { habilidades: marcadas });
            const t = cacheTec.find(x => x.id === idInterno);
            if (t) t.habilidades = marcadas;
            if (window.mostrarPush) window.mostrarPush("Operaciones", "Habilidades actualizadas", "✅");
            else alert("Habilidades guardadas.");
        } catch (e) {
            console.error("[opsGuardarHabilidadesTecnico]", e);
            alert("No se pudieron guardar las habilidades: " + e.message);
        }
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
                ${guardiaActiva ? `<div style="background:#5b21b6;border-radius:12px;padding:10px 14px;margin-bottom:8px;color:#fff;font-size:11.5px;font-weight:700;display:flex;align-items:center;gap:6px;">${ICON.shield} En guardia — herramienta ${opsEsc(guardiaActiva.herramientaId)}</div>` : ""}

                <div style="background:#fff;border-radius:14px;padding:18px;display:flex;align-items:center;gap:14px;margin-top:8px;">
                    ${opsTecAvatarHTML(t, 52)}
                    <div style="min-width:0;flex:1;">
                        <div style="font-size:15.5px;font-weight:700;color:#1e293b;">${opsEsc(t.nombre)}</div>
                        <div style="font-size:11.5px;color:#64748b;">${opsEsc(t.puesto || "—")} · Técnico N.° ${opsEsc(t.numeroOperativo)}${t.registroHistorico > 1 ? ` (registro ${t.registroHistorico})` : ""}${t.employeeId ? ` · ${opsEsc(t.employeeId)}` : ""}</div>
                        <span style="background:${activo ? "#dcfce7" : "#e5e7eb"};color:${activo ? "#166534" : "#374151"};font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;display:inline-block;margin-top:4px;">${activo ? "Activo" : "Baja"}</span>
                    </div>
                    ${opsPuedeGestionar() ? `
                    <div style="position:relative;">
                        <button onclick="opsToggleMenuTecnico(event)" title="Configuración" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:8px;cursor:pointer;color:#475569;display:flex;align-items:center;justify-content:center;">${ICON.gear}</button>
                        <div id="ops-menu-tecnico" style="display:none;position:absolute;right:0;top:38px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:190px;z-index:10;overflow:hidden;">
                            <button onclick="opsAbrirModalEditarTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border:none;padding:10px 14px;font-size:12.5px;color:#334155;cursor:pointer;display:flex;align-items:center;gap:8px;">${ICON.pencil} Editar perfil</button>
                            ${activo ? `<button onclick="document.getElementById('ops-menu-tecnico').style.display='none';opsIniciarBajaTecnico('${idInterno}')" style="width:100%;text-align:left;background:none;border-top:1px solid #f1f5f9;border-bottom:none;border-left:none;border-right:none;padding:10px 14px;font-size:12.5px;color:#E7402B;cursor:pointer;">${ICON.trash} Dar de baja al técnico</button>` : ""}
                            ${activo ? `<button onclick="document.getElementById('ops-menu-tecnico').style.display='none';opsAbrirModalPersonalAdmin()" style="width:100%;text-align:left;background:none;border-top:1px solid #f1f5f9;border-bottom:none;border-left:none;border-right:none;padding:10px 14px;font-size:12.5px;color:#334155;cursor:pointer;">${ICON.user} ${opsEsAdministrativo(cacheTec.find(x => x.id === idInterno) || {}) ? "Es administrativo (oculto de listas)" : "Marcar como administrativo"}</button>` : ""}
                            ${!activo ? `<button onclick="document.getElementById('ops-menu-tecnico').style.display='none';opsEliminarTecnicoDefinitivo('${idInterno}')" style="width:100%;text-align:left;background:none;border-top:1px solid #f1f5f9;border-bottom:none;border-left:none;border-right:none;padding:10px 14px;font-size:12.5px;color:#E7402B;cursor:pointer;">${ICON.trash} Eliminar datos definitivamente</button>` : ""}
                        </div>
                    </div>` : ""}
                </div>

                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px;">
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">VEHÍCULO</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${vehActual ? opsEsc(vehActual.unidad) : "—"}</div></div>
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">MATERIAL</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${materiales.length}</div></div>
                    <div style="background:#fff;border-radius:12px;padding:11px;text-align:center;"><div style="font-size:9.5px;color:#94a3b8;">HERRAM.</div><div style="font-size:13px;font-weight:700;color:#1e293b;margin-top:2px;">${asignadas.length}</div></div>
                </div>

                <div style="display:flex;gap:4px;margin:14px 0;overflow-x:auto;border-bottom:1px solid #e2e8f0;">
                    ${["resumen:Resumen", "rh:RH", "habilidades:Habilidades", "vehiculo:Vehículo", "herramientas:Herramientas", "ausencias:Ausencias", "auditoria:Auditoría", "historial:Historial"].map(x => {
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
                        <span style="font-size:11.5px;font-weight:700;color:${t.firebaseUid ? "#166534" : "#b45309"};display:inline-flex;align-items:center;gap:5px;">${t.firebaseUid ? `<span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;"></span> Tiene acceso al kiosco` : `<span style="width:7px;height:7px;border-radius:50%;background:#f97316;display:inline-block;"></span> Sin acceso al kiosco`}</span>
                        ${!t.firebaseUid && opsPuedeGestionar() ? `<button onclick="opsAbrirModalAccesoKiosco('${idInterno}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:5px;">${ICON.key} Crear acceso</button>` : ""}
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;">El kiosco de Solicitud de Material (solicitud-material.html) ahora exige inicio de sesión real — sin esta cuenta el técnico no puede pedir material desde ahí.</div>
                </div>
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
                        <span style="font-size:11.5px;font-weight:700;color:${sincronizado ? "#166534" : "#b45309"};display:inline-flex;align-items:center;gap:5px;">${sincronizado ? `<span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;"></span> Sincronizado con RH` : `<span style="width:7px;height:7px;border-radius:50%;background:#f97316;display:inline-block;"></span> Pendiente de sincronización`}</span>
                    </div>
                    <div style="font-size:12.5px;color:#334155;line-height:1.9;">
                        <div><strong>Empleado:</strong> ${opsEsc(t.employeeId || "—")}</div>
                        <div><strong>Correo:</strong> ${opsEsc(t.correo || "—")}</div>
                        <div><strong>Fleet User ID:</strong> ${opsEsc(t.fleetUserId || "—")}</div>
                        <div><strong>Firebase UID:</strong> ${opsEsc(t.firebaseUid || "—")}</div>
                    </div>
                    <div style="font-size:10.5px;color:#94a3b8;margin-top:10px;">Estos identificadores permiten el match con RH/Flotilla por ID, no por nombre. Hoy no hay sincronización real conectada — se completan editando el perfil manualmente.</div>
                </div>`;
        } else if (fichaTecTabActual === "habilidades") {
            const habActuales = new Set(t.habilidades || []);
            el.innerHTML = `
                <div style="background:#fff;border-radius:14px;padding:16px 18px;">
                    <div style="font-size:11.5px;color:#64748b;margin-bottom:12px;">Qué sabe hacer este técnico — se usa para sugerirlo automáticamente al programar un folio que requiera ese rol/habilidad (mismos nombres que usan las recetas del catálogo de servicios).</div>
                    <div id="ops-hab-checks" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
                        ${OPS_HABILIDADES.map(h => `
                            <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#334155;cursor:${opsPuedeGestionar() ? "pointer" : "default"};">
                                <input type="checkbox" value="${h.clave}" ${habActuales.has(h.clave) ? "checked" : ""} ${opsPuedeGestionar() ? "" : "disabled"} style="width:15px;height:15px;">
                                ${opsEsc(h.nombre)}
                            </label>`).join("")}
                    </div>
                    ${opsPuedeGestionar() ? `<button onclick="opsGuardarHabilidadesTecnico('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar habilidades</button>` : ""}
                </div>`;
        } else if (fichaTecTabActual === "vehiculo") {
            el.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px;">Consultando Flotilla…</div>`;
            const vehFlotilla = await window.opsFlotillaProvider.obtenerVehiculoActual(idInterno);
            el.innerHTML = `
                <div style="background:#1D2E73;border-radius:14px;padding:16px 18px;margin-bottom:12px;color:#fff;">
                    <div style="font-size:10.5px;font-weight:700;opacity:0.85;display:flex;align-items:center;gap:6px;">${ICON.truck} VEHÍCULO EN FLOTILLA (en vivo)</div>
                    ${vehFlotilla ? `<div style="font-size:14px;font-weight:700;margin-top:4px;">${opsEsc(vehFlotilla.unidad)} ${vehFlotilla.marca ? "— " + opsEsc(vehFlotilla.marca) + " " + opsEsc(vehFlotilla.modelo) : ""}</div><div style="font-size:11px;color:#C7CEE0;margin-top:2px;">Estado: ${opsEsc(vehFlotilla.estado)}</div>`
                        : `<div style="font-size:11.5px;color:#C7CEE0;margin-top:4px;">${t.correo ? "Sin vehículo vinculado en Flotilla para este correo." : "Captura el correo del técnico (botón Editar perfil) para hacer match con Flotilla."}</div>`}
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
                        ${asignadas.length && opsPuedeGestionar() ? `<button onclick="opsAbrirModalRevision('${idInterno}')" style="background:#eef2f7;border:none;color:#1D2E73;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:5px;">${ICON.search} Registrar revisión</button>` : ""}
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
                    ${asignadas.length && opsPuedeGestionar() ? `<button onclick="opsAbrirModalRevision('${idInterno}')" class="mkt-add-btn" style="background:#1D2E73;display:inline-flex;align-items:center;gap:6px;">${ICON.search} Nueva revisión</button>` : ""}
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

                <div style="border-top:1px solid #e2e8f0;margin-top:20px;padding-top:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
                        <div style="font-size:12.5px;font-weight:700;color:#1e293b;">Calendario de rotación — quién está de guardia cada semana</div>
                        ${gestion ? `<button onclick="opsAbrirModalSugerirGuardias()" class="mkt-add-btn" style="background:#7c3aed;">${ICON.sparkle} Sugerir próximas semanas</button>` : ""}
                    </div>
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">Rota parejo entre los técnicos que elijas — a quien menos semanas lleva le toca primero, y se salta a quien tenga una ausencia programada esa semana. Puedes editar cualquier semana a mano.</div>
                    ${opsRenderCalendarioGuardias(gestion)}
                </div>
            </div>`;
    }

    function opsRenderCalendarioGuardias(gestion) {
        const hoyLunes = opsLunesDe(new Date());
        const proximas = cacheGuardiasProgramadas.filter(g => g.semanaInicio >= hoyLunes).slice(0, 16);
        if (!proximas.length) return `<div style="color:#94a3b8;font-size:12px;padding:8px 0;">Todavía no hay semanas programadas. Usa "Sugerir próximas semanas" para generarlas.</div>`;
        const tecnicosActivos = opsTecOperativos();
        return `<div style="display:flex;flex-direction:column;gap:0;">
            ${proximas.map(g => {
                const esEstaSemanaActual = g.semanaInicio === hoyLunes;
                const fechaFin = opsSumarDias(g.semanaInicio, 6);
                return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #eef1f5;font-size:12px;${esEstaSemanaActual ? "background:#fffbeb;" : ""}">
                    <div style="width:130px;flex-shrink:0;font-size:11px;color:#64748b;font-weight:600;">${opsEsc(opsFechaCorta(g.semanaInicio))} – ${opsEsc(opsFechaCorta(fechaFin))}${esEstaSemanaActual ? ` <span style="color:#b45309;font-weight:700;">· hoy</span>` : ""}</div>
                    <div style="flex:1;">
                        ${gestion ? `<select onchange="opsCambiarGuardiaProgramada('${g.id}', this.value)" style="border:1px solid #cbd5e1;border-radius:7px;padding:5px 8px;font-size:12px;">
                            ${tecnicosActivos.map(t => `<option value="${t.id}" ${t.id === g.tecnicoId ? "selected" : ""}>${opsEsc(t.nombre)}</option>`).join("")}
                        </select>` : `<strong>${opsEsc(opsNombreTecnico(g.tecnicoId))}</strong>`}
                        ${g.generadoPor === "sugerido" ? `<span style="font-size:10px;color:#94a3b8;margin-left:6px;">(sugerido)</span>` : ""}
                    </div>
                </div>`;
            }).join("")}
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
        const tecnicosActivos = opsTecOperativos();
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

    // ═══════════════════ Calendario de rotación de guardias ═══════════════════
    function opsLunesDe(fechaOStr) {
        const d = typeof fechaOStr === "string" ? new Date(fechaOStr + "T12:00:00") : new Date(fechaOStr);
        const dia = d.getDay(); // 0=domingo..6=sábado
        const diff = dia === 0 ? -6 : 1 - dia; // retrocede hasta el lunes
        d.setDate(d.getDate() + diff);
        return d.toISOString().slice(0, 10);
    }
    function opsSumarDias(fechaISO, n) {
        const d = new Date(fechaISO + "T12:00:00");
        d.setDate(d.getDate() + n);
        return d.toISOString().slice(0, 10);
    }
    function opsFechaCorta(fechaISO) {
        const d = new Date(fechaISO + "T12:00:00");
        return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    }
    function opsTecnicoAusenteEnSemana(tecnicoId, semanaInicio) {
        const semanaFin = opsSumarDias(semanaInicio, 6);
        return cacheAusencias.some(a => a.tecnicoId === tecnicoId && a.fechaInicio <= semanaFin && a.fechaFin >= semanaInicio);
    }

    window.opsAbrirModalSugerirGuardias = function () {
        const tecnicosActivos = opsTecOperativos();
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:440px;max-width:92vw;max-height:88vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:6px;">Sugerir próximas guardias</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:14px;">Rota entre los técnicos que marques abajo — el que menos guardias lleva hecha entra primero, y se salta automáticamente a quien tenga una ausencia esa semana.</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">¿Cuántas semanas quieres programar?</label>
                <input id="ops-in-guardias-semanas" type="number" min="1" max="52" value="12" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 14px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Técnicos elegibles para guardia</label>
                <div style="max-height:220px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin:4px 0 16px;">
                    ${tecnicosActivos.map(t => `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12.5px;color:#334155;cursor:pointer;">
                        <input type="checkbox" class="ops-guardia-elegible" value="${t.id}" checked style="width:14px;height:14px;"> ${opsEsc(t.nombre)}
                    </label>`).join("")}
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGenerarSugerenciaGuardias()" class="mkt-add-btn" style="background:#7c3aed;">Generar sugerencia</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGenerarSugerenciaGuardias = async function () {
        const numSemanas = Number(document.getElementById("ops-in-guardias-semanas").value) || 12;
        const elegiblesIds = Array.from(document.querySelectorAll(".ops-guardia-elegible:checked")).map(c => c.value);
        if (!elegiblesIds.length) { alert("Marca al menos un técnico elegible."); return; }

        // Cuenta cuántas veces ya le ha tocado a cada quien (histórico completo, no solo futuro)
        // para que la rotación sea justa desde ahora, no solo dentro de este lote.
        const conteo = {};
        elegiblesIds.forEach(id => conteo[id] = 0);
        cacheGuardiasProgramadas.forEach(g => { if (conteo[g.tecnicoId] !== undefined) conteo[g.tecnicoId]++; });

        const yaProgramadas = new Set(cacheGuardiasProgramadas.map(g => g.semanaInicio));
        let semana = opsLunesDe(new Date());
        // Si la semana actual ya está programada, arranca desde la siguiente libre.
        while (yaProgramadas.has(semana)) semana = opsSumarDias(semana, 7);

        const propuesta = [];
        for (let i = 0; i < numSemanas; i++) {
            const candidatos = elegiblesIds.filter(id => !opsTecnicoAusenteEnSemana(id, semana));
            if (!candidatos.length) { propuesta.push({ semanaInicio: semana, tecnicoId: null }); semana = opsSumarDias(semana, 7); continue; }
            candidatos.sort((a, b) => conteo[a] - conteo[b]);
            const elegido = candidatos[0];
            conteo[elegido]++;
            propuesta.push({ semanaInicio: semana, tecnicoId: elegido });
            semana = opsSumarDias(semana, 7);
        }

        const resumen = propuesta.map(p => `${opsFechaCorta(p.semanaInicio)}: ${p.tecnicoId ? opsNombreTecnico(p.tecnicoId) : "— nadie disponible esa semana —"}`).join("\n");
        if (!confirm(`Esto va a programar ${propuesta.length} semana(s):\n\n${resumen}\n\n¿Guardar?`)) return;

        try {
            const { db, fs } = await opsGetFB();
            for (const p of propuesta) {
                if (!p.tecnicoId) continue; // no se guarda una semana sin nadie disponible — Glen la llena a mano después
                await fs.addDoc(fs.collection(db, COL_GUARDIAS_PROGRAMADAS), {
                    semanaInicio: p.semanaInicio, tecnicoId: p.tecnicoId, generadoPor: "sugerido",
                    creadoPor: opsNombreActual(), creadoEn: opsFechaHora(),
                });
            }
            const snap = await fs.getDocs(fs.collection(db, COL_GUARDIAS_PROGRAMADAS));
            cacheGuardiasProgramadas = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.semanaInicio < b.semanaInicio ? -1 : 1);
            document.getElementById("ops-modal-wrap").innerHTML = "";
            opsRenderGuardias();
            if (window.mostrarPush) window.mostrarPush("Operaciones", "Guardias programadas.", "✅");
        } catch (e) {
            console.error("[opsGenerarSugerenciaGuardias]", e);
            alert("No se pudo guardar la sugerencia: " + e.message);
        }
    };

    window.opsCambiarGuardiaProgramada = async function (id, nuevoTecnicoId) {
        try {
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_GUARDIAS_PROGRAMADAS, id), { tecnicoId: nuevoTecnicoId, generadoPor: "manual" });
            const g = cacheGuardiasProgramadas.find(x => x.id === id);
            if (g) { g.tecnicoId = nuevoTecnicoId; g.generadoPor = "manual"; }
        } catch (e) {
            console.error("[opsCambiarGuardiaProgramada]", e);
            alert("No se pudo cambiar: " + e.message);
        }
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
                <button onclick="document.getElementById('${idFlot}').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;display:inline-flex;">${ICON.close}</button>
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
                <div style="font-size:11px;font-weight:700;color:${colorHex};text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:5px;">${ICON.bell} Operaciones</div>
                <button onclick="document.getElementById('${idFlot}').remove()" style="background:none;border:none;cursor:pointer;color:#94a3b8;display:inline-flex;">${ICON.close}</button>
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
            await window.tcNotificar2(fs, db, {
                tipo: "ops_folio_alerta",
                codigo: f.folioOS || f.estacion,
                para: paraEmail.toLowerCase(),
                mensaje: `Folio ${f.folioOS ? "O.S. " + f.folioOS + " — " : ""}${f.estacion}: ${info.estado}${info.enAtencion ? " (fecha de atención / compromiso)" : ""}. ${info.diasTexto}.`,
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
            if (f.source === OPS_DEMO_SOURCE) continue; // los folios DEMO del Calendario nunca hacen sonar alarmas
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
        opsVigilarEvidenciasFolios();
        if (opsFoliosVigilanciaTimer) clearInterval(opsFoliosVigilanciaTimer);
        opsFoliosVigilanciaTimer = setInterval(() => { opsVigilarFoliosSeveridad(); opsVigilarEvidenciasFolios(); }, 60000); // recheck cada minuto (el reloj avanza aunque no cambien datos)
    }
    function opsDetenerVigilanciaFolios() {
        if (opsFoliosVigilanciaTimer) { clearInterval(opsFoliosVigilanciaTimer); opsFoliosVigilanciaTimer = null; }
        opsFoliosVigilanciaBase = false;
        opsFoliosAlertaState.clear();
        opsFoliosEvidenciaAlertados.clear();
    }

    // ── Alerta de acta administrativa: 3 días sin evidencia (comentario) en un
    // folio que sigue abierto. Se avisa UNA sola vez por folio por sesión (no cada
    // minuto) — igual de "imposible de ignorar" que la alarma de SLA, pero sin
    // sonido repetido para no confundir las dos alarmas entre sí. ──
    let opsFoliosEvidenciaAlertados = new Set();
    function opsVigilarEvidenciasFolios() {
        const ahora = Date.now();
        for (const f of cacheFolios) {
            if (f.fechaSolucion) continue; // folio cerrado, no aplica
            if (f.source === OPS_DEMO_SOURCE) continue; // DEMO: sin avisos de acta administrativa
            const base = f.ultimaEvidenciaEn || f.creadoEn || f.fechaSolicitud;
            if (!base) continue;
            const dias = (ahora - new Date(base).getTime()) / 86400000;
            if (dias >= OPS_DIAS_ALERTA_EVIDENCIA && !opsFoliosEvidenciaAlertados.has(f.id)) {
                opsFoliosEvidenciaAlertados.add(f.id);
                if (opsFoliosVigilanciaBase) { // no avalancha al cargar folios viejos por primera vez
                    opsMostrarFlotanteGenerica(`Folio ${f.folioOS ? "O.S. " + f.folioOS + " — " : ""}${f.estacion}: ${Math.floor(dias)} días sin evidencia. Se sugiere acta administrativa.`, "#E7402B");
                }
            }
        }
    }

    function opsRenderFolios() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        const gestion = opsPuedeHacer("gestionar_herramientas");

        const calcTodos = cacheFolios.map(f => ({ f, info: opsCalcularSemaforoFolio(f) }));
        const numInspeccion = calcTodos.filter(x => x.f.tipoFolio === "inspeccion").length;
        const numServicio = calcTodos.length - numInspeccion;
        const calc = calcTodos.filter(x => filtroFolioTipo === "inspeccion" ? x.f.tipoFolio === "inspeccion" : x.f.tipoFolio !== "inspeccion");
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
            <div style="display:flex;gap:4px;background:#f1f5f9;padding:3px;border-radius:10px;width:fit-content;margin-bottom:14px;">
                ${[["servicio", `Folios de servicio (${numServicio})`], ["inspeccion", `Visitas de inspección (${numInspeccion})`]].map(([val, label]) => {
                    const on = filtroFolioTipo === val;
                    return `<button onclick="opsFiltrarFolioTipo('${val}')" style="border:none;background:${on ? "#1D2E73" : "transparent"};color:${on ? "#fff" : "#475569"};padding:8px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;">${label}</button>`;
                }).join("")}
            </div>
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
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button onclick="opsAbrirModalFolio()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo folio</button>
                        <button onclick="document.getElementById('ops-folios-import-input').click()" class="mkt-add-btn" style="background:#15803D;display:inline-flex;align-items:center;gap:6px;">${ICON.download} Importar Excel</button>
                        <input type="file" id="ops-folios-import-input" accept=".xlsx,.xls" style="display:none" onchange="opsImportarExcelFolios(this.files[0])">
                        <button onclick="opsExportarFoliosPDF()" title="Tabla de seguimiento en PDF, para imprimir o revisar rápido" style="background:#eef2f7;border:none;color:#1f2937;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.printer} PDF seguimiento</button>
                        <button onclick="opsExportarFoliosExcel()" title="Todos los campos de todos los folios, sin excepción" style="background:#eef2f7;border:none;color:#1f2937;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.file} Excel completo</button>
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
    window.opsFiltrarFolioTipo = function (v) { filtroFolioTipo = v || "servicio"; opsRenderFolios(); };

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
    // ═══════════════════════ TAB: CALENDARIO — Fase A (línea de tiempo) ═══════════════════════
    let opsCalVista = "semana"; // dia | semana | mes — por default abre en semana (Glen, sep-2026)
    let opsCalFecha = new Date(); opsCalFecha.setHours(0, 0, 0, 0);
    let opsCalFiltroTexto = "";
    let opsCalFiltroTipo = "todos"; // todos | servicio | inspeccion — para separar las visitas de inspección del resto en el Calendario
    const OPS_CAL_HORA_INICIO = 6, OPS_CAL_HORA_FIN = 20; // ventana visible del día (6:00–20:00)

    function opsCalFechaISO(d) { const p = x => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
    function opsCalSumarDias(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
    function opsCalInicioSemana(d) { const r = new Date(d); const dia = r.getDay(); const offset = dia === 0 ? -6 : 1 - dia; return opsCalSumarDias(r, offset); }

    // {fecha, horaDecimal, traslado, ejecucion} a partir de fechaProgramada — o null si no tiene.
    function opsCalDatosFolio(f) {
        if (!f.fechaProgramada) return null;
        const [fecha, hora] = f.fechaProgramada.split("T");
        const [hh, mm] = (hora || "00:00").split(":").map(Number);
        // ejecución en 0 (no 1) cuando no se capturó: un folio sin duración real no debe
        // "inventarse" una hora completa y aparentar choque contra otro folio del mismo
        // técnico ese día — pasa mucho con las visitas de inspección importadas, que traen
        // fecha pero no hora de ejecución capturada.
        return { fecha, horaDecimal: hh + (mm || 0) / 60, traslado: f.tiempoTrasladoHrs || 0, ejecucion: f.tiempoEjecucionHrs || 0 };
    }

    // Filtros adicionales del Calendario (rediseño sep-2026) — todos trabajan sobre campos que ya existen en el folio.
    let opsCalFiltroTecnico = "";        // id de ops_tecnicos ("" = todos)
    let opsCalFiltroCliente = "";        // clienteNombre exacto ("" = todos)
    let opsCalFiltroOrigen = "todos";    // todos | jomar | tecnocontrol
    let opsCalFiltroCategoria = "todas"; // todas | jomar | servicio | visita | seguimiento | vencido | facturar
    let opsCalFiltroEstado = "todos";    // todos | abierto | atencion | cerrado (mismo criterio que el panel de detalle)

    // Folios visibles según los filtros del Calendario. Es la ÚNICA función que aplica filtros de folio:
    // las tarjetas de arriba, la detección de choques y las tres vistas la comparten.
    function opsCalFoliosFiltrados() {
        let l = cacheFolios;
        if (opsCalFiltroTipo === "inspeccion") l = l.filter(f => f.tipoFolio === "inspeccion");
        else if (opsCalFiltroTipo === "laboratorio") l = l.filter(f => f.tipoFolio === "laboratorio");
        else if (opsCalFiltroTipo === "servicio") l = l.filter(f => f.tipoFolio !== "inspeccion");
        if (opsCalFiltroCliente) l = l.filter(f => (f.clienteNombre || "") === opsCalFiltroCliente);
        if (opsCalFiltroOrigen === "jomar") l = l.filter(f => opsEsFolioJomar(f));
        else if (opsCalFiltroOrigen === "tecnocontrol") l = l.filter(f => !opsEsFolioJomar(f));
        if (opsCalFiltroEstado === "cerrado") l = l.filter(f => !!f.fechaSolucion);
        else if (opsCalFiltroEstado === "atencion") l = l.filter(f => !f.fechaSolucion && !!f.fechaAtencion);
        else if (opsCalFiltroEstado === "abierto") l = l.filter(f => !f.fechaSolucion && !f.fechaAtencion);
        if (opsCalFiltroCategoria !== "todas") l = l.filter(f => opsCalCoincideCategoria(f, opsCalFiltroCategoria));
        return l;
    }

    // Cuenta choques reales: mismo técnico con dos folios cuyo horario se traslapa el mismo día.
    function opsCalDetectarChoques() {
        const porTecnicoDia = new Map();
        let choques = 0;
        opsCalFoliosFiltrados().forEach(f => {
            const d = opsCalDatosFolio(f);
            if (!d) return;
            const inicio = d.horaDecimal, fin = inicio + d.traslado + d.ejecucion;
            (f.tecnicosAsignadosIds || []).forEach(tecId => {
                const key = tecId + "|" + d.fecha;
                if (!porTecnicoDia.has(key)) porTecnicoDia.set(key, []);
                const lista = porTecnicoDia.get(key);
                if (lista.some(o => inicio < o.fin && fin > o.inicio)) choques++;
                lista.push({ inicio, fin });
            });
        });
        return choques;
    }

    function opsCalTecnicoDisponible(tecnicoId, fechaISO) {
        return !cacheAusencias.some(a => a.tecnicoId === tecnicoId && a.fechaInicio <= fechaISO && a.fechaFin >= fechaISO);
    }

    let opsCalFull = false;
    let opsCalVerLeyenda = (() => { try { return localStorage.getItem("ops_cal_leyenda") === "1"; } catch (e) { return false; } })();
    window.opsCalToggleLeyenda = function () {
        opsCalVerLeyenda = !opsCalVerLeyenda;
        try { localStorage.setItem("ops_cal_leyenda", opsCalVerLeyenda ? "1" : "0"); } catch (e) {}
        opsRenderCalendario();
    };
    window.opsCalTogglePantallaCompleta = function (forzar) {
        const nuevo = typeof forzar === "boolean" ? forzar : !opsCalFull;
        if (nuevo === opsCalFull) return;
        opsCalFull = nuevo;
        try {
            if (nuevo && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
            else if (!nuevo && document.fullscreenElement) document.exitFullscreen().catch(() => {});
        } catch (e) {}
        opsRenderCalendario();
    };
    if (!window.__opsCalFullListeners) {
        window.__opsCalFullListeners = true;
        document.addEventListener("keydown", e => {
            if (e.key !== "Escape" || !opsCalFull) return;
            const modal = document.getElementById("ops-modal-wrap"), panel = document.getElementById("ops-panel-wrap");
            if ((modal && modal.innerHTML.trim()) || (panel && panel.innerHTML.trim())) return; // Esc primero cierra lo que esté abierto encima
            window.opsCalTogglePantallaCompleta(false);
        });
        document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && opsCalFull) window.opsCalTogglePantallaCompleta(false); });
    }
    // Alto disponible para la rejilla: se adapta a la pantalla (laptop chica o monitor grande).
    function opsCalAltoScroll() {
        return opsCalFull ? "calc(100vh - 128px)" : "max(340px, calc(100vh - 300px))";
    }
    const OPS_CAL_ANCHO_TEC = 172; // columna fija de técnico en Día y Semana

    function opsRenderCalendario() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;

        const hoyISO = opsCalFechaISO(new Date());
        const inicioSemana = opsCalInicioSemana(new Date());
        const finSemana = opsCalSumarDias(inicioSemana, 6);
        const foliosVista = opsCalFoliosFiltrados();
        const enEjecucionHoy = foliosVista.filter(f => opsCalDatosFolio(f)?.fecha === hoyISO).length;
        const programadosSemana = foliosVista.filter(f => { const d = opsCalDatosFolio(f); if (!d) return false; const fd = new Date(d.fecha + "T00:00:00"); return fd >= inicioSemana && fd <= finSemana; }).length;
        const sinFecha = foliosVista.filter(f => !f.fechaProgramada && !f.fechaSolucion);
        const atrasados = foliosVista.filter(f => ["naranja", "rojo"].includes(opsCalcularSemaforoFolio(f).semaforo)).length;
        const tecActivos = opsTecOperativos();
        const disponiblesHoy = tecActivos.filter(t => opsCalTecnicoDisponible(t.id, hoyISO)).length;
        const choques = opsCalDetectarChoques();

        const ICONOS_TARJETA = {
            play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
            calendario: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
            reloj: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            alerta: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            equipo: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            choque: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-2 2.5h3L12 7"/><path d="M6.5 12 3 15l3.5 3"/><path d="M17.5 12 21 15l-3.5 3"/><path d="M9 12h6"/></svg>',
        };
        function tarjeta(valor, label, color, icono) {
            const oscuro = opsTonoOscuro(color);
            return `<div style="background:${opsPastel(color)};border:1px solid ${opsMezclaColor(color, "#ffffff", 0.55)};border-radius:12px;padding:8px 12px;display:flex;align-items:center;gap:10px;min-width:0;">
                <div style="width:30px;height:30px;border-radius:8px;background:#ffffffcc;color:${oscuro};display:flex;align-items:center;justify-content:center;flex-shrink:0;">${icono}</div>
                <div style="min-width:0;">
                    <div style="font-size:18px;font-weight:800;color:${oscuro};letter-spacing:-.2px;line-height:1.05;">${valor}</div>
                    <div style="font-size:9.5px;color:${oscuro};opacity:.8;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${label}</div>
                </div>
            </div>`;
        }

        const btnIcono = (onclick, titulo, svg, activo) => `<button onclick="${onclick}" title="${titulo}" style="background:${activo ? "#E9ECF5" : "#f8fafc"};border:1px solid ${activo ? "#1D2E73" : "#e2e8f0"};color:${activo ? "#1D2E73" : "#475569"};width:34px;height:34px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${svg}</button>`;
        const svgOjo = opsCalVerLeyenda
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="m1 1 22 22"/></svg>';
        const svgFull = opsCalFull
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>';

        el.innerHTML = `
          <div id="ops-cal-root" style="${opsCalFull ? "position:fixed;inset:0;z-index:9000;background:#f4f6f9;padding:12px 16px;overflow:auto;box-sizing:border-box;" : ""}">
            ${opsCalFull ? "" : `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-bottom:10px;">
                ${tarjeta(enEjecucionHoy, "En ejecución hoy", "#579bfc", ICONOS_TARJETA.play)}
                ${tarjeta(programadosSemana, "Programados esta semana", "#a25ddc", ICONOS_TARJETA.calendario)}
                ${tarjeta(sinFecha.length, "Sin fecha programada", "#fdab3d", ICONOS_TARJETA.reloj)}
                ${tarjeta(atrasados, "Atrasados / por vencer", "#e2445c", ICONOS_TARJETA.alerta)}
                ${tarjeta(disponiblesHoy + "/" + tecActivos.length, "Técnicos disponibles hoy", "#00c875", ICONOS_TARJETA.equipo)}
                ${tarjeta(choques, "Choques detectados", choques ? "#e2445c" : "#4eccc6", ICONOS_TARJETA.choque)}
            </div>`}

            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;background:#fff;border-radius:12px;padding:7px 10px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 2px 8px rgba(15,23,42,.04);">
                <div style="display:flex;gap:4px;background:#f1f5f9;padding:3px;border-radius:10px;">
                    ${["dia:Día", "semana:Semana", "mes:Mes"].map(v => { const [id, label] = v.split(":"); const on = opsCalVista === id;
                        return `<button onclick="opsCalCambiarVista('${id}')" style="border:none;background:${on ? "#1D2E73" : "transparent"};color:${on ? "#fff" : "#475569"};padding:7px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:background .15s;box-shadow:${on ? "0 1px 3px rgba(29,46,115,.3)" : "none"};">${label}</button>`;
                    }).join("")}
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <button onclick="opsCalMover(-1)" style="background:#f8fafc;border:1px solid #e2e8f0;width:30px;height:30px;border-radius:8px;cursor:pointer;color:#475569;">‹</button>
                    <div style="font-size:12.5px;font-weight:700;color:#1e293b;min-width:180px;text-align:center;text-transform:capitalize;">${opsCalEtiquetaFecha()}</div>
                    <button onclick="opsCalMover(1)" style="background:#f8fafc;border:1px solid #e2e8f0;width:30px;height:30px;border-radius:8px;cursor:pointer;color:#475569;">›</button>
                    <button onclick="opsCalHoy()" style="background:#eef2f7;border:1px solid #dbe3f0;color:#1D2E73;padding:6px 13px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:700;margin-left:4px;">Hoy</button>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                    <select onchange="opsCalFiltrarTipo(this.value)" style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:8px 10px;font-size:12px;font-weight:600;color:#334155;">
                        <option value="todos" ${opsCalFiltroTipo === "todos" ? "selected" : ""}>Todo</option>
                        <option value="servicio" ${opsCalFiltroTipo === "servicio" ? "selected" : ""}>Solo servicio</option>
                        <option value="inspeccion" ${opsCalFiltroTipo === "inspeccion" ? "selected" : ""}>Solo inspección</option>
                        <option value="laboratorio" ${opsCalFiltroTipo === "laboratorio" ? "selected" : ""}>Solo laboratorio</option>
                    </select>
                    <input id="ops-cal-filtro" value="${opsEsc(opsCalFiltroTexto)}" oninput="opsCalFiltrar(this.value)" placeholder="Buscar técnico..." style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:8px 12px;font-size:12.5px;min-width:170px;">
                    ${opsPuedeGestionar() ? `<button onclick="opsAbrirModalFolio(null, '${opsCalFechaISO(opsCalFecha)}')" style="background:#1D2E73;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(29,46,115,.25);">+ Nuevo servicio</button>` : ""}
                    ${btnIcono("opsCalToggleLeyenda()", opsCalVerLeyenda ? "Ocultar tipificaciones" : "Ver tipificaciones (colores)", svgOjo, opsCalVerLeyenda)}
                    ${btnIcono("opsCalTogglePantallaCompleta()", opsCalFull ? "Salir de pantalla completa (Esc)" : "Ver calendario en pantalla completa", svgFull, opsCalFull)}
                    ${opsPuedeGestionar() ? `<button onclick="opsAbrirModalVisitaInspeccion()" style="background:#0e7490;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(14,116,144,.25);">+ Visita de inspección</button>` : ""}
                </div>
            </div>

            ${opsCalHTMLFiltros()}
            ${opsCalVerLeyenda ? opsCalHTMLLeyenda() : ""}
            <div id="ops-cal-body"></div>
          ${opsCalFull ? "</div>" : ""}

            ${sinFecha.length && !opsCalFull ? `
            <div style="margin-top:12px;background:#fff;border-radius:14px;padding:16px;box-shadow:0 1px 2px rgba(15,23,42,.04),0 4px 14px rgba(15,23,42,.06);border-top:3px solid #b45309;">
                <div style="font-size:11px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;">Sin fecha programada (${sinFecha.length})${opsCalVista === "dia" ? " — arrástralos a la fila de un técnico" : ""}</div>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                    ${sinFecha.map(f => `
                        <div onclick="${opsPuedeGestionar() ? `opsAbrirModalFolio('${f.id}')` : `opsAbrirPanelFolio('${f.id}')`}" ${opsPuedeGestionar() ? `draggable="true" ondragstart="opsCalArrastrarFolio(event,'${f.id}')"` : ""} style="padding:9px 13px;background:#fffbeb;border:1px solid #fde8c8;border-radius:10px;cursor:${opsPuedeGestionar() && opsCalVista === "dia" ? "grab" : "pointer"};font-size:11.5px;color:#334155;font-weight:600;transition:box-shadow .12s;">
                            ${opsEsc(f.estacion)}${f.folioOS ? " · O.S. " + opsEsc(f.folioOS) : ""}${opsPuedeGestionar() ? ` — <span style="color:#b45309;font-weight:500;">${opsCalVista === "dia" ? "arrastra o da clic" : "clic para programar"}</span>` : ""}
                        </div>`).join("")}
                </div>
            </div>` : ""}
          ${opsCalFull ? "" : "</div>"}
        `;
        opsCalRenderBody();
    }

    window.opsCalCambiarVista = function (v) { opsCalVista = v; opsRenderCalendario(); };
    window.opsCalMover = function (dir) {
        const dias = opsCalVista === "dia" ? 1 : opsCalVista === "semana" ? 7 : 30;
        opsCalFecha = opsCalSumarDias(opsCalFecha, dir * dias);
        opsRenderCalendario();
    };
    window.opsCalHoy = function () { opsCalFecha = new Date(); opsCalFecha.setHours(0, 0, 0, 0); opsRenderCalendario(); };
    window.opsCalFiltrar = function (v) { opsCalFiltroTexto = v; opsCalRenderBody(); };
    window.opsCalFiltrarTipo = function (v) { opsCalFiltroTipo = v || "todos"; opsRenderCalendario(); };
    window.opsCalSetFiltro = function (clave, valor) {
        if (clave === "tecnico") opsCalFiltroTecnico = valor || "";
        else if (clave === "cliente") opsCalFiltroCliente = valor || "";
        else if (clave === "origen") opsCalFiltroOrigen = valor || "todos";
        else if (clave === "estado") opsCalFiltroEstado = valor || "todos";
        else if (clave === "categoria") opsCalFiltroCategoria = valor || "todas";
        else if (clave === "todos") { opsCalFiltroTecnico = ""; opsCalFiltroCliente = ""; opsCalFiltroOrigen = "todos"; opsCalFiltroEstado = "todos"; opsCalFiltroCategoria = "todas"; opsCalFiltroTipo = "todos"; opsCalFiltroTexto = ""; }
        opsRenderCalendario();
    };
    window.opsCalToggleCategoria = function (cat) { opsCalSetFiltro("categoria", opsCalFiltroCategoria === cat ? "todas" : cat); };
    window.opsCalIrAFecha = function (fechaISO) { if (!fechaISO) return; opsCalFecha = new Date(fechaISO + "T00:00:00"); opsRenderCalendario(); };
    window.opsCalIrADia = function (fechaISO) { opsCalFecha = new Date(fechaISO + "T00:00:00"); opsCalVista = "dia"; opsRenderCalendario(); };

    function opsCalEtiquetaFecha() {
        if (opsCalVista === "dia") return opsCalFecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
        if (opsCalVista === "semana") { const ini = opsCalInicioSemana(opsCalFecha), fin = opsCalSumarDias(ini, 6);
            return `${ini.toLocaleDateString("es-MX", { day: "numeric", month: "short" })} – ${fin.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`; }
        return opsCalFecha.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
    }

    function opsCalTecnicosFiltrados() {
        let activos = opsTecOperativos();
        if (opsCalFiltroTecnico) activos = activos.filter(t => t.id === opsCalFiltroTecnico);
        if (!opsCalFiltroTexto.trim()) return activos;
        const q = opsCalFiltroTexto.toLowerCase();
        return activos.filter(t => (t.nombre || "").toLowerCase().includes(q) || (t.puesto || "").toLowerCase().includes(q));
    }

    function opsCalRenderBody() {
        const cont = document.getElementById("ops-cal-body");
        if (!cont) return;
        if (opsCalVista === "dia") cont.innerHTML = opsCalRenderDia();
        else if (opsCalVista === "semana") cont.innerHTML = opsCalRenderSemana();
        else cont.innerHTML = opsCalRenderMes();
    }

    // ═══════════ Piezas compartidas del rediseño del Calendario ═══════════
    const OPS_CAL_PX_HORA = 50;      // ancho mínimo de una hora en la vista Día (en pantallas chicas se desplaza de lado)
    const OPS_CAL_MIN_HORAS = 2.0;   // ancho visual mínimo de una tarjeta (para que el texto sea legible aunque dure poco)
    const OPS_CAL_ALTO_CARRIL = 50;  // alto de cada "carril" de tarjetas dentro de la fila de un técnico

    function opsCalFmtHora(dec) {
        let h = Math.floor(dec), m = Math.round((dec - h) * 60);
        if (m === 60) { h += 1; m = 0; }
        return `${h}:${String(m).padStart(2, "0")}`;
    }
    // Etiqueta corta del estado (el estado completo sigue en el panel de detalle).
    function opsCalEstadoCorto(f, info) {
        if (opsFolioListoFacturar(f)) return "Por facturar";
        return ({ "SOLUCIONADO": "Cerrado", "VENCIDO": "Vencido", "URGENTE": "Urgente", "PRÓXIMO A VENCER": "Por vencer",
                  "EN ATENCIÓN": "En atención", "EN PLAZO": "En plazo", "SIN FECHA": "Programado", "REVISAR DATOS": "Revisar datos" })[info.estado] || info.estado;
    }
    // Tipo de atención/servicio en texto corto.
    function opsCalTipoTexto(f) {
        if (f.tipoFolio === "inspeccion") return f.normaInspeccion ? "Inspección " + f.normaInspeccion : "Visita de inspección";
        if (f.tipoFolio === "laboratorio") return "Laboratorio";
        const receta = f.servicioCatalogoId ? cacheServiciosCatalogo.find(x => x.id === f.servicioCatalogoId) : null;
        return (receta && receta.nombre) || f.tipoServicioDemo || "Servicio técnico";
    }
    function opsCalEstilosUnaVez() {
        return `<style>
            .ops-cal-card{transition:box-shadow .15s,transform .15s;}
            .ops-cal-card:hover{box-shadow:0 6px 16px rgba(15,23,42,.16)!important;transform:translateY(-1px);z-index:6!important;}
            .ops-cal-chip{transition:box-shadow .12s;}
            .ops-cal-chip:hover{box-shadow:0 3px 8px rgba(15,23,42,.14);}
            .ops-cal-scroll::-webkit-scrollbar{height:9px;width:9px;} .ops-cal-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px;}
        </style>`;
    }
    // Celda izquierda con la foto y datos del técnico (compartida por las vistas Día y Semana).
    function opsCalCeldaTecnico(t, guardia) {
        return `<div onclick="opsAbrirFichaTecnico('${t.id}')" title="Abrir perfil de ${opsEsc(t.nombre)}" style="width:${OPS_CAL_ANCHO_TEC}px;min-width:${OPS_CAL_ANCHO_TEC}px;flex-shrink:0;position:sticky;left:0;z-index:4;background:#fff;padding:5px 10px;display:flex;align-items:center;gap:8px;cursor:pointer;border-right:1px solid #e8edf3;box-sizing:border-box;">
            ${opsTecAvatarHTML(t, 28)}
            <div style="min-width:0;flex:1;">
                <div style="font-size:11.5px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opsEsc(t.nombre)}</div>
                <div style="font-size:10.5px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">${opsEsc(t.puesto || "Sin puesto")}</div>
                <div style="display:flex;gap:4px;margin-top:3px;align-items:center;flex-wrap:nowrap;overflow:hidden;">${opsTecBadgeTipo(t)}${guardia ? `<span title="En guardia" style="display:inline-flex;align-items:center;background:#f3e8ff;color:#6b21a8;font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:999px;white-space:nowrap;">Guardia</span>` : ""}</div>
            </div>
        </div>`;
    }
    function opsCalMiniAvatares(f) {
        const ids = f.tecnicosAsignadosIds || [];
        const tecs = ids.map(id => cacheTec.find(t => t.id === id)).filter(Boolean);
        if (!tecs.length) return "";
        const vis = tecs.slice(0, 3);
        return `<span title="${opsEsc(tecs.map(t => t.nombre).join(", "))}" style="display:inline-flex;align-items:center;flex-shrink:0;margin-left:auto;padding-left:6px;">
            ${vis.map((t, i) => `<span style="display:inline-flex;margin-left:${i ? -6 : 0}px;">${opsTecAvatarHTML(t, 17)}</span>`).join("")}
            ${tecs.length > 3 ? `<span style="font-size:9px;font-weight:700;color:#64748b;margin-left:3px;">+${tecs.length - 3}</span>` : ""}
        </span>`;
    }

    // ── Filtros (fila debajo de la barra principal) ──
    function opsCalHTMLFiltros() {
        const est = "border:1px solid #e2e8f0;background:#fff;border-radius:8px;padding:7px 9px;font-size:11.5px;font-weight:600;color:#334155;max-width:190px;box-shadow:0 1px 2px rgba(15,23,42,.04);";
        const sel = (clave, valor, opciones) => `<select onchange="opsCalSetFiltro('${clave}', this.value)" style="${est}${valor && valor !== "todos" && valor !== "todas" ? "border-color:#1D2E73;color:#1D2E73;" : ""}">${opciones.map(([v, l]) => `<option value="${opsEsc(v)}" ${String(v) === String(valor) ? "selected" : ""}>${opsEsc(l)}</option>`).join("")}</select>`;
        const tecs = opsTecOperativos().sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
        const clientes = [...new Set(cacheFolios.map(f => f.clienteNombre).filter(Boolean))].sort((a, b) => a.localeCompare(b));
        const hayFiltros = opsCalFiltroTecnico || opsCalFiltroCliente || opsCalFiltroOrigen !== "todos" || opsCalFiltroEstado !== "todos" || opsCalFiltroCategoria !== "todas" || opsCalFiltroTipo !== "todos" || opsCalFiltroTexto;
        return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:-4px 0 12px;">
            <span style="font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-right:2px;">Filtrar</span>
            ${sel("tecnico", opsCalFiltroTecnico, [["", "Todos los técnicos"], ...tecs.map(t => [t.id, t.nombre])])}
            ${sel("cliente", opsCalFiltroCliente, [["", "Todos los clientes"], ...clientes.map(c => [c, c])])}
            ${sel("origen", opsCalFiltroOrigen, [["todos", "JOMAR y Tecnocontrol"], ["jomar", "Solo JOMAR"], ["tecnocontrol", "Solo Tecnocontrol"]])}
            ${sel("categoria", opsCalFiltroCategoria, [["todas", "Todas las categorías"], ["vencido", "Vencidos / críticos"], ["seguimiento", "Seguimiento"], ["facturar", "Listos para facturar"], ["visita", "Visitas / atenciones"], ["jomar", "JOMAR"], ["servicio", "Servicio Tecnocontrol"]])}
            ${sel("estado", opsCalFiltroEstado, [["todos", "Cualquier estado"], ["abierto", "Abierto"], ["atencion", "En atención"], ["cerrado", "Cerrado"]])}
            <input type="date" value="${opsCalFechaISO(opsCalFecha)}" onchange="opsCalIrAFecha(this.value)" title="Ir a una fecha" style="${est}">
            ${hayFiltros ? `<button onclick="opsCalSetFiltro('todos')" style="background:none;border:none;color:#E7402B;font-size:11.5px;font-weight:700;cursor:pointer;padding:6px 8px;">Limpiar filtros</button>` : ""}
        </div>`;
    }

    // ── Leyenda discreta (los chips también sirven para filtrar con un clic) ──
    function opsCalHTMLLeyenda() {
        const chip = (k, nombre, color, fondo, trazo, punteado, pastel) => {
            const on = opsCalFiltroCategoria === k;
            const muestra = trazo
                ? `<span style="width:12px;height:10px;border-radius:2px;background:#e2e8f0;box-shadow:inset 4px 0 0 ${color};${punteado ? "outline:1.5px dashed " + color + ";outline-offset:1px;" : ""}"></span>`
                : `<span style="width:12px;height:10px;border-radius:3px;background:${pastel || color};border:1.5px solid ${color};box-sizing:border-box;"></span>`;
            return `<button data-k="${opsEsc(k)}" onclick="opsCalToggleCategoria(this.dataset.k)" title="Clic para ver solo esta categoría" style="display:inline-flex;align-items:center;gap:6px;background:${on ? fondo : "#fff"};border:1px solid ${on ? color : "#e2e8f0"};color:${on ? color : "#475569"};padding:4px 10px;border-radius:999px;font-size:10.5px;font-weight:600;cursor:pointer;">${muestra}${opsEsc(nombre)}</button>`;
        };
        const vistos = new Map();
        cacheFolios.forEach(f => { const c = opsCalServicioFolio(f); if (!vistos.has(c.clave)) vistos.set(c.clave, c); });
        const orden = (a, b) => a.nombre.localeCompare(b.nombre, "es");
        const tecno = [...vistos.values()].filter(c => c.empresa !== "jomar").sort(orden);
        const jomar = [...vistos.values()].filter(c => c.empresa === "jomar").sort(orden);
        const fila = (titulo, html) => html ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;"><span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;min-width:150px;">${titulo}</span>${html}</div>` : "";
        return `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px;background:#fff;border-radius:12px;padding:10px 12px;">
            ${fila("Tecnocontrol · servicios", tecno.map(c => chip(c.clave, c.nombre, c.color, c.fondo, false, false, c.fondo)).join(""))}
            ${fila("JOMAR Verificaciones · visitas", jomar.map(c => chip(c.clave, c.nombre, c.color, c.fondo, false, false, c.fondo)).join(""))}
            ${fila("Estatus (franja izquierda)", OPS_CAL_ORDEN_ESTATUS.map(k => { const e = OPS_CAL_ESTATUS[k]; return chip("est:" + k, e.nombre, e.color, e.color + "14", true, e.punteado); }).join(""))}
        </div>`;
    }

    // Leyenda de símbolos (pie de la vista Día)
    function opsCalHTMLSimbolos() {
        if (!opsCalVerLeyenda) return "";
        return `<div style="display:flex;gap:16px;margin-top:10px;padding:9px 14px;background:#fff;border-radius:10px;box-shadow:0 1px 2px rgba(15,23,42,.04);font-size:10.5px;color:#64748b;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:5px;"><span style="width:16px;height:5px;border-radius:3px;background:repeating-linear-gradient(45deg,#94a3b8,#94a3b8 3px,#cbd5e1 3px,#cbd5e1 6px);display:inline-block;"></span> Traslado (franja inferior de la tarjeta)</div>
            <div style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:12px;border-radius:3px;background:repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 4px,#f1f5f9 4px,#f1f5f9 8px);display:inline-block;"></span> Ausente</div>
            <div style="display:flex;align-items:center;gap:5px;"><span style="width:12px;height:2px;background:#E7402B;display:inline-block;"></span> Hora actual</div>
            <div style="display:flex;align-items:center;gap:5px;"><span style="width:14px;height:12px;border-radius:4px;border:2px solid #E7402B;display:inline-block;"></span> Choque de horario</div>
            <div style="display:flex;align-items:center;gap:5px;"><span style="color:#E7402B;display:inline-flex;">${ICON.alert}</span> Falta personal contra la receta</div>
            <div style="display:flex;align-items:center;gap:5px;"><span style="color:#94a3b8;">Arrastra una tarjeta a otra fila u hora para reprogramar</span></div>
        </div>`;
    }

    // ── Vista Día: línea de tiempo tipo planificación (Gantt) por técnico ──
    function opsCalRenderDia() {
        const fechaISO = opsCalFechaISO(opsCalFecha);
        const tecnicos = opsCalTecnicosFiltrados();
        const totalHrs = OPS_CAL_HORA_FIN - OPS_CAL_HORA_INICIO;
        const horas = Array.from({ length: totalHrs }, (_, i) => OPS_CAL_HORA_INICIO + i);
        const esHoy = fechaISO === opsCalFechaISO(new Date());
        const ahora = new Date();
        const ahoraPct = ((ahora.getHours() + ahora.getMinutes() / 60 - OPS_CAL_HORA_INICIO) / totalHrs) * 100;
        const anchoMin = totalHrs * OPS_CAL_PX_HORA;
        const foliosBase = opsCalFoliosFiltrados();
        const rejilla = `background-image:linear-gradient(to right,#eef1f6 1px,transparent 1px);background-size:${100 / totalHrs}% 100%;`;

        function filaDe(t) {
            const ausente = cacheAusencias.find(a => a.tecnicoId === t.id && a.fechaInicio <= fechaISO && a.fechaFin >= fechaISO);
            const guardia = cacheGuardias.find(g => g.tecnicoId === t.id && g.estado === "activa" && g.fechaInicio <= fechaISO && (!g.fechaFin || g.fechaFin >= fechaISO));
            const ocupados = foliosBase.filter(f => (f.tecnicosAsignadosIds || []).includes(t.id)).map(f => ({ f, d: opsCalDatosFolio(f) })).filter(o => o.d && o.d.fecha === fechaISO)
                .sort((a, b) => a.d.horaDecimal - b.d.horaDecimal);

            const choqueSet = new Set();
            ocupados.forEach((o, i) => ocupados.forEach((o2, j) => {
                if (i === j) return;
                const fin1 = o.d.horaDecimal + o.d.traslado + o.d.ejecucion, fin2 = o2.d.horaDecimal + o2.d.traslado + o2.d.ejecucion;
                if (o.d.horaDecimal < fin2 && fin1 > o2.d.horaDecimal) choqueSet.add(o.f.id);
            }));

            // Carriles: si dos tarjetas se encimarían visualmente, la segunda baja a otro carril (nunca se tapan).
            const finCarril = [];
            ocupados.forEach(o => {
                o.ini = Math.min(Math.max(o.d.horaDecimal, OPS_CAL_HORA_INICIO), OPS_CAL_HORA_FIN - 0.5);
                o.dur = Math.max(o.d.traslado + o.d.ejecucion, OPS_CAL_MIN_HORAS);
                let c = finCarril.findIndex(fin => fin <= o.ini + 0.001);
                if (c < 0) { c = finCarril.length; finCarril.push(0); }
                finCarril[c] = o.ini + o.dur; o.carril = c;
            });
            const alto = Math.max(1, finCarril.length) * OPS_CAL_ALTO_CARRIL + 6;

            let contenido = "";
            if (ausente) {
                contenido = `<div style="position:absolute;inset:4px 0;background:repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 6px,#f1f5f9 6px,#f1f5f9 12px);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#64748b;font-weight:700;">${opsEsc(ausente.tipo)}</div>`;
            } else {
                contenido = ocupados.map(({ f, d, ini, dur, carril }) => {
                    const cat = opsCalColorFolio(f);
                    const info = opsCalcularSemaforoFolio(f);
                    const receta = f.servicioCatalogoId ? cacheServiciosCatalogo.find(x => x.id === f.servicioCatalogoId) : null;
                    const rolesReq = receta ? (receta.personal || []).reduce((n, p) => n + (p.cantidad || 1), 0) : null;
                    const faltaGente = rolesReq !== null && (f.tecnicosAsignadosIds || []).length < rolesReq;
                    const anchoPct = Math.min((dur / totalHrs) * 100, 100);
                    const izqPct = Math.min(((ini - OPS_CAL_HORA_INICIO) / totalHrs) * 100, 100 - anchoPct);
                    const sinHora = !(f.fechaProgramada || "").includes("T");
                    const finDec = d.horaDecimal + d.traslado + d.ejecucion;
                    const horaTxt = sinHora ? "Sin hora" : (d.traslado + d.ejecucion > 0 ? `${opsCalFmtHora(d.horaDecimal)}–${opsCalFmtHora(finDec)}` : opsCalFmtHora(d.horaDecimal));
                    const propTraslado = d.traslado ? (d.traslado / ((d.traslado + d.ejecucion) || 1)) * 100 : 0;
                    const tip = `${f.estacion}${f.folioOS ? " · O.S. " + f.folioOS : ""}\n${f.clienteNombre || "Sin cliente"} · ${opsCalTipoTexto(f)}\n${horaTxt} · ${cat.nombre} · ${cat.estNombre} (${info.estado})${choqueSet.has(f.id) ? "\n⚠ Choque de horario" : ""}${faltaGente ? "\n⚠ Falta personal contra la receta" : ""}`;
                    return `<div class="ops-cal-card" ${opsPuedeGestionar() ? `draggable="true" ondragstart="opsCalArrastrarFolio(event,'${f.id}')"` : ""} onclick="opsAbrirPanelFolio('${f.id}')" title="${opsEsc(tip)}"
                        style="position:absolute;top:${carril * OPS_CAL_ALTO_CARRIL + 5}px;height:${OPS_CAL_ALTO_CARRIL - 6}px;left:${izqPct}%;width:calc(${anchoPct}% - 3px);box-sizing:border-box;background:${cat.fondo};border:none;border-radius:8px;${choqueSet.has(f.id) ? "outline:2px solid #E7402B;outline-offset:1px;" : (cat.punteado ? "outline:2px dashed " + cat.estColor + ";outline-offset:1px;" : "")}box-shadow:inset 6px 0 0 ${cat.estColor},inset 8px 0 0 #fff,inset 0 0 0 1px ${cat.borde},0 1px 2px rgba(15,23,42,.10);padding:3px 7px 5px 13px;overflow:hidden;cursor:pointer;z-index:2;display:flex;flex-direction:column;justify-content:space-between;">
                        <div style="display:flex;align-items:center;gap:5px;min-width:0;">
                            ${cat.empresa === "jomar" ? `<span title="JOMAR Verificaciones" style="font-size:8.5px;font-weight:800;color:${cat.color};background:#fff;padding:1px 4px;border-radius:4px;flex-shrink:0;">JOMAR</span>` : ""}
                            <span style="font-size:9px;font-weight:800;color:${cat.texto};background:${cat.texto === "#ffffff" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.08)"};padding:1px 5px;border-radius:5px;white-space:nowrap;flex-shrink:0;">${f.folioOS ? "O.S. " + opsEsc(f.folioOS) : "S/F"}</span>
                            <span style="font-size:11px;font-weight:700;color:${cat.texto};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opsEsc(f.estacion)}</span>
                            ${faltaGente ? `<span title="Falta personal contra la receta" style="margin-left:auto;color:#E7402B;background:#fff;border-radius:50%;width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">${ICON.alert}</span>` : ""}
                        </div>
                        <div style="font-size:10px;color:${cat.suave};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opsEsc(cat.nombre)} · ${opsEsc(f.clienteNombre || "Sin cliente")}</div>
                        <div style="display:flex;align-items:center;gap:6px;min-width:0;">
                            <span style="font-size:10px;font-weight:600;color:${cat.texto};white-space:nowrap;">${horaTxt}</span>
                            <span style="font-size:9px;font-weight:800;color:${cat.estColor};background:#fff;padding:0 6px;border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${opsEsc(opsCalEstadoCorto(f, info))}</span>
                            ${opsCalMiniAvatares(f)}
                        </div>
                        ${d.traslado ? `<div style="position:absolute;left:8px;right:0;bottom:0;height:3px;display:flex;"><div style="width:${propTraslado}%;background:repeating-linear-gradient(45deg,${cat.color}aa,${cat.color}aa 3px,${cat.color}33 3px,${cat.color}33 6px);"></div><div style="flex:1;"></div></div>` : ""}
                    </div>`;
                }).join("");
            }
            return { alto, contenido, guardia };
        }

        const filas = tecnicos.map(t => ({ t, ...filaDe(t) }));
        return `${opsCalEstilosUnaVez()}
        <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.04),0 4px 14px rgba(15,23,42,.06);">
          <div class="ops-cal-scroll" style="overflow:auto;max-height:${opsCalAltoScroll()};">
            <div style="min-width:${OPS_CAL_ANCHO_TEC + anchoMin}px;">
                <div style="display:flex;position:sticky;top:0;z-index:7;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                    <div style="width:${OPS_CAL_ANCHO_TEC}px;min-width:${OPS_CAL_ANCHO_TEC}px;flex-shrink:0;position:sticky;left:0;z-index:8;background:#f8fafc;padding:8px 10px;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-right:1px solid #e8edf3;box-sizing:border-box;">Técnico · Puesto</div>
                    <div style="flex:1;display:flex;position:relative;">
                        ${horas.map(h => `<div style="flex:1;font-size:10px;font-weight:700;color:#64748b;padding:8px 0 8px 5px;border-left:1px solid #e8edf3;">${h}:00</div>`).join("")}
                        ${esHoy && ahoraPct >= 0 && ahoraPct <= 100 ? `<div style="position:absolute;left:${ahoraPct}%;bottom:-1px;width:9px;height:9px;margin-left:-4px;border-radius:50%;background:#E7402B;"></div>` : ""}
                    </div>
                </div>
                ${filas.length ? filas.map(({ t, alto, contenido, guardia }) => `
                    <div style="display:flex;border-bottom:1px solid #eef1f6;min-height:${Math.max(alto, 50)}px;">
                        ${opsCalCeldaTecnico(t, guardia)}
                        <div ondragover="event.preventDefault();this.style.backgroundColor='#eef2f7';" ondragleave="this.style.backgroundColor='';" ondrop="opsCalSoltarFolio(event,'${t.id}')" style="flex:1;position:relative;height:${Math.max(alto, 50)}px;${rejilla}">
                            ${esHoy && ahoraPct >= 0 && ahoraPct <= 100 ? `<div style="position:absolute;top:0;bottom:0;left:${ahoraPct}%;width:2px;background:#E7402B;z-index:3;opacity:.85;pointer-events:none;"></div>` : ""}
                            ${contenido}
                        </div>
                    </div>`).join("") : `<div style="padding:40px;text-align:center;color:#94a3b8;">Ningún técnico coincide con los filtros.</div>`}
            </div>
          </div>
        </div>
        ${opsCalHTMLSimbolos()}`;
    }

    // ── Vista Semana: técnicos con foto y tarjetas compactas por día (clic en "+N" abre el día) ──
    function opsCalRenderSemana() {
        const inicio = opsCalInicioSemana(opsCalFecha);
        const dias = Array.from({ length: 7 }, (_, i) => opsCalSumarDias(inicio, i));
        const tecnicos = opsCalTecnicosFiltrados();
        const hoyISO = opsCalFechaISO(new Date());
        const foliosBase = opsCalFoliosFiltrados();
        const cols = `${OPS_CAL_ANCHO_TEC}px repeat(7,minmax(104px,1fr))`;

        function celda(t, dia) {
            const fechaISO = opsCalFechaISO(dia);
            const folios = foliosBase.filter(f => (f.tecnicosAsignadosIds || []).includes(t.id) && opsCalDatosFolio(f)?.fecha === fechaISO)
                .sort((a, b) => opsCalDatosFolio(a).horaDecimal - opsCalDatosFolio(b).horaDecimal);
            const ausente = cacheAusencias.some(a => a.tecnicoId === t.id && a.fechaInicio <= fechaISO && a.fechaFin >= fechaISO);
            if (ausente) return `<div style="height:100%;min-height:44px;background:repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0 5px,#f1f5f9 5px,#f1f5f9 10px);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#64748b;font-weight:700;">Ausente</div>`;
            if (!folios.length) return "";
            const datos = folios.map(f => opsCalDatosFolio(f));
            const conChoque = datos.some((d1, i) => datos.some((d2, j) => i !== j && d1.horaDecimal < (d2.horaDecimal + d2.traslado + d2.ejecucion) && (d1.horaDecimal + d1.traslado + d1.ejecucion) > d2.horaDecimal));
            const vis = folios.slice(0, 2), resto = folios.length - vis.length;
            return `<div style="${conChoque ? "outline:2px solid #E7402B;outline-offset:1px;border-radius:8px;" : ""}">
                ${vis.map(f => {
                    const cat = opsCalColorFolio(f), d = opsCalDatosFolio(f);
                    const sinHora = !(f.fechaProgramada || "").includes("T");
                    return `<div class="ops-cal-chip" onclick="opsAbrirPanelFolio('${f.id}')" title="${opsEsc((f.folioOS ? "O.S. " + f.folioOS + " · " : "") + f.estacion + " · " + (f.clienteNombre || "Sin cliente") + " · " + cat.nombre + " · " + cat.estNombre)}" style="background:${cat.fondo};border:none;box-shadow:inset 5px 0 0 ${cat.estColor},inset 7px 0 0 #fff,inset 0 0 0 1px ${cat.borde};${cat.punteado ? "outline:2px dashed " + cat.estColor + ";outline-offset:1px;" : ""}border-radius:6px;padding:3px 6px 3px 11px;margin-bottom:3px;cursor:pointer;overflow:hidden;">
                        <div style="font-size:10.5px;font-weight:700;color:${cat.texto};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cat.empresa === "jomar" ? `<span style="font-size:8px;font-weight:800;color:${cat.color};background:#fff;padding:0 3px;border-radius:3px;margin-right:4px;">J</span>` : ""}${opsEsc(f.estacion)}</div>
                        <div style="font-size:9.5px;color:${cat.suave};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sinHora ? "Sin hora" : opsCalFmtHora(d.horaDecimal)} · ${opsEsc(cat.nombre)} · ${opsEsc(cat.estNombre)}</div>
                    </div>`;
                }).join("")}
                ${resto > 0 ? `<div onclick="opsCalIrADia('${fechaISO}')" style="font-size:10px;font-weight:700;color:#1D2E73;background:#eef2f7;border-radius:6px;padding:2px 6px;text-align:center;cursor:pointer;">+${resto} más</div>` : ""}
            </div>`;
        }

        return `${opsCalEstilosUnaVez()}
        <div style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.04),0 4px 14px rgba(15,23,42,.06);">
          <div class="ops-cal-scroll" style="overflow:auto;max-height:${opsCalAltoScroll()};">
            <div style="min-width:${OPS_CAL_ANCHO_TEC + 7 * 104}px;">
                <div style="display:grid;grid-template-columns:${cols};position:sticky;top:0;z-index:7;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
                    <div style="position:sticky;left:0;z-index:8;background:#f8fafc;padding:8px 10px;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.5px;border-right:1px solid #e8edf3;">Técnico · Puesto</div>
                    ${dias.map(d => { const esHoy = opsCalFechaISO(d) === hoyISO;
                        return `<div onclick="opsCalIrADia('${opsCalFechaISO(d)}')" style="padding:8px 4px;text-align:center;cursor:pointer;border-left:1px solid #eef1f6;">
                            <div style="font-size:9.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;">${d.toLocaleDateString("es-MX", { weekday: "short" })}</div>
                            <div style="display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border-radius:13px;margin-top:2px;font-size:13px;font-weight:800;${esHoy ? "background:#1D2E73;color:#fff;" : "color:#334155;"}">${d.getDate()}</div>
                        </div>`; }).join("")}
                </div>
                ${tecnicos.length ? tecnicos.map(t => {
                    const guardia = cacheGuardias.find(g => g.tecnicoId === t.id && g.estado === "activa");
                    return `<div style="display:grid;grid-template-columns:${cols};border-bottom:1px solid #eef1f6;min-height:46px;">
                        ${opsCalCeldaTecnico(t, guardia)}
                        ${dias.map(d => `<div style="padding:3px 4px;border-left:1px solid #f1f5f9;min-width:0;${opsCalFechaISO(d) === hoyISO ? "background:#f8fafd;" : ""}">${celda(t, d)}</div>`).join("")}
                    </div>`; }).join("") : `<div style="padding:40px;text-align:center;color:#94a3b8;">Ningún técnico coincide con los filtros.</div>`}
            </div>
          </div>
        </div>`;
    }

    // ── Vista Mes: un punto por día con folios, clic salta a Día ──
    function opsCalRenderMes() {
        const primerDia = new Date(opsCalFecha.getFullYear(), opsCalFecha.getMonth(), 1);
        const ultimoDia = new Date(opsCalFecha.getFullYear(), opsCalFecha.getMonth() + 1, 0);
        const inicioGrid = opsCalInicioSemana(primerDia);
        const dias = [];
        let cursor = inicioGrid;
        while (cursor <= ultimoDia || dias.length % 7 !== 0) { dias.push(new Date(cursor)); cursor = opsCalSumarDias(cursor, 1); if (dias.length > 42) break; }

        function contarDia(d) {
            const fechaISO = opsCalFechaISO(d);
            return opsCalFoliosFiltrados().filter(f => opsCalDatosFolio(f)?.fecha === fechaISO);
        }

        return `
        <div style="background:#fff;border-radius:14px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:6px;">
                ${["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(d => `<div style="text-align:center;font-size:10px;font-weight:700;color:#94a3b8;">${d}</div>`).join("")}
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;">
                ${dias.map(d => {
                    const fueraDeMes = d.getMonth() !== opsCalFecha.getMonth();
                    const folios = contarDia(d);
                    const esHoy = opsCalFechaISO(d) === opsCalFechaISO(new Date());
                    const accion = folios.length === 1 ? `opsAbrirPanelFolio('${folios[0].id}')` : `opsCalIrADia('${opsCalFechaISO(d)}')`;
                    const coloresDia = [...new Set(folios.map(f => opsCalColorFolio(f).color))].slice(0, 4);
                    return `<div onclick="${accion}" style="min-height:56px;border-radius:8px;padding:6px;cursor:pointer;background:${esHoy ? "#eef2f7" : "#f8fafc"};border:1px solid ${esHoy ? "#1D2E73" : "#f1f5f9"};opacity:${fueraDeMes ? 0.4 : 1};">
                        <div style="font-size:10.5px;font-weight:700;color:#334155;">${d.getDate()}</div>
                        ${folios.length ? `<div style="margin-top:4px;display:flex;align-items:center;gap:3px;flex-wrap:wrap;">
                            ${coloresDia.map(c => `<span style="width:8px;height:8px;border-radius:50%;background:${c};display:inline-block;"></span>`).join("")}
                            <span style="font-size:9.5px;font-weight:700;color:#475569;margin-left:2px;">${folios.length}</span>
                        </div>` : ""}
                    </div>`;
                }).join("")}
            </div>
        </div>`;
    }

    // ═══════════ DATOS DE PRUEBA DEL CALENDARIO (temporal — rediseño sep-2026) ═══════════
    // seedDemoCalendar()  → crea folios ficticios para ESTA semana, con la misma forma que un folio real.
    // clearDemoCalendar() → borra ÚNICAMENTE los folios marcados source:"DEMO_CALENDAR" (y sus comentarios).
    // Cada folio DEMO lleva: source:"DEMO_CALENDAR", esDemo:true, origen:"DEMO_CALENDAR", O.S. "DEMO-0001…"
    // y la estación empieza con "[DEMO]". Los folios DEMO no hacen sonar alarmas ni salen en avisos automáticos.
    // Uso: abre Operaciones (para que carguen los técnicos) y en la consola del navegador ejecuta
    //      await seedDemoCalendar()    y después    await clearDemoCalendar()
    window.seedDemoCalendar = async function () {
        try {
            if (!opsPuedeGestionar()) { alert("Solo un administrador de Operaciones puede generar datos DEMO."); return null; }
            const { db, fs } = await opsGetFB();
            const tecnicos = opsTecOperativos().slice(0, 12);
            if (tecnicos.length < 2) { alert("Abre primero Operaciones y espera a que carguen los técnicos (se necesitan al menos 2 activos)."); return null; }

            const previos = cacheFolios.filter(f => f.source === OPS_DEMO_SOURCE);
            if (previos.length) {
                if (!confirm(`Ya hay ${previos.length} folios DEMO. ¿Reemplazarlos por unos nuevos? (solo se borran los DEMO, nunca los reales)`)) return null;
                await window.clearDemoCalendar({ silencioso: true });
            }

            const pad = n => String(n).padStart(2, "0");
            const isoFecha = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const isoFechaHora = d => `${isoFecha(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            const ahora = new Date();
            const sumarDias = (n, h) => { const d = new Date(ahora); d.setDate(d.getDate() + n); if (h !== undefined) d.setHours(h, 0, 0, 0); return d; };
            const lunes = opsCalInicioSemana(ahora);
            const hoyIdx = Math.round((new Date(isoFecha(ahora) + "T00:00:00") - new Date(isoFecha(lunes) + "T00:00:00")) / 86400000);

            let semilla = 29092026; // generador determinista: la demo sale igual cada vez
            const azar = () => (semilla = (semilla * 1664525 + 1013904223) % 4294967296) / 4294967296;
            const elegir = a => a[Math.floor(azar() * a.length)];

            const CLIENTES = ["OXXO GAS", "Petro Siete", "Combu-Express", "Gasolineras del Norte", "Energéticos del Bravo", "Grupo Sierra Madre"];
            const ESTACIONES = ["Chihuahua Norte", "Juárez Pronaf", "Delicias Centro", "Parral Sur", "Cuauhtémoc Oriente", "Monterrey Apodaca", "Hermosillo Blvd.", "Guadalajara Zapopan", "Chihuahua Periférico", "Juárez Aeropuerto", "Nuevo Casas Grandes", "Camargo Carretera"];
            const TIPOS = ["Mantenimiento preventivo", "Calibración de dispensarios", "Instalación de sonda", "Prueba de hermeticidad", "Cambio de mangueras", "Revisión eléctrica", "Corrección de fugas"];
            const NORMAS = ["Anexo 21", "Anexo 22", "ASEA", "SCFI", "Alto Flujo", "Calibración Medida Volumétrica"];
            const CICLO = ["servicio", "jomar", "visita", "seguimiento", "servicio", "vencido", "jomar", "visita", "facturar", "servicio", "seguimiento", "jomar", "visita", "vencido"];

            const ocupacion = new Map(); // tecnicoId|dia -> [{ini,fin}]
            const libre = (tid, dia, ini, fin) => !(ocupacion.get(tid + "|" + dia) || []).some(o => ini < o.fin && fin > o.ini);
            const ocupar = (tid, dia, ini, fin) => { const k = tid + "|" + dia; if (!ocupacion.has(k)) ocupacion.set(k, []); ocupacion.get(k).push({ ini, fin }); };

            // Lo que ya está programado de verdad esta semana cuenta como ocupado: la demo se acomoda alrededor.
            cacheFolios.filter(f => f.source !== OPS_DEMO_SOURCE).forEach(f => {
                const d = opsCalDatosFolio(f); if (!d) return;
                const di = Math.round((new Date(d.fecha + "T00:00:00") - new Date(isoFecha(lunes) + "T00:00:00")) / 86400000);
                if (di < 0 || di > 5) return;
                (f.tecnicosAsignadosIds || []).forEach(tid => ocupar(tid, di, d.horaDecimal, d.horaDecimal + d.traslado + Math.max(d.ejecucion, 0.5)));
            });

            const plan = [];
            let n = 0, vencidoN = 0;
            tecnicos.forEach((t, ti) => {
                for (let di = 0; di < 6; di++) {
                    if (di === 5 && ti % 3 !== 0) continue;             // sábado: casi vacío
                    if ((ti * 7 + di) % 9 === 0) continue;               // algunos huecos para que se vea aire en la rejilla
                    const cuantas = di === 5 ? 1 : 1 + (((ti + di) % 3 === 0) ? 2 : ((ti + di) % 2));
                    let cursor = 6.5 + Math.round(azar() * 3) / 2;
                    for (let k = 0; k < cuantas; k++) {
                        let cat = CICLO[(ti * 3 + di * 5 + k * 2) % CICLO.length];
                        if (di <= hoyIdx && cat === "servicio" && (ti + di + k) % 3 === 0) cat = "facturar"; // lo ya ejecutado puede estar listo para facturar
                        if (cat === "facturar" && di > hoyIdx) cat = "servicio"; // ...pero lo futuro no
                        const esVisita = cat === "visita";
                        const traslado = esVisita ? elegir([0.5, 0.5, 1]) : elegir([0, 0.5, 0.5, 1]);
                        const ejecucion = esVisita ? elegir([1, 1.5, 2]) : elegir([1.5, 2, 2.5, 3, 4]);
                        const ini = cursor, fin = ini + traslado + ejecucion;
                        if (fin > 19.5) break;
                        if (!libre(t.id, di, ini, fin)) { cursor = fin + 0.5; continue; }
                        ocupar(t.id, di, ini, fin);
                        const ids = [t.id];
                        if (!esVisita && k === 0 && (ti + di) % 4 === 0) { // algunos servicios con 2 técnicos
                            const otro = tecnicos[(ti + 1) % tecnicos.length];
                            if (otro.id !== t.id && libre(otro.id, di, ini, fin)) { ocupar(otro.id, di, ini, fin); ids.push(otro.id); }
                        }
                        plan.push({ ids, cat, di, ini, traslado, ejecucion, idx: ++n });
                        cursor = fin + elegir([0, 0.5, 1]);
                    }
                }
            });
            // Un choque de horario intencional, para ver cómo se marca (el 2.º técnico, martes, empieza dentro del 1.º)
            const base = plan.find(p => p.di === Math.min(hoyIdx, 4) && p.cat !== "visita" && p.ids.length === 1);
            if (base) plan.push({ ids: base.ids.slice(), cat: "servicio", di: base.di, ini: base.ini + 0.5, traslado: 0, ejecucion: 2, idx: ++n });

            const creados = { jomar: 0, servicio: 0, visita: 0, seguimiento: 0, vencido: 0, facturar: 0 };
            for (const p of plan) {
                const dia = opsCalSumarDias(lunes, p.di);
                const hh = Math.floor(p.ini), mm = Math.round((p.ini - hh) * 60);
                const fechaProgramada = `${isoFecha(dia)}T${pad(hh)}:${pad(mm === 60 ? 0 : mm)}`;
                const cliente = elegir(CLIENTES);
                const est = ESTACIONES[p.idx % ESTACIONES.length];
                const nombresIds = p.ids.map(id => (cacheTec.find(t => t.id === id) || {}).nombre || "");
                const resp = cacheTec.find(t => t.id === p.ids[0]);
                const solicitud = sumarDias(-12, 9);

                const datos = {
                    folioOS: "DEMO-" + String(p.idx).padStart(4, "0"),
                    estacion: "[DEMO] " + est,
                    estacionCatalogoId: null, estacionEncargado: null, estacionZona: null, estacionDireccion: null,
                    esSCFI: false, hologramas: null, precintos: null, distintivos: null, viaticos: null,
                    comentarios: "DEMO — dato ficticio generado por seedDemoCalendar(). Se borra con clearDemoCalendar().",
                    clienteId: null, clienteNombre: p.cat === "jomar" ? "JOMAR" : cliente, prioridad: p.cat === "visita" ? null : elegir(["P1", "P2", "P3", "P3", "P4"]),
                    fechaSolicitud: isoFechaHora(solicitud), vencimiento: null, fechaAtencion: null, fechaSolucion: null,
                    tecnicoResponsableId: resp.id, tecnicoResponsableNombre: resp.nombre, tecnicoResponsableCorreo: resp.correo || null,
                    responsable: resp.nombre,
                    tipoFolio: p.cat === "visita" ? "inspeccion" : "servicio",
                    normaInspeccion: p.cat === "visita" ? elegir(NORMAS) : null,
                    servicioCatalogoId: null, tipoServicioDemo: p.cat === "visita" ? null : elegir(TIPOS),
                    fechaProgramada, tiempoEjecucionHrs: p.ejecucion, tiempoTrasladoHrs: p.traslado,
                    tecnicosAsignadosIds: p.ids, tecnicosAsignadosNombres: nombresIds,
                    contactoNombre: null, contactoTelefono: null, encargadoInterno: null, facturarA: null, proyecto: null,
                    gastoEstimado: null, viaticosPendientes: false, viaticosMonto: null,
                    // ── marca DEMO (lo único que usa clearDemoCalendar para reconocerlos) ──
                    source: OPS_DEMO_SOURCE, esDemo: true, origen: OPS_DEMO_SOURCE,
                    creadoPor: "DEMO_CALENDAR", creadoEn: opsFechaHora(),
                };
                if (p.cat === "jomar") { datos.esJomar = true; datos.vencimiento = isoFechaHora(sumarDias(8, 18)); datos.facturarA = "JOMAR"; }
                else if (p.cat === "servicio") datos.vencimiento = isoFechaHora(sumarDias(8, 18));
                else if (p.cat === "seguimiento") { datos.vencimiento = isoFechaHora(sumarDias(2, 18)); datos.fechaAtencion = isoFecha(sumarDias(4)); }
                else if (p.cat === "vencido") { datos.vencimiento = (vencidoN++ % 3 === 2) ? isoFechaHora(new Date(ahora.getTime() + 6 * 3600000)) : isoFechaHora(sumarDias(-1, 10)); }
                else if (p.cat === "facturar") { datos.vencimiento = isoFechaHora(sumarDias(-4, 18)); datos.fechaSolucion = isoFecha(sumarDias(-1)); datos.facturarA = datos.clienteNombre; }
                // visita: sin vencimiento ni atención (igual que las visitas de inspección reales)

                await fs.addDoc(fs.collection(db, COL_FOLIOS), datos);
                creados[opsCalCategoriaFolio(datos)]++;
            }

            const snap = await fs.getDocs(fs.collection(db, COL_FOLIOS));
            cacheFolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            opsCalFecha = new Date(); opsCalFecha.setHours(0, 0, 0, 0);
            if (tabActual === "calendario") opsRenderCalendario();
            const total = plan.length;
            console.log(`[DEMO_CALENDAR] ${total} folios DEMO creados`, creados);
            if (window.mostrarPush) window.mostrarPush("Operaciones", `${total} folios DEMO creados en el Calendario.`, "🧪");
            return { total, porCategoria: creados };
        } catch (e) {
            console.error("[seedDemoCalendar]", e);
            alert("No se pudo generar la demo: " + e.message);
            return null;
        }
    };

    window.clearDemoCalendar = async function (opciones) {
        try {
            const { db, fs } = await opsGetFB();
            // Se buscan directo en Firestore (no solo en memoria) y, ADEMÁS, se revisa uno por uno que la marca sea exacta.
            const snap = await fs.getDocs(fs.query(fs.collection(db, COL_FOLIOS), fs.where("source", "==", OPS_DEMO_SOURCE)));
            let borrados = 0;
            for (const d of snap.docs) {
                if (d.data().source !== OPS_DEMO_SOURCE) continue; // seguro extra: jamás toca un folio sin la marca
                try {
                    const com = await fs.getDocs(fs.collection(db, COL_FOLIOS, d.id, "comentarios"));
                    for (const c of com.docs) await fs.deleteDoc(fs.doc(db, COL_FOLIOS, d.id, "comentarios", c.id));
                } catch (e) { /* un folio DEMO normalmente no tiene comentarios */ }
                await fs.deleteDoc(fs.doc(db, COL_FOLIOS, d.id));
                borrados++;
            }
            const todos = await fs.getDocs(fs.collection(db, COL_FOLIOS));
            cacheFolios = todos.docs.map(d => ({ id: d.id, ...d.data() }));
            if (tabActual === "calendario") opsRenderCalendario();
            console.log(`[DEMO_CALENDAR] ${borrados} folios DEMO eliminados. Folios reales restantes: ${cacheFolios.length}`);
            if (!(opciones && opciones.silencioso) && window.mostrarPush) window.mostrarPush("Operaciones", `${borrados} folios DEMO eliminados. Los folios reales no se tocaron.`, "🧹");
            return { borrados, realesRestantes: cacheFolios.length };
        } catch (e) {
            console.error("[clearDemoCalendar]", e);
            alert("No se pudo limpiar la demo: " + e.message);
            return null;
        }
    };

    // ═══════════════════════ FASE B — Panel de detalle del folio ═══════════════════════
    // Panel lateral flotante (no modal, no tapa el Calendario de fondo). Reutiliza
    // datos que ya existen — comentarios (subcolección), receta del catálogo, y
    // opsFlotillaProvider para el vehículo de cada técnico — nada nuevo que
    // duplique lo que ya hay. El botón "Editar" abre el modal completo de siempre.
    window.opsCerrarPanelFolio = function () {
        const p = document.getElementById("ops-panel-folio");
        if (p) p.remove();
    };

    window.opsAbrirPanelFolio = async function (folioId) {
      try {
        const f = cacheFolios.find(x => x.id === folioId);
        if (!f) { alert("No se encontró ese folio en memoria — recarga la página e intenta otra vez."); return; }
        let panel = document.getElementById("ops-panel-folio");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "ops-panel-folio";
            panel.style.cssText = "position:fixed;top:0;right:0;bottom:0;width:min(440px,92vw);background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.15);z-index:99998;overflow-y:auto;";
            document.body.appendChild(panel);
        }

        const semaforo = opsCalcularSemaforoFolio(f);
        const receta = f.servicioCatalogoId ? cacheServiciosCatalogo.find(s => s.id === f.servicioCatalogoId) : null;
        const rolesReq = receta ? (receta.personal || []).reduce((n, p) => n + (p.cantidad || 1), 0) : null;
        const tecnicos = (f.tecnicosAsignadosIds || []).map(id => cacheTec.find(t => t.id === id)).filter(Boolean);

        panel.innerHTML = `
            <div style="position:sticky;top:0;background:#1D2E73;color:#fff;padding:16px 18px;display:flex;justify-content:space-between;align-items:flex-start;z-index:1;">
                <div>
                    <div style="font-size:10px;opacity:.75;text-transform:uppercase;letter-spacing:.4px;">${f.tipoFolio === "laboratorio" ? "Laboratorio" : "Servicio"}${f.folioOS ? " · O.S. " + opsEsc(f.folioOS) : ""}</div>
                    <div style="font-size:15px;font-weight:700;margin-top:2px;">${opsEsc(f.estacion)}</div>
                </div>
                <button onclick="opsCerrarPanelFolio()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:16px;">×</button>
            </div>
            <div style="padding:18px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                    <div><div style="font-size:10px;color:#94a3b8;font-weight:600;">CLIENTE</div><div style="font-size:12.5px;color:#1e293b;font-weight:600;">${opsEsc(f.clienteNombre || "—")}</div></div>
                    <div><div style="font-size:10px;color:#94a3b8;font-weight:600;">PRIORIDAD</div><div style="font-size:12.5px;color:#1e293b;font-weight:600;">${opsEsc(f.prioridad || "—")}</div></div>
                    <div><div style="font-size:10px;color:#94a3b8;font-weight:600;">VENCIMIENTO SLA</div><div style="font-size:12.5px;font-weight:700;color:${{ verde: "#15803D", rojo: "#E7402B", naranja: "#b45309", gris: "#64748b" }[semaforo.semaforo] || "#1e293b"};">${f.vencimiento ? new Date(f.vencimiento).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</div></div>
                    <div><div style="font-size:10px;color:#94a3b8;font-weight:600;">ESTADO</div><div style="font-size:12.5px;font-weight:600;color:#1e293b;">${f.fechaSolucion ? "Cerrado" : f.fechaAtencion ? "En atención" : "Abierto"}</div></div>
                </div>

                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:8px;">Equipo asignado${rolesReq !== null ? ` (${tecnicos.length}/${rolesReq})` : ""}</div>
                    <div id="ops-panel-equipo" style="display:flex;flex-direction:column;gap:8px;">
                        ${tecnicos.length ? tecnicos.map(t => `<div id="ops-panel-eq-${t.id}" style="background:#f8fafc;border-radius:8px;padding:8px 10px;font-size:12px;color:#334155;">${opsEsc(t.nombre)} <span style="color:#94a3b8;">— cargando vehículo…</span></div>`).join("") : `<div style="font-size:11.5px;color:#94a3b8;">Sin técnicos asignados todavía.</div>`}
                    </div>
                    ${rolesReq !== null && tecnicos.length < rolesReq ? `<div style="margin-top:6px;font-size:10.5px;color:#E7402B;font-weight:600;">Falta personal contra lo que pide la receta.</div>` : ""}
                </div>

                ${f.estacionCatalogoId ? `
                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:8px;">Estación (del catálogo)</div>
                    <div style="font-size:12px;color:#334155;line-height:1.7;">
                        ${f.estacionRazonSocial ? `Razón social: ${opsEsc(f.estacionRazonSocial)}<br>` : ""}
                        ${f.estacionPermiso ? `Permiso (PL): ${opsEsc(f.estacionPermiso)}<br>` : ""}
                        ${f.estacionCR ? `CR (OXXO): ${opsEsc(f.estacionCR)}<br>` : ""}
                        ${f.estacionEncargado ? `Encargado: ${opsEsc(f.estacionEncargado)}<br>` : ""}
                        ${f.estacionZona ? `Zona: ${opsEsc(f.estacionZona)}<br>` : ""}
                        ${f.estacionDireccion ? `Dirección: ${opsEsc(f.estacionDireccion)}<br>` : ""}
                        ${(f.estacionNumeroTanques || f.estacionNumeroDispensarios || f.estacionNumeroSondas) ? `Equipo: ${[f.estacionNumeroTanques ? f.estacionNumeroTanques + " tanque(s)" : "", f.estacionNumeroDispensarios ? f.estacionNumeroDispensarios + " dispensario(s)" : "", f.estacionNumeroSondas ? f.estacionNumeroSondas + " sonda(s)" : ""].filter(Boolean).join(" · ")}` : ""}
                    </div>
                </div>` : ""}

                ${f.esSCFI ? `
                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:700;color:#7c3aed;margin-bottom:8px;">Servicio SCFI</div>
                    <div style="font-size:12px;color:#334155;line-height:1.7;">
                        ${[f.hologramas != null ? f.hologramas + " holograma(s)" : "", f.precintos != null ? f.precintos + " precinto(s)" : "", f.distintivos != null ? f.distintivos + " distintivo(s)" : "", f.viaticos != null ? f.viaticos + " viático(s)" : ""].filter(Boolean).join(" · ") || "Sin cantidades capturadas."}
                    </div>
                </div>` : ""}

                ${(f.gastoEstimado || f.viaticosMonto || f.hospedajeMonto || f.casetasMonto) ? `
                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:700;color:#0e7490;margin-bottom:8px;">Gastos de viaje (estimado)</div>
                    <div style="font-size:12px;color:#334155;line-height:1.7;">
                        ${f.diasTrabajo ? `Días de viaje: ${f.diasTrabajo}<br>` : ""}
                        ${f.viaticosMonto ? `Viáticos: $${f.viaticosMonto.toLocaleString("es-MX")}<br>` : ""}
                        ${f.hospedajeMonto ? `Hospedaje: $${f.hospedajeMonto.toLocaleString("es-MX")}<br>` : ""}
                        ${f.casetasMonto ? `Casetas/gasolina: $${f.casetasMonto.toLocaleString("es-MX")}<br>` : ""}
                        ${f.gastoEstimado ? `<b>Total estimado: $${f.gastoEstimado.toLocaleString("es-MX")}</b>` : ""}
                    </div>
                </div>` : ""}

                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:8px;">Traslado</div>
                    <div style="font-size:12px;color:#334155;line-height:1.7;">
                        Origen: ${opsEsc(f.origen || "No capturado")}<br>
                        Destino: ${opsEsc(f.destino || "No capturado")}<br>
                        Distancia: ${f.distanciaKm ? f.distanciaKm + " km" : "No capturado"} · Casetas: ${f.casetasMonto ? "$" + f.casetasMonto : "No capturado"}<br>
                        Hora de salida: ${opsEsc(f.horaSalida || "No capturada")}
                    </div>
                    <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Estos campos todavía se capturan a mano (la integración con GPS es la Fase D).</div>
                </div>

                <div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-bottom:16px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;margin-bottom:8px;">Historial</div>
                    <div id="ops-panel-historial" style="font-size:11.5px;color:#94a3b8;">Cargando…</div>
                </div>

                ${opsPuedeGestionar() ? `<button onclick="opsAbrirModalFolio('${f.id}')" class="mkt-add-btn" style="background:#1D2E73;width:100%;">Editar folio</button>` : ""}
            </div>`;

        // ── Vehículo de cada técnico (async, no bloquea el resto del panel) ──
        tecnicos.forEach(async t => {
            const veh = await window.opsFlotillaProvider.obtenerVehiculoActual(t.id);
            const el = document.getElementById(`ops-panel-eq-${t.id}`);
            if (el) el.innerHTML = `${opsEsc(t.nombre)} <span style="color:#94a3b8;">— ${veh ? opsEsc(veh.unidad) + (veh.modelo ? " (" + opsEsc(veh.modelo) + ")" : "") : "sin vehículo asignado"}</span>`;
        });

        // ── Historial (subcolección comentarios) ──
        try {
            const { db, fs } = await opsGetFB();
            const snap = await fs.getDocs(fs.query(fs.collection(db, COL_FOLIOS, f.id, "comentarios"), fs.orderBy("createdAt", "asc")));
            const hist = document.getElementById("ops-panel-historial");
            if (!hist) return; // el panel ya se cerró o cambió de folio mientras cargaba
            if (snap.empty) { hist.innerHTML = `<div style="font-size:11.5px;color:#94a3b8;">Sin comentarios todavía.</div>`; return; }
            hist.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;">` + snap.docs.map(d => {
                const c = d.data();
                const fecha = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt ? new Date(c.createdAt) : null);
                return `<div style="border-left:2px solid #dbe3f0;padding-left:10px;">
                    <div style="font-size:10px;color:#94a3b8;">${opsEsc(c.autor || c.autorEmail || "—")} · ${fecha ? fecha.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                    <div style="font-size:12px;color:#334155;margin-top:2px;">${opsEsc(c.texto || "")}</div>
                </div>`;
            }).join("") + `</div>`;
        } catch (e) {
            const hist = document.getElementById("ops-panel-historial");
            if (hist) hist.innerHTML = `<div style="font-size:11px;color:#E7402B;">No se pudo cargar el historial.</div>`;
            console.warn("[Panel folio] historial:", e.message);
        }
      } catch (eGeneral) {
          console.error("[opsAbrirPanelFolio]", eGeneral);
          alert("No se pudo abrir el detalle del folio: " + eGeneral.message);
      }
    };

    // ═══════════════════════ FASE C — Arrastrar y soltar ═══════════════════════
    window.opsCalArrastrarFolio = function (event, folioId) {
        event.dataTransfer.setData("text/plain", folioId);
        event.dataTransfer.effectAllowed = "move";
    };

    window.opsCalSoltarFolio = async function (event, tecnicoId) {
        event.preventDefault();
        event.currentTarget.style.background = "";
        if (!opsPuedeGestionar()) return; // defensa extra — el drag ya está deshabilitado en el HTML para consulta
        const folioId = event.dataTransfer.getData("text/plain");
        if (!folioId) return;
        const f = cacheFolios.find(x => x.id === folioId);
        const t = cacheTec.find(x => x.id === tecnicoId);
        if (!f || !t) return;

        // Hora aproximada según dónde soltaste dentro de la fila, redondeada a 30 min.
        const rect = event.currentTarget.getBoundingClientRect();
        const pct = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const totalHrs = OPS_CAL_HORA_FIN - OPS_CAL_HORA_INICIO;
        let horaDecimal = OPS_CAL_HORA_INICIO + pct * totalHrs;
        horaDecimal = Math.round(horaDecimal * 2) / 2; // redondeo a media hora
        const hh = String(Math.floor(horaDecimal)).padStart(2, "0");
        const mm = horaDecimal % 1 ? "30" : "00";
        const fechaISO = opsCalFechaISO(opsCalFecha);
        const fechaProgramada = `${fechaISO}T${hh}:${mm}`;

        const yaAsignado = (f.tecnicosAsignadosIds || []).includes(tecnicoId);
        const teniaOtroUnico = !yaAsignado && (f.tecnicosAsignadosIds || []).length === 1;
        let nuevosIds, nuevosNombres, accionTexto;
        if (yaAsignado) {
            nuevosIds = f.tecnicosAsignadosIds; nuevosNombres = f.tecnicosAsignadosNombres;
            accionTexto = `¿Reprogramar "${f.estacion}"${f.folioOS ? " (O.S. " + f.folioOS + ")" : ""} para el ${opsCalFecha.toLocaleDateString("es-MX", { day: "numeric", month: "long" })} a las ${hh}:${mm}?`;
        } else if (teniaOtroUnico) {
            nuevosIds = [tecnicoId]; nuevosNombres = [t.nombre];
            accionTexto = `¿Mover "${f.estacion}"${f.folioOS ? " (O.S. " + f.folioOS + ")" : ""} de ${f.tecnicosAsignadosNombres[0]} a ${t.nombre}, el ${opsCalFecha.toLocaleDateString("es-MX", { day: "numeric", month: "long" })} a las ${hh}:${mm}?`;
        } else {
            nuevosIds = [...(f.tecnicosAsignadosIds || []), tecnicoId]; nuevosNombres = [...(f.tecnicosAsignadosNombres || []), t.nombre];
            accionTexto = `¿Agregar a ${t.nombre} al equipo de "${f.estacion}"${f.folioOS ? " (O.S. " + f.folioOS + ")" : ""}, programado para el ${opsCalFecha.toLocaleDateString("es-MX", { day: "numeric", month: "long" })} a las ${hh}:${mm}?`;
        }
        if (!confirm(accionTexto)) return;

        try {
            const { db, fs } = await opsGetFB();
            await fs.updateDoc(fs.doc(db, COL_FOLIOS, folioId), {
                fechaProgramada, tecnicosAsignadosIds: nuevosIds, tecnicosAsignadosNombres: nuevosNombres,
            });
            f.fechaProgramada = fechaProgramada; f.tecnicosAsignadosIds = nuevosIds; f.tecnicosAsignadosNombres = nuevosNombres;
            opsRenderCalendario();
            if (window.mostrarPush) window.mostrarPush("Operaciones", "Folio programado.", "✅");
        } catch (e) {
            console.error("[opsCalSoltarFolio]", e);
            alert("No se pudo programar el folio: " + e.message);
        }
    };

    window.opsExportarFoliosExcel = function () {
        if (typeof XLSX === "undefined") { alert("Falta cargar SheetJS (XLSX) en index.html."); return; }
        const filas = cacheFolios.map(f => {
            const info = opsCalcularSemaforoFolio(f);
            return {
                "O.S.": f.folioOS || "", "Estación": f.estacion || "", "Razón social": f.estacionRazonSocial || "",
                "Permiso (PL)": f.estacionPermiso || "", "CR (OXXO)": f.estacionCR || "", "Zona": f.estacionZona || "",
                "Encargado estación": f.estacionEncargado || "", "Cliente": f.clienteNombre || "", "Prioridad": f.prioridad || "",
                "Tipo de folio": (OPS_TIPOS_FOLIO.find(t => t.clave === f.tipoFolio)?.nombre) || f.tipoFolio || "",
                "Norma (inspección)": f.normaInspeccion || "", "Es SCFI": f.esSCFI ? "Sí" : "No",
                "Hologramas": f.hologramas ?? "", "Precintos": f.precintos ?? "", "Distintivos": f.distintivos ?? "", "Viáticos (cant.)": f.viaticos ?? "",
                "Fecha de solicitud": f.fechaSolicitud || "", "Vencimiento (SLA)": f.vencimiento || "",
                "Fecha de atención": f.fechaAtencion || "", "Fecha de solución": f.fechaSolucion || "",
                "Fecha programada": f.fechaProgramada || "", "Tiempo ejecución (hrs)": f.tiempoEjecucionHrs ?? "", "Tiempo traslado (hrs)": f.tiempoTrasladoHrs ?? "",
                "Responsable": opsResponsableFolio(f), "Correo responsable": f.tecnicoResponsableCorreo || "",
                "Técnicos asignados": (f.tecnicosAsignadosNombres || []).join(", "),
                "Contacto que solicita": f.contactoNombre || "", "Teléfono de contacto": f.contactoTelefono || "",
                "Encargado interno": f.encargadoInterno || "", "A quién se factura": f.facturarA || "", "Proyecto": f.proyecto || "",
                "Días de viaje": f.diasTrabajo ?? "", "Km estimados": f.kmEstimados ?? "",
                "Viáticos ($)": f.viaticosMonto ?? "", "Hospedaje ($)": f.hospedajeMonto ?? "", "Casetas/gasolina ($)": f.casetasMonto ?? "",
                "Gasto total estimado ($)": f.gastoEstimado ?? "", "Viáticos pendientes de pago": f.viaticosPendientes ? "Sí" : "No",
                "Comentarios": f.comentarios || "", "Estado (semáforo)": info.semaforo || "", "Días (texto)": info.diasTexto || "",
                "Motivo del semáforo": info.motivo || "", "Origen": f.origen || "", "Creado por": f.creadoPor || "", "Creado en": f.creadoEn || "",
                "ID interno (no editar)": f.id,
            };
        });
        const ws = XLSX.utils.json_to_sheet(filas);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Folios");
        XLSX.writeFile(wb, "Folios_seguimiento_completo_" + opsFechaHora().slice(0, 10) + ".xlsx");
    };

    window.opsExportarFoliosPDF = function () {
        if (!window.jspdf) { alert("Librería PDF no cargada."); return; }
        const { jsPDF } = window.jspdf;
        const docu = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
        const PW = 279.4, PH = 215.9, ML = 12, MR = 12;
        const AZUL = { r: 29, g: 46, b: 115 };
        let y = 20;

        function encabezado(esPrimera) {
            docu.setFillColor(AZUL.r, AZUL.g, AZUL.b); docu.rect(0, 0, PW, 2.2, "F");
            try { if (window.LOGO_TECNOCONTROL_B64) docu.addImage("data:image/png;base64," + window.LOGO_TECNOCONTROL_B64, "PNG", ML, 6, 24, 7.14); } catch (e) {}
            docu.setTextColor(AZUL.r, AZUL.g, AZUL.b); docu.setFont("helvetica", "bold"); docu.setFontSize(9);
            docu.text(esPrimera ? "Folios · Seguimiento puntual" : "Folios · Seguimiento puntual (continuación)", ML + 28, 10.5);
            docu.setTextColor(120, 120, 120); docu.setFont("helvetica", "normal"); docu.setFontSize(7);
            docu.text("Generado: " + new Date().toLocaleString("es-MX") + " · " + cacheFolios.length + " folio(s)", PW - MR, 10.5, { align: "right" });
            docu.setDrawColor(226, 232, 240); docu.line(ML, 17, PW - MR, 17);
            docu.setFillColor(241, 245, 249); docu.rect(ML, 20, PW - ML - MR, 6, "F");
            docu.setFont("helvetica", "bold"); docu.setFontSize(7.5); docu.setTextColor(51, 65, 85);
            const cols = ["O.S.", "Estación", "Cliente/Prioridad", "Solicitud", "Vencimiento", "Atención", "Solución", "Responsable", "Estado"];
            const anchos = [16, 46, 34, 22, 22, 20, 20, 38, 24];
            let x = ML + 1;
            cols.forEach((c, i) => { docu.text(c, x, 24); x += anchos[i]; });
            return { y: 30, anchos };
        }
        let pos = encabezado(true);
        y = pos.y;
        const anchos = pos.anchos;

        cacheFolios.forEach((f, idx) => {
            if (y > PH - 15) { pos = encabezado(false); y = pos.y; }
            const info = opsCalcularSemaforoFolio(f);
            if (idx % 2 === 1) { docu.setFillColor(248, 250, 252); docu.rect(ML, y - 4, PW - ML - MR, 6, "F"); }
            docu.setFont("helvetica", "normal"); docu.setFontSize(7); docu.setTextColor(30, 41, 59);
            const cp = [f.clienteNombre, f.prioridad].filter(Boolean).join(" · ") || "—";
            const valores = [
                f.folioOS || "—", (f.estacion || "").slice(0, 32), cp.slice(0, 22),
                opsFmtFechaCorta(f.fechaSolicitud) || "—", opsFmtFechaCorta(f.vencimiento) || "—",
                f.fechaAtencion ? opsFmtFechaCorta(f.fechaAtencion) : "—", f.fechaSolucion ? opsFmtFechaCorta(f.fechaSolucion) : "—",
                opsResponsableFolio(f).slice(0, 24), info.semaforo || "—",
            ];
            let x = ML + 1;
            valores.forEach((v, i) => { docu.text(String(v), x, y); x += anchos[i]; });
            y += 6;
        });

        try { window.open(docu.output("bloburl"), "_blank"); }
        catch (e) { docu.save("Folios_seguimiento_" + opsFechaHora().slice(0, 10) + ".pdf"); }
    };

    // ═══ Secciones "Aplica / No aplica" del folio (Glen, sep-2026) ═══
    // El tipo de folio decide qué bloques se ven por defecto; el usuario puede
    // prender/apagar cada uno. Se guarda en f.seccionesAplica. Los campos de un bloque
    // apagado NO se borran — solo se ocultan (así no se pierde nada por un clic).
    const OPS_FOLIO_SECCIONES = {
        sla:      { nombre: "SLA y prioridad" },
        contacto: { nombre: "Contacto y encargado" },
        fac:      { nombre: "Facturación y proyecto" },
        via:      { nombre: "Viáticos y traslado" },
        scfi:     { nombre: "SCFI (hologramas, precintos, distintivos)" },
    };
    const OPS_FOLIO_PRESETS = {
        servicio:    ["sla", "contacto", "fac", "via"],
        inspeccion:  ["contacto", "via"],
        laboratorio: ["sla", "contacto", "fac"],
    };
    function opsFolioSeccionesIniciales(f) {
        if (f && Array.isArray(f.seccionesAplica)) return f.seccionesAplica.slice();
        const set = new Set(OPS_FOLIO_PRESETS[f?.tipoFolio || "servicio"] || OPS_FOLIO_PRESETS.servicio);
        if (!f) return [...set];
        // Folio anterior a este cambio: además se prenden los bloques que ya traen datos, para no esconder nada capturado.
        if (f.esSCFI || f.normaInspeccion === "SCFI") set.add("scfi");
        if (f.prioridad) set.add("sla");
        if (f.contactoNombre || f.contactoTelefono || f.encargadoInterno) set.add("contacto");
        if (f.facturarA || f.proyecto) set.add("fac");
        if (f.viaticosMonto || f.hospedajeMonto || f.casetasMonto || f.gastoEstimado || f.diasTrabajo || f.kmEstimados || f.viaticosPendientes) set.add("via");
        return [...set];
    }
    function opsFolioChipsHTML() {
        const s = window.__opsFolioSecciones || new Set();
        return Object.keys(OPS_FOLIO_SECCIONES).map(k => {
            const on = s.has(k);
            return `<button type="button" onclick="opsFolioToggleSec('${k}')" style="display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11.5px;font-weight:600;cursor:pointer;border:1px solid ${on ? "#1D2E73" : "#cbd5e1"};background:${on ? "#E9ECF5" : "#fff"};color:${on ? "#1D2E73" : "#64748b"};">${on ? ICON.check : ICON.plus} ${opsEsc(OPS_FOLIO_SECCIONES[k].nombre)}</button>`;
        }).join("");
    }
    function opsFolioSecOffHTML(k, visible) {
        return `<div data-ops-sec-off="${k}" onclick="opsFolioToggleSec('${k}')" style="display:${visible ? "flex" : "none"};align-items:center;justify-content:space-between;gap:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 12px;margin:0 0 10px;font-size:11.5px;color:#94a3b8;cursor:pointer;background:#f8fafc;"><span>${opsEsc(OPS_FOLIO_SECCIONES[k].nombre)} · No aplica</span><span style="color:#1D2E73;font-weight:700;">Activar</span></div>`;
    }
    function opsFolioAplicarSecciones() {
        const s = window.__opsFolioSecciones || new Set();
        document.querySelectorAll("#ops-modal-wrap [data-ops-sec]").forEach(el => { el.style.display = s.has(el.dataset.opsSec) ? "block" : "none"; });
        document.querySelectorAll("#ops-modal-wrap [data-ops-sec-off]").forEach(el => { el.style.display = s.has(el.dataset.opsSecOff) ? "none" : "flex"; });
        const scfi = document.getElementById("ops-fol-es-scfi");
        if (scfi) scfi.checked = s.has("scfi");
        const chips = document.getElementById("ops-fol-chips");
        if (chips) chips.innerHTML = opsFolioChipsHTML();
    }
    window.opsFolioToggleSec = function (k) {
        const s = window.__opsFolioSecciones || (window.__opsFolioSecciones = new Set());
        if (s.has(k)) s.delete(k); else s.add(k);
        opsFolioAplicarSecciones();
    };
    // Cambiar el tipo aplica su preset de secciones (los datos ya capturados se conservan, solo se ocultan).
    window.opsFolioSetTipo = function (tipo) {
        document.getElementById("ops-fol-tipo").value = tipo;
        document.getElementById("ops-fol-norma-wrap").style.display = tipo === "inspeccion" ? "block" : "none";
        document.querySelectorAll("#ops-modal-wrap [data-ops-tipo-btn]").forEach(b => {
            const on = b.dataset.opsTipoBtn === tipo;
            b.style.background = on ? "#1D2E73" : "#fff"; b.style.color = on ? "#fff" : "#475569";
        });
        const set = new Set(OPS_FOLIO_PRESETS[tipo] || []);
        if (tipo === "inspeccion" && document.getElementById("ops-fol-norma")?.value === "SCFI") set.add("scfi");
        window.__opsFolioSecciones = set;
        opsFolioAplicarSecciones();
    };
    window.opsFolioCambioNorma = function (norma) {
        if (norma === "SCFI") { (window.__opsFolioSecciones || (window.__opsFolioSecciones = new Set())).add("scfi"); opsFolioAplicarSecciones(); }
    };
    // Al ligar una receta: si la receta trae horas de ejecución por defecto y el campo está vacío, se precarga.
    window.opsFolioPrecargarReceta = function () {
        const idRec = document.getElementById("ops-fol-servicio")?.value;
        const receta = idRec ? cacheServiciosCatalogo.find(x => x.id === idRec) : null;
        const ejec = document.getElementById("ops-fol-tiempo-ejec");
        if (receta && receta.horasEjecucion && ejec && !ejec.value) ejec.value = receta.horasEjecucion;
    };

    window.opsAbrirModalFolio = function (id, fechaSugerida) {
        const f = id ? cacheFolios.find(x => x.id === id) : null;
        const secIni = opsFolioSeccionesIniciales(f);
        window.__opsFolioSecciones = new Set(secIni);
        const tipoIni = f?.tipoFolio || "servicio";
        const secAbre = k => `<div data-ops-sec="${k}" style="display:${secIni.includes(k) ? "block" : "none"};">`;
        const secCierra = k => `</div>${opsFolioSecOffHTML(k, !secIni.includes(k))}`;
        const programadaDefault = f?.fechaProgramada || (fechaSugerida ? fechaSugerida + "T08:00" : "");
        const wrap = document.getElementById("ops-modal-wrap");
        const solicitudDefault = f?.fechaSolicitud || (() => {
            const n = new Date(); const pad = x => String(x).padStart(2, "0");
            return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}T${pad(n.getHours())}:${pad(n.getMinutes())}`;
        })();
        const vencAuto = f ? opsCalcularVencimientoAutomatico(f.fechaSolicitud, f.clienteId, f.prioridad) : null;
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;">
            <div style="background:#f4f6f9;border-radius:16px;width:1180px;max-width:98vw;max-height:92vh;overflow-y:auto;padding:24px;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                    <div style="display:flex;align-items:baseline;gap:10px;">
                        <div style="font-weight:700;font-size:17px;color:#1e293b;">${f ? "Editar folio" : "Nuevo folio"}</div>
                        ${f ? `<div style="font-size:11.5px;color:#94a3b8;">${opsEsc(f.folioOS ? "O.S. " + f.folioOS : f.id)}</div>` : ""}
                    </div>
                    <div style="display:inline-flex;border:1px solid #cbd5e1;border-radius:9px;overflow:hidden;background:#fff;">
                        ${OPS_TIPOS_FOLIO.map(t => `<button type="button" data-ops-tipo-btn="${t.clave}" onclick="opsFolioSetTipo('${t.clave}')" style="border:none;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;background:${tipoIni === t.clave ? "#1D2E73" : "#fff"};color:${tipoIni === t.clave ? "#fff" : "#475569"};">${opsEsc(t.nombre)}</button>`).join("")}
                    </div>
                </div>
                <div style="background:#fff;border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                    <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">Aplica a este folio</span>
                    <div id="ops-fol-chips" style="display:flex;gap:6px;flex-wrap:wrap;">${opsFolioChipsHTML()}</div>
                </div>

                <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">

                <div style="flex:1;min-width:340px;background:#fff;border-radius:12px;border-top:3px solid #1D2E73;box-shadow:0 1px 2px rgba(15,23,42,.04),0 4px 14px rgba(15,23,42,.06);padding:20px;">
                    <div style="font-size:13px;font-weight:700;color:#1D2E73;margin-bottom:16px;display:flex;align-items:center;gap:7px;">${ICON.file} Servicio</div>
                    <div style="display:flex;gap:8px;">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">O.S. (Orden de Servicio)</label>
                        <input id="ops-fol-os" value="${opsEsc(f?.folioOS || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    </div>
                    <div style="position:relative;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Estación</label>
                    <input id="ops-fol-estacion" value="${opsEsc(f?.estacion || "")}" placeholder="Escribe o busca en el catálogo…" oninput="window.opsFolioBuscarEstacion(this.value)" onblur="setTimeout(()=>{const b=document.getElementById('ops-fol-estacion-results');if(b)b.style.display='none';},150)" autocomplete="off" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 2px;">
                    <div id="ops-fol-estacion-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #cbd5e1;border-radius:8px;max-height:200px;overflow-y:auto;z-index:20;box-shadow:0 8px 24px rgba(2,20,50,.14);"></div>
                    <div id="ops-fol-estacion-info" style="font-size:10px;color:#15803D;font-weight:600;min-height:14px;margin-bottom:6px;">${f?.estacionCatalogoId ? `Del catálogo${f.estacionEncargado ? " · Encargado: " + opsEsc(f.estacionEncargado) : ""}${f.estacionZona ? " · Zona " + opsEsc(f.estacionZona) : ""}` : ""}</div></div>

                    <input type="checkbox" id="ops-fol-es-scfi" ${secIni.includes("scfi") ? "checked" : ""} style="display:none;">
                    ${secAbre("scfi")}
                    <div id="ops-fol-scfi-campos" style="background:#faf5ff;border:1px solid #ede4fb;border-radius:10px;padding:14px;margin-bottom:14px;">
                        <div style="font-size:10.5px;color:#7c3aed;margin-bottom:10px;font-weight:600;">Razón social y permiso se toman solos del catálogo de la estación de arriba. Aquí solo captura cuántos va a usar el técnico.</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Hologramas</label>
                            <input id="ops-fol-hologramas" type="number" min="0" value="${f?.hologramas ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Precintos</label>
                            <input id="ops-fol-precintos" type="number" min="0" value="${f?.precintos ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Distintivos</label>
                            <input id="ops-fol-distintivos" type="number" min="0" value="${f?.distintivos ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Viáticos</label>
                            <input id="ops-fol-viaticos" type="number" min="0" value="${f?.viaticos ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                        </div>
                    </div>
                    ${secCierra("scfi")}

                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Comentarios</label>
                    <textarea id="ops-fol-comentarios" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;min-height:50px;">${opsEsc(f?.comentarios || "")}</textarea>

                    <div style="display:flex;gap:8px;">
                        <input type="hidden" id="ops-fol-tipo" value="${opsEsc(tipoIni)}">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Servicio (catálogo)</label>
                        <select id="ops-fol-servicio" onchange="window.opsFolioPrecargarReceta();window.opsFolioSugerirTecnicos('${id || ""}')" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                            <option value="">— Sin ligar —</option>
                            ${cacheServiciosCatalogo.map(s => `<option value="${s.id}" data-categoria="${opsEsc(s.categoria || "")}" ${f?.servicioCatalogoId === s.id ? "selected" : ""}>${opsEsc(s.nombre)}</option>`).join("")}
                        </select></div>
                    </div>

                    <div id="ops-fol-norma-wrap" style="display:${(f?.tipoFolio === "inspeccion") ? "block" : "none"};margin-bottom:10px;">
                        <label style="font-size:11.5px;color:#64748b;font-weight:600;">Norma / tipo de visita</label>
                        <select id="ops-fol-norma" onchange="window.opsFolioCambioNorma(this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0;">
                            ${OPS_NORMAS_INSPECCION.map(n => `<option value="${opsEsc(n)}" ${f?.normaInspeccion === n ? "selected" : ""}>${opsEsc(n)}</option>`).join("")}
                        </select>
                    </div>

                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha y hora programada del trabajo</label>
                    <input type="datetime-local" id="ops-fol-programada" value="${opsEsc(programadaDefault)}" onchange="window.opsFolioSugerirTecnicos('${id || ""}')" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    <div style="font-size:10px;color:#94a3b8;margin:-6px 0 10px;">Esta es la fecha que se ve en el Calendario — distinta de la fecha de solicitud.</div>

                    <div style="display:flex;gap:8px;">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Tiempo de ejecución (hrs)</label>
                        <input type="number" min="0" step="0.5" id="ops-fol-tiempo-ejec" value="${f?.tiempoEjecucionHrs ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Tiempo de traslado (hrs)</label>
                        <input type="number" min="0" step="0.5" id="ops-fol-tiempo-trasl" value="${f?.tiempoTrasladoHrs ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    </div>
                </div>

                <div style="flex:1;min-width:340px;background:#fff;border-radius:12px;border-top:3px solid #0891b2;box-shadow:0 1px 2px rgba(15,23,42,.04),0 4px 14px rgba(15,23,42,.06);padding:20px;">
                    <div style="font-size:13px;font-weight:700;color:#0891b2;margin-bottom:16px;display:flex;align-items:center;gap:7px;">${ICON.user} Seguimiento y equipo</div>
                    <div style="display:flex;gap:8px;align-items:flex-end;">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Cliente</label>
                        <select id="ops-fol-cliente" onchange="window.opsFolioActualizarVencimientoPreview()" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                            <option value="">— Sin clasificar —</option>
                            ${cacheClientes.map(c => `<option value="${c.id}" ${f?.clienteId === c.id ? "selected" : ""}>${opsEsc(c.nombre)}</option>`).join("")}
                        </select></div>
                        <button type="button" onclick="window.opsDetectarClienteFolio()" style="background:#eef2f7;border:none;color:#1f2937;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:11.5px;font-weight:600;margin-bottom:10px;">Detectar</button>
                    </div>

                    ${secAbre("sla")}
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
                    ${secCierra("sla")}

                    <div style="display:flex;gap:8px;">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha de atención</label>
                        <input type="date" id="ops-fol-atencion" value="${f?.fechaAtencion || ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;"></div>
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha de solución</label>
                        <input type="date" id="ops-fol-solucion" value="${f?.fechaSolucion || ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;"></div>
                    </div>
                    <div style="font-size:10px;color:#94a3b8;margin:0 0 10px;">Atención: solo si cerró en tiempo pero quedó un pendiente (no usa la tabla de SLA). Solución: folio 100% cerrado.</div>

                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Responsable (ligado a Técnicos)</label>
                    <select id="ops-fol-tecnico" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        <option value="">— Sin ligar / texto libre —</option>
                        ${cacheTec.filter(t => (t.estatus === "activo" && !opsEsAdministrativo(t)) || f?.tecnicoResponsableId === t.id).map(t => `<option value="${t.id}" ${f?.tecnicoResponsableId === t.id ? "selected" : ""}>${opsEsc(t.nombre)}${t.correo ? " (" + opsEsc(t.correo) + ")" : ""}</option>`).join("")}
                    </select>
                    <input id="ops-fol-responsable-texto" placeholder="Nombre libre (solo si no está en Técnicos)" value="${opsEsc(!f?.tecnicoResponsableId ? (f?.responsable || "") : "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">

                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <label style="font-size:11.5px;color:#64748b;font-weight:600;">Técnicos asignados (equipo del servicio)</label>
                        <button type="button" onclick="window.opsFolioSugerirTecnicos('${id || ""}', true)" style="background:#eef2f7;border:none;color:#1D2E73;padding:5px 10px;border-radius:7px;cursor:pointer;font-size:10.5px;font-weight:600;display:inline-flex;align-items:center;gap:5px;">${ICON.sparkle} Sugerir</button>
                    </div>
                    <div id="ops-fol-sugerencia-nota" style="font-size:10px;color:#94a3b8;margin-bottom:6px;"></div>
                    <div id="ops-fol-tecnicos-check" style="max-height:180px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;margin-bottom:6px;">
                        ${cacheTec.filter(t => (t.estatus === "activo" && !opsEsAdministrativo(t)) || (f?.tecnicosAsignadosIds || []).includes(t.id)).map(t => {
                            const fechaFolio = (programadaDefault || "").slice(0, 10);
                            const ausencia = fechaFolio ? cacheAusencias.find(a => a.tecnicoId === t.id && a.fechaInicio <= fechaFolio && a.fechaFin >= fechaFolio) : null;
                            const yaEstaba = (f?.tecnicosAsignadosIds || []).includes(t.id);
                            return `
                            <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:${ausencia ? "#cbd5e1" : "#334155"};padding:3px 0;${ausencia ? "cursor:not-allowed;" : ""}">
                                <input type="checkbox" class="ops-fol-tec-check" value="${t.id}" data-nombre="${opsEsc(t.nombre)}" ${yaEstaba ? "checked" : ""} ${ausencia && !yaEstaba ? "disabled" : ""} style="width:14px;height:14px;">
                                ${opsEsc(t.nombre)}${t.puesto ? ` — <span style="color:#94a3b8;">${opsEsc(t.puesto)}</span>` : ""}
                                ${ausencia ? `<span style="color:#E7402B;font-weight:600;">— ${opsEsc(ausencia.tipo || "ausente")} hasta ${opsEsc(ausencia.fechaFin)}</span>` : ""}
                            </label>`;
                        }).join("")}
                    </div>
                    <div style="font-size:10px;color:#94a3b8;margin:0 0 14px;">Los técnicos en gris están de vacaciones/permiso en la fecha del folio — no se pueden marcar.</div>
                </div>

                <div style="flex:1;min-width:340px;background:#fff;border-radius:12px;border-top:3px solid #15803D;box-shadow:0 1px 2px rgba(15,23,42,.04),0 4px 14px rgba(15,23,42,.06);padding:20px;">
                    <div style="font-size:13px;font-weight:700;color:#15803D;margin-bottom:16px;display:flex;align-items:center;gap:7px;">${ICON.check} Cliente, facturación y gastos</div>
                    ${secAbre("contacto")}
                    <div style="display:flex;gap:8px;">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Contacto que solicita</label>
                        <input id="ops-fol-contacto-nombre" value="${opsEsc(f?.contactoNombre || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Teléfono de contacto</label>
                        <input id="ops-fol-contacto-tel" value="${opsEsc(f?.contactoTelefono || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    </div>

                    <label style="font-size:11.5px;color:#64748b;font-weight:600;">Encargado interno de gestionar requisitos</label>
                    <input id="ops-fol-encargado" value="${opsEsc(f?.encargadoInterno || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                    ${secCierra("contacto")}

                    ${secAbre("fac")}
                    <div style="display:flex;gap:8px;">
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">A quién se factura</label>
                        <input id="ops-fol-facturar-a" value="${opsEsc(f?.facturarA || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                        <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Proyecto</label>
                        <input id="ops-fol-proyecto" value="${opsEsc(f?.proyecto || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    </div>
                    ${secCierra("fac")}

                    ${secAbre("via")}
                    <div style="background:#f0f9ff;border:1px solid #dbeefb;border-radius:10px;margin:6px 0 0;padding:14px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                            <div style="font-size:11.5px;font-weight:700;color:#1D2E73;">Calculadora de viáticos / hospedaje / casetas</div>
                            ${opsPuedeGestionar() ? `<button type="button" onclick="opsAbrirModalConfigViaticos()" style="background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px;" title="Ajustar tarifas">${ICON.gear}</button>` : ""}
                        </div>
                        <div style="display:flex;gap:8px;">
                            <div style="flex:1;"><label style="font-size:11px;color:#64748b;font-weight:600;">Días de viaje</label>
                            <input type="number" min="0" step="1" id="ops-fol-dias-viaje" value="${f?.diasTrabajo ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div style="flex:1;"><label style="font-size:11px;color:#64748b;font-weight:600;">Km estimados (opcional)</label>
                            <input type="number" min="0" step="1" id="ops-fol-km" value="${f?.kmEstimados ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                        </div>
                        <button type="button" onclick="opsCalcularViaticos()" class="mkt-add-btn" style="background:#0e7490;width:100%;margin:8px 0 4px;">${ICON.sparkle} Calcular automático</button>
                        <div id="ops-fol-viaticos-fuente" style="font-size:10px;color:#94a3b8;margin-bottom:8px;min-height:12px;"></div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Viáticos ($)</label>
                            <input type="number" min="0" step="0.01" id="ops-fol-viaticos-monto" value="${f?.viaticosMonto ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Hospedaje ($)</label>
                            <input type="number" min="0" step="0.01" id="ops-fol-hospedaje-monto" value="${f?.hospedajeMonto ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Casetas/gasolina ($, estimado)</label>
                            <input type="number" min="0" step="0.01" id="ops-fol-casetas-monto" value="${f?.casetasMonto ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;"></div>
                            <div><label style="font-size:11px;color:#64748b;font-weight:600;">Gasto total estimado ($)</label>
                            <input type="number" min="0" step="0.01" id="ops-fol-gasto" value="${f?.gastoEstimado ?? ""}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font-size:13px;margin:3px 0;font-weight:700;"></div>
                        </div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:6px;">El kilometraje ya es real (gratis, vía OSRM) cuando la estación viene del catálogo. Casetas siguen siendo un estimado por tarifa fija — ningún servicio gratuito las conoce en México. Todo aquí se puede editar a mano después de calcular.</div>
                    </div>

                    <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:#334155;margin:10px 0 8px;">
                        <input type="checkbox" id="ops-fol-viaticos-pend" ${f?.viaticosPendientes ? "checked" : ""} style="width:15px;height:15px;"> Viáticos pendientes de pago
                    </label>
                    <div style="font-size:10px;color:#94a3b8;margin:-4px 0 16px;">Contabilidad/Pagos siguen siendo quienes marcan el pago real — esto aquí es solo la bandera de "está pendiente" ligada al folio.</div>
                    ${secCierra("via")}
                </div>

                </div>

                <div style="display:flex;justify-content:space-between;gap:8px;padding-top:20px;margin-top:4px;">
                    ${f ? `<button onclick="opsEliminarFolio('${f.id}')" style="background:#fef2f2;border:none;color:#E7402B;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Eliminar</button>` : "<span></span>"}
                    <div style="display:flex;gap:8px;">
                        <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                        <button onclick="opsGuardarFolio('${id || ""}')" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
                    </div>
                </div>
            </div>
        </div>`;
        window.opsFolioActualizarVencimientoPreview();
        window.__opsFolioEstMeta = f?.estacionCatalogoId ? {
            catalogoId: f.estacionCatalogoId, encargado: f.estacionEncargado || null, zona: f.estacionZona || null,
            numeroTanques: f.estacionNumeroTanques || null, numeroDispensarios: f.estacionNumeroDispensarios || null,
            numeroSondas: f.estacionNumeroSondas || null, direccion: f.estacionDireccion || null,
            razonSocial: f.estacionRazonSocial || null, permiso: f.estacionPermiso || null, cr: f.estacionCR || null,
            lat: f.estacionLat ?? null, lng: f.estacionLng ?? null,
        } : null;
    };

    // ── Sugerencia de técnicos: cruza rol requerido por la receta del servicio
    // contra habilidades del técnico, y descarta a quien tenga ausencia registrada
    // ese día o ya esté asignado a OTRO folio con la misma fecha programada. ──
    window.opsFolioSugerirTecnicos = function (folioIdActual, marcar) {
        const nota = document.getElementById("ops-fol-sugerencia-nota");
        const servicioId = document.getElementById("ops-fol-servicio")?.value;
        const fechaProg = document.getElementById("ops-fol-programada")?.value;
        if (!nota) return;
        if (!servicioId) { nota.textContent = "Elige un servicio del catálogo para poder sugerir técnicos."; return; }
        const receta = cacheServiciosCatalogo.find(s => s.id === servicioId);
        const rolesReq = (receta?.personal || []).map(p => p.rol);
        if (!rolesReq.length) { nota.textContent = "Esa receta todavía no tiene roles de personal capturados."; return; }

        const fechaDia = fechaProg ? fechaProg.slice(0, 10) : null;
        const ausentesHoy = new Set(
            fechaDia ? cacheAusencias.filter(a => a.fechaInicio <= fechaDia && a.fechaFin >= fechaDia).map(a => a.tecnicoId) : []
        );
        const ocupadosHoy = new Set(
            fechaDia ? cacheFolios.filter(f => f.id !== folioIdActual && (f.fechaProgramada || "").slice(0, 10) === fechaDia)
                .flatMap(f => f.tecnicosAsignadosIds || []) : []
        );

        const candidatos = cacheTec.filter(t => t.estatus === "activo" && !opsEsAdministrativo(t) && (t.habilidades || []).some(h => rolesReq.includes(h)));
        const disponibles = candidatos.filter(t => !ausentesHoy.has(t.id) && !ocupadosHoy.has(t.id));
        const noDisponibles = candidatos.filter(t => ausentesHoy.has(t.id) || ocupadosHoy.has(t.id));

        nota.innerHTML = `Roles que pide la receta: <strong>${rolesReq.join(", ")}</strong>. `
            + `${disponibles.length} técnico(s) con esa habilidad y disponibles${fechaDia ? " ese día" : " (sin fecha capturada, no se valida disponibilidad)"}.`
            + (noDisponibles.length ? ` ${noDisponibles.length} más tienen la habilidad pero están ausentes u ocupados ese día.` : "");

        if (marcar) {
            document.querySelectorAll(".ops-fol-tec-check").forEach(chk => { chk.checked = disponibles.some(t => t.id === chk.value); });
        }
    };

    // ── Buscador en vivo del catálogo de estaciones (reutiliza el mismo catálogo
    // que ya carga Almacén — window.tcCargarCatalogoEstaciones, colección
    // estaciones_servicio) para autocompletar encargado/zona/equipo al crear un folio. ──
    window.opsFolioBuscarEstacion = function (valor) {
        window.__opsFolioEstMeta = null; // cualquier tecleo posterior invalida la selección previa
        const info = document.getElementById("ops-fol-estacion-info");
        if (info) info.innerHTML = "";
        const box = document.getElementById("ops-fol-estacion-results");
        if (!box) return;
        if (!valor || valor.trim().length < 2 || !window.tcCargarCatalogoEstaciones) { box.style.display = "none"; return; }
        window.tcCargarCatalogoEstaciones().then(lista => {
            const q = valor.toLowerCase();
            const filtradas = (lista || []).filter(e => [e.razonSocial, e.nombreComercial, e.municipio, e.permiso, e.zona].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 8);
            window.__opsFolioEstListaTmp = filtradas;
            if (!filtradas.length) { box.innerHTML = '<div style="padding:9px 11px;color:#94a3b8;font-size:11.5px;">Sin resultados en el catálogo — puedes dejarlo como texto libre.</div>'; box.style.display = "block"; return; }
            box.innerHTML = filtradas.map(e => `
                <div onmousedown="window.opsFolioSeleccionarEstacion('${e.id}')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #eef2f7;">
                    <div style="font-size:12px;font-weight:700;color:#0f172a;">${opsEsc(e.nombreComercial || e.razonSocial)}</div>
                    <div style="font-size:10.5px;color:#64748b;">${opsEsc(e.municipio || "")}${e.encargado ? " · " + opsEsc(e.encargado) : ""}${e.zona ? " · Zona " + opsEsc(e.zona) : ""}</div>
                </div>`).join("");
            box.style.display = "block";
        });
    };

    window.opsFolioSeleccionarEstacion = function (catalogoId) {
        const e = (window.__opsFolioEstListaTmp || []).find(x => x.id === catalogoId);
        if (!e) return;
        const input = document.getElementById("ops-fol-estacion");
        if (input) input.value = e.nombreComercial || e.razonSocial || "";
        window.__opsFolioEstMeta = {
            catalogoId: e.id, encargado: e.encargado || null, zona: e.zona || null,
            numeroTanques: e.numeroTanques || null, numeroDispensarios: e.numeroDispensarios || null,
            numeroSondas: e.numeroSondas || null, direccion: e.direccionNormalizada || null,
            razonSocial: e.razonSocial || null, permiso: e.permiso || null, cr: e.cr || null,
            lat: e.lat ?? null, lng: e.lng ?? null,
        };
        const info = document.getElementById("ops-fol-estacion-info");
        if (info) info.innerHTML = `Del catálogo${e.encargado ? " · Encargado: " + opsEsc(e.encargado) : ""}${e.zona ? " · Zona " + opsEsc(e.zona) : ""}${e.numeroTanques ? " · " + e.numeroTanques + " tanque(s)" : ""}`;
        const box = document.getElementById("ops-fol-estacion-results");
        if (box) box.style.display = "none";
    };

    // ═══════════════════ Programa de inspectores — alta rápida multi-estación ═══════════════════
    // Reemplaza el Excel manual (INSPECTOR, SERVICIO, ESTACIÓN, PERMISO, FECHA) que Glen ya
    // usaba: se arma la lista de estaciones a visitar ese día y se crea UN folio por estación,
    // todos con el mismo técnico/fecha/Norma — así ya funcionan sugerencias, SLA y arrastrar/soltar.
    let opsVisitaInspeccionEstaciones = []; // lista temporal mientras se arma el alta

    window.opsAbrirModalVisitaInspeccion = function () {
        opsVisitaInspeccionEstaciones = [];
        const tecnicosActivos = opsTecOperativos();
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:480px;max-width:94vw;max-height:90vh;overflow-y:auto;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:4px;">Programar visita de inspección</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:14px;">Arma la lista de estaciones que va a visitar ese día — se crea un folio por cada una, con la misma fecha, técnico y Norma.</div>

                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Inspector (técnico)</label>
                    <select id="ops-vi-tecnico" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        ${tecnicosActivos.map(t => `<option value="${t.id}">${opsEsc(t.nombre)}</option>`).join("")}
                    </select></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Norma / servicio</label>
                    <select id="ops-vi-norma" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                        ${OPS_NORMAS_INSPECCION.map(n => `<option value="${opsEsc(n)}">${opsEsc(n)}</option>`).join("")}
                    </select></div>
                </div>
                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Fecha</label>
                    <input type="date" id="ops-vi-fecha" value="${opsHoy()}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Hora de inicio</label>
                    <input type="time" id="ops-vi-hora" value="08:00" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>

                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Agregar estaciones a visitar</label>
                <div style="position:relative;">
                    <input id="ops-vi-buscar" placeholder="Busca en el catálogo…" oninput="window.opsViBuscarEstacion(this.value)" onblur="setTimeout(()=>{const b=document.getElementById('ops-vi-resultados');if(b)b.style.display='none';},150)" autocomplete="off" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 6px;">
                    <div id="ops-vi-resultados" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #cbd5e1;border-radius:8px;max-height:180px;overflow-y:auto;z-index:20;box-shadow:0 8px 24px rgba(2,20,50,.14);"></div>
                </div>
                <div id="ops-vi-lista" style="display:flex;flex-direction:column;gap:6px;margin:8px 0 16px;"></div>

                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarVisitaInspeccion()" class="mkt-add-btn" style="background:#0e7490;">Crear folios</button>
                </div>
            </div>
        </div>`;
    };

    window.opsViBuscarEstacion = function (valor) {
        const box = document.getElementById("ops-vi-resultados");
        if (!box) return;
        if (!valor || valor.trim().length < 2 || !window.tcCargarCatalogoEstaciones) { box.style.display = "none"; return; }
        window.tcCargarCatalogoEstaciones().then(lista => {
            const q = valor.toLowerCase();
            const yaAgregadas = new Set(opsVisitaInspeccionEstaciones.map(e => e.id));
            const filtradas = (lista || []).filter(e => !yaAgregadas.has(e.id) && [e.razonSocial, e.nombreComercial, e.municipio, e.permiso, e.zona].filter(Boolean).join(" ").toLowerCase().includes(q)).slice(0, 8);
            window.__opsViListaTmp = filtradas;
            if (!filtradas.length) { box.innerHTML = '<div style="padding:9px 11px;color:#94a3b8;font-size:11.5px;">Sin resultados.</div>'; box.style.display = "block"; return; }
            box.innerHTML = filtradas.map(e => `
                <div onmousedown="window.opsViAgregarEstacion('${e.id}')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid #eef2f7;">
                    <div style="font-size:12px;font-weight:700;color:#0f172a;">${opsEsc(e.nombreComercial || e.razonSocial)}</div>
                    <div style="font-size:10.5px;color:#64748b;">${opsEsc(e.municipio || "")}${e.permiso ? " · " + opsEsc(e.permiso) : ""}</div>
                </div>`).join("");
            box.style.display = "block";
        });
    };

    window.opsViAgregarEstacion = function (catalogoId) {
        const e = (window.__opsViListaTmp || []).find(x => x.id === catalogoId);
        if (!e || opsVisitaInspeccionEstaciones.some(x => x.id === e.id)) return;
        opsVisitaInspeccionEstaciones.push(e);
        document.getElementById("ops-vi-buscar").value = "";
        document.getElementById("ops-vi-resultados").style.display = "none";
        opsViRenderLista();
    };

    window.opsViQuitarEstacion = function (catalogoId) {
        opsVisitaInspeccionEstaciones = opsVisitaInspeccionEstaciones.filter(e => e.id !== catalogoId);
        opsViRenderLista();
    };

    function opsViRenderLista() {
        const el = document.getElementById("ops-vi-lista");
        if (!el) return;
        el.innerHTML = opsVisitaInspeccionEstaciones.map(e => `
            <div style="display:flex;align-items:center;gap:8px;background:#f0f9ff;border-radius:8px;padding:6px 10px;">
                <div style="flex:1;font-size:12px;color:#0e7490;font-weight:600;">${opsEsc(e.nombreComercial || e.razonSocial)}${e.permiso ? ` <span style="color:#64748b;font-weight:400;">· ${opsEsc(e.permiso)}</span>` : ""}</div>
                <button onclick="opsViQuitarEstacion('${e.id}')" style="background:none;border:none;color:#0e7490;cursor:pointer;">${ICON.close}</button>
            </div>`).join("") || `<div style="color:#94a3b8;font-size:11.5px;">Todavía no agregas ninguna estación.</div>`;
    }

    window.opsGuardarVisitaInspeccion = async function () {
        if (!opsVisitaInspeccionEstaciones.length) { alert("Agrega al menos una estación."); return; }
        const tecnicoId = document.getElementById("ops-vi-tecnico").value;
        const tec = cacheTec.find(t => t.id === tecnicoId);
        if (!tec) { alert("Selecciona un inspector."); return; }
        const norma = document.getElementById("ops-vi-norma").value;
        const fecha = document.getElementById("ops-vi-fecha").value;
        const hora = document.getElementById("ops-vi-hora").value || "08:00";
        if (!fecha) { alert("Selecciona una fecha."); return; }
        const fechaProgramada = `${fecha}T${hora}`;
        const esSCFI = norma === "SCFI";

        try {
            const { db, fs } = await opsGetFB();
            for (const e of opsVisitaInspeccionEstaciones) {
                const datos = {
                    folioOS: "", estacion: e.nombreComercial || e.razonSocial || "",
                    estacionCatalogoId: e.id, estacionEncargado: e.encargado || null, estacionZona: e.zona || null,
                    estacionNumeroTanques: e.numeroTanques || null, estacionNumeroDispensarios: e.numeroDispensarios || null,
                    estacionNumeroSondas: e.numeroSondas || null, estacionDireccion: e.direccionNormalizada || null,
                    estacionRazonSocial: e.razonSocial || null, estacionPermiso: e.permiso || null, estacionCR: e.cr || null,
                    esSCFI, hologramas: null, precintos: null, distintivos: null, viaticos: null,
                    comentarios: null, clienteId: null, clienteNombre: null, prioridad: null,
                    fechaSolicitud: opsFechaHora(), vencimiento: null, fechaAtencion: null, fechaSolucion: null,
                    tecnicoResponsableId: tecnicoId, tecnicoResponsableNombre: tec.nombre, tecnicoResponsableCorreo: tec.correo || null,
                    responsable: tec.nombre,
                    tipoFolio: "inspeccion", normaInspeccion: norma, servicioCatalogoId: null,
                    fechaProgramada, tiempoEjecucionHrs: null, tiempoTrasladoHrs: null,
                    tecnicosAsignadosIds: [tecnicoId], tecnicosAsignadosNombres: [tec.nombre],
                    contactoNombre: null, contactoTelefono: null, encargadoInterno: null, facturarA: null,
                    proyecto: null, gastoEstimado: null, viaticosPendientes: false, viaticosMonto: null,
                    origen: "programa_inspectores", creadoPor: opsNombreActual(), creadoEn: opsFechaHora(),
                };
                const nuevo = await fs.addDoc(fs.collection(db, COL_FOLIOS), datos);
                await fs.addDoc(fs.collection(db, COL_FOLIOS, nuevo.id, "comentarios"), {
                    texto: `Folio de inspección (${norma}) capturado por ${opsNombreActual()} para ${tec.nombre}, programado el ${opsFmtFechaCorta(fechaProgramada)}.`,
                    autor: opsNombreActual(), autorEmail: opsUsuarioActual(), tipo: "captura",
                    createdAt: fs.serverTimestamp ? fs.serverTimestamp() : opsFechaHora(),
                });
            }
            const snap = await fs.getDocs(fs.collection(db, COL_FOLIOS));
            cacheFolios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            document.getElementById("ops-modal-wrap").innerHTML = "";
            opsRenderCalendario();
            if (window.mostrarPush) window.mostrarPush("Operaciones", `${opsVisitaInspeccionEstaciones.length} folio(s) de inspección creados.`, "✅");
        } catch (e) {
            console.error("[opsGuardarVisitaInspeccion]", e);
            alert("No se pudo guardar: " + e.message);
        }
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

        const cliente = clienteId ? cacheClientes.find(c => c.id === clienteId) : null;
        const tecnicosAsignadosIds = Array.from(document.querySelectorAll(".ops-fol-tec-check:checked")).map(c => c.value);
        const tecnicosAsignadosNombres = Array.from(document.querySelectorAll(".ops-fol-tec-check:checked")).map(c => c.dataset.nombre);
        const tipoFolioNuevo = document.getElementById("ops-fol-tipo").value || "servicio";
        const folioAnterior = id ? cacheFolios.find(x => x.id === id) : null;
        const eraLaboratorioAntes = folioAnterior?.tipoFolio === "laboratorio";

        const datos = {
            folioOS: document.getElementById("ops-fol-os").value.trim(),
            estacion,
            estacionCatalogoId: window.__opsFolioEstMeta?.catalogoId || null,
            estacionEncargado: window.__opsFolioEstMeta?.encargado || null,
            estacionZona: window.__opsFolioEstMeta?.zona || null,
            estacionNumeroTanques: window.__opsFolioEstMeta?.numeroTanques || null,
            estacionNumeroDispensarios: window.__opsFolioEstMeta?.numeroDispensarios || null,
            estacionNumeroSondas: window.__opsFolioEstMeta?.numeroSondas || null,
            estacionDireccion: window.__opsFolioEstMeta?.direccion || null,
            estacionRazonSocial: window.__opsFolioEstMeta?.razonSocial || null,
            estacionPermiso: window.__opsFolioEstMeta?.permiso || null,
            estacionCR: window.__opsFolioEstMeta?.cr || null,
            estacionLat: window.__opsFolioEstMeta?.lat ?? null,
            estacionLng: window.__opsFolioEstMeta?.lng ?? null,
            esSCFI: document.getElementById("ops-fol-es-scfi").checked,
            seccionesAplica: [...(window.__opsFolioSecciones || [])],
            hologramas: document.getElementById("ops-fol-hologramas").value ? Number(document.getElementById("ops-fol-hologramas").value) : null,
            precintos: document.getElementById("ops-fol-precintos").value ? Number(document.getElementById("ops-fol-precintos").value) : null,
            distintivos: document.getElementById("ops-fol-distintivos").value ? Number(document.getElementById("ops-fol-distintivos").value) : null,
            viaticos: document.getElementById("ops-fol-viaticos").value ? Number(document.getElementById("ops-fol-viaticos").value) : null,
            comentarios: document.getElementById("ops-fol-comentarios").value.trim(),
            clienteId, clienteNombre, prioridad,
            fechaSolicitud, vencimiento,
            fechaAtencion: document.getElementById("ops-fol-atencion").value || null,
            fechaSolucion: document.getElementById("ops-fol-solucion").value || null,
            tecnicoResponsableId,
            tecnicoResponsableNombre: tec?.nombre || null,
            tecnicoResponsableCorreo: tec?.correo || null,
            responsable: tec?.nombre || document.getElementById("ops-fol-responsable-texto").value.trim() || null,
            // ── Fase 5: programación / equipo / comercial ──
            tipoFolio: tipoFolioNuevo,
            normaInspeccion: tipoFolioNuevo === "inspeccion" ? (document.getElementById("ops-fol-norma")?.value || null) : null,
            servicioCatalogoId: document.getElementById("ops-fol-servicio").value || null,
            categoriaServicio: (() => { const sel = document.getElementById("ops-fol-servicio"); return sel.selectedOptions[0]?.dataset.categoria || null; })(),
            fechaProgramada: document.getElementById("ops-fol-programada").value || null,
            tiempoEjecucionHrs: document.getElementById("ops-fol-tiempo-ejec").value ? Number(document.getElementById("ops-fol-tiempo-ejec").value) : null,
            tiempoTrasladoHrs: document.getElementById("ops-fol-tiempo-trasl").value ? Number(document.getElementById("ops-fol-tiempo-trasl").value) : null,
            tecnicosAsignadosIds, tecnicosAsignadosNombres,
            contactoNombre: document.getElementById("ops-fol-contacto-nombre").value.trim() || (cliente?.contactoNombre || null),
            contactoTelefono: document.getElementById("ops-fol-contacto-tel").value.trim() || (cliente?.contactoTelefono || null),
            encargadoInterno: document.getElementById("ops-fol-encargado").value.trim() || null,
            facturarA: document.getElementById("ops-fol-facturar-a").value.trim() || (cliente?.facturarA || null),
            proyecto: document.getElementById("ops-fol-proyecto").value.trim() || null,
            gastoEstimado: document.getElementById("ops-fol-gasto").value ? Number(document.getElementById("ops-fol-gasto").value) : null,
            diasTrabajo: document.getElementById("ops-fol-dias-viaje").value ? Number(document.getElementById("ops-fol-dias-viaje").value) : null,
            kmEstimados: document.getElementById("ops-fol-km").value ? Number(document.getElementById("ops-fol-km").value) : null,
            hospedajeMonto: document.getElementById("ops-fol-hospedaje-monto").value ? Number(document.getElementById("ops-fol-hospedaje-monto").value) : null,
            casetasMonto: document.getElementById("ops-fol-casetas-monto").value ? Number(document.getElementById("ops-fol-casetas-monto").value) : null,
            viaticosPendientes: document.getElementById("ops-fol-viaticos-pend").checked,
            viaticosMonto: document.getElementById("ops-fol-viaticos-monto").value ? Number(document.getElementById("ops-fol-viaticos-monto").value) : null,
        };
        if (id) {
            await fs.updateDoc(fs.doc(db, COL_FOLIOS, id), datos);
            if (tipoFolioNuevo === "laboratorio" && !eraLaboratorioAntes) await opsNotificarFolioLaboratorio({ id, ...datos });
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
            if (tipoFolioNuevo === "laboratorio") await opsNotificarFolioLaboratorio({ id: nuevo.id, ...datos });
        }
        document.getElementById("ops-modal-wrap").innerHTML = "";
        if (window.mostrarPush) mostrarPush("Operaciones", "Folio guardado.", "📋"); else alert("Folio guardado.");
    };

    // Notificación automática para folios de Laboratorio — misma colección que ya
    // usa el resto del módulo (ops_notificaciones), mismo nombre de campo de fecha
    // ("fecha", no "creadaEn") para que la campanita la lea igual que las demás.
    // OJO — límite real: esto es la campanita DENTRO de Operaciones, no un correo o
    // push externo. Si Denisse/Paloma no tienen Operaciones abierto, no la ven aquí;
    // el portal no tiene envío de correo real todavía.
    async function opsNotificarFolioLaboratorio(f) {
        try {
            const { db, fs } = await opsGetFB();
            const mensaje = `Nuevo folio de Laboratorio: ${f.folioOS ? "O.S. " + f.folioOS + " — " : ""}${f.estacion}${f.clienteNombre ? " (" + f.clienteNombre + ")" : ""}.`;
            for (const correo of OPS_NOTIF_LABORATORIO) {
                await fs.addDoc(fs.collection(db, COL_NOTIFICACIONES), {
                    tipo: "ops_folio_laboratorio", para: correo, mensaje, folioId: f.id,
                    leida: false, fecha: opsFechaHora(),
                });
            }
        } catch (e) { console.warn("[Folios] No se pudo notificar Laboratorio:", e.message); }
    }

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
                ${esPosteriorCompromiso ? `<div style="font-size:9.5px;font-weight:700;color:#E7402B;text-transform:uppercase;letter-spacing:.3px;margin:2px 0;display:flex;align-items:center;gap:4px;">${ICON.alert} Posterior a la fecha de atención comprometida</div>` : ""}
                ${c.tipo === "captura" ? `<div style="font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.3px;margin:2px 0;display:flex;align-items:center;gap:4px;">${ICON.file} Captura inicial</div>` : ""}
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
        // Cuenta como "evidencia" para la alerta de 3 días — cualquier comentario
        // nuevo reinicia el conteo, no solo fotos (hoy los folios no tienen un
        // campo de evidencia separado; esto es lo más cercano que existe).
        await fs.updateDoc(fs.doc(db, COL_FOLIOS, folioId), { ultimaEvidenciaEn: opsFechaHora() });
        if (ta) ta.value = "";
        const f = cacheFolios.find(x => x.id === folioId);
        if (f) f.ultimaEvidenciaEn = opsFechaHora();
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
                <div style="display:flex;gap:8px;">
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Contacto (quién solicita)</label>
                    <input id="ops-cli-contacto-nombre" value="${opsEsc(c?.contactoNombre || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                    <div style="flex:1;"><label style="font-size:11.5px;color:#64748b;font-weight:600;">Teléfono de contacto</label>
                    <input id="ops-cli-contacto-tel" value="${opsEsc(c?.contactoTelefono || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;"></div>
                </div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">A quién se factura (por defecto para folios de este cliente)</label>
                <input id="ops-cli-facturar-a" value="${opsEsc(c?.facturarA || "")}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
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
            contactoNombre: document.getElementById("ops-cli-contacto-nombre").value.trim() || null,
            contactoTelefono: document.getElementById("ops-cli-contacto-tel").value.trim() || null,
            facturarA: document.getElementById("ops-cli-facturar-a").value.trim() || null,
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
    let filtroSolic = "operaciones"; // por defecto solo lo que se solicitó desde Operaciones — "Todas" sigue disponible como botón si algún día hace falta ver también lo de otros departamentos
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
                    : `<button onclick="opsImprimirSolicitud('${s.id}')" title="Imprimir PDF" style="background:#f1f5f9;border:none;color:#334155;width:26px;height:26px;border-radius:7px;cursor:pointer;margin-right:4px;display:inline-flex;align-items:center;justify-content:center;">${ICON.printer}</button>
                       <button onclick="opsWhatsAppSolicitud('${s.id}')" title="Enviar por WhatsApp" style="background:#f0fdf4;border:none;color:#16a34a;width:26px;height:26px;border-radius:7px;cursor:pointer;margin-right:4px;display:inline-flex;align-items:center;justify-content:center;">${ICON.chat}</button>
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
                    <button onclick="opsImprimirSolicitud('${s.id}')" style="background:#f1f5f9;border:none;color:#334155;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.printer} Imprimir PDF</button>
                    <button onclick="opsWhatsAppSolicitud('${s.id}')" style="background:#f0fdf4;border:none;color:#16a34a;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.chat} Enviar por WhatsApp</button>
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
        const gestion = opsPuedeGestionar();
        const cfg = cacheConfigAlertas;
        const hoy = new Date();
        const enDias = (fecha) => { if (!fecha) return null; const d = new Date(fecha); return (d - hoy) / 86400000; };

        // ── Anticipación (avisa ANTES de que sea crítico, no cuando ya lo es) ──
        const proximaGuardia = [];
        cacheGuardiasProgramadas.filter(g => g.semanaInicio >= opsLunesDe(hoy)).forEach(g => {
            const dias = enDias(g.semanaInicio + "T00:00:00");
            if (dias !== null && dias >= 0 && dias <= cfg.anticipacionGuardiaDias) proximaGuardia.push(`${opsNombreTecnico(g.tecnicoId)} entra de guardia el ${opsFechaCorta(g.semanaInicio)} (en ${Math.ceil(dias)} día(s)).`);
        });
        const proximaAusencia = [];
        cacheAusencias.filter(a => a.fechaInicio >= opsHoy()).forEach(a => {
            const dias = enDias(a.fechaInicio + "T00:00:00");
            if (dias !== null && dias >= 0 && dias <= cfg.anticipacionAusenciaDias) proximaAusencia.push(`${opsNombreTecnico(a.tecnicoId)} se ausenta desde el ${opsFechaCorta(a.fechaInicio)} (en ${Math.ceil(dias)} día(s)) — repartir su carga a tiempo.`);
        });
        const proximoFolio = [];
        cacheFolios.filter(f => !f.fechaSolucion && f.source !== OPS_DEMO_SOURCE).forEach(f => {
            const fechaLimite = f.fechaAtencion || f.vencimiento;
            const dias = enDias(fechaLimite);
            if (dias !== null && dias >= 0 && dias <= cfg.anticipacionFolioDias) proximoFolio.push(`Folio ${f.folioOS ? "O.S. " + f.folioOS + " — " : ""}${f.estacion}: vence en ${dias < 1 ? "menos de 1 día" : Math.ceil(dias) + " día(s)"}.`);
        });
        const revisionVencida = [];
        cacheHerr.filter(h => h.estado === "asignada").forEach(h => {
            const ultimaRev = cacheRevisionesHerr.filter(r => r.herramientaId === h.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];
            const fechaBase = ultimaRev?.fecha || h.fechaAsignacion || h.fechaAlta;
            if (!fechaBase) return;
            const diasSinRevisar = (hoy - new Date(fechaBase)) / 86400000;
            if (diasSinRevisar >= cfg.anticipacionRevisionHerrDias) revisionVencida.push(`${h.folio} (${h.descripcion}) — ${Math.floor(diasSinRevisar)} días sin revisión física.`);
        });

        function bloqueAnticipacion(titulo, items, color) {
            if (!items.length) return "";
            return `<div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:10px;border-left:3px solid ${color};">
                <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:8px;">${titulo} (${items.length})</div>
                ${items.map(txt => `<div style="font-size:12px;color:#334155;padding:5px 0;border-bottom:1px solid #f8fafc;">${opsEsc(txt)}</div>`).join("")}
            </div>`;
        }
        const anticipacionHtml = [
            bloqueAnticipacion("Guardia próxima", proximaGuardia, "#7c3aed"),
            bloqueAnticipacion("Ausencia próxima — repartir carga", proximaAusencia, "#0891b2"),
            bloqueAnticipacion("Folio por vencer pronto", proximoFolio, "#b45309"),
            bloqueAnticipacion("Herramienta sin revisar hace tiempo", revisionVencida, "#64748b"),
        ].join("");
        const totalAnticipacion = proximaGuardia.length + proximaAusencia.length + proximoFolio.length + revisionVencida.length;

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
                <div style="font-size:11.5px;color:#64748b;max-width:520px;display:flex;align-items:center;gap:6px;">${ICON.bell} Prueba el sistema de alertas: genera una notificación real que suena (~10s) y aparece como ventana flotante en <b>todas</b> las sesiones de Operaciones abiertas ahora mismo.</div>
                <div style="display:flex;gap:8px;">
                    ${gestion ? `<button onclick="opsAbrirModalConfigAlertas()" style="background:#f1f5f9;border:none;color:#334155;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">${ICON.gear} Ajustar anticipación</button>` : ""}
                    <button onclick="opsProbarAlerta()" style="background:#6d28d9;border:none;color:#fff;padding:9px 16px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:6px;">${ICON.bell} Probar alerta</button>
                </div>
            </div>
            <div style="font-size:11.5px;font-weight:700;color:#1e293b;margin-bottom:8px;">Próximamente (${totalAnticipacion}) — antes de que se vuelva crítico</div>
            ${totalAnticipacion ? anticipacionHtml : `<div style="background:#fff;border-radius:12px;padding:14px 16px;margin-bottom:14px;color:#94a3b8;font-size:12px;">Nada próximo dentro de la ventana de anticipación configurada.</div>`}
            <div style="font-size:11.5px;font-weight:700;color:#1e293b;margin:16px 0 8px;">Ya requiere atención</div>`
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

    window.opsAbrirModalConfigAlertas = function () {
        const cfg = cacheConfigAlertas;
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:420px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:6px;">Ajustar anticipación de alertas</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:16px;">Cuántos días antes quieres que te avise de cada cosa, antes de que se vuelva crítico.</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Guardia próxima (días antes de que empiece)</label>
                <input id="ops-cfg-al-guardia" type="number" min="0" max="60" value="${cfg.anticipacionGuardiaDias}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Ausencia próxima (días antes de que se ausente)</label>
                <input id="ops-cfg-al-ausencia" type="number" min="0" max="60" value="${cfg.anticipacionAusenciaDias}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Folio por vencer (días antes de la fecha comprometida)</label>
                <input id="ops-cfg-al-folio" type="number" min="0" max="30" value="${cfg.anticipacionFolioDias}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Herramienta sin revisar (días sin revisión física)</label>
                <input id="ops-cfg-al-revision" type="number" min="0" max="365" value="${cfg.anticipacionRevisionHerrDias}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 16px;">
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarConfigAlertas()" class="mkt-add-btn" style="background:#1D2E73;">Guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarConfigAlertas = async function () {
        const datos = {
            anticipacionGuardiaDias: Number(document.getElementById("ops-cfg-al-guardia").value) || 0,
            anticipacionAusenciaDias: Number(document.getElementById("ops-cfg-al-ausencia").value) || 0,
            anticipacionFolioDias: Number(document.getElementById("ops-cfg-al-folio").value) || 0,
            anticipacionRevisionHerrDias: Number(document.getElementById("ops-cfg-al-revision").value) || 0,
        };
        try {
            const { db, fs } = await opsGetFB();
            await fs.setDoc(fs.doc(db, COL_CONFIG_ALERTAS, "general"), datos, { merge: true });
            cacheConfigAlertas = { ...cacheConfigAlertas, ...datos };
            document.getElementById("ops-modal-wrap").innerHTML = "";
            opsRenderAlertas();
        } catch (e) {
            console.error("[opsGuardarConfigAlertas]", e);
            alert("No se pudo guardar: " + e.message);
        }
    };

    // ══════════════════ Calculadora de viáticos/hospedaje/casetas ══════════════════
    window.opsCalcularViaticos = async function () {
        const dias = Number(document.getElementById("ops-fol-dias-viaje").value) || 0;
        let km = Number(document.getElementById("ops-fol-km").value) || 0;
        if (!dias) { alert("Captura cuántos días de viaje son para poder calcular."); return; }
        const cfg = cacheConfigViaticos;
        const noches = Math.max(0, dias - 1);
        const viaticos = dias * cfg.viaticoDiario;
        const hospedaje = noches * cfg.hospedajePorNoche;

        let kmReal = false;
        let fuenteNota = "Estimado por tarifa fija (km capturados a mano).";
        const destino = window.__opsFolioEstMeta?.lat != null ? { lat: window.__opsFolioEstMeta.lat, lng: window.__opsFolioEstMeta.lng } : null;
        if (destino && cfg.origenBaseDireccion) {
            const ruta = await window.opsGpsProvider.calcularRuta(cfg.origenBaseDireccion, destino);
            if (ruta) {
                km = ruta.distanciaKm;
                kmReal = true;
                fuenteNota = `Distancia real (OSRM) — ${ruta.distanciaKm} km. Casetas siguen siendo estimado por tarifa (ningún servicio gratuito las conoce en México).`;
                document.getElementById("ops-fol-km").value = km;
            }
        }
        const casetas = km > 0 ? Math.round((km / 100) * cfg.casetaPromedioPorTrayecto) : cfg.casetaPromedioPorTrayecto;

        const gasolina = Math.round(km * cfg.costoPorKm);
        const total = viaticos + hospedaje + casetas + (km > 0 ? gasolina : 0);
        document.getElementById("ops-fol-viaticos-monto").value = viaticos;
        document.getElementById("ops-fol-hospedaje-monto").value = hospedaje;
        document.getElementById("ops-fol-casetas-monto").value = casetas + (km > 0 ? gasolina : 0);
        document.getElementById("ops-fol-gasto").value = total;
        const nota = document.getElementById("ops-fol-viaticos-fuente");
        if (nota) nota.textContent = fuenteNota;
    };

    window.opsAbrirModalConfigViaticos = function () {
        const cfg = cacheConfigViaticos;
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:999999;display:flex;align-items:center;justify-content:center;">
            <div style="background:#fff;border-radius:14px;width:400px;max-width:92vw;padding:22px;">
                <div style="font-weight:700;font-size:15px;color:#1e293b;margin-bottom:6px;">Tarifas de la calculadora</div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:16px;">Se usan para calcular viáticos/hospedaje/casetas en cualquier folio. Cámbialas aquí y aplican para todos.</div>
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Viático diario ($ por día)</label>
                <input id="ops-cfg-vi-viatico" type="number" min="0" step="0.01" value="${cfg.viaticoDiario}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Hospedaje ($ por noche)</label>
                <input id="ops-cfg-vi-hospedaje" type="number" min="0" step="0.01" value="${cfg.hospedajePorNoche}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Costo por km ($ — gasolina)</label>
                <input id="ops-cfg-vi-km" type="number" min="0" step="0.01" value="${cfg.costoPorKm}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Casetas estimadas ($ por cada 100 km, ida)</label>
                <input id="ops-cfg-vi-caseta" type="number" min="0" step="0.01" value="${cfg.casetaPromedioPorTrayecto}" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 12px;">
                <label style="font-size:11.5px;color:#64748b;font-weight:600;">Origen base (para calcular ruta real)</label>
                <input id="ops-cfg-vi-origen" value="${opsEsc(cfg.origenBaseDireccion || "")}" placeholder="Ej. tu oficina, Chihuahua, Chih." style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 4px;">
                <div style="font-size:10px;color:#94a3b8;margin:0 0 16px;">Con esto, la calculadora obtiene la distancia real (gratis, vía OSRM) en vez de que captures los km a mano. Las casetas siguen siendo estimado por tarifa fija.</div>
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsGuardarConfigViaticos()" class="mkt-add-btn" style="background:#0e7490;">Guardar</button>
                </div>
            </div>
        </div>`;
    };

    window.opsGuardarConfigViaticos = async function () {
        const datos = {
            viaticoDiario: Number(document.getElementById("ops-cfg-vi-viatico").value) || 0,
            hospedajePorNoche: Number(document.getElementById("ops-cfg-vi-hospedaje").value) || 0,
            costoPorKm: Number(document.getElementById("ops-cfg-vi-km").value) || 0,
            casetaPromedioPorTrayecto: Number(document.getElementById("ops-cfg-vi-caseta").value) || 0,
            origenBaseDireccion: document.getElementById("ops-cfg-vi-origen").value.trim() || null,
        };
        try {
            const { db, fs } = await opsGetFB();
            await fs.setDoc(fs.doc(db, COL_CONFIG_VIATICOS, "general"), datos, { merge: true });
            cacheConfigViaticos = { ...cacheConfigViaticos, ...datos };
            document.getElementById("ops-modal-wrap").innerHTML = "";
            if (window.mostrarPush) window.mostrarPush("Operaciones", "Tarifas actualizadas.", "✅");
        } catch (e) {
            console.error("[opsGuardarConfigViaticos]", e);
            alert("No se pudo guardar: " + e.message);
        }
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

    // ════════════ Contactos de terceros / material — Excel SERVICIOS_SISTEMA.xls ════════════
    // (Glen, sep-2026). Completa recetas ya existentes (Integridad Mecánica, Retank) sin
    // tocar su personal/herramienta/vehículos, y da de alta 10 servicios de laboratorio/
    // calibración que no existían. Las claves SERCIV/SERVEX/GST/SERV/PCRE/IMPSGM venían casi
    // vacías en el Excel (solo nombre, sin contacto ni material) — se dejaron fuera a propósito,
    // pendiente confirmar con Glen si son solo códigos de facturación o necesitan receta propia.
    function _datosTercerosServicios() {
        return [
            // ── Ya existen como receta (Paloma) — solo se completa contacto/material ──
            { recetaExistente: "Integridad Mecánica", claveServicio: "INTEGRIDAD", interaccionTercero: true,
              terceroEmpresa: "Temesa", terceroContacto: "Mariana Barba", terceroTelefono: "614 196 3913",
              terceroParaQue: "Recolección y manifiesto de residuos peligrosos",
              materialExternoNota: "Pendiente definir con Sergio" },
            { recetaExistente: "Retank", clavesVariantes: ["RETANK-S-50,000", "RETANK-S-60,000", "RETANK-S-70,000", "RETANK-S-80,000", "RETANK-S-90,000", "RETANK-S-100,000", "RETANK-D-50,000", "RETANK-D-60,000", "RETANK-D-70,000", "RETANK-D-80,000", "RETANK-D-90,000", "RETANK-D-100,000"],
              interaccionTercero: true, terceroEmpresa: "Temesa", terceroContacto: "Mariana Barba", terceroTelefono: "614 196 3913",
              terceroParaQue: "Recolección y manifiesto de residuos peligrosos",
              materialExternoNota: "Pendiente definir con Sergio. Variantes por tamaño de tanque: pared sencilla y doble pared, de 50,000 a 100,000 (ver clavesVariantes)." },

            // ── Servicios nuevos (no existían en el catálogo) ──
            { nombre: "Prueba de Hermeticidad en Línea y Tanque", claveServicio: "PH",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Roberto Alba Peña", terceroContacto: "Viridiana Tapia", terceroTelefono: "6121614561",
              terceroParaQue: "Aportación de información en sistema", materialExternoNota: "Equipo completo de PH" },
            { nombre: "Cubicación de Tanque Sonda y Termistor P", claveServicio: "CUBICA",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Alan Estrada", otroDeptoTelefono: "6275174038",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Aprotec", terceroContacto: "Dallany Chavez", terceroTelefono: "55 8425 7747",
              terceroParaQue: "Firma y entrega de certificado", materialExternoNota: "Medidor coriolis, mangueras c/ conexiones, cinta plomada, TP-7, pasta de gasolina" },
            { nombre: "Cubicación de Tanque Sonda y Termistor P (Láser)", claveServicio: "CUBICA LASER",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Alan Estrada", otroDeptoTelefono: "6275174038",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Aprotec", terceroContacto: "Dallany Chavez", terceroTelefono: "55 8425 7747",
              terceroParaQue: "Firma y entrega de certificado", materialExternoNota: "Calibex, cinta plomada, TP-7, pasta de gasolina",
              observaciones: "Descargar las tablas Excel y mandar a Alan" },
            { nombre: "Informe de Resultado de Petrolíferos", claveServicio: "INFLAB",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Denisse Gtz", otroDeptoTelefono: "6566422576",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Mexcom", terceroContacto: "Carlos García", terceroTelefono: "664 387 3587",
              terceroParaQue: "Entrega de certificado original" },
            { nombre: "Calibración de Cinta Petrolera", claveServicio: "CALCP",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Denisse Gtz", otroDeptoTelefono: "6566422576",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Aprotec", terceroContacto: "Dallany Chavez", terceroTelefono: "55 8425 7747",
              terceroParaQue: "Firma y entrega de certificado" },
            { nombre: "Calibración Termómetro TP7", claveServicio: "CALTP7",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Denisse Gtz", otroDeptoTelefono: "6566422576",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Aprotec", terceroContacto: "Dallany Chavez", terceroTelefono: "55 8425 7747",
              terceroParaQue: "Firma y entrega de certificado" },
            { nombre: "Calibración de Medidor de Alto Flujo", claveServicio: "CALMEDAF",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Alan Estrada", otroDeptoTelefono: "6275174038",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Aprotec", terceroContacto: "Dallany Chavez", terceroTelefono: "55 8425 7747",
              terceroParaQue: "Firma y entrega de certificado" },
            { nombre: "Limpieza de Tanque (Ingreso de Personal)", claveServicio: "LIMPIEZATANQUE",
              interaccionTercero: true, terceroEmpresa: "Temesa", terceroContacto: "Mariana Barba", terceroTelefono: "614 196 3913",
              terceroParaQue: "Recolección y manifiesto de residuos peligrosos", materialExternoNota: "Pendiente definir con Ulises o Sergio" },
            { nombre: "Calibración de Medida Volumétrica", claveServicio: "CALMV",
              interaccionTercero: true, terceroEmpresa: "Error Permitido", terceroContacto: "David Ontiveros", terceroTelefono: "55 2965 1500",
              terceroParaQue: "Recolección y manifiesto de residuos peligrosos", materialExternoNota: "Equipo Calibración de jarra" },
            { nombre: "Calibración de Sonda y Termistor", claveServicio: "CALST",
              interaccionOtroDepto: true, otroDeptoNombre: "Gestoria", otroDeptoContacto: "Alan Estrada", otroDeptoTelefono: "6275174038",
              interaccionTercero: true, terceroEmpresa: "Laboratorio Aprotec", terceroContacto: "Dallany Chavez", terceroTelefono: "55 8425 7747",
              terceroParaQue: "Firma y entrega de certificado", materialExternoNota: "Cinta plomada, TP-7, pasta de gasolina" },
        ];
    }

    window.opsImportarDatosTercerosServicios = async function () {
        const datos = _datosTercerosServicios();
        const nuevas = datos.filter(d => !d.recetaExistente).length;
        const completadas = datos.filter(d => d.recetaExistente).length;
        if (!confirm(`Esto completa ${completadas} receta(s) que ya existen con su contacto/material, y da de alta ${nuevas} servicio(s) nuevos de laboratorio/calibración. ¿Continuar?`)) return;
        try {
            const { db, fs } = await opsGetFB();
            let ok = 0;
            for (const d of datos) {
                let id;
                if (d.recetaExistente) {
                    id = d.recetaExistente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                    const { recetaExistente, ...campos } = d;
                    await fs.setDoc(fs.doc(db, COL_SERVICIOS_CATALOGO, id), campos, { merge: true }); // merge:true — NO toca personal/herramienta/vehículos ya cargados
                } else {
                    id = d.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
                    const yaExiste = cacheServiciosCatalogo.some(s => s.id === id);
                    const base = yaExiste ? {} : {
                        categoria: "Laboratorio y calibraciones", tipoServicio: "externo", activo: true,
                        requiereObraCivil: false, requiereVehiculo: true, requiereRemolque: false,
                        personal: [{ rol: "tecnico", cantidad: 1 }],
                        materiales: [], herramientaRequerida: [], equipoSeguridad: [],
                        vehiculos: { sugerido: { nombre: "", razon: "" }, alternos: [] },
                        notaImportacion: "Personal/herramienta puesto por defecto (1 técnico) — no venía en el Excel de contactos, revisar y ajustar.",
                    };
                    await fs.setDoc(fs.doc(db, COL_SERVICIOS_CATALOGO, id), {
                        ...base, ...d, fechaAlta: opsHoy(), creadoPor: opsNombreActual(),
                        origenImportacion: "Excel SERVICIOS_SISTEMA.xls (Glen, sep-2026)",
                    }, { merge: true });
                }
                ok++;
            }
            alert(`Listo — ${ok} servicio(s) actualizados/creados con su contacto de terceros y material.`);
        } catch (err) {
            console.error("[operaciones.js] error al importar contactos de terceros:", err);
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
                ${gestion ? `<div style="display:flex;gap:8px;"><button onclick="opsAbrirModalNuevoServicio()" class="mkt-add-btn" style="background:#1D2E73;">${ICON.plus} Nuevo servicio</button><button onclick="opsImportarRecetasReales()" class="mkt-add-btn" style="background:#15803D;">${ICON.file} Importar recetas reales (9 servicios)</button><button onclick="opsImportarDatosTercerosServicios()" class="mkt-add-btn" style="background:#7c3aed;">${ICON.file} Importar contactos/material (Excel)</button></div>` : ""}
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
                        <div style="font-size:13.5px;font-weight:700;color:#1e293b;line-height:1.3;display:flex;align-items:center;gap:7px;"><span style="width:10px;height:10px;border-radius:3px;flex-shrink:0;background:${s.colorCalendario || opsCalFamiliaDeTexto(s.nombre || "", false).color};"></span>${opsEsc(s.nombre)}</div>
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
    // Motor de cálculo (Fase 3): cantidad de unidades del servicio + días estimados,
    // solo para esta sesión de la ficha — no se guarda en la receta, es una
    // calculadora encima de ella. Personal/vehículo/herramienta NO escalan con la
    // cantidad (la misma cuadrilla hace 1 o 3 tanques); solo los materiales.
    let calculoActual = { cantidad: 1, dias: 1 };
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
        calculoActual = { cantidad: 1, dias: 1 };
        opsRenderFichaServicio();
        opsVerificarDisponibilidadServicio();
    };

    window.opsServCalcularCampo = function (campo, valor) {
        calculoActual[campo] = Math.max(0, Number(valor) || 0);
        opsRenderFichaServicio();
    };

    // Calcula cantidad/costo de cada material para la cantidad de unidades actual.
    // La regla "proporcional" y "por frecuencia" usan la MISMA multiplicación
    // (cantidadBase × cantidad) — la diferencia es solo cómo se interpreta: en
    // frecuencia, cantidadBase ya viene expresada como fracción por unidad
    // (ej. 0.1 = "1 cada 10 tanques"), así que el resultado es consumo acumulado
    // hacia el siguiente reemplazo, no una compra inmediata de una pieza completa.
    function opsCalcularMateriales(materiales, cantidad) {
        return (materiales || []).map(m => {
            const cantidadCalculada = (m.cantidadBase || 0) * cantidad;
            return { ...m, cantidadCalculada, costoCalculado: cantidadCalculada * (m.costoUnitario || 0) };
        });
    }

    function opsCalcularCostoServicio(s, cantidad, dias) {
        const materiales = opsCalcularMateriales(s.materiales, cantidad);
        const costoMateriales = materiales.reduce((acc, m) => acc + m.costoCalculado, 0);
        let costoPersonal = null; // null = no se pudo calcular (sin acceso a tarifas o sin personal capturado)
        if (Object.keys(cacheTarifasPersonal).length && (s.personal || []).length) {
            costoPersonal = (s.personal || []).reduce((acc, p) => {
                const tarifa = cacheTarifasPersonal[p.rol];
                return acc + (tarifa ? (tarifa.costoDia || 0) * (p.cantidad || 0) * dias : 0);
            }, 0);
        }
        return { materiales, costoMateriales, costoPersonal, costoTotal: costoPersonal !== null ? costoMateriales + costoPersonal : null };
    }

    function opsServSet(ruta, valor) {
        const partes = ruta.split(".");
        let obj = servicioEditDraft;
        for (let i = 0; i < partes.length - 1; i++) obj = obj[partes[i]];
        obj[partes[partes.length - 1]] = valor;
    }
    window.opsServCampo = function (ruta, valor, esNumero) { opsServSet(ruta, esNumero ? Number(valor) || 0 : valor); };
    window.opsServColorAuto = function () { if (!servicioEditDraft) return; delete servicioEditDraft.colorCalendario; opsRenderFichaServicio(); };

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

        const calculo = opsCalcularCostoServicio(s, calculoActual.cantidad, calculoActual.dias);

        const colorRecAuto = opsCalFamiliaDeTexto(s.nombre || "", false).color;
        const tabResumen = `
                <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
                    <div>
                        <div style="font-size:10.5px;color:#475569;font-weight:600;margin-bottom:4px;">Color en el Calendario</div>
                        <div style="display:flex;align-items:center;gap:8px;">
                            <input type="color" value="${opsEsc(s.colorCalendario || colorRecAuto)}" oninput="opsServCampo('colorCalendario', this.value);this.nextElementSibling.textContent='Personalizado'" ${gestion ? "" : "disabled"} style="width:38px;height:30px;border:1px solid #cbd5e1;border-radius:6px;padding:0;background:#fff;cursor:pointer;">
                            <span style="font-size:10.5px;color:#94a3b8;">${s.colorCalendario ? "Personalizado" : "Automático"}</span>
                            ${gestion && s.colorCalendario ? `<button type="button" onclick="opsServColorAuto()" style="background:none;border:none;color:#1D2E73;font-size:10.5px;font-weight:600;cursor:pointer;">Usar automático</button>` : ""}
                        </div>
                    </div>
                    <div style="width:170px;">
                        <div style="font-size:10.5px;color:#475569;font-weight:600;margin-bottom:4px;">Horas de ejecución por defecto</div>
                        ${inp(s.horasEjecucion, "horasEjecucion", true, "Ej. 6", "100%")}
                    </div>
                    <div style="flex:1;min-width:180px;font-size:10px;color:#94a3b8;">Relleno de las tarjetas del Calendario para todos los folios ligados a esta receta. Las horas se precargan al ligar un folio si el campo está vacío.</div>
                </div>
                <div style="background:#E9ECF5;border-radius:12px;padding:14px 16px;margin-bottom:6px;">
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:8px;">Calculadora — este trabajo</div>
                    <div style="display:flex;gap:10px;margin-bottom:10px;">
                        <div style="flex:1;">
                            <label style="font-size:10.5px;color:#475569;font-weight:600;">Cantidad de unidades (tanques, contenedores, etc.)</label>
                            <input type="number" min="0" step="any" value="${calculoActual.cantidad}" oninput="opsServCalcularCampo('cantidad', this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:7px 9px;font-size:13px;margin-top:3px;">
                        </div>
                        <div style="flex:1;">
                            <label style="font-size:10.5px;color:#475569;font-weight:600;">Días estimados</label>
                            <input type="number" min="0" step="any" value="${calculoActual.dias}" oninput="opsServCalcularCampo('dias', this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:7px 9px;font-size:13px;margin-top:3px;">
                        </div>
                    </div>
                    <div style="display:flex;gap:16px;flex-wrap:wrap;">
                        <div><div style="font-size:10px;color:#64748b;">Materiales</div><div style="font-size:16px;font-weight:800;color:#1e293b;">$${calculo.costoMateriales.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div></div>
                        <div><div style="font-size:10px;color:#64748b;">Personal</div><div style="font-size:16px;font-weight:800;color:#1e293b;">${calculo.costoPersonal !== null ? "$" + calculo.costoPersonal.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "—"}</div></div>
                        <div><div style="font-size:10px;color:#64748b;">Total estimado</div><div style="font-size:18px;font-weight:800;color:#1D2E73;">${calculo.costoTotal !== null ? "$" + calculo.costoTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 }) : "—"}</div></div>
                    </div>
                    <div style="font-size:9.5px;color:#64748b;margin-top:8px;">No incluye equipo de seguridad ni logística (todavía sin costo capturado en la receta).${calculo.costoPersonal === null ? " Personal no calculado: necesitas permiso para ver tarifas, o la receta no tiene roles capturados." : ""} Herramienta y vehículo no escalan con la cantidad — es la misma cuadrilla y el mismo equipo.</div>
                </div>

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
                <div style="background:#f8fafc;border-radius:8px;padding:8px 11px;margin-top:14px;margin-bottom:10px;font-size:10.5px;color:#475569;">Calculado para <strong>${calculoActual.cantidad}</strong> unidad(es) — cambia la cantidad en la pestaña Resumen.</div>
                <div>
                    <div style="font-size:11px;font-weight:700;color:#1D2E73;text-transform:uppercase;margin-bottom:6px;">Materiales (${(s.materiales || []).length})</div>
                    ${(s.materiales || []).map((m, i) => {
                        const calc = calculo.materiales[i];
                        return `
                        <div style="border:1px solid #f1f5f9;border-radius:7px;padding:7px 8px;margin-bottom:6px;">
                            <div style="display:flex;gap:6px;margin-bottom:5px;align-items:center;">
                                ${inp(m.nombre, `materiales.${i}.nombre`, false, "Nombre del material")}
                                <span style="font-size:11px;font-weight:700;color:#1D2E73;white-space:nowrap;">= ${calc.cantidadCalculada.toLocaleString("es-MX", { maximumFractionDigits: 2 })} ${opsEsc(m.unidad || "")}</span>
                                ${gestion ? `<button onclick="opsServQuitarFila('materiales',${i})" style="background:#fee2e2;border:none;color:#E7402B;width:26px;height:26px;border-radius:6px;cursor:pointer;flex-shrink:0;">${ICON.close}</button>` : ""}
                            </div>
                            <div style="display:flex;gap:6px;">
                                ${inp(m.cantidadBase, `materiales.${i}.cantidadBase`, true, "Cant. base", "60px")}
                                ${inp(m.unidad, `materiales.${i}.unidad`, false, "Unidad", "60px")}
                                ${inp(m.costoUnitario, `materiales.${i}.costoUnitario`, true, "Costo unit.", "70px")}
                                <select onchange="opsServCampo('materiales.${i}.reglaConsumo', this.value)" style="flex:1;border:1px solid #cbd5e1;border-radius:6px;padding:5px 7px;font-size:11px;" ${gestion ? "" : "disabled"}>
                                    <option value="proporcional" ${m.reglaConsumo === "proporcional" ? "selected" : ""}>Proporcional</option>
                                    <option value="frecuencia" ${m.reglaConsumo === "frecuencia" ? "selected" : ""}>Por frecuencia</option>
                                </select>
                            </div>
                            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">Costo calculado: $${calc.costoCalculado.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                        </div>`;
                    }).join("")}
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


    // ══════════════════════════════════════════════════════════════════
    // PUENTE SUPABASE — Herramientas y Movimientos (sep-2026)
    // Los datos de ops_herramientas / ops_movimientos / ops_contadores ya
    // estaban migrados a Supabase, pero este archivo seguía leyendo y
    // escribiendo en Firestore (plan Spark sin cuota). Desde esta versión
    // Supabase es la fuente de verdad para piezas, fotos, folios HT y
    // movimientos. Se sigue escribiendo una COPIA en Firestore (sin esperar
    // y sin fallar si no hay cuota) mientras Flotilla móvil siga leyendo de ahí.
    // ══════════════════════════════════════════════════════════════════
    const OPS_SB_URL = "https://vlbyjoqessxcmkejcujp.supabase.co";
    const OPS_SB_KEY = "sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8";
    let _opsSbPromesa = null;
    function opsSb() {
        if (window.tcSupabase) return Promise.resolve(window.tcSupabase);
        if (_opsSbPromesa) return _opsSbPromesa;
        _opsSbPromesa = import("https://esm.sh/@supabase/supabase-js@2").then(mod => {
            if (window.tcSupabase) return window.tcSupabase;
            const c = mod.createClient(OPS_SB_URL, OPS_SB_KEY);
            window.tcSupabase = c;
            return c;
        }).catch(e => { _opsSbPromesa = null; throw e; });
        return _opsSbPromesa;
    }
    const opsSnake = k => k.replace(/[A-Z]/g, m => "_" + m.toLowerCase());
    const opsCamel = k => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
    function opsFilaACamel(row) {
        if (!row) return row;
        const o = {};
        Object.keys(row).forEach(k => { if (k !== "extra") o[opsCamel(k)] = row[k]; });
        if (row.extra && typeof row.extra === "object") Object.keys(row.extra).forEach(k => { if (o[k] === undefined || o[k] === null) o[k] = row.extra[k]; });
        return o;
    }

    const OPS_HERR_COLS = new Set(["id", "folio", "descripcion", "marca", "modelo", "categoria", "subcategoria", "numero_serie", "departamento", "condicion", "uso", "peso", "peso_unidad", "medida", "foto_base64", "estado", "ubicacion_actual", "almacen_id", "tecnico_actual_id", "fecha_asignacion", "folio_legado", "observaciones", "fecha_alta", "origen_requisicion_id", "origen_requisicion_folio", "requiere_autorizacion", "external_id", "source_system", "last_sync", "sync_status", "cantidad", "condicion_fisica"]);
    const OPS_HERR_NUM = new Set(["peso", "cantidad"]);
    // Convierte un objeto camelCase completo (tal como lo usa el resto del
    // archivo) a fila de Supabase; lo que no tiene columna va a `extra`.
    function opsHerrAFila(id, obj) {
        const fila = { id, extra: {} };
        Object.keys(obj).forEach(k => {
            if (k === "id" || k === "extra" || k === "creadoEn" || k === "actualizadoEn") return;
            const s = opsSnake(k);
            let v = obj[k];
            if (v === undefined) return;
            if (OPS_HERR_COLS.has(s)) {
                if (OPS_HERR_NUM.has(s) && v !== null && v !== "") {
                    const n = Number(v);
                    if (isNaN(n)) { fila.extra[k] = v; v = null; } else v = n;
                }
                if (v === "" && OPS_HERR_NUM.has(s)) v = null;
                fila[s] = v;
            } else {
                fila.extra[k] = v;
            }
        });
        if (!Object.keys(fila.extra).length) fila.extra = null;
        fila.actualizado_en = new Date().toISOString();
        return fila;
    }
    function opsMezclarEnCacheHerr(id, obj) {
        const idx = cacheHerr.findIndex(x => x.id === id);
        if (idx >= 0) cacheHerr[idx] = { ...cacheHerr[idx], ...obj, id };
        else { cacheHerr.push({ ...obj, id }); cacheHerr.sort((a, b) => String(a.folio || a.id).localeCompare(String(b.folio || b.id))); }
    }
    function opsCopiaFirestore(fn) {
        // Copia "de cortesía" para Flotilla móvil — nunca bloquea ni truena.
        try { opsGetFB().then(({ db, fs }) => fn(db, fs)).catch(() => {}); } catch (e) {}
    }
    async function opsSbHerrGuardar(id, obj) {
        const sb = await opsSb();
        const previo = cacheHerr.find(x => x.id === id) || {};
        const completo = { ...previo, ...obj };
        delete completo.id;
        const { error } = await sb.from("ops_herramientas").upsert(opsHerrAFila(id, completo), { onConflict: "id" });
        if (error) throw new Error("Supabase: " + error.message);
        opsMezclarEnCacheHerr(id, obj);
        opsCopiaFirestore((db, fs) => fs.setDoc(fs.doc(db, COL_HERRAMIENTAS, id), obj, { merge: true }).catch(() => {}));
        opsRefrescarVistasHerr();
    }
    async function opsSbHerrActualizar(id, parcial) { return opsSbHerrGuardar(id, parcial); }
    async function opsSbHerrListar() {
        const sb = await opsSb();
        let todos = [], desde = 0;
        while (true) {
            const { data, error } = await sb.from("ops_herramientas").select("*").order("folio", { ascending: true }).range(desde, desde + 999);
            if (error) throw new Error("Supabase: " + error.message);
            todos = todos.concat(data || []);
            if (!data || data.length < 1000) break;
            desde += 1000;
        }
        return todos.map(opsFilaACamel);
    }
    function opsRefrescarVistasHerr() {
        try {
            if (tabActual === "dashboard") opsRenderDashboard();
            if (tabActual === "resumen") opsRenderResumen();
        } catch (e) {}
    }
    // Carga inicial + cambios en vivo (Realtime) + chequeo ligero cada 3 min
    // de solo lo que cambió (actualizado_en), para no bajar todas las fotos otra vez.
    function opsSbSuscribirHerr() {
        let vivo = true, canal = null, timer = null, ultimo = new Date().toISOString();
        const aplicarFila = row => { if (row && row.id) opsMezclarEnCacheHerr(row.id, opsFilaACamel(row)); };
        opsSbHerrListar().then(lista => {
            if (!vivo) return;
            cacheHerr = lista;
            opsRefrescarVistasHerr();
        }).catch(err => {
            console.error("[operaciones.js] no se pudieron cargar herramientas de Supabase:", err);
            if (window.mostrarPush) window.mostrarPush("Operaciones", "No se pudieron cargar las herramientas (Supabase). Revisa tu conexión.", "⚠️");
        });
        opsSb().then(sb => {
            if (!vivo) return;
            canal = sb.channel("ops-herramientas-" + Date.now())
                .on("postgres_changes", { event: "*", schema: "public", table: "ops_herramientas" }, p => {
                    if (p.eventType === "DELETE") { cacheHerr = cacheHerr.filter(x => x.id !== (p.old && p.old.id)); }
                    else aplicarFila(p.new);
                    opsRefrescarVistasHerr();
                }).subscribe();
            timer = setInterval(async () => {
                try {
                    const desde = ultimo; ultimo = new Date().toISOString();
                    const { data } = await sb.from("ops_herramientas").select("*").gt("actualizado_en", desde);
                    if (data && data.length) { data.forEach(aplicarFila); opsRefrescarVistasHerr(); }
                } catch (e) {}
            }, 180000);
        }).catch(() => {});
        return () => { vivo = false; if (timer) clearInterval(timer); if (canal) { try { canal.unsubscribe(); } catch (e) {} } };
    }

    // ── Movimientos ──
    async function opsSbMovListar() {
        const sb = await opsSb();
        const { data, error } = await sb.from("ops_movimientos").select("*").order("fecha", { ascending: false }).limit(200);
        if (error) throw new Error("Supabase: " + error.message);
        return (data || []).map(opsFilaACamel);
    }
    function opsSbSuscribirMov() {
        let vivo = true, canal = null;
        const refrescar = () => opsSbMovListar().then(l => {
            if (!vivo) return;
            cacheMov = l;
            if (tabActual === "movimientos") opsRenderMovimientos();
            if (tabActual === "dashboard") opsRenderDashboard();
        }).catch(e => console.warn("[operaciones.js] movimientos (Supabase):", e.message));
        refrescar();
        opsSb().then(sb => {
            if (!vivo) return;
            canal = sb.channel("ops-movimientos-" + Date.now())
                .on("postgres_changes", { event: "INSERT", schema: "public", table: "ops_movimientos" }, () => refrescar())
                .subscribe();
        }).catch(() => {});
        return () => { vivo = false; if (canal) { try { canal.unsubscribe(); } catch (e) {} } };
    }

    // ── Respaldo de técnicos y almacenes desde Supabase ──
    // Siguen leyéndose de Firestore (sus altas/ediciones aún viven ahí), pero si
    // Firestore no responde (sin cuota) se usan las copias ya migradas a Supabase
    // para que los combos de técnico y las tarjetas por almacén no salgan vacíos.
    async function opsSbRespaldoTecAlm() {
        try {
            const sb = await opsSb();
            if (!cacheTec.length) {
                const { data } = await sb.from("ops_tecnicos").select("*").order("numero_operativo");
                if (data && data.length && !cacheTec.length) cacheTec = data.map(opsFilaACamel);
            }
            if (!cacheAlmacenes.length) {
                const { data } = await sb.from("ops_almacenes").select("*");
                if (data && data.length && !cacheAlmacenes.length) cacheAlmacenes = data.map(opsFilaACamel);
            }
            opsRefrescarVistasHerr();
        } catch (e) { console.warn("[operaciones.js] respaldo técnicos/almacenes:", e.message); }
    }

    // ══════════════════════════════════════════════════════════════════
    // SOLICITUD DE VIÁTICOS (sep-2026)
    // Estación destino desde el catálogo de Ventas (estaciones_servicio en
    // Supabase) → ubicación en mapa → distancia y tiempo reales (OSRM) →
    // ¿requiere viáticos? → gasolina, alimentos y hospedaje calculados solos.
    // Todo queda editable. Notifica a Cristina Acosta y a Pagos.
    // Tarifas editables en la tabla ops_config_viaticos_solicitud (botón "Tarifas").
    // ══════════════════════════════════════════════════════════════════
    const OPS_VIA_CFG_DEFAULT = {
        desayuno: 150, desayunoRegla: "Salida antes de las 7:15", horaDesayuno: "07:15",
        comida: 200, comidaRegla: "Medio día (2:00 p.m.)", horaComida: "14:00",
        cena: 130, cenaRegla: "Pasadas las 7:00 p.m.", horaCena: "19:00",
        topeDiario: 500, precioLitro: 25, factor: 1.20, multiplicadorKm: 2,
        kmMinimoViaticos: 40, hospedajePorNoche: 900, horasServicioDefault: 4,
        origen: { nombre: "Oficina Tecnocontrol (Chihuahua)", lat: 28.6353, lng: -106.0889 },
        vehiculos: [
            { tipo: "chico", nombre: "Chico (March / Attitude / Ram)", rendimiento: 10 },
            { tipo: "mediano", nombre: "Mediano (L200 / Changan)", rendimiento: 9 },
            { tipo: "grande", nombre: "Grande (camiones)", rendimiento: 8 },
        ],
        correosNotificar: ["c.acosta@tecnocontrol.com.mx", "pagos@tecnocontrol.com.mx"],
    };
    let opsViaCfg = { ...OPS_VIA_CFG_DEFAULT };
    let opsViaLista = [];
    let opsViaEstaciones = null; // catálogo de Ventas, se carga una vez
    let opsViaFoliosSb = null;
    let opsViaForm = null;
    let opsViaMapa = null, opsViaCapas = [];
    const OPS_VIA_ESTATUS = { "Pendiente": "#b45309", "Aprobada": "#1D2E73", "Pagada": "#15803d", "Rechazada": "#E7402B" };

    const opsViaDinero = n => "$" + (Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const opsViaNum = v => { const n = Number(v); return isNaN(n) ? 0 : n; };
    function opsViaPuedeAutorizar() {
        const yo = (opsUsuarioActual() || "").toLowerCase();
        return opsRolActual() === "administrador" || (opsViaCfg.correosNotificar || []).map(x => x.toLowerCase()).includes(yo) || yo === "c.acosta@tecnocontrol.com.mx";
    }
    async function opsViaCargarCfg() {
        try {
            const sb = await opsSb();
            const { data } = await sb.from("ops_config_viaticos_solicitud").select("datos").eq("id", "general").maybeSingle();
            if (data && data.datos) opsViaCfg = { ...OPS_VIA_CFG_DEFAULT, ...data.datos, origen: { ...OPS_VIA_CFG_DEFAULT.origen, ...(data.datos.origen || {}) } };
        } catch (e) { console.warn("[viáticos] config:", e.message); }
    }
    async function opsViaCargarLista() {
        const sb = await opsSb();
        const { data, error } = await sb.from("ops_solicitudes_viaticos").select("*").order("creado_en", { ascending: false }).limit(200);
        if (error) throw error;
        opsViaLista = data || [];
    }
    async function opsViaCargarEstaciones() {
        if (opsViaEstaciones) return opsViaEstaciones;
        const sb = await opsSb();
        let todos = [], desde = 0;
        while (true) {
            const { data, error } = await sb.from("estaciones_servicio")
                .select("id,razon_social,nombre_comercial,codigo_estacion_cre,permiso,direccion_normalizada,domicilio_raw,municipio,estado,lat,lng,encargado,zona,activo")
                .order("id").range(desde, desde + 999);
            if (error) throw error;
            todos = todos.concat(data || []);
            if (!data || data.length < 1000) break;
            desde += 1000;
        }
        opsViaEstaciones = todos.filter(e => e.activo !== false);
        return opsViaEstaciones;
    }
    async function opsViaCargarFolios() {
        if (cacheFolios && cacheFolios.length) return cacheFolios;
        if (opsViaFoliosSb) return opsViaFoliosSb;
        try {
            const sb = await opsSb();
            const { data } = await sb.from("ops_folios").select("*").limit(500);
            opsViaFoliosSb = (data || []).map(opsFilaACamel);
        } catch (e) { opsViaFoliosSb = []; }
        return opsViaFoliosSb;
    }
    async function opsViaTecnicos() {
        if (!cacheTec.length) await opsSbRespaldoTecAlm();
        return cacheTec.filter(t => (t.estatus || "activo") !== "baja");
    }
    function opsViaNombreEstacion(e) {
        return [e.nombre_comercial || e.razon_social, e.codigo_estacion_cre, e.municipio].filter(Boolean).join(" · ");
    }

    // ── Pestaña ──
    async function opsRenderViaticos() {
        const el = document.getElementById("ops-tab-content");
        if (!el) return;
        el.innerHTML = `<div style="padding:30px;color:#64748b;font-size:13px;">Cargando solicitudes de viáticos…</div>`;
        try { await Promise.all([opsViaCargarCfg(), opsViaCargarLista()]); }
        catch (e) { el.innerHTML = `<div style="padding:30px;color:#E7402B;">No se pudieron cargar los viáticos: ${opsEsc(e.message || e)}</div>`; return; }
        if (tabActual !== "viaticos") return;
        const autoriza = opsViaPuedeAutorizar();
        const filas = opsViaLista.map(s => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:9px 8px;font-weight:700;color:#1D2E73;white-space:nowrap;">${opsEsc(s.folio || s.id)}</td>
                <td style="padding:9px 8px;">${opsEsc(s.destino || "")}<div style="font-size:10.5px;color:#94a3b8;">${opsEsc(s.folio_servicio ? "Servicio " + s.folio_servicio : "")}</div></td>
                <td style="padding:9px 8px;font-size:11.5px;">${opsEsc(s.integrantes || "")}</td>
                <td style="padding:9px 8px;white-space:nowrap;font-size:11.5px;">${opsEsc(s.fecha_salida || "")}${s.fecha_regreso && s.fecha_regreso !== s.fecha_salida ? " → " + opsEsc(s.fecha_regreso) : ""}</td>
                <td style="padding:9px 8px;text-align:right;font-weight:700;">${opsViaDinero(s.total)}</td>
                <td style="padding:9px 8px;">
                    ${autoriza ? `<select onchange="opsViaCambiarEstatus(${s.id}, this.value)" style="border:1px solid #cbd5e1;border-radius:7px;padding:4px 6px;font-size:11.5px;color:${OPS_VIA_ESTATUS[s.estatus] || "#334155"};font-weight:700;">
                        ${Object.keys(OPS_VIA_ESTATUS).map(k => `<option ${k === s.estatus ? "selected" : ""}>${k}</option>`).join("")}</select>`
                    : `<span style="font-weight:700;font-size:11.5px;color:${OPS_VIA_ESTATUS[s.estatus] || "#334155"};">${opsEsc(s.estatus)}</span>`}
                </td>
                <td style="padding:9px 8px;white-space:nowrap;">
                    <button onclick="opsViaVerDetalle(${s.id})" style="background:#E9ECF5;border:none;color:#1D2E73;padding:5px 9px;border-radius:7px;cursor:pointer;font-size:11.5px;font-weight:600;">Ver</button>
                </td>
            </tr>`).join("");
        el.innerHTML = `
        <div style="padding:22px;">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
                <div>
                    <div style="font-family:'Space Grotesk',sans-serif;font-size:19px;font-weight:700;color:#1D2E73;">Solicitudes de viáticos</div>
                    <div style="font-size:12px;color:#64748b;">Se notifica a Cristina Acosta (Gerente Administrativa) y a Pagos.</div>
                </div>
                <div style="display:flex;gap:8px;">
                    ${opsRolActual() === "administrador" || autoriza ? `<button onclick="opsViaAbrirTarifas()" style="background:#fff;border:1px solid #cbd5e1;color:#334155;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Tarifas</button>` : ""}
                    <button onclick="opsViaAbrirFormulario()" class="mkt-add-btn" style="background:#E7402B;">+ Nueva solicitud de viáticos</button>
                </div>
            </div>
            <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:12.5px;color:#334155;">
                    <thead><tr style="background:#f8fafc;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">
                        <th style="padding:9px 8px;">Folio</th><th style="padding:9px 8px;">Destino</th><th style="padding:9px 8px;">Personal</th>
                        <th style="padding:9px 8px;">Fechas</th><th style="padding:9px 8px;text-align:right;">Total</th><th style="padding:9px 8px;">Estatus</th><th></th>
                    </tr></thead>
                    <tbody>${filas || `<tr><td colspan="7" style="padding:24px;text-align:center;color:#94a3b8;">Todavía no hay solicitudes.</td></tr>`}</tbody>
                </table>
            </div>
        </div>`;
    }

    window.opsViaCambiarEstatus = async function (id, estatus) {
        try {
            const sb = await opsSb();
            const { error } = await sb.from("ops_solicitudes_viaticos").update({ estatus, actualizado_en: new Date().toISOString(), actualizado_por: opsUsuarioActual() }).eq("id", id);
            if (error) throw error;
            const s = opsViaLista.find(x => x.id === id);
            if (s) {
                s.estatus = estatus;
                // Aviso al solicitante (best effort vía Firestore, como el resto del portal).
                if (s.solicitante_email) opsCopiaFirestore((db, fs) => window.tcNotificar2(fs, db, {
                    tipo: "viaticos_" + estatus.toLowerCase(), para: s.solicitante_email,
                    mensaje: `Tu solicitud de viáticos ${s.folio} (${s.destino || ""}) cambió a: ${estatus}.`, leido: false, creadaEn: new Date().toISOString(),
                }).catch(() => {}));
            }
            if (window.mostrarPush) window.mostrarPush("Viáticos", `Solicitud marcada como ${estatus}.`, "✅");
            opsRenderViaticos();
        } catch (e) { alert("No se pudo cambiar el estatus: " + (e.message || e)); }
    };

    // ── Formulario ──
    window.opsViaAbrirFormulario = async function () {
        const wrap = document.getElementById("ops-modal-wrap");
        wrap.innerHTML = `<div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;"><div style="background:#fff;border-radius:14px;padding:26px;font-size:13px;color:#475569;">Cargando estaciones y técnicos…</div></div>`;
        try { await Promise.all([opsViaCargarCfg(), opsViaCargarEstaciones(), opsViaCargarFolios(), opsViaTecnicos()]); }
        catch (e) { wrap.innerHTML = ""; alert("No se pudo abrir el formulario: " + (e.message || e)); return; }
        const ahora = new Date(); ahora.setDate(ahora.getDate() + 1); ahora.setHours(7, 0, 0, 0);
        opsViaForm = {
            estacion: null, folioServicio: "", cliente: "", motivo: "",
            destinoTexto: "", lat: null, lng: null, coordAprox: false,
            kmSencillo: 0, horasIda: 0, calculando: false,
            tecnicos: [], tipoVehiculo: "mediano", vehiculo: "",
            salida: opsViaLocalISO(ahora), horasServicio: opsViaCfg.horasServicioDefault || 4,
            regreso: "", regresoManual: false,
            requiere: null, requiereManual: false,
            desayunos: 0, comidas: 0, cenas: 0, comidasManual: false,
            noches: 0, nochesManual: false, hospedajePorNoche: opsViaCfg.hospedajePorNoche || 900,
            casetas: 0, otros: 0, notas: "",
            rendimiento: null, precioLitro: opsViaCfg.precioLitro, factor: opsViaCfg.factor,
        };
        opsViaRecalcular();
        opsViaPintarFormulario();
    };
    function opsViaLocalISO(d) {
        const p = n => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    function opsViaVehiculoCfg(tipo) { return (opsViaCfg.vehiculos || []).find(v => v.tipo === tipo) || (opsViaCfg.vehiculos || [])[0] || { rendimiento: 9 }; }

    // Todo el cálculo en un solo lugar: lo que el usuario sobrescribió a mano se respeta.
    function opsViaRecalcular() {
        const f = opsViaForm; if (!f) return;
        const cfg = opsViaCfg;
        if (!f.regresoManual && f.salida) {
            const s = new Date(f.salida);
            const horas = (opsViaNum(f.horasIda) * 2) + opsViaNum(f.horasServicio);
            f.regreso = opsViaLocalISO(new Date(s.getTime() + horas * 3600000));
        }
        if (!f.requiereManual) f.requiere = opsViaNum(f.kmSencillo) >= opsViaNum(cfg.kmMinimoViaticos);
        if (f.rendimiento === null || f.rendimiento === undefined || f.rendimiento === "") f.rendimiento = opsViaVehiculoCfg(f.tipoVehiculo).rendimiento;
        // Comidas por persona según horarios (reglas de Idaly: desayuno si sale antes de 7:15,
        // comida si está fuera a las 2:00, cena si regresa pasadas las 7:00).
        if (!f.comidasManual) {
            let d = 0, c = 0, n = 0;
            if (f.requiere && f.salida && f.regreso) {
                const s = new Date(f.salida), r = new Date(f.regreso);
                const minutos = hhmm => { const [h, m] = String(hhmm || "00:00").split(":").map(Number); return h * 60 + (m || 0); };
                const mD = minutos(cfg.horaDesayuno), mC = minutos(cfg.horaComida), mN = minutos(cfg.horaCena);
                const dia0 = new Date(s.getFullYear(), s.getMonth(), s.getDate());
                const diaF = new Date(r.getFullYear(), r.getMonth(), r.getDate());
                for (let x = new Date(dia0); x <= diaF; x.setDate(x.getDate() + 1)) {
                    const esPrimero = x.getTime() === dia0.getTime(), esUltimo = x.getTime() === diaF.getTime();
                    const ini = esPrimero ? s.getHours() * 60 + s.getMinutes() : 0;
                    const fin = esUltimo ? r.getHours() * 60 + r.getMinutes() : 24 * 60;
                    if ((esPrimero ? ini < mD : true) && fin >= mD) d++;
                    if (ini <= mC && fin >= mC) c++;
                    if (fin >= mN) n++;
                }
            }
            f.desayunos = d; f.comidas = c; f.cenas = n;
        }
        if (!f.nochesManual) {
            let noches = 0;
            if (f.requiere && f.salida && f.regreso) {
                const s = new Date(f.salida), r = new Date(f.regreso);
                noches = Math.max(0, Math.round((new Date(r.getFullYear(), r.getMonth(), r.getDate()) - new Date(s.getFullYear(), s.getMonth(), s.getDate())) / 86400000));
            }
            f.noches = noches;
        }
        const personas = Math.max(1, f.tecnicos.length);
        const rend = opsViaNum(f.rendimiento) || 1;
        f.gasolina = Math.round((opsViaNum(f.kmSencillo) * opsViaNum(cfg.multiplicadorKm || 2) / rend) * opsViaNum(f.precioLitro) * opsViaNum(f.factor) * 100) / 100;
        f.alimentosPorPersona = f.desayunos * opsViaNum(cfg.desayuno) + f.comidas * opsViaNum(cfg.comida) + f.cenas * opsViaNum(cfg.cena);
        f.alimentos = f.requiere ? f.alimentosPorPersona * personas : 0;
        f.hospedaje = f.requiere ? opsViaNum(f.noches) * opsViaNum(f.hospedajePorNoche) * personas : 0;
        f.total = Math.round((f.gasolina + f.alimentos + f.hospedaje + opsViaNum(f.casetas) + opsViaNum(f.otros)) * 100) / 100;
        f.personas = personas;
    }

    function opsViaInput(label, id, valor, extra = "", tipo = "text") {
        return `<label style="display:block;font-size:11.5px;font-weight:600;color:#475569;">${label}
            <input id="${id}" type="${tipo}" value="${opsEsc(valor ?? "")}" ${extra} style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;box-sizing:border-box;"></label>`;
    }
    function opsViaPintarFormulario() {
        const f = opsViaForm, cfg = opsViaCfg;
        const wrap = document.getElementById("ops-modal-wrap");
        const tecnicos = cacheTec.filter(t => (t.estatus || "activo") !== "baja");
        const folios = (cacheFolios && cacheFolios.length ? cacheFolios : (opsViaFoliosSb || []))
            .filter(x => x.estado !== "cerrado" && x.estatus !== "Cerrado")
            .slice(0, 300);
        wrap.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;">
            <div style="background:#fff;border-radius:14px;width:1040px;max-width:98vw;max-height:94vh;overflow-y:auto;padding:22px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px;color:#1D2E73;">Nueva solicitud de viáticos</div>
                    <button onclick="opsViaCerrar()" style="background:#f1f5f9;border:none;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:16px;">×</button>
                </div>
                <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;">
                    <div>
                        <label style="display:block;font-size:11.5px;font-weight:600;color:#475569;">Folio de servicio (opcional — si lo eliges, jala la estación sola)
                            <select id="via-folio" onchange="opsViaElegirFolio(this.value)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                                <option value="">— Sin folio —</option>
                                ${folios.map(x => `<option value="${opsEsc(x.id)}" ${f.folioServicio && (x.folioOS === f.folioServicio || x.id === f.folioServicio) ? "selected" : ""}>${opsEsc(x.folioOS || x.id)} — ${opsEsc(x.estacion || x.clienteNombre || "")}</option>`).join("")}
                            </select></label>
                        <label style="display:block;font-size:11.5px;font-weight:600;color:#475569;">Estación destino (catálogo de Ventas)
                            <input id="via-est-buscar" placeholder="Escribe nombre, CRE, razón social o municipio…" value="${opsEsc(f.estacion ? opsViaNombreEstacion(f.estacion) : "")}" oninput="opsViaBuscarEstacion(this.value)" autocomplete="off"
                                style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 2px;box-sizing:border-box;"></label>
                        <div id="via-est-resultados" style="position:relative;"></div>
                        <div style="font-size:11px;color:#64748b;margin:2px 0 10px;">${f.estacion ? opsEsc(f.estacion.direccion_normalizada || f.estacion.domicilio_raw || "") : "¿No está en el catálogo? Escribe la dirección y presiona <b>Enter</b>."}</div>
                        <div id="via-mapa" style="height:250px;border-radius:10px;border:1px solid #e2e8f0;background:#f8fafc;margin-bottom:6px;"></div>
                        <div id="via-ruta-info" style="font-size:12px;color:#334155;margin-bottom:12px;">${opsViaTextoRuta()}</div>

                        <div style="font-size:11.5px;font-weight:600;color:#475569;margin-bottom:4px;">Personal que viaja (${f.tecnicos.length})</div>
                        <div style="max-height:130px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;margin-bottom:10px;">
                            ${tecnicos.map(t => `<label style="display:flex;gap:6px;align-items:center;font-size:12px;padding:2px 0;cursor:pointer;">
                                <input type="checkbox" ${f.tecnicos.some(x => x.id === t.id) ? "checked" : ""} onchange="opsViaToggleTecnico('${opsEsc(t.id)}', this.checked)">
                                ${opsEsc(t.nombre || "")} <span style="color:#94a3b8;">${opsEsc(t.numeroOperativo || "")}</span></label>`).join("") || `<div style="color:#94a3b8;font-size:12px;">No se pudieron cargar técnicos.</div>`}
                        </div>
                    </div>
                    <div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">
                            <label style="display:block;font-size:11.5px;font-weight:600;color:#475569;">Tipo de vehículo
                                <select onchange="opsViaCampo('tipoVehiculo', this.value); opsViaForm.rendimiento=null; opsViaRecalcular(); opsViaPintarFormulario();" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;">
                                    ${(cfg.vehiculos || []).map(v => `<option value="${opsEsc(v.tipo)}" ${v.tipo === f.tipoVehiculo ? "selected" : ""}>${opsEsc(v.nombre)} — ${v.rendimiento} km/l</option>`).join("")}
                                </select></label>
                            ${opsViaInput("Vehículo / ECO (opcional)", "via-vehiculo", f.vehiculo, `oninput="opsViaForm.vehiculo=this.value"`)}
                            ${opsViaInput("Salida", "via-salida", f.salida, `onchange="opsViaCampo('salida', this.value, true)"`, "datetime-local")}
                            ${opsViaInput("Horas de servicio en sitio", "via-horas", f.horasServicio, `onchange="opsViaCampo('horasServicio', this.value, true)" step="0.5" min="0"`, "number")}
                            ${opsViaInput("Regreso estimado " + (f.regresoManual ? "(editado)" : "(automático)"), "via-regreso", f.regreso, `onchange="opsViaForm.regresoManual=true; opsViaCampo('regreso', this.value, true)"`, "datetime-local")}
                            <label style="display:block;font-size:11.5px;font-weight:600;color:#475569;">¿Requiere viáticos?
                                <select onchange="opsViaForm.requiereManual=true; opsViaCampo('requiere', this.value==='1', true)" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin:4px 0 10px;font-weight:700;color:${f.requiere ? "#15803d" : "#64748b"};">
                                    <option value="1" ${f.requiere ? "selected" : ""}>Sí${f.requiereManual ? "" : " (automático)"}</option>
                                    <option value="0" ${!f.requiere ? "selected" : ""}>No — solo gasolina${f.requiereManual ? "" : " (automático)"}</option>
                                </select></label>
                        </div>
                        <div style="font-size:10.5px;color:#94a3b8;margin:-4px 0 10px;">Regla: requiere viáticos si la estación está a ${cfg.kmMinimoViaticos} km o más (sencillo). Puedes cambiarlo.</div>

                        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;">
                            <div style="font-weight:700;font-size:12.5px;color:#1D2E73;margin-bottom:8px;">Gasolina — km × ${cfg.multiplicadorKm} ÷ rendimiento × precio × factor</div>
                            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0 8px;">
                                ${opsViaInput("Km sencillo", "via-km", f.kmSencillo, `onchange="opsViaCampo('kmSencillo', this.value, true)" step="0.1" min="0"`, "number")}
                                ${opsViaInput("Km/l", "via-rend", f.rendimiento, `onchange="opsViaCampo('rendimiento', this.value, true)" step="0.1" min="1"`, "number")}
                                ${opsViaInput("$/litro", "via-precio", f.precioLitro, `onchange="opsViaCampo('precioLitro', this.value, true)" step="0.01"`, "number")}
                                ${opsViaInput("Factor", "via-factor", f.factor, `onchange="opsViaCampo('factor', this.value, true)" step="0.01"`, "number")}
                            </div>
                            <div style="text-align:right;font-weight:700;color:#334155;">Gasolina: ${opsViaDinero(f.gasolina)}</div>

                            <div style="font-weight:700;font-size:12.5px;color:#1D2E73;margin:12px 0 8px;">Alimentos por persona ${f.comidasManual ? "(editado)" : "(automático por horario)"}</div>
                            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 8px;">
                                ${opsViaInput(`Desayunos × ${opsViaDinero(cfg.desayuno)}`, "via-des", f.desayunos, `onchange="opsViaForm.comidasManual=true; opsViaCampo('desayunos', Number(this.value), true)" min="0"`, "number")}
                                ${opsViaInput(`Comidas × ${opsViaDinero(cfg.comida)}`, "via-com", f.comidas, `onchange="opsViaForm.comidasManual=true; opsViaCampo('comidas', Number(this.value), true)" min="0"`, "number")}
                                ${opsViaInput(`Cenas × ${opsViaDinero(cfg.cena)}`, "via-cen", f.cenas, `onchange="opsViaForm.comidasManual=true; opsViaCampo('cenas', Number(this.value), true)" min="0"`, "number")}
                            </div>
                            <div style="font-size:10.5px;color:#94a3b8;margin-top:-4px;">${opsEsc(cfg.desayunoRegla)} · ${opsEsc(cfg.comidaRegla)} · ${opsEsc(cfg.cenaRegla)} · Tope diario ${opsViaDinero(cfg.topeDiario)}</div>
                            <div style="text-align:right;font-weight:700;color:#334155;">Alimentos: ${opsViaDinero(f.alimentosPorPersona)} × ${f.personas} persona(s) = ${opsViaDinero(f.alimentos)}</div>

                            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0 8px;margin-top:12px;">
                                ${opsViaInput("Noches hotel", "via-noches", f.noches, `onchange="opsViaForm.nochesManual=true; opsViaCampo('noches', Number(this.value), true)" min="0"`, "number")}
                                ${opsViaInput("$/noche", "via-hotel", f.hospedajePorNoche, `onchange="opsViaCampo('hospedajePorNoche', this.value, true)"`, "number")}
                                ${opsViaInput("Casetas $", "via-casetas", f.casetas, `onchange="opsViaCampo('casetas', this.value, true)"`, "number")}
                                ${opsViaInput("Otros $", "via-otros", f.otros, `onchange="opsViaCampo('otros', this.value, true)"`, "number")}
                            </div>
                            <div style="text-align:right;font-weight:700;color:#334155;">Hospedaje: ${opsViaDinero(f.hospedaje)}</div>
                            <div style="border-top:2px solid #1D2E73;margin-top:10px;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
                                <span style="font-weight:700;color:#1D2E73;">TOTAL SOLICITADO</span>
                                <span style="font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:700;color:#E7402B;">${opsViaDinero(f.total)}</span>
                            </div>
                        </div>
                        <label style="display:block;font-size:11.5px;font-weight:600;color:#475569;margin-top:10px;">Motivo / notas
                            <textarea id="via-notas" oninput="opsViaForm.notas=this.value" rows="2" style="width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:13px;margin-top:4px;box-sizing:border-box;">${opsEsc(f.notas)}</textarea></label>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
                            <button onclick="opsViaCerrar()" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                            <button id="via-btn-guardar" onclick="opsViaGuardar()" class="mkt-add-btn" style="background:#1D2E73;">Enviar solicitud</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        const buscar = document.getElementById("via-est-buscar");
        if (buscar) buscar.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); opsViaDireccionLibre(buscar.value); } });
        opsViaPintarMapa();
    }
    window.opsViaCerrar = function () {
        if (opsViaMapa) { try { opsViaMapa.remove(); } catch (e) {} opsViaMapa = null; }
        document.getElementById("ops-modal-wrap").innerHTML = "";
        opsViaForm = null;
    };
    window.opsViaCampo = function (campo, valor, repintar) {
        if (!opsViaForm) return;
        opsViaForm[campo] = valor;
        opsViaRecalcular();
        if (repintar) opsViaPintarFormulario();
    };
    window.opsViaToggleTecnico = function (id, marcado) {
        const t = cacheTec.find(x => x.id === id);
        if (!t) return;
        opsViaForm.tecnicos = opsViaForm.tecnicos.filter(x => x.id !== id);
        if (marcado) opsViaForm.tecnicos.push({ id: t.id, nombre: t.nombre, correo: t.correo || null });
        opsViaRecalcular();
        opsViaPintarFormulario();
    };
    function opsViaTextoRuta() {
        const f = opsViaForm;
        if (!f) return "";
        if (f.calculando) return "Calculando distancia y tiempo…";
        if (!f.lat) return "Elige una estación para ver la ruta.";
        const h = opsViaNum(f.horasIda);
        const txtT = h ? `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min` : "—";
        return `<b>${opsViaNum(f.kmSencillo).toFixed(1)} km</b> sencillo · <b>${txtT}</b> de manejo (ida) desde ${opsEsc(opsViaCfg.origen.nombre)}`
            + (f.coordAprox ? `<div style="color:#b45309;font-size:11px;">Ubicación aproximada (por dirección). Arrastra el pin rojo al lugar exacto y se guarda en el catálogo de estaciones.</div>` : "");
    }

    window.opsViaBuscarEstacion = function (texto) {
        const cont = document.getElementById("via-est-resultados");
        if (!cont) return;
        const q = opsNormalizaTexto(texto || "");
        if (q.length < 2) { cont.innerHTML = ""; return; }
        const partes = q.split(" ").filter(Boolean);
        const res = (opsViaEstaciones || []).filter(e => {
            const hay = opsNormalizaTexto([e.id, e.nombre_comercial, e.razon_social, e.codigo_estacion_cre, e.permiso, e.municipio, e.direccion_normalizada].filter(Boolean).join(" "));
            return partes.every(p => hay.includes(p));
        }).slice(0, 12);
        cont.innerHTML = `<div style="position:absolute;left:0;right:0;top:0;z-index:1000;background:#fff;border:1px solid #cbd5e1;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,.12);max-height:260px;overflow-y:auto;">
            ${res.map(e => `<div onclick="opsViaElegirEstacion('${opsEsc(e.id)}')" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:12px;" onmouseover="this.style.background='#E9ECF5'" onmouseout="this.style.background=''">
                <b>${opsEsc(e.nombre_comercial || e.razon_social || e.id)}</b> <span style="color:#94a3b8;">${opsEsc(e.codigo_estacion_cre || "")}</span>
                <div style="color:#64748b;font-size:11px;">${opsEsc(e.direccion_normalizada || e.domicilio_raw || e.municipio || "")}</div></div>`).join("")
            || `<div style="padding:9px 10px;font-size:12px;color:#94a3b8;">Sin coincidencias. Presiona Enter para buscar como dirección.</div>`}</div>`;
    };
    window.opsViaElegirFolio = function (id) {
        const lista = (cacheFolios && cacheFolios.length ? cacheFolios : (opsViaFoliosSb || []));
        const fo = lista.find(x => x.id === id);
        if (!fo) { opsViaForm.folioServicio = ""; return; }
        opsViaForm.folioServicio = fo.folioOS || fo.id;
        opsViaForm.cliente = fo.clienteNombre || "";
        let est = null;
        if (fo.estacionCatalogoId) est = (opsViaEstaciones || []).find(e => e.id === fo.estacionCatalogoId);
        if (!est && fo.estacion) {
            const q = opsNormalizaTexto(fo.estacion);
            est = (opsViaEstaciones || []).find(e => opsNormalizaTexto([e.nombre_comercial, e.razon_social, e.codigo_estacion_cre].join(" ")).includes(q));
        }
        if (est) return opsViaElegirEstacion(est.id, fo);
        if (fo.estacionLat && fo.estacionLng) {
            opsViaForm.estacion = null;
            opsViaForm.destinoTexto = fo.estacion || fo.estacionDireccion || "";
            opsViaForm.lat = Number(fo.estacionLat); opsViaForm.lng = Number(fo.estacionLng); opsViaForm.coordAprox = false;
            return opsViaCalcularRuta();
        }
        if (fo.estacionDireccion || fo.estacion) return opsViaDireccionLibre(fo.estacionDireccion || fo.estacion);
        opsViaPintarFormulario();
    };
    window.opsViaElegirEstacion = async function (id) {
        const e = (opsViaEstaciones || []).find(x => x.id === id);
        if (!e || !opsViaForm) return;
        opsViaForm.estacion = e;
        opsViaForm.destinoTexto = opsViaNombreEstacion(e);
        opsViaForm.coordAprox = false;
        if (e.lat && e.lng) { opsViaForm.lat = e.lat; opsViaForm.lng = e.lng; }
        else {
            opsViaForm.calculando = true; opsViaPintarFormulario();
            // Sin coordenadas en el catálogo: se ubica por dirección (gratis, OpenStreetMap)
            // y se guarda en estaciones_servicio para que la próxima vez ya esté.
            let p = await opsGeocodificarNominatim(`${e.direccion_normalizada || e.domicilio_raw || ""}, México`);
            if (!p) p = await opsGeocodificarNominatim(`${e.municipio || ""}, ${e.estado || "Chihuahua"}, México`);
            if (!p) { opsViaForm.calculando = false; opsViaPintarFormulario(); alert("No se pudo ubicar la estación en el mapa. Arrastra el pin o escribe la dirección."); return; }
            opsViaForm.lat = p.lat; opsViaForm.lng = p.lng; opsViaForm.coordAprox = true;
            opsViaGuardarCoordEstacion(e, p.lat, p.lng);
        }
        return opsViaCalcularRuta();
    };
    window.opsViaDireccionLibre = async function (texto) {
        if (!texto || !opsViaForm) return;
        opsViaForm.estacion = null; opsViaForm.destinoTexto = texto; opsViaForm.calculando = true;
        opsViaPintarFormulario();
        const p = await opsGeocodificarNominatim(/méxico|mexico/i.test(texto) ? texto : texto + ", Chihuahua, México");
        if (!p) { opsViaForm.calculando = false; opsViaPintarFormulario(); alert("No se encontró esa dirección."); return; }
        opsViaForm.lat = p.lat; opsViaForm.lng = p.lng; opsViaForm.coordAprox = true;
        return opsViaCalcularRuta();
    };
    async function opsViaGuardarCoordEstacion(e, lat, lng) {
        e.lat = lat; e.lng = lng;
        try {
            const sb = await opsSb();
            await sb.from("estaciones_servicio").update({ lat, lng, actualizado_en: new Date().toISOString() }).eq("id", e.id);
        } catch (err) { console.warn("[viáticos] no se pudo guardar la ubicación de la estación:", err && err.message); }
    }
    async function opsViaCalcularRuta() {
        const f = opsViaForm; if (!f || !f.lat) return;
        f.calculando = true; opsViaPintarFormulario();
        const o = opsViaCfg.origen;
        f.rutaGeo = null;
        try {
            const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${o.lng},${o.lat};${f.lng},${f.lat}?overview=simplified&geometries=geojson`);
            const data = await resp.json();
            const r = data.routes && data.routes[0];
            if (r) {
                f.kmSencillo = Math.round(r.distance / 100) / 10;
                f.horasIda = Math.round((r.duration / 3600) * 100) / 100;
                f.rutaGeo = r.geometry && r.geometry.coordinates ? r.geometry.coordinates.map(c => [c[1], c[0]]) : null;
            }
        } catch (e) { console.warn("[viáticos] OSRM:", e); }
        if (!f.rutaGeo) {
            // Respaldo: línea recta × 1.3 (factor típico de carretera) para no dejar el cálculo en cero.
            const R = 6371, rad = x => x * Math.PI / 180;
            const dLat = rad(f.lat - o.lat), dLng = rad(f.lng - o.lng);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(o.lat)) * Math.cos(rad(f.lat)) * Math.sin(dLng / 2) ** 2;
            f.kmSencillo = Math.round(2 * R * Math.asin(Math.sqrt(a)) * 1.3 * 10) / 10;
            f.horasIda = Math.round((f.kmSencillo / 80) * 100) / 100;
        }
        f.calculando = false;
        opsViaRecalcular();
        opsViaPintarFormulario();
    }
    function opsViaPintarMapa() {
        const el = document.getElementById("via-mapa");
        if (!el || typeof L === "undefined") return;
        if (opsViaMapa) { try { opsViaMapa.remove(); } catch (e) {} opsViaMapa = null; }
        const f = opsViaForm, o = opsViaCfg.origen;
        opsViaMapa = L.map(el, { attributionControl: false }).setView([o.lat, o.lng], 10);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18 }).addTo(opsViaMapa);
        const icono = color => L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });
        L.marker([o.lat, o.lng], { icon: icono("#1D2E73") }).addTo(opsViaMapa).bindTooltip(o.nombre);
        if (f && f.lat) {
            const m = L.marker([f.lat, f.lng], { icon: icono("#E7402B"), draggable: true }).addTo(opsViaMapa).bindTooltip(f.destinoTexto || "Destino");
            m.on("dragend", () => {
                const p = m.getLatLng();
                f.lat = p.lat; f.lng = p.lng; f.coordAprox = false;
                if (f.estacion) opsViaGuardarCoordEstacion(f.estacion, p.lat, p.lng);
                opsViaCalcularRuta();
            });
            if (f.rutaGeo) L.polyline(f.rutaGeo, { color: "#1D2E73", weight: 4, opacity: 0.8 }).addTo(opsViaMapa);
            opsViaMapa.fitBounds(L.latLngBounds([[o.lat, o.lng], [f.lat, f.lng]]).pad(0.25));
        }
        setTimeout(() => { try { opsViaMapa && opsViaMapa.invalidateSize(); } catch (e) {} }, 60);
    }

    window.opsViaGuardar = async function () {
        const f = opsViaForm; if (!f) return;
        if (!f.lat) { alert("Elige la estación o dirección destino."); return; }
        if (!f.tecnicos.length) { alert("Marca al menos a una persona que viaja."); return; }
        if (!f.salida) { alert("Indica la fecha y hora de salida."); return; }
        const btn = document.getElementById("via-btn-guardar");
        if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
        const veh = opsViaVehiculoCfg(f.tipoVehiculo);
        const fila = {
            estatus: "Pendiente",
            solicitante_email: opsUsuarioActual(), solicitante_nombre: opsNombreActual(),
            folio_servicio: f.folioServicio || null, cliente: f.cliente || (f.estacion ? f.estacion.razon_social : null),
            destino: f.destinoTexto, motivo: null,
            fecha_salida: f.salida.slice(0, 10), fecha_regreso: (f.regreso || f.salida).slice(0, 10),
            dias: Math.max(1, opsViaNum(f.noches) + 1), personas: f.personas,
            integrantes: f.tecnicos.map(t => t.nombre).join(", "),
            km_sencillo: opsViaNum(f.kmSencillo), tipo_vehiculo: veh.nombre || f.tipoVehiculo, vehiculo: f.vehiculo || null,
            rendimiento: opsViaNum(f.rendimiento), precio_litro: opsViaNum(f.precioLitro), factor: opsViaNum(f.factor), gasolina: f.gasolina,
            desayunos: f.desayunos, comidas: f.comidas, cenas: f.cenas, alimentos: f.alimentos,
            hospedaje: f.hospedaje, casetas: opsViaNum(f.casetas), otros: opsViaNum(f.otros), total: f.total,
            notas: f.notas || null,
            tarifas: {
                requiereViaticos: !!f.requiere, salida: f.salida, regreso: f.regreso, horasServicio: opsViaNum(f.horasServicio), horasIda: opsViaNum(f.horasIda),
                noches: opsViaNum(f.noches), hospedajePorNoche: opsViaNum(f.hospedajePorNoche), desayuno: opsViaCfg.desayuno, comida: opsViaCfg.comida, cena: opsViaCfg.cena,
                estacionId: f.estacion ? f.estacion.id : null, lat: f.lat, lng: f.lng, tecnicos: f.tecnicos,
            },
        };
        try {
            const sb = await opsSb();
            const { data, error } = await sb.from("ops_solicitudes_viaticos").insert(fila).select().single();
            if (error) throw error;
            const folio = "VIA-" + String(data.id).padStart(5, "0");
            await sb.from("ops_solicitudes_viaticos").update({ folio }).eq("id", data.id);
            data.folio = folio;
            const resumen = opsViaResumenTexto(data);
            (opsViaCfg.correosNotificar || []).forEach(correo => opsCopiaFirestore((db, fs) => window.tcNotificar2(fs, db, {
                tipo: "viaticos_solicitud", para: correo, mensaje: `${opsNombreActual()} solicita viáticos ${folio}: ${data.destino} · ${opsViaDinero(data.total)}.`,
                leido: false, creadaEn: new Date().toISOString(),
            }).catch(() => {})));
            opsViaCerrar();
            opsViaMostrarEnviada(data, resumen);
            if (tabActual === "viaticos") opsRenderViaticos();
        } catch (e) {
            console.error("[viáticos] error al guardar:", e);
            alert("No se pudo guardar la solicitud: " + (e.message || e));
            if (btn) { btn.disabled = false; btn.textContent = "Enviar solicitud"; }
        }
    };
    function opsViaResumenTexto(s) {
        const t = s.tarifas || {};
        return `SOLICITUD DE VIÁTICOS ${s.folio}\n`
            + `Solicita: ${s.solicitante_nombre || s.solicitante_email || ""}\n`
            + `Destino: ${s.destino || ""}${s.folio_servicio ? " (servicio " + s.folio_servicio + ")" : ""}\n`
            + `Personal (${s.personas}): ${s.integrantes || ""}\n`
            + `Salida: ${(t.salida || s.fecha_salida || "").replace("T", " ")} · Regreso: ${(t.regreso || s.fecha_regreso || "").replace("T", " ")}\n`
            + `Distancia: ${opsViaNum(s.km_sencillo).toFixed(1)} km sencillo · Vehículo: ${s.tipo_vehiculo || ""} ${s.vehiculo || ""}\n\n`
            + `Gasolina: ${opsViaDinero(s.gasolina)} (${s.km_sencillo} km × 2 ÷ ${s.rendimiento} km/l × $${s.precio_litro} × ${s.factor})\n`
            + `Alimentos: ${opsViaDinero(s.alimentos)} (${s.desayunos} desayuno(s), ${s.comidas} comida(s), ${s.cenas} cena(s) por persona)\n`
            + `Hospedaje: ${opsViaDinero(s.hospedaje)}${t.noches ? " (" + t.noches + " noche(s))" : ""}\n`
            + `Casetas: ${opsViaDinero(s.casetas)} · Otros: ${opsViaDinero(s.otros)}\n`
            + `TOTAL: ${opsViaDinero(s.total)}\n`
            + (s.notas ? `\nNotas: ${s.notas}\n` : "");
    }
    function opsViaMostrarEnviada(s, resumen) {
        const correos = (opsViaCfg.correosNotificar || []).join(",");
        const mailto = `mailto:${correos}?subject=${encodeURIComponent("Solicitud de viáticos " + s.folio + " — " + (s.destino || ""))}&body=${encodeURIComponent(resumen)}`;
        const wa = `https://wa.me/?text=${encodeURIComponent(resumen)}`;
        document.getElementById("ops-modal-wrap").innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:520px;max-width:96vw;padding:22px;">
                <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px;color:#15803d;margin-bottom:6px;">✅ Solicitud ${opsEsc(s.folio)} registrada</div>
                <div style="font-size:12.5px;color:#475569;margin-bottom:12px;">Quedó en la lista de Viáticos con estatus <b>Pendiente</b> y se avisó en el portal a Cristina Acosta y a Pagos. Para asegurarte de que la vean hoy, mándala también por correo o WhatsApp:</div>
                <pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:11.5px;white-space:pre-wrap;max-height:240px;overflow-y:auto;">${opsEsc(resumen)}</pre>
                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cerrar</button>
                    <a href="${wa}" target="_blank" rel="noopener" class="mkt-add-btn" style="background:#15803d;text-decoration:none;">WhatsApp</a>
                    <a href="${mailto}" class="mkt-add-btn" style="background:#1D2E73;text-decoration:none;">Enviar por correo</a>
                </div>
            </div>
        </div>`;
    }
    window.opsViaVerDetalle = function (id) {
        const s = opsViaLista.find(x => x.id === id);
        if (s) opsViaMostrarEnviada(s, opsViaResumenTexto(s));
    };

    // ── Tarifas editables ──
    window.opsViaAbrirTarifas = async function () {
        await opsViaCargarCfg();
        const c = opsViaCfg;
        const campo = (label, key, valor, tipo = "number") => opsViaInput(label, "via-cfg-" + key, valor, `data-key="${key}"`, tipo);
        document.getElementById("ops-modal-wrap").innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
            <div style="background:#fff;border-radius:14px;width:640px;max-width:96vw;max-height:92vh;overflow-y:auto;padding:22px;">
                <div style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:16px;color:#1D2E73;margin-bottom:12px;">Tarifas de viáticos (editables)</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 10px;">
                    ${campo("Desayuno $", "desayuno", c.desayuno)}${campo("Comida $", "comida", c.comida)}${campo("Cena $", "cena", c.cena)}
                    ${campo("Hora límite desayuno", "horaDesayuno", c.horaDesayuno, "time")}${campo("Hora comida", "horaComida", c.horaComida, "time")}${campo("Hora cena", "horaCena", c.horaCena, "time")}
                    ${campo("Tope diario $", "topeDiario", c.topeDiario)}${campo("Precio litro $", "precioLitro", c.precioLitro)}${campo("Factor gasolina", "factor", c.factor)}
                    ${campo("Km × (ida y vuelta)", "multiplicadorKm", c.multiplicadorKm)}${campo("Km mínimos p/ viáticos", "kmMinimoViaticos", c.kmMinimoViaticos)}${campo("Hotel $/noche", "hospedajePorNoche", c.hospedajePorNoche)}
                </div>
                <div style="font-weight:700;font-size:12.5px;color:#1D2E73;margin:6px 0 6px;">Rendimiento por tipo de vehículo (km/l)</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 10px;">
                    ${(c.vehiculos || []).map((v, i) => opsViaInput(opsEsc(v.nombre), "via-cfg-veh-" + i, v.rendimiento, `data-veh="${i}"`, "number")).join("")}
                </div>
                <div style="font-weight:700;font-size:12.5px;color:#1D2E73;margin:6px 0 6px;">Punto de partida</div>
                <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:0 10px;">
                    ${opsViaInput("Nombre", "via-cfg-onombre", c.origen.nombre)}${opsViaInput("Latitud", "via-cfg-olat", c.origen.lat, "", "number")}${opsViaInput("Longitud", "via-cfg-olng", c.origen.lng, "", "number")}
                </div>
                ${opsViaInput("Correos a notificar (separados por coma)", "via-cfg-correos", (c.correosNotificar || []).join(", "))}
                <div style="display:flex;gap:8px;justify-content:flex-end;">
                    <button onclick="document.getElementById('ops-modal-wrap').innerHTML=''" style="background:#f1f5f9;border:none;color:#475569;padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;">Cancelar</button>
                    <button onclick="opsViaGuardarTarifas()" class="mkt-add-btn" style="background:#1D2E73;">Guardar tarifas</button>
                </div>
            </div>
        </div>`;
    };
    window.opsViaGuardarTarifas = async function () {
        const nuevo = JSON.parse(JSON.stringify(opsViaCfg));
        document.querySelectorAll("[data-key]").forEach(inp => {
            const k = inp.getAttribute("data-key");
            nuevo[k] = inp.type === "number" ? Number(inp.value) : inp.value;
        });
        document.querySelectorAll("[data-veh]").forEach(inp => { const i = Number(inp.getAttribute("data-veh")); if (nuevo.vehiculos[i]) nuevo.vehiculos[i].rendimiento = Number(inp.value) || nuevo.vehiculos[i].rendimiento; });
        nuevo.origen = { nombre: document.getElementById("via-cfg-onombre").value, lat: Number(document.getElementById("via-cfg-olat").value), lng: Number(document.getElementById("via-cfg-olng").value) };
        nuevo.correosNotificar = document.getElementById("via-cfg-correos").value.split(",").map(x => x.trim()).filter(Boolean);
        try {
            const sb = await opsSb();
            const { error } = await sb.from("ops_config_viaticos_solicitud").upsert({ id: "general", datos: nuevo, actualizado_en: new Date().toISOString(), actualizado_por: opsUsuarioActual() });
            if (error) throw error;
            opsViaCfg = nuevo;
            document.getElementById("ops-modal-wrap").innerHTML = "";
            if (window.mostrarPush) window.mostrarPush("Viáticos", "Tarifas actualizadas.", "✅");
        } catch (e) { alert("No se pudieron guardar las tarifas: " + (e.message || e)); }
    };

})();
