import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Puestos } from '../src/models/Puestos.js';
import dotenv from 'dotenv';

dotenv.config();

// Rafael Uribe Uribe = Localidad 19, código 19
const LOCALIDAD_CODE = '19';
const NOMBRE_LOCALIDAD = 'Rafael Uribe Uribe';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://usuario:PqfSRXzEY4V6zrHQ@seguimientos.p0rrg.mongodb.net/seguimiento-datos?retryWrites=true&w=majority';

async function importRafaelUribeCSV() {
  try {
    console.log('📂 Importando CSV de Rafael Uribe Uribe...\n');

    // Conectar a MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Leer el CSV
    const csvPath = 'C:/Users/Janus/Downloads/300 ppp/CVS/RafaelUribeUribe_Puestos_Completo.csv';
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ Archivo no encontrado:', csvPath);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());

    // Skip header
    const puestosData = [];
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;

      // Parse CSV (simple split by ;)
      const parts = line.split(';');
      if (parts.length < 2) {
        skipped++;
        continue;
      }

      const localidad = parts[0].trim();
      const nombre = parts[1].trim();
      const direccion = parts[2] ? parts[2].trim() : '';

      if (localidad !== NOMBRE_LOCALIDAD || !nombre) {
        skipped++;
        continue;
      }

      puestosData.push({
        localidad,
        nombre,
        direccion
      });
    }

    console.log(`📋 Puestos leídos: ${puestosData.length}`);
    console.log(`⏭️  Líneas saltadas: ${skipped}\n`);

    // Verificar cuáles ya existen en BD
    const existentes = [];
    const nuevos = [];

    for (const puesto of puestosData) {
      const existe = await Puestos.findOne({
        nombre: puesto.nombre,
        localidad: puesto.localidad
      }).lean();

      if (existe) {
        existentes.push(puesto.nombre);
      } else {
        nuevos.push(puesto);
      }
    }

    console.log(`✅ Ya existen en BD: ${existentes.length}`);
    console.log(`🆕 Nuevos para importar: ${nuevos.length}\n`);

    if (existentes.length > 0) {
      console.log('Ya existen:');
      existentes.forEach(n => console.log(`  - ${n}`));
      console.log();
    }

    if (nuevos.length === 0) {
      console.log('✅ Todos los puestos ya están en la BD');
      await mongoose.connection.close();
      process.exit(0);
    }

    // Generar codigoPuesto para nuevos
    // Formato: CCmmmmm (localidad + 5 dígitos secuenciales)
    const bulkOps = [];
    let counter = 1;

    for (const puesto of nuevos) {
      const codigoPuesto = `${LOCALIDAD_CODE}${String(counter).padStart(5, '0')}`;
      
      bulkOps.push({
        insertOne: {
          document: {
            codigoPuesto,
            nombre: puesto.nombre,
            localidad: puesto.localidad,
            direccion: puesto.direccion,
            mesas: [],
            aliases: [],
            organizationId: null,
            activo: true,
            fuente: 'CSV_RAFAEL_URIBE_2026'
          }
        }
      });

      counter++;
    }

    console.log(`🔄 Preparando bulk insert de ${bulkOps.length} documentos...\n`);

    if (bulkOps.length > 0) {
      const result = await Puestos.bulkWrite(bulkOps);
      console.log(`✅ Insertados: ${result.insertedCount}`);
    }

    // Contar total en BD
    const totalPuestos = await Puestos.countDocuments();
    console.log(`📊 Total en BD: ${totalPuestos}\n`);

    console.log('🎉 Importación completada');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

importRafaelUribeCSV();
