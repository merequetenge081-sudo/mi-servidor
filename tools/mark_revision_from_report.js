import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { readFileSync } from 'fs';
import { Registration } from '../src/models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env desde raíz del proyecto
dotenv.config({ path: join(__dirname, '..', '.env') });

const markRevisionFromReport = async () => {
  try {
    console.log('🔧 Marcando registros que requieren revisión de puesto...');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB');

    // Leer reporte
    const reportPath = join(__dirname, 'standardize_report.json');
    const report = JSON.parse(readFileSync(reportPath, 'utf-8'));

    // Filtrar solo los que están "review"
    const reviewIds = report
      .filter(item => item.action === 'review')
      .map(item => item.id);

    console.log(`📋 Registros para marcar como revisión: ${reviewIds.length}`);

    // Marcar en DB
    const result = await Registration.updateMany(
      { _id: { $in: reviewIds } },
      { 
        $set: { 
          requiereRevisionPuesto: true,
          revisionPuestoResuelta: false
        } 
      }
    );

    console.log(`✅ Registros marcados: ${result.modifiedCount}`);

    // Limpiar flag de registros que YA NO están en revisión
    const allReportIds = report.map(item => item.id);
    const clearResult = await Registration.updateMany(
      { 
        _id: { $in: allReportIds },
        requiereRevisionPuesto: true,
        _id: { $nin: reviewIds }
      },
      { 
        $set: { 
          requiereRevisionPuesto: false
        } 
      }
    );

    console.log(`✅ Flags de revisión limpiados (ya resueltos): ${clearResult.modifiedCount}`);

    await mongoose.connection.close();
    console.log('✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

markRevisionFromReport();
