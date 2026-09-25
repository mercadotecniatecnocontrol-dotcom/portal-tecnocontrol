// ════════════════════════════════════════════════════════════════
// Sincroniza a Firestore (colección estaciones_servicio) los datos
// del Excel ESTACIONES_OXXO_GAS.xlsx que ya se cargaron en Supabase.
// Pégalo en la consola del navegador (F12) ESTANDO DENTRO DEL PORTAL
// (para que window.db ya exista), y presiona Enter.
// Primero corre en modo DRY_RUN=true (no escribe nada, solo muestra
// qué haría). Cuando confirmes que se ve bien, cambia a false y
// vuelve a correrlo.
// ════════════════════════════════════════════════════════════════
(async function() {
  const DRY_RUN = true; // ← cámbialo a false para ejecutar de verdad

  const datos = [
  {
    "id": "CHIH-0344",
    "nombreComercial": "Amigo CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0488",
    "nombreComercial": "Baeza CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Delicias",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0412",
    "nombreComercial": "Barrancas CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 3,
    "numeroDispensarios": 8,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0334",
    "nombreComercial": "Blvd Fronterizo CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 2,
    "numeroDispensarios": 6,
    "numeroSondas": 1
  },
  {
    "id": "CHIH-0510",
    "nombreComercial": "BOSQUES CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "ALDAMA",
    "numeroTanques": 4,
    "numeroDispensarios": 5,
    "numeroSondas": null
  },
  {
    "id": "CHIH-0514",
    "nombreComercial": "Cafetales CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 3,
    "numeroDispensarios": 2,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0413",
    "nombreComercial": "Camargo CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Camargo",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0485",
    "nombreComercial": "Camionero Jimenez CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Jiménez",
    "numeroTanques": 4,
    "numeroDispensarios": 3,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0460",
    "nombreComercial": "Campesina CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Jiménez",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0423",
    "nombreComercial": "Chavira CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Camargo",
    "numeroTanques": 3,
    "numeroDispensarios": 4,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0414",
    "nombreComercial": "Cimarron CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Delicias",
    "numeroTanques": 3,
    "numeroDispensarios": 12,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0422",
    "nombreComercial": "Colegio Militar CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 3,
    "numeroDispensarios": 9,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0486",
    "nombreComercial": "Comonfort CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Camargo",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0572",
    "nombreComercial": "Cordilleras",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0470",
    "nombreComercial": "Delicias CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Delicias",
    "numeroTanques": 3,
    "numeroDispensarios": 8,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0415",
    "nombreComercial": "DEPORTISTAS CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 5,
    "numeroDispensarios": 3,
    "numeroSondas": 5
  },
  {
    "id": "CHIH-0477",
    "nombreComercial": "EL COBRE CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 5,
    "numeroDispensarios": 3,
    "numeroSondas": 5
  },
  {
    "id": "CHIH-0418",
    "nombreComercial": "El Saucito CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 3,
    "numeroDispensarios": 2,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0073",
    "nombreComercial": "Estadio CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0484",
    "nombreComercial": "Fatima CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Jiménez",
    "numeroTanques": 3,
    "numeroDispensarios": 5,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0029",
    "nombreComercial": "Flores Magón",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0074",
    "nombreComercial": "Granjas CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0343",
    "nombreComercial": "Granjero CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 3,
    "numeroDispensarios": 4,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0492",
    "nombreComercial": "Hacienda del Valle CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 2,
    "numeroDispensarios": 8,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0342",
    "nombreComercial": "Henequen CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0335",
    "nombreComercial": "Independencia CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 4,
    "numeroDispensarios": 3,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0077",
    "nombreComercial": "Janeiro CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0337",
    "nombreComercial": "Juan Pablo CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 4,
    "numeroDispensarios": 4,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0076",
    "nombreComercial": "Juventud CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 4,
    "numeroDispensarios": 4,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0426",
    "nombreComercial": "La Cruz CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "La Cruz",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0417",
    "nombreComercial": "La Pila CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Camargo",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0420",
    "nombreComercial": "Lagunita CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Camargo",
    "numeroTanques": 4,
    "numeroDispensarios": 5,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0336",
    "nombreComercial": "Lucha y Esfuerzo CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 2,
    "numeroDispensarios": 2,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0425",
    "nombreComercial": "Majalca CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 4,
    "numeroDispensarios": 6,
    "numeroSondas": null
  },
  {
    "id": "CHIH-0072",
    "nombreComercial": "Melchor Guaspe CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 4,
    "numeroDispensarios": 3,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0124",
    "nombreComercial": "Niños Heroes CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Hidalgo del Parral",
    "numeroTanques": 2,
    "numeroDispensarios": 6,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0347",
    "nombreComercial": "Nogales CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 2,
    "numeroDispensarios": 3,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0511",
    "nombreComercial": "OCAMPO CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 4,
    "numeroDispensarios": 3,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0513",
    "nombreComercial": "Ojinaga CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "Ojinaga",
    "numeroTanques": 3,
    "numeroDispensarios": 6,
    "numeroSondas": null
  },
  {
    "id": "CHIH-0512",
    "nombreComercial": "Oscar Flores CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "Ojinaga",
    "numeroTanques": 2,
    "numeroDispensarios": 6,
    "numeroSondas": null
  },
  {
    "id": "CHIH-0416",
    "nombreComercial": "Panamericana CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 3,
    "numeroDispensarios": 7,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0101",
    "nombreComercial": "Pedro de Lille CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Hidalgo del Parral",
    "numeroTanques": 4,
    "numeroDispensarios": 3,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0424",
    "nombreComercial": "PINABETE CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 5,
    "numeroDispensarios": 2,
    "numeroSondas": 5
  },
  {
    "id": "CHIH-0341",
    "nombreComercial": "Ponciano CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 4,
    "numeroDispensarios": 5,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0421",
    "nombreComercial": "Rancheria Juarez CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 3,
    "numeroDispensarios": 3,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0534",
    "nombreComercial": "Riberas CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 3,
    "numeroDispensarios": 4,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0346",
    "nombreComercial": "Rio Grande CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 3,
    "numeroDispensarios": 4,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0509",
    "nombreComercial": "Sacramento CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 3,
    "numeroDispensarios": 4,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0100",
    "nombreComercial": "San Jose CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Hidalgo del Parral",
    "numeroTanques": 3,
    "numeroDispensarios": 4,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0508",
    "nombreComercial": "SANTA RITA CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 3,
    "numeroDispensarios": 6,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0339",
    "nombreComercial": "Santos CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 4,
    "numeroDispensarios": 4,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0075",
    "nombreComercial": "Santuario CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 3,
    "numeroDispensarios": 6,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0487",
    "nombreComercial": "ServicioCamioneroCUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 5,
    "numeroDispensarios": 6,
    "numeroSondas": 5
  },
  {
    "id": "CHIH-0491",
    "nombreComercial": "ServicioCamioneroIICUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Aquiles Serdán",
    "numeroTanques": null,
    "numeroDispensarios": null,
    "numeroSondas": null
  },
  {
    "id": "CHIH-0489",
    "nombreComercial": "Sor Juana Ines CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Jiménez",
    "numeroTanques": 3,
    "numeroDispensarios": 7,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0483",
    "nombreComercial": "Sta. Rosalia CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "Camargo",
    "numeroTanques": 2,
    "numeroDispensarios": 8,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0515",
    "nombreComercial": "TRASVINA CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "NORTE",
    "numeroTanques": 2,
    "numeroDispensarios": 6,
    "numeroSondas": 3
  },
  {
    "id": "CHIH-0338",
    "nombreComercial": "Trigal CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 2,
    "numeroDispensarios": 2,
    "numeroSondas": 2
  },
  {
    "id": "CHIH-0419",
    "nombreComercial": "TURISTICOS CUU",
    "encargado": "ROBERTO MIRAMONTES",
    "zona": "SUR",
    "numeroTanques": 6,
    "numeroDispensarios": 6,
    "numeroSondas": 4
  },
  {
    "id": "CHIH-0345",
    "nombreComercial": "Zaragoza CUU",
    "encargado": "LAZARO RAMIREZ",
    "zona": "JUAREZ",
    "numeroTanques": 2,
    "numeroDispensarios": 6,
    "numeroSondas": 2
  }
];

  const { collection, doc, updateDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  let ok = 0, errores = 0;
  for (const item of datos) {
    const { id, ...campos } = item;
    if (DRY_RUN) {
      console.log("[DRY_RUN] actualizaría", id, campos);
      ok++;
      continue;
    }
    try {
      await updateDoc(doc(window.db, "estaciones_servicio", id), { ...campos, actualizadoEn: serverTimestamp() });
      console.log("✓", id);
      ok++;
    } catch (e) {
      console.error("✗", id, e.message);
      errores++;
    }
  }
  console.log(`Listo. ${ok} ok, ${errores} errores. DRY_RUN=${DRY_RUN}`);
})();
