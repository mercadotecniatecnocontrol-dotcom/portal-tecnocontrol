// rh-indicadores.js — Indicadores semanales de RH (registro/edición/eliminación, resumen semanal)
// Extraído de ventas.js (antes 'RH FIX v3') el 22-sep-2026, sin cambiar ni una línea de lógica.
// Sigue leyendo/escribiendo exactamente la misma colección de Firestore de siempre — nada de datos se movió.
// Requiere que ventas.js ya se haya cargado antes (usa window.verArea, que ventas.js define).
// NOTA: esto es distinto de rh.js (RH 360°/colaboradores) — es el módulo de indicadores semanales que vivía
// mezclado dentro de ventas.js, separado de la ficha de colaboradores.
// RH FIX v3 — Override completo incluyendo recarga de datos
// Corrige: guardado, edición, y VISUALIZACIÓN después de guardar

(function(){
    'use strict';

    const CHECK_INTERVAL = 400;
    const MAX_ATTEMPTS = 50;
    let attempts = 0;

    const waitForModule = setInterval(() => {
        attempts++;
        if(typeof window.guardarRHInline !== 'function' || 
           typeof window.abrirRHInline !== 'function' ||
           typeof window.verArea !== 'function'){
            if(attempts >= MAX_ATTEMPTS){
                clearInterval(waitForModule);
                console.warn('[RH FIX v3] Timeout');
            }
            return;
        }
        clearInterval(waitForModule);
        aplicarFixes();
    }, CHECK_INTERVAL);

    function aplicarFixes(){
        
        // Helper para detectar tipo actual del formulario
        function detectarTipoRH(){
            // 1. Tab activo
            const activeTab = document.querySelector('.rh-tab.active');
            if(activeTab){
                const onclick = activeTab.getAttribute('onclick') || '';
                const m = onclick.match(/rhTabSwitch\('([^']+)'/);
                if(m) return m[1];
            }
            // 2. Desde el título del form inline
            const titleEl = document.getElementById('rh-inline-title');
            if(titleEl){
                const txt = titleEl.textContent.toLowerCase();
                if(txt.includes('retardo')) return 'retardo';
                if(txt.includes('falta') || txt.includes('permiso')) return 'falta';
                if(txt.includes('descuento')) return 'descuento';
                if(txt.includes('rotación') || txt.includes('rotacion')) return 'rotacion';
                if(txt.includes('vacante')) return 'vacante';
                if(txt.includes('acta')) return 'acta';
                if(txt.includes('capacitación') || txt.includes('capacitacion')) return 'capacitacion';
                if(txt.includes('incapacidad')) return 'incapacidad';
            }
            // 3. Desde los IDs de campos presentes
            if(document.getElementById('rh-f-minutos')) return 'retardo';
            if(document.getElementById('rh-f-tipoFalta')) return 'falta';
            if(document.getElementById('rh-f-monto')) return 'descuento';
            if(document.getElementById('rh-f-movimiento')) return 'rotacion';
            if(document.getElementById('rh-f-vacEstatus')) return 'vacante';
            if(document.getElementById('rh-f-tipoActa')) return 'acta';
            if(document.getElementById('rh-f-capNombre')) return 'capacitacion';
            if(document.getElementById('rh-f-incFolio')) return 'incapacidad';
            return '';
        }

        // Helper para leer campos
        function get(id){
            if(id === 'rh-f-area'){
                const sel = document.getElementById('rh-f-area-sel');
                if(sel){
                    if(sel.value && sel.value !== '__otra__') return sel.value;
                    const inputLibre = document.getElementById('rh-f-area');
                    if(inputLibre && inputLibre.value.trim()) return inputLibre.value.trim();
                    return sel.options[0]?.value || 'General';
                }
                const el = document.getElementById('rh-f-area');
                return el ? el.value.trim() : 'General';
            }
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        }

        // Calcular semana ISO desde una fecha
        function calcSemanaKey(d){
            const dt = new Date(d); dt.setHours(0,0,0,0);
            const day = dt.getDay();
            const diffToMon = (day === 0) ? -6 : 1 - day;
            const lunes = new Date(dt);
            lunes.setDate(dt.getDate() + diffToMon);
            const yearStart = new Date(lunes.getFullYear(), 0, 1);
            const weekNum = Math.ceil(((lunes - yearStart) / 86400000 + yearStart.getDay() + 1) / 7);
            return `${lunes.getFullYear()}-W${String(weekNum).padStart(2,'0')}`;
        }

        // Rango Sábado → Viernes (como el sistema original)
        function getRangoSemanaActual(){
            const d = new Date(); d.setHours(0,0,0,0);
            const day = d.getDay();
            const diffToSab = day === 6 ? 0 : -(day + 1);
            const inicio = new Date(d);
            inicio.setDate(d.getDate() + diffToSab);
            const fin = new Date(inicio);
            fin.setDate(inicio.getDate() + 6);
            return {
                inicio,
                fin,
                iniStr: inicio.toISOString().slice(0,10),
                finStr: fin.toISOString().slice(0,10),
                mesAnio: inicio.getFullYear() + '-' + String(inicio.getMonth()+1).padStart(2,'0'),
                semanaKey: calcSemanaKey(inicio)
            };
        }

        // Obtener instancias de Firebase
        async function getFirebase(){
            const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
            const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
            const authMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
            const app = appMod.getApps()[0];
            return {
                db: fsMod.getFirestore(app),
                auth: authMod.getAuth(app),
                fs: fsMod
            };
        }
        // RENDERIZAR secciones de RH con datos frescos
        async function recargarYRenderizarRH(){
            try {
                const { db, fs } = await getFirebase();
                const rango = getRangoSemanaActual();
                
                console.log(`[RH FIX v3] Cargando datos semana: ${rango.iniStr} → ${rango.finStr} (${rango.semanaKey})`);

                const snap = await fs.getDocs(fs.collection(db, 'rh_indicadores'));
                
                // Mapa tipo → clave plural (como usa el código original)
                const tipoMap = {
                    'retardo':'retardos', 'falta':'faltas', 'descuento':'descuentos',
                    'vacante':'vacantes', 'acta':'actas', 'rotacion':'rotacion',
                    'capacitacion':'capacitacion', 'incapacidad':'incapacidad'
                };

                const semData = { 
                    retardos:[], faltas:[], descuentos:[], vacantes:[], 
                    actas:[], rotacion:[], capacitacion:[], incapacidad:[] 
                };

                let totalDocs = 0;
                let matched = 0;

                snap.docs.forEach(d => {
                    const data = d.data();
                    const tipo = data.tipo;
                    totalDocs++;
                    const arrayKey = tipoMap[tipo];
                    if(!arrayKey || !semData[arrayKey]) return;

                    // MÚLTIPLES criterios de match (OR) — muy permisivo
                    const matchKey = data.semanaKey === rango.semanaKey;
                    const matchFecha = data.fecha && data.fecha >= rango.iniStr && data.fecha <= rango.finStr;
                    const creadoFecha = data.creadoEn ? data.creadoEn.slice(0,10) : '';
                    const matchCreado = creadoFecha >= rango.iniStr && creadoFecha <= rango.finStr;
                    const matchMes = data.mesAnio === rango.mesAnio;

                    // Vacantes y actas se muestran por MES (no por semana)
                    const esMensual = tipo === 'vacante' || tipo === 'acta';
                    if(esMensual){
                        if(matchMes || matchFecha){ semData[arrayKey].push({id: d.id, ...data}); matched++; }
                    } else {
                        if(matchKey || matchFecha || matchCreado || matchMes){ semData[arrayKey].push({id: d.id, ...data}); matched++; }
                    }
                });

                console.log(`[RH FIX v3] Total docs: ${totalDocs} | Matched: ${matched}`);
                console.log('[RH FIX v3] Desglose:', Object.entries(semData)
                    .map(([k,v]) => v.length ? `${k}:${v.length}` : '')
                    .filter(Boolean).join(' | ') || 'ninguno');

                // ── Forzar actualización visual ──
                // Actualizar los KPIs directamente en el DOM
                actualizarKPIsRH(semData);
                // Actualizar las tablas de secciones
                actualizarSeccionesRH(semData);

            } catch(e) {
                console.error('[RH FIX v3 LOAD ERROR]', e);
            }
        }

        function actualizarKPIsRH(data){
            const setKPI = (id, val) => {
                const el = document.getElementById(id);
                if(el) el.innerText = val;
            };
            const setDelta = (id, html) => {
                const el = document.getElementById(id);
                if(el) el.innerHTML = `<span class="rh-kpi-delta neutral">${html}</span>`;
            };

            const ret = data.retardos || [];
            const falt = data.faltas || [];
            const desc = data.descuentos || [];
            const rot = data.rotacion || [];
            const vac = data.vacantes || [];
            const cap = data.capacitacion || [];
            const inc = data.incapacidad || [];

            setKPI('rh-val-rotacion', rot.length);
            setDelta('rh-delta-rotacion', `${rot.filter(r=>r.movimiento==='alta').length} altas · ${rot.filter(r=>(r.movimiento||'').includes('baja')).length} bajas`);

            setKPI('rh-val-faltas', falt.length);
            setDelta('rh-delta-faltas', `${falt.filter(f=>f.tipoFalta==='injustificada').length} injust. · ${falt.filter(f=>(f.tipoFalta||'').includes('permiso')).length} permisos`);

            setKPI('rh-val-retardos', ret.length);
            setDelta('rh-delta-retardos', `≈${ret.reduce((s,r)=>s+(Number(r.minutos)||0),0)} min totales`);

            const totalDesc = desc.reduce((s,d)=>s+(Number(d.monto)||0),0);
            setKPI('rh-val-descuentos', '$' + totalDesc.toLocaleString('es-MX'));
            setDelta('rh-delta-descuentos', `${desc.length} descuentos`);

            setKPI('rh-val-vacantes', vac.length);
            setDelta('rh-delta-vacantes', `${vac.filter(v=>v.estatus==='concretada').length} concretadas`);

            setKPI('rh-val-capacitacion', cap.length);
            setDelta('rh-delta-capacitacion', `${cap.reduce((s,c)=>{
                const asis = (c.asistentes||'').split(',').filter(Boolean).length;
                return s + asis;
            }, 0)} asistentes`);

            setKPI('rh-val-incapacidad', inc.length);
            setDelta('rh-delta-incapacidad', `${inc.reduce((s,i)=>s+(Number(i.dias)||0),0)} días totales`);
        }

        function actualizarSeccionesRH(data){
            // Helper para armar tabla
            const tabla = (lista, campos, tipo) => {
                if(!lista.length) return '<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin registros esta semana</div>';
                return lista.map(r => `
                    <div style="display:grid;grid-template-columns:${Array(campos.length).fill('1fr').join(' ')} 80px;gap:8px;padding:9px 12px;border-bottom:1px solid rgba(59,130,246,0.06);align-items:center;">
                        ${campos.map(f=>`<span style="font-size:12px;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r[f.key]||''}">${f.prefix||''}${r[f.key]||'—'}</span>`).join('')}
                        <div style="display:flex;gap:4px;justify-content:flex-end;">
                            <button onclick="abrirModalRH('${tipo}','${r.id}')" style="padding:3px 7px;background:#eff6ff;color:#2563eb;border:none;border-radius:6px;font-size:10px;cursor:pointer;">✏️</button>
                            <button onclick="eliminarRH('${r.id}')" style="padding:3px 7px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:10px;cursor:pointer;">🗑</button>
                        </div>
                    </div>`).join('');
            };

            const header = (cols) => `
                <div style="display:grid;grid-template-columns:${Array(cols.length).fill('1fr').join(' ')} 80px;gap:8px;padding:7px 12px;background:#f8faff;border-radius:8px;margin-bottom:4px;">
                    ${cols.map(c=>`<span style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${c}</span>`).join('')}
                    <span></span>
                </div>`;

            // Vacantes
            const vacEl = document.getElementById('rh-vacantes-lista');
            if(vacEl){
                vacEl.innerHTML = (data.vacantes||[]).length
                    ? header(['Puesto','Área','Apertura','Estatus']) + tabla(data.vacantes, [
                        {key:'puesto'},{key:'area'},{key:'fecha'},{key:'estatus'}
                    ], 'vacante')
                    : '<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin vacantes esta semana</div>';
            }

            // Actas
            const actEl = document.getElementById('rh-actas-lista');
            if(actEl){
                actEl.innerHTML = (data.actas||[]).length
                    ? header(['Colaborador','Área','Fecha','Tipo']) + tabla(data.actas, [
                        {key:'nombre'},{key:'area'},{key:'fecha'},{key:'tipoActa'}
                    ], 'acta')
                    : '<div style="text-align:center;color:#94a3b8;padding:12px;font-size:12px;">Sin actas esta semana</div>';
            }

            // Registros extra (retardos, faltas, descuentos, capacitaciones, incapacidades, rotación)
            const rhExtraEl = document.getElementById('rh-registros-extra');
            if(rhExtraEl){
                const seccion = (titulo, emoji, lista, campos, tipo, color) => `
                    <div style="background:#ffffff;border-radius:14px;padding:16px;border:1px solid rgba(59,130,246,0.08);margin-bottom:12px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                            <span style="font-size:12px;font-weight:700;color:#1e293b;">${emoji} ${titulo} <span style="font-weight:400;color:#64748b;">(${lista.length})</span></span>
                            <button onclick="abrirModalRH('${tipo}')" style="padding:4px 10px;background:${color};color:white;border:none;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;">+ Agregar</button>
                        </div>
                        ${header(campos.map(f=>f.label))}
                        ${tabla(lista, campos.map(f=>({key:f.key})), tipo)}
                    </div>`;

                rhExtraEl.innerHTML =
                    seccion('Retardos','⏰', data.retardos||[],
                        [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Fecha',key:'fecha'},{label:'Hora',key:'hora'},{label:'Min.',key:'minutos'}],
                        'retardo','#2563eb') +
                    seccion('Faltas y Permisos','📅', data.faltas||[],
                        [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Fecha',key:'fecha'},{label:'Tipo',key:'tipoFalta'},{label:'Días',key:'dias'}],
                        'falta','#f59e0b') +
                    seccion('Descuentos','💰', data.descuentos||[],
                        [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Fecha',key:'fecha'},{label:'Monto',key:'monto'}],
                        'descuento','#7c3aed') +
                    seccion('Capacitaciones','🎓', data.capacitacion||[],
                        [{label:'Capacitación',key:'nombre'},{label:'Imparte',key:'impartidor'},{label:'Fecha',key:'fecha'},{label:'Lugar',key:'lugar'}],
                        'capacitacion','#059669') +
                    seccion('Incapacidades','🏥', data.incapacidad||[],
                        [{label:'Colaborador',key:'nombre'},{label:'Área',key:'area'},{label:'Folio',key:'folio'},{label:'Días',key:'dias'}],
                        'incapacidad','#ef4444') +
                    '';
            }
        }
        // Override guardarRHInline y guardarDatoRH
        async function guardarRegistroRH(origen){
            const tipo = detectarTipoRH();
            if(!tipo){ alert('No se pudo determinar el tipo de registro'); return; }

            // Validaciones
            const needsNombre = ['retardo','falta','descuento','rotacion','acta','incapacidad'];
            if(needsNombre.includes(tipo) && !get('rh-f-nombre')){
                alert('Escribe el nombre del colaborador'); return;
            }
            if(tipo === 'capacitacion' && !get('rh-f-capNombre')){
                alert('Escribe el nombre de la capacitación'); return;
            }

            const fechaForm = get('rh-f-fecha') || new Date().toISOString().slice(0,10);
            const fechaObj = new Date(fechaForm + 'T12:00:00');
            const semanaKeyCalc = calcSemanaKey(fechaObj);
            const mesAnioCalc = fechaObj.getFullYear() + '-' + String(fechaObj.getMonth()+1).padStart(2,'0');

            console.log(`[RH SAVE] tipo=${tipo} fecha=${fechaForm} semKey=${semanaKeyCalc} mes=${mesAnioCalc}`);

            const btnInline = document.querySelector('#rh-inline-form button');
            const btnModal = document.querySelector('#modal-rh .rh-add-btn');
            const btn = origen === 'inline' ? btnInline : btnModal;
            if(btn){ btn.textContent = '💾 Guardando...'; btn.disabled = true; }

            const editId = document.getElementById('rh-inline-form')?.dataset?.editId || null;

            let docData = {
                semanaKey: semanaKeyCalc,
                mesAnio: mesAnioCalc,
                fecha: fechaForm,
                creadoEn: new Date().toISOString(),
                creadoPor: '',
                tipo
            };

            switch(tipo){
                case 'retardo':
                    Object.assign(docData, { nombre: get('rh-f-nombre'), area: get('rh-f-area'), hora: get('rh-f-hora'), minutos: Number(get('rh-f-minutos')) || 0, notas: get('rh-f-notas') }); break;
                case 'falta':
                    Object.assign(docData, { nombre: get('rh-f-nombre'), area: get('rh-f-area'), tipoFalta: get('rh-f-tipoFalta') || 'injustificada', dias: Number(get('rh-f-dias')) || 1, fechaRegreso: get('rh-f-fecha-regreso') || '', notas: get('rh-f-notas') }); break;
                case 'descuento':
                    Object.assign(docData, { nombre: get('rh-f-nombre'), area: get('rh-f-area'), monto: Number(get('rh-f-monto')) || 0, motivoDesc: get('rh-f-motivoDesc') || 'Otro', notas: get('rh-f-notas') }); break;
                case 'rotacion':
            Object.assign(docData, { nombre: get('rh-f-nombre'), area: get('rh-f-area'), movimiento: get('rh-f-movimiento') || 'baja', empresa: (document.getElementById('rh-f-empresa')?.value || ''), notas: get('rh-f-notas') }); break;
                case 'vacante':
                    Object.assign(docData, { puesto: get('rh-f-puesto'), area: get('rh-f-area'), estatus: get('rh-f-vacEstatus') || 'nueva', notas: get('rh-f-notas') }); break;
                case 'acta':
                    Object.assign(docData, { nombre: get('rh-f-nombre'), area: get('rh-f-area'), tipoActa: get('rh-f-tipoActa') || 'conducta', notas: get('rh-f-notas') }); break;
                case 'capacitacion':
                    Object.assign(docData, { nombre: get('rh-f-capNombre'), impartidor: get('rh-f-capImpartidor'), lugar: get('rh-f-capLugar'), duracion: Number(get('rh-f-capDuracion')) || 0, asistentes: get('rh-f-capAsistentes'), notas: get('rh-f-notas') }); break;
                case 'incapacidad':
                    Object.assign(docData, { nombre: get('rh-f-nombre'), area: get('rh-f-area'), folio: get('rh-f-incFolio'), ramo: get('rh-f-incRamo') || 'enfermedad-general', tipoIncapacidad: get('rh-f-incTipo') || 'inicial', dias: Number(get('rh-f-incDias')) || 0, fechaRegreso: get('rh-f-fecha-regreso') || '', notas: get('rh-f-notas') }); break;
            }

            Object.keys(docData).forEach(k => { if(docData[k] === undefined) delete docData[k]; });
            console.log('[RH SAVE] docData:', JSON.stringify(docData));

            try {
                const { db, auth, fs } = await getFirebase();
                docData.creadoPor = auth.currentUser?.email || '';

                if(editId){
                    await fs.updateDoc(fs.doc(db, 'rh_indicadores', editId), docData);
                    console.log('[RH SAVE] ✅ Actualizado:', editId);
                    const formEl = document.getElementById('rh-inline-form');
                    if(formEl) delete formEl.dataset.editId;
                } else {
                    const ref = await fs.addDoc(fs.collection(db, 'rh_indicadores'), docData);
                    console.log('[RH SAVE] ✅ Creado ID:', ref.id);
                }

                // Cerrar UI
                if(origen === 'inline'){
                    const formEl = document.getElementById('rh-inline-form');
                    if(formEl) formEl.style.display = 'none';
                } else {
                    const modal = document.getElementById('modal-rh');
                    if(modal) modal.style.display = 'none';
                }

                if(window.mostrarPush){
                    window.mostrarPush('✅ Registro guardado', `${tipo} · ${docData.nombre || docData.puesto || tipo}`, '👥');
                }

                // RECARGA INMEDIATA DE LA VISTA
                await recargarYRenderizarRH();

            } catch(e) {
                console.error('[RH SAVE ERROR]', e);
                alert('Error al guardar: ' + e.message);
            } finally {
                if(btn){ btn.textContent = '💾 GUARDAR REGISTRO'; btn.disabled = false; }
            }
        }

        window.guardarRHInline = () => guardarRegistroRH('inline');
        window.guardarDatoRH = () => guardarRegistroRH('modal');

        // Override abrirRHInline con pre-llenado
        const _origAbrirInline = window.abrirRHInline;
        window.abrirRHInline = function(tab, editId){
            editId = editId || null;
            if(_origAbrirInline) _origAbrirInline(tab, editId);
            const formEl = document.getElementById('rh-inline-form');
            if(formEl){
                if(editId) formEl.dataset.editId = editId;
                else delete formEl.dataset.editId;
            }
            if(editId){
                setTimeout(() => preLlenarFormRH(editId), 150);
            }
        };

        async function preLlenarFormRH(editId){
            try {
                const { db, fs } = await getFirebase();
                const snap = await fs.getDoc(fs.doc(db, 'rh_indicadores', editId));
                if(!snap.exists()){
                    console.warn('[RH EDIT] No encontrado:', editId);
                    return;
                }
                const r = snap.data();
                console.log('[RH EDIT] Pre-llenando:', editId, r.tipo);

                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if(el && val !== undefined && val !== null && val !== '') el.value = val;
                };

                setVal('rh-f-nombre', r.nombre);
                setVal('rh-f-fecha', r.fecha);
                setVal('rh-f-notas', r.notas);
                setVal('rh-f-hora', r.hora);
                setVal('rh-f-minutos', r.minutos);
                setVal('rh-f-tipoFalta', r.tipoFalta);
                setVal('rh-f-dias', r.dias);
                setVal('rh-f-fecha-regreso', r.fechaRegreso);
                setVal('rh-f-monto', r.monto);
                setVal('rh-f-motivoDesc', r.motivoDesc);
                setVal('rh-f-movimiento', r.movimiento);
                setVal('rh-f-puesto', r.puesto);
                setVal('rh-f-vacEstatus', r.estatus);
                setVal('rh-f-tipoActa', r.tipoActa);
                setVal('rh-f-capNombre', r.nombre);
                setVal('rh-f-capImpartidor', r.impartidor);
                setVal('rh-f-capLugar', r.lugar);
                setVal('rh-f-capDuracion', r.duracion);
                setVal('rh-f-capAsistentes', r.asistentes);
                setVal('rh-f-incFolio', r.folio);
                setVal('rh-f-incRamo', r.ramo);
                setVal('rh-f-incTipo', r.tipoIncapacidad);
                setVal('rh-f-incDias', r.dias);

                const areaSel = document.getElementById('rh-f-area-sel');
                const areaInput = document.getElementById('rh-f-area');
                if(areaSel && r.area){
                    const opciones = [...areaSel.options].map(o => o.value);
                    if(opciones.includes(r.area)){
                        areaSel.value = r.area;
                        if(areaInput) areaInput.style.display = 'none';
                    } else {
                        areaSel.value = '__otra__';
                        if(areaInput){ areaInput.style.display = 'block'; areaInput.value = r.area; }
                    }
                }

                const titleEl = document.getElementById('rh-inline-title');
                if(titleEl) titleEl.innerHTML = '✏️ Editando: ' + (r.nombre || r.puesto || r.tipo);

            } catch(e) {
                console.error('[RH EDIT ERROR]', e);
            }
        }

        // Recargar datos cuando entra a Recursos Humanos
        const _origVerArea = window.verArea;
        window.verArea = function(area, btn){
            if(_origVerArea) _origVerArea(area, btn);
            if(area === 'Recursos Humanos'){
                setTimeout(() => recargarYRenderizarRH(), 500);
            }
        };

        // Eliminar — recargar después
        const _origEliminar = window.eliminarRH;
        window.eliminarRH = async function(id){
            if(!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return;
            try {
                const { db, fs } = await getFirebase();
                await fs.deleteDoc(fs.doc(db, 'rh_indicadores', id));
                if(window.mostrarPush) window.mostrarPush('🗑 Eliminado', 'Registro eliminado', '👥');
                await recargarYRenderizarRH();
            } catch(e){
                alert('Error al eliminar: ' + e.message);
            }
        };

        // Cargar datos iniciales si ya estamos en RH
        setTimeout(() => {
            const secArea = document.getElementById('sec-area');
            const titleEl = document.getElementById('area-title');
            if(secArea && secArea.classList.contains('active') && 
               titleEl && titleEl.innerText.includes('Recursos Humanos')){
                recargarYRenderizarRH();
            }
        }, 1000);

                                    }
})();
