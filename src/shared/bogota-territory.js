const BOGOTA_LOCALIDADES = [
  { name: "Usaquen", displayName: "Usaquén", zoneCode: "01" },
  { name: "Chapinero", displayName: "Chapinero", zoneCode: "02" },
  { name: "Santa Fe", displayName: "Santa Fe", zoneCode: "03" },
  { name: "San Cristobal", displayName: "San Cristóbal", zoneCode: "04" },
  { name: "Usme", displayName: "Usme", zoneCode: "05" },
  { name: "Tunjuelito", displayName: "Tunjuelito", zoneCode: "06" },
  { name: "Bosa", displayName: "Bosa", zoneCode: "07" },
  { name: "Kennedy", displayName: "Kennedy", zoneCode: "08" },
  { name: "Fontibon", displayName: "Fontibón", zoneCode: "09" },
  { name: "Engativa", displayName: "Engativá", zoneCode: "10" },
  { name: "Suba", displayName: "Suba", zoneCode: "11" },
  { name: "Barrios Unidos", displayName: "Barrios Unidos", zoneCode: "12" },
  { name: "Teusaquillo", displayName: "Teusaquillo", zoneCode: "13" },
  { name: "Los Martires", displayName: "Los Mártires", zoneCode: "14" },
  { name: "Antonio Narino", displayName: "Antonio Nariño", zoneCode: "15" },
  { name: "Puente Aranda", displayName: "Puente Aranda", zoneCode: "16" },
  { name: "La Candelaria", displayName: "La Candelaria", zoneCode: "17" },
  { name: "Rafael Uribe Uribe", displayName: "Rafael Uribe Uribe", zoneCode: "18" },
  { name: "Ciudad Bolivar", displayName: "Ciudad Bolívar", zoneCode: "19" },
  { name: "Sumapaz", displayName: "Sumapaz", zoneCode: "20" }
];

const BOGOTA_MUNICIPALITY_ALIASES = new Set([
  "BOGOTA",
  "BOGOTA D C",
  "BOGOTA DC",
  "BOGOTA D.C",
  "BOGOTA D.C.",
  "BOGOTA DISTRITO CAPITAL",
  "DISTRITO CAPITAL",
  "SANTA FE DE BOGOTA"
]);

function collapseSeparators(value) {
  return String(value || "")
    .replace(/[_|/\\]+/g, " ")
    .replace(/[-]+/g, " ")
    .replace(/[,:;]+/g, " ");
}

export function normalizeBogotaText(value) {
  return collapseSeparators(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const LOCALIDAD_BY_KEY = new Map(
  BOGOTA_LOCALIDADES.map((item) => [normalizeBogotaText(item.name), item])
);

export function normalizeBogotaLocalidad(value) {
  const resolved = resolveBogotaLocalidad(value);
  return resolved?.displayName || "";
}

export function normalizeBogotaPuesto(value) {
  return collapseSeparators(value)
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBogotaPuestoKey(value) {
  return normalizeBogotaText(normalizeBogotaPuesto(value));
}

export function resolveBogotaLocalidad(value) {
  const key = normalizeBogotaText(value);
  if (!key) return null;
  return LOCALIDAD_BY_KEY.get(key) || null;
}

export function getBogotaLocalidades() {
  return BOGOTA_LOCALIDADES.map((item) => ({ ...item }));
}

export function isBogotaMunicipality(value) {
  const key = normalizeBogotaText(value);
  if (!key) return false;
  return BOGOTA_MUNICIPALITY_ALIASES.has(key);
}

export function getBogotaZoneCodeFromLocalidad(value) {
  const resolved = resolveBogotaLocalidad(value);
  return resolved?.zoneCode || null;
}

export default {
  getBogotaLocalidades,
  getBogotaZoneCodeFromLocalidad,
  isBogotaMunicipality,
  normalizeBogotaLocalidad,
  normalizeBogotaPuesto,
  normalizeBogotaPuestoKey,
  normalizeBogotaText,
  resolveBogotaLocalidad
};
