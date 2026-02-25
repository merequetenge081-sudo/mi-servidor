import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';
import { Registration } from '../src/models/Registration.js';
import { Leader } from '../src/models/Leader.js';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB');

    // 1. Diagnosticar Puestos
    console.log('\n🔍 DIAGNÓSTICO DE PUESTOS:');
    const puestosCount = await Puestos.countDocuments();
    console.log(`   Total documentos: ${puestosCount}`);

    const activosCount = await Puestos.countDocuments({ activo: true });
    console.log(`   Documentos activos: ${activosCount}`);

    const sinActivo = await Puestos.countDocuments({ activo: { $exists: false } });
    console.log(`   Sin campo 'activo': ${sinActivo}`);

    const sample = await Puestos.findOne().lean();
    if (sample) {
      console.log(`   Sample documento: ${JSON.stringify(Object.keys(sample))}`);
    }

    // 2. Diagnosticar Registrations
    console.log('\n🔍 DIAGNÓSTICO DE REGISTRATIONS:');
    const regsCount = await Registration.countDocuments();
    console.log(`   Total registrations: ${regsCount}`);

    const leaderRegs = await Registration.findOne({ leaderId: 'LID-MLULVTSN-3G4H' }).lean();
    if (leaderRegs) {
      console.log(`   ✅ Encontrados registros del líder`);
      console.log(`      votingPlace: ${leaderRegs.votingPlace}`);
      console.log(`      puestoId: ${leaderRegs.puestoId}`);
    } else {
      console.log(`   ⚠️  No hay registros del líder LID-MLULVTSN-3G4H`);
    }

    // 3. Diagnosticar Leader
    console.log('\n🔍 DIAGNÓSTICO DE LEADER:');
    const leader = await Leader.findOne({ leaderId: 'LID-MLULVTSN-3G4H' }).lean();
    if (leader) {
      console.log(`   ✅ Líder encontrado`);
      console.log(`      organizationId: ${leader.organizationId}`);
      console.log(`      eventId: ${leader.eventId}`);
    } else {
      console.log(`   ❌ Líder no encontrado`);
    }

    // 4. Test: simulación de búsqueda de puestos
    console.log('\n🔍 TEST: Búsqueda de Puestos');
    try {
      const orgFilters = [
        { organizationId: null },
        { organizationId: { $exists: false } }
      ];
      if (leader?.organizationId) {
        orgFilters.unshift({ organizationId: leader.organizationId });
      }

      console.log(`   Filtros: ${JSON.stringify(orgFilters)}`);

      const puestos = await Puestos.find({
        activo: true,
        $or: orgFilters
      }).lean();

      console.log(`   ✅ Búsqueda exitosa: ${puestos.length} puestos encontrados`);
    } catch (err) {
      console.log(`   ❌ Error en búsqueda: ${err.message}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    process.exit(1);
  }
};

run();
