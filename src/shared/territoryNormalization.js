import { repairTextEncoding } from "./textNormalization.js";

const BOGOTA_LOCALIDADES_CANONICAL = [
  "Usaquen",
  "Chapinero",
  "Santa Fe",
  "San Cristobal",
  "Usme",
  "Tunjuelito",
  "Bosa",
  "Kennedy",
  "Fontibon",
  "Engativa",
  "Suba",
  "Barrios Unidos",
  "Teusaquillo",
  "Los Martires",
  "Antonio Narino",
  "Puente Aranda",
  "La Candelaria",
  "Rafael Uribe Uribe",
  "Ciudad Bolivar",
  "Sumapaz"
];

function normalizeAlphaNumeric(value) {
  return repairTextEncoding(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOCALIDAD_ALIASES = new Map(
  BOGOTA_LOCALIDADES_CANONICAL.map((name) => [normalizeAlphaNumeric(name), name])
);

function cleanLocalityToken(value) {
  return normalizeTerritoryText(value)
    .replace(/^\d+\s+/g, "")
    .replace(/^LOCALIDAD\s+/g, "")
    .trim();
}

function similarityScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 95;

  const aTokens = a.split(" ").filter(Boolean);
  const bTokens = b.split(" ").filter(Boolean);
  const tokenMatches = aTokens.filter((token) => bTokens.includes(token)).length;
  const tokenScore = Math.round((tokenMatches / Math.max(aTokens.length, bTokens.length, 1)) * 100);

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix += 1;
  const prefixScore = Math.round((prefix / Math.max(a.length, b.length, 1)) * 100);

  return Math.max(tokenScore, prefixScore);
}

export function normalizeTerritoryText(value) {
  return normalizeAlphaNumeric(value);
}

function findCanonicalByPrefix(normalizedValue) {
  if (!normalizedValue) return null;
  for (const [key, canonical] of LOCALIDAD_ALIASES.entries()) {
    if (normalizedValue.startsWith(key) || key.startsWith(normalizedValue)) {
      return canonical;
    }
  }
  return null;
}

export function canonicalizeBogotaLocality(value) {
  const normalized = cleanLocalityToken(value);
  if (!normalized) return null;
  if (LOCALIDAD_ALIASES.has(normalized)) {
    return LOCALIDAD_ALIASES.get(normalized);
  }
  const prefixed = findCanonicalByPrefix(normalized);
  if (prefixed) return prefixed;

  let best = null;
  let bestScore = 0;
  for (const [key, canonical] of LOCALIDAD_ALIASES.entries()) {
    const score = similarityScore(normalized, key);
    if (score > bestScore) {
      best = canonical;
      bestScore = score;
    }
  }

  return bestScore >= 74 ? best : null;
}

export function isBogotaTerritory(fields = {}) {
  const {
    localidad,
    departamento,
    capital,
    puestoLocalidad,
    puestoCiudad,
    puestoDepartamento
  } = fields;

  const canonicalLocalidad =
    canonicalizeBogotaLocality(puestoLocalidad) || canonicalizeBogotaLocality(localidad);
  if (canonicalLocalidad) return true;

  const rawLoc = normalizeTerritoryText(puestoLocalidad || localidad);
  const rawCity = normalizeTerritoryText(capital || puestoCiudad);
  const dep = normalizeTerritoryText(departamento || puestoDepartamento);
  const city = normalizeTerritoryText(capital || puestoCiudad);
  if (rawLoc.includes("CUNDINAMARCA") || rawCity.includes("CUNDINAMARCA") || dep.includes("CUNDINAMARCA")) return false;
  return dep.includes("BOGOT") || city.includes("BOGOT");
}

export function getBogotaLocalidadesCanonical() {
  return [...BOGOTA_LOCALIDADES_CANONICAL];
}

export function getBogotaLocalidadesNormalized() {
  return BOGOTA_LOCALIDADES_CANONICAL.map((name) => normalizeTerritoryText(name));
}
