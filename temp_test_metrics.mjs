import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { Registration } from './src/models/Registration.js';
import { Puestos } from './src/models/Puestos.js';
import { getDashboardMetrics } from './src/services/metrics.service.js';

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected');
  const metrics = await getDashboardMetrics();
  console.log('Totals:', metrics.totals);
  
  // also let's look at some docs
  const sample = await Registration.aggregate([
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
    { $limit: 10 },
    { $project: { _id: 0, localidad: 1, 'puesto.localidad': 1, localidadResolved: 1, departamento: 1 } }
  ]);
  
  console.log('Sample:', sample);
  process.exit(0);
}

test();
