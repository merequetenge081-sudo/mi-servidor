import fs from 'fs';
import { MongoClient } from 'mongodb';

async function importDirectToMongo() {
  const client = new MongoClient('mongodb+srv://usuario:PqfSRXzEY4V6zrHQ@seguimientos.p0rrg.mongodb.net/seguimiento-datos?retryWrites=true&w=majority');
  
  try {
    console.log('🔗 Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado\n');

    const db = client.db('seguimiento-datos');
    const puestosCollection = db.collection('puestos');

    // Leer JSON
    const puestos = JSON.parse(fs.readFileSync('./tools/rafael-uribe-nuevos.json', 'utf-8'));
    console.log(`📊 Puestos a importar: ${puestos.length}\n`);

    // Insertar
    const result = await puestosCollection.insertMany(puestos, { ordered: false });
    console.log(`✅ Insertados: ${result.insertedCount}\n`);

    // Contar total
    const total = await puestosCollection.countDocuments();
    console.log(`📊 Total en BD: ${total}\n`);

    console.log('🎉 Importación completada!');

  } catch (error) {
    if (error.code === 11000) {
      console.warn('⚠️  Algunos documentos ya existen (duplicados), insertando solo los nuevos...');
      
      // Intentar con upsert individual
      const puestos = JSON.parse(fs.readFileSync('./tools/rafael-uribe-nuevos.json', 'utf-8'));
      const puestosCollection = client.db('seguimiento-datos').collection('puestos');
      
      let inserted = 0;
      for (const puesto of puestos) {
        try {
          const result = await puestosCollection.updateOne(
            { codigoPuesto: puesto.codigoPuesto },
            { $set: puesto },
            { upsert: true }
          );
          if (result.upsertedId) inserted++;
        } catch (e) {
          // Skip individual errors
        }
      }
      
      console.log(`✅ Insertados: ${inserted}\n`);
      const total = await puestosCollection.countDocuments();
      console.log(`📊 Total en BD: ${total}\n`);
      console.log('🎉 Importación completada!');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await client.close();
    process.exit(0);
  }
}

importDirectToMongo();
