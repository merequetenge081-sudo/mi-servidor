import { getBogotaZoneCodeFromLocalidad, normalizeBogotaLocalidad } from "./bogota-territory.js";

export function getBogotaZoneCode(localidad) {
  return getBogotaZoneCodeFromLocalidad(localidad);
}

export function getBogotaZoneLabel(localidad) {
  const code = getBogotaZoneCode(localidad);
  if (!code) return null;
  return `Zona ${code}`;
}

export function buildE14NavigationHint(registration = {}) {
  const localidad = normalizeBogotaLocalidad(registration.localidad || "") || registration.localidad || "";
  const puesto = registration.puesto || registration.votingPlace || "";
  const mesa = registration.mesa ?? registration.votingTable ?? null;
  const zoneCode = registration.e14ZoneCode || getBogotaZoneCode(localidad);
  const zoneLabel = zoneCode ? `Zona ${zoneCode}` : "Zona sin mapear";
  return {
    corporation: "CAMARA",
    municipality: "BOGOTA",
    zoneCode,
    zoneLabel,
    locality: localidad,
    pollingPlace: puesto,
    table: mesa,
    candidateCode: "105",
    copyText: `CAMARA | BOGOTA | ${zoneLabel} | ${puesto || "-"} | Mesa ${mesa ?? "-"} | Candidata 105`
  };
}

export default {
  getBogotaZoneCode,
  getBogotaZoneLabel,
  buildE14NavigationHint
};
