import { Registration } from "../../../models/Registration.js";
import { CallAttempt } from "../../../models/CallAttempt.js";
import { VerificationResult } from "../../../models/VerificationResult.js";
import { calculateRegistrationScore } from "../scoring/scoring.skill.js";

const CALLABLE_STATUSES = ["validated", "flagged", "pending_call", "retry"];

export async function prepareVerificationQueue({
  organizationId,
  eventId = null,
  limit = 200
}) {
  const query = {
    organizationId,
    ...(eventId ? { eventId } : {}),
    workflowStatus: { $in: CALLABLE_STATUSES },
    dataIntegrityStatus: { $in: ["valid", "needs_review"] }
  };

  const registrations = await Registration.find(query)
    .select("_id eventId leaderId firstName lastName phone workflowStatus dataIntegrityStatus deduplicationFlags updatedAt")
    .sort({ updatedAt: 1 })
    .limit(Math.max(1, Math.min(limit, 2000)))
    .lean();

  const enriched = registrations
    .map((reg) => ({
      ...reg,
      scoring: calculateRegistrationScore({
        dataIntegrityStatus: reg.dataIntegrityStatus,
        workflowStatus: reg.workflowStatus,
        deduplicationFlags: reg.deduplicationFlags,
        recentContact: false
      })
    }))
    .sort((a, b) => b.scoring.score - a.scoring.score);

  if (enriched.length > 0) {
    await Registration.updateMany(
      { _id: { $in: enriched.map((r) => r._id) } },
      { $set: { workflowStatus: "pending_call" } }
    );
  }

  return {
    skill: "verification",
    queued: enriched.length,
    registrations: enriched.map((reg) => ({
      id: reg._id,
      eventId: reg.eventId,
      leaderId: reg.leaderId,
      fullName: `${reg.firstName || ""} ${reg.lastName || ""}`.trim(),
      phone: reg.phone || "",
      score: reg.scoring.score,
      priority: reg.scoring.priority
    }))
  };
}

export async function registerVerificationAttempt({
  organizationId,
  eventId = null,
  registrationId,
  state,
  channel = "call",
  notes = "",
  createdBy = "system",
  confidence = 0.7
}) {
  const allowed = ["pending_call", "called", "confirmed", "rejected", "no_answer", "wrong_number", "retry"];
  if (!allowed.includes(state)) {
    throw new Error(`Verification state not supported: ${state}`);
  }

  const registration = await Registration.findById(registrationId);
  if (!registration) {
    throw new Error("Registration not found");
  }
  if (organizationId && registration.organizationId !== organizationId) {
    throw new Error("Registration organization mismatch");
  }

  await CallAttempt.create({
    organizationId: registration.organizationId,
    eventId: eventId || registration.eventId,
    registrationId,
    status: state,
    channel,
    notes,
    createdBy
  });

  await VerificationResult.create({
    organizationId: registration.organizationId,
    eventId: eventId || registration.eventId,
    registrationId,
    state,
    confidence,
    source: createdBy === "system" ? "skill" : "manual",
    reason: notes
  });

  const patch = { workflowStatus: state, updatedAt: new Date() };
  if (state === "confirmed") {
    patch.confirmed = true;
    patch.confirmedAt = new Date();
  }
  if (state === "rejected") {
    patch.confirmed = false;
    patch.dataIntegrityStatus = "invalid";
  }
  if (state === "wrong_number") {
    patch.dataIntegrityStatus = "needs_review";
  }

  await Registration.updateOne({ _id: registrationId }, { $set: patch });

  return {
    skill: "verification",
    registrationId,
    state,
    updated: true
  };
}

export default {
  prepareVerificationQueue,
  registerVerificationAttempt
};
