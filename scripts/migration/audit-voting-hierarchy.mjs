import "dotenv/config";
import { connectDB, disconnectDB } from "../../src/config/db.js";
import { Puestos, Registration } from "../../src/models/index.js";
import {
  canonicalizeBogotaLocality,
  getBogotaLocalidadesCanonical,
  normalizeTerritoryText
} from "../../src/shared/territoryNormalization.js";

function normalize(value) {
  return normalizeTerritoryText(canonicalizeBogotaLocality(value) || value);
}

async function main() {
  await connectDB();

  const bogotaAllowed = new Set(getBogotaLocalidadesCanonical().map((item) => normalize(item)));

  const localityRows = await Registration.aggregate([
    {
      $match: {
        localidad: { $nin: [null, ""] }
      }
    },
    {
      $group: {
        _id: "$localidad",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const invalidBogotaLocalidades = localityRows
    .map((row) => ({
      localidad: row._id,
      normalized: normalize(row._id),
      count: row.count
    }))
    .filter((row) => {
      const canonical = canonicalizeBogotaLocality(row.localidad);
      return canonical && !bogotaAllowed.has(normalize(canonical));
    });

  const puestoEvidence = await Registration.aggregate([
    {
      $match: {
        puestoId: { $ne: null },
        localidad: { $nin: [null, ""] }
      }
    },
    {
      $group: {
        _id: {
          puestoId: "$puestoId",
          localidad: "$localidad"
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const evidenceByPuesto = new Map();
  for (const row of puestoEvidence) {
    const key = String(row._id.puestoId);
    if (!evidenceByPuesto.has(key)) evidenceByPuesto.set(key, []);
    evidenceByPuesto.get(key).push({
      localidad: row._id.localidad,
      normalized: normalize(row._id.localidad),
      count: row.count
    });
  }

  const puestos = await Puestos.find({}, { codigoPuesto: 1, nombre: 1, localidad: 1 }).lean();
  const mismatchedPuestos = [];
  for (const puesto of puestos) {
    const evidence = evidenceByPuesto.get(String(puesto._id));
    if (!evidence?.length) continue;
    const top = evidence[0];
    if (normalize(puesto.localidad) !== top.normalized) {
      mismatchedPuestos.push({
        codigoPuesto: puesto.codigoPuesto,
        nombre: puesto.nombre,
        localidadActual: puesto.localidad,
        localidadSugerida: top.localidad,
        totalRegistrosSugeridos: top.count,
        evidencia: evidence.slice(0, 3)
      });
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    invalidBogotaLocalidades,
    mismatchedPuestosCount: mismatchedPuestos.length,
    mismatchedPuestosSample: mismatchedPuestos.slice(0, 100)
  }, null, 2));

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("[audit-voting-hierarchy] failed", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
