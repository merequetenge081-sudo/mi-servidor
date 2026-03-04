import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { Puestos } from "../models/Puestos.js";

const BOGOTA_LOCALIDADES = [
  "Usaquén",
  "Chapinero",
  "Santa Fe",
  "San Cristóbal",
  "Usme",
  "Tunjuelito",
  "Bosa",
  "Kennedy",
  "Fontibón",
  "Engativá",
  "Suba",
  "Barrios Unidos",
  "Teusaquillo",
  "Los Mártires",
  "Antonio Nariño",
  "Puente Aranda",
  "La Candelaria",
  "Rafael Uribe Uribe",
  "Ciudad Bolívar",
  "Sumapaz"
];

const BOGOTA_LOCALIDADES_UPPER = BOGOTA_LOCALIDADES.map((l) => l.toUpperCase());
const BOGOTA_LOCALIDADES_NORMALIZED_UPPER = BOGOTA_LOCALIDADES.map((l) =>
  l
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
);

let bogotaLocalidadesCache = {
  list: [...BOGOTA_LOCALIDADES_NORMALIZED_UPPER],
  updatedAt: 0
};

function normalizeLocalidadString(value) {
  return (value || "")
    .toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "N")
    .toUpperCase();
}

async function loadBogotaLocalidadesFromDb() {
  const cacheTtlMs = 10 * 60 * 1000;
  if (Date.now() - bogotaLocalidadesCache.updatedAt < cacheTtlMs) {
    return bogotaLocalidadesCache.list;
  }

  const puestos = await Puestos.find(
    {
      localidad: { $nin: [null, ""] },
      $or: [
        { ciudad: /bogot/i },
        { departamento: /bogot/i },
        { departamento: /cundinamarca/i }
      ]
    },
    { localidad: 1 }
  ).lean();

  const merged = new Set(BOGOTA_LOCALIDADES_NORMALIZED_UPPER);
  puestos.forEach((puesto) => {
    const normalized = normalizeLocalidadString(puesto.localidad);
    if (normalized) merged.add(normalized);
  });

  bogotaLocalidadesCache = {
    list: Array.from(merged),
    updatedAt: Date.now()
  };

  return bogotaLocalidadesCache.list;
}

function normalizeLocalidadExpr(fieldExpr) {
  let expr = { 
    $trim: { input: { $toUpper: { $ifNull: [fieldExpr, ""] } } }
  };
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
    { find: "ñ", replacement: "N" }
  ];

  replacements.forEach((rule) => {
    expr = { $replaceAll: { input: expr, find: rule.find, replacement: rule.replacement } };
  });

  return expr;
}

function buildBaseMatch({ organizationId, eventId, leaderId, includeInvalid }) {
  const match = {};
  if (organizationId) match.organizationId = organizationId;
  if (eventId) match.eventId = eventId;
  if (leaderId) match.leaderId = leaderId;
  if (!includeInvalid) match.dataIntegrityStatus = { $ne: "invalid" };
  return match;
}

function buildRegionMatch(region, bogotaLocalidadesUpper = BOGOTA_LOCALIDADES_NORMALIZED_UPPER) {
  if (!region || region === "all") return null;

  const isBogotaExpr = {
    $or: [
      {
        $in: [
          normalizeLocalidadExpr("$localidadResolved"),
          bogotaLocalidadesUpper
        ]
      },
      {
        $regexMatch: {
          input: { $ifNull: ["$departamento", ""] },
          regex: /bogot|cundinamarca/i
        }
      },
      {
        $regexMatch: {
          input: { $ifNull: ["$capital", ""] },
          regex: /bogot/i
        }
      },
      {
        $regexMatch: {
          input: { $ifNull: ["$puesto.departamento", ""] },
          regex: /bogot|cundinamarca/i
        }
      },
      {
        $regexMatch: {
          input: { $ifNull: ["$puesto.ciudad", ""] },
          regex: /bogot/i
        }
      }
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

export async function getDashboardMetrics(options = {}) {
  const bogotaLocalidadesUpper = await loadBogotaLocalidadesFromDb();
  
  // Base match (includes leaderId, eventId, etc)
  const baseMatch = buildBaseMatch(options);

  const initialAggPipeline = [
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
          $or: [
            {
              $in: [
                normalizeLocalidadExpr("$localidadResolved"),
                bogotaLocalidadesUpper
              ]
            },
            {
              $regexMatch: {
                input: { $ifNull: ["$departamento", ""] },
                regex: /bogot|cundinamarca/i
              }
            },
            {
              $regexMatch: {
                input: { $ifNull: ["$capital", ""] },
                regex: /bogot/i
              }
            },
            {
              $regexMatch: {
                input: { $ifNull: ["$puesto.departamento", ""] },
                regex: /bogot|cundinamarca/i
              }
            },
            {
              $regexMatch: {
                input: { $ifNull: ["$puesto.ciudad", ""] },
                regex: /bogot/i
              }
            }
          ]
        }
      }
    }
  ];

  if (options.region && options.region !== "all") {
    initialAggPipeline.push({
      $match: {
        isBogota: options.region === "bogota"
      }
    });
  }

  const agg = await Registration.aggregate([
    ...initialAggPipeline,
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

  const leaderIds = agg.map((l) => l._id).filter(Boolean);
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

  const leaderTable = agg
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

  const localityAgg = await Registration.aggregate([
    ...initialAggPipeline,
    {
      $group: {
        _id: { $ifNull: ["$localidadResolved", { $ifNull: ["$puesto.departamento", "$departamento"] }] },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  const totalLeaders = await Leader.countDocuments({
    ...(options.organizationId && { organizationId: options.organizationId }),
    active: true
  });

  return {
    totals: {
      totalRegistrations: totals.total,
      confirmedCount: totals.confirmed,
      confirmRate: totals.total > 0 ? ((totals.confirmed / totals.total) * 100).toFixed(1) : 0,
      bogotaCount: totals.bogota,
      restoCount: totals.resto,
      leadersCount: leaderTable.length,
      totalLeaders,
      avgRegsPerLeader:
        leaderTable.length > 0 ? (totals.total / leaderTable.length).toFixed(1) : 0
    },
    leaders: leaderTable,
    locality: localityAgg.map((item) => ({
      name: item._id || "Sin dato",
      count: item.count
    })),
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
  getDashboardMetrics
};
