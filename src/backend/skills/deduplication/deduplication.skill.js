import mongoose from "mongoose";
import { Registration } from "../../../models/Registration.js";
import { Leader } from "../../../models/Leader.js";
import { Puestos } from "../../../models/Puestos.js";
import { DeduplicationFlag } from "../../../models/DeduplicationFlag.js";
import { normalizePhone, normalizeTextUpper } from "../core/skill.contracts.js";

function buildFlag(flagType, severity, details) {
  return { flagType, severity, details };
}

export async function runDeduplicationSkill({
  registration,
  organizationId,
  excludeRegistrationId = null
}) {
  const flags = [];
  const queryBase = {
    organizationId,
    eventId: registration.eventId
  };

  if (registration.cedula) {
    const cedulaQuery = {
      ...queryBase,
      cedula: registration.cedula
    };

    if (excludeRegistrationId && mongoose.Types.ObjectId.isValid(excludeRegistrationId)) {
      cedulaQuery._id = { $ne: excludeRegistrationId };
    }

    const exactDuplicate = await Registration.findOne(cedulaQuery).select("_id leaderId createdAt").lean();
    if (exactDuplicate) {
      flags.push(
        buildFlag("exact_duplicate", "critical", {
          duplicatedWith: exactDuplicate._id,
          leaderId: exactDuplicate.leaderId,
          createdAt: exactDuplicate.createdAt
        })
      );
    }
  }

  const normalizedPhone = normalizePhone(registration.phone);
  if (normalizedPhone) {
    const phoneQuery = {
      ...queryBase,
      phone: { $exists: true, $ne: null }
    };
    if (excludeRegistrationId && mongoose.Types.ObjectId.isValid(excludeRegistrationId)) {
      phoneQuery._id = { $ne: excludeRegistrationId };
    }

    const samePhoneRecords = await Registration.find(phoneQuery)
      .select("_id cedula phone")
      .lean();
    const repeated = samePhoneRecords.filter((r) => normalizePhone(r.phone) === normalizedPhone);
    if (repeated.length > 0) {
      flags.push(
        buildFlag("repeated_phone", repeated.length > 1 ? "high" : "medium", {
          phone: normalizedPhone,
          count: repeated.length + 1,
          matches: repeated.map((r) => ({ id: r._id, cedula: r.cedula }))
        })
      );
    }
  }

  if (registration.firstName && registration.lastName) {
    const fn = normalizeTextUpper(registration.firstName);
    const ln = normalizeTextUpper(registration.lastName);
    const probableCandidates = await Registration.find({
      ...queryBase,
      ...(excludeRegistrationId && mongoose.Types.ObjectId.isValid(excludeRegistrationId)
        ? { _id: { $ne: excludeRegistrationId } }
        : {})
    })
      .select("_id firstName lastName cedula")
      .limit(200)
      .lean();

    const probable = probableCandidates.find((r) => {
      const cfn = normalizeTextUpper(r.firstName);
      const cln = normalizeTextUpper(r.lastName);
      return cfn === fn && cln === ln && r.cedula !== registration.cedula;
    });

    if (probable) {
      flags.push(
        buildFlag("probable_duplicate", "high", {
          duplicatedWith: probable._id,
          currentCedula: registration.cedula,
          matchedCedula: probable.cedula,
          fullName: `${registration.firstName} ${registration.lastName}`.trim()
        })
      );
    }
  }

  if (registration.leaderId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(registration.leaderId);
    const leader = await Leader.findOne({
      $or: [{ leaderId: registration.leaderId }, ...(isObjectId ? [{ _id: registration.leaderId }] : [])],
      ...(organizationId ? { organizationId } : {})
    })
      .select("_id")
      .lean();

    if (!leader) {
      flags.push(
        buildFlag("orphan_record", "high", {
          leaderId: registration.leaderId
        })
      );
    }
  }

  if (registration.puestoId && registration.localidad) {
    const puesto = await Puestos.findById(registration.puestoId).select("localidad").lean();
    if (puesto) {
      const localReg = normalizeTextUpper(registration.localidad);
      const localPuesto = normalizeTextUpper(puesto.localidad);
      if (localReg && localPuesto && localReg !== localPuesto) {
        flags.push(
          buildFlag("puesto_localidad_mismatch", "medium", {
            registrationLocalidad: registration.localidad,
            puestoLocalidad: puesto.localidad
          })
        );
      }
    }
  }

  const hasCritical = flags.some((f) => f.severity === "critical");
  const hasHigh = flags.some((f) => f.severity === "high");
  const needsReview = flags.length > 0;

  return {
    skill: "deduplication",
    flags,
    hasFlags: needsReview,
    hasCritical,
    hasHigh,
    dataIntegrityStatus: hasCritical ? "invalid" : needsReview ? "needs_review" : "valid",
    workflowStatus: hasCritical ? "duplicate" : needsReview ? "flagged" : "validated"
  };
}

export async function persistDeduplicationFlags({
  registrationId,
  organizationId,
  eventId,
  cedula,
  flags
}) {
  if (!registrationId || !Array.isArray(flags) || flags.length === 0) return;

  const operations = flags.map((flag) => ({
    updateOne: {
      filter: { registrationId, flagType: flag.flagType },
      update: {
        $set: {
          organizationId,
          eventId,
          cedula,
          severity: flag.severity,
          status: "open",
          sourceSkill: "deduplication",
          details: flag.details || {}
        }
      },
      upsert: true
    }
  }));

  await DeduplicationFlag.bulkWrite(operations, { ordered: false });
}
