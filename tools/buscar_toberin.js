import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer GEOJSON
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'pvo.geojson'), 'utf8'));

console.log('\n🔍 BUSCANDO PUESTO 29 / TOBERIN...\n');

// Buscar por varios patrones
const buscar = (patron) => {
  let resultados = [];
  data.features.forEach(feature => {
    const props = feature.properties;
    const str = JSON.stringify(props).toLowerCase();
    
    if (str.includes(patron.toLowerCase())) {
      resultados.push(props);
    }
  });
  return resultados;
};

// Búsqueda 1: Por código 29
const codigoSearch = (num) => {
  return data.features.filter(f => {
    const pvonpuesto = f.properties.PVONPUESTO || f.properties.pvonpuesto;
    return pvonpuesto == num;
  });
};

// Búsqueda 2: Por nombre
const toberinResults = buscar('toberin');
const usaquenResults = buscar('usaqué');
const puesto29 = codigoSearch(29);

console.log(`📌 Búsqueda por "Toberin": ${toberinResults.length} resultados`);
toberinResults.forEach(r => {
  console.log(`  Nombre: ${r.PVONOMBRE}`);
  console.log(`  Puesto: ${r.PVONPUESTO}`);
  console.log(`  Código: ${r.PVOCODIGO}`);
  console.log(`  Localidad: ${r.LOCNOMBRE}`);
  console.log('  ---');
});

console.log(`\n📌 Búsqueda por puesto #29: ${puesto29.length} resultados`);
puesto29.forEach(r => {
  console.log(`  Nombre: ${r.PVONOMBRE}`);
  console.log(`  Puesto: ${r.PVONPUESTO}`);
  console.log(`  Código: ${r.PVOCODIGO}`);
  console.log(`  Localidad: ${r.LOCNOMBRE}`);
  console.log('  ---');
});

console.log(`\n📌 Búsqueda en Usaquén (primeros 5):`);
usaquenResults.slice(0, 5).forEach(r => {
  console.log(`  ${r.PVONPUESTO}: ${r.PVONOMBRE}`);
});

// Estadísticas generales
console.log(`\n📊 TOTAL DE PUESTOS EN EL DATASET: ${data.features.length}`);
console.log(`   Rango de puestos #: ${Math.min(...data.features.map(f => f.properties.PVONPUESTO))} - ${Math.max(...data.features.map(f => f.properties.PVONPUESTO))}`);

// Buscar todos los puestos en Usaquén
const usaquenPuestos = data.features
  .filter(f => {
    const loc = (f.properties.LOCNOMBRE || '').toLowerCase();
    return loc.includes('usaq');
  })
  .map(f => ({
    puesto: f.properties.PVONPUESTO,
    nombre: f.properties.PVONOMBRE,
    codigo: f.properties.PVOCODIGO
  }))
  .sort((a, b) => a.puesto - b.puesto);

console.log(`\n🏫 TODOS LOS PUESTOS EN USAQUÉN (${usaquenPuestos.length} total):\n`);
usaquenPuestos.forEach(p => {
  console.log(`  ${p.puesto.toString().padStart(3)} - ${p.nombre} (${p.codigo})`);
});
