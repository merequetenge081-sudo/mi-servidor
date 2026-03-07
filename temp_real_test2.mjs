import mongoose from 'mongoose';
import { Registration } from './src/models/Registration.js';

async function run() {
  await mongoose.connect('mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos');

  const sample = await Registration.aggregate([
    { $match: { leaderName: /Adonay/i } },
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
        _id: 1,
        localidadResolved: 1,
        departamento: 1,
        'puesto.departamento': 1
      }
    }
  ]);

  const BOGOTA_LOCALIDADES = [
    "Usaquén", "Chapinero", "Santa Fe", "San Cristóbal", "Usme", "Tunjuelito",
    "Bosa", "Kennedy", "Fontibón", "Engativá", "Suba", "Barrios Unidos",
    "Teusaquillo", "Los Mártires", "Antonio Nariño", "Puente Aranda",
    "La Candelaria", "Rafael Uribe Uribe", "Ciudad Bolívar", "Sumapaz"
  ];

  const BOGOTA_LOCALIDADES_NORMALIZED_UPPER = BOGOTA_LOCALIDADES.map((l) =>
    l.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
  );

  let misses = 0;
  for (const s of sample) {
    let loc = (s.localidadResolved || "").toString().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ñ/g, "N").toUpperCase();
    if (!BOGOTA_LOCALIDADES_NORMALIZED_UPPER.includes(loc)) {
      console.log('Miss:', `'${loc}'`, s);
      misses++;
    }
  }
  
  console.log('Total misses out of', sample.length, 'is', misses);
  process.exit(0);
}
run();