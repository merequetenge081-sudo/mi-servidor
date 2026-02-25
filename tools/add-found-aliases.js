import fs from 'fs';
import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  // Mapping manual de nombres no-oficiales a puestos reales
  const aliasMapping = [
    // Rafael Uribe Uribe
    {
      original: 'Colegio Distrital El Libertador Sede B',
      aliases: ['Libertador II', 'El Libertador B']
    },
    {
      original: 'Colegio Distrital Restrepo Millán - Sede B',
      aliases: ['Restrepo B']
    },
    // San Cristóbal
    {
      original: 'Colegio San Vicente I.D.E.',
      aliases: ['San Vicente Colsubsidio', 'San Vicente']
    }
  ];

  console.log('🔄 Agregando aliases a puestos existentes...\n');

  let updated = 0;
  for (const mapping of aliasMapping) {
    const puesto = await Puestos.findOne({ nombre: { $regex: mapping.original.substring(0, 30), $options: 'i' } });
    if (puesto) {
      console.log(`✅ Encontrado: [${puesto.localidad}] ${puesto.nombre}`);
      console.log(`   Agregando aliases:`, mapping.aliases.join(', '));
      
      // Evitar duplicados
      const newAliases = mapping.aliases.filter(a => !puesto.aliases.includes(a));
      await Puestos.updateOne(
        { _id: puesto._id },
        { $push: { aliases: { $each: newAliases } } }
      );
      updated++;
    } else {
      console.log(`❌ No encontrado: ${mapping.original}`);
    }
  }

  console.log(`\n✅ Puestos actualizados: ${updated}/${aliasMapping.length}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
