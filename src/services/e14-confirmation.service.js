import { Registration } from "../models/index.js";
import votingHierarchyService from "./votingHierarchy.service.js";
import {
  canonicalizeBogotaLocality,
  getBogotaLocalidadesCanonical
} from "../shared/territoryNormalization.js";

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRegionScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "bogota") return "bogota";
  if (normalized === "resto" || normalized === "nacional") return "resto";
  return "";
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildOfficialMatch(rawFilters = {}, organizationId = null) {
  const query = {
    officialValidationStatus: "official_valid"
  };

  if (organizationId) query.organizationId = organizationId;
  if (rawFilters.eventId) query.eventId = String(rawFilters.eventId);
  if (rawFilters.leaderId) query.leaderId = String(rawFilters.leaderId);

  const regionScope = parseRegionScope(rawFilters.regionScope || rawFilters.regionScopeFilter);
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

  const localidad = canonicalizeBogotaLocality(rawFilters.localidad) || rawFilters.localidad;
  if (localidad) {
    query.localidad = String(localidad);
    delete query.$or;
  }

  const search = String(rawFilters.search || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { leaderName: regex },
        { localidad: regex },
        { officialLocalidadNombre: regex },
        { votingPlace: regex },
        { officialPuestoNombre: regex },
        { legacyVotingPlace: regex },
        { votingTable: regex },
        { cedula: regex },
        { firstName: regex },
        { lastName: regex }
      ]
    });
  }

  return query;
}

function buildComparisonBasePipeline(rawFilters = {}, organizationId = null) {
  const eventId = rawFilters.eventId ? String(rawFilters.eventId) : null;

  return [
    { $match: buildOfficialMatch(rawFilters, organizationId) },
    {
      $project: {
        organizationId: 1,
        eventId: 1,
        leaderName: 1,
        localidadId: 1,
        puestoId: 1,
        localidadLabel: { $ifNull: ["$officialLocalidadNombre", "$localidad"] },
        puestoLabel: { $ifNull: ["$officialPuestoNombre", "$votingPlace"] },
        puestoCodigo: { $ifNull: ["$officialPuestoCodigo", ""] },
        mesaNumero: {
          $ifNull: [
            "$officialMesaNumero",
            "$mesa",
            {
              $convert: {
                input: "$votingTable",
                to: "int",
                onError: null,
                onNull: null
              }
            }
          ]
        }
      }
    },
    {
      $match: {
        localidadLabel: { $ne: null, $ne: "" },
        puestoLabel: { $ne: null, $ne: "" },
        mesaNumero: { $ne: null }
      }
    },
    {
      $group: {
        _id: {
          organizationId: "$organizationId",
          eventId: "$eventId",
          localidadId: "$localidadId",
          puestoId: "$puestoId",
          localidad: "$localidadLabel",
          puesto: "$puestoLabel",
          puestoCodigo: "$puestoCodigo",
          mesa: "$mesaNumero"
        },
        repVotes: { $sum: 1 },
        totalRegistros: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "e14_confirmation_by_mesa",
        let: {
          organizationId: "$_id.organizationId",
          eventId: "$_id.eventId",
          localidadId: "$_id.localidadId",
          puestoId: "$_id.puestoId",
          mesa: "$_id.mesa"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$organizationId", "$$organizationId"] },
                  eventId
                    ? { $eq: ["$eventId", "$$eventId"] }
                    : { $eq: [1, 1] },
                  { $eq: ["$localidadId", "$$localidadId"] },
                  { $eq: ["$puestoId", "$$puestoId"] },
                  { $eq: ["$mesa", "$$mesa"] }
                ]
              }
            }
          },
          {
            $project: {
              _id: 0,
              votosE14Candidate105: 1,
              votosE14SuggestedCandidate105: 1,
              sourceEstadoRevision: 1,
              sourceConfidence: 1,
              sourceDocumento: 1,
              sourceArchivo: 1,
              reviewRequired: 1,
              reviewReason: 1,
              notes: 1,
              source: 1
            }
          },
          { $limit: 1 }
        ],
        as: "confirmation"
      }
    },
    {
      $addFields: {
        confirmation: { $first: "$confirmation" }
      }
    },
    {
      $addFields: {
        id: {
          $concat: [
            { $ifNull: [{ $toString: "$_id.localidadId" }, "sin-localidad"] },
            "::",
            { $ifNull: [{ $toString: "$_id.puestoId" }, "sin-puesto"] },
            "::",
            { $toString: "$_id.mesa" }
          ]
        },
        localidad: "$_id.localidad",
        puesto: "$_id.puesto",
        puestoCodigo: "$_id.puestoCodigo",
        mesa: "$_id.mesa",
        e14Votes: {
          $ifNull: [
            "$confirmation.votosE14Candidate105",
            "$confirmation.votosE14SuggestedCandidate105"
          ]
        },
        sourceStatus: { $ifNull: ["$confirmation.sourceEstadoRevision", ""] },
        sourceConfidence: { $ifNull: ["$confirmation.sourceConfidence", null] },
        sourceDocumento: { $ifNull: ["$confirmation.sourceDocumento", ""] },
        sourceArchivo: { $ifNull: ["$confirmation.sourceArchivo", ""] },
        reviewRequired: { $ifNull: ["$confirmation.reviewRequired", false] },
        reviewReason: { $ifNull: ["$confirmation.reviewReason", ""] },
        notes: { $ifNull: ["$confirmation.notes", ""] },
        source: { $ifNull: ["$confirmation.source", null] }
      }
    },
    {
      $addFields: {
        porcentajeConfirmacion: {
          $cond: [
            {
              $and: [
                { $gt: ["$repVotes", 0] },
                { $ne: ["$e14Votes", null] }
              ]
            },
            {
              $min: [
                100,
                {
                  $round: [
                    {
                      $multiply: [
                        { $divide: ["$e14Votes", "$repVotes"] },
                        100
                      ]
                    },
                    2
                  ]
                }
              ]
            },
            null
          ]
        },
        diferencia: {
          $cond: [
            { $ne: ["$e14Votes", null] },
            { $subtract: ["$e14Votes", "$repVotes"] },
            null
          ]
        }
      }
    },
    {
      $addFields: {
        status: {
          $switch: {
            branches: [
              { case: { $lte: ["$repVotes", 0] }, then: "sin_votos_reportados" },
              { case: { $eq: ["$e14Votes", null] }, then: "pendiente_e14" },
              { case: { $gte: ["$porcentajeConfirmacion", 100] }, then: "confirmado" },
              { case: { $gte: ["$porcentajeConfirmacion", 60] }, then: "confirmacion_alta" },
              { case: { $gte: ["$porcentajeConfirmacion", 30] }, then: "confirmacion_parcial" },
              { case: { $gte: ["$porcentajeConfirmacion", 1] }, then: "confirmacion_baja" }
            ],
            default: "sin_confirmacion"
          }
        }
      }
    }
  ];
}

function buildRowFilters(rawFilters = {}) {
  const pipeline = [];
  const estado = String(rawFilters.estado || "").trim();
  const ocr = String(rawFilters.ocr || rawFilters.sourceStatus || "").trim();
  const queue = String(rawFilters.queue || rawFilters.workQueue || "").trim().toLowerCase();

  if (queue === "pending") {
    pipeline.push({
      $match: {
        $or: [
          { status: { $in: ["pendiente_e14", "sin_confirmacion", "confirmacion_baja", "confirmacion_parcial", "confirmacion_alta"] } },
          { reviewRequired: true }
        ]
      }
    });
  } else if (queue === "differences") {
    pipeline.push({
      $match: {
        e14Votes: { $ne: null },
        diferencia: { $ne: 0 }
      }
    });
  } else if (queue === "confirmed") {
    pipeline.push({ $match: { status: "confirmado" } });
  } else if (queue === "sin_e14") {
    pipeline.push({ $match: { status: "pendiente_e14" } });
  }

  if (estado) {
    if (estado === "manual_only") {
      pipeline.push({ $match: { source: "manual" } });
    } else {
      pipeline.push({ $match: { status: estado } });
    }
  }

  if (ocr) {
    pipeline.push({ $match: { sourceStatus: ocr } });
  }

  return pipeline;
}

async function getFilterOptions(rawFilters = {}, organizationId = null) {
  const base = buildOfficialMatch(
    {
      ...rawFilters,
      search: "",
      estado: "",
      sourceStatus: "",
      ocr: ""
    },
    organizationId
  );

  const localidadValues = (await Registration.distinct("localidad", base))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b), "es"));

  const puestoPipeline = [
    { $match: base },
    {
      $project: {
        puestoLabel: { $ifNull: ["$officialPuestoNombre", "$votingPlace"] }
      }
    }
  ];
  if (rawFilters.localidad) {
    puestoPipeline.unshift({
      $match: { localidad: canonicalizeBogotaLocality(rawFilters.localidad) || String(rawFilters.localidad) }
    });
  }
  puestoPipeline.push(
    { $match: { puestoLabel: { $ne: null, $ne: "" } } },
    { $group: { _id: "$puestoLabel" } },
    { $sort: { _id: 1 } }
  );

  const puestos = await Registration.aggregate(puestoPipeline);

  return {
    regionScope: parseRegionScope(rawFilters.regionScope || rawFilters.regionScopeFilter),
    localidadesDisponibles: localidadValues.map((value) => ({ value, label: value })),
    puestosDisponibles: puestos.map((row) => ({ value: row._id, label: row._id }))
  };
}

export function calculateE14Confirmation({ votosReportadosTotales, votosE14Candidate105, hasMissingLocation = false }) {
  if (hasMissingLocation) {
    return { porcentaje: null, diferencia: null, estado: "datos_incompletos" };
  }

  const reportados = Number.isFinite(votosReportadosTotales) ? votosReportadosTotales : 0;
  const e14 = Number.isFinite(votosE14Candidate105) ? votosE14Candidate105 : null;

  if (reportados <= 0) {
    return {
      porcentaje: null,
      diferencia: e14 === null ? null : e14,
      estado: "sin_votos_reportados"
    };
  }

  if (e14 === null || e14 < 0) {
    return { porcentaje: null, diferencia: null, estado: "pendiente_e14" };
  }

  const porcentaje = Math.min(Number(((e14 / reportados) * 100).toFixed(2)), 100);
  const diferencia = e14 - reportados;

  let estado = "sin_confirmacion";
  if (porcentaje >= 100) estado = "confirmado";
  else if (porcentaje >= 60) estado = "confirmacion_alta";
  else if (porcentaje >= 30) estado = "confirmacion_parcial";
  else if (porcentaje >= 1) estado = "confirmacion_baja";

  return { porcentaje, diferencia, estado };
}

export async function getE14ConfirmationSummaryData(rawFilters = {}, options = {}) {
  const organizationId = options.organizationId || null;
  const summaryPipeline = [
    ...buildComparisonBasePipeline(rawFilters, organizationId),
    ...buildRowFilters(rawFilters),
    {
      $group: {
        _id: null,
        mesas: { $sum: 1 },
        mesasConciliadas: {
          $sum: { $cond: [{ $ne: ["$e14Votes", null] }, 1, 0] }
        },
        pendientes: {
          $sum: { $cond: [{ $eq: ["$status", "pendiente_e14"] }, 1, 0] }
        },
        confirmadas: {
          $sum: { $cond: [{ $eq: ["$status", "confirmado"] }, 1, 0] }
        },
        mesasConDiferencia: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$e14Votes", null] },
                  { $ne: ["$diferencia", 0] }
                ]
              },
              1,
              0
            ]
          }
        },
        votosReportados: { $sum: "$repVotes" },
        votosE14: { $sum: { $ifNull: ["$e14Votes", 0] } },
        totalRegistros: { $sum: "$totalRegistros" },
        totalPorcentaje: {
          $sum: { $cond: [{ $ne: ["$porcentajeConfirmacion", null] }, "$porcentajeConfirmacion", 0] }
        },
        totalConPorcentaje: {
          $sum: { $cond: [{ $ne: ["$porcentajeConfirmacion", null] }, 1, 0] }
        }
      }
    }
  ];

  const [summaryRow, excludedTotal] = await Promise.all([
    Registration.aggregate(summaryPipeline),
    Registration.countDocuments({
      ...buildOfficialMatch(rawFilters, organizationId),
      officialValidationStatus: { $ne: "official_valid" }
    })
  ]);

  const row = summaryRow[0] || {};
  return {
    mesas: row.mesas || 0,
    totalRegistros: row.totalRegistros || row.votosReportados || 0,
    expectedVotes: row.votosReportados || 0,
    realVotes: row.votosE14 || 0,
    missingVotes: Math.max((row.votosReportados || 0) - (row.votosE14 || 0), 0),
    pendientes: row.pendientes || 0,
    confirmadas: row.confirmadas || 0,
    verificadas: (row.mesas || 0) - (row.pendientes || 0),
    mesasConciliadas: row.mesasConciliadas || 0,
    mesasConDiferencia: row.mesasConDiferencia || 0,
    porcentajeConfirmacion: row.totalConPorcentaje
      ? Number((row.totalPorcentaje / row.totalConPorcentaje).toFixed(2))
      : 0,
    porcentajeAvanceVotos: (row.votosReportados || 0)
      ? Number((Math.min((row.votosE14 || 0), row.votosReportados || 0) / (row.votosReportados || 1) * 100).toFixed(2))
      : 0,
    porcentajeAvanceRevision: row.mesas
      ? Number((((row.mesasConciliadas || 0) / row.mesas) * 100).toFixed(2))
      : 0,
    votosReportados: row.votosReportados || 0,
    votosE14: row.votosE14 || 0,
    diferenciaAcumulada: (row.votosE14 || 0) - (row.votosReportados || 0),
    promedioRegistrosPorMesa: row.mesas
      ? Number(((row.totalRegistros || row.votosReportados || 0) / row.mesas).toFixed(2))
      : 0,
    excludedTotal
  };
}

export async function getE14ConfirmationByMesaData(rawFilters = {}, options = {}) {
  const organizationId = options.organizationId || null;
  const page = Math.max(toInt(rawFilters.page) || 1, 1);
  const limit = Math.min(Math.max(toInt(rawFilters.limit) || 25, 1), 200);
  const skip = (page - 1) * limit;

  const pipeline = [
    ...buildComparisonBasePipeline(rawFilters, organizationId),
    ...buildRowFilters(rawFilters),
    {
      $facet: {
        rows: [
          { $sort: { localidad: 1, puesto: 1, mesa: 1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $project: {
              _id: 0,
              id: 1,
              localidad: 1,
              puesto: 1,
              mesa: 1,
              repVotes: "$repVotes",
              votosReportadosTotales: "$repVotes",
              e14Votes: "$e14Votes",
              votosE14Candidate105: "$e14Votes",
              status: 1,
              estado: "$status",
              porcentajeConfirmacion: 1,
              confirmacionPorcentaje: "$porcentajeConfirmacion",
              diferencia: 1,
              ocrEvidence: "$sourceArchivo",
              sourceEstadoRevision: "$sourceStatus",
              sourceConfidence: 1,
              sourceDocumento: 1,
              sourceArchivo: 1,
              reviewRequired: 1,
              reviewReason: 1,
              notes: 1,
              source: 1,
              puestoCodigo: 1
            }
          }
        ],
        total: [{ $count: "count" }]
      }
    }
  ];

  const [result, filters] = await Promise.all([
    Registration.aggregate(pipeline),
    getFilterOptions(rawFilters, organizationId)
  ]);

  const payload = result[0] || {};
  const total = payload.total?.[0]?.count || 0;

  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    items: Array.isArray(payload.rows) ? payload.rows : [],
    page,
    limit,
    total,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    },
    filters
  };
}

export async function getE14ProgressTreeData(rawFilters = {}, options = {}) {
  const organizationId = options.organizationId || null;
  const rows = await Registration.aggregate([
    ...buildComparisonBasePipeline(rawFilters, organizationId),
    ...buildRowFilters(rawFilters),
    {
      $project: {
        _id: 0,
        id: 1,
        localidad: 1,
        puesto: 1,
        puestoCodigo: 1,
        mesa: 1,
        expectedVotes: "$repVotes",
        realVotes: { $ifNull: ["$e14Votes", 0] },
        hasE14: { $ne: ["$e14Votes", null] },
        difference: {
          $cond: [
            { $ne: ["$e14Votes", null] },
            "$diferencia",
            { $multiply: ["$repVotes", -1] }
          ]
        },
        status: 1
      }
    },
    { $sort: { localidad: 1, puesto: 1, mesa: 1 } }
  ]);

  const localidadesMap = new Map();
  const summary = {
    expectedVotes: 0,
    realVotes: 0,
    difference: 0,
    localidades: 0,
    puestos: 0,
    mesas: rows.length
  };

  rows.forEach((row) => {
    const localidadName = String(row.localidad || "Sin localidad");
    const puestoName = String(row.puesto || "Sin puesto");
    const expectedVotes = Number(row.expectedVotes || 0);
    const realVotes = Number(row.realVotes || 0);
    const difference = Number(row.difference || 0);

    summary.expectedVotes += expectedVotes;
    summary.realVotes += realVotes;
    summary.difference += difference;

    let localidadNode = localidadesMap.get(localidadName);
    if (!localidadNode) {
      localidadNode = {
        id: localidadName,
        name: localidadName,
        expectedVotes: 0,
        realVotes: 0,
        difference: 0,
        puestos: []
      };
      localidadNode._puestosMap = new Map();
      localidadesMap.set(localidadName, localidadNode);
    }

    localidadNode.expectedVotes += expectedVotes;
    localidadNode.realVotes += realVotes;
    localidadNode.difference += difference;

    let puestoNode = localidadNode._puestosMap.get(puestoName);
    if (!puestoNode) {
      puestoNode = {
        id: `${localidadName}::${puestoName}`,
        name: puestoName,
        puestoCodigo: row.puestoCodigo || "",
        expectedVotes: 0,
        realVotes: 0,
        difference: 0,
        mesas: []
      };
      localidadNode._puestosMap.set(puestoName, puestoNode);
      localidadNode.puestos.push(puestoNode);
    }

    puestoNode.expectedVotes += expectedVotes;
    puestoNode.realVotes += realVotes;
    puestoNode.difference += difference;
    puestoNode.mesas.push({
      id: row.id || `${puestoNode.id}::${row.mesa}`,
      numero: row.mesa,
      expectedVotes,
      realVotes,
      difference,
      status: row.status,
      hasE14: Boolean(row.hasE14)
    });
  });

  const localidades = Array.from(localidadesMap.values())
    .map((localidad) => {
      delete localidad._puestosMap;
      localidad.puestos.sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
      localidad.puestos.forEach((puesto) => {
        puesto.mesas.sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0));
      });
      return localidad;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));

  summary.localidades = localidades.length;
  summary.puestos = localidades.reduce((acc, localidad) => acc + localidad.puestos.length, 0);

  return { summary, localidades };
}

export async function getE14InvalidRowsData(rawFilters = {}, options = {}) {
  return votingHierarchyService.getInvalidDataPage(rawFilters, options);
}

export async function getE14ConfirmationData(rawFilters = {}, options = {}) {
  return getE14ConfirmationByMesaData(rawFilters, options);
}

export async function saveManualByMesa(payload = {}, options = {}) {
  return votingHierarchyService.saveE14ManualByMesa(payload, options);
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
      localidadId: reg.localidadId || null,
      localidad: reg.localidad || "",
      puestoId: reg.puestoId || null,
      puesto: reg.votingPlace || "",
      mesaId: reg.mesaId || null,
      mesa: toInt(reg.mesa ?? reg.votingTable),
      zoneCode: payload.e14ZoneCode || reg.e14ZoneCode || null,
      votosE14Candidate105: payload.e14VotesCandidate105,
      e14ListVotes: payload.e14ListVotes,
      notes: payload.notes,
      validatedBy: payload.validatedBy
    },
    options
  );
}

export async function recalculateE14Confirmation(rawFilters = {}, options = {}) {
  const [summary, rows] = await Promise.all([
    getE14ConfirmationSummaryData(rawFilters, options),
    getE14ConfirmationByMesaData(rawFilters, options)
  ]);
  return {
    processed: rows?.pagination?.total || 0,
    confirmed: summary?.confirmadas || 0,
    pending: summary?.pendientes || 0,
    updated: 0
  };
}

export default {
  calculateE14Confirmation,
  getE14ConfirmationData,
  getE14ConfirmationByMesaData,
  getE14ConfirmationSummaryData,
  getE14ProgressTreeData,
  getE14InvalidRowsData,
  saveManualByMesa,
  saveManualE14Confirmation,
  recalculateE14Confirmation
};
