// ══════════════════════════════════════════════════════════════
// CORE.JS — Portal Tecnocontrol
// Funciones compartidas entre todos los módulos
// Archivo: /core.js
// 
// IMPORTANTE: Este archivo debe cargarse ANTES que cualquier módulo.
// El index.html ya inicializa: db, auth, app (Firebase)
// Este archivo asume que esas variables están disponibles en window
// ══════════════════════════════════════════════════════════════

// ── Funciones proxy (delegan a implementación real del módulo) ──
function ventasSidebar(m,b){ if(window._ventasSidebarReal) window._ventasSidebarReal(m,b); else setTimeout(()=>ventasSidebar(m,b),200); }
function abrirModalCheckin(id){ if(window._abrirModalCheckinReal) window._abrirModalCheckinReal(id); }
function abrirModalCliente(){ if(window._abrirModalClienteReal) window._abrirModalClienteReal(); }
function abrirModalMetas(){ if(window._abrirModalMetasReal) window._abrirModalMetasReal(); }
function filtrarClientesMapa(){ if(window._filtrarClientesMapaReal) window._filtrarClientesMapaReal(); }

// ── Funciones compartidas ────────────────────────────────────

// solicitarPush
async function solicitarPush() {
    document.getElementById('push-banner').style.display = 'none';
    if (!('Notification' in window)) { alert('Tu navegador no soporta notificaciones'); return; }
    const perm = await Notification.requestPermission();
    localStorage.setItem('pushPerm', perm);
    actualizarPushStatus(perm);
    if (perm === 'granted') {
        mostrarNotif('✅ Tecnocontrol', 'Notificaciones activadas. Te avisaremos cuando comenten en tus tareas.', 'tc-confirm');
    }
}

// mostrarNotif
function mostrarNotif(titulo, cuerpo, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
        new Notification(titulo, {
            body: cuerpo,
            tag: tag || 'tc-portal',
            icon: '',
            silent: false
        });
    } catch(e) {}
}

// mostrarPush
window.mostrarPush = (titulo, mensaje, icono = '💬', esMencion = false) => {
    const container = document.getElementById('push-container');
    if(!container) return;
    const n = document.createElement('div');
    n.className = 'push-notification' + (esMencion ? ' push-mention' : '');
    const hora = new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
    n.innerHTML = `
        <div class="push-icon">${icono}</div>
        <div class="push-content">
            <div class="push-title">${titulo}</div>
            <div class="push-msg">${mensaje}</div>
            <div class="push-time">${hora}</div>
        </div>`;
    container.appendChild(n);
    // Limitar a 5 notificaciones apiladas
    const all = container.querySelectorAll('.push-notification');
    if(all.length > 5) all[0].remove();
    // Auto-cerrar en 5 segundos
    const timer = setTimeout(() => cerrarPush(n), 5000);
    n.onclick = () => { clearTimeout(timer); cerrarPush(n); };
};

// cerrarPush
function cerrarPush(el) {
    el.classList.add('push-fade-out');
    setTimeout(() => el.remove(), 300);
}

// esAdminTotal
function esAdminTotal(email){
    return ADMIN_EMAILS.includes((email||'').toLowerCase().trim());
}

// nombreUsuario
function nombreUsuario(email){
    if(!email) return '—';
    return NOMBRE_MAP[email.toLowerCase().trim()] || email.split('@')[0];
}

// obtenerDeptoUsuario
function obtenerDeptoUsuario(email) {
    if(!email) return '';
    // 1. Email exacto (insensible a mayúsculas)
    const exacto = EMAIL_AREA_MAP[email.toLowerCase().trim()];
    if(exacto) return exacto;
    // 2. Fallback por fragmento — cubre emails futuros no mapeados aún
    const fragmentos = {
        'rh@':'Recursos Humanos', 'facturacion':'Ingresos',
        'contabilidad':'Contabilidad', 'aux.contable':'Egresos',
        'ventas':'Ventas', 'marketing':'Marketing',
        'mercadotecnia':'Marketing', 'administracion':'Administración',
        'c.acosta':'Administración', 'egresos':'Egresos', 'ingresos':'Ingresos'
    };
    const lower = email.toLowerCase();
    for(const [k,v] of Object.entries(fragmentos)){ if(lower.includes(k)) return v; }
    return '';
}

// verArea
window.verArea=(a,b)=>{
    // Verificar permisos de área
    const yo2 = auth.currentUser?.email || '';
    const miDepto2 = obtenerDeptoUsuario(yo2);
    const esAdmin2 = esAdminTotal(yo2);
    if(!esAdmin2 && miDepto2 !== 'Administración'){
        const misAreas2 = GRUPOS_VISIBILIDAD[miDepto2] || [miDepto2];
        if(!misAreas2.includes(a)){
            if(window.mostrarPush) window.mostrarPush('🔒 Acceso restringido', 'No tienes permisos para ver ' + a, '⚠️');
            return;
        }
    }
    areaActual=a;
    const titleEl = document.getElementById('area-title');
    if(titleEl){
        titleEl.innerHTML=`${ICONS[DEPTOS.indexOf(a)]} ${a}`;
        titleEl.style.color = a==='Recursos Humanos' ? '#db2777' : '';
    }
    const srch=document.getElementById('area-search');
    if(srch) srch.value='';

    // En móvil + Ventas: mostrar solo el mapa
    if(isMobile() && a === 'Ventas'){
        navegar('area', b);
        const yo = auth.currentUser?.email || '';
        toggleVentasMapa(a, yo);
        mostrarNavMobile(true, true);
        return;
    }

    navegar('area',b);
    // Limpiar contenido del área anterior para evitar arrastre
    const tableEl = document.getElementById('area-table');
    if(tableEl) tableEl.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">Cargando...</div>';
    const statsEl = document.getElementById('area-stats-mini');
    if(statsEl) statsEl.innerHTML = '';
    // Renderizar con pequeño delay para que auth esté listo
    const _doRender = () => {
        renderTabla();
        const yo = auth.currentUser?.email || '';
        toggleMktDash(a, yo);
        toggleRHDash(a, yo);
        toggleVentasMapa(a, yo);
        if(isMobile()) mostrarNavMobile(true, false);
        // Parrilla de documentos — mostrar en todas las áreas excepto Marketing (tiene su propia)
        const _parrillaWrap = document.getElementById('area-parrilla-wrap');
        if(_parrillaWrap){
            const _areasConParrillaPropia = ['Marketing'];
            if(_areasConParrillaPropia.includes(a)){
                _parrillaWrap.style.display = 'none';
            } else {
                _parrillaWrap.style.display = 'block';
                window.apAreaActual = a; apAreaActual = a;
                if(typeof window.actualizarLabelAP === 'function') window.actualizarLabelAP();
                if(typeof window.cargarDocsAP === 'function') window.cargarDocsAP();
            }
        }
    };
    if(auth.currentUser) { _doRender(); } else { setTimeout(_doRender, 300); }
};

// navegar
window.navegar=(id,b)=>{
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    document.getElementById('sec-'+id)?.classList.add('active');
    if(b){document.querySelectorAll('.sitem').forEach(i=>i.classList.remove('active'));b.classList.add('active');}
    if(id==='cal360') renderCal360();
    if(id==='ejecutivo') renderEjecutivo();
    // Si salimos de ventas, invalidar el mapa para que no se arrastre
    if(id !== 'ventas-mapa' && typeof mapaLeaflet !== 'undefined' && mapaLeaflet){
        try { setTimeout(()=>{ if(mapaLeaflet) mapaLeaflet.invalidateSize(); }, 200); } catch(e){}
    }
    if(id!=='area'){
        const secMapa = document.getElementById('sec-ventas-mapa');
        if(secMapa) secMapa.style.display='none';
        // Restaurar elementos de sec-area ocultados en vista Ventas móvil
        const secArea = document.getElementById('sec-area');
        if(secArea && isMobile()){
            const kanban = secArea.querySelector('.kanban-board');
            const buscadorWrap = secArea.querySelector('#area-search')?.parentElement;
            const header = secArea.querySelector('.page-header');
            if(kanban) kanban.style.display='';
            if(buscadorWrap) buscadorWrap.style.display='';
            if(header) header.style.display='';
        }
        if(isMobile()) mostrarNavMobile(true, false);
    }
};

// rhKey
function rhKey(){ return getSemanaKeyRH(getRhSemanaActual()); }

// cargarDatosRH
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

// ══════════════════════════════════════════════════════════════
// Exportar todo para uso como módulo ES6
// ══════════════════════════════════════════════════════════════
// Exponer todo via window para acceso global desde cualquier módulo
window.esAdminTotal = esAdminTotal;
window.nombreUsuario = nombreUsuario;
window.obtenerDeptoUsuario = obtenerDeptoUsuario;
window.rhKey = rhKey;
window.cargarDatosRH = cargarDatosRH;
// Nota: verArea, navegar, mostrarPush, mostrarNotif, cerrarPush
// ya están asignados a window dentro de sus definiciones

console.log('[core.js] ✅ Funciones core cargadas');
