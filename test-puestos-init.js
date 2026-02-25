/**
 * Script de prueba - Verificar inicialización de Puestos
 */

import mongoose from 'mongoose';
import { Puestos } from './src/models/index.js';

async function test() {
  console.log('📍 Prueba de Inicialización de Puestos');
  console.log('═'.repeat(55));
  
  const MONGO_URL = process.env.MONGO_URL || 'mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor?retryWrites=true&w=majority';
  
  try {
    console.log('🔗 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 15000,
      family: 4
    });
    console.log('✅ Conectado a MongoDB');
    
    const count = await Puestos.countDocuments();
    console.log('\n📊 Puestos actuales en BD: ' + count);
    
    if (count === 0) {
      console.log('⚠️  No hay puestos - la colección está vacía');
      console.log('El servidor hará la importación automática cuando inicie');
    } else {
      console.log('✅ Puestos importados correctamente!');
      
      // Mostrar estadísticas
      const stats = await Puestos.aggregate([
        { $group: { _id: '$localidad', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      console.log('\n📍 Por Localidad:');
      stats.forEach(s => {
        console.log('  • ' + s._id + ': ' + s.count + ' puestos');
      });
      
      // Verificar específicos
      const salitre = await Puestos.findOne({ nombre: /salitre/i });
      const provinma = await Puestos.findOne({ nombre: /provinma/i });
      
      console.log('\n🔍 Verificación Específica:');
      console.log('  El Salitre: ' + (salitre ? '✅ Encontrado en ' + salitre.localidad : '❌ No encontrado'));
      console.log('  Colegio Provinma: ' + (provinma ? '✅ Encontrado en ' + provinma.localidad : '❌ No encontrado'));
    }
    
  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
    console.log('\n⚠️  No hay acceso a MongoDB (esperado sin acceso remoto)');
    console.log('Los puestos se importarán automáticamente en Render cuando despliegues');
  } finally {
    await mongoose.disconnect();
  }
  
  process.exit(0);
}

test();
