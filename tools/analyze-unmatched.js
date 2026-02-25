import fs from 'fs';

const unmatched = [
  { name: 'Ciudad Bochica Sur', localidad: 'Rafael Uribe' },
  { name: 'Granjas de San Pablo', localidad: 'Rafael Uribe' },
  { name: 'Los Molinos II Sector', localidad: 'Rafael Uribe' },
  { name: 'Alcaldia Quiroga', localidad: 'Rafael Uribe', count: 6 },
  { name: 'Colegio Eucaristico Villa Guadalupe', localidad: 'Usaquén' },
  { name: 'San Antonio del Táchira', localidad: 'Venezuela' }
];

const actual = JSON.parse(fs.readFileSync('./tools/puestos-actualizados.json', 'utf8'));
const faltantes = JSON.parse(fs.readFileSync('./tools/puestos-faltantes-comparacion.json', 'utf8'));

console.log('🔍 Análisis avanzado de nombres sin match\n');

unmatched.forEach(u => {
  console.log(`\n📌 "${u.name}" [${u.localidad}]${u.count ? ` x${u.count}` : ''}`);
  
  // Buscar en la localidad exacta
  const inLocalidad = actual.filter(p => p.localidad === u.localidad);
  const similar = inLocalidad
    .map(p => ({
      nombre: p.nombre,
      similarity: Math.max(
        ...[u.name, ...u.name.split(' ')].map(word =>
          p.nombre.toLowerCase().includes(word.toLowerCase()) ? 1 : 0
        )
      )
    }))
    .filter(s => s.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  if (similar.length > 0) {
    console.log('  Candidatos por palabra key:');
    similar.forEach(s => console.log(`    - ${s.nombre}`));
  }

  // Buscar el nombre exacto o muy similar en CUALQUIER localidad
  const byName = actual.find(p => {
    const n1 = p.nombre.toLowerCase().trim();
    const n2 = u.name.toLowerCase().trim();
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  });

  if (byName) {
    console.log(`  ✅ ENCONTRADO EN OTRA LOCALIDAD: [${byName.localidad}] ${byName.nombre}`);
  }

  // Buscar en CSV faltantes
  const inFaltantes = faltantes.find(p => p.nombre.toLowerCase().includes(u.name.split(' ')[0].toLowerCase()));
  if (inFaltantes && !byName) {
    console.log(`  📄 CSV contiene: [${inFaltantes.localidad}] ${inFaltantes.nombre}`);
  }
});

process.exit(0);
