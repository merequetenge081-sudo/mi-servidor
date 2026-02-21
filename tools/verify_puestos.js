/**
 * Script para verificar que los puestos han sido importados correctamente
 * 
 * Uso: node tools/verify_puestos.js
 */

import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor?retryWrites=true&w=majority';

async function verificar() {
  try {
    await mongoose.connect(mongoUrl, {
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4
    });
    console.log('📍 Conectado a MongoDB');

    const count = await Puestos.countDocuments();
    console.log(`📊 Total de puestos en BD: ${count}`);
    
    if (count > 0) {
      // Estadísticas por localidad
      const stats = await Puestos.aggregate([
        {
          $group: {
            _id: "$localidad",
            count: { $sum: 1 },
            totalMesas: { $sum: { $size: "$mesas" } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      console.log("\n📊 Estadísticas por localidad:");
      console.log("═══════════════════════════════════════════════════════");
      
      let totalMesas = 0;
      stats.forEach(stat => {
        console.log(`  ${stat._id.padEnd(25)} → ${stat.count.toString().padStart(3)} puesto(s) | ${stat.totalMesas.toString().padStart(3)} mesa(s)`);
        totalMesas += stat.totalMesas;
      });
      
      console.log("═══════════════════════════════════════════════════════");
      console.log(`  TOTAL: ${count} puestos | ${totalMesas} mesas`);
      console.log("═══════════════════════════════════════════════════════\n");

      // Mostrar ejemplo
      const ejemplo = await Puestos.findOne();
      console.log("📋 Ejemplo de puesto:");
      console.log(JSON.stringify(ejemplo.toObject(), null, 2));
    } else {
      console.log('⚠️  No hay puestos importados');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

// Ejecutar el script
verificar();
