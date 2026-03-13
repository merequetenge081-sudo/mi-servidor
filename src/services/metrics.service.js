import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { Puestos } from "../models/Puestos.js";
import { applyCleanAnalyticsFilter } from "../shared/analyticsFilter.js";
import {
  getBogotaLocalidadesNormalized,
  normalizeTerritoryText
} from "../shared/territoryNormalization.js";
import metricsCacheService from "./metricsCache.service.js";

const BOGOTA_LOCALIDADES_NORMALIZED_UPPER = getBogotaLocalidadesNormalized();

let bogotaLocalidadesCache = {
  list: [...BOGOTA_LOCALIDADES_NORMALIZED_UPPER],
  updatedAt: 0
};

async function loadBogotaLocalidadesFromDb() {
  const cacheTtlMs = 10 * 60 * 1000;
  if (Date.now() - bogotaLocalidadesCache.updatedAt < cacheTtlMs) {
    return bogotaLocalidadesCache.list;
  }

  bogotaLocalidadesCache = {
    list: [...BOGOTA_LOCALIDADES_NORMALIZED_UPPER],
    updatedAt: Date.now()
  };

  return bogotaLocalidadesCache.list;
}

function normalizeLocalidadExpr(fieldExpr) {
  const replacements = [
    { find: "Á", replacement: "A" },
    { find: "É", replacement: "E" },
    { find: "Í", replacement: "I" },
    { find: "Ó", replacement: "O" },
    { find: "Ú", replacement: "U" },
    { find: "Ü", replacement: "U" },
    { find: "Ñ", replacement: "N" },
    { find: "á", replacement: "A" },
    { find: "é", replacement: "E" },
    { find: "í", replacement: "I" },
    { find: "ó", replacement: "O" },
    { find: "ú", replacement: "U" },
    { find: "ü", replacement: "U" },
    { find: "ñ", replacement: "N" },
    { find: "Ã¡", replacement: "A" },
    { find: "Ã©", replacement: "E" },
    { find: "Ã­", replacement: "I" },
    { find: "Ã³", replacement: "O" },
    { find: "Ãº", replacement: "U" },
    { find: "Ã±", replacement: "N" },
    { find: "?", replacement: "" }
  ];

  return {
    $reduce: {
      input: replacements,
      initialValue: {
        $trim: { input: { $toUpper: { $ifNull: [fieldExpr, ""] } } }
      },
      in: {
        $replaceAll: {
          input: "$$value",
          find: "$$this.find",
          replacement: "$$this.replacement"
        }
      }
    }
  };
}

function buildBaseMatch({ organizationId, eventId, leaderId, includeInvalid }) {
  const match = {};
  if (organizationId) match.organizationId = organizationId;
  if (eventId) match.eventId = eventId;
  if (leaderId) match.leaderId = leaderId;
  return applyCleanAnalyticsFilter(match, { includeInvalid });
}

function buildRegionMatch(region, bogotaLocalidadesUpper = BOGOTA_LOCALIDADES_NORMALIZED_UPPER) {
  if (!region || region === "all") return null;

  const isBogotaExpr = {
    $in: [
      normalizeLocalidadExpr("$localidadResolved"),
      bogotaLocalidadesUpper
    ]
  };

  return region === "bogota"
    ? { $expr: isBogotaExpr }
    : { $expr: { $not: isBogotaExpr } };
}

export async function getRegistrationStats(options = {}) {
  const match = buildBaseMatch(options);

  const stats = await Registration.aggregate([
    { $match: match },
    {
      $facet: {
        total: [{ $count: "count" }],
        confirmed: [
          { $match: { confirmed: true } },
          { $count: "count" }
        ],
        registeredToVote: [
          { $match: { registeredToVote: true } },
          { $count: "count" }
        ],
        uniqueLeaders: [
          { $match: { leaderId: { $ne: null } } },
          { $group: { _id: "$leaderId" } },
          { $count: "count" }
        ],
        uniquePuestos: [
          { $match: { puestoId: { $ne: null } } },
          { $group: { _id: "$puestoId" } },
          { $count: "count" }
        ]
      }
    }
  ]);

  const data = stats[0] || {};
  return {
    total: data.total?.[0]?.count || 0,
    confirmed: data.confirmed?.[0]?.count || 0,
    registeredToVote: data.registeredToVote?.[0]?.count || 0,
    byLeader: data.uniqueLeaders?.[0]?.count || 0,
    byPuesto: data.uniquePuestos?.[0]?.count || 0
  };
}

export async function getStatsSummary(options = {}) {
  const stats = await getRegistrationStats(options);
  const totalRegistrations = stats.total;
  const totalConfirmed = stats.confirmed;
  const registeredToVote = stats.registeredToVote;

  return {
    totalRegistrations,
    totalConfirmed,
    confirmationRate:
      totalRegistrations > 0
        ? ((totalConfirmed / totalRegistrations) * 100).toFixed(2)
        : 0,
    registeredToVote,
    notRegisteredToVote: totalRegistrations - registeredToVote,
    totalLeaders: await Leader.countDocuments({
      ...(options.organizationId && { organizationId: options.organizationId }),
      active: true
    }),
    totalEvents: await Event.countDocuments({
      ...(options.organizationId && { organizationId: options.organizationId }),
      active: true
    })
  };
}

export async function getDailyStats(options = {}, days = 30) {
  const match = buildBaseMatch(options);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return Registration.aggregate([
    {
      $match: {
        ...match,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        totalRegistrations: { $sum: 1 },
        confirmedCount: { $sum: { $cond: ["$confirmed", 1, 0] } },
        registeredToVote: { $sum: { $cond: ["$registeredToVote", 1, 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

export async function getLeaderStats(options = {}) {
  const match = buildBaseMatch({
    ...options,
    leaderId: null
  });
  if (options.leaderId) match.leaderId = options.leaderId;

  return Registration.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$leaderId",
        totalRegistrations: { $sum: 1 },
        confirmedCount: { $sum: { $cond: ["$confirmed", 1, 0] } },
        registeredToVote: { $sum: { $cond: ["$registeredToVote", 1, 0] } },
        lastRegistration: { $max: "$createdAt" },
        firstRegistration: { $min: "$createdAt" }
      }
    },
    {
      $addFields: {
        confirmationRate: {
          $cond: [
            { $gt: ["$totalRegistrations", 0] },
            {
              $multiply: [
                { $divide: ["$confirmedCount", "$totalRegistrations"] },
                100
              ]
            },
            0
          ]
        }
      }
    },
    { $sort: { totalRegistrations: -1 } }
  ]);
}

export async function getEventStats(options = {}) {
  const match = buildBaseMatch(options);

  return Registration.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$eventId",
        totalRegistrations: { $sum: 1 },
        confirmedCount: { $sum: { $cond: ["$confirmed", 1, 0] } },
        registeredToVote: { $sum: { $cond: ["$registeredToVote", 1, 0] } },
        uniqueLeaders: { $addToSet: "$leaderId" },
        uniqueCedulas: { $addToSet: "$cedula" }
      }
    },
    {
      $addFields: {
        confirmationRate: {
          $cond: [
            { $gt: ["$totalRegistrations", 0] },
            {
              $multiply: [
                { $divide: ["$confirmedCount", "$totalRegistrations"] },
                100
              ]
            },
            0
          ]
        },
        uniqueLeaders: { $size: "$uniqueLeaders" },
        uniquePersons: { $size: "$uniqueCedulas" }
      }
    },
    { $sort: { totalRegistrations: -1 } }
  ]);
}

export async function getGeographicStats(options = {}) {
  const match = buildBaseMatch(options);

  return Registration.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$localidad",
        count: { $sum: 1 },
        confirmed: { $sum: { $cond: ["$confirmed", 1, 0] } }
      }
    },
    {
      $addFields: {
        confirmationRate: {
          $cond: [
            { $gt: ["$count", 0] },
            { $multiply: [{ $divide: ["$confirmed", "$count"] }, 100] },
            0
          ]
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
}

export async function getPuestoStats(options = {}) {
  const match = buildBaseMatch(options);

  const totalPuestos = await Puestos.countDocuments();

  const puestosWithRegistrations = await Registration.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$puestoId",
        registrations: { $sum: 1 }
      }
    },
    { $match: { registrations: { $gt: 0 } } }
  ]);

  const localidades = await Puestos.aggregate([
    {
      $group: {
        _id: "$localidad",
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    totalPuestos,
    puestosWithActivity: puestosWithRegistrations.length,
    byLocalidad: localidades.map((l) => ({
      localidad: l._id,
      puestos: l.count
    }))
  };
}

export async function getTimeSeriesStats(startDate, endDate, options = {}) {
  const match = buildBaseMatch(options);

  return Registration.aggregate([
    {
      $match: {
        ...match,
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
}

export async function getDashboardSummary(eventId = null, options = {}) {
  const [registrations, leaders, events, puestos] = await Promise.all([
    getRegistrationStats({ ...options, eventId }),
    Leader.countDocuments({
      ...(options.organizationId && { organizationId: options.organizationId }),
      active: true
    }),
    Event.countDocuments({
      ...(options.organizationId && { organizationId: options.organizationId }),
      active: true
    }),
    getPuestoStats(options)
  ]);

  return {
    summary: {
      totalRegistrations: registrations.total,
      totalConfirmed: registrations.confirmed,
      confirmationRate:
        registrations.total > 0
          ? ((registrations.confirmed / registrations.total) * 100).toFixed(2)
          : 0,
      uniqueLeaders: registrations.byLeader,
      activeEvents: events,
      totalPuestos: puestos.totalPuestos
    },
    registrations,
    leaders: {
      total: leaders
    },
    events: {
      active: events
    },
    puestos,
    timestamp: new Date()
  };
}

async function getDashboardMetricsCompact(options = {}) {
  return metricsCacheService.getOrComputeCompactMetrics(options, async () => {
    const bogotaLocalidadesUpper = await loadBogotaLocalidadesFromDb();
    const baseMatch = buildBaseMatch({ ...options, includeInvalid: true });

    const localidadMetricExpr = {
      $let: {
        vars: {
          officialLocalidad: { $trim: { input: { $ifNull: ["$officialLocalidadNombre", ""] } } },
          fallbackLocalidad: { $trim: { input: { $ifNull: ["$localidad", ""] } } }
        },
        in: {
          $cond: [
            { $gt: [{ $strLenCP: "$$officialLocalidad" }, 0] },
            "$$officialLocalidad",
            "$$fallbackLocalidad"
          ]
        }
      }
    };

    const pipeline = [{ $match: baseMatch }];

    if (options.region && options.region !== "all") {
      pipeline.push(
        {
          $addFields: {
            localidadMetric: localidadMetricExpr,
            isBogotaMetric: {
              $in: [normalizeLocalidadExpr(localidadMetricExpr), bogotaLocalidadesUpper]
            }
          }
        },
        {
          $match: {
            isBogotaMetric: options.region === "bogota"
          }
        }
      );
    }

    pipeline.push(
      {
        $group: {
          _id: null,
          totalRegistros: { $sum: 1 },
          confirmados: { $sum: { $cond: ["$confirmed", 1, 0] } },
          oficiales: {
            $sum: {
              $cond: [{ $eq: ["$officialValidationStatus", "official_valid"] }, 1, 0]
            }
          },
          erroneosOIncompletos: {
            $sum: {
              $cond: [{ $eq: ["$movedToErrorBucket", true] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalRegistros: 1,
          confirmados: 1,
          oficiales: 1,
          erroneosOIncompletos: 1,
          porcentajeConfirmacion: {
            $cond: [
              { $gt: ["$totalRegistros", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$confirmados", "$totalRegistros"] },
                      100
                    ]
                  },
                  1
                ]
              },
              0
            ]
          }
        }
      }
    );

    const [aggregateRow, totalLeaders] = await Promise.all([
      Registration.aggregate(pipeline).then((rows) => rows[0] || null),
      Leader.countDocuments({
        ...(options.organizationId && { organizationId: options.organizationId }),
        ...(options.eventId && { eventId: options.eventId }),
        active: true
      })
    ]);

    const metrics = {
      totalRegistros: Number(aggregateRow?.totalRegistros || 0),
      confirmados: Number(aggregateRow?.confirmados || 0),
      totalLideres: Number(totalLeaders || 0),
      oficiales: Number(aggregateRow?.oficiales || 0),
      erroneosOIncompletos: Number(aggregateRow?.erroneosOIncompletos || 0),
      porcentajeConfirmacion: Number(aggregateRow?.porcentajeConfirmacion || 0)
    };

    return {
      ...metrics,
      totals: {
        totalRegistrations: metrics.totalRegistros,
        confirmedCount: metrics.confirmados,
        confirmRate: metrics.porcentajeConfirmacion,
        totalLeaders: metrics.totalLideres,
        leadersCount: metrics.totalLideres,
        oficiales: metrics.oficiales,
        erroneosOIncompletos: metrics.erroneosOIncompletos
      },
      operationalTotals: {
        totalRegistrations: metrics.totalRegistros,
        confirmedCount: metrics.confirmados,
        confirmRate: metrics.porcentajeConfirmacion,
        totalLeaders: metrics.totalLideres,
        leadersCount: metrics.totalLideres,
        oficiales: metrics.oficiales,
        erroneosOIncompletos: metrics.erroneosOIncompletos
      },
      source: {
        metricEndpoint: "/api/v2/analytics/metrics",
        usesCleanFilter: false,
        includesOperationalTotals: false,
        includeDetails: false,
        cacheable: true,
        filter: {
          organizationId: options.organizationId || null,
          eventId: options.eventId || null,
          region: options.region || "all",
          leaderId: options.leaderId || null
        }
      },
      timestamp: new Date()
    };
  });
}

export async function prewarmDashboardMetricsCommonScopes() {
  const scopes = [
    { region: "all", includeDetails: false },
    { region: "bogota", includeDetails: false }
  ];

  const results = await Promise.allSettled(
    scopes.map((scope) => getDashboardMetricsCompact(scope))
  );

  return results.map((result, index) => ({
    scope: scopes[index],
    success: result.status === "fulfilled",
    error: result.status === "rejected" ? String(result.reason?.message || result.reason || "") : ""
  }));
}

export async function getDashboardMetrics(options = {}) {
  if (options.includeDetails === false) {
    return getDashboardMetricsCompact(options);
  }

  const bogotaLocalidadesUpper = await loadBogotaLocalidadesFromDb();

  const baseMatchClean = buildBaseMatch(options);
  const baseMatchRaw = buildBaseMatch({ ...options, includeInvalid: true });

  const buildInitialAggPipeline = (baseMatch) => {
    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: "puestos",
          localField: "puestoId",
          foreignField: "_id",
          as: "puesto"
        }
      },
      { $addFields: { puesto: { $arrayElemAt: ["$puesto", 0] } } },
      {
        $addFields: {
          localidadResolved: {
            $ifNull: ["$puesto.localidad", "$localidad"]
          }
        }
      },
      {
        $addFields: {
          isBogota: {
            $in: [
              normalizeLocalidadExpr("$localidadResolved"),
              bogotaLocalidadesUpper
            ]
          }
        }
      }
    ];

    if (options.region && options.region !== "all") {
      pipeline.push({
        $match: {
          isBogota: options.region === "bogota"
        }
      });
    }
    return pipeline;
  };

  const initialAggPipelineClean = buildInitialAggPipeline(baseMatchClean);
  const initialAggPipelineRaw = buildInitialAggPipeline(baseMatchRaw);

  const aggClean = await Registration.aggregate([
    ...initialAggPipelineClean,
    {
      $group: {
        _id: "$leaderId",
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: ["$confirmed", 1, 0] } },
        bogota: { $sum: { $cond: ["$isBogota", 1, 0] } },
        resto: { $sum: { $cond: ["$isBogota", 0, 1] } }
      }
    }
  ]);

  const aggRaw = await Registration.aggregate([
    ...initialAggPipelineRaw,
    {
      $group: {
        _id: "$leaderId",
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: ["$confirmed", 1, 0] } },
        bogota: { $sum: { $cond: ["$isBogota", 1, 0] } },
        resto: { $sum: { $cond: ["$isBogota", 0, 1] } }
      }
    }
  ]);

  const leaderIds = [...aggClean, ...aggRaw].map((l) => l._id).filter(Boolean);
  const objectLeaderIds = leaderIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  const leaderDocs = await Leader.find(
    {
      $or: [
        { leaderId: { $in: leaderIds } },
        ...(objectLeaderIds.length ? [{ _id: { $in: objectLeaderIds } }] : [])
      ]
    },
    { name: 1, leaderId: 1 }
  ).lean();

  const leaderById = new Map();
  leaderDocs.forEach((leader) => {
    if (leader._id) leaderById.set(leader._id.toString(), leader.name);
    if (leader.leaderId) leaderById.set(leader.leaderId, leader.name);
  });

  const mapLeaderRows = (rows) =>
    rows
    .map((item) => {
      const name = leaderById.get(String(item._id)) || item._id || "Sin lider";
      return {
        leaderId: item._id,
        name,
        total: item.total,
        confirmed: item.confirmed,
        pending: item.total - item.confirmed,
        rate: item.total > 0 ? ((item.confirmed / item.total) * 100).toFixed(1) : 0,
        bogota: item.bogota,
        resto: item.resto
      };
    })
    .sort((a, b) => b.total - a.total);

  const leaderTable = mapLeaderRows(aggClean);
  const leaderTableOperational = mapLeaderRows(aggRaw);

  const totals = leaderTable.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.confirmed += item.confirmed;
      acc.bogota += item.bogota;
      acc.resto += item.resto;
      return acc;
    },
    { total: 0, confirmed: 0, bogota: 0, resto: 0 }
  );

  const operationalTotals = leaderTableOperational.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.confirmed += item.confirmed;
      acc.bogota += item.bogota;
      acc.resto += item.resto;
      return acc;
    },
    { total: 0, confirmed: 0, bogota: 0, resto: 0 }
  );

  const localityAgg = await Registration.aggregate([
    ...initialAggPipelineClean,
    {
      $group: {
        _id: { $ifNull: ["$localidadResolved", { $ifNull: ["$puesto.departamento", "$departamento"] }] },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const localityAggRaw = await Registration.aggregate([
    ...initialAggPipelineRaw,
    {
      $group: {
        _id: { $ifNull: ["$localidadResolved", { $ifNull: ["$puesto.departamento", "$departamento"] }] },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const recentAgg = await Registration.aggregate([
    ...initialAggPipelineClean,
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 1,
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        cedula: 1,
        leaderId: 1,
        leaderName: 1,
        createdAt: 1,
        date: 1,
        confirmed: 1,
        workflowStatus: 1,
        dataIntegrityStatus: 1
      }
    }
  ]);

  const totalLeaders = await Leader.countDocuments({
    ...(options.organizationId && { organizationId: options.organizationId }),
    active: true
  });

  const totalLeadersByEvent = options.eventId
    ? await Leader.countDocuments({
        ...(options.organizationId && { organizationId: options.organizationId }),
        active: true,
        eventId: options.eventId
      })
    : totalLeaders;

  const totalLeadersOperational = options.eventId
    ? Math.max(totalLeadersByEvent, leaderTableOperational.length)
    : totalLeaders;

  return {
    totals: {
      totalRegistrations: totals.total,
      confirmedCount: totals.confirmed,
      confirmRate: totals.total > 0 ? ((totals.confirmed / totals.total) * 100).toFixed(1) : 0,
      bogotaCount: totals.bogota,
      restoCount: totals.resto,
      leadersCount: leaderTable.length,
      totalLeaders: totalLeadersOperational,
      avgRegsPerLeader:
        leaderTable.length > 0 ? (totals.total / leaderTable.length).toFixed(1) : 0
    },
    operationalTotals: {
      totalRegistrations: operationalTotals.total,
      confirmedCount: operationalTotals.confirmed,
      confirmRate:
        operationalTotals.total > 0
          ? ((operationalTotals.confirmed / operationalTotals.total) * 100).toFixed(1)
          : 0,
      bogotaCount: operationalTotals.bogota,
      restoCount: operationalTotals.resto,
      leadersCount: leaderTableOperational.length,
      totalLeaders: totalLeadersOperational,
      avgRegsPerLeader:
        leaderTableOperational.length > 0
          ? (operationalTotals.total / leaderTableOperational.length).toFixed(1)
          : 0
    },
    leaders: leaderTable,
    leadersOperational: leaderTableOperational,
    locality: (Array.isArray(localityAgg) ? localityAgg : []).map((item) => ({
      name: item._id || "Sin dato",
      count: item.count
    })),
    localityOperational: (Array.isArray(localityAggRaw) ? localityAggRaw : []).map((item) => ({
      name: item._id || "Sin dato",
      count: item.count
    })),
    recentRecords: (Array.isArray(recentAgg) ? recentAgg : []).map((item) => ({
      id: item._id,
      firstName: item.firstName || "",
      lastName: item.lastName || "",
      email: item.email || "",
      phone: item.phone || "",
      cedula: item.cedula || "",
      leaderId: item.leaderId || null,
      leaderName: leaderById.get(String(item.leaderId)) || item.leaderName || "Sin lider",
      createdAt: item.createdAt || item.date || null,
      confirmed: item.confirmed === true || item.workflowStatus === "confirmed",
      workflowStatus: item.workflowStatus || null,
      dataIntegrityStatus: item.dataIntegrityStatus || null
    })),
    source: {
      metricEndpoint: "/api/v2/analytics/metrics",
      usesCleanFilter: true,
      includesOperationalTotals: true,
      filter: {
        eventId: options.eventId || null,
        region: options.region || "all",
        leaderId: options.leaderId || null
      }
    },
    timestamp: new Date()
  };
}

export default {
  getRegistrationStats,
  getStatsSummary,
  getDailyStats,
  getLeaderStats,
  getEventStats,
  getGeographicStats,
  getPuestoStats,
  getTimeSeriesStats,
  getDashboardSummary,
  getDashboardMetrics,
  prewarmDashboardMetricsCommonScopes
};

