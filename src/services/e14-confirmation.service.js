import mongoose from "mongoose";
import { Leader } from "../models/Leader.js";
import { Puestos } from "../models/Puestos.js";
import { Registration } from "../models/Registration.js";
import { E14ConfirmationByMesa } from "../models/E14ConfirmationByMesa.js";
import logger from "../config/logger.js";
import { buildE14NavigationHint, getBogotaZoneCode } from "../shared/bogota-zones.js";
import {
  getBogotaLocalidades,
  isBogotaMunicipality,
  normalizeBogotaLocalidad,
  normalizeBogotaPuesto,
  normalizeBogotaPuestoKey,
  normalizeBogotaText,
  resolveBogotaLocalidad
} from "../shared/bogota-territory.js";

function normalizeKey(value) {
  return normalizeBogotaText(value);
}

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function getReportedVotes(registration) {
  const candidates = [
    registration?.votosReportados,
    registration?.reportedVotes,
    registration?.votesReported,
    registration?.votes,
    registration?.votos
  ];
  for (const value of candidates) {
    const parsed = toInt(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function resolvePuestoText(registration) {
  if (registration?.puestoResolvedName) return registration.puestoResolvedName;
  if (registration?.votingPlace) return registration.votingPlace;
  if (registration?.puestoId && typeof registration.puestoId === "object") {
    return registration.puestoId.nombre || registration.puestoId.name || "";
  }
  return "";
}

function hasMissingLocationData({ localidad, puesto, mesa }) {
  return !String(localidad || "").trim() || !String(puesto || "").trim() || mesa === null;
}

export function calculateE14Confirmation({ votosReportadosTotales, votosE14Candidate105, hasMissingLocation = false }) {
  if (hasMissingLocation) {
    return { porcentaje: null, diferencia: null, estado: "datos_incompletos" };
  }

  const reportados = toInt(votosReportadosTotales);
  const e14 = toInt(votosE14Candidate105);

  if (reportados === null || reportados <= 0) {
    return {
      porcentaje: null,
      diferencia: e14 === null ? null : e14,
      estado: "sin_votos_reportados"
    };
  }

  if (e14 === null || e14 < 0) {
    return { porcentaje: null, diferencia: null, estado: "pendiente_e14" };
  }

  const porcentaje = Math.min(Number((((e14 / reportados) * 100)).toFixed(2)), 100);
  const diferencia = e14 - reportados;

  let estado = "sin_confirmacion";
  if (porcentaje >= 100) estado = "confirmado";
  else if (porcentaje >= 60) estado = "confirmacion_alta";
  else if (porcentaje >= 30) estado = "confirmacion_parcial";
  else if (porcentaje >= 1) estado = "confirmacion_baja";

  return { porcentaje, diferencia, estado };
}

function normalizeFilters(raw = {}) {
  return {
    eventId: raw.eventId || null,
    leaderId: raw.leaderId || null,
    localidad: raw.localidad || "",
    puesto: raw.puesto || "",
    mesa: raw.mesa || "",
    estado: raw.estado || raw.estadoConfirmacion || raw.estadoValidacion || "",
    sourceStatus: raw.sourceStatus || raw.estadoOcr || "",
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
  if (filters.search) {
    const regex = new RegExp(filters.search, "i");
    query.$or = [
      { firstName: regex },
      { lastName: regex },
      { cedula: regex },
      { email: regex },
      { phone: regex },
      { leaderName: regex },
      { votingPlace: regex },
      { localidad: regex }
    ];
  }
  return query;
}

async function resolvePuestoMap(puestoIds = []) {
  const uniqueIds = [...new Set(puestoIds.filter(Boolean).map(String))];
  if (uniqueIds.length === 0) return new Map();
  const puestos = await Puestos.find({ _id: { $in: uniqueIds } }, { nombre: 1, localidad: 1, ciudad: 1, departamento: 1 }).lean();
  const map = new Map();
  puestos.forEach((puesto) => {
    map.set(String(puesto._id), {
      nombre: `${puesto.nombre || ""}`.trim(),
      localidad: `${puesto.localidad || ""}`.trim(),
      ciudad: `${puesto.ciudad || ""}`.trim(),
      departamento: `${puesto.departamento || ""}`.trim()
    });
  });
  return map;
}

function createTraceStats() {
  return {
    totalRegistros: 0,
    incluidos: 0,
    excluidos: 0,
    excludedByReason: {
      localidad_invalida: 0,
      municipio_no_bogota: 0,
      puesto_vacio: 0,
      mesa_invalida: 0
    },
    sampleInvalidLocalidades: []
  };
}

function pushInvalidLocalidadSample(traceStats, payload) {
  if (traceStats.sampleInvalidLocalidades.length >= 8) return;
  traceStats.sampleInvalidLocalidades.push(payload);
}

function resolveLocalidadFromRegistration(doc, puestoInfo) {
  const candidates = [
    doc?.localidad,
    puestoInfo?.localidad
  ];
  for (const raw of candidates) {
    const resolved = resolveBogotaLocalidad(raw);
    if (resolved) {
      return {
        rawLocalidad: raw || "",
        normalizedLocalidad: normalizeKey(raw),
        resolvedLocalidad: resolved.displayName,
        zoneCode: resolved.zoneCode
      };
    }
  }

  return {
    rawLocalidad: candidates.find((value) => String(value || "").trim()) || "",
    normalizedLocalidad: normalizeKey(candidates.find((value) => String(value || "").trim()) || ""),
    resolvedLocalidad: ""
  };
}

function inferBogotaMembership(doc, puestoInfo, resolvedLocalidad) {
  const municipalityCandidates = [
    doc?.capital,
    doc?.ciudad,
    doc?.municipio,
    doc?.municipality,
    puestoInfo?.ciudad
  ];

  const hasExplicitNonBogota = municipalityCandidates.some((value) => {
    const normalized = normalizeKey(value);
    return normalized && !isBogotaMunicipality(value);
  });

  if (hasExplicitNonBogota) return false;
  if (resolvedLocalidad) return true;

  return [doc?.departamento, puestoInfo?.departamento].some((value) => {
    const normalized = normalizeKey(value);
    return normalized === "BOGOTA" || normalized === "BOGOTA D C" || normalized === "BOGOTA D.C.";
  });
}

function logGroupTrace(payload) {
  logger.info("[E14 GROUP TRACE]", payload);
}

async function buildMesaRows(filters, organizationId) {
  const query = buildRegistrationQuery(filters, organizationId);
  const docs = await Registration.find(query, {
    eventId: 1,
    leaderId: 1,
    localidad: 1,
    capital: 1,
    departamento: 1,
    mesa: 1,
    votingTable: 1,
    votingPlace: 1,
    puestoId: 1,
    votosReportados: 1,
    reportedVotes: 1,
    votesReported: 1,
    votes: 1,
    votos: 1
  }).lean();

  const puestoMap = await resolvePuestoMap(docs.map((d) => d.puestoId));
  const groups = new Map();
  const traceStats = createTraceStats();

  traceStats.totalRegistros = docs.length;

  docs.forEach((doc) => {
    const puestoInfo = puestoMap.get(String(doc.puestoId || "")) || null;
    const localidadInfo = resolveLocalidadFromRegistration(doc, puestoInfo);
    const localidad = localidadInfo.resolvedLocalidad || "";
    const puesto = normalizeBogotaPuesto(puestoInfo?.nombre || resolvePuestoText(doc) || "");
    const mesa = toInt(doc.mesa ?? doc.votingTable);
    const zoneCode = localidadInfo.zoneCode || getBogotaZoneCode(localidad);
    const normalizedLocalidad = normalizeKey(localidad);
    const normalizedPuesto = normalizeBogotaPuestoKey(puesto);
    const includedInBogotaAggregation = Boolean(
      localidad
      && puesto
      && mesa !== null
      && inferBogotaMembership(doc, puestoInfo, localidad)
    );

    logGroupTrace({
      rawLocalidad: localidadInfo.rawLocalidad || "",
      normalizedLocalidad: localidadInfo.normalizedLocalidad || "",
      resolvedLocalidad: localidad || null,
      rawPuesto: puestoInfo?.nombre || resolvePuestoText(doc) || "",
      normalizedPuesto,
      rawMesa: doc.mesa ?? doc.votingTable ?? null,
      votosReportados: getReportedVotes(doc),
      includedInBogotaAggregation
    });

    if (!localidad) {
      traceStats.excluidos += 1;
      traceStats.excludedByReason.localidad_invalida += 1;
      pushInvalidLocalidadSample(traceStats, {
        rawLocalidad: localidadInfo.rawLocalidad || "",
        normalizedLocalidad: localidadInfo.normalizedLocalidad || "",
        puesto: puestoInfo?.nombre || resolvePuestoText(doc) || "",
        mesa: doc.mesa ?? doc.votingTable ?? null
      });
      return;
    }
    if (!inferBogotaMembership(doc, puestoInfo, localidad)) {
      traceStats.excluidos += 1;
      traceStats.excludedByReason.municipio_no_bogota += 1;
      return;
    }
    if (!puesto) {
      traceStats.excluidos += 1;
      traceStats.excludedByReason.puesto_vacio += 1;
      return;
    }
    if (mesa === null || mesa <= 0) {
      traceStats.excluidos += 1;
      traceStats.excludedByReason.mesa_invalida += 1;
      return;
    }

    traceStats.incluidos += 1;
    const key = `${normalizedLocalidad}||${normalizedPuesto}||${mesa ?? "NULL"}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        localidad,
        puesto,
        mesa,
        zoneCode,
        normalizedLocalidad,
        normalizedPuesto,
        votosReportadosTotales: 0,
        groupCount: 0,
        leaders: new Set()
      });
    }
    const bucket = groups.get(key);
    const reported = getReportedVotes(doc);
    bucket.groupCount += 1;
    if (Number.isFinite(reported)) bucket.votosReportadosTotales += reported;
    if (doc.leaderId) bucket.leaders.add(String(doc.leaderId));
  });

  const confirmationQuery = { organizationId };
  if (filters.eventId) confirmationQuery.eventId = String(filters.eventId);
  const confirmations = await E14ConfirmationByMesa.find(confirmationQuery).lean();
  const confirmationMap = new Map();
  confirmations.forEach((row) => {
    const key = `${row.normalizedLocalidad}||${row.normalizedPuesto}||${row.mesa}`;
    confirmationMap.set(key, row);
  });

  const rows = [...groups.values()].map((group) => {
    const saved = confirmationMap.get(group.key);
    const votosE14Candidate105 = saved?.votosE14Candidate105 ?? null;
    const votosE14SuggestedCandidate105 = saved?.votosE14SuggestedCandidate105 ?? null;
    const hasMissing = hasMissingLocationData(group);
    const calc = calculateE14Confirmation({
      votosReportadosTotales: group.votosReportadosTotales,
      votosE14Candidate105,
      hasMissingLocation: hasMissing
    });
    const hint = buildE14NavigationHint({
      localidad: group.localidad,
      puesto: group.puesto,
      mesa: group.mesa,
      e14ZoneCode: group.zoneCode
    });
    return {
      mesaKey: group.key,
      eventId: filters.eventId || null,
      localidad: group.localidad,
      puesto: group.puesto,
      mesa: group.mesa,
      zoneCode: group.zoneCode || null,
      zoneLabel: hint.zoneLabel || null,
      votosReportadosTotales: group.votosReportadosTotales,
      votosE14Candidate105,
      e14ListVotes: saved?.e14ListVotes ?? null,
      confirmacionPorcentaje: calc.porcentaje,
      diferencia: calc.diferencia,
      estado: calc.estado,
      notes: saved?.notes || "",
      validatedAt: saved?.validatedAt || null,
      validatedBy: saved?.validatedBy || null,
      source: saved?.source || null,
      groupCount: group.groupCount,
      leadersCount: group.leaders.size,
      e14Reference: hint,
      votosE14SuggestedCandidate105,
      reviewRequired: Boolean(saved?.reviewRequired),
      reviewReason: saved?.reviewReason || "",
      taskId: saved?.taskId || "",
      reviewPriorityRank: saved?.reviewPriorityRank ?? null,
      sourceEstadoRevision: saved?.sourceEstadoRevision || "",
      sourceConfidence: saved?.sourceConfidence ?? null,
      sourceScoreDigito: saved?.sourceScoreDigito ?? null,
      sourceScoreSegundo: saved?.sourceScoreSegundo ?? null,
      sourceMetodoDigito: saved?.sourceMetodoDigito || "",
      sourceDebugDir: saved?.sourceDebugDir || "",
      sourceDocumento: saved?.sourceDocumento || "",
      sourceArchivo: saved?.sourceArchivo || "",
      sourceLocalFileUri: saved?.sourceLocalFileUri || "",
      sourceCaptureAvailable: Boolean(saved?.sourceCaptureAvailable),
      sourceOverlayPath: saved?.sourceOverlayPath || "",
      sourceCellPath: saved?.sourceCellPath || "",
      sourceMaskPath: saved?.sourceMaskPath || "",
      sourcePartyBlockPath: saved?.sourcePartyBlockPath || "",
    };
  });

  const confirmationOnlyRows = confirmations
    .filter((saved) => !groups.has(`${saved.normalizedLocalidad}||${saved.normalizedPuesto}||${saved.mesa}`))
    .map((saved) => {
      const votosE14Candidate105 = saved?.votosE14Candidate105 ?? null;
      const calc = calculateE14Confirmation({
        votosReportadosTotales: saved?.votosReportadosTotales ?? 0,
        votosE14Candidate105,
        hasMissingLocation: hasMissingLocationData({
          localidad: saved?.localidad,
          puesto: saved?.puesto,
          mesa: saved?.mesa,
        }),
      });
      const hint = buildE14NavigationHint({
        localidad: saved?.localidad,
        puesto: saved?.puesto,
        mesa: saved?.mesa,
        e14ZoneCode: saved?.zoneCode,
      });
      return {
        mesaKey: `${saved.normalizedLocalidad}||${saved.normalizedPuesto}||${saved.mesa}`,
        eventId: saved?.eventId || filters.eventId || null,
        localidad: saved?.localidad || "",
        puesto: saved?.puesto || "",
        mesa: saved?.mesa ?? null,
        zoneCode: saved?.zoneCode || null,
        zoneLabel: hint.zoneLabel || null,
        votosReportadosTotales: saved?.votosReportadosTotales ?? 0,
        votosE14Candidate105,
        e14ListVotes: saved?.e14ListVotes ?? null,
        confirmacionPorcentaje: calc.porcentaje,
        diferencia: calc.diferencia,
        estado: calc.estado,
        notes: saved?.notes || "",
        validatedAt: saved?.validatedAt || null,
        validatedBy: saved?.validatedBy || null,
        source: saved?.source || null,
        groupCount: 0,
        leadersCount: 0,
        e14Reference: hint,
        votosE14SuggestedCandidate105: saved?.votosE14SuggestedCandidate105 ?? null,
        reviewRequired: Boolean(saved?.reviewRequired),
        reviewReason: saved?.reviewReason || "",
        taskId: saved?.taskId || "",
        reviewPriorityRank: saved?.reviewPriorityRank ?? null,
        sourceEstadoRevision: saved?.sourceEstadoRevision || "",
        sourceConfidence: saved?.sourceConfidence ?? null,
        sourceScoreDigito: saved?.sourceScoreDigito ?? null,
        sourceScoreSegundo: saved?.sourceScoreSegundo ?? null,
        sourceMetodoDigito: saved?.sourceMetodoDigito || "",
        sourceDebugDir: saved?.sourceDebugDir || "",
        sourceDocumento: saved?.sourceDocumento || "",
        sourceArchivo: saved?.sourceArchivo || "",
        sourceLocalFileUri: saved?.sourceLocalFileUri || "",
        sourceCaptureAvailable: Boolean(saved?.sourceCaptureAvailable),
        sourceOverlayPath: saved?.sourceOverlayPath || "",
        sourceCellPath: saved?.sourceCellPath || "",
        sourceMaskPath: saved?.sourceMaskPath || "",
        sourcePartyBlockPath: saved?.sourcePartyBlockPath || "",
      };
    });

  rows.push(...confirmationOnlyRows);

  logger.info("[E14 GROUP SUMMARY]", {
    totalRegistros: traceStats.totalRegistros,
    incluidos: traceStats.incluidos,
    excluidos: traceStats.excluidos,
    excludedByReason: traceStats.excludedByReason,
    sampleInvalidLocalidades: traceStats.sampleInvalidLocalidades
  });

  return { rows, traceStats };
}

function computeKpis(rows) {
  const mesasAnalizadas = rows.length;
  const mesasPendientesE14 = rows.filter((r) => r.estado === "pendiente_e14").length;
  const mesasConfirmadas = rows.filter((r) => r.estado === "confirmado").length;
  const conPorcentaje = rows.filter((r) => typeof r.confirmacionPorcentaje === "number");
  const sum = conPorcentaje.reduce((acc, row) => acc + row.confirmacionPorcentaje, 0);
  const confirmacionPromedio = conPorcentaje.length > 0 ? Number((sum / conPorcentaje.length).toFixed(2)) : 0;
  const votosReportadosTotales = rows.reduce((acc, row) => acc + (Number.isFinite(row.votosReportadosTotales) ? row.votosReportadosTotales : 0), 0);
  const votosE14Totales = rows.reduce((acc, row) => acc + (Number.isFinite(row.votosE14Candidate105) ? row.votosE14Candidate105 : 0), 0);
  return {
    mesasAnalizadas,
    mesasPendientesE14,
    mesasConfirmadas,
    confirmacionPromedio,
    votosReportadosTotales,
    votosE14Totales
  };
}

export async function getE14ConfirmationByMesaData(rawFilters = {}, options = {}) {
  const filters = normalizeFilters(rawFilters);
  const organizationId = options.organizationId || null;
  const { rows: baseRows, traceStats } = await buildMesaRows(filters, organizationId);
  const selectedLocalidad = normalizeBogotaLocalidad(filters.localidad);
  const rowsForPuestoOptions = selectedLocalidad
    ? baseRows.filter((row) => row.localidad === selectedLocalidad)
    : baseRows;
  const localidadOptions = getBogotaLocalidades()
    .filter((item) => baseRows.some((row) => row.localidad === item.displayName))
    .map((item) => ({
      value: item.displayName,
      label: item.displayName,
      zoneCode: item.zoneCode
    }));
  const puestoOptions = [...new Set(rowsForPuestoOptions.map((row) => row.puesto).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((puesto) => ({ value: puesto, label: puesto }));
  let rows = [...baseRows];

  if (selectedLocalidad) {
    rows = rows.filter((r) => r.localidad === selectedLocalidad);
  }
  if (filters.puesto) {
    const needle = normalizeBogotaPuestoKey(filters.puesto);
    rows = rows.filter((r) => normalizeBogotaPuestoKey(r.puesto) === needle);
  }
  if (filters.mesa) {
    const mesaNeedle = toInt(filters.mesa);
    rows = rows.filter((r) => r.mesa === mesaNeedle);
  }
  if (filters.estado) {
    if (filters.estado === "manual_only") {
      rows = rows.filter((r) => r.source === "manual");
    } else {
      rows = rows.filter((r) => r.estado === filters.estado);
    }
  }
  if (filters.sourceStatus) {
    rows = rows.filter((r) => String(r.sourceEstadoRevision || "") === String(filters.sourceStatus));
  }
  if (filters.search) {
    const needle = normalizeKey(filters.search);
    rows = rows.filter((row) => (
      normalizeKey(row.localidad).includes(needle)
      || normalizeBogotaPuestoKey(row.puesto).includes(needle)
      || normalizeKey(row.mesa).includes(needle)
      || normalizeKey(row.sourceArchivo).includes(needle)
      || normalizeKey(row.sourceEstadoRevision).includes(needle)
    ));
  }

  rows.sort((a, b) => {
    const byLoc = String(a.localidad || "").localeCompare(String(b.localidad || ""));
    if (byLoc !== 0) return byLoc;
    const byPuesto = String(a.puesto || "").localeCompare(String(b.puesto || ""));
    if (byPuesto !== 0) return byPuesto;
    return (a.mesa || 0) - (b.mesa || 0);
  });

  const kpis = computeKpis(rows);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / filters.limit));
  const start = (filters.page - 1) * filters.limit;
  const end = start + filters.limit;
  const items = rows.slice(start, end);

  return {
    kpis,
    items,
    pagination: {
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages
    },
    context: {
      aggregation: "by_mesa",
      corporation: "CAMARA",
      municipality: "BOGOTA",
      candidateCode: 105,
      party: "CENTRO DEMOCRATICO"
    },
    filters: {
      localidadesDisponibles: localidadOptions,
      puestosDisponibles: puestoOptions
    },
    debug: {
      totalInputRecords: traceStats.totalRegistros,
      includedRecords: traceStats.incluidos,
      excludedRecords: traceStats.excluidos,
      excludedByReason: traceStats.excludedByReason,
      sampleInvalidLocalidades: traceStats.sampleInvalidLocalidades
    }
  };
}

async function findSingleMesaGroup(payload, organizationId) {
  const filters = {
    eventId: payload.eventId || null,
    localidad: payload.localidad || "",
    puesto: payload.puesto || "",
    mesa: payload.mesa
  };
  const { rows } = await buildMesaRows(filters, organizationId);
  const targetMesa = toInt(payload.mesa);
  const normalizedLocalidad = normalizeKey(normalizeBogotaLocalidad(payload.localidad));
  const normalizedPuesto = normalizeBogotaPuestoKey(payload.puesto);
  return rows.find((row) =>
    normalizeKey(row.localidad) === normalizedLocalidad
    && normalizeBogotaPuestoKey(row.puesto) === normalizedPuesto
    && row.mesa === targetMesa
  ) || null;
}

export async function saveManualByMesa(payload = {}, options = {}) {
  const organizationId = options.organizationId || null;
  if (!organizationId) {
    throw new Error("organizationId requerido");
  }
  const localidad = String(payload.localidad || "").trim();
  const resolvedLocalidad = normalizeBogotaLocalidad(localidad);
  const puesto = normalizeBogotaPuesto(payload.puesto || "");
  const mesa = toInt(payload.mesa);
  if (!resolvedLocalidad || !puesto || mesa === null || mesa <= 0) {
    throw new Error("localidad, puesto y mesa son requeridos");
  }

  const group = await findSingleMesaGroup(payload, organizationId);
  const votosReportadosTotales = group?.votosReportadosTotales ?? 0;
  const zoneCode = payload.zoneCode || getBogotaZoneCode(resolvedLocalidad) || null;
  const votosE14Candidate105 = toInt(payload.votosE14Candidate105);
  if (votosE14Candidate105 === null || votosE14Candidate105 < 0) {
    throw new Error("votosE14Candidate105 debe ser un numero mayor o igual a 0");
  }
  const calc = calculateE14Confirmation({
    votosReportadosTotales,
    votosE14Candidate105,
    hasMissingLocation: hasMissingLocationData({ localidad: resolvedLocalidad, puesto, mesa })
  });

  const normalizedLocalidad = normalizeKey(resolvedLocalidad);
  const normalizedPuesto = normalizeBogotaPuestoKey(puesto);
  const validatedBy = payload.validatedBy || options.validatedBy || "admin";

  await E14ConfirmationByMesa.updateOne(
    {
      organizationId,
      eventId: payload.eventId || null,
      normalizedLocalidad,
      normalizedPuesto,
      mesa
    },
    {
      $set: {
        organizationId,
        eventId: payload.eventId || null,
        localidad: resolvedLocalidad,
        puesto,
        mesa,
        zoneCode,
        normalizedLocalidad,
        normalizedPuesto,
        votosReportadosTotales,
        votosE14Candidate105,
        votosE14SuggestedCandidate105: votosE14Candidate105,
        e14ListVotes: toInt(payload.e14ListVotes),
        confirmacionPorcentaje: calc.porcentaje,
        diferencia: calc.diferencia,
        estado: calc.estado,
        notes: payload.notes || "",
        reviewRequired: false,
        reviewReason: "",
        taskId: payload.taskId || "",
        reviewPriorityRank: payload.reviewPriorityRank ?? null,
        sourceEstadoRevision: payload.sourceEstadoRevision || "manual",
        sourceConfidence: payload.sourceConfidence ?? null,
        sourceScoreDigito: payload.sourceScoreDigito ?? null,
        sourceScoreSegundo: payload.sourceScoreSegundo ?? null,
        sourceMetodoDigito: payload.sourceMetodoDigito || "manual",
        sourceDebugDir: payload.sourceDebugDir || "",
        sourceDocumento: payload.sourceDocumento || "",
        sourceArchivo: payload.sourceArchivo || "",
        sourceLocalFileUri: payload.sourceLocalFileUri || "",
        sourceCaptureAvailable: Boolean(payload.sourceCaptureAvailable),
        sourceOverlayPath: payload.sourceOverlayPath || "",
        sourceCellPath: payload.sourceCellPath || "",
        sourceMaskPath: payload.sourceMaskPath || "",
        sourcePartyBlockPath: payload.sourcePartyBlockPath || "",
        validatedAt: new Date(),
        validatedBy,
        source: "manual"
      }
    },
    { upsert: true }
  );

  return {
    localidad: resolvedLocalidad,
    puesto,
    mesa,
    zoneCode,
    votosReportadosTotales,
    votosE14Candidate105,
    votosE14SuggestedCandidate105: votosE14Candidate105,
    confirmacionPorcentaje: calc.porcentaje,
    diferencia: calc.diferencia,
    estado: calc.estado
  };
}

export async function saveManualE14Confirmation(payload = {}, options = {}) {
  const registrationId = String(payload.registrationId || "").trim();
  if (!registrationId) {
    throw new Error("registrationId es requerido");
  }
  const query = { _id: registrationId };
  if (options.organizationId) query.organizationId = options.organizationId;
  const reg = await Registration.findOne(query).lean();
  if (!reg) throw new Error("Registro no encontrado");
  return saveManualByMesa(
    {
      eventId: reg.eventId || null,
      localidad: reg.localidad || "",
      puesto: resolvePuestoText(reg),
      mesa: toInt(reg.mesa ?? reg.votingTable),
      zoneCode: payload.e14ZoneCode || reg.e14ZoneCode || getBogotaZoneCode(reg.localidad),
      votosE14Candidate105: payload.e14VotesCandidate105,
      e14ListVotes: payload.e14ListVotes,
      notes: payload.notes,
      validatedBy: payload.validatedBy
    },
    options
  );
}

export async function recalculateE14Confirmation(rawFilters = {}, options = {}) {
  const filters = normalizeFilters(rawFilters);
  const organizationId = options.organizationId || null;
  const rows = await getE14ConfirmationByMesaData(filters, { organizationId });
  const counters = {
    processed: rows.items.length,
    confirmed: rows.items.filter((r) => r.estado === "confirmado").length,
    pending: rows.items.filter((r) => r.estado === "pendiente_e14").length,
    incomplete: rows.items.filter((r) => r.estado === "datos_incompletos").length,
    low: rows.items.filter((r) => r.estado === "confirmacion_baja" || r.estado === "sin_confirmacion").length,
    noReported: rows.items.filter((r) => r.estado === "sin_votos_reportados").length,
    updated: 0
  };
  return counters;
}

export async function getE14ConfirmationData(rawFilters = {}, options = {}) {
  return getE14ConfirmationByMesaData(rawFilters, options);
}

export default {
  calculateE14Confirmation,
  getE14ConfirmationData,
  getE14ConfirmationByMesaData,
  saveManualByMesa,
  saveManualE14Confirmation,
  recalculateE14Confirmation
};
