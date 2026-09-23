// egresos.js — Dashboard de Egresos (registros individuales por categoría)
// Extraído de ventas.js (antes 'DASHBOARD EGRESOS v2') el 22-sep-2026, sin cambiar ni una línea de lógica.
// Sigue leyendo/escribiendo exactamente la misma colección de Firestore de siempre — nada de datos se movió.
// Requiere que ventas.js ya se haya cargado antes (usa window.verArea, que ventas.js define).
// DASHBOARD EGRESOS v2 — Registros individuales
(function(){
    'use strict';

    let egrMes = new Date().getMonth();
    let egrAnio = new Date().getFullYear();
    let egrRegs = [];
    let egrChartTend = null, egrChartGlobal = null;
    let egrEditId = null;
    const MESES_E = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

    function egrKey(){ return `${egrAnio}-${String(egrMes+1).padStart(2,'0')}`; }

    async function getFBE(){
        const a = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const f = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const au = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        const app = a.getApps()[0];
        return {db:f.getFirestore(app), auth:au.getAuth(app), fs:f};
    }

    function actualizarLabelEgr(){
        const el = document.getElementById('egresos-mes-label');
        if(el) el.innerText = `${MESES_E[egrMes]} ${egrAnio}`;
    }

    window.egresosMesPrev = () => { egrMes--; if(egrMes<0){egrMes=11;egrAnio--;} actualizarLabelEgr(); cargarEgrRegs(); };
    window.egresosMesNext = () => { egrMes++; if(egrMes>11){egrMes=0;egrAnio++;} actualizarLabelEgr(); cargarEgrRegs(); };

    async function cargarEgrRegs(){
        const key = egrKey();
        try {
            const {db,fs} = await getFBE();
            const snap = await fs.getDocs(fs.query(fs.collection(db,'egresos_registros'),fs.where('mesKey','==',key)));
            egrRegs = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
            calcEgrKPIs();
            renderEgrLista();
        } catch(e){
            console.warn('[EGR v2]',e.message);
            egrRegs=[];
            calcEgrKPIs();
            renderEgrLista();
        }
    }

    function calcEgrKPIs(){
        const set = (id,v) => {const el=document.getElementById(id);if(el)el.innerText=v;};
        const setD = (id,h) => {const el=document.getElementById(id);if(el)el.innerHTML=`<span class="rh-kpi-delta neutral">${h}</span>`;};
        const total = egrRegs.length;
        const colorP = (v,m,inv) => {if(inv) return v<=m?'#16a34a':v<=m*2?'#f59e0b':'#ef4444'; return v>=m?'#16a34a':v>=m*0.85?'#f59e0b':'#ef4444';};

        if(!total){
            ['egr-val-registro','egr-val-precision','egr-val-soporte','egr-val-sinsoporte','egr-val-reclass','egr-val-conciliacion'].forEach(id=>set(id,'—'));
            ['egr-delta-registro','egr-delta-precision','egr-delta-soporte','egr-delta-sinsoporte','egr-delta-reclass','egr-delta-conciliacion'].forEach(id=>setD(id,'Sin registros'));
            document.getElementById('egr-global-pct').innerText='—';
            return;
        }

        const oport = egrRegs.filter(r=>r.registroOportuno==='si').length;
        const pOport = Math.round(oport/total*100);
        set('egr-val-registro', pOport+'%');
        setD('egr-delta-registro', `<span style="color:${colorP(pOport,95,false)}">${oport}/${total}</span> · Meta ≥ 95%`);

        const prec = egrRegs.filter(r=>r.sinError==='si').length;
        const pPrec = Math.round(prec/total*100);
        set('egr-val-precision', pPrec+'%');
        setD('egr-delta-precision', `<span style="color:${colorP(pPrec,98,false)}">${prec}/${total}</span> · Meta ≥ 98%`);

        const sop = egrRegs.filter(r=>r.soporteCompleto==='si').length;
        const pSop = Math.round(sop/total*100);
        set('egr-val-soporte', pSop+'%');
        setD('egr-delta-soporte', `<span style="color:${colorP(pSop,98,false)}">${sop}/${total}</span> · Meta ≥ 98%`);

        const sinSop = egrRegs.filter(r=>r.soporteCompleto==='no').length;
        const pSinSop = total>0?Math.round(sinSop/total*1000)/10:0;
        set('egr-val-sinsoporte', pSinSop+'%');
        setD('egr-delta-sinsoporte', `<span style="color:${colorP(pSinSop,2,true)}">${sinSop}/${total}</span> · Meta ≤ 2%`);

        const recl = egrRegs.filter(r=>r.fueReclasificado==='si').length;
        const pRecl = total>0?Math.round(recl/total*1000)/10:0;
        set('egr-val-reclass', pRecl+'%');
        setD('egr-delta-reclass', `<span style="color:${colorP(pRecl,3,true)}">${recl}/${total}</span> · Meta ≤ 3%`);

        const conc = egrRegs.filter(r=>r.conciliado==='si').length;
        const pConc = Math.round(conc/total*100);
        set('egr-val-conciliacion', pConc+'%');
        setD('egr-delta-conciliacion', `<span style="color:${colorP(pConc,98,false)}">${conc}/${total}</span> · Meta ≥ 98%`);

        const promedio = Math.round((pOport+pPrec+pSop+pConc)/4);
        const elG = document.getElementById('egr-chart-global');
        if(elG){
            if(egrChartGlobal) egrChartGlobal.destroy();
            egrChartGlobal = new Chart(elG,{type:'doughnut',data:{datasets:[{data:[promedio,Math.max(0.001,100-promedio)],backgroundColor:[promedio>=80?'#16a34a':promedio>=50?'#f59e0b':'#ef4444','#e2e8f0'],borderWidth:0}]},options:{cutout:'76%',plugins:{legend:{display:false}},animation:{duration:600}}});
            document.getElementById('egr-global-pct').innerText=promedio+'%';
            const det=document.getElementById('egr-global-detalle');
            if(det) det.innerHTML=`<b>${total}</b> egresos registrados este mes`;
        }
    }

    function renderEgrLista(){
        const el = document.getElementById('egr-registros-lista');
        const countEl = document.getElementById('egr-registros-count');
        if(!el) return;
        let lista = [...egrRegs];
        const q = (document.getElementById('egr-buscar')?.value||'').toLowerCase();
        const filtro = document.getElementById('egr-filtro-cat')?.value||'todos';
        if(q) lista=lista.filter(r=>(r.proveedor||'').toLowerCase().includes(q)||(r.concepto||'').toLowerCase().includes(q)||(r.area||'').toLowerCase().includes(q)||(r.responsable||'').toLowerCase().includes(q));
        if(filtro==='no_oportuno') lista=lista.filter(r=>r.registroOportuno==='no');
        if(filtro==='con_error') lista=lista.filter(r=>r.sinError==='no');
        if(filtro==='sin_soporte') lista=lista.filter(r=>r.soporteCompleto==='no');
        if(filtro==='reclasificado') lista=lista.filter(r=>r.fueReclasificado==='si');
        if(filtro==='no_conciliado') lista=lista.filter(r=>r.conciliado==='no');
        if(countEl) countEl.innerText=`(${lista.length} de ${egrRegs.length})`;
        if(!lista.length){el.innerHTML='<div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">Sin registros. Clic en "➕ Nuevo registro".</div>';return;}

        const ok='<span style="background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">✓</span>';
        const no='<span style="background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">✗</span>';

        el.innerHTML=`
        <div style="display:grid;grid-template-columns:0.7fr 1.4fr 1fr 0.7fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 70px;gap:5px;padding:8px 10px;background:#f8faff;border-radius:8px;margin-bottom:6px;font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">
            <span>Fecha</span><span>Proveedor</span><span>Área</span><span>Monto</span><span>Opor.</span><span>Prec.</span><span>Sop.</span><span>Recl.</span><span>Conc.</span><span></span>
        </div>
        ${lista.map(r=>`<div style="display:grid;grid-template-columns:0.7fr 1.4fr 1fr 0.7fr 0.5fr 0.5fr 0.5fr 0.5fr 0.5fr 70px;gap:5px;padding:9px 10px;border-bottom:1px solid rgba(59,130,246,0.06);align-items:center;font-size:11px;">
            <span style="color:#64748b;font-size:10px;">${r.fecha||'—'}</span>
            <div><div style="font-weight:700;color:#1e293b;font-size:11px;">${r.proveedor||'—'}</div><div style="font-size:9px;color:#94a3b8;">${r.concepto||''}</div></div>
            <span>${r.area||'—'}</span>
            <span style="font-weight:700;">${r.monto?'$'+Number(r.monto).toLocaleString('es-MX'):'—'}</span>
            <span>${r.registroOportuno==='si'?ok:no}</span>
            <span>${r.sinError==='si'?ok:no}</span>
            <span>${r.soporteCompleto==='si'?ok:no}</span>
            <span>${r.fueReclasificado==='si'?no:ok}</span>
            <span>${r.conciliado==='si'?ok:no}</span>
            <div style="display:flex;gap:3px;justify-content:flex-end;">
                <button onclick="editarEgrReg('${r.id}')" style="padding:3px 6px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:9px;cursor:pointer;">✏️</button>
                <button onclick="eliminarEgrReg('${r.id}')" style="padding:3px 6px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:9px;cursor:pointer;">🗑</button>
            </div>
        </div>`).join('')}`;
    }

    window.egrBuscar = () => renderEgrLista();
    window.egrFiltrar = (tipo) => {
        const sel=document.getElementById('egr-filtro-cat');
        const map={registro:'no_oportuno',precision:'con_error',soporte:'sin_soporte',sinsoporte:'sin_soporte',reclass:'reclasificado',conciliacion:'no_conciliado'};
        if(sel) sel.value=map[tipo]||'todos';
        renderEgrLista();
    };

    window.abrirEgresosRegistro = (editId) => {
        egrEditId = editId || null;
        const form = document.getElementById('egresos-inline-form');
        const content = document.getElementById('egresos-form-content');
        const titulo = document.getElementById('egresos-form-titulo');
        if(!form||!content) return;
        if(titulo) titulo.innerText = editId ? '✏️ Editar registro' : '📤 Nuevo registro de egreso';
        const r = editId ? egrRegs.find(x=>x.id===editId) || {} : {};

        content.innerHTML = `
        <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;">📋 Datos del egreso</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">Fecha del egreso</label><input class="rh-form-input" id="er-fecha" type="date" value="${r.fecha||new Date().toISOString().slice(0,10)}"></div>
            <div><label class="rh-form-label">Proveedor / Beneficiario</label><input class="rh-form-input" id="er-proveedor" type="text" value="${r.proveedor||''}" placeholder="Nombre" list="er-prov-list"></div>
            <div><label class="rh-form-label">Concepto</label><input class="rh-form-input" id="er-concepto" type="text" value="${r.concepto||''}" placeholder="Descripción breve"></div>
        </div>
        <datalist id="er-prov-list">${[...new Set(egrRegs.map(r=>r.proveedor).filter(Boolean))].map(p=>`<option value="${p}">`).join('')}</datalist>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">Monto ($)</label><input class="rh-form-input" id="er-monto" type="number" min="0" step="0.01" value="${r.monto||''}" placeholder="0.00"></div>
            <div><label class="rh-form-label">Tipo de egreso</label><select class="rh-form-input" id="er-tipo"><option ${r.tipoEgreso==='Operativo'?'selected':''}>Operativo</option><option ${r.tipoEgreso==='Administrativo'?'selected':''}>Administrativo</option><option ${r.tipoEgreso==='Financiero'?'selected':''}>Financiero</option><option ${r.tipoEgreso==='Viáticos'?'selected':''}>Viáticos</option><option ${r.tipoEgreso==='Caja chica'?'selected':''}>Caja chica</option></select></div>
            <div><label class="rh-form-label">Área que genera</label><input class="rh-form-input" id="er-area" type="text" value="${r.area||''}" placeholder="Ej: Operaciones, Compras..." list="er-area-list"></div>
            <div><label class="rh-form-label">Canal registro</label><select class="rh-form-input" id="er-canal"><option ${r.canalRegistro==='Sistema'?'selected':''}>Sistema</option><option ${r.canalRegistro==='Excel'?'selected':''}>Excel</option><option ${r.canalRegistro==='Manual'?'selected':''}>Manual</option></select></div>
        </div>
        <datalist id="er-area-list">${[...new Set(egrRegs.map(r=>r.area).filter(Boolean))].map(a=>`<option value="${a}">`).join('')}</datalist>

        <div style="font-size:12px;font-weight:700;color:#92400e;margin:14px 0 8px;">📊 Indicadores</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">¿Registro oportuno?</label><select class="rh-form-input" id="er-oportuno"><option value="si" ${r.registroOportuno!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.registroOportuno==='no'?'selected':''}>❌ No</option></select></div>
            <div><label class="rh-form-label">¿Sin errores?</label><select class="rh-form-input" id="er-sinerror" onchange="document.getElementById('er-error-det').style.display=this.value==='no'?'block':'none'"><option value="si" ${r.sinError!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.sinError==='no'?'selected':''}>❌ No</option></select></div>
            <div><label class="rh-form-label">¿Soporte completo?</label><select class="rh-form-input" id="er-soporte" onchange="document.getElementById('er-soporte-det').style.display=this.value==='no'?'block':'none'"><option value="si" ${r.soporteCompleto!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.soporteCompleto==='no'?'selected':''}>❌ No</option></select></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">¿Fue reclasificado?</label><select class="rh-form-input" id="er-reclass" onchange="document.getElementById('er-reclass-det').style.display=this.value==='si'?'block':'none'"><option value="no" ${r.fueReclasificado!=='si'?'selected':''}>✅ No</option><option value="si" ${r.fueReclasificado==='si'?'selected':''}>🔄 Sí</option></select></div>
            <div><label class="rh-form-label">¿Conciliado?</label><select class="rh-form-input" id="er-conciliado" onchange="document.getElementById('er-conc-det').style.display=this.value==='no'?'block':'none'"><option value="si" ${r.conciliado!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.conciliado==='no'?'selected':''}>❌ No</option></select></div>
            <div><label class="rh-form-label">Días de atraso</label><select class="rh-form-input" id="er-diasatraso"><option value="0" ${r.diasAtraso==='0'||!r.diasAtraso?'selected':''}>0 — en tiempo</option><option value="1-2" ${r.diasAtraso==='1-2'?'selected':''}>1–2 días</option><option value="3+" ${r.diasAtraso==='3+'?'selected':''}>3+ días</option></select></div>
        </div>

        <div id="er-error-det" style="display:${r.sinError==='no'?'block':'none'};background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:8px;">❌ Detalle del error</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Tipo de error</label><select class="rh-form-input" id="er-tipoerror"><option ${r.tipoError==='Cuenta contable'?'selected':''}>Cuenta contable</option><option ${r.tipoError==='Monto'?'selected':''}>Monto</option><option ${r.tipoError==='IVA'?'selected':''}>IVA</option><option ${r.tipoError==='Proveedor'?'selected':''}>Proveedor</option><option ${r.tipoError==='Otro'?'selected':''}>Otro</option></select></div>
                <div><label class="rh-form-label">Etapa</label><select class="rh-form-input" id="er-etapaerror"><option ${r.etapaError==='Captura'?'selected':''}>Captura</option><option ${r.etapaError==='Revisión'?'selected':''}>Revisión</option><option ${r.etapaError==='Autorización'?'selected':''}>Autorización</option></select></div>
                <div><label class="rh-form-label">Impacto ($)</label><input class="rh-form-input" id="er-impacto" type="number" min="0" step="0.01" value="${r.impactoError||''}" placeholder="0.00"></div>
            </div>
        </div>

        <div id="er-soporte-det" style="display:${r.soporteCompleto==='no'?'block':'none'};background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#a16207;margin-bottom:8px;">📎 Detalle soporte faltante</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Doc. faltante</label><select class="rh-form-input" id="er-docfaltante"><option ${r.docFaltante==='Factura'?'selected':''}>Factura</option><option ${r.docFaltante==='XML'?'selected':''}>XML</option><option ${r.docFaltante==='Orden de compra'?'selected':''}>Orden de compra</option><option ${r.docFaltante==='Evidencia'?'selected':''}>Evidencia</option><option ${r.docFaltante==='Contrato'?'selected':''}>Contrato</option></select></div>
                <div><label class="rh-form-label">Estatus</label><select class="rh-form-input" id="er-estatussop"><option ${r.estatusSoporte==='Pendiente'?'selected':''}>Pendiente</option><option ${r.estatusSoporte==='Regularizado'?'selected':''}>Regularizado</option><option ${r.estatusSoporte==='Cancelado'?'selected':''}>Cancelado</option></select></div>
            </div>
        </div>

        <div id="er-reclass-det" style="display:${r.fueReclasificado==='si'?'block':'none'};background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#2563eb;margin-bottom:8px;">🔄 Detalle reclasificación</div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Cuenta origen</label><input class="rh-form-input" id="er-cuentaorigen" type="text" value="${r.cuentaOrigen||''}" placeholder="Cuenta incorrecta"></div>
                <div><label class="rh-form-label">Cuenta correcta</label><input class="rh-form-input" id="er-cuentacorrecta" type="text" value="${r.cuentaCorrecta||''}" placeholder="Cuenta destino"></div>
                <div><label class="rh-form-label">Tipo error</label><select class="rh-form-input" id="er-tiporeclass"><option ${r.tipoReclass==='Clasificación'?'selected':''}>Clasificación</option><option ${r.tipoReclass==='Centro costos'?'selected':''}>Centro costos</option><option ${r.tipoReclass==='Proyecto'?'selected':''}>Proyecto</option></select></div>
            </div>
        </div>

        <div id="er-conc-det" style="display:${r.conciliado==='no'?'block':'none'};background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:12px;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:#0e7490;margin-bottom:8px;">🏦 Detalle conciliación</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                <div><label class="rh-form-label">Banco / Cuenta</label><input class="rh-form-input" id="er-banco" type="text" value="${r.banco||''}" placeholder="Ej: BBVA, Banorte..."></div>
                <div><label class="rh-form-label">Tipo diferencia</label><select class="rh-form-input" id="er-tipodifconc"><option ${r.tipoDifConc==='Cargo no registrado'?'selected':''}>Cargo no registrado</option><option ${r.tipoDifConc==='Abono no identificado'?'selected':''}>Abono no identificado</option><option ${r.tipoDifConc==='Error banco'?'selected':''}>Error banco</option></select></div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div><label class="rh-form-label">Responsable captura</label><input class="rh-form-input" id="er-responsable" type="text" value="${r.responsable||''}" placeholder="Quién registró"></div>
            <div><label class="rh-form-label">Motivo atraso (si aplica)</label><select class="rh-form-input" id="er-motivoatraso"><option value="" ${!r.motivoAtraso?'selected':''}>N/A</option><option ${r.motivoAtraso==='Falta de info'?'selected':''}>Falta de info</option><option ${r.motivoAtraso==='Carga operativa'?'selected':''}>Carga operativa</option><option ${r.motivoAtraso==='Error'?'selected':''}>Error</option><option ${r.motivoAtraso==='Autorización'?'selected':''}>Autorización</option></select></div>
        </div>
        <label class="rh-form-label" style="margin-top:10px;">Notas</label>
        <input class="rh-form-input" id="er-notas" type="text" value="${r.notas||''}" placeholder="Observaciones...">`;

        form.style.display = 'block';
        form.scrollIntoView({behavior:'smooth',block:'start'});
    };

    window.cerrarEgresosInline = () => {
        const form = document.getElementById('egresos-inline-form');
        if(form) form.style.display = 'none';
        egrEditId = null;
    };

    window.editarEgrReg = (id) => { abrirEgresosRegistro(id); };
    window.eliminarEgrReg = async (id) => {
        if(!confirm('¿Eliminar este registro?')) return;
        try { const{db,fs}=await getFBE(); await fs.deleteDoc(fs.doc(db,'egresos_registros',id)); if(window.mostrarPush) window.mostrarPush('🗑 Eliminado','','📤'); cargarEgrRegs(); }
        catch(e){ alert('Error: '+e.message); }
    };

    window.guardarEgresoRegistro = async () => {
        const g = id => {const el=document.getElementById(id);return el?el.value.trim():'';};
        const gn = id => {const v=g(id);return v?Number(v):undefined;};
        if(!g('er-proveedor')){ alert('Escribe el proveedor'); return; }

        const btn = document.querySelector('#egresos-inline-form button');
        if(btn){btn.textContent='💾 Guardando...';btn.disabled=true;}

        const docData = {
            mesKey: egrKey(),
            fecha: g('er-fecha')||new Date().toISOString().slice(0,10),
            proveedor: g('er-proveedor'), concepto: g('er-concepto'),
            monto: gn('er-monto'), tipoEgreso: g('er-tipo'),
            area: g('er-area'), canalRegistro: g('er-canal'),
            registroOportuno: g('er-oportuno'), sinError: g('er-sinerror'),
            soporteCompleto: g('er-soporte'), fueReclasificado: g('er-reclass'),
            conciliado: g('er-conciliado'), diasAtraso: g('er-diasatraso'),
            tipoError: g('er-tipoerror'), etapaError: g('er-etapaerror'),
            impactoError: gn('er-impacto'),
            docFaltante: g('er-docfaltante'), estatusSoporte: g('er-estatussop'),
            cuentaOrigen: g('er-cuentaorigen'), cuentaCorrecta: g('er-cuentacorrecta'),
            tipoReclass: g('er-tiporeclass'),
            banco: g('er-banco'), tipoDifConc: g('er-tipodifconc'),
            responsable: g('er-responsable'), motivoAtraso: g('er-motivoatraso'),
            notas: g('er-notas'), actualizadoEn: new Date().toISOString()
        };
        Object.keys(docData).forEach(k=>{if(docData[k]===undefined||docData[k]==='')delete docData[k];});

        try {
            const{db,fs,auth}=await getFBE();
            docData.creadoPor=auth.currentUser?.email||'';
            if(egrEditId){await fs.updateDoc(fs.doc(db,'egresos_registros',egrEditId),docData);console.log('[EGR v2] ✅ Actualizado:',egrEditId);}
            else{const ref=await fs.addDoc(fs.collection(db,'egresos_registros'),docData);console.log('[EGR v2] ✅ Creado:',ref.id);}
            cerrarEgresosInline();
            if(window.mostrarPush) window.mostrarPush('✅ Egreso registrado',docData.proveedor,'📤');
            cargarEgrRegs();
        } catch(e){console.error('[EGR v2 ERROR]',e);alert('Error: '+e.message);}
        finally{if(btn){btn.textContent='💾 GUARDAR REGISTRO';btn.disabled=false;}}
    };

    // Hook
    const CHECK_E = setInterval(()=>{
        if(typeof window.verArea!=='function') return;
        clearInterval(CHECK_E);
        const _orig = window.verArea;
        window.verArea = function(area,btn){
            _orig(area,btn);
            const dash=document.getElementById('egresos-dashboard');
            if(!dash) return;
            if(area==='Egresos'){dash.style.display='block';actualizarLabelEgr();cargarEgrRegs();}
            else{dash.style.display='none';}
        };
    },200);

    console.log('[EGRESOS v2] ✅ Módulo cargado');
})();
