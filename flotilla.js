// ══════════════════════════════════════════════════════════════
// flotilla.js v8 — Gestión Vehicular Tecnocontrol
// Arquitectura: Panel General · Solicitudes · Comisiones · Bajas
// ══════════════════════════════════════════════════════════════
(function () {
'use strict';

// ── COLECCIONES FIRESTORE ──
const C = {
  VEHS:  'flotilla_vehiculos',
  SOLS:  'flotilla_solicitudes',
  INSP:  'flotilla_inspecciones',
  COMIS: 'flotilla_comisiones',
};

// ── CATÁLOGO DE VEHÍCULOS ──
const CAT = [
  {eco:'15', unidad:'NISSAN NP300',      año:2017, plaza:'JUAREZ',     responsable:'JORGE GUERRERO',    placas:'DU6478A', serie:'3N6AD33A3HK869708', rend:'7 KM/L',    pv:'2026-09-24', pol:'794B05035M-17', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'16', unidad:'GRUA F-350',        año:2010, plaza:'CHIHUAHUA',  responsable:'CHIHUAHUA',         placas:'DU6497A', serie:'1FDEF3G59AEB23674',  rend:'5 KM/L',    pv:'2026-09-24', pol:'794B05035M-10', tipo:'camion',    color:'Blanco', nip:''},
  {eco:'17', unidad:'MARCH ACTIVE',      año:2017, plaza:'CHIHUAHUA',  responsable:'GUILLERMO',         placas:'EMB313A', serie:'3N1CK3CD5HL248558',  rend:'14.5 KM/L', pv:'2026-09-24', pol:'794B05035M-23', tipo:'auto',      color:'Blanco', nip:'1713'},
  {eco:'19', unidad:'RAM 700',           año:2017, plaza:'CHIHUAHUA',  responsable:'ROBERTO MUÑOZ',     placas:'DU6471A', serie:'9BD578458HY162606',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-20', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'21', unidad:'RAM 700',           año:2018, plaza:'JUAREZ',     responsable:'BENITO SOTO',       placas:'DU6470A', serie:'9BD578452JY210560',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-12', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'22', unidad:'RAM 700',           año:2018, plaza:'CHIHUAHUA',  responsable:'CHIHUAHUA',         placas:'DU6751A', serie:'9BD578456JY208715',  rend:'9 KM/L',    pv:'2026-09-24', pol:'794B05035M-13', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'23', unidad:'RAM 700',           año:2018, plaza:'CHIHUAHUA',  responsable:'SERGIO CARMONA',    placas:'DU6752A', serie:'9BD578454JY209023',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-14', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'26', unidad:'SEAT IBIZA',        año:2018, plaza:'CHIHUAHUA',  responsable:'MARTIN DE LA O',    placas:'EMB314A', serie:'VSBB2KJ1JR017261',   rend:'13 KM/L',   pv:'2026-09-24', pol:'794B05035M-19', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'31', unidad:'NP300 KANGOO',      año:2012, plaza:'CHIHUAHUA',  responsable:'DESARROLLOS',       placas:'DU6754A', serie:'3N6DD25T5CK018279',  rend:'8 KM/L',    pv:'2026-09-24', pol:'794B05035M-6',  tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'35', unidad:'ISUZU',             año:2019, plaza:'CHIHUAHUA',  responsable:'ALMACEN',           placas:'DU6495A', serie:'JAANPR755K7000178',  rend:'3.5 KM/L',  pv:'2026-09-24', pol:'794B05035M-9',  tipo:'camion',    color:'Blanco', nip:''},
  {eco:'36', unidad:'CAMION NISSAN CS',  año:2014, plaza:'CHIHUAHUA',  responsable:'LUIS LOPEZ',        placas:'DU6494A', serie:'3N6DD25T9EK019471',  rend:'8 KM/L',    pv:'2026-09-24', pol:'794B05035M-18', tipo:'camion',    color:'Blanco', nip:''},
  {eco:'37', unidad:'RAM 700',           año:2019, plaza:'JUAREZ',     responsable:'JUAREZ',            placas:'DU6493A', serie:'9BD578458KY323611',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-21', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'38', unidad:'RAM 700',           año:2019, plaza:'CHIHUAHUA',  responsable:'DIONICIO',          placas:'DU6492A', serie:'9BD578455KY324652',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-22', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'39', unidad:'L200',              año:2019, plaza:'CHIHUAHUA',  responsable:'SERGIO MENDOZA',    placas:'DU6491A', serie:'MMBL45G1KH043444',   rend:'10 KM/L',   pv:'2026-09-24', pol:'794B05035M-30', tipo:'camioneta', color:'Blanco', nip:'1339'},
  {eco:'40', unidad:'MARCH ACTIVE',      año:2019, plaza:'MONTERREY',  responsable:'IVAN SEPULVEDA',    placas:'DU6490A', serie:'3N6CK34N2KL230477',  rend:'10.5 KM/L', pv:'2026-09-24', pol:'794B05035M-2',  tipo:'auto',      color:'Blanco', nip:''},
  {eco:'43', unidad:'F-150 PICK-UP',     año:2012, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DU6488A', serie:'1FTMF1CM1CKD41243',  rend:'5.6 KM/L',  pv:'2026-09-24', pol:'794B05035M-5',  tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'47', unidad:'MARCH ACTIVE L4',   año:2019, plaza:'CHIHUAHUA',  responsable:'IDALY RUIZ',        placas:'EMB308A', serie:'3N1CK3CD5KL232108',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-24', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'48', unidad:'MARCH ACTIVE L4',   año:2019, plaza:'CHIHUAHUA',  responsable:'IVAN ARGENIS',      placas:'EMB309A', serie:'3N1CK3CD4KL232066',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-8',  tipo:'auto',      color:'Blanco', nip:''},
  {eco:'50', unidad:'FIESTA',            año:2018, plaza:'MONTERREY',  responsable:'IRVING SAUCEDO',    placas:'EMB310A', serie:'3FADP4BJ1JM128469',  rend:'11.3 KM/L', pv:'2026-09-24', pol:'794B05035M-11', tipo:'auto',      color:'Plata',  nip:''},
  {eco:'52', unidad:'MARCH',             año:2020, plaza:'MONTERREY',  responsable:'MONTERREY',         placas:'DU6486A', serie:'3N6CK34N3LL243692',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-26', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'54', unidad:'RAM 700 SLT',       año:2020, plaza:'CHIHUAHUA',  responsable:'RICARDO GONZALEZ',  placas:'DU6485A', serie:'9BD578452LY411572',  rend:'17.5 KM/L', pv:'2026-09-24', pol:'794B05035M-33', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'55', unidad:'MARCH',             año:2020, plaza:'MONTERREY',  responsable:'ROQUE LEAL',        placas:'DU6484A', serie:'3N6CK34N3LL248469',  rend:'11.7 KM/L', pv:'2026-09-24', pol:'794B05035M-27', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'56', unidad:'RAM 700 SLT',       año:2020, plaza:'PARRAL',     responsable:'PLAZA PARRAL',      placas:'DU6483A', serie:'9BD578451LY423955',  rend:'14.5 KM/L', pv:'2026-09-24', pol:'794B05035M-34', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'58', unidad:'RAM 700',           año:2021, plaza:'CHIHUAHUA',  responsable:'ISMAEL BARRAZA',    placas:'DU6482A', serie:'9BD281G50MYV59661',  rend:'12.7 KM/L', pv:'2026-09-24', pol:'794B05035M-35', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'59', unidad:'RAM 700',           año:2021, plaza:'CHIHUAHUA',  responsable:'ALAN ESTRADA',      placas:'DU6481A', serie:'9BD281G56MYV59423',  rend:'13.5 KM/L', pv:'2026-09-24', pol:'794B05035M-36', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'60', unidad:'MARCH',             año:2020, plaza:'CAMARGO',    responsable:'RAMON HERNANDEZ',   placas:'DU6480A', serie:'3N6CK34N9LL254065',  rend:'11.6 KM/L', pv:'2026-09-24', pol:'794B05035M-28', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'61', unidad:'MARCH',             año:2020, plaza:'PARRAL',     responsable:'RICARDO MORIEL',    placas:'DU6479A', serie:'3N6CK34N2LL254229',  rend:'13.9 KM/L', pv:'2026-09-24', pol:'794B05035M-29', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'62', unidad:'NP300',             año:2019, plaza:'MONTERREY',  responsable:'JULIO DE LA CRUZ',  placas:'DU6472A', serie:'3N6AD33A1KK838707',  rend:'7.5 KM/L',  pv:'2026-09-24', pol:'794B05035M-31', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'63', unidad:'SILVERADO 1500',    año:2013, plaza:'CHIHUAHUA',  responsable:'BODEGA',            placas:'DU6473A', serie:'3GCNC9CX6DG343777',  rend:'5.5 KM/L',  pv:'2026-09-24', pol:'794B05035M-25', tipo:'camioneta', color:'Plata',  nip:''},
  {eco:'64', unidad:'MARCH ACTIVE',      año:2017, plaza:'CHIHUAHUA',  responsable:'VERONICA GARCIA',   placas:'DU6474A', serie:'3N6CK34N4HL242297',  rend:'10.6 KM/L', pv:'2026-09-24', pol:'794B05035M-32', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'66', unidad:'AVEO',              año:2018, plaza:'CHIHUAHUA',  responsable:'CARMEN HERNANDEZ',  placas:'EMB311A', serie:'LSGHD52H6JD239610',  rend:'11.3 KM/L', pv:'2026-09-24', pol:'794B05035M-37', tipo:'auto',      color:'Gris',   nip:''},
  {eco:'69', unidad:'NISSAN NP300',      año:2017, plaza:'CHIHUAHUA',  responsable:'LUIS LOPEZ',        placas:'DU6499A', serie:'3N6AD33A6HK837318',  rend:'—',         pv:'2026-09-24', pol:'794B05035M-38', tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'71', unidad:'YUKON',             año:2023, plaza:'CHIHUAHUA',  responsable:'PALOMA PINEDO',     placas:'DYY416B', serie:'1GKS28KL1PR236241',  rend:'—',         pv:'—',          pol:'—',             tipo:'camioneta', color:'Negro',  nip:''},
  {eco:'72', unidad:'RAM RAPID',         año:2023, plaza:'CHIHUAHUA',  responsable:'JORGE URIBE',       placas:'DG7445B', serie:'9BD2657RIP9233026',  rend:'14 KM/L',   pv:'—',          pol:'—',             tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'73', unidad:'DODGE ATTITUDE',    año:2023, plaza:'CHIHUAHUA',  responsable:'DENISSE GUTIERREZ', placas:'MKL325A', serie:'ML3ABT6J4PH004521',  rend:'—',         pv:'—',          pol:'—',             tipo:'auto',      color:'Blanco', nip:''},
  {eco:'74', unidad:'DODGE ATTITUDE',    año:2023, plaza:'CHIHUAHUA',  responsable:'FATIMA SAUZAMEDA',  placas:'MKL317A', serie:'ML3ABT6J4PH004552',  rend:'15.8 KM/L', pv:'—',          pol:'—',             tipo:'auto',      color:'Blanco', nip:''},
  {eco:'75', unidad:'AVEO',              año:2019, plaza:'CHIHUAHUA',  responsable:'PALOMA PINEDO',     placas:'DUJ454B', serie:'LSGHD52H8KD130423',  rend:'—',         pv:'2027-02-14', pol:'29113016152002', tipo:'auto',      color:'Blanco', nip:''},
  {eco:'76', unidad:'NISSAN VERSA',      año:2024, plaza:'MONTERREY',  responsable:'LUIS GARZA',        placas:'ESU908B', serie:'3N1CN7AE7RK398169',  rend:'16 KM/L',   pv:'—',          pol:'—',             tipo:'auto',      color:'Blanco', nip:''},
  {eco:'77', unidad:'BMW X6',            año:2025, plaza:'CHIHUAHUA',  responsable:'MARTIN DE LA O',    placas:'EKM897B', serie:'WBA41EX06S9W75509',  rend:'—',         pv:'—',          pol:'—',             tipo:'auto',      color:'Negro',  nip:''},
  {eco:'79', unidad:'CHANGAN HUNTER',    año:2025, plaza:'CHIHUAHUA',  responsable:'SERGIO MENDOZA',    placas:'337217',  serie:'LSCBBZ2A1SG803364',  rend:'—',         pv:'2029-02-27', pol:'4056350008',    tipo:'camioneta', color:'Blanco', nip:'7925'},
  {eco:'80', unidad:'CHANGAN HUNTER',    año:2025, plaza:'CHIHUAHUA',  responsable:'ULISES NUÑEZ',      placas:'337218',  serie:'LSCBBZ2A3SG803365',  rend:'—',         pv:'2029-02-27', pol:'4056347985',    tipo:'camioneta', color:'Blanco', nip:'8025'},
  {eco:'81', unidad:'CHANGAN HUNTER',    año:2025, plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',        placas:'337219',  serie:'LSCBB72A8SG803376',  rend:'—',         pv:'2029-02-27', pol:'4056350016',    tipo:'camioneta', color:'Blanco', nip:'8125'},
  {eco:'82', unidad:'VAN DONGFENG',      año:2026, plaza:'CHIHUAHUA',  responsable:'TOMAS',             placas:'DZ9769B', serie:'LGFP541E6TA603994',  rend:'—',         pv:'2029-03-17', pol:'4056530506',    tipo:'camion',    color:'Blanco', nip:''},
  {eco:'83', unidad:'CHASIS DONGFENG',   año:2025, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DZ9767B', serie:'LGDND41EXSA202059',  rend:'—',         pv:'2029-03-17', pol:'4056530481',    tipo:'camion',    color:'Blanco', nip:''},
  {eco:'84', unidad:'CHASIS DONGFENG',   año:2025, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DZ9766B', serie:'LGDND41E6SA202057',  rend:'—',         pv:'2029-03-17', pol:'4056530495',    tipo:'camion',    color:'Blanco', nip:''},
  {eco:'85', unidad:'PICKUP DONGFENG',   año:2025, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DZ9768B', serie:'LGDCMA1L5SA204421',  rend:'—',         pv:'2029-03-20', pol:'3200970801',    tipo:'camioneta', color:'Blanco', nip:''},
  {eco:'90', unidad:'CHANGAN STAR',      año:2026, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DZ9853B', serie:'LSCAB12E7TG800860',  rend:'—',         pv:'2026-11-01', pol:'1950290311',    tipo:'camion',    color:'Blanco', nip:''},
  {eco:'91', unidad:'CHANGAN STAR DC',   año:2026, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DZ9855B', serie:'LSCAB22E6TG800256',  rend:'—',         pv:'2026-11-01', pol:'1950290357',    tipo:'camion',    color:'Blanco', nip:''},
  {eco:'92', unidad:'CHANGAN STAR DC',   año:2026, plaza:'CHIHUAHUA',  responsable:'—',                 placas:'DZ9854B', serie:'LSCAB22E5TG800295',  rend:'—',         pv:'2026-11-01', pol:'1950290361',    tipo:'camion',    color:'Blanco', nip:''},
];

// ── CHECKLIST ──
const CHK = {
  cristales:  ['Medallón delantero','Vidrio trasero','Lateral derecho delantero','Lateral derecho trasero','Lateral izquierdo delantero','Lateral izquierdo trasero'],
  espejos:    ['Retrovisor izquierdo','Retrovisor derecho','Espejo central interior'],
  neumaticos: ['Llanta delantera derecha','Llanta delantera izquierda','Llanta trasera derecha','Llanta trasera izquierda','Llanta de refacción'],
  interiores: ['Póliza / Manual de propietario','Radio / Carátula','Pantallas / FIS','Encendedor','Asientos y vestiduras','Tablero en buen estado','Tapetes'],
  motor:      ['Batería','Bobinas','Computadora','Tapón agua limpiabrisas','Tapón radiador','Tapón dirección hidráulica'],
  cajuela:    ['Herramienta','Cables de arranque','Extintor','Llanta de refacción','Llave L','Llave de cruz'],
  legal:      ['Sin multas de tránsito vigentes','Verificación ambiental vigente','Tenencia al corriente','Tarjeta de circulación vigente'],
};

// ── ESTADO GLOBAL ──
let flV=[], flS=[], flCom=[];
let vistaAct='panel';
let dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
let solEvidencias=[], comEvidEntrega=[], comEvidRecepcion=[];
let tipoVehSel='auto'; // para selector carro/troca

// ── ÍCONOS SVG ──
const I={
  car:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  truck:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  grid:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  wrench:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  road:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l3-10h12l3 10"/><path d="M12 7v10"/></svg>`,
  archive:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  plus:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  check:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  alert:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  doc:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  camera:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  upload:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`,
  search:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  shield:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  fuel:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 22V8l9-6 9 6v14H3z"/><line x1="12" y1="22" x2="12" y2="13"/><path d="M9 22V13h6v9"/></svg>`,
  user:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  x:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  map:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  eye:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  trash:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
};

// ── HELPERS ──
const hD  = f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);
const hDL = d=>d===null?'—':d<0?`Vencida hace ${Math.abs(d)}d`:d===0?'Vence HOY':d<90?`${d}d`:' Vigente';
const hDC = d=>d===null?'#22C55E':d<0?'#EF4444':d<90?'#F59E0B':'#22C55E';
const hF  = iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';
const hRol= ()=>window.flGetRolActual?window.flGetRolActual():'Usuario';
const hP  = a=>window.flTienePermiso?window.flTienePermiso(a):(a==='crear_solicitud');
const hAdm= ()=>['Administrador','Contraloría','Flotilla'].includes(hRol());
const hEmo= t=>t==='camion'?'🚛':t==='camioneta'?'🚙':'🚗';
const hBg = s=>s==='taller'?'#FFFBEB':s==='baja'?'#FEF2F2':s==='comision'?'#F5F3FF':'#ECFDF5';
const hCl = s=>s==='taller'?'#B45309':s==='baja'?'#B91C1C':s==='comision'?'#6D28D9':'#15803D';
function hBadge(e){
  const cls={Solicitud:'sol',Validada:'val',Cotización:'cot',Aprobada:'apr',Rechazada:'rec',Cierre:'cie',Cerrada:'cer',activo:'actv',taller:'tall',comision:'com',baja:'baj'}[e]||'gr';
  return`<span class="fl-b fl-b-${cls}">${e||'—'}</span>`;
}

// GAUGE
function gauge(rend){
  const r=rend&&rend!=='—'?parseFloat(rend):null;
  const pct=r?Math.min(r/20,1):0;
  const ang=-120+pct*240, rad=(ang-90)*Math.PI/180;
  const cx=55,cy=55,R=42;
  const nx=cx+R*Math.cos(rad), ny=cy+R*Math.sin(rad);
  const col=pct<.35?'#EF4444':pct<.6?'#F59E0B':'#22C55E';
  return`<svg width="110" height="78" viewBox="0 0 110 78">
    <path d="M11,70 A44,44 0 0,1 99,70" fill="none" stroke="#F1F5F9" stroke-width="7" stroke-linecap="round"/>
    ${r?`<path d="M11,70 A44,44 0 0,1 ${nx.toFixed(1)},${ny.toFixed(1)}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="5" fill="${col}" stroke="#fff" stroke-width="2"/>`:``}
    <text x="55" y="67" text-anchor="middle" font-size="14" font-weight="800" fill="#0A0F1E" font-family="JetBrains Mono,monospace">${r?r.toFixed(1):'—'}</text>
    <text x="9" y="76" font-size="7.5" fill="#94A3B8" font-family="Plus Jakarta Sans,sans-serif">0</text>
    <text x="96" y="76" font-size="7.5" fill="#94A3B8" font-family="Plus Jakarta Sans,sans-serif">20</text>
  </svg>`;
}

// SVG DAÑOS por tipo de vehículo
function dmgSVGShape(vista, tipo){
  // tipo: 'auto' o 'troca'
  const isTroca = tipo==='troca';
  const shapes_auto={
    frente:`<rect x="70" y="18" width="120" height="82" rx="14" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="80" y="26" width="100" height="40" rx="7" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="80" y="73" width="44" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>
      <rect x="136" y="73" width="44" height="16" rx="4" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>
      <circle cx="88" cy="104" r="11" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <circle cx="172" cy="104" r="11" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="115" y="88" width="30" height="8" rx="3" fill="#94A3B8"/>`,
    trasera:`<rect x="70" y="18" width="120" height="82" rx="14" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="80" y="26" width="100" height="40" rx="7" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="80" y="73" width="44" height="16" rx="4" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>
      <rect x="136" y="73" width="44" height="16" rx="4" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>
      <circle cx="88" cy="104" r="11" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <circle cx="172" cy="104" r="11" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="110" y="90" width="40" height="5" rx="2" fill="#94A3B8"/>`,
    lateral_izq:`<ellipse cx="72" cy="100" rx="18" ry="18" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <ellipse cx="188" cy="100" rx="18" ry="18" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="46" y="60" width="168" height="44" rx="9" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="56" y="25" width="88" height="38" rx="7" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="150" y="28" width="46" height="33" rx="6" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="40" y="66" width="22" height="18" rx="3" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>`,
    lateral_der:`<ellipse cx="72" cy="100" rx="18" ry="18" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <ellipse cx="188" cy="100" rx="18" ry="18" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="46" y="60" width="168" height="44" rx="9" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="116" y="25" width="88" height="38" rx="7" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="64" y="28" width="46" height="33" rx="6" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="198" y="66" width="22" height="18" rx="3" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>`,
  };
  const shapes_troca={
    frente:`<rect x="60" y="30" width="140" height="72" rx="8" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="68" y="38" width="124" height="34" rx="5" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="68" y="76" width="52" height="18" rx="4" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>
      <rect x="140" y="76" width="52" height="18" rx="4" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>
      <circle cx="80" cy="110" r="13" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <circle cx="180" cy="110" r="13" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="108" y="96" width="44" height="8" rx="3" fill="#94A3B8"/>`,
    trasera:`<rect x="60" y="18" width="140" height="55" rx="6" fill="#94A3B8" stroke="#64748B" stroke-width="1.5"/>
      <rect x="60" y="73" width="140" height="32" rx="5" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="68" y="26" width="124" height="38" rx="4" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="68" y="79" width="52" height="16" rx="3" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>
      <rect x="140" y="79" width="52" height="16" rx="3" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>
      <circle cx="80" cy="112" r="13" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <circle cx="180" cy="112" r="13" fill="#374151" stroke="#1F2937" stroke-width="2"/>`,
    lateral_izq:`<ellipse cx="68" cy="106" rx="20" ry="20" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <ellipse cx="192" cy="106" rx="20" ry="20" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="38" y="60" width="184" height="50" rx="7" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="50" y="22" width="70" height="42" rx="5" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="124" y="22" width="98" height="42" rx="5" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
      <rect x="32" y="66" width="24" height="20" rx="3" fill="#FDE68A" stroke="#F59E0B" stroke-width="1"/>`,
    lateral_der:`<ellipse cx="68" cy="106" rx="20" ry="20" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <ellipse cx="192" cy="106" rx="20" ry="20" fill="#374151" stroke="#1F2937" stroke-width="2"/>
      <rect x="38" y="60" width="184" height="50" rx="7" fill="#CBD5E1" stroke="#94A3B8" stroke-width="1.5"/>
      <rect x="140" y="22" width="70" height="42" rx="5" fill="#BFDBFE" stroke="#93C5FD" stroke-width="1"/>
      <rect x="38" y="22" width="98" height="42" rx="5" fill="#94A3B8" stroke="#64748B" stroke-width="1"/>
      <rect x="204" y="66" width="24" height="20" rx="3" fill="#FCA5A5" stroke="#EF4444" stroke-width="1"/>`,
  };
  return isTroca ? shapes_troca[vista] : shapes_auto[vista];
}

function dmgSVGCard(vista, tipo, pts){
  const nom={frente:'Frente',trasera:'Trasera',lateral_izq:'Lateral Izq.',lateral_der:'Lateral Der.'};
  const puntos=(pts||[]).map((p,i)=>`
    <circle cx="${p.x}" cy="${p.y}" r="8" fill="#EF4444" stroke="#fff" stroke-width="2" opacity=".92"/>
    <text x="${p.x}" y="${p.y+3}" text-anchor="middle" font-size="7.5" font-weight="800" fill="#fff">${i+1}</text>`).join('');
  return`<div class="fl-dmg-card">
    <div class="fl-dmg-lbl">
      <span>${nom[vista]}</span>
      <button class="fl-dmg-clear" onclick="event.stopPropagation();flDmgClear('${vista}')">✕ Limpiar</button>
    </div>
    <div class="fl-dmg-svg-wrap" id="fl-dw-${vista}" onclick="flDmgClick(event,'${vista}')">
      <svg id="fl-ds-${vista}" width="100%" viewBox="0 0 260 125" xmlns="http://www.w3.org/2000/svg" style="display:block">
        ${dmgSVGShape(vista, tipo)}
        <g id="fl-dp-${vista}">${puntos}</g>
      </svg>
    </div>
    <div class="fl-dmg-count" id="fl-dpt-${vista}">${(pts||[]).length?`${pts.length} daño(s)`:'Sin daños'}</div>
  </div>`;
}

// ── CSS ──
function css(){
  if(document.getElementById('fl-v8-css')) return;
  const s=document.createElement('style'); s.id='fl-v8-css';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* ── BASE ── */
#fl-root{display:none;margin-left:240px;min-height:100vh;background:#EEF2F7;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#0A0F1E;}
#fl-root *{box-sizing:border-box;margin:0;padding:0;}

/* ── TOPBAR ── */
.fl-top{background:#0A1628;padding:0 24px;display:flex;align-items:center;gap:6px;height:56px;position:sticky;top:0;z-index:200;box-shadow:0 2px 12px rgba(0,0,0,.25);}
.fl-top-brand{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;letter-spacing:-.3px;color:#fff;margin-right:16px;}
.fl-top-brand em{color:#3B82F6;font-style:normal;}
.fl-top-sep{width:1px;height:24px;background:rgba(255,255,255,.12);margin:0 8px;}
.fl-top-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;border:1px solid transparent;background:transparent;color:rgba(255,255,255,.55);font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;}
.fl-top-btn:hover{background:rgba(255,255,255,.08);color:#fff;}
.fl-top-btn.on{background:#2563EB;color:#fff;border-color:#1D4ED8;box-shadow:0 4px 14px rgba(37,99,235,.35);}
.fl-top-btn svg{opacity:.8;}
.fl-top-btn.on svg{opacity:1;}
.fl-top-right{margin-left:auto;display:flex;align-items:center;gap:8px;}
.fl-top-role{font-size:10px;padding:3px 10px;border-radius:100px;background:rgba(59,130,246,.2);color:#93C5FD;font-weight:700;letter-spacing:.4px;text-transform:uppercase;}
.fl-top-new{display:inline-flex;align-items:center;gap:6px;padding:8px 18px;background:#2563EB;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;}
.fl-top-new:hover{background:#1D4ED8;box-shadow:0 4px 14px rgba(37,99,235,.4);}

/* ── CONTENIDO ── */
.fl-content{padding:24px 28px;max-width:1200px;}

/* ── BOTÓN GENÉRICO ── */
.fb{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
.fb.accent{background:#2563EB;color:#fff;}
.fb.accent:hover{background:#1D4ED8;box-shadow:0 4px 14px rgba(37,99,235,.35);}
.fb.ghost{background:#fff;color:#374151;border:1px solid #E2E8F0;}
.fb.ghost:hover{background:#F8FAFD;border-color:#CBD5E1;}
.fb.danger{background:#FEF2F2;color:#B91C1C;border:1px solid #FECACA;}
.fb.danger:hover{background:#FEE2E2;}
.fb.sm{padding:5px 10px;font-size:11px;}

/* ── CARDS / SECCIÓN ── */
.fl-section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.fl-section-title{font-size:20px;font-weight:800;letter-spacing:-.5px;}
.fl-section-sub{font-size:12px;color:#64748B;margin-top:3px;}

/* ── KPI CARDS ── */
.fl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
.fl-kpi{background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5;box-shadow:0 1px 4px rgba(10,22,40,.06);}
.fl-kpi-l{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:10px;display:flex;align-items:center;gap:5px;}
.fl-kpi-v{font-size:32px;font-weight:900;letter-spacing:-1.5px;line-height:1;font-family:'JetBrains Mono',monospace;}
.fl-kpi-s{font-size:11px;color:#94A3B8;margin-top:4px;}
.fl-kpi-trend{font-size:10.5px;font-weight:700;display:inline-flex;align-items:center;gap:3px;margin-top:6px;padding:2px 8px;border-radius:100px;}
.fl-kpi-trend.up{background:#DCFCE7;color:#15803D;}
.fl-kpi-trend.dn{background:#FEE2E2;color:#B91C1C;}
.fl-kpi-trend.neu{background:#F1F5F9;color:#475569;}

/* ── ALERTAS ── */
.fl-alts{display:flex;flex-direction:column;gap:6px;margin-bottom:20px;}
.fl-alt{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:10px;font-size:12px;font-weight:500;border:1px solid;}
.fl-alt.w{background:#FFFBEB;color:#92400E;border-color:#FDE68A;}
.fl-alt.e{background:#FEF2F2;color:#991B1B;border-color:#FECACA;}

/* ── TABLA ── */
.fl-tw{background:#fff;border:1px solid #E8EDF5;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(10,22,40,.05);}
.fl-t{width:100%;border-collapse:collapse;font-size:12.5px;}
.fl-t th{background:#F8FAFD;padding:10px 14px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;border-bottom:1px solid #E8EDF5;}
.fl-t td{padding:12px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.fl-t tr:last-child td{border-bottom:none;}
.fl-t tr:hover td{background:#F8FAFD;}
.fl-t tr{cursor:pointer;transition:background .1s;}
.fl-t .mono{font-family:'JetBrains Mono',monospace;font-size:11px;}

/* ── BADGES ── */
.fl-b{display:inline-flex;align-items:center;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:100px;white-space:nowrap;}
.fl-b-sol{background:#EDE9FE;color:#6D28D9;}
.fl-b-val{background:#DBEAFE;color:#1D4ED8;}
.fl-b-cot{background:#FEF3C7;color:#B45309;}
.fl-b-apr{background:#DCFCE7;color:#15803D;}
.fl-b-rec{background:#FEE2E2;color:#B91C1C;}
.fl-b-cie{background:#F3E8FF;color:#7C3AED;}
.fl-b-cer{background:#F1F5F9;color:#475569;}
.fl-b-actv{background:#DCFCE7;color:#15803D;}
.fl-b-tall{background:#FEF3C7;color:#B45309;}
.fl-b-com{background:#EDE9FE;color:#6D28D9;}
.fl-b-baj{background:#FEE2E2;color:#B91C1C;}
.fl-b-gr{background:#F1F5F9;color:#475569;}

/* ── FILTROS / BÚSQUEDA ── */
.fl-filters{display:flex;gap:10px;margin-bottom:18px;align-items:center;flex-wrap:wrap;}
.fl-search{position:relative;flex:1;min-width:200px;}
.fl-search svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;}
.fl-search input{width:100%;padding:9px 12px 9px 32px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;background:#fff;outline:none;color:#0A0F1E;transition:all .15s;}
.fl-search input:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-select{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:12.5px;background:#fff;outline:none;color:#0A0F1E;cursor:pointer;}
.fl-select:focus{border-color:#2563EB;}

/* ── PANEL VEHÍCULO EN SOLICITUDES ── */
.fl-veh-info-bar{background:#0A1628;border-radius:12px;padding:14px 18px;color:#fff;margin-bottom:16px;display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;}
.fl-veh-info-emo{font-size:40px;line-height:1;}
.fl-veh-info-name{font-size:16px;font-weight:800;letter-spacing:-.3px;}
.fl-veh-info-sub{font-size:11px;color:rgba(255,255,255,.5);margin-top:2px;}
.fl-veh-info-grid{display:grid;grid-template-columns:repeat(4,auto);gap:0 24px;}
.fl-veh-info-d dt{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:rgba(255,255,255,.4);margin-bottom:2px;}
.fl-veh-info-d dd{font-size:12px;font-weight:700;color:#fff;font-family:'JetBrains Mono',monospace;}

/* ── SELECTOR CARRO / TROCA ── */
.fl-tipo-sel{display:flex;gap:10px;margin-bottom:16px;}
.fl-tipo-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 20px;border-radius:10px;border:2px solid #E2E8F0;background:#fff;cursor:pointer;transition:all .15s;font-family:inherit;}
.fl-tipo-btn:hover{border-color:#93C5FD;}
.fl-tipo-btn.on{border-color:#2563EB;background:#EFF6FF;}
.fl-tipo-btn span{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;}
.fl-tipo-btn.on span{color:#2563EB;}

/* ── SVG DAÑOS ── */
.fl-dmg-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;}
.fl-dmg-card{background:#F8FAFD;border:1.5px solid #E2E8F0;border-radius:10px;overflow:hidden;}
.fl-dmg-lbl{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#fff;border-bottom:1px solid #E2E8F0;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;}
.fl-dmg-clear{font-size:9px;font-weight:700;color:#EF4444;background:none;border:none;cursor:pointer;font-family:inherit;padding:0;}
.fl-dmg-svg-wrap{cursor:crosshair;display:block;}
.fl-dmg-svg-wrap:hover{background:#EFF6FF;}
.fl-dmg-count{padding:4px 10px;font-size:10px;font-weight:600;color:#64748B;background:#fff;border-top:1px solid #E2E8F0;}

/* ── MODAL ── */
.fl-ov{position:fixed;inset:0;background:rgba(10,15,30,.7);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(10px);animation:flFi .15s ease;}
@keyframes flFi{from{opacity:0}to{opacity:1}}
.fl-modal{background:#fff;border-radius:18px;width:100%;max-width:660px;max-height:93vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.3);animation:flSu .2s cubic-bezier(.4,0,.2,1);}
.fl-modal.wide{max-width:820px;}
@keyframes flSu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.fl-mh{padding:20px 22px 0;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9;padding-bottom:14px;}
.fl-mh h3{font-size:16px;font-weight:800;letter-spacing:-.3px;}
.fl-mx{width:28px;height:28px;border:none;background:#F1F5F9;border-radius:7px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background .15s;}
.fl-mx:hover{background:#E2E8F0;}
.fl-mb{padding:16px 22px 22px;}

/* ── FORM ── */
.fl-form{display:flex;flex-direction:column;gap:13px;}
.fl-fld{display:flex;flex-direction:column;gap:5px;}
.fl-fld label{font-size:10px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;}
.fl-fld input,.fl-fld select,.fl-fld textarea{padding:10px 13px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;color:#0A0F1E;background:#F8FAFD;outline:none;transition:all .15s;width:100%;}
.fl-fld input:focus,.fl-fld select:focus,.fl-fld textarea:focus{border-color:#2563EB;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-fld input:disabled,.fl-fld select:disabled{background:#F1F5F9;color:#64748B;cursor:not-allowed;}
.fl-fld textarea{min-height:80px;resize:vertical;}
.fl-fr{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.fl-fa{display:flex;justify-content:flex-end;gap:8px;padding-top:12px;border-top:1px solid #F1F5F9;margin-top:4px;}
.fl-fasig{background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:9px;padding:10px 13px;font-size:12.5px;font-weight:700;color:#1D4ED8;display:flex;align-items:center;gap:7px;}
.fl-sep{height:1px;background:#F1F5F9;margin:8px 0;}
.fl-fld-label-row{display:flex;align-items:center;justify-content:space-between;}

/* ── UPLOAD ── */
.fl-up{border:2px dashed #CBD5E1;border-radius:9px;padding:12px;text-align:center;cursor:pointer;color:#64748B;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;font-family:inherit;background:transparent;width:100%;}
.fl-up:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;}
.fl-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:100px;font-size:11px;font-weight:600;color:#374151;cursor:pointer;}
.fl-pill:hover{background:#EFF6FF;color:#2563EB;border-color:#93C5FD;}

/* ── EMPTY / LOADING ── */
.fl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;gap:8px;color:#64748B;text-align:center;padding:30px;}
.fl-empty-ico{font-size:40px;opacity:.25;margin-bottom:8px;}
.fl-empty h3{font-size:14px;font-weight:700;color:#0A0F1E;}
.fl-empty p{font-size:12px;max-width:250px;line-height:1.5;}
.fl-loading{display:flex;align-items:center;justify-content:center;min-height:160px;color:#64748B;gap:10px;font-size:13px;}
.fl-spin{width:18px;height:18px;border:2px solid #E2E8F0;border-top-color:#2563EB;border-radius:50%;animation:flR .7s linear infinite;}
@keyframes flR{to{transform:rotate(360deg)}}

/* ── VEHÍCULO CARD — listado de bajas y comisiones ── */
.fl-vcard{background:#fff;border:1px solid #E8EDF5;border-radius:12px;padding:14px 16px;display:flex;gap:12px;align-items:center;cursor:pointer;transition:all .15s;}
.fl-vcard:hover{border-color:#93C5FD;box-shadow:0 4px 14px rgba(37,99,235,.08);}
.fl-vcard-ico{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.fl-vcard-eco{font-size:13px;font-weight:800;font-family:'JetBrains Mono',monospace;}
.fl-vcard-name{font-size:12.5px;font-weight:600;color:#374151;}
.fl-vcard-sub{font-size:11px;color:#94A3B8;margin-top:2px;}
.fl-vcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;}

/* ── COMISIONES ── */
.fl-com-card{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(10,22,40,.05);}
.fl-com-head{padding:14px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9;}
.fl-com-body{padding:14px 16px;}
.fl-com-row{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px;}
.fl-com-d dt{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:2px;}
.fl-com-d dd{font-size:12.5px;font-weight:600;color:#0A0F1E;}

/* ── SOL DETALLE ── */
.fl-sg{display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:10px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:10px;}
.fl-sc{padding:10px 13px;}
.fl-sc:nth-child(odd){border-right:1px solid #E8EDF5;}
.fl-sc{border-bottom:1px solid #E8EDF5;}
.fl-sc:nth-last-child(-n+2){border-bottom:none;}
.fl-sc dt{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:3px;}
.fl-sc dd{font-size:12.5px;font-weight:600;color:#0A0F1E;}
.fl-sc.full{grid-column:1/-1;}

/* ── RESPONSIVE ── */
@media(max-width:900px){
  #fl-root{margin-left:0;}
  .fl-kpis{grid-template-columns:1fr 1fr;}
  .fl-fr{grid-template-columns:1fr;}
  .fl-dmg-grid{grid-template-columns:1fr;}
  .fl-content{padding:14px;}
  .fl-veh-info-grid{grid-template-columns:1fr 1fr;}
  .fl-veh-info-bar{grid-template-columns:auto 1fr;}
  .fl-veh-info-grid{display:none;}
}
`;
  document.head.appendChild(s);
}

// ── HTML BASE ──
function html(){
  const el=document.getElementById('flotilla-dashboard'); if(!el) return;
  el.id='fl-root';
  el.innerHTML=`
  <div class="fl-top">
    <div class="fl-top-brand">${I.truck} FLOTILLA <em>TECNOCONTROL</em></div>
    <div class="fl-top-sep"></div>
    <button class="fl-top-btn on" id="fl-tbtn-panel"   onclick="flVista('panel')">${I.grid} Panel General</button>
    <button class="fl-top-btn"    id="fl-tbtn-sols"    onclick="flVista('sols')">${I.wrench} Solicitudes <span id="fl-cnt-sols" style="background:#EF4444;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:100px;margin-left:3px;display:none">0</span></button>
    <button class="fl-top-btn"    id="fl-tbtn-comis"   onclick="flVista('comis')">${I.road} Comisiones</button>
    <button class="fl-top-btn"    id="fl-tbtn-bajas"   onclick="flVista('bajas')">${I.archive} Vehículos de Baja</button>
    <div class="fl-top-right">
      <span class="fl-top-role" id="fl-rol-lbl">—</span>
      <button class="fl-top-new" id="fl-btn-nueva" onclick="flAbrirSol()">${I.plus} Nueva solicitud</button>
    </div>
  </div>
  <div id="fl-body" class="fl-content">
    <div class="fl-loading"><div class="fl-spin"></div> Inicializando flotilla…</div>
  </div>`;
}

// ── INIT ──
window.cargarFlotilla=async function(){
  css(); html();
  document.getElementById('fl-rol-lbl').textContent=hRol();
  const btnN=document.getElementById('fl-btn-nueva');
  if(btnN) btnN.style.display=hP('crear_solicitud')?'':'none';
  await Promise.all([loadVehs(),loadSols(),loadComis()]);
  flVista('panel');
};

// ── CARGA DATOS ──
async function loadVehs(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.VEHS));
    flV=snap.size>0?snap.docs.map(d=>({id:d.id,...d.data()})):CAT.map(v=>({id:'eco-'+v.eco,status:'activo',km:0,fotos:[],...v}));
  }catch(e){flV=CAT.map(v=>({id:'eco-'+v.eco,status:'activo',km:0,fotos:[],...v}));}
}
async function loadSols(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.SOLS));
    flS=snap.docs.map(d=>({id:d.id,...d.data()}));
    flS.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
  }catch(e){flS=[];}
  const pend=flS.filter(s=>['Solicitud','Validada'].includes(s.estatus)).length;
  const cnt=document.getElementById('fl-cnt-sols');
  if(cnt){cnt.textContent=pend;cnt.style.display=pend?'inline':'none';}
}
async function loadComis(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.COMIS));
    flCom=snap.docs.map(d=>({id:d.id,...d.data()}));
    flCom.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
  }catch(e){flCom=[];}
}

// ── NAVEGACIÓN ──
window.flVista=function(v){
  vistaAct=v;
  document.querySelectorAll('.fl-top-btn').forEach(b=>b.classList.remove('on'));
  const btn=document.getElementById('fl-tbtn-'+v);
  if(btn) btn.classList.add('on');
  if(v==='panel')  renderPanel();
  else if(v==='sols')  renderSols();
  else if(v==='comis') renderComis();
  else if(v==='bajas') renderBajas();
};

function setBody(html){ document.getElementById('fl-body').innerHTML=html; }

// ══════════════════════════════════════════
// VISTA 1 — PANEL GENERAL
// ══════════════════════════════════════════
function renderPanel(){
  const act=flV.filter(v=>!v.status||v.status==='activo').length;
  const tall=flV.filter(v=>v.status==='taller').length;
  const com=flV.filter(v=>v.status==='comision').length;
  const baj=flV.filter(v=>v.status==='baja').length;
  const pend=flS.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus)).length;
  const alts=[];
  flV.forEach(v=>{const d=hD(v.pv);if(d!==null&&d<90)alts.push({t:d<0?'e':'w',txt:`Unidad ${v.eco} — Póliza ${d<0?'VENCIDA':'por vencer: '+hF(v.pv)}`});});

  // Conteo por tipo de solicitud
  const porTipo={};
  flS.forEach(s=>{const t=s.tipo||'Otro';porTipo[t]=(porTipo[t]||0)+1;});
  const topTipos=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxT=topTipos[0]?.[1]||1;

  // Solicitudes por estatus
  const porEst={Solicitud:0,Validada:0,Cotización:0,Aprobada:0,Rechazada:0,Cerrada:0};
  flS.forEach(s=>{if(porEst[s.estatus]!==undefined)porEst[s.estatus]++;});

  setBody(`
    <div class="fl-section-head">
      <div>
        <div class="fl-section-title">Panel General · Flotilla Vehicular</div>
        <div class="fl-section-sub">${flV.filter(v=>v.status!=='baja').length} unidades activas · ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
    </div>

    ${alts.length?`<div class="fl-alts">${alts.slice(0,5).map(a=>`<div class="fl-alt ${a.t}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}

    <div class="fl-kpis">
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.truck} Total flotilla</div>
        <div class="fl-kpi-v">${flV.length}</div>
        <div class="fl-kpi-s">unidades registradas</div>
        <div class="fl-kpi-trend neu">${baj} de baja</div>
      </div>
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.check} En operación</div>
        <div class="fl-kpi-v" style="color:#16A34A">${act}</div>
        <div class="fl-kpi-s">activas hoy</div>
        <div class="fl-kpi-trend up">+0 esta semana</div>
      </div>
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.wrench} En taller / comisión</div>
        <div class="fl-kpi-v" style="color:#D97706">${tall+com}</div>
        <div class="fl-kpi-s">${tall} en taller · ${com} en comisión</div>
        <div class="fl-kpi-trend dn">${tall} fuera de servicio</div>
      </div>
      <div class="fl-kpi">
        <div class="fl-kpi-l">${I.alert} Solicitudes activas</div>
        <div class="fl-kpi-v" style="color:#7C3AED">${pend}</div>
        <div class="fl-kpi-s">en proceso de atención</div>
        <div class="fl-kpi-trend ${pend>5?'dn':pend>0?'neu':'up'}">${hP('aprobar')?'requieren aprobación':'pendientes'}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <!-- Solicitudes por tipo -->
      <div class="fl-tw">
        <div style="padding:14px 16px;border-bottom:1px solid #F1F5F9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Solicitudes por tipo</div>
        <div style="padding:14px 16px">
          ${topTipos.length?topTipos.map(([t,n])=>`
            <div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:4px">
                <span>${t}</span><span style="color:#64748B">${n}</span>
              </div>
              <div style="height:6px;background:#F1F5F9;border-radius:100px;overflow:hidden">
                <div style="height:100%;width:${Math.round(n/maxT*100)}%;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:100px"></div>
              </div>
            </div>`).join(''):`<div style="color:#94A3B8;font-size:12px;text-align:center;padding:20px">Sin solicitudes aún</div>`}
        </div>
      </div>
      <!-- Solicitudes por estatus -->
      <div class="fl-tw">
        <div style="padding:14px 16px;border-bottom:1px solid #F1F5F9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Flujo de solicitudes</div>
        <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px">
          ${Object.entries(porEst).map(([e,n])=>`
            <div style="display:flex;align-items:center;gap:10px">
              ${hBadge(e)}
              <div style="flex:1;height:6px;background:#F1F5F9;border-radius:100px;overflow:hidden">
                <div style="height:100%;width:${flS.length?Math.round(n/flS.length*100):0}%;background:#2563EB;border-radius:100px"></div>
              </div>
              <span style="font-size:11px;font-weight:700;color:#0A0F1E;min-width:20px;text-align:right">${n}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Solicitudes recientes -->
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:10px">Solicitudes recientes</div>
    ${tTabla(flS.slice(0,10))}
  `);
}

// ══════════════════════════════════════════
// VISTA 2 — SOLICITUDES
// ══════════════════════════════════════════
function renderSols(){
  const pA=hP('aprobar');
  setBody(`
    <div class="fl-section-head">
      <div>
        <div class="fl-section-title">Solicitudes de Servicio</div>
        <div class="fl-section-sub">${flS.length} registros totales</div>
      </div>
      <button class="fb accent" onclick="flAbrirSol()">${I.plus} Nueva solicitud</button>
    </div>

    <div class="fl-filters">
      <div class="fl-search">${I.search}<input type="text" id="fl-sol-buscar" placeholder="Buscar por unidad, tipo, solicitante…" oninput="flFiltrarSols()"></div>
      <select class="fl-select" id="fl-sol-est" onchange="flFiltrarSols()">
        <option value="">Todos los estados</option>
        <option>Solicitud</option><option>Validada</option><option>Cotización</option>
        <option>Aprobada</option><option>Rechazada</option><option>Cierre</option><option>Cerrada</option>
      </select>
      <select class="fl-select" id="fl-sol-veh" onchange="flFiltrarSols()">
        <option value="">Todos los vehículos</option>
        ${flV.filter(v=>v.status!=='baja').map(v=>`<option value="${v.eco}">ECO ${v.eco} · ${v.placas}</option>`).join('')}
      </select>
    </div>

    <div id="fl-sols-tabla">${tTabla(flS,pA)}</div>
  `);
}

window.flFiltrarSols=function(){
  const q=(document.getElementById('fl-sol-buscar')?.value||'').toLowerCase();
  const est=document.getElementById('fl-sol-est')?.value||'';
  const veh=document.getElementById('fl-sol-veh')?.value||'';
  let res=flS;
  if(q) res=res.filter(s=>(s.tipo||'').toLowerCase().includes(q)||(s.vehiculo||'').toLowerCase().includes(q)||(s.solicitante||'').toLowerCase().includes(q)||(s.vehiculoEco||'').toLowerCase().includes(q));
  if(est) res=res.filter(s=>s.estatus===est);
  if(veh) res=res.filter(s=>(s.vehiculoEco||'')=== veh);
  const pA=hP('aprobar');
  document.getElementById('fl-sols-tabla').innerHTML=tTabla(res,pA);
};

// ══════════════════════════════════════════
// VISTA 3 — COMISIONES
// ══════════════════════════════════════════
function renderComis(){
  setBody(`
    <div class="fl-section-head">
      <div>
        <div class="fl-section-title">Préstamos y Comisiones</div>
        <div class="fl-section-sub">Vehículos prestados a corto y largo plazo</div>
      </div>
      <button class="fb accent" onclick="flAbrirComis()">${I.plus} Registrar comisión</button>
    </div>

    <div class="fl-filters">
      <select class="fl-select" id="fl-com-tipo" onchange="flFiltrarComis()">
        <option value="">Todos los tipos</option>
        <option>Corto plazo</option><option>Largo plazo</option>
      </select>
      <select class="fl-select" id="fl-com-est" onchange="flFiltrarComis()">
        <option value="">Todos los estados</option>
        <option>En préstamo</option><option>Devuelto</option>
      </select>
    </div>

    <div id="fl-comis-lista">${renderComisLista(flCom)}</div>
  `);
}

function renderComisLista(list){
  if(!list.length) return`<div class="fl-empty"><div class="fl-empty-ico">🚗</div><h3>Sin comisiones registradas</h3><p>Registra préstamos de vehículos a colaboradores.</p></div>`;
  return`<div style="display:flex;flex-direction:column;gap:10px">${list.map(c=>`
    <div class="fl-com-card" onclick="flVerComis('${c.id}')">
      <div class="fl-com-head">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="font-size:28px">${hEmo(flV.find(v=>v.eco===c.vehiculoEco)?.tipo||'auto')}</div>
          <div>
            <div style="font-size:14px;font-weight:800">ECO ${c.vehiculoEco||'—'} · ${c.vehiculo||'—'}</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">${c.tipo||'—'} · Responsable: ${c.responsable||'—'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${hBadge(c.estatus||'En préstamo')}
          <button class="fb ghost sm" onclick="event.stopPropagation();flVerComis('${c.id}')">${I.eye} Ver</button>
        </div>
      </div>
      <div class="fl-com-body">
        <div class="fl-com-row">
          <dl class="fl-com-d"><dt>Fecha entrega</dt><dd>${hF(c.fechaEntrega)}</dd></dl>
          <dl class="fl-com-d"><dt>Fecha regreso</dt><dd>${c.fechaRegreso?hF(c.fechaRegreso):'—'}</dd></dl>
          <dl class="fl-com-d"><dt>KM entrega</dt><dd>${c.kmEntrega||'—'}</dd></dl>
        </div>
        <div style="font-size:11.5px;color:#64748B">${c.motivo||'Sin descripción'}</div>
      </div>
    </div>`).join('')}`;
}

window.flFiltrarComis=function(){
  const tipo=document.getElementById('fl-com-tipo')?.value||'';
  const est=document.getElementById('fl-com-est')?.value||'';
  let res=flCom;
  if(tipo) res=res.filter(c=>c.tipo===tipo);
  if(est) res=res.filter(c=>c.estatus===est);
  document.getElementById('fl-comis-lista').innerHTML=renderComisLista(res);
};

// ══════════════════════════════════════════
// VISTA 4 — VEHÍCULOS DE BAJA
// ══════════════════════════════════════════
function renderBajas(){
  const bajas=flV.filter(v=>v.status==='baja');
  setBody(`
    <div class="fl-section-head">
      <div>
        <div class="fl-section-title">Vehículos Dados de Baja</div>
        <div class="fl-section-sub">${bajas.length} unidades fuera de la flota activa</div>
      </div>
    </div>
    ${!bajas.length?`<div class="fl-empty"><div class="fl-empty-ico">📦</div><h3>Sin vehículos de baja</h3><p>Todos los vehículos están en la flota activa.</p></div>`:`
    <div class="fl-vcards">
      ${bajas.map(v=>`
        <div class="fl-vcard" onclick="flVerVeh('${v.id}')">
          <div class="fl-vcard-ico" style="background:#FEE2E2;color:#B91C1C">${hEmo(v.tipo)}</div>
          <div style="flex:1;min-width:0">
            <div class="fl-vcard-eco">ECO ${v.eco} <span style="font-size:10px;color:#94A3B8;font-weight:500">· ${v.placas||'—'}</span></div>
            <div class="fl-vcard-name">${v.unidad||'—'} ${v.año||''}</div>
            <div class="fl-vcard-sub">${v.responsable||'Sin asignar'} · ${v.plaza||'—'}</div>
          </div>
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;text-align:right">Baja</div>
            <div style="font-size:11px;font-weight:600;color:#B91C1C;margin-top:2px">${hF(v.fechaBaja)||'—'}</div>
          </div>
        </div>`).join('')}
    </div>`}
  `);
}

// ══════════════════════════════════════════
// TABLA SOLICITUDES
// ══════════════════════════════════════════
function tTabla(sols,pA){
  if(!sols.length) return`<div class="fl-empty"><div class="fl-empty-ico">📋</div><h3>Sin solicitudes</h3><p>No hay registros que mostrar.</p></div>`;
  return`<div class="fl-tw"><table class="fl-t"><thead><tr>
    <th>Tipo</th><th>Unidad</th><th>Prioridad</th><th>Solicitante</th><th>Estado</th><th>Fecha</th>${pA?'<th>Acción</th>':''}
  </tr></thead><tbody>
  ${sols.map(s=>`<tr onclick="flVerSol('${s.id}')">
    <td><strong>${s.tipo||'—'}</strong></td>
    <td class="mono">${s.vehiculoEco||s.vehiculo||'—'}</td>
    <td>${s.prioridad?`<span class="fl-b ${s.prioridad==='Urgente'?'fl-b-rec':s.prioridad==='Alta'?'fl-b-cot':'fl-b-gr'}">${s.prioridad}</span>`:'—'}</td>
    <td style="font-size:11.5px">${s.solicitante||'—'}</td>
    <td>${hBadge(s.estatus)}</td>
    <td style="font-size:10.5px;color:#94A3B8">${hF(s.creadoEn||s.fecha||'')}</td>
    ${pA?`<td onclick="event.stopPropagation()">
      ${(s.estatus==='Validada'||s.estatus==='Cotización')?
        `<div style="display:flex;gap:4px">
          <button class="fb accent sm" onclick="flAprobar('${s.id}')">${I.check}</button>
          <button class="fb danger sm" onclick="flRechazar('${s.id}')">${I.x}</button>
        </div>`:'—'}
    </td>`:''}
  </tr>`).join('')}</tbody></table></div>`;
}

// ══════════════════════════════════════════
// MODAL — NUEVA SOLICITUD
// ══════════════════════════════════════════
const TIPOS_SOL=[
  'Mantenimiento preventivo','Mantenimiento correctivo','Reposición de llanta',
  'Falla eléctrica','Siniestro / Accidente','Revisión de documentos','Otro',
];

window.flAbrirSol=function(ecoPresel){
  dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
  solEvidencias=[];
  tipoVehSel='auto';
  const vehs=flV.filter(v=>v.status!=='baja');
  const ov=document.createElement('div'); ov.className='fl-ov'; ov.id='fl-modal-sol';
  ov.innerHTML=`<div class="fl-modal wide">
    <div class="fl-mh">
      <h3>${I.wrench} Nueva solicitud de servicio</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      <div class="fl-form">

        <!-- VEHÍCULO -->
        <div class="fl-fld">
          <label>Unidad / Vehículo</label>
          <select id="fl-s-veh" onchange="flSolSelVeh(this.value)">
            <option value="">— Selecciona una unidad —</option>
            ${vehs.map(v=>`<option value="${v.id}" ${ecoPresel&&v.eco===ecoPresel?'selected':''}>${v.eco} · ${v.unidad||'—'} · ${v.placas||'—'} · ${v.responsable||'—'}</option>`).join('')}
          </select>
        </div>

        <!-- PANEL VEHÍCULO — aparece al seleccionar -->
        <div id="fl-s-veh-panel" style="display:none">
          <div class="fl-veh-info-bar" id="fl-s-veh-bar">
            <div class="fl-veh-info-emo" id="fl-s-veh-emo">🚗</div>
            <div>
              <div class="fl-veh-info-name" id="fl-s-veh-name">—</div>
              <div class="fl-veh-info-sub" id="fl-s-veh-sub">—</div>
            </div>
            <div class="fl-veh-info-grid" id="fl-s-veh-grid"></div>
          </div>
        </div>

        <!-- TIPO + PRIORIDAD -->
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Tipo de solicitud</label>
            <select id="fl-s-tipo" onchange="flSolTipo(this.value)">
              <option value="">— Selecciona —</option>
              ${TIPOS_SOL.map(t=>`<option>${t}</option>`).join('')}
              <option value="__custom__">Personalizado…</option>
            </select>
            <div id="fl-s-tipo-custom-wrap" style="display:none;margin-top:6px">
              <input type="text" id="fl-s-tipo-custom" placeholder="Describe el tipo de servicio…">
            </div>
          </div>
          <div class="fl-fld">
            <label>Prioridad</label>
            <select id="fl-s-prior">
              <option>Normal</option><option>Alta</option><option>Urgente</option>
            </select>
          </div>
        </div>

        <!-- DESCRIPCIÓN -->
        <div class="fl-fld">
          <label>Descripción del problema</label>
          <textarea id="fl-s-desc" placeholder="Describe el problema, síntoma o servicio que se requiere…"></textarea>
        </div>

        <!-- KM + TALLER -->
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Kilometraje actual</label>
            <input type="number" id="fl-s-km" placeholder="Ej. 85000">
          </div>
          <div class="fl-fld">
            <label>Taller sugerido (opcional)</label>
            <input type="text" id="fl-s-taller" placeholder="Nombre del taller o proveedor">
          </div>
        </div>

        <!-- SELECTOR CARRO / TROCA -->
        <div>
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:10px">Tipo de unidad para diagrama de daños</div>
          <div class="fl-tipo-sel">
            <button class="fl-tipo-btn on" id="fl-tipo-auto" onclick="flSolTipoVeh('auto')">
              <svg width="52" height="26" viewBox="0 0 52 26" fill="none">
                <rect x="6" y="8" width="40" height="14" rx="4" fill="#CBD5E1"/>
                <rect x="10" y="3" width="24" height="10" rx="3" fill="#93C5FD"/>
                <circle cx="12" cy="22" r="4" fill="#374151"/>
                <circle cx="40" cy="22" r="4" fill="#374151"/>
              </svg>
              <span>Carro</span>
            </button>
            <button class="fl-tipo-btn" id="fl-tipo-troca" onclick="flSolTipoVeh('troca')">
              <svg width="60" height="26" viewBox="0 0 60 26" fill="none">
                <rect x="2" y="10" width="58" height="12" rx="3" fill="#CBD5E1"/>
                <rect x="6" y="4" width="18" height="10" rx="2" fill="#93C5FD"/>
                <rect x="24" y="6" width="28" height="8" rx="2" fill="#94A3B8"/>
                <circle cx="10" cy="22" r="4" fill="#374151"/>
                <circle cx="48" cy="22" r="4" fill="#374151"/>
              </svg>
              <span>Troca / Camioneta</span>
            </button>
          </div>
        </div>

        <!-- SVG DAÑOS -->
        <div>
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:8px">${I.alert} Marcar zonas dañadas <span style="font-size:10px;font-weight:400;color:#94A3B8;text-transform:none;letter-spacing:0"> — clic en cada vista para agregar punto</span></div>
          <div class="fl-dmg-grid" id="fl-dmg-grid">
            ${dmgSVGCard('frente','auto',[])}
            ${dmgSVGCard('trasera','auto',[])}
            ${dmgSVGCard('lateral_izq','auto',[])}
            ${dmgSVGCard('lateral_der','auto',[])}
          </div>
        </div>

        <!-- EVIDENCIAS -->
        <div class="fl-fld">
          <label>${I.camera} Evidencias fotográficas</label>
          <label class="fl-up" onclick="document.getElementById('fl-s-ev-inp').click()">
            ${I.upload} Subir fotos (puedes seleccionar varias)
          </label>
          <input type="file" id="fl-s-ev-inp" accept="image/*" multiple style="display:none" onchange="flSolEv(this)">
          <div class="fl-pills" id="fl-s-ev-pills"></div>
        </div>

        <!-- SOLICITANTE -->
        <div class="fl-fasig">${I.user} Solicitante: <strong>${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</strong></div>

        <div class="fl-fa">
          <button class="fb ghost" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
          <button class="fb accent" id="fl-s-submit" onclick="flGuardarSol()">${I.check} Crear solicitud</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  if(ecoPresel){
    const sel=document.getElementById('fl-s-veh');
    if(sel&&sel.value) flSolSelVeh(sel.value);
  }
};

window.flSolSelVeh=function(id){
  const panel=document.getElementById('fl-s-veh-panel'); if(!panel) return;
  if(!id){panel.style.display='none';return;}
  const v=flV.find(x=>x.id===id); if(!v){panel.style.display='none';return;}
  document.getElementById('fl-s-veh-emo').textContent=hEmo(v.tipo);
  document.getElementById('fl-s-veh-name').textContent=`${v.unidad||'—'} ${v.año||''}`;
  document.getElementById('fl-s-veh-sub').textContent=`ECO ${v.eco} · ${v.color||'—'} · Serie: ${v.serie||'—'}`;
  document.getElementById('fl-s-veh-grid').innerHTML=`
    <dl class="fl-veh-info-d"><dt>Placas</dt><dd>${v.placas||'—'}</dd></dl>
    <dl class="fl-veh-info-d"><dt>Responsable</dt><dd>${(v.responsable||'—').split(' ')[0]}</dd></dl>
    <dl class="fl-veh-info-d"><dt>Plaza</dt><dd>${v.plaza||'—'}</dd></dl>
    <dl class="fl-veh-info-d"><dt>Status</dt><dd>${(v.status||'activo').toUpperCase()}</dd></dl>`;
  panel.style.display='block';
  // Auto seleccionar tipo de vehículo según el vehículo
  const esGrande=['camion','camioneta'].includes(v.tipo);
  flSolTipoVeh(esGrande?'troca':'auto');
};

window.flSolTipo=function(val){
  const wrap=document.getElementById('fl-s-tipo-custom-wrap'); if(!wrap) return;
  wrap.style.display=val==='__custom__'?'block':'none';
  if(val==='__custom__') document.getElementById('fl-s-tipo-custom')?.focus();
};

window.flSolTipoVeh=function(tipo){
  tipoVehSel=tipo;
  document.getElementById('fl-tipo-auto')?.classList.toggle('on',tipo==='auto');
  document.getElementById('fl-tipo-troca')?.classList.toggle('on',tipo==='troca');
  // Re-render SVGs con nuevo tipo
  const grid=document.getElementById('fl-dmg-grid'); if(!grid) return;
  grid.innerHTML=
    dmgSVGCard('frente',tipo,dmgPts.frente)+
    dmgSVGCard('trasera',tipo,dmgPts.trasera)+
    dmgSVGCard('lateral_izq',tipo,dmgPts.lateral_izq)+
    dmgSVGCard('lateral_der',tipo,dmgPts.lateral_der);
};

window.flDmgClick=function(e,vista){
  const svg=document.getElementById('fl-ds-'+vista); if(!svg) return;
  const rect=svg.getBoundingClientRect();
  const vb=svg.viewBox.baseVal;
  const x=((e.clientX-rect.left)/rect.width)*vb.width;
  const y=((e.clientY-rect.top)/rect.height)*vb.height;
  if(!dmgPts[vista]) dmgPts[vista]=[];
  dmgPts[vista].push({x:Math.round(x),y:Math.round(y)});
  // Actualizar solo el grupo de puntos
  const g=document.getElementById('fl-dp-'+vista);
  if(g) g.innerHTML=dmgPts[vista].map((p,i)=>`
    <circle cx="${p.x}" cy="${p.y}" r="8" fill="#EF4444" stroke="#fff" stroke-width="2" opacity=".92"/>
    <text x="${p.x}" y="${p.y+3}" text-anchor="middle" font-size="7.5" font-weight="800" fill="#fff">${i+1}</text>`).join('');
  const lbl=document.getElementById('fl-dpt-'+vista);
  if(lbl) lbl.textContent=`${dmgPts[vista].length} daño(s) marcado(s)`;
};

window.flDmgClear=function(vista){
  dmgPts[vista]=[];
  const g=document.getElementById('fl-dp-'+vista);
  if(g) g.innerHTML='';
  const lbl=document.getElementById('fl-dpt-'+vista);
  if(lbl) lbl.textContent='Sin daños';
};

window.flSolEv=function(input){
  const files=Array.from(input.files); if(!files.length) return;
  files.forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{
      solEvidencias.push(e.target.result);
      const pills=document.getElementById('fl-s-ev-pills');
      if(pills) pills.innerHTML=solEvidencias.map((b,i)=>`<span class="fl-pill" onclick="flVerImg('${b}')">${I.camera} Foto ${i+1}</span>`).join('');
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
    vehiculoId:vId, vehiculoEco:v?.eco||'', vehiculo:`${v?.eco} · ${v?.unidad||''}`,
    tipo, prioridad:prior, descripcion:desc, kilometrajeReportado:km||'', taller:taller||'',
    tipoUnidad:tipoVehSel, estatus:'Solicitud',
    solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
    creadoPor:window.auth?.currentUser?.email||'', creadoEn:new Date().toISOString(),
    evidencias:solEvidencias,
    danos:{frente:dmgPts.frente,trasera:dmgPts.trasera,lateral_izq:dmgPts.lateral_izq,lateral_der:dmgPts.lateral_der},
  };
  const btn=document.getElementById('fl-s-submit');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    await fs.addDoc(fs.collection(db,C.SOLS),doc);
    if(km&&v&&!v.id.startsWith('eco-')) await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{km:Number(km)}).catch(()=>{});
    solEvidencias=[]; dmgPts={frente:[],trasera:[],lateral_izq:[],lateral_der:[]};
    document.getElementById('fl-modal-sol')?.remove();
    await loadSols(); flVista(vistaAct);
    if(window.mostrarPush) window.mostrarPush('Solicitud creada','En proceso de validación.','✓');
  }catch(e){
    console.error('[FLOTILLA]',e);alert('Error: '+e.message);
    if(btn){btn.disabled=false;btn.textContent=`${I.check} Crear solicitud`;}
  }
};

// ══════════════════════════════════════════
// MODAL — VER SOLICITUD
// ══════════════════════════════════════════
window.flVerSol=function(id){
  const s=flS.find(x=>x.id===id); if(!s) return;
  const pA=hP('aprobar'),pV=hP('validar'),pC=hP('subir_cotizacion'),pE=hP('eliminar');
  const v=flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId);
  // SVG daños guardados
  const danos=s.danos||{};
  const hasDanos=Object.values(danos).some(a=>a&&a.length>0);
  const tipoU=s.tipoUnidad||'auto';
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal wide">
    <div class="fl-mh">
      <h3>${I.doc} Solicitud · ${id.substring(0,8).toUpperCase()}</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      ${v?`<div class="fl-veh-info-bar" style="margin-bottom:14px">
        <div class="fl-veh-info-emo">${hEmo(v.tipo)}</div>
        <div><div class="fl-veh-info-name">${v.unidad||'—'} ${v.año||''}</div><div class="fl-veh-info-sub">ECO ${v.eco} · ${v.placas||'—'}</div></div>
        <div class="fl-veh-info-grid">
          <dl class="fl-veh-info-d"><dt>Responsable</dt><dd>${v.responsable||'—'}</dd></dl>
          <dl class="fl-veh-info-d"><dt>Plaza</dt><dd>${v.plaza||'—'}</dd></dl>
          <dl class="fl-veh-info-d"><dt>Póliza</dt><dd>${v.pol||'—'}</dd></dl>
          <dl class="fl-veh-info-d"><dt>Status</dt><dd>${(v.status||'activo').toUpperCase()}</dd></dl>
        </div>
      </div>`:''}
      <div class="fl-sg">
        <dl class="fl-sc"><dt>Tipo</dt><dd>${s.tipo||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Estado</dt><dd>${hBadge(s.estatus)}</dd></dl>
        <dl class="fl-sc"><dt>Prioridad</dt><dd>${s.prioridad||'Normal'}</dd></dl>
        <dl class="fl-sc"><dt>Cotización</dt><dd style="font-weight:800;font-size:14px">${s.cotizacion||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Taller / Proveedor</dt><dd>${s.taller||'—'}</dd></dl>
        <dl class="fl-sc"><dt>KM reportado</dt><dd>${s.kilometrajeReportado||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Solicitante</dt><dd>${s.solicitante||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Fecha</dt><dd>${hF(s.creadoEn)}</dd></dl>
        <dl class="fl-sc full"><dt>Descripción</dt><dd>${s.descripcion||'—'}</dd></dl>
      </div>
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:9px;padding:10px 13px;font-size:11.5px;color:#991B1B;margin-bottom:10px"><strong>Motivo rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
      ${hasDanos?`
        <div class="fl-sep"></div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px">Diagrama de daños</div>
        <div class="fl-dmg-grid" style="pointer-events:none">
          ${dmgSVGCard('frente',tipoU,danos.frente||[])}
          ${dmgSVGCard('trasera',tipoU,danos.trasera||[])}
          ${dmgSVGCard('lateral_izq',tipoU,danos.lateral_izq||[])}
          ${dmgSVGCard('lateral_der',tipoU,danos.lateral_der||[])}
        </div>`:''}
      ${s.evidencias&&s.evidencias.length?`
        <div class="fl-sep"></div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px">Evidencias (${s.evidencias.length})</div>
        <div class="fl-pills">${s.evidencias.map((e,i)=>`<span class="fl-pill" onclick="flVerImg('${e}')">${I.camera} Foto ${i+1}</span>`).join('')}</div>`:''}
      <div class="fl-sep"></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${(pV&&s.estatus==='Solicitud')?`<button class="fb accent" onclick="flEstatus('${s.id}','Validada');this.closest('.fl-ov').remove()">${I.check} Validar</button>`:``}
        ${((pC||pV)&&s.estatus==='Validada')?`<button class="fb ghost" onclick="flCotizar('${s.id}')">Registrar cotización</button>`:``}
        ${(pA&&(s.estatus==='Validada'||s.estatus==='Cotización'))?`
          <button class="fb accent" onclick="flAprobar('${s.id}');this.closest('.fl-ov').remove()">${I.check} Aprobar</button>
          <button class="fb danger" onclick="flRechazar('${s.id}');this.closest('.fl-ov').remove()">${I.x} Rechazar</button>`:``}
        ${(pV&&s.estatus==='Aprobada')?`<button class="fb ghost" onclick="flEstatus('${s.id}','Cierre');this.closest('.fl-ov').remove()">Enviar a cierre</button>`:``}
        ${(pV&&s.estatus==='Cierre')?`<button class="fb ghost" onclick="flEstatus('${s.id}','Cerrada');this.closest('.fl-ov').remove()">Marcar cerrada</button>`:``}
        ${pE?`<button class="fb danger" style="margin-left:auto" onclick="flEliminar('${s.id}');this.closest('.fl-ov').remove()">${I.trash} Eliminar</button>`:``}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ══════════════════════════════════════════
// MODAL — REGISTRAR COMISIÓN
// ══════════════════════════════════════════
window.flAbrirComis=function(){
  comEvidEntrega=[]; comEvidRecepcion=[];
  const vehs=flV.filter(v=>!v.status||v.status==='activo');
  const ov=document.createElement('div'); ov.className='fl-ov'; ov.id='fl-modal-comis';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh">
      <h3>${I.road} Registrar préstamo / comisión</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      <div class="fl-form">
        <div class="fl-fld">
          <label>Vehículo</label>
          <select id="fl-c-veh">
            <option value="">— Selecciona —</option>
            ${vehs.map(v=>`<option value="${v.id}" data-eco="${v.eco}">${v.eco} · ${v.unidad||'—'} · ${v.placas||'—'}</option>`).join('')}
          </select>
        </div>
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Responsable del préstamo</label>
            <input type="text" id="fl-c-resp" placeholder="Nombre completo">
          </div>
          <div class="fl-fld">
            <label>Tipo de comisión</label>
            <select id="fl-c-tipo">
              <option>Corto plazo</option>
              <option>Largo plazo</option>
            </select>
          </div>
        </div>
        <div class="fl-fld">
          <label>Motivo / Destino</label>
          <textarea id="fl-c-motivo" placeholder="Describe el motivo del préstamo y destino…" style="min-height:60px"></textarea>
        </div>
        <div class="fl-fr">
          <div class="fl-fld">
            <label>Fecha de entrega</label>
            <input type="date" id="fl-c-fent" value="${new Date().toISOString().substring(0,10)}">
          </div>
          <div class="fl-fld">
            <label>Fecha estimada de regreso</label>
            <input type="date" id="fl-c-freg">
          </div>
        </div>
        <div class="fl-fr">
          <div class="fl-fld">
            <label>KM al entregar</label>
            <input type="number" id="fl-c-kment" placeholder="Kilometraje actual">
          </div>
          <div class="fl-fld">
            <label>Nivel de gasolina entrega</label>
            <select id="fl-c-gasent">
              <option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Vacío</option>
            </select>
          </div>
        </div>
        <div class="fl-fld">
          <label>${I.camera} Evidencias al entregar</label>
          <label class="fl-up" onclick="document.getElementById('fl-c-ev-ent').click()">
            ${I.upload} Fotos del vehículo al momento de entrega
          </label>
          <input type="file" id="fl-c-ev-ent" accept="image/*" multiple style="display:none" onchange="flComEv(this,'entrega')">
          <div class="fl-pills" id="fl-c-pills-ent"></div>
        </div>
        <div class="fl-fasig">${I.user} Registrado por: <strong>${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</strong></div>
        <div class="fl-fa">
          <button class="fb ghost" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
          <button class="fb accent" onclick="flGuardarComis()">${I.check} Registrar comisión</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flComEv=function(input,tipo){
  const files=Array.from(input.files); if(!files.length) return;
  files.forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{
      if(tipo==='entrega') comEvidEntrega.push(e.target.result);
      else comEvidRecepcion.push(e.target.result);
      const pills=document.getElementById(`fl-c-pills-${tipo==='entrega'?'ent':'rec'}`);
      const arr=tipo==='entrega'?comEvidEntrega:comEvidRecepcion;
      if(pills) pills.innerHTML=arr.map((b,i)=>`<span class="fl-pill" onclick="flVerImg('${b}')">${I.camera} Foto ${i+1}</span>`).join('');
    };
    r.readAsDataURL(f);
  });
};

window.flGuardarComis=async function(){
  const selEl=document.getElementById('fl-c-veh');
  const vId=selEl?.value;
  const resp=document.getElementById('fl-c-resp')?.value?.trim();
  const motivo=document.getElementById('fl-c-motivo')?.value?.trim();
  const fent=document.getElementById('fl-c-fent')?.value;
  const freg=document.getElementById('fl-c-freg')?.value;
  const kment=document.getElementById('fl-c-kment')?.value;
  const gas=document.getElementById('fl-c-gasent')?.value||'—';
  const tipo=document.getElementById('fl-c-tipo')?.value||'Corto plazo';
  if(!vId){alert('Selecciona un vehículo.');return;}
  if(!resp){alert('Ingresa el responsable.');return;}
  if(!fent){alert('Ingresa la fecha de entrega.');return;}
  const v=flV.find(x=>x.id===vId);
  const ecoOpt=selEl.options[selEl.selectedIndex]?.dataset?.eco||v?.eco||'';
  const doc={
    vehiculoId:vId, vehiculoEco:ecoOpt, vehiculo:`${ecoOpt} · ${v?.unidad||''}`,
    responsable:resp, tipo, motivo:motivo||'', estatus:'En préstamo',
    fechaEntrega:fent, fechaRegreso:freg||'', kmEntrega:kment||'',
    gasolinaEntrega:gas, evidenciasEntrega:comEvidEntrega, evidenciasRecepcion:[],
    registradoPor:window.auth?.currentUser?.email||'', creadoEn:new Date().toISOString(),
  };
  try{
    const ref=await fs.addDoc(fs.collection(db,C.COMIS),doc);
    // Marcar vehículo en comisión
    if(v&&!v.id.startsWith('eco-')){
      await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{status:'comision',km:Number(kment)||v.km||0}).catch(()=>{});
      v.status='comision';
    }
    comEvidEntrega=[]; comEvidRecepcion=[];
    document.getElementById('fl-modal-comis')?.remove();
    await loadComis(); flVista('comis');
    if(window.mostrarPush) window.mostrarPush('Comisión registrada','','✓');
  }catch(e){console.error('[FLOTILLA]',e);alert('Error: '+e.message);}
};

// VER COMISIÓN
window.flVerComis=function(id){
  const c=flCom.find(x=>x.id===id); if(!c) return;
  const pA=hAdm();
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh">
      <h3>${I.road} Comisión · ${id.substring(0,8).toUpperCase()}</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      <div class="fl-sg">
        <dl class="fl-sc"><dt>Vehículo</dt><dd>${c.vehiculo||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Estado</dt><dd>${hBadge(c.estatus||'En préstamo')}</dd></dl>
        <dl class="fl-sc"><dt>Responsable</dt><dd>${c.responsable||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Tipo</dt><dd>${c.tipo||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Fecha entrega</dt><dd>${hF(c.fechaEntrega)}</dd></dl>
        <dl class="fl-sc"><dt>Fecha regreso</dt><dd>${c.fechaRegreso?hF(c.fechaRegreso):'Pendiente'}</dd></dl>
        <dl class="fl-sc"><dt>KM entrega</dt><dd>${c.kmEntrega||'—'}</dd></dl>
        <dl class="fl-sc"><dt>KM recepción</dt><dd>${c.kmRecepcion||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Gasolina entrega</dt><dd>${c.gasolinaEntrega||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Gasolina recepción</dt><dd>${c.gasolinaRecepcion||'—'}</dd></dl>
        <dl class="fl-sc full"><dt>Motivo / Destino</dt><dd>${c.motivo||'—'}</dd></dl>
      </div>
      ${c.evidenciasEntrega?.length?`
        <div class="fl-sep"></div>
        <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px">Evidencias entrega (${c.evidenciasEntrega.length})</div>
        <div class="fl-pills">${c.evidenciasEntrega.map((e,i)=>`<span class="fl-pill" onclick="flVerImg('${e}')">${I.camera} Foto ${i+1}</span>`).join('')}</div>`:''}
      ${c.evidenciasRecepcion?.length?`
        <div class="fl-sep"></div>
        <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px">Evidencias recepción (${c.evidenciasRecepcion.length})</div>
        <div class="fl-pills">${c.evidenciasRecepcion.map((e,i)=>`<span class="fl-pill" onclick="flVerImg('${e}')">${I.camera} Foto ${i+1}</span>`).join('')}</div>`:''}
      ${pA&&c.estatus==='En préstamo'?`
        <div class="fl-sep"></div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:10px">Registrar recepción del vehículo</div>
        <div class="fl-fr">
          <div class="fl-fld"><label>KM al recibir</label><input type="number" id="fl-cr-km" placeholder="Kilometraje"></div>
          <div class="fl-fld"><label>Gasolina al recibir</label><select id="fl-cr-gas"><option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Vacío</option></select></div>
        </div>
        <div class="fl-fld" style="margin-top:10px">
          <label>${I.camera} Evidencias de recepción</label>
          <label class="fl-up" onclick="document.getElementById('fl-cr-ev').click()">${I.upload} Fotos al recibir el vehículo</label>
          <input type="file" id="fl-cr-ev" accept="image/*" multiple style="display:none" onchange="flComEv(this,'recepcion')">
          <div class="fl-pills" id="fl-c-pills-rec"></div>
        </div>
        <div class="fl-fa">
          <button class="fb ghost" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
          <button class="fb accent" onclick="flCerrarComis('${c.id}')">${I.check} Registrar devolución</button>
        </div>`:`
        <div class="fl-fa">
          <button class="fb ghost" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
        </div>`}
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flCerrarComis=async function(id){
  const km=document.getElementById('fl-cr-km')?.value;
  const gas=document.getElementById('fl-cr-gas')?.value||'—';
  try{
    await fs.updateDoc(fs.doc(db,C.COMIS,id),{
      estatus:'Devuelto', kmRecepcion:km||'', gasolinaRecepcion:gas,
      evidenciasRecepcion:comEvidRecepcion, fechaDevolucion:new Date().toISOString(),
    });
    // Restaurar vehículo a activo
    const c=flCom.find(x=>x.id===id);
    if(c){
      const v=flV.find(x=>x.id===c.vehiculoId);
      if(v&&!v.id.startsWith('eco-')){
        await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{status:'activo',km:Number(km)||v.km}).catch(()=>{});
        v.status='activo';
      }
    }
    comEvidRecepcion=[];
    document.querySelector('.fl-ov')?.remove();
    await loadComis(); flVista('comis');
    if(window.mostrarPush) window.mostrarPush('Vehículo devuelto','Comisión cerrada correctamente.','✓');
  }catch(e){console.error('[FLOTILLA]',e);alert('Error: '+e.message);}
};

// ── ACCIONES SOLICITUDES ──
window.flEstatus=async(id,est)=>{
  try{
    await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:est,actualizadoEn:new Date().toISOString()});
    await loadSols(); flVista(vistaAct);
  }catch(e){console.error('[FLOTILLA]',e);}
};
window.flAprobar=id=>flEstatus(id,'Aprobada');
window.flRechazar=async id=>{
  const m=prompt('Motivo del rechazo:'); if(!m?.trim()) return;
  try{
    await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:'Rechazada',comentarioRechazo:m,actualizadoEn:new Date().toISOString()});
    await loadSols(); flVista(vistaAct);
  }catch(e){console.error('[FLOTILLA]',e);}
};
window.flEliminar=async id=>{
  if(!confirm('¿Eliminar solicitud permanentemente?')) return;
  try{
    await fs.deleteDoc(fs.doc(db,C.SOLS,id));
    await loadSols(); flVista(vistaAct);
  }catch(e){console.error('[FLOTILLA]',e);}
};
window.flCotizar=id=>{
  const s=flS.find(x=>x.id===id);
  const m=prompt('Monto de cotización:',s?.cotizacion||''); if(m===null) return;
  const t=prompt('Taller / Proveedor:',s?.taller||''); if(t===null) return;
  fs.updateDoc(fs.doc(db,C.SOLS,id),{cotizacion:m,taller:t,estatus:'Cotización',actualizadoEn:new Date().toISOString()})
    .then(async()=>{await loadSols();document.querySelector('.fl-ov')?.remove();flVista(vistaAct);});
};

// VER IMAGEN
window.flVerImg=src=>{
  const ov=document.createElement('div'); ov.className='fl-ov'; ov.style.cursor='zoom-out';
  ov.innerHTML=`<img src="${src}" style="max-width:92%;max-height:92%;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.5)">`;
  ov.onclick=()=>ov.remove(); document.body.appendChild(ov);
};

// VER VEHÍCULO (bajas)
window.flVerVeh=function(id){
  const v=flV.find(x=>x.id===id); if(!v) return;
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>${hEmo(v.tipo)} ECO ${v.eco} · ${v.unidad||'—'}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div class="fl-sg">
        <dl class="fl-sc"><dt>Placas</dt><dd>${v.placas||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Año</dt><dd>${v.año||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Serie / VIN</dt><dd style="font-size:10px">${v.serie||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Color</dt><dd>${v.color||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Plaza</dt><dd>${v.plaza||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Responsable</dt><dd>${v.responsable||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Último KM</dt><dd>${v.km||'—'}</dd></dl>
        <dl class="fl-sc"><dt>Fecha de baja</dt><dd>${hF(v.fechaBaja)||'—'}</dd></dl>
        <dl class="fl-sc full"><dt>Motivo de baja</dt><dd>${v.motivoBaja||'—'}</dd></dl>
      </div>
      <div class="fl-fa">
        <button class="fl-mx" style="width:auto;padding:0 16px;font-size:12px" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
        ${hAdm()?`<button class="fb accent" onclick="flReactivar('${v.id}');this.closest('.fl-ov').remove()">Reactivar vehículo</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flReactivar=async function(id){
  if(!confirm('¿Reactivar este vehículo a la flota activa?')) return;
  try{
    await fs.updateDoc(fs.doc(db,C.VEHS,id),{status:'activo',fechaBaja:'',motivoBaja:''});
    const v=flV.find(x=>x.id===id); if(v){v.status='activo';}
    flVista('bajas');
  }catch(e){console.error('[FLOTILLA]',e);}
};

console.log('[FLOTILLA v8] '+CAT.length+' unidades · Tecnocontrol');
})();
