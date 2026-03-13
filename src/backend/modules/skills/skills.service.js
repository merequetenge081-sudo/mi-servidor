import { runSkillJob, getSkillJob, listSkillJobs } from "../../skills/jobs/skill-job.service.js";
import { Registration } from "../../../models/Registration.js";
import { DeduplicationFlag } from "../../../models/DeduplicationFlag.js";
import { SkillJob } from "../../../models/SkillJob.js";

const SUPPORTED_SKILLS = [
  "validation",
  "deduplication",
  "verification",
  "scoring",
  "analytics",
  "productivity",
  "databaseOptimization",
  "uiTextQuality",
  "missingPollingPlaceReview"
];

export async function executeSkillJob({
  skillName,
  organizationId,
  createdBy,
  payload
}) {
  if (!SUPPORTED_SKILLS.includes(skillName)) {
    throw new Error(`Skill no soportada: ${skillName}`);
  }
  return runSkillJob({ skillName, organizationId, createdBy, payload });
}

export async function getSkillJobDetail(jobId) {
  return getSkillJob(jobId);
}

export async function getSkillJobs(organizationId, limit = 50) {
  return listSkillJobs({ organizationId, limit });
}

export async function getDataHealthSnapshot({ organizationId, eventId = null }) {
  const base = {
    organizationId,
    ...(eventId ? { eventId } : {})
  };

  const [
    totalValid,
    totalInvalid,
    totalDuplicate,
    totalWithFlags,
    totalPendingCall,
    totalConfirmed,
    mismatches,
    orphanRecords,
    missingPollingPlace
  ] = await Promise.all([
    Registration.countDocuments({ ...base, dataIntegrityStatus: "valid" }),
    Registration.countDocuments({ ...base, dataIntegrityStatus: "invalid" }),
    Registration.countDocuments({ ...base, workflowStatus: "duplicate" }),
    Registration.countDocuments({
      ...base,
      deduplicationFlags: { $exists: true, $ne: [] }
    }),
    Registration.countDocuments({ ...base, workflowStatus: "pending_call" }),
    Registration.countDocuments({ ...base, workflowStatus: "confirmed" }),
    DeduplicationFlag.countDocuments({
      organizationId,
      ...(eventId ? { eventId } : {}),
      flagType: "puesto_localidad_mismatch",
      status: "open"
    }),
    DeduplicationFlag.countDocuments({
      organizationId,
      ...(eventId ? { eventId } : {}),
      flagType: "orphan_record",
      status: "open"
    }),
    Registration.countDocuments({
      ...base,
      $or: [
        { missingPollingPlace: true },
        { puestoId: null },
        { puestoId: { $exists: false } }
      ]
    })
  ]);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentImpactJobs = await SkillJob.countDocuments({
    organizationId,
    status: "completed",
    finishedAt: { $gte: oneHourAgo },
    skillName: { $in: ["validation", "deduplication", "verification"] }
  });

  const recommendations = [];
  if (totalInvalid > 0) {
    recommendations.push({
      skill: "validation",
      level: "warning",
      message: `Hay ${totalInvalid} registros inválidos. Recomendado: Revalidar.`
    });
  }
  if (totalWithFlags > 0 || totalDuplicate > 0 || mismatches > 0 || orphanRecords > 0) {
    recommendations.push({
      skill: "deduplication",
      level: "warning",
      message: "Se detectaron inconsistencias/flags. Recomendado: Deduplicar."
    });
  }
  if (totalPendingCall > 0) {
    recommendations.push({
      skill: "verification",
      level: "info",
      message: `Hay ${totalPendingCall} registros pendientes de llamada.`
    });
  }
  if (missingPollingPlace > 0) {
    recommendations.push({
      skill: "missingPollingPlaceReview",
      level: "warning",
      message: `Hay ${missingPollingPlace} registros sin puesto asignado. Recomendado: revisar y notificar líderes.`
    });
  }
  if (recentImpactJobs > 0) {
    recommendations.push({
      skill: "analytics",
      level: "info",
      message: "Hubo jobs recientes que pueden impactar KPIs. Recomendado: Actualizar métricas."
    });
  }

  return {
    totals: {
      totalValid,
      totalInvalid,
      totalDuplicate,
      totalWithFlags,
      totalPendingCall,
      totalConfirmed,
      mismatches,
      orphanRecords,
      missingPollingPlace
    },
    recommendations
  };
}

export async function listInconsistencies({
  organizationId,
  eventId = null,
  status = "open",
  flagType = null,
  limit = 100
}) {
  const query = {
    organizationId,
    ...(eventId ? { eventId } : {}),
    ...(status ? { status } : {}),
    ...(flagType ? { flagType } : {})
  };

  const flags = await DeduplicationFlag.find(query)
    .populate("registrationId", "firstName lastName cedula leaderId leaderName localidad puestoId workflowStatus")
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(limit, 500)))
    .lean();

  return flags.map((flag) => {
    const reg = flag.registrationId || {};
    return {
      id: flag._id,
      type: flag.flagType,
      severity: flag.severity,
      status: flag.status,
      registrationId: reg._id || null,
      affectedRecord: reg.cedula || flag.cedula || "-",
      fullName: `${reg.firstName || ""} ${reg.lastName || ""}`.trim() || "-",
      leader: reg.leaderName || reg.leaderId || "-",
      localidad: reg.localidad || flag.details?.registrationLocalidad || "-",
      puesto: flag.details?.puestoLocalidad || reg.puestoId || "-",
      createdAt: flag.createdAt,
      details: flag.details || {}
    };
  });
}

export function getSupportedSkills() {
  return SUPPORTED_SKILLS;
}

export default {
  executeSkillJob,
  getSkillJobDetail,
  getSkillJobs,
  getDataHealthSnapshot,
  listInconsistencies,
  getSupportedSkills
};
