import fs from 'fs';

const target = [
  'Ciudad Bochica Sur',
  'Granjas de San Pablo',
  'Los Molinos II Sector',
  'Alcaldia Quiroga',
  'Libertador II',
  'Restrepo B',
  'San Vicente Colsubsidio',
  'Colegio Eucaristico Villa Guadalupe',
  'San Antonio del Táchira'
];

const faltantes = JSON.parse(fs.readFileSync('./tools/puestos-faltantes-comparacion.json', 'utf8'));
const actual = JSON.parse(fs.readFileSync('./tools/puestos-actualizados.json', 'utf8'));

console.log('=== Verificación de nombres sin match ===\n');

target.forEach(name => {
  const inFaltantes = faltantes.find(p => p.nombre.toLowerCase() === name.toLowerCase());
  const inActual = actual.find(p => p.nombre.toLowerCase() === name.toLowerCase());
  
  if (inFaltantes) {
    console.log(`✅ EN FALTANTES: ${name} -> [${inFaltantes.localidad}] ${inFaltantes.nombre}`);
  } else if (inActual) {
    console.log(`✅ EN JSON: ${name} -> [${inActual.localidad}] ${inActual.nombre}`);
  } else {
    // Buscar parecidos
    const similar = actual.filter(p => p.nombre.toLowerCase().includes(name.toLowerCase().substring(0, 5)));
    if (similar.length > 0) {
      console.log(`⚠️  ${name} NO EXISTE - similares:`);
      similar.slice(0, 3).forEach(s => console.log(`   - [${s.localidad}] ${s.nombre}`));
    } else {
      console.log(`❌ ${name} - NO EXISTE EN NINGÚN LADO`);
    }
  }
});

process.exit(0);
