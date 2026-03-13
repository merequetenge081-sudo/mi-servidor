import mongoose from "mongoose";
import { distance as levenshteinDistance } from "fastest-levenshtein";
import { Leader } from "../models/Leader.js";
import { MesaOficialBogota } from "../models/MesaOficialBogota.js";
import { Puestos } from "../models/Puestos.js";
import { Registration } from "../models/Registration.js";
import { normalizeMesaNumber, normalizeText } from "../shared/textNormalization.js";

const MIN_OFFICIAL_MESAS = Math.max(1, Number.parseInt(process.env.BOGOTA_OFFICIAL_MIN_MESAS || "100", 10));
const MIN_OFFICIAL_PUESTOS = Math.max(1, Number.parseInt(process.env.BOGOTA_OFFICIAL_MIN_PUESTOS || "10", 10));

function buildValidationStatus({ hasPuesto, hasMesa, hasExact, hasPuestoOnly }) {
  if (!hasPuesto || !hasMesa) return "datos_incompletos";
  if (hasExact) return "valido";
  if (hasPuestoOnly) return "mesa_invalida";
  return "puesto_invalido";
}

function getPuestoText(registration) {
  if (registration?.puestoResolvedName) return registration.puestoResolvedName;
  if (registration?.votingPlace) return registration.votingPlace;
  if (registration?.puestoId && typeof registration.puestoId === "object") {
    return registration.puestoId.nombre || registration.puestoId.name || "";
  }
  return "";
}

export function validateMesaFromCatalog(officialCatalog, puesto, mesa) {
  const normalizedPuesto = normalizeText(puesto);
  const mesaNumber = normalizeMesaNumber(mesa);
  const hasPuesto = Boolean(normalizedPuesto);
  const hasMesa = mesaNumber !== null;
  const byPuesto = hasPuesto ? officialCatalog.byPuesto.get(normalizedPuesto) : null;
  const hasPuestoOnly = Boolean(byPuesto);
  const hasExact = Boolean(byPuesto && hasMesa && byPuesto.has(mesaNumber));
  const status = buildValidationStatus({ hasPuesto, hasMesa, hasExact, hasPuestoOnly });

  return {
    estado: status,
    valido: status === "valido",
    mesa_invalida: status === "mesa_invalida",
    puesto_invalido: status === "puesto_invalido",
    incompleto: status === "datos_incompletos",
    normalizedPuesto,
    mesaNumber
  };
}

async function buildOfficialCatalog() {
  const docs = await MesaOficialBogota.find({}, { normalizedPuesto: 1, mesa: 1 }).lean();
  const byPuesto = new Map();
  docs.forEach((doc) => {
    const key = normalizeText(doc.normalizedPuesto);
    if (!key) return;
    if (!byPuesto.has(key)) byPuesto.set(key, new Set());
    byPuesto.get(key).add(Number(doc.mesa));
  });

  const totalMesas = docs.length;
  const totalPuestos = byPuesto.size;
  const isSufficient = totalMesas >= MIN_OFFICIAL_MESAS && totalPuestos >= MIN_OFFICIAL_PUESTOS;

  return {
    byPuesto,
    totalMesas,
    totalPuestos,
    isSufficient,
    thresholds: {
      minMesas: MIN_OFFICIAL_MESAS,
      minPuestos: MIN_OFFICIAL_PUESTOS
    }
  };
}

function normalizeFilters(raw = {}) {
  return {
    eventId: raw.eventId || null,
    leaderId: raw.leaderId || null,
    localidad: raw.localidad || "",
    puesto: raw.puesto || "",
    mesa: raw.mesa || "",
    estadoValidacion: raw.estadoValidacion || "",
    estado: raw.estado || "",
    search: raw.search || "",
    page: Math.max(1, Number.parseInt(raw.page, 10) || 1),
    limit: Math.min(200, Math.max(1, Number.parseInt(raw.limit, 10) || 25))
  };
}

function buildRegistrationQuery(filters, organizationId) {
  const query = {};
  if (organizationId) query.organizationId = organizationId;
  if (filters.eventId) query.eventId = String(filters.eventId);
  if (filters.leaderId) query.leaderId = String(filters.leaderId);
  if (filters.localidad) query.localidad = new RegExp(filters.localidad, "i");
  if (filters.search) {
    const regex = new RegExp(filters.search, "i");
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { cedula: regex },
      { email: regex },
      { phone: regex },
      { leaderName: regex },
      { votingPlace: regex }
    ];
  }
  return query;
}

function mapDetail(status) {
  if (status === "valido") return "Puesto y mesa coinciden con el catalogo oficial";
  if (status === "mesa_invalida") return "Puesto existe, pero la mesa no esta registrada en el catalogo";
  if (status === "puesto_invalido") return "El puesto no aparece en el catalogo oficial de Bogota";
  return "Falta puesto o mesa para validar contra fuente oficial";
}

function suggestPuesto(normalizedPuesto, catalogKeys = []) {
  if (!normalizedPuesto || !Array.isArray(catalogKeys) || catalogKeys.length === 0) return null;
  let best = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const key of catalogKeys) {
    const d = levenshteinDistance(normalizedPuesto, key);
    if (d < bestDistance) {
      bestDistance = d;
      best = key;
    }
  }
  const maxAllowed = Math.max(4, Math.floor(normalizedPuesto.length * 0.25));
  if (best && bestDistance <= maxAllowed) {
    return best;
  }
  return null;
}

async function resolveLeaderMap(leaderIds = [], organizationId = null) {
  const uniqueIds = [...new Set(leaderIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return new Map();
  const objectIdCandidates = uniqueIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const or = [{ leaderId: { $in: uniqueIds } }];
  if (objectIdCandidates.length > 0) {
    or.push({ _id: { $in: objectIdCandidates } });
  }
  const query = { $or: or };
  if (organizationId) query.organizationId = organizationId;
  const leaders = await Leader.find(query, { name: 1, leaderId: 1 }).lean();
  const map = new Map();
  leaders.forEach((leader) => {
    if (leader._id) map.set(String(leader._id), leader.name || "");
    if (leader.leaderId) map.set(String(leader.leaderId), leader.name || "");
  });
  return map;
}

async function resolvePuestoMap(puestoIds = []) {
  const uniqueIds = [...new Set(puestoIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return new Map();
  const puestos = await Puestos.find({ _id: { $in: uniqueIds } }, { nombre: 1, localidad: 1 }).lean();
  const map = new Map();
  puestos.forEach((puesto) => {
    map.set(String(puesto._id), `${puesto.nombre || ""}`.trim());
  });
  return map;
}

function createCounters() {
  return {
    analizados: 0,
    validos: 0,
    invalidos: 0,
    incompletos: 0,
    mesaInvalida: 0,
    puestoInvalido: 0
  };
}

function touchCounter(counter, status) {
  counter.analizados += 1;
  if (status === "valido") counter.validos += 1;
  if (status === "datos_incompletos") counter.incompletos += 1;
  if (status === "mesa_invalida") counter.mesaInvalida += 1;
  if (status === "puesto_invalido") counter.puestoInvalido += 1;
  if (status !== "valido") counter.invalidos += 1;
}

function buildCatalogWarning(catalog) {
  return `Catalogo oficial insuficiente para validar. Mesas=${catalog.totalMesas}, Puestos=${catalog.totalPuestos}, minimoMesas=${catalog.thresholds.minMesas}, minimoPuestos=${catalog.thresholds.minPuestos}.`;
}

export async function validateRecordsAgainstBogotaOfficialData(rawFilters = {}, options = {}) {
  const filters = normalizeFilters(rawFilters);
  const organizationId = options.organizationId || null;
  const query = buildRegistrationQuery(filters, organizationId);
  const catalog = await buildOfficialCatalog();
  const catalogKeys = [...catalog.byPuesto.keys()];
  const catalogInsufficient = !catalog.isSufficient;

  const docs = await Registration.find(query, {
    firstName: 1,
    lastName: 1,
    leaderId: 1,
    leaderName: 1,
    localidad: 1,
    mesa: 1,
    votingTable: 1,
    votingPlace: 1,
    puestoId: 1,
    eventId: 1,
    dataIntegrityStatus: 1,
    missingPollingPlace: 1,
    requiresReview: 1,
    mesaValidationStatus: 1
  })
    .sort({ createdAt: -1 })
    .lean();

  const leaderMap = await resolveLeaderMap(docs.map((d) => d.leaderId), organizationId);
  const puestoMap = await resolvePuestoMap(docs.map((d) => d.puestoId));

  const counters = createCounters();
  const rows = docs.map((doc) => {
    const puestoResolvedName = puestoMap.get(String(doc.puestoId)) || getPuestoText(doc);
    const mesaValue = doc.mesa ?? doc.votingTable ?? null;

    if (catalogInsufficient) {
      return {
        registrationId: String(doc._id),
        eventId: doc.eventId,
        voterName: `${doc.firstName || ""} ${doc.lastName || ""}`.trim(),
        leaderResolvedName: doc.leaderName || leaderMap.get(String(doc.leaderId)) || "Sin lider",
        leaderId: doc.leaderId || null,
        localidad: doc.localidad || "",
        puestoResolvedName,
        mesaResolved: normalizeMesaNumber(mesaValue),
        estadoValidacion: "catalogo_insuficiente",
        validationStatus: "catalogo_insuficiente",
        detalleValidacion: "Catalogo oficial insuficiente para validar (sin mesas suficientes sincronizadas).",
        validationDetail: "Catalogo oficial insuficiente para validar (sin mesas suficientes sincronizadas).",
        suggestedOfficialPollingPlace: null
      };
    }

    const validation = validateMesaFromCatalog(catalog, puestoResolvedName, mesaValue);
    const suggestedOfficial = validation.estado === "puesto_invalido"
      ? suggestPuesto(validation.normalizedPuesto, catalogKeys)
      : null;
    const detail = suggestedOfficial
      ? `${mapDetail(validation.estado)}. Posible puesto oficial: ${suggestedOfficial}`
      : mapDetail(validation.estado);
    touchCounter(counters, validation.estado);

    return {
      registrationId: String(doc._id),
      eventId: doc.eventId,
      voterName: `${doc.firstName || ""} ${doc.lastName || ""}`.trim(),
      leaderResolvedName: doc.leaderName || leaderMap.get(String(doc.leaderId)) || "Sin lider",
      leaderId: doc.leaderId || null,
      localidad: doc.localidad || "",
      puestoResolvedName,
      mesaResolved: normalizeMesaNumber(mesaValue),
      estadoValidacion: validation.estado,
      validationStatus: validation.estado,
      detalleValidacion: detail,
      validationDetail: detail,
      suggestedOfficialPollingPlace: suggestedOfficial || null
    };
  });

  let filteredRows = rows;
  if (filters.puesto) {
    const needle = normalizeText(filters.puesto);
    filteredRows = filteredRows.filter((r) => normalizeText(r.puestoResolvedName).includes(needle));
  }
  if (filters.mesa) {
    const mesaNeedle = normalizeMesaNumber(filters.mesa);
    filteredRows = filteredRows.filter((r) => r.mesaResolved === mesaNeedle);
  }
  const effectiveStatus = filters.estadoValidacion || filters.estado || "";
  if (effectiveStatus) {
    filteredRows = filteredRows.filter((r) => r.estadoValidacion === effectiveStatus);
  }

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const start = (filters.page - 1) * filters.limit;
  const end = start + filters.limit;
  const items = filteredRows.slice(start, end);

  const porcentajeValidacion = counters.analizados > 0
    ? Number(((counters.validos / counters.analizados) * 100).toFixed(2))
    : 0;

  return {
    catalog: {
      isSufficient: catalog.isSufficient,
      totalMesas: catalog.totalMesas,
      totalPuestos: catalog.totalPuestos,
      thresholds: catalog.thresholds
    },
    catalogInsufficient,
    warnings: catalogInsufficient ? [buildCatalogWarning(catalog)] : [],
    kpis: {
      registrosAnalizados: catalogInsufficient ? 0 : counters.analizados,
      registrosValidos: catalogInsufficient ? 0 : counters.validos,
      registrosInvalidos: catalogInsufficient ? 0 : counters.invalidos,
      registrosIncompletos: catalogInsufficient ? 0 : counters.incompletos,
      porcentajeValidacion: catalogInsufficient ? 0 : porcentajeValidacion
    },
    counters: {
      ...(catalogInsufficient ? createCounters() : counters),
      mesaInvalidas: catalogInsufficient ? 0 : counters.mesaInvalida,
      puestoInvalidos: catalogInsufficient ? 0 : counters.puestoInvalido
    },
    items,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages
    }
  };
}

export async function runMassMesaValidation(rawFilters = {}, options = {}) {
  const organizationId = options.organizationId || null;
  const filters = normalizeFilters(rawFilters);
  const query = buildRegistrationQuery(filters, organizationId);
  let docs = await Registration.find(query, {
    leaderId: 1,
    leaderName: 1,
    mesa: 1,
    votingTable: 1,
    votingPlace: 1,
    puestoId: 1
  }).lean();
  if (filters.limit && Number.isFinite(filters.limit)) {
    docs = docs.slice(0, filters.limit);
  }

  const catalog = await buildOfficialCatalog();
  if (!catalog.isSufficient) {
    return {
      success: false,
      skipped: true,
      catalogInsufficient: true,
      message: buildCatalogWarning(catalog),
      processed: 0,
      validos: 0,
      mesaInvalidas: 0,
      puestoInvalidos: 0,
      incompletos: 0,
      updated: 0,
      markedForReview: 0,
      missingPollingPlace: 0,
      leadersNotified: 0,
      leaderAlerts: [],
      catalog: {
        isSufficient: catalog.isSufficient,
        totalMesas: catalog.totalMesas,
        totalPuestos: catalog.totalPuestos,
        thresholds: catalog.thresholds
      }
    };
  }

  const puestoMap = await resolvePuestoMap(docs.map((d) => d.puestoId));
  const catalogKeys = [...catalog.byPuesto.keys()];

  const bulk = [];
  const pendingByLeader = new Map();
  let processed = 0;
  let validos = 0;
  let mesaInvalidas = 0;
  let puestoInvalidos = 0;
  let incompletos = 0;
  let markedForReview = 0;

  for (const doc of docs) {
    const puestoResolvedName = puestoMap.get(String(doc.puestoId)) || getPuestoText(doc);
    const mesaValue = doc.mesa ?? doc.votingTable ?? null;
    const validation = validateMesaFromCatalog(catalog, puestoResolvedName, mesaValue);
    if (validation.estado === "valido") validos += 1;
    if (validation.estado === "mesa_invalida") mesaInvalidas += 1;
    if (validation.estado === "puesto_invalido") puestoInvalidos += 1;
    if (validation.estado === "datos_incompletos") incompletos += 1;
    const requiresReview = validation.estado !== "valido";
    const missingPollingPlace = validation.estado === "datos_incompletos";
    const suggestedOfficial = validation.estado === "puesto_invalido"
      ? suggestPuesto(validation.normalizedPuesto, catalogKeys)
      : null;

    if (requiresReview) markedForReview += 1;
    if (missingPollingPlace) {
      const key = String(doc.leaderId || "sin_lider");
      pendingByLeader.set(key, (pendingByLeader.get(key) || 0) + 1);
    }

    bulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            mesaValidationStatus: validation.estado,
            mesaValidationDetail: suggestedOfficial
              ? `${mapDetail(validation.estado)}. Posible puesto oficial: ${suggestedOfficial}`
              : mapDetail(validation.estado),
            requiresReview,
            missingPollingPlace,
            dataIntegrityStatus: requiresReview ? "needs_review" : "valid"
          }
        }
      }
    });
    processed += 1;
  }

  if (bulk.length > 0) {
    await Registration.bulkWrite(bulk, { ordered: false });
  }

  const leaderMap = await resolveLeaderMap([...pendingByLeader.keys()], organizationId);
  const leaderAlerts = [...pendingByLeader.entries()].map(([leaderId, count]) => ({
    leaderId,
    leaderName: leaderMap.get(leaderId) || "Sin lider",
    count,
    message: `Tienes ${count} registro(s) sin puesto/mesa asignado(a). Revisa y completa la informacion.`
  }));

  return {
    success: true,
    processed,
    validos,
    mesaInvalidas,
    puestoInvalidos,
    incompletos,
    updated: bulk.length,
    markedForReview,
    missingPollingPlace: leaderAlerts.reduce((acc, row) => acc + row.count, 0),
    leadersNotified: leaderAlerts.length,
    leaderAlerts
  };
}

export default {
  validateRecordsAgainstBogotaOfficialData,
  runMassMesaValidation,
  validateMesaFromCatalog
};
