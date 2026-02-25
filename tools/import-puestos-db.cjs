const { MongoClient } = require('mongodb');
const fs = require('fs');

async function run() {
  const uri = 'mongodb+srv://dubstepculture2013_db_user:nHb9xnzbKaEsNqUd@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?appName=seguimiento-datos';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('seguimiento-datos');
    const collection = db.collection('puestos');

    const dbPuestos = await collection.find({}).toArray();
    const localPuestos = JSON.parse(fs.readFileSync('tools/todos-puestos-consolidados.json', 'utf8'));

    console.log('Puestos en DB:', dbPuestos.length);
    console.log('Puestos en local:', localPuestos.length);

    const normalize = (str) => str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';

    let added = 0;
    let updated = 0;
    let duplicatesRemoved = 0;

    const dbMap = new Map();
    const toDelete = [];

    // 1. Eliminar duplicados en la DB
    for (const p of dbPuestos) {
      const key = normalize(p.nombre) + '|' + normalize(p.localidad);
      if (dbMap.has(key)) {
        toDelete.push(p._id);
        duplicatesRemoved++;
      } else {
        dbMap.set(key, p);
      }
    }

    if (toDelete.length > 0) {
      await collection.deleteMany({ _id: { $in: toDelete } });
      console.log('Eliminados duplicados en DB:', toDelete.length);
    }

    // 2. Importar y actualizar
    for (const local of localPuestos) {
      const key = normalize(local.nombre) + '|' + normalize(local.localidad);
      const existing = dbMap.get(key);

      if (existing) {
        let needsUpdate = false;
        const updateDoc = { $set: {} };

        if (local.codigoPuesto && existing.codigoPuesto !== local.codigoPuesto) {
          updateDoc.$set.codigoPuesto = local.codigoPuesto;
          needsUpdate = true;
        }
        if (local.direccion && existing.direccion !== local.direccion) {
          updateDoc.$set.direccion = local.direccion;
          needsUpdate = true;
        }

        const newAliases = local.aliases || [];
        const existingAliases = existing.aliases || [];
        const mergedAliases = [...new Set([...existingAliases, ...newAliases])];

        if (mergedAliases.length > existingAliases.length) {
          updateDoc.$set.aliases = mergedAliases;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await collection.updateOne({ _id: existing._id }, updateDoc);
          updated++;
        }
      } else {
        await collection.insertOne({
          codigoPuesto: local.codigoPuesto,
          nombre: local.nombre,
          localidad: local.localidad,
          direccion: local.direccion,
          mesas: local.mesas || [],
          aliases: local.aliases || [],
          activo: true,
          fuente: 'CSV_TODAS_LOCALIDADES_2026',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        added++;
        dbMap.set(key, local);
      }
    }

    console.log('Nuevos agregados:', added);
    console.log('Actualizados (alias/codigo/direccion):', updated);

  } finally {
    await client.close();
  }
}

run().catch(console.dir);
