import mongoose from 'mongoose';
import { connectDB } from './src/config/db.js';
import { Puestos, Leader } from './src/models/index.js';

await connectDB();

console.log('\n=== DEBUG: Comparando organizationId ===\n');

const leader = await Leader.findOne({ leaderId: 'leader-1' }).lean();
console.log('1. Líder organizationId:', leader.organizationId);
console.log('   Tipo:', typeof leader.organizationId);

const puestos = await Puestos.find({ activo: true }).limit(5).lean();
console.log('\n2. Puestos en BD (activos):');
puestos.forEach((p, idx) => {
  console.log(`   ${idx + 1}. "${p.nombre}"`);
  console.log(`      organizationId: ${p.organizationId}`);
  console.log(`      Tipo: ${typeof p.organizationId}`);
  console.log(`      ¿Coincide? ${p.organizationId === leader.organizationId ? '✅ SÍ' : '❌ NO'}`);
});

// Test exacto del query del backend
console.log('\n3. Test del query del backend:');
const testQuery = await Puestos.find({
  organizationId: leader.organizationId,
  activo: true
}).lean();
console.log(`   Query: { organizationId: "${leader.organizationId}", activo: true }`);
console.log(`   Resultado: ${testQuery.length} puestos`);

if (testQuery.length === 0) {
  console.log('\n❌ PROBLEMA ENCONTRADO: El query no devuelve puestos');
  console.log('\n4. Intentando arreglar:');
  
  // Actualizar todos los puestos activos a usar el organizationId del líder
  const updateResult = await Puestos.updateMany(
    { activo: true },
    { $set: { organizationId: leader.organizationId } }
  );
  console.log(`   ✅ ${updateResult.modifiedCount} puestos actualizados`);
  
  // Verificar de nuevo
  const verifyQuery = await Puestos.find({
    organizationId: leader.organizationId,
    activo: true
  }).lean();
  console.log(`   ✅ Verificación: ${verifyQuery.length} puestos ahora coinciden`);
}

await mongoose.disconnect();
