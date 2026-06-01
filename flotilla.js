// ══════════════════════════════════════════════════════════════
// flotilla.js v5 — Flotilla Vehicular Tecnocontrol
// Diseño: Kipup-inspired · Elegante · Minimalista · Profesional
// ══════════════════════════════════════════════════════════════
(function () {
'use strict';

// ── COLECCIONES FIRESTORE ──
const COL_VEHS = 'flotilla_vehiculos';
const COL_SOLS = 'flotilla_solicitudes';

// ── CATÁLOGO DE VEHÍCULOS (datos reales del Excel) ──
const FL_CATALOGO = [
  {eco:'35', unidad:'ISUZU 2019',             año:2019, plaza:'CHIHUAHUA',  responsable:'ALMACEN',          placas:'DU6495A', serie:'JAANPR755K7000178', rendimiento:'3.5 KM/L',  poliza_venc:'2026-09-24', poliza:'794B05035M-9',  tipo:'camion'},
  {eco:'48', unidad:'MARCH ACTIVE L4 2019',   año:2019, plaza:'CHIHUAHUA',  responsable:'IVAN ARGENIS',     placas:'EMB309A', serie:'3N1CK3CD4KL232066', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-8',  tipo:'auto'},
  {eco:'69', unidad:'NISSAN NP300 2017',       año:2017, plaza:'CHIHUAHUA',  responsable:'LUIS LOPEZ',       placas:'DU6499A', serie:'3N6AD33A6HK837318', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-38', tipo:'camioneta'},
  {eco:'31', unidad:'NP300 KANGOO 2012',       año:2012, plaza:'CHIHUAHUA',  responsable:'DESARROLLOS',      placas:'DU6754A', serie:'3N6DD25T5CK018279', rendimiento:'8 KM/L',    poliza_venc:'2026-09-24', poliza:'794B05035M-6',  tipo:'camioneta'},
  {eco:'43', unidad:'F-150 PICK-UP 2012',      año:2012, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DU6488A', serie:'1FTMF1CM1CKD41243', rendimiento:'5.6 KM/L',  poliza_venc:'2026-09-24', poliza:'794B05035M-5',  tipo:'camioneta'},
  {eco:'66', unidad:'AVEO 2018',               año:2018, plaza:'CHIHUAHUA',  responsable:'CARMEN HERNANDEZ', placas:'EMB311A', serie:'LSGHD52H6JD239610', rendimiento:'11.25 KM/L',poliza_venc:'2026-09-24', poliza:'794B05035M-37', tipo:'auto'},
  {eco:'59', unidad:'RAM 700 2021',            año:2021, plaza:'CHIHUAHUA',  responsable:'ALAN ESTRADA',     placas:'DU6481A', serie:'9BD281G56MYV59423', rendimiento:'13.5 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-36', tipo:'camioneta'},
  {eco:'58', unidad:'RAM 700 2021',            año:2021, plaza:'CHIHUAHUA',  responsable:'ISMAEL BARRAZA',   placas:'DU6482A', serie:'9BD281G50MYV59661', rendimiento:'12.7 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-35', tipo:'camioneta'},
  {eco:'56', unidad:'RAM 700 SLT 2020',        año:2020, plaza:'PARRAL',     responsable:'PLAZA PARRAL',     placas:'DU6483A', serie:'9BD578451LY423955', rendimiento:'14.5 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-34', tipo:'camioneta'},
  {eco:'54', unidad:'RAM 700 SLT 2020',        año:2020, plaza:'CHIHUAHUA',  responsable:'RICARDO GONZALEZ', placas:'DU6485A', serie:'9BD578452LY411572', rendimiento:'17.5 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-33', tipo:'camioneta'},
  {eco:'64', unidad:'MARCH ACTIVE 2017',       año:2017, plaza:'CHIHUAHUA',  responsable:'VERONICA GARCIA',  placas:'DU6474A', serie:'3N6CK34N4HL242297', rendimiento:'10.59 KM/L',poliza_venc:'2026-09-24', poliza:'794B05035M-32', tipo:'auto'},
  {eco:'62', unidad:'NP300 2019',              año:2019, plaza:'MONTERREY',  responsable:'JULIO DE LA CRUZ', placas:'DU6472A', serie:'3N6AD33A1KK838707', rendimiento:'7.5 KM/L',  poliza_venc:'2026-09-24', poliza:'794B05035M-31', tipo:'camioneta'},
  {eco:'39', unidad:'L200 2019',               año:2019, plaza:'CHIHUAHUA',  responsable:'SERGIO MENDOZA',   placas:'DU6491A', serie:'MMBL45G1KH043444',  rendimiento:'10 KM/L',   poliza_venc:'2026-09-24', poliza:'794B05035M-30', tipo:'camioneta'},
  {eco:'61', unidad:'MARCH 2020',              año:2020, plaza:'PARRAL',     responsable:'RICARDO MORIEL',   placas:'DU6479A', serie:'3N6CK34N2LL254229', rendimiento:'13.9 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-29', tipo:'auto'},
  {eco:'60', unidad:'MARCH 2020',              año:2020, plaza:'CAMARGO',    responsable:'RAMON HERNANDEZ',  placas:'DU6480A', serie:'3N6CK34N9LL254065', rendimiento:'11.59 KM/L',poliza_venc:'2026-09-24', poliza:'794B05035M-28', tipo:'auto'},
  {eco:'55', unidad:'MARCH 2020',              año:2020, plaza:'MONTERREY',  responsable:'ROQUE LEAL',       placas:'DU6484A', serie:'3N6CK34N3LL248469', rendimiento:'11.72 KM/L',poliza_venc:'2026-09-24', poliza:'794B05035M-27', tipo:'auto'},
  {eco:'52', unidad:'MARCH 2020',              año:2020, plaza:'MONTERREY',  responsable:'MONTERREY',        placas:'DU6486A', serie:'3N6CK34N3LL243692', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-26', tipo:'auto'},
  {eco:'63', unidad:'SILVERADO 1500 2013',     año:2013, plaza:'CHIHUAHUA',  responsable:'BODEGA',           placas:'DU6473A', serie:'3GCNC9CX6DG343777', rendimiento:'5.5 KM/L',  poliza_venc:'2026-09-24', poliza:'794B05035M-25', tipo:'camioneta'},
  {eco:'47', unidad:'MARCH ACTIVE L4 2019',    año:2019, plaza:'CHIHUAHUA',  responsable:'IDALY RUIZ',       placas:'EMB308A', serie:'3N1CK3CD5KL232108', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-24', tipo:'auto'},
  {eco:'17', unidad:'MARCH ACTIVE 2017',       año:2017, plaza:'CHIHUAHUA',  responsable:'GUILLERMO',        placas:'EMB313A', serie:'3N1CK3CD5HL248558', rendimiento:'14.5 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-23', tipo:'auto'},
  {eco:'38', unidad:'RAM 700 2019',            año:2019, plaza:'CHIHUAHUA',  responsable:'DIONICIO',         placas:'DU6492A', serie:'9BD578455KY324652', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-22', tipo:'camioneta'},
  {eco:'37', unidad:'RAM 700 2019',            año:2019, plaza:'JUAREZ',     responsable:'JUAREZ',           placas:'DU6493A', serie:'9BD578458KY323611', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-21', tipo:'camioneta'},
  {eco:'19', unidad:'RAM 700 2017',            año:2017, plaza:'CHIHUAHUA',  responsable:'ROBERTO MUÑOZ',    placas:'DU6471A', serie:'9BD578458HY162606', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-20', tipo:'camioneta'},
  {eco:'40', unidad:'MARCH ACTIVE 2019',       año:2019, plaza:'MONTERREY',  responsable:'IVAN SEPULVEDA',   placas:'DU6490A', serie:'3N6CK34N2KL230477', rendimiento:'10.5 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-2',  tipo:'auto'},
  {eco:'26', unidad:'SEAT IBIZA 2018',         año:2018, plaza:'CHIHUAHUA',  responsable:'MARTIN DE LA O',   placas:'EMB314A', serie:'VSBB2KJ1JR017261',  rendimiento:'13 KM/L',   poliza_venc:'2026-09-24', poliza:'794B05035M-19', tipo:'auto'},
  {eco:'36', unidad:'CAMION NISSAN CS 2014',   año:2014, plaza:'CHIHUAHUA',  responsable:'LUIS LOPEZ',       placas:'DU6494A', serie:'3N6DD25T9EK019471', rendimiento:'8 KM/L',    poliza_venc:'2026-09-24', poliza:'794B05035M-18', tipo:'camion'},
  {eco:'15', unidad:'NISSAN NP300 2017',       año:2017, plaza:'JUAREZ',     responsable:'JORGE GUERRERO',   placas:'DU6478A', serie:'3N6AD33A3HK869708', rendimiento:'7 KM/L',    poliza_venc:'2026-09-24', poliza:'794B05035M-17', tipo:'camioneta'},
  {eco:'23', unidad:'RAM 700 2018',            año:2018, plaza:'CHIHUAHUA',  responsable:'SERGIO CARMONA',   placas:'DU6752A', serie:'9BD578454JY209023', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-14', tipo:'camioneta'},
  {eco:'22', unidad:'RAM 700 2018',            año:2018, plaza:'CHIHUAHUA',  responsable:'CHIHUAHUA',        placas:'DU6751A', serie:'9BD578456JY208715', rendimiento:'9 KM/L',    poliza_venc:'2026-09-24', poliza:'794B05035M-13', tipo:'camioneta'},
  {eco:'21', unidad:'RAM 700 2018',            año:2018, plaza:'JUAREZ',     responsable:'BENITO SOTO',      placas:'DU6470A', serie:'9BD578452JY210560', rendimiento:'—',          poliza_venc:'2026-09-24', poliza:'794B05035M-12', tipo:'camioneta'},
  {eco:'50', unidad:'FIESTA 2018',             año:2018, plaza:'MONTERREY',  responsable:'IRVING SAUCEDO',   placas:'EMB310A', serie:'3FADP4BJ1JM128469', rendimiento:'11.3 KM/L', poliza_venc:'2026-09-24', poliza:'794B05035M-11', tipo:'auto'},
  {eco:'16', unidad:'GRUA F-350 2010',         año:2010, plaza:'CHIHUAHUA',  responsable:'CHIHUAHUA',        placas:'DU6497A', serie:'1FDEF3G59AEB23674', rendimiento:'5 KM/L',    poliza_venc:'2026-09-24', poliza:'794B05035M-10', tipo:'camion'},
  {eco:'71', unidad:'YUKON 2023',              año:2023, plaza:'CHIHUAHUA',  responsable:'PALOMA PINEDO',    placas:'DYY416B', serie:'1GKS28KL1PR236241', rendimiento:'—',          poliza_venc:'—',           poliza:'—',             tipo:'camioneta'},
  {eco:'72', unidad:'RAM RAPID 2023',          año:2023, plaza:'CHIHUAHUA',  responsable:'JORGE URIBE',      placas:'DG7445B', serie:'9BD2657RIP9233026',  rendimiento:'14 KM/L',   poliza_venc:'—',           poliza:'—',             tipo:'camioneta'},
  {eco:'73', unidad:'DODGE ATTITUDE 2023',     año:2023, plaza:'CHIHUAHUA',  responsable:'DENISSE GUTIERREZ',placas:'MKL325A', serie:'ML3ABT6J4PH004521', rendimiento:'—',          poliza_venc:'—',           poliza:'—',             tipo:'auto'},
  {eco:'74', unidad:'DODGE ATTITUDE 2023',     año:2023, plaza:'CHIHUAHUA',  responsable:'FATIMA SAUZAMEDA', placas:'MKL317A', serie:'ML3ABT6J4PH004552', rendimiento:'15.8 KM/L', poliza_venc:'—',           poliza:'—',             tipo:'auto'},
  {eco:'75', unidad:'AVEO 2019',               año:2019, plaza:'CHIHUAHUA',  responsable:'PALOMA PINEDO',    placas:'DUJ454B', serie:'LSGHD52H8KD130423', rendimiento:'—',          poliza_venc:'2027-02-14', poliza:'29113016152002',tipo:'auto'},
  {eco:'76', unidad:'NISSAN VERSA 2024',       año:2024, plaza:'MONTERREY',  responsable:'LUIS GARZA',       placas:'ESU908B', serie:'3N1CN7AE7RK398169', rendimiento:'16 KM/L',   poliza_venc:'—',           poliza:'—',             tipo:'auto'},
  {eco:'77', unidad:'BMW X6 2025',             año:2025, plaza:'CHIHUAHUA',  responsable:'MARTIN DE LA O',   placas:'EKM897B', serie:'WBA41EX06S9W75509', rendimiento:'—',          poliza_venc:'—',           poliza:'—',             tipo:'auto'},
  {eco:'79', unidad:'CHANGAN HUNTER 2025',     año:2025, plaza:'CHIHUAHUA',  responsable:'SERGIO MENDOZA',   placas:'337217',  serie:'LSCBBZ2A1SG803364', rendimiento:'—',          poliza_venc:'2029-02-27', poliza:'4056350008',    tipo:'camioneta'},
  {eco:'80', unidad:'CHANGAN HUNTER 2025',     año:2025, plaza:'CHIHUAHUA',  responsable:'ULISES NUÑEZ',     placas:'337218',  serie:'LSCBBZ2A3SG803365', rendimiento:'—',          poliza_venc:'2029-02-27', poliza:'4056347985',    tipo:'camioneta'},
  {eco:'81', unidad:'CHANGAN HUNTER 2025',     año:2025, plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',       placas:'337219',  serie:'LSCBB72A8SG803376', rendimiento:'—',          poliza_venc:'2029-02-27', poliza:'4056350016',    tipo:'camioneta'},
  {eco:'82', unidad:'VAN CARGA DONGFENG 2026', año:2026, plaza:'CHIHUAHUA',  responsable:'TOMAS',            placas:'DZ9769B', serie:'LGFP541E6TA603994', rendimiento:'—',          poliza_venc:'2029-03-17', poliza:'4056530506',    tipo:'camion'},
  {eco:'83', unidad:'CHASIS DC DONGFENG 2025', año:2025, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DZ9767B', serie:'LGDND41EXSA202059', rendimiento:'—',          poliza_venc:'2029-03-17', poliza:'4056530481',    tipo:'camion'},
  {eco:'84', unidad:'CHASIS DC DONGFENG 2025', año:2025, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DZ9766B', serie:'LGDND41E6SA202057', rendimiento:'—',          poliza_venc:'2029-03-17', poliza:'4056530495',    tipo:'camion'},
  {eco:'85', unidad:'PICKUP DONGFENG 2025',    año:2025, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DZ9768B', serie:'LGDCMA1L5SA204421', rendimiento:'—',          poliza_venc:'2029-03-20', poliza:'3200970801',    tipo:'camioneta'},
  {eco:'90', unidad:'CHANGAN STAR TRUCK 2026', año:2026, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DZ9853B', serie:'LSCAB12E7TG800860', rendimiento:'—',          poliza_venc:'2026-11-01', poliza:'1950290311',    tipo:'camion'},
  {eco:'91', unidad:'CHANGAN STAR DC 2026',    año:2026, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DZ9855B', serie:'LSCAB22E6TG800256', rendimiento:'—',          poliza_venc:'2026-11-01', poliza:'1950290357',    tipo:'camion'},
  {eco:'92', unidad:'CHANGAN STAR DC 2026',    año:2026, plaza:'CHIHUAHUA',  responsable:'—',                placas:'DZ9854B', serie:'LSCAB22E5TG800295', rendimiento:'—',          poliza_venc:'2026-11-01', poliza:'1950290361',    tipo:'camion'},
];

// ── CHECKLIST KIPUP ──
const FL_CHECKLIST = {
  interiores: ['Póliza / Manual de propietario','Radio / Carátula','Pantallas / FIS','Encendedor','Asientos y vestiduras','Tablero en buen estado','Asientos en buen estado','Tapetes de tela','Tapetes de plástico'],
  motor:      ['Batería','Distribuidor','Bobinas','Computadora','Tapón depósito agua limpiabrisas','Tapón recuperador agua radiador','Tapón dirección hidráulica','Tapón radiador'],
  exteriores: ['Antena','Tapón gasolina','Centro de rin','Polveras','Llantas','Limpiaparabrisas','Retrovisores'],
  cajuela:    ['Herramienta','Reflejantes','Cables','Extintor','Llanta de refacción','Llave L','Llave de cruz'],
};

// ── ESTADO ──
let flVehiculos   = [];
let flSolicitudes = [];
let flVehActivo   = null;
let flTabActiva   = 'info';
let flVistaActual = 'home';
let flBusqueda    = '';
let flFotosBase64 = [];

// ── ÍCONOS ──
const I = {
  truck:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  car:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h1l3-3h12l3 3h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`,
  grid:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
  list:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  info:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  doc:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  hist:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>`,
  wrench: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  check:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  x:      `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  plus:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  upload: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>`,
  fuel:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 22V8l9-6 9 6v14H3z"/><line x1="12" y1="22" x2="12" y2="13"/><path d="M9 22V13h6v9"/></svg>`,
  clip:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>`,
  alert:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  pin:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
};

// ── ESTILOS ──
function flEstilos() {
  if (document.getElementById('fl-s5')) return;
  const s = document.createElement('style');
  s.id = 'fl-s5';
  s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap');

/* ── BASE ── */
#flotilla-dashboard { display:none; margin-left:240px; min-height:100vh; background:#F7F7F5; font-family:'DM Sans',-apple-system,sans-serif; color:#111110; }
#flotilla-dashboard * { box-sizing:border-box; margin:0; padding:0; }

/* ── TOPBAR ── */
.fl-top { background:#fff; border-bottom:1px solid #EBEBEA; padding:0 24px; display:flex; align-items:center; gap:10px; height:56px; position:sticky; top:0; z-index:200; }
.fl-top-title { font-size:15px; font-weight:700; flex:1; display:flex; align-items:center; gap:8px; letter-spacing:-.3px; }
.fl-top-role { font-size:11px; padding:3px 10px; border-radius:100px; background:#EEF2FF; color:#4F46E5; font-weight:700; letter-spacing:.2px; }
.fl-top-btn { display:flex; align-items:center; gap:5px; border:none; border-radius:7px; padding:7px 14px; font-size:12.5px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .15s; }
.fl-top-btn.ghost { background:transparent; color:#6B7280; border:1px solid #E5E7EB; }
.fl-top-btn.ghost:hover { border-color:#4F46E5; color:#4F46E5; }
.fl-top-btn.primary { background:#111110; color:#fff; }
.fl-top-btn.primary:hover { background:#2D2D2B; transform:translateY(-1px); }

/* ── LAYOUT ── */
.fl-layout { display:grid; grid-template-columns:256px 1fr; min-height:calc(100vh - 56px); }

/* ── SIDEBAR ── */
.fl-side { background:#fff; border-right:1px solid #EBEBEA; display:flex; flex-direction:column; overflow:hidden; }
.fl-side-head { padding:12px; border-bottom:1px solid #EBEBEA; }
.fl-side-search { position:relative; }
.fl-side-search input { width:100%; padding:8px 10px 8px 32px; border:1.5px solid #E5E7EB; border-radius:8px; font-size:12.5px; font-family:inherit; background:#F9F9F8; outline:none; transition:border-color .15s; color:#111110; }
.fl-side-search input:focus { border-color:#4F46E5; background:#fff; }
.fl-side-search-icon { position:absolute; left:9px; top:50%; transform:translateY(-50%); color:#9CA3AF; display:flex; pointer-events:none; }
.fl-side-stats { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:10px 12px; border-bottom:1px solid #EBEBEA; }
.fl-stat-pill { border-radius:8px; padding:8px 10px; }
.fl-stat-pill .n { font-size:18px; font-weight:800; line-height:1; }
.fl-stat-pill .l { font-size:10px; font-weight:700; margin-top:2px; text-transform:uppercase; letter-spacing:.4px; }
.fl-side-list { flex:1; overflow-y:auto; padding:8px; }
.fl-side-label { font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#9CA3AF; padding:8px 8px 4px; }

/* ── ITEM VEHÍCULO SIDEBAR ── */
.fl-vitem { border-radius:8px; padding:8px 10px; cursor:pointer; transition:all .15s; border:1.5px solid transparent; display:flex; align-items:center; gap:9px; margin-bottom:2px; }
.fl-vitem:hover { background:#F7F7F5; }
.fl-vitem.active { background:#EEF2FF; border-color:#4F46E5; }
.fl-vitem-ico { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; }
.fl-vitem-eco { font-size:12.5px; font-weight:700; line-height:1.2; }
.fl-vitem-sub { font-size:10.5px; color:#6B7280; font-family:'JetBrains Mono',monospace; }
.fl-dot { width:7px; height:7px; border-radius:50%; margin-left:auto; flex-shrink:0; }
.fl-dot.ok  { background:#10B981; }
.fl-dot.tal { background:#F59E0B; }
.fl-dot.off { background:#D1D5DB; }

/* ── PANEL PRINCIPAL ── */
.fl-main { overflow-y:auto; }
.fl-main-inner { padding:28px 32px; max-width:960px; }

/* ── PAGE TITLE ── */
.fl-page-title { font-size:20px; font-weight:800; letter-spacing:-.5px; margin-bottom:4px; }
.fl-page-sub { font-size:13px; color:#6B7280; margin-bottom:22px; }

/* ── ALERTAS ── */
.fl-alerts { display:flex; flex-direction:column; gap:6px; margin-bottom:20px; }
.fl-alert { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:500; border:1px solid; }
.fl-alert.warn  { background:#FFFBEB; color:#92400E; border-color:#FDE68A; }
.fl-alert.error { background:#FEF2F2; color:#991B1B; border-color:#FECACA; }

/* ── KPI GRID ── */
.fl-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:24px; }
.fl-kpi { background:#fff; border:1px solid #EBEBEA; border-radius:10px; padding:16px 18px; }
.fl-kpi-l { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.7px; color:#6B7280; margin-bottom:6px; }
.fl-kpi-v { font-size:28px; font-weight:800; letter-spacing:-.8px; line-height:1; }
.fl-kpi-s { font-size:11px; color:#9CA3AF; margin-top:4px; }

/* ── SECCIÓN TÍTULO ── */
.fl-sec-title { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#6B7280; margin-bottom:10px; }

/* ── TABS ── */
.fl-tabs { display:flex; gap:0; background:#F3F4F6; border-radius:9px; padding:3px; margin-bottom:20px; width:fit-content; border:1px solid #EBEBEA; }
.fl-tab { padding:7px 16px; border-radius:7px; border:none; background:transparent; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600; color:#6B7280; transition:all .15s; display:flex; align-items:center; gap:5px; white-space:nowrap; }
.fl-tab:hover { color:#111110; }
.fl-tab.active { background:#fff; color:#111110; box-shadow:0 1px 3px rgba(0,0,0,.1); }

/* ── HEADER DETALLE ── */
.fl-det-head { display:flex; align-items:flex-start; gap:16px; margin-bottom:20px; background:#fff; border:1px solid #EBEBEA; border-radius:12px; padding:20px; }
.fl-det-ico { width:54px; height:54px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; }
.fl-det-eco { font-size:20px; font-weight:800; letter-spacing:-.4px; }
.fl-det-sub { font-size:12.5px; color:#6B7280; margin-top:5px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.fl-det-sub span { display:flex; align-items:center; gap:3px; }

/* ── GAUGE DE COMBUSTIBLE ── */
.fl-gauge-wrap { background:#fff; border:1px solid #EBEBEA; border-radius:10px; padding:16px; text-align:center; }
.fl-gauge-title { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#6B7280; margin-bottom:8px; }
.fl-gauge-val { font-size:13px; font-weight:700; margin-top:4px; color:#111110; }

/* ── INFO GRID ── */
.fl-info-grid { display:grid; grid-template-columns:1fr 1fr; background:#fff; border:1px solid #EBEBEA; border-radius:10px; overflow:hidden; }
.fl-info-cell { padding:12px 16px; border-bottom:1px solid #EBEBEA; }
.fl-info-cell:nth-child(odd)        { border-right:1px solid #EBEBEA; }
.fl-info-cell:nth-last-child(-n+2)  { border-bottom:none; }
.fl-info-cell dt { font-size:9.5px; text-transform:uppercase; letter-spacing:.6px; color:#6B7280; font-weight:800; margin-bottom:3px; }
.fl-info-cell dd { font-size:13.5px; font-weight:600; }
.fl-info-cell dd.mono { font-family:'JetBrains Mono',monospace; font-size:11.5px; font-weight:500; }

/* ── BADGES ── */
.fl-badge { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:700; padding:3px 8px; border-radius:100px; white-space:nowrap; }
.fl-badge.ok   { background:#D1FAE5; color:#065F46; }
.fl-badge.warn { background:#FEF3C7; color:#92400E; }
.fl-badge.err  { background:#FEE2E2; color:#991B1B; }
.fl-badge.info { background:#EEF2FF; color:#3730A3; }
.fl-badge.gray { background:#F3F4F6; color:#374151; }
.fl-badge.Solicitud  { background:#EDE9FE; color:#5B21B6; }
.fl-badge.Validada   { background:#DBEAFE; color:#1E40AF; }
.fl-badge.Cotizacin  { background:#FEF3C7; color:#92400E; }
.fl-badge.Aprobada   { background:#D1FAE5; color:#065F46; }
.fl-badge.Rechazada  { background:#FEE2E2; color:#991B1B; }
.fl-badge.Cierre     { background:#F3E8FF; color:#6D28D9; }
.fl-badge.Cerrada    { background:#F3F4F6; color:#374151; }

/* ── TABLA ── */
.fl-tbl-wrap { background:#fff; border:1px solid #EBEBEA; border-radius:10px; overflow:hidden; }
.fl-tbl { width:100%; border-collapse:collapse; font-size:12.5px; }
.fl-tbl th { background:#F9FAFB; padding:10px 14px; text-align:left; font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#6B7280; border-bottom:1px solid #EBEBEA; }
.fl-tbl td { padding:12px 14px; border-bottom:1px solid #EBEBEA; vertical-align:middle; }
.fl-tbl tr:last-child td { border-bottom:none; }
.fl-tbl tr:hover td { background:#F9FAFB; }
.fl-tbl tr { cursor:pointer; transition:background .1s; }

/* ── POLIZA CARD ── */
.fl-poliza-card { background:#fff; border:1px solid #EBEBEA; border-radius:10px; padding:16px 18px; display:flex; align-items:center; gap:14px; }
.fl-poliza-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
.fl-poliza-label { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:#6B7280; margin-bottom:3px; }
.fl-poliza-val { font-size:15px; font-weight:700; }
.fl-poliza-dias { font-size:11px; margin-top:2px; }

/* ── CHECKLIST KIPUP ── */
.fl-chk-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
.fl-chk-section { background:#fff; border:1px solid #EBEBEA; border-radius:10px; overflow:hidden; }
.fl-chk-head { background:#F9FAFB; padding:10px 14px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:#374151; border-bottom:1px solid #EBEBEA; }
.fl-chk-item { display:flex; align-items:center; gap:10px; padding:9px 14px; border-bottom:1px solid #F3F4F6; font-size:12.5px; }
.fl-chk-item:last-child { border-bottom:none; }
.fl-chk-item label { flex:1; cursor:pointer; }
.fl-chk-si, .fl-chk-no {
  width:20px; height:20px; border-radius:5px; border:1.5px solid #D1D5DB; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:10px; flex-shrink:0; transition:all .15s;
}
.fl-chk-si:hover { border-color:#10B981; background:#D1FAE5; }
.fl-chk-no:hover { border-color:#EF4444; background:#FEE2E2; }
.fl-chk-si.selected { background:#10B981; border-color:#10B981; color:#fff; }
.fl-chk-no.selected { background:#EF4444; border-color:#EF4444; color:#fff; }
.fl-chk-label-si { font-size:9px; font-weight:700; color:#6B7280; }
.fl-chk-label-no { font-size:9px; font-weight:700; color:#6B7280; }

/* ── TIMELINE ── */
.fl-timeline { background:#fff; border:1px solid #EBEBEA; border-radius:10px; overflow:hidden; }
.fl-tl-item { display:grid; grid-template-columns:38px 1fr; gap:10px; padding:12px 14px; border-bottom:1px solid #EBEBEA; align-items:flex-start; }
.fl-tl-item:last-child { border-bottom:none; }
.fl-tl-ico { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:14px; }
.fl-tl-title { font-size:13px; font-weight:700; }
.fl-tl-meta  { font-size:11px; color:#6B7280; margin-top:1px; }
.fl-tl-desc  { font-size:12px; margin-top:4px; color:#374151; }

/* ── BOTONES ACCIÓN ── */
.fl-row { display:flex; gap:6px; flex-wrap:wrap; }
.fl-btn { padding:6px 12px; border:none; border-radius:6px; font-size:11.5px; font-weight:700; cursor:pointer; font-family:inherit; transition:all .15s; display:flex; align-items:center; gap:4px; }
.fl-btn.green  { background:#D1FAE5; color:#065F46; }
.fl-btn.green:hover  { background:#10B981; color:#fff; }
.fl-btn.red    { background:#FEE2E2; color:#991B1B; }
.fl-btn.red:hover    { background:#EF4444; color:#fff; }
.fl-btn.neutral{ background:#F3F4F6; color:#374151; border:1px solid #E5E7EB; }
.fl-btn.neutral:hover{ border-color:#4F46E5; color:#4F46E5; }
.fl-btn.dark   { background:#111110; color:#fff; }
.fl-btn.dark:hover   { background:#2D2D2B; }

/* ── MODAL ── */
.fl-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:2000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(6px); animation:flFi .15s ease; }
@keyframes flFi { from{opacity:0} to{opacity:1} }
.fl-modal { background:#fff; border-radius:14px; width:100%; max-width:580px; max-height:92vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); animation:flSu .2s cubic-bezier(.4,0,.2,1); font-family:'DM Sans',sans-serif; color:#111110; }
@keyframes flSu { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.fl-modal-head { padding:20px 22px 0; display:flex; align-items:center; justify-content:space-between; }
.fl-modal-head h3 { font-size:17px; font-weight:800; letter-spacing:-.3px; }
.fl-modal-x { width:28px; height:28px; border:none; background:#F3F4F6; border-radius:7px; cursor:pointer; font-size:15px; display:flex; align-items:center; justify-content:center; transition:background .15s; }
.fl-modal-x:hover { background:#E5E7EB; }
.fl-modal-body { padding:16px 22px 22px; }

/* ── FORM ── */
.fl-form { display:flex; flex-direction:column; gap:12px; }
.fl-field { display:flex; flex-direction:column; gap:4px; }
.fl-field label { font-size:11.5px; font-weight:700; color:#374151; }
.fl-field input,.fl-field select,.fl-field textarea { padding:9px 12px; border:1.5px solid #E5E7EB; border-radius:8px; font-family:inherit; font-size:13.5px; color:#111110; background:#F9FAFB; outline:none; transition:border-color .15s; width:100%; }
.fl-field input:focus,.fl-field select:focus,.fl-field textarea:focus { border-color:#4F46E5; background:#fff; }
.fl-field input:disabled,.fl-field select:disabled { background:#F3F4F6; color:#6B7280; cursor:not-allowed; }
.fl-field textarea { min-height:85px; resize:vertical; }
.fl-form-row { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.fl-form-actions { display:flex; justify-content:flex-end; gap:8px; padding-top:10px; border-top:1px solid #EBEBEA; }
.fl-field-note { font-size:11px; color:#9CA3AF; }
.fl-field-assigned { background:#EEF2FF; border:1px solid #C7D2FE; border-radius:8px; padding:9px 12px; font-size:13px; font-weight:600; color:#3730A3; display:flex; align-items:center; gap:6px; }

/* ── UPLOAD ── */
.fl-upload { border:2px dashed #E5E7EB; border-radius:8px; padding:14px; text-align:center; cursor:pointer; color:#6B7280; font-size:12.5px; display:flex; align-items:center; justify-content:center; gap:6px; transition:all .15s; }
.fl-upload:hover { border-color:#4F46E5; color:#4F46E5; }
.fl-pills { display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; }
.fl-pill { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; background:#F3F4F6; border:1px solid #E5E7EB; border-radius:100px; font-size:11px; font-weight:600; color:#374151; cursor:pointer; transition:all .15s; font-family:inherit; }
.fl-pill:hover { border-color:#4F46E5; color:#4F46E5; }

/* ── EMPTY / LOADING ── */
.fl-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:220px; gap:8px; color:#6B7280; text-align:center; }
.fl-empty-ico { font-size:40px; opacity:.2; margin-bottom:6px; }
.fl-empty h3 { font-size:16px; font-weight:700; color:#111110; }
.fl-empty p  { font-size:13px; max-width:260px; }
.fl-loading { display:flex; align-items:center; justify-content:center; min-height:200px; color:#6B7280; gap:8px; font-size:13px; }
.fl-spin { width:18px; height:18px; border:2px solid #E5E7EB; border-top-color:#4F46E5; border-radius:50%; animation:flR .7s linear infinite; }
@keyframes flR { to{transform:rotate(360deg)} }

/* ── SOL GRID MODAL ── */
.fl-sol-grid { display:grid; grid-template-columns:1fr 1fr; background:#F9F9F8; border-radius:9px; overflow:hidden; border:1px solid #EBEBEA; }
.fl-sol-cell { padding:10px 13px; }
.fl-sol-cell:nth-child(odd) { border-right:1px solid #EBEBEA; }
.fl-sol-cell dt { font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.5px; color:#6B7280; margin-bottom:2px; }
.fl-sol-cell dd { font-size:13px; font-weight:600; }
.fl-sol-cell.full { grid-column:1/-1; }
.fl-sep { height:1px; background:#EBEBEA; margin:14px 0; }

/* ── PLACAS CHIP ── */
.fl-placa { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; background:#F3F4F6; padding:2px 8px; border-radius:5px; border:1px solid #E5E7EB; }

/* ── RESPONSIVE ── */
@media(max-width:900px){
  #flotilla-dashboard { margin-left:0; }
  .fl-layout { grid-template-columns:1fr; }
  .fl-side { border-right:none; border-bottom:1px solid #EBEBEA; max-height:220px; }
  .fl-kpis { grid-template-columns:1fr 1fr; }
  .fl-info-grid { grid-template-columns:1fr; }
  .fl-info-cell:nth-child(odd) { border-right:none; }
  .fl-info-cell:nth-last-child(-n+2) { border-bottom:1px solid #EBEBEA; }
  .fl-info-cell:last-child { border-bottom:none; }
  .fl-form-row { grid-template-columns:1fr; }
  .fl-chk-grid { grid-template-columns:1fr; }
  .fl-main-inner { padding:16px; }
}
  `;
  document.head.appendChild(s);
}

// ── HTML BASE ──
function flHTML() {
  const c = document.getElementById('flotilla-dashboard');
  if (!c) return;
  c.innerHTML = `
    <div class="fl-top">
      <div class="fl-top-title">${I.truck} Flotilla Vehicular</div>
      <span class="fl-top-role" id="fl-rol">—</span>
      <button class="fl-top-btn ghost" onclick="flVerSolicitudesGlobal()">${I.list} Todas las solicitudes</button>
      <button class="fl-top-btn primary" id="fl-btn-nueva" onclick="flAbrirModal()">${I.plus} Nueva solicitud</button>
    </div>
    <div class="fl-layout">
      <aside class="fl-side">
        <div class="fl-side-head">
          <div class="fl-side-search">
            <span class="fl-side-search-icon">${I.search}</span>
            <input type="text" id="fl-buscar" placeholder="Buscar unidad, placas…" oninput="flFiltrar(this.value)">
          </div>
        </div>
        <div class="fl-side-stats">
          <div class="fl-stat-pill" style="background:#ECFDF5">
            <div class="n" style="color:#059669" id="fl-n-act">—</div>
            <div class="l" style="color:#059669">Activos</div>
          </div>
          <div class="fl-stat-pill" style="background:#FFFBEB">
            <div class="n" style="color:#D97706" id="fl-n-tal">—</div>
            <div class="l" style="color:#D97706">En taller</div>
          </div>
        </div>
        <div class="fl-side-list">
          <div class="fl-vitem active" id="fl-home-btn" onclick="flHome()" style="margin-bottom:4px">
            <div class="fl-vitem-ico" style="background:#EEF2FF;color:#4F46E5">${I.grid}</div>
            <div><div class="fl-vitem-eco">Panel general</div><div class="fl-vitem-sub">Resumen · ${FL_CATALOGO.length} unidades</div></div>
          </div>
          <div class="fl-side-label">Vehículos</div>
          <div id="fl-lista"></div>
        </div>
      </aside>
      <main class="fl-main" id="fl-main">
        <div class="fl-main-inner"><div class="fl-loading"><div class="fl-spin"></div> Cargando…</div></div>
      </main>
    </div>`;
}

// ── HELPERS ──
const flBg  = s => s==='taller'?'#FFFBEB':s==='inactivo'?'#F3F4F6':'#ECFDF5';
const flClr = s => s==='taller'?'#D97706':s==='inactivo'?'#6B7280':'#059669';
const flEmo = t => t==='camion'?'🚛':t==='camioneta'?'🚙':'🚗';
const flIco = t => t==='camion'?I.truck:I.car;
const flDias= f => { if(!f||f==='—') return null; return Math.round((new Date(f)-new Date())/86400e3); };
const flDiasLbl = d => { if(d===null) return '—'; if(d<0) return `Vencido hace ${Math.abs(d)} días`; if(d===0) return 'Vence hoy'; if(d<90) return `Vence en ${d} días`; return 'Vigente'; };
const flDiasColor = d => { if(d===null||d>=90) return '#059669'; if(d<0) return '#DC2626'; return '#D97706'; };
const flFecha = iso => iso&&iso!=='—' ? String(iso).substring(0,10) : '—';
function flBadge(e) { const c=(e||'').replace(/[^a-zA-Z0-9]/g,''); return `<span class="fl-badge ${c}">${e||'—'}</span>`; }
const flRol = () => window.flGetRolActual ? window.flGetRolActual() : 'Usuario';
const flPuede = a => window.flTienePermiso ? window.flTienePermiso(a) : (a==='crear_solicitud');

// Gauge SVG de rendimiento de combustible
function flGauge(rendimiento) {
  const r = rendimiento && rendimiento !== '—' ? rendimiento : null;
  const val = r ? parseFloat(r) : 0;
  const max = 20; // km/l máximo referencia
  const pct = r ? Math.min(val/max, 1) : 0;
  const angle = -120 + pct * 240; // -120° a +120°
  const rad = (angle-90) * Math.PI/180;
  const cx=60, cy=60, radius=44;
  const nx = cx + radius * Math.cos(rad);
  const ny = cy + radius * Math.sin(rad);
  // Arco de fondo
  const color = pct < .35 ? '#EF4444' : pct < .6 ? '#F59E0B' : '#10B981';
  return `
    <div class="fl-gauge-wrap">
      <div class="fl-gauge-title">${I.fuel} Rendimiento combustible</div>
      <svg width="120" height="80" viewBox="0 0 120 80">
        <path d="M14,70 A46,46 0 0,1 106,70" fill="none" stroke="#F3F4F6" stroke-width="8" stroke-linecap="round"/>
        ${r ? `<path d="M14,70 A46,46 0 0,1 ${nx.toFixed(1)},${ny.toFixed(1)}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>` : ''}
        ${r ? `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="5" fill="${color}"/>` : ''}
        <text x="60" y="68" text-anchor="middle" font-size="14" font-weight="800" fill="#111110" font-family="DM Sans,sans-serif">${r ? val.toFixed(1) : '—'}</text>
        <text x="11" y="76" text-anchor="middle" font-size="8" fill="#9CA3AF" font-family="DM Sans,sans-serif">0</text>
        <text x="109" y="76" text-anchor="middle" font-size="8" fill="#9CA3AF" font-family="DM Sans,sans-serif">${max}</text>
      </svg>
      <div class="fl-gauge-val">${r ? r : 'Sin dato'}</div>
    </div>`;
}

// ── INICIALIZACIÓN ──
window.cargarFlotilla = async function () {
  flEstilos();
  flHTML();
  document.getElementById('fl-rol').textContent = flRol();
  document.getElementById('fl-btn-nueva').style.display = flPuede('crear_solicitud') ? '' : 'none';
  await Promise.all([flCargarVehiculos(), flCargarSolicitudes()]);
  flRenderHome();
};

// Cargar vehículos: Firestore + enriquecer con catálogo
async function flCargarVehiculos() {
  try {
    const snap = await fs.getDocs(fs.collection(db, COL_VEHS));
    if (snap.size > 0) {
      flVehiculos = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    } else {
      // Sin colección Firestore → usar catálogo como base
      flVehiculos = FL_CATALOGO.map(v => ({ id:`eco-${v.eco}`, status:'activo', km:0, ...v }));
    }
  } catch(e) {
    flVehiculos = FL_CATALOGO.map(v => ({ id:`eco-${v.eco}`, status:'activo', km:0, ...v }));
  }
  flRenderSidebar();
}

async function flCargarSolicitudes() {
  try {
    const snap = await fs.getDocs(fs.collection(db, COL_SOLS));
    flSolicitudes = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    flSolicitudes.sort((a,b) => (b.creadoEn||'').localeCompare(a.creadoEn||''));
  } catch(e) { flSolicitudes = []; }
}

// ── SIDEBAR ──
function flRenderSidebar() {
  const act = flVehiculos.filter(v=>v.status!=='taller'&&v.status!=='inactivo').length;
  const tal = flVehiculos.filter(v=>v.status==='taller').length;
  document.getElementById('fl-n-act').textContent = act;
  document.getElementById('fl-n-tal').textContent = tal;
  const lista = document.getElementById('fl-lista');
  if (!lista) return;
  const vehs = flVehiculos.filter(v => {
    if (!flBusqueda) return true;
    const q = flBusqueda.toLowerCase();
    return (v.eco||'').toLowerCase().includes(q) || (v.placas||'').toLowerCase().includes(q)
        || (v.unidad||'').toLowerCase().includes(q) || (v.responsable||'').toLowerCase().includes(q);
  });
  if (!vehs.length) { lista.innerHTML=`<div style="text-align:center;padding:16px;color:#6B7280;font-size:12px">${flVehiculos.length?'Sin resultados':'Sin vehículos'}</div>`; return; }
  lista.innerHTML = vehs.map(v => `
    <div class="fl-vitem ${flVehActivo===v.id?'active':''}" onclick="flSelVeh('${v.id}')">
      <div class="fl-vitem-ico" style="background:${flBg(v.status)};color:${flClr(v.status)}">${flIco(v.tipo)}</div>
      <div style="flex:1;min-width:0">
        <div class="fl-vitem-eco">${v.eco} · <span class="fl-placa">${v.placas}</span></div>
        <div class="fl-vitem-sub">${(v.unidad||'').substring(0,22)}</div>
      </div>
      <div class="fl-dot ${v.status==='taller'?'tal':v.status==='inactivo'?'off':'ok'}"></div>
    </div>`).join('');
}

window.flFiltrar = v => { flBusqueda=v; flRenderSidebar(); };

// ── HOME ──
window.flHome = function() {
  flVehActivo=null; flVistaActual='home';
  document.querySelectorAll('#flotilla-dashboard .fl-vitem').forEach(e=>e.classList.remove('active'));
  document.getElementById('fl-home-btn')?.classList.add('active');
  flRenderHome();
};

function flRenderHome() {
  const alertas=[];
  flVehiculos.forEach(v=>{
    const d=flDias(v.poliza_venc);
    if(d!==null&&d<90) alertas.push({nivel:d<0?'error':'warn',txt:`Unidad ${v.eco} — Póliza de seguro ${d<0?'VENCIDA':'por vencer el '+v.poliza_venc}`});
  });
  const activas=flSolicitudes.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus));
  const pA=flPuede('aprobar');
  document.getElementById('fl-main').innerHTML=`<div class="fl-main-inner">
    <div class="fl-page-title">Panel de Flotilla</div>
    <div class="fl-page-sub">Selecciona una unidad para ver su detalle completo.</div>
    ${alertas.length?`<div class="fl-alerts">${alertas.slice(0,5).map(a=>`<div class="fl-alert ${a.nivel}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}
    <div class="fl-kpis">
      <div class="fl-kpi"><div class="fl-kpi-l">Total flotilla</div><div class="fl-kpi-v">${flVehiculos.length}</div><div class="fl-kpi-s">unidades registradas</div></div>
      <div class="fl-kpi"><div class="fl-kpi-l">En operación</div><div class="fl-kpi-v" style="color:#059669">${flVehiculos.filter(v=>v.status==='activo'||!v.status||v.status==='').length}</div><div class="fl-kpi-s">activas</div></div>
      <div class="fl-kpi"><div class="fl-kpi-l">En taller</div><div class="fl-kpi-v" style="color:#D97706">${flVehiculos.filter(v=>v.status==='taller').length}</div><div class="fl-kpi-s">fuera de servicio</div></div>
      <div class="fl-kpi"><div class="fl-kpi-l">Solicitudes activas</div><div class="fl-kpi-v" style="color:#5B21B6">${activas.length}</div><div class="fl-kpi-s">${pA?'pendientes de aprobación':'en proceso'}</div></div>
    </div>
    <div class="fl-sec-title">Solicitudes recientes</div>
    ${flTabla(flSolicitudes.slice(0,20), pA)}
  </div>`;
}

// ── SELECCIONAR VEHÍCULO ──
window.flSelVeh = function(id) {
  flVehActivo=id; flTabActiva='info'; flVistaActual='detalle';
  document.querySelectorAll('#flotilla-dashboard .fl-vitem').forEach(e=>e.classList.remove('active'));
  document.getElementById('fl-home-btn')?.classList.remove('active');
  document.querySelector(`#fl-lista .fl-vitem[onclick="flSelVeh('${id}')"]`)?.classList.add('active');
  flDetalle();
};

// ── DETALLE ──
function flDetalle() {
  const v = flVehiculos.find(x=>x.id===flVehActivo);
  if(!v) return;
  const alertas=[];
  const d=flDias(v.poliza_venc);
  if(d!==null&&d<90) alertas.push({nivel:d<0?'error':'warn',txt:`Póliza de seguro ${d<0?'VENCIDA':'por vencer el '+v.poliza_venc}`});
  const pA=flPuede('aprobar');
  document.getElementById('fl-main').innerHTML=`<div class="fl-main-inner">
    <div class="fl-det-head">
      <div class="fl-det-ico" style="background:${flBg(v.status)}">${flEmo(v.tipo)}</div>
      <div style="flex:1">
        <div class="fl-det-eco">Unidad ${v.eco} &nbsp;·&nbsp; <span class="fl-placa">${v.placas}</span></div>
        <div style="font-size:14px;font-weight:600;color:#374151;margin-top:3px">${v.unidad||''}</div>
        <div class="fl-det-sub">
          <span>${I.pin} ${v.plaza||'—'}</span>
          <span>·</span>
          <span>👤 ${v.responsable||'Sin asignar'}</span>
          <span>·</span>
          <span>${v.km?v.km.toLocaleString()+' km':'—'}</span>
        </div>
      </div>
      <button class="fl-top-btn ghost" style="font-size:12px" onclick="flHome()">← Volver</button>
    </div>
    ${alertas.length?`<div class="fl-alerts" style="margin-bottom:16px">${alertas.map(a=>`<div class="fl-alert ${a.nivel}">${I.alert} ${a.txt}</div>`).join('')}</div>`:''}
    <div class="fl-tabs">
      <button class="fl-tab ${flTabActiva==='info'       ?'active':''}" onclick="flTab('info')">${I.info} Información</button>
      <button class="fl-tab ${flTabActiva==='docs'       ?'active':''}" onclick="flTab('docs')">${I.doc} Documentos</button>
      <button class="fl-tab ${flTabActiva==='historial'  ?'active':''}" onclick="flTab('historial')">${I.hist} Historial</button>
      <button class="fl-tab ${flTabActiva==='checklist'  ?'active':''}" onclick="flTab('checklist')">${I.clip} Inspección</button>
      <button class="fl-tab ${flTabActiva==='solicitudes'?'active':''}" onclick="flTab('solicitudes')">${I.wrench} Solicitudes</button>
    </div>
    <div id="fl-tab-c">
      ${flTabActiva==='info'        ? flTabInfo(v)             : ''}
      ${flTabActiva==='docs'        ? flTabDocs(v)             : ''}
      ${flTabActiva==='historial'   ? flTabHistorial(v)        : ''}
      ${flTabActiva==='checklist'   ? flTabChecklist(v)        : ''}
      ${flTabActiva==='solicitudes' ? flTabSolsVeh(v,pA)       : ''}
    </div>
  </div>`;

  // Eventos checklist
  if(flTabActiva==='checklist') flAttachChecklist();
}

window.flTab = t => { flTabActiva=t; flDetalle(); };

// ── TAB INFO ──
function flTabInfo(v) {
  return `
    <div style="display:grid;grid-template-columns:1fr 200px;gap:14px;align-items:start">
      <div class="fl-info-grid">
        <dl class="fl-info-cell"><dt>Número económico</dt><dd>${v.eco||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Placas</dt><dd class="mono">${v.placas||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Unidad</dt><dd>${v.unidad||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Año</dt><dd>${v.año||v.anio||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Número de serie</dt><dd class="mono" style="font-size:10.5px">${v.serie||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Plaza</dt><dd>${v.plaza||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Tipo</dt><dd style="text-transform:capitalize">${v.tipo||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Responsable</dt><dd>${v.responsable||'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Kilometraje</dt><dd>${v.km?v.km.toLocaleString()+' km':'—'}</dd></dl>
        <dl class="fl-info-cell"><dt>Estado</dt><dd>${flBadge(v.status||'activo')}</dd></dl>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${flGauge(v.rendimiento)}
        <div class="fl-poliza-card">
          <div class="fl-poliza-icon" style="background:${flDias(v.poliza_venc)===null||flDias(v.poliza_venc)>=90?'#ECFDF5':flDias(v.poliza_venc)<0?'#FEE2E2':'#FFFBEB'}">🛡️</div>
          <div>
            <div class="fl-poliza-label">Póliza seguro</div>
            <div class="fl-poliza-val">${v.poliza||'—'}</div>
            <div class="fl-poliza-dias" style="color:${flDiasColor(flDias(v.poliza_venc))}">${flFecha(v.poliza_venc)} · ${flDiasLbl(flDias(v.poliza_venc))}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── TAB DOCS ──
function flTabDocs(v) {
  const docs = [
    {n:'Póliza de seguro',d:v.poliza_venc,ico:'🛡️'},{n:'Verificación vehicular',d:null,ico:'✅'},
    {n:'Tarjeta de circulación',d:null,ico:'🪪'},{n:'Tenencia',d:null,ico:'🏛️'},{n:'Factura / Título',d:null,ico:'📑'},
  ];
  return `<div class="fl-tbl-wrap"><table class="fl-tbl"><thead><tr><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Archivo</th></tr></thead><tbody>${
    docs.map(d=>{const dias=flDias(d.d); const cls=dias===null?'gray':dias<0?'err':dias<90?'warn':'ok'; const txt=dias===null?'Sin fecha':dias<0?'Vencido':dias<90?'Por vencer':'Vigente'; return`<tr><td><span style="display:flex;align-items:center;gap:7px">${d.ico} ${d.n}</span></td><td><span class="mono" style="font-size:12px">${flFecha(d.d)}</span></td><td><span class="fl-badge ${cls}">${txt}</span></td><td><div class="fl-row"><button class="fl-pill">${I.doc} Ver</button><button class="fl-pill">${I.upload} Subir</button></div></td></tr>`;}).join('')
  }</tbody></table></div>`;
}

// ── TAB HISTORIAL ──
function flTabHistorial(v) {
  const hist=v.historial||[];
  if(!hist.length) return `<div class="fl-empty"><div class="fl-empty-ico">📋</div><h3>Sin historial</h3><p>No hay registros de mantenimiento o servicios.</p></div>`;
  const im={mantenimiento:'🔧',taller:'🏭',incidencia:'⚠️',servicio:'🔩'};
  const ib={mantenimiento:'#FEF3C7',taller:'#FEE2E2',incidencia:'#FEF3C7',servicio:'#EEF2FF'};
  return `<div class="fl-timeline">${hist.map(h=>`<div class="fl-tl-item"><div class="fl-tl-ico" style="background:${ib[h.tipo]||'#F3F4F6'}">${im[h.tipo]||'📋'}</div><div><div class="fl-tl-title">${h.titulo||'—'}</div><div class="fl-tl-meta">${h.fecha||''}${h.costo?' · '+h.costo:''}</div>${h.descripcion?`<div class="fl-tl-desc">${h.descripcion}</div>`:''}</div></div>`).join('')}</div>`;
}

// ── TAB CHECKLIST INSPECCIÓN VISUAL (estilo Kipup) ──
function flTabChecklist(v) {
  const secciones = [
    {key:'interiores', label:'Interiores',  items:FL_CHECKLIST.interiores},
    {key:'motor',      label:'Motor',       items:FL_CHECKLIST.motor},
    {key:'exteriores', label:'Exteriores',  items:FL_CHECKLIST.exteriores},
    {key:'cajuela',    label:'Cajuela',     items:FL_CHECKLIST.cajuela},
  ];
  return `
    <div style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:13px;font-weight:700">Inspección visual · Unidad ${v.eco}</div>
        <div style="font-size:11.5px;color:#6B7280;margin-top:2px">Marca Sí / No en cada elemento. Taller: LUKA SERVICE CENTER</div>
      </div>
      <button class="fl-btn dark" onclick="flGuardarChecklist('${v.id}')">${I.check} Guardar inspección</button>
    </div>
    <div class="fl-chk-grid">
      ${secciones.map(sec=>`
        <div class="fl-chk-section">
          <div class="fl-chk-head">${sec.label}</div>
          ${sec.items.map((item,i)=>`
            <div class="fl-chk-item">
              <label style="flex:1;font-size:12px">${item}</label>
              <div style="display:flex;align-items:center;gap:4px">
                <span class="fl-chk-label-si">Sí</span>
                <div class="fl-chk-si" data-sec="${sec.key}" data-i="${i}" data-val="si" onclick="flChkToggle(this,'si')"></div>
                <div class="fl-chk-no" data-sec="${sec.key}" data-i="${i}" data-val="no" onclick="flChkToggle(this,'no')"></div>
                <span class="fl-chk-label-no">No</span>
              </div>
            </div>`).join('')}
        </div>`).join('')}
    </div>
    <div style="margin-top:14px">
      <div class="fl-field"><label>Comentarios adicionales</label><textarea id="fl-chk-comentarios" placeholder="Observaciones de la inspección…" style="min-height:70px;margin-top:4px;padding:10px;border:1.5px solid #E5E7EB;border-radius:8px;font-family:inherit;font-size:13px;width:100%;outline:none;background:#F9FAFB"></textarea></div>
    </div>`;
}

function flAttachChecklist() {
  // Los eventos ya están inline con onclick
}

window.flChkToggle = function(el, val) {
  const sec = el.dataset.sec;
  const i   = el.dataset.i;
  const siEl = document.querySelector(`.fl-chk-si[data-sec="${sec}"][data-i="${i}"]`);
  const noEl = document.querySelector(`.fl-chk-no[data-sec="${sec}"][data-i="${i}"]`);
  if (!siEl || !noEl) return;
  siEl.classList.remove('selected'); siEl.innerHTML='';
  noEl.classList.remove('selected'); noEl.innerHTML='';
  el.classList.add('selected');
  el.innerHTML = val==='si' ? '✓' : '✗';
};

window.flGuardarChecklist = async function(id) {
  const resultado = {};
  ['interiores','motor','exteriores','cajuela'].forEach(sec=>{
    resultado[sec]={};
    FL_CHECKLIST[sec].forEach((item,i)=>{
      const siEl=document.querySelector(`.fl-chk-si[data-sec="${sec}"][data-i="${i}"]`);
      const noEl=document.querySelector(`.fl-chk-no[data-sec="${sec}"][data-i="${i}"]`);
      resultado[sec][item]=siEl?.classList.contains('selected')?'si':noEl?.classList.contains('selected')?'no':'—';
    });
  });
  resultado.comentarios = document.getElementById('fl-chk-comentarios')?.value||'';
  resultado.fecha = new Date().toISOString();
  resultado.vehiculoId = id;
  resultado.realizadoPor = window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Usuario';
  try {
    await fs.addDoc(fs.collection(db,'flotilla_inspecciones'), resultado);
    if(window.mostrarPush) window.mostrarPush('✅ Inspección guardada','','✓');
    else alert('Inspección guardada correctamente.');
  } catch(e) { console.error(e); alert('Error al guardar inspección.'); }
};

// ── TAB SOLICITUDES DEL VEHÍCULO ──
function flTabSolsVeh(v, pA) {
  const sols=flSolicitudes.filter(s=>s.vehiculoId===v.id||(s.vehiculoEco||'')===v.eco||(s.vehiculo||'').includes(v.eco));
  if(!sols.length) return `<div class="fl-empty"><div class="fl-empty-ico">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes para esta unidad.</p></div>`;
  return flTabla(sols,pA);
}

// ── VER TODAS LAS SOLICITUDES ──
window.flVerSolicitudesGlobal = function() {
  flVehActivo=null; flVistaActual='solicitudes';
  document.querySelectorAll('#flotilla-dashboard .fl-vitem').forEach(e=>e.classList.remove('active'));
  document.getElementById('fl-home-btn')?.classList.remove('active');
  const pA=flPuede('aprobar');
  document.getElementById('fl-main').innerHTML=`<div class="fl-main-inner">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div><div class="fl-page-title">Todas las solicitudes</div><div class="fl-page-sub">${flSolicitudes.length} registros</div></div>
      <button class="fl-top-btn ghost" style="font-size:12px" onclick="flHome()">← Panel general</button>
    </div>
    ${flTabla(flSolicitudes,pA)}
  </div>`;
};

// ── TABLA SOLICITUDES ──
function flTabla(sols, pA) {
  if(!sols.length) return `<div class="fl-empty"><div class="fl-empty-ico">📋</div><h3>Sin solicitudes</h3><p>No hay solicitudes registradas.</p></div>`;
  return `<div class="fl-tbl-wrap"><table class="fl-tbl"><thead><tr>
    <th>Tipo</th><th>Unidad</th><th>Solicitante</th><th>Cotización</th><th>Estado</th><th>Fecha</th>${pA?'<th>Acción</th>':''}
  </tr></thead><tbody>${sols.map(s=>`
    <tr onclick="flVerSol('${s.id}')">
      <td><strong>${s.tipo||'—'}</strong></td>
      <td><span class="mono">${s.vehiculoEco||s.vehiculo||'—'}</span></td>
      <td style="font-size:12px">${s.solicitante||s.creadoPor||'—'}</td>
      <td style="font-weight:700">${s.cotizacion||'—'}</td>
      <td>${flBadge(s.estatus)}</td>
      <td style="font-size:11.5px;color:#6B7280">${flFecha(s.creadoEn||s.fecha||'')}</td>
      ${pA?`<td onclick="event.stopPropagation()">${(s.estatus==='Validada'||s.estatus==='Cotización')?`<div class="fl-row"><button class="fl-btn green" onclick="flAprobar('${s.id}')">${I.check} Aprobar</button><button class="fl-btn red" onclick="flRechazar('${s.id}')">${I.x} Rechazar</button></div>`:'—'}</td>`:''}
    </tr>`).join('')}</tbody></table></div>`;
}

// ── VER SOLICITUD (modal) ──
window.flVerSol = function(id) {
  const s=flSolicitudes.find(x=>x.id===id); if(!s) return;
  const pA=flPuede('aprobar'), pV=flPuede('validar'), pC=flPuede('subir_cotizacion'), pE=flPuede('eliminar');
  const ov=document.createElement('div'); ov.className='fl-overlay';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-modal-head"><h3>Solicitud #${id.substring(0,6).toUpperCase()}</h3><button class="fl-modal-x" onclick="this.closest('.fl-overlay').remove()">✕</button></div>
    <div class="fl-modal-body">
      <div class="fl-sol-grid">
        <dl class="fl-sol-cell"><dt>Tipo</dt><dd>${s.tipo||'—'}</dd></dl>
        <dl class="fl-sol-cell"><dt>Estado</dt><dd>${flBadge(s.estatus)}</dd></dl>
        <dl class="fl-sol-cell"><dt>Unidad</dt><dd>${s.vehiculoEco||s.vehiculo||'—'}</dd></dl>
        <dl class="fl-sol-cell"><dt>Cotización</dt><dd style="font-weight:800">${s.cotizacion||'—'}</dd></dl>
        <dl class="fl-sol-cell"><dt>Taller</dt><dd>${s.taller||'—'}</dd></dl>
        <dl class="fl-sol-cell"><dt>Solicitante</dt><dd>${s.solicitante||s.creadoPor||'—'}</dd></dl>
        <dl class="fl-sol-cell full"><dt>Descripción</dt><dd>${s.descripcion||'—'}</dd></dl>
      </div>
      ${s.comentarioRechazo?`<div class="fl-sep"></div><div style="background:#FEF2F2;border-radius:8px;padding:10px 13px;font-size:12.5px;color:#991B1B;border:1px solid #FECACA"><strong>Motivo de rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
      ${s.evidencias?.length?`<div class="fl-sep"></div><div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#6B7280;margin-bottom:6px">Evidencias (${s.evidencias.length})</div><div class="fl-pills">${s.evidencias.map((e,i)=>`<button class="fl-pill" onclick="flVerImg('${e}')">${I.doc} Foto ${i+1}</button>`).join('')}</div>`:''}
      <div class="fl-sep"></div>
      <div class="fl-row">
        ${pV&&s.estatus==='Solicitud'?`<button class="fl-btn green" onclick="flEstatus('${s.id}','Validada');this.closest('.fl-overlay').remove()">${I.check} Validar</button>`:''}
        ${(pC||pV)&&s.estatus==='Validada'?`<button class="fl-btn neutral" onclick="flCotizar('${s.id}')">Registrar cotización</button>`:''}
        ${pA&&(s.estatus==='Validada'||s.estatus==='Cotización')?`<button class="fl-btn green" onclick="flAprobar('${s.id}');this.closest('.fl-overlay').remove()">${I.check} Aprobar</button><button class="fl-btn red" onclick="flRechazar('${s.id}');this.closest('.fl-overlay').remove()">${I.x} Rechazar</button>`:''}
        ${pV&&s.estatus==='Aprobada'?`<button class="fl-btn neutral" onclick="flEstatus('${s.id}','Cierre');this.closest('.fl-overlay').remove()">Enviar a cierre</button>`:''}
        ${pV&&s.estatus==='Cierre'?`<button class="fl-btn neutral" onclick="flEstatus('${s.id}','Cerrada');this.closest('.fl-overlay').remove()">Marcar cerrada</button>`:''}
        ${pE?`<button class="fl-btn red" onclick="flEliminar('${s.id}');this.closest('.fl-overlay').remove()" style="margin-left:auto">Eliminar</button>`:''}
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
};

// ── MODAL NUEVA SOLICITUD ──
window.flAbrirModal = function(editId=null) {
  const s=editId?flSolicitudes.find(x=>x.id===editId):null;
  flFotosBase64=[];

  // Detectar vehículo asignado al usuario actual
  const emailActual = window.auth?.currentUser?.email||'';
  const nombreActual= window.auth?.currentUser?.displayName||'';
  const vehAsignado = flVehiculos.find(v=>{
    const resp=(v.responsable||'').toLowerCase();
    return resp && resp!=='—' && (
      (emailActual && resp.includes(emailActual.split('@')[0].toLowerCase())) ||
      (nombreActual && resp.includes(nombreActual.split(' ')[0].toLowerCase()))
    );
  });

  const ov=document.createElement('div'); ov.className='fl-overlay';
  ov.innerHTML=`<div class="fl-modal">
    <div class="fl-modal-head">
      <h3>${s?'Editar solicitud':'Nueva solicitud'}</h3>
      <button class="fl-modal-x" onclick="this.closest('.fl-overlay').remove()">✕</button>
    </div>
    <div class="fl-modal-body">
      <div class="fl-form" id="fl-form-s">

        <div class="fl-field">
          <label>Tipo de solicitud *</label>
          <select name="tipo" required>
            <option value="">Seleccionar…</option>
            ${['Mantenimiento preventivo','Mantenimiento correctivo','Reposición de llanta','Falla eléctrica','Seguro — Reporte de accidente','Revisión de documentos','Otro'].map(o=>`<option ${s?.tipo===o?'selected':''}>${o}</option>`).join('')}
          </select>
        </div>

        <div class="fl-field">
          <label>Unidad *</label>
          ${vehAsignado && !s ? `
            <div class="fl-field-assigned">
              🚗 Unidad ${vehAsignado.eco} · ${vehAsignado.placas} — ${vehAsignado.unidad}
            </div>
            <input type="hidden" name="vehiculoId" value="${vehAsignado.id}">
            <input type="hidden" name="vehiculoEco" value="${vehAsignado.eco}">
            <input type="hidden" name="vehiculoLabel" value="Unidad ${vehAsignado.eco} · ${vehAsignado.placas} — ${vehAsignado.unidad}">
          ` : `
            <select name="vehiculoId" required>
              <option value="">Seleccionar vehículo…</option>
              ${flVehiculos.map(v=>`<option value="${v.id}" data-eco="${v.eco}" data-label="Unidad ${v.eco} · ${v.placas} — ${v.unidad}" ${s?.vehiculoId===v.id?'selected':''}>
                ${v.eco} · ${v.placas} — ${v.unidad}
              </option>`).join('')}
            </select>
          `}
        </div>

        <div class="fl-form-row">
          <div class="fl-field"><label>Taller / Proveedor</label><input name="taller" value="${s?.taller||''}" placeholder="Nombre del taller…"></div>
          <div class="fl-field"><label>Cotización estimada</label><input name="cotizacion" value="${s?.cotizacion||''}" placeholder="$0.00"></div>
        </div>

        <div class="fl-field">
          <label>Descripción del problema *</label>
          <textarea name="descripcion" placeholder="Describe la falla o necesidad con detalle…" required>${s?.descripcion||''}</textarea>
        </div>

        ${!s?`
        <div class="fl-field">
          <label>Evidencias (fotos)</label>
          <div class="fl-upload" onclick="document.getElementById('fl-fotos-i').click()">${I.upload} Seleccionar imágenes</div>
          <input type="file" id="fl-fotos-i" accept="image/*" multiple style="display:none" onchange="flPrevFotos(this)">
          <div id="fl-fotos-p" class="fl-pills"></div>
          <div class="fl-field-note">Máx. ~1MB por imagen. Se guardan en Firestore.</div>
        </div>`:''}

        <div class="fl-form-actions">
          <button type="button" class="fl-top-btn ghost" onclick="this.closest('.fl-overlay').remove()">Cancelar</button>
          <button type="button" class="fl-top-btn primary" id="fl-btn-save" onclick="flGuardar('${editId||''}')">${s?'Guardar cambios':'Enviar solicitud'}</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
};

// ── PREVIEW FOTOS ──
window.flPrevFotos = function(input) {
  flFotosBase64=[];
  const p=document.getElementById('fl-fotos-p'); if(!p) return;
  p.innerHTML='';
  Array.from(input.files).forEach(f=>{
    const r=new FileReader();
    r.onload=e=>{ flFotosBase64.push(e.target.result); const pill=document.createElement('span'); pill.className='fl-pill'; pill.textContent=f.name.substring(0,18); p.appendChild(pill); };
    r.readAsDataURL(f);
  });
};

// ── GUARDAR SOLICITUD ──
window.flGuardar = async function(editId) {
  const form=document.getElementById('fl-form-s'); if(!form) return;
  const get=n=>form.querySelector(`[name="${n}"]`)?.value?.trim()||'';
  const tipo=get('tipo'), vid=get('vehiculoId'), desc=get('descripcion');
  if(!tipo||!vid||!desc){ alert('Completa tipo, vehículo y descripción.'); return; }

  const veh=flVehiculos.find(v=>v.id===vid);
  // Obtener eco y label
  const eco  = get('vehiculoEco') || (form.querySelector(`[name="vehiculoId"] option:checked`)?.dataset?.eco) || veh?.eco || '';
  const label= get('vehiculoLabel') || (form.querySelector(`[name="vehiculoId"] option:checked`)?.dataset?.label) || (veh?`Unidad ${veh.eco} · ${veh.placas} — ${veh.unidad}`:'');

  const btn=document.getElementById('fl-btn-save');
  if(btn){ btn.disabled=true; btn.textContent='Guardando…'; }

  const data={
    tipo, vehiculoId:vid, vehiculoEco:eco, vehiculo:label,
    taller:get('taller'), cotizacion:get('cotizacion'), descripcion:desc,
    solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Usuario',
    creadoPor:window.auth?.currentUser?.email||'',
    actualizadoEn:new Date().toISOString(),
  };
  try {
    if(editId){
      await fs.updateDoc(fs.doc(db,COL_SOLS,editId),data);
    } else {
      data.estatus='Solicitud'; data.creadoEn=new Date().toISOString();
      const ref=await fs.addDoc(fs.collection(db,COL_SOLS),data);
      if(flFotosBase64.length) await fs.updateDoc(fs.doc(db,COL_SOLS,ref.id),{evidencias:flFotosBase64});
    }
    document.querySelector('.fl-overlay')?.remove();
    await flCargarSolicitudes();
    flRefresh();
    if(window.mostrarPush) window.mostrarPush('✅ Solicitud enviada','','✓');
  } catch(e){ console.error(e); alert('Error al guardar.'); if(btn){btn.disabled=false;btn.textContent='Enviar solicitud';} }
};

// ── ACCIONES ──
window.flEstatus = async(id,est)=>{ try{ await fs.updateDoc(fs.doc(db,COL_SOLS,id),{estatus:est,actualizadoEn:new Date().toISOString()}); await flCargarSolicitudes(); flRefresh(); }catch(e){console.error(e);} };
window.flAprobar = id=>flEstatus(id,'Aprobada');
window.flRechazar= async id=>{ const m=prompt('Motivo del rechazo:'); if(m===null) return; try{ await fs.updateDoc(fs.doc(db,COL_SOLS,id),{estatus:'Rechazada',comentarioRechazo:m,actualizadoEn:new Date().toISOString()}); await flCargarSolicitudes(); flRefresh(); }catch(e){console.error(e);} };
window.flEliminar= async id=>{ if(!confirm('¿Eliminar solicitud? No se puede deshacer.')) return; try{ await fs.deleteDoc(fs.doc(db,COL_SOLS,id)); await flCargarSolicitudes(); flRefresh(); }catch(e){console.error(e);} };
window.flCotizar = id=>{ const s=flSolicitudes.find(x=>x.id===id); const m=prompt('Monto:',s?.cotizacion||''); if(m===null) return; const t=prompt('Taller:',s?.taller||''); if(t===null) return; fs.updateDoc(fs.doc(db,COL_SOLS,id),{cotizacion:m,taller:t,estatus:'Cotización',actualizadoEn:new Date().toISOString()}).then(async()=>{ await flCargarSolicitudes(); document.querySelector('.fl-overlay')?.remove(); flRefresh(); }); };
window.flVerImg  = src=>{ const ov=document.createElement('div'); ov.className='fl-overlay'; ov.style.cursor='zoom-out'; ov.innerHTML=`<img src="${src}" style="max-width:90%;max-height:90%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.4)">`; ov.onclick=()=>ov.remove(); document.body.appendChild(ov); };

function flRefresh(){
  if(flVistaActual==='home')         flRenderHome();
  else if(flVistaActual==='detalle') flDetalle();
  else                               flVerSolicitudesGlobal();
}

console.log('[FLOTILLA v5] Módulo cargado — '+FL_CATALOGO.length+' unidades en catálogo');
})();
