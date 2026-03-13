import mongoose from "mongoose";
import logger from "../config/logger.js";
import {
  E14ConfirmationByMesa,
  Localidad,
  Mesa,
  Puestos,
  Registration
} from "../models/index.js";
import { applyCleanAnalyticsFilter } from "../shared/analyticsFilter.js";
import { buildE14NavigationHint, getBogotaZoneCode } from "../shared/bogota-zones.js";
import {
  canonicalizeBogotaLocality,
  getBogotaLocalidadesCanonical,
  isBogotaTerritory,
  normalizeTerritoryText
} from "../shared/territoryNormalization.js";
import { repairTextEncoding } from "../shared/textNormalization.js";
import { applyPollingPlaceOverride } from "../shared/polling-place-overrides.js";
import officialE14CatalogService from "./officialE14Catalog.service.js";
import puestoMatchingService, { MATCH_REVIEW_BUCKET } from "./puestoMatching.service.js";

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toObjectIdString(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  if (typeof value === "object" && value._id) return toObjectIdString(value._id);
  return String(value);
}

function safeText(value) {
  return String(value || "").trim();
}

function safeDisplayText(value, fallback = "") {
  const repaired = repairTextEncoding(value);
  return safeText(repaired || fallback);
}

function normalizeName(value) {
  return normalizeTerritoryText(value);
}

function canonicalizeLocalityName(value) {
  return safeText(canonicalizeBogotaLocality(value) || value);
}

function normalizeLookupName(value) {
  return normalizeTerritoryText(value)
    .replace(/^\d+\s+/g, "")
    .replace(/^(LOCALIDAD|LOC|PUESTO)\s+/g, "")
    .trim();
}

function buildCompositeMesaKey({ localidadId, puestoId, mesa }) {
  return `${localidadId || "none"}::${puestoId || "none"}::${mesa ?? "none"}`;
}

function normalizeLegacyVariantList(values = []) {
  return [...new Set(
    values
      .map((value) => safeText(value))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "es"));
}

function shouldRecomputeLegacyMatch(registration) {
  const rawPuesto = safeText(registration?.votingPlace);
  if (!rawPuesto || registration?.puestoId) return false;
  const persistedRaw = safeText(registration?.puestoMatchRawName || registration?.legacyVotingPlace);
  if (!registration?.puestoMatchStatus) return true;
  if (!registration?.puestoMatchResolvedAt) return true;
  return persistedRaw !== rawPuesto;
}

function buildPersistedLegacyMatch(registration) {
  const status = safeText(registration?.puestoMatchStatus);
  if (!status || status === "not_applicable") return null;
  return {
    rawPuesto: safeText(registration?.puestoMatchRawName || registration?.votingPlace),
    normalizedValue: "",
    confidence: registration?.puestoMatchConfidence ?? null,
    matchType: safeText(registration?.puestoMatchType) || "persisted",
    status: status === "matched" ? "accepted_auto" : status,
    requiresManualReview: registration?.puestoMatchReviewRequired === true,
    autoAssignable: status === "matched" && Boolean(registration?.puestoMatchSuggestedPuestoId || registration?.puestoId),
    suggestedPuestoId: toObjectIdString(registration?.puestoMatchSuggestedPuestoId || registration?.puestoId),
    suggestedLocalidadId: toObjectIdString(registration?.puestoMatchSuggestedLocalidadId || registration?.localidadId),
    suggestedPuestoNombre: safeText(registration?.votingPlace),
    suggestedLocalidadNombre: safeText(registration?.localidad),
    reviewNotes: ""
  };
}

function getRegistrationVoteValue() {
  return 1;
}

function matchesStatus(doc, status) {
  if (!status || status === "all") return true;
  const isConfirmed = doc.confirmed === true || doc.workflowStatus === "confirmed";
  if (status === "confirmed") return isConfirmed;
  if (status === "unconfirmed") return !isConfirmed;
  return true;
}

function calculateConfirmation({ votosRegistrados, votosE14, hasMissingLocation = false }) {
  if (hasMissingLocation) {
    return { porcentaje: null, diferencia: null, estado: "datos_incompletos" };
  }

  const registrados = Number.isFinite(votosRegistrados) ? votosRegistrados : 0;
  const e14 = Number.isFinite(votosE14) ? votosE14 : null;

  if (registrados <= 0) {
    return {
      porcentaje: null,
      diferencia: e14 === null ? null : e14,
      estado: "sin_votos_reportados"
    };
  }

  if (e14 === null || e14 < 0) {
    return { porcentaje: null, diferencia: null, estado: "pendiente_e14" };
  }

  const porcentaje = Math.min(Number(((e14 / registrados) * 100).toFixed(2)), 100);
  const diferencia = e14 - registrados;

  let estado = "sin_confirmacion";
  if (porcentaje >= 100) estado = "confirmado";
  else if (porcentaje >= 60) estado = "confirmacion_alta";
  else if (porcentaje >= 30) estado = "confirmacion_parcial";
  else if (porcentaje >= 1) estado = "confirmacion_baja";

  return { porcentaje, diferencia, estado };
}

function buildRegistrationQuery(rawFilters = {}, organizationId = null) {
  const query = {};
  if (organizationId) query.organizationId = organizationId;
  if (rawFilters.eventId) query.eventId = String(rawFilters.eventId);
  if (rawFilters.leaderId) query.leaderId = String(rawFilters.leaderId);
  return query;
}

function buildSearchMatcher(search) {
  const needle = normalizeName(search);
  if (!needle) return null;
  return (row) =>
    normalizeName(row.localidad).includes(needle)
    || normalizeName(row.puesto).includes(needle)
    || normalizeName(row.leaderName).includes(needle)
    || normalizeName(row.cedula).includes(needle)
    || normalizeName(row.firstName).includes(needle)
    || normalizeName(row.lastName).includes(needle)
    || normalizeName(row.mesa).includes(needle);
}

function parseRegionScope(value) {
  const normalized = safeText(value).toLowerCase();
  if (!normalized || normalized === "all" || normalized === "todos") return "all";
  if (normalized === "bogota" || normalized === "bogotá") return "bogota";
  if (normalized === "nacional") return "resto";
  if (normalized === "resto" || normalized === "nacional" || normalized === "resto_pais" || normalized === "resto-del-pais") {
    return "resto";
  }
  return "all";
}

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "si"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return defaultValue;
}

function buildCacheKey(prefix, rawFilters = {}, options = {}) {
  const orderedFilters = Object.keys(rawFilters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = rawFilters[key];
      return acc;
    }, {});
  return JSON.stringify({
    prefix,
    organizationId: options.organizationId || null,
    filters: orderedFilters
  });
}

function pushAndCondition(query, condition) {
  if (!condition || Object.keys(condition).length === 0) return;
  query.$and = query.$and || [];
  query.$and.push(condition);
}

const HIERARCHY_SORT_ALLOWLIST = {
  localidades: {
    nombre: "localidadNombre",
    totalVotes: "totalVotes",
    totalRegistros: "totalRegistros",
    totalPuestos: "totalPuestos",
    totalMesas: "totalMesas"
  },
  puestos: {
    nombre: "puestoNombre",
    totalVotes: "totalVotes",
    totalRegistros: "totalRegistros",
    totalMesas: "totalMesas"
  },
  mesas: {
    numero: "mesaNumero",
    totalVotes: "totalVotes",
    totalRegistros: "totalRegistros"
  }
};

function buildChartEntity(scope, row = {}) {
  if (scope === "puesto") {
    const name = safeDisplayText(row.name || row.puestoNombre || row.puesto || row._id, "Sin puesto");
    return {
      ...row,
      id: safeText(row.id || row.puestoId || row.puestoCodigo || name),
      name,
      puestoNombre: name,
      totalRegistros: Number(row.totalRegistros ?? row.totalVotes ?? row.totalVotos ?? 0)
    };
  }

  if (scope === "localidad") {
    const name = safeDisplayText(row.name || row.localidadNombre || row.localidad || row._id, "Sin Localidad");
    return {
      ...row,
      id: safeText(row.id || row.localidadId || name),
      name,
      localidadNombre: name,
      totalRegistros: Number(row.totalRegistros ?? row.totalVotes ?? row.totalVotos ?? 0)
    };
  }

  if (scope === "mesa") {
    const numero = toInt(row.numero ?? row.mesaNumero ?? row.mesa);
    return {
      ...row,
      id: safeText(row.id || numero),
      numero,
      mesaNumero: numero,
      totalRegistros: Number(row.totalRegistros ?? row.totalVotes ?? row.totalVotos ?? 0)
    };
  }

  return row;
}

function normalizeHierarchySort(scope, sortBy, sortDir) {
  const allowlist = HIERARCHY_SORT_ALLOWLIST[scope] || {};
  const normalizedDir = String(sortDir || "").toLowerCase() === "asc" ? "asc" : "desc";
  const fallback = scope === "mesas" ? "numero" : "totalVotes";
  const normalizedSortBy = allowlist[sortBy] ? sortBy : fallback;
  return {
    field: allowlist[normalizedSortBy],
    direction: normalizedDir,
    requested: normalizedSortBy
  };
}

function sortHierarchyRows(rows = [], scope, sortBy, sortDir) {
  const { field, direction } = normalizeHierarchySort(scope, sortBy, sortDir);
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = a?.[field];
    const right = b?.[field];
    if (typeof left === "number" || typeof right === "number") {
      const numeric = (Number(left || 0) - Number(right || 0)) * multiplier;
      if (numeric !== 0) return numeric;
    } else {
      const textCompare = String(left || "").localeCompare(String(right || ""), "es") * multiplier;
      if (textCompare !== 0) return textCompare;
    }
    const fallbackField = scope === "localidades" ? "localidadNombre" : scope === "puestos" ? "puestoNombre" : "mesaNumero";
    return String(a?.[fallbackField] || "").localeCompare(String(b?.[fallbackField] || ""), "es");
  });
}

class VotingHierarchyService {
  constructor() {
    this.analyticsCache = new Map();
    this.e14Cache = new Map();
    this.cacheTtlMs = 30 * 1000;
  }

  getCacheEntry(store, key) {
    const item = store.get(key);
    if (!item) return null;
    if (Date.now() - item.createdAt > this.cacheTtlMs) {
      store.delete(key);
      return null;
    }
    return item.value;
  }

  setCacheEntry(store, key, value) {
    store.set(key, {
      value,
      createdAt: Date.now()
    });
    return value;
  }

  clearCaches() {
    this.analyticsCache.clear();
    this.e14Cache.clear();
  }

  buildValidationFromResolvedScope(scope) {
    const items = scope.registrations
      .filter((row) => row.issues.length > 0)
      .map((row) => ({
        registrationId: row.registrationId,
        localidadId: row.localidadId,
        localidad: row.localidad,
        puestoId: row.puestoId,
        puesto: row.puesto,
        mesaId: row.mesaId,
        mesa: row.mesa,
        issues: row.issues
      }));

    return {
      total: scope.registrations.length,
      inconsistencies: items.length,
      items
    };
  }

  getValidLocalidadesForBogota() {
    return getBogotaLocalidadesCanonical().map((nombre, index) => ({
      id: index + 1,
      nombre,
      normalizedNombre: normalizeName(nombre)
    }));
  }

  async loadScopeDocuments(rawFilters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const baseQuery = buildRegistrationQuery(rawFilters, organizationId);
    const rawQuery = { ...baseQuery };
    const cleanQuery = applyCleanAnalyticsFilter({ ...baseQuery });

    const shouldLoadConfirmations = options.includeConfirmations !== false;
    const [rawCount, cleanCount, registrations, confirmations, puestos] = await Promise.all([
      Registration.countDocuments(rawQuery),
      Registration.countDocuments(cleanQuery),
      Registration.find(rawQuery, {
        eventId: 1,
        leaderId: 1,
        leaderName: 1,
        firstName: 1,
        lastName: 1,
        cedula: 1,
        localidad: 1,
        localidadId: 1,
        departamento: 1,
        capital: 1,
        confirmed: 1,
        workflowStatus: 1,
        dataIntegrityStatus: 1,
        missingPollingPlace: 1,
        votingPlace: 1,
        legacyVotingPlace: 1,
        votingTable: 1,
        puestoId: 1,
        mesa: 1,
        mesaId: 1,
        puestoMatchStatus: 1,
        puestoMatchType: 1,
        puestoMatchConfidence: 1,
        puestoMatchReviewRequired: 1,
        puestoMatchRawName: 1,
        puestoMatchSuggestedPuestoId: 1,
        puestoMatchSuggestedLocalidadId: 1,
        puestoMatchResolvedAt: 1,
        officialValidationStatus: 1,
        officialValidationReason: 1,
        officialValidationReviewed: 1,
        officialCatalogVersion: 1,
        officialLocalidadNombre: 1,
        officialPuestoNombre: 1,
        officialPuestoCodigo: 1,
        officialMesaNumero: 1,
        officialMesaValid: 1,
        officialPuestoValid: 1,
        movedToErrorBucket: 1,
        errorBucketReason: 1,
        officialSuggestedPuesto: 1,
        officialSuggestedLocalidad: 1,
        createdAt: 1
      }).lean(),
      shouldLoadConfirmations
        ? E14ConfirmationByMesa.find(
          {
            ...(organizationId ? { organizationId } : {}),
            ...(rawFilters.eventId ? { eventId: String(rawFilters.eventId) } : {})
          },
          {
            eventId: 1,
            localidadId: 1,
            puestoId: 1,
            mesaId: 1,
            localidad: 1,
            puesto: 1,
            mesa: 1,
            zoneCode: 1,
            normalizedLocalidad: 1,
            normalizedPuesto: 1,
            votosReportadosTotales: 1,
            votosE14Candidate105: 1,
            votosE14SuggestedCandidate105: 1,
            e14ListVotes: 1,
            confirmacionPorcentaje: 1,
            diferencia: 1,
            estado: 1,
            notes: 1,
            validatedAt: 1,
            validatedBy: 1,
            source: 1,
            reviewRequired: 1,
            reviewReason: 1,
            taskId: 1,
            reviewPriorityRank: 1,
            sourceEstadoRevision: 1,
            sourceConfidence: 1,
            sourceScoreDigito: 1,
            sourceScoreSegundo: 1,
            sourceMetodoDigito: 1,
            sourceDebugDir: 1,
            sourceDocumento: 1,
            sourceArchivo: 1,
            sourceLocalFileUri: 1,
            sourceCaptureAvailable: 1,
            sourceOverlayPath: 1,
            sourceCellPath: 1,
            sourceMaskPath: 1,
            sourcePartyBlockPath: 1
          }
        ).lean()
        : Promise.resolve([]),
      Puestos.find(
        organizationId
          ? { $or: [{ organizationId }, { organizationId: null }, { organizationId: { $exists: false } }] }
          : {},
        {
          codigoPuesto: 1,
          nombre: 1,
          normalizedNombre: 1,
          localidad: 1,
          localidadId: 1,
          ciudad: 1,
          departamento: 1,
          mesas: 1,
          aliases: 1,
          organizationId: 1,
          activo: 1
        }
      ).lean()
    ]);

    return {
      organizationId,
      rawCount,
      cleanCount,
      registrations,
      confirmations,
      puestos: puestos.filter((puesto) => puesto.activo !== false)
    };
  }

  async syncMasterTables({ organizationId, puestos, registrations, confirmations }, options = {}) {
    const persist = options.persist === true;
    const localityCandidates = new Map();
    const pushLocalidadCandidate = (nombre, sourceOrganizationId = null) => {
      const displayName = safeText(canonicalizeBogotaLocality(nombre) || nombre);
      const normalizedNombre = normalizeName(displayName);
      if (!normalizedNombre) return;
      const key = `${sourceOrganizationId || "global"}::${normalizedNombre}`;
      if (!localityCandidates.has(key)) {
        localityCandidates.set(key, {
          organizationId: sourceOrganizationId || null,
          nombre: displayName,
          normalizedNombre
        });
      }
    };

    puestos.forEach((puesto) => pushLocalidadCandidate(puesto.localidad, puesto.organizationId || null));
    registrations.forEach((reg) => pushLocalidadCandidate(reg.localidad, organizationId));
    confirmations.forEach((row) => pushLocalidadCandidate(row.localidad, organizationId));

    if (persist && localityCandidates.size > 0) {
      await Localidad.bulkWrite(
        [...localityCandidates.values()].map((localidad) => ({
          updateOne: {
            filter: {
              organizationId: localidad.organizationId,
              normalizedNombre: localidad.normalizedNombre
            },
            update: {
              $set: {
                nombre: localidad.nombre,
                normalizedNombre: localidad.normalizedNombre,
                organizationId: localidad.organizationId
              }
            },
            upsert: true
          }
        })),
        { ordered: false }
      );
    }

    const localidadDocs = await Localidad.find(
      localityCandidates.size > 0
        ? {
            $or: [...new Set(
              [...localityCandidates.values()].map((row) =>
                JSON.stringify({
                  organizationId: row.organizationId,
                  normalizedNombre: row.normalizedNombre
                })
              )
            )].map((row) => JSON.parse(row))
          }
        : {}
    ).lean();

    const localidadByScopedName = new Map();
    const localidadById = new Map();
    localidadDocs.forEach((localidad) => {
      const scopedKey = `${localidad.organizationId || "global"}::${localidad.normalizedNombre}`;
      localidadByScopedName.set(scopedKey, localidad);
      localidadById.set(String(localidad._id), localidad);
    });

    const registrationLocalityEvidenceByPuestoId = new Map();
    registrations.forEach((reg) => {
      const puestoId = toObjectIdString(reg.puestoId);
      const canonicalLocalidad = canonicalizeLocalityName(reg.localidad);
      if (!puestoId || !canonicalLocalidad) return;
      if (!registrationLocalityEvidenceByPuestoId.has(puestoId)) {
        registrationLocalityEvidenceByPuestoId.set(puestoId, new Map());
      }
      const bucket = registrationLocalityEvidenceByPuestoId.get(puestoId);
      bucket.set(canonicalLocalidad, (bucket.get(canonicalLocalidad) || 0) + 1);
    });

    const resolvePuestoLocalityFromEvidence = (puestoId, fallbackLocalidad) => {
      const evidence = registrationLocalityEvidenceByPuestoId.get(toObjectIdString(puestoId));
      if (!evidence || evidence.size === 0) return canonicalizeLocalityName(fallbackLocalidad);
      const ranked = [...evidence.entries()].sort((a, b) => b[1] - a[1]);
      return ranked[0]?.[0] || canonicalizeLocalityName(fallbackLocalidad);
    };

    const puestoWrites = [];
    const puestosNormalized = puestos.map((originalPuesto) => {
      const overriddenPuesto = applyPollingPlaceOverride(originalPuesto);
      const canonicalLocalidad = resolvePuestoLocalityFromEvidence(
        originalPuesto._id,
        overriddenPuesto.localidad
      );
      const puesto = {
        ...overriddenPuesto,
        localidad: canonicalLocalidad
      };
      const normalizedNombre = normalizeName(puesto.nombre);
      const scopedLocalidadKey = `${puesto.organizationId || "global"}::${normalizeName(
        canonicalLocalidad
      )}`;
      const localidad = localidadByScopedName.get(scopedLocalidadKey) || null;
      if (
        localidad
        && (
          toObjectIdString(originalPuesto.localidadId) !== String(localidad._id)
          || safeText(originalPuesto.normalizedNombre) !== normalizedNombre
          || safeText(originalPuesto.localidad) !== safeText(puesto.localidad)
          || safeText(originalPuesto.nombre) !== safeText(puesto.nombre)
        )
      ) {
        puestoWrites.push({
          updateOne: {
            filter: { _id: originalPuesto._id },
            update: {
              $set: {
                nombre: puesto.nombre,
                localidad: puesto.localidad,
                localidadId: localidad._id,
                normalizedNombre
              }
            }
          }
        });
      }
      return {
        ...originalPuesto,
        ...puesto,
        localidadId: localidad ? localidad._id : originalPuesto.localidadId || null,
        normalizedNombre
      };
    });

    if (persist && puestoWrites.length > 0) {
      await Puestos.bulkWrite(puestoWrites, { ordered: false });
    }

    const mesaCandidates = new Map();
    const addMesaCandidate = (puestoId, numero, sourceOrganizationId = null) => {
      const mesa = toInt(numero);
      const puestoKey = toObjectIdString(puestoId);
      if (!puestoKey || mesa === null || mesa <= 0) return;
      const key = `${sourceOrganizationId || "global"}::${puestoKey}::${mesa}`;
      if (!mesaCandidates.has(key)) {
        mesaCandidates.set(key, {
          organizationId: sourceOrganizationId || null,
          puestoId: new mongoose.Types.ObjectId(puestoKey),
          numero: mesa
        });
      }
    };

    puestosNormalized.forEach((puesto) => {
      (Array.isArray(puesto.mesas) ? puesto.mesas : []).forEach((mesa) => {
        addMesaCandidate(puesto._id, mesa, puesto.organizationId || null);
      });
    });
    registrations.forEach((reg) => addMesaCandidate(reg.puestoId, reg.mesa ?? reg.votingTable, organizationId));

    const puestoKeyByScopedPair = new Map();
    const puestoKeyByName = new Map();
    puestosNormalized.forEach((puesto) => {
      const localidadId = toObjectIdString(puesto.localidadId);
      if (!localidadId) return;
      const key = `${localidadId}::${normalizeLookupName(puesto.nombre)}`;
      puestoKeyByScopedPair.set(key, puesto);
      const globalNameKey = normalizeLookupName(puesto.nombre);
      if (globalNameKey && !puestoKeyByName.has(globalNameKey)) {
        puestoKeyByName.set(globalNameKey, puesto);
      }
      (Array.isArray(puesto.aliases) ? puesto.aliases : []).forEach((alias) => {
        const aliasKey = normalizeLookupName(alias);
        if (!aliasKey) return;
        puestoKeyByScopedPair.set(`${localidadId}::${aliasKey}`, puesto);
        if (!puestoKeyByName.has(aliasKey)) {
          puestoKeyByName.set(aliasKey, puesto);
        }
      });
    });

    confirmations.forEach((row) => {
      const localidad =
        toObjectIdString(row.localidadId)
        || localidadByScopedName.get(`${organizationId || "global"}::${normalizeName(row.localidad)}`)?._id
        || localidadByScopedName.get(`global::${normalizeName(row.localidad)}`)?._id
        || null;
      const puesto =
        (row.puestoId && puestosNormalized.find((item) => String(item._id) === String(row.puestoId)))
        || puestoKeyByScopedPair.get(`${localidad || "none"}::${normalizeLookupName(row.puesto)}`)
        || puestoKeyByName.get(normalizeLookupName(row.puesto))
        || null;
      addMesaCandidate(puesto?._id || row.puestoId, row.mesa, organizationId);
    });

    if (persist && mesaCandidates.size > 0) {
      await Mesa.bulkWrite(
        [...mesaCandidates.values()].map((mesa) => ({
          updateOne: {
            filter: {
              organizationId: mesa.organizationId,
              puestoId: mesa.puestoId,
              numero: mesa.numero
            },
            update: {
              $set: mesa
            },
            upsert: true
          }
        })),
        { ordered: false }
      );
    }

    const mesaDocs = await Mesa.find(
      mesaCandidates.size > 0
        ? {
            $or: [...mesaCandidates.values()].map((mesa) => ({
              organizationId: mesa.organizationId,
              puestoId: mesa.puestoId,
              numero: mesa.numero
            }))
          }
        : {}
    ).lean();

    const mesaByScopedKey = new Map();
    const mesaById = new Map();
    mesaDocs.forEach((mesa) => {
      const key = `${mesa.organizationId || "global"}::${toObjectIdString(mesa.puestoId)}::${mesa.numero}`;
      mesaByScopedKey.set(key, mesa);
      mesaById.set(String(mesa._id), mesa);
    });

    return {
      localidades: localidadDocs,
      localidadByScopedName,
      localidadById,
      puestos: puestosNormalized,
      puestoKeyByScopedPair,
      puestoKeyByName,
      mesaByScopedKey,
      mesaById
    };
  }

  resolveLocalidadId(raw, master, organizationId) {
    const normalized = normalizeName(canonicalizeBogotaLocality(raw) || raw);
    if (!normalized) return null;
    return (
      master.localidadByScopedName.get(`${organizationId || "global"}::${normalized}`)?._id
      || master.localidadByScopedName.get(`global::${normalized}`)?._id
      || null
    );
  }

  async backfillHierarchyIds(resolvedRegistrations, resolvedConfirmations) {
    const registrationWrites = [];
    resolvedRegistrations.forEach((row) => {
      const currentLocalidadId = toObjectIdString(row.original.localidadId);
      const currentMesaId = toObjectIdString(row.original.mesaId);
      const currentPuestoId = toObjectIdString(row.original.puestoId);
      const currentReviewStatus = safeText(row.original.puestoMatchStatus);
      const currentLegacyVotingPlace = safeText(row.original.legacyVotingPlace);
      const nextLegacyVotingPlace = safeText(row.legacyVotingPlace);
      if (
        currentLocalidadId !== row.localidadId
        || currentMesaId !== row.mesaId
        || currentPuestoId !== row.puestoId
        || currentReviewStatus !== safeText(row.puestoMatchStatus)
        || currentLegacyVotingPlace !== nextLegacyVotingPlace
      ) {
        registrationWrites.push({
          updateOne: {
            filter: { _id: row.original._id },
            update: {
              $set: {
                localidad: row.localidad || row.original.localidad || "",
                localidadId: row.localidadId ? new mongoose.Types.ObjectId(row.localidadId) : null,
                puestoId: row.puestoId ? new mongoose.Types.ObjectId(row.puestoId) : null,
                mesa: row.mesa,
                mesaId: row.mesaId ? new mongoose.Types.ObjectId(row.mesaId) : null,
                votingPlace: row.puesto || row.original.votingPlace || "",
                legacyVotingPlace: row.legacyVotingPlace || row.original.legacyVotingPlace || "",
                votingTable: row.mesa !== null ? String(row.mesa) : row.original.votingTable || ""
              ,
                puestoMatchStatus: row.puestoMatchStatus || "not_applicable",
                puestoMatchType: row.puestoMatchType || "",
                puestoMatchConfidence: row.puestoMatchConfidence ?? null,
                puestoMatchReviewRequired: row.puestoMatchReviewRequired === true,
                puestoMatchRawName: row.puestoMatchRawName || "",
                puestoMatchSuggestedPuestoId: row.puestoMatchSuggestedPuestoId ? new mongoose.Types.ObjectId(row.puestoMatchSuggestedPuestoId) : null,
                puestoMatchSuggestedLocalidadId: row.puestoMatchSuggestedLocalidadId ? new mongoose.Types.ObjectId(row.puestoMatchSuggestedLocalidadId) : null,
                puestoMatchResolvedAt: row.puestoMatchResolvedAt || null
              }
            }
          }
        });
      }
    });

    if (registrationWrites.length > 0) {
      await Registration.bulkWrite(registrationWrites, { ordered: false });
    }

    const confirmationWrites = [];
    resolvedConfirmations.forEach((row) => {
      const currentLocalidadId = toObjectIdString(row.original.localidadId);
      const currentPuestoId = toObjectIdString(row.original.puestoId);
      const currentMesaId = toObjectIdString(row.original.mesaId);
      if (currentLocalidadId !== row.localidadId || currentPuestoId !== row.puestoId || currentMesaId !== row.mesaId) {
        confirmationWrites.push({
          updateOne: {
            filter: { _id: row.original._id },
            update: {
              $set: {
                localidadId: row.localidadId ? new mongoose.Types.ObjectId(row.localidadId) : null,
                puestoId: row.puestoId ? new mongoose.Types.ObjectId(row.puestoId) : null,
                mesaId: row.mesaId ? new mongoose.Types.ObjectId(row.mesaId) : null,
                localidad: row.localidad,
                puesto: row.puesto
              }
            }
          }
        });
      }
    });

    if (confirmationWrites.length > 0) {
      await E14ConfirmationByMesa.bulkWrite(confirmationWrites, { ordered: false });
    }
  }

  async buildResolvedScope(rawFilters = {}, options = {}) {
    const scope = await this.loadScopeDocuments(rawFilters, options);
    const persistHierarchy = options.persistHierarchy === true;
    const master = await this.syncMasterTables(scope, { persist: persistHierarchy });
    const organizationId = scope.organizationId || null;

    const puestosById = new Map();
    scope.puestos.forEach((puesto) => {
      puestosById.set(String(puesto._id), puesto);
    });

    const legacyCandidates = scope.registrations
      .filter((reg) => shouldRecomputeLegacyMatch(reg))
      .map((reg) => ({
        registrationId: String(reg._id),
        rawPuesto: reg.votingPlace,
        rawLocalidad: reg.localidad || "",
        rawLocalidadId:
          toObjectIdString(reg.localidadId)
          || toObjectIdString(this.resolveLocalidadId(reg.localidad, master, organizationId))
          || null
      }));

    const legacyMatches = await puestoMatchingService.resolveBulkLegacyPuestos(legacyCandidates, {
      organizationId,
      master: puestoMatchingService.buildMasterIndex(master.puestos)
    });

    const resolvedRegistrations = scope.registrations
      .filter((reg) => matchesStatus(reg, rawFilters.status || "all"))
      .map((reg) => {
        const registrationId = String(reg._id);
        const legacyMatch = legacyMatches.byRegistrationId.get(registrationId)
          || buildPersistedLegacyMatch(reg)
          || null;
        const originalPuestoId = toObjectIdString(reg.puestoId);
        let puestoId = originalPuestoId;
        let puesto = (puestoId && puestosById.get(puestoId)) || null;
        let localidadId =
          toObjectIdString(puesto?.localidadId)
          || toObjectIdString(reg.localidadId)
          || toObjectIdString(this.resolveLocalidadId(reg.localidad, master, organizationId));
        let localidad =
          master.localidadById.get(localidadId || "")?.nombre
          || safeText(canonicalizeBogotaLocality(puesto?.localidad || reg.localidad) || puesto?.localidad || reg.localidad || reg.departamento)
          || "Sin Localidad";
        let legacyBucket = null;
        let legacyVotingPlace = safeText(reg.legacyVotingPlace || reg.votingPlace);

        if (!puesto && legacyMatch?.autoAssignable && legacyMatch?.suggestedPuestoId) {
          puestoId = toObjectIdString(legacyMatch.suggestedPuestoId);
          puesto = (puestoId && puestosById.get(puestoId)) || null;
          localidadId =
            toObjectIdString(puesto?.localidadId)
            || toObjectIdString(legacyMatch.suggestedLocalidadId)
            || localidadId;
          localidad =
            master.localidadById.get(localidadId || "")?.nombre
            || legacyMatch.suggestedLocalidadNombre
            || localidad;
        } else if (!puesto && legacyMatch) {
          legacyBucket = MATCH_REVIEW_BUCKET;
        }

        const mesa = toInt(reg.mesa ?? reg.votingTable);
        const mesaId = mesa !== null
          ? toObjectIdString(
              reg.mesaId
              || master.mesaByScopedKey.get(`${organizationId || "global"}::${puestoId || "none"}::${mesa}`)?._id
              || master.mesaByScopedKey.get(`global::${puestoId || "none"}::${mesa}`)?._id
            )
          : null;
        const puestoName = safeText(puesto?.nombre || legacyBucket) || "Sin Puesto";
        const issues = [];
        if (puestoId && localidadId && toObjectIdString(puesto?.localidadId) && toObjectIdString(puesto.localidadId) !== localidadId) {
          issues.push("puesto.localidad_id no coincide con registro.localidad_id");
        }
        if (!puesto && legacyMatch?.requiresManualReview) {
          issues.push(`puesto legacy pendiente: ${legacyMatch.matchType || "sin_match"}`);
        }
        if (legacyMatch?.status === "cross_localidad") {
          issues.push("puesto legacy coincide con otra localidad y requiere revision manual");
        }
        if (mesaId && puestoId) {
          const mesaDoc = master.mesaById.get(mesaId);
          if (mesaDoc && toObjectIdString(mesaDoc.puestoId) !== puestoId) {
            issues.push("mesa.puesto_id no coincide con registro.puesto_id");
          }
        }

        return {
          original: reg,
          registrationId,
          eventId: reg.eventId || null,
          leaderId: reg.leaderId || null,
          leaderName: reg.leaderName || "Sin lider",
          firstName: reg.firstName || "",
          lastName: reg.lastName || "",
          cedula: reg.cedula || "",
          localidadId: localidadId || null,
          localidad,
          puestoId: puestoId || null,
          puesto: puestoName,
          legacyVotingPlace,
          puestoRawLegacy: safeText(reg.votingPlace),
          isPendingNormalization: Boolean(legacyBucket),
          mesaId: mesaId || null,
          mesa,
          votosRegistrados: getRegistrationVoteValue(reg),
          confirmed: reg.confirmed === true || reg.workflowStatus === "confirmed",
          missingPollingPlace: !puestoId,
          issues,
          dataIntegrityStatus: reg.dataIntegrityStatus || "valid",
          puestoMatchStatus: puesto
            ? "matched"
            : (legacyMatch?.status === "accepted_auto" ? "matched" : legacyMatch?.status || reg.puestoMatchStatus || "not_applicable"),
          puestoMatchType: legacyMatch?.matchType || reg.puestoMatchType || "",
          puestoMatchConfidence: legacyMatch?.confidence ?? reg.puestoMatchConfidence ?? null,
          puestoMatchReviewRequired: legacyMatch?.requiresManualReview ?? reg.puestoMatchReviewRequired ?? false,
          puestoMatchRawName: legacyMatch?.rawPuesto || reg.puestoMatchRawName || safeText(reg.votingPlace),
          puestoMatchSuggestedPuestoId: legacyMatch?.suggestedPuestoId || reg.puestoMatchSuggestedPuestoId || null,
          puestoMatchSuggestedLocalidadId: legacyMatch?.suggestedLocalidadId || reg.puestoMatchSuggestedLocalidadId || null,
          puestoMatchResolvedAt: legacyMatch ? new Date() : reg.puestoMatchResolvedAt || null,
          officialValidationStatus: safeText(reg.officialValidationStatus) || "pending_official_validation",
          officialValidationReason: safeText(reg.officialValidationReason || reg.errorBucketReason),
          officialValidationReviewed: reg.officialValidationReviewed === true,
          officialCatalogVersion: safeText(reg.officialCatalogVersion),
          officialLocalidadNombre: safeText(reg.officialLocalidadNombre),
          officialPuestoNombre: safeText(reg.officialPuestoNombre),
          officialPuestoCodigo: safeText(reg.officialPuestoCodigo),
          officialMesaNumero: toInt(reg.officialMesaNumero),
          officialMesaValid: reg.officialMesaValid === true,
          officialPuestoValid: reg.officialPuestoValid === true,
          movedToErrorBucket: reg.movedToErrorBucket === true,
          errorBucketReason: safeText(reg.errorBucketReason),
          officialSuggestedPuesto: safeText(reg.officialSuggestedPuesto),
          officialSuggestedLocalidad: safeText(reg.officialSuggestedLocalidad),
          region: canonicalizeBogotaLocality(localidad)
            ? "bogota"
            : "resto"
        };
      });

    const resolvedConfirmations = scope.confirmations.map((row) => {
      const localidadId =
        toObjectIdString(row.localidadId)
        || toObjectIdString(this.resolveLocalidadId(row.localidad, master, organizationId));
      const puesto =
        (row.puestoId && puestosById.get(String(row.puestoId)))
        || master.puestoKeyByScopedPair.get(`${localidadId || "none"}::${normalizeLookupName(row.puesto)}`)
        || master.puestoKeyByName.get(normalizeLookupName(row.puesto))
        || null;
      const puestoId = toObjectIdString(row.puestoId || puesto?._id);
      const mesa = toInt(row.mesa);
      const mesaId = mesa !== null
        ? toObjectIdString(
            row.mesaId
            || master.mesaByScopedKey.get(`${organizationId || "global"}::${puestoId || "none"}::${mesa}`)?._id
            || master.mesaByScopedKey.get(`global::${puestoId || "none"}::${mesa}`)?._id
          )
        : null;
      return {
        original: row,
        localidadId: localidadId || null,
        localidad:
          master.localidadById.get(localidadId || "")?.nombre
          || safeText(canonicalizeBogotaLocality(puesto?.localidad || row.localidad) || puesto?.localidad || row.localidad),
        puestoId: puestoId || null,
        puesto: safeText(puesto?.nombre || row.puesto),
        mesaId: mesaId || null,
        mesa,
        zoneCode: row.zoneCode || getBogotaZoneCode(row.localidad),
        votosE14Candidate105: toInt(row.votosE14Candidate105),
        votosE14SuggestedCandidate105: toInt(row.votosE14SuggestedCandidate105),
        e14ListVotes: toInt(row.e14ListVotes),
        notes: row.notes || "",
        validatedAt: row.validatedAt || null,
        validatedBy: row.validatedBy || null,
        source: row.source || null,
        reviewRequired: Boolean(row.reviewRequired),
        reviewReason: row.reviewReason || "",
        taskId: row.taskId || "",
        reviewPriorityRank: row.reviewPriorityRank ?? null,
        sourceEstadoRevision: row.sourceEstadoRevision || "",
        sourceConfidence: row.sourceConfidence ?? null,
        sourceScoreDigito: row.sourceScoreDigito ?? null,
        sourceScoreSegundo: row.sourceScoreSegundo ?? null,
        sourceMetodoDigito: row.sourceMetodoDigito || "",
        sourceDebugDir: row.sourceDebugDir || "",
        sourceDocumento: row.sourceDocumento || "",
        sourceArchivo: row.sourceArchivo || "",
        sourceLocalFileUri: row.sourceLocalFileUri || "",
        sourceCaptureAvailable: Boolean(row.sourceCaptureAvailable),
        sourceOverlayPath: row.sourceOverlayPath || "",
        sourceCellPath: row.sourceCellPath || "",
        sourceMaskPath: row.sourceMaskPath || "",
        sourcePartyBlockPath: row.sourcePartyBlockPath || ""
      };
    });

    if (persistHierarchy) {
      await this.backfillHierarchyIds(resolvedRegistrations, resolvedConfirmations);
    }

    const searchMatcher = buildSearchMatcher(rawFilters.search || "");
    const selectedLocalidadNeedle = normalizeName(rawFilters.localidad || "");
    const selectedPuestoNeedle = normalizeLookupName(rawFilters.puesto || "");
    const selectedMesa = toInt(rawFilters.mesa);
    const regionScope = parseRegionScope(rawFilters.regionScope || rawFilters.regionScopeFilter || rawFilters.region);

    const filteredRegistrations = resolvedRegistrations.filter((row) => {
      const hasCanonicalBogotaLocalidad = Boolean(canonicalizeBogotaLocality(row.localidad));
      if (regionScope === "bogota" && !hasCanonicalBogotaLocalidad) return false;
      if (regionScope === "resto" && hasCanonicalBogotaLocalidad) return false;
      if (searchMatcher && !searchMatcher(row)) return false;
      if (selectedLocalidadNeedle && normalizeName(row.localidad) !== selectedLocalidadNeedle) return false;
      if (selectedPuestoNeedle && normalizeLookupName(row.puesto) !== selectedPuestoNeedle) return false;
      if (selectedMesa !== null && row.mesa !== selectedMesa) return false;
      return true;
    });

    const filteredConfirmations = resolvedConfirmations.filter((row) => {
      const hasCanonicalBogotaLocalidad = Boolean(canonicalizeBogotaLocality(row.localidad));
      if (regionScope === "bogota" && !hasCanonicalBogotaLocalidad) return false;
      if (regionScope === "resto" && hasCanonicalBogotaLocalidad) return false;
      if (selectedLocalidadNeedle && normalizeName(row.localidad) !== selectedLocalidadNeedle) return false;
      if (selectedPuestoNeedle && normalizeLookupName(row.puesto) !== selectedPuestoNeedle) return false;
      if (selectedMesa !== null && row.mesa !== selectedMesa) return false;
      return true;
    });

    return {
      ...scope,
      master,
      registrations: filteredRegistrations,
      confirmations: filteredConfirmations
    };
  }

  buildRegionPayload(registrations = [], options = {}) {
    const includeHierarchy = options.includeHierarchy !== false;
    const buckets = {
      all: this.createEmptyRegionBucket(includeHierarchy),
      bogota: this.createEmptyRegionBucket(includeHierarchy),
      nacional: this.createEmptyRegionBucket(includeHierarchy)
    };

    registrations.forEach((row) => {
      const targets = ["all", row.region === "bogota" ? "bogota" : "nacional"];
      targets.forEach((name) => {
        this.pushRecordIntoBucket(buckets[name], row);
      });
    });

    return {
      all: this.formatRegionBucket(buckets.all),
      bogota: this.formatRegionBucket(buckets.bogota),
      nacional: this.formatRegionBucket(buckets.nacional)
    };
  }

  buildErrorRegionPayload(rows = []) {
    const createBucket = () => ({
      total: 0,
      byReason: new Map(),
      items: []
    });

    const buckets = {
      all: createBucket(),
      bogota: createBucket(),
      nacional: createBucket()
    };

    rows.forEach((row) => {
      const region = canonicalizeBogotaLocality(row.normalizedLocalidad || row.localidadRaw) ? "bogota" : "nacional";
      ["all", region].forEach((bucketName) => {
        const bucket = buckets[bucketName];
        bucket.total += 1;
        const reason = row.reason || "sin_clasificar";
        bucket.byReason.set(reason, (bucket.byReason.get(reason) || 0) + 1);
        bucket.items.push(row);
      });
    });

    return Object.fromEntries(
      Object.entries(buckets).map(([key, bucket]) => ([
        key,
        {
          total: bucket.total,
          byReason: [...bucket.byReason.entries()]
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count),
          items: bucket.items
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        }
      ]))
    );
  }

  buildPersistedInvalidRow(row) {
    return {
      registrationId: row.registrationId,
      eventId: row.eventId || null,
      leaderName: row.leaderName || "Sin lider",
      localidadRaw: row.original?.localidad || row.localidad || "",
      puestoRaw: row.original?.legacyVotingPlace || row.original?.votingPlace || row.legacyVotingPlace || row.puesto || "",
      mesaRaw: row.original?.votingTable || row.original?.mesa || row.mesa,
      normalizedLocalidad: row.localidad || "",
      normalizedPuesto: row.puesto || "",
      suggestedOfficialPuesto: row.officialSuggestedPuesto || row.officialPuestoNombre || "",
      suggestedOfficialLocalidad: row.officialSuggestedLocalidad || row.officialLocalidadNombre || "",
      suggestedOfficialCodigoPuesto: row.officialPuestoCodigo || "",
      reason: row.officialValidationReason || row.errorBucketReason || row.officialValidationStatus || "sin_clasificar",
      status: row.officialValidationStatus || "pending_official_validation",
      createdAt: row.original?.createdAt || null,
      cedula: row.cedula || "",
      firstName: row.firstName || "",
      lastName: row.lastName || "",
      legacyVotingPlace: row.legacyVotingPlace || "",
      puestoMatchStatus: row.puestoMatchStatus || "",
      puestoMatchConfidence: row.puestoMatchConfidence ?? null,
      reviewStatus: row.officialValidationReviewed === true ? "reviewed" : "pending",
      officialCatalogVersion: row.officialCatalogVersion || ""
    };
  }

  splitPersistedOfficialValidation(rows = []) {
    const officialRows = [];
    const errorRows = [];
    const counters = {};
    let catalogVersion = "";

    rows.forEach((row) => {
      const status = safeText(row.officialValidationStatus) || "pending_official_validation";
      const reason = safeText(row.officialValidationReason || row.errorBucketReason);
      counters[status] = (counters[status] || 0) + 1;
      if (!catalogVersion && row.officialCatalogVersion) {
        catalogVersion = row.officialCatalogVersion;
      }

      if (status === "official_valid" && row.movedToErrorBucket !== true) {
        officialRows.push(row);
        return;
      }

      errorRows.push(this.buildPersistedInvalidRow({
        ...row,
        officialValidationStatus: status,
        officialValidationReason: reason
      }));
    });

    return {
      officialRows,
      errorRows,
      counters,
      catalog: {
        version: catalogVersion || ""
      }
    };
  }

  createEmptyRegionBucket(includeHierarchy = true) {
    return {
      totalVotos: 0,
      localidades: includeHierarchy ? new Map() : null,
      topPuestos: new Map(),
      topLocalidades: new Map(),
      topLideres: new Map(),
      missingPollingPlaceByLeader: new Map(),
      excluded: {
        noLocality: 0,
        noPollingPlace: 0,
        inconsistent: 0,
        pendingNormalization: 0
      }
    };
  }

  pushRecordIntoBucket(bucket, row) {
    bucket.totalVotos += row.votosRegistrados;
    if (!row.localidadId && normalizeName(row.localidad) === "") bucket.excluded.noLocality += 1;
    if (!row.puestoId) {
      bucket.excluded.noPollingPlace += 1;
      const leaderKey = row.leaderId || "sin_lider";
      const currentLeader = bucket.missingPollingPlaceByLeader.get(leaderKey) || {
        leaderId: leaderKey,
        leaderName: row.leaderName || "Sin lider",
        count: 0
      };
      currentLeader.count += 1;
      bucket.missingPollingPlaceByLeader.set(leaderKey, currentLeader);
    }
    if (row.isPendingNormalization) bucket.excluded.pendingNormalization += 1;
    if (row.issues.length > 0 || row.dataIntegrityStatus !== "valid") bucket.excluded.inconsistent += 1;

    const localidadKey = row.localidadId || normalizeName(row.localidad) || "sin-localidad";
    const puestoKey = row.puestoId || `${localidadKey}::${normalizeName(row.puesto) || "sin-puesto"}`;
    const mesaKey = row.mesaId || buildCompositeMesaKey({
      localidadId: row.localidadId,
      puestoId: row.puestoId,
      mesa: row.mesa
    });
    const leaderKey = row.leaderId || "sin_lider";

    if (!bucket.topLocalidades.has(localidadKey)) {
      bucket.topLocalidades.set(localidadKey, {
        _id: localidadKey,
        localidadId: row.localidadId || null,
        nombre: row.localidad,
        totalVotos: 0
      });
    }
    bucket.topLocalidades.get(localidadKey).totalVotos += row.votosRegistrados;

    if (!bucket.topPuestos.has(puestoKey)) {
      bucket.topPuestos.set(puestoKey, {
        _id: row.puesto,
        puestoId: row.puestoId || null,
        localidadId: row.localidadId || null,
        localidad: row.localidad,
        totalVotos: 0,
        isPendingNormalization: Boolean(row.isPendingNormalization),
        legacyVariants: new Set()
      });
    }
    const topPuestoNode = bucket.topPuestos.get(puestoKey);
    topPuestoNode.totalVotos += row.votosRegistrados;
    if (row.isPendingNormalization && row.legacyVotingPlace) {
      topPuestoNode.legacyVariants.add(row.legacyVotingPlace);
    }

    if (!bucket.topLideres.has(leaderKey)) {
      bucket.topLideres.set(leaderKey, {
        liderId: row.leaderId || null,
        liderNombre: row.leaderName || "Sin lider",
        totalVotos: 0
      });
    }
    bucket.topLideres.get(leaderKey).totalVotos += row.votosRegistrados;

    if (!bucket.localidades) return;

    if (!bucket.localidades.has(localidadKey)) {
      bucket.localidades.set(localidadKey, {
        localidad: row.localidad,
        localidadId: row.localidadId || null,
        totalVotos: 0,
        puestos: new Map()
      });
    }
    const localidadNode = bucket.localidades.get(localidadKey);
    localidadNode.totalVotos += row.votosRegistrados;

    if (!localidadNode.puestos.has(puestoKey)) {
      localidadNode.puestos.set(puestoKey, {
        puesto: row.puesto,
        puestoId: row.puestoId || null,
        localidadId: row.localidadId || null,
        totalVotos: 0,
        isPendingNormalization: Boolean(row.isPendingNormalization),
        legacyVariants: new Set(),
        mesas: new Map()
      });
    }
    const puestoNode = localidadNode.puestos.get(puestoKey);
    puestoNode.totalVotos += row.votosRegistrados;
    if (row.isPendingNormalization && row.legacyVotingPlace) {
      puestoNode.legacyVariants.add(row.legacyVotingPlace);
    }

    if (!puestoNode.mesas.has(mesaKey)) {
      puestoNode.mesas.set(mesaKey, {
        mesa: row.mesa,
        mesaId: row.mesaId || null,
        puestoId: row.puestoId || null,
        localidadId: row.localidadId || null,
        totalVotos: 0,
        isPendingNormalization: Boolean(row.isPendingNormalization),
        legacyVariants: new Set(),
        voters: []
      });
    }
    const mesaNode = puestoNode.mesas.get(mesaKey);
    mesaNode.totalVotos += row.votosRegistrados;
    if (row.isPendingNormalization && row.legacyVotingPlace) {
      mesaNode.legacyVariants.add(row.legacyVotingPlace);
    }
    if (mesaNode.voters.length < 100) {
      mesaNode.voters.push({
        nombre: `${row.firstName || ""} ${row.lastName || ""}`.trim(),
        cedula: row.cedula || "",
        lider: row.leaderName || "Sin lider",
        legacyVotingPlace: row.isPendingNormalization ? row.legacyVotingPlace || "" : ""
      });
    }
  }

  formatRegionBucket(bucket) {
    const jerarquia = !bucket.localidades
      ? []
      : [...bucket.localidades.values()]
      .map((localidad) => ({
        localidad: localidad.localidad,
        localidadId: localidad.localidadId,
        totalVotos: localidad.totalVotos,
        puestos: [...localidad.puestos.values()]
          .map((puesto) => ({
            puesto: puesto.puesto,
            puestoId: puesto.puestoId,
            localidadId: puesto.localidadId,
            totalVotos: puesto.totalVotos,
            isPendingNormalization: Boolean(puesto.isPendingNormalization),
            legacyVariants: normalizeLegacyVariantList([...puesto.legacyVariants.values()]),
            mesas: [...puesto.mesas.values()]
              .map((mesa) => ({
                mesa: mesa.mesa,
                mesaId: mesa.mesaId,
                puestoId: mesa.puestoId,
                localidadId: mesa.localidadId,
                totalVotos: mesa.totalVotos,
                isPendingNormalization: Boolean(mesa.isPendingNormalization),
                legacyVariants: normalizeLegacyVariantList([...mesa.legacyVariants.values()]),
                voters: mesa.voters
              }))
              .sort((a, b) => (a.mesa || 0) - (b.mesa || 0))
          }))
          .sort((a, b) => b.totalVotos - a.totalVotos)
      }))
      .sort((a, b) => b.totalVotos - a.totalVotos);

    const topPuestos = [...bucket.topPuestos.values()]
      .map((puesto) => buildChartEntity("puesto", {
        ...puesto,
        localidadNombre: safeDisplayText(puesto.localidad),
        legacyVariants: normalizeLegacyVariantList([...puesto.legacyVariants.values()])
      }))
      .sort((a, b) => b.totalVotos - a.totalVotos);
    const topLocalidades = [...bucket.topLocalidades.values()]
      .map((row) => buildChartEntity("localidad", {
        _id: row.nombre,
        localidadId: row.localidadId,
        totalVotos: row.totalVotos
      }))
      .sort((a, b) => b.totalVotos - a.totalVotos);
    const topLideres = [...bucket.topLideres.values()].sort((a, b) => b.totalVotos - a.totalVotos);

    return {
      totalVotos: bucket.totalVotos,
      localityBreakdownTotal: topLocalidades.reduce((sum, item) => sum + item.totalVotos, 0),
      topPuestos,
      topLocalidades,
      topLideres,
      jerarquia,
      missingPollingPlace: {
        count: bucket.excluded.noPollingPlace,
        leaders: [...bucket.missingPollingPlaceByLeader.values()].sort((a, b) => b.count - a.count)
      },
      excluded: bucket.excluded,
      analyzable: {
        withLocality: Math.max(bucket.totalVotos - bucket.excluded.noLocality, 0),
        withPollingPlace: Math.max(bucket.totalVotos - bucket.excluded.noPollingPlace, 0)
      }
    };
  }

  async buildHierarchy(rawFilters = {}, options = {}) {
    const scope = await this.buildResolvedScope(rawFilters, {
      ...options,
      includeConfirmations: false,
      persistHierarchy: false
    });
    const regionBuckets = this.buildRegionPayload(scope.registrations, { includeHierarchy: true });
    const parsedRegion = parseRegionScope(rawFilters.regionScope || rawFilters.region);
    const region = parsedRegion === "bogota" ? "bogota" : parsedRegion === "resto" ? "nacional" : "all";
    return regionBuckets[region].jerarquia;
  }

  async validateGeography(rawFilters = {}, options = {}) {
    const scope = await this.buildResolvedScope(rawFilters, {
      ...options,
      persistHierarchy: false
    });
    return this.buildValidationFromResolvedScope(scope);
  }

  async getVotesByMesa(rawFilters = {}, options = {}) {
    const scope = await this.buildResolvedScope(rawFilters, {
      ...options,
      persistHierarchy: false
    });
    return this.aggregateVotesByMesa(scope.registrations);
  }

  aggregateVotesByMesa(registrations = []) {
    const mesas = new Map();
    registrations.forEach((row) => {
      const key = row.mesaId || buildCompositeMesaKey(row);
      const current = mesas.get(key) || {
        mesa_id: row.mesaId,
        localidad_id: row.localidadId,
        puesto_id: row.puestoId,
        localidad: row.localidad,
        puesto: row.puesto,
        mesa: row.mesa,
        votos_registrados: 0,
        isPendingNormalization: Boolean(row.isPendingNormalization),
        legacyPuestoExamples: new Set(),
        legacyPuestoPrimary: ""
      };
      current.votos_registrados += row.votosRegistrados;
      current.isPendingNormalization = current.isPendingNormalization || Boolean(row.isPendingNormalization);
      if (row.isPendingNormalization && row.legacyVotingPlace) {
        current.legacyPuestoExamples.add(row.legacyVotingPlace);
        if (!current.legacyPuestoPrimary) current.legacyPuestoPrimary = row.legacyVotingPlace;
      }
      mesas.set(key, current);
    });
    return [...mesas.values()]
      .map((row) => ({
        ...row,
        legacyPuestoExamples: normalizeLegacyVariantList([...row.legacyPuestoExamples.values()])
      }))
      .sort((a, b) => {
      const loc = safeText(a.localidad).localeCompare(safeText(b.localidad), "es");
      if (loc !== 0) return loc;
      const puesto = safeText(a.puesto).localeCompare(safeText(b.puesto), "es");
      if (puesto !== 0) return puesto;
      return (a.mesa || 0) - (b.mesa || 0);
      });
  }

  async getVotesByPuesto(rawFilters = {}, options = {}) {
    const mesas = await this.getVotesByMesa(rawFilters, options);
    const puestos = new Map();
    mesas.forEach((row) => {
      const key = row.puesto_id || `${row.localidad_id || "none"}::${normalizeName(row.puesto)}`;
      const current = puestos.get(key) || {
        puesto_id: row.puesto_id,
        localidad_id: row.localidad_id,
        puesto: row.puesto,
        localidad: row.localidad,
        total_votos: 0
      };
      current.total_votos += row.votos_registrados;
      puestos.set(key, current);
    });
    return [...puestos.values()].sort((a, b) => b.total_votos - a.total_votos);
  }

  async getVotesByLocalidad(rawFilters = {}, options = {}) {
    const mesas = await this.getVotesByMesa(rawFilters, options);
    const localidades = new Map();
    mesas.forEach((row) => {
      const key = row.localidad_id || normalizeName(row.localidad);
      const current = localidades.get(key) || {
        localidad_id: row.localidad_id,
        localidad: row.localidad,
        total_votos: 0
      };
      current.total_votos += row.votos_registrados;
      localidades.set(key, current);
    });
    return [...localidades.values()].sort((a, b) => b.total_votos - a.total_votos);
  }

  async getAnalyticsTree(rawFilters = {}, options = {}) {
    const includeHierarchy = parseBooleanFlag(rawFilters.includeHierarchy, true);
    const includeInvalidData = parseBooleanFlag(rawFilters.includeInvalidData, true);
    const cacheKey = buildCacheKey("analytics", { ...rawFilters, includeHierarchy, includeInvalidData }, options);
    const cached = this.getCacheEntry(this.analyticsCache, cacheKey);
    if (cached) return cached;

    const scope = await this.buildResolvedScope(rawFilters, {
      ...options,
      includeConfirmations: false,
      persistHierarchy: false
    });
    const officialValidation = this.splitPersistedOfficialValidation(scope.registrations);
    const regions = this.buildRegionPayload(officialValidation.officialRows, { includeHierarchy });
    const invalidData = includeInvalidData ? this.buildErrorRegionPayload(officialValidation.errorRows) : undefined;
    const validation = this.buildValidationFromResolvedScope(scope);
    const validBogotaLocalidades = this.getValidLocalidadesForBogota();

    return this.setCacheEntry(this.analyticsCache, cacheKey, {
      ...regions,
      ...(includeInvalidData ? { invalidData } : {}),
      summary: {
        totalRaw: scope.rawCount,
        totalClean: scope.cleanCount,
        hiddenByCleanFilter: Math.max(scope.rawCount - scope.cleanCount, 0),
        officialValid: officialValidation.officialRows.length,
        erroneousOrIncomplete: officialValidation.errorRows.length
      },
      validation,
      source: {
        eventId: rawFilters.eventId || null,
        leaderId: rawFilters.leaderId || null,
        region: parseRegionScope(rawFilters.regionScope || rawFilters.region),
        status: rawFilters.status || "all",
        universe: "raw_event_scope",
        canonicalAggregation: "VotingHierarchyService"
      },
      catalogs: {
        bogotaLocalidades: validBogotaLocalidades,
        officialCatalogVersion: officialValidation.catalog.version || ""
      },
      officialValidation: {
        counters: officialValidation.counters,
        totalOfficialRows: officialValidation.officialRows.length,
        totalErroneousRows: officialValidation.errorRows.length
      },
      timestamp: new Date()
    });
  }

  async getOfficialAnalyticsSummary(rawFilters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const regionScope = parseRegionScope(rawFilters.region || rawFilters.regionScope);
    const status = safeText(rawFilters.status).toLowerCase();
    const cacheKey = buildCacheKey("analytics-summary", { ...rawFilters, regionScope, status }, options);
    const cached = this.getCacheEntry(this.analyticsCache, cacheKey);
    if (cached) return cached;

    const baseQuery = buildRegistrationQuery(rawFilters, organizationId);
    if (regionScope === "bogota") {
      pushAndCondition(baseQuery, { localidad: { $in: getBogotaLocalidadesCanonical() } });
    } else if (regionScope === "resto") {
      pushAndCondition(baseQuery, {
        $or: [
          { localidad: { $exists: false } },
          { localidad: null },
          { localidad: "" },
          { localidad: { $nin: getBogotaLocalidadesCanonical() } }
        ]
      });
    }

    if (status === "confirmed") {
      pushAndCondition(baseQuery, {
        $or: [
          { confirmed: true },
          { workflowStatus: "confirmed" }
        ]
      });
    } else if (status === "unconfirmed") {
      pushAndCondition(baseQuery, {
        $nor: [
          { confirmed: true },
          { workflowStatus: "confirmed" }
        ]
      });
    }

    const officialQuery = {
      ...baseQuery,
      officialValidationStatus: "official_valid"
    };
    const invalidQuery = {
      ...baseQuery,
      officialValidationStatus: { $ne: "official_valid" }
    };

    const includeCharts = options.includeCharts !== false;
    const [officialValid, erroneousOrIncomplete, rawTopPuestos, rawTopLocalidades, topLideres] = await Promise.all([
      Registration.countDocuments(officialQuery),
      Registration.countDocuments(invalidQuery),
      includeCharts ? Registration.aggregate([
        { $match: officialQuery },
        { $group: { _id: { $ifNull: ["$officialPuestoNombre", "$votingPlace"] }, totalVotos: { $sum: 1 } } },
        { $sort: { totalVotos: -1, _id: 1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            puesto: { $ifNull: ["$_id", "Sin puesto"] },
            totalVotos: 1
          }
        }
      ]) : Promise.resolve([]),
      includeCharts ? Registration.aggregate([
        { $match: officialQuery },
        { $group: { _id: { $ifNull: ["$officialLocalidadNombre", "$localidad"] }, totalVotos: { $sum: 1 } } },
        { $sort: { totalVotos: -1, _id: 1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            localidad: { $ifNull: ["$_id", "Sin Localidad"] },
            totalVotos: 1
          }
        }
      ]) : Promise.resolve([]),
      Registration.aggregate([
        { $match: officialQuery },
        { $group: { _id: { $ifNull: ["$leaderName", "Sin lider"] }, totalVotos: { $sum: 1 } } },
        { $sort: { totalVotos: -1, _id: 1 } },
        { $limit: 15 },
        { $project: { _id: 0, leaderName: { $ifNull: ["$_id", "Sin lider"] }, totalVotos: 1 } }
      ])
    ]);

    const topPuestos = rawTopPuestos.map((row) => buildChartEntity("puesto", row));
    const topLocalidades = rawTopLocalidades.map((row) => buildChartEntity("localidad", row));

    const bucket = {
      totalVotos: officialValid,
      localityBreakdownTotal: officialValid,
      topPuestos,
      topLocalidades,
      topLideres,
      jerarquia: [],
      excluded: {
        noLocality: 0,
        noPollingPlace: 0,
        inconsistent: 0
      },
      missingPollingPlace: {
        count: 0,
        leaders: []
      }
    };
    const emptyBucket = {
      totalVotos: 0,
      localityBreakdownTotal: 0,
      topPuestos: [],
      topLocalidades: [],
      topLideres: [],
      jerarquia: [],
      excluded: {
        noLocality: 0,
        noPollingPlace: 0,
        inconsistent: 0
      },
      missingPollingPlace: {
        count: 0,
        leaders: []
      }
    };

    const payload = {
      all: regionScope === "all" ? bucket : emptyBucket,
      bogota: regionScope === "bogota" ? bucket : emptyBucket,
      nacional: regionScope === "resto" ? bucket : emptyBucket,
      summary: {
        totalRaw: officialValid + erroneousOrIncomplete,
        totalClean: officialValid,
        hiddenByCleanFilter: erroneousOrIncomplete,
        officialValid,
        erroneousOrIncomplete
      },
      catalogs: {
        bogotaLocalidades: this.getValidLocalidadesForBogota(),
        officialCatalogVersion: await officialE14CatalogService.getCatalogVersion()
      },
      source: {
        eventId: rawFilters.eventId || null,
        leaderId: rawFilters.leaderId || null,
        region: regionScope,
        status: rawFilters.status || "all",
        universe: "persisted_official_snapshot",
        canonicalAggregation: "VotingHierarchyService"
      },
      timestamp: new Date()
    };

    return this.setCacheEntry(this.analyticsCache, cacheKey, payload);
  }

  async getOfficialAnalyticsCharts(rawFilters = {}, options = {}) {
    const cacheKey = buildCacheKey("official-analytics-charts", rawFilters, options);
    const cached = this.getCacheEntry(this.analyticsCache, cacheKey);
    if (cached) return cached;

    const organizationId = options.organizationId || null;
    const regionScope = parseRegionScope(rawFilters.region || rawFilters.regionScope || rawFilters.region);
    const status = safeText(rawFilters.status).toLowerCase();
    const baseQuery = buildRegistrationQuery(rawFilters, organizationId);

    if (regionScope === "bogota") {
      pushAndCondition(baseQuery, { localidad: { $in: getBogotaLocalidadesCanonical() } });
    } else if (regionScope === "resto") {
      pushAndCondition(baseQuery, {
        $or: [
          { localidad: { $exists: false } },
          { localidad: null },
          { localidad: "" },
          { localidad: { $nin: getBogotaLocalidadesCanonical() } }
        ]
      });
    }

    if (status === "confirmed") {
      pushAndCondition(baseQuery, {
        $or: [
          { confirmed: true },
          { workflowStatus: "confirmed" }
        ]
      });
    } else if (status === "unconfirmed") {
      pushAndCondition(baseQuery, {
        $nor: [
          { confirmed: true },
          { workflowStatus: "confirmed" }
        ]
      });
    }

    const officialQuery = {
      ...baseQuery,
      officialValidationStatus: "official_valid"
    };

    const [rawTopPuestos, rawTopLocalidades] = await Promise.all([
      Registration.aggregate([
        { $match: officialQuery },
        { $group: { _id: { $ifNull: ["$officialPuestoNombre", "$votingPlace"] }, totalVotos: { $sum: 1 } } },
        { $sort: { totalVotos: -1, _id: 1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            puesto: { $ifNull: ["$_id", "Sin puesto"] },
            totalVotos: 1,
            totalRegistros: "$totalVotos"
          }
        }
      ]),
      Registration.aggregate([
        { $match: officialQuery },
        { $group: { _id: { $ifNull: ["$officialLocalidadNombre", "$localidad"] }, totalVotos: { $sum: 1 } } },
        { $sort: { totalVotos: -1, _id: 1 } },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            localidad: { $ifNull: ["$_id", "Sin Localidad"] },
            totalVotos: 1,
            totalRegistros: "$totalVotos"
          }
        }
      ])
    ]);

    const topPuestos = rawTopPuestos.map((row) => buildChartEntity("puesto", row));
    const topLocalidades = rawTopLocalidades.map((row) => buildChartEntity("localidad", row));
    const bucket = {
      topPuestos,
      topLocalidades
    };
    const emptyBucket = {
      topPuestos: [],
      topLocalidades: []
    };
    const payload = {
      all: regionScope === "all" ? bucket : emptyBucket,
      bogota: regionScope === "bogota" ? bucket : emptyBucket,
      nacional: regionScope === "resto" ? bucket : emptyBucket,
      charts: bucket,
      source: {
        eventId: rawFilters.eventId || null,
        leaderId: rawFilters.leaderId || null,
        region: regionScope,
        status: rawFilters.status || "all",
        universe: "persisted_official_snapshot",
        canonicalAggregation: "VotingHierarchyService"
      },
      timestamp: new Date()
    };

    return this.setCacheEntry(this.analyticsCache, cacheKey, payload);
  }

  buildOfficialHierarchyMatch(rawFilters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const regionScope = parseRegionScope(rawFilters.region || rawFilters.regionScope);
    const status = safeText(rawFilters.status).toLowerCase();
    const query = buildRegistrationQuery(rawFilters, organizationId);
    query.officialValidationStatus = "official_valid";

    if (regionScope === "bogota") {
      pushAndCondition(query, { localidad: { $in: getBogotaLocalidadesCanonical() } });
    } else if (regionScope === "resto") {
      pushAndCondition(query, {
        $or: [
          { localidad: { $exists: false } },
          { localidad: null },
          { localidad: "" },
          { localidad: { $nin: getBogotaLocalidadesCanonical() } }
        ]
      });
    }

    if (status === "confirmed") {
      pushAndCondition(query, {
        $or: [
          { confirmed: true },
          { workflowStatus: "confirmed" }
        ]
      });
    } else if (status === "unconfirmed") {
      pushAndCondition(query, {
        $nor: [
          { confirmed: true },
          { workflowStatus: "confirmed" }
        ]
      });
    }

    return query;
  }

  async getOfficialLocalidadesSummary(rawFilters = {}, options = {}) {
    const match = this.buildOfficialHierarchyMatch(rawFilters, options);
    const rows = await Registration.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            localidadId: "$localidadId",
            localidadNombre: { $ifNull: ["$officialLocalidadNombre", "$localidad"] }
          },
          totalVotes: { $sum: 1 },
          puestos: {
            $addToSet: {
              $ifNull: [
                { $toString: "$puestoId" },
                { $ifNull: ["$officialPuestoCodigo", "$officialPuestoNombre"] }
              ]
            }
          },
          mesas: {
            $addToSet: {
              $ifNull: [
                { $toString: "$officialMesaNumero" },
                { $ifNull: [{ $toString: "$mesa" }, { $toString: "$votingTable" }] }
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          localidadId: {
            $ifNull: [
              { $toString: "$_id.localidadId" },
              "$_id.localidadNombre"
            ]
          },
          localidadNombre: "$_id.localidadNombre",
          totalVotes: 1,
          totalRegistros: "$totalVotes",
          totalPuestos: { $size: "$puestos" },
          totalMesas: { $size: "$mesas" }
        }
      }
    ]);

    return sortHierarchyRows(
      rows.map((row) => buildChartEntity("localidad", row)),
      "localidades",
      rawFilters.sortBy,
      rawFilters.sortDir
    );
  }

  async getOfficialPuestosByLocalidad(localidadId, rawFilters = {}, options = {}) {
    const match = this.buildOfficialHierarchyMatch(rawFilters, options);
    const canonicalLocalidad = canonicalizeBogotaLocality(localidadId) || safeText(localidadId);
    if (mongoose.Types.ObjectId.isValid(localidadId)) {
      match.localidadId = new mongoose.Types.ObjectId(localidadId);
    } else if (canonicalLocalidad) {
      pushAndCondition(match, {
        $or: [
          { officialLocalidadNombre: canonicalLocalidad },
          { localidad: canonicalLocalidad }
        ]
      });
    }

    const rows = await Registration.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            puestoId: "$puestoId",
            puestoCodigo: "$officialPuestoCodigo",
            puestoNombre: { $ifNull: ["$officialPuestoNombre", "$votingPlace"] },
            localidadNombre: { $ifNull: ["$officialLocalidadNombre", "$localidad"] }
          },
          totalVotes: { $sum: 1 },
          mesas: { $addToSet: { $ifNull: [{ $toString: "$officialMesaNumero" }, { $ifNull: [{ $toString: "$mesa" }, { $toString: "$votingTable" }] }] } }
        }
      },
      {
        $project: {
          _id: 0,
          puestoId: {
            $ifNull: [
              { $toString: "$_id.puestoId" },
              { $ifNull: ["$_id.puestoCodigo", "$_id.puestoNombre"] }
            ]
          },
          puestoCodigo: { $ifNull: ["$_id.puestoCodigo", ""] },
          puestoNombre: "$_id.puestoNombre",
          localidadNombre: "$_id.localidadNombre",
          totalVotes: 1,
          totalRegistros: "$totalVotes",
          totalMesas: { $size: "$mesas" }
        }
      },
      { $sort: { totalVotes: -1, puestoNombre: 1 } }
    ]);

    return sortHierarchyRows(
      rows.map((row) => buildChartEntity("puesto", {
        ...row,
        puestoId: safeText(row.puestoId || row.puestoNombre)
      })),
      "puestos",
      rawFilters.sortBy,
      rawFilters.sortDir
    );
  }

  async getOfficialMesasByPuesto(puestoId, rawFilters = {}, options = {}) {
    const match = this.buildOfficialHierarchyMatch(rawFilters, options);
    const rawPuestoKey = safeText(puestoId);
    if (mongoose.Types.ObjectId.isValid(rawPuestoKey)) {
      match.puestoId = new mongoose.Types.ObjectId(rawPuestoKey);
    } else if (rawFilters.puestoCodigo) {
      match.officialPuestoCodigo = safeText(rawFilters.puestoCodigo);
    } else if (rawPuestoKey) {
      pushAndCondition(match, {
        $or: [
          { officialPuestoCodigo: rawPuestoKey },
          { officialPuestoNombre: rawPuestoKey },
          { votingPlace: rawPuestoKey }
        ]
      });
    }

    if (rawFilters.localidadId) {
      const canonicalLocalidad = canonicalizeBogotaLocality(rawFilters.localidadId) || safeText(rawFilters.localidadId);
      if (mongoose.Types.ObjectId.isValid(rawFilters.localidadId)) {
        match.localidadId = new mongoose.Types.ObjectId(rawFilters.localidadId);
      } else if (canonicalLocalidad) {
        pushAndCondition(match, {
          $or: [
            { officialLocalidadNombre: canonicalLocalidad },
            { localidad: canonicalLocalidad }
          ]
        });
      }
    }

    const rows = await Registration.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            mesaNumero: { $ifNull: ["$officialMesaNumero", "$mesa"] }
          },
          totalVotes: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          mesaNumero: "$_id.mesaNumero",
          totalVotes: 1,
          totalRegistros: "$totalVotes"
        }
      },
    ]);
    return sortHierarchyRows(
      rows.map((row) => buildChartEntity("mesa", row)),
      "mesas",
      rawFilters.sortBy,
      rawFilters.sortDir
    );
  }

  async getE14ComparisonData(rawFilters = {}, options = {}) {
    const cacheKey = buildCacheKey("e14", rawFilters, options);
    const cached = this.getCacheEntry(this.e14Cache, cacheKey);
    if (cached) return cached;

    const scope = await this.buildResolvedScope(rawFilters, {
      ...options,
      persistHierarchy: false
    });
    const officialValidation = this.splitPersistedOfficialValidation(scope.registrations);
    const mesaVotes = this.aggregateVotesByMesa(officialValidation.officialRows);
    const mesaMap = new Map();

    mesaVotes.forEach((row) => {
      const key = row.mesa_id || buildCompositeMesaKey({
        localidadId: row.localidad_id,
        puestoId: row.puesto_id,
        mesa: row.mesa
      });
      mesaMap.set(key, {
        mesaKey: key,
        localidadId: row.localidad_id,
        puestoId: row.puesto_id,
        mesaId: row.mesa_id,
        localidad: row.localidad,
        puesto: row.puesto,
        mesa: row.mesa,
        votos_registrados: row.votos_registrados
      });
    });

    scope.confirmations.forEach((row) => {
      const key = row.mesaId || buildCompositeMesaKey({
        localidadId: row.localidadId,
        puestoId: row.puestoId,
        mesa: row.mesa
      });
      const current = mesaMap.get(key) || {
        mesaKey: key,
        localidadId: row.localidadId,
        puestoId: row.puestoId,
        mesaId: row.mesaId,
        localidad: row.localidad,
        puesto: row.puesto,
        mesa: row.mesa,
        votos_registrados: 0
      };
      const votosE14 = row.votosE14Candidate105 ?? row.votosE14SuggestedCandidate105;
      const calc = calculateConfirmation({
        votosRegistrados: current.votos_registrados,
        votosE14,
        hasMissingLocation: !current.localidad || !current.puesto || current.mesa === null
      });
      const hint = buildE14NavigationHint({
        localidad: current.localidad,
        puesto: current.puesto,
        mesa: current.mesa,
        e14ZoneCode: row.zoneCode
      });
      mesaMap.set(key, {
        ...current,
        zoneCode: row.zoneCode || hint.zoneCode || null,
        zoneLabel: hint.zoneLabel || null,
        votos_e14: votosE14,
        votosE14Candidate105: votosE14,
        votosE14SuggestedCandidate105: row.votosE14SuggestedCandidate105 ?? null,
        e14ListVotes: row.e14ListVotes ?? null,
        diferencia: calc.diferencia,
        porcentaje_confirmacion: calc.porcentaje,
        confirmacionPorcentaje: calc.porcentaje,
        estado: calc.estado,
        notes: row.notes || "",
        validatedAt: row.validatedAt || null,
        validatedBy: row.validatedBy || null,
        source: row.source || null,
        reviewRequired: row.reviewRequired || false,
        reviewReason: row.reviewReason || "",
        taskId: row.taskId || "",
        reviewPriorityRank: row.reviewPriorityRank ?? null,
        sourceEstadoRevision: row.sourceEstadoRevision || "",
        sourceConfidence: row.sourceConfidence ?? null,
        sourceScoreDigito: row.sourceScoreDigito ?? null,
        sourceScoreSegundo: row.sourceScoreSegundo ?? null,
        sourceMetodoDigito: row.sourceMetodoDigito || "",
        sourceDebugDir: row.sourceDebugDir || "",
        sourceDocumento: row.sourceDocumento || "",
        sourceArchivo: row.sourceArchivo || "",
        sourceLocalFileUri: row.sourceLocalFileUri || "",
        sourceCaptureAvailable: row.sourceCaptureAvailable || false,
        sourceOverlayPath: row.sourceOverlayPath || "",
        sourceCellPath: row.sourceCellPath || "",
        sourceMaskPath: row.sourceMaskPath || "",
        sourcePartyBlockPath: row.sourcePartyBlockPath || ""
      });
    });

    const rows = [...mesaMap.values()]
      .map((row) => {
        const votosE14 = Number.isFinite(row.votos_e14) ? row.votos_e14 : null;
        const calc = calculateConfirmation({
          votosRegistrados: row.votos_registrados,
          votosE14,
          hasMissingLocation: !row.localidad || !row.puesto || row.mesa === null
        });
        const hint = buildE14NavigationHint({
          localidad: row.localidad,
          puesto: row.puesto,
          mesa: row.mesa,
          e14ZoneCode: row.zoneCode
        });
        return {
          ...row,
          votosReportadosTotales: row.votos_registrados,
          groupCount: row.votos_registrados,
          votosE14Candidate105: votosE14,
          diferencia: calc.diferencia,
          porcentaje_confirmacion: calc.porcentaje,
          confirmacionPorcentaje: calc.porcentaje,
          estado: calc.estado,
          e14Reference: hint,
          isPendingNormalization: Boolean(row.isPendingNormalization || row.puesto === MATCH_REVIEW_BUCKET),
          legacyPuestoExamples: Array.isArray(row.legacyPuestoExamples) ? row.legacyPuestoExamples : [],
          legacyPuestoPrimary: row.legacyPuestoPrimary || "",
          canonicalPuestoLabel: row.puesto,
          reviewBucketLabel: row.isPendingNormalization ? MATCH_REVIEW_BUCKET : ""
        };
      })
      .filter((row) => {
        if (rawFilters.estado && rawFilters.estado !== "manual_only" && row.estado !== rawFilters.estado) return false;
        if (rawFilters.estado === "manual_only" && row.source !== "manual") return false;
        if (rawFilters.sourceStatus && String(row.sourceEstadoRevision || "") !== String(rawFilters.sourceStatus)) return false;
        return true;
      })
      .sort((a, b) => {
        const loc = safeText(a.localidad).localeCompare(safeText(b.localidad), "es");
        if (loc !== 0) return loc;
        const puesto = safeText(a.puesto).localeCompare(safeText(b.puesto), "es");
        if (puesto !== 0) return puesto;
        return (a.mesa || 0) - (b.mesa || 0);
      });

    const localidadesDisponibles = [...new Set(rows.map((row) => row.localidad).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((value) => ({ value, label: value, zoneCode: getBogotaZoneCode(value) || null }));

    const selectedLocalidad = safeText(rawFilters.localidad);
    const puestosDisponibles = [...new Set(
      rows
        .filter((row) => !selectedLocalidad || row.localidad === selectedLocalidad)
        .map((row) => row.puesto)
        .filter(Boolean)
    )]
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((value) => ({ value, label: value }));

    const page = Math.max(1, Number.parseInt(rawFilters.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(rawFilters.limit, 10) || 25));
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const items = rows.slice(start, start + limit);

    const kpis = {
      mesasAnalizadas: rows.length,
      mesasPendientesE14: rows.filter((row) => row.estado === "pendiente_e14").length,
      mesasConfirmadas: rows.filter((row) => row.estado === "confirmado").length,
      confirmacionPromedio: (() => {
        const values = rows.filter((row) => typeof row.porcentaje_confirmacion === "number");
        if (values.length === 0) return 0;
        return Number(
          (values.reduce((sum, row) => sum + row.porcentaje_confirmacion, 0) / values.length).toFixed(2)
        );
      })(),
      votosReportadosTotales: rows.reduce((sum, row) => sum + Number(row.votos_registrados || 0), 0),
      votosE14Totales: rows.reduce((sum, row) => sum + Number(row.votosE14Candidate105 || 0), 0),
      registrosErroneosOIncompletos: officialValidation.errorRows.length
    };

    const includeInvalidItems = parseBooleanFlag(rawFilters.includeInvalidItems, true);
    const invalidLimit = Math.min(
      500,
      Math.max(0, Number.parseInt(rawFilters.invalidLimit, 10) || (includeInvalidItems ? 500 : 0))
    );
    const invalidRows = officialValidation.errorRows
      .filter((row) => {
        if (rawFilters.search) {
          const needle = normalizeName(rawFilters.search);
          const haystack = normalizeName([
            row.localidadRaw,
            row.puestoRaw,
            row.normalizedLocalidad,
            row.normalizedPuesto,
            row.leaderName,
            row.reason
          ].join(" "));
          if (!haystack.includes(needle)) return false;
        }
        if (rawFilters.localidad && normalizeName(row.normalizedLocalidad || row.localidadRaw) !== normalizeName(rawFilters.localidad)) {
          return false;
        }
        return true;
      });

    return this.setCacheEntry(this.e14Cache, cacheKey, {
      kpis,
      items,
      invalidItems: includeInvalidItems && invalidLimit > 0 ? invalidRows.slice(0, invalidLimit) : [],
      invalidTotal: invalidRows.length,
      invalidSummary: this.buildErrorRegionPayload(invalidRows),
      pagination: {
        total,
        page,
        limit,
        totalPages
      },
      filters: {
        regionScope: parseRegionScope(rawFilters.regionScope || rawFilters.regionScopeFilter),
        localidadesDisponibles,
        puestosDisponibles
      },
      context: {
        aggregation: "by_mesa",
        canonicalAggregation: "VotingHierarchyService",
        officialCatalogVersion: officialValidation.catalog.version || ""
      },
      validation: this.buildValidationFromResolvedScope(scope),
      debug: {
        totalInputRecords: scope.rawCount,
        includedRecords: officialValidation.officialRows.length,
        excludedRecords: officialValidation.errorRows.length
      }
    });
  }

  async getInvalidDataPage(rawFilters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const page = Math.max(toInt(rawFilters.page) || 1, 1);
    const limit = Math.min(Math.max(toInt(rawFilters.limit) || 25, 1), 200);
    const skip = (page - 1) * limit;
    const countOnly = parseBooleanFlag(rawFilters.countOnly, false);
    const query = buildRegistrationQuery(rawFilters, organizationId);
    query.officialValidationStatus = { $ne: "official_valid" };

    const regionScope = parseRegionScope(rawFilters.regionScope || rawFilters.region);
    if (regionScope === "bogota") {
      query.localidad = { $in: getBogotaLocalidadesCanonical() };
    } else if (regionScope === "resto") {
      query.$or = [
        { localidad: { $exists: false } },
        { localidad: null },
        { localidad: "" },
        { localidad: { $nin: getBogotaLocalidadesCanonical() } }
      ];
    }

    if (rawFilters.reason) query.officialValidationReason = String(rawFilters.reason);
    if (rawFilters.localidad) {
      query.localidad = canonicalizeBogotaLocality(rawFilters.localidad) || String(rawFilters.localidad);
    }
    if (rawFilters.reviewStatus === "reviewed") query.officialValidationReviewed = true;
    if (rawFilters.reviewStatus === "pending") query.officialValidationReviewed = { $ne: true };

    const search = safeText(rawFilters.search);
    if (search) {
      const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { leaderName: regex },
          { votingPlace: regex },
          { legacyVotingPlace: regex },
          { officialSuggestedPuesto: regex },
          { officialSuggestedLocalidad: regex },
          { cedula: regex }
        ]
      });
    }

    const projection = {
      leaderName: 1,
      localidad: 1,
      votingPlace: 1,
      legacyVotingPlace: 1,
      votingTable: 1,
      mesa: 1,
      cedula: 1,
      firstName: 1,
      lastName: 1,
      createdAt: 1,
      officialValidationStatus: 1,
      officialValidationReason: 1,
      officialValidationReviewed: 1,
      officialCatalogVersion: 1,
      officialLocalidadNombre: 1,
      officialPuestoNombre: 1,
      officialPuestoCodigo: 1,
      officialSuggestedPuesto: 1,
      officialSuggestedLocalidad: 1,
      puestoMatchStatus: 1,
      puestoMatchConfidence: 1
    };

    const total = await Registration.countDocuments(query);

    if (countOnly) {
      return {
        rows: [],
        total,
        page: 1,
        limit: 0,
        totalPages: total > 0 ? 1 : 0,
        summary: { total, byReason: [] },
        context: {
          officialCatalogVersion: "",
          regionScope
        }
      };
    }

    const docs = await Registration.find(query, projection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const rows = docs.map((doc) => ({
      id: String(doc._id),
      registrationId: String(doc._id),
      leaderName: doc.leaderName || "Sin lider",
      rawLocalidad: doc.localidad || "",
      rawPuesto: doc.legacyVotingPlace || doc.votingPlace || "",
      rawMesa: doc.votingTable || doc.mesa || "",
      normalizedLocalidad: doc.localidad || "",
      normalizedPuesto: doc.votingPlace || "",
      suggestedOfficialPuesto: doc.officialSuggestedPuesto || doc.officialPuestoNombre || "",
      suggestedOfficialLocalidad: doc.officialSuggestedLocalidad || doc.officialLocalidadNombre || "",
      suggestedOfficialCodigoPuesto: doc.officialPuestoCodigo || "",
      officialValidationStatus: doc.officialValidationStatus || "pending_official_validation",
      officialValidationReason: doc.officialValidationReason || "",
      createdAt: doc.createdAt || null,
      reviewStatus: doc.officialValidationReviewed === true ? "reviewed" : "pending",
      cedula: doc.cedula || "",
      firstName: doc.firstName || "",
      lastName: doc.lastName || "",
      legacyVotingPlace: doc.legacyVotingPlace || "",
      puestoMatchStatus: doc.puestoMatchStatus || "",
      puestoMatchConfidence: doc.puestoMatchConfidence ?? null,
      officialCatalogVersion: doc.officialCatalogVersion || ""
    }));

    const summary = this.buildErrorRegionPayload(rows);
    return {
      rows,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
      summary,
      context: {
        officialCatalogVersion: rows[0]?.officialCatalogVersion || "",
        regionScope
      }
    };
  }

  async getInvalidDataDetail(registrationId, options = {}) {
    const organizationId = options.organizationId || null;
    const doc = await Registration.findOne(
      {
        _id: registrationId,
        ...(organizationId ? { organizationId } : {})
      },
      {
        leaderName: 1,
        localidad: 1,
        votingPlace: 1,
        legacyVotingPlace: 1,
        votingTable: 1,
        mesa: 1,
        cedula: 1,
        firstName: 1,
        lastName: 1,
        createdAt: 1,
        officialValidationStatus: 1,
        officialValidationReason: 1,
        officialValidationReviewed: 1,
        officialCatalogVersion: 1,
        officialLocalidadNombre: 1,
        officialPuestoNombre: 1,
        officialPuestoCodigo: 1,
        officialSuggestedPuesto: 1,
        officialSuggestedLocalidad: 1,
        puestoMatchStatus: 1,
        puestoMatchType: 1,
        puestoMatchConfidence: 1,
        correctionHistory: 1
      }
    ).lean();

    if (!doc) throw new Error("Registro excluido no encontrado");

    return {
      id: String(doc._id),
      registrationId: String(doc._id),
      leaderName: doc.leaderName || "Sin lider",
      rawLocalidad: doc.localidad || "",
      rawPuesto: doc.legacyVotingPlace || doc.votingPlace || "",
      rawMesa: doc.votingTable || doc.mesa || "",
      normalizedLocalidad: doc.localidad || "",
      normalizedPuesto: doc.votingPlace || "",
      suggestedOfficialPuesto: doc.officialSuggestedPuesto || doc.officialPuestoNombre || "",
      suggestedOfficialLocalidad: doc.officialSuggestedLocalidad || doc.officialLocalidadNombre || "",
      suggestedOfficialCodigoPuesto: doc.officialPuestoCodigo || "",
      officialValidationStatus: doc.officialValidationStatus || "pending_official_validation",
      officialValidationReason: doc.officialValidationReason || "",
      createdAt: doc.createdAt || null,
      reviewStatus: doc.officialValidationReviewed === true ? "reviewed" : "pending",
      cedula: doc.cedula || "",
      firstName: doc.firstName || "",
      lastName: doc.lastName || "",
      legacyVotingPlace: doc.legacyVotingPlace || "",
      puestoMatchStatus: doc.puestoMatchStatus || "",
      puestoMatchType: doc.puestoMatchType || "",
      puestoMatchConfidence: doc.puestoMatchConfidence ?? null,
      officialCatalogVersion: doc.officialCatalogVersion || "",
      correctionHistory: Array.isArray(doc.correctionHistory) ? doc.correctionHistory : []
    };
  }

  async resolveHierarchyReference(payload = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const scope = options.scopeDocuments || await this.loadScopeDocuments({}, { organizationId });
    const master = options.master || await this.syncMasterTables(scope, { persist: false });

    const localidadId =
      toObjectIdString(payload.localidadId)
      || toObjectIdString(this.resolveLocalidadId(payload.localidad, master, organizationId));
    const puestoId = toObjectIdString(payload.puestoId);
    const mesa = toInt(payload.mesa);

    let puesto = null;
    if (puestoId) {
      puesto = scope.puestos.find((item) => String(item._id) === puestoId) || null;
    } else if (localidadId && payload.puesto) {
      puesto = master.puestoKeyByScopedPair.get(`${localidadId}::${normalizeLookupName(payload.puesto)}`) || null;
    } else if (payload.puesto) {
      puesto = master.puestoKeyByName.get(normalizeLookupName(payload.puesto)) || null;
    }

    if (!puesto && payload.puesto) {
      const legacyMatch = await puestoMatchingService.resolvePuesto(payload.puesto, localidadId, {
        organizationId,
        master: {
          puestos: master.puestos,
          byLocalidad: new Map(
            [...new Set(master.puestos.map((item) => toObjectIdString(item.localidadId)).filter(Boolean))]
              .map((localityKey) => [localityKey, master.puestos.filter((item) => toObjectIdString(item.localidadId) === localityKey)])
          ),
          byName: new Map()
        },
        rawLocalidad: payload.localidad || ""
      });
      if (legacyMatch?.autoAssignable && legacyMatch?.suggestedPuestoId) {
        puesto = scope.puestos.find((item) => String(item._id) === String(legacyMatch.suggestedPuestoId)) || null;
      }
    }

    if (!puesto) throw new Error("No se pudo resolver el puesto desde los datos maestros");
    if (!localidadId && !toObjectIdString(puesto.localidadId)) {
      throw new Error("No se pudo resolver la localidad desde los datos maestros");
    }

    const effectiveLocalidadId = localidadId || toObjectIdString(puesto.localidadId);
    const mesaKey = `${organizationId || "global"}::${String(puesto._id)}::${mesa}`;
    let mesaDoc = master.mesaByScopedKey.get(mesaKey) || master.mesaByScopedKey.get(`global::${String(puesto._id)}::${mesa}`) || null;
    if (!mesaDoc && mesa !== null && mesa > 0) {
      await Mesa.updateOne(
        {
          organizationId: organizationId || null,
          puestoId: puesto._id,
          numero: mesa
        },
        {
          $set: {
            organizationId: organizationId || null,
            puestoId: puesto._id,
            numero: mesa
          }
        },
        { upsert: true }
      );
      mesaDoc = await Mesa.findOne({
        organizationId: organizationId || null,
        puestoId: puesto._id,
        numero: mesa
      }).lean();
    }

    return {
      localidadId: effectiveLocalidadId,
      localidad: master.localidadById.get(String(effectiveLocalidadId))?.nombre || puesto.localidad,
      puestoId: String(puesto._id),
      puesto: puesto.nombre,
      mesaId: mesaDoc?._id ? String(mesaDoc._id) : null,
      mesa
    };
  }

  async saveE14ManualByMesa(payload = {}, options = {}) {
    const organizationId = options.organizationId || null;
    if (!organizationId) throw new Error("organizationId requerido");

    const resolved = await this.resolveHierarchyReference(payload, options);
    if (!resolved.localidadId || !resolved.puestoId || resolved.mesa === null || resolved.mesa <= 0) {
      throw new Error("localidad, puesto y mesa validos son requeridos");
    }

    const mesaVotes = await this.getVotesByMesa(
      {
        eventId: payload.eventId || null,
        localidad: resolved.localidad,
        puesto: resolved.puesto,
        mesa: resolved.mesa
      },
      options
    );
    const mesaRow = mesaVotes.find((row) => row.mesa === resolved.mesa) || null;
    const votosRegistrados = mesaRow?.votos_registrados || 0;
    const votosE14 = toInt(payload.votosE14Candidate105);
    if (votosE14 === null || votosE14 < 0) {
      throw new Error("votosE14Candidate105 debe ser un numero mayor o igual a 0");
    }
    const calc = calculateConfirmation({
      votosRegistrados,
      votosE14,
      hasMissingLocation: false
    });

    await E14ConfirmationByMesa.updateOne(
      {
        organizationId,
        eventId: payload.eventId || null,
        localidadId: new mongoose.Types.ObjectId(resolved.localidadId),
        puestoId: new mongoose.Types.ObjectId(resolved.puestoId),
        mesa: resolved.mesa
      },
      {
        $set: {
          organizationId,
          eventId: payload.eventId || null,
          localidadId: new mongoose.Types.ObjectId(resolved.localidadId),
          puestoId: new mongoose.Types.ObjectId(resolved.puestoId),
          mesaId: resolved.mesaId ? new mongoose.Types.ObjectId(resolved.mesaId) : null,
          localidad: resolved.localidad,
          puesto: resolved.puesto,
          mesa: resolved.mesa,
          zoneCode: payload.zoneCode || getBogotaZoneCode(resolved.localidad) || null,
          normalizedLocalidad: normalizeName(resolved.localidad),
          normalizedPuesto: normalizeName(resolved.puesto),
          votosReportadosTotales: votosRegistrados,
          votosE14Candidate105: votosE14,
          votosE14SuggestedCandidate105: votosE14,
          e14ListVotes: toInt(payload.e14ListVotes),
          confirmacionPorcentaje: calc.porcentaje,
          diferencia: calc.diferencia,
          estado: calc.estado,
          notes: payload.notes || "",
          validatedAt: new Date(),
          validatedBy: payload.validatedBy || options.validatedBy || "admin",
          source: "manual"
        }
      },
      { upsert: true }
    );

    this.clearCaches();

    return {
      ...resolved,
      votosRegistrados,
      votosE14Candidate105: votosE14,
      diferencia: calc.diferencia,
      porcentajeConfirmacion: calc.porcentaje,
      estado: calc.estado
    };
  }

  async backfillAll(options = {}) {
    const scope = await this.buildResolvedScope({}, {
      ...options,
      persistHierarchy: true
    });
    const master = scope.master;
    this.clearCaches();
    logger.info("[VotingHierarchyService] backfill complete", {
      organizationId: options.organizationId || null,
      localidades: master.localidades.length,
      puestos: scope.puestos.length
    });
    return {
      localidades: master.localidades.length,
      puestos: scope.puestos.length,
      registros: scope.registrations.length,
      confirmaciones: scope.confirmations.length
    };
  }
}

const votingHierarchyService = new VotingHierarchyService();

export default votingHierarchyService;
