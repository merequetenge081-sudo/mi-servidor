import mongoose from 'mongoose';
import { Leader, Registration, Puestos } from '../src/models/index.js';
import { matchPuesto, normalizeString } from '../src/utils/fuzzyMatch.js';
import { aliasPuestos } from '../src/utils/aliasPuestos.js';

const leaderInput = process.argv[2];
const threshold = Number(process.argv[3]) || 0.85;

if (!leaderInput) {
  console.error('❌ Debes pasar leaderId. Ej: node tools/test-leader-matching.js apalacios');
  process.exit(1);
}

const MONGO_URL = process.env.MONGO_URL;
if (!MONGO_URL) {
  console.error('❌ MONGO_URL no está definido. Configúralo antes de ejecutar.');
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
  await mongoose.connect(MONGO_URL);

  const leaderQuery = [{ leaderId: leaderInput }];
  if (/^[0-9a-fA-F]{24}$/.test(leaderInput)) {
    leaderQuery.push({ _id: leaderInput });
  }

  const leader = await Leader.findOne({
    $or: leaderQuery
  }).lean();

  if (!leader) {
    console.error('❌ Líder no encontrado');
    process.exit(1);
  }

  const orgFilters = [
    { organizationId: null },
    { organizationId: { $exists: false } }
  ];

  if (leader.organizationId) {
    orgFilters.unshift({ organizationId: leader.organizationId });
  }

  const puestos = await Puestos.find({
    activo: true,
    $or: orgFilters
  }).lean();

  const registrations = await Registration.find({
    leaderId: leader.leaderId,
    eventId: leader.eventId,
    organizationId: leader.organizationId
  }).lean();

  const results = {
    leaderId: leader.leaderId,
    total: registrations.length,
    matched: 0,
    requiresReview: 0,
    unmatched: 0,
    threshold
  };

  const failures = [];

  for (const reg of registrations) {
    const votingPlaceInput = resolvePuestoInput(reg.votingPlace);
    if (!votingPlaceInput) continue;

    const match = matchPuesto(votingPlaceInput, puestos, threshold);
    if (!match) {
      results.unmatched++;
      failures.push({
        id: reg._id,
        cedula: reg.cedula,
        votingPlace: reg.votingPlace,
        localidad: reg.localidad || null,
        reason: 'no-match'
      });
      continue;
    }

    results.matched++;
    if (reg.requiereRevisionPuesto && !reg.revisionPuestoResuelta) {
      results.requiresReview++;
    }
  }

  console.log('✅ Resultado:', results);
  if (failures.length > 0) {
    const outPath = 'tools/leader-matching-report.json';
    const fs = await import('fs');
    fs.writeFileSync(outPath, JSON.stringify(failures, null, 2));
    console.log(`🧾 Reporte: ${outPath} (fallos: ${failures.length})`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
