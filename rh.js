// ══════════════════════════════════════════════════════════════
// MÓDULO RH — Portal Tecnocontrol
// Archivo: /rh.js
// Dependencias globales que provee index.html:
//   - db, auth (Firebase)
//   - esAdminTotal(email), mostrarPush()
// ══════════════════════════════════════════════════════════════

// ── Inyectar estilos CSS del módulo RH ──────────────────────
(function inyectarCSSRH() {
    if (document.getElementById('css-rh')) return;
    const style = document.createElement('style');
    style.id = 'css-rh';
    style.textContent = `
        /* ══ MINI-DASHBOARD RH ══════════════════════════════════ */
        #rh-dashboard{display:none;margin-bottom:28px;}
        #rh-inline-form{display:none;background:#fff;border-radius:16px;border:2px solid #2563eb;padding:20px;margin:12px 0;box-shadow:0 4px 20px rgba(37,99,235,0.12);animation:slideDown 0.2s ease;}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
        #rh-inline-form .rh-form-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:#1e3a8a;margin-bottom:16px;display:flex;align-items:center;gap:8px;}
        .rh-inline-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;}
        @media(max-width:768px){.rh-inline-grid{grid-template-columns:1fr !important;}}
        .rh-dash-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
        .rh-dash-title{font-family:'Space Grotesk',sans-serif;font-size:15px;font-weight:700;color:#1e293b;display:flex;align-items:center;gap:8px;}
        .rh-dash-badge{background:#fce7f3;color:#be185d;font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;}
        .rh-mes-selector{display:flex;align-items:center;gap:8px;font-size:12px;color:#64748b;}
        .rh-mes-btn{background:#ffffff;border:1px solid #cbd5e1;color:#475569;padding:5px 12px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;transition:0.2s;}
        .rh-mes-btn:hover{background:#eff6ff;color:#1e293b;}
        .rh-mes-label{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;color:#1e293b;min-width:90px;text-align:center;}
        .rh-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px;}
        .rh-kpi{background:#ffffff;border-radius:16px;padding:18px 16px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);position:relative;overflow:hidden;cursor:pointer;transition:0.2s;}
        .rh-kpi:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.10);}
        .rh-kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
        .rh-kpi.rotacion::before{background:linear-gradient(90deg,#f43f5e,#fb7185);}
        .rh-kpi.faltas::before{background:linear-gradient(90deg,#f97316,#fb923c);}
        .rh-kpi.retardos::before{background:linear-gradient(90deg,#f59e0b,#fbbf24);}
        .rh-kpi.descuentos::before{background:linear-gradient(90deg,#8b5cf6,#a78bfa);}
        .rh-kpi.vacantes::before{background:linear-gradient(90deg,#2563eb,#60a5fa);}
        .rh-kpi-icon{font-size:22px;margin-bottom:8px;}
        .rh-kpi-val{font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;color:#1e293b;line-height:1;}
        .rh-kpi-label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-top:4px;}
        .rh-kpi-delta{font-size:10px;margin-top:6px;font-weight:700;}
        .rh-kpi-delta.up{color:#dc2626;}
        .rh-kpi-delta.down{color:#16a34a;}
        .rh-kpi-delta.neutral{color:#64748b;}
        .rh-charts{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:14px;margin-bottom:20px;}
        .rh-chart-card{background:#ffffff;border-radius:16px;padding:20px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);}
        .rh-chart-title{font-size:12px;font-weight:700;color:#1e293b;margin-bottom:4px;}
        .rh-chart-sub{font-size:10px;color:#64748b;margin-bottom:14px;}
        .rh-vacantes{background:#ffffff;border-radius:16px;padding:20px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);margin-bottom:20px;}
        .rh-vac-title{font-size:12px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;}
        .rh-vac-row{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;padding:10px 12px;border-radius:10px;font-size:12px;align-items:center;margin-bottom:6px;border:1px solid rgba(59,130,246,0.08);}
        .rh-vac-row.header{background:#f8faff;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;}
        .rh-vac-row:not(.header){background:#ffffff;}
        .rh-vac-row:not(.header):hover{background:#f8faff;}
        .vac-status{padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;display:inline-block;}
        .vac-abierta{background:#eff6ff;color:#2563eb;}
        .vac-nueva{background:#f0fdf4;color:#16a34a;}
        .vac-concretada{background:#fce7f3;color:#be185d;}
        .rh-actas{background:#ffffff;border-radius:16px;padding:20px;border:1px solid rgba(59,130,246,0.10);box-shadow:0 2px 8px rgba(37,99,235,0.05);margin-bottom:20px;}
        .rh-acta-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(59,130,246,0.06);font-size:12px;}
        .rh-acta-row:last-child{border-bottom:none;}
        .rh-acta-emp{font-weight:700;color:#1e293b;}
        .rh-acta-motivo{color:#64748b;}
        .rh-acta-fecha{color:#94a3b8;font-size:10px;}
        .acta-tipo{padding:3px 8px;border-radius:10px;font-size:10px;font-weight:700;}
        .acta-falta{background:#fee2e2;color:#dc2626;}
        .acta-retardo{background:#fef9c3;color:#a16207;}
        .acta-conducta{background:#f3e8ff;color:#7c3aed;}
        .rh-add-btn{padding:7px 14px;background:linear-gradient(135deg,#db2777,#be185d);color:white;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:0.2s;letter-spacing:0.5px;}
        .rh-add-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(190,24,93,0.3);}
        #modal-rh{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);z-index:3000;align-items:center;justify-content:center;}
        .rh-modal-box{background:#ffffff;border-radius:20px;padding:28px;width:520px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.15);}
        .rh-modal-title{font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#1e293b;margin-bottom:20px;}
        .rh-form-label{font-size:10px;font-weight:700;color:#64748b;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;display:block;margin-top:14px;}
        .rh-form-input{width:100%;padding:11px 14px;border-radius:10px;border:1px solid rgba(59,130,246,0.2);background:#f8faff;color:#1e293b;font-size:13px;outline:none;font-family:'DM Sans',sans-serif;}
        .rh-form-input:focus{border-color:#2563eb;background:#eff6ff;}
        .rh-tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}
        .rh-tab{padding:8px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;transition:0.2s;}
        .rh-tab.active{background:#db2777;color:#ffffff;border-color:#db2777;}

        /* ══ RH 360° — DIRECTORIO Y PERFILES ══════════════════ */
        #rh360-root{display:none;margin-top:16px;}
        .rh360-nav{display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid #f1f5f9;padding-bottom:12px;flex-wrap:wrap;}
        .rh360-nav-btn{padding:8px 18px;border-radius:10px;border:1.5px solid #E2E8F0;background:#fff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px;}
        .rh360-nav-btn.on{background:#0A1628;color:#fff;border-color:#0A1628;}
        .rh360-nav-btn:hover:not(.on){background:#F8FAFD;border-color:#CBD5E1;}
        /* Buscador y filtros */
        .rh360-search-bar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;}
        .rh360-search{flex:1;min-width:200px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;outline:none;background:#fff;}
        .rh360-search:focus{border-color:#2563EB;}
        .rh360-filter{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:12px;background:#fff;outline:none;cursor:pointer;}
        /* Grid de tarjetas */
        .rh360-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
        /* Tarjeta colaborador */
        .rh360-card{background:#fff;border-radius:14px;border:1.5px solid #E8EDF5;padding:18px;cursor:pointer;transition:.15s;position:relative;overflow:hidden;}
        .rh360-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#2563EB,#7C3AED);}
        .rh360-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,99,235,.1);border-color:#BFDBFE;}
        .rh360-card-head{display:flex;align-items:center;gap:12px;margin-bottom:12px;}
        .rh360-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;background:linear-gradient(135deg,#1E3A5F,#2563EB);display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:900;flex-shrink:0;}
        .rh360-avatar img{width:44px;height:44px;border-radius:50%;object-fit:cover;}
        .rh360-name{font-size:13px;font-weight:800;color:#0A0F1E;line-height:1.2;}
        .rh360-puesto{font-size:11px;color:#64748B;margin-top:2px;}
        .rh360-card-pills{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;}
        .rh360-pill{font-size:9.5px;font-weight:700;padding:3px 8px;border-radius:99px;background:#F1F5F9;color:#475569;}
        .rh360-pill.depto{background:#EFF6FF;color:#2563EB;}
        .rh360-pill.plaza{background:#F0FDF4;color:#16A34A;}
        .rh360-pill.baja{background:#FEE2E2;color:#DC2626;}
        .rh360-card-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;border-top:1px solid #F1F5F9;padding-top:10px;}
        .rh360-stat-item{text-align:center;}
        .rh360-stat-val{font-size:12px;font-weight:800;color:#0A0F1E;}
        .rh360-stat-lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8;margin-top:1px;}
        /* Semáforo documental */
        .rh360-semaforo{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;}
        .rh360-doc-dot{width:10px;height:10px;border-radius:50%;cursor:pointer;flex-shrink:0;}
        .rh360-doc-dot.verde{background:#15803D;}
        .rh360-doc-dot.amarillo{background:#D97706;}
        .rh360-doc-dot.rojo{background:#DC2626;}
        .rh360-doc-dot.gris{background:#CBD5E1;}
        /* Modal perfil 360° */
        #rh360-modal{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(6px);z-index:3000;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;}
        #rh360-modal.show{display:flex;}
        .rh360-modal-box{background:#F8FAFD;border-radius:20px;width:100%;max-width:780px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.2);margin:auto;}
        .rh360-modal-hero{background:linear-gradient(135deg,#0A1628,#1E3A5F);padding:24px;display:flex;align-items:center;gap:18px;color:#fff;}
        .rh360-modal-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,.3);object-fit:cover;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;flex-shrink:0;}
        .rh360-modal-name{font-size:20px;font-weight:900;letter-spacing:-.3px;}
        .rh360-modal-sub{font-size:12px;color:rgba(255,255,255,.6);margin-top:3px;}
        .rh360-modal-tabs{display:flex;background:#fff;border-bottom:2px solid #F1F5F9;overflow-x:auto;}
        .rh360-modal-tab{padding:12px 18px;font-size:12px;font-weight:700;color:#64748B;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px;white-space:nowrap;transition:.15s;}
        .rh360-modal-tab.on{color:#2563EB;border-bottom-color:#2563EB;}
        .rh360-modal-body{padding:20px;max-height:60vh;overflow-y:auto;}
        .rh360-section{margin-bottom:20px;}
        .rh360-section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:10px;}
        .rh360-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .rh360-field{background:#fff;border-radius:8px;padding:10px 12px;border:1px solid #E8EDF5;}
        .rh360-field-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px;}
        .rh360-field-val{font-size:13px;font-weight:700;color:#0A0F1E;word-break:break-word;}
        /* Timeline */
        .rh360-timeline{position:relative;padding-left:20px;}
        .rh360-timeline::before{content:'';position:absolute;left:6px;top:0;bottom:0;width:2px;background:#E2E8F0;}
        .rh360-tl-item{position:relative;margin-bottom:14px;}
        .rh360-tl-dot{position:absolute;left:-17px;top:4px;width:10px;height:10px;border-radius:50%;background:#2563EB;border:2px solid #fff;}
        .rh360-tl-date{font-size:9.5px;font-weight:700;color:#94A3B8;margin-bottom:2px;}
        .rh360-tl-text{font-size:12px;font-weight:600;color:#334155;}
        /* Barra progreso */
        .rh360-progress{height:6px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin-top:4px;}
        .rh360-progress-fill{height:100%;border-radius:99px;transition:.4s;}
        /* Alertas */
        .rh360-alert{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;margin-bottom:8px;font-size:12px;font-weight:600;}
        .rh360-alert.rojo{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;}
        .rh360-alert.amarillo{background:#FFFBEB;color:#B45309;border:1px solid #FDE68A;}
        .rh360-alert.verde{background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;}
        /* Organigrama */
        .rh360-org-node{background:#fff;border:1.5px solid #E2E8F0;border-radius:10px;padding:10px 14px;text-align:center;cursor:pointer;transition:.15s;min-width:140px;}
        .rh360-org-node:hover{border-color:#2563EB;box-shadow:0 4px 12px rgba(37,99,235,.1);}
        .rh360-org-node.root{background:#0A1628;color:#fff;border-color:#0A1628;}
        .rh360-org-level{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:16px;position:relative;}

        @media(max-width:768px){
            .rh-charts{grid-template-columns:1fr !important;}
            .rh-kpis{grid-template-columns:repeat(2,1fr) !important;gap:8px !important;}
            .rh-kpi{padding:10px 8px !important;}
            .rh-kpi-val{font-size:20px !important;}
            .rh-tabs{gap:4px;}
            .rh-tab{padding:6px 10px;font-size:11px;}
            .rh-modal-box{width:96vw;padding:16px;border-radius:20px 20px 0 0;position:fixed;bottom:0;left:0;max-height:92vh;}
            #modal-rh{align-items:flex-end !important;}
            .rh360-grid{grid-template-columns:1fr;}
            .rh360-grid2{grid-template-columns:1fr;}
            .rh360-modal-box{border-radius:16px 16px 0 0;position:fixed;bottom:0;left:0;right:0;max-width:100%;}
            #rh360-modal{padding:0;align-items:flex-end;}
        }
    `;
    document.head.appendChild(style);
})();


// ── JS del módulo RH ─────────────────────────────────────────
// MÓDULO RH — Indicadores confidenciales
// Solo visible para rh@tecnocontrol.com.mx y admin
// Datos guardados en Firestore colección: rh_indicadores
// ══════════════════════════════════════════════════════════════
const RH_EMAIL = 'rh@tecnocontrol.com.mx';
const MESES_RH = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
let rhData = {};
let rhChartTendencia = null, rhChartAus = null, rhChartVac = null;
let rhTabActual = 'retardo'; // tab por defecto
let rhEditandoId = null; // id del doc que se está editando

// ── Semana actual ──
// ── Semana RH: Sábado → Viernes ─────────────────────────────
// Sábado = día 6 en JS (0=Dom, 1=Lun... 6=Sáb)
function getInicioSemanaRH(d){
    // Encuentra el Sábado que inicia la semana
    const dt = new Date(d||new Date()); dt.setHours(0,0,0,0);
    const day = dt.getDay(); // 0=Dom, 6=Sáb
    // Si hoy es Sáb(6): offset=0. Si Dom(0): offset=-1... Vie(5): offset=-6
    const diffToSab = day === 6 ? 0 : -(day + 1);
    dt.setDate(dt.getDate() + diffToSab);
    return dt;
}
function getFinSemanaRH(inicioSab){
    const fin = new Date(inicioSab);
    fin.setDate(fin.getDate() + 6); // Sáb + 6 = Viernes
    return fin;
}
function getSemanaKeyRH(d){
    // Formato: YYYY-WNN donde NN = número de semana ISO
    // La semana RH va Sáb→Vie pero usamos el lunes de esa semana como referencia
    const dt = new Date(d||new Date()); dt.setHours(0,0,0,0);
    // Obtener el lunes de la semana ISO
    const day = dt.getDay(); // 0=Dom, 6=Sáb
    const diffToMon = (day === 0) ? -6 : 1 - day;
    const lunes = new Date(dt);
    lunes.setDate(dt.getDate() + diffToMon);
    // Calcular semana ISO
    const yearStart = new Date(lunes.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((lunes - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
    return `${lunes.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
}
// Mantener compatibilidad con funciones anteriores
function getISOWeek(d){
    const dt = new Date(d); dt.setHours(0,0,0,0);
    dt.setDate(dt.getDate()+4-(dt.getDay()||7));
    const yearStart = new Date(dt.getFullYear(),0,1);
    return Math.ceil((((dt-yearStart)/86400000)+1)/7);
}
function getSemanaKey(d){ return getSemanaKeyRH(d); }
function getInicioSemana(d){ return getInicioSemanaRH(d); }

let rhSemanaOffset = 0; // 0=semana actual, -1=anterior, etc.

function getRhSemanaActual(){
    const d = new Date();
    d.setDate(d.getDate() + rhSemanaOffset*7);
    return d;
}

function rhKey(){ return getSemanaKeyRH(getRhSemanaActual()); }

function puedeVerRH(email){ return email === RH_EMAIL || (typeof esAdminTotal === 'function' && esAdminTotal(email)) || (typeof window.esAdminTotal === 'function' && window.esAdminTotal(email)); }

// Mostrar/ocultar el dashboard RH según el área
function _toggleRHDash(area, email){
    const dash = document.getElementById('rh-dashboard');
    if(!dash) return;
    if(area === 'Recursos Humanos' && puedeVerRH(email)){
        dash.style.display = 'block';
        actualizarLabelMesRH();
        cargarDatosRH();
    } else {
        dash.style.display = 'none';
    }
}

function actualizarLabelMesRH(){
    const el = document.getElementById('rh-mes-label');
    if(!el) return;
    const d = getRhSemanaActual();
    const inicio = getInicioSemanaRH(d);
    const fin = getFinSemanaRH(inicio);
    const fmt = dt => dt.toLocaleDateString('es-MX',{day:'numeric',month:'short'});
    const key = getSemanaKeyRH(d);
    const semNum = key.split('-W')[1] || '—';
    el.innerText = `Sem ${semNum} · ${fmt(inicio)} (Sáb) – ${fmt(fin)} (Vie)`;
}

window.rhMesPrev = () => { rhSemanaOffset--; actualizarLabelMesRH(); cargarDatosRH(); };
window.rhMesNext = () => { rhSemanaOffset++; if(rhSemanaOffset>0) rhSemanaOffset=0; actualizarLabelMesRH(); cargarDatosRH(); };

// Cargar datos RH del mes seleccionado desde Firestore
async function cargarDatosRH(){
    const key = rhKey();
    try {
        const fbRH = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        window._rhDeleteDoc = (id) => fbRH.deleteDoc(fbRH.doc(db,'rh_indicadores',id));
        window._rhUpdate    = (id, data) => fbRH.updateDoc(fbRH.doc(db,'rh_indicadores',id), data);

        // Calcular rango de semana y mes
        const inicio = getInicioSemanaRH(getRhSemanaActual());
        const fin = getFinSemanaRH(inicio);
        const fechaIni = inicio.toISOString().slice(0,10);
        const fechaFin = fin.toISOString().slice(0,10);
        const mesAnioActual = inicio.getFullYear()+'-'+String(inicio.getMonth()+1).padStart(2,'0');

        const snapAll = await fbRH.getDocs(fbRH.collection(db,'rh_indicadores'));
       const semData = { retardos:[], faltas:[], descuentos:[], vacantes:[], actas:[], rotacion:[], capacitacion:[], incapacidad:[] };
        
        const tipoMapRH = {
            'retardo':'retardos', 'falta':'faltas', 'descuento':'descuentos',
            'vacante':'vacantes', 'acta':'actas', 'rotacion':'rotacion',
            'capacitacion':'capacitacion', 'incapacidad':'incapacidad'
        };

        snapAll.docs.forEach(d => {
            const data = d.data();
            const tipo = data.tipo;
            const arrayKey = tipoMapRH[tipo];
            if(!arrayKey || !semData[arrayKey]) return;
            
            const matchKey = data.semanaKey === key;
            const matchFecha = data.fecha && data.fecha >= fechaIni && data.fecha <= fechaFin;
            const creadoFecha = data.creadoEn ? data.creadoEn.slice(0,10) : '';
            const matchCreado = creadoFecha >= fechaIni && creadoFecha <= fechaFin;
            const matchMes = data.mesAnio === mesAnioActual;

            const esMensual = tipo === 'vacante' || tipo === 'acta';
            if(esMensual){
                if(matchMes || matchFecha) semData[arrayKey].push({id:d.id,...data});
            } else {
                if(matchKey || matchFecha || matchCreado || matchMes) semData[arrayKey].push({id:d.id,...data});
            }
        });

        console.log('[RH] Rango:', fechaIni,'→',fechaFin,'| mes:',mesAnioActual);
        console.log('[RH] Encontrados:', Object.entries(semData).map(([k,v])=>v.length?`${k}:${v.length}`:'').filter(Boolean).join(', ')||'ninguno');
        
        rhData[key] = semData;
        renderRHDash(semData, key);
    } catch(e) {
        console.error('[RH] Error:', e.message);
        renderRHDash({ retardos:[], faltas:[], descuentos:[], vacantes:[], actas:[], rotacion:[], capacitacion:[], incapacidad:[] }, key);
    }
}

// Verificar si una fecha cae en la semana RH actual (Sáb-Vie)
function isEnSemanaActual(fechaStr){
    try {
        const fecha = new Date(fechaStr + 'T12:00:00');
        const inicio = getInicioSemanaRH(getRhSemanaActual());
        const fin = getFinSemanaRH(inicio);
        fin.setHours(23,59,59);
        return fecha >= inicio && fecha <= fin;
    } catch(e){ return false; }
}

// Renderizar el dashboard con los datos cargados
function renderRHDash(data, key){
    // data contiene listas: retardos[], faltas[], descuentos[], rotacion[], vacantes[], actas[]
    const ret   = data.retardos  || [];
    const falt  = data.faltas    || [];
    const desc  = data.descuentos|| [];
    const rot   = data.rotacion  || [];
    const vac   = data.vacantes  || [];
    const act   = data.actas     || [];

    // ── KPIs calculados de los registros ──
    const totalRetardos  = ret.length;
    const totalFaltas    = falt.length;
    const totalDescuentos= desc.reduce((s,d)=>s+(Number(d.monto)||0),0);
    const totalVacantes  = vac.length;
    const minutosRetardo = ret.reduce((s,r)=>s+(Number(r.minutos)||0),0);

    // Actualizar KPIs en pantalla
    const cap = data.capacitacion||[];
    const inc = data.incapacidad||[];
    // KPIs — usar directamente los arrays para asegurar conteos correctos
    const setKPI = (id, val, delta='') => {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
        const del = document.getElementById(id.replace('val','delta'));
        if(del && delta) del.innerHTML = `<span class="rh-kpi-delta neutral">${delta}</span>`;
    };
    setKPI('rh-val-rotacion', rot.length, `${rot.filter(r=>r.movimiento==='alta').length} altas · ${rot.filter(r=>r.movimiento?.includes('baja')).length} bajas`);
    setKPI('rh-val-faltas', falt.length, `${falt.filter(f=>f.tipoFalta==='injustificada').length} injust. · ${falt.filter(f=>f.tipoFalta?.includes('permiso')).length} permisos`);
    setKPI('rh-val-retardos', ret.length, `≈${ret.reduce((s,r)=>s+(Number(r.minutos)||0),0)} min totales`);
    setKPI('rh-val-descuentos', '$'+desc.reduce((s,d)=>s+(Number(d.monto)||0),0).toLocaleString('es-MX'), `${desc.length} descuentos`);
    setKPI('rh-val-vacantes', vac.length, `${vac.filter(v=>v.estatus==='concretada').length} concretadas`);
    const capEl = document.getElementById('rh-val-capacitacion');
    if(capEl){ capEl.innerText = cap.length;
        document.getElementById('rh-delta-capacitacion').innerHTML = `<span class="rh-kpi-delta neutral">${cap.reduce((s,c)=>s+(Number(c.asistentes?.split(',').length)||0),0)} asistentes</span>`; }
    const incEl = document.getElementById('rh-val-incapacidad');
    if(incEl){ incEl.innerText = inc.length;
        document.getElementById('rh-delta-incapacidad').innerHTML = `<span class="rh-kpi-delta neutral">${inc.reduce((s,i)=>s+(Number(i.dias)||0),0)} días totales</span>`; }

    // ── Helper para tabla de registros con editar/eliminar ──
    const tablaRegistros = (lista, cols, tipo) => {
        if(!lista.length) return `<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin registros esta semana</div>`;
        return lista.map(r => {
            const ficha = cols.map(col => {
                if(col === 'acciones') return `
                    <div style="display:flex;gap:6px;">
                        <button onclick="abrirModalRH('${tipo}','${r.id}')" style="padding:4px 8px;background:#eff6ff;color:#2563eb;border:1px solid #bfdbfe;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">✏️</button>
                        <button onclick="eliminarRH('${r.id}')" style="padding:4px 8px;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">🗑</button>
                    </div>`;
                return `<span style="font-size:12px;color:#1e293b;">${r[col] || '—'}</span>`;
            }).join('');
            return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(59,130,246,0.06);gap:8px;">${ficha}</div>`;
        }).join('');
    };

    // ── Tabla auxiliar con columnas legibles ──
    const tablaRH = (lista, campos, tipo) => {
        if(!lista.length) return `<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin registros esta semana</div>`;
        return lista.map(r => `
            <div style="display:grid;grid-template-columns:${Array(campos.length).fill('1fr').join(' ')} 80px;gap:8px;padding:9px 12px;border-bottom:1px solid rgba(59,130,246,0.06);align-items:center;">
                ${campos.map(f=>`<span style="font-size:12px;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r[f.key]||''}">${f.prefix||''}${r[f.key]||'—'}</span>`).join('')}
                <div style="display:flex;gap:4px;justify-content:flex-end;">
                    <button onclick="abrirModalRH('${tipo}','${r.id}')" style="padding:3px 7px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:10px;cursor:pointer;">✏️</button>
                    <button onclick="eliminarRH('${r.id}')" style="padding:3px 7px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;">🗑</button>
                </div>
            </div>`).join('');
    };

    const headerRH = (cols) => `
        <div style="display:grid;grid-template-columns:${Array(cols.length).fill('1fr').join(' ')} 80px;gap:8px;padding:7px 12px;background:#f8faff;border-radius:8px;margin-bottom:4px;">
            ${cols.map(c=>`<span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${c}</span>`).join('')}
            <span></span>
        </div>`;

    // ── Gráfica dona ausentismo ──
    const elAus = document.getElementById('rh-chart-ausentismo');
    if(elAus){
        if(rhChartAus) rhChartAus.destroy();
        const totalAus = totalFaltas + Math.round(totalRetardos*0.25);
        const diasEsp = 5 * Math.max(1, Math.round((falt[0]?.totalEmpleados||1)));
        const pctAus = Math.min(100, Math.round(totalAus/Math.max(1,diasEsp)*100))||0;
        rhChartAus = new Chart(elAus,{
            type:'doughnut',
            data:{datasets:[{data:[pctAus, Math.max(0.001,100-pctAus)],
                backgroundColor:['#f43f5e','#e2e8f0'],borderWidth:0}]},
            options:{cutout:'76%',plugins:{legend:{display:false}},animation:{duration:600}}
        });
        document.getElementById('rh-ausentismo-pct').innerText = totalFaltas+totalRetardos;
    }

    // ── Dona vacantes ──
    const elVac = document.getElementById('rh-chart-vacantes');
    if(elVac){
        if(rhChartVac) rhChartVac.destroy();
        const ab=vac.filter(v=>v.estatus==='abierta').length;
        const nu=vac.filter(v=>v.estatus==='nueva').length;
        const co=vac.filter(v=>v.estatus==='concretada').length;
        rhChartVac = new Chart(elVac,{
            type:'doughnut',
            data:{datasets:[{data:[ab,nu,co],
                backgroundColor:['#2563eb','#16a34a','#db2777'],borderWidth:2,borderColor:'#ffffff'}]},
            options:{cutout:'70%',plugins:{legend:{display:false}},animation:{duration:600}}
        });
        document.getElementById('rh-vacantes-total').innerHTML=`${ab+nu+co}<br><span style="font-size:9px;font-weight:400;color:#64748b;">total</span>`;
    }

    // ── Renderizar listas en el HTML ─────────────────────────
    // Vacantes → rh-vacantes-lista (existe en HTML)
    const vacListEl = document.getElementById('rh-vacantes-lista');
    if(vacListEl) vacListEl.innerHTML = vac.length
        ? headerRH(['Puesto','Área','Apertura','Estatus']) +
          tablaRH(vac,[{key:'puesto'},{key:'area'},{key:'fecha'},{key:'estatus'}],'vacante')
        : '<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin vacantes esta semana</div>';

    // Actas → rh-actas-lista (existe en HTML)
    const actListEl = document.getElementById('rh-actas-lista');
    if(actListEl) actListEl.innerHTML = act.length
        ? headerRH(['Colaborador','Área','Fecha','Tipo']) +
          tablaRH(act,[{key:'nombre'},{key:'area'},{key:'fecha'},{key:'tipoActa'}],'acta')
        : '<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin actas esta semana</div>';

    // Registros adicionales (retardos, faltas, descuentos, capacitaciones, incapacidades)
    // Se inyectan en bloques dinámicos después de las gráficas
    const rhExtraEl = document.getElementById('rh-registros-extra');
    if(rhExtraEl){
        // Mostrar siempre las secciones principales (con o sin datos)
        const seccion = (titulo, emoji, lista, campos, tipo, color, siempre=false) => (!lista.length && !siempre) ? '' : `
            <div style="background:#ffffff;border-radius:14px;padding:16px;border:1px solid rgba(59,130,246,0.08);margin-bottom:12px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <span style="font-size:12px;font-weight:700;color:#1e293b;">${emoji} ${titulo} <span style="font-weight:400;color:#64748b;">(${lista.length})</span></span>
                    <button onclick="abrirModalRH('${tipo}')" style="padding:4px 10px;background:${color};color:white;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">+ Agregar</button>
                </div>
                ${headerRH(campos.map(f=>f.label))}
                ${tablaRH(lista, campos.map(f=>({key:f.key})), tipo)}
            </div>`;

        rhExtraEl.innerHTML =
            seccion('Retardos','⏰', ret,
                [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Fecha',key:'fecha'},{label:'Hora',key:'hora'},{label:'Min.',key:'minutos'}],
                'retardo','#2563eb', true) +
            seccion('Faltas y Permisos','📅', falt,
                [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Fecha',key:'fecha'},{label:'Tipo',key:'tipoFalta'},{label:'Días',key:'dias'}],
                'falta','#f59e0b', true) +
            seccion('Descuentos','💰', desc,
                [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Fecha',key:'fecha'},{label:'Monto',key:'monto'}],
                'descuento','#7c3aed', true) +
            seccion('Capacitaciones','🎓', data.capacitacion||[],
                [{label:'Capacitación',key:'nombre'},{label:'Imparte',key:'impartidor'},{label:'Fecha',key:'fecha'},{label:'Lugar',key:'lugar'}],
                'capacitacion','#059669') +
            seccion('Incapacidades','🏥', data.incapacidad||[],
                [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Folio',key:'folio'},{label:'Días',key:'dias'}],
                'incapacidad','#ef4444') +
            seccion('Rotación de Personal','🔄', rot,
                [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Movimiento',key:'movimiento'},{label:'Fecha',key:'fecha'}],
                'rotacion','#64748b');
    }
}


// ── Selector de áreas ──────────────────────────────────────
// Áreas RH — lista base + campo para escribir una diferente
const RH_AREAS_LIST = ['Ingresos','Egresos','Contabilidad','Recursos Humanos','Marketing','Administración','Ventas',
    'Operaciones','Logística','Almacén','Servicios Técnicos','Compras','TI / Sistemas','Dirección General'];
const RH_AREA_SEL = () => `
    <select class="rh-form-input" id="rh-f-area-sel" onchange="rhAreaSelChange(this)" style="margin-bottom:4px;">
        ${RH_AREAS_LIST.map(a=>`<option value="${a}">${a}</option>`).join('')}
        <option value="__otra__">✏️ Otra (escribir)...</option>
    </select>
    <input type="text" class="rh-form-input" id="rh-f-area" placeholder="Nombre del departamento" style="display:none;margin-top:4px;">`;

// Mostrar/ocultar campo texto según selección
window.rhAreaSelChange = (sel) => {
    const input = document.getElementById('rh-f-area');
    const selEl = document.getElementById('rh-f-area-sel');
    if(!input || !selEl) return;
    if(sel.value === '__otra__'){
        input.style.display = 'block';
        input.focus();
        input.value = '';
    } else {
        input.style.display = 'none';
        input.value = sel.value;
    }
};

const TODAY = new Date().toISOString().slice(0,10);

// ── Formularios por tipo ────────────────────────────────────
const RH_FORMS = {
    retardo: () => `
        <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Registra cada retardo individualmente con colaborador y hora exacta.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Nombre del colaborador</label>
                <input class="rh-form-input" id="rh-f-nombre" type="text" placeholder="Nombre completo" autofocus></div>
            <div><label class="rh-form-label">Área</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Fecha</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
            <div><label class="rh-form-label">Hora de entrada real</label>
                <input class="rh-form-input" id="rh-f-hora" type="time"></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Minutos de retraso</label>
        <input class="rh-form-input" id="rh-f-minutos" type="number" min="1" placeholder="Ej: 25">
        <label class="rh-form-label">Notas / justificación</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Ej: Tráfico, cita médica...">`,

    falta: () => `
        <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Registra cada falta individualmente.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Nombre del colaborador</label>
                <input class="rh-form-input" id="rh-f-nombre" type="text" placeholder="Nombre completo"></div>
            <div><label class="rh-form-label">Área</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Fecha</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
            <div><label class="rh-form-label">Tipo</label>
                <select class="rh-form-input" id="rh-f-tipoFalta">
                    <option value="injustificada">Injustificada</option>
                    <option value="justificada">Justificada</option>
                    <option value="permiso-sin-goce">Permiso sin goce</option>
                    <option value="permiso-con-goce">Permiso con goce de sueldo</option>
                </select></div>
            <div><label class="rh-form-label">Días</label>
                <input class="rh-form-input" id="rh-f-dias" type="number" min="1" value="1" placeholder="Núm. de días"></div>
            <div><label class="rh-form-label">Fecha de regreso</label>
                <input class="rh-form-input" id="rh-f-fecha-regreso" type="date"></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Motivo / observaciones</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Ej: Sin aviso, enfermedad con comprobante, permiso autorizado por...">`,

    descuento: () => `
        <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Registra descuentos aplicados en nómina.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Nombre del colaborador</label>
                <input class="rh-form-input" id="rh-f-nombre" type="text" placeholder="Nombre completo"></div>
            <div><label class="rh-form-label">Área</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Monto descontado ($)</label>
                <input class="rh-form-input" id="rh-f-monto" type="number" min="0" step="0.01" placeholder="Ej: 350.00"></div>
            <div><label class="rh-form-label">Fecha de aplicación</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Motivo del descuento</label>
        <select class="rh-form-input" id="rh-f-motivoDesc">
            <option>Retardo</option><option>Falta injustificada</option>
            <option>Préstamo</option><option>Daño a equipo</option><option>Otro</option>
        </select>
        <label class="rh-form-label">Notas adicionales</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Detalles...">`,

    rotacion: () => `
        <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Registra bajas o altas de personal esta semana.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Nombre del colaborador</label>
                <input class="rh-form-input" id="rh-f-nombre" type="text" placeholder="Nombre completo"></div>
            <div><label class="rh-form-label">Área</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Tipo de movimiento</label>
                <select class="rh-form-input" id="rh-f-movimiento">
                    <option value="baja">Baja voluntaria</option>
                    <option value="baja-involuntaria">Baja involuntaria</option>
                    <option value="alta">Alta / Nuevo ingreso</option>
                    <option value="cambio">Cambio de área</option>
                </select></div>
            <div><label class="rh-form-label">Fecha del movimiento</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Motivo / observaciones</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Ej: Mejor oferta, fin de contrato...">`,

    vacante: () => `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Puesto / Posición</label>
                <input class="rh-form-input" id="rh-f-puesto" type="text" placeholder="Ej: Técnico en campo"></div>
            <div><label class="rh-form-label">Área solicitante</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Fecha de apertura</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
            <div><label class="rh-form-label">Estatus</label>
                <select class="rh-form-input" id="rh-f-vacEstatus">
                    <option value="nueva">Nueva</option>
                    <option value="abierta">Abierta / En proceso</option>
                    <option value="concretada">Concretada</option>
                </select></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Perfil requerido / notas</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Ej: Experiencia en industria, licencia tipo B...">`,

    acta: () => `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Nombre del colaborador</label>
                <input class="rh-form-input" id="rh-f-nombre" type="text" placeholder="Nombre completo"></div>
            <div><label class="rh-form-label">Área</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Tipo de acta</label>
                <select class="rh-form-input" id="rh-f-tipoActa">
                    <option value="falta">Falta injustificada</option>
                    <option value="retardo">Retardo reincidente</option>
                    <option value="conducta">Conducta inapropiada</option>
                    <option value="incumplimiento">Incumplimiento de normas</option>
                </select></div>
            <div><label class="rh-form-label">Fecha del acta</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Descripción del incidente</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Describe los hechos con detalle...">`,

    capacitacion: () => `
        <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Registra capacitaciones y eventos de formación del equipo.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="grid-column:span 2"><label class="rh-form-label">Nombre de la capacitación</label>
                <input class="rh-form-input" id="rh-f-capNombre" type="text" placeholder="Ej: Manejo de materiales peligrosos, NOM-005..."></div>
            <div><label class="rh-form-label">Quien imparte</label>
                <input class="rh-form-input" id="rh-f-capImpartidor" type="text" placeholder="Nombre del instructor o empresa"></div>
            <div><label class="rh-form-label">Fecha</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
            <div><label class="rh-form-label">Lugar</label>
                <input class="rh-form-input" id="rh-f-capLugar" type="text" placeholder="Ej: Sala de juntas, planta, en línea..."></div>
            <div><label class="rh-form-label">Duración (horas)</label>
                <input class="rh-form-input" id="rh-f-capDuracion" type="number" min="1" placeholder="Ej: 8"></div>
            <div style="grid-column:span 2"><label class="rh-form-label">Asistentes (nombres separados por coma)</label>
                <textarea class="rh-form-input" id="rh-f-capAsistentes" rows="3" placeholder="Ej: Juan Pérez, María López, Carlos García..." style="resize:vertical;"></textarea></div>
        </div>
        <label class="rh-form-label">Notas / observaciones</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Temas cubiertos, material entregado, etc.">`,

    incapacidad: () => `
        <p style="font-size:11px;color:#64748b;margin-bottom:12px;">Registra incapacidades del IMSS u otras.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label class="rh-form-label">Nombre del colaborador</label>
                <input class="rh-form-input" id="rh-f-nombre" type="text" placeholder="Nombre completo"></div>
            <div><label class="rh-form-label">Área</label>${RH_AREA_SEL()}</div>
            <div><label class="rh-form-label">Folio de incapacidad</label>
                <input class="rh-form-input" id="rh-f-incFolio" type="text" placeholder="Ej: 12345678"></div>
            <div><label class="rh-form-label">Ramo de seguro</label>
                <select class="rh-form-input" id="rh-f-incRamo">
                    <option value="enfermedad-general">Enfermedad general</option>
                    <option value="riesgo-trabajo">Riesgo de trabajo</option>
                    <option value="maternidad">Maternidad</option>
                    <option value="invalidez">Invalidez</option>
                </select></div>
            <div><label class="rh-form-label">Tipo de incapacidad</label>
                <select class="rh-form-input" id="rh-f-incTipo">
                    <option value="inicial">Inicial</option>
                    <option value="subsecuente">Subsecuente</option>
                    <option value="alta-medica">Alta médica</option>
                </select></div>
            <div><label class="rh-form-label">Fecha inicio</label>
                <input class="rh-form-input" id="rh-f-fecha" type="date" value="${TODAY}"></div>
            <div><label class="rh-form-label">Días de incapacidad</label>
                <input class="rh-form-input" id="rh-f-incDias" type="number" min="1" placeholder="Ej: 7"></div>
            <div><label class="rh-form-label">Fecha de alta / regreso</label>
                <input class="rh-form-input" id="rh-f-fecha-regreso" type="date"></div>
        </div>
        <label class="rh-form-label" style="margin-top:12px;">Diagnóstico / notas</label>
        <input class="rh-form-input" id="rh-f-notas" type="text" placeholder="Diagnóstico médico o notas adicionales...">`
};

window.abrirModalRH = (tab = 'retardo', editId = null) => {
    // Redirigir al form inline si el dashboard está visible
    const dash = document.getElementById('rh-dashboard');
    if(dash && dash.style.display !== 'none'){
        abrirRHInline(tab, editId);
        return;
    }
    rhTabActual = tab;
    rhEditandoId = editId;
    document.querySelectorAll('.rh-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    document.getElementById('rh-form-container').innerHTML = (RH_FORMS[tab] ? RH_FORMS[tab]() : '');
    const titulo = document.getElementById('rh-modal-title');
    if(titulo) titulo.innerText = editId ? `✏️ Editar registro de ${tab}` : `📝 Registrar indicador RH`;
    document.getElementById('modal-rh').style.display = 'flex';
};

const RH_TITULOS = {
    retardo:'⏰ Registrar Retardo', falta:'📅 Registrar Falta / Permiso',
    descuento:'💰 Registrar Descuento', rotacion:'🔄 Registrar Rotación',
    vacante:'🎯 Registrar Vacante', acta:'📁 Nueva Acta Administrativa',
    capacitacion:'🎓 Registrar Capacitación', incapacidad:'🏥 Registrar Incapacidad'
};

window.abrirRHInline = (tab, editId = null) => {
    rhTabActual = tab;
    rhEditandoId = editId || null;
    // Activar tab correspondiente en el modal también
    document.querySelectorAll('.rh-tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    const formEl = document.getElementById('rh-inline-form');
    const titleEl = document.getElementById('rh-inline-title');
    const contentEl = document.getElementById('rh-inline-content');
    if(!formEl || !contentEl) return;
    titleEl.innerHTML = RH_TITULOS[tab] || '📝 Registrar';
    contentEl.innerHTML = RH_FORMS[tab] ? RH_FORMS[tab]() : '<p style="color:#94a3b8;">Formulario no disponible</p>';
    formEl.style.display = 'block';
    // Scroll suave al form
    setTimeout(()=>formEl.scrollIntoView({behavior:'smooth', block:'start'}), 100);
};

window.cerrarRHInline = () => {
    const formEl = document.getElementById('rh-inline-form');
    if(formEl) formEl.style.display = 'none';
    rhEditandoId = null;
};

window.guardarRHInline = async () => {
    const key = rhKey();
    const btn = document.querySelector('#rh-inline-form button');
    
    const needsNombre = ['retardo','falta','descuento','rotacion','acta','incapacidad'];
    if(needsNombre.includes(rhTabActual) && !rhGet('rh-f-nombre')){
        alert('Escribe el nombre del colaborador'); return;
    }
    if(rhTabActual === 'capacitacion' && !rhGet('rh-f-capNombre')){
        alert('Escribe el nombre de la capacitación'); return;
    }

    if(btn){ btn.textContent='💾 Guardando...'; btn.disabled=true; }

    const hoy = new Date();
    const base = {
        semanaKey: key,
        mesAnio: hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0'),
        fecha: hoy.toISOString().slice(0,10), // fecha por defecto = hoy
        creadoEn: hoy.toISOString(),
        creadoPor: auth.currentUser?.email||'',
        tipo: rhTabActual
    };

    let docData = {...base};
    switch(rhTabActual){
        case 'retardo': docData={...docData, nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'), fecha:rhGet('rh-f-fecha'), hora:rhGet('rh-f-hora'), minutos:Number(rhGet('rh-f-minutos'))||0, notas:rhGet('rh-f-notas')}; break;
        case 'falta': docData={...docData, nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'), fecha:rhGet('rh-f-fecha'), tipoFalta:rhGet('rh-f-tipoFalta')||'injustificada', dias:Number(rhGet('rh-f-dias'))||1, fechaRegreso:rhGet('rh-f-fecha-regreso')||'', notas:rhGet('rh-f-notas')}; break;
        case 'descuento': docData={...docData, nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'), fecha:rhGet('rh-f-fecha'), monto:Number(rhGet('rh-f-monto'))||0, motivoDesc:rhGet('rh-f-motivoDesc')||'Otro', notas:rhGet('rh-f-notas')}; break;
        case 'rotacion': docData={...docData, nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'), fecha:rhGet('rh-f-fecha'), movimiento:rhGet('rh-f-movimiento')||'baja', empresa:(document.getElementById('rh-f-empresa')?.value||''), notas:rhGet('rh-f-notas')}; break;
        case 'vacante': docData={...docData, puesto:rhGet('rh-f-puesto'), area:rhGet('rh-f-area'), fecha:rhGet('rh-f-fecha'), estatus:rhGet('rh-f-vacEstatus')||'nueva', notas:rhGet('rh-f-notas')}; break;
        case 'acta': docData={...docData, nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'), fecha:rhGet('rh-f-fecha'), tipoActa:rhGet('rh-f-tipoActa')||'conducta', notas:rhGet('rh-f-notas')}; break;
        case 'capacitacion': docData={...docData, nombre:rhGet('rh-f-capNombre'), impartidor:rhGet('rh-f-capImpartidor'), fecha:rhGet('rh-f-fecha'), lugar:rhGet('rh-f-capLugar'), duracion:Number(rhGet('rh-f-capDuracion'))||0, asistentes:rhGet('rh-f-capAsistentes'), notas:rhGet('rh-f-notas')}; break;
        case 'incapacidad': docData={...docData, nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'), folio:rhGet('rh-f-incFolio'), ramo:rhGet('rh-f-incRamo')||'enfermedad-general', tipoIncapacidad:rhGet('rh-f-incTipo')||'inicial', fecha:rhGet('rh-f-fecha'), dias:Number(rhGet('rh-f-incDias'))||0, fechaRegreso:rhGet('rh-f-fecha-regreso')||'', notas:rhGet('rh-f-notas')}; break;
    }
    Object.keys(docData).forEach(k=>{if(docData[k]===undefined) delete docData[k];});
    console.log('[RH Inline] Guardando:', docData);

    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const ref = await fs.addDoc(fs.collection(db,'rh_indicadores'), docData);
        console.log('[RH Inline] ✅ ID:', ref.id);
        cerrarRHInline();
        window.mostrarPush('✅ Guardado', rhTabActual+' registrado correctamente','👥');
        cargarDatosRH();
    } catch(e){
        console.error('[RH Inline] Error:', e);
        alert('Error al guardar: '+e.message);
    } finally {
        if(btn){ btn.textContent='💾 GUARDAR REGISTRO'; btn.disabled=false; }
    }
};

window.rhTabSwitch = (tab, btn) => {
    rhTabActual = tab;
    rhEditandoId = null;
    document.querySelectorAll('.rh-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('rh-form-container').innerHTML = (RH_FORMS[tab] ? RH_FORMS[tab]() : '');
};

const rhGet = id => {
    if(id === 'rh-f-area'){
        // Primero intentar el SELECT principal (rh-f-area-sel)
        const sel = document.getElementById('rh-f-area-sel');
        if(sel){
            if(sel.value && sel.value !== '__otra__') return sel.value;
            // Si es "otra", tomar el input de texto libre
            const inputLibre = document.getElementById('rh-f-area');
            if(inputLibre && inputLibre.value.trim()) return inputLibre.value.trim();
            return sel.options[0]?.value || 'General';
        }
        // Fallback: input directo
        const el = document.getElementById('rh-f-area');
        return el ? el.value.trim() : 'General';
    }
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
};

window.guardarDatoRH = async () => {
    const key = rhKey();
    const btn = document.querySelector('#modal-rh .rh-add-btn');

    // Validar campos requeridos
    const needsNombre = ['retardo','falta','descuento','rotacion','acta','incapacidad'];
    if(needsNombre.includes(rhTabActual) && !rhGet('rh-f-nombre')){
        alert('Escribe el nombre del colaborador'); return;
    }
    if(rhTabActual === 'capacitacion' && !rhGet('rh-f-capNombre')){
        alert('Escribe el nombre de la capacitación'); return;
    }

    if(btn){ btn.textContent = 'Guardando...'; btn.disabled = true; }

    const base = {
        semanaKey: key,
        mesAnio: new Date().getFullYear() + '-' + String(new Date().getMonth()+1).padStart(2,'0'),
        creadoEn: new Date().toISOString(),
        creadoPor: auth.currentUser?.email || '',
        tipo: rhTabActual
    };

    let docData = { ...base };

    switch(rhTabActual){
        case 'retardo':
            docData = {...docData,
                nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'),
                fecha:rhGet('rh-f-fecha'), hora:rhGet('rh-f-hora'),
                minutos:Number(rhGet('rh-f-minutos'))||0,
                notas:rhGet('rh-f-notas')};
            break;
        case 'falta':
            docData = {...docData,
                nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'),
                fecha:rhGet('rh-f-fecha'),
                tipoFalta:rhGet('rh-f-tipoFalta')||'injustificada',
                dias:Number(rhGet('rh-f-dias'))||1,
                fechaRegreso:rhGet('rh-f-fecha-regreso')||'',
                notas:rhGet('rh-f-notas')};
            break;
        case 'descuento':
            docData = {...docData,
                nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'),
                fecha:rhGet('rh-f-fecha'),
                monto:Number(rhGet('rh-f-monto'))||0,
                motivoDesc:rhGet('rh-f-motivoDesc')||'Otro',
                notas:rhGet('rh-f-notas')};
            break;
        case 'rotacion':
            docData = {...docData,
                nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'),
                fecha:rhGet('rh-f-fecha'),
                movimiento:rhGet('rh-f-movimiento')||'baja',
            empresa:(document.getElementById('rh-f-empresa')?.value||''),
            notas:rhGet('rh-f-notas')};
            break;
        case 'vacante':
            docData = {...docData,
                puesto:rhGet('rh-f-puesto'), area:rhGet('rh-f-area'),
                fecha:rhGet('rh-f-fecha'),
                estatus:rhGet('rh-f-vacEstatus')||'nueva',
                notas:rhGet('rh-f-notas')};
            break;
        case 'acta':
            docData = {...docData,
                nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'),
                fecha:rhGet('rh-f-fecha'),
                tipoActa:rhGet('rh-f-tipoActa')||'conducta',
                notas:rhGet('rh-f-notas')};
            break;
        case 'capacitacion':
            docData = {...docData,
                nombre:rhGet('rh-f-capNombre'),
                impartidor:rhGet('rh-f-capImpartidor'),
                fecha:rhGet('rh-f-fecha'),
                lugar:rhGet('rh-f-capLugar'),
                duracion:Number(rhGet('rh-f-capDuracion'))||0,
                asistentes:rhGet('rh-f-capAsistentes'),
                notas:rhGet('rh-f-notas')};
            break;
        case 'incapacidad':
            docData = {...docData,
                nombre:rhGet('rh-f-nombre'), area:rhGet('rh-f-area'),
                folio:rhGet('rh-f-incFolio'),
                ramo:rhGet('rh-f-incRamo')||'enfermedad-general',
                tipoIncapacidad:rhGet('rh-f-incTipo')||'inicial',
                fecha:rhGet('rh-f-fecha'),
                dias:Number(rhGet('rh-f-incDias'))||0,
                fechaRegreso:rhGet('rh-f-fecha-regreso')||'',
                notas:rhGet('rh-f-notas')};
            break;
        default:
            console.warn('[RH] Tipo no reconocido:', rhTabActual);
    }

    // Limpiar campos vacíos
    Object.keys(docData).forEach(k => { if(docData[k] === undefined) delete docData[k]; });
    console.log('[RH] Guardando tipo:', rhTabActual, 'key:', key);

    try {
        // Reimportar Firestore para asegurar disponibilidad
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        if(rhEditandoId){
            await fs.updateDoc(fs.doc(db,'rh_indicadores', rhEditandoId), docData);
            rhEditandoId = null;
        } else {
            const ref = await fs.addDoc(fs.collection(db,'rh_indicadores'), docData);
            console.log('[RH] ✅ Guardado ID:', ref.id, 'tipo:', rhTabActual);
        }
        document.getElementById('modal-rh').style.display = 'none';
        window.mostrarPush('✅ Guardado', rhTabActual + ' registrado', '👥');
        cargarDatosRH();
    } catch(e) {
        console.error('[RH error]', e.code, e.message);
        alert('Error al guardar: ' + e.message);
    } finally {
        if(btn){ btn.textContent = 'GUARDAR'; btn.disabled = false; }
    }
};

window.eliminarRH = async (id) => {
    if(!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
    try {
        await deleteDoc(doc(db,'rh_indicadores', id));
        window.mostrarPush('🗑 Eliminado', 'Registro eliminado correctamente', '👥');
        cargarDatosRH();
    } catch(e) {
        alert('Error al eliminar: ' + e.message);
    }
};

document.getElementById('modal-rh').addEventListener('click', e => {
    if(e.target === document.getElementById('modal-rh')) document.getElementById('modal-rh').style.display = 'none';
});

// ══════════════════════════════════════════════════════════════


// Exponer función principal globalmente
window.toggleRHDash = function(area, email) {
    _toggleRHDash(area, email);
};

// ══════════════════════════════════════════════════════════════
// MÓDULO RH 360° — Directorio, Perfiles, Organigrama
// Colección Firestore: rh_empleados
// ══════════════════════════════════════════════════════════════

// ── Estado global del módulo ──
let rh360Empleados = [];        // todos los colaboradores cargados
let rh360Vista = 'directorio';  // vista activa: directorio | organigrama | alertas
let rh360EmpleadoAct = null;    // colaborador abierto en modal
let rh360TabModal = 'info';     // tab activo dentro del modal

// ── Campos de documentos con alertas ──
const RH360_DOCS = [
    {key:'ine',        label:'INE'},
    {key:'licencia',   label:'Licencia'},
    {key:'curp',       label:'CURP'},
    {key:'rfc',        label:'RFC'},
    {key:'constFiscal',label:'Const. Fiscal'},
    {key:'compDom',    label:'Comp. Domicilio'},
    {key:'contrato',   label:'Contrato'},
    {key:'imss',       label:'IMSS'},
    {key:'examMed',    label:'Examen Médico'},
    {key:'verificacion',label:'Verificación'},
];

// ── URL del Google Sheet publicado como CSV ──
const RH360_SHEET_CSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTSL761esTwMxJgMnSkV4AAxidLzLL6B-fIaeM9xkR02BeBrYifAvvVt8Dnk4mFpQ/pub?output=csv';

// ── Inicializar módulo RH 360° ──
window.initRH360 = async function(){
    const root = document.getElementById('rh360-root');
    if(!root) return;
    root.style.display = 'block';
    root.innerHTML = rh360NavHTML() + '<div id="rh360-contenido"><div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">Cargando directorio…</div></div>' + rh360ModalHTML();
    await rh360CargarEmpleados();
    rh360SetVista('directorio');
    document.getElementById('rh360-modal').addEventListener('click', e=>{
        if(e.target===document.getElementById('rh360-modal')) rh360CerrarModal();
    });
};

// ── Cargar empleados: primero Firestore, luego Sheet como fallback ──
async function rh360CargarEmpleados(){
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const snap = await fs.getDocs(fs.collection(db,'rh_empleados'));
        if(!snap.empty){
            const todos = snap.docs.map(d=>({id:d.id,...d.data()}));
            // Deduplicar en memoria por nombre+puesto
            const vistos = new Set();
            rh360Empleados = todos.filter(e=>{
                const key = (e.nombre||'').trim().toUpperCase()+'__'+(e.puesto||e.cargo||'').trim().toUpperCase();
                if(!e.nombre||e.nombre.trim().length<2) return false;
                if(vistos.has(key)) return false;
                vistos.add(key);
                return true;
            });
            console.log('[RH360] Firestore: '+todos.length+' docs → '+rh360Empleados.length+' únicos');
            // Si hay muchos duplicados (más del doble), limpiar Firestore automáticamente
            if(todos.length > rh360Empleados.length * 1.5){
                console.warn('[RH360] Detectados '+todos.length+' duplicados — limpiando...');
                rh360LimpiarDuplicados(todos, fs);
            }
            return;
        }
    } catch(e){ console.warn('[RH360] Firestore no disponible:', e.message); }

    // Firestore vacío → leer Sheet CSV
    try {
        const r = await fetch(RH360_SHEET_CSV);
        const csv = await r.text();
        const parsed = rh360ParseCSV(csv);
        console.log('[RH360] Sheet: '+parsed.length+' colaboradores');
        rh360Empleados = parsed;
        if(parsed.length > 0) rh360SincronizarSheet(parsed);
    } catch(e){
        console.error('[RH360] Error cargando Sheet:', e.message);
        rh360Empleados = [];
    }
}

// ── Limpiar duplicados en Firestore: conservar uno por nombre+puesto ──
async function rh360LimpiarDuplicados(todos, fs){
    try {
        const vistos = new Set();
        const borrar = [];
        // Ordenar por creadoEn para conservar el más reciente
        const ord = [...todos].sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
        ord.forEach(e=>{
            const key = (e.nombre||'').trim().toUpperCase()+'__'+(e.puesto||'').trim().toUpperCase();
            if(!e.nombre||e.nombre.trim().length<2){borrar.push(e.id);return;}
            if(vistos.has(key)){borrar.push(e.id);}
            else vistos.add(key);
        });
        console.log('[RH360] Borrando '+borrar.length+' duplicados de Firestore...');
        // Borrar en lotes de 20 para no saturar
        for(let i=0;i<borrar.length;i+=20){
            const lote=borrar.slice(i,i+20);
            await Promise.all(lote.map(id=>fs.deleteDoc(fs.doc(db,'rh_empleados',id)).catch(()=>{})));
        }
        console.log('[RH360] Limpieza completada');
    } catch(e){ console.warn('[RH360] Error limpiando duplicados:', e.message); }
}

// ── Parsear CSV del Sheet ──
// Detecta automáticamente las columnas reales del Sheet
function rh360ParseCSV(csv){
    const rawLines = csv.split('\n');
    // Encontrar la primera fila que parezca un header real (tiene varias celdas no vacías)
    let headerIdx = 0;
    for(let i=0;i<Math.min(5,rawLines.length);i++){
        const cells = rawLines[i].split(',').filter(c=>c.trim().length>0);
        if(cells.length >= 3){headerIdx=i;break;}
    }
    const lines = rawLines.slice(headerIdx).filter(l=>l.trim());
    if(lines.length < 2) return [];

    // Parsear una línea CSV respetando comillas
    function parseLine(line){
        const vals=[];let cur='',inQ=false;
        for(const ch of line){
            if(ch==='"'){inQ=!inQ;}
            else if(ch===','&&!inQ){vals.push(cur.replace(/\r/g,'').trim());cur='';}
            else cur+=ch;
        }
        vals.push(cur.replace(/\r/g,'').trim());
        return vals;
    }

    // Normalizar nombre de columna
    function normCol(h){
        return h.toLowerCase()
            .replace(/\s+/g,'_')
            .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e')
            .replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u')
            .replace(/[ñ]/g,'n').replace(/[^a-z0-9_]/g,'').replace(/_+/g,'_').replace(/^_|_$/g,'');
    }

    const rawHeaders = parseLine(lines[0]);
    const headers = rawHeaders.map(normCol);
    console.log('[RH360] Columnas detectadas:', headers.join(' | '));

    // Mapa de columnas conocidas a campos internos
    const MAPA = {
        // Nombre
        nombre:['nombre','nombre_completo','colaborador','empleado','trabajador','nombre_trabajador'],
        puesto:['puesto','cargo','posicion','puesto_cargo','descripcion_puesto'],
        departamento:['departamento','depto','area','departamento_area','unidad'],
        plaza:['plaza','sucursal','ubicacion','sede','ciudad'],
        fecha_ingreso:['fecha_ingreso','fecha_alta','ingreso','fecha_de_ingreso','alta','f_ingreso'],
        estatus:['estatus','status','situacion','estado'],
        num_empleado:['num_empleado','numero_empleado','no_empleado','id_empleado','clave','folio'],
        curp:['curp'],
        rfc:['rfc'],
        nss:['nss','imss','seguro_social'],
        email:['email','correo','correo_electronico','correo_corporativo','mail'],
        telefono:['telefono','tel','celular','phone'],
        jefe:['jefe','jefe_directo','responsable','supervisor','gerente'],
        tipo_contrato:['tipo_contrato','contrato','tipo_de_contrato'],
        fecha_nacimiento:['fecha_nacimiento','nacimiento','f_nacimiento'],
    };

    // Construir mapa de índice real por campo interno
    const colIdx = {};
    Object.entries(MAPA).forEach(([campo,alternativas])=>{
        const idx = headers.findIndex(h=>alternativas.includes(h));
        if(idx>=0) colIdx[campo]=idx;
    });
    console.log('[RH360] Campos mapeados:', Object.keys(colIdx).join(', '));

    const result = [];
    const nombresSeen = new Set();

    lines.slice(1).forEach((line,i)=>{
        const vals = parseLine(line);
        if(vals.every(v=>!v)) return; // fila vacía

        const obj={id:'sheet_'+i};
        // Asignar por mapa de campos
        Object.entries(colIdx).forEach(([campo,idx])=>{
            obj[campo] = vals[idx]||'';
        });
        // Fallback: asignar todas las columnas también (por si alguna coincide)
        headers.forEach((h,j)=>{ if(h&&!obj[h]) obj[h]=vals[j]||''; });

        if(!obj.estatus) obj.estatus='activo';

        // Filtrar filas sin nombre o con nombre muy corto
        const nombre=(obj.nombre||'').trim();
        if(nombre.length<2) return;

        // Deduplicar por nombre
        const key=nombre.toUpperCase();
        if(nombresSeen.has(key)) return;
        nombresSeen.add(key);

        result.push(obj);
    });

    return result;
}

// ── Sincronizar Sheet → Firestore (solo si Firestore está vacío) ──
async function rh360SincronizarSheet(empleados){
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        // Verificar de nuevo que Firestore esté vacío antes de escribir
        const check = await fs.getDocs(fs.query(fs.collection(db,'rh_empleados'),fs.limit(1)));
        if(!check.empty){
            console.log('[RH360] Firestore ya tiene datos — no sincronizar');
            return;
        }
        // Escribir en lotes de 400 (límite Firestore es 500)
        const BATCH_SIZE=400;
        for(let i=0;i<empleados.length;i+=BATCH_SIZE){
            const lote=empleados.slice(i,i+BATCH_SIZE);
            const batch=fs.writeBatch(db);
            lote.forEach(emp=>{
                const ref=fs.doc(fs.collection(db,'rh_empleados'));
                const {id,...data}=emp;
                batch.set(ref,{...data,importadoSheet:true,creadoEn:new Date().toISOString()});
            });
            await batch.commit();
        }
        console.log('[RH360] '+empleados.length+' colaboradores sincronizados a Firestore');
    } catch(e){ console.warn('[RH360] No se pudo sincronizar Sheet:', e.message); }
}

// ── HTML de navegación ──
function rh360NavHTML(){
    return '<div class="rh360-nav" id="rh360-nav">'+
        '<button class="rh360-nav-btn on" id="rh360-btn-directorio" onclick="rh360SetVista(\'directorio\')">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>'+
            'Directorio</button>'+
        '<button class="rh360-nav-btn" id="rh360-btn-organigrama" onclick="rh360SetVista(\'organigrama\')">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="1" y="18" width="6" height="4" rx="1"/><rect x="9" y="18" width="6" height="4" rx="1"/><rect x="17" y="18" width="6" height="4" rx="1"/><path d="M4 22v-4M12 22v-4M20 22v-4M12 6v12M4 18V14h16v4"/></svg>'+
            'Organigrama</button>'+
        '<button class="rh360-nav-btn" id="rh360-btn-alertas" onclick="rh360SetVista(\'alertas\')">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>'+
            'Alertas</button>'+
        '<button class="rh360-nav-btn" style="margin-left:auto;background:#F0FDF4;color:#15803D;border-color:#BBF7D0" onclick="rh360AbrirAgregarEmp()">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'+
            'Agregar colaborador</button>'+
    '</div>';
}

// ── Cambiar vista activa ──
window.rh360SetVista = function(v){
    rh360Vista = v;
    ['directorio','organigrama','alertas'].forEach(k=>{
        const btn = document.getElementById('rh360-btn-'+k);
        if(btn) btn.classList.toggle('on', k===v);
    });
    const cont = document.getElementById('rh360-contenido');
    if(!cont) return;
    if(v==='directorio') cont.innerHTML = rh360HTMLDirectorio();
    else if(v==='organigrama') cont.innerHTML = rh360HTMLOrganigrama();
    else if(v==='alertas') cont.innerHTML = rh360HTMLAlertas();
};

// ── DIRECTORIO ──
function rh360HTMLDirectorio(){
    const deptos = [...new Set(rh360Empleados.map(e=>e.departamento||e.area||'—').filter(Boolean))].sort();
    const plazas = [...new Set(rh360Empleados.map(e=>e.plaza||e.sucursal||'—').filter(Boolean))].sort();
    return '<div class="rh360-search-bar">'+
        '<input class="rh360-search" id="rh360-buscar" placeholder="Buscar colaborador, puesto..." oninput="rh360Filtrar()">'+
        '<select class="rh360-filter" id="rh360-f-depto" onchange="rh360Filtrar()">'+
            '<option value="">Todos los departamentos</option>'+
            deptos.map(d=>'<option>'+d+'</option>').join('')+
        '</select>'+
        '<select class="rh360-filter" id="rh360-f-plaza" onchange="rh360Filtrar()">'+
            '<option value="">Todas las plazas</option>'+
            plazas.map(p=>'<option>'+p+'</option>').join('')+
        '</select>'+
        '<select class="rh360-filter" id="rh360-f-estatus" onchange="rh360Filtrar()">'+
            '<option value="">Todos los estatus</option>'+
            '<option value="activo">Activos</option>'+
            '<option value="baja">Bajas</option>'+
        '</select>'+
        '<div style="font-size:11px;color:#94A3B8;white-space:nowrap" id="rh360-total">'+rh360Empleados.length+' colaboradores</div>'+
    '</div>'+
    '<div class="rh360-grid" id="rh360-cards">'+rh360CardsHTML(rh360Empleados)+'</div>';
}

window.rh360Filtrar = function(){
    const q = (document.getElementById('rh360-buscar')?.value||'').toLowerCase();
    const depto = document.getElementById('rh360-f-depto')?.value||'';
    const plaza = document.getElementById('rh360-f-plaza')?.value||'';
    const estatus = document.getElementById('rh360-f-estatus')?.value||'';
    const filtrados = rh360Empleados.filter(e=>{
        const nombre = (e.nombre||'').toLowerCase();
        const puesto = (e.puesto||'').toLowerCase();
        const matchQ = !q || nombre.includes(q) || puesto.includes(q);
        const matchD = !depto || (e.departamento||e.area||'').includes(depto);
        const matchP = !plaza || (e.plaza||e.sucursal||'').includes(plaza);
        const matchE = !estatus || (e.estatus||'activo').toLowerCase()===estatus;
        return matchQ && matchD && matchP && matchE;
    });
    const cards = document.getElementById('rh360-cards');
    const total = document.getElementById('rh360-total');
    if(cards) cards.innerHTML = rh360CardsHTML(filtrados);
    if(total) total.textContent = filtrados.length+' colaborador(es)';
};

function rh360CardsHTML(lista){
    if(!lista.length) return '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94A3B8">No se encontraron colaboradores</div>';
    return lista.map(e=>{
        const ini = e.fecha_ingreso||e.ingreso||'';
        const antig = ini ? rh360Antiguedad(ini) : '—';
        const baja = (e.estatus||'activo').toLowerCase()==='baja';
        const iniciales = (e.nombre||'?').split(' ').slice(0,2).map(p=>p[0]||'').join('').toUpperCase();
        const semaforo = RH360_DOCS.map(d=>{
            const val = e['doc_'+d.key]||e[d.key]||'';
            const color = rh360ColorDoc(val);
            return '<div class="rh360-doc-dot '+color+'" title="'+d.label+': '+(val||'Sin info')+'"></div>';
        }).join('');
        // Vehículo asignado desde flotilla
        const veh = (typeof flV !== 'undefined') ? flV.find(v=>(v.responsable||'').toUpperCase().includes((e.nombre||'').split(' ')[0].toUpperCase())) : null;
        return '<div class="rh360-card" onclick="rh360AbrirPerfil(\''+e.id+'\')">'+
            '<div class="rh360-card-head">'+
                '<div class="rh360-avatar">'+(e.foto?'<img src="'+e.foto+'" alt="'+e.nombre+'">':iniciales)+'</div>'+
                '<div>'+
                    '<div class="rh360-name">'+rh360Escape(e.nombre||'Sin nombre')+'</div>'+
                    '<div class="rh360-puesto">'+rh360Escape(e.puesto||e.cargo||'—')+'</div>'+
                '</div>'+
            '</div>'+
            '<div class="rh360-card-pills">'+
                '<span class="rh360-pill depto">'+rh360Escape(e.departamento||e.area||'—')+'</span>'+
                '<span class="rh360-pill plaza">'+rh360Escape(e.plaza||e.sucursal||'—')+'</span>'+
                (baja?'<span class="rh360-pill baja">BAJA</span>':'')+
                (veh?'<span class="rh360-pill" style="background:#FEF3C7;color:#B45309">ECO '+veh.eco+'</span>':'')+
            '</div>'+
            '<div class="rh360-card-stats">'+
                '<div class="rh360-stat-item"><div class="rh360-stat-val">'+antig+'</div><div class="rh360-stat-lbl">Antigüedad</div></div>'+
                '<div class="rh360-stat-item"><div class="rh360-stat-val">'+(e.nss||'—')+'</div><div class="rh360-stat-lbl">NSS</div></div>'+
                '<div class="rh360-stat-item"><div class="rh360-stat-val">'+(e.num_empleado||e.numero_empleado||'—')+'</div><div class="rh360-stat-lbl"># Emp.</div></div>'+
            '</div>'+
            '<div class="rh360-semaforo" style="margin-top:8px">'+semaforo+'</div>'+
        '</div>';
    }).join('');
}

// ── PERFIL 360° ──
window.rh360AbrirPerfil = function(id){
    const e = rh360Empleados.find(x=>x.id===id);
    if(!e) return;
    rh360EmpleadoAct = e;
    rh360TabModal = 'info';
    const modal = document.getElementById('rh360-modal');
    if(!modal) return;
    modal.classList.add('show');
    rh360RenderModal(e);
};

window.rh360CerrarModal = function(){
    document.getElementById('rh360-modal')?.classList.remove('show');
    rh360EmpleadoAct = null;
};

function rh360RenderModal(e){
    const box = document.getElementById('rh360-modal-box');
    if(!box) return;
    const iniciales = (e.nombre||'?').split(' ').slice(0,2).map(p=>p[0]||'').join('').toUpperCase();
    const ini = e.fecha_ingreso||e.ingreso||'';
    const antig = ini ? rh360Antiguedad(ini) : '—';
    const tabs = [
        {key:'info',   label:'Información'},
        {key:'docs',   label:'Documentos'},
        {key:'veh',    label:'Vehículo'},
        {key:'hist',   label:'Historial'},
        {key:'edit',   label:'Editar'},
    ];
    box.innerHTML =
        '<div class="rh360-modal-hero">'+
            '<div class="rh360-modal-avatar">'+(e.foto?'<img src="'+e.foto+'" style="width:72px;height:72px;border-radius:50%;object-fit:cover">':iniciales)+'</div>'+
            '<div style="flex:1;min-width:0">'+
                '<div class="rh360-modal-name">'+rh360Escape(e.nombre||'—')+'</div>'+
                '<div class="rh360-modal-sub">'+rh360Escape(e.puesto||e.cargo||'—')+' · '+rh360Escape(e.departamento||e.area||'—')+'</div>'+
                '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">'+
                    '<span style="font-size:10px;font-weight:700;background:rgba(255,255,255,.15);padding:3px 10px;border-radius:99px;color:#fff">'+rh360Escape(e.plaza||e.sucursal||'—')+'</span>'+
                    '<span style="font-size:10px;font-weight:700;background:rgba(255,255,255,.15);padding:3px 10px;border-radius:99px;color:#fff">'+antig+'</span>'+
                    ((e.estatus||'activo').toLowerCase()==='baja'?'<span style="font-size:10px;font-weight:700;background:#DC2626;padding:3px 10px;border-radius:99px;color:#fff">BAJA</span>':'')+
                '</div>'+
            '</div>'+
            '<button onclick="rh360CerrarModal()" style="background:rgba(255,255,255,.1);border:none;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;flex-shrink:0">✕</button>'+
        '</div>'+
        '<div class="rh360-modal-tabs">'+
            tabs.map(t=>'<div class="rh360-modal-tab'+(t.key===rh360TabModal?' on':'')+'" onclick="rh360TabSwitch(\''+t.key+'\')">'+t.label+'</div>').join('')+
        '</div>'+
        '<div class="rh360-modal-body" id="rh360-modal-body">'+rh360TabContent(e,rh360TabModal)+'</div>';
}

window.rh360TabSwitch = function(tab){
    rh360TabModal = tab;
    const tabs = document.querySelectorAll('.rh360-modal-tab');
    tabs.forEach(t=>t.classList.toggle('on', t.onclick?.toString().includes("'"+tab+"'")));
    // Refrescar tabs activos visualmente
    document.querySelectorAll('.rh360-modal-tab').forEach(t=>{
        t.classList.remove('on');
        if(t.getAttribute('onclick')&&t.getAttribute('onclick').includes("'"+tab+"'")) t.classList.add('on');
    });
    const body = document.getElementById('rh360-modal-body');
    if(body && rh360EmpleadoAct) body.innerHTML = rh360TabContent(rh360EmpleadoAct, tab);
};

function rh360TabContent(e, tab){
    if(tab==='info') return rh360TabInfo(e);
    if(tab==='docs') return rh360TabDocs(e);
    if(tab==='veh')  return rh360TabVeh(e);
    if(tab==='hist') return rh360TabHist(e);
    if(tab==='edit') return rh360TabEdit(e);
    return '';
}

// ── Tab: Información general ──
function rh360TabInfo(e){
    const campos = [
        ['Nombre completo', e.nombre],
        ['# Empleado', e.num_empleado||e.numero_empleado],
        ['Puesto / Cargo', e.puesto||e.cargo],
        ['Departamento', e.departamento||e.area],
        ['Plaza / Sucursal', e.plaza||e.sucursal],
        ['Jefe directo', e.jefe||e.responsable||e.jefe_directo],
        ['Fecha ingreso', e.fecha_ingreso||e.ingreso],
        ['Estatus', e.estatus||'activo'],
        ['CURP', e.curp],
        ['RFC', e.rfc],
        ['NSS', e.nss],
        ['Fecha nacimiento', e.fecha_nacimiento||e.nacimiento],
        ['Tipo de sangre', e.tipo_sangre||e.sangre],
        ['Estado civil', e.estado_civil],
        ['Tipo de contrato', e.tipo_contrato||e.contrato],
    ];
    const contacto = [
        ['Correo corporativo', e.email||e.correo||e.correo_corporativo],
        ['Correo personal', e.correo_personal],
        ['Teléfono', e.telefono||e.tel],
        ['Teléfono alterno', e.telefono_alterno||e.tel2],
        ['Dirección', e.direccion||e.domicilio],
        ['Contacto emergencia', e.contacto_emergencia],
        ['Tel. emergencia', e.tel_emergencia],
    ];
    const rFld = (label,val) => '<div class="rh360-field"><div class="rh360-field-lbl">'+label+'</div><div class="rh360-field-val">'+rh360Escape(val||'—')+'</div></div>';
    return '<div class="rh360-section"><div class="rh360-section-title">Datos personales y laborales</div>'+
        '<div class="rh360-grid2">'+campos.map(([l,v])=>rFld(l,v)).join('')+'</div></div>'+
        '<div class="rh360-section"><div class="rh360-section-title">Contacto</div>'+
        '<div class="rh360-grid2">'+contacto.map(([l,v])=>rFld(l,v)).join('')+'</div></div>';
}

// ── Tab: Documentos con semáforo ──
function rh360TabDocs(e){
    const semaforo = {verde:'Vigente',amarillo:'Próximo a vencer',rojo:'Vencido',gris:'Sin información'};
    const colores = {verde:'#15803D',amarillo:'#D97706',rojo:'#DC2626',gris:'#94A3B8'};
    const iconos = {verde:'✓',amarillo:'!',rojo:'✗',gris:'—'};
    const rows = RH360_DOCS.map(d=>{
        const val = e['doc_'+d.key]||e[d.key]||'';
        const color = rh360ColorDoc(val);
        const venc = e['venc_'+d.key]||e[d.key+'_vencimiento']||val;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;border-radius:8px;border:1px solid #F1F5F9;margin-bottom:6px;background:#fff">'+
            '<div style="display:flex;align-items:center;gap:10px">'+
                '<div style="width:28px;height:28px;border-radius:50%;background:'+colores[color]+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800">'+iconos[color]+'</div>'+
                '<div>'+
                    '<div style="font-size:12px;font-weight:700">'+d.label+'</div>'+
                    '<div style="font-size:10px;color:#94A3B8">'+semaforo[color]+(venc&&color!=='gris'?' · '+venc:'')+'</div>'+
                '</div>'+
            '</div>'+
            '<button onclick="rh360EditarDoc(\''+e.id+'\',\''+d.key+'\')" style="font-size:10px;font-weight:700;padding:4px 10px;border:1px solid #E2E8F0;border-radius:6px;background:#fff;cursor:pointer;color:#64748B">Actualizar</button>'+
        '</div>';
    }).join('');
    return '<div class="rh360-section"><div class="rh360-section-title">Estado documental</div>'+rows+'</div>';
}

// ── Tab: Vehículo asignado ──
function rh360TabVeh(e){
    const veh = (typeof flV !== 'undefined')
        ? flV.find(v=>(v.responsable||'').toUpperCase().includes((e.nombre||'').split(' ')[0].toUpperCase()))||
          flV.find(v=>String(v.eco)===(e.eco_vehiculo||e.vehiculo_eco||''))
        : null;
    if(!veh) return '<div style="text-align:center;padding:32px;color:#94A3B8">'+
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5" style="margin:0 auto 10px;display:block"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11a2 2 0 012 2v6h-2"/><path d="M7 9l2-4h6l2 4"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'+
        '<div style="font-size:13px;font-weight:700">Sin vehículo asignado</div>'+
        '<div style="font-size:11px;margin-top:4px">El responsable en Flotilla no coincide con este colaborador</div>'+
    '</div>';
    const campos = [
        ['ECO', veh.eco],['Unidad', veh.unidad],['Año', veh.año],
        ['Placas', veh.placas],['Plaza', veh.plaza],['Color', veh.color],
        ['Tipo', veh.tipo],['Serie / VIN', veh.serie],['KM actual', veh.km||'0'],
        ['Rendimiento', veh.rend],['Póliza seguro', veh.pol],['Vence póliza', veh.pv],
        ['NIP gasolina', veh.nip],['Estatus', veh.status||'activo'],
    ];
    return '<div class="rh360-section"><div class="rh360-section-title">Vehículo asignado en Flotilla</div>'+
        '<div class="rh360-grid2">'+campos.map(([l,v])=>
            '<div class="rh360-field"><div class="rh360-field-lbl">'+l+'</div><div class="rh360-field-val">'+rh360Escape(String(v||'—'))+'</div></div>'
        ).join('')+'</div></div>';
}

// ── Tab: Historial / Timeline ──
function rh360TabHist(e){
    const eventos = e.historial || [];
    // Si no hay historial manual, construir uno desde los datos básicos
    const autoEvents = [];
    if(e.fecha_ingreso||e.ingreso) autoEvents.push({fecha:e.fecha_ingreso||e.ingreso,texto:'Ingreso a Tecnocontrol — '+rh360Escape(e.puesto||e.cargo||'')});
    eventos.forEach(ev=>autoEvents.push(ev));
    autoEvents.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
    if(!autoEvents.length) return '<div style="text-align:center;padding:24px;color:#94A3B8;font-size:12px">Sin historial registrado</div>';
    const items = autoEvents.map(ev=>'<div class="rh360-tl-item">'+
        '<div class="rh360-tl-dot"></div>'+
        '<div class="rh360-tl-date">'+rh360Escape(ev.fecha||'—')+'</div>'+
        '<div class="rh360-tl-text">'+rh360Escape(ev.texto||ev.descripcion||ev.movimiento||'—')+'</div>'+
    '</div>').join('');
    return '<div class="rh360-section"><div class="rh360-section-title">Línea de tiempo laboral</div>'+
        '<div class="rh360-timeline">'+items+'</div>'+
        '<button onclick="rh360AgregarHistorial(\''+e.id+'\')" style="margin-top:12px;padding:8px 16px;border:1.5px solid #E2E8F0;border-radius:8px;background:#fff;font-size:11px;font-weight:700;cursor:pointer;color:#64748B">+ Agregar evento</button>'+
    '</div>';
}

// ── Tab: Editar colaborador ──
function rh360TabEdit(e){
    const campos = [
        {key:'nombre',label:'Nombre completo',type:'text'},
        {key:'puesto',label:'Puesto / Cargo',type:'text'},
        {key:'departamento',label:'Departamento',type:'text'},
        {key:'plaza',label:'Plaza / Sucursal',type:'text'},
        {key:'jefe',label:'Jefe directo',type:'text'},
        {key:'fecha_ingreso',label:'Fecha ingreso',type:'date'},
        {key:'estatus',label:'Estatus',type:'select',opts:['activo','baja','licencia','suspendido']},
        {key:'email',label:'Correo corporativo',type:'email'},
        {key:'telefono',label:'Teléfono',type:'tel'},
        {key:'curp',label:'CURP',type:'text'},
        {key:'rfc',label:'RFC',type:'text'},
        {key:'nss',label:'NSS',type:'text'},
        {key:'num_empleado',label:'# Empleado',type:'text'},
        {key:'tipo_contrato',label:'Tipo de contrato',type:'text'},
        {key:'tipo_sangre',label:'Tipo de sangre',type:'text'},
        {key:'estado_civil',label:'Estado civil',type:'text'},
    ];
    const inputs = campos.map(c=>{
        if(c.type==='select'){
            return '<div><label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">'+c.label+'</label>'+
                '<select class="rh-form-input" id="rh360-edit-'+c.key+'">'+
                c.opts.map(o=>'<option value="'+o+'"'+(e[c.key]===o?' selected':'')+'>'+o+'</option>').join('')+
                '</select></div>';
        }
        return '<div><label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">'+c.label+'</label>'+
            '<input type="'+c.type+'" class="rh-form-input" id="rh360-edit-'+c.key+'" value="'+rh360Escape(e[c.key]||'')+'"></div>';
    }).join('');
    return '<div class="rh360-section">'+
        '<div class="rh360-grid2">'+inputs+'</div>'+
        '<div style="margin-top:16px;display:flex;gap:8px">'+
            '<button onclick="rh360Guardar(\''+e.id+'\')" style="padding:10px 20px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Guardar cambios</button>'+
            '<button onclick="rh360TabSwitch(\'info\')" style="padding:10px 20px;background:#F1F5F9;color:#475569;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>'+
        '</div>'+
    '</div>';
}

// ── Guardar edición de colaborador ──
window.rh360Guardar = async function(id){
    const campos = ['nombre','puesto','departamento','plaza','jefe','fecha_ingreso','estatus','email','telefono','curp','rfc','nss','num_empleado','tipo_contrato','tipo_sangre','estado_civil'];
    const data = {};
    campos.forEach(k=>{
        const el = document.getElementById('rh360-edit-'+k);
        if(el) data[k]=el.value.trim();
    });
    data.actualizadoEn = new Date().toISOString();
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        if(id.startsWith('sheet_')){
            // Crear nuevo doc en Firestore
            const ref = await fs.addDoc(fs.collection(db,'rh_empleados'),{...data});
            // Actualizar en memoria
            const idx = rh360Empleados.findIndex(e=>e.id===id);
            if(idx>=0){rh360Empleados[idx]={...rh360Empleados[idx],...data,id:ref.id};}
        } else {
            await fs.updateDoc(fs.doc(db,'rh_empleados',id), data);
            const idx = rh360Empleados.findIndex(e=>e.id===id);
            if(idx>=0) rh360Empleados[idx]={...rh360Empleados[idx],...data};
        }
        rh360EmpleadoAct={...rh360EmpleadoAct,...data};
        rh360RenderModal(rh360EmpleadoAct);
        rh360TabSwitch('info');
        if(typeof window.mostrarPush==='function') window.mostrarPush('Guardado','Colaborador actualizado','👤');
    } catch(e){
        alert('Error al guardar: '+e.message);
    }
};

// ── Actualizar estado de documento ──
window.rh360EditarDoc = function(empId, docKey){
    const e = rh360Empleados.find(x=>x.id===empId);
    if(!e) return;
    const doc = RH360_DOCS.find(d=>d.key===docKey);
    const ov = document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:400px">'+
        '<div style="font-size:15px;font-weight:800;margin-bottom:16px">Actualizar: '+doc.label+'</div>'+
        '<div style="margin-bottom:12px"><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Estado</label>'+
        '<select id="rh360-doc-status" class="rh-form-input">'+
            '<option value="">Sin información</option>'+
            '<option value="vigente"'+(e['doc_'+docKey]==='vigente'?' selected':'')+'>Vigente</option>'+
            '<option value="por_vencer"'+(e['doc_'+docKey]==='por_vencer'?' selected':'')+'>Próximo a vencer</option>'+
            '<option value="vencido"'+(e['doc_'+docKey]==='vencido'?' selected':'')+'>Vencido</option>'+
        '</select></div>'+
        '<div style="margin-bottom:16px"><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha vencimiento (opcional)</label>'+
        '<input type="date" id="rh360-doc-venc" class="rh-form-input" value="'+(e['venc_'+docKey]||'')+'"></div>'+
        '<div style="display:flex;gap:8px">'+
            '<button id="rh360-doc-save" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Guardar</button>'+
            '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="flex:1;padding:10px;background:#F1F5F9;color:#64748B;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>'+
        '</div>'+
    '</div>';
    ov.addEventListener('click',ev=>{if(ev.target===ov)ov.remove();});
    document.body.appendChild(ov);
    document.getElementById('rh360-doc-save').onclick=async()=>{
        const status=document.getElementById('rh360-doc-status').value;
        const venc=document.getElementById('rh360-doc-venc').value;
        const upd={['doc_'+docKey]:status,['venc_'+docKey]:venc,actualizadoEn:new Date().toISOString()};
        try{
            const fs=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
            if(!empId.startsWith('sheet_')) await fs.updateDoc(fs.doc(db,'rh_empleados',empId),upd);
            Object.assign(e,upd);
            ov.remove();
            rh360TabSwitch('docs');
        }catch(err){alert('Error: '+err.message);}
    };
};

// ── Agregar evento al historial ──
window.rh360AgregarHistorial = function(empId){
    const e = rh360Empleados.find(x=>x.id===empId);
    if(!e) return;
    const ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    ov.innerHTML='<div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:400px">'+
        '<div style="font-size:15px;font-weight:800;margin-bottom:16px">Agregar al historial</div>'+
        '<div style="margin-bottom:10px"><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha</label>'+
        '<input type="date" id="rh360-hl-fecha" class="rh-form-input" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
        '<div style="margin-bottom:16px"><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Descripción</label>'+
        '<input type="text" id="rh360-hl-texto" class="rh-form-input" placeholder="Ej: Cambio de puesto, promoción, capacitación..."></div>'+
        '<div style="display:flex;gap:8px">'+
            '<button id="rh360-hl-save" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Guardar</button>'+
            '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="flex:1;padding:10px;background:#F1F5F9;color:#64748B;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer">Cancelar</button>'+
        '</div></div>';
    ov.addEventListener('click',ev=>{if(ev.target===ov)ov.remove();});
    document.body.appendChild(ov);
    document.getElementById('rh360-hl-save').onclick=async()=>{
        const fecha=document.getElementById('rh360-hl-fecha').value;
        const texto=document.getElementById('rh360-hl-texto').value.trim();
        if(!texto){alert('Escribe una descripción');return;}
        const hist=[...(e.historial||[]),{fecha,texto}];
        try{
            const fs=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
            if(!empId.startsWith('sheet_')) await fs.updateDoc(fs.doc(db,'rh_empleados',empId),{historial:hist});
            e.historial=hist;
            ov.remove();
            rh360TabSwitch('hist');
        }catch(err){alert('Error: '+err.message);}
    };
};

// ── Agregar nuevo colaborador ──
window.rh360AbrirAgregarEmp = function(){
    const nuevo={id:'new_'+Date.now(),nombre:'',puesto:'',departamento:'',plaza:'',estatus:'activo'};
    rh360EmpleadoAct=nuevo;
    rh360TabModal='edit';
    const modal=document.getElementById('rh360-modal');
    if(modal){modal.classList.add('show');rh360RenderModal(nuevo);}
};

// ── ORGANIGRAMA ──
function rh360HTMLOrganigrama(){
    // Agrupar por departamento y jefe
    const deptos = {};
    rh360Empleados.filter(e=>(e.estatus||'activo').toLowerCase()==='activo').forEach(e=>{
        const d = e.departamento||e.area||'Sin departamento';
        if(!deptos[d]) deptos[d]=[];
        deptos[d].push(e);
    });
    const nodos = Object.entries(deptos).map(([depto,emps])=>{
        const jefes = emps.filter(e=>e.jefe&&emps.some(x=>x.nombre===e.jefe)).concat(emps.filter(e=>!e.jefe));
        return '<div style="background:#fff;border-radius:12px;border:1.5px solid #E2E8F0;padding:14px;min-width:200px;cursor:default">'+
            '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#2563EB;margin-bottom:10px">'+rh360Escape(depto)+'</div>'+
            emps.map(e=>'<div style="display:flex;align-items:center;gap:8px;padding:6px;border-radius:7px;cursor:pointer;transition:.1s" onclick="rh360AbrirPerfil(\''+e.id+'\')" onmouseover="this.style.background=\'#F8FAFD\'" onmouseout="this.style.background=\'\'">'+
                '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1E3A5F,#2563EB);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;flex-shrink:0">'+
                    (e.nombre||'?').split(' ').slice(0,2).map(p=>p[0]||'').join('').toUpperCase()+
                '</div>'+
                '<div><div style="font-size:11.5px;font-weight:700;color:#0A0F1E">'+rh360Escape(e.nombre||'—')+'</div>'+
                '<div style="font-size:9.5px;color:#94A3B8">'+rh360Escape(e.puesto||e.cargo||'—')+'</div></div>'+
            '</div>').join('')+
        '</div>';
    }).join('');
    const total=rh360Empleados.filter(e=>(e.estatus||'activo').toLowerCase()==='activo').length;
    return '<div style="margin-bottom:14px;font-size:11px;color:#64748B">'+total+' colaboradores activos · '+Object.keys(deptos).length+' departamentos</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start">'+nodos+'</div>';
}

// ── ALERTAS ──
function rh360HTMLAlertas(){
    const alertas=[];
    rh360Empleados.forEach(e=>{
        RH360_DOCS.forEach(d=>{
            const color=rh360ColorDoc(e['doc_'+d.key]||'');
            if(color==='rojo') alertas.push({tipo:'rojo',msg:rh360Escape(e.nombre||'—')+' — '+d.label+' VENCIDO',emp:e.id});
            else if(color==='amarillo') alertas.push({tipo:'amarillo',msg:rh360Escape(e.nombre||'—')+' — '+d.label+' próximo a vencer',emp:e.id});
        });
        // Póliza vehículo
        if(typeof flV!=='undefined'){
            const veh=flV.find(v=>(v.responsable||'').toUpperCase().includes((e.nombre||'').split(' ')[0].toUpperCase()));
            if(veh&&veh.pv){
                const dias=Math.round((new Date(veh.pv)-new Date())/86400000);
                if(dias<0) alertas.push({tipo:'rojo',msg:'ECO '+veh.eco+' ('+rh360Escape(e.nombre||'—')+') — Póliza seguro VENCIDA',emp:e.id});
                else if(dias<30) alertas.push({tipo:'amarillo',msg:'ECO '+veh.eco+' ('+rh360Escape(e.nombre||'—')+') — Póliza vence en '+dias+' días',emp:e.id});
            }
        }
    });
    if(!alertas.length) return '<div class="rh360-alert verde"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sin alertas activas — todos los documentos están en orden</div>';
    const rojas=alertas.filter(a=>a.tipo==='rojo');
    const amarillas=alertas.filter(a=>a.tipo==='amarillo');
    let html='';
    if(rojas.length) html+='<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B91C1C;margin-bottom:8px">'+rojas.length+' alertas críticas</div>'+
        rojas.map(a=>'<div class="rh360-alert rojo" onclick="rh360AbrirPerfil(\''+a.emp+'\')" style="cursor:pointer">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+a.msg+'</div>').join('');
    if(amarillas.length) html+='<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B45309;margin-top:16px;margin-bottom:8px">'+amarillas.length+' advertencias</div>'+
        amarillas.map(a=>'<div class="rh360-alert amarillo" onclick="rh360AbrirPerfil(\''+a.emp+'\')" style="cursor:pointer">'+
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'+a.msg+'</div>').join('');
    return html;
}

// ── HTML del modal ──
function rh360ModalHTML(){
    return '<div id="rh360-modal"><div class="rh360-modal-box" id="rh360-modal-box"></div></div>';
}

// ── Helpers ──
function rh360ColorDoc(val){
    if(!val||val==='') return 'gris';
    if(val==='vigente') return 'verde';
    if(val==='por_vencer') return 'amarillo';
    if(val==='vencido') return 'rojo';
    // Si es una fecha, calcular días
    const d=new Date(val);
    if(!isNaN(d)){
        const dias=Math.round((d-new Date())/86400000);
        if(dias<0) return 'rojo';
        if(dias<30) return 'amarillo';
        return 'verde';
    }
    return 'gris';
}

function rh360Antiguedad(fechaStr){
    if(!fechaStr) return '—';
    const ini=new Date(fechaStr);
    if(isNaN(ini)) return '—';
    const diff=new Date()-ini;
    const años=Math.floor(diff/31536000000);
    const meses=Math.floor((diff%31536000000)/2592000000);
    if(años>0) return años+'a '+(meses>0?meses+'m':'');
    if(meses>0) return meses+' meses';
    return 'Nuevo ingreso';
}

function rh360Escape(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Integración con toggleRHDash ──
// Cuando se activa el área de RH, también inicializar el módulo 360°
const _origToggleRHDash = window.toggleRHDash;
window.toggleRHDash = function(area, email){
    if(_origToggleRHDash) _origToggleRHDash(area, email);
    if(area==='Recursos Humanos' && puedeVerRH(email)){
        // Esperar a que el DOM esté listo y luego inicializar
        setTimeout(()=>{ if(typeof window.initRH360==='function') window.initRH360(); }, 200);
    }
};

console.log('[rh.js] ✅ Módulo RH cargado');
console.log('[rh.js] ✅ Módulo RH 360° listo');
