// ══════════════════════════════════════════════════════════════
// flotilla.js v9 — Gestión Vehicular Tecnocontrol
// Layout: sidebar portal respetado · diseño profesional
// 4 secciones: Panel General · Solicitudes · Comisiones · Bajas
// ══════════════════════════════════════════════════════════════
(function () {
'use strict';

const C = {
  VEHS:'flotilla_vehiculos', SOLS:'flotilla_solicitudes',
  INSP:'flotilla_inspecciones', COMIS:'flotilla_comisiones',
};

const CAT = [
  {eco:'15',unidad:'NISSAN NP300',      año:2017,plaza:'JUAREZ',    responsable:'JORGE GUERRERO',   placas:'DU6478A',serie:'3N6AD33A3HK869708',rend:'7 KM/L',   pv:'2026-09-24',pol:'794B05035M-17',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'16',unidad:'GRUA F-350',        año:2010,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6497A',serie:'1FDEF3G59AEB23674', rend:'5 KM/L',   pv:'2026-09-24',pol:'794B05035M-10',tipo:'camion',   color:'Blanco',nip:''},
  {eco:'17',unidad:'MARCH ACTIVE',      año:2017,plaza:'CHIHUAHUA', responsable:'GUILLERMO',        placas:'EMB313A',serie:'3N1CK3CD5HL248558', rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-23',tipo:'auto',     color:'Blanco',nip:'1713'},
  {eco:'19',unidad:'RAM 700',           año:2017,plaza:'CHIHUAHUA', responsable:'ROBERTO MUÑOZ',    placas:'DU6471A',serie:'9BD578458HY162606', rend:'—',        pv:'2026-09-24',pol:'794B05035M-20',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'21',unidad:'RAM 700',           año:2018,plaza:'JUAREZ',    responsable:'BENITO SOTO',      placas:'DU6470A',serie:'9BD578452JY210560', rend:'—',        pv:'2026-09-24',pol:'794B05035M-12',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'22',unidad:'RAM 700',           año:2018,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6751A',serie:'9BD578456JY208715', rend:'9 KM/L',   pv:'2026-09-24',pol:'794B05035M-13',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'23',unidad:'RAM 700',           año:2018,plaza:'CHIHUAHUA', responsable:'SERGIO CARMONA',   placas:'DU6752A',serie:'9BD578454JY209023', rend:'—',        pv:'2026-09-24',pol:'794B05035M-14',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'26',unidad:'SEAT IBIZA',        año:2018,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EMB314A',serie:'VSBB2KJ1JR017261',  rend:'13 KM/L',  pv:'2026-09-24',pol:'794B05035M-19',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'31',unidad:'NP300 KANGOO',      año:2012,plaza:'CHIHUAHUA', responsable:'DESARROLLOS',      placas:'DU6754A',serie:'3N6DD25T5CK018279', rend:'8 KM/L',   pv:'2026-09-24',pol:'794B05035M-6', tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'35',unidad:'ISUZU',             año:2019,plaza:'CHIHUAHUA', responsable:'ALMACEN',          placas:'DU6495A',serie:'JAANPR755K7000178', rend:'3.5 KM/L', pv:'2026-09-24',pol:'794B05035M-9', tipo:'camion',   color:'Blanco',nip:''},
  {eco:'36',unidad:'CAMION NISSAN CS',  año:2014,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6494A',serie:'3N6DD25T9EK019471', rend:'8 KM/L',   pv:'2026-09-24',pol:'794B05035M-18',tipo:'camion',   color:'Blanco',nip:''},
  {eco:'37',unidad:'RAM 700',           año:2019,plaza:'JUAREZ',    responsable:'JUAREZ',           placas:'DU6493A',serie:'9BD578458KY323611', rend:'—',        pv:'2026-09-24',pol:'794B05035M-21',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'38',unidad:'RAM 700',           año:2019,plaza:'CHIHUAHUA', responsable:'DIONICIO',         placas:'DU6492A',serie:'9BD578455KY324652', rend:'—',        pv:'2026-09-24',pol:'794B05035M-22',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'39',unidad:'L200',              año:2019,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'DU6491A',serie:'MMBL45G1KH043444',  rend:'10 KM/L',  pv:'2026-09-24',pol:'794B05035M-30',tipo:'camioneta',color:'Blanco',nip:'1339'},
  {eco:'40',unidad:'MARCH ACTIVE',      año:2019,plaza:'MONTERREY', responsable:'IVAN SEPULVEDA',   placas:'DU6490A',serie:'3N6CK34N2KL230477', rend:'10.5 KM/L',pv:'2026-09-24',pol:'794B05035M-2', tipo:'auto',     color:'Blanco',nip:''},
  {eco:'43',unidad:'F-150 PICK-UP',     año:2012,plaza:'CHIHUAHUA', responsable:'—',                placas:'DU6488A',serie:'1FTMF1CM1CKD41243', rend:'5.6 KM/L', pv:'2026-09-24',pol:'794B05035M-5', tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'47',unidad:'MARCH ACTIVE L4',   año:2019,plaza:'CHIHUAHUA', responsable:'IDALY RUIZ',       placas:'EMB308A',serie:'3N1CK3CD5KL232108', rend:'—',        pv:'2026-09-24',pol:'794B05035M-24',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'48',unidad:'MARCH ACTIVE L4',   año:2019,plaza:'CHIHUAHUA', responsable:'IVAN ARGENIS',     placas:'EMB309A',serie:'3N1CK3CD4KL232066', rend:'—',        pv:'2026-09-24',pol:'794B05035M-8', tipo:'auto',     color:'Blanco',nip:''},
  {eco:'50',unidad:'FIESTA',            año:2018,plaza:'MONTERREY', responsable:'IRVING SAUCEDO',   placas:'EMB310A',serie:'3FADP4BJ1JM128469', rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-11',tipo:'auto',     color:'Plata', nip:''},
  {eco:'52',unidad:'MARCH',             año:2020,plaza:'MONTERREY', responsable:'MONTERREY',        placas:'DU6486A',serie:'3N6CK34N3LL243692', rend:'—',        pv:'2026-09-24',pol:'794B05035M-26',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'54',unidad:'RAM 700 SLT',       año:2020,plaza:'CHIHUAHUA', responsable:'RICARDO GONZALEZ', placas:'DU6485A',serie:'9BD578452LY411572', rend:'17.5 KM/L',pv:'2026-09-24',pol:'794B05035M-33',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'55',unidad:'MARCH',             año:2020,plaza:'MONTERREY', responsable:'ROQUE LEAL',       placas:'DU6484A',serie:'3N6CK34N3LL248469', rend:'11.7 KM/L',pv:'2026-09-24',pol:'794B05035M-27',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'56',unidad:'RAM 700 SLT',       año:2020,plaza:'PARRAL',    responsable:'PLAZA PARRAL',     placas:'DU6483A',serie:'9BD578451LY423955', rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-34',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'58',unidad:'RAM 700',           año:2021,plaza:'CHIHUAHUA', responsable:'ISMAEL BARRAZA',   placas:'DU6482A',serie:'9BD281G50MYV59661', rend:'12.7 KM/L',pv:'2026-09-24',pol:'794B05035M-35',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'59',unidad:'RAM 700',           año:2021,plaza:'CHIHUAHUA', responsable:'ALAN ESTRADA',     placas:'DU6481A',serie:'9BD281G56MYV59423', rend:'13.5 KM/L',pv:'2026-09-24',pol:'794B05035M-36',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'60',unidad:'MARCH',             año:2020,plaza:'CAMARGO',   responsable:'RAMON HERNANDEZ',  placas:'DU6480A',serie:'3N6CK34N9LL254065', rend:'11.6 KM/L',pv:'2026-09-24',pol:'794B05035M-28',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'61',unidad:'MARCH',             año:2020,plaza:'PARRAL',    responsable:'RICARDO MORIEL',   placas:'DU6479A',serie:'3N6CK34N2LL254229', rend:'13.9 KM/L',pv:'2026-09-24',pol:'794B05035M-29',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'62',unidad:'NP300',             año:2019,plaza:'MONTERREY', responsable:'JULIO DE LA CRUZ', placas:'DU6472A',serie:'3N6AD33A1KK838707', rend:'7.5 KM/L', pv:'2026-09-24',pol:'794B05035M-31',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'63',unidad:'SILVERADO 1500',    año:2013,plaza:'CHIHUAHUA', responsable:'BODEGA',           placas:'DU6473A',serie:'3GCNC9CX6DG343777', rend:'5.5 KM/L', pv:'2026-09-24',pol:'794B05035M-25',tipo:'camioneta',color:'Plata', nip:''},
  {eco:'64',unidad:'MARCH ACTIVE',      año:2017,plaza:'CHIHUAHUA', responsable:'VERONICA GARCIA',  placas:'DU6474A',serie:'3N6CK34N4HL242297', rend:'10.6 KM/L',pv:'2026-09-24',pol:'794B05035M-32',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'66',unidad:'AVEO',              año:2018,plaza:'CHIHUAHUA', responsable:'CARMEN HERNANDEZ', placas:'EMB311A',serie:'LSGHD52H6JD239610', rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-37',tipo:'auto',     color:'Gris',  nip:''},
  {eco:'69',unidad:'NISSAN NP300',      año:2017,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6499A',serie:'3N6AD33A6HK837318', rend:'—',        pv:'2026-09-24',pol:'794B05035M-38',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'71',unidad:'YUKON',             año:2023,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DYY416B',serie:'1GKS28KL1PR236241', rend:'—',        pv:'—',         pol:'—',            tipo:'camioneta',color:'Negro', nip:''},
  {eco:'72',unidad:'RAM RAPID',         año:2023,plaza:'CHIHUAHUA', responsable:'JORGE URIBE',      placas:'DG7445B',serie:'9BD2657RIP9233026',  rend:'14 KM/L',  pv:'—',         pol:'—',            tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'73',unidad:'DODGE ATTITUDE',    año:2023,plaza:'CHIHUAHUA', responsable:'DENISSE GUTIERREZ',placas:'MKL325A',serie:'ML3ABT6J4PH004521', rend:'—',        pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'74',unidad:'DODGE ATTITUDE',    año:2023,plaza:'CHIHUAHUA', responsable:'FATIMA SAUZAMEDA', placas:'MKL317A',serie:'ML3ABT6J4PH004552', rend:'15.8 KM/L',pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'75',unidad:'AVEO',              año:2019,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DUJ454B',serie:'LSGHD52H8KD130423', rend:'—',        pv:'2027-02-14',pol:'29113016152002',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'76',unidad:'NISSAN VERSA',      año:2024,plaza:'MONTERREY', responsable:'LUIS GARZA',       placas:'ESU908B',serie:'3N1CN7AE7RK398169', rend:'16 KM/L',  pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'77',unidad:'BMW X6',            año:2025,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EKM897B',serie:'WBA41EX06S9W75509', rend:'—',        pv:'—',         pol:'—',            tipo:'auto',     color:'Negro', nip:''},
  {eco:'79',unidad:'CHANGAN HUNTER',    año:2025,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'337217', serie:'LSCBBZ2A1SG803364', rend:'—',        pv:'2029-02-27',pol:'4056350008',    tipo:'camioneta',color:'Blanco',nip:'7925'},
  {eco:'80',unidad:'CHANGAN HUNTER',    año:2025,plaza:'CHIHUAHUA', responsable:'ULISES NUÑEZ',     placas:'337218', serie:'LSCBBZ2A3SG803365', rend:'—',        pv:'2029-02-27',pol:'4056347985',    tipo:'camioneta',color:'Blanco',nip:'8025'},
  {eco:'81',unidad:'CHANGAN HUNTER',    año:2025,plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',      placas:'337219', serie:'LSCBB72A8SG803376', rend:'—',        pv:'2029-02-27',pol:'4056350016',    tipo:'camioneta',color:'Blanco',nip:'8125'},
  {eco:'82',unidad:'VAN DONGFENG',      año:2026,plaza:'CHIHUAHUA', responsable:'TOMAS',            placas:'DZ9769B',serie:'LGFP541E6TA603994',  rend:'—',        pv:'2029-03-17',pol:'4056530506',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'83',unidad:'CHASIS DONGFENG',   año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9767B',serie:'LGDND41EXSA202059',  rend:'—',        pv:'2029-03-17',pol:'4056530481',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'84',unidad:'CHASIS DONGFENG',   año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9766B',serie:'LGDND41E6SA202057',  rend:'—',        pv:'2029-03-17',pol:'4056530495',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'85',unidad:'PICKUP DONGFENG',   año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9768B',serie:'LGDCMA1L5SA204421',  rend:'—',        pv:'2029-03-20',pol:'3200970801',    tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'90',unidad:'CHANGAN STAR',      año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9853B',serie:'LSCAB12E7TG800860',  rend:'—',        pv:'2026-11-01',pol:'1950290311',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'91',unidad:'CHANGAN STAR DC',   año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9855B',serie:'LSCAB22E6TG800256',  rend:'—',        pv:'2026-11-01',pol:'1950290357',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'92',unidad:'CHANGAN STAR DC',   año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9854B',serie:'LSCAB22E5TG800295',  rend:'—',        pv:'2026-11-01',pol:'1950290361',    tipo:'camion',   color:'Blanco',nip:''},
];

// ── ÍCONOS SVG inline ──
const I={
  car:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  truck:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  grid:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  wrench:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  road:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l3-10h12l3 10"/><path d="M12 7v10"/></svg>`,
  archive:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  plus:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  alert:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  camera:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  upload:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`,
  search:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  user:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  doc:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  eye:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  trash:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
  shield:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
};

// ── ESTADO ──
let flV=[], flS=[], flCom=[];
let vistaAct='panel';
let dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
let solEvidencias=[], comEvidEntrega=[], comEvidRecepcion=[];
let tipoVehSel='auto';
const TIPOS_SOL=['Mantenimiento preventivo','Mantenimiento correctivo','Reposición de llanta','Falla eléctrica','Siniestro / Accidente','Revisión de documentos','Otro'];

// ── HELPERS ──
const hD  = f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);
const hF  = iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';
const hRol= ()=>window.flGetRolActual?window.flGetRolActual():'Usuario';
const hP  = a=>window.flTienePermiso?window.flTienePermiso(a):['Administrador','Contraloría','Flotilla'].includes(hRol());
const hAdm= ()=>['Administrador','Contraloría','Flotilla'].includes(hRol());
const hEmo= t=>t==='camion'?'🚛':t==='camioneta'?'🛻':'🚗';

function hBadge(e){
  const m={
    Solicitud:['#EDE9FE','#6D28D9'],Validada:['#DBEAFE','#1D4ED8'],
    Cotización:['#FEF3C7','#B45309'],Aprobada:['#DCFCE7','#15803D'],
    Rechazada:['#FEE2E2','#B91C1C'],Cierre:['#F3E8FF','#7C3AED'],
    Cerrada:['#F1F5F9','#475569'],'En préstamo':['#EDE9FE','#6D28D9'],
    Devuelto:['#DCFCE7','#15803D'],activo:['#DCFCE7','#15803D'],
    taller:['#FEF3C7','#B45309'],comision:['#EDE9FE','#6D28D9'],baja:['#FEE2E2','#B91C1C'],
  };
  const [bg,cl]=m[e]||['#F1F5F9','#475569'];
  return`<span style="display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:100px;background:${bg};color:${cl};white-space:nowrap">${e||'—'}</span>`;
}

// ── SVG DAÑOS ──
function svgShapes(vista,tipo){
  const t=tipo==='troca';
  const s={
    frente: t
      ?`<rect x="55" y="28" width="150" height="70" rx="7" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="63" y="36" width="134" height="32" rx="5" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="63" y="73" width="58" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B"/>
         <rect x="139" y="73" width="58" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B"/>
         <circle cx="76" cy="108" r="13" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <circle cx="184" cy="108" r="13" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="108" y="93" width="44" height="8" rx="3" fill="#94A3B8"/>`
      :`<rect x="65" y="22" width="130" height="78" rx="13" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="74" y="30" width="112" height="38" rx="7" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="74" y="73" width="48" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B"/>
         <rect x="138" y="73" width="48" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B"/>
         <circle cx="84" cy="106" r="12" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <circle cx="176" cy="106" r="12" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="112" y="88" width="36" height="8" rx="3" fill="#94A3B8"/>`,
    trasera: t
      ?`<rect x="55" y="18" width="150" height="55" rx="6" fill="#94A3B8" stroke="#64748B" stroke-width="1.5"/>
         <rect x="55" y="73" width="150" height="32" rx="5" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="63" y="26" width="134" height="36" rx="4" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="63" y="79" width="58" height="14" rx="3" fill="#FCA5A5" stroke="#EF4444"/>
         <rect x="139" y="79" width="58" height="14" rx="3" fill="#FCA5A5" stroke="#EF4444"/>
         <circle cx="76" cy="112" r="13" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <circle cx="184" cy="112" r="13" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>`
      :`<rect x="65" y="22" width="130" height="78" rx="13" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="74" y="30" width="112" height="38" rx="7" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="74" y="73" width="48" height="16" rx="4" fill="#FCA5A5" stroke="#EF4444"/>
         <rect x="138" y="73" width="48" height="16" rx="4" fill="#FCA5A5" stroke="#EF4444"/>
         <circle cx="84" cy="106" r="12" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <circle cx="176" cy="106" r="12" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="110" y="90" width="40" height="5" rx="2" fill="#94A3B8"/>`,
    lateral_izq: t
      ?`<ellipse cx="66" cy="104" rx="20" ry="20" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <ellipse cx="194" cy="104" rx="20" ry="20" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="36" y="60" width="188" height="48" rx="7" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="48" y="22" width="72" height="42" rx="5" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="124" y="22" width="98" height="42" rx="5" fill="#94A3B8" stroke="#64748B"/>
         <rect x="30" y="66" width="24" height="20" rx="3" fill="#FDE68A" stroke="#F59E0B"/>`
      :`<ellipse cx="70" cy="102" rx="18" ry="18" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <ellipse cx="190" cy="102" rx="18" ry="18" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="42" y="58" width="176" height="46" rx="9" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="54" y="22" width="88" height="40" rx="7" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="148" y="26" width="48" height="34" rx="6" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="36" y="64" width="22" height="18" rx="3" fill="#FDE68A" stroke="#F59E0B"/>`,
    lateral_der: t
      ?`<ellipse cx="66" cy="104" rx="20" ry="20" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <ellipse cx="194" cy="104" rx="20" ry="20" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="36" y="60" width="188" height="48" rx="7" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="140" y="22" width="72" height="42" rx="5" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="38" y="22" width="98" height="42" rx="5" fill="#94A3B8" stroke="#64748B"/>
         <rect x="206" y="66" width="24" height="20" rx="3" fill="#FCA5A5" stroke="#EF4444"/>`
      :`<ellipse cx="70" cy="102" rx="18" ry="18" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <ellipse cx="190" cy="102" rx="18" ry="18" fill="#1E293B" stroke="#0F172A" stroke-width="2"/>
         <rect x="42" y="58" width="176" height="46" rx="9" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
         <rect x="118" y="22" width="88" height="40" rx="7" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="62" y="26" width="48" height="34" rx="6" fill="#BFDBFE" stroke="#93C5FD"/>
         <rect x="200" y="64" width="22" height="18" rx="3" fill="#FCA5A5" stroke="#EF4444"/>`,
  };
  return s[vista]||'';
}

function dmgCard(vista,tipo,pts,readonly){
  const nom={frente:'Frente',trasera:'Trasera',lateral_izq:'Lateral Izq.',lateral_der:'Lateral Der.'};
  const puntos=(pts||[]).map((p,i)=>`
    <circle cx="${p.x}" cy="${p.y}" r="8" fill="#EF4444" stroke="#fff" stroke-width="2.5" opacity=".95"/>
    <text x="${p.x}" y="${p.y+3.5}" text-anchor="middle" font-size="8" font-weight="800" fill="#fff" font-family="sans-serif">${i+1}</text>`).join('');
  const clickEvt=readonly?'':`onclick="flDmgClick(event,'${vista}')"`;
  return`<div style="background:#fff;border:1.5px solid #E2E8F0;border-radius:10px;overflow:hidden">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#F8FAFD;border-bottom:1px solid #E8EDF5">
      <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#64748B">${nom[vista]}</span>
      ${!readonly?`<button style="font-size:9px;font-weight:700;color:#EF4444;background:none;border:none;cursor:pointer;font-family:inherit" onclick="event.stopPropagation();flDmgClear('${vista}')">✕ Limpiar</button>`:''}
    </div>
    <div ${clickEvt} style="cursor:${readonly?'default':'crosshair'};display:block;${readonly?'':''}">
      <svg id="fl-ds-${vista}" width="100%" viewBox="0 0 260 125" xmlns="http://www.w3.org/2000/svg" style="display:block">
        ${svgShapes(vista,tipo)}
        <g id="fl-dp-${vista}">${puntos}</g>
      </svg>
    </div>
    <div id="fl-dpt-${vista}" style="padding:3px 10px 5px;font-size:10px;font-weight:600;color:#94A3B8;background:#F8FAFD;border-top:1px solid #E8EDF5">${(pts||[]).length?`${pts.length} daño(s) marcado(s)`:'Sin daños marcados'}</div>
  </div>`;
}

// ── CSS ──
function injectCSS(){
  if(document.getElementById('fl-v9-css')) return;
  const s=document.createElement('style'); s.id='fl-v9-css';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

#flotilla-dashboard{display:none;margin-left:240px;min-height:100vh;background:#F0F2F5;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#0A0F1E;}
#flotilla-dashboard *{box-sizing:border-box;margin:0;padding:0;}

/* TOPBAR */
.fl-topbar{background:#0D1B2E;height:52px;display:flex;align-items:center;padding:0 20px;gap:4px;position:sticky;top:0;z-index:100;box-shadow:0 2px 16px rgba(0,0,0,.3);}
.fl-topbar-title{font-size:12px;font-weight:800;letter-spacing:-.2px;color:#fff;margin-right:10px;display:flex;align-items:center;gap:6px;white-space:nowrap;}
.fl-topbar-title em{color:#3B82F6;font-style:normal;}
.fl-topbar-sep{width:1px;height:20px;background:rgba(255,255,255,.15);margin:0 6px;}
.fl-tab{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:7px;border:none;background:transparent;color:rgba(255,255,255,.5);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;}
.fl-tab:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.85);}
.fl-tab.on{background:#2563EB;color:#fff;box-shadow:0 3px 10px rgba(37,99,235,.4);}
.fl-tab-cnt{background:rgba(255,255,255,.25);font-size:9px;font-weight:800;padding:1px 5px;border-radius:100px;margin-left:2px;}
.fl-tab.on .fl-tab-cnt{background:rgba(255,255,255,.3);}
.fl-topbar-r{margin-left:auto;display:flex;align-items:center;gap:8px;}
.fl-btn-new{display:inline-flex;align-items:center;gap:5px;padding:7px 16px;background:#2563EB;color:#fff;border:none;border-radius:7px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer;transition:all .15s;}
.fl-btn-new:hover{background:#1D4ED8;box-shadow:0 4px 12px rgba(37,99,235,.4);}

/* LAYOUT PRINCIPAL: sidebar izq + contenido */
.fl-layout{display:flex;min-height:calc(100vh - 52px);}

/* SIDEBAR VEHÍCULOS */
.fl-sb{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #E8EDF5;display:flex;flex-direction:column;height:calc(100vh - 52px);position:sticky;top:52px;}
.fl-sb-head{padding:12px 14px 10px;border-bottom:1px solid #E8EDF5;}
.fl-sb-head-t{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:8px;}
.fl-sb-search{position:relative;}
.fl-sb-search input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:12px;outline:none;color:#0A0F1E;background:#F8FAFD;transition:all .15s;}
.fl-sb-search input:focus{border-color:#2563EB;background:#fff;}
.fl-sb-search svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;}
.fl-sb-list{flex:1;overflow-y:auto;padding:6px;}
.fl-sb-item{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:7px;cursor:pointer;transition:all .1s;}
.fl-sb-item:hover{background:#F1F5F9;}
.fl-sb-item.on{background:#EFF6FF;border-left:3px solid #2563EB;}
.fl-sb-item.on .fl-sb-eco{color:#2563EB;}
.fl-sb-eco{font-size:11px;font-weight:800;font-family:'JetBrains Mono',monospace;color:#374151;min-width:22px;}
.fl-sb-name{font-size:11px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}
.fl-sb-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.fl-sb-stats{padding:10px 14px;border-top:1px solid #E8EDF5;display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.fl-sb-stat{text-align:center;}
.fl-sb-stat-v{font-size:18px;font-weight:900;font-family:'JetBrains Mono',monospace;line-height:1;}
.fl-sb-stat-l{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-top:2px;}

/* CONTENIDO PRINCIPAL */
.fl-main{flex:1;min-width:0;display:flex;flex-direction:column;}
.fl-pad{padding:20px 22px;}

/* PANEL INFO VEHÍCULO — aparece al seleccionar, encima del contenido */
.fl-veh-panel{background:#0D1B2E;color:#fff;padding:16px 22px;display:none;border-bottom:1px solid rgba(255,255,255,.06);}
.fl-veh-panel.vis{display:block;}
.fl-veh-panel-inner{display:grid;grid-template-columns:auto 1fr auto;gap:20px;align-items:center;max-width:900px;}
.fl-veh-emo{font-size:48px;line-height:1;}
.fl-veh-name{font-size:18px;font-weight:900;letter-spacing:-.4px;line-height:1.1;}
.fl-veh-sub{font-size:11px;color:rgba(255,255,255,.45);margin-top:4px;font-family:'JetBrains Mono',monospace;}
.fl-veh-data{display:grid;grid-template-columns:repeat(4,auto);gap:0 28px;}
.fl-veh-d dt{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.35);margin-bottom:3px;}
.fl-veh-d dd{font-size:13px;font-weight:700;color:#fff;font-family:'JetBrains Mono',monospace;}
.fl-veh-d dd.big{font-size:22px;font-weight:900;letter-spacing:-.5px;}

/* KPIs */
.fl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
.fl-kpi{background:#fff;border-radius:12px;padding:16px 18px;border:1px solid #E8EDF5;box-shadow:0 1px 3px rgba(10,22,40,.05);}
.fl-kpi-l{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:8px;display:flex;align-items:center;gap:5px;}
.fl-kpi-v{font-size:30px;font-weight:900;letter-spacing:-1.5px;line-height:1;font-family:'JetBrains Mono',monospace;}
.fl-kpi-s{font-size:10.5px;color:#94A3B8;margin-top:4px;}

/* TABLA */
.fl-tw{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(10,22,40,.05);}
.fl-t{width:100%;border-collapse:collapse;font-size:12.5px;}
.fl-t th{background:#F8FAFD;padding:9px 14px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;border-bottom:1px solid #E8EDF5;}
.fl-t td{padding:11px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.fl-t tr:last-child td{border-bottom:none;}
.fl-t tr:hover td{background:#F8FAFD;cursor:pointer;}
.fl-mono{font-family:'JetBrains Mono',monospace;font-size:11px;}

/* CHECKLIST TABLE */
.fl-chk-t{width:100%;border-collapse:collapse;font-size:12px;}
.fl-chk-t th{background:#0D1B2E;color:rgba(255,255,255,.6);padding:8px 12px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;}
.fl-chk-t td{padding:9px 12px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.fl-chk-t tr:last-child td{border-bottom:none;}
.fl-chk-t tr:hover td{background:#F8FAFD;}
.fl-chk-grp{background:#F8FAFD;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;}
.fl-chk-btn{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:5px;border:1.5px solid #E2E8F0;font-size:10.5px;font-weight:700;cursor:pointer;transition:all .12s;font-family:inherit;background:#fff;color:#64748B;min-width:36px;}
.fl-chk-btn:hover{border-color:#2563EB;color:#2563EB;}
.fl-chk-btn.ok{background:#DCFCE7;border-color:#86EFAC;color:#15803D;}
.fl-chk-btn.no{background:#FEE2E2;border-color:#FCA5A5;color:#B91C1C;}

/* SELECTOR CARRO/TROCA */
.fl-tipo-wrap{display:flex;gap:10px;margin-bottom:14px;}
.fl-tipo-opt{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 18px;border-radius:9px;border:2px solid #E2E8F0;background:#fff;cursor:pointer;transition:all .15s;font-family:inherit;}
.fl-tipo-opt:hover{border-color:#93C5FD;}
.fl-tipo-opt.on{border-color:#2563EB;background:#EFF6FF;}
.fl-tipo-opt span{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;}
.fl-tipo-opt.on span{color:#2563EB;}

/* ALERTS */
.fl-alerts{display:flex;flex-direction:column;gap:6px;margin-bottom:18px;}
.fl-alert-w{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:8px;font-size:11.5px;font-weight:500;background:#FFFBEB;color:#92400E;border:1px solid #FDE68A;}
.fl-alert-e{display:flex;align-items:center;gap:7px;padding:9px 13px;border-radius:8px;font-size:11.5px;font-weight:500;background:#FEF2F2;color:#991B1B;border:1px solid #FECACA;}

/* FILTROS */
.fl-filters{display:flex;gap:9px;margin-bottom:16px;align-items:center;flex-wrap:wrap;}
.fl-fsearch{position:relative;flex:1;min-width:180px;}
.fl-fsearch input{width:100%;padding:8px 12px 8px 30px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;background:#fff;outline:none;transition:all .15s;}
.fl-fsearch input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-fsearch svg{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;}
.fl-fsel{padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;background:#fff;outline:none;cursor:pointer;}
.fl-fsel:focus{border-color:#2563EB;}

/* MODAL */
.fl-ov{position:fixed;inset:0;background:rgba(10,15,30,.72);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);animation:flFi .15s ease;}
@keyframes flFi{from{opacity:0}to{opacity:1}}
.fl-modal{background:#fff;border-radius:16px;width:100%;max-width:700px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.3);animation:flSl .2s cubic-bezier(.4,0,.2,1);}
@keyframes flSl{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.fl-mh{padding:18px 20px 14px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9;position:sticky;top:0;background:#fff;z-index:2;}
.fl-mh h3{font-size:15px;font-weight:800;letter-spacing:-.3px;}
.fl-mx{width:26px;height:26px;border:none;background:#F1F5F9;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;}
.fl-mx:hover{background:#E2E8F0;}
.fl-mb{padding:16px 20px 20px;}

/* FORM */
.fl-form{display:flex;flex-direction:column;gap:12px;}
.fl-fld{display:flex;flex-direction:column;gap:4px;}
.fl-fld label{font-size:9.5px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;}
.fl-fld input,.fl-fld select,.fl-fld textarea{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;color:#0A0F1E;background:#F8FAFD;outline:none;transition:all .15s;width:100%;}
.fl-fld input:focus,.fl-fld select:focus,.fl-fld textarea:focus{border-color:#2563EB;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-fld textarea{min-height:72px;resize:vertical;}
.fl-fr{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.fl-fa{display:flex;justify-content:flex-end;gap:8px;padding-top:12px;border-top:1px solid #F1F5F9;margin-top:4px;}
.fl-info-box{background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:8px;padding:9px 12px;font-size:12px;font-weight:700;color:#1D4ED8;display:flex;align-items:center;gap:6px;}
.fl-sep{height:1px;background:#F1F5F9;margin:6px 0;}

/* BOTONES */
.fb{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:7px;padding:8px 15px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
.fb.acc{background:#2563EB;color:#fff;}
.fb.acc:hover{background:#1D4ED8;}
.fb.gho{background:#fff;color:#374151;border:1.5px solid #E2E8F0;}
.fb.gho:hover{background:#F8FAFD;}
.fb.dan{background:#FEF2F2;color:#B91C1C;border:1.5px solid #FECACA;}
.fb.sm{padding:5px 10px;font-size:11px;}

/* UPLOAD */
.fl-up{border:2px dashed #CBD5E1;border-radius:8px;padding:10px 14px;text-align:center;cursor:pointer;color:#64748B;font-size:12px;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s;font-family:inherit;background:transparent;width:100%;}
.fl-up:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
.fl-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:100px;font-size:11px;font-weight:600;color:#374151;cursor:pointer;}
.fl-pill:hover{background:#EFF6FF;color:#2563EB;}

/* ESTADOS VACÍOS */
.fl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;gap:6px;color:#64748B;text-align:center;padding:30px;}
.fl-empty-ico{font-size:42px;opacity:.2;margin-bottom:8px;}
.fl-empty h3{font-size:14px;font-weight:700;color:#0A0F1E;}
.fl-empty p{font-size:12px;max-width:260px;line-height:1.5;}
.fl-spin{width:17px;height:17px;border:2px solid #E2E8F0;border-top-color:#2563EB;border-radius:50%;animation:flSp .7s linear infinite;display:inline-block;}
@keyframes flSp{to{transform:rotate(360deg)}}

/* COMISIÓN CARDS */
.fl-comcard{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(10,22,40,.05);cursor:pointer;transition:all .15s;}
.fl-comcard:hover{border-color:#93C5FD;box-shadow:0 4px 14px rgba(37,99,235,.08);}
.fl-comcard-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #F1F5F9;}
.fl-comcard-b{padding:12px 16px;}

/* PANEL DETALLES SOLICITUD (layout 2 col) */
.fl-sol-layout{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start;}

@media(max-width:1100px){
  .fl-sol-layout{grid-template-columns:1fr;}
  .fl-veh-data{grid-template-columns:1fr 1fr;}
  .fl-kpis{grid-template-columns:1fr 1fr;}
}
@media(max-width:800px){
  #flotilla-dashboard{margin-left:0;}
  .fl-sb{display:none;}
  .fl-fr{grid-template-columns:1fr;}
  .fl-kpis{grid-template-columns:1fr 1fr;}
}
`;
  document.head.appendChild(s);
}

// ── HTML BASE ──
function buildHTML(){
  const el=document.getElementById('flotilla-dashboard');
  if(!el) return;
  el.innerHTML=`
  <div class="fl-topbar">
    <div class="fl-topbar-title">${I.truck} FLOTILLA <em>TECNOCONTROL</em></div>
    <div class="fl-topbar-sep"></div>
    <button class="fl-tab on"  id="fl-tab-panel"  onclick="flVista('panel')">${I.grid} Panel general</button>
    <button class="fl-tab"     id="fl-tab-sols"   onclick="flVista('sols')">${I.wrench} Solicitudes<span class="fl-tab-cnt" id="fl-cnt-s" style="display:none">0</span></button>
    <button class="fl-tab"     id="fl-tab-comis"  onclick="flVista('comis')">${I.road} Comisiones</button>
    <button class="fl-tab"     id="fl-tab-bajas"  onclick="flVista('bajas')">${I.archive} Vehículos de baja</button>
    <div class="fl-topbar-r">
      <button class="fl-btn-new" id="fl-btn-nueva" onclick="flAbrirSol()">${I.plus} Nueva solicitud</button>
    </div>
  </div>
  <div class="fl-layout">
    <!-- SIDEBAR VEHÍCULOS -->
    <div class="fl-sb" id="fl-sidebar">
      <div class="fl-sb-head">
        <div class="fl-sb-head-t">Flota activa</div>
        <div class="fl-sb-search">${I.search}<input type="text" placeholder="Buscar unidad…" id="fl-sb-q" oninput="flSbFiltrar()"></div>
      </div>
      <div class="fl-sb-list" id="fl-sb-list"></div>
      <div class="fl-sb-stats" id="fl-sb-stats"></div>
    </div>
    <!-- ÁREA PRINCIPAL -->
    <div class="fl-main" id="fl-main">
      <!-- PANEL INFO VEHÍCULO -->
      <div class="fl-veh-panel" id="fl-veh-panel">
        <div class="fl-veh-panel-inner">
          <div class="fl-veh-emo" id="fl-vp-emo">🚗</div>
          <div>
            <div class="fl-veh-name" id="fl-vp-name">—</div>
            <div class="fl-veh-sub" id="fl-vp-sub">—</div>
          </div>
          <div class="fl-veh-data" id="fl-vp-data"></div>
        </div>
      </div>
      <!-- CONTENIDO DE VISTA -->
      <div class="fl-pad" id="fl-body">
        <div class="fl-empty"><div class="fl-spin"></div></div>
      </div>
    </div>
  </div>`;
}

// ── INIT ──
window.cargarFlotilla=async function(){
  injectCSS(); buildHTML();
  await Promise.all([loadVehs(),loadSols(),loadComis()]);
  renderSidebar();
  flVista('panel');
};

async function loadVehs(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.VEHS));
    flV=snap.size>0?snap.docs.map(d=>({id:d.id,...d.data()})):CAT.map(v=>({id:'eco-'+v.eco,status:'activo',km:0,...v}));
  }catch{flV=CAT.map(v=>({id:'eco-'+v.eco,status:'activo',km:0,...v}));}
}
async function loadSols(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.SOLS));
    flS=snap.docs.map(d=>({id:d.id,...d.data()}));
    flS.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
  }catch{flS=[];}
  const p=flS.filter(s=>['Solicitud','Validada'].includes(s.estatus)).length;
  const c=document.getElementById('fl-cnt-s');
  if(c){c.textContent=p;c.style.display=p?'':'none';}
}
async function loadComis(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.COMIS));
    flCom=snap.docs.map(d=>({id:d.id,...d.data()}));
  }catch{flCom=[];}
}

// ── SIDEBAR ──
function renderSidebar(){
  const act=flV.filter(v=>v.status!=='baja');
  const tall=act.filter(v=>v.status==='taller').length;
  const com=act.filter(v=>v.status==='comision').length;
  const lista=document.getElementById('fl-sb-list');
  const stats=document.getElementById('fl-sb-stats');
  if(!lista) return;
  lista.innerHTML=act.map(v=>{
    const dot=v.status==='taller'?'#F59E0B':v.status==='comision'?'#8B5CF6':'#22C55E';
    return`<div class="fl-sb-item" id="fl-sbi-${v.id}" onclick="flSbSel('${v.id}')">
      <div class="fl-sb-eco">${v.eco}</div>
      <div class="fl-sb-name">${v.unidad||'—'}</div>
      <div class="fl-sb-dot" style="background:${dot}"></div>
    </div>`;
  }).join('');
  if(stats) stats.innerHTML=`
    <div class="fl-sb-stat"><div class="fl-sb-stat-v" style="color:#22C55E">${act.length-tall-com}</div><div class="fl-sb-stat-l">Activos</div></div>
    <div class="fl-sb-stat"><div class="fl-sb-stat-v" style="color:#F59E0B">${tall+com}</div><div class="fl-sb-stat-l">En servicio</div></div>`;
}

window.flSbFiltrar=function(){
  const q=(document.getElementById('fl-sb-q')?.value||'').toLowerCase();
  document.querySelectorAll('.fl-sb-item').forEach(el=>{
    const txt=el.textContent.toLowerCase();
    el.style.display=txt.includes(q)?'':'none';
  });
};

let sbSelId=null;
window.flSbSel=function(id){
  sbSelId=id;
  document.querySelectorAll('.fl-sb-item').forEach(e=>e.classList.remove('on'));
  document.getElementById('fl-sbi-'+id)?.classList.add('on');
  const v=flV.find(x=>x.id===id);
  const panel=document.getElementById('fl-veh-panel');
  if(!v||!panel){if(panel)panel.classList.remove('vis');return;}
  // Llenar panel
  document.getElementById('fl-vp-emo').textContent=hEmo(v.tipo);
  document.getElementById('fl-vp-name').textContent=`${v.unidad||'—'} ${v.año||''}`;
  document.getElementById('fl-vp-sub').textContent=`ECO ${v.eco}  ·  ${v.placas||'—'}  ·  ${v.serie||'—'}`;
  document.getElementById('fl-vp-data').innerHTML=`
    <dl class="fl-veh-d"><dt>Responsable</dt><dd>${v.responsable||'—'}</dd></dl>
    <dl class="fl-veh-d"><dt>Plaza</dt><dd>${v.plaza||'—'}</dd></dl>
    <dl class="fl-veh-d"><dt>Póliza seg.</dt><dd>${v.pol||'—'}</dd></dl>
    <dl class="fl-veh-d"><dt>Vto. póliza</dt><dd style="color:${hD(v.pv)!==null&&hD(v.pv)<90?'#EF4444':'#4ADE80'}">${hF(v.pv)}</dd></dl>`;
  panel.classList.add('vis');
  // Filtrar solicitudes de este vehículo si estamos en esa vista
  if(vistaAct==='sols') renderSolsConVeh(v);
};

// ── NAVEGACIÓN ──
window.flVista=function(v){
  vistaAct=v;
  document.querySelectorAll('.fl-tab').forEach(b=>b.classList.remove('on'));
  document.getElementById('fl-tab-'+v)?.classList.add('on');
  if(v==='panel') renderPanel();
  else if(v==='sols') renderSols();
  else if(v==='comis') renderComis();
  else if(v==='bajas') renderBajas();
};
function setBody(h){const b=document.getElementById('fl-body');if(b)b.innerHTML=h;}

// ══════════════════════════════════
// PANEL GENERAL
// ══════════════════════════════════
function renderPanel(){
  const act=flV.filter(v=>v.status==='activo'||!v.status).length;
  const tall=flV.filter(v=>v.status==='taller').length;
  const com=flV.filter(v=>v.status==='comision').length;
  const baj=flV.filter(v=>v.status==='baja').length;
  const pend=flS.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus)).length;
  const alts=[];
  flV.forEach(v=>{const d=hD(v.pv);if(d!==null&&d<90)alts.push({e:d<0,t:`ECO ${v.eco} — Póliza ${d<0?'VENCIDA':'vence en '+d+' días'}`});});
  const porEst={Solicitud:0,Validada:0,Cotización:0,Aprobada:0,Rechazada:0,Cerrada:0};
  flS.forEach(s=>{if(s.estatus in porEst)porEst[s.estatus]++;});
  const porTipo={};
  flS.forEach(s=>{const t=s.tipo||'Otro';porTipo[t]=(porTipo[t]||0)+1;});
  const top=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mx=top[0]?.[1]||1;
  setBody(`
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:18px">
      <div>
        <div style="font-size:20px;font-weight:900;letter-spacing:-.5px">Panel General · Flotilla</div>
        <div style="font-size:11.5px;color:#64748B;margin-top:3px">${flV.filter(v=>v.status!=='baja').length} unidades activas · ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>
    ${alts.length?`<div class="fl-alerts">${alts.slice(0,4).map(a=>`<div class="fl-alert-${a.e?'e':'w'}">${I.alert} ${a.t}</div>`).join('')}</div>`:''}
    <div class="fl-kpis">
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.truck} Total flotilla</div>
        <div class="fl-kpi-v">${flV.length}</div>
        <div class="fl-kpi-s">unidades registradas · <strong>${baj}</strong> de baja</div>
      </div>
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.check} En operación</div>
        <div class="fl-kpi-v" style="color:#16A34A">${act}</div>
        <div class="fl-kpi-s">activas hoy</div>
      </div>
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.wrench} En taller / comisión</div>
        <div class="fl-kpi-v" style="color:#D97706">${tall+com}</div>
        <div class="fl-kpi-s">${tall} en taller · ${com} en comisión</div>
      </div>
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.alert} Solicitudes activas</div>
        <div class="fl-kpi-v" style="color:#7C3AED">${pend}</div>
        <div class="fl-kpi-s">en proceso de atención</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="fl-tw">
        <div style="padding:12px 16px;border-bottom:1px solid #F1F5F9;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Solicitudes por tipo</div>
        <div style="padding:14px 16px">
          ${top.length?top.map(([t,n])=>`
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:4px"><span>${t}</span><span style="color:#64748B">${n}</span></div>
              <div style="height:5px;background:#F1F5F9;border-radius:100px;overflow:hidden"><div style="height:100%;width:${Math.round(n/mx*100)}%;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:100px"></div></div>
            </div>`).join(''):`<div style="color:#94A3B8;font-size:12px;text-align:center;padding:20px 0">Sin solicitudes</div>`}
        </div>
      </div>
      <div class="fl-tw">
        <div style="padding:12px 16px;border-bottom:1px solid #F1F5F9;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Flujo de solicitudes</div>
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:9px">
          ${Object.entries(porEst).map(([e,n])=>`
            <div style="display:flex;align-items:center;gap:10px">
              ${hBadge(e)}
              <div style="flex:1;height:5px;background:#F1F5F9;border-radius:100px;overflow:hidden"><div style="height:100%;width:${flS.length?Math.round(n/flS.length*100):0}%;background:#2563EB;border-radius:100px"></div></div>
              <span style="font-size:11px;font-weight:700;min-width:18px;text-align:right">${n}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:10px">Solicitudes recientes</div>
    ${tabSols(flS.slice(0,8))}
  `);
}

// ══════════════════════════════════
// SOLICITUDES
// ══════════════════════════════════
function renderSols(){
  const v=sbSelId?flV.find(x=>x.id===sbSelId):null;
  renderSolsConVeh(v);
}
function renderSolsConVeh(vFiltro){
  const sols=vFiltro?flS.filter(s=>s.vehiculoEco===vFiltro.eco||s.vehiculoId===vFiltro.id):flS;
  setBody(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.4px">Solicitudes de servicio</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${vFiltro?`ECO ${vFiltro.eco} · ${vFiltro.unidad} — `:''} ${sols.length} registro(s)</div>
      </div>
      <button class="fb acc" onclick="flAbrirSol(${vFiltro?`'${vFiltro.eco}'`:''  })">${I.plus} Nueva solicitud</button>
    </div>
    <div class="fl-filters">
      <div class="fl-fsearch">${I.search}<input type="text" id="fl-sq" placeholder="Buscar tipo, unidad, solicitante…" oninput="flFSols()"></div>
      <select class="fl-fsel" id="fl-se" onchange="flFSols()">
        <option value="">Todos los estados</option>
        ${['Solicitud','Validada','Cotización','Aprobada','Rechazada','Cierre','Cerrada'].map(e=>`<option>${e}</option>`).join('')}
      </select>
    </div>
    <div id="fl-sols-r">${tabSols(sols,hP('aprobar'))}</div>
  `);
  // guardar lista filtrada para la función de filtro
  window._flSolsBuf=sols;
}

window.flFSols=function(){
  const q=(document.getElementById('fl-sq')?.value||'').toLowerCase();
  const est=document.getElementById('fl-se')?.value||'';
  let r=window._flSolsBuf||flS;
  if(q) r=r.filter(s=>(s.tipo||'').toLowerCase().includes(q)||(s.vehiculo||'').toLowerCase().includes(q)||(s.vehiculoEco||'').toLowerCase().includes(q)||(s.solicitante||'').toLowerCase().includes(q));
  if(est) r=r.filter(s=>s.estatus===est);
  document.getElementById('fl-sols-r').innerHTML=tabSols(r,hP('aprobar'));
};

function tabSols(list,pA){
  if(!list.length) return`<div class="fl-empty"><div class="fl-empty-ico">📋</div><h3>Sin solicitudes</h3><p>No hay registros que mostrar.</p></div>`;
  return`<div class="fl-tw"><table class="fl-t"><thead><tr>
    <th>Tipo de servicio</th><th>Unidad</th><th>Prioridad</th><th>Solicitante</th><th>Estado</th><th>Fecha</th>${pA?'<th></th>':''}
  </tr></thead><tbody>
  ${list.map(s=>`<tr onclick="flVerSol('${s.id}')">
    <td style="font-weight:700">${s.tipo||'—'}</td>
    <td class="fl-mono">${s.vehiculoEco||'—'}<span style="color:#94A3B8;font-size:10.5px"> · ${(s.vehiculo||'').split('·')[1]?.trim()||''}</span></td>
    <td>${s.prioridad?`<span style="font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:100px;background:${s.prioridad==='Urgente'?'#FEE2E2':s.prioridad==='Alta'?'#FEF3C7':'#F1F5F9'};color:${s.prioridad==='Urgente'?'#B91C1C':s.prioridad==='Alta'?'#B45309':'#475569'}">${s.prioridad}</span>`:'—'}</td>
    <td style="font-size:11.5px">${s.solicitante||'—'}</td>
    <td>${hBadge(s.estatus)}</td>
    <td style="font-size:10.5px;color:#94A3B8">${hF(s.creadoEn)}</td>
    ${pA?`<td onclick="event.stopPropagation()">
      ${(s.estatus==='Validada'||s.estatus==='Cotización')?`<div style="display:flex;gap:4px">
        <button class="fb acc sm" onclick="flAprobar('${s.id}')">${I.check}</button>
        <button class="fb dan sm" onclick="flRechazar('${s.id}')">${I.x}</button>
      </div>`:''}
    </td>`:''}
  </tr>`).join('')}</tbody></table></div>`;
}

// ══════════════════════════════════
// COMISIONES
// ══════════════════════════════════
function renderComis(){
  setBody(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.4px">Préstamos y Comisiones</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">Vehículos prestados a corto y largo plazo</div>
      </div>
      <button class="fb acc" onclick="flAbrirComis()">${I.plus} Registrar comisión</button>
    </div>
    <div class="fl-filters">
      <select class="fl-fsel" id="fl-ct" onchange="flFCom()"><option value="">Todos los tipos</option><option>Corto plazo</option><option>Largo plazo</option></select>
      <select class="fl-fsel" id="fl-ce" onchange="flFCom()"><option value="">Todos los estados</option><option>En préstamo</option><option>Devuelto</option></select>
    </div>
    <div id="fl-comis-r">${renderComLista(flCom)}</div>
  `);
}
window.flFCom=function(){
  const t=document.getElementById('fl-ct')?.value||'';
  const e=document.getElementById('fl-ce')?.value||'';
  let r=flCom;
  if(t) r=r.filter(c=>c.tipo===t);
  if(e) r=r.filter(c=>c.estatus===e);
  document.getElementById('fl-comis-r').innerHTML=renderComLista(r);
};
function renderComLista(list){
  if(!list.length) return`<div class="fl-empty"><div class="fl-empty-ico">🚗</div><h3>Sin comisiones</h3><p>Registra préstamos de vehículos.</p></div>`;
  return`<div style="display:flex;flex-direction:column;gap:10px">${list.map(c=>`
    <div class="fl-comcard" onclick="flVerComis('${c.id}')">
      <div class="fl-comcard-h">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:32px">${hEmo(flV.find(v=>v.eco===c.vehiculoEco)?.tipo||'auto')}</span>
          <div>
            <div style="font-size:14px;font-weight:800">ECO ${c.vehiculoEco||'—'} · ${c.vehiculo?.split('·')[1]?.trim()||c.vehiculo||'—'}</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">${c.tipo||'—'} · ${c.responsable||'—'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">${hBadge(c.estatus||'En préstamo')}</div>
      </div>
      <div class="fl-comcard-b" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${[['Fecha entrega',hF(c.fechaEntrega)],['Fecha regreso',c.fechaRegreso?hF(c.fechaRegreso):'—'],['KM entrega',c.kmEntrega||'—']].map(([l,v])=>`
        <dl><dt style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">${l}</dt><dd style="font-size:12.5px;font-weight:600">${v}</dd></dl>`).join('')}
      </div>
    </div>`).join('')}`;
}

// ══════════════════════════════════
// BAJAS
// ══════════════════════════════════
function renderBajas(){
  const bajas=flV.filter(v=>v.status==='baja');
  setBody(`
    <div style="margin-bottom:18px">
      <div style="font-size:18px;font-weight:900;letter-spacing:-.4px">Vehículos Dados de Baja</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">${bajas.length} unidades fuera de la flota activa</div>
    </div>
    ${!bajas.length?`<div class="fl-empty"><div class="fl-empty-ico">📦</div><h3>Sin vehículos de baja</h3><p>Todos los vehículos están en la flota activa.</p></div>`:
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
      ${bajas.map(v=>`
        <div style="background:#fff;border:1px solid #E8EDF5;border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:all .15s" onmouseenter="this.style.borderColor='#FCA5A5'" onmouseleave="this.style.borderColor='#E8EDF5'" onclick="flVerVeh('${v.id}')">
          <div style="width:44px;height:44px;border-radius:10px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${hEmo(v.tipo)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:800;font-family:'JetBrains Mono',monospace">ECO ${v.eco} <span style="font-size:10px;color:#94A3B8;font-weight:500">· ${v.placas||'—'}</span></div>
            <div style="font-size:12px;font-weight:600;color:#374151;margin-top:1px">${v.unidad||'—'} ${v.año||''}</div>
            <div style="font-size:10.5px;color:#94A3B8;margin-top:1px">${v.responsable||'—'} · ${v.plaza||'—'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8">Baja</div>
            <div style="font-size:11px;font-weight:600;color:#B91C1C;margin-top:2px">${hF(v.fechaBaja)||'—'}</div>
          </div>
        </div>`).join('')}
    </div>`}
  `);
}

// ══════════════════════════════════
// MODAL NUEVA SOLICITUD
// ══════════════════════════════════
window.flAbrirSol=function(ecoPresel){
  dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
  solEvidencias=[];
  tipoVehSel=ecoPresel?(['camion','camioneta'].includes(flV.find(v=>v.eco===ecoPresel)?.tipo)?'troca':'auto'):'auto';
  const vehs=flV.filter(v=>v.status!=='baja');
  const ov=document.createElement('div'); ov.className='fl-ov'; ov.id='fl-modal-sol';
  ov.innerHTML=`<div class="fl-modal" style="max-width:720px">
    <div class="fl-mh">
      <h3>${I.wrench} Nueva solicitud de servicio</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      <div class="fl-form">
        <!-- VEHÍCULO -->
        <div class="fl-fld">
          <label>Unidad / Vehículo</label>
          <select id="fl-sv" onchange="flSolVeh(this.value)">
            <option value="">— Selecciona una unidad —</option>
            ${vehs.map(v=>`<option value="${v.id}" ${ecoPresel===v.eco?'selected':''}>${v.eco}  ·  ${v.unidad||'—'}  ·  ${v.placas||'—'}  ·  ${v.responsable||'—'}</option>`).join('')}
          </select>
        </div>
        <!-- PANEL INFO VEH (solo al seleccionar) -->
        <div id="fl-svp" style="display:none">
          <div style="background:#0D1B2E;border-radius:10px;padding:12px 16px;color:#fff;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center" id="fl-svp-inner">
          </div>
        </div>
        <!-- TIPO + PRIORIDAD -->
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Tipo de solicitud</label>
            <select id="fl-sti" onchange="flSolTipo(this.value)">
              <option value="">— Selecciona —</option>
              ${TIPOS_SOL.map(t=>`<option>${t}</option>`).join('')}
              <option value="__c">Personalizado…</option>
            </select>
            <div id="fl-stic" style="display:none;margin-top:6px">
              <input type="text" id="fl-stic-v" placeholder="Describe el tipo de servicio…">
            </div>
          </div>
          <div class="fl-fld">
            <label>Prioridad</label>
            <select id="fl-spr"><option>Normal</option><option>Alta</option><option>Urgente</option></select>
          </div>
        </div>
        <!-- DESCRIPCIÓN -->
        <div class="fl-fld">
          <label>Descripción del problema</label>
          <textarea id="fl-sde" placeholder="Describe el problema, síntoma o servicio que se requiere…"></textarea>
        </div>
        <!-- KM + TALLER -->
        <div class="fl-fr">
          <div class="fl-fld"><label>Kilometraje actual</label><input type="number" id="fl-skm" placeholder="Ej. 85000"></div>
          <div class="fl-fld"><label>Taller / Proveedor sugerido</label><input type="text" id="fl-sta" placeholder="Nombre del taller"></div>
        </div>
        <!-- SELECTOR CARRO / TROCA -->
        <div>
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:9px">Tipo de unidad — diagrama de daños</div>
          <div class="fl-tipo-wrap">
            <button class="fl-tipo-opt ${tipoVehSel==='auto'?'on':''}" id="fl-ta" onclick="flSolTipoV('auto')">
              <svg width="54" height="26" viewBox="0 0 54 26" fill="none">
                <rect x="6" y="8" width="42" height="14" rx="4" fill="#CBD5E1"/>
                <rect x="10" y="3" width="26" height="10" rx="3" fill="#93C5FD"/>
                <circle cx="13" cy="22" r="4" fill="#374151"/>
                <circle cx="41" cy="22" r="4" fill="#374151"/>
              </svg>
              <span>Carro / Auto</span>
            </button>
            <button class="fl-tipo-opt ${tipoVehSel==='troca'?'on':''}" id="fl-tt" onclick="flSolTipoV('troca')">
              <svg width="62" height="26" viewBox="0 0 62 26" fill="none">
                <rect x="2" y="10" width="60" height="12" rx="3" fill="#CBD5E1"/>
                <rect x="6" y="4" width="20" height="10" rx="2" fill="#93C5FD"/>
                <rect x="26" y="6" width="30" height="8" rx="2" fill="#94A3B8"/>
                <circle cx="11" cy="22" r="4" fill="#374151"/>
                <circle cx="50" cy="22" r="4" fill="#374151"/>
              </svg>
              <span>Troca / Camioneta</span>
            </button>
          </div>
        </div>
        <!-- DIAGRAMA DE DAÑOS -->
        <div>
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:8px">
            ${I.alert} Marcar zonas dañadas <span style="font-size:10px;font-weight:400;color:#94A3B8;text-transform:none;letter-spacing:0">— clic en el diagrama para añadir punto</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="fl-dmg">
            ${dmgCard('frente',tipoVehSel,[],false)}
            ${dmgCard('trasera',tipoVehSel,[],false)}
            ${dmgCard('lateral_izq',tipoVehSel,[],false)}
            ${dmgCard('lateral_der',tipoVehSel,[],false)}
          </div>
        </div>
        <!-- EVIDENCIAS -->
        <div class="fl-fld">
          <label>${I.camera} Evidencias fotográficas</label>
          <label class="fl-up" onclick="document.getElementById('fl-sev').click()">${I.upload} Subir fotos (múltiple)</label>
          <input type="file" id="fl-sev" accept="image/*" multiple style="display:none" onchange="flSolEvs(this)">
          <div class="fl-pills" id="fl-sev-p"></div>
        </div>
        <div class="fl-info-box">${I.user} Solicitante: <strong>${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</strong></div>
        <div class="fl-fa">
          <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
          <button class="fb acc" id="fl-ssub" onclick="flGuardarSol()">${I.check} Crear solicitud</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  if(ecoPresel){const sel=document.getElementById('fl-sv');if(sel&&sel.value)flSolVeh(sel.value);}
};

window.flSolVeh=function(id){
  const p=document.getElementById('fl-svp');if(!p)return;
  if(!id){p.style.display='none';return;}
  const v=flV.find(x=>x.id===id);if(!v){p.style.display='none';return;}
  document.getElementById('fl-svp-inner').innerHTML=`
    <div style="font-size:40px;line-height:1">${hEmo(v.tipo)}</div>
    <div>
      <div style="font-size:15px;font-weight:800">${v.unidad||'—'} ${v.año||''}</div>
      <div style="font-size:10.5px;color:rgba(255,255,255,.45);font-family:'JetBrains Mono',monospace;margin-top:3px">ECO ${v.eco} · ${v.placas||'—'} · ${v.serie||'—'}</div>
      <div style="display:grid;grid-template-columns:repeat(4,auto);gap:0 20px;margin-top:10px">
        ${[['Responsable',v.responsable||'—'],['Plaza',v.plaza||'—'],['Póliza',v.pol||'—'],['Status',(v.status||'activo').toUpperCase()]].map(([l,val])=>`
        <dl><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.35);margin-bottom:3px">${l}</dt>
        <dd style="font-size:12px;font-weight:700;color:#fff;font-family:'JetBrains Mono',monospace">${val}</dd></dl>`).join('')}
      </div>
    </div>`;
  p.style.display='block';
  // Auto tipo vehículo
  const esGrande=['camion','camioneta'].includes(v.tipo);
  flSolTipoV(esGrande?'troca':'auto');
};

window.flSolTipo=function(val){
  const w=document.getElementById('fl-stic');if(w)w.style.display=val==='__c'?'block':'none';
  if(val==='__c')document.getElementById('fl-stic-v')?.focus();
};

window.flSolTipoV=function(t){
  tipoVehSel=t;
  document.getElementById('fl-ta')?.classList.toggle('on',t==='auto');
  document.getElementById('fl-tt')?.classList.toggle('on',t==='troca');
  const g=document.getElementById('fl-dmg');if(!g)return;
  g.innerHTML=dmgCard('frente',t,dmgPts.frente,false)+dmgCard('trasera',t,dmgPts.trasera,false)+dmgCard('lateral_izq',t,dmgPts.lateral_izq,false)+dmgCard('lateral_der',t,dmgPts.lateral_der,false);
};

window.flDmgClick=function(e,vista){
  const svg=document.getElementById('fl-ds-'+vista);if(!svg)return;
  const r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal;
  const x=((e.clientX-r.left)/r.width)*vb.width,y=((e.clientY-r.top)/r.height)*vb.height;
  (dmgPts[vista]||(dmgPts[vista]=[])).push({x:Math.round(x),y:Math.round(y)});
  const g=document.getElementById('fl-dp-'+vista);
  if(g)g.innerHTML=dmgPts[vista].map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="8" fill="#EF4444" stroke="#fff" stroke-width="2.5" opacity=".95"/><text x="${p.x}" y="${p.y+3.5}" text-anchor="middle" font-size="8" font-weight="800" fill="#fff" font-family="sans-serif">${i+1}</text>`).join('');
  const l=document.getElementById('fl-dpt-'+vista);if(l)l.textContent=`${dmgPts[vista].length} daño(s) marcado(s)`;
};
window.flDmgClear=function(vista){
  dmgPts[vista]=[];
  const g=document.getElementById('fl-dp-'+vista);if(g)g.innerHTML='';
  const l=document.getElementById('fl-dpt-'+vista);if(l)l.textContent='Sin daños marcados';
};
window.flSolEvs=function(inp){
  Array.from(inp.files).forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{
      solEvidencias.push(e.target.result);
      const p=document.getElementById('fl-sev-p');
      if(p)p.innerHTML=solEvidencias.map((b,i)=>`<span class="fl-pill" onclick="flImg('${b}')">${I.camera} Foto ${i+1}</span>`).join('');
    };r.readAsDataURL(f);
  });
};

window.flGuardarSol=async function(){
  const vId=document.getElementById('fl-sv')?.value;
  const tipoR=document.getElementById('fl-sti')?.value;
  const tipoC=document.getElementById('fl-stic-v')?.value?.trim();
  const tipo=tipoR==='__c'?(tipoC||'Personalizado'):tipoR;
  const desc=document.getElementById('fl-sde')?.value?.trim();
  const km=document.getElementById('fl-skm')?.value;
  const tall=document.getElementById('fl-sta')?.value?.trim();
  const prior=document.getElementById('fl-spr')?.value||'Normal';
  if(!vId){alert('Selecciona una unidad.');return;}
  if(!tipo){alert('Selecciona el tipo de solicitud.');return;}
  if(!desc){alert('Describe el problema.');return;}
  const v=flV.find(x=>x.id===vId);
  const doc={vehiculoId:vId,vehiculoEco:v?.eco||'',vehiculo:`${v?.eco} · ${v?.unidad||''}`,tipo,prioridad:prior,descripcion:desc,kilometrajeReportado:km||'',taller:tall||'',tipoUnidad:tipoVehSel,estatus:'Solicitud',solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',creadoPor:window.auth?.currentUser?.email||'',creadoEn:new Date().toISOString(),evidencias:solEvidencias,danos:JSON.parse(JSON.stringify(dmgPts))};
  const btn=document.getElementById('fl-ssub');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    await fs.addDoc(fs.collection(db,C.SOLS),doc);
    if(km&&v&&!v.id.startsWith('eco-'))await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{km:Number(km)}).catch(()=>{});
    solEvidencias=[];dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
    document.getElementById('fl-modal-sol')?.remove();
    await loadSols();flVista(vistaAct);
    if(window.mostrarPush)window.mostrarPush('Solicitud creada','En proceso de validación.','✓');
  }catch(e){console.error('[FL]',e);alert('Error: '+e.message);if(btn){btn.disabled=false;btn.textContent=`${I.check} Crear solicitud`;}}
};

// ══════════════════════════════════
// VER SOLICITUD
// ══════════════════════════════════
window.flVerSol=function(id){
  const s=flS.find(x=>x.id===id);if(!s)return;
  const v=flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId);
  const pV=hP('validar'),pA=hP('aprobar'),pC=hP('subir_cotizacion'),pE=hP('eliminar');
  const dan=s.danos||{};
  const hasDan=Object.values(dan).some(a=>a?.length>0);
  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal" style="max-width:720px">
    <div class="fl-mh">
      <h3>${I.doc} Solicitud · ${id.slice(0,8).toUpperCase()}</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      ${v?`<div style="background:#0D1B2E;color:#fff;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center">
        <div style="font-size:38px">${hEmo(v.tipo)}</div>
        <div>
          <div style="font-size:15px;font-weight:800">${v.unidad||'—'} ${v.año||''}</div>
          <div style="font-size:10px;color:rgba(255,255,255,.4);font-family:'JetBrains Mono',monospace;margin-top:3px">ECO ${v.eco} · ${v.placas||'—'} · ${v.responsable||'—'}</div>
        </div>
      </div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:10px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:12px">
        ${[['Tipo',s.tipo||'—'],['Estado',hBadge(s.estatus)],['Prioridad',s.prioridad||'Normal'],['Cotización',s.cotizacion||'—'],['Taller',s.taller||'—'],['KM reportado',s.kilometrajeReportado||'—'],['Solicitante',s.solicitante||'—'],['Fecha',hF(s.creadoEn)]].map(([l,val])=>`
        <dl style="padding:9px 12px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5">
          <dt style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">${l}</dt>
          <dd style="font-size:12.5px;font-weight:600">${val}</dd>
        </dl>`).join('')}
        <dl style="grid-column:1/-1;padding:9px 12px;border-bottom:1px solid #E8EDF5">
          <dt style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">Descripción</dt>
          <dd style="font-size:12.5px;font-weight:500">${s.descripcion||'—'}</dd>
        </dl>
      </div>
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:9px 12px;font-size:11.5px;color:#991B1B;margin-bottom:10px"><strong>Motivo rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
      ${hasDan?`<div class="fl-sep"></div>
        <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px">Diagrama de daños</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;pointer-events:none">
          ${dmgCard('frente',s.tipoUnidad||'auto',dan.frente||[],true)}
          ${dmgCard('trasera',s.tipoUnidad||'auto',dan.trasera||[],true)}
          ${dmgCard('lateral_izq',s.tipoUnidad||'auto',dan.lateral_izq||[],true)}
          ${dmgCard('lateral_der',s.tipoUnidad||'auto',dan.lateral_der||[],true)}
        </div>`:''}
      ${s.evidencias?.length?`<div class="fl-sep"></div>
        <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px">Evidencias (${s.evidencias.length})</div>
        <div class="fl-pills">${s.evidencias.map((e,i)=>`<span class="fl-pill" onclick="flImg('${e}')">${I.camera} Foto ${i+1}</span>`).join('')}</div>`:''}
      <div class="fl-sep"></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${pV&&s.estatus==='Solicitud'?`<button class="fb acc" onclick="flEst('${s.id}','Validada');this.closest('.fl-ov').remove()">${I.check} Validar</button>`:''}
        ${(pV||pC)&&s.estatus==='Validada'?`<button class="fb gho" onclick="flCotizar('${s.id}')">Registrar cotización</button>`:''}
        ${pA&&(s.estatus==='Validada'||s.estatus==='Cotización')?`<button class="fb acc" onclick="flAprobar('${s.id}');this.closest('.fl-ov').remove()">${I.check} Aprobar</button><button class="fb dan" onclick="flRechazar('${s.id}');this.closest('.fl-ov').remove()">${I.x} Rechazar</button>`:''}
        ${pV&&s.estatus==='Aprobada'?`<button class="fb gho" onclick="flEst('${s.id}','Cierre');this.closest('.fl-ov').remove()">Enviar a cierre</button>`:''}
        ${pV&&s.estatus==='Cierre'?`<button class="fb gho" onclick="flEst('${s.id}','Cerrada');this.closest('.fl-ov').remove()">Marcar cerrada</button>`:''}
        ${pE?`<button class="fb dan" style="margin-left:auto" onclick="flElim('${s.id}');this.closest('.fl-ov').remove()">${I.trash} Eliminar</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ══════════════════════════════════
// COMISIÓN — MODAL
// ══════════════════════════════════
window.flAbrirComis=function(){
  comEvidEntrega=[];comEvidRecepcion=[];
  const vehs=flV.filter(v=>!v.status||v.status==='activo');
  const ov=document.createElement('div');ov.className='fl-ov';ov.id='fl-modal-com';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>${I.road} Registrar préstamo / comisión</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb"><div class="fl-form">
      <div class="fl-fld"><label>Vehículo</label>
        <select id="fl-cv"><option value="">— Selecciona —</option>
          ${vehs.map(v=>`<option value="${v.id}" data-eco="${v.eco}">${v.eco} · ${v.unidad||'—'} · ${v.placas||'—'}</option>`).join('')}
        </select>
      </div>
      <div class="fl-fr">
        <div class="fl-fld"><label>Responsable del préstamo</label><input type="text" id="fl-cre" placeholder="Nombre completo"></div>
        <div class="fl-fld"><label>Tipo</label><select id="fl-cti"><option>Corto plazo</option><option>Largo plazo</option></select></div>
      </div>
      <div class="fl-fld"><label>Motivo / Destino</label><textarea id="fl-cmo" placeholder="Motivo del préstamo y destino…" style="min-height:60px"></textarea></div>
      <div class="fl-fr">
        <div class="fl-fld"><label>Fecha de entrega</label><input type="date" id="fl-cfe" value="${new Date().toISOString().slice(0,10)}"></div>
        <div class="fl-fld"><label>Fecha estimada de regreso</label><input type="date" id="fl-cfr"></div>
      </div>
      <div class="fl-fr">
        <div class="fl-fld"><label>KM al entregar</label><input type="number" id="fl-ckm" placeholder="Kilometraje"></div>
        <div class="fl-fld"><label>Nivel de gasolina</label>
          <select id="fl-cga"><option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Vacío</option></select>
        </div>
      </div>
      <div class="fl-fld">
        <label>${I.camera} Evidencias al entregar</label>
        <label class="fl-up" onclick="document.getElementById('fl-cevi').click()">${I.upload} Fotos del vehículo al entregar</label>
        <input type="file" id="fl-cevi" accept="image/*" multiple style="display:none" onchange="flComEv(this,'e')">
        <div class="fl-pills" id="fl-cep"></div>
      </div>
      <div class="fl-info-box">${I.user} Registrado por: <strong>${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</strong></div>
      <div class="fl-fa">
        <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
        <button class="fb acc" onclick="flGuardarCom()">${I.check} Registrar comisión</button>
      </div>
    </div></div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flComEv=function(inp,tipo){
  Array.from(inp.files).forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{
      if(tipo==='e')comEvidEntrega.push(e.target.result);
      else comEvidRecepcion.push(e.target.result);
      const pid=tipo==='e'?'fl-cep':'fl-crp';
      const arr=tipo==='e'?comEvidEntrega:comEvidRecepcion;
      const p=document.getElementById(pid);
      if(p)p.innerHTML=arr.map((b,i)=>`<span class="fl-pill" onclick="flImg('${b}')">${I.camera} Foto ${i+1}</span>`).join('');
    };r.readAsDataURL(f);
  });
};

window.flGuardarCom=async function(){
  const sel=document.getElementById('fl-cv');
  const vId=sel?.value;
  const resp=document.getElementById('fl-cre')?.value?.trim();
  const mot=document.getElementById('fl-cmo')?.value?.trim();
  const fent=document.getElementById('fl-cfe')?.value;
  const freg=document.getElementById('fl-cfr')?.value;
  const km=document.getElementById('fl-ckm')?.value;
  const gas=document.getElementById('fl-cga')?.value;
  const tipo=document.getElementById('fl-cti')?.value;
  if(!vId){alert('Selecciona un vehículo.');return;}
  if(!resp){alert('Ingresa el responsable.');return;}
  if(!fent){alert('Ingresa fecha de entrega.');return;}
  const v=flV.find(x=>x.id===vId);
  const eco=sel.options[sel.selectedIndex]?.dataset?.eco||v?.eco||'';
  const doc={vehiculoId:vId,vehiculoEco:eco,vehiculo:`${eco} · ${v?.unidad||''}`,responsable:resp,tipo,motivo:mot||'',estatus:'En préstamo',fechaEntrega:fent,fechaRegreso:freg||'',kmEntrega:km||'',gasolinaEntrega:gas,evidenciasEntrega:comEvidEntrega,evidenciasRecepcion:[],registradoPor:window.auth?.currentUser?.email||'',creadoEn:new Date().toISOString()};
  try{
    await fs.addDoc(fs.collection(db,C.COMIS),doc);
    if(v&&!v.id.startsWith('eco-'))await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{status:'comision',km:Number(km)||v.km||0}).catch(()=>{});
    comEvidEntrega=[];document.getElementById('fl-modal-com')?.remove();
    await loadComis();flVista('comis');
    if(window.mostrarPush)window.mostrarPush('Comisión registrada','','✓');
  }catch(e){console.error('[FL]',e);alert('Error: '+e.message);}
};

window.flVerComis=function(id){
  const c=flCom.find(x=>x.id===id);if(!c)return;
  const pA=hAdm();
  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>${I.road} Comisión · ${id.slice(0,8).toUpperCase()}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:10px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:12px">
        ${[['Vehículo',c.vehiculo||'—'],['Estado',hBadge(c.estatus)],['Responsable',c.responsable||'—'],['Tipo',c.tipo||'—'],['Fecha entrega',hF(c.fechaEntrega)],['Fecha regreso',c.fechaRegreso?hF(c.fechaRegreso):'Pendiente'],['KM entrega',c.kmEntrega||'—'],['KM recepción',c.kmRecepcion||'—'],['Gasolina entrega',c.gasolinaEntrega||'—'],['Gasolina recepción',c.gasolinaRecepcion||'—']].map(([l,val])=>`
        <dl style="padding:9px 12px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5">
          <dt style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">${l}</dt>
          <dd style="font-size:12.5px;font-weight:600">${val}</dd>
        </dl>`).join('')}
        <dl style="grid-column:1/-1;padding:9px 12px">
          <dt style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">Motivo / Destino</dt>
          <dd style="font-size:12.5px;font-weight:500">${c.motivo||'—'}</dd>
        </dl>
      </div>
      ${c.evidenciasEntrega?.length?`<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Evidencias entrega</div>
        <div class="fl-pills" style="margin-bottom:12px">${c.evidenciasEntrega.map((e,i)=>`<span class="fl-pill" onclick="flImg('${e}')">${I.camera} Foto ${i+1}</span>`).join('')}</div>`:''}
      ${pA&&c.estatus==='En préstamo'?`<div class="fl-sep"></div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:10px">Registrar devolución</div>
        <div class="fl-fr">
          <div class="fl-fld"><label>KM al recibir</label><input type="number" id="fl-rkm" placeholder="Kilometraje"></div>
          <div class="fl-fld"><label>Gasolina al recibir</label><select id="fl-rga"><option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Vacío</option></select></div>
        </div>
        <div class="fl-fld" style="margin-top:10px">
          <label>${I.camera} Evidencias recepción</label>
          <label class="fl-up" onclick="document.getElementById('fl-revi').click()">${I.upload} Fotos al recibir</label>
          <input type="file" id="fl-revi" accept="image/*" multiple style="display:none" onchange="flComEv(this,'r')">
          <div class="fl-pills" id="fl-crp"></div>
        </div>
        <div class="fl-fa">
          <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
          <button class="fb acc" onclick="flCerrarCom('${c.id}')">${I.check} Registrar devolución</button>
        </div>`:`<div class="fl-fa"><button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button></div>`}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flCerrarCom=async function(id){
  const km=document.getElementById('fl-rkm')?.value;
  const gas=document.getElementById('fl-rga')?.value||'—';
  try{
    await fs.updateDoc(fs.doc(db,C.COMIS,id),{estatus:'Devuelto',kmRecepcion:km||'',gasolinaRecepcion:gas,evidenciasRecepcion:comEvidRecepcion,fechaDevolucion:new Date().toISOString()});
    const c=flCom.find(x=>x.id===id);
    if(c){const v=flV.find(x=>x.id===c.vehiculoId);if(v&&!v.id.startsWith('eco-')){await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{status:'activo',km:Number(km)||v.km}).catch(()=>{});v.status='activo';}}
    comEvidRecepcion=[];document.querySelector('.fl-ov')?.remove();
    await loadComis();flVista('comis');
    if(window.mostrarPush)window.mostrarPush('Vehículo devuelto','Comisión cerrada.','✓');
  }catch(e){console.error('[FL]',e);alert('Error: '+e.message);}
};

// ── VER VEHÍCULO (baja) ──
window.flVerVeh=function(id){
  const v=flV.find(x=>x.id===id);if(!v)return;
  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>${hEmo(v.tipo)} ECO ${v.eco} · ${v.unidad||'—'}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:10px;overflow:hidden;border:1px solid #E8EDF5">
        ${[['Placas',v.placas||'—'],['Año',v.año||'—'],['Serie',v.serie||'—'],['Color',v.color||'—'],['Plaza',v.plaza||'—'],['Responsable',v.responsable||'—'],['Último KM',v.km||'—'],['Fecha de baja',hF(v.fechaBaja)||'—'],['Motivo de baja',v.motivoBaja||'—']].map(([l,val],i,arr)=>`
        <dl style="padding:9px 12px;border-right:1px solid #E8EDF5;border-bottom:${i<arr.length-1?'1px solid #E8EDF5':'none'};${l==='Motivo de baja'?'grid-column:1/-1':''}">
          <dt style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">${l}</dt>
          <dd style="font-size:12.5px;font-weight:600">${val}</dd>
        </dl>`).join('')}
      </div>
      <div class="fl-fa">
        <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
        ${hAdm()?`<button class="fb acc" onclick="flReact('${v.id}');this.closest('.fl-ov').remove()">Reactivar vehículo</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flReact=async function(id){
  if(!confirm('¿Reactivar este vehículo a la flota activa?'))return;
  try{await fs.updateDoc(fs.doc(db,C.VEHS,id),{status:'activo',fechaBaja:'',motivoBaja:''});const v=flV.find(x=>x.id===id);if(v)v.status='activo';flVista('bajas');}catch(e){console.error('[FL]',e);}
};

// ── ACCIONES ──
window.flEst=async(id,est)=>{try{await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:est,actualizadoEn:new Date().toISOString()});await loadSols();flVista(vistaAct);}catch(e){console.error('[FL]',e);}};
window.flAprobar=id=>flEst(id,'Aprobada');
window.flRechazar=async id=>{const m=prompt('Motivo del rechazo:');if(!m?.trim())return;try{await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:'Rechazada',comentarioRechazo:m,actualizadoEn:new Date().toISOString()});await loadSols();flVista(vistaAct);}catch(e){console.error('[FL]',e);}};
window.flElim=async id=>{if(!confirm('¿Eliminar solicitud permanentemente?'))return;try{await fs.deleteDoc(fs.doc(db,C.SOLS,id));await loadSols();flVista(vistaAct);}catch(e){console.error('[FL]',e);}};
window.flCotizar=id=>{const s=flS.find(x=>x.id===id);const m=prompt('Monto cotización:',s?.cotizacion||'');if(m===null)return;const t=prompt('Taller/Proveedor:',s?.taller||'');if(t===null)return;fs.updateDoc(fs.doc(db,C.SOLS,id),{cotizacion:m,taller:t,estatus:'Cotización',actualizadoEn:new Date().toISOString()}).then(async()=>{await loadSols();document.querySelector('.fl-ov')?.remove();flVista(vistaAct);});};
window.flImg=src=>{const ov=document.createElement('div');ov.className='fl-ov';ov.style.cursor='zoom-out';ov.innerHTML=`<img src="${src}" style="max-width:92%;max-height:92%;border-radius:12px;box-shadow:0 24px 64px rgba(0,0,0,.5)">`;ov.onclick=()=>ov.remove();document.body.appendChild(ov);};

console.log('[FLOTILLA v9] '+CAT.length+' unidades · Tecnocontrol');
})();
