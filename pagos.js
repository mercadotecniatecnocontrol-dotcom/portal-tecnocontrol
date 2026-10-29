// pagos.js — Módulo Pagos v3 · Tecnocontrol Portal Operativo
// Incluye: Dashboard KPIs + Registros individuales + Bandeja Flotilla

// DASHBOARD PAGOS v2 — Registros individuales con auto-cálculo

    let pagMes = new Date().getMonth();
    let pagAnio = new Date().getFullYear();
    let pagRegistros = [];
    let pagChartTend = null, pagChartGlobal = null;
    let pagEditId = null;
    const MESES_P = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

    function pagKey(){ return `${pagAnio}-${String(pagMes+1).padStart(2,'0')}`; }

    async function getFirebasePag(){
        const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const fsMod = await (window.tcFSPuente ? window.tcFSPuente() : import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'));
        const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        const app = appMod.getApps()[0];
        return { db: fsMod.getFirestore(app), auth: authMod.getAuth(app), fs: fsMod };
    }

    function actualizarLabelPag(){
        const el = document.getElementById('pagos-mes-label');
        if(el) el.innerText = `${MESES_P[pagMes]} ${pagAnio}`;
    }

    window.pagosMesPrev = () => { pagMes--; if(pagMes<0){pagMes=11;pagAnio--;} actualizarLabelPag(); cargarRegistrosPag(); };
    window.pagosMesNext = () => { pagMes++; if(pagMes>11){pagMes=0;pagAnio++;} actualizarLabelPag(); cargarRegistrosPag(); };

    // Cargar registros del mes desde Firestore
    async function cargarRegistrosPag(){
        const key = pagKey();
        try {
            const { db, fs } = await getFirebasePag();
            const snap = await fs.getDocs(fs.query(
                fs.collection(db, 'pagos_registros'),
                fs.where('mesKey','==',key)
            ));
            pagRegistros = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
            console.log(`[PAG v2] ${pagRegistros.length} registros en ${key}`);
            calcularKPIs();
            renderListaPag();
        } catch(e){
            console.warn('[PAG v2]', e.message);
            pagRegistros = [];
            calcularKPIs();
            renderListaPag();
        }
    }

    // Calcular KPIs automáticamente de los registros
    function calcularKPIs(){
        const total = pagRegistros.length;
        const setKPI = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        const setDelta = (id, html) => { const el = document.getElementById(id); if(el) el.innerHTML = `<span class="rh-kpi-delta neutral">${html}</span>`; };

        if(total === 0){
            ['pag-val-tiempo','pag-val-docs','pag-val-calendario','pag-val-respuesta','pag-val-errores','pag-val-urgentes','pag-val-rechazados'].forEach(id=>setKPI(id,'—'));
            ['pag-delta-tiempo','pag-delta-docs','pag-delta-calendario','pag-delta-respuesta','pag-delta-errores','pag-delta-urgentes','pag-delta-rechazados'].forEach(id=>setDelta(id,'Sin registros'));
            document.getElementById('pag-global-pct').innerText = '—';
            return;
        }

        // Calcular cada KPI
        const enTiempo = pagRegistros.filter(r=>r.enTiempo==='si').length;
        const pctTiempo = Math.round(enTiempo/total*100);

        const docOk = pagRegistros.filter(r=>r.docCompleta==='si').length;
        const pctDocs = Math.round(docOk/total*100);

        const calOk = pagRegistros.filter(r=>r.cumpleCalendario==='si').length;
        const pctCal = Math.round(calOk/total*100);

        const conError = pagRegistros.filter(r=>r.tieneError==='si').length;
        const pctErrores = total>0?Math.round(conError/total*1000)/10:0;

        const urgentes = pagRegistros.filter(r=>r.esUrgente==='si').length;
        const pctUrgentes = total>0?Math.round(urgentes/total*1000)/10:0;

        const rechazados = pagRegistros.filter(r=>r.rechazado==='si').length;
        const pctRechazados = total>0?Math.round(rechazados/total*1000)/10:0;

        const tiemposResp = pagRegistros.filter(r=>r.horasRespuesta>0).map(r=>Number(r.horasRespuesta));
        const promResp = tiemposResp.length>0?Math.round(tiemposResp.reduce((s,v)=>s+v,0)/tiemposResp.length):0;

        // Pintar KPIs
        const colorPct = (v,meta,inv) => { if(inv) return v<=meta?'#16a34a':v<=meta*2?'#f59e0b':'#ef4444'; return v>=meta?'#16a34a':v>=meta*0.85?'#f59e0b':'#ef4444'; };

        setKPI('pag-val-tiempo', pctTiempo+'%');
        setDelta('pag-delta-tiempo', `<span style="color:${colorPct(pctTiempo,98,false)}">${enTiempo}/${total}</span> · Meta ≥ 98%`);

        setKPI('pag-val-docs', pctDocs+'%');
        setDelta('pag-delta-docs', `<span style="color:${colorPct(pctDocs,100,false)}">${docOk}/${total}</span> · Meta 100%`);

        setKPI('pag-val-calendario', pctCal+'%');
        setDelta('pag-delta-calendario', `<span style="color:${colorPct(pctCal,98,false)}">${calOk}/${total}</span> · Meta ≥ 98%`);

        setKPI('pag-val-respuesta', promResp+' hrs');
        setDelta('pag-delta-respuesta', `<span style="color:${colorPct(promResp,48,true)}">Prom. ${tiemposResp.length} pagos</span> · Meta ≤ 48h`);

        setKPI('pag-val-errores', pctErrores+'%');
        setDelta('pag-delta-errores', `<span style="color:${colorPct(pctErrores,1,true)}">${conError}/${total}</span> · Meta ≤ 1%`);

        setKPI('pag-val-urgentes', pctUrgentes+'%');
        setDelta('pag-delta-urgentes', `<span style="color:${colorPct(pctUrgentes,5,true)}">${urgentes}/${total}</span> · Meta ≤ 5%`);

        setKPI('pag-val-rechazados', pctRechazados+'%');
        setDelta('pag-delta-rechazados', `<span style="color:${colorPct(pctRechazados,1,true)}">${rechazados}/${total}</span> · Meta ≤ 1%`);

        // Dona global
        const promedio = Math.round((pctTiempo + pctDocs + pctCal) / 3);
        const elG = document.getElementById('pag-chart-global');
        if(elG){
            if(pagChartGlobal) pagChartGlobal.destroy();
            pagChartGlobal = new Chart(elG, {
                type:'doughnut',
                data:{datasets:[{data:[promedio, Math.max(0.001,100-promedio)], backgroundColor:[promedio>=80?'#16a34a':promedio>=50?'#f59e0b':'#ef4444','#e2e8f0'], borderWidth:0}]},
                options:{cutout:'76%', plugins:{legend:{display:false}}, animation:{duration:600}}
            });
            document.getElementById('pag-global-pct').innerText = promedio+'%';
            const det = document.getElementById('pag-global-detalle');
            if(det) det.innerHTML = `<b>${total}</b> pagos registrados este mes`;
        }
    }

    // Render lista de registros
    function renderListaPag(filtro){
        const el = document.getElementById('pag-registros-lista');
        const countEl = document.getElementById('pag-registros-count');
        if(!el) return;

        let lista = [...pagRegistros];
        const q = (document.getElementById('pag-buscar')?.value||'').toLowerCase();
        const kpiFiltro = document.getElementById('pag-filtro-kpi')?.value || 'todos';

        if(q) lista = lista.filter(r=>
            (r.proveedor||'').toLowerCase().includes(q)||
            (r.areaSolicitante||'').toLowerCase().includes(q)||
            (r.responsable||'').toLowerCase().includes(q)||
            (r.metodoPago||'').toLowerCase().includes(q)||
            (r.concepto||'').toLowerCase().includes(q)
        );

        if(kpiFiltro==='atrasado') lista=lista.filter(r=>r.enTiempo==='no');
        if(kpiFiltro==='doc_incompleta') lista=lista.filter(r=>r.docCompleta==='no');
        if(kpiFiltro==='error') lista=lista.filter(r=>r.tieneError==='si');
        if(kpiFiltro==='urgente') lista=lista.filter(r=>r.esUrgente==='si');
        if(kpiFiltro==='rechazado') lista=lista.filter(r=>r.rechazado==='si');

        if(countEl) countEl.innerText = `(${lista.length} de ${pagRegistros.length})`;

        if(!lista.length){
            el.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">Sin registros este mes. Clic en "➕ Registrar pago" para comenzar.</div>';
            return;
        }

        el.innerHTML = `
        <div style="display:grid;grid-template-columns:0.8fr 1.5fr 1fr 0.8fr 0.6fr 0.6fr 0.6fr 0.6fr 80px;gap:6px;padding:8px 12px;background:#f8faff;border-radius:8px;margin-bottom:6px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">
            <span>Fecha</span><span>Proveedor</span><span>Área</span><span>Método</span><span>Tiempo</span><span>Doc</span><span>Error</span><span>Urgente</span><span></span>
        </div>
        ${lista.map(r=>{
            const chipSi = '<span style="background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">✓</span>';
            const chipNo = '<span style="background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">✗</span>';
            return `<div style="display:grid;grid-template-columns:0.8fr 1.5fr 1fr 0.8fr 0.6fr 0.6fr 0.6fr 0.6fr 80px;gap:6px;padding:9px 12px;border-bottom:1px solid rgba(59,130,246,0.06);align-items:center;font-size:12px;">
                <span style="color:#64748b;font-size:11px;">${r.fecha||'—'}</span>
                <div>
                    <div style="font-weight:700;color:#1e293b;">${r.proveedor||'—'}</div>
                    <div style="font-size:10px;color:#94a3b8;">${r.concepto||''}</div>
                </div>
                <span>${r.areaSolicitante||'—'}</span>
                <span style="font-size:11px;">${r.metodoPago||'—'}</span>
                <span>${r.enTiempo==='si'?chipSi:chipNo}</span>
                <span>${r.docCompleta==='si'?chipSi:chipNo}</span>
                <span>${r.tieneError==='si'?chipNo:chipSi}</span>
                <span>${r.esUrgente==='si'?'<span style="background:#fef9c3;color:#a16207;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">⚠️</span>':chipSi}</span>
                <div style="display:flex;gap:4px;justify-content:flex-end;">
                    <button onclick="editarPagoReg('${r.id}')" style="padding:3px 7px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:10px;cursor:pointer;">✏️</button>
                    <button onclick="eliminarPagoReg('${r.id}')" style="padding:3px 7px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;">🗑</button>
                </div>
            </div>`;
        }).join('')}`;
    }

    window.pagBuscar = () => renderListaPag();
    window.pagFiltrar = (tipo) => {
        const sel = document.getElementById('pag-filtro-kpi');
        const map = {tiempo:'atrasado',docs:'doc_incompleta',errores:'error',urgentes:'urgente',rechazados:'rechazado',calendario:'todos',respuesta:'todos'};
        if(sel) sel.value = map[tipo]||'todos';
        renderListaPag();
    };

    // Formulario de registro individual
    window.abrirPagosRegistro = (editId) => {
        pagEditId = editId || null;
        const form = document.getElementById('pagos-inline-form');
        const content = document.getElementById('pagos-form-content');
        const titulo = document.getElementById('pagos-form-titulo');
        if(!form || !content) return;

        if(titulo) titulo.innerText = editId ? '✏️ Editar registro de pago' : '💳 Registrar pago';

        const r = editId ? pagRegistros.find(x=>x.id===editId) || {} : {};

        content.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#0e7490;margin-bottom:8px;">📋 Datos del pago</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">Fecha del pago</label><input class="rh-form-input" id="pr-fecha" type="date" value="${r.fecha||new Date().toISOString().slice(0,10)}"></div>
            <div><label class="rh-form-label">Proveedor / Beneficiario</label><input class="rh-form-input" id="pr-proveedor" type="text" value="${r.proveedor||''}" placeholder="Nombre del proveedor" list="pr-proveedores-list"></div>
            <div><label class="rh-form-label">Concepto</label><input class="rh-form-input" id="pr-concepto" type="text" value="${r.concepto||''}" placeholder="Descripción breve del pago"></div>
        </div>
        <datalist id="pr-proveedores-list">${[...new Set(pagRegistros.map(r=>r.proveedor).filter(Boolean))].map(p=>`<option value="${p}">`).join('')}</datalist>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">Monto ($)</label><input class="rh-form-input" id="pr-monto" type="number" min="0" step="0.01" value="${r.monto||''}" placeholder="0.00"></div>
            <div><label class="rh-form-label">Método de pago</label>
                <select class="rh-form-input" id="pr-metodo">
                    <option ${r.metodoPago==='Transferencia'?'selected':''}>Transferencia</option>
                    <option ${r.metodoPago==='SPEI'?'selected':''}>SPEI</option>
                    <option ${r.metodoPago==='Cheque'?'selected':''}>Cheque</option>
                    <option ${r.metodoPago==='Efectivo'?'selected':''}>Efectivo</option>
                    <option ${r.metodoPago==='Tarjeta'?'selected':''}>Tarjeta</option>
                    <option ${r.metodoPago==='Otro'?'selected':''}>Otro</option>
                </select></div>
            <div><label class="rh-form-label">Área solicitante</label><input class="rh-form-input" id="pr-area" type="text" value="${r.areaSolicitante||''}" placeholder="Ej: Operaciones, Compras..." list="pr-areas-list"></div>
            <div><label class="rh-form-label">Tipo proveedor</label>
                <select class="rh-form-input" id="pr-tipoprov">
                    <option ${r.tipoProveedor==='Crítico'?'selected':''}>Crítico</option>
                    <option ${r.tipoProveedor==='Regular'?'selected':''}>Regular</option>
                    <option ${r.tipoProveedor==='Ocasional'?'selected':''}>Ocasional</option>
                </select></div>
        </div>
        <datalist id="pr-areas-list">${[...new Set(pagRegistros.map(r=>r.areaSolicitante).filter(Boolean))].map(a=>`<option value="${a}">`).join('')}</datalist>

        <div style="font-size:12px;font-weight:700;color:#0e7490;margin:14px 0 8px;">📊 Indicadores del pago</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">¿Se pagó en tiempo?</label>
                <select class="rh-form-input" id="pr-entiempo"><option value="si" ${r.enTiempo==='si'||!r.enTiempo?'selected':''}>✅ Sí</option><option value="no" ${r.enTiempo==='no'?'selected':''}>❌ No</option></select></div>
            <div><label class="rh-form-label">¿Doc. completa?</label>
                <select class="rh-form-input" id="pr-doccompleta"><option value="si" ${r.docCompleta==='si'||!r.docCompleta?'selected':''}>✅ Sí</option><option value="no" ${r.docCompleta==='no'?'selected':''}>❌ No</option></select></div>
            <div><label class="rh-form-label">¿Cumple calendario?</label>
                <select class="rh-form-input" id="pr-calendario"><option value="si" ${r.cumpleCalendario==='si'||!r.cumpleCalendario?'selected':''}>✅ Sí</option><option value="no" ${r.cumpleCalendario==='no'?'selected':''}>❌ No</option></select></div>
            <div><label class="rh-form-label">Hrs de respuesta</label><input class="rh-form-input" id="pr-horas" type="number" min="0" step="1" value="${r.horasRespuesta||''}" placeholder="Ej: 24"></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">¿Tiene error?</label>
                <select class="rh-form-input" id="pr-error" onchange="document.getElementById('pr-error-detalle').style.display=this.value==='si'?'block':'none'"><option value="no" ${r.tieneError!=='si'?'selected':''}>✅ No</option><option value="si" ${r.tieneError==='si'?'selected':''}>❌ Sí</option></select></div>
            <div><label class="rh-form-label">¿Es urgente?</label>
                <select class="rh-form-input" id="pr-urgente" onchange="document.getElementById('pr-urgente-detalle').style.display=this.value==='si'?'block':'none'"><option value="no" ${r.esUrgente!=='si'?'selected':''}>✅ No</option><option value="si" ${r.esUrgente==='si'?'selected':''}>🚨 Sí</option></select></div>
            <div><label class="rh-form-label">¿Fue rechazado?</label>
                <select class="rh-form-input" id="pr-rechazado" onchange="document.getElementById('pr-rechazo-detalle').style.display=this.value==='si'?'block':'none'"><option value="no" ${r.rechazado!=='si'?'selected':''}>✅ No</option><option value="si" ${r.rechazado==='si'?'selected':''}>🔙 Sí</option></select></div>
        </div>

        <!-- Detalles condicionales -->
        <div id="pr-error-detalle" style="display:${r.tieneError==='si'?'block':'none'};background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:8px;">❌ Detalle del error</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Tipo de error</label>
                    <select class="rh-form-input" id="pr-tipoerror"><option ${r.tipoError==='Monto incorrecto'?'selected':''}>Monto incorrecto</option><option ${r.tipoError==='Duplicado'?'selected':''}>Duplicado</option><option ${r.tipoError==='Datos bancarios'?'selected':''}>Datos bancarios</option><option ${r.tipoError==='Razón social'?'selected':''}>Razón social</option><option ${r.tipoError==='Otro'?'selected':''}>Otro</option></select></div>
                <div><label class="rh-form-label">Etapa del error</label>
                    <select class="rh-form-input" id="pr-etapaerror"><option ${r.etapaError==='Captura'?'selected':''}>Captura</option><option ${r.etapaError==='Autorización'?'selected':''}>Autorización</option><option ${r.etapaError==='Ejecución'?'selected':''}>Ejecución</option></select></div>
                <div><label class="rh-form-label">Responsable del error</label><input class="rh-form-input" id="pr-resperror" type="text" value="${r.responsableError||''}" placeholder="Quién cometió el error"></div>
                <div><label class="rh-form-label">Impacto económico ($)</label><input class="rh-form-input" id="pr-impacto" type="number" min="0" step="0.01" value="${r.impactoEconomico||''}" placeholder="0.00"></div>
            </div>
        </div>

        <div id="pr-urgente-detalle" style="display:${r.esUrgente==='si'?'block':'none'};background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#a16207;margin-bottom:8px;">🚨 Detalle de urgencia</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Motivo de urgencia</label>
                    <select class="rh-form-input" id="pr-motivourg"><option ${r.motivoUrgencia==='Falta de planeación'?'selected':''}>Falta de planeación</option><option ${r.motivoUrgencia==='Emergencia real'?'selected':''}>Emergencia real</option><option ${r.motivoUrgencia==='Presión externa'?'selected':''}>Presión externa</option><option ${r.motivoUrgencia==='Otro'?'selected':''}>Otro</option></select></div>
                <div><label class="rh-form-label">¿Realmente era urgente?</label>
                    <select class="rh-form-input" id="pr-realurg"><option value="si" ${r.realmenteUrgente!=='no'?'selected':''}>Sí</option><option value="no" ${r.realmenteUrgente==='no'?'selected':''}>No — auditar</option></select></div>
            </div>
        </div>

        <div id="pr-rechazo-detalle" style="display:${r.rechazado==='si'?'block':'none'};background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:8px;">🔙 Detalle del rechazo</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Motivo de rechazo</label>
                    <select class="rh-form-input" id="pr-motivorechazo"><option ${r.motivoRechazo==='Bancario'?'selected':''}>Bancario</option><option ${r.motivoRechazo==='Fiscal'?'selected':''}>Fiscal</option><option ${r.motivoRechazo==='Interno'?'selected':''}>Interno</option><option ${r.motivoRechazo==='Error datos'?'selected':''}>Error datos</option></select></div>
                <div><label class="rh-form-label">Banco / plataforma</label><input class="rh-form-input" id="pr-bancorechazo" type="text" value="${r.bancoRechazo||''}" placeholder="Ej: BBVA, Banorte..."></div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><label class="rh-form-label">Fecha programada original</label><input class="rh-form-input" id="pr-fechaprog" type="date" value="${r.fechaProgramada||''}"></div>
            <div><label class="rh-form-label">Motivo de atraso (si aplica)</label>
                <select class="rh-form-input" id="pr-motivoatraso"><option value="" ${!r.motivoAtraso?'selected':''}>No aplica</option><option ${r.motivoAtraso==='Falta de autorización'?'selected':''}>Falta de autorización</option><option ${r.motivoAtraso==='Error en captura'?'selected':''}>Error en captura</option><option ${r.motivoAtraso==='Falta de liquidez'?'selected':''}>Falta de liquidez</option><option ${r.motivoAtraso==='Doc. incompleta'?'selected':''}>Doc. incompleta</option><option ${r.motivoAtraso==='Otro'?'selected':''}>Otro</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
            <div><label class="rh-form-label">Responsable del pago</label><input class="rh-form-input" id="pr-responsable" type="text" value="${r.responsable||''}" placeholder="Quién ejecutó el pago"></div>
            <div><label class="rh-form-label">Doc. faltante (si aplica)</label><input class="rh-form-input" id="pr-docfaltante" type="text" value="${r.docFaltante||''}" placeholder="Ej: Factura, OC, contrato..."></div>
        </div>
        <label class="rh-form-label" style="margin-top:10px;">Notas / observaciones</label>
        <input class="rh-form-input" id="pr-notas" type="text" value="${r.notas||''}" placeholder="Información adicional...">`;

        form.style.display = 'block';
        form.scrollIntoView({behavior:'smooth', block:'start'});
    };

    window.cerrarPagosInline = () => {
        const form = document.getElementById('pagos-inline-form');
        if(form) form.style.display = 'none';
        pagEditId = null;
    };

    window.editarPagoReg = (id) => { abrirPagosRegistro(id); };

    window.eliminarPagoReg = async (id) => {
        if(!confirm('¿Eliminar este registro de pago?')) return;
        try {
            const { db, fs } = await getFirebasePag();
            await fs.deleteDoc(fs.doc(db,'pagos_registros',id));
            if(window.mostrarPush) window.mostrarPush('🗑 Eliminado','','💳');
            cargarRegistrosPag();
        } catch(e){ alert('Error: '+e.message); }
    };

    // Guardar registro individual
    window.guardarPagoRegistro = async () => {
        const getVal = id => { const el=document.getElementById(id); return el?el.value.trim():''; };
        const getNum = id => { const v=getVal(id); return v?Number(v):undefined; };

        if(!getVal('pr-proveedor')){ alert('Escribe el nombre del proveedor'); return; }

        const btn = document.querySelector('#pagos-inline-form button');
        if(btn){ btn.textContent='💾 Guardando...'; btn.disabled=true; }

        const mesKey = pagKey();
        const docData = {
            mesKey,
            fecha: getVal('pr-fecha') || new Date().toISOString().slice(0,10),
            proveedor: getVal('pr-proveedor'),
            concepto: getVal('pr-concepto'),
            monto: getNum('pr-monto'),
            metodoPago: getVal('pr-metodo'),
            areaSolicitante: getVal('pr-area'),
            tipoProveedor: getVal('pr-tipoprov'),
            enTiempo: getVal('pr-entiempo'),
            docCompleta: getVal('pr-doccompleta'),
            cumpleCalendario: getVal('pr-calendario'),
            horasRespuesta: getNum('pr-horas'),
            tieneError: getVal('pr-error'),
            esUrgente: getVal('pr-urgente'),
            rechazado: getVal('pr-rechazado'),
            fechaProgramada: getVal('pr-fechaprog'),
            motivoAtraso: getVal('pr-motivoatraso'),
            responsable: getVal('pr-responsable'),
            docFaltante: getVal('pr-docfaltante'),
            notas: getVal('pr-notas'),
            // Detalles condicionales
            tipoError: getVal('pr-tipoerror'),
            etapaError: getVal('pr-etapaerror'),
            responsableError: getVal('pr-resperror'),
            impactoEconomico: getNum('pr-impacto'),
            motivoUrgencia: getVal('pr-motivourg'),
            realmenteUrgente: getVal('pr-realurg'),
            motivoRechazo: getVal('pr-motivorechazo'),
            bancoRechazo: getVal('pr-bancorechazo'),
            actualizadoEn: new Date().toISOString()
        };

        Object.keys(docData).forEach(k=>{ if(docData[k]===undefined||docData[k]==='') delete docData[k]; });

        try {
            const { db, fs, auth } = await getFirebasePag();
            docData.creadoPor = auth.currentUser?.email || '';
            if(pagEditId){
                await fs.updateDoc(fs.doc(db,'pagos_registros',pagEditId), docData);
                console.log('[PAG v2] ✅ Actualizado:', pagEditId);
            } else {
                const ref = await fs.addDoc(fs.collection(db,'pagos_registros'), docData);
                console.log('[PAG v2] ✅ Creado:', ref.id);
            }
            cerrarPagosInline();
            if(window.mostrarPush) window.mostrarPush('✅ Pago registrado', docData.proveedor, '💳');
            cargarRegistrosPag();
        } catch(e){
            console.error('[PAG v2 ERROR]', e);
            alert('Error: '+e.message);
        } finally {
            if(btn){ btn.textContent='💾 GUARDAR REGISTRO'; btn.disabled=false; }
        }
    };

    // Hook
    const CHECK_PAG = setInterval(()=>{
        if(typeof window.verArea !== 'function') return;
        clearInterval(CHECK_PAG);
        const _orig = window.verArea;
        window.verArea = function(area, btn){
            _orig(area, btn);
            const dash = document.getElementById('pagos-dashboard');
            if(!dash) return;
            if(area === 'Pagos'){
                dash.style.display = 'block';
                actualizarLabelPag();
                cargarRegistrosPag();
            } else {
                dash.style.display = 'none';
            }
        };
    }, 200);

    console.log('[PAGOS v2] ✅ Módulo cargado');

// ══════════════════════════════════════════════════════════════════════
// CUENTAS POR PAGAR — puente Compras → Pagos.
// Compras informa (folio, proveedor, monto) al generar la OC o marcarla
// recibida; Pagos es dueño de estatusPago/fechaPago. No toca index.html:
// el panel se inyecta como hermano de #pagos-dashboard la primera vez que
// se entra a Pagos. `aspelFolio` queda listo para que, el día que exista
// el API de Aspel, solo haya que llenarlo automático en vez de a mano.
// ══════════════════════════════════════════════════════════════════════
(function(){
'use strict';
let _cxpDatos = [];

async function _cxpGetDB(){
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const fsMod  = await (window.tcFSPuente ? window.tcFSPuente() : import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'));
  const app = appMod.getApps()[0];
  return { db:fsMod.getFirestore(app), fs:fsMod };
}

function _cxpAsegurarPanel(){
  let panel = document.getElementById('pagos-cxp');
  if(panel) return panel;
  const dash = document.getElementById('pagos-dashboard');
  if(!dash || !dash.parentNode) return null;
  panel = document.createElement('div');
  panel.id = 'pagos-cxp';
  panel.style.cssText = 'display:none;margin-top:20px';
  panel.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:18px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h3 style="margin:0;font-size:15px;color:#0A1628">Cuentas por pagar (Compras)</h3>
        <button onclick="window.__cxpRecargar()" style="padding:6px 12px;border:1px solid #E2E8F0;border-radius:8px;background:#fff;font-size:11.5px;font-weight:700;cursor:pointer">↻ Actualizar</button>
      </div>
      <p id="pagos-cxp-resumen" style="font-size:11.5px;color:#5C7089;margin:4px 0 12px"></p>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#0A1628;color:#fff;text-align:left">
          <th style="padding:7px 8px">Folio OC</th><th style="padding:7px 8px">Empresa</th><th style="padding:7px 8px">Proveedor</th>
          <th style="padding:7px 8px">Monto</th><th style="padding:7px 8px">Estatus pago</th><th style="padding:7px 8px">Fecha pago</th>
          <th style="padding:7px 8px">Folio Aspel</th><th style="padding:7px 8px"></th>
        </tr></thead>
        <tbody id="pagos-cxp-tbody"></tbody>
      </table></div>
    </div>`;
  dash.parentNode.insertBefore(panel, dash.nextSibling);
  return panel;
}

function _cxpEsc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function _cxpCargar(){
  const panel = _cxpAsegurarPanel();
  if(!panel) return;
  const tbody = document.getElementById('pagos-cxp-tbody');
  tbody.innerHTML = '<tr><td colspan="8" style="padding:14px;text-align:center;color:#94a3b8">Cargando…</td></tr>';
  try{
    const { db, fs } = await _cxpGetDB();
    const snap = await fs.getDocs(fs.query(fs.collection(db,'pagos_cuentas_por_pagar'), fs.orderBy('creadaEn','desc')));
    _cxpDatos = snap.docs.map(d=>({id:d.id, ...d.data()}));
    _cxpRender();
  }catch(e){
    tbody.innerHTML = '<tr><td colspan="8" style="padding:14px;color:#B91C1C">Error: '+_cxpEsc(e.message)+'</td></tr>';
  }
}

function _cxpRender(){
  const tbody = document.getElementById('pagos-cxp-tbody'); if(!tbody) return;
  const pendientes = _cxpDatos.filter(d=>d.estatusPago!=='pagado');
  const totalPendiente = pendientes.reduce((s,d)=>s+(Number(d.monto)||0),0);
  document.getElementById('pagos-cxp-resumen').textContent =
    _cxpDatos.length+' cuentas · '+pendientes.length+' pendientes · $'+totalPendiente.toLocaleString('es-MX')+' por pagar';
  tbody.innerHTML = _cxpDatos.map(d=>{
    const rowId = 'cxp-'+d.id;
    return `<tr id="${rowId}" style="border-bottom:1px solid #F1F5F9">
      <td style="padding:6px 8px;font-weight:700">${_cxpEsc(d.ocFolio||d.folio||'—')}</td>
      <td style="padding:6px 8px">${_cxpEsc(d.empresa||'—')}</td>
      <td style="padding:6px 8px">${_cxpEsc(d.proveedor||'—')}</td>
      <td style="padding:6px 8px">${d.monto!=null?'$'+Number(d.monto).toLocaleString('es-MX'):'—'}</td>
      <td style="padding:6px 8px"><select class="cxp-estatus" style="padding:4px 6px;border:1px solid #E2E8F0;border-radius:6px;font-size:11.5px">
        ${['pendiente','programado','pagado'].map(e=>`<option value="${e}" ${d.estatusPago===e?'selected':''}>${e}</option>`).join('')}
      </select></td>
      <td style="padding:6px 8px"><input class="cxp-fecha" type="date" value="${d.fechaPago?String(d.fechaPago).slice(0,10):''}" style="padding:4px 6px;border:1px solid #E2E8F0;border-radius:6px;font-size:11.5px"></td>
      <td style="padding:6px 8px"><input class="cxp-aspel" type="text" placeholder="Se llenará solo con Aspel" value="${_cxpEsc(d.aspelFolio||'')}" style="padding:4px 6px;border:1px solid #E2E8F0;border-radius:6px;font-size:11.5px;width:110px"></td>
      <td style="padding:6px 8px"><button onclick="window.__cxpGuardar('${d.id}')" style="padding:5px 10px;background:#0A1628;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer">Guardar</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="padding:14px;text-align:center;color:#94a3b8">Sin cuentas por pagar todavía — se llenan solas cuando Compras genera una orden.</td></tr>';
}

window.__cxpRecargar = _cxpCargar;

window.__cxpGuardar = async function(id){
  const tr = document.getElementById('cxp-'+id); if(!tr) return;
  const estatusPago = tr.querySelector('.cxp-estatus').value;
  const fechaPago = tr.querySelector('.cxp-fecha').value || null;
  const aspelFolio = tr.querySelector('.cxp-aspel').value.trim() || null;
  const btn = tr.querySelector('button');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Guardando…';
  try{
    const { db, fs } = await _cxpGetDB();
    await fs.updateDoc(fs.doc(db,'pagos_cuentas_por_pagar',id), {estatusPago, fechaPago, aspelFolio, actualizadaEn:new Date().toISOString()});
    btn.textContent = '✓ Guardado'; btn.style.background = '#15803d';
    setTimeout(()=>{ btn.textContent = original; btn.style.background=''; btn.disabled=false; }, 1800);
  }catch(e){
    btn.textContent = 'Error'; btn.style.background = '#b91c1c';
    setTimeout(()=>{ btn.textContent = original; btn.style.background=''; btn.disabled=false; }, 2200);
  }
};

const CHECK_CXP = setInterval(()=>{
  if(typeof window.verArea !== 'function') return;
  clearInterval(CHECK_CXP);
  const _orig2 = window.verArea;
  window.verArea = function(area, btn){
    _orig2(area, btn);
    const panel = _cxpAsegurarPanel();
    if(!panel) return;
    if(area === 'Pagos'){ panel.style.display = 'block'; _cxpCargar(); }
    else { panel.style.display = 'none'; }
  };
}, 200);

console.log('[PAGOS · Cuentas por pagar] ✅ listo (preparado para Aspel: campo aspelFolio)');
})();

// SECCIÓN FLOTILLA — Bandeja de pagos pendientes de vehículos
// Lee flotilla_solicitudes donde estatus = 'Pagos'
// Escribe comprobante, monto, factura de vuelta al mismo doc
// Visible para: pagos@, p.pinedo@, c.acosta@, admins
(function(){
'use strict';

async function _getDB(){
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const fsMod  = await (window.tcFSPuente ? window.tcFSPuente() : import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'));
  const authMod= await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const app = appMod.getApps()[0];
  // Las solicitudes vehiculares (flotilla_solicitudes, sus adjuntos y flotilla_notificaciones)
  // viven en Supabase desde oct-2026: mismo adaptador que usa flotilla.js. Sin él, Pagos
  // leía la copia vieja de Firestore y no veía las solicitudes nuevas.
  if(!window.tcFlSbShim) throw new Error('No cargó flotilla-supabase.js; recarga la página.');
  const fs = window.tcFlSbShim(fsMod,{SOLS:'flotilla_solicitudes'});
  return { db:fsMod.getFirestore(app), fs:fs, auth:authMod.getAuth(app) };
}

async function _esUsuarioPagos(email){
  if(!email) return false;
  // Rol centralizado en usuarios/{uid}.roles.pagos — ver roles-modulos.js
  // (antes: arreglos EMAILS_PAGOS/ADMINS sueltos en este archivo, quitados sep-2026)
  return await window.tcEsAdminModulo('pagos');
}

// Estado local
let _flSolsPago   = [];   // solicitudes con estatus Pagos
let _flFiltroStat = '';   // '' | 'vencida' | 'hoy' | 'proxima'
let _comentModal  = null; // id de sol abierta en modal comentarios

//  Render principal de la bandeja 
// 29-oct-2026: el recuadro viejo ya no se dibuja; el tablero nuevo de Pagos (pestaña Flotilla) usa estos datos
// y estos mismos botones (_pflRegistrarPago, _pflComentarios, _pflVerSol).
window.__pflCargarDatos = async function(){
  const { db, fs, auth } = await _getDB();
  const yo = auth.currentUser?.email || '';
  if(!(await _esUsuarioPagos(yo))) return null;
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'flotilla_solicitudes'), fs.where('estatus', '==', 'Pagos')));
  _flSolsPago = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.fechaPagoProgramada||'').localeCompare(b.fechaPagoProgramada||''));
  return _flSolsPago;
};
window.__pflSemaforo = function(s){ return _semaforo(s); };
async function renderBandejaFlotilla(){
  const cont = document.getElementById('pfl-bandeja');
  if(!cont){ if(window.__vp2FlRefrescar) window.__vp2FlRefrescar(); return; }

  cont.innerHTML = '<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13px">Cargando solicitudes...</div>';

  try {
    const { db, fs, auth } = await _getDB();
    const yo = auth.currentUser?.email || '';
    if(!(await _esUsuarioPagos(yo))){
      cont.innerHTML = '<div style="text-align:center;padding:24px;color:#EF4444;font-size:13px;font-weight:700">Sin permisos para ver esta sección.</div>';
      return;
    }

    const snap = await fs.getDocs(fs.query(
      fs.collection(db, 'flotilla_solicitudes'),
      fs.where('estatus', '==', 'Pagos')
    ));
    _flSolsPago = snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(a.fechaPagoProgramada||'').localeCompare(b.fechaPagoProgramada||''));

    _renderTarjetasFl(yo);
  } catch(e){
    cont.innerHTML = '<div style="color:#EF4444;padding:16px;font-size:12px">Error: '+e.message+'</div>';
  }
}

function _semaforo(sol){
  const f = sol.fechaPagoProgramada;
  if(!f) return { color:'#94A3B8', bg:'#F1F5F9', label:'Sin fecha', tipo:'' };
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const lim = new Date(f+'T00:00:00');
  const diff = Math.floor((lim-hoy)/(1000*60*60*24));
  if(diff < 0)  return { color:'#B91C1C', bg:'#FEE2E2', label:'VENCIDA '+(Math.abs(diff))+'d', tipo:'vencida' };
  if(diff === 0)return { color:'#D97706', bg:'#FEF3C7', label:'HOY', tipo:'hoy' };
  if(diff <= 3) return { color:'#D97706', bg:'#FEF9C3', label:'En '+diff+'d', tipo:'proxima' };
  return { color:'#15803D', bg:'#DCFCE7', label:'En '+diff+'d', tipo:'' };
}

function _renderTarjetasFl(yo){
  const cont = document.getElementById('pfl-bandeja');
  if(!cont) return;

  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const vencidas = _flSolsPago.filter(s=>{ const f=s.fechaPagoProgramada; return f && new Date(f+'T00:00:00')<hoy; }).length;
  const deHoy    = _flSolsPago.filter(s=>{ const f=s.fechaPagoProgramada; if(!f) return false; const d=new Date(f+'T00:00:00'); return d.getTime()===hoy.getTime(); }).length;

  let lista = _flSolsPago;
  if(_flFiltroStat) lista = _flSolsPago.filter(s=>_semaforo(s).tipo===_flFiltroStat);

  cont.innerHTML =
    // KPI rápidos
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">'+
      '<div style="background:#FEE2E2;border-radius:10px;padding:12px;text-align:center;cursor:pointer" onclick="window._pflFiltro(\'vencida\')">'+
        '<div style="font-size:22px;font-weight:900;color:#B91C1C">'+vencidas+'</div>'+
        '<div style="font-size:9px;font-weight:800;color:#B91C1C">VENCIDAS</div>'+
      '</div>'+
      '<div style="background:#FEF3C7;border-radius:10px;padding:12px;text-align:center;cursor:pointer" onclick="window._pflFiltro(\'hoy\')">'+
        '<div style="font-size:22px;font-weight:900;color:#D97706">'+deHoy+'</div>'+
        '<div style="font-size:9px;font-weight:800;color:#D97706">PAGAR HOY</div>'+
      '</div>'+
      '<div style="background:#DBEAFE;border-radius:10px;padding:12px;text-align:center;cursor:pointer" onclick="window._pflFiltro(\'\')">'+
        '<div style="font-size:22px;font-weight:900;color:#1E40AF">'+_flSolsPago.length+'</div>'+
        '<div style="font-size:9px;font-weight:800;color:#1E40AF">TOTAL PEND.</div>'+
      '</div>'+
    '</div>'+

    // Filtro activo
    (_flFiltroStat?'<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px"><span style="font-size:11px;font-weight:700;color:#7C3AED;background:#EDE9FE;padding:4px 10px;border-radius:8px">Filtro: '+_flFiltroStat+'</span><button onclick="window._pflFiltro(\'\')" style="padding:4px 8px;background:none;border:1.5px solid #E2E8F0;border-radius:6px;font-size:10px;cursor:pointer;font-weight:700">✕ Quitar</button></div>':'')+

    // Tarjetas
    (!lista.length?
      '<div style="text-align:center;padding:40px 20px;color:#94A3B8">'+
        '<div style="font-size:32px;margin-bottom:10px">✅</div>'+
        '<div style="font-size:14px;font-weight:700">Sin pagos pendientes</div>'+
        '<div style="font-size:11px;margin-top:4px">No hay solicitudes de Flotilla en estatus Pagos</div>'+
      '</div>'
    :
      lista.map(function(s){
        const sem = _semaforo(s);
        const comts = (s.comentariosPagos||[]);
        const ultComt = comts.slice(-1)[0];
        const monto = s.cotizacion?.monto || s.monto || s.montoAutorizado || '';
        const taller = s.cotizacion?.taller || s.tallerNombre || s.taller || '—';
        const factura = s.facturaNum || '';
        const comprobante = s.comprobantePago || '';
        return '<div style="border:1.5px solid '+sem.color+';border-radius:14px;padding:16px;margin-bottom:12px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.04)">'+
          // Header
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">'+
            '<div style="flex:1">'+
              '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'+
                '<span style="font-size:13px;font-weight:900;color:#0A1628">'+(s.tipo||'Servicio')+'</span>'+
                '<span style="background:#EFF6FF;color:#1D4ED8;font-size:10px;font-weight:800;padding:2px 8px;border-radius:8px">ECO '+(s.vehiculoEco||'—')+'</span>'+
                '<span style="background:'+sem.bg+';color:'+sem.color+';font-size:9px;font-weight:900;padding:2px 8px;border-radius:8px">'+sem.label+'</span>'+
              '</div>'+
              '<div style="font-size:11px;color:#64748B">'+
                (s.vehiculo||s.unidad||'—')+' · Solicitado por: <b>'+(s.creadoPorNombre||s.creadoPor||'—')+'</b>'+
              '</div>'+
            '</div>'+
            (monto?'<div style="text-align:right;flex-shrink:0"><div style="font-size:18px;font-weight:900;color:#065F46">$'+Number(monto).toLocaleString('es-MX')+'</div><div style="font-size:9px;color:#94A3B8">MONTO AUTORIZADO</div></div>':'')+
          '</div>'+

          // Datos del taller
          '<div style="background:#F8FAFD;border-radius:9px;padding:10px 12px;margin-bottom:10px;border:1px solid #E8EDF5">'+
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'+
              '<div><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:2px">Taller / Proveedor</div><div style="font-size:12px;font-weight:700;color:#0A1628">'+taller+'</div></div>'+
              '<div><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:2px">Fecha programada</div><div style="font-size:12px;font-weight:700;color:'+(s.fechaPagoProgramada?sem.color:'#94A3B8')+'">'+(s.fechaPagoProgramada||'No definida')+'</div></div>'+
              '<div><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:2px">Factura</div><div style="font-size:12px;font-weight:700;color:#0A1628">'+(factura||'Pendiente')+'</div></div>'+
            '</div>'+
          '</div>'+

          // Estado del comprobante
          (comprobante?
            '<div style="background:#D1FAE5;border-radius:9px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px">'+
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#065F46" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>'+
              '<span style="font-size:11px;font-weight:700;color:#065F46">Comprobante subido</span>'+
              '<a href="'+comprobante+'" target="_blank" style="font-size:10px;color:#2563EB;font-weight:700;margin-left:auto">Ver →</a>'+
            '</div>'
          :
            '<div style="background:#FEF3C7;border-radius:9px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px">'+
              '<span style="font-size:11px;color:#92400E;font-weight:700">⏳ Comprobante pendiente</span>'+
            '</div>'
          )+

          // Últimos comentarios
          (ultComt?
            '<div style="background:#F5F3FF;border-radius:8px;padding:8px 10px;margin-bottom:10px;border:1px solid #EDE9FE">'+
              '<div style="font-size:9px;font-weight:800;color:#7C3AED;margin-bottom:3px">ÚLTIMO COMENTARIO</div>'+
              '<div style="font-size:11px;color:#0A1628">"'+ultComt.texto+'"</div>'+
              '<div style="font-size:9px;color:#94A3B8;margin-top:2px">'+ultComt.autor+' · '+(ultComt.fecha?ultComt.fecha.slice(0,10):'')+'</div>'+
            '</div>'
          :'')+

          // Botones de acción
          '<div style="display:flex;gap:7px;flex-wrap:wrap">'+
            '<button onclick="window._pflRegistrarPago(\''+s.id+'\')" style="flex:1;min-width:120px;padding:9px 12px;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer">'+
              (comprobante?'✏️ Actualizar pago':'💳 Registrar pago')+
            '</button>'+
            '<button onclick="window._pflComentarios(\''+s.id+'\')" style="padding:9px 12px;background:#F5F3FF;border:1.5px solid #DDD6FE;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;color:#7C3AED;cursor:pointer;position:relative">'+
              '💬 Comentarios'+(comts.length?' <span style="background:#7C3AED;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:8px;margin-left:3px">'+comts.length+'</span>':'')+
            '</button>'+
            '<button onclick="window._pflVerSol(\''+s.id+'\')" style="padding:9px 12px;background:#F8FAFD;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:11px;font-weight:700;color:#475569;cursor:pointer">Ver solicitud</button>'+
          '</div>'+
        '</div>';
      }).join('')
    );
}

// Filtro rápido
window._pflFiltro = function(tipo){
  _flFiltroStat = tipo;
  const yo = typeof auth !== 'undefined' ? (auth.currentUser?.email||'') : '';
  _renderTarjetasFl(yo);
};

// ── Modal registrar/actualizar pago ──
window._pflRegistrarPago = function(solId){
  const s = _flSolsPago.find(x=>x.id===solId);
  if(!s) return;
  const monto = s.cotizacion?.monto || s.monto || s.montoAutorizado || '';

  const ov = document.createElement('div');
  ov.className = 'fl-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:4000;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.2)">'+
      '<div style="padding:20px 22px 16px;border-bottom:1.5px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between">'+
        '<div>'+
          '<div style="font-size:16px;font-weight:900;color:#0A1628">Registrar pago</div>'+
          '<div style="font-size:11px;color:#64748B;margin-top:2px">ECO '+(s.vehiculoEco||'—')+' · '+(s.tipo||'—')+'</div>'+
        '</div>'+
        '<button onclick="this.closest(\'.fl-ov\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8">✕</button>'+
      '</div>'+
      '<div style="padding:20px 22px;display:flex;flex-direction:column;gap:12px">'+

        // Monto
        '<div>'+
          '<label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:5px">Monto pagado *</label>'+
          '<input id="pfl-monto" type="number" placeholder="0.00" value="'+(monto||'')+'" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;box-sizing:border-box">'+
        '</div>'+

        // Número de factura
        '<div>'+
          '<label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:5px">Número de factura / referencia</label>'+
          '<input id="pfl-factura" placeholder="Ej: F-2026-00142" value="'+(s.facturaNum||'')+'" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;box-sizing:border-box">'+
        '</div>'+

        // Fecha real de pago
        '<div>'+
          '<label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:5px">Fecha de pago *</label>'+
          '<input id="pfl-fecha" type="date" value="'+(s.fechaPagoReal||new Date().toISOString().slice(0,10))+'" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;box-sizing:border-box">'+
        '</div>'+

        // Método de pago
        '<div>'+
          '<label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:5px">Método de pago</label>'+
          '<select id="pfl-metodo" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;box-sizing:border-box">'+
            '<option value="Transferencia">Transferencia bancaria</option>'+
            '<option value="Cheque">Cheque</option>'+
            '<option value="Efectivo">Efectivo</option>'+
            '<option value="Tarjeta">Tarjeta corporativa</option>'+
            '<option value="SPEI">SPEI</option>'+
          '</select>'+
        '</div>'+

        // Comprobante
        '<div>'+
          '<label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:5px">Comprobante (PDF o imagen) *</label>'+
          '<label style="display:flex;align-items:center;gap:8px;padding:11px 14px;background:#F8FAFD;border:2px dashed #CBD5E1;border-radius:9px;cursor:pointer;transition:.15s" onmouseover="this.style.borderColor=\'#0891b2\'" onmouseout="this.style.borderColor=\'#CBD5E1\'">'+
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'+
            '<span id="pfl-file-label" style="font-size:12px;font-weight:700;color:#475569">'+(s.comprobantePago?'Comprobante ya subido — clic para reemplazar':'Seleccionar archivo (PDF, JPG, PNG)')+'</span>'+
            '<input type="file" id="pfl-file" accept="image/*,.pdf" style="display:none" onchange="window._pflPreviewFile(this)">'+
          '</label>'+
          '<div id="pfl-file-preview" style="margin-top:6px"></div>'+
        '</div>'+

        // Notas
        '<div>'+
          '<label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:5px">Notas adicionales</label>'+
          '<textarea id="pfl-notas" rows="2" placeholder="Observaciones, número de transferencia, banco..." style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:12px;resize:vertical;box-sizing:border-box">'+(s.notasPago||'')+'</textarea>'+
        '</div>'+

        // Botones
        '<div style="display:flex;gap:8px;margin-top:4px">'+
          '<button onclick="this.closest(\'.fl-ov\').remove()" style="flex:1;padding:11px;background:#F1F5F9;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;color:#475569">Cancelar</button>'+
          '<button id="pfl-save-btn" onclick="window._pflGuardarPago(\''+solId+'\')" style="flex:2;padding:11px;background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer">💾 Confirmar pago</button>'+
        '</div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
};

// Preview del archivo seleccionado
window._pflPreviewFile = function(input){
  const f = input.files[0];
  const lbl = document.getElementById('pfl-file-label');
  const prev = document.getElementById('pfl-file-preview');
  if(!f) return;
  if(lbl) lbl.textContent = f.name+' ('+Math.round(f.size/1024)+'KB)';
  if(prev){
    if(f.type.startsWith('image/')){
      const url = URL.createObjectURL(f);
      prev.innerHTML = '<img src="'+url+'" style="max-width:100%;max-height:120px;border-radius:8px;border:1.5px solid #E2E8F0;margin-top:4px">';
    } else {
      prev.innerHTML = '<div style="background:#EFF6FF;border-radius:8px;padding:8px 12px;font-size:11px;font-weight:700;color:#1D4ED8;margin-top:4px">📄 '+f.name+'</div>';
    }
  }
};

// Guardar pago en Firestore
window._pflGuardarPago = async function(solId){
  const btn = document.getElementById('pfl-save-btn');
  const monto   = document.getElementById('pfl-monto')?.value?.trim();
  const factura = document.getElementById('pfl-factura')?.value?.trim();
  const fecha   = document.getElementById('pfl-fecha')?.value;
  const metodo  = document.getElementById('pfl-metodo')?.value;
  const notas   = document.getElementById('pfl-notas')?.value?.trim();
  const fileInp = document.getElementById('pfl-file');
  const file    = fileInp?.files?.[0];

  if(!monto)  { alert('El monto es obligatorio'); return; }
  if(!fecha)  { alert('La fecha de pago es obligatoria'); return; }

  if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }

  try {
    const { db, fs, auth } = await _getDB();
    const yo = auth.currentUser?.email || '';

    // Convertir archivo a base64
    let comprobanteB64 = '';
    const s = _flSolsPago.find(x=>x.id===solId);
    comprobanteB64 = s?.comprobantePago || '';

    if(file){
      comprobanteB64 = await new Promise((res,rej)=>{
        const reader = new FileReader();
        reader.onload = ()=>res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
    }

    if(!comprobanteB64){ alert('Debes subir el comprobante de pago'); if(btn){btn.disabled=false;btn.textContent='💾 Confirmar pago';} return; }

    // Actualizar la solicitud en flotilla_solicitudes
    await fs.updateDoc(fs.doc(db,'flotilla_solicitudes',solId),{
      estatus:          'Cierre',
      montoPagado:      parseFloat(monto)||0,
      facturaNum:       factura||'',
      fechaPagoReal:    fecha,
      metodoPago:       metodo||'Transferencia',
      notasPago:        notas||'',
      comprobantePago:  comprobanteB64,
      pagadoPor:        yo,
      pagadoEn:         new Date().toISOString(),
      actualizadoEn:    new Date().toISOString(),
    });

    // Notificar a Fátima y al solicitante
    const nots = [];
    if(s?.creadoPor){
      nots.push(window.tcNotificar2(fs, db,{
        solicitudId: solId,
        para:        s.creadoPor,
        vehiculoEco: s.vehiculoEco||'—',
        tipo:        'pagado',
        mensaje:     'El pago de tu solicitud (ECO '+(s.vehiculoEco||'—')+') fue procesado por Pagos · $'+Number(monto).toLocaleString('es-MX'),
        leido:       false,
        creadaEn:    new Date().toISOString(),
      }));
    }
    nots.push(window.tcNotificar2(fs, db,{
      solicitudId: solId,
      para:        'flotilla@tecnocontrol.com.mx',
      vehiculoEco: s?.vehiculoEco||'—',
      tipo:        'pagado',
      mensaje:     'Pago registrado por '+yo+' — ECO '+(s?.vehiculoEco||'—')+' · $'+Number(monto).toLocaleString('es-MX')+' · '+metodo,
      leido:       false,
      creadaEn:    new Date().toISOString(),
    }));
    await Promise.all(nots);

    document.querySelector('.fl-ov')?.remove();
    if(window.mostrarPush) window.mostrarPush('✅ Pago registrado','La solicitud pasó a Cierre y se notificó a Flotilla','💳');
    // Refrescar bandeja
    await renderBandejaFlotilla();
  } catch(e){
    alert('Error al guardar: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='💾 Confirmar pago'; }
  }
};

// Modal comentarios de ida y vuelta
window._pflComentarios = async function(solId){
  const s = _flSolsPago.find(x=>x.id===solId);
  if(!s) return;

  const { auth } = await _getDB();
  const yo = auth.currentUser?.email || '';
  const yoNombre = auth.currentUser?.displayName || yo;

  const ov = document.createElement('div');
  ov.className = 'fl-ov';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:4000;display:flex;align-items:center;justify-content:center;padding:16px';

  const renderComts = (comts) =>
    (!comts.length?
      '<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">Sin comentarios — sé el primero</div>'
    :
      comts.map(c=>
        '<div style="background:'+(c.autorEmail===yo?'#EFF6FF':'#F8FAFD')+';border-radius:10px;padding:10px 12px;margin-bottom:7px;border:1px solid '+(c.autorEmail===yo?'#BFDBFE':'#E8EDF5')+'">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
            '<span style="font-size:10px;font-weight:800;color:#1D4ED8">'+c.autor+'</span>'+
            '<span style="font-size:9px;color:#94A3B8">'+(c.fecha?c.fecha.slice(0,10):'')+'</span>'+
          '</div>'+
          '<div style="font-size:13px;color:#0A1628;line-height:1.4">'+c.texto+'</div>'+
        '</div>'
      ).join('')
    );

  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.2)">'+
      '<div style="padding:18px 20px 14px;border-bottom:1.5px solid #F1F5F9;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">'+
        '<div>'+
          '<div style="font-size:15px;font-weight:900;color:#0A1628">Comentarios · Pagos ↔ Flotilla</div>'+
          '<div style="font-size:11px;color:#64748B;margin-top:2px">ECO '+(s.vehiculoEco||'—')+' · '+(s.tipo||'—')+'</div>'+
        '</div>'+
        '<button onclick="this.closest(\'.fl-ov\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8">✕</button>'+
      '</div>'+
      '<div id="pfl-comts-lista" style="flex:1;overflow-y:auto;padding:16px 20px">'+
        renderComts(s.comentariosPagos||[])+
      '</div>'+
      '<div style="padding:14px 20px;border-top:1.5px solid #F1F5F9;flex-shrink:0">'+
        '<div style="display:flex;gap:8px">'+
          '<input id="pfl-comt-inp" placeholder="Escribe un comentario para Flotilla…" style="flex:1;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:12px" onkeydown="if(event.key===\'Enter\')window._pflEnviarComt(\''+solId+'\')">'+
          '<button onclick="window._pflEnviarComt(\''+solId+'\')" style="padding:10px 16px;background:#7C3AED;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Enviar</button>'+
        '</div>'+
      '</div>'+
    '</div>';

  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
};

// Enviar comentario
window._pflEnviarComt = async function(solId){
  const inp  = document.getElementById('pfl-comt-inp');
  const texto= inp?.value?.trim();
  if(!texto) return;

  try {
    const { db, fs, auth } = await _getDB();
    const yo       = auth.currentUser?.email || '';
    const yoNombre = auth.currentUser?.displayName || yo;
    const s        = _flSolsPago.find(x=>x.id===solId);

    const comentariosPagos = [...(s?.comentariosPagos||[]),{
      texto,
      autor:      yoNombre,
      autorEmail: yo,
      fecha:      new Date().toISOString(),
    }];

    await fs.updateDoc(fs.doc(db,'flotilla_solicitudes',solId),{
      comentariosPagos,
      actualizadoEn: new Date().toISOString(),
    });

    // Notificar a Fátima (Flotilla) que Pagos comentó
    await window.tcNotificar2(fs, db,{
      solicitudId: solId,
      para:        'flotilla@tecnocontrol.com.mx',
      vehiculoEco: s?.vehiculoEco||'—',
      tipo:        'comentario',
      mensaje:     'Pagos comentó en solicitud ECO '+(s?.vehiculoEco||'—')+': "'+texto.slice(0,80)+'"',
      leido:       false,
      creadaEn:    new Date().toISOString(),
    });

    // Actualizar cache local y UI
    if(s) s.comentariosPagos = comentariosPagos;
    inp.value = '';
    const lista = document.getElementById('pfl-comts-lista');
    if(lista){
      lista.innerHTML = comentariosPagos.map(c=>
        '<div style="background:'+(c.autorEmail===yo?'#EFF6FF':'#F8FAFD')+';border-radius:10px;padding:10px 12px;margin-bottom:7px;border:1px solid '+(c.autorEmail===yo?'#BFDBFE':'#E8EDF5')+'">'+
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'+
            '<span style="font-size:10px;font-weight:800;color:#1D4ED8">'+c.autor+'</span>'+
            '<span style="font-size:9px;color:#94A3B8">'+(c.fecha?c.fecha.slice(0,10):'')+'</span>'+
          '</div>'+
          '<div style="font-size:13px;color:#0A1628;line-height:1.4">'+c.texto+'</div>'+
        '</div>'
      ).join('');
      lista.scrollTop = lista.scrollHeight;
    }
  } catch(e){ alert('Error: '+e.message); }
};

// Ver solicitud en Flotilla (abre el portal de Flotilla)
window._pflVerSol = function(solId){
  if(window.verArea) window.verArea('Flotilla');
  setTimeout(()=>{ if(window.flVerSol) window.flVerSol(solId); }, 600);
};

// Hook en verArea — inyectar bandeja al entrar a Pagos
const _CHECK_PFL = setInterval(()=>{
  if(typeof window.verArea !== 'function') return;
  clearInterval(_CHECK_PFL);
  const _origPfl = window.verArea;
  window.verArea = function(area, btn){
    _origPfl(area, btn);
    // Inyectar el HTML de la bandeja la primera vez
    // 29-oct-2026: desactivado; Flotilla vive ahora como pestaña del tablero nuevo de Pagos.
    if(false && area === 'Pagos'){
      let cont = document.getElementById('pfl-cont');
      if(!cont){
        cont = document.createElement('div');
        cont.id = 'pfl-cont';
        cont.style.cssText = 'margin-bottom:28px';
        cont.innerHTML =
          '<div style="border-radius:14px;border:2px solid #0891b2;overflow:hidden;background:#fff;box-shadow:0 4px 20px rgba(8,145,178,.1)">'+
            // Header de la sección
            '<div style="background:linear-gradient(135deg,#0891b2,#0e7490);padding:16px 20px;display:flex;align-items:center;justify-content:space-between">'+
              '<div>'+
                '<div style="font-size:15px;font-weight:900;color:#fff;display:flex;align-items:center;gap:8px">'+
                  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>'+
                  'Flotilla — Pagos Pendientes'+
                '</div>'+
                '<div style="font-size:10px;color:rgba(255,255,255,.75);margin-top:2px">Solicitudes autorizadas en espera de comprobante</div>'+
              '</div>'+
              '<button onclick="renderBandejaFlotilla()" style="padding:6px 12px;background:rgba(255,255,255,.15);border:1.5px solid rgba(255,255,255,.3);border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;color:#fff;cursor:pointer">↺ Actualizar</button>'+
            '</div>'+
            '<div id="pfl-bandeja" style="padding:16px 18px;min-height:80px">Cargando...</div>'+
          '</div>';
        // Insertar ANTES del dashboard de pagos existente
        const dash = document.getElementById('pagos-dashboard');
        if(dash && dash.parentNode){
          dash.parentNode.insertBefore(cont, dash);
        } else {
          const areaContent = document.getElementById('area-content') || document.querySelector('.area-content') || document.body;
          areaContent.prepend(cont);
        }
      }
      renderBandejaFlotilla();
    }
  };
}, 150);

console.log('[PAGOS FLOTILLA] ✅ Bandeja de pagos flotilla cargada');
})();

// ══════════════════════════════════════════════════════════════════════
// PAGOS Y CONTABILIDAD · VIÁTICOS (v2, 29-oct-2026)
//  Diseño tipo tablero (tarjetas de alerta arriba, selector de mes, filtros, exportar a Excel,
//  lista y calendario). Al hacer clic en cualquier viático se abre su ficha completa.
//  · Pagos: viáticos por depositar, viático extra autorizado por depositar y pagados del mes.
//    Al registrar el depósito con su evidencia, se avisa al técnico y pasa a Contabilidad.
//  · Contabilidad: seguimiento de comprobación de lo pagado (los tableros anteriores se ocultan).
//  Tablas: ops_solicitudes_viaticos, ops_viaticos_comprobantes, ops_viaticos_extra (Supabase).
// ══════════════════════════════════════════════════════════════════════
(function(){
'use strict';
if (window.__tcViaPagos2) return; window.__tcViaPagos2 = true;
const SB_URL='https://vlbyjoqessxcmkejcujp.supabase.co', SB_KEY='sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
let _c=null,_cp=null;
function sb(){ if(window.tcSupabase) return Promise.resolve(window.tcSupabase); if(_c) return Promise.resolve(_c); if(_cp) return _cp;
  _cp=import('https://esm.sh/@supabase/supabase-js@2').then(m=>{_c=m.createClient(SB_URL,SB_KEY);return _c;}).catch(e=>{_cp=null;throw e;}); return _cp; }
const BUCKET='viaticos-comprobantes';
const FORMAS={ tarjeta_nomina:'Tarjeta de nómina (débito)', efectivo:'Efectivo' };
const CATS={ alimentos:'Alimentos', hospedaje:'Hospedaje', gasolina:'Gasolina', casetas:'Casetas', transporte:'Transporte', otros:'Otros' };
const COLS='id,folio,estatus,solicitante_email,solicitante_nombre,folio_servicio,cliente,destino,motivo,fecha_salida,fecha_regreso,dias,personas,integrantes,km_sencillo,tipo_vehiculo,vehiculo,rendimiento,precio_litro,factor,gasolina,desayunos,comidas,cenas,alimentos,hospedaje,casetas,otros,total,notas,comentario_pagos,tarifas,creado_en,actualizado_en,actualizado_por,forma_entrega,monto_entregado,entregado_en,entregado_por,responsable_email,responsable_nombre,fecha_limite_comprobacion,cierre,deposito,cobro_cliente,empresa_entrega,empresa_cobra,hotel_modo,hotel_nombre,comprobante_pago_nombre,referencia_pago,pagado_por_nombre,grupo_viaje,rol_viaje,creado_por';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const din=n=>'$'+(Number(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const hoy=()=>iso(new Date());
function sumar(x,n){const d=new Date(x+'T12:00:00');d.setDate(d.getDate()+n);return iso(d);}
const dObj=x=>new Date(String(x).slice(0,10)+'T12:00:00');
const fc=x=>{ if(!x) return '—'; const d=dObj(x); return isNaN(d)?x:d.toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}); };
const fl=x=>{ if(!x) return '—'; const d=dObj(x); return isNaN(d)?x:d.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); };
const fh=x=>{ if(!x) return ''; const d=new Date(x); return isNaN(d)?x:d.toLocaleString('es-MX',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
const MES=m=>new Date(m+'-15T12:00:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'});
const depositoDe=s=>s.deposito!=null?Number(s.deposito):Number(s.total)||0;
const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
let TECS=null;
async function tecnicos(){ if(TECS) return TECS; try{ const c=await sb(); const r=await c.from('ops_docs').select('id:doc_id,nombre:datos->>nombre,correo:datos->>correo,estatus:datos->>estatus').eq('coleccion','ops_tecnicos').limit(1000);
  TECS=(r.data||[]).filter(t=>t.nombre&&(t.estatus||'activo')!=='baja').sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es')); }catch(e){ TECS=[]; } return TECS; }
function yo(){ const u=(window.auth&&window.auth.currentUser)||{}; const correo=String(u.email||'').toLowerCase(); const t=(TECS||[]).find(x=>String(x.correo||'').toLowerCase()===correo); return { correo, nombre:(t&&t.nombre)||u.displayName||correo }; }
async function avisoPortal(para,tipo,mensaje,datos){ if(!/@/.test(String(para||''))) return; try{ const c=await sb(); await c.from('portal_notificaciones').insert({tipo,para:String(para).toLowerCase(),mensaje,datos:Object.assign({modulo:'Viáticos'},datos||{})}); }catch(e){} }
async function avisoApp(para,tipo,mensaje,s){ if(!/@/.test(String(para||''))) return false; try{ const c=await sb(); const r=await c.from('ops_notificaciones').insert({id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),tipo,para:String(para).toLowerCase(),mensaje,folio:s.folio||null,solicitud_id:String(s.id),leida:false,fecha:new Date().toISOString()}); return !r.error; }catch(e){ return false; } }
async function destinatarios(ev,def){ try{ const c=await sb(); const r=await c.from('notif_matriz').select('destinatarios,activo').eq('evento',ev).maybeSingle(); if(r.data&&r.data.activo!==false&&(r.data.destinatarios||[]).length) return r.data.destinatarios; }catch(e){} return def; }
function toast(t){ if(window.mostrarToast) window.mostrarToast('Viáticos',t,'✅'); }
function csv(nombre,filas){ const e=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"'; const txt='\ufeff'+filas.map(r=>r.map(e).join(',')).join('\r\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})); a.download=nombre+'_'+hoy()+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }

// ───────────── Estilo (tablero claro, tarjetas, chips pastel) ─────────────
const IC={
  alerta:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  flecha:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  buscar:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  cal:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  lista:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  exp:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  nota:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/></svg>',
  dinero:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>',
  reloj:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  rayo:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9z"/></svg>',
  ok:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
  doc:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  persona:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
  ruta:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  cerrar:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};
function css(){ if(document.getElementById('vp2-css')) return; const st=document.createElement('style'); st.id='vp2-css'; st.textContent=`
.vp2{background:#f4f5f7;border-radius:18px;padding:18px;margin-bottom:22px;font-family:inherit;color:#1f2937}
.vp2-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.vp2-t{font-size:22px;font-weight:800;color:#111827;letter-spacing:-.2px}.vp2-s{font-size:12.5px;color:#6b7280;margin-top:2px;max-width:720px}
.vp2-tabs{display:inline-flex;gap:4px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:4px}
.vp2-tab{border:1.5px solid transparent;background:transparent;border-radius:9px;padding:7px 13px;font-size:12.5px;font-weight:700;color:#4b5563;cursor:pointer;font-family:inherit;display:inline-flex;gap:6px;align-items:center}
.vp2-tab.on{border-color:#16a34a;color:#15803d;background:#f0fdf4}.vp2-tab b{background:#e5e7eb;color:#374151;border-radius:99px;padding:0 7px;font-size:11px}.vp2-tab.on b{background:#16a34a;color:#fff}
.vp2-sec{font-size:14px;font-weight:800;color:#111827;margin:4px 0 10px}
.vp2-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px}
.vp2-card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;cursor:pointer;transition:box-shadow .15s}.vp2-card:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
.vp2-card .top{display:flex;justify-content:space-between;align-items:center;gap:8px}.vp2-card .ico{width:32px;height:32px;border-radius:9px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#374151}
.vp2-card .warn{font-size:11px;font-weight:700;display:inline-flex;gap:4px;align-items:center}.vp2-card .num{font-size:26px;font-weight:800;margin:10px 0 2px;color:#111827}
.vp2-card .lbl{display:flex;justify-content:space-between;align-items:center;font-size:12.5px;color:#4b5563;font-weight:600}
.vp2-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.vp2-ib{width:38px;height:38px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:#374151}
.vp2-mes{display:inline-flex;align-items:center;border:1px solid #e5e7eb;background:#fff;border-radius:10px;height:38px}.vp2-mes button{border:none;background:none;width:34px;height:36px;cursor:pointer;font-size:16px;color:#374151}
.vp2-mes span{display:inline-flex;gap:7px;align-items:center;padding:0 10px;font-size:13px;font-weight:700;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;height:100%;text-transform:capitalize;min-width:150px;justify-content:center}
.vp2-in{height:38px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:0 12px;font-size:13px;font-family:inherit;color:#111827}
.vp2-btn{height:38px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;padding:0 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;gap:7px;align-items:center;color:#374151}
.vp2-btn.pri{background:#16a34a;border-color:#16a34a;color:#fff}.vp2-btn.dark{background:#111827;border-color:#111827;color:#fff}
.vp2-seg{display:inline-flex;border:1px solid #e5e7eb;background:#fff;border-radius:10px;overflow:hidden}.vp2-seg button{border:none;background:none;height:36px;width:40px;cursor:pointer;color:#9ca3af}.vp2-seg button.on{background:#f3f4f6;color:#111827}
.vp2-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.vp2-chip{border:1px solid #e5e7eb;background:#fff;border-radius:99px;padding:5px 12px;font-size:12px;font-weight:700;color:#4b5563;cursor:pointer;font-family:inherit}.vp2-chip.on{background:#111827;border-color:#111827;color:#fff}
.vp2-row{display:grid;grid-template-columns:minmax(200px,1.5fr) 150px minmax(150px,1fr) minmax(160px,1.1fr) 130px 110px;gap:14px;align-items:center;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;margin-bottom:9px;cursor:pointer;transition:box-shadow .15s}
.vp2-row:hover{box-shadow:0 4px 16px rgba(0,0,0,.07)}
@media(max-width:1100px){.vp2-row{grid-template-columns:1fr 1fr;}}
.vp2-name{font-size:14px;font-weight:800;color:#111827}.vp2-meta{font-size:11.5px;color:#6b7280;display:flex;gap:10px;flex-wrap:wrap;margin-top:3px}.vp2-meta span{display:inline-flex;gap:3px;align-items:center}
.vp2-pill{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:4px 10px;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid transparent}
.vp2-pill i{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block}
.vp2-dates{display:flex;align-items:center;gap:8px;color:#111827}.vp2-dates b{font-size:20px;font-weight:800;display:block;line-height:1}.vp2-dates small{font-size:11px;color:#6b7280}
.vp2-k{font-size:10px;font-weight:800;color:#9ca3af;text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px}
.vp2-v{font-size:12.5px;color:#374151;font-weight:600}
.vp2-saldo{font-size:15px;font-weight:800;display:flex;gap:6px;align-items:center}.vp2-saldo i{width:7px;height:7px;border-radius:50%;display:inline-block}
.vp2-note{font-size:12px;font-weight:700;color:#374151;display:inline-flex;gap:5px;align-items:center;border:none;background:none;cursor:pointer;font-family:inherit}
.vp2-empty{background:#fff;border:1px dashed #d1d5db;border-radius:14px;padding:30px;text-align:center;color:#9ca3af;font-size:13px}
.vp2-calw{display:grid;grid-template-columns:240px 1fr;gap:14px}@media(max-width:1000px){.vp2-calw{grid-template-columns:1fr}}
.vp2-side{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px}
.vp2-mini{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:11.5px}.vp2-mini div{padding:5px 0;border-radius:99px;cursor:pointer;position:relative}
.vp2-mini .h{color:#9ca3af;font-weight:700;cursor:default}.vp2-mini .o{color:#d1d5db}.vp2-mini .sel{background:#15803d;color:#fff;font-weight:800}.vp2-mini .wk{background:#f0fdf4}
.vp2-mini .dot::after{content:'';position:absolute;bottom:1px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#16a34a}
.vp2-leg label{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#374151;padding:4px 0;cursor:pointer}.vp2-leg input{accent-color:#15803d;width:15px;height:15px}
.vp2-cal{background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden}
.vp2-gh{display:grid;grid-template-columns:repeat(7,1fr);border-bottom:1px solid #e5e7eb}.vp2-gh div{padding:9px 10px;font-size:11.5px;color:#6b7280;font-weight:700;text-align:center}
.vp2-gh div.hoy{background:#f0fdf4;color:#15803d}.vp2-gh b{display:block;font-size:17px;color:#111827}.vp2-gh .hoy b{color:#15803d}
.vp2-gw{display:grid;grid-template-columns:repeat(7,1fr);min-height:380px}.vp2-gw>div{border-right:1px solid #f3f4f6;padding:8px 6px;display:flex;flex-direction:column;gap:7px}.vp2-gw>div.hoy{background:#fafffb}
.vp2-gm{display:grid;grid-template-columns:repeat(7,1fr)}.vp2-gm>div{border-right:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;min-height:104px;padding:5px;display:flex;flex-direction:column;gap:4px}
.vp2-gm .dn{font-size:11.5px;font-weight:700;color:#6b7280}.vp2-gm .o{background:#fafafa}.vp2-gm .o .dn{color:#d1d5db}.vp2-gm .hoy .dn{background:#15803d;color:#fff;border-radius:99px;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center}
.vp2-ev{border:1.5px solid var(--c);border-radius:10px;padding:7px 8px;background:#fff;cursor:pointer;font-size:11.5px;line-height:1.3}
.vp2-ev b{display:block;color:#111827;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vp2-ev span{color:#6b7280;font-size:10.5px}
.vp2-ev.m{padding:3px 6px;border-radius:7px;border-width:1px;border-left:4px solid var(--c);font-size:10.5px}.vp2-ev.m b{font-size:10.5px}
.vp2-mas{font-size:10.5px;color:#15803d;font-weight:800;cursor:pointer}
.vp2-mod{position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px}
.vp2-box{background:#fff;border-radius:18px;width:860px;max-width:97vw;max-height:94vh;overflow-y:auto;padding:22px 24px}
.vp2-box.sm{width:560px}
.vp2-gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin:12px 0}
.vp2-f{background:#f9fafb;border-radius:12px;padding:10px 12px}.vp2-f .vp2-v{font-size:13px}
.vp2-tb{width:100%;border-collapse:collapse;font-size:12.5px}.vp2-tb td{padding:7px 8px;border-bottom:1px solid #f3f4f6}.vp2-tb td:last-child{text-align:right;font-weight:700}
.vp2-tl{border-left:2px solid #e5e7eb;margin-left:6px;padding-left:14px}.vp2-tl div{position:relative;font-size:12px;color:#374151;padding:4px 0 8px}.vp2-tl div::before{content:'';position:absolute;left:-20px;top:8px;width:10px;height:10px;border-radius:50%;background:var(--c,#9ca3af)}
.vp2-lb{font-size:11.5px;font-weight:700;color:#4b5563}.vp2-fi{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:10px;padding:9px 11px;font-size:13px;margin:4px 0 11px;font-family:inherit}
`; document.head.appendChild(st); }
function pill(t,c,bg){ return '<span class="vp2-pill" style="color:'+c+';background:'+bg+'"><i></i>'+esc(t)+'</span>'; }
function card(o){ return '<div class="vp2-card" onclick="'+(o.fn||'')+'"><div class="top"><div class="ico">'+o.ico+'</div>'+(o.warn?'<span class="warn" style="color:'+(o.wc||'#ea580c')+'">'+IC.alerta+esc(o.warn)+'</span>':'')+'</div>'+
  '<div class="num" style="color:'+(o.nc||'#111827')+'">'+o.num+'</div><div class="lbl"><span>'+esc(o.lbl)+'</span>'+IC.flecha+'</div></div>'; }
function modal(html,sm){ let m=document.getElementById('vp2-modal'); if(!m){ m=document.createElement('div'); m.id='vp2-modal'; document.body.appendChild(m); }
  m.innerHTML=html?'<div class="vp2-mod" onclick="if(event.target===this)window.__vp2Cerrar()"><div class="vp2-box'+(sm?' sm':'')+'">'+html+'</div></div>':''; }
window.__vp2Cerrar=()=>modal('');
function abrirDato(d){ const w=window.open('','_blank'); if(!w){ alert('Permite ventanas emergentes.'); return; } const pdf=/^data:application\/pdf/.test(d||'');
  w.document.write('<body style="margin:0;background:#222">'+(pdf?'<iframe src="'+d+'" style="border:0;width:100vw;height:100vh"></iframe>':'<img src="'+d+'" style="max-width:100%;display:block;margin:auto">')+'</body>'); w.document.close(); }
window.__vp2Archivo=async function(ruta){ const w=window.open('','_blank'); try{ const c=await sb(); const r=await c.storage.from(BUCKET).createSignedUrl(ruta,600); if(r.error) throw r.error; if(w) w.location.href=r.data.signedUrl; }catch(e){ if(w) w.close(); alert('No se pudo abrir: '+(e.message||e)); } };
window.__vp2VerDeposito=async function(id){ try{ const c=await sb(); const r=await c.from('ops_solicitudes_viaticos').select('comprobante_pago').eq('id',id).single(); if(r.error||!r.data.comprobante_pago){ alert('Este pago no tiene evidencia guardada.'); return; } abrirDato(r.data.comprobante_pago); }catch(e){ alert('No se pudo abrir: '+(e.message||e)); } };

// ───────────── Estados ─────────────
function estPagos(s){ const H=hoy(); if(s.estatus==='Pagada') return {k:'pagado',t:'Pagado',c:'#15803d',bg:'#dcfce7'}; if(s.estatus==='Cancelada') return {k:'cancelado',t:'Cancelado',c:'#9a3412',bg:'#ffedd5'};
  if(!s.fecha_salida) return {k:'futuro',t:'Sin fecha',c:'#475569',bg:'#f1f5f9'}; if(s.fecha_salida<H) return {k:'atrasado',t:'Ya salió · sin depósito',c:'#b91c1c',bg:'#fee2e2'};
  if(s.fecha_salida===H) return {k:'hoy',t:'Sale hoy',c:'#c2410c',bg:'#ffedd5'}; if(s.fecha_salida<=sumar(H,7)) return {k:'semana',t:'Sale esta semana',c:'#a16207',bg:'#fef9c3'}; return {k:'futuro',t:'Por depositar',c:'#1d4ed8',bg:'#dbeafe'}; }
const COMPS={};
function estConta(s){ const comps=(COMPS[s.id]||[]).filter(x=>x.estatus!=='Rechazado'); const comprobado=comps.reduce((a,x)=>a+(Number(x.total)||0),0);
  const dep=s.monto_entregado!=null?Number(s.monto_entregado):depositoDe(s), falta=Math.max(0,Math.round((dep-comprobado)*100)/100), porRev=comps.filter(x=>x.estatus==='Por revisar').length;
  const base={dep,comprobado,falta,porRev,n:comps.length};
  if(s.cierre) return Object.assign(base,{k:'cerrado',t:'Cerrado',c:'#15803d',bg:'#dcfce7'});
  if(falta<=0.5&&porRev) return Object.assign(base,{k:'revisar',t:'Comprobado · por revisar',c:'#1d4ed8',bg:'#dbeafe'});
  if(falta<=0.5) return Object.assign(base,{k:'comprobado',t:'Comprobado',c:'#15803d',bg:'#dcfce7'});
  if(s.fecha_limite_comprobacion&&s.fecha_limite_comprobacion<hoy()) return Object.assign(base,{k:'vencido',t:'Vencido sin comprobar',c:'#b91c1c',bg:'#fee2e2'});
  return Object.assign(base,{k:'pend',t:comps.length?'Comprobando '+comps.length+' doc(s)':'Pendiente de comprobar',c:'#a16207',bg:'#fef9c3'}); }

// ───────────── Ficha completa de un viático (Pagos y Contabilidad) ─────────────
window.__vp2Detalle=async function(id,desde){
  modal('<div style="padding:30px;text-align:center;color:#6b7280">Cargando toda la información…</div>');
  try{
    const c=await sb();
    const [r,k,x]=await Promise.all([ c.from('ops_solicitudes_viaticos').select(COLS).eq('id',id).single(),
      c.from('ops_viaticos_comprobantes').select('*').eq('viatico_id',id).order('creado_en',{ascending:true}),
      c.from('ops_viaticos_extra').select('*').eq('viatico_id',id).order('creado_en',{ascending:true}) ]);
    if(r.error) throw r.error; const s=r.data, t=s.tarifas||{}, comps=k.data||[], extras=x.data||[]; COMPS[id]=comps;
    const ep=estPagos(s), ec=s.estatus==='Pagada'?estConta(s):null;
    const f=(k2,v)=>v===''||v==null?'':'<div class="vp2-f"><div class="vp2-k">'+k2+'</div><div class="vp2-v">'+v+'</div></div>';
    const fila=(k2,cant,monto)=>Number(monto)?'<tr><td>'+k2+(cant?' <span style="color:#9ca3af">· '+cant+'</span>':'')+'</td><td>'+din(monto)+'</td></tr>':'';
    const noDep=Math.max(0,(Number(s.total)||0)-depositoDe(s));
    const tl=[]; tl.push(['#6366f1','Solicitado por <b>'+esc(s.solicitante_nombre||s.solicitante_email||'')+'</b> · '+fh(s.creado_en)]);
    extras.forEach(e=>tl.push(['#ea580c','Pidió <b>'+din(e.monto)+'</b> más ('+esc(e.concepto||'')+'): '+esc(e.motivo||'')+' · '+fh(e.creado_en)+' — '+esc(e.estatus)+(e.autorizo?' por '+esc(e.autorizo):'')]));
    if(s.entregado_en) tl.push(['#16a34a','Pagado <b>'+din(s.monto_entregado)+'</b> por '+esc(s.pagado_por_nombre||s.entregado_por||'')+' ('+esc(FORMAS[s.forma_entrega]||s.forma_entrega||'')+(s.referencia_pago?', ref. '+esc(s.referencia_pago):'')+') · '+fh(s.entregado_en)]);
    comps.forEach(cp=>tl.push([cp.estatus==='Aceptado'?'#16a34a':cp.estatus==='Rechazado'?'#dc2626':'#2563eb','Comprobante <b>'+din(cp.total)+'</b> ('+esc(CATS[cp.categoria]||cp.categoria||'')+') subido por '+esc(cp.tecnico_nombre||'')+' · '+fh(cp.creado_en)+' — '+esc(cp.estatus)+(cp.revisado_por?' por '+esc(cp.revisado_por):'')]));
    if(s.cierre) tl.push(['#15803d','Cerrado · '+esc((s.cierre&&(s.cierre.por||s.cierre.cerradoPor))||'')+' '+fh(s.cierre&&(s.cierre.en||s.cierre.fecha))]);
    const bA=(ruta,txt)=>ruta?'<button class="vp2-btn" style="height:30px;font-size:11.5px" onclick="window.__vp2Archivo(\''+esc(ruta)+'\')">'+txt+'</button>':'';
    modal(
      '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><div style="font-size:12px;color:#6b7280;font-weight:700">'+esc(s.folio)+(s.folio_servicio?' · servicio '+esc(s.folio_servicio):'')+'</div>'+
      '<div style="font-size:21px;font-weight:800;color:#111827;margin-top:2px">'+esc(s.integrantes||s.responsable_nombre||s.solicitante_nombre||'')+'</div>'+
      '<div style="font-size:13px;color:#4b5563">'+esc(s.destino||'')+(t.servicioTexto?' · '+esc(t.servicioTexto):'')+'</div></div>'+
      '<div style="display:flex;gap:8px;align-items:center">'+(ec?pill(ec.t,ec.c,ec.bg):pill(ep.t,ep.c,ep.bg))+'<button class="vp2-ib" onclick="window.__vp2Cerrar()">'+IC.cerrar+'</button></div></div>'+
      '<div class="vp2-gr">'+
        f('Sale',fl(s.fecha_salida))+f('Regresa',fl(s.fecha_regreso))+f('Días / personas',(s.dias||'—')+' día(s) · '+(s.personas||'—')+' persona(s)')+
        f('Cliente',esc(s.cliente||''))+f('Empresa que entrega',esc(s.empresa_entrega||''))+f('Empresa a la que se cobra',esc(s.empresa_cobra||s.empresa_entrega||''))+
        f('Pidió',esc(s.solicitante_nombre||s.solicitante_email||''))+f('Responsable de comprobar',esc(s.responsable_nombre||''))+f('Vehículo',esc([s.tipo_vehiculo,s.vehiculo].filter(Boolean).join(' · ')))+
        f('Hotel',esc([s.hotel_nombre,s.hotel_modo].filter(Boolean).join(' · ')))+f('Referencia del cliente',esc(t.refCliente||''))+f('Grupo de viaje',esc([s.grupo_viaje,s.rol_viaje].filter(Boolean).join(' · ')))+
      '</div>'+
      '<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:14px">'+
        '<div><div class="vp2-sec">Desglose del viaje</div><table class="vp2-tb">'+
          fila('Alimentos',[s.desayunos?s.desayunos+' desayuno(s)':'',s.comidas?s.comidas+' comida(s)':'',s.cenas?s.cenas+' cena(s)':''].filter(Boolean).join(', '),s.alimentos)+
          fila('Hospedaje',t.noches?t.noches+' noche(s)':'',s.hospedaje)+
          fila('Gasolina',s.km_sencillo?s.km_sencillo+' km sencillo'+(s.rendimiento?' · '+s.rendimiento+' km/L':'')+(s.precio_litro?' · '+din(s.precio_litro)+'/L':''):'',s.gasolina)+
          fila('Casetas','',s.casetas)+fila('Otros','',s.otros)+
          '<tr><td><b>Costo total del viaje</b></td><td>'+din(s.total)+'</td></tr>'+
          '<tr><td style="color:#15803d"><b>A depositar al técnico</b></td><td style="color:#15803d;font-size:15px">'+din(depositoDe(s))+'</td></tr>'+
          (noDep>0.5?'<tr><td style="color:#9a3412">No se deposita (lo paga la empresa directo)</td><td style="color:#9a3412">'+din(noDep)+'</td></tr>':'')+
          (Number(s.cobro_cliente)?'<tr><td style="color:#1d4ed8">Se cobra al cliente'+(t.noCobrar?' (no aplica)':'')+'</td><td style="color:#1d4ed8">'+din(s.cobro_cliente)+'</td></tr>':'')+
        '</table>'+
        (s.motivo||s.notas||s.comentario_pagos?'<div class="vp2-sec" style="margin-top:14px">Notas</div><div style="font-size:12.5px;color:#374151;line-height:1.55;background:#f9fafb;border-radius:12px;padding:10px 12px">'+
          (s.motivo?'<div><b>Motivo:</b> '+esc(s.motivo)+'</div>':'')+(s.notas?'<div><b>Notas:</b> '+esc(s.notas)+'</div>':'')+(s.comentario_pagos?'<div><b>Pagos:</b> '+esc(s.comentario_pagos)+'</div>':'')+'</div>':'')+
        '</div>'+
        '<div><div class="vp2-sec">Pago y comprobación</div>'+
          (s.entregado_en?'<div class="vp2-f" style="margin-bottom:8px"><div class="vp2-k">Depositado</div><div class="vp2-v" style="font-size:18px;color:#15803d;font-weight:800">'+din(s.monto_entregado)+'</div><div style="font-size:11.5px;color:#6b7280">'+fh(s.entregado_en)+' · '+esc(s.pagado_por_nombre||'')+'<br>'+esc(FORMAS[s.forma_entrega]||s.forma_entrega||'')+(s.referencia_pago?' · ref. '+esc(s.referencia_pago):'')+'</div>'+
            '<button class="vp2-btn" style="height:30px;font-size:11.5px;margin-top:6px" onclick="window.__vp2VerDeposito('+s.id+')">'+IC.doc+' Ver evidencia del depósito</button></div>'
            :'<div class="vp2-f" style="margin-bottom:8px"><div class="vp2-k">Depósito</div><div class="vp2-v" style="color:#b91c1c">Todavía no se deposita</div></div>')+
          (ec?'<div class="vp2-gr" style="grid-template-columns:1fr 1fr 1fr;margin:0 0 8px"><div class="vp2-f"><div class="vp2-k">Comprobado</div><div class="vp2-v" style="color:#15803d">'+din(ec.comprobado)+'</div></div><div class="vp2-f"><div class="vp2-k">Falta</div><div class="vp2-v" style="color:'+(ec.falta>0.5?'#b91c1c':'#15803d')+'">'+din(ec.falta)+'</div></div><div class="vp2-f"><div class="vp2-k">Límite</div><div class="vp2-v">'+fc(s.fecha_limite_comprobacion)+'</div></div></div>':'')+
          (comps.length?comps.map(cp=>{ const arch=((cp.validacion||{}).archivos||[]);
            return '<div style="border:1px solid #e5e7eb;border-radius:12px;padding:9px 11px;margin-bottom:7px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="font-size:12.5px">'+din(cp.total)+' · '+esc(CATS[cp.categoria]||cp.categoria||'')+'</b>'+
              pill(cp.estatus,cp.estatus==='Aceptado'?'#15803d':cp.estatus==='Rechazado'?'#b91c1c':'#1d4ed8',cp.estatus==='Aceptado'?'#dcfce7':cp.estatus==='Rechazado'?'#fee2e2':'#dbeafe')+'</div>'+
              '<div style="font-size:11.5px;color:#6b7280">'+(cp.tipo==='no_deducible'?'Sin factura':'Factura')+' · '+fc(cp.fecha_comprobante)+(cp.emisor_nombre?' · '+esc(cp.emisor_nombre):'')+'</div>'+
              (cp.tipo==='factura_archivo'?'<div style="font-size:11px;color:#7c3aed;font-weight:700">Descargar el XML de esta factura del SAT.</div>':'')+
              (cp.motivo_rechazo?'<div style="font-size:11px;color:#b91c1c">Rechazado: '+esc(cp.motivo_rechazo)+'</div>':'')+
              '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+(arch.length?arch.map((ru,i)=>bA(ru,'Archivo '+(i+1))).join(''):bA(cp.xml_path,'XML')+bA(cp.pdf_path,'PDF')+bA(cp.foto_path,'Foto'))+
              (desde==='conta'&&!s.cierre&&cp.estatus!=='Aceptado'?'<button class="vp2-btn pri" style="height:30px;font-size:11.5px" onclick="window.__vp2Revisar('+cp.id+','+s.id+',\'Aceptado\')">Aceptar</button>':'')+
              (desde==='conta'&&!s.cierre&&cp.estatus!=='Rechazado'?'<button class="vp2-btn" style="height:30px;font-size:11.5px;color:#b91c1c" onclick="window.__vp2Revisar('+cp.id+','+s.id+',\'Rechazado\')">Rechazar</button>':'')+'</div></div>'; }).join('')
            :(s.entregado_en?'<div style="font-size:12px;color:#9ca3af">El técnico todavía no sube comprobantes.</div>':''))+
        '</div></div>'+
      '<div class="vp2-sec" style="margin-top:16px">Historial</div><div class="vp2-tl">'+tl.map(a=>'<div style="--c:'+a[0]+'">'+a[1]+'</div>').join('')+'</div>'+
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">'+
        (desde==='conta'&&s.estatus==='Pagada'&&!s.cierre?'<button class="vp2-btn" style="border-color:#7c3aed;color:#7c3aed" onclick="window.__vp2ComprobarUrgente('+s.id+')">'+IC.doc+' Comprobar por el técnico (urgencia)</button>':'')+
        (desde==='conta'&&ec&&ec.falta>0.5&&s.responsable_email&&!s.cierre?'<button class="vp2-btn dark" onclick="window.__vp2Recordar('+s.id+')">Recordarle al técnico</button>':'')+
        (s.estatus==='Pendiente'&&desde==='pagos'?'<button class="vp2-btn pri" onclick="window.__vp2Deposito('+s.id+')">'+IC.dinero+' Registrar depósito</button>':'')+
        '<button class="vp2-btn" onclick="window.__vp2Cerrar()">Cerrar</button></div>');
  }catch(e){ modal('<div style="padding:20px;color:#b91c1c">No se pudo cargar: '+esc(e.message||e)+'</div><div style="text-align:right"><button class="vp2-btn" onclick="window.__vp2Cerrar()">Cerrar</button></div>',true); }
};

// ───────────── Calendario (compartido) ─────────────
function lunes(x){ const d=dObj(x), w=(d.getDay()+6)%7; d.setDate(d.getDate()-w); return iso(d); }
function calendarioHTML(st, eventos, leyenda, prefijo){
  const H=hoy(), sel=st.dia||H, m=sel.slice(0,7), ini=lunes(m+'-01');
  const porDia={}; eventos.filter(e=>!st.ocultos[e.k]).forEach(e=>{ (porDia[e.d]=porDia[e.d]||[]).push(e); });
  let mini='<div class="vp2-mini">'+['L','M','M','J','V','S','D'].map(x=>'<div class="h">'+x+'</div>').join('');
  const semSel=lunes(sel);
  for(let i=0;i<42;i++){ const d=sumar(ini,i); if(i>=35&&d.slice(0,7)!==m) break; mini+='<div class="'+[d.slice(0,7)!==m?'o':'',d===sel?'sel':(lunes(d)===semSel&&st.vista==='semana'?'wk':''),porDia[d]?'dot':''].join(' ')+'" onclick="window.__vp2Cal(\''+prefijo+'\',\'dia\',\''+d+'\')">'+Number(d.slice(8))+'</div>'; }
  mini+='</div>';
  const side='<div class="vp2-side"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px;text-transform:capitalize">'+MES(m)+'</b><span><button class="vp2-ib" style="width:28px;height:28px" onclick="window.__vp2Cal(\''+prefijo+'\',\'mes\',-1)">‹</button> <button class="vp2-ib" style="width:28px;height:28px" onclick="window.__vp2Cal(\''+prefijo+'\',\'mes\',1)">›</button></span></div>'+mini+
    '<div style="border-top:1px solid #f3f4f6;margin:12px 0 8px"></div><div class="vp2-k">Qué ver</div><div class="vp2-leg">'+leyenda.map(l=>'<label><input type="checkbox" '+(st.ocultos[l.k]?'':'checked')+' onchange="window.__vp2Cal(\''+prefijo+'\',\'ocultar\',\''+l.k+'\')"><span style="width:10px;height:10px;border-radius:3px;background:'+l.c+';display:inline-block"></span>'+esc(l.t)+' <span style="margin-left:auto;color:#9ca3af">'+eventos.filter(e=>e.k===l.k).length+'</span></label>').join('')+'</div></div>';
  let main;
  if(st.vista==='semana'){
    const dias=[]; for(let i=0;i<7;i++) dias.push(sumar(semSel,i));
    main='<div class="vp2-cal"><div class="vp2-gh">'+dias.map(d=>'<div class="'+(d===H?'hoy':'')+'">'+dObj(d).toLocaleDateString('es-MX',{weekday:'short'})+'<b>'+Number(d.slice(8))+'</b></div>').join('')+'</div>'+
      '<div class="vp2-gw">'+dias.map(d=>'<div class="'+(d===H?'hoy':'')+'">'+(porDia[d]||[]).map(e=>'<div class="vp2-ev" style="--c:'+e.c+'" onclick="'+e.fn+'"><b>'+esc(e.t)+'</b><span>'+esc(e.s)+'</span><div style="font-weight:800;color:'+e.c+';margin-top:3px">'+esc(e.m)+'</div></div>').join('')+'</div>').join('')+'</div></div>';
  } else {
    let cel=''; for(let i=0;i<42;i++){ const d=sumar(ini,i); if(i>=35&&d.slice(0,7)!==m) break; const ev=porDia[d]||[];
      cel+='<div class="'+(d.slice(0,7)!==m?'o ':'')+(d===H?'hoy':'')+'"><span class="dn">'+Number(d.slice(8))+'</span>'+ev.slice(0,3).map(e=>'<div class="vp2-ev m" style="--c:'+e.c+'" onclick="'+e.fn+'"><b>'+esc(e.t)+'</b></div>').join('')+(ev.length>3?'<span class="vp2-mas" onclick="window.__vp2Cal(\''+prefijo+'\',\'semanaDe\',\''+d+'\')">+'+(ev.length-3)+' más</span>':'')+'</div>'; }
    main='<div class="vp2-cal"><div class="vp2-gh">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>'<div>'+x+'</div>').join('')+'</div><div class="vp2-gm">'+cel+'</div></div>';
  }
  return '<div class="vp2-bar"><div class="vp2-tabs">'+['semana','mes'].map(v=>'<button class="vp2-tab'+(st.vista===v?' on':'')+'" onclick="window.__vp2Cal(\''+prefijo+'\',\'vista\',\''+v+'\')">'+(v==='semana'?'Semana':'Mes')+'</button>').join('')+'</div>'+
    '<button class="vp2-btn" onclick="window.__vp2Cal(\''+prefijo+'\',\'dia\',\''+H+'\')">Hoy</button><span style="font-size:12.5px;color:#6b7280">Haz clic en cualquier tarjeta para ver toda su información.</span></div>'+
    '<div class="vp2-calw">'+side+main+'</div>';
}
window.__vp2Cal=function(pref,acc,v){ const st=pref==='p'?P:C;
  if(acc==='dia') st.dia=v; else if(acc==='vista') st.vista=v; else if(acc==='semanaDe'){ st.dia=v; st.vista='semana'; }
  else if(acc==='ocultar') st.ocultos[v]=!st.ocultos[v]; else if(acc==='mes'){ const d=dObj((st.dia||hoy()).slice(0,7)+'-01'); d.setMonth(d.getMonth()+v); st.dia=iso(d); }
  (pref==='p'?pintarPagos:pintarConta)(); };

// ═════════════ PAGOS ═════════════
const P={ pend:[], pagados:[], extra:[], fl:null, tab:'lista', filtro:'todos', q:'', empresa:'', mes:hoy().slice(0,7), dia:hoy(), vista:'semana', ocultos:{} };
function contPagos(){ css(); let p=document.getElementById('vp-pagos'); if(p) return p; const dash=document.getElementById('pagos-dashboard'); if(!dash||!dash.parentNode) return null;
  p=document.createElement('div'); p.id='vp-pagos'; dash.parentNode.insertBefore(p,dash); return p; }
async function cargarPagos(){ tecnicos(); const p=contPagos(); if(!p) return; p.style.display='block'; if(!P.pend.length) p.innerHTML='<div class="vp2"><div class="vp2-empty">Cargando…</div></div>';
  try{ const c=await sb(); const desde=sumar(hoy(),-120);
    const [a,b,x]=await Promise.all([ c.from('ops_solicitudes_viaticos').select(COLS).eq('estatus','Pendiente').order('fecha_salida',{ascending:true}).limit(400),
      c.from('ops_solicitudes_viaticos').select(COLS).eq('estatus','Pagada').gte('entregado_en',desde).order('entregado_en',{ascending:false}).limit(400),
      c.from('ops_viaticos_extra').select('*').order('creado_en',{ascending:false}).limit(200) ]);
    if(a.error) throw a.error; P.pend=a.data||[]; P.pagados=b.data||[]; P.extra=x.data||[]; pintarPagos(); cargarFlotilla(); }
  catch(e){ p.innerHTML='<div class="vp2"><div class="vp2-empty" style="color:#b91c1c">No se pudieron cargar los viáticos: '+esc(e.message||e)+'</div></div>'; } }
// ── Flotilla: solicitudes de vehículos que esperan pago (mismos datos y botones que la bandeja anterior) ──
async function cargarFlotilla(){ try{ if(typeof window.__pflCargarDatos!=='function') return; const l=await window.__pflCargarDatos(); P.fl=l; }catch(e){ P.fl=[]; P.flErr=e.message||String(e); } if(document.getElementById('vp-pagos')) pintarPagos(); }
window.__vp2FlRefrescar=()=>cargarFlotilla();
const flMonto=s=>Number((s.cotizacion&&s.cotizacion.monto)||s.monto||s.montoAutorizado||0);
const flTaller=s=>(s.cotizacion&&s.cotizacion.taller)||s.tallerNombre||s.taller||'—';
function flEstado(s){ const x=typeof window.__pflSemaforo==='function'?window.__pflSemaforo(s):{label:'',tipo:''};
  if(x.tipo==='vencida') return {k:'vencida',t:'Vencida '+x.label.replace('VENCIDA ',''),c:'#b91c1c',bg:'#fee2e2'}; if(x.tipo==='hoy') return {k:'hoy',t:'Pagar hoy',c:'#c2410c',bg:'#ffedd5'};
  if(x.tipo==='proxima') return {k:'proxima',t:'Pagar '+x.label.toLowerCase(),c:'#a16207',bg:'#fef9c3'}; return s.fechaPagoProgramada?{k:'futuro',t:'Programado',c:'#1d4ed8',bg:'#dbeafe'}:{k:'sin',t:'Sin fecha de pago',c:'#475569',bg:'#f1f5f9'}; }
window.__vp2FlDetalle=function(id){ const s=(P.fl||[]).find(x=>x.id===id); if(!s) return; const e=flEstado(s);
  const f=(k,v)=>v===''||v==null?'':'<div class="vp2-f"><div class="vp2-k">'+k+'</div><div class="vp2-v">'+v+'</div></div>';
  const coms=(s.comentariosPagos||[]);
  const omit=new Set(['id','comentariosPagos','cotizacion','historial','fotos','adjuntos','evidencias']);
  const extras=Object.keys(s).filter(k=>!omit.has(k)&&['string','number','boolean'].includes(typeof s[k])&&String(s[k]).length<160&&!/^https?:|^data:/.test(String(s[k])));
  modal('<div style="display:flex;justify-content:space-between;gap:12px"><div><div style="font-size:12px;color:#6b7280;font-weight:700">Flotilla · ECO '+esc(s.vehiculoEco||'—')+'</div><div style="font-size:21px;font-weight:800;color:#111827">'+esc(s.tipo||'Servicio')+'</div><div style="font-size:13px;color:#4b5563">'+esc(s.vehiculo||s.unidad||'')+'</div></div>'+
    '<div style="display:flex;gap:8px;align-items:center">'+pill(e.t,e.c,e.bg)+'<button class="vp2-ib" onclick="window.__vp2Cerrar()">'+IC.cerrar+'</button></div></div>'+
    '<div class="vp2-gr">'+f('Monto autorizado','<span style="font-size:18px;color:#15803d;font-weight:800">'+din(flMonto(s))+'</span>')+f('Taller / proveedor',esc(flTaller(s)))+f('Fecha programada de pago',fl(s.fechaPagoProgramada))+
      f('Factura',esc(s.facturaNum||'Pendiente'))+f('Solicitó',esc(s.creadoPorNombre||s.creadoPor||''))+f('Comprobante de pago',s.comprobantePago?'<a href="'+esc(s.comprobantePago)+'" target="_blank" style="color:#2563eb;font-weight:700">Ver comprobante</a>':'Pendiente')+'</div>'+
    (s.cotizacion?'<div class="vp2-sec">Cotización</div><div class="vp2-gr">'+Object.keys(s.cotizacion).filter(k=>['string','number'].includes(typeof s.cotizacion[k])&&!/^https?:|^data:/.test(String(s.cotizacion[k]))).map(k=>f(esc(k),esc(s.cotizacion[k]))).join('')+'</div>':'')+
    '<div class="vp2-sec">Comentarios con Pagos ('+coms.length+')</div>'+(coms.length?'<div class="vp2-tl">'+coms.map(c=>'<div style="--c:#7c3aed"><b>'+esc(c.autor||'')+'</b> · '+esc(String(c.fecha||'').slice(0,16).replace('T',' '))+'<br>'+esc(c.texto||'')+'</div>').join('')+'</div>':'<div style="font-size:12px;color:#9ca3af">Sin comentarios.</div>')+
    '<details style="margin-top:12px"><summary style="font-size:12px;color:#6b7280;cursor:pointer;font-weight:700">Todos los datos de la solicitud</summary><div class="vp2-gr">'+extras.map(k=>f(esc(k),esc(s[k]))).join('')+'</div></details>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap"><button class="vp2-btn" onclick="window.__vp2Cerrar();window._pflVerSol&&window._pflVerSol(\''+s.id+'\')">Abrir en Flotilla</button>'+
    '<button class="vp2-btn" onclick="window.__vp2Cerrar();window._pflComentarios&&window._pflComentarios(\''+s.id+'\')">Comentarios</button>'+
    '<button class="vp2-btn pri" onclick="window.__vp2Cerrar();window._pflRegistrarPago&&window._pflRegistrarPago(\''+s.id+'\')">'+IC.dinero+(s.comprobantePago?' Actualizar pago':' Registrar pago')+'</button></div>'); };
function filaViatico(s,e,derecha,fn){ const t=s.tarifas||{}; const mismo=s.fecha_salida===s.fecha_regreso;
  return '<div class="vp2-row" onclick="'+fn+'"><div><div class="vp2-name">'+esc(s.integrantes||s.solicitante_nombre||'')+'</div><div class="vp2-meta"><span>'+esc(s.folio)+'</span><span>'+IC.persona+(s.personas||1)+'</span><span>'+esc(s.empresa_entrega||'')+'</span></div></div>'+
    '<div>'+pill(e.t,e.c,e.bg)+'</div>'+
    '<div class="vp2-dates"><div><b>'+(s.fecha_salida?Number(s.fecha_salida.slice(8)):'—')+'</b><small>'+(s.fecha_salida?dObj(s.fecha_salida).toLocaleDateString('es-MX',{month:'short'}):'')+'</small></div>'+(mismo?'':'<span style="color:#9ca3af">'+IC.ruta+'</span><div><b>'+(s.fecha_regreso?Number(s.fecha_regreso.slice(8)):'—')+'</b><small>'+(s.fecha_regreso?dObj(s.fecha_regreso).toLocaleDateString('es-MX',{month:'short'}):'')+'</small></div>')+'</div>'+
    '<div><div class="vp2-k">Destino</div><div class="vp2-v" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(s.destino||'—')+'</div><div style="font-size:11px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(t.servicioTexto||s.cliente||'')+'</div></div>'+
    derecha+'<div><button class="vp2-note" onclick="event.stopPropagation();'+fn+'">'+IC.nota+' Ver todo</button></div></div>'; }
function pintarPagos(){ const p=contPagos(); if(!p) return; const H=hoy(), q=norm(P.q);
  const E=s=>estPagos(s), tot=a=>a.reduce((x,s)=>x+depositoDe(s),0);
  const atras=P.pend.filter(s=>E(s).k==='atrasado'||E(s).k==='hoy'), sem=P.pend.filter(s=>E(s).k==='semana'), extraAut=P.extra.filter(x=>x.estatus==='Autorizada'), extraPend=P.extra.filter(x=>x.estatus==='Pendiente');
  const pagMes=P.pagados.filter(s=>String(s.entregado_en||'').slice(0,7)===P.mes);
  const empresas=[...new Set(P.pend.concat(P.pagados).map(s=>s.empresa_entrega).filter(Boolean))].sort();
  const pasa=s=>(!P.empresa||s.empresa_entrega===P.empresa)&&(!q||norm([s.folio,s.integrantes,s.destino,s.cliente,s.solicitante_nombre,s.empresa_entrega,s.referencia_pago,(s.tarifas||{}).servicioTexto].join(' ')).includes(q));
  let cuerpo='';
  if(P.tab==='lista'){
    const f=P.filtro; const l=P.pend.filter(s=>pasa(s)&&(f==='todos'||(f==='atrasado'&&(E(s).k==='atrasado'||E(s).k==='hoy'))||(f==='semana'&&E(s).k==='semana')||(f==='futuro'&&E(s).k==='futuro')));
    const chip=(k,t,n)=>'<button class="vp2-chip'+(P.filtro===k?' on':'')+'" onclick="window.__vp2P(\'filtro\',\''+k+'\')">'+t+' ('+n+')</button>';
    cuerpo='<div class="vp2-chips">'+chip('todos','Todos',P.pend.filter(pasa).length)+chip('atrasado','Ya salieron / hoy',atras.filter(pasa).length)+chip('semana','Esta semana',sem.filter(pasa).length)+chip('futuro','Más adelante',P.pend.filter(s=>pasa(s)&&E(s).k==='futuro').length)+'</div>'+
      (l.length?l.map(s=>filaViatico(s,E(s),'<div><div class="vp2-k">A depositar</div><div class="vp2-saldo" style="color:'+(E(s).k==='atrasado'?'#dc2626':'#111827')+'"><i style="background:'+E(s).c+'"></i>'+din(depositoDe(s))+'</div></div>','window.__vp2Detalle('+s.id+',\'pagos\')')).join('')
        :'<div class="vp2-empty">No hay viáticos por depositar con estos filtros.</div>');
  } else if(P.tab==='extra'){
    const l=P.extra.filter(x=>x.estatus==='Autorizada'||x.estatus==='Pendiente'||String(x.creado_en).slice(0,7)===P.mes);
    cuerpo=l.length?l.map(x=>{ const e=x.estatus==='Pendiente'?{t:'Esperando autorización',c:'#c2410c',bg:'#ffedd5'}:x.estatus==='Autorizada'?{t:'Autorizado · por depositar',c:'#1d4ed8',bg:'#dbeafe'}:x.estatus==='Pagada'?{t:'Depositado',c:'#15803d',bg:'#dcfce7'}:{t:x.estatus,c:'#6b7280',bg:'#f3f4f6'};
      return '<div class="vp2-row" style="grid-template-columns:minmax(200px,1.4fr) 190px minmax(200px,1.5fr) 140px 150px" onclick="'+(x.viatico_id?'window.__vp2Detalle('+x.viatico_id+',\'pagos\')':'')+'"><div><div class="vp2-name">'+esc(x.tecnico_nombre||'')+'</div><div class="vp2-meta"><span>'+esc(x.viatico_folio||'')+'</span><span>'+fh(x.creado_en)+'</span></div></div>'+
        '<div>'+pill(e.t,e.c,e.bg)+'</div><div><div class="vp2-k">'+esc(x.concepto||'')+'</div><div class="vp2-v">'+esc(x.motivo||'')+'</div>'+(x.autorizo?'<div style="font-size:11px;color:#9ca3af">Autorizó '+esc(x.autorizo)+'</div>':'')+'</div>'+
        '<div><div class="vp2-k">Monto</div><div class="vp2-saldo" style="color:#c2410c">'+din(x.monto)+'</div></div>'+
        '<div>'+(x.estatus==='Autorizada'?'<button class="vp2-btn pri" onclick="event.stopPropagation();window.__vp2ExtraPagar('+x.id+')">Ya se depositó</button>':x.referencia_pago?'<span style="font-size:11.5px;color:#6b7280">Ref. '+esc(x.referencia_pago)+'</span>':'')+'</div></div>'; }).join('')
      :'<div class="vp2-empty">No hay viático extra pendiente.</div>';
  } else if(P.tab==='flotilla'){
    const l=(P.fl||[]).filter(s=>!q||norm([s.vehiculoEco,s.tipo,s.vehiculo,flTaller(s),s.creadoPorNombre,s.facturaNum].join(' ')).includes(q));
    cuerpo=P.fl===null?'<div class="vp2-empty">Cargando solicitudes de Flotilla…</div>':(l.length?l.map(s=>{ const e=flEstado(s);
      return '<div class="vp2-row" style="grid-template-columns:minmax(200px,1.4fr) 170px minmax(160px,1.1fr) minmax(150px,1fr) 140px 210px" onclick="window.__vp2FlDetalle(\''+s.id+'\')">'+
        '<div><div class="vp2-name">'+esc(s.tipo||'Servicio')+' · ECO '+esc(s.vehiculoEco||'—')+'</div><div class="vp2-meta"><span>'+esc(s.vehiculo||s.unidad||'')+'</span><span>'+IC.persona+esc(s.creadoPorNombre||s.creadoPor||'')+'</span></div></div>'+
        '<div>'+pill(e.t,e.c,e.bg)+'</div><div><div class="vp2-k">Taller</div><div class="vp2-v">'+esc(flTaller(s))+'</div></div>'+
        '<div><div class="vp2-k">Pagar el</div><div class="vp2-v">'+fc(s.fechaPagoProgramada)+'</div><div style="font-size:11px;color:#9ca3af">Factura: '+esc(s.facturaNum||'pendiente')+'</div></div>'+
        '<div><div class="vp2-k">Monto</div><div class="vp2-saldo" style="color:'+(e.k==='vencida'?'#dc2626':'#111827')+'"><i style="background:'+e.c+'"></i>'+din(flMonto(s))+'</div></div>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="vp2-btn pri" style="height:32px" onclick="event.stopPropagation();window._pflRegistrarPago(\''+s.id+'\')">'+(s.comprobantePago?'Actualizar pago':'Registrar pago')+'</button><button class="vp2-note" onclick="event.stopPropagation();window.__vp2FlDetalle(\''+s.id+'\')">'+IC.nota+' Ver todo</button></div></div>'; }).join('')
      :'<div class="vp2-empty">'+(P.flErr?'No se pudo cargar Flotilla: '+esc(P.flErr):'No hay solicitudes de Flotilla esperando pago.')+'</div>');
  } else if(P.tab==='pagados'){
    const l=pagMes.filter(pasa);
    cuerpo=l.length?l.map(s=>filaViatico(s,{t:'Pagado '+fc(s.entregado_en),c:'#15803d',bg:'#dcfce7'},'<div><div class="vp2-k">Depositado</div><div class="vp2-saldo" style="color:#15803d"><i style="background:#16a34a"></i>'+din(s.monto_entregado)+'</div></div>','window.__vp2Detalle('+s.id+',\'pagos\')')).join('')
      :'<div class="vp2-empty">No hay viáticos pagados en '+MES(P.mes)+'.</div>';
  } else {
    const ev=[];
    P.pend.filter(pasa).forEach(s=>{ const e=E(s); if(s.fecha_salida) ev.push({d:s.fecha_salida,k:e.k==='hoy'?'atrasado':e.k,c:e.k==='atrasado'||e.k==='hoy'?'#ef4444':e.k==='semana'?'#f59e0b':'#6366f1',t:(s.integrantes||'').split(',')[0]+' · '+s.folio,s:s.destino||'',m:'Depositar '+din(depositoDe(s)),fn:'window.__vp2Detalle('+s.id+',\'pagos\')'}); });
    P.pagados.filter(pasa).forEach(s=>ev.push({d:String(s.entregado_en).slice(0,10),k:'pagado',c:'#16a34a',t:(s.integrantes||'').split(',')[0]+' · '+s.folio,s:s.destino||'',m:'Pagado '+din(s.monto_entregado),fn:'window.__vp2Detalle('+s.id+',\'pagos\')'}));
    P.extra.filter(x=>x.estatus==='Autorizada'||x.estatus==='Pendiente').forEach(x=>ev.push({d:String(x.autorizo_en||x.creado_en).slice(0,10),k:'extra',c:'#ea580c',t:'Extra · '+(x.tecnico_nombre||''),s:x.concepto||'',m:din(x.monto),fn:x.viatico_id?'window.__vp2Detalle('+x.viatico_id+',\'pagos\')':''}));
    (P.fl||[]).forEach(s=>{ if(s.fechaPagoProgramada) ev.push({d:s.fechaPagoProgramada,k:'flotilla',c:'#0891b2',t:'ECO '+(s.vehiculoEco||'')+' · '+(s.tipo||''),s:flTaller(s),m:'Pagar '+din(flMonto(s)),fn:'window.__vp2FlDetalle(\''+s.id+'\')'}); });
    cuerpo=calendarioHTML(P,ev,[{k:'flotilla',t:'Flotilla',c:'#0891b2'},{k:'atrasado',t:'Ya salió / sale hoy',c:'#ef4444'},{k:'semana',t:'Sale esta semana',c:'#f59e0b'},{k:'futuro',t:'Por depositar',c:'#6366f1'},{k:'extra',t:'Viático extra',c:'#ea580c'},{k:'pagado',t:'Pagado',c:'#16a34a'}],'p');
  }
  const tab=(k,t,n,ico)=>'<button class="vp2-tab'+(P.tab===k?' on':'')+'" onclick="window.__vp2P(\'tab\',\''+k+'\')">'+ico+t+(n!=null?' <b>'+n+'</b>':'')+'</button>';
  p.innerHTML='<div class="vp2"><div class="vp2-hd"><div><div class="vp2-t">Pagos</div><div class="vp2-s">Viáticos por depositar, viático extra, pagos de Flotilla y lo que ya se pagó. Haz clic en cualquier viático para ver toda su información.</div></div>'+
    '<div class="vp2-tabs">'+tab('lista','Por depositar',P.pend.length,IC.lista)+tab('extra','Viático extra',extraAut.length+extraPend.length,IC.rayo)+(P.fl&&P.fl.length||P.tab==='flotilla'?tab('flotilla','Flotilla',(P.fl||[]).length,IC.ruta.replace(/20/g,'16')):(P.fl?tab('flotilla','Flotilla',0,IC.ruta.replace(/20/g,'16')):''))+tab('pagados','Pagados',pagMes.length,IC.ok)+tab('cal','Calendario',null,IC.cal)+'</div></div>'+
    '<div class="vp2-sec">Pendientes de atender</div><div class="vp2-cards">'+
      card({ico:IC.dinero,warn:atras.length?'Ya salieron sin depósito':'',wc:'#dc2626',num:din(tot(atras)),nc:atras.length?'#dc2626':'#111827',lbl:atras.length+' viático(s) atrasados o de hoy',fn:"window.__vp2P('ver','atrasado')"})+
      card({ico:IC.reloj,warn:sem.length?'Salen en los próximos 7 días':'',num:din(tot(sem)),lbl:sem.length+' viático(s) esta semana',fn:"window.__vp2P('ver','semana')"})+
      card({ico:IC.rayo,warn:extraAut.length?'Autorizado, falta depositar':extraPend.length?'Esperando autorización':'',num:din(extraAut.concat(extraPend).reduce((a,x)=>a+(Number(x.monto)||0),0)),lbl:(extraAut.length+extraPend.length)+' viático(s) extra',fn:"window.__vp2P('tab','extra')"})+
      (P.fl?card({ico:IC.ruta.replace(/20/g,'18'),warn:(P.fl.filter(s=>['vencida','hoy'].includes(flEstado(s).k)).length?'Flotilla: vencidas o de hoy':''),wc:'#dc2626',num:din(P.fl.reduce((a,s)=>a+flMonto(s),0)),lbl:P.fl.length+' pago(s) de Flotilla',fn:"window.__vp2P('tab','flotilla')"}):'')+
      card({ico:IC.ok,num:din(pagMes.reduce((a,s)=>a+(Number(s.monto_entregado)||0),0)),nc:'#15803d',lbl:pagMes.length+' pagado(s) en '+MES(P.mes),fn:"window.__vp2P('tab','pagados')"})+
    '</div>'+
    (P.tab==='cal'?'':'<div class="vp2-bar"><span class="vp2-ib">'+IC.buscar+'</span><input id="vp2-pq" class="vp2-in" style="min-width:260px" placeholder="Buscar folio, técnico, destino, cliente…" value="'+esc(P.q)+'" oninput="window.__vp2P(\'q\',this.value)">'+
      '<div class="vp2-mes"><button onclick="window.__vp2P(\'mes\',-1)">‹</button><span>'+IC.cal+MES(P.mes)+'</span><button onclick="window.__vp2P(\'mes\',1)">›</button></div>'+
      '<select class="vp2-in" onchange="window.__vp2P(\'empresa\',this.value)"><option value="">Todas las empresas</option>'+empresas.map(e=>'<option '+(P.empresa===e?'selected':'')+'>'+esc(e)+'</option>').join('')+'</select>'+
      '<span style="margin-left:auto"></span><button class="vp2-btn" onclick="window.__vp2Recargar(\'p\')">↻ Actualizar</button><button class="vp2-btn" onclick="window.__vp2ExportP()">'+IC.exp+' Exportar a Excel</button></div>')+
    cuerpo+'</div>';
}
window.__vp2P=function(k,v){ if(k==='mes'){ const d=dObj(P.mes+'-01'); d.setMonth(d.getMonth()+v); P.mes=iso(d).slice(0,7); }
  else if(k==='ver'){ P.tab='lista'; P.filtro=v; } else P[k]=v;
  pintarPagos(); if(k==='q'){ const i=document.getElementById('vp2-pq'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } } };
window.__vp2Recargar=t=>t==='p'?cargarPagos():cargarConta();
window.__vp2ExportP=function(){ const pag=P.tab==='pagados', l=pag?P.pagados.filter(s=>String(s.entregado_en||'').slice(0,7)===P.mes):P.pend;
  csv(pag?'viaticos_pagados':'viaticos_por_depositar',[['Folio','Integrantes','Destino','Servicio','Cliente','Empresa que entrega','Sale','Regresa','Estado','Costo del viaje','A depositar','Depositado','Pagado el','Referencia','Pidió']]
    .concat(l.map(s=>[s.folio,s.integrantes,s.destino,(s.tarifas||{}).servicioTexto||'',s.cliente,s.empresa_entrega,s.fecha_salida,s.fecha_regreso,estPagos(s).t,s.total,depositoDe(s),s.monto_entregado||'',s.entregado_en?String(s.entregado_en).slice(0,10):'',s.referencia_pago||'',s.solicitante_nombre]))); };
window.__vp2Deposito=async function(id){ const s=P.pend.find(x=>x.id===id); if(!s) return; const tecs=await tecnicos();
  const prim=norm(String(s.integrantes||'').split(/,| y /)[0]); let resp=String(s.responsable_email||'').toLowerCase();
  if(!resp){ const t=tecs.find(t=>prim&&norm(t.nombre).startsWith(prim.split(' ').slice(0,2).join(' '))); resp=t&&t.correo?String(t.correo).toLowerCase():String(s.solicitante_email||'').toLowerCase(); }
  modal('<div style="display:flex;justify-content:space-between;gap:10px"><div><div style="font-size:18px;font-weight:800">Registrar depósito</div><div style="font-size:12.5px;color:#6b7280">'+esc(s.folio)+' · '+esc(s.integrantes||'')+' · '+esc(s.destino||'')+'</div></div><button class="vp2-ib" onclick="window.__vp2Detalle('+s.id+',\'pagos\')">'+IC.cerrar+'</button></div>'+
    '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:10px 12px;margin:12px 0;font-size:13px;color:#166534">Calculado para depositar: <b>'+din(depositoDe(s))+'</b></div>'+
    '<div class="vp2-lb">¿Cómo se entregó?</div><div style="display:flex;gap:16px;margin:6px 0 11px">'+Object.keys(FORMAS).map((k,i)=>'<label style="font-size:13px;display:flex;gap:6px;align-items:center"><input type="radio" name="vp2-forma" value="'+k+'" '+(i===0?'checked':'')+'>'+FORMAS[k]+'</label>').join('')+'</div>'+
    '<label class="vp2-lb">Monto depositado<input id="vp2-monto" type="number" min="0" step="0.01" class="vp2-fi" value="'+depositoDe(s)+'"></label>'+
    '<label class="vp2-lb">Referencia o número de operación<input id="vp2-ref" class="vp2-fi" placeholder="Ej. folio de la transferencia"></label>'+
    '<label class="vp2-lb">Evidencia del depósito (foto o PDF) <span style="color:#dc2626">*</span><input id="vp2-comp" type="file" accept="image/*,application/pdf" class="vp2-fi" style="padding:7px"></label>'+
    '<label class="vp2-lb">¿Quién comprueba?<select id="vp2-resp" class="vp2-fi"><option value="">— Elige —</option>'+tecs.map(t=>'<option value="'+esc(String(t.correo||'').toLowerCase())+'" data-n="'+esc(t.nombre)+'" '+(t.correo&&String(t.correo).toLowerCase()===resp?'selected':'')+'>'+esc(t.nombre)+(t.correo?'':' (sin correo)')+'</option>').join('')+'</select></label>'+
    '<label class="vp2-lb">Fecha límite para comprobar<input id="vp2-lim" type="date" class="vp2-fi" value="'+sumar(s.fecha_regreso||hoy(),3)+'"></label>'+
    '<div id="vp2-err" style="font-size:12px;color:#b91c1c;font-weight:700;min-height:16px"></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="vp2-btn" onclick="window.__vp2Detalle('+s.id+',\'pagos\')">Cancelar</button><button id="vp2-btn" class="vp2-btn pri" onclick="window.__vp2GuardarDeposito('+s.id+')">Guardar depósito y avisar</button></div>',true); };
window.__vp2GuardarDeposito=async function(id){ const s=P.pend.find(x=>x.id===id); if(!s) return; const err=document.getElementById('vp2-err'), btn=document.getElementById('vp2-btn');
  const forma=(document.querySelector('input[name="vp2-forma"]:checked')||{}).value, monto=Number(document.getElementById('vp2-monto').value)||0;
  const ref=document.getElementById('vp2-ref').value.trim()||null, f=document.getElementById('vp2-comp').files[0], sel=document.getElementById('vp2-resp'), lim=document.getElementById('vp2-lim').value||null;
  const respEmail=sel.value||null, respNombre=sel.selectedOptions[0]?sel.selectedOptions[0].getAttribute('data-n'):null;
  if(!(monto>0)){ err.textContent='Escribe el monto depositado.'; return; } if(!f){ err.textContent='Sube la evidencia del depósito (foto o PDF).'; return; }
  if(f.size>6*1024*1024){ err.textContent='La evidencia pesa más de 6 MB; sube una foto o PDF más ligero.'; return; } if(!respNombre){ err.textContent='Elige quién comprueba.'; return; }
  btn.disabled=true; btn.textContent='Guardando…';
  try{ const data=await new Promise((ok,mal)=>{ const r=new FileReader(); r.onload=()=>ok(r.result); r.onerror=()=>mal(new Error('No se pudo leer el archivo')); r.readAsDataURL(f); });
    const u=yo(), ahora=new Date().toISOString();
    const cambios={ estatus:'Pagada', forma_entrega:forma, monto_entregado:monto, entregado_en:ahora, entregado_por:u.correo, responsable_email:respEmail, responsable_nombre:respNombre, fecha_limite_comprobacion:lim,
      actualizado_en:ahora, actualizado_por:u.correo, referencia_pago:ref, pagado_por_nombre:u.nombre, comprobante_pago:data, comprobante_pago_nombre:f.name };
    const c=await sb(); const r=await c.from('ops_solicitudes_viaticos').update(cambios).eq('id',id).eq('estatus','Pendiente').select('id');
    if(r.error) throw r.error; if(!(r.data||[]).length) throw new Error('Esta solicitud ya no está pendiente (alguien la registró o cambió). Actualiza la lista.');
    const msg='Recibiste viáticos '+s.folio+' por '+din(monto)+' ('+FORMAS[forma]+'). Comprueba subiendo fotos o PDF de tus facturas antes del '+fc(lim)+' desde la app → Comprobar viáticos.';
    const okApp=await avisoApp(respEmail,'viat_tec_entregado',msg,s); avisoPortal(respEmail,'viaticos_entregados',msg,{viaticoId:s.id});
    if(s.solicitante_email&&s.solicitante_email!==respEmail) avisoPortal(s.solicitante_email,'viaticos_pagada','Viáticos '+s.folio+' depositados a '+(respNombre||'el técnico')+'.',{viaticoId:s.id});
    const msgC='Viáticos '+s.folio+' PAGADOS: '+din(monto)+' a '+(respNombre||'el técnico')+' ('+FORMAS[forma]+(ref?', ref. '+ref:'')+'). Destino: '+(s.destino||'')+'. Comprobación a más tardar el '+fc(lim)+'. Ya está en Contabilidad.';
    (await destinatarios('viaticos_pagados',['contabilidad@tecnocontrol.com.mx'])).forEach(p=>avisoPortal(p,'viaticos_pagados',msgC,{viaticoId:s.id,modulo:'Contabilidad'}));
    modal(''); P.pend=P.pend.filter(x=>x.id!==id); P.pagados.unshift(Object.assign({},s,cambios,{comprobante_pago:undefined})); pintarPagos();
    toast(okApp?'Depósito registrado. Se avisó al técnico y pasó a Contabilidad.':'Depósito registrado y pasó a Contabilidad. El técnico no tiene correo: avísale por otro medio.');
  }catch(e){ err.textContent='No se pudo guardar: '+(e.message||e); btn.disabled=false; btn.textContent='Guardar depósito y avisar'; } };
window.__vp2ExtraPagar=async function(id){ const x=P.extra.find(v=>v.id===id); if(!x) return;
  const ref=prompt('Depósito de '+din(x.monto)+' a '+x.tecnico_nombre+'. Referencia o número de operación (opcional):',''); if(ref===null) return;
  try{ const c=await sb(), u=yo(); const r=await c.from('ops_viaticos_extra').update({estatus:'Pagada',pagado_por:u.nombre,pagado_en:new Date().toISOString(),referencia_pago:ref.trim()||null}).eq('id',id).eq('estatus','Autorizada').select('id');
    if(r.error) throw r.error; if(!(r.data||[]).length) throw new Error('Ya no está autorizada (alguien lo cambió). Actualiza.');
    if(x.tecnico_correo) avisoApp(x.tecnico_correo,'viatico_extra_pagado','Ya te depositaron '+din(x.monto)+' de viático extra ('+x.concepto+'). Recuerda comprobarlo con fotos o PDF de la factura.',{id:x.viatico_id||id,folio:x.viatico_folio});
    x.estatus='Pagada'; x.referencia_pago=ref.trim()||null; pintarPagos(); toast('Viático extra marcado como depositado.'); }catch(e){ alert('No se pudo guardar: '+(e.message||e)); } };

// ═════════════ CONTABILIDAD ═════════════
const C={ secc:'inicio', concil:null, cuentas:null, banco:null, urg:null, lista:[], filtro:'pend', q:'', tab:'lista', mes:hoy().slice(0,7), dia:hoy(), vista:'mes', ocultos:{} };
function contConta(){ css(); let p=document.getElementById('vp-conta'); if(p) return p; const dash=document.getElementById('conta-dashboard'); if(!dash||!dash.parentNode) return null;
  p=document.createElement('div'); p.id='vp-conta'; dash.parentNode.insertBefore(p,dash); return p; }
async function cargarConta(){ tecnicos(); const p=contConta(); if(!p) return; p.style.display='block'; if(!C.lista.length) p.innerHTML='<div class="vp2"><div class="vp2-empty">Cargando…</div></div>';
  try{ const c=await sb(); const r=await c.from('ops_solicitudes_viaticos').select(COLS).eq('estatus','Pagada').order('entregado_en',{ascending:false}).limit(500);
    if(r.error) throw r.error; C.lista=r.data||[]; Object.keys(COMPS).forEach(k=>delete COMPS[k]);
    if(C.lista.length){ const k=await c.from('ops_viaticos_comprobantes').select('*').in('viatico_id',C.lista.map(s=>s.id)).order('creado_en',{ascending:true}); (k.data||[]).forEach(x=>{ (COMPS[x.viatico_id]=COMPS[x.viatico_id]||[]).push(x); }); }
    pintarConta(); if(C.concil===null) cargarConcil(); }
  catch(e){ p.innerHTML='<div class="vp2"><div class="vp2-empty" style="color:#b91c1c">No se pudieron cargar los viáticos: '+esc(e.message||e)+'</div></div>'; } }
// ── Interfaz de Contabilidad (29-oct-2026): menú lateral + secciones, preparada para Aspel, CONTPAQi y bancos ──
const C_SECC=[['inicio','Inicio','M3 12l9-9 9 9M5 10v10h14V10'],['viaticos','Viáticos','M2 6h20v12H2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],['calendario','Calendario','M3 4h18v18H3zM16 2v4M8 2v4M3 10h18'],['bancos','Bancos · conciliación','M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M2 21h20M12 3l9 5H3z'],['polizas','Aspel / CONTPAQi','M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8']];
function svgP(d){ return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>'; }
function cssConta(){ if(document.getElementById('vp2c-css')) return; const st=document.createElement('style'); st.id='vp2c-css'; st.textContent=`
.vp2c{display:grid;grid-template-columns:230px 1fr;gap:0;background:#f4f5f7;border-radius:18px;overflow:hidden;margin-bottom:22px;min-height:640px}
@media(max-width:1000px){.vp2c{grid-template-columns:1fr}}
.vp2c-nav{background:#2f3a36;color:#e5e7eb;padding:18px 12px;display:flex;flex-direction:column;gap:3px}
.vp2c-nav .marca{font-size:16px;font-weight:800;color:#fff;padding:2px 10px 14px;display:flex;gap:9px;align-items:center}
.vp2c-nav .grp{font-size:10.5px;letter-spacing:.8px;color:#9ca3af;font-weight:700;padding:12px 10px 6px;text-transform:uppercase}
.vp2c-nav button{display:flex;align-items:center;gap:10px;border:none;background:none;color:#e5e7eb;font-family:inherit;font-size:13px;font-weight:600;padding:9px 10px;border-radius:10px;cursor:pointer;text-align:left;width:100%}
.vp2c-nav button:hover{background:rgba(255,255,255,.07)}.vp2c-nav button.on{background:#facc15;color:#111827}
.vp2c-nav button b{margin-left:auto;background:#ef4444;color:#fff;border-radius:99px;font-size:10.5px;padding:1px 7px}
.vp2c-nav .pie{margin-top:auto;border-top:1px solid rgba(255,255,255,.1);padding-top:10px;font-size:11px;color:#9ca3af;line-height:1.5;padding-left:10px}
.vp2c-main{padding:20px 22px;min-width:0}
.vp2c-int{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.vp2c-int>div{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:14px}
.vp2c-tag{display:inline-block;font-size:10.5px;font-weight:800;border-radius:99px;padding:2px 9px}
.vp2c-tbl{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:12.5px}.vp2c-tbl th{text-align:left;font-size:10.5px;color:#9ca3af;text-transform:uppercase;font-weight:800;padding:0 10px}
.vp2c-tbl td{background:#fff;padding:9px 10px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb}.vp2c-tbl td:first-child{border-left:1px solid #e5e7eb;border-radius:10px 0 0 10px}.vp2c-tbl td:last-child{border-right:1px solid #e5e7eb;border-radius:0 10px 10px 0}
`; document.head.appendChild(st); }
function pintarConta(){ const p=contConta(); if(!p) return; cssConta(); const q=norm(C.q);
  if(!C.secc) C.secc='inicio';
  const todos=C.lista.map(s=>({s,e:estConta(s)})); const pasaF=(x,f)=>f==='todos'||(f==='pend'&&(x.e.k==='pend'||x.e.k==='vencido'))||x.e.k===f;
  const pasaQ=x=>!q||norm([x.s.folio,x.s.integrantes,x.s.responsable_nombre,x.s.destino,x.s.cliente,x.s.referencia_pago,x.s.empresa_entrega].join(' ')).includes(q);
  const cnt=f=>todos.filter(x=>pasaF(x,f)).length, falta=f=>todos.filter(x=>pasaF(x,f)).reduce((a,x)=>a+x.e.falta,0);
  const prox=todos.filter(x=>x.e.k==='pend'&&x.s.fecha_limite_comprobacion&&x.s.fecha_limite_comprobacion<=sumar(hoy(),7));
  const porRev=todos.reduce((a,x)=>a+x.e.porRev,0);
  const mesL=todos.filter(x=>String(x.s.entregado_en||'').slice(0,7)===C.mes);
  const tarjetas='<div class="vp2-cards">'+
      card({ico:IC.alerta.replace(/14/g,'18'),warn:cnt('vencido')?'Ya pasó su fecha límite':'',wc:'#dc2626',num:din(falta('vencido')),nc:cnt('vencido')?'#dc2626':'#111827',lbl:cnt('vencido')+' viático(s) vencido(s) sin comprobar',fn:"window.__vp2C('ver','vencido')"})+
      card({ico:IC.reloj,warn:prox.length?'Vencen en los próximos 7 días':'',num:din(prox.reduce((a,x)=>a+x.e.falta,0)),lbl:prox.length+' por vencer',fn:"window.__vp2C('ver','pend')"})+
      card({ico:IC.doc,warn:porRev?'Revisa los comprobantes':'',wc:'#2563eb',num:String(porRev),lbl:'comprobante(s) por revisar',fn:"window.__vp2C('ver','revisar')"})+
      card({ico:IC.ok,num:din(mesL.reduce((a,x)=>a+x.e.dep,0)),nc:'#15803d',lbl:mesL.length+' viático(s) pagado(s) en '+MES(C.mes),fn:"window.__vp2C('ver','todos')"})+'</div>';
  const barra=(conMes)=>'<div class="vp2-bar"><span class="vp2-ib">'+IC.buscar+'</span><input id="vp2-cq" class="vp2-in" style="min-width:240px" placeholder="Buscar folio, técnico, referencia…" value="'+esc(C.q)+'" oninput="window.__vp2C(\'q\',this.value)">'+
      (conMes?'<div class="vp2-mes"><button onclick="window.__vp2C(\'mes\',-1)">‹</button><span>'+IC.cal+MES(C.mes)+'</span><button onclick="window.__vp2C(\'mes\',1)">›</button></div>':'')+
      '<span style="margin-left:auto"></span><button class="vp2-btn" onclick="window.__vp2Recargar(\'c\')">↻ Actualizar</button><button class="vp2-btn" onclick="window.__vp2ExportC()">'+IC.exp+' Exportar a Excel</button></div>';
  let cuerpo='', titulo='', sub='';
  if(C.secc==='inicio'){
    titulo='Contabilidad'; sub='Resumen de lo que requiere tu atención: comprobación de viáticos, conciliación bancaria y el puente con Aspel y CONTPAQi.';
    const ult=(C.concil||[])[0];
    cuerpo='<div class="vp2-sec">Pendientes en los próximos 7 días</div>'+tarjetas+
      '<div class="vp2-sec">Conexiones contables</div><div class="vp2c-int">'+
        '<div><div style="display:flex;justify-content:space-between;align-items:center"><b>Aspel SAE / COI</b><span class="vp2c-tag" style="background:#fef9c3;color:#a16207">Por archivo</span></div><div style="font-size:12px;color:#6b7280;margin:6px 0 10px">El portal arma las pólizas de viáticos en un archivo para importar. Aspel sigue siendo la contabilidad oficial.</div><button class="vp2-btn" onclick="window.__vp2C(\'secc\',\'polizas\')">Ir a pólizas</button></div>'+
        '<div><div style="display:flex;justify-content:space-between;align-items:center"><b>CONTPAQi</b><span class="vp2c-tag" style="background:#fef9c3;color:#a16207">Por archivo</span></div><div style="font-size:12px;color:#6b7280;margin:6px 0 10px">Mismo archivo de pólizas, con el catálogo de cuentas que captures aquí.</div><button class="vp2-btn" onclick="window.__vp2C(\'secc\',\'polizas\')">Configurar cuentas</button></div>'+
        '<div><div style="display:flex;justify-content:space-between;align-items:center"><b>Bancos</b><span class="vp2c-tag" style="background:'+(ult?'#dcfce7;color:#15803d':'#f1f5f9;color:#475569')+'">'+(ult?'Última: '+esc(ult.periodo||''):'Sin conciliar')+'</span></div><div style="font-size:12px;color:#6b7280;margin:6px 0 10px">'+(ult?esc(ult.banco||'')+' · '+ult.conciliados+' conciliados, '+ult.sin_respaldo+' sin respaldo, '+ult.sin_banco+' sin movimiento en banco.':'Sube el estado de cuenta y el portal lo cruza contra lo que se pagó.')+'</div><button class="vp2-btn" onclick="window.__vp2C(\'secc\',\'bancos\')">Conciliar</button></div>'+
      '</div>'+
      '<div class="vp2-sec" style="margin-top:18px">Viáticos que más urgen</div>'+
      (todos.filter(x=>x.e.k==='vencido'||x.e.k==='revisar').slice(0,5).map(({s,e})=>filaViatico(s,e,'<div><div class="vp2-k">Falta</div><div class="vp2-saldo" style="color:'+(e.k==='vencido'?'#dc2626':'#1d4ed8')+'"><i style="background:'+e.c+'"></i>'+din(e.falta)+'</div></div>','window.__vp2Detalle('+s.id+',\'conta\')')).join('')||'<div class="vp2-empty">Nada urgente. ¡Todo al corriente!</div>');
  } else if(C.secc==='viaticos'){
    titulo='Viáticos'; sub='Todo viático que Pagos deposita llega aquí con su evidencia. Revisa si el técnico ya comprobó, cuánto falta y si ya se venció. Si hay una urgencia, puedes comprobar tú desde la ficha del viático.';
    const l=todos.filter(x=>pasaF(x,C.filtro)&&pasaQ(x));
    const chip=(f,t)=>'<button class="vp2-chip'+(C.filtro===f?' on':'')+'" onclick="window.__vp2C(\'filtro\',\''+f+'\')">'+t+' ('+cnt(f)+')</button>';
    cuerpo=tarjetas+barra(true)+'<div class="vp2-chips">'+chip('pend','Pendientes')+chip('vencido','Vencidos')+chip('revisar','Por revisar')+chip('comprobado','Comprobados')+chip('cerrado','Cerrados')+chip('todos','Todos')+'</div>'+
      (l.length?l.map(({s,e})=>filaViatico(s,e,'<div><div class="vp2-k">Falta comprobar</div><div class="vp2-saldo" style="color:'+(e.falta>0.5?(e.k==='vencido'?'#dc2626':'#111827'):'#15803d')+'"><i style="background:'+e.c+'"></i>'+din(e.falta)+'</div><div style="font-size:11px;color:#9ca3af">de '+din(e.dep)+' · límite '+fc(s.fecha_limite_comprobacion)+'</div></div>','window.__vp2Detalle('+s.id+',\'conta\')')).join('')
        :'<div class="vp2-empty">No hay viáticos en este filtro.</div>');
  } else if(C.secc==='calendario'){
    titulo='Calendario'; sub='Fechas límite de comprobación y días de pago. Haz clic en cualquier tarjeta para ver toda su información.';
    const ev=[]; todos.filter(pasaQ).forEach(({s,e})=>{ if(s.fecha_limite_comprobacion) ev.push({d:s.fecha_limite_comprobacion,k:e.k,c:e.c,t:(s.responsable_nombre||s.integrantes||'').split(',')[0]+' · '+s.folio,s:'Límite para comprobar',m:e.falta>0.5?'Falta '+din(e.falta):e.t,fn:'window.__vp2Detalle('+s.id+',\'conta\')'});
      if(s.entregado_en) ev.push({d:String(s.entregado_en).slice(0,10),k:'pagado',c:'#16a34a',t:'Pagado · '+s.folio,s:s.responsable_nombre||'',m:din(s.monto_entregado),fn:'window.__vp2Detalle('+s.id+',\'conta\')'}); });
    cuerpo=calendarioHTML(C,ev,[{k:'vencido',t:'Vencido sin comprobar',c:'#b91c1c'},{k:'pend',t:'Pendiente de comprobar',c:'#a16207'},{k:'revisar',t:'Por revisar',c:'#1d4ed8'},{k:'comprobado',t:'Comprobado',c:'#15803d'},{k:'cerrado',t:'Cerrado',c:'#15803d'},{k:'pagado',t:'Día en que se pagó',c:'#16a34a'}],'c');
  } else if(C.secc==='bancos'){ titulo='Bancos · conciliación'; sub='Sube el estado de cuenta del banco (CSV) y el portal lo cruza contra los depósitos registrados: qué movimientos sí tienen respaldo, cuáles salieron del banco sin registro en el portal y cuáles se registraron pero no aparecen en el banco.'; cuerpo=bancosHTML();
  } else { titulo='Aspel / CONTPAQi'; sub='Pólizas de los viáticos listas para importar. Captura una vez tu catálogo de cuentas; el archivo sale con cargos y abonos cuadrados. Revisa siempre antes de importar.'; cuerpo=polizasHTML(); }
  const pend=cnt('vencido')+porRev;
  p.innerHTML='<div class="vp2c"><nav class="vp2c-nav"><div class="marca">'+svgP('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6')+'Contabilidad</div><div class="grp">Trabajo diario</div>'+
    C_SECC.slice(0,3).map(([k,t,d])=>'<button class="'+(C.secc===k?'on':'')+'" onclick="window.__vp2C(\'secc\',\''+k+'\')">'+svgP(d)+t+(k==='viaticos'&&pend?'<b>'+pend+'</b>':'')+'</button>').join('')+
    '<div class="grp">Cierre y auditoría</div>'+C_SECC.slice(3).map(([k,t,d])=>'<button class="'+(C.secc===k?'on':'')+'" onclick="window.__vp2C(\'secc\',\''+k+'\')">'+svgP(d)+t+'</button>').join('')+
    '<div class="pie">Aspel es la contabilidad oficial. El portal captura, da seguimiento y entrega archivos listos para importar.</div></nav>'+
    '<div class="vp2c-main vp2" style="margin:0;border-radius:0"><div class="vp2-hd"><div><div class="vp2-t">'+esc(titulo)+'</div><div class="vp2-s">'+esc(sub)+'</div></div></div>'+cuerpo+'</div></div>';
}
window.__vp2C=function(k,v){ if(k==='mes'){ const d=dObj(C.mes+'-01'); d.setMonth(d.getMonth()+v); C.mes=iso(d).slice(0,7); C.dia=C.mes+'-01'; }
  else if(k==='ver'){ C.secc='viaticos'; C.filtro=v; } else C[k]=v;
  if(k==='secc'&&(v==='bancos'||v==='inicio')) cargarConcil(); if(k==='secc'&&v==='polizas') cargarCuentas();
  pintarConta(); if(k==='q'){ const i=document.getElementById('vp2-cq'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } } };

// ── Bancos: conciliación contra estado de cuenta ──
async function cargarConcil(){ try{ const c=await sb(); const r=await c.from('conta_conciliaciones').select('id,banco,cuenta,periodo,archivo_nombre,movimientos,conciliados,sin_respaldo,sin_banco,hecho_por,creado_en').order('creado_en',{ascending:false}).limit(20); C.concil=r.data||[]; }catch(e){ C.concil=[]; } if(C.secc==='bancos'||C.secc==='inicio') pintarConta(); }
function leerCSV(txt){ const filas=[]; let f=[],v='',q=false; for(let i=0;i<txt.length;i++){ const ch=txt[i];
    if(q){ if(ch==='"'&&txt[i+1]==='"'){v+='"';i++;} else if(ch==='"') q=false; else v+=ch; }
    else if(ch==='"') q=true; else if(ch===','||ch===';'||ch==='\t'){ f.push(v); v=''; } else if(ch==='\n'||ch==='\r'){ if(ch==='\r'&&txt[i+1]==='\n') i++; f.push(v); filas.push(f); f=[]; v=''; } else v+=ch; }
  if(v!==''||f.length){ f.push(v); filas.push(f); } return filas.filter(r=>r.some(x=>String(x).trim()!=='')); }
const numMX=v=>{ const t=String(v||'').replace(/[$\s]/g,''); if(!t) return 0; const n=Number(t.replace(/,/g,'')); return isNaN(n)?0:n; };
function fechaMX(v){ const t=String(v||'').trim(); let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
  m=t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/); if(m){ const y=m[3].length===2?'20'+m[3]:m[3]; return y+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'); }
  const MESES={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12}; m=norm(t).match(/^(\d{1,2})[\s\/\-]([a-z]{3})[a-z]*[\s\/\-](\d{2,4})/); if(m&&MESES[m[2]]){ const y=m[3].length===2?'20'+m[3]:m[3]; return y+'-'+String(MESES[m[2]]).padStart(2,'0')+'-'+m[1].padStart(2,'0'); } return ''; }
function bancosHTML(){ const b=C.banco||{};
  let h='<div class="vp2c-int" style="margin-bottom:14px"><div style="grid-column:1/-1"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">'+
    '<label class="vp2-lb">Banco<input id="vp2b-banco" class="vp2-fi" style="margin-bottom:0;width:170px" value="'+esc(b.banco||'')+'" placeholder="Ej. BBVA, Banorte"></label>'+
    '<label class="vp2-lb">Cuenta<input id="vp2b-cuenta" class="vp2-fi" style="margin-bottom:0;width:150px" value="'+esc(b.cuenta||'')+'" placeholder="Últimos 4 dígitos"></label>'+
    '<label class="vp2-lb">Estado de cuenta (CSV)<input id="vp2b-file" type="file" accept=".csv,.txt,text/csv" class="vp2-fi" style="margin-bottom:0;padding:7px;width:260px" onchange="window.__vp2BLeer(this)"></label>'+
    '<span style="font-size:11.5px;color:#6b7280;max-width:360px">Desde la banca en línea descarga los movimientos en CSV (o guarda tu Excel como CSV). Debe traer fecha, descripción y cargo/abono o importe.</span></div></div></div>';
  if(b.filas){ const enc=b.filas[0]||[]; const op=i=>'<option value="">—</option>'+enc.map((x,j)=>'<option value="'+j+'" '+(i===j?'selected':'')+'>'+esc(x||('Columna '+(j+1)))+'</option>').join('');
    h+='<div class="vp2c-int" style="margin-bottom:14px"><div style="grid-column:1/-1"><b style="font-size:13px">1. ¿Qué columna es cada dato?</b> <span style="font-size:12px;color:#6b7280">('+(b.filas.length-1)+' movimientos leídos de '+esc(b.nombre)+')</span><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">'+
      [['fecha','Fecha'],['desc','Descripción'],['cargo','Cargo / retiro'],['abono','Abono / depósito'],['importe','Importe (si viene en una sola columna)'],['ref','Referencia']].map(([k,t])=>'<label class="vp2-lb">'+t+'<select class="vp2-fi" style="margin-bottom:0;width:180px" onchange="window.__vp2BCol(\''+k+'\',this.value)">'+op(b.col[k])+'</select></label>').join('')+
      '</div><div style="margin-top:10px;display:flex;gap:8px"><button class="vp2-btn pri" onclick="window.__vp2BConciliar()">2. Conciliar</button><span style="font-size:11.5px;color:#6b7280;align-self:center">Se cruzan los retiros del banco contra depósitos de viáticos y viático extra (mismo monto, ±5 días; la referencia ayuda a confirmar).</span></div></div></div>';
  }
  if(b.res){ const r=b.res; const tabla=(tit,col,l,cols)=>'<div class="vp2-sec" style="color:'+col+'">'+tit+' ('+l.length+')</div>'+(l.length?'<table class="vp2c-tbl"><tr>'+cols.map(c=>'<th>'+c[0]+'</th>').join('')+'</tr>'+l.slice(0,300).map(x=>'<tr>'+cols.map(c=>'<td>'+c[1](x)+'</td>').join('')+'</tr>').join('')+'</table>':'<div class="vp2-empty" style="padding:14px">Ninguno.</div>');
    h+='<div class="vp2-cards">'+card({ico:IC.ok,num:String(r.ok.length),nc:'#15803d',lbl:'movimientos conciliados'})+card({ico:IC.alerta.replace(/14/g,'18'),warn:r.sinResp.length?'Salió dinero sin registro en el portal':'',wc:'#dc2626',num:String(r.sinResp.length),nc:r.sinResp.length?'#dc2626':'#111827',lbl:'retiros sin respaldo · '+din(r.sinResp.reduce((a,x)=>a+x.monto,0))})+
      card({ico:IC.reloj,warn:r.sinBanco.length?'Registrado pero no aparece en el banco':'',num:String(r.sinBanco.length),lbl:'pagos sin movimiento · '+din(r.sinBanco.reduce((a,x)=>a+x.monto,0))})+'</div>'+
      '<div class="vp2-bar"><button class="vp2-btn pri" onclick="window.__vp2BGuardar()">Guardar conciliación</button><button class="vp2-btn" onclick="window.__vp2BExport()">'+IC.exp+' Exportar resultado</button></div>'+
      tabla('Retiros del banco sin respaldo en el portal','#b91c1c',r.sinResp,[['Fecha',x=>fc(x.fecha)],['Descripción',x=>esc(x.desc)],['Referencia',x=>esc(x.ref)],['Monto',x=>'<b>'+din(x.monto)+'</b>']])+
      tabla('Pagos registrados que no aparecen en el banco','#a16207',r.sinBanco,[['Folio',x=>'<a href="#" onclick="event.preventDefault();'+(x.viaId?'window.__vp2Detalle('+x.viaId+',\'conta\')':'')+'" style="color:#1d4ed8;font-weight:700">'+esc(x.folio)+'</a>'],['Para',x=>esc(x.quien)],['Pagado',x=>fc(x.fecha)],['Referencia',x=>esc(x.ref)],['Monto',x=>'<b>'+din(x.monto)+'</b>']])+
      tabla('Conciliados','#15803d',r.ok,[['Banco',x=>fc(x.b.fecha)+' · '+esc(x.b.desc)],['Portal',x=>esc(x.p.folio)+' · '+esc(x.p.quien)],['Monto',x=>'<b>'+din(x.b.monto)+'</b>'],['Cómo',x=>esc(x.como)]]);
  }
  h+='<div class="vp2-sec" style="margin-top:18px">Conciliaciones guardadas</div>'+((C.concil||[]).length?'<table class="vp2c-tbl"><tr><th>Fecha</th><th>Banco</th><th>Periodo</th><th>Archivo</th><th>Conciliados</th><th>Sin respaldo</th><th>Sin banco</th><th>Hizo</th></tr>'+
    C.concil.map(x=>'<tr><td>'+fh(x.creado_en)+'</td><td>'+esc(x.banco||'')+' '+esc(x.cuenta||'')+'</td><td>'+esc(x.periodo||'')+'</td><td>'+esc(x.archivo_nombre||'')+'</td><td>'+x.conciliados+'</td><td style="color:#b91c1c;font-weight:700">'+x.sin_respaldo+'</td><td style="color:#a16207;font-weight:700">'+x.sin_banco+'</td><td>'+esc(x.hecho_por||'')+'</td></tr>').join('')+'</table>':'<div class="vp2-empty" style="padding:14px">Todavía no hay conciliaciones guardadas.</div>');
  return h; }
window.__vp2BLeer=function(inp){ const f=inp.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ const filas=leerCSV(String(r.result||'')); if(filas.length<2){ alert('El archivo no trae movimientos.'); return; }
    const enc=filas[0].map(norm), busca=re=>enc.findIndex(x=>re.test(x));
    C.banco={ banco:document.getElementById('vp2b-banco').value, cuenta:document.getElementById('vp2b-cuenta').value, nombre:f.name, filas,
      col:{ fecha:busca(/fecha/), desc:busca(/desc|concepto|movimiento|detalle/), cargo:busca(/cargo|retiro|debito|egreso/), abono:busca(/abono|deposito|credito|ingreso/), importe:busca(/^importe|^monto/), ref:busca(/refer|folio|clave/) } };
    Object.keys(C.banco.col).forEach(k=>{ if(C.banco.col[k]<0) C.banco.col[k]=null; }); pintarConta(); };
  r.readAsText(f,'utf-8'); };
window.__vp2BCol=(k,v)=>{ C.banco.col[k]=v===''?null:Number(v); };
window.__vp2BConciliar=async function(){ const b=C.banco; if(!b||!b.filas) return; const col=b.col; if(col.fecha==null||(col.cargo==null&&col.importe==null)){ alert('Indica al menos la columna de fecha y la de cargo (o importe).'); return; }
  b.banco=document.getElementById('vp2b-banco').value; b.cuenta=document.getElementById('vp2b-cuenta').value;
  const movs=b.filas.slice(1).map(r=>{ let m=col.cargo!=null?numMX(r[col.cargo]):0; if(!m&&col.importe!=null){ const x=numMX(r[col.importe]); m=x<0?-x:0; } return { fecha:fechaMX(r[col.fecha]), desc:col.desc!=null?r[col.desc]:'', ref:col.ref!=null?String(r[col.ref]||''):'', monto:Math.round(Math.abs(m)*100)/100 }; }).filter(x=>x.monto>0&&x.fecha);
  if(!movs.length){ alert('No encontré retiros con fecha. Revisa qué columna es cada dato.'); return; }
  const fechas=movs.map(x=>x.fecha).sort(), desde=sumar(fechas[0],-10), hasta=sumar(fechas[fechas.length-1],10);
  const c=await sb(); const [v,x]=await Promise.all([ c.from('ops_solicitudes_viaticos').select('id,folio,responsable_nombre,integrantes,monto_entregado,entregado_en,referencia_pago').eq('estatus','Pagada').gte('entregado_en',desde).lte('entregado_en',hasta+'T23:59:59'),
    c.from('ops_viaticos_extra').select('id,viatico_id,viatico_folio,tecnico_nombre,monto,pagado_en,referencia_pago').eq('estatus','Pagada').gte('pagado_en',desde).lte('pagado_en',hasta+'T23:59:59') ]);
  const portal=(v.data||[]).map(s=>({tipo:'viatico',viaId:s.id,folio:s.folio,quien:s.responsable_nombre||s.integrantes||'',monto:Number(s.monto_entregado)||0,fecha:String(s.entregado_en).slice(0,10),ref:s.referencia_pago||''}))
    .concat((x.data||[]).map(e=>({tipo:'extra',viaId:e.viatico_id,folio:(e.viatico_folio||'')+' (extra)',quien:e.tecnico_nombre||'',monto:Number(e.monto)||0,fecha:String(e.pagado_en).slice(0,10),ref:e.referencia_pago||''})));
  const usados=new Set(), ok=[], sinResp=[]; const dias=(a,b2)=>Math.abs((dObj(a)-dObj(b2))/864e5);
  movs.forEach(m=>{ const cand=portal.map((p,i)=>({p,i})).filter(o=>!usados.has(o.i)&&Math.abs(o.p.monto-m.monto)<0.51&&dias(o.p.fecha,m.fecha)<=5);
    const conRef=cand.find(o=>o.p.ref&&(norm(m.desc+' '+m.ref).includes(norm(o.p.ref)))); const el=conRef||cand.sort((a,b2)=>dias(a.p.fecha,m.fecha)-dias(b2.p.fecha,m.fecha))[0];
    if(el){ usados.add(el.i); ok.push({b:m,p:el.p,como:conRef?'Monto + referencia':'Monto y fecha ('+dias(el.p.fecha,m.fecha)+' día(s))'}); } else sinResp.push(m); });
  const sinBanco=portal.filter((p,i)=>!usados.has(i)&&p.fecha>=fechas[0]&&p.fecha<=fechas[fechas.length-1]);
  b.res={ok,sinResp,sinBanco,periodo:fc(fechas[0])+' a '+fc(fechas[fechas.length-1]),movs:movs.length}; pintarConta(); };
window.__vp2BGuardar=async function(){ const b=C.banco; if(!b||!b.res) return; try{ const c=await sb(), u=yo(); const r=b.res;
  const ins=await c.from('conta_conciliaciones').insert({banco:b.banco||null,cuenta:b.cuenta||null,periodo:r.periodo,archivo_nombre:b.nombre,movimientos:r.movs,conciliados:r.ok.length,sin_respaldo:r.sinResp.length,sin_banco:r.sinBanco.length,
    resultado:{ok:r.ok.map(x=>({fecha:x.b.fecha,desc:x.b.desc,monto:x.b.monto,folio:x.p.folio,como:x.como})),sinRespaldo:r.sinResp,sinBanco:r.sinBanco},hecho_por:u.nombre||u.correo});
  if(ins.error) throw ins.error; toast('Conciliación guardada.'); cargarConcil(); }catch(e){ alert('No se pudo guardar: '+(e.message||e)); } };
window.__vp2BExport=function(){ const r=(C.banco||{}).res; if(!r) return;
  csv('conciliacion_bancaria',[['Resultado','Fecha banco','Descripción banco','Referencia banco','Monto','Folio portal','Para','Fecha portal','Cómo']]
    .concat(r.ok.map(x=>['Conciliado',x.b.fecha,x.b.desc,x.b.ref,x.b.monto,x.p.folio,x.p.quien,x.p.fecha,x.como]))
    .concat(r.sinResp.map(x=>['Retiro sin respaldo en el portal',x.fecha,x.desc,x.ref,x.monto,'','','','']))
    .concat(r.sinBanco.map(x=>['Pago del portal sin movimiento en banco','','','',x.monto,x.folio,x.quien,x.fecha,'']))); };

// ── Pólizas para Aspel COI / CONTPAQi ──
const CUENTAS_BASE={ bancos:{n:'Bancos',c:''}, deudores:{n:'Deudores diversos (técnicos)',c:''}, iva:{n:'IVA acreditable pagado',c:''}, alimentos:{n:'Gastos de viaje · alimentos',c:''}, hospedaje:{n:'Gastos de viaje · hospedaje',c:''}, gasolina:{n:'Combustibles',c:''}, casetas:{n:'Gastos de viaje · casetas',c:''}, transporte:{n:'Gastos de viaje · transporte',c:''}, otros:{n:'Otros gastos de viaje',c:''}, nodeducible:{n:'Gastos no deducibles',c:''} };
async function cargarCuentas(){ if(C.cuentas) return; try{ const c=await sb(); const r=await c.from('conta_config').select('datos').eq('id','cuentas').maybeSingle(); C.cuentas=Object.assign(JSON.parse(JSON.stringify(CUENTAS_BASE)),(r.data&&r.data.datos)||{}); }catch(e){ C.cuentas=JSON.parse(JSON.stringify(CUENTAS_BASE)); } if(C.secc==='polizas') pintarConta(); }
function polizasHTML(){ const cu=C.cuentas; if(!cu){ cargarCuentas(); return '<div class="vp2-empty">Cargando catálogo…</div>'; }
  const falt=Object.keys(cu).filter(k=>!String(cu[k].c||'').trim()).length;
  return '<div class="vp2c-int" style="margin-bottom:14px"><div style="grid-column:1/-1"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px"><b style="font-size:13.5px">Catálogo de cuentas</b>'+(falt?'<span class="vp2c-tag" style="background:#fef9c3;color:#a16207">Faltan '+falt+' cuenta(s)</span>':'<span class="vp2c-tag" style="background:#dcfce7;color:#15803d">Completo</span>')+'</div>'+
    '<div style="font-size:12px;color:#6b7280;margin:4px 0 10px">Escribe el número de cuenta tal como está en tu catálogo de Aspel COI o CONTPAQi. Se guarda para todos.</div>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:4px 14px">'+Object.keys(cu).map(k=>'<label class="vp2-lb">'+esc(cu[k].n)+'<input class="vp2-fi" style="margin-bottom:6px" value="'+esc(cu[k].c||'')+'" placeholder="Ej. 107-01-000" onchange="window.__vp2Cuenta(\''+k+'\',this.value)"></label>').join('')+'</div>'+
    '<button class="vp2-btn pri" onclick="window.__vp2GuardarCuentas()">Guardar catálogo</button></div></div>'+
    '<div class="vp2c-int"><div><b>Pólizas de egreso · depósitos de viáticos</b><div style="font-size:12px;color:#6b7280;margin:6px 0 10px">Una póliza por depósito: cargo a Deudores diversos (el técnico) y abono a Bancos.</div></div>'+
    '<div><b>Pólizas de diario · comprobación aceptada</b><div style="font-size:12px;color:#6b7280;margin:6px 0 10px">Cargo al gasto según su concepto (y al IVA cuando la factura trae XML), abono a Deudores diversos. Las facturas en foto o PDF van completas al gasto con la nota "IVA por desglosar".</div></div>'+
    '<div><b>Archivo del mes</b><div style="font-size:12px;color:#6b7280;margin:6px 0 10px">Mes de '+MES(C.mes)+'. Cámbialo con las flechas.</div><div class="vp2-mes" style="margin-bottom:10px"><button onclick="window.__vp2C(\'mes\',-1)">‹</button><span>'+IC.cal+MES(C.mes)+'</span><button onclick="window.__vp2C(\'mes\',1)">›</button></div><button class="vp2-btn dark" onclick="window.__vp2Polizas()">'+IC.exp+' Descargar pólizas (Excel/CSV)</button></div></div>'+
    '<div style="font-size:11.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;margin-top:12px">Este archivo es un borrador ordenado (fecha, póliza, cuenta, cargo, abono, concepto, UUID). Antes de importarlo a Aspel o CONTPAQi, ajusta el layout a la versión que usan y que lo revise Contabilidad.</div>'; }
window.__vp2Cuenta=(k,v)=>{ C.cuentas[k].c=String(v).trim(); };
window.__vp2GuardarCuentas=async function(){ try{ const c=await sb(), u=yo(); const r=await c.from('conta_config').upsert({id:'cuentas',datos:C.cuentas,actualizado_por:u.correo,actualizado_en:new Date().toISOString()}); if(r.error) throw r.error; toast('Catálogo guardado.'); pintarConta(); }catch(e){ alert('No se pudo guardar: '+(e.message||e)); } };
window.__vp2Polizas=function(){ const cu=C.cuentas||CUENTAS_BASE, m=C.mes, filas=[['Tipo','Póliza','Fecha','Cuenta','Nombre de la cuenta','Cargo','Abono','Concepto','Referencia','UUID']]; let n=0;
  const cta=k=>(cu[k]&&cu[k].c)||'('+((cu[k]&&cu[k].n)||k)+')', nom=k=>(cu[k]&&cu[k].n)||k;
  C.lista.filter(s=>String(s.entregado_en||'').slice(0,7)===m).forEach(s=>{ n++; const f=String(s.entregado_en).slice(0,10), monto=Number(s.monto_entregado)||0, con='Viáticos '+s.folio+' · '+(s.responsable_nombre||'');
    filas.push(['Egreso','E-'+n,f,cta('deudores'),nom('deudores')+' · '+(s.responsable_nombre||''),monto,'',con,s.referencia_pago||'','']); filas.push(['Egreso','E-'+n,f,cta('bancos'),nom('bancos'),'',monto,con,s.referencia_pago||'','']); });
  let d=0; C.lista.forEach(s=>(COMPS[s.id]||[]).filter(x=>x.estatus==='Aceptado'&&String(x.revisado_en||x.creado_en||'').slice(0,7)===m).forEach(x=>{ d++; const f=String(x.fecha_comprobante||x.revisado_en||x.creado_en).slice(0,10);
    const k=x.tipo==='no_deducible'?'nodeducible':(cu[x.categoria]?x.categoria:'otros'), tot=Number(x.total)||0, iva=x.tipo==='cfdi'?Number(x.iva)||0:0, con='Comprobación '+s.folio+' · '+(x.emisor_nombre||x.concepto||'')+(x.tipo==='factura_archivo'?' · IVA por desglosar':'');
    filas.push(['Diario','D-'+d,f,cta(k),nom(k),Math.round((tot-iva)*100)/100,'',con,x.serie_folio||'',x.uuid||'']); if(iva) filas.push(['Diario','D-'+d,f,cta('iva'),nom('iva'),iva,'',con,'',x.uuid||'']);
    filas.push(['Diario','D-'+d,f,cta('deudores'),nom('deudores')+' · '+(s.responsable_nombre||''),'',tot,con,'',x.uuid||'']); }));
  if(filas.length===1){ alert('No hay depósitos ni comprobaciones aceptadas en '+MES(m)+'.'); return; } csv('polizas_viaticos_'+m,filas); };

// ── Comprobación urgente: Contabilidad captura el comprobante por el técnico ──
window.__vp2ComprobarUrgente=function(id){ const s=C.lista.find(x=>x.id===id); if(!s) return; C.urg={archivos:[]};
  modal('<div style="display:flex;justify-content:space-between;gap:10px"><div><div style="font-size:18px;font-weight:800">Comprobar por el técnico</div><div style="font-size:12.5px;color:#6b7280">'+esc(s.folio)+' · '+esc(s.responsable_nombre||'')+' · solo para urgencias; queda registrado que lo capturó Contabilidad.</div></div><button class="vp2-ib" onclick="window.__vp2Detalle('+s.id+',\'conta\')">'+IC.cerrar+'</button></div>'+
    '<div class="vp2-lb" style="margin-top:12px">Tipo</div><div style="display:flex;gap:16px;margin:6px 0 11px"><label style="font-size:13px"><input type="radio" name="vp2u-tipo" value="factura_archivo" checked> Con factura</label><label style="font-size:13px"><input type="radio" name="vp2u-tipo" value="no_deducible"> Sin factura</label></div>'+
    '<label class="vp2-lb">Concepto<select id="vp2u-cat" class="vp2-fi">'+Object.keys(CATS).map(k=>'<option value="'+k+'">'+CATS[k]+'</option>').join('')+'</select></label>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="vp2-lb">Total<input id="vp2u-total" type="number" min="0" step="0.01" class="vp2-fi"></label><label class="vp2-lb">Fecha<input id="vp2u-fecha" type="date" class="vp2-fi" value="'+hoy()+'"></label></div>'+
    '<label class="vp2-lb">Negocio o descripción<input id="vp2u-neg" class="vp2-fi" placeholder="Ej. Hotel Plaza"></label>'+
    '<label class="vp2-lb">Fotos o PDF <span style="color:#dc2626">*</span><input id="vp2u-arch" type="file" multiple accept="image/*,application/pdf" class="vp2-fi" style="padding:7px"></label>'+
    '<label class="vp2-lb">¿Por qué lo captura Contabilidad?<input id="vp2u-mot" class="vp2-fi" placeholder="Ej. el técnico no tiene señal; mandó fotos por WhatsApp"></label>'+
    '<div id="vp2u-err" style="font-size:12px;color:#b91c1c;font-weight:700;min-height:16px"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="vp2-btn" onclick="window.__vp2Detalle('+s.id+',\'conta\')">Cancelar</button><button id="vp2u-btn" class="vp2-btn pri" onclick="window.__vp2GuardarUrgente('+s.id+')">Guardar comprobante</button></div>',true); };
window.__vp2GuardarUrgente=async function(id){ const s=C.lista.find(x=>x.id===id); if(!s) return; const err=document.getElementById('vp2u-err'), btn=document.getElementById('vp2u-btn');
  const tipo=(document.querySelector('input[name="vp2u-tipo"]:checked')||{}).value, cat=document.getElementById('vp2u-cat').value, total=Number(document.getElementById('vp2u-total').value)||0, fecha=document.getElementById('vp2u-fecha').value||null;
  const neg=document.getElementById('vp2u-neg').value.trim(), mot=document.getElementById('vp2u-mot').value.trim(), files=[].slice.call(document.getElementById('vp2u-arch').files||[]);
  if(!(total>0)){ err.textContent='Escribe el total.'; return; } if(!files.length){ err.textContent='Sube al menos una foto o PDF.'; return; } if(mot.length<5){ err.textContent='Escribe por qué lo capturas tú.'; return; }
  if(files.some(f=>f.size>10*1024*1024)){ err.textContent='Algún archivo pesa más de 10 MB.'; return; }
  btn.disabled=true; btn.textContent='Subiendo…';
  try{ const c=await sb(), u=yo(), rutas=[];
    for(let i=0;i<files.length;i++){ const f=files[i], ext=(String(f.name||'').split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,5)||'bin', ruta='viaticos/'+s.id+'/'+Date.now()+'_conta'+(i+1)+'.'+ext;
      const up=await c.storage.from(BUCKET).upload(ruta,f,{contentType:f.type||undefined,upsert:false}); if(up.error) throw up.error; rutas.push(ruta); }
    const pdfI=files.findIndex(f=>!/^image\//.test(f.type||'')), fotoI=files.findIndex(f=>/^image\//.test(f.type||''));
    const fila={viatico_id:s.id,viatico_folio:s.folio,folio_servicio:s.folio_servicio||null,tecnico_email:s.responsable_email||null,tecnico_nombre:(s.responsable_nombre||'')+' (capturó Contabilidad)',categoria:cat,tipo,estatus:'Aceptado',
      total,fecha_comprobante:fecha,emisor_nombre:tipo==='factura_archivo'?(neg||null):null,concepto:tipo==='no_deducible'?(neg||CATS[cat]):CATS[cat],pdf_path:pdfI>=0?rutas[pdfI]:null,foto_path:fotoI>=0?rutas[fotoI]:null,
      revisado_por:u.nombre||u.correo,revisado_en:new Date().toISOString(),validacion:{archivos:rutas,capturadoPor:u.nombre||u.correo,motivoCaptura:mot,avisos:['Capturado por Contabilidad: '+mot].concat(tipo==='factura_archivo'?['Factura en foto o PDF: descargar el XML del SAT.']:[]),ok:[]}};
    const r=await c.from('ops_viaticos_comprobantes').insert(fila).select().single(); if(r.error) throw r.error;
    (COMPS[s.id]=COMPS[s.id]||[]).push(r.data);
    if(s.responsable_email) avisoApp(s.responsable_email,'viat_tec_conta_captura','Contabilidad capturó por ti un comprobante de '+din(total)+' ('+CATS[cat]+') en tus viáticos '+s.folio+'.',s);
    toast('Comprobante guardado y aceptado.'); await window.__vp2Detalle(s.id,'conta'); pintarConta();
  }catch(e){ err.textContent='No se pudo guardar: '+(e.message||e); btn.disabled=false; btn.textContent='Guardar comprobante'; } };

window.__vp2ExportC=function(){ csv('viaticos_comprobacion',[['Folio','Responsable','Integrantes','Destino','Cliente','Empresa','Pagado el','Pagó','Forma','Referencia','Depositado','Comprobado','Falta','Límite','Estado','Comprobantes']]
  .concat(C.lista.map(s=>{ const e=estConta(s); return [s.folio,s.responsable_nombre,s.integrantes,s.destino,s.cliente,s.empresa_entrega,s.entregado_en?String(s.entregado_en).slice(0,10):'',s.pagado_por_nombre,FORMAS[s.forma_entrega]||s.forma_entrega,s.referencia_pago||'',e.dep,e.comprobado,e.falta,s.fecha_limite_comprobacion,e.t,e.n]; }))); };
window.__vp2Revisar=async function(compId,viaId,est){ let mot=null; if(est==='Rechazado'){ mot=prompt('¿Por qué se rechaza? (le llega al técnico)',''); if(mot===null) return; mot=mot.trim(); if(!mot){ alert('Escribe el motivo.'); return; } }
  try{ const c=await sb(), u=yo(); const r=await c.from('ops_viaticos_comprobantes').update({estatus:est,motivo_rechazo:mot,revisado_por:u.nombre||u.correo,revisado_en:new Date().toISOString()}).eq('id',compId); if(r.error) throw r.error;
    const x=(COMPS[viaId]||[]).find(k=>k.id===compId); const s=C.lista.find(k=>k.id===viaId);
    if(est==='Rechazado'&&x&&x.tecnico_email) avisoApp(x.tecnico_email,'viat_tec_rechazado','Contabilidad rechazó tu comprobante de '+din(x.total)+' en '+(s?s.folio:'tus viáticos')+': '+mot+'. Sube otro.',s||{id:viaId});
    await window.__vp2Detalle(viaId,'conta'); pintarConta(); }catch(e){ alert('No se pudo guardar: '+(e.message||e)); } };
window.__vp2Recordar=async function(id){ const s=C.lista.find(x=>x.id===id); if(!s) return; const e=estConta(s);
  const ok=await avisoApp(s.responsable_email,'viat_tec_recordatorio','Contabilidad: te falta comprobar '+din(e.falta)+' de tus viáticos '+s.folio+' (límite '+fc(s.fecha_limite_comprobacion)+'). Sube fotos o PDF de tus facturas en la app → Comprobar viáticos.',s);
  toast(ok?'Se le mandó el recordatorio a su app.':'No se pudo mandar el recordatorio.'); };

// ───────────── Enganche con las áreas ─────────────
// En Contabilidad se ocultan los tableros anteriores (indicadores y la bandeja de Flotilla que se colaba desde Pagos).
const OCULTAR_EN_CONTA=['conta-dashboard','pfl-cont','pagos-cxp','pagos-dashboard'];
const T=setInterval(()=>{ if(typeof window.verArea!=='function') return; clearInterval(T); const orig=window.verArea;
  window.verArea=function(area){ const r=orig.apply(this,arguments);
    setTimeout(()=>{
      const pp=document.getElementById('vp-pagos'), pc=document.getElementById('vp-conta');
      if(area==='Pagos'){ cargarPagos(); ['pagos-dashboard','pfl-cont'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; }); } else if(pp) pp.style.display='none';
      if(area==='Contabilidad'){ cargarConta(); OCULTAR_EN_CONTA.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; }); }
      else { if(pc) pc.style.display='none'; }
      if(area!=='Pagos'){ const pf=document.getElementById('pfl-cont'); if(pf) pf.style.display='none'; const cx=document.getElementById('pagos-cxp'); if(cx&&area!=='Pagos') cx.style.display='none'; }

    },80);
    return r; }; },200);
console.log('[VIÁTICOS v2 en Pagos y Contabilidad] listo');
})();


// ══════════════════════════════════════════════════════════════════════
// ACTIVIDADES DEL ÁREA EN PANEL LATERAL (29-oct-2026, v2) — aplica a todas las áreas
// En la página queda una barra compacta con el resumen (sin iniciar / en proceso / completadas)
// y un botón "Ver actividades". Al abrir, el MISMO bloque #area-actividades-wrap se pasa a un
// panel independiente pegado al <body> (así ningún efecto de la página lo esconde) y al cerrar
// regresa a su lugar. Filtros, buscador, editar, comentar y completar funcionan igual.
// ══════════════════════════════════════════════════════════════════════
(function(){
'use strict';
if(window.__tcActDrawer) return; window.__tcActDrawer=true;
function css(){ if(document.getElementById('act-dr-css')) return; const st=document.createElement('style'); st.id='act-dr-css'; st.textContent=`
#area-actividades-wrap.act-en-pagina{display:none!important}
#act-dr{position:fixed;top:0;right:0;height:100vh;width:min(1180px,96vw);background:#f4f5f7;z-index:3000;overflow-y:auto;box-sizing:border-box;padding:0 22px 26px;
  box-shadow:-18px 0 50px rgba(15,23,42,.18);transform:translateX(104%);transition:transform .28s ease;visibility:hidden}
#act-dr.abierto{transform:translateX(0);visibility:visible}
#act-dr-fondo{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:2990;opacity:0;pointer-events:none;transition:opacity .2s}
#act-dr-fondo.on{opacity:1;pointer-events:auto}
.act-dr-hd{position:sticky;top:0;z-index:2;background:#f4f5f7;display:flex;align-items:center;gap:12px;padding:18px 0 14px;margin-bottom:10px;border-bottom:1px solid #e5e7eb}
.act-dr-hd b{font-size:19px;color:#111827}.act-dr-hd span{font-size:12.5px;color:#6b7280}
.act-dr-x{margin-left:auto;width:38px;height:38px;border:1px solid #e5e7eb;background:#fff;border-radius:10px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:#374151}
.act-bar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:12px 16px;margin:4px 0 18px;font-family:inherit}
.act-bar .ico{width:36px;height:36px;border-radius:10px;background:#eef2ff;color:#3730a3;display:flex;align-items:center;justify-content:center}
.act-bar .tt{font-size:14px;font-weight:800;color:#111827}.act-bar .ss{font-size:12px;color:#6b7280}
.act-pill{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:5px 11px;font-size:12px;font-weight:700}
.act-pill i{width:8px;height:8px;border-radius:50%;background:currentColor;display:inline-block}
.act-btn{margin-left:auto;height:38px;border:none;border-radius:10px;padding:0 16px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;background:#111827;color:#fff;display:inline-flex;align-items:center;gap:8px}
`; document.head.appendChild(st); }
const ICO='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M7 11h4M7 15h7"/></svg>';
const X='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
let lugar=null, abierto=false;
function conteos(){ const el=document.getElementById('area-table')||{}; const t=el.innerText||el.textContent||''; const n=re=>{ const m=t.match(re); return m?Number(m[1]):null; };
  return { sin:n(/SIN\s+INICIAR\s*(\d+)/i), proc:n(/EN\s+PROCESO\s*(\d+)/i), comp:n(/COMPLETADAS\s*(\d+)/i) }; }
function area(){ const t=document.getElementById('area-title'); return t?String(t.innerText||t.textContent||'').replace(/^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+/,'').trim():''; }
function preparar(){ const w=document.getElementById('area-actividades-wrap'); if(!w) return null; css();
  if(!lugar){
    lugar=document.createComment('lugar de actividades'); w.parentNode.insertBefore(lugar,w);
    const bar=document.createElement('div'); bar.id='act-bar'; bar.className='act-bar'; w.parentNode.insertBefore(bar,w);
    const dr=document.createElement('div'); dr.id='act-dr'; dr.innerHTML='<div class="act-dr-hd"><div><b id="act-dr-tit">Actividades</b><br><span>Tareas, parrilla de documentos y pendientes compartidos</span></div><button class="act-dr-x" title="Cerrar (Esc)" onclick="window.__actDr(false)">'+X+'</button></div><div id="act-dr-cuerpo"></div>'; document.body.appendChild(dr);
    const f=document.createElement('div'); f.id='act-dr-fondo'; f.onclick=()=>window.__actDr(false); document.body.appendChild(f);
    w.classList.add('act-en-pagina');
    new MutationObserver(()=>pintarBarra()).observe(w,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['style']});
    document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&abierto) window.__actDr(false); });
    console.log('[Actividades] barra lista');
  }
  return w; }
let pT=null;
function pintarBarra(){ clearTimeout(pT); pT=setTimeout(()=>{ const w=document.getElementById('area-actividades-wrap'), bar=document.getElementById('act-bar'); if(!w||!bar) return;
  bar.style.display=(w.style.display==='none')?'none':'flex'; const c=conteos(), a=area();
  const tit=document.getElementById('act-dr-tit'); if(tit) tit.textContent='Actividades · '+(a||'área');
  const p=(t,n,c1,bg)=>n==null?'':'<span class="act-pill" style="color:'+c1+';background:'+bg+'"><i></i>'+t+' '+n+'</span>';
  bar.innerHTML='<div class="ico">'+ICO+'</div><div><div class="tt">Actividades del área</div><div class="ss">Tareas, parrilla de documentos y pendientes compartidos</div></div>'+
    p('Sin iniciar',c.sin,'#475569','#f1f5f9')+p('En proceso',c.proc,'#b45309','#fef3c7')+p('Completadas',c.comp,'#15803d','#dcfce7')+
    '<button class="act-btn" onclick="window.__actDr(true)">'+ICO+'Ver actividades</button>'; },120); }
window.__actDr=function(abrir){ const w=preparar(); if(!w) return; const dr=document.getElementById('act-dr'), f=document.getElementById('act-dr-fondo'), cu=document.getElementById('act-dr-cuerpo');
  if(abrir&&!abierto){ cu.appendChild(w); w.classList.remove('act-en-pagina'); w.style.display=''; }
  if(!abrir&&abierto){ lugar.parentNode.insertBefore(w,lugar.nextSibling.nextSibling||null); w.classList.add('act-en-pagina'); }
  abierto=!!abrir; dr.classList.toggle('abierto',abierto); f.classList.toggle('on',abierto); document.body.style.overflow=abierto?'hidden':''; if(abierto) dr.scrollTop=0; pintarBarra(); };
function iniciar(){ if(!document.getElementById('area-actividades-wrap')) return false; preparar(); pintarBarra(); return true; }
const T=setInterval(()=>{ if(typeof window.verArea!=='function'||!iniciar()) return; clearInterval(T); const orig=window.verArea;
  window.verArea=function(){ if(abierto) window.__actDr(false); const r=orig.apply(this,arguments); setTimeout(pintarBarra,150); setTimeout(pintarBarra,900); return r; }; },250);
})();
