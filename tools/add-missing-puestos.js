import fs from 'fs';
import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

const faltantesPath = './tools/puestos-faltantes-comparacion.json';
const puestosJsonPath = './tools/puestos-actualizados.json';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

// Map de localidades a códigos
const localidadCodes = {
  'Usaquén': '01',
  'Chapinero': '02',
  'Santa Fe': '03',
  'San Cristóbal': '04',
  'Usme': '05',
  'Tunjuelito': '06',
  'Bosa': '07',
  'Kennedy': '08',
  'Fontibón': '09',
  'Fontibon': '09',
  'Engativá': '10',
  'Suba': '11',
  'Barrios Unidos': '12',
  'Teusaquillo': '13',
  'Los Mártires': '14',
  'La Candelaria': '15',
  'Puente Aranda': '16',
  'La Sabana': '17',
  'Buenavista': '18',
  'Rafael Uribe Uribe': '19',
  'Ciudad Bolívar': '20'
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  // 1. Leer faltantes
  const faltantes = JSON.parse(fs.readFileSync(faltantesPath, 'utf8'));
  const actual = JSON.parse(fs.readFileSync(puestosJsonPath, 'utf8'));

  console.log(`📊 Puestos faltantes: ${faltantes.length}`);

  // 2. Buscar max código actual para generar nuevos
  let maxNum = 99999;
  actual.forEach(p => {
    if (p.codigoPuesto) {
      const num = parseInt(p.codigoPuesto.substring(6));
      if (num > maxNum) maxNum = num;
    }
  });

  console.log(`🔢 Próximo código será: ${maxNum + 1}`);

  // 3. Generar nuevos puestos
  const newPuestos = faltantes.map((f, idx) => {
    const codigoLocalidad = localidadCodes[f.localidad] || '00';
    const numPuesto = String(maxNum + idx + 1).padStart(5, '0');
    const codigoPuesto = `${codigoLocalidad}${numPuesto}`;

    return {
      codigoPuesto,
      nombre: f.nombre,
      localidad: f.localidad,
      direccion: f.direccion,
      mesas: [1], // Solo mesa 1 por defecto
      aliases: [],
      activo: true,
      fuente: "CSV_OFICIAL_2019"
    };
  });

  console.log(`\n✅ Generados ${newPuestos.length} nuevos puestos`);
  console.log('--- Primeros 5 ---');
  newPuestos.slice(0, 5).forEach(p => {
    console.log(`  - [${p.localidad}] ${p.nombre} (${p.codigoPuesto})`);
  });

  // 4. Insertar en BD con bulkWrite
  console.log(`\n📥 Insertando en BD...`);
  try {
    const ops = newPuestos.map(p => ({
      updateOne: {
        filter: { codigoPuesto: p.codigoPuesto },
        update: { $set: p },
        upsert: true
      }
    }));
    
    const result = await Puestos.bulkWrite(ops);
    console.log(`✅ Insertados: ${result.upsertedCount}, Actualizados: ${result.modifiedCount}`);
  } catch (error) {
    console.error('❌ Error en inserción:', error.message);
    process.exit(1);
  }

  // 5. Actualizar JSON
  const updated = [...actual, ...newPuestos];
  fs.writeFileSync(puestosJsonPath, JSON.stringify(updated, null, 2));
  console.log(`\n💾 JSON actualizado: ${updated.length} puestos totales`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
