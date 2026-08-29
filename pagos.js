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
        const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
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
  const fsMod  = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
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

const EMAILS_PAGOS = [
  'pagos@tecnocontrol.com.mx',
  'p.pinedo@tecnocontrol.com.mx',
  'c.acosta@tecnocontrol.com.mx',
  'm.delao@tecnocontrol.com.mx',
];

async function _getDB(){
  const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const fsMod  = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  const authMod= await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
  const app = appMod.getApps()[0];
  return { db:fsMod.getFirestore(app), fs:fsMod, auth:authMod.getAuth(app) };
}

function _esUsuarioPagos(email){
  if(!email) return false;
  // Admins totales siempre tienen acceso
  const ADMINS = ['rh@tecnocontrol.com.mx','c.acosta@tecnocontrol.com.mx',
    'mercadotecniatecnocontrol@tecnocontrol.com.mx','p.pinedo@tecnocontrol.com.mx',
    'm.delao@tecnocontrol.com.mx','fatima@tecnocontrol.com.mx'];
  return EMAILS_PAGOS.includes(email) || ADMINS.includes(email);
}

// Estado local
let _flSolsPago   = [];   // solicitudes con estatus Pagos
let _flFiltroStat = '';   // '' | 'vencida' | 'hoy' | 'proxima'
let _comentModal  = null; // id de sol abierta en modal comentarios

//  Render principal de la bandeja 
async function renderBandejaFlotilla(){
  const cont = document.getElementById('pfl-bandeja');
  if(!cont) return;

  cont.innerHTML = '<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13px">Cargando solicitudes...</div>';

  try {
    const { db, fs, auth } = await _getDB();
    const yo = auth.currentUser?.email || '';
    if(!_esUsuarioPagos(yo)){
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
      nots.push(fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
        solicitudId: solId,
        para:        s.creadoPor,
        vehiculoEco: s.vehiculoEco||'—',
        tipo:        'pagado',
        mensaje:     'El pago de tu solicitud (ECO '+(s.vehiculoEco||'—')+') fue procesado por Pagos · $'+Number(monto).toLocaleString('es-MX'),
        leido:       false,
        creadaEn:    new Date().toISOString(),
      }));
    }
    nots.push(fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      solicitudId: solId,
      para:        'fatima@tecnocontrol.com.mx',
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
    await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      solicitudId: solId,
      para:        'fatima@tecnocontrol.com.mx',
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
    if(area === 'Pagos'){
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
