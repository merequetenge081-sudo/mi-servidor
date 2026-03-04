import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { Event } from '../src/models/Event.js';
import { Registration } from '../src/models/Registration.js';
import { Puestos } from '../src/models/Puestos.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const normalize = (value) => (value || '')
  .toString()
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    eventId: null,
    eventName: null,
    apply: true,
    minCount: 5,
    minPct: 0.6,
    updateNames: false,
    reportPath: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--eventId') options.eventId = args[i + 1];
    if (arg === '--eventName') options.eventName = args[i + 1];
    if (arg === '--dry-run') options.apply = false;
    if (arg === '--apply') options.apply = true;
    if (arg === '--minCount') options.minCount = Number(args[i + 1] || options.minCount);
    if (arg === '--minPct') options.minPct = Number(args[i + 1] || options.minPct);
    if (arg === '--updateNames') options.updateNames = true;
    if (arg === '--report') options.reportPath = args[i + 1];
  }

  return options;
};

const pickTopValue = (entries) => {
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  return sorted[0] || null;
};

const buildNormalizedCounts = (entries) => {
  const map = new Map();
  for (const entry of entries) {
    const raw = (entry.value || '').toString().trim();
    if (!raw) continue;
    const key = normalize(raw);
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { key, raw, count: 0, rawSamples: new Map() });
    }
    const item = map.get(key);
    item.count += entry.count;
    item.rawSamples.set(raw, (item.rawSamples.get(raw) || 0) + entry.count);
  }

  const result = [];
  for (const item of map.values()) {
    const rawSorted = [...item.rawSamples.entries()].sort((a, b) => b[1] - a[1]);
    result.push({
      key: item.key,
      raw: rawSorted[0] ? rawSorted[0][0] : item.raw,
      count: item.count,
      samples: rawSorted
    });
  }
  return result;
};

const main = async () => {
  const options = parseArgs();
  await connectDB();

  let event = null;
  if (options.eventId) {
    event = await Event.findById(options.eventId).lean();
  } else if (options.eventName) {
    event = await Event.findOne({ name: new RegExp(options.eventName, 'i') }).lean();
  } else {
    event = await Event.findOne({ name: /Evento.*Inicial/i }).lean();
  }

  if (!event) {
    console.log('No encontre el evento. Usa --eventId o --eventName.');
    await disconnectDB();
    return;
  }

  const eventId = event._id.toString();
  console.log('Evento:', event.name, eventId);

  const localidadBuckets = await Registration.aggregate([
    { $match: { eventId, dataIntegrityStatus: { $ne: 'invalid' }, localidad: { $ne: null, $ne: '' }, puestoId: { $ne: null } } },
    { $group: { _id: { puestoId: '$puestoId', localidad: '$localidad' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.puestoId', values: { $push: { value: '$_id.localidad', count: '$count' } }, total: { $sum: '$count' } } }
  ]);

  const votingPlaceBuckets = await Registration.aggregate([
    { $match: { eventId, dataIntegrityStatus: { $ne: 'invalid' }, votingPlace: { $ne: null, $ne: '' }, puestoId: { $ne: null } } },
    { $group: { _id: { puestoId: '$puestoId', votingPlace: '$votingPlace' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.puestoId', values: { $push: { value: '$_id.votingPlace', count: '$count' } }, total: { $sum: '$count' } } }
  ]);

  const localityMap = new Map();
  for (const bucket of localidadBuckets) {
    const normalized = buildNormalizedCounts(bucket.values);
    const top = pickTopValue(normalized);
    if (!top) continue;

    localityMap.set(String(bucket._id), {
      total: bucket.total,
      top,
      normalized
    });
  }

  const placeMap = new Map();
  for (const bucket of votingPlaceBuckets) {
    const normalized = buildNormalizedCounts(bucket.values);
    const top = pickTopValue(normalized);
    if (!top) continue;

    placeMap.set(String(bucket._id), {
      total: bucket.total,
      top,
      normalized
    });
  }

  const puestoIds = [...new Set([...localityMap.keys(), ...placeMap.keys()])];
  const puestos = await Puestos.find({ _id: { $in: puestoIds } }).lean();
  const puestoById = new Map(puestos.map((p) => [String(p._id), p]));

  const updates = [];
  const nameUpdates = [];
  const skipped = [];

  for (const puestoId of puestoIds) {
    const puesto = puestoById.get(puestoId);
    if (!puesto) continue;

    const locInfo = localityMap.get(puestoId);
    if (locInfo) {
      const pct = locInfo.top.count / Math.max(locInfo.total, 1);
      const currentNorm = normalize(puesto.localidad);
      const nextNorm = locInfo.top.key;

      if (locInfo.total >= options.minCount && pct >= options.minPct && nextNorm && nextNorm !== currentNorm) {
        updates.push({
          puestoId,
          from: puesto.localidad,
          to: locInfo.top.raw,
          total: locInfo.total,
          topCount: locInfo.top.count,
          pct: Number(pct.toFixed(4))
        });
      } else {
        skipped.push({
          puestoId,
          reason: 'baja_confianza_o_mismo_valor',
          current: puesto.localidad,
          proposed: locInfo.top.raw,
          total: locInfo.total,
          topCount: locInfo.top.count,
          pct: Number(pct.toFixed(4))
        });
      }
    }

    if (options.updateNames && placeMap.has(puestoId)) {
      const placeInfo = placeMap.get(puestoId);
      const pct = placeInfo.top.count / Math.max(placeInfo.total, 1);
      const currentName = (puesto.nombre || '').trim();
      const isPlaceholder = !currentName || /sin\s+puesto/i.test(currentName);
      const nextName = (placeInfo.top.raw || '').trim();

      if (nextName && isPlaceholder && placeInfo.total >= options.minCount && pct >= options.minPct) {
        nameUpdates.push({
          puestoId,
          from: currentName || null,
          to: nextName,
          total: placeInfo.total,
          topCount: placeInfo.top.count,
          pct: Number(pct.toFixed(4))
        });
      }
    }
  }

  if (options.apply) {
    const bulkOps = updates.map((item) => ({
      updateOne: {
        filter: { _id: item.puestoId },
        update: { $set: { localidad: item.to } }
      }
    }));

    const nameOps = nameUpdates.map((item) => ({
      updateOne: {
        filter: { _id: item.puestoId },
        update: { $set: { nombre: item.to } }
      }
    }));

    const ops = [...bulkOps, ...nameOps];
    if (ops.length > 0) {
      const result = await Puestos.bulkWrite(ops);
      console.log('Actualizaciones aplicadas:', result.modifiedCount || 0);
    } else {
      console.log('Sin cambios para aplicar.');
    }
  } else {
    console.log('Dry-run: sin aplicar cambios.');
  }

  const report = {
    event: { id: eventId, name: event.name },
    options,
    summary: {
      puestosEvaluados: puestoIds.length,
      localidadUpdates: updates.length,
      nombreUpdates: nameUpdates.length,
      skipped: skipped.length
    },
    updates,
    nameUpdates,
    skipped
  };

  const reportPath = options.reportPath
    ? path.resolve(process.cwd(), options.reportPath)
    : path.join(__dirname, `../reports/fix_puestos_localidad_${Date.now()}.json`);

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log('Reporte:', reportPath);

  await disconnectDB();
};

main().catch(async (err) => {
  console.error('Error en fix_puestos_localidad:', err);
  await disconnectDB();
  process.exit(1);
});
