import fs from 'fs';
import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  const faltantes = JSON.parse(fs.readFileSync('./tools/faltantes-nuevos-csv.json', 'utf8'));

  console.log(`📥 Importando ${faltantes.length} puestos faltantes...\n`);

  // Mapeo de localidades a códigos
  const localidadCodes = {
    'AntonioNarino': '15',
    'BarriosUnidos': '12',
    'Bosa': '07',
    'Chapinero': '02',
    'CiudadBolivar': '20',
    'Engativa': '10',
    'Fontibon': '09',
    'Kennedy': '08',
    'LaCandelaria': '17',
    'Martires': '14',
    'PuenteAranda': '16',
    'RafaelUribeUribe': '19',
    'SanCristobal': '04',
    'SantaFe': '03',
    'Suba': '11',
    'Sumapaz': '21', // Sumapaz no es una localidad tradicional, usar código especial
    'Teusaquillo': '13',
    'Tunjuelito': '06',
    'Usaquen': '01',
    'Usme': '05'
  };

  let maxNum = 0;
  const existing = await Puestos.find().select('codigoPuesto').lean();
  existing.forEach(p => {
    if (p.codigoPuesto) {
      const num = parseInt(p.codigoPuesto.substring(2));
      if (num > maxNum) maxNum = num;
    }
  });

  console.log(`🔢 Próximo código base: ${maxNum + 1}\n`);

  // Generar documentos
  const newPuestos = faltantes.map((f, idx) => {
    const codigoLocalidad = localidadCodes[f.localidad] || '00';
    const numPuesto = String(maxNum + idx + 1).padStart(5, '0');
    const codigoPuesto = `${codigoLocalidad}${numPuesto}`;

    return {
      codigoPuesto,
      nombre: f.nombre,
      localidad: f.localidad,
      direccion: f.direccion || '',
      mesas: [1],
      aliases: [],
      activo: true,
      fuente: 'CSV_LOCALIDADES_2026'
    };
  });

  console.log(`✅ Generados ${newPuestos.length} documentos con estructura MongoDB`);
  console.log(`   Primeros 3 ejemplos:`);
  newPuestos.slice(0, 3).forEach(p => {
    console.log(`   - [${p.localidad}] ${p.nombre} (${p.codigoPuesto})`);
  });

  // Insertar con bulkWrite
  console.log(`\n📥 Insertando en BD...\n`);

  const ops = newPuestos.map(p => ({
    updateOne: {
      filter: { codigoPuesto: p.codigoPuesto },
      update: { $set: p },
      upsert: true
    }
  }));

  const result = await Puestos.bulkWrite(ops);
  console.log(`✅ Insertados: ${result.upsertedCount}`);
  console.log(`✅ Totales en BD: ${await Puestos.countDocuments()}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
