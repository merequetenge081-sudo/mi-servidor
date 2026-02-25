import fs from 'fs';

async function checkForDuplicates() {
  try {
    console.log('🔍 Analizando duplicados...\n');
    
    // Leer JSON consolidado
    const consolidated = JSON.parse(fs.readFileSync('./tools/todos-puestos-consolidados.json', 'utf-8'));
    console.log(`📊 Puestos en JSON: ${consolidated.length}\n`);
    
    // Leer el JSON anterior (Rafael Uribe + faltantes)
    const previous = JSON.parse(fs.readFileSync('./tools/rafael-uribe-nuevos.json', 'utf-8'));
    const previousNames = new Set(previous.map(p => `${p.nombre}|${p.localidad}`));
    
    console.log(`📋 Puestos anteriores: ${previous.length}\n`);
    
    // Agrupar consolidado por nombre+localidad para detectar duplicados internos
    const nameMap = {};
    const duplicates = [];
    
    for (const puesto of consolidated) {
      const key = `${puesto.nombre}|${puesto.localidad}`;
      
      if (nameMap[key]) {
        duplicates.push(key);
      } else {
        nameMap[key] = puesto;
      }
    }
    
    console.log(`⚠️  Duplicados internos en CSV: ${duplicates.length}`);
    if (duplicates.length > 0 && duplicates.length <= 10) {
      duplicates.forEach(dup => console.log(`  - ${dup}`));
    }
    console.log();
    
    // Puestos nuevos (no en Rafael Uribe)
    const nuevos = [];
    for (const puesto of consolidated) {
      const key = `${puesto.nombre}|${puesto.localidad}`;
      if (!previousNames.has(key)) {
        nuevos.push(puesto);
      }
    }
    
    console.log(`✅ Puestos nuevos (no en Rafael Uribe): ${nuevos.length}`);
    console.log(`♻️  Puestos ya verificados: ${consolidated.length - nuevos.length}\n`);
    
    // Guardar solo los nuevos
    if (nuevos.length > 0) {
      fs.writeFileSync('./tools/puestos-nuevos-all.json', JSON.stringify(nuevos, null, 2));
      console.log(`✅ Guardados en: tools/puestos-nuevos-all.json`);
    }
    
    console.log(`\n📈 Incremento estimado: ${consolidated.length} puestos totales`);
    console.log(`   (+${consolidated.length - previous.length} sobre Rafael Uribe)`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkForDuplicates();
