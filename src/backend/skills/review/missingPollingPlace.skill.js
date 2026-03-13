import mongoose from "mongoose";
import { Registration } from "../../../models/Registration.js";
import { Leader } from "../../../models/Leader.js";

function buildBaseQuery({ organizationId, eventId = null }) {
  return {
    organizationId,
    ...(eventId ? { eventId } : {}),
    $or: [{ puestoId: null }, { puestoId: { $exists: false } }]
  };
}

function resolveLeaderKey(reg) {
  return String(reg.leaderId || "unassigned");
}

export async function runMissingPollingPlaceReviewSkill({
  organizationId,
  eventId = null,
  limit = 5000,
  dryRun = false
} = {}) {
  const cappedLimit = Math.max(1, Math.min(Number(limit) || 5000, 20000));
  const regs = await Registration.find(buildBaseQuery({ organizationId, eventId }))
    .select("_id leaderId leaderName firstName lastName cedula workflowStatus missingPollingPlace requiresReview")
    .sort({ updatedAt: -1 })
    .limit(cappedLimit)
    .lean();

  const leaderKeys = [...new Set(regs.map((reg) => resolveLeaderKey(reg)).filter(Boolean))];
  const objectIds = leaderKeys.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id));
  const leaders = await Leader.find({
    organizationId,
    $or: [
      ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      { leaderId: { $in: leaderKeys } }
    ]
  })
    .select("_id leaderId name email")
    .lean();

  const byAnyId = new Map();
  for (const leader of leaders) {
    byAnyId.set(String(leader._id), leader);
    if (leader.leaderId) byAnyId.set(String(leader.leaderId), leader);
  }

  const perLeader = new Map();
  const bulkOps = [];
  const results = [];

  for (const reg of regs) {
    const key = resolveLeaderKey(reg);
    const leader = byAnyId.get(key) || null;
    const canonicalLeaderId = leader?.leaderId || String(leader?._id || key);
    const leaderName = leader?.name || reg.leaderName || "Sin lider";
    const leaderEmail = leader?.email || null;

    perLeader.set(canonicalLeaderId, {
      leaderId: canonicalLeaderId,
      leaderName,
      leaderEmail,
      count: (perLeader.get(canonicalLeaderId)?.count || 0) + 1
    });

    if (!dryRun) {
      bulkOps.push({
        updateOne: {
          filter: { _id: reg._id },
          update: {
            $set: {
              missingPollingPlace: true,
              requiresReview: true,
              necesitaRevision: true,
              requiereRevisionPuesto: true,
              dataIntegrityStatus: "needs_review",
              workflowStatus: reg.workflowStatus === "invalid" ? "invalid" : "flagged"
            },
            $addToSet: {
              validationErrors: "missing_polling_place"
            }
          }
        }
      });
    }

    results.push({
      entityId: String(reg._id),
      status: "warning",
      reasons: ["missing_polling_place"],
      flags: ["missing_polling_place"],
      output: {
        leaderId: canonicalLeaderId,
        leaderName
      }
    });
  }

  if (!dryRun && bulkOps.length > 0) {
    await Registration.bulkWrite(bulkOps, { ordered: false });
  }

  const leaderNotices = [...perLeader.values()].sort((a, b) => b.count - a.count).map((item) => ({
    ...item,
    message: `Lider ${item.leaderName}: ${item.count} registros sin puesto asignado requieren revision.`
  }));

  for (const notice of leaderNotices) {
    // Temporary operational trace for live validation
    console.log(`[REVIEW TRACE] missingPollingPlace leaderId=${notice.leaderId} count=${notice.count}`);
  }

  return {
    skill: "missingPollingPlaceReview",
    processed: regs.length,
    flagged: regs.length,
    leadersNotified: leaderNotices.length,
    excludedFromMainBreakdown: regs.length,
    dryRun: Boolean(dryRun),
    leaderNotices,
    results
  };
}

export default {
  runMissingPollingPlaceReviewSkill
};
