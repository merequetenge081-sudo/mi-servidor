import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchPuesto } from '../src/utils/fuzzyMatch.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const puestosPath = path.join(__dirname, 'puestos-actualizados.json');
const threshold = Number(process.argv[2]) || 0.85;

if (!fs.existsSync(puestosPath)) {
  console.error('❌ No existe puestos-actualizados.json');
  process.exit(1);
}

const puestos = JSON.parse(fs.readFileSync(puestosPath, 'utf8'));

const failures = [];

for (const puesto of puestos) {
  const candidates = [
    puesto.nombre,
    puesto.sitio,
    ...(Array.isArray(puesto.aliases) ? puesto.aliases : [])
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = matchPuesto(candidate, puestos, threshold);
    if (!match || match.puesto.codigoPuesto !== puesto.codigoPuesto) {
      failures.push({
        codigoPuesto: puesto.codigoPuesto,
        nombre: puesto.nombre,
        candidate,
        matched: match?.puesto?.nombre || null,
        similarity: match?.similarity || 0
      });
    }
  }
}

const totalCandidates = puestos.reduce((sum, puesto) => {
  const count = [puesto.nombre, puesto.sitio, ...(Array.isArray(puesto.aliases) ? puesto.aliases : [])]
    .filter(Boolean).length;
  return sum + count;
}, 0);

console.log(`✅ Puestos: ${puestos.length}`);
console.log(`✅ Candidatos evaluados: ${totalCandidates}`);
console.log(`⚠️  Fallos: ${failures.length}`);

if (failures.length > 0) {
  const sample = failures.slice(0, 25);
  console.log('--- MUESTRA DE FALLOS ---');
  for (const item of sample) {
    console.log(`- [${item.codigoPuesto}] "${item.candidate}" => "${item.matched}" (${(item.similarity * 100).toFixed(1)}%)`);
  }

  const outPath = path.join(__dirname, 'puestos-matching-failures.json');
  fs.writeFileSync(outPath, JSON.stringify(failures, null, 2));
  console.log(`🧾 Detalle completo: ${outPath}`);
}
