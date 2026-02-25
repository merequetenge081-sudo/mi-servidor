import mongoose from 'mongoose';
import { Puestos } from '../src/models/index.js';
import { Registration } from '../src/models/Registration.js';
import { Leader } from '../src/models/Leader.js';
import { matchPuesto, matchLocalidad, normalizeString } from '../src/utils/fuzzyMatch.js';
import { aliasPuestos } from '../src/utils/aliasPuestos.js';

if (!process.env.MONGO_URL) {
  console.error('❌ MONGO_URL no definido');
  process.exit(1);
}

const stripLeadingCode = (value) => {
  if (!value) return '';
  const raw = value.toString();
  const withHyphen = raw.replace(/^\s*\d+\s*[-–]\s*/g, '').trim();
  if (withHyphen !== raw.trim()) return withHyphen;
  return raw.replace(/^\s*\d+\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, '').trim();
};

const resolvePuestoInput = (value) => {
  const raw = stripLeadingCode(value);
  if (!raw) return raw;
  const normalized = normalizeString(raw);
  const aliasKey = Object.keys(aliasPuestos).find(
    (alias) => normalizeString(alias) === normalized
  );
  return aliasKey ? aliasPuestos[aliasKey] : raw;
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('✅ Conectado a MongoDB\n');

    const leaderId = 'LID-MLULVTSN-3G4H';
    const threshold = 0.85;

    // 1. Obtener leader
    const leader = await Leader.findOne({ leaderId }).lean();
    if (!leader) throw new Error('Líder no encontrado');
    console.log(`✅ Líder encontrado: ${leaderId}`);

    // 2. Obtener todos los puestos
    const orgFilters = [
      { organizationId: null },
      { organizationId: { $exists: false } }
    ];
    if (leader.organizationId) {
      orgFilters.unshift({ organizationId: leader.organizationId });
    }

    const allPuestos = await Puestos.find({
      activo: true,
      $or: orgFilters
    }).lean();
    console.log(`✅ Puestos cargados: ${allPuestos.length}\n`);

    // 3. Obtener registrations
    const registrations = await Registration.find({
      leaderId: leader.leaderId,
      eventId: leader.eventId,
      organizationId: leader.organizationId
    }).lean();
    console.log(`✅ Registrations cargadas: ${registrations.length}\n`);

    // 4. Procesar cada registration como lo hace verifyLeaderRegistrations
    console.log('🔄 Procesando registrations...\n');

    let errors = 0;
    for (let i = 0; i < Math.min(registrations.length, 5); i++) {
      const reg = registrations[i];
      try {
        console.log(`   [${i + 1}] Cedula: ${reg.cedula}`);
        
        const votingPlaceInput = resolvePuestoInput(reg.votingPlace);
        console.log(`       votingPlace: "${reg.votingPlace}" → "${votingPlaceInput}"`);

        if (votingPlaceInput) {
          const puestoMatch = matchPuesto(votingPlaceInput, allPuestos, threshold);
          if (puestoMatch) {
            console.log(`       ✅ Match: ${puestoMatch.puesto.nombre} (${(puestoMatch.similarity * 100).toFixed(1)}%)`);
          } else {
            console.log(`       ⚠️  Sin match (threshold ${threshold})`);
          }
        } else {
          console.log(`       ⚠️  votingPlace vacío`);
        }
      } catch (err) {
        errors++;
        console.log(`       ❌ ERROR: ${err.message}`);
      }
    }

    console.log(`\n🎯 Total procesados: ${Math.min(registrations.length, 5)}`);
    console.log(`   Errores: ${errors}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

run();
