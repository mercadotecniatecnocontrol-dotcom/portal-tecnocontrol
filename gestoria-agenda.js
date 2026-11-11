// ═════════════════════════════════════════════════════════════════
//  gestoria-agenda.js — Calendario del departamento de Gestoría (11-nov-2026)
// ═════════════════════════════════════════════════════════════════
//  Gestoría sale de Operaciones y tiene su propio calendario. Solo lo ve y lo
//  usa el personal de Gestoría (lista GAG_EQUIPO) y los administradores del portal.
//
//  Datos (Supabase, tabla ops_docs vía window.tcOpsFS — nada en Firebase):
//    · ops_gest_agenda      → actividades del calendario (citas, visitas, vencimientos, tareas…)
//    · ops_gestoria_ventas  → ventas de gestoría con sus trámites (las mismas que antes
//                             vivían en Operaciones → Gestoría). Cada trámite con fecha
//                             compromiso sale en el calendario.
//
//  Vistas: Equipo (persona × día, arrastrar y soltar), Semana (por horas), Mes y Trámites.
//  API global: window.gestoriaAgendaMontar(elemento)
// ═════════════════════════════════════════════════════════════════
(function () {
    'use strict';
    if (window.gestoriaAgendaMontar) return;

    const COL_AGENDA = 'ops_gest_agenda';
    const COL_VENTAS = 'ops_gestoria_ventas';
    const NAVY = '#1D2E73', ROJO = '#E7402B';

    // Personal de Gestoría (orden alfabético). Solo ellos y los administradores del portal entran.
    const GAG_EQUIPO = [
        { correo: 'd.gutierrez@tecnocontrol.com.mx', nombre: 'Denisse Gutiérrez', puesto: 'Gerente de Gestoría', color: '#1D2E73' },
        { correo: 'gestoria@tecnocontrol.com.mx', nombre: 'Gestoría (cuenta general)', puesto: 'Cuenta del área', color: '#64748B' },
        { correo: 'calidad@tecnocontrol.com.mx', nombre: 'Jaqueline Campos', puesto: 'Calidad', color: '#E7402B' },
        { correo: 'gestoria4@tecnocontrol.com.mx', nombre: 'Karen Escalante', puesto: 'Gestoría', color: '#2563EB' },
        { correo: 'gestoria3@tecnocontrol.com.mx', nombre: 'Kenia Guzmán', puesto: 'Gestoría', color: '#B91C1C' },
        { correo: 'gestoria1@tecnocontrol.com.mx', nombre: 'Lizeth Muñoz Blanco', puesto: 'Gestoría', color: '#0E7490' },
        { correo: 'gestoria2@tecnocontrol.com.mx', nombre: 'Zaira Sibel Parra Blanco', puesto: 'Gestoría', color: '#7C3AED' },
    ];
    const SIN_ASIGNAR = '__sin';

    const TIPOS = {
        tramite:     { n: 'Trámite', c: '#1D2E73', bg: '#E8ECF8' },
        cita:        { n: 'Cita en dependencia', c: '#E7402B', bg: '#FDECE9' },
        visita:      { n: 'Visita a estación', c: '#2563EB', bg: '#E6EFFE' },
        vencimiento: { n: 'Vencimiento / vigencia', c: '#B91C1C', bg: '#FDE8E8' },
        entrega:     { n: 'Entrega al cliente', c: '#0E7490', bg: '#E2F4F7' },
        tarea:       { n: 'Tarea interna', c: '#475569', bg: '#EEF2F6' },
        junta:       { n: 'Junta', c: '#7C3AED', bg: '#F0EAFE' },
    };
    const ESTATUS = {
        pendiente:    { n: 'Pendiente', c: '#475569', bg: '#F1F5F9' },
        proceso:      { n: 'En proceso', c: '#1D4ED8', bg: '#DBEAFE' },
        docs_cliente: { n: 'Esperando documentos del cliente', c: '#B45309', bg: '#FEF3C7' },
        dependencia:  { n: 'En la dependencia', c: '#7C3AED', bg: '#EDE9FE' },
        entregado:    { n: 'Terminado / entregado', c: '#15803D', bg: '#DCFCE7' },
        cancelado:    { n: 'Cancelado', c: '#B91C1C', bg: '#FEE2E2' },
    };
    const PRIORIDAD = { normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
    const DEPENDENCIAS = ['ASEA', 'CNE (antes CRE)', 'SEMARNAT', 'PROFECO', 'STPS', 'Protección Civil estatal', 'Protección Civil municipal', 'Municipio (licencias)', 'SAT', 'Secretaría de Desarrollo Urbano', 'Otra'];
    const CATALOGO_TRAMITES = ['Análisis de riesgo sector hidrocarburos', 'Dictamen de construcción NOM-005-ASEA-2016', 'Dictamen de diseño NOM-005-ASEA-2016', 'Dictamen NOM-005-ASEA-2016 operación y mantenimiento',
        'Dictamen NOM-016-CRE-2016', 'Dictaminación SASISOPA', 'Evaluación de impacto social (EVIS)', 'Informe de laboratorio calidad de petrolíferos (por tanque)', 'Licencia de funcionamiento',
        'Manual de procedimientos y bitácora NOM-005-ASEA-2016', 'Número de registro ambiental (NRA)', 'Pre registro ante portal OPE 2.0 ASEA', 'Pre registro ante portal OPE CNE y solicitud de permiso',
        'Registro como generador de residuos de manejo especial', 'Registro como generador de residuos peligrosos', 'SASISOPA (manuales, procedimientos, formatos e ingreso ASEA)'];
    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const H_INI = 7, H_FIN = 21, H_PX = 56;

    const I = (p, s) => `<svg width="${s || 16}" height="${s || 16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    const IC = {
        mas: I('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'),
        izq: I('<polyline points="15 18 9 12 15 6"/>'), der: I('<polyline points="9 18 15 12 9 6"/>'),
        buscar: I('<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>', 15),
        cerrar: I('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
        reloj: I('<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>', 13),
        lugar: I('<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>', 13),
        persona: I('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>', 13),
        edificio: I('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>', 13),
        alerta: I('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', 14),
        check: I('<polyline points="20 6 9 17 4 12"/>', 13),
        editar: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>', 14),
        borrar: I('<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>', 14),
        cal: I('<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'),
        doc: I('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>', 14),
        candado: I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 30),
        hoy: I('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/>', 14),
        comentario: I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', 14),
        semana: I('<rect x="3" y="4" width="18" height="17" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="21"/><line x1="15" y1="10" x2="15" y2="21"/>', 15),
    };

    // ───────────── estado ─────────────
    const S = {
        vista: 'equipo', ref: hoyD(), q: '', personas: null, tipos: new Set(Object.keys(TIPOS)),
        eventos: [], ventas: [], cargando: true, error: null, sel: null, subs: false, el: null, filtroTram: 'abiertas',
        verTerminados: false,
    };
    let FS = null;

    // ───────────── utilidades ─────────────
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function hoyD() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function isoHora(d) { return iso(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
    function aFecha(s) { if (!s) return null; const t = String(s); const d = new Date(t.length <= 10 ? t + 'T00:00' : t.slice(0, 16)); return isNaN(d) ? null : d; }
    function sumarDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function lunes(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
    function mismoDia(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function diaSolo(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
    function difDias(a, b) { return Math.round((diaSolo(b) - diaSolo(a)) / 86400000); }
    function hora(d) { let h = d.getHours(), m = d.getMinutes(); const ap = h >= 12 ? 'p. m.' : 'a. m.'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; }
    function fechaLarga(d) { return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear(); }
    function fechaCorta(d) { return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); }
    function dinero(n) { return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
    function alfa(a, b) { return String(a).localeCompare(String(b), 'es', { sensitivity: 'base' }); }
    function correoActual() { return String((window.auth && window.auth.currentUser && window.auth.currentUser.email) || '').toLowerCase().trim(); }
    function esAdmin() { return !!(window.esAdminTotal && window.esAdminTotal(correoActual())); }
    function miembro(c) { return GAG_EQUIPO.find(p => p.correo === String(c || '').toLowerCase()); }
    function puedeVer() { const c = correoActual(); return esAdmin() || !!miembro(c); }
    function puedeEditar() { return puedeVer(); }
    function nombreActual() { const c = correoActual(); const m = miembro(c); return m ? m.nombre : ((window.nombreUsuario && window.nombreUsuario(c)) || c || 'Usuario'); }
    function nombreDe(c) { const m = miembro(c); return m ? m.nombre : (c === SIN_ASIGNAR ? 'Sin asignar' : c); }
    function iniciales(n) { return String(n || '').replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
    function avatar(p, t) { t = t || 30; return `<span class="gag-av" style="width:${t}px;height:${t}px;background:${p.color};font-size:${Math.round(t * 0.38)}px;">${esc(iniciales(p.nombre))}</span>`; }
    function toast(t, err) {
        let el = document.getElementById('gag-toast'); if (!el) { el = document.createElement('div'); el.id = 'gag-toast'; document.body.appendChild(el); }
        el.textContent = t; el.className = 'gag-toast mostrar' + (err ? ' err' : ''); clearTimeout(el._t); el._t = setTimeout(() => { el.className = 'gag-toast'; }, 3200);
    }
    function avisar(para, mensaje) {
        if (!para || para === correoActual() || !window.tcNotificar) return;
        window.tcNotificar({ tipo: 'gestoria_agenda', para, mensaje, modulo: 'Gestoría' }).catch(() => {});
    }

    // ───────────── datos ─────────────
    async function fs() { if (FS) return FS; if (!window.tcOpsFS) throw new Error('Falta operaciones-supabase.js'); FS = await window.tcOpsFS(null); return FS; }
    async function suscribir() {
        if (S.subs) return; S.subs = true;
        try {
            const f = await fs();
            let listos = 0; const listo = () => { listos++; if (listos >= 2) { S.cargando = false; recordatorio(); } pintar(); };
            f.onSnapshot(f.collection(null, COL_AGENDA), snap => { S.eventos = snap.docs.map(d => ({ id: d.id, ...d.data() })); listo(); }, e => { S.error = e.message || String(e); pintar(); });
            f.onSnapshot(f.collection(null, COL_VENTAS), snap => { S.ventas = snap.docs.map(d => ({ id: d.id, ...d.data() })); listo(); }, e => { S.error = e.message || String(e); pintar(); });
        } catch (e) { S.error = e.message || String(e); S.cargando = false; pintar(); }
    }
    async function guardarEvento(id, datos) {
        const f = await fs();
        if (id) { await f.updateDoc(f.doc(null, COL_AGENDA, id), datos); return id; }
        const r = await f.addDoc(f.collection(null, COL_AGENDA), datos); return r.id;
    }
    async function guardarVenta(v, cambios) { const f = await fs(); await f.updateDoc(f.doc(null, COL_VENTAS, v.id), cambios); Object.assign(v, cambios); }

    // Unifica actividades + trámites en una sola lista para el calendario.
    function items() {
        const out = [];
        S.eventos.forEach(e => {
            const ini = aFecha(e.inicio); if (!ini) return;
            let fin = aFecha(e.fin) || ini; if (fin < ini) fin = ini;
            out.push({ id: e.id, src: 'agenda', raw: e, titulo: e.titulo || 'Actividad', tipo: TIPOS[e.tipo] ? e.tipo : 'tarea', ini, fin, todoDia: !!e.todoElDia,
                resp: (e.responsables || []).length ? e.responsables : [SIN_ASIGNAR], estatus: e.estatus || 'pendiente', prioridad: e.prioridad || 'normal',
                cliente: e.cliente || '', lugar: e.estacion || '', dependencia: e.dependencia || '' });
        });
        S.ventas.forEach(v => (v.partidas || []).forEach((p, i) => {
            if (!p.fechaCompromiso) return;
            const ini = aFecha(p.fechaInicio || p.fechaCompromiso), fin = aFecha(p.fechaCompromiso) || ini; if (!ini) return;
            out.push({ id: v.id + '#' + i, src: 'tramite', raw: p, venta: v, idx: i, titulo: p.nombre || 'Trámite', tipo: 'tramite', ini: ini > fin ? fin : ini, fin, todoDia: true,
                resp: p.responsable ? [p.responsable] : [SIN_ASIGNAR], estatus: p.estatus || 'pendiente', prioridad: p.prioridad || 'normal', cliente: v.cliente || '', lugar: '', dependencia: p.dependencia || '' });
        }));
        return out;
    }
    function cerrado(it) { return it.estatus === 'entregado' || it.estatus === 'cancelado'; }
    // Solo lo que tiene fecha límite se marca atrasado; una cita, visita o junta que ya pasó no.
    function atrasado(it) { return !cerrado(it) && !['cita', 'visita', 'junta'].includes(it.tipo) && diaSolo(it.fin) < hoyD(); }
    function personasActivas() { if (!S.personas) S.personas = new Set(GAG_EQUIPO.map(p => p.correo).concat([SIN_ASIGNAR])); return S.personas; }
    function filtrados() {
        const ps = personasActivas(), q = norm(S.q);
        return items().filter(it => S.tipos.has(it.tipo) && it.resp.some(r => ps.has(r)) && (S.verTerminados || it.estatus !== 'cancelado')
            && (!q || norm([it.titulo, it.cliente, it.lugar, it.dependencia, it.resp.map(nombreDe).join(' ')].join(' ')).includes(q)));
    }
    function enRango(it, a, b) { return diaSolo(it.ini) <= diaSolo(b) && diaSolo(it.fin) >= diaSolo(a); }

    // ───────────── estilos ─────────────
    function estilos() {
        if (document.getElementById('gag-css')) return;
        const st = document.createElement('style'); st.id = 'gag-css';
        st.textContent = `
        .gag,.gag-dr,.gag-md{--n:${NAVY};--r:${ROJO};--b:#E4E8F1;--t:#0F172A;--t2:#475569;--t3:#94A3B8;--bg:#F5F7FB;}
        .gag{font-family:'DM Sans',system-ui,sans-serif;color:var(--t);background:var(--bg);min-height:100vh;padding:18px 20px 30px;box-sizing:border-box;}
        .gag *{box-sizing:border-box;}
        .gag button{font-family:inherit;}
        .gag-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:14px;}
        .gag-eyebrow{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--r);}
        .gag-h1{font-size:24px;font-weight:800;color:var(--n);letter-spacing:-.02em;line-height:1.15;}
        .gag-sub{font-size:12.5px;color:var(--t2);margin-top:2px;}
        .gag-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--b);background:#fff;color:var(--t);border-radius:10px;padding:8px 13px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s,border-color .15s;white-space:nowrap;}
        .gag-btn:hover{border-color:#C7CFE0;background:#FAFBFE;}
        .gag-btn.pri{background:var(--n);border-color:var(--n);color:#fff;}
        .gag-btn.pri:hover{background:#15225A;}
        .gag-btn.rojo{background:var(--r);border-color:var(--r);color:#fff;}
        .gag-btn.ico{padding:8px;width:36px;height:36px;justify-content:center;}
        .gag-btn.chico{padding:5px 9px;font-size:12px;border-radius:8px;}
        .gag-seg{display:inline-flex;background:#fff;border:1px solid var(--b);border-radius:11px;padding:3px;gap:2px;}
        .gag-seg button{border:none;background:transparent;border-radius:8px;padding:7px 13px;font-size:12.5px;font-weight:700;color:var(--t2);cursor:pointer;}
        .gag-seg button.on{background:var(--n);color:#fff;}
        .gag-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px;}
        .gag-kpi{background:#fff;border:1px solid var(--b);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:border-color .15s;}
        .gag-kpi:hover{border-color:#C7CFE0;}
        .gag-kpi-n{font-size:22px;font-weight:800;line-height:1;}
        .gag-kpi-t{font-size:11.5px;color:var(--t2);margin-top:3px;}
        .gag-kpi-i{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .gag-layout{display:grid;grid-template-columns:262px minmax(0,1fr);gap:14px;align-items:start;}
        .gag-side{display:flex;flex-direction:column;gap:12px;position:sticky;top:12px;}
        .gag-card{background:#fff;border:1px solid var(--b);border-radius:16px;}
        .gag-card-h{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 6px;font-size:12px;font-weight:800;color:var(--t);text-transform:uppercase;letter-spacing:.05em;}
        .gag-mini{padding:4px 12px 12px;}
        .gag-mini-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;text-align:center;}
        .gag-mini-g span{font-size:10.5px;color:var(--t3);font-weight:700;padding:4px 0;}
        .gag-mini-g button{border:none;background:transparent;font-size:12px;border-radius:8px;height:29px;cursor:pointer;color:var(--t);position:relative;}
        .gag-mini-g button:hover{background:#EEF1F8;}
        .gag-mini-g button.fuera{color:#CBD2DF;}
        .gag-mini-g button.sem{background:#EEF1F8;}
        .gag-mini-g button.hoy{background:var(--r);color:#fff;font-weight:800;}
        .gag-mini-g button i{position:absolute;bottom:3px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--n);}
        .gag-mini-g button.hoy i{background:#fff;}
        .gag-per{display:flex;align-items:center;gap:9px;padding:6px 14px;cursor:pointer;font-size:12.5px;}
        .gag-per:hover{background:#F7F9FD;}
        .gag-per input{accent-color:var(--n);width:15px;height:15px;cursor:pointer;}
        .gag-per .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .gag-per .ct{font-size:11px;color:var(--t3);font-weight:700;}
        .gag-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex-shrink:0;letter-spacing:.02em;}
        .gag-tipo{display:flex;align-items:center;gap:8px;padding:5px 14px;font-size:12.5px;cursor:pointer;}
        .gag-tipo .dot{width:10px;height:10px;border-radius:3px;flex-shrink:0;}
        .gag-tipo.off{opacity:.38;}
        .gag-prox{padding:4px 8px 10px;max-height:300px;overflow-y:auto;}
        .gag-prox-i{display:flex;gap:10px;padding:8px 6px;border-radius:10px;cursor:pointer;align-items:flex-start;}
        .gag-prox-i:hover{background:#F7F9FD;}
        .gag-prox-f{width:40px;flex-shrink:0;text-align:center;border-radius:9px;padding:4px 0;background:#F1F4FA;}
        .gag-prox-f b{display:block;font-size:15px;line-height:1.1;color:var(--n);}
        .gag-prox-f small{font-size:9.5px;text-transform:uppercase;color:var(--t2);font-weight:700;}
        .gag-prox-f.atr{background:#FDECE9;} .gag-prox-f.atr b{color:var(--r);}
        .gag-main{min-width:0;}
        .gag-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid var(--b);}
        .gag-bar-t{font-size:16px;font-weight:800;color:var(--t);margin-right:auto;}
        .gag-search{display:flex;align-items:center;gap:7px;border:1px solid var(--b);border-radius:10px;padding:0 10px;height:36px;background:#fff;color:var(--t3);min-width:220px;}
        .gag-search input{border:none;outline:none;font-size:13px;flex:1;min-width:0;background:transparent;color:var(--t);}
        /* Vista equipo */
        .gag-eq{overflow-x:auto;}
        .gag-eq-in{min-width:880px;}
        .gag-eq-head,.gag-eq-row{display:grid;grid-template-columns:200px repeat(7,minmax(92px,1fr));}
        .gag-eq-head>div{padding:10px 6px;text-align:center;border-bottom:1px solid var(--b);}
        .gag-eq-head .lbl{text-align:left;padding-left:14px;font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;}
        .gag-dh small{display:block;font-size:11px;color:var(--t3);font-weight:700;text-transform:uppercase;}
        .gag-dh b{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;font-size:16px;margin-top:3px;color:var(--t);}
        .gag-dh.hoy b{background:var(--n);color:#fff;}
        .gag-dh.finde small{color:#C0C8D8;}
        .gag-eq-row{border-bottom:1px solid #EEF1F7;}
        .gag-eq-row:last-child{border-bottom:none;}
        .gag-eq-per{display:flex;align-items:center;gap:10px;padding:10px 12px 10px 14px;border-right:1px solid #EEF1F7;min-width:0;}
        .gag-eq-per .nm{font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .gag-eq-per .ps{font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .gag-eq-body{grid-column:2 / span 7;position:relative;}
        .gag-eq-cells{position:absolute;inset:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));}
        .gag-eq-cells>div{border-right:1px solid #F1F3F8;position:relative;}
        .gag-eq-cells>div.finde{background:#FAFBFD;}
        .gag-eq-cells>div.hoy{background:#F4F6FC;}
        .gag-eq-cells>div.drop{background:#E8ECF8;outline:2px dashed var(--n);outline-offset:-3px;}
        .gag-eq-cells>div .add{position:absolute;right:5px;bottom:5px;width:24px;height:24px;border-radius:8px;border:1px dashed #B8C2D8;background:#fff;color:var(--n);display:none;align-items:center;justify-content:center;cursor:pointer;}
        .gag-eq-cells>div:hover .add{display:flex;}
        .gag-eq-cards{position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));grid-auto-rows:50px;row-gap:6px;padding:7px 0 34px;pointer-events:none;min-height:64px;}
        .gag-ev{pointer-events:auto;margin:0 4px;border-radius:10px;padding:6px 9px;font-size:11.5px;line-height:1.25;cursor:pointer;overflow:hidden;border:1px solid transparent;border-left-width:4px;transition:box-shadow .15s,transform .15s;position:relative;}
        .gag-ev:hover{box-shadow:0 6px 16px rgba(15,23,42,.10);transform:translateY(-1px);}
        .gag-ev b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;}
        .gag-ev span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--t2);font-size:11px;}
        .gag-ev.cerr{opacity:.55;}
        .gag-ev.cerr b{text-decoration:line-through;}
        .gag-ev .flag{position:absolute;top:5px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--r);}
        .gag-ev.atr{border-color:#F6C3BA;}
        /* Vista semana por horas */
        .gag-wk{overflow-x:auto;}
        .gag-wk-in{min-width:820px;}
        .gag-wk-head,.gag-wk-allday,.gag-wk-grid{display:grid;grid-template-columns:62px repeat(7,minmax(100px,1fr));}
        .gag-wk-head>div{padding:10px 4px;text-align:center;border-bottom:1px solid var(--b);}
        .gag-wk-allday{border-bottom:1px solid var(--b);background:#FBFCFE;}
        .gag-wk-allday>div{padding:5px 3px;min-height:34px;border-right:1px solid #F1F3F8;display:flex;flex-direction:column;gap:3px;}
        .gag-wk-allday .lbl{font-size:10px;color:var(--t3);font-weight:700;justify-content:center;align-items:center;text-align:center;}
        .gag-wk-grid{position:relative;max-height:640px;overflow-y:auto;}
        .gag-wk-hrs>div{height:${H_PX}px;font-size:10.5px;color:var(--t3);text-align:right;padding-right:8px;transform:translateY(-7px);}
        .gag-wk-col{position:relative;border-right:1px solid #F1F3F8;background:repeating-linear-gradient(to bottom,transparent 0,transparent ${H_PX - 1}px,#EEF1F7 ${H_PX - 1}px,#EEF1F7 ${H_PX}px);}
        .gag-wk-col.hoy{background-color:#F7F8FD;}
        .gag-wk-col .gag-ev{position:absolute;left:0;right:0;margin:0 4px;}
        .gag-now{position:absolute;left:0;right:0;height:2px;background:var(--r);z-index:4;pointer-events:none;}
        .gag-now:before{content:'';position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:50%;background:var(--r);}
        .gag-now-t{position:absolute;left:2px;transform:translateY(-50%);background:var(--r);color:#fff;font-size:10px;font-weight:800;border-radius:6px;padding:2px 5px;z-index:5;}
        .gag-pill{display:block;border-radius:7px;padding:3px 7px;font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;border-left:3px solid;}
        /* Vista mes */
        .gag-mes-h{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--b);}
        .gag-mes-h div{padding:9px;font-size:11px;font-weight:800;color:var(--t3);text-transform:uppercase;text-align:center;}
        .gag-mes-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));}
        .gag-mes-c{min-height:116px;border-right:1px solid #EEF1F7;border-bottom:1px solid #EEF1F7;padding:6px;display:flex;flex-direction:column;gap:3px;cursor:pointer;}
        .gag-mes-c:nth-child(7n){border-right:none;}
        .gag-mes-c.fuera{background:#FAFBFD;}
        .gag-mes-c.fuera .num{color:#C5CCDA;}
        .gag-mes-c .num{font-size:12.5px;font-weight:800;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:8px;margin-bottom:2px;}
        .gag-mes-c.hoy .num{background:var(--r);color:#fff;}
        .gag-mes-c .mas{font-size:11px;font-weight:700;color:var(--n);padding-left:4px;}
        /* Trámites */
        .gag-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}
        .gag-tbl th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--t3);padding:9px 10px;border-bottom:1px solid var(--b);background:#FAFBFE;white-space:nowrap;}
        .gag-tbl td{padding:9px 10px;border-bottom:1px solid #F1F3F8;vertical-align:top;}
        .gag-tbl tr.atr td{background:#FFF7F5;}
        .gag-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;border-radius:999px;padding:3px 9px;white-space:nowrap;}
        .gag-venta{border:1px solid var(--b);border-radius:14px;margin:12px 14px;overflow:hidden;}
        .gag-venta-h{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 14px;border-bottom:1px solid var(--b);background:#FBFCFE;}
        /* Panel de detalle */
        .gag-ov{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:200050;opacity:0;transition:opacity .2s;}
        .gag-ov.on{opacity:1;}
        .gag-dr{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);background:#fff;z-index:200051;box-shadow:-12px 0 40px rgba(15,23,42,.18);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .22s ease;font-family:'DM Sans',system-ui,sans-serif;color:#0F172A;}
        .gag-dr.on{transform:none;}
        .gag-dr-h{padding:18px 20px 14px;color:#fff;}
        .gag-dr-b{flex:1;overflow-y:auto;padding:16px 20px;}
        .gag-dr-f{padding:12px 20px;border-top:1px solid #E4E8F1;display:flex;gap:8px;flex-wrap:wrap;}
        .gag-fila{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #F1F3F8;font-size:13px;}
        .gag-fila .k{width:118px;flex-shrink:0;color:#64748B;font-size:12px;display:flex;align-items:center;gap:6px;}
        .gag-sec{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;margin:18px 0 8px;}
        .gag-chk{display:flex;gap:9px;align-items:center;padding:6px 0;font-size:13px;}
        .gag-chk input{accent-color:${NAVY};width:16px;height:16px;}
        .gag-com{background:#F7F9FC;border-radius:12px;padding:9px 11px;margin-bottom:7px;font-size:12.5px;}
        .gag-com small{color:#94A3B8;font-size:11px;}
        /* Modal */
        .gag-md{position:fixed;inset:0;z-index:200060;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.45);font-family:'DM Sans',system-ui,sans-serif;color:#0F172A;}
        .gag-md-c{background:#fff;border-radius:18px;width:min(640px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(15,23,42,.3);}
        .gag-md-h{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #E4E8F1;font-size:16px;font-weight:800;color:${NAVY};}
        .gag-md-b{padding:16px 20px;overflow-y:auto;}
        .gag-md-f{padding:12px 20px;border-top:1px solid #E4E8F1;display:flex;justify-content:flex-end;gap:8px;align-items:center;}
        .gag-lb{display:block;font-size:12px;font-weight:700;color:#334155;margin:10px 0 5px;}
        .gag-lb small{font-weight:500;color:#94A3B8;}
        .gag-in{width:100%;border:1px solid #D5DBE7;border-radius:10px;padding:9px 11px;font-size:13px;font-family:inherit;color:#0F172A;background:#fff;outline:none;box-sizing:border-box;}
        .gag-in:focus{border-color:${NAVY};box-shadow:0 0 0 3px rgba(29,46,115,.12);}
        .gag-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .gag-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
        .gag-opc{display:flex;flex-wrap:wrap;gap:6px;}
        .gag-opc button{border:1px solid #D5DBE7;background:#fff;border-radius:999px;padding:6px 11px;font-size:12px;font-weight:700;cursor:pointer;color:#334155;display:inline-flex;align-items:center;gap:6px;font-family:inherit;}
        .gag-opc button.on{color:#fff;}
        .gag-err{color:#B91C1C;font-size:12.5px;font-weight:700;margin-right:auto;}
        .gag-vacio{padding:48px 20px;text-align:center;color:var(--t3);font-size:13px;}
        .gag-toast{position:fixed;bottom:22px;left:50%;transform:translate(-50%,20px);background:${NAVY};color:#fff;font:700 13px 'DM Sans',sans-serif;padding:11px 18px;border-radius:12px;opacity:0;pointer-events:none;transition:all .2s;z-index:200100;box-shadow:0 10px 30px rgba(15,23,42,.25);}
        .gag-toast.mostrar{opacity:1;transform:translate(-50%,0);}
        .gag-toast.err{background:${ROJO};}
        .gag-compacto .gag-layout{grid-template-columns:1fr;}.gag-compacto .gag-main{order:-1;}.gag-compacto .gag-side{position:static;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}
        @media(max-width:1100px){.gag-layout{grid-template-columns:1fr;}.gag-main{order:-1;}.gag-side{position:static;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));}}
        @media(max-width:700px){.gag{padding:12px;}.gag-kpis{grid-template-columns:1fr 1fr;}.gag-search{min-width:0;flex:1;}.gag-g2,.gag-g3{grid-template-columns:1fr;}.gag-h1{font-size:20px;}}
        `;
        document.head.appendChild(st);
    }

    // ───────────── render principal ─────────────
    function pintar() {
        const el = S.el; if (!el || !document.body.contains(el)) return;
        if (!puedeVer()) {
            el.innerHTML = `<div class="gag"><div class="gag-card gag-vacio" style="max-width:520px;margin:60px auto;">${IC.candado}<div style="font-size:16px;font-weight:800;color:${NAVY};margin:10px 0 4px;">Solo para el personal de Gestoría</div>Este calendario solo lo pueden ver Gestoría y los administradores del portal.</div></div>`;
            return;
        }
        const scroll = el.querySelector('.gag-wk-grid'); const sTop = scroll ? scroll.scrollTop : null;
        el.innerHTML = `<div class="gag">${htmlTop()}${htmlKpis()}<div class="gag-layout">${htmlSide()}<div class="gag-main gag-card">${htmlBar()}${S.error ? `<div class="gag-vacio" style="color:${ROJO};">No se pudo leer la información: ${esc(S.error)}</div>` : S.cargando ? '<div class="gag-vacio">Cargando calendario…</div>' : htmlVista()}</div></div></div>`;
        // Si el espacio es angosto (menú lateral del portal abierto), el calendario va arriba y el panel abajo.
        if (el.firstElementChild) el.firstElementChild.classList.toggle('gag-compacto', el.clientWidth < 1180);
        const g = el.querySelector('.gag-wk-grid');
        if (g) g.scrollTop = sTop != null ? sTop : Math.max(0, (Math.min(Math.max(new Date().getHours(), H_INI), H_FIN) - H_INI - 1) * H_PX);
        const b = el.querySelector('#gag-q'); if (b && S._focoQ) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
    }
    function htmlTop() {
        return `<div class="gag-top"><div><div class="gag-eyebrow">Departamento de Gestoría</div><div class="gag-h1">Calendario de Gestoría</div>
            <div class="gag-sub">Trámites, citas en dependencias, visitas, vencimientos y tareas del equipo en un solo lugar.</div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="gag-btn" onclick="gagNuevaVenta()">${IC.doc} Venta de gestoría</button>
              <button class="gag-btn pri" onclick="gagNuevo()">${IC.mas} Nueva actividad</button></div></div>`;
    }
    function htmlKpis() {
        const its = items().filter(it => it.resp.some(r => personasActivas().has(r))), hoy = hoyD(), lu = lunes(hoy), dom = sumarDias(lu, 6);
        const kHoy = its.filter(it => !cerrado(it) && enRango(it, hoy, hoy)).length;
        const kSem = its.filter(it => !cerrado(it) && enRango(it, lu, dom)).length;
        const kAtr = its.filter(atrasado).length;
        const kCli = its.filter(it => it.estatus === 'docs_cliente').length;
        const k = (n, t, c, bg, ic, acc) => `<div class="gag-kpi" onclick="${acc}"><div class="gag-kpi-i" style="background:${bg};color:${c};">${ic}</div><div><div class="gag-kpi-n" style="color:${c};">${n}</div><div class="gag-kpi-t">${t}</div></div></div>`;
        return `<div class="gag-kpis">${k(kHoy, 'Para hoy', NAVY, '#E8ECF8', IC.hoy, "gagIrHoy('equipo')")}${k(kSem, 'Pendientes esta semana', '#2563EB', '#E6EFFE', IC.semana, "gagIrHoy('equipo')")}${k(kAtr, 'Atrasados (ya pasó su fecha)', ROJO, '#FDECE9', IC.alerta, "gagVista('tramites')")}${k(kCli, 'Esperando documentos del cliente', '#B45309', '#FEF3C7', IC.doc, "gagVista('tramites')")}</div>`;
    }
    function htmlSide() {
        // mini calendario
        const r = S.ref, ini = lunes(new Date(r.getFullYear(), r.getMonth(), 1)), hoy = hoyD(), lu = lunes(r);
        const conEv = new Set(); filtrados().forEach(it => { for (let d = diaSolo(it.ini); d <= it.fin && conEv.size < 400; d = sumarDias(d, 1)) conEv.add(iso(d)); });
        let celdas = '';
        for (let i = 0; i < 42; i++) {
            const d = sumarDias(ini, i), cls = [d.getMonth() !== r.getMonth() ? 'fuera' : '', mismoDia(d, hoy) ? 'hoy' : '', S.vista !== 'mes' && d >= lu && d <= sumarDias(lu, 6) ? 'sem' : ''].join(' ');
            celdas += `<button class="${cls}" onclick="gagIr('${iso(d)}')">${d.getDate()}${conEv.has(iso(d)) ? '<i></i>' : ''}</button>`;
        }
        const its = filtrados(), lu2 = lunes(S.ref), fin2 = sumarDias(lu2, 6);
        const cuenta = c => items().filter(it => !cerrado(it) && it.resp.includes(c) && enRango(it, lu2, fin2)).length;
        const ps = personasActivas();
        const per = GAG_EQUIPO.map(p => `<label class="gag-per"><input type="checkbox" ${ps.has(p.correo) ? 'checked' : ''} onchange="gagPersona('${p.correo}',this.checked)">${avatar(p, 26)}<span class="nm" title="${esc(p.nombre)}">${esc(p.nombre)}</span><span class="ct">${cuenta(p.correo) || ''}</span></label>`).join('')
            + `<label class="gag-per"><input type="checkbox" ${ps.has(SIN_ASIGNAR) ? 'checked' : ''} onchange="gagPersona('${SIN_ASIGNAR}',this.checked)"><span class="gag-av" style="width:26px;height:26px;background:#CBD2DF;font-size:10px;">?</span><span class="nm">Sin asignar</span><span class="ct">${cuenta(SIN_ASIGNAR) || ''}</span></label>`;
        const tipos = Object.entries(TIPOS).map(([k, t]) => `<div class="gag-tipo ${S.tipos.has(k) ? '' : 'off'}" onclick="gagTipo('${k}')"><span class="dot" style="background:${t.c};"></span>${esc(t.n)}</div>`).join('');
        const prox = its.filter(it => !cerrado(it) && diaSolo(it.fin) <= sumarDias(hoy, 14)).sort((a, b) => a.fin - b.fin).slice(0, 12);
        return `<div class="gag-side">
            <div class="gag-card"><div class="gag-card-h"><span style="text-transform:capitalize;">${MESES[r.getMonth()]} ${r.getFullYear()}</span><span style="display:flex;gap:4px;"><button class="gag-btn ico" style="width:28px;height:28px;padding:4px;" onclick="gagMesMini(-1)">${IC.izq}</button><button class="gag-btn ico" style="width:28px;height:28px;padding:4px;" onclick="gagMesMini(1)">${IC.der}</button></span></div>
              <div class="gag-mini"><div class="gag-mini-g">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span>${x}</span>`).join('')}${celdas}</div></div></div>
            <div class="gag-card"><div class="gag-card-h">Equipo de Gestoría<button class="gag-btn chico" onclick="gagPersonasTodas()">${ps.size >= GAG_EQUIPO.length + 1 ? 'Solo yo' : 'Todos'}</button></div><div style="padding-bottom:8px;">${per}</div></div>
            <div class="gag-card"><div class="gag-card-h">Tipos de actividad</div><div style="padding-bottom:10px;">${tipos}</div></div>
            <div class="gag-card"><div class="gag-card-h">Próximos 14 días</div><div class="gag-prox">${prox.length ? prox.map(it => {
                const atr = atrasado(it);
                return `<div class="gag-prox-i" onclick="gagAbrir('${esc(it.id)}')"><div class="gag-prox-f ${atr ? 'atr' : ''}"><b>${it.fin.getDate()}</b><small>${MESES[it.fin.getMonth()].slice(0, 3)}</small></div><div style="min-width:0;"><div style="font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(it.titulo)}</div><div style="font-size:11px;color:${atr ? ROJO : '#64748B'};font-weight:${atr ? 800 : 500};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${atr ? 'Atrasado · ' : ''}${esc(it.cliente || TIPOS[it.tipo].n)}</div></div></div>`;
            }).join('') : '<div style="font-size:12px;color:#94A3B8;padding:6px 8px;">Nada pendiente en las próximas dos semanas.</div>'}</div></div>
        </div>`;
    }
    function tituloRango() {
        if (S.vista === 'mes') { const m = MESES[S.ref.getMonth()]; return m[0].toUpperCase() + m.slice(1) + ' ' + S.ref.getFullYear(); }
        if (S.vista === 'tramites') return 'Ventas y trámites de gestoría';
        const lu = lunes(S.ref), dom = sumarDias(lu, 6);
        return lu.getMonth() === dom.getMonth() ? `${lu.getDate()} al ${dom.getDate()} de ${MESES[dom.getMonth()]} ${dom.getFullYear()}` : `${fechaCorta(lu)} al ${fechaCorta(dom)} ${dom.getFullYear()}`;
    }
    function htmlBar() {
        const v = [['equipo', 'Equipo'], ['semana', 'Semana'], ['mes', 'Mes'], ['tramites', 'Trámites']];
        return `<div class="gag-bar">
            ${S.vista !== 'tramites' ? `<button class="gag-btn ico" onclick="gagMover(-1)" title="Anterior">${IC.izq}</button><button class="gag-btn" onclick="gagIrHoy()">Hoy</button><button class="gag-btn ico" onclick="gagMover(1)" title="Siguiente">${IC.der}</button>` : ''}
            <div class="gag-bar-t">${esc(tituloRango())}</div>
            <div class="gag-search">${IC.buscar}<input id="gag-q" placeholder="Buscar cliente, trámite, persona…" value="${esc(S.q)}" oninput="gagBuscar(this.value)"></div>
            <div class="gag-seg">${v.map(([k, t]) => `<button class="${S.vista === k ? 'on' : ''}" onclick="gagVista('${k}')">${t}</button>`).join('')}</div></div>`;
    }
    function htmlVista() {
        if (S.vista === 'semana') return vistaSemana();
        if (S.vista === 'mes') return vistaMes();
        if (S.vista === 'tramites') return vistaTramites();
        return vistaEquipo();
    }
    function estiloEv(it) { const t = TIPOS[it.tipo]; return `background:${t.bg};border-color:${t.bg};border-left-color:${t.c};color:${t.c};`; }
    function subEv(it) {
        if (it.src === 'tramite') return (ESTATUS[it.estatus] || ESTATUS.pendiente).n + (it.cliente ? ' · ' + it.cliente : '');
        return (it.todoDia ? 'Todo el día' : hora(it.ini)) + (it.cliente ? ' · ' + it.cliente : it.dependencia ? ' · ' + it.dependencia : '');
    }
    function tarjeta(it, extra) {
        const cls = ['gag-ev', cerrado(it) ? 'cerr' : '', atrasado(it) ? 'atr' : ''].join(' ');
        const drag = puedeEditar() && !cerrado(it) ? `draggable="true" ondragstart="gagDrag(event,'${esc(it.id)}')"` : '';
        return `<div class="${cls}" ${drag} style="${estiloEv(it)}${extra || ''}" onclick="gagAbrir('${esc(it.id)}')" title="${esc(it.titulo)}">${it.prioridad === 'urgente' || atrasado(it) ? '<i class="flag"></i>' : ''}<b>${esc(it.titulo)}</b><span>${esc(subEv(it))}</span></div>`;
    }

    // Equipo: una fila por persona, una columna por día; las actividades de varios días se estiran.
    function vistaEquipo() {
        const lu = lunes(S.ref), dias = [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(lu, i)), dom = dias[6], hoy = hoyD(), its = filtrados().filter(it => enRango(it, lu, dom));
        const ps = personasActivas();
        const filas = GAG_EQUIPO.filter(p => ps.has(p.correo)).concat(ps.has(SIN_ASIGNAR) && its.some(it => it.resp.includes(SIN_ASIGNAR)) ? [{ correo: SIN_ASIGNAR, nombre: 'Sin asignar', puesto: 'Arrástralos a alguien del equipo', color: '#CBD2DF' }] : []);
        if (!filas.length) return '<div class="gag-vacio">Marca al menos a una persona del equipo en el panel de la izquierda.</div>';
        const head = `<div class="gag-eq-head"><div class="lbl">Equipo</div>${dias.map(d => `<div class="gag-dh ${mismoDia(d, hoy) ? 'hoy' : ''} ${d.getDay() % 6 === 0 ? 'finde' : ''}"><small>${DIAS[(d.getDay() + 6) % 7]}</small><b>${d.getDate()}</b></div>`).join('')}</div>`;
        const rows = filas.map(p => {
            const mis = its.filter(it => it.resp.includes(p.correo)).sort((a, b) => a.ini - b.ini || (b.fin - b.ini) - (a.fin - a.ini));
            const carriles = []; // fin (índice de día) ocupado por carril
            const cards = mis.map(it => {
                const c0 = Math.max(0, difDias(lu, it.ini)), c1 = Math.min(6, difDias(lu, it.fin));
                let lane = carriles.findIndex(f => f < c0); if (lane < 0) { lane = carriles.length; carriles.push(c1); } else carriles[lane] = c1;
                return tarjeta(it, `grid-column:${c0 + 1} / span ${c1 - c0 + 1};grid-row:${lane + 1};`);
            }).join('');
            const cells = dias.map(d => `<div class="${d.getDay() % 6 === 0 ? 'finde' : ''} ${mismoDia(d, hoy) ? 'hoy' : ''}" ondragover="gagSobre(event,this)" ondragleave="this.classList.remove('drop')" ondrop="gagSoltar(event,this,'${p.correo}','${iso(d)}')">${puedeEditar() ? `<button class="add" title="Agregar actividad" onclick="gagNuevo('${iso(d)}','${p.correo}')">${IC.mas}</button>` : ''}</div>`).join('');
            const persona = p.correo === SIN_ASIGNAR ? `<span class="gag-av" style="width:32px;height:32px;background:#CBD2DF;font-size:12px;">?</span>` : avatar(p, 32);
            return `<div class="gag-eq-row"><div class="gag-eq-per">${persona}<div style="min-width:0;"><div class="nm">${esc(p.nombre)}</div><div class="ps">${esc(p.puesto)}</div></div></div><div class="gag-eq-body"><div class="gag-eq-cells">${cells}</div><div class="gag-eq-cards">${cards}</div></div></div>`;
        }).join('');
        return `<div class="gag-eq"><div class="gag-eq-in">${head}${rows}</div></div>`;
    }
    // Semana por horas (con línea roja de la hora actual).
    function vistaSemana() {
        const lu = lunes(S.ref), dias = [0, 1, 2, 3, 4, 5, 6].map(i => sumarDias(lu, i)), hoy = hoyD(), its = filtrados().filter(it => enRango(it, lu, dias[6]));
        const head = `<div class="gag-wk-head"><div></div>${dias.map(d => `<div class="gag-dh ${mismoDia(d, hoy) ? 'hoy' : ''} ${d.getDay() % 6 === 0 ? 'finde' : ''}"><small>${DIAS[(d.getDay() + 6) % 7]}</small><b>${d.getDate()}</b></div>`).join('')}</div>`;
        const allday = `<div class="gag-wk-allday"><div class="lbl">Todo<br>el día</div>${dias.map(d => `<div>${its.filter(it => (it.todoDia || !mismoDia(it.ini, it.fin)) && enRango(it, d, d)).map(it => `<span class="gag-pill" style="${estiloEv(it)}" onclick="gagAbrir('${esc(it.id)}')" title="${esc(it.titulo)}">${esc(it.titulo)}</span>`).join('')}</div>`).join('')}</div>`;
        const horas = []; for (let h = H_INI; h < H_FIN; h++) horas.push(`<div>${h === H_INI ? '' : (h % 12 || 12) + (h < 12 ? ' a. m.' : ' p. m.')}</div>`);
        const ahora = new Date(), minNow = (ahora.getHours() - H_INI) * 60 + ahora.getMinutes();
        const cols = dias.map(d => {
            const del = its.filter(it => !it.todoDia && mismoDia(it.ini, it.fin) && mismoDia(it.ini, d)).sort((a, b) => a.ini - b.ini);
            // columnas para traslapes
            const grupos = []; del.forEach(it => { const g = grupos.find(gr => gr.some(x => x.fin > it.ini)) ; if (g) g.push(it); else grupos.push([it]); });
            const cards = grupos.map(gr => gr.map((it, k) => {
                const top = Math.max(0, ((it.ini.getHours() - H_INI) * 60 + it.ini.getMinutes()) / 60 * H_PX);
                const alto = Math.max(34, ((it.fin - it.ini) / 3600000 || 1) * H_PX - 4);
                const w = 100 / gr.length;
                return tarjeta(it, `top:${top}px;height:${alto}px;left:${k * w}%;right:auto;width:calc(${w}% - 8px);white-space:normal;`);
            }).join('')).join('');
            const linea = mismoDia(d, hoy) && minNow >= 0 && minNow <= (H_FIN - H_INI) * 60 ? `<div class="gag-now" style="top:${minNow / 60 * H_PX}px;"></div>` : '';
            return `<div class="gag-wk-col ${mismoDia(d, hoy) ? 'hoy' : ''}" style="height:${(H_FIN - H_INI) * H_PX}px;" ondblclick="gagNuevoHora(event,'${iso(d)}')">${linea}${cards}</div>`;
        }).join('');
        const etiqueta = dias.some(d => mismoDia(d, hoy)) && minNow >= 0 && minNow <= (H_FIN - H_INI) * 60 ? `<div class="gag-now-t" style="top:${minNow / 60 * H_PX}px;">${(ahora.getHours() % 12 || 12) + ':' + String(ahora.getMinutes()).padStart(2, '0')}</div>` : '';
        return `<div class="gag-wk"><div class="gag-wk-in">${head}${allday}<div class="gag-wk-grid"><div class="gag-wk-hrs" style="position:relative;">${horas.join('')}${etiqueta}</div>${cols}</div>
            <div style="font-size:11.5px;color:#94A3B8;padding:8px 14px;">Doble clic en un horario vacío para agendar ahí.</div></div></div>`;
    }
    function vistaMes() {
        const r = S.ref, ini = lunes(new Date(r.getFullYear(), r.getMonth(), 1)), hoy = hoyD(), its = filtrados();
        let html = '';
        for (let i = 0; i < 42; i++) {
            const d = sumarDias(ini, i); if (i === 35 && d.getMonth() !== r.getMonth()) break;
            const del = its.filter(it => enRango(it, d, d)).sort((a, b) => (a.todoDia === b.todoDia ? a.ini - b.ini : a.todoDia ? -1 : 1));
            html += `<div class="gag-mes-c ${d.getMonth() !== r.getMonth() ? 'fuera' : ''} ${mismoDia(d, hoy) ? 'hoy' : ''}" onclick="if(event.target===this||event.target.classList.contains('num'))gagIr('${iso(d)}','equipo')"><span class="num">${d.getDate()}</span>
                ${del.slice(0, 3).map(it => `<span class="gag-pill" style="${estiloEv(it)}" onclick="event.stopPropagation();gagAbrir('${esc(it.id)}')" title="${esc(it.titulo)}">${it.todoDia ? '' : esc(hora(it.ini).replace(' ', '')) + ' '}${esc(it.titulo)}</span>`).join('')}
                ${del.length > 3 ? `<span class="mas" onclick="event.stopPropagation();gagIr('${iso(d)}','equipo')">+${del.length - 3} más</span>` : ''}</div>`;
        }
        return `<div class="gag-mes-h">${DIAS.map(d => `<div>${d}</div>`).join('')}</div><div class="gag-mes-g">${html}</div>`;
    }

    // ───────────── Trámites (antes Operaciones → Gestoría) ─────────────
    function ventaAbierta(v) { return (v.partidas || []).some(p => !['entregado', 'cancelado'].includes(p.estatus)); }
    function vistaTramites() {
        const hoy = iso(hoyD()), q = norm(S.q), ed = puedeEditar();
        const lista = S.ventas.filter(v => S.filtroTram === 'todas' || (S.filtroTram === 'abiertas' ? ventaAbierta(v) : !ventaAbierta(v)))
            .filter(v => !q || norm([v.cliente, v.pedido, v.cotizacion, (v.partidas || []).map(p => p.nombre + ' ' + nombreDe(p.responsable || '')).join(' ')].join(' ')).includes(q))
            .sort((a, b) => alfa(a.cliente || '', b.cliente || ''));
        const sel = `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 14px 0;"><div class="gag-seg">${[['abiertas', 'Con trámites pendientes'], ['cerradas', 'Terminadas'], ['todas', 'Todas']].map(([k, t]) => `<button class="${S.filtroTram === k ? 'on' : ''}" onclick="gagFiltroTram('${k}')">${t}</button>`).join('')}</div><span style="font-size:12px;color:#64748B;">${lista.length} venta(s) · orden alfabético por cliente</span></div>`;
        if (!lista.length) return sel + '<div class="gag-vacio">Sin ventas de gestoría con este filtro.</div>';
        return sel + lista.map(v => `<div class="gag-venta"><div class="gag-venta-h"><div><div style="font-size:14px;font-weight:800;">${esc(v.cliente || 'Cliente')}</div>
            <div style="font-size:11.5px;color:#64748B;">Pedido <b>${esc(v.pedido || '—')}</b>${v.cotizacion ? ' · Cotización ' + esc(v.cotizacion) : ''} · ${dinero(v.total)}${v.vendedor ? ' · Vendió ' + esc(v.vendedor) : ''}${v.fechaPedido ? ' · ' + esc(v.fechaPedido) : ''}</div></div>
            ${ed ? `<button class="gag-btn chico" onclick="gagTramiteNuevo('${v.id}')">${IC.mas} Trámite</button>` : ''}</div>
            <div style="overflow-x:auto;"><table class="gag-tbl"><thead><tr><th>Trámite</th><th>Responsable</th><th>Estatus</th><th>Fecha compromiso</th><th>¿Qué lo atrasa?</th><th></th></tr></thead><tbody>
            ${(v.partidas || []).map((p, i) => {
                const e = ESTATUS[p.estatus] || ESTATUS.pendiente, atr = p.fechaCompromiso && p.fechaCompromiso < hoy && !['entregado', 'cancelado'].includes(p.estatus), m = miembro(p.responsable);
                return `<tr class="${atr ? 'atr' : ''}"><td><b>${esc(p.nombre)}</b>${p.cantidad > 1 ? ' × ' + p.cantidad : ''}${p.importe ? `<div style="font-size:11px;color:#64748B;">${dinero(p.importe)}</div>` : ''}</td>
                  <td>${m ? `<span style="display:inline-flex;align-items:center;gap:6px;">${avatar(m, 22)}${esc(m.nombre)}</span>` : '<span style="color:#94A3B8;">Sin asignar</span>'}</td>
                  <td><span class="gag-chip" style="color:${e.c};background:${e.bg};">${e.n}</span></td>
                  <td style="white-space:nowrap;${atr ? `color:${ROJO};font-weight:800;` : ''}">${p.fechaCompromiso ? esc(fechaCorta(aFecha(p.fechaCompromiso))) + ' ' + aFecha(p.fechaCompromiso).getFullYear() : '<span style="color:#94A3B8;">Sin fecha</span>'}${atr ? ' · ATRASADO' : ''}</td>
                  <td style="color:#B45309;">${esc(p.documentoAtrasa || '')}${p.nota ? `<div style="color:#64748B;">${esc(p.nota)}</div>` : ''}</td>
                  <td style="white-space:nowrap;">${p.fechaCompromiso ? `<button class="gag-btn chico" onclick="gagAbrir('${v.id}#${i}')">Ver</button> ` : ''}${ed ? `<button class="gag-btn chico" onclick="gagTramiteEditar('${v.id}',${i})">Actualizar</button>` : ''}</td></tr>`;
            }).join('') || '<tr><td colspan="6" style="color:#94A3B8;">Sin trámites: agrégalos con "+ Trámite".</td></tr>'}
            </tbody></table></div></div>`).join('') + '<div style="height:6px;"></div>';
    }

    // ───────────── panel de detalle ─────────────
    function buscarItem(id) { return items().find(it => it.id === id); }
    function cerrarDrawer() {
        const ov = document.getElementById('gag-ov'), dr = document.getElementById('gag-dr');
        if (ov) ov.classList.remove('on'); if (dr) dr.classList.remove('on');
        setTimeout(() => { if (ov) ov.remove(); if (dr) dr.remove(); }, 230); S.sel = null;
    }
    function abrir(id) {
        const it = buscarItem(id); if (!it) { toast('No se encontró esa actividad.', true); return; }
        S.sel = id;
        let ov = document.getElementById('gag-ov'), dr = document.getElementById('gag-dr'), nuevo = !dr;
        if (!ov) { ov = document.createElement('div'); ov.id = 'gag-ov'; ov.className = 'gag-ov'; ov.onclick = cerrarDrawer; document.body.appendChild(ov); }
        if (!dr) { dr = document.createElement('div'); dr.id = 'gag-dr'; dr.className = 'gag-dr'; document.body.appendChild(dr); }
        const t = TIPOS[it.tipo], e = ESTATUS[it.estatus] || ESTATUS.pendiente, ed = puedeEditar(), raw = it.raw;
        const fila = (ic, k, v) => v ? `<div class="gag-fila"><div class="k">${ic}${k}</div><div style="flex:1;min-width:0;">${v}</div></div>` : '';
        const cuando = it.todoDia ? (mismoDia(it.ini, it.fin) ? fechaLarga(it.ini) : `Del ${fechaLarga(it.ini)} al ${fechaLarga(it.fin)}`) : (mismoDia(it.ini, it.fin) ? `${fechaLarga(it.ini)} · ${hora(it.ini)} a ${hora(it.fin)}` : `${fechaLarga(it.ini)} ${hora(it.ini)} al ${fechaLarga(it.fin)} ${hora(it.fin)}`);
        const resp = it.resp.map(c => { const m = miembro(c); return m ? `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 8px 4px 0;">${avatar(m, 22)}${esc(m.nombre)}</span>` : '<span style="color:#94A3B8;">Sin asignar</span>'; }).join('');
        const checklist = it.src === 'agenda' ? (raw.checklist || []) : [];
        const coms = (raw.comentarios || []).slice().reverse();
        const estBtns = ed ? Object.entries(ESTATUS).map(([k, x]) => `<button style="${k === it.estatus ? `background:${x.c};border-color:${x.c};color:#fff;` : ''}" onclick="gagEstatus('${esc(it.id)}','${k}')">${esc(x.n)}</button>`).join('') : '';
        dr.innerHTML = `<div class="gag-dr-h" style="background:${t.c};">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;"><span class="gag-chip" style="background:rgba(255,255,255,.18);color:#fff;">${esc(t.n)}</span><button onclick="gagCerrarDetalle()" style="background:rgba(255,255,255,.15);border:none;color:#fff;border-radius:9px;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;">${IC.cerrar}</button></div>
              <div style="font-size:20px;font-weight:800;margin-top:10px;line-height:1.2;">${esc(it.titulo)}</div>
              <div style="font-size:12.5px;opacity:.9;margin-top:4px;">${esc(it.cliente || it.lugar || '')}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;"><span class="gag-chip" style="background:#fff;color:${e.c};">${esc(e.n)}</span>${it.prioridad !== 'normal' ? `<span class="gag-chip" style="background:#fff;color:${ROJO};">Prioridad ${esc(PRIORIDAD[it.prioridad] || it.prioridad)}</span>` : ''}${atrasado(it) ? `<span class="gag-chip" style="background:${ROJO};color:#fff;">Atrasado</span>` : ''}</div></div>
            <div class="gag-dr-b">
              ${fila(IC.cal, 'Cuándo', esc(cuando))}
              ${fila(IC.persona, 'Responsable', resp)}
              ${fila(IC.edificio, 'Cliente', esc(it.cliente))}
              ${fila(IC.lugar, 'Estación / lugar', esc(it.lugar))}
              ${fila(IC.edificio, 'Dependencia', esc(it.dependencia))}
              ${it.src === 'tramite' ? fila(IC.doc, 'Venta', `Pedido <b>${esc(it.venta.pedido || '—')}</b> · ${dinero(it.venta.total)}`) + fila(IC.alerta, 'Lo atrasa', raw.documentoAtrasa ? `<span style="color:#B45309;font-weight:700;">${esc(raw.documentoAtrasa)}</span>` : '') + fila(IC.comentario, 'Nota', esc(raw.nota || '')) : fila(IC.comentario, 'Notas', esc(raw.notas || '').replace(/\n/g, '<br>'))}
              ${ed ? `<div class="gag-sec">Cambiar estatus</div><div class="gag-opc">${estBtns}</div>` : ''}
              ${checklist.length ? `<div class="gag-sec">Requisitos y documentos (${checklist.filter(c => c.ok).length} de ${checklist.length})</div>${checklist.map((c, i) => `<label class="gag-chk"><input type="checkbox" ${c.ok ? 'checked' : ''} ${ed ? `onchange="gagCheck('${it.id}',${i},this.checked)"` : 'disabled'}><span style="${c.ok ? 'text-decoration:line-through;color:#94A3B8;' : ''}">${esc(c.t)}</span></label>`).join('')}` : ''}
              <div class="gag-sec">Comentarios</div>
              ${ed ? `<div style="display:flex;gap:8px;margin-bottom:10px;"><input id="gag-com" class="gag-in" placeholder="Escribe un avance o comentario…" onkeydown="if(event.key==='Enter')gagComentar('${esc(it.id)}')"><button class="gag-btn pri" onclick="gagComentar('${esc(it.id)}')">Enviar</button></div>` : ''}
              ${coms.length ? coms.map(c => `<div class="gag-com"><div><b>${esc(c.por || '')}</b> <small>${esc(c.en ? new Date(c.en).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : '')}</small></div><div style="margin-top:3px;">${esc(c.texto)}</div></div>`).join('') : '<div style="font-size:12.5px;color:#94A3B8;">Sin comentarios todavía.</div>'}
              ${(raw.creadoPor || raw.creadoEn) ? `<div style="font-size:11px;color:#94A3B8;margin-top:16px;">Registrado por ${esc(raw.creadoPor || '')}${raw.creadoEn ? ' el ' + esc(new Date(raw.creadoEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })) : ''}</div>` : ''}
            </div>
            ${ed ? `<div class="gag-dr-f">${it.src === 'agenda' ? `<button class="gag-btn pri" onclick="gagEditar('${it.id}')">${IC.editar} Editar</button><button class="gag-btn" style="color:${ROJO};" onclick="gagBorrar('${it.id}')">${IC.borrar} Eliminar</button>` : `<button class="gag-btn pri" onclick="gagTramiteEditar('${it.venta.id}',${it.idx})">${IC.editar} Actualizar trámite</button>`}</div>` : ''}`;
        if (nuevo) requestAnimationFrame(() => { ov.classList.add('on'); dr.classList.add('on'); });
    }

    // ───────────── modal genérico ─────────────
    function modal(titulo, cuerpo, alGuardar, txtBtn) {
        const md = document.createElement('div'); md.className = 'gag-md';
        md.innerHTML = `<div class="gag-md-c"><div class="gag-md-h">${titulo}<button class="gag-btn ico" data-x>${IC.cerrar}</button></div><div class="gag-md-b">${cuerpo}</div>
            <div class="gag-md-f"><span class="gag-err"></span><button class="gag-btn" data-x>Cancelar</button><button class="gag-btn pri" data-ok>${txtBtn || 'Guardar'}</button></div></div>`;
        document.body.appendChild(md);
        const cerrar = () => md.remove();
        md.querySelectorAll('[data-x]').forEach(b => b.onclick = cerrar);
        md.addEventListener('mousedown', ev => { if (ev.target === md) cerrar(); });
        const ok = md.querySelector('[data-ok]'), err = md.querySelector('.gag-err');
        ok.onclick = async () => {
            err.textContent = ''; ok.disabled = true; const t = ok.textContent; ok.textContent = 'Guardando…';
            try { const r = await alGuardar(md, err); if (r !== false) cerrar(); }
            catch (e) { console.error('[Gestoría]', e); err.textContent = 'No se pudo guardar: ' + (e.message || e); }
            ok.disabled = false; ok.textContent = t;
        };
        const f = md.querySelector('input,select,textarea'); if (f) setTimeout(() => f.focus(), 30);
        return md;
    }

    // Alta / edición de una actividad del calendario.
    function formEvento(ev, pre) {
        ev = ev || {}; pre = pre || {};
        const ini = aFecha(ev.inicio) || aFecha((pre.dia || iso(S.ref)) + 'T' + (pre.hora || '09:00')), fin = aFecha(ev.fin) || new Date(ini.getTime() + 3600000);
        const st = { tipo: ev.tipo || 'tramite', resp: new Set(ev.responsables || (pre.resp && pre.resp !== SIN_ASIGNAR ? [pre.resp] : (miembro(correoActual()) ? [correoActual()] : []))),
            todo: ev.todoElDia != null ? !!ev.todoElDia : !pre.hora, prioridad: ev.prioridad || 'normal', checklist: (ev.checklist || []).map(c => ({ ...c })) };
        const clientes = [...new Set(S.ventas.map(v => v.cliente).concat(S.eventos.map(e => e.cliente)).filter(Boolean))].sort(alfa);
        const cuerpo = `
            <label class="gag-lb">¿Qué es?</label><div class="gag-opc" id="gf-tipo"></div>
            <label class="gag-lb">Título *</label><input id="gf-tit" class="gag-in" value="${esc(ev.titulo || '')}" placeholder="Ej. Ingreso de SASISOPA en ASEA · Gasolinera El Vaquero">
            <label class="gag-lb">¿Quién lo hace? <small>(puedes elegir varias personas)</small></label><div class="gag-opc" id="gf-resp"></div>
            <div style="display:flex;align-items:center;gap:8px;margin:12px 0 0;"><label class="gag-chk" style="padding:0;"><input type="checkbox" id="gf-todo" ${st.todo ? 'checked' : ''}> Todo el día (sin hora)</label></div>
            <div class="gag-g2"><div><label class="gag-lb">Empieza *</label><input id="gf-ini" class="gag-in" type="${st.todo ? 'date' : 'datetime-local'}" value="${st.todo ? iso(ini) : isoHora(ini)}"></div>
              <div><label class="gag-lb">Termina <small>(o fecha límite)</small></label><input id="gf-fin" class="gag-in" type="${st.todo ? 'date' : 'datetime-local'}" value="${st.todo ? iso(fin) : isoHora(fin)}"></div></div>
            <div class="gag-g2"><div><label class="gag-lb">Cliente</label><input id="gf-cli" class="gag-in" list="gf-cli-l" value="${esc(ev.cliente || pre.cliente || '')}" placeholder="Nombre comercial o razón social"><datalist id="gf-cli-l">${clientes.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
              <div><label class="gag-lb">Estación / lugar</label><input id="gf-est" class="gag-in" value="${esc(ev.estacion || '')}" placeholder="Ej. Parador Los Mezquites"></div></div>
            <div class="gag-g3"><div><label class="gag-lb">Dependencia</label><select id="gf-dep" class="gag-in"><option value="">—</option>${DEPENDENCIAS.map(d => `<option ${ev.dependencia === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>
              <div><label class="gag-lb">Estatus</label><select id="gf-est2" class="gag-in">${Object.entries(ESTATUS).map(([k, x]) => `<option value="${k}" ${(ev.estatus || 'pendiente') === k ? 'selected' : ''}>${esc(x.n)}</option>`).join('')}</select></div>
              <div><label class="gag-lb">Prioridad</label><select id="gf-pri" class="gag-in">${Object.entries(PRIORIDAD).map(([k, x]) => `<option value="${k}" ${st.prioridad === k ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
            <label class="gag-lb">Requisitos y documentos <small>(se palomean conforme se juntan)</small></label><div id="gf-chk"></div>
            <div style="display:flex;gap:8px;"><input id="gf-chk-n" class="gag-in" placeholder="Ej. Plano arquitectónico firmado"><button type="button" class="gag-btn" id="gf-chk-a">${IC.mas} Agregar</button></div>
            <label class="gag-lb">Notas</label><textarea id="gf-not" class="gag-in" rows="3" placeholder="Lo que el equipo debe saber">${esc(ev.notas || '')}</textarea>`;
        const md = modal(ev.id ? 'Editar actividad' : 'Nueva actividad', cuerpo, async (m, err) => {
            const g = id => m.querySelector('#' + id).value.trim();
            const todo = m.querySelector('#gf-todo').checked;
            const titulo = g('gf-tit'), i0 = g('gf-ini'), f0 = g('gf-fin') || i0;
            if (!titulo) { err.textContent = 'Escribe el título.'; return false; }
            if (!i0) { err.textContent = 'Elige la fecha de inicio.'; return false; }
            if (f0 < i0) { err.textContent = 'La fecha final no puede ser antes que la de inicio.'; return false; }
            if (!st.resp.size) { err.textContent = 'Elige quién lo hace.'; return false; }
            const resp = [...st.resp];
            const datos = { titulo, tipo: st.tipo, responsables: resp, todoElDia: todo, inicio: todo ? i0 : i0.slice(0, 16), fin: todo ? f0 : f0.slice(0, 16),
                cliente: g('gf-cli') || null, estacion: g('gf-est') || null, dependencia: g('gf-dep') || null, estatus: g('gf-est2'), prioridad: g('gf-pri'),
                checklist: st.checklist, notas: g('gf-not') || null, actualizadoPor: nombreActual(), actualizadoEn: new Date().toISOString() };
            if (!ev.id) Object.assign(datos, { creadoPor: nombreActual(), creadoPorCorreo: correoActual(), creadoEn: new Date().toISOString(), comentarios: [] });
            const id = await guardarEvento(ev.id, datos);
            const antes = new Set(ev.responsables || []);
            resp.filter(c => !antes.has(c)).forEach(c => avisar(c, `${nombreActual()} te asignó en Gestoría: ${titulo} · ${todo ? fechaLarga(aFecha(i0)) : fechaLarga(aFecha(i0)) + ' ' + hora(aFecha(i0))}.`));
            toast(ev.id ? 'Actividad actualizada' : 'Actividad agregada al calendario');
            if (ev.id && S.sel === ev.id) setTimeout(() => abrir(ev.id), 300);
            if (!ev.id) { S.ref = diaSolo(aFecha(i0)); pintar(); }
            void id;
        }, ev.id ? 'Guardar cambios' : 'Agregar al calendario');
        const pTipo = () => { md.querySelector('#gf-tipo').innerHTML = Object.entries(TIPOS).map(([k, t]) => `<button type="button" class="${st.tipo === k ? 'on' : ''}" style="${st.tipo === k ? `background:${t.c};border-color:${t.c};` : ''}" data-k="${k}"><span style="width:9px;height:9px;border-radius:3px;background:${st.tipo === k ? '#fff' : t.c};"></span>${esc(t.n)}</button>`).join(''); md.querySelectorAll('#gf-tipo button').forEach(b => b.onclick = () => { st.tipo = b.dataset.k; pTipo(); }); };
        const pResp = () => { md.querySelector('#gf-resp').innerHTML = GAG_EQUIPO.map(p => `<button type="button" class="${st.resp.has(p.correo) ? 'on' : ''}" style="${st.resp.has(p.correo) ? `background:${p.color};border-color:${p.color};` : ''}" data-c="${p.correo}">${avatar(p, 18)}${esc(p.nombre)}</button>`).join(''); md.querySelectorAll('#gf-resp button').forEach(b => b.onclick = () => { st.resp.has(b.dataset.c) ? st.resp.delete(b.dataset.c) : st.resp.add(b.dataset.c); pResp(); }); };
        const pChk = () => { const c = md.querySelector('#gf-chk'); c.innerHTML = st.checklist.map((x, i) => `<div class="gag-chk" style="justify-content:space-between;"><label style="display:flex;gap:8px;align-items:center;"><input type="checkbox" ${x.ok ? 'checked' : ''} data-i="${i}">${esc(x.t)}</label><button type="button" class="gag-btn chico" data-q="${i}">Quitar</button></div>`).join('');
            c.querySelectorAll('input[data-i]').forEach(b => b.onchange = () => { st.checklist[b.dataset.i].ok = b.checked; });
            c.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { st.checklist.splice(Number(b.dataset.q), 1); pChk(); }); };
        const addChk = () => { const i = md.querySelector('#gf-chk-n'); const t = i.value.trim(); if (!t) return; st.checklist.push({ t, ok: false }); i.value = ''; pChk(); i.focus(); };
        md.querySelector('#gf-chk-a').onclick = addChk;
        md.querySelector('#gf-chk-n').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addChk(); } };
        md.querySelector('#gf-todo').onchange = e => {
            const on = e.target.checked;
            ['gf-ini', 'gf-fin'].forEach(id => { const x = md.querySelector('#' + id), v = x.value; x.type = on ? 'date' : 'datetime-local'; x.value = on ? v.slice(0, 10) : (v.length === 10 ? v + 'T09:00' : v); });
        };
        pTipo(); pResp(); pChk();
    }

    // ───────────── trámites: alta de venta, agregar y actualizar ─────────────
    function nuevaVenta() {
        let aspel = null, partidasAspel = null;
        const md = modal('Venta de gestoría', `
            <div style="font-size:12.5px;color:#64748B;">Escribe el número de <b>pedido de Aspel</b> y toca "Jalar de Aspel": se llenan cliente, fecha, total y los trámites del pedido.</div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;"><div><label class="gag-lb">Pedido Aspel *</label><input id="gv-ped" class="gag-in" placeholder="Ej. CHH0000006732"></div><button type="button" class="gag-btn pri" id="gv-jalar">Jalar de Aspel</button></div>
            <div id="gv-aspel" style="font-size:12px;color:${NAVY};margin-top:6px;"></div>
            <label class="gag-lb">Cliente *</label><input id="gv-cli" class="gag-in">
            <div class="gag-g3"><div><label class="gag-lb">Fecha</label><input id="gv-fecha" type="date" class="gag-in" value="${iso(hoyD())}"></div><div><label class="gag-lb">Total ($)</label><input id="gv-total" type="number" step="0.01" class="gag-in"></div><div><label class="gag-lb">Cotización</label><input id="gv-cot" class="gag-in"></div></div>
            <label class="gag-lb">Vendedor</label><input id="gv-vend" class="gag-in">
            <label class="gag-lb">Trámites vendidos <small>(los del pedido de Aspel se agregan solos; marca aquí solo los que falten)</small></label>
            <div style="max-height:190px;overflow-y:auto;border:1px solid #E4E8F1;border-radius:10px;padding:6px 10px;">${CATALOGO_TRAMITES.map((n, i) => `<label class="gag-chk" style="padding:3px 0;"><input type="checkbox" class="gv-part" value="${i}">${esc(n)}</label>`).join('')}</div>
            <label class="gag-lb">Otro trámite <small>(opcional)</small></label><input id="gv-otro" class="gag-in">
            <label class="gag-lb">Responsable de los trámites</label><select id="gv-resp" class="gag-in"><option value="">Sin asignar por ahora</option>${GAG_EQUIPO.map(p => `<option value="${p.correo}">${esc(p.nombre)}</option>`).join('')}</select>`,
            async (m, err) => {
                const g = id => m.querySelector('#' + id).value.trim();
                const parts = (partidasAspel || []).map(x => x.nombre).concat([...m.querySelectorAll('.gv-part:checked')].map(c => CATALOGO_TRAMITES[Number(c.value)]));
                if (g('gv-otro')) parts.push(g('gv-otro'));
                if (!g('gv-ped') || !g('gv-cli')) { err.textContent = 'Faltan el pedido y el cliente.'; return false; }
                if (!parts.length) { err.textContent = 'Marca al menos un trámite.'; return false; }
                if (S.ventas.some(v => norm(v.pedido) === norm(g('gv-ped')))) { err.textContent = 'Ese pedido ya está dado de alta.'; return false; }
                const resp = g('gv-resp') || null;
                const datos = { pedido: g('gv-ped'), cliente: g('gv-cli'), fechaPedido: g('gv-fecha') || null, total: Number(g('gv-total')) || 0, cotizacion: g('gv-cot') || null, vendedor: g('gv-vend') || null,
                    partidas: parts.map(n => { const a = (partidasAspel || []).find(x => x.nombre === n); return { nombre: n, cantidad: a ? a.cantidad : 1, importe: a ? a.importe : null, claveAspel: a ? a.clave : null, estatus: 'pendiente', fechaCompromiso: null, documentoAtrasa: null, nota: null, responsable: resp }; }),
                    aspel, creadoPor: nombreActual(), creadoPorCorreo: correoActual(), creadoEn: new Date().toISOString(), historial: [{ accion: 'alta', por: nombreActual(), en: new Date().toISOString() }] };
                const f = await fs(); await f.addDoc(f.collection(null, COL_VENTAS), datos);
                const msg = `Venta de gestoría: ${datos.cliente} · pedido ${datos.pedido} · ${dinero(datos.total)} · ${parts.length} trámite(s).`;
                ['d.gutierrez@tecnocontrol.com.mx'].concat(resp ? [resp] : []).forEach(c => avisar(c, msg));
                toast('Venta registrada. Ponle fecha compromiso a cada trámite para verlo en el calendario.');
                S.vista = 'tramites'; pintar();
            }, 'Registrar venta');
        md.querySelector('#gv-jalar').onclick = async () => {
            const raw = md.querySelector('#gv-ped').value.trim().toUpperCase(), box = md.querySelector('#gv-aspel');
            if (!raw) { box.textContent = 'Escribe el pedido.'; return; }
            box.textContent = 'Buscando en Aspel…';
            try {
                if (typeof window.tcSbSesion !== 'function') throw new Error('falta la sesión de Supabase; recarga el portal');
                const sb = await window.tcSbSesion(); const r = await sb.rpc('aspel_pedido_operaciones', { p_cve: raw, p_tip: 'P' }); if (r.error) throw r.error;
                const d = r.data;
                if (!d || d.error) { box.innerHTML = `<span style="color:#B45309;">${d && d.error === 'sin_sesion' ? 'Tu sesión no llegó a Supabase: recarga el portal.' : 'No está en Aspel (o aún no se sincroniza). Captúralo a mano.'}</span>`; return; }
                const set = (id, v) => { const e = md.querySelector('#' + id); if (e && v != null) e.value = v; };
                set('gv-ped', d.cve_doc); set('gv-cli', d.cliente || ''); set('gv-fecha', d.fecha_doc); set('gv-total', d.total); set('gv-cot', d.cotizacion || ''); set('gv-vend', d.cve_vend ? 'Vendedor ' + d.cve_vend : '');
                aspel = { cveDoc: d.cve_doc, cliente: d.cve_clpv, status: d.status };
                const parts = (d.partidas || []).map(x => ({ nombre: String(x.extra || x.descripcion || x.clave || '').replace(/\s+/g, ' ').trim(), cantidad: Number(x.cant) || 1, importe: Number(x.importe) || 0, clave: x.clave || null }));
                partidasAspel = parts.length ? parts : null;
                box.innerHTML = `Encontrado: <b>${esc(d.cve_doc)}</b> · ${esc(d.cliente || '')} · ${dinero(d.total)}. ` + (parts.length ? `<b>${parts.length} trámite(s)</b> se agregan solos:<div style="max-height:100px;overflow-y:auto;margin-top:4px;color:#334155;">${parts.map(x => '· ' + esc(x.nombre) + ' · ' + dinero(x.importe)).join('<br>')}</div>` : 'Las partidas de este pedido aún no se sincronizan: márcalas abajo.');
            } catch (e) { box.innerHTML = `<span style="color:${ROJO};">No se pudo consultar Aspel: ${esc(e.message || e)}</span>`; }
        };
    }
    async function guardarPartidas(v, partidas, accion, nota) {
        const hist = (v.historial || []).concat([{ accion, nota: nota || null, por: nombreActual(), en: new Date().toISOString() }]).slice(-60);
        await guardarVenta(v, { partidas, historial: hist }); pintar();
    }
    function tramiteNuevo(id) {
        const v = S.ventas.find(x => x.id === id); if (!v) return;
        modal('Agregar trámite · ' + esc(v.cliente || ''), `<label class="gag-lb">Trámite</label><select id="gp-n" class="gag-in">${CATALOGO_TRAMITES.map(n => `<option>${esc(n)}</option>`).join('')}<option value="__otro">Otro…</option></select><input id="gp-o" class="gag-in" style="margin-top:8px;" placeholder="Si es otro, escríbelo">`,
            async (m, err) => { let n = m.querySelector('#gp-n').value; if (n === '__otro') n = m.querySelector('#gp-o').value.trim(); if (!n) { err.textContent = 'Escribe el trámite.'; return false; }
                await guardarPartidas(v, (v.partidas || []).concat([{ nombre: n, cantidad: 1, estatus: 'pendiente', fechaCompromiso: null, responsable: null }]), 'trámite agregado', n); toast('Trámite agregado'); }, 'Agregar');
    }
    function tramiteEditar(id, i) {
        const v = S.ventas.find(x => x.id === id), p = v && (v.partidas || [])[i]; if (!p) return;
        modal('Actualizar trámite', `<div style="font-size:15px;font-weight:800;color:${NAVY};">${esc(p.nombre)}</div><div style="font-size:12px;color:#64748B;">${esc(v.cliente || '')} · Pedido ${esc(v.pedido || '')}</div>
            <div class="gag-g2"><div><label class="gag-lb">Responsable</label><select id="gp-r" class="gag-in"><option value="">Sin asignar</option>${GAG_EQUIPO.map(x => `<option value="${x.correo}" ${p.responsable === x.correo ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
              <div><label class="gag-lb">Estatus</label><select id="gp-est" class="gag-in">${Object.entries(ESTATUS).map(([k, e]) => `<option value="${k}" ${p.estatus === k ? 'selected' : ''}>${esc(e.n)}</option>`).join('')}</select></div></div>
            <div class="gag-g3"><div><label class="gag-lb">Empieza <small>(opcional)</small></label><input id="gp-fi" type="date" class="gag-in" value="${esc(p.fechaInicio || '')}"></div><div><label class="gag-lb">Fecha compromiso</label><input id="gp-fc" type="date" class="gag-in" value="${esc(p.fechaCompromiso || '')}"></div>
              <div><label class="gag-lb">Dependencia</label><select id="gp-dep" class="gag-in"><option value="">—</option>${DEPENDENCIAS.map(d => `<option ${p.dependencia === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div></div>
            <label class="gag-lb">¿Qué documento o qué está atrasando la entrega?</label><input id="gp-doc" class="gag-in" value="${esc(p.documentoAtrasa || '')}" placeholder="Ej. el cliente no ha mandado el plano arquitectónico firmado">
            <label class="gag-lb">Nota</label><input id="gp-nota" class="gag-in" value="${esc(p.nota || '')}">
            <div style="font-size:11.5px;color:#64748B;margin-top:10px;">Con fecha compromiso, el trámite aparece en el calendario a nombre del responsable.</div>`,
            async (m, err) => {
                const g = x => m.querySelector('#' + x).value.trim();
                const est = g('gp-est'), doc = g('gp-doc'), fc = g('gp-fc') || null, fi = g('gp-fi') || null, resp = g('gp-r') || null;
                if (est === 'docs_cliente' && !doc) { err.textContent = 'Escribe qué documento falta del cliente.'; return false; }
                if (fi && fc && fi > fc) { err.textContent = 'La fecha de inicio no puede ser después de la fecha compromiso.'; return false; }
                const nuevo = { ...p, estatus: est, fechaInicio: fi, fechaCompromiso: fc, dependencia: g('gp-dep') || null, responsable: resp, documentoAtrasa: doc || null, nota: g('gp-nota') || null, actualizadoPor: nombreActual(), actualizadoEn: new Date().toISOString() };
                if (est === 'entregado' && !p.entregadoEn) nuevo.entregadoEn = iso(hoyD());
                const partidas = (v.partidas || []).slice(); partidas[i] = nuevo;
                await guardarPartidas(v, partidas, 'trámite actualizado', `${p.nombre}: ${ESTATUS[est].n}${doc ? ' · atrasa: ' + doc : ''}`);
                if (resp && resp !== p.responsable) avisar(resp, `${nombreActual()} te asignó el trámite ${p.nombre} de ${v.cliente || ''}${fc ? ' · compromiso ' + fechaLarga(aFecha(fc)) : ''}.`);
                toast('Trámite actualizado');
                if (S.sel) setTimeout(() => { if (buscarItem(v.id + '#' + i)) abrir(v.id + '#' + i); else cerrarDrawer(); }, 200);
            }, 'Guardar');
    }

    // ───────────── acciones rápidas ─────────────
    async function cambiarEstatus(id, est) {
        const it = buscarItem(id); if (!it || !puedeEditar()) return;
        try {
            if (it.src === 'agenda') {
                const c = (it.raw.comentarios || []).concat([{ texto: 'Cambió el estatus a: ' + ESTATUS[est].n, por: nombreActual(), en: new Date().toISOString(), sistema: true }]);
                await guardarEvento(it.id, { estatus: est, comentarios: c, actualizadoPor: nombreActual(), actualizadoEn: new Date().toISOString() });
                it.raw.estatus = est; it.raw.comentarios = c;
            } else {
                const partidas = (it.venta.partidas || []).slice(); partidas[it.idx] = { ...partidas[it.idx], estatus: est, ...(est === 'entregado' ? { entregadoEn: iso(hoyD()) } : {}) };
                await guardarPartidas(it.venta, partidas, 'estatus', `${it.titulo}: ${ESTATUS[est].n}`);
            }
            toast('Estatus: ' + ESTATUS[est].n); pintar(); abrir(id);
        } catch (e) { toast('No se pudo cambiar: ' + (e.message || e), true); }
    }
    async function comentar(id) {
        const it = buscarItem(id), inp = document.getElementById('gag-com'); if (!it || !inp) return;
        const t = inp.value.trim(); if (!t) return;
        const nuevo = { texto: t, por: nombreActual(), en: new Date().toISOString() };
        try {
            if (it.src === 'agenda') { const c = (it.raw.comentarios || []).concat([nuevo]); await guardarEvento(it.id, { comentarios: c }); it.raw.comentarios = c; }
            else { const partidas = (it.venta.partidas || []).slice(); partidas[it.idx] = { ...partidas[it.idx], comentarios: (partidas[it.idx].comentarios || []).concat([nuevo]) }; await guardarPartidas(it.venta, partidas, 'comentario', t); }
            it.resp.filter(c => c !== SIN_ASIGNAR).forEach(c => avisar(c, `${nombreActual()} comentó en "${it.titulo}": ${t}`));
            abrir(id);
        } catch (e) { toast('No se pudo guardar el comentario: ' + (e.message || e), true); }
    }
    async function mover(id, correo, diaIso) {
        const it = buscarItem(id); if (!it || !puedeEditar()) return;
        const delta = difDias(it.ini, aFecha(diaIso)), destino = correo === SIN_ASIGNAR ? null : correo, origen = S._dragDe;
        try {
            if (it.src === 'agenda') {
                const desp = d => { const x = new Date(d); x.setDate(x.getDate() + delta); return it.todoDia ? iso(x) : isoHora(x); };
                let resp = (it.raw.responsables || []).slice();
                if (destino && !resp.includes(destino)) resp = resp.filter(c => c !== origen).concat([destino]);
                if (!destino) resp = resp.filter(c => c !== origen);
                await guardarEvento(it.id, { inicio: desp(it.ini), fin: desp(it.fin), responsables: resp, actualizadoPor: nombreActual(), actualizadoEn: new Date().toISOString() });
                if (destino && destino !== origen) avisar(destino, `${nombreActual()} te pasó en Gestoría: ${it.titulo} · ${fechaLarga(aFecha(diaIso))}.`);
            } else {
                const p = it.venta.partidas[it.idx], fc = iso(sumarDias(aFecha(p.fechaCompromiso), delta)), fi = p.fechaInicio ? iso(sumarDias(aFecha(p.fechaInicio), delta)) : null;
                const partidas = it.venta.partidas.slice(); partidas[it.idx] = { ...p, fechaCompromiso: fc, fechaInicio: fi, responsable: destino };
                await guardarPartidas(it.venta, partidas, 'reprogramado', `${p.nombre} → ${fc}${destino ? ' · ' + nombreDe(destino) : ''}`);
                if (destino && destino !== p.responsable) avisar(destino, `${nombreActual()} te asignó el trámite ${p.nombre} · compromiso ${fechaLarga(aFecha(fc))}.`);
            }
            toast(delta ? 'Movido al ' + fechaLarga(aFecha(diaIso)) : 'Responsable actualizado');
        } catch (e) { toast('No se pudo mover: ' + (e.message || e), true); }
    }
    // Aviso al entrar: lo de hoy y lo atrasado de la persona (una vez por día).
    function recordatorio() {
        const c = correoActual(); if (!miembro(c) || !window.tcNotif) return;
        const clave = 'gag-rec-' + c + '-' + iso(hoyD());
        try { if (sessionStorage.getItem(clave)) return; sessionStorage.setItem(clave, '1'); } catch (e) { /* sin almacenamiento: avisa igual */ }
        const mis = items().filter(it => it.resp.includes(c) && !cerrado(it)), hoy = hoyD();
        const nHoy = mis.filter(it => enRango(it, hoy, hoy)).length, nAtr = mis.filter(atrasado).length;
        if (nHoy || nAtr) window.tcNotif.agregar({ titulo: 'Tu agenda de Gestoría', texto: [nHoy ? nHoy + ' actividad(es) para hoy' : '', nAtr ? nAtr + ' atrasada(s)' : ''].filter(Boolean).join(' · '), nivel: nAtr ? 'urgente' : 'normal', modulo: 'Gestoría' });
    }

    // ───────────── handlers globales ─────────────
    Object.assign(window, {
        gagVista(v) { S.vista = v; pintar(); },
        gagMover(n) { if (S.vista === 'mes') S.ref = new Date(S.ref.getFullYear(), S.ref.getMonth() + n, 1); else S.ref = sumarDias(S.ref, 7 * n); pintar(); },
        gagMesMini(n) { S.ref = new Date(S.ref.getFullYear(), S.ref.getMonth() + n, 1); pintar(); },
        gagIrHoy(v) { S.ref = hoyD(); if (v) S.vista = v; pintar(); },
        gagIr(d, v) { S.ref = aFecha(d); if (v) S.vista = v; else if (S.vista === 'tramites') S.vista = 'equipo'; pintar(); },
        gagBuscar(q) { S.q = q; S._focoQ = true; pintar(); S._focoQ = false; },
        gagPersona(c, on) { const ps = personasActivas(); on ? ps.add(c) : ps.delete(c); pintar(); },
        gagPersonasTodas() { const ps = personasActivas(), todos = GAG_EQUIPO.length + 1; const c = correoActual(); S.personas = ps.size >= todos && miembro(c) ? new Set([c]) : new Set(GAG_EQUIPO.map(p => p.correo).concat([SIN_ASIGNAR])); pintar(); },
        gagTipo(k) { S.tipos.has(k) ? S.tipos.delete(k) : S.tipos.add(k); if (!S.tipos.size) S.tipos = new Set(Object.keys(TIPOS)); pintar(); },
        gagFiltroTram(k) { S.filtroTram = k; pintar(); },
        gagAbrir: abrir, gagCerrarDetalle: cerrarDrawer,
        gagNuevo(dia, resp) { if (!puedeEditar()) return; formEvento(null, { dia, resp }); },
        gagNuevoHora(ev, dia) { if (!puedeEditar() || ev.target.closest('.gag-ev')) return; const y = ev.offsetY, min = Math.floor(y / H_PX * 2) * 30 + H_INI * 60; formEvento(null, { dia, hora: String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0') }); },
        gagEditar(id) { const e = S.eventos.find(x => x.id === id); if (e) formEvento(e); },
        async gagBorrar(id) {
            const e = S.eventos.find(x => x.id === id); if (!e) return;
            if (!confirm(`¿Eliminar "${e.titulo}" del calendario?\n\nNo se puede deshacer.`)) return;
            try { const f = await fs(); await f.deleteDoc(f.doc(null, COL_AGENDA, id)); cerrarDrawer(); toast('Actividad eliminada'); } catch (x) { toast('No se pudo eliminar: ' + (x.message || x), true); }
        },
        gagEstatus: cambiarEstatus, gagComentar: comentar,
        async gagCheck(id, i, ok) {
            const it = buscarItem(id); if (!it || it.src !== 'agenda') return;
            const c = (it.raw.checklist || []).map((x, k) => k === i ? { ...x, ok, por: nombreActual(), en: new Date().toISOString() } : x);
            try { await guardarEvento(id, { checklist: c }); it.raw.checklist = c; abrir(id); } catch (e) { toast('No se pudo guardar: ' + (e.message || e), true); }
        },
        gagNuevaVenta() { if (puedeEditar()) nuevaVenta(); },
        gagTramiteNuevo: tramiteNuevo, gagTramiteEditar: tramiteEditar,
        gagDrag(ev, id) { S._drag = id; const row = ev.target.closest('.gag-eq-row'); const b = row && row.querySelector('[ondrop]'); S._dragDe = b ? (b.getAttribute('ondrop').match(/'([^']+)','\d{4}/) || [])[1] : null; ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', id); } catch (e) { /* IE */ } },
        gagSobre(ev, el) { if (!S._drag) return; ev.preventDefault(); el.classList.add('drop'); },
        gagSoltar(ev, el, correo, dia) { ev.preventDefault(); el.classList.remove('drop'); const id = S._drag; S._drag = null; if (id) mover(id, correo, dia); },
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('gag-dr') && !document.querySelector('.gag-md')) cerrarDrawer(); });

    window.gestoriaAgendaMontar = function (el) {
        if (!el) return;
        estilos(); S.el = el;
        pintar();
        if (puedeVer()) suscribir();
    };
    let _rz = null; window.addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(() => { if (S.el && document.body.contains(S.el) && !document.querySelector('.gag-md')) pintar(); }, 250); });
    // Para refrescar la línea de "ahora" cada minuto en la vista Semana.
    setInterval(() => { if (S.el && document.body.contains(S.el) && S.vista === 'semana' && !document.querySelector('.gag-md')) pintar(); }, 60000);
})();
