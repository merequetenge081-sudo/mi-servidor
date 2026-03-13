import { Leader, Registration } from "../models/index.js";
import {
  canonicalizeBogotaLocality,
  getBogotaLocalidadesCanonical
} from "../shared/territoryNormalization.js";
import { repairTextEncoding } from "../shared/textNormalization.js";

const RECOVERABLE_INVALID_STATUSES = [
  "invalid_mesa",
  "mismatched_localidad",
  "invalid_puesto",
  "unresolved_legacy",
  "incomplete"
];

const PRESET_MAP = {
  conservador: {
    growthOfficialPercent: 3,
    recoveryPercent: 5,
    leaderMobilizationPercent: 2,
    turnoutPercent: 2
  },
  moderado: {
    growthOfficialPercent: 8,
    recoveryPercent: 12,
    leaderMobilizationPercent: 5,
    turnoutPercent: 4
  },
  optimista: {
    growthOfficialPercent: 15,
    recoveryPercent: 20,
    leaderMobilizationPercent: 8,
    turnoutPercent: 7
  },
  personalizado: {
    growthOfficialPercent: 0,
    recoveryPercent: 0,
    leaderMobilizationPercent: 0,
    turnoutPercent: 0
  }
};

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [value].filter(Boolean);
}

function toPercent(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, numeric);
}

function normalizeDisplayName(value, fallback = "Sin dato") {
  const repaired = repairTextEncoding(value);
  return String(repaired || fallback).trim() || fallback;
}

function parseRegion(region) {
  const normalized = String(region || "all").trim().toLowerCase();
  if (normalized === "bogota" || normalized === "bogotá") return "bogota";
  if (normalized === "resto" || normalized === "nacional" || normalized === "resto_pais") return "resto";
  return "all";
}

function buildScopeQuery(filters = {}, organizationId = null, { includeInvalid = false } = {}) {
  const region = parseRegion(filters.region || filters.regionScope);
  const query = {};
  if (organizationId) query.organizationId = organizationId;
  if (filters.eventId) query.eventId = String(filters.eventId);

  const selectedLeaderIds = asArray(filters.selectedLeaderIds || filters.leaderIds || filters.leaderId);
  if (selectedLeaderIds.length) query.leaderId = { $in: selectedLeaderIds.map(String) };

  const selectedLocalidades = asArray(filters.selectedLocalidades || filters.localidades).map((item) =>
    normalizeDisplayName(canonicalizeBogotaLocality(item) || item)
  );
  if (selectedLocalidades.length) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { officialLocalidadNombre: { $in: selectedLocalidades } },
        { localidad: { $in: selectedLocalidades } }
      ]
    });
  } else if (region === "bogota") {
    const bogotaLocalidades = getBogotaLocalidadesCanonical();
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { officialLocalidadNombre: { $in: bogotaLocalidades } },
        { localidad: { $in: bogotaLocalidades } }
      ]
    });
  } else if (region === "resto") {
    const bogotaLocalidades = getBogotaLocalidadesCanonical();
    query.$and = query.$and || [];
    query.$and.push({
      $nor: [
        { officialLocalidadNombre: { $in: bogotaLocalidades } },
        { localidad: { $in: bogotaLocalidades } }
      ]
    });
  }

  const selectedPuestos = asArray(filters.selectedPuestos || filters.puestos).map((item) => normalizeDisplayName(item));
  if (selectedPuestos.length) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { officialPuestoNombre: { $in: selectedPuestos } },
        { votingPlace: { $in: selectedPuestos } }
      ]
    });
  }

  if (includeInvalid) {
    query.officialValidationStatus = { $in: RECOVERABLE_INVALID_STATUSES };
  } else {
    query.officialValidationStatus = "official_valid";
  }

  return query;
}

function mergePresetValues(payload = {}) {
  const preset = String(payload.scenarioType || payload.preset || "moderado").trim().toLowerCase();
  const defaults = PRESET_MAP[preset] || PRESET_MAP.moderado;
  return {
    scenarioType: preset,
    growthOfficialPercent: toPercent(payload.growthOfficialPercent, defaults.growthOfficialPercent),
    recoveryPercent: toPercent(payload.recoveryPercent, defaults.recoveryPercent),
    leaderMobilizationPercent: toPercent(payload.leaderMobilizationPercent, defaults.leaderMobilizationPercent),
    turnoutPercent: toPercent(payload.turnoutPercent, defaults.turnoutPercent),
    includeInvalidRecovery: payload.includeInvalidRecovery === true || String(payload.includeInvalidRecovery || "").toLowerCase() === "true",
    targetDate: payload.targetDate || null
  };
}

function mapByKey(rows = [], keyField = "id") {
  return rows.reduce((acc, row) => {
    acc[row[keyField]] = row;
    return acc;
  }, {});
}

function computeDaysToTarget(targetDate) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(`${targetDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

async function aggregateOfficialByLocalidad(baseQuery) {
  return Registration.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: { $ifNull: ["$officialLocalidadNombre", "$localidad"] },
        totalVotes: { $sum: 1 }
      }
    },
    { $sort: { totalVotes: -1, _id: 1 } },
    {
      $project: {
        _id: 0,
        id: "$_id",
        name: { $ifNull: ["$_id", "Sin Localidad"] },
        localidadNombre: { $ifNull: ["$_id", "Sin Localidad"] },
        totalVotes: 1,
        totalRegistros: "$totalVotes"
      }
    }
  ]);
}

async function aggregateOfficialByLeader(baseQuery) {
  return Registration.aggregate([
    { $match: baseQuery },
    {
      $group: {
        _id: {
          leaderId: { $ifNull: ["$leaderId", "sin-lider"] },
          leaderName: { $ifNull: ["$leaderName", "Sin lider"] }
        },
        totalVotes: { $sum: 1 }
      }
    },
    { $sort: { totalVotes: -1, "_id.leaderName": 1 } },
    {
      $project: {
        _id: 0,
        id: "$_id.leaderId",
        name: "$_id.leaderName",
        leaderId: "$_id.leaderId",
        leaderName: "$_id.leaderName",
        totalVotes: 1,
        totalRegistros: "$totalVotes"
      }
    }
  ]);
}

async function aggregateRecoverableByField(query, fieldName, nameFallbackField) {
  return Registration.aggregate([
    { $match: query },
    {
      $group: {
        _id: { $ifNull: [fieldName, nameFallbackField] },
        totalRecoverable: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        id: "$_id",
        totalRecoverable: 1
      }
    }
  ]);
}

class CampaignSimulationService {
  async buildBaseScenario(filters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const baseQuery = buildScopeQuery(filters, organizationId, { includeInvalid: false });
    const recoverableQuery = buildScopeQuery(filters, organizationId, { includeInvalid: true });

    const [officialTotal, recoverableTotal, localidades, leaderRows] = await Promise.all([
      Registration.countDocuments(baseQuery),
      Registration.countDocuments(recoverableQuery),
      aggregateOfficialByLocalidad(baseQuery),
      aggregateOfficialByLeader(baseQuery)
    ]);

    const leaderIds = leaderRows.map((row) => row.id).filter(Boolean);
    const leaders = leaderIds.length
      ? await Leader.find({ leaderId: { $in: leaderIds }, ...(organizationId ? { organizationId } : {}) })
        .select("leaderId name")
        .lean()
      : [];
    const leaderNameMap = new Map(leaders.map((leader) => [String(leader.leaderId), normalizeDisplayName(leader.name)]));

    return {
      scope: {
        region: parseRegion(filters.region || filters.regionScope),
        eventId: filters.eventId || null
      },
      summary: {
        officialValid: officialTotal,
        recoverableInvalid: recoverableTotal
      },
      options: {
        localidades: localidades.map((row) => ({
          id: row.id,
          name: normalizeDisplayName(row.name),
          totalVotes: Number(row.totalVotes || 0)
        })),
        leaders: leaderRows.map((row) => ({
          id: row.id,
          name: leaderNameMap.get(String(row.id)) || normalizeDisplayName(row.name),
          totalVotes: Number(row.totalVotes || 0)
        }))
      },
      presets: PRESET_MAP
    };
  }

  async runScenario(payload = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const scenario = mergePresetValues(payload);
    const baseQuery = buildScopeQuery(payload, organizationId, { includeInvalid: false });
    const recoverableQuery = buildScopeQuery(payload, organizationId, { includeInvalid: true });
    const selectedLocalidades = new Set(
      asArray(payload.selectedLocalidades || payload.localidades).map((item) =>
        normalizeDisplayName(canonicalizeBogotaLocality(item) || item)
      )
    );
    const selectedLeaderIds = new Set(asArray(payload.selectedLeaderIds || payload.leaderIds || payload.leaderId).map(String));
    const localityBoostMap = new Map(
      (Array.isArray(payload.localidadBoosts) ? payload.localidadBoosts : []).map((item) => [
        normalizeDisplayName(canonicalizeBogotaLocality(item?.localidad) || item?.localidad),
        toPercent(item?.percent, 0)
      ])
    );

    const [baseScenario, officialByLocalidad, officialByLeader, recoverableByLocalidad, recoverableByLeader] = await Promise.all([
      this.buildBaseScenario(payload, options),
      aggregateOfficialByLocalidad(baseQuery),
      aggregateOfficialByLeader(baseQuery),
      scenario.includeInvalidRecovery
        ? aggregateRecoverableByField(recoverableQuery, "$officialLocalidadNombre", "$localidad")
        : Promise.resolve([]),
      scenario.includeInvalidRecovery
        ? Registration.aggregate([
          { $match: recoverableQuery },
          {
            $group: {
              _id: { leaderId: { $ifNull: ["$leaderId", "sin-lider"] }, leaderName: { $ifNull: ["$leaderName", "Sin lider"] } },
              totalRecoverable: { $sum: 1 }
            }
          },
          {
            $project: {
              _id: 0,
              id: "$_id.leaderId",
              leaderName: "$_id.leaderName",
              totalRecoverable: 1
            }
          }
        ])
        : Promise.resolve([])
    ]);

    const recoverableLocalidadMap = mapByKey(recoverableByLocalidad, "id");
    const recoverableLeaderMap = mapByKey(recoverableByLeader, "id");

    const localityRows = officialByLocalidad.map((row) => {
      const currentVotes = Number(row.totalVotes || 0);
      const growthVotes = Math.round(currentVotes * (scenario.growthOfficialPercent / 100));
      const turnoutApplies = !selectedLocalidades.size || selectedLocalidades.has(row.id);
      const turnoutPercent = turnoutApplies ? scenario.turnoutPercent : 0;
      const turnoutVotes = Math.round(currentVotes * (turnoutPercent / 100));
      const localityBoostVotes = Math.round(currentVotes * ((localityBoostMap.get(row.id) || 0) / 100));
      const recoverableVotes = Math.round(Number(recoverableLocalidadMap[row.id]?.totalRecoverable || 0) * (scenario.recoveryPercent / 100));
      const simulatedVotes = currentVotes + growthVotes + turnoutVotes + localityBoostVotes + recoverableVotes;
      return {
        id: row.id,
        name: normalizeDisplayName(row.name),
        currentVotes,
        simulatedVotes,
        delta: simulatedVotes - currentVotes,
        growthVotes,
        turnoutVotes,
        localityBoostVotes,
        recoverableVotes
      };
    }).sort((a, b) => b.delta - a.delta || b.simulatedVotes - a.simulatedVotes);

    const leaderRows = officialByLeader.map((row) => {
      const currentVotes = Number(row.totalVotes || 0);
      const growthVotes = Math.round(currentVotes * (scenario.growthOfficialPercent / 100));
      const leaderApplies = !selectedLeaderIds.size || selectedLeaderIds.has(String(row.id));
      const leaderVotes = Math.round(currentVotes * ((leaderApplies ? scenario.leaderMobilizationPercent : 0) / 100));
      const recoverableVotes = Math.round(Number(recoverableLeaderMap[row.id]?.totalRecoverable || 0) * (scenario.recoveryPercent / 100));
      const simulatedVotes = currentVotes + growthVotes + leaderVotes + recoverableVotes;
      return {
        id: row.id,
        name: normalizeDisplayName(row.name),
        currentVotes,
        simulatedVotes,
        delta: simulatedVotes - currentVotes,
        growthVotes,
        leaderMobilizationVotes: leaderVotes,
        recoverableVotes
      };
    }).sort((a, b) => b.delta - a.delta || b.simulatedVotes - a.simulatedVotes);

    const currentTotal = Number(baseScenario.summary.officialValid || 0);
    const simulatedTotal = localityRows.reduce((sum, row) => sum + row.simulatedVotes, 0);
    const recoveryVotes = localityRows.reduce((sum, row) => sum + row.recoverableVotes, 0);
    const daysToTarget = computeDaysToTarget(scenario.targetDate);

    return {
      scope: baseScenario.scope,
      assumptions: {
        scenarioType: scenario.scenarioType,
        growthOfficialPercent: scenario.growthOfficialPercent,
        recoveryPercent: scenario.recoveryPercent,
        leaderMobilizationPercent: scenario.leaderMobilizationPercent,
        turnoutPercent: scenario.turnoutPercent,
        includeInvalidRecovery: scenario.includeInvalidRecovery,
        targetDate: scenario.targetDate,
        daysToTarget,
        summaryText: `Escenario ${scenario.scenarioType}: +${scenario.growthOfficialPercent}% sobre voto oficial, +${scenario.turnoutPercent}% de movilizacion territorial y +${scenario.recoveryPercent}% de recuperacion de registros corregibles.`
      },
      summary: {
        currentTotal,
        simulatedTotal,
        delta: simulatedTotal - currentTotal,
        recoverableVotes: recoveryVotes,
        selectedLocalidades: selectedLocalidades.size,
        selectedLeaders: selectedLeaderIds.size
      },
      byLocalidad: localityRows.slice(0, 20),
      byLeader: leaderRows.slice(0, 20),
      highlights: {
        topLocalidad: localityRows[0] || null,
        topLeader: leaderRows[0] || null
      }
    };
  }
}

export default new CampaignSimulationService();
