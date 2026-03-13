import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import votingHierarchyService from "../services/votingHierarchy.service.js";
import officialE14CatalogService from "../services/officialE14Catalog.service.js";
import metricsCacheService from "../services/metricsCache.service.js";
import { canonicalizeBogotaLocality } from "../shared/territoryNormalization.js";

const stripLeadingCode = (value) => {
  if (!value) return "";
  const raw = value.toString();
  const withHyphen = raw.replace(/^\s*\d+\s*[-–]\s*/g, "").trim();
  if (withHyphen !== raw.trim()) return withHyphen;
  return raw.replace(/^\s*\d+\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, "").trim();
};

const resolvePuestoInput = (value) => stripLeadingCode(value);

function mapOfficialValidationFields(validation, catalogVersion = "") {
  return {
    officialValidationStatus: validation.mismatchType,
    officialValidationReason: validation.mismatchReason,
    officialValidationReviewed: false,
    officialCatalogVersion: validation.catalogVersion || catalogVersion || "",
    officialLocalidadNombre: validation.officialLocalidadNombre || "",
    officialPuestoNombre: validation.officialPuestoNombre || "",
    officialPuestoCodigo: validation.officialPuestoCodigo || "",
    officialMesaNumero: validation.officialMesaNumero ?? null,
    officialMesaValid: validation.officialMesaValid === true,
    officialPuestoValid: validation.officialPuestoValid === true,
    movedToErrorBucket: validation.isOfficiallyValid !== true,
    errorBucketReason: validation.isOfficiallyValid ? "" : validation.mismatchReason,
    officialSuggestedPuesto: validation?.suggestedCorrection?.puesto || "",
    officialSuggestedLocalidad: validation?.suggestedCorrection?.localidad || ""
  };
}

export async function bulkCreateRegistrations(req, res) {
  try {
    const { leaderId, registrations } = req.body;

    if (!Array.isArray(registrations) || registrations.length === 0) {
      return sendError(res, 400, "No se proporcionaron registros para importar.");
    }

    const leader = await Leader.findOne({ leaderId }).lean();
    if (!leader) return sendError(res, 404, "Líder no encontrado");
    if (!leader.active) return sendError(res, 403, "El líder está inactivo");

    const eventId = leader.eventId;
    if (!eventId) {
      return sendError(res, 400, "El líder no está asociado a ningún evento. Contacte al administrador.");
    }

    const cedulas = registrations.map((r) => r.cedula).filter(Boolean);
    const officialCatalog = await officialE14CatalogService.loadCatalog();
    const existingRegistrations = await Registration.find({
      cedula: { $in: cedulas },
      eventId
    }).select("cedula").lean();

    const existingCedulasSet = new Set(existingRegistrations.map((r) => r.cedula));
    const errors = [];
    const validRegistrations = [];
    const autocorrections = [];
    let requiresReviewCount = 0;

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const rowNum = i + 2;
      const missing = [];

      if (!reg.firstName || !reg.firstName.trim()) missing.push("Nombre");
      if (!reg.lastName || !reg.lastName.trim()) missing.push("Apellido");
      if (!reg.cedula || !reg.cedula.toString().trim()) missing.push("Cédula");

      if (missing.length > 0) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName || ""} ${reg.lastName || ""}`.trim() || "Desconocido",
          error: `Faltan campos requeridos: ${missing.join(", ")}`
        });
        continue;
      }

      let mesa = null;
      if (reg.votingTable !== undefined && reg.votingTable !== null) {
        mesa = Number(reg.votingTable);
        if (Number.isNaN(mesa)) {
          errors.push({
            row: rowNum,
            name: `${reg.firstName} ${reg.lastName}`,
            error: `Mesa inválida: "${reg.votingTable}" no es un número válido`
          });
          continue;
        }
      }

      const cedulaStr = reg.cedula.toString().trim();
      if (existingCedulasSet.has(cedulaStr)) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          error: `Ya existe un registro con cédula ${cedulaStr} en este evento`
        });
        continue;
      }

      let puestoId = null;
      let localidad = reg.localidad || null;
      let votingPlace = reg.votingPlace ? reg.votingPlace.trim() : null;
      const legacyVotingPlace = votingPlace || "";
      let requiereRevisionPuesto = false;
      let revisionPuestoResuelta = false;
      const rowCorrections = [];

      if (localidad) {
        const canonicalLocalidad = canonicalizeBogotaLocality(localidad);
        if (canonicalLocalidad && canonicalLocalidad !== localidad) {
          rowCorrections.push({
            field: "localidad",
            original: localidad,
            corrected: canonicalLocalidad,
            similarity: "canonico"
          });
        }
        localidad = canonicalLocalidad || localidad;
      }

      if (votingPlace) {
        const hierarchy = await votingHierarchyService.resolveHierarchyReference(
          {
            localidad,
            puesto: votingPlace,
            mesa
          },
          { organizationId: leader.organizationId || null }
        );

        if (hierarchy.puestoId) {
          puestoId = hierarchy.puestoId;
          localidad = hierarchy.localidad || localidad;
          votingPlace = hierarchy.puesto || votingPlace;
          revisionPuestoResuelta = true;

          if (votingPlace !== legacyVotingPlace) {
            rowCorrections.push({
              field: "votingPlace",
              original: legacyVotingPlace,
              corrected: votingPlace,
              similarity: "canonico"
            });
          }
        } else {
          requiereRevisionPuesto = true;
          revisionPuestoResuelta = false;
          requiresReviewCount++;
        }
      }

      if (rowCorrections.length > 0) {
        autocorrections.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          corrections: rowCorrections
        });
      }

      const baseRow = {
        leaderId: leader.leaderId,
        leaderName: leader.name,
        eventId,
        organizationId: leader.organizationId,
        firstName: reg.firstName.trim(),
        lastName: reg.lastName.trim(),
        cedula: cedulaStr,
        email: reg.email.trim(),
        phone: reg.phone.toString().trim(),
        votingPlace,
        legacyVotingPlace,
        puestoId,
        mesa,
        localidad,
        departamento: reg.departamento || null,
        capital: reg.capital || null,
        requiereRevisionPuesto,
        revisionPuestoResuelta,
        puestoMatchStatus: requiereRevisionPuesto ? "pending_review" : "matched",
        puestoMatchType: requiereRevisionPuesto ? "bulk_pending_review" : "bulk_canonical_match",
        puestoMatchConfidence: requiereRevisionPuesto ? null : 1,
        puestoMatchReviewRequired: requiereRevisionPuesto,
        puestoMatchRawName: legacyVotingPlace,
        puestoMatchSuggestedPuestoId: puestoId || null,
        puestoMatchResolvedAt: requiereRevisionPuesto ? null : new Date(),
        registeredToVote: true,
        confirmed: false,
        date: new Date()
      };

      const officialValidation = officialE14CatalogService.validateRegistrationAgainstOfficialCatalog({
        registrationId: null,
        leaderName: leader.name,
        localidad,
        puesto: votingPlace,
        mesa,
        puestoId,
        legacyVotingPlace,
        isPendingNormalization: requiereRevisionPuesto
      }, officialCatalog);

      validRegistrations.push({
        ...baseRow,
        ...mapOfficialValidationFields(officialValidation, officialCatalog.version)
      });
    }

    let insertedCount = 0;
    if (validRegistrations.length > 0) {
      const insertResult = await Registration.insertMany(validRegistrations, { ordered: false });
      insertedCount = insertResult.length;

      await Leader.updateOne({ _id: leader._id }, { $inc: { registrations: insertedCount } });
    }

    logger.info(`Bulk import completed - Leader: ${leaderId}, Imported: ${insertedCount}, Autocorrected: ${autocorrections.length}, Review: ${requiresReviewCount}, Errors: ${errors.length}`);

    return res.json({
      success: true,
      imported: insertedCount,
      requiresReview: requiresReviewCount,
      failed: errors.length,
      autocorrected: autocorrections.length,
      errors,
      autocorrections,
      message: `Importación completada: ${insertedCount} registros importados${autocorrections.length > 0 ? `, ${autocorrections.length} autocorregidos` : ""}${requiresReviewCount > 0 ? `, ${requiresReviewCount} requieren revisión de puesto` : ""}${errors.length > 0 ? `, ${errors.length} errores` : ""}.`
    });
  } catch (error) {
    logger.error("Bulk import error:", error);
    return sendError(res, 500, "Error interno al procesar importación", "BULK_IMPORT_ERROR", error.message);
  }
}

export async function verifyLeaderRegistrations(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;
    const similarityThreshold = Number(req.body?.threshold);
    const threshold = Number.isFinite(similarityThreshold)
      ? Math.max(0, Math.min(similarityThreshold, 1))
      : 0.85;

    if (!user || user.role !== "leader") {
      return sendError(res, 403, "Solo líderes pueden ejecutar esta verificación");
    }

    let leader = null;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderId);
    if (isValidObjectId) {
      leader = await Leader.findOne({
        $or: [{ leaderId }, { _id: new mongoose.Types.ObjectId(leaderId) }]
      }).lean();
    } else {
      leader = await Leader.findOne({ leaderId }).lean();
    }

    if (!leader) return sendError(res, 404, "Líder no encontrado");

    const userLeaderId = user.leaderId || user.userId || user._id;
    const leaderIdMatch =
      (leader.leaderId && leader.leaderId === userLeaderId) ||
      (leader._id && leader._id.toString() === userLeaderId);

    if (!leaderIdMatch) {
      return sendError(res, 403, "No autorizado para verificar estos registros");
    }

    if (user.organizationId && leader.organizationId && user.organizationId !== leader.organizationId) {
      return sendError(res, 403, "Organización inválida");
    }

    const registrations = await Registration.find({
      leaderId: leader.leaderId,
      eventId: leader.eventId,
      organizationId: leader.organizationId
    }).lean();

    const summary = {
      total: registrations.length,
      updated: 0,
      corrected: 0,
      requiresReview: 0,
      unchanged: 0
    };

    const corrections = [];
    const bulkOps = [];

    for (const reg of registrations) {
      const updates = {};
      const rowCorrections = [];
      let hasCorrections = false;
      let requiresReview = false;

      if (reg.firstName && (!reg.lastName || reg.lastName.trim() === "")) {
        const parts = reg.firstName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const mid = Math.ceil(parts.length / 2);
          const newFirstName = parts.slice(0, mid).join(" ");
          const newLastName = parts.slice(mid).join(" ");

          updates.firstName = newFirstName;
          updates.lastName = newLastName;

          rowCorrections.push({
            field: "name",
            original: reg.firstName,
            corrected: `${newFirstName} (Nombre) | ${newLastName} (Apellido)`,
            similarity: "100.0%"
          });
          hasCorrections = true;
        }
      }

      if (reg.localidad) {
        const canonicalLocalidad = canonicalizeBogotaLocality(reg.localidad);
        if (canonicalLocalidad && canonicalLocalidad !== reg.localidad) {
          updates.localidad = canonicalLocalidad;
          rowCorrections.push({
            field: "localidad",
            original: reg.localidad,
            corrected: canonicalLocalidad,
            similarity: "canonico"
          });
          hasCorrections = true;
        }
      }

      if (reg.votingPlace) {
        const hierarchy = await votingHierarchyService.resolveHierarchyReference(
          {
            localidad: reg.localidad,
            puesto: reg.votingPlace,
            mesa: reg.mesa ?? reg.votingTable
          },
          { organizationId: leader.organizationId || null }
        );
        if (hierarchy.puestoId) {
          const matchedName = hierarchy.puesto;
          updates.votingPlace = matchedName;
          updates.puestoId = hierarchy.puestoId;
          if (hierarchy.localidad) {
            updates.localidad = hierarchy.localidad;
          }
          updates.requiereRevisionPuesto = false;
          updates.revisionPuestoResuelta = true;

          if (String(reg.votingPlace || "").trim() !== String(matchedName || "").trim()) {
            rowCorrections.push({
              field: "votingPlace",
              original: reg.votingPlace,
              corrected: matchedName,
              similarity: "canonico"
            });
            hasCorrections = true;
          }
        } else {
          updates.requiereRevisionPuesto = true;
          updates.revisionPuestoResuelta = false;
          requiresReview = true;
        }
      }

      const keys = Object.keys(updates);
      if (keys.length === 0) {
        summary.unchanged++;
        continue;
      }

      let changed = false;
      for (const key of keys) {
        const currentValue = reg[key] ?? null;
        const nextValue = updates[key] ?? null;
        if (String(currentValue) !== String(nextValue)) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        summary.unchanged++;
        continue;
      }

      updates.updatedAt = new Date();
      bulkOps.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(reg._id.toString()) },
          update: { $set: updates }
        }
      });

      summary.updated++;
      if (hasCorrections) summary.corrected++;
      if (requiresReview) summary.requiresReview++;

      if (rowCorrections.length > 0) {
        corrections.push({
          id: reg._id,
          cedula: reg.cedula,
          corrections: rowCorrections
        });
      }
    }

    if (bulkOps.length > 0) {
      await Registration.bulkWrite(bulkOps);
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId: req.orgId || req.user?.organizationId || null,
        eventId: null,
        leaderId: req.params.leaderId || null
      });
    }

    return res.json({
      success: true,
      threshold,
      ...summary,
      corrections: corrections.slice(0, 50)
    });
  } catch (error) {
    logger.error("Error verifying leader registrations:", {
      message: error.message,
      stack: error.stack,
      leaderId: req.params.leaderId,
      threshold: req.body?.threshold
    });
    return sendError(res, 500, "Error interno al verificar registros", error.code || "VERIFY_LEADER_REGISTRATIONS_ERROR", error.message);
  }
}
