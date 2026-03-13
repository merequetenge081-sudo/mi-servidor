import { distance as levenshteinDistance } from "fastest-levenshtein";
import logger from "../config/logger.js";
import { MesaOficialBogota, Registration } from "../models/index.js";
import registraduriaSyncService from "./registraduria-sync.service.js";
import puestoMatchingService from "./puestoMatching.service.js";
import { canonicalizeBogotaLocality } from "../shared/territoryNormalization.js";
import { normalizeMesaNumber, normalizeText } from "../shared/textNormalization.js";
import metricsCacheService from "./metricsCache.service.js";

function safeText(value) {
  return String(value || "").trim();
}

function buildCatalogVersion(totalDocs = 0) {
  return `bogota-e14:${totalDocs}`;
}

function mapReasonToStatus(reason) {
  if (reason === "puesto_no_oficial") return "invalid_puesto";
  if (reason === "mesa_no_existe_en_puesto_oficial") return "invalid_mesa";
  if (reason === "puesto_pertenece_a_otra_localidad") return "mismatched_localidad";
  if (reason === "placeholder") return "placeholder_or_noise";
  if (reason === "unresolved_legacy") return "unresolved_legacy";
  if (reason === "mesa_faltante" || reason === "puesto_faltante" || reason === "localidad_inconsistente" || reason === "incomplete_record") {
    return "incomplete";
  }
  if (reason === "outside_official_scope") return "outside_official_scope";
  return "pending_official_validation";
}

class OfficialE14CatalogService {
  constructor() {
    this.cache = new Map();
    this.cacheTtlMs = 5 * 60 * 1000;
  }

  getCache(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  setCache(key, value) {
    this.cache.set(key, { value, createdAt: Date.now() });
    return value;
  }

  clearCache() {
    this.cache.clear();
  }

  async syncOfficialCatalog(region = "bogota") {
    if (String(region).toLowerCase() !== "bogota") {
      throw new Error("Por ahora solo se soporta sincronizacion oficial de Bogota");
    }
    const result = await registraduriaSyncService.syncBogotaMesas();
    this.clearCache();
    return result;
  }

  async loadCatalog() {
    const cached = this.getCache("bogota");
    if (cached) return cached;

    const docs = await MesaOficialBogota.find(
      {},
      {
        corporacion: 1,
        municipio: 1,
        zonaNombre: 1,
        zonaCodigo: 1,
        localidad: 1,
        puesto: 1,
        mesa: 1,
        codigoPuesto: 1,
        normalizedLocalidad: 1,
        normalizedPuesto: 1,
        officialSourceVersion: 1,
        sourceUrl: 1
      }
    ).lean();

    const byScopedPuesto = new Map();
    const byScopedPuestoLoose = new Map();
    const byPuesto = new Map();
    const byPuestoLoose = new Map();
    const byPuestoAcrossLocalidades = new Map();
    const uniqueCatalogLocalidades = new Set();

    docs.forEach((doc) => {
      const normalizedLocalidad = normalizeText(doc.normalizedLocalidad || doc.zonaNombre || doc.localidad);
      const normalizedPuesto = normalizeText(doc.normalizedPuesto || doc.puesto);
      const normalizedPuestoLoose = puestoMatchingService.normalizePuestoName(doc.puesto, { loose: true });
      const mesa = normalizeMesaNumber(doc.mesa);
      if (!normalizedLocalidad || !normalizedPuesto || mesa === null) return;
      uniqueCatalogLocalidades.add(normalizedLocalidad);

      const scopedKey = `${normalizedLocalidad}::${normalizedPuesto}`;
      const scopedLooseKey = `${normalizedLocalidad}::${normalizedPuestoLoose}`;
      if (!byScopedPuesto.has(scopedKey)) {
        byScopedPuesto.set(scopedKey, {
          localidad: safeText(doc.zonaNombre || doc.localidad),
          puesto: safeText(doc.puesto),
          codigoPuesto: safeText(doc.codigoPuesto),
          mesas: new Set(),
          corporacion: safeText(doc.corporacion || "CAMARA"),
          sourceUrl: safeText(doc.sourceUrl)
        });
      }
      byScopedPuesto.get(scopedKey).mesas.add(mesa);
      if (normalizedPuestoLoose) {
        if (!byScopedPuestoLoose.has(scopedLooseKey)) {
          byScopedPuestoLoose.set(scopedLooseKey, byScopedPuesto.get(scopedKey));
        }
        byScopedPuestoLoose.get(scopedLooseKey).mesas.add(mesa);
      }

      if (!byPuesto.has(normalizedPuesto)) byPuesto.set(normalizedPuesto, []);
      byPuesto.get(normalizedPuesto).push({
        localidad: safeText(doc.zonaNombre || doc.localidad),
        normalizedLocalidad,
        puesto: safeText(doc.puesto),
        normalizedPuesto,
        normalizedPuestoLoose,
        codigoPuesto: safeText(doc.codigoPuesto),
        mesa,
        sourceUrl: safeText(doc.sourceUrl)
      });
      if (normalizedPuestoLoose) {
        if (!byPuestoLoose.has(normalizedPuestoLoose)) byPuestoLoose.set(normalizedPuestoLoose, []);
        byPuestoLoose.get(normalizedPuestoLoose).push({
          localidad: safeText(doc.zonaNombre || doc.localidad),
          normalizedLocalidad,
          puesto: safeText(doc.puesto),
          normalizedPuesto,
          normalizedPuestoLoose,
          codigoPuesto: safeText(doc.codigoPuesto),
          mesa,
          sourceUrl: safeText(doc.sourceUrl)
        });
      }

      if (!byPuestoAcrossLocalidades.has(normalizedPuesto)) {
        byPuestoAcrossLocalidades.set(normalizedPuesto, new Set());
      }
      byPuestoAcrossLocalidades.get(normalizedPuesto).add(normalizedLocalidad);
    });

    const catalog = {
      version: buildCatalogVersion(docs.length),
      totalMesas: docs.length,
      totalPuestos: byScopedPuesto.size,
      byScopedPuesto,
      byScopedPuestoLoose,
      byPuesto,
      byPuestoLoose,
      byPuestoAcrossLocalidades,
      uniqueCatalogLocalidades: [...uniqueCatalogLocalidades.values()],
      scopeIsCityWide: false
    };

    return this.setCache("bogota", catalog);
  }

  suggestPuesto(normalizedPuesto, catalog, normalizedLocalidad = "") {
    const candidateKeys = [];
    catalog.byScopedPuesto.forEach((_, scopedKey) => {
      const [candidateLocalidad, candidatePuesto] = scopedKey.split("::");
      if (!normalizedLocalidad || candidateLocalidad === normalizedLocalidad) {
        candidateKeys.push(scopedKey);
      }
    });

    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    candidateKeys.forEach((scopedKey) => {
      const candidatePuesto = scopedKey.split("::")[1];
      const distance = levenshteinDistance(normalizedPuesto, candidatePuesto);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = scopedKey;
      }
    });

    if (!best) return null;
    const maxAllowed = Math.max(3, Math.floor(normalizedPuesto.length * 0.25));
    if (bestDistance > maxAllowed) return null;
    const candidate = catalog.byScopedPuesto.get(best);
    if (!candidate) return null;
    return {
      puesto: candidate.puesto,
      localidad: candidate.localidad,
      codigoPuesto: candidate.codigoPuesto || "",
      confidence: Number((1 - (bestDistance / Math.max(normalizedPuesto.length, 1))).toFixed(4))
    };
  }

  async getCatalogSelectors(options = {}) {
    const catalog = options.catalog || await this.loadCatalog();
    const localidades = catalog.uniqueCatalogLocalidades
      .map((normalizedLocalidad) => {
        const sample = [...catalog.byScopedPuesto.entries()]
          .find(([key]) => key.startsWith(`${normalizedLocalidad}::`));
        return {
          value: sample?.[1]?.localidad || normalizedLocalidad,
          normalized: normalizedLocalidad
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value, "es"));

    return {
      catalogVersion: catalog.version,
      localidades
    };
  }

  async getCatalogVersion() {
    const catalog = await this.loadCatalog();
    return catalog.version;
  }

  async getPuestosByLocalidad(localidad, options = {}) {
    const catalog = options.catalog || await this.loadCatalog();
    const normalizedLocalidad = normalizeText(canonicalizeBogotaLocality(localidad) || localidad);
    if (!normalizedLocalidad) return [];

    return [...catalog.byScopedPuesto.entries()]
      .filter(([key]) => key.startsWith(`${normalizedLocalidad}::`))
      .map(([, value]) => ({
        localidad: value.localidad,
        puesto: value.puesto,
        codigoPuesto: value.codigoPuesto || "",
        mesas: [...value.mesas].sort((a, b) => a - b)
      }))
      .sort((a, b) => a.puesto.localeCompare(b.puesto, "es"));
  }

  async getMesasByPuesto(localidad, puesto, options = {}) {
    const catalog = options.catalog || await this.loadCatalog();
    const normalizedLocalidad = normalizeText(canonicalizeBogotaLocality(localidad) || localidad);
    const normalizedPuesto = normalizeText(puesto);
    const normalizedPuestoLoose = puestoMatchingService.normalizePuestoName(puesto, { loose: true });
    const exact =
      catalog.byScopedPuesto.get(`${normalizedLocalidad}::${normalizedPuesto}`)
      || catalog.byScopedPuestoLoose.get(`${normalizedLocalidad}::${normalizedPuestoLoose}`);
    if (!exact) return [];
    return [...exact.mesas].sort((a, b) => a - b);
  }

  validateRegistrationAgainstOfficialCatalog(registration, catalog) {
    const localidadRaw = safeText(registration.localidad);
    const canonicalLocalidad = safeText(canonicalizeBogotaLocality(localidadRaw) || localidadRaw);
    const normalizedLocalidad = normalizeText(canonicalLocalidad);
    const puestoRaw = safeText(registration.legacyVotingPlace || registration.puestoRawLegacy || registration.puesto);
    const normalizedPuesto = normalizeText(registration.puesto);
    const normalizedPuestoLoose = puestoMatchingService.normalizePuestoName(registration.puesto, { loose: true });
    const mesa = normalizeMesaNumber(registration.mesa);

    const base = {
      registrationId: registration.registrationId,
      leaderName: registration.leaderName || "Sin lider",
      localidadRaw,
      puestoRaw,
      mesaRaw: registration.mesa,
      normalizedLocalidad: canonicalLocalidad,
      normalizedPuesto: safeText(registration.puesto),
      suggestedCorrection: null,
      officialLocalidadId: null,
      officialPuestoId: null,
      officialMesaNumero: mesa,
      officialPuestoCodigo: "",
      officialPuestoNombre: "",
      officialLocalidadNombre: "",
      officialMesaValid: false,
      officialPuestoValid: false,
      catalogVersion: catalog.version
    };

    if (!canonicalizeBogotaLocality(canonicalLocalidad)) {
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: "outside_official_scope",
        mismatchReason: "Fuera del alcance del catalogo oficial Bogota"
      };
    }

    if (!normalizedLocalidad) {
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: "incomplete",
        mismatchReason: "localidad_inconsistente"
      };
    }

    if (!registration.puestoId || registration.isPendingNormalization || !normalizedPuesto || normalizedPuesto === "PENDIENTE NORMALIZACION") {
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: registration.legacyVotingPlace ? "unresolved_legacy" : "incomplete",
        mismatchReason: registration.legacyVotingPlace ? "unresolved_legacy" : "puesto_faltante"
      };
    }

    if (["SIN PUESTO", "PUESTO CABECERA MUNICIPAL", "CABECERA MUNICIPAL"].includes(normalizeText(puestoRaw))) {
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: "placeholder_or_noise",
        mismatchReason: "placeholder"
      };
    }

    const normalizedRegistrationPuesto = normalizeText(registration.puesto);
    const normalizedRegistrationPuestoLoose = normalizedPuestoLoose || puestoMatchingService.normalizePuestoName(registration.puesto);
    const scopedKey = `${normalizedLocalidad}::${normalizedRegistrationPuesto}`;
    const scopedLooseKey = `${normalizedLocalidad}::${normalizedRegistrationPuestoLoose}`;
    let exact = catalog.byScopedPuesto.get(scopedKey)
      || catalog.byScopedPuestoLoose.get(scopedLooseKey);
    const samePuestoAnyLocalidad = catalog.byPuesto.get(normalizeText(registration.puesto))
      || catalog.byPuestoLoose.get(normalizedRegistrationPuestoLoose)
      || [];
    if (!exact && samePuestoAnyLocalidad.length > 0 && catalog.scopeIsCityWide) {
      exact = {
        localidad: samePuestoAnyLocalidad[0].localidad,
        puesto: samePuestoAnyLocalidad[0].puesto,
        codigoPuesto: samePuestoAnyLocalidad[0].codigoPuesto || "",
        mesas: new Set(samePuestoAnyLocalidad.map((item) => item.mesa))
      };
    }

    if (!exact) {
      const suggestedSameLocalidad = this.suggestPuesto(normalizeText(registration.puesto), catalog, normalizedLocalidad);
      if (
        suggestedSameLocalidad
        && normalizeText(suggestedSameLocalidad.localidad) === normalizedLocalidad
        && Number(suggestedSameLocalidad.confidence || 0) >= 0.88
      ) {
        const suggestedPuestoKey = `${normalizedLocalidad}::${normalizeText(suggestedSameLocalidad.puesto)}`;
        const suggestedLooseKey = `${normalizedLocalidad}::${puestoMatchingService.normalizePuestoName(suggestedSameLocalidad.puesto, { loose: true })}`;
        exact = catalog.byScopedPuesto.get(suggestedPuestoKey)
          || catalog.byScopedPuestoLoose.get(suggestedLooseKey)
          || null;
      }
    }

    if (!exact) {
      const samePuestoLocalidades = [...new Set(samePuestoAnyLocalidad.map((item) => item.normalizedLocalidad))];
      if (samePuestoLocalidades.length > 0 && !catalog.scopeIsCityWide) {
        const suggested = samePuestoAnyLocalidad[0];
        return {
          ...base,
          isOfficiallyValid: false,
          mismatchType: "mismatched_localidad",
          mismatchReason: "puesto_pertenece_a_otra_localidad",
          suggestedCorrection: {
            localidad: suggested.localidad,
            puesto: suggested.puesto,
            codigoPuesto: suggested.codigoPuesto || ""
          },
          officialPuestoValid: true
        };
      }

      const suggestedCorrection = this.suggestPuesto(normalizeText(registration.puesto), catalog, normalizedLocalidad);
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: "invalid_puesto",
        mismatchReason: "puesto_no_oficial",
        suggestedCorrection
      };
    }

    if (mesa === null) {
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: "incomplete",
        mismatchReason: "mesa_faltante",
        officialPuestoValid: true,
        officialPuestoCodigo: exact.codigoPuesto || "",
        officialPuestoNombre: exact.puesto,
        officialLocalidadNombre: exact.localidad
      };
    }

    if (!exact.mesas.has(mesa)) {
      return {
        ...base,
        isOfficiallyValid: false,
        mismatchType: "invalid_mesa",
        mismatchReason: "mesa_no_existe_en_puesto_oficial",
        officialPuestoValid: true,
        officialPuestoCodigo: exact.codigoPuesto || "",
        officialPuestoNombre: exact.puesto,
        officialLocalidadNombre: exact.localidad
      };
    }

    return {
      ...base,
      isOfficiallyValid: true,
      mismatchType: "official_valid",
      mismatchReason: "official_valid",
      officialPuestoValid: true,
      officialMesaValid: true,
      officialPuestoCodigo: exact.codigoPuesto || "",
      officialPuestoNombre: exact.puesto,
      officialLocalidadNombre: exact.localidad
    };
  }

  async validateBulkRegistrations(registrations = [], options = {}) {
    const catalog = options.catalog || await this.loadCatalog();
    const results = registrations.map((registration) => {
      const validation = this.validateRegistrationAgainstOfficialCatalog(registration, catalog);
      return {
        ...registration,
        officialValidation: validation,
        officialValidationStatus: validation.mismatchType,
        movedToErrorBucket: !validation.isOfficiallyValid,
        errorBucketReason: validation.isOfficiallyValid ? "" : validation.mismatchReason
      };
    });

    const officialRows = results.filter((row) => row.officialValidation.isOfficiallyValid);
    const errorRows = results
      .filter((row) => !row.officialValidation.isOfficiallyValid)
      .map((row) => ({
        registrationId: row.registrationId,
        eventId: row.eventId || null,
        leaderName: row.leaderName || "Sin lider",
        localidadRaw: row.original?.localidad || row.localidad || "",
        puestoRaw: row.original?.votingPlace || row.legacyVotingPlace || row.puestoRawLegacy || "",
        mesaRaw: row.original?.mesa ?? row.original?.votingTable ?? row.mesa ?? null,
        normalizedLocalidad: row.localidad || "",
        normalizedPuesto: row.puesto || "",
        suggestedOfficialPuesto: row.officialValidation?.suggestedCorrection?.puesto || "",
        suggestedOfficialLocalidad: row.officialValidation?.suggestedCorrection?.localidad || "",
        suggestedOfficialCodigoPuesto: row.officialValidation?.suggestedCorrection?.codigoPuesto || "",
        reason: row.officialValidation.mismatchReason,
        status: row.officialValidation.mismatchType,
        createdAt: row.original?.createdAt || null,
        cedula: row.cedula || "",
        firstName: row.firstName || "",
        lastName: row.lastName || "",
        legacyVotingPlace: row.legacyVotingPlace || "",
        puestoMatchStatus: row.puestoMatchStatus || "",
        puestoMatchConfidence: row.puestoMatchConfidence ?? null,
        reviewStatus: row.original?.officialValidationReviewed === true ? "reviewed" : "pending",
        officialCatalogVersion: catalog.version
      }));

    if (options.persist === true && errorRows.length + officialRows.length > 0) {
      await this.persistValidationResults(results, options);
    }

    const counters = results.reduce((acc, row) => {
      const key = row.officialValidation.mismatchType;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, { official_valid: 0 });

    return {
      catalog,
      officialRows,
      errorRows,
      results,
      counters
    };
  }

  async persistValidationResults(results = [], options = {}) {
    const organizationId = options.organizationId || null;
    const writes = results
      .filter((row) => row.registrationId)
      .map((row) => ({
        updateOne: {
          filter: {
            _id: row.registrationId,
            ...(organizationId ? { organizationId } : {})
          },
          update: {
            $set: {
              officialValidationStatus: row.officialValidation.mismatchType,
              officialValidationReason: row.officialValidation.mismatchReason,
              officialCatalogVersion: row.officialValidation.catalogVersion || "",
              officialLocalidadNombre: row.officialValidation.officialLocalidadNombre || "",
              officialPuestoNombre: row.officialValidation.officialPuestoNombre || "",
              officialPuestoCodigo: row.officialValidation.officialPuestoCodigo || "",
              officialMesaNumero: row.officialValidation.officialMesaNumero ?? null,
              officialMesaValid: row.officialValidation.officialMesaValid === true,
              officialPuestoValid: row.officialValidation.officialPuestoValid === true,
              movedToErrorBucket: !row.officialValidation.isOfficiallyValid,
              errorBucketReason: row.officialValidation.isOfficiallyValid ? "" : row.officialValidation.mismatchReason,
              officialSuggestedPuesto: row.officialValidation?.suggestedCorrection?.puesto || "",
              officialSuggestedLocalidad: row.officialValidation?.suggestedCorrection?.localidad || ""
            }
          }
        }
      }));

    if (writes.length === 0) return { updated: 0 };
    const result = await Registration.bulkWrite(writes, { ordered: false });
    await metricsCacheService.invalidateMetricsForRegistrationScope({
      organizationId,
      eventId: null,
      leaderId: null
    });
    logger.info("[OfficialE14CatalogService] persisted validation results", {
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0
    });
    return {
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0
    };
  }
}

const officialE14CatalogService = new OfficialE14CatalogService();

export default officialE14CatalogService;
