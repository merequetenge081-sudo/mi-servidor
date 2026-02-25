import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';

const csvPath = 'C:\\Users\\Janus\\Downloads\\Bogota_Puestos_Votacion_2019_COMPLETO.csv';
const puestosJsonPath = './tools/puestos-actualizados.json';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGO_URL);

  // 1. Leer CSV
  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const csvRecords = parse(csvContent, {
    columns: ['Localidad', 'Nombre del Puesto', 'Dirección'],
    skip_empty_lines: true,
    from_line: 2
  });

  console.log(`📊 Total puestos en CSV: ${csvRecords.length}`);

  // 2. Leer JSON actual
  const jsonData = JSON.parse(fs.readFileSync(puestosJsonPath, 'utf8'));
  const nameSet = new Set(jsonData.map(p => p.nombre.toLowerCase().trim()));

  // 3. Comparar
  const missing = [];
  const existingWithDifferentNames = [];

  for (const record of csvRecords) {
    const csvNombre = record['Nombre del Puesto'].trim();
    const csvLocalidad = record['Localidad'].trim();
    const csvLower = csvNombre.toLowerCase();

    const inJson = jsonData.find(p => 
      p.nombre.toLowerCase() === csvLower || 
      (Array.isArray(p.aliases) && p.aliases.some(a => a.toLowerCase() === csvLower))
    );

    if (!inJson) {
      missing.push({
        nombre: csvNombre,
        localidad: csvLocalidad,
        direccion: record['Dirección']
      });
    }
  }

  console.log(`\n📋 Puestos FALTANTES en JSON: ${missing.length}`);
  if (missing.length > 0) {
    console.log('--- Primeros 20 ---');
    missing.slice(0, 20).forEach(m => {
      console.log(`  - [${m.localidad}] ${m.nombre}`);
    });
    
    const outPath = './tools/puestos-faltantes-comparacion.json';
    fs.writeFileSync(outPath, JSON.stringify(missing, null, 2));
    console.log(`\n🧾 Detalle completo: ${outPath}`);
  }

  // 4. Sugerencias de aliases
  console.log('\n🔍 Analizando posibles aliases faltantes...');
  
  const suggestions = [];
  for (const record of csvRecords) {
    const csvNombre = record['Nombre del Puesto'].trim();
    const csvLocalidad = record['Localidad'].trim();
    const csvLower = csvNombre.toLowerCase();

    const inJson = jsonData.find(p => p.localidad.toLowerCase() === csvLocalidad.toLowerCase());
    
    if (inJson && !inJson.nombre.toLowerCase().includes(csvLower) && 
        !inJson.sitio?.toLowerCase().includes(csvLower) &&
        !(Array.isArray(inJson.aliases) && inJson.aliases.some(a => a.toLowerCase() === csvLower))) {
      
      suggestions.push({
        jsonNombre: inJson.nombre,
        csvNombre,
        csvLocalidad,
        codigoPuesto: inJson.codigoPuesto
      });
    }
  }

  if (suggestions.length > 0) {
    console.log(`\n💡 Posibles aliases a agregar: ${suggestions.length}`);
    console.log('--- Primeros 20 ---');
    suggestions.slice(0, 20).forEach(s => {
      console.log(`  - [${s.csvLocalidad}] "${s.csvNombre}" → "${s.jsonNombre}"`);
    });

    const outPath = './tools/aliases-sugeridas.json';
    fs.writeFileSync(outPath, JSON.stringify(suggestions, null, 2));
    console.log(`\n🧾 Detalle: ${outPath}`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
