import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { Registration } from "../src/models/Registration.js";
import { Puestos } from "../src/models/Puestos.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";
const THRESHOLD = 0.85;

const BOGOTA_LOCALIDADES = new Set([
  "usaquen",
  "chapinero",
  "santa fe",
  "san cristobal",
  "usme",
  "tunjuelito",
  "bosa",
  "kennedy",
  "fontibon",
  "engativa",
  "suba",
  "barrios unidos",
  "teusaquillo",
  "los martires",
  "antonio narino",
  "puente aranda",
  "la candelaria",
  "rafael uribe uribe",
  "ciudad bolivar",
  "sumapaz"
]);

const STOPWORDS = new Set([
  "colegio",
  "distrital",
  "sede",
  "institucion",
  "educativa",
  "educativo",
  "centro",
  "escuela",
  "liceo",
  "gimnasio",
  "instituto",
  "universidad",
  "fundacion",
  "salon",
  "comunal",
  "comunidad",
  "comercial",
  "parqueadero",
  "plazoleta",
  "via",
  "publica",
  "publico",
  "bogota",
  "d",
  "c"
]);

function normalizeText(value) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter((token) => token && !STOPWORDS.has(token));
}

function diceCoefficient(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  return (2 * intersection) / (aSet.size + bSet.size);
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a, b) {
  const aNorm = normalizeText(a);
  const bNorm = normalizeText(b);
  if (!aNorm || !bNorm) return 0;

  const dice = diceCoefficient(tokenize(a), tokenize(b));
  const dist = levenshtein(aNorm, bNorm);
  const maxLen = Math.max(aNorm.length, bNorm.length);
  const charSim = maxLen === 0 ? 0 : 1 - dist / maxLen;

  return (dice + charSim) / 2;
}

function bestSimilarity(registroTexto, puesto) {
  const candidates = [puesto.nombre || ""];
  if (Array.isArray(puesto.aliases)) {
    candidates.push(...puesto.aliases);
  }

  let best = 0;
  for (const candidate of candidates) {
    const score = similarity(registroTexto, candidate);
    if (score > best) best = score;
  }
  return best;
}

function normalizeLocalidad(value) {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|\s)dc($|\s)/g, " ")
    .replace(/(^|\s)bogota($|\s)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  console.log("\n🔎 Estandarizando puestos de votacion en registros...");
  await mongoose.connect(MONGO_URL);

  const puestos = await Puestos.find({ activo: { $ne: false } }).lean();
  const puestosByLocalidad = new Map();

  for (const p of puestos) {
    const loc = normalizeLocalidad(p.localidad || "");
    if (!puestosByLocalidad.has(loc)) puestosByLocalidad.set(loc, []);
    puestosByLocalidad.get(loc).push(p);
  }

  const registrations = await Registration.find({
    votingPlace: { $exists: true, $ne: "" },
    puestoId: { $in: [null, undefined] }
  }).lean();

  const updates = [];
  const report = [];
  let matchedCount = 0;
  let skippedCount = 0;
  let reviewCount = 0;

  for (const reg of registrations) {
    const localidadNorm = normalizeLocalidad(reg.localidad || "");

    if (!BOGOTA_LOCALIDADES.has(localidadNorm)) {
      report.push({
        id: reg._id.toString(),
        cedula: reg.cedula,
        localidad: reg.localidad || "",
        original: reg.votingPlace,
        bestMatch: "",
        score: 0,
        action: "skip_non_bogota"
      });
      skippedCount += 1;
      continue;
    }

    const candidatos = puestosByLocalidad.get(localidadNorm) || [];
    if (candidatos.length === 0) {
      report.push({
        id: reg._id.toString(),
        cedula: reg.cedula,
        localidad: reg.localidad || "",
        original: reg.votingPlace,
        bestMatch: "",
        score: 0,
        action: "skip_no_puestos"
      });
      skippedCount += 1;
      continue;
    }

    let best = null;
    let bestScore = 0;

    for (const puesto of candidatos) {
      const score = bestSimilarity(reg.votingPlace, puesto);
      if (score > bestScore) {
        bestScore = score;
        best = puesto;
      }
    }

    if (best && bestScore >= THRESHOLD) {
      updates.push({
        updateOne: {
          filter: { _id: reg._id },
          update: {
            $set: {
              puestoId: best._id,
              votingPlace: best.nombre,
              localidad: best.localidad || reg.localidad,
              updatedAt: new Date()
            }
          }
        }
      });
      report.push({
        id: reg._id.toString(),
        cedula: reg.cedula,
        localidad: reg.localidad || "",
        original: reg.votingPlace,
        bestMatch: best.nombre,
        score: Number(bestScore.toFixed(3)),
        action: "updated"
      });
      matchedCount += 1;
    } else {
      report.push({
        id: reg._id.toString(),
        cedula: reg.cedula,
        localidad: reg.localidad || "",
        original: reg.votingPlace,
        bestMatch: best?.nombre || "",
        score: Number(bestScore.toFixed(3)),
        action: "review"
      });
      reviewCount += 1;
    }
  }

  if (updates.length > 0) {
    const result = await Registration.bulkWrite(updates);
    console.log(`✅ Actualizados: ${result.modifiedCount}`);
  }

  const fs = await import("fs");
  const reportPath = new URL("./standardize_report.json", import.meta.url);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nResumen:\n- Actualizados: ${matchedCount}\n- Para revision: ${reviewCount}\n- Omitidos: ${skippedCount}`);
  console.log("Reporte guardado en tools/standardize_report.json\n");

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Error en estandarizacion:", error);
  process.exit(1);
});
