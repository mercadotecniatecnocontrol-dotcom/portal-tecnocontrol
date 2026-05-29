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
        @media(max-width:768px){
            .rh-charts{grid-template-columns:1fr !important;}
            .rh-kpis{grid-template-columns:repeat(2,1fr) !important;gap:8px !important;}
            .rh-kpi{padding:10px 8px !important;}
            .rh-kpi-val{font-size:20px !important;}
            .rh-tabs{gap:4px;}
            .rh-tab{padding:6px 10px;font-size:11px;}
            .rh-modal-box{width:96vw;padding:16px;border-radius:20px 20px 0 0;position:fixed;bottom:0;left:0;max-height:92vh;}
            #modal-rh{align-items:flex-end !important;}
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

function puedeVerRH(email){ return email === RH_EMAIL || esAdminTotal(email); }

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


// Exportar función principal
export function toggleRHDash(area, email) {
    _toggleRHDash(area, email);
}

console.log('[rh.js] ✅ Módulo RH cargado');
