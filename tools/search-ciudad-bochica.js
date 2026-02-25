import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);

    // Buscar exacta
    const exacta = await Puestos.findOne({
      nombre: 'CIUDAD BOCHICA SUR'
    }).lean();

    if (exacta) {
      console.log('✅ ENCONTRADO (EXACTO):');
      console.log(`  Nombre: ${exacta.nombre}`);
      console.log(`  Localidad: ${exacta.localidad}`);
      console.log(`  Código: ${exacta.codigoPuesto}`);
      console.log(`  Dirección: ${exacta.direccion}`);
    } else {
      console.log('❌ NO ENCONTRADO (búsqueda exacta)');
      
      // Buscar con regex
      console.log('\n🔍 Buscando variantes similares...\n');
      const similares = await Puestos.find({
        nombre: { $regex: 'BOCHICA', $options: 'i' }
      }).lean();
      
      if (similares.length > 0) {
        console.log(`✅ ENCONTRADAS ${similares.length} variantes:`);
        similares.forEach(p => {
          console.log(`  - [${p.localidad}] ${p.nombre}`);
        });
      } else {
        console.log('❌ NO HAY VARIANTES DE BOCHICA');
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

run();
