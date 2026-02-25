import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

const csvPath = 'C:\\Users\\Janus\\Downloads\\300 ppp\\CVS';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  console.log('📂 Leyendo CSVs de localidades...\n');

  // 1. Leer todos los CSVs
  const files = fs.readdirSync(csvPath).filter(f => f.endsWith('.csv'));
  console.log(`✅ Encontrados ${files.length} archivos CSV\n`);

  const allRecords = [];
  const summary = {};

  for (const file of files) {
    const localidad = file.replace('_Puestos_Completo.csv', '');
    const filePath = path.join(csvPath, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    try {
      const records = parse(content, {
        columns: true,
        skip_empty_lines: true
      });
      
      console.log(`📄 ${localidad}: ${records.length} puestos`);
      summary[localidad] = records.length;
      
      // Agregar localidad a cada registro
      records.forEach(r => {
        r.localidad = localidad;
        allRecords.push(r);
      });
    } catch (err) {
      console.log(`⚠️  Error en ${file}: ${err.message}`);
    }
  }

  console.log(`\n📊 Total combinado: ${allRecords.length} puestos`);

  // 2. Comparar con BD
  console.log('\n🔍 Comparando con BD...\n');
  
  const currentBD = await Puestos.countDocuments();
  console.log(`BD actual: ${currentBD} puestos`);

  // 3. Buscar faltantes
  const missing = [];
  const existentes = [];

  for (const rec of allRecords) {
    const nombre = rec['Nombre del Puesto']?.trim();
    if (!nombre) continue;

    const existe = await Puestos.findOne({
      nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }).lean();

    if (existe) {
      existentes.push({ nombre });
    } else {
      missing.push({
        nombre: nombre,
        localidad: rec.localidad,
        direccion: rec['Dirección'] || '',
        codigoOriginal: rec['Código'] || ''
      });
    }
  }

  console.log(`✅ Existentes en BD: ${existentes.length}`);
  console.log(`❌ Faltantes en BD: ${missing.length}`);

  // 4. Mostrar faltantes
  if (missing.length > 0) {
    console.log(`\n📋 Primeros 20 faltantes:`);
    missing.slice(0, 20).forEach((m, i) => {
      console.log(`   ${i + 1}. [${m.localidad}] ${m.nombre}`);
    });

    // Buscar CIUDAD BOCHICA SUR específicamente
    const bochica = missing.find(m => m.nombre.toUpperCase().includes('BOCHICA'));
    if (bochica) {
      console.log(`\n🎯 CIUDAD BOCHICA SUR ENCONTRADO:`);
      console.log(`   [${bochica.localidad}] ${bochica.nombre}`);
      console.log(`   Dirección: ${bochica.direccion}`);
    }

    // Guardar lista completa
    const outPath = './tools/faltantes-nuevos-csv.json';
    fs.writeFileSync(outPath, JSON.stringify(missing, null, 2));
    console.log(`\n💾 Lista completa guardada: ${outPath}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
