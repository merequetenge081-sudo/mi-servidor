import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { Puestos, Leader } from './src/models/index.js';

await connectDB();

console.log('\n=== Verificando datos de prueba ===\n');

// 1. Verificar líder
const leader = await Leader.findOne({ leaderId: 'leader-1' }).lean();
console.log('1. Líder encontrado:');
console.log('   leaderId:', leader?.leaderId);
console.log('   organizationId:', leader?.organizationId);
console.log('   eventId:', leader?.eventId);

// 2. Verificar puestos para esa organización
const orgId = leader?.organizationId;
const puestos = await Puestos.find({ organizationId: orgId, activo: true }).select('nombre localidad organizationId').lean();

console.log('\n2. Puestos para organizationId:', orgId);
console.log('   Total:', puestos.length);

if (puestos.length > 0) {
  console.log('\n   Puestos disponibles:');
  puestos.forEach((p, idx) => {
    console.log(`   ${idx + 1}. "${p.nombre}" (${p.localidad})`);
  });
} else {
  console.log('   ❌ NO HAY PUESTOS - Por eso el fuzzy matching no funciona');
  console.log('\n3. Creando puestos de prueba...');
  
  const puestosTest = [
    {
      codigoPuesto: 'TEST-AGUSTIN-001',
      nombre: 'Agustín Fernández',
      localidad: 'Usaquén',
      direccion: 'Cra 5 #120-30',
      activo: true,
      organizationId: orgId
    },
    {
      codigoPuesto: 'TEST-COLEGIO-001',
      nombre: 'Colegio Distrital Central',
      localidad: 'Chapinero',
      direccion: 'Cra 10 #85-50',
      activo: true,
      organizationId: orgId
    },
    {
      codigoPuesto: 'TEST-CENTRO-001',
      nombre: 'Centro Comunitario Suba',
      localidad: 'Suba',
      direccion: 'Cra 95 #158-60',
      activo: true,
      organizationId: orgId
    }
  ];
  
  for (const puesto of puestosTest) {
    await Puestos.findOneAndUpdate(
      { codigoPuesto: puesto.codigoPuesto },
      puesto,
      { upsert: true, new: true }
    );
  }
  
  console.log(`   ✅ ${puestosTest.length} puestos creados para organizationId: ${orgId}`);
}

await mongoose.disconnect();
