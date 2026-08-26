// MÓDULO RH — Portal Tecnocontrol
// Archivo: /rh.js
// Dependencias globales que provee index.html:
//   - db, auth (Firebase)
//   - esAdminTotal(email), mostrarPush()

//  Inyectar estilos CSS del módulo RH 
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
        .rh360-modal-avatar{width:72px;height:72px;border-radius:50%;border:3px solid rgba(255,255,255,.3);object-fit:cover;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;flex-shrink:0;cursor:pointer;position:relative;overflow:hidden;}
        .rh360-modal-avatar:hover .rh360-avatar-overlay{opacity:1;}
        .rh360-avatar-overlay{position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;transition:.2s;border-radius:50%;}
        .rh360-avatar-overlay svg{color:#fff;}
        .rh360-avatar-overlay span{font-size:8px;font-weight:800;color:#fff;margin-top:2px;letter-spacing:.3px;}
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

    // Helper para tabla de registros con editar/eliminar
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

    //  Tabla auxiliar con columnas legibles 
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

    // ráfica dona ausentismo
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

    // Dona vacantes
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

    //  Renderizar listas en el HTML
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


// Selector de áreas
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

// Formularios por tipo 
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

// Exponer función principal globalmente
window.toggleRHDash = function(area, email) {
    _toggleRHDash(area, email);
};

// ============================================================
// MÓDULO RH 360° — Directorio, Perfil, Organigrama
// Fuente de datos: colección "colaboradores" (fusión de usuarios,
// ops_tecnicos, fl_usuarios y rh_empleados)
// ============================================================

// ── CSS del directorio/perfil/organigrama nuevos ──────────────
(function inyectarCSSRHPerfil() {
    if (document.getElementById('css-rh-perfil')) return;
    const style = document.createElement('style');
    style.id = 'css-rh-perfil';
    style.textContent = `
        #rh360-root{display:none;margin-top:16px;}

        /* Barra superior */
        .rhd-topbar{display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid #f1f5f9;padding-bottom:12px;flex-wrap:wrap;align-items:center;}
        .rhd-tab{padding:8px 18px;border-radius:10px;border:1.5px solid #E2E8F0;background:#fff;color:#475569;font-size:12px;font-weight:700;cursor:pointer;}
        .rhd-tab.on{background:#0A1628;color:#fff;border-color:#0A1628;}
        .rhd-tab:hover:not(.on){background:#F8FAFD;border-color:#CBD5E1;}
        .rhd-search{flex:1;min-width:180px;padding:9px 14px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:13px;outline:none;background:#fff;}
        .rhd-search:focus{border-color:#2563EB;}
        .rhd-add{margin-left:auto;background:#F0FDF4;color:#15803D;border:1px solid #BBF7D0;padding:9px 16px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;}
        .rhd-filtro{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:12px;font-weight:600;color:#475569;background:#fff;outline:none;cursor:pointer;}
        .rhd-filtro:focus{border-color:#2563EB;}

        /* Directorio — filas tipo acordeón */
        .rhd-hint{font-size:11px;color:#64748B;margin-bottom:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
        .rhd-hint .toggle-link{color:#2563EB;font-weight:700;cursor:pointer;}
        .rhd-list{display:flex;flex-direction:column;gap:6px;}
        .rhd-row{background:#fff;border:1.5px solid #E8EDF5;border-radius:12px;overflow:hidden;transition:.15s;}
        .rhd-row.open{border-color:#BFDBFE;box-shadow:0 4px 14px rgba(37,99,235,.08);}
        .rhd-row-head{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;}
        .rhd-row-head:hover{background:#F8FAFD;}
        .rhd-avatar{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#1E3A5F,#2563EB);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;flex-shrink:0;overflow:hidden;}
        .rhd-avatar img{width:100%;height:100%;object-fit:cover;}
        .rhd-name{font-size:12px;font-weight:800;color:#0A0F1E;line-height:1.2;}
        .rhd-puesto{font-size:10.5px;color:#64748B;margin-top:1px;}
        .rhd-row-mid{flex:1;min-width:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .rhd-tags{display:flex;flex-wrap:wrap;gap:4px;}
        .rhd-tag{font-size:8.5px;font-weight:700;padding:2px 7px;border-radius:99px;background:#F1F5F9;color:#475569;white-space:nowrap;}
        .rhd-tag.pend{background:#FFFBEB;color:#B45309;}
        .rhd-tag.baja{background:#FEE2E2;color:#DC2626;}
        .rhd-chevron{color:#94A3B8;transition:transform .15s;flex-shrink:0;}
        .rhd-row.open .rhd-chevron{transform:rotate(180deg);}
        .rhd-row-body{padding:4px 16px 14px 52px;border-top:1px solid #F1F5F9;}
        .rhd-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:10px;}
        .rhd-detail-field{font-size:11px;}
        .rhd-detail-field .k{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8;}
        .rhd-detail-field .v{font-weight:700;color:#0A0F1E;margin-top:1px;}
        .rhd-detail-actions{margin-top:12px;display:flex;gap:8px;}
        .rhd-btn-perfil{font-size:11px;font-weight:700;padding:6px 14px;border-radius:8px;background:#0A1628;color:#fff;border:none;cursor:pointer;}

        /* Perfil */
        .rhp-back{font-size:12px;color:#64748B;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;margin-bottom:16px;}
        .rhp-back:hover{color:#0A0F1E;}
        .rhp-grid{display:grid;grid-template-columns:290px 1fr 290px;gap:16px;align-items:start;}
        @media(max-width:1000px){.rhp-grid{grid-template-columns:1fr;}}
        .rhp-photo{position:relative;border-radius:18px;overflow:hidden;height:230px;background:linear-gradient(135deg,#0A1628,#1E3A5F);cursor:pointer;}
        .rhp-photo img{width:100%;height:100%;object-fit:cover;}
        .rhp-photo-overlay{position:absolute;left:0;right:0;bottom:0;padding:14px;background:linear-gradient(0deg,rgba(10,22,40,.92),transparent);}
        .rhp-photo-name{color:#fff;font-size:15px;font-weight:800;}
        .rhp-photo-puesto{color:rgba(255,255,255,.7);font-size:11px;margin-top:2px;}
        .rhp-photo-actions{position:absolute;top:10px;right:10px;display:flex;gap:6px;}
        .rhp-photo-btn{width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.4);backdrop-filter:blur(4px);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;}
        .rhp-stat-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;}
        .rhp-stat{background:#fff;border:1px solid #E8EDF5;border-radius:12px;padding:12px;text-align:center;}
        .rhp-stat .v{font-size:16px;font-weight:900;color:#0A0F1E;}
        .rhp-stat .l{font-size:9px;font-weight:700;text-transform:uppercase;color:#94A3B8;margin-top:2px;}
        .rhp-card{background:#fff;border-radius:16px;border:1px solid #E8EDF5;padding:16px 18px;margin-bottom:14px;}
        .rhp-card h3{font-size:12px;font-weight:800;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;}
        .rhp-card h3 .link{font-size:11px;font-weight:700;color:#2563EB;cursor:pointer;}
        .rhp-tl{position:relative;padding-left:16px;}
        .rhp-tl::before{content:'';position:absolute;left:4px;top:2px;bottom:2px;width:2px;background:#E2E8F0;}
        .rhp-tl-item{position:relative;padding-bottom:14px;}
        .rhp-tl-item:last-child{padding-bottom:0;}
        .rhp-tl-dot{position:absolute;left:-16px;top:3px;width:8px;height:8px;border-radius:50%;background:#2563EB;border:2px solid #fff;box-shadow:0 0 0 1px #E2E8F0;}
        .rhp-tl-date{font-size:9px;font-weight:700;color:#94A3B8;}
        .rhp-tl-text{font-size:11.5px;font-weight:700;color:#0A0F1E;margin-top:1px;}
        .rhp-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .rhp-field{background:#F8FAFD;border-radius:10px;padding:9px 12px;}
        .rhp-field .k{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8;margin-bottom:2px;}
        .rhp-field .v{font-size:12.5px;font-weight:700;color:#0A0F1E;word-break:break-word;}
        .rhp-field .v.empty{color:#CBD5E1;font-weight:500;font-style:italic;}
        .rhp-field input,.rhp-field select{width:100%;border:1px solid #E2E8F0;border-radius:6px;padding:5px 7px;font-size:12px;outline:none;background:#fff;}
        .rhp-doc-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid #F1F5F9;border-radius:10px;margin-bottom:6px;}
        .rhp-doc-icn{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;flex-shrink:0;}
        .rhp-doc-name{font-size:12px;font-weight:700;flex:1;color:#0A0F1E;}
        .rhp-doc-status{font-size:10px;font-weight:700;}
        .rhp-doc-edit{font-size:10px;font-weight:700;padding:4px 10px;border:1px solid #E2E8F0;border-radius:6px;background:#fff;cursor:pointer;color:#64748B;}
        .rhp-act{padding:11px 0;border-bottom:1px solid #F1F5F9;}
        .rhp-act:last-child{border-bottom:none;padding-bottom:0;}
        .rhp-act-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;gap:8px;}
        .rhp-act-title{font-size:12px;font-weight:800;color:#0A0F1E;}
        .rhp-mod-tag{font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:99px;text-transform:uppercase;white-space:nowrap;}
        .rhp-mod-tag.flotilla{background:#EFF6FF;color:#2563EB;}
        .rhp-mod-tag.operaciones{background:#F5F3FF;color:#7C3AED;}
        .rhp-act-desc{font-size:11px;color:#64748B;}
        .rhp-empty-mod{text-align:center;padding:20px 10px;color:#94A3B8;font-size:11.5px;}
        .rhp-pendcorreo{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;font-size:11.5px;color:#92400E;margin-bottom:14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;}

        /* Organigrama en árbol */
        .rho-tree{overflow-x:auto;padding:8px 0;}
        .rho-root-item{margin-bottom:18px;text-align:center;}
        .rho-node{display:inline-block;background:#fff;border:1.5px solid #E2E8F0;border-radius:10px;padding:7px 11px;text-align:center;cursor:pointer;min-width:120px;transition:.15s;}
        .rho-node:hover{border-color:#2563EB;box-shadow:0 4px 14px rgba(37,99,235,.12);}
        .rho-node.root{background:#0A1628;color:#fff;border-color:#0A1628;}
        .rho-node-name{font-size:10.5px;font-weight:800;}
        .rho-node-puesto{font-size:9px;color:#94A3B8;margin-top:1px;}
        .rho-node.root .rho-node-puesto{color:rgba(255,255,255,.6);}
        .rho-children{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;border-top:1px solid #E2E8F0;padding-top:10px;margin-top:10px;}
    `;
    document.head.appendChild(style);
})();

// ── Estado del módulo ──────────────────────────────────────────
let rhColabs = [];              // todos los colaboradores cargados
let rhVista = 'directorio';     // directorio | organigrama | alertas
let rhBusqueda = '';
let rhPerfilId = null;          // id del colaborador abierto (null = sin perfil abierto)
let rhModoEdicion = false;
let rhExpandidoId = null;       // fila del directorio actualmente expandida
let rhMostrarSinNombre = false; // cuentas sin nombre (buzones genéricos) ocultas por default
let rhFiltroDepto = '';         // '' = todos
let rhFiltroEstatus = '';       // '' = todos, 'activo', 'baja'

// Documentos con semáforo de vigencia
const RH_DOCS = [
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

// Campos editables del perfil (correo NO se incluye aquí — se cambia solo
// vía rhAsignarCorreo porque es el ID del documento en Firestore)
const RH_CAMPOS_EDITABLES = [
    {key:'nombre',        label:'Nombre completo'},
    {key:'puesto',        label:'Puesto'},
    {key:'telefono',      label:'Teléfono'},
    {key:'departamento',  label:'Departamento'},
    {key:'jefe',          label:'Jefe directo'},
    {key:'estatus',       label:'Estatus', type:'select', opts:['activo','baja']},
    {key:'rfc',           label:'RFC'},
    {key:'curp',          label:'CURP'},
    {key:'nss',           label:'NSS'},
    {key:'tipo_contrato', label:'Tipo de contrato'},
    {key:'plaza',         label:'Plaza'},
    {key:'tipo_sangre',   label:'Tipo de sangre'},
    {key:'estado_civil',  label:'Estado civil'},
    {key:'num_empleado',  label:'# Empleado'},
];
// Campos que se muestran en la vista (no edición) — igual a los editables,
// excluyendo nombre/puesto/estatus porque ya se ven en la tarjeta de foto,
// y agregando correo al inicio (solo lectura).
const RH_CAMPOS_VISTA = [
    {key:'correo', label:'Correo'},
    ...RH_CAMPOS_EDITABLES.filter(f=>!['nombre','puesto','estatus'].includes(f.key)),
];

// ── Entrada del módulo ─────────────────────────────────────────
window.initRH360 = async function(){
    const root = document.getElementById('rh360-root');
    if(!root) return;
    root.style.display = 'block';
    root.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">Cargando directorio…</div>';
    await rhCargarColaboradores();
    rhPerfilId = null;
    rhVista = 'directorio';
    rhRenderRoot();
};

async function rhCargarColaboradores(){
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const snap = await fs.getDocs(fs.collection(db,'colaboradores'));
        rhColabs = snap.docs.map(d=>({id:d.id, ...d.data()}));
        console.log('[RH] '+rhColabs.length+' colaboradores cargados');
    } catch(e){
        console.error('[RH] Error cargando colaboradores:', e.message);
        rhColabs = [];
    }
}

// ── Render raíz ─────────────────────────────────────────────────
function rhRenderRoot(){
    const root = document.getElementById('rh360-root');
    if(!root) return;
    if(rhPerfilId){
        root.innerHTML = rhHTMLPerfil(rhPerfilId);
        rhWirePerfil();
        return;
    }
    root.innerHTML = rhHTMLTopbar() + '<div id="rh-vista">' + rhHTMLVistaActual() + '</div>';
    if(rhVista==='directorio') rhRenderDirectorioGrid();
}

window.rhSetVista = function(v){ rhVista=v; rhPerfilId=null; rhRenderRoot(); };
window.rhAbrirPerfil = function(id){ rhPerfilId=id; rhModoEdicion=false; rhRenderRoot(); };
window.rhVolverDirectorio = function(){ rhPerfilId=null; rhVista='directorio'; rhRenderRoot(); };

function rhHTMLTopbar(){
    const labels = {directorio:'Directorio', organigrama:'Organigrama', alertas:'Alertas'};
    return '<div class="rhd-topbar">'+
        Object.keys(labels).map(v=>'<button class="rhd-tab'+(rhVista===v?' on':'')+'" onclick="rhSetVista(\''+v+'\')">'+labels[v]+'</button>').join('')+
        (rhVista==='directorio' ? (
            '<input class="rhd-search" placeholder="Buscar por nombre, puesto o departamento…" oninput="rhBuscar(this.value)" value="'+rh360Escape(rhBusqueda)+'">'+
            rhHTMLFiltroDepto()+
            '<select class="rhd-filtro" onchange="rhFiltrarEstatus(this.value)">'+
                '<option value=""'+(rhFiltroEstatus===''?' selected':'')+'>Todos los estatus</option>'+
                '<option value="activo"'+(rhFiltroEstatus==='activo'?' selected':'')+'>Activos</option>'+
                '<option value="baja"'+(rhFiltroEstatus==='baja'?' selected':'')+'>Baja</option>'+
            '</select>'
        ) : '')+
        '<button class="rhd-add" onclick="rhNuevoColaborador()">+ Agregar colaborador</button>'+
    '</div>';
}

function rhHTMLFiltroDepto(){
    const deptos = [...new Set(rhColabs.map(c=>c.departamento).filter(Boolean))].sort();
    return '<select class="rhd-filtro" onchange="rhFiltrarDepto(this.value)">'+
        '<option value=""'+(rhFiltroDepto===''?' selected':'')+'>Todos los departamentos</option>'+
        deptos.map(d=>'<option value="'+rh360Escape(d)+'"'+(rhFiltroDepto===d?' selected':'')+'>'+rh360Escape(d)+'</option>').join('')+
    '</select>';
}

window.rhFiltrarDepto = function(v){ rhFiltroDepto = v; rhRenderDirectorioGrid(); };
window.rhFiltrarEstatus = function(v){ rhFiltroEstatus = v; rhRenderDirectorioGrid(); };

function rhHTMLVistaActual(){
    if(rhVista==='organigrama') return rhHTMLOrganigrama();
    if(rhVista==='alertas') return rhHTMLAlertas();
    return '<div class="rhd-hint" id="rh-dir-hint"></div><div class="rhd-list" id="rh-dir-grid"></div>';
}


// ── Directorio (filas tipo acordeón) ────────────────────────────
function rhListaBase(){
    return rhColabs.filter(c=>{
        if(!rhMostrarSinNombre && !(c.nombre && c.nombre.trim())) return false;
        return true;
    });
}

function rhRenderDirectorioGrid(){
    const gridEl = document.getElementById('rh-dir-grid');
    const hintEl = document.getElementById('rh-dir-hint');
    if(!gridEl) return;

    const sinNombreTotal = rhColabs.filter(c=>!(c.nombre && c.nombre.trim())).length;
    if(hintEl){
        hintEl.innerHTML = '<span></span>'+
            (sinNombreTotal ? '<span class="toggle-link" onclick="rhToggleSinNombre()">'+
                (rhMostrarSinNombre ? 'Ocultar' : 'Mostrar')+' '+sinNombreTotal+' cuentas sin nombre</span>' : '');
    }

    const q = rhBusqueda.trim().toLowerCase();
    const lista = rhListaBase().filter(c=>{
        if(rhFiltroDepto && c.departamento !== rhFiltroDepto) return false;
        if(rhFiltroEstatus && (c.estatus||'activo').toLowerCase() !== rhFiltroEstatus) return false;
        if(!q) return true;
        return (c.nombre||'').toLowerCase().includes(q) ||
               (c.puesto||'').toLowerCase().includes(q) ||
               (c.departamento||'').toLowerCase().includes(q);
    }).sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));

    if(hintEl) hintEl.querySelector('span').textContent = lista.length+' colaboradores';

    if(!lista.length){
        gridEl.innerHTML = '<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">Sin resultados</div>';
        return;
    }

    gridEl.innerHTML = lista.map(c=>rhHTMLRowDirectorio(c)).join('');
}

function rhHTMLRowDirectorio(c){
    const iniciales = (c.nombre||'?').split(' ').filter(Boolean).slice(0,2).map(p=>p[0]).join('').toUpperCase();
    const esBaja = (c.estatus||'activo').toLowerCase()==='baja';
    const abierta = rhExpandidoId === c.id;
    const antig = c.fechaIngreso ? rh360Antiguedad(c.fechaIngreso) : null;

    const detalleCampos = [
        ['Correo', c.correo],
        ['Teléfono', c.telefono],
        ['Jefe directo', c.jefe],
        ['Antigüedad', antig],
    ].filter(([,v])=>v);

    return '<div class="rhd-row'+(abierta?' open':'')+'" id="rhd-row-'+c.id+'">'+
        '<div class="rhd-row-head" onclick="rhToggleExpand(\''+c.id+'\')">'+
            '<div class="rhd-avatar">'+(c.foto?'<img src="'+c.foto+'">':iniciales)+'</div>'+
            '<div class="rhd-row-mid">'+
                '<div><div class="rhd-name">'+rh360Escape(c.nombre||'(sin nombre)')+'</div>'+
                (c.puesto?'<div class="rhd-puesto">'+rh360Escape(c.puesto)+'</div>':'')+'</div>'+
                '<div class="rhd-tags">'+
                    (c.departamento?'<span class="rhd-tag">'+rh360Escape(c.departamento)+'</span>':'')+
                    (c.sinCorreo?'<span class="rhd-tag pend">Correo pendiente</span>':'')+
                    (esBaja?'<span class="rhd-tag baja">Baja</span>':'')+
                '</div>'+
            '</div>'+
            '<svg class="rhd-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>'+
        '</div>'+
        (abierta ? '<div class="rhd-row-body">'+
            (detalleCampos.length ? '<div class="rhd-detail-grid">'+detalleCampos.map(([l,v])=>
                '<div class="rhd-detail-field"><div class="k">'+l+'</div><div class="v">'+rh360Escape(v)+'</div></div>'
            ).join('')+'</div>' : '<div style="font-size:11px;color:#94A3B8;margin-top:8px">Sin datos adicionales capturados.</div>')+
            '<div class="rhd-detail-actions">'+
                '<button class="rhd-btn-perfil" onclick="event.stopPropagation();rhAbrirPerfil(\''+c.id+'\')">Ver perfil completo</button>'+
            '</div>'+
        '</div>' : '');
}

window.rhToggleExpand = function(id){
    rhExpandidoId = (rhExpandidoId===id) ? null : id;
    rhRenderDirectorioGrid();
};

window.rhToggleSinNombre = function(){
    rhMostrarSinNombre = !rhMostrarSinNombre;
    rhRenderDirectorioGrid();
};

window.rhBuscar = function(v){ rhBusqueda = v; rhRenderDirectorioGrid(); };

window.rhNuevoColaborador = async function(){
    const nombre = prompt('Nombre completo del nuevo colaborador:');
    if(!nombre || !nombre.trim()) return;
    const correo = prompt('Correo corporativo (déjalo vacío si aún no lo tiene):', '');
    const correoNorm = (correo||'').trim().toLowerCase();
    const tieneCorreo = correoNorm.includes('@');
    const id = tieneCorreo ? correoNorm :
        ('sinCorreo_'+nombre.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_'));
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const data = {
            colaboradorId: id, nombre: nombre.trim(), correo: tieneCorreo ? correoNorm : null,
            sinCorreo: !tieneCorreo, estatus: 'activo',
            creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString(),
        };
        await fs.setDoc(fs.doc(db,'colaboradores',id), data, {merge:true});
        await rhCargarColaboradores();
        rhPerfilId = id;
        rhModoEdicion = true;
        rhRenderRoot();
    } catch(err){ alert('Error al crear: '+err.message); }
};

// ── Organigrama en árbol jerárquico real ───────────────────────
function rhNormNombre(s){
    return (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function rhHTMLOrganigrama(){
    const activos = rhColabs.filter(c=>(c.estatus||'activo').toLowerCase()==='activo' && c.nombre);
    if(!activos.length) return '<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">Sin colaboradores activos</div>';

    const porNombre = {};
    activos.forEach(c=>{ porNombre[rhNormNombre(c.nombre)] = c; });

    const hijosDe = {};
    activos.forEach(c=>{
        const jn = rhNormNombre(c.jefe);
        const jefeMatch = jn ? porNombre[jn] : null;
        if(jefeMatch && jefeMatch.id !== c.id){
            (hijosDe[jefeMatch.id] = hijosDe[jefeMatch.id] || []).push(c);
        }
    });

    const conJefeValido = new Set();
    Object.values(hijosDe).forEach(arr=>arr.forEach(c=>conJefeValido.add(c.id)));
    const raices = activos.filter(c=>!conJefeValido.has(c.id));

    function nodoHTML(c, visitados, esRaiz){
        if(visitados.has(c.id)) return ''; // corta ciclos accidentales
        const nv = new Set(visitados); nv.add(c.id);
        const hijos = hijosDe[c.id] || [];
        return '<div>'+
            '<div class="rho-node'+(esRaiz?' root':'')+'" onclick="rhAbrirPerfil(\''+c.id+'\')">'+
                '<div class="rho-node-name">'+rh360Escape(c.nombre)+'</div>'+
                (c.puesto?'<div class="rho-node-puesto">'+rh360Escape(c.puesto)+'</div>':'')+
            '</div>'+
            (hijos.length ? '<div class="rho-children">'+hijos.map(h=>nodoHTML(h, nv, false)).join('')+'</div>' : '')+
        '</div>';
    }

    const conHijos = raices.filter(r=>(hijosDe[r.id]||[]).length>0);
    const sinHijos = raices.filter(r=>!(hijosDe[r.id]||[]).length);

    let html = '<div style="font-size:11px;color:#64748B;margin-bottom:14px">'+activos.length+' colaboradores activos</div>';
    html += '<div class="rho-tree">';
    conHijos.forEach(r=>{ html += '<div class="rho-root-item">'+nodoHTML(r, new Set(), true)+'</div>'; });
    if(sinHijos.length){
        html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin:10px 0">Sin jefe directo capturado o sin reportes</div>';
        html += '<div class="rho-children" style="border-top:none;padding-top:0;margin-top:0">'+sinHijos.map(r=>nodoHTML(r, new Set(), false)).join('')+'</div>';
    }
    html += '</div>';
    return html;
}

// ── Alertas ─────────────────────────────────────────────────────
function rhHTMLAlertas(){
    const alertas = [];
    rhColabs.forEach(c=>{
        RH_DOCS.forEach(d=>{
            const color = rh360ColorDoc(c['doc_'+d.key]||'');
            if(color==='rojo') alertas.push({tipo:'rojo', msg:rh360Escape(c.nombre||'—')+' — '+d.label+' VENCIDO', id:c.id});
            else if(color==='amarillo') alertas.push({tipo:'amarillo', msg:rh360Escape(c.nombre||'—')+' — '+d.label+' próximo a vencer', id:c.id});
        });
    });
    if(!alertas.length) return '<div class="rh360-alert verde"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sin alertas activas — todos los documentos están en orden</div>';
    const rojas = alertas.filter(a=>a.tipo==='rojo');
    const amarillas = alertas.filter(a=>a.tipo==='amarillo');
    let html = '';
    if(rojas.length) html += '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B91C1C;margin-bottom:8px">'+rojas.length+' alertas críticas</div>'+
        rojas.map(a=>'<div class="rh360-alert rojo" onclick="rhAbrirPerfil(\''+a.id+'\')" style="cursor:pointer">'+a.msg+'</div>').join('');
    if(amarillas.length) html += '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B45309;margin-top:16px;margin-bottom:8px">'+amarillas.length+' advertencias</div>'+
        amarillas.map(a=>'<div class="rh360-alert amarillo" onclick="rhAbrirPerfil(\''+a.id+'\')" style="cursor:pointer">'+a.msg+'</div>').join('');
    return html;
}

// ── Perfil ──────────────────────────────────────────────────────
function rhHTMLPerfil(id){
    const c = rhColabs.find(x=>x.id===id);
    if(!c) return '<div class="rhp-back" onclick="rhVolverDirectorio()">← Directorio</div><div style="color:#94A3B8">No encontrado.</div>';

    const antig = c.fechaIngreso ? rh360Antiguedad(c.fechaIngreso) : '—';
    const docsCompletos = RH_DOCS.filter(d=>rh360ColorDoc(c['doc_'+d.key]||'')==='verde').length;

    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'+
            '<div class="rhp-back" style="margin-bottom:0" onclick="rhVolverDirectorio()">'+
                '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> Directorio'+
            '</div>'+
            '<button class="rhp-doc-edit" style="color:#DC2626;border-color:#FECACA" onclick="rhEliminarColaborador(\''+c.id+'\')">Eliminar colaborador</button>'+
        '</div>'+
        (c.sinCorreo ? '<div class="rhp-pendcorreo"><span>Este colaborador todavía no tiene correo asignado.</span>'+
            '<button class="rhp-doc-edit" onclick="rhAsignarCorreo(\''+c.id+'\')">Asignar correo</button></div>' : '')+
        '<div class="rhp-grid">'+
            '<div>'+
                '<div class="rhp-photo" onclick="rhSubirFoto(\''+c.id+'\')">'+
                    (c.foto?'<img src="'+c.foto+'">':'')+
                    '<div class="rhp-photo-actions">'+
                        (c.foto?'<button class="rhp-photo-btn" onclick="event.stopPropagation();rhEliminarFoto(\''+c.id+'\')" title="Eliminar foto">✕</button>':'')+
                    '</div>'+
                    '<div class="rhp-photo-overlay">'+
                        '<div class="rhp-photo-name">'+rh360Escape(c.nombre||'(sin nombre)')+'</div>'+
                        '<div class="rhp-photo-puesto">'+rh360Escape(c.puesto||'—')+'</div>'+
                    '</div>'+
                '</div>'+
                '<div class="rhp-stat-row">'+
                    '<div class="rhp-stat"><div class="v">'+antig+'</div><div class="l">Antigüedad</div></div>'+
                    '<div class="rhp-stat"><div class="v">'+docsCompletos+'/'+RH_DOCS.length+'</div><div class="l">Documentos</div></div>'+
                '</div>'+
                '<div class="rhp-card" style="margin-top:14px">'+
                    '<h3>Trayectoria <span class="link" onclick="rhAgregarHistorial(\''+c.id+'\')">+ Agregar</span></h3>'+
                    rhHTMLTrayectoria(c)+
                '</div>'+
            '</div>'+
            '<div>'+
                '<div class="rhp-card">'+
                    '<h3>Datos generales <span class="link" onclick="rhToggleEdicion()">'+(rhModoEdicion?'Cancelar':'Editar')+'</span></h3>'+
                    rhHTMLDatosGenerales(c)+
                '</div>'+
                '<div class="rhp-card">'+
                    '<h3>Documentos</h3>'+
                    rhHTMLDocumentos(c)+
                '</div>'+
            '</div>'+
            '<div>'+
                '<div class="rhp-card">'+
                    '<h3>Actividad reciente</h3>'+
                    '<div id="rhp-actividad"><div class="rhp-empty-mod">Cargando…</div></div>'+
                '</div>'+
            '</div>'+
        '</div>';
}

function rhHTMLDatosGenerales(c){
    if(!rhModoEdicion){
        return '<div class="rhp-data-grid">'+RH_CAMPOS_VISTA.map(f=>{
            const val = c[f.key];
            return '<div class="rhp-field"><div class="k">'+f.label+'</div><div class="v'+(val?'':' empty')+'">'+(val?rh360Escape(val):'Sin capturar')+'</div></div>';
        }).join('')+'</div>';
    }
    return '<div class="rhp-data-grid">'+RH_CAMPOS_EDITABLES.map(f=>{
        if(f.type==='select'){
            return '<div class="rhp-field"><div class="k">'+f.label+'</div><select id="rhp-edit-'+f.key+'">'+
                f.opts.map(o=>'<option value="'+o+'"'+(c[f.key]===o?' selected':'')+'>'+o+'</option>').join('')+
            '</select></div>';
        }
        return '<div class="rhp-field"><div class="k">'+f.label+'</div><input type="text" id="rhp-edit-'+f.key+'" value="'+rh360Escape(c[f.key]||'')+'"></div>';
    }).join('')+'</div>'+
    '<div style="margin-top:12px">'+
        '<button class="rhd-tab on" onclick="rhGuardarDatos(\''+c.id+'\')">Guardar cambios</button>'+
    '</div>';
}

window.rhToggleEdicion = function(){ rhModoEdicion = !rhModoEdicion; rhRenderRoot(); };

window.rhGuardarDatos = async function(id){
    const data = {};
    RH_CAMPOS_EDITABLES.forEach(f=>{
        const el = document.getElementById('rhp-edit-'+f.key);
        if(el) data[f.key] = el.value.trim();
    });
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        data.actualizadoEn = new Date().toISOString();
        await fs.updateDoc(fs.doc(db,'colaboradores',id), data);
        const c = rhColabs.find(x=>x.id===id);
        if(c) Object.assign(c, data);
        rhModoEdicion = false;
        if(typeof window.mostrarPush==='function') window.mostrarPush('Guardado','Datos actualizados correctamente','👤');
        rhRenderRoot();
    } catch(err){ alert('Error al guardar: '+err.message); }
};

function rhHTMLDocumentos(c){
    const colores = {verde:'#16A34A',amarillo:'#D97706',rojo:'#DC2626',gris:'#94A3B8'};
    const labelsColor = {verde:'Vigente',amarillo:'Por vencer',rojo:'Vencido',gris:'Sin información'};
    const iconos = {verde:'✓',amarillo:'!',rojo:'✗',gris:'–'};
    return RH_DOCS.map(d=>{
        const val = c['doc_'+d.key]||'';
        const color = rh360ColorDoc(val);
        return '<div class="rhp-doc-row">'+
            '<div class="rhp-doc-icn" style="background:'+colores[color]+'">'+iconos[color]+'</div>'+
            '<div class="rhp-doc-name">'+d.label+'<br><span style="font-weight:500;color:#94A3B8;font-size:10px">'+labelsColor[color]+(val&&color!=='gris'?' · '+rh360Escape(val):'')+'</span></div>'+
            '<button class="rhp-doc-edit" onclick="rhEditarDoc(\''+c.id+'\',\''+d.key+'\')">Actualizar</button>'+
        '</div>';
    }).join('');
}

window.rhEditarDoc = async function(id, key){
    const d = RH_DOCS.find(x=>x.key===key);
    const c = rhColabs.find(x=>x.id===id);
    const actual = c['doc_'+key] || '';
    const val = prompt('Estado de "'+d.label+'":\n• Fecha de vencimiento (AAAA-MM-DD)\n• O escribe "vigente" si no vence\n• Vacío para borrar el dato', actual);
    if(val===null) return;
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const campo = {}; campo['doc_'+key] = val.trim();
        campo.actualizadoEn = new Date().toISOString();
        await fs.updateDoc(fs.doc(db,'colaboradores',id), campo);
        c['doc_'+key] = val.trim();
        rhRenderRoot();
    } catch(err){ alert('Error: '+err.message); }
};

function rhHTMLTrayectoria(c){
    const eventos = Array.isArray(c.historial) ? [...c.historial] : [];
    if(c.fechaIngreso) eventos.push({fecha:c.fechaIngreso, texto:'Ingreso a Tecnocontrol'+(c.puesto?' — '+c.puesto:'')});
    if(!eventos.length) return '<div style="text-align:center;padding:16px;color:#94A3B8;font-size:11.5px">Sin eventos registrados</div>';
    eventos.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
    return '<div class="rhp-tl">'+eventos.map(ev=>
        '<div class="rhp-tl-item"><div class="rhp-tl-dot"></div><div class="rhp-tl-date">'+rh360Escape(ev.fecha||'—')+'</div><div class="rhp-tl-text">'+rh360Escape(ev.texto||'—')+'</div></div>'
    ).join('')+'</div>';
}

window.rhAgregarHistorial = async function(id){
    const texto = prompt('Descripción del evento (ej. "Promoción a Encargado de Flotilla"):');
    if(!texto || !texto.trim()) return;
    const fecha = prompt('Fecha (AAAA-MM-DD):', new Date().toISOString().slice(0,10));
    if(!fecha) return;
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const c = rhColabs.find(x=>x.id===id);
        const historial = Array.isArray(c.historial) ? [...c.historial] : [];
        historial.push({fecha: fecha.trim(), texto: texto.trim()});
        await fs.updateDoc(fs.doc(db,'colaboradores',id), {historial, actualizadoEn:new Date().toISOString()});
        c.historial = historial;
        rhRenderRoot();
    } catch(err){ alert('Error: '+err.message); }
};

// ── Foto de perfil ──────────────────────────────────────────────
window.rhSubirFoto = function(id){
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='image/*'; inp.style.display='none';
    document.body.appendChild(inp);
    inp.onchange = async function(){
        const file = this.files[0];
        if(!file){document.body.removeChild(inp);return;}
        if(file.size > 5*1024*1024){alert('La imagen es demasiado grande. Usa una menor a 5MB.');document.body.removeChild(inp);return;}
        const b64 = await new Promise(res=>{
            const reader = new FileReader();
            reader.onload = e=>{
                const img = new Image();
                img.onload = ()=>{
                    const size = 400;
                    const ratio = Math.min(1, size/Math.max(img.width,img.height));
                    const w = Math.round(img.width*ratio), h = Math.round(img.height*ratio);
                    const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
                    cv.getContext('2d').drawImage(img,0,0,w,h);
                    res(cv.toDataURL('image/jpeg',0.82));
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
        document.body.removeChild(inp);
        try {
            const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
            await fs.updateDoc(fs.doc(db,'colaboradores',id), {foto:b64, actualizadoEn:new Date().toISOString()});
            const c = rhColabs.find(x=>x.id===id);
            if(c) c.foto = b64;
            rhRenderRoot();
            if(typeof window.mostrarPush==='function') window.mostrarPush('Foto actualizada','La foto de perfil se guardó correctamente','👤');
        } catch(err){ alert('Error al guardar la foto: '+err.message); }
    };
    inp.click();
};

window.rhEliminarFoto = async function(id){
    if(!confirm('¿Eliminar la foto de este colaborador?')) return;
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await fs.updateDoc(fs.doc(db,'colaboradores',id), {foto:null, actualizadoEn:new Date().toISOString()});
        const c = rhColabs.find(x=>x.id===id);
        if(c) c.foto = null;
        rhRenderRoot();
    } catch(err){ alert('Error: '+err.message); }
};

// ── Asignar correo real a un colaborador "sinCorreo_" ──────────
window.rhEliminarColaborador = async function(id){
    const c = rhColabs.find(x=>x.id===id);
    if(!c) return;
    if(!confirm('¿Eliminar a '+(c.nombre||'este registro')+' de forma permanente?\n\nEsto borra su ficha de "colaboradores" (perfil, documentos, trayectoria). No afecta su historial ya guardado en Flotilla u Operaciones.')) return;
    const confirmacion = prompt('Para confirmar, escribe ELIMINAR:');
    if(confirmacion !== 'ELIMINAR'){ alert('Cancelado — no se escribió "ELIMINAR" exactamente.'); return; }
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        await fs.deleteDoc(fs.doc(db,'colaboradores',id));
        rhColabs = rhColabs.filter(x=>x.id!==id);
        rhPerfilId = null;
        rhVista = 'directorio';
        rhRenderRoot();
        if(typeof window.mostrarPush==='function') window.mostrarPush('Colaborador eliminado','Se borró el registro correctamente','🗑️');
    } catch(err){ alert('Error al eliminar: '+err.message); }
};

window.rhAsignarCorreo = async function(idViejo){
    const c = rhColabs.find(x=>x.id===idViejo);
    if(!c) return;
    const correo = prompt('Correo real de '+(c.nombre||'este colaborador')+':', '');
    if(!correo) return;
    const correoNorm = correo.trim().toLowerCase();
    if(!correoNorm.includes('@')){ alert('Correo inválido.'); return; }
    try {
        const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const refNuevo = fs.doc(db,'colaboradores',correoNorm);
        const existente = await fs.getDoc(refNuevo);
        const base = existente.exists() ? existente.data() : {};
        const combinado = { ...c, ...base, colaboradorId:correoNorm, correo:correoNorm, sinCorreo:false, actualizadoEn:new Date().toISOString() };
        delete combinado.id;
        await fs.setDoc(refNuevo, combinado, {merge:true});
        if(idViejo !== correoNorm) await fs.deleteDoc(fs.doc(db,'colaboradores',idViejo));
        await rhCargarColaboradores();
        rhPerfilId = correoNorm;
        rhRenderRoot();
        if(typeof window.mostrarPush==='function') window.mostrarPush('Correo asignado','Colaborador actualizado correctamente','👤');
    } catch(err){ alert('Error: '+err.message); }
};

// ── Actividad cruzada: Flotilla + Operaciones, solo lectura ────
async function rhCargarActividadCruzada(correo){
    const resultado = { vehiculo:null, herramientas:[] };
    const fs = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    try {
        const uSnap = await fs.getDocs(fs.query(fs.collection(db,'fl_usuarios'), fs.where('email','==',correo)));
        if(!uSnap.empty){
            const u = uSnap.docs[0].data();
            const eco = u.ecoVinculado || (Array.isArray(u.ecosVinculados) && u.ecosVinculados[0]) || null;
            if(eco){
                const vSnap = await fs.getDocs(fs.query(fs.collection(db,'flotilla_vehiculos'), fs.where('eco','==',String(eco))));
                if(!vSnap.empty) resultado.vehiculo = {id:vSnap.docs[0].id, ...vSnap.docs[0].data()};
            }
        }
    } catch(e){ console.warn('[RH] Flotilla cross-ref:', e.message); }

    try {
        const tSnap = await fs.getDocs(fs.query(fs.collection(db,'ops_tecnicos'), fs.where('correo','==',correo)));
        if(!tSnap.empty){
            const idInterno = tSnap.docs[0].id;
            const hSnap = await fs.getDocs(fs.query(fs.collection(db,'ops_herramientas'), fs.where('tecnicoActualId','==',idInterno)));
            resultado.herramientas = hSnap.docs.map(d=>({id:d.id, ...d.data()}));
        }
    } catch(e){ console.warn('[RH] Operaciones cross-ref:', e.message); }

    return resultado;
}

function rhWirePerfil(){
    const c = rhColabs.find(x=>x.id===rhPerfilId);
    const el = document.getElementById('rhp-actividad');
    if(!c || !c.correo){
        if(el) el.innerHTML = '<div class="rhp-empty-mod">Sin correo asignado — no se puede cruzar con Flotilla/Operaciones todavía.</div>';
        return;
    }
    rhCargarActividadCruzada(c.correo).then(res=>{
        if(!el) return;
        let html = '';
        if(res.vehiculo){
            html += '<div class="rhp-act"><div class="rhp-act-head"><div class="rhp-act-title">Vehículo asignado</div><span class="rhp-mod-tag flotilla">Flotilla</span></div>'+
                '<div class="rhp-act-desc">ECO-'+rh360Escape(res.vehiculo.eco||'—')+' · '+rh360Escape(res.vehiculo.unidad||'—')+'</div></div>';
        }
        res.herramientas.forEach(h=>{
            html += '<div class="rhp-act"><div class="rhp-act-head"><div class="rhp-act-title">'+rh360Escape(h.id||'Herramienta')+'</div><span class="rhp-mod-tag operaciones">Operaciones</span></div>'+
                '<div class="rhp-act-desc">'+rh360Escape(h.descripcion||h.nombre||'—')+'</div></div>';
        });
        if(!html) html = '<div class="rhp-empty-mod">Sin actividad registrada en Flotilla u Operaciones.</div>';
        el.innerHTML = html;
    }).catch(err=>{
        if(el) el.innerHTML = '<div class="rhp-empty-mod">No se pudo cargar (revisa permisos de Firestore).</div>';
        console.warn('[RH] actividad cruzada:', err.message);
    });
}

// ── Helpers compartidos ─────────────────────────────────────────
function rh360ColorDoc(val){
    if(!val||val==='') return 'gris';
    if(val==='vigente') return 'verde';
    if(val==='por_vencer') return 'amarillo';
    if(val==='vencido') return 'rojo';
    const d = new Date(val);
    if(!isNaN(d)){
        const dias = Math.round((d-new Date())/86400000);
        if(dias<0) return 'rojo';
        if(dias<30) return 'amarillo';
        return 'verde';
    }
    return 'gris';
}

function rh360Antiguedad(fechaStr){
    if(!fechaStr) return '—';
    const ini = new Date(fechaStr);
    if(isNaN(ini)) return '—';
    const diff = new Date()-ini;
    const años = Math.floor(diff/31536000000);
    const meses = Math.floor((diff%31536000000)/2592000000);
    if(años>0) return años+'a '+(meses>0?meses+'m':'');
    if(meses>0) return meses+' meses';
    return 'Nuevo ingreso';
}

function rh360Escape(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Integración con toggleRHDash (igual que antes) ──────────────
const _origToggleRHDash = window.toggleRHDash;
window.toggleRHDash = function(area, email){
    if(_origToggleRHDash) _origToggleRHDash(area, email);
    if(area==='Recursos Humanos' && puedeVerRH(email)){
        setTimeout(()=>{ if(typeof window.initRH360==='function') window.initRH360(); }, 200);
    }
};

console.log('[rh.js] ✅ Módulo RH cargado');
console.log('[rh.js] ✅ Módulo RH 360° (colaboradores) listo');
