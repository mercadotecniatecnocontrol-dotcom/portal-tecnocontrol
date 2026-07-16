// flotilla.js v16 — fix taller único + presupuesto (comprometido mes) + auto-sync + flReconciliarTaller
// Layout: topbar 4 botones · lista lateral · grid 2x2 fotos reales · checklist · panel derecho
(function(){
'use strict';

const IMG_VEH={
  auto_frente:"./assets/fl-auto_frente.webp",
  auto_atras:"./assets/fl-auto_atras.webp",
  auto_derecha:"./assets/fl-auto_derecha.webp",
  auto_izquierda:"./assets/fl-auto_izquierda.webp",
};

const SVG_TROCA={
  troca_frente:`<svg viewBox="0 0 283.96 253.97" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" style="display:block"><image width="284" height="254" xlink:href="./assets/fl-troca_frente.png"/></svg>`,
  troca_atras:`<svg viewBox="0 0 290.96 256.97" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" style="display:block"><image width="291" height="257" xlink:href="./assets/fl-troca_atras.png"/></svg>`,
  troca_izquierda:`<svg viewBox="0 0 685.91 245.97" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" style="display:block"><image width="686" height="246" xlink:href="./assets/fl-troca_izquierda.png"/></svg>`,
  troca_derecha:`<svg viewBox="0 0 684.91 235.97" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="100%" style="display:block"><image width="685" height="236" xlink:href="./assets/fl-troca_derecha.png"/></svg>`,
};


const FL_COLABORADORES = ["Aceves Ivan Argenis","Acosta Bustillos Francisca","Acosta Chavira Carlos","Acosta Contreras Cristina Judith","Barraza Luya Saúl Ismael","Calixto Sánchez Rafael","Carmona Lagunas Sergio","Castro Muñoz Saúl","Chacón Terrazas Lucero","Chávez Alvarez Ruth Yadira","Chávez Barraza Oscar Iván","Chávez Chávez Iván","Contreras Morales Elva Nidia","Coronado Valenzuela Socorro Annet","De La Cruz Emilio Julio César","De La O Maese Martín","Durstewitz Maese Guillermo","Enríquez Gallardo Jorge Alberto","Escalante Jaramillo Ana Karen","Estrada Gómez Alan Alberto","García Ledezma Jesús Alvaro","García Montemayor Veronica Janeth","Garza González Luis Enrique","González Babonoyaba Ricardo Antonio","González Delgado Ericka Idaly","Guerrero Gómez Jorge","Gutiérrez Alvarado Nayra Didi","Gutiérrez Villarreal Denisse","Guzmán Morales Flor Idalia","Guzmán Neave Kenia Yadira","Hernández Pérez Rubén Alberto","Hernández Prieto Josué","Hernández Ríos Jesús Ramón","Leal Martínez Roque Manuel","López Ávila Sandra Lucero","Lopez Chavez Guillermo","López Delgado Luis Humberto","Luna Espinoza Jaime Roel","Medina Contreras Giovanni Israel","Mendoza Becerra Sergio","Minjarez Ochoa Alberto Alan","Montellano Pasillas Miguel Ángel","Morales Cruz Gabriel Gael","Morales Mendoza Tomás","Moreno Molina Reyes","Moriel Sáenz Ricardo Salvador","Muñoz Avila Roberto","Muñoz Blanco Lizeth Cristina","Nuñez Alatorre Ulises","Orozco Miranda Ana Cristina","Parra Blanco Zaira Sibel","Pérez Espíndola Rita Isabel","Perez Garcia Martha Aracely","Pinedo Paloma","Portillo Portillo José Luis","Preciado Grijalva Glen Iván","Reyes González Pedro","Ríos Salcido Joon Omaira","Ruiz Olmedo Norma Idaly","Salcedo Gardea Filiberto Isai","Salmon Rivas Fabricio Abundio","Saucedo Martínez Irving Abraham","Sauzameda Ochoa Fátima Anahí","Sepúlveda Mendoza Iván Roberto","Soto González Benito","Terrazas Serrano Fernando","Uribe Maese Jorge Alberto","Valencia Barraza Jesus Bersain","Valencia Meza Luis Miguel","Valenzuela López José Luis","Nicolas","Luis Lopez","Cano Corral Adrian"];
let _flColabCache = null;
async function cargarColaboradores(){
  if(_flColabCache) return _flColabCache;
  try{
    const snap=await fs.getDocs(fs.query(fs.collection(db,'fl_colaboradores'),fs.orderBy('nombre')));
    if(!snap.empty){_flColabCache=snap.docs.map(d=>d.data().nombre).filter(Boolean);return _flColabCache;}
  }catch{}
  _flColabCache=[...FL_COLABORADORES];
  return _flColabCache;
}
async function agregarColaborador(nombre){
  if(!nombre?.trim())return;
  await fs.addDoc(fs.collection(db,'fl_colaboradores'),{nombre:nombre.trim(),activo:true,creadoEn:new Date().toISOString()});
  _flColabCache=null;
}

const C={VEHS:'flotilla_vehiculos',SOLS:'flotilla_solicitudes',COMIS:'flotilla_comisiones',TRANS:'flotilla_transferencias',CHKSEM:'flotilla_checklist_semanal',CFG:'flotilla_config',TAREAS:'flotilla_tareas',USOS:'flotilla_usos',USUARIOS:'fl_usuarios',SINIESTROS:'flotilla_siniestros',UBICACIONES:'flotilla_ubicaciones',EVENTOS:'flotilla_eventos',LLANTAS:'flotilla_llantas'};

// ══════════════════════════════════════════════════════════════
// FUENTE ÚNICA DE VERDAD — "EN TALLER"
// Un vehículo está en taller SOLO si su campo status === 'taller'.
// El status se sincroniza automáticamente cuando una solicitud entra
// a Servicio y cuando se cierra (ver flSyncVehiculoServicio).
// Todos los conteos (sidebar, KPIs, Resumen) leen de aquí.
// ══════════════════════════════════════════════════════════════
const flEnTaller=v=>v&&v.status==='taller';
const flContarTaller=(arr)=>((arr||(typeof flV!=='undefined'?flV:[]))).filter(flEnTaller).length;

const CAT=[
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
  {eco:'96',unidad:'MORTOCONFORMADORA',año:0,plaza:'CHIHUAHUA',responsable:'—',placas:'DZ9854B',serie:'—',rend:'—',pv:'—',pol:'—',tipo:'camion',color:'—',nip:'',km:0,status:'activo'},
];

const CHK_CATS={
  Cristales:  ['Medallón delantero','Vidrio trasero','Lateral der. delantero','Lateral der. trasero','Lateral izq. delantero','Lateral izq. trasero'],
  Espejos:    ['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],
  Neumáticos: ['Llanta delantera der.','Llanta delantera izq.','Llanta trasera der.','Llanta trasera izq.','Llanta de refacción'],
  Interiores: ['Póliza / Manual','Radio / Carátula','Pantallas','Encendedor','Asientos y vestiduras','Tablero','Tapetes'],
  Motor:      ['Batería','Bobinas','Tapón agua limpiabrisas','Tapón radiador','Tapón dirección hidráulica','Limpiaparabrisas en buen estado'],
  Cajuela:    ['Herramienta','Cables de arranque','Extintor','Llave L','Llave de cruz'],
  Legal:      ['Tarjeta de circulación'],
};

const TIPOS_SOL=[
  'Mantenimiento preventivo','Mantenimiento correctivo','Siniestro / Accidente',
  'Batería','Motor','Llantas','Frenos','Suspensión','Dirección','Transmisión',
  'Aceite y lubricación','Sistema de enfriamiento','Alternador y sistema de carga',
  'Iluminación','Limpiaparabrisas','Aire acondicionado','Sistema de combustible',
  'Sensores y diagnóstico electrónico',
];
const VISTAS=['frente','atras','derecha','izquierda'];
const VISTA_NOM={frente:'Frente',atras:'Atrás',derecha:'Lateral Der.',izquierda:'Lateral Izq.'};

// ÍCONOS
const I={
  grid:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
  car:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.85 7h10.29l1.08 3.11H5.77L6.85 7zM19 17H5v-5h14v5z"/><circle cx="7.5" cy="14.5" r="1.5"/><circle cx="16.5" cy="14.5" r="1.5"/></svg>`,
  truck:`<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`,
  archive:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM6.24 5h11.52l.83 1H5.42l.82-1zM5 19V8h14v11H5zm8.45-9H10.55v3H8l4 4 4-4h-2.55z"/></svg>`,
  road:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/></svg>`,
  plus:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
  check:`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
  x:`<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  camera:`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.2c1.77 0 3.2-1.43 3.2-3.2S13.77 8.8 12 8.8 8.8 10.23 8.8 12s1.43 3.2 3.2 3.2zm0-4.4c.66 0 1.2.54 1.2 1.2s-.54 1.2-1.2 1.2-1.2-.54-1.2-1.2.54-1.2 1.2-1.2zM20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h4.05l.59-.65L9.88 4h4.24l1.18 1.35.64.65H20v12z"/></svg>`,
  upload:`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>`,
  search:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>`,
  alert:`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`,
  doc:`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>`,
  trash:`<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
  user:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  chevL:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>`,
  gear:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`,
  chevR:`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`,
  eye:`<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
  fleet:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8.2 15H3a1 1 0 01-1-1v-2.6a1 1 0 011-1h5.6l1.6-2.6h3.4" opacity=".55"/><circle cx="5" cy="15" r="1.5" opacity=".55"/><circle cx="11.5" cy="15" r="1.5" opacity=".55"/><path d="M15.8 18H10a1 1 0 01-1-1v-2.6a1 1 0 011-1h6.1l1.9-2.9h3.6a1 1 0 011 1V17a1 1 0 01-1 1h-1"/><circle cx="12.4" cy="18" r="1.6"/><circle cx="19.3" cy="18" r="1.6"/></svg>`,
  folder:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a1 1 0 011-1h4.4l1.6 2H20a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V7z"/></svg>`,
  calendar:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  mappin:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21c-4-4.5-6-8-6-11a6 6 0 0112 0c0 3-2 6.5-6 11z"/><circle cx="12" cy="10" r="2"/></svg>`,
  edit:`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>`,
};

// ESTADO
let db=window.db, fs=null;
let flV=[], flS=[], flCom=[], flTrans=[], flChkSem=[], flCfgSem={}, flUsos=[], flFlUsuarios=[], flSiniestros=[], flUbicaciones=[], flLlantas=[];
let vistaAct='panel';
let ST={
  vehId:null, tipoVeh:'auto', vistaImg:'frente',
  dmg:{frente:[],atras:[],derecha:[],izquierda:[]},
  chk:{}, chkFotos:{}, evFotos:[],
  tipo:'', prior:'Normal', desc:'', km:'', gasolina:50,
};

const hD=f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);
const hF=iso=>iso&&iso!=='—'?String(iso).substring(0,10):'—';

// Servicio preventivo por kilometraje. Retorna null si el vehículo no tiene
// intervalo configurado (aún no aplica). 'faltan' puede ser negativo (vencido).
// Resuelve un correo a un nombre real usando el directorio fl_usuarios —
// para técnicos que no tienen displayName configurado en su cuenta.
function flNombrePorCorreo(valor){
  if(!valor)return valor;
  if(!valor.includes('@'))return valor; // ya es un nombre, no un correo
  const u=flFlUsuarios.find(x=>(x.email||'').toLowerCase()===valor.toLowerCase());
  return u?.nombre||valor;
}

function flServicioEstado(v){
  const intervalo=Number(v.servicioIntervaloKm)||0;
  if(!intervalo)return null;
  const kmActual=Number(v.km)||0;
  const kmBase=v.kmUltimoServicio!=null?Number(v.kmUltimoServicio):Math.floor(kmActual/intervalo)*intervalo;
  const proximo=kmBase+intervalo;
  const faltan=proximo-kmActual;
  const estado=faltan<=0?'vencido':faltan<=500?'proximo':'ok';
  return{intervalo,kmBase,proximo,faltan,estado};
}

// ══════════════════════════════════════════════════════════════
// CONTROL DE LLANTAS — por unidad individual (marca, DOT, posición, vida útil)
// ══════════════════════════════════════════════════════════════
const LL_POSICIONES=['Delantera izquierda','Delantera derecha','Trasera izquierda','Trasera derecha','Refacción','Otra'];
function flLlantaAlertas(ll,kmActual){
  const alts=[];
  if(ll.fechaFabricacionDOT){
    const anios=(Date.now()-new Date(ll.fechaFabricacionDOT))/(365.25*864e5);
    if(anios>=6)alts.push({t:`Caducidad: ${anios.toFixed(1)} años desde fabricación (DOT)`,tono:'bad'});
    else if(anios>=5)alts.push({t:`Antigüedad: ${anios.toFixed(1)} años (cerca de caducar)`,tono:'warn'});
  }
  if(ll.kmInstalacion!=null&&ll.vidaUtilKm&&kmActual!=null){
    const recorridos=kmActual-Number(ll.kmInstalacion);
    if(recorridos>=Number(ll.vidaUtilKm))alts.push({t:`Excede vida útil: ${recorridos} km recorridos`,tono:'bad'});
    else if(recorridos>=Number(ll.vidaUtilKm)*0.85)alts.push({t:`Cerca del límite: ${recorridos}/${ll.vidaUtilKm} km`,tono:'warn'});
  }
  if(ll.estado==='cambiar')alts.push({t:'Marcada para cambio',tono:'bad'});
  else if(ll.estado==='revisar')alts.push({t:'Marcada para revisión',tono:'warn'});
  return alts;
}

function flRenderLlantasCard(vehId){
  const wrap=document.getElementById('fl-llantas-wrap');
  const id=vehId||wrap?.dataset?.vehId;
  if(!wrap||!id)return;
  const v=flV.find(x=>x.id===id);if(!v)return;
  wrap.dataset.vehId=id;
  const llantas=flLlantas.filter(l=>l.vehiculoId===id);
  wrap.innerHTML=`
    <div style="display:flex;flex-direction:column;gap:8px">
      ${llantas.length?llantas.map(ll=>{
        const alts=flLlantaAlertas(ll,v.km);
        const peor=alts.some(a=>a.tono==='bad')?'bad':alts.length?'warn':'ok';
        const tonos={bad:{bg:'#FEF2F2',fg:'#B91C1C'},warn:{bg:'#FFFBEB',fg:'#B45309'},ok:{bg:'#F8FAFD',fg:'#374151'}};
        const t=tonos[peor];
        return`<div style="background:${t.bg};border-radius:10px;padding:10px 12px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
            <strong style="font-size:12px;color:${t.fg}">${ll.posicion||'—'}</strong>
            <div style="display:flex;gap:5px">
              <button onclick="flAbrirLlanta('${id}','${ll.id}')" style="background:none;border:none;cursor:pointer;color:#64748B;padding:2px">${I.edit}</button>
              <button onclick="flEliminarLlanta('${ll.id}')" style="background:none;border:none;cursor:pointer;color:#B91C1C;padding:2px">${I.trash||'✕'}</button>
            </div>
          </div>
          <div style="font-size:11px;color:#64748B">${ll.marca||'—'} ${ll.modelo||''} · ${ll.medida||'—'}</div>
          ${alts.length?alts.map(a=>`<div style="font-size:10.5px;font-weight:700;color:${tonos[a.tono].fg};margin-top:4px">${I.alert} ${a.t}</div>`).join(''):`<div style="font-size:10.5px;color:#15803D;margin-top:4px">${I.check} Sin alertas</div>`}
        </div>`;
      }).join(''):`<div style="font-size:12px;color:#94A3B8;text-align:center;padding:10px 0">Sin llantas registradas</div>`}
      <button onclick="flAbrirLlanta('${id}')" style="width:100%;padding:9px;border:1.5px dashed #CBD5E1;border-radius:9px;background:none;color:#64748B;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">${I.check} Agregar llanta</button>
    </div>`;
}

window.flAbrirLlanta=function(vehId,llantaId){
  const ll=llantaId?flLlantas.find(x=>x.id===llantaId):null;
  const v=flV.find(x=>x.id===vehId);
  const ov=document.createElement('div');ov.className='fl-ov';ov.id='fl-ll-ov';
  ov.innerHTML=`<div class="fl-modal" style="max-width:480px">
    <div class="fl-mh"><h3>${ll?'Editar':'Agregar'} llanta</h3><button class="fl-mx" onclick="document.getElementById('fl-ll-ov').remove()">✕</button></div>
    <div style="padding:16px 20px;display:flex;flex-direction:column;gap:10px">
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Posición</label>
        <select id="ll-posicion" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px">
          ${LL_POSICIONES.map(p=>`<option ${ll?.posicion===p?'selected':''}>${p}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Marca</label><input id="ll-marca" value="${ll?.marca||''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
        <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Modelo</label><input id="ll-modelo" value="${ll?.modelo||''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
      </div>
      <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Medida (ej: 265/65 R17)</label><input id="ll-medida" value="${ll?.medida||''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha instalación</label><input type="date" id="ll-fechaInstalacion" value="${ll?.fechaInstalacion||''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
        <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fabricación (DOT)</label><input type="date" id="ll-fechaFabricacionDOT" value="${ll?.fechaFabricacionDOT||''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">KM al instalar</label><input type="number" id="ll-kmInstalacion" value="${ll?.kmInstalacion??''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
        <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Vida útil (km)</label><input type="number" id="ll-vidaUtilKm" value="${ll?.vidaUtilKm??''}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;box-sizing:border-box"></div>
      </div>
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Estado</label>
        <select id="ll-estado" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px">
          <option value="bien" ${ll?.estado==='bien'?'selected':''}>Bien</option>
          <option value="revisar" ${ll?.estado==='revisar'?'selected':''}>Revisar</option>
          <option value="cambiar" ${ll?.estado==='cambiar'?'selected':''}>Cambiar</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
        <button class="fb gho sm" onclick="document.getElementById('fl-ll-ov').remove()">Cancelar</button>
        <button class="fb acc" id="ll-btn-guardar" onclick="flGuardarLlanta('${vehId}','${v?.eco||''}','${llantaId||''}')">Guardar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)ov.remove();};
};

window.flGuardarLlanta=async function(vehId,eco,llantaId){
  const get=f=>document.getElementById('ll-'+f)?.value||'';
  const data={
    vehiculoId:vehId,eco,
    posicion:get('posicion'),marca:get('marca'),modelo:get('modelo'),medida:get('medida'),
    fechaInstalacion:get('fechaInstalacion')||null,fechaFabricacionDOT:get('fechaFabricacionDOT')||null,
    kmInstalacion:get('kmInstalacion')?Number(get('kmInstalacion')):null,
    vidaUtilKm:get('vidaUtilKm')?Number(get('vidaUtilKm')):null,
    estado:get('estado'),
  };
  const btn=document.getElementById('ll-btn-guardar');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    if(llantaId)await fs.updateDoc(fs.doc(db,C.LLANTAS,llantaId),data);
    else await fs.addDoc(fs.collection(db,C.LLANTAS),{...data,creadoEn:new Date().toISOString()});
    document.getElementById('fl-ll-ov')?.remove();
  }catch(e){alert('Error al guardar: '+e.message);if(btn){btn.disabled=false;btn.textContent='Guardar';}}
};

window.flEliminarLlanta=async function(llantaId){
  if(!confirm('¿Eliminar este registro de llanta?'))return;
  try{await fs.deleteDoc(fs.doc(db,C.LLANTAS,llantaId));}catch(e){alert('Error: '+e.message);}
};

// Devuelve las solicitudes que pertenecen al vehículo FÍSICO actual (v).
// Los números de ECO a veces se reasignan a una unidad distinta cuando la
// anterior se da de baja/reemplaza — si solo filtráramos por vehiculoEco,
// el historial de la unidad vieja se mezclaría con el de la nueva. Por eso
// se usa vehiculoId (el documento real) como llave principal, y vehiculoEco
// solo como respaldo para registros antiguos que se guardaron sin ese campo.
// Predicado central: ¿esta solicitud pertenece al vehículo FÍSICO v?
// Ver nota en flSolsDeVehiculo — se usa vehiculoId como llave principal
// para no mezclar historial cuando un ECO se reasigna a otra unidad.
function flEsDelVehiculo(s,v){
  if(!v)return false;
  return s.vehiculoId?s.vehiculoId===v.id:s.vehiculoEco===v.eco;
}
function flSolsDeVehiculo(v){
  if(!v)return[];
  return flS.filter(s=>flEsDelVehiculo(s,v));
}
const FLOTILLA_ADMINS=['fatima@tecnocontrol.com.mx','c.acosta@tecnocontrol.com.mx','rh@tecnocontrol.com.mx','glen@tecnocontrol.com.mx','gerencia@tecnocontrol.com.mx','nicolas@tecnocontrol.com.mx'];
const hAdm=()=>{
  const rol=window.flGetRolActual?window.flGetRolActual():'';
  const email=(window.auth?.currentUser?.email||'').toLowerCase();
  return ['Administrador','Contraloría','Flotilla'].includes(rol)||FLOTILLA_ADMINS.includes(email);
};
const hP=a=>window.flTienePermiso?window.flTienePermiso(a):hAdm();
const SVG_CAM=`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;
const SVG_CMT=`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3"/><rect x="9" y="11" width="14" height="10" rx="1"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/></svg>`;
const SVG_AUTO=`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h11a2 2 0 012 2v6h-2"/><path d="M7 9l2-4h6l2 4"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`;
const SVG_MAQ=`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M4 20v-5h5l3-4h4l2 3v6"/><path d="M9 11V7h4l2 4"/><circle cx="7" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/></svg>`;
const hEmo=t=>t==='maquinaria'?SVG_MAQ:t==='camion'?SVG_CAM:t==='camioneta'?SVG_CMT:SVG_AUTO;

// Inicializar cache de evidencias
if(!window._flEvCache)window._flEvCache=[];
window.flVerEvIdx=function(idx){const ev=(window._flEvCache||[])[idx];if(ev)window.flVerEvidencia(ev);};

window.flLightbox=function(src){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:20px';
  const img=document.createElement('img');
  img.src=src;
  img.style.cssText='max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5)';
  ov.appendChild(img);
  ov.onclick=()=>ov.remove();
  document.body.appendChild(ov);
};

window.flLightboxCompar=function(key,sA,sB){
  const fotoA=sA&&sA.chkFotos?sA.chkFotos[key]:null;
  const fotoB=sB&&sB.chkFotos?sB.chkFotos[key]:null;
  if(!fotoA&&!fotoB){return;}
  // Si solo hay una, usar lightbox simple
  if(!fotoB){window.flLightbox(fotoA);return;}
  if(!fotoA){window.flLightbox(fotoB);return;}
  // Ambas — mostrar lado a lado
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;gap:12px';
  const imgs=document.createElement('div');
  imgs.style.cssText='display:flex;gap:12px;align-items:flex-start;max-width:95vw;max-height:85vh;overflow:hidden';
  const mkCol=(src,label,color)=>{
    const col=document.createElement('div');
    col.style.cssText='display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0';
    const lbl=document.createElement('div');
    lbl.style.cssText='background:'+color+';color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:99px;white-space:nowrap';
    lbl.textContent=label;
    const img=document.createElement('img');
    img.src=src;
    img.style.cssText='max-width:100%;max-height:75vh;object-fit:contain;border-radius:8px;cursor:zoom-in';
    img.onclick=(e)=>{e.stopPropagation();window.flLightbox(src);};
    col.appendChild(lbl);col.appendChild(img);
    return col;
  };
  imgs.appendChild(mkCol(fotoA,'Semana actual','#1E3A5F'));
  imgs.appendChild(mkCol(fotoB,'Semana anterior','#64748B'));
  const hint=document.createElement('div');
  hint.style.cssText='color:rgba(255,255,255,.4);font-size:11px;text-align:center';
  hint.textContent='Clic en una foto para ampliarla · Clic fuera para cerrar';
  ov.appendChild(imgs);ov.appendChild(hint);
  ov.onclick=(e)=>{if(e.target===ov)ov.remove();};
  document.body.appendChild(ov);
};

function hBadge(e){
  const m={
    Solicitud:['#EDE9FE','#6D28D9'],
    'Evaluación':['#DBEAFE','#1D4ED8'],Evaluación:['#DBEAFE','#1D4ED8'],
    Servicio:['#FEF3C7','#B45309'],
    Rechazada:['#FEE2E2','#B91C1C'],
    Cerrada:['#DCFCE7','#15803D'],
    // legacy estados anteriores → mismos colores
    Validada:['#DBEAFE','#1D4ED8'],'Validación':['#DBEAFE','#1D4ED8'],
    Cotización:['#DBEAFE','#1D4ED8'],
    'Aprobación':['#FEF3C7','#B45309'],Aprobada:['#FEF3C7','#B45309'],
    Pagos:['#FEF3C7','#B45309'],Cierre:['#FEF3C7','#B45309'],
    'En préstamo':['#EDE9FE','#6D28D9'],Devuelto:['#DCFCE7','#15803D']
  };
  const[bg,cl]=m[e]||['#F1F5F9','#475569'];
  return`<span style="display:inline-flex;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:100px;background:${bg};color:${cl}">${e||'—'}</span>`;
}

function getImgSrc(tipo,vista){
  // tipo puede ser: 'auto','camioneta','camion','troca'
  const esGrande = tipo==='troca'||tipo==='camion'||tipo==='camioneta';
  if(esGrande){
    const key='troca_'+vista;
    return SVG_TROCA[key]?`<div style="pointer-events:none">${SVG_TROCA[key]}</div>`:'';
  }
  const key='auto_'+vista;
  return IMG_VEH[key]
    ? `<img src="${IMG_VEH[key]}" style="width:100%;height:100%;object-fit:contain;display:block;background:#E8F0FA">`
    : (SVG_TROCA['troca_'+vista]?`<div style="pointer-events:none">${SVG_TROCA['troca_'+vista]}</div>`:'');
}

function getTipoVehActivo(){
  if(!ST.vehId) return ST.tipoVeh;
  const v=flV.find(x=>x.id===ST.vehId);
  if(!v) return ST.tipoVeh;
  if(v.tipo==='maquinaria') return 'maquinaria';
  return v.tipo==='camioneta'||v.tipo==='camion'?'troca':'auto';
}
// ── MAQUINARIA: 4 fotos obligatorias en lugar del checklist ──
const MAQ_FOTOS=['Vista general','Placa / N° de serie','Horómetro o tablero','Estado / detalle'];
const flEsMaqActiva=()=>{const v=flV.find(x=>x.id===ST.vehId);return !!v&&v.tipo==='maquinaria';};

// CSS
function injectCSS(){
  if(document.getElementById('fl-v12'))return;
  const s=document.createElement('style');s.id='fl-v12';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
#flotilla-dashboard{display:none;margin-left:240px;min-height:100vh;background:#EEF2F7;font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#0A0F1E;}
#flotilla-dashboard *{box-sizing:border-box;margin:0;padding:0;}

/* ── TOPBAR ── */
.fl-shell{display:flex;height:100vh;}
.fl-tb{background:#0A1628;width:64px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;position:sticky;top:0;height:100vh;z-index:200;box-shadow:2px 0 12px rgba(0,0,0,.4);overflow-y:auto;overflow-x:hidden;}
.fl-tb-logo{display:flex;align-items:center;justify-content:center;margin-bottom:2px;}
.fl-tb-logo img{height:30px;}
.fl-tb-sep{width:30px;height:1px;background:rgba(255,255,255,.12);margin:4px 0;flex-shrink:0;}
.fl-tab-btn{width:40px;height:40px;border-radius:10px;border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:rgba(255,255,255,.5);background:rgba(255,255,255,.06);flex-shrink:0;}
.fl-tb-siniestro{background:#DC2626!important;color:#fff!important;animation:flSinPulse 3s ease-in-out infinite;}
.fl-tb-siniestro:hover{animation-play-state:paused}
.fl-tb-siniestro:hover{background:#B91C1C!important;}
.fl-tb-siniestro.fl-sin-activo{animation:flSinPulseActivo .9s ease-in-out infinite;}
@keyframes flSinPulse{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.45);}50%{box-shadow:0 0 0 6px rgba(220,38,38,0);}}
@keyframes flSinPulseActivo{0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,.65);transform:scale(1);}50%{box-shadow:0 0 0 9px rgba(220,38,38,0);transform:scale(1.06);}}
.fl-tab-btn:hover{background:rgba(255,255,255,.12);color:rgba(255,255,255,.9);}
.fl-tab-btn.on{background:#2563EB;color:#fff;box-shadow:0 4px 14px rgba(37,99,235,.5);}
.fl-tab-cnt{position:absolute;top:-4px;right:-4px;background:#EF4444;color:#fff;font-size:8px;font-weight:800;padding:1px 4px;border-radius:100px;line-height:1.2;}
.fl-tb-profile{margin-left:0;margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:2px;color:#fff;padding-top:8px;flex-shrink:0;}
.fl-tb-pname{display:none;}
.fl-tb-avatar{width:34px;height:34px;border-radius:50%;background:#2563EB;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0;}

/* ── LAYOUT PRINCIPAL ── */
.fl-wrap{display:flex;min-height:100vh;flex:1;min-width:0;}

/* ── SIDEBAR IZQUIERDO VEHÍCULOS ── */
.fl-sb{width:210px;flex-shrink:0;background:#fff;border-right:1px solid #E8EDF5;display:flex;flex-direction:column;height:100vh;position:sticky;top:0;}
.fl-sb-top{padding:10px;border-bottom:1px solid #E8EDF5;}
.fl-sb-search{position:relative;}
.fl-sb-search input{width:100%;padding:7px 10px 7px 28px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:12px;outline:none;background:#F8FAFD;}
.fl-sb-search input:focus{border-color:#2563EB;}
.fl-sb-search svg{position:absolute;left:8px;top:50%;transform:translateY(-50%);color:#94A3B8;pointer-events:none;}
.fl-sb-tipos{display:flex;gap:4px;margin-top:8px;}
.fl-sb-tipo{flex:1;padding:4px 0;border:1.5px solid #E2E8F0;border-radius:6px;background:#fff;font-family:inherit;font-size:9.5px;font-weight:700;cursor:pointer;text-align:center;color:#64748B;transition:all .12s;}
.fl-sb-tipo.on{border-color:#2563EB;background:#EFF6FF;color:#2563EB;}
.fl-sb-list{flex:1;overflow-y:auto;padding:4px;}
.fl-sb-item{display:flex;align-items:center;gap:8px;padding:10px 11px;border-radius:8px;cursor:pointer;transition:all .1s;border-left:3px solid transparent;margin-bottom:4px;}
.fl-sb-item:hover{background:#F1F5F9;}
.fl-sb-item.on{background:#EFF6FF;border-left-color:#2563EB;font-weight:700;}
.fl-sb-eco{font-size:11px;font-weight:800;font-family:'JetBrains Mono',monospace;color:#374151;min-width:22px;}
.fl-sb-name{font-size:11.5px;font-weight:600;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}
.fl-sb-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.fl-sb-item.fl-sb-bloq{border:1px solid #FECACA;border-left:3px solid #EF4444;background:#FEF2F2;}
.fl-sb-item.fl-sb-bloq:hover{background:#FEE2E2;}
.fl-sb-bloq-info{display:flex;align-items:center;gap:3px;font-size:9px;font-weight:700;color:#DC2626;flex-shrink:0;max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fl-sb-footer{padding:8px 10px;border-top:1px solid #E8EDF5;display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.fl-sb-stat dt{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;}
.fl-sb-stat dd{font-size:18px;font-weight:900;font-family:'JetBrains Mono',monospace;line-height:1.1;}

/* ── CONTENIDO CENTRAL ── */
.fl-content{flex:1;min-width:0;}

/* ── DETALLES VEHÍCULO HEADER ── */
.fl-det-bar{background:#fff;border-bottom:1px solid #E8EDF5;padding:10px 16px;}
.fl-det-bar-t{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#94A3B8;margin-bottom:8px;}
.fl-det-fields{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.fl-det-field{display:flex;flex-direction:column;gap:3px;}
.fl-det-field label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;}
.fl-det-field input{padding:7px 12px;border:none;background:#1E3A5F;border-radius:7px;font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;color:#fff;outline:none;min-width:80px;letter-spacing:.3px;}
.fl-det-field input::placeholder{color:rgba(255,255,255,.4);}

/* ── TOOLBAR SOLICITUD ── */
.fl-sol-bar{background:#fff;border-bottom:2px solid #E8EDF5;padding:10px 20px;display:flex;align-items:center;gap:12px;}
.fl-tipo-pill{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;border-radius:10px;border:2px solid #E2E8F0;background:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:800;color:#374151;transition:all .15s;letter-spacing:.3px;}
.fl-tipo-pill:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-tipo-pill.on{background:#2563EB;border-color:#2563EB;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.3);}
.fl-sol-bar-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;border-radius:9px;border:none;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:all .15s;letter-spacing:.3px;}
.fl-sol-bar-btn.blue{background:#2563EB;color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.25);}
.fl-sol-bar-btn.blue:hover{background:#1D4ED8;}
.fl-sol-bar-btn.green{background:#16A34A;color:#fff;box-shadow:0 4px 12px rgba(22,163,74,.25);}
.fl-sol-bar-btn.green:hover{background:#15803D;}
.fl-sol-tipo-sel{padding:7px 12px;border:1.5px solid #CBD5E1;border-radius:8px;font-family:inherit;font-size:12.5px;background:#fff;outline:none;cursor:pointer;font-weight:600;color:#0A0F1E;}
.fl-sol-tipo-sel:focus{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.1);}

/* ── GRID 2x2 FOTOS ── */
.fl-grid{display:grid;grid-template-columns:1fr 1fr;gap:3px;background:#1E3A5F;}
.fl-grid-cell{position:relative;background:#E8F0FA;overflow:hidden;cursor:crosshair;}
.fl-grid-cell img{width:100%;height:100%;object-fit:cover;display:block;background:#E8F0FA;}
.fl-grid-cell-svg{width:100%;height:100%;display:block;}
.fl-grid-overlay{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;}
.fl-grid-lbl{position:absolute;top:8px;left:8px;padding:4px 10px;background:rgba(10,22,40,.75);border-radius:5px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#fff;backdrop-filter:blur(4px);}
.fl-dmg-pt{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;}
.fl-dmg-pt-circle{width:22px;height:22px;border-radius:50%;background:#EF4444;border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;box-shadow:0 2px 8px rgba(239,68,68,.5);}

/* ── PANEL CHECKLIST + GAUGE ── */
.fl-ck-panel{background:#fff;border-left:1px solid #E8EDF5;}
.fl-gauge-wrap{padding:14px 12px 10px;border-bottom:1.5px solid #E8EDF5;background:linear-gradient(180deg,#f8fafc,#fff);}
.fl-gauge-t{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:10px;text-align:center;}
.fl-gauge-svg{display:block;margin:0 auto;}
.fl-gauge-labels{display:flex;justify-content:space-between;font-size:9px;font-weight:700;color:#64748B;margin-top:6px;padding:0 2px;}
.fl-ck-head{background:#1E3A5F;color:rgba(255,255,255,.85);padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;}
.fl-ck-body{overflow-y:auto;}
.fl-ck-grp{background:#F1F5F9;padding:4px 10px;font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;}
.fl-ck-row{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid #F8FAFD;}
.fl-ck-row:hover{background:#F8FAFD;}
.fl-ck-name{font-size:11px;flex:1;color:#374151;font-weight:500;}
.fl-ck-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:24px;border-radius:5px;border:1.5px solid #E2E8F0;font-size:10px;font-weight:800;cursor:pointer;background:#fff;color:#64748B;font-family:inherit;transition:all .12s;}
.fl-ck-btn:hover{border-color:#2563EB;color:#2563EB;}
.fl-ck-btn.si{background:#DCFCE7;border-color:#86EFAC;color:#15803D;}
.fl-ck-btn.no{background:#FEE2E2;border-color:#FCA5A5;color:#B91C1C;}
.fl-ck-foto-btn{width:26px;height:24px;border:1.5px solid #E2E8F0;border-radius:5px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#F8FAFD;color:#94A3B8;transition:all .12s;flex-shrink:0;}
.fl-ck-foto-btn:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-ck-foto-btn.has{border-color:#22C55E;color:#15803D;background:#DCFCE7;}

/* ── DAÑOS LIST ── */
.fl-dmg-list{background:#fff;border-top:2px solid #E8EDF5;padding:14px 20px;margin-top:2px;}
.fl-dmg-list-t{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px;}
.fl-dmg-item{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F8FAFD;font-size:11.5px;}
.fl-dmg-item:last-child{border-bottom:none;}
.fl-dmg-num{width:20px;height:20px;border-radius:50%;background:#EF4444;color:#fff;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

/* ── PANEL DERECHO INFO VEHÍCULO ── */
.fl-rp{width:300px;flex-shrink:0;background:#fff;border-left:1.5px solid #E8EDF5;height:100vh;position:sticky;top:0;overflow-y:auto;}
.fl-rp-img{position:relative;overflow:hidden;background:#EEF2F7;}
.fl-rp-img img{width:100%;height:160px;object-fit:contain;display:block;background:#E8EEFA;}
.fl-rp-img-empty{height:130px;background:linear-gradient(135deg,#EEF2F7,#E2E8F0);display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:11px;flex-direction:column;gap:6px;}
.fl-rp-upload{position:absolute;bottom:6px;right:6px;}
.fl-rp-upload label{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;background:rgba(10,22,40,.7);color:#fff;border-radius:6px;font-size:9.5px;font-weight:700;cursor:pointer;backdrop-filter:blur(4px);}
.fl-rp-head{padding:10px 12px 2px;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;}
.fl-rp-num{font-size:24px;font-weight:900;font-family:'JetBrains Mono',monospace;padding:0 12px 8px;line-height:1;border-bottom:1px solid #F1F5F9;}
.fl-rp-row{padding:8px 14px;border-bottom:1px solid #F1F5F9;}
.fl-rp-row dt{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:3px;}
.fl-rp-row dd{font-size:13.5px;font-weight:700;color:#0A0F1E;line-height:1.2;word-break:break-word;overflow-wrap:break-word;}
.fl-rp-row dd.big{font-size:13px;font-weight:800;letter-spacing:-.1px;word-break:break-word;overflow-wrap:break-word;}
.fl-rp-row dd.mono{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.2px;word-break:break-all;overflow-wrap:break-word;}
.fl-rp-row dd.green{color:#15803D;font-weight:800;}
.fl-rp-row dd.red{color:#B91C1C;font-weight:800;}
.fl-rp-docs{padding:10px 12px;border-bottom:1px solid #F1F5F9;}
.fl-rp-docs-t{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px;}
.fl-rp-doc-btn{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1.5px solid #E2E8F0;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;color:#374151;background:#F8FAFD;width:100%;margin-bottom:5px;font-family:inherit;transition:all .12s;}
.fl-rp-doc-btn:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-rp-alts{padding:10px 12px;}
.fl-rp-alt{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:7px;font-size:11px;font-weight:600;margin-bottom:4px;}
.fl-rp-alt.w{background:#FFFBEB;color:#92400E;border:1px solid #FDE68A;}
.fl-rp-alt.e{background:#FEF2F2;color:#991B1B;border:1px solid #FECACA;}
.fl-rp-hist{padding:8px 12px;}
.fl-rp-hist-t{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px;}
.fl-rp-h-item{padding:6px 0;border-bottom:1px solid #F8FAFD;font-size:11px;}
.fl-rp-h-item:hover{background:#FAFBFD;}

/* ── PANEL GENERAL ── */
.fl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}
.fl-kpi{background:#fff;border-radius:12px;padding:14px 16px;border:1px solid #E8EDF5;}
.fl-kpi-l{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:6px;}
.fl-kpi-v{font-size:28px;font-weight:900;letter-spacing:-1.5px;font-family:'JetBrains Mono',monospace;line-height:1;}
.fl-kpi-s{font-size:10px;color:#94A3B8;margin-top:3px;}

/* ── TABLA ── */
.fl-tw{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;}
.fl-t{width:100%;border-collapse:collapse;font-size:12px;}
.fl-t th{background:#F8FAFD;padding:8px 12px;text-align:left;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;border-bottom:1px solid #E8EDF5;}
.fl-t td{padding:10px 12px;border-bottom:1px solid #F1F5F9;vertical-align:middle;}
.fl-t tr:last-child td{border-bottom:none;}
.fl-t tr:hover td{background:#F8FAFD;cursor:pointer;}
.fl-mono{font-family:'JetBrains Mono',monospace;font-size:10.5px;}

/* ── MODAL ── */
.fl-ov{position:fixed;inset:0;background:rgba(10,15,30,.75);z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px);animation:flFi .15s;}
@keyframes flFi{from{opacity:0}to{opacity:1}}
.fl-modal{background:#fff;border-radius:16px;width:100%;max-width:580px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:flSl .2s cubic-bezier(.4,0,.2,1);}
@keyframes flSl{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.fl-mh{padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9;position:sticky;top:0;background:#fff;z-index:2;}
.fl-mh h3{font-size:15px;font-weight:800;letter-spacing:-.3px;}
.fl-mx{width:26px;height:26px;border:none;background:#F1F5F9;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.fl-mx:hover{background:#E2E8F0;}
.fl-mb{padding:14px 20px 20px;}
.fl-form{display:flex;flex-direction:column;gap:10px;}
.fl-fld{display:flex;flex-direction:column;gap:3px;}
.fl-fld label{font-size:9px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.5px;}
.fl-fld input,.fl-fld select,.fl-fld textarea{padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:13px;color:#0A0F1E;background:#F8FAFD;outline:none;transition:all .15s;width:100%;}
.fl-fld input:focus,.fl-fld select:focus,.fl-fld textarea:focus{border-color:#2563EB;background:#fff;}
.fl-fld textarea{min-height:68px;resize:vertical;}
.fl-fr{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.fl-fa{display:flex;justify-content:flex-end;gap:7px;padding-top:10px;border-top:1px solid #F1F5F9;margin-top:4px;}
.fl-sep{height:1px;background:#F1F5F9;margin:6px 0;}
.fl-info-b{background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:7px;padding:7px 10px;font-size:11.5px;font-weight:700;color:#1D4ED8;display:flex;align-items:center;gap:5px;}
.fb{display:inline-flex;align-items:center;gap:4px;border:none;border-radius:7px;padding:7px 14px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .15s;white-space:nowrap;}
.fb.acc{background:#2563EB;color:#fff;}
.fb.acc:hover{background:#1D4ED8;}
.fb.gho{background:#fff;color:#374151;border:1.5px solid #E2E8F0;}
.fb.gho:hover{background:#F8FAFD;}
.fb.dan{background:#FEF2F2;color:#B91C1C;border:1.5px solid #FECACA;}
.fb.sm{padding:4px 9px;font-size:10.5px;}
.fl-up{border:2px dashed #CBD5E1;border-radius:8px;padding:9px;text-align:center;cursor:pointer;color:#64748B;font-size:11.5px;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s;font-family:inherit;background:transparent;width:100%;}
.fl-up:hover{border-color:#2563EB;color:#2563EB;background:#EFF6FF;}
.fl-pills{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;}
.fl-pill{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:100px;font-size:10.5px;font-weight:600;cursor:pointer;color:#374151;}
.fl-pill:hover{background:#EFF6FF;color:#2563EB;}
.fl-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:180px;gap:6px;color:#64748B;text-align:center;padding:24px;}
.fl-empty-ico{font-size:36px;opacity:.2;margin-bottom:6px;}
.fl-empty h3{font-size:13px;font-weight:700;color:#0A0F1E;}
.fl-empty p{font-size:11.5px;max-width:220px;line-height:1.5;}
.fl-comcard{background:#fff;border:1px solid #E8EDF5;border-radius:12px;overflow:hidden;cursor:pointer;transition:all .15s;margin-bottom:10px;}
.fl-comcard:hover{border-color:#93C5FD;}
.fl-comcard-h{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #F1F5F9;}
.fl-comcard-b{padding:10px 16px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.fl-ev-sello{position:relative;border-radius:9px;overflow:hidden;cursor:pointer;}
.fl-ev-sello img{width:100%;height:80px;object-fit:cover;display:block;}
.fl-ev-sello-info{background:rgba(10,22,40,.8);padding:4px 7px;}
.fl-ev-sello-cod{font-size:9px;font-weight:700;color:#FCD34D;font-family:'JetBrains Mono',monospace;}
.fl-ev-sello-fecha{font-size:8.5px;color:rgba(255,255,255,.7);font-family:'JetBrains Mono',monospace;}
/* ── PANORAMA DE VEHÍCULOS ── */
.fl-panor-modal{background:#fff;border-radius:16px;width:100%;max-width:960px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:flSl .2s cubic-bezier(.4,0,.2,1);}
.fl-panor-body{overflow-y:auto;flex:1;padding:14px 18px;}
.fl-panor-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:0 18px 12px;border-bottom:1px solid #F1F5F9;}
.fl-panor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px;margin-top:12px;}
.fl-panor-card{position:relative;border:1.5px solid #E8EDF5;border-radius:14px;overflow:hidden;cursor:pointer;transition:all .15s;background:#fff;box-shadow:0 1px 3px rgba(10,22,40,.05);}
.fl-panor-card:hover{border-color:#93C5FD;box-shadow:0 6px 16px rgba(37,99,235,.1);transform:translateY(-1px);}
.fl-panor-card.sel{border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.14);}
.fl-panor-card .fl-panor-fig{position:relative;height:128px;background:linear-gradient(135deg,#EAF1FC,#DCE8F8);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.fl-panor-card .fl-panor-fig img{width:100%;height:100%;object-fit:cover;display:block;}
.fl-panor-card .fl-panor-chk{position:absolute;top:9px;right:9px;width:26px;height:26px;border-radius:50%;border:none;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(10,22,40,.25);display:flex;align-items:center;justify-content:center;color:#CBD5E1;transition:all .12s;}
.fl-panor-card.sel .fl-panor-chk{background:#2563EB;color:#fff;}
.fl-panor-card .fl-panor-badge{position:absolute;bottom:8px;left:8px;font-size:8.5px;font-weight:800;letter-spacing:.3px;padding:3px 8px;border-radius:100px;background:rgba(10,22,40,.72);color:#fff;text-transform:uppercase;}
.fl-panor-card .fl-panor-ico{display:flex;align-items:center;justify-content:center;color:#4A6FA5;}
.fl-panor-card.sel .fl-panor-ico{color:#1D4ED8;}
.fl-panor-card .fl-panor-info{padding:10px 12px 11px;}
.fl-panor-card .fl-panor-eco{font-size:12px;font-weight:900;color:#2563EB;font-family:'JetBrains Mono',monospace;letter-spacing:.2px;}
.fl-panor-card .fl-panor-un{font-size:12.5px;font-weight:800;color:#0A1628;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fl-panor-card .fl-panor-resp{font-size:10.5px;color:#64748B;margin-top:3px;display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fl-panor-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 18px;border-top:1px solid #F1F5F9;background:#F8FAFD;flex-wrap:wrap;}
.fl-panor-sum-card{border:1px solid #E2E8F0;border-radius:12px;margin-bottom:14px;overflow:hidden;}
.fl-panor-sum-h{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(180deg,#F8FAFF,#fff);border-bottom:1px solid #F1F5F9;}
.fl-panor-sum-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#F1F5F9;}
.fl-panor-sum-kpi{background:#fff;padding:9px 8px;text-align:center;}
.fl-panor-sum-kpi b{display:block;font-size:16px;font-weight:900;color:#0A1628;}
.fl-panor-sum-kpi span{font-size:8.5px;color:#94A3B8;font-weight:700;text-transform:uppercase;letter-spacing:.3px;}
.fl-panor-sum-sec{padding:10px 14px;}
.fl-panor-sum-sec-t{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#64748B;margin-bottom:6px;}
@media(max-width:640px){.fl-panor-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));}.fl-panor-sum-kpis{grid-template-columns:repeat(2,1fr);}}
@media(max-width:1200px){.fl-rp{display:none;}.fl-kpis{grid-template-columns:1fr 1fr;}}
@media(max-width:900px){#flotilla-dashboard{margin-left:0;}.fl-sb{display:none;}}
`;
  document.head.appendChild(s);
}

// HTML BASE
function buildHTML(){
  const el=document.getElementById('flotilla-dashboard');if(!el)return;
  // Placeholder seguro — se sobreescribe por actualizarHeaderUsuario() una vez que auth resuelva
  const nombre='···';
  const inicial='·';
  el.innerHTML=`
  <div class="fl-shell">
  <div class="fl-tb">
    <div class="fl-tb-logo" title="TECNOCONTROL">
      <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="12" stroke="#fff" stroke-width="2"/>
        <circle cx="14" cy="14" r="7" stroke="#2563EB" stroke-width="2"/>
        <circle cx="14" cy="14" r="3" fill="#2563EB"/>
      </svg>
    </div>
    <div class="fl-tb-sep"></div>
    <div style="position:relative">
      <button class="fl-tab-btn on" id="fl-tb-panel" onclick="flVista('panel')" title="Dashboards">${I.grid}</button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-sols" onclick="flVista('sols')" title="Solicitudes">${I.car}</button>
      <span id="fl-cnt-s" class="fl-tab-cnt" style="display:none">0</span>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-tareas" onclick="flVista('tareas')" title="Tareas">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      </button>
      <span id="fl-cnt-tar" class="fl-tab-cnt" style="display:none">0</span>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-comis" onclick="flVista('comis')" title="Utilitarios">${I.truck}</button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-compar" onclick="flVista('compar')" title="Comparativa semanal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-chksemanal" onclick="flVista('chksemanal')" title="Check list semanal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      </button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-resumen" onclick="flVista('resumen')" title="Resumen de movimientos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17h7M17 14v7"/></svg>
      </button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-panorama" onclick="flAbrirPanorama()" title="Panorama de vehículos — resumen por unidad">${I.fleet}</button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-extras" onclick="flToggleExtrasClick()" title="Mostrar/ocultar actividades del área">${I.folder}</button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-parrilla" onclick="window.abrirPanelParrilla('Flotilla')" title="Parrilla de documentos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
      </button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-calendario" onclick="flVista('calendario')" title="Calendario de actividades">${I.calendar}</button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-mapa" onclick="flVista('mapa')" title="Mapa en tiempo real">${I.mappin}</button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-presupuesto" onclick="flVista('presupuesto')" title="Presupuesto vs Gastos">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
      </button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn fl-tb-siniestro" id="fl-tb-siniestro" onclick="flVista('siniestros')" title="Siniestros — historial y reportar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </button>
    </div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-bajas" onclick="flVista('bajas')" title="Vehículos de baja">${I.archive}</button>
    </div>
    ${hAdm()?`
    <div class="fl-tb-sep"></div>
    <div style="position:relative">
      <button class="fl-tab-btn" id="fl-tb-admin" onclick="flVista('admin')" title="Administrar flotilla" style="background:rgba(234,179,8,.12);color:#FCD34D">
        ${I.gear}
      </button>
    </div>`:''}
    <div class="fl-tb-profile" id="fl-tb-profile" title="${nombre}">
      <span class="fl-tb-pname">${nombre}</span>
      <div class="fl-tb-avatar">${inicial}</div>
    </div>
  </div>
  <div class="fl-wrap">
    <div class="fl-sb" id="fl-sb">
      <div class="fl-sb-top">
        <div class="fl-sb-search">${I.search}<input type="text" placeholder="Unidad, placas…" id="fl-sb-q" oninput="flSbFilt()"></div>
        <div class="fl-sb-tipos">
          <button class="fl-sb-tipo on" id="fl-sbt-all"    onclick="flSbTipo('all')">Todo</button>
          <button class="fl-sb-tipo"    id="fl-sbt-auto"   onclick="flSbTipo('auto')">Auto</button>
          <button class="fl-sb-tipo"    id="fl-sbt-cam"    onclick="flSbTipo('cam')">Troca</button>
          <button class="fl-sb-tipo"    id="fl-sbt-maq"    onclick="flSbTipo('maq')">Maquinaria</button>
          <button class="fl-sb-tipo"    id="fl-sbt-taller" onclick="flSbTipo('taller')" style="border-color:#F59E0B;color:#B45309">Taller</button>
        </div>
      </div>
      <div class="fl-sb-list" id="fl-sb-list"></div>
      <div class="fl-sb-footer" id="fl-sb-footer"></div>
    </div>
    <div class="fl-content" id="fl-content">
      <div class="fl-empty" style="min-height:60vh"><div class="fl-empty-ico">${SVG_AUTO}</div><h3>Cargando flotilla…</h3></div>
    </div>
    <div class="fl-rp" id="fl-rp">${rpVacio()}</div>
  </div>
  </div>`;
}

function rpVacio(){return`<div class="fl-empty" style="min-height:300px"><div class="fl-empty-ico">${SVG_AUTO}</div><p style="font-size:11px">Selecciona un vehículo<br>para ver su información</p></div>`;}

// INIT
// ── Registro de actividad y errores (diagnóstico) ──
// Nunca debe romper el portal: si falla el propio guardado, se ignora en silencio.
// Solo registra si hay una vista de Flotilla activa (vistaAct), para no
// atribuirle a Flotilla errores de otros módulos del portal.
function flRegistrarEvento(tipo,extra){
  try{
    const user=window.auth?.currentUser;
    fs.addDoc(fs.collection(db,C.EVENTOS),{
      tipo,
      email:user?.email||'',
      nombre:user?.displayName||user?.email||'',
      vista:'desktop:'+(typeof vistaAct!=='undefined'?vistaAct:''),
      dispositivo:navigator.userAgent||'',
      online:navigator.onLine,
      creadoEn:new Date().toISOString(),
      ...extra,
    }).catch(()=>{});
  }catch(e){}
}

window.cargarFlotilla=async function(){
  // Reset de estado al (re)entrar al módulo — sin esto, el listener de
  // Firestore en tiempo real (línea ~3174) vuelve a pintar el panel derecho
  // con el vehículo que quedó seleccionado de una visita anterior, aunque
  // buildHTML() ya haya reconstruido el panel vacío.
  ST={vehId:null,tipoVeh:'auto',vistaImg:'frente',dmg:{frente:[],atras:[],derecha:[],izquierda:[]},chk:{},chkFotos:{},evFotos:[],tipo:'',prior:'Normal',desc:'',km:'',gasolina:50};
  document.getElementById('fl-panor-ov')?.remove();
  document.querySelectorAll('.fl-ov').forEach(ov=>ov.remove());
  injectCSS();buildHTML();
  if(typeof window.flActualizarBotonExtras==='function')window.flActualizarBotonExtras();
  { const _btnSin=document.getElementById('fl-tb-siniestro'); if(_btnSin)_btnSin.classList.toggle('fl-sin-activo',(flSiniestros||[]).some(x=>x.estatus==='activo')); }
  // Esperar hasta 5s a que window.db esté disponible
  for(let i=0;i<50&&!window.db;i++) await new Promise(r=>setTimeout(r,100));
  db=window.db;
  if(!db){console.error('[FLOTILLA] window.db no disponible después de 5s');return;}
  // Actualizar header con el usuario real tan pronto como esté disponible
  actualizarHeaderUsuario();
  fs=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  if(!window._flErrHandlersInstalados){
    window._flErrHandlersInstalados=true;
    window.addEventListener('error',(e)=>{
      if(!vistaAct)return; // solo si estamos dentro de una vista de Flotilla
      flRegistrarEvento('error',{mensaje:String(e.message||'').slice(0,300),stack:String(e.error?.stack||'').slice(0,600)});
    });
    window.addEventListener('unhandledrejection',(e)=>{
      if(!vistaAct)return;
      const r=e.reason;
      flRegistrarEvento('error',{mensaje:('Promise rechazada: '+(r?.message||r||'')).slice(0,300),stack:String(r?.stack||'').slice(0,600)});
    });
  }
  // Solo lo esencial para el primer render bloquea: vehículos y solicitudes.
  // Todo lo demás se carga en segundo plano una vez que el dashboard ya está
  // en pantalla — sus propias vistas se refrescan solas cuando llegue.
  await Promise.all([ldVehs(),ldSols()]);
  renderSB();
  flVista('panel');
  window._flInitDone=true;
  Promise.all([ldComs(),ldTrans(),ldChkSem(),ldCfgSem(),ldUsos(),ldFlUsuarios(),ldSiniestros()]).then(()=>{
    if(vistaAct==='panel')rPanel(); // refresca el dashboard con lo que llegó tarde (KPIs de comisión, en uso, etc.)
  });
  ldLlantas();
  ldUbicaciones();
  flRegistrarEvento('sesion_abierta');
};

function actualizarHeaderUsuario(){
  const user=window.auth?.currentUser;
  if(!user){
    // Reintentar hasta que auth resuelva
    setTimeout(actualizarHeaderUsuario,200);
    return;
  }
  const nombre=(user.displayName||user.email?.split('@')[0]||'USUARIO').toUpperCase();
  const inicial=nombre.charAt(0);
  const pname=document.querySelector('#fl-tb-profile .fl-tb-pname');
  const avatar=document.querySelector('#fl-tb-profile .fl-tb-avatar');
  if(pname)pname.textContent=nombre;
  if(avatar)avatar.textContent=inicial;
  // Hacer clic en el perfil → ir al admin si es admin, o mostrar info
  const profile=document.getElementById('fl-tb-profile');
  if(profile&&!profile._hasClick){
    profile._hasClick=true;
    profile.style.cursor='pointer';
    profile.title=user.email||'';
    profile.onclick=()=>hAdm()?flVista('admin'):flMsgInfo(user.email||nombre);
  }
}
// Listener en tiempo real de flotilla_vehiculos — única fuente de verdad.
// CAT solo se usa como respaldo de emergencia si Firestore devuelve vacío o falla.
let _unsubVehs=null;
function ldVehs(){
  return new Promise((resolve)=>{
    // Si el módulo se vuelve a inicializar (p.ej. cambiar de pestaña y regresar
    // a Flotilla dentro del portal), no duplicar el listener — ya hay uno activo.
    if(_unsubVehs){resolve();return;}
    try{
      _unsubVehs=fs.onSnapshot(fs.collection(db,C.VEHS),(s)=>{
        const docs=s.docs.map(d=>({id:d.id,...d.data()}));
        flV=docs.length?docs:CAT.map(v=>({id:'eco-'+v.eco,...v}));
        resolve();
        // Tras la carga inicial, cada cambio en vivo refresca lo que esté visible
        if(window._flInitDone){
          renderSB();
          if(vistaAct==='panel')rPanel();
          else if(vistaAct==='admin')rAdmin();
        }
      },(err)=>{
        console.error('[FL] onSnapshot vehiculos',err);
        if(!flV.length)flV=CAT.map(v=>({id:'eco-'+v.eco,...v}));
        resolve();
      });
    }catch(e){
      console.error('[FL] ldVehs',e);
      flV=CAT.map(v=>({id:'eco-'+v.eco,...v}));
      resolve();
    }
  });
}
let _unsubSols=null;
function ldSols(){
  return new Promise((resolve)=>{
    if(_unsubSols){resolve();return;}
    try{
      _unsubSols=fs.onSnapshot(fs.collection(db,C.SOLS),(s)=>{
        flS=s.docs.map(d=>({id:d.id,...d.data()}));
        flS.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
        // Refrescar sidebar para actualizar badge "En taller" basado en solicitudes
        if(document.getElementById('fl-sb-list'))renderSB();
        const p=flS.filter(s=>['Solicitud','Evaluación','Validación','Validada','Cotización','Aprobación','Aprobada','Servicio','Pagos','Cierre'].includes(s.estatus)).length;
        const c=document.getElementById('fl-cnt-s');if(c){c.textContent=p;c.style.display=p?'flex':'none';}
        resolve();
        if(window._flInitDone){
          // Ojo: si hay un vehículo seleccionado en 'sols' probablemente hay un
          // formulario de solicitud a medio llenar — no lo pisamos con un re-render.
          if(vistaAct==='sols'&&!ST?.vehId)rSols();
          else if(vistaAct==='resumen')rResumen();
          else if(vistaAct==='admin'&&admTab==='sols'){const c2=document.getElementById('adm-tab-content');if(c2)c2.innerHTML=rAdmTabSols();}
          else if(vistaAct==='admin'&&admTab==='usuarios'){const c3=document.getElementById('adm-tab-content');if(c3)c3.innerHTML=rAdmTabUsuarios();}
        }
      },(err)=>{console.error('[FL] onSnapshot solicitudes',err);if(!flS)flS=[];resolve();});
    }catch(e){console.error('[FL] ldSols',e);flS=[];resolve();}
  });
}
let _unsubComs=null;
function ldComs(){
  return new Promise((resolve)=>{
    if(_unsubComs){resolve();return;}
    try{
      _unsubComs=fs.onSnapshot(fs.collection(db,C.COMIS),(s)=>{
        flCom=s.docs.map(d=>({id:d.id,...d.data()}));
        resolve();
        if(window._flInitDone&&vistaAct==='comis')rComis();
      },(err)=>{console.error('[FL] onSnapshot comisiones',err);if(!flCom)flCom=[];resolve();});
    }catch(e){console.error('[FL] ldComs',e);flCom=[];resolve();}
  });
}
let _unsubTrans=null;
function ldTrans(){
  return new Promise((resolve)=>{
    if(_unsubTrans){resolve();return;}
    try{
      _unsubTrans=fs.onSnapshot(fs.collection(db,C.TRANS),(s)=>{
        flTrans=s.docs.map(d=>({id:d.id,...d.data()}));
        flTrans.sort((a,b)=>(b.creadoEn||"").localeCompare(a.creadoEn||""));
        resolve();
        if(window._flInitDone&&hAdm())flRevisarTransferenciasPendientes();
      },(err)=>{console.error('[FL] onSnapshot transferencias',err);if(!flTrans)flTrans=[];resolve();});
    }catch(e){console.error('[FL] ldTrans',e);flTrans=[];resolve();}
  });
}

// ── Aviso de transferencia pendiente demasiado tiempo (>24h) ──
// No hay backend con tareas programadas en este sistema, así que esto solo
// se detecta cuando un administrador tiene el portal abierto — no es
// instantáneo, pero evita que una transferencia se quede olvidada para
// siempre sin que nadie se entere.
async function flRevisarTransferenciasPendientes(){
  const ahora=Date.now();
  const stale=flTrans.filter(t=>t.estatus==='Pendiente recepción'&&!t.avisadoPendiente&&(ahora-new Date(t.creadoEn).getTime())>24*60*60*1000);
  for(const t of stale){
    try{
      await fs.updateDoc(fs.doc(db,C.TRANS,t.id),{avisadoPendiente:true});
      await Promise.all(FLOTILLA_ADMINS.map(admEmail=>fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
        tipo:'transferencia_pendiente_larga',codigo:t.codigo,vehiculoEco:t.vehiculoEco||'—',
        para:admEmail,
        mensaje:`Transferencia del ECO ${t.vehiculoEco||'—'} sigue "Pendiente recepción" desde hace más de 24h (código ${t.codigo}). Entregó: ${t.entregaNombre||'—'}.`,
        leido:false,creadoEn:new Date().toISOString(),
      }).catch(()=>{})));
    }catch(e){console.warn('[FL] flRevisarTransferenciasPendientes',e);}
  }
}
async function ldChkSem(){try{const s=await fs.getDocs(fs.query(fs.collection(db,C.CHKSEM),fs.orderBy('creadoEn','desc'),fs.limit(400)));flChkSem=s.docs.map(d=>({id:d.id,...d.data()}));flChkSem.sort((a,b)=>(b.creadoEn||"").localeCompare(a.creadoEn||""));}catch(e){console.warn('[FL] ldChkSem con límite falló, reintentando sin orderBy',e);try{const s2=await fs.getDocs(fs.collection(db,C.CHKSEM));flChkSem=s2.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.creadoEn||"").localeCompare(a.creadoEn||"")).slice(0,400);}catch{flChkSem=[];}}}
async function ldCfgSem(){try{const d=await fs.getDoc(fs.doc(db,C.CFG,'checklist_semanal'));flCfgSem=d.exists()?d.data():{};}catch{flCfgSem={};}}
let _unsubUsos=null;
function ldUsos(){
  return new Promise((resolve)=>{
    if(_unsubUsos){resolve();return;}
    try{
      _unsubUsos=fs.onSnapshot(fs.collection(db,C.USOS),(s)=>{
        flUsos=s.docs.map(d=>({id:d.id,...d.data()}));
        flUsos.sort((a,b)=>(b.vinculadoEn||'').localeCompare(a.vinculadoEn||''));
        resolve();
        if(window._flInitDone){
          if(vistaAct==='admin'&&admTab==='usuarios'){const c=document.getElementById('adm-tab-content');if(c)c.innerHTML=rAdmTabUsuarios();}
          // El Panorama de vehículos (si está abierto) toma flUsos fresco la próxima
          // vez que se renderice; no forzamos un refresh a mitad de una selección.
        }
      },(err)=>{console.error('[FL] onSnapshot usos',err);if(!flUsos)flUsos=[];resolve();});
    }catch(e){console.error('[FL] ldUsos',e);flUsos=[];resolve();}
  });
}
let _unsubSiniestros=null;
function ldSiniestros(){
  return new Promise((resolve)=>{
    if(_unsubSiniestros){resolve();return;}
    try{
      _unsubSiniestros=fs.onSnapshot(fs.collection(db,C.SINIESTROS),(s)=>{
        flSiniestros=s.docs.map(d=>({id:d.id,...d.data()}));
        flSiniestros.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
        if(window._flInitDone){
          const nuevos=s.docChanges().filter(ch=>ch.type==='added'&&ch.doc.data().estatus==='activo');
          if(nuevos.length&&typeof flSonarAlarmaSiniestro==='function')flSonarAlarmaSiniestro();
        }
        resolve();
        const btn=document.getElementById('fl-tb-siniestro');
        if(btn)btn.classList.toggle('fl-sin-activo',flSiniestros.some(x=>x.estatus==='activo'));
        if(window._flInitDone&&vistaAct==='siniestros')rSiniestrosVista();
      },(err)=>{console.error('[FL] onSnapshot siniestros',err);if(!flSiniestros)flSiniestros=[];resolve();});
    }catch(e){console.error('[FL] ldSiniestros',e);flSiniestros=[];resolve();}
  });
}
let _unsubUbicaciones=null;
function ldUbicaciones(){
  return new Promise((resolve)=>{
    if(_unsubUbicaciones){resolve();return;}
    try{
      _unsubUbicaciones=fs.onSnapshot(fs.collection(db,C.UBICACIONES),(s)=>{
        flUbicaciones=s.docs.map(d=>({id:d.id,...d.data()}));
        resolve();
        if(window._flInitDone&&vistaAct==='mapa')flActualizarMarcadoresMapa();
        if(window._flInitDone&&vistaAct==='panel')rPanel();
      },(err)=>{console.error('[FL] onSnapshot ubicaciones',err);if(!flUbicaciones)flUbicaciones=[];resolve();});
    }catch(e){console.error('[FL] ldUbicaciones',e);flUbicaciones=[];resolve();}
  });
}
let _unsubLlantas=null;
function ldLlantas(){
  return new Promise((resolve)=>{
    if(_unsubLlantas){resolve();return;}
    try{
      _unsubLlantas=fs.onSnapshot(fs.collection(db,C.LLANTAS),(s)=>{
        flLlantas=s.docs.map(d=>({id:d.id,...d.data()}));
        resolve();
        if(window._flInitDone&&document.getElementById('fl-llantas-wrap'))flRenderLlantasCard();
      },(err)=>{console.error('[FL] onSnapshot llantas',err);if(!flLlantas)flLlantas=[];resolve();});
    }catch(e){console.error('[FL] ldLlantas',e);flLlantas=[];resolve();}
  });
}
let _unsubFlUsuarios=null;
function ldFlUsuarios(){
  return new Promise((resolve)=>{
    if(_unsubFlUsuarios){resolve();return;}
    try{
      _unsubFlUsuarios=fs.onSnapshot(fs.collection(db,C.USUARIOS),(s)=>{
        flFlUsuarios=s.docs.map(d=>({id:d.id,...d.data()}));
        const map={};
        flFlUsuarios.forEach(u=>{
          const ecos=[...(Array.isArray(u.ecosVinculados)?u.ecosVinculados.map(String):[]),...(u.ecoVinculado?[String(u.ecoVinculado)]:[])].filter(Boolean);
          ecos.forEach(e=>{map[e]=u.nombre||u.displayName||u.email||'—';});
        });
        window._flUsuariosMap=map;
        resolve();
        if(window._flInitDone){
          renderSB();
          if(vistaAct==='panel')rPanel();
          else if(vistaAct==='admin'&&admTab==='usuarios'){const c=document.getElementById('adm-tab-content');if(c)c.innerHTML=rAdmTabUsuarios();}
          else if(vistaAct==='admin'&&admTab==='vehs'){const c2=document.getElementById('adm-tab-content');if(c2)c2.innerHTML=rAdmTabVehs([...new Set(flV.map(v=>v.plaza).filter(Boolean))].sort());}
        }
      },(err)=>{console.error('[FL] onSnapshot fl_usuarios',err);if(!flFlUsuarios)flFlUsuarios=[];window._flUsuariosMap=window._flUsuariosMap||{};resolve();});
    }catch(e){console.error('[FL] ldFlUsuarios',e);flFlUsuarios=[];window._flUsuariosMap={};resolve();}
  });
}

// SIDEBAR
let sbTipoFilt='all';
function renderSB(){
  const act=flV.filter(v=>v.status!=='baja');
  const tall=act.filter(flEnTaller).length;
  const lista=document.getElementById('fl-sb-list');
  const footer=document.getElementById('fl-sb-footer');
  if(!lista)return;
  let filtrado=act;
  if(sbTipoFilt==='auto')filtrado=act.filter(v=>v.tipo==='auto');
  else if(sbTipoFilt==='cam')filtrado=act.filter(v=>v.tipo!=='auto'&&v.tipo!=='maquinaria');
  else if(sbTipoFilt==='maq')filtrado=act.filter(v=>v.tipo==='maquinaria');
  else if(sbTipoFilt==='taller')filtrado=act.filter(flEnTaller);
  const q=(document.getElementById('fl-sb-q')?.value||'').toLowerCase();
  if(q)filtrado=filtrado.filter(v=>(v.eco+v.unidad+v.placas+v.responsable).toLowerCase().includes(q));
  filtrado=filtrado.slice().sort((a,b)=>Number(a.eco)-Number(b.eco));
  // Actualizar counter en botón taller
  const btnTall=document.getElementById('fl-sbt-taller');
  if(btnTall){const nt=act.filter(flEnTaller).length;btnTall.textContent=nt?`Taller (${nt})`:'Taller';}
  lista.innerHTML=filtrado.map(v=>{
    const enTallerSol=flEnTaller(v);
    const usuarioApp=(window._flUsuariosMap||{})[String(v.eco)];
    const dot=v.status==='taller'||enTallerSol?'#F59E0B':v.status==='comision'?'#8B5CF6':v.asignadoSinCambios?'#2563EB':usuarioApp?'#EF4444':'#22C55E';
    const bgTaller=v.status==='taller'||enTallerSol?'background:rgba(245,158,11,.08);border-left:3px solid #F59E0B;':'';
    const comAct=v.status==='comision'?flCom.find(c=>c.estatus==='En préstamo'&&(c.vehiculoId===v.id||String(c.vehiculoEco)===String(v.eco))):null;
    const bloqueado=!!comAct||!!usuarioApp;
    const tipResp=comAct?.responsable||usuarioApp||'—';
    const tip=bloqueado?`En uso · ${tipResp}`:enTallerSol?'En taller':'';
    const etiquetaExtra=bloqueado
      ?`<div class="fl-sb-bloq-info"><span class="fl-sb-bloq-resp" style="${usuarioApp?'color:#B91C1C':''}">${tipResp}</span></div>`
      :enTallerSol?`<div class="fl-sb-bloq-info"><span style="color:#B45309;font-size:9px;font-weight:800">EN TALLER</span></div>`:'';
    return`<div class="fl-sb-item${bloqueado?' fl-sb-bloq':''}" id="fl-sbi-${v.id}" onclick="flSbSel('${v.id}')" style="${bgTaller}" ${tip?`title="${tip.replace(/"/g,'&quot;')}"`:''}>
      <div class="fl-sb-eco">${v.eco}</div>
      <div class="fl-sb-name">${v.unidad||'—'}</div>
      ${etiquetaExtra}
      <div class="fl-sb-dot" style="background:${dot}"></div>
    </div>`;
  }).join('');
  if(footer)footer.innerHTML=`
    <dl class="fl-sb-stat"><dt>Activos</dt><dd style="color:#22C55E">${act.length-tall}</dd></dl>
    <dl class="fl-sb-stat"><dt>Taller</dt><dd style="color:#F59E0B">${tall}</dd></dl>`;
}
window.flSbFilt=function(){renderSB();};
window.flSbTipo=function(t){
  sbTipoFilt=t;
  document.querySelectorAll('.fl-sb-tipo').forEach(b=>{
    b.classList.remove('on');
    b.style.background='';b.style.borderColor='';b.style.color='';
  });
  const ids={all:'fl-sbt-all',auto:'fl-sbt-auto',cam:'fl-sbt-cam',maq:'fl-sbt-maq',taller:'fl-sbt-taller'};
  const btn=document.getElementById(ids[t]||'fl-sbt-all');
  if(btn){
    btn.classList.add('on');
    if(t==='taller'){btn.style.borderColor='#F59E0B';btn.style.background='#FFFBEB';btn.style.color='#B45309';}
  }
  renderSB();
};
window.flSbSel=function(id){
  const vChk=flV.find(x=>x.id===id);
  if(vChk&&vChk.status==='comision'){
    const comAct=flCom.find(c=>c.estatus==='En préstamo'&&(c.vehiculoId===vChk.id||String(c.vehiculoEco)===String(vChk.eco)));
    if(comAct){
      const msg=`⚠ Este vehículo está EN USO\n\nResponsable: ${comAct.responsable||'—'}\nMotivo: ${comAct.motivo||'—'}\n\n¿Deseas continuar de todos modos?`;
      if(!confirm(msg))return;
    }
  }
  document.querySelectorAll('.fl-sb-item').forEach(e=>e.classList.remove('on'));
  document.getElementById('fl-sbi-'+id)?.classList.add('on');
  // Reset TOTAL del estado al cambiar vehículo
  const vNuevo=flV.find(x=>x.id===id);
  const esGrande=vNuevo&&(vNuevo.tipo==='camioneta'||vNuevo.tipo==='camion');
  ST={
    vehId:id,
    tipoVeh:esGrande?'troca':'auto',
    vistaImg:'frente',
    dmg:{frente:[],atras:[],derecha:[],izquierda:[]},
    chk:{},
    chkFotos:{},
    evFotos:[],
    tipo:'',
    prior:'Normal',
    desc:'',
    km:'',
    gasolina:50,
  };
  renderRP(id);
  if(vistaAct==='sols')rSols();
  window.flAbrirPanoramaVehiculo(id);
};

// NAVEGACIÓN
window.flVista=function(v){
  vistaAct=v;
  document.querySelectorAll('.fl-tab-btn').forEach(b=>b.classList.remove('on'));
  document.getElementById('fl-tb-'+v)?.classList.add('on');
  if(v==='panel')rPanel();
  else if(v==='sols')rSols();
  else if(v==='tareas')rTareasPanel();
  else if(v==='comis')rComis();
  else if(v==='resumen')rResumen();
  else if(v==='presupuesto')rPresupuesto();
  else if(v==='compar')rCompar();
  else if(v==='chksemanal')rChkSemanal();
  else if(v==='bajas')rBajas();
  else if(v==='admin')rAdmin();
  else if(v==='calendario')rCalendarioVista();
  else if(v==='mapa')rMapaVista();
  else if(v==='siniestros')rSiniestrosVista();
};
function setContent(h){const c=document.getElementById('fl-content');if(c)c.innerHTML=h;}
function padded(h){return`<div style="padding:16px">${h}</div>`;}


// ══════════════════════════════════════════════════════
// VISTA ADMIN — Gestión de vehículos, solicitudes y usuarios
// ══════════════════════════════════════════════════════
let admEditId=null;
let admFiltro=''; let admFiltroPlaza=''; let admFiltroStatus='';
let admTab='vehs';
let admCumplMes=null;

function rAdmin(){
  if(!hAdm()){setContent(padded('<div class="fl-empty"><div class="fl-empty-ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div><h3>Acceso restringido</h3><p>Solo administradores pueden acceder a este panel.</p></div>'));return;}
  const act=flV.filter(v=>v.status==='activo'||!v.status).length;
  const tall=flV.filter(v=>v.status==='taller').length;
  const com=flV.filter(v=>v.status==='comision').length;
  const sinResp=flV.filter(v=>!v.responsable||v.responsable==='—').length;
  const plazas=[...new Set(flV.map(v=>v.plaza).filter(Boolean))].sort();
  const icoCar=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM5 17l1.5-6h11L19 17"/></svg>`;
  const icoPlus=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  const icoClip=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-3"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>`;
  const icoUsers=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;
  const icoChart=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;
  const icoAlertC=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const icoListCheck=`<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>`;
  const tabs=[
    {k:'vehs',label:'Vehículos',ico:icoCar},
    {k:'nuevo',label:'Agregar',ico:icoPlus},
    {k:'sols',label:'Solicitudes',ico:icoClip},
    {k:'usuarios',label:'Usuarios',ico:icoUsers},
    {k:'cumplimiento',label:'Cumplimiento',ico:icoChart},
    {k:'actividad',label:'Actividad',ico:icoAlertC},
    {k:'chkadapt',label:'Checklist adaptativo',ico:icoListCheck},
  ];
  const heroKpiAdm=(val,label,color)=>`<div style="background:rgba(255,255,255,.06);border-radius:12px;padding:12px 14px"><div style="font-size:22px;font-weight:900;color:${color||'#fff'}">${val}</div><div style="font-size:11px;color:#7C93B8;margin-top:2px">${label}</div></div>`;
  setContent(padded(`
    <div style="background:#0A1628;border-radius:16px;padding:20px 24px;margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:11px;color:#7C93B8;text-transform:uppercase;letter-spacing:.6px">Administración</div>
          <div style="font-size:19px;font-weight:900;color:#fff;margin-top:4px">Flotilla vehicular</div>
        </div>
        <div id="adm-hdr-btns" style="display:flex;gap:8px">
          <button onclick="admExportar()" style="background:rgba(255,255,255,.1);color:#fff;border:none;border-radius:9px;padding:9px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">${I.doc} Exportar CSV</button>
          <button class="fb acc" onclick="admGuardarTodo()" id="adm-btn-save" style="display:none;gap:5px">${I.save} Guardar cambios</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px">
        ${heroKpiAdm(flV.length,'Total flotilla')}
        ${heroKpiAdm(act,'Activos','#5DCAA5')}
        ${heroKpiAdm(tall,'En taller','#FAC775')}
        ${heroKpiAdm(com,'Comisión','#C4B5FD')}
        ${heroKpiAdm(sinResp,'Sin responsable','#F09595')}
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap">
      ${tabs.map(t=>`<button onclick="admTabSwitch('${t.k}')" id="adm-tab-${t.k}" style="display:flex;align-items:center;gap:6px;padding:9px 15px;border:none;border-radius:9px;background:${admTab===t.k?'#0A1628':'#F1F5F9'};color:${admTab===t.k?'#fff':'#475569'};font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:.15s">${t.ico}${t.label}</button>`).join('')}
    </div>
    <div id="adm-tab-content">
      ${admTab==='vehs'?rAdmTabVehs(plazas):admTab==='nuevo'?rAdmTabNuevo():admTab==='sols'?rAdmTabSols():admTab==='cumplimiento'?rAdmTabCumplimiento():admTab==='actividad'?rAdmTabActividad():admTab==='chkadapt'?rAdmTabChkAdapt():rAdmTabUsuarios()}
    </div>
  `));
}

window.admTabSwitch=function(tab){
  admTab=tab; admEditId=null;
  ['vehs','nuevo','sols','usuarios','cumplimiento','actividad','chkadapt'].forEach(k=>{
    const b=document.getElementById('adm-tab-'+k);if(!b)return;
    b.style.background=k===tab?'#0A1628':'#F1F5F9';
    b.style.color=k===tab?'#fff':'#475569';
  });
  const hb=document.getElementById('adm-hdr-btns');if(hb)hb.style.display=tab==='vehs'?'flex':'none';
  const content=document.getElementById('adm-tab-content');if(!content)return;
  const plazas=[...new Set(flV.map(v=>v.plaza).filter(Boolean))].sort();
  if(tab==='vehs')content.innerHTML=rAdmTabVehs(plazas);
  else if(tab==='nuevo')content.innerHTML=rAdmTabNuevo();
  else if(tab==='sols')content.innerHTML=rAdmTabSols();
  else if(tab==='colab'){content.innerHTML='<div id="adm-colab-wrap" style="padding:4px">Cargando colaboradores…</div>';setTimeout(rAdmTabColab,50);}
  else if(tab==='cumplimiento'){content.innerHTML='<div style="padding:20px;text-align:center;color:#94A3B8;font-size:12px">Calculando cumplimiento…</div>';setTimeout(()=>{content.innerHTML=rAdmTabCumplimiento();},30);}
  else if(tab==='actividad'){content.innerHTML='<div style="padding:20px;text-align:center;color:#94A3B8;font-size:12px">Cargando actividad…</div>';setTimeout(()=>{content.innerHTML=rAdmTabActividad();},30);}
  else if(tab==='chkadapt'){content.innerHTML='<div style="padding:20px;text-align:center;color:#94A3B8;font-size:12px">Cargando configuración…</div>';setTimeout(()=>{content.innerHTML=rAdmTabChkAdapt();},30);}
  else content.innerHTML=rAdmTabUsuarios();
};

// ── DETECTOR DE ECO DUPLICADO — dos vehículos activos con el mismo número ──
function flDetectarEcoDuplicados(){
  const grupos={};
  flV.filter(v=>v.status!=='baja').forEach(v=>{
    const eco=String(v.eco||'').trim();
    if(!eco)return;
    (grupos[eco]=grupos[eco]||[]).push(v);
  });
  return Object.entries(grupos).filter(([eco,vs])=>vs.length>1).map(([eco,vehiculos])=>({eco,vehiculos}));
}
window.admVerificarDuplicados=function(){
  const dups=flDetectarEcoDuplicados();
  if(!dups.length){alert('No se encontraron ECOs duplicados entre vehículos activos. Todo en orden.');return;}
  if(typeof rAdmin==='function')rAdmin();
};

// ── Migrar solicitudes viejas (evidencias inline) a la subcolección nueva ──
window.admMigrarEvidencias=async function(){
  const viejas=flS.filter(s=>s.evidencias!==undefined);
  if(!viejas.length){alert('No hay solicitudes con fotos en formato antiguo. Nada que migrar.');return;}
  if(!confirm(`Se encontraron ${viejas.length} solicitudes con fotos guardadas en el documento principal (formato viejo).\n\nEsto las moverá a una subcolección y aligerará el documento principal — no se pierde ninguna foto. Puede tardar unos minutos.\n\n¿Continuar?`))return;
  const btn=document.getElementById('adm-migrar-btn');
  let ok=0,fallo=0;
  for(let i=0;i<viejas.length;i++){
    const s=viejas[i];
    if(btn)btn.textContent=`Migrando ${i+1}/${viejas.length}…`;
    try{
      const adjuntos={
        evidencias:s.evidencias||[],
        evidenciasMeta:s.evidenciasMeta||[],
        danos:s.danos||{},
        checklist:s.checklist||{},
        chkFotos:s.chkFotos||{},
        chkFirmaConfirmacion:s.chkFirmaConfirmacion||null,
      };
      await fs.setDoc(fs.doc(db,C.SOLS,s.id,'adjuntos','fotos'),adjuntos);
      await fs.updateDoc(fs.doc(db,C.SOLS,s.id),{
        evidencias:fs.deleteField(),evidenciasMeta:fs.deleteField(),danos:fs.deleteField(),
        checklist:fs.deleteField(),chkFotos:fs.deleteField(),chkFirmaConfirmacion:fs.deleteField(),
      });
      ok++;
    }catch(e){console.error('[FL] migrar',s.id,e);fallo++;}
  }
  if(btn){btn.disabled=false;btn.textContent='Migrar evidencias antiguas';}
  alert(`Migración terminada: ${ok} solicitudes migradas correctamente${fallo?`, ${fallo} con error (revisa la consola)`:''}.`);
};

function rAdmTabVehs(plazas){
  const dups=flDetectarEcoDuplicados();
  return`
    ${dups.length?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:9px;padding:11px 14px;margin-bottom:14px">
      <div style="font-size:11.5px;font-weight:800;color:#B91C1C;margin-bottom:6px">${I.alert} ${dups.length} número${dups.length===1?'':'s'} de ECO duplicado${dups.length===1?'':'s'} — dos vehículos activos comparten el mismo ECO</div>
      ${dups.map(d=>`<div style="font-size:11px;color:#7F1D1D;margin-bottom:3px">ECO <strong>${d.eco}</strong>: ${d.vehiculos.map(v=>`${v.unidad||'—'} (${v.responsable||'sin responsable'})`).join('  ·  ')}</div>`).join('')}
      <div style="font-size:10px;color:#991B1B;margin-top:6px">Corrígelo cambiando el ECO de uno de los dos directamente en "Editar vehículo" — no hay forma automática de saber cuál es el correcto.</div>
    </div>`:''}
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
      <button class="fb gho sm" onclick="admVerificarDuplicados()">${I.check} Verificar ECO duplicados</button>
    </div>
    <div class="fl-adm-filters">
      <div class="fl-adm-search">${I.search}<input type="text" id="adm-q" placeholder="ECO, unidad, responsable, placas…" oninput="admFiltrar()" value="${admFiltro}"></div>
      <select class="fl-adm-fsel" id="adm-plaza" onchange="admFiltrar()">
        <option value="">Todas las plazas</option>
        ${plazas.map(p=>`<option ${admFiltroPlaza===p?'selected':''} value="${p}">${p}</option>`).join('')}
      </select>
      <select class="fl-adm-fsel" id="adm-status" onchange="admFiltrar()">
        <option value="">Todos los estatus</option>
        <option ${admFiltroStatus==='activo'?'selected':''}>activo</option>
        <option ${admFiltroStatus==='taller'?'selected':''}>taller</option>
        <option ${admFiltroStatus==='comision'?'selected':''}>comision</option>
        <option ${admFiltroStatus==='baja'?'selected':''}>baja</option>
      </select>
      <button class="fb gho sm" onclick="admLimpiarFiltros()">&#x2715; Limpiar</button>
      <span style="font-size:11px;color:#94A3B8;margin-left:auto" id="adm-count">${flV.length} vehículos</span>
    </div>
    <div class="fl-tw" style="overflow:auto;max-height:calc(100vh - 400px)">
      <table class="fl-adm-table" id="adm-tabla">
        <thead><tr><th>ECO</th><th>Unidad</th><th>Placas</th><th>Responsable</th><th>Plaza</th><th>Estatus</th><th>KM actual</th><th>NIP</th><th>Póliza seguro</th><th>Vto. póliza</th><th>Color</th><th>Tipo</th><th style="text-align:center">Editar</th></tr></thead>
        <tbody id="adm-tbody">${renderAdmRows(flV)}</tbody>
      </table>
    </div>`;
}

async function rAdmTabColab(){
  const wrap=document.getElementById('adm-colab-wrap');
  if(!wrap)return;
  const lista=await cargarColaboradores();
  wrap.innerHTML=`
    <div style="max-width:720px">
      <div style="font-size:14px;font-weight:800;color:#0A1628;margin-bottom:4px">Colaboradores Tecnocontrol</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:16px">${lista.length} colaboradores registrados</div>
      <div style="display:flex;gap:10px;margin-bottom:16px;align-items:flex-end">
        <div style="flex:1">
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Agregar nuevo colaborador</label>
          <input id="colab-nuevo-nombre" type="text" placeholder="Nombre completo (apellido primero recomendado)" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box" onfocus="this.style.borderColor='#2563EB'" onblur="this.style.borderColor='#E2E8F0'">
        </div>
        <button onclick="admAgregarColab()" style="padding:10px 18px;background:#1E3A5F;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap">+ Agregar</button>
      </div>
      <div id="colab-msg" style="margin-top:-8px;margin-bottom:10px;font-size:12px;display:none"></div>
      <div style="background:#F8FAFD;border-radius:10px;border:1px solid #E8EDF5;overflow:hidden">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr">
          ${lista.map((n,i)=>`<div style="padding:8px 12px;font-size:12px;font-weight:600;border-bottom:1px solid #F1F5F9;${(i+1)%3!==0?'border-right:1px solid #F1F5F9':''}">${n}</div>`).join('')}
        </div>
      </div>
    </div>`;
}
window.admAgregarColab=async function(){
  const inp=document.getElementById('colab-nuevo-nombre');
  const nombre=inp?.value?.trim();
  const msg=document.getElementById('colab-msg');
  if(!nombre){if(msg){msg.textContent='⚠ Ingresa el nombre del colaborador';msg.style.color='#B45309';msg.style.display='block';}return;}
  try{
    await agregarColaborador(nombre);
    inp.value='';
    if(msg){msg.textContent='✅ '+nombre+' agregado';msg.style.color='#15803D';msg.style.display='block';setTimeout(()=>{msg.style.display='none';},3000);}
    rAdmTabColab();
  }catch(e){if(msg){msg.textContent='Error: '+e.message;msg.style.color='#B91C1C';msg.style.display='block';}}
};

function rAdmTabNuevo(){
  const campos=[
    ['adm-nv-eco','ECO / Número económico','text',''],
    ['adm-nv-unidad','Unidad (marca y modelo)','text','Ej: RAM 700 SLT'],
    ['adm-nv-año','Año','number','2025'],
    ['adm-nv-placas','Placas','text',''],
    ['adm-nv-serie','Número de serie (VIN)','text',''],
    ['adm-nv-resp','Responsable','text',''],
    ['adm-nv-plaza','Plaza / Sucursal','text','CHIHUAHUA'],
    ['adm-nv-color','Color','text','Blanco'],
    ['adm-nv-nip','NIP gasolinera','text',''],
    ['adm-nv-pol','Número de póliza seguro','text',''],
    ['adm-nv-pv','Vencimiento póliza','date',''],
    ['adm-nv-rend','Rendimiento (Ej: 12 KM/L)','text',''],
  ];
  return`
    <div style="max-width:680px">
      <div style="font-size:14px;font-weight:800;color:#0A1628;margin-bottom:16px">Registrar nuevo vehículo en la flotilla</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        ${campos.map(([id,label,type,ph])=>`
          <div>
            <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">${label}</label>
            <input id="${id}" type="${type}" placeholder="${ph}" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box" onfocus="this.style.borderColor='#2563EB'" onblur="this.style.borderColor='#E2E8F0'">
          </div>`).join('')}
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Tipo</label>
          <select id="adm-nv-tipo" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none">
            <option value="camioneta">Camioneta</option><option value="auto">Auto</option><option value="camion">Camión</option><option value="maquinaria">Maquinaria</option>
          </select>
        </div>
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Estatus inicial</label>
          <select id="adm-nv-status" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none">
            <option value="activo">Activo</option><option value="taller">En taller</option><option value="comision">Comisión</option>
          </select>
        </div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px">
        <button onclick="admNuevoGuardar()" class="fb acc" style="padding:10px 24px;font-size:13px">${I.save} Registrar vehículo</button>
        <button onclick="admNuevoLimpiar()" class="fb gho" style="padding:10px 24px;font-size:13px">Limpiar</button>
      </div>
      <div id="adm-nv-msg" style="margin-top:12px;font-size:12px;display:none"></div>
    </div>`;
}

function rAdmTabSols(){
  const solFiltro=window._admSolFiltro||'';
  const solQ=window._admSolQ||'';
  let lista=flS;
  const normSolEst={'Validación':'Evaluación','Validada':'Evaluación','Cotización':'Evaluación','Aprobación':'Evaluación','Aprobada':'Evaluación','Pagos':'Servicio','Cierre':'Servicio'};
  if(solFiltro){
    const grupo={'Evaluación':['Evaluación','Validación','Validada','Cotización','Aprobación','Aprobada'],'Servicio':['Servicio','Pagos','Cierre']}[solFiltro];
    lista=lista.filter(s=>grupo?grupo.includes(s.estatus):s.estatus===solFiltro);
  }
  if(solQ){const q=solQ.toLowerCase();lista=lista.filter(s=>(s.vehiculoEco+s.solicitante+s.tipoSol+s.id+'').toLowerCase().includes(q));}
  const filtros=['Solicitud','Evaluación','Servicio','Rechazada','Cerrada'];
  const viejas=flS.filter(s=>s.evidencias!==undefined).length;
  return`
    ${viejas?`<div style="display:flex;align-items:center;gap:10px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:9px;padding:10px 14px;margin-bottom:12px">
      <span style="font-size:11.5px;color:#92400E;flex:1"><strong>${viejas}</strong> solicitud${viejas===1?'':'es'} con fotos en formato antiguo (afectan el rendimiento de carga).</span>
      <button class="fb" id="adm-migrar-btn" style="background:#D97706;color:#fff;border:none" onclick="admMigrarEvidencias()">Migrar evidencias antiguas</button>
    </div>`:''}
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
      <div class="fl-adm-search" style="flex:1;min-width:200px">${I.search}<input type="text" id="adms-q" placeholder="ECO, solicitante, tipo…" value="${solQ}" oninput="admSolFiltrar()"></div>
      <select id="adms-est" onchange="admSolFiltrar()" class="fl-adm-fsel">
        <option value="">Todos los estatus</option>
        ${filtros.map(f=>`<option ${solFiltro===f?'selected':''} value="${f}">${f}</option>`).join('')}
      </select>
      <button class="fb gho sm" onclick="admSolLimpiar()">&#x2715; Limpiar</button>
      <span style="font-size:11px;color:#94A3B8;margin-left:auto">${lista.length} solicitudes</span>
    </div>
    <div class="fl-tw" style="overflow:auto;max-height:calc(100vh - 420px)">
      <table class="fl-adm-table">
        <thead><tr><th>ID</th><th>Fecha</th><th>ECO</th><th>Tipo</th><th>Solicitante</th><th>Estatus</th><th>KM</th><th style="text-align:center">Acciones</th></tr></thead>
        <tbody>
          ${lista.length?lista.map(s=>{
            const normEst2={'Validación':'Evaluación','Validada':'Evaluación','Cotización':'Evaluación','Aprobación':'Evaluación','Aprobada':'Evaluación','Pagos':'Servicio','Cierre':'Servicio'};
            const statCls={Solicitud:'fl-adm-stat-taller',Evaluación:'fl-adm-stat-activo',Servicio:'fl-adm-stat-comision',Rechazada:'fl-adm-stat-baja',Cerrada:'fl-adm-stat-baja'}[normEst2[s.estatus]||s.estatus]||'fl-adm-stat-activo';
            const fecha=s.creadoEn?s.creadoEn.slice(0,10):'—';
            return`<tr>
              <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748B">${(s.id||'').slice(-6)}</td>
              <td style="font-size:11px">${fecha}</td>
              <td style="font-weight:700;font-family:'JetBrains Mono',monospace">${s.vehiculoEco||'—'}</td>
              <td style="font-size:11px">${s.tipoSol||s.tipo||'—'}</td>
              <td style="font-size:11px">${s.solicitante||s.creadoPor||'—'}</td>
              <td><span class="fl-adm-badge ${statCls}">${s.estatus||'—'}</span></td>
              <td style="font-size:11px">${s.km||'—'}</td>
              <td style="text-align:center">
                <div style="display:flex;gap:4px;justify-content:center">
                  <button class="fb gho sm" onclick="flVerSol('${s.id}')" title="Ver detalle">${I.eye||'Ver'}</button>
                  <button class="fb gho sm" onclick="admElimSol('${s.id}')" title="Eliminar" style="color:#EF4444;border-color:#FCA5A5">${I.trash||'Elim'}</button>
                </div>
              </td>
            </tr>`;
          }).join(''):`<tr><td colspan="8" style="text-align:center;padding:24px;color:#94A3B8">Sin solicitudes</td></tr>`}
        </tbody>
      </table>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// CUMPLIMIENTO MENSUAL POR TÉCNICO
// Checklist: compara semanas del mes en que el técnico tuvo un vehículo
// vinculado (flotilla_usos, considera préstamos/cambios de unidad) contra
// semanas en que sí se registró checklist semanal para ese vehículo.
// Tareas: usa el sistema "Asignar Tarea" del portal (colección 'actividades'),
// filtrado a area==='Flotilla' y encargado===técnico.
// ══════════════════════════════════════════════════════════════
let _flActCache={};
async function flFetchActividadesMes(mes){
  if(_flActCache[mes])return _flActCache[mes];
  try{
    const snap=await fs.getDocs(fs.query(fs.collection(db,'actividades'),fs.where('area','==','Flotilla')));
    const arr=snap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>(a.fechaLimite||a.fechaCreacion||'').slice(0,7)===mes);
    _flActCache[mes]=arr;
    return arr;
  }catch(e){console.error('[FL] fetch actividades',e);return[];}
}

function flMesesCumplimientoDisponibles(){
  const out=[];const d=new Date();
  for(let i=0;i<6;i++){out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);d.setMonth(d.getMonth()-1);}
  return out;
}

function rAdmTabCumplimiento(){
  if(!admCumplMes){const d=new Date();admCumplMes=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  const meses=flMesesCumplimientoDisponibles();
  setTimeout(()=>flRenderCumplimientoBody(admCumplMes),30);
  return`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8">Mes</span>
      <select id="adm-cumpl-mes" onchange="admCumplMes=this.value;flRenderCumplimientoBody(admCumplMes)" style="padding:7px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;color:#0A1628;background:#fff;cursor:pointer">
        ${meses.map(m=>`<option value="${m}" ${m===admCumplMes?'selected':''}>${flPanorMesLabel(m)}</option>`).join('')}
      </select>
    </div>
    <div style="font-size:12px;color:#64748B;margin-bottom:14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 14px">
      <strong style="color:#C2410C">Cómo se calcula:</strong> el cumplimiento de checklist compara las semanas del mes en que el técnico tuvo un vehículo vinculado (según el registro de uso, considerando préstamos y cambios de unidad) contra las semanas en que sí se registró un checklist semanal para ese vehículo. Las tareas vienen de "Asignar Tarea" del portal, filtradas a Flotilla y a quien aparece como encargado.
    </div>
    <div id="adm-cumpl-body"><div style="text-align:center;padding:30px;color:#94A3B8;font-size:12px">Calculando…</div></div>
  `;
}

window.flRenderCumplimientoBody=async function(mes){
  const body=document.getElementById('adm-cumpl-body');
  if(!body)return;
  body.innerHTML='<div style="text-align:center;padding:30px;color:#94A3B8;font-size:12px">Calculando…</div>';
  const actividades=await flFetchActividadesMes(mes);

  const dirMap={};
  const touch=(email,nombre)=>{email=(email||'').toLowerCase().trim();if(!email)return;if(!dirMap[email])dirMap[email]={email,nombre:nombre||email};else if(nombre&&dirMap[email].nombre===dirMap[email].email)dirMap[email].nombre=nombre;};
  flFlUsuarios.forEach(u=>touch(u.email,u.nombre));
  flUsos.forEach(u=>touch(u.email,u.nombre));
  const tecnicos=Object.values(dirMap).sort((a,b)=>a.nombre.localeCompare(b.nombre));

  const[anio,mesNum]=mes.split('-').map(Number);
  const monthStart=new Date(anio,mesNum-1,1);
  const monthEnd=new Date(anio,mesNum,0);
  const semanasDelMes=new Set();
  for(let d=new Date(monthStart);d<=monthEnd;d.setDate(d.getDate()+1))semanasDelMes.add(getSemanaISOPortal(new Date(d)));

  const filas=tecnicos.map(t=>{
    const usosDelTec=flUsos.filter(u=>String(u.email||'').toLowerCase()===t.email);
    const ecosDelMes=new Set();
    const semanasConVehiculo=new Set();
    usosDelTec.forEach(u=>{
      const ini=u.vinculadoEn?new Date(u.vinculadoEn):null;
      const fin=u.desvinculadoEn?new Date(u.desvinculadoEn):monthEnd;
      if(!ini||ini>monthEnd||fin<monthStart)return;
      ecosDelMes.add(String(u.eco));
      const desde=ini<monthStart?monthStart:ini, hasta=fin>monthEnd?monthEnd:fin;
      for(let d=new Date(desde);d<=hasta;d.setDate(d.getDate()+1))semanasConVehiculo.add(getSemanaISOPortal(new Date(d)));
    });
    const semanasEsperadas=[...semanasConVehiculo].filter(s=>semanasDelMes.has(s));
    const semanasConChecklist=semanasEsperadas.filter(s=>flChkSem.some(c=>ecosDelMes.has(String(c.vehiculoEco))&&c.semana===s));
    const pctChecklist=semanasEsperadas.length?Math.round(semanasConChecklist.length/semanasEsperadas.length*100):null;

    const tareasTec=actividades.filter(a=>String(a.encargado||'').toLowerCase()===t.email);
    const tareasCompletadas=tareasTec.filter(a=>a.estatus==='Completada').length;
    const pctTareas=tareasTec.length?Math.round(tareasCompletadas/tareasTec.length*100):null;

    return{...t,ecos:[...ecosDelMes],semanasEsperadas:semanasEsperadas.length,semanasCumplidas:semanasConChecklist.length,pctChecklist,tareasTotal:tareasTec.length,tareasCompletadas,pctTareas};
  }).filter(f=>f.ecos.length>0||f.tareasTotal>0);

  if(!filas.length){
    body.innerHTML='<div class="fl-empty" style="min-height:120px"><h3>Sin datos para este mes</h3></div>';
    return;
  }

  const barra=(pct,colorOk,colorMal)=>pct===null?'<span style="font-size:11px;color:#94A3B8">Sin vehículo este mes</span>':`
    <div style="display:flex;align-items:center;gap:8px">
      <div style="flex:1;height:6px;background:#F1F5F9;border-radius:100px;overflow:hidden;max-width:80px"><div style="height:100%;width:${pct}%;background:${pct>=80?colorOk:pct>=50?'#D97706':colorMal};border-radius:100px"></div></div>
      <span style="font-size:11.5px;font-weight:800;color:${pct>=80?colorOk:pct>=50?'#D97706':colorMal}">${pct}%</span>
    </div>`;

  body.innerHTML=`
    <div class="fl-tw" style="overflow:auto">
      <table class="fl-adm-table">
        <thead><tr><th>Técnico</th><th>Vehículo(s) del mes</th><th>Checklist semanal</th><th>Tareas asignadas</th><th>% Tareas</th></tr></thead>
        <tbody>
          ${filas.map(f=>`
            <tr>
              <td style="font-weight:700">${f.nombre}<div style="font-size:10px;color:#94A3B8;font-weight:400">${f.email}</div></td>
              <td style="font-size:11px">${f.ecos.length?f.ecos.map(e=>`<span style="background:#EFF6FF;color:#2563EB;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-right:3px">ECO ${e}</span>`).join(''):'Sin vehículo'}</td>
              <td>${barra(f.pctChecklist,'#15803D','#B91C1C')}${f.pctChecklist!==null?`<div style="font-size:9.5px;color:#94A3B8;margin-top:2px">${f.semanasCumplidas}/${f.semanasEsperadas} semanas</div>`:''}</td>
              <td style="font-size:12px">${f.tareasCompletadas}/${f.tareasTotal}</td>
              <td>${barra(f.pctTareas,'#15803D','#B91C1C')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
};

// ══════════════════════════════════════════════════════════════
// ACTIVIDAD Y ERRORES — diagnóstico de sesiones e incidencias reales
// ══════════════════════════════════════════════════════════════
let _flEventosCache={};
async function flFetchEventosMes(mes){
  if(_flEventosCache[mes])return _flEventosCache[mes];
  try{
    const snap=await fs.getDocs(fs.collection(db,C.EVENTOS));
    const arr=snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>(e.creadoEn||'').slice(0,7)===mes);
    arr.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
    _flEventosCache[mes]=arr;
    return arr;
  }catch(e){console.error('[FL] fetch eventos',e);return[];}
}

let admActividadMes=null;

function rAdmTabActividad(){
  if(!admActividadMes){const d=new Date();admActividadMes=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  const meses=flMesesCumplimientoDisponibles();
  setTimeout(()=>flRenderActividadBody(admActividadMes),30);
  return`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8">Mes</span>
      <select id="adm-act-mes" onchange="admActividadMes=this.value;flRenderActividadBody(admActividadMes)" style="padding:7px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;color:#0A1628;background:#fff;cursor:pointer">
        ${meses.map(m=>`<option value="${m}" ${m===admActividadMes?'selected':''}>${flPanorMesLabel(m)}</option>`).join('')}
      </select>
    </div>
    <div style="font-size:12px;color:#64748B;margin-bottom:14px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 14px">
      <strong style="color:#C2410C">Qué es esto:</strong> "Sesiones" cuenta cada vez que alguien abrió Flotilla (móvil o escritorio) en el mes. "Errores" son fallos reales de JavaScript capturados automáticamente — si un técnico dice que "se le cierra la app", aquí debería aparecer el error exacto, con su correo, la pantalla y la hora. Si no hay ningún error registrado pero sí hubo sesiones ese día, lo más probable es que no sea un bug de la app.
    </div>
    <div id="adm-act-body"><div style="text-align:center;padding:30px;color:#94A3B8;font-size:12px">Cargando…</div></div>
  `;
}

window.flRenderActividadBody=async function(mes){
  const body=document.getElementById('adm-act-body');
  if(!body)return;
  body.innerHTML='<div style="text-align:center;padding:30px;color:#94A3B8;font-size:12px">Cargando…</div>';
  const eventos=await flFetchEventosMes(mes);
  const sesiones=eventos.filter(e=>e.tipo==='sesion_abierta');
  const errores=eventos.filter(e=>e.tipo==='error');

  const porTec={};
  const touch=(email,nombre)=>{email=(email||'—').toLowerCase();if(!porTec[email])porTec[email]={email,nombre:nombre||email,sesiones:0,errores:0};};
  sesiones.forEach(s=>{touch(s.email,s.nombre);porTec[(s.email||'—').toLowerCase()].sesiones++;});
  errores.forEach(e=>{touch(e.email,e.nombre);porTec[(e.email||'—').toLowerCase()].errores++;});
  const filas=Object.values(porTec).sort((a,b)=>b.errores-a.errores||b.sesiones-a.sesiones);

  body.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px">
      <div style="background:#F8FAFD;border-radius:12px;padding:14px 16px"><div style="font-size:22px;font-weight:900">${sesiones.length}</div><div style="font-size:11px;color:#64748B;margin-top:2px">Sesiones totales</div></div>
      <div style="background:${errores.length?'#FEF2F2':'#F0FDF4'};border-radius:12px;padding:14px 16px"><div style="font-size:22px;font-weight:900;color:${errores.length?'#B91C1C':'#15803D'}">${errores.length}</div><div style="font-size:11px;color:${errores.length?'#B91C1C':'#15803D'};margin-top:2px">Errores capturados</div></div>
      <div style="background:#F8FAFD;border-radius:12px;padding:14px 16px"><div style="font-size:22px;font-weight:900">${filas.length}</div><div style="font-size:11px;color:#64748B;margin-top:2px">Técnicos activos</div></div>
    </div>
    <div class="fl-tw" style="overflow:auto;margin-bottom:20px">
      <table class="fl-adm-table">
        <thead><tr><th>Técnico</th><th>Sesiones</th><th>Errores</th></tr></thead>
        <tbody>
          ${filas.length?filas.map(f=>`
            <tr>
              <td style="font-weight:700">${f.nombre}<div style="font-size:10px;color:#94A3B8;font-weight:400">${f.email}</div></td>
              <td style="font-size:13px">${f.sesiones}</td>
              <td style="font-size:13px;font-weight:700;color:${f.errores?'#B91C1C':'#94A3B8'}">${f.errores}</td>
            </tr>`).join(''):`<tr><td colspan="3" style="text-align:center;padding:20px;color:#94A3B8">Sin sesiones registradas este mes</td></tr>`}
        </tbody>
      </table>
    </div>
    <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:10px">Errores registrados (${errores.length})</div>
    ${errores.length?errores.slice(0,30).map(e=>`
      <div style="border:1px solid #FECACA;background:#FEF2F2;border-radius:10px;padding:10px 14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:4px">
          <strong style="font-size:12px;color:#991B1B">${e.nombre||e.email||'—'}</strong>
          <span style="font-size:10.5px;color:#B91C1C">${e.creadoEn?new Date(e.creadoEn).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—'}</span>
        </div>
        <div style="font-size:12px;color:#7F1D1D;font-family:'JetBrains Mono',monospace;margin-bottom:3px">${(e.mensaje||'—').replace(/</g,'&lt;')}</div>
        <div style="font-size:10.5px;color:#B91C1C">Pantalla: ${e.vista||'—'} · ${e.online===false?'Sin conexión':'Con conexión'}</div>
      </div>`).join(''):`<div style="font-size:12px;color:#94A3B8;padding:14px 0">Sin errores capturados este mes.</div>`}
  `;
};

// ══════════════════════════════════════════════════════════════
// CHECKLIST ADAPTATIVO — configuración editable por categoría de vehículo.
// Borrador inicial basado en conocimiento general (no verificado en vivo);
// pensado para que Glen lo confirme/ajuste directamente aquí.
// ══════════════════════════════════════════════════════════════
const CHKADAPT_DEFAULT={
  categorias:{
    sedan:{label:'Sedán / hatchback',items:['Parabrisas delantero','Cristal trasero','Cristal lateral del. izq.','Cristal lateral del. der.','Cristal lateral tras. izq.','Cristal lateral tras. der.','Espejo retrovisor','Espejos laterales','Llanta del. izq.','Llanta del. der.','Llanta tras. izq.','Llanta tras. der.','Refacción','Interiores/asientos','Motor','Cajuela','Limpiaparabrisas en buen estado','Documentos (legal)']},
    pickup_sencilla:{label:'Pickup cabina sencilla',items:['Parabrisas delantero','Cristal lateral izq.','Cristal lateral der.','Espejos laterales','Llanta del. izq.','Llanta del. der.','Llanta tras. izq.','Llanta tras. der.','Refacción','Caja de carga','Interiores/asientos','Motor','Limpiaparabrisas en buen estado','Documentos (legal)']},
    pickup_doble:{label:'Pickup doble cabina',items:['Parabrisas delantero','Cristal trasero','Cristal lateral del. izq.','Cristal lateral del. der.','Cristal lateral tras. izq.','Cristal lateral tras. der.','Espejos laterales','Llanta del. izq.','Llanta del. der.','Llanta tras. izq.','Llanta tras. der.','Refacción','Caja de carga','Interiores/asientos','Motor','Limpiaparabrisas en buen estado','Documentos (legal)']},
    suv:{label:'SUV',items:['Parabrisas delantero','Cristal trasero','Cristal lateral del. izq.','Cristal lateral del. der.','Cristal lateral tras. izq.','Cristal lateral tras. der.','Espejos laterales','Llanta del. izq.','Llanta del. der.','Llanta tras. izq.','Llanta tras. der.','Refacción','Interiores/asientos','Cajuela','Motor','Limpiaparabrisas en buen estado','Documentos (legal)']},
    camion:{label:'Camión pesado',items:['Parabrisas delantero','Espejos laterales','Llantas (todas las posiciones)','Quinta rueda','Sistema neumático','Suspensión de aire','Luces y torretas','Interiores/cabina','Motor','Documentos (legal)']},
    remolque:{label:'Remolque / semirremolque',items:['Luces y reflejantes','Llantas (todas las posiciones)','Quinta rueda / conexión','Estructura y chasis','Frenos de aire','Documentos (legal)']},
    maquinaria:{label:'Maquinaria pesada',items:['Sistema hidráulico','Orugas / llantas','Implemento principal (hoja, rodillo, etc.)','Luces','Motor','Documentos (legal)']},
  },
  asignaciones:{
    'MARCH':'sedan','MARCH ACTIVE':'sedan','MARCH ACTIVE L4':'sedan','AVEO':'sedan','FIESTA':'sedan','SEAT IBIZA':'sedan','NISSAN VERSA':'sedan','DODGE ATTITUDE':'sedan','COROLLA TOYOTA':'sedan',
    'RAM 700':'pickup_doble','RAM 700 SLT':'pickup_doble','RAM RAPID':'pickup_doble','F-150 PICK-UP':'pickup_doble','NP300':'pickup_doble','NP300 KANGOO':'pickup_doble','NISSAN NP100':'pickup_sencilla','L200':'pickup_doble','SILVERADO 1500':'pickup_doble','CHASIS DONGFENG':'pickup_sencilla','PICKUP DONGFENG':'pickup_doble','VAN DONGFENG':'pickup_doble','CHANGAN HUNTER':'pickup_doble','CHANGAN STAR':'pickup_doble','CHANGAN STAR DC':'pickup_doble',
    'BMW X6':'suv','YUKON':'suv',
    'CAMION NISSAN CS':'camion','CAMION VOLVO VNM':'camion','CASCADIA FREIGHTLINER':'camion','GRUA F-350':'camion',
    'REMOLQUE CAJA SECA':'remolque','REMOLQUE CAMA BAJA':'remolque','REMOLQUE DOLLY':'remolque','REMOLQUE GR TRAILERS':'remolque','REMOLQUE PLANTA DE LUZ':'remolque','SEMIRREMOLQUE PLATAFORMA INTERSTATE':'remolque','COMPRESOR DE AIRE REMOLCABLE':'remolque',
    'NIVELADORA AUTOPROPULSADA JOHN DEERE 772B':'maquinaria','VIBROCOMPACTADOR DYNAPAC CA250D':'maquinaria',
  },
};
let _flChkAdaptCfg=null;
async function flCargarChkAdapt(){
  if(_flChkAdaptCfg)return _flChkAdaptCfg;
  try{
    const d=await fs.getDoc(fs.doc(db,C.CFG,'checklist_adaptativo'));
    _flChkAdaptCfg=d.exists()?d.data():JSON.parse(JSON.stringify(CHKADAPT_DEFAULT));
  }catch(e){_flChkAdaptCfg=JSON.parse(JSON.stringify(CHKADAPT_DEFAULT));}
  return _flChkAdaptCfg;
}

function rAdmTabChkAdapt(){
  setTimeout(async()=>{
    const cfg=await flCargarChkAdapt();
    const body=document.getElementById('adm-chkadapt-body');
    if(!body)return;
    const unidadesReales=[...new Set(flV.map(v=>(v.unidad||'').toUpperCase().trim()).filter(Boolean))].sort();
    const catOpts=Object.entries(cfg.categorias).map(([k,c])=>`<option value="${k}">${c.label}</option>`).join('');
    body.innerHTML=`
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:10px">Categorías y sus puntos de checklist</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:22px">
        ${Object.entries(cfg.categorias).map(([k,c])=>`
          <div style="border:1px solid #E8EDF5;border-radius:12px;padding:12px 14px">
            <div style="font-size:12.5px;font-weight:800;margin-bottom:6px">${c.label}</div>
            <textarea id="ca-items-${k}" rows="6" style="width:100%;box-sizing:border-box;padding:8px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:11.5px;resize:vertical">${c.items.join('\n')}</textarea>
          </div>`).join('')}
      </div>
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:10px">Asignación por unidad (${unidadesReales.length} unidades detectadas en tu flota)</div>
      <div class="fl-tw" style="overflow:auto;max-height:340px;margin-bottom:16px">
        <table class="fl-adm-table">
          <thead><tr><th>Unidad</th><th>Categoría</th></tr></thead>
          <tbody>
            ${unidadesReales.map(u=>`<tr><td style="font-weight:700">${u}</td><td>
              <select id="ca-asig-${btoa(unescape(encodeURIComponent(u))).replace(/[^a-zA-Z0-9]/g,'')}" data-unidad="${u.replace(/"/g,'&quot;')}" style="padding:6px 10px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:11.5px">
                <option value="">— Sin asignar —</option>
                ${catOpts}
              </select>
            </td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <button class="fb acc" onclick="admGuardarChkAdapt()" id="ca-btn-guardar">${I.check} Guardar configuración</button>
      <div id="ca-msg" style="display:none;margin-top:10px;padding:8px 12px;border-radius:8px;font-size:12px"></div>
    `;
    // Preseleccionar categoría asignada
    unidadesReales.forEach(u=>{
      const sel=document.getElementById('ca-asig-'+btoa(unescape(encodeURIComponent(u))).replace(/[^a-zA-Z0-9]/g,''));
      if(sel)sel.value=cfg.asignaciones[u]||'';
    });
  },30);
  return`
    <div style="font-size:12px;color:#64748B;margin-bottom:16px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 14px">
      <strong style="color:#C2410C">Borrador inicial:</strong> lo armé con conocimiento general de estos modelos, no con verificación en vivo. Revisa sobre todo las pickups (cabina sencilla vs. doble) antes de confirmar — de eso depende qué evidencias se le pidan al técnico.
    </div>
    <div id="adm-chkadapt-body"><div style="text-align:center;padding:30px;color:#94A3B8;font-size:12px">Cargando configuración…</div></div>
  `;
}

window.admGuardarChkAdapt=async function(){
  const cfg=await flCargarChkAdapt();
  const btn=document.getElementById('ca-btn-guardar');
  const msg=document.getElementById('ca-msg');
  Object.keys(cfg.categorias).forEach(k=>{
    const ta=document.getElementById('ca-items-'+k);
    if(ta)cfg.categorias[k].items=ta.value.split('\n').map(s=>s.trim()).filter(Boolean);
  });
  const nuevasAsig={};
  document.querySelectorAll('[id^="ca-asig-"]').forEach(sel=>{
    const u=sel.dataset.unidad;
    if(u&&sel.value)nuevasAsig[u]=sel.value;
  });
  cfg.asignaciones=nuevasAsig;
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    await fs.setDoc(fs.doc(db,C.CFG,'checklist_adaptativo'),cfg);
    _flChkAdaptCfg=cfg;
    if(msg){msg.style.cssText='display:block;background:#DCFCE7;color:#15803D';msg.textContent='Configuración guardada correctamente.';}
  }catch(e){
    if(msg){msg.style.cssText='display:block;background:#FEE2E2;color:#B91C1C';msg.textContent='Error al guardar: '+e.message;}
  }
  if(btn){btn.disabled=false;btn.textContent='Guardar configuración';}
};

function rAdmTabUsuarios(){
  const userMap={};
  const touch=(k,patch,fuente)=>{
    if(!k)return;
    if(!userMap[k])userMap[k]={nombre:'',email:'',ecos:[],fuentes:new Set()};
    if(patch.nombre&&!userMap[k].nombre)userMap[k].nombre=patch.nombre;
    if(patch.email&&!userMap[k].email)userMap[k].email=patch.email;
    if(patch.eco)userMap[k].ecos.push(patch.eco);
    if(fuente)userMap[k].fuentes.add(fuente);
  };
  // 1. Directorio de la app móvil (fl_usuarios) — fuente más confiable, ya trae email real
  flFlUsuarios.forEach(u=>{
    const email=(u.email||'').toLowerCase().trim();
    if(!email)return;
    touch(email,{nombre:u.nombre||email,email},'App móvil');
  });
  // 2. Uso de vehículos (flotilla_usos) — vinculación/desvinculación desde el celular
  flUsos.forEach(u=>{
    const email=(u.email||'').toLowerCase().trim();
    if(!email)return;
    touch(email,{nombre:u.nombre||email,email},'Uso de vehículo');
  });
  // 3. Responsables asignados a vehículos — casi siempre solo nombre, sin correo
  flV.forEach(v=>{
    if(v.responsable&&v.responsable!=='—'){
      const k=v.responsable.toLowerCase();
      touch(k,{nombre:v.responsable,eco:v.eco},'Responsable de ECO');
    }
  });
  // 4. Quien ha creado solicitudes desde el portal — sí trae correo (creadoPor)
  flS.forEach(s=>{
    if(s.creadoPor){
      const k=s.creadoPor.toLowerCase();
      touch(k,{nombre:s.solicitante||s.creadoPor,email:s.creadoPor},'Creó solicitud');
    }
  });
  const usuarios=Object.values(userMap).sort((a,b)=>a.nombre.localeCompare(b.nombre));
  const conEmail=usuarios.filter(u=>u.email);
  window._flUsuariosDirectorio=usuarios;
  return`
    <div style="font-size:12px;color:#64748B;margin-bottom:12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 14px">
      <strong style="color:#C2410C">Nota:</strong> Combina el directorio de la app móvil (<code>fl_usuarios</code>), el registro de uso de vehículos, responsables asignados a ECOs y quienes han creado solicitudes desde el portal. Los que solo aparecen como "Responsable de ECO" casi nunca tienen correo detectado porque ese campo solo guarda el nombre.
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <span style="font-size:11.5px;font-weight:700;color:#374151">${usuarios.length} personas detectadas · ${conEmail.length} con correo</span>
      <div style="display:flex;gap:8px">
        <button class="fb gho sm" onclick="admRevisarSync()">${I.check} Revisar sincronización</button>
        <button class="fb gho sm" onclick="admCopiarCorreosFlotilla()">Copiar correos</button>
      </div>
    </div>
    <div class="fl-tw" style="overflow:auto;max-height:220px;margin-bottom:20px">
      <table class="fl-adm-table">
        <thead><tr><th>Nombre</th><th>Email detectado</th><th>Fuente</th><th>ECOs asignados</th><th style="text-align:center">Acción</th></tr></thead>
        <tbody>
          ${usuarios.length?usuarios.map(u=>`
            <tr>
              <td style="font-weight:700">${u.nombre}</td>
              <td style="font-size:11px;font-family:'JetBrains Mono',monospace;color:${u.email?'#0A1628':'#CBD5E1'}">${u.email||'sin correo'}</td>
              <td style="font-size:10px;color:#64748B">${[...u.fuentes].join(' · ')}</td>
              <td style="font-size:11px">${u.ecos.length?u.ecos.map(e=>`<span style="background:#EFF6FF;color:#2563EB;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:700;margin-right:3px">ECO ${e}</span>`).join(''):'Sin ECO'}</td>
              <td style="text-align:center">
                <button class="fb gho sm" onclick="admPreReasignar('${u.nombre.replace(/'/g,"\'")}','${u.email}')" style="font-size:10px">${I.edit} Reasignar</button>
              </td>
            </tr>`).join(''):`<tr><td colspan="5" style="text-align:center;padding:24px;color:#94A3B8">No hay datos</td></tr>`}
        </tbody>
      </table>
    </div>
    <div style="font-size:14px;font-weight:800;color:#0A1628;margin-bottom:12px">Reasignar ECO a responsable</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;max-width:780px">
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Nombre responsable</label>
        <input id="adm-ur-nombre" placeholder="Nombre completo" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">ECO a asignar</label>
        <select id="adm-ur-eco" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none">
          <option value="">— Seleccionar ECO —</option>
          ${flV.map(v=>`<option value="${v.eco}">ECO ${v.eco} — ${v.unidad||''} ${v.responsable&&v.responsable!=='—'?'('+v.responsable+')':'' }</option>`).join('')}
        </select>
      </div>
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Plaza</label>
        <input id="adm-ur-plaza" placeholder="Ej: CHIHUAHUA" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;outline:none;box-sizing:border-box">
      </div>
      <button onclick="admReasignarEco()" class="fb acc" style="padding:10px 16px;white-space:nowrap">Asignar</button>
    </div>
    <div id="adm-ur-msg" style="margin-top:10px;font-size:12px;display:none"></div>`;
}
function renderAdmRows(lista){
  if(!lista.length)return`<tr><td colspan="13" style="text-align:center;padding:24px;color:#94A3B8">Sin vehículos que mostrar</td></tr>`;
  return lista.map(v=>{
    const isEditing=admEditId===v.id;
    const statCls={activo:'fl-adm-stat-activo',taller:'fl-adm-stat-taller',comision:'fl-adm-stat-comision',baja:'fl-adm-stat-baja'}[v.status||'activo']||'fl-adm-stat-activo';
    const hD=f=>(!f||f==='—')?null:Math.round((new Date(f)-new Date())/864e5);
    const d=hD(v.pv);
    const pvColor=d===null?'#0A0F1E':d<0?'#B91C1C':d<90?'#B45309':'#15803D';
    if(isEditing){
      return`<tr class="editing" id="adm-row-${v.id}">
        <td><strong style="font-family:'JetBrains Mono',monospace">${v.eco}</strong></td>
        <td><input class="fl-adm-inp" id="adm-unidad-${v.id}" value="${v.unidad||''}"></td>
        <td><input class="fl-adm-inp" id="adm-placas-${v.id}" value="${v.placas||''}"></td>
        <td><input class="fl-adm-inp" id="adm-resp-${v.id}" value="${v.responsable||''}"></td>
        <td><input class="fl-adm-inp" id="adm-plaza-${v.id}" value="${v.plaza||''}"></td>
        <td><select class="fl-adm-sel" id="adm-status-${v.id}">
          <option ${(v.status||'activo')==='activo'?'selected':''}>activo</option>
          <option ${v.status==='taller'?'selected':''}>taller</option>
          <option ${v.status==='comision'?'selected':''}>comision</option>
          <option ${v.status==='baja'?'selected':''}>baja</option>
        </select></td>
        <td><input class="fl-adm-inp" type="number" id="adm-km-${v.id}" value="${v.km||0}" style="width:80px"></td>
        <td><input class="fl-adm-inp" id="adm-nip-${v.id}" value="${v.nip||''}"></td>
        <td><input class="fl-adm-inp" id="adm-pol-${v.id}" value="${v.pol||''}"></td>
        <td><input class="fl-adm-inp" type="date" id="adm-pv-${v.id}" value="${v.pv&&v.pv!=='—'?v.pv:''}" style="width:130px"></td>
        <td><input class="fl-adm-inp" id="adm-color-${v.id}" value="${v.color||''}"></td>
        <td><select class="fl-adm-sel" id="adm-tipo-${v.id}" style="width:100px">
          <option ${v.tipo==='auto'?'selected':''}>auto</option>
          <option ${v.tipo==='camioneta'?'selected':''}>camioneta</option>
          <option ${v.tipo==='camion'?'selected':''}>camion</option>
          <option ${v.tipo==='maquinaria'?'selected':''}>maquinaria</option>
        </select></td>
        <td style="text-align:center">
          <div style="display:flex;gap:4px;justify-content:center">
            <button class="fb acc sm" onclick="admGuardar('${v.id}')" title="Guardar">${I.check}</button>
            <button class="fb gho sm" onclick="admCancelar()" title="Cancelar">${I.x}</button>
          </div>
        </td>
      </tr>`;
    }
    return`<tr id="adm-row-${v.id}">
      <td><strong style="font-family:'JetBrains Mono',monospace;font-size:13px">${v.eco}</strong></td>
      <td style="font-weight:600">${v.unidad||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${v.placas||'—'}</td>
      <td>${v.responsable&&v.responsable!=='—'?v.responsable:`<span style="color:#EF4444;font-size:11px;font-weight:700">Sin asignar</span>`}</td>
      <td><span style="font-size:11px">${v.plaza||'—'}</span></td>
      <td><span class="fl-adm-badge ${statCls}">${v.status||'activo'}</span></td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:11px">${v.km||0} km</td>
      <td style="font-size:11px">${v.nip||'—'}</td>
      <td style="font-family:'JetBrains Mono',monospace;font-size:10px">${v.pol||'—'}</td>
      <td style="font-size:11px;font-weight:700;color:${pvColor}">${v.pv&&v.pv!=='—'?v.pv:'—'}</td>
      <td style="font-size:11px">${v.color||'—'}</td>
      <td style="font-size:11px">${v.tipo||'—'}</td>
      <td style="text-align:center">
        <button class="fb gho sm" onclick="admEditar('${v.id}')" title="Editar">${I.edit}</button>
      </td>
    </tr>`;
  }).join('');
}

// EDITAR FILA
window.admEditar=function(id){
  admEditId=id;
  const tbody=document.getElementById('adm-tbody');
  if(!tbody)return;
  // Re-render solo las filas filtradas
  const lista=admGetFiltrado();
  tbody.innerHTML=renderAdmRows(lista);
  // Mostrar botón guardar todo
  const btn=document.getElementById('adm-btn-save');if(btn)btn.style.display='';
  // Focus en responsable
  setTimeout(()=>document.getElementById('adm-resp-'+id)?.focus(),100);
};

window.admCancelar=function(){
  admEditId=null;
  const lista=admGetFiltrado();
  const tbody=document.getElementById('adm-tbody');
  if(tbody)tbody.innerHTML=renderAdmRows(lista);
  const btn=document.getElementById('adm-btn-save');if(btn)btn.style.display='none';
};

// GUARDAR UN VEHÍCULO
window.admGuardar=async function(id){
  const v=flV.find(x=>x.id===id);if(!v)return;
  const respAnterior=v.responsable;
  const nuevos={
    unidad:document.getElementById('adm-unidad-'+id)?.value?.trim()||v.unidad,
    placas:document.getElementById('adm-placas-'+id)?.value?.trim()||v.placas,
    responsable:document.getElementById('adm-resp-'+id)?.value?.trim()||v.responsable,
    plaza:document.getElementById('adm-plaza-'+id)?.value?.trim()||v.plaza,
    status:document.getElementById('adm-status-'+id)?.value||v.status,
    km:Number(document.getElementById('adm-km-'+id)?.value)||v.km||0,
    nip:document.getElementById('adm-nip-'+id)?.value?.trim()||v.nip||'',
    pol:document.getElementById('adm-pol-'+id)?.value?.trim()||v.pol||'',
    pv:document.getElementById('adm-pv-'+id)?.value||v.pv||'—',
    color:document.getElementById('adm-color-'+id)?.value?.trim()||v.color||'',
    tipo:document.getElementById('adm-tipo-'+id)?.value||v.tipo||'auto',
  };
  // Actualizar local
  Object.assign(v,nuevos);
  // Guardar en Firestore
  try{
    if(!id.startsWith('eco-')){
      await fs.updateDoc(fs.doc(db,C.VEHS,id),{...nuevos,actualizadoEn:new Date().toISOString(),actualizadoPor:window.auth?.currentUser?.email||''});
    } else {
      // Vehículo del catálogo — crear documento en Firestore
      const docRef=await fs.addDoc(fs.collection(db,C.VEHS),{...v,...nuevos,eco:v.eco,año:v.año,serie:v.serie,rend:v.rend,creadoEn:new Date().toISOString()});
      v.id=docRef.id;
    }
    if(nuevos.responsable&&nuevos.responsable!==respAnterior){
      flDesvincularEcoApp(v.eco,nuevos.responsable);
    }
    admEditId=null;
    renderSB();
    if(window.mostrarPush)window.mostrarPush('Vehículo actualizado','ECO '+v.eco+' guardado correctamente','✓');
  }catch(e){
    console.error('[ADMIN]',e);
    if(window.mostrarPush)window.mostrarPush('Error al guardar',e.message,'✗');
  }
  const lista=admGetFiltrado();
  const tbody=document.getElementById('adm-tbody');
  if(tbody)tbody.innerHTML=renderAdmRows(lista);
  const btn=document.getElementById('adm-btn-save');if(btn)btn.style.display='none';
};

// GUARDAR TODOS LOS PENDIENTES
window.admGuardarTodo=async function(){
  if(admEditId)await admGuardar(admEditId);
};

// FILTRAR
function admGetFiltrado(){
  let res=flV;
  if(admFiltro){
    const q=admFiltro.toLowerCase();
    res=res.filter(v=>(v.eco+v.unidad+v.responsable+v.placas+v.serie+'').toLowerCase().includes(q));
  }
  if(admFiltroPlaza)res=res.filter(v=>v.plaza===admFiltroPlaza);
  if(admFiltroStatus==='ocupado') res=res.filter(v=>!!(window._flUsuariosMap||{})[String(v.eco)]);
  else if(admFiltroStatus==='libre') res=res.filter(v=>!(window._flUsuariosMap||{})[String(v.eco)]);
  else if(admFiltroStatus) res=res.filter(v=>(v.status||'activo')===admFiltroStatus);
  return res;
}

window.admFiltrar=function(){
  admFiltro=document.getElementById('adm-q')?.value||'';
  admFiltroPlaza=document.getElementById('adm-plaza')?.value||'';
  admFiltroStatus=document.getElementById('adm-status')?.value||'';
  admEditId=null;
  const lista=admGetFiltrado();
  const tbody=document.getElementById('adm-tbody');
  if(tbody)tbody.innerHTML=renderAdmRows(lista);
  const cnt=document.getElementById('adm-count');
  if(cnt)cnt.textContent=lista.length+' vehículos';
};

window.admLimpiarFiltros=function(){
  admFiltro='';admFiltroPlaza='';admFiltroStatus='';
  const q=document.getElementById('adm-q');if(q)q.value='';
  const p=document.getElementById('adm-plaza');if(p)p.value='';
  const s=document.getElementById('adm-status');if(s)s.value='';
  admFiltrar();
};

// EXPORTAR CSV
window.admExportar=function(){
  const cols=['ECO','Unidad','Placas','Responsable','Plaza','Estatus','KM','NIP','Póliza','Vto.Póliza','Color','Tipo','Serie','Año','Rendimiento'];
  const rows=flV.map(v=>[v.eco,v.unidad||'',v.placas||'',v.responsable||'',v.plaza||'',v.status||'activo',v.km||0,v.nip||'',v.pol||'',v.pv||'',v.color||'',v.tipo||'',v.serie||'',v.año||'',v.rend||'']);
  const csv=[cols,...rows].map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`flotilla_tecnocontrol_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  if(window.mostrarPush)window.mostrarPush('CSV exportado','flotilla_tecnocontrol_'+new Date().toISOString().slice(0,10)+'.csv','✓');
};

// ── ACCIONES NUEVAS DEL PANEL ADMIN ──

// Filtros de solicitudes (tab Solicitudes)
window.admSolFiltrar=function(){
  window._admSolFiltro=document.getElementById('adms-est')?.value||'';
  window._admSolQ=document.getElementById('adms-q')?.value||'';
  const content=document.getElementById('adm-tab-content');
  if(content)content.innerHTML=rAdmTabSols();
};
window.admSolLimpiar=function(){
  window._admSolFiltro='';window._admSolQ='';
  const content=document.getElementById('adm-tab-content');
  if(content)content.innerHTML=rAdmTabSols();
};

// Eliminar solicitud con confirmación
window.admElimSol=async function(id){
  if(!confirm('¿Eliminar esta solicitud permanentemente? Esta acción no se puede deshacer.'))return;
  try{
    if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
    await fs.deleteDoc(fs.doc(db,C.SOLS,id));
    const idx=flS.findIndex(s=>s.id===id);
    if(idx>=0)flS.splice(idx,1);
    if(window.mostrarPush)window.mostrarPush('Solicitud eliminada','Registro eliminado correctamente','✓');
    const content=document.getElementById('adm-tab-content');
    if(content)content.innerHTML=rAdmTabSols();
  }catch(e){
    console.error('[ADMIN]',e);
    if(window.mostrarPush)window.mostrarPush('Error',e.message,'✗');
  }
};

// Libera en la app móvil a cualquier técnico vinculado a este ECO.
// Se llama cada vez que el portal cambia el "responsable" de un vehículo,
// para que el ECO quede libre de inmediato en la app del técnico anterior.
async function flDesvincularEcoApp(eco,nuevoResponsable){
  if(!eco)return;
  try{
    if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
    const ecoStr=String(eco);
    const ahora=new Date().toISOString();
    const porEmail=window.auth?.currentUser?.email||'';
    // Cierra el registro de historial de uso (vinculación/desvinculación) abierto para este ECO
    flCerrarUsoAbierto(ecoStr,'Reasignado a '+(nuevoResponsable||'otro responsable')+' desde administración de flotilla',porEmail);
    const snapU=await fs.getDocs(fs.collection(db,'fl_usuarios'));
    const ops=[];
    snapU.docs.forEach(d=>{
      const u=d.data();
      const ecosArr=Array.isArray(u.ecosVinculados)?u.ecosVinculados.map(String):[];
      const ligadoSimple=String(u.ecoVinculado||'')===ecoStr;
      const ligadoArr=ecosArr.includes(ecoStr);
      if(!ligadoSimple&&!ligadoArr)return;
      ops.push(fs.updateDoc(d.ref,{
        ecoVinculado:ligadoSimple?null:(u.ecoVinculado||null),
        ecosVinculados:ecosArr.filter(e=>e!==ecoStr),
        desvinculadoEn:ahora,
        desvinculadoPor:porEmail,
        motivoDesvinculacion:'Reasignado a '+(nuevoResponsable||'otro responsable')+' desde administración de flotilla',
      }));
      if(u.email){
        ops.push(fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
          para:u.email,
          vehiculoEco:ecoStr,
          tipo:'eco_desvinculado',
          mensaje:'El ECO '+ecoStr+' fue reasignado por el administrador. Selecciona tu vehículo nuevamente en la app.',
          leido:false,
          creadaEn:ahora,
        }));
      }
    });
    if(ops.length)await Promise.all(ops);
  }catch(e){console.error('[FL] flDesvincularEcoApp',e);}
}

// Cierra en flotilla_usos el/los registro(s) de vinculación abiertos (activo:true) para un ECO.
// Se usa cuando el admin reasigna el responsable desde el portal.
async function flCerrarUsoAbierto(eco,motivo,porEmail){
  try{
    if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
    const q=fs.query(fs.collection(db,C.USOS),fs.where('eco','==',String(eco)),fs.where('activo','==',true));
    const snap=await fs.getDocs(q);
    if(snap.empty)return;
    const ahora=new Date().toISOString();
    await Promise.all(snap.docs.map(d=>fs.updateDoc(d.ref,{desvinculadoEn:ahora,activo:false,motivo:motivo||'Desvinculado',desvinculadoPor:porEmail||''})));
    await ldUsos();
  }catch(e){console.error('[FL] flCerrarUsoAbierto',e);}
}

// Sincroniza el status del vehículo con el estado de sus solicitudes.
//  nuevoStatus==='taller'  -> entra a taller, guarda statusPrevio (respeta comisión/activo)
//  nuevoStatus==='activo'  -> cierre/rechazo: revierte SOLO si no queda otra solicitud
//                             abierta en Servicio/Pagos/Cierre para ese ECO; restaura statusPrevio
//  solicitudIdExcluir      -> id de la solicitud que se está cerrando (para no contarse a sí misma)
//  Nunca toca vehículos en 'baja'.
async function flSyncVehiculoServicio(eco,nuevoStatus,solicitudIdExcluir){
  if(!eco)return;
  try{
    if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
    const snap=await fs.getDocs(fs.query(fs.collection(db,C.VEHS),fs.where('eco','==',String(eco))));
    if(snap.empty)return;
    const d=snap.docs[0];
    const dv=d.data();
    const actual=dv.status;
    if(actual==='baja')return; // nunca tocar bajas

    if(nuevoStatus==='taller'){
      if(actual==='taller')return;
      await fs.updateDoc(d.ref,{status:'taller',statusPrevio:actual||'activo',actualizadoEn:new Date().toISOString()});
    }else{
      // Revertir: verificar que no quede OTRA solicitud abierta en taller para este ECO
      const abiertas=(typeof flS!=='undefined'?flS:[]).filter(x=>
        String(x.vehiculoEco)===String(eco)&&
        x.id!==solicitudIdExcluir&&
        ['Servicio','Pagos','Cierre'].includes(x.estatus)
      );
      if(abiertas.length)return; // sigue en taller por otro servicio
      const destino=(dv.statusPrevio&&dv.statusPrevio!=='taller')?dv.statusPrevio:'activo';
      await fs.updateDoc(d.ref,{status:destino,statusPrevio:'',actualizadoEn:new Date().toISOString()});
    }
  }catch(e){console.error('[FL] flSyncVehiculoServicio',e);}
}

// Utilidad de consola: reconcilia TODA la flota de una vez con el estado real
// de las solicitudes (para arreglar datos legacy sin esperar nuevas transiciones).
// Uso: flReconciliarTaller()
window.flReconciliarTaller=async function(){
  if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
  const ecosConServicio=new Set(flS.filter(s=>['Servicio','Pagos','Cierre'].includes(s.estatus)).map(s=>String(s.vehiculoEco)));
  let aTaller=0,aActivo=0;
  for(const v of flV){
    if(v.status==='baja')continue;
    const debeTaller=ecosConServicio.has(String(v.eco));
    if(debeTaller&&v.status!=='taller'){await flSyncVehiculoServicio(v.eco,'taller');aTaller++;}
    else if(!debeTaller&&v.status==='taller'){await flSyncVehiculoServicio(v.eco,'activo');aActivo++;}
  }
  console.log(`[FL] Reconciliación taller: ${aTaller} → taller, ${aActivo} → activo/previo`);
  if(typeof ldSols==='function')await ldSols();
  if(typeof flToast==='function')flToast(`Taller reconciliado: +${aTaller} taller, ${aActivo} liberados`,'ok');
};

// Guardar nuevo vehículo
window.admNuevoGuardar=async function(){
  const g=id=>document.getElementById(id)?.value?.trim()||'';
  const eco=g('adm-nv-eco');
  if(!eco){document.getElementById('adm-nv-eco').style.borderColor='#EF4444';return;}
  if(!g('adm-nv-unidad')){document.getElementById('adm-nv-unidad').style.borderColor='#EF4444';return;}
  const msg=document.getElementById('adm-nv-msg');
  if(msg){msg.style.display='';msg.style.color='#2563EB';msg.textContent='Verificando...';}
  // GUARD: evitar duplicados — si ya existe un doc con este ECO, actualizar en vez de crear
  const existente=flV.find(x=>String(x.eco)===String(eco)&&!x.id.startsWith('eco-'));
  if(existente){
    if(msg){msg.style.color='#EF4444';msg.textContent='Ya existe un vehículo con ECO '+eco+' (ID: '+existente.id+'). Usa la tabla para editarlo.';}
    document.getElementById('adm-nv-eco').style.borderColor='#EF4444';
    return;
  }
  const doc={
    eco,unidad:g('adm-nv-unidad'),año:Number(g('adm-nv-año'))||0,
    placas:g('adm-nv-placas'),serie:g('adm-nv-serie'),
    responsable:g('adm-nv-resp')||'—',plaza:g('adm-nv-plaza'),
    color:g('adm-nv-color'),nip:g('adm-nv-nip'),pol:g('adm-nv-pol'),
    pv:g('adm-nv-pv')||'—',rend:g('adm-nv-rend')||'—',
    tipo:document.getElementById('adm-nv-tipo')?.value||'camioneta',
    status:document.getElementById('adm-nv-status')?.value||'activo',
    km:0,creadoEn:new Date().toISOString(),
    creadoPor:window.auth?.currentUser?.email||'',
  };
  try{
    if(msg)msg.textContent='Guardando...';
    const ref=await fs.addDoc(fs.collection(db,C.VEHS),doc);
    flV.push({id:ref.id,...doc});
    renderSB();
    if(msg){msg.style.color='#16A34A';msg.textContent='Vehículo registrado. ECO '+eco+' agregado a la flotilla.';}
    if(window.mostrarPush)window.mostrarPush('Vehículo agregado','ECO '+eco+' registrado en flotilla','✓');
    admNuevoLimpiar();
  }catch(e){
    console.error('[ADMIN]',e);
    if(msg){msg.style.color='#EF4444';msg.textContent='Error: '+e.message;}
  }
};
window.admNuevoLimpiar=function(){
  ['adm-nv-eco','adm-nv-unidad','adm-nv-año','adm-nv-placas','adm-nv-serie','adm-nv-resp','adm-nv-plaza','adm-nv-color','adm-nv-nip','adm-nv-pol','adm-nv-pv','adm-nv-rend'].forEach(id=>{
    const el=document.getElementById(id);if(el){el.value='';el.style.borderColor='#E2E8F0';}
  });
};

// Pre-llenar formulario de reasignación al hacer clic en "Reasignar"
// ── DETECCIÓN Y CORRECCIÓN MASIVA: 'Responsable Asignado' desincronizado ──
// Quién tiene vinculado un ECO AHORA MISMO, según fl_usuarios — la misma
// fuente que ya usa el propio sidebar para el punto verde / tooltip "En uso".
// Es más confiable que flotilla_usos porque existen vinculaciones vivas que
// nunca generaron un registro de bitácora (vínculos de antes de que existiera
// esa colección, o hechos por rutas que no la escriben).
function flQuienUsaEcoAhora(eco){
  const u=flFlUsuarios.find(u=>String(u.ecoVinculado)===String(eco)||(Array.isArray(u.ecosVinculados)&&u.ecosVinculados.map(String).includes(String(eco))));
  return u?(u.nombre||u.displayName||u.email||'—'):null;
}

// Detecta vehículos donde 'responsable' no coincide con la realidad, usando
// dos fuentes en orden de confianza: 1) vinculación viva en fl_usuarios,
// 2) si no hay nadie vinculado ahora, el historial de flotilla_usos confirma
// que debería estar libre. Los que nunca han tocado ninguna de las dos cosas
// se dejan intactos — para ellos 'responsable' sigue siendo la única fuente
// de verdad y no hay nada que corregir.
function flDetectarDesincronizados(){
  const out=[];
  flV.forEach(v=>{
    const vivo=flQuienUsaEcoAhora(v.eco);
    const usosVeh=flUsos.filter(u=>String(u.eco)===String(v.eco));
    let esperado;
    if(vivo!==null)esperado=vivo;
    else if(usosVeh.length)esperado='—';
    else return; // nunca pasó por la app ni está vinculado — no se toca
    const actual=(v.responsable||'—').trim();
    if(actual.toLowerCase()!==String(esperado).trim().toLowerCase()){
      out.push({vehId:v.id,eco:v.eco,unidad:v.unidad||'—',actual,esperado});
    }
  });
  return out;
}

window.admRevisarSync=function(){
  const mismatches=flDetectarDesincronizados();
  const ov=document.createElement('div');
  ov.className='fl-ov';ov.id='fl-sync-ov';
  ov.innerHTML=`
    <div class="fl-modal" style="max-width:640px">
      <div class="fl-mh">
        <h3>Revisar sincronización de responsables</h3>
        <button class="fl-mx" onclick="document.getElementById('fl-sync-ov').remove()">✕</button>
      </div>
      <div style="padding:16px 20px">
        ${mismatches.length?`
        <div style="font-size:12px;color:#64748B;margin-bottom:12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 14px">
          Se encontraron <strong style="color:#C2410C">${mismatches.length}</strong> vehículo${mismatches.length===1?'':'s'} donde el responsable asignado no coincide con quién está realmente vinculado hoy. Desmarca los que NO quieras corregir.
        </div>
        <div class="fl-tw" style="overflow:auto;max-height:340px;margin-bottom:16px">
          <table class="fl-adm-table">
            <thead><tr><th style="width:26px"></th><th>ECO / Unidad</th><th>Actual</th><th>Debería ser</th></tr></thead>
            <tbody>
              ${mismatches.map((m,i)=>`
                <tr>
                  <td><input type="checkbox" checked id="fl-sync-chk-${i}" data-idx="${i}" style="cursor:pointer"></td>
                  <td style="font-size:11.5px"><strong>ECO ${m.eco}</strong><br><span style="color:#94A3B8;font-size:10px">${m.unidad}</span></td>
                  <td style="font-size:11px;color:#B91C1C;text-decoration:line-through">${m.actual}</td>
                  <td style="font-size:11px;color:#15803D;font-weight:700">${m.esperado}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="fb gho sm" onclick="document.getElementById('fl-sync-ov').remove()">Cancelar</button>
          <button class="fb acc" id="fl-sync-apply" onclick="admAplicarSync(${JSON.stringify(mismatches).replace(/"/g,'&quot;')})">Aplicar correcciones</button>
        </div>`
        :`<div class="fl-empty" style="min-height:120px"><h3>Todo sincronizado</h3><p style="font-size:12px;color:#94A3B8">No se encontró ningún vehículo con historial de uso cuyo responsable esté desactualizado.</p></div>`}
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)ov.remove();};
};

window.admAplicarSync=async function(mismatches){
  const btn=document.getElementById('fl-sync-apply');
  const seleccionados=mismatches.filter((_,i)=>document.getElementById('fl-sync-chk-'+i)?.checked);
  if(!seleccionados.length){alert('No hay ninguno seleccionado.');return;}
  if(btn){btn.disabled=true;btn.textContent='Aplicando…';}
  const resultados=await Promise.allSettled(seleccionados.map(m=>fs.updateDoc(fs.doc(db,C.VEHS,m.vehId),{responsable:m.esperado})));
  const ok=[],fallidos=[];
  resultados.forEach((r,i)=>{
    if(r.status==='fulfilled')ok.push(seleccionados[i]);
    else fallidos.push({...seleccionados[i],error:r.reason?.message||'Error desconocido'});
  });
  await ldVehs();
  document.getElementById('fl-sync-ov')?.remove();
  if(typeof rAdmin==='function')rAdmin();
  if(!fallidos.length){
    alert(`${ok.length} vehículo${ok.length===1?'':'s'} corregido${ok.length===1?'':'s'}.`);
  }else{
    const detalle=fallidos.map(f=>`• ECO ${f.eco} (${f.unidad}) — el documento ya no existe en Firestore`).join('\n');
    alert(`${ok.length} corregido${ok.length===1?'':'s'} correctamente.\n\n${fallidos.length} NO se pudieron corregir (documento eliminado o inexistente):\n${detalle}\n\nEstos probablemente son vehículos de prueba borrados manualmente, y ya no aparecerán en la lista de vehículos activos.`);
  }
};

window.admCopiarCorreosFlotilla=function(){
  const dir=window._flUsuariosDirectorio||[];
  const correos=[...new Set(dir.map(u=>u.email).filter(Boolean))];
  if(!correos.length){alert('No hay correos detectados todavía.');return;}
  const texto=correos.join(', ');
  const hecho=()=>{const b=event?.target;if(b){const t=b.textContent;b.textContent='Copiado ✓';setTimeout(()=>b.textContent=t,1600);}};
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(texto).then(hecho).catch(()=>alert(texto));
  }else{
    const ta=document.createElement('textarea');ta.value=texto;document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');hecho();}catch{alert(texto);}
    ta.remove();
  }
};

window.admPreReasignar=function(nombre,email){
  const n=document.getElementById('adm-ur-nombre');
  if(n){n.value=nombre;n.scrollIntoView({behavior:'smooth',block:'center'});}
};

// Reasignar ECO a responsable
window.admReasignarEco=async function(){
  const nombre=(document.getElementById('adm-ur-nombre')?.value||'').trim();
  const eco=(document.getElementById('adm-ur-eco')?.value||'').trim();
  const plaza=(document.getElementById('adm-ur-plaza')?.value||'').trim();
  const msg=document.getElementById('adm-ur-msg');
  if(!nombre||!eco){
    if(msg){msg.style.display='';msg.style.color='#EF4444';msg.textContent='Completa el nombre y selecciona un ECO.';}
    return;
  }
  if(msg){msg.style.display='';msg.style.color='#2563EB';msg.textContent='Guardando...';}
  const v=flV.find(x=>String(x.eco)===String(eco));
  if(!v){if(msg){msg.style.color='#EF4444';msg.textContent='ECO no encontrado.';}return;}
  const respAnterior=v.responsable;
  const upd={responsable:nombre};
  if(plaza)upd.plaza=plaza;
  Object.assign(v,upd);
  try{
    if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
    if(!v.id.startsWith('eco-')){
      await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{...upd,actualizadoEn:new Date().toISOString()});
    } else {
      const ref=await fs.addDoc(fs.collection(db,C.VEHS),{...v,...upd,creadoEn:new Date().toISOString()});
      v.id=ref.id;
    }
    if(nombre!==respAnterior){
      flDesvincularEcoApp(eco,nombre);
    }
    renderSB();
    if(msg){msg.style.color='#16A34A';msg.textContent='ECO '+eco+' asignado a '+nombre+' correctamente.';}
    if(window.mostrarPush)window.mostrarPush('ECO reasignado','ECO '+eco+' → '+nombre,'✓');
    ['adm-ur-nombre','adm-ur-plaza'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const sel=document.getElementById('adm-ur-eco');if(sel)sel.value='';
    // Refrescar tabla de usuarios
    const content=document.getElementById('adm-tab-content');
    if(content&&admTab==='usuarios')content.innerHTML=rAdmTabUsuarios();
  }catch(e){
    console.error('[ADMIN]',e);
    if(msg){msg.style.color='#EF4444';msg.textContent='Error: '+e.message;}
  }
};

// ── PANEL GENERAL ──
let flPanelMes='all'; // filtro de periodo para "Solicitudes y actividad" del dashboard

function rPanel(){
  const act=flV.filter(v=>v.status==='activo'||!v.status).length;
  const tall=flV.filter(v=>v.status==='taller').length;
  const com=flV.filter(v=>v.status==='comision').length;
  const baj=flV.filter(v=>v.status==='baja').length;
  const flSPeriodo=flPanelMes==='all'?flS:flS.filter(s=>(s.creadoEn||'').slice(0,7)===flPanelMes);
  const pend=flSPeriodo.filter(s=>!['Cerrada','Rechazada'].includes(s.estatus)).length;
  const porEst={Solicitud:0,'Evaluación':0,Servicio:0,Rechazada:0,Cerrada:0};
  const normPorEst={
    'Validación':'Evaluación','Validada':'Evaluación','Cotización':'Evaluación','Aprobación':'Evaluación','Aprobada':'Evaluación',
    'Pagos':'Servicio','Cierre':'Servicio'
  };
  flSPeriodo.forEach(s=>{const k=normPorEst[s.estatus]||s.estatus;if(k in porEst)porEst[k]++;});
  const porTipo={};flSPeriodo.forEach(s=>{const t=s.tipo||'Otro';porTipo[t]=(porTipo[t]||0)+1;});
  const top=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const mx=top[0]?.[1]||1;

  const activos=flV.filter(v=>v.status==='activo').length;
  const enTaller=flV.filter(v=>v.status==='taller').length;
  const enComision=flV.filter(v=>v.status==='comision').length;
  const sinResponsable=flV.filter(v=>v.status!=='baja'&&(!v.responsable||v.responsable==='—'));
  const ocupadosApp=window._flUsuariosMap||{};
  const libresAhora=flV.filter(v=>v.status==='activo'&&!ocupadosApp[String(v.eco)]).length;
  const vencidas=flV.filter(v=>{const d=hD(v.pv);return d!==null&&d<0;});
  const porVencer=flV.filter(v=>{const d=hD(v.pv);return d!==null&&d>=0&&d<30;});
  const solPorEst=(e)=>flSPeriodo.filter(s=>s.estatus===e||(e==='Evaluación'&&['Validación','Validada','Cotización','Aprobación','Aprobada'].includes(s.estatus))||(e==='Servicio'&&['Pagos','Cierre'].includes(s.estatus))).length;

  // Vehículos que realmente necesitan atención hoy (taller, sin responsable, póliza vencida/por vencer)
  const atencionMap=new Map();
  const marcar=(v,texto,tono)=>{
    if(!atencionMap.has(v.id))atencionMap.set(v.id,{v,motivos:[]});
    atencionMap.get(v.id).motivos.push({texto,tono});
  };
  flV.filter(v=>v.status==='taller').forEach(v=>marcar(v,'En taller','warn'));
  sinResponsable.forEach(v=>marcar(v,'Sin responsable','bad'));
  vencidas.forEach(v=>marcar(v,'Póliza vencida','bad'));
  porVencer.forEach(v=>marcar(v,`Póliza vence en ${hD(v.pv)} días`,'warn'));
  flV.forEach(v=>{
    const s=flServicioEstado(v);
    if(!s)return;
    if(s.estado==='vencido')marcar(v,`Servicio vencido (${Math.abs(s.faltan)} km)`,'bad');
    else if(s.estado==='proximo')marcar(v,`Servicio en ${s.faltan} km`,'warn');
  });
  flV.forEach(v=>{
    const llantasVeh=flLlantas.filter(l=>l.vehiculoId===v.id);
    llantasVeh.forEach(ll=>{
      const alts=flLlantaAlertas(ll,v.km);
      if(alts.some(a=>a.tono==='bad'))marcar(v,`Llanta ${ll.posicion||''}: ${alts.find(a=>a.tono==='bad').t}`,'bad');
    });
  });
  flDetectarEcoDuplicados().forEach(({eco,vehiculos})=>{
    vehiculos.forEach(v=>marcar(v,`ECO ${eco} duplicado`,'bad'));
  });
  const atencion=[...atencionMap.values()].slice(0,6);

  const heroKpi=(ico,val,label,tono)=>{
    const colores={good:'#5DCAA5',warn:'#FAC775',bad:'#F09595',neutral:'#7C93B8'};
    return`<div style="background:rgba(255,255,255,.06);border-radius:12px;padding:12px 14px">
      <div style="color:${colores[tono]||colores.neutral}">${ico}</div>
      <div style="font-size:22px;font-weight:900;color:#fff;margin-top:8px">${val}</div>
      <div style="font-size:11px;color:#7C93B8;margin-top:2px">${label}</div>
    </div>`;
  };
  const icoActivos=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM5 17l1.5-6h11L19 17"/></svg>`;
  const icoLibres=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>`;
  const icoTaller=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 015.4 5.4L13 19l-4 1 1-4 7.7-7.7a4 4 0 00-5.4-5.4L9 6.3l-4-1-1 4 3 3"/></svg>`;
  const icoSinResp=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="22" y2="13"/><line x1="22" y1="8" x2="17" y2="13"/></svg>`;
  const icoPoliza=`<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>`;

  setContent(padded(`
    <div style="background:#0A1628;border-radius:16px;padding:22px 24px;margin-bottom:20px">
      <div style="margin-bottom:16px">
        <div style="font-size:11px;color:#7C93B8;text-transform:uppercase;letter-spacing:.6px">Flotilla vehicular</div>
        <div style="font-size:19px;font-weight:900;color:#fff;margin-top:4px">${flV.filter(v=>v.status!=='baja').length} unidades · ${new Date().toLocaleDateString('es-MX',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px">
        ${heroKpi(icoActivos,activos,'Activos','good')}
        ${heroKpi(icoLibres,libresAhora,'Libres ahora','neutral')}
        ${heroKpi(icoTaller,enTaller,'En taller',enTaller>0?'warn':'good')}
        ${heroKpi(icoSinResp,sinResponsable.length,'Sin responsable',sinResponsable.length>0?'bad':'good')}
        ${heroKpi(icoPoliza,vencidas.length,'Pólizas vencidas',vencidas.length>0?'bad':'good')}
        ${heroKpi(icoPoliza,porVencer.length,'Pólizas por vencer',porVencer.length>0?'warn':'good')}
      </div>
    </div>

    <div onclick="flVista('mapa')" style="display:flex;align-items:center;gap:12px;padding:14px 18px;border:1px solid #E8EDF5;border-radius:12px;cursor:pointer;margin-bottom:22px;transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 2px 10px rgba(0,0,0,.06)'" onmouseout="this.style.boxShadow='none'">
      <div style="width:40px;height:40px;border-radius:10px;background:#EFF8FF;display:flex;align-items:center;justify-content:center;color:#0369A1;flex:0 0 auto">${I.mappin}</div>
      <div style="flex:1"><div style="font-size:13.5px;font-weight:800">Mapa en tiempo real</div><div style="font-size:11.5px;color:#64748B;margin-top:1px">${flUbicaciones.filter(u=>u.lat&&u.lng).length} vehículos con ubicación reportada</div></div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>

    ${atencion.length?`
    <div style="border-top:1px solid #F1F5F9;padding-top:22px;margin-bottom:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Solicitudes y actividad</div>
          <select onchange="flPanelMes=this.value;rPanel()" style="padding:4px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:10.5px;font-weight:700;color:#374151;background:#fff;cursor:pointer">
            <option value="all" ${flPanelMes==='all'?'selected':''}>Todo el historial</option>
            ${flMesesCumplimientoDisponibles().map(m=>`<option value="${m}" ${flPanelMes===m?'selected':''}>${flPanorMesLabel(m)}</option>`).join('')}
          </select>
        </div>
        <button onclick="flVista('calendario')" style="font-size:10.5px;font-weight:700;color:#64748B;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px">${I.calendar||''} Ver calendario</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">
        <div onclick="flPipelineModal('Solicitud')" style="background:#F5F3FF;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#6D28D9">${solPorEst('Solicitud')}</div><div style="font-size:11px;color:#6D28D9;margin-top:2px">Solicitud</div></div>
        <div onclick="flPipelineModal('Evaluación')" style="background:#EFF8FF;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#0369A1">${solPorEst('Evaluación')}</div><div style="font-size:11px;color:#0369A1;margin-top:2px">Evaluación</div></div>
        <div onclick="flPipelineModal('Servicio')" style="background:#FFFBEB;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#B45309">${solPorEst('Servicio')}</div><div style="font-size:11px;color:#B45309;margin-top:2px">Servicio</div></div>
        <div onclick="flPipelineModal('Rechazada')" style="background:#FEF2F2;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#B91C1C">${solPorEst('Rechazada')}</div><div style="font-size:11px;color:#B91C1C;margin-top:2px">Rechazadas</div></div>
        <div onclick="flPipelineModal('Cerrada')" style="background:#F0FDF4;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#15803D">${solPorEst('Cerrada')}</div><div style="font-size:11px;color:#15803D;margin-top:2px">Cerradas</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="fl-tw"><div style="padding:10px 14px;border-bottom:1px solid #F1F5F9;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Solicitudes por tipo</div>
          <div style="padding:12px 14px">${top.length?top.map(([t,n])=>`<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:3px"><span>${t}</span><span style="color:#64748B">${n}</span></div><div style="height:4px;background:#F1F5F9;border-radius:100px;overflow:hidden"><div style="height:100%;width:${Math.round(n/mx*100)}%;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:100px"></div></div></div>`).join(''):'<div style="color:#94A3B8;font-size:11px;text-align:center;padding:18px 0">Sin solicitudes aún</div>'}</div>
        </div>
        <div class="fl-tw"><div style="padding:10px 14px;border-bottom:1px solid #F1F5F9;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Flujo de solicitudes</div>
          <div style="padding:12px 14px;display:flex;flex-direction:column;gap:7px">${Object.entries(porEst).map(([e,n])=>`<div onclick="flPipelineModal('${e}')" style="display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:8px;padding:3px 5px;margin:-3px -5px;transition:background .12s" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background=''">${hBadge(e)}<div style="flex:1;height:4px;background:#F1F5F9;border-radius:100px;overflow:hidden"><div style="height:100%;width:${flS.length?Math.round(n/flS.length*100):0}%;background:#2563EB;border-radius:100px"></div></div><span style="font-size:11px;font-weight:700;min-width:14px;text-align:right">${n}</span>${n>0?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`:''}</div>`).join('')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8">Solicitudes activas</div>
        <button onclick="flPipelineModal('Cerrada')" style="font-size:9px;font-weight:700;color:#64748B;background:none;border:none;cursor:pointer;text-decoration:underline">Ver cerradas →</button>
      </div>
      ${tSols(flSPeriodo.filter(s=>!['Cerrada','Rechazada'].includes(s.estatus)).slice(0,8))}
    </div>

    <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:9px">Requieren atención (${atencionMap.size})</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:28px">
      ${atencion.map(({v,motivos})=>{
        const peor=motivos.some(m=>m.tono==='bad')?'bad':'warn';
        const tonos={bad:{bg:'#FEF2F2',ic:'#B91C1C'},warn:{bg:'#FFFBEB',ic:'#B45309'}};
        const t=tonos[peor];
        return`<div onclick="flSbSel('${v.id}')" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid #E8EDF5;border-radius:12px;cursor:pointer;transition:box-shadow .15s" onmouseover="this.style.boxShadow='0 2px 10px rgba(0,0,0,.06)'" onmouseout="this.style.boxShadow='none'">
          <div style="width:44px;height:44px;border-radius:10px;background:${t.bg};display:flex;align-items:center;justify-content:center;flex:0 0 auto;color:${t.ic}">${hEmo(v.tipo)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:800">ECO ${v.eco} · ${v.unidad||'—'}</div>
            <div style="font-size:12px;color:#64748B;margin-top:2px">${v.responsable&&v.responsable!=='—'?v.responsable:'Sin responsable asignado'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:220px">
            ${motivos.slice(0,2).map(m=>`<span style="font-size:10.5px;font-weight:700;padding:4px 10px;border-radius:100px;background:${tonos[m.tono].bg};color:${tonos[m.tono].ic};white-space:nowrap">${m.texto}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`:`<div style="border-top:1px solid #F1F5F9;padding-top:22px;margin-bottom:22px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Solicitudes y actividad</div>
          <select onchange="flPanelMes=this.value;rPanel()" style="padding:4px 8px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:10.5px;font-weight:700;color:#374151;background:#fff;cursor:pointer">
            <option value="all" ${flPanelMes==='all'?'selected':''}>Todo el historial</option>
            ${flMesesCumplimientoDisponibles().map(m=>`<option value="${m}" ${flPanelMes===m?'selected':''}>${flPanorMesLabel(m)}</option>`).join('')}
          </select>
        </div>
        <button onclick="flVista('calendario')" style="font-size:10.5px;font-weight:700;color:#64748B;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px">${I.calendar||''} Ver calendario</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">
        <div onclick="flPipelineModal('Solicitud')" style="background:#F5F3FF;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#6D28D9">${solPorEst('Solicitud')}</div><div style="font-size:11px;color:#6D28D9;margin-top:2px">Solicitud</div></div>
        <div onclick="flPipelineModal('Evaluación')" style="background:#EFF8FF;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#0369A1">${solPorEst('Evaluación')}</div><div style="font-size:11px;color:#0369A1;margin-top:2px">Evaluación</div></div>
        <div onclick="flPipelineModal('Servicio')" style="background:#FFFBEB;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#B45309">${solPorEst('Servicio')}</div><div style="font-size:11px;color:#B45309;margin-top:2px">Servicio</div></div>
        <div onclick="flPipelineModal('Rechazada')" style="background:#FEF2F2;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#B91C1C">${solPorEst('Rechazada')}</div><div style="font-size:11px;color:#B91C1C;margin-top:2px">Rechazadas</div></div>
        <div onclick="flPipelineModal('Cerrada')" style="background:#F0FDF4;border-radius:12px;padding:12px 14px;cursor:pointer"><div style="font-size:20px;font-weight:900;color:#15803D">${solPorEst('Cerrada')}</div><div style="font-size:11px;color:#15803D;margin-top:2px">Cerradas</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="fl-tw"><div style="padding:10px 14px;border-bottom:1px solid #F1F5F9;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Solicitudes por tipo</div>
          <div style="padding:12px 14px">${top.length?top.map(([t,n])=>`<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;font-size:11px;font-weight:600;margin-bottom:3px"><span>${t}</span><span style="color:#64748B">${n}</span></div><div style="height:4px;background:#F1F5F9;border-radius:100px;overflow:hidden"><div style="height:100%;width:${Math.round(n/mx*100)}%;background:linear-gradient(90deg,#2563EB,#7C3AED);border-radius:100px"></div></div></div>`).join(''):'<div style="color:#94A3B8;font-size:11px;text-align:center;padding:18px 0">Sin solicitudes aún</div>'}</div>
        </div>
        <div class="fl-tw"><div style="padding:10px 14px;border-bottom:1px solid #F1F5F9;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Flujo de solicitudes</div>
          <div style="padding:12px 14px;display:flex;flex-direction:column;gap:7px">${Object.entries(porEst).map(([e,n])=>`<div onclick="flPipelineModal('${e}')" style="display:flex;align-items:center;gap:8px;cursor:pointer;border-radius:8px;padding:3px 5px;margin:-3px -5px;transition:background .12s" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background=''">${hBadge(e)}<div style="flex:1;height:4px;background:#F1F5F9;border-radius:100px;overflow:hidden"><div style="height:100%;width:${flS.length?Math.round(n/flS.length*100):0}%;background:#2563EB;border-radius:100px"></div></div><span style="font-size:11px;font-weight:700;min-width:14px;text-align:right">${n}</span>${n>0?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>`:''}</div>`).join('')}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8">Solicitudes activas</div>
        <button onclick="flPipelineModal('Cerrada')" style="font-size:9px;font-weight:700;color:#64748B;background:none;border:none;cursor:pointer;text-decoration:underline">Ver cerradas →</button>
      </div>
      ${tSols(flSPeriodo.filter(s=>!['Cerrada','Rechazada'].includes(s.estatus)).slice(0,8))}
    </div>
    <div style="font-size:12px;color:#94A3B8">Ningún vehículo requiere atención inmediata en este momento.</div>`}
  `));
}

// ── CALENDARIO — pestaña propia (antes vivía al fondo del Panel General) ──
function rCalendarioVista(){
  setContent(padded(`
    <div style="font-size:18px;font-weight:900;letter-spacing:-.5px;margin-bottom:4px">Calendario de actividades</div>
    <div style="font-size:11.5px;color:#64748B;margin-bottom:18px">Solicitudes, pagos y visitas a taller por fecha</div>
    ${rFlCalendario()}
  `));
}

// ══════════════════════════════════════════════════════════════
// MAPA EN TIEMPO REAL — ubicación reportada por el teléfono de cada
// técnico (solo mientras la app móvil está abierta / al vincularse).
// Reutiliza Leaflet, que ya carga el portal para el módulo de Ventas.
// ══════════════════════════════════════════════════════════════
let flMapaLeaflet=null;
let flMapaMarcadores={};

function rMapaVista(){
  const conUbicacion=flUbicaciones.filter(u=>u.lat&&u.lng).length;
  setContent(padded(`
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.5px">Mapa en tiempo real</div>
        <div style="font-size:11.5px;color:#64748B;margin-top:3px">${conUbicacion} de ${flV.filter(v=>v.status!=='baja').length} vehículos con ubicación reportada</div>
      </div>
      <div style="font-size:10.5px;color:#94A3B8;background:#F8FAFD;border:1px solid #E8EDF5;border-radius:100px;padding:5px 12px">${I.mappin} Se actualiza al abrir la app o vincularse a un vehículo</div>
    </div>
    <div id="fl-mapa-wrap" style="border-radius:14px;overflow:hidden;border:1px solid #E8EDF5;height:520px"></div>
  `));
  setTimeout(flInicializarMapa,50);
}

function flInicializarMapa(){
  const el=document.getElementById('fl-mapa-wrap');
  if(!el||typeof L==='undefined')return;
  if(flMapaLeaflet){flMapaLeaflet.remove();flMapaLeaflet=null;}
  flMapaMarcadores={};
  flMapaLeaflet=L.map(el).setView([28.6353,-106.0889],11); // Chihuahua por default
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(flMapaLeaflet);
  flActualizarMarcadoresMapa();
}

function flActualizarMarcadoresMapa(){
  if(!flMapaLeaflet||typeof L==='undefined')return;
  const puntos=[];
  flUbicaciones.forEach(u=>{
    if(!u.lat||!u.lng)return;
    const v=flV.find(x=>String(x.eco)===String(u.eco));
    const nombre=u.nombre||u.email||'—';
    const eco=u.eco;
    const cuando=u.capturadoEn?new Date(u.capturadoEn).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
    const html=`<div style="font-size:12.5px;min-width:150px"><strong>ECO ${eco}${v?` · ${v.unidad||''}`:''}</strong><br>${nombre}<br><span style="color:#94A3B8;font-size:11px">Actualizado: ${cuando}</span></div>`;
    if(flMapaMarcadores[eco]){
      flMapaMarcadores[eco].setLatLng([u.lat,u.lng]).setPopupContent(html);
    }else{
      flMapaMarcadores[eco]=L.marker([u.lat,u.lng]).addTo(flMapaLeaflet).bindPopup(html);
    }
    puntos.push([u.lat,u.lng]);
  });
  if(puntos.length)flMapaLeaflet.fitBounds(puntos,{padding:[30,30],maxZoom:14});
}

// ══════════════════════════════════════════════════════════════
// SINIESTROS — vista completa (historial + reportar), no solo un modal
// ══════════════════════════════════════════════════════════════
let flSinFiltro='todos';

function rSiniestrosVista(){
  const activos=flSiniestros.filter(x=>x.estatus==='activo');
  const resueltos=flSiniestros.filter(x=>x.estatus==='resuelto');
  const lista=flSinFiltro==='activos'?activos:flSinFiltro==='resueltos'?resueltos:flSiniestros;
  const listaOrd=lista.slice().sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));

  const tab=(k,label,n)=>`<button onclick="flSinFiltro='${k}';rSiniestrosVista()" style="padding:8px 16px;border-radius:9px;border:none;font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;background:${flSinFiltro===k?'#0A1628':'#F1F5F9'};color:${flSinFiltro===k?'#fff':'#475569'}">${label} · ${n}</button>`;

  setContent(padded(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.5px">Siniestros</div>
        <div style="font-size:11.5px;color:#64748B;margin-top:3px">Historial completo de siniestros reportados</div>
      </div>
      <button onclick="flAbrirSiniestro()" style="background:#DC2626;color:#fff;border:none;border-radius:10px;padding:10px 18px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:7px;cursor:pointer">${I.check} Reportar siniestro</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:18px">
      ${tab('todos','Todos',flSiniestros.length)}
      ${tab('activos','Activos',activos.length)}
      ${tab('resueltos','Resueltos',resueltos.length)}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${listaOrd.length?listaOrd.map(x=>{
        const v=flV.find(vv=>String(vv.eco)===String(x.eco));
        const esActivo=x.estatus==='activo';
        const dt=iso=>iso?new Date(iso).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
        return`<div style="display:flex;gap:14px;padding:16px 18px;border-radius:14px;${esActivo?'background:#FEF2F2;border:1px solid #FECACA':'border:1px solid #E8EDF5'}">
          <div style="width:44px;height:44px;border-radius:10px;background:${esActivo?'rgba(255,255,255,.6)':'#F8FAFD'};display:flex;align-items:center;justify-content:center;flex:0 0 auto;color:${esActivo?'#B91C1C':'#15803D'}">
            ${esActivo?I.alert:I.check}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
              <strong style="font-size:14px;${esActivo?'color:#B91C1C':''}">ECO ${x.eco}${v?` · ${v.unidad||''}`:''}</strong>
              <span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:100px;background:${esActivo?'rgba(255,255,255,.6)':'#DCFCE7'};color:${esActivo?'#B91C1C':'#15803D'}">${esActivo?'Activo':'Resuelto'}</span>
            </div>
            <div style="font-size:13px;${esActivo?'color:#991B1B':'color:#374151'}">${(x.descripcion||'—').replace(/</g,'&lt;')}</div>
            <div style="font-size:11px;${esActivo?'color:#B91C1C':'color:#94A3B8'};margin-top:6px">Reportado por ${x.reportadoPor||'—'} · ${dt(x.creadoEn)}${x.resueltoEn?` · Resuelto ${dt(x.resueltoEn)}`:''}</div>
          </div>
          ${esActivo?`<button onclick="flResolverSiniestroInline('${x.id}')" style="font-size:12px;padding:8px 14px;border-radius:9px;border:1px solid #FECACA;background:#fff;color:#B91C1C;font-weight:700;cursor:pointer;align-self:center;flex:0 0 auto">Marcar resuelto</button>`:''}
        </div>`;
      }).join(''):`<div class="fl-empty" style="min-height:140px"><h3>Sin siniestros en esta categoría</h3></div>`}
    </div>
  `));
}

window.flResolverSiniestroInline=async function(id){
  if(!confirm('¿Marcar este siniestro como resuelto?'))return;
  try{
    await fs.updateDoc(fs.doc(db,C.SINIESTROS,id),{estatus:'resuelto',resueltoEn:new Date().toISOString()});
    rSiniestrosVista();
  }catch(e){alert('Error: '+e.message);}
};

// ── SOLICITUDES — layout imagen referencia ──

// ── SOLICITUDES — layout imagen referencia ──
function rSols(){
  const v=ST.vehId?flV.find(x=>x.id===ST.vehId):null;
  const now=new Date();
  const fecha=now.toLocaleDateString('es-MX');
  const hora=now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  setContent(`
    <!-- BARRA DETALLES VEHÍCULO -->
    <div class="fl-det-bar" style="padding:12px 20px;">
      <div class="fl-det-bar-t">Detalles del vehículo</div>
      <div class="fl-det-fields" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="fl-det-field"><label>Placas</label><input readonly value="${v?.placas||'—'}" style="width:100px"></div>
        <div class="fl-det-field"><label>Vehículo</label><input readonly value="${v?.unidad||'—'}" style="width:140px"></div>
        <div class="fl-det-field"><label>Marca</label><input readonly value="${(v?.unidad||'—').split(' ')[0]}" style="width:90px"></div>
        <div class="fl-det-field"><label>Modelo</label><input readonly value="${v?.año||'—'}" style="width:70px"></div>
        <div class="fl-det-field"><label>Fecha</label><input readonly value="${fecha}" style="width:90px"></div>
        <div class="fl-det-field"><label>Hora</label><input readonly value="${hora}" style="width:80px"></div>
        ${!v?'<div style="font-size:11.5px;color:#94A3B8;font-weight:600;align-self:center">← Selecciona un vehículo del panel izquierdo</div>':''}
      </div>
    </div>

    <!-- TOOLBAR TIPO SOLICITUD + BOTONES -->
    <div class="fl-sol-bar" style="padding:10px 20px;">
      <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Tipo de solicitud</span>
      <div style="position:relative;display:inline-block">
        <select class="fl-sol-tipo-sel" id="fl-sol-tipo" style="padding:9px 36px 9px 14px;background:#1E3A5F;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;appearance:none;-webkit-appearance:none;min-width:190px;letter-spacing:.2px;">
          <option value="" style="background:#1E3A5F;color:#fff">TIPO DE SOLICITUD</option>
          ${TIPOS_SOL.map(t=>`<option style="background:#fff;color:#0A0F1E">${t}</option>`).join('')}
          <option value="__c" style="background:#fff;color:#0A0F1E">Personalizado…</option>
        </select>
        <div style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none;color:#fff">▼</div>
      </div>
      <select class="fl-sol-tipo-sel" id="fl-sol-prior" style="min-width:90px">
        <option>Normal</option><option>Alta</option><option>Urgente</option>
      </select>
      <!-- SELECTOR TIPO VEHÍCULO -->
      <div style="display:flex;border:2px solid #E2E8F0;border-radius:9px;overflow:hidden">
        <button id="fl-pill-auto" onclick="flSetTipoVeh('auto')" style="padding:8px 18px;border:none;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;background:${ST.tipoVeh==='auto'?'#1E3A5F':'#fff'};color:${ST.tipoVeh==='auto'?'#fff':'#374151'}">CARRO</button>
        <button id="fl-pill-troca" onclick="flSetTipoVeh('troca')" style="padding:8px 18px;border:none;border-left:2px solid #E2E8F0;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;transition:all .15s;background:${ST.tipoVeh==='troca'?'#1E3A5F':'#fff'};color:${ST.tipoVeh==='troca'?'#fff':'#374151'}">TROCA</button>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
        ${hP('crear_solicitud')?`<button style="padding:8px 20px;background:#1E3A5F;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer;letter-spacing:.3px;display:inline-flex;align-items:center;gap:6px" onclick="flSolGuardar()">${I.check} Crear solicitud</button>`
          :`<span style="font-size:10px;font-weight:800;padding:6px 12px;border-radius:100px;background:#F1F5F9;color:#64748B;letter-spacing:.3px;display:inline-flex;align-items:center;gap:5px">${I.eye} Solo lectura — no puedes crear solicitudes</span>`}
      </div>
    </div>

    <!-- BODY: grid fotos | checklist | panel izquierdo daños -->
    <div style="display:grid;grid-template-columns:1fr 260px;min-height:calc(100vh - 200px)">
      <!-- IZQUIERDA: grid 2x2 + daños list -->
      <div>
        <!-- GRID 2x2 IMÁGENES -->
        <div class="fl-grid" style="height:480px;margin:12px" id="fl-img-grid">
          ${VISTAS.map(v=>`
            <div class="fl-grid-cell" id="fl-gc-${v}" onclick="flGridClick(event,'${v}')">
              ${getImgSrc(getTipoVehActivo(),v)}
              <div class="fl-grid-lbl">${VISTA_NOM[v]}</div>
              <div id="fl-gp-${v}">${renderGridPts(v)}</div>
            </div>`).join('')}
        </div>
        <!-- LISTADO DE DETALLES/DAÑOS -->
        <div class="fl-dmg-list">
          <div class="fl-dmg-list-t">Listado de detalles / daños</div>
          <div id="fl-dmg-list-items">${renderDmgList()}</div>
        </div>
        <!-- DESCRIPCIÓN + KM -->
        <div style="background:#fff;border-top:2px solid #E8EDF5;padding:16px 20px;display:flex;gap:14px">
          <div style="flex:1"><label style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Descripción del problema</label>
            <textarea id="fl-sol-desc" placeholder="Describe el problema o servicio requerido…" style="width:100%;padding:8px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:12.5px;resize:none;height:62px;outline:none;background:#F8FAFD"></textarea>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div><label style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:3px">KM actual</label>
              <input type="number" id="fl-sol-km" placeholder="85000" style="padding:8px 10px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:12.5px;width:110px;outline:none;background:#F8FAFD"></div>
          </div>
        </div>
        <!-- EVIDENCIAS -->
        <div style="background:#fff;border-top:2px solid #E8EDF5;padding:14px 20px">
          <label style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:8px">${I.camera} Evidencias fotográficas <span style="font-size:8px;color:#94A3B8;font-weight:500;text-transform:none">(solo cámara en vivo · galería bloqueada)</span></label>
          <button onclick="flCapturarEvidencia('general')" style="width:100%;padding:11px;background:#1E3A5F;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.3px">
            ${I.camera} Tomar foto con cámara
          </button>
          <div style="font-size:10px;color:#94A3B8;text-align:center;margin-top:5px">Genera código único · Sella GPS + fecha + usuario</div>
          <div class="fl-pills" id="fl-ev-pills" style="margin-top:8px">${ST.evFotos.map((ev,i)=>{const src=typeof ev==='string'?ev:ev.src;const cod=ev.meta?.codigo||('Foto '+(i+1));return`<span class="fl-pill" onclick="flVerEvidencia(ST.evFotos[${i}])" style="cursor:pointer"><img src="${src}" style="width:20px;height:20px;object-fit:cover;border-radius:3px;margin-right:3px"><span style="font-size:10px;font-family:'JetBrains Mono',monospace">${cod}</span></span>`;}).join('')}</div>
          <div style="display:flex;justify-content:flex-end;margin-top:10px">
            ${hP('crear_solicitud')?`<button class="fb acc" onclick="flSolGuardar()" id="fl-btn-guardar">${I.check} Crear solicitud</button>`:''}
          </div>
        </div>
      </div>

      <!-- DERECHA: GAUGE + CHECKLIST -->
      <div class="fl-ck-panel" style="display:flex;flex-direction:column;height:calc(100vh - 200px);overflow:hidden">
        <!-- GAUGE GASOLINA -->
        <div class="fl-gauge-wrap">${buildGaugeHTML()}</div>
        <!-- CHECK LIST -->
        <div class="fl-ck-head" style="background:#1E3A5F;display:flex;align-items:center;justify-content:space-between;padding:9px 12px">
          <span style="font-size:11px;font-weight:900;letter-spacing:.5px;color:#fff">CHECK LIST</span>
          ${flUsarConfirmSemanal(v)?'':'<span style="font-size:9px;color:rgba(255,255,255,.7);font-weight:700">SI &nbsp;·&nbsp; NO &nbsp;·&nbsp; FOTO</span>'}
        </div>
        <div class="fl-ck-body" style="flex:1;overflow-y:auto" id="fl-ck-body">
          ${renderChkFullOConfirm(v)}
        </div>
      </div>
    </div>

    <!-- TABLA HISTORIAL -->
    <div style="padding:12px 14px;background:#EEF2F7">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8;margin-bottom:8px">Historial de solicitudes${v?` — ECO ${v.eco}`:''}</div>
      ${tSols(v?flSolsDeVehiculo(v):flS.slice(0,6),hP('aprobar'))}
    </div>
  `);
  if(flUsarConfirmSemanal(v)) setTimeout(()=>flInitFirmaCanvas('fl-sol-confirm-firma'),80);
}

function renderGauge(){
  const pct=ST.gasolina/100;
  // Arco de -120° a +120° (total 240°)
  const angStart=-120, angEnd=angStart+pct*240;
  const toRad=a=>(a-90)*Math.PI/180;
  const cx=115,cy=105,R=88;
  const ex=cx+R*Math.cos(toRad(angEnd)), ey=cy+R*Math.sin(toRad(angEnd));
  // Segmentos de color (rojo→amarillo→verde)
  const col=pct<.25?'#EF4444':pct<.6?'#F59E0B':'#22C55E';
  // Gradiente fondo
  const sx=cx+R*Math.cos(toRad(angStart)), sy=cy+R*Math.sin(toRad(angStart));
  const large=pct*240>180?1:0;
  return`<svg class="fl-gauge-svg" width="230" height="140" viewBox="0 0 230 140" id="fl-gauge-svg">
    <defs>
      <linearGradient id="ggrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#EF4444"/>
        <stop offset="40%" style="stop-color:#F59E0B"/>
        <stop offset="100%" style="stop-color:#22C55E"/>
      </linearGradient>
    </defs>
    <!-- Arco fondo -->
    <path d="M${(cx+R*Math.cos(toRad(-120))).toFixed(1)},${(cy+R*Math.sin(toRad(-120))).toFixed(1)} A${R},${R} 0 1,1 ${(cx+R*Math.cos(toRad(120))).toFixed(1)},${(cy+R*Math.sin(toRad(120))).toFixed(1)}" fill="none" stroke="#E8EDF5" stroke-width="14" stroke-linecap="round"/>
    <!-- Arco progreso -->
    ${pct>0?`<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${R},${R} 0 ${large},1 ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="url(#ggrad)" stroke-width="14" stroke-linecap="round"/>`:''}
    <!-- Aguja -->
    <line x1="${cx}" y1="${cy}" x2="${(cx+72*Math.cos(toRad(angEnd))).toFixed(1)}" y2="${(cy+72*Math.sin(toRad(angEnd))).toFixed(1)}" stroke="#0A1628" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="8" fill="#0A1628" stroke="#fff" stroke-width="2.5"/>
    <!-- Ícono gasolina SVG -->
    <g transform="translate(${cx-10},14)">
      <rect x="2" y="0" width="14" height="18" rx="2" fill="#1E3A5F" opacity=".15"/>
      <rect x="4" y="2" width="10" height="8" rx="1" fill="#1E3A5F" opacity=".3"/>
      <line x1="9" y1="10" x2="9" y2="14" stroke="#1E3A5F" stroke-width="2" opacity=".4"/>
      <circle cx="9" cy="16" r="2" fill="#1E3A5F" opacity=".4"/>
    </g>
  </svg>`;
}

window.flGasChange=function(v){
  ST.gasolina=Number(v);
  const wrap=document.querySelector('.fl-gauge-wrap');
  if(wrap)wrap.innerHTML=buildGaugeHTML();
};
function buildGaugeHTML(){
  return`<div class="fl-gauge-t">Nivel de gasolina</div>
    ${renderGauge()}
    <div class="fl-gauge-labels"><span>VACÍO</span><span>2/4</span><span>MEDIO</span><span>3/4</span><span>LLENO</span></div>
    <input type="range" min="0" max="100" value="${ST.gasolina}" id="fl-gas-range" oninput="flGasChange(this.value)" style="width:100%;margin-top:6px;accent-color:#2563EB">`;
}

function renderGridPts(vista){
  return(ST.dmg[vista]||[]).map((p,i)=>`
    <div class="fl-dmg-pt" style="left:${p.x}%;top:${p.y}%" onclick="event.stopPropagation();flDmgRemove('${vista}',${i})">
      <div class="fl-dmg-pt-circle">${i+1}</div>
    </div>`).join('');
}

function renderDmgList(){
  const all=[];
  VISTAS.forEach(v=>(ST.dmg[v]||[]).forEach((p,i)=>all.push({v,i,p})));
  if(!all.length)return`<div style="font-size:11px;color:#94A3B8;padding:4px 0">Sin daños marcados aún — haz clic en las imágenes del vehículo</div>`;
  return all.map(({v,i})=>`<div class="fl-dmg-item">
    <div class="fl-dmg-num">${i+1}</div>
    <span style="font-weight:700;font-size:11.5px">${VISTA_NOM[v]}</span>
    <span style="color:#64748B;font-size:10.5px">— Punto ${i+1}</span>
    <button onclick="flDmgRemove('${v}',${i})" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#EF4444;font-size:10px;font-weight:700">✕</button>
  </div>`).join('');
}

// ── REGLA: checklist interno vs. confirmación por checklist semanal ──
// Lunes/Martes/Miércoles + checklist semanal de esta semana ya completado → confirmación + firma
// Jueves..Domingo, o checklist semanal no completado → checklist interno normal
function flDiaEnRangoConfirm(){
  const d=new Date().getDay(); // 0=domingo ... 6=sábado
  return d>=1&&d<=3; // lunes, martes, miércoles
}
function flChkSemCompletado(eco,semana){
  if(!eco)return false;
  return flChkSem.some(r=>String(r.vehiculoEco)===String(eco)&&r.semana===semana);
}
function flUsarConfirmSemanal(v){
  if(!v)return false;
  if(v.tipo==='maquinaria')return false; // maquinaria sigue con sus 4 fotos obligatorias
  if(!flDiaEnRangoConfirm())return false;
  return flChkSemCompletado(v.eco,getSemanaISOPortal());
}
function renderChkFullOConfirm(v){
  if(flUsarConfirmSemanal(v)){
    const semana=getSemanaISOPortal();
    return`<div style="padding:12px">
      <div style="background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:10px;padding:14px">
        <div style="font-size:12.5px;font-weight:800;color:#1D4ED8;margin-bottom:4px">Check list semanal ya completado</div>
        <div style="font-size:11.5px;color:#1E40AF;line-height:1.4;margin-bottom:10px">Confirmo que mi vehículo está en las mismas condiciones que mi checklist de esta semana (semana ${semana}).</div>
        <label style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:#1E3A5F;cursor:pointer;margin-bottom:10px">
          <input type="checkbox" id="fl-sol-confirm-chk" style="width:15px;height:15px">
          Confirmo la declaración anterior
        </label>
        <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma <span style="color:#DC2626">*</span></div>
        <div style="border:1.5px solid #E2E8F0;border-radius:9px;overflow:hidden;background:#fff">
          <canvas id="fl-sol-confirm-firma" width="320" height="180" style="display:block;width:100%;height:150px;touch-action:none;cursor:crosshair"></canvas>
        </div>
        <button type="button" onclick="flLimpiarFirma('fl-sol-confirm-firma')" style="margin-top:8px;padding:6px 12px;border:1.5px solid #E2E8F0;background:#fff;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;color:#374151;cursor:pointer">Limpiar firma</button>
      </div>
    </div>`;
  }
  return renderChkFull();
}

// ── FIRMA AUTÓGRAFA (canvas genérico, reutilizable en portal) ──
function flInitFirmaCanvas(canvasId){
  const canvas=document.getElementById(canvasId);if(!canvas)return;
  const ctx=canvas.getContext('2d');
  ctx.strokeStyle='#1E3A5F';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.lineJoin='round';
  let drawing=false,lastX=0,lastY=0;
  function getPos(e){const r=canvas.getBoundingClientRect();const scaleX=canvas.width/r.width;const scaleY=canvas.height/r.height;const src=e.touches?e.touches[0]:e;return{x:(src.clientX-r.left)*scaleX,y:(src.clientY-r.top)*scaleY};}
  canvas.addEventListener('mousedown',e=>{drawing=true;const p=getPos(e);lastX=p.x;lastY=p.y;});
  canvas.addEventListener('mousemove',e=>{if(!drawing)return;const p=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y;});
  window.addEventListener('mouseup',()=>drawing=false);
  canvas.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;const p=getPos(e);lastX=p.x;lastY=p.y;},{passive:false});
  canvas.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const p=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(p.x,p.y);ctx.stroke();lastX=p.x;lastY=p.y;},{passive:false});
  canvas.addEventListener('touchend',()=>drawing=false);
}
window.flLimpiarFirma=function(canvasId){const c=document.getElementById(canvasId);if(c){const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);}};
function flFirmaTieneTrazo(canvasId){
  const c=document.getElementById(canvasId);if(!c)return false;
  const ctx=c.getContext('2d');
  const data=ctx.getImageData(0,0,c.width,c.height).data;
  return data.some((_,i)=>i%4===3&&data[i]>0);
}
function flFirmaExportar(canvasId){
  const canvas=document.getElementById(canvasId);if(!canvas)return null;
  const cvs=document.createElement('canvas');cvs.width=canvas.width;cvs.height=canvas.height;
  const cx=cvs.getContext('2d');cx.fillStyle='#ffffff';cx.fillRect(0,0,cvs.width,cvs.height);cx.drawImage(canvas,0,0);
  return cvs.toDataURL('image/jpeg',0.85);
}

function renderChkFull(){
  // Maquinaria: en vez del checklist, 4 fotos obligatorias (reusa ST.chkFotos + flCapturarEvidencia)
  if(flEsMaqActiva()){
    let mh='<div style="padding:10px 12px;font-size:10.5px;color:#64748B;line-height:1.5">Sube las <b>4 fotos requeridas</b> de la unidad.</div>';
    MAQ_FOTOS.forEach((lbl,i)=>{
      const key=`maq__${i}`;
      const fo=ST.chkFotos[key]||null;
      const src=fo?(typeof fo==='string'?fo:fo.src):'';
      mh+=`<div class="fl-ck-row" id="fl-ckrow-${key}" style="align-items:center">
        <span class="fl-ck-name" style="flex:1">${i+1}. ${lbl}</span>
        <button class="fl-ck-foto-btn ${src?'has':''}" onclick="${src?`flVerEvidencia(ST.chkFotos['${key}'])`:`flCapturarEvidencia('checklist','${key}')`}" title="${src?'Ver foto':'Tomar foto'}">
          ${src?`<img src="${src}" style="width:20px;height:20px;object-fit:cover;border-radius:3px">`:I.camera}
        </button>
      </div>`;
    });
    return mh;
  }
  let html='';
  for(const [cat,items] of Object.entries(CHK_CATS)){
    html+=`<div class="fl-ck-grp">${cat}</div>`;
    items.forEach((item,i)=>{
      const key=`${cat}__${i}`;
      const val=ST.chk[key]||'';
      const hasFoto=!!ST.chkFotos[key];
      const fotoObj=ST.chkFotos[key]||null;
      const fotoSrc=fotoObj?(typeof fotoObj==='string'?fotoObj:fotoObj.src):'';
      html+=`<div class="fl-ck-row" id="fl-ckrow-${key}">
        <span class="fl-ck-name">${item}</span>
        <button class="fl-ck-btn ${val==='si'?'si':''}" onclick="flChk('${key}','si')">SI</button>
        <button class="fl-ck-btn ${val==='no'?'no':''}" onclick="flChk('${key}','no')">NO</button>
        <button class="fl-ck-foto-btn ${fotoSrc?'has':''}" onclick="${fotoSrc?`flVerEvidencia(ST.chkFotos['${key}'])`:`flCapturarEvidencia('checklist','${key}')`}" title="${fotoSrc?'Ver evidencia':'Tomar foto'}">
          ${fotoSrc?`<img src="${fotoSrc}" style="width:20px;height:20px;object-fit:cover;border-radius:3px">`:I.camera}
        </button>
      </div>`;
    });
  }
  return html;
}

// GRID CLICK → marcar daño
window.flGridClick=function(e,vista){
  const cell=document.getElementById('fl-gc-'+vista);if(!cell)return;
  const rect=cell.getBoundingClientRect();
  const x=((e.clientX-rect.left)/rect.width*100).toFixed(1);
  const y=((e.clientY-rect.top)/rect.height*100).toFixed(1);
  if(!ST.dmg[vista])ST.dmg[vista]=[];
  ST.dmg[vista].push({x:Number(x),y:Number(y)});
  const g=document.getElementById('fl-gp-'+vista);if(g)g.innerHTML=renderGridPts(vista);
  const li=document.getElementById('fl-dmg-list-items');if(li)li.innerHTML=renderDmgList();
};
window.flDmgRemove=function(vista,idx){
  ST.dmg[vista].splice(idx,1);
  const g=document.getElementById('fl-gp-'+vista);if(g)g.innerHTML=renderGridPts(vista);
  const li=document.getElementById('fl-dmg-list-items');if(li)li.innerHTML=renderDmgList();
};

// TIPO VEHÍCULO
window.flSetTipoVeh=function(t){
  ST.tipoVeh=t;
  const autoBtn=document.getElementById('fl-pill-auto');
  const trocaBtn=document.getElementById('fl-pill-troca');
  if(autoBtn){autoBtn.style.background=t==='auto'?'#1E3A5F':'#fff';autoBtn.style.color=t==='auto'?'#fff':'#374151';}
  if(trocaBtn){trocaBtn.style.background=t==='troca'?'#1E3A5F':'#fff';trocaBtn.style.color=t==='troca'?'#fff':'#374151';}
  // Actualizar grid de imágenes sin re-render completo
  ['frente','atras','derecha','izquierda'].forEach(v=>{
    const cell=document.getElementById('fl-gc-'+v);
    if(cell){
      const img=cell.querySelector('img,div[style]');
      // Reemplazar solo el contenido de imagen
      const newHtml=getImgSrc(t,v);
      const tmp=document.createElement('div');
      tmp.innerHTML=newHtml;
      const newEl=tmp.firstElementChild;
      if(img&&newEl){cell.replaceChild(newEl,img);}
    }
  });
};

// CHECKLIST
window.flChk=function(key,val){
  ST.chk[key]=ST.chk[key]===val?'':val;
  const si=document.querySelector(`[onclick="flChk('${key}','si')"]`);
  const no=document.querySelector(`[onclick="flChk('${key}','no')"]`);
  if(si)si.className=`fl-ck-btn ${ST.chk[key]==='si'?'si':''}`;
  if(no)no.className=`fl-ck-btn ${ST.chk[key]==='no'?'no':''}`;
};
// flChkFoto reemplazado por flCapturarEvidencia

// EVIDENCIAS
// flSolEvs reemplazado por flCapturarEvidencia


// ══════════════════════════════════════════════════════
// MOTOR DE EVIDENCIAS CON TRAZABILIDAD FORENSE
// ══════════════════════════════════════════════════════

// Generar código único irrepetible
function genCodigo(){
  const now=new Date();
  const dd=String(now.getFullYear())+String(now.getMonth()+1).padStart(2,'0')+String(now.getDate()).padStart(2,'0');
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand='';for(let i=0;i<4;i++)rand+=chars[Math.floor(Math.random()*chars.length)];
  return `TCN-EV-${dd}-${rand}`;
}

// Obtener coordenadas GPS
function getGPS(){
  return new Promise((res)=>{
    if(!navigator.geolocation){res(null);return;}
    navigator.geolocation.getCurrentPosition(
      p=>res({lat:p.coords.latitude.toFixed(6),lng:p.coords.longitude.toFixed(6),acc:Math.round(p.coords.accuracy)}),
      ()=>res(null),
      {timeout:8000,maximumAge:0,enableHighAccuracy:true}
    );
  });
}

// Quemar sello sobre la imagen con canvas
function sellarImagen(imgSrc, meta){
  return new Promise(res=>{
    const img=new Image();
    img.onload=function(){
      const c=document.createElement('canvas');
      c.width=img.width; c.height=img.height;
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0);
      // Fondo sello inferior
      const sh=Math.round(img.height*0.22);
      ctx.fillStyle='rgba(0,0,0,0.72)';
      ctx.fillRect(0,img.height-sh,img.width,sh);
      // Línea acento color
      ctx.fillStyle='#3B82F6';
      ctx.fillRect(0,img.height-sh,img.width,4);
      // Textos
      const fs=Math.round(img.width*0.038);
      ctx.fillStyle='#FCD34D';
      ctx.font=`bold ${fs}px monospace`;
      ctx.fillText(meta.codigo, 12, img.height-sh+fs+6);
      ctx.fillStyle='#ffffff';
      ctx.font=`${fs}px monospace`;
      ctx.fillText(meta.fecha+' · '+meta.hora, 12, img.height-sh+fs*2+10);
      ctx.fillStyle='rgba(255,255,255,0.7)';
      ctx.font=`${Math.round(fs*0.85)}px monospace`;
      ctx.fillText(meta.gps?`${meta.gps.lat}, ${meta.gps.lng}`:'GPS no disponible', 12, img.height-sh+fs*3+12);
      // Lado derecho
      const rsz=Math.round(fs*0.85);
      ctx.font=`${rsz}px monospace`;
      ctx.textAlign='right';
      ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText(`ECO ${meta.eco} · ${meta.unidad}`, img.width-10, img.height-sh+rsz+6);
      ctx.fillText(meta.usuario, img.width-10, img.height-sh+rsz*2+10);
      ctx.textAlign='left';
      res(c.toDataURL('image/jpeg',0.88));
    };
    img.src=imgSrc;
  });
}

// CAPTURAR EVIDENCIA — cámara forzada, sello automático
window.flCapturarEvidencia=async function(tipo, key){
  // tipo: 'general' | 'checklist'
  // key: solo para checklist

  // Verificar vehículo seleccionado
  if(!ST.vehId){
    flMsgError('Selecciona un vehículo antes de tomar evidencias.');
    return;
  }

  // Solicitar GPS primero
  flMsgInfo('Obteniendo ubicación GPS…');
  const gps=await getGPS();
  if(!gps){
    const continuar=confirm('No se pudo obtener GPS.\n¿Deseas continuar sin coordenadas?\n\nSe registrará sin ubicación verificable.');
    if(!continuar)return;
  }

  // Crear input de cámara forzada (capture="environment" bloquea galería en móvil)
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='image/*';
  inp.capture='environment'; // FUERZA cámara trasera, bloquea galería en móvil
  inp.style.display='none';
  document.body.appendChild(inp);

  inp.onchange=async function(){
    const file=this.files[0];
    if(!file){document.body.removeChild(inp);return;}

    flMsgInfo('Procesando evidencia…');

    const reader=new FileReader();
    reader.onload=async function(e){
      const rawSrc=e.target.result;
      const v=flV.find(x=>x.id===ST.vehId);
      const now=new Date();
      const meta={
        codigo: genCodigo(),
        fecha: now.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
        hora: now.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
        timestamp: now.toISOString(),
        gps,
        eco: v?.eco||'—',
        unidad: v?.unidad||'—',
        usuario: window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
        vehId: ST.vehId,
        tipo,
        key: key||null,
      };

      // Sellar imagen
      const sellada=await sellarImagen(rawSrc,meta);

      // Guardar según tipo
      if(tipo==='checklist'&&key){
        ST.chkFotos[key]={src:sellada,meta};
        // Actualizar botón en checklist
        const btn=document.querySelector(`#fl-ckrow-${key} .fl-ck-foto-btn`);
        if(btn){
          btn.classList.add('has');
          btn.innerHTML=`<img src="${sellada}" style="width:20px;height:20px;object-fit:cover;border-radius:3px">`;
          btn.onclick=()=>flVerEvidencia(ST.chkFotos[key]);
        }
      } else {
        ST.evFotos.push({src:sellada,meta});
        actualizarPillsEv();
        // Actualizar carrusel panel derecho
        if(ST.vehId)renderRP(ST.vehId);
      }

      flMsgOk(`Evidencia registrada · ${meta.codigo}`);
      document.body.removeChild(inp);
    };
    reader.readAsDataURL(file);
  };

  inp.click();
};

// Ver evidencia con metadatos completos
window.flVerEvidencia=function(ev){
  if(!ev)return;
  const src=typeof ev==='string'?ev:ev.src;
  const meta=typeof ev==='object'?ev.meta:null;
  const ov=document.createElement('div');
  ov.className='fl-ov';
  ov.style.zIndex='4500'; // siempre encima de cualquier modal
  ov.innerHTML=`<div style="max-width:400px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.4)">
    <img src="${src}" style="width:100%;display:block;max-height:300px;object-fit:contain;background:#0A1628">
    ${meta?`<div style="padding:14px 16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        ${[
          ['Código',meta.codigo||'—'],
          ['Fecha y hora',(meta.fecha||'—')+' '+( meta.hora||'')],
          ['GPS',meta.gps?`${meta.gps.lat}, ${meta.gps.lng}`:'No disponible'],
          ['Precisión',meta.gps?`±${meta.gps.acc}m`:'—'],
          ['Vehículo',`ECO ${meta.eco} · ${meta.unidad}`],
          ['Usuario',meta.usuario||'—'],
          ['Modo',(meta.modo||'—').toUpperCase()],
          ['Tipo',meta.tipo||'—'],
        ].map(([l,v])=>`<div style="background:#F8FAFD;border-radius:7px;padding:7px 9px">
          <div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</div>
          <div style="font-size:11.5px;font-weight:600;color:#0A0F1E;font-family:'JetBrains Mono',monospace">${v}</div>
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('.fl-ov').remove()" style="flex:1;padding:9px;background:#F1F5F9;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#374151">Cerrar</button>
        ${meta.gps?`<button onclick="window.open('https://maps.google.com/?q=${meta.gps.lat},${meta.gps.lng}','_blank')" style="flex:1;padding:9px;background:#2563EB;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#fff">Ver en mapa</button>`:''}
      </div>
    </div>`:`<div style="padding:14px 16px;display:flex;justify-content:flex-end"><button onclick="this.closest('.fl-ov').remove()" style="padding:9px 18px;background:#F1F5F9;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Cerrar</button></div>`}
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};



// Actualizar pills de evidencias generales
function actualizarPillsEv(){
  const p=document.getElementById('fl-ev-pills');
  if(!p)return;
  p.innerHTML=ST.evFotos.map((ev,i)=>{
    const src=typeof ev==='string'?ev:ev.src;
    const cod=ev.meta?.codigo||`Foto ${i+1}`;
    return`<span class="fl-pill" onclick="flVerEvidencia(ST.evFotos[${i}])" style="cursor:pointer">
      <img src="${src}" style="width:20px;height:20px;object-fit:cover;border-radius:3px;margin-right:3px">
      <span style="font-size:10px;font-family:'JetBrains Mono',monospace">${cod}</span>
    </span>`;
  }).join('');
}

// Mensajes toast
function flMsgInfo(txt){flToast(txt,'#1E3A5F','#fff');}
function flMsgOk(txt){flToast(txt,'#15803D','#fff');}
function flMsgError(txt){flToast(txt,'#B91C1C','#fff');}
function flToast(txt,bg,color){
  const t=document.createElement('div');
  t.style.cssText=`position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:${bg};color:${color};padding:10px 20px;border-radius:100px;font-size:12.5px;font-weight:700;z-index:9999;font-family:'Plus Jakarta Sans',sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center;animation:flTIn .2s ease`;
  t.textContent=txt;
  if(!document.getElementById('fl-toast-css')){
    const s=document.createElement('style');s.id='fl-toast-css';
    s.textContent='@keyframes flTIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
    document.head.appendChild(s);
  }
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .3s';setTimeout(()=>t.remove(),300);},2800);
}

// GUARDAR SOLICITUD
window.flSolGuardar=async function(){
  if(!hP('crear_solicitud')){alert('Tu perfil tiene acceso de solo lectura a Flotilla. No puedes crear solicitudes.');return;}
  if(!ST.vehId){alert('Selecciona un vehículo del panel izquierdo.');return;}
  const tipo=document.getElementById('fl-sol-tipo')?.value;
  const desc=document.getElementById('fl-sol-desc')?.value?.trim();
  const km=document.getElementById('fl-sol-km')?.value;
  const prior=document.getElementById('fl-sol-prior')?.value||'Normal';
  if(!tipo){alert('Selecciona el tipo de solicitud.');return;}
  if(!desc){alert('Describe el problema.');return;}
  const v=flV.find(x=>x.id===ST.vehId);
  const usarConfirm=flUsarConfirmSemanal(v);
  let chkFirmaConfirmacion=null;
  if(usarConfirm){
    if(!document.getElementById('fl-sol-confirm-chk')?.checked){alert('Confirma que el vehículo está en las mismas condiciones que su checklist semanal.');return;}
    if(!flFirmaTieneTrazo('fl-sol-confirm-firma')){alert('Falta la firma de confirmación.');return;}
    chkFirmaConfirmacion=flFirmaExportar('fl-sol-confirm-firma');
  } else if(v&&v.tipo==='maquinaria'){
    // Maquinaria: exigir las 4 fotos en lugar del checklist
    const faltan=MAQ_FOTOS.map((_,i)=>`maq__${i}`).filter(k=>!ST.chkFotos[k]);
    if(faltan.length){alert(`Faltan ${faltan.length} de 4 fotos requeridas de la maquinaria.`);return;}
  }
  // Leer notas checklist
  const chkFinal=usarConfirm?{}:{...ST.chk};
  const docObj={
    vehiculoId:ST.vehId,vehiculoEco:v?.eco||'',vehiculo:`${v?.eco} · ${v?.unidad||''}`,
    tipo,prioridad:prior,descripcion:desc,kilometrajeReportado:km||'',
    gasolina:ST.gasolina,tipoUnidad:ST.tipoVeh,
    estatus:'Solicitud',solicitante:window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—',
    creadoPor:window.auth?.currentUser?.email||'',creadoEn:new Date().toISOString(),
    confirmacionChecklistSemanal:!!usarConfirm,
  };
  const adjuntosObj={
    evidencias:ST.evFotos.map(e=>typeof e==='string'?e:e.src),
    evidenciasMeta:ST.evFotos.map(e=>typeof e==='object'?e.meta:null).filter(Boolean),
    danos:JSON.parse(JSON.stringify(ST.dmg)),
    checklist:chkFinal,chkFotos:usarConfirm?{}:ST.chkFotos,
    chkFirmaConfirmacion:chkFirmaConfirmacion,
  };
  const btn=document.getElementById('fl-btn-guardar');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    const ref=await fs.addDoc(fs.collection(db,C.SOLS),docObj);
    // Fotos/firma/daños van aparte — así el documento principal (el que se
    // descarga siempre en la lista) se queda liviano.
    await fs.setDoc(fs.doc(db,C.SOLS,ref.id,'adjuntos','fotos'),adjuntosObj);
    if(km&&v&&!v.id.startsWith('eco-'))await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{km:Number(km)}).catch(()=>{});
    // Reset
    ST={...ST,dmg:{frente:[],atras:[],derecha:[],izquierda:[]},chk:{},chkFotos:{},evFotos:[],gasolina:50};
    await ldSols();rSols();
    if(window.mostrarPush)window.mostrarPush('Solicitud creada','En proceso de validación.','✓');
  }catch(e){console.error('[FL]',e);alert('Error: '+e.message);if(btn){btn.disabled=false;btn.textContent=`${I.check} Crear solicitud`;}}
};

// PANEL DERECHO INFO VEHÍCULO
// ── Cambio rápido de estatus / flag "asignado sin cambios" desde el
// panel derecho (admin). Escribe directo en flotilla_vehiculos — como
// todas las vistas (taller, técnico, lista, etc.) leen del mismo
// documento vía flV, el cambio se sincroniza automáticamente en todo
// el portal sin lógica adicional.
window.flRPCambiarStatus = async function(id, nuevoStatus){
  try{
    await fs.updateDoc(fs.doc(db,C.VEHS,id),{status:nuevoStatus});
    const v=flV.find(x=>x.id===id); if(v) v.status=nuevoStatus;
    flToast('Estatus actualizado a "'+nuevoStatus+'"','ok');
    renderSB(); if(ST.vehId===id) renderRP(id);
  }catch(e){ flToast('Error: '+e.message,'err'); }
};

window.flRPToggleSinCambios = async function(id, marcado){
  try{
    await fs.updateDoc(fs.doc(db,C.VEHS,id),{asignadoSinCambios:marcado});
    const v=flV.find(x=>x.id===id); if(v) v.asignadoSinCambios=marcado;
    flToast(marcado?'Vehículo marcado como asignado sin cambios':'Marca quitada','ok');
    renderSB();
  }catch(e){ flToast('Error: '+e.message,'err'); }
};

function renderRP(id){
  const rp=document.getElementById('fl-rp');if(!rp)return;
  const v=flV.find(x=>x.id===id);if(!v){rp.innerHTML=rpVacio();return;}
  const d=hD(v.pv);const pvOk=d===null||d>=90;
  const fotos=[...(v.fotos||[]),...ST.evFotos.map(e=>typeof e==='string'?e:e.src)];
  const histFull=flSolsDeVehiculo(v);
  const hist=histFull.slice(0,30);
  const usosVeh=flUsos.filter(u=>String(u.eco)===String(v.eco));
  const alts=[];
  if(d!==null&&d<0)alts.push({e:true,t:'Póliza VENCIDA'});
  else if(d!==null&&d<90)alts.push({e:false,t:`Póliza vence en ${d} días`});
  const comAct=v.status==='comision'?flCom.find(c=>c.estatus==='En préstamo'&&(c.vehiculoId===v.id||String(c.vehiculoEco)===String(v.eco))):null;
  const vivo=typeof flQuienUsaEcoAhora==='function'?flQuienUsaEcoAhora(v.eco):null;
  const ultChk=flChkSem.filter(c=>String(c.vehiculoEco)===String(v.eco)).sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''))[0];

  const card=(titulo,contenido,extra)=>`<div style="border:1px solid #E8EDF5;border-radius:14px;padding:14px 16px;margin:0 12px 12px">
    <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">${titulo}${extra||''}</div>
    ${contenido}
  </div>`;
  const fila=(label,val,mono)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;font-size:12.5px"><span style="color:#94A3B8">${label}</span><span style="font-weight:700;${mono?"font-family:'JetBrains Mono',monospace;":''}text-align:right;max-width:60%">${val}</span></div>`;

  rp.innerHTML=`
    ${comAct?`<div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:9px;padding:9px 12px;margin:10px 12px 0;display:flex;align-items:flex-start;gap:8px">
      <span style="color:#DC2626">${I.alert}</span>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:800;color:#DC2626">Vehículo en uso</div>
        <div style="font-size:10.5px;color:#7F1D1D;margin-top:2px"><strong>Responsable:</strong> ${comAct.responsable||'—'}</div>
        ${comAct.motivo?`<div style="font-size:10.5px;color:#7F1D1D;margin-top:1px"><strong>Motivo:</strong> ${comAct.motivo}</div>`:''}
      </div>
    </div>`:''}

    <div class="fl-rp-img" id="fl-rp-car">
      ${fotos.length?`
      <div style="position:relative;overflow:hidden">
        <div style="display:flex;transition:transform .3s" id="fl-rpc-track">
          ${fotos.map(f=>`<img src="${f}" style="min-width:100%;height:160px;object-fit:contain;background:#E8EEFA">`).join('')}
        </div>
        ${fotos.length>1?`
        <button onclick="flRPCar(-1)" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(10,22,40,.6);border:none;color:#fff;width:24px;height:24px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">${I.chevL}</button>
        <button onclick="flRPCar(1)"  style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(10,22,40,.6);border:none;color:#fff;width:24px;height:24px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center">${I.chevR}</button>
        <div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:4px">${fotos.map((_,i)=>`<div onclick="flRPCarTo(${i})" style="width:5px;height:5px;border-radius:50%;background:${i===0?'#fff':'rgba(255,255,255,.4)'};cursor:pointer" id="fl-rpd-${i}"></div>`).join('')}</div>`:''}
      </div>`:`
      <div style="height:140px;background:linear-gradient(135deg,#E8F0FA,#C7D7F0);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;color:#4A6FA5">
        <div style="font-size:42px">${hEmo(v.tipo)}</div>
        <div style="font-size:10px;font-weight:700;color:#4A6FA5">ECO ${v.eco}</div>
      </div>`}
      <div class="fl-rp-upload">
        <label onclick="document.getElementById('fl-rp-f').click()">${I.upload} Subir imagen</label>
        <input type="file" id="fl-rp-f" accept="image/*" style="display:none" onchange="flRPFoto(this,'${id}')">
      </div>
    </div>

    <div style="padding:14px 16px 4px;display:flex;align-items:flex-start;justify-content:space-between">
      <div>
        <div style="font-size:16px;font-weight:900;letter-spacing:-.3px">ECO ${v.eco} · ${v.unidad||'—'}</div>
        <div style="font-size:12px;color:#64748B;margin-top:2px">${(v.tipo||'—').charAt(0).toUpperCase()+(v.tipo||'').slice(1)} · ${v.plaza||'—'} · ${v.placas||'—'}</div>
      </div>
      ${hAdm()?`<button onclick="flEditarVeh('${id}')" style="font-size:10px;font-weight:800;padding:6px 12px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:7px;cursor:pointer;color:#2563EB;flex:0 0 auto">${I.edit} Editar</button>`:``}
    </div>

    ${vivo!==null?`<div style="margin:8px 16px 0"><span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:100px;background:#DCFCE7;color:#15803D">EN USO · ${vivo}</span></div>`
      :`<div style="margin:8px 16px 0"><span style="font-size:10px;font-weight:800;padding:4px 10px;border-radius:100px;background:#F1F5F9;color:#64748B">DISPONIBLE</span></div>`}

    ${alts.length?`<div style="margin:10px 12px 0">${alts.map(a=>`<div style="display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:9px;font-size:11.5px;font-weight:700;background:${a.e?'#FEF2F2':'#FFFBEB'};color:${a.e?'#B91C1C':'#B45309'};margin-bottom:6px">${I.alert} ${a.t}</div>`).join('')}</div>`:''}

    ${card('Información general',`
      ${fila('Responsable',v.responsable&&v.responsable!=='—'?v.responsable:'<span style="color:#B91C1C">Sin asignar</span>')}
      ${fila('Número de serie / VIN',v.serie||'—',true)}
      ${fila('Año modelo',v.año||'—')}
      ${fila('Color',v.color||'—')}
      ${fila('Kilometraje',v.km?`${v.km} km`:'—',true)}
      ${fila('Estatus',`<span style="color:${pvOk?'#15803D':'#B91C1C'}">${v.status||'activo'}</span>`)}
      ${fila('Rendimiento',v.rend||'—')}
      ${(()=>{const s=flServicioEstado(v);return s?fila('Próximo servicio',`<span style="color:${s.estado==='vencido'?'#B91C1C':s.estado==='proximo'?'#B45309':'#15803D'}">${s.estado==='vencido'?`Vencido (${Math.abs(s.faltan)} km)`:`${s.faltan} km`}</span>`):'';})()}
      ${v.nip&&!/gas/i.test(v.nip)?fila('NIP',v.nip,true):''}
    `)}

    ${hAdm()?card('Administrar estatus (admin)',`
      <div style="display:flex;flex-direction:column;gap:4px">
        <label style="font-size:10px;font-weight:700;color:#64748B">Estatus del vehículo</label>
        <select id="fl-rp-status-${id}" onchange="flRPCambiarStatus('${id}',this.value)" style="width:100%;padding:7px 9px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;background:#F8FAFD;cursor:pointer">
          <option value="activo" ${(v.status||'activo')==='activo'?'selected':''}>Activo</option>
          <option value="taller" ${v.status==='taller'?'selected':''}>En taller</option>
          <option value="comision" ${v.status==='comision'?'selected':''}>En comisión/préstamo</option>
          <option value="baja" ${v.status==='baja'?'selected':''}>Baja</option>
        </select>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin-top:10px;cursor:pointer;user-select:none">
        <input type="checkbox" id="fl-rp-sincambios-${id}" ${v.asignadoSinCambios?'checked':''} onchange="flRPToggleSinCambios('${id}',this.checked)" style="width:15px;height:15px;accent-color:#2563EB;cursor:pointer">
        <span style="font-size:11.5px;font-weight:600;color:#374151">Asignado sin cambios (mismo técnico, sin reasignaciones)</span>
      </label>
      <div style="font-size:10px;color:#94A3B8;margin-top:5px">Marca esto cuando el vehículo lleva mucho tiempo con el mismo responsable y no debe reasignarse. Se ve en azul en la lista de la izquierda y aplica en todo el portal (taller, técnico, etc.) de inmediato.</div>
    `):''}

    ${card('Estado documental',`
      <div style="display:flex;flex-direction:column;gap:2px">
        ${[['tarjeta','Tarjeta de circulación'],['poliza','Póliza de seguro'],['verificacion','Verificación ambiental'],['factura','Factura del vehículo']].map(([t,label])=>`
          <button onclick="flRPDoc('${t}','${id}')" style="display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:none;padding:7px 0;cursor:pointer;font-family:inherit;border-bottom:1px solid #F8FAFD">
            <span style="display:flex;align-items:center;gap:7px;font-size:12.5px;color:#374151">${I.doc} ${label}</span>
            ${v[`doc_${t}`]?`<span style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:100px;background:#DCFCE7;color:#15803D">Guardado</span>`:`<span style="font-size:9px;font-weight:800;padding:3px 8px;border-radius:100px;background:#FEF2F2;color:#B91C1C">Subir</span>`}
          </button>`).join('')}
      </div>
    `)}

    ${card('Último checklist semanal',ultChk?`
      ${fila('Fecha',hF(ultChk.creadoEn))}
      ${fila('Técnico',flNombrePorCorreo(ultChk.tecnico)||'—')}
      ${fila('Kilometraje reportado',ultChk.km?`${ultChk.km} km`:'—',true)}
      ${fila('Combustible',ultChk.gasolina!=null?`${ultChk.gasolina}%`:'—')}
    `:`<div style="font-size:12px;color:#94A3B8;text-align:center;padding:6px 0">Sin checklist registrado</div>`)}

    ${card('Llantas',`<div id="fl-llantas-wrap"></div>`)}

    ${histFull.filter(s=>s.evidencias?.length).length>=2?`
    <div style="padding:0 12px 12px">
      <button onclick="flCompararEvidencias('${v.id}')" style="width:100%;padding:10px;background:#1E3A5F;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
        ${I.eye} Comparar evidencias del vehículo
      </button>
    </div>`:''}

    ${card(`Historial de uso (${usosVeh.length})`,usosVeh.length?usosVeh.map(u=>flRPUsoItem(u)).join(''):`<div style="font-size:11px;color:#94A3B8;text-align:center;padding:8px 0">Sin registros de vinculación</div>`)}

    ${card(`Historial de solicitudes (${histFull.length})`,hist.length?hist.map(s=>flRPHistItem(s,v)).join('')+(histFull.length>hist.length?`<div style="font-size:9.5px;color:#94A3B8;text-align:center;padding:6px 0 0">Mostrando los ${hist.length} más recientes de ${histFull.length}</div>`:''):`<div style="font-size:11px;color:#94A3B8;text-align:center;padding:8px 0">Sin historial</div>`)}
  `;
  flRenderLlantasCard(id);
}

// ── HISTORIAL DE USO: quién vinculó/desvinculó el vehículo y cuándo ──
function flRPUsoItem(u){
  const dt=iso=>iso?new Date(iso).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  return`<div class="fl-rp-h-item">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
      <span style="font-weight:700;font-size:11px">${flNombrePorCorreo(u.nombre||u.email)||'—'}</span>
      ${u.activo?'<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:100px;background:#DCFCE7;color:#15803D">EN USO</span>':'<span style="font-size:9px;font-weight:800;padding:2px 7px;border-radius:100px;background:#F1F5F9;color:#64748B">CERRADO</span>'}
    </div>
    <div style="font-size:10px;color:#374151;margin-top:3px"><strong style="color:#94A3B8;font-weight:800;text-transform:uppercase;font-size:8.5px;letter-spacing:.5px">Vinculado</strong> ${dt(u.vinculadoEn)}</div>
    <div style="font-size:10px;color:#374151;margin-top:1px"><strong style="color:#94A3B8;font-weight:800;text-transform:uppercase;font-size:8.5px;letter-spacing:.5px">Desvinculado</strong> ${u.activo?'<span style="color:#94A3B8">— sigue vinculado —</span>':dt(u.desvinculadoEn)}</div>
    ${!u.activo&&u.motivo?`<div style="font-size:9.5px;color:#94A3B8;margin-top:2px;font-style:italic">${u.motivo}</div>`:''}
  </div>`;
}

// ── HISTORIAL DESPLEGABLE POR VEHÍCULO (perfil) ──
// Cada solicitud aparece colapsada (quién · tipo · fecha) y se expande para
// mostrar detalle reportado, evidencia fotográfica y firma (si aplica).
function flRPHistItem(s){
  const quien=flNombrePorCorreo(s.solicitante||s.creadoPor)||'—';
  return`<div class="fl-rp-h-item">
    <div onclick="flRPHistToggle('${s.id}')" style="cursor:pointer;display:flex;align-items:flex-start;gap:6px">
      <span id="fl-rph-chev-${s.id}" style="display:flex;margin-top:2px;color:#94A3B8;transition:transform .15s;flex-shrink:0">${I.chevDown||'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
          <span style="font-weight:700;font-size:11px">${s.tipo||'—'}</span>${hBadge(s.estatus)}
        </div>
        <div style="font-size:9.5px;color:#94A3B8;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${quien} · ${hF(s.creadoEn)}</div>
      </div>
    </div>
    <div id="fl-rph-body-${s.id}" style="display:none;margin:8px 0 2px 18px;padding:9px 11px;background:#F8FAFD;border:1px solid #EEF2F7;border-radius:8px"></div>
  </div>`;
}

window.flRPHistToggle=async function(id){
  const body=document.getElementById('fl-rph-body-'+id);
  const chev=document.getElementById('fl-rph-chev-'+id);
  if(!body)return;
  const abierto=body.style.display==='block';
  if(abierto){body.style.display='none';if(chev)chev.style.transform='rotate(0deg)';return;}
  if(!body.dataset.cargado){
    body.innerHTML='<div style="font-size:11px;color:#94A3B8;padding:4px 0">Cargando…</div>';
    body.style.display='block';
    const s=flS.find(x=>x.id===id);
    if(s){await flCargarEvidenciasSol(s);body.innerHTML=flRPHistBody(s);}
    body.dataset.cargado='1';
  }
  body.style.display='block';
  if(chev)chev.style.transform='rotate(180deg)';
};

function flRPHistBody(s){
  const fotosEv=(s.evidencias||[]).filter(Boolean);
  const fotosChk=Object.values(s.chkFotos||{}).filter(Boolean);
  const todasFotos=[...fotosEv,...fotosChk];
  return`
    <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">Solicitante</div>
    <div style="font-size:11.5px;font-weight:600;color:#0A1628;margin-bottom:8px">${s.solicitante||s.creadoPor||'—'}</div>
    <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:3px">Detalle reportado</div>
    <div style="font-size:11.5px;color:#374151;line-height:1.5;margin-bottom:8px">${s.descripcion||'—'}</div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:${todasFotos.length||s.chkFirmaConfirmacion?'8px':'0'}">
      <div style="font-size:10.5px;color:#64748B"><strong style="color:#374151">KM:</strong> ${s.kilometrajeReportado||'—'}</div>
      <div style="font-size:10.5px;color:#64748B"><strong style="color:#374151">Prioridad:</strong> ${s.prioridad||'Normal'}</div>
      ${s.gasolina!=null?`<div style="font-size:10.5px;color:#64748B"><strong style="color:#374151">Gasolina:</strong> ${s.gasolina}%</div>`:''}
    </div>
    ${todasFotos.length?`
    <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Evidencia fotográfica (${todasFotos.length})</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:${s.chkFirmaConfirmacion?'8px':'0'}">
      ${todasFotos.map(f=>`<img src="${f}" onclick="event.stopPropagation();flImg('${f}')" style="width:46px;height:46px;object-fit:cover;border-radius:6px;border:1px solid #E2E8F0;cursor:pointer">`).join('')}
    </div>`:''}
    ${s.chkFirmaConfirmacion?`
    <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Firma de confirmación</div>
    <img src="${s.chkFirmaConfirmacion}" onclick="event.stopPropagation();flImg('${s.chkFirmaConfirmacion}')" style="max-width:170px;width:100%;border:1px solid #E2E8F0;border-radius:6px;background:#fff;cursor:pointer;display:block">
    `:''}
    ${!todasFotos.length&&!s.chkFirmaConfirmacion?`<div style="font-size:10.5px;color:#94A3B8;font-style:italic">Sin evidencia fotográfica ni firma registrada para esta solicitud.</div>`:''}
  `;
}

let rpCarIdx=0;
window.flRPCar=function(d){
  const v=ST.vehId?flV.find(x=>x.id===ST.vehId):null;
  const fotos=[...(v?.fotos||[]),...ST.evFotos.map(e=>typeof e==='string'?e:e.src)];
  const n=fotos.length;if(n<2)return;
  rpCarIdx=(rpCarIdx+d+n)%n;flRPCarTo(rpCarIdx);
};
window.flRPCarTo=function(i){
  rpCarIdx=i;
  const t=document.getElementById('fl-rpc-track');if(t)t.style.transform=`translateX(-${i*100}%)`;
  document.querySelectorAll('[id^="fl-rpd-"]').forEach((d,j)=>d.style.background=j===i?'#fff':'rgba(255,255,255,.4)');
};

// ══════════════════════════════════════════════════════
// PANORAMA DE VEHÍCULOS — selector visual + resumen por unidad
// Botón exclusivo del módulo Flotilla. Muestra todos los vehículos como
// tarjetas con icono por tipo, permite seleccionar uno o varios, y genera
// un resumen específico por vehículo: historial de solicitudes, uso
// (vinculación/desvinculación) y quién/cuándo/qué se reportó.
// ══════════════════════════════════════════════════════
let flPanorSel=new Set();
let flPanorTipo='all';
let flPanorQ='';
let flPanorIncBaja=false;

// Puente entre el botón de la barra de Flotilla y el toggle de nivel-portal
// (window.flToggleExtras vive en index.html porque controla elementos del
// área que están fuera del módulo Flotilla: la parrilla y las actividades).
window.flToggleExtrasClick=function(){
  if(typeof window.flToggleExtras==='function')window.flToggleExtras();
};
window.flActualizarBotonExtras=function(){
  const btn=document.getElementById('fl-tb-extras');
  if(!btn)return;
  const abierto=!!window._flExtrasAbiertos;
  btn.style.background=abierto?'rgba(255,255,255,.16)':'';
  btn.title=abierto?'Ocultar documentos y actividades':'Mostrar documentos y actividades del área';
};

// ══════════════════════════════════════════════════════════════
// SINIESTROS — MVP: reportar y marcar como resuelto.
// Pendiente para una siguiente iteración (no incluido aquí todavía):
// sonido de alarma configurable y notificación push a administradores.
// ══════════════════════════════════════════════════════════════
window.flAbrirSiniestro=function(){
  const activos=flSiniestros.filter(x=>x.estatus==='activo');
  const ov=document.createElement('div');
  ov.className='fl-ov';ov.id='fl-sin-ov';
  ov.innerHTML=`
    <div class="fl-modal" style="max-width:520px">
      <div class="fl-mh" style="background:#DC2626;color:#fff">
        <h3 style="color:#fff">Reportar siniestro</h3>
        <button class="fl-mx" style="color:#fff" onclick="document.getElementById('fl-sin-ov').remove()">✕</button>
      </div>
      <div style="padding:18px 20px">
        ${activos.length?`<div style="font-size:12px;background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;border-radius:8px;padding:10px 14px;margin-bottom:14px">Hay ${activos.length} siniestro${activos.length===1?'':'s'} activo${activos.length===1?'':'s'} sin resolver.</div>`:''}
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Vehículo</label>
        <select id="fl-sin-eco" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;margin-bottom:12px;box-sizing:border-box">
          <option value="">Selecciona un vehículo…</option>
          ${flV.slice().sort((a,b)=>String(a.eco).localeCompare(String(b.eco),undefined,{numeric:true})).map(v=>`<option value="${v.eco}">ECO ${v.eco} · ${v.unidad||'—'}</option>`).join('')}
        </select>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">¿Qué pasó?</label>
        <textarea id="fl-sin-desc" rows="4" placeholder="Describe el siniestro: qué pasó, dónde, si hay lesionados, daños visibles…" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:9px;font-family:inherit;font-size:13px;margin-bottom:14px;box-sizing:border-box;resize:vertical"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button class="fb gho sm" onclick="document.getElementById('fl-sin-ov').remove()">Cancelar</button>
          <button class="fb" style="background:#DC2626;color:#fff;border:none" id="fl-sin-guardar" onclick="flGuardarSiniestro()">Reportar ahora</button>
        </div>
        ${activos.length?`<div style="margin-top:18px;border-top:1px solid #F1F5F9;padding-top:12px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8;margin-bottom:8px">Activos sin resolver</div>
          ${activos.map(x=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid #F8FAFD">
            <div style="min-width:0"><strong style="font-size:12px">ECO ${x.eco}</strong><div style="font-size:11px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.descripcion||'—'}</div></div>
            <button class="fb gho sm" onclick="flResolverSiniestro('${x.id}')">Marcar resuelto</button>
          </div>`).join('')}
        </div>`:''}
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)ov.remove();};
};

// ── Alarma sonora de siniestro (Web Audio API, sin archivo externo) ──
function flSonarAlarmaSiniestro(){
  try{
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return;
    const ctx=new Ctx();
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const tonos=[880,660,880,660];
    tonos.forEach((freq,i)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.type='square';
      osc.frequency.value=freq;
      const inicio=ctx.currentTime+i*0.28;
      gain.gain.setValueAtTime(0.0001,inicio);
      gain.gain.exponentialRampToValueAtTime(0.18,inicio+0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001,inicio+0.25);
      osc.connect(gain);gain.connect(ctx.destination);
      osc.start(inicio);osc.stop(inicio+0.26);
    });
    setTimeout(()=>ctx.close().catch(()=>{}),1400);
  }catch(e){console.warn('[FL] alarma siniestro',e);}
}

window.flGuardarSiniestro=async function(){
  const eco=(document.getElementById('fl-sin-eco')?.value||'').trim();
  const desc=(document.getElementById('fl-sin-desc')?.value||'').trim();
  if(!eco){alert('Selecciona el vehículo involucrado.');return;}
  if(!desc){alert('Describe brevemente qué pasó.');return;}
  const btn=document.getElementById('fl-sin-guardar');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  try{
    const v=flV.find(x=>String(x.eco)===String(eco));
    await fs.addDoc(fs.collection(db,C.SINIESTROS),{
      eco,descripcion:desc,estatus:'activo',
      reportadoPor:window.auth?.currentUser?.email||'',
      creadoEn:new Date().toISOString(),
    });
    // Notificar a todos los administradores
    const quien=window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'Alguien';
    await Promise.all(FLOTILLA_ADMINS.map(admEmail=>fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      para:admEmail,vehiculoEco:eco,tipo:'siniestro',
      mensaje:`${quien} reportó un siniestro en ECO ${eco}${v?.unidad?` (${v.unidad})`:''}: "${desc}"`,
      leido:false,creadaEn:new Date().toISOString(),
    }).catch(()=>{})));
    document.getElementById('fl-sin-ov')?.remove();
    alert('Siniestro reportado. Se notificó a los administradores. El botón de siniestro seguirá parpadeando hasta que se marque como resuelto.');
  }catch(e){
    console.error('[FL] guardar siniestro',e);
    alert('Error al reportar: '+e.message);
    if(btn){btn.disabled=false;btn.textContent='Reportar ahora';}
  }
};

window.flResolverSiniestro=async function(id){
  if(!confirm('¿Marcar este siniestro como resuelto?'))return;
  try{
    await fs.updateDoc(fs.doc(db,C.SINIESTROS,id),{estatus:'resuelto',resueltoEn:new Date().toISOString()});
    document.getElementById('fl-sin-ov')?.remove();
  }catch(e){alert('Error: '+e.message);}
};

window.flAbrirPanoramaVehiculo=function(vehId){
  const v=flV.find(x=>x.id===vehId); if(!v) return;
  document.getElementById('fl-panor-ov')?.remove();
  flPanorMes='all';
  const ov=document.createElement('div');
  ov.className='fl-ov'; ov.id='fl-panor-ov';
  ov.innerHTML=`
    <div class="fl-panor-modal">
      <div class="fl-mh">
        <h3>${I.fleet} Panorama de vehículos</h3>
        <button class="fl-mx" onclick="flCerrarPanorama()">✕</button>
      </div>
      <div class="fl-panor-body" id="fl-panor-body">${flPanorResumenVeh(v)}</div>
    </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)flCerrarPanorama();};
};

// ── Abrir Panorama de vehículos directo al resumen de UN vehículo ──
// (se usa al hacer clic en un vehículo del panel izquierdo, para que
// aparezca junto con el panel de info, sin pasar por la pantalla de
// selección múltiple del botón de Panorama normal)
window.flAbrirPanoramaVehiculo=function(id){
  flPanorSel=new Set([id]);flPanorTipo='all';flPanorQ='';flPanorIncBaja=false;flPanorMes='all';
  document.getElementById('fl-panor-ov')?.remove();
  const ov=document.createElement('div');
  ov.className='fl-ov';ov.id='fl-panor-ov';
  ov.innerHTML=`
    <div class="fl-panor-modal">
      <div class="fl-mh">
        <h3>${I.fleet} Panorama de vehículos</h3>
        <button class="fl-mx" onclick="flCerrarPanorama()">✕</button>
      </div>
      <div class="fl-panor-tools" style="display:none"></div>
      <div class="fl-panor-body" id="fl-panor-body"></div>
      <div class="fl-panor-bar" style="display:none"></div>
    </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)flCerrarPanorama();};
  flPanorVerResumen();
};

window.flAbrirPanorama=function(){
  flPanorSel=new Set();flPanorTipo='all';flPanorQ='';flPanorIncBaja=false;
  const ov=document.createElement('div');
  ov.className='fl-ov';ov.id='fl-panor-ov';
  ov.innerHTML=`
    <div class="fl-panor-modal">
      <div class="fl-mh">
        <h3>${I.fleet} Panorama de vehículos</h3>
        <button class="fl-mx" onclick="flCerrarPanorama()">✕</button>
      </div>
      <div class="fl-panor-tools">
        <div class="fl-sb-search" style="flex:1;min-width:180px;margin:10px 0">${I.search}<input type="text" id="fl-panor-q" placeholder="ECO, unidad, placas, responsable…" oninput="flPanorFiltrar()"></div>
        <button class="fl-sb-tipo on" id="fl-panort-all" onclick="flPanorSetTipo('all')">Todo</button>
        <button class="fl-sb-tipo" id="fl-panort-auto" onclick="flPanorSetTipo('auto')">Auto</button>
        <button class="fl-sb-tipo" id="fl-panort-cam" onclick="flPanorSetTipo('cam')">Troca</button>
        <button class="fl-sb-tipo" id="fl-panort-maq" onclick="flPanorSetTipo('maq')">Maquinaria</button>
        <label style="display:flex;align-items:center;gap:5px;font-size:10.5px;color:#64748B;cursor:pointer;user-select:none">
          <input type="checkbox" id="fl-panor-baja" onchange="flPanorToggleBaja(this.checked)" style="cursor:pointer">Incluir bajas
        </label>
      </div>
      <div class="fl-panor-body" id="fl-panor-body"></div>
      <div class="fl-panor-bar">
        <span id="fl-panor-cnt" style="font-size:11.5px;font-weight:700;color:#374151">0 vehículos seleccionados</span>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button class="fb gho sm" onclick="flPanorSelTodos()">Seleccionar visibles</button>
          <button class="fb gho sm" onclick="flPanorLimpiar()">Limpiar</button>
          <button class="fb acc" id="fl-panor-ver" onclick="flPanorVerResumen()" disabled>${I.eye} Ver resumen</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)flCerrarPanorama();};
  flPanorRenderGrid();
};

window.flCerrarPanorama=function(){document.getElementById('fl-panor-ov')?.remove();};

window.flPanorSetTipo=function(t){
  flPanorTipo=t;
  document.querySelectorAll('#fl-panor-ov .fl-sb-tipo').forEach(b=>b.classList.remove('on'));
  document.getElementById('fl-panort-'+t)?.classList.add('on');
  flPanorRenderGrid();
};
window.flPanorFiltrar=function(){flPanorQ=(document.getElementById('fl-panor-q')?.value||'').toLowerCase();flPanorRenderGrid();};
window.flPanorToggleBaja=function(v){flPanorIncBaja=v;flPanorRenderGrid();};

function flPanorLista(){
  let l=flPanorIncBaja?flV.slice():flV.filter(v=>v.status!=='baja');
  if(flPanorTipo==='auto')l=l.filter(v=>v.tipo==='auto'||!v.tipo);
  else if(flPanorTipo==='cam')l=l.filter(v=>v.tipo==='camion'||v.tipo==='camioneta');
  else if(flPanorTipo==='maq')l=l.filter(v=>v.tipo==='maquinaria');
  if(flPanorQ){
    l=l.filter(v=>[v.eco,v.unidad,v.placas,v.responsable,v.plaza].filter(Boolean).join(' ').toLowerCase().includes(flPanorQ));
  }
  return l.sort((a,b)=>String(a.eco||'').localeCompare(String(b.eco||''),undefined,{numeric:true}));
}

function flPanorRenderGrid(){
  const body=document.getElementById('fl-panor-body');if(!body)return;
  const lista=flPanorLista();
  if(!lista.length){body.innerHTML=`<div class="fl-empty" style="min-height:160px"><div class="fl-empty-ico">${SVG_AUTO}</div><h3>Sin vehículos que coincidan</h3></div>`;flPanorActualizarBarra();return;}
  body.innerHTML=`<div class="fl-panor-grid">${lista.map(v=>flPanorCardHTML(v)).join('')}</div>`;
  flPanorActualizarBarra();
}

function flPanorTipoLabel(t){return t==='maquinaria'?'Maquinaria':t==='camion'?'Camión':t==='camioneta'?'Camioneta':'Auto';}

function flPanorCardHTML(v){
  const sel=flPanorSel.has(v.id);
  const foto=(v.fotos||[])[0];
  return`<div class="fl-panor-card ${sel?'sel':''}" onclick="flPanorToggle('${v.id}')" title="ECO ${v.eco} · ${v.unidad||''}">
    <div class="fl-panor-fig">
      ${foto?`<img src="${foto}" loading="lazy">`:`<span class="fl-panor-ico">${hEmo(v.tipo)}</span>`}
      <span class="fl-panor-badge">${flPanorTipoLabel(v.tipo)}</span>
      <button class="fl-panor-chk">${sel?I.check:''}</button>
    </div>
    <div class="fl-panor-info">
      <div class="fl-panor-eco">ECO ${v.eco}</div>
      <div class="fl-panor-un">${v.unidad||'—'}</div>
      <div class="fl-panor-resp">${I.user} ${v.responsable||'Sin responsable'}</div>
    </div>
  </div>`;
}

window.flPanorToggle=function(id){
  if(flPanorSel.has(id))flPanorSel.delete(id);else flPanorSel.add(id);
  const card=document.querySelector(`#fl-panor-ov .fl-panor-card[onclick="flPanorToggle('${id}')"]`);
  if(card){
    card.classList.toggle('sel',flPanorSel.has(id));
    const chk=card.querySelector('.fl-panor-chk');if(chk)chk.innerHTML=flPanorSel.has(id)?I.check:'';
  }
  flPanorActualizarBarra();
};
window.flPanorSelTodos=function(){flPanorLista().forEach(v=>flPanorSel.add(v.id));flPanorRenderGrid();};
window.flPanorLimpiar=function(){flPanorSel.clear();flPanorRenderGrid();};

function flPanorActualizarBarra(){
  const n=flPanorSel.size;
  const cnt=document.getElementById('fl-panor-cnt');
  if(cnt)cnt.textContent=`${n} vehículo${n===1?'':'s'} seleccionado${n===1?'':'s'}`;
  const btn=document.getElementById('fl-panor-ver');if(btn)btn.disabled=n===0;
}

// ── RESUMEN POR VEHÍCULO (usa historial de solicitudes + flotilla_usos) ──
let flPanorMes='all'; // 'all' o 'YYYY-MM'

function flPanorMesesDisponibles(){
  const set=new Set();
  flS.forEach(s=>{if(s.creadoEn)set.add(String(s.creadoEn).slice(0,7));});
  flUsos.forEach(u=>{if(u.vinculadoEn)set.add(String(u.vinculadoEn).slice(0,7));});
  return[...set].sort().reverse();
}
function flPanorMesLabel(ym){
  const[a,m]=ym.split('-');
  const NOMBRES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return`${NOMBRES[Number(m)-1]||m} ${a}`;
}

window.flPanorVerResumen=function(){
  const ids=[...flPanorSel];if(!ids.length)return;
  const vs=ids.map(id=>flV.find(x=>x.id===id)).filter(Boolean)
    .sort((a,b)=>String(a.eco||'').localeCompare(String(b.eco||''),undefined,{numeric:true}));
  const body=document.getElementById('fl-panor-body');if(!body)return;
  const tools=document.querySelector('#fl-panor-ov .fl-panor-tools');if(tools)tools.style.display='none';
  const bar=document.querySelector('#fl-panor-ov .fl-panor-bar');if(bar)bar.style.display='none';
  const meses=flPanorMesesDisponibles();
  body.innerHTML=`
    <button class="fb gho sm" style="margin-bottom:12px" onclick="flPanorVolver()">${I.chevL} Volver a selección</button>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#94A3B8">Periodo</span>
      <select id="fl-panor-mes" onchange="flPanorMes=this.value;flPanorVerResumen()" style="padding:7px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;color:#0A1628;background:#fff;cursor:pointer">
        <option value="all" ${flPanorMes==='all'?'selected':''}>Todo el historial</option>
        ${meses.map(ym=>`<option value="${ym}" ${flPanorMes===ym?'selected':''}>${flPanorMesLabel(ym)}</option>`).join('')}
      </select>
      ${flPanorMes!=='all'?`<span style="font-size:10.5px;color:#94A3B8">Mostrando solo movimientos de ${flPanorMesLabel(flPanorMes)}</span>`:''}
    </div>
    ${vs.map(v=>flPanorResumenVeh(v)).join('')}
  `;
};

window.flPanorVolver=function(){
  flPanorMes='all';
  const tools=document.querySelector('#fl-panor-ov .fl-panor-tools');if(tools)tools.style.display='flex';
  const bar=document.querySelector('#fl-panor-ov .fl-panor-bar');if(bar)bar.style.display='flex';
  flPanorRenderGrid();
};

function flPanorResumenVeh(v){
  const enPeriodo=iso=>flPanorMes==='all'||(iso&&String(iso).slice(0,7)===flPanorMes);
  const hist=flSolsDeVehiculo(v).filter(s=>enPeriodo(s.creadoEn)).sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
  const usos=flUsos.filter(u=>String(u.eco)===String(v.eco)&&enPeriodo(u.vinculadoEn)).sort((a,b)=>(b.vinculadoEn||'').localeCompare(a.vinculadoEn||''));
  const abiertas=hist.filter(s=>!['Cerrada','Rechazada'].includes(s.estatus)).length;
  const cerradas=hist.filter(s=>s.estatus==='Cerrada').length;
  const usoAct=usos.find(u=>u.activo);
  const vivo=flQuienUsaEcoAhora(v.eco);
  const ultReporte=hist[0];
  const dt=iso=>iso?new Date(iso).toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
  return`<div class="fl-panor-sum-card">
    <div class="fl-panor-sum-h">
      <span style="display:flex;align-items:center;color:#1E3A5F">${hEmo(v.tipo)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:900;color:#0A1628">ECO ${v.eco} · ${v.unidad||'—'}</div>
        <div style="font-size:10.5px;color:#64748B;margin-top:1px">${v.responsable||'Sin responsable'} · ${v.plaza||'—'} · ${v.placas||'—'}</div>
      </div>
      ${vivo!==null?`<span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:100px;background:#DCFCE7;color:#15803D;white-space:nowrap">EN USO · ${vivo}</span>`
        :`<span style="font-size:9px;font-weight:800;padding:3px 9px;border-radius:100px;background:#F1F5F9;color:#64748B;white-space:nowrap">DISPONIBLE</span>`}
    </div>
    <div class="fl-panor-sum-kpis">
      <div class="fl-panor-sum-kpi"><b>${hist.length}</b><span>Solicitudes</span></div>
      <div class="fl-panor-sum-kpi"><b style="color:#B45309">${abiertas}</b><span>En proceso</span></div>
      <div class="fl-panor-sum-kpi"><b style="color:#15803D">${cerradas}</b><span>Cerradas</span></div>
      <div class="fl-panor-sum-kpi"><b>${usos.length}</b><span>Usos</span></div>
    </div>
    <div class="fl-panor-sum-sec">
      <div class="fl-panor-sum-sec-t">Último reporte</div>
      ${ultReporte?`<div style="font-size:11.5px;color:#374151"><strong>${ultReporte.tipo||'—'}</strong> · ${ultReporte.solicitante||ultReporte.creadoPor||'—'} · ${dt(ultReporte.creadoEn)} ${hBadge(ultReporte.estatus)}</div>`
        :`<div style="font-size:11px;color:#94A3B8">Sin reportes registrados</div>`}
    </div>
    <div class="fl-panor-sum-sec">
      <div class="fl-panor-sum-sec-t">Resumen de solicitudes (${hist.length})</div>
      ${hist.length?hist.slice(0,10).map(s=>flRPHistItem(s,v)).join(''):`<div style="font-size:11px;color:#94A3B8">Sin solicitudes</div>`}
      ${hist.length>10?`<div style="font-size:9.5px;color:#94A3B8;text-align:center;padding:6px 0 0">Mostrando las 10 más recientes de ${hist.length}</div>`:''}
    </div>
    <div class="fl-panor-sum-sec">
      <div class="fl-panor-sum-sec-t">Resumen de uso — quién, cuándo y hasta cuándo (${usos.length})</div>
      ${vivo!==null&&!usos.length?`<div style="font-size:10.5px;color:#B45309;background:#FFFBEB;border:1px solid #FDE68A;border-radius:7px;padding:7px 10px;margin-bottom:6px">Actualmente vinculado a <strong>${vivo}</strong>, pero sin bitácora — probablemente esta vinculación se hizo antes de que existiera este registro.</div>`:''}
      ${usos.length?usos.slice(0,10).map(u=>flRPUsoItem(u)).join(''):`<div style="font-size:11px;color:#94A3B8">Sin registros de vinculación</div>`}
      ${usos.length>10?`<div style="font-size:9.5px;color:#94A3B8;text-align:center;padding:6px 0 0">Mostrando los 10 más recientes de ${usos.length}</div>`:''}
    </div>
  </div>`;
}

window.flRPFoto=function(inp,vehId){
  const f=inp.files[0];if(!f)return;
  if(f.size>800000){alert('La imagen es demasiado grande. Usa una imagen menor a 800KB.');inp.value='';return;}
  const r=new FileReader();
  r.onload=async e=>{
    const b64=e.target.result;
    const v=flV.find(x=>x.id===vehId);
    if(!v)return;
    // Actualizar objeto local siempre
    if(!v.fotos)v.fotos=[];
    v.fotos.push(b64);
    // Guardar en Firestore
    try{
      if(!vehId.startsWith('eco-')){
        // Vehículo ya en Firestore → update
        await fs.updateDoc(fs.doc(db,C.VEHS,vehId),{fotos:v.fotos}).catch(()=>{});
      } else {
        // Vehículo solo en catálogo → crear documento en Firestore
        const {id:newId,...vData}=v;
        const docRef=await fs.addDoc(fs.collection(db,C.VEHS),{...vData,fotos:v.fotos,creadoEn:new Date().toISOString()}).catch(()=>null);
        if(docRef){v.id=docRef.id;flMsgOk('Vehículo registrado en la base de datos con la foto.');}
      }
    }catch(err){console.warn('[FL foto]',err);}
    renderRP(v.id);
  };r.readAsDataURL(f);
};

window.flRPDoc=function(tipo,vehId){
  const labels={tarjeta:'Tarjeta de circulación',poliza:'Póliza de seguro',verificacion:'Verificación ambiental',factura:'Factura del vehículo'};
  const v=flV.find(x=>x.id===vehId);
  const docExistente=v?.[`doc_${tipo}`]||null;
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3300';
  ov.innerHTML=`<div class="fl-modal" style="max-width:500px">
    <div class="fl-mh">
      <div>
        <h3>${I.doc} ${labels[tipo]||tipo}</h3>
        ${docExistente?`<div style="font-size:10px;color:#15803D;margin-top:2px;font-weight:700">✓ Documento guardado</div>`:`<div style="font-size:10px;color:#C2410C;margin-top:2px">Sin documento</div>`}
      </div>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:12px">

      ${docExistente ? `
      <!-- Acciones sobre doc existente -->
      <div style="display:flex;gap:8px">
        <button onclick="flDocPreview('${tipo}','${vehId}')"
          style="flex:1;padding:9px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#15803D;display:flex;align-items:center;justify-content:center;gap:5px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Ver documento
        </button>
        <button onclick="flDocBorrar('${tipo}','${vehId}',this.closest('.fl-ov'))"
          style="padding:9px 14px;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#B91C1C;display:flex;align-items:center;gap:5px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          Borrar
        </button>
      </div>` : ''}

      <!-- Subir / Reemplazar -->
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:8px">
          ${docExistente ? '🔄 Reemplazar documento' : '⬆ Subir documento'} (PDF o imagen, máx. 3 MB)
        </label>
        <div onclick="document.getElementById('fl-doc-f-${tipo}').click()"
          style="border:2px dashed #CBD5E1;border-radius:10px;padding:16px;text-align:center;cursor:pointer;transition:.12s;background:#FAFBFC"
          onmouseover="this.style.borderColor='#2563EB';this.style.background='#EFF6FF'"
          onmouseout="this.style.borderColor='#CBD5E1';this.style.background='#FAFBFC'">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" style="margin-bottom:5px">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div style="font-size:12px;font-weight:700;color:#374151">Clic para seleccionar</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:2px">PDF, JPG, PNG</div>
        </div>
        <input type="file" id="fl-doc-f-${tipo}" accept="image/*,application/pdf" style="display:none" onchange="flDocLoad(this,'${tipo}','${vehId}')">
        <div id="fl-doc-prev" style="margin-top:8px"></div>
      </div>
      <div class="fl-fa"><button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button></div>
    </div>
  </div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};
window.flDocPreview=function(tipo,vehId){
  const v=flV.find(x=>x.id===vehId);
  const b64=v?.[`doc_${tipo}`];
  if(!b64){alert('Documento no encontrado.');return;}
  const labels={tarjeta:'Tarjeta de circulación',poliza:'Póliza de seguro',verificacion:'Verificación ambiental',factura:'Factura del vehículo'};
  const esPDF=b64.startsWith('data:application/pdf');
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3400';
  ov.innerHTML=`<div class="fl-modal" style="max-width:${esPDF?'820':'640'}px;width:100%;${esPDF?'height:90vh;':''}display:flex;flex-direction:column;overflow:hidden">
    <div class="fl-mh" style="flex-shrink:0">
      <span style="font-size:13px;font-weight:700">${labels[tipo]||tipo}</span>
      <div style="display:flex;gap:8px">
        <a href="${b64}" download="${tipo}-veh-${vehId}.${esPDF?'pdf':'jpg'}" style="font-size:11px;font-weight:700;padding:5px 12px;background:#EFF6FF;color:#2563EB;border-radius:7px;text-decoration:none">Descargar</a>
        <button onclick="this.closest('.fl-ov').remove()" style="width:28px;height:28px;border:none;background:#F1F5F9;border-radius:50%;cursor:pointer;font-size:14px">✕</button>
      </div>
    </div>
    ${esPDF
      ? `<iframe src="${b64}" style="flex:1;border:none;border-radius:0 0 12px 12px"></iframe>`
      : `<div style="padding:16px;text-align:center;overflow-y:auto"><img src="${b64}" style="max-width:100%;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15)"></div>`}
  </div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flDocBorrar=async function(tipo,vehId,ovRef){
  if(!confirm(`¿Borrar el documento "${({tarjeta:'Tarjeta de circulación',poliza:'Póliza de seguro',verificacion:'Verificación ambiental',factura:'Factura del vehículo'})[tipo]||tipo}"? Esta acción no se puede deshacer.`))return;
  try{
    const v=flV.find(x=>x.id===vehId);
    if(v) delete v[`doc_${tipo}`];
    if(!vehId.startsWith('eco-')){
      await fs.updateDoc(fs.doc(db,C.VEHS,vehId),{[`doc_${tipo}`]:null});
    }
    ovRef?.remove();
    renderRP(vehId);
  }catch(e){console.error('[FL]',e);alert('Error al borrar: '+e.message);}
};

window.flDocLoad=async function(inp,tipo,vehId){
  const f=inp.files[0];if(!f)return;
  if(f.size>3*1024*1024){alert('El archivo supera 3 MB. Comprime el PDF o imagen antes de subirlo.');inp.value='';return;}
  const r=new FileReader();
  r.onload=async e=>{
    const b64=e.target.result;
    const prev=document.getElementById('fl-doc-prev');
    if(prev){
      if(f.type.startsWith('image'))prev.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px">
        <img src="${b64}" style="width:48px;height:48px;object-fit:cover;border-radius:5px">
        <div><div style="font-size:11px;font-weight:700">${f.name}</div><div style="font-size:10px;color:#B45309">Listo para guardar</div></div>
      </div>`;
      else prev.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div><div style="font-size:11px;font-weight:700">${f.name}</div><div style="font-size:10px;color:#B45309">Listo para guardar</div></div>
      </div>`;
    }
    // Guardar en Firestore
    try{
      const v=flV.find(x=>x.id===vehId);
      if(v) v[`doc_${tipo}`]=b64; // Actualizar objeto local
      if(!vehId.startsWith('eco-')){
        await fs.updateDoc(fs.doc(db,C.VEHS,vehId),{[`doc_${tipo}`]:b64}).catch(()=>{});
      }
      if(prev) prev.innerHTML=`<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
        <div><div style="font-size:11px;font-weight:700;color:#15803D">Documento guardado correctamente</div>
        <button onclick="flDocPreview('${tipo}','${vehId}')" style="font-size:10px;margin-top:3px;background:none;border:none;color:#15803D;font-weight:700;cursor:pointer;padding:0;text-decoration:underline">Ver documento →</button>
        </div>
      </div>`;
      // Actualizar botón en panel derecho
      if(v) renderRP(vehId);
    }catch(err){
      if(prev) prev.innerHTML=`<div style="color:#EF4444;font-size:11px;padding:8px">Error al guardar: ${err.message||'intenta de nuevo'}</div>`;
    }
  };r.readAsDataURL(f);
};

// Modal de edición de datos del vehículo
window.flEditarVeh=function(id){
  const v=flV.find(x=>x.id===id);if(!v)return;
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3300';
  const campos=[
    ['unidad','Unidad (marca y modelo)','text',v.unidad||''],
    ['placas','Placas','text',v.placas||''],
    ['responsable','Responsable asignado','text',v.responsable||''],
    ['plaza','Plaza / Sucursal','text',v.plaza||''],
    ['año','Año modelo','number',v.año||''],
    ['km','KM actual','number',v.km||0],
    ['color','Color','text',v.color||''],
    ['serie','Número de serie (VIN)','text',v.serie||''],
    ['nip','NIP gasolinera','text',v.nip||''],
    ['pol','Número de póliza','text',v.pol||''],
    ['pv','Vencimiento póliza','date',v.pv||''],
    ['rend','Rendimiento (ej: 12 KM/L)','text',v.rend||''],
    ['servicioIntervaloKm','Intervalo servicio (km)','number',v.servicioIntervaloKm||''],
    ['kmUltimoServicio','KM del último servicio','number',v.kmUltimoServicio||''],
  ];
  ov.innerHTML=`<div class="fl-modal" style="max-width:600px;width:100%">
    <div class="fl-mh">
      <div>
        <div style="font-size:15px;font-weight:900">Editar vehículo · ECO ${v.eco}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${v.unidad||'—'}</div>
      </div>
      <button onclick="this.closest('.fl-ov').remove()" style="width:30px;height:30px;border:none;border-radius:50%;background:#F1F5F9;cursor:pointer;font-size:16px;color:#64748B">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${campos.map(([campo,label,type,val])=>`<div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">${label}</label>
          <input id="ve-${campo}" type="${type}" value="${val}" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#2563EB'" onblur="this.style.borderColor='#E2E8F0'">
        </div>`).join('')}
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Estatus</label>
          <select id="ve-status" style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;outline:none">
            <option value="activo" ${(v.status||'activo')==='activo'?'selected':''}>Activo</option>
            <option value="taller" ${v.status==='taller'?'selected':''}>En taller</option>
            <option value="comision" ${v.status==='comision'?'selected':''}>Comisión</option>
            <option value="baja" ${v.status==='baja'?'selected':''}>Baja</option>
          </select>
        </div>
      </div>
      <div class="fl-fa" style="margin-top:4px">
        <button onclick="this.closest('.fl-ov').remove()" class="fb gho" style="padding:9px 20px">Cancelar</button>
        <button onclick="flGuardarEditVeh('${id}')" class="fb acc" id="ve-btn-guardar" style="padding:9px 24px">Guardar cambios</button>
      </div>
      <div id="ve-msg" style="display:none;padding:8px 12px;border-radius:8px;font-size:12px;text-align:center"></div>
    </div>
  </div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flGuardarEditVeh=async function(id){
  const btn=document.getElementById('ve-btn-guardar');
  const msg=document.getElementById('ve-msg');
  const get=f=>document.getElementById('ve-'+f)?.value.trim()||'';
  const data={
    unidad: get('unidad'), placas: get('placas'), responsable: get('responsable'),
    plaza: get('plaza'), año: get('año')||null, km: Number(get('km'))||0,
    color: get('color'), serie: get('serie'), nip: get('nip'),
    pol: get('pol'), pv: get('pv')||null, rend: get('rend'),
    servicioIntervaloKm: Number(get('servicioIntervaloKm'))||null,
    kmUltimoServicio: get('kmUltimoServicio')===''?null:Number(get('kmUltimoServicio')),
    status: document.getElementById('ve-status')?.value||'activo',
  };
  btn.textContent='Guardando…';btn.disabled=true;
  try{
    const vPrev=flV.find(x=>x.id===id);
    const respAnterior=vPrev?.responsable;
    const ecoVeh=vPrev?.eco;
    if(!id.startsWith('eco-')){
      await fs.updateDoc(fs.doc(db,C.VEHS,id),data);
    }
    // Actualizar objeto local
    const v=flV.find(x=>x.id===id);
    if(v) Object.assign(v,data);
    if(ecoVeh&&!id.startsWith('eco-')&&data.responsable&&data.responsable!==respAnterior){
      flDesvincularEcoApp(ecoVeh,data.responsable);
    }
    msg.style.cssText='display:block;background:#DCFCE7;color:#15803D';
    msg.textContent='Cambios guardados correctamente';
    setTimeout(()=>{
      document.querySelector('.fl-ov[style*="3300"]')?.remove();
      renderRP(id);
    },900);
  }catch(e){
    console.error('[FL]',e);
    msg.style.cssText='display:block;background:#FEE2E2;color:#B91C1C';
    msg.textContent='Error al guardar: '+e.message;
    btn.textContent='Guardar cambios';btn.disabled=false;
  }
};


function tSols(list,pA){
  if(!list.length)return`<div class="fl-empty"><div class="fl-empty-ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><h3>Sin solicitudes</h3><p>No hay registros que mostrar.</p></div>`;
  return`<div class="fl-tw"><table class="fl-t"><thead><tr>
    <th>Tipo</th><th>Unidad</th><th>Prioridad</th><th>Solicitante</th><th>Estado</th><th>Fecha</th>${pA?'<th></th>':''}
  </tr></thead><tbody>${list.map(s=>`<tr onclick="flVerSol('${s.id}')">
    <td style="font-weight:700">${s.tipo||'—'}</td>
    <td class="fl-mono">${s.vehiculoEco||'—'}</td>
    <td>${s.prioridad?`<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px;background:${s.prioridad==='Urgente'?'#FEE2E2':s.prioridad==='Alta'?'#FEF3C7':'#F1F5F9'};color:${s.prioridad==='Urgente'?'#B91C1C':s.prioridad==='Alta'?'#B45309':'#475569'}">${s.prioridad}</span>`:'—'}</td>
    <td style="font-size:11px">${s.solicitante||'—'}</td>
    <td>${hBadge(s.estatus)}</td>
    <td style="font-size:10px;color:#94A3B8">${hF(s.creadoEn)}</td>
    ${pA?`<td onclick="event.stopPropagation()">${(s.estatus==='Validada'||s.estatus==='Cotización')?`<div style="display:flex;gap:3px"><button class="fb acc sm" onclick="flAprobar('${s.id}')">${I.check}</button><button class="fb dan sm" onclick="flRechazar('${s.id}')">${I.x}</button></div>`:'—'}</td>`:''}
  </tr>`).join('')}</tbody></table></div>`;
}


// COMPARAR EVIDENCIAS POR VEHÍCULO
window.flCompararEvidencias=async function(vehId){
  const v=flV.find(x=>x.id===vehId);
  const candidatas=flSolsDeVehiculo(v);
  await Promise.all(candidatas.map(s=>flCargarEvidenciasSol(s)));
  const sols=candidatas.filter(s=>s.evidencias?.length);
  if(!sols.length){flMsgInfo('Sin evidencias para comparar.');return;}
  const ov=document.createElement('div');ov.className='fl-ov';
  let html=`<div style="background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,.3)">
    <div style="padding:16px 20px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #F1F5F9;position:sticky;top:0;background:#fff;z-index:2">
      <div>
        <div style="font-size:15px;font-weight:800">Comparar evidencias · ECO ${v?.eco||'—'}</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${v?.unidad||''} · ${sols.reduce((a,s)=>a+(s.evidencias?.length||0),0)} fotos en ${sols.length} solicitudes</div>
      </div>
      <button onclick="this.closest('.fl-ov').remove()" style="width:26px;height:26px;border:none;background:#F1F5F9;border-radius:6px;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div style="padding:16px 20px">`;

  sols.forEach(s=>{
    const metas=s.evidenciasMeta||[];
    html+=`<div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">${s.tipo||'—'}</div>
        <div style="font-size:10px;color:#94A3B8">·</div>
        <div style="font-size:10px;color:#94A3B8">${s.creadoEn?s.creadoEn.substring(0,10):'—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
        ${(s.evidencias||[]).map((src,i)=>{
          const m=metas[i];
          return`<div style="border-radius:9px;overflow:hidden;border:1px solid #E8EDF5;cursor:pointer" onclick="flVerEvidencia({src:'${src}',meta:${m?JSON.stringify(m):'null'}})">
            <img src="${src}" style="width:100%;height:100px;object-fit:cover;display:block">
            <div style="padding:6px 8px;background:#F8FAFD">
              <div style="font-size:9px;font-weight:700;color:#2563EB;font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m?.codigo||('Foto '+(i+1))}</div>
              <div style="font-size:9px;color:#64748B;margin-top:1px">${m?.fecha||'—'}</div>
              ${m?.gps?`<div style="font-size:8.5px;color:#94A3B8;margin-top:1px;font-family:'JetBrains Mono',monospace">${m.gps.lat}, ${m.gps.lng}</div>`:'<div style="font-size:8.5px;color:#EF4444;margin-top:1px">Sin GPS</div>'}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  html+=`</div></div>`;
  ov.innerHTML=html;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};



// VER SOLICITUD EXISTENTE
window.flVerSol=async function(id){
  const s=flS.find(x=>x.id===id);if(!s)return;
  // Cargar archivos de subcolecciones en paralelo
  const [archEval, archServ] = await Promise.all([
    flCargarArchivosSubcol(id,'archivos_evaluacion'),
    flCargarArchivosSubcol(id,'archivos_servicio'),
  ]);
  await flCargarEvidenciasSol(s); // fotos/daños/checklist (formato nuevo, si aplica)
  s._archivosEvaluacion = archEval;
  s._archivosServicio   = archServ;
  const v=flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId);
  const pV=hP('validar'),pA=hP('aprobar'),pE=hP('eliminar');
  const dan=s.danos||{};const hasDan=Object.values(dan).some(a=>a?.length>0);
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3300';
  ov.innerHTML=`<div class="fl-modal" style="max-width:600px">
    <div class="fl-mh"><h3>${I.doc} ${id.slice(0,8).toUpperCase()}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      ${v?`<div style="background:#0A1628;color:#fff;border-radius:9px;padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;gap:12px"><span style="display:flex;align-items:center">${hEmo(v.tipo).split('stroke="currentColor"').join('stroke="#fff"')}</span><div><div style="font-size:13px;font-weight:800">${v.unidad||'—'} ${v.año||''}</div><div style="font-size:10px;color:rgba(255,255,255,.4);font-family:'JetBrains Mono',monospace;margin-top:2px">ECO ${v.eco} · ${v.placas||'—'} · ${v.responsable||'—'}</div></div></div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:9px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:10px">
        ${[['Tipo',s.tipo||'—'],['Estado',hBadge(s.estatus)],['Prioridad',s.prioridad||'Normal'],['Gasolina',s.gasolina!=null?s.gasolina+'%':'—'],['Taller',s.taller||'—'],['KM',s.kilometrajeReportado||'—'],['Solicitante',s.solicitante||'—'],['Fecha',hF(s.creadoEn)]].map(([l,val])=>`<dl style="padding:7px 11px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</dt><dd style="font-size:11.5px;font-weight:600">${val}</dd></dl>`).join('')}
        <dl style="grid-column:1/-1;padding:7px 11px"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">Descripción</dt><dd style="font-size:11.5px;font-weight:500">${s.descripcion||'—'}</dd></dl>
      </div>
      ${s.comentarioRechazo?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:7px;padding:8px 11px;font-size:11px;color:#991B1B;margin-bottom:9px"><strong>Rechazo:</strong> ${s.comentarioRechazo}</div>`:''}
      ${(()=>{
        const userEmail=(window.auth?.currentUser?.email||'').toLowerCase();
        const esFatima=userEmail==='fatima@tecnocontrol.com.mx';
        const esAdmin=hP('validar')||hP('aprobar');
        const puedeAgregarDocs=esAdmin&&['Cerrada','Rechazada'].includes(s.estatus);
        if(!puedeAgregarDocs)return'';
        return'<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px;margin-bottom:10px">'+
          '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#92400E;margin-bottom:8px">Agregar documentos (admin)</div>'+
          '<div id="fl-doc-list-'+s.id+'" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px"></div>'+
          '<button onclick="flAgregarDocCerrada(\''+s.id+'\')" style="padding:7px 14px;background:#D97706;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:11px;font-weight:800;cursor:pointer">+ Subir factura / documento</button>'+
        '</div>';
      })()}
      ${s._archivosEvaluacion?.length||pV||pA?`
        <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px">
          <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Documentos de evaluación (${s._archivosEvaluacion?.length||0})</div>
          ${(pV||pA)?`<button onclick="flActualizarEvidenciaEtapa('${s.id}','archivos_evaluacion','Evaluación')" style="font-size:9.5px;font-weight:700;color:#1D4ED8;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit">+ Actualizar evidencia</button>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${(()=>{
            if(!window._flArchCache)window._flArchCache=[];
            return (s._archivosEvaluacion||[]).map(a=>{
              const idx=window._flArchCache.length; window._flArchCache.push(a);
              return`<div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${a.tipo==='pdf'?'#B91C1C':'#1D4ED8'}" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style="font-size:11px;font-weight:600;flex:1;cursor:pointer" onclick="flVerArchivo(window._flArchCache[${idx}].datos,window._flArchCache[${idx}].nombre)">${a.nombre||'Archivo'}</span>
              <span style="font-size:10px;color:#94A3B8">${a.kb||''}KB</span>
              <button onclick="flVerArchivo(window._flArchCache[${idx}].datos,window._flArchCache[${idx}].nombre)" style="font-size:10px;color:#374151;font-weight:700;background:#F1F5F9;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit">Ver</button>
              ${a.datos?`<a href="${a.datos}" download="${a.nombre||'archivo'}" style="font-size:10px;color:#2563EB;font-weight:700;text-decoration:none">Descargar</a>`:''}
              ${(pV||pA)?`<button onclick="flBorrarArchivoEtapa('${s.id}','archivos_evaluacion','${a.id}','Evaluación')" style="font-size:10px;color:#B91C1C;font-weight:700;background:#FEF2F2;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit">Borrar</button>`:''}
            </div>`;
            }).join('');
          })()}
        </div>`:''}
      ${s._archivosServicio?.length||pV||pA?`
        <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px">
          <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Documentos de servicio (${s._archivosServicio?.length||0})</div>
          ${(pV||pA)?`<button onclick="flActualizarEvidenciaEtapa('${s.id}','archivos_servicio','Servicio')" style="font-size:9.5px;font-weight:700;color:#B45309;background:#FFFBEB;border:1px solid #FDE68A;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit">+ Actualizar evidencia</button>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px">
          ${(()=>{
            if(!window._flArchCache)window._flArchCache=[];
            return (s._archivosServicio||[]).map(a=>{
              const idx=window._flArchCache.length; window._flArchCache.push(a);
              return`<div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${a.tipo==='pdf'?'#B91C1C':'#1D4ED8'}" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span style="font-size:11px;font-weight:600;flex:1;cursor:pointer" onclick="flVerArchivo(window._flArchCache[${idx}].datos,window._flArchCache[${idx}].nombre)">${a.nombre||'Archivo'}</span>
              <span style="font-size:10px;color:#94A3B8">${a.kb||''}KB</span>
              <button onclick="flVerArchivo(window._flArchCache[${idx}].datos,window._flArchCache[${idx}].nombre)" style="font-size:10px;color:#374151;font-weight:700;background:#F1F5F9;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit">Ver</button>
              ${a.datos?`<a href="${a.datos}" download="${a.nombre||'archivo'}" style="font-size:10px;color:#2563EB;font-weight:700;text-decoration:none">Descargar</a>`:''}
              ${(pV||pA)?`<button onclick="flBorrarArchivoEtapa('${s.id}','archivos_servicio','${a.id}','Servicio')" style="font-size:10px;color:#B91C1C;font-weight:700;background:#FEF2F2;border:none;border-radius:6px;padding:3px 8px;cursor:pointer;font-family:inherit">Borrar</button>`:''}
            </div>`;
            }).join('');
          })()}
        </div>`:''}
      ${hasDan?`<div class="fl-sep"></div>
        <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:7px">Diagrama de daños</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;pointer-events:none">
          ${VISTAS.map(vista=>{
            const pts=dan[vista]||[];
            return`<div style="border:1.5px solid #E2E8F0;border-radius:8px;overflow:hidden">
              <div style="padding:4px 8px;background:#F8FAFD;border-bottom:1px solid #E8EDF5;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">${VISTA_NOM[vista]} ${pts.length?`· ${pts.length} daño(s)`:''}</div>
              <div style="position:relative;background:#F0F4F8">
                ${getImgSrc(s.tipoUnidad||'auto',vista)}
                ${pts.map((p,i)=>`<div style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);pointer-events:none">
                  <div style="width:18px;height:18px;border-radius:50%;background:#EF4444;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;color:#fff;box-shadow:0 2px 6px rgba(239,68,68,.5)">${i+1}</div>
                </div>`).join('')}
              </div>
            </div>`;
          }).join('')}
        </div>`:''}
      ${(()=>{
        // EVIDENCIAS GENERALES — array global evita base64 inline en onclick
        if(!s.evidencias?.length && !(pV||pA))return'';
        if(!window._flEvCache)window._flEvCache=[];
        if(!window._flEvCache)window._flEvCache=[];
        const baseIdx=window._flEvCache.length;
        (s.evidencias||[]).forEach((src,i)=>{const meta=(s.evidenciasMeta||[])[i];window._flEvCache.push({src,meta:meta||null});});
        const pills=(s.evidencias||[]).map((src,i)=>{
          const meta=(s.evidenciasMeta||[])[i];
          const cod=meta?.codigo||('Foto '+(i+1));
          return`<span class="fl-pill" style="cursor:pointer;display:inline-flex;align-items:center;">
            <span onclick="flVerEvIdx(${baseIdx+i})" style="display:inline-flex;align-items:center">
              <img src="${src}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;margin-right:4px">
              <span style="font-size:10px;font-family:'JetBrains Mono',monospace">${cod}</span>
            </span>
            ${(pV||pA)?`<span onclick="event.stopPropagation();flBorrarEvidenciaSolicitud('${s.id}',${i})" style="margin-left:5px;color:#B91C1C;font-weight:800;cursor:pointer;padding:0 3px">✕</span>`:''}
          </span>`;
        }).join('');
        return`<div class="fl-sep"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8">Evidencias generales (${s.evidencias?.length||0})</div>
            ${(pV||pA)?`<button onclick="flActualizarEvidenciaSolicitud('${s.id}')" style="font-size:9.5px;font-weight:700;color:#6D28D9;background:#EDE9FE;border:1px solid #DDD6FE;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit">+ Actualizar evidencia</button>`:''}
          </div>
          <div class="fl-pills" style="display:flex;flex-wrap:wrap;gap:6px">${pills}</div>`;
      })()}
      ${(()=>{
        const chkF=s.chkFotos||{};
        const chkEntries=Object.entries(chkF).filter(([k,v])=>v);
        if(!chkEntries.length)return'';
        if(!window._flEvCache)window._flEvCache=[];
        if(!window._flEvCache)window._flEvCache=[];
        const baseIdx=window._flEvCache.length;
        chkEntries.forEach(([k,src])=>{
          let label=k;
          for(const items of Object.values(CHK_CATS)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f){label=f;break;}}
          window._flEvCache.push({src,meta:{
            codigo:label,
            tipo:'checklist',
            eco:s.vehiculoEco||'—',
            unidad:v?.unidad||s.vehiculo||'—',
            usuario:s.solicitante||s.creadoPor||'—',
            fecha:s.creadoEn?s.creadoEn.substring(0,10):'—',
            hora:s.creadoEn?new Date(s.creadoEn).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'—',
            modo:s.modo||'—',
          }});
        });
        const pills=chkEntries.map(([k,src],i)=>{
          let label=k;
          for(const items of Object.values(CHK_CATS)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f){label=f;break;}}
          return`<span class="fl-pill" onclick="flVerEvIdx(${baseIdx+i})" style="cursor:pointer;background:#EFF6FF;border:1px solid #BFDBFE">
            <img src="${src}" style="width:28px;height:28px;object-fit:cover;border-radius:4px;margin-right:4px">
            <span style="font-size:9px;font-family:'JetBrains Mono',monospace;color:#1D4ED8;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
          </span>`;
        }).join('');
        return`<div style="margin-top:8px">
          <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#2563EB;margin-bottom:8px">Fotos de checklist (${chkEntries.length})</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">${pills}</div>
        </div>`;
      })()}
      ${(()=>{
        const chk=s.checklist||{};
        const noItems=Object.entries(chk).filter(([k,v])=>v==='no');
        const siItems=Object.entries(chk).filter(([k,v])=>v==='si');
        if(!noItems.length&&!siItems.length)return'';
        const getLabel=k=>{for(const items of Object.values(CHK_CATS)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
        if(!noItems.length)return`<div style="margin-top:8px;padding:8px 12px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;font-size:11.5px;font-weight:700;color:#15803D">${I.check} Checklist: todos los ${siItems.length} puntos revisados en buen estado</div>`;
        return`<div style="margin-top:8px;padding:8px 12px;background:#FEF2F2;border-radius:8px;border:1px solid #FECACA">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#B91C1C;margin-bottom:6px">Puntos con observaciones (${noItems.length})</div>
          ${noItems.map(([k])=>`<div style="font-size:11px;font-weight:600;color:#991B1B;padding:2px 0">• ${getLabel(k)}</div>`).join('')}
        </div>`;
      })()}
      <div class="fl-sep"></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px">
        ${pV&&s.estatus==='Solicitud'?`<button class="fb acc" onclick="this.closest('.fl-ov').remove();flModalEvaluacion('${s.id}')">${I.check} Evaluar →</button>`:''}
        ${pV&&['Evaluación','Validación','Validada','Cotización','Aprobación','Aprobada'].includes(s.estatus)?`<button class="fb acc" onclick="this.closest('.fl-ov').remove();flModalServicio('${s.id}')">→ Servicio</button>`:''}
        ${pV&&['Servicio','Pagos','Cierre'].includes(s.estatus)?`
          <button class="fb" onclick="this.closest('.fl-ov').remove();flModalServicio('${s.id}')" style="background:#B45309;color:#fff;border:none">+ Agregar docs / avance</button>
          <button class="fb acc" onclick="this.closest('.fl-ov').remove();flModalServicio('${s.id}')" id="btn-cerrar-exp">→ Cerrar expediente</button>
        `:''}
        ${pV&&s.estatus==='Solicitud'?`<button class="fb dan" onclick="this.closest('.fl-ov').remove();flModalRechazar('${s.id}','validacion')">${I.x} Rechazar</button>`:''}
        ${s.estatus==='Cerrada'?`<button class="fb" style="background:#0A1628;color:#fff;border:none;display:inline-flex;align-items:center;gap:5px" onclick="this.closest('.fl-ov').remove();flResumenFinal('${s.id}')">${I.eye} Ver resumen</button>`:''}
        ${pE?`<button class="fb dan" style="margin-left:auto" onclick="flElim('${s.id}');this.closest('.fl-ov').remove()">${I.trash}</button>`:''}
        <button class="fb" onclick="this.closest('.fl-ov').remove();flModalTareas('${s.id}')" style="background:#7C3AED;color:#fff;border:none;display:inline-flex;align-items:center;gap:5px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          Tareas
        </button>
        <button class="fb gho" style="display:inline-flex;align-items:center;gap:5px" onclick="flGenerarPDF('${s.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          PDF
        </button>
        <button style="padding:7px 12px;background:#25D366;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#fff;display:inline-flex;align-items:center;gap:5px" onclick="flCompartirWA('${s.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.855L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.659-.52-5.17-1.426l-.371-.22-3.763.981.999-3.668-.242-.379A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
          WhatsApp
        </button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

// ── COMISIONES ──
function rComis(){
  setContent(padded(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div><div style="font-size:17px;font-weight:900;letter-spacing:-.4px">Utilitarios</div><div style="font-size:11px;color:#64748B;margin-top:2px">Vehículos prestados y uso general</div></div>
      <button class="fb acc" onclick="flAbrirCom()">${I.plus} Registrar utilitario</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <select style="padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:12px;background:#fff;outline:none" id="fl-ct" onchange="flFCom()"><option value="">Todos</option><option>Corto plazo</option><option>Largo plazo</option></select>
      <select style="padding:7px 11px;border:1.5px solid #E2E8F0;border-radius:7px;font-family:inherit;font-size:12px;background:#fff;outline:none" id="fl-ce" onchange="flFCom()"><option value="">Todos los estados</option><option>En préstamo</option><option>Devuelto</option></select>
    </div>
    <div id="fl-com-r">${rComList(flCom)}</div>

    <!-- ── HISTORIAL DE TRANSFERENCIAS ── -->
    <div style="margin-top:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <div style="font-size:15px;font-weight:900;letter-spacing:-.3px">
            Transferencias entre técnicos
            ${flTrans.filter(t=>t.estatus==='Pendiente recepción').length?`<span style="background:#F59E0B;color:#fff;font-size:10px;font-weight:800;border-radius:12px;padding:2px 9px;margin-left:8px">${flTrans.filter(t=>t.estatus==='Pendiente recepción').length} pendiente(s)</span>`:''}
          </div>
          <div style="font-size:11px;color:#64748B;margin-top:2px">${flTrans.length} registro(s) · desde la app móvil</div>
        </div>
        <button onclick="flExportarTransCSV()" style="display:flex;align-items:center;gap:6px;padding:7px 14px;background:#F8FAFD;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:11.5px;font-weight:700;color:#475569;cursor:pointer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Exportar CSV
        </button>
      </div>

      <!-- FILTROS -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-bottom:12px;align-items:end">
        <div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:4px">ECO / Vehículo</div>
          <input id="fl-tf-eco" placeholder="Ej: 39, RAM 700…" oninput="flFTrans()"
            style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:4px">Persona</div>
          <input id="fl-tf-persona" placeholder="Nombre o email…" oninput="flFTrans()"
            style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:4px">Fecha</div>
          <input id="fl-tf-fecha" type="date" oninput="flFTrans()"
            style="width:100%;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;outline:none;box-sizing:border-box">
        </div>
        <div>
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:4px">Estado</div>
          <select id="fl-tf-est" onchange="flFTrans()"
            style="padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;background:#fff;outline:none;height:36px">
            <option value="">Todos</option>
            <option value="Pendiente recepción">Pendiente</option>
            <option value="Completada">Completada</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:12px">
        <button onclick="flFTransReset()" style="padding:5px 12px;background:#F1F5F9;border:none;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;color:#64748B;cursor:pointer">Limpiar filtros</button>
        <span id="fl-trans-count" style="font-size:11px;color:#94A3B8;align-self:center"></span>
      </div>
      <div id="fl-trans-r">${rTransListFiltrada(flTrans)}</div>
    </div>
  `));
}
window.flFCom=function(){const t=document.getElementById('fl-ct')?.value||'';const e=document.getElementById('fl-ce')?.value||'';let r=flCom;if(t)r=r.filter(c=>c.tipo===t);if(e)r=r.filter(c=>c.estatus===e);document.getElementById('fl-com-r').innerHTML=rComList(r);};
function rComList(list){
  if(!list.length)return`<div class="fl-empty"><div class="fl-empty-ico">${SVG_AUTO}</div><h3>Sin comisiones</h3></div>`;
  return list.map(c=>`<div class="fl-comcard" onclick="flVerCom('${c.id}')">
    <div class="fl-comcard-h"><div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center">${hEmo(flV.find(v=>v.eco===c.vehiculoEco)?.tipo||'auto')}</span><div><div style="font-size:13px;font-weight:800">ECO ${c.vehiculoEco||'—'} · ${c.vehiculo?.split('·')[1]?.trim()||''}</div><div style="font-size:11px;color:#64748B;margin-top:1px">${c.tipo||'—'} · ${c.responsable||'—'}</div></div></div>${hBadge(c.estatus||'En préstamo')}</div>
    <div class="fl-comcard-b">${[['Fecha entrega',hF(c.fechaEntrega)],['Fecha regreso',c.fechaRegreso?hF(c.fechaRegreso):'—'],['KM entrega',c.kmEntrega||'—']].map(([l,v])=>`<dl><dt style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</dt><dd style="font-size:12px;font-weight:600">${v}</dd></dl>`).join('')}</div>
  </div>`).join('');
}
// ── RECIBIR TRANSFERENCIA DESDE PORTAL (almacén/encargado) ──
window.flRecibirTransferencia = function(id) {
  const t = flTrans.find(x => x.id === id); if (!t) return;
  const fotos=t.entregaFotos||[];
  const chk=t.entregaChk||{};
  const totalChk=Object.keys(chk).length;
  const okChk=Object.values(chk).filter(Boolean).length;
  const ov=document.createElement('div');ov.className='fl-ov';ov.id='fl-recibir-ov';
  ov.innerHTML=`<div class="fl-modal" style="max-width:520px">
    <div class="fl-mh"><h3>Revisar antes de recibir</h3><button class="fl-mx" onclick="document.getElementById('fl-recibir-ov').remove()">✕</button></div>
    <div style="padding:16px 20px">
      <div style="font-size:13px;font-weight:800;margin-bottom:10px">ECO ${t.vehiculoEco||'—'} · ${t.vehiculoUnidad||''}</div>
      <div style="display:flex;align-items:center;gap:10px;background:#F8FAFC;border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="flex:1"><div style="font-size:9.5px;color:#94A3B8;font-weight:800;text-transform:uppercase">Entrega</div><div style="font-size:13px;font-weight:700">${t.entregaNombre||'—'}</div></div>
        <div style="color:#CBD5E1">→</div>
        <div style="flex:1;text-align:right"><div style="font-size:9.5px;color:#94A3B8;font-weight:800;text-transform:uppercase">Recibe</div><div style="font-size:13px;font-weight:700;color:#15803D">${window.auth?.currentUser?.displayName||window.auth?.currentUser?.email||'—'}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:#F8FAFC;border-radius:9px;padding:9px 11px"><div style="font-size:9.5px;color:#94A3B8;font-weight:700">KM entrega</div><div style="font-size:13px;font-weight:800">${t.entregaKm||'—'}</div></div>
        <div style="background:#F8FAFC;border-radius:9px;padding:9px 11px"><div style="font-size:9.5px;color:#94A3B8;font-weight:700">Combustible</div><div style="font-size:13px;font-weight:800">${t.entregaGasolina!=null?t.entregaGasolina+'%':'—'}</div></div>
      </div>
      ${totalChk?`<div style="background:${okChk===totalChk?'#F0FDF4':'#FEF2F2'};border:1px solid ${okChk===totalChk?'#BBF7D0':'#FECACA'};border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12px;font-weight:700;color:${okChk===totalChk?'#15803D':'#B91C1C'}">Checklist de entrega: ${okChk}/${totalChk} puntos en buen estado</div>`:''}
      ${fotos.length?`<div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:6px">Fotos de quien entrega (${fotos.length})</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">${fotos.map(f=>`<img src="${f}" onclick="flLightbox('${f}')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:7px;border:1px solid #E2E8F0;cursor:pointer">`).join('')}</div>`:`<div style="font-size:12px;color:#94A3B8;margin-bottom:12px">Sin fotos adjuntas.</div>`}
      ${t.comentarioEntrega?`<div style="background:#EFF6FF;border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12px;color:#1E40AF"><strong>Comentario:</strong> ${t.comentarioEntrega}</div>`:''}
      <label style="font-size:9.5px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Comentario de recepción (opcional)</label>
      <textarea id="fl-recibir-comentario" rows="2" style="width:100%;box-sizing:border-box;padding:8px 11px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;margin-bottom:14px"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="fb gho sm" onclick="document.getElementById('fl-recibir-ov').remove()">Cancelar</button>
        <button class="fb acc" onclick="flRecibirTransferenciaConfirmada('${id}')">Todo coincide, recibir</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.onclick=(e)=>{if(e.target===ov)ov.remove();};
};

window.flRecibirTransferenciaConfirmada = async function(id) {
  const t = flTrans.find(x => x.id === id); if (!t) return;
  const quien = window.auth?.currentUser?.displayName || window.auth?.currentUser?.email || 'Portal';
  const comentario = document.getElementById('fl-recibir-comentario')?.value||'';
  document.getElementById('fl-recibir-ov')?.remove();
  try {
    await fs.updateDoc(fs.doc(db, C.TRANS, id), {
      estatus: 'Completada',
      recibioNombre: quien,
      recibioEmail: window.auth?.currentUser?.email || '',
      recibioEn: new Date().toISOString(),
      comentarioRecepcionPortal: comentario || '',
      recibidoPorPortal: true,
    });
    // Actualizar vehículo en Firestore — nuevo responsable = quien recibe en almacén
    const vSnap = await fs.getDocs(fs.query(fs.collection(db, C.VEHS), fs.where('eco', '==', String(t.vehiculoEco))));
    if (!vSnap.empty) {
      const vDoc = vSnap.docs[0];
      const respAnterior = vDoc.data().responsable;
      await fs.updateDoc(vDoc.ref, {
        status: 'activo',
        responsable: quien,
        actualizadoEn: new Date().toISOString(),
      });
      // Mantener la copia local al día de inmediato (el listener en vivo también la sincroniza)
      const vLocal = flV.find(x => String(x.eco) === String(t.vehiculoEco));
      if (vLocal) { vLocal.status = 'activo'; vLocal.responsable = quien; }
      if (quien !== respAnterior) flDesvincularEcoApp(t.vehiculoEco, quien);
    }
    flToast('Transferencia recibida correctamente', 'ok');
    await ldTrans();
    rComis();
  } catch(e) { alert('Error al recibir: ' + e.message); }
};

// ── AGREGAR DOCUMENTO A SOLICITUD CERRADA (admin, no Fátima) ──
// (La previsualización usa window.flVerArchivo(b64, nombre), definida
// más abajo en "VISOR DE ARCHIVOS" — no duplicar aquí.)

// ── Borrar UN archivo de una subcolección (Evaluación/Servicio) sin
// afectar a los demás — carga todos, quita el borrado, guarda el resto.
window.flBorrarArchivoEtapa = async function(solId, subcol, archivoId, tituloEtapa){
  if(!confirm('¿Borrar este documento de '+tituloEtapa+'? No se puede deshacer.')) return;
  try{
    const existentes = await flCargarArchivosSubcol(solId, subcol);
    const restantes = existentes.filter(a=>a.id!==archivoId);
    await flGuardarArchivosSubcol(solId, subcol, restantes);
    flToast('Documento eliminado','ok');
    document.querySelector('.fl-ov[style*="3300"]')?.remove();
    window.flVerSol(solId);
  }catch(e){ flToast('Error: '+e.message,'err'); }
};

// ── Borrar UNA evidencia general (etapa Solicitud) por índice ──
window.flBorrarEvidenciaSolicitud = async function(solId, idx){
  if(!confirm('¿Borrar esta evidencia? No se puede deshacer.')) return;
  try{
    const s=flS.find(x=>x.id===solId); if(!s) return;
    const evidenciasActualizadas=(s.evidencias||[]).filter((_,i)=>i!==idx);
    const metaActualizada=(s.evidenciasMeta||[]).filter((_,i)=>i!==idx);
    await fs.updateDoc(fs.doc(db,C.SOLS,solId),{evidencias:evidenciasActualizadas,evidenciasMeta:metaActualizada});
    s.evidencias=evidenciasActualizadas; s.evidenciasMeta=metaActualizada;
    flToast('Evidencia eliminada','ok');
    document.querySelector('.fl-ov[style*="3300"]')?.remove();
    window.flVerSol(solId);
  }catch(e){ flToast('Error: '+e.message,'err'); }
};

window.flAgregarDocCerrada = function(solId) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.multiple = true;
  inp.onchange = async () => {
    for (const file of Array.from(inp.files)) {
      try {
        const b64 = await flLeerArchivo(file, 10);
        await flGuardarArchivosSubcol(solId, 'archivos_servicio', [{
          nombre: file.name,
          datos: b64,
          tipo: file.type.includes('pdf') ? 'pdf' : 'img',
          kb: Math.round(file.size / 1024),
        }]);
        flToast('Documento agregado: ' + file.name, 'ok');
        // Reabrir modal para reflejar cambios
        document.querySelector('.fl-ov[style*="3300"]')?.remove();
        window.flVerSol(solId);
      } catch(e) { flToast('Error: ' + e.message, 'err'); }
    }
  };
  inp.click();
};

// ── Actualizar evidencia por etapa (Solicitud/Evaluación/Servicio) ──
// A diferencia de flAgregarDocCerrada, éstas cargan primero los archivos
// existentes de la subcolección y los conservan (flGuardarArchivosSubcol
// reemplaza TODO el contenido de la subcolección, así que hay que
// combinarlos aquí antes de guardar, o se perdería lo ya subido).
window.flActualizarEvidenciaEtapa = function(solId, subcol, tituloEtapa) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*,application/pdf'; inp.multiple = true;
  inp.onchange = async () => {
    if (!inp.files.length) return;
    try {
      flToast('Subiendo evidencia de ' + tituloEtapa + '…', 'info');
      const existentes = await flCargarArchivosSubcol(solId, subcol);
      const nuevos = [];
      for (const file of Array.from(inp.files)) {
        const b64 = await flLeerArchivo(file, 10);
        nuevos.push({
          nombre: file.name,
          datos: b64,
          tipo: file.type.includes('pdf') ? 'pdf' : 'img',
          kb: Math.round(file.size / 1024),
        });
      }
      await flGuardarArchivosSubcol(solId, subcol, [...existentes, ...nuevos]);
      flToast('Evidencia de ' + tituloEtapa + ' actualizada', 'ok');
      document.querySelector('.fl-ov[style*="3300"]')?.remove();
      window.flVerSol(solId);
    } catch(e) { flToast('Error: ' + e.message, 'err'); }
  };
  inp.click();
};

// Evidencia de la etapa "Solicitud" no vive en subcolección — son los
// arrays evidencias/evidenciasMeta directamente en el documento.
window.flActualizarEvidenciaSolicitud = function(solId) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = async () => {
    if (!inp.files.length) return;
    try {
      flToast('Subiendo evidencia de Solicitud…', 'info');
      const s = flS.find(x => x.id === solId); if (!s) return;
      const nuevasImgs = [], nuevasMeta = [];
      const base = (s.evidencias || []).length;
      for (const file of Array.from(inp.files)) {
        const b64 = await flLeerArchivo(file, 10);
        nuevasImgs.push(b64);
        nuevasMeta.push({ codigo: 'Foto ' + (base + nuevasImgs.length), fecha: new Date().toISOString() });
      }
      const evidenciasActualizadas = [...(s.evidencias || []), ...nuevasImgs];
      const metaActualizada = [...(s.evidenciasMeta || []), ...nuevasMeta];
      await fs.updateDoc(fs.doc(db, C.SOLS, solId), { evidencias: evidenciasActualizadas, evidenciasMeta: metaActualizada });
      s.evidencias = evidenciasActualizadas; s.evidenciasMeta = metaActualizada;
      flToast('Evidencia de Solicitud actualizada', 'ok');
      document.querySelector('.fl-ov[style*="3300"]')?.remove();
      window.flVerSol(solId);
    } catch(e) { flToast('Error: ' + e.message, 'err'); }
  };
  inp.click();
};

// ── HISTORIAL DE TRANSFERENCIAS — filtros y exportación ─────────
function rTransListFiltrada(lista){
  if(!lista||!lista.length)return`<div style="padding:20px;text-align:center;color:#94A3B8;font-size:12px">Sin transferencias registradas</div>`;
  // Pendientes primero, luego por fecha desc
  const ord=[...lista].sort((a,b)=>{
    if(a.estatus==='Pendiente recepción'&&b.estatus!=='Pendiente recepción')return -1;
    if(b.estatus==='Pendiente recepción'&&a.estatus!=='Pendiente recepción')return 1;
    return(b.creadoEn||'').localeCompare(a.creadoEn||'');
  });
  return`<div style="display:flex;flex-direction:column;gap:8px">${ord.map(t=>{
    const isPend=t.estatus==='Pendiente recepción';
    const borde=isPend?'2px solid #F59E0B':'1px solid #E8EDF5';
    const bg=isPend?'#FFFBEB':'#fff';
    const fecha=(t.creadoEn||'').substring(0,10)||'—';
    const fotos=(t.entregaFotos||t.fotos||[]).slice(0,4);
    return`<div style="background:${bg};border:${borde};border-radius:12px;padding:14px 16px;cursor:pointer" onclick="flVerTrans('${t.id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:9px;background:${isPend?'#FEF3C7':'#EFF6FF'};display:flex;align-items:center;justify-content:center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isPend?'#B45309':'#2563EB'}" stroke-width="2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
          </div>
          <div>
            <div style="font-size:13px;font-weight:800;color:#0A1628">ECO ${t.vehiculoEco||'—'} · ${t.vehiculoUnidad||'—'}</div>
            <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:#94A3B8;margin-top:1px">${t.codigo||'—'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;color:#94A3B8">${fecha}</span>
          <span style="padding:3px 10px;border-radius:100px;font-size:10px;font-weight:800;background:${isPend?'#FEF3C7':'#DCFCE7'};color:${isPend?'#B45309':'#15803D'}">${t.estatus||'—'}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;background:#F8FAFD;border-radius:8px;padding:8px">
        <div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:2px">Entrega</div>
          <div style="font-size:11.5px;font-weight:600;color:#0A1628;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.entregaNombre||t.entregaEmail||'—'}</div></div>
        <div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:2px">Recibe</div>
          <div style="font-size:11.5px;font-weight:600;color:${isPend?'#B45309':'#0A1628'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.recibioNombre||t.recibioEmail||(isPend?'Pendiente':'—')}</div></div>
        <div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:2px">KM · Gas</div>
          <div style="font-size:11.5px;font-weight:600;color:#0A1628">${t.entregaKm||t.km||'—'} · ${t.entregaGasolina!=null?t.entregaGasolina+'%':'—'}</div></div>
      </div>
      ${fotos.length?`<div style="display:flex;gap:5px;margin-top:8px">${fotos.map(f=>`<img src="${f}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid #E8EDF5">`).join('')}${(t.entregaFotos||t.fotos||[]).length>4?`<div style="width:44px;height:44px;border-radius:6px;background:#F1F5F9;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#64748B">+${(t.entregaFotos||t.fotos||[]).length-4}</div>`:''}
      </div>`:''}
      ${isPend?`<div style="margin-top:8px;padding:6px 10px;background:#FEF3C7;border-radius:7px;font-size:11px;font-weight:700;color:#B45309">Esperando que el receptor confirme con el código ${t.codigo||'—'}</div>`:''}
    </div>`;
  }).join('')}</div>`;
}

window.flFTrans=function(){
  const eco=(document.getElementById('fl-tf-eco')?.value||'').toLowerCase().trim();
  const persona=(document.getElementById('fl-tf-persona')?.value||'').toLowerCase().trim();
  const fecha=(document.getElementById('fl-tf-fecha')?.value||'').trim();
  const est=(document.getElementById('fl-tf-est')?.value||'').trim();
  let filtradas=flTrans;
  if(eco)filtradas=filtradas.filter(t=>String(t.vehiculoEco||'').toLowerCase().includes(eco)||(t.vehiculoUnidad||'').toLowerCase().includes(eco));
  if(persona)filtradas=filtradas.filter(t=>
    (t.entregaNombre||'').toLowerCase().includes(persona)||
    (t.entregaEmail||'').toLowerCase().includes(persona)||
    (t.recibioNombre||'').toLowerCase().includes(persona)||
    (t.recibioEmail||'').toLowerCase().includes(persona)||
    (t.receptorNombre||'').toLowerCase().includes(persona)
  );
  if(fecha)filtradas=filtradas.filter(t=>(t.creadoEn||'').startsWith(fecha));
  if(est)filtradas=filtradas.filter(t=>t.estatus===est);
  const cnt=document.getElementById('fl-trans-count');
  if(cnt)cnt.textContent=`${filtradas.length} de ${flTrans.length} registros`;
  const wrap=document.getElementById('fl-trans-r');
  if(wrap)wrap.innerHTML=rTransListFiltrada(filtradas);
};
window.flFTransReset=function(){
  ['fl-tf-eco','fl-tf-persona','fl-tf-fecha'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const est=document.getElementById('fl-tf-est');if(est)est.value='';
  const cnt=document.getElementById('fl-trans-count');if(cnt)cnt.textContent='';
  const wrap=document.getElementById('fl-trans-r');
  if(wrap)wrap.innerHTML=rTransListFiltrada(flTrans);
};

window.flExportarTransCSV=function(){
  const cols=['Código','ECO','Vehículo','Entrega (nombre)','Entrega (email)','Recibe (nombre)','Recibe (email)','KM','Gasolina %','Estado','Fecha'];
  const rows=flTrans.map(t=>[
    t.codigo||'',String(t.vehiculoEco||''),t.vehiculoUnidad||'',
    t.entregaNombre||'',t.entregaEmail||'',
    t.recibioNombre||'',t.recibioEmail||'',
    t.entregaKm||t.km||'',
    t.entregaGasolina!=null?t.entregaGasolina:t.gasolina!=null?t.gasolina:'',
    t.estatus||'',(t.creadoEn||'').substring(0,10),
  ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','));
  const csv=[cols.join(','),...rows].join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);
  a.download=`transferencias_flotilla_${new Date().toISOString().substring(0,10)}.csv`;
  a.click();
};

// ── MODAL DETALLE TRANSFERENCIA ──
window.flVerTrans=function(id){
  const t=flTrans.find(x=>x.id===id);if(!t)return;
  const ov=document.createElement('div');ov.className='fl-ov';
  const evFotos=(t.entregaFotos||t.fotos||[]);
  // Reset cache local para este modal — evita índices acumulativos incorrectos
  const cacheLocal=[];
  evFotos.forEach(src=>cacheLocal.push({src,meta:{codigo:'Foto transferencia',tipo:'transferencia',eco:t.vehiculoEco||'—',unidad:t.vehiculoUnidad||'—'}}));
  window._flEvCache=cacheLocal;
  const fotoPills=evFotos.map((src,i)=>`<span class="fl-pill" onclick="flVerEvIdx(${i})" style="cursor:pointer">
    <img src="${src}" style="width:36px;height:36px;object-fit:cover;border-radius:5px;margin-right:4px"><span style="font-size:10px">Foto ${i+1}</span>
  </span>`).join('');
  ov.innerHTML=`<div class="fl-modal" style="max-width:560px">
    <div class="fl-mh"><h3>Transferencia · ${(t.codigo||id.slice(0,8)).toUpperCase()}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div style="background:#0A1628;color:#fff;border-radius:9px;padding:10px 14px;margin-bottom:12px">
        <div style="font-size:14px;font-weight:800">ECO ${t.vehiculoEco||'—'} · ${t.vehiculoUnidad||'—'}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:2px;font-family:'JetBrains Mono',monospace">${t.codigo||'—'} · ${t.creadoEn?t.creadoEn.substring(0,10):'—'}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:9px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:12px">
        ${[['Entregante',t.entregaNombre||t.entregaEmail||'—'],['Receptor',t.recibioNombre||t.recibioEmail||'Pendiente'],['KM',t.entregaKm||t.km||'—'],['Gasolina',t.entregaGasolina!=null?t.entregaGasolina+'%':(t.gasolina!=null?t.gasolina+'%':'—')],['Fecha',t.creadoEn?t.creadoEn.substring(0,10):'—'],['Estado',hBadge(t.estatus||'Completada')]].map(([l,val])=>`<dl style="padding:7px 11px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</dt><dd style="font-size:11.5px;font-weight:600">${val}</dd></dl>`).join('')}
      </div>
      ${fotoPills?`<div style="margin-bottom:12px"><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Evidencias fotográficas (${evFotos.length})</div><div class="fl-pills">${fotoPills}</div></div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div>
          <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma de entrega</div>
          ${t.entregaFirma?`<img src="${t.entregaFirma}" style="width:100%;border:1.5px solid #E2E8F0;border-radius:8px;background:#F8FAFD">`:'<div style="height:60px;border:1.5px dashed #CBD5E1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94A3B8">Sin firma</div>'}
        </div>
        <div>
          <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma de recepción</div>
          ${t.recibioFirma?`<img src="${t.recibioFirma}" style="width:100%;border:1.5px solid #E2E8F0;border-radius:8px;background:#F8FAFD">`:'<div style="height:60px;border:1.5px dashed #CBD5E1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#94A3B8">Pendiente</div>'}
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('.fl-ov').remove()" class="fb gho">Cerrar</button>
        <button onclick="flTransPDF('${t.id}')" class="fb gho" style="display:inline-flex;align-items:center;gap:5px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>PDF</button>
        <button onclick="flTransWA('${t.id}')" style="padding:8px 14px;background:#25D366;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;color:#fff;display:inline-flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.528 5.855L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.659-.52-5.17-1.426l-.371-.22-3.763.981.999-3.668-.242-.379A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>WA</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flTransPDF=function(id){
  const t=flTrans.find(x=>x.id===id);if(!t)return;
  const gasPct=Number(t.entregaGasolina!=null?t.entregaGasolina:(t.gasolina!=null?t.gasolina:0));
  const gasColor=gasPct>50?'#16A34A':gasPct>25?'#D97706':'#DC2626';
  const gasLabel=gasPct>50?'Nivel correcto':gasPct>25?'Nivel bajo':'Nivel cr\u00edtico';
  const evFotos=(t.entregaFotos||t.fotos||[]);
  const kmVal=t.entregaKm||t.km||'\u2014';
  const fechaStr=t.creadoEn?new Date(t.creadoEn).toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'—';
  const horaStr=t.creadoEn?new Date(t.creadoEn).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'—';
  const completadoStr=t.completadoEn?new Date(t.completadoEn).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})+' '+new Date(t.completadoEn).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):'Pendiente';
  const chkEnt=t.entregaChk||{};
  const chkRec=t.recibioChk||{};
  const chkLabels={luces:'Luces',frenos:'Frenos',llantas:'Llantas',limpieza:'Limpieza interior',documentos:'Documentos',herramientas:'Herramientas',extintor:'Extintor',gato:'Gato/refacciones'};
  function chkHTML(chk,label){
    var items=Object.entries(chkLabels).map(function(e){
      var v=chk[e[0]];
      var ok=v===true||v==='ok'||v==='í'||v==='si'||v==='yes'||v===1;
      var no=v===false||v==='no'||v==='mal'||v===0;
      return '<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #F1F5F9">'+
        '<span style="font-size:13px">'+(ok?'\u2705':no?'\u274c':'\u2b1c')+'</span>'+
        '<span style="font-size:10px;color:#374151">'+e[1]+'</span></div>';
    }).join('');
    return '<div style="flex:1"><div style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #E8EDF5">'+label+'</div>'+items+'</div>';
  }
  var fotosHTML=evFotos.map(function(src,i){
    return '<div style="display:inline-block;margin:4px;text-align:center;vertical-align:top">'+
      '<img src="'+src+'" style="width:130px;height:97px;object-fit:cover;border-radius:7px;border:1.5px solid #E2E8F0;display:block">'+
      '<div style="font-size:8px;color:#64748B;margin-top:3px;font-weight:600">Foto '+(i+1)+'</div></div>';
  }).join('');
  var css='*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;font-size:11px;color:#0A0F1E;background:#fff;padding:28px 32px;max-width:800px;margin:0 auto}'+
    '.logo{font-size:22px;font-weight:900;letter-spacing:-1px}.logo em{color:#2563EB;font-style:normal}'+
    '.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A1628;padding-bottom:16px;margin-bottom:20px}'+
    '.veh-bar{background:#0A1628;color:#fff;border-radius:10px;padding:13px 18px;margin-bottom:16px}'+
    '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}'+
    '.field{background:#F8FAFD;border-radius:8px;padding:9px 12px;border:1px solid #E8EDF5}'+
    '.field label{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:3px}'+
    '.field span{font-size:12.5px;font-weight:700;color:#0A1628}'+
    '.sec{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#64748B;margin:16px 0 8px;padding-top:12px;border-top:1.5px solid #E8EDF5}'+
    '.gas-box{display:flex;align-items:center;gap:20px;background:#F8FAFD;border-radius:10px;padding:14px 18px;border:1px solid #E8EDF5;margin-bottom:14px}'+
    '.firma-box{border:1.5px solid #E2E8F0;border-radius:9px;overflow:hidden;background:#F8FAFD;min-height:80px;display:flex;align-items:center;justify-content:center}'+
    '.badge-ok{background:#DCFCE7;color:#15803D;padding:2px 8px;border-radius:100px;font-size:9px;font-weight:800}'+
    '.badge-pend{background:#FEF9C3;color:#854D0E;padding:2px 8px;border-radius:100px;font-size:9px;font-weight:800}'+
    '.footer{margin-top:24px;padding-top:12px;border-top:1px solid #E8EDF5;font-size:9px;color:#94A3B8;text-align:center;line-height:1.6}'+
    '@media print{button{display:none!important}.no-print{display:none!important}}'+
    '.carta{margin-top:40px;padding-top:32px;border-top:3px solid #0A1628}'+
    '.carta-titulo{font-size:16px;font-weight:900;text-align:center;color:#0A1628;letter-spacing:-.3px;margin-bottom:6px}'+
    '.carta-subtitulo{font-size:11px;text-align:center;color:#64748B;margin-bottom:24px}'+
    '.carta-p{font-size:11px;color:#1E293B;line-height:1.8;margin-bottom:12px;text-align:justify}'+
    '@page{margin:15mm}'+
    '.carta{page-break-before:always}';
  var hasChk=Object.keys(chkEnt).length>0||Object.keys(chkRec).length>0;
  // Variables para carta de asignación
  var fechaCarta=t.creadoEn?new Date(t.creadoEn).toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'}):'____________';
  var vehMarca=t.vehiculoUnidad?t.vehiculoUnidad.split(' ')[0]:'_____________';
  var vehModelo=t.vehiculoUnidad?t.vehiculoUnidad.split(' ').slice(1).join(' ')||'_____________':'_____________';
  var html='<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'+
    '<title>Transferencia '+(t.codigo||id.slice(0,8)).toUpperCase()+'</title>'+
    '<style>'+css+'</style></head><body>'+
    '<div class="hdr">'+
      '<div><div class="logo">TECNO<em>CONTROL</em></div>'+
      '<div style="font-size:10px;color:#64748B;margin-top:4px">Registro de transferencia vehicular</div>'+
      '<div style="font-size:9px;color:#94A3B8;margin-top:2px">HEDMA TECNOCONTROL SA DE CV</div></div>'+
      '<div style="text-align:right">'+
        '<div style="font-size:17px;font-weight:900;font-family:monospace;color:#0A1628">'+(t.codigo||id.slice(0,8)).toUpperCase()+'</div>'+
        '<div style="font-size:10px;color:#64748B;margin-top:3px">'+fechaStr+'</div>'+
        '<div style="font-size:9px;color:#94A3B8;margin-top:1px">'+horaStr+' hrs</div>'+
        '<span class="'+(t.estatus==='Completada'?'badge-ok':'badge-pend')+'" style="display:inline-block;margin-top:4px">'+(t.estatus||'Pendiente')+'</span>'+
      '</div>'+
    '</div>'+
    '<div class="veh-bar">'+
      '<div style="font-size:15px;font-weight:900">ECO '+(t.vehiculoEco||'\u2014')+' \u00b7 '+(t.vehiculoUnidad||'\u2014')+'</div>'+
      '<div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:3px">Transferencia entre personal \u00b7 '+(t.vehiculoId||id)+'</div>'+
    '</div>'+
    '<div class="grid2">'+
      '<div class="field"><label>Entregante</label><span>'+(t.entregaNombre||t.entregaEmail||'\u2014')+'</span>'+
        '<div style="font-size:9px;color:#94A3B8;margin-top:2px">'+(t.entregaEmail||'')+'</div></div>'+
      '<div class="field"><label>Receptor</label><span>'+(t.recibioNombre||t.recibioEmail||'Pendiente')+'</span>'+
        '<div style="font-size:9px;color:#94A3B8;margin-top:2px">'+(t.recibioEmail||'')+'</div></div>'+
      '<div class="field"><label>KM al transferir</label><span>'+kmVal+'</span></div>'+
      '<div class="field"><label>Fecha de recepci\u00f3n</label><span>'+completadoStr+'</span></div>'+
    '</div>'+
    '<div class="gas-box">'+
      '<div style="font-size:40px;font-weight:900;color:'+gasColor+'">'+gasPct+'%</div>'+
      '<div><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Nivel de gasolina al entregar</div>'+
      '<div style="font-size:13px;color:'+gasColor+';font-weight:800;margin-top:3px">'+gasLabel+'</div></div>'+
    '</div>'+
    (hasChk?
      '<div class="sec">Lista de verificaci\u00f3n del veh\u00edculo</div>'+
      '<div style="display:flex;gap:20px;margin-bottom:14px;background:#F8FAFD;border-radius:9px;padding:12px 14px;border:1px solid #E8EDF5">'+
        chkHTML(chkEnt,'Entrega \u2014 '+(t.entregaNombre||t.entregaEmail||'\u2014'))+
        '<div style="width:1px;background:#E8EDF5;margin:0 4px"></div>'+
        chkHTML(chkRec,'Recepci\u00f3n \u2014 '+(t.recibioNombre||t.recibioEmail||'Pendiente'))+
      '</div>':'')+
    (evFotos.length?
      '<div class="sec">Evidencias fotogr\u00e1ficas ('+evFotos.length+')</div>'+
      '<div style="margin-bottom:14px;background:#F8FAFD;border-radius:9px;padding:10px;border:1px solid #E8EDF5">'+fotosHTML+'</div>':'')+
    (t.comentarioEntrega?'<div class="sec">Comentarios</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">'+
        '<div class="field"><label>Comentario de entrega</label><span style="font-size:11px;font-weight:600;color:#166534">'+t.comentarioEntrega+'</span></div>'+
        ((t.comentarioRecepcion||t.comentarioRecepcionPortal)?'<div class="field"><label>Comentario de recepción</label><span style="font-size:11px;font-weight:600;color:#1E40AF">'+(t.comentarioRecepcion||t.comentarioRecepcionPortal)+'</span></div>':'<div class="field"><label>Comentario de recepción</label><span style="color:#94A3B8">Sin comentario</span></div>')+
      '</div>':'')+
    '<div class="sec">Firmas digitales</div>'+
    '<div class="grid2">'+
      '<div>'+
        '<div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma de entrega</div>'+
        '<div class="firma-box">'+(t.entregaFirma?'<img src="'+t.entregaFirma+'" style="width:100%;display:block">':'<span style="font-size:11px;color:#94A3B8">Sin firma registrada</span>')+'</div>'+
        '<div style="font-size:10px;font-weight:700;color:#0A1628;margin-top:6px;text-align:center">'+(t.entregaNombre||t.entregaEmail||'\u2014')+'</div>'+
        '<div style="font-size:9px;color:#94A3B8;text-align:center">'+(t.entregaEmail||'')+'</div>'+
      '</div>'+
      '<div>'+
        '<div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:6px">Firma de recepci\u00f3n</div>'+
        '<div class="firma-box">'+(t.recibioFirma?'<img src="'+t.recibioFirma+'" style="width:100%;display:block">':'<span style="font-size:11px;color:#94A3B8">Pendiente</span>')+'</div>'+
        '<div style="font-size:10px;font-weight:700;color:#0A1628;margin-top:6px;text-align:center">'+(t.recibioNombre||t.recibioEmail||'Pendiente')+'</div>'+
        '<div style="font-size:9px;color:#94A3B8;text-align:center">'+(t.recibioEmail||'')+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="footer">'+
      'Portal Flotilla Tecnocontrol \u00b7 Generado el '+new Date().toLocaleString('es-MX')+'<br>'+
      'Folio: '+id+' \u00b7 Documento de registro interno de transferencia vehicular'+
    '</div>'+
    '<div style="margin-top:20px;text-align:right" class="no-print">'+
      '<button onclick="window.print()" style="padding:11px 28px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer">Imprimir / Guardar PDF</button>'+
    '</div>'+
    // ══ CARTA DE ASIGNACIÓN VEHICULAR ══
    '<div class="carta">'+
      '<div class="carta-titulo">CARTA DE ASIGNACI\u00d3N VEHICULAR</div>'+
      '<div class="carta-subtitulo">HEDMA TECNOCONTROL SA DE CV</div>'+
      '<p class="carta-p">Chihuahua, Chih., a '+fechaCarta+'</p>'+
      '<p class="carta-p">Por medio de la presente, se hace constar que la empresa <strong>HEDMA TECNOCONTROL SA DE CV</strong> asigna el veh\u00edculo descrito a continuaci\u00f3n al colaborador:</p>'+
      '<div style="background:#F8FAFD;border-radius:9px;padding:14px 18px;border:1px solid #E8EDF5;margin-bottom:16px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">Nombre del colaborador</div><div style="font-size:12px;font-weight:700;border-bottom:1px solid #CBD5E1;padding-bottom:4px">'+(t.recibioNombre||t.recibioEmail||'_______________________')+'</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">Puesto</div><div style="font-size:12px;border-bottom:1px solid #CBD5E1;padding-bottom:4px">_______________________</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">\u00c1rea / Departamento</div><div style="font-size:12px;border-bottom:1px solid #CBD5E1;padding-bottom:4px">_______________________</div></div>'+
        '</div>'+
      '</div>'+
      '<p class="carta-p"><strong>Datos del veh\u00edculo:</strong></p>'+
      '<div style="background:#F8FAFD;border-radius:9px;padding:14px 18px;border:1px solid #E8EDF5;margin-bottom:16px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">Marca</div><div style="font-size:12px;font-weight:700">'+vehMarca+'</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">Modelo</div><div style="font-size:12px;font-weight:700">'+vehModelo+'</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">Color</div><div style="font-size:12px;font-weight:700">___________</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">Placas</div><div style="font-size:12px;font-weight:700">'+(t.vehiculoPlacas||'___________')+'</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">N\u00famero econ\u00f3mico</div><div style="font-size:12px;font-weight:700">ECO '+(t.vehiculoEco||'___________')+'</div></div>'+
          '<div><div style="font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:4px">N\u00famero de serie</div><div style="font-size:12px;font-weight:700">___________</div></div>'+
        '</div>'+
      '</div>'+
      '<p class="carta-p">El veh\u00edculo antes mencionado queda bajo resguardo y responsabilidad del colaborador, quien se compromete a:</p>'+
      '<ul style="font-size:11px;color:#1E293B;line-height:2;margin-left:22px;margin-bottom:14px">'+
        '<li>Utilizarlo \u00fanicamente para actividades relacionadas con la empresa.</li>'+
        '<li>Mantener el veh\u00edculo en buenas condiciones de uso y limpieza.</li>'+
        '<li>Respetar el reglamento de tr\u00e1nsito vigente.</li>'+
        '<li>Reportar inmediatamente cualquier falla, accidente o incidente.</li>'+
        '<li>Hacer entrega del veh\u00edculo cuando la empresa lo solicite.</li>'+
        '<li>Colaborar con cualquier tipo de auditor\u00eda al veh\u00edculo, programada o no programada.</li>'+
        '<li>Estar al tanto del mantenimiento, reportes de combustible y kilometraje.</li>'+
      '</ul>'+
      '<p class="carta-p">Asimismo, el colaborador reconoce haber recibido el veh\u00edculo en buenas condiciones, junto con los accesorios y documentaci\u00f3n correspondiente.</p>'+
      '<p class="carta-p">Sin m\u00e1s por el momento, se firma la presente para los fines que correspondan.</p>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:60px">'+
        '<div style="text-align:center">'+
          '<div style="min-height:70px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:8px">'+
            (t.recibioFirma?'<img src="'+t.recibioFirma+'" style="height:65px;max-width:200px;object-fit:contain">':'<div style="height:65px"></div>')+
          '</div>'+
          '<div style="border-top:1px solid #0A1628;margin-bottom:6px"></div>'+
          '<div style="font-size:11px;font-weight:700;color:#0A1628">'+(t.recibioNombre||'Nombre del colaborador')+'</div>'+
          '<div style="font-size:10px;color:#64748B;margin-top:2px">Firma del colaborador</div>'+
        '</div>'+
        '<div style="text-align:center">'+
          '<div style="min-height:70px;display:flex;align-items:flex-end;justify-content:center;margin-bottom:8px">'+
            (t.entregaFirma?'<img src="'+t.entregaFirma+'" style="height:65px;max-width:200px;object-fit:contain">':'<div style="height:65px"></div>')+
          '</div>'+
          '<div style="border-top:1px solid #0A1628;margin-bottom:6px"></div>'+
          '<div style="font-size:11px;font-weight:700;color:#0A1628">'+(t.entregaNombre||'Representante empresa')+'</div>'+
          '<div style="font-size:10px;color:#64748B;margin-top:2px">Firma de quien entrega</div>'+
        '</div>'+
      '</div>'+
    '</div>'+
    '</body></html>';
  var win=window.open('','_blank','width=860,height=960');
  if(win){win.document.write(html);win.document.close();}
  else flMsgError('Activa ventanas emergentes para generar el PDF');
}

window.flTransWA=function(id){
  const t=flTrans.find(x=>x.id===id);if(!t)return;
  const txt=[
    '*TECNOCONTROL — Transferencia Vehicular*',
    'Código: '+(t.codigo||id.slice(0,8)).toUpperCase(),
    'Fecha: '+(t.creadoEn?t.creadoEn.substring(0,10):'—'),
    '',
    '*Vehículo:* ECO '+(t.vehiculoEco||'—')+' · '+(t.vehiculoUnidad||'—'),
    '*Entregante:* '+(t.entregaNombre||t.entregaEmail||'—'),
    '*Receptor:* '+(t.recibioNombre||t.recibioEmail||'Pendiente'),
    '*KM:* '+(t.km||'—'),
    '*Gasolina:* '+(t.entregaGasolina!=null?t.entregaGasolina+'%':(t.gasolina!=null?t.gasolina+'%':'—')),
    '*Estado:* '+(t.estatus||'Completada'),
    '*Fotos:* '+(t.entregaFotos||t.fotos||[]).length+' evidencia(s)',
    '*Firma entrega:* '+(t.entregaFirma?'Registrada':'Pendiente'),
    '*Firma recepción:* '+(t.recibioFirma?'Registrada':'Pendiente'),
  ].filter(function(x){return x!==undefined&&x!=='';}).join('\n');
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
};

window.flAbrirCom=function(){
  const vehs=flV.filter(v=>!v.status||v.status==='activo');
  window.flComEv=[];const comEv=window.flComEv;
  const ov=document.createElement('div');ov.className='fl-ov';ov.id='fl-mcom';
  ov.innerHTML=`<div class="fl-modal"><div class="fl-mh"><h3>${I.truck} Registrar utilitario</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb"><div class="fl-form">
      <div class="fl-fld"><label>Vehículo</label><select id="fl-cv"><option value="">—</option>${vehs.map(v=>`<option value="${v.id}" data-eco="${v.eco}">${v.eco} · ${v.unidad||'—'} · ${v.placas||'—'}</option>`).join('')}</select></div>
      <div class="fl-fr"><div class="fl-fld"><label>Responsable</label><input type="text" id="fl-cre"></div><div class="fl-fld"><label>Tipo</label><select id="fl-cti"><option>Corto plazo</option><option>Largo plazo</option></select></div></div>
      <div class="fl-fld"><label>Motivo / Destino</label><textarea id="fl-cmo" style="min-height:55px"></textarea></div>
      <div class="fl-fr"><div class="fl-fld"><label>Fecha entrega</label><input type="date" id="fl-cfe" value="${new Date().toISOString().slice(0,10)}"></div><div class="fl-fld"><label>Fecha regreso</label><input type="date" id="fl-cfr"></div></div>
      <div class="fl-fr"><div class="fl-fld"><label>KM al entregar</label><input type="number" id="fl-ckm"></div><div class="fl-fld"><label>Gasolina</label><select id="fl-cga"><option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Vacío</option></select></div></div>
      <div class="fl-fld"><label>${I.camera} Evidencias entrega</label><label class="fl-up" onclick="document.getElementById('fl-cevi').click()">${I.upload} Subir fotos</label><input type="file" id="fl-cevi" accept="image/*" multiple style="display:none" onchange="Array.from(this.files).forEach(f=>{const r=new FileReader();r.onload=e=>{window.flComEv.push(e.target.result);};r.readAsDataURL(f);})"><div class="fl-pills" id="fl-cep"></div></div>
      <div class="fl-fa"><button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cancelar</button><button class="fb acc" onclick="flGCom(window.flComEv)">${I.check} Registrar</button></div>
    </div></div></div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};
window.flGCom=async function(comEv){
  const sel=document.getElementById('fl-cv');const vId=sel?.value;const resp=document.getElementById('fl-cre')?.value?.trim();const fent=document.getElementById('fl-cfe')?.value;
  if(!vId||!resp||!fent){alert('Completa los campos requeridos.');return;}
  const v=flV.find(x=>x.id===vId);const eco=sel.options[sel.selectedIndex]?.dataset?.eco||v?.eco||'';
  const doc={vehiculoId:vId,vehiculoEco:eco,vehiculo:`${eco} · ${v?.unidad||''}`,responsable:resp,tipo:document.getElementById('fl-cti')?.value||'Corto plazo',motivo:document.getElementById('fl-cmo')?.value?.trim()||'',estatus:'En préstamo',fechaEntrega:fent,fechaRegreso:document.getElementById('fl-cfr')?.value||'',kmEntrega:document.getElementById('fl-ckm')?.value||'',gasolinaEntrega:document.getElementById('fl-cga')?.value,evidenciasEntrega:comEv||[],evidenciasRecepcion:[],registradoPor:window.auth?.currentUser?.email||'',creadoEn:new Date().toISOString()};
  try{await fs.addDoc(fs.collection(db,C.COMIS),doc);if(v&&!v.id.startsWith('eco-'))await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{status:'comision'}).catch(()=>{});document.getElementById('fl-mcom')?.remove();await ldComs();rComis();}catch(e){console.error('[FL]',e);alert('Error: '+e.message);}
};
window.flVerCom=function(id){
  const c=flCom.find(x=>x.id===id);if(!c)return;let rEv=[];
  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal"><div class="fl-mh"><h3>${I.truck} Comisión · ${id.slice(0,8).toUpperCase()}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:9px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:10px">
        ${[['Vehículo',c.vehiculo||'—'],['Estado',hBadge(c.estatus)],['Responsable',c.responsable||'—'],['Tipo',c.tipo||'—'],['Fecha entrega',hF(c.fechaEntrega)],['Regreso',c.fechaRegreso?hF(c.fechaRegreso):'Pendiente'],['KM entrega',c.kmEntrega||'—'],['KM recepción',c.kmRecepcion||'—'],['Gas entrega',c.gasolinaEntrega||'—'],['Gas recepción',c.gasolinaRecepcion||'—']].map(([l,val])=>`<dl style="padding:7px 11px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</dt><dd style="font-size:11.5px;font-weight:600">${val}</dd></dl>`).join('')}
        <dl style="grid-column:1/-1;padding:7px 11px"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">Motivo</dt><dd style="font-size:11.5px">${c.motivo||'—'}</dd></dl>
      </div>
      ${c.evidenciasEntrega?.length?`<div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Evidencias entrega</div><div class="fl-pills" style="margin-bottom:10px">${c.evidenciasEntrega.map((e,i)=>`<span class="fl-pill" onclick="flImg('${e}')">${I.camera} Foto ${i+1}</span>`).join('')}</div>`:''}
      ${hAdm()&&c.estatus==='En préstamo'?`<div class="fl-sep"></div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin-bottom:8px">Registrar devolución</div>
        <div class="fl-fr"><div class="fl-fld"><label>KM al recibir</label><input type="number" id="fl-rkm"></div><div class="fl-fld"><label>Gasolina</label><select id="fl-rga"><option>Lleno</option><option>3/4</option><option>1/2</option><option>1/4</option><option>Vacío</option></select></div></div>
        <div class="fl-fld" style="margin-top:8px"><label>${I.camera} Evidencias recepción</label><label class="fl-up" onclick="document.getElementById('fl-revi').click()">${I.upload} Fotos al recibir</label><input type="file" id="fl-revi" accept="image/*" multiple style="display:none" onchange="Array.from(this.files).forEach(f=>{const r=new FileReader();r.onload=e=>{rEv.push(e.target.result);};r.readAsDataURL(f);})"><div class="fl-pills" id="fl-crp"></div></div>
        <div class="fl-fa"><button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button><button class="fb acc" onclick="flCCom('${c.id}',rEv)">${I.check} Registrar devolución</button></div>`
      :`<div class="fl-fa"><button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button></div>`}
    </div></div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};
window.flCCom=async function(id,rEv){
  const km=document.getElementById('fl-rkm')?.value;const gas=document.getElementById('fl-rga')?.value||'—';
  try{await fs.updateDoc(fs.doc(db,C.COMIS,id),{estatus:'Devuelto',kmRecepcion:km||'',gasolinaRecepcion:gas,evidenciasRecepcion:rEv||[],fechaDevolucion:new Date().toISOString()});
    const c=flCom.find(x=>x.id===id);if(c){const v=flV.find(x=>x.id===c.vehiculoId);if(v&&!v.id.startsWith('eco-'))await fs.updateDoc(fs.doc(db,C.VEHS,v.id),{status:'activo',km:Number(km)||v.km}).catch(()=>{});}
    document.querySelector('.fl-ov')?.remove();await ldComs();rComis();}catch(e){console.error('[FL]',e);alert('Error: '+e.message);}
};

// ── COMPARATIVA SEMANAL ──
// ── HELPERS COMPARTIDOS COMPARATIVA ──
const CHK_CATS_P={
  Cristales:  ['Medallón delantero','Vidrio trasero','Lat. der. delantero','Lat. der. trasero','Lat. izq. delantero','Lat. izq. trasero'],
  Espejos:    ['Retrovisor izquierdo','Retrovisor derecho','Espejo central'],
  Neumáticos: ['Llanta del. der.','Llanta del. izq.','Llanta tra. der.','Llanta tra. izq.','Refacción'],
  Interiores: ['Póliza / Manual','Radio','Pantallas','Asientos','Tablero','Tapetes'],
  Motor:      ['Batería','Tapón agua','Tapón radiador','Tapón dirección','Limpiaparabrisas en buen estado'],
  Cajuela:    ['Herramienta','Cables arranque','Extintor','Llave L','Llave cruz'],
  Legal:      ['Tarjeta circulación'],
};

function rCompar(offsetSem){
  offsetSem=offsetSem||0; // 0=semana actual, -1=sem anterior, -2=antepenúltima...
  const hoy=new Date();
  // Calcular inicio de la semana seleccionada
  const inicioAct=new Date(hoy);
  inicioAct.setDate(hoy.getDate()-hoy.getDay()+(offsetSem*7));
  inicioAct.setHours(0,0,0,0);
  const finAct=new Date(inicioAct);finAct.setDate(inicioAct.getDate()+6);finAct.setHours(23,59,59,999);
  // Semana anterior a la seleccionada
  const inicioAnt=new Date(inicioAct);inicioAnt.setDate(inicioAct.getDate()-7);
  const finAnt=new Date(inicioAct);finAnt.setSeconds(-1);
  const fmt=d=>d?d.toLocaleDateString('es-MX',{day:'2-digit',month:'short'}):'—';
  const esActual=offsetSem===0;
  const label=(esActual?'Semana actual':'Semana: ')+fmt(inicioAct)+' — '+fmt(esActual?hoy:finAct)+' · vs '+fmt(inicioAnt)+' — '+fmt(finAnt);
  const enSem=(s,ini,fin)=>{const f=new Date(s.creadoEn||0);return f>=ini&&f<=fin;};
  const solAct=flS.filter(s=>enSem(s,inicioAct,esActual?hoy:finAct));
  const solAnt=flS.filter(s=>enSem(s,inicioAnt,finAnt));
  const pvDias=v=>hD(v.pv);
  const pvStyle=v=>{const d=pvDias(v);return d===null?'#15803D':d<0?'#B91C1C':d<30?'#D97706':'#15803D';};
  const pvText=v=>{const d=pvDias(v);return d===null?'OK':d<0?'VENCIDA':d+'d';};
  const flecha=(a,b)=>{
    if(a>b)return '<span style="color:#15803D;font-size:10px">▲'+(a-b)+'</span>';
    if(a<b)return '<span style="color:#B91C1C;font-size:10px">▼'+(b-a)+'</span>';
    return '<span style="color:#94A3B8;font-size:10px">—</span>';
  };
  const vehs=flV.filter(v=>v.status!=='baja');
  const rows=vehs.map(v=>{
    const sA=solAct.filter(s=>flEsDelVehiculo(s,v));
    const sB=solAnt.filter(s=>flEsDelVehiculo(s,v));
    const kmA=sA.reduce((a,s)=>a+(Number(s.kilometrajeReportado)||0),0);
    const kmB=sB.reduce((a,s)=>a+(Number(s.kilometrajeReportado)||0),0);
    const tr=flTrans.filter(t=>String(t.vehiculoEco)===String(v.eco));
    // Detectar discrepancias en checklist entre semanas
    const chkA=Object.assign({},...sA.map(s=>s.checklist||{}));
    const chkB=Object.assign({},...sB.map(s=>s.checklist||{}));
    let alertas=0;
    Object.keys(chkA).forEach(k=>{if(chkA[k]==='no'&&chkB[k]==='si')alertas++;});
    const hasData=sA.length>0||sB.length>0||tr.length>0;
    return{v,sA,sB,kmA,kmB,tr,alertas,hasData};
  }).filter(r=>r.hasData);
  const thStyle='text-align:center;padding:8px 6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap';
  const tdC='text-align:center;padding:8px 6px;';
  let body='';
  if(rows.length===0){
    body='<div class="fl-empty" style="min-height:200px"><div class="fl-empty-ico"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></div><h3>Sin datos esta semana</h3><p>No hay checklists registrados en las últimas dos semanas.</p></div>';
  } else {
    let trs='';
    rows.forEach((r,i)=>{
      const bg=i%2===0?'background:#fff':'background:#FAFBFD';
      const alertCell=r.alertas>0
        ?'<span style="background:#FEF2F2;color:#B91C1C;font-size:10px;font-weight:800;padding:2px 7px;border-radius:99px">'+r.alertas+' nuevos</span>'
        :'<span style="color:#94A3B8;font-size:10px">—</span>';
      trs+='<tr style="border-bottom:1px solid #F1F5F9;'+bg+';cursor:pointer" onclick="flVerComparVeh(\''+r.v.id+'\','+offsetSem+')">'+
        '<td style="padding:8px 10px">'+
          '<div style="font-weight:700;font-size:12px">'+r.v.unidad+'</div>'+
          '<div style="font-size:10px;color:#64748B;font-family:\'JetBrains Mono\',monospace">ECO '+r.v.eco+' · '+(r.v.plaza||'—')+'</div>'+
        '</td>'+
        '<td style="'+tdC+'font-weight:700">'+r.sA.length+' '+flecha(r.sA.length,r.sB.length)+'</td>'+
        '<td style="'+tdC+'color:#64748B">'+r.sB.length+'</td>'+
        '<td style="'+tdC+'font-size:11px"><div style="font-weight:700">'+(r.kmA?r.kmA.toLocaleString():'—')+'</div>'+(r.kmB?'<div style="font-size:9.5px;color:#94A3B8">ant. '+r.kmB.toLocaleString()+'</div>':'')+'</td>'+
        '<td style="'+tdC+'"><span style="font-size:10px;font-weight:800;color:'+pvStyle(r.v)+'">'+pvText(r.v)+'</span></td>'+
        '<td style="'+tdC+'">'+alertCell+'</td>'+
        '<td style="'+tdC+'font-size:18px;color:#94A3B8">›</td>'+
        '</tr>';
    });
    body='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'+
      '<thead><tr style="background:#F1F5F9">'+
      '<th style="text-align:left;padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;border-bottom:2px solid #E2E8F0">Vehículo</th>'+
      '<th style="'+thStyle+'">Sol. act.</th>'+
      '<th style="'+thStyle+'">Sol. ant.</th>'+
      '<th style="'+thStyle+'">KM act.</th>'+
      '<th style="'+thStyle+'">Póliza</th>'+
      '<th style="'+thStyle+'">Problemas</th>'+
      '<th style="'+thStyle+'"></th>'+
      '</tr></thead><tbody>'+trs+'</tbody></table></div>'+
      '<div style="font-size:10px;color:#94A3B8;margin-top:8px;text-align:right">Clic en un vehículo para ver la comparativa detallada</div>';
  }
  // Selector de semana
  const navSem=
    '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center">'+
      '<button onclick="rCompar('+(offsetSem-1)+')" style="padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:700">← Sem. anterior</button>'+
      (offsetSem<0?'<button onclick="rCompar('+(offsetSem+1)+')" style="padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:700">Sem. siguiente →</button>':'<span style="padding:6px 12px;border-radius:8px;background:#0A1628;color:#fff;font-size:12px;font-weight:700">Semana actual</span>')+
    '</div>';

  setContent(padded(
    '<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:4px">'+
    '<div style="font-size:17px;font-weight:900;letter-spacing:-.4px">Comparativa semanal</div>'+
    '<button class="fb gho" onclick="rCompar('+offsetSem+')" style="font-size:11px;display:inline-flex;align-items:center;gap:4px">'+
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/></svg>Actualizar</button></div>'+
    '<div style="font-size:11px;color:#64748B;margin-bottom:10px">'+label+'</div>'+
    navSem+
    body
  ));
}
window.rCompar=rCompar;

// ── DETALLE COMPARATIVA POR VEHÍCULO — 2 columnas ──
window.flVerComparVeh=function(vehId,offsetSem){
  offsetSem=offsetSem||0;
  const hoy=new Date();
  const inicioAct=new Date(hoy);
  inicioAct.setDate(hoy.getDate()-hoy.getDay()+(offsetSem*7));
  inicioAct.setHours(0,0,0,0);
  const finAct=new Date(inicioAct);finAct.setDate(inicioAct.getDate()+6);finAct.setHours(23,59,59,999);
  const inicioAnt=new Date(inicioAct);inicioAnt.setDate(inicioAct.getDate()-7);
  const finAnt=new Date(inicioAct);finAnt.setSeconds(-1);
  const esActual=offsetSem===0;
  const enSem=(s,ini,fin)=>{const f=new Date(s.creadoEn||0);return f>=ini&&f<=fin;};
  const v=flV.find(x=>x.id===vehId);
  const eco=v?.eco;
  const solAct=flSolsDeVehiculo(v).filter(s=>enSem(s,inicioAct,esActual?hoy:finAct));
  const solAnt=flSolsDeVehiculo(v).filter(s=>enSem(s,inicioAnt,finAnt));
  // Tomar el más reciente de cada semana
  const sA=solAct.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''))[0]||null;
  const sB=solAnt.sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''))[0]||null;
  // Exponer en window para acceso desde onclick inline
  window._flComparCtx={sA,sB};

  const fmtFull=d=>{if(!d)return'Sin registro';const dt=new Date(d);return dt.toLocaleDateString('es-MX',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});};

  // Renderizar columna de una semana
  function rCol(sol,label,color){
    if(!sol){
      return '<div style="flex:1;background:#F8FAFD;border-radius:12px;padding:16px;border:1.5px dashed #CBD5E1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:300px">'+
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'+
        '<div style="font-size:12px;font-weight:700;color:#94A3B8">Sin checklist</div>'+
        '<div style="font-size:10px;color:#CBD5E1">'+label+'</div>'+
      '</div>';
    }
    const chk=sol.checklist||{};
    const chkFotos=sol.chkFotos||{};
    const evFotos=sol.evidencias||[];
    const km=sol.kilometrajeReportado||'—';
    const gas=sol.gasolina!=null?sol.gasolina+'%':'—';
    // Fotos generales
    const fotosHtml=evFotos.length
      ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">'+evFotos.slice(0,6).map(f=>'<img src="'+f+'" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #E2E8F0;cursor:pointer" onclick="flLightbox(this.src)" title="Ver foto completa">').join('')+'</div>'
      : '<div style="font-size:11px;color:#94A3B8;margin-bottom:12px">Sin fotos</div>';
    // Checklist por categoría
    let chkHtml='';
    for(const [cat,items] of Object.entries(CHK_CATS_P)){
      let catItems='';
      let catAlerta=false;
      items.forEach((item,i)=>{
        const key=cat+'__'+i;
        const val=chk[key]||'';
        const foto=chkFotos[key];
        const isNo=val==='no';
        if(isNo)catAlerta=true;
        const dot=val==='si'?'<span style="color:#15803D;font-weight:900;font-size:13px">✓</span>':val==='no'?'<span style="color:#B91C1C;font-weight:900;font-size:13px">✗</span>':'<span style="color:#CBD5E1;font-size:13px">○</span>';
        // Foto de la semana anterior para el mismo ítem
        const fotoAnt=sB&&sB.chkFotos?sB.chkFotos[key]:null;
        const fotoEl=foto
          ?'<img src="'+foto+'" style="width:28px;height:28px;object-fit:cover;border-radius:5px;cursor:pointer;border:1px solid '+(isNo?'#FCA5A5':'#E2E8F0')+';position:relative" onclick="flLightboxCompar(\''+key+'\',window._flComparCtx?.sA,window._flComparCtx?.sB)" title="Clic para comparar semana actual vs anterior">'+
           (fotoAnt?'<div style="width:6px;height:6px;background:#F59E0B;border-radius:50%;position:absolute;top:-2px;right:-2px" title="También hay foto semana anterior"></div>':'')
          :(fotoAnt?'<span style="font-size:9px;color:#F59E0B;cursor:pointer" onclick="flLightboxCompar(\''+key+'\',window._flComparCtx?.sA,window._flComparCtx?.sB)" title="Solo hay foto semana anterior">ant.</span>':'');
        catItems+='<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;border-bottom:1px solid #F8FAFD;gap:6px">'+
          '<span style="font-size:11px;color:'+(isNo?'#B91C1C':'#334155')+(val===''?';opacity:.6':'')+'">'+item+'</span>'+
          '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'+fotoEl+dot+'</div>'+
          '</div>';
      });
      chkHtml+='<div style="margin-bottom:10px">'+
        '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:'+(catAlerta?'#B91C1C':'#64748B')+';margin-bottom:4px">'+(catAlerta?'⚠ ':'')+cat+'</div>'+
        catItems+
        '</div>';
    }
    return '<div style="flex:1;background:#fff;border-radius:12px;border:2px solid '+color+';overflow:hidden;min-width:0">'+
      '<div style="background:'+color+';padding:10px 14px;display:flex;align-items:center;justify-content:space-between">'+
        '<div style="font-size:12px;font-weight:900;color:#fff">'+label+'</div>'+
        '<div style="font-size:10px;color:rgba(255,255,255,.7)">'+fmtFull(sol.creadoEn)+'</div>'+
      '</div>'+
      '<div style="padding:14px">'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">'+
          '<div style="background:#F8FAFD;border-radius:8px;padding:8px 10px;text-align:center">'+
            '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">KM</div>'+
            '<div style="font-size:14px;font-weight:900;color:#0A0F1E">'+km+'</div>'+
          '</div>'+
          '<div style="background:#F8FAFD;border-radius:8px;padding:8px 10px;text-align:center">'+
            '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">Gasolina</div>'+
            '<div style="font-size:14px;font-weight:900;color:#0A0F1E">'+gas+'</div>'+
          '</div>'+
        '</div>'+
        '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:8px">Fotos del vehículo</div>'+
        fotosHtml+
        '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:8px;margin-top:4px">Checklist</div>'+
        '<div style="max-height:400px;overflow-y:auto;padding-right:2px">'+chkHtml+'</div>'+
      '</div>'+
    '</div>';
  }

  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=
    '<div class="fl-modal" style="max-width:960px;width:95vw">'+
      '<div class="fl-mh">'+
        '<div>'+
          '<h3>'+(v?v.unidad:'ECO '+eco)+' — Comparativa semanal</h3>'+
          '<div style="font-size:11px;color:#64748B;margin-top:2px">ECO '+eco+' · Clic en cualquier foto para verla en tamaño completo</div>'+
        '</div>'+
        '<button class="fl-mx" onclick="this.closest(\'.fl-ov\').remove()">✕</button>'+
      '</div>'+
      '<div class="fl-mb" style="padding:16px">'+
        '<div style="display:flex;gap:14px;align-items:stretch">'+
          rCol(sA,'Semana actual','#1E3A5F')+
          rCol(sB,'Semana anterior','#64748B')+
        '</div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};



// ══════════════════════════════════════════════════════
// CHECK LIST SEMANAL — comparativo + detalle
// ══════════════════════════════════════════════════════
let chkSemFiltroVeh='';
// ── SEMANA ISO (portal) ──
function getSemanaISOPortal(d){
  d=d||new Date();
  const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=(dt.getUTCDay()+6)%7;
  dt.setUTCDate(dt.getUTCDate()-dayNum+3);
  const firstThursday=new Date(Date.UTC(dt.getUTCFullYear(),0,4));
  const week=1+Math.round(((dt-firstThursday)/86400000-3+((firstThursday.getUTCDay()+6)%7))/7);
  return`${dt.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

// ── PANEL DE CONTROL: ACTIVAR / DESACTIVAR CHECK LIST SEMANAL (solo admins) ──
function hCfgSemPanel(){
  if(!hAdm())return'';
  const activo=!!flCfgSem.activo;
  const semCfg=flCfgSem.semana||'';
  const semActual=getSemanaISOPortal();
  const esEstaSemana=semCfg===semActual;
  const activadoPor=flCfgSem.activadoPor||'';
  const activadoEn=flCfgSem.activadoEn?new Date(flCfgSem.activadoEn).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';

  return`<div style="background:${activo&&esEstaSemana?'#F0FDF4':'#F8FAFD'};border:1.5px solid ${activo&&esEstaSemana?'#86EFAC':'#E2E8F0'};border-radius:12px;padding:14px 16px;margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-size:13px;font-weight:800;color:${activo&&esEstaSemana?'#15803D':'#374151'}">
          ${activo&&esEstaSemana
            ?`✅ Check list activo — ${semCfg}`
            :activo&&!esEstaSemana
              ?`⚠️ Activo para ${semCfg} (semana pasada) — desactiva y reactiva`
              :`🔒 Check list desactivado`}
        </div>
        <div style="font-size:11px;color:#64748B;margin-top:3px">
          ${activo&&activadoPor?`Activado por ${activadoPor}${activadoEn?' · '+activadoEn:''}`:'Semana actual: '+semActual}
          ${activo&&esEstaSemana?' · Técnicos pueden llenarlo lunes-viernes':''}
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
        ${activo
          ?`<button onclick="flToggleCfgSem(false)" style="padding:8px 16px;border-radius:9px;border:1.5px solid #FCA5A5;background:#FEF2F2;color:#B91C1C;font-size:12px;font-weight:700;cursor:pointer">
              Desactivar
            </button>`
          :`<button onclick="flToggleCfgSem(true)" style="padding:8px 16px;border-radius:9px;border:none;background:#15803D;color:#fff;font-size:12px;font-weight:700;cursor:pointer">
              Activar semana ${semActual}
            </button>`}
      </div>
    </div>
  </div>`;
}

window.flToggleCfgSem=async function(activar){
  const semActual=getSemanaISOPortal();
  const email=window.auth?.currentUser?.email||'—';
  const datos=activar
    ?{activo:true,semana:semActual,activadoPor:email,activadoEn:new Date().toISOString()}
    :{activo:false,semana:semActual,desactivadoPor:email,desactivadoEn:new Date().toISOString()};
  try{
    await fs.setDoc(fs.doc(db,C.CFG,'checklist_semanal'),datos,{merge:true});
    flCfgSem={...flCfgSem,...datos};
    flMsgOk(activar?`✅ Check list activado para ${semActual}`:'🔒 Check list desactivado');
    rChkSemanal();
  }catch(e){
    flMsgError('Error: '+e.message);
  }
};

// ── MÉTRICAS CHECK LIST SEMANAL ──
function hChkSemMetrics(semSel, porVeh, vehsSinRegistro, total){
  const regs=Object.values(porVeh);
  const totalVehs=regs.length+vehsSinRegistro.length;
  const registrados=regs.length;
  const pctCobertura=totalVehs?Math.round(registrados/totalVehs*100):0;

  let totalDetalles=0,totalOks=0,sinFirma=0,conObs=0,totalItems=0;
  regs.forEach(r=>{
    const chk=r.checklist||{};
    const nos=Object.values(chk).filter(v=>v==='no').length;
    const oks=Object.values(chk).filter(v=>v==='si').length;
    totalDetalles+=nos;
    totalOks+=oks;
    totalItems+=total;
    if(!r.firma)sinFirma++;
    if(r.observaciones&&r.observaciones.trim())conObs++;
  });
  const pctOk=totalItems?Math.round(totalOks/totalItems*100):0;

  const kpi=(label,val,sub,color,bg)=>`
    <div style="background:${bg||'#fff'};border:1px solid #E8EDF5;border-radius:12px;padding:14px 16px;flex:1;min-width:120px">
      <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:5px">${label}</div>
      <div style="font-size:26px;font-weight:900;letter-spacing:-1px;font-family:'JetBrains Mono',monospace;color:${color||'#0A1628'};line-height:1">${val}</div>
      <div style="font-size:10px;color:#94A3B8;margin-top:3px">${sub}</div>
    </div>`;

  return`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
    ${kpi('Cobertura',`${registrados}<span style="font-size:14px;font-weight:600;color:#94A3B8">/${totalVehs}</span>`,`${pctCobertura}% de vehículos registrados`,pctCobertura===100?'#15803D':pctCobertura>=70?'#D97706':'#B91C1C')}
    ${kpi('Ítems OK',`${pctOk}<span style="font-size:14px;font-weight:600;color:#94A3B8">%</span>`,`${totalOks} de ${totalItems} ítems revisados`,pctOk>=95?'#15803D':pctOk>=80?'#D97706':'#B91C1C')}
    ${kpi('Detalles detectados',totalDetalles,totalDetalles===0?'Sin detalles esta semana':`En ${regs.filter(r=>Object.values(r.checklist||{}).some(v=>v==='no')).length} vehículos`,totalDetalles===0?'#15803D':totalDetalles<=5?'#D97706':'#B91C1C','#fff')}
    ${kpi('Con observaciones',conObs,conObs===0?'Sin comentarios adicionales':`${conObs} técnico${conObs>1?'s':''} dejaron nota`,conObs>0?'#2563EB':'#94A3B8')}
    ${kpi('Sin firma',sinFirma,sinFirma===0?'Todos firmados ✓':`${sinFirma} pendiente${sinFirma>1?'s':''}`,sinFirma===0?'#15803D':'#B91C1C')}
  </div>`;
}

function rChkSemanal(){
  const semanas=[...new Set(flChkSem.map(r=>r.semana))].sort().reverse();
  const semSel=semanas[0]||getSemanaISOPortal();
  if(!semanas.length){
    setContent(padded(`
      <div style="font-size:17px;font-weight:900;letter-spacing:-.4px;margin-bottom:4px">Check list semanal</div>
      <div style="font-size:11px;color:#64748B;margin-bottom:14px">Inspección semanal de vehículos (lunes)</div>
      ${hCfgSemPanel()}
      <div class="fl-empty" style="min-height:200px"><div class="fl-empty-ico"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><h3>Sin registros</h3><p>Aún no se han registrado check lists semanales desde la app móvil.</p></div>
    `));
    return;
  }
  rChkSemanalTabla(semSel);
}

function rChkSemanalTabla(semSel){
  const semanas=[...new Set(flChkSem.map(r=>r.semana))].sort().reverse();
  const idx=semanas.indexOf(semSel);
  const total=Object.values(CHK_CATS).flat().length;
  let regs=flChkSem.filter(r=>r.semana===semSel);
  if(chkSemFiltroVeh)regs=regs.filter(r=>String(r.vehiculoEco)===String(chkSemFiltroVeh));
  // un registro por vehículo (el más reciente si hubiera duplicados)
  const porVeh={};
  regs.forEach(r=>{if(!porVeh[r.vehiculoEco]||(r.creadoEn||'')>(porVeh[r.vehiculoEco].creadoEn||''))porVeh[r.vehiculoEco]=r;});
  const ecos=Object.keys(porVeh).sort((a,b)=>Number(a)-Number(b));
  const vehsSinRegistro=flV.filter(v=>v.status!=='baja'&&!ecos.includes(String(v.eco))&&(!chkSemFiltroVeh||String(v.eco)===String(chkSemFiltroVeh)));

  const okCount=r=>Object.values(r.checklist||{}).filter(v=>v==='si').length;
  const noCount=r=>Object.values(r.checklist||{}).filter(v=>v==='no').length;
  const pctColor=r=>{const no=noCount(r);return no===0?'#15803D':no<=2?'#D97706':'#B91C1C';};
  const pctBg=r=>{const no=noCount(r);return no===0?'#DCFCE7':no<=2?'#FEF3C7':'#FEE2E2';};

  const thStyle='text-align:center;padding:8px 6px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;border-bottom:2px solid #E2E8F0;white-space:nowrap';
  const tdC='text-align:center;padding:8px 6px;';

  let trs='';
  ecos.forEach((eco,i)=>{
    const r=porVeh[eco];
    const v=flV.find(x=>String(x.eco)===String(eco))||{};
    const bg=i%2===0?'background:#fff':'background:#FAFBFD';
    const ok=okCount(r),no=noCount(r);
    trs+=`<tr style="border-bottom:1px solid #F1F5F9;${bg};cursor:pointer" onclick="flVerChkSem('${r.id}')">
      <td style="padding:8px 10px">
        <div style="font-weight:700;font-size:12px">${v.unidad||r.vehiculo||'—'}</div>
        <div style="font-size:10px;color:#64748B;font-family:'JetBrains Mono',monospace">ECO ${eco}</div>
      </td>
      <td style="${tdC}font-weight:700;font-family:'JetBrains Mono',monospace">${r.km?Number(r.km).toLocaleString():'—'}</td>
      <td style="${tdC}font-weight:700">${r.gasolina!=null?r.gasolina+'%':'—'}</td>
      <td style="${tdC}"><span style="background:${pctBg(r)};color:${pctColor(r)};font-size:10px;font-weight:800;padding:2px 8px;border-radius:99px">${ok}/${total} OK${no?' · '+no+' detalle'+(no>1?'s':''):''}</span></td>
      <td style="${tdC}">${r.observaciones?`<span title="${r.observaciones.replace(/"/g,'&quot;')}" style="color:#2563EB">${I.alert||'💬'}</span>`:'<span style="color:#94A3B8;font-size:10px">—</span>'}</td>
      <td style="${tdC}">${r.firma?'<span style="color:#15803D;font-weight:800">✓</span>':'<span style="color:#B91C1C;font-weight:800">✗</span>'}</td>
      <td style="${tdC}font-size:10px;color:#64748B">${flNombrePorCorreo(r.tecnico)||'—'}</td>
      <td style="${tdC}font-size:18px;color:#94A3B8">›</td>
    </tr>`;
  });
  vehsSinRegistro.forEach((v,i)=>{
    const bg=(ecos.length+i)%2===0?'background:#fff':'background:#FAFBFD';
    trs+=`<tr style="border-bottom:1px solid #F1F5F9;${bg};opacity:.55">
      <td style="padding:8px 10px">
        <div style="font-weight:700;font-size:12px">${v.unidad||'—'}</div>
        <div style="font-size:10px;color:#64748B;font-family:'JetBrains Mono',monospace">ECO ${v.eco}</div>
      </td>
      <td colspan="6" style="${tdC}color:#94A3B8;font-size:11px">Sin check list registrado esta semana</td>
      <td></td>
    </tr>`;
  });

  const body=trs?`<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:#F1F5F9">
      <th style="text-align:left;padding:8px 10px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;border-bottom:2px solid #E2E8F0">Vehículo</th>
      <th style="${thStyle}">KM</th>
      <th style="${thStyle}">Gasolina</th>
      <th style="${thStyle}">Check list</th>
      <th style="${thStyle}">Obs.</th>
      <th style="${thStyle}">Firma</th>
      <th style="${thStyle}">Técnico</th>
      <th style="${thStyle}"></th>
    </tr></thead><tbody>${trs}</tbody></table></div>
    <div style="font-size:10px;color:#94A3B8;margin-top:8px;text-align:right">Clic en un vehículo para ver el detalle completo</div>`
    :`<div class="fl-empty" style="min-height:160px"><div class="fl-empty-ico"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><h3>Sin registros</h3><p>No hay check lists para este vehículo en la semana seleccionada.</p></div>`;

  const navSem=`<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap">
    <button ${idx>=semanas.length-1?'disabled':''} onclick="rChkSemanalTabla('${semanas[idx+1]}')" style="padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:700;${idx>=semanas.length-1?'opacity:.4;cursor:default':''}">← Semana anterior</button>
    <span style="padding:6px 12px;border-radius:8px;background:#0A1628;color:#fff;font-size:12px;font-weight:700;font-family:'JetBrains Mono',monospace">${semSel}</span>
    ${idx>0?`<button onclick="rChkSemanalTabla('${semanas[idx-1]}')" style="padding:6px 12px;border:1.5px solid #E2E8F0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;font-weight:700">Semana siguiente →</button>`:''}
    <select onchange="chkSemFiltroVeh=this.value;rChkSemanalTabla('${semSel}')" style="margin-left:auto;padding:6px 10px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px">
      <option value="">Todos los vehículos</option>
      ${flV.filter(v=>v.status!=='baja').map(v=>`<option value="${v.eco}" ${String(v.eco)===String(chkSemFiltroVeh)?'selected':''}>ECO ${v.eco} · ${v.unidad||''}</option>`).join('')}
    </select>
  </div>`;

  setContent(padded(`
    <div style="font-size:17px;font-weight:900;letter-spacing:-.4px;margin-bottom:4px">Check list semanal</div>
    <div style="font-size:11px;color:#64748B;margin-bottom:10px">Semana ${semSel} · ${ecos.length} de ${ecos.length+vehsSinRegistro.length} vehículos registrados · ${Object.values(porVeh).reduce((a,r)=>a+Object.values(r.checklist||{}).filter(v=>v==='no').length,0)} detalles detectados</div>
    ${hCfgSemPanel()}
    ${!chkSemFiltroVeh?hChkSemMetrics(semSel,porVeh,vehsSinRegistro,total):''}
    ${navSem}
    ${body}
  `));
}
window.rChkSemanal=rChkSemanal;
window.rChkSemanalTabla=rChkSemanalTabla;

// ── DETALLE CHECK LIST SEMANAL ──
window.flVerChkSem=async function(id){
  const r=flChkSem.find(x=>x.id===id);if(!r)return;
  const v=flV.find(x=>String(x.eco)===String(r.vehiculoEco))||{};
  const chk=r.checklist||{};

  // Cargar fotos de la subcolección (nuevo modelo) o del doc principal (legacy)
  let chkFotos=r.chkFotos||{};
  let evidencias=r.evidencias||[];
  const tieneSubcol=r.chkFotosKeys&&r.chkFotosKeys.length>0;
  if(tieneSubcol){
    try{
      const fotosSnap=await fs.getDocs(fs.collection(db,C.CHKSEM,id,'fotos'));
      fotosSnap.docs.forEach(d=>{
        const f=d.data();
        if(f.tipo==='chk'&&f.key)chkFotos[f.key]={src:f.src,meta:f.meta||{}};
        if(f.tipo==='evidencia')evidencias.push({src:f.src,meta:f.meta||{}});
      });
    }catch(e){console.warn('[FL] fotos subcol:',e);}
  }
  let chkHtml='';
  Object.entries(CHK_CATS).forEach(([cat,items])=>{
    chkHtml+=`<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin:10px 0 5px;border-bottom:1px solid #E2E8F0;padding-bottom:3px">${cat}</div>`;
    items.forEach((item,i)=>{
      const key=`sem-${cat}-${i}`;
      const val=chk[key]||'';
      const foto=chkFotos[key];
      const fotoSrc=foto?(typeof foto==='object'?foto.src:foto):null;
      chkHtml+=`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F8FAFD">
        <span style="flex:1;font-size:12px">${item}</span>
        <span style="font-size:10px;font-weight:800;padding:2px 9px;border-radius:99px;${val==='si'?'background:#DCFCE7;color:#15803D':val==='no'?'background:#FEE2E2;color:#B91C1C':'background:#F1F5F9;color:#94A3B8'}">${val==='si'?'OK':val==='no'?'Detalle':'—'}</span>
        ${fotoSrc?`<img src="${fotoSrc}" onclick="flImg('${fotoSrc}')" style="width:32px;height:32px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid #E2E8F0">`:'<div style="width:32px"></div>'}
      </div>`;
    });
  });
  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal" style="max-width:520px">
    <div class="fl-mh"><h3>${I.truck||''} Check list semanal · ${r.semana}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb">
      <div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:9px;overflow:hidden;border:1px solid #E8EDF5;margin-bottom:10px">
        ${[['Vehículo',`ECO ${r.vehiculoEco} · ${v.unidad||r.vehiculo||'—'}`],['Fecha',hF(r.fecha)],['Kilometraje',r.km?Number(r.km).toLocaleString()+' km':'—'],['Gasolina',r.gasolina!=null?r.gasolina+'%':'—'],['Técnico',flNombrePorCorreo(r.tecnico)||'—'],['Semana',r.semana||'—']].map(([l,val])=>`<dl style="padding:7px 11px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</dt><dd style="font-size:11.5px;font-weight:600">${val}</dd></dl>`).join('')}
      </div>

      ${evidencias?.length?`<div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Evidencias generales</div><div class="fl-pills" style="margin-bottom:10px">${evidencias.map((e,i)=>{const src=typeof e==='object'?e.src:e;return`<span class="fl-pill" onclick="flImg('${src}')">${I.camera||'📷'} Foto ${i+1}</span>`;}).join('')}</div>`:''}

      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#374151;margin:6px 0 2px">Check list de inspección</div>
      ${chkHtml}

      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin:12px 0 4px">Observaciones</div>
      <div style="font-size:12px;background:#F8FAFD;border-radius:8px;padding:9px 11px;border:1px solid #E8EDF5;min-height:20px">${r.observaciones||'<span style="color:#94A3B8">Sin observaciones</span>'}</div>

      <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin:12px 0 4px">Firma del técnico</div>
      ${r.firma?`<img src="${r.firma}" onclick="flImg('${r.firma}')" style="max-width:240px;width:100%;border:1px solid #E8EDF5;border-radius:8px;cursor:pointer;background:#fff">`:'<div style="font-size:12px;color:#B91C1C;font-weight:700">⚠ Sin firma registrada</div>'}

      <div class="fl-fa" style="margin-top:14px">
        <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
        <button class="fb gho" onclick="flGenerarPDFChkSem('${id}')" style="display:inline-flex;align-items:center;gap:5px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF
        </button>
      </div>
    </div></div>`;
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};


// ── EXPORTAR CHECK LIST SEMANAL A PDF ──
window.flGenerarPDFChkSem = async function(id) {
  const r = flChkSem.find(x => x.id === id); if (!r) return;
  const v = flV.find(x => String(x.eco) === String(r.vehiculoEco)) || {};

  // Cargar fotos de subcol si aplica
  let chkFotos = r.chkFotos || {};
  let evidencias = r.evidencias || [];
  const tieneSubcol = r.chkFotosKeys && r.chkFotosKeys.length > 0;
  if (tieneSubcol) {
    try {
      const fotosSnap = await fs.getDocs(fs.collection(db, C.CHKSEM, id, 'fotos'));
      fotosSnap.docs.forEach(d => {
        const f = d.data();
        if (f.tipo === 'chk' && f.key) chkFotos[f.key] = { src: f.src, meta: f.meta || {} };
        if (f.tipo === 'evidencia') evidencias.push({ src: f.src, meta: f.meta || {} });
      });
    } catch(e) { console.warn('[PDF chksem]', e); }
  }

  const chk = r.checklist || {};
  const gasPct = Number(r.gasolina) || 0;
  const gasColor = gasPct > 50 ? '#16A34A' : gasPct > 25 ? '#D97706' : '#DC2626';

  // Gauge SVG de gasolina
  const toRad = deg => deg * Math.PI / 180;
  const arcX = (rad, deg) => 50 + rad * Math.cos(toRad(deg));
  const arcY = (rad, deg) => 50 + rad * Math.sin(toRad(deg));
  const startDeg = -210, endDeg = 30;
  const fillDeg = startDeg + (gasPct / 100) * (endDeg - startDeg);
  const largeArc = gasPct > 50 ? 1 : 0;
  const trackPath = `M ${arcX(35,startDeg)} ${arcY(35,startDeg)} A 35 35 0 1 1 ${arcX(35,endDeg)} ${arcY(35,endDeg)}`;
  const fillPath = gasPct > 0 ? `M ${arcX(35,startDeg)} ${arcY(35,startDeg)} A 35 35 0 ${largeArc} 1 ${arcX(35,fillDeg)} ${arcY(35,fillDeg)}` : '';
  const gasSVG = `<svg width="100" height="65" viewBox="0 0 100 65">
    <path d="${trackPath}" fill="none" stroke="#E2E8F0" stroke-width="9" stroke-linecap="round"/>
    ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${gasColor}" stroke-width="9" stroke-linecap="round"/>` : ''}
    <text x="50" y="50" text-anchor="middle" font-size="16" font-weight="900" fill="${gasColor}" font-family="system-ui">${gasPct}%</text>
    <text x="50" y="62" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="system-ui">GASOLINA</text>
  </svg>`;

  // Construir filas del checklist por categoría
  let chkFullHTML = '';
  for (const [cat, items] of Object.entries(CHK_CATS)) {
    let catRows = '';
    items.forEach((item, idx) => {
      const key = `sem-${cat}-${idx}`;
      const val = chk[key] || '';
      const foto = chkFotos[key];
      const fotoSrc = foto ? (typeof foto === 'object' ? foto.src : foto) : null;
      const isDetalle = val === 'no';
      const badge = val === 'si'
        ? `<span style="display:inline-block;padding:2px 8px;background:#DCFCE7;color:#15803D;border-radius:10px;font-size:9px;font-weight:800">OK</span>`
        : val === 'no'
          ? `<span style="display:inline-block;padding:2px 8px;background:#FEE2E2;color:#B91C1C;border-radius:10px;font-size:9px;font-weight:800">Detalle</span>`
          : `<span style="display:inline-block;padding:2px 8px;background:#F1F5F9;color:#94A3B8;border-radius:10px;font-size:9px;font-weight:700">—</span>`;
      const fotoEl = fotoSrc
        ? `<img src="${fotoSrc}" style="width:56px;height:42px;object-fit:cover;border-radius:4px;border:1px solid ${isDetalle?'#FCA5A5':'#E2E8F0'};float:right;margin-left:6px">`
        : '';
      catRows += `<tr style="border-bottom:1px solid #F8FAFD;${isDetalle?'background:#FFF5F5':''}">
        <td style="padding:5px 8px;font-size:10.5px;color:${isDetalle?'#991B1B':'#374151'};font-weight:${isDetalle?'700':'400'}">${item}</td>
        <td style="padding:5px 8px;text-align:center;white-space:nowrap">${badge}</td>
        <td style="padding:5px 8px;text-align:right">${fotoEl}</td>
      </tr>`;
    });
    chkFullHTML += `<div style="margin-bottom:14px;break-inside:avoid">
      <div style="background:#1E3A5F;color:#fff;padding:5px 10px;border-radius:5px 5px 0 0;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.6px">${cat}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-top:none">
        <thead><tr style="background:#F8FAFD">
          <th style="padding:4px 8px;font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;text-align:left">Ítem</th>
          <th style="padding:4px 8px;font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;width:70px">Estado</th>
          <th style="padding:4px 8px;font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;width:70px;text-align:right">Foto</th>
        </tr></thead>
        <tbody>${catRows}</tbody>
      </table>
    </div>`;
  }

  // Evidencias generales
  const evThumbsHTML = evidencias.length
    ? evidencias.map((e, i) => {
        const src = typeof e === 'object' ? e.src : e;
        const meta = typeof e === 'object' ? e.meta : {};
        return `<div style="display:inline-block;margin:4px;text-align:center;vertical-align:top">
          <img src="${src}" style="width:110px;height:82px;object-fit:cover;border-radius:6px;border:1px solid #E2E8F0;display:block">
          <div style="font-size:8px;color:#64748B;margin-top:2px;font-family:monospace;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${meta.codigo||'Foto '+(i+1)}</div>
        </div>`;
      }).join('')
    : '<div style="font-size:11px;color:#94A3B8;padding:8px">Sin evidencias generales</div>';

  // Resumen del checklist
  const totalItems = Object.values(CHK_CATS).flat().length;
  const okItems = Object.values(chk).filter(v => v === 'si').length;
  const detalleItems = Object.values(chk).filter(v => v === 'no').length;
  const sinResp = totalItems - okItems - detalleItems;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
  <title>Check List Semanal — ECO ${r.vehiculoEco} — ${r.semana}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,Arial,sans-serif;font-size:11px;color:#0A0F1E;background:#fff;padding:28px 32px}
    .logo{font-size:20px;font-weight:900;letter-spacing:-1px}
    .logo em{color:#2563EB;font-style:normal}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A1628;padding-bottom:14px;margin-bottom:18px}
    .veh-bar{background:#0A1628;color:#fff;border-radius:9px;padding:11px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
    .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
    .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
    .field{background:#F8FAFD;border-radius:7px;padding:8px 11px;border:1px solid #E8EDF5}
    .field label{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:2px}
    .field span{font-size:12px;font-weight:700;line-height:1.4}
    .sec{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#64748B;margin:16px 0 8px;padding-top:12px;border-top:1px solid #E8EDF5}
    .kpi-bar{display:flex;gap:8px;margin-bottom:14px}
    .kpi{flex:1;background:#F8FAFD;border:1px solid #E8EDF5;border-radius:8px;padding:8px 10px;text-align:center}
    .kpi-v{font-size:22px;font-weight:900;line-height:1}
    .kpi-l{font-size:8px;font-weight:700;text-transform:uppercase;color:#94A3B8;margin-top:2px}
    .gas-box{display:flex;align-items:center;gap:16px;background:#F8FAFD;border-radius:9px;padding:12px 16px;border:1px solid #E8EDF5;margin-bottom:12px}
    .footer{margin-top:24px;padding-top:10px;border-top:1px solid #E8EDF5;font-size:9px;color:#94A3B8;text-align:center}
    @media print{body{padding:14px 16px;font-size:10.5px}button{display:none!important}}
  </style></head><body>
  <div class="hdr">
    <div>
      <div class="logo">TECNO<em>CONTROL</em></div>
      <div style="font-size:10.5px;color:#64748B;margin-top:3px">Check List de Inspección Semanal</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:22px;font-weight:900;font-family:monospace;letter-spacing:1px;color:#1E3A5F">${r.semana}</div>
      <div style="font-size:10px;color:#64748B;margin-top:4px">${r.fecha||'—'}</div>
    </div>
  </div>

  <div class="veh-bar">
    <div>
      <div style="font-size:14px;font-weight:800">${v.unidad||r.vehiculo||'—'} ${v.año||''}</div>
      <div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:2px;font-family:monospace">ECO ${r.vehiculoEco} · ${v.placas||'—'} · ${v.plaza||'—'}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:rgba(255,255,255,.6)">Técnico: ${flNombrePorCorreo(r.tecnico)||'—'}</div>
  </div>

  <div class="grid3">
    <div class="field"><label>Kilometraje</label><span>${r.km?Number(r.km).toLocaleString('es-MX')+' km':'—'}</span></div>
    <div class="field"><label>Responsable</label><span>${v.responsable||'—'}</span></div>
    <div class="field"><label>Plaza</label><span>${v.plaza||'—'}</span></div>
  </div>

  <div class="gas-box">
    <div>${gasSVG}</div>
    <div>
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:4px">Nivel de combustible</div>
      <div style="font-size:28px;font-weight:900;color:${gasColor};line-height:1">${gasPct}%</div>
    </div>
    <div style="flex:1;margin-left:24px">
      <div class="kpi-bar">
        <div class="kpi"><div class="kpi-v" style="color:#15803D">${okItems}</div><div class="kpi-l">OK</div></div>
        <div class="kpi"><div class="kpi-v" style="color:#B91C1C">${detalleItems}</div><div class="kpi-l">Detalles</div></div>
        <div class="kpi"><div class="kpi-v" style="color:#94A3B8">${sinResp}</div><div class="kpi-l">Sin resp.</div></div>
        <div class="kpi"><div class="kpi-v" style="color:#0A1628">${totalItems}</div><div class="kpi-l">Total ítems</div></div>
      </div>
    </div>
  </div>

  ${evidencias.length ? `<div class="sec">Evidencias generales (${evidencias.length})</div><div style="margin-bottom:12px">${evThumbsHTML}</div>` : ''}

  <div class="sec">Check list de inspección</div>
  ${chkFullHTML}

  ${r.observaciones ? `<div class="sec">Observaciones</div>
  <div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;border:1px solid #E2E8F0;font-size:12px;margin-bottom:14px">${r.observaciones}</div>` : ''}

  <div class="sec">Firma del técnico</div>
  ${r.firma
    ? `<img src="${r.firma}" style="max-width:220px;border:1px solid #E8EDF5;border-radius:8px;background:#fff;display:block;margin-bottom:14px">`
    : '<div style="font-size:12px;color:#B91C1C;font-weight:700;margin-bottom:14px">⚠ Sin firma registrada</div>'}

  <div class="footer">Generado por Portal Flotilla Tecnocontrol · ${new Date().toLocaleString('es-MX')} · ID: ${id}</div>
  <div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end">
    <button onclick="window.print()" style="padding:11px 28px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">
      Imprimir / Guardar PDF
    </button>
  </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=860,height=960');
  if (win) { win.document.write(html); win.document.close(); }
};

// ══════════════════════════════════════════════════════
// VISTA RESUMEN DE MOVIMIENTOS — Mini-dashboards + PDF Dirección
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// VISTA PRESUPUESTO VS GASTOS — Dashboard ejecutivo de Flotilla
// Editable por: P.Pinedo, M.DelaO, C.Acosta, mercadotecnia@, Glen
// ══════════════════════════════════════════════════════════════
const PRESUPUESTO_ADMINS=[
  'p.pinedo@tecnocontrol.com.mx',
  'm.delao@tecnocontrol.com.mx',
  'c.acosta@tecnocontrol.com.mx',
  'mercadotecniatecnocontrol@gmail.com',
  'mercadotecnia@tecnocontrol.com.mx',
  'glen@tecnocontrol.com.mx',
  'fatima@tecnocontrol.com.mx',
];
const puedeEditarPresupuesto=()=>PRESUPUESTO_ADMINS.includes((window.auth?.currentUser?.email||'').toLowerCase());

// Cache del presupuesto cargado desde Firestore
let _presupuestoData=null;

async function cargarPresupuesto(){
  try{
    const snap=await fs.getDoc(fs.doc(db,'flotilla_config','presupuesto'));
    _presupuestoData=snap.exists()?snap.data():{};
  }catch(e){_presupuestoData={};}
}

async function rPresupuesto(){
  setContent(`<div style="padding:20px 24px;max-width:1100px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.3px">Presupuesto vs Gastos</div>
        <div style="font-size:12px;color:#64748B;margin-top:2px">Cargando datos…</div>
      </div>
    </div>
    <div id="fl-pres-body" style="color:#64748B;font-size:13px">Cargando…</div>
  </div>`);
  await cargarPresupuesto();
  _renderPresupuesto();
}

function _renderPresupuesto(){
  const hoy=new Date();
  const mes=hoy.getMonth();
  const anio=hoy.getFullYear();
  const mesNom=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(hoy);
  const puedeEditar=puedeEditarPresupuesto();
  const d=_presupuestoData||{};

  // Presupuesto mensual aprobado
  const presTotal=Number(d.presupuestoMensual)||0;

  // Calcular gastos reales desde solicitudes cerradas este mes con monto
  const solsMes=flS.filter(s=>{
    if(!s.montoCotizacion)return false;
    const f=new Date(s.actualizadoEn||s.creadoEn||'');
    return s.estatus==='Cerrada'&&f.getMonth()===mes&&f.getFullYear()===anio;
  });
  const gastadoTotal=solsMes.reduce((a,s)=>a+Number(s.montoCotizacion||0),0);

  // Solicitudes en proceso (comprometido) — SOLO las generadas en el mes actual.
  // Las que se arrastran de meses anteriores no cuentan contra el presupuesto de este mes.
  const solsEnProceso=flS.filter(s=>{
    if(!s.montoCotizacion)return false;
    if(!['Servicio','Pagos','Cierre'].includes(s.estatus))return false;
    const f=new Date(s.creadoEn||s.actualizadoEn||'');
    return f.getMonth()===mes&&f.getFullYear()===anio;
  });
  const comprometido=solsEnProceso.reduce((a,s)=>a+Number(s.montoCotizacion||0),0);

  const disponible=Math.max(0,presTotal-gastadoTotal-comprometido);
  const pctGastado=presTotal?Math.round(gastadoTotal/presTotal*100):0;
  const pctComprometido=presTotal?Math.round(comprometido/presTotal*100):0;
  const pctDisp=presTotal?Math.round(disponible/presTotal*100):0;
  const alerta=presTotal&&(gastadoTotal+comprometido)>presTotal*0.85;

  // Gastos por tipo de servicio
  const porTipo={};
  solsMes.forEach(s=>{const t=s.tipo||'Otro';porTipo[t]=(porTipo[t]||0)+Number(s.montoCotizacion||0);});
  const topTipos=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxTipo=topTipos[0]?.[1]||1;

  // Límite por solicitud (alerta automática)
  const limiteSol=Number(d.limitePorSolicitud)||0;

  const fmt=n=>n.toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0});

  const kpi=(val,label,sub,cl,bg)=>`
    <div style="background:${bg};border-radius:12px;padding:16px 20px">
      <div style="font-size:26px;font-weight:900;color:${cl};line-height:1">${val}</div>
      <div style="font-size:11px;font-weight:800;margin-top:4px;color:#0A1628">${label}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${sub}</div>
    </div>`;

  const hBar=(label,val,max,cl)=>`
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:4px">
        <span style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
        <span style="font-weight:800;color:${cl}">${fmt(val)}</span>
      </div>
      <div style="height:6px;background:#F1F5F9;border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100,Math.round(val/max*100))}%;background:${cl};border-radius:100px"></div>
      </div>
    </div>`;

  // Barra de progreso presupuesto
  const barraPresupuesto=presTotal?`
    <div style="margin:16px 0">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#64748B;margin-bottom:6px">
        <span>Uso del presupuesto</span>
        <span style="font-weight:700;color:${alerta?'#B91C1C':'#0A1628'}">${pctGastado+pctComprometido}%</span>
      </div>
      <div style="height:12px;background:#F1F5F9;border-radius:100px;overflow:hidden;display:flex">
        <div style="height:100%;width:${pctGastado}%;background:#15803D;border-radius:100px 0 0 100px;transition:width .5s"></div>
        <div style="height:100%;width:${pctComprometido}%;background:#F59E0B"></div>
      </div>
      <div style="display:flex;gap:16px;margin-top:6px;font-size:10px">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#15803D;border-radius:50%;display:inline-block"></span>Gastado ${pctGastado}%</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#F59E0B;border-radius:50%;display:inline-block"></span>Comprometido ${pctComprometido}%</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;background:#E2E8F0;border-radius:50%;display:inline-block"></span>Disponible ${pctDisp}%</span>
      </div>
    </div>`:'';

  document.getElementById('fl-pres-body').innerHTML=`

    <!-- ALERTA si se supera 85% -->
    ${alerta?`<div style="background:#FEF2F2;border:1.5px solid #FECACA;border-radius:12px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <div><div style="font-size:12.5px;font-weight:800;color:#B91C1C">Alerta de presupuesto</div>
      <div style="font-size:11px;color:#991B1B">Comprometido: ${fmt(comprometido)} · Gastado: ${fmt(gastadoTotal)} de ${fmt(presTotal)} en ${mesNom}. ${disponible>0?`Quedan ${fmt(disponible)} disponibles.`:'Presupuesto rebasado.'}</div></div>
    </div>`:''}

    <!-- HEADER con fecha y botón editar -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:12px;color:#64748B">${mesNom} · ${flS.length} solicitudes totales</div>
      ${puedeEditar?`<button onclick="flModalEditarPresupuesto()" style="display:flex;align-items:center;gap:6px;padding:8px 16px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar presupuesto
      </button>`:`<span style="font-size:11px;color:#94A3B8">Solo P.Pinedo, M.DelaO, C.Acosta o Glen pueden editar</span>`}
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:20px">
      ${kpi(presTotal?fmt(presTotal):'Sin definir','Presupuesto mensual','Aprobado para '+mesNom,'#2563EB','#EFF6FF')}
      ${kpi(fmt(gastadoTotal),'Gastado (mes)','Solicitudes cerradas','#15803D','#F0FDF4')}
      ${kpi(fmt(comprometido),'Comprometido','En proceso · '+mesNom,'#B45309','#FFFBEB')}
      ${kpi(fmt(disponible),'Disponible',disponible<=0?'Presupuesto agotado':'Saldo restante',disponible<=0?'#B91C1C':disponible<presTotal*0.2?'#B45309':'#15803D',disponible<=0?'#FEF2F2':disponible<presTotal*0.2?'#FFFBEB':'#F0FDF4')}
      ${kpi(solsMes.length,'Servicios cerrados','Este mes','#7C3AED','#F5F3FF')}
      ${kpi(limiteSol?fmt(limiteSol):'Sin límite','Límite por solicitud',limiteSol?'Alerta a Contraloría si se supera':'No configurado','#0369A1','#EFF8FF')}
    </div>

    <!-- BARRA DE PROGRESO -->
    ${presTotal?`<div style="background:#fff;border-radius:14px;padding:16px 20px;border:1px solid #E8EDF5;margin-bottom:16px">${barraPresupuesto}</div>`:''}

    <!-- FILA: Por tipo + Solicitudes con monto -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Gasto por tipo de servicio</div>
        ${topTipos.length?topTipos.map(([t,n])=>hBar(t,n,maxTipo,'#2563EB')).join(''):`<div style="font-size:11px;color:#94A3B8">Sin servicios cerrados con monto este mes</div>`}
      </div>

      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Servicios en proceso (comprometido)</div>
        ${solsEnProceso.length?solsEnProceso.slice(0,8).map(s=>`
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F8FAFD">
            <div style="font-size:10px;font-weight:700;color:#B45309;font-family:monospace">ECO ${s.vehiculoEco||'—'}</div>
            <div style="flex:1;font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.tipo||'—'}</div>
            <div style="font-size:12px;font-weight:800;color:#B45309">${fmt(Number(s.montoCotizacion||0))}</div>
          </div>`).join(''):`<div style="font-size:11px;color:#94A3B8">Sin servicios en proceso con monto</div>`}
        ${solsEnProceso.length>8?`<div style="font-size:10px;color:#94A3B8;margin-top:6px">+${solsEnProceso.length-8} más</div>`:''}
      </div>
    </div>

    <!-- HISTORIAL SERVICIOS CERRADOS ESTE MES -->
    <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Servicios cerrados este mes (${solsMes.length})</div>
      ${solsMes.length?`
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11.5px">
          <thead><tr style="border-bottom:2px solid #F1F5F9">
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">ECO</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Tipo</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Taller</th>
            <th style="text-align:left;padding:6px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Fecha</th>
            <th style="text-align:right;padding:6px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Monto</th>
          </tr></thead>
          <tbody>
            ${solsMes.map(s=>`<tr style="border-bottom:1px solid #F8FAFD">
              <td style="padding:7px 8px;font-weight:700;color:#0A1628;font-family:monospace">ECO ${s.vehiculoEco||'—'}</td>
              <td style="padding:7px 8px;color:#475569">${s.tipo||'—'}</td>
              <td style="padding:7px 8px;color:#475569">${s.tallerNombre||'—'}</td>
              <td style="padding:7px 8px;color:#94A3B8">${(s.actualizadoEn||s.creadoEn||'').substring(0,10)}</td>
              <td style="padding:7px 8px;font-weight:800;color:#15803D;text-align:right">${fmt(Number(s.montoCotizacion||0))}</td>
            </tr>`).join('')}
            <tr style="border-top:2px solid #E2E8F0">
              <td colspan="4" style="padding:8px;font-weight:800;color:#0A1628;font-size:12px">Total gastado</td>
              <td style="padding:8px;font-weight:900;color:#15803D;text-align:right;font-size:13px">${fmt(gastadoTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>`:`<div style="font-size:11px;color:#94A3B8">Sin servicios cerrados con monto registrado este mes</div>`}
    </div>`;
}
window._renderPresupuesto=_renderPresupuesto;

// ── MODAL EDITAR PRESUPUESTO ────────────────────────────────────
window.flModalEditarPresupuesto=function(){
  if(!puedeEditarPresupuesto()){flToast('Sin permiso para editar presupuesto','err');return;}
  const d=_presupuestoData||{};
  const ov=document.createElement('div');ov.className='fl-ov';
  ov.innerHTML=`<div class="fl-modal" style="max-width:420px">
    <div class="fl-mh">
      <h3>Editar presupuesto mensual</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:6px">Presupuesto mensual aprobado</label>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15px;font-weight:700;color:#64748B">$</span>
          <input type="number" id="pres-mensual" value="${d.presupuestoMensual||''}" placeholder="0.00" inputmode="decimal" style="flex:1;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;outline:none">
          <span style="font-size:12px;color:#64748B">MXN</span>
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:6px">Límite por solicitud individual</label>
        <div style="font-size:10px;color:#94A3B8;margin-bottom:6px">Si una cotización supera este monto, se notifica automáticamente a Contraloría y Administración</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:15px;font-weight:700;color:#64748B">$</span>
          <input type="number" id="pres-limite-sol" value="${d.limitePorSolicitud||''}" placeholder="Sin límite" inputmode="decimal" style="flex:1;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;outline:none">
          <span style="font-size:12px;color:#64748B">MXN</span>
        </div>
      </div>
      <div>
        <label style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;display:block;margin-bottom:6px">Notas del presupuesto</label>
        <textarea id="pres-notas" placeholder="Observaciones, restricciones, notas…" rows="2" style="width:100%;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:10px;font-family:inherit;font-size:12.5px;outline:none;resize:none;box-sizing:border-box">${d.notas||''}</textarea>
      </div>
      <div id="pres-msg" style="display:none;font-size:11px;padding:8px 12px;border-radius:8px"></div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('.fl-ov').remove()" class="fb gho">Cancelar</button>
        <button onclick="flGuardarPresupuesto()" style="flex:1;padding:10px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">Guardar presupuesto</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flGuardarPresupuesto=async function(){
  if(!puedeEditarPresupuesto()){flToast('Sin permiso','err');return;}
  const mensual=Number(document.getElementById('pres-mensual')?.value)||0;
  const limiteSol=Number(document.getElementById('pres-limite-sol')?.value)||0;
  const notas=(document.getElementById('pres-notas')?.value||'').trim();
  const msg=document.getElementById('pres-msg');
  if(msg){msg.style.display='';msg.style.background='#EFF6FF';msg.style.color='#1D4ED8';msg.textContent='Guardando…';}
  try{
    const upd={
      presupuestoMensual:mensual,limitePorSolicitud:limiteSol,notas,
      actualizadoEn:new Date().toISOString(),
      actualizadoPor:window.auth?.currentUser?.email||'',
    };
    await fs.setDoc(fs.doc(db,'flotilla_config','presupuesto'),upd,{merge:true});
    _presupuestoData={..._presupuestoData,...upd};
    if(msg){msg.style.background='#F0FDF4';msg.style.color='#15803D';msg.textContent='Presupuesto guardado correctamente';}
    setTimeout(()=>{document.querySelector('.fl-ov')?.remove();_renderPresupuesto();},800);
    flToast('Presupuesto actualizado','ok');
  }catch(e){
    if(msg){msg.style.background='#FEF2F2';msg.style.color='#B91C1C';msg.textContent='Error: '+e.message;}
  }
};

// ── ALERTA AUTOMÁTICA si cotización supera límite ───────────────
// Llamada desde flModalEvaluacion/Servicio cuando se guarda montoCotizacion
window.flAlertaCotizacion=async function(solicitudId,monto){
  try{
    await cargarPresupuesto();
    const limite=Number(_presupuestoData?.limitePorSolicitud)||0;
    if(!limite||monto<=limite)return;
    // Enviar notificación a Contraloría y Administración
    const s=flS.find(x=>x.id===solicitudId);
    const eco=s?.vehiculoEco||'—';
    const tipo=s?.tipo||'—';
    const fmt=n=>n.toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0});
    const msg=`ALERTA: Cotización de ${fmt(monto)} para ECO ${eco} (${tipo}) supera el límite autorizado de ${fmt(limite)}. Solicitud ID: ${solicitudId}. Se requiere autorización especial.`;
    // Notificación en Firestore
    await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      tipo:'alerta_presupuesto',solicitudId,vehiculoEco:eco,
      para:'contraloria',
      mensaje:msg,
      monto,limiteConfigurado:limite,
      leido:false,creadaEn:new Date().toISOString(),
      prioridad:'alta',
    });
    flToast(`Alerta enviada a Contraloría: cotización supera el límite de ${fmt(limite)}`,'err');
  }catch(e){console.warn('[flAlertaCotizacion]',e);}
};

// ── Enganchar alerta en flModalEvaluacion al guardar monto ──────
// Se llama después de guardar montoCotizacion en cualquier modal de evaluación
window.flCheckLimitePresupuesto=function(solicitudId,monto){
  if(monto&&Number(monto)>0)flAlertaCotizacion(solicitudId,Number(monto));
};

function rResumen(){
  const hoy=new Date();
  const mesActual=hoy.getMonth();
  const anioActual=hoy.getFullYear();

  // ── Helpers de rango ──
  const enMes=(iso,m,a)=>{if(!iso)return false;const d=new Date(iso);return d.getMonth()===m&&d.getFullYear()===a;};
  const ultimas=(n)=>{const lim=new Date();lim.setDate(lim.getDate()-n);return iso=>iso&&new Date(iso)>=lim;};

  // ── Solicitudes de este mes ──
  const solsMes=flS.filter(s=>enMes(s.creadoEn,mesActual,anioActual));
  const solsTotal=flS.length;
  const cerradasMes=solsMes.filter(s=>s.estatus==='Cerrada').length;
  const rechazadasMes=solsMes.filter(s=>s.estatus==='Rechazada').length;
  const enServicio=flS.filter(s=>['Servicio','Pagos','Cierre'].includes(s.estatus)).length;

  // ── Tipos más frecuentes ──
  const porTipo={};
  flS.forEach(s=>{const t=s.tipo||'Otro';porTipo[t]=(porTipo[t]||0)+1;});
  const topTipos=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxTipo=topTipos[0]?.[1]||1;

  // ── Por plaza ──
  const porPlaza={};
  flS.forEach(s=>{
    const v=flV.find(x=>String(x.eco)===String(s.vehiculoEco));
    const pl=v?.plaza||'Sin plaza';
    porPlaza[pl]=(porPlaza[pl]||0)+1;
  });
  const topPlazas=Object.entries(porPlaza).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxPlaza=topPlazas[0]?.[1]||1;

  // ── Vehículos con más solicitudes ──
  const porVeh={};
  flS.forEach(s=>{const k=`ECO ${s.vehiculoEco||'?'} · ${s.vehiculo||'—'}`;porVeh[k]=(porVeh[k]||0)+1;});
  const topVehs=Object.entries(porVeh).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // ── Tendencia últimas 8 semanas ──
  const semanas=[];
  for(let i=7;i>=0;i--){
    const ini=new Date();ini.setDate(ini.getDate()-i*7-ini.getDay());ini.setHours(0,0,0,0);
    const fin=new Date(ini);fin.setDate(fin.getDate()+6);fin.setHours(23,59,59,999);
    const label=`S${8-i}`;
    const n=flS.filter(s=>s.creadoEn&&new Date(s.creadoEn)>=ini&&new Date(s.creadoEn)<=fin).length;
    semanas.push({label,n});
  }
  const maxSem=Math.max(...semanas.map(s=>s.n),1);

  // ── Estado flota ──
  const activos=flV.filter(v=>v.status!=='baja');
  const enTallerV=flContarTaller(activos);
  const enTallerSol=0; // (deprecado) fuente única = status==='taller'
  const sinResp=activos.filter(v=>!v.responsable||v.responsable==='—').length;
  const polVencidas=activos.filter(v=>{const d=new Date(v.pv||'');return v.pv&&d<hoy;}).length;
  const polPorVencer=activos.filter(v=>{const d=new Date(v.pv||'');const dias=Math.round((d-hoy)/864e5);return v.pv&&dias>=0&&dias<=90;}).length;

  // ── KPI cards ──
  const kpi=(val,label,sub,cl,bg)=>`
    <div style="background:${bg};border-radius:12px;padding:16px 20px;min-width:0">
      <div style="font-size:28px;font-weight:900;color:${cl};line-height:1">${val}</div>
      <div style="font-size:11px;font-weight:800;margin-top:4px;color:#0A1628">${label}</div>
      <div style="font-size:10px;color:#64748B;margin-top:2px">${sub}</div>
    </div>`;

  // ── Barra horizontal ──
  const hBar=(label,val,max,cl)=>`
    <div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:600;margin-bottom:4px">
        <span style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${label}</span>
        <span style="font-weight:800;color:${cl}">${val}</span>
      </div>
      <div style="height:6px;background:#F1F5F9;border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${Math.round(val/max*100)}%;background:${cl};border-radius:100px;transition:width .4s"></div>
      </div>
    </div>`;

  // ── Gráfico de barras verticales (tendencia) ──
  const vBar=semanas.map(s=>`
    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1">
      <div style="font-size:10px;font-weight:800;color:#1D4ED8">${s.n||''}</div>
      <div style="width:100%;background:#EFF6FF;border-radius:4px;overflow:hidden;height:80px;display:flex;align-items:flex-end">
        <div style="width:100%;height:${s.n?Math.max(8,Math.round(s.n/maxSem*80)):2}px;background:linear-gradient(180deg,#3B82F6,#1D4ED8);border-radius:4px 4px 0 0;transition:height .4s"></div>
      </div>
      <div style="font-size:9px;color:#94A3B8">${s.label}</div>
    </div>`).join('');

  const mesNom=new Intl.DateTimeFormat('es-MX',{month:'long'}).format(hoy);
  const fechaGen=hoy.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});

  setContent(`<div style="padding:20px 24px;max-width:1200px">

    <!-- HEADER -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.3px">Resumen de Movimientos</div>
        <div style="font-size:12px;color:#64748B;margin-top:2px">${fechaGen} · ${flS.length} solicitudes totales · ${activos.length} vehículos activos</div>
      </div>
      <button onclick="flExportarResumenPDF()" style="display:flex;align-items:center;gap:8px;padding:10px 20px;background:#0A1628;color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:12.5px;font-weight:800;cursor:pointer;letter-spacing:.3px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        Exportar PDF Ejecutivo
      </button>
    </div>

    <!-- KPIs PRINCIPALES -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px">
      ${kpi(solsTotal,'Solicitudes totales','Histórico acumulado','#2563EB','#EFF6FF')}
      ${kpi(solsMes.length,'Este mes','Solicitudes de '+mesNom,'#7C3AED','#F5F3FF')}
      ${kpi(cerradasMes,'Cerradas (mes)','Expedientes completos','#15803D','#F0FDF4')}
      ${kpi(enTallerV,'En taller','Vehículos en taller ahora','#B45309','#FFFBEB')}
      ${kpi(rechazadasMes,'Rechazadas (mes)','Esta quincena','#B91C1C','#FEF2F2')}
      ${kpi(activos.length,'Flota activa','Unidades operativas','#0369A1','#EFF8FF')}
      ${kpi(sinResp,'Sin responsable','Requieren asignación',sinResp?'#B91C1C':'#15803D',sinResp?'#FEF2F2':'#F0FDF4')}
      ${kpi(polVencidas+polPorVencer,'Pólizas','Vencidas + por vencer',polVencidas?'#B91C1C':'#B45309',polVencidas?'#FEF2F2':'#FFFBEB')}
    </div>

    <!-- FILA: Tipos + Tendencia -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- SOLICITUDES POR TIPO -->
      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Solicitudes por tipo</div>
        ${topTipos.length?topTipos.map(([t,n])=>hBar(t,n,maxTipo,'#2563EB')).join(''):'<div style="color:#94A3B8;font-size:11px">Sin datos</div>'}
      </div>

      <!-- TENDENCIA SEMANAL -->
      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Tendencia — últimas 8 semanas</div>
        <div style="display:flex;gap:6px;align-items:flex-end;height:120px;margin-bottom:4px">
          ${vBar}
        </div>
      </div>
    </div>

    <!-- FILA: Por plaza + Vehículos frecuentes -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">

      <!-- POR PLAZA -->
      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Solicitudes por plaza</div>
        ${topPlazas.length?topPlazas.map(([p,n])=>hBar(p,n,maxPlaza,'#7C3AED')).join(''):'<div style="color:#94A3B8;font-size:11px">Sin datos</div>'}
      </div>

      <!-- VEHÍCULOS MÁS FRECUENTES -->
      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Vehículos con más solicitudes</div>
        ${topVehs.length?topVehs.map(([v,n],i)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #F8FAFD">
            <div style="width:22px;height:22px;border-radius:50%;background:${i<3?'#0A1628':'#F1F5F9'};color:${i<3?'#fff':'#475569'};font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</div>
            <div style="flex:1;font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v}</div>
            <div style="font-size:13px;font-weight:900;color:#2563EB">${n}</div>
          </div>`).join(''):'<div style="color:#94A3B8;font-size:11px">Sin datos</div>'}
      </div>
    </div>

    <!-- FILA: Estado de flota + Pipeline actual -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">

      <!-- ESTADO DE LA FLOTA -->
      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Estado de la flota</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            ['Activos operativos', activos.length-enTallerV, '#22C55E','#F0FDF4'],
            ['En taller', enTallerV, '#F59E0B','#FFFBEB'],
            ['Sin responsable', sinResp, sinResp?'#EF4444':'#22C55E', sinResp?'#FEF2F2':'#F0FDF4'],
            ['Pólizas vencidas', polVencidas, polVencidas?'#EF4444':'#22C55E', polVencidas?'#FEF2F2':'#F0FDF4'],
            ['Pólizas por vencer', polPorVencer, polPorVencer?'#F59E0B':'#22C55E', polPorVencer?'#FFFBEB':'#F0FDF4'],
          ].map(([l,v,cl,bg])=>`
            <div style="background:${bg};border-radius:9px;padding:12px 14px">
              <div style="font-size:20px;font-weight:900;color:${cl}">${v}</div>
              <div style="font-size:10px;font-weight:700;color:#475569;margin-top:2px">${l}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- PIPELINE ACTUAL -->
      <div style="background:#fff;border-radius:14px;padding:18px 20px;border:1px solid #E8EDF5">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:14px">Pipeline actual de solicitudes</div>
        ${[
          ['Solicitud',['Solicitud'],'#6D28D9','#EDE9FE'],
          ['Evaluación',['Evaluación','Validación','Cotización','Aprobación','Aprobada'],'#1D4ED8','#DBEAFE'],
          ['Servicio',['Servicio','Pagos','Cierre'],'#B45309','#FEF3C7'],
          ['Rechazada',['Rechazada'],'#B91C1C','#FEE2E2'],
          ['Cerrada',['Cerrada'],'#15803D','#DCFCE7'],
        ].map(([label,ests,cl,bg])=>{
          const n=flS.filter(s=>ests.includes(s.estatus)).length;
          const pct=flS.length?Math.round(n/flS.length*100):0;
          return`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F8FAFD">
            <div style="width:10px;height:10px;border-radius:50%;background:${cl};flex-shrink:0"></div>
            <div style="flex:1;font-size:12px;font-weight:700">${label}</div>
            <div style="font-size:11px;color:#64748B;width:36px;text-align:right">${pct}%</div>
            <div style="width:80px;height:6px;background:#F1F5F9;border-radius:100px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${cl};border-radius:100px"></div>
            </div>
            <div style="font-size:13px;font-weight:900;color:${cl};min-width:20px;text-align:right">${n}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`);
}
window.rResumen=rResumen;

// ── EXPORTAR RESUMEN PDF EJECUTIVO ──────────────────────────────
window.flExportarResumenPDF=function(){
  const hoy=new Date();
  const mesActual=hoy.getMonth();
  const anioActual=hoy.getFullYear();
  const enMes=(iso,m,a)=>{if(!iso)return false;const d=new Date(iso);return d.getMonth()===m&&d.getFullYear()===a;};
  const mesNom=new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(hoy);
  const fechaGen=hoy.toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});

  const solsMes=flS.filter(s=>enMes(s.creadoEn,mesActual,anioActual));
  const cerradasMes=solsMes.filter(s=>s.estatus==='Cerrada').length;
  const rechazadasMes=solsMes.filter(s=>s.estatus==='Rechazada').length;
  const enServicio=flS.filter(s=>['Servicio','Pagos','Cierre'].includes(s.estatus)).length;
  const activos=flV.filter(v=>v.status!=='baja');
  const enTallerV=flContarTaller(activos);
  const enTallerSol=0; // (deprecado) fuente única = status==='taller'
  const sinResp=activos.filter(v=>!v.responsable||v.responsable==='—').length;
  const polVencidas=activos.filter(v=>{const d=new Date(v.pv||'');return v.pv&&d<hoy;}).length;
  const polPorVencer=activos.filter(v=>{const d=new Date(v.pv||'');const dias=Math.round((d-hoy)/864e5);return v.pv&&dias>=0&&dias<=90;}).length;

  const porTipo={};flS.forEach(s=>{const t=s.tipo||'Otro';porTipo[t]=(porTipo[t]||0)+1;});
  const topTipos=Object.entries(porTipo).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const maxTipo=topTipos[0]?.[1]||1;

  const porPlaza={};
  flS.forEach(s=>{const v=flV.find(x=>String(x.eco)===String(s.vehiculoEco));const pl=v?.plaza||'Sin plaza';porPlaza[pl]=(porPlaza[pl]||0)+1;});
  const topPlazas=Object.entries(porPlaza).sort((a,b)=>b[1]-a[1]);
  const maxPlaza=topPlazas[0]?.[1]||1;

  const porVeh={};
  flS.forEach(s=>{const k=`ECO ${s.vehiculoEco||'?'} · ${s.vehiculo||'—'}`;porVeh[k]=(porVeh[k]||0)+1;});
  const topVehs=Object.entries(porVeh).sort((a,b)=>b[1]-a[1]).slice(0,10);

  const pipeline=[
    ['Solicitud',['Solicitud'],'#6D28D9'],
    ['Evaluación y Autorización',['Evaluación','Validación','Cotización','Aprobación','Aprobada'],'#1D4ED8'],
    ['Servicio en Proceso',['Servicio','Pagos','Cierre'],'#B45309'],
    ['Rechazada',['Rechazada'],'#B91C1C'],
    ['Cerrada',['Cerrada'],'#15803D'],
  ].map(([l,ests,cl])=>({l,n:flS.filter(s=>ests.includes(s.estatus)).length,cl}));

  const barW=480;
  const pdfBar=(label,val,max,cl)=>`
    <div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-bottom:3px">
        <span>${label}</span><span style="color:${cl}">${val}</span>
      </div>
      <div style="height:5px;background:#F1F5F9;border-radius:100px;overflow:hidden">
        <div style="height:100%;width:${Math.round(val/max*100)}%;background:${cl};border-radius:100px"></div>
      </div>
    </div>`;

  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
  <title>Resumen Flotilla — ${mesNom}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,Arial,sans-serif;font-size:10.5px;color:#0A0F1E;background:#fff;padding:28px 32px}
    .logo{font-size:18px;font-weight:900;letter-spacing:-1px}.logo em{color:#2563EB;font-style:normal}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A1628;padding-bottom:12px;margin-bottom:18px}
    .sec{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#64748B;margin:18px 0 10px;padding-top:14px;border-top:1px solid #E8EDF5}
    .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px}
    .kpi{border-radius:9px;padding:11px 13px}
    .kpi-val{font-size:24px;font-weight:900;line-height:1}
    .kpi-label{font-size:9px;font-weight:800;margin-top:3px}
    .kpi-sub{font-size:8px;color:#64748B;margin-top:1px}
    .two-col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:6px}
    .card{border:1px solid #E8EDF5;border-radius:10px;padding:14px 16px}
    .card-t{font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#64748B;margin-bottom:10px}
    .pip-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F1F5F9}
    .pip-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    .pip-bar-wrap{width:90px;height:5px;background:#F1F5F9;border-radius:100px;overflow:hidden}
    .pip-bar{height:100%;border-radius:100px}
    .veh-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #F8FAFD}
    .rank{width:18px;height:18px;border-radius:50%;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    table{width:100%;border-collapse:collapse;font-size:9.5px}
    th{background:#0A1628;color:#fff;padding:6px 8px;text-align:left;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
    td{padding:6px 8px;border-bottom:1px solid #F1F5F9}
    tr:nth-child(even) td{background:#F8FAFD}
    .badge{display:inline-block;padding:2px 8px;border-radius:100px;font-size:8px;font-weight:800}
    .footer{margin-top:22px;padding-top:10px;border-top:1px solid #E8EDF5;font-size:8px;color:#94A3B8;display:flex;justify-content:space-between}
    @media print{body{padding:14px 16px}button{display:none!important}}
  </style></head><body>

  <div class="hdr">
    <div>
      <div class="logo">TECNO<em>CONTROL</em><span style="font-size:9px;font-weight:600;color:#64748B;margin-left:10px">· Flotilla Vehicular</span></div>
      <div style="font-size:11px;color:#64748B;margin-top:3px">Informe Ejecutivo de Movimientos · ${mesNom}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:#64748B">Generado el ${fechaGen}</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:2px">Portal Flotilla Tecnocontrol</div>
      <div style="margin-top:6px"><span style="background:#0A1628;color:#fff;padding:3px 10px;border-radius:20px;font-size:9px;font-weight:700">${activos.length} vehículos activos</span></div>
    </div>
  </div>

  <!-- KPIs -->
  <div class="sec">Indicadores Clave</div>
  <div class="kpi-grid">
    <div class="kpi" style="background:#EFF6FF"><div class="kpi-val" style="color:#2563EB">${flS.length}</div><div class="kpi-label">Total solicitudes</div><div class="kpi-sub">Histórico acumulado</div></div>
    <div class="kpi" style="background:#F5F3FF"><div class="kpi-val" style="color:#7C3AED">${solsMes.length}</div><div class="kpi-label">Este mes</div><div class="kpi-sub">${mesNom}</div></div>
    <div class="kpi" style="background:#F0FDF4"><div class="kpi-val" style="color:#15803D">${cerradasMes}</div><div class="kpi-label">Cerradas (mes)</div><div class="kpi-sub">Expedientes completos</div></div>
    <div class="kpi" style="background:#FFFBEB"><div class="kpi-val" style="color:#B45309">${enTallerV}</div><div class="kpi-label">En taller</div><div class="kpi-sub">Vehículos en taller ahora</div></div>
    <div class="kpi" style="background:#FEF2F2"><div class="kpi-val" style="color:#B91C1C">${rechazadasMes}</div><div class="kpi-label">Rechazadas (mes)</div><div class="kpi-sub">Con motivo registrado</div></div>
    <div class="kpi" style="background:#EFF8FF"><div class="kpi-val" style="color:#0369A1">${activos.length}</div><div class="kpi-label">Flota activa</div><div class="kpi-sub">Unidades operativas</div></div>
    <div class="kpi" style="background:${sinResp?'#FEF2F2':'#F0FDF4'}"><div class="kpi-val" style="color:${sinResp?'#B91C1C':'#15803D'}">${sinResp}</div><div class="kpi-label">Sin responsable</div><div class="kpi-sub">Requieren asignación</div></div>
    <div class="kpi" style="background:${polVencidas?'#FEF2F2':'#FFFBEB'}"><div class="kpi-val" style="color:${polVencidas?'#B91C1C':'#B45309'}">${polVencidas}</div><div class="kpi-label">Pólizas vencidas</div><div class="kpi-sub">${polPorVencer} por vencer (&lt;90 días)</div></div>
  </div>

  <!-- TIPO + PIPELINE -->
  <div class="sec">Análisis por Categoría y Pipeline</div>
  <div class="two-col">
    <div class="card">
      <div class="card-t">Solicitudes por tipo</div>
      ${topTipos.map(([t,n])=>pdfBar(t,n,maxTipo,'#2563EB')).join('')}
    </div>
    <div class="card">
      <div class="card-t">Pipeline actual</div>
      ${pipeline.map(p=>`
        <div class="pip-row">
          <div class="pip-dot" style="background:${p.cl}"></div>
          <div style="flex:1;font-size:10px;font-weight:700">${p.l}</div>
          <div style="font-size:9px;color:#64748B;width:32px;text-align:right">${flS.length?Math.round(p.n/flS.length*100):0}%</div>
          <div class="pip-bar-wrap"><div class="pip-bar" style="width:${flS.length?Math.round(p.n/flS.length*100):0}%;background:${p.cl}"></div></div>
          <div style="font-size:13px;font-weight:900;color:${p.cl};min-width:18px;text-align:right">${p.n}</div>
        </div>`).join('')}
    </div>
  </div>

  <!-- PLAZA + FLOTA -->
  <div class="two-col">
    <div class="card">
      <div class="card-t">Solicitudes por plaza</div>
      ${topPlazas.map(([p,n])=>pdfBar(p,n,maxPlaza,'#7C3AED')).join('')}
    </div>
    <div class="card">
      <div class="card-t">Estado de la flota</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
        ${[
          ['Operativos',activos.length-enTallerV,'#22C55E','#F0FDF4'],
          ['En taller',enTallerV,'#F59E0B','#FFFBEB'],
          ['Sin responsable',sinResp,sinResp?'#EF4444':'#22C55E',sinResp?'#FEF2F2':'#F0FDF4'],
          ['Pól. vencidas',polVencidas,polVencidas?'#EF4444':'#22C55E',polVencidas?'#FEF2F2':'#F0FDF4'],
        ].map(([l,v,cl,bg])=>`<div style="background:${bg};border-radius:7px;padding:9px 11px"><div style="font-size:18px;font-weight:900;color:${cl}">${v}</div><div style="font-size:8.5px;font-weight:700;color:#475569;margin-top:1px">${l}</div></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- TABLA VEHÍCULOS FRECUENTES -->
  <div class="sec">Vehículos con Mayor Actividad de Mantenimiento</div>
  <table>
    <thead><tr><th>#</th><th>Vehículo</th><th>Solicitudes</th><th>% del total</th></tr></thead>
    <tbody>
      ${topVehs.map(([v,n],i)=>`<tr><td style="font-weight:800;color:${i<3?'#2563EB':'#475569'}">${i+1}</td><td>${v}</td><td style="font-weight:800;color:#2563EB">${n}</td><td>${flS.length?Math.round(n/flS.length*100):0}%</td></tr>`).join('')}
    </tbody>
  </table>

  <!-- SOLICITUDES ABIERTAS -->
  <div class="sec">Solicitudes Activas al Momento del Reporte</div>
  <table>
    <thead><tr><th>Tipo</th><th>ECO</th><th>Vehículo</th><th>Solicitante</th><th>Estatus</th><th>Fecha</th></tr></thead>
    <tbody>
      ${flS.filter(s=>!['Cerrada','Rechazada'].includes(s.estatus)).slice(0,20).map(s=>{
        const cl={'Solicitud':'#6D28D9','Evaluación':'#1D4ED8','Servicio':'#B45309','Pagos':'#B45309','Cierre':'#B45309'}[s.estatus]||'#475569';
        return`<tr><td>${s.tipo||'—'}</td><td style="font-family:monospace;font-weight:700">ECO ${s.vehiculoEco||'—'}</td><td>${(s.vehiculo||'—').split('·')[1]?.trim()||s.vehiculo||'—'}</td><td>${(s.solicitante||s.creadoPor||'—').split('@')[0]}</td><td><span class="badge" style="background:${cl}22;color:${cl}">${s.estatus}</span></td><td>${s.creadoEn?s.creadoEn.substring(0,10):'—'}</td></tr>`;
      }).join('')}
    </tbody>
  </table>

  <div class="footer">
    <span>Portal Flotilla Tecnocontrol · Informe generado automáticamente</span>
    <span>${fechaGen}</span>
  </div>

  <div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end">
    <button onclick="window.print()" style="padding:11px 28px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer">Imprimir / Guardar PDF</button>
  </div>
  </body></html>`;

  const win=window.open('','_blank','width=900,height=960');
  if(win){win.document.write(html);win.document.close();}
};

// ── BAJAS ──
function rBajas(){
  const bajas=flV.filter(v=>v.status==='baja');
  setContent(padded(`
    <div style="margin-bottom:14px"><div style="font-size:17px;font-weight:900;letter-spacing:-.4px">Vehículos Dados de Baja</div><div style="font-size:11px;color:#64748B;margin-top:2px">${bajas.length} unidades</div></div>
    ${!bajas.length?`<div class="fl-empty"><div class="fl-empty-ico">📦</div><h3>Sin vehículos de baja</h3></div>`:
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px">
      ${bajas.map(v=>`<div style="background:#fff;border:1px solid #E8EDF5;border-radius:11px;padding:12px 14px;display:flex;gap:10px;align-items:center;cursor:pointer;transition:border-color .15s" onmouseenter="this.style.borderColor='#FCA5A5'" onmouseleave="this.style.borderColor='#E8EDF5'" onclick="flVerVeh('${v.id}')">
        <div style="width:40px;height:40px;border-radius:9px;background:#FEE2E2;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${hEmo(v.tipo)}</div>
        <div style="flex:1;min-width:0"><div style="font-size:11.5px;font-weight:800;font-family:'JetBrains Mono',monospace">ECO ${v.eco}</div><div style="font-size:11.5px;font-weight:600;color:#374151">${v.unidad||'—'} ${v.año||''}</div><div style="font-size:10px;color:#94A3B8">${v.responsable||'—'}</div></div>
        <div style="text-align:right"><div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8">Baja</div><div style="font-size:10.5px;font-weight:600;color:#B91C1C;margin-top:1px">${hF(v.fechaBaja)||'—'}</div></div>
      </div>`).join('')}
    </div>`}
  `));
}


// ═══════════════════════════════════════════════════════
// ACCIONES COMUNES — actualiza Firestore y refresca vista
// ═══════════════════════════════════════════════════════
window.flEst = async (id, est, extra) => {
  try {
    await fs.updateDoc(fs.doc(db, C.SOLS, id), {
      estatus: est,
      actualizadoEn: new Date().toISOString(),
      ...(extra || {}),
    });
    await ldSols();
    if (vistaAct === 'sols') rSols(); else rPanel();
  } catch(e) { console.error('[FL]', e); }
};
window.flAprobar = id => flEst(id, 'Aprobada');
window.flRechazar = async id => {
  const m = prompt('Motivo del rechazo:');
  if (!m?.trim()) return;
  try {
    const s = flS.find(x => x.id === id);
    await fs.updateDoc(fs.doc(db, C.SOLS, id), {
      estatus: 'Rechazada', comentarioRechazo: m,
      actualizadoEn: new Date().toISOString(),
    });
    if (s?.vehiculoEco) flSyncVehiculoServicio(s.vehiculoEco, 'activo', id);
    await ldSols();
    if (vistaAct === 'sols') rSols(); else rPanel();
  } catch(e) { console.error('[FL]', e); }
};
window.flElim = async id => {
  if (!confirm('¿Eliminar solicitud permanentemente?')) return;
  try {
    await fs.deleteDoc(fs.doc(db, C.SOLS, id));
    await ldSols();
    if (vistaAct === 'sols') rSols(); else rPanel();
  } catch(e) { console.error('[FL]', e); }
};

// ═══════════════════════════════════════════════════════
// NOTIFICACIONES → flotilla_notificaciones (app móvil las lee)
// ═══════════════════════════════════════════════════════
window.flEnviarNotif = async function(id, tipo, comentario) {
  try {
    let s = flS.find(x => x.id === id);
    // Si no está en memoria o le falta creadoPor, leer de Firestore
    if (!s || !s.creadoPor) {
      const snap = await fs.getDoc(fs.doc(db, C.SOLS, id));
      if (snap.exists()) s = { id: snap.id, ...snap.data(), ...(s||{}) };
    }
    if (!s) return;
    const eco = s.vehiculoEco || '—';
    const por = window.auth?.currentUser?.displayName || window.auth?.currentUser?.email || '—';
    // Comentario explícito > último comentario guardado en la solicitud > vacío
    const comt = comentario
      || (s.comentariosServicio?.length  ? s.comentariosServicio[s.comentariosServicio.length-1]?.texto : null)
      || (s.comentariosEvaluacion?.length? s.comentariosEvaluacion[s.comentariosEvaluacion.length-1]?.texto : null)
      || null;
    const sufComt = comt ? ` · Comentario: "${comt}"` : '';
    const msgs = {
      validada:     `Tu solicitud pasó a Evaluación. (ECO ${eco}) · Taller: ${s.tallerNombre||'Por definir'}${s.montoCotizacion?' · $'+Number(s.montoCotizacion).toLocaleString('es-MX'):''}${sufComt}`,
      rechazada_val:`Tu solicitud fue rechazada. Motivo: ${comentario||s.comentarioRechazo||'Sin especificar'}. (ECO ${eco})`,
      aprobada:     `¡Solicitud autorizada y en servicio! (ECO ${eco}) · Taller: ${s.tallerNombre||'—'}${s.montoCotizacion?' · $'+Number(s.montoCotizacion).toLocaleString('es-MX'):''}${sufComt}`,
      rechazada_apr:`Tu solicitud fue devuelta a revisión. Contraloría indica: ${comentario||'Sin comentario'}. (ECO ${eco})`,
      pagos:        `Pago programado para tu servicio. (ECO ${eco})${sufComt}`,
      pagado:       `El pago de tu servicio fue procesado. (ECO ${eco})${sufComt}`,
      cerrada:      `Servicio finalizado. Expediente cerrado. (ECO ${eco})${sufComt}`,
      servicio:     `Tu solicitud entró a Servicio en proceso. (ECO ${eco})${sufComt}`,
      regreso_etapa:`Tu solicitud fue regresada a etapa anterior para revisión. (ECO ${eco})`,
    };
    const msg = msgs[tipo];
    if (!msg) return;
    await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      solicitudId: id,
      para: s.creadoPor || null,
      vehiculoEco: eco,
      tipo,
      mensaje: msg,
      leido: false,
      creadaEn: new Date().toISOString(),
    });
  } catch(e) { console.warn('[FL notif]', e); }
};

// ═══════════════════════════════════════════════════════
// HELPER — subir archivo → base64 con validación tamaño
// ═══════════════════════════════════════════════════════
// ── ARCHIVOS EN SUBCOLECCIÓN (sin límite 1MB) ───────────────────
async function flGuardarArchivosSubcol(solId, subcol, archivos) {
  // Borrar los anteriores
  const ref = fs.collection(fs.doc(db, C.SOLS, solId), subcol);
  const viejos = await fs.getDocs(ref);
  const batch = db.batch ? db.batch() : null;
  if(batch){
    viejos.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  } else {
    for(const d of viejos.docs) await fs.deleteDoc(d.ref);
  }
  // Guardar nuevos uno por uno (cada doc puede tener hasta 1MB)
  for(const a of archivos){
    await fs.addDoc(ref, {
      nombre: a.nombre||'Archivo',
      datos: a.datos,
      tipo: a.tipo||'img',
      kb: a.kb||0,
      creadoEn: new Date().toISOString(),
    });
  }
}

async function flCargarArchivosSubcol(solId, subcol) {
  try {
    const ref = fs.collection(fs.doc(db, C.SOLS, solId), subcol);
    const snap = await fs.getDocs(ref);
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
  } catch { return []; }
}

// ── Migración de evidencias a subcolección (performance) ──
// Los registros NUEVOS ya no guardan evidencias/chkFotos/danos en el
// documento principal — viven en flotilla_solicitudes/{id}/adjuntos/fotos.
// Esta función los trae bajo demanda y los mezcla en el objeto `s`. Los
// registros VIEJOS (que ya traen todo inline) se quedan exactamente igual,
// no se tocan ni se re-descargan de más.
const _flEvidCache={};
async function flCargarEvidenciasSol(s){
  if(s.evidencias!==undefined||s._sinAdjuntos)return s; // formato viejo, o ya resuelto
  if(_flEvidCache[s.id]){Object.assign(s,_flEvidCache[s.id]);return s;}
  try{
    const snap=await fs.getDoc(fs.doc(db,C.SOLS,s.id,'adjuntos','fotos'));
    if(snap.exists()){
      _flEvidCache[s.id]=snap.data();
      Object.assign(s,snap.data());
      return s;
    }
  }catch(e){console.warn('[FL] flCargarEvidenciasSol',e);}
  s._sinAdjuntos=true; // no había nada que traer — no reintentar cada vez
  return s;
}

async function flLeerArchivo(file, maxMB = 4) {
  if (file.size > maxMB * 1024 * 1024) throw new Error(`"${file.name}" supera ${maxMB} MB`);
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = e => res(e.target.result);
    fr.onerror = () => rej(new Error('Error al leer el archivo'));
    fr.readAsDataURL(file);
  });
}

// HELPER — renderizar lista de archivos adjuntos
function flHtmlArchivos(archivos, onElim) {
  if (!archivos?.length) return '';
  return archivos.map((a, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="${a.tipo==='pdf'?'#B91C1C':'#1D4ED8'}" stroke-width="2" stroke-linecap="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      <span style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.nombre||'Archivo '+(i+1)}</span>
      <span style="font-size:10px;color:#94A3B8">${a.kb||''}KB</span>
      ${onElim ? `<button onclick="${onElim}(${i})" style="border:none;background:none;cursor:pointer;color:#EF4444;font-size:14px;padding:0 2px;line-height:1">✕</button>` : ''}
    </div>`).join('');
}

// ═══════════════════════════════════════════════════════
// VISOR DE ARCHIVOS (PDF o imagen) — z-index máximo
// ═══════════════════════════════════════════════════════
window.flVerArchivo = function(b64, nombre) {
  if (!b64) return;
  const esPDF = b64.startsWith('data:application/pdf');
  const ov = document.createElement('div');
  ov.className = 'fl-ov'; ov.style.zIndex = '4000';
  ov.innerHTML = `<div class="fl-modal" style="max-width:${esPDF?'860':'660'}px;width:100%;${esPDF?'height:90vh;':''}display:flex;flex-direction:column;overflow:hidden">
    <div class="fl-mh" style="flex-shrink:0">
      <span style="font-size:13px;font-weight:700">${nombre||'Documento'}</span>
      <div style="display:flex;gap:8px">
        <a href="${b64}" download="${nombre||'archivo'}" style="font-size:11px;font-weight:700;padding:5px 12px;background:#EFF6FF;color:#2563EB;border-radius:7px;text-decoration:none">Descargar</a>
        <button onclick="this.closest('.fl-ov').remove()" style="width:28px;height:28px;border:none;background:#F1F5F9;border-radius:50%;cursor:pointer;font-size:15px;color:#64748B">✕</button>
      </div>
    </div>
    ${esPDF
      ? `<iframe src="${b64}" style="flex:1;border:none"></iframe>`
      : `<div style="padding:16px;text-align:center;overflow-y:auto"><img src="${b64}" style="max-width:100%;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15)"></div>`}
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
};

// ═══════════════════════════════════════════════════════
// CALENDARIO — flCalDia
// ═══════════════════════════════════════════════════════
window.flCalDia = function(fecha) {
  const evs = [];
  const agrega = (fechaStr, sol, tipo) => {
    if (!fechaStr || typeof fechaStr !== 'string') return;
    if (fechaStr.slice(0,10) === fecha) evs.push({ ...sol, _tipoCal: tipo || 'solicitud' });
  };
  flS.forEach(s => {
    agrega(s.creadoEn, s, 'solicitud');
    if (s.fechaPagoProgramada) agrega(s.fechaPagoProgramada, s, 'pago');
    if (s.fechaIngresoTaller)  agrega(s.fechaIngresoTaller, s, 'taller');
    if (s.validadoEn)          agrega(s.validadoEn, s, 'validación');
    if (s.pagadoEn)            agrega(s.pagadoEn, s, 'pago realizado');
  });
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const [y,m,d] = fecha.split('-');
  const fechaLeg = `${parseInt(d)} de ${meses[parseInt(m)-1]} de ${y}`;
  const tipoIcon = {
    solicitud:       `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6D28D9" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    pago:            `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
    taller:          `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
    'validación':    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    'pago realizado':`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  };
  const filas = evs.map(e => {
    const label = {solicitud:'Solicitud creada',pago:'Pago programado',taller:'Ingreso a taller','validación':'Validación','pago realizado':'Pago realizado'}[e._tipoCal]||e._tipoCal;
    return `<div onclick="flVerSol('${e.id}')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:#F8FAFC;border-radius:9px;border:1px solid #E2E8F0;cursor:pointer;transition:.12s" onmouseover="this.style.background='#EFF6FF'" onmouseout="this.style.background='#F8FAFC'">
      <div style="width:30px;height:30px;border-radius:8px;background:#fff;border:1px solid #E2E8F0;display:flex;align-items:center;justify-content:center;flex-shrink:0">${tipoIcon[e._tipoCal]||tipoIcon.solicitud}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="font-size:11px;font-weight:800">${label}</span>${hBadge(e.estatus)}</div>
        <div style="font-size:11px;color:#374151;font-weight:600">ECO ${e.vehiculoEco||'—'} · ${e.tipo||'—'}</div>
        <div style="font-size:10px;color:#94A3B8;margin-top:1px">${e.solicitante||e.creadoPor||'—'}${e.montoCotizacion?` · $${Number(e.montoCotizacion).toLocaleString('es-MX')}`:''}</div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" stroke-width="2" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
  const html = `
    <div class="fl-ov" id="flcal-ov" onclick="if(event.target===this)this.remove()" style="z-index:3200">
      <div class="fl-modal" style="max-width:480px;width:100%">
        <div class="fl-mh">
          <div><div style="font-size:15px;font-weight:900">${fechaLeg}</div><div style="font-size:11px;color:#64748B;margin-top:2px">${evs.length} actividad${evs.length!==1?'es':''}</div></div>
          <button onclick="document.getElementById('flcal-ov').remove()" style="width:30px;height:30px;border:none;border-radius:50%;background:#F1F5F9;cursor:pointer;font-size:16px;color:#64748B">✕</button>
        </div>
        <div class="fl-mb" style="display:flex;flex-direction:column;gap:8px;max-height:60vh;overflow-y:auto">
          ${filas || '<div style="text-align:center;padding:24px;color:#94A3B8;font-size:12px">Sin actividades</div>'}
        </div>
      </div>
    </div>`;
  document.getElementById('flcal-ov')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

// ═══════════════════════════════════════════════════════
// PIPELINE MODAL — Flujo completo 6 etapas
// Solicitud → Validación → Aprobación → Pagos → Cierre → Cerrada
// ═══════════════════════════════════════════════════════
// ── REGRESAR ETAPA en pipeline ──────────────────────────────────
window.flRegresarEtapa=async function(id,etapaDestino){
  const s=flS.find(x=>x.id===id);if(!s)return;
  const etapaActual=s.estatus;
  if(!confirm(`¿Regresar esta solicitud de "${etapaActual}" a "${etapaDestino}"?\n\nEsta acción quedará registrada.`))return;
  try{
    const motivo=prompt(`Motivo del retroceso (obligatorio):`)?.trim();
    if(!motivo)return;
    const upd={
      estatus:etapaDestino,
      actualizadoEn:new Date().toISOString(),
      actualizadoPor:window.auth?.currentUser?.email||'',
      [`historial_${Date.now()}`]:{de:etapaActual,a:etapaDestino,motivo,fecha:new Date().toISOString(),por:window.auth?.currentUser?.email||''},
    };
    await fs.updateDoc(fs.doc(db,C.SOLS,id),upd);
    Object.assign(s,{estatus:etapaDestino});
    flToast(`Solicitud regresada a ${etapaDestino}`,'ok');
    // Notificar al solicitante
    await flEnviarNotif(id,'regreso_etapa',s).catch(()=>{});
    window.flPipelineModal._render?.(etapaDestino);
  }catch(e){flToast('Error: '+e.message,'err');}
};

// ── SUBIR FACTURA en etapa Servicio ─────────────────────────────
window.flModalSubirFactura=function(id){
  const s=flS.find(x=>x.id===id);if(!s)return;
  const ov=document.createElement('div');ov.className='fl-ov';
  const facturas=s.facturas||[];
  ov.innerHTML=`<div class="fl-modal" style="max-width:460px">
    <div class="fl-mh">
      <h3>Subir factura — ECO ${s.vehiculoEco||'—'}</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb">
      ${facturas.length?`<div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;margin-bottom:8px">Facturas anteriores (${facturas.length})</div>
        ${facturas.map((f,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#F8FAFD;border-radius:8px;margin-bottom:5px;border:1px solid #E8EDF5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0369A1" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span style="flex:1;font-size:11.5px;font-weight:600">${f.nombre||'Factura '+(i+1)}</span>
          <span style="font-size:10px;color:#94A3B8">${f.fecha?f.fecha.substring(0,10):''}</span>
          <button onclick="flLightbox('${f.base64}')" style="padding:3px 8px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:6px;font-size:10px;font-weight:700;color:#1D4ED8;cursor:pointer">Ver</button>
        </div>`).join('')}
      </div>`:''}
      <div style="background:#F0F9FF;border:1.5px dashed #7DD3FC;border-radius:10px;padding:14px;text-align:center;margin-bottom:12px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0369A1" stroke-width="2" stroke-linecap="round" style="margin:0 auto 6px;display:block"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <div style="font-size:11.5px;font-weight:700;color:#0369A1;margin-bottom:4px">Seleccionar factura</div>
        <div style="font-size:10px;color:#64748B;margin-bottom:8px">PDF, imagen o XML · Máx 3 MB</div>
        <input type="file" id="fl-fact-file" accept=".pdf,.jpg,.jpeg,.png,.xml" style="display:none" onchange="flFacturaPreview(this)">
        <button onclick="document.getElementById('fl-fact-file').click()" style="padding:7px 18px;background:#0369A1;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:11.5px;font-weight:700;cursor:pointer">Elegir archivo</button>
      </div>
      <div id="fl-fact-preview" style="display:none;margin-bottom:12px;padding:10px;background:#F8FAFD;border-radius:8px;border:1px solid #E8EDF5">
        <div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:4px">Vista previa</div>
        <div id="fl-fact-nombre" style="font-size:12px;font-weight:600;color:#0A1628"></div>
        <div id="fl-fact-peso" style="font-size:10px;color:#94A3B8;margin-top:2px"></div>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('.fl-ov').remove()" class="fb gho">Cancelar</button>
        <button id="fl-fact-btn-save" onclick="flGuardarFactura('${id}')" style="flex:1;padding:9px;background:#0369A1;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;opacity:.5;pointer-events:none">Guardar factura</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};
window._facturaBase64=null;
window._facturaNombre=null;
window.flFacturaPreview=function(input){
  const file=input.files[0];if(!file)return;
  if(file.size>3*1024*1024){flToast('Archivo muy grande (máx 3 MB)','err');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    window._facturaBase64=e.target.result;
    window._facturaNombre=file.name;
    const prev=document.getElementById('fl-fact-preview');
    const nom=document.getElementById('fl-fact-nombre');
    const peso=document.getElementById('fl-fact-peso');
    const btn=document.getElementById('fl-fact-btn-save');
    if(prev)prev.style.display='';
    if(nom)nom.textContent=file.name;
    if(peso)peso.textContent=(file.size/1024).toFixed(0)+' KB · '+file.type;
    if(btn){btn.style.opacity='1';btn.style.pointerEvents='';}
  };
  reader.readAsDataURL(file);
};
window.flGuardarFactura=async function(id){
  if(!window._facturaBase64){flToast('Selecciona un archivo primero','err');return;}
  const btn=document.getElementById('fl-fact-btn-save');
  if(btn){btn.textContent='Guardando...';btn.style.opacity='.6';btn.style.pointerEvents='none';}
  try{
    const s=flS.find(x=>x.id===id);if(!s)return;
    const nuevaFactura={base64:window._facturaBase64,nombre:window._facturaNombre,fecha:new Date().toISOString(),subidaPor:window.auth?.currentUser?.email||''};
    const facturasActuales=s.facturas||[];
    const actualizadas=[...facturasActuales,nuevaFactura];
    await fs.updateDoc(fs.doc(db,C.SOLS,id),{facturas:actualizadas,actualizadoEn:new Date().toISOString()});
    s.facturas=actualizadas;
    window._facturaBase64=null;window._facturaNombre=null;
    document.querySelector('.fl-ov')?.remove();
    flToast('Factura guardada correctamente','ok');
    window.flPipelineModal._render?.('Servicio');
  }catch(e){
    flToast('Error: '+e.message,'err');
    if(btn){btn.textContent='Guardar factura';btn.style.opacity='1';btn.style.pointerEvents='';}
  }
};

window.flPipelineModal = function(estInicial) {
  // ── 4 etapas ──
  const PASOS = ['Solicitud','Evaluación','Servicio','Rechazada','Cerrada'];
  const PASOS_BARRA = ['Solicitud','Evaluación','Servicio','Cerrada'];
  // Normalizar estado legacy → nuevo para la barra activa
  const normEst = e => ({
    'Validación':'Evaluación','Validada':'Evaluación','Cotización':'Evaluación','Aprobación':'Evaluación','Aprobada':'Evaluación',
    'Pagos':'Servicio','Cierre':'Servicio'
  }[e]||e);
  let estActivo = normEst(estInicial || 'Solicitud');

  const colPaso = {
    Solicitud:   ['#EDE9FE','#6D28D9'],
    'Evaluación':['#DBEAFE','#1D4ED8'],
    Evaluación:  ['#DBEAFE','#1D4ED8'],
    Servicio:    ['#FEF3C7','#B45309'],
    Rechazada:   ['#FEE2E2','#B91C1C'],
    Cerrada:     ['#DCFCE7','#15803D'],
  };

  const eml = () => (window.auth?.currentUser?.email || '').toLowerCase();
  const hPerm = a => typeof window.flTienePermiso === 'function' ? window.flTienePermiso(a) : hAdm();
  const esFatima = () => eml() === 'fatima@tecnocontrol.com.mx' || hAdm();
  const esContraloria = () => ['p.pinedo@tecnocontrol.com.mx','c.acosta@tecnocontrol.com.mx'].includes(eml());
  const esPagos = () => eml() === 'pagos@tecnocontrol.com.mx' || hAdm();

  function accionesSol(s) {
    const btns = [];
    const est=s.estatus;
    // ── ETAPA 1: SOLICITUD ──
    if (est==='Solicitud' && esFatima()) {
      btns.push(`<button class="fb acc sm" onclick="flModalEvaluacion('${s.id}')" style="font-size:10px;background:#1D4ED8">Evaluar →</button>`);
      btns.push(`<button onclick="flModalRechazar('${s.id}','validacion')" style="font-size:10px;background:#EF4444;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700">Rechazar</button>`);
    }
    // ── ETAPA 2: EVALUACIÓN Y AUTORIZACIÓN ──
    if ((est==='Evaluación'||est==='Validación'||est==='Aprobación') && esFatima()) {
      btns.push(`<button onclick="flModalServicio('${s.id}')" style="font-size:10px;background:#B45309;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700">→ Servicio / Docs</button>`);
    }
    if ((est==='Evaluación'||est==='Validación'||est==='Aprobación') && esContraloria()) {
      btns.push(`<button onclick="flModalServicio('${s.id}')" style="font-size:10px;background:#B45309;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700">Autorizar →</button>`);
      btns.push(`<button onclick="flModalRechazar('${s.id}','aprobacion')" style="font-size:10px;background:#EF4444;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700">Rechazar</button>`);
    }
    // ── REGRESAR ETAPA (solo Fátima/admin) ──
    if (hAdm()&&esFatima()) {
      if (est==='Evaluación'||est==='Validación'||est==='Aprobación') {
        btns.push(`<button onclick="flRegresarEtapa('${s.id}','Solicitud')" style="font-size:9px;background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit;font-weight:700">← Solicitud</button>`);
      }
      if (est==='Servicio'||est==='Pagos'||est==='Cierre') {
        btns.push(`<button onclick="flRegresarEtapa('${s.id}','Evaluación')" style="font-size:9px;background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;border-radius:7px;padding:4px 9px;cursor:pointer;font-family:inherit;font-weight:700">← Evaluación</button>`);
      }
    }
    // ── ETAPA 3: SERVICIO EN PROCESO ──
    if ((est==='Servicio'||est==='Pagos'||est==='Cierre') && esFatima()) {
      btns.push(`<button onclick="flModalSubirFactura('${s.id}')" style="font-size:10px;background:#0369A1;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700;display:inline-flex;align-items:center;gap:4px"><svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round'><path d='M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4'/><polyline points='17 8 12 3 7 8'/><line x1='12' y1='3' x2='12' y2='15'/></svg>Factura</button>`);
      btns.push(`<button onclick="flModalProgramarPago('${s.id}')" style="font-size:10px;background:#7C3AED;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700;display:inline-flex;align-items:center;gap:4px"><svg width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round'><rect x='2' y='5' width='20' height='14' rx='2'/><line x1='2' y1='10' x2='22' y2='10'/></svg>${s.pagoProgramado?'Ver pago':'Pago'}</button>`);
      btns.push(`<button onclick="flModalCierre4('${s.id}')" style="font-size:10px;background:#15803D;color:#fff;border:none;border-radius:7px;padding:5px 10px;cursor:pointer;font-family:inherit;font-weight:700">→ Cerrar</button>`);
    }
    // Ver siempre
    btns.push(`<button class="fb gho sm" onclick="flVerSol('${s.id}')" style="font-size:10px">Ver</button>`);
    if (hPerm('eliminar'))
      btns.push(`<button class="fb gho sm" onclick="flElim('${s.id}').then(()=>window.flPipelineModal._render?.('${estActivo}'))" style="font-size:10px;color:#EF4444;border-color:#FCA5A5">Elim.</button>`);
    return btns.join('');
  }

  function renderModal() {
    // Agrupar estados legacy bajo los 4 nuevos
    const estGroup = {
      Evaluación: ['Evaluación','Validación','Validada','Cotización','Aprobación','Aprobada'],
      Servicio:   ['Servicio','Pagos','Cierre'],
    };
    const lista = flS.filter(s => {
      const group = estGroup[estActivo];
      return group ? group.includes(s.estatus) : s.estatus === estActivo;
    });
    const total = flS.length || 1;
    const notaPaso = {
      Solicitud:   'El técnico registra la falla desde la app o portal. Fátima valida y avanza a evaluación.',
      Evaluación:  'Flotilla y Contraloría revisan, cotizan proveedores y autorizan el presupuesto.',
      Servicio:    'El vehículo ingresa a taller. Se ejecuta el trabajo, se documentan evidencias y se gestiona el pago.',
      Rechazada:   'Solicitudes rechazadas con motivo registrado.',
      Cerrada:     'Expediente completo — factura, comprobante de pago y cierre administrativo.',
    }[estActivo] || '';

    // Step bar
    const stepBar = PASOS.map(p => {
      const n = flS.filter(s => s.estatus === p).length;
      const act = p === estActivo;
      const [bg, cl] = colPaso[p] || ['#F1F5F9','#475569'];
      return `<button onclick="window.flPipelineModal._render('${p}')"
        style="flex:1;padding:9px 3px 7px;border:none;border-bottom:3px solid ${act?cl:'transparent'};
        background:${act?bg+'55':'transparent'};font-family:inherit;font-size:10px;font-weight:800;
        color:${act?cl:'#94A3B8'};cursor:pointer;transition:.12s;text-align:center;line-height:1.4;
        border-radius:${act?'7px 7px 0 0':'0'}">
        ${p}<br><span style="font-size:16px;font-weight:900;color:${act?cl:'#CBD5E1'}">${n}</span>
      </button>`;
    }).join('');

    // Barra de progreso
    const barProg = PASOS_BARRA.map((p, i, arr) => {
      const n = flS.filter(s => s.estatus === p).length;
      const [,cl] = colPaso[p] || ['#F1F5F9','#475569'];
      const pct = Math.round(n / total * 100);
      return `<div style="flex:1;text-align:center">
        <div style="font-size:9px;font-weight:800;color:${cl};margin-bottom:3px">${pct}%</div>
        <div style="height:5px;background:#F1F5F9;border-radius:100px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cl};border-radius:100px;transition:width .4s"></div>
        </div>
        <div style="font-size:8px;color:#94A3B8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p}</div>
      </div>${i < arr.length-1 ? '<div style="flex-shrink:0;width:10px;color:#E2E8F0;font-size:14px;text-align:center;margin-top:-3px">›</div>' : ''}`;
    }).join('');

    // Tabla
    const filas = lista.length
      ? lista.map(s => {
          const fecha = s.creadoEn ? s.creadoEn.slice(0,10) : '—';
          const veh = flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId)||{};
          const plaza = veh.plaza||s.plaza||'—';
          const subEst = !['Solicitud','Evaluación','Servicio','Rechazada','Cerrada'].includes(s.estatus)?` <span style="font-size:9px;color:#94A3B8">(${s.estatus})</span>`:'';
          return `<tr onclick="flVerSol('${s.id}')" style="cursor:pointer" onmouseover="this.style.background='#F8FAFD'" onmouseout="this.style.background=''">
            <td style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748B">${(s.id||'').slice(-6).toUpperCase()}</td>
            <td style="font-size:11px">${fecha}</td>
            <td style="font-weight:700;font-family:'JetBrains Mono',monospace">ECO ${s.vehiculoEco||'—'}</td>
            <td style="font-size:10px;color:#64748B">${plaza}</td>
            <td style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.tipo||'—'}</td>
            <td style="font-size:11px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.solicitante||s.creadoPor||'—'}</td>
            <td style="font-size:11px">${s.tallerNombre||'—'}</td>
            <td style="font-size:11px;font-weight:700;color:#15803D">${s.montoCotizacion?'$'+Number(s.montoCotizacion).toLocaleString('es-MX'):'—'}</td>
            <td onclick="event.stopPropagation()"><div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap">${accionesSol(s)}</div></td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="8" style="text-align:center;padding:28px;color:#94A3B8;font-size:12px">Sin solicitudes en este estatus</td></tr>`;

    const html = `
      <div class="fl-ov" id="flpm-ov" onclick="if(event.target===this)this.remove()" style="z-index:3000">
        <div class="fl-modal" style="max-width:min(94vw,1000px);width:100%;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">
          <!-- HEADER -->
          <div class="fl-mh" style="flex-shrink:0">
            <div>
              <div style="font-size:16px;font-weight:900;letter-spacing:-.4px;display:flex;align-items:center;gap:8px">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Flujo de Solicitudes
              </div>
              <div style="font-size:11px;color:#64748B;margin-top:1px">${flS.length} total · ${lista.length} en "${estActivo}"</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:10px;font-weight:800;padding:3px 9px;background:#EFF6FF;color:#1D4ED8;border-radius:100px">
                ${window.flGetRolActual?window.flGetRolActual():'—'}
              </span>
              <button onclick="document.getElementById('flpm-ov').remove()" style="width:30px;height:30px;border:none;border-radius:50%;background:#F1F5F9;cursor:pointer;font-size:17px;color:#64748B">✕</button>
            </div>
          </div>
          <!-- BARRA PROGRESO -->
          <div style="padding:10px 20px 8px;border-bottom:1px solid #F1F5F9;display:flex;align-items:flex-start;flex-shrink:0;background:#FAFBFC">
            ${barProg}
          </div>
          <!-- STEP BAR -->
          <div style="display:flex;padding:0 14px;border-bottom:2px solid #F1F5F9;flex-shrink:0;gap:1px;background:#fff;overflow-x:auto">
            ${stepBar}
          </div>
          <!-- NOTA DEL PASO -->
          ${notaPaso ? `<div style="padding:7px 20px;background:#F8FAFC;border-bottom:1px solid #F1F5F9;font-size:10px;color:#64748B;flex-shrink:0">
            ℹ ${notaPaso}
          </div>` : ''}
          <!-- TABLA -->
          <div style="overflow-y:auto;flex:1;padding:0">
            <table class="fl-adm-table" style="width:100%">
              <thead><tr>
                <th>ID</th><th>Fecha</th><th>ECO</th><th>Plaza</th><th>Tipo</th><th>Solicitante</th>
                <th>Taller</th><th>Monto</th><th style="text-align:center">Acciones</th>
              </tr></thead>
              <tbody>${filas}</tbody>
            </table>
          </div>
        </div>
      </div>`;

    document.getElementById('flpm-ov')?.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  window.flPipelineModal._render = function(est) {
    estActivo = est;
    renderModal();
  };
  renderModal();
};

// ═══════════════════════════════════════════════════════
// MODAL RECHAZAR — genérico para validación y aprobación
// tipo: 'validacion' → Rechazada definitiva + notif solicitante
//       'aprobacion' → vuelve a Validación + notif Fátima
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// NUEVA ETAPA 2 — EVALUACIÓN Y AUTORIZACIÓN
// Agrupa: cotización, comparación de proveedores, aprobación
// ═══════════════════════════════════════════════════════════════
window.flModalEvaluacion = function(id) {
  const s = flS.find(x => x.id === id); if (!s) return;
  const v = flV.find(x => x.eco === s.vehiculoEco || x.id === s.vehiculoId) || {};
  document.getElementById('flpm-ov')?.remove();
  window._flEvalArchivos = (s.archivosEvaluacion||[]).filter(a=>a.datos); // metadatos sin datos
  // Cargar archivos completos de subcolección en background
  flCargarArchivosSubcol(s.id,'archivos_evaluacion').then(docs=>{
    if(docs.length){ window._flEvalArchivos=[...docs]; document.getElementById('eval-arch-list') && (document.getElementById('eval-arch-list').innerHTML=renderArchivosEval()); }
  });
  window._flEvalSolId    = s.id;
  window._flEvalComents  = s.comentariosEvaluacion ? [...s.comentariosEvaluacion] : [];

  function renderArchivosEval() {
    return window._flEvalArchivos.map((a,i)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${a.tipo==='pdf'?'#B91C1C':'#1D4ED8'}" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis">${a.nombre}</span>
        <button onclick="window._flEvalArchivos.splice(${i},1);document.getElementById('eval-arch-list').innerHTML=renderArchivosEvalHTML()" style="border:none;background:none;color:#EF4444;cursor:pointer;font-size:13px">✕</button>
      </div>`).join('');
  }
  window.renderArchivosEvalHTML = renderArchivosEval;
  window.evalSubirArch = async function() {
    const inp = document.createElement('input'); inp.type='file'; inp.multiple=true; inp.accept='image/*,.pdf';
    inp.onchange = async () => {
      for(const file of [...inp.files]) {
        try {
          const b64 = await flLeerArchivo(file,4);
          window._flEvalArchivos.push({nombre:file.name,datos:b64,tipo:file.type.includes('pdf')?'pdf':'img',kb:Math.round(file.size/1024)});
        } catch(e){alert(e.message);}
      }
      document.getElementById('eval-arch-list').innerHTML=renderArchivosEval();
    };
    inp.click();
  };
  window.evalAgregarComentario = async function(){
    const inp=document.getElementById('eval-comment-inp'); if(!inp||!inp.value.trim())return;
    const email=window.auth?.currentUser?.email||'—';
    const nuevoComt={texto:inp.value.trim(),por:email,en:new Date().toISOString()};
    window._flEvalComents.push(nuevoComt);
    inp.value='';
    document.getElementById('eval-comments-list').innerHTML=renderComents(window._flEvalComents);
    // Guardar en Firestore inmediatamente
    try{
      await fs.updateDoc(fs.doc(db,C.SOLS,s.id),{
        comentariosEvaluacion:window._flEvalComents,
        actualizadoEn:new Date().toISOString()
      });
      // Notificar al solicitante
      if(s.creadoPor){
        await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
          solicitudId:s.id,
          para:s.creadoPor,
          vehiculoEco:s.vehiculoEco||'—',
          tipo:'comentario',
          mensaje:`Nuevo comentario en tu solicitud ECO ${s.vehiculoEco||'—'}: "${nuevoComt.texto}"`,
          leido:false,
          creadaEn:new Date().toISOString(),
        });
      }
      flToast('Comentario guardado','ok');
    }catch(e){flToast('Error al guardar comentario','err');}
  };

  const html=`
    <div class="fl-ov" id="fleval-ov" onclick="if(event.target===this)this.remove()" style="z-index:3100">
      <div class="fl-modal" style="max-width:640px;width:100%;max-height:90vh;overflow-y:auto">
        <div class="fl-mh" style="position:sticky;top:0;background:#fff;z-index:2">
          <div>
            <div style="font-size:15px;font-weight:900">Evaluación y Autorización</div>
            <div style="font-size:11px;color:#64748B">ECO ${s.vehiculoEco||'—'} · ${v.unidad||''} · ${v.plaza||'—'}</div>
          </div>
          <button onclick="document.getElementById('fleval-ov').remove()" style="width:30px;height:30px;border:none;border-radius:50%;background:#F1F5F9;cursor:pointer;font-size:16px">✕</button>
        </div>
        <div class="fl-mb" style="display:flex;flex-direction:column;gap:14px">
          <!-- Info solicitud -->
          <div style="background:#F8FAFC;border-radius:10px;padding:12px 14px;font-size:11px">
            <strong>${s.tipo||'—'}</strong> · ${s.desc||'Sin descripción'}<br>
            <span style="color:#94A3B8">Prioridad: ${s.prior||'Normal'} · Solicitante: ${s.solicitante||s.creadoPor||'—'}</span>
          </div>
          <!-- Datos taller/cotización -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Taller / Proveedor</label>
              <input id="ev-taller" value="${s.tallerNombre||''}" placeholder="Nombre del taller" style="width:100%"></div>
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Monto cotizado</label>
              <input id="ev-monto" type="number" value="${s.montoCotizacion||''}" placeholder="0.00" style="width:100%"></div>
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha ingreso taller</label>
              <input id="ev-fecha-ingreso" type="date" value="${s.fechaIngresoTaller||''}" style="width:100%"></div>
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha entrega estimada</label>
              <input id="ev-fecha-salida" type="date" value="${s.fechaEntregaEstimada||''}" style="width:100%"></div>
          </div>
          <!-- Documentos: cotizaciones, fotos, PDFs -->
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:6px">📎 Documentos (cotizaciones, órdenes, evidencias)</div>
            <div id="eval-arch-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${renderArchivosEval()}</div>
            <button onclick="evalSubirArch()" style="width:100%;padding:10px;border:2px dashed #CBD5E1;border-radius:10px;background:#FAFBFC;font-size:12px;font-weight:700;color:#64748B;cursor:pointer">
              + Subir cotización / PDF / imagen
            </button>
          </div>
          <!-- Comentarios -->
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:6px">💬 Comentarios de evaluación</div>
            <div id="eval-comments-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${renderComents(window._flEvalComents)}</div>
            <div style="display:flex;gap:8px">
              <input id="eval-comment-inp" placeholder="Agregar comentario de revisión o VoBo…" style="flex:1">
              <button onclick="evalAgregarComentario()" style="padding:7px 14px;background:#1E3A5F;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Agregar</button>
            </div>
          </div>
          <div id="eval-err" style="color:#B91C1C;font-size:11px;display:none"></div>
          <div class="fl-fa">
            <button class="fb gho" onclick="document.getElementById('fleval-ov').remove()">Cancelar</button>
            <button id="eval-btn" onclick="flGuardarEvaluacion('${s.id}')" style="background:#1D4ED8;color:#fff;border:none;border-radius:9px;padding:9px 20px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit">
              Guardar y enviar a Servicio →
            </button>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('fleval-ov')?.remove();
  document.body.insertAdjacentHTML('beforeend',html);
};

window.flGuardarEvaluacion = async function(id) {
  const btn=document.getElementById('eval-btn');
  const err=document.getElementById('eval-err');
  const taller=document.getElementById('ev-taller')?.value?.trim();
  const monto=document.getElementById('ev-monto')?.value;
  if(!taller){err.textContent='El taller es obligatorio.';err.style.display='block';return;}
  btn.textContent='Guardando…';btn.disabled=true;err.style.display='none';
  try{
    await fs.updateDoc(fs.doc(db,C.SOLS,id),{
      estatus:'Evaluación',
      tallerNombre:taller,
      montoCotizacion:monto?Number(monto):null,
      fechaIngresoTaller:document.getElementById('ev-fecha-ingreso')?.value||null,
      fechaEntregaEstimada:document.getElementById('ev-fecha-salida')?.value||null,
      archivosEvaluacion: (window._flEvalArchivos||[]).map(a=>({nombre:a.nombre,tipo:a.tipo,kb:a.kb})), // solo metadatos
      comentariosEvaluacion:window._flEvalComents||[],
      evaluadoEn:new Date().toISOString(),
      evaluadoPor:window.auth?.currentUser?.email||'—',
      actualizadoEn:new Date().toISOString(),
    });
    // Guardar archivos completos en subcolección
    if((window._flEvalArchivos||[]).length){
      await flGuardarArchivosSubcol(id,'archivos_evaluacion',window._flEvalArchivos);
    }
    await ldSols();
    const ultComt2=(window._flEvalComents||[]).slice(-1)[0]?.texto||null;
    flEnviarNotif(id,'validada',ultComt2);
    // Verificar límite de presupuesto si hay monto capturado
    if(monto&&Number(monto)>0)flCheckLimitePresupuesto(id,Number(monto));
    document.getElementById('fleval-ov')?.remove();
    window.flPipelineModal('Evaluación');
  }catch(e){err.textContent='Error: '+e.message;err.style.display='block';btn.textContent='Guardar y enviar a Servicio →';btn.disabled=false;}
};

// ═══════════════════════════════════════════════════════════════
// NUEVA ETAPA 3 — SERVICIO EN PROCESO
// Agrupa: ingreso a taller, trabajo, pago, factura
// ═══════════════════════════════════════════════════════════════
window.flModalServicio = function(id) {
  const s = flS.find(x => x.id === id); if (!s) return;
  const v = flV.find(x => x.eco === s.vehiculoEco || x.id === s.vehiculoId) || {};
  document.getElementById('fleval-ov')?.remove();
  document.getElementById('flpm-ov')?.remove();
  window._flServArchivos = (s.archivosServicio||[]).filter(a=>a.datos);
  // Cargar archivos completos de subcolección en background
  flCargarArchivosSubcol(s.id,'archivos_servicio').then(docs=>{
    if(docs.length){ window._flServArchivos=[...docs]; document.getElementById('serv-arch-list') && (document.getElementById('serv-arch-list').innerHTML=renderArchivosServ()); }
  });
  window._flServComents  = s.comentariosServicio ? [...s.comentariosServicio] : [];

  function renderArchivosServ() {
    return window._flServArchivos.map((a,i)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:#F8FAFC;border-radius:8px;border:1px solid #E2E8F0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${a.tipo==='pdf'?'#B91C1C':'#1D4ED8'}" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis">${a.nombre}</span>
        <button onclick="window._flServArchivos.splice(${i},1);document.getElementById('serv-arch-list').innerHTML=renderArchivosServHTML()" style="border:none;background:none;color:#EF4444;cursor:pointer;font-size:13px">✕</button>
      </div>`).join('');
  }
  window.renderArchivosServHTML = renderArchivosServ;
  window.servSubirArch = async function() {
    const inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.accept='image/*,.pdf';
    inp.onchange=async()=>{
      for(const file of [...inp.files]){
        try{const b64=await flLeerArchivo(file,4);window._flServArchivos.push({nombre:file.name,datos:b64,tipo:file.type.includes('pdf')?'pdf':'img',kb:Math.round(file.size/1024)});}
        catch(e){alert(e.message);}
      }
      document.getElementById('serv-arch-list').innerHTML=renderArchivosServ();
    };
    inp.click();
  };
  window.servAgregarComentario=function(){
    const inp=document.getElementById('serv-comment-inp');if(!inp||!inp.value.trim())return;
    window._flServComents.push({texto:inp.value.trim(),por:window.auth?.currentUser?.email||'—',en:new Date().toISOString()});
    inp.value='';
    document.getElementById('serv-comments-list').innerHTML=renderComents(window._flServComents);
  };

  const pagoProgr=s.pagoProgramado||null;
  const pagoHtml=pagoProgr?`
    <div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:10px;padding:12px 14px;display:flex;align-items:center;gap:10px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#15803D" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
      <div style="flex:1">
        <div style="font-size:11px;font-weight:800;color:#15803D">Pago programado</div>
        <div style="font-size:11px;color:#166534">${pagoProgr.proveedor||'—'} · $${Number(pagoProgr.monto||0).toLocaleString('es-MX')} · ${pagoProgr.fechaEsperada||'—'}</div>
        <div style="font-size:10px;color:#4ADE80;margin-top:1px">Ref: ${pagoProgr.referencia||'—'} · Notificado a Pagos el ${(pagoProgr.notificadoEn||'').substring(0,10)||'—'}</div>
      </div>
      <button onclick="flModalProgramarPago('${s.id}')" style="padding:5px 10px;background:#15803D;color:#fff;border:none;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit">Editar</button>
    </div>`:`
    <div style="background:#F8FAFD;border:1.5px dashed #CBD5E1;border-radius:10px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <div style="font-size:11.5px;font-weight:700;color:#475569">Sin pago programado</div>
        <div style="font-size:10px;color:#94A3B8;margin-top:2px">Programa el pago para notificar al departamento de Pagos automáticamente</div>
      </div>
      <button onclick="flModalProgramarPago('${s.id}')" style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:#7C3AED;color:#fff;border:none;border-radius:9px;font-size:11.5px;font-weight:700;cursor:pointer;font-family:inherit">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        Programar pago
      </button>
    </div>`;

  const html=`
    <div class="fl-ov" id="flserv-ov" onclick="if(event.target===this)this.remove()" style="z-index:3100">
      <div class="fl-modal" style="max-width:640px;width:100%;max-height:90vh;overflow-y:auto">
        <div class="fl-mh" style="position:sticky;top:0;background:#fff;z-index:2">
          <div>
            <div style="font-size:15px;font-weight:900">Servicio en Proceso</div>
            <div style="font-size:11px;color:#64748B">ECO ${s.vehiculoEco||'—'} · ${v.unidad||''} · ${v.plaza||'—'} · Taller: ${s.tallerNombre||'—'}</div>
          </div>
          <button onclick="document.getElementById('flserv-ov').remove()" style="width:30px;height:30px;border:none;border-radius:50%;background:#F1F5F9;cursor:pointer;font-size:16px">✕</button>
        </div>
        <div class="fl-mb" style="display:flex;flex-direction:column;gap:14px">

          <!-- PAGO PROGRAMADO -->
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:8px">Pago al proveedor</div>
            ${pagoHtml}
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Comprobante de pago / Factura</label>
              <input id="serv-factura-num" value="${s.facturaNum||''}" placeholder="Número de factura" style="width:100%"></div>
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Monto pagado</label>
              <input id="serv-monto-pago" type="number" value="${s.montoPagado||s.montoCotizacion||''}" placeholder="0.00" style="width:100%"></div>
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha de pago</label>
              <input id="serv-fecha-pago" type="date" value="${s.fechaPago||''}" style="width:100%"></div>
            <div><label style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;display:block;margin-bottom:4px">Fecha entrega real</label>
              <input id="serv-fecha-entrega" type="date" value="${s.fechaEntregaReal||''}" style="width:100%"></div>
          </div>
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:6px">Evidencias y documentos del servicio</div>
            <div style="font-size:10px;color:#64748B;margin-bottom:8px">Sube: orden de trabajo, evidencias antes/después, facturas, garantías, comprobante de pago</div>
            <div id="serv-arch-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${renderArchivosServ()}</div>
            <button onclick="servSubirArch()" style="width:100%;padding:10px;border:2px dashed #CBD5E1;border-radius:10px;background:#FAFBFC;font-size:12px;font-weight:700;color:#64748B;cursor:pointer">
              + Subir factura / comprobante / evidencia / garantía
            </button>
          </div>
          <div>
            <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94A3B8;margin-bottom:6px">Comentarios del servicio</div>
            <div id="serv-comments-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">${renderComents(window._flServComents)}</div>
            <div style="display:flex;gap:8px">
              <input id="serv-comment-inp" placeholder="Notas del taller, validación de trabajos, garantías…" style="flex:1">
              <button onclick="servAgregarComentario()" style="padding:7px 14px;background:#1E3A5F;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">Agregar</button>
            </div>
          </div>
          <div id="serv-err" style="color:#B91C1C;font-size:11px;display:none"></div>
          <div class="fl-fa">
            <button class="fb gho" onclick="document.getElementById('flserv-ov').remove()">Cancelar</button>
            <button id="serv-btn-save" onclick="flGuardarServicio('${s.id}',false)" style="background:#B45309;color:#fff;border:none;border-radius:9px;padding:9px 20px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit;margin-right:6px">
              Guardar avance
            </button>
            <button id="serv-btn-cerrar" onclick="flGuardarServicio('${s.id}',true)" style="background:#15803D;color:#fff;border:none;border-radius:9px;padding:9px 20px;font-weight:800;font-size:12px;cursor:pointer;font-family:inherit">
              Cerrar expediente
            </button>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('flserv-ov')?.remove();
  document.body.insertAdjacentHTML('beforeend',html);
};

// ── MODAL PROGRAMAR PAGO ────────────────────────────────────────
window.flModalProgramarPago=function(id){
  const s=flS.find(x=>x.id===id);if(!s)return;
  const p=s.pagoProgramado||{};
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3200';
  ov.innerHTML=`<div class="fl-modal" style="max-width:440px">
    <div class="fl-mh">
      <div>
        <div style="font-size:15px;font-weight:900">Programar pago</div>
        <div style="font-size:11px;color:#64748B">ECO ${s.vehiculoEco||'—'} · ${s.tipo||'—'}</div>
      </div>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:12px">
      <div style="background:#F5F3FF;border-radius:9px;padding:10px 13px;font-size:11px;color:#5B21B6">
        Al programar el pago, se notificará automáticamente al departamento de Pagos con todos los detalles de la solicitud.
      </div>
      <div><label style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748B;display:block;margin-bottom:4px">Proveedor / Taller</label>
        <input id="pago-proveedor" value="${p.proveedor||s.tallerNombre||''}" placeholder="Nombre del taller o proveedor" style="width:100%"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><label style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748B;display:block;margin-bottom:4px">Monto a pagar</label>
          <input id="pago-monto" type="number" value="${p.monto||s.montoCotizacion||''}" placeholder="0.00" style="width:100%"></div>
        <div><label style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748B;display:block;margin-bottom:4px">Fecha esperada</label>
          <input id="pago-fecha" type="date" value="${p.fechaEsperada||''}" style="width:100%"></div>
      </div>
      <div><label style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748B;display:block;margin-bottom:4px">Forma de pago</label>
        <select id="pago-forma" style="width:100%;padding:8px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;background:#fff;outline:none">
          <option value="transferencia" ${p.forma==='transferencia'?'selected':''}>Transferencia bancaria</option>
          <option value="cheque" ${p.forma==='cheque'?'selected':''}>Cheque</option>
          <option value="efectivo" ${p.forma==='efectivo'?'selected':''}>Efectivo</option>
          <option value="tarjeta" ${p.forma==='tarjeta'?'selected':''}>Tarjeta</option>
        </select>
      </div>
      <div><label style="font-size:10px;font-weight:800;text-transform:uppercase;color:#64748B;display:block;margin-bottom:4px">Notas para Pagos</label>
        <textarea id="pago-notas" placeholder="Instrucciones especiales, datos bancarios, referencia interna…" rows="2" style="width:100%;padding:9px 12px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12.5px;outline:none;resize:none;box-sizing:border-box">${p.notas||''}</textarea>
      </div>
      <div id="pago-msg" style="display:none;font-size:11px;padding:8px 12px;border-radius:8px"></div>
      <div style="display:flex;gap:8px">
        <button onclick="this.closest('.fl-ov').remove()" class="fb gho">Cancelar</button>
        <button onclick="flGuardarPago('${id}')" style="flex:1;padding:10px;background:#7C3AED;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Programar y notificar a Pagos
        </button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
};

window.flGuardarPago=async function(id){
  const s=flS.find(x=>x.id===id);if(!s)return;
  const proveedor=document.getElementById('pago-proveedor')?.value?.trim();
  const monto=Number(document.getElementById('pago-monto')?.value)||0;
  const fechaEsperada=document.getElementById('pago-fecha')?.value||'';
  const forma=document.getElementById('pago-forma')?.value||'transferencia';
  const notas=document.getElementById('pago-notas')?.value?.trim()||'';
  const msg=document.getElementById('pago-msg');
  if(!proveedor){flToast('El proveedor es obligatorio','err');return;}
  if(!monto){flToast('El monto es obligatorio','err');return;}
  if(!fechaEsperada){flToast('La fecha esperada es obligatoria','err');return;}
  if(msg){msg.style.display='';msg.style.background='#EFF6FF';msg.style.color='#1D4ED8';msg.textContent='Guardando y notificando…';}
  const referencia='FL-'+s.vehiculoEco+'-'+Date.now().toString().slice(-6);
  const fmt=n=>n.toLocaleString('es-MX',{style:'currency',currency:'MXN',minimumFractionDigits:0});
  const pagoProgramado={
    proveedor,monto,fechaEsperada,forma,notas,referencia,
    solicitudId:id,vehiculoEco:s.vehiculoEco,tipo:s.tipo||'—',
    notificadoEn:new Date().toISOString(),
    programadoPor:window.auth?.currentUser?.email||'',
  };
  try{
    // Guardar en la solicitud
    await fs.updateDoc(fs.doc(db,C.SOLS,id),{
      pagoProgramado,estatus:'Servicio',actualizadoEn:new Date().toISOString(),
    });
    const solAct=flS.find(x=>x.id===id);
    if(solAct)solAct.pagoProgramado=pagoProgramado;
    if(s?.vehiculoEco)flSyncVehiculoServicio(s.vehiculoEco,'taller',id);
    // Notificación a Pagos
    await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      tipo:'pago_programado',solicitudId:id,
      para:'pagos@tecnocontrol.com.mx',
      vehiculoEco:s.vehiculoEco,
      referencia,
      mensaje:`PAGO FLOTILLA — Ref: ${referencia}\nVehículo: ECO ${s.vehiculoEco||'—'} · ${s.vehiculo||s.tipo||'—'}\nProveedor: ${proveedor}\nMonto: ${fmt(monto)}\nFecha esperada: ${fechaEsperada}\nForma: ${forma}\n${notas?'Notas: '+notas:''}`,
      monto,proveedor,fechaEsperada,forma,notas,
      leido:false,creadaEn:new Date().toISOString(),
      prioridad:'normal',
    });
    // Notificación al solicitante
    await flEnviarNotif(id,'pagos',notas);
    if(msg){msg.style.background='#F0FDF4';msg.style.color='#15803D';msg.textContent=`Pago programado · Ref: ${referencia} · Pagos notificado`;}
    setTimeout(()=>{
      document.querySelector('.fl-ov[style*="3200"]')?.remove();
      document.getElementById('flserv-ov')?.remove();
      window.flPipelineModal('Servicio');
    },1000);
    flToast(`Pagos notificado · ${referencia}`,'ok');
  }catch(e){
    if(msg){msg.style.background='#FEF2F2';msg.style.color='#B91C1C';msg.textContent='Error: '+e.message;}
  }
};

window.flGuardarServicio = async function(id, cerrar) {
  const err=document.getElementById('serv-err');
  const btnS=document.getElementById('serv-btn-save');
  const btnC=document.getElementById('serv-btn-cerrar');
  if(btnS)btnS.disabled=true;if(btnC)btnC.disabled=true;
  err.style.display='none';
  try{
    const data={
      archivosServicio: (window._flServArchivos||[]).map(a=>({nombre:a.nombre,tipo:a.tipo,kb:a.kb})), // solo metadatos
      comentariosServicio:window._flServComents||[],
      facturaNum:document.getElementById('serv-factura-num')?.value?.trim()||null,
      montoPagado:document.getElementById('serv-monto-pago')?.value?Number(document.getElementById('serv-monto-pago').value):null,
      fechaPago:document.getElementById('serv-fecha-pago')?.value||null,
      fechaEntregaReal:document.getElementById('serv-fecha-entrega')?.value||null,
      actualizadoEn:new Date().toISOString(),
    };
    if(cerrar){
      data.estatus='Cerrada';
      data.cerradoEn=new Date().toISOString();
      data.cerradoPor=window.auth?.currentUser?.email||'—';
    } else {
      data.estatus='Servicio';
    }
    await fs.updateDoc(fs.doc(db,C.SOLS,id),data);
    const solActual=flS.find(x=>x.id===id);
    if(solActual?.vehiculoEco)flSyncVehiculoServicio(solActual.vehiculoEco,cerrar?'activo':'taller',id);
    await ldSols();
    const ultComt3=(window._flServComents||[]).slice(-1)[0]?.texto||null;
    // Guardar archivos de servicio en subcolección
    if((window._flServArchivos||[]).length){
      await flGuardarArchivosSubcol(id,'archivos_servicio',window._flServArchivos);
    }
    if(cerrar)flEnviarNotif(id,'cerrada',ultComt3);
    else flEnviarNotif(id,'servicio',ultComt3);
    document.getElementById('flserv-ov')?.remove();
    window.flPipelineModal(cerrar?'Cerrada':'Servicio');
  }catch(e){
    err.textContent='Error: '+e.message;err.style.display='block';
    if(btnS)btnS.disabled=false;if(btnC)btnC.disabled=false;
  }
};

// ═══════════════════════════════════════════════════════════════
// Alias: flModalCierre4 → flModalServicio (acceso directo a cierre)
// ═══════════════════════════════════════════════════════════════
window.flModalCierre4 = function(id){ window.flModalServicio(id); };

// Helper: renderizar comentarios
function renderComents(coments){
  if(!coments?.length) return '<div style="font-size:11px;color:#94A3B8;text-align:center;padding:8px">Sin comentarios aún</div>';
  return coments.map(c=>`
    <div style="background:#F8FAFC;border-radius:8px;padding:9px 12px;border-left:3px solid #2563EB">
      <div style="font-size:10.5px;color:#374151">${c.texto}</div>
      <div style="font-size:9px;color:#94A3B8;margin-top:3px">${c.por||'—'} · ${c.en?new Date(c.en).toLocaleString('es-MX',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—'}</div>
    </div>`).join('');
}

window.flModalRechazar = function(id, tipo) {
  const s = flS.find(x => x.id === id);
  if (!s) return;
  const esDevol = tipo === 'aprobacion';
  const titulo = esDevol ? 'Devolver a Validación' : 'Rechazar solicitud';
  const desc = esDevol
    ? 'La solicitud regresará a Fátima (Flotilla) con tu comentario para que la corrija o la descarte.'
    : 'La solicitud quedará rechazada y se notificará al solicitante con el motivo.';
  const colorBtn = esDevol ? '#B45309' : '#B91C1C';
  const textoBtn = esDevol ? 'Devolver a Validación' : 'Confirmar rechazo';

  const ov = document.createElement('div');
  ov.className = 'fl-ov'; ov.style.zIndex = '3200';
  ov.innerHTML = `<div class="fl-modal" style="max-width:420px">
    <div class="fl-mh">
      <div><div style="font-size:15px;font-weight:900">${titulo}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px">ECO ${s.vehiculoEco||'—'} · ${s.tipo||'—'}</div></div>
      <button onclick="this.closest('.fl-ov').remove()" style="width:28px;height:28px;border:none;border-radius:50%;background:#F1F5F9;cursor:pointer;font-size:15px;color:#64748B">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:12px">
      <div style="padding:10px 12px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:9px;font-size:11px;color:#92400E">${desc}</div>
      <div>
        <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:5px">Comentario (obligatorio)</label>
        <textarea id="fl-rej-txt" rows="4" placeholder="Describe el motivo detalladamente…"
          style="width:100%;border:1.5px solid #E2E8F0;border-radius:9px;padding:9px 12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;box-sizing:border-box"
          oninput="this.style.borderColor=this.value.trim()?'#${esDevol?'B45309':'EF4444'}':'#E2E8F0'"></textarea>
      </div>
      <div class="fl-fa" style="margin-top:0">
        <button onclick="this.closest('.fl-ov').remove()" class="fb gho" style="padding:9px 18px">Cancelar</button>
        <button id="fl-rej-btn" onclick="window.flConfirmarRechazo('${id}',${esDevol},this)"
        style="padding:9px 18px;background:${colorBtn};color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer">
          ${textoBtn}
        </button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
};

// Confirmar rechazo / devolución — corre en scope del IIFE (acceso a fs, db, C, ldSols, vistaAct, rSols, rPanel)
window.flConfirmarRechazo = async function(id, esDevol, btn) {
  const txt = document.getElementById('fl-rej-txt');
  const m = txt ? txt.value.trim() : '';
  if (!m) { if (txt) txt.style.borderColor = '#EF4444'; return; }
  const textoBtn = esDevol ? 'Devolver a Validación' : 'Confirmar rechazo';
  btn.textContent = 'Guardando…'; btn.disabled = true;
  const nuevoEst = esDevol ? 'Validación' : 'Rechazada';
  const campo    = esDevol ? 'comentarioDevolucion' : 'comentarioRechazo';
  try {
    await fs.updateDoc(fs.doc(db, C.SOLS, id), {
      estatus: nuevoEst,
      [campo]: m,
      [esDevol ? 'devueltoEn' : 'rechazadoEn']: new Date().toISOString(),
      actualizadoEn: new Date().toISOString()
    });
    await ldSols();
    await flEnviarNotif(id, esDevol ? 'rechazada_apr' : 'rechazada_val', m);
    if (vistaAct === 'sols') rSols(); else rPanel();
    window.flPipelineModal?._render?.(nuevoEst);
    btn.closest('.fl-ov')?.remove();
    document.getElementById('flpm-ov')?.remove();
  } catch(e) {
    console.error('[FL]', e);
    btn.textContent = textoBtn; btn.disabled = false;
    alert('No se pudo guardar el rechazo: ' + (e.message || e));
  }
};

// ═══════════════════════════════════════════════════════
// RESUMEN FINAL — expediente completo para compartir/PDF
// ═══════════════════════════════════════════════════════
window.flResumenFinal = function(id) {
  // Refrescar s desde flS actualizado
  const s = flS.find(x => x.id === id); if (!s) return;
  const v = flV.find(x => x.eco === s.vehiculoEco || x.id === s.vehiculoId);

  const seccion = (titulo, contenido) => `
    <div style="margin-bottom:16px">
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:#94A3B8;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid #F1F5F9">${titulo}</div>
      ${contenido}
    </div>`;

  const campo = (label, val, mono) => val && val !== '—' ? `
    <div style="display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid #F8FAFC">
      <span style="font-size:10px;color:#94A3B8;font-weight:600">${label}</span>
      <span style="font-size:11px;font-weight:700;color:#0A0F1E;${mono?'font-family:JetBrains Mono,monospace':''}">${val}</span>
    </div>` : '';

  const fmt = iso => iso ? iso.slice(0,10) : '—';
  const fmtM = n => n ? '$'+Number(n).toLocaleString('es-MX') : '—';

  const archBtn = (a, i) => a ? `<button onclick="flVerArchivo('${a.b64||a.base64||''}','${a.nombre||'Archivo '+(i+1)}')"
    style="font-size:10px;font-weight:700;padding:5px 10px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:7px;cursor:pointer;color:#374151;display:flex;align-items:center;gap:4px">
    📎 ${a.nombre||'Archivo '+(i+1)}</button>` : '';

  const html = `
    <div class="fl-ov" id="flres-ov" onclick="if(event.target===this)this.remove()" style="z-index:3100">
      <div class="fl-modal" style="max-width:640px;width:100%;max-height:92vh;display:flex;flex-direction:column;overflow:hidden">
        <!-- HEADER -->
        <div style="background:linear-gradient(135deg,#0A1628,#1E3A5F);padding:20px 24px;flex-shrink:0">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div>
              <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:rgba(255,255,255,.5);margin-bottom:4px">Expediente de Servicio — ${(s.id||'').slice(-8).toUpperCase()}</div>
              <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-.4px">ECO ${s.vehiculoEco||'—'} · ${s.tipo||'—'}</div>
              <div style="font-size:12px;color:rgba(255,255,255,.6);margin-top:3px">${v?v.unidad+' '+v.año:''} · ${s.solicitante||s.creadoPor||'—'}</div>
            </div>
            <div style="text-align:right">
              <div style="display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.1);border-radius:100px;padding:5px 12px">
                <div style="width:7px;height:7px;border-radius:50%;background:#4ADE80"></div>
                <span style="font-size:11px;font-weight:800;color:#4ADE80">CERRADA</span>
              </div>
              <div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:5px">${fmt(s.cerradoEn)}</div>
            </div>
          </div>
        </div>

        <!-- CONTENIDO -->
        <div style="overflow-y:auto;flex:1;padding:20px 24px">

          ${seccion('📋 Solicitud original', `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${campo('Tipo de servicio', s.tipo)}
              ${campo('Prioridad', s.prioridad||'Normal')}
              ${campo('Solicitante', s.solicitante||s.creadoPor)}
              ${campo('Fecha solicitud', fmt(s.creadoEn))}
              ${campo('KM reportado', s.kilometrajeReportado)}
              ${campo('Gasolina', s.gasolina!=null?s.gasolina+'%':null)}
            </div>
            ${s.descripcion ? `<div style="margin-top:8px;padding:9px 11px;background:#F8FAFC;border-radius:8px;font-size:11px;color:#374151">${s.descripcion}</div>` : ''}
          `)}

          ${seccion('🔧 Taller / Proveedor', `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${campo('Taller', s.tallerNombre)}
              ${campo('Encargado', s.tallerEncargado)}
              ${campo('Teléfono', s.tallerTel)}
              ${campo('RFC', s.tallerRFC)}
              ${campo('Razón social', s.tallerRazon)}
              ${campo('Dirección', s.tallerDireccion)}
              ${campo('Ingreso', fmt(s.fechaIngresoTaller))}
              ${campo('Entrega estimada', fmt(s.fechaEntregaEstimada))}
            </div>
            ${s.tallerMaps ? `<div style="margin-top:8px"><a href="${s.tallerMaps}" target="_blank" style="font-size:11px;font-weight:700;color:#2563EB;text-decoration:none">📍 Ver taller en Google Maps →</a></div>` : ''}
            ${s.sugerenciaCotizacion ? `<div style="margin-top:8px;padding:9px 11px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;font-size:11px;color:#92400E"><strong>Sugerencia Flotilla:</strong> ${s.sugerenciaCotizacion}</div>` : ''}
          `)}

          ${seccion('💰 Cotización y Pago', `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${campo('Monto cotizado', fmtM(s.montoCotizacion))}
              ${campo('Fecha pago programada', fmt(s.fechaPagoProgramada))}
              ${campo('Validado por', s.validadoPor)}
              ${campo('Validado el', fmt(s.validadoEn))}
              ${campo('Aprobado por', s.aprobadoPor)}
              ${campo('Aprobado el', fmt(s.aprobadoEn))}
              ${campo('Pago registrado por', s.pagadoPor)}
              ${campo('Fecha pago real', fmt(s.pagadoEn))}
            </div>
            ${s.comentarioAprobacion ? `<div style="margin-top:8px;padding:9px 11px;background:#FEF9C3;border-radius:8px;font-size:11px;color:#92400E"><strong>Nota Contraloría:</strong> ${s.comentarioAprobacion}</div>` : ''}
          `)}

          ${seccion('📎 Documentos adjuntos', `
            <div style="display:flex;flex-direction:column;gap:6px">
              ${(s.cotizacionArchivos||[]).length ? `<div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:3px">Cotización (${s.cotizacionArchivos.length} archivos)</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">${(s.cotizacionArchivos||[]).map((a,i)=>archBtn(a,i)).join('')}</div>` : ''}
              ${s.comprobantePago ? `<div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:3px">Comprobante de pago</div>
                <div style="display:flex;gap:5px;margin-bottom:8px">${archBtn(s.comprobantePago,0)}</div>` : ''}
              ${s.facturaServicio ? `<div style="font-size:10px;font-weight:700;color:#64748B;margin-bottom:3px">Factura del servicio</div>
                <div style="display:flex;gap:5px;">${archBtn(s.facturaServicio,0)}</div>` : ''}
              ${!s.cotizacionArchivos?.length && !s.comprobantePago && !s.facturaServicio ? '<div style="font-size:11px;color:#94A3B8">Sin documentos adjuntos</div>' : ''}
            </div>
          `)}

          ${s.notasCierre ? seccion('📝 Observaciones finales', `<div style="padding:9px 11px;background:#F8FAFC;border-radius:8px;font-size:11px;color:#374151">${s.notasCierre}</div>`) : ''}

          ${seccion('⏱ Línea de tiempo', `
            <div style="display:flex;flex-direction:column;gap:6px">
              ${[
                ['Solicitud creada', fmt(s.creadoEn), s.solicitante||s.creadoPor, '#6D28D9'],
                ['Validado por Flotilla', fmt(s.validadoEn), s.validadoPor, '#1D4ED8'],
                ['Aprobado por Contraloría', fmt(s.aprobadoEn), s.aprobadoPor, '#CA8A04'],
                ['Pago registrado', fmt(s.pagadoEn), s.pagadoPor, '#15803D'],
                ['Servicio cerrado', fmt(s.cerradoEn), s.cerradoPor, '#0369A1'],
              ].filter(([,fecha])=>fecha&&fecha!=='—').map(([label,fecha,quien,color])=>`
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
                  <div style="flex:1;font-size:11px;font-weight:700">${label}</div>
                  <div style="font-size:10px;color:#94A3B8">${fecha}</div>
                  ${quien?`<div style="font-size:10px;color:#64748B;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${quien}</div>`:''}
                </div>`).join('')}
            </div>
          `)}
        </div>

        <!-- FOOTER ACCIONES -->
        <div style="padding:14px 24px;border-top:1px solid #F1F5F9;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;background:#FAFBFC">
          <button onclick="document.getElementById('flres-ov').remove()" class="fb gho" style="padding:9px 18px">Cerrar</button>
          <div style="display:flex;gap:8px">
            <button onclick="flGenerarPDF('${id}')" class="fb gho" style="padding:9px 16px;display:flex;align-items:center;gap:6px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PDF
            </button>
            <button onclick="flCompartirWA('${id}')" style="padding:9px 16px;background:#25D366;color:#fff;border:none;border-radius:9px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>`;
  document.getElementById('flres-ov')?.remove();
  document.body.insertAdjacentHTML('beforeend', html);
};

// Porcentaje porEst con nuevos estatus para rPanel
function rFlCalendario() {
  const ahora = new Date();
  const mes = ahora.getMonth();
  const anio = ahora.getFullYear();
  const hoy = ahora.getDate();
  const dotCol = {
    Solicitud:   '#6D28D9',
    'Evaluación':'#1D4ED8',
    Servicio:    '#B45309',
    Rechazada:   '#B91C1C',
    Cerrada:     '#15803D',
  };
  const normCalEst = e => ({'Validación':'Evaluación','Validada':'Evaluación','Cotización':'Evaluación','Aprobación':'Evaluación','Aprobada':'Evaluación','Pagos':'Servicio','Cierre':'Servicio'}[e]||e);
  const eventMap = {};
  const agrega = (fechaStr, sol) => {
    if (!fechaStr || typeof fechaStr !== 'string') return;
    const dk = fechaStr.slice(0,10);
    if (!eventMap[dk]) eventMap[dk] = [];
    eventMap[dk].push(sol);
  };
  flS.forEach(s => {
    agrega(s.creadoEn, s);
    if (s.fechaPagoProgramada) agrega(s.fechaPagoProgramada, { ...s, _tipoCal: 'pago' });
    if (s.fechaIngresoTaller)  agrega(s.fechaIngresoTaller,  { ...s, _tipoCal: 'taller' });
    if (s.validadoEn)          agrega(s.validadoEn, { ...s, _tipoCal: 'validación' });
    if (s.pagadoEn)            agrega(s.pagadoEn,  { ...s, _tipoCal: 'pagado' });
  });
  const primerDia = new Date(anio, mes, 1).getDay();
  const totalDias = new Date(anio, mes + 1, 0).getDate();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dias  = ['D','L','M','M','J','V','S'];
  let celdas = '';
  for (let i = 0; i < primerDia; i++) celdas += `<div></div>`;
  for (let d = 1; d <= totalDias; d++) {
    const key = `${anio}-${String(mes+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const evs = eventMap[key] || [];
    const esHoy = d === hoy;
    const tieneEvs = evs.length > 0;
    const dots = [...new Set(evs.map(e => dotCol[normCalEst(e.estatus)]||'#94A3B8'))].slice(0,3)
      .map(c => `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${c};margin:0 1px"></span>`).join('');
    celdas += `<div onclick="${tieneEvs ? `flCalDia('${key}')` : ''}"
      style="min-height:38px;border-radius:7px;padding:4px 3px 3px;text-align:center;cursor:${tieneEvs?'pointer':'default'};
      background:${esHoy?'#EFF6FF':tieneEvs?'#F8FAFC':'transparent'};
      border:1.5px solid ${esHoy?'#2563EB':tieneEvs?'#E2E8F0':'transparent'};transition:.12s"
      ${tieneEvs?'onmouseover="this.style.background=\'#EFF6FF\'" onmouseout="this.style.background=\''+(esHoy?'#EFF6FF':'#F8FAFC')+'\';"':''}>
      <div style="font-size:11px;font-weight:${esHoy?'900':'600'};color:${esHoy?'#2563EB':tieneEvs?'#0A1628':'#CBD5E1'}">${d}</div>
      ${tieneEvs ? `<div style="display:flex;justify-content:center;gap:1px;margin-top:2px">${dots}</div>` : ''}
      ${tieneEvs && evs.length > 1 ? `<div style="font-size:8px;color:#94A3B8;font-weight:700">${evs.length}</div>` : ''}
    </div>`;
  }
  return `
    <div style="margin-top:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#94A3B8">Calendario de actividades</div>
        <span style="font-size:11px;font-weight:700;color:#374151">${meses[mes]} ${anio}</span>
      </div>
      <div class="fl-tw" style="padding:12px">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:6px">
          ${dias.map(d=>`<div style="text-align:center;font-size:9px;font-weight:800;color:#94A3B8;padding:2px 0">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${celdas}</div>
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
          ${Object.entries(dotCol).map(([est,c])=>`<div style="display:flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:#64748B">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c}"></span>${est}
          </div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ── GENERAR PDF de solicitud ──
window.flGenerarPDF=function(id){
  const s=flS.find(x=>x.id===id);if(!s){return;}
  const v=flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId);
  const chkF=s.chkFotos||{};
  const chkFEntries=Object.entries(chkF).filter(([k,v])=>v);
  const chkResp=s.checklist||{};
  const getLabel=k=>{for(const items of Object.values(CHK_CATS)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
  const gasPct=Number(s.gasolina)||0;
  const gasColor=gasPct>50?'#16A34A':gasPct>25?'#D97706':'#DC2626';
  const toRad=deg=>deg*Math.PI/180;
  const arcX=(r,deg)=>50+r*Math.cos(toRad(deg));
  const arcY=(r,deg)=>50+r*Math.sin(toRad(deg));
  const startDeg=-210;const endDeg=30;
  const fillDeg=startDeg+(gasPct/100)*(endDeg-startDeg);
  const largeArc=gasPct>50?1:0;
  const trackPath=`M ${arcX(35,startDeg)} ${arcY(35,startDeg)} A 35 35 0 1 1 ${arcX(35,endDeg)} ${arcY(35,endDeg)}`;
  const fillPath=gasPct>0?`M ${arcX(35,startDeg)} ${arcY(35,startDeg)} A 35 35 0 ${largeArc} 1 ${arcX(35,fillDeg)} ${arcY(35,fillDeg)}`:'';
  const gasSVG=`<svg width="100" height="65" viewBox="0 0 100 65"><path d="${trackPath}" fill="none" stroke="#E2E8F0" stroke-width="9" stroke-linecap="round"/>${fillPath?`<path d="${fillPath}" fill="none" stroke="${gasColor}" stroke-width="9" stroke-linecap="round"/>`:''}<text x="50" y="50" text-anchor="middle" font-size="16" font-weight="900" fill="${gasColor}" font-family="system-ui">${gasPct}%</text><text x="50" y="62" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="system-ui">GASOLINA</text></svg>`;
  const evGen=s.evidencias||[];
  const evMeta=s.evidenciasMeta||[];
  const evThumbsHTML=evGen.length?evGen.map((src,i)=>`<div style="display:inline-block;margin:4px;text-align:center;vertical-align:top"><img src="${src}" style="width:110px;height:82px;object-fit:cover;border-radius:6px;border:1px solid #E2E8F0;display:block"><div style="font-size:8px;color:#64748B;margin-top:2px;font-family:monospace;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${evMeta[i]?.codigo||'Foto '+(i+1)}</div></div>`).join(''):'<div style="font-size:11px;color:#94A3B8;padding:8px">Sin evidencias</div>';
  let chkFullHTML='';
  for(const [cat,items] of Object.entries(CHK_CATS)){let catRows='';let catHasContent=false;items.forEach((item,idx)=>{const key=cat+'__'+idx;const val=chkResp[key]||'';const foto=chkF[key]||null;if(!val&&!foto)return;catHasContent=true;const isNo=val==='no';const badge=val==='si'?'<span style="display:inline-block;padding:2px 8px;background:#DCFCE7;color:#15803D;border-radius:10px;font-size:9px;font-weight:800">SI</span>':val==='no'?'<span style="display:inline-block;padding:2px 8px;background:#FEE2E2;color:#B91C1C;border-radius:10px;font-size:9px;font-weight:800">NO</span>':'<span style="display:inline-block;padding:2px 8px;background:#F1F5F9;color:#94A3B8;border-radius:10px;font-size:9px;font-weight:700">—</span>';const fotoEl=foto?`<img src="${foto}" style="width:56px;height:42px;object-fit:cover;border-radius:4px;border:1px solid ${isNo?'#FCA5A5':'#E2E8F0'};float:right;margin-left:6px">`:'';catRows+=`<tr style="border-bottom:1px solid #F8FAFD;${isNo?'background:#FFF5F5':''}"><td style="padding:5px 8px;font-size:10.5px;color:${isNo?'#991B1B':'#374151'};font-weight:${isNo?'700':'400'}">${item}</td><td style="padding:5px 8px;text-align:center;white-space:nowrap">${badge}</td><td style="padding:5px 8px;text-align:right">${fotoEl}</td></tr>`;});if(!catHasContent)continue;chkFullHTML+=`<div style="margin-bottom:14px;break-inside:avoid"><div style="background:#1E3A5F;color:#fff;padding:5px 10px;border-radius:5px 5px 0 0;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.6px">${cat}</div><table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-top:none"><thead><tr style="background:#F8FAFD"><th style="padding:4px 8px;font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;text-align:left">Ítem</th><th style="padding:4px 8px;font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;width:60px">Estado</th><th style="padding:4px 8px;font-size:8px;font-weight:800;text-transform:uppercase;color:#94A3B8;width:70px;text-align:right">Foto</th></tr></thead><tbody>${catRows}</tbody></table></div>`;}
  if(!chkFullHTML){const allSi=Object.values(chkResp).filter(v=>v==='si').length;chkFullHTML=allSi>0?`<div style="padding:10px 14px;background:#F0FDF4;border-radius:8px;border:1px solid #BBF7D0;font-size:11.5px;font-weight:700;color:#15803D">Todos los ${allSi} puntos revisados en buen estado</div>`:'<div style="font-size:11px;color:#94A3B8;padding:8px">Sin checklist registrado</div>';}
  const chkPhotosHTML=chkFEntries.length?chkFEntries.map(([k,src])=>`<div style="display:inline-block;margin:4px;text-align:center;vertical-align:top"><img src="${src}" style="width:90px;height:68px;object-fit:cover;border-radius:5px;border:1px solid #BFDBFE;display:block"><div style="font-size:7.5px;color:#1D4ED8;margin-top:2px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${getLabel(k)}</div></div>`).join(''):'';
  const fecha=s.creadoEn?s.creadoEn.substring(0,10):'—';
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Solicitud ${id.slice(0,8).toUpperCase()} — Tecnocontrol</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;font-size:11px;color:#0A0F1E;background:#fff;padding:28px 32px}.logo{font-size:20px;font-weight:900;letter-spacing:-1px}.logo em{color:#2563EB;font-style:normal}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0A1628;padding-bottom:14px;margin-bottom:18px}.veh-bar{background:#0A1628;color:#fff;border-radius:9px;padding:11px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}.field{background:#F8FAFD;border-radius:7px;padding:8px 11px;border:1px solid #E8EDF5}.field label{font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:2px}.field span{font-size:12px;font-weight:700;line-height:1.4}.sec{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:#64748B;margin:16px 0 8px;padding-top:12px;border-top:1px solid #E8EDF5}.gas-box{display:flex;align-items:center;gap:16px;background:#F8FAFD;border-radius:9px;padding:12px 16px;border:1px solid #E8EDF5;margin-bottom:12px}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #E8EDF5;font-size:9px;color:#94A3B8;text-align:center}@media print{body{padding:14px 16px;font-size:10.5px}button{display:none!important}}</style></head><body><div class="hdr"><div><div class="logo">TECNO<em>CONTROL</em></div><div style="font-size:10.5px;color:#64748B;margin-top:3px">Reporte de solicitud vehicular</div></div><div style="text-align:right"><div style="font-size:18px;font-weight:900;font-family:monospace;letter-spacing:1px">${id.slice(0,8).toUpperCase()}</div><div style="margin-top:5px"><span style="padding:3px 12px;border-radius:20px;font-size:10px;font-weight:800;background:#0A1628;color:#fff">${s.estatus||'Solicitud'}</span></div><div style="font-size:10px;color:#64748B;margin-top:4px">${fecha}</div></div></div>${v?`<div class="veh-bar"><div><div style="font-size:14px;font-weight:800">${v.unidad||'—'} ${v.año||''}</div><div style="font-size:10px;color:rgba(255,255,255,.5);margin-top:2px;font-family:monospace">ECO ${v.eco} · ${v.placas||'—'} · ${v.responsable||'—'}</div></div></div>`:''}<div class="grid3"><div class="field"><label>Tipo</label><span>${s.tipo||'—'}</span></div><div class="field"><label>Prioridad</label><span>${s.prioridad||'Normal'}</span></div><div class="field"><label>KM</label><span>${s.kilometrajeReportado||'—'}</span></div></div><div class="grid2"><div class="field"><label>Solicitante</label><span>${s.solicitante||'—'}</span></div><div class="field"><label>Taller</label><span>${s.tallerNombre||s.taller||'Sin especificar'}</span></div></div><div class="field" style="margin-bottom:12px"><label>Descripción</label><span style="font-size:12px;font-weight:500;line-height:1.6">${s.descripcion||'—'}</span></div><div class="gas-box"><div>${gasSVG}</div><div><div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:4px">Nivel de combustible</div><div style="font-size:28px;font-weight:900;color:${gasColor};line-height:1">${gasPct}%</div></div></div>${s.comentarioRechazo?`<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:7px;padding:10px 12px;margin-bottom:10px"><div style="font-size:8.5px;font-weight:800;text-transform:uppercase;color:#B91C1C;margin-bottom:4px">Motivo de rechazo</div><div style="font-size:12px;color:#991B1B">${s.comentarioRechazo}</div></div>`:''}<div class="sec">Evidencias fotográficas (${evGen.length})</div><div style="margin-bottom:12px">${evThumbsHTML}</div><div class="sec">Checklist de revisión</div>${chkFullHTML}${chkPhotosHTML?`<div class="sec">Galería de fotos del checklist (${chkFEntries.length})</div><div style="margin-bottom:12px">${chkPhotosHTML}</div>`:''}<div class="footer">Generado por Portal Flotilla Tecnocontrol · ${new Date().toLocaleString('es-MX')} · ID: ${id}</div><div style="margin-top:16px;display:flex;gap:10px;justify-content:flex-end"><button onclick="window.print()" style="padding:11px 28px;background:#0A1628;color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button></div></body></html>`;
  const win=window.open('','_blank','width=860,height=960');
  if(win){win.document.write(html);win.document.close();}
};

// ── COMPARTIR POR WHATSAPP ──
window.flCompartirWA=function(id){
  const s=flS.find(x=>x.id===id);if(!s)return;
  const v=flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId);
  const noItems=Object.entries(s.checklist||{}).filter(([k,v])=>v==='no');
  const getLabel=k=>{for(const items of Object.values(CHK_CATS)){const f=items.find(it=>it.toLowerCase().replace(/[^a-z0-9]/g,'')===k.toLowerCase().replace(/[^a-z0-9]/g,''));if(f)return f;}return k;};
  const txt=[
    `*TECNOCONTROL — Solicitud Vehicular*`,
    `ID: ${id.slice(0,8).toUpperCase()} | ${s.estatus||'Solicitud'}`,
    `Fecha: ${s.creadoEn?s.creadoEn.substring(0,10):'—'}`,
    ``,
    `*Vehículo:* ${v?v.unidad+' '+v.año:'—'} (ECO ${s.vehiculoEco||'—'})`,
    `*Tipo:* ${s.tipo||'—'}`,
    `*Prioridad:* ${s.prioridad||'Normal'}`,
    `*KM:* ${s.kilometrajeReportado||'—'}`,
    `*Gasolina:* ${s.gasolina!=null?s.gasolina+'%':'—'}`,
    `*Taller:* ${s.tallerNombre||s.taller||'Sin especificar'}`,
    `*Solicitante:* ${s.solicitante||'—'}`,
    ``,
    `*Descripción:*`,
    s.descripcion||'—',
    noItems.length?`*Observaciones checklist:*\n`+noItems.map(([k])=>'• '+getLabel(k)).join('\n'):'',
    s.comentarioRechazo?`*Rechazo:* `+s.comentarioRechazo:'',
    s.tallerNombre?`\n*Taller cotizado:* ${s.tallerNombre}${s.montoCotizacion?' · $'+Number(s.montoCotizacion).toLocaleString('es-MX'):''}`:''
  ].filter(x=>x!==undefined&&x!=='').join('\n');
  window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
};


window.flReact=async function(id){if(!confirm('¿Reactivar este vehículo?'))return;try{await fs.updateDoc(fs.doc(db,C.VEHS,id),{status:'activo',fechaBaja:'',motivoBaja:''});const v=flV.find(x=>x.id===id);if(v)v.status='activo';rBajas();}catch(e){console.error('[FL]',e);}};

// ── Ver vehículo de baja ──
window.flVerVeh=function(id){const v=flV.find(x=>x.id===id);if(!v)return;const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3300';ov.innerHTML=`<div class="fl-modal"><div class="fl-mh"><h3>ECO ${v.eco} · ${v.unidad||'—'}</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div><div class="fl-mb"><div style="display:grid;grid-template-columns:1fr 1fr;background:#F8FAFD;border-radius:9px;overflow:hidden;border:1px solid #E8EDF5">${[['Placas',v.placas||'—'],['Año',v.año||'—'],['Serie',v.serie||'—'],['Color',v.color||'—'],['Plaza',v.plaza||'—'],['Responsable',v.responsable||'—'],['KM',v.km||'—'],['Baja',v.fechaBaja?v.fechaBaja.slice(0,10):'—']].map(([l,val])=>`<dl style="padding:7px 11px;border-right:1px solid #E8EDF5;border-bottom:1px solid #E8EDF5"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">${l}</dt><dd style="font-size:11.5px;font-weight:600">${val}</dd></dl>`).join('')}<dl style="grid-column:1/-1;padding:7px 11px"><dt style="font-size:7.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:2px">Motivo baja</dt><dd style="font-size:11.5px">${v.motivoBaja||'—'}</dd></dl></div><div class="fl-fa"><button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button>${hAdm()?`<button class="fb acc" onclick="flReact('${v.id}');this.closest('.fl-ov').remove()">Reactivar</button>`:''}</div></div></div>`;document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});};

// ── Visor imagen rápido (comisiones) ──
window.flImg=function(src){const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='4500';ov.style.cursor='zoom-out';ov.innerHTML=`<img src="${src}" style="max-width:92%;max-height:92%;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.5)">`;ov.onclick=()=>ov.remove();document.body.appendChild(ov);};

// ═══════════════════════════════════════════════════════════════
// MÓDULO TAREAS DE SOLICITUD
// Colección: flotilla_tareas
// Estructura: {solicitudId, titulo, descripcion, asignadoA (email),
//              asignadoNombre, estatus, prioridad, fechaLimite,
//              fechaCompromiso (técnico), evidencias[], comentarios[],
//              creadoPor, creadoEn, actualizadoEn}
// ═══════════════════════════════════════════════════════════════

// Cargar técnicos (fl_usuarios) para el selector de asignación
async function flCargarTecnicosSelector(selectId){
  try{
    const snap=await fs.getDocs(fs.collection(db,'fl_usuarios'));
    const users=snap.docs.map(d=>({id:d.id,...d.data()}));
    const sel=document.getElementById(selectId);
    if(!sel)return;
    sel.innerHTML='<option value="">— Seleccionar técnico —</option>';
    users.forEach(u=>{
      const op=document.createElement('option');
      op.value=u.email||u.id;
      op.textContent=(u.nombre||u.email||u.id)+' ('+(u.rol||'técnico')+')';
      sel.appendChild(op);
    });
  }catch(e){console.warn('[FL tareas técnicos]',e);}
}

// Helper — badge de estatus de tarea
function hTareaBadge(est){
  const m={
    'Pendiente':    ['#FEF3C7','#92400E'],
    'En proceso':   ['#DBEAFE','#1E40AF'],
    'En revisión':  ['#EDE9FE','#5B21B6'],
    'Completada':   ['#D1FAE5','#065F46'],
    'Cancelada':    ['#F1F5F9','#64748B'],
  };
  const [bg,col]=m[est]||['#F1F5F9','#64748B'];
  return`<span style="background:${bg};color:${col};font-size:9.5px;font-weight:800;padding:2px 8px;border-radius:10px;letter-spacing:.3px">${est}</span>`;
}

// Modal principal — lista de tareas de una solicitud
window.flModalTareas=async function(solId){
  if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
  const s=flS.find(x=>x.id===solId);
  if(!s)return;
  const v=flV.find(x=>x.eco===s.vehiculoEco||x.id===s.vehiculoId);
  const ov=document.createElement('div');ov.className='fl-ov';ov.style.zIndex='3400';
  document.body.appendChild(ov);ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});

  async function render(){
    let tareas=[];
    try{
      const snap=await fs.getDocs(
        fs.query(fs.collection(db,C.TAREAS),fs.where('solicitudId','==',solId))
      );
      tareas=snap.docs.map(d=>({id:d.id,...d.data()}))
        .sort((a,b)=>(a.creadoEn||'').localeCompare(b.creadoEn||''));
    }catch(e){console.warn('[FL tareas]',e);}

    const pend=tareas.filter(t=>t.estatus!=='Completada'&&t.estatus!=='Cancelada').length;
    const comp=tareas.filter(t=>t.estatus==='Completada').length;

    ov.innerHTML=`<div class="fl-modal" style="max-width:620px">
      <div class="fl-mh">
        <div>
          <h3 style="display:flex;align-items:center;gap:7px">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.2" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
            Tareas de solicitud
          </h3>
          <div style="font-size:10px;color:#64748B;margin-top:2px">ECO ${s.vehiculoEco||'—'} · ${v?.unidad||s.vehiculo||'—'} · ${s.tipo||'—'}</div>
        </div>
        <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
      </div>
      <div class="fl-mb">
        ${tareas.length?`<div style="display:flex;gap:10px;margin-bottom:12px">
          <div style="flex:1;background:#FEF3C7;border-radius:9px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#92400E">${pend}</div>
            <div style="font-size:9.5px;font-weight:700;color:#B45309">Pendientes</div>
          </div>
          <div style="flex:1;background:#D1FAE5;border-radius:9px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#065F46">${comp}</div>
            <div style="font-size:9.5px;font-weight:700;color:#059669">Completadas</div>
          </div>
          <div style="flex:1;background:#F8FAFD;border-radius:9px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:900;color:#0A1628">${tareas.length}</div>
            <div style="font-size:9.5px;font-weight:700;color:#64748B">Total</div>
          </div>
        </div>`:''}

        ${tareas.length?tareas.map(t=>`
          <div style="border:1.5px solid ${t.estatus==='Completada'?'#BBF7D0':t.estatus==='En proceso'?'#BFDBFE':'#E2E8F0'};border-radius:10px;padding:12px;margin-bottom:8px;background:${t.estatus==='Completada'?'#F0FDF4':'#fff'}">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:6px">
              <div style="font-size:13px;font-weight:800;color:#0A1628;flex:1">${t.titulo||'Sin título'}</div>
              ${hTareaBadge(t.estatus||'Pendiente')}
            </div>
            ${t.descripcion?`<div style="font-size:12px;color:#475569;margin-bottom:7px">${t.descripcion}</div>`:''}
            <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
              ${t.asignadoNombre?`<span style="font-size:10.5px;font-weight:700;color:#1D4ED8;background:#EFF6FF;padding:2px 8px;border-radius:6px">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:3px"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>${t.asignadoNombre}</span>`:''}
              ${t.prioridad?`<span style="font-size:10.5px;font-weight:700;color:${t.prioridad==='Alta'||t.prioridad==='Urgente'?'#B91C1C':'#64748B'};background:${t.prioridad==='Alta'||t.prioridad==='Urgente'?'#FEE2E2':'#F1F5F9'};padding:2px 8px;border-radius:6px">${t.prioridad}</span>`:''}
              ${t.fechaLimite?`<span style="font-size:10.5px;color:#64748B">Límite: ${t.fechaLimite}</span>`:''}
              ${t.fechaCompromiso?`<span style="font-size:10.5px;font-weight:700;color:#7C3AED;background:#EDE9FE;padding:2px 8px;border-radius:6px">Compromiso técnico: ${t.fechaCompromiso}</span>`:''}
            </div>
            ${t.comentarios?.length?`<div style="background:#F8FAFD;border-radius:7px;padding:7px 10px;margin-bottom:8px;border:1px solid #E8EDF5">
              <div style="font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;margin-bottom:5px">Comentarios (${t.comentarios.length})</div>
              ${t.comentarios.slice(-3).map(c=>`<div style="margin-bottom:4px"><span style="font-size:10px;font-weight:700;color:#1D4ED8">${c.autor||'—'}:</span> <span style="font-size:10px;color:#475569">${c.texto}</span> <span style="font-size:9px;color:#CBD5E1">${c.fecha?c.fecha.slice(0,10):''}</span></div>`).join('')}
            </div>`:''}
            ${t.evidencias?.length?`<div style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:5px">
              ${t.evidencias.map((src,i)=>`<img src="${src}" onclick="flImg('${src}')" style="width:50px;height:50px;object-fit:cover;border-radius:7px;cursor:zoom-in;border:1.5px solid #E2E8F0">`).join('')}
            </div>`:''}
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              ${t.estatus!=='Completada'&&t.estatus!=='Cancelada'?`<button onclick="flTareaDetalle('${t.id}','${solId}')" style="padding:5px 10px;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;color:#1D4ED8;cursor:pointer">Ver / editar</button>`:''}
              ${t.estatus!=='Completada'&&t.estatus!=='Cancelada'?`<button onclick="flTareaCambiarEstatus('${t.id}','${solId}')" style="padding:5px 10px;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:7px;font-family:inherit;font-size:11px;font-weight:700;color:#15803D;cursor:pointer">Cambiar estatus</button>`:''}
            </div>
          </div>`).join('')
        :`<div style="text-align:center;padding:30px 20px;color:#94A3B8">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-bottom:10px;opacity:.4"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <div style="font-size:13px;font-weight:700">Sin tareas asignadas</div>
          <div style="font-size:11px;margin-top:4px">Crea la primera tarea para esta solicitud</div>
        </div>`}

        <div class="fl-sep" style="margin:12px 0"></div>
        <button onclick="flNuevaTarea('${solId}')" style="width:100%;padding:10px;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;border:none;border-radius:10px;font-family:inherit;font-size:13px;font-weight:800;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva tarea
        </button>
      </div>
    </div>`;
  }

  window._flTareasRender=render;
  await render();
};

// Modal — crear nueva tarea
window.flNuevaTarea=async function(solId){
  const s=flS.find(x=>x.id===solId);if(!s)return;
  const ov2=document.createElement('div');ov2.className='fl-ov';ov2.style.zIndex='3500';
  ov2.innerHTML=`<div class="fl-modal" style="max-width:500px">
    <div class="fl-mh">
      <h3>Nueva tarea — ECO ${s.vehiculoEco||'—'}</h3>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:10px">
      <div class="fl-fld"><label>Título de la tarea *</label><input id="nt-titulo" placeholder="Ej: Cambio de aceite, Diagnóstico frenos…"></div>
      <div class="fl-fld"><label>Descripción</label><textarea id="nt-desc" rows="3" style="resize:vertical;padding:8px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;width:100%;box-sizing:border-box" placeholder="Instrucciones o detalles para el técnico…"></textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fl-fld"><label>Prioridad</label><select id="nt-prior"><option>Normal</option><option>Alta</option><option>Urgente</option><option>Baja</option></select></div>
        <div class="fl-fld"><label>Fecha límite</label><input type="date" id="nt-fecha"></div>
      </div>
      <div class="fl-fld"><label>Asignar a técnico *</label><select id="nt-tecnico"><option value="">Cargando…</option></select></div>
      <div class="fl-fa">
        <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cancelar</button>
        <button class="fb acc" onclick="flGuardarTarea('${solId}',this)">Crear tarea</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov2);
  ov2.addEventListener('click',e=>{if(e.target===ov2)ov2.remove();});
  await flCargarTecnicosSelector('nt-tecnico');
};

// Guardar nueva tarea en Firestore + notificar al técnico
window.flGuardarTarea=async function(solId,btn){
  if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
  const titulo=document.getElementById('nt-titulo')?.value?.trim();
  const desc=document.getElementById('nt-desc')?.value?.trim();
  const prior=document.getElementById('nt-prior')?.value||'Normal';
  const fecha=document.getElementById('nt-fecha')?.value||'';
  const tecnicoEmail=document.getElementById('nt-tecnico')?.value;
  const tecnicoNombre=document.getElementById('nt-tecnico')?.selectedOptions?.[0]?.textContent?.split(' (')[0]||'';
  if(!titulo){flToast('El título es obligatorio','err');return;}
  if(!tecnicoEmail){flToast('Selecciona un técnico','err');return;}
  btn.disabled=true;btn.textContent='Guardando…';
  const s=flS.find(x=>x.id===solId);
  const yo=window.auth?.currentUser;
  try{
    await fs.addDoc(fs.collection(db,C.TAREAS),{
      solicitudId:  solId,
      vehiculoEco:  s?.vehiculoEco||'—',
      titulo,
      descripcion:  desc||'',
      prioridad:    prior,
      fechaLimite:  fecha,
      fechaCompromiso: '',
      asignadoA:    tecnicoEmail,
      asignadoNombre: tecnicoNombre,
      estatus:      'Pendiente',
      evidencias:   [],
      comentarios:  [],
      creadoPor:    yo?.email||'—',
      creadoNombre: yo?.displayName||yo?.email||'—',
      creadoEn:     new Date().toISOString(),
      actualizadoEn:new Date().toISOString(),
    });
    // Notificación push al técnico asignado
    await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
      solicitudId: solId,
      para:        tecnicoEmail,
      vehiculoEco: s?.vehiculoEco||'—',
      tipo:        'tarea_nueva',
      mensaje:     'Nueva tarea asignada: "'+titulo+'" — ECO '+(s?.vehiculoEco||'—')+(fecha?' · Límite: '+fecha:''),
      leido:       false,
      creadaEn:    new Date().toISOString(),
    });
    flToast('Tarea creada y técnico notificado','ok');
    document.querySelector('.fl-ov[style*="3500"]')?.remove();
    // Refrescar lista de tareas del modal padre
    if(window._flTareasRender) await window._flTareasRender();
  }catch(e){
    flToast('Error: '+e.message,'err');
    btn.disabled=false;btn.textContent='Crear tarea';
  }
};

// Modal — ver detalle y editar tarea (comentarios, evidencias, fecha compromiso)
window.flTareaDetalle=async function(tareaId,solId){
  if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
  let t;
  try{const snap=await fs.getDoc(fs.doc(db,C.TAREAS,tareaId));t={id:snap.id,...snap.data()};}
  catch(e){flToast('Error al cargar tarea','err');return;}
  const yo=window.auth?.currentUser;

  const ov3=document.createElement('div');ov3.className='fl-ov';ov3.style.zIndex='3600';
  ov3.innerHTML=`<div class="fl-modal" style="max-width:500px">
    <div class="fl-mh">
      <div>
        <h3>${t.titulo||'Tarea'}</h3>
        <div style="font-size:10px;color:#64748B;margin-top:2px">ECO ${t.vehiculoEco||'—'} · Asignado: ${t.asignadoNombre||t.asignadoA||'—'}</div>
      </div>
      <button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button>
    </div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${hTareaBadge(t.estatus||'Pendiente')}
        ${t.prioridad?`<span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:10px;background:${t.prioridad==='Alta'||t.prioridad==='Urgente'?'#FEE2E2':'#F1F5F9'};color:${t.prioridad==='Alta'||t.prioridad==='Urgente'?'#B91C1C':'#64748B'}">${t.prioridad}</span>`:''}
        ${t.fechaLimite?`<span style="font-size:9.5px;color:#64748B;padding:2px 8px;background:#F1F5F9;border-radius:10px">Límite: ${t.fechaLimite}</span>`:''}
      </div>
      ${t.descripcion?`<div style="background:#F8FAFD;border-radius:8px;padding:10px;font-size:12px;color:#475569;border:1px solid #E8EDF5">${t.descripcion}</div>`:''}
      <div class="fl-sep"></div>

      <!-- Historial de comentarios -->
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Comentarios</div>
      <div id="td-comentarios" style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto">
        ${(t.comentarios||[]).length?t.comentarios.map(c=>`
          <div style="background:${c.autorEmail===yo?.email?'#EFF6FF':'#F8FAFD'};border-radius:8px;padding:8px 10px;border:1px solid ${c.autorEmail===yo?.email?'#BFDBFE':'#E8EDF5'}">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:10px;font-weight:700;color:#1D4ED8">${c.autor||'—'}</span>
              <span style="font-size:9px;color:#94A3B8">${c.fecha?c.fecha.slice(0,10):''}</span>
            </div>
            <div style="font-size:12px;color:#0A1628">${c.texto}</div>
          </div>`).join('')
        :`<div style="font-size:11px;color:#94A3B8;text-align:center;padding:10px">Sin comentarios aún</div>`}
      </div>
      <div style="display:flex;gap:7px">
        <input id="td-comt-inp" placeholder="Agregar comentario…" style="flex:1;padding:8px 10px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px">
        <button onclick="flTareaAgregarComt('${tareaId}','${solId}')" style="padding:8px 12px;background:#1D4ED8;color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">Enviar</button>
      </div>

      <!-- Evidencias -->
      <div class="fl-sep"></div>
      <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8">Evidencias</div>
      <div id="td-evs" style="display:flex;flex-wrap:wrap;gap:5px">
        ${(t.evidencias||[]).map((src,i)=>`<img src="${src}" onclick="flImg('${src}')" style="width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:zoom-in;border:1.5px solid #E2E8F0">`).join('')}
      </div>
      <label style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;background:#F8FAFD;border:1.5px dashed #CBD5E1;border-radius:8px;cursor:pointer;font-size:11px;font-weight:700;color:#475569">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Subir evidencia
        <input type="file" accept="image/*" multiple style="display:none" onchange="flTareaSubirEv(this,'${tareaId}','${solId}')">
      </label>

      <div class="fl-fa">
        <button class="fb gho" onclick="this.closest('.fl-ov').remove()">Cerrar</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov3);
  ov3.addEventListener('click',e=>{if(e.target===ov3)ov3.remove();});
};

// Agregar comentario a una tarea
window.flTareaAgregarComt=async function(tareaId,solId){
  const inp=document.getElementById('td-comt-inp');
  const texto=inp?.value?.trim();
  if(!texto)return;
  const yo=window.auth?.currentUser;
  try{
    const snap=await fs.getDoc(fs.doc(db,C.TAREAS,tareaId));
    if(!snap.exists())return;
    const t=snap.data();
    const comentarios=[...(t.comentarios||[]),{
      texto,
      autor:   yo?.displayName||yo?.email||'Admin',
      autorEmail: yo?.email||'',
      fecha:   new Date().toISOString(),
    }];
    await fs.updateDoc(fs.doc(db,C.TAREAS,tareaId),{comentarios,actualizadoEn:new Date().toISOString()});
    // Notificar al técnico asignado (si no es el mismo que comenta)
    if(t.asignadoA && t.asignadoA!==yo?.email){
      await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
        solicitudId: solId,
        para:        t.asignadoA,
        vehiculoEco: t.vehiculoEco||'—',
        tipo:        'tarea_comentario',
        mensaje:     'Nuevo comentario en tu tarea "'+t.titulo+'": "'+texto+'"',
        leido:       false,
        creadaEn:    new Date().toISOString(),
      });
    }
    inp.value='';
    // Refrescar comentarios en el modal
    const cont=document.getElementById('td-comentarios');
    if(cont){
      const snp2=await fs.getDoc(fs.doc(db,C.TAREAS,tareaId));
      const t2=snp2.data();
      cont.innerHTML=(t2.comentarios||[]).map(c=>`
        <div style="background:${c.autorEmail===yo?.email?'#EFF6FF':'#F8FAFD'};border-radius:8px;padding:8px 10px;border:1px solid ${c.autorEmail===yo?.email?'#BFDBFE':'#E8EDF5'}">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:10px;font-weight:700;color:#1D4ED8">${c.autor||'—'}</span>
            <span style="font-size:9px;color:#94A3B8">${c.fecha?c.fecha.slice(0,10):''}</span>
          </div>
          <div style="font-size:12px;color:#0A1628">${c.texto}</div>
        </div>`).join('');
    }
    flToast('Comentario guardado','ok');
    if(window._flTareasRender) await window._flTareasRender();
  }catch(e){flToast('Error: '+e.message,'err');}
};

// Subir evidencia a una tarea (comprimida)
window.flTareaSubirEv=async function(input,tareaId,solId){
  const files=Array.from(input.files);if(!files.length)return;
  flToast('Comprimiendo y subiendo…','ok');
  const nuevasEv=[];
  for(const f of files){
    try{
      const b64=await new Promise((res,rej)=>{
        const img=new Image();
        img.onload=()=>{
          const c=document.createElement('canvas');
          const MAX=900;const sc=Math.min(1,MAX/Math.max(img.width,img.height));
          c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
          c.getContext('2d').drawImage(img,0,0,c.width,c.height);
          res(c.toDataURL('image/jpeg',0.72));
        };
        img.onerror=rej;
        img.src=URL.createObjectURL(f);
      });
      nuevasEv.push(b64);
    }catch(e){console.warn(e);}
  }
  if(!nuevasEv.length)return;
  try{
    const snap=await fs.getDoc(fs.doc(db,C.TAREAS,tareaId));
    const evs=[...(snap.data()?.evidencias||[]),...nuevasEv];
    await fs.updateDoc(fs.doc(db,C.TAREAS,tareaId),{evidencias:evs,actualizadoEn:new Date().toISOString()});
    const cont=document.getElementById('td-evs');
    if(cont) cont.innerHTML=evs.map(src=>`<img src="${src}" onclick="flImg('${src}')" style="width:56px;height:56px;object-fit:cover;border-radius:8px;cursor:zoom-in;border:1.5px solid #E2E8F0">`).join('');
    flToast(nuevasEv.length+' evidencia(s) guardada(s)','ok');
    if(window._flTareasRender) await window._flTareasRender();
  }catch(e){flToast('Error: '+e.message,'err');}
};

// Modal — cambiar estatus de tarea
window.flTareaCambiarEstatus=async function(tareaId,solId){
  const snap=await fs.getDoc(fs.doc(db,C.TAREAS,tareaId));
  const t={id:snap.id,...snap.data()};
  const ov4=document.createElement('div');ov4.className='fl-ov';ov4.style.zIndex='3700';
  ov4.innerHTML=`<div class="fl-modal" style="max-width:380px">
    <div class="fl-mh"><h3>Cambiar estatus</h3><button class="fl-mx" onclick="this.closest('.fl-ov').remove()">✕</button></div>
    <div class="fl-mb" style="display:flex;flex-direction:column;gap:8px">
      <div style="font-size:13px;font-weight:700;color:#0A1628;margin-bottom:4px">${t.titulo||'Tarea'}</div>
      ${['Pendiente','En proceso','En revisión','Completada','Cancelada'].map(est=>`
        <button onclick="flTareaSetEstatus('${tareaId}','${solId}','${est}',this)" style="padding:10px 14px;border-radius:9px;border:1.5px solid ${t.estatus===est?'#7C3AED':'#E2E8F0'};background:${t.estatus===est?'#EDE9FE':'#fff'};font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;text-align:left;color:${t.estatus===est?'#5B21B6':'#374151'}">
          ${t.estatus===est?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" style="margin-right:5px"><polyline points="20 6 9 17 4 12"/></svg>':''} ${est}
        </button>`).join('')}
    </div>
  </div>`;
  document.body.appendChild(ov4);
  ov4.addEventListener('click',e=>{if(e.target===ov4)ov4.remove();});
};

window.flTareaSetEstatus=async function(tareaId,solId,nuevoEst,btn){
  try{
    await fs.updateDoc(fs.doc(db,C.TAREAS,tareaId),{estatus:nuevoEst,actualizadoEn:new Date().toISOString()});
    // Notificar si se completó
    if(nuevoEst==='Completada'||nuevoEst==='En revisión'){
      const snap=await fs.getDoc(fs.doc(db,C.TAREAS,tareaId));
      const t=snap.data();
      const s=flS.find(x=>x.id===solId);
      if(s?.creadoPor){
        await fs.addDoc(fs.collection(db,'flotilla_notificaciones'),{
          solicitudId: solId,
          para:        s.creadoPor,
          vehiculoEco: t.vehiculoEco||'—',
          tipo:        nuevoEst==='Completada'?'tarea_completada':'tarea_revision',
          mensaje:     'Tarea "'+(t.titulo||'—')+'" marcada como '+nuevoEst+' — ECO '+(t.vehiculoEco||'—'),
          leido:       false,
          creadaEn:    new Date().toISOString(),
        });
      }
    }
    flToast('Estatus actualizado','ok');
    document.querySelector('.fl-ov[style*="3700"]')?.remove();
    if(window._flTareasRender) await window._flTareasRender();
  }catch(e){flToast('Error: '+e.message,'err');}
};

// ═══════════════════════════════════════════════════════════════
// VISTA TAREAS — Panel global de gestión de tareas
// ═══════════════════════════════════════════════════════════════
let _flTareasAll = [];           // cache de tareas cargadas
let _flTareasFiltro = {          // filtros activos
  estatus: '',
  tecnico: '',
  eco: '',
  prioridad: '',
  busqueda: '',
};

async function _flCargarTareasAll() {
  if(!fs){const m=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');fs=m;}
  try {
    const snap = await fs.getDocs(fs.collection(db, C.TAREAS));
    _flTareasAll = snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
    // Actualizar badge del tab
    const pend = _flTareasAll.filter(t=>t.estatus==='Pendiente'||t.estatus==='En proceso'||t.estatus==='En revisión').length;
    const badge = document.getElementById('fl-cnt-tar');
    if(badge){ badge.textContent=pend; badge.style.display=pend?'flex':'none'; }
  } catch(e){ console.warn('[FL tareas panel]',e); _flTareasAll=[]; }
}

// Llamar al cargar la app para tener el badge actualizado
(async()=>{
  for(let i=0;i<50&&!window.db;i++) await new Promise(r=>setTimeout(r,100));
  if(!window.db)return;
  if(!db)db=window.db;
  await _flCargarTareasAll();
})();

async function rTareasPanel() {
  await _flCargarTareasAll();
  _renderTareasPanel();
}

function _renderTareasPanel() {
  const f = _flTareasFiltro;

  // Aplicar filtros
  let lista = _flTareasAll.filter(t => {
    if(f.estatus   && t.estatus !== f.estatus) return false;
    if(f.tecnico   && t.asignadoA !== f.tecnico) return false;
    if(f.eco       && String(t.vehiculoEco) !== String(f.eco)) return false;
    if(f.prioridad && t.prioridad !== f.prioridad) return false;
    if(f.busqueda) {
      const q = f.busqueda.toLowerCase();
      if(!(t.titulo||'').toLowerCase().includes(q) &&
         !(t.descripcion||'').toLowerCase().includes(q) &&
         !(t.asignadoNombre||'').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Opciones únicas para filtros
  const tecnicos = [...new Map(_flTareasAll.map(t=>[t.asignadoA,{email:t.asignadoA,nombre:t.asignadoNombre||t.asignadoA}])).values()];
  const ecos     = [...new Set(_flTareasAll.map(t=>t.vehiculoEco).filter(Boolean))].sort();

  // KPIs globales
  const kPend = _flTareasAll.filter(t=>t.estatus==='Pendiente').length;
  const kProc = _flTareasAll.filter(t=>t.estatus==='En proceso').length;
  const kRev  = _flTareasAll.filter(t=>t.estatus==='En revisión').length;
  const kComp = _flTareasAll.filter(t=>t.estatus==='Completada').length;
  const kUrg  = _flTareasAll.filter(t=>t.prioridad==='Urgente'||t.prioridad==='Alta').filter(t=>t.estatus!=='Completada'&&t.estatus!=='Cancelada').length;

  const badgeTarea = est => {
    const m = {'Pendiente':['#FEF3C7','#92400E'],'En proceso':['#DBEAFE','#1E40AF'],'En revisión':['#EDE9FE','#5B21B6'],'Completada':['#D1FAE5','#065F46'],'Cancelada':['#F1F5F9','#64748B']};
    const [bg,col] = m[est]||['#F1F5F9','#64748B'];
    return `<span style="background:${bg};color:${col};font-size:9px;font-weight:800;padding:2px 8px;border-radius:10px;white-space:nowrap">${est}</span>`;
  };

  const priorColor = p => p==='Urgente'?'#B91C1C':p==='Alta'?'#D97706':'#64748B';
  const priorBg    = p => p==='Urgente'?'#FEE2E2':p==='Alta'?'#FEF3C7':'#F1F5F9';

  setContent(padded(`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:18px;font-weight:900;letter-spacing:-.5px">Gestión de Tareas</div>
        <div style="font-size:11px;color:#64748B;margin-top:2px">${_flTareasAll.length} tareas totales · ${lista.length} mostrando</div>
      </div>
      <button onclick="rTareasPanel()" style="padding:7px 14px;background:#F1F5F9;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
        Actualizar
      </button>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px">
      ${[
        ['Pendientes', kPend, '#FEF3C7', '#92400E', 'Pendiente'],
        ['En proceso', kProc, '#DBEAFE', '#1E40AF', 'En proceso'],
        ['En revisión',kRev,  '#EDE9FE', '#5B21B6', 'En revisión'],
        ['Completadas',kComp, '#D1FAE5', '#065F46', 'Completada'],
        ['Alta/Urgente',kUrg, '#FEE2E2', '#B91C1C', ''],
      ].map(([lbl,n,bg,col,est])=>`
        <div onclick="${est?`window._flFiltrarTareas('estatus','${est}')`:''}" style="background:${bg};border-radius:10px;padding:11px 10px;text-align:center;cursor:${est?'pointer':'default'};transition:.12s" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
          <div style="font-size:22px;font-weight:900;color:${col}">${n}</div>
          <div style="font-size:9px;font-weight:700;color:${col};opacity:.8;white-space:nowrap">${lbl}</div>
        </div>`).join('')}
    </div>

    <!-- Filtros -->
    <div style="background:#F8FAFD;border:1.5px solid #E8EDF5;border-radius:10px;padding:12px 14px;margin-bottom:14px">
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end">
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Buscar</label>
          <input id="fl-tar-busq" placeholder="Título, descripción, técnico…" value="${f.busqueda||''}"
            oninput="window._flFiltrarTareas('busqueda',this.value)"
            style="width:100%;padding:7px 10px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px;box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Estatus</label>
          <select onchange="window._flFiltrarTareas('estatus',this.value)" style="width:100%;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px">
            <option value="" ${!f.estatus?'selected':''}>Todos</option>
            ${['Pendiente','En proceso','En revisión','Completada','Cancelada'].map(e=>`<option value="${e}" ${f.estatus===e?'selected':''}>${e}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Técnico</label>
          <select onchange="window._flFiltrarTareas('tecnico',this.value)" style="width:100%;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px">
            <option value="" ${!f.tecnico?'selected':''}>Todos</option>
            ${tecnicos.map(u=>`<option value="${u.email}" ${f.tecnico===u.email?'selected':''}>${u.nombre||u.email}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#94A3B8;display:block;margin-bottom:4px">Prioridad</label>
          <select onchange="window._flFiltrarTareas('prioridad',this.value)" style="width:100%;padding:7px 8px;border:1.5px solid #E2E8F0;border-radius:8px;font-family:inherit;font-size:12px">
            <option value="" ${!f.prioridad?'selected':''}>Todas</option>
            ${['Urgente','Alta','Normal','Baja'].map(p=>`<option value="${p}" ${f.prioridad===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <button onclick="window._flLimpiarFiltrosTareas()" title="Limpiar filtros" style="padding:7px 10px;background:#fff;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:16px">✕</button>
      </div>
    </div>

    <!-- Tabla de tareas -->
    ${!lista.length?`
      <div class="fl-empty">
        <div class="fl-empty-ico"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>
        <h3>Sin tareas</h3><p>No hay tareas con los filtros seleccionados.</p>
      </div>
    `:`
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="background:#F8FAFD;border-bottom:2px solid #E8EDF5">
          <th style="padding:9px 12px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B;white-space:nowrap">Tarea</th>
          <th style="padding:9px 12px;text-align:left;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Técnico</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">ECO</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Estatus</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Prioridad</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Límite</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Compromiso</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Comt.</th>
          <th style="padding:9px 12px;text-align:center;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#64748B">Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${lista.map((t,idx)=>{
          const sol = flS.find(s=>s.id===t.solicitudId);
          const venc = t.fechaLimite && new Date(t.fechaLimite) < new Date() && t.estatus!=='Completada' && t.estatus!=='Cancelada';
          return `<tr style="border-bottom:1px solid #F1F5F9;background:${idx%2===0?'#fff':'#FAFBFD'};${venc?'border-left:3px solid #EF4444':''}" onmouseover="this.style.background='#F0F4FF'" onmouseout="this.style.background='${idx%2===0?'#fff':'#FAFBFD'}'">
            <td style="padding:10px 12px;max-width:240px">
              <div style="font-weight:700;color:#0A1628;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.titulo||'Sin título'}${venc?'<span style="margin-left:5px;font-size:9px;background:#FEE2E2;color:#B91C1C;padding:1px 5px;border-radius:4px;font-weight:800">VENCIDA</span>':''}</div>
              <div style="font-size:10px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.descripcion||'—'}</div>
              ${sol?`<div style="font-size:10px;color:#2563EB;cursor:pointer;font-weight:700;margin-top:2px" onclick="flVerSol('${sol.id}')">↗ ${sol.tipo||'Solicitud'}</div>`:''}
            </td>
            <td style="padding:10px 12px;white-space:nowrap">
              <div style="font-weight:600">${t.asignadoNombre||'—'}</div>
              <div style="font-size:10px;color:#94A3B8">${t.asignadoA||''}</div>
            </td>
            <td style="padding:10px 12px;text-align:center">
              <span style="font-size:11px;font-weight:800;color:#1D4ED8;background:#EFF6FF;padding:2px 8px;border-radius:6px">${t.vehiculoEco||'—'}</span>
            </td>
            <td style="padding:10px 12px;text-align:center">${badgeTarea(t.estatus||'Pendiente')}</td>
            <td style="padding:10px 12px;text-align:center">
              <span style="font-size:10px;font-weight:700;background:${priorBg(t.prioridad)};color:${priorColor(t.prioridad)};padding:2px 7px;border-radius:6px">${t.prioridad||'Normal'}</span>
            </td>
            <td style="padding:10px 12px;text-align:center;font-size:11px;color:${venc?'#B91C1C':'#64748B'};font-weight:${venc?'700':'400'}">${t.fechaLimite||'—'}</td>
            <td style="padding:10px 12px;text-align:center;font-size:11px;color:${t.fechaCompromiso?'#7C3AED':'#CBD5E1'};font-weight:${t.fechaCompromiso?'700':'400'}">${t.fechaCompromiso||'—'}</td>
            <td style="padding:10px 12px;text-align:center">
              <span style="font-size:11px;font-weight:700;color:${(t.comentarios||[]).length?'#1D4ED8':'#CBD5E1'}">${(t.comentarios||[]).length}</span>
            </td>
            <td style="padding:10px 12px;text-align:center;white-space:nowrap">
              <div style="display:flex;gap:4px;justify-content:center">
                <button onclick="flTareaDetalle('${t.id}','${t.solicitudId||''}')" title="Ver detalle" style="padding:5px 8px;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;color:#1D4ED8">Ver</button>
                <button onclick="flTareaCambiarEstatus('${t.id}','${t.solicitudId||''}')" title="Cambiar estatus" style="padding:5px 8px;background:#F0FDF4;border:1.5px solid #BBF7D0;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;color:#15803D">Estatus</button>
                ${t.solicitudId?`<button onclick="flVerSol('${t.solicitudId}')" title="Ver solicitud" style="padding:5px 8px;background:#F5F3FF;border:1.5px solid #DDD6FE;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;color:#7C3AED">Sol.</button>`:''}
                <button onclick="flEliminarTarea('${t.id}')" title="Eliminar tarea" style="padding:5px 8px;background:#FEF2F2;border:1.5px solid #FECACA;border-radius:6px;cursor:pointer;font-size:10px;font-weight:700;color:#B91C1C">✕</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>
    `}
  `));
}

// Filtrar tareas (debounce en busqueda)
let _flTareasBusqTimer = null;
window._flFiltrarTareas = function(campo, valor) {
  if(campo === 'busqueda'){
    _flTareasFiltro[campo] = valor;
    clearTimeout(_flTareasBusqTimer);
    _flTareasBusqTimer = setTimeout(_renderTareasPanel, 250);
  } else {
    _flTareasFiltro[campo] = valor;
    _renderTareasPanel();
  }
};

window._flLimpiarFiltrosTareas = function() {
  _flTareasFiltro = {estatus:'',tecnico:'',eco:'',prioridad:'',busqueda:''};
  _renderTareasPanel();
};

// Eliminar tarea con confirmación
window.flEliminarTarea = async function(tareaId) {
  if(!confirm('¿Eliminar esta tarea permanentemente? No se puede deshacer.')) return;
  try {
    await fs.deleteDoc(fs.doc(db, C.TAREAS, tareaId));
    _flTareasAll = _flTareasAll.filter(t=>t.id!==tareaId);
    flToast('Tarea eliminada','ok');
    _renderTareasPanel();
  } catch(e){ flToast('Error: '+e.message,'err'); }
};

// ── UTILIDAD: Limpiar duplicados de flotilla_vehiculos ──────────
// Ejecutar desde consola del portal (Admin): await window.flLimpiarDuplicados()
window.flLimpiarDuplicados=async function(){
  const snap=await fs.getDocs(fs.collection(db,C.VEHS));
  const docs=snap.docs.map(d=>({id:d.id,...d.data()}));
  // Agrupar por ECO
  const porEco={};
  docs.forEach(d=>{
    const k=String(d.eco||'sin-eco');
    if(!porEco[k])porEco[k]=[];
    porEco[k].push(d);
  });
  let eliminados=0;
  const resumen=[];
  for(const [eco,grupo] of Object.entries(porEco)){
    if(grupo.length<=1)continue;
    // Mantener el más reciente (mayor creadoEn o último en la lista)
    const ordenados=grupo.slice().sort((a,b)=>(b.creadoEn||'').localeCompare(a.creadoEn||''));
    const mantener=ordenados[0];
    const borrar=ordenados.slice(1);
    for(const d of borrar){
      await fs.deleteDoc(fs.doc(db,C.VEHS,d.id));
      eliminados++;
      resumen.push(`ECO ${eco}: eliminado doc ${d.id} (creado ${d.creadoEn||'?'}), conservado ${mantener.id}`);
    }
  }
  console.log('[flLimpiarDuplicados] Eliminados:',eliminados);
  resumen.forEach(r=>console.log(r));
  if(eliminados>0){
    await ldVehs();renderSB();
    alert('Limpieza completada: '+eliminados+' documento(s) duplicado(s) eliminado(s).\nRevisa la consola para el detalle.');
  } else {
    alert('Sin duplicados encontrados en flotilla_vehiculos.');
  }
  return {eliminados,resumen};
};

console.log('[FLOTILLA v16] Taller único + presupuesto mes + flReconciliarTaller · '+CAT.length+' unidades');
})();
