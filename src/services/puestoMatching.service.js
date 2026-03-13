import { distance } from "fastest-levenshtein";
import logger from "../config/logger.js";
import {
  Localidad,
  PuestoMatchReview,
  Puestos,
  Registration
} from "../models/index.js";
import { aliasPuestos } from "../utils/aliasPuestos.js";
import {
  canonicalizeBogotaLocality,
  normalizeTerritoryText
} from "../shared/territoryNormalization.js";
import { buildTextSkeleton, repairTextEncoding } from "../shared/textNormalization.js";

const MATCH_REVIEW_BUCKET = "Pendiente normalizacion";
const GENERIC_STOPWORDS = new Set([
  "COLEGIO",
  "INSTITUCION",
  "EDUCATIVA",
  "INSTITUTO",
  "DISTRITAL",
  "PUESTO",
  "VOTACION",
  "SEDE",
  "DE",
  "DEL",
  "LA",
  "EL",
  "LOS",
  "LAS"
]);
const SUSPICIOUS_VALUES = new Set([
  "",
  "SIN PUESTO",
  "PUESTO CABECERA MUNICIPAL",
  "CABECERA MUNICIPAL",
  "00 PUESTO CABECERA MUNICIPAL"
]);

function safeText(value) {
  return String(value || "").trim();
}

function toObjectIdString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value?.toString === "function" && value.constructor?.name === "ObjectId") {
    return value.toString();
  }
  if (typeof value === "object" && value._id) return toObjectIdString(value._id);
  return String(value);
}

function normalizeBaseText(value) {
  return normalizeTerritoryText(repairTextEncoding(value))
    .replace(/\b(IE|IED|I E D|INST|INSTT|INSTITUCION EDUCATIVA DISTRITAL)\b/g, " INSTITUCION EDUCATIVA ")
    .replace(/\bCC\b/g, " CENTRO COMERCIAL ")
    .replace(/\bUNIV\b/g, " UNIVERSIDAD ")
    .replace(/\bCOL\b/g, " COLEGIO ")
    .replace(/\bSD\b/g, " SEDE ")
    .replace(/\bNO\b/g, " ")
    .replace(/^\d{1,3}[A-Z]?\s+/g, "")
    .replace(/^\d{1,3}[A-Z]?\s*[-.]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLooseText(value) {
  const tokens = normalizeBaseText(value)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !GENERIC_STOPWORDS.has(token));
  return tokens.join(" ").trim();
}

function tokenSimilarity(a, b) {
  const aTokens = new Set(normalizeLooseText(a).split(" ").filter(Boolean));
  const bTokens = new Set(normalizeLooseText(b).split(" ").filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let hits = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) hits += 1;
  });
  return hits / Math.max(aTokens.size, bTokens.size, 1);
}

function levenshteinSimilarity(a, b) {
  const left = normalizeBaseText(a);
  const right = normalizeBaseText(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length, 1);
  return 1 - (distance(left, right) / maxLength);
}

function skeletonSimilarity(a, b) {
  const left = buildTextSkeleton(a);
  const right = buildTextSkeleton(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length, 1);
  return 1 - (distance(left, right) / maxLength);
}

function buildReviewKey(rawPuesto, rawLocalidad) {
  return `${normalizeBaseText(rawLocalidad)}::${normalizeBaseText(rawPuesto)}`;
}

function isSameAsLocalidad(rawPuesto, rawLocalidad) {
  const normalizedPuesto = normalizeLooseText(rawPuesto);
  const normalizedLocalidad = normalizeLooseText(canonicalizeBogotaLocality(rawLocalidad) || rawLocalidad);
  return Boolean(normalizedPuesto && normalizedLocalidad && normalizedPuesto === normalizedLocalidad);
}

function isSuspiciousPlaceholder(rawPuesto) {
  const normalized = normalizeBaseText(rawPuesto);
  return SUSPICIOUS_VALUES.has(normalized);
}

function isBroadBogotaScope(rawLocalidad) {
  const normalized = normalizeTerritoryText(rawLocalidad);
  if (!normalized) return false;
  if (canonicalizeBogotaLocality(rawLocalidad)) return false;
  return normalized.startsWith("BOGOT")
    || normalized === "BOGOTA D C"
    || normalized === "BOGOTA DC"
    || normalized === "BOGOTA D C COLOMBIA";
}

function candidateAliasTargets(rawName) {
  const normalized = normalizeLooseText(rawName);
  if (!normalized) return [];
  return Object.entries(aliasPuestos)
    .filter(([alias, official]) => {
      const aliasLoose = normalizeLooseText(alias);
      const officialLoose = normalizeLooseText(official);
      return normalized === aliasLoose
        || normalized.includes(aliasLoose)
        || aliasLoose.includes(normalized)
        || normalized === officialLoose;
    })
    .map(([, official]) => official);
}

class PuestoMatchingService {
  constructor() {
    this.masterCache = new Map();
    this.reviewCache = new Map();
    this.cacheTtlMs = 5 * 60 * 1000;
  }

  normalizePuestoName(rawName, options = {}) {
    const normalized = normalizeBaseText(rawName);
    if (options.loose) return normalizeLooseText(normalized);
    return normalized;
  }

  getCache(store, key) {
    const current = store.get(key);
    if (!current) return null;
    if (Date.now() - current.createdAt > this.cacheTtlMs) {
      store.delete(key);
      return null;
    }
    return current.value;
  }

  setCache(store, key, value) {
    store.set(key, { value, createdAt: Date.now() });
    return value;
  }

  clearCaches() {
    this.masterCache.clear();
    this.reviewCache.clear();
  }

  buildMasterIndex(puestos = []) {
    const byLocalidad = new Map();
    const byName = new Map();

    puestos.forEach((puesto) => {
      const localidadId = toObjectIdString(puesto.localidadId);
      const entry = {
        ...puesto,
        normalizedNombre: this.normalizePuestoName(puesto.nombre),
        normalizedLooseNombre: this.normalizePuestoName(puesto.nombre, { loose: true }),
        aliases: Array.isArray(puesto.aliases) ? puesto.aliases : []
      };

      if (localidadId) {
        if (!byLocalidad.has(localidadId)) byLocalidad.set(localidadId, []);
        byLocalidad.get(localidadId).push(entry);
      }

      const names = [entry.nombre, ...(entry.aliases || [])];
      names.forEach((name) => {
        const key = this.normalizePuestoName(name);
        if (!key) return;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(entry);
      });
    });

    return { puestos, byLocalidad, byName };
  }

  async loadMaster(organizationId = null) {
    const cacheKey = organizationId || "global";
    const cached = this.getCache(this.masterCache, cacheKey);
    if (cached) return cached;

    const puestos = await Puestos.find(
      organizationId
        ? { $or: [{ organizationId }, { organizationId: null }, { organizationId: { $exists: false } }] }
        : {},
      {
        nombre: 1,
        codigoPuesto: 1,
        aliases: 1,
        localidad: 1,
        localidadId: 1,
        normalizedNombre: 1,
        organizationId: 1,
        activo: 1
      }
    ).lean();

    return this.setCache(this.masterCache, cacheKey, this.buildMasterIndex(puestos.filter((item) => item.activo !== false)));
  }

  scoreMatch(rawName, officialPuesto) {
    const rawNormalized = this.normalizePuestoName(rawName);
    const rawLoose = this.normalizePuestoName(rawName, { loose: true });
    const candidateNames = [officialPuesto.nombre, ...(officialPuesto.aliases || [])];
    const aliasHints = candidateAliasTargets(rawName);

    let best = {
      score: 0,
      type: "unmatched",
      matchedText: officialPuesto.nombre
    };

    candidateNames.forEach((candidate) => {
      const candidateNormalized = this.normalizePuestoName(candidate);
      const candidateLoose = this.normalizePuestoName(candidate, { loose: true });
      let score = 0;
      let type = "fuzzy_low_confidence";

      if (rawNormalized && rawNormalized === candidateNormalized) {
        score = 1;
        type = "normalized_exact";
      } else if (rawLoose && candidateLoose && rawLoose === candidateLoose) {
        score = 0.97;
        type = "normalized_exact";
      } else {
        const tokenScore = tokenSimilarity(rawName, candidate);
        const levenshteinScore = levenshteinSimilarity(rawName, candidate);
        const skeletonScore = skeletonSimilarity(rawName, candidate);
        score = Math.max(
          tokenScore * 0.45 + levenshteinScore * 0.2 + skeletonScore * 0.35,
          rawNormalized.includes(candidateLoose) || candidateNormalized.includes(rawLoose) ? 0.9 : 0,
          skeletonScore >= 0.9 ? skeletonScore : 0
        );
        if (score >= 0.93) type = "fuzzy_high_confidence";
        else if (score >= 0.78) type = "fuzzy_low_confidence";
      }

      if (aliasHints.some((hint) => this.normalizePuestoName(hint) === candidateNormalized)) {
        score = Math.max(score, 0.96);
        type = score >= 0.98 ? "normalized_exact" : "fuzzy_high_confidence";
      }

      if (score > best.score) {
        best = { score, type, matchedText: candidate };
      }
    });

    return best;
  }

  generateMatchCandidates(rawName, localidadId, options = {}) {
    const master = options.master || this.buildMasterIndex(options.masterPuestos || []);
    const sameLocalidad = localidadId ? (master.byLocalidad.get(toObjectIdString(localidadId)) || []) : [];
    const sameCandidates = sameLocalidad
      .map((puesto) => ({
        puesto,
        localityScope: "same_localidad",
        ...this.scoreMatch(rawName, puesto)
      }))
      .filter((item) => item.score > 0);

    if (sameCandidates.length > 0) {
      return sameCandidates.sort((a, b) => b.score - a.score);
    }

    return master.puestos
      .map((puesto) => ({
        puesto,
        localityScope: "cross_localidad",
        ...this.scoreMatch(rawName, puesto)
      }))
      .filter((item) => item.score >= 0.82)
      .sort((a, b) => b.score - a.score);
  }

  async resolvePuesto(rawName, localidadId, options = {}) {
    const master = options.master || await this.loadMaster(options.organizationId || null);
    const normalizedRaw = this.normalizePuestoName(rawName);
    const rawLocalidad = options.rawLocalidad || "";
    const sameAsLocalidad = isSameAsLocalidad(rawName, rawLocalidad);
    if (!normalizedRaw || isSuspiciousPlaceholder(rawName) || sameAsLocalidad) {
      return {
        rawPuesto: rawName,
        normalizedValue: normalizedRaw,
        confidence: sameAsLocalidad ? 0.15 : 0,
        matchType: sameAsLocalidad ? "unmatched_localidad_as_puesto" : "unmatched",
        status: "unmatched",
        requiresManualReview: true,
        autoAssignable: false,
        suggestedPuestoId: null,
        suggestedLocalidadId: null,
        suggestedPuestoNombre: "",
        suggestedLocalidadNombre: "",
        reviewNotes: sameAsLocalidad
          ? "El puesto coincide con el nombre de la localidad y es sospechoso"
          : "Valor vacio/generico o sin evidencia suficiente"
      };
    }

    const candidates = this.generateMatchCandidates(rawName, localidadId, { ...options, master });
    if (!candidates.length) {
      return {
        rawPuesto: rawName,
        normalizedValue: normalizedRaw,
        confidence: 0,
        matchType: "unmatched",
        status: "unmatched",
        requiresManualReview: true,
        autoAssignable: false,
        suggestedPuestoId: null,
        suggestedLocalidadId: null,
        suggestedPuestoNombre: "",
        suggestedLocalidadNombre: "",
        reviewNotes: "No se encontro puesto oficial candidato"
      };
    }

    const best = candidates[0];
    const second = candidates[1] || null;
    const margin = best.score - (second?.score || 0);
    const bestLocalidadId = toObjectIdString(best.puesto.localidadId);
    const requestedLocalidadId = toObjectIdString(localidadId);
    const topScore = best.score;
    const topCandidates = candidates.filter((candidate) => candidate.score === topScore);
    const bestNormalizedTarget = this.normalizePuestoName(best.puesto.nombre);
    const uniqueTargetAtTop = topCandidates.every((candidate) =>
      this.normalizePuestoName(candidate.puesto.nombre) === bestNormalizedTarget
      && toObjectIdString(candidate.puesto.localidadId) === bestLocalidadId
    );
    const broadBogotaScope = isBroadBogotaScope(rawLocalidad);
    const crossLocalidad = Boolean(
      bestLocalidadId
      && requestedLocalidadId
      && bestLocalidadId !== requestedLocalidadId
      && !broadBogotaScope
    );

    let status = "pending";
    let requiresManualReview = true;
    let autoAssignable = false;
    let matchType = best.type;

    if (
      !crossLocalidad
      && (
        (best.type === "normalized_exact" && (margin >= 0.03 || uniqueTargetAtTop))
        || best.score >= 0.93
      )
    ) {
      status = "accepted_auto";
      requiresManualReview = false;
      autoAssignable = true;
    } else if (!crossLocalidad && broadBogotaScope && (best.type === "normalized_exact" || best.score >= 0.96) && margin >= 0.03) {
      status = "accepted_auto";
      requiresManualReview = false;
      autoAssignable = true;
      matchType = "city_scope_auto_assign";
    } else if (crossLocalidad && best.score >= 0.94 && margin >= 0.04) {
      status = "cross_localidad";
      matchType = "cross_localidad";
      requiresManualReview = true;
    } else if (best.score < 0.78) {
      status = "unmatched";
      matchType = "unmatched";
      requiresManualReview = true;
    }

    return {
      rawPuesto: rawName,
      normalizedValue: normalizedRaw,
      confidence: Number(best.score.toFixed(4)),
      matchType,
      status,
      requiresManualReview,
      autoAssignable,
      suggestedPuestoId: toObjectIdString(best.puesto._id),
      suggestedLocalidadId: bestLocalidadId,
      suggestedPuestoNombre: best.puesto.nombre,
      suggestedLocalidadNombre: best.puesto.localidad,
      reviewNotes: crossLocalidad
        ? `Coincidencia fuerte en otra localidad: ${best.puesto.localidad}`
        : autoAssignable
          ? "Coincidencia automatica de alta confianza"
          : "Requiere revision manual"
    };
  }

  async persistReview(result, payload = {}, options = {}) {
    const organizationId = options.organizationId || null;
    if (!organizationId) return null;

    const rawPuesto = safeText(payload.rawPuesto);
    const rawLocalidad = safeText(payload.rawLocalidad);
    const normalizedRawPuesto = this.normalizePuestoName(rawPuesto);
    const rawLocalidadNormalized = normalizeTerritoryText(canonicalizeBogotaLocality(rawLocalidad) || rawLocalidad);
    const cacheKey = buildReviewKey(rawPuesto, rawLocalidad);

    const update = {
      organizationId,
      rawPuesto,
      normalizedRawPuesto,
      rawLocalidad,
      rawLocalidadNormalized,
      rawLocalidadId: payload.rawLocalidadId || null,
      suggestedPuestoId: result.suggestedPuestoId || null,
      suggestedLocalidadId: result.suggestedLocalidadId || null,
      suggestedPuestoNombre: result.suggestedPuestoNombre || "",
      suggestedLocalidadNombre: result.suggestedLocalidadNombre || "",
      confidence: result.confidence ?? null,
      matchType: result.matchType || "",
      status: result.status || "pending",
      autoAssignable: result.autoAssignable === true,
      requiresManualReview: result.requiresManualReview === true,
      notes: result.reviewNotes || "",
      sampleCount: Number(payload.sampleCount || 0)
    };

    await PuestoMatchReview.updateOne(
      {
        organizationId,
        normalizedRawPuesto,
        rawLocalidadNormalized
      },
      {
        $set: update,
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    this.reviewCache.set(cacheKey, update);
    return update;
  }

  async resolveBulkLegacyPuestos(items = [], options = {}) {
    const organizationId = options.organizationId || null;
    const master = options.master || await this.loadMaster(organizationId);
    const rows = Array.isArray(items) ? items : [];
    const unique = new Map();

    rows.forEach((row) => {
      const rawPuesto = safeText(row.rawPuesto || row.votingPlace);
      const rawLocalidad = safeText(row.rawLocalidad || row.localidad);
      if (!rawPuesto) return;
      const key = buildReviewKey(rawPuesto, rawLocalidad);
      if (!unique.has(key)) {
        unique.set(key, {
          rawPuesto,
          rawLocalidad,
          rawLocalidadId: row.rawLocalidadId || null,
          count: 0,
          registrationIds: []
        });
      }
      const current = unique.get(key);
      current.count += 1;
      if (row.registrationId) current.registrationIds.push(row.registrationId);
    });

    const results = new Map();
    for (const [key, item] of unique.entries()) {
      const cached = this.reviewCache.get(key);
      if (cached) {
        results.set(key, cached);
        continue;
      }

      const normalizedRawPuesto = this.normalizePuestoName(item.rawPuesto);
      const rawLocalidadNormalized = normalizeTerritoryText(canonicalizeBogotaLocality(item.rawLocalidad) || item.rawLocalidad);
      const existing = organizationId
        ? await PuestoMatchReview.findOne({
            organizationId,
            normalizedRawPuesto,
            rawLocalidadNormalized
          }).lean()
        : null;

      if (existing) {
        this.reviewCache.set(key, existing);
        results.set(key, existing);
        continue;
      }

      const resolved = await this.resolvePuesto(item.rawPuesto, item.rawLocalidadId, {
        ...options,
        master,
        rawLocalidad: item.rawLocalidad
      });
      const persisted = await this.persistReview(resolved, {
        rawPuesto: item.rawPuesto,
        rawLocalidad: item.rawLocalidad,
        rawLocalidadId: item.rawLocalidadId,
        sampleCount: item.count
      }, { organizationId });
      results.set(key, persisted || resolved);
    }

    const byRegistrationId = new Map();
    rows.forEach((row) => {
      const key = buildReviewKey(row.rawPuesto || row.votingPlace, row.rawLocalidad || row.localidad);
      const result = results.get(key) || null;
      if (row.registrationId && result) {
        byRegistrationId.set(row.registrationId, result);
      }
    });

    return {
      byRegistrationId,
      byReviewKey: results
    };
  }

  async auditLegacyPuestos(filters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const query = {
      ...(organizationId ? { organizationId } : {}),
      ...(filters.eventId ? { eventId: String(filters.eventId) } : {}),
      votingPlace: { $nin: [null, ""] }
    };
    if (filters.onlyUnresolved !== false) {
      query.$or = [
        { puestoId: null },
        { puestoId: { $exists: false } },
        { puestoMatchReviewRequired: true }
      ];
    }

    const rows = await Registration.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            localidad: "$localidad",
            localidadId: "$localidadId",
            votingPlace: "$votingPlace"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const resolved = await this.resolveBulkLegacyPuestos(
      rows.map((row) => ({
        registrationId: null,
        rawPuesto: row._id.votingPlace,
        rawLocalidad: row._id.localidad,
        rawLocalidadId: row._id.localidadId
      })),
      options
    );

    const items = rows.map((row) => {
      const review = resolved.byReviewKey.get(buildReviewKey(row._id.votingPlace, row._id.localidad)) || null;
      return {
        rawPuesto: row._id.votingPlace,
        normalizedPuesto: this.normalizePuestoName(row._id.votingPlace),
        rawLocalidad: row._id.localidad,
        rawLocalidadId: row._id.localidadId,
        count: row.count,
        suggestedPuesto: review?.suggestedPuestoNombre || "",
        suggestedLocalidad: review?.suggestedLocalidadNombre || "",
        confidence: review?.confidence ?? null,
        status: review?.status || "pending",
        matchType: review?.matchType || "",
        requiresManualReview: review?.requiresManualReview ?? true
      };
    });

    return {
      total: items.length,
      suspicious: items.filter((item) => item.requiresManualReview),
      items
    };
  }
}

const puestoMatchingService = new PuestoMatchingService();

export { MATCH_REVIEW_BUCKET };
export default puestoMatchingService;
