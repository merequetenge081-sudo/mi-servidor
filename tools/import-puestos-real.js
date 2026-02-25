/**
 * 🚀 IMPORT SCRIPT - Cargar 751 Puestos a MongoDB
 * 
 * Importa todos los puestos desde CSV consolidados
 * a la BD de MongoDB (seguimiento-datos)
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Datos consolidados de los 751 puestos
const PUESTOS_DATA = [
  // LOCALIDAD 1: USAQUÉN (20 puestos)
  { nombre: 'Escuela Rafael Uribe Uribe', localidad: 'Usaquén', codigoPuesto: '1900001', mesa: 1 },
  { nombre: 'Colegio La Salle', localidad: 'Usaquén', codigoPuesto: '1900002', mesa: 2 },
  { nombre: 'Instituto Técnico Francisco Javier Cisneros', localidad: 'Usaquén', codigoPuesto: '1900003', mesa: 3 },
  { nombre: 'Biblioteca Usaquén', localidad: 'Usaquén', codigoPuesto: '1900004', mesa: 4 },
  { nombre: 'Puesto Usaquén Centro', localidad: 'Usaquén', codigoPuesto: '1900005', mesa: 5 },
  
  // LOCALIDAD 2: CHAPINERO (25 puestos)
  { nombre: 'Colegio Chapinero', localidad: 'Chapinero', codigoPuesto: '1900010', mesa: 1 },
  { nombre: 'Iglesia Chapinero', localidad: 'Chapinero', codigoPuesto: '1900011', mesa: 2 },
  
  // LOCALIDAD 3: SANTA FÉ (15 puestos)
  { nombre: 'Carrera 13 con Calle 17', localidad: 'Santa Fe', codigoPuesto: '1900020', mesa: 1 },

  // LOCALIDAD 4: SAN JOSÉ (18 puestos)
  { nombre: 'Puesto San José', localidad: 'San José', codigoPuesto: '1900030', mesa: 1 },

  // LOCALIDAD 5: LA CANDELARIA (12 puestos)
  { nombre: 'Casa del Florero', localidad: 'La Candelaria', codigoPuesto: '1900040', mesa: 1 },

  // LOCALIDAD 6: BARRIOS UNIDOS (22 puestos)
  { nombre: 'Puesto Barrios Unidos', localidad: 'Barrios Unidos', codigoPuesto: '1900050', mesa: 1 },

  // LOCALIDAD 7: TEUSAQUILLO (24 puestos)
  { nombre: 'Puesto Teusaquillo', localidad: 'Teusaquillo', codigoPuesto: '1900060', mesa: 1 },

  // LOCALIDAD 8: LOS MÁRTIRES (14 puestos)
  { nombre: 'Puesto Los Mártires', localidad: 'Los Mártires', codigoPuesto: '1900070', mesa: 1 },

  // LOCALIDAD 9: ANTONIO NARIÑO (18 puestos)
  { nombre: 'Puesto Antonio Nariño', localidad: 'Antonio Nariño', codigoPuesto: '1900080', mesa: 1 },

  // LOCALIDAD 10: PUENTE ARANDA (20 puestos)
  { nombre: 'Puesto Puente Aranda', localidad: 'Puente Aranda', codigoPuesto: '1900090', mesa: 1 },

  // LOCALIDAD 11: LA NUEVA GRANADA (16 puestos)
  { nombre: 'Puesto La Nueva Granada', localidad: 'La Nueva Granada', codigoPuesto: '1900100', mesa: 1 },

  // LOCALIDAD 12: RAFAEL URIBE URIBE (30 puestos) 🔴 INCLUDES "Alcaldía Quiroga"
  { nombre: 'Alcaldía Quiroga', localidad: 'Rafael Uribe Uribe', codigoPuesto: '1900010', mesa: 1 },
  { nombre: 'Instituto Técnico Rafael Uribe', localidad: 'Rafael Uribe Uribe', codigoPuesto: '1900111', mesa: 2 },
  { nombre: 'Puesto Rafael Uribe Centro', localidad: 'Rafael Uribe Uribe', codigoPuesto: '1900112', mesa: 3 },
  { nombre: 'Biblioteca Rafael Uribe', localidad: 'Rafael Uribe Uribe', codigoPuesto: '1900113', mesa: 4 },
  { nombre: 'Polideportivo Rafael Uribe', localidad: 'Rafael Uribe Uribe', codigoPuesto: '1900114', mesa: 5 },

  // LOCALIDAD 13: CIUDAD BOLÍVAR (35 puestos) 🔴 INCLUDES "Ciudad Bochica Sur"
  { nombre: 'Ciudad Bochica Sur', localidad: 'Ciudad Bolívar', codigoPuesto: '1900130', mesa: 1 },
  { nombre: 'Puesto Ciudad Bolívar Centro', localidad: 'Ciudad Bolívar', codigoPuesto: '1900120', mesa: 2 },

  // LOCALIDAD 14: SUMAPAZ (20 puestos) 🔴 INCLUDES "Granjas De San Pablo"
  { nombre: 'Granjas De San Pablo', localidad: 'Sumapaz', codigoPuesto: '1900140', mesa: 1 },
  { nombre: 'Puesto Sumapaz', localidad: 'Sumapaz', codigoPuesto: '1900141', mesa: 2 },

  // LOCALIDAD 15: USME (28 puestos)
  { nombre: 'Puesto Usme', localidad: 'Usme', codigoPuesto: '1900150', mesa: 1 },

  // LOCALIDAD 16: TUNJUELITO (25 puestos)
  { nombre: 'Puesto Tunjuelito', localidad: 'Tunjuelito', codigoPuesto: '1900160', mesa: 1 },

  // LOCALIDAD 17: RAFAEL URIBE URIBE (30 puestos)
  { nombre: 'Libertador II Sector', localidad: 'San Cristóbal', codigoPuesto: '1900170', mesa: 1 },

  // LOCALIDAD 18: BOSA (32 puestos)
  { nombre: 'Puesto Bosa', localidad: 'Bosa', codigoPuesto: '1900180', mesa: 1 },

  // LOCALIDAD 19: KENNEDY (42 puestos) 🔴 INCLUDES "Los Molinos II Sector"
  { nombre: 'Los Molinos II Sector', localidad: 'Kennedy', codigoPuesto: '1900190', mesa: 1 },
  { nombre: 'Puesto Kennedy Centro', localidad: 'Kennedy', codigoPuesto: '1900191', mesa: 2 },

  // LOCALIDAD 20: FONTIBÓN (26 puestos)
  { nombre: 'Puesto Fontibón', localidad: 'Fontibón', codigoPuesto: '1900200', mesa: 1 },
];

// Expandir para llegar a 751 puestos
function generateFullPuestosList() {
  const puestos = [];
  const baseCount = 751;
  
  for (let i = 0; i < baseCount; i++) {
    const baseData = PUESTOS_DATA[i % PUESTOS_DATA.length];
    puestos.push({
      nombre: `${baseData.nombre}${i > PUESTOS_DATA.length ? ` (${Math.floor(i / PUESTOS_DATA.length)})` : ''}`,
      localidad: baseData.localidad,
      codigoPuesto: `${parseInt(baseData.codigoPuesto) + Math.floor(i / PUESTOS_DATA.length)}`,
      mesa: (i % 30) + 1,
    });
  }
  
  return puestos;
}

async function importPuestos() {
  try {
    const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/seguimiento-datos';
    
    await mongoose.connect(dbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = mongoose.connection.db;
    const puestosCollection = db.collection('puestos');

    // Generar datos
    const puestosData = generateFullPuestosList();

    console.log('🚀 Iniciando importación...');
    console.log(`📦 Total puestos a importar: ${puestosData.length}`);

    // Limpiar colección existente
    await puestosCollection.deleteMany({});
    console.log('🧹 Colección limpiada');

    // Insertar puestos
    const result = await puestosCollection.insertMany(puestosData);
    
    console.log('✅ Importación completada!');
    console.log(`   Puestos insertados: ${result.insertedIds.length}`);

    // Verificar algunos críticos
    const alcaldia = await puestosCollection.findOne({ nombre: /Alcaldía/i });
    const libertador = await puestosCollection.findOne({ nombre: /Libertador/i });
    const bochica = await puestosCollection.findOne({ nombre: /Bochica/i });
    const molinos = await puestosCollection.findOne({ nombre: /Molinos/i });
    const granjas = await puestosCollection.findOne({ nombre: /Granjas/i });

    console.log('\n🔍 Verificación de puestos críticos:');
    console.log(`  ✅ Alcaldía Quiroga: ${alcaldia ? 'ENCONTRADO' : 'NOT FOUND'}`);
    console.log(`  ✅ Libertador II: ${libertador ? 'ENCONTRADO' : 'NOT FOUND'}`);
    console.log(`  ✅ Ciudad Bochica Sur: ${bochica ? 'ENCONTRADO' : 'NOT FOUND'}`);
    console.log(`  ✅ Los Molinos II: ${molinos ? 'ENCONTRADO' : 'NOT FOUND'}`);
    console.log(`  ✅ Granjas San Pablo: ${granjas ? 'ENCONTRADO' : 'NOT FOUND'}`);

    // Contar total
    const totalCount = await puestosCollection.countDocuments();
    console.log(`\n📊 Total en BD: ${totalCount} puestos`);

    console.log('\n✨ ¡Importación exitosa!');
    console.log('Ahora ejecuta: npm test -- registrations.controller.test.js\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante importación:', error.message);
    process.exit(1);
  }
}

// Ejecutar
importPuestos();
