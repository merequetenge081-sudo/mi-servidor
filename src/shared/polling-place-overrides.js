import { canonicalizeBogotaLocality } from "./territoryNormalization.js";

const POLLING_PLACE_OVERRIDES = [
  {
    codigoPuesto: "04100397",
    nombre: "Parqueadero Guacamayas",
    localidad: "San Cristobal"
  }
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findOverride(puesto = {}) {
  const codigo = normalizeText(puesto.codigoPuesto);
  const nombre = normalizeText(puesto.nombre);
  return POLLING_PLACE_OVERRIDES.find((item) => {
    if (codigo && normalizeText(item.codigoPuesto) === codigo) return true;
    if (nombre && normalizeText(item.nombre) === nombre) return true;
    return false;
  }) || null;
}

export function applyPollingPlaceOverride(puesto = {}) {
  const override = findOverride(puesto);
  const localidad = canonicalizeBogotaLocality(
    override?.localidad || puesto.localidad
  ) || override?.localidad || puesto.localidad;

  return {
    ...puesto,
    localidad,
    nombre: override?.nombre || puesto.nombre
  };
}

export default {
  applyPollingPlaceOverride
};
