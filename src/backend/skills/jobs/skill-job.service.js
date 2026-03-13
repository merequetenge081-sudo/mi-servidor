import { Registration } from "../../../models/Registration.js";
import { SkillJob } from "../../../models/SkillJob.js";
import { SkillResult } from "../../../models/SkillResult.js";
import {
  runValidationSkill,
  runDeduplicationSkill,
  persistDeduplicationFlags,
  prepareVerificationQueue,
  recalculateLeaderProductivity,
  recalculateCleanAnalytics,
  calculateRegistrationScore,
  runDatabaseOptimizationSkill,
  runUiTextQualitySkill,
  runMissingPollingPlaceReviewSkill
} from "../index.js";

async function runValidationBatch({ organizationId, eventId = null, limit = 300 }) {
  const regs = await Registration.find({
    organizationId,
    ...(eventId ? { eventId } : {})
  })
    .select("_id organizationId eventId leaderId firstName lastName cedula phone localidad departamento capital registeredToVote puestoId mesa deduplicationFlags")
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 3000)))
    .lean();

  let updated = 0;
  const results = [];
  for (const reg of regs) {
    const out = await runValidationSkill({ registration: reg, organizationId, strict: true });
    await Registration.updateOne(
      { _id: reg._id },
      {
        $set: {
          firstName: out.normalized.firstName,
          lastName: out.normalized.lastName,
          cedula: out.normalized.cedula,
          phone: out.normalized.phone,
          localidad: out.normalized.localidad,
          dataIntegrityStatus: out.dataIntegrityStatus,
          workflowStatus: out.workflowStatus,
          validationErrors: [...out.errors, ...out.warnings]
        }
      }
    );
    updated += 1;
    results.push({
      entityId: String(reg._id),
      status: out.invalid ? "error" : out.needsReview ? "warning" : "ok",
      reasons: [...out.errors, ...out.warnings]
    });
  }

  return { processed: regs.length, updated, results };
}

async function runDeduplicationBatch({ organizationId, eventId = null, limit = 300 }) {
  const regs = await Registration.find({
    organizationId,
    ...(eventId ? { eventId } : {})
  })
    .select("_id organizationId eventId leaderId firstName lastName cedula phone localidad puestoId")
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 3000)))
    .lean();

  let flagged = 0;
  const results = [];
  for (const reg of regs) {
    const dedup = await runDeduplicationSkill({
      registration: reg,
      organizationId,
      excludeRegistrationId: reg._id
    });

    if (dedup.hasFlags) {
      flagged += 1;
      await persistDeduplicationFlags({
        registrationId: reg._id,
        organizationId,
        eventId: reg.eventId,
        cedula: reg.cedula,
        flags: dedup.flags
      });
    }

    await Registration.updateOne(
      { _id: reg._id },
      {
        $set: {
          deduplicationFlags: dedup.flags.map((f) => f.flagType),
          dataIntegrityStatus: dedup.hasCritical ? "invalid" : dedup.hasFlags ? "needs_review" : "valid",
          workflowStatus: dedup.workflowStatus
        }
      }
    );

    results.push({
      entityId: String(reg._id),
      status: dedup.hasCritical ? "error" : dedup.hasFlags ? "warning" : "ok",
      reasons: dedup.flags.map((f) => f.flagType),
      flags: dedup.flags.map((f) => f.flagType)
    });
  }

  return { processed: regs.length, flagged, results };
}

async function runScoringBatch({ organizationId, eventId = null, limit = 300 }) {
  const regs = await Registration.find({
    organizationId,
    ...(eventId ? { eventId } : {})
  })
    .select("_id dataIntegrityStatus workflowStatus deduplicationFlags")
    .sort({ updatedAt: -1 })
    .limit(Math.max(1, Math.min(limit, 3000)))
    .lean();

  const results = regs.map((reg) => {
    const scored = calculateRegistrationScore(reg);
    return {
      entityId: String(reg._id),
      status: "ok",
      score: scored.score,
      reasons: scored.reasons,
      output: { priority: scored.priority }
    };
  });

  return { processed: regs.length, results };
}

async function runBySkillName(skillName, payload) {
  switch (skillName) {
    case "validation":
      return runValidationBatch(payload);
    case "deduplication":
      return runDeduplicationBatch(payload);
    case "verification":
      return prepareVerificationQueue(payload);
    case "scoring":
      return runScoringBatch(payload);
    case "productivity":
      return recalculateLeaderProductivity(payload);
    case "analytics":
      return recalculateCleanAnalytics(payload);
    case "databaseOptimization":
      return runDatabaseOptimizationSkill();
    case "uiTextQuality":
      return runUiTextQualitySkill();
    case "missingPollingPlaceReview":
      return runMissingPollingPlaceReviewSkill(payload);
    default:
      throw new Error(`Skill no soportada: ${skillName}`);
  }
}

export async function runSkillJob({
  skillName,
  organizationId,
  createdBy = "system",
  payload = {}
}) {
  const job = await SkillJob.create({
    skillName,
    organizationId,
    createdBy,
    status: "running",
    scope: payload.scope || "batch",
    payload,
    startedAt: new Date()
  });

  try {
    const output = await runBySkillName(skillName, {
      organizationId,
      ...payload
    });

    if (Array.isArray(output.results) && output.results.length > 0) {
      await SkillResult.insertMany(
        output.results.map((item) => ({
          jobId: job._id,
          skillName,
          organizationId,
          entityType: "registration",
          entityId: item.entityId,
          status: item.status || "ok",
          score: item.score ?? null,
          reasons: item.reasons || [],
          flags: item.flags || [],
          output: item.output || {}
        }))
      );
    }

    job.resultSummary = output;
    job.status = "completed";
    job.finishedAt = new Date();
    await job.save();

    return {
      jobId: job._id,
      status: job.status,
      output
    };
  } catch (error) {
    job.status = "failed";
    job.error = error.message;
    job.finishedAt = new Date();
    await job.save();
    throw error;
  }
}

export async function getSkillJob(jobId) {
  const job = await SkillJob.findById(jobId).lean();
  if (!job) return null;
  const results = await SkillResult.find({ jobId }).sort({ createdAt: -1 }).limit(200).lean();
  return { ...job, results };
}

export async function listSkillJobs({ organizationId, limit = 50 }) {
  return SkillJob.find({ ...(organizationId ? { organizationId } : {}) })
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 200)))
    .lean();
}

export default {
  runSkillJob,
  getSkillJob,
  listSkillJobs
};
