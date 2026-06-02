// ══════════════════════════════════════════════════════════════
// flotilla.js v6 — Gestión Vehicular Tecnocontrol
// Design: Vehicle Analysis · Car Rental App · Kipup-inspired
// Módulos: Vehículos · Inspección · Solicitudes · Comisiones · Bajas
// ══════════════════════════════════════════════════════════════
(function () {
'use strict';

// ── FIRESTORE COLLECTIONS ──
const C = {
  VEHS:   'flotilla_vehiculos',
  SOLS:   'flotilla_solicitudes',
  INSP:   'flotilla_inspecciones',
  COMIS:  'flotilla_comisiones',
  BAJAS:  'flotilla_bajas',
};

// ── CATÁLOGO BASE (49 unidades reales) ──
const CAT = [
  {eco:'15',unidad:'NISSAN NP300 2017',     año:2017,plaza:'JUAREZ',    responsable:'JORGE GUERRERO',   placas:'DU6478A',serie:'3N6AD33A3HK869708',rendimiento:'7 KM/L',   poliza_venc:'2026-09-24',poliza:'794B05035M-17',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'16',unidad:'GRUA F-350 2010',       año:2010,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6497A',serie:'1FDEF3G59AEB23674', rendimiento:'5 KM/L',   poliza_venc:'2026-09-24',poliza:'794B05035M-10',tipo:'camion',   color:'Blanco',nip:''},
  {eco:'17',unidad:'MARCH ACTIVE 2017',     año:2017,plaza:'CHIHUAHUA', responsable:'GUILLERMO',        placas:'EMB313A',serie:'3N1CK3CD5HL248558', rendimiento:'14.5 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-23',tipo:'auto',     color:'Blanco',nip:'1713'},
  {eco:'19',unidad:'RAM 700 2017',          año:2017,plaza:'CHIHUAHUA', responsable:'ROBERTO MUÑOZ',    placas:'DU6471A',serie:'9BD578458HY162606', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-20',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'21',unidad:'RAM 700 2018',          año:2018,plaza:'JUAREZ',    responsable:'BENITO SOTO',      placas:'DU6470A',serie:'9BD578452JY210560', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-12',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'22',unidad:'RAM 700 2018',          año:2018,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6751A',serie:'9BD578456JY208715', rendimiento:'9 KM/L',   poliza_venc:'2026-09-24',poliza:'794B05035M-13',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'23',unidad:'RAM 700 2018',          año:2018,plaza:'CHIHUAHUA', responsable:'SERGIO CARMONA',   placas:'DU6752A',serie:'9BD578454JY209023', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-14',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'26',unidad:'SEAT IBIZA 2018',       año:2018,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EMB314A',serie:'VSBB2KJ1JR017261',  rendimiento:'13 KM/L',  poliza_venc:'2026-09-24',poliza:'794B05035M-19',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'31',unidad:'NP300 KANGOO 2012',     año:2012,plaza:'CHIHUAHUA', responsable:'DESARROLLOS',      placas:'DU6754A',serie:'3N6DD25T5CK018279', rendimiento:'8 KM/L',   poliza_venc:'2026-09-24',poliza:'794B05035M-6', tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'35',unidad:'ISUZU 2019',            año:2019,plaza:'CHIHUAHUA', responsable:'ALMACEN',          placas:'DU6495A',serie:'JAANPR755K7000178', rendimiento:'3.5 KM/L', poliza_venc:'2026-09-24',poliza:'794B05035M-9', tipo:'camion',   color:'Blanco',nip:''},
  {eco:'36',unidad:'CAMION NISSAN CS 2014', año:2014,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6494A',serie:'3N6DD25T9EK019471', rendimiento:'8 KM/L',   poliza_venc:'2026-09-24',poliza:'794B05035M-18',tipo:'camion',   color:'Blanco',nip:''},
  {eco:'37',unidad:'RAM 700 2019',          año:2019,plaza:'JUAREZ',    responsable:'JUAREZ',           placas:'DU6493A',serie:'9BD578458KY323611', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-21',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'38',unidad:'RAM 700 2019',          año:2019,plaza:'CHIHUAHUA', responsable:'DIONICIO',         placas:'DU6492A',serie:'9BD578455KY324652', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-22',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'39',unidad:'L200 2019',             año:2019,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'DU6491A',serie:'MMBL45G1KH043444',  rendimiento:'10 KM/L',  poliza_venc:'2026-09-24',poliza:'794B05035M-30',tipo:'camioneta',color:'Blanco',nip:'1339'},
  {eco:'40',unidad:'MARCH ACTIVE 2019',     año:2019,plaza:'MONTERREY', responsable:'IVAN SEPULVEDA',   placas:'DU6490A',serie:'3N6CK34N2KL230477', rendimiento:'10.5 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-2', tipo:'auto',     color:'Blanco',nip:''},
  {eco:'43',unidad:'F-150 PICK-UP 2012',    año:2012,plaza:'CHIHUAHUA', responsable:'—',                placas:'DU6488A',serie:'1FTMF1CM1CKD41243', rendimiento:'5.6 KM/L', poliza_venc:'2026-09-24',poliza:'794B05035M-5', tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'47',unidad:'MARCH ACTIVE L4 2019',  año:2019,plaza:'CHIHUAHUA', responsable:'IDALY RUIZ',       placas:'EMB308A',serie:'3N1CK3CD5KL232108', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-24',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'48',unidad:'MARCH ACTIVE L4 2019',  año:2019,plaza:'CHIHUAHUA', responsable:'IVAN ARGENIS',     placas:'EMB309A',serie:'3N1CK3CD4KL232066', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-8', tipo:'auto',     color:'Blanco',nip:''},
  {eco:'50',unidad:'FIESTA 2018',           año:2018,plaza:'MONTERREY', responsable:'IRVING SAUCEDO',   placas:'EMB310A',serie:'3FADP4BJ1JM128469', rendimiento:'11.3 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-11',tipo:'auto',     color:'Plata', nip:''},
  {eco:'52',unidad:'MARCH 2020',            año:2020,plaza:'MONTERREY', responsable:'MONTERREY',        placas:'DU6486A',serie:'3N6CK34N3LL243692', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-26',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'54',unidad:'RAM 700 SLT 2020',      año:2020,plaza:'CHIHUAHUA', responsable:'RICARDO GONZALEZ', placas:'DU6485A',serie:'9BD578452LY411572', rendimiento:'17.5 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-33',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'55',unidad:'MARCH 2020',            año:2020,plaza:'MONTERREY', responsable:'ROQUE LEAL',       placas:'DU6484A',serie:'3N6CK34N3LL248469', rendimiento:'11.72 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-27',tipo:'auto',    color:'Blanco',nip:''},
  {eco:'56',unidad:'RAM 700 SLT 2020',      año:2020,plaza:'PARRAL',    responsable:'PLAZA PARRAL',     placas:'DU6483A',serie:'9BD578451LY423955', rendimiento:'14.5 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-34',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'58',unidad:'RAM 700 2021',          año:2021,plaza:'CHIHUAHUA', responsable:'ISMAEL BARRAZA',   placas:'DU6482A',serie:'9BD281G50MYV59661', rendimiento:'12.7 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-35',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'59',unidad:'RAM 700 2021',          año:2021,plaza:'CHIHUAHUA', responsable:'ALAN ESTRADA',     placas:'DU6481A',serie:'9BD281G56MYV59423', rendimiento:'13.5 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-36',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'60',unidad:'MARCH 2020',            año:2020,plaza:'CAMARGO',   responsable:'RAMON HERNANDEZ',  placas:'DU6480A',serie:'3N6CK34N9LL254065', rendimiento:'11.59 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-28',tipo:'auto',    color:'Blanco',nip:''},
  {eco:'61',unidad:'MARCH 2020',            año:2020,plaza:'PARRAL',    responsable:'RICARDO MORIEL',   placas:'DU6479A',serie:'3N6CK34N2LL254229', rendimiento:'13.9 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-29',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'62',unidad:'NP300 2019',            año:2019,plaza:'MONTERREY', responsable:'JULIO DE LA CRUZ', placas:'DU6472A',serie:'3N6AD33A1KK838707', rendimiento:'7.5 KM/L',  poliza_venc:'2026-09-24',poliza:'794B05035M-31',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'63',unidad:'SILVERADO 1500 2013',   año:2013,plaza:'CHIHUAHUA', responsable:'BODEGA',           placas:'DU6473A',serie:'3GCNC9CX6DG343777', rendimiento:'5.5 KM/L',  poliza_venc:'2026-09-24',poliza:'794B05035M-25',tipo:'camioneta',color:'Plata', nip:''},
  {eco:'64',unidad:'MARCH ACTIVE 2017',     año:2017,plaza:'CHIHUAHUA', responsable:'VERONICA GARCIA',  placas:'DU6474A',serie:'3N6CK34N4HL242297', rendimiento:'10.59 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-32',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'66',unidad:'AVEO 2018',             año:2018,plaza:'CHIHUAHUA', responsable:'CARMEN HERNANDEZ', placas:'EMB311A',serie:'LSGHD52H6JD239610', rendimiento:'11.25 KM/L',poliza_venc:'2026-09-24',poliza:'794B05035M-37',tipo:'auto',     color:'Gris',  nip:''},
  {eco:'69',unidad:'NISSAN NP300 2017',     año:2017,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6499A',serie:'3N6AD33A6HK837318', rendimiento:'—',        poliza_venc:'2026-09-24',poliza:'794B05035M-38',tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'71',unidad:'YUKON 2023',            año:2023,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DYY416B',serie:'1GKS28KL1PR236241', rendimiento:'—',        poliza_venc:'—',         poliza:'—',            tipo:'camioneta',color:'Negro', nip:''},
  {eco:'72',unidad:'RAM RAPID 2023',        año:2023,plaza:'CHIHUAHUA', responsable:'JORGE URIBE',      placas:'DG7445B',serie:'9BD2657RIP9233026',  rendimiento:'14 KM/L',  poliza_venc:'—',         poliza:'—',            tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'73',unidad:'DODGE ATTITUDE 2023',   año:2023,plaza:'CHIHUAHUA', responsable:'DENISSE GUTIERREZ',placas:'MKL325A',serie:'ML3ABT6J4PH004521', rendimiento:'—',        poliza_venc:'—',         poliza:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'74',unidad:'DODGE ATTITUDE 2023',   año:2023,plaza:'CHIHUAHUA', responsable:'FATIMA SAUZAMEDA', placas:'MKL317A',serie:'ML3ABT6J4PH004552', rendimiento:'15.8 KM/L',poliza_venc:'—',         poliza:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'75',unidad:'AVEO 2019',             año:2019,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DUJ454B',serie:'LSGHD52H8KD130423', rendimiento:'—',        poliza_venc:'2027-02-14',poliza:'29113016152002',tipo:'auto',     color:'Blanco',nip:''},
  {eco:'76',unidad:'NISSAN VERSA 2024',     año:2024,plaza:'MONTERREY', responsable:'LUIS GARZA',       placas:'ESU908B',serie:'3N1CN7AE7RK398169', rendimiento:'16 KM/L',  poliza_venc:'—',         poliza:'—',            tipo:'auto',     color:'Blanco',nip:''},
  {eco:'77',unidad:'BMW X6 2025',           año:2025,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EKM897B',serie:'WBA41EX06S9W75509', rendimiento:'—',        poliza_venc:'—',         poliza:'—',            tipo:'auto',     color:'Negro', nip:''},
  {eco:'79',unidad:'CHANGAN HUNTER 2025',   año:2025,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'337217', serie:'LSCBBZ2A1SG803364', rendimiento:'—',        poliza_venc:'2029-02-27',poliza:'4056350008',   tipo:'camioneta',color:'Blanco',nip:'7925'},
  {eco:'80',unidad:'CHANGAN HUNTER 2025',   año:2025,plaza:'CHIHUAHUA', responsable:'ULISES NUÑEZ',     placas:'337218', serie:'LSCBBZ2A3SG803365', rendimiento:'—',        poliza_venc:'2029-02-27',poliza:'4056347985',   tipo:'camioneta',color:'Blanco',nip:'8025'},
  {eco:'81',unidad:'CHANGAN HUNTER 2025',   año:2025,plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',      placas:'337219', serie:'LSCBB72A8SG803376', rendimiento:'—',        poliza_venc:'2029-02-27',poliza:'4056350016',   tipo:'camioneta',color:'Blanco',nip:'8125'},
  {eco:'82',unidad:'VAN CARGA DONGFENG 2026',año:2026,plaza:'CHIHUAHUA',responsable:'TOMAS',            placas:'DZ9769B',serie:'LGFP541E6TA603994', rendimiento:'—',        poliza_venc:'2029-03-17',poliza:'4056530506',   tipo:'camion',   color:'Blanco',nip:''},
  {eco:'83',unidad:'CHASIS DC DONGFENG 2025',año:2025,plaza:'CHIHUAHUA',responsable:'—',               placas:'DZ9767B',serie:'LGDND41EXSA202059', rendimiento:'—',        poliza_venc:'2029-03-17',poliza:'4056530481',   tipo:'camion',   color:'Blanco',nip:''},
  {eco:'84',unidad:'CHASIS DC DONGFENG 2025',año:2025,plaza:'CHIHUAHUA',responsable:'—',               placas:'DZ9766B',serie:'LGDND41E6SA202057', rendimiento:'—',        poliza_venc:'2029-03-17',poliza:'4056530495',   tipo:'camion',   color:'Blanco',nip:''},
  {eco:'85',unidad:'PICKUP DONGFENG 2025',  año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9768B',serie:'LGDCMA1L5SA204421', rendimiento:'—',        poliza_venc:'2029-03-20',poliza:'3200970801',   tipo:'camioneta',color:'Blanco',nip:''},
  {eco:'90',unidad:'CHANGAN STAR 2026',     año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9853B',serie:'LSCAB12E7TG800860', rendimiento:'—',        poliza_venc:'2026-11-01',poliza:'1950290311',   tipo:'camion',   color:'Blanco',nip:''},
  {eco:'91',unidad:'CHANGAN STAR DC 2026',  año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9855B',serie:'LSCAB22E6TG800256', rendimiento:'—',        poliza_venc:'2026-11-01',poliza:'1950290357',   tipo:'camion',   color:'Blanco',nip:''},
  {eco:'92',unidad:'CHANGAN STAR DC 2026',  año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9854B',serie:'LSCAB22E5TG800295', rendimiento:'—',        poliza_venc:'2026-11-01',poliza:'1950290361',   tipo:'camion',   color:'Blanco',nip:''},
];

// ── CHECKLIST DETALLADO ──
const CHK = {
  cristales: ['Medallón delantero','Vidrio trasero','Lateral derecho delantero','Lateral derecho trasero','Lateral izquierdo delantero','Lateral izquierdo trasero'],
  espejos:   ['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],
  neumaticos:['Llanta delantera derecha','Llanta delantera izquierda','Llanta trasera derecha','Llanta trasera izquierda','Llanta de refacción'],
  interiores:['Póliza / Manual de propietario','Radio / Carátula','Pantallas / FIS','Encendedor','Asientos y vestiduras','Tablero en buen estado','Tapetes'],
  motor:     ['Batería','Bobinas','Computadora','Tapón agua limpiabrisas','Tapón radiador','Tapón dirección hidráulica'],
  cajuela:   ['Herramienta','Cables de arranque','Extintor','Llanta refacción','Llave L','Llave de cruz'],
  legal:     ['Sin multas de tránsito vigentes','Verificación ambiental vigente','Tenencia al corriente','Tarjeta de circulación vigente'],
};

// ── ESTADO ──
let flV=[], flS=[], flC=[];
let vAct=null, tabAct='info', vistaAct='home', busq='', seccion='activos';
let fotosB64=[];

// ── SVGS ──
const I={
  truck:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  car:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  grid:`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  search:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  check:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  doc:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  camera:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  alert:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  wrench:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  hist:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  clip:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
  upload:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`,
  key:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  road:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 17l3-10h12l3 10"/><path d="M12 7v10"/></svg>`,
  archive:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
  fuel:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 22V8l9-6 9 6v14H3z"/><line x1="12" y1="22" x2="12" y2="13"/><path d="M9 22V13h6v9"/></svg>`,
};

// ── ESTILOS ──
function css(){
  if(document.getElementById('fl-v6-css')) return;
  const s=document.createElement('style'); s.id='fl-v6-css';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

/* ─ BASE ─ */
#flotilla-dashboard{display:none;margin-left:240px;min-height:100vh;background:#F0F2F5;font-family:'Inter',-apple-system,sans-serif;color:#0F172A;}
#flotilla-dashboard *{box-sizing:border-box;margin:0;padding:0;}

/* ─ TOPBAR ─ */
.fl-top{background:#fff;border-bottom:1px solid #E2E8F0;padding:0 24px;display:flex;align-items:center;gap:10px;height:54px;position:sticky;top:0;z-index:200;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.fl-top-brand{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;letter-spacing:-.4px;flex:1;color:#0F172A;}
.fl-top-brand span{color:#2563EB;}
.fl-top-role{font-size:10.5px;padding:3px 9px;border-radius:100px;background:#EFF6FF;color:#1D4ED8;font-weight:700;letter-spacing:.3px;text-transform:uppercase;}
.fl-tb{display:flex;align-items:center;gap:5px;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
.fl-tb.ghost{background:transparent;color:#64748B;border:1px solid #E2E8F0;}
.fl-tb.ghost:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-tb.blue{background:#2563EB;color:#fff;}
.fl-tb.blue:hover{background:#1D4ED8;transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,.3);}
.fl-tb.dark{background:#0F172A;color:#fff;}
.fl-tb.dark:hover{background:#1E293B;}

/* ─ LAYOUT ─ */
.fl-layout{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 54px);}

/* ─ SIDEBAR ─ */
.fl-side{background:#fff;border-right:1px solid #E2E8F0;display:flex;flex-direction:column;overflow:hidden;}
.fl-side-top{padding:14px 12px 10px;border-bottom:1px solid #F1F5F9;}
.fl-side-search{position:relative;}
.fl-side-search input{width:100%;padding:8px 10px 8px 30px;border:1.5px solid #E2E8F0;border-radius:8px;font-size:12px;font-family:inherit;background:#F8FAFC;outline:none;transition:all .15s;color:#0F172A;}
.fl-side-search input:focus{border-color:#2563EB;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-ss-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;display:flex;}
.fl-side-kpis{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:10px 12px;border-bottom:1px solid #F1F5F9;}
.fl-skpi{border-radius:8px;padding:8px 10px;cursor:default;}
.fl-skpi .n{font-size:20px;font-weight:800;line-height:1;font-family:'JetBrains Mono',monospace;}
.fl-skpi .l{font-size:9.5px;font-weight:700;margin-top:2px;text-transform:uppercase;letter-spacing:.5px;}

/* ─ SIDEBAR NAV ─ */
.fl-side-nav{padding:8px;border-bottom:1px solid #F1F5F9;}
.fl-nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:500;color:#64748B;transition:all .15s;margin-bottom:2px;}
.fl-nav-item:hover{background:#F8FAFC;color:#0F172A;}
.fl-nav-item.active{background:#EFF6FF;color:#2563EB;font-weight:700;}
.fl-nav-item .cnt{margin-left:auto;background:#EF4444;color:#fff;font-size:9px;font-weight:800;padding:1px 6px;border-radius:100px;min-width:18px;text-align:center;}
.fl-nav-item .cnt.blue{background:#2563EB;}
.fl-nav-item .cnt.amber{background:#F59E0B;}

/* ─ LISTA VEHÍCULOS ─ */
.fl-side-list{flex:1;overflow-y:auto;padding:8px;}
.fl-side-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;padding:6px 8px 3px;}
.fl-vi{border-radius:8px;padding:8px 10px;cursor:pointer;transition:all .15s;border:1.5px solid transparent;display:flex;align-items:center;gap:8px;margin-bottom:2px;}
.fl-vi:hover{background:#F8FAFC;}
.fl-vi.on{background:#EFF6FF;border-color:#2563EB;}
.fl-vi-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;}
.fl-vi-eco{font-size:12px;font-weight:700;font-family:'JetBrains Mono',monospace;color:#0F172A;}
.fl-vi-sub{font-size:10px;color:#64748B;margin-top:1px;}
.fl-dot{width:6px;height:6px;border-radius:50%;margin-left:auto;flex-shrink:0;}
.fl-dot.g{background:#10B981;}
.fl-dot.y{background:#F59E0B;}
.fl-dot.r{background:#EF4444;}
.fl-dot.off{background:#CBD5E1;}

/* ─ MAIN ─ */
.fl-main{overflow-y:auto;background:#F0F2F5;}
.fl-inner{padding:24px 28px;max-width:1100px;}

/* ─ PAGE HEADER ─ */
.fl-ph{margin-bottom:20px;}
.fl-ph-title{font-size:22px;font-weight:800;letter-spacing:-.6px;color:#0F172A;}
.fl-ph-sub{font-size:13px;color:#64748B;margin-top:3px;}

/* ─ HERO CARD VEHÍCULO ─ */
.fl-hero{background:linear-gradient(135deg,#1E3A5F 0%,#2563EB 100%);border-radius:16px;padding:24px;color:#fff;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center;margin-bottom:20px;position:relative;overflow:hidden;}
.fl-hero::before{content:'';position:absolute;top:-30px;right:-30px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.06);}
.fl-hero::after{content:'';position:absolute;bottom:-50px;right:80px;width:150px;height:150px;border-radius:50%;background:rgba(255,255,255,.04);}
.fl-hero-eco{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;opacity:.7;margin-bottom:4px;}
.fl-hero-name{font-size:24px;font-weight:800;letter-spacing:-.5px;line-height:1.1;}
.fl-hero-placas{font-family:'JetBrains Mono',monospace;font-size:13px;background:rgba(255,255,255,.15);padding:3px 10px;border-radius:6px;display:inline-block;margin-top:6px;}
.fl-hero-meta{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;}
.fl-hero-meta span{font-size:11.5px;opacity:.85;display:flex;align-items:center;gap:5px;}
.fl-hero-right{text-align:right;position:relative;z-index:1;}
.fl-hero-emo{font-size:52px;line-height:1;}
.fl-hero-status{display:inline-block;padding:4px 12px;border-radius:100px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.fl-hero-status.activo{background:rgba(16,185,129,.25);color:#6EE7B7;}
.fl-hero-status.taller{background:rgba(245,158,11,.25);color:#FCD34D;}
.fl-hero-status.comision{background:rgba(99,102,241,.25);color:#A5B4FC;}
.fl-hero-status.baja{background:rgba(239,68,68,.25);color:#FCA5A5;}

/* ─ SPEC GRID (Vehicle Analysis style) ─ */
.fl-spec-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;}
.fl-spec{background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;position:relative;}
.fl-spec::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;border-radius:10px 10px 0 0;background:linear-gradient(90deg,#2563EB,#7C3AED);}
.fl-spec-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:6px;}
.fl-spec-val{font-size:18px;font-weight:800;color:#0F172A;letter-spacing:-.3px;font-family:'JetBrains Mono',monospace;}
.fl-spec-sub{font-size:10.5px;color:#64748B;margin-top:2px;}

/* ─ GAUGE COMBUSTIBLE ─ */
.fl-gauge-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:16px;text-align:center;}
.fl-gauge-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:8px;}

/* ─ TABS ─ */
.fl-tabs{display:flex;gap:0;background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:4px;margin-bottom:18px;width:fit-content;box-shadow:0 1px 2px rgba(0,0,0,.05);}
.fl-tab{padding:7px 14px;border-radius:7px;border:none;background:transparent;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;color:#64748B;transition:all .15s;display:flex;align-items:center;gap:5px;white-space:nowrap;}
.fl-tab:hover{color:#0F172A;}
.fl-tab.on{background:linear-gradient(135deg,#2563EB,#3B82F6);color:#fff;box-shadow:0 2px 8px rgba(37,99,235,.3);}

/* ─ INFO GRID ─ */
.fl-ig{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.fl-ig-row{display:grid;grid-template-columns:1fr 1fr;}
.fl-ig-cell{padding:13px 16px;border-bottom:1px solid #F1F5F9;}
.fl-ig-cell:nth-child(odd){border-right:1px solid #F1F5F9;}
.fl-ig-row:last-child .fl-ig-cell{border-bottom:none;}
.fl-ig-cell dt{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:3px;}
.fl-ig-cell dd{font-size:13px;font-weight:600;color:#0F172A;}
.fl-ig-cell dd.mono{font-family:'JetBrains Mono',monospace;font-size:11.5px;}

/* ─ POLIZA CARD ─ */
.fl-poliza{background:linear-gradient(135deg,#F8FAFF,#EFF6FF);border:1px solid #BFDBFE;border-radius:12px;padding:16px;}
.fl-poliza-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.fl-poliza-ico{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;}
.fl-poliza-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#1D4ED8;}
.fl-poliza-num{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:#0F172A;}
.fl-poliza-exp{font-size:11px;font-weight:600;margin-top:3px;}

/* ─ BADGES ─ */
.fl-b{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:100px;white-space:nowrap;}
.fl-b.green{background:#DCFCE7;color:#15803D;}
.fl-b.amber{background:#FEF3C7;color:#B45309;}
.fl-b.red{background:#FEE2E2;color:#B91C1C;}
.fl-b.blue{background:#DBEAFE;color:#1D4ED8;}
.fl-b.purple{background:#EDE9FE;color:#6D28D9;}
.fl-b.gray{background:#F1F5F9;color:#475569;}
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

/* ─ TABLA ─ */
.fl-tw{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);}
.fl-t{width:100%;border-collapse:collapse;font-size:12.5px;}
.fl-t th{background:#F8FAFC;padding:10px 14px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;border-bottom:1px solid #E2E8F0;}
.fl-t td{padding:12px 14px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.fl-t tr:last-child td{border-bottom:none;}
.fl-t tr:hover td{background:#F8FAFC;}
.fl-t tr{cursor:pointer;transition:background .1s;}

/* ─ ALERTAS ─ */
.fl-alerts{display:flex;flex-direction:column;gap:6px;margin-bottom:18px;}
.fl-alert{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:9px;font-size:12.5px;font-weight:500;border:1px solid;}
.fl-alert.warn{background:#FFFBEB;color:#92400E;border-color:#FDE68A;}
.fl-alert.err{background:#FEF2F2;color:#991B1B;border-color:#FECACA;}

/* ─ KPI HOME ─ */
.fl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px;}
.fl-kpi{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:18px 20px;box-shadow:0 1px 3px rgba(0,0,0,.05);position:relative;overflow:hidden;}
.fl-kpi::after{content:'';position:absolute;top:0;left:0;right:0;height:3px;}
.fl-kpi.k1::after{background:linear-gradient(90deg,#2563EB,#60A5FA);}
.fl-kpi.k2::after{background:linear-gradient(90deg,#10B981,#34D399);}
.fl-kpi.k3::after{background:linear-gradient(90deg,#F59E0B,#FCD34D);}
.fl-kpi.k4::after{background:linear-gradient(90deg,#8B5CF6,#A78BFA);}
.fl-kpi-l{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:8px;}
.fl-kpi-v{font-size:30px;font-weight:900;letter-spacing:-1px;line-height:1;font-family:'JetBrains Mono',monospace;}
.fl-kpi-s{font-size:11px;color:#94A3B8;margin-top:4px;}

/* ─ CHECKLIST ─ */
.fl-chk-zone{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:12px;}
.fl-chk-zone-head{background:linear-gradient(135deg,#1E3A5F,#2563EB);color:#fff;padding:10px 16px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;display:flex;align-items:center;gap:8px;}
.fl-chk-item{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 16px;border-bottom:1px solid #F1F5F9;transition:background .1s;}
.fl-chk-item:last-child{border-bottom:none;}
.fl-chk-item:hover{background:#F8FAFC;}
.fl-chk-label{font-size:12.5px;color:#0F172A;}
.fl-chk-foto{display:flex;align-items:center;gap:4px;font-size:11px;font-weight:600;color:#94A3B8;cursor:pointer;padding:4px 10px;border-radius:6px;border:1px dashed #CBD5E1;transition:all .15s;background:transparent;}
.fl-chk-foto:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-chk-foto.has-foto{border-style:solid;border-color:#10B981;color:#10B981;background:#F0FDF4;}
.fl-chk-btns{display:flex;gap:4px;}
.fl-chk-si,.fl-chk-no{width:28px;height:28px;border-radius:6px;border:1.5px solid #E2E8F0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;transition:all .15s;background:transparent;}
.fl-chk-si:hover{border-color:#10B981;color:#10B981;background:#F0FDF4;}
.fl-chk-no:hover{border-color:#EF4444;color:#EF4444;background:#FEF2F2;}
.fl-chk-si.on{background:#10B981;border-color:#10B981;color:#fff;}
.fl-chk-no.on{background:#EF4444;border-color:#EF4444;color:#fff;}
.fl-chk-legal{background:#FFFBEB;border:1px solid #FDE68A;border-radius:12px;overflow:hidden;margin-bottom:12px;}
.fl-chk-legal-head{background:linear-gradient(135deg,#92400E,#B45309);color:#fff;padding:10px 16px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;}

/* ─ MODAL ─ */
.fl-ov{position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);animation:fFi .15s ease;}
@keyframes fFi{from{opacity:0}to{opacity:1}}
.fl-modal{background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:92vh;overflow-y:auto;box-shadow:0 25px 80px rgba(0,0,0,.25);animation:fSu .2s cubic-bezier(.4,0,.2,1);font-family:'Inter',sans-serif;}
@keyframes fSu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.fl-mh{padding:20px 22px 0;display:flex;align-items:center;justify-content:space-between;gap:10px;}
.fl-mh h3{font-size:16px;font-weight:800;letter-spacing:-.3px;}
.fl-mx{width:28px;height:28px;border:none;background:#F1F5F9;border-radius:7px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:background .15s;}
.fl-mx:hover{background:#E2E8F0;}
.fl-mb{padding:16px 22px 22px;}
.fl-sep{height:1px;background:#F1F5F9;margin:12px 0;}

/* ─ FORM ─ */
.fl-form{display:flex;flex-direction:column;gap:12px;}
.fl-field{display:flex;flex-direction:column;gap:4px;}
.fl-field label{font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;}
.fl-field input,.fl-field select,.fl-field textarea{padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;color:#0F172A;background:#F8FAFC;outline:none;transition:all .15s;width:100%;}
.fl-field input:focus,.fl-field select:focus,.fl-field textarea:focus{border-color:#2563EB;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.fl-field input:disabled,.fl-field select:disabled{background:#F1F5F9;color:#64748B;cursor:not-allowed;}
.fl-field textarea{min-height:80px;resize:vertical;}
.fl-frow{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.fl-factions{display:flex;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid #F1F5F9;}
.fl-fnote{font-size:10.5px;color:#94A3B8;}
.fl-fasigned{background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:8px;padding:9px 12px;font-size:12.5px;font-weight:700;color:#1D4ED8;display:flex;align-items:center;gap:7px;}

/* ─ UPLOAD AREA ─ */
.fl-up{border:2px dashed #CBD5E1;border-radius:8px;padding:14px;text-align:center;cursor:pointer;color:#64748B;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s;}
.fl-up:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-pills{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}
.fl-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:100px;font-size:11px;font-weight:600;color:#374151;}

/* ─ SOL GRID ─ */
.fl-sg{display:grid;grid-template-columns:1fr 1fr;background:#F8FAFC;border-radius:10px;overflow:hidden;border:1px solid #E2E8F0;}
.fl-sc{padding:10px 13px;}
.fl-sc:nth-child(odd){border-right:1px solid #E2E8F0;}
.fl-sc dt{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:2px;}
.fl-sc dd{font-size:12.5px;font-weight:600;color:#0F172A;}
.fl-sc.full{grid-column:1/-1;}

/* ─ COMISION CARD ─ */
.fl-com-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:10px;}
.fl-com-head{background:linear-gradient(135deg,#1E3A5F,#2563EB);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}
.fl-com-title{font-size:13px;font-weight:700;}
.fl-com-sub{font-size:11px;opacity:.8;margin-top:2px;}
.fl-com-body{padding:14px 16px;}
.fl-com-meters{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;}
.fl-com-meter{text-align:center;padding:12px;background:#F8FAFC;border-radius:9px;border:1px solid #E2E8F0;}
.fl-com-meter .v{font-size:18px;font-weight:800;font-family:'JetBrains Mono',monospace;color:#0F172A;}
.fl-com-meter .l{font-size:9.5px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}

/* ─ BAJA CARD ─ */
.fl-baja-card{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;margin-bottom:10px;opacity:.85;}
.fl-baja-head{background:linear-gradient(135deg,#450A0A,#B91C1C);color:#fff;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;}

/* ─ TIMELINE ─ */
.fl-tl{background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden;}
.fl-tl-item{display:grid;grid-template-columns:36px 1fr;gap:10px;padding:12px 14px;border-bottom:1px solid #F1F5F9;align-items:flex-start;}
.fl-tl-item:last-child{border-bottom:none;}
.fl-tl-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;}
.fl-tl-t{font-size:13px;font-weight:700;}
.fl-tl-m{font-size:11px;color:#64748B;margin-top:1px;}
.fl-tl-d{font-size:12px;margin-top:4px;color:#374151;}

/* ─ PROGRESS STEPS ─ */
.fl-steps{display:flex;align-items:center;gap:0;margin-bottom:16px;}
.fl-step{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;}
.fl-step-n{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;}
.fl-step-n.done{background:#10B981;color:#fff;}
.fl-step-n.active{background:#2563EB;color:#fff;}
.fl-step-n.pending{background:#E2E8F0;color:#94A3B8;}
.fl-step-line{flex:1;height:1px;background:#E2E8F0;margin:0 6px;}
.fl-step-line.done{background:#10B981;}

/* ─ EMPTY / LOADING ─ */
.fl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:200px;gap:8px;color:#64748B;text-align:center;}
.fl-empty-i{font-size:38px;opacity:.2;margin-bottom:6px;}
.fl-empty h3{font-size:15px;font-weight:700;color:#0F172A;}
.fl-empty p{font-size:12.5px;max-width:260px;}
.fl-loading{display:flex;align-items:center;justify-content:center;min-height:180px;color:#64748B;gap:8px;font-size:13px;}
.fl-spin{width:18px;height:18px;border:2px solid #E2E8F0;border-top-color:#2563EB;border-radius:50%;animation:fR .7s linear infinite;}
@keyframes fR{to{transform:rotate(360deg)}}

/* ─ RESPONSIVE ─ */
@media(max-width:900px){
  #flotilla-dashboard{margin-left:0;}
  .fl-layout{grid-template-columns:1fr;}
  .fl-side{border-right:none;border-bottom:1px solid #E2E8F0;max-height:200px;}
  .fl-kpis,.fl-spec-grid{grid-template-columns:1fr 1fr;}
  .fl-ig-row{grid-template-columns:1fr;}
  .fl-ig-cell:nth-child(odd){border-right:none;}
  .fl-frow{grid-template-columns:1fr;}
  .fl-inner{padding:14px;}
  .fl-hero{grid-template-columns:1fr;}
  .fl-hero-right{display:none;}
}
  `;
  document.head.appendChild(s);
}

// ── HTML BASE ──
function html(){
  const el=document.getElementById('flotilla-dashboard'); if(!el) return;
  const sols_pend=flS.filter(s=>['Solicitud','Validada'].includes(s.estatus)).length;
  el.innerHTML=`
  <div class="fl-top">
    <div class="fl-top-brand">${I.truck} FLOTILLA <span>TECNOCONTROL</span></div>
    <span class="fl-top-role" id="fl-rol">—</span>
    <button class="fl-tb ghost" onclick="flSolicitudesAll()">${I.wrench} Solicitudes</button>
    <button class="fl-tb ghost" onclick="flComisionesVista()">${I.road} Comisiones</button>
    <button class="fl-tb blue" id="fl-btn-nueva" onclick="flAbrirModal()">${I.plus} Nueva solicitud</button>
  </div>
  <div class="fl-layout">
    <aside class="fl-side">
      <div class="fl-side-top">
        <div class="fl-side-search">
          <span class="fl-ss-ico">${I.search}</span>
          <input type="text" id="fl-buscar" placeholder="Unidad, placas, responsable…" oninput="flBuscar(this.value)">
        </div>
      </div>
      <div class="fl-side-kpis">
        <div class="fl-skpi" style="background:#EFF6FF">
          <div class="n" style="color:#2563EB" id="fl-n-act">—</div>
          <div class="l" style="color:#2563EB">Activos</div>
        </div>
        <div class="fl-skpi" style="background:#FFFBEB">
          <div class="n" style="color:#B45309" id="fl-n-tal">—</div>
          <div class="l" style="color:#B45309">En taller</div>
        </div>
      </div>
      <div class="fl-side-nav">
        <div class="fl-nav-item active" id="fl-nav-panel" onclick="flHome()">
          ${I.grid} Panel general
        </div>
        <div class="fl-nav-item" id="fl-nav-sols" onclick="flSolicitudesAll()">
          ${I.wrench} Solicitudes ${sols_pend?`<span class="cnt">${sols_pend}</span>`:''}
        </div>
        <div class="fl-nav-item" id="fl-nav-comis" onclick="flComisionesVista()">
          ${I.road} Comisiones
        </div>
        <div class="fl-nav-item" id="fl-nav-bajas" onclick="flBajasVista()">
          ${I.archive} Vehículos de baja
        </div>
      </div>
      <div class="fl-side-list">
        <div class="fl-side-lbl">Flota activa</div>
        <div id="fl-lista"><div class="fl-loading" style="min-height:60px;font-size:11px"><div class="fl-spin"></div> Cargando…</div></div>
      </div>
    </aside>
    <main class="fl-main" id="fl-main">
      <div class="fl-inner"><div class="fl-loading"><div class="fl-spin"></div> Inicializando flotilla…</div></div>
    </main>
  </div>`;
}

// ── HELPERS ──
const hBg  = s=>s==='taller'?'#FFFBEB':s==='baja'?'#FEF2F2':s==='comision'?'#F5F3FF':'#F0FDF4';
const hClr = s=>s==='taller'?'#B45309':s==='baja'?'#B91C1C':s==='comision'?'#6D28D9':'#15803D';
const hEmo = t=>t==='camion'?'🚛':t==='camioneta'?'🚙':'🚗';
const hIco = t=>t==='camion'?I.truck:I.car;
const hDias= f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/86400e3);
const hDiasLbl=d=>d===null?'—':d<0?`Vencido hace ${Math.abs(d)} días`:d===0?'Vence HOY':d<90?`Vence en ${d} días`:'Vigente';
const hDiasClr=d=>(!d||d>=90)?'green':d<0?'red':'amber';
const hFecha=iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';
function hBadge(e){const c=(e||'').replace(/[^a-zA-Z0-9]/g,''); return `<span class="fl-b ${c}">${e||'—'}</span>`;}
const hRol=()=>window.flGetRolActual?window.flGetRolActual():'Usuario';
const hPuede=a=>window.flTienePermiso?window.flTienePermiso(a):(a==='crear_solicitud');
const hEsAdmin=()=>['Administrador','Contraloría','Flotilla'].includes(hRol());

// ── GAUGE SVG ──
function gauge(rend){
  const r=rend&&rend!=='—'?parseFloat(rend):null;
  const pct=r?Math.min(r/20,1):0;
  const ang=-120+pct*240, rad=(ang-90)*Math.PI/180;
  const cx=55,cy=55,radius=40;
  const nx=cx+radius*Math.cos(rad), ny=cy+radius*Math.sin(rad);
  const col=pct<.35?'#EF4444':pct<.6?'#F59E0B':'#10B981';
  return `<div class="fl-gauge-card">
    <div class="fl-gauge-lbl">${I.fuel} Rendimiento combustible</div>
    <svg width="110" height="76" viewBox="0 0 110 76">
      <path d="M10,68 A45,45 0 0,1 100,68" fill="none" stroke="#F1F5F9" stroke-width="7" stroke-linecap="round"/>
      ${r?`<path d="M10,68 A45,45 0 0,1 ${nx.toFixed(1)},${ny.toFixed(1)}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="5" fill="${col}" stroke="#fff" stroke-width="2"/>`:``}
      <text x="55" y="64" text-anchor="middle" font-size="15" font-weight="800" fill="#0F172A" font-family="JetBrains Mono,monospace">${r?r.toFixed(1):'—'}</text>
      <text x="8" y="74" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="Inter,sans-serif">0</text>
      <text x="102" y="74" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="Inter,sans-serif">20</text>
    </svg>
    <div style="font-size:11px;font-weight:700;color:${col||'#94A3B8'}">${r?rend:'Sin dato'}</div>
  </div>`;
}

// ── INIT ──
window.cargarFlotilla = async function(){
  css(); html();
  document.getElementById('fl-rol').textContent = hRol();
  document.getElementById('fl-btn-nueva').style.display = hPuede('crear_solicitud')?'':'none';
  await Promise.all([initVehiculos(), initSolicitudes()]);
  flHome();
};

async function initVehiculos(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.VEHS));
    flV = snap.size>0 ? snap.docs.map(d=>({id:d.id,...d.data()})) : CAT.map(v=>({id:`eco-${v.eco}`,status:'activo',km:0,...v}));
  }catch(e){ flV=CAT.map(v=>({id:`eco-${v.eco}`,status:'activo',km:0,...v})); }
  renderSidebar();
}

async function initSolicitudes(){
  try{
    const snap=await fs.getDocs(fs.collection(db,C.SOLS));
    flS=snap.docs.map(d=>({id:d.id,...d.data()}));
    flS.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
  }catch(e){flS=[];}
}

// ── SIDEBAR ──
function renderSidebar(){
  const activos=flV.filter(v=>!v.status||v.status==='activo').length;
  const taller =flV.filter(v=>v.status==='taller').length;
  document.getElementById('fl-n-act').textContent=activos;
  document.getElementById('fl-n-tal').textContent=taller;
  const lista=document.getElementById('fl-lista'); if(!lista) return;
  const filtrados=flV.filter(v=>v.status!=='baja').filter(v=>{
    if(!busq) return true;
    const q=busq.toLowerCase();
    return (v.eco||'').toLowerCase().includes(q)||(v.placas||'').toLowerCase().includes(q)
        ||(v.unidad||'').toLowerCase().includes(q)||(v.responsable||'').toLowerCase().includes(q);
  });
  if(!filtrados.length){lista.innerHTML=`<div style="text-align:center;padding:16px;color:#94A3B8;font-size:11.5px">${flV.length?'Sin resultados':'Sin vehículos'}</div>`;return;}
  lista.innerHTML=filtrados.map(v=>`
    <div class="fl-vi ${vAct===v.id?'on':''}" onclick="flSelVeh('${v.id}')">
      <div class="fl-vi-ico" style="background:${hBg(v.status)};color:${hClr(v.status)}">${hIco(v.tipo)}</div>
      <div style="flex:1;min-width:0">
        <div class="fl-vi-eco">${v.eco} <span style="font-family:Inter;font-size:9.5px;color:#94A3B8;font-weight:500">· ${v.placas||''}</span></div>
        <div class="fl-vi-sub">${(v.unidad||'').substring(0,24)}</div>
      </div>
      <div class="fl-dot ${v.status==='taller'?'y':v.status==='baja'?'r':v.status==='comision'?'r':'g'}"></div>
    </div>`).join('');
}

window.flBuscar=v=>{busq=v;renderSidebar();};

function navActive(id){
  document.querySelectorAll('#flotilla-dashboard .fl-nav-item').forEach(e=>e.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('#flotilla-dashboard .fl-vi').forEach(e=>e.classList.remove('on'));
  vAct=null;
}

// ── HOME ──
window.flHome=function(){
  navActive('fl-nav-panel'); vistaAct='home';
  const alertas=[];
  flV.forEach(v=>{const d=hDias(v.poliza_venc);if(d!==null&&d<90)alertas.push({nivel:d<0?'err':'warn',txt:`Unidad ${v.eco} — Póliza ${d<0?'VENCIDA':'vence el '+v.poliza_venc}`});});
  const activos=flV.filter(v=>!v.status||v.status==='activo').length;
  const taller=flV.filter(v=>v.status==='taller').length;
  const comision=flV.filter(v=>v.status==='comision').length;
  const pend=flS.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus)).length;
  document.getElementById('fl-main').innerHTML=`<div class="fl-inner">
    <div class="fl-ph"><div class="fl-ph-title">Panel General · Flotilla Vehicular</div><div class="fl-ph-sub">${flV.filter(v=>v.status!=='baja').length} unidades activas · ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div></div>
    ${alertas.length?`<div class="fl-alerts">${alertas.slice(0,4).map(a=>`<div class="fl-alert ${a.nivel}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}
    <div class="fl-kpis">
      <div class="fl-kpi k1"><div class="fl-kpi-l">Total flotilla</div><div class="fl-kpi-v">${flV.length}</div><div class="fl-kpi-s">unidades registradas</div></div>
      <div class="fl-kpi k2"><div class="fl-kpi-l">En operación</div><div class="fl-kpi-v">${activos}</div><div class="fl-kpi-s">activas hoy</div></div>
      <div class="fl-kpi k3"><div class="fl-kpi-l">En taller</div><div class="fl-kpi-v">${taller}</div><div class="fl-kpi-s">fuera de servicio</div></div>
      <div class="fl-kpi k4"><div class="fl-kpi-l">Solicitudes activas</div><div class="fl-kpi-v">${pend}</div><div class="fl-kpi-s">${hPuede('aprobar')?'pendientes de aprobación':'en proceso'}</div></div>
    </div>
    <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:10px">Solicitudes recientes</div>
    ${renderTabla(flS.slice(0,15),hPuede('aprobar'))}
  </div>`;
};

// ── SELECCIONAR VEHÍCULO ──
window.flSelVeh=function(id){
  vAct=id; tabAct='info'; vistaAct='detalle';
  navActive(null);
  document.querySelector(`#fl-lista .fl-vi[onclick="flSelVeh('${id}')"]`)?.classList.add('on');
  renderDetalle();
};

// ── RENDER DETALLE ──
function renderDetalle(){
  const v=flV.find(x=>x.id===vAct); if(!v) return;
  const alertas=[];
  const d=hDias(v.poliza_venc);
  if(d!==null&&d<90) alertas.push({nivel:d<0?'err':'warn',txt:`Póliza de seguro ${d<0?'VENCIDA':'por vencer el '+v.poliza_venc}`});
  const pA=hPuede('aprobar'), eA=hEsAdmin();
  const km=(v.km||0).toLocaleString();

  document.getElementById('fl-main').innerHTML=`<div class="fl-inner">
    <!-- HERO CARD -->
    <div class="fl-hero">
      <div>
        <div class="fl-hero-eco">UNIDAD ${v.eco} · ${v.plaza||'—'}</div>
        <div class="fl-hero-name">${v.unidad||'—'}</div>
        <div class="fl-hero-placas">${v.placas||'—'}</div>
        <div class="fl-hero-meta">
          <span>🎨 ${v.color||'—'}</span>
          <span>📅 ${v.año||v.anio||'—'}</span>
          <span>👤 ${v.responsable||'Sin asignar'}</span>
          ${v.nip?`<span>⛽ NIP: ${v.nip}</span>`:''}
        </div>
      </div>
      <div class="fl-hero-right">
        <div class="fl-hero-emo">${hEmo(v.tipo)}</div>
        <div style="margin-top:6px"><span class="fl-hero-status ${v.status||'activo'}">${(v.status||'Activo').toUpperCase()}</span></div>
        <button style="margin-top:10px;position:relative;z-index:2" class="fl-tb ghost" onclick="flHome()">← Volver</button>
      </div>
    </div>

    ${alertas.length?`<div class="fl-alerts">${alertas.map(a=>`<div class="fl-alert ${a.nivel}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}

    <!-- SPECS -->
    <div class="fl-spec-grid">
      <div class="fl-spec"><div class="fl-spec-lbl">Kilometraje</div><div class="fl-spec-val">${km}</div><div class="fl-spec-sub">km recorridos</div></div>
      <div class="fl-spec"><div class="fl-spec-lbl">Año modelo</div><div class="fl-spec-val">${v.año||v.anio||'—'}</div><div class="fl-spec-sub">${new Date().getFullYear()-(v.año||v.anio||new Date().getFullYear())} años de uso</div></div>
      <div class="fl-spec"><div class="fl-spec-lbl">Rendimiento</div><div class="fl-spec-val" style="font-size:14px">${v.rendimiento||'—'}</div><div class="fl-spec-sub">combustible</div></div>
      <div class="fl-spec"><div class="fl-spec-lbl">Póliza vence</div><div class="fl-spec-val" style="font-size:13px;color:${d!==null&&d<90?'#EF4444':'#10B981'}">${hFecha(v.poliza_venc)}</div><div class="fl-spec-sub">${hDiasLbl(d)}</div></div>
    </div>

    <!-- TABS -->
    <div class="fl-tabs">
      <button class="fl-tab ${tabAct==='info'       ?'on':''}" onclick="flTab('info')" >Información</button>
      <button class="fl-tab ${tabAct==='docs'       ?'on':''}" onclick="flTab('docs')" >Documentos</button>
      <button class="fl-tab ${tabAct==='historial'  ?'on':''}" onclick="flTab('historial')">Historial</button>
      <button class="fl-tab ${tabAct==='checklist'  ?'on':''}" onclick="flTab('checklist')">Inspección</button>
      <button class="fl-tab ${tabAct==='solicitudes'?'on':''}" onclick="flTab('solicitudes')">Solicitudes</button>
    </div>
    <div id="fl-tc">
      ${tabAct==='info'        ? tInfo(v,eA)          : ''}
      ${tabAct==='docs'        ? tDocs(v,eA)          : ''}
      ${tabAct==='historial'   ? tHistorial(v)        : ''}
      ${tabAct==='checklist'   ? tChecklist(v)        : ''}
      ${tabAct==='solicitudes' ? tSolsVeh(v,pA)       : ''}
    </div>
  </div>`;

  if(tabAct==='checklist') attachChk();
}

window.flTab=t=>{tabAct=t;renderDetalle();};

// ── TAB INFO ──
function tInfo(v,eA){
  return `<div style="display:grid;grid-template-columns:1fr 200px;gap:14px;align-items:start">
    <div class="fl-ig">
      <div class="fl-ig-row"><dl class="fl-ig-cell"><dt>Número económico</dt><dd>${v.eco||'—'}</dd></dl><dl class="fl-ig-cell"><dt>Placas</dt><dd class="mono">${v.placas||'—'}</dd></dl></div>
      <div class="fl-ig-row"><dl class="fl-ig-cell"><dt>Unidad / Descripción</dt><dd>${v.unidad||'—'}</dd></dl><dl class="fl-ig-cell"><dt>Año</dt><dd>${v.año||v.anio||'—'}</dd></dl></div>
      <div class="fl-ig-row"><dl class="fl-ig-cell"><dt>Número de serie</dt><dd class="mono" style="font-size:10.5px">${v.serie||'—'}</dd></dl><dl class="fl-ig-cell"><dt>Color</dt><dd>${v.color||'—'}</dd></dl></div>
      <div class="fl-ig-row"><dl class="fl-ig-cell"><dt>Plaza / Región</dt><dd>${v.plaza||'—'}</dd></dl><dl class="fl-ig-cell"><dt>Tipo de unidad</dt><dd style="text-transform:capitalize">${v.tipo||'—'}</dd></dl></div>
      <div class="fl-ig-row"><dl class="fl-ig-cell"><dt>Responsable asignado</dt><dd>${v.responsable||'—'}</dd></dl><dl class="fl-ig-cell"><dt>Kilometraje actual</dt><dd>${v.km?v.km.toLocaleString()+' km':'—'}</dd></dl></div>
      <div class="fl-ig-row"><dl class="fl-ig-cell"><dt>NIP Oxxo Gas</dt><dd class="mono">${v.nip||'—'}</dd></dl><dl class="fl-ig-cell"><dt>Estatus</dt><dd>${hBadge(v.status||'activo')}</dd></dl></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${gauge(v.rendimiento)}
      <div class="fl-poliza">
        <div class="fl-poliza-head">
          <div class="fl-poliza-ico" style="background:${hDias(v.poliza_venc)===null||hDias(v.poliza_venc)>=90?'#DCFCE7':hDias(v.poliza_venc)<0?'#FEE2E2':'#FEF3C7'}">🛡️</div>
          <div><div class="fl-poliza-title">Póliza de seguro</div></div>
        </div>
        <div class="fl-poliza-num">${v.poliza||'—'}</div>
        <div class="fl-poliza-exp" style="color:${hDias(v.poliza_venc)===null?'#94A3B8':hDias(v.poliza_venc)<0?'#B91C1C':hDias(v.poliza_venc)<90?'#B45309':'#15803D'}">
          ${hFecha(v.poliza_venc)} · ${hDiasLbl(hDias(v.poliza_venc))}
        </div>
      </div>
      ${eA?`
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px">Responsiva firmada</div>
        <button class="fl-tb ghost" style="width:100%;justify-content:center;font-size:11px">${I.upload} Subir documento</button>
        ${v.responsiva_url?`<div style="margin-top:6px"><a href="${v.responsiva_url}" target="_blank" style="color:#2563EB;font-size:11px;font-weight:600">${I.doc} Ver responsiva actual</a></div>`:''}
      </div>`:''}
    </div>
  </div>`;
}

// ── TAB DOCS ──
function tDocs(v,eA){
  const docs=[
    {n:'Póliza de seguro',d:v.poliza_venc,ico:'🛡️'},
    {n:'Verificación ambiental',d:v.verificacion_venc,ico:'✅'},
    {n:'Tarjeta de circulación',d:v.circulacion_venc,ico:'🪪'},
    {n:'Tenencia',d:v.tenencia_venc,ico:'🏛️'},
    {n:'Factura / Título',d:null,ico:'📑'},
    {n:'Responsiva firmada',d:null,ico:'✍️'},
    {n:'Holograma de verificación',d:null,ico:'🔰'},
    {n:'Tag de caseta (telepeaje)',d:null,ico:'🛣️'},
  ];
  return `<div class="fl-tw"><table class="fl-t"><thead><tr><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Archivo</th></tr></thead><tbody>${
    docs.map(d=>{const dias=hDias(d.d);const cls=dias===null?'gray':dias<0?'red':dias<90?'amber':'green';const txt=dias===null?'Sin fecha':dias<0?'Vencido':dias<90?'Por vencer':'Vigente';
    return`<tr><td><span style="display:flex;align-items:center;gap:7px">${d.ico} <strong>${d.n}</strong></span></td><td><span class="mono" style="font-size:11.5px">${hFecha(d.d)}</span></td><td><span class="fl-b ${cls}">${txt}</span></td><td><div style="display:flex;gap:5px"><button class="fl-pill">${I.doc} Ver</button><button class="fl-pill">${I.upload} Subir</button></div></td></tr>`;
    }).join('')
  }</tbody></table></div>`;
}

// ── TAB HISTORIAL ──
function tHistorial(v){
  const hist=v.historial||[];
  if(!hist.length) return `<div class="fl-empty"><div class="fl-empty-i">📋</div><h3>Sin historial</h3><p>No hay registros de mantenimiento o servicios para esta unidad.</p></div>`;
  const im={mantenimiento:'🔧',taller:'🏭',incidencia:'⚠️',servicio:'🔩',inspeccion:'📋',comision:'🚗'};
  const ib={mantenimiento:'#FEF3C7',taller:'#FEE2E2',incidencia:'#FEF3C7',servicio:'#EFF6FF',inspeccion:'#F5F3FF',comision:'#ECFDF5'};
  return `<div class="fl-tl">${hist.map(h=>`<div class="fl-tl-item"><div class="fl-tl-ico" style="background:${ib[h.tipo]||'#F1F5F9'}">${im[h.tipo]||'📋'}</div><div><div class="fl-tl-t">${h.titulo||'—'}</div><div class="fl-tl-m">${h.fecha||''}${h.costo?' · '+h.costo:''}</div>${h.descripcion?`<div class="fl-tl-d">${h.descripcion}</div>`:''}</div></div>`).join('')}</div>`;
}

// ── TAB CHECKLIST INSPECCIÓN ──
function tChecklist(v){
  const zonas=[
    {key:'cristales', label:'Cristales',   ico:'🪟', items:CHK.cristales, obligatorio:true},
    {key:'espejos',   label:'Espejos',     ico:'🔵', items:CHK.espejos,   obligatorio:true},
    {key:'neumaticos',label:'Neumáticos',  ico:'⚙️', items:CHK.neumaticos,obligatorio:true},
    {key:'interiores',label:'Interiores',  ico:'🚗', items:CHK.interiores,obligatorio:false},
    {key:'motor',     label:'Motor',       ico:'🔧', items:CHK.motor,     obligatorio:false},
    {key:'cajuela',   label:'Cajuela',     ico:'🧰', items:CHK.cajuela,   obligatorio:false},
  ];
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:14px;font-weight:800;color:#0F172A">Inspección Visual · Unidad ${v.eco}</div>
        <div style="font-size:11.5px;color:#64748B;margin-top:2px">Cada punto con foto es obligatorio. Realizado por: <strong>${window.auth?.currentUser?.displayName||'—'}</strong></div>
      </div>
      <button class="fl-tb blue" onclick="flGuardarInspeccion('${v.id}')">${I.check} Guardar inspección</button>
    </div>

    ${zonas.map(z=>`
      <div class="fl-chk-zone">
        <div class="fl-chk-zone-head">${z.ico} ${z.label} ${z.obligatorio?'<span style="background:rgba(255,255,255,.2);padding:1px 7px;border-radius:100px;font-size:9px;margin-left:6px">FOTO OBLIGATORIA</span>':''}</div>
        ${z.items.map((item,i)=>`
          <div class="fl-chk-item">
            <span class="fl-chk-label">${item}</span>
            <label class="fl-chk-foto" id="fl-foto-${z.key}-${i}" onclick="document.getElementById('fl-fi-${z.key}-${i}').click()">
              ${I.camera} <span id="fl-foto-lbl-${z.key}-${i}">Foto</span>
            </label>
            <input type="file" id="fl-fi-${z.key}-${i}" accept="image/*" style="display:none"
              onchange="flFotoChk(this,'${z.key}',${i})">
            <div class="fl-chk-btns">
              <div class="fl-chk-si" data-sec="${z.key}" data-i="${i}" onclick="flChkTog(this,'si')">✓</div>
              <div class="fl-chk-no" data-sec="${z.key}" data-i="${i}" onclick="flChkTog(this,'no')">✗</div>
            </div>
          </div>`).join('')}
      </div>`).join('')}

    <!-- VALIDACIÓN LEGAL (solo encargado de flotilla) -->
    <div class="fl-chk-legal">
      <div class="fl-chk-legal-head">⚖️ Validación Legal — Solo Encargado de Flotilla</div>
      ${CHK.legal.map((item,i)=>`
        <div class="fl-chk-item" style="background:transparent">
          <span class="fl-chk-label">${item}</span>
          <div class="fl-chk-btns">
            <div class="fl-chk-si" data-sec="legal" data-i="${i}" onclick="flChkTog(this,'si')">✓</div>
            <div class="fl-chk-no" data-sec="legal" data-i="${i}" onclick="flChkTog(this,'no')">✗</div>
          </div>
        </div>`).join('')}
    </div>

    <div style="margin-top:14px">
      <div class="fl-field"><label>Comentarios adicionales</label><textarea id="fl-chk-obs" placeholder="Observaciones, daños encontrados, notas de la revisión…" style="margin-top:4px;padding:10px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;width:100%;min-height:80px;background:#F8FAFC;outline:none;resize:vertical"></textarea></div>
    </div>`;
}

let chkFotos={};
function attachChk(){ chkFotos={}; }

window.flFotoChk=function(input,sec,i){
  const f=input.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=e=>{
    if(!chkFotos[sec]) chkFotos[sec]={};
    chkFotos[sec][i]=e.target.result;
    const lbl=document.getElementById(`fl-foto-lbl-${sec}-${i}`);
    const btn=document.getElementById(`fl-foto-${sec}-${i}`);
    if(lbl) lbl.textContent='✓ '+f.name.substring(0,10);
    if(btn) btn.classList.add('has-foto');
  };
  reader.readAsDataURL(f);
};

window.flChkTog=function(el,val){
  const {sec,i}=el.dataset;
  document.querySelector(`.fl-chk-si[data-sec="${sec}"][data-i="${i}"]`)?.classList.remove('on');
  document.querySelector(`.fl-chk-no[data-sec="${sec}"][data-i="${i}"]`)?.classList.remove('on');
  el.classList.add('on');
};

window.flGuardarInspeccion=async function(id){
  const resultado={};
  Object.keys(CHK).forEach(sec=>{
    resultado[sec]={};
    CHK[sec].forEach((item,i)=>{
      const si=document.querySelector(`.fl-chk-si[data-sec="${sec}"][data-i="${i}"]`);
      const no=document.querySelector(`.fl-chk-no[data-sec="${sec}"][data-i="${i}"]`);
      resultado[sec][item]={
        estado:si?.classList.contains('on')?'si':no?.classList.contains('on')?'no':'—',
        foto:chkFotos[sec]?.[i]||null
      };
    });
  });
  resultado.comentarios=document.getElementById('fl-chk-obs')?.value||'';
  resultado.fecha=new Date().toISOString();
  resultado.vehiculoId=id;
  resultado.vehiculoEco=flV.find(v=>v.id===id)?.eco||'';
  resultado.realizadoPor=window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Usuario';
  resultado.realizadoPorEmail=window.auth?.currentUser?.email||'';
  try{
    await fs.addDoc(fs.collection(db,C.INSP),resultado);
    if(window.mostrarPush) window.mostrarPush('Inspección guardada','','✓');
    else alert('Inspección guardada correctamente.');
    chkFotos={};
  }catch(e){console.error(e);alert('Error al guardar inspección.');}
};

// ── TAB SOLICITUDES VEHÍCULO ──
function tSolsVeh(v,pA){
  const sols=flS.filter(s=>s.vehiculoId===v.id||s.vehiculoEco===v.eco||(s.vehiculo||'').includes(v.eco));
  if(!sols.length) return`<div class="fl-empty"><div class="fl-empty-i">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes para esta unidad.</p></div>`;
  return renderTabla(sols,pA);
}

// ── SOLICITUDES GLOBAL ──
window.flSolicitudesAll=function(){
  navActive('fl-nav-sols'); vistaAct='solicitudes';
  const pA=hPuede('aprobar');
  document.getElementById('fl-main').innerHTML=`<div class="fl-inner">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div><div class="fl-ph-title">Todas las solicitudes</div><div class="fl-ph-sub">${flS.length} registros totales</div></div>
      <button class="fl-tb ghost" onclick="flHome()">← Panel general</button>
    </div>
    ${renderTabla(flS,pA)}
  </div>`;
};

// ── TABLA SOLICITUDES ──
function renderTabla(sols,pA){
  if(!sols.length) return`<div class="fl-empty"><div class="fl-empty-i">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes registradas.</p></div>`;
  return`<div class="fl-tw"><table class="fl-t"><thead><tr><th>Tipo</th><th>Unidad</th><th>Solicitante</th><th>Cotización</th><th>Estado</th><th>Fecha</th>${pA?'<th>Acción</th>':''}</tr></thead><tbody>${
    sols.map(s=>`<tr onclick="flVerSol('${s.id}')">
      <td><strong>${s.tipo||'—'}</strong></td>
      <td><span class="mono" style="font-size:11.5px">${s.vehiculoEco||s.vehiculo||'—'}</span></td>
      <td style="font-size:12px">${s.solicitante||s.creadoPor||'—'}</td>
      <td style="font-weight:700">${s.cotizacion||'—'}</td>
      <td>${hBadge(s.estatus)}</td>
      <td style="font-size:11px;color:#64748B">${hFecha(s.creadoEn||s.fecha||'')}</td>
      ${pA?`<td onclick="event.stopPropagation()">${(s.estatus==='Validada'||s.estatus==='Cotización')?`<div style="display:flex;gap:4px"><button class="fl-tb dark" style="font-size:10px;padding:5px 8px" onclick="flAprobar('${s.id}')">${I.check}</button><button class="fl-tb ghost" style="font-size:10px;padding:5px 8px;border-color:#FCA5A5;color:#B91C1C" onclick="flRechazar('${s.id}')">${I.x}</button></div>`:'—'}</td>`:''}</tr>`
    ).join('')
  }</tbody></table></div>`;
}

// ── VER SOLICITUD ──
window.flVerSol=function(id){
  const s=flS.find(x=>x.id===id); if(!s) return;
  const pA=hPuede('aprobar'),pV=hPuede('validar'),pC=hPuede('subir_cotizacion'),pE=hPuede('eliminar');
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>Solicitud #${id.substring(0,6).toUpperCase()}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
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
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:10px 13px;font-size:12px;color:#991B1B;margin-top:10px"><strong>Motivo rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
      ${s.evidencias?.length?`<div class="fl-sep"></div><div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px">Evidencias (${s.evidencias.length})</div><div class="fl-pills">${s.evidencias.map((e,i)=>`<button class="fl-pill" onclick="flVerImg('${e}')">${I.camera} Foto ${i+1}</button>`).join('')}</div>`:''}
      <div class="fl-sep"></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        ${pV&&s.estatus==='Solicitud'?`<button class="fl-tb dark" onclick="flEstatus('${s.id}','Validada');this.closest('.fl-ov').remove()">${I.check} Validar solicitud</button>`:''}
        ${(pC||pV)&&s.estatus==='Validada'?`<button class="fl-tb ghost" onclick="flCotizar('${s.id}')">Registrar cotización</button>`:''}
        ${pA&&(s.estatus==='Validada'||s.estatus==='Cotización')?`<button class="fl-tb blue" onclick="flAprobar('${s.id}');this.closest('.fl-ov').remove()">${I.check} Aprobar</button><button class="fl-tb ghost" style="border-color:#FCA5A5;color:#B91C1C" onclick="flRechazar('${s.id}');this.closest('.fl-ov').remove()">${I.x} Rechazar</button>`:''}
        ${pV&&s.estatus==='Aprobada'?`<button class="fl-tb ghost" onclick="flEstatus('${s.id}','Cierre');this.closest('.fl-ov').remove()">Enviar a cierre</button>`:''}
        ${pV&&s.estatus==='Cierre'?`<button class="fl-tb ghost" onclick="flEstatus('${s.id}','Cerrada');this.closest('.fl-ov').remove()">Marcar cerrada</button>`:''}
        ${pE?`<button class="fl-tb ghost" style="border-color:#FCA5A5;color:#B91C1C;margin-left:auto" onclick="flEliminar('${s.id}');this.closest('.fl-ov').remove()">Eliminar</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ── MODAL NUEVA SOLICITUD ──
window.flAbrirModal=function(editId=null){
  const s=editId?flS.find(x=>x.id===editId):null;
  fotosB64=[];
  const emailAct=window.auth?.currentUser?.email||'';
  const nombreAct=window.auth?.currentUser?.displayName||'';
  const vAsig=flV.find(v=>{
    const resp=(v.responsable||'').toLowerCase();
    return resp&&resp!=='—'&&(
      (emailAct&&resp.includes(emailAct.split('@')[0].toLowerCase()))||
      (nombreAct&&resp.includes(nombreAct.split(' ')[0].toLowerCase()))
    );
  });
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>${s?'Editar solicitud':'Nueva solicitud de servicio'}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div class="fl-form" id="fl-form-s">
        <div class="fl-field"><label>Tipo de solicitud *</label>
          <select name="tipo" required><option value="">Seleccionar…</option>${
            ['Mantenimiento preventivo','Mantenimiento correctivo','Reposición de llanta','Falla eléctrica','Revisión de frenos','Seguro — Reporte de accidente','Revisión de documentos','Otro'].map(o=>`<option ${s?.tipo===o?'selected':''}>${o}</option>`).join('')
          }</select>
        </div>
        <div class="fl-field"><label>Unidad *</label>
          ${vAsig&&!s?`<div class="fl-fasigned">🚗 Unidad ${vAsig.eco} · ${vAsig.placas} — ${vAsig.unidad}<input type="hidden" name="vehiculoId" value="${vAsig.id}"><input type="hidden" name="vehiculoEco" value="${vAsig.eco}"><input type="hidden" name="vehiculoLabel" value="Unidad ${vAsig.eco} · ${vAsig.placas}"></div>`:
          `<select name="vehiculoId" required><option value="">Seleccionar vehículo…</option>${
            flV.filter(v=>v.status!=='baja').map(v=>`<option value="${v.id}" data-eco="${v.eco}" data-label="Unidad ${v.eco} · ${v.placas}" ${s?.vehiculoId===v.id?'selected':''}>${v.eco} · ${v.placas} — ${v.unidad}</option>`).join('')
          }</select>`}
        </div>
        <div class="fl-frow">
          <div class="fl-field"><label>Taller / Proveedor</label><input name="taller" value="${s?.taller||''}" placeholder="Nombre del taller…"></div>
          <div class="fl-field"><label>Cotización estimada</label><input name="cotizacion" value="${s?.cotizacion||''}" placeholder="$0.00"></div>
        </div>
        <div class="fl-field"><label>Descripción *</label><textarea name="descripcion" placeholder="Describe la falla o necesidad con detalle…" required>${s?.descripcion||''}</textarea></div>
        ${!s?`<div class="fl-field"><label>Evidencias fotográficas</label>
          <div class="fl-up" onclick="document.getElementById('fl-fi-main').click()">${I.camera} Seleccionar fotos</div>
          <input type="file" id="fl-fi-main" accept="image/*" multiple style="display:none" onchange="flPrevFotos(this)">
          <div id="fl-fp" class="fl-pills"></div>
          <div class="fl-fnote">Máx. ~1MB por imagen. Se guardan en Firestore.</div>
        </div>`:''}
        <div class="fl-factions">
          <button type="button" class="fl-tb ghost" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
          <button type="button" class="fl-tb blue" id="fl-btn-save" onclick="flGuardar('${editId||''}')">${s?'Guardar cambios':'Enviar solicitud'}</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flPrevFotos=function(input){
  fotosB64=[];
  const p=document.getElementById('fl-fp'); if(!p) return;
  p.innerHTML='';
  Array.from(input.files).forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{fotosB64.push(e.target.result);const pi=document.createElement('span');pi.className='fl-pill';pi.innerHTML=`${I.camera} ${f.name.substring(0,16)}`;p.appendChild(pi);};
    r.readAsDataURL(f);
  });
};

window.flGuardar=async function(editId){
  const form=document.getElementById('fl-form-s'); if(!form) return;
  const get=n=>form.querySelector(`[name="${n}"]`)?.value?.trim()||'';
  const tipo=get('tipo'),vid=get('vehiculoId'),desc=get('descripcion');
  if(!tipo||!vid||!desc){alert('Completa tipo, vehículo y descripción.');return;}
  const veh=flV.find(v=>v.id===vid);
  const eco=get('vehiculoEco')||form.querySelector(`[name="vehiculoId"] option:checked`)?.dataset?.eco||veh?.eco||'';
  const label=get('vehiculoLabel')||`Unidad ${eco} · ${veh?.placas||''}`;
  const btn=document.getElementById('fl-btn-save');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const data={tipo,vehiculoId:vid,vehiculoEco:eco,vehiculo:label,taller:get('taller'),cotizacion:get('cotizacion'),descripcion:desc,
    solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Usuario',
    creadoPor:window.auth?.currentUser?.email||'',actualizadoEn:new Date().toISOString()};
  try{
    if(editId){await fs.updateDoc(fs.doc(db,C.SOLS,editId),data);}
    else{data.estatus='Solicitud';data.creadoEn=new Date().toISOString();
      const ref=await fs.addDoc(fs.collection(db,C.SOLS),data);
      if(fotosB64.length) await fs.updateDoc(fs.doc(db,C.SOLS,ref.id),{evidencias:fotosB64});}
    document.querySelector('.fl-ov')?.remove();
    await initSolicitudes();
    flRefresh();
    if(window.mostrarPush) window.mostrarPush('Solicitud enviada','','✓');
  }catch(e){console.error(e);alert('Error al guardar.');if(btn){btn.disabled=false;btn.textContent='Enviar solicitud';}}
};

// ── COMISIONES ──
window.flComisionesVista=async function(){
  navActive('fl-nav-comis'); vistaAct='comisiones';
  let comis=[];
  try{const snap=await fs.getDocs(fs.collection(db,C.COMIS));comis=snap.docs.map(d=>({id:d.id,...d.data()}));}catch(e){}
  const eA=hEsAdmin();
  document.getElementById('fl-main').innerHTML=`<div class="fl-inner">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div><div class="fl-ph-title">Comisiones Eventuales</div><div class="fl-ph-sub">Préstamos temporales con odómetro, combustible y checklist doble</div></div>
      <div style="display:flex;gap:8px">
        <button class="fl-tb ghost" onclick="flHome()">← Panel</button>
        ${eA?`<button class="fl-tb blue" onclick="flNuevaComision()">${I.plus} Nueva comisión</button>`:''}
      </div>
    </div>
    ${comis.length?comis.map(c=>`
      <div class="fl-com-card">
        <div class="fl-com-head">
          <div>
            <div class="fl-com-title">Unidad ${c.vehiculoEco||'—'} · ${c.vehiculo||''}</div>
            <div class="fl-com-sub">${c.operador||'—'} · ${hFecha(c.fechaSalida||c.creadoEn)}</div>
          </div>
          <span class="fl-b ${c.status==='activa'?'amber':c.status==='cerrada'?'green':'blue'}">${c.status||'pendiente'}</span>
        </div>
        <div class="fl-com-body">
          <div class="fl-com-meters">
            <div class="fl-com-meter"><div class="v">${c.kmInicial||'—'}</div><div class="l">Odóm. inicial</div></div>
            <div class="fl-com-meter"><div class="v">${c.kmFinal||'—'}</div><div class="l">Odóm. final</div></div>
            <div class="fl-com-meter"><div class="v">${c.kmFinal&&c.kmInicial?(c.kmFinal-c.kmInicial):0} km</div><div class="l">Recorrido</div></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
            <div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center"><div style="font-size:12px;font-weight:700;color:#1D4ED8">${c.gasolinaLitros||'—'} L</div><div style="font-size:9.5px;color:#64748B;font-weight:700;margin-top:2px">GASOLINA</div></div>
            <div style="background:#EFF6FF;border-radius:8px;padding:10px;text-align:center"><div style="font-size:12px;font-weight:700;color:#1D4ED8">${c.tiempoUso||'—'}</div><div style="font-size:9.5px;color:#64748B;font-weight:700;margin-top:2px">TIEMPO USO</div></div>
            <div style="background:#F0FDF4;border-radius:8px;padding:10px;text-align:center"><div style="font-size:12px;font-weight:700;color:#15803D">${c.destino||'—'}</div><div style="font-size:9.5px;color:#64748B;font-weight:700;margin-top:2px">DESTINO</div></div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="fl-b ${c.checklistSalida?'green':'red'}">${c.checklistSalida?I.check:'!'} Checklist salida</span>
            <span class="fl-b ${c.checklistEntrada?'green':'amber'}">${c.checklistEntrada?I.check:'⏳'} Checklist entrada</span>
            ${c.status==='activa'&&eA?`<button class="fl-tb dark" style="margin-left:auto;font-size:11px" onclick="flCerrarComision('${c.id}')">Registrar retorno</button>`:''}
          </div>
        </div>
      </div>`).join(''):`<div class="fl-empty"><div class="fl-empty-i">🚗</div><h3>Sin comisiones registradas</h3><p>No hay préstamos eventuales activos o históricos.</p></div>`}
  </div>`;
};

window.flNuevaComision=function(){
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>Nueva comisión eventual</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div class="fl-form" id="fl-form-com">
        <div class="fl-field"><label>Vehículo *</label><select name="vehiculoId" required><option value="">Seleccionar…</option>${flV.filter(v=>v.status==='activo'||!v.status).map(v=>`<option value="${v.id}" data-eco="${v.eco}">${v.eco} · ${v.placas} — ${v.unidad}</option>`).join('')}</select></div>
        <div class="fl-frow">
          <div class="fl-field"><label>Operador / Conductor *</label><input name="operador" placeholder="Nombre completo…" required></div>
          <div class="fl-field"><label>Destino *</label><input name="destino" placeholder="Ciudad o lugar…" required></div>
        </div>
        <div class="fl-frow">
          <div class="fl-field"><label>Odómetro inicial (km) *</label><input name="kmInicial" type="number" placeholder="0" required></div>
          <div class="fl-field"><label>Gasolina cargada (litros)</label><input name="gasolinaLitros" type="number" placeholder="0"></div>
        </div>
        <div class="fl-field"><label>Motivo / Descripción</label><textarea name="descripcion" placeholder="Propósito del viaje…"></textarea></div>
        <div class="fl-factions">
          <button type="button" class="fl-tb ghost" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
          <button type="button" class="fl-tb blue" onclick="flGuardarComision()">Registrar salida</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flGuardarComision=async function(){
  const form=document.getElementById('fl-form-com'); if(!form) return;
  const get=n=>form.querySelector(`[name="${n}"]`)?.value?.trim()||'';
  const vid=get('vehiculoId'),oper=get('operador'),dest=get('destino'),km=get('kmInicial');
  if(!vid||!oper||!dest||!km){alert('Completa vehículo, operador, destino y odómetro.');return;}
  const veh=flV.find(v=>v.id===vid);
  const data={vehiculoId:vid,vehiculoEco:form.querySelector(`[name="vehiculoId"] option:checked`)?.dataset?.eco||veh?.eco||'',vehiculo:veh?`${veh.eco} · ${veh.placas}`:'',operador:oper,destino:dest,kmInicial:parseInt(km),gasolinaLitros:parseFloat(get('gasolinaLitros'))||0,descripcion:get('descripcion'),fechaSalida:new Date().toISOString(),status:'activa',creadoEn:new Date().toISOString(),creadoPor:window.auth?.currentUser?.email||''};
  try{
    await fs.addDoc(fs.collection(db,C.COMIS),data);
    document.querySelector('.fl-ov')?.remove();
    flComisionesVista();
  }catch(e){console.error(e);alert('Error al guardar.');}
};

window.flCerrarComision=function(id){
  const ov=document.createElement('div'); ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-mh"><h3>Registrar retorno de comisión</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb"><div class="fl-form" id="fl-form-ret">
      <div class="fl-frow">
        <div class="fl-field"><label>Odómetro final (km) *</label><input name="kmFinal" type="number" placeholder="0" required></div>
        <div class="fl-field"><label>Tiempo de uso</label><input name="tiempoUso" placeholder="ej: 3h 20min"></div>
      </div>
      <div class="fl-field"><label>Observaciones de retorno</label><textarea name="obs" placeholder="Estado del vehículo al retornar…"></textarea></div>
      <div class="fl-factions">
        <button type="button" class="fl-tb ghost" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
        <button type="button" class="fl-tb blue" onclick="flGuardarRetorno('${id}')">Registrar entrada</button>
      </div>
    </div></div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flGuardarRetorno=async function(id){
  const form=document.getElementById('fl-form-ret'); if(!form) return;
  const km=form.querySelector('[name="kmFinal"]')?.value||0;
  const tiempo=form.querySelector('[name="tiempoUso"]')?.value||'';
  const obs=form.querySelector('[name="obs"]')?.value||'';
  try{
    await fs.updateDoc(fs.doc(db,C.COMIS,id),{kmFinal:parseInt(km),tiempoUso:tiempo,obsRetorno:obs,fechaEntrada:new Date().toISOString(),status:'cerrada',checklistEntrada:true});
    document.querySelector('.fl-ov')?.remove();
    flComisionesVista();
  }catch(e){console.error(e);alert('Error.');}
};

// ── BAJAS ──
window.flBajasVista=async function(){
  navActive('fl-nav-bajas'); vistaAct='bajas';
  let bajas=[];
  try{const snap=await fs.getDocs(fs.collection(db,C.BAJAS));bajas=snap.docs.map(d=>({id:d.id,...d.data()}));}catch(e){}
  const bajasStaticos=flV.filter(v=>v.status==='baja');
  const todas=[...bajas,...bajasStaticos];
  document.getElementById('fl-main').innerHTML=`<div class="fl-inner">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div><div class="fl-ph-title">Vehículos de Baja</div><div class="fl-ph-sub">Histórico centralizado · Expedientes completos de unidades retiradas</div></div>
      <button class="fl-tb ghost" onclick="flHome()">← Panel</button>
    </div>
    ${todas.length?todas.map(v=>`
      <div class="fl-baja-card">
        <div class="fl-baja-head">
          <div>
            <div style="font-size:13px;font-weight:700">Unidad ${v.eco||'—'} · ${v.placas||''}</div>
            <div style="font-size:11px;opacity:.8">${v.unidad||'—'} · Baja: ${hFecha(v.fechaBaja||v.actualizadoEn)}</div>
          </div>
          <span class="fl-b red">Baja definitiva</span>
        </div>
        <div style="padding:14px 16px">
          <div class="fl-sg" style="margin-bottom:12px">
            <dl class="fl-sc"><dt>Serie</dt><dd class="mono" style="font-size:11px">${v.serie||'—'}</dd></dl>
            <dl class="fl-sc"><dt>Km final</dt><dd>${v.km?v.km.toLocaleString()+' km':'—'}</dd></dl>
            <dl class="fl-sc"><dt>Último responsable</dt><dd>${v.responsable||'—'}</dd></dl>
            <dl class="fl-sc"><dt>Motivo de baja</dt><dd>${v.motivoBaja||'—'}</dd></dl>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap">
            <span class="fl-b ${v.expediente?'green':'gray'}">${I.doc} Expediente completo</span>
            <span class="fl-b ${v.fotosBaja?.length?'green':'gray'}">${I.camera} Fotos de entrega (${v.fotosBaja?.length||0})</span>
            <span class="fl-b gray">${I.archive} Bitácoras descargables</span>
          </div>
        </div>
      </div>`).join(''):`<div class="fl-empty"><div class="fl-empty-i">🗄️</div><h3>Sin vehículos de baja</h3><p>No hay unidades retiradas del registro.</p></div>`}
  </div>`;
};

// ── ACCIONES ──
window.flEstatus=async(id,est)=>{
  try{await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:est,actualizadoEn:new Date().toISOString()});await initSolicitudes();flRefresh();}catch(e){console.error(e);}
};
window.flAprobar=id=>flEstatus(id,'Aprobada');
window.flRechazar=async id=>{
  const m=prompt('Motivo del rechazo (obligatorio):'); if(m===null||!m.trim()) return;
  try{await fs.updateDoc(fs.doc(db,C.SOLS,id),{estatus:'Rechazada',comentarioRechazo:m,actualizadoEn:new Date().toISOString()});await initSolicitudes();flRefresh();}catch(e){console.error(e);}
};
window.flEliminar=async id=>{
  if(!confirm('¿Eliminar solicitud? Esta acción no se puede deshacer.')) return;
  try{await fs.deleteDoc(fs.doc(db,C.SOLS,id));await initSolicitudes();flRefresh();}catch(e){console.error(e);}
};
window.flCotizar=id=>{
  const s=flS.find(x=>x.id===id);
  const m=prompt('Monto de cotización:',s?.cotizacion||''); if(m===null) return;
  const t=prompt('Taller / Proveedor:',s?.taller||'');     if(t===null) return;
  fs.updateDoc(fs.doc(db,C.SOLS,id),{cotizacion:m,taller:t,estatus:'Cotización',actualizadoEn:new Date().toISOString()})
    .then(async()=>{await initSolicitudes();document.querySelector('.fl-ov')?.remove();flRefresh();});
};
window.flVerImg=src=>{
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.cursor='zoom-out';
  ov.innerHTML=`<img src="${src}" style="max-width:92%;max-height:92%;border-radius:14px;box-shadow:0 25px 80px rgba(0,0,0,.5)">`;
  ov.onclick=()=>ov.remove();document.body.appendChild(ov);
};

function flRefresh(){
  if(vistaAct==='home')         flHome();
  else if(vistaAct==='detalle') renderDetalle();
  else if(vistaAct==='solicitudes') flSolicitudesAll();
  else if(vistaAct==='comisiones')  flComisionesVista();
  else if(vistaAct==='bajas')       flBajasVista();
}

console.log('[FLOTILLA v6] Gestión Vehicular Tecnocontrol — '+CAT.length+' unidades en catálogo');
})();
