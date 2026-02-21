import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Puestos } from "../src/models/Puestos.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";
const GEOJSON_PATH = path.join(__dirname, "pvo.geojson");

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

function cleanValue(value) {
  if (!value) return "";
  return value
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã/g, "Á")
    .replace(/É/g, "É")
    .replace(/Í/g, "Í")
    .replace(/Ó/g, "Ó")
    .replace(/Ú/g, "Ú")
    .trim();
}

function buildKey(localidad, nombre) {
  return `${normalizeText(localidad)}|${normalizeText(nombre)}`;
}

async function main() {
  console.log("\n🔧 Actualizando aliases desde GEOJSON oficial...");

  const raw = fs.readFileSync(GEOJSON_PATH, "utf8");
  const geojson = JSON.parse(raw);

  const aliasMap = new Map();

  for (const feature of geojson.features || []) {
    const props = feature.properties || {};
    const localidad = cleanValue(props.LOCNOMBRE || "");
    const nombre = cleanValue(props.PVONOMBRE || "");
    const sitio = cleanValue(props.PVONSITIO || "");

    if (!localidad || !nombre) continue;

    const key = buildKey(localidad, nombre);
    if (!aliasMap.has(key)) {
      aliasMap.set(key, new Set());
    }

    if (sitio) {
      aliasMap.get(key).add(sitio);
    }
  }

  await mongoose.connect(MONGO_URL);

  const puestos = await Puestos.find({ activo: { $ne: false } }).lean();
  const updates = [];
  let updatedCount = 0;

  for (const puesto of puestos) {
    const key = buildKey(puesto.localidad || "", puesto.nombre || "");
    const aliases = aliasMap.get(key);
    if (!aliases || aliases.size === 0) {
      continue;
    }

    const currentAliases = Array.isArray(puesto.aliases) ? puesto.aliases : [];
    const merged = new Set(currentAliases);
    for (const alias of aliases) {
      merged.add(alias);
    }

    const mergedArr = Array.from(merged).filter(Boolean);
    if (mergedArr.length === currentAliases.length) {
      continue;
    }

    updates.push({
      updateOne: {
        filter: { _id: puesto._id },
        update: {
          $set: { aliases: mergedArr, updatedAt: new Date() }
        }
      }
    });
    updatedCount += 1;
  }

  if (updates.length > 0) {
    await Puestos.bulkWrite(updates);
  }

  console.log(`✅ Puestos actualizados con aliases: ${updatedCount}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Error actualizando aliases:", error);
  process.exit(1);
});
