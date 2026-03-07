import mongoose from 'mongoose';
import 'dotenv/config';

import { Registration } from './src/models/Registration.js';
import { Leader } from './src/models/Leader.js';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');

  const adonay = await Leader.findOne({ name: /Adonay/i });
  console.log('Adonay ID:', adonay._id, adonay.leaderId);

  const sample = await Registration.aggregate([
    { $match: { leaderId: adonay._id.toString() } },
    {
      $lookup: {
        from: "puestos",
        localField: "puestoId",
        foreignField: "_id",
        as: "puesto"
      }
    },
    { $addFields: { puesto: { $arrayElemAt: ["$puesto", 0] } } },
    {
      $addFields: {
        localidadResolved: {
          $ifNull: ["$puesto.localidad", "$localidad"]
        }
      }
    },
    {
      $project: {
        _id: 0,
        localidad: 1,
        'puesto.localidad': 1,
        'puesto.departamento': 1,
        'puesto.ciudad': 1,
        departamento: 1,
        localidadResolved: 1
      }
    }
  ]);

  const map = {};
  for (const s of sample) {
    const key = `RegLoc: ${s.localidad}, PtsLoc: ${s.puesto?.localidad}, PtsDepto: ${s.puesto?.departamento}, PtsCiudad: ${s.puesto?.ciudad}, RegDepto: ${s.departamento}, Resolved: ${s.localidadResolved}`;
    map[key] = (map[key] || 0) + 1;
  }
  
  console.log(map);

  process.exit(0);
}

run();