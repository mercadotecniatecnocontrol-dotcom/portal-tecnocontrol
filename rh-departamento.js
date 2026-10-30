// ═══════════════════════════════════════════════════════════════════════
//  rh-departamento.js — Departamento de Recursos Humanos (29-oct-2026)
// ═══════════════════════════════════════════════════════════════════════
//  Lo carga rh.js al entrar al área "Recursos Humanos" (index.html no cambia).
//  Junta en un solo lugar a TODO el personal de todas las áreas:
//    · colaboradores (expediente de RH, Firestore)  · ops_tecnicos (Operaciones)
//    · usuarios del portal  · fl_usuarios (Flotilla)
//  y lo que cada persona tiene en otras áreas: herramienta, vehículo, viáticos sin
//  comprobar, comisiones por pagar, permisos y guardias.
//  Secciones: Tablero (medibles) · Personal (activos y bajas) · Permisos y vacaciones
//  (el MISMO módulo que usa Operaciones: un solo lugar) · Incidencias y prenómina
//  · Altas y bajas (con lista de salida) · Expedientes y organigrama · Indicadores
//  capturados · Nómina e IMSS (archivos listos para NOMIPAQ / CONTPAQi Nóminas / IDSE).
//  Nada de lo anterior se borra: el directorio 360 y los indicadores viejos se muestran
//  dentro de este departamento.
// ═══════════════════════════════════════════════════════════════════════
(function(){
'use strict';
if(window.tcRHDepto) return;
const SB_URL='https://vlbyjoqessxcmkejcujp.supabase.co', SB_KEY='sb_publishable_18A7j06AwZqdw3gmqUDJHQ_Twu0t2a8';
let _c=null,_cp=null;
function sb(){ if(window.tcSupabase) return Promise.resolve(window.tcSupabase); if(_c) return Promise.resolve(_c); if(_cp) return _cp;
  _cp=import('https://esm.sh/@supabase/supabase-js@2').then(m=>{_c=m.createClient(SB_URL,SB_KEY);return _c;}).catch(e=>{_cp=null;throw e;}); return _cp; }
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const din=n=>'$'+(Number(n)||0).toLocaleString('es-MX',{minimumFractionDigits:2,maximumFractionDigits:2});
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const hoy=()=>iso(new Date());
function sumar(x,n){ const d=new Date(x+'T12:00:00'); d.setDate(d.getDate()+n); return iso(d); }
const fc=x=>{ if(!x) return '—'; const d=new Date(String(x).slice(0,10)+'T12:00:00'); return isNaN(d)?String(x):d.toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'}); };
const MES=m=>new Date(m+'-15T12:00:00').toLocaleDateString('es-MX',{month:'long',year:'numeric'});
const yoCorreo=()=>String((window.auth&&window.auth.currentUser&&window.auth.currentUser.email)||'').toLowerCase();
function toast(t){ if(window.mostrarToast) window.mostrarToast('Recursos Humanos',t,'✅'); else if(window.mostrarPush) window.mostrarPush('Recursos Humanos',t); }
function csv(nombre,filas){ const e=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"'; const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\ufeff'+filas.map(r=>r.map(e).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'})); a.download=nombre+'_'+hoy()+'.csv'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500); }
// Nombre en orden nombre(s) + apellidos, con mayúscula inicial
function titulo(n){ return String(n||'').toLowerCase().replace(/(^|[\s\-'])([a-záéíóúñü])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\s+/g,' ').trim(); }
// Fecha de nacimiento a partir de la CURP (posiciones 5-10: AAMMDD)
function nacDeCURP(curp){ const m=String(curp||'').toUpperCase().match(/^[A-Z]{4}(\d{2})(\d{2})(\d{2})/); if(!m) return null; const yy=Number(m[1]); const y=(yy>Number(String(new Date().getFullYear()).slice(2))?1900:2000)+yy; return y+'-'+m[2]+'-'+m[3]; }

// ───────────── Iconos (SVG) ─────────────
const sv=d=>'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
const IC={
  tablero:sv('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
  personas:sv('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  cal:sv('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  lista:sv('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  flechas:sv('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  carpeta:sv('<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>'),
  grafica:sv('<path d="M18 20V10M12 20V4M6 20v-6"/>'),
  nomina:sv('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  tv:sv('<rect x="2" y="7" width="20" height="15" rx="2"/><path d="M17 2l-5 5-5-5"/>'),
  buscar:sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  exp:sv('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  cerrar:sv('<path d="M18 6 6 18M6 6l12 12"/>'),
  alerta:sv('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  llave:sv('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  auto:sv('<path d="M5 17h14M6 17l1-6h10l1 6M8 11V7h8v4"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>'),
  dinero:sv('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  pastel:sv('<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3"/>'),
};
// ───────────── Estilo (barra azul, tarjetas con cabecera de color) ─────────────
function css(){ if(document.getElementById('rhd2-css')) return; const st=document.createElement('style'); st.id='rhd2-css'; st.textContent=`
#rhd2{display:grid;grid-template-columns:230px 1fr;background:#f3f6fb;border-radius:20px;overflow:hidden;margin:6px 0 24px;min-height:680px;font-family:inherit;color:#0f172a;box-shadow:0 10px 30px rgba(29,78,216,.08)}
@media(max-width:1000px){#rhd2{grid-template-columns:1fr}}
.rhd2-nav{background:linear-gradient(180deg,#1d4ed8 0%,#1e3a8a 100%);color:#e0e7ff;padding:20px 14px;display:flex;flex-direction:column;gap:2px;border-radius:0 34px 0 0}
.rhd2-nav .marca{font-size:17px;font-weight:800;color:#fff;padding:2px 10px 4px}.rhd2-nav .sub{font-size:11px;color:#bfdbfe;padding:0 10px 14px}
.rhd2-nav .grp{font-size:10px;letter-spacing:.9px;color:#93c5fd;font-weight:800;padding:12px 10px 6px;text-transform:uppercase}
.rhd2-nav button{display:flex;align-items:center;gap:10px;border:none;background:none;color:#e0e7ff;font-family:inherit;font-size:13px;font-weight:600;padding:9px 12px;border-radius:12px;cursor:pointer;text-align:left;width:100%}
.rhd2-nav button:hover{background:rgba(255,255,255,.1)}.rhd2-nav button.on{background:#fff;color:#1d4ed8;box-shadow:0 4px 12px rgba(0,0,0,.12)}
.rhd2-nav button b{margin-left:auto;background:#ef4444;color:#fff;border-radius:99px;font-size:10.5px;padding:1px 7px}
.rhd2-main{padding:22px 24px;min-width:0}
.rhd2-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.rhd2-t{font-size:24px;font-weight:800;color:#1e3a8a;letter-spacing:-.3px}.rhd2-s{font-size:12.5px;color:#64748b;margin-top:3px;max-width:760px;line-height:1.45}
.rhd2-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:16px}
.rhd2-big>div{border-radius:14px;padding:14px 16px;color:#fff;display:flex;gap:12px;align-items:center;cursor:pointer}
.rhd2-big .ico{width:42px;height:42px;border-radius:12px;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.rhd2-big .n{font-size:24px;font-weight:800;line-height:1}.rhd2-big .l{font-size:11.5px;opacity:.9;margin-top:3px;font-weight:600}
.rhd2-card{background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:14px 16px}
.rhd2-ct{font-size:13.5px;font-weight:800;color:#1e3a8a;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.rhd2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:12px}
.rhd2-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
.rhd2-in{height:38px;border:1px solid #dbe3f0;background:#fff;border-radius:10px;padding:0 12px;font-size:13px;font-family:inherit;color:#0f172a}
.rhd2-btn{height:38px;border:1px solid #dbe3f0;background:#fff;border-radius:10px;padding:0 13px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;gap:7px;align-items:center;color:#1e3a8a}
.rhd2-btn.pri{background:#1d4ed8;border-color:#1d4ed8;color:#fff}.rhd2-btn.roj{background:#e7402b;border-color:#e7402b;color:#fff}
.rhd2-chip{border:1px solid #dbe3f0;background:#fff;border-radius:99px;padding:5px 12px;font-size:12px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit}.rhd2-chip.on{background:#1e3a8a;border-color:#1e3a8a;color:#fff}
.rhd2-tbl{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:12.5px}
.rhd2-tbl th{text-align:left;font-size:10.5px;color:#94a3b8;text-transform:uppercase;font-weight:800;padding:0 10px;white-space:nowrap}
.rhd2-tbl td{background:#fff;padding:10px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;vertical-align:middle}
.rhd2-tbl td:first-child{border-left:1px solid #e2e8f0;border-radius:12px 0 0 12px}.rhd2-tbl td:last-child{border-right:1px solid #e2e8f0;border-radius:0 12px 12px 0}
.rhd2-tbl tr.cl td{cursor:pointer}.rhd2-tbl tr.cl:hover td{background:#f8fbff}
.rhd2-av{width:34px;height:34px;border-radius:50%;background:#dbeafe;color:#1d4ed8;font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
.rhd2-av img{width:100%;height:100%;object-fit:cover}
.rhd2-tag{display:inline-block;font-size:10px;font-weight:800;border-radius:99px;padding:2px 8px;margin:1px 2px 1px 0;white-space:nowrap}
.rhd2-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;border-radius:99px;padding:3px 9px;white-space:nowrap}
.rhd2-barra{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden}.rhd2-barra i{display:block;height:100%;border-radius:99px}
.rhd2-mod{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:100000;display:flex;align-items:center;justify-content:center;padding:18px}
.rhd2-box{background:#fff;border-radius:18px;width:900px;max-width:97vw;max-height:94vh;overflow-y:auto;padding:22px 24px}.rhd2-box.sm{width:560px}
.rhd2-f{background:#f8fafc;border-radius:12px;padding:10px 12px}.rhd2-k{font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px}.rhd2-v{font-size:13px;color:#0f172a;font-weight:600}
.rhd2-gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:12px 0}
.rhd2-lb{font-size:11.5px;font-weight:700;color:#475569}.rhd2-fi{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font-size:13px;margin:4px 0 11px;font-family:inherit}
.rhd2-vacio{background:#fff;border:1px dashed #cbd5e1;border-radius:14px;padding:26px;text-align:center;color:#94a3b8;font-size:13px}
`; document.head.appendChild(st); }
function modal(html,sm){ let m=document.getElementById('rhd2-modal'); if(!m){ m=document.createElement('div'); m.id='rhd2-modal'; document.body.appendChild(m); }
  m.innerHTML=html?'<div class="rhd2-mod" onclick="if(event.target===this)window.__rhdCerrar()"><div class="rhd2-box'+(sm?' sm':'')+'">'+html+'</div></div>':''; }
window.__rhdCerrar=()=>modal('');
const pill=(t,c,bg)=>'<span class="rhd2-pill" style="color:'+c+';background:'+bg+'">'+esc(t)+'</span>';
const iniciales=n=>titulo(n).split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('');

// ═════════════ DATOS: un solo padrón con todas las fuentes ═════════════
const D={ personas:[], aus:[], ind:[], herr:{}, veh:[], via:[], com:[], guard:[], cargado:false, cargando:null, err:null };
const S={ secc:'tablero', q:'', estatus:'activo', depto:'', mes:hoy().slice(0,7), periodo:'semana', perIni:null };
async function cargarTodo(forzar){
  if(D.cargando&&!forzar) return D.cargando;
  D.cargando=(async()=>{
    const c=await sb();
    const docs=col=>c.from('ops_docs').select('doc_id,datos').eq('coleccion',col).limit(2000).then(r=>r.data||[]).catch(()=>[]);
    const fl=col=>c.from('fl_docs').select('ref,datos').eq('col',col).limit(2000).then(r=>r.data||[]).catch(()=>[]);
    const colabsP=(async()=>{ try{ const fs=await (window.tcFSPuente?window.tcFSPuente():import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')); const snap=await fs.getDocs(fs.collection(window.db,'colaboradores')); return snap.docs.map(d=>({id:d.id,...d.data()})); }catch(e){ console.warn('[RH] colaboradores',e); return []; } })();
    const [colabs,tecs,usus,flu,aus,ind,herr,veh,via,com,guard]=await Promise.all([ colabsP, docs('ops_tecnicos'), docs('usuarios'), fl('fl_usuarios'),
      c.from('rh_solicitudes_ausencia').select('*').order('fecha_inicio',{ascending:false}).limit(2000).then(r=>r.data||[]).catch(()=>[]),
      docs('rh_indicadores'),
      c.from('ops_herramientas').select('folio,descripcion,estado,tecnico_actual_id').not('tecnico_actual_id','is',null).limit(5000).then(r=>r.data||[]).catch(()=>[]),
      fl('flotilla_vehiculos'),
      c.from('ops_solicitudes_viaticos').select('id,folio,estatus,responsable_email,responsable_nombre,monto_entregado,deposito,total,cierre,fecha_limite_comprobacion,destino').in('estatus',['Pendiente','Pagada']).limit(2000).then(r=>r.data||[]).catch(()=>[]),
      c.from('ops_comisiones').select('tecnico_id,tecnico_nombre,tecnico_correo,monto,estatus,concepto,servicio_nombre,fecha_servicio').limit(5000).then(r=>r.data||[]).catch(()=>[]),
      docs('ops_guardias_programadas') ]);
    // ── unir personas por correo (o por nombre si no hay correo) ──
    const mapa=new Map(); const llaveN=n=>'n:'+norm(n);
    const buscar=(correo,nombre)=>{ const k1=correo?String(correo).toLowerCase().trim():''; if(k1&&mapa.has(k1)) return mapa.get(k1); const k2=nombre?llaveN(nombre):''; if(k2&&mapa.has(k2)) return mapa.get(k2); return null; };
    const alta=(correo,nombre)=>{ let p=buscar(correo,nombre); if(!p){ p={correo:correo?String(correo).toLowerCase().trim():'',fuentes:[],ids:{}}; } const k1=p.correo||(correo?String(correo).toLowerCase().trim():''); if(k1){ p.correo=k1; mapa.set(k1,p); } if(nombre) mapa.set(llaveN(nombre),p); return p; };
    colabs.forEach(x=>{ if(!(x.nombre||'').trim()&&!x.correo) return; const p=alta(x.correo||(String(x.id).includes('@')?x.id:''),x.nombre); p.fuentes.push('RH'); p.ids.colab=x.id; p.colab=x; });
    tecs.forEach(r=>{ const x=r.datos||{}; if(x.demo) return; if(!(x.nombre||'').trim()) return; const p=alta(x.correo,x.nombre); p.fuentes.push('Operaciones'); p.ids.tec=r.doc_id; p.tec=x; });
    usus.forEach(r=>{ const x=r.datos||{}; const cor=x.correo||x.email; if(!cor&&!x.nombre) return; const p=alta(cor,x.nombre); p.fuentes.push('Portal'); p.ids.usu=r.doc_id; p.usu=x; });
    flu.forEach(r=>{ const x=r.datos||{}; const cor=x.correo||x.email||x['email ']; const nom=x.nombre||x['nombre ']; if(!cor&&!nom) return; const p=alta(cor,nom); p.fuentes.push('Flotilla'); p.ids.fl=r.ref; p.fl=x; });
    const unicos=[...new Set(mapa.values())];
    D.personas=unicos.map(p=>{ const C=p.colab||{}, T=p.tec||{}, U=p.usu||{}, F=p.fl||{};
      const nombre=titulo(C.nombre||T.nombre||U.nombre||F.nombre||F['nombre ']||p.correo);
      const baja=String(C.estatus||'').toLowerCase()==='baja'||String(T.estatus||'').toLowerCase()==='baja';
      const curp=C.curp||'';
      return { key:p.correo||llaveN(nombre), nombre, correo:p.correo, fuentes:[...new Set(p.fuentes)], ids:p.ids,
        puesto:C.puesto||T.puesto||U.puesto||'', departamento:C.departamento||T.departamento||U.departamento||U.area||F.departamento||F.area||'', plaza:C.plaza||T.plaza||'',
        telefono:C.telefono||T.telefono||'', numEmpleado:C.num_empleado||T.numeroOperativo||'', jefe:C.jefe||T.supervisor||'',
        rfc:C.rfc||'', curp, nss:C.nss||'', contrato:C.tipo_contrato||'', nacimiento:nacDeCURP(curp),
        ingreso:C.fecha_ingreso||C.fechaIngreso||T.fechaIngreso||'', fechaBaja:C.fecha_baja||C.fechaBaja||T.fechaBaja||'', motivoBaja:C.motivo_baja||C.motivoBaja||T.motivoBaja||'',
        foto:C.foto||C.fotoUrl||T.fotoPerfil||'', estatus:baja?'baja':'activo', esTecnico:!!p.ids.tec&&!T.esPersonalOficina, accesoPortal:!!p.ids.usu&&U.activo!==false, rolPortal:U.rol||'', rolFlotilla:F.rol||U.rolFlotilla||'',
        tecId:p.ids.tec||null, colabId:p.ids.colab||null, raw:p };
    }).filter(p=>p.nombre&&!/^n:/.test(p.nombre)).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
    D.aus=aus; D.ind=ind.map(r=>Object.assign({id:r.doc_id},r.datos||{})); D.via=via; D.com=com; D.guard=guard.map(r=>Object.assign({id:r.doc_id},r.datos||{}));
    D.herr={}; herr.filter(h=>h.estado!=='baja').forEach(h=>{ (D.herr[h.tecnico_actual_id]=D.herr[h.tecnico_actual_id]||[]).push(h); });
    D.veh=veh.map(r=>r.datos||{}).filter(v=>v.status!=='baja');
    D.cargado=true; D.err=null;
  })().catch(e=>{ D.err=e.message||String(e); console.error('[RH depto]',e); }).finally(()=>{ D.cargando=null; });
  return D.cargando;
}
// Lo que tiene cada persona en otras áreas
function enAreas(p){
  const n=norm(p.nombre), cor=p.correo;
  const herr=p.tecId?(D.herr[p.tecId]||[]):[];
  const veh=D.veh.filter(v=>v.responsable&&(norm(v.responsable)===n||(n.split(' ').length>=2&&norm(v.responsable).startsWith(n.split(' ').slice(0,2).join(' ')))));
  const via=D.via.filter(v=>cor&&String(v.responsable_email||'').toLowerCase()===cor&&v.estatus==='Pagada'&&!v.cierre);
  const com=D.com.filter(x=>(p.tecId&&x.tecnico_id===p.tecId)||(cor&&String(x.tecnico_correo||'').toLowerCase()===cor)).filter(x=>x.estatus==='por_pagar');
  const aus=D.aus.filter(a=>(cor&&String(a.colaborador_email||'').toLowerCase()===cor)||(p.tecId&&a.tecnico_id===p.tecId));
  const guard=D.guard.filter(g=>p.tecId&&g.tecnicoId===p.tecId&&String(g.semanaInicio||'')>=sumar(hoy(),-7));
  return {herr,veh,via,com,aus,guard};
}
function completitud(p){ const req=[['numEmpleado','Número de empleado'],['rfc','RFC'],['curp','CURP'],['nss','NSS'],['ingreso','Fecha de ingreso'],['telefono','Teléfono'],['departamento','Departamento'],['puesto','Puesto']];
  const falta=req.filter(r=>!String(p[r[0]]||'').trim()).map(r=>r[1]); return {pct:Math.round((req.length-falta.length)/req.length*100),falta}; }

// ═════════════ PINTAR ═════════════
const SECC=[ ['tablero','Tablero','tablero'],['personal','Personal','personas'],['permisos','Permisos y vacaciones','cal'],['incidencias','Incidencias y prenómina','lista'],
  ['movimientos','Altas y bajas','flechas'],['expedientes','Expedientes y organigrama','carpeta'],['indicadores','Indicadores capturados','grafica'],['nomina','Nómina e IMSS','nomina'] ];
function cont(){ return document.getElementById('rhd2-app'); }
function pintar(){
  const el=cont(); if(!el) return; css();
  const activos=D.personas.filter(p=>p.estatus==='activo');
  const ausPend=D.aus.filter(a=>a.estatus==='Pendiente'||a.estatus==='Preautorizada').length;
  const expInc=activos.filter(p=>completitud(p).pct<100).length;
  const nav='<nav class="rhd2-nav"><div class="marca">Recursos Humanos</div><div class="sub">'+activos.length+' personas activas</div><div class="grp">Día a día</div>'+
    SECC.slice(0,5).map(([k,t,i])=>'<button class="'+(S.secc===k?'on':'')+'" onclick="window.__rhdIr(\''+k+'\')">'+IC[i]+t+(k==='permisos'&&ausPend?'<b>'+ausPend+'</b>':'')+'</button>').join('')+
    '<div class="grp">Expediente y cierre</div>'+SECC.slice(5).map(([k,t,i])=>'<button class="'+(S.secc===k?'on':'')+'" onclick="window.__rhdIr(\''+k+'\')">'+IC[i]+t+(k==='expedientes'&&expInc?'<b>'+expInc+'</b>':'')+'</button>').join('')+
    '<button onclick="window.rhAbrirAvisosTV&&window.rhAbrirAvisosTV()" style="margin-top:6px">'+IC.tv+'Avisos de la TV</button>'+
    '<div style="margin-top:auto;font-size:10.5px;color:#bfdbfe;line-height:1.5;padding:14px 10px 0">Un solo padrón para todo el portal: RH, Operaciones, Flotilla y usuarios del portal.</div></nav>';
  let tit='',sub='',cuerpo='';
  if(!D.cargado){ cuerpo=D.err?'<div class="rhd2-vacio" style="color:#b91c1c">No se pudo cargar: '+esc(D.err)+'</div>':'<div class="rhd2-vacio">Juntando la información de todas las áreas…</div>'; }
  else if(S.secc==='tablero'){ tit='Tablero de Recursos Humanos'; sub='Medibles del mes y todo lo que requiere atención, con información de todas las áreas.'; cuerpo=tableroHTML(); }
  else if(S.secc==='personal'){ tit='Personal'; sub='Todas las personas del portal en un solo lugar: activas y bajas. Haz clic en cualquiera para ver lo que tiene en cada área.'; cuerpo=personalHTML(); }
  else if(S.secc==='permisos'){ tit='Permisos, vacaciones y faltas'; sub='Un solo lugar para todo el personal. Es el mismo registro que ven Operaciones y la app de los técnicos: lo que se aprueba aquí se aparta en su calendario.'; cuerpo='<div id="rhd2-permisos" class="rhd2-card"><div class="rhd2-vacio">Cargando permisos…</div></div>'; }
  else if(S.secc==='incidencias'){ tit='Incidencias y prenómina'; sub='Lo que afecta la nómina del periodo, por persona: vacaciones, permisos con y sin goce, incapacidades, faltas, retardos, descuentos y comisiones por pagar. Se exporta para NOMIPAQ / CONTPAQi Nóminas.'; cuerpo=incidenciasHTML(); }
  else if(S.secc==='movimientos'){ tit='Altas y bajas'; sub='Movimientos de personal y lista de salida: antes de dar de baja a alguien, ves qué tiene pendiente en cada área (herramienta, vehículo, viáticos, comisiones).'; cuerpo=movimientosHTML(); }
  else if(S.secc==='expedientes'){ tit='Expedientes y organigrama'; sub='Expediente de cada colaborador (datos, documentos, escaneo con OCR, trayectoria) y el organigrama.'; cuerpo='<div class="rhd2-bar">'+['directorio:Directorio de expedientes','organigrama:Organigrama','alertas:Documentos por vencer'].map(x=>{ const [k,t]=x.split(':'); return '<button class="rhd2-chip" onclick="window.rhSetVista&&window.rhSetVista(\''+k+'\')">'+t+'</button>'; }).join('')+'<button class="rhd2-btn pri" onclick="window.rhNuevoColaborador&&window.rhNuevoColaborador()">+ Alta de colaborador</button></div><div id="rhd2-slot-360"></div>'; }
  else if(S.secc==='indicadores'){ tit='Indicadores capturados'; sub='Retardos, descuentos, actas, vacantes e incapacidades que captura RH a mano. Las faltas y permisos ya se registran en "Permisos y vacaciones" para no capturarlos dos veces.'; cuerpo='<div id="rhd2-slot-ind"></div>'; }
  else { tit='Nómina e IMSS'; sub='Archivos listos para revisar e importar. El portal captura y da seguimiento; NOMIPAQ / CONTPAQi Nóminas y el IMSS siguen siendo los sistemas oficiales.'; cuerpo=nominaHTML(); }
  el.innerHTML='<div id="rhd2">'+nav+'<div class="rhd2-main"><div class="rhd2-hd"><div><div class="rhd2-t">'+esc(tit||'Recursos Humanos')+'</div><div class="rhd2-s">'+esc(sub)+'</div></div><button class="rhd2-btn" onclick="window.__rhdRecargar()">↻ Actualizar</button></div>'+cuerpo+'</div></div>';
  montarSlots();
}
// Reusa lo que ya existe: el directorio 360 (rh360-root) y los indicadores viejos (rh-dashboard) se muestran dentro del departamento.
function montarSlots(){
  const r360=document.getElementById('rh360-root'), dash=document.getElementById('rh-dashboard'), casa=document.getElementById('rhd2-casa');
  const s360=document.getElementById('rhd2-slot-360'), sInd=document.getElementById('rhd2-slot-ind');
  if(r360){ if(s360){ s360.appendChild(r360); r360.style.display='block'; if(!r360.innerHTML.trim()&&window.initRH360) window.initRH360(); } else if(casa){ casa.appendChild(r360); r360.style.display='none'; } }
  if(dash){ if(sInd){ sInd.appendChild(dash); dash.style.display='block'; if(window.cargarDatosRH) try{ window.cargarDatosRH(); }catch(e){} } else if(casa){ casa.appendChild(dash); dash.style.display='none'; } }
  if(S.secc==='permisos') montarPermisos();
}
async function montarPermisos(){ const c=document.getElementById('rhd2-permisos'); if(!c) return;
  try{ if(!window.tcPermisos){ await new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src='permisos.js?v=2'; s.onload=ok; s.onerror=()=>ko(new Error('No se pudo cargar permisos.js')); document.head.appendChild(s); }); }
    const correo=yoCorreo(), u=window.auth&&window.auth.currentUser;
    window.tcPermisos.panel(c,{ puedeAprobar:true, usuario:{correo,nombre:(u&&u.displayName)||correo}, titulo:'Permisos, vacaciones y faltas' });
  }catch(e){ c.innerHTML='<div style="color:#b91c1c">'+esc(e.message)+'</div>'; } }

// ── Tablero ──
function enMes(f,m){ return String(f||'').slice(0,7)===m; }
function diasEnRango(a,ini,fin){ const i=a.fecha_inicio>ini?a.fecha_inicio:ini, f=a.fecha_fin<fin?a.fecha_fin:fin; if(!i||!f||f<i) return 0; return Math.round((new Date(f+'T12:00:00')-new Date(i+'T12:00:00'))/864e5)+1; }
function tableroHTML(){
  const m=S.mes, H=hoy(), act=D.personas.filter(p=>p.estatus==='activo');
  const ini=m+'-01', fin=sumar(iso(new Date(new Date(ini+'T12:00:00').getFullYear(),new Date(ini+'T12:00:00').getMonth()+1,1)),-1);
  const altas=D.personas.filter(p=>enMes(p.ingreso,m)), bajas=D.personas.filter(p=>enMes(p.fechaBaja,m));
  const bajasInd=D.ind.filter(x=>x.tipo==='rotacion'&&(x.movimiento||'baja')==='baja'&&enMes(x.fecha,m));
  const nBajas=Math.max(bajas.length,bajasInd.length);
  const rot=act.length?Math.round(nBajas/act.length*1000)/10:0;
  const ausMes=D.aus.filter(a=>a.estatus==='Aprobada'||a.estatus==='Preautorizada');
  const diasAus=ausMes.reduce((s,a)=>s+diasEnRango(a,ini,fin),0);
  const diasLab=Math.max(1,Math.round((new Date(fin+'T12:00:00')-new Date(ini+'T12:00:00'))/864e5*6/7+6/7));
  const ausent=act.length?Math.round(diasAus/(act.length*diasLab)*1000)/10:0;
  const fueraHoy=ausMes.filter(a=>a.fecha_inicio<=H&&a.fecha_fin>=H);
  const pend=D.aus.filter(a=>a.estatus==='Pendiente'||a.estatus==='Preautorizada');
  const inc=act.map(p=>({p,c:completitud(p)})).filter(x=>x.c.pct<100).sort((a,b)=>a.c.pct-b.c.pct);
  const retardos=D.ind.filter(x=>x.tipo==='retardo'&&enMes(x.fecha,m)).length, actas=D.ind.filter(x=>x.tipo==='acta'&&enMes(x.fecha,m)).length;
  const vac=D.ind.filter(x=>x.tipo==='vacante'&&x.estatus!=='concretada');
  const mesN=Number(m.slice(5)), cumple=act.filter(p=>p.nacimiento&&Number(p.nacimiento.slice(5,7))===mesN).sort((a,b)=>a.nacimiento.slice(8).localeCompare(b.nacimiento.slice(8)));
  const aniv=act.filter(p=>p.ingreso&&Number(p.ingreso.slice(5,7))===mesN&&p.ingreso.slice(0,4)<m.slice(0,4));
  const pend2=act.map(p=>({p,a:enAreas(p)})).filter(x=>x.a.via.length);
  const porDep={}; act.forEach(p=>{ const d=p.departamento||'Sin departamento'; porDep[d]=(porDep[d]||0)+1; }); const deps=Object.entries(porDep).sort((a,b)=>b[1]-a[1]); const maxD=deps.length?deps[0][1]:1;
  const big=(bg,ico,n,l,fn)=>'<div style="background:'+bg+'" onclick="'+fn+'"><div class="ico">'+ico+'</div><div><div class="n">'+n+'</div><div class="l">'+l+'</div></div></div>';
  const lista=(arr,fn)=>arr.length?arr.map(fn).join(''):'<div style="font-size:12px;color:#94a3b8">Nada por ahora.</div>';
  const fila=(izq,der,fn)=>'<div '+(fn?'onclick="'+fn+'" ':'')+'style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;'+(fn?'cursor:pointer':'')+'">'+izq+'<span>'+der+'</span></div>';
  return '<div class="rhd2-bar"><div style="display:inline-flex;align-items:center;border:1px solid #dbe3f0;background:#fff;border-radius:10px;height:38px"><button class="rhd2-btn" style="border:none;height:36px" onclick="window.__rhdMes(-1)">‹</button><span style="font-size:13px;font-weight:800;color:#1e3a8a;text-transform:capitalize;padding:0 10px;min-width:150px;text-align:center">'+MES(m)+'</span><button class="rhd2-btn" style="border:none;height:36px" onclick="window.__rhdMes(1)">›</button></div></div>'+
    '<div class="rhd2-big">'+big('#e7402b',IC.personas,act.length,'Plantilla activa',"window.__rhdIr('personal')")+big('#1d4ed8',IC.flechas,altas.length+' / '+nBajas,'Altas / bajas del mes',"window.__rhdIr('movimientos')")+
      big('#3b82f6',IC.grafica,rot+'%','Rotación del mes',"window.__rhdIr('movimientos')")+big('#64748b',IC.cal,ausent+'%','Ausentismo ('+diasAus+' días)',"window.__rhdIr('incidencias')")+'</div>'+
    '<div class="rhd2-grid">'+
      '<div class="rhd2-card"><div class="rhd2-ct">Hoy fuera de la oficina <span>'+pill(fueraHoy.length+' persona(s)','#0e7490','#cffafe')+'</span></div>'+lista(fueraHoy.slice(0,8),a=>fila('<b>'+esc(titulo(a.colaborador_nombre))+'</b>',pill(a.tipo+' · regresa '+fc(sumar(a.fecha_fin,1)),'#0e7490','#ecfeff')))+'</div>'+
      '<div class="rhd2-card"><div class="rhd2-ct">Permisos por resolver <span>'+pill(pend.length,'#b45309','#fef3c7')+'</span></div>'+lista(pend.slice(0,8),a=>fila('<span><b>'+esc(titulo(a.colaborador_nombre))+'</b> · '+esc(a.tipo)+'</span>',pill(a.estatus==='Preautorizada'?'Falta RH':'Falta jefe',a.estatus==='Preautorizada'?'#1d4ed8':'#b45309',a.estatus==='Preautorizada'?'#dbeafe':'#fef3c7'),"window.__rhdIr('permisos')"))+'</div>'+
      '<div class="rhd2-card"><div class="rhd2-ct">Expedientes incompletos <span>'+pill(inc.length,'#b91c1c','#fee2e2')+'</span></div>'+lista(inc.slice(0,8),x=>fila('<b>'+esc(x.p.nombre)+'</b>','<span style="font-size:11px;color:#64748b">'+x.c.pct+'% · falta '+esc(x.c.falta.slice(0,2).join(', '))+(x.c.falta.length>2?'…':'')+'</span>',"window.__rhdPersona('"+esc(x.p.key)+"')"))+'</div>'+
    '</div><div class="rhd2-grid">'+
      '<div class="rhd2-card"><div class="rhd2-ct">Personal por departamento</div>'+deps.map(([d,n])=>'<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#334155"><span>'+esc(d)+'</span><span>'+n+'</span></div><div class="rhd2-barra"><i style="width:'+Math.round(n/maxD*100)+'%;background:#3b82f6"></i></div></div>').join('')+'</div>'+
      '<div class="rhd2-card"><div class="rhd2-ct">Cumpleaños y aniversarios del mes</div>'+lista(cumple.map(p=>({p,t:'Cumpleaños · '+Number(p.nacimiento.slice(8))+' de '+new Date(p.nacimiento+'T12:00:00').toLocaleDateString('es-MX',{month:'long'})})).concat(aniv.map(p=>({p,t:(Number(m.slice(0,4))-Number(p.ingreso.slice(0,4)))+' año(s) en la empresa'}))).slice(0,10),x=>fila('<b>'+esc(x.p.nombre)+'</b>','<span style="font-size:11px;color:#64748b">'+esc(x.t)+'</span>'))+'<div style="font-size:10.5px;color:#94a3b8;margin-top:6px">Los cumpleaños salen de la CURP del expediente.</div></div>'+
      '<div class="rhd2-card"><div class="rhd2-ct">Del mes</div>'+fila('Retardos capturados','<b>'+retardos+'</b>')+fila('Actas administrativas','<b>'+actas+'</b>')+fila('Vacantes abiertas','<b>'+vac.length+'</b>',"window.__rhdIr('indicadores')")+fila('Personas con viáticos sin comprobar','<b>'+pend2.length+'</b>')+fila('Personas sin correo (no reciben avisos)','<b>'+act.filter(p=>!p.correo).length+'</b>',"window.__rhdIr('personal')")+'</div>'+
    '</div>';
}
window.__rhdMes=v=>{ const d=new Date(S.mes+'-15T12:00:00'); d.setMonth(d.getMonth()+v); S.mes=iso(d).slice(0,7); pintar(); };

// ── Personal ──
function personalHTML(){
  const q=norm(S.q); const deps=[...new Set(D.personas.map(p=>p.departamento).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  const l=D.personas.filter(p=>(S.estatus==='todos'||p.estatus===S.estatus)&&(!S.depto||p.departamento===S.depto)&&(!q||norm([p.nombre,p.correo,p.puesto,p.departamento,p.plaza,p.numEmpleado].join(' ')).includes(q)));
  const chip=(k,t,n)=>'<button class="rhd2-chip'+(S.estatus===k?' on':'')+'" onclick="window.__rhdSet(\'estatus\',\''+k+'\')">'+t+' ('+n+')</button>';
  const tagF={RH:['#be185d','#fce7f3'],Operaciones:['#1d4ed8','#dbeafe'],Portal:['#15803d','#dcfce7'],Flotilla:['#c2410c','#ffedd5']};
  return '<div class="rhd2-bar"><span class="rhd2-btn" style="pointer-events:none">'+IC.buscar+'</span><input id="rhd2-q" class="rhd2-in" style="min-width:260px" placeholder="Buscar nombre, correo, puesto, número…" value="'+esc(S.q)+'" oninput="window.__rhdSet(\'q\',this.value)">'+
    '<select class="rhd2-in" onchange="window.__rhdSet(\'depto\',this.value)"><option value="">Todos los departamentos</option>'+deps.map(d=>'<option '+(S.depto===d?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select>'+
    chip('activo','Activos',D.personas.filter(p=>p.estatus==='activo').length)+chip('baja','Bajas',D.personas.filter(p=>p.estatus==='baja').length)+chip('todos','Todos',D.personas.length)+
    '<span style="margin-left:auto"></span><button class="rhd2-btn" onclick="window.__rhdExportPlantilla()">'+IC.exp+' Exportar plantilla</button><button class="rhd2-btn pri" onclick="window.__rhdIr(\'expedientes\');setTimeout(()=>window.rhNuevoColaborador&&window.rhNuevoColaborador(),300)">+ Alta</button></div>'+
    (l.length?'<table class="rhd2-tbl"><tr><th>Nombre</th><th>Puesto y departamento</th><th>Dónde aparece</th><th>Tiene a su cargo</th><th>Expediente</th><th>Estatus</th></tr>'+
      l.map(p=>{ const a=enAreas(p), c=completitud(p);
        const tiene=[a.herr.length?a.herr.length+' herramienta(s)':'',a.veh.length?'ECO '+a.veh.map(v=>v.eco).join(', '):'',a.via.length?a.via.length+' viático(s) sin comprobar':'',a.com.length?a.com.length+' comisión(es)':''].filter(Boolean);
        return '<tr class="cl" onclick="window.__rhdPersona(\''+esc(p.key)+'\')"><td><div style="display:flex;gap:10px;align-items:center"><span class="rhd2-av">'+(p.foto&&/^(data:|https?:)/.test(p.foto)?'<img src="'+esc(p.foto)+'">':esc(iniciales(p.nombre)))+'</span><div><b>'+esc(p.nombre)+'</b><div style="font-size:11px;color:#64748b">'+esc(p.correo||'sin correo')+(p.numEmpleado?' · N.º '+esc(p.numEmpleado):'')+'</div></div></div></td>'+
          '<td><div style="font-weight:600">'+esc(p.puesto||'—')+'</div><div style="font-size:11px;color:#64748b">'+esc([p.departamento,p.plaza].filter(Boolean).join(' · ')||'—')+'</div></td>'+
          '<td>'+p.fuentes.map(f=>'<span class="rhd2-tag" style="color:'+tagF[f][0]+';background:'+tagF[f][1]+'">'+f+'</span>').join('')+'</td>'+
          '<td style="font-size:11.5px;color:#334155">'+(tiene.join('<br>')||'<span style="color:#94a3b8">—</span>')+'</td>'+
          '<td style="min-width:110px"><div class="rhd2-barra"><i style="width:'+c.pct+'%;background:'+(c.pct===100?'#16a34a':c.pct>=60?'#f59e0b':'#ef4444')+'"></i></div><div style="font-size:10.5px;color:#64748b;margin-top:3px">'+c.pct+'% completo</div></td>'+
          '<td>'+(p.estatus==='activo'?pill('Activo','#15803d','#dcfce7'):pill('Baja'+(p.fechaBaja?' · '+fc(p.fechaBaja):''),'#b91c1c','#fee2e2'))+'</td></tr>'; }).join('')+'</table>'
      :'<div class="rhd2-vacio">Nadie coincide con la búsqueda.</div>');
}
window.__rhdSet=(k,v)=>{ S[k]=v; pintar(); if(k==='q'){ const i=document.getElementById('rhd2-q'); if(i){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); } } };
window.__rhdExportPlantilla=()=>csv('plantilla_personal',[['Nombre','Correo','N.º empleado','Puesto','Departamento','Plaza','Teléfono','RFC','CURP','NSS','Fecha de ingreso','Estatus','Fecha de baja','Motivo de baja','Jefe directo','Tipo de contrato','Fuentes','Herramientas a su cargo','Vehículo','Viáticos sin comprobar']]
  .concat(D.personas.map(p=>{ const a=enAreas(p); return [p.nombre,p.correo,p.numEmpleado,p.puesto,p.departamento,p.plaza,p.telefono,p.rfc,p.curp,p.nss,p.ingreso,p.estatus,p.fechaBaja,p.motivoBaja,p.jefe,p.contrato,p.fuentes.join(' / '),a.herr.length,a.veh.map(v=>'ECO '+v.eco).join(' '),a.via.length]; })));

// ── Ficha de una persona (todo lo que tiene en cada área) ──
window.__rhdPersona=function(key){ const p=D.personas.find(x=>x.key===key); if(!p) return; const a=enAreas(p), c=completitud(p);
  const f=(k,v)=>'<div class="rhd2-f"><div class="rhd2-k">'+k+'</div><div class="rhd2-v">'+(v?esc(v):'<span style="color:#cbd5e1">—</span>')+'</div></div>';
  const blq=(t,n,cuerpo)=>'<div class="rhd2-card" style="margin-bottom:10px"><div class="rhd2-ct">'+t+' <span>'+pill(String(n),'#1e3a8a','#e0e7ff')+'</span></div>'+(cuerpo||'<div style="font-size:12px;color:#94a3b8">Nada.</div>')+'</div>';
  const li=arr=>arr.length?'<div style="font-size:12px;color:#334155;line-height:1.7">'+arr.join('<br>')+'</div>':'';
  modal('<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div style="display:flex;gap:12px;align-items:center"><span class="rhd2-av" style="width:52px;height:52px;font-size:16px">'+(p.foto&&/^(data:|https?:)/.test(p.foto)?'<img src="'+esc(p.foto)+'">':esc(iniciales(p.nombre)))+'</span><div><div style="font-size:21px;font-weight:800;color:#1e3a8a">'+esc(p.nombre)+'</div><div style="font-size:12.5px;color:#64748b">'+esc([p.puesto,p.departamento,p.plaza].filter(Boolean).join(' · '))+'</div></div></div>'+
    '<div style="display:flex;gap:8px;align-items:center">'+(p.estatus==='activo'?pill('Activo','#15803d','#dcfce7'):pill('Baja','#b91c1c','#fee2e2'))+'<button class="rhd2-btn" onclick="window.__rhdCerrar()">'+IC.cerrar+'</button></div></div>'+
    '<div class="rhd2-gr">'+f('Correo',p.correo)+f('N.º de empleado',p.numEmpleado)+f('Teléfono',p.telefono)+f('Jefe directo',p.jefe)+f('RFC',p.rfc)+f('CURP',p.curp)+f('NSS',p.nss)+f('Fecha de ingreso',p.ingreso?fc(p.ingreso):'')+(p.estatus==='baja'?f('Fecha de baja',p.fechaBaja?fc(p.fechaBaja):'')+f('Motivo de baja',p.motivoBaja):'')+f('Acceso al portal',p.accesoPortal?'Sí'+(p.rolPortal?' · '+p.rolPortal:''):'No')+f('Flotilla',p.rolFlotilla||'')+'</div>'+
    (c.pct<100?'<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:9px 12px;font-size:12.5px;color:#991b1b;margin-bottom:10px">Expediente al '+c.pct+'%. Falta: <b>'+esc(c.falta.join(', '))+'</b>.</div>':'')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
      blq('Herramienta a su cargo',a.herr.length,li(a.herr.map(h=>'<b>'+esc(h.folio)+'</b> · '+esc(h.descripcion||'')+(h.estado==='prestamo'?' (prestada)':''))))+
      blq('Vehículo',a.veh.length,li(a.veh.map(v=>'<b>ECO '+esc(v.eco)+'</b> · '+esc(v.unidad||''))))+
      blq('Viáticos sin comprobar',a.via.length,li(a.via.map(v=>'<b>'+esc(v.folio)+'</b> · '+esc(v.destino||'')+' · '+din(v.monto_entregado)+' · límite '+fc(v.fecha_limite_comprobacion))))+
      blq('Comisiones por pagar',a.com.length,li(a.com.slice(0,10).map(x=>esc(x.servicio_nombre||x.estacion||'')+' · '+din(x.monto)+' · '+esc(x.estatus||''))))+
      blq('Permisos, vacaciones e incapacidades',a.aus.length,li(a.aus.slice(0,8).map(x=>esc(x.tipo)+' · '+fc(x.fecha_inicio)+(x.fecha_fin!==x.fecha_inicio?' a '+fc(x.fecha_fin):'')+' · '+esc(x.estatus))))+
      blq('Guardias',a.guard.length,li(a.guard.map(g=>'Semana del '+fc(g.semanaInicio)+' · '+esc(g.tipo||'técnica'))))+
    '</div><div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:6px">'+
      (p.colabId?'<button class="rhd2-btn" onclick="window.__rhdCerrar();window.__rhdIr(\'expedientes\');setTimeout(()=>window.rhAbrirPerfil&&window.rhAbrirPerfil(\''+esc(p.colabId)+'\'),350)">'+IC.carpeta+' Abrir expediente</button>':'<button class="rhd2-btn" onclick="window.__rhdCerrar();window.__rhdIr(\'expedientes\');setTimeout(()=>window.rhNuevoColaborador&&window.rhNuevoColaborador(),350)">'+IC.carpeta+' Crear expediente</button>')+
      (p.estatus==='activo'?'<button class="rhd2-btn roj" onclick="window.__rhdBajaForm(\''+esc(p.key)+'\')">Dar de baja</button>':'')+'</div>');
};

// ── Incidencias y prenómina ──
function periodo(){ const H=hoy(); if(S.periodo==='mes'){ const ini=S.mes+'-01', d=new Date(ini+'T12:00:00'); return {ini,fin:sumar(iso(new Date(d.getFullYear(),d.getMonth()+1,1)),-1),txt:MES(S.mes)}; }
  if(S.periodo==='quincena'){ const base=S.perIni||H, d=Number(base.slice(8)), m=base.slice(0,7); const ini=d<=15?m+'-01':m+'-16'; const fin=d<=15?m+'-15':sumar(iso(new Date(Number(m.slice(0,4)),Number(m.slice(5)),1)),-1); return {ini,fin,txt:'Quincena del '+fc(ini)+' al '+fc(fin)}; }
  // semana de nómina sábado → viernes (la que ya usa RH)
  const base=new Date((S.perIni||H)+'T12:00:00'); const dif=(base.getDay()+1)%7; base.setDate(base.getDate()-dif); const ini=iso(base); return {ini,fin:sumar(ini,6),txt:'Semana del '+fc(ini)+' al '+fc(sumar(ini,6))}; }
function incidencias(){ const P=periodo(); const filas=new Map();
  const persona=(nombre,correo,tecId)=>D.personas.find(p=>(correo&&p.correo===String(correo).toLowerCase())||(tecId&&p.tecId===tecId))||D.personas.find(p=>norm(p.nombre)===norm(nombre))||{key:'n:'+norm(nombre),nombre:titulo(nombre),numEmpleado:'',departamento:''};
  const add=(p,concepto,dias,importe,detalle)=>{ const k=p.key; if(!filas.has(k)) filas.set(k,{p,items:[]}); filas.get(k).items.push({concepto,dias,importe,detalle}); };
  D.aus.filter(a=>a.estatus==='Aprobada'||a.estatus==='Preautorizada').forEach(a=>{ const d=diasEnRango(a,P.ini,P.fin); if(!d) return;
    const con=a.tipo==='vacaciones'?'Vacaciones':a.tipo==='incapacidad'?'Incapacidad':a.goce==='sin_goce'?'Permiso sin goce':a.goce==='con_goce'?'Permiso con goce':a.goce==='a_cuenta_vacaciones'?'Vacaciones (a cuenta)':a.goce==='pago_horas'?'Permiso (paga con horas)':'Permiso';
    add(persona(a.colaborador_nombre,a.colaborador_email,a.tecnico_id),con,d,0,(a.folio||'')+(a.estatus==='Preautorizada'?' · falta que RH acepte':'')); });
  D.ind.filter(x=>x.fecha&&x.fecha>=P.ini&&x.fecha<=P.fin).forEach(x=>{ const p=persona(x.nombre,'',null);
    if(x.tipo==='falta') add(p,x.tipoFalta&&/goce/.test(x.tipoFalta)?'Permiso ('+x.tipoFalta.replace(/-/g,' ')+')':'Falta',Number(x.dias)||1,0,x.notas||'');
    else if(x.tipo==='retardo') add(p,'Retardo',0,0,(x.minutos?x.minutos+' min':'')+(x.notas?' · '+x.notas:''));
    else if(x.tipo==='descuento') add(p,'Descuento',0,-(Number(x.monto)||0),x.notas||x.motivoDesc||'');
    else if(x.tipo==='incapacidad') add(p,'Incapacidad (captura RH)',Number(x.dias)||0,0,(x.folio||'')+' '+(x.ramo||''));
    else if(x.tipo==='acta') add(p,'Acta administrativa',0,0,x.notas||''); });
  D.com.filter(x=>x.estatus==='por_pagar'&&x.fecha_servicio&&String(x.fecha_servicio).slice(0,10)<=P.fin).forEach(x=>add(persona(x.tecnico_nombre,x.tecnico_correo,x.tecnico_id),'Comisión por pagar',0,Number(x.monto)||0,(x.servicio_nombre||x.estacion||'')+' · '+String(x.fecha_servicio||'').slice(0,10)));
  return {P,filas:[...filas.values()].sort((a,b)=>a.p.nombre.localeCompare(b.p.nombre,'es'))}; }
function incidenciasHTML(){ const {P,filas}=incidencias();
  const color={Vacaciones:'#0e7490',Incapacidad:'#b91c1c','Permiso sin goce':'#b45309',Falta:'#b91c1c',Retardo:'#a16207',Descuento:'#7c3aed','Comisión por pagar':'#15803d'};
  return '<div class="rhd2-bar">'+['semana','quincena','mes'].map(k=>'<button class="rhd2-chip'+(S.periodo===k?' on':'')+'" onclick="window.__rhdSet(\'periodo\',\''+k+'\')">'+({semana:'Semana (sáb–vie)',quincena:'Quincena',mes:'Mes'}[k])+'</button>').join('')+
    '<button class="rhd2-btn" onclick="window.__rhdPer(-1)">‹</button><span style="font-size:13px;font-weight:800;color:#1e3a8a">'+esc(P.txt)+'</span><button class="rhd2-btn" onclick="window.__rhdPer(1)">›</button>'+
    '<span style="margin-left:auto"></span><button class="rhd2-btn pri" onclick="window.__rhdExportInc()">'+IC.exp+' Exportar incidencias (NOMIPAQ)</button></div>'+
    (filas.length?'<table class="rhd2-tbl"><tr><th>Persona</th><th>Incidencias del periodo</th><th style="text-align:right">Días</th><th style="text-align:right">Importe</th></tr>'+filas.map(r=>{ const dias=r.items.reduce((s,i)=>s+(Number(i.dias)||0),0), imp=r.items.reduce((s,i)=>s+(Number(i.importe)||0),0);
      return '<tr><td><b>'+esc(r.p.nombre)+'</b><div style="font-size:11px;color:#64748b">'+esc([r.p.numEmpleado?'N.º '+r.p.numEmpleado:'sin N.º de empleado',r.p.departamento].filter(Boolean).join(' · '))+'</div></td><td>'+
        r.items.map(i=>'<div style="font-size:12px;margin:2px 0"><span class="rhd2-tag" style="color:'+(color[i.concepto]||'#1d4ed8')+';background:#f1f5f9">'+esc(i.concepto)+'</span> '+(i.dias?i.dias+' día(s) ':'')+(i.importe?din(i.importe)+' ':'')+'<span style="color:#94a3b8">'+esc(i.detalle||'')+'</span></div>').join('')+
        '</td><td style="text-align:right;font-weight:800">'+(dias||'—')+'</td><td style="text-align:right;font-weight:800;color:'+(imp<0?'#b91c1c':'#15803d')+'">'+(imp?din(imp):'—')+'</td></tr>'; }).join('')+'</table>'
      :'<div class="rhd2-vacio">Sin incidencias en este periodo.</div>')+
    '<div style="font-size:11.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px;margin-top:10px">Borrador para revisar. El archivo sale con número de empleado, concepto, fechas, días e importe; el layout exacto de importación se ajusta a la versión de NOMIPAQ / CONTPAQi Nóminas que usen. Para que cuadre, cada persona necesita su número de empleado en el expediente.</div>'; }
window.__rhdPer=v=>{ const P=periodo(); const paso=S.periodo==='semana'?7:S.periodo==='quincena'?16:31; if(S.periodo==='mes'){ const d=new Date(S.mes+'-15T12:00:00'); d.setMonth(d.getMonth()+v); S.mes=iso(d).slice(0,7); } else S.perIni=sumar(v<0?P.ini:P.fin, v<0?-1:1); pintar(); void paso; };
window.__rhdExportInc=()=>{ const {P,filas}=incidencias(); const out=[['N.º empleado','Nombre','Departamento','Concepto','Periodo inicio','Periodo fin','Días','Importe','Detalle']];
  filas.forEach(r=>r.items.forEach(i=>out.push([r.p.numEmpleado||'',r.p.nombre,r.p.departamento||'',i.concepto,P.ini,P.fin,i.dias||0,i.importe||0,i.detalle||'']))); csv('incidencias_nomina_'+P.ini,out); };

// ── Altas y bajas ──
function movimientosHTML(){ const m=S.mes;
  const altas=D.personas.filter(p=>p.ingreso).sort((a,b)=>String(b.ingreso).localeCompare(String(a.ingreso))).slice(0,30);
  const bajas=D.personas.filter(p=>p.estatus==='baja').sort((a,b)=>String(b.fechaBaja||'').localeCompare(String(a.fechaBaja||''))).slice(0,40);
  const rotInd=D.ind.filter(x=>x.tipo==='rotacion').sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).slice(0,30);
  const sinIngreso=D.personas.filter(p=>p.estatus==='activo'&&!p.ingreso).length;
  return '<div class="rhd2-grid"><div class="rhd2-card"><div class="rhd2-ct">Altas recientes <button class="rhd2-btn pri" style="height:32px" onclick="window.__rhdIr(\'expedientes\');setTimeout(()=>window.rhNuevoColaborador&&window.rhNuevoColaborador(),300)">+ Alta</button></div>'+
      (altas.length?altas.map(p=>'<div onclick="window.__rhdPersona(\''+esc(p.key)+'\')" style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;cursor:pointer"><b>'+esc(p.nombre)+'</b><span style="color:#64748b">'+fc(p.ingreso)+'</span></div>').join(''):'<div style="font-size:12px;color:#94a3b8">Nadie tiene fecha de ingreso capturada.</div>')+
      (sinIngreso?'<div style="font-size:11.5px;color:#b45309;margin-top:8px">'+sinIngreso+' persona(s) activa(s) sin fecha de ingreso: sin ella no se calculan antigüedad, aniversarios ni rotación exacta.</div>':'')+'</div>'+
    '<div class="rhd2-card"><div class="rhd2-ct">Bajas ('+bajas.length+')</div>'+(bajas.length?bajas.map(p=>'<div onclick="window.__rhdPersona(\''+esc(p.key)+'\')" style="padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px;cursor:pointer"><div style="display:flex;justify-content:space-between"><b>'+esc(p.nombre)+'</b><span style="color:#64748b">'+fc(p.fechaBaja)+'</span></div>'+(p.motivoBaja?'<div style="font-size:11px;color:#94a3b8">'+esc(p.motivoBaja)+'</div>':'')+'</div>').join(''):'<div style="font-size:12px;color:#94a3b8">Sin bajas.</div>')+'</div>'+
    '<div class="rhd2-card"><div class="rhd2-ct">Rotación capturada por RH</div>'+(rotInd.length?rotInd.map(x=>'<div style="padding:7px 0;border-bottom:1px solid #f1f5f9;font-size:12.5px"><div style="display:flex;justify-content:space-between"><b>'+esc(titulo(x.nombre))+'</b><span style="color:#64748b">'+fc(x.fecha)+'</span></div><div style="font-size:11px;color:#94a3b8">'+esc([x.movimiento,x.area,x.notas].filter(Boolean).join(' · '))+'</div></div>').join(''):'<div style="font-size:12px;color:#94a3b8">Sin registros.</div>')+'</div></div>'+
    '<div class="rhd2-card"><div class="rhd2-ct">Cómo dar de baja</div><div style="font-size:12.5px;color:#334155;line-height:1.6">Busca a la persona en <b>Personal</b>, ábrela y usa <b>Dar de baja</b>. Antes de confirmar verás su lista de salida: herramienta por devolver, vehículo asignado, viáticos sin comprobar y comisiones por pagar. Al confirmar, queda de baja en RH y en Operaciones (ya no aparece para asignarle trabajo) y se registra en la rotación del mes.</div></div>'; }
window.__rhdBajaForm=function(key){ const p=D.personas.find(x=>x.key===key); if(!p) return; const a=enAreas(p);
  const item=(ok,t,det)=>'<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #f1f5f9"><span style="width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:800;background:'+(ok?'#16a34a':'#ef4444')+'">'+(ok?'✓':'!')+'</span><div style="font-size:12.5px"><b>'+t+'</b>'+(det?'<div style="color:#64748b;font-size:11.5px">'+det+'</div>':'')+'</div></div>';
  modal('<div style="font-size:19px;font-weight:800;color:#b91c1c">Dar de baja a '+esc(p.nombre)+'</div><div style="font-size:12.5px;color:#64748b;margin:4px 0 12px">Lista de salida: lo que tiene pendiente en cada área. Puedes dar de baja aunque haya pendientes; quedan anotados para darles seguimiento.</div>'+
    item(!a.herr.length,a.herr.length?'Devolver '+a.herr.length+' herramienta(s)':'Sin herramienta a su cargo',a.herr.map(h=>esc(h.folio+' · '+(h.descripcion||''))).join(', '))+
    item(!a.veh.length,a.veh.length?'Entregar vehículo':'Sin vehículo asignado',a.veh.map(v=>'ECO '+esc(v.eco)+' · '+esc(v.unidad||'')).join(', '))+
    item(!a.via.length,a.via.length?'Comprobar '+a.via.length+' viático(s)':'Sin viáticos pendientes',a.via.map(v=>esc(v.folio)+' · '+din(v.monto_entregado)).join(', '))+
    item(!a.com.length,a.com.length?'Liquidar '+a.com.length+' comisión(es)':'Sin comisiones pendientes',a.com.length?'Total '+din(a.com.reduce((s,x)=>s+(Number(x.monto)||0),0)):'')+
    item(!p.accesoPortal,p.accesoPortal?'Tiene acceso al portal':'Sin acceso al portal',p.accesoPortal?'Quítale el acceso en Usuarios y permisos.':'')+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px"><label class="rhd2-lb">Fecha de baja<input id="rhd2-fb" type="date" class="rhd2-fi" value="'+hoy()+'"></label>'+
    '<label class="rhd2-lb">Tipo<select id="rhd2-tb" class="rhd2-fi"><option>Renuncia voluntaria</option><option>Despido</option><option>Término de contrato</option><option>Abandono de trabajo</option><option>Otro</option></select></label></div>'+
    '<label class="rhd2-lb">Motivo o comentario<input id="rhd2-mb" class="rhd2-fi" placeholder="Ej. mejor oferta laboral"></label><div id="rhd2-be" style="font-size:12px;color:#b91c1c;font-weight:700;min-height:16px"></div>'+
    '<div style="display:flex;gap:8px;justify-content:flex-end"><button class="rhd2-btn" onclick="window.__rhdPersona(\''+esc(p.key)+'\')">Cancelar</button><button id="rhd2-bb" class="rhd2-btn roj" onclick="window.__rhdBaja(\''+esc(p.key)+'\')">Confirmar baja</button></div>',true); };
window.__rhdBaja=async function(key){ const p=D.personas.find(x=>x.key===key); if(!p) return; const fecha=document.getElementById('rhd2-fb').value, tipo=document.getElementById('rhd2-tb').value, mot=document.getElementById('rhd2-mb').value.trim(), err=document.getElementById('rhd2-be'), btn=document.getElementById('rhd2-bb');
  if(!fecha){ err.textContent='Pon la fecha de baja.'; return; } btn.disabled=true; btn.textContent='Guardando…'; const motivo=tipo+(mot?' · '+mot:''); const hechos=[];
  try{ const c=await sb();
    if(p.colabId){ try{ const fs=await (window.tcFSPuente?window.tcFSPuente():import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')); await fs.updateDoc(fs.doc(window.db,'colaboradores',p.colabId),{estatus:'baja',fecha_baja:fecha,motivo_baja:motivo,actualizadoEn:new Date().toISOString(),actualizadoPor:yoCorreo()}); hechos.push('expediente de RH'); }catch(e){ console.warn('[RH baja] colaboradores',e); } }
    if(p.tecId&&p.raw.tec){ const r=await c.from('ops_docs').update({datos:Object.assign({},p.raw.tec,{estatus:'baja',fechaBaja:fecha,motivoBaja:motivo})}).eq('coleccion','ops_tecnicos').eq('doc_id',p.tecId); if(!r.error) hechos.push('Operaciones'); }
    const id='rot'+Date.now().toString(36); await c.from('ops_docs').insert({ruta:'rh_indicadores/'+id,coleccion:'rh_indicadores',doc_id:id,datos:{tipo:'rotacion',movimiento:'baja',nombre:p.nombre,area:p.departamento||'',fecha,mesAnio:fecha.slice(0,7),notas:motivo,creadoEn:new Date().toISOString(),creadoPor:yoCorreo()}});
    hechos.push('rotación del mes');
    if(!hechos.length) throw new Error('No se pudo marcar la baja en ninguna fuente.');
    modal(''); toast(p.nombre+' quedó de baja en: '+hechos.join(', ')+'.'); await cargarTodo(true); pintar();
  }catch(e){ err.textContent='No se pudo guardar: '+(e.message||e); btn.disabled=false; btn.textContent='Confirmar baja'; } };

// ── Nómina e IMSS ──
function nominaHTML(){ const act=D.personas.filter(p=>p.estatus==='activo'); const sinNum=act.filter(p=>!p.numEmpleado).length, sinNSS=act.filter(p=>!p.nss).length, sinRFC=act.filter(p=>!p.rfc).length;
  const tarjeta=(t,est,c,bg,txt,btn)=>'<div class="rhd2-card"><div class="rhd2-ct">'+t+' '+pill(est,c,bg)+'</div><div style="font-size:12.5px;color:#475569;line-height:1.55;margin-bottom:10px">'+txt+'</div>'+btn+'</div>';
  return '<div class="rhd2-big">'+[['#e7402b',sinNum,'sin número de empleado'],['#1d4ed8',sinNSS,'sin NSS'],['#3b82f6',sinRFC,'sin RFC'],['#64748b',act.length,'activos para nómina']].map(x=>'<div style="background:'+x[0]+'" onclick="window.__rhdIr(\'personal\')"><div class="ico">'+IC.alerta+'</div><div><div class="n">'+x[1]+'</div><div class="l">'+x[2]+'</div></div></div>').join('')+'</div>'+
    '<div class="rhd2-grid">'+
      tarjeta('NOMIPAQ / CONTPAQi Nóminas','Por archivo','#a16207','#fef9c3','Incidencias del periodo (vacaciones, permisos, incapacidades, faltas, retardos, descuentos y comisiones) por número de empleado, listas para importar.','<button class="rhd2-btn pri" onclick="window.__rhdIr(\'incidencias\')">Ir a incidencias</button>')+
      tarjeta('Plantilla de personal','Lista','#15803d','#dcfce7','Todo el personal con RFC, CURP, NSS, fecha de ingreso, puesto, departamento y lo que tiene a su cargo en otras áreas.','<button class="rhd2-btn" onclick="window.__rhdExportPlantilla()">'+IC.exp+' Exportar plantilla</button>')+
      tarjeta('IMSS · altas y bajas (IDSE)','Por archivo','#a16207','#fef9c3','Movimientos del mes con NSS, CURP, nombre y fecha, para preparar el aviso en IDSE o en el SUA.','<button class="rhd2-btn" onclick="window.__rhdExportIMSS()">'+IC.exp+' Movimientos de '+MES(S.mes)+'</button>')+
      tarjeta('Comisiones por pagar','De Operaciones','#1d4ed8','#dbeafe','Las comisiones de los técnicos se suman a la nómina como percepción. Salen en incidencias con su servicio.','<button class="rhd2-btn" onclick="window.__rhdIr(\'incidencias\')">Ver por persona</button>')+
    '</div><div style="font-size:11.5px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 12px">Los archivos son borradores ordenados. Antes de importarlos, ajusten el layout a la versión exacta de NOMIPAQ / CONTPAQi Nóminas o del SUA y que los revise quien lleva la nómina. Para cuadrar, cada persona necesita número de empleado, RFC, CURP y NSS en su expediente.</div>'; }
window.__rhdExportIMSS=()=>{ const m=S.mes; const out=[['Tipo de movimiento','NSS','CURP','RFC','Nombre','Fecha','Puesto','Departamento','Motivo']];
  D.personas.filter(p=>String(p.ingreso||'').slice(0,7)===m).forEach(p=>out.push(['Alta',p.nss,p.curp,p.rfc,p.nombre,p.ingreso,p.puesto,p.departamento,'']));
  D.personas.filter(p=>String(p.fechaBaja||'').slice(0,7)===m).forEach(p=>out.push(['Baja',p.nss,p.curp,p.rfc,p.nombre,p.fechaBaja,p.puesto,p.departamento,p.motivoBaja]));
  if(out.length===1){ alert('No hay altas ni bajas con fecha en '+MES(m)+'.'); return; } csv('imss_movimientos_'+m,out); };

// ═════════════ Navegación y arranque ═════════════
window.__rhdIr=function(s){ S.secc=s; pintar(); const el=cont(); if(el&&el.scrollIntoView) el.scrollIntoView({behavior:'smooth',block:'start'}); };
window.__rhdRecargar=async function(){ D.cargado=false; pintar(); await cargarTodo(true); pintar(); };
function asegurarContenedor(){ let el=cont(); const r360=document.getElementById('rh360-root'); if(el||!r360) return el;
  el=document.createElement('div'); el.id='rhd2-app'; r360.parentNode.insertBefore(el,r360);
  const casa=document.createElement('div'); casa.id='rhd2-casa'; casa.style.display='none'; el.parentNode.insertBefore(casa,el.nextSibling); return el; }
window.tcRHDepto={
  mostrar: async function(){ const el=asegurarContenedor(); if(!el) return; el.style.display='block'; pintar(); if(!D.cargado) { await cargarTodo(); pintar(); } },
  ocultar: function(){ const el=cont(); if(el) el.style.display='none'; const casa=document.getElementById('rhd2-casa'); ['rh360-root','rh-dashboard'].forEach(id=>{ const n=document.getElementById(id); if(n&&casa&&n.parentNode!==casa){ casa.appendChild(n); n.style.display='none'; } }); },
};
console.log('[RH] Departamento de Recursos Humanos listo');
})();
