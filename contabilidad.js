// contabilidad.js — Dashboard de Contabilidad (Balanza, Edos. Financieros, Deudores/Acreedores, Inventarios, Impuestos)
// Extraído de ventas.js (antes 'DASHBOARD CONTABILIDAD v2') el 22-sep-2026, sin cambiar ni una línea de lógica.
// Sigue leyendo/escribiendo exactamente la misma colección de Firestore de siempre — nada de datos se movió.
// Requiere que ventas.js ya se haya cargado antes (usa window.verArea, que ventas.js define).
// DASHBOARD CONTABILIDAD v2 — Registros individuales
(function(){
    'use strict';

    let contaMes = new Date().getMonth();
    let contaAnio = new Date().getFullYear();
    let contaRegs = [];
    let contaChartTend = null, contaChartGlobal = null;
    let contaEditId = null;
    const MESES_C = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const CATS = {balanza:'📒 Balanza',edosfin:'📊 Edos. Financieros',deudores:'🤝 Deudores/Acreed.',inventarios:'📦 Inventarios',impuestos:'🏛️ Impuestos'};

    function contaKey(){ return `${contaAnio}-${String(contaMes+1).padStart(2,'0')}`; }

   async function getFBStorage(){
  const {getStorage, ref, uploadBytes, getDownloadURL} = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js');
  const storage = getStorage(window.app);
  return {storage, storageRef: ref, uploadBytes, getDownloadURL};
}
    async function getFB(){
        const a = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
        const f = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
        const au = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
        const app = a.getApps()[0];
        return {db:f.getFirestore(app), auth:au.getAuth(app), fs:f};
    }

    function actualizarLabelConta(){
        const el = document.getElementById('conta-mes-label');
        if(el) el.innerText = `${MESES_C[contaMes]} ${contaAnio}`;
    }

    window.contaMesPrev = () => { contaMes--; if(contaMes<0){contaMes=11;contaAnio--;} actualizarLabelConta(); cargarContaRegs(); };
    window.contaMesNext = () => { contaMes++; if(contaMes>11){contaMes=0;contaAnio++;} actualizarLabelConta(); cargarContaRegs(); };

    async function cargarContaRegs(){
        const key = contaKey();
        try {
            const {db,fs} = await getFB();
            const snap = await fs.getDocs(fs.query(fs.collection(db,'conta_registros'),fs.where('mesKey','==',key)));
            contaRegs = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
            calcContaKPIs();
            renderContaLista();
        } catch(e){
            console.warn('[CONTA v2]',e.message);
            contaRegs=[];
            calcContaKPIs();
            renderContaLista();
        }
    }

    function calcContaKPIs(){
        const set = (id,v) => {const el=document.getElementById(id);if(el)el.innerText=v;};
        const setD = (id,h) => {const el=document.getElementById(id);if(el)el.innerHTML=`<span class="rh-kpi-delta neutral">${h}</span>`;};
        const total = contaRegs.length;

        if(!total){
            ['conta-val-balanza','conta-val-edosfin','conta-val-deudores','conta-val-inventarios','conta-val-impuestos'].forEach(id=>set(id,'—'));
            ['conta-delta-balanza','conta-delta-edosfin','conta-delta-deudores','conta-delta-inventarios','conta-delta-impuestos'].forEach(id=>setD(id,'Sin registros'));
            document.getElementById('conta-global-pct').innerText='—';
            return;
        }

        const byCat = (cat) => contaRegs.filter(r=>r.categoria===cat);
        const pctOk = (arr, field) => {if(!arr.length) return 0; return Math.round(arr.filter(r=>r[field]==='si').length/arr.length*100);};
        const colorP = (v,m,inv) => {if(inv) return v<=m?'#16a34a':v<=m*2?'#f59e0b':'#ef4444'; return v>=m?'#16a34a':v>=m*0.85?'#f59e0b':'#ef4444';};

        const bal = byCat('balanza');
        const pBal = pctOk(bal,'conciliada');
        set('conta-val-balanza', bal.length?pBal+'%':'—');
        setD('conta-delta-balanza', `${bal.filter(r=>r.conciliada==='si').length}/${bal.length} conc. · Meta ≥ 98%`);

        const edo = byCat('edosfin');
        const pEdo = pctOk(edo,'entregaTiempo');
        set('conta-val-edosfin', edo.length?pEdo+'%':'—');
        setD('conta-delta-edosfin', `${edo.filter(r=>r.entregaTiempo==='si').length}/${edo.length} en tiempo · Meta 100%`);

        const deu = byCat('deudores');
        const pDeu = pctOk(deu,'saldoConciliado');
        set('conta-val-deudores', deu.length?pDeu+'%':'—');
        const vencidos = deu.length?Math.round(deu.filter(r=>r.estaVencido==='si').length/deu.length*100):0;
        setD('conta-delta-deudores', `Conc: ${pDeu}% · Venc: ${vencidos}%`);

        const inv = byCat('inventarios');
        const pInv = pctOk(inv,'registroActualizado');
        set('conta-val-inventarios', inv.length?pInv+'%':'—');
        const difInv = inv.length?Math.round(inv.filter(r=>r.tieneDiferencia==='si').length/inv.length*100):0;
        setD('conta-delta-inventarios', `Actual: ${pInv}% · Dif: ${difInv}%`);

        const imp = byCat('impuestos');
        const pImp = pctOk(imp,'cumpleTiempo');
        set('conta-val-impuestos', imp.length?pImp+'%':'—');
        setD('conta-delta-impuestos', `${imp.filter(r=>r.cumpleTiempo==='si').length}/${imp.length} en tiempo · Meta 100%`);

        const vals = [pBal,pEdo,pDeu,pInv,pImp].filter((_,i)=>[bal,edo,deu,inv,imp][i].length>0);
        const promedio = vals.length?Math.round(vals.reduce((s,v)=>s+v,0)/vals.length):0;

        const elG = document.getElementById('conta-chart-global');
        if(elG){
            if(contaChartGlobal) contaChartGlobal.destroy();
            contaChartGlobal = new Chart(elG,{type:'doughnut',data:{datasets:[{data:[promedio,Math.max(0.001,100-promedio)],backgroundColor:[promedio>=80?'#16a34a':promedio>=50?'#f59e0b':'#ef4444','#e2e8f0'],borderWidth:0}]},options:{cutout:'76%',plugins:{legend:{display:false}},animation:{duration:600}}});
            document.getElementById('conta-global-pct').innerText=promedio+'%';
            const det=document.getElementById('conta-global-detalle');
            if(det) det.innerHTML=`<b>${total}</b> registros · Bal:${bal.length} Edo:${edo.length} Deu:${deu.length} Inv:${inv.length} Imp:${imp.length}`;
        }
    }

    function renderContaLista(){
        const el = document.getElementById('conta-registros-lista');
        const countEl = document.getElementById('conta-registros-count');
        if(!el) return;
        let lista = [...contaRegs];
        const q = (document.getElementById('conta-buscar')?.value||'').toLowerCase();
        const catF = document.getElementById('conta-filtro-cat')?.value||'todos';
        if(q) lista=lista.filter(r=>(r.descripcion||'').toLowerCase().includes(q)||(r.cuenta||'').toLowerCase().includes(q)||(r.responsable||'').toLowerCase().includes(q)||(r.proveedor||'').toLowerCase().includes(q)||(r.producto||'').toLowerCase().includes(q));
        if(catF!=='todos') lista=lista.filter(r=>r.categoria===catF);
        if(countEl) countEl.innerText=`(${lista.length} de ${contaRegs.length})`;
        if(!lista.length){el.innerHTML='<div style="text-align:center;color:#94a3b8;padding:24px;font-size:12px;">Sin registros. Clic en "➕ Nuevo registro".</div>';return;}

        const catColors = {balanza:'#2563eb',edosfin:'#059669',deudores:'#f59e0b',inventarios:'#7c3aed',impuestos:'#ef4444'};
        const chipOk='<span style="background:#dcfce7;color:#16a34a;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">✓</span>';
        const chipNo='<span style="background:#fee2e2;color:#dc2626;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700;">✗</span>';

        el.innerHTML=lista.map(r=>{
            const cat=CATS[r.categoria]||r.categoria;
            const color=catColors[r.categoria]||'#64748b';
            const mainField = r.descripcion||r.cuenta||r.proveedor||r.producto||r.tipoImpuesto||'—';
            const statusField = r.conciliada||r.entregaTiempo||r.saldoConciliado||r.registroActualizado||r.cumpleTiempo||'';
            return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid rgba(59,130,246,0.06);border-left:3px solid ${color};">
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;color:#1e293b;font-size:12px;">${mainField}</div>
                    <div style="font-size:10px;color:#64748b;margin-top:2px;">${cat} · ${r.fecha||''} · ${r.responsable||''}</div>
                    ${r.monto?`<div style="font-size:10px;color:#94a3b8;">$${Number(r.monto).toLocaleString('es-MX')}</div>`:''}
                </div>
                <div>${statusField==='si'?chipOk:statusField==='no'?chipNo:''}</div>
                <div style="display:flex;gap:4px;">
                    <button onclick="editarContaReg('${r.id}')" style="padding:3px 7px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:10px;cursor:pointer;">✏️</button>
                    <button onclick="eliminarContaReg('${r.id}')" style="padding:3px 7px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;">🗑</button>
                </div>
            </div>`;
        }).join('');
    }

    window.contaBuscar = () => renderContaLista();
    window.contaFiltrar = (cat) => {const sel=document.getElementById('conta-filtro-cat');if(sel)sel.value=cat;renderContaLista();};

    // Formulario dinámico según categoría
    const FORMS = {
        balanza: (r={}) => `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">Cuenta contable</label><input class="rh-form-input" id="cr-cuenta" type="text" value="${r.cuenta||''}" placeholder="Ej: 1101 Bancos"></div>
                <div><label class="rh-form-label">Tipo de cuenta</label><select class="rh-form-input" id="cr-tipocuenta"><option ${r.tipoCuenta==='Bancos'?'selected':''}>Bancos</option><option ${r.tipoCuenta==='Clientes'?'selected':''}>Clientes</option><option ${r.tipoCuenta==='Proveedores'?'selected':''}>Proveedores</option><option ${r.tipoCuenta==='Impuestos'?'selected':''}>Impuestos</option><option ${r.tipoCuenta==='Gastos'?'selected':''}>Gastos</option><option ${r.tipoCuenta==='Otro'?'selected':''}>Otro</option></select></div>
                <div><label class="rh-form-label">Área responsable</label><input class="rh-form-input" id="cr-area" type="text" value="${r.areaResponsable||''}" placeholder="Ej: CxP, Tesorería..."></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">¿Conciliada?</label><select class="rh-form-input" id="cr-conciliada"><option value="si" ${r.conciliada!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.conciliada==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">¿Cuenta crítica?</label><select class="rh-form-input" id="cr-critica"><option value="no" ${r.cuentaCritica!=='si'?'selected':''}>No</option><option value="si" ${r.cuentaCritica==='si'?'selected':''}>Sí</option></select></div>
                <div><label class="rh-form-label">Días sin conciliar</label><input class="rh-form-input" id="cr-diassinconc" type="number" min="0" value="${r.diasSinConciliar||''}" placeholder="0"></div>
                <div><label class="rh-form-label">Método</label><select class="rh-form-input" id="cr-metodo"><option ${r.metodoConciliacion==='Sistema'?'selected':''}>Sistema</option><option ${r.metodoConciliacion==='Manual'?'selected':''}>Manual</option></select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                <div><label class="rh-form-label">Monto diferencia ($)</label><input class="rh-form-input" id="cr-monto" type="number" min="0" step="0.01" value="${r.monto||''}" placeholder="0.00"></div>
                <div><label class="rh-form-label">Motivo no conciliación</label><select class="rh-form-input" id="cr-motivo"><option value="" ${!r.motivoNoConciliacion?'selected':''}>N/A</option><option ${r.motivoNoConciliacion==='Falta info'?'selected':''}>Falta info</option><option ${r.motivoNoConciliacion==='Diferencia'?'selected':''}>Diferencia</option><option ${r.motivoNoConciliacion==='Error registro'?'selected':''}>Error registro</option><option ${r.motivoNoConciliacion==='Timing'?'selected':''}>Timing</option></select></div>
                <div><label class="rh-form-label">Responsable</label><input class="rh-form-input" id="cr-responsable" type="text" value="${r.responsable||''}" placeholder="Quién concilia"></div>
            </div>`,

        edosfin: (r={}) => `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">Descripción / Etapa</label><input class="rh-form-input" id="cr-descripcion" type="text" value="${r.descripcion||''}" placeholder="Ej: Balance general, Estado de resultados..."></div>
                <div><label class="rh-form-label">Área que entrega info</label><select class="rh-form-input" id="cr-areaentrega"><option ${r.areaEntrega==='CxP'?'selected':''}>CxP</option><option ${r.areaEntrega==='CxC'?'selected':''}>CxC</option><option ${r.areaEntrega==='Inventarios'?'selected':''}>Inventarios</option><option ${r.areaEntrega==='Impuestos'?'selected':''}>Impuestos</option><option ${r.areaEntrega==='Nómina'?'selected':''}>Nómina</option><option ${r.areaEntrega==='Otra'?'selected':''}>Otra</option></select></div>
                <div><label class="rh-form-label">Etapa del cierre</label><select class="rh-form-input" id="cr-etapacierre"><option ${r.etapaCierre==='Pre-cierre'?'selected':''}>Pre-cierre</option><option ${r.etapaCierre==='Ajustes'?'selected':''}>Ajustes</option><option ${r.etapaCierre==='Revisión'?'selected':''}>Revisión</option><option ${r.etapaCierre==='Emisión'?'selected':''}>Emisión</option></select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">¿Entrega en tiempo?</label><select class="rh-form-input" id="cr-entregatiempo"><option value="si" ${r.entregaTiempo!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.entregaTiempo==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">¿Sin ajustes?</label><select class="rh-form-input" id="cr-sinajustes"><option value="si" ${r.sinAjustes!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.sinAjustes==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">Versiones previas (#)</label><input class="rh-form-input" id="cr-versiones" type="number" min="0" value="${r.versionesPrevias||''}" placeholder="0"></div>
                <div><label class="rh-form-label">Fecha cierre</label><input class="rh-form-input" id="cr-fechacierre" type="date" value="${r.fechaCierre||''}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div><label class="rh-form-label">Tipo ajuste (si aplica)</label><select class="rh-form-input" id="cr-tipoajuste"><option value="">N/A</option><option ${r.tipoAjuste==='Contable'?'selected':''}>Contable</option><option ${r.tipoAjuste==='Fiscal'?'selected':''}>Fiscal</option><option ${r.tipoAjuste==='Reclasificación'?'selected':''}>Reclasificación</option></select></div>
                <div><label class="rh-form-label">Responsable</label><input class="rh-form-input" id="cr-responsable" type="text" value="${r.responsable||''}" placeholder="Quién entrega"></div>
            </div>`,

        deudores: (r={}) => `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">Cliente / Proveedor</label><input class="rh-form-input" id="cr-proveedor" type="text" value="${r.proveedor||''}" placeholder="Nombre"></div>
                <div><label class="rh-form-label">Tipo</label><select class="rh-form-input" id="cr-tipodeu"><option ${r.tipoDeudor==='Cliente'?'selected':''}>Cliente</option><option ${r.tipoDeudor==='Proveedor'?'selected':''}>Proveedor</option></select></div>
                <div><label class="rh-form-label">Área (CxC / CxP)</label><select class="rh-form-input" id="cr-areadeu"><option ${r.areaDeu==='CxC'?'selected':''}>CxC</option><option ${r.areaDeu==='CxP'?'selected':''}>CxP</option></select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">¿Saldo conciliado?</label><select class="rh-form-input" id="cr-saldoconc"><option value="si" ${r.saldoConciliado!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.saldoConciliado==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">¿Está vencido?</label><select class="rh-form-input" id="cr-vencido"><option value="no" ${r.estaVencido!=='si'?'selected':''}>No</option><option value="si" ${r.estaVencido==='si'?'selected':''}>⚠️ Sí</option></select></div>
                <div><label class="rh-form-label">Antigüedad</label><select class="rh-form-input" id="cr-aging"><option ${r.aging==='0-30'?'selected':''}>0-30 días</option><option ${r.aging==='30-60'?'selected':''}>30-60 días</option><option ${r.aging==='60-90'?'selected':''}>60-90 días</option><option ${r.aging==='90-120'?'selected':''}>90-120 días</option><option ${r.aging==='120+'?'selected':''}>120+ días</option></select></div>
                <div><label class="rh-form-label">Monto ($)</label><input class="rh-form-input" id="cr-monto" type="number" min="0" step="0.01" value="${r.monto||''}" placeholder="0.00"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div><label class="rh-form-label">Tipo diferencia</label><select class="rh-form-input" id="cr-tipodif"><option value="">N/A</option><option ${r.tipoDiferencia==='Factura no registrada'?'selected':''}>Factura no registrada</option><option ${r.tipoDiferencia==='Pago no aplicado'?'selected':''}>Pago no aplicado</option><option ${r.tipoDiferencia==='Nota de crédito'?'selected':''}>Nota de crédito</option><option ${r.tipoDiferencia==='Error'?'selected':''}>Error</option></select></div>
                <div><label class="rh-form-label">Responsable</label><input class="rh-form-input" id="cr-responsable" type="text" value="${r.responsable||''}" placeholder="Responsable de seguimiento"></div>
            </div>`,

        inventarios: (r={}) => `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">Producto / SKU</label><input class="rh-form-input" id="cr-producto" type="text" value="${r.producto||''}" placeholder="Nombre o código"></div>
                <div><label class="rh-form-label">Ubicación</label><input class="rh-form-input" id="cr-ubicacion" type="text" value="${r.ubicacion||''}" placeholder="Almacén, sucursal..."></div>
                <div><label class="rh-form-label">Tipo inventario</label><select class="rh-form-input" id="cr-tipoinv"><option ${r.tipoInventario==='Crítico'?'selected':''}>Crítico</option><option ${r.tipoInventario==='Rotación alta'?'selected':''}>Rotación alta</option><option ${r.tipoInventario==='Regular'?'selected':''}>Regular</option><option ${r.tipoInventario==='Obsoleto'?'selected':''}>Obsoleto</option></select></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">¿Tiene diferencia?</label><select class="rh-form-input" id="cr-tienedif"><option value="no" ${r.tieneDiferencia!=='si'?'selected':''}>✅ No</option><option value="si" ${r.tieneDiferencia==='si'?'selected':''}>❌ Sí</option></select></div>
                <div><label class="rh-form-label">¿Registro actualizado?</label><select class="rh-form-input" id="cr-regactualizado"><option value="si" ${r.registroActualizado!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.registroActualizado==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">Tipo diferencia</label><select class="rh-form-input" id="cr-tipodif"><option value="">N/A</option><option ${r.tipoDiferencia==='Merma'?'selected':''}>Merma</option><option ${r.tipoDiferencia==='Error captura'?'selected':''}>Error captura</option><option ${r.tipoDiferencia==='Robo'?'selected':''}>Robo</option><option ${r.tipoDiferencia==='Ajuste'?'selected':''}>Ajuste</option></select></div>
                <div><label class="rh-form-label">Monto dif. ($)</label><input class="rh-form-input" id="cr-monto" type="number" min="0" step="0.01" value="${r.monto||''}" placeholder="0.00"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div><label class="rh-form-label">Tipo movimiento</label><select class="rh-form-input" id="cr-tipomov"><option ${r.tipoMovimiento==='Entrada'?'selected':''}>Entrada</option><option ${r.tipoMovimiento==='Salida'?'selected':''}>Salida</option><option ${r.tipoMovimiento==='Ajuste'?'selected':''}>Ajuste</option></select></div>
                <div><label class="rh-form-label">Responsable almacén</label><input class="rh-form-input" id="cr-responsable" type="text" value="${r.responsable||''}" placeholder="Nombre"></div>
            </div>`,

        impuestos: (r={}) => `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">Tipo de impuesto</label><select class="rh-form-input" id="cr-tipoimpuesto"><option ${r.tipoImpuesto==='IVA'?'selected':''}>IVA</option><option ${r.tipoImpuesto==='ISR'?'selected':''}>ISR</option><option ${r.tipoImpuesto==='Retenciones'?'selected':''}>Retenciones</option><option ${r.tipoImpuesto==='IEPS'?'selected':''}>IEPS</option><option ${r.tipoImpuesto==='Locales'?'selected':''}>Locales</option><option ${r.tipoImpuesto==='Otro'?'selected':''}>Otro</option></select></div>
                <div><label class="rh-form-label">Fecha límite</label><input class="rh-form-input" id="cr-fechalimite" type="date" value="${r.fechaLimite||''}"></div>
                <div><label class="rh-form-label">Fecha presentación</label><input class="rh-form-input" id="cr-fechapres" type="date" value="${r.fechaPresentacion||''}"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:12px;">
                <div><label class="rh-form-label">¿Cumple en tiempo?</label><select class="rh-form-input" id="cr-cumpletiempo"><option value="si" ${r.cumpleTiempo!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.cumpleTiempo==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">¿Conciliado fiscal?</label><select class="rh-form-input" id="cr-concfiscal"><option value="si" ${r.conciliadoFiscal!=='no'?'selected':''}>✅ Sí</option><option value="no" ${r.conciliadoFiscal==='no'?'selected':''}>❌ No</option></select></div>
                <div><label class="rh-form-label">Multas / recargos ($)</label><input class="rh-form-input" id="cr-multas" type="number" min="0" step="0.01" value="${r.multas||''}" placeholder="0.00"></div>
                <div><label class="rh-form-label">Monto variación ($)</label><input class="rh-form-input" id="cr-monto" type="number" min="0" step="0.01" value="${r.monto||''}" placeholder="0.00"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div><label class="rh-form-label">Tipo diferencia fiscal</label><select class="rh-form-input" id="cr-tipodiffiscal"><option value="">N/A</option><option ${r.tipoDifFiscal==='Timing'?'selected':''}>Timing</option><option ${r.tipoDifFiscal==='Deducción'?'selected':''}>Deducción</option><option ${r.tipoDifFiscal==='Error'?'selected':''}>Error</option></select></div>
                <div><label class="rh-form-label">Responsable</label><input class="rh-form-input" id="cr-responsable" type="text" value="${r.responsable||''}" placeholder="Quién presenta"></div>
            </div>`
    };

    window.abrirContaRegistro = (editId) => {
        contaEditId = editId || null;
        const form = document.getElementById('conta-inline-form');
        const content = document.getElementById('conta-form-content');
        const titulo = document.getElementById('conta-form-titulo');
        if(!form||!content) return;
        if(titulo) titulo.innerText = editId ? '✏️ Editar registro' : '🧾 Nuevo registro';

        const r = editId ? contaRegs.find(x=>x.id===editId) || {} : {};
        const catVal = r.categoria || 'balanza';

        content.innerHTML = `
        <div style="margin-bottom:14px;">
            <label class="rh-form-label">Categoría del registro</label>
            <select class="rh-form-input" id="cr-categoria" onchange="renderContaFormCat()">
                ${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${catVal===k?'selected':''}>${v}</option>`).join('')}
            </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div><label class="rh-form-label">Fecha del registro</label><input class="rh-form-input" id="cr-fecha" type="date" value="${r.fecha||new Date().toISOString().slice(0,10)}"></div>
            <div><label class="rh-form-label">Descripción general</label><input class="rh-form-input" id="cr-desc-general" type="text" value="${r.descripcion||''}" placeholder="Resumen breve del registro"></div>
        </div>
        <div id="cr-campos-cat"></div>
        <label class="rh-form-label" style="margin-top:12px;">Notas / observaciones</label>
        <input class="rh-form-input" id="cr-notas" type="text" value="${r.notas||''}" placeholder="Información adicional...">`;

        window._contaEditData = r;
        renderContaFormCat();
        form.style.display = 'block';
        form.scrollIntoView({behavior:'smooth',block:'start'});
    };

    window.renderContaFormCat = () => {
        const cat = document.getElementById('cr-categoria')?.value || 'balanza';
        const el = document.getElementById('cr-campos-cat');
        if(!el) return;
        const r = window._contaEditData || {};
        el.innerHTML = FORMS[cat] ? FORMS[cat](r) : '';
    };

    window.cerrarContaInline = () => {
        const form = document.getElementById('conta-inline-form');
        if(form) form.style.display = 'none';
        contaEditId = null;
        window._contaEditData = null;
    };

    window.editarContaReg = (id) => { abrirContaRegistro(id); };
    window.eliminarContaReg = async (id) => {
        if(!confirm('¿Eliminar este registro?')) return;
        try { const{db,fs}=await getFB(); await fs.deleteDoc(fs.doc(db,'conta_registros',id)); if(window.mostrarPush) window.mostrarPush('🗑 Eliminado','','🧾'); cargarContaRegs(); }
        catch(e){ alert('Error: '+e.message); }
    };

    window.guardarContaRegistro = async () => {
        const g = id => {const el=document.getElementById(id);return el?el.value.trim():'';};
        const gn = id => {const v=g(id);return v?Number(v):undefined;};
        const cat = g('cr-categoria');
        if(!cat){ alert('Selecciona una categoría'); return; }

        const btn = document.querySelector('#conta-inline-form button');
        if(btn){btn.textContent='💾 Guardando...';btn.disabled=true;}

        const base = {
            mesKey: contaKey(),
            categoria: cat,
            fecha: g('cr-fecha') || new Date().toISOString().slice(0,10),
            descripcion: g('cr-desc-general'),
            notas: g('cr-notas'),
            actualizadoEn: new Date().toISOString()
        };

        let extra = {};
        switch(cat){
            case 'balanza': extra={cuenta:g('cr-cuenta'),tipoCuenta:g('cr-tipocuenta'),areaResponsable:g('cr-area'),conciliada:g('cr-conciliada'),cuentaCritica:g('cr-critica'),diasSinConciliar:gn('cr-diassinconc'),metodoConciliacion:g('cr-metodo'),monto:gn('cr-monto'),motivoNoConciliacion:g('cr-motivo'),responsable:g('cr-responsable')};break;
            case 'edosfin': extra={areaEntrega:g('cr-areaentrega'),etapaCierre:g('cr-etapacierre'),entregaTiempo:g('cr-entregatiempo'),sinAjustes:g('cr-sinajustes'),versionesPrevias:gn('cr-versiones'),fechaCierre:g('cr-fechacierre'),tipoAjuste:g('cr-tipoajuste'),responsable:g('cr-responsable')};break;
            case 'deudores': extra={proveedor:g('cr-proveedor'),tipoDeudor:g('cr-tipodeu'),areaDeu:g('cr-areadeu'),saldoConciliado:g('cr-saldoconc'),estaVencido:g('cr-vencido'),aging:g('cr-aging'),monto:gn('cr-monto'),tipoDiferencia:g('cr-tipodif'),responsable:g('cr-responsable')};break;
            case 'inventarios': extra={producto:g('cr-producto'),ubicacion:g('cr-ubicacion'),tipoInventario:g('cr-tipoinv'),tieneDiferencia:g('cr-tienedif'),registroActualizado:g('cr-regactualizado'),tipoDiferencia:g('cr-tipodif'),monto:gn('cr-monto'),tipoMovimiento:g('cr-tipomov'),responsable:g('cr-responsable')};break;
            case 'impuestos': extra={tipoImpuesto:g('cr-tipoimpuesto'),fechaLimite:g('cr-fechalimite'),fechaPresentacion:g('cr-fechapres'),cumpleTiempo:g('cr-cumpletiempo'),conciliadoFiscal:g('cr-concfiscal'),multas:gn('cr-multas'),monto:gn('cr-monto'),tipoDifFiscal:g('cr-tipodiffiscal'),responsable:g('cr-responsable')};break;
        }

        const docData = {...base,...extra};
        Object.keys(docData).forEach(k=>{if(docData[k]===undefined||docData[k]==='')delete docData[k];});

        try {
            const{db,fs,auth}=await getFB();
            docData.creadoPor=auth.currentUser?.email||'';
            if(contaEditId){
                await fs.updateDoc(fs.doc(db,'conta_registros',contaEditId),docData);
                console.log('[CONTA v2] ✅ Actualizado:',contaEditId);
            } else {
                const ref=await fs.addDoc(fs.collection(db,'conta_registros'),docData);
                console.log('[CONTA v2] ✅ Creado:',ref.id);
            }
            cerrarContaInline();
            if(window.mostrarPush) window.mostrarPush('✅ Registro guardado',docData.descripcion||cat,'🧾');
            cargarContaRegs();
        } catch(e){
            console.error('[CONTA v2 ERROR]',e);
            alert('Error: '+e.message);
        } finally {
            if(btn){btn.textContent='💾 GUARDAR REGISTRO';btn.disabled=false;}
        }
    };

    // Hook
    const CHECK_C = setInterval(()=>{
        if(typeof window.verArea!=='function') return;
        clearInterval(CHECK_C);
        const _orig = window.verArea;
        window.verArea = function(area,btn){
            _orig(area,btn);
            const dash=document.getElementById('conta-dashboard');
            if(!dash) return;
            if(area==='Contabilidad'){dash.style.display='block';actualizarLabelConta();cargarContaRegs();}
            else{dash.style.display='none';}
        };
    },200);

    console.log('[CONTA v2] ✅ Módulo cargado');
})();
