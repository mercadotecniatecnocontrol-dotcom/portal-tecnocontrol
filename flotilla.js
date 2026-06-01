// ══════════════════════════════════════════════════════════════
// flotilla.js v7 — Gestión Vehicular Tecnocontrol
// Design: Car Rental App · Vehicle Analysis · Corporate Blue
// ══════════════════════════════════════════════════════════════
(function () {
'use strict';

const C = { VEHS:'flotilla_vehiculos', SOLS:'flotilla_solicitudes', INSP:'flotilla_inspecciones', COMIS:'flotilla_comisiones' };

const CAT = [
  {eco:'15',unidad:'NISSAN NP300',       año:2017,plaza:'JUAREZ',    responsable:'JORGE GUERRERO',   placas:'DU6478A',serie:'3N6AD33A3HK869708',rend:'7 KM/L',   pv:'2026-09-24',pol:'794B05035M-17',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'16',unidad:'GRUA F-350',         año:2010,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6497A',serie:'1FDEF3G59AEB23674', rend:'5 KM/L',   pv:'2026-09-24',pol:'794B05035M-10',tipo:'camion',   color:'Blanco',nip:''},
  {eco:'17',unidad:'MARCH ACTIVE',       año:2017,plaza:'CHIHUAHUA', responsable:'GUILLERMO',        placas:'EMB313A',serie:'3N1CK3CD5HL248558', rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-23',tipo:'auto',     color:'Blanco',nip:'1713'},
  {eco:'19',unidad:'RAM 700',            año:2017,plaza:'CHIHUAHUA', responsable:'ROBERTO MUÑOZ',    placas:'DU6471A',serie:'9BD578458HY162606', rend:'—',        pv:'2026-09-24',pol:'794B05035M-20',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'21',unidad:'RAM 700',            año:2018,plaza:'JUAREZ',    responsable:'BENITO SOTO',      placas:'DU6470A',serie:'9BD578452JY210560', rend:'—',        pv:'2026-09-24',pol:'794B05035M-12',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'22',unidad:'RAM 700',            año:2018,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6751A',serie:'9BD578456JY208715', rend:'9 KM/L',   pv:'2026-09-24',pol:'794B05035M-13',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'23',unidad:'RAM 700',            año:2018,plaza:'CHIHUAHUA', responsable:'SERGIO CARMONA',   placas:'DU6752A',serie:'9BD578454JY209023', rend:'—',        pv:'2026-09-24',pol:'794B05035M-14',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'26',unidad:'SEAT IBIZA',         año:2018,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EMB314A',serie:'VSBB2KJ1JR017261',  rend:'13 KM/L',  pv:'2026-09-24',pol:'794B05035M-19',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'31',unidad:'NP300 KANGOO',       año:2012,plaza:'CHIHUAHUA', responsable:'DESARROLLOS',      placas:'DU6754A',serie:'3N6DD25T5CK018279', rend:'8 KM/L',   pv:'2026-09-24',pol:'794B05035M-6', tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'35',unidad:'ISUZU',             año:2019,plaza:'CHIHUAHUA', responsable:'ALMACEN',          placas:'DU6495A',serie:'JAANPR755K7000178', rend:'3.5 KM/L', pv:'2026-09-24',pol:'794B05035M-9', tipo:'camion',   color:'Blanco',nip:''},
  {eco:'36',unidad:'CAMION NISSAN CS',  año:2014,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6494A',serie:'3N6DD25T9EK019471', rend:'8 KM/L',   pv:'2026-09-24',pol:'794B05035M-18',tipo:'camion',   color:'Blanco',nip:''},
  {eco:'37',unidad:'RAM 700',            año:2019,plaza:'JUAREZ',    responsable:'JUAREZ',           placas:'DU6493A',serie:'9BD578458KY323611', rend:'—',        pv:'2026-09-24',pol:'794B05035M-21',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'38',unidad:'RAM 700',            año:2019,plaza:'CHIHUAHUA', responsable:'DIONICIO',         placas:'DU6492A',serie:'9BD578455KY324652', rend:'—',        pv:'2026-09-24',pol:'794B05035M-22',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'39',unidad:'L200',               año:2019,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'DU6491A',serie:'MMBL45G1KH043444',  rend:'10 KM/L',  pv:'2026-09-24',pol:'794B05035M-30',tipo:'camioneta',color:'Blanco',nip:'1339'},
  {eco:'40',unidad:'MARCH ACTIVE',       año:2019,plaza:'MONTERREY', responsable:'IVAN SEPULVEDA',   placas:'DU6490A',serie:'3N6CK34N2KL230477', rend:'10.5 KM/L',pv:'2026-09-24',pol:'794B05035M-2', tipo:'auto',     color:'Blanco',nip:''},
  {eco:'43',unidad:'F-150 PICK-UP',      año:2012,plaza:'CHIHUAHUA', responsable:'—',                placas:'DU6488A',serie:'1FTMF1CM1CKD41243', rend:'5.6 KM/L', pv:'2026-09-24',pol:'794B05035M-5', tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'47',unidad:'MARCH ACTIVE L4',    año:2019,plaza:'CHIHUAHUA', responsable:'IDALY RUIZ',       placas:'EMB308A',serie:'3N1CK3CD5KL232108', rend:'—',        pv:'2026-09-24',pol:'794B05035M-24',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'48',unidad:'MARCH ACTIVE L4',    año:2019,plaza:'CHIHUAHUA', responsable:'IVAN ARGENIS',     placas:'EMB309A',serie:'3N1CK3CD4KL232066', rend:'—',        pv:'2026-09-24',pol:'794B05035M-8', tipo:'auto',     color:'Blanco',nip:''},
  {eco:'50',unidad:'FIESTA',             año:2018,plaza:'MONTERREY', responsable:'IRVING SAUCEDO',   placas:'EMB310A',serie:'3FADP4BJ1JM128469', rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-11',tipo:'auto',     color:'Plata', nip:''},
  {eco:'52',unidad:'MARCH',              año:2020,plaza:'MONTERREY', responsable:'MONTERREY',        placas:'DU6486A',serie:'3N6CK34N3LL243692', rend:'—',        pv:'2026-09-24',pol:'794B05035M-26',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'54',unidad:'RAM 700 SLT',        año:2020,plaza:'CHIHUAHUA', responsable:'RICARDO GONZALEZ', placas:'DU6485A',serie:'9BD578452LY411572', rend:'17.5 KM/L',pv:'2026-09-24',pol:'794B05035M-33',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'55',unidad:'MARCH',              año:2020,plaza:'MONTERREY', responsable:'ROQUE LEAL',       placas:'DU6484A',serie:'3N6CK34N3LL248469', rend:'11.7 KM/L',pv:'2026-09-24',pol:'794B05035M-27',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'56',unidad:'RAM 700 SLT',        año:2020,plaza:'PARRAL',    responsable:'PLAZA PARRAL',     placas:'DU6483A',serie:'9BD578451LY423955', rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-34',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'58',unidad:'RAM 700',            año:2021,plaza:'CHIHUAHUA', responsable:'ISMAEL BARRAZA',   placas:'DU6482A',serie:'9BD281G50MYV59661', rend:'12.7 KM/L',pv:'2026-09-24',pol:'794B05035M-35',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'59',unidad:'RAM 700',            año:2021,plaza:'CHIHUAHUA', responsable:'ALAN ESTRADA',     placas:'DU6481A',serie:'9BD281G56MYV59423', rend:'13.5 KM/L',pv:'2026-09-24',pol:'794B05035M-36',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'60',unidad:'MARCH',              año:2020,plaza:'CAMARGO',   responsable:'RAMON HERNANDEZ',  placas:'DU6480A',serie:'3N6CK34N9LL254065', rend:'11.6 KM/L',pv:'2026-09-24',pol:'794B05035M-28',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'61',unidad:'MARCH',              año:2020,plaza:'PARRAL',    responsable:'RICARDO MORIEL',   placas:'DU6479A',serie:'3N6CK34N2LL254229', rend:'13.9 KM/L',pv:'2026-09-24',pol:'794B05035M-29',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'62',unidad:'NP300',              año:2019,plaza:'MONTERREY', responsable:'JULIO DE LA CRUZ', placas:'DU6472A',serie:'3N6AD33A1KK838707', rend:'7.5 KM/L', pv:'2026-09-24',pol:'794B05035M-31',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'63',unidad:'SILVERADO 1500',     año:2013,plaza:'CHIHUAHUA', responsable:'BODEGA',           placas:'DU6473A',serie:'3GCNC9CX6DG343777', rend:'5.5 KM/L', pv:'2026-09-24',pol:'794B05035M-25',tipo:'camioneta',color:'Plata', nip:''},
  {eco:'64',unidad:'MARCH ACTIVE',       año:2017,plaza:'CHIHUAHUA', responsable:'VERONICA GARCIA',  placas:'DU6474A',serie:'3N6CK34N4HL242297', rend:'10.6 KM/L',pv:'2026-09-24',pol:'794B05035M-32',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'66',unidad:'AVEO',               año:2018,plaza:'CHIHUAHUA', responsable:'CARMEN HERNANDEZ', placas:'EMB311A',serie:'LSGHD52H6JD239610', rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-37',tipo:'auto',     color:'Gris',  nip:''},
  {eco:'69',unidad:'NISSAN NP300',       año:2017,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6499A',serie:'3N6AD33A6HK837318', rend:'—',        pv:'2026-09-24',pol:'794B05035M-38',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'71',unidad:'YUKON',              año:2023,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DYY416B',serie:'1GKS28KL1PR236241', rend:'—',        pv:'—',         pol:'—',            tipo:'camioneta',color:'Negro', nip:''},
  {eco:'72',unidad:'RAM RAPID',          año:2023,plaza:'CHIHUAHUA', responsable:'JORGE URIBE',      placas:'DG7445B',serie:'9BD2657RIP9233026',  rend:'14 KM/L',  pv:'—',         pol:'—',            tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'73',unidad:'DODGE ATTITUDE',     año:2023,plaza:'CHIHUAHUA', responsable:'DENISSE GUTIERREZ',placas:'MKL325A',serie:'ML3ABT6J4PH004521', rend:'—',        pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'74',unidad:'DODGE ATTITUDE',     año:2023,plaza:'CHIHUAHUA', responsable:'FATIMA SAUZAMEDA', placas:'MKL317A',serie:'ML3ABT6J4PH004552', rend:'15.8 KM/L',pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'75',unidad:'AVEO',               año:2019,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DUJ454B',serie:'LSGHD52H8KD130423', rend:'—',        pv:'2027-02-14',pol:'29113016152002',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'76',unidad:'NISSAN VERSA',       año:2024,plaza:'MONTERREY', responsable:'LUIS GARZA',       placas:'ESU908B',serie:'3N1CN7AE7RK398169', rend:'16 KM/L',  pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'77',unidad:'BMW X6',             año:2025,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EKM897B',serie:'WBA41EX06S9W75509', rend:'—',        pv:'—',         pol:'—',            tipo:'auto',     color:'Negro', nip:''},
  {eco:'79',unidad:'CHANGAN HUNTER',     año:2025,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'337217', serie:'LSCBBZ2A1SG803364', rend:'—',        pv:'2029-02-27',pol:'4056350008',    tipo:'camioneta',color:'Blanco',nip:'7925'},
  {eco:'80',unidad:'CHANGAN HUNTER',     año:2025,plaza:'CHIHUAHUA', responsable:'ULISES NUÑEZ',     placas:'337218', serie:'LSCBBZ2A3SG803365', rend:'—',        pv:'2029-02-27',pol:'4056347985',    tipo:'camioneta',color:'Blanco',nip:'8025'},
  {eco:'81',unidad:'CHANGAN HUNTER',     año:2025,plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',      placas:'337219', serie:'LSCBB72A8SG803376', rend:'—',        pv:'2029-02-27',pol:'4056350016',    tipo:'camioneta',color:'Blanco',nip:'8125'},
  {eco:'82',unidad:'VAN DONGFENG',       año:2026,plaza:'CHIHUAHUA', responsable:'TOMAS',            placas:'DZ9769B',serie:'LGFP541E6TA603994', rend:'—',        pv:'2029-03-17',pol:'4056530506',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'83',unidad:'CHASIS DONGFENG',    año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9767B',serie:'LGDND41EXSA202059', rend:'—',        pv:'2029-03-17',pol:'4056530481',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'84',unidad:'CHASIS DONGFENG',    año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9766B',serie:'LGDND41E6SA202057', rend:'—',        pv:'2029-03-17',pol:'4056530495',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'85',unidad:'PICKUP DONGFENG',    año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9768B',serie:'LGDCMA1L5SA204421', rend:'—',        pv:'2029-03-20',pol:'3200970801',    tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'90',unidad:'CHANGAN STAR',       año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9853B',serie:'LSCAB12E7TG800860', rend:'—',        pv:'2026-11-01',pol:'1950290311',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'91',unidad:'CHANGAN STAR DC',    año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9855B',serie:'LSCAB22E6TG800256', rend:'—',        pv:'2026-11-01',pol:'1950290357',    tipo:'camion',   color:'Blanco',nip:''},
  {eco:'92',unidad:'CHANGAN STAR DC',    año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9854B',serie:'LSCAB22E5TG800295', rend:'—',        pv:'2026-11-01',pol:'1950290361',    tipo:'camion',   color:'Blanco',nip:''},
];

const CHK = {
  cristales: ['Medallón delantero','Vidrio trasero','Lateral derecho delantero','Lateral derecho trasero','Lateral izquierdo delantero','Lateral izquierdo trasero'],
  espejos:   ['Retrovisor izquierdo','Retrovisor derecho','Espejo central interior'],
  neumaticos:['Llanta delantera derecha','Llanta delantera izquierda','Llanta trasera derecha','Llanta trasera izquierda','Llanta de refacción'],
  interiores:['Póliza / Manual de propietario','Radio / Carátula','Pantallas / FIS','Encendedor','Asientos y vestiduras','Tablero en buen estado','Tapetes'],
  motor:     ['Batería','Bobinas','Computadora','Tapón agua limpiabrisas','Tapón radiador','Tapón dirección hidráulica'],
  cajuela:   ['Herramienta','Cables de arranque','Extintor','Llanta de refacción','Llave L','Llave de cruz'],
  legal:     ['Sin multas de tránsito vigentes','Verificación ambiental vigente','Tenencia al corriente','Tarjeta de circulación vigente'],
};

// ── ESTADO ──
let flV=[], flS=[];
let vAct=null, tabAct='info', vistaAct='home', busq='';
let fotosB64=[], chkFotos={};

// ── ÍCONOS ──
const I={
  truck:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  car:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  grid:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  search:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  check:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  doc:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  camera:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  alert:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  wrench:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  hist:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  clip:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
  upload:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`,
  fuel:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 22V8l9-6 9 6v14H3z"/><line x1="12" y1="22" x2="12" y2="13"/><path d="M9 22V13h6v9"/></svg>`,
  road:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l3-10h12l3 10"/><path d="M12 7v10"/></svg>`,
  archive:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  shield:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  user:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  map:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
};

// ── CSS ──
function css(){
  if(document.getElementById('fl-v7')) return;
  const s=document.createElement('style'); s.id='fl-v7';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

#flotilla-dashboard{display:none;margin-left:240px;min-height:100vh;background:#EEF2F7;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#0A0F1E;}
#flotilla-dashboard *{box-sizing:border-box;margin:0;padding:0;}

/* TOPBAR */
.ft{background:#0A1628;padding:0 20px;display:flex;align-items:center;gap:10px;height:52px;position:sticky;top:0;z-index:200;}
.ft-brand{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.3px;flex:1;color:#fff;}
.ft-brand em{color:#3B82F6;font-style:normal;}
.ft-role{font-size:10px;padding:3px 9px;border-radius:100px;background:rgba(59,130,246,.2);color:#93C5FD;font-weight:700;letter-spacing:.4px;text-transform:uppercase;}
.fb{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:7px;padding:7px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
.fb.outline{background:rgba(255,255,255,.08);color:#CBD5E1;border:1px solid rgba(255,255,255,.12);}
.fb.outline:hover{background:rgba(255,255,255,.15);color:#fff;}
.fb.accent{background:#2563EB;color:#fff;}
.fb.accent:hover{background:#1D4ED8;box-shadow:0 4px 14px rgba(37,99,235,.4);}
.fb.white{background:#fff;color:#0A1628;font-weight:800;}
.fb.white:hover{background:#F1F5F9;}

/* LAYOUT */
.fl-lay{display:grid;grid-template-columns:256px 1fr;min-height:calc(100vh - 52px);}

/* SIDEBAR */
.fl-sb{background:#fff;border-right:1px solid #E8EDF5;display:flex;flex-direction:column;}
.fl-sb-top{padding:12px 10px 8px;border-bottom:1px solid #F1F5F9;}
.fl-sb-q{position:relative;}
.fl-sb-q input{width:100%;padding:8px 10px 8px 30px;border:1.5px solid #E8EDF5;border-radius:8px;font-size:12px;font-family:inherit;background:#F8FAFD;outline:none;transition:all .15s;color:#0A0F1E;}
.fl-sb-q input:focus{border-color:#2563EB;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.08);}
.fl-sb-qi{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;display:flex;}
.fl-sb-stats{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:8px 10px;border-bottom:1px solid #F1F5F9;}
.fl-ss{border-radius:8px;padding:8px 10px;}
.fl-ss .n{font-size:19px;font-weight:800;line-height:1;font-family:'JetBrains Mono',monospace;}
.fl-ss .l{font-size:9px;font-weight:700;margin-top:2px;text-transform:uppercase;letter-spacing:.5px;}

/* NAV */
.fl-nav{padding:6px 8px;border-bottom:1px solid #F1F5F9;}
.fl-ni{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;color:#64748B;transition:all .15s;margin-bottom:2px;}
.fl-ni:hover{background:#F8FAFD;color:#0A0F1E;}
.fl-ni.on{background:#EFF6FF;color:#2563EB;font-weight:700;}
.fl-ni-cnt{margin-left:auto;background:#EF4444;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:100px;min-width:16px;text-align:center;}

/* LISTA VEHÍCULOS */
.fl-lst{flex:1;overflow-y:auto;padding:6px 8px;}
.fl-lbl{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#94A3B8;padding:6px 7px 3px;}
.fl-vi{border-radius:8px;padding:7px 9px;cursor:pointer;transition:all .15s;border:1.5px solid transparent;display:flex;align-items:center;gap:8px;margin-bottom:2px;}
.fl-vi:hover{background:#F8FAFD;}
.fl-vi.on{background:#EFF6FF;border-color:#3B82F6;}
.fl-vi-ico{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
.fl-vi-eco{font-size:11.5px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#0A0F1E;}
.fl-vi-sub{font-size:10px;color:#64748B;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fl-dot{width:6px;height:6px;border-radius:50%;margin-left:auto;flex-shrink:0;}
.fl-dot.g{background:#22C55E;box-shadow:0 0 0 2px #DCFCE7;}
.fl-dot.y{background:#F59E0B;box-shadow:0 0 0 2px #FEF3C7;}
.fl-dot.r{background:#EF4444;box-shadow:0 0 0 2px #FEE2E2;}

/* PANEL PRINCIPAL */
.fl-main{overflow-y:auto;background:#EEF2F7;}
.fl-in{padding:22px 26px;max-width:1100px;}

/* KPI HOME */
.fl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
.fl-kpi{background:#fff;border-radius:12px;padding:16px 18px;border:1px solid #E8EDF5;box-shadow:0 1px 3px rgba(10,22,40,.06);}
.fl-kpi-l{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:8px;display:flex;align-items:center;gap:5px;}
.fl-kpi-v{font-size:28px;font-weight:900;letter-spacing:-1px;line-height:1;font-family:'JetBrains Mono',monospace;}
.fl-kpi-s{font-size:10.5px;color:#94A3B8;margin-top:3px;}

/* ALERTAS */
.fl-alts{display:flex;flex-direction:column;gap:5px;margin-bottom:16px;}
.fl-alt{display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid;}
.fl-alt.w{background:#FFFBEB;color:#92400E;border-color:#FDE68A;}
.fl-alt.e{background:#FEF2F2;color:#991B1B;border-color:#FECACA;}

/* HERO VEHÍCULO — Car Rental App style */
.fl-hero{background:#0A1628;border-radius:16px;overflow:hidden;margin-bottom:18px;position:relative;}
.fl-hero-top{padding:22px 24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;position:relative;z-index:1;}
.fl-hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,#0A1628 0%,#0F2547 50%,#1a3a6b 100%);}
.fl-hero-dots{position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.04) 1px,transparent 1px);background-size:20px 20px;}
.fl-hero-badge{font-size:9.5px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;background:rgba(59,130,246,.25);color:#93C5FD;padding:3px 10px;border-radius:100px;display:inline-block;margin-bottom:6px;border:1px solid rgba(59,130,246,.3);}
.fl-hero-name{font-size:22px;font-weight:800;letter-spacing:-.5px;color:#fff;line-height:1.1;}
.fl-hero-year{font-size:13px;color:rgba(255,255,255,.5);margin-top:3px;}
.fl-hero-tags{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.fl-hero-tag{display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,.75);background:rgba(255,255,255,.08);padding:4px 10px;border-radius:100px;border:1px solid rgba(255,255,255,.1);}
.fl-hero-right{text-align:center;flex-shrink:0;position:relative;z-index:1;}
.fl-hero-emo{font-size:56px;line-height:1;filter:drop-shadow(0 4px 20px rgba(0,0,0,.4));}
.fl-hero-status{display:inline-block;padding:4px 14px;border-radius:100px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;margin-top:8px;}
.fl-hs-activo{background:rgba(34,197,94,.2);color:#86EFAC;border:1px solid rgba(34,197,94,.3);}
.fl-hs-taller{background:rgba(245,158,11,.2);color:#FCD34D;border:1px solid rgba(245,158,11,.3);}
.fl-hs-comision{background:rgba(139,92,246,.2);color:#C4B5FD;border:1px solid rgba(139,92,246,.3);}
.fl-hs-baja{background:rgba(239,68,68,.2);color:#FCA5A5;border:1px solid rgba(239,68,68,.3);}

/* FOTOS VEHÍCULO */
.fl-hero-fotos{background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.07);padding:14px 24px;display:flex;align-items:center;gap:10px;position:relative;z-index:1;}
.fl-foto-thumb{width:72px;height:52px;border-radius:8px;object-fit:cover;border:2px solid rgba(255,255,255,.15);cursor:pointer;transition:border-color .15s;}
.fl-foto-thumb:hover{border-color:#3B82F6;}
.fl-foto-add{width:72px;height:52px;border-radius:8px;border:2px dashed rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:rgba(255,255,255,.4);font-size:10px;font-weight:600;gap:3px;transition:all .15s;flex-shrink:0;}
.fl-foto-add:hover{border-color:rgba(59,130,246,.6);color:#93C5FD;background:rgba(59,130,246,.1);}
.fl-foto-add svg{opacity:.6;}
.fl-foto-lbl{font-size:10px;color:rgba(255,255,255,.4);font-weight:600;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;}

/* SPECS — Vehicle Analysis style */
.fl-specs{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}
.fl-spec{background:#fff;border-radius:10px;padding:13px 15px;border:1px solid #E8EDF5;position:relative;overflow:hidden;}
.fl-spec::before{content:'';position:absolute;top:0;left:0;width:3px;height:100%;background:linear-gradient(180deg,#2563EB,#7C3AED);}
.fl-spec-l{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:5px;}
.fl-spec-v{font-size:16px;font-weight:800;color:#0A0F1E;font-family:'JetBrains Mono',monospace;}
.fl-spec-s{font-size:10px;color:#64748B;margin-top:2px;}

/* TABS */
.fl-tabs{display:flex;gap:1px;background:#E2E8F0;border-radius:10px;padding:3px;margin-bottom:16px;width:fit-content;}
.fl-tab{padding:7px 14px;border-radius:8px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:11.5px;font-weight:600;color:#64748B;transition:all .15s;display:flex;align-items:center;gap:5px;white-space:nowrap;}
.fl-tab:hover{color:#0A0F1E;}
.fl-tab.on{background:#fff;color:#0A0F1E;box-shadow:0 1px 4px rgba(10,22,40,.1);}

/* INFO GRID */
.fl-ig{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;}
.fl-ig-r{display:grid;grid-template-columns:1fr 1fr;}
.fl-ig-c{padding:12px 16px;border-bottom:1px solid #F1F5F9;}
.fl-ig-r:last-child .fl-ig-c{border-bottom:none;}
.fl-ig-c:nth-child(odd){border-right:1px solid #F1F5F9;}
.fl-ig-c dt{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:3px;}
.fl-ig-c dd{font-size:13px;font-weight:600;color:#0A0F1E;}
.fl-ig-c dd.mono{font-family:'JetBrains Mono',monospace;font-size:11px;}

/* POLIZA CARD */
.fl-pol{background:linear-gradient(135deg,#0A1628,#1a2f55);border-radius:12px;padding:16px;color:#fff;}
.fl-pol-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.fl-pol-ico{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;}
.fl-pol-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#93C5FD;}
.fl-pol-num{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;color:#fff;margin-top:2px;}
.fl-pol-exp{font-size:11px;font-weight:600;margin-top:6px;}

/* GAUGE */
.fl-gauge{background:#fff;border:1px solid #E8EDF5;border-radius:10px;padding:14px;text-align:center;}
.fl-gauge-l{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:5px;}

/* BADGES */
.fl-b{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:100px;white-space:nowrap;}
.fl-b.g{background:#DCFCE7;color:#15803D;}
.fl-b.a{background:#FEF3C7;color:#B45309;}
.fl-b.r{background:#FEE2E2;color:#B91C1C;}
.fl-b.b{background:#DBEAFE;color:#1D4ED8;}
.fl-b.p{background:#EDE9FE;color:#6D28D9;}
.fl-b.gr{background:#F1F5F9;color:#475569;}
.fl-b.Solicitud{background:#EDE9FE;color:#6D28D9;}
.fl-b.Validada{background:#DBEAFE;color:#1D4ED8;}
.fl-b.Cotizacin{background:#FEF3C7;color:#B45309;}
.fl-b.Aprobada{background:#DCFCE7;color:#15803D;}
.fl-b.Rechazada{background:#FEE2E2;color:#B91C1C;}
.fl-b.Cierre{background:#F3E8FF;color:#7C3AED;}
.fl-b.Cerrada{background:#F1F5F9;color:#475569;}
.fl-b.activo{background:#DCFCE7;color:#15803D;}
.fl-b.taller{background:#FEF3C7;color:#B45309;}
.fl-b.comision{background:#EDE9FE;color:#6D28D9;}
.fl-b.baja{background:#FEE2E2;color:#B91C1C;}

/* TABLA */
.fl-tw{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(10,22,40,.05);}
.fl-t{width:100%;border-collapse:collapse;font-size:12px;}
.fl-t th{background:#F8FAFD;padding:9px 13px;text-align:left;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;border-bottom:1px solid #E8EDF5;}
.fl-t td{padding:11px 13px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.fl-t tr:last-child td{border-bottom:none;}
.fl-t tr:hover td{background:#F8FAFD;}
.fl-t tr{cursor:pointer;transition:background .1s;}

/* CHECKLIST */
.fl-chk-z{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;margin-bottom:10px;}
.fl-chk-zh{color:#fff;padding:9px 15px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;display:flex;align-items:center;gap:7px;}
.fl-chk-item{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:9px 15px;border-bottom:1px solid #F1F5F9;}
.fl-chk-item:last-child{border-bottom:none;}
.fl-chk-item:hover{background:#F8FAFD;}
.fl-chk-lbl{font-size:12px;color:#0A0F1E;font-weight:500;}
.fl-chk-fp{display:flex;align-items:center;gap:4px;font-size:10.5px;font-weight:600;color:#94A3B8;cursor:pointer;padding:4px 9px;border-radius:6px;border:1px dashed #CBD5E1;transition:all .15s;background:transparent;font-family:inherit;}
.fl-chk-fp:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-chk-fp.has{border-style:solid;border-color:#22C55E;color:#15803D;background:#F0FDF4;}
.fl-chk-yesno{display:flex;gap:3px;}
.fl-chk-y,.fl-chk-n{width:26px;height:26px;border-radius:6px;border:1.5px solid #E2E8F0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;transition:all .15s;background:transparent;flex-shrink:0;}
.fl-chk-y:hover{border-color:#22C55E;color:#15803D;background:#F0FDF4;}
.fl-chk-n:hover{border-color:#EF4444;color:#B91C1C;background:#FEF2F2;}
.fl-chk-y.on{background:#22C55E;border-color:#22C55E;color:#fff;}
.fl-chk-n.on{background:#EF4444;border-color:#EF4444;color:#fff;}
.fl-chk-legal{background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;overflow:hidden;margin-bottom:10px;}
.fl-chk-lh{background:linear-gradient(135deg,#92400E,#B45309);color:#fff;padding:9px 15px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;}

/* TIMELINE */
.fl-tl{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;}
.fl-tl-i{display:grid;grid-template-columns:34px 1fr;gap:10px;padding:11px 14px;border-bottom:1px solid #F1F5F9;align-items:flex-start;}
.fl-tl-i:last-child{border-bottom:none;}
.fl-tl-ic{width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;}
.fl-tl-t{font-size:12.5px;font-weight:700;}
.fl-tl-m{font-size:10.5px;color:#64748B;margin-top:1px;}
.fl-tl-d{font-size:11.5px;margin-top:4px;color:#374151;}

/* MODAL */
.fl-ov{position:fixed;inset:0;background:rgba(10,15,30,.65);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);animation:fFi .15s ease;}
@keyframes fFi{from{opacity:0}to{opacity:1}}
.fl-modal{background:#fff;border-radius:16px;width:100%;max-width:580px;max-height:92vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.3);animation:fSu .2s cubic-bezier(.4,0,.2,1);font-family:'Plus Jakarta Sans',sans-serif;}
@keyframes fSu{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.fl-mh{padding:18px 20px 0;display:flex;align-items:center;justify-content:space-between;}
.fl-mh h3{font-size:15px;font-weight:800;letter-spacing:-.3px;}
.fl-mx{width:26px;height:26px;border:none;background:#F1F5F9;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background .15s;}
.fl-mx:hover{background:#E2E8F0;}
.fl-mb{padding:14px 20px 20px;}
.fl-sep{height:1px;background:#F1F5F9;margin:12px 0;}

/* FORM */
.fl-form{display:flex;flex-direction:column;gap:11px;}
.fl-fld{display:flex;flex-direction:column;gap:4px;}
.fl-fld label{font-size:10.5px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;}
.fl-fld input,.fl-fld select,.fl-fld textarea{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;color:#0A0F1E;background:#F8FAFD;outline:none;transition:all .15s;width:100%;}
.fl-fld input:focus,.fl-fld select:focus,.fl-fld textarea:focus{border-color:#2563EB;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-fld input:disabled,.fl-fld select:disabled{background:#F1F5F9;color:#64748B;cursor:not-allowed;}
.fl-fld textarea{min-height:80px;resize:vertical;}
.fl-fr{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.fl-fa{display:flex;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid #F1F5F9;}
.fl-fasig{background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:8px;padding:9px 12px;font-size:12.5px;font-weight:700;color:#1D4ED8;display:flex;align-items:center;gap:7px;}

/* SOL MODAL GRID */
.fl-sg{display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:9px;overflow:hidden;border:1px solid #E8EDF5;}
.fl-sc{padding:9px 12px;}
.fl-sc:nth-child(odd){border-right:1px solid #E8EDF5;}
.fl-sc dt{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:2px;}
.fl-sc dd{font-size:12.5px;font-weight:600;color:#0A0F1E;}
.fl-sc.full{grid-column:1/-1;}

/* UPLOAD */
.fl-up{border:2px dashed #CBD5E1;border-radius:8px;padding:13px;text-align:center;cursor:pointer;color:#64748B;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;font-family:inherit;background:transparent;}
.fl-up:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}
.fl-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:100px;font-size:11px;font-weight:600;color:#374151;}

/* EMPTY / LOADING */
.fl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;gap:8px;color:#64748B;text-align:center;}
.fl-ei{font-size:36px;opacity:.2;margin-bottom:6px;}
.fl-empty h3{font-size:14px;font-weight:700;color:#0A0F1E;}
.fl-empty p{font-size:12px;max-width:240px;}
.fl-loading{display:flex;align-items:center;justify-content:center;min-height:160px;color:#64748B;gap:8px;font-size:13px;}
.fl-spin{width:16px;height:16px;border:2px solid #E2E8F0;border-top-color:#2563EB;border-radius:50%;animation:fR .7s linear infinite;}
@keyframes fR{to{transform:rotate(360deg)}}

/* SVG DAÑOS */
.fl-dmg-wrap{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;}
.fl-dmg-view{background:#F0F4FA;border:1.5px solid #E2E8F0;border-radius:10px;overflow:hidden;cursor:crosshair;position:relative;}
.fl-dmg-view:hover{border-color:#2563EB;}
.fl-dmg-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#64748B;padding:5px 8px;background:#fff;border-bottom:1px solid #E2E8F0;display:flex;align-items:center;justify-content:space-between;}
.fl-dmg-lbl button{font-size:8.5px;font-weight:700;color:#EF4444;background:none;border:none;cursor:pointer;padding:0;font-family:inherit;}
.fl-dmg-pt{position:absolute;width:18px;height:18px;background:#EF4444;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 2px 6px rgba(239,68,68,.4);}
.fl-dmg-pts{font-size:10px;color:#64748B;margin-top:5px;}

/* PANEL VEHÍCULO EN SOLICITUDES */
.fl-sol-vh{background:#0A1628;border-radius:10px;padding:12px 14px;color:#fff;margin-bottom:12px;display:none;}
.fl-sol-vh.vis{display:block;}
.fl-sol-vh-top{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#93C5FD;margin-bottom:6px;}
.fl-sol-vh-name{font-size:15px;font-weight:800;letter-spacing:-.3px;}
.fl-sol-vh-sub{font-size:11px;color:rgba(255,255,255,.55);margin-top:2px;}
.fl-sol-vh-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;}
.fl-sol-vh-d dt{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.4);}
.fl-sol-vh-d dd{font-size:11.5px;font-weight:700;color:#fff;font-family:'JetBrains Mono',monospace;}

/* TIPO PERSONALIZADO */
#fl-tipo-custom-wrap{margin-top:6px;display:none;}
#fl-tipo-custom-wrap.vis{display:block;}

/* RESPONSIVE */
@media(max-width:900px){
  #flotilla-dashboard{margin-left:0;}
  .fl-lay{grid-template-columns:1fr;}
  .fl-sb{border-right:none;border-bottom:1px solid #E8EDF5;max-height:190px;}
  .fl-kpis,.fl-specs{grid-template-columns:1fr 1fr;}
  .fl-ig-r{grid-template-columns:1fr;}
  .fl-ig-c:nth-child(odd){border-right:none;}
  .fl-fr{grid-template-columns:1fr;}
  .fl-in{padding:14px;}
  .fl-hero-top{flex-direction:column;}
  .fl-hero-right{display:none;}
  .fl-dmg-wrap{grid-template-columns:1fr;}
}
@media(max-width:900px){
  #flotilla-dashboard{margin-left:0;}
  .fl-lay{grid-template-columns:1fr;}
  .fl-sb{border-right:none;border-bottom:1px solid #E8EDF5;max-height:190px;}
  .fl-kpis,.fl-specs{grid-template-columns:1fr 1fr;}
  .fl-ig-r{grid-template-columns:1fr;}
  .fl-ig-c:nth-child(odd){border-right:none;}
  .fl-fr{grid-template-columns:1fr;}
  .fl-in{padding:14px;}
  .fl-hero-top{flex-direction:column;}
  .fl-hero-right{display:none;}
}
`;
  document.head.appendChild(s);
}

// ── HTML BASE ──
function html(){
  const el=document.getElementById('flotilla-dashboard'); if(!el) return;
  el.innerHTML=`
  <div class="ft">
    <div class="ft-brand">${I.truck} FLOTILLA <em>TECNOCONTROL</em></div>
    <span class="ft-role" id="fl-rol">—</span>
    <button class="fb outline" onclick="flSolsAll()">${I.wrench} Solicitudes</button>
    <button class="fb outline" onclick="flComisVista()">${I.road} Comisiones</button>
    <button class="fb accent" id="fl-btn-n" onclick="flAbrirModal()">${I.plus} Nueva solicitud</button>
  </div>
  <div class="fl-lay">
    <aside class="fl-sb">
      <div class="fl-sb-top">
        <div class="fl-sb-q">
          <span class="fl-sb-qi">${I.search}</span>
          <input type="text" id="fl-buscar" placeholder="Unidad, placas, responsable…" oninput="flBuscar(this.value)">
        </div>
      </div>
      <div class="fl-sb-stats">
        <div class="fl-ss" style="background:#EFF6FF"><div class="n" style="color:#2563EB" id="fl-n-a">—</div><div class="l" style="color:#2563EB">Activos</div></div>
        <div class="fl-ss" style="background:#FFFBEB"><div class="n" style="color:#B45309" id="fl-n-t">—</div><div class="l" style="color:#B45309">En taller</div></div>
      </div>
      <div class="fl-nav">
        <div class="fl-ni on" id="fl-ni-panel" onclick="flHome()">${I.grid} Panel general</div>
        <div class="fl-ni" id="fl-ni-sols"  onclick="flSolsAll()">${I.wrench} Solicitudes <span id="fl-ni-cnt-sols" class="fl-ni-cnt" style="display:none">0</span></div>
        <div class="fl-ni" id="fl-ni-comis" onclick="flComisVista()">${I.road} Comisiones</div>
        <div class="fl-ni" id="fl-ni-bajas" onclick="flBajasVista()">${I.archive} Vehículos de baja</div>
      </div>
      <div class="fl-lst">
        <div class="fl-lbl">Flota activa</div>
        <div id="fl-lista"><div class="fl-loading" style="min-height:50px;font-size:11px"><div class="fl-spin"></div> Cargando…</div></div>
      </div>
    </aside>
    <main class="fl-main" id="fl-main">
      <div class="fl-in"><div class="fl-loading"><div class="fl-spin"></div> Inicializando…</div></div>
    </main>
  </div>`;
}

// ── HELPERS ──
const hBg =s=>s==='taller'?'#FFFBEB':s==='baja'?'#FEF2F2':s==='comision'?'#F5F3FF':'#ECFDF5';
const hCl =s=>s==='taller'?'#B45309':s==='baja'?'#B91C1C':s==='comision'?'#6D28D9':'#15803D';
const hEmo=t=>t==='camion'?'🚛':t==='camioneta'?'🚙':'🚗';
const hIco=t=>t==='camion'?I.truck:I.car;
const hD  =f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);
const hDL =d=>d===null?'—':d<0?`Vencida hace ${Math.abs(d)} días`:d===0?'Vence HOY':d<90?`Vence en ${d} días`:'Vigente';
const hDC =d=>d===null?'#22C55E':d<0?'#EF4444':d<90?'#F59E0B':'#22C55E';
const hF  =iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';
function hBadge(e){const c=(e||'').replace(/[^a-zA-Z]/g,'');return`<span class="fl-b ${c}">${e||'—'}</span>`;}
const hRol=()=>window.flGetRolActual?window.flGetRolActual():'Usuario';
const hP  =a=>window.flTienePermiso?window.flTienePermiso(a):(a==='crear_solicitud');
const hAdmin=()=>['Administrador','Contraloría','Flotilla'].includes(hRol());

// GAUGE SVG
function gauge(rend){
  const r=rend&&rend!=='—'?parseFloat(rend):null;
  const pct=r?Math.min(r/20,1):0;
  const ang=-120+pct*240,rad=(ang-90)*Math.PI/180;
  const cx=55,cy=55,R=42;
  const nx=cx+R*Math.cos(rad),ny=cy+R*Math.sin(rad);
  const col=pct<.35?'#EF4444':pct<.6?'#F59E0B':'#22C55E';
  return`<div class="fl-gauge">
    <div class="fl-gauge-l">${I.fuel} Rendimiento combustible</div>
    <svg width="110" height="78" viewBox="0 0 110 78">
      <path d="M11,70 A44,44 0 0,1 99,70" fill="none" stroke="#F1F5F9" stroke-width="7" stroke-linecap="round"/>
      ${r?`<path d="M11,70 A44,44 0 0,1 ${nx.toFixed(1)},${ny.toFixed(1)}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"/><circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="5" fill="${col}" stroke="#fff" stroke-width="2"/>`:``}
      <text x="55" y="67" text-anchor="middle" font-size="14" font-weight="800" fill="#0A0F1E" font-family="JetBrains Mono,monospace">${r?r.toFixed(1):'—'}</text>
      <text x="9" y="76" font-size="7.5" fill="#94A3B8" font-family="Plus Jakarta Sans,sans-serif">0</text>
      <text x="96" y="76" font-size="7.5" fill="#94A3B8" font-family="Plus Jakarta Sans,sans-serif">20</text>
    </svg>
    <div style="font-size:11px;font-weight:700;color:${col||'#94A3B8'}">${r?rend:'Sin dato registrado'}</div>
  </div>`;
}

// ── INIT ──
window.cargarFlotilla=async function(){
  css(); html();
  document.getElementById('fl-rol').textContent=hRol();
  const btnN=document.getElementById('fl-btn-n');
  if(btnN) btnN.style.display=hP('crear_solicitud')?'':'none';
  await Promise.all([loadVehs(),loadSols()]);
  flHome();
};

async function loadVehs(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.VEHS));
    flV=snap.size>0?snap.docs.map(d=>({id:d.id,...d.data()})):CAT.map(v=>({id:'eco-'+v.eco,status:'activo',km:0,fotos:[],...v}));
  }catch(e){flV=CAT.map(v=>({id:'eco-'+v.eco,status:'activo',km:0,fotos:[],...v}));}
  renderSB();
}

async function loadSols(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.SOLS));
    flS=snap.docs.map(d=>({id:d.id,...d.data()}));
    flS.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
  }catch(e){flS=[];}
  // Actualizar contador
  const pend=flS.filter(s=>['Solicitud','Validada'].includes(s.estatus)).length;
  const cnt=document.getElementById('fl-ni-cnt-sols');
  if(cnt){cnt.textContent=pend;cnt.style.display=pend?'':'none';}
}

// ── SIDEBAR ──
function renderSB(){
  const act=flV.filter(v=>!v.status||v.status==='activo').length;
  const tal=flV.filter(v=>v.status==='taller').length;
  const na=document.getElementById('fl-n-a'); if(na) na.textContent=act;
  const nt=document.getElementById('fl-n-t'); if(nt) nt.textContent=tal;
  const lista=document.getElementById('fl-lista'); if(!lista) return;
  const vis=flV.filter(v=>v.status!=='baja').filter(v=>{
    if(!busq) return true;
    const q=busq.toLowerCase();
    return (v.eco||'').toLowerCase().includes(q)||(v.placas||'').toLowerCase().includes(q)
        ||(v.unidad||'').toLowerCase().includes(q)||(v.responsable||'').toLowerCase().includes(q);
  });
  if(!vis.length){lista.innerHTML=`<div style="text-align:center;padding:14px;color:#94A3B8;font-size:11px">${flV.length?'Sin resultados':'Sin vehículos'}</div>`;return;}
  lista.innerHTML=vis.map(v=>`
    <div class="fl-vi" data-id="${v.id}" onclick="flSelVeh('${v.id}')">
      <div class="fl-vi-ico" style="background:${hBg(v.status)};color:${hCl(v.status)}">${hIco(v.tipo)}</div>
      <div style="flex:1;min-width:0">
        <div class="fl-vi-eco">${v.eco} <span style="font-weight:500;color:#94A3B8;font-size:9.5px">· ${v.placas||''}</span></div>
        <div class="fl-vi-sub">${(v.unidad||v.modelo||'—').substring(0,22)}</div>
      </div>
      <div class="fl-dot ${v.status==='taller'?'y':v.status==='baja'?'r':v.status==='comision'?'y':'g'}"></div>
    </div>`).join('');
  // restaurar selección activa
  if(vAct){
    const el=lista.querySelector(`[data-id="${vAct}"]`);
    if(el) el.classList.add('on');
  }
}

window.flBuscar=v=>{busq=v;renderSB();};

function navOn(id){
  document.querySelectorAll('#flotilla-dashboard .fl-ni').forEach(e=>e.classList.remove('on'));
  const el=document.getElementById(id); if(el) el.classList.add('on');
}
function vehOn(id){
  document.querySelectorAll('#flotilla-dashboard .fl-vi').forEach(e=>e.classList.remove('on'));
  const el=document.querySelector(`#fl-lista [data-id="${id}"]`); if(el) el.classList.add('on');
}

// ── HOME ──
window.flHome=function(){
  vAct=null; vistaAct='home';
  navOn('fl-ni-panel');
  document.querySelectorAll('#flotilla-dashboard .fl-vi').forEach(e=>e.classList.remove('on'));
  const alts=[];
  flV.forEach(v=>{const d=hD(v.pv||v.poliza_venc);if(d!==null&&d<90)alts.push({t:d<0?'e':'w',txt:`Unidad ${v.eco} — Póliza ${d<0?'VENCIDA':'por vencer el '+(v.pv||v.poliza_venc)}`});});
  const act=flV.filter(v=>!v.status||v.status==='activo').length;
  const tal=flV.filter(v=>v.status==='taller').length;
  const pend=flS.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus)).length;
  document.getElementById('fl-main').innerHTML=`<div class="fl-in">
    <div style="margin-bottom:18px"><div style="font-size:20px;font-weight:800;letter-spacing:-.5px">Panel General · Flotilla</div><div style="font-size:12.5px;color:#64748B;margin-top:3px">${flV.filter(v=>v.status!=='baja').length} unidades activas · ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div></div>
    ${alts.length?`<div class="fl-alts">${alts.slice(0,4).map(a=>`<div class="fl-alt ${a.t}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}
    <div class="fl-kpis">
      <div class="fl-kpi"><div class="fl-kpi-l">${I.truck} Total flotilla</div><div class="fl-kpi-v">${flV.length}</div><div class="fl-kpi-s">unidades registradas</div></div>
      <div class="fl-kpi"><div class="fl-kpi-l">${I.check} En operación</div><div class="fl-kpi-v" style="color:#16A34A">${act}</div><div class="fl-kpi-s">activas hoy</div></div>
      <div class="fl-kpi"><div class="fl-kpi-l">${I.wrench} En taller</div><div class="fl-kpi-v" style="color:#D97706">${tal}</div><div class="fl-kpi-s">fuera de servicio</div></div>
      <div class="fl-kpi"><div class="fl-kpi-l">${I.alert} Solicitudes activas</div><div class="fl-kpi-v" style="color:#7C3AED">${pend}</div><div class="fl-kpi-s">${hP('aprobar')?'requieren aprobación':'en proceso'}</div></div>
    </div>
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:10px">Solicitudes recientes</div>
    ${tTabla(flS.slice(0,15),hP('aprobar'))}
  </div>`;
};

// ── SELECCIONAR VEHÍCULO ──
window.flSelVeh=function(id){
  vAct=id; tabAct='info'; vistaAct='detalle';
  navOn(null);
  vehOn(id);
  renderDet();
};

// ── RENDER DETALLE ──
function renderDet(){
  const v=flV.find(x=>x.id===vAct); if(!v) return;
  const d=hD(v.pv||v.poliza_venc);
  const alts=[];
  if(d!==null&&d<90) alts.push({t:d<0?'e':'w',txt:`Póliza de seguro ${d<0?'VENCIDA':'por vencer el '+(v.pv||v.poliza_venc)}`});
  const pA=hP('aprobar'), eA=hAdmin();
  const fotos=v.fotos||[];

  document.getElementById('fl-main').innerHTML=`<div class="fl-in">

    <!-- HERO — Car Rental App style -->
    <div class="fl-hero">
      <div class="fl-hero-bg"></div>
      <div class="fl-hero-dots"></div>
      <div class="fl-hero-top">
        <div style="position:relative;z-index:1">
          <div class="fl-hero-badge">UNIDAD ${v.eco} · ${v.plaza||'—'}</div>
          <div class="fl-hero-name">${v.unidad||v.modelo||'—'}</div>
          <div class="fl-hero-year">${v.año||v.anio||'—'} · ${(v.tipo||'auto').charAt(0).toUpperCase()+(v.tipo||'auto').slice(1)}</div>
          <div class="fl-hero-tags">
            <span class="fl-hero-tag">${I.map} ${v.plaza||'—'}</span>
            <span class="fl-hero-tag">${I.user} ${v.responsable||'Sin asignar'}</span>
            <span class="fl-hero-tag">🎨 ${v.color||'—'}</span>
            ${(v.nip||v.nipOxxo)?`<span class="fl-hero-tag">${I.fuel} NIP: ${v.nip||v.nipOxxo}</span>`:''}
          </div>
        </div>
        <div class="fl-hero-right">
          <div class="fl-hero-emo">${hEmo(v.tipo)}</div>
          <div><span class="fl-hero-status fl-hs-${v.status||'activo'}">${(v.status||'Activo').toUpperCase()}</span></div>
          <button class="fb outline" style="margin-top:10px;font-size:11px" onclick="flHome()">← Volver</button>
        </div>
      </div>

      <!-- FOTOS DEL VEHÍCULO -->
      <div class="fl-hero-fotos">
        <span class="fl-foto-lbl">${I.camera} Fotos</span>
        ${fotos.map((f,i)=>`<img class="fl-foto-thumb" src="${f}" onclick="flVerImg('${f}')" title="Ver foto ${i+1}">`).join('')}
        ${eA?`
          <label class="fl-foto-add" onclick="document.getElementById('fl-foto-input-${v.id}').click()">
            ${I.plus}
            <span>Subir</span>
          </label>
          <input type="file" id="fl-foto-input-${v.id}" accept="image/*" multiple style="display:none"
            onchange="flSubirFotos(this,'${v.id}')">
        `:''}
      </div>
    </div>

    ${alts.length?`<div class="fl-alts">${alts.map(a=>`<div class="fl-alt ${a.t}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}

    <!-- SPECS -->
    <div class="fl-specs">
      <div class="fl-spec"><div class="fl-spec-l">Placas</div><div class="fl-spec-v">${v.placas||'—'}</div><div class="fl-spec-s">número de placa</div></div>
      <div class="fl-spec"><div class="fl-spec-l">Año modelo</div><div class="fl-spec-v">${v.año||v.anio||'—'}</div><div class="fl-spec-s">${new Date().getFullYear()-(v.año||v.anio||new Date().getFullYear())} años</div></div>
      <div class="fl-spec"><div class="fl-spec-l">Kilometraje</div><div class="fl-spec-v">${v.km?(+v.km).toLocaleString():'—'}</div><div class="fl-spec-s">km recorridos</div></div>
      <div class="fl-spec"><div class="fl-spec-l">Póliza vence</div><div class="fl-spec-v" style="font-size:13px;color:${hDC(d)}">${hF(v.pv||v.poliza_venc)}</div><div class="fl-spec-s">${hDL(d)}</div></div>
    </div>

    <!-- TABS -->
    <div class="fl-tabs">
      <button class="fl-tab ${tabAct==='info'       ?'on':''}" onclick="flTab('info')">Información</button>
      <button class="fl-tab ${tabAct==='docs'       ?'on':''}" onclick="flTab('docs')">Documentos</button>
      <button class="fl-tab ${tabAct==='historial'  ?'on':''}" onclick="flTab('historial')">Historial</button>
      <button class="fl-tab ${tabAct==='checklist'  ?'on':''}" onclick="flTab('checklist')">Inspección</button>
      <button class="fl-tab ${tabAct==='solicitudes'?'on':''}" onclick="flTab('solicitudes')">Solicitudes</button>
    </div>

    <div id="fl-tc">
      ${tabAct==='info'        ?tInfo(v,eA)     :''}
      ${tabAct==='docs'        ?tDocs(v)         :''}
      ${tabAct==='historial'   ?tHistorial(v)    :''}
      ${tabAct==='checklist'   ?tChecklist(v)    :''}
      ${tabAct==='solicitudes' ?tSolsV(v,pA)     :''}
    </div>
  </div>`;
}

window.flTab=t=>{tabAct=t;renderDet();};

// SUBIR FOTOS AL VEHÍCULO
window.flSubirFotos=async function(input,id){
  const files=Array.from(input.files); if(!files.length) return;
  const nuevas=await Promise.all(files.map(f=>new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(f);})));
  const v=flV.find(x=>x.id===id); if(!v) return;
  v.fotos=[...(v.fotos||[]),...nuevas];
  try{
    if(id.startsWith('eco-')){
      // Crear documento en Firestore
      const {id:newId}=await fs.addDoc(fs.collection(db,C.VEHS),{...v,fotos:v.fotos});
      v.id=newId;
    } else {
      await fs.updateDoc(fs.doc(db,C.VEHS,id),{fotos:v.fotos});
    }
  }catch(e){console.warn('[FLOTILLA] No se pudo guardar foto en Firestore:',e.message);}
  renderDet();
};

// ── TAB INFO ──
function tInfo(v,eA){
  const d=hD(v.pv||v.poliza_venc);
  return `<div style="display:grid;grid-template-columns:1fr 210px;gap:14px;align-items:start">
    <div class="fl-ig">
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>Número económico</dt><dd>${v.eco||'—'}</dd></dl><dl class="fl-ig-c"><dt>Placas</dt><dd class="mono">${v.placas||'—'}</dd></dl></div>
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>Unidad / Descripción</dt><dd>${v.unidad||'—'}</dd></dl><dl class="fl-ig-c"><dt>Año modelo</dt><dd>${v.año||v.anio||'—'}</dd></dl></div>
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>Número de serie / VIN</dt><dd class="mono" style="font-size:10px">${v.serie||'—'}</dd></dl><dl class="fl-ig-c"><dt>Color</dt><dd>${v.color||'—'}</dd></dl></div>
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>Plaza / Región</dt><dd>${v.plaza||'—'}</dd></dl><dl class="fl-ig-c"><dt>Tipo de unidad</dt><dd style="text-transform:capitalize">${v.tipo||'—'}</dd></dl></div>
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>Responsable asignado</dt><dd>${v.responsable||'—'}</dd></dl><dl class="fl-ig-c"><dt>Kilometraje actual</dt><dd>${v.km?(+v.km).toLocaleString()+' km':'—'}</dd></dl></div>
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>NIP Oxxo Gas</dt><dd class="mono">${v.nip||v.nipOxxo||'—'}</dd></dl><dl class="fl-ig-c"><dt>Estatus</dt><dd>${hBadge(v.status||'activo')}</dd></dl></div>
      <div class="fl-ig-r"><dl class="fl-ig-c"><dt>Póliza de seguro</dt><dd class="mono">${v.pol||v.poliza||'—'}</dd></dl><dl class="fl-ig-c"><dt>Rendimiento</dt><dd>${v.rend||v.rendimiento||'—'}</dd></dl></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${gauge(v.rend||v.rendimiento)}
      <div class="fl-pol">
        <div class="fl-pol-head">
          <div class="fl-pol-ico" style="background:${d===null||d>=90?'rgba(34,197,94,.2)':d<0?'rgba(239,68,68,.2)':'rgba(245,158,11,.2)'}">🛡️</div>
          <div><div class="fl-pol-title">${I.shield} Póliza de seguro</div></div>
        </div>
        <div class="fl-pol-num">${v.pol||v.poliza||'—'}</div>
        <div class="fl-pol-exp" style="color:${hDC(d)}">${hF(v.pv||v.poliza_venc)} · ${hDL(d)}</div>
      </div>
      ${eA?`<div style="background:#F8FAFD;border:1px solid #E8EDF5;border-radius:10px;padding:12px">
        <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:8px">✍️ Responsiva firmada</div>
        <button class="fl-up" onclick="document.getElementById('fl-resp-inp').click()" style="font-size:11px">${I.upload} Subir documento</button>
        <input type="file" id="fl-resp-inp" accept=".pdf,image/*" style="display:none">
        ${v.responsiva_url?`<a href="${v.responsiva_url}" target="_blank" style="display:block;margin-top:6px;color:#2563EB;font-size:11px;font-weight:600">${I.doc} Ver responsiva actual</a>`:''}
      </div>`:''}
    </div>
  </div>`;
}

// ── TAB DOCS ──
function tDocs(v){
  const docs=[
    {n:'Póliza de seguro',d:v.pv||v.poliza_venc,ico:'🛡️'},
    {n:'Verificación ambiental',d:v.verificacion_venc,ico:'✅'},
    {n:'Tarjeta de circulación',d:v.circulacion_venc,ico:'🪪'},
    {n:'Tenencia',d:v.tenencia_venc,ico:'🏛️'},
    {n:'Factura / Título',d:null,ico:'📑'},
    {n:'Responsiva firmada',d:null,ico:'✍️'},
    {n:'Holograma verificación',d:null,ico:'🔰'},
    {n:'Tag caseta / telepeaje',d:null,ico:'🛣️'},
  ];
  return`<div class="fl-tw"><table class="fl-t"><thead><tr><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Archivo</th></tr></thead><tbody>${
    docs.map(d=>{const di=hD(d.d);const cls=di===null?'gr':di<0?'r':di<90?'a':'g';const txt=di===null?'Sin fecha':di<0?'Vencido':di<90?'Por vencer':'Vigente';
    return`<tr><td><span style="display:flex;align-items:center;gap:6px">${d.ico} <strong>${d.n}</strong></span></td><td><span class="mono" style="font-size:11px">${hF(d.d)}</span></td><td><span class="fl-b ${cls}">${txt}</span></td><td><div style="display:flex;gap:5px"><button class="fl-pill">${I.doc} Ver</button><button class="fl-pill">${I.upload} Subir</button></div></td></tr>`;
    }).join('')
  }</tbody></table></div>`;
}

// ── TAB HISTORIAL ──
function tHistorial(v){
  const hist=v.historial||[];
  if(!hist.length) return`<div class="fl-empty"><div class="fl-ei">📋</div><h3>Sin historial</h3><p>No hay registros de mantenimiento o servicios.</p></div>`;
  const im={mantenimiento:'🔧',taller:'🏭',incidencia:'⚠️',servicio:'🔩',inspeccion:'📋'};
  const ib={mantenimiento:'#FEF3C7',taller:'#FEE2E2',incidencia:'#FEF3C7',servicio:'#EFF6FF',inspeccion:'#F5F3FF'};
  return`<div class="fl-tl">${hist.map(h=>`<div class="fl-tl-i"><div class="fl-tl-ic" style="background:${ib[h.tipo]||'#F1F5F9'}">${im[h.tipo]||'📋'}</div><div><div class="fl-tl-t">${h.titulo||'—'}</div><div class="fl-tl-m">${h.fecha||''}${h.costo?' · '+h.costo:''}</div>${h.descripcion?`<div class="fl-tl-d">${h.descripcion}</div>`:''}</div></div>`).join('')}</div>`;
}

// ── TAB CHECKLIST ──
function tChecklist(v){
  chkFotos={};
  const zonas=[
    {key:'cristales', label:'Cristales',   ico:'🪟', bg:'linear-gradient(135deg,#1E3A5F,#2563EB)', foto:true, items:CHK.cristales},
    {key:'espejos',   label:'Espejos',     ico:'🔵', bg:'linear-gradient(135deg,#1E3A5F,#2563EB)', foto:true, items:CHK.espejos},
    {key:'neumaticos',label:'Neumáticos',  ico:'⚙️', bg:'linear-gradient(135deg,#1E3A5F,#2563EB)', foto:true, items:CHK.neumaticos},
    {key:'interiores',label:'Interiores',  ico:'🚗', bg:'linear-gradient(135deg,#374151,#4B5563)', foto:false,items:CHK.interiores},
    {key:'motor',     label:'Motor',       ico:'🔧', bg:'linear-gradient(135deg,#374151,#4B5563)', foto:false,items:CHK.motor},
    {key:'cajuela',   label:'Cajuela',     ico:'🧰', bg:'linear-gradient(135deg,#374151,#4B5563)', foto:false,items:CHK.cajuela},
  ];
  return`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:800;color:#0A0F1E">Inspección Visual · Unidad ${v.eco}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">Realizada por: <strong>${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</strong> · ${new Date().toLocaleDateString('es-MX')}</div>
      </div>
      <button class="fb accent" onclick="flGuardarInsp('${v.id}')">${I.check} Guardar inspección</button>
    </div>
    ${zonas.map(z=>`
      <div class="fl-chk-z">
        <div class="fl-chk-zh" style="background:${z.bg}">${z.ico} ${z.label}${z.foto?` <span style="background:rgba(255,255,255,.15);padding:1px 8px;border-radius:100px;font-size:8.5px">FOTO OBLIGATORIA</span>`:''}</div>
        ${z.items.map((item,i)=>`
          <div class="fl-chk-item">
            <span class="fl-chk-lbl">${item}</span>
            ${z.foto?`<label class="fl-chk-fp" id="fl-fp-${z.key}-${i}" onclick="document.getElementById('fl-fi-${z.key}-${i}').click()">${I.camera} <span id="fl-fl-${z.key}-${i}">Foto</span></label>
            <input type="file" id="fl-fi-${z.key}-${i}" accept="image/*" style="display:none" onchange="flFotoChk(this,'${z.key}',${i})">`:
            `<span></span>`}
            <div class="fl-chk-yesno">
              <div class="fl-chk-y" data-s="${z.key}" data-i="${i}" onclick="flChkT(this,'si')">✓</div>
              <div class="fl-chk-n" data-s="${z.key}" data-i="${i}" onclick="flChkT(this,'no')">✗</div>
            </div>
          </div>`).join('')}
      </div>`).join('')}
    <div class="fl-chk-legal">
      <div class="fl-chk-lh">⚖️ Validación Legal — Solo Encargado de Flotilla</div>
      ${CHK.legal.map((item,i)=>`
        <div class="fl-chk-item" style="background:transparent">
          <span class="fl-chk-lbl">${item}</span><span></span>
          <div class="fl-chk-yesno">
            <div class="fl-chk-y" data-s="legal" data-i="${i}" onclick="flChkT(this,'si')">✓</div>
            <div class="fl-chk-n" data-s="legal" data-i="${i}" onclick="flChkT(this,'no')">✗</div>
          </div>
        </div>`).join('')}
    </div>
    <div style="margin-top:12px">
      <div class="fl-fld"><label>Comentarios y observaciones</label><textarea id="fl-chk-obs" placeholder="Daños encontrados, notas adicionales de la revisión…" style="margin-top:4px;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;width:100%;min-height:80px;background:#F8FAFD;outline:none;resize:vertical;color:#0A0F1E"></textarea></div>
    </div>`;
}

window.flFotoChk=function(input,sec,i){
  const f=input.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=e=>{
    if(!chkFotos[sec]) chkFotos[sec]={};
    chkFotos[sec][i]=e.target.result;
    const lbl=document.getElementById(`fl-fl-${sec}-${i}`);
    const btn=document.getElementById(`fl-fp-${sec}-${i}`);
    if(lbl) lbl.textContent='✓ '+f.name.substring(0,10);
    if(btn) btn.classList.add('has');
  };
  r.readAsDataURL(f);
};

window.flChkT=function(el,val){
  const s=el.dataset.s,i=el.dataset.i;
  document.querySelector(`.fl-chk-y[data-s="${s}"][data-i="${i}"]`)?.classList.remove('on');
  document.querySelector(`.fl-chk-n[data-s="${s}"][data-i="${i}"]`)?.classList.remove('on');
  el.classList.add('on');
};

window.flGuardarInsp=async function(id){
  const res={};
  Object.keys(CHK).forEach(sec=>{
    res[sec]={};
    CHK[sec].forEach((item,i)=>{
      const y=document.querySelector(`.fl-chk-y[data-s="${sec}"][data-i="${i}"]`);
      const n=document.querySelector(`.fl-chk-n[data-s="${sec}"][data-i="${i}"]`);
      res[sec][item]={estado:y?.classList.contains('on')?'si':n?.classList.contains('on')?'no':'—',foto:chkFotos[sec]?.[i]||null};
    });
  });
  res.comentarios=document.getElementById('fl-chk-obs')?.value||'';
  res.fecha=new Date().toISOString();
  res.vehiculoId=id;
  res.vehiculoEco=flV.find(v=>v.id===id)?.eco||'';
  res.realizadoPor=window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Usuario';
  res.realizadoPorEmail=window.auth?.currentUser?.email||'';
  try{
    await fs.addDoc(fs.collection(db,C.INSP),res);
    if(window.mostrarPush) window.mostrarPush('Inspección guardada','','✓');
    else alert('Inspección guardada correctamente.');
    chkFotos={};
  }catch(e){console.error(e);alert('Error al guardar.');}
};

// ── TAB SOLICITUDES VEHÍCULO ──
function tSolsV(v,pA){
  const sols=flS.filter(s=>s.vehiculoId===v.id||s.vehiculoEco===v.eco||(s.vehiculo||'').includes(v.eco));
  if(!sols.length) return`<div class="fl-empty"><div class="fl-ei">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes para esta unidad.</p></div>`;
  return tTabla(sols,pA);
}

// ── SOLICITUDES GLOBAL ──
window.flSolsAll=function(){
  vAct=null; vistaAct='solicitudes';
  navOn('fl-ni-sols');
  document.querySelectorAll('#flotilla-dashboard .fl-vi').forEach(e=>e.classList.remove('on'));
  const pA=hP('aprobar');
  document.getElementById('fl-main').innerHTML=`<div class="fl-in">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div><div style="font-size:20px;font-weight:800;letter-spacing:-.5px">Todas las solicitudes</div><div style="font-size:12px;color:#64748B;margin-top:3px">${flS.length} registros</div></div>
      <button class="fb outline" style="color:#0A1628;background:#fff;border-color:#E8EDF5" onclick="flHome()">← Panel</button>
    </div>
    ${tTabla(flS,pA)}
  </div>`;
};

// ── TABLA ──
function tTabla(sols,pA){
  if(!sols.length) return`<div class="fl-empty"><div class="fl-ei">📋</div><h3>Sin solicitudes</h3><p>No hay registros.</p></div>`;
  return`<div class="fl-tw"><table class="fl-t"><thead><tr><th>Tipo</th><th>Unidad</th><th>Solicitante</th><th>Cotización</th><th>Estado</th><th>Fecha</th>${pA?'<th>Acción</th>':''}</tr></thead><tbody>${
    sols.map(s=>`<tr onclick="flVerSol('${s.id}')">
      <td><strong style="font-size:12px">${s.tipo||'—'}</strong></td>
      <td><span class="mono" style="font-size:11px">${s.vehiculoEco||s.vehiculo||'—'}</span></td>
      <td style="font-size:11.5px">${s.solicitante||s.creadoPor||'—'}</td>
      <td style="font-weight:700">${s.cotizacion||'—'}</td>
      <td>${hBadge(s.estatus)}</td>
      <td style="font-size:10.5px;color:#94A3B8">${hF(s.creadoEn||s.fecha||'')}</td>
      ${pA?`<td onclick="event.stopPropagation()">${(s.estatus==='Validada'||s.estatus==='Cotización')?`<div style="display:flex;gap:4px"><button class="fb accent" style="padding:4px 8px;font-size:10px" onclick="flAprobar('${s.id}')">✓</button><button class="fb outline" style="padding:4px 8px;font-size:10px;border-color:#FCA5A5;color:#B91C1C" onclick="flRechazar('${s.id}')">✗</button></div>`:'—'}</td>`:''}</tr>`
  ).join('')}</tbody></table></div>`;
}

// ── VER SOLICITUD MODAL ──
window.flVerSol=function(id){
  const s=flS.find(x=>x.id===id); if(!s) return;
  const pA=hP('aprobar'),pV=hP('validar'),pC=hP('subir_cotizacion'),pE=hP('eliminar');
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>Solicitud · ${id.substring(0,8).toUpperCase()}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div class="fl-sg">
        <dl class="fl-sc"><dt>Tipo</dt><dd>${s.tipo||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Estado</dt><dd>${hBadge(s.estatus)}</dd></dl>
        <dl class="fl-sc"><dt>Unidad</dt><dd>${s.vehiculoEco||s.vehiculo||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Cotización</dt><dd style="font-weight:800;font-size:14px">${s.cotizacion||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Taller / Proveedor</dt><dd>${s.taller||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Solicitante</dt><dd>${s.solicitante||s.creadoPor||'—'}</dd></dl>
        <dl class="fl-sc full"><dt>Descripción</dt><dd>${s.descripcion||'—'}</dd></dl>
      </div>
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:9px 12px;font-size:11.5px;color:#991B1B;margin-top:10px"><strong>Motivo rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
      ${s.evidencias&&s.evidencias.length?`<div style="height:1px;background:#F1F5F9;margin:12px 0"></div><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px">Evidencias (${s.evidencias.length})</div><div class="fl-pills">${s.evidencias.map((e,i)=>`<button class="fl-pill" onclick="flVerImg('${e}')">📷 Foto ${i+1}</button>`).join('')}</div>`:''}
      <div style="height:1px;background:#F1F5F9;margin:12px 0"></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        ${(pV&&s.estatus==='Solicitud')?`<button class="fb accent" onclick="flEstatus('${s.id}','Validada');this.closest('.fl-ov').remove()">✓ Validar</button>`:''}
        ${((pC||pV)&&s.estatus==='Validada')?`<button class="fb outline" style="color:#0A1628;background:#fff;border-color:#E8EDF5" onclick="flCotizar('${s.id}')">Registrar cotización</button>`:''}
        ${(pA&&(s.estatus==='Validada'||s.estatus==='Cotización'))?`<button class="fb accent" onclick="flAprobar('${s.id}');this.closest('.fl-ov').remove()">✓ Aprobar</button><button class="fb outline" style="border-color:#FCA5A5;color:#B91C1C" onclick="flRechazar('${s.id}');this.closest('.fl-ov').remove()">✗ Rechazar</button>`:''}
        ${(pV&&s.estatus==='Aprobada')?`<button class="fb outline" style="color:#0A1628;background:#fff;border-color:#E8EDF5" onclick="flEstatus('${s.id}','Cierre');this.closest('.fl-ov').remove()">Enviar a cierre</button>`:''}
        ${(pV&&s.estatus==='Cierre')?`<button class="fb outline" style="color:#0A1628;background:#fff;border-color:#E8EDF5" onclick="flEstatus('${s.id}','Cerrada');this.closest('.fl-ov').remove()">Marcar cerrada</button>`:''}
        ${pE?`<button class="fb outline" style="border-color:#FCA5A5;color:#B91C1C;margin-left:auto" onclick="flEliminar('${s.id}');this.closest('.fl-ov').remove()">Eliminar</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ── ACCIONES ──
window.flEstatus=async(id,est)=>{
  try{await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:est,actualizadoEn:new Date().toISOString()});await loadSols();flRefresh();}
  catch(e){console.error('[FLOTILLA]',e);}
};
window.flAprobar=id=>flEstatus(id,'Aprobada');
window.flRechazar=async id=>{
  const m=prompt('Motivo del rechazo:'); if(!m||!m.trim()) return;
  try{await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:'Rechazada',comentarioRechazo:m,actualizadoEn:new Date().toISOString()});await loadSols();flRefresh();}
  catch(e){console.error('[FLOTILLA]',e);}
};
window.flEliminar=async id=>{
  if(!confirm('¿Eliminar solicitud? No se puede deshacer.')) return;
  try{await fs.deleteDoc(fs.doc(db,C.SOLS,id));await loadSols();flRefresh();}
  catch(e){console.error('[FLOTILLA]',e);}
};
window.flCotizar=id=>{
  const s=flS.find(x=>x.id===id);
  const m=prompt('Monto de cotización:',s?.cotizacion||''); if(m===null) return;
  const t=prompt('Taller / Proveedor:',s?.taller||'');      if(t===null) return;
  fs.updateDoc(fs.doc(db,C.SOLS,id),{cotizacion:m,taller:t,estatus:'Cotización',actualizadoEn:new Date().toISOString()})
    .then(async()=>{await loadSols();document.querySelector('.fl-ov')?.remove();flRefresh();});
};
window.flVerImg=src=>{
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.cursor='zoom-out';
  ov.innerHTML=`<img src="${src}" style="max-width:92%;max-height:92%;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.5)">`;
  ov.onclick=()=>ov.remove();document.body.appendChild(ov);
};

function flRefresh(){
  if(vistaAct==='home')             flHome();
  else if(vistaAct==='detalle')     renderDet();
  else if(vistaAct==='solicitudes') flSolsAll();
  else if(vistaAct==='comisiones')  flComisVista();
  else if(vistaAct==='bajas')       flBajasVista();
}

// ── MAPA DE DAÑOS (estado) ──
let dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};solEvidencias=[];

function dmgSVG(vista){
  const w=260,h=130;
  // Formas base por vista
  const shapes={
    frente:`
      <rect x="80" y="20" width="100" height="80" rx="12" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="88" y="28" width="84" height="36" rx="6" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="88" y="70" width="38" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>
      <rect x="134" y="70" width="38" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>
      <circle cx="94" cy="98" r="10" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <circle cx="166" cy="98" r="10" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="114" y="84" width="32" height="8" rx="3" fill="#94A3B8"/>`,
    trasera:`
      <rect x="80" y="20" width="100" height="80" rx="12" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="88" y="28" width="84" height="36" rx="6" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="88" y="70" width="38" height="16" rx="4" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>
      <rect x="134" y="70" width="38" height="16" rx="4" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>
      <circle cx="94" cy="98" r="10" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <circle cx="166" cy="98" r="10" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="114" y="86" width="32" height="5" rx="2" fill="#94A3B8"/>`,
    lateral_izq:`
      <ellipse cx="75" cy="92" rx="16" ry="16" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <ellipse cx="185" cy="92" rx="16" ry="16" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="48" y="55" width="164" height="42" rx="8" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="58" y="28" width="80" height="30" rx="6" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="144" y="30" width="42" height="26" rx="5" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="44" y="62" width="20" height="16" rx="3" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>`,
    lateral_der:`
      <ellipse cx="75" cy="92" rx="16" ry="16" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <ellipse cx="185" cy="92" rx="16" ry="16" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="48" y="55" width="164" height="42" rx="8" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="122" y="28" width="80" height="30" rx="6" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="74" y="30" width="42" height="26" rx="5" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="196" y="62" width="20" height="16" rx="3" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>`,
  };
  const pts=(dmgPts[vista]||[]).map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#EF4444" stroke="#fff" stroke-width="2" opacity=".9"/><text x="${p.x}" y="${p.y+3}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">${i+1}</text>`).join('');
  const nom={frente:'Frente',trasera:'Trasera',lateral_izq:'Lateral Izq.',lateral_der:'Lateral Der.'};
  return`<div class="fl-dmg-view" id="fl-dv-${vista}" onclick="flDmgClick(event,'${vista}')">
    <div class="fl-dmg-lbl">${nom[vista]} <button onclick="event.stopPropagation();flDmgLimpiar('${vista}')">✕ Limpiar</button></div>
    <svg id="fl-ds-${vista}" width="100%" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      ${shapes[vista]}
      <g id="fl-dp-${vista}">${pts}</g>
    </svg>
    <div class="fl-dmg-pts" id="fl-dpt-${vista}" style="padding:0 8px 5px">${(dmgPts[vista]||[]).length?`${dmgPts[vista].length} punto(s) marcado(s)`:'Sin daños marcados'}</div>
  </div>`;
}

window.flDmgClick=function(e,vista){
  const svg=document.getElementById('fl-ds-'+vista);
  if(!svg) return;
  const rect=svg.getBoundingClientRect();
  const vb=svg.viewBox.baseVal;
  const x=((e.clientX-rect.left)/rect.width)*vb.width;
  const y=((e.clientY-rect.top)/rect.height)*vb.height;
  if(!dmgPts[vista]) dmgPts[vista]=[];
  dmgPts[vista].push({x:Math.round(x),y:Math.round(y)});
  // Re-render solo el grupo de puntos
  const g=document.getElementById('fl-dp-'+vista);
  if(g) g.innerHTML=dmgPts[vista].map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="7" fill="#EF4444" stroke="#fff" stroke-width="2" opacity=".9"/><text x="${p.x}" y="${p.y+3}" text-anchor="middle" font-size="7" font-weight="800" fill="#fff">${i+1}</text>`).join('');
  const lbl=document.getElementById('fl-dpt-'+vista);
  if(lbl) lbl.textContent=`${dmgPts[vista].length} punto(s) marcado(s)`;
};
window.flDmgLimpiar=function(vista){
  dmgPts[vista]=[];
  const g=document.getElementById('fl-dp-'+vista);
  if(g) g.innerHTML='';
  const lbl=document.getElementById('fl-dpt-'+vista);
  if(lbl) lbl.textContent='Sin daños marcados';
};

// ── NUEVA SOLICITUD — MODAL ──
window.flAbrirModal=function(ecoPresel){
  dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
  const TIPOS=['Mantenimiento preventivo','Mantenimiento correctivo','Reposición de llanta','Falla eléctrica','Siniestro / Accidente','Revisión de documentos','Otro','Personalizado…'];
  const vehs=flV.filter(v=>v.status!=='baja');
  const ov=document.createElement('div'); ov.className='fl-ov'; ov.id='fl-modal-nueva';
  ov.innerHTML=`<div class="fl-modal" style="max-width:640px">
    <div class="fl-mh">
      <h3>${I.plus} Nueva solicitud de servicio</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      <div class="fl-form">

        <!-- SELECTOR VEHÍCULO -->
        <div class="fl-fld">
          <label>Unidad / Vehículo</label>
          <select id="fl-s-veh" onchange="flModalSelVeh(this.value)">
            <option value="">— Selecciona una unidad —</option>
            ${vehs.map(v=>`<option value="${v.id}" ${ecoPresel&&v.eco===ecoPresel?'selected':''}>${v.eco} · ${v.unidad||'—'} · ${v.placas||'—'}</option>`).join('')}
          </select>
        </div>

        <!-- PANEL INFO VEHÍCULO (solo al seleccionar) -->
        <div class="fl-sol-vh" id="fl-sol-vh-panel">
          <div class="fl-sol-vh-top">${I.car} Información del vehículo</div>
          <div class="fl-sol-vh-name" id="fl-svh-nombre">—</div>
          <div class="fl-sol-vh-sub" id="fl-svh-sub">—</div>
          <div class="fl-sol-vh-row">
            <dl class="fl-sol-vh-d"><dt>Placas</dt><dd id="fl-svh-placas">—</dd></dl>
            <dl class="fl-sol-vh-d"><dt>Responsable</dt><dd id="fl-svh-resp">—</dd></dl>
            <dl class="fl-sol-vh-d"><dt>Status</dt><dd id="fl-svh-status">—</dd></dl>
          </div>
        </div>

        <!-- TIPO DE SOLICITUD -->
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Tipo de solicitud</label>
            <select id="fl-s-tipo" onchange="flModalTipo(this.value)">
              <option value="">— Selecciona —</option>
              ${TIPOS.slice(0,7).map(t=>`<option value="${t}">${t}</option>`).join('')}
              <option value="__custom__">Otro / Personalizado…</option>
            </select>
            <div id="fl-tipo-custom-wrap">
              <input type="text" id="fl-s-tipo-custom" placeholder="Describe el tipo de solicitud…" style="margin-top:6px">
            </div>
          </div>
          <div class="fl-fld">
            <label>Prioridad</label>
            <select id="fl-s-prior">
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
        </div>

        <!-- DESCRIPCIÓN -->
        <div class="fl-fld">
          <label>Descripción del problema</label>
          <textarea id="fl-s-desc" placeholder="Describe el problema o servicio que se requiere…"></textarea>
        </div>

        <!-- KILOMETRAJE + TALLER -->
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Kilometraje actual (km)</label>
            <input type="number" id="fl-s-km" placeholder="Ej. 85000">
          </div>
          <div class="fl-fld">
            <label>Taller sugerido (opcional)</label>
            <input type="text" id="fl-s-taller" placeholder="Nombre del taller">
          </div>
        </div>

        <!-- SVG DAÑOS -->
        <div>
          <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:6px">${I.alert} Marcar zonas dañadas <span style="font-size:10px;font-weight:500;color:#94A3B8;text-transform:none">(clic en la vista para agregar punto)</span></div>
          <div class="fl-dmg-wrap">
            ${dmgSVG('frente')}
            ${dmgSVG('trasera')}
            ${dmgSVG('lateral_izq')}
            ${dmgSVG('lateral_der')}
          </div>
        </div>

        <!-- EVIDENCIAS -->
        <div class="fl-fld">
          <label>${I.camera} Evidencias fotográficas</label>
          <label class="fl-up" onclick="document.getElementById('fl-s-ev-inp').click()">
            ${I.upload} Subir fotos (múltiple)
          </label>
          <input type="file" id="fl-s-ev-inp" accept="image/*" multiple style="display:none" onchange="flModalEv(this)">
          <div class="fl-pills" id="fl-s-ev-pills"></div>
        </div>

        <!-- SOLICITANTE (automático) -->
        <div class="fl-fasig">
          ${I.user} Solicitante: <strong>${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</strong>
        </div>

        <div class="fl-fa">
          <button class="fb outline" style="color:#0A1628;background:#fff;border-color:#E8EDF5" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
          <button class="fb accent" onclick="flGuardarSol()">${I.check} Crear solicitud</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  // Si viene con vehículo preseleccionado
  if(ecoPresel){
    const sel=document.getElementById('fl-s-veh');
    if(sel) flModalSelVeh(sel.value);
  }
};

window.flModalSelVeh=function(id){
  const panel=document.getElementById('fl-sol-vh-panel'); if(!panel) return;
  if(!id){panel.classList.remove('vis');return;}
  const v=flV.find(x=>x.id===id); if(!v){panel.classList.remove('vis');return;}
  document.getElementById('fl-svh-nombre').textContent=`${v.unidad||'—'}`;
  document.getElementById('fl-svh-sub').textContent=`ECO ${v.eco} · Año ${v.año||v.anio||'—'} · ${v.color||'—'}`;
  document.getElementById('fl-svh-placas').textContent=v.placas||'—';
  document.getElementById('fl-svh-resp').textContent=(v.responsable||'Sin asignar').split(' ')[0];
  document.getElementById('fl-svh-status').textContent=(v.status||'activo').toUpperCase();
  panel.classList.add('vis');
};

window.flModalTipo=function(val){
  const wrap=document.getElementById('fl-tipo-custom-wrap'); if(!wrap) return;
  wrap.classList.toggle('vis',val==='__custom__');
  if(val==='__custom__') document.getElementById('fl-s-tipo-custom')?.focus();
};

let solEvidencias=[];
window.flModalEv=function(input){
  const files=Array.from(input.files); if(!files.length) return;
  files.forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{
      solEvidencias.push(e.target.result);
      const pills=document.getElementById('fl-s-ev-pills');
      if(pills) pills.innerHTML=solEvidencias.map((b,i)=>`<span class="fl-pill">${I.camera} Foto ${i+1}</span>`).join('');
    };
    r.readAsDataURL(f);
  });
};

window.flGuardarSol=async function(){
  const vId=document.getElementById('fl-s-veh')?.value;
  const tipoRaw=document.getElementById('fl-s-tipo')?.value;
  const tipoCustom=document.getElementById('fl-s-tipo-custom')?.value?.trim();
  const tipo=tipoRaw==='__custom__'?(tipoCustom||'Personalizado'):tipoRaw;
  const desc=document.getElementById('fl-s-desc')?.value?.trim();
  const km=document.getElementById('fl-s-km')?.value;
  const taller=document.getElementById('fl-s-taller')?.value?.trim();
  const prior=document.getElementById('fl-s-prior')?.value||'Normal';

  if(!vId){alert('Selecciona una unidad.');return;}
  if(!tipo){alert('Selecciona el tipo de solicitud.');return;}
  if(!desc){alert('Describe el problema.');return;}

  const v=flV.find(x=>x.id===vId);
  const doc={
    vehiculoId:vId,
    vehiculoEco:v?.eco||'',
    vehiculo:`${v?.eco} · ${v?.unidad||''}`,
    tipo,
    prioridad:prior,
    descripcion:desc,
    kilometrajeReportado:km||'',
    taller:taller||'',
    estatus:'Solicitud',
    solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
    creadoPor:window.auth?.currentUser?.email||'',
    creadoEn:new Date().toISOString(),
    evidencias:solEvidencias,
    danos:{frente:dmgPts.frente,trasera:dmgPts.trasera,lateral_izq:dmgPts.lateral_izq,lateral_der:dmgPts.lateral_der},
  };

  const btn=document.querySelector('#fl-modal-nueva .fb.accent');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    await fs.addDoc(fs.collection(db,C.SOLS),doc);
    // Actualizar km del vehículo si se proporcionó
    if(km&&v&&!v.id.startsWith('eco-')){
      await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{km:Number(km)}).catch(()=>{});
    }
    solEvidencias=[];
    dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
    document.getElementById('fl-modal-nueva')?.remove();
    await loadSols();
    flRefresh();
    if(window.mostrarPush) window.mostrarPush('Solicitud creada','Se notificará al equipo de flotilla.','✓');
  }catch(e){
    console.error('[FLOTILLA]',e);
    alert('Error al guardar: '+e.message);
    if(btn){btn.disabled=false;btn.textContent=`${I.check} Crear solicitud`;}
  }
};  
console.log('[FLOTILLA v7] Gestión Vehicular Tecnocontrol — '+CAT.length+' unidades en catálogo');
})();
