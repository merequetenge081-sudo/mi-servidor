import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { Registration } from "../src/models/Registration.js";
import { ArchivedRegistration } from "../src/models/ArchivedRegistration.js";
import { Leader } from "../src/models/Leader.js";
import { Event } from "../src/models/Event.js";
import { Puestos } from "../src/models/Puestos.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function toLogPath(custom) {
  if (custom) return custom;
  return path.join(__dirname, `../logs/data-cleanup-${nowStamp()}.json`);
}

function scoreRegistration(reg) {
  let score = 0;
  if (reg.confirmed) score += 5;
  if (reg.registeredToVote) score += 2;
  if (reg.hasConsentToRegister) score += 2;
  if (reg.email) score += 1;
  if (reg.phone) score += 1;
  if (reg.puestoId) score += 2;
  if (reg.mesa) score += 1;
  if (reg.localidad) score += 1;
  if (reg.departamento) score += 1;
  if (reg.capital) score += 1;
  if (reg.leaderName) score += 1;
  return score;
}

function pickCanonical(regs) {
  return regs
    .map((reg) => ({
      reg,
      score: scoreRegistration(reg),
      updatedAt: reg.updatedAt ? new Date(reg.updatedAt).getTime() : 0
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt - a.updatedAt;
    })[0].reg;
}

async function archiveAndDelete(reg, reason, apply, log) {
  log.actions.push({
    action: "archive_registration",
    id: reg._id.toString(),
    reason,
    timestamp: new Date().toISOString()
  });

  if (!apply) return;

  await ArchivedRegistration.create({
    originalId: reg._id,
    leaderId: reg.leaderId,
    leaderName: reg.leaderName,
    eventId: reg.eventId,
    firstName: reg.firstName,
    lastName: reg.lastName,
    cedula: reg.cedula,
    email: reg.email,
    phone: reg.phone,
    localidad: reg.localidad,
    departamento: reg.departamento,
    capital: reg.capital,
    votingPlace: reg.votingPlace,
    votingTable: reg.votingTable,
    puestoId: reg.puestoId,
    mesa: reg.mesa,
    registeredToVote: reg.registeredToVote,
    confirmed: reg.confirmed,
    date: reg.date,
    organizationId: reg.organizationId,
    archivedAt: new Date(),
    archivedBy: "data-cleanup-script",
    archivedReason: reason,
    originalCreatedAt: reg.createdAt,
    originalUpdatedAt: reg.updatedAt
  });

  await Registration.deleteOne({ _id: reg._id });
}

async function main() {
  const apply = hasFlag("--apply");
  const eventId = getArg("--event");
  const organizationId = getArg("--org");
  const limit = parseInt(getArg("--limit") || "200", 10);
  const logPath = toLogPath(getArg("--out"));

  const log = {
    metadata: {
      apply,
      eventId,
      organizationId,
      limit,
      startedAt: new Date().toISOString()
    },
    actions: []
  };

  await connectDB();

  const baseFilter = {
    ...(eventId && { eventId }),
    ...(organizationId && { organizationId })
  };

  // 1) Duplicates by cedula + eventId + organizationId
  const duplicateGroups = await Registration.aggregate([
    { $match: baseFilter },
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
        count: { $sum: 1 },
        ids: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  for (const group of duplicateGroups) {
    const regs = await Registration.find({ _id: { $in: group.ids } }).lean();
    if (regs.length <= 1) continue;

    const canonical = pickCanonical(regs);
    const duplicates = regs.filter((r) => r._id.toString() !== canonical._id.toString());

    log.actions.push({
      action: "duplicate_group",
      key: group._id,
      canonicalId: canonical._id.toString(),
      duplicateCount: duplicates.length,
      timestamp: new Date().toISOString()
    });

    for (const dup of duplicates) {
      await archiveAndDelete(dup, "duplicate_registration", apply, log);
    }
  }

  // 2) Orphan leader references
  const orphanLeader = await Registration.aggregate([
    { $match: { ...baseFilter, leaderId: { $ne: null } } },
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
    { $project: { _id: 1, leaderId: 1 } },
    { $limit: limit }
  ]);

  if (orphanLeader.length > 0) {
    log.actions.push({
      action: "orphan_leader",
      count: orphanLeader.length,
      sample: orphanLeader.slice(0, 10),
      timestamp: new Date().toISOString()
    });

    if (apply) {
      await Registration.updateMany(
        { _id: { $in: orphanLeader.map((o) => o._id) } },
        {
          $set: {
            dataIntegrityStatus: "needs_review",
            necesitaRevision: true
          }
        }
      );
    }
  }

  // 3) Orphan event references
  const orphanEvent = await Registration.aggregate([
    { $match: { ...baseFilter, eventId: { $ne: null } } },
    {
      $lookup: {
        from: "events",
        localField: "eventId",
        foreignField: "_id",
        as: "event"
      }
    },
    { $match: { event: { $size: 0 } } },
    { $project: { _id: 1, eventId: 1 } },
    { $limit: limit }
  ]);

  if (orphanEvent.length > 0) {
    log.actions.push({
      action: "orphan_event",
      count: orphanEvent.length,
      sample: orphanEvent.slice(0, 10),
      timestamp: new Date().toISOString()
    });

    if (apply) {
      await Registration.updateMany(
        { _id: { $in: orphanEvent.map((o) => o._id) } },
        {
          $set: {
            dataIntegrityStatus: "invalid",
            inconsistenciaGrave: true
          }
        }
      );
    }
  }

  // 4) Orphan puesto references
  const orphanPuesto = await Registration.aggregate([
    { $match: { ...baseFilter, puestoId: { $ne: null } } },
    {
      $lookup: {
        from: "puestos",
        localField: "puestoId",
        foreignField: "_id",
        as: "puesto"
      }
    },
    { $match: { puesto: { $size: 0 } } },
    { $project: { _id: 1, puestoId: 1 } },
    { $limit: limit }
  ]);

  if (orphanPuesto.length > 0) {
    log.actions.push({
      action: "orphan_puesto",
      count: orphanPuesto.length,
      sample: orphanPuesto.slice(0, 10),
      timestamp: new Date().toISOString()
    });

    if (apply) {
      await Registration.updateMany(
        { _id: { $in: orphanPuesto.map((o) => o._id) } },
        {
          $set: {
            puestoId: null,
            requiereRevisionPuesto: true,
            revisionPuestoResuelta: false,
            dataIntegrityStatus: "needs_review"
          }
        }
      );
    }
  }

  // 5) Puestos missing localidad -> infer from registrations
  const puestoLocalidadMap = await Registration.aggregate([
    {
      $match: {
        ...baseFilter,
        puestoId: { $ne: null },
        localidad: { $ne: null, $ne: "" },
        dataIntegrityStatus: { $ne: "invalid" }
      }
    },
    {
      $group: {
        _id: { puestoId: "$puestoId", localidad: "$localidad" },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    {
      $group: {
        _id: "$_id.puestoId",
        localidad: { $first: "$_id.localidad" },
        count: { $first: "$count" }
      }
    }
  ]);

  const localidadByPuesto = new Map(
    puestoLocalidadMap.map((row) => [row._id.toString(), row.localidad])
  );

  const puestosMissingLocalidad = await Puestos.find({
    $or: [{ localidad: null }, { localidad: "" }]
  }).limit(limit);

  for (const puesto of puestosMissingLocalidad) {
    const inferred = localidadByPuesto.get(puesto._id.toString());
    if (inferred) {
      log.actions.push({
        action: "infer_puesto_localidad",
        puestoId: puesto._id.toString(),
        localidad: inferred,
        timestamp: new Date().toISOString()
      });

      if (apply) {
        await Puestos.updateOne(
          { _id: puesto._id },
          { $set: { localidad: inferred, integrityStatus: "valid" } }
        );
      }
    } else {
      log.actions.push({
        action: "invalid_puesto_localidad",
        puestoId: puesto._id.toString(),
        timestamp: new Date().toISOString()
      });

      if (apply) {
        await Puestos.updateOne(
          { _id: puesto._id },
          { $set: { integrityStatus: "invalid", activo: false } }
        );
      }
    }
  }

  // 6) Registrations missing localidad but with puestoId
  const regsMissingLocalidad = await Registration.find({
    ...baseFilter,
    puestoId: { $ne: null },
    $or: [{ localidad: null }, { localidad: "" }]
  }).limit(limit);

  if (regsMissingLocalidad.length > 0) {
    const puestoIds = regsMissingLocalidad.map((r) => r.puestoId).filter(Boolean);
    const puestos = await Puestos.find({ _id: { $in: puestoIds } }).lean();
    const puestoById = new Map(puestos.map((p) => [p._id.toString(), p]));

    for (const reg of regsMissingLocalidad) {
      const puesto = puestoById.get(reg.puestoId?.toString());
      if (!puesto || !puesto.localidad) {
        log.actions.push({
          action: "registration_missing_localidad",
          registrationId: reg._id.toString(),
          puestoId: reg.puestoId?.toString() || null,
          timestamp: new Date().toISOString()
        });
        if (apply) {
          await Registration.updateOne(
            { _id: reg._id },
            { $set: { dataIntegrityStatus: "invalid", inconsistenciaGrave: true } }
          );
        }
        continue;
      }

      log.actions.push({
        action: "fill_registration_localidad",
        registrationId: reg._id.toString(),
        localidad: puesto.localidad,
        timestamp: new Date().toISOString()
      });

      if (apply) {
        await Registration.updateOne(
          { _id: reg._id },
          { $set: { localidad: puesto.localidad, dataIntegrityStatus: "valid" } }
        );
      }
    }
  }

  // 7) Registrations without puestoId and without localidad
  const regsNoLocalidad = await Registration.find({
    ...baseFilter,
    puestoId: null,
    $or: [{ localidad: null }, { localidad: "" }]
  }).limit(limit);

  if (regsNoLocalidad.length > 0) {
    log.actions.push({
      action: "registration_no_localidad",
      count: regsNoLocalidad.length,
      sample: regsNoLocalidad.slice(0, 10).map((r) => r._id.toString()),
      timestamp: new Date().toISOString()
    });

    if (apply) {
      await Registration.updateMany(
        { _id: { $in: regsNoLocalidad.map((r) => r._id) } },
        { $set: { dataIntegrityStatus: "invalid", inconsistenciaGrave: true } }
      );
    }
  }

  log.metadata.finishedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));

  console.log("Data cleanup complete:");
  console.log(`- apply mode: ${apply}`);
  console.log(`- duplicate groups processed: ${duplicateGroups.length}`);
  console.log(`- orphan leader records: ${orphanLeader.length}`);
  console.log(`- orphan event records: ${orphanEvent.length}`);
  console.log(`- orphan puesto records: ${orphanPuesto.length}`);
  console.log(`- puestos missing localidad: ${puestosMissingLocalidad.length}`);
  console.log(`- registrations missing localidad: ${regsMissingLocalidad.length}`);
  console.log(`- registrations without localidad/puesto: ${regsNoLocalidad.length}`);
  console.log(`Log saved to: ${logPath}`);

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("Cleanup failed:", error);
  await disconnectDB();
  process.exit(1);
});
