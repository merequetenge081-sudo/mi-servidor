import mongoose from 'mongoose';
import { Puestos } from './src/models/Puestos.js';

const mongoUrl = process.env.MONGO_URL || 'mongodb+srv://admin:m1s3rv1d0r@cluster0.mongodb.net/mi-servidor?retryWrites=true&w=majority';

async function verificar() {
  try {
    await mongoose.connect(mongoUrl);
    const count = await Puestos.countDocuments();
    console.log(`📊 Total de puestos en BD: ${count}`);
    
    if (count > 0) {
      const localidades = await Puestos.distinct('localidad');
      console.log(`📍 Localidades disponibles: ${localidades.length}`);
      localidades.forEach(l => console.log(`   - ${l}`));
    } else {
      console.log('⚠️  No hay puestos importados');
    }
    
    process.exit(0);
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
}

verificar();
