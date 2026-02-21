import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import { Registration } from '../src/models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env desde raíz del proyecto
dotenv.config({ path: join(__dirname, '..', '.env') });

const checkRevisionStatus = async () => {
  try {
    console.log('🔍 Verificando estado de revisión...\n');
    
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB\n');

    // Contar registros con revisión pendiente
    const totalConRevision = await Registration.countDocuments({ 
      requiereRevisionPuesto: true,
      revisionPuestoResuelta: false
    });

    console.log(`📊 Registros con revisión pendiente: ${totalConRevision}\n`);

    if (totalConRevision > 0) {
      // Obtener un ejemplo
      const ejemplo = await Registration.findOne({ 
        requiereRevisionPuesto: true,
        revisionPuestoResuelta: false
      }).select('firstName lastName cedula leaderId requiereRevisionPuesto revisionPuestoResuelta votingPlace').lean();

      console.log('📋 Ejemplo de registro con revisión pendiente:');
      console.log(JSON.stringify(ejemplo, null, 2));
      console.log('\n');

      // Agrupar por líder
      const porLider = await Registration.aggregate([
        { 
          $match: { 
            requiereRevisionPuesto: true,
            revisionPuestoResuelta: false
          }
        },
        {
          $group: {
            _id: '$leaderId',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      console.log('👥 Top 10 líderes con más registros para revisar:');
      porLider.forEach(item => {
        console.log(`  - Líder ${item._id}: ${item.count} registros`);
      });
    }

    await mongoose.connection.close();
    console.log('\n✅ Proceso completado');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkRevisionStatus();
