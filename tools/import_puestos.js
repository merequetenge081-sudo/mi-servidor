/**
 * Script para importar datos de puestos de votación desde IDECA
 * 
 * Uso:
 * - Desarrollo: node tools/import_puestos.js
 * - Producción: node tools/import_puestos.js --file ruta/archivo.json
 */

import mongoose from "mongoose";
import { Puestos } from "../src/models/index.js";
import fs from "fs";
import logger from "../src/config/logger.js";

// Conectar directamente a MongoDB Atlas, no a localhost
const MONGO_URL = process.env.MONGO_URL || "mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor?retryWrites=true&w=majority";

// Datos de ejemplo para todas las localidades de Bogotá
const PUESTOS_BOGOTA_EJEMPLO = [
  // USAQUÉN
  {
    codigoPuesto: "011001",
    nombre: "Colegio Distrital Usaquén",
    localidad: "Usaquén",
    direccion: "Cra 7 #120-50",
    mesas: [1, 2, 3, 4, 5]
  },
  {
    codigoPuesto: "011002",
    nombre: "Instituto Técnico Usaquén",
    localidad: "Usaquén",
    direccion: "Cra 9 #125-60",
    mesas: [1, 2, 3]
  },
  
  // CHAPINERO
  {
    codigoPuesto: "012001",
    nombre: "Colegio Chapinero",
    localidad: "Chapinero",
    direccion: "Cra 7 #72-80",
    mesas: [1, 2, 3, 4]
  },
  {
    codigoPuesto: "012002",
    nombre: "Escuela Chapinero Alto",
    localidad: "Chapinero",
    direccion: "Cra 5 #75-40",
    mesas: [1, 2]
  },
  
  // SANTA FE
  {
    codigoPuesto: "013001",
    nombre: "Colegio Santa Fe",
    localidad: "Santa Fe",
    direccion: "Cra 3 #12-30",
    mesas: [1, 2, 3, 4, 5, 6]
  },
  
  // SAN CRISTÓBAL
  {
    codigoPuesto: "014001",
    nombre: "Colegio San Cristóbal",
    localidad: "San Cristóbal",
    direccion: "Cra 2 #40-50",
    mesas: [1, 2, 3, 4, 5]
  },
  
  // USME
  {
    codigoPuesto: "015001",
    nombre: "Colegio Usme",
    localidad: "Usme",
    direccion: "Av Cra 3 #85-20",
    mesas: [1, 2, 3, 4]
  },
  
  // TUNJUELITO
  {
    codigoPuesto: "016001",
    nombre: "Colegio Tunjuelito",
    localidad: "Tunjuelito",
    direccion: "Cra 19 #32-50",
    mesas: [1, 2, 3]
  },
  
  // BOSA
  {
    codigoPuesto: "017001",
    nombre: "Colegio Bosa",
    localidad: "Bosa",
    direccion: "Cra 40 #67-80",
    mesas: [1, 2, 3, 4, 5, 6]
  },
  {
    codigoPuesto: "017002",
    nombre: "Instituto Bosa",
    localidad: "Bosa",
    direccion: "Cra 45 #70-40",
    mesas: [1, 2, 3]
  },
  
  // KENNEDY
  {
    codigoPuesto: "018001",
    nombre: "Colegio Kennedy",
    localidad: "Kennedy",
    direccion: "Cra 68 #36-45",
    mesas: [1, 2, 3, 4, 5]
  },
  {
    codigoPuesto: "018002",
    nombre: "Escuela Kennedy Central",
    localidad: "Kennedy",
    direccion: "Cra 70 #38-30",
    mesas: [1, 2, 3, 4]
  },
  {
    codigoPuesto: "018003",
    nombre: "Instituto Técnico Kennedy Sur",
    localidad: "Kennedy",
    direccion: "Cra 75 #41-60",
    mesas: [1, 2, 3]
  },
  
  // FONTIBÓN
  {
    codigoPuesto: "019001",
    nombre: "Colegio Fontibón",
    localidad: "Fontibón",
    direccion: "Cra 67 #19-40",
    mesas: [1, 2, 3, 4]
  },
  
  // ENGATIVÁ
  {
    codigoPuesto: "0110001",
    nombre: "Colegio Engativá",
    localidad: "Engativá",
    direccion: "Cra 72 #70-50",
    mesas: [1, 2, 3, 4, 5]
  },
  
  // SUBA
  {
    codigoPuesto: "0110002",
    nombre: "Colegio Suba",
    localidad: "Suba",
    direccion: "Cra 100 #122-60",
    mesas: [1, 2, 3, 4, 5, 6]
  },
  
  // BARRIOS UNIDOS
  {
    codigoPuesto: "0110003",
    nombre: "Colegio Barrios Unidos",
    localidad: "Barrios Unidos",
    direccion: "Cra 9 #60-50",
    mesas: [1, 2, 3]
  },
  
  // TEUSAQUILLO
  {
    codigoPuesto: "0110004",
    nombre: "Colegio Teusaquillo",
    localidad: "Teusaquillo",
    direccion: "Cra 15 #52-40",
    mesas: [1, 2, 3]
  },
  
  // LOS MÁRTIRES
  {
    codigoPuesto: "0110005",
    nombre: "Colegio Los Mártires",
    localidad: "Los Mártires",
    direccion: "Cra 8 #17-30",
    mesas: [1, 2]
  },
  
  // ANTONIO NARIÑO
  {
    codigoPuesto: "0110006",
    nombre: "Colegio Antonio Nariño",
    localidad: "Antonio Nariño",
    direccion: "Cra 2 #29-50",
    mesas: [1, 2, 3]
  },
  
  // PUENTE ARANDA
  {
    codigoPuesto: "0110007",
    nombre: "Colegio Puente Aranda",
    localidad: "Puente Aranda",
    direccion: "Cra 30 #19-40",
    mesas: [1, 2, 3, 4]
  },
  
  // LA CANDELARIA
  {
    codigoPuesto: "0110008",
    nombre: "Colegio La Candelaria",
    localidad: "La Candelaria",
    direccion: "Cra 3 #11-50",
    mesas: [1]
  },
  
  // RAFAEL URIBE URIBE
  {
    codigoPuesto: "0110009",
    nombre: "Colegio Rafael Uribe Uribe",
    localidad: "Rafael Uribe Uribe",
    direccion: "Cra 14 #51-60",
    mesas: [1, 2, 3, 4]
  },
  
  // CIUDAD BOLÍVAR
  {
    codigoPuesto: "0110010",
    nombre: "Colegio Ciudad Bolívar",
    localidad: "Ciudad Bolívar",
    direccion: "Cra 30 #63-50",
    mesas: [1, 2, 3, 4, 5]
  },
  
  // SUMAPAZ
  {
    codigoPuesto: "0110011",
    nombre: "Centro Comunitario Sumapaz",
    localidad: "Sumapaz",
    direccion: "Cra 2 #90-20",
    mesas: [1, 2]
  }
];

async function importarPuestos() {
  try {
    await mongoose.connect(MONGO_URL, {
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4
    });
    logger.info("📍 Iniciando importación de puestos de votación...");

    // Obtener datos de archivo si se especifica
    let puestos = PUESTOS_BOGOTA_EJEMPLO;
    const args = process.argv.slice(2);
    
    if (args.includes('--file')) {
      const fileIndex = args.indexOf('--file');
      const filePath = args[fileIndex + 1];
      
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        puestos = JSON.parse(fileContent);
        logger.info(`📂 Cargados ${puestos.length} puestos desde ${filePath}`);
      } else {
        logger.warn(`⚠️ Archivo no encontrado: ${filePath}`);
        logger.info("Usando datos de ejemplo...");
      }
    }

    // Validar datos
    const puestosValidos = puestos.filter(p => 
      p.codigoPuesto && p.nombre && p.localidad && Array.isArray(p.mesas)
    );

    if (puestosValidos.length === 0) {
      logger.error("❌ No hay puestos válidos para importar");
      process.exit(1);
    }

    // Limpiar colección existente
    await Puestos.deleteMany({});
    logger.info(`🗑️  Colección anterior limpiada`);

    // Insertar nuevos puestos
    const resultado = await Puestos.insertMany(puestosValidos);
    
    logger.info(`✅ Se importaron ${resultado.length} puestos de votación`);
    
    // Mostrar estadísticas por localidad
    const stats = {};
    resultado.forEach(p => {
      if (!stats[p.localidad]) {
        stats[p.localidad] = { count: 0, mesas: 0 };
      }
      stats[p.localidad].count++;
      stats[p.localidad].mesas += p.mesas.length;
    });

    console.log("\n📊 Estadísticas por localidad:");
    console.log("═══════════════════════════════════════════════════════");
    Object.entries(stats).sort().forEach(([localidad, data]) => {
      console.log(`  ${localidad.padEnd(25)} → ${data.count} puesto(s) | ${data.mesas} mesa(s)`);
    });
    console.log("═══════════════════════════════════════════════════════\n");

    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error al importar puestos: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

importarPuestos();
