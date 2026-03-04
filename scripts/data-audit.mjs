import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { Registration } from "../src/models/Registration.js";
import { Leader } from "../src/models/Leader.js";
import { Event } from "../src/models/Event.js";
import { Puestos } from "../src/models/Puestos.js";
import metricsService from "../src/services/metrics.service.js";
import analyticsRepository from "../src/backend/modules/analytics/analytics.repository.js";
import StatsService from "../src/services/stats.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toOutputPath(custom) {
  if (custom) return custom;
  return path.join(__dirname, `../reports/data-audit-${nowStamp()}.json`);
}

async function findDuplicateRegistrations(filter) {
  return Registration.aggregate([
    { $match: filter },
    {
      $project: {
        cedulaNorm: {
          $toLower: {
            $trim: { input: { $ifNull: ["$cedula", ""] } }
          }
        },
        eventId: 1,
        organizationId: 1
      }
    },
    {
      $group: {
        _id: {
          cedula: "$cedulaNorm",
          eventId: "$eventId",
          organizationId: "$organizationId"
        },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);
}

async function findDuplicateLeaders() {
  const byLeaderId = await Leader.aggregate([
    { $match: { leaderId: { $ne: null } } },
    { $group: { _id: "$leaderId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  const byToken = await Leader.aggregate([
    { $match: { token: { $ne: null } } },
    { $group: { _id: "$token", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  const byUsername = await Leader.aggregate([
    { $match: { username: { $ne: null } } },
    { $group: { _id: "$username", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  return { byLeaderId, byToken, byUsername };
}

async function findDuplicatePuestos() {
  const byCodigo = await Puestos.aggregate([
    { $match: { codigoPuesto: { $ne: null } } },
    { $group: { _id: "$codigoPuesto", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]);

  const byNombreLocalidad = await Puestos.aggregate([
    {
      $group: {
        _id: {
          nombre: { $toLower: { $trim: { input: "$nombre" } } },
          localidad: { $toLower: { $trim: { input: "$localidad" } } },
          departamento: { $toLower: { $trim: { input: "$departamento" } } }
        },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ]);

  return { byCodigo, byNombreLocalidad };
}

async function findOrphanRegistrations(filter) {
  const orphansLeader = await Registration.aggregate([
    { $match: { ...filter, leaderId: { $ne: null } } },
    {
      $lookup: {
        from: "leaders",
        let: { leaderId: "$leaderId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$leaderId", "$$leaderId"] },
                  { $eq: [{ $toString: "$_id" }, "$$leaderId"] }
                ]
              }
            }
          },
          { $limit: 1 }
        ],
        as: "leader"
      }
    },
    { $match: { leader: { $size: 0 } } },
    { $project: { _id: 1, leaderId: 1, eventId: 1 } },
    { $limit: 50 }
  ]);

  const orphansEvent = await Registration.aggregate([
    { $match: { ...filter, eventId: { $ne: null } } },
    {
      $lookup: {
        from: "events",
        localField: "eventId",
        foreignField: "_id",
        as: "event"
      }
    },
    { $match: { event: { $size: 0 } } },
    { $project: { _id: 1, eventId: 1, leaderId: 1 } },
    { $limit: 50 }
  ]);

  const orphansPuesto = await Registration.aggregate([
    { $match: { ...filter, puestoId: { $ne: null } } },
    {
      $lookup: {
        from: "puestos",
        localField: "puestoId",
        foreignField: "_id",
        as: "puesto"
      }
    },
    { $match: { puesto: { $size: 0 } } },
    { $project: { _id: 1, puestoId: 1, leaderId: 1 } },
    { $limit: 50 }
  ]);

  return { orphansLeader, orphansEvent, orphansPuesto };
}

async function findPuestoIssues() {
  const puestosMissingLocalidad = await Puestos.find({
    $or: [{ localidad: null }, { localidad: "" }]
  }, { _id: 1, nombre: 1, codigoPuesto: 1 }).lean();

  return { puestosMissingLocalidad };
}

async function compareMetrics({ organizationId, eventId }) {
  const metricsSummary = await metricsService.getStatsSummary({ organizationId, eventId });
  const analyticsSummary = await analyticsRepository.getExecutiveSummary(eventId);
  const statsSummary = await StatsService.getStats(organizationId, eventId);

  return {
    metricsSummary,
    analyticsSummary,
    statsSummary,
    diffs: {
      metrics_vs_analytics_total:
        metricsSummary.totalRegistrations - (analyticsSummary?.summary?.totalRegistrations || 0),
      metrics_vs_stats_total:
        metricsSummary.totalRegistrations - (statsSummary?.totalRegistrations || 0)
    }
  };
}

async function main() {
  const eventId = getArg("--event");
  const organizationId = getArg("--org");
  const outputPath = toOutputPath(getArg("--out"));

  await connectDB();

  const filter = {
    ...(eventId && { eventId }),
    ...(organizationId && { organizationId })
  };

  const duplicateRegistrations = await findDuplicateRegistrations(filter);
  const duplicateLeaders = await findDuplicateLeaders();
  const duplicatePuestos = await findDuplicatePuestos();
  const orphans = await findOrphanRegistrations(filter);
  const puestoIssues = await findPuestoIssues();
  const metricsComparison = await compareMetrics({ organizationId, eventId });

  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      filters: { eventId, organizationId }
    },
    duplicates: {
      registrations: duplicateRegistrations,
      leaders: duplicateLeaders,
      puestos: duplicatePuestos
    },
    orphans,
    puestoIssues,
    metricsComparison
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log("Data audit complete:");
  console.log(`- duplicate registrations: ${duplicateRegistrations.length}`);
  console.log(`- leader duplicate groups: ${duplicateLeaders.byLeaderId.length}`);
  console.log(`- puesto duplicate codes: ${duplicatePuestos.byCodigo.length}`);
  console.log(`- orphan registrations (leader): ${orphans.orphansLeader.length}`);
  console.log(`- orphan registrations (event): ${orphans.orphansEvent.length}`);
  console.log(`- orphan registrations (puesto): ${orphans.orphansPuesto.length}`);
  console.log(`- puestos missing localidad: ${puestoIssues.puestosMissingLocalidad.length}`);
  console.log(`Report saved to: ${outputPath}`);

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("Audit failed:", error);
  await disconnectDB();
  process.exit(1);
});
