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

    const normalize = (str) => str ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';

    let added = 0;
    let updated = 0;

    const dbMap = new Map();
    for (const p of dbPuestos) {
      const key = normalize(p.nombre) + '|' + normalize(p.localidad);
      dbMap.set(key, p);
    }

    for (const local of localPuestos) {
      const key = normalize(local.nombre) + '|' + normalize(local.localidad);
      const existing = dbMap.get(key);

      if (existing) {
        let needsUpdate = false;
        const updateDoc = { $set: {} };

        if (local.codigoPuesto && existing.codigoPuesto !== local.codigoPuesto) {
          const dup = await collection.findOne({ codigoPuesto: local.codigoPuesto, _id: { $ne: existing._id } });
          if (!dup) {
            updateDoc.$set.codigoPuesto = local.codigoPuesto;
            needsUpdate = true;
          }
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
        let codigo = local.codigoPuesto;
        const dup = await collection.findOne({ codigoPuesto: codigo });
        if (dup) {
          codigo = local.codigoPuesto + '-' + normalize(local.localidad).substring(0, 3);
        }

        await collection.insertOne({
          codigoPuesto: codigo,
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
