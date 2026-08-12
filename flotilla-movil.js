// ══════════════════════════════════════════════════════════════
// flotilla-movil.js — App móvil técnicos Tecnocontrol
// Peso: ~40KB · Sin imágenes base64 · Offline ready
// Vistas: Mi Vehículo · Nueva Solicitud · Mis Tareas · Notificaciones
// ══════════════════════════════════════════════════════════════
(function(){
'use strict';

// ── CATÁLOGO LOCAL (49 vehículos) ──
window.CAT_FL=[
  {eco:'01',unidad:'NISSAN NP100',     año:2000,plaza:'CHIHUAHUA',    responsable:'GLEN PRECIADO',   placas:'DU0101A',serie:'3N6AD33A3H46544',rend:'7 KM/L',   pv:'2026-09-24',pol:'794B05035M-17',tipo:'auto',color:'Blanco',nip:'OXXO GAS',km:0,status:'activo'},
  {eco:'15',unidad:'NISSAN NP300',     año:2017,plaza:'JUAREZ',    responsable:'JORGE GUERRERO',   placas:'DU6478A',serie:'3N6AD33A3HK869708',rend:'7 KM/L',   pv:'2026-09-24',pol:'794B05035M-17',tipo:'camioneta',color:'Blanco',nip:'OXXO GAS',km:0,status:'activo'},
  {eco:'16',unidad:'GRUA F-350',       año:2010,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6497A',serie:'1FDEF3G59AEB23674', rend:'5 KM/L',   pv:'2026-09-24',pol:'794B05035M-10',tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'17',unidad:'MARCH ACTIVE',     año:2017,plaza:'CHIHUAHUA', responsable:'GUILLERMO',        placas:'EMB313A',serie:'3N1CK3CD5HL248558', rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-23',tipo:'auto',     color:'Blanco',nip:'1713',km:0,status:'activo'},
  {eco:'19',unidad:'RAM 700',          año:2017,plaza:'CHIHUAHUA', responsable:'ROBERTO MUÑOZ',    placas:'DU6471A',serie:'9BD578458HY162606', rend:'—',        pv:'2026-09-24',pol:'794B05035M-20',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'21',unidad:'RAM 700',          año:2018,plaza:'JUAREZ',    responsable:'BENITO SOTO',      placas:'DU6470A',serie:'9BD578452JY210560', rend:'—',        pv:'2026-09-24',pol:'794B05035M-12',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'22',unidad:'RAM 700',          año:2018,plaza:'CHIHUAHUA', responsable:'CHIHUAHUA',        placas:'DU6751A',serie:'9BD578456JY208715', rend:'9 KM/L',   pv:'2026-09-24',pol:'794B05035M-13',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'23',unidad:'RAM 700',          año:2018,plaza:'CHIHUAHUA', responsable:'SERGIO CARMONA',   placas:'DU6752A',serie:'9BD578454JY209023', rend:'—',        pv:'2026-09-24',pol:'794B05035M-14',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'26',unidad:'SEAT IBIZA',       año:2018,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EMB314A',serie:'VSBB2KJ1JR017261',  rend:'13 KM/L',  pv:'2026-09-24',pol:'794B05035M-19',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'31',unidad:'NP300 KANGOO',     año:2012,plaza:'CHIHUAHUA', responsable:'DESARROLLOS',      placas:'DU6754A',serie:'3N6DD25T5CK018279', rend:'8 KM/L',   pv:'2026-09-24',pol:'794B05035M-6', tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'35',unidad:'ISUZU',            año:2019,plaza:'CHIHUAHUA', responsable:'ALMACEN',          placas:'DU6495A',serie:'JAANPR755K7000178', rend:'3.5 KM/L', pv:'2026-09-24',pol:'794B05035M-9', tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'36',unidad:'CAMION NISSAN CS', año:2014,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6494A',serie:'3N6DD25T9EK019471', rend:'8 KM/L',   pv:'2026-09-24',pol:'794B05035M-18',tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'37',unidad:'RAM 700',          año:2019,plaza:'JUAREZ',    responsable:'JUAREZ',           placas:'DU6493A',serie:'9BD578458KY323611', rend:'—',        pv:'2026-09-24',pol:'794B05035M-21',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'38',unidad:'RAM 700',          año:2019,plaza:'CHIHUAHUA', responsable:'DIONICIO',         placas:'DU6492A',serie:'9BD578455KY324652', rend:'—',        pv:'2026-09-24',pol:'794B05035M-22',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'39',unidad:'L200',             año:2019,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'DU6491A',serie:'MMBL45G1KH043444',  rend:'10 KM/L',  pv:'2026-09-24',pol:'794B05035M-30',tipo:'camioneta',color:'Blanco',nip:'1339',km:0,status:'activo'},
  {eco:'40',unidad:'MARCH ACTIVE',     año:2019,plaza:'MONTERREY', responsable:'IVAN SEPULVEDA',   placas:'DU6490A',serie:'3N6CK34N2KL230477', rend:'10.5 KM/L',pv:'2026-09-24',pol:'794B05035M-2', tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'43',unidad:'F-150 PICK-UP',    año:2012,plaza:'CHIHUAHUA', responsable:'—',                placas:'DU6488A',serie:'1FTMF1CM1CKD41243', rend:'5.6 KM/L', pv:'2026-09-24',pol:'794B05035M-5', tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'47',unidad:'MARCH ACTIVE L4',  año:2019,plaza:'CHIHUAHUA', responsable:'IDALY RUIZ',       placas:'EMB308A',serie:'3N1CK3CD5KL232108', rend:'—',        pv:'2026-09-24',pol:'794B05035M-24',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'48',unidad:'MARCH ACTIVE L4',  año:2019,plaza:'CHIHUAHUA', responsable:'IVAN ARGENIS',     placas:'EMB309A',serie:'3N1CK3CD4KL232066', rend:'—',        pv:'2026-09-24',pol:'794B05035M-8', tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'50',unidad:'FIESTA',           año:2018,plaza:'MONTERREY', responsable:'IRVING SAUCEDO',   placas:'EMB310A',serie:'3FADP4BJ1JM128469', rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-11',tipo:'auto',     color:'Plata', nip:'',km:0,status:'activo'},
  {eco:'52',unidad:'MARCH',            año:2020,plaza:'MONTERREY', responsable:'MONTERREY',        placas:'DU6486A',serie:'3N6CK34N3LL243692', rend:'—',        pv:'2026-09-24',pol:'794B05035M-26',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'54',unidad:'RAM 700 SLT',      año:2020,plaza:'CHIHUAHUA', responsable:'RICARDO GONZALEZ', placas:'DU6485A',serie:'9BD578452LY411572', rend:'17.5 KM/L',pv:'2026-09-24',pol:'794B05035M-33',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'55',unidad:'MARCH',            año:2020,plaza:'MONTERREY', responsable:'ROQUE LEAL',       placas:'DU6484A',serie:'3N6CK34N3LL248469', rend:'11.7 KM/L',pv:'2026-09-24',pol:'794B05035M-27',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'56',unidad:'RAM 700 SLT',      año:2020,plaza:'PARRAL',    responsable:'PLAZA PARRAL',     placas:'DU6483A',serie:'9BD578451LY423955', rend:'14.5 KM/L',pv:'2026-09-24',pol:'794B05035M-34',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'58',unidad:'RAM 700',          año:2021,plaza:'CHIHUAHUA', responsable:'ISMAEL BARRAZA',   placas:'DU6482A',serie:'9BD281G50MYV59661', rend:'12.7 KM/L',pv:'2026-09-24',pol:'794B05035M-35',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'59',unidad:'RAM 700',          año:2021,plaza:'CHIHUAHUA', responsable:'ALAN ESTRADA',     placas:'DU6481A',serie:'9BD281G56MYV59423', rend:'13.5 KM/L',pv:'2026-09-24',pol:'794B05035M-36',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'60',unidad:'MARCH',            año:2020,plaza:'CAMARGO',   responsable:'RAMON HERNANDEZ',  placas:'DU6480A',serie:'3N6CK34N9LL254065', rend:'11.6 KM/L',pv:'2026-09-24',pol:'794B05035M-28',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'61',unidad:'MARCH',            año:2020,plaza:'PARRAL',    responsable:'RICARDO MORIEL',   placas:'DU6479A',serie:'3N6CK34N2LL254229', rend:'13.9 KM/L',pv:'2026-09-24',pol:'794B05035M-29',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'62',unidad:'NP300',            año:2019,plaza:'MONTERREY', responsable:'JULIO DE LA CRUZ', placas:'DU6472A',serie:'3N6AD33A1KK838707', rend:'7.5 KM/L', pv:'2026-09-24',pol:'794B05035M-31',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'63',unidad:'SILVERADO 1500',   año:2013,plaza:'CHIHUAHUA', responsable:'BODEGA',           placas:'DU6473A',serie:'3GCNC9CX6DG343777', rend:'5.5 KM/L', pv:'2026-09-24',pol:'794B05035M-25',tipo:'camioneta',color:'Plata', nip:'',km:0,status:'activo'},
  {eco:'64',unidad:'MARCH ACTIVE',     año:2017,plaza:'CHIHUAHUA', responsable:'VERONICA GARCIA',  placas:'DU6474A',serie:'3N6CK34N4HL242297', rend:'10.6 KM/L',pv:'2026-09-24',pol:'794B05035M-32',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'66',unidad:'AVEO',             año:2018,plaza:'CHIHUAHUA', responsable:'CARMEN HERNANDEZ', placas:'EMB311A',serie:'LSGHD52H6JD239610', rend:'11.3 KM/L',pv:'2026-09-24',pol:'794B05035M-37',tipo:'auto',     color:'Gris',  nip:'',km:0,status:'activo'},
  {eco:'69',unidad:'NISSAN NP300',     año:2017,plaza:'CHIHUAHUA', responsable:'LUIS LOPEZ',       placas:'DU6499A',serie:'3N6AD33A6HK837318', rend:'—',        pv:'2026-09-24',pol:'794B05035M-38',tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'71',unidad:'YUKON',            año:2023,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DYY416B',serie:'1GKS28KL1PR236241', rend:'—',        pv:'—',         pol:'—',            tipo:'camioneta',color:'Negro', nip:'',km:0,status:'activo'},
  {eco:'72',unidad:'RAM RAPID',        año:2023,plaza:'CHIHUAHUA', responsable:'JORGE URIBE',      placas:'DG7445B',serie:'9BD2657RIP9233026',  rend:'14 KM/L',  pv:'—',         pol:'—',            tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'73',unidad:'DODGE ATTITUDE',   año:2023,plaza:'CHIHUAHUA', responsable:'DENISSE GUTIERREZ',placas:'MKL325A',serie:'ML3ABT6J4PH004521', rend:'—',        pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'74',unidad:'DODGE ATTITUDE',   año:2023,plaza:'CHIHUAHUA', responsable:'FATIMA SAUZAMEDA', placas:'MKL317A',serie:'ML3ABT6J4PH004552', rend:'15.8 KM/L',pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'75',unidad:'AVEO',             año:2019,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DUJ454B',serie:'LSGHD52H8KD130423', rend:'—',        pv:'2027-02-14',pol:'29113016152002',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'76',unidad:'NISSAN VERSA',     año:2024,plaza:'MONTERREY', responsable:'LUIS GARZA',       placas:'ESU908B',serie:'3N1CN7AE7RK398169', rend:'16 KM/L',  pv:'—',         pol:'—',            tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'77',unidad:'BMW X6',           año:2025,plaza:'CHIHUAHUA', responsable:'MARTIN DE LA O',   placas:'EKM897B',serie:'WBA41EX06S9W75509', rend:'—',        pv:'—',         pol:'—',            tipo:'auto',     color:'Negro', nip:'',km:0,status:'activo'},
  {eco:'79',unidad:'CHANGAN HUNTER',   año:2025,plaza:'CHIHUAHUA', responsable:'SERGIO MENDOZA',   placas:'337217', serie:'LSCBBZ2A1SG803364', rend:'—',        pv:'2029-02-27',pol:'4056350008',    tipo:'camioneta',color:'Blanco',nip:'7925',km:0,status:'activo'},
  {eco:'80',unidad:'CHANGAN HUNTER',   año:2025,plaza:'CHIHUAHUA', responsable:'ULISES NUÑEZ',     placas:'337218', serie:'LSCBBZ2A3SG803365', rend:'—',        pv:'2029-02-27',pol:'4056347985',    tipo:'camioneta',color:'Blanco',nip:'8025',km:0,status:'activo'},
  {eco:'81',unidad:'CHANGAN HUNTER',   año:2025,plaza:'DESARROLLOS',responsable:'LUIS LOPEZ',      placas:'337219', serie:'LSCBB72A8SG803376', rend:'—',        pv:'2029-02-27',pol:'4056350016',    tipo:'camioneta',color:'Blanco',nip:'8125',km:0,status:'activo'},
  {eco:'82',unidad:'VAN DONGFENG',     año:2026,plaza:'CHIHUAHUA', responsable:'TOMAS',            placas:'DZ9769B',serie:'LGFP541E6TA603994',  rend:'—',        pv:'2029-03-17',pol:'4056530506',    tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'83',unidad:'CHASIS DONGFENG',  año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9767B',serie:'LGDND41EXSA202059',  rend:'—',        pv:'2029-03-17',pol:'4056530481',    tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'84',unidad:'CHASIS DONGFENG',  año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9766B',serie:'LGDND41E6SA202057',  rend:'—',        pv:'2029-03-17',pol:'4056530495',    tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'85',unidad:'PICKUP DONGFENG',  año:2025,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9768B',serie:'LGDCMA1L5SA204421',  rend:'—',        pv:'2029-03-20',pol:'3200970801',    tipo:'camioneta',color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'86',unidad:'CAMION VOLVO VNM', año:2006,plaza:'CHIHUAHUA', responsable:'—',               placas:'FV8403D',serie:'4V4MC9GF36N405891',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'87',unidad:'CASCADIA FREIGHTLINER',año:2010,plaza:'CHIHUAHUA',responsable:'—',             placas:'FV8404D',serie:'1FUJGEDR3ASAV2763',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'88',unidad:'REMOLQUE GR TRAILERS',año:2025,plaza:'CHIHUAHUA',responsable:'—',              placas:'7CF406A',serie:'3BZFP2026SC007714',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'89',unidad:'REMOLQUE GR TRAILERS',año:2026,plaza:'CHIHUAHUA',responsable:'—',              placas:'7CF407A',serie:'3BZBN1427TC001477',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'90',unidad:'CHANGAN STAR',     año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9853B',serie:'LSCAB12E7TG800860',  rend:'—',        pv:'2026-11-01',pol:'1950290311',    tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'91',unidad:'CHANGAN STAR DC',  año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9855B',serie:'LSCAB22E6TG800256',  rend:'—',        pv:'2026-11-01',pol:'1950290357',    tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'92',unidad:'CHANGAN STAR DC',  año:2026,plaza:'CHIHUAHUA', responsable:'—',                placas:'DZ9854B',serie:'LSCAB22E5TG800295',  rend:'—',        pv:'2026-11-01',pol:'1950290361',    tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'32',unidad:'REMOLQUE CAMA BAJA',año:2013,plaza:'CHIHUAHUA',responsable:'—',               placas:'5CA683A',serie:'3BZBN1621DC000632',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Rojo',  nip:'',km:0,status:'activo'},
  {eco:'45',unidad:'REMOLQUE CAJA SECA',año:2018,plaza:'MONTERREY',responsable:'—',               placas:'5CA686A',serie:'3BZES1014JC010105',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'46',unidad:'COMPRESOR DE AIRE REMOLCABLE',año:2011,plaza:'CHIHUAHUA',responsable:'—',     placas:'5CA685A',serie:'4500A1012BR037356',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Negro', nip:'',km:0,status:'activo'},
  {eco:'53',unidad:'REMOLQUE CAJA SECA',año:2020,plaza:'CHIHUAHUA',responsable:'—',               placas:'5CA684A',serie:'3BZES1015LC003795',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'67',unidad:'REMOLQUE DOLLY',  año:2021,plaza:'CHIHUAHUA', responsable:'—',                placas:'5CA681A',serie:'REM21V0976467',     rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Azul',  nip:'',km:0,status:'activo'},
  {eco:'70',unidad:'REMOLQUE CAJA SECA',año:2019,plaza:'MONTERREY',responsable:'—',               placas:'5CD149A',serie:'3BZES1623KC001025',  rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'78',unidad:'REMOLQUE PLANTA DE LUZ',año:0,plaza:'CHIHUAHUA',responsable:'MARTIN DE LA O', placas:'SIN PLACAS',serie:'',                 rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'—',     nip:'',km:0,status:'activo'},
  {eco:'93',unidad:'VIBROCOMPACTADOR DYNAPAC CA250D',año:0,plaza:'CHIHUAHUA',responsable:'—',     placas:'6582US5266',serie:'',                 rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'—',     nip:'',km:0,status:'activo'},
  {eco:'94',unidad:'SEMIRREMOLQUE PLATAFORMA INTERSTATE',año:2019,plaza:'CHIHUAHUA',responsable:'—',placas:'—',serie:'1JK0DT200KM016992',       rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'—',     nip:'',km:0,status:'activo'},
  {eco:'95',unidad:'COROLLA TOYOTA',  año:2026,plaza:'CHIHUAHUA', responsable:'PALOMA PINEDO',    placas:'DXS674C',serie:'JTDBCRFE1T3149317',  rend:'—',        pv:'2029-05-14',pol:'TFSM0003120678',tipo:'auto',     color:'Blanco',nip:'',km:0,status:'activo'},
  {eco:'96',unidad:'NIVELADORA AUTOPROPULSADA JOHN DEERE 772B',año:0,plaza:'CHIHUAHUA',responsable:'—',placas:'—',serie:'DW772BX511428',       rend:'—',        pv:'—',         pol:'—',            tipo:'camion',   color:'—',     nip:'',km:0,status:'activo'},
];

const C={
  VEHS:'flotilla_vehiculos',
  SOLS:'flotilla_solicitudes',
  TAREAS:'flotilla_tareas',
  USUARIOS:'fl_usuarios',
  CHKSEM:'flotilla_checklist_semanal',
  CFG:'flotilla_config',
  USOS:'flotilla_usos',
  EVENTOS:'flotilla_eventos',
  OFFLINE_KEY:'tcn_offline_queue',
};

const TIPOS_SOL=[
  'Mantenimiento preventivo','Mantenimiento correctivo','Siniestro / Accidente',
  'Batería','Motor','Llantas','Frenos','Suspensión','Dirección','Transmisión',
  'Aceite y lubricación','Sistema de enfriamiento','Alternador y sistema de carga',
  'Iluminación','Limpiaparabrisas','Aire acondicionado','Sistema de combustible',
  'Sensores y diagnóstico electrónico',
];

const CHK_CATS_GENERICO={
  Cristales:  ['vidrio delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],
  Espejos:    ['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],
  Neumáticos: ['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],
  Interiores: ['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],
  Motor:      ['Batería','Tapón agua','Tapón radiador','Tapón dirección'],
  Cajuela:    ['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],
  Legal:      ['Tarjeta circulación'],
};
// CHK_CATS ahora es mutable: se reasigna en renderChkSemanal() según la
// categoría de checklist adaptativo asignada al vehículo en el portal
// (Administración → Checklist adaptativo). Si el vehículo no tiene
// categoría asignada, o la config no cargó, se usa el genérico de siempre.
let CHK_CATS=CHK_CATS_GENERICO;

// ── CHECKLIST ADAPTATIVO — leído desde la config del portal, EN VIVO ──
// Antes se leía una sola vez con .get(), así que un cambio guardado en el
// portal (Administración → Checklist adaptativo) solo llegaba a la app la
// próxima vez que el técnico cerraba y volvía a abrir la app — podía tardar
// hasta el día siguiente. Con onSnapshot, Firestore empuja el cambio al
// instante a cualquier sesión con la app abierta.
// Cuidado importante: si el técnico YA está a mitad de un checklist cuando
// tú guardas un cambio, NO le reescribimos el formulario debajo de las manos
// (perdería lo que llevaba, o se desalinearía). Solo se refresca en vivo la
// pantalla si todavía no ha respondido ningún ítem; si ya empezó, el cambio
// se aplicará limpio la próxima vez que abra un checklist nuevo.
window._chkAdaptCfg=null; // cache: {categorias,asignaciones} o null si no cargado
let _chkAdaptUnsub=null; // desuscriptor, evita registrar el listener más de una vez
function cargarChkAdaptCfg(){
  if(window._chkAdaptCfg!==null&&_chkAdaptUnsub)return Promise.resolve();
  if(_chkAdaptUnsub){_chkAdaptUnsub();_chkAdaptUnsub=null;}
  return new Promise(resolve=>{
    let primeraCarga=true;
    _chkAdaptUnsub=db.collection(C.CFG).doc('checklist_adaptativo').onSnapshot(d=>{
      window._chkAdaptCfg=d.exists?d.data():{categorias:{},asignaciones:{}};
      if(primeraCarga){primeraCarga=false;resolve();return;}
      const sinRespuestasAun=!semState.chk||Object.keys(semState.chk).length===0;
      if(vistaAct==='chksemanal'&&sinRespuestasAun&&miVeh){
        fijarChkCatsParaVehiculo(miVeh);
        const wrap=document.getElementById('fm-sem-chk-list');
        if(wrap)wrap.innerHTML=renderChkSemanalList();
      }
    },()=>{
      window._chkAdaptCfg={categorias:{},asignaciones:{}};
      if(primeraCarga){primeraCarga=false;resolve();}
    });
  });
}
// Decide qué CHK_CATS usar para un vehículo dado, y lo deja asignado en la
// variable global CHK_CATS antes de construir el formulario.
function fijarChkCatsParaVehiculo(veh){
  const cfg=window._chkAdaptCfg;
  if(!cfg){CHK_CATS=CHK_CATS_GENERICO;return;}
  const unidad=(veh?.unidad||'').toUpperCase().trim();
  const catKey=cfg.asignaciones&&cfg.asignaciones[unidad];
  const cat=catKey&&cfg.categorias&&cfg.categorias[catKey];
  CHK_CATS=(cat&&cat.items&&cat.items.length)?{Checklist:cat.items}:CHK_CATS_GENERICO;
}

// ── MAQUINARIA: 4 fotos obligatorias en lugar del checklist ──
const MAQ_FOTOS=['Vista general','Placa / N° de serie','Horómetro o tablero','Estado / detalle'];
const esMaquinaria=v=>!!v&&v.tipo==='maquinaria';

// ── ESTADO ──
let miVeh=null, misSols=[], misTareas=[], misNotif=[], misPipelineNotif=[];
let miPerfil=null; // {email, nombre, ecoVinculado, rol}
let _unsubNotif=null; // listener en tiempo real de flotilla_notificaciones
let _unsubRecibirPendiente=null; // listener en tiempo real: transferencias donde soy el receptor designado
let _unsubRespChk=null; // listener en tiempo real: respuestas del admin a mis check lists semanales
let vistaAct='vehiculo';
let solState={modo:'entrada',tipo:'',prior:'Normal',desc:'',km:'',taller:'',gasolina:50,chk:{},chkFotos:{},evFotos:[],dmg:{}};
let semState={km:'',gasolina:50,chk:{},chkFotos:{},evFotos:[],observaciones:'',firma:null,yaExiste:false};

// ── AUTOGUARDADO EN localStorage — persiste aunque se cierre la app ──
// Keys de draft incluyen email del usuario — cada usuario tiene su propio borrador
function _draftKeys(){
  const email=(window.auth?.currentUser?.email||'anonimo').replace(/[^a-z0-9]/gi,'_');
  return {
    SOL:'fl_draft_sol_'+email,
    SEM:'fl_draft_sem_'+email,
    UTIL:'fl_draft_util_'+email,
  };
}
// _DRAFT se resuelve dinámicamente en cada llamada
const _DRAFT={
  get SOL(){return _draftKeys().SOL;},
  get SEM(){return _draftKeys().SEM;},
  get UTIL(){return _draftKeys().UTIL;},
};
function _draftSave(key,state){
  try{
    const s=Object.assign({},state);
    // evFotos: en Solicitud y Semanal son evidencia SUPLEMENTARIA (muy pesadas,
    // no vale la pena arriesgar la cuota de localStorage por ellas) — se
    // siguen excluyendo igual que siempre. En Transferencia, en cambio, las 7
    // fotos de ángulo SON el contenido principal del proceso, así que aquí sí
    // se guardan; si no caben (cuota excedida), el catch de abajo las quita y
    // reintenta sin ellas, igual que ya protege a fotoKm/chkFotos/firma.
    if(key!==_DRAFT.UTIL)s.evFotos=[];
    try{
      localStorage.setItem(key,JSON.stringify(s));
    }catch(e){
      // Si no caben con fotos, guardar sin fotos pero avisar
      s.fotoKm=null;s.chkFotos={};s.firma=null;s.evFotos=[];
      try{localStorage.setItem(key,JSON.stringify(s));}catch{}
    }
  }catch(e){/* error inesperado — ignorar */}
}
function _draftLoad(key){
  try{const r=localStorage.getItem(key);return r?JSON.parse(r):null;}catch{return null;}
}
function _draftClear(key){
  try{localStorage.removeItem(key);}catch{}
}
function _draftBanner(tipo,onRestaurar,onDescartar){
  const id='fl-draft-banner-'+tipo;
  if(document.getElementById(id))return;
  // Guardar callbacks en window para evitar que toString() se renderice como HTML
  const cbKey='_draftCb_'+tipo;
  window[cbKey+'_ok']=function(){
    const el=document.getElementById(id);if(el)el.remove();
    delete window[cbKey+'_ok'];delete window[cbKey+'_no'];
    onRestaurar();
  };
  window[cbKey+'_no']=function(){
    const el=document.getElementById(id);if(el)el.remove();
    delete window[cbKey+'_ok'];delete window[cbKey+'_no'];
    onDescartar();
  };
  const b=document.createElement('div');
  b.id=id;
  b.style.cssText='position:fixed;bottom:76px;left:0;right:0;margin:0 12px;background:#1E3A5F;color:#fff;border-radius:12px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.35);font-size:13px;gap:8px';
  b.innerHTML=`<span style="flex:1">Tienes un borrador guardado.<br><span style="font-size:11px;opacity:.8">¿Deseas continuar donde lo dejaste?</span></span>
    <button onclick="window['${cbKey}_no']()" style="background:rgba(255,255,255,.15);border:none;color:#fff;padding:6px 10px;border-radius:8px;font-size:12px;cursor:pointer">Descartar</button>
    <button onclick="window['${cbKey}_ok']()" style="background:#2563EB;border:none;color:#fff;padding:6px 12px;border-radius:8px;font-size:12px;cursor:pointer;font-weight:700">Continuar</button>`;
  document.body.appendChild(b);
}
let onlineStatus=navigator.onLine;

// ── Emails con acceso de administrador/flotilla ──
const ADMINS_FLOTILLA=[
  'rh@tecnocontrol.com.mx',
  'c.acosta@tecnocontrol.com.mx',
  'mercadotecniatecnocontrol@gmail.com.mx',
  'mercadotecnia@tecnocontrol.com.mx',
  'p.pinedo@tecnocontrol.com.mx',
  'm.delao@tecnocontrol.com.mx',
  'i.saucedo@tecnocontrol.com.mx',
  'v.garcia@tecnocontrol.com.mx',
  'nicolas@tecnocontrol.com.mx',
  'fatima@tecnocontrol.com.mx',
];

// ── Helper: el usuario tiene acceso libre a toda la flota ──
function esRolLibre(){
  const email=(window.auth?.currentUser?.email||'').toLowerCase();
  const rol=(miPerfil?.rol||'').toLowerCase();
  return ADMINS_FLOTILLA.includes(email)||rol==='admin'||rol==='flotilla'||rol==='encargado';
}

// ── ECOS VINCULADOS (1 o varios vehículos/maquinaria por usuario) ──
// Compatibilidad: si solo existe ecoVinculado (string), se trata como array de 1.
function getEcosVinculados(){
  if(!miPerfil)return[];
  const arr=Array.isArray(miPerfil.ecosVinculados)?miPerfil.ecosVinculados.map(String):[];
  const simple=(miPerfil.ecoVinculado!=null&&miPerfil.ecoVinculado!=='')?[String(miPerfil.ecoVinculado)]:[];
  return [...arr,...simple].filter((e,i,a)=>e&&e!=='null'&&e!=='undefined'&&a.indexOf(e)===i);
}

// ── PERSISTENCIA LOCAL: última unidad usada (sobrevive a refresh) ──
const LS_ULTIMO_ECO='fl_ultimo_eco';
function guardarUltimoEco(eco){
  try{
    const email=window.auth?.currentUser?.email||'';
    localStorage.setItem(LS_ULTIMO_ECO,JSON.stringify({email,eco:String(eco),ts:Date.now()}));
  }catch{}
}
function leerUltimoEco(){
  try{
    const data=JSON.parse(localStorage.getItem(LS_ULTIMO_ECO)||'null');
    const email=window.auth?.currentUser?.email||'';
    if(data&&data.email===email&&data.eco)return String(data.eco);
  }catch{}
  return null;
}

// ── HELPERS ──
const hF=iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';
const hD=f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);

function badge(e){
  const m={Solicitud:'#6D28D9',Validada:'#1D4ED8',Cotización:'#B45309',Aprobada:'#15803D',Rechazada:'#B91C1C',Cierre:'#7C3AED',Cerrada:'#475569','En proceso':'#0369A1',Pendiente:'#B45309',Completada:'#15803D'};
  const bg={Solicitud:'#EDE9FE',Validada:'#DBEAFE',Cotización:'#FEF3C7',Aprobada:'#DCFCE7',Rechazada:'#FEE2E2',Cierre:'#F3E8FF',Cerrada:'#F1F5F9','En proceso':'#E0F2FE',Pendiente:'#FEF3C7',Completada:'#DCFCE7'};
  return`<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:100px;background:${bg[e]||'#F1F5F9'};color:${m[e]||'#475569'}">${e||'—'}</span>`;
}

// ── GENERAR CÓDIGO EVIDENCIA ──
// ── LISTA DE COLABORADORES (fallback si Firestore no disponible) ──
const FL_COLABORADORES = ["Aceves Ivan Argenis","Acosta Bustillos Francisca","Acosta Chavira Carlos","Acosta Contreras Cristina Judith","Barraza Luya Saúl Ismael","Calixto Sánchez Rafael","Carmona Lagunas Sergio","Castro Muñoz Saúl","Chacón Terrazas Lucero","Chávez Alvarez Ruth Yadira","Chávez Barraza Oscar Iván","Chávez Chávez Iván","Contreras Morales Elva Nidia","Coronado Valenzuela Socorro Annet","De La Cruz Emilio Julio César","De La O Maese Martín","Durstewitz Maese Guillermo","Enríquez Gallardo Jorge Alberto","Escalante Jaramillo Ana Karen","Estrada Gómez Alan Alberto","García Ledezma Jesús Alvaro","García Montemayor Veronica Janeth","Garza González Luis Enrique","González Babonoyaba Ricardo Antonio","González Delgado Ericka Idaly","Guerrero Gómez Jorge","Gutiérrez Alvarado Nayra Didi","Gutiérrez Villarreal Denisse","Guzmán Morales Flor Idalia","Guzmán Neave Kenia Yadira","Hernández Pérez Rubén Alberto","Hernández Prieto Josué","Hernández Ríos Jesús Ramón","Leal Martínez Roque Manuel","López Ávila Sandra Lucero","Lopez Chavez Guillermo","López Delgado Luis Humberto","Luna Espinoza Jaime Roel","Medina Contreras Giovanni Israel","Mendoza Becerra Sergio","Minjarez Ochoa Alberto Alan","Montellano Pasillas Miguel Ángel","Morales Cruz Gabriel Gael","Morales Mendoza Tomás","Moreno Molina Reyes","Moriel Sáenz Ricardo Salvador","Muñoz Avila Roberto","Muñoz Blanco Lizeth Cristina","Nuñez Alatorre Ulises","Orozco Miranda Ana Cristina","Parra Blanco Zaira Sibel","Pérez Espíndola Rita Isabel","Perez Garcia Martha Aracely","Pinedo Paloma","Portillo Portillo José Luis","Preciado Grijalva Glen Iván","Reyes González Pedro","Ríos Salcido Joon Omaira","Ruiz Olmedo Norma Idaly","Salcedo Gardea Filiberto Isai","Salmon Rivas Fabricio Abundio","Saucedo Martínez Irving Abraham","Sauzameda Ochoa Fátima Anahí","Sepúlveda Mendoza Iván Roberto","Soto González Benito","Terrazas Serrano Fernando","Uribe Maese Jorge Alberto","Valencia Barraza Jesus Bersain","Valencia Meza Luis Miguel","Valenzuela López José Luis","Nicolas","Luis Lopez","Cano Corral Adrian","Ricardo Gonzalez"];

// Cargar colaboradores: Firestore primero, fallback a lista hardcodeada
async function cargarColaboradores(){
  if(window._flColab&&window._flColab.length>0) return window._flColab;
  try{
    const snap=await db.collection('fl_colaboradores').orderBy('nombre').get();
    if(!snap.empty){
      window._flColab=snap.docs.map(d=>d.data().nombre).filter(Boolean);
      return window._flColab;
    }
  }catch{}
  window._flColab=[...FL_COLABORADORES];
  return window._flColab;
}

function genCod(){
  const d=new Date();
  const dd=String(d.getFullYear())+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r='';for(let i=0;i<4;i++)r+=chars[Math.floor(Math.random()*chars.length)];
  return`TCN-EV-${dd}-${r}`;
}

// ── SEMANA ISO (ej. "2026-W25") ──
function getSemanaISO(d){
  d=d||new Date();
  const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=(dt.getUTCDay()+6)%7;
  dt.setUTCDate(dt.getUTCDate()-dayNum+3);
  const firstThursday=new Date(Date.UTC(dt.getUTCFullYear(),0,4));
  const week=1+Math.round(((dt-firstThursday)/86400000-3+((firstThursday.getUTCDay()+6)%7))/7);
  return`${dt.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function esLunes(){return new Date().getDay()===1;}
function esLunesAViernes(){const d=new Date().getDay();return d>=1&&d<=5;}
// Lunes(1)/Martes(2)/Miércoles(3) → si el checklist semanal ya está hecho, se confirma en vez de repetirlo
function esLunesAMiercoles(){const d=new Date().getDay();return d>=1&&d<=3;}

// ── CONFIG CHECK LIST SEMANAL ──
window._cfgSem=null; // cache: {activo, semana, ...} o null si no cargado
function cargarCfgSem(){
  if(window._cfgSem!==null)return Promise.resolve();
  return db.collection(C.CFG).doc('checklist_semanal').get()
    .then(d=>{window._cfgSem=d.exists?d.data():{activo:false};})
    .catch(()=>{window._cfgSem={activo:false};});
}
function chkSemPermitido(semana){
  // Si es lunes → siempre permitido (comportamiento original)
  if(esLunes())return true;
  // Si no es lunes pero hay config activa para esta semana → permitir lunes-viernes
  const cfg=window._cfgSem||{};
  return !!(cfg.activo&&cfg.semana===semana&&esLunesAViernes());
}

// ── CHECK LIST SEMANAL — BANNER ──
window._semChkCache={};
window._semChkDocCache={}; // guarda el doc completo (para poder mostrar respuestaAdmin, no solo si existe)
function semChkBanner(){
  const eco=miVeh?.eco;if(!eco)return'';
  const semana=getSemanaISO();
  const cacheKey=`${eco}_${semana}`;
  const yaExiste=window._semChkCache[cacheKey];

  // Cargar config si no está en cache
  if(window._cfgSem===null){
    cargarCfgSem().then(()=>{if(vistaAct==='vehiculo')renderVehiculo();});
    return`<div class="fm-card" style="background:#F8FAFD;display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:20px;height:20px;border:2px solid #CBD5E1;border-top-color:#2563EB;border-radius:50%;animation:fmspin .7s linear infinite"></div>
      <div style="font-size:12px;color:#64748B">Verificando check list semanal…</div>
    </div>`;
  }

  if(yaExiste===undefined){
    db.collection(C.CHKSEM).where('vehiculoEco','==',String(eco)).where('semana','==',semana).limit(1).get()
      .then(snap=>{
        window._semChkCache[cacheKey]=!snap.empty;
        window._semChkDocCache[cacheKey]=snap.empty?null:snap.docs[0].data();
        if(vistaAct==='vehiculo')renderVehiculo();
      })
      .catch(()=>{window._semChkCache[cacheKey]=false;});
    return`<div class="fm-card" style="background:#F8FAFD;display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="width:20px;height:20px;border:2px solid #CBD5E1;border-top-color:#2563EB;border-radius:50%;animation:fmspin .7s linear infinite"></div>
      <div style="font-size:12px;color:#64748B">Verificando check list semanal…</div>
    </div>`;
  }
  if(yaExiste){
    // Si el admin dejó un comentario/respuesta sobre ESTE check list, se muestra
    // debajo de la confirmación de "completado" — así el técnico lo ve sin que
    // exista todavía una pantalla dedicada de historial.
    const doc=window._semChkDocCache[cacheKey];
    const resp=doc?.respuestaAdmin;
    return`<div class="fm-card" style="background:#DCFCE7;border:1px solid #BBF7D0;display:flex;align-items:center;gap:10px;margin-bottom:${resp?'0':'12px'}">
      <span style="color:#15803D;flex-shrink:0">${IC.check}</span>
      <div><div style="font-size:13px;font-weight:800;color:#15803D">Check list semanal completado</div>
      <div style="font-size:11px;color:#166534;margin-top:2px">Semana ${semana} · Ya se registró la inspección de esta semana</div></div>
    </div>
    ${resp?`<div class="fm-card" style="background:#EFF6FF;border:1px solid #BFDBFE;margin-top:8px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="color:#1D4ED8">${IC.bell}</span>
        <span style="font-size:11px;font-weight:800;color:#1D4ED8;text-transform:uppercase;letter-spacing:.3px">Respuesta del admin</span>
      </div>
      <div style="font-size:12.5px;color:#1E3A5F;line-height:1.4">${resp}</div>
    </div>`:''}`;
  }
  if(chkSemPermitido(semana)){
    const cfg=window._cfgSem||{};
    const extendido=cfg.activo&&cfg.semana===semana&&!esLunes();
    return`<div class="fm-card" style="background:#EFF6FF;border:1.5px solid #BFDBFE;margin-bottom:12px;cursor:pointer" onclick="fmVista('chksemanal')">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="color:#1D4ED8;flex-shrink:0">${IC.tasks}</span>
        <div style="flex:1"><div style="font-size:13px;font-weight:800;color:#1D4ED8">Check list semanal pendiente</div>
        <div style="font-size:11px;color:#1E40AF;margin-top:2px">${extendido?'Habilitado por admin':'Hoy es lunes'} · Semana ${semana} · Toca para llenarlo</div></div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </div>`;
  }
  return`<div class="fm-card" style="background:#F8FAFD;display:flex;align-items:center;gap:10px;margin-bottom:12px;opacity:.7">
    <span style="color:#94A3B8;flex-shrink:0">${IC.tasks}</span>
    <div><div style="font-size:12.5px;font-weight:700;color:#64748B">Check list semanal</div>
    <div style="font-size:11px;color:#94A3B8;margin-top:2px">Disponible los lunes · Semana ${semana}</div></div>
  </div>`;
}

// ── ¿Ya se completó el check list semanal de esta semana para mi vehículo? ──
// true / false = respuesta conocida · null = aún consultando (se re-renderiza al resolver)
function chkSemCompletadoActual(onListo){
  const eco=miVeh?.eco;if(!eco)return false;
  const semana=getSemanaISO();
  const cacheKey=`${eco}_${semana}`;
  const yaExiste=window._semChkCache[cacheKey];
  if(yaExiste===undefined){
    db.collection(C.CHKSEM).where('vehiculoEco','==',String(eco)).where('semana','==',semana).limit(1).get()
      .then(snap=>{window._semChkCache[cacheKey]=!snap.empty;if(typeof onListo==='function')onListo();})
      .catch(()=>{window._semChkCache[cacheKey]=false;if(typeof onListo==='function')onListo();});
    return null;
  }
  return yaExiste;
}
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
      ctx.fillStyle='#3B82F6';ctx.fillRect(0,c.height-sh,c.width,4);
      const fs=Math.max(12,Math.round(c.width*0.035));
      ctx.fillStyle='#FCD34D';ctx.font=`bold ${fs}px monospace`;
      ctx.fillText(meta.codigo,10,c.height-sh+fs+4);
      ctx.fillStyle='#fff';ctx.font=`${fs}px monospace`;
      ctx.fillText(`${meta.fecha} · ${meta.hora}`,10,c.height-sh+fs*2+8);
      ctx.fillStyle='rgba(255,255,255,.65)';ctx.font=`${Math.round(fs*.85)}px monospace`;
      ctx.fillText(meta.gps?`${meta.gps.lat}, ${meta.gps.lng}`:'Sin GPS',10,c.height-sh+fs*3+10);
      ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.6)';
      ctx.fillText(meta.eco?`ECO ${meta.eco}`:'',c.width-8,c.height-sh+fs+4);
      ctx.textAlign='left';
      res(c.toDataURL('image/jpeg',0.75));
    };
    img.src=src;
  });
}

// ── DEBUG (solo consola) ──
function dbg(msg, tipo='info'){
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
  const pendientes=[];
  for(const doc of q){
    try{
      const {_offlineId,_pendiente,...clean}=doc;
      await reducirTamanoSolicitud(clean);
      await db.collection(C.SOLS).add({...clean,creadoEn:clean.creadoEn||new Date().toISOString(),sincronizadoOffline:true});
      synced++;
    }catch(e){
      console.warn('[MOVIL offline]',doc.tipo,e.message||e);
      pendientes.push(doc); // se conserva en la cola para reintentar — nunca se borra sola
    }
  }
  localStorage.setItem(C.OFFLINE_KEY,JSON.stringify(pendientes));
  if(synced>0){
    toast(`${synced} solicitud(es) sincronizada(s)`, 'ok');
    await cargarMisSols();
    if(vistaAct==='vehiculo')renderVehiculo();
  }
}
window.fmSyncOffline=async function(){
  const q=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  if(!q.length){toast('No hay solicitudes pendientes','info');return;}
  if(!onlineStatus){toast('Sin conexión — intenta más tarde','err');return;}
  toast('Sincronizando…','info');
  let ok=0,fail=0;
  const pendientes=[];
  for(const doc of q){
    try{
      const {_offlineId,_pendiente,...clean}=doc;
      await reducirTamanoSolicitud(clean);
      await db.collection(C.SOLS).add({...clean,sincronizadoOffline:true});
      ok++;
    }catch(e){
      console.warn('[MOVIL syncOffline]',doc.tipo,e.message||e);
      fail++;
      pendientes.push(doc); // se conserva en la cola — nunca se borra sola
    }
  }
  localStorage.setItem(C.OFFLINE_KEY,JSON.stringify(pendientes));
  toast(ok+' sincronizada(s)'+(fail?' · '+fail+' sin poder sincronizar — revisa "Ver / Borrar"':''),ok>0?'ok':'err');
  await cargarMisSols();
  if(vistaAct==='vehiculo')renderVehiculo();
};

window.fmVerOffline=function(){
  const q=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;padding:0';
  const panel=document.createElement('div');
  panel.style.cssText='background:#fff;width:100%;max-width:480px;border-radius:16px 16px 0 0;padding:20px;max-height:80vh;overflow-y:auto';
  const cerrar=()=>ov.remove();
  const hdr=document.createElement('div');
  hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:14px';
  const tit=document.createElement('div');tit.style.cssText='font-size:15px;font-weight:900';tit.textContent='Solicitudes pendientes';
  const bX=document.createElement('button');bX.style.cssText='background:none;border:none;font-size:18px;cursor:pointer;color:#64748B';bX.textContent='x';bX.onclick=cerrar;
  hdr.appendChild(tit);hdr.appendChild(bX);panel.appendChild(hdr);
  if(q.length===0){
    const v=document.createElement('div');v.style.cssText='text-align:center;padding:20px;color:#94A3B8;font-size:13px';v.textContent='No hay solicitudes pendientes';panel.appendChild(v);
  } else {
    q.forEach(function(doc,i){
      const card=document.createElement('div');card.style.cssText='border:1px solid #E2E8F0;border-radius:10px;padding:12px;margin-bottom:8px';
      const row=document.createElement('div');row.style.cssText='display:flex;align-items:flex-start;justify-content:space-between;gap:8px';
      const info=document.createElement('div');
      info.innerHTML='<div style="font-size:12px;font-weight:700">'+(doc.tipo||'—')+'</div><div style="font-size:10.5px;color:#64748B;margin-top:2px">ECO '+(doc.vehiculoEco||'—')+' · '+(doc.creadoEn?doc.creadoEn.substring(0,10):'—')+'</div><div style="font-size:10.5px;color:#94A3B8;margin-top:1px">'+(doc.descripcion||'')+'</div>';
      const bD=document.createElement('button');bD.style.cssText='padding:4px 10px;background:#FEE2E2;color:#B91C1C;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0';bD.textContent='Borrar';
      bD.dataset.idx=i;bD.onclick=function(){fmBorrarOffline(Number(this.dataset.idx),this);};
      row.appendChild(info);row.appendChild(bD);card.appendChild(row);panel.appendChild(card);
    });
  }
  const footer=document.createElement('div');footer.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px';
  const bS=document.createElement('button');bS.style.cssText='padding:10px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer';bS.textContent='Sincronizar todo';bS.onclick=function(){fmSyncOffline();cerrar();};
  const bB=document.createElement('button');bB.style.cssText='padding:10px;background:#FEE2E2;color:#B91C1C;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer';bB.textContent='Borrar todas';bB.onclick=function(){if(confirm('Borrar todas las solicitudes pendientes?')){localStorage.setItem(C.OFFLINE_KEY,'[]');cerrar();renderVehiculo();}};
  footer.appendChild(bS);footer.appendChild(bB);panel.appendChild(footer);
  ov.appendChild(panel);ov.addEventListener('click',function(e){if(e.target===ov)cerrar();});
  document.body.appendChild(ov);
};

window.fmBorrarOffline=function(idx,btn){
  if(!confirm('Borrar esta solicitud pendiente?'))return;
  const q=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  q.splice(idx,1);
  localStorage.setItem(C.OFFLINE_KEY,JSON.stringify(q));
  btn.closest('div').parentElement.remove();
  toast('Solicitud eliminada','ok');
  if(vistaAct==='vehiculo')renderVehiculo();
};



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
.fm-veh-name{font-size:18px;font-weight:800;color:#fff;margin-top:2px;letter-spacing:-.3px;}
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
.fm-offline-bar svg{width:13px;height:13px;vertical-align:-2px;margin-right:3px;display:inline-block;}
@keyframes fmspin{to{transform:rotate(360deg);}}

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
// ── Registro de actividad y errores (diagnóstico) ──
// Nunca debe romper la app: si falla el propio guardado, se ignora en silencio.
function flRegistrarEvento(tipo,extra){
  try{
    const user=window.auth?.currentUser;
    db.collection(C.EVENTOS).add({
      tipo,
      email:user?.email||'',
      nombre:user?.displayName||user?.email||'',
      vista:(typeof vistaAct!=='undefined'?vistaAct:'')||'',
      dispositivo:navigator.userAgent||'',
      online:navigator.onLine,
      creadoEn:new Date().toISOString(),
      ...extra,
    }).catch(()=>{});
  }catch(e){}
}

window.addEventListener('error',(e)=>{
  flRegistrarEvento('error',{mensaje:String(e.message||'').slice(0,300),stack:String(e.error?.stack||'').slice(0,600)});
});
window.addEventListener('unhandledrejection',(e)=>{
  const r=e.reason;
  flRegistrarEvento('error',{mensaje:('Promise rechazada: '+(r?.message||r||'')).slice(0,300),stack:String(r?.stack||'').slice(0,600)});
});

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
    flRegistrarEvento('sesion_abierta');
  }

  dbg('Iniciando app móvil…','info');
  dbg('Usuario: '+(window.auth?.currentUser?.email||'sin sesión'),'info');
  dbg('Online: '+navigator.onLine,'info');
  await Promise.all([cargarMiVeh(),cargarMisSols(),cargarMisTareas()]);
  dbg('Datos cargados. Vehículo: '+(miVeh?'ECO '+miVeh.eco:'ninguno'),'ok');
  if(miVeh)flReportarUbicacion(miVeh.eco);
  actualizarBadges();
  fmVista('vehiculo');

  // Sincronizar offline queue si hay conexión
  if(onlineStatus)await offlineSync();

  // Registrar Service Worker
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw-flotilla.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if(!newSW) return;
        newSW.addEventListener('statechange', () => {
          if(newSW.state === 'installed' && navigator.serviceWorker.controller){
            recargarSiSeguro();
          }
        });
      });
      document.addEventListener('visibilitychange', () => {
        if(document.visibilityState === 'visible') reg.update().catch(()=>{});
      });
    }).catch(()=>{});
    navigator.serviceWorker.addEventListener('message', e => {
      if(e.data?.type === 'SW_UPDATED') recargarSiSeguro();
    });
  }
};

// ── Ubicación en tiempo real ──
// Solo se captura al abrir la app o al vincularse a un vehículo (no hay
// rastreo continuo en segundo plano — limitación real de las PWA en el
// navegador). Si el técnico niega el permiso, falla en silencio.
function flReportarUbicacion(eco){
  if(!eco||!navigator.geolocation)return;
  try{
    navigator.geolocation.getCurrentPosition(async(pos)=>{
      try{
        const user=window.auth?.currentUser;
        await db.collection('flotilla_ubicaciones').doc(String(eco)).set({
          eco:String(eco),
          lat:pos.coords.latitude,
          lng:pos.coords.longitude,
          precision:pos.coords.accuracy||null,
          email:user?.email||'',
          nombre:user?.displayName||user?.email||'',
          capturadoEn:new Date().toISOString(),
        });
      }catch(e){console.warn('[FL] guardar ubicación',e);}
    },(err)=>{console.warn('[FL] geolocalización no disponible',err.message);},{enableHighAccuracy:false,timeout:8000,maximumAge:60000});
  }catch(e){console.warn('[FL] flReportarUbicacion',e);}
}

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

async function cargarVehiculoPorEco(eco){
  try{
    const snap=await db.collection(C.VEHS).where('eco','==',String(eco)).get();
    if(!snap.empty)return{id:snap.docs[0].id,...snap.docs[0].data()};
  }catch{}
  const found=window.CAT_FL?.find(v=>String(v.eco)===String(eco));
  return found?{id:'eco-'+found.eco,...found}:null;
}

async function cargarMiVeh(){
  // Rol libre (admin/flotilla): puede elegir cualquier vehículo
  if(esRolLibre()){
    if(!miVeh){
      // Restaurar la última unidad usada en este dispositivo (sobrevive a refresh)
      const ultimo=leerUltimoEco();
      if(ultimo)miVeh=await cargarVehiculoPorEco(ultimo);
    }
    return;
  }
  const ecos=getEcosVinculados();
  if(!ecos.length){miVeh=null;return;}
  if(ecos.length===1){
    miVeh=await cargarVehiculoPorEco(ecos[0]);
    return;
  }
  // Varios vehículos/maquinaria asignados: restaurar la última unidad elegida
  // (debe seguir estando en su lista asignada; si no, usar la primera)
  let eco=leerUltimoEco();
  if(!eco||!ecos.includes(eco))eco=ecos[0];
  miVeh=await cargarVehiculoPorEco(eco);
}

async function cargarMisSols(){
  if(!miVeh&&!miPerfil?.email){misSols=[];return;}
  try{
    let q=miVeh?.eco
      ? db.collection(C.SOLS).where('vehiculoEco','==',String(miVeh.eco)).orderBy('creadoEn','desc').limit(20)
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

let _unsubTareas=null; // listener en tiempo real de flotilla_tareas
let _unsubVehs=null; // listener en tiempo real de flotilla_vehiculos (lista completa)
let _unsubMiUsuario=null; // listener en tiempo real del propio doc en fl_usuarios (detecta desvinculación forzada)

async function cargarMisTareas(){
  if(!miPerfil?.email){misTareas=[];return;}

  // ── Listener en tiempo real para TAREAS ──
  if(!_unsubTareas){
    try{
      _unsubTareas = db.collection(C.TAREAS)
        .where('asignadoA','==',miPerfil.email)
        .onSnapshot(snap=>{
          misTareas=snap.docs.map(d=>({id:d.id,...d.data()}))
            .filter(t=>t.estatus!=='Completada'&&t.estatus!=='Cancelada')
            .sort((a,b)=>(a.creadoEn||'').localeCompare(b.creadoEn||''));
          actualizarBadges();
          if(vistaAct==='tareas') renderTareas();
        }, err=>{console.warn('[MOVIL tareas onSnapshot]',err);misTareas=[];});
    }catch(e){console.error('[MOVIL tareas]',e);misTareas=[];}
  }

  misNotif=[]; // unificado: avisos vienen solo de flotilla_notificaciones

  // ── Listener en tiempo real para la lista completa de VEHÍCULOS ──
  if(!_unsubVehs){
    try{
      _unsubVehs = db.collection(C.VEHS).onSnapshot(snap=>{
        window._fmAllVehs = snap.docs.map(d=>({id:d.id,...d.data()}));
        if(esRolLibre()&&!miVeh&&vistaAct==='vehiculo'){
          renderSelectorFlota();
        } else if(miVeh){
          const actualizado=window._fmAllVehs.find(v=>String(v.eco)===String(miVeh.eco));
          if(actualizado){ miVeh={...miVeh,...actualizado}; if(vistaAct==='vehiculo')renderVehiculo(); }
        }
      }, err=>{console.warn('[MOVIL vehs onSnapshot]',err);});
    }catch(e){console.error('[MOVIL vehs]',e);}
  }

  // ── Listener en tiempo real del propio doc en fl_usuarios ──
  // Si el administrador reasigna el ECO desde el portal, aquí se detecta
  // de inmediato y se libera al técnico sin esperar a que recargue la app.
  if(miPerfil?.email && !_unsubMiUsuario){
    try{
      _unsubMiUsuario = db.collection(C.USUARIOS)
        .where('email','==',miPerfil.email)
        .onSnapshot(snap=>{
          if(snap.empty)return;
          const u={...snap.docs[0].data(),uid:snap.docs[0].id};
          const ecosAntes=getEcosVinculados();
          const teniaEsteEco=miVeh && ecosAntes.includes(String(miVeh.eco));
          miPerfil=u;
          const ecosDespues=getEcosVinculados();
          if(teniaEsteEco && miVeh && !ecosDespues.includes(String(miVeh.eco))){
            toast('Tu ECO '+miVeh.eco+' fue reasignado por el administrador','err');
            miVeh=null;
            try{localStorage.removeItem(LS_ULTIMO_ECO);}catch{}
            if(vistaAct==='vehiculo')renderVehiculo();
          }
        }, err=>{console.warn('[MOVIL miUsuario onSnapshot]',err);});
    }catch(e){console.error('[MOVIL miUsuario]',e);}
  }

  // ── Listener en tiempo real para notificaciones (onSnapshot) ──
  // Se llama una vez al iniciar sesión; si ya existe se reutiliza
  if(miPerfil?.email && !_unsubNotif){
    try {
      const qNotif = db.collection('flotilla_notificaciones')
        .where('para','==',miPerfil.email)
        .orderBy('creadaEn','desc')
        .limit(30);

      _unsubNotif = qNotif.onSnapshot(snap => {
        const anterior = misPipelineNotif.length;
        misPipelineNotif = snap.docs.map(d=>({id:d.id,...d.data()}));

        // Detectar notificaciones nuevas (no leídas) vs las que ya había
        const nuevas = snap.docChanges().filter(ch=>ch.type==='added' && !ch.doc.data().leido);
        if(nuevas.length > 0 && anterior > 0){
          // Solo mostrar push si ya habíamos cargado antes (no en la carga inicial)
          nuevas.forEach(ch => {
            const n = ch.doc.data();
            const titulo = 'Tecnocontrol · Flotilla';
            const cuerpo = n.mensaje || 'Tu solicitud cambió de estatus';
            // 1) Notificación nativa via Service Worker
            if(navigator.serviceWorker?.controller){
              navigator.serviceWorker.controller.postMessage({
                type:'SHOW_NOTIF',
                title: titulo,
                body:  cuerpo,
                tag:   'fl-notif-'+ch.doc.id,
                notifTipo: n.tipo||'msg',
              });
            }
            // 2) Toast visual dentro de la app
            toast(cuerpo, n.tipo?.includes('rechazada')?'err':'ok');
          });
        }
        actualizarBadges();
        // Si el técnico está viendo la vista de notificaciones, refrescarla
        if(vistaAct==='notif') renderNotif();
      }, err => {
        console.warn('[MOVIL notif onSnapshot]', err);
        misPipelineNotif = [];
      });
    } catch(e){ misPipelineNotif=[]; }
  } else if(!miPerfil?.email){
    // Sin sesión — limpiar listener si existía
    if(_unsubNotif){ _unsubNotif(); _unsubNotif=null; }
    misPipelineNotif=[];
  }

  // ── Listener en tiempo real: transferencias donde SOY el receptor designado ──
  // A diferencia del aviso discreto de la campanita, esto es una alerta
  // INVASIVA a propósito (pedida explícitamente): un modal que se pone
  // encima de lo que el técnico esté haciendo, para que no se le pase por
  // alto que alguien le está transfiriendo un vehículo y tiene un plazo.
  // Se vuelve a mostrar cada vez que se abre la app mientras siga pendiente
  // (no solo una vez), pero no se repite en cada re-render dentro de la
  // misma sesión una vez que el técnico ya la vio/cerró.
  if(miPerfil?.email && !_unsubRecibirPendiente){
    try{
      _unsubRecibirPendiente = db.collection('flotilla_transferencias')
        .where('receptorEmail','==',miPerfil.email.toLowerCase())
        .where('estatus','==','Pendiente recepción')
        .onSnapshot(snap=>{
          const pendientes = snap.docs.map(d=>({id:d.id,...d.data()}));
          const nueva = pendientes.find(t=>!window._recibirModalVistos.has(t.id));
          if(nueva) mostrarModalRecibirPendiente(nueva);
        }, err=>{console.warn('[MOVIL recibirPendiente onSnapshot]',err);});
    }catch(e){console.error('[MOVIL recibirPendiente]',e);}
  }

  // ── Listener en tiempo real: respuestas del admin a MIS check lists ──
  // Mismo trato "invasivo" que el de recibir vehículo: modal encima de todo,
  // no solo una notificación discreta en la campanita.
  if(miPerfil?.email && !_unsubRespChk){
    try{
      _unsubRespChk = db.collection(C.CHKSEM)
        .where('tecnico','==',miPerfil.email)
        .onSnapshot(snap=>{
          const conRespuesta = snap.docs
            .map(d=>({id:d.id,...d.data()}))
            .filter(r=>r.respuestaAdmin);
          const nueva = conRespuesta.find(r=>!window._recibirModalVistos.has('chk_'+r.id+'_'+(r.respuestaAdminEn||'')));
          if(nueva) mostrarModalRespuestaChk(nueva);
        }, err=>{console.warn('[MOVIL respChk onSnapshot]',err);});
    }catch(e){console.error('[MOVIL respChk]',e);}
  }
}

window._recibirModalVistos = window._recibirModalVistos || new Set();
function mostrarModalRecibirPendiente(t){
  if(document.getElementById('fm-modal-recibir-pend'))return; // ya hay uno abierto
  window._recibirModalVistos.add(t.id);
  const venceTxt = t.venceEn ? new Date(t.venceEn).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  const ov=document.createElement('div');
  ov.id='fm-modal-recibir-pend';
  ov.style.cssText='position:fixed;inset:0;background:rgba(10,15,30,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML=`
    <div style="background:#fff;border-radius:18px;max-width:340px;width:100%;padding:24px 22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="width:52px;height:52px;border-radius:50%;background:#FEF3C7;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
      </div>
      <div style="font-size:16px;font-weight:800;color:#0A0F1E;margin-bottom:6px">Tienes un vehículo por recibir</div>
      <div style="font-size:13px;color:#374151;line-height:1.5;margin-bottom:14px"><strong>${t.entregaNombre||t.entregaEmail||'Alguien'}</strong> te envió un código para recibir el <strong>ECO ${t.vehiculoEco||'—'}${t.vehiculoUnidad?' · '+t.vehiculoUnidad:''}</strong>.</div>
      <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#B45309;margin-bottom:2px">Vence</div>
        <div style="font-size:13px;font-weight:800;color:#92400E">${venceTxt}</div>
      </div>
      <button onclick="utilIrARecibirCodigo('${t.codigo}')" style="width:100%;padding:12px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer;margin-bottom:8px">Recibir ahora</button>
      <button onclick="document.getElementById('fm-modal-recibir-pend').remove()" style="width:100%;padding:10px;background:none;border:none;color:#94A3B8;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer">Recordarme más tarde</button>
    </div>`;
  document.body.appendChild(ov);
}

// Atajo directo desde el modal invasivo: valida el código y salta al paso de
// firma, sin que el técnico tenga que volver a escribirlo a mano.
window.utilIrARecibirCodigo=async function(codigo){
  document.getElementById('fm-modal-recibir-pend')?.remove();
  try{
    const snap=await db.collection('flotilla_transferencias').where('codigo','==',codigo).where('estatus','==','Pendiente recepción').get();
    if(snap.empty){toast('El código ya no está disponible (puede que ya haya vencido o se haya cancelado)','err');fmVista('util');return;}
    const t={id:snap.docs[0].id,...snap.docs[0].data()};
    utilState.modo='recibir';
    utilState.transferenciaId=t.id;
    utilState.transferenciaData=t;
    utilState.datosEntrega={
      vehiculo:t.vehiculoUnidad,eco:t.vehiculoEco,
      km:t.entregaKm||'',
      receptor:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
      nombre:t.entregaNombre,
      entregaEmail:t.entregaEmail||'',
    };
    utilState.paso=3;
    fmVista('util');
    setTimeout(()=>renderUtil(),50);
  }catch(e){toast('Error: '+(e.message||e),'err');fmVista('util');}
};

// Modal invasivo para la respuesta del admin a un check list semanal —
// mismo look&feel que el de "vehículo por recibir".
function mostrarModalRespuestaChk(r){
  if(document.getElementById('fm-modal-recibir-pend')||document.getElementById('fm-modal-resp-chk'))return;
  window._recibirModalVistos.add('chk_'+r.id+'_'+(r.respuestaAdminEn||''));
  const fechaTxt = r.respuestaAdminEn ? new Date(r.respuestaAdminEn).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
  const ov=document.createElement('div');
  ov.id='fm-modal-resp-chk';
  ov.style.cssText='position:fixed;inset:0;background:rgba(10,15,30,.72);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px';
  ov.innerHTML=`
    <div style="background:#fff;border-radius:18px;max-width:340px;width:100%;padding:24px 22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)">
      <div style="width:52px;height:52px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
      </div>
      <div style="font-size:16px;font-weight:800;color:#0A0F1E;margin-bottom:6px">Respuesta del admin</div>
      <div style="font-size:12px;color:#94A3B8;margin-bottom:10px">Sobre tu check list del ECO ${r.vehiculoEco||'—'} · Semana ${r.semana||'—'} · ${fechaTxt}</div>
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#1E3A5F;line-height:1.5;text-align:left">${r.respuestaAdmin}</div>
      <button onclick="document.getElementById('fm-modal-resp-chk').remove()" style="width:100%;padding:12px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer">Entendido</button>
    </div>`;
  document.body.appendChild(ov);
}

function actualizarBadges(){
  const bt=document.getElementById('fm-badge-tareas');
  const bn=document.getElementById('fm-badge-notif');
  const pend=misTareas.filter(t=>t.estatus==='Pendiente'||t.estatus==='En proceso').length;
  const notif=misPipelineNotif.filter(n=>!n.leido).length;
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
  else if(v==='chksemanal')renderChkSemanal();
};

// ══════════════════════════════════════════════════════════
// SELECTOR DE FLOTA — solo para admin / encargado de flotilla
// ══════════════════════════════════════════════════════════
function _tarjetaVeh(v){
  const oc=(window._fmEcosOcupados||{})[String(v.eco)];
  const transf=(window._fmEcosEnTransferencia||{})[String(v.eco)];
  if(transf&&!oc){
    // Vehículo en proceso de transferencia — pendiente de recepción
    return `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;border:1.5px solid #FED7AA;background:#FFF7ED;margin-bottom:6px;opacity:.85">
      <div style="width:36px;height:36px;border-radius:9px;background:#FB923C;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:#9A3412">${v.unidad||'—'} — En transferencia</div>
        <div style="font-size:10.5px;color:#C2410C;margin-top:1px">ECO ${v.eco} · Pendiente de recepción por ${transf.nombre}</div>
      </div>
      <div style="font-size:9px;font-weight:700;color:#EA580C;background:#FFEDD5;border-radius:6px;padding:3px 7px">Pendiente</div>
    </div>`;
  }
  if(oc){
    return `<div style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;border:1.5px solid #FECACA;background:#FEF2F2;margin-bottom:6px;opacity:.85">
      <div style="width:36px;height:36px;border-radius:9px;background:#FCA5A5;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:#B91C1C">${v.unidad||'—'} — Ocupado</div>
        <div style="font-size:10.5px;color:#DC2626;margin-top:1px">ECO ${v.eco} · En uso por: ${oc.nombre}</div>
      </div>
      <div style="font-size:9px;font-weight:700;color:#EF4444;background:#FEE2E2;border-radius:6px;padding:3px 7px">En uso</div>
    </div>`;
  }
  return `<div onclick="fmSeleccionarVeh('${v.eco}')" style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;border:1.5px solid #E8EDF5;background:#fff;cursor:pointer;transition:.12s;margin-bottom:6px" onmouseover="this.style.borderColor='#2563EB';this.style.background='#EFF6FF'" onmouseout="this.style.borderColor='#E8EDF5';this.style.background='#fff'">
    <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#0A1628,#1E3A5F);display:flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.8" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11a2 2 0 012 2v6h-2"/><path d="M7 9l2-4h6l2 4"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
    </div>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:800;color:#0A0F1E">${v.unidad||'—'}</div>
      <div style="font-size:10.5px;color:#64748B;margin-top:1px">ECO ${v.eco} · ${v.placas||'—'} · ${v.plaza||'—'}</div>
    </div>
    <div style="font-size:10px;font-weight:700;color:#94A3B8">${v.responsable||'Sin asignar'}</div>
  </div>`;
}

function _renderSelectorLista(todos){
  const lista=document.getElementById('fm-selector-lista');
  if(!lista)return;
  const autos=todos.filter(v=>v.tipo==='auto');
  const camionetas=todos.filter(v=>v.tipo==='camioneta');
  const camiones=todos.filter(v=>v.tipo==='camion');
  const grp=(label,lst)=>lst.length?`<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;padding:8px 0 4px">${label}</div>`+lst.map(_tarjetaVeh).join(''):'';
  lista.innerHTML=(grp('Autos',autos)+grp('Camionetas',camionetas)+grp('Camiones / Grúas',camiones))||'<div style="text-align:center;padding:40px;color:#94A3B8;font-size:13px">Sin vehículos en catálogo</div>';
}

function renderSelectorFlota(){
  const todos=(window._fmAllVehs?.length?window._fmAllVehs:window.CAT_FL)||[];
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Seleccionar vehículo</div>
        <div class="fm-sec-s">${miPerfil?.rol==='flotilla'||miPerfil?.rol==='encargado'?'Encargado de Flotilla':'Administrador'} · ${todos.length} unidades</div>
      </div>
    </div>
    <div style="margin-bottom:12px">
      <input id="fm-selector-q" type="search" placeholder="Buscar ECO, unidad, placas, responsable..." style="width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:11px;font-size:13px;background:#fff;outline:none;box-sizing:border-box" oninput="fmFiltrarSelector(this.value)">
    </div>
    <div id="fm-selector-lista"><div style="text-align:center;padding:30px;color:#94A3B8;font-size:13px">Verificando disponibilidad…</div></div>
  `);
  db.collection(C.USUARIOS).get().then(snapU=>{
    const ocupados={};
    // Marcar ECOs que están en proceso de transferencia pendiente
    const enTransferencia={};
    snapU.docs.forEach(d=>{
      const u=d.data();
      if(u.transferenciaPendienteEco){
        enTransferencia[String(u.transferenciaPendienteEco)]={nombre:u.nombre||u.email||'otro técnico'};
      }
      // Leer ecosVinculados (array) Y ecoVinculado (campo simple) — ambos formatos
      const ecos=[
        ...(Array.isArray(u.ecosVinculados)?u.ecosVinculados.map(String):[]),
        ...(u.ecoVinculado?[String(u.ecoVinculado)]:[]),
        ...(u.ecoActual?[String(u.ecoActual)]:[]),
      ].filter((e,i,a)=>e&&a.indexOf(e)===i); // únicos
      ecos.forEach(e=>{ if(e&&u.email!==miPerfil?.email) ocupados[e]={nombre:u.nombre||u.displayName||u.email||'Otro usuario'}; });
    });
    window._fmEcosOcupados=ocupados;
    window._fmEcosEnTransferencia=enTransferencia;
    _renderSelectorLista(todos);
  }).catch(()=>{ window._fmEcosOcupados={}; window._fmEcosEnTransferencia={}; _renderSelectorLista(todos); });
}

window.fmFiltrarSelector = function(q){
  const todos=(window._fmAllVehs?.length?window._fmAllVehs:window.CAT_FL)||[];
  const qn=q.toLowerCase();
  const filtrados=q?todos.filter(v=>
    String(v.eco).includes(qn)||
    (v.unidad||'').toLowerCase().includes(qn)||
    (v.placas||'').toLowerCase().includes(qn)||
    (v.responsable||'').toLowerCase().includes(qn)||
    (v.plaza||'').toLowerCase().includes(qn)
  ):todos;
  const lista=document.getElementById('fm-selector-lista');
  if(!lista)return;
  if(!filtrados.length){lista.innerHTML='<div style="text-align:center;padding:30px;color:#94A3B8;font-size:13px">Sin resultados</div>';return;}
  lista.innerHTML=filtrados.map(_tarjetaVeh).join('');
};

window.fmSeleccionarVeh = async function(eco){
  // Verificar si está en proceso de transferencia pendiente
  const transf=(window._fmEcosEnTransferencia||{})[String(eco)];
  if(transf){toast(`ECO ${eco} tiene una transferencia pendiente de recepción`,'err');return;}
  // Verificar si está ocupado por otro usuario
  const oc=(window._fmEcosOcupados||{})[String(eco)];
  if(oc){toast(`ECO ${eco} está en uso por ${oc.nombre}`,'err');return;}
  // Buscar en Firestore primero, luego catálogo local
  try{
    const snap=await db.collection(C.VEHS).where('eco','==',String(eco)).get();
    if(!snap.empty){miVeh={id:snap.docs[0].id,...snap.docs[0].data()};}
    else{
      const found=window.CAT_FL?.find(v=>String(v.eco)===String(eco));
      miVeh=found?{id:'eco-'+found.eco,...found}:null;
    }
  }catch{
    const found=window.CAT_FL?.find(v=>String(v.eco)===String(eco));
    miVeh=found?{id:'eco-'+found.eco,...found}:null;
  }
  if(!miVeh){toast('Vehículo no encontrado','err');return;}
  guardarUltimoEco(miVeh.eco);
  // Cargar solicitudes de ese vehículo
  await cargarMisSols();
  renderVehiculo();
};

// ══════════════════════════════════════════
// VISTA 1 — MI VEHÍCULO
// ══════════════════════════════════════════
function renderVehiculo(){
  // Rol libre sin vehículo seleccionado → mostrar selector
  if(esRolLibre()&&!miVeh){
    renderSelectorFlota();return;
  }
  // Técnico normal sin vehículo(s) vinculado(s) → mostrar vinculación
  // (puede llegar aquí después de completar una transferencia de entrega)
  if(!esRolLibre()&&(!getEcosVinculados().length||!miVeh)){
    // Cargar vehículos automáticamente si aún no están en memoria
    if(!window._fmAllVehs||window._fmAllVehs.length===0){
      renderVincular(); // muestra pantalla de espera
      fmCargarVehs();  // carga en background y vuelve a renderizar
    } else {
      renderVincular();
    }
    return;
  }
  const v=miVeh;
  const d=hD(v.pv);
  const pvOk=d===null||d>=90;
  const offline=JSON.parse(localStorage.getItem(C.OFFLINE_KEY)||'[]');
  const solsPend=misSols.filter(s=>['Solicitud','Validada','Cotización'].includes(s.estatus));
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">${esRolLibre()?'Vehículo seleccionado':'Mi vehículo'}</div>
        <div class="fm-sec-s">ECO ${v.eco} · ${new Date().toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'})}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        ${esRolLibre()?`<button onclick="adminCambiarVehiculo()" style="padding:7px 11px;border:1.5px solid #CBD5E1;border-radius:9px;background:#F1F5F9;color:#475569;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>Cambiar</button>`:''}
        ${!esRolLibre()&&getEcosVinculados().length>1?`<button onclick="fmCambiarUnidad()" style="padding:7px 11px;border:1.5px solid #CBD5E1;border-radius:9px;background:#F1F5F9;color:#475569;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>Mis unidades</button>`:''}
        <button onclick="fmVista('solicitud')" class="fm-btn primary fm-btn-sm" style="gap:5px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Solicitud
        </button>
      </div>
    </div>

    ${semChkBanner()}

    ${offline.length?`<div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:10px;padding:10px 12px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#B45309">${IC.wifi} ${offline.length} solicitud(es) sin sincronizar</div>
        <div style="display:flex;gap:6px">
          <button onclick="fmSyncOffline()" style="padding:5px 10px;background:#B45309;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Sincronizar</button>
          <button onclick="fmVerOffline()" style="padding:5px 10px;background:rgba(180,83,9,.15);color:#B45309;border:1px solid #FDE68A;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer">Ver / Borrar</button>
        </div>
      </div>
    </div>`:''}

    <!-- CARD VEHÍCULO -->
    <div class="fm-card" style="background:linear-gradient(135deg,#0A1628,#1E3A5F);color:#fff;border:none">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div class="fm-veh-eco">${v.eco}</div>
          <div class="fm-veh-name" style="color:#fff">${v.unidad||'—'}</div>
          <div class="fm-veh-sub" style="color:rgba(255,255,255,.55)">${v.placas||'—'} · ${v.año||'—'}</div>
        </div>
        <div style="background:rgba(255,255,255,.1);border-radius:10px;padding:8px 12px;text-align:center">
          <div style="display:flex;justify-content:center;align-items:center;height:32px">${IC.car}</div>
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
        <div class="fm-sol-meta">${hF(s.creadoEn)} · ${s.prioridad||'Normal'}</div>
      </div>`).join('')
    :`<div class="fm-empty" style="padding:20px"><div class="fm-empty-ico">${IC.doc}</div><p style="font-size:13px;color:#94A3B8">Sin solicitudes registradas</p></div>`}
    <div style="height:20px"></div>
  `);
}

// MODAL — CAMBIAR UNIDAD (técnicos con varios vehículos/maquinaria asignados)
window.fmCambiarUnidad=async function(){
  const ecos=getEcosVinculados();
  if(ecos.length<2)return;
  const ov=document.createElement('div');
  ov.className='fm-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML=`
    <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:520px;padding:24px 20px 32px;box-shadow:0 -4px 30px rgba(0,0,0,.15)">
      <div style="width:40px;height:4px;background:#E2E8F0;border-radius:4px;margin:0 auto 20px"></div>
      <div style="font-size:16px;font-weight:800;color:#0A1628;margin-bottom:4px">Mis unidades</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:18px">Selecciona el vehículo o maquinaria que usarás ahora</div>
      <div id="fm-cu-lista" style="display:flex;flex-direction:column;gap:8px">
        <div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">Cargando…</div>
      </div>
      <button class="fm-btn ghost" style="margin-top:14px" onclick="this.closest('.fm-ov').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});

  const lista=document.getElementById('fm-cu-lista');
  const vehs=await Promise.all(ecos.map(eco=>cargarVehiculoPorEco(eco)));
  // ECOs con transferencia pendiente — no se pueden reusar hasta que el receptor confirme
  const ecoPendiente=String(miPerfil?.transferenciaPendienteEco||'');
  lista.innerHTML=vehs.map((v,i)=>{
    if(!v)return'';
    const activo=String(v.eco)===String(miVeh?.eco);
    const pendiente=ecoPendiente&&String(v.eco)===ecoPendiente;
    if(pendiente){
      return`<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:11px;border:1.5px solid #FED7AA;background:#FFF7ED;opacity:.8">
        <div style="width:36px;height:36px;border-radius:9px;background:#FB923C;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:800;color:#9A3412">${v.unidad||'—'} — En transferencia</div>
          <div style="font-size:10.5px;color:#C2410C;margin-top:1px">ECO ${v.eco} · Pendiente de recepción por el destinatario</div>
        </div>
        <span style="font-size:9px;font-weight:700;color:#EA580C;background:#FFEDD5;border-radius:6px;padding:3px 7px;white-space:nowrap">Pendiente</span>
      </div>`;
    }
    return`<div onclick="fmUsarUnidad('${v.eco}')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:11px;border:1.5px solid ${activo?'#2563EB':'#E8EDF5'};background:${activo?'#EFF6FF':'#fff'};cursor:pointer">
      <div style="width:36px;height:36px;border-radius:9px;background:linear-gradient(135deg,#0A1628,#1E3A5F);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="1.8" stroke-linecap="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11a2 2 0 012 2v6h-2"/><path d="M7 9l2-4h6l2 4"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:#0A0F1E">${v.unidad||'—'}</div>
        <div style="font-size:10.5px;color:#64748B;margin-top:1px">ECO ${v.eco} · ${v.placas||'—'} · ${v.plaza||'—'}</div>
      </div>
      ${activo?`<span style="font-size:10px;font-weight:800;color:#2563EB">En uso</span>`:''}
    </div>`;
  }).join('')||'<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px">No se encontraron tus unidades asignadas</div>';
};

window.fmUsarUnidad=async function(eco){
  // Bloquear si el ECO tiene una transferencia pendiente de confirmación
  if(miPerfil?.transferenciaPendienteEco&&String(eco)===String(miPerfil.transferenciaPendienteEco)){
    toast(`ECO ${eco} tiene una transferencia pendiente — espera a que el receptor confirme con su firma`,'err');
    return;
  }
  const v=await cargarVehiculoPorEco(eco);
  if(!v){toast('Vehículo no encontrado','err');return;}
  if(!esRolLibre()&&!_vehiculoAsignadoA(v,window.auth?.currentUser)){
    toast(`ECO ${eco} ya no está asignado a ti. Pide a un administrador que lo verifique.`,'err');
    return;
  }
  miVeh=v;
  guardarUltimoEco(eco);
  await cargarMisSols();
  document.querySelector('.fm-ov')?.remove();
  toast(`Usando ECO ${eco} · ${v.unidad||''}`,'ok');
  renderVehiculo();
};

// MODAL CAMBIO DE VEHÍCULO (solo admins)
window.adminCambiarVehiculo=function(){
  if(!esRolLibre())return;
  const todos=(window._fmAllVehs?.length?window._fmAllVehs:window.CAT_FL)||[];
  const opciones=todos
    .filter(v=>v.status!=='baja')
    .sort((a,b)=>Number(a.eco)-Number(b.eco))
    .map(v=>`<option value="${v.eco}" ${String(v.eco)===String(miVeh?.eco)?'selected':''}>${v.eco} · ${v.unidad} (${v.plaza})</option>`)
    .join('');

  // Overlay
  const ov=document.createElement('div');
  ov.className='fm-ov';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML=`
    <div style="background:#fff;border-radius:20px 20px 0 0;width:100%;max-width:520px;padding:24px 20px 32px;box-shadow:0 -4px 30px rgba(0,0,0,.15)">
      <div style="width:40px;height:4px;background:#E2E8F0;border-radius:4px;margin:0 auto 20px"></div>
      <div style="font-size:16px;font-weight:800;color:#0A1628;margin-bottom:4px">Cambiar vehículo</div>
      <div style="font-size:12px;color:#64748B;margin-bottom:18px">Solo afecta tu sesión actual o tu vínculo permanente</div>

      <label style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:6px">Vehículo</label>
      <select id="adm-veh-sel" style="width:100%;padding:11px 14px;border:1.5px solid #CBD5E1;border-radius:10px;font-size:13px;font-weight:600;color:#0A1628;background:#F8FAFC;margin-bottom:18px;-webkit-appearance:none;appearance:none">
        <option value="">-- Selecciona un vehículo --</option>
        ${opciones}
      </select>

      <label style="font-size:11px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.4px;display:block;margin-bottom:10px">Tipo de cambio</label>
      <div style="display:flex;gap:10px;margin-bottom:22px">
        <label id="adm-opt-temp" style="flex:1;border:2px solid #3B82F6;border-radius:12px;padding:12px 14px;cursor:pointer;background:#EFF6FF;display:flex;align-items:flex-start;gap:10px">
          <input type="radio" name="adm-tipo" value="temporal" checked style="margin-top:2px;accent-color:#3B82F6">
          <div>
            <div style="font-size:13px;font-weight:700;color:#1E40AF">Temporal</div>
            <div style="font-size:11px;color:#3B82F6;margin-top:2px">Solo esta sesión · Tu ECO vinculado no cambia</div>
          </div>
        </label>
        <label id="adm-opt-perm" style="flex:1;border:2px solid #E2E8F0;border-radius:12px;padding:12px 14px;cursor:pointer;background:#F8FAFC;display:flex;align-items:flex-start;gap:10px">
          <input type="radio" name="adm-tipo" value="permanente" style="margin-top:2px;accent-color:#0A1628">
          <div>
            <div style="font-size:13px;font-weight:700;color:#0A1628">Permanente</div>
            <div style="font-size:11px;color:#64748B;margin-top:2px">Actualiza tu ecoVinculado en Firestore</div>
          </div>
        </label>
      </div>

      <div style="display:flex;gap:10px">
        <button onclick="this.closest('.fm-ov').remove()" style="flex:1;padding:13px;border:1.5px solid #E2E8F0;border-radius:12px;background:#fff;font-size:13px;font-weight:700;color:#64748B;cursor:pointer">Cancelar</button>
        <button id="adm-btn-confirmar" onclick="adminConfirmarCambioVeh(this)" style="flex:2;padding:13px;border:none;border-radius:12px;background:#0A1628;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Confirmar cambio</button>
      </div>
    </div>`;

  // Estilo visual de los radio buttons al hacer click
  ov.querySelectorAll('input[name="adm-tipo"]').forEach(r=>{
    r.addEventListener('change',()=>{
      ov.querySelector('#adm-opt-temp').style.cssText=ov.querySelector('#adm-opt-temp').style.cssText.replace(/border:[^;]+/,'border:2px solid #E2E8F0').replace(/background:[^;]+/,'background:#F8FAFC');
      ov.querySelector('#adm-opt-perm').style.cssText=ov.querySelector('#adm-opt-perm').style.cssText.replace(/border:[^;]+/,'border:2px solid #E2E8F0').replace(/background:[^;]+/,'background:#F8FAFC');
      const activo=ov.querySelector('input[name="adm-tipo"]:checked').value==='temporal'?'#adm-opt-temp':'#adm-opt-perm';
      const el=ov.querySelector(activo);
      el.style.border='2px solid #3B82F6';el.style.background='#EFF6FF';
    });
  });

  document.body.appendChild(ov);
};

window.adminConfirmarCambioVeh=async function(btn){
  const sel=document.getElementById('adm-veh-sel');
  const eco=sel?.value;
  if(!eco){toast('Selecciona un vehículo','err');return;}
  const tipo=document.querySelector('input[name="adm-tipo"]:checked')?.value||'temporal';
  btn.disabled=true;btn.textContent='Cambiando…';
  try{
    // Buscar el vehículo en Firestore o catálogo
    let veh=null;
    try{
      const snap=await db.collection(C.VEHS).where('eco','==',String(eco)).get();
      if(!snap.empty)veh={id:snap.docs[0].id,...snap.docs[0].data()};
    }catch(_){}
    if(!veh){
      const found=window.CAT_FL?.find(v=>String(v.eco)===String(eco));
      if(found)veh={id:'eco-'+found.eco,...found};
    }
    if(!veh){toast('Vehículo no encontrado','err');btn.disabled=false;btn.textContent='Confirmar cambio';return;}

    // Aplicar cambio
    miVeh=veh;
    guardarUltimoEco(eco);
    if(tipo==='permanente'){
      const snap=await db.collection(C.USUARIOS).where('email','==',miPerfil.email).get();
      if(!snap.empty){
        await snap.docs[0].ref.update({ecoVinculado:String(eco),ecosVinculados:[String(eco)],vinculadoEn:new Date().toISOString()});
      }
      flRegistrarVinculacion(eco,miPerfil.email,miPerfil.nombre||miPerfil.email);
      flSincronizarResponsable(eco,miPerfil.nombre||miPerfil.email);
      if(miPerfil){miPerfil.ecoVinculado=String(eco);miPerfil.ecosVinculados=[String(eco)];}
      toast(`ECO ${eco} vinculado permanentemente`,'ok');
    } else {
      toast(`ECO ${eco} seleccionado (sesión actual)`,'ok');
    }
    document.querySelector('.fm-ov')?.remove();
    renderVehiculo();
  }catch(e){
    toast('Error: '+e.message,'err');
    btn.disabled=false;btn.textContent='Confirmar cambio';
  }
};

// PANTALLA DE VINCULACIÓN
function renderVincular(){
  const allVehs=window._fmAllVehs||[];
  // Intentar pre-seleccionar vehículo por nombre del responsable
  const nombreUsuario=(miPerfil?.nombre||'').toUpperCase().trim();
  const emailUsuario=(miPerfil?.email||'').toLowerCase().trim();
  const sugerido=allVehs.find(v=>{
    const resp=(v.responsable||'').toUpperCase().trim();
    if(!resp||resp==='—')return false;
    // Comparar por nombre completo o parcial
    const partes=nombreUsuario.split(' ');
    return resp===nombreUsuario||
           partes.some(p=>p.length>3&&resp.includes(p))||
           resp.includes(emailUsuario.split('@')[0].toUpperCase());
  });
  setContent(`
    <div style="padding-top:20px">
      <div class="fm-vincular">
        <div class="fm-empty-ico" style="color:#1E3A5F">${IC.link}</div>
        <h2>Vincular mi vehículo</h2>
        <p>Selecciona el vehículo que tienes asignado. Esto se guarda en tu perfil y no podrá cambiarse sin autorización.</p>
        ${allVehs.length?`
        <div class="fm-fld">
          <label>Selecciona tu vehículo</label>
          ${sugerido?`<div style="background:#EFF6FF;border:1.5px solid #3B82F6;border-radius:10px;padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;gap:10px">
            <div style="flex:1"><div style="font-size:12px;color:#1E40AF;font-weight:700">Vehículo sugerido por asignación</div><div style="font-size:14px;font-weight:800;color:#1E3A5F">ECO ${sugerido.eco} · ${sugerido.unidad}</div><div style="font-size:11px;color:#64748B">${sugerido.placas} · ${sugerido.plaza}</div></div></div>`:''}
          <div class="fm-select-wrap">
            <select id="fm-sel-veh">
              <option value="">— Selecciona —</option>
              ${allVehs.filter(v=>v.status!=='baja').map(v=>`<option value="${v.eco}" ${sugerido&&v.eco===sugerido.eco?'selected':''}>ECO ${v.eco} · ${v.unidad} · ${v.placas}</option>`).join('')}
            </select>
          </div>
        </div>
        <button class="fm-btn primary" onclick="fmVincular()">Vincular este vehículo</button>`:`
        <div style="text-align:center;padding:20px 0">
          <div style="font-size:13px;color:#64748B;margin-bottom:16px">Cargando lista de vehículos...</div>
          <div style="width:36px;height:36px;border:3px solid #E2E8F0;border-top-color:#3B82F6;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto"></div>
        </div>`}
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

// ── HISTORIAL DE USO: registra quién vinculó/desvinculó cada ECO y cuándo ──
// (colección flotilla_usos — no confundir con ecoVinculado, que solo guarda el estado actual)
async function flRegistrarVinculacion(eco,email,nombre){
  try{
    // Por seguridad, cierra cualquier registro abierto previo de este mismo usuario
    const abiertas=await db.collection(C.USOS).where('email','==',email).where('activo','==',true).get();
    const ahora=new Date().toISOString();
    const ops=[];
    abiertas.forEach(d=>ops.push(d.ref.update({desvinculadoEn:ahora,activo:false,motivo:'Nueva vinculación'})));
    ops.push(db.collection(C.USOS).add({eco:String(eco),email,nombre:nombre||email,vinculadoEn:ahora,desvinculadoEn:null,activo:true}));
    await Promise.all(ops);
  }catch(e){console.error('[FL uso] registrar vinculación',e);}
}
async function flRegistrarDesvinculacion(email,motivo){
  try{
    const abiertas=await db.collection(C.USOS).where('email','==',email).where('activo','==',true).get();
    const ahora=new Date().toISOString();
    await Promise.all(abiertas.docs.map(d=>d.ref.update({desvinculadoEn:ahora,activo:false,motivo:motivo||'Desvinculado'})));
  }catch(e){console.error('[FL uso] registrar desvinculación',e);}
}

// ── Mantiene 'Responsable Asignado' del vehículo sincronizado con quién está vinculado de verdad ──
// Al vincularse: responsable = nombre de quien se vinculó.
// Al desvincularse: responsable queda vacío ('—') hasta que alguien lo reasigne a mano.
async function flSincronizarResponsable(eco,nombreOVacio){
  if(!eco)return;
  try{
    const snap=await db.collection(C.VEHS).where('eco','==',String(eco)).get();
    if(snap.empty)return;
    await Promise.all(snap.docs.map(d=>d.ref.update({responsable:nombreOVacio||'—'})));
  }catch(e){console.error('[FL] sincronizar responsable',e);}
}

// ── BLOQUEO: nadie puede usar un vehículo a menos que le haya sido asignado
// (desde la plataforma en Configuración, o mediante una transferencia
// completada) — ANTES cualquier técnico podía autoasignarse cualquier
// vehículo del catálogo con solo elegirlo de la lista, sin validación
// alguna. No aplica a rol libre (admin/flotilla/encargado): ellos sí
// necesitan poder moverse libremente por toda la flota.
function _normNombre(s){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function _vehiculoAsignadoA(v,user){
  if(!v)return false;
  const email=_normNombre(user?.email);
  const nombre=_normNombre(user?.displayName||miPerfil?.nombre);
  const resp=_normNombre(v.responsable);
  if(!resp||resp==='—')return false;
  if(email&&resp===email)return true;
  if(!nombre)return false;
  // Coincidencia por tokens — permite "Sergio Carmona" == "Carmona Lagunas Sergio"
  // (nombres capturados en distinto orden entre el Excel original y el login).
  const tokensNombre=nombre.split(/\s+/).filter(Boolean);
  const tokensResp=resp.split(/\s+/).filter(Boolean);
  if(!tokensNombre.length||!tokensResp.length)return false;
  return tokensNombre.every(t=>tokensResp.includes(t))||tokensResp.every(t=>tokensNombre.includes(t));
}

window.fmVincular=async function(){
  const eco=document.getElementById('fm-sel-veh')?.value;
  if(!eco){toast('Selecciona un vehículo','err');return;}
  const user=window.auth?.currentUser;
  if(!user){toast('No hay sesión activa','err');return;}
  if(!esRolLibre()){
    try{
      const snapV=await db.collection(C.VEHS).where('eco','==',String(eco)).get();
      const v=snapV.empty?window.CAT_FL?.find(x=>String(x.eco)===String(eco)):{id:snapV.docs[0].id,...snapV.docs[0].data()};
      if(!_vehiculoAsignadoA(v,user)){
        toast(`ECO ${eco} no te ha sido asignado. Pide a un administrador que te lo asigne desde la plataforma o mediante una transferencia.`,'err');
        return;
      }
    }catch(e){console.warn('[FL] validar asignación',e);toast('No se pudo validar la asignación, intenta de nuevo','err');return;}
  }
  try{
    const snap=await db.collection(C.USUARIOS).where('email','==',user.email).get();
    const datos={email:user.email,nombre:user.displayName||user.email,ecoVinculado:String(eco),ecosVinculados:[String(eco)],vinculadoEn:new Date().toISOString()};
    if(snap.empty){await db.collection(C.USUARIOS).add(datos);}
    else{await db.collection(C.USUARIOS).doc(snap.docs[0].id).update({ecoVinculado:String(eco),ecosVinculados:[String(eco)],vinculadoEn:new Date().toISOString()});}
    flRegistrarVinculacion(eco,user.email,user.displayName||user.email);
    flSincronizarResponsable(eco,user.displayName||user.email);
    flReportarUbicacion(eco);
    miPerfil={...miPerfil,...datos};
    guardarUltimoEco(eco);
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
  solState={tipo:'',prior:'Normal',desc:'',km:'',gasolina:50,chk:{},chkFotos:{},evFotos:[]};
  // ── Regla de checklist según el día ──
  // Lunes/Martes/Miércoles + checklist semanal de esta semana ya hecho → confirmación + firma
  // Jueves..Domingo, o checklist semanal no hecho → checklist interno normal
  const semCompletado=chkSemCompletadoActual(()=>{if(vistaAct==='solicitud')renderNuevaSol();});
  const modoConfirmacion=!esMaquinaria(miVeh)&&esLunesAMiercoles()&&semCompletado===true;
  solState.modoConfirmacion=modoConfirmacion;
  const _solDraft=_draftLoad(_DRAFT.SOL);
  if(_solDraft&&Object.keys(_solDraft.chk||{}).length>0){
    setTimeout(()=>_draftBanner('sol',
      ()=>{
        // Restaurar estado y re-renderizar el formulario completo
        Object.assign(solState,_solDraft);
        solState.modoConfirmacion=modoConfirmacion; // no confiar en el borrador para esta regla — depende del día/semana actual
        // Re-pintar checklist con valores guardados
        const chkList=document.getElementById('fm-chk-list');
        if(chkList)chkList.innerHTML=renderChkMovil();
        // Re-pintar gasolina
        const gasWrap=document.getElementById('fm-gauge-wrap');
        if(gasWrap)gasWrap.innerHTML=renderGaugeSVG(solState.gasolina)+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';
        const gasRange=document.getElementById('fm-gas');
        if(gasRange)gasRange.value=solState.gasolina;
        // Re-pintar km si existe
        const kmInput=document.getElementById('fm-km');
        if(kmInput&&solState.km)kmInput.value=solState.km;
        // Re-pintar descripción
        const descInput=document.getElementById('fm-desc');
        if(descInput&&solState.desc)descInput.value=solState.desc;
        // Re-pintar contador checklist
        const total=Object.values(CHK_CATS).flat().length;
        const rev=Object.values(solState.chk).filter(v=>v==='si'||v==='no').length;
        const cnt=document.getElementById('fm-chk-cnt');
        if(cnt)cnt.textContent=`${rev} de ${total} revisados`;
        // Re-pintar miniaturas de fotos guardadas en borrador
        Object.entries(solState.chkFotos||{}).forEach(([k,foto])=>{
          const src=typeof foto==='object'?foto.src:foto;
          const cam=document.getElementById('fm-cam-'+k);
          if(cam&&src)cam.innerHTML=`<img src="${src}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`;
        });
        toast('Borrador restaurado ✓','ok');
      },
      ()=>{ _draftClear(_DRAFT.SOL); }
    ),400);
  }
  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Nueva solicitud</div>
        <div class="fm-sec-s">ECO ${miVeh.eco} · ${miVeh.unidad}</div>
      </div>
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

    <!-- KM -->
    <div class="fm-fld"><label>KM actual</label><input type="number" id="fm-km" placeholder="${miVeh.km||0}" inputmode="numeric"></div>

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
      <label>Fotos obligatorias del vehículo <span style="font-size:9px;font-weight:500;text-transform:none;color:#EF4444">(4 ángulos requeridos)</span></label>
      <div style="font-size:10px;color:#64748B;margin-bottom:10px;line-height:1.5">Toma cada ángulo requerido antes de continuar.</div>
      <div id="fm-angulos-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">${renderAngulosBasicosGrid(solState.evFotos,'sol')}</div>
      <label>Evidencias adicionales <span style="font-weight:500;text-transform:none;font-size:9px;color:#94A3B8">(opcional, cámara obligatoria)</span></label>
      <button onclick="fmCapturar('general')" class="fm-btn primary" style="margin-bottom:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Tomar foto con cámara
      </button>
      <div id="fm-ev-wrap" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>

    <!-- CHECKLIST RÁPIDO / CONFIRMACIÓN SEMANAL -->
    <div class="fm-fld">
      ${modoConfirmacion?`
        <div class="fm-card" style="background:#EFF6FF;border:1.5px solid #BFDBFE;padding:14px;border-radius:10px">
          <div style="font-size:13px;font-weight:800;color:#1D4ED8;margin-bottom:4px">Check list semanal ya completado</div>
          <div style="font-size:12px;color:#1E40AF;line-height:1.4;margin-bottom:10px">Confirmo que mi vehículo está en las mismas condiciones que mi checklist de esta semana.</div>
          <label id="fm-confirm-lbl" style="display:flex;align-items:center;gap:8px;font-size:12px;color:#1E3A5F;cursor:pointer;margin-bottom:10px;padding:8px 10px;border-radius:8px;border:1.5px solid #BFDBFE;background:#fff;transition:all .12s">
            <input type="checkbox" id="fm-confirm-chk" onchange="window._fmActualizarHint?.();document.getElementById('fm-confirm-lbl').style.background=this.checked?'#DCFCE7':'#fff';document.getElementById('fm-confirm-lbl').style.borderColor=this.checked?'#86EFAC':'#BFDBFE';" style="width:20px;height:20px;accent-color:#15803D;flex-shrink:0">
            Confirmo la declaración anterior
          </label>
          <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma <span style="color:#DC2626">*</span></div>
          <div style="border:1.5px solid #E2E8F0;border-radius:10px;overflow:hidden;background:#fff">
            <canvas id="fm-sol-confirm-firma" width="320" height="180" style="display:block;width:100%;height:150px;touch-action:none;cursor:crosshair"></canvas>
          </div>
          <button type="button" class="fm-btn ghost fm-btn-sm" onclick="limpiarFirma('fm-sol-confirm-firma')" style="margin-top:8px">Limpiar firma</button>
        </div>
      `:`
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <label style="margin:0">${esMaquinaria(miVeh)?'Fotos de la unidad':'Check list'}</label>
          <span id="fm-chk-cnt" style="font-size:10px;color:#64748B">${esMaquinaria(miVeh)?'4 fotos requeridas':`0 de ${Object.values(CHK_CATS).flat().length} revisados`}</span>
        </div>
        <div id="fm-chk-list">${esMaquinaria(miVeh)?renderMaqFotos('sol'):renderChkMovil()}</div>
      `}
    </div>

    <!-- BOTÓN GUARDAR -->
    <button class="fm-btn primary" onclick="fmGuardar()" id="fm-btn-guardar" style="margin-top:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      Crear solicitud
    </button>
    <div id="fm-val-hint" style="font-size:11px;color:#94A3B8;text-align:center;margin-top:6px;min-height:16px"></div>
    <div style="height:20px"></div>
  `);
  // Live validation hint — update as user fills fields
  function fmActualizarHint(){
    const faltantes=[];
    if(!document.getElementById('fm-tipo')?.value) faltantes.push('tipo');
    if(!document.getElementById('fm-desc')?.value?.trim()) faltantes.push('descripción');
    if(!document.getElementById('fm-km')?.value?.trim()) faltantes.push('kilometraje');
    if(!solState.evFotos?.length) faltantes.push('al menos 1 foto de evidencia');
    if(modoConfirmacion){
      if(!document.getElementById('fm-confirm-chk')?.checked) faltantes.push('confirmación de condiciones');
      if(!firmaTieneTrazo('fm-sol-confirm-firma')) faltantes.push('firma');
    } else if(esMaquinaria(miVeh)){
      const nMaq=MAQ_FOTOS.filter((_,i)=>solState.chkFotos[`maq__${i}`]).length;
      if(nMaq<4) faltantes.push(`fotos de la unidad (${nMaq}/4)`);
    } else {
      const resp=Object.values(solState.chk).filter(v=>v==='si'||v==='no').length;
      const tot=Object.values(CHK_CATS).flat().length;
      if(resp<tot) faltantes.push(`checklist (${resp}/${tot})`);
    }
    const hint=document.getElementById('fm-val-hint');
    if(hint) hint.textContent=faltantes.length?`Pendiente: ${faltantes.join(' · ')}`:'✓ Formulario completo';
    if(hint) hint.style.color=faltantes.length?'#94A3B8':'#15803D';
  }
  // Attach listeners
  setTimeout(()=>{
    ['fm-tipo','fm-desc','fm-km'].forEach(id=>{
      document.getElementById(id)?.addEventListener('input',fmActualizarHint);
      document.getElementById(id)?.addEventListener('change',fmActualizarHint);
    });
    if(modoConfirmacion) initFirmaCanvas('fm-sol-confirm-firma');
    // Expose so chk/photo updates can trigger it
    window._fmActualizarHint=fmActualizarHint;
    fmActualizarHint();
  },100);
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
  _draftSave(_DRAFT.SOL,solState);
  const w=document.getElementById('fm-gauge-wrap');
  if(w)w.innerHTML=renderGaugeSVG(Number(v))+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';
};


window.fmSetPrior=function(btn,p){
  solState.prior=p;
  document.querySelectorAll('[id^="fm-prior-"]').forEach(b=>{b.style.background='';b.style.color='';b.className='fm-btn ghost fm-btn-sm';b.style.flex='1';});
  btn.style.background='#1E3A5F';btn.style.color='#fff';
};

// Bloque de 4 fotos obligatorias para maquinaria (reemplaza el checklist).
// tgt='sol' → solState.chkFotos['maq__i'] · tgt='sem' → semState.chkFotos['sem-maq-i']
function renderMaqFotos(tgt){
  const st=tgt==='sem'?semState:solState;
  const keyOf=i=>tgt==='sem'?`sem-maq-${i}`:`maq__${i}`;
  const capTag=tgt==='sem'?",'sem'":"";
  const verFn=tgt==='sem'?'fmVerFotoChkSem':'fmVerFotoChk';
  let h='<div style="font-size:11px;color:#64748B;margin-bottom:8px">Sube las 4 fotos requeridas de la unidad.</div>';
  MAQ_FOTOS.forEach((lbl,i)=>{
    const key=keyOf(i);
    const fo=st.chkFotos[key];
    const src=fo?(typeof fo==='object'?fo.src:fo):'';
    h+=`<div class="fm-chk-row" id="fm-cr-${key}" style="align-items:center">
      <span class="fm-chk-name" style="flex:1">${i+1}. ${lbl}</span>
      <div class="fm-chk-cam ${src?'has':''}" onclick="${src?`${verFn}('${key}')`:`fmCapturar('chk','${key}'${capTag})`}" id="fm-cam-${key}">
        ${src?`<img src="${src}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`:
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`}
      </div>
    </div>`;
  });
  return h;
}

function renderChkMovil(){
  let h='';
  for(const [cat,items] of Object.entries(CHK_CATS)){
    h+=`<div class="fm-chk-cat">${cat}</div>`;
    items.forEach((item,i)=>{
      const key=`${cat}__${i}`;
      const val=solState.chk[key]||'';
      const hasFoto=!!solState.chkFotos[key];
      const comtVal1=(solState.chkComt&&solState.chkComt[key])||'';
      const inputComt1=val==='no'
        ?('<input type="text" placeholder="Describe el detalle..." value="'+comtVal1+'" onchange="fmChkComt(\'' +key+ '\',this.value)" style="width:100%;margin-top:5px;padding:6px 10px;border:1.5px solid #FECACA;border-radius:8px;font-size:11px;font-family:inherit;outline:none;background:#FFF5F5;box-sizing:border-box">')
        :'';
      h+=`<div class="fm-chk-row" id="fm-cr-${key}" style="flex-wrap:wrap">
        <span class="fm-chk-name">${item}</span>
        <button class="fm-chk-si ${val==='si'?'on':''}" onclick="fmChk('${key}','si')">SI</button>
        <button class="fm-chk-no ${val==='no'?'on':''}" onclick="fmChk('${key}','no')">NO</button>
        ${inputComt1}
        <div class="fm-chk-cam ${hasFoto?'has':''}" onclick="${hasFoto?`fmVerFotoChk('${key}')`:`fmCapturar('chk','${key}')`}" id="fm-cam-${key}">
          ${hasFoto?`<img src="${typeof solState.chkFotos[key]==='object'?solState.chkFotos[key].src:solState.chkFotos[key]}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`:
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`}
        </div>
      </div>`;
    });
  }
  return h;
}

window.fmChkComt=function(key,val){
  if(!solState.chkComt) solState.chkComt={};
  solState.chkComt[key]=val;
  _draftSave(_DRAFT.SOL,solState);
};

window.fmChkSemComt=function(key,val){
  if(!semState.chkComt) semState.chkComt={};
  semState.chkComt[key]=val;
  _draftSave(_DRAFT.SEM,semState);
};

window.fmChk=function(key,val){
  solState.chk[key]=solState.chk[key]===val?'':val;
  _draftSave(_DRAFT.SOL,solState);
  // Re-renderizar lista para mostrar/ocultar campo comentario
  const lista=document.getElementById('fm-sol-chk-list');
  if(lista)lista.innerHTML=renderSolChkList();
  else{
    const si=document.querySelector(`#fm-cr-${key} .fm-chk-si`);
    const no=document.querySelector(`#fm-cr-${key} .fm-chk-no`);
    if(si)si.classList.toggle('on',solState.chk[key]==='si');
    if(no)no.classList.toggle('on',solState.chk[key]==='no');
  }
  // Actualizar contador
  const total=Object.values(CHK_CATS).flat().length;
  const rev=Object.values(solState.chk).filter(v=>v==='si'||v==='no').length;
  const cnt=document.getElementById('fm-chk-cnt');
  if(cnt)cnt.textContent=`${rev} de ${total} revisados`;
  window._fmActualizarHint?.();
};

// ── CHECK LIST SEMANAL ──
// Los 4 ángulos principales — mismo concepto que los primeros 4 de
// UTIL_ANGULOS (Utilitarios), ahora también obligatorios en las evidencias
// generales de Solicitud y de Check list semanal.
const ANGULOS_BASICOS=[
  {key:'frente',    label:'Frente'},
  {key:'atras',     label:'Atrás'},
  {key:'derecha',   label:'Lado derecho'},
  {key:'izquierda', label:'Lado izquierdo'},
];
function renderAngulosBasicosGrid(evFotosArr,targetTag){
  return ANGULOS_BASICOS.map(a=>{
    const tomada=(evFotosArr||[]).find(f=>f?.meta?.angulo===a.key);
    const bg=tomada?'#F0FDF4':'#F8FAFD';
    const border=tomada?'2px solid #22C55E':'1.5px dashed #CBD5E1';
    const color=tomada?'#15803D':'#64748B';
    return`<button onclick="fmCapturar('angulo','${a.key}','${targetTag}')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:12px 6px;background:${bg};border:${border};border-radius:10px;font-family:inherit;cursor:pointer;min-height:78px;position:relative;overflow:hidden">
      ${tomada?`<img src="${tomada.src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.3">`:''}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${tomada?'#15803D':'#94A3B8'}" stroke-width="2" stroke-linecap="round" style="position:relative;z-index:1"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <span style="font-size:10px;font-weight:700;color:${color};position:relative;z-index:1">${tomada?'✓ ':''}<b>${a.label}</b></span>
    </button>`;
  }).join('');
}
function angulosBasicosFaltantes(evFotosArr){
  return ANGULOS_BASICOS.filter(a=>!(evFotosArr||[]).some(f=>f?.meta?.angulo===a.key));
}

function renderChkSemanalList(){
  let h='';
  for(const [cat,items] of Object.entries(CHK_CATS)){
    h+=`<div class="fm-chk-cat">${cat}</div>`;
    items.forEach((item,i)=>{
      const key=`sem-${cat}-${i}`;
      const val=semState.chk[key]||'';
      const hasFoto=!!semState.chkFotos[key];
      const comtVal2=(semState.chkComt&&semState.chkComt[key])||'';
      const inputComt2=val==='no'
        ?('<input type="text" placeholder="Describe el problema..." value="'+comtVal2+'" onchange="fmChkSemComt(\'' +key+ '\',this.value)" style="width:100%;margin-top:5px;padding:6px 10px;border:1.5px solid #FECACA;border-radius:8px;font-size:11px;font-family:inherit;outline:none;background:#FFF5F5;box-sizing:border-box">')
        :'';
      h+=`<div class="fm-chk-row" id="fm-cr-${key}" style="flex-wrap:wrap">
        <span class="fm-chk-name">${item}</span>
        <button class="fm-chk-si ${val==='si'?'on':''}" onclick="fmChkSem('${key}','si')">SI</button>
        <button class="fm-chk-no ${val==='no'?'on':''}" onclick="fmChkSem('${key}','no')">NO</button>
        ${inputComt2}
        <div class="fm-chk-cam ${hasFoto?'has':''}" onclick="${hasFoto?`fmVerFotoChkSem('${key}')`:`fmCapturar('chk','${key}','sem')`}" id="fm-cam-${key}">
          ${hasFoto?`<img src="${typeof semState.chkFotos[key]==='object'?semState.chkFotos[key].src:semState.chkFotos[key]}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`:
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`}
        </div>
      </div>`;
    });
  }
  return h;
}

window.fmChkSem=function(key,val){
  semState.chk[key]=semState.chk[key]===val?'':val;
  _draftSave(_DRAFT.SEM,semState);
  // Re-renderizar fila para mostrar/ocultar campo comentario
  const wrap=document.getElementById('fm-sem-chk-list');
  if(wrap)wrap.innerHTML=renderChkSemanalList();
  const total=Object.values(CHK_CATS).flat().length;
  const rev=Object.values(semState.chk).filter(v=>v==='si'||v==='no').length;
  const cnt=document.getElementById('fm-sem-chk-cnt');
  if(cnt)cnt.textContent=`${rev} de ${total} revisados`;
  // Update validation hint
  const hint=document.getElementById('fm-sem-val-hint');
  if(hint){
    const faltantes=[];
    if(!document.getElementById('fm-sem-km')?.value?.trim()) faltantes.push('kilometraje');
    if(rev<total) faltantes.push(`checklist (${rev}/${total})`);
    if(!firmaTieneTrazo('fm-sem-firma')) faltantes.push('firma');
    hint.textContent=faltantes.length?`Pendiente: ${faltantes.join(' · ')}`:'✓ Listo para guardar';
    hint.style.color=faltantes.length?'#94A3B8':'#15803D';
  }
};

window.fmGasSem=function(v){
  semState.gasolina=Number(v);
  _draftSave(_DRAFT.SEM,semState);
  const w=document.getElementById('fm-sem-gauge-wrap');
  if(w)w.innerHTML=renderGaugeSVG(Number(v))+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';
};

// ── VISTA: CHECK LIST SEMANAL ──
function renderChkSemanal(){
  if(!miVeh){fmVista('vehiculo');return;}
  const semana=getSemanaISO();
  const cacheKey=`${miVeh.eco}_${semana}`;
  const yaExiste=window._semChkCache[cacheKey];

  // Checklist adaptativo — cargar config antes de construir el formulario
  // (mismo patrón que _cfgSem: cache null → mostrar loader → re-pintar al terminar)
  if(window._chkAdaptCfg===null){
    cargarChkAdaptCfg().then(()=>{if(vistaAct==='chksemanal')renderChkSemanal();});
    setContent(`
      <div class="fm-sec-hd"><div><div class="fm-sec-t">Check list semanal</div><div class="fm-sec-s">ECO ${miVeh.eco} · Semana ${semana}</div></div></div>
      <div class="fm-card" style="background:#F8FAFD;display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="width:20px;height:20px;border:2px solid #CBD5E1;border-top-color:#2563EB;border-radius:50%;animation:fmspin .7s linear infinite"></div>
        <div style="font-size:12px;color:#64748B">Cargando checklist para este vehículo…</div>
      </div>
    `);
    return;
  }
  fijarChkCatsParaVehiculo(miVeh);

  if(!chkSemPermitido(semana)){
    const cfg=window._cfgSem||{};
    const msg=cfg.activo&&cfg.semana!==semana
      ?`El check list activo es para la semana ${cfg.semana}, no la actual.`
      :'El check list solo está disponible los lunes, o cuando sea habilitado por el administrador.';
    setContent(`
      <div class="fm-sec-hd"><div><div class="fm-sec-t">Check list semanal</div><div class="fm-sec-s">ECO ${miVeh.eco} · Semana ${semana}</div></div></div>
      <div class="fm-empty">
        <div class="fm-empty-ico" style="color:#94A3B8">${IC.tasks}</div>
        <h3>No disponible hoy</h3>
        <p>${msg}</p>
      </div>
      <button class="fm-btn ghost" onclick="fmVista('vehiculo')">Volver</button>
      <div style="height:20px"></div>
    `);
    return;
  }
  if(yaExiste){
    setContent(`
      <div class="fm-sec-hd"><div><div class="fm-sec-t">Check list semanal</div><div class="fm-sec-s">ECO ${miVeh.eco} · Semana ${semana}</div></div></div>
      <div class="fm-empty">
        <div class="fm-empty-ico" style="color:#15803D">${IC.check}</div>
        <h3>Ya completado esta semana</h3>
        <p>El check list semanal de esta semana ya fue registrado para este vehículo.</p>
      </div>
      <button class="fm-btn ghost" onclick="fmVista('vehiculo')">Volver</button>
      <div style="height:20px"></div>
    `);
    return;
  }

  // Reset del estado al entrar — pero restaurar borrador si existe
  semState={km:'',gasolina:50,chk:{},chkFotos:{},evFotos:[],observaciones:'',firma:null,yaExiste:false};
  const _semDraft=_draftLoad(_DRAFT.SEM);
  if(_semDraft&&Object.keys(_semDraft.chk||{}).length>0){
    setTimeout(()=>_draftBanner('sem',
      ()=>{
        Object.assign(semState,_semDraft);
        // Re-pintar checklist con valores guardados
        const semChkList=document.getElementById('fm-sem-chk-list');
        if(semChkList)semChkList.innerHTML=renderChkSemanalList();
        // Re-pintar gasolina
        const semGasWrap=document.getElementById('fm-sem-gauge-wrap');
        if(semGasWrap)semGasWrap.innerHTML=renderGaugeSVG(semState.gasolina)+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';
        // Re-pintar km
        const semKmInput=document.getElementById('fm-sem-km');
        if(semKmInput&&semState.km)semKmInput.value=semState.km;
        // Re-pintar contador
        const semTotal=Object.values(CHK_CATS).flat().length;
        const semRev=Object.values(semState.chk).filter(v=>v==='si'||v==='no').length;
        const semCnt=document.getElementById('fm-sem-chk-cnt');
        if(semCnt)semCnt.textContent=`${semRev} de ${semTotal} revisados`;
        // Re-pintar miniaturas de fotos guardadas en borrador
        Object.entries(semState.chkFotos||{}).forEach(([k,foto])=>{
          const src=typeof foto==='object'?foto.src:foto;
          const cam=document.getElementById('fm-cam-'+k);
          if(cam&&src)cam.innerHTML=`<img src="${src}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`;
        });
        toast('Borrador restaurado ✓','ok');
      },
      ()=>{ _draftClear(_DRAFT.SEM); }
    ),400);
  }

  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Check list semanal</div>
        <div class="fm-sec-s">ECO ${miVeh.eco} · ${miVeh.unidad||'—'} · Semana ${semana}</div>
      </div>
    </div>

    <!-- KM + GASOLINA -->
    <div class="fm-fld"><label>Kilometraje actual</label><input type="number" id="fm-sem-km" placeholder="${miVeh.km||0}" inputmode="numeric"></div>

    <div class="fm-fld">
      <label>Nivel de gasolina</label>
      <div class="fm-gauge-wrap" id="fm-sem-gauge-wrap">
        ${renderGaugeSVG(50)}
        <div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>
      </div>
      <input type="range" min="0" max="100" value="50" id="fm-sem-gas" oninput="fmGasSem(this.value)" style="width:100%;margin-top:6px;accent-color:#2563EB">
    </div>

    <!-- EVIDENCIAS GENERALES -->
    <div class="fm-fld">
      <label>Fotos obligatorias del vehículo <span style="font-size:9px;font-weight:500;text-transform:none;color:#EF4444">(4 ángulos requeridos)</span></label>
      <div style="font-size:10px;color:#64748B;margin-bottom:10px;line-height:1.5">Toma cada ángulo requerido antes de continuar.</div>
      <div id="fm-sem-angulos-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">${renderAngulosBasicosGrid(semState.evFotos,'sem')}</div>
      <label>Evidencias adicionales <span style="font-weight:500;text-transform:none;font-size:9px;color:#94A3B8">(opcional, generales del vehículo)</span></label>
      <button onclick="fmCapturar('general',null,'sem')" class="fm-btn primary" style="margin-bottom:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        Tomar foto con cámara
      </button>
      <div id="fm-sem-ev-wrap" style="display:flex;flex-wrap:wrap;gap:6px"></div>
    </div>

    <!-- CHECKLIST -->
    <div class="fm-fld">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <label style="margin:0">${esMaquinaria(miVeh)?'Fotos de la unidad':'Check list de inspección'}</label>
        <span id="fm-sem-chk-cnt" style="font-size:10px;color:#64748B">${esMaquinaria(miVeh)?'4 fotos requeridas':`0 de ${Object.values(CHK_CATS).flat().length} revisados`}</span>
      </div>
      <div id="fm-sem-chk-list">${esMaquinaria(miVeh)?renderMaqFotos('sem'):renderChkSemanalList()}</div>
    </div>

    <!-- OBSERVACIONES -->
    <div class="fm-fld">
      <label>Observaciones</label>
      <textarea id="fm-sem-obs" placeholder="Comentarios generales del vehículo esta semana…"></textarea>
    </div>

    <!-- FIRMA -->
    <div class="fm-card">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma del técnico <span style="color:#DC2626">*</span></div>
      <div style="border:2px solid #E2E8F0;border-radius:10px;overflow:hidden;background:#F8FAFD;touch-action:none">
        <canvas id="fm-sem-firma" width="320" height="200" style="display:block;width:100%;height:200px;touch-action:none;cursor:crosshair;border-radius:8px"></canvas>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="fm-btn ghost fm-btn-sm" onclick="limpiarFirma('fm-sem-firma')" style="flex:1">Limpiar</button>
      </div>
      <div style="font-size:11px;color:#94A3B8;margin-top:6px">La firma es obligatoria para guardar el check list semanal.</div>
    </div>

    <button class="fm-btn primary" onclick="fmGuardarChkSemanal()" id="fm-sem-btn-guardar" style="margin-top:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      Guardar check list semanal
    </button>
    <div id="fm-sem-val-hint" style="font-size:11px;color:#94A3B8;text-align:center;margin-top:6px;min-height:16px">Completa todos los ítems del check list antes de guardar</div>
    <div style="height:20px"></div>
  `);
  setTimeout(()=>initFirmaCanvas('fm-sem-firma'),100);
}

window.fmGuardarChkSemanal=async function(){
  if(!miVeh){toast('No hay vehículo vinculado','err');return;}
  if(!firmaTieneTrazo('fm-sem-firma')){toast('⚠ La firma es obligatoria','err');return;}

  const semana=getSemanaISO();
  const km=document.getElementById('fm-sem-km')?.value?.trim();
  const observaciones=document.getElementById('fm-sem-obs')?.value?.trim()||'';
  const firmaRaw=firmaExportar('fm-sem-firma');

  // ── VALIDACIONES ──
  if(!km||isNaN(Number(km))||Number(km)<0){
    toast('⚠ El kilometraje actual es obligatorio','err');
    document.getElementById('fm-sem-km')?.focus();
    return;
  }
  const faltanAngulosSem=angulosBasicosFaltantes(semState.evFotos);
  if(faltanAngulosSem.length>0){
    toast(`⚠ Faltan ${faltanAngulosSem.length} fotos obligatorias: ${faltanAngulosSem.map(a=>a.label).join(', ')}`,'err');
    return;
  }
  const totalChk=Object.values(CHK_CATS).flat().length;
  const respondidos=Object.values(semState.chk).filter(v=>v==='si'||v==='no').length;
  if(esMaquinaria(miVeh)){
    // Maquinaria: exigir las 4 fotos en lugar del checklist semanal
    const faltanMaq=MAQ_FOTOS.map((_,i)=>`sem-maq-${i}`).filter(k=>!semState.chkFotos[k]);
    if(faltanMaq.length>0){
      toast(`⚠ Faltan ${faltanMaq.length} de 4 fotos requeridas de la unidad`,'err');
      document.getElementById('fm-sem-chk-list')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
  } else {
  if(respondidos<totalChk){
    toast(`⚠ Completa el check list — faltan ${totalChk-respondidos} ítems por revisar`,'err');
    document.getElementById('fm-sem-chk-list')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  // Foto obligatoria en ítems marcados SI
  const itemsSI=Object.entries(semState.chk).filter(([k,v])=>v==='si');
  const faltanFotos=itemsSI.filter(([k])=>!semState.chkFotos[k]);
  if(faltanFotos.length>0){
    const nombres=faltanFotos.map(([k])=>{
      // Obtener nombre del ítem por clave sem-CAT-i
      const parts=k.split('-');const cat=parts[1];const idx=parseInt(parts[2]);
      return CHK_CATS[cat]?.[idx]||k;
    }).slice(0,3).join(', ');
    toast(`⚠ Foto obligatoria en ítems marcados SI: ${nombres}${faltanFotos.length>3?'…':''}`, 'err');
    document.getElementById('fm-sem-chk-list')?.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  }

  const btn=document.getElementById('fm-sem-btn-guardar');
  if(btn){btn.disabled=true;btn.textContent='Verificando…';}

  try{
    // Anti-duplicado
    const cacheKey=`${miVeh.eco}_${semana}`;
    const dup=await db.collection(C.CHKSEM).where('vehiculoEco','==',String(miVeh.eco)).where('semana','==',semana).limit(1).get();
    if(!dup.empty){
      window._semChkCache[cacheKey]=true;
      toast('Este check list ya fue registrado esta semana','err');
      if(btn){btn.disabled=false;btn.textContent='Guardar check list semanal';}
      fmVista('chksemanal');
      return;
    }

    if(btn)btn.textContent='Comprimiendo firma…';
    const firma=await comprimirBase64(firmaRaw,400,0.7);

    // ── Documento principal (sin fotos — siempre < 100KB) ──
    const doc={
      vehiculoId:miVeh.id||'',
      vehiculoEco:String(miVeh.eco),
      vehiculo:`${miVeh.eco} · ${miVeh.unidad||''}`,
      semana,
      fecha:new Date().toISOString().slice(0,10),
      km:km||String(miVeh.km||0),
      gasolina:semState.gasolina,
      checklist:semState.chk,          // solo SI/NO por ítem — muy ligero
      chkFotosKeys:Object.keys(semState.chkFotos||{}), // solo lista de claves con foto
      numEvidencias:(semState.evFotos||[]).length,
      observaciones,
      firma,                            // firma sola: ~10-20KB
      tecnico:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
      creadoEn:new Date().toISOString(),
    };

    if(btn)btn.textContent='Guardando…';
    const ref=await db.collection(C.CHKSEM).add(doc);

    // ── Subcolección de fotos (un doc por foto, sin límite de 1MB) ──
    const fotosCount=Object.keys(semState.chkFotos||{}).length+(semState.evFotos||[]).length;
    if(fotosCount>0){
      if(btn)btn.textContent=`Subiendo ${fotosCount} fotos…`;
      const fotosRef=db.collection(C.CHKSEM).doc(ref.id).collection('fotos');
      const uploads=[];

      // Fotos de ítems del checklist
      for(const [key,foto] of Object.entries(semState.chkFotos||{})){
        const src=typeof foto==='object'?foto.src:foto;
        const meta=typeof foto==='object'?foto.meta:{};
        uploads.push(
          comprimirBase64(src,480,0.55).then(comp=>
            fotosRef.add({tipo:'chk',key,src:comp,meta:meta||{},creadoEn:new Date().toISOString()})
          )
        );
      }

      // Fotos de evidencias generales
      for(const [i,ev] of (semState.evFotos||[]).entries()){
        const src=typeof ev==='object'?ev.src:ev;
        const meta=typeof ev==='object'?ev.meta:{};
        uploads.push(
          comprimirBase64(src,600,0.6).then(comp=>
            fotosRef.add({tipo:'evidencia',idx:i,src:comp,meta:meta||{},creadoEn:new Date().toISOString()})
          )
        );
      }

      // Subir todas en paralelo
      await Promise.allSettled(uploads);
    }

    // Actualizar KM del vehículo
    if(km&&miVeh&&miVeh.id&&!String(miVeh.id).startsWith('eco-')){
      try{await db.collection(C.VEHS).doc(miVeh.id).update({km:Number(km)});}catch{}
    }

    window._semChkCache[cacheKey]=true;
    toast('Check list semanal guardado ✓','ok');
    _draftClear(_DRAFT.SEM);
    semState={km:'',gasolina:50,chk:{},chkFotos:{},evFotos:[],observaciones:'',firma:null,yaExiste:false};
    fmVista('vehiculo');
  }catch(e){
    console.error('[FM chksem]',e);
    toast('Error al guardar: '+e.message,'err');
    if(btn){btn.disabled=false;btn.textContent='Guardar check list semanal';}
  }
};

// ── COMPRESIÓN DE IMAGEN ──
function comprimirBase64(src,maxW,calidad){
  maxW=maxW||900;calidad=calidad||0.72;
  return new Promise(function(res){
    var img=new Image();
    img.onload=function(){
      var ratio=Math.min(1,maxW/Math.max(img.width,img.height));
      var w=Math.round(img.width*ratio);
      var h=Math.round(img.height*ratio);
      var c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      res(c.toDataURL('image/jpeg',calidad));
    };
    img.onerror=function(){res(src);}; // fallback: usar original
    img.src=src;
  });
}

// ── REDUCIR TAMAÑO DE UNA SOLICITUD QUE EXCEDE EL LÍMITE DE FIRESTORE (1MB) ──
// Se usa tanto al guardar online como al sincronizar lo que quedó en cola offline,
// para que una solicitud nunca quede atorada sin poder sincronizar.
async function reducirTamanoSolicitud(docObj){
  let size=JSON.stringify(docObj).length;
  if(size<=900000)return docObj;
  // 1) Comprimir más las fotos del checklist
  const chkKeys=Object.keys(docObj.chkFotos||{});
  for(const k of chkKeys){
    const src=docObj.chkFotos[k];
    if(src&&typeof src==='string'&&src.startsWith('data:image')){
      docObj.chkFotos[k]=await comprimirBase64(src,250,0.5);
    }
  }
  size=JSON.stringify(docObj).length;
  if(size<=900000)return docObj;
  // 2) Comprimir más las fotos de evidencia principales
  if(Array.isArray(docObj.evidencias)){
    for(let i=0;i<docObj.evidencias.length;i++){
      const src=docObj.evidencias[i];
      if(src&&typeof src==='string'&&src.startsWith('data:image')){
        docObj.evidencias[i]=await comprimirBase64(src,450,0.5);
      }
    }
  }
  size=JSON.stringify(docObj).length;
  if(size<=900000)return docObj;
  // 3) Último recurso: quitar fotos del checklist (se conservan las respuestas SI/NO)
  if(chkKeys.length)docObj.chkFotos={};
  size=JSON.stringify(docObj).length;
  if(size<=900000)return docObj;
  // 4) Si aún excede el límite, conservar solo la primera evidencia
  if(Array.isArray(docObj.evidencias)&&docObj.evidencias.length>1){
    docObj._evidenciasRecortadas=docObj.evidencias.length;
    docObj.evidencias=docObj.evidencias.slice(0,1);
    docObj.evidenciasMeta=(docObj.evidenciasMeta||[]).slice(0,1);
  }
  return docObj;
}

// ── CAPTURAR EVIDENCIA MÓVIL ──
window.fmCapturar=async function(tipo,key,targetTag){
  const target=targetTag==='sem'?semState:solState;
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
      // Comprimir ANTES de sellar para reducir el tamaño del documento Firestore
      // Para fotos de checklist usar 400px (menor peso para Firestore)
      // Para fotos generales usar 700px
      const maxW=tipo==='chk'?400:700;
      const raw=await comprimirBase64(e.target.result,maxW,0.65);
      const now=new Date();
      const meta={
        codigo:genCod(),
        fecha:now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
        hora:now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
        timestamp:now.toISOString(),
        gps,eco:miVeh?.eco||'—',unidad:miVeh?.unidad||'—',
        usuario:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
        tipo,key:key||null,
      };
      const sellada=await sellarImg(raw,meta);
      if(tipo==='chk'&&key){
        target.chkFotos[key]={src:sellada,meta};
        const cam=document.getElementById(`fm-cam-${key}`);
        if(cam){cam.classList.add('has');cam.innerHTML=`<img src="${sellada}" style="width:26px;height:26px;object-fit:cover;border-radius:5px">`;cam.onclick=()=>fmVerFoto({src:sellada,meta});}
        // Autoguardar borrador incluyendo la foto recién tomada
        if(targetTag==='sem') _draftSave(_DRAFT.SEM,semState);
        else _draftSave(_DRAFT.SOL,solState);
      } else if(tipo==='angulo'&&key){
        meta.angulo=key;
        target.evFotos.push({src:sellada,meta});
        const gridId=targetTag==='sem'?'fm-sem-angulos-grid':'fm-angulos-grid';
        const grid=document.getElementById(gridId);
        if(grid)grid.innerHTML=renderAngulosBasicosGrid(target.evFotos,targetTag);
        if(targetTag==='sem') _draftSave(_DRAFT.SEM,semState);
        else _draftSave(_DRAFT.SOL,solState);
      } else {
        target.evFotos.push({src:sellada,meta});
        const wrap=document.getElementById(targetTag==='sem'?'fm-sem-ev-wrap':'fm-ev-wrap');
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
      window._fmActualizarHint?.();
    };
    reader.readAsDataURL(file);
  };
  inp.click();
};

// Array global para evidencias — evita base64 inline en onclick
window._fmEvCache=[];
window.fmVerEvIdx=function(idx){const ev=window._fmEvCache[idx];if(ev)window.fmVerFoto(ev);};

window.fmVerFotoChk=function(key){
  const ev=solState.chkFotos[key];
  if(ev)fmVerFoto(ev);
};

window.fmVerFotoChkSem=function(key){
  const ev=semState.chkFotos[key];
  if(ev)fmVerFoto(ev);
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
// ── ACTUALIZACIÓN SILENCIOSA ─────────────────────────────────────
function recargarSiSeguro(){
  const key='sw_recargado_'+(navigator.serviceWorker?.controller?.scriptURL||'').slice(-10);
  if(localStorage.getItem(key)) return;
  localStorage.setItem(key,'1');
  setTimeout(()=>localStorage.removeItem(key), 10000);
  const vistaActual = vistaAct || '';
  const formsAbiertos = ['solicitud','chksemanal','util'].includes(vistaActual);
  if(formsAbiertos){
    const unsub = setInterval(() => {
      const v = vistaAct || '';
      if(!['solicitud','chksemanal','util'].includes(v)){
        clearInterval(unsub);
        window.location.reload();
      }
    }, 3000);
    setTimeout(() => clearInterval(unsub), 600000);
  } else {
    window.location.reload();
  }
}

window.fmGuardar=async function(){
  const tipoR=document.getElementById('fm-tipo')?.value;
  const tipoC=document.getElementById('fm-tipo-c')?.value?.trim();
  const tipo=tipoR==='__c'?(tipoC||'Personalizado'):tipoR;
  const desc=document.getElementById('fm-desc')?.value?.trim();
  const km=document.getElementById('fm-km')?.value?.trim();

  // ── VALIDACIONES OBLIGATORIAS ──
  const totalChk=Object.values(CHK_CATS).flat().length;
  const respondidos=Object.values(solState.chk).filter(v=>v==='si'||v==='no').length;

  const faltanAngulosSol=angulosBasicosFaltantes(solState.evFotos);
  if(faltanAngulosSol.length>0){
    toast(`⚠ Faltan ${faltanAngulosSol.length} fotos obligatorias: ${faltanAngulosSol.map(a=>a.label).join(', ')}`,'err');
    return;
  }

  if(!tipo){
    toast('⚠ Selecciona el tipo de solicitud','err');
    document.getElementById('fm-tipo')?.focus();
    return;
  }
  if(!desc){
    toast('⚠ Describe el problema o servicio','err');
    document.getElementById('fm-desc')?.focus();
    return;
  }
  if(!km||isNaN(Number(km))||Number(km)<0){
    toast('⚠ El kilometraje actual es obligatorio','err');
    document.getElementById('fm-km')?.focus();
    return;
  }
  if(!solState.evFotos||solState.evFotos.length===0){
    toast('⚠ Sube al menos 1 foto de evidencia del problema','err');
    return;
  }
  let chkFirmaConfirmacion=null;
  if(solState.modoConfirmacion){
    if(!document.getElementById('fm-confirm-chk')?.checked){
      toast('⚠ Confirma que tu vehículo está en las mismas condiciones','err');
      return;
    }
    if(!firmaTieneTrazo('fm-sol-confirm-firma')){
      toast('⚠ Falta la firma de confirmación','err');
      return;
    }
    chkFirmaConfirmacion=firmaExportar('fm-sol-confirm-firma');
  } else if(esMaquinaria(miVeh)){
    // Maquinaria: exigir las 4 fotos en lugar del checklist
    const faltanMaq=MAQ_FOTOS.map((_,i)=>`maq__${i}`).filter(k=>!(solState.chkFotos||{})[k]);
    if(faltanMaq.length>0){
      toast(`⚠ Faltan ${faltanMaq.length} de 4 fotos requeridas de la unidad`,'err');
      document.getElementById('fm-chk-list')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
  } else {
    // Checklist de solicitud — foto obligatoria en ítems marcados SI
    const chkSolItems=Object.entries(solState.chk||{});
    const siSinFoto=chkSolItems.filter(([k,v])=>v==='si'&&!(solState.chkFotos||{})[k]);
    if(siSinFoto.length>0){
      toast(`⚠ Agrega foto en ${siSinFoto.length} ítem(s) del checklist marcados SI`,'err');
      return;
    }
    if(respondidos<totalChk){
      toast(`⚠ Completa el check list — faltan ${totalChk-respondidos} ítems por revisar`,'err');
      document.getElementById('fm-chk-list')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
  }

  const btn=document.getElementById('fm-btn-guardar');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const docObj={
    vehiculoId:miVeh?.id||'',vehiculoEco:miVeh?.eco||'',
    vehiculo:`${miVeh?.eco} · ${miVeh?.unidad||''}`,
    tipo,prioridad:solState.prior,descripcion:desc,
    kilometrajeReportado:km||'',
    gasolina:solState.gasolina,
    tipoUnidad:miVeh?.tipo==='maquinaria'?'maquinaria':(['camioneta','camion'].includes(miVeh?.tipo)?'troca':'auto'),
    estatus:'Solicitud',
    solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
    creadoPor:window.auth?.currentUser?.email||'',
    creadoEn:new Date().toISOString(),
    evidencias:solState.evFotos.map(e=>typeof e==='string'?e:e.src),
    evidenciasMeta:solState.evFotos.map(e=>typeof e==='object'?e.meta:null).filter(Boolean),
    checklist:solState.modoConfirmacion?{}:{...solState.chk},
    chkFotos:solState.modoConfirmacion?{}:Object.fromEntries(Object.entries(solState.chkFotos).map(([k,v])=>[k,typeof v==='object'?v.src:v])),
    confirmacionChecklistSemanal:!!solState.modoConfirmacion,
    chkFirmaConfirmacion:chkFirmaConfirmacion,
    origenApp:'movil',
  };
  if(!onlineStatus){
    await reducirTamanoSolicitud(docObj);
    if(docObj._evidenciasRecortadas)toast('Fotos muy pesadas sin conexión — se guardaron comprimidas','warn');
    if(typeof offlineGuardar==='function')offlineGuardar(docObj);
    if(btn){btn.disabled=false;btn.textContent='Crear solicitud';}
    return;
  }
  // Estimar tamaño del documento — Firestore limite 1MB
  await reducirTamanoSolicitud(docObj);
  if(docObj._evidenciasRecortadas)toast('Fotos muy pesadas — se guardaron comprimidas para poder sincronizar','warn');
  try{
    const timeout=new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout: conexión lenta. Intenta de nuevo.')),20000));
    await Promise.race([db.collection(C.SOLS).add(docObj), timeout]);
    if(km&&miVeh&&!miVeh.id.startsWith('eco-')){
      await db.collection(C.VEHS).doc(miVeh.id).update({km:Number(km)}).catch(()=>{});
    }
    await cargarMisSols();
    _draftClear(_DRAFT.SOL);
    toast('Solicitud creada correctamente','ok');
    setTimeout(()=>fmVista('vehiculo'),1200);
  }catch(e){
    console.error('[MOVIL guardar]',e.message);
    await reducirTamanoSolicitud(docObj);
    offlineGuardar(docObj);
    toast('Sin conexión — guardado localmente para sincronizar después','warn');
    if(btn){btn.disabled=false;btn.textContent='Crear solicitud';}
    setTimeout(()=>fmVista('vehiculo'),1500);
  }
};

// ══════════════════════════════════════════
// VISTA 3 — MIS TAREAS
// ══════════════════════════════════════════
function renderTareas(){
  const pend=misTareas.filter(t=>t.estatus!=='Completada'&&t.estatus!=='Cancelada');
  const urg=pend.filter(t=>t.prioridad==='Urgente'||t.prioridad==='Alta');
  setContent(
    '<div class="fm-sec-hd"><div><div class="fm-sec-t">Mis tareas</div><div class="fm-sec-s">'+pend.length+' pendiente(s)'+(urg.length?' · '+urg.length+' urgente(s)':'')+'</div></div></div>'+
    (!pend.length?
      '<div class="fm-empty"><div class="fm-empty-ico" style="color:#15803D">'+IC.check+'</div><h3>Sin tareas pendientes</h3><p>No tienes tareas asignadas.</p></div>'
    :
      '<div style="display:flex;gap:8px;margin-bottom:14px;overflow-x:auto;padding-bottom:2px">'+
        '<div style="flex-shrink:0;background:#FEF3C7;border-radius:10px;padding:10px 14px;text-align:center;min-width:70px"><div style="font-size:20px;font-weight:900;color:#92400E">'+pend.filter(t=>t.estatus==='Pendiente').length+'</div><div style="font-size:9px;font-weight:700;color:#B45309">Pendientes</div></div>'+
        '<div style="flex-shrink:0;background:#DBEAFE;border-radius:10px;padding:10px 14px;text-align:center;min-width:70px"><div style="font-size:20px;font-weight:900;color:#1E40AF">'+pend.filter(t=>t.estatus==='En proceso').length+'</div><div style="font-size:9px;font-weight:700;color:#1D4ED8">En proceso</div></div>'+
        '<div style="flex-shrink:0;background:#EDE9FE;border-radius:10px;padding:10px 14px;text-align:center;min-width:70px"><div style="font-size:20px;font-weight:900;color:#5B21B6">'+pend.filter(t=>t.estatus==='En revisión').length+'</div><div style="font-size:9px;font-weight:700;color:#7C3AED">En revisión</div></div>'+
      '</div>'+
      pend.map(function(t){
        var esUrg=t.prioridad==='Urgente'||t.prioridad==='Alta';
        var borde=esUrg?'#FCA5A5':t.estatus==='En proceso'?'#BFDBFE':t.estatus==='En revisión'?'#C4B5FD':'#E2E8F0';
        var fondo=esUrg?'#FFF7F7':t.estatus==='En proceso'?'#F8FBFF':'#fff';
        var estColor=t.estatus==='En proceso'?'#1E40AF':t.estatus==='En revisión'?'#5B21B6':'#92400E';
        var estBg=t.estatus==='En proceso'?'#DBEAFE':t.estatus==='En revisión'?'#EDE9FE':'#FEF3C7';
        var ultComt=(t.comentarios||[]).slice(-1)[0];
        return '<div style="border:1.5px solid '+borde+';border-radius:12px;padding:13px;margin-bottom:10px;background:'+fondo+'">'+
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">'+
            '<div style="font-size:13px;font-weight:800;color:#0A1628;flex:1;line-height:1.3">'+(t.titulo||'Tarea sin título')+'</div>'+
            '<span style="background:'+estBg+';color:'+estColor+';font-size:9px;font-weight:800;padding:2px 7px;border-radius:8px;flex-shrink:0;white-space:nowrap">'+(t.estatus||'Pendiente')+'</span>'+
          '</div>'+
          (t.descripcion?'<div style="font-size:12px;color:#475569;margin-bottom:8px;line-height:1.4">'+t.descripcion+'</div>':'')+
          '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'+
            (t.prioridad&&t.prioridad!=='Normal'?'<span style="font-size:10px;font-weight:700;background:'+(esUrg?'#FEE2E2':'#F1F5F9')+';color:'+(esUrg?'#B91C1C':'#64748B')+';padding:2px 7px;border-radius:6px">'+t.prioridad+'</span>':'')+
            (t.vehiculoEco?'<span style="font-size:10px;color:#1D4ED8;background:#EFF6FF;padding:2px 7px;border-radius:6px;font-weight:700">ECO '+t.vehiculoEco+'</span>':'')+
            (t.fechaLimite?'<span style="font-size:10px;color:#64748B;background:#F8FAFD;padding:2px 7px;border-radius:6px">Límite: '+t.fechaLimite+'</span>':'')+
            (t.fechaCompromiso?'<span style="font-size:10px;color:#7C3AED;background:#EDE9FE;padding:2px 7px;border-radius:6px;font-weight:700">Compromiso: '+t.fechaCompromiso+'</span>':'')+
          '</div>'+
          (t.solicitudId?'<div style="background:#F8FAFD;border-radius:8px;padding:7px 10px;margin-bottom:10px;border:1px solid #E8EDF5;font-size:11px;cursor:pointer" onclick="fmVerTareaSol(\''+t.solicitudId+'\')"><span style="font-weight:700;color:#1D4ED8">Ver solicitud vinculada \u2192</span> <span style="color:#64748B">'+t.solicitudId.slice(0,8).toUpperCase()+'</span></div>':'')+
          (ultComt?'<div style="font-size:10px;color:#94A3B8;margin-bottom:8px">\u00daltimo comentario: "'+ultComt.texto.slice(0,50)+'\u2026"</div>':'')+
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:'+(t.fechaCompromiso?'0':'8px')+'">'+
            '<button onclick="fmTareaVerDetalle(\''+t.id+'\')" style="padding:8px;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;color:#1D4ED8;cursor:pointer">Ver detalle</button>'+
            '<button onclick="fmTareaEstatus(\''+t.id+'\')" style="padding:8px;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;color:#15803D;cursor:pointer">Cambiar estatus</button>'+
          '</div>'+
          (!t.fechaCompromiso?'<button onclick="fmTareaFechaCompromiso(\''+t.id+'\')" style="width:100%;padding:7px;background:#F5F3FF;border:1.5px solid #DDD6FE;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;color:#7C3AED;cursor:pointer;margin-top:8px">+ Establecer fecha compromiso</button>':'')+
        '</div>';
      }).join('')+
      '<div style="height:20px"></div>'
    )
  );
}

window.fmVerTareaSol=function(solId){fmVerSol(solId);};

window.fmTareaVerDetalle=async function(tareaId){
  var snap,t;
  try{snap=await db.collection(C.TAREAS).doc(tareaId).get();t={id:snap.id,...snap.data()};}
  catch(e){toast('Error al cargar tarea','err');return;}
  var ov=document.createElement('div');ov.className='fm-ov';
  var comtsHtml=(t.comentarios||[]).length?
    (t.comentarios||[]).map(function(c){return '<div style="background:#F8FAFD;border-radius:8px;padding:8px 10px;border:1px solid #E8EDF5;margin-bottom:5px"><div style="font-size:10px;font-weight:700;color:#1D4ED8;margin-bottom:2px">'+(c.autor||'—')+' <span style="color:#CBD5E1;font-weight:400">'+(c.fecha?c.fecha.slice(0,10):'')+'</span></div><div style="font-size:12.5px;color:#0A1628">'+c.texto+'</div></div>';}).join('')
    :'<div style="font-size:11px;color:#94A3B8;text-align:center;padding:8px">Sin comentarios</div>';
  var evsHtml=(t.evidencias||[]).length?
    (t.evidencias||[]).map(function(src){return '<img src="'+src+'" onclick="fmVerImg(\''+src+'\')" style="width:60px;height:60px;object-fit:cover;border-radius:9px;cursor:zoom-in;border:1.5px solid #E2E8F0">';}).join('')
    :'<div style="font-size:11px;color:#94A3B8">Sin evidencias</div>';
  ov.innerHTML='<div class="fm-sheet" style="max-height:90vh;overflow-y:auto">'+
    '<div class="fm-sheet-hd"><h3 style="font-size:14px">'+(t.titulo||'Tarea')+'</h3><button class="fm-sheet-x" onclick="this.closest(\'.fm-ov\').remove()">✕</button></div>'+
    '<div class="fm-sheet-body">'+
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">'+
        '<span style="background:#EDE9FE;color:#5B21B6;font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:8px">'+(t.estatus||'Pendiente')+'</span>'+
        (t.prioridad?'<span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:8px;background:'+(t.prioridad==='Alta'||t.prioridad==='Urgente'?'#FEE2E2':'#F1F5F9')+';color:'+(t.prioridad==='Alta'||t.prioridad==='Urgente'?'#B91C1C':'#64748B')+'">'+t.prioridad+'</span>':'')+
      '</div>'+
      (t.descripcion?'<div style="background:#F8FAFD;border-radius:9px;padding:10px;font-size:13px;color:#475569;margin-bottom:12px;border:1px solid #E8EDF5">'+t.descripcion+'</div>':'')+
      (t.fechaLimite?'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9"><span style="font-size:12px;color:#64748B;font-weight:600">Fecha límite</span><span style="font-size:12px;font-weight:700">'+t.fechaLimite+'</span></div>':'')+
      (t.fechaCompromiso?'<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9"><span style="font-size:12px;color:#7C3AED;font-weight:600">Compromiso</span><span style="font-size:12px;font-weight:700;color:#7C3AED">'+t.fechaCompromiso+'</span></div>':'')+
      '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin:14px 0 8px">Comentarios</div>'+
      '<div id="fm-td-comts" style="display:flex;flex-direction:column;gap:5px;max-height:160px;overflow-y:auto;margin-bottom:10px">'+comtsHtml+'</div>'+
      '<div style="display:flex;gap:7px;margin-bottom:14px">'+
        '<input id="fm-td-inp" placeholder="Agregar comentario…" style="flex:1;padding:9px 11px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:12px">'+
        '<button onclick="fmTareaEnviarComt(\''+tareaId+'\')" style="padding:9px 14px;background:#1D4ED8;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Enviar</button>'+
      '</div>'+
      '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:8px">Evidencias</div>'+
      '<div id="fm-td-evs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">'+evsHtml+'</div>'+
      '<label style="display:inline-flex;align-items:center;gap:6px;padding:8px 13px;background:#F8FAFD;border:1.5px dashed #CBD5E1;border-radius:9px;cursor:pointer;font-size:11px;font-weight:700;color:#475569;margin-bottom:14px">'+
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'+
        ' Subir foto de evidencia'+
        '<input type="file" accept="image/*" multiple style="display:none" onchange="fmTareaSubirEv(this,\''+tareaId+'\')">'+
      '</label>'+
      (!t.fechaCompromiso?
        '<div style="background:#F5F3FF;border-radius:10px;padding:11px;border:1.5px solid #DDD6FE;margin-bottom:14px">'+
          '<div style="font-size:10px;font-weight:800;color:#7C3AED;margin-bottom:7px">Establecer fecha compromiso</div>'+
          '<div style="display:flex;gap:8px;align-items:center">'+
            '<input type="date" id="fm-td-fcomp" style="flex:1;padding:8px;border:1.5px solid #DDD6FE;border-radius:8px;font-family:inherit;font-size:12px">'+
            '<button onclick="fmTareaSetFcomp(\''+tareaId+'\')" style="padding:8px 12px;background:#7C3AED;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer">Guardar</button>'+
          '</div>'+
        '</div>'
      :'')+
    '</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
};

window.fmTareaEnviarComt=async function(tareaId){
  var inp=document.getElementById('fm-td-inp');
  var texto=inp&&inp.value?inp.value.trim():'';
  if(!texto)return;
  var yo=miPerfil;
  try{
    var snap=await db.collection(C.TAREAS).doc(tareaId).get();
    var t=snap.data();
    var comentarios=(t.comentarios||[]).concat([{texto:texto,autor:(yo&&yo.nombre)||yo.email||'Técnico',autorEmail:(yo&&yo.email)||'',fecha:new Date().toISOString()}]);
    await db.collection(C.TAREAS).doc(tareaId).update({comentarios:comentarios,actualizadoEn:new Date().toISOString()});
    if(t.creadoPor&&t.creadoPor!==yo.email){
      await db.collection('flotilla_notificaciones').add({solicitudId:t.solicitudId||'',para:t.creadoPor,vehiculoEco:t.vehiculoEco||'—',tipo:'tarea_comentario',mensaje:'Comentario del técnico en "'+t.titulo+'": "'+texto+'"',leido:false,creadaEn:new Date().toISOString()});
    }
    inp.value='';
    var cont=document.getElementById('fm-td-comts');
    if(cont){var snp2=await db.collection(C.TAREAS).doc(tareaId).get();var t2=snp2.data();cont.innerHTML=(t2.comentarios||[]).map(function(c){return '<div style="background:#F8FAFD;border-radius:8px;padding:8px 10px;border:1px solid #E8EDF5;margin-bottom:5px"><div style="font-size:10px;font-weight:700;color:#1D4ED8;margin-bottom:2px">'+(c.autor||'—')+' <span style="color:#CBD5E1;font-weight:400">'+(c.fecha?c.fecha.slice(0,10):'')+'</span></div><div style="font-size:12.5px;color:#0A1628">'+c.texto+'</div></div>';}).join('');}
    toast('Comentario enviado','ok');
  }catch(e){toast('Error: '+e.message,'err');}
};

window.fmTareaSubirEv=async function(input,tareaId){
  var files=Array.from(input.files);if(!files.length)return;
  toast('Subiendo evidencia…','ok');
  var nuevas=[];
  for(var i=0;i<files.length;i++){
    try{
      var b64=await (function(f){return new Promise(function(res,rej){var img=new Image();img.onload=function(){var c=document.createElement('canvas');var MAX=900;var sc=Math.min(1,MAX/Math.max(img.width,img.height));c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.72));};img.onerror=rej;img.src=URL.createObjectURL(f);});})(files[i]);
      nuevas.push(b64);
    }catch(e){console.warn(e);}
  }
  if(!nuevas.length)return;
  try{
    var snap=await db.collection(C.TAREAS).doc(tareaId).get();
    var evs=(snap.data()&&snap.data().evidencias||[]).concat(nuevas);
    await db.collection(C.TAREAS).doc(tareaId).update({evidencias:evs,actualizadoEn:new Date().toISOString()});
    var cont=document.getElementById('fm-td-evs');
    if(cont)cont.innerHTML=evs.map(function(src){return '<img src="'+src+'" onclick="fmVerImg(\''+src+'\')" style="width:60px;height:60px;object-fit:cover;border-radius:9px;cursor:zoom-in;border:1.5px solid #E2E8F0">';}).join('');
    toast(nuevas.length+' foto(s) guardada(s)','ok');
  }catch(e){toast('Error: '+e.message,'err');}
};

window.fmVerImg=function(src){var ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9000;display:flex;align-items:center;justify-content:center;cursor:zoom-out';ov.innerHTML='<img src="'+src+'" style="max-width:95%;max-height:92vh;border-radius:10px">';ov.onclick=function(){ov.remove();};document.body.appendChild(ov);};

window.fmTareaEstatus=async function(tareaId){
  var snap=await db.collection(C.TAREAS).doc(tareaId).get();
  var t={id:snap.id,...snap.data()};
  var ov=document.createElement('div');ov.className='fm-ov';
  ov.innerHTML='<div class="fm-sheet"><div class="fm-sheet-hd"><h3>Cambiar estatus</h3><button class="fm-sheet-x" onclick="this.closest(\'.fm-ov\').remove()">✕</button></div><div class="fm-sheet-body"><div style="font-size:13px;font-weight:700;color:#0A1628;margin-bottom:12px">'+(t.titulo||'Tarea')+'</div>'+
    ['Pendiente','En proceso','En revisión','Completada','Cancelada'].map(function(est){return '<button onclick="fmTareaSetEst(\''+tareaId+'\',\''+est+'\',this)" style="display:block;width:100%;padding:12px 14px;border-radius:10px;border:1.5px solid '+(t.estatus===est?'#7C3AED':'#E2E8F0')+';background:'+(t.estatus===est?'#EDE9FE':'#fff')+';font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;text-align:left;color:'+(t.estatus===est?'#5B21B6':'#374151')+';margin-bottom:6px">'+(t.estatus===est?'\u2713 ':'')+est+'</button>';}).join('')+
  '</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
};

window.fmTareaSetEst=async function(tareaId,nuevoEst,btn){
  btn.disabled=true;
  try{
    await db.collection(C.TAREAS).doc(tareaId).update({estatus:nuevoEst,actualizadoEn:new Date().toISOString()});
    if(nuevoEst==='Completada'||nuevoEst==='En revisión'){
      var snap=await db.collection(C.TAREAS).doc(tareaId).get();
      var t=snap.data();
      if(t.creadoPor&&t.creadoPor!==miPerfil.email){
        await db.collection('flotilla_notificaciones').add({solicitudId:t.solicitudId||'',para:t.creadoPor,vehiculoEco:t.vehiculoEco||'—',tipo:nuevoEst==='Completada'?'tarea_completada':'tarea_revision',mensaje:'Tarea "'+(t.titulo||'—')+'" marcada como '+nuevoEst+' por '+(miPerfil&&miPerfil.nombre||'el técnico'),leido:false,creadaEn:new Date().toISOString()});
      }
    }
    toast('Estatus: '+nuevoEst,'ok');
    document.querySelector('.fm-ov:last-child')&&document.querySelector('.fm-ov:last-child').remove();
  }catch(e){toast('Error: '+e.message,'err');btn.disabled=false;}
};

window.fmTareaFechaCompromiso=function(tareaId){
  var ov=document.createElement('div');ov.className='fm-ov';
  ov.innerHTML='<div class="fm-sheet"><div class="fm-sheet-hd"><h3>Fecha compromiso</h3><button class="fm-sheet-x" onclick="this.closest(\'.fm-ov\').remove()">✕</button></div><div class="fm-sheet-body"><div style="font-size:12px;color:#475569;margin-bottom:12px">Establece la fecha en que te comprometes a finalizar esta tarea.</div><input type="date" id="fmfc-inp" style="width:100%;padding:10px;border:1.5px solid #DDD6FE;border-radius:9px;font-family:inherit;font-size:13px;box-sizing:border-box"><div style="display:flex;gap:8px;margin-top:12px"><button class="fm-btn ghost" onclick="this.closest(\'.fm-ov\').remove()">Cancelar</button><button onclick="fmTareaSetFcomp(\''+tareaId+'\')" style="flex:1;padding:10px;background:#7C3AED;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">Guardar</button></div></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',function(e){if(e.target===ov)ov.remove();});
};

window.fmTareaSetFcomp=async function(tareaId){
  var fecha=(document.getElementById('fm-td-fcomp')||document.getElementById('fmfc-inp'))&&(document.getElementById('fm-td-fcomp')||document.getElementById('fmfc-inp')).value;
  if(!fecha){toast('Selecciona una fecha','err');return;}
  try{
    await db.collection(C.TAREAS).doc(tareaId).update({fechaCompromiso:fecha,actualizadoEn:new Date().toISOString()});
    var snap=await db.collection(C.TAREAS).doc(tareaId).get();var t=snap.data();
    if(t.creadoPor&&t.creadoPor!==miPerfil.email){
      await db.collection('flotilla_notificaciones').add({solicitudId:t.solicitudId||'',para:t.creadoPor,vehiculoEco:t.vehiculoEco||'—',tipo:'tarea_comentario',mensaje:((miPerfil&&miPerfil.nombre)||'El técnico')+' se compromete a finalizar "'+t.titulo+'" el '+fecha,leido:false,creadaEn:new Date().toISOString()});
    }
    toast('Fecha compromiso guardada','ok');
    document.querySelector('.fm-ov:last-child')&&document.querySelector('.fm-ov:last-child').remove();
  }catch(e){toast('Error: '+e.message,'err');}
};

// ══════════════════════════════════════════
// VISTA 4 — NOTIFICACIONES / AVISOS
// ══════════════════════════════════════════

// Marcar todas las notificaciones como leídas en Firestore
window.fmMarcarNotifLeidas = async function(){
  const sinLeer = (misPipelineNotif||[]).filter(n=>!n.leido);
  if(!sinLeer.length) return;
  try {
    const batch = [];
    for(const n of sinLeer){
      batch.push(db.collection('flotilla_notificaciones').doc(n.id).update({leido:true}));
    }
    await Promise.all(batch);
    // onSnapshot actualizará misPipelineNotif automáticamente
  } catch(e){ console.warn('[notif marcar leída]',e); }
};

function renderNotif(){
  const pipelineItems=(misPipelineNotif||[]).map(n=>{
    const tipoIco={validada:'ok',aprobada:'ok',cerrada:'ok',servicio:'ok',rechazada_val:'err',rechazada_apr:'err',pagos:'msg',pagado:'ok',comentario:'msg',tarea_nueva:'task',tarea_comentario:'msg',tarea_completada:'ok',tarea_revision:'msg'}[n.tipo]||'msg';
    const tipoBg={ok:'#DCFCE7',err:'#FEE2E2',msg:'#EDE9FE',task:'#FEF3C7'}[tipoIco]||'#F1F5F9';
    const tipoIcoSvg={ok:IC.check,err:IC.x,msg:IC.bell,task:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2.2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`}[tipoIco]||IC.bell;
    return {
      ico:tipoIco, bg:tipoBg, icoSvg:tipoIcoSvg,
      t:n.mensaje||'Aviso de solicitud',
      s:`ECO ${n.vehiculoEco||'—'} · ${n.tipo||'—'}`,
      time:hF(n.creadaEn),
      unread:!n.leido,
      id:n.id,
    };
  });
  const items=[...pipelineItems];
  const dv=hD(miVeh?.pv);
  if(dv!==null&&dv<90)items.unshift({ico:'warn',bg:'#FEF3C7',icoSvg:IC.alert,t:'Póliza de seguro',s:dv<0?'Póliza VENCIDA — renovar urgente':`Vence en ${dv} días`,time:'Hoy',unread:dv<0});

  setContent(`
    <div class="fm-sec-hd">
      <div>
        <div class="fm-sec-t">Avisos</div>
        <div class="fm-sec-s">${items.length} notificacion(es)</div>
      </div>
      ${(misPipelineNotif||[]).some(n=>!n.leido)?`<button onclick="fmMarcarNotifLeidas()" style="padding:6px 12px;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:8px;font-size:11px;font-weight:700;color:#1D4ED8;cursor:pointer">Marcar leídas</button>`:''}
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
  window._fmEvCache=[];
  const s=misSols.find(x=>x.id===id);if(!s)return;
  const ov=document.createElement('div');ov.className='fm-ov';
  ov.innerHTML=`<div class="fm-sheet">
    <div class="fm-sheet-hd">
      <h3>${s.tipo||'Solicitud'}</h3>
      <button class="fm-sheet-x" onclick="this.closest('.fm-ov').remove()">✕</button>
    </div>
    <div class="fm-sheet-body">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">${badge(s.estatus)}<span style="font-size:12px;color:#64748B">${hF(s.creadoEn)}</span></div>
      ${[['Vehículo',s.vehiculo||'—'],['Prioridad',s.prioridad||'Normal'],['KM',s.kilometrajeReportado||'—'],['Gasolina',s.gasolina!=null?s.gasolina+'%':'—'],['Taller',s.taller||'Sin especificar']].map(([l,v])=>`
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #F1F5F9">
        <span style="font-size:12.5px;color:#64748B;font-weight:600">${l}</span>
        <span style="font-size:12.5px;font-weight:700;color:#0A0F1E">${v}</span>
      </div>`).join('')}
      <div style="padding:10px 0;border-bottom:1px solid #F1F5F9">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Descripción</div>
        <div style="font-size:13.5px;color:#0A0F1E;line-height:1.5">${s.descripcion||'—'}</div>
      </div>
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border-radius:10px;padding:11px 13px;margin-top:12px"><div style="font-size:12px;font-weight:700;color:#B91C1C;margin-bottom:3px">Motivo de rechazo</div><div style="font-size:13px;color:#991B1B">${s.comentarioRechazo}</div></div>`:''}
      ${(()=>{
        // EVIDENCIAS GENERALES — índice global evita base64 en onclick
        if(!s.evidencias?.length)return'';
        const baseIdx=window._fmEvCache.length;
        s.evidencias.forEach((src,i)=>{const m=(s.evidenciasMeta||[])[i];window._fmEvCache.push({src,meta:m||null});});
        return`<div style="margin-top:14px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:8px">Evidencias generales (${s.evidencias.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${s.evidencias.map((src,i)=>{const m=(s.evidenciasMeta||[])[i];return`<div onclick="fmVerEvIdx(${baseIdx+i})" class="fm-ev-pill" style="flex-direction:column;width:70px;height:80px;justify-content:flex-start;padding:4px"><img src="${src}" style="width:60px;height:55px;object-fit:cover;border-radius:6px;display:block"><span style="font-size:8px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:64px">${m?.codigo||'Foto '+(i+1)}</span></div>`;}).join('')}</div>
        </div>`;
      })()}
      ${(()=>{
        const chkF=s.chkFotos||{};
        const chkEntries=Object.entries(chkF).filter(([k,v])=>v);
        if(!chkEntries.length)return'';
        const CHK=window.CHK_CATS_M={Cristales:['Medallón delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],Espejos:['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],Neumáticos:['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],Interiores:['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],Motor:['Batería','Tapón agua','Tapón radiador','Tapón dirección','Limpiaparabrisas en buen estado'],Cajuela:['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],Legal:['Tarjeta circulación']};
        const getL=k=>{for(const items of Object.values(CHK)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
        const baseIdx=window._fmEvCache.length;
        chkEntries.forEach(([k,src])=>window._fmEvCache.push({src,meta:{codigo:k,tipo:'checklist'}}));
        return`<div style="margin-top:10px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#2563EB;margin-bottom:8px">Fotos checklist (${chkEntries.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${chkEntries.map(([k,src],i)=>`<div onclick="fmVerEvIdx(${baseIdx+i})" class="fm-ev-pill" style="flex-direction:column;width:70px;height:80px;justify-content:flex-start;padding:4px;background:#EFF6FF;border-color:#BFDBFE"><img src="${src}" style="width:60px;height:55px;object-fit:cover;border-radius:6px;display:block"><span style="font-size:8px;margin-top:2px;color:#1D4ED8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:64px">${getL(k)}</span></div>`).join('')}</div>
        </div>`;
      })()}
      ${(()=>{
        const CHK=window.CHK_CATS_M={Cristales:['Medallón delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],Espejos:['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],Neumáticos:['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],Interiores:['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],Motor:['Batería','Tapón agua','Tapón radiador','Tapón dirección','Limpiaparabrisas en buen estado'],Cajuela:['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],Legal:['Tarjeta circulación']};
        const getL=k=>{for(const items of Object.values(CHK)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
        const noItems=Object.entries(s.checklist||{}).filter(([k,v])=>v==='no');
        const siItems=Object.entries(s.checklist||{}).filter(([k,v])=>v==='si');
        if(!noItems.length&&!siItems.length)return'';
        if(!noItems.length)return`<div style="margin-top:10px;padding:8px 11px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;font-size:11.5px;font-weight:700;color:#15803D">Checklist: ${siItems.length} puntos sin novedad</div>`;
        return`<div style="margin-top:10px;padding:8px 11px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B91C1C;margin-bottom:5px">Puntos con observación</div>
          ${noItems.map(([k])=>`<div style="font-size:11px;font-weight:600;color:#991B1B;padding:2px 0">• ${getL(k)}</div>`).join('')}
        </div>`;
      })()}
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="fmGenerarPDF('${s.id}')" style="flex:1;padding:10px;background:#0A1628;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          PDF
        </button>
        <button onclick="fmCompartirWA('${s.id}')" style="flex:1;padding:10px;background:#25D366;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#fff;display:flex;align-items:center;justify-content:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.855L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.659-.52-5.17-1.426l-.371-.22-3.763.981.999-3.668-.242-.379A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          WhatsApp
        </button>
      </div>
      <button onclick="this.closest('.fm-ov').remove()" class="fm-btn ghost" style="margin-top:10px">Cerrar</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ── PERFIL ──
window.abrirPerfil=function(){
  const user=window.auth?.currentUser;
  const ov=document.createElement('div');ov.className='fm-ov';
  // Renderizar perfil con datos actualizados de Firestore
  function _renderPerfilContenido(ecosActuales){
    const ecosPills=ecosActuales.length
      ?`<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center">${ecosActuales.map(eco=>`<span style="display:inline-flex;align-items:center;gap:6px;background:#EFF6FF;border-radius:100px;padding:5px 14px;font-size:12px;font-weight:700;color:#1D4ED8">ECO ${eco}${ecosActuales.length>1&&String(eco)===String(miVeh?.eco)?' · actual':''}</span>`).join('')}</div>`
      :'<div style="margin-top:8px;font-size:11px;color:#EF4444;font-weight:700">Sin vehículo asignado</div>';
    const body=document.getElementById('fm-perfil-body');
    if(!body)return;
    body.innerHTML=`
      <div style="text-align:center;padding:16px 0 20px">
        <div style="width:64px;height:64px;border-radius:50%;background:#1E3A5F;color:#fff;font-size:24px;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${(user?.displayName||user?.email||'?').charAt(0).toUpperCase()}</div>
        <div style="font-size:17px;font-weight:800">${user?.displayName||'—'}</div>
        <div style="font-size:13px;color:#64748B;margin-top:3px">${user?.email||'—'}</div>
        ${ecosPills}
      </div>
      ${!ecosActuales.length?`<button class="fm-btn primary" onclick="this.closest('.fm-ov').remove();fmVista('vehiculo')" style="margin-bottom:10px">Vincular mi vehículo</button>`:''}
      ${(esRolLibre()&&ecosActuales.length)?`<button class="fm-btn" style="margin-bottom:10px;background:#FEF2F2;color:#B91C1C;border:1.5px solid #FECACA;font-size:12px" onclick="window._desvinc()">Desvincular todas mis unidades</button>`:''}
      <button class="fm-btn danger" onclick="if(confirm('¿Cerrar sesión?')){window.auth.signOut().then(()=>location.reload());}">Cerrar sesión</button>`;
  }
  ov.innerHTML=`<div class="fm-sheet">
    <div class="fm-sheet-hd"><h3>Mi perfil</h3><button class="fm-sheet-x" onclick="this.closest('.fm-ov').remove()">✕</button></div>
    <div class="fm-sheet-body" id="fm-perfil-body">
      <div style="text-align:center;padding:30px;color:#94A3B8;font-size:12px">Cargando…</div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  // Leer Firestore en tiempo real para mostrar ECO actualizado
  if(miPerfil?.email){
    db.collection(C.USUARIOS).where('email','==',miPerfil.email).get()
      .then(snap=>{
        if(!snap.empty){
          const u=snap.docs[0].data();
          const ecos=[
            ...(Array.isArray(u.ecosVinculados)?u.ecosVinculados.map(String):[]),
            ...(u.ecoVinculado?[String(u.ecoVinculado)]:[]),
          ].filter((e,i,a)=>e&&a.indexOf(e)===i);
          // Actualizar miPerfil en memoria también
          miPerfil.ecosVinculados=ecos;
          miPerfil.ecoVinculado=ecos[0]||null;
          _renderPerfilContenido(ecos);
        } else {
          _renderPerfilContenido(getEcosVinculados());
        }
      })
      .catch(()=>_renderPerfilContenido(getEcosVinculados()));
  } else {
    _renderPerfilContenido(getEcosVinculados());
  }
};

// ── DESVINCULAR VEHÍCULO (SOLO ADMINS) ──
window._desvinc=async function(){
  if(!confirm('¿Desvincular tus unidades asignadas? Podrás seleccionar cualquier otra.'))return;
  try{
    const ecosPrevios=(Array.isArray(miPerfil.ecosVinculados)?miPerfil.ecosVinculados:(miPerfil.ecoVinculado?[miPerfil.ecoVinculado]:[])).slice();
    const snap=await db.collection(C.USUARIOS).where('email','==',miPerfil.email).get();
    if(!snap.empty)await snap.docs[0].ref.update({ecoVinculado:null,ecosVinculados:[],desvinculadoEn:new Date().toISOString()});
    flRegistrarDesvinculacion(miPerfil.email,'Autodesvinculación desde la app');
    ecosPrevios.forEach(eco=>flSincronizarResponsable(eco,''));
    miPerfil.ecoVinculado=null;
    miPerfil.ecosVinculados=[];
    miVeh=null;
    try{localStorage.removeItem(LS_ULTIMO_ECO);}catch{}
    document.querySelector('.fm-ov')?.remove();
    toast('Unidades desvinculadas — selecciona una nueva','ok');
    setTimeout(()=>renderSelectorFlota(),400);
  }catch(e){
    console.error('[MOVIL desvinc]',e);
    toast('Error al desvincular: '+e.message,'err');
  }
};

// ── PDF SOLICITUD (MÓVIL) ──
window.fmGenerarPDF=function(id){
  const s=misSols.find(x=>x.id===id);if(!s){toast('No encontrada','err');return;}
  const CHK={Cristales:['Medallón delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],Espejos:['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],Neumáticos:['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],Interiores:['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],Motor:['Batería','Tapón agua','Tapón radiador','Tapón dirección','Limpiaparabrisas en buen estado'],Cajuela:['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],Legal:['Tarjeta circulación']};
  const getL=k=>{for(const items of Object.values(CHK)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
  const noItems=Object.entries(s.checklist||{}).filter(([k,v])=>v==='no');
  const chkF=Object.entries(s.chkFotos||{}).filter(([k,v])=>v);
  const gasPct=s.gasolina||0;
  const gasColor=gasPct>50?'#16A34A':gasPct>25?'#D97706':'#DC2626';
  const gasAngle=(-120)+(gasPct/100)*240;
  const gasRad=gasAngle*Math.PI/180;
  const gasX=50+35*Math.cos(gasRad);const gasY=50+35*Math.sin(gasRad);
  const gasSVG=`<svg width="90" height="55" viewBox="0 0 100 60"><path d="M ${50+35*Math.cos(-120*Math.PI/180)} ${50+35*Math.sin(-120*Math.PI/180)} A 35 35 0 1 1 ${50+35*Math.cos(60*Math.PI/180)} ${50+35*Math.sin(60*Math.PI/180)}" fill="none" stroke="#E2E8F0" stroke-width="8" stroke-linecap="round"/>${gasPct>0?`<path d="M ${50+35*Math.cos(-120*Math.PI/180)} ${50+35*Math.sin(-120*Math.PI/180)} A 35 35 0 ${gasPct>50?1:0} 1 ${gasX} ${gasY}" fill="none" stroke="${gasColor}" stroke-width="8" stroke-linecap="round"/>`:''}
  <text x="50" y="48" text-anchor="middle" font-size="14" font-weight="800" fill="${gasColor}" font-family="system-ui">${gasPct}%</text></svg>`;
  const evThumbs=(s.evidencias||[]).slice(0,6).map((src,i)=>`<div style="display:inline-block;margin:3px;text-align:center"><img src="${src}" style="width:80px;height:60px;object-fit:cover;border-radius:5px;display:block;border:1px solid #E2E8F0"><div style="font-size:8px;color:#64748B;margin-top:1px">${(s.evidenciasMeta||[])[i]?.codigo||'Foto '+(i+1)}</div></div>`).join('');
  const chkThumbs=chkF.slice(0,6).map(([k,src])=>`<div style="display:inline-block;margin:3px;text-align:center"><img src="${src}" style="width:70px;height:52px;object-fit:cover;border-radius:5px;display:block;border:1px solid #BFDBFE"><div style="font-size:7px;color:#1D4ED8;margin-top:1px;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${getL(k)}</div></div>`).join('');
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>TCN-${id.slice(0,8).toUpperCase()}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;font-size:11px;color:#0A0F1E;padding:16px;background:#fff}.logo{font-size:18px;font-weight:900;letter-spacing:-1px}.logo em{color:#2563EB;font-style:normal}.field{background:#F8FAFD;border-radius:6px;padding:7px 10px;border:1px solid #E8EDF5;margin-bottom:6px}.field label{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:1px}.field span{font-size:12px;font-weight:700}.sec{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin:12px 0 5px;border-top:1px solid #E8EDF5;padding-top:7px}.gas{display:flex;align-items:center;gap:10px;background:#F8FAFD;border-radius:8px;padding:8px 12px;border:1px solid #E8EDF5;margin:6px 0}.obs{background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:8px 10px}.obs li{font-size:11px;font-weight:600;color:#991B1B;padding:1px 0}.ok{background:#F0FDF4;border:1px solid #BBF7D0;border-radius:6px;padding:8px 10px;font-size:11px;font-weight:700;color:#15803D}.photos{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px}.footer{margin-top:16px;padding-top:8px;border-top:1px solid #E8EDF5;font-size:9px;color:#94A3B8;text-align:center}@media print{button{display:none}}</style></head>
  <body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0A1628;padding-bottom:10px;margin-bottom:12px">
    <div><div class="logo">TECNO<em>CONTROL</em></div><div style="font-size:10px;color:#64748B;margin-top:2px">Solicitud vehicular</div></div>
    <div style="text-align:right"><div style="font-size:15px;font-weight:900;font-family:monospace">${id.slice(0,8).toUpperCase()}</div><div style="font-size:10px;color:#64748B">${s.creadoEn?s.creadoEn.substring(0,10):'—'} · ${s.estatus||'Solicitud'}</div></div>
  </div>
  <div style="background:#0A1628;color:#fff;border-radius:7px;padding:9px 12px;margin-bottom:10px">
    <div style="font-size:13px;font-weight:800">${s.vehiculo||'—'}</div>
    <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:1px">${s.tipo||'—'} · ${s.prioridad||'Normal'}</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
    ${[['KM',s.kilometrajeReportado||'—'],['Taller',s.taller||'Sin especificar'],['Solicitante',s.solicitante||'—'],['Fecha',s.creadoEn?s.creadoEn.substring(0,10):'—']].map(([l,v])=>`<div class="field"><label>${l}</label><span>${v}</span></div>`).join('')}
  </div>
  <div class="field" style="margin-top:5px"><label>Descripción</label><span style="font-size:11px;font-weight:500;line-height:1.5">${s.descripcion||'—'}</span></div>
  <div class="gas"><div>${gasSVG}</div><div><div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Gasolina</div><div style="font-size:20px;font-weight:900;color:${gasColor}">${gasPct}%</div></div></div>
  ${noItems.length?`<div class="obs" style="margin-top:5px"><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B91C1C;margin-bottom:5px">Observaciones checklist</div><ul style="padding-left:14px">${noItems.map(([k])=>`<li>${getL(k)}</li>`).join('')}</ul></div>`
    :Object.keys(s.checklist||{}).length?`<div class="ok" style="margin-top:5px">Checklist: todos los puntos sin novedad</div>`:''}
  ${evThumbs?`<div class="sec">Evidencias generales (${(s.evidencias||[]).length})</div><div class="photos">${evThumbs}</div>`:''}
  ${chkThumbs?`<div class="sec">Fotos de checklist (${chkF.length})</div><div class="photos">${chkThumbs}</div>`:''}
  ${s.comentarioRechazo?`<div class="obs" style="margin-top:8px"><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B91C1C;margin-bottom:3px">Motivo de rechazo</div>${s.comentarioRechazo}</div>`:''}
  <div class="footer">Portal Flotilla Tecnocontrol · ${new Date().toLocaleString('es-MX')} · ${id}</div>
  <div style="margin-top:12px;text-align:center"><button onclick="window.print()" style="padding:10px 24px;background:#0A1628;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button></div>
  </body></html>`;
  const win=window.open('','_blank');
  if(win){win.document.write(html);win.document.close();}
  else toast('Activa ventanas emergentes para PDF','warn');
};

// ── COMPARTIR WHATSAPP (MÓVIL) ──
window.fmCompartirWA=function(id){
  const s=misSols.find(x=>x.id===id);if(!s)return;
  const CHK={Cristales:['Medallón delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],Espejos:['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],Neumáticos:['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],Interiores:['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],Motor:['Batería','Tapón agua','Tapón radiador','Tapón dirección','Limpiaparabrisas en buen estado'],Cajuela:['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],Legal:['Tarjeta circulación']};
  const getL=k=>{for(const items of Object.values(CHK)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
  const noItems=Object.entries(s.checklist||{}).filter(([k,v])=>v==='no');
  const txt=[
    '*TECNOCONTROL — Solicitud Vehicular*',
    `ID: ${id.slice(0,8).toUpperCase()} | ${s.estatus||'Solicitud'}`,
    `Fecha: ${s.creadoEn?s.creadoEn.substring(0,10):'—'}`,
    '',
    `*Vehículo:* ${s.vehiculo||'—'}`,
    `*Tipo:* ${s.tipo||'—'}`,
    `*Prioridad:* ${s.prioridad||'Normal'}`,
    `*KM:* ${s.kilometrajeReportado||'—'}`,
    `*Gasolina:* ${s.gasolina!=null?s.gasolina+'%':'—'}`,
    `*Taller:* ${s.taller||'Sin especificar'}`,
    `*Solicitante:* ${s.solicitante||'—'}`,
    '',
    '*Descripción:*',
    s.descripcion||'—',
    noItems.length?'*Observaciones checklist:*\n'+noItems.map(([k])=>'\u2022 '+getL(k)).join('\n'):'',
    s.comentarioRechazo?'*Motivo rechazo:* '+s.comentarioRechazo:'',
  ].filter(x=>x!==undefined&&x!=='').join('\n');
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
};

console.log('[FLOTILLA MÓVIL] Tecnocontrol · App técnicos · Offline ready');


// VISTA 5 — UTILITARIOS / TRANSFERENCIA DE VEHÍCULO
// ══════════════════════════════════════════════════════
let utilState={
  modo:null, // 'entregar' | 'recibir'
  codigo:'',
  chk:{}, chkFotos:{}, evFotos:[],
  km:'', gasolina:50,
  fotoKm:null, // foto obligatoria del odómetro
  firma:null, // base64 del canvas de firma
  paso:1, // 1=selección modo, 2=datos, 3=firma, 4=confirmado
};
window.utilState=utilState;

function renderUtilRevisionEntrega(){
  const t=utilState.transferenciaData||{};
  const d=utilState.datosEntrega||{};
  const fotos=t.entregaFotos||[];
  const chk=t.entregaChk||{};
  const totalChk=Object.keys(chk).length;
  const okChk=Object.values(chk).filter(Boolean).length;
  return`
    <div style="padding:0 16px 150px">
      <div style="background:#FFFBEB;border:1.5px solid #FDE68A;border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:800;color:#92400E;margin-bottom:4px">Revisa antes de aceptar</div>
        <div style="font-size:12px;color:#92400E;line-height:1.4">Confirma que el vehículo y las evidencias de quien entrega coinciden con lo que ves físicamente antes de firmar.</div>
      </div>

      <div style="background:#F8FAFC;border-radius:12px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
          <div style="min-width:0;flex:1">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Entrega</div>
            <div style="font-size:13px;font-weight:700;color:#1E3A5F;word-break:break-word">${t.entregaNombre||'—'}</div>
          </div>
        </div>
        <div style="min-width:0">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Recibe (tú)</div>
          <div style="font-size:13px;font-weight:700;color:#15803D;word-break:break-word">${d.receptor||'—'}</div>
        </div>
      </div>

      <div style="font-size:13px;font-weight:800;margin-bottom:8px">ECO ${d.eco||'—'} · ${d.vehiculo||'—'}</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:#F8FAFC;border-radius:10px;padding:10px 12px"><div style="font-size:10px;color:#94A3B8;font-weight:700">Kilometraje entrega</div><div style="font-size:14px;font-weight:800">${t.entregaKm||'—'} km</div></div>
        <div style="background:#F8FAFC;border-radius:10px;padding:10px 12px"><div style="font-size:10px;color:#94A3B8;font-weight:700">Combustible</div><div style="font-size:14px;font-weight:800">${t.entregaGasolina!=null?t.entregaGasolina+'%':'—'}</div></div>
      </div>

      ${totalChk?`<div style="background:${okChk===totalChk?'#F0FDF4':'#FEF2F2'};border:1px solid ${okChk===totalChk?'#BBF7D0':'#FECACA'};border-radius:10px;padding:10px 12px;margin-bottom:16px;font-size:12.5px;font-weight:700;color:${okChk===totalChk?'#15803D':'#B91C1C'}">
        Checklist de entrega: ${okChk}/${totalChk} puntos en buen estado
      </div>`:''}

      ${fotos.length?`
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:8px">Fotos tomadas por quien entrega (${fotos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
        ${fotos.map(f=>`<img src="${f}" onclick="window.open(this.src)" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;background:#F1F5F9">`).join('')}
      </div>`:`<div style="font-size:12px;color:#94A3B8;margin-bottom:16px">Sin fotos adjuntas por quien entrega.</div>`}

      ${t.comentarioEntrega?`<div style="background:#EFF6FF;border-radius:10px;padding:10px 12px;margin-bottom:16px;font-size:12px;color:#1E40AF"><strong>Comentario de entrega:</strong> ${t.comentarioEntrega}</div>`:''}
    </div>
    <div style="position:fixed;bottom:calc(58px + env(safe-area-inset-bottom,0px));left:0;right:0;background:#fff;border-top:1px solid #E2E8F0;padding:14px 16px;display:flex;gap:8px;z-index:500;box-shadow:0 -4px 12px rgba(0,0,0,.1)">
      <button class="fm-btn ghost" style="flex:1" onclick="utilRechazarTransferencia()">Rechazar</button>
      <button class="fm-btn primary" style="flex:2" onclick="utilConfirmarEvidencia()">Todo coincide, continuar →</button>
    </div>
  `;
}
window.utilConfirmarEvidencia=function(){
  utilState.evidenciaConfirmada=true;
  renderUtil();
};
window.utilRechazarTransferencia=async function(){
  const motivo=prompt('¿Por qué la rechazas? (se le avisará a quien la envió)');
  if(motivo===null)return;
  try{
    const t=utilState.transferenciaData||{};
    await db.collection('flotilla_transferencias').doc(utilState.transferenciaId).update({
      estatus:'Rechazada',rechazadoEn:new Date().toISOString(),
      rechazadoPor:window.auth?.currentUser?.email||'',motivoRechazo:motivo||'',
    });
    if(t.entregaEmail){
      await db.collection('flotilla_notificaciones').add({
        tipo:'transferencia_rechazada',codigo:t.codigo||utilState.codigo,vehiculoEco:t.vehiculoEco||'—',
        para:t.entregaEmail,
        mensaje:`Tu transferencia del ECO ${t.vehiculoEco||'—'} fue rechazada. Motivo: "${motivo||'sin especificar'}"`,
        leido:false,creadaEn:new Date().toISOString(),
      });
    }
    toast('Transferencia rechazada','ok');
    utilReset();
  }catch(e){toast('Error: '+e.message,'err');}
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
      (utilState.paso===3&&utilState.modo==='recibir'&&!utilState.evidenciaConfirmada)?renderUtilRevisionEntrega():
      utilState.paso===3?renderUtilPaso3():
      renderUtilPaso4()}
  `);

  // Inicializar canvas de firma si estamos en paso 3 (ya confirmada la evidencia si es recepción)
  if(utilState.paso===3&&(utilState.modo!=='recibir'||utilState.evidenciaConfirmada))setTimeout(initFirmaCanvas,100);
  // Cargar personal si estamos en paso 2 entrega
  if(utilState.paso===2&&utilState.modo==='entregar'){setTimeout(cargarPersonalEnSelect,50);setTimeout(renderAngulosGrid,80);}
}
window.renderUtil=renderUtil;

// Cargar lista de personal en select de receptor (utilitario entrega)
// Cache de personas para autocomplete
let _flPersonasCache=[];

async function cargarPersonalEnSelect(){
  const miEmail=(window.auth?.currentUser?.email||'').toLowerCase();
  let desdeFirestore=[];
  try{
    const snap=await db.collection('fl_usuarios').orderBy('nombre').get();
    desdeFirestore=snap.docs.map(d=>{
      const dat=d.data();
      return{
        nombre:dat.nombre||dat.email||'—',
        email:(dat.email||'').toLowerCase(),
        eco:dat.ecoVinculado||dat.ecosVinculados?.[0]||null,
        rol:dat.rol||'tecnico',
      };
    }).filter(p=>p.nombre&&p.nombre!=='—'&&p.email!==miEmail);
  }catch{ desdeFirestore=[]; }

  // Siempre cargar lista hardcodeada y fusionar — Firestore puede tener datos incompletos
  const colab=await cargarColaboradores();
  const emailsFirestore=new Set(desdeFirestore.map(p=>p.email).filter(Boolean));
  // Nombres ya cubiertos por Firestore (normalizado para comparar)
  const norm=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
  const nombresFirestore=new Set(desdeFirestore.map(p=>norm(p.nombre)));
  // Agregar de la lista hardcodeada los que NO estén ya en Firestore
  const desdeHardcoded=colab
    .filter(n=>!nombresFirestore.has(norm(n)))
    .map(n=>({nombre:n,email:'',eco:null,rol:'tecnico'}));

  _flPersonasCache=[...desdeFirestore,...desdeHardcoded];
  // Mostrar todos al inicio
  utilFiltrarReceptor('');
}

window.utilFiltrarReceptor=async function(q){
  const lista=document.getElementById('util-receptor-list');
  if(!lista)return;
  // Si el cache está vacío (aún cargando o falló), reintentar
  if(!_flPersonasCache.length&&q){
    await cargarPersonalEnSelect();
  }
  // Normalizar: quitar acentos para que "Gonzalez" encuentre "González"
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const term=norm(q||'').trim();
  // Búsqueda tokenizada: cada palabra del term debe aparecer en nombre o email
  // Permite "Sergio Carmona" → match "Carmona Lagunas Sergio"
  const tokens=term?term.split(/\s+/).filter(Boolean):[];
  const filtrados=tokens.length
    ?_flPersonasCache.filter(p=>{
        const haystack=norm(p.nombre+' '+p.email);
        return tokens.every(t=>haystack.includes(t));
      })
    :_flPersonasCache;
  if(filtrados.length===0){
    lista.innerHTML=`<div style="padding:12px 14px;font-size:12px;color:#94A3B8">Sin resultados para "${q}"</div>`;
    lista.style.display='block';
    return;
  }
  lista.innerHTML=filtrados.slice(0,12).map(p=>`
    <div onclick="utilSelReceptor('${p.nombre.replace(/'/g,"\\'")}','${p.email}')"
      style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #F1F5F9;display:flex;align-items:center;gap:10px"
      onmouseenter="this.style.background='#F8FAFD'" onmouseleave="this.style.background=''">
      <div style="width:32px;height:32px;border-radius:50%;background:#EFF6FF;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:800;color:#2563EB">
        ${p.nombre.charAt(0).toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:#0A0F1E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre}</div>
        <div style="font-size:10px;color:#94A3B8;margin-top:1px">${p.email||p.rol||'—'}${p.eco?' · ECO '+p.eco:''}</div>
      </div>
      ${p.eco?`<div style="font-size:9px;font-weight:800;color:#B45309;background:#FEF3C7;padding:2px 7px;border-radius:100px">ECO ${p.eco}</div>`:''}
    </div>`).join('');
  lista.style.display='block';
  // Cerrar al hacer click fuera
  setTimeout(()=>{
    const cerrar=(e)=>{
      if(!document.getElementById('util-receptor-wrap')?.contains(e.target)){
        lista.style.display='none';
        document.removeEventListener('click',cerrar);
      }
    };
    document.addEventListener('click',cerrar);
  },100);
};

window.utilSelReceptor=function(nombre,email){
  const inp=document.getElementById('util-receptor-inp');
  const hidden=document.getElementById('util-receptor');
  const hiddenEmail=document.getElementById('util-receptor-email');
  const lista=document.getElementById('util-receptor-list');
  if(inp)inp.value=nombre;
  if(hidden)hidden.value=nombre; // solo el nombre — el email va aparte en util-receptor-email
  if(hiddenEmail)hiddenEmail.value=email||'';
  if(lista)lista.style.display='none';
  // Cambiar borde a verde para confirmar selección
  const wrap=document.getElementById('util-receptor-inp');
  if(wrap){wrap.style.borderColor='#22C55E';wrap.style.background='#F0FDF4';}
};

// PASO 1: Elegir modo
function renderUtilPaso1(){
  // Si hay un borrador de una transferencia a medio llenar (se cerró la app,
  // se fue la señal, etc.), ofrecer continuar donde se quedó — mismo patrón
  // que ya usan Solicitud y Check list semanal.
  const _utilDraft=_draftLoad(_DRAFT.UTIL);
  if(_utilDraft&&_utilDraft.modo&&_utilDraft.paso>1){
    setTimeout(()=>_draftBanner('util',
      ()=>{
        Object.assign(utilState,_utilDraft);
        renderUtil();
        toast('Borrador restaurado ✓','ok');
      },
      ()=>{ _draftClear(_DRAFT.UTIL); }
    ),400);
  }
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
      <div style="position:relative" id="util-receptor-wrap">
        <input id="util-receptor-inp" placeholder="Buscar por nombre o email…" autocomplete="off" value="${utilState.receptorNombre||''}"
          style="width:100%;padding:11px 14px;border:1.5px solid #E2E8F0;border-radius:11px;font-size:13px;background:${utilState.receptorNombre?'#F0FDF4':'#fff'};outline:none;box-sizing:border-box;color:#0A0F1E;${utilState.receptorNombre?'border-color:#22C55E':''}"
          oninput="utilFiltrarReceptor(this.value)"
          onfocus="utilFiltrarReceptor(this.value)">
        <input type="hidden" id="util-receptor" value="${utilState.receptorNombre||''}">
        <input type="hidden" id="util-receptor-email" value="${utilState.receptorEmail||''}">
        <div id="util-receptor-list" style="display:none;position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid #E2E8F0;border-radius:11px;margin-top:4px;max-height:220px;overflow-y:auto;z-index:999;box-shadow:0 8px 24px rgba(0,0,0,.12)"></div>
      </div>
    </div>
    <div class="fm-fld"><label>Comentarios de entrega <span style="font-size:9px;font-weight:500;text-transform:none;color:#94A3B8">(opcional)</span></label>
      <textarea id="util-comentario-entrega" placeholder="Estado del vehículo, observaciones, acuerdos…" rows="2" style="width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:11px;font-size:13px;background:#fff;outline:none;box-sizing:border-box;resize:none;font-family:inherit">${utilState.comentarioEntrega||''}</textarea>
    </div>

    <div class="fm-fld"><label>KM al entregar</label>
      <input type="number" id="util-km" placeholder="${v?.km||0}" inputmode="numeric" value="${utilState.km||''}"></div>

    <div class="fm-fld">
      <label>Foto del odómetro <span style="font-size:9px;font-weight:500;text-transform:none;color:#EF4444">obligatoria</span></label>
      <div id="util-km-foto-wrap" style="display:flex;align-items:center;gap:10px">
        ${utilState.fotoKm?`<img src="${utilState.fotoKm}" onclick="fmVerImg(this.src)" style="width:60px;height:45px;object-fit:cover;border-radius:7px;border:2px solid #22C55E;cursor:pointer">`:''}
        <button onclick="utilCapturarKm()" style="display:flex;align-items:center;gap:6px;padding:9px 16px;background:#F8FAFD;border:1.5px dashed #CBD5E1;border-radius:10px;font-family:inherit;font-size:12px;font-weight:700;color:#475569;cursor:pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          ${utilState.fotoKm?'Retomar foto':'Foto odómetro'}
        </button>
        <span id="util-km-foto-ok" style="font-size:11px;${utilState.fotoKm?'color:#15803D':'color:#94A3B8'}">${utilState.fotoKm?'Foto OK ✓':'Sin foto'}</span>
      </div>
    </div>

    <div class="fm-fld">
      <label>Nivel de gasolina</label>
      <div id="util-gauge-wrap">${renderGaugeSVG(utilState.gasolina)}<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div></div>
      <input type="range" min="0" max="100" value="${utilState.gasolina}" oninput="utilGas(this.value)" style="width:100%;margin-top:6px;accent-color:#2563EB">
    </div>

    <div class="fm-fld">
      <label>Fotos obligatorias del vehículo <span style="font-size:9px;font-weight:500;text-transform:none;color:#94A3B8">(7 requeridas · cámara obligatoria)</span></label>
      <div style="font-size:10px;color:#64748B;margin-bottom:10px;line-height:1.5">Toma cada ángulo requerido. Las 7 fotos son obligatorias para continuar.</div>
      <div id="util-angulos-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:8px"></div>
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
        <label>Código de 6 dígitos</label>
        <input type="number" id="util-codigo" placeholder="000000" inputmode="numeric" maxlength="6" style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:24px;font-weight:800;letter-spacing:6px">
      </div>
      <button class="fm-btn primary" onclick="utilVerificarCodigo()" style="width:100%;margin-top:8px">Verificar código</button>
      <div id="util-codigo-msg" style="margin-top:10px;font-size:12px"></div>
    </div>
    ${utilState.transferenciaData?`
    <div class="fm-fld" style="margin-top:12px">
      <label>Tu comentario de recepción <span style="font-size:9px;font-weight:500;text-transform:none;color:#94A3B8">(opcional)</span></label>
      <textarea id="util-comentario-recepcion" placeholder="Confirmo recepción en buen estado / observaciones…" rows="2" style="width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:11px;font-size:13px;background:#fff;outline:none;box-sizing:border-box;resize:none;font-family:inherit"></textarea>
    </div>`:''}`}
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

      <button class="fm-btn ghost" onclick="utilReset()">
        Listo
      </button>
    </div>
  `;
}

// HELPERS UTILITARIOS
// ── Reset utilitario — función global para que el onclick la encuentre ──
window.utilReset=function(){
  Object.assign(utilState,{modo:null,codigo:'',chk:{},chkFotos:{},evFotos:[],km:'',gasolina:50,fotoKm:null,firma:null,paso:1,transferenciaId:null,datosEntrega:null,codigoGenerado:null,evidenciaConfirmada:false});
  window.utilState=utilState;
  _flPersonasCache=[];
  _draftClear(_DRAFT.UTIL);
  renderUtil();
};

window.utilSetModo=function(m){
  if(m==='entregar'&&!miVeh){
    toast('No tienes vehículo vinculado para entregar','err');return;
  }
  utilState.modo=m;utilState.paso=2;renderUtil();
};
window.utilGas=function(v){utilState.gasolina=Number(v);const w=document.getElementById('util-gauge-wrap');if(w)w.innerHTML=renderGaugeSVG(Number(v))+'<div class="fm-gauge-labels" style="width:200px"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>';};

function renderChkUtil(){
  const items=['Carrocería sin daños nuevos','Cristales completos','Llantas en buen estado','Herramienta completa','Sin multas vigentes','Documentos en orden'];
  return items.map((item,i)=>{
    const key='util_'+i;
    const val=utilState.chk[key]||'';
    return`<div class="fm-chk-row" id="util-cr-${key}" style="flex-wrap:wrap">
      <span class="fm-chk-name">${item}</span>
      <button class="fm-chk-si ${val==='si'?'on':''}" onclick="utilChk('${key}','si')">SI</button>
      <button class="fm-chk-no ${val==='no'?'on':''}" onclick="utilChk('${key}','no')">NO</button>
      ${val==='no'?`<input type="text" placeholder="Describe el detalle..." value="${utilState.chkComt?.[key]||''}" onchange="utilChkComt('${key}',this.value)" style="width:100%;margin-top:5px;padding:6px 10px;border:1.5px solid #FECACA;border-radius:8px;font-size:11px;font-family:inherit;outline:none;background:#FFF5F5;box-sizing:border-box">`:''}
    </div>`;
  }).join('');
}

window.utilChkComt=function(key,val){
  if(!utilState.chkComt)utilState.chkComt={};
  utilState.chkComt[key]=val;
};
window.utilChk=function(key,val){
  utilState.chk[key]=utilState.chk[key]===val?'':val;
  _draftSave(_DRAFT.UTIL,utilState);
  // Re-renderizar para mostrar/ocultar campo de comentario
  const wrap=document.getElementById('util-chk');
  if(wrap)wrap.innerHTML=renderChkUtil();
  const rev=Object.values(utilState.chk).filter(v=>v).length;
  const cnt=document.getElementById('util-chk-cnt');if(cnt)cnt.textContent=rev+' revisados';
};

// ── ÁNGULOS OBLIGATORIOS DE TRANSFERENCIA (7 fotos) ───────────
const UTIL_ANGULOS=[
  {key:'frente',    label:'Frente'},
  {key:'atras',     label:'Atrás'},
  {key:'derecha',   label:'Lado derecho'},
  {key:'izquierda', label:'Lado izquierdo'},
  {key:'motor',     label:'Motor'},
  {key:'interior',  label:'Interiores'},
  {key:'libre',     label:'Foto libre'},
];

function renderAngulosGrid(){
  const wrap=document.getElementById('util-angulos-grid');
  if(!wrap)return;
  wrap.innerHTML=UTIL_ANGULOS.map(a=>{
    const tomada=utilState.evFotos?.find(f=>f?.meta?.angulo===a.key);
    const bg=tomada?'#F0FDF4':'#F8FAFD';
    const border=tomada?'2px solid #22C55E':'1.5px dashed #CBD5E1';
    const color=tomada?'#15803D':'#64748B';
    return`<button onclick="utilCapturar('${a.key}')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:12px 6px;background:${bg};border:${border};border-radius:10px;font-family:inherit;cursor:pointer;min-height:78px;position:relative;overflow:hidden">
      ${tomada?`<img src="${tomada.src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.3">`:''}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${tomada?'#15803D':'#94A3B8'}" stroke-width="2" stroke-linecap="round" style="position:relative;z-index:1"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
      <span style="font-size:10px;font-weight:700;color:${color};position:relative;z-index:1">${tomada?'✓ ':''}<b>${a.label}</b></span>
    </button>`;
  }).join('');
}
window.renderAngulosGrid=renderAngulosGrid;

window.utilCapturar=async function(angulo){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='image/*';inp.capture='environment';
  inp.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px';
  document.body.appendChild(inp);
  inp.onchange=async function(){
    const file=this.files[0];
    if(!file){document.body.removeChild(inp);return;}
    toast('Procesando foto…','info');
    const [gps,imgData]=await Promise.all([
      getGPS(),
      new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);}),
    ]);
    const now=new Date();
    const meta={
      codigo:genCod(),angulo:angulo||'libre',
      fecha:now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
      hora:now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
      timestamp:now.toISOString(),gps,
      eco:miVeh?.eco||'—',unidad:miVeh?.unidad||'—',
      usuario:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
      modo:'utilitario-entrega',
    };
    const comprimida=await comprimirBase64(imgData,800,0.60);
    const sellada=await sellarImg(comprimida,meta);
    // Reemplazar si ya existe foto de este ángulo
    if(angulo){
      const idx=utilState.evFotos.findIndex(f=>f?.meta?.angulo===angulo);
      if(idx>=0)utilState.evFotos.splice(idx,1,{src:sellada,meta});
      else utilState.evFotos.push({src:sellada,meta});
    } else {
      utilState.evFotos.push({src:sellada,meta});
    }
    const tomadas=UTIL_ANGULOS.filter(a=>utilState.evFotos.some(f=>f?.meta?.angulo===a.key)).length;
    toast(`"${UTIL_ANGULOS.find(a=>a.key===angulo)?.label||angulo}" · ${tomadas}/7 fotos`,'ok');
    renderAngulosGrid();
    // Autoguardar borrador incluyendo la foto recién tomada — mismo patrón que
    // fmCapturar usa para Solicitud y Check list semanal (evFotos, aunque no
    // se persiste en localStorage por pesado, sí importa mantener el resto del
    // estado sincronizado ante un cierre inesperado justo después de la foto).
    _draftSave(_DRAFT.UTIL,utilState);
    document.body.removeChild(inp);
  };
  inp.click();
};

// ── FOTO ODÓMETRO ──────────────────────────────────────────────
window.utilCapturarKm=async function(){
  const inp=document.createElement('input');
  inp.type='file';inp.accept='image/*';inp.capture='environment';
  inp.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0;width:1px;height:1px';
  document.body.appendChild(inp);
  inp.onchange=async function(){
    const file=this.files[0];
    if(!file){document.body.removeChild(inp);return;}
    toast('Procesando foto de odómetro…','info');
    const imgData=await new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);});
    const comprimida=await comprimirBase64(imgData,800,0.65);
    utilState.fotoKm=comprimida;
    const wrap=document.getElementById('util-km-foto-wrap');
    const ok=document.getElementById('util-km-foto-ok');
    if(wrap){
      const existing=wrap.querySelector('img');if(existing)existing.remove();
      const img=document.createElement('img');
      img.src=comprimida;
      img.style.cssText='width:60px;height:45px;object-fit:cover;border-radius:7px;border:2px solid #22C55E;cursor:pointer';
      img.onclick=()=>fmVerImg(comprimida);
      wrap.appendChild(img);
    }
    if(ok){ok.textContent='Foto OK ✓';ok.style.color='#15803D';}
    toast('Foto de odómetro guardada','ok');
    _draftSave(_DRAFT.UTIL,utilState);
    document.body.removeChild(inp);
  };
  inp.click();
};

window.utilSiguiente=function(){
  const receptor=document.getElementById('util-receptor')?.value?.trim();
  const receptorEmail=document.getElementById('util-receptor-email')?.value?.trim()||'';
  const km=document.getElementById('util-km')?.value?.trim();
  const comentarioEnt=document.getElementById('util-comentario-entrega')?.value?.trim()||'';
  // Autoguardar km, comentario, receptor y su email antes de validar
  if(km) utilState.km=km;
  utilState.comentarioEntrega=comentarioEnt;
  utilState.receptorNombre=receptor||'';
  utilState.receptorEmail=receptorEmail;
  _draftSave(_DRAFT.UTIL,{...utilState, receptor:receptor||'', km:km||''});

  if(!receptor){toast('⚠ Selecciona a quién se entrega el vehículo','err');return;}

  if(!km||isNaN(Number(km))||Number(km)<=0){
    toast('⚠ El kilometraje actual es obligatorio','err');
    document.getElementById('util-km')?.focus();
    return;
  }

  // Foto de odómetro obligatoria
  if(!utilState.fotoKm){
    toast('⚠ La foto del odómetro es obligatoria','err');
    return;
  }

  // Validar 7 ángulos obligatorios
  const faltantes=UTIL_ANGULOS.filter(a=>!utilState.evFotos.some(f=>f?.meta?.angulo===a.key));
  if(faltantes.length>0){
    const nombres=faltantes.map(a=>a.label).join(', ');
    toast(`⚠ Faltan ${faltantes.length} fotos: ${nombres}`,'err');
    return;
  }

  // Checklist — todos los 6 items deben estar marcados
  const totalItems=6;
  const marcados=Object.keys(utilState.chk).filter(k=>k.startsWith('util_')&&utilState.chk[k]).length;
  if(marcados<totalItems){
    toast(`⚠ Completa el checklist (${marcados}/${totalItems} items marcados)`,'err');
    return;
  }

  utilState.chkComt=utilState.chkComt||{};
  utilState.datosEntrega={
    vehiculo:miVeh?.unidad||'—',eco:miVeh?.eco||'—',
    km,receptor,receptorEmail,
    chkComt:utilState.chkComt,
    nombre:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
    comentarioEntrega:comentarioEnt,
  };
  utilState.paso=3;renderUtil();
};

window.utilVerificarCodigo=async function(){
  const cod=document.getElementById('util-codigo')?.value?.trim().toUpperCase();
  if(!cod||cod.length<4||cod.length>6||isNaN(Number(cod))){toast('Ingresa el código de 6 dígitos','err');return;}
  toast('Verificando…','info');
  const msg=document.getElementById('util-codigo-msg');
  try{
    const snap=await db.collection('flotilla_transferencias').where('codigo','==',cod).where('estatus','==','Pendiente recepción').get();
    if(snap.empty){if(msg)msg.innerHTML=`<span style="color:#B91C1C">Código no encontrado o ya fue utilizado</span>`;return;}
    const t={id:snap.docs[0].id,...snap.docs[0].data()};
    utilState.transferenciaId=t.id;
    utilState.transferenciaData=t; // doc completo — necesario para limpiar entregador al cerrar
    utilState.datosEntrega={
      vehiculo:t.vehiculoUnidad,eco:t.vehiculoEco,
      km:t.entregaKm||'',
      receptor:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
      nombre:t.entregaNombre,
      entregaEmail:t.entregaEmail||'', // ← FIX CRÍTICO: sin esto el entregador nunca se desvincula
    };
    toast('Código válido — ECO '+t.vehiculoEco,'ok');
    setTimeout(()=>{utilState.paso=3;renderUtil();},800);
  }catch(e){if(msg)msg.innerHTML=`<span style="color:#B91C1C">Error: ${e.message}</span>`;}
};

// CANVAS DE FIRMA
function initFirmaCanvas(canvasId){
  canvasId=canvasId||'firma-canvas';
  const canvas=document.getElementById(canvasId);if(!canvas)return;
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

window.limpiarFirma=function(canvasId){const c=document.getElementById(canvasId||'firma-canvas');if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}};

window.firmaTieneTrazo=function(canvasId){
  const c=document.getElementById(canvasId||'firma-canvas');if(!c)return false;
  const ctx=c.getContext('2d');
  const data=ctx.getImageData(0,0,c.width,c.height).data;
  return data.some((_,i)=>i%4===3&&data[i]>0);
};

window.firmaExportar=function(canvasId){
  const canvas=document.getElementById(canvasId||'firma-canvas');if(!canvas)return null;
  const firmaCvs=document.createElement('canvas');
  firmaCvs.width=canvas.width;firmaCvs.height=canvas.height;
  const firmaCx=firmaCvs.getContext('2d');
  firmaCx.fillStyle='#ffffff';firmaCx.fillRect(0,0,firmaCvs.width,firmaCvs.height);
  firmaCx.drawImage(canvas,0,0);
  return firmaCvs.toDataURL('image/jpeg',0.85);
};

window.utilConfirmarFirma=async function(){
  const canvas=document.getElementById('firma-canvas');
  if(!canvas){toast('Error al obtener firma','err');return;}
  // Verificar que hay firma
  const ctx=canvas.getContext('2d');
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const tieneFirma=data.some((_,i)=>i%4===3&&data[i]>0);
  if(!tieneFirma){toast('Dibuja tu firma primero','err');return;}
  // Exportar firma con fondo blanco (JPEG no soporta transparencia → fondo negro sin esto)
  const firmaCvs=document.createElement('canvas');
  firmaCvs.width=canvas.width;firmaCvs.height=canvas.height;
  const firmaCx=firmaCvs.getContext('2d');
  firmaCx.fillStyle='#ffffff';firmaCx.fillRect(0,0,firmaCvs.width,firmaCvs.height);
  firmaCx.drawImage(canvas,0,0);
  utilState.firma=firmaCvs.toDataURL('image/jpeg',0.85);
  const btn=document.getElementById('util-btn-firmar');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const esEntrega=utilState.modo==='entregar';
  // Generar código único de transferencia
  const now=new Date();
  const codigo=String(Math.floor(100000+Math.random()*900000)); // 6 dígitos numéricos
  utilState.codigoGenerado=codigo;
  const userEmail=window.auth?.currentUser?.email||'';
  const userName=window.auth?.currentUser?.displayName||userEmail;
  try{
    if(esEntrega){
      const fotosComprimidas=await Promise.all(
        utilState.evFotos.map(e=>comprimirBase64(e.src,600,0.55))
      );
      // Foto odómetro separada
      const fotoKmComp=utilState.fotoKm?await comprimirBase64(utilState.fotoKm,800,0.65):null;
      const receptorEmail=(utilState.datosEntrega?.receptorEmail||'').toLowerCase();
      // Mismo plazo que ya hace cumplir flRevisarTransferenciasPendientes en el
      // portal (24h) — antes esto no se decía en ningún lado al iniciar la
      // transferencia, así que ni el receptor ni la plataforma sabían de
      // cuánto tiempo disponían hasta que ya casi vencía.
      const venceEn=new Date(now.getTime()+24*60*60*1000);
      const venceTxt=venceEn.toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
      // Crear documento de transferencia
      const docObj={
        codigo,tipo:'transferencia',
        vehiculoEco:miVeh?.eco||'',vehiculoId:miVeh?.id||'',vehiculoUnidad:miVeh?.unidad||'',
        entregaEmail:userEmail,entregaNombre:userName,entregaFirma:utilState.firma,
        entregaKm:utilState.datosEntrega?.km||'',entregaGasolina:utilState.gasolina,
        entregaChk:{...utilState.chk},entregaFotos:fotosComprimidas,
        entregaFotosMeta:utilState.evFotos.map(e=>e.meta),
        fotoKm:fotoKmComp||null,
        receptorNombre:utilState.datosEntrega?.receptor||'',
        receptorEmail,
        venceEn:venceEn.toISOString(),
        comentarioEntrega:utilState.datosEntrega?.comentarioEntrega||'',
        comentarioRecepcion:document.getElementById('util-comentario-recepcion')?.value?.trim()||'',
        estatus:'Pendiente recepción',
        emails:[userEmail,receptorEmail].filter(Boolean),
        creadoEn:now.toISOString(),
      };
      await db.collection('flotilla_transferencias').add(docObj);
      // BLOQUEO: NO desvincular al entregador hasta que el receptor confirme
      // Solo marcar en su perfil que hay una transferencia pendiente
      const snapEntregador=await db.collection('fl_usuarios').where('email','==',userEmail).get();
      if(!snapEntregador.empty){
        await snapEntregador.docs[0].ref.update({
          transferenciaPendiente:codigo,
          transferenciaPendienteEco:docObj.vehiculoEco,
          transferenciaPendienteEn:now.toISOString(),
        });
      }
      // Actualizar en memoria — vehículo sigue vinculado pero marcado como "pendiente"
      if(miPerfil){
        miPerfil.transferenciaPendiente=codigo;
        miPerfil.transferenciaPendienteEco=docObj.vehiculoEco;
      }
      // Notificar — ANTES esta notificación no tenía "para" en absoluto, así
      // que no llegaba al inbox de nadie. Ahora sí llega directo al técnico
      // que debe recibir (si capturamos su correo) con instrucción clara y
      // plazo, y también a los admins de flotilla (la "plataforma") con quién
      // es el receptor y el mismo límite de tiempo.
      const destinatarios=new Set(ADMINS_FLOTILLA);
      if(receptorEmail)destinatarios.add(receptorEmail);
      await Promise.all([...destinatarios].map(email=>{
        const esReceptor=email===receptorEmail;
        return db.collection('flotilla_notificaciones').add({
          tipo:'transferencia_iniciada',codigo,vehiculoEco:docObj.vehiculoEco,
          para:email,
          mensaje:esReceptor
            ?`${userName} te está transfiriendo el ECO ${docObj.vehiculoEco||'—'}. Debes recibirlo (confirmar con tu firma) antes del ${venceTxt}, o la transferencia vencerá.`
            :`${userName} inició transferencia del ECO ${docObj.vehiculoEco||'—'} a ${docObj.receptorNombre||'—'}${receptorEmail?' ('+receptorEmail+')':' — sin correo capturado, no se le pudo notificar directamente'}. Pendiente de recepción, vence el ${venceTxt}.`,
          leido:false,creadaEn:now.toISOString(),
        }).catch(()=>{});
      }));
    } else {
      // RECIBIR: completar transferencia
      if(utilState.transferenciaId){
        const ecoRecibido=utilState.datosEntrega?.eco||'';
        const entregaEmail=(utilState.datosEntrega?.entregaEmail||utilState.transferenciaData?.entregaEmail||'').toLowerCase();
        // Comprimir firma del receptor antes de guardar
        const recibioFirmaComprimida=await comprimirBase64(utilState.firma,400,0.75);
        await db.collection('flotilla_transferencias').doc(utilState.transferenciaId).update({
          recibioEmail:userEmail,recibioNombre:userName,recibioFirma:recibioFirmaComprimida,
          recibioKm:utilState.datosEntrega?.km||'',
          recibioChk:{...utilState.chk},
          estatus:'Completada',completadoEn:now.toISOString(),
          emails:[...(utilState.emails||[]),userEmail],
        });
        // AHORA SÍ: desvincular al entregador (confirmó recepción)
        if(entregaEmail){
          const snapEnt=await db.collection('fl_usuarios').where('email','==',entregaEmail).get();
          if(!snapEnt.empty){
            const dEnt=snapEnt.docs[0].data();
            const ecosAnt=Array.isArray(dEnt.ecosVinculados)?dEnt.ecosVinculados.map(String):(dEnt.ecoVinculado?[String(dEnt.ecoVinculado)]:[]);
            const ecosNuevos=ecosAnt.filter(e=>e!==String(ecoRecibido));
            await snapEnt.docs[0].ref.update({
              ecoVinculado:ecosNuevos[0]||null,
              ecosVinculados:ecosNuevos,
              desvinculadoEn:now.toISOString(),
              ecoEntregado:ecoRecibido,
              transferenciaPendiente:null,
              transferenciaPendienteEco:null,
            });
          }
        }
        // VINCULAR al que recibe
        const snapRecibe=await db.collection('fl_usuarios').where('email','==',userEmail).get();
        if(!snapRecibe.empty){
          const docAnterior=snapRecibe.docs[0].data();
          const ecosAnt=Array.isArray(docAnterior.ecosVinculados)?docAnterior.ecosVinculados.map(String):(docAnterior.ecoVinculado?[String(docAnterior.ecoVinculado)]:[]);
          const ecosNuevos=ecosAnt.includes(String(ecoRecibido))?ecosAnt:[...ecosAnt,String(ecoRecibido)];
          await db.collection('fl_usuarios').doc(snapRecibe.docs[0].id).update({
            ecoVinculado:ecosNuevos[0],
            ecosVinculados:ecosNuevos,
            vinculadoEn:now.toISOString(),
            ecoAnterior:docAnterior.ecoVinculado||null,
            rol:docAnterior.rol||'tecnico',
          });
          if(miPerfil)miPerfil.ecosVinculados=ecosNuevos;
        } else {
          await db.collection('fl_usuarios').add({
            email:userEmail,nombre:userName,
            ecoVinculado:ecoRecibido,ecosVinculados:[String(ecoRecibido)],vinculadoEn:now.toISOString(),
            rol:'tecnico',
          });
          if(miPerfil)miPerfil.ecosVinculados=[String(ecoRecibido)];
        }
        // Sincronizar responsable del vehículo + bitácora de uso con quien recibió
        flRegistrarVinculacion(ecoRecibido,userEmail,userName);
        flSincronizarResponsable(ecoRecibido,userName);
        if(entregaEmail)flRegistrarDesvinculacion(entregaEmail,'Transferencia completada — entregó el vehículo');
        if(miPerfil){miPerfil.ecoVinculado=ecoRecibido;}
        guardarUltimoEco(ecoRecibido);
        try{
          const snapVeh=await db.collection('flotilla_vehiculos').where('eco','==',String(ecoRecibido)).get();
          if(!snapVeh.empty) miVeh={id:snapVeh.docs[0].id,...snapVeh.docs[0].data()};
          else{
            const found=window.CAT_FL?.find(v=>String(v.eco)===String(ecoRecibido));
            if(found) miVeh={id:'eco-'+found.eco,...found};
          }
        }catch(eVeh){
          const found=window.CAT_FL?.find(v=>String(v.eco)===String(ecoRecibido));
          if(found) miVeh={id:'eco-'+found.eco,...found};
        }
        await db.collection('flotilla_notificaciones').add({
          tipo:'transferencia_completada',codigo:utilState.codigoGenerado||utilState.codigo||'',
          vehiculoEco:ecoRecibido,
          mensaje:`Transferencia completada. ${userName} recibió el ECO ${ecoRecibido||'—'}. Vehículo liberado del perfil anterior.`,
          leido:false,creadaEn:now.toISOString(),
        });
      }
    }
    _draftClear(_DRAFT.UTIL);
    utilState.paso=4;renderUtil();
    toast('Responsiva guardada correctamente','ok');
  }catch(e){
    console.error('[UTIL firma]',e);
    toast('Error al guardar: '+e.message,'err');
    if(btn){btn.disabled=false;btn.textContent='Firmar y confirmar';}
  }
};

})();
