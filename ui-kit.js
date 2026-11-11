/* ══════════════════════════════════════════════════════════════
   ui-kit.js — Sistema de diseño del Portal Operativo Tecnocontrol
   Se carga UNA vez en index.html y mejora TODAS las pantallas
   de todos los departamentos, sin tocar el código de cada módulo:

   1. Pestañas  : unifica el diseño de todas las barras de pestañas.
   2. Badges    : celdas de tabla con un estado (Pendiente, Pagado,
                  Cancelado…) se muestran como etiqueta de color.
   3. Tooltips  : todo botón con "title" o solo con ícono muestra
                  una explicación al pasar el mouse.
   4. Skeleton  : los textos "Cargando…" se vuelven barras animadas.
   5. Vacío     : los textos "Sin registros / No hay…" se vuelven un
                  estado vacío con ícono y explicación.
   6. Paginación: tablas con más de 25 filas se paginan solas.

   Para pantallas nuevas usar la API window.UI (ver al final).
   Para excluir una zona (PDF, TV, impresión): atributo data-ui-off
   Para excluir solo la paginación de una tabla: data-ui-nopage
   Módulo propio: no modifica funciones globales de otros archivos.
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';
if(window.UI && window.UI.__v) return;

var CFG = { pageSize:25, pageSizes:[10,25,50,100], emptyAfterMs:3500 };

/* ── Íconos SVG (sin emojis) ── */
var ICO = {
  inbox:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
  alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>',
  first:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/></svg>',
  prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  last:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 17 5-5-5-5M6 17l5-5-5-5"/></svg>'
};

/* ── Utilidades ── */
function norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim(); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function isOff(el){ return !el || !el.closest || !!el.closest('[data-ui-off],.no-ui,.leaflet-container'); }
function visible(el){ return !!(el && (el.offsetParent || el.getClientRects().length)); }

/* ══ 2. BADGES ═══════════════════════════════════════════════ */
var TONES = [
  ['danger',/^(cancelad|rechazad|vencid|urgente|inactiv|baja\b|de baja|atrasad|error|fuera de servicio|no pagad|sin pagar|suspendid|bloquead|sin stock|agotad|fall[oa]|critic|expirad|denegad|perdid|retrasad|no autorizad)/],
  ['warn',/^(pendiente|en proceso|en revision|por (vencer|autorizar|pagar|surtir|cobrar|firmar|recibir|entregar|revisar|asignar)|en espera|parcial|programad|asignad|en ruta|en transito|abiert|en curso|en tramite|reprogramad|incomplet|proximo a vencer|sin asignar|en reparacion|en taller|en mantenimiento)/],
  ['ok',/^(complet|entregad|aprobad|autorizad|pagad|cobrad|activ[oa]s?$|finalizad|surtid|realizad|vigente|al corriente|firmad|recibid|list[oa]s?$|cerrad|resuelt|atendid|terminad|validad|conciliad|facturad|disponible|en orden|ok$|operativ|en servicio)/],
  ['info',/^(nuev[oa]s?$|borrador|enviad|cotizad|en camino|solicitad|en almacen|registrad|capturad)/]
];
function toneOf(text){
  var t = norm(text);
  if(!t || t.length>26 || /^\d/.test(t)) return null;
  for(var i=0;i<TONES.length;i++) if(TONES[i][1].test(t)) return TONES[i][0];
  return null;
}
var badgeSeen = new WeakMap();
function autoBadges(table){
  var tb = table.tBodies; if(!tb||!tb.length) return;
  for(var b=0;b<tb.length;b++){
    var cells = tb[b].getElementsByTagName('td');
    for(var i=0;i<cells.length;i++){
      var td = cells[i];
      if(td.childElementCount!==0 || td.isContentEditable || td.parentNode.cells.length===1) continue;
      var txt = td.textContent;
      if(badgeSeen.get(td)===txt) continue;
      badgeSeen.set(td,txt);
      var tone = toneOf(txt);
      if(!tone) continue;
      td.innerHTML = '<span class="ui-badge ui-badge--'+tone+'">'+esc(txt.trim())+'</span>';
    }
  }
}

/* ══ 4 y 5. SKELETON y ESTADO VACÍO ══════════════════════════ */
var RE_LOAD  = /^(cargando|consultando|buscando|obteniendo|leyendo)\b[^]{0,70}$/;
var RE_EMPTY = /^(sin |no hay|no se encontr|no existen|ningun|aun no|todavia no|vacio|no tienes|no tiene|no hubo|nada que mostrar)[^]{0,130}$/;
var RE_ERR   = /^(error|no se pudo|fallo)[^]{0,160}$/;
/* Para bloques sueltos (fuera de tablas) se exige una frase clara de "vacío" para no tocar etiquetas como "Sin asignar" */
var RE_EMPTY_BLOCK = /^(no hay|no se encontr|no existen|aun no hay|todavia no hay|nada que mostrar|sin (registros|resultados|datos|informacion|pendientes|solicitudes|movimientos|elementos|coincidencias|documentos|servicios|pedidos|tareas|archivos|notificaciones|avisos|evidencias|reportes|cotizaciones|ordenes|partidas|vehiculos|colaboradores|clientes|productos|eventos|actividad|historial))[^]{0,130}$/;

function skelHTML(cols, rows){
  cols = Math.max(2, Math.min(cols||4, 6)); rows = rows||5;
  var line = '<div class="ui-skel-line" style="grid-template-columns:repeat('+cols+',1fr)">'+new Array(cols+1).join('<span class="ui-skel-bar"></span>')+'</div>';
  return '<div class="ui-skel" aria-hidden="true">'+new Array(rows+1).join(line)+'</div>';
}
function cardsSkelHTML(n){
  var c = '<div class="ui-skel-card"><span class="ui-skel-bar" style="width:55%;height:14px"></span><span class="ui-skel-bar" style="width:90%"></span><span class="ui-skel-bar" style="width:70%"></span></div>';
  return '<div class="ui-skel-cards" aria-hidden="true">'+new Array((n||6)+1).join(c)+'</div>';
}
function emptyHTML(o){
  o = o||{};
  var kind = o.kind||'empty';
  var ico = kind==='error'?ICO.alert:(kind==='search'?ICO.search:ICO.inbox);
  var hint = o.hint!=null ? o.hint : (kind==='error'
      ? 'Recarga la página. Si vuelve a pasar, avisa a Sistemas.'
      : (kind==='search' ? 'Prueba con otra palabra o quita los filtros.' : 'Cuando haya información, aparecerá aquí.'));
  var btn = o.action ? '<button type="button" class="ui-empty-btn" data-ui-empty-action>'+esc(o.action.label||'Agregar')+'</button>' : '';
  return '<div class="ui-empty ui-empty--'+kind+'" role="status"><div class="ui-empty-ico">'+ico+'</div>'+
         '<div class="ui-empty-title">'+esc(o.title||'Aún no hay registros')+'</div>'+
         (hint?'<div class="ui-empty-hint">'+esc(hint)+'</div>':'')+btn+'</div>';
}
function kindOf(txt){
  var t = norm(txt);
  if(RE_ERR.test(t)) return 'error';
  return /(resultado|filtro|busqueda|coincid)/.test(t) ? 'search' : 'empty';
}
function colsOf(table){
  var h = table && table.tHead && table.tHead.rows[0];
  return h ? h.cells.length : 4;
}

/* Convierte textos sueltos de "Cargando…" / "Sin registros" en skeleton / estado vacío */
function autoStateCell(td){
  if(td.dataset.uiState) return;
  var tr = td.parentNode; if(!tr || tr.cells.length!==1) return;
  if(td.childElementCount>1) return;
  if(td.childElementCount===1 && !/^(SPAN|B|I|EM|STRONG|SMALL|SVG)$/i.test(td.firstElementChild.tagName)) return;
  var raw = td.textContent.trim(), t = norm(raw);
  if(!t) return;
  if(RE_LOAD.test(t)){
    td.dataset.uiState='loading'; td.classList.add('ui-state-cell');
    td.innerHTML = '<span class="ui-sr">'+esc(raw)+'</span>'+skelHTML(td.colSpan>1?td.colSpan:colsOf(td.closest('table')),5);
  } else if(RE_EMPTY.test(t) || RE_ERR.test(t)){
    td.dataset.uiState='empty'; td.classList.add('ui-state-cell');
    td.innerHTML = emptyHTML({title:raw, kind:kindOf(raw)});
  }
}
function autoStateBlock(el){
  if(el.dataset.uiState || el.childElementCount!==0) return;
  if(el.closest('button,a,label,select,option,.ui-empty,.ui-skel,.ui-pager,.ui-tip,h1,h2,h3,h4')) return;
  var raw = el.textContent.trim(); if(raw.length<4 || raw.length>150) return;
  var t = norm(raw), isLoad = RE_LOAD.test(t), isEmpty = !isLoad && RE_EMPTY_BLOCK.test(t);
  if(!isLoad && !isEmpty) return;
  if(!visible(el) || el.offsetWidth<(isLoad?160:200)) return;
  el.dataset.uiState = isLoad?'loading':'empty';
  el.innerHTML = isLoad ? '<span class="ui-sr">'+esc(raw)+'</span>'+skelHTML(3,3) : emptyHTML({title:raw, kind:kindOf(raw)});
}

/* Tablas con <tbody> vacío: skeleton y, si sigue vacío, estado vacío */
var emptyTimers = new WeakMap();
function autoEmptyTbody(table){
  var tb = table.tBodies[0];
  if(!tb || !table.tHead || !visible(table)) return;
  var own = tb.querySelectorAll(':scope > tr.ui-auto');
  if(tb.rows.length > own.length){ own.forEach(function(r){ r.remove(); }); return; }
  if(tb.rows.length) return;
  var tr = tb.insertRow(); tr.className='ui-auto';
  var td = tr.insertCell(); td.colSpan = colsOf(table); td.className='ui-state-cell'; td.dataset.uiState='loading';
  td.innerHTML = '<span class="ui-sr">Cargando…</span>'+skelHTML(td.colSpan,4);
  clearTimeout(emptyTimers.get(table));
  emptyTimers.set(table, setTimeout(function(){
    if(tr.isConnected && tb.rows.length===1){ td.dataset.uiState='empty'; td.innerHTML = emptyHTML({}); }
  }, CFG.emptyAfterMs));
}

/* ══ 6. PAGINACIÓN ═══════════════════════════════════════════ */
var pgState = new WeakMap();
function filteredOut(r){
  return r.style.display==='none' || r.hidden || r.classList.contains('hidden') || r.classList.contains('d-none');
}
function isMsgRow(r){ return r.classList.contains('ui-auto') || (r.cells.length===1 && r.cells[0].dataset.uiState); }

function pagerHost(table){
  var p = table.parentElement;
  if(p && p.children.length===1 && p!==document.body){
    var cs = getComputedStyle(p);
    if(/(auto|scroll|hidden)/.test(cs.overflow+cs.overflowX+cs.overflowY)) return p;
  }
  return table;
}
function pageNums(cur, total){
  var out=[], set={};
  [1,total,cur-1,cur,cur+1].forEach(function(n){ if(n>=1&&n<=total&&!set[n]){ set[n]=1; out.push(n); } });
  out.sort(function(a,b){return a-b;});
  var res=[]; for(var i=0;i<out.length;i++){ if(i&&out[i]-out[i-1]>1) res.push(0); res.push(out[i]); }
  return res;
}
function renderPager(st, total){
  var pages = Math.max(1, Math.ceil(total/st.size));
  var from = total ? (st.page-1)*st.size+1 : 0, to = Math.min(total, st.page*st.size);
  var h = '<div class="ui-pager-info">Mostrando <b>'+from+'–'+to+'</b> de <b>'+total+'</b></div><div class="ui-pager-nav">';
  h += '<button type="button" class="ui-pager-btn" data-pg="1" data-tip="Primera página" '+(st.page<=1?'disabled':'')+'>'+ICO.first+'</button>';
  h += '<button type="button" class="ui-pager-btn" data-pg="'+(st.page-1)+'" data-tip="Página anterior" '+(st.page<=1?'disabled':'')+'>'+ICO.prev+'</button>';
  pageNums(st.page,pages).forEach(function(n){
    h += n ? '<button type="button" class="ui-pager-btn ui-pager-num'+(n===st.page?' cur':'')+'" data-pg="'+n+'"'+(n===st.page?' aria-current="page"':'')+'>'+n+'</button>' : '<span class="ui-pager-gap">…</span>';
  });
  h += '<button type="button" class="ui-pager-btn" data-pg="'+(st.page+1)+'" data-tip="Página siguiente" '+(st.page>=pages?'disabled':'')+'>'+ICO.next+'</button>';
  h += '<button type="button" class="ui-pager-btn" data-pg="'+pages+'" data-tip="Última página" '+(st.page>=pages?'disabled':'')+'>'+ICO.last+'</button></div>';
  h += '<label class="ui-pager-size">Filas por página <select data-pg-size>'+CFG.pageSizes.map(function(s){return '<option'+(s===st.size?' selected':'')+'>'+s+'</option>';}).join('')+'</select></label>';
  st.el.innerHTML = h;
}
/* Motor genérico: sirve para tablas y para listas de tarjetas */
function applyPaging(key, items, hostAfter){
  var st = pgState.get(key);
  if(!st){ st = {page:1, size:CFG.pageSize, count:-1, el:null}; pgState.set(key, st); }
  var vis = items.filter(function(r){ return !filteredOut(r); });
  if(vis.length!==st.count){ st.page=1; st.count=vis.length; }
  var need = vis.length > st.size || (st.size!==CFG.pageSize && vis.length > CFG.pageSizes[0]);
  if(!need){
    items.forEach(function(r){ r.classList.remove('ui-pg-off'); });
    if(st.el){ st.el.remove(); st.el=null; }
    return;
  }
  var pages = Math.ceil(vis.length/st.size);
  if(st.page>pages) st.page=pages;
  var a=(st.page-1)*st.size, z=a+st.size;
  items.forEach(function(r){ r.classList.remove('ui-pg-off'); });
  vis.forEach(function(r,i){ if(i<a||i>=z) r.classList.add('ui-pg-off'); });
  if(!st.el || !st.el.isConnected){
    st.el = document.createElement('div');
    st.el.className='ui-pager'; st.el.setAttribute('role','navigation'); st.el.setAttribute('aria-label','Paginación');
    st.el.__uiKey = key;
    hostAfter.insertAdjacentElement('afterend', st.el);
  }
  renderPager(st, vis.length);
}
function tableItems(table){
  var tb = table.tBodies[0]; if(!tb) return [];
  return Array.prototype.filter.call(tb.rows, function(r){ return !isMsgRow(r); });
}
function autoPaginate(table){
  if(table.hasAttribute('data-ui-nopage') || !table.tBodies[0]) return;
  if(!table.tHead && !table.querySelector('th')) return;   // tabla de diseño, no de datos
  if(!visible(table)) return;
  applyPaging(table, tableItems(table), pagerHost(table));
}
function listItems(box){
  var sel = box.getAttribute('data-ui-paginate') || ':scope > *';
  try{ return Array.prototype.slice.call(box.querySelectorAll(sel.indexOf(':scope')===0?sel:':scope > '+sel)).filter(function(x){return !x.classList.contains('ui-pager');}); }
  catch(e){ return []; }
}
function refreshKey(key){
  if(key.tagName==='TABLE') autoPaginate(key);
  else applyPaging(key, listItems(key), key);
}
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('.ui-pager [data-pg]'); if(!b || b.disabled) return;
  var pg = b.closest('.ui-pager'), st = pgState.get(pg.__uiKey); if(!st) return;
  st.page = +b.getAttribute('data-pg'); run(function(){ refreshKey(pg.__uiKey); });
  var k = pg.__uiKey; if(k.getBoundingClientRect().top<0) k.scrollIntoView({block:'start',behavior:'smooth'});
});
document.addEventListener('change', function(e){
  var s = e.target; if(!s.matches || !s.matches('.ui-pager [data-pg-size]')) return;
  var pg = s.closest('.ui-pager'), st = pgState.get(pg.__uiKey); if(!st) return;
  st.size = +s.value; st.page = 1; st.count=-1; run(function(){ refreshKey(pg.__uiKey); });
});

/* ══ 1. PESTAÑAS ═════════════════════════════════════════════ */
var RE_TABCLS = /(^|-)(tab|tabs-btn|tab-btn|tabbtn|ptab)$/;
function isTabEl(el){
  for(var i=0;i<el.classList.length;i++) if(RE_TABCLS.test(el.classList[i])) return true;
  return false;
}
function isActive(el){ return /(^|\s)(active|on|sel|selected|is-active)(\s|$)/.test(el.className) || el.getAttribute('aria-selected')==='true'; }
function autoTabs(root){
  var els = root.querySelectorAll ? root.querySelectorAll('[class*="tab"]') : [];
  var parents = new Set();
  Array.prototype.forEach.call(els, function(el){ if(!el.classList.contains('ui-tab') && isTabEl(el) && el.parentElement) parents.add(el.parentElement); });
  parents.forEach(function(p){
    if(isOff(p)) return;
    var kids = Array.prototype.filter.call(p.children, isTabEl);
    if(kids.length<2) return;
    p.classList.add('ui-tabs'); p.setAttribute('role','tablist');
    kids.forEach(function(k){ k.classList.add('ui-tab'); k.setAttribute('role','tab'); k.setAttribute('aria-selected', isActive(k)?'true':'false'); if(!k.hasAttribute('tabindex')&&k.tagName!=='BUTTON') k.tabIndex=0; });
  });
}
function syncTabs(list){
  Array.prototype.forEach.call(list.querySelectorAll(':scope > .ui-tab'), function(k){
    k.classList.remove('is-active');
    k.setAttribute('aria-selected', /(^|\s)(active|on|sel|selected)(\s|$)/.test(k.className)?'true':'false');
  });
}
document.addEventListener('click', function(e){
  var t = e.target.closest && e.target.closest('.ui-tabs > .ui-tab'); if(!t) return;
  var list = t.parentElement;
  setTimeout(function(){
    if(!list.querySelector(':scope > .ui-tab.active,:scope > .ui-tab.on,:scope > .ui-tab.sel,:scope > .ui-tab.selected')){
      Array.prototype.forEach.call(list.children,function(k){k.setAttribute('aria-selected', k===t?'true':'false');});
    } else syncTabs(list);
  }, 0);
});
document.addEventListener('keydown', function(e){
  var t = e.target; if(!t.classList || !t.classList.contains('ui-tab')) return;
  if(e.key!=='ArrowRight' && e.key!=='ArrowLeft') return;
  var kids = Array.prototype.filter.call(t.parentElement.children, function(k){return k.classList.contains('ui-tab');});
  var i = kids.indexOf(t) + (e.key==='ArrowRight'?1:-1);
  var n = kids[(i+kids.length)%kids.length]; if(n){ n.focus(); e.preventDefault(); }
});

/* ══ 3. TOOLTIPS ═════════════════════════════════════════════ */
var VERBS = [
  [/(elimin|borrar|delete|quitar|remove|trash|papelera)/,'Eliminar'],
  [/(editar|edit|modific)/,'Editar'],
  [/pdf/,'Generar PDF'],
  [/(descarg|download)/,'Descargar'],
  [/(excel|xlsx|export)/,'Exportar a Excel'],
  [/(imprim|print)/,'Imprimir'],
  [/(whats)/,'Enviar por WhatsApp'],
  [/(correo|mail)/,'Enviar por correo'],
  [/(guardar|save)/,'Guardar'],
  [/(agreg|nuev[oa]|add|crear|alta)/,'Agregar'],
  [/(enviar|send)/,'Enviar'],
  [/(copiar|copy|duplic|clonar)/,'Copiar'],
  [/(compart|share)/,'Compartir'],
  [/(aprob|autoriz)/,'Aprobar'],
  [/(rechaz)/,'Rechazar'],
  [/(firma)/,'Firmar'],
  [/(recarg|refresh|actualiz|reload|sincron|sync)/,'Actualizar'],
  [/(busc|search)/,'Buscar'],
  [/(filtr)/,'Filtrar'],
  [/(mapa|\bmap|ubicac|gps)/,'Ver en el mapa'],
  [/(subir|upload|adjunt)/,'Subir archivo'],
  [/(histor|bitacora)/,'Ver historial'],
  [/(foto|imagen|evidenc|camara)/,'Ver evidencia'],
  [/(notif|campan|bell)/,'Notificaciones'],
  [/(config|ajuste|setting)/,'Configuración'],
  [/(llamar|phone|telefono)/,'Llamar'],
  [/(cerrar|close|cancel)/,'Cerrar'],
  [/(menu|sidebar|hamburg)/,'Mostrar u ocultar el menú'],
  [/(siguiente|next)/,'Siguiente'],
  [/(anterior|prev)/,'Anterior'],
  [/(\bver|abrir|open|detalle|view|mostrar|zoom|expand)/,'Ver detalle']
];
function inferLabel(el){
  var src = norm([el.getAttribute('onclick'), el.id, el.className && el.className.baseVal!=null?el.className.baseVal:el.className, el.getAttribute('data-action'), el.getAttribute('name')].join(' '));
  var txt = (el.textContent||'').trim();
  if(/^[×✕✖x]$/i.test(txt)) return 'Cerrar';
  for(var i=0;i<VERBS.length;i++) if(VERBS[i][0].test(src)) return VERBS[i][1];
  return '';
}
function isIconOnly(el){
  var txt = (el.textContent||'').replace(/\s+/g,'');
  return txt.length<=1 && !!el.querySelector('svg,img,i');
}
var tipEl=null, tipTimer=0, tipFor=null;
function tipTarget(node){
  if(!node || !node.closest || isOff(node)) return null;
  var el = node.closest('[data-tip],[title],button,a,[role="button"],[onclick]');
  if(!el || el.matches('input,select,textarea,option,.ui-pager-num')) return null;
  if(el.hasAttribute('title')){
    var t = el.getAttribute('title').trim(); el.removeAttribute('title');
    if(t){ el.setAttribute('data-tip', t); if(!el.hasAttribute('aria-label') && isIconOnly(el)) el.setAttribute('aria-label', t); }
  }
  if(!el.hasAttribute('data-tip') && el.matches('button,a,[role="button"],[onclick]') && isIconOnly(el)){
    var lab = el.getAttribute('aria-label') || inferLabel(el);
    if(lab){ el.setAttribute('data-tip', lab); if(!el.hasAttribute('aria-label')) el.setAttribute('aria-label', lab); }
  }
  return el.getAttribute('data-tip') ? el : null;
}
function showTip(el){
  if(!tipEl){ tipEl = document.createElement('div'); tipEl.className='ui-tip'; tipEl.setAttribute('role','tooltip'); tipEl.setAttribute('data-ui-off',''); document.body.appendChild(tipEl); }
  tipEl.textContent = el.getAttribute('data-tip');
  tipEl.classList.remove('show','below');
  var r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  var x = Math.max(8, Math.min(window.innerWidth-w-8, r.left + r.width/2 - w/2));
  var y = r.top - h - 9;
  if(y < 6){ y = r.bottom + 9; tipEl.classList.add('below'); }
  tipEl.style.left = x+'px'; tipEl.style.top = y+'px';
  tipEl.style.setProperty('--ui-tip-x', Math.max(10, Math.min(w-10, r.left + r.width/2 - x))+'px');
  tipEl.classList.add('show');
}
function hideTip(){ clearTimeout(tipTimer); tipFor=null; if(tipEl) tipEl.classList.remove('show'); }
function onEnter(e){
  var el = tipTarget(e.target);
  if(el===tipFor) return;
  hideTip(); if(!el) return;
  tipFor = el; tipTimer = setTimeout(function(){ if(tipFor===el && el.isConnected) showTip(el); }, e.type==='focusin'?0:300);
}
document.addEventListener('mouseover', onEnter, true);
document.addEventListener('focusin', onEnter, true);
document.addEventListener('mouseout', function(e){ if(tipFor && (!e.relatedTarget || !tipFor.contains(e.relatedTarget))) hideTip(); }, true);
document.addEventListener('focusout', hideTip, true);
document.addEventListener('mousedown', hideTip, true);
window.addEventListener('scroll', hideTip, true);

/* ══ MOTOR: observa cambios del DOM y aplica todo ═══════════ */
var pendC = new Set(), pendA = new Set(), timer = 0, applying = false, mo = null;
function run(fn){ applying = true; try{ fn(); } finally{ if(mo) mo.takeRecords(); applying = false; } }
function processTable(t, full){
  if(isOff(t)) return;
  if(full){ autoBadges(t); Array.prototype.forEach.call(t.querySelectorAll('tbody > tr > td'), function(td){ if(td.parentNode.cells.length===1) autoStateCell(td); }); autoEmptyTbody(t); }
  autoPaginate(t);
}
function flush(){
  timer = 0;
  var tablesFull = new Set(), tablesLite = new Set(), lists = new Set(), roots = Array.from(pendC);
  pendA.forEach(function(n){ var t = n.closest && n.closest('table'); if(t) tablesLite.add(t); if(n.querySelectorAll) n.querySelectorAll('table').forEach(function(x){ tablesLite.add(x); }); });
  pendC.clear(); pendA.clear();
  run(function(){
    document.querySelectorAll('.ui-pager').forEach(function(pg){ if(!pg.__uiKey || !pg.__uiKey.isConnected) pg.remove(); });
    roots.forEach(function(r){
      if(!r.isConnected || isOff(r)) return;
      var t = r.closest('table'); if(t) tablesFull.add(t);
      r.querySelectorAll('table').forEach(function(x){ tablesFull.add(x); });
      var lb = r.closest('[data-ui-paginate]'); if(lb) lists.add(lb);
      r.querySelectorAll('[data-ui-paginate]').forEach(function(x){ lists.add(x); });
      autoTabs(r.parentElement || r);
      var blocks = r.matches('div,p') ? [r] : [];
      r.querySelectorAll('div,p').forEach(function(d){ if(d.childElementCount===0) blocks.push(d); });
      blocks.forEach(function(d){ if(!d.closest('table')) autoStateBlock(d); });
    });
    tablesFull.forEach(function(t){ tablesLite.delete(t); processTable(t, true); });
    tablesLite.forEach(function(t){ processTable(t, false); });
    lists.forEach(function(l){ if(!isOff(l) && visible(l)) applyPaging(l, listItems(l), l); });
  });
}
function schedule(){ if(!timer) timer = setTimeout(flush, 90); }
function start(){
  mo = new MutationObserver(function(ms){
    if(applying) return;
    for(var i=0;i<ms.length;i++){
      var m = ms[i], n = m.target.nodeType===3 ? m.target.parentNode : m.target;
      if(!n || n.nodeType!==1 || n.closest('.leaflet-container,.ui-tip,.ui-pager')) continue;
      if(m.type==='attributes') pendA.add(n); else pendC.add(n);
    }
    if(pendC.size||pendA.size) schedule();
  });
  mo.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['style','class','hidden']});
  pendC.add(document.body); flush();
}

/* ══ API PÚBLICA para pantallas nuevas ══════════════════════ */
window.UI = {
  __v: 1,
  config: CFG,
  /* Badge HTML: UI.badge('Pendiente')  ó  UI.badge('Listo para envío','ok') */
  badge: function(text, tone){ tone = tone || toneOf(text) || 'neutral'; return '<span class="ui-badge'+(tone==='neutral'?'':' ui-badge--'+tone)+'">'+esc(text)+'</span>'; },
  /* Skeleton: UI.skeleton(el) | UI.skeleton(el,{type:'cards',count:6}) | UI.skeleton(tbody,{cols:5}) */
  skeleton: function(el, o){
    o = o||{}; if(!el) return;
    var html = o.type==='cards' ? cardsSkelHTML(o.count) : skelHTML(o.cols, o.rows);
    run(function(){
      if(el.tagName==='TBODY'){ el.innerHTML = '<tr class="ui-auto"><td class="ui-state-cell" data-ui-state="loading" colspan="'+(o.cols||colsOf(el.closest('table')))+'"><span class="ui-sr">Cargando…</span>'+html+'</td></tr>'; }
      else { el.dataset.uiState='loading'; el.innerHTML = '<span class="ui-sr">Cargando…</span>'+html; }
    });
  },
  /* Estado vacío: UI.empty(el,{title:'Sin pedidos', hint:'…', kind:'empty|search|error', action:{label:'Nuevo pedido', onClick:fn}}) */
  empty: function(el, o){
    o = o||{}; if(!el) return;
    run(function(){
      if(el.tagName==='TBODY') el.innerHTML = '<tr class="ui-auto"><td class="ui-state-cell" data-ui-state="empty" colspan="'+(o.cols||colsOf(el.closest('table')))+'">'+emptyHTML(o)+'</td></tr>';
      else { el.dataset.uiState='empty'; el.innerHTML = emptyHTML(o); }
      var b = el.querySelector('[data-ui-empty-action]');
      if(b && o.action && typeof o.action.onClick==='function') b.addEventListener('click', o.action.onClick);
    });
  },
  /* Pestañas: UI.tabs(contenedor,[{id:'pend',label:'Pendientes',count:3,render:function(panel){…}}],{active:'pend',onChange:fn}) */
  tabs: function(box, items, o){
    o = o||{}; if(!box||!items||!items.length) return;
    var active = o.active || items[0].id, uid = 'uit'+Math.random().toString(36).slice(2,7);
    box.innerHTML = '<div class="ui-tabs" role="tablist">'+items.map(function(it){
      return '<button type="button" class="ui-tab" role="tab" id="'+uid+'-t-'+it.id+'" aria-controls="'+uid+'-p-'+it.id+'" data-id="'+esc(it.id)+'"'+(it.tip?' data-tip="'+esc(it.tip)+'"':'')+'>'+(it.icon||'')+esc(it.label)+(it.count!=null?'<span class="ui-tab-count">'+esc(it.count)+'</span>':'')+'</button>';
    }).join('')+'</div>'+items.map(function(it){
      return '<div class="ui-tabpanel" role="tabpanel" id="'+uid+'-p-'+it.id+'" aria-labelledby="'+uid+'-t-'+it.id+'" hidden></div>';
    }).join('');
    function sel(id){
      items.forEach(function(it){
        var t = document.getElementById(uid+'-t-'+it.id), p = document.getElementById(uid+'-p-'+it.id), on = it.id===id;
        t.classList.toggle('active', on); t.setAttribute('aria-selected', on?'true':'false'); p.hidden = !on;
        if(on && typeof it.render==='function' && (!p.__done || o.rerender)){ p.__done = true; it.render(p); }
      });
      if(typeof o.onChange==='function') o.onChange(id);
    }
    box.querySelector('.ui-tabs').addEventListener('click', function(e){ var b = e.target.closest('.ui-tab'); if(b) sel(b.getAttribute('data-id')); });
    sel(active);
    return { select: sel };
  },
  /* Paginación manual: UI.paginate(tabla) | UI.paginateList(contenedor,'.tarjeta',{size:12}) */
  paginate: function(table){ run(function(){ autoPaginate(table); }); },
  paginateList: function(box, selector, o){
    if(!box) return; box.setAttribute('data-ui-paginate', selector||':scope > *');
    if(o && o.size){ var st = pgState.get(box) || {page:1,size:o.size,count:-1,el:null}; st.size=o.size; pgState.set(box, st); }
    run(function(){ applyPaging(box, listItems(box), box); });
  },
  /* Tooltip manual: UI.tip(boton,'Texto') */
  tip: function(el, text){ if(el){ el.setAttribute('data-tip', text); if(!el.getAttribute('aria-label')) el.setAttribute('aria-label', text); } },
  /* Fuerza revisar todo (no suele hacer falta) */
  refresh: function(){ pendC.add(document.body); flush(); }
};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
