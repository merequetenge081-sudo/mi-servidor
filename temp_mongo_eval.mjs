import mongoose from 'mongoose';
import { Registration } from './src/models/Registration.js';

async function run() {
  await mongoose.connect('mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos');

  const bogotaLocalidadesUpper = [
    "USAQUEN", "CHAPINERO", "SANTA FE", "SAN CRISTOBAL", "USME", "TUNJUELITO",
    "BOSA", "KENNEDY", "FONTIBON", "ENGATIVA", "SUBA", "BARRIOS UNIDOS",
    "TEUSAQUILLO", "LOS MARTIRES", "ANTONIO NARINO", "PUENTE ARANDA",
    "LA CANDELARIA", "RAFAEL URIBE URIBE", "CIUDAD BOLIVAR", "SUMAPAZ"
  ];
  
  const expr = { $trim: { input: { $toUpper: { $ifNull: ["$localidadResolved", ""] } } } };
  let replacedExpr = expr;
  const replacements = [
    { find: "Á", replacement: "A" }, { find: "É", replacement: "E" },
    { find: "Í", replacement: "I" }, { find: "Ó", replacement: "O" },
    { find: "Ú", replacement: "U" }, { find: "Ü", replacement: "U" },
    { find: "Ñ", replacement: "N" },
    { find: "á", replacement: "A" }, { find: "é", replacement: "E" },
    { find: "í", replacement: "I" }, { find: "ó", replacement: "O" },
    { find: "ú", replacement: "U" }, { find: "ü", replacement: "U" },
    { find: "ñ", replacement: "N" }
  ];
  replacements.forEach((rule) => {
    replacedExpr = { $replaceAll: { input: replacedExpr, find: rule.find, replacement: rule.replacement } };
  });

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
        localidadResolved: { $ifNull: ["$puesto.localidad", "$localidad"] }
      }
    },
    {
      $project: {
        original: "$localidadResolved",
        normalized: replacedExpr
      }
    }
  ]);

  const missesMap = {};
  let misses = 0;
  for (const s of sample) {
    if (!bogotaLocalidadesUpper.includes(s.normalized)) {
      missesMap[s.normalized] = (missesMap[s.normalized] || 0) + 1;
      misses++;
    }
  }
  console.log('Misses Map:', missesMap);
  console.log('Total Mongo misses:', misses);
  process.exit(0);
}
run();