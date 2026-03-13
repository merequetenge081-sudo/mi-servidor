import mongoose from 'mongoose';
import fs from 'fs';

const url = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

const SOURCE_FILES = [
  'tools/puestos_from_md.json',
  'tools/todos-puestos-consolidados.json',
  'tools/puestos-nuevos-all.json'
];

const normalize = (value) => {
  if (!value) return '';
  return value
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const mapByName = new Map();
const mapByCode = new Map();

for (const filePath of SOURCE_FILES) {
  if (!fs.existsSync(filePath)) continue;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const item of data) {
    const nombre = item.nombre || item.name;
    const localidad = item.localidad;
    const codigo = item.codigoPuesto || item.codigo;
    if (codigo && localidad && !mapByCode.has(codigo)) {
      mapByCode.set(codigo, localidad);
    }
    const key = normalize(nombre);
    if (key && localidad && !mapByName.has(key)) {
      mapByName.set(key, localidad);
    }
  }
}

mongoose.connect(url).then(async () => {
  const db = mongoose.connection.db;
  const p = db.collection('puestos');
  const remaining = await p.find({ localidad: 'Fontibón', fuente: 'IDECA' }).toArray();

  const mismatches = [];
  for (const doc of remaining) {
    let expected = null;
    if (doc.codigoPuesto && mapByCode.has(doc.codigoPuesto)) {
      expected = mapByCode.get(doc.codigoPuesto);
    } else {
      const key = normalize(doc.nombre);
      if (mapByName.has(key)) expected = mapByName.get(key);
    }

    if (expected && expected !== 'Fontibón') {
      mismatches.push({ nombre: doc.nombre, expected });
    }
  }

  console.log('Remaining:', remaining.length);
  console.log('Mismatches:', mismatches.length);
  console.log(mismatches.slice(0, 20));
  process.exit(0);
});
