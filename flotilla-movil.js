// ══════════════════════════════════════════════════════════════
// flotilla-movil.js — App móvil técnicos Tecnocontrol
// Peso: ~40KB · Sin imágenes base64 · Offline ready
// Vistas: Mi Vehículo · Nueva Solicitud · Mis Tareas · Notificaciones
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';

// ── CATÁLOGO LOCAL (49 vehículos) ──
window.CAT_FL=[
  {eco:'15',unidad:'NISSAN NP300',año:2017,plaza:'JUAREZ',responsable:'JORGE GUERRERO',placas:'DU6478A',serie:'3N6AD33A3HK869708',rend:'7 KM/L',pv:'2026-09-24',pol:'794B05035M-17',tipo:'camioneta',color:'Blanco',nip:'OXXO GAS',km:0,status:'activo'},
  {eco:'16',unidad:'GRUA F-350',año:2010,plaza:'CHIHUAHUA',responsable:'CHIHUAHUA',placas:'DU6497A',serie:'1FDEF3G59AEB23674',rend:'5 KM/L',pv:'2026-09-24',pol:'794B05035M-10',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'17',unidad:'MARCH ACTIVE',año:2017,plaza:'CHIHUAHUA',responsable:'GUILLERMO',placas:'EMB313A',serie:'3N1CK3CD5HL248558',rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-23',tipo:'auto',color:'Blanco',nip:'1713',km:0,status:'activo'},
  {eco:'19',unidad:'RAM 700',año:2017,plaza:'CHIHUAHUA',responsable:'ROBERTO MUÑOZ',placas:'DU6471A',serie:'9BD578458HY162606',rend:'—',pv:'2026-09-24',pol:'794B05035M-20',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'21',unidad:'RAM 700',año:2018,plaza:'JUAREZ',responsable:'BENITO SOTO',placas:'DU6470A',serie:'9BD578452JY210560',rend:'—',pv:'2026-09-24',pol:'794B05035M-12',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'22',unidad:'RAM 700',año:2018,plaza:'CHIHUAHUA',responsable:'CHIHUAHUA',placas:'DU6751A',serie:'9BD578456JY208715',rend:'9 KM/L',pv:'2026-09-24',pol:'794B05035M-13',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'23',unidad:'RAM 700',año:2018,plaza:'CHIHUAHUA',responsable:'SERGIO CARMONA',placas:'DU6752A',serie:'9BD578454JY209023',rend:'—',pv:'2026-09-24',pol:'794B05035M-14',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'26',unidad:'SEAT IBIZA',año:2018,plaza:'CHIHUAHUA',responsable:'MARTIN DE LA O',placas:'EMB314A',serie:'VSBB2KJ1JR017261',rend:'13 KM/L',pv:'2026-09-24',pol:'794B05035M-19',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'31',unidad:'NP300 KANGOO',año:2012,plaza:'CHIHUAHUA',responsable:'DESARROLLOS',placas:'DU6754A',serie:'3N6DD25T5CK018279',rend:'8 KM/L',pv:'2026-09-24',pol:'794B05035M-6',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'35',unidad:'ISUZU',año:2019,plaza:'CHIHUAHUA',responsable:'ALMACEN',placas:'DU6495A',serie:'JAANPR755K7000178',rend:'3.5 KM/L',pv:'2026-09-24',pol:'794B05035M-9',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'36',unidad:'CAMION NISSAN CS',año:2014,plaza:'CHIHUAHUA',responsable:'LUIS LOPEZ',placas:'DU6494A',serie:'3N6DD25T9EK019471',rend:'8 KM/L',pv:'2026-09-24',pol:'794B05035M-18',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'37',unidad:'RAM 700',año:2019,plaza:'JUAREZ',responsable:'JUAREZ',placas:'DU6493A',serie:'9BD578458KY323611',rend:'—',pv:'2026-09-24',pol:'794B05035M-21',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'38',unidad:'RAM 700',año:2019,plaza:'CHIHUAHUA',responsable:'DIONICIO',placas:'DU6492A',serie:'9BD578455KY324652',rend:'—',pv:'2026-09-24',pol:'794B05035M-22',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'39',unidad:'L200',año:2019,plaza:'CHIHUAHUA',responsable:'SERGIO MENDOZA',placas:'DU6491A',serie:'MMBL45G1KH043444',rend:'10 KM/L',pv:'2026-09-24',pol:'794B05035M-30',tipo:'camioneta',color:'Blanco',nip:'1339',km:0,status:'activo'},
  {eco:'40',unidad:'MARCH ACTIVE',año:2019,plaza:'MONTERREY',responsable:'IVAN SEPULVEDA',placas:'DU6490A',serie:'3N6CK34N2KL230477',rend:'10.5 KM/L',pv:'2026-09-24',pol:'794B05035M-2',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'43',unidad:'F-150 PICK-UP',año:2012,plaza:'CHIHUAHUA',responsable:'—',placas:'DU6488A',serie:'1FTMF1CM1CKD41243',rend:'5.6 KM/L',pv:'2026-09-24',pol:'794B05035M-5',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'47',unidad:'MARCH ACTIVE L4',año:2019,plaza:'CHIHUAHUA',responsable:'IDALY RUIZ',placas:'EMB308A',serie:'3N1CK3CD5KL232108',rend:'—',pv:'2026-09-24',pol:'794B05035M-24',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'48',unidad:'MARCH ACTIVE L4',año:2019,plaza:'CHIHUAHUA',responsable:'IVAN ARGENIS',placas:'EMB309A',serie:'3N1CK3CD4KL232066',rend:'—',pv:'2026-09-24',pol:'794B05035M-8',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'50',unidad:'FIESTA',año:2018,plaza:'MONTERREY',responsable:'IRVING SAUCEDO',placas:'EMB310A',serie:'3FADP4BJ1JM128469',rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-11',tipo:'auto',color:'Plata',nip:'',km:0,status:'activo'},
  {eco:'52',unidad:'MARCH',año:2020,plaza:'MONTERREY',responsable:'MONTERREY',placas:'DU6486A',serie:'3N6CK34N3LL243692',rend:'—',pv:'2026-09-24',pol:'794B05035M-26',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'54',unidad:'RAM 700 SLT',año:2020,plaza:'CHIHUAHUA',responsable:'RICARDO GONZALEZ',placas:'DU6485A',serie:'9BD578452LY411572',rend:'17.5 KM/L',pv:'2026-09-24',pol:'794B05035M-33',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'55',unidad:'MARCH',año:2020,plaza:'MONTERREY',responsable:'ROQUE LEAL',placas:'DU6484A',serie:'3N6CK34N3LL248469',rend:'11.7 KM/L',pv:'2026-09-24',pol:'794B05035M-27',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'56',unidad:'RAM 700 SLT',año:2020,plaza:'PARRAL',responsable:'PLAZA PARRAL',placas:'DU6483A',serie:'9BD578451LY423955',rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-34',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'58',unidad:'RAM 700',año:2021,plaza:'CHIHUAHUA',responsable:'ISMAEL BARRAZA',placas:'DU6482A',serie:'9BD281G50MYV59661',rend:'12.7 KM/L',pv:'2026-09-24',pol:'794B05035M-35',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'59',unidad:'RAM 700',año:2021,plaza:'CHIHUAHUA',responsable:'ALAN ESTRADA',placas:'DU6481A',serie:'9BD281G56MYV59423',rend:'13.5 KM/L',pv:'2026-09-24',pol:'794B05035M-36',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'60',unidad:'MARCH',año:2020,plaza:'CAMARGO',responsable:'RAMON HERNANDEZ',placas:'DU6480A',serie:'3N6CK34N9LL254065',rend:'11.6 KM/L',pv:'2026-09-24',pol:'794B05035M-28',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'61',unidad:'MARCH',año:2020,plaza:'PARRAL',responsable:'RICARDO MORIEL',placas:'DU6479A',serie:'3N6CK34N2LL254229',rend:'13.9 KM/L',pv:'2026-09-24',pol:'794B05035M-29',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'62',unidad:'NP300',año:2019,plaza:'MONTERREY',responsable:'JULIO DE LA CRUZ',placas:'DU6472A',serie:'3N6AD33A1KK838707',rend:'7.5 KM/L',pv:'2026-09-24',pol:'794B05035M-31',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'63',unidad:'SILVERADO 1500',año:2013,plaza:'CHIHUAHUA',responsable:'BODEGA',placas:'DU6473A',serie:'3GCNC9CX6DG343777',rend:'5.5 KM/L',pv:'2026-09-24',pol:'794B05035M-25',tipo:'camioneta',color:'Plata',nip:'',km:0,status:'activo'},
  {eco:'64',unidad:'MARCH ACTIVE',año:2017,plaza:'CHIHUAHUA',responsable:'VERONICA GARCIA',placas:'DU6474A',serie:'3N6CK34N4HL242297',rend:'10.6 KM/L',pv:'2026-09-24',pol:'794B05035M-32',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'66',unidad:'AVEO',año:2018,plaza:'CHIHUAHUA',responsable:'CARMEN HERNANDEZ',placas:'EMB311A',serie:'LSGHD52H6JD239610',rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-37',tipo:'auto',color:'Gris',nip:'',km:0,status:'activo'},
  {eco:'69',unidad:'NISSAN NP300',año:2017,plaza:'CHIHUAHUA',responsable:'LUIS LOPEZ',placas:'DU6499A',serie:'3N6AD33A6HK837318',rend:'—',pv:'2026-09-24',pol:'794B05035M-38',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'71',unidad:'YUKON',año:2023,plaza:'CHIHUAHUA',responsable:'PALOMA PINEDO',placas:'DYY416B',serie:'1GKS28KL1PR236241',rend:'—',pv:'—',pol:'—',tipo:'camioneta',color:'Negro',nip:'',km:0,status:'activo'},
  {eco:'72',unidad:'RAM RAPID',año:2023,plaza:'CHIHUAHUA',responsable:'JORGE URIBE',placas:'DG7445B',serie:'9BD2657RIP9233026',rend:'14 KM/L',pv:'—',pol:'—',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'73',unidad:'DODGE ATTITUDE',año:2023,plaza:'CHIHUAHUA',responsable:'DENISSE GUTIERREZ',placas:'MKL325A',serie:'ML3ABT6J4PH004521',rend:'—',pv:'—',pol:'—',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'74',unidad:'DODGE ATTITUDE',año:2023,plaza:'CHIHUAHUA',responsable:'FATIMA SAUZAMEDA',placas:'MKL317A',serie:'ML3ABT6J4PH004552',rend:'15.8 KM/L',pv:'—',pol:'—',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'75',unidad:'AVEO',año:2019,plaza:'CHIHUAHUA',responsable:'PALOMA PINEDO',placas:'DUJ454B',serie:'LSGHD52H8KD130423',rend:'—',pv:'2027-02-14',pol:'29113016152002',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'76',unidad:'NISSAN VERSA',año:2024,plaza:'MONTERREY',responsable:'LUIS GARZA',placas:'ESU908B',serie:'3N1CN7AE7RK398169',rend:'16 KM/L',pv:'—',pol:'—',tipo:'auto',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'77',unidad:'BMW X6',año:2025,plaza:'CHIHUAHUA',responsable:'MARTIN DE LA O',placas:'EKM897B',serie:'WBA41EX06S9W75509',rend:'—',pv:'—',pol:'—',tipo:'auto',color:'Negro',nip:'',km:0,status:'activo'},
  {eco:'79',unidad:'CHANGAN HUNTER',año:2025,plaza:'CHIHUAHUA',responsable:'SERGIO MENDOZA',placas:'337217',serie:'LSCBBZ2A1SG803364',rend:'—',pv:'2029-02-27',pol:'4056350008',tipo:'camioneta',color:'Blanco',nip:'7925',km:0,status:'activo'},
  {eco:'80',unidad:'CHANGAN HUNTER',año:2025,plaza:'CHIHUAHUA',responsable:'ULISES NUÑEZ',placas:'337218',serie:'LSCBBZ2A3SG803365',rend:'—',pv:'2029-02-27',pol:'4056347985',tipo:'camioneta',color:'Blanco',nip:'8025',km:0,status:'activo'},
  {eco:'81',unidad:'CHANGAN HUNTER',año:2025,plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',placas:'337219',serie:'LSCBB72A8SG803376',rend:'—',pv:'2029-02-27',pol:'4056350016',tipo:'camioneta',color:'Blanco',nip:'8125',km:0,status:'activo'},
  {eco:'82',unidad:'VAN DONGFENG',año:2026,plaza:'CHIHUAHUA',responsable:'TOMAS',placas:'DZ9769B',serie:'LGFP541E6TA603994',rend:'—',pv:'2029-03-17',pol:'4056530506',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'83',unidad:'CHASIS DONGFENG',año:2025,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9767B',serie:'LGDND41EXSA202059',rend:'—',pv:'2029-03-17',pol:'4056530481',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'84',unidad:'CHASIS DONGFENG',año:2025,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9766B',serie:'LGDND41E6SA202057',rend:'—',pv:'2029-03-17',pol:'4056530495',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'85',unidad:'PICKUP DONGFENG',año:2025,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9768B',serie:'LGDCMA1L5SA204421',rend:'—',pv:'2029-03-20',pol:'3200970801',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'90',unidad:'CHANGAN STAR',año:2026,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9853B',serie:'LSCAB12E7TG800860',rend:'—',pv:'2026-11-01',pol:'1950290311',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'91',unidad:'CHANGAN STAR DC',año:2026,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9855B',serie:'LSCAB22E6TG800256',rend:'—',pv:'2026-11-01',pol:'1950290357',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'92',unidad:'CHANGAN STAR DC',año:2026,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9854B',serie:'LSCAB22E5TG800295',rend:'—',pv:'2026-11-01',pol:'1950290361',tipo:'camion',color:'Blanco',nip:'',km:0,status:'activo'},
];


const C={
  VEHS:'flotilla_vehiculos',
  SOLS:'flotilla_solicitudes',
  TAREAS:'actividades',
  USUARIOS:'fl_usuarios',
  OFFLINE_KEY:'tcn_offline_queue',
};

const TIPOS_SOL=[
  'Mantenimiento preventivo','Mantenimiento correctivo',
  'Reposición de llanta','Falla eléctrica',
  'Siniestro / Accidente','Revisión de documentos','Otro',
];

const CHK_CATS={
  Cristales:  ['Medallón delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],
  Espejos:    ['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],
  Neumáticos: ['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],
  Interiores: ['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],
  Motor:      ['Batería','Tapón agua','Tapón radiador','Tapón dirección'],
  Cajuela:    ['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],
  Legal:      ['Sin multas vigentes','Verificación vigente','Tenencia al corriente','Tarjeta circulación'],
};

// ── ESTADO ──
let miVeh=null, misSols=[], misTareas=[], misNotif=[];
let vistaAct='vehiculo';
let solState={modo:'entrada',tipo:'',prior:'Normal',desc:'',km:'',taller:'',gasolina:50,chk:{},chkFotos:{},evFotos:[],dmg:{}};
let miPerfil=null; // {email, nombre, ecoVinculado}
let onlineStatus=navigator.onLine;

// ── HELPERS ──
const hF=iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';
const hD=f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);

function badge(e){
  const m={Solicitud:'#6D28D9',Validada:'#1D4ED8',Cotización:'#B45309',Aprobada:'#15803D',Rechazada:'#B91C1C',Cierre:'#7C3AED',Cerrada:'#475569','En proceso':'#0369A1',Pendiente:'#B45309',Completada:'#15803D'};
  const bg={Solicitud:'#EDE9FE',Validada:'#DBEAFE',Cotización:'#FEF3C7',Aprobada:'#DCFCE7',Rechazada:'#FEE2E2',Cierre:'#F3E8FF',Cerrada:'#F1F5F9','En proceso':'#E0F2FE',Pendiente:'#FEF3C7',Completada:'#DCFCE7'};
  return`<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px;background:${bg[e]||'#F1F5F9'};color:${m[e]||'#475569'}">${e||'—'}</span>`;
}

// ── GENERAR CÓDIGO EVIDENCIA ──
function genCod(){
  const d=new Date();
  const dd=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r='';for(let i=0;i<4;i++)r+=chars[Math.floor(Math.random()*chars.length)];
  return`TCN-EV-${dd}-${r}`;
}

// ── GPS ──
function getGPS(){
  return new Promise(res=>{
    if(!navigator.geolocation){res(null);return;}
    // Timeout de 5s — si no responde continúa sin GPS
    const timer=setTimeout(()=>res(null),5000);
    navigator.geolocation.getCurrentPosition(
      p=>{clearTimeout(timer);res({lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6),acc:Math.round(p.coords.accuracy)});},
      ()=>{clearTimeout(timer);res(null);},
      {timeout:5000,maximumAge:30000,enableHighAccuracy:false}
    );
  });
}

// ── SELLAR IMAGEN ──
function sellarImg(src,meta){
  return new Promise(res=>{
    const img=new Image();
    img.onload=function(){
      const c=document.createElement('canvas');
      c.width=Math.min(img.width,1024);
      c.height=Math.round(img.height*(c.width/img.width));
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0,c.width,c.height);
      const sh=Math.round(c.height*0.20);
      ctx.fillStyle='rgba(0,0,0,0.75)';
      ctx.fillRect(0,c.height-sh,c.width,sh);
      const mc=meta.modo==='salida'?'#22C55E':'#3B82F6';
      ctx.fillStyle=mc;ctx.fillRect(0,c.height-sh,c.width,4);
      const fs=Math.max(12,Math.round(c.width*0.035));
      ctx.fillStyle='#FCD34D';ctx.font=`bold ${fs}px monospace`;
      ctx.fillText(meta.codigo,10,c.height-sh+fs+4);
      ctx.fillStyle='#fff';ctx.font=`${fs}px monospace`;
      ctx.fillText(`${meta.fecha} · ${meta.hora}`,10,c.height-sh+fs*2+8);
      ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`${Math.round(fs*.85)}px monospace`;
      ctx.fillText(meta.gps?`${meta.gps.lat}, ${meta.gps.lng}`:'Sin GPS',10,c.height-sh+fs*3+10);
      ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.6)';
      ctx.fillText(meta.eco?`ECO ${meta.eco}`:'',c.width-8,c.height-sh+fs+4);
      ctx.fillText(meta.modo.toUpperCase(),c.width-8,c.height-sh+fs*2+8);
      ctx.textAlign='left';
      res(c.toDataURL('image/jpeg',0.75));
    };
    img.src=src;
  });
}

// ── DEBUG PANEL (visible en pantalla) ──
function dbg(msg, tipo='info'){
  const col={info:'#1E3A5F',ok:'#15803D',err:'#B91C1C',warn:'#B45309'}[tipo]||'#1E3A5F';
  let panel=document.getElementById('fl-dbg');
  if(!panel){
    panel=document.createElement('div');
    panel.id='fl-dbg';
    panel.style.cssText='position:fixed;top:80px;left:10px;right:10px;background:rgba(0,0,0,.85);border-radius:10px;padding:10px;z-index:9998;max-height:40vh;overflow-y:auto;font-family:monospace;font-size:11px;';
    const closeBtn=document.createElement('button');
    closeBtn.textContent='✕ Cerrar debug';
    closeBtn.style.cssText='display:block;width:100%;padding:5px;background:#333;color:#fff;border:none;border-radius:5px;cursor:pointer;margin-bottom:6px;font-family:monospace;font-size:11px;';
    closeBtn.onclick=()=>panel.remove();
    panel.appendChild(closeBtn);
    document.body.appendChild(panel);
  }
  const line=document.createElement('div');
  const ts=new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  line.style.cssText=`color:${col};padding:2px 0;border-bottom:1px solid rgba(255,255,255,.1);`;
  line.textContent=`[${ts}] ${msg}`;
  panel.appendChild(line);
  panel.scrollTop=panel.scrollHeight;
  console.log('[FL-MOVIL]',msg);
}

// ── TOAST ──
function toast(txt,tipo='info'){
  const col={info:'#1E3A5F',ok:'#15803D',err:'#B91C1C'}[tipo]||'#1E3A5F';
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:${col};color:#fff;padding:10px 20px;border-radius:100px;font-size:13px;font-weight:700;z-index:9999;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:85vw;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`;
  t.textContent=txt;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300)},2500);
}

// ── OFFLINE QUEUE ──
function offlineGuardar(doc){
  const q=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  q.push({...doc,_offlineId:Date.now(),_pendiente:true});
  localStorage.setItem(C.OFFLINE_KEY,JSON.stringify(q));
  toast('Sin conexión — guardado localmente',  'info');
}
async function offlineSync(){
  const q=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  if(!q.length)return;
  let synced=0;
  for(const doc of q){
    try{
      const {_offlineId,_pendiente,...clean}=doc;
      await db.collection(C.SOLS).add({...clean,creadoEn:clean.creadoEn||new Date().toISOString(),sincronizadoOffline:true});
      synced++;
    }catch(e){console.warn('[MOVIL offline]',e);}
  }
  if(synced>0){
    localStorage.setItem(C.OFFLINE_KEY,'[]');
    toast(`${synced} solicitud(es) sincronizada(s)`, 'ok');
    await cargarMisSols();
    if(vistaAct==='vehiculo')renderVehiculo();
  }
}

// ── CSS MÓVIL ──
function injectCSS(){
  if(document.getElementById('fl-m-css'))return;
  const s=document.createElement('style');s.id='fl-m-css';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');
body{margin:0;padding:0;background:#F0F2F7;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#0A0F1E;overscroll-behavior:none;}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}

/* STATUS BAR AREA */
#fl-m-root{display:flex;flex-direction:column;height:100dvh;max-width:430px;margin:0 auto;background:#F0F2F7;position:relative;}

/* HEADER */
.fm-header{background:#0A1628;padding:env(safe-area-inset-top,0) 16px 0;position:sticky;top:0;z-index:100;}
.fm-header-inner{display:flex;align-items:center;justify-content:space-between;padding:12px 0 10px;}
.fm-header-brand{display:flex;align-items:center;gap:8px;}
.fm-header-brand-txt{font-size:14px;font-weight:900;color:#fff;letter-spacing:-.3px;}
.fm-header-brand-txt em{color:#3B82F6;font-style:normal;}
.fm-status{display:flex;align-items:center;gap:6px;}
.fm-online-dot{width:7px;height:7px;border-radius:50%;background:#22C55E;box-shadow:0 0 0 2px rgba(34,197,94,.25);}
.fm-online-dot.off{background:#EF4444;box-shadow:0 0 0 2px rgba(239,68,68,.25);}
.fm-user-btn{width:32px;height:32px;border-radius:50%;background:#2563EB;border:none;color:#fff;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;}

/* CONTENT */
.fm-content{flex:1;overflow-y:auto;padding:16px 14px 0;-webkit-overflow-scrolling:touch;}

/* BOTTOM NAV */
.fm-nav{background:#0A1628;padding:0 0 env(safe-area-inset-bottom,0);border-top:1px solid rgba(255,255,255,.08);}
.fm-nav-inner{display:grid;grid-template-columns:repeat(5,1fr);height:56px;}
.fm-nav-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:transparent;color:rgba(255,255,255,.45);cursor:pointer;font-family:inherit;padding:6px 4px;position:relative;transition:color .15s;}
.fm-nav-btn.on{color:#3B82F6;}
.fm-nav-btn svg{width:22px;height:22px;display:block;}
.fm-nav-lbl{font-size:9px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;}
.fm-nav-badge{position:absolute;top:6px;right:calc(50% - 14px);background:#EF4444;color:#fff;font-size:8px;font-weight:800;min-width:16px;height:16px;border-radius:100px;display:flex;align-items:center;justify-content:center;padding:0 4px;}

/* CARDS */
.fm-card{background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid #E8EDF5;}
.fm-card-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.fm-card-t{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;}
.fm-veh-eco{font-size:42px;font-weight:900;font-family:'JetBrains Mono',monospace;color:#fff;line-height:1;opacity:.9;}
.fm-veh-name{font-size:18px;font-weight:800;color:#0A1628;margin-top:2px;letter-spacing:-.3px;}
.fm-veh-sub{font-size:12px;color:#64748B;margin-top:3px;}
.fm-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;}
.fm-data-item{background:#F8FAFD;border-radius:10px;padding:10px 12px;}
.fm-data-item dt{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px;}
.fm-data-item dd{font-size:13px;font-weight:700;color:#0A0F1E;}
.fm-data-item dd.mono{font-family:'JetBrains Mono',monospace;font-size:11.5px;}
.fm-data-item dd.green{color:#15803D;}
.fm-data-item dd.red{color:#B91C1C;}
.fm-data-item dd.amber{color:#B45309;}

/* BOTONES */
.fm-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:14px;border-radius:12px;border:none;font-family:inherit;font-size:14px;font-weight:800;cursor:pointer;transition:all .15s;letter-spacing:.2px;}
.fm-btn.primary{background:#1E3A5F;color:#fff;}
.fm-btn.primary:active{background:#142a47;transform:scale(.98);}
.fm-btn.green{background:#15803D;color:#fff;}
.fm-btn.green:active{background:#14532d;}
.fm-btn.ghost{background:#F1F5F9;color:#374151;}
.fm-btn.ghost:active{background:#E2E8F0;}
.fm-btn.danger{background:#FEF2F2;color:#B91C1C;}
.fm-btn-sm{padding:8px 16px;border-radius:8px;font-size:12px;width:auto;}

/* FORM */
.fm-fld{margin-bottom:12px;}
.fm-fld label{display:block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#1E3A5F;margin-bottom:6px;}
.fm-fld input,.fm-fld select,.fm-fld textarea{width:100%;padding:12px 14px;border:2px solid #CBD5E1;border-radius:10px;font-family:inherit;font-size:14px;color:#0A0F1E;background:#fff;outline:none;-webkit-appearance:none;appearance:none;font-weight:500;}
.fm-fld input:focus,.fm-fld select:focus,.fm-fld textarea:focus{border-color:#2563EB;background:#fff;}
.fm-fld textarea{min-height:80px;resize:none;}
.fm-select-wrap{position:relative;}
.fm-select-wrap::after{content:'▼';position:absolute;right:14px;top:50%;transform:translateY(-50%);font-size:10px;color:#94A3B8;pointer-events:none;}

/* MODO TOGGLE */
.fm-modo{display:flex;border:2px solid #E2E8F0;border-radius:10px;overflow:hidden;margin-bottom:14px;}
.fm-modo-btn{flex:1;padding:11px;border:none;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:all .15s;}
.fm-modo-btn.entrada{background:#EFF6FF;color:#1D4ED8;}
.fm-modo-btn.entrada.on{background:#2563EB;color:#fff;}
.fm-modo-btn.salida{background:#F0FDF4;color:#15803D;}
.fm-modo-btn.salida.on{background:#15803D;color:#fff;}

/* CHECKLIST */
.fm-chk-cat{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.6px;color:#1E3A5F;padding:12px 0 6px;border-bottom:2px solid #E2E8F0;margin-bottom:4px;}
.fm-chk-row{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #F8FAFD;}
.fm-chk-name{flex:1;font-size:13.5px;color:#0A0F1E;font-weight:500;}
.fm-chk-si,.fm-chk-no{padding:6px 14px;border-radius:7px;border:2px solid #CBD5E1;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;background:#fff;color:#374151;transition:all .12s;}
.fm-chk-si:hover{border-color:#22C55E;color:#15803D;}
.fm-chk-no:hover{border-color:#EF4444;color:#B91C1C;}
.fm-chk-si.on{background:#15803D;border-color:#15803D;color:#fff;}
.fm-chk-no.on{background:#B91C1C;border-color:#B91C1C;color:#fff;}
.fm-chk-cam{width:34px;height:34px;border-radius:8px;border:1.5px solid #E2E8F0;background:#F8FAFD;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all .12s;}
.fm-chk-cam.has{border-color:#22C55E;background:#DCFCE7;}
.fm-chk-cam.has img{width:26px;height:26px;object-fit:cover;border-radius:5px;}

/* SOL CARDS */
.fm-sol-card{background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid #E8EDF5;cursor:pointer;transition:all .15s;}
.fm-sol-card:active{background:#F8FAFD;}
.fm-sol-tipo{font-size:14px;font-weight:700;color:#0A0F1E;margin-bottom:4px;}
.fm-sol-meta{font-size:11.5px;color:#64748B;}

/* TAREA CARDS */
.fm-tarea-card{background:#fff;border-radius:14px;padding:14px;margin-bottom:10px;border:1px solid #E8EDF5;}
.fm-tarea-title{font-size:14px;font-weight:700;color:#0A0F1E;margin-bottom:4px;}
.fm-tarea-meta{font-size:11.5px;color:#64748B;margin-bottom:8px;}
.fm-tarea-prior{font-size:10px;font-weight:800;padding:2px 8px;border-radius:100px;}

/* GAUGE */
.fm-gauge-wrap{display:flex;flex-direction:column;align-items:center;padding:10px 0 6px;}
.fm-gauge-labels{display:flex;justify-content:space-between;width:200px;font-size:10px;font-weight:700;color:#64748B;margin-top:4px;}

/* NOTIF */
.fm-notif{display:flex;gap:10px;padding:12px;background:#fff;border-radius:12px;margin-bottom:8px;border:1px solid #E8EDF5;}
.fm-notif-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;}
.fm-notif-body{flex:1;min-width:0;}
.fm-notif-t{font-size:13px;font-weight:700;color:#0A0F1E;}
.fm-notif-s{font-size:11.5px;color:#64748B;margin-top:2px;line-height:1.4;}
.fm-notif-time{font-size:10px;color:#94A3B8;margin-top:3px;}
.fm-notif.unread{border-left:3px solid #2563EB;background:#FAFBFF;}

/* VINCULACIÓN */
.fm-vincular{background:#fff;border-radius:16px;padding:24px 20px;text-align:center;}
.fm-vincular-ico{font-size:48px;margin-bottom:12px;}
.fm-vincular h2{font-size:18px;font-weight:800;margin-bottom:6px;}
.fm-vincular p{font-size:13px;color:#64748B;line-height:1.5;margin-bottom:16px;}

/* OFFLINE BANNER */
.fm-offline-bar{background:#B45309;color:#fff;text-align:center;padding:6px 14px;font-size:11.5px;font-weight:700;display:none;}
.fm-offline-bar.show{display:block;}

/* EMPTY */
.fm-empty{text-align:center;padding:32px 20px;color:#64748B;}
.fm-empty-ico{font-size:40px;opacity:.35;margin-bottom:10px;display:flex;align-items:center;justify-content:center;}
.fm-empty-ico svg{width:48px;height:48px;}
.fm-empty h3{font-size:14px;font-weight:700;color:#0A0F1E;margin-bottom:4px;}
.fm-empty p{font-size:12.5px;line-height:1.5;}

/* SECCIÓN HEADER */
.fm-sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.fm-sec-t{font-size:18px;font-weight:900;letter-spacing:-.4px;}
.fm-sec-s{font-size:11.5px;color:#64748B;margin-top:2px;}

/* PILL EVIDENCIA */
.fm-ev-pill{display:inline-flex;align-items:center;gap:6px;background:#F1F5F9;border-radius:8px;padding:5px 8px;margin:3px;cursor:pointer;border:1px solid #E2E8F0;}
.fm-ev-pill img{width:24px;height:24px;object-fit:cover;border-radius:4px;}
.fm-ev-pill span{font-size:10px;font-weight:600;font-family:'JetBrains Mono',monospace;color:#374151;}
.fm-ev-pill-lg{display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;background:#fff;border:1.5px solid #E2E8F0;border-radius:10px;padding:6px;transition:border-color .12s;}
.fm-ev-pill-lg:active{border-color:#2563EB;}
.fm-ev-pill-lg img{width:60px;height:60px;object-fit:cover;border-radius:7px;display:block;}

/* MODAL */
.fm-ov{position:fixed;inset:0;background:rgba(10,15,30,.75);z-index:3000;display:flex;align-items:flex-end;justify-content:center;padding:0;backdrop-filter:blur(6px);}
.fm-sheet{background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:430px;max-height:92vh;overflow-y:auto;padding:0 0 env(safe-area-inset-bottom,0);}
.fm-sheet-hd{padding:16px 18px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9;position:sticky;top:0;background:#fff;z-index:2;}
.fm-sheet-hd h3{font-size:16px;font-weight:800;}
.fm-sheet-x{width:28px;height:28px;border:none;background:#F1F5F9;border-radius:8px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;}
.fm-sheet-body{padding:14px 18px 20px;}
`;
  document.head.appendChild(s);
}

// ── SVG ÍCONOS ──
const IC={
  car:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  tasks:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`,
  bell:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  camera:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  check:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  wrench:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  wifi:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01"/></svg>`,
  user:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  shield:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  link:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
  swap:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>`,
  sign:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
  doc:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  car:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
};

// ── HTML BASE ──
function buildHTML(){
  const el=document.getElementById('fl-movil-root')||document.body;
  const div=document.createElement('div');div.id='fl-m-root';
  div.innerHTML=`
    <!-- OFFLINE BANNER -->
    <div class="fm-offline-bar" id="fm-offline-bar">
      ${IC.wifi} Sin conexión — trabajando offline
    </div>
    <!-- HEADER -->
    <div class="fm-header">
      <div class="fm-header-inner">
        <div class="fm-header-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#fff" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="6" stroke="#3B82F6" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="2.5" fill="#3B82F6"/>
          </svg>
          <span class="fm-header-brand-txt">TECNO<em>CONTROL</em></span>
        </div>
        <div class="fm-status">
          <div class="fm-online-dot" id="fm-dot"></div>
          <button class="fm-user-btn" id="fm-user-btn" onclick="abrirPerfil()">?</button>
        </div>
      </div>
    </div>
    <!-- CONTENIDO -->
    <div class="fm-content" id="fm-content">
      <div class="fm-empty"><div class="fm-empty-ico" style="color:var(--color-text-secondary,#94A3B8)">${IC.car}</div><h3>Cargando…</h3></div>
    </div>
    <!-- NAV BOTTOM -->
    <div class="fm-nav">
      <div class="fm-nav-inner">
        <button class="fm-nav-btn on" id="fm-nb-vehiculo" onclick="fmVista('vehiculo')">
          ${IC.car}<span class="fm-nav-lbl">Vehículo</span>
        </button>
        <button class="fm-nav-btn" id="fm-nb-solicitud" onclick="fmVista('solicitud')">
          ${IC.plus}<span class="fm-nav-lbl">Solicitud</span>
        </button>
        <button class="fm-nav-btn" id="fm-nb-tareas" onclick="fmVista('tareas')">
          ${IC.tasks}<span class="fm-nav-lbl">Tareas</span>
          <span class="fm-nav-badge" id="fm-badge-tareas" style="display:none">0</span>
        </button>
        <button class="fm-nav-btn" id="fm-nb-util" onclick="fmVista('util')">
          ${IC.swap}<span class="fm-nav-lbl">Utilitario</span>
        </button>
        <button class="fm-nav-btn" id="fm-nb-notif" onclick="fmVista('notif')">
          ${IC.bell}<span class="fm-nav-lbl">Avisos</span>
          <span class="fm-nav-badge" id="fm-badge-notif" style="display:none">0</span>
        </button>
      </div>
    </div>`;
  if(el===document.body){document.body.innerHTML='';document.body.appendChild(div);}
  else el.appendChild(div);
}

function setContent(h){const c=document.getElementById('fm-content');if(c)c.innerHTML=h;}

// ── INIT ──
window.initFlotillaMovil=async function(){
  injectCSS();buildHTML();
  // Detectar online/offline
  window.addEventListener('online',()=>{
    onlineStatus=true;
    document.getElementById('fm-dot')?.classList.remove('off');
    document.getElementById('fm-offline-bar')?.classList.remove('show');
    offlineSync();
  });
  window.addEventListener('offline',()=>{
    onlineStatus=false;
    document.getElementById('fm-dot')?.classList.add('off');
    document.getElementById('fm-offline-bar')?.classList.add('show');
  });
  if(!onlineStatus){
    document.getElementById('fm-dot')?.classList.add('off');
    document.getElementById('fm-offline-bar')?.classList.add('show');
  }

  // Cargar perfil del usuario
  const user=window.auth?.currentUser;
  if(user){
    const inicial=(user.displayName||user.email||'?').charAt(0).toUpperCase();
    const btn=document.getElementById('fm-user-btn');
    if(btn)btn.textContent=inicial;
    await cargarPerfil(user);
  }

  dbg('Iniciando app móvil…','info');
  dbg('Usuario: '+(window.auth?.currentUser?.email||'sin sesión'),'info');
  dbg('Online: '+navigator.onLine,'info');
  await Promise.all([cargarMiVeh(),cargarMisSols(),cargarMisTareas()]);
  dbg('Datos cargados. Vehículo: '+(miVeh?'ECO '+miVeh.eco:'ninguno'),'ok');
  actualizarBadges();
  fmVista('vehiculo');

  // Sincronizar offline queue si hay conexión
  if(onlineStatus)await offlineSync();

  // Registrar Service Worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
};

// ── CARGAR DATOS ──
async function cargarPerfil(user){
  try{
    // Usar SDK compat directamente
    const snap=await db.collection(C.USUARIOS).where('email','==',user.email).get();
    if(!snap.empty){
      miPerfil={...snap.docs[0].data(),uid:snap.docs[0].id};
    } else {
      miPerfil={email:user.email,nombre:user.displayName||user.email,ecoVinculado:null};
    }
  }catch(e){
    console.error('[MOVIL perfil]',e);
    miPerfil={email:user?.email||'',nombre:user?.displayName||user?.email||'',ecoVinculado:null};
  }
}

async function cargarMiVeh(){
  if(!miPerfil?.ecoVinculado){miVeh=null;return;}
  try{
    const snap=await db.collection(C.VEHS).where('eco','==',String(miPerfil.ecoVinculado)).get();
    if(!snap.empty){
      miVeh={id:snap.docs[0].id,...snap.docs[0].data()};
    } else {
      // Buscar en catálogo local
      miVeh=window.CAT_FL?.find(v=>String(v.eco)===String(miPerfil.ecoVinculado))||null;
      if(miVeh)miVeh={id:'eco-'+miVeh.eco,...miVeh};
    }
  }catch(e){
    // Fallback catálogo local
    const found=window.CAT_FL?.find(v=>String(v.eco)===String(miPerfil.ecoVinculado));
    miVeh=found?{id:'eco-'+found.eco,...found}:null;
  }
}

async function cargarMisSols(){
  if(!miVeh&&!miPerfil?.email){misSols=[];return;}
  try{
    let q=miVeh
      ? db.collection(C.SOLS).where('vehiculoEco','==',miVeh.eco).orderBy('creadoEn','desc').limit(20)
      : db.collection(C.SOLS).where('creadoPor','==',miPerfil?.email||'').orderBy('creadoEn','desc').limit(20);
    const snap=await q.get();
    misSols=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch{
    try{
      const snap=await db.collection(C.SOLS).where('creadoPor','==',miPerfil?.email||'').get();
      misSols=snap.docs.map(d=>({id:d.id,...d.data()}));
      misSols.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
    }catch{misSols=[];}
  }
}

async function cargarMisTareas(){
  if(!miPerfil?.email){misTareas=[];return;}
  try{
    const snap=await db.collection(C.TAREAS)
      .where('asignadoA','==',miPerfil.email)
      .get();
    misTareas=snap.docs.map(d=>({id:d.id,...d.data()}))
      .filter(t=>t.estatus!=='Completada');
    misNotif=misSols.filter(s=>['Aprobada','Rechazada','Cotización'].includes(s.estatus)).slice(0,10);
  }catch(e){console.error('[MOVIL tareas]',e);misTareas=[];}
}

function actualizarBadges(){
  const bt=document.getElementById('fm-badge-tareas');
  const bn=document.getElementById('fm-badge-notif');
  const pend=misTareas.filter(t=>t.estatus==='Pendiente'||t.estatus==='En proceso').length;
  const notif=misNotif.length;
  if(bt){bt.textContent=pend;bt.style.display=pend?'flex':'none';}
  if(bn){bn.textContent=notif;bn.style.display=notif?'flex':'none';}
}

// ── NAVEGACIÓN ──
window.fmVista=function(v){
  vistaAct=v;
  document.querySelectorAll('.fm-nav-btn').forEach(b=>b.classList.remove('on'));
  document.getElementById('fm-nb-'+v)?.classList.add('on');
  if(v==='vehiculo')renderVehiculo();
  else if(v==='solicitud')renderNuevaSol();
  else if(v==='tareas')renderTareas();
  else if(v==='notif')renderNotif();
  else if(v==='util')renderUtil();
};

// ══════════════════════════════════════════
// VISTA 1 — MI VEHÍCULO
// ══════════════════════════════════════════
function renderVehiculo(){
  if(!miPerfil?.ecoVinculado||!miVeh){
    renderVincular();return;
  }
  const v=miVeh;
  const d=hD(v.pv);
  const pvOk=d===null||d>=90;
  const offline=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  const solsPend=misSols.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus));
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Mi vehículo</div>
        <div class="fm-sec-s">ECO ${v.eco} · ${new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'})}</div>
      </div>
      <button onclick="fmVista('solicitud')" class="fm-btn primary fm-btn-sm" style="gap:5px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Solicitud
      </button>
    </div>

    ${offline.length?`<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#B45309">
      ${IC.wifi} ${offline.length} solicitud(es) pendiente(s) de sincronizar
    </div>`:''}

    <!-- CARD VEHÍCULO -->
    <div class="fm-card" style="background:linear-gradient(135deg,#0A1628,#1E3A5F);color:#fff;border:none">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div class="fm-veh-eco">${v.eco}</div>
          <div class="fm-veh-name">${v.unidad||'—'}</div>
          <div class="fm-veh-sub" style="color:rgba(255,255,255,.55)">${v.placas||'—'} · ${v.año||'—'}</div>
        </div>
        <div style="background:rgba(255,255,255,.1);border-radius:10px;padding:8px 12px;text-align:center">
          <div style="font-size:24px">🛻</div>
          <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.5);margin-top:2px;text-transform:uppercase">${v.tipo||'—'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px">
        ${[['Plaza',v.plaza||'—'],['Color',v.color||'—'],['KM',`${v.km||0}`]].map(([l,val])=>`
        <div style="background:rgba(255,255,255,.08);border-radius:8px;padding:8px 10px">
          <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.4);margin-bottom:2px">${l}</div>
          <div style="font-size:12.5px;font-weight:700;color:#fff">${val}</div>
        </div>`).join('')}
      </div>
    </div>

    <!-- ALERTAS -->
    ${!pvOk?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
      <div style="color:#B91C1C;flex-shrink:0">${IC.alert}</div>
      <div><div style="font-size:13px;font-weight:700;color:#B91C1C">Póliza de seguro ${d<0?'VENCIDA':'próxima a vencer'}</div>
      <div style="font-size:11.5px;color:#991B1B;margin-top:2px">${hF(v.pv)}${d!==null?` · ${d<0?Math.abs(d)+' días vencida':d+' días restantes'}`:''}</div></div>
    </div>`:''  }

    <!-- DATOS TÉCNICOS -->
    <div class="fm-card">
      <div class="fm-card-hd"><div class="fm-card-t">Datos del vehículo</div></div>
      <div class="fm-data-grid">
        <div class="fm-data-item"><dt>Serie / VIN</dt><dd class="mono" style="font-size:10px">${v.serie||'—'}</dd></div>
        <div class="fm-data-item"><dt>Póliza seguro</dt><dd class="mono" style="font-size:10px">${v.pol||'—'}</dd></div>
        <div class="fm-data-item"><dt>Vto. póliza</dt><dd class="${pvOk?'green':'red'}">${hF(v.pv)}</dd></div>
        <div class="fm-data-item"><dt>Rendimiento</dt><dd>${v.rend||'—'}</dd></div>
        <div class="fm-data-item"><dt>Estatus</dt><dd class="${v.status==='activo'?'green':v.status==='taller'?'amber':'red'}">${v.status||'activo'}</dd></div>
        ${v.nip?`<div class="fm-data-item"><dt>NIP</dt><dd>${v.nip}</dd></div>`:'<div></div>'}
      </div>
    </div>

    <!-- MIS SOLICITUDES RECIENTES -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:14px;font-weight:800">Mis solicitudes</div>
      ${solsPend.length?`<span style="font-size:10px;font-weight:700;background:#EDE9FE;color:#6D28D9;padding:3px 9px;border-radius:100px">${solsPend.length} activa(s)</span>`:''}
    </div>
    ${misSols.length?misSols.slice(0,5).map(s=>`
      <div class="fm-sol-card" onclick="fmVerSol('${s.id}')">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div class="fm-sol-tipo">${s.tipo||'—'}</div>
          ${badge(s.estatus)}
        </div>
        <div class="fm-sol-meta">${hF(s.creadoEn)} · ${s.modo?s.modo.toUpperCase():'—'} · ${s.prioridad||'Normal'}</div>
      </div>`).join('')
    :`<div class="fm-empty" style="padding:20px"><div class="fm-empty-ico" style="font-size:32px">📋</div><p style="font-size:13px;color:#94A3B8">Sin solicitudes registradas</p></div>`}
    <div style="height:20px"></div>
  `);
}

// PANTALLA DE VINCULACIÓN
function renderVincular(){
  const allVehs=window._fmAllVehs||[];
  setContent(`
    <div style="padding-top:20px">
      <div class="fm-vincular">
        <div class="fm-empty-ico" style="color:#1E3A5F">${IC.link}</div>
        <h2>Vincular mi vehículo</h2>
        <p>Selecciona el vehículo que tienes asignado. Esto se guarda en tu perfil y no podrá cambiarse sin autorización.</p>
        ${allVehs.length?`
        <div class="fm-fld">
          <label>Selecciona tu vehículo</label>
          <div class="fm-select-wrap">
            <select id="fm-sel-veh">
              <option value="">— Selecciona —</option>
              ${allVehs.filter(v=>v.status!=='baja').map(v=>`<option value="${v.eco}">ECO ${v.eco} · ${v.unidad} · ${v.placas}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="fm-btn primary" onclick="fmVincular()">Vincular este vehículo</button>`:`
        <button class="fm-btn primary" onclick="fmCargarVehs()">Cargar lista de vehículos</button>`}
      </div>
    </div>
  `);
}

window.fmCargarVehs=async function(){
  toast('Cargando vehículos…','info');
  dbg('Iniciando carga de vehículos…','info');
  dbg('db disponible: '+(!!window.db),'info');
  dbg('auth.currentUser: '+(window.auth?.currentUser?.email||'NO HAY SESIÓN'),'info');
  try{
    dbg('Intentando db.collection(flotilla_vehiculos).get()…','info');
    // Timeout de 8 segundos
    const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('TIMEOUT 5s — usando catálogo local')),5000));
    const query=db.collection('flotilla_vehiculos').get();
    const snap=await Promise.race([query,timeout]);
    dbg('Snap recibido. Docs: '+snap.size,'ok');
    if(!snap.empty){
      window._fmAllVehs=snap.docs.map(d=>({id:d.id,...d.data()}));
      dbg('Vehículos de Firestore: '+window._fmAllVehs.length,'ok');
    } else {
      dbg('Firestore vacío — usando catálogo local ('+CAT_FL.length+' unidades)','warn');
      window._fmAllVehs=CAT_FL.map(v=>({id:'eco-'+v.eco,...v}));
    }
  }catch(e){
    dbg('ERROR Firestore: '+e.code+' — '+e.message,'err');
    dbg('Usando catálogo local fallback ('+CAT_FL.length+' unidades)','warn');
    window._fmAllVehs=CAT_FL.map(v=>({id:'eco-'+v.eco,...v}));
  }
  if(!window._fmAllVehs||window._fmAllVehs.length===0){
    dbg('Lista vacía después de todo','err');
    toast('No se encontraron vehículos','err');
    return;
  }
  dbg('Total vehículos disponibles: '+window._fmAllVehs.length,'ok');
  toast(window._fmAllVehs.length+' vehículos disponibles','ok');
  renderVincular();
};

window.fmVincular=async function(){
  const eco=document.getElementById('fm-sel-veh')?.value;
  if(!eco){toast('Selecciona un vehículo','err');return;}
  const user=window.auth?.currentUser;
  if(!user){toast('No hay sesión activa','err');return;}
  try{
    const snap=await db.collection(C.USUARIOS).where('email','==',user.email).get();
    const datos={email:user.email,nombre:user.displayName||user.email,ecoVinculado:eco,vinculadoEn:new Date().toISOString()};
    if(snap.empty){await db.collection(C.USUARIOS).add(datos);}
    else{await db.collection(C.USUARIOS).doc(snap.docs[0].id).update({ecoVinculado:eco});}
    miPerfil={...miPerfil,...datos};
    await cargarMiVeh();
    await cargarMisSols();
    toast(`ECO ${eco} vinculado correctamente`,'ok');
    // Esperar un momento y navegar al vehículo
    setTimeout(()=>fmVista('vehiculo'), 800);
  }catch(e){toast('Error al vincular: '+e.message,'err');}
};

// ══════════════════════════════════════════
// VISTA 2 — NUEVA SOLICITUD
// ══════════════════════════════════════════
function renderNuevaSol(){
  if(!miVeh){
    setContent(`<div style="padding-top:20px"><div class="fm-vincular"><div class="fm-empty-ico" style="color:#1E3A5F">${IC.car}</div><h2>Sin vehículo vinculado</h2><p>Primero vincula tu vehículo asignado.</p><button class="fm-btn primary" onclick="fmVista('vehiculo')">Ir a Mi Vehículo</button></div></div>`);
    return;
  }
  // Reset estado
  solState={modo:'entrada',tipo:'',prior:'Normal',desc:'',km:'',taller:'',gasolina:50,chk:{},chkFotos:{},evFotos:[]};
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Nueva solicitud</div>
        <div class="fm-sec-s">ECO ${miVeh.eco} · ${miVeh.unidad}</div>
      </div>
    </div>

    <!-- MODO ENTRADA/SALIDA -->
    <div class="fm-modo">
      <button class="fm-modo-btn entrada on" id="fm-modo-e" onclick="fmSetModo('entrada')">ENTRADA</button>
      <button class="fm-modo-btn salida" id="fm-modo-s" onclick="fmSetModo('salida')">SALIDA</button>
    </div>

    <!-- TIPO DE SOLICITUD -->
    <div class="fm-fld">
      <label>Tipo de solicitud</label>
      <div class="fm-select-wrap">
        <select id="fm-tipo" onchange="if(this.value==='__c')document.getElementById('fm-tipo-c').style.display='block';else document.getElementById('fm-tipo-c').style.display='none'">
          <option value="">— Selecciona —</option>
          ${TIPOS_SOL.map(t=>`<option>${t}</option>`).join('')}
          <option value="__c">Personalizado…</option>
        </select>
      </div>
      <input type="text" id="fm-tipo-c" placeholder="Describe el tipo…" style="display:none;margin-top:8px;padding:12px 14px;border:1.5px solid #E2E8F0;border-radius:10px;font-family:inherit;font-size:14px;width:100%;outline:none">
    </div>

    <!-- PRIORIDAD -->
    <div class="fm-fld">
      <label>Prioridad</label>
      <div style="display:flex;gap:8px">
        ${['Normal','Alta','Urgente'].map(p=>`<button onclick="fmSetPrior(this,'${p}')" id="fm-prior-${p}" class="fm-btn ghost fm-btn-sm" style="flex:1;${p==='Normal'?'background:#1E3A5F;color:#fff':''}">${p}</button>`).join('')}
      </div>
    </div>

    <!-- DESCRIPCIÓN -->
    <div class="fm-fld">
      <label>Descripción del problema</label>
      <textarea id="fm-desc" placeholder="Describe el problema o servicio que se requiere…"></textarea>
    </div>

    <!-- KM + TALLER -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="fm-fld"><label>KM actual</label><input type="number" id="fm-km" placeholder="${miVeh.km||0}" inputmode="numeric"></div>
      <div class="fm-fld"><label>Taller sugerido</label><input type="text" id="fm-taller" placeholder="Opcional"></div>
    </div>

    <!-- GASOLINA -->
    <div class="fm-fld">
      <label>Nivel de gasolina</label>
      <div class="fm-gauge-wrap" id="fm-gauge-wrap">
        ${renderGaugeSVG(50)}
        <div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>
      </div>
      <input type="range" min="0" max="100" value="50" id="fm-gas" oninput="fmGas(this.value)" style="width:100%;margin-top:6px;accent-color:#2563EB">
    </div>

    <!-- EVIDENCIAS — CÁMARA FORZADA -->
    <div class="fm-fld">
      <label>Evidencias fotográficas <span style="font-weight:500;text-transform:none;font-size:9px;color:#94A3B8">(cámara obligatoria)</span></label>
      <button onclick="fmCapturar('general')" class="fm-btn primary" style="margin-bottom:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Tomar foto con cámara
      </button>
      <div id="fm-ev-wrap" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>

    <!-- CHECKLIST RÁPIDO -->
    <div class="fm-fld">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <label style="margin:0">Check list</label>
        <span id="fm-chk-cnt" style="font-size:10px;color:#64748B">0 de ${Object.values(CHK_CATS).flat().length} revisados</span>
      </div>
      <div id="fm-chk-list">${renderChkMovil()}</div>
    </div>

    <!-- BOTÓN GUARDAR -->
    <button class="fm-btn primary" onclick="fmGuardar()" id="fm-btn-guardar" style="margin-top:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      Crear solicitud
    </button>
    <div style="height:20px"></div>
  `);
}

function renderGaugeSVG(pct100){
  const pct=pct100/100;
  const toRad=a=>(a-90)*Math.PI/180;
  const cx=100,cy=85,R=70;
  const angS=-120,angE=angS+pct*240;
  const sx=cx+R*Math.cos(toRad(angS)),sy=cy+R*Math.sin(toRad(angS));
  const ex=cx+R*Math.cos(toRad(angE)),ey=cy+R*Math.sin(toRad(angE));
  const lg=pct*240>180?1:0;
  const col=pct<.25?'#EF4444':pct<.6?'#F59E0B':'#22C55E';
  return`<svg width="200" height="120" viewBox="0 0 200 120">
    <defs><linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#EF4444"/><stop offset="40%" stop-color="#F59E0B"/><stop offset="100%" stop-color="#22C55E"/></linearGradient></defs>
    <path d="M${(cx+R*Math.cos(toRad(-120))).toFixed(1)},${(cy+R*Math.sin(toRad(-120))).toFixed(1)} A${R},${R} 0 1,1 ${(cx+R*Math.cos(toRad(120))).toFixed(1)},${(cy+R*Math.sin(toRad(120))).toFixed(1)}" fill="none" stroke="#E8EDF5" stroke-width="12" stroke-linecap="round"/>
    ${pct>0?`<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${R},${R} 0 ${lg},1 ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="url(#gg)" stroke-width="12" stroke-linecap="round"/>`:''}
    <line x1="${cx}" y1="${cy}" x2="${(cx+58*Math.cos(toRad(angE))).toFixed(1)}" y2="${(cy+58*Math.sin(toRad(angE))).toFixed(1)}" stroke="#0A1628" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#0A1628" stroke="#fff" stroke-width="2"/>
    <text x="${cx}" y="${cy+28}" text-anchor="middle" font-size="13" font-weight="800" fill="${col}" font-family="'JetBrains Mono',monospace">${Math.round(pct*100)}%</text>
  </svg>`;
}

window.fmGas=function(v){
  solState.gasolina=Number(v);
  const w=document.getElementById('fm-gauge-wrap');
  if(w)w.innerHTML=renderGaugeSVG(Number(v))+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';
};

window.fmSetModo=function(m){
  solState.modo=m;
  const be=document.getElementById('fm-modo-e');
  const bs=document.getElementById('fm-modo-s');
  if(be){be.classList.toggle('on',m==='entrada');}
  if(bs){bs.classList.toggle('on',m==='salida');}
};

window.fmSetPrior=function(btn,p){
  solState.prior=p;
  document.querySelectorAll('[id^="fm-prior-"]').forEach(b=>{b.style.background='';b.style.color='';b.className='fm-btn ghost fm-btn-sm';b.style.flex='1';});
  btn.style.background='#1E3A5F';btn.style.color='#fff';
};

function renderChkMovil(){
  let h='';
  for(const [cat,items] of Object.entries(CHK_CATS)){
    h+=`<div class="fm-chk-cat">${cat}</div>`;
    items.forEach((item,i)=>{
      const key=`${cat}__${i}`;
      const val=solState.chk[key]||'';
      const hasFoto=!!solState.chkFotos[key];
      h+=`<div class="fm-chk-row" id="fm-cr-${key}">
        <span class="fm-chk-name">${item}</span>
        <button class="fm-chk-si ${val==='si'?'on':''}" onclick="fmChk('${key}','si')">SI</button>
        <button class="fm-chk-no ${val==='no'?'on':''}" onclick="fmChk('${key}','no')">NO</button>
        <div class="fm-chk-cam ${hasFoto?'has':''}" onclick="${hasFoto?`fmVerFoto(solState.chkFotos['${key}'])`:`fmCapturar('chk','${key}')`}" id="fm-cam-${key}">
          ${hasFoto?`<img src="${typeof solState.chkFotos[key]==='object'?solState.chkFotos[key].src:solState.chkFotos[key]}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`:
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`}
        </div>
      </div>`;
    });
  }
  return h;
}

window.fmChk=function(key,val){
  solState.chk[key]=solState.chk[key]===val?'':val;
  const si=document.querySelector(`#fm-cr-${key} .fm-chk-si`);
  const no=document.querySelector(`#fm-cr-${key} .fm-chk-no`);
  if(si)si.classList.toggle('on',solState.chk[key]==='si');
  if(no)no.classList.toggle('on',solState.chk[key]==='no');
  // Actualizar contador
  const total=Object.values(CHK_CATS).flat().length;
  const rev=Object.values(solState.chk).filter(v=>v==='si'||v==='no').length;
  const cnt=document.getElementById('fm-chk-cnt');
  if(cnt)cnt.textContent=`${rev} de ${total} revisados`;
};

// ── CAPTURAR EVIDENCIA MÓVIL ──
window.fmCapturar=async function(tipo,key){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='image/*';
  inp.capture='environment';
  inp.style.display='none';
  document.body.appendChild(inp);

  inp.onchange=async function(){
    const file=this.files[0];if(!file){document.body.removeChild(inp);return;}
    toast('Obteniendo GPS…','info');
    const gps=await getGPS();
    toast('Procesando evidencia…','info');
    const reader=new FileReader();
    reader.onload=async function(e){
      const now=new Date();
      const meta={
        codigo:genCod(),
        fecha:now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
        hora:now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
        timestamp:now.toISOString(),
        gps,eco:miVeh?.eco||'—',unidad:miVeh?.unidad||'—',
        usuario:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
        modo:solState.modo,tipo,key:key||null,
      };
      const sellada=await sellarImg(e.target.result,meta);
      if(tipo==='chk'&&key){
        solState.chkFotos[key]={src:sellada,meta};
        const cam=document.getElementById(`fm-cam-${key}`);
        if(cam){cam.classList.add('has');cam.innerHTML=`<img src="${sellada}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`;cam.onclick=()=>fmVerFoto({src:sellada,meta});}
      } else {
        solState.evFotos.push({src:sellada,meta});
        const wrap=document.getElementById('fm-ev-wrap');
        if(wrap){
          const pill=document.createElement('div');
          pill.className='fm-ev-pill';
          pill.onclick=()=>fmVerFoto({src:sellada,meta});
          pill.innerHTML=`<img src="${sellada}"><span>${meta.codigo}</span>`;
          wrap.appendChild(pill);
        }
      }
      toast(`✓ ${meta.codigo}`,'ok');
      document.body.removeChild(inp);
    };
    reader.readAsDataURL(file);
  };
  inp.click();
};

window.fmVerFoto=function(ev){
  const src=typeof ev==='string'?ev:ev.src;
  const meta=typeof ev==='object'?ev.meta:null;
  const ov=document.createElement('div');ov.className='fm-ov';
  ov.innerHTML=`<div class="fm-sheet">
    <div class="fm-sheet-hd"><h3>Evidencia</h3><button class="fm-sheet-x" onclick="this.closest('.fm-ov').remove()">✕</button></div>
    <div class="fm-sheet-body">
      <img src="${src}" style="width:100%;border-radius:12px;margin-bottom:14px;display:block">
      ${meta?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[['Código',meta.codigo||'—'],['Fecha',meta.fecha||'—'],['Hora',meta.hora||'—'],['GPS',meta.gps?`${meta.gps.lat}, ${meta.gps.lng}`:'Sin GPS'],['Vehículo',`ECO ${meta.eco}`],['Usuario',meta.usuario||'—'],['Modo',(meta.modo||'—').toUpperCase()],['Precisión',meta.gps?`±${meta.gps.acc}m`:'—']].map(([l,v])=>`
        <div style="background:#F8FAFD;border-radius:9px;padding:9px 11px">
          <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</div>
          <div style="font-size:12px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#0A0F1E;word-break:break-all">${v}</div>
        </div>`).join('')}
      </div>
      ${meta.gps?`<button onclick="window.open('https://maps.google.com/?q=${meta.gps.lat},${meta.gps.lng}','_blank')" class="fm-btn primary" style="margin-top:12px">Ver en Google Maps</button>`:''}
      `:''}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ── GUARDAR SOLICITUD ──
window.fmGuardar=async function(){
  const tipoR=document.getElementById('fm-tipo')?.value;
  const tipoC=document.getElementById('fm-tipo-c')?.value?.trim();
  const tipo=tipoR==='__c'?(tipoC||'Personalizado'):tipoR;
  const desc=document.getElementById('fm-desc')?.value?.trim();
  const km=document.getElementById('fm-km')?.value;
  const taller=document.getElementById('fm-taller')?.value?.trim();
  if(!tipo){toast('Selecciona el tipo de solicitud','err');return;}
  if(!desc){toast('Describe el problema','err');return;}
  const btn=document.getElementById('fm-btn-guardar');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const docObj={
    vehiculoId:miVeh?.id||'',vehiculoEco:miVeh?.eco||'',
    vehiculo:`${miVeh?.eco} · ${miVeh?.unidad||''}`,
    tipo,prioridad:solState.prior,descripcion:desc,
    kilometrajeReportado:km||'',taller:taller||'',
    gasolina:solState.gasolina,modo:solState.modo,
    tipoUnidad:['camioneta','camion'].includes(miVeh?.tipo)?'troca':'auto',
    estatus:'Solicitud',
    solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
    creadoPor:window.auth?.currentUser?.email||'',
    creadoEn:new Date().toISOString(),
    evidencias:solState.evFotos.map(e=>typeof e==='string'?e:e.src),
    evidenciasMeta:solState.evFotos.map(e=>typeof e==='object'?e.meta:null).filter(Boolean),
    checklist:{...solState.chk},
    chkFotos:Object.fromEntries(Object.entries(solState.chkFotos).map(([k,v])=>[k,typeof v==='object'?v.src:v])),
    origenApp:'movil',
  };
  if(!onlineStatus){
    offlineGuardar(docObj);
    if(btn){btn.disabled=false;btn.textContent='Crear solicitud';}
    return;
  }
  try{
    await db.collection(C.SOLS).add(docObj);
    if(km&&miVeh&&!miVeh.id.startsWith('eco-')){
      await db.collection(C.VEHS).doc(miVeh.id).update({km:Number(km)}).catch(()=>{});
    }
    await cargarMisSols();
    toast('Solicitud creada correctamente','ok');
    setTimeout(()=>fmVista('vehiculo'),1200);
  }catch(e){
    console.error('[MOVIL]',e);
    offlineGuardar(docObj);
    if(btn){btn.disabled=false;btn.textContent='Crear solicitud';}
  }
};

// ══════════════════════════════════════════
// VISTA 3 — MIS TAREAS
// ══════════════════════════════════════════
function renderTareas(){
  const pend=misTareas.filter(t=>t.estatus!=='Completada');
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Mis tareas</div>
        <div class="fm-sec-s">${pend.length} pendiente(s)</div>
      </div>
    </div>
    ${!pend.length?`<div class="fm-empty"><div class="fm-empty-ico" style="color:#15803D">${IC.check}</div><h3>Sin tareas pendientes</h3><p>No tienes tareas asignadas por el momento.</p></div>`:
    pend.map(t=>`
      <div class="fm-tarea-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
          <div class="fm-tarea-title">${t.titulo||t.nombre||'Tarea sin título'}</div>
          ${badge(t.estatus||'Pendiente')}
        </div>
        <div class="fm-tarea-meta">${t.descripcion||'Sin descripción'}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
          ${t.prioridad?`<span class="fm-tarea-prior" style="background:${t.prioridad==='Alta'||t.prioridad==='Urgente'?'#FEE2E2':'#F1F5F9'};color:${t.prioridad==='Alta'||t.prioridad==='Urgente'?'#B91C1C':'#475569'}">${t.prioridad}</span>`:''}
          ${t.fechaVencimiento?`<span style="font-size:11px;color:#64748B">Vence: ${hF(t.fechaVencimiento)}</span>`:''}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button onclick="fmMarcarTarea('${t.id}','En proceso')" class="fm-btn ghost fm-btn-sm" style="flex:1;font-size:12px">En proceso</button>
          <button onclick="fmMarcarTarea('${t.id}','Completada')" class="fm-btn green fm-btn-sm" style="flex:1;font-size:12px">Completar</button>
        </div>
      </div>`).join('')}
    <div style="height:20px"></div>
  `);
}

window.fmMarcarTarea=async function(id,est){
  try{
    await db.collection(C.TAREAS).doc(id).update({estatus:est,actualizadoEn:new Date().toISOString()});
    await cargarMisTareas();
    actualizarBadges();
    renderTareas();
    toast(est==='Completada'?'Tarea completada ✓':'Tarea en proceso','ok');
  }catch(e){toast('Error: '+e.message,'err');}
};

// ══════════════════════════════════════════
// VISTA 4 — NOTIFICACIONES / AVISOS
// ══════════════════════════════════════════
function renderNotif(){
  const items=[
    ...misNotif.map(s=>({
      ico:s.estatus==='Aprobada'?'ok':s.estatus==='Rechazada'?'err':'msg',
      bg:s.estatus==='Aprobada'?'#DCFCE7':s.estatus==='Rechazada'?'#FEE2E2':'#EDE9FE',icoSvg:s.estatus==='Aprobada'?IC.check:s.estatus==='Rechazada'?IC.x:IC.bell,
      t:`Solicitud ${s.estatus.toLowerCase()}`,
      s:`${s.tipo||'—'} · ECO ${s.vehiculoEco||'—'}`,
      time:hF(s.actualizadoEn||s.creadoEn),
      unread:true,
    })),
  ];
  const dv=hD(miVeh?.pv);
  if(dv!==null&&dv<90)items.unshift({ico:'warn',bg:'#FEF3C7',icoSvg:IC.alert,t:'Póliza de seguro',s:dv<0?'Póliza VENCIDA — renovar urgente':`Vence en ${dv} días`,time:'Hoy',unread:dv<0});

  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Avisos</div>
        <div class="fm-sec-s">${items.length} notificacion(es)</div>
      </div>
    </div>
    ${!items.length?`<div class="fm-empty"><div class="fm-empty-ico" style="color:var(--color-text-secondary,#94A3B8)">${IC.bell}</div><h3>Sin avisos</h3><p>No hay notificaciones nuevas.</p></div>`:
    items.map(n=>`<div class="fm-notif ${n.unread?'unread':''}">
      <div class="fm-notif-ico" style="background:${n.bg};color:${n.ico==='ok'?'#15803D':n.ico==='err'?'#B91C1C':n.ico==='warn'?'#B45309':'#6D28D9'}">${n.icoSvg||IC.bell}</div>
      <div class="fm-notif-body">
        <div class="fm-notif-t">${n.t}</div>
        <div class="fm-notif-s">${n.s}</div>
        <div class="fm-notif-time">${n.time}</div>
      </div>
    </div>`).join('')}
    <div style="height:20px"></div>
  `);
}

// ── VER SOLICITUD EXISTENTE ──
window.fmVerSol=function(id){
  const s=misSols.find(x=>x.id===id);if(!s)return;
  const ov=document.createElement('div');ov.className='fm-ov';
  ov.innerHTML=`<div class="fm-sheet">
    <div class="fm-sheet-hd">
      <h3>${s.tipo||'Solicitud'}</h3>
      <button class="fm-sheet-x" onclick="this.closest('.fm-ov').remove()">✕</button>
    </div>
    <div class="fm-sheet-body">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">${badge(s.estatus)}<span style="font-size:12px;color:#64748B">${hF(s.creadoEn)}</span></div>
      ${[['Vehículo',s.vehiculo||'—'],['Modo',(s.modo||'—').toUpperCase()],['Prioridad',s.prioridad||'Normal'],['KM',s.kilometrajeReportado||'—'],['Gasolina',s.gasolina!=null?s.gasolina+'%':'—'],['Taller',s.taller||'Sin especificar']].map(([l,v])=>`
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F1F5F9">
        <span style="font-size:12.5px;color:#64748B;font-weight:600">${l}</span>
        <span style="font-size:12.5px;font-weight:700;color:#0A0F1E">${v}</span>
      </div>`).join('')}
      <div style="padding:10px 0;border-bottom:1px solid #F1F5F9">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Descripción</div>
        <div style="font-size:13.5px;color:#0A0F1E;line-height:1.5">${s.descripcion||'—'}</div>
      </div>
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border-radius:10px;padding:11px 13px;margin-top:12px"><div style="font-size:12px;font-weight:700;color:#B91C1C;margin-bottom:3px">Motivo de rechazo</div><div style="font-size:13px;color:#991B1B">${s.comentarioRechazo}</div></div>`:''}
      ${s.evidencias?.length?`<div style="margin-top:14px"><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:8px">Evidencias (${s.evidencias.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${s.evidencias.map((src,i)=>{const m=(s.evidenciasMeta||[])[i];return`<div onclick="fmVerFoto({src:'${src}',meta:${m?JSON.stringify(m):'null'}})" class="fm-ev-pill"><img src="${src}"><span>${m?.codigo||'Foto '+(i+1)}</span></div>`;}).join('')}</div></div>`:''}
      <button onclick="this.closest('.fm-ov').remove()" class="fm-btn ghost" style="margin-top:16px">Cerrar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ── PERFIL ──
window.abrirPerfil=function(){
  const user=window.auth?.currentUser;
  const ov=document.createElement('div');ov.className='fm-ov';
  ov.innerHTML=`<div class="fm-sheet">
    <div class="fm-sheet-hd"><h3>Mi perfil</h3><button class="fm-sheet-x" onclick="this.closest('.fm-ov').remove()">✕</button></div>
    <div class="fm-sheet-body">
      <div style="text-align:center;padding:16px 0 20px">
        <div style="width:64px;height:64px;border-radius:50%;background:#1E3A5F;color:#fff;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${(user?.displayName||user?.email||'?').charAt(0).toUpperCase()}</div>
        <div style="font-size:17px;font-weight:800">${user?.displayName||'—'}</div>
        <div style="font-size:13px;color:#64748B;margin-top:3px">${user?.email||'—'}</div>
        ${miPerfil?.ecoVinculado?`<div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;background:#EFF6FF;border-radius:100px;padding:5px 14px;font-size:12px;font-weight:700;color:#1D4ED8">ECO ${miPerfil.ecoVinculado} vinculado</div>`:''}
      </div>
      ${!miPerfil?.ecoVinculado?`<button class="fm-btn primary" onclick="this.closest('.fm-ov').remove();fmVista('vehiculo')" style="margin-bottom:10px">Vincular mi vehículo</button>`:''}
      <button class="fm-btn danger" onclick="if(confirm('¿Cerrar sesión?')){window.auth.signOut().then(()=>location.reload());}">Cerrar sesión</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

console.log('[FLOTILLA MÓVIL] Tecnocontrol · App técnicos · Offline ready');


// VISTA 5 — UTILITARIOS / TRANSFERENCIA DE VEHÍCULO
// ══════════════════════════════════════════════════════
let utilState={
  modo:null, // 'entregar' | 'recibir'
  codigo:'',
  chk:{}, chkFotos:{}, evFotos:[],
  km:'', gasolina:50,
  firma:null, // base64 del canvas de firma
  paso:1, // 1=selección modo, 2=datos, 3=firma, 4=confirmado
};

function renderUtil(){
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Utilitarios</div>
        <div class="fm-sec-s">Transferencia de vehículo</div>
      </div>
    </div>

    ${utilState.paso===1?renderUtilPaso1():
      utilState.paso===2?renderUtilPaso2():
      utilState.paso===3?renderUtilPaso3():
      renderUtilPaso4()}
  `);

  // Inicializar canvas de firma si estamos en paso 3
  if(utilState.paso===3)setTimeout(initFirmaCanvas,100);
}

// PASO 1: Elegir modo
function renderUtilPaso1(){
  return`
    <div class="fm-card" style="text-align:center;padding:24px">
      <div style="color:#1E3A5F;margin-bottom:12px;display:flex;justify-content:center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
      </div>
      <h2 style="font-size:17px;font-weight:800;margin-bottom:8px">¿Qué deseas hacer?</h2>
      <p style="font-size:13px;color:#64748B;margin-bottom:20px;line-height:1.5">Selecciona si vas a entregar o recibir un vehículo</p>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="fm-btn primary" onclick="utilSetModo('entregar')" style="background:#1E3A5F">
          ${IC.car} Entregar mi vehículo
        </button>
        <button class="fm-btn" onclick="utilSetModo('recibir')" style="background:#15803D;color:#fff">
          ${IC.check} Recibir un vehículo
        </button>
      </div>
    </div>

    <!-- Historial de transferencias -->
    <div style="margin-top:16px">
      <div style="font-size:13px;font-weight:800;margin-bottom:10px;color:#1E3A5F">Mis transferencias recientes</div>
      <div id="util-hist-list">
        <div class="fm-empty" style="padding:16px">
          <div style="color:#94A3B8">${IC.doc}</div>
          <p style="font-size:12px;color:#94A3B8;margin-top:6px">Sin transferencias registradas</p>
        </div>
      </div>
    </div>
    <div style="height:20px"></div>
  `;
  // Cargar historial en paralelo
  setTimeout(()=>cargarUtilHist(),100);
}

async function cargarUtilHist(){
  try{
    const email=window.auth?.currentUser?.email||'';
    const snap=await db.collection('flotilla_transferencias')
      .where('emails','array-contains',email)
      .orderBy('creadoEn','desc').limit(5).get();
    const items=snap.docs.map(d=>({id:d.id,...d.data()}));
    const el=document.getElementById('util-hist-list');
    if(!el)return;
    if(!items.length){el.innerHTML=`<div class="fm-empty" style="padding:16px"><p style="font-size:12px;color:#94A3B8">Sin transferencias registradas</p></div>`;return;}
    el.innerHTML=items.map(t=>`
      <div class="fm-sol-card" style="margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:13px;font-weight:700">ECO ${t.vehiculoEco} — ${t.vehiculoUnidad||'—'}</span>
          ${badge(t.estatus||'Completada')}
        </div>
        <div style="font-size:11.5px;color:#64748B">
          De: ${t.entregaNombre||'—'} → Para: ${t.recibioNombre||'—'}
        </div>
        <div style="font-size:10.5px;color:#94A3B8;margin-top:2px">${t.creadoEn?t.creadoEn.substring(0,10):'—'} · Código: ${t.codigo||'—'}</div>
      </div>`).join('');
  }catch(e){console.warn('[UTIL hist]',e);}
}

// PASO 2a: Datos de entrega
function renderUtilPaso2(){
  const v=miVeh;
  const esEntrega=utilState.modo==='entregar';
  return`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <button onclick="utilState.paso=1;utilState.modo=null;renderUtil()" style="background:#F1F5F9;border:none;cursor:pointer;color:#1E3A5F;padding:8px 12px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Regresar
      </button>
      <div>
        <div style="font-size:15px;font-weight:800">${esEntrega?'Entrega de vehículo':'Recepción de vehículo'}</div>
        <div style="font-size:11px;color:#64748B">${esEntrega?'Paso 1 de 3':'Paso 1 de 2'}</div>
      </div>
    </div>

    ${esEntrega?`
    <!-- DATOS VEHÍCULO -->
    <div class="fm-card" style="background:linear-gradient(135deg,#0A1628,#1E3A5F);color:#fff;border:none;margin-bottom:12px">
      <div style="font-size:28px;font-weight:900;font-family:'JetBrains Mono',monospace;opacity:.9">${v?.eco||'—'}</div>
      <div style="font-size:16px;font-weight:800;margin-top:2px">${v?.unidad||'—'}</div>
      <div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:2px">${v?.placas||'—'} · ${v?.año||'—'}</div>
    </div>

    <div class="fm-fld"><label>¿A quién se entrega?</label>
      <input type="text" id="util-receptor" placeholder="Nombre del técnico que recibe"></div>

    <div class="fm-fld"><label>KM al entregar</label>
      <input type="number" id="util-km" placeholder="${v?.km||0}" inputmode="numeric"></div>

    <div class="fm-fld">
      <label>Nivel de gasolina</label>
      <div id="util-gauge-wrap">${renderGaugeSVG(utilState.gasolina)}<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div></div>
      <input type="range" min="0" max="100" value="${utilState.gasolina}" oninput="utilGas(this.value)" style="width:100%;margin-top:6px;accent-color:#2563EB">
    </div>

    <div class="fm-fld">
      <label>Fotos del vehículo al entregar <span style="font-size:9px;font-weight:500;text-transform:none;color:#94A3B8">(cámara obligatoria)</span></label>
      <button onclick="utilCapturar()" class="fm-btn primary" style="margin-bottom:10px;gap:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Tomar foto con cámara
      </button>
      <div style="font-size:10px;color:#94A3B8;text-align:center;margin-bottom:8px">Cámara obligatoria · Galería bloqueada · Sello GPS automático</div>
      <div id="util-fotos-wrap" style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0"></div>
    </div>

    <!-- CHECKLIST RÁPIDO ENTREGA -->
    <div class="fm-fld">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <label style="margin:0">Checklist de entrega</label>
        <span id="util-chk-cnt" style="font-size:10px;color:#64748B">0 revisados</span>
      </div>
      <div id="util-chk">${renderChkUtil()}</div>
    </div>

    <button class="fm-btn primary" onclick="utilSiguiente()" style="margin-top:8px">Continuar a firma</button>
    `:`
    <!-- MODO RECIBIR: ingresar código -->
    <div class="fm-card" style="text-align:center;padding:20px">
      <div style="color:#15803D;margin-bottom:12px;display:flex;justify-content:center">${IC.link}</div>
      <h3 style="font-size:15px;font-weight:800;margin-bottom:6px">Ingresa el código de transferencia</h3>
      <p style="font-size:12.5px;color:#64748B;margin-bottom:16px;line-height:1.5">El técnico que entrega te proporcionó un código único</p>
      <div class="fm-fld">
        <label>Código TCN-TR-XXXX</label>
        <input type="text" id="util-codigo" placeholder="TCN-TR-XXXX" style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:16px;font-weight:700;letter-spacing:2px;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
      </div>
      <button class="fm-btn primary" onclick="utilVerificarCodigo()" style="width:100%;margin-top:8px">Verificar código</button>
      <div id="util-codigo-msg" style="margin-top:10px;font-size:12px"></div>
    </div>
    `}
    <div style="height:20px"></div>
  `;
}

// PASO 3: Firma digital
function renderUtilPaso3(){
  const esEntrega=utilState.modo==='entregar';
  return`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
      <button onclick="utilState.paso=2;renderUtil()" style="background:#F1F5F9;border:none;cursor:pointer;color:#1E3A5F;padding:8px 12px;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;display:flex;align-items:center;gap:5px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        Regresar
      </button>
      <div>
        <div style="font-size:15px;font-weight:800">Firma digital</div>
        <div style="font-size:11px;color:#64748B">${esEntrega?'Paso 2 de 3':'Paso 2 de 2'} · Responsiva de ${esEntrega?'entrega':'recepción'}</div>
      </div>
    </div>

    <div class="fm-card">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma aquí abajo</div>
      <div style="border:2px solid #E2E8F0;border-radius:10px;overflow:hidden;background:#F8FAFD;touch-action:none">
        <canvas id="firma-canvas" width="320" height="200" style="display:block;width:100%;height:200px;touch-action:none;cursor:crosshair;border-radius:8px"></canvas>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="fm-btn ghost fm-btn-sm" onclick="limpiarFirma()" style="flex:1">Limpiar</button>
      </div>
    </div>

    <div class="fm-card" style="background:#F8FAFD">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:8px">Datos de la responsiva</div>
      ${[
        ['Vehículo', utilState.datosEntrega?.vehiculo||miVeh?.unidad||'—'],
        ['ECO', utilState.datosEntrega?.eco||miVeh?.eco||'—'],
        ['KM', utilState.datosEntrega?.km||'—'],
        ['Gasolina', Math.round(utilState.gasolina)+'%'],
        ['Entrega', utilState.datosEntrega?.nombre||window.auth?.currentUser?.displayName||'—'],
        ['Recibe', utilState.datosEntrega?.receptor||'—'],
        ['Fecha', new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})],
        ['Hora', new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})],
      ].map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F1F5F9;font-size:12.5px"><span style="color:#64748B">${l}</span><span style="font-weight:700;color:#0A0F1E">${v}</span></div>`).join('')}
    </div>

    <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#92400E;display:flex;align-items:flex-start;gap:8px">
      <span style="flex-shrink:0;width:16px;height:16px;display:inline-flex">${IC.alert.replace('<svg','<svg width=\"16\" height=\"16\"')}</span>
      <span>Al firmar aceptas la responsabilidad sobre el estado del vehículo en este momento.</span>
    </div>

    <button class="fm-btn primary" onclick="utilConfirmarFirma()" id="util-btn-firmar" style="display:flex;align-items:center;justify-content:center;gap:8px">
      <span style="width:16px;height:16px;display:inline-flex;flex-shrink:0">${IC.sign.replace('<svg','<svg width=\"16\" height=\"16\"')}</span>
      Firmar y confirmar
    </button>
    <div style="height:20px"></div>
  `;
}

// PASO 4: Confirmado
function renderUtilPaso4(){
  const cod=utilState.codigoGenerado||'—';
  const esEntrega=utilState.modo==='entregar';
  return`
    <div style="text-align:center;padding:32px 20px">
      <div style="width:64px;height:64px;border-radius:50%;background:#DCFCE7;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:#15803D">
        ${IC.check}
      </div>
      <h2 style="font-size:20px;font-weight:900;margin-bottom:8px;color:#15803D">${esEntrega?'Entrega registrada':'Recepción registrada'}</h2>
      <p style="font-size:13px;color:#64748B;line-height:1.5;margin-bottom:20px">La responsiva ha sido guardada correctamente.</p>

      ${esEntrega?`
      <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;padding:16px;margin-bottom:20px">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#1D4ED8;margin-bottom:6px">Código para el técnico que recibe</div>
        <div style="font-size:24px;font-weight:900;font-family:'JetBrains Mono',monospace;letter-spacing:3px;color:#1E3A5F">${cod}</div>
        <div style="font-size:11px;color:#64748B;margin-top:6px">Compártelo por WhatsApp con quien recibirá el vehículo</div>
        <button onclick="navigator.share?navigator.share({title:'Código transferencia',text:'Tu código de recepción de vehículo Tecnocontrol: ${cod}'}):navigator.clipboard.writeText('${cod}')" class="fm-btn primary" style="margin-top:10px;padding:8px 20px;font-size:12px">
          ${IC.swap} Compartir código
        </button>
      </div>`:''}

      <button class="fm-btn ghost" onclick="utilState={modo:null,codigo:'',chk:{},chkFotos:{},evFotos:[],km:'',gasolina:50,firma:null,paso:1};renderUtil()">
        Listo
      </button>
    </div>
  `;
}

// HELPERS UTILITARIOS
window.utilSetModo=function(m){utilState.modo=m;utilState.paso=2;renderUtil();};
window.utilGas=function(v){utilState.gasolina=Number(v);const w=document.getElementById('util-gauge-wrap');if(w)w.innerHTML=renderGaugeSVG(Number(v))+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';};

function renderChkUtil(){
  const items=['Carrocería sin daños nuevos','Cristales completos','Llantas en buen estado','Herramienta completa','Sin multas vigentes','Documentos en orden'];
  return items.map((item,i)=>{
    const key='util_'+i;
    const val=utilState.chk[key]||'';
    return`<div class="fm-chk-row" id="util-cr-${key}">
      <span class="fm-chk-name">${item}</span>
      <button class="fm-chk-si ${val==='si'?'on':''}" onclick="utilChk('${key}','si')">SI</button>
      <button class="fm-chk-no ${val==='no'?'on':''}" onclick="utilChk('${key}','no')">NO</button>
    </div>`;
  }).join('');
}

window.utilChk=function(key,val){
  utilState.chk[key]=utilState.chk[key]===val?'':val;
  const si=document.querySelector(`#util-cr-${key} .fm-chk-si`);
  const no=document.querySelector(`#util-cr-${key} .fm-chk-no`);
  if(si)si.classList.toggle('on',utilState.chk[key]==='si');
  if(no)no.classList.toggle('on',utilState.chk[key]==='no');
  const rev=Object.values(utilState.chk).filter(v=>v).length;
  const cnt=document.getElementById('util-chk-cnt');if(cnt)cnt.textContent=rev+' revisados';
};

window.utilCapturar=async function(){
  // Crear input PRIMERO antes de async (evita bloqueo en iOS)
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='image/*';
  inp.capture='environment'; // FUERZA cámara trasera — bloquea galería en iOS/Android
  inp.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px';
  document.body.appendChild(inp);

  inp.onchange=async function(){
    const file=this.files[0];
    if(!file){document.body.removeChild(inp);return;}
    toast('Obteniendo ubicación y procesando…','info');

    // GPS y procesamiento en paralelo
    const [gps, imgData] = await Promise.all([
      getGPS(),
      new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);})
    ]);

    const now=new Date();
    const meta={
      codigo:genCod(),
      fecha:now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
      hora:now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      timestamp:now.toISOString(),
      gps,
      eco:miVeh?.eco||'—',
      unidad:miVeh?.unidad||'—',
      usuario:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
      modo:'utilitario-entrega',
    };

    const sellada=await sellarImg(imgData,meta);
    utilState.evFotos.push({src:sellada,meta});

    const wrap=document.getElementById('util-fotos-wrap');
    if(wrap){
      const pill=document.createElement('div');
      pill.className='fm-ev-pill';
      pill.onclick=()=>fmVerFoto({src:sellada,meta});
      pill.innerHTML=`<img src="${sellada}" style="width:56px;height:56px;object-fit:cover;border-radius:6px"><div style="font-size:9px;font-family:'JetBrains Mono',monospace;color:#374151;margin-top:2px">${meta.codigo}</div>`;
      pill.style.cssText='display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;';
      wrap.appendChild(pill);
    }

    // Actualizar contador en botón
    const cnt=document.querySelector('#util-fotos-wrap')?.children?.length||0;
    toast(`Foto ${cnt} registrada · ${meta.codigo}`,'ok');
    document.body.removeChild(inp);
  };

  // Activar cámara
  inp.click();
};

window.utilSiguiente=function(){
  const receptor=document.getElementById('util-receptor')?.value?.trim();
  const km=document.getElementById('util-km')?.value;
  if(!receptor){toast('Ingresa el nombre de quien recibe','err');return;}
  if(utilState.evFotos.length===0){toast('Toma al menos una foto del vehículo','err');return;}
  utilState.datosEntrega={
    vehiculo:miVeh?.unidad||'—',eco:miVeh?.eco||'—',
    km:km||miVeh?.km||'0',receptor,
    nombre:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
  };
  utilState.paso=3;renderUtil();
};

window.utilVerificarCodigo=async function(){
  const cod=document.getElementById('util-codigo')?.value?.trim().toUpperCase();
  if(!cod||!cod.startsWith('TCN-TR-')){toast('Código inválido','err');return;}
  toast('Verificando…','info');
  const msg=document.getElementById('util-codigo-msg');
  try{
    const snap=await db.collection('flotilla_transferencias').where('codigo','==',cod).where('estatus','==','Pendiente recepción').get();
    if(snap.empty){if(msg)msg.innerHTML=`<span style="color:#B91C1C">Código no encontrado o ya fue utilizado</span>`;return;}
    const t={id:snap.docs[0].id,...snap.docs[0].data()};
    utilState.transferenciaId=t.id;
    utilState.datosEntrega={vehiculo:t.vehiculoUnidad,eco:t.vehiculoEco,km:t.kmEntrega,receptor:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',nombre:t.entregaNombre};
    toast('Código válido — ECO '+t.vehiculoEco,'ok');
    setTimeout(()=>{utilState.paso=3;renderUtil();},800);
  }catch(e){if(msg)msg.innerHTML=`<span style="color:#B91C1C">Error: ${e.message}</span>`;}
};

// CANVAS DE FIRMA
function initFirmaCanvas(){
  const canvas=document.getElementById('firma-canvas');if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.strokeStyle='#1E3A5F';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  let drawing=false,lastX=0,lastY=0;
  function getPos(e){const r=canvas.getBoundingClientRect();const scaleX=canvas.width/r.width;const scaleY=canvas.height/r.height;const src=e.touches?e.touches[0]:e;return{x:(src.clientX-r.left)*scaleX,y:(src.clientY-r.top)*scaleY};}
  canvas.addEventListener('mousedown',e=>{drawing=true;const p=getPos(e);lastX=p.x;lastY=p.y;});
  canvas.addEventListener('mousemove',e=>{if(!drawing)return;const p=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y;});
  canvas.addEventListener('mouseup',()=>drawing=false);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=getPos(e);lastX=p.x;lastY=p.y;},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const p=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y;},{passive:false});
  canvas.addEventListener('touchend',()=>drawing=false);
}

window.limpiarFirma=function(){const c=document.getElementById('firma-canvas');if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}};

window.utilConfirmarFirma=async function(){
  const canvas=document.getElementById('firma-canvas');
  if(!canvas){toast('Error al obtener firma','err');return;}
  // Verificar que hay firma
  const ctx=canvas.getContext('2d');
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const tieneFirma=data.some((_,i)=>i%4===3&&data[i]>0);
  if(!tieneFirma){toast('Dibuja tu firma primero','err');return;}
  utilState.firma=canvas.toDataURL('image/png');
  const btn=document.getElementById('util-btn-firmar');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const esEntrega=utilState.modo==='entregar';
  // Generar código único de transferencia
  const now=new Date();
  const dd=String(now.getFullYear())+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let rand='';for(let i=0;i<4;i++)rand+=chars[Math.floor(Math.random()*chars.length)];
  const codigo=`TCN-TR-${dd}-${rand}`;
  utilState.codigoGenerado=codigo;
  const userEmail=window.auth?.currentUser?.email||'';
  const userName=window.auth?.currentUser?.displayName||userEmail;
  try{
    if(esEntrega){
      // Crear documento de transferencia
      const docObj={
        codigo,tipo:'transferencia',
        vehiculoEco:miVeh?.eco||'',vehiculoId:miVeh?.id||'',vehiculoUnidad:miVeh?.unidad||'',
        entregaEmail:userEmail,entregaNombre:userName,entregaFirma:utilState.firma,
        entregaKm:utilState.datosEntrega?.km||'',entregaGasolina:utilState.gasolina,
        entregaChk:{...utilState.chk},entregaFotos:utilState.evFotos.map(e=>e.src),
        entregaFotosMeta:utilState.evFotos.map(e=>e.meta),
        receptorNombre:utilState.datosEntrega?.receptor||'',
        estatus:'Pendiente recepción',
        emails:[userEmail],
        creadoEn:now.toISOString(),
      };
      await db.collection('flotilla_transferencias').add(docObj);
      // Notificar administradores
      await db.collection('flotilla_notificaciones').add({
        tipo:'transferencia_iniciada',codigo,vehiculoEco:miVeh?.eco||'',
        mensaje:`${userName} inició transferencia del ECO ${miVeh?.eco||'—'} a ${utilState.datosEntrega?.receptor||'—'}`,
        leido:false,creadoEn:now.toISOString(),
      });
    } else {
      // Completar transferencia existente
      if(utilState.transferenciaId){
        await db.collection('flotilla_transferencias').doc(utilState.transferenciaId).update({
          recibioEmail:userEmail,recibioNombre:userName,recibioFirma:utilState.firma,
          recibioKm:utilState.datosEntrega?.km||'',
          recibioChk:{...utilState.chk},
          estatus:'Completada',completadoEn:now.toISOString(),
          emails:[...(utilState.emails||[]),userEmail],
        });
        // Reasignar vehículo
        await db.collection('fl_usuarios').where('email','==',userEmail).get().then(snap=>{
          if(!snap.empty)return snap.docs[0].ref.update({ecoVinculado:utilState.datosEntrega?.eco||''});
          return db.collection('fl_usuarios').add({email:userEmail,nombre:userName,ecoVinculado:utilState.datosEntrega?.eco||'',vinculadoEn:now.toISOString()});
        });
        // Notificar
        await db.collection('flotilla_notificaciones').add({
          tipo:'transferencia_completada',codigo:utilState.codigo,vehiculoEco:utilState.datosEntrega?.eco||'',
          mensaje:`Transferencia completada. ${userName} recibió el ECO ${utilState.datosEntrega?.eco||'—'}`,
          leido:false,creadoEn:now.toISOString(),
        });
      }
    }
    utilState.paso=4;renderUtil();
    toast('Responsiva guardada correctamente','ok');
  }catch(e){
    console.error('[UTIL firma]',e);
    toast('Error al guardar: '+e.message,'err');
    if(btn){btn.disabled=false;btn.textContent='Firmar y confirmar';}
  }
};

})();
