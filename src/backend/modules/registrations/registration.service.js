/**
 * Registration Service
 * Capa de lógica de negocio para registrations
 * Responsabilidades:
 * - Validaciones de reglas de negocio
 * - Orquestación de operaciones
 * - Integración con otros servicios
 */

import { RegistrationRepository } from "./registration.repository.js";
import { Leader } from "../../../models/Leader.js";
import { Registration } from "../../../models/Registration.js";
import { Puestos } from "../../../models/Puestos.js";
import { AuditService } from '../../../services/audit.service.js';
import { ConsentLogService } from '../../../services/consentLog.service.js';
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";
import {
  runValidationSkill,
  runDeduplicationSkill,
  persistDeduplicationFlags
} from "../../skills/index.js";
import votingHierarchyService from "../../../services/votingHierarchy.service.js";
import officialE14CatalogService from "../../../services/officialE14Catalog.service.js";
import puestoMatchingService from "../../../services/puestoMatching.service.js";
import { canonicalizeBogotaLocality } from "../../../shared/territoryNormalization.js";
import metricsCacheService from "../../../services/metricsCache.service.js";

const logger = createLogger("RegistrationService");
const repository = new RegistrationRepository();

async function buildOfficialValidationFields(payload, organizationId) {
  const catalog = await officialE14CatalogService.loadCatalog();
  const validation = officialE14CatalogService.validateRegistrationAgainstOfficialCatalog(payload, catalog);

  return {
    officialValidationStatus: validation.mismatchType,
    officialValidationReason: validation.mismatchReason,
    officialValidationReviewed: false,
    officialCatalogVersion: validation.catalogVersion || catalog.version || "",
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

async function resolveHierarchyForManualCorrection(payload, organizationId, currentRegistration = null) {
  try {
    return await votingHierarchyService.resolveHierarchyReference(payload, { organizationId });
  } catch (primaryError) {
    const canonicalLocalidad = canonicalizeBogotaLocality(payload.localidad) || payload.localidad || "";
    const scopedPuestos = await Puestos.find(
      {
        $or: [
          { organizationId },
          { organizationId: null },
          { organizationId: { $exists: false } }
        ],
        localidad: canonicalLocalidad,
        activo: { $ne: false }
      }
    ).lean();

    const candidates = scopedPuestos
      .map((puesto) => ({
        puesto,
        match: puestoMatchingService.scoreMatch(payload.puesto || "", puesto)
      }))
      .sort((a, b) => b.match.score - a.match.score);

    const best = candidates[0] || null;
    if (best && best.match.score >= 0.9) {
      return votingHierarchyService.resolveHierarchyReference(
        {
          localidad: canonicalLocalidad,
          puestoId: String(best.puesto._id),
          puesto: best.puesto.nombre,
          mesa: payload.mesa
        },
        { organizationId }
      );
    }

    if (currentRegistration?.puestoId) {
      return votingHierarchyService.resolveHierarchyReference(
        {
          localidad: canonicalLocalidad,
          puestoId: currentRegistration.puestoId,
          puesto: currentRegistration.votingPlace || payload.puesto,
          mesa: payload.mesa
        },
        { organizationId }
      );
    }

    throw primaryError;
  }
}

function serializeCorrectionHistoryItem(item = {}) {
  return {
    previous: item.previous || {},
    next: item.next || {},
    correctionNote: item.correctionNote || "",
    correctedBy: item.correctedBy || "",
    correctedAt: item.correctedAt || null,
    source: item.source || "manual_admin_correction"
  };
}

export class RegistrationService {
  /**
   * Crear nuevo registro
   */
  async createRegistration(input, organizationId) {
    try {
      logger.info("Crear registration", { leaderId: input.leaderId });

      const { leaderId, leaderToken, eventId, firstName, lastName, cedula, 
              email, phone, localidad, departamento, puestoId, mesa, 
              votingPlace, votingTable, registeredToVote, hasConsentToRegister } = input;

      // 1. Verificar consentimiento
      if (!hasConsentToRegister) {
        throw AppError.badRequest("Debes autorizar el registro de información");
      }

      // 2. Buscar líder
      let leader = await this._findLeader(leaderId, leaderToken);
      if (!leader) {
        throw AppError.notFound("Líder no encontrado");
      }

      if (!leader.active) {
        throw AppError.forbidden("El líder está inactivo");
      }

      // 3. Validar datos con Validation Skill
      const validation = await runValidationSkill({
        registration: {
          leaderId: leader.leaderId || leader._id?.toString(),
          eventId,
          firstName,
          lastName,
          cedula,
          phone,
          localidad,
          registeredToVote,
          puestoId,
          mesa
        },
        organizationId,
        strict: true
      });

      if (!validation.valid) {
        throw AppError.badRequest(validation.errors.join("; "));
      }

      const normalized = validation.normalized;

      // 4. Verificar duplicado exacto por cédula/evento
      const duplicate = await repository.findByCedulaAndEvent(normalized.cedula, eventId);
      if (duplicate) {
        throw AppError.conflict(`Persona con cédula ${normalized.cedula} ya registrada`);
      }

      // 5. Validar puesto si está registrado para votar
      let resolvedMesa = null;
      let resolvedPuestoId = null;
      let resolvedLocalidad = canonicalizeBogotaLocality(localidad) || localidad;
      let resolvedLocalidadId = null;
      let resolvedMesaId = null;
      let resolvedPuestoName = votingPlace || "";
      const legacyVotingPlace = votingPlace || "";

      if (registeredToVote) {
        const puesto = await repository.getPuestoById(puestoId);
        if (puesto.activo === false) {
          throw AppError.badRequest("Puesto no activo");
        }
        const hierarchy = await votingHierarchyService.resolveHierarchyReference(
          {
            localidadId: input.localidadId || null,
            localidad,
            puestoId,
            puesto: votingPlace || puesto.nombre,
            mesa
          },
          { organizationId }
        );
        resolvedPuestoId = hierarchy.puestoId;
        resolvedMesa = hierarchy.mesa;
        resolvedLocalidad = hierarchy.localidad || canonicalizeBogotaLocality(puesto.localidad || localidad) || puesto.localidad || localidad;
        resolvedLocalidadId = hierarchy.localidadId || null;
        resolvedMesaId = hierarchy.mesaId || null;
        resolvedPuestoName = hierarchy.puesto || puesto.nombre || votingPlace || "";
      }

      // 6. Crear registro
      const registrationData = {
        leaderId: leader.leaderId || leader._id?.toString(),
        leaderName: leader.name,
        eventId,
        organizationId,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        cedula: normalized.cedula,
        email,
        phone: normalized.phone,
        localidad: resolvedLocalidad,
        localidadId: resolvedLocalidadId,
        departamento,
        puestoId: resolvedPuestoId,
        mesa: resolvedMesa,
        mesaId: resolvedMesaId,
        votingPlace: resolvedPuestoName || votingPlace || "",
        legacyVotingPlace: legacyVotingPlace && legacyVotingPlace !== (resolvedPuestoName || votingPlace || "") ? legacyVotingPlace : "",
        votingTable: votingTable || resolvedMesa,
        puestoMatchStatus: registeredToVote && resolvedPuestoId ? "matched" : "not_applicable",
        puestoMatchType: registeredToVote && resolvedPuestoId ? "form_canonical_match" : "",
        puestoMatchConfidence: registeredToVote && resolvedPuestoId ? 1 : null,
        puestoMatchReviewRequired: false,
        puestoMatchRawName: legacyVotingPlace || "",
        puestoMatchSuggestedPuestoId: resolvedPuestoId || null,
        puestoMatchSuggestedLocalidadId: resolvedLocalidadId || null,
        puestoMatchResolvedAt: registeredToVote && resolvedPuestoId ? new Date() : null,
        registeredToVote,
        dataIntegrityStatus: validation.dataIntegrityStatus,
        workflowStatus: validation.workflowStatus,
        validationErrors: [...validation.errors, ...validation.warnings],
        deduplicationFlags: [],
        confirmed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      Object.assign(
        registrationData,
        await buildOfficialValidationFields({
          registrationId: null,
          leaderName: leader.name,
          localidad: registrationData.localidad,
          puesto: registrationData.votingPlace,
          mesa: registrationData.mesa,
          puestoId: registrationData.puestoId,
          legacyVotingPlace: registrationData.legacyVotingPlace,
          isPendingNormalization: registrationData.puestoMatchReviewRequired === true
        }, organizationId)
      );

      const dedup = await runDeduplicationSkill({
        registration: registrationData,
        organizationId
      });

      const hasExactDuplicate = dedup.flags.some((flag) => flag.flagType === "exact_duplicate");
      if (hasExactDuplicate) {
        throw AppError.conflict(`Persona con cédula ${normalized.cedula} ya registrada`);
      }

      registrationData.dataIntegrityStatus =
        validation.dataIntegrityStatus === "invalid"
          ? "invalid"
          : dedup.dataIntegrityStatus === "invalid" || validation.needsReview || dedup.hasFlags
            ? "needs_review"
            : "valid";
      registrationData.workflowStatus =
        validation.dataIntegrityStatus === "invalid"
          ? "invalid"
          : dedup.workflowStatus === "duplicate"
            ? "duplicate"
            : validation.needsReview || dedup.hasFlags
              ? "flagged"
              : "validated";
      registrationData.deduplicationFlags = dedup.flags.map((flag) => flag.flagType);

      const registration = await repository.create(registrationData);
      votingHierarchyService.clearCaches();
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId,
        eventId,
        leaderId: registrationData.leaderId
      });

      if (dedup.flags.length > 0) {
        await persistDeduplicationFlags({
          registrationId: registration._id,
          organizationId,
          eventId,
          cedula: normalized.cedula,
          flags: dedup.flags
        });
      }

      // 7. Registrar en audit
      await AuditService.logAction({
        action: "CREATE_REGISTRATION",
        userId: input.userId,
        resourceType: "Registration",
        resourceId: registration._id,
        organizationId,
        description: `Registro creado: ${firstName} ${lastName}`
      });

      // 8. Registrar consentimiento
      await ConsentLogService.logConsent({
        registrationId: registration._id,
        type: "REGISTRATION",
        consented: true,
        ip: input.ip,
        userAgent: input.userAgent
      });

      // 9. Incrementar contador del líder
      await Leader.updateOne({ _id: leader._id }, { $inc: { registrations: 1 } });

      logger.success("Registration creada", { registrationId: registration._id });
      return registration;
    } catch (error) {
      logger.error("Error crear registration", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error creando registro");
    }
  }

  /**
   * Obtener registrations con filtros
   */
  async getRegistrations(filter, options, organizationId) {
    try {
      logger.info("Obtener registrations", { organizationId });

      const finalFilter = { organizationId, ...filter };
      const result = await repository.findMany(finalFilter, options);

      return result;
    } catch (error) {
      logger.error("Error obtener registrations", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo registrations");
    }
  }

  /**
   * Obtener un registro por ID
   */
  async getRegistration(registrationId, organizationId) {
    try {
      logger.info("Obtener registration", { registrationId });

      const registration = await repository.findById(registrationId);

      // Verificar que pertenece a la organización
      if (registration.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      return registration;
    } catch (error) {
      logger.error("Error obtener registration", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo registro");
    }
  }

  /**
   * Actualizar registro
   */
  async updateRegistration(registrationId, updateData, organizationId) {
    try {
      logger.info("Actualizar registration", { registrationId });

      // Verificar que existe y pertenece a la org
      const registration = await repository.findById(registrationId);
      if (registration.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      // No permitir actualizar ciertos campos
      const protectedFields = ['leaderId', 'eventId', 'organizationId', 'cedula', 'createdAt'];
      const cleanUpdateData = { ...updateData };
      protectedFields.forEach(field => delete cleanUpdateData[field]);

      const geographyChanged =
        updateData.localidad !== undefined
        || updateData.puestoId !== undefined
        || updateData.votingPlace !== undefined
        || updateData.mesa !== undefined
        || updateData.votingTable !== undefined;

      if (geographyChanged && (updateData.puestoId || registration.puestoId)) {
        const hierarchy = await votingHierarchyService.resolveHierarchyReference(
          {
            localidadId: updateData.localidadId || registration.localidadId || null,
            localidad: updateData.localidad || registration.localidad || "",
            puestoId: updateData.puestoId || registration.puestoId || null,
            puesto: updateData.votingPlace || registration.votingPlace || "",
            mesa: updateData.mesa ?? updateData.votingTable ?? registration.mesa ?? registration.votingTable
          },
          { organizationId }
        );

        cleanUpdateData.localidad = hierarchy.localidad;
        cleanUpdateData.localidadId = hierarchy.localidadId;
        cleanUpdateData.puestoId = hierarchy.puestoId;
        cleanUpdateData.mesa = hierarchy.mesa;
        cleanUpdateData.mesaId = hierarchy.mesaId;
        cleanUpdateData.legacyVotingPlace =
          updateData.votingPlace
          && updateData.votingPlace !== hierarchy.puesto
            ? updateData.votingPlace
            : registration.legacyVotingPlace || "";
        cleanUpdateData.votingPlace = hierarchy.puesto;
        cleanUpdateData.votingTable = hierarchy.mesa !== null ? String(hierarchy.mesa) : "";
        cleanUpdateData.puestoMatchStatus = hierarchy.puestoId ? "matched" : registration.puestoMatchStatus || "not_applicable";
        cleanUpdateData.puestoMatchType = hierarchy.puestoId ? "form_update_canonical_match" : registration.puestoMatchType || "";
        cleanUpdateData.puestoMatchConfidence = hierarchy.puestoId ? 1 : registration.puestoMatchConfidence ?? null;
        cleanUpdateData.puestoMatchReviewRequired = false;
        cleanUpdateData.puestoMatchRawName = updateData.votingPlace || registration.puestoMatchRawName || registration.votingPlace || "";
        cleanUpdateData.puestoMatchSuggestedPuestoId = hierarchy.puestoId || null;
        cleanUpdateData.puestoMatchSuggestedLocalidadId = hierarchy.localidadId || null;
        cleanUpdateData.puestoMatchResolvedAt = hierarchy.puestoId ? new Date() : registration.puestoMatchResolvedAt || null;
      } else if (updateData.localidad !== undefined) {
        cleanUpdateData.localidad = canonicalizeBogotaLocality(updateData.localidad) || updateData.localidad;
      }

      // Si el registro requería revisión de puesto y se actualizaron campos relacionados,
      // marcar como resuelta la revisión
      if (registration.requiereRevisionPuesto && !registration.revisionPuestoResuelta) {
        const camposRelevantesActualizados = 
          updateData.votingPlace !== undefined || 
          updateData.localidad !== undefined || 
          updateData.puestoId !== undefined ||
          updateData.votingTable !== undefined;

        if (camposRelevantesActualizados) {
          cleanUpdateData.revisionPuestoResuelta = true;
          logger.info(`[UpdateRegistration] Marcando revisión de puesto como resuelta para registro ${registrationId}`);
        }
      }

      Object.assign(
        cleanUpdateData,
        await buildOfficialValidationFields({
          registrationId,
          leaderName: registration.leaderName || "",
          localidad: cleanUpdateData.localidad ?? registration.localidad,
          puesto: cleanUpdateData.votingPlace ?? registration.votingPlace,
          mesa: cleanUpdateData.mesa ?? registration.mesa,
          puestoId: cleanUpdateData.puestoId ?? registration.puestoId,
          legacyVotingPlace: cleanUpdateData.legacyVotingPlace ?? registration.legacyVotingPlace,
          isPendingNormalization: cleanUpdateData.puestoMatchReviewRequired ?? registration.puestoMatchReviewRequired
        }, organizationId)
      );

      const updated = await repository.update(registrationId, cleanUpdateData);
      votingHierarchyService.clearCaches();
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId,
        eventId: registration.eventId,
        leaderId: registration.leaderId
      });

      logger.success("Registration actualizada", { registrationId });
      return updated;
    } catch (error) {
      logger.error("Error actualizar registration", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error actualizando registro");
    }
  }

  /**
   * Eliminar registro
   */
  async deleteRegistration(registrationId, organizationId) {
    try {
      logger.info("Eliminar registration", { registrationId });

      // Verificar que existe y pertenece a la org
      const registration = await repository.findById(registrationId);
      if (registration.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      const leaderId = registration.leaderId;
      await repository.delete(registrationId);
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId,
        eventId: registration.eventId,
        leaderId
      });

      // Decrementar contador del líder
      if (leaderId) {
        const { default: mongoose } = await import('mongoose');
        const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderId);
        await Leader.updateOne(
          { $or: [{ leaderId: leaderId }, ...(isValidObjectId ? [{ _id: leaderId }] : [])] },
          { $inc: { registrations: -1 } }
        );
      }

      logger.success("Registration eliminada", { registrationId });
    } catch (error) {
      logger.error("Error eliminar registration", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error eliminando registro");
    }
  }

  /**
   * Confirmar registro (marcar asistencia)
   */
  async confirmRegistration(registrationId, organizationId) {
    try {
      logger.info("Confirmar registration", { registrationId });

      const registration = await repository.findById(registrationId);
      if (registration.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      const updated = await repository.updateConfirmationStatus(registrationId, true);
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId,
        eventId: registration.eventId,
        leaderId: registration.leaderId
      });

      logger.success("Registration confirmada", { registrationId });
      return updated;
    } catch (error) {
      logger.error("Error confirmar registration", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error confirmando registro");
    }
  }

  /**
   * Desconfirmar registro
   */
  async unconfirmRegistration(registrationId, organizationId) {
    try {
      logger.info("Desconfirmar registration", { registrationId });

      const registration = await repository.findById(registrationId);
      if (registration.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      const updated = await repository.updateConfirmationStatus(registrationId, false);
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId,
        eventId: registration.eventId,
        leaderId: registration.leaderId
      });

      logger.success("Registration desconfirmada", { registrationId });
      return updated;
    } catch (error) {
      logger.error("Error desconfirmar registration", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error desconfirmando registro");
    }
  }

  /**
   * Obtener registrations de un líder
   */
  async getRegistrationsByLeader(leaderId, options, organizationId) {
    try {
      logger.info("Obtener registrations por líder", { leaderId });

      const result = await repository.findByLeaderId(leaderId, options);

      // Filtrar solo de esta organización
      result.data = result.data.filter(reg => reg.organizationId === organizationId);
      result.total = result.data.length;

      return result;
    } catch (error) {
      logger.error("Error obtener registrations por líder", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo registrations");
    }
  }

  /**
   * Crear múltiples registrations en bulk
   */
  async bulkCreateRegistrations(registrationsData, organizationId, userId) {
    try {
      logger.info("Bulk create registrations con resolucion canonica de puestos", { count: registrationsData.length });

      if (!Array.isArray(registrationsData) || registrationsData.length === 0) {
        throw AppError.badRequest("Datos inválidos");
      }

      if (registrationsData.length > 1000) {
        throw AppError.badRequest("Máximo 1000 registros por operación");
      }

      // ========== STEP 1: Check duplicates ==========
      const cedulas = registrationsData.map(r => r.cedula).filter(Boolean);
      const { Registration } = await import('../../../models/index.js');
      
      const existingRegs = await Registration.find({
        cedula: { $in: cedulas },
        organizationId
      }).select('cedula').lean();

      const existingCedulasSet = new Set(existingRegs.map(r => r.cedula));

      // ========== STEP 2: Process each row with canonical hierarchy resolution ==========
      const errors = [];
      const validRegistrations = [];
      const autocorrections = [];
      let requiresReviewCount = 0;
      const officialCatalog = await officialE14CatalogService.loadCatalog();

      for (let i = 0; i < registrationsData.length; i++) {
        const reg = registrationsData[i];
        const rowNum = i + 2; // Excel row (assuming row 1 is headers)

        // Validación de campos requeridos
        const missing = [];
        if (!reg.firstName || !reg.firstName.toString().trim()) missing.push("Nombre");
        if (!reg.lastName || !reg.lastName.toString().trim()) missing.push("Apellido");
        if (!reg.cedula || !reg.cedula.toString().trim()) missing.push("Cédula");
        // Email y Celular son opcionales
        // if (!reg.phone || !reg.phone.toString().trim()) missing.push("Celular");

        if (missing.length > 0) {
          errors.push({
            row: rowNum,
            name: `${reg.firstName || ''} ${reg.lastName || ''}`.trim() || 'Desconocido',
            error: `Faltan campos requeridos: ${missing.join(', ')}`
          });
          continue;
        }

        // Validar mesa
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

        // Check duplicates
        const cedulaStr = reg.cedula.toString().trim();
        if (existingCedulasSet.has(cedulaStr)) {
          errors.push({
            row: rowNum,
            name: `${reg.firstName} ${reg.lastName}`,
            error: `Ya existe un registro con cédula ${cedulaStr}`
          });
          continue;
        }
        existingCedulasSet.add(cedulaStr);

        // ========== STEP 3: Canonical hierarchy resolution ==========
        let puestoId = null;
        let localidad = reg.localidad ? reg.localidad.toString().trim() : null;
        let votingPlace = reg.votingPlace ? reg.votingPlace.toString().trim() : null;
        let legacyVotingPlace = votingPlace || "";
        let requiereRevisionPuesto = false;
        const rowCorrections = [];

        if (localidad) {
          const canonicalLocalidad = canonicalizeBogotaLocality(localidad);
          if (canonicalLocalidad && canonicalLocalidad !== localidad) {
            rowCorrections.push({
              field: 'localidad',
              original: localidad,
              corrected: canonicalLocalidad,
              similarity: 'canonico'
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
            { organizationId }
          );

          if (hierarchy.puestoId) {
            puestoId = hierarchy.puestoId;
            if (hierarchy.localidad && hierarchy.localidad !== localidad) {
              rowCorrections.push({
                field: 'localidad',
                original: localidad,
                corrected: hierarchy.localidad,
                similarity: 'canonico'
              });
            }
            if (hierarchy.puesto && hierarchy.puesto !== votingPlace) {
              rowCorrections.push({
                field: 'votingPlace',
                original: votingPlace,
                corrected: hierarchy.puesto,
                similarity: 'canonico'
              });
            }
            localidad = hierarchy.localidad || localidad;
            votingPlace = hierarchy.puesto || votingPlace;
          } else {
            requiereRevisionPuesto = true;
          }
        }

        if (requiereRevisionPuesto) {
          requiresReviewCount++;
        }

        // Registrar autocorrecciones
        if (rowCorrections.length > 0) {
          autocorrections.push({
            row: rowNum,
            name: `${reg.firstName} ${reg.lastName}`,
            corrections: rowCorrections
          });
        }

        // Agregar a validRegistrations
        const baseRow = {
          organizationId,
          leaderId: reg.leaderId || null,
          leaderName: reg.leaderName || null,
          eventId: reg.eventId || null,
          firstName: reg.firstName.toString().trim(),
          lastName: reg.lastName.toString().trim(),
          cedula: cedulaStr,
          email: reg.email ? reg.email.toString().trim() : "",
          phone: reg.phone ? reg.phone.toString().trim() : "",
          votingPlace: votingPlace,
          legacyVotingPlace,
          puestoId: puestoId,
          mesa: mesa,
          localidad: localidad,
          departamento: reg.departamento ? reg.departamento.toString().trim() : null,
          capital: reg.capital ? reg.capital.toString().trim() : null,
          requiereRevisionPuesto: requiereRevisionPuesto,
          revisionPuestoResuelta: !requiereRevisionPuesto,
          puestoMatchStatus: requiereRevisionPuesto ? "pending_review" : "matched",
          puestoMatchType: requiereRevisionPuesto ? "bulk_pending_review" : "bulk_canonical_match",
          puestoMatchConfidence: requiereRevisionPuesto ? null : 1,
          puestoMatchReviewRequired: requiereRevisionPuesto,
          puestoMatchRawName: legacyVotingPlace,
          puestoMatchSuggestedPuestoId: puestoId || null,
          puestoMatchResolvedAt: requiereRevisionPuesto ? null : new Date(),
          registeredToVote: true,
          dataIntegrityStatus: requiereRevisionPuesto ? "needs_review" : "valid",
          workflowStatus: requiereRevisionPuesto ? "flagged" : "validated",
          validationErrors: requiereRevisionPuesto ? ["Requiere revision de puesto"] : [],
          deduplicationFlags: [],
          confirmed: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const officialValidation = officialE14CatalogService.validateRegistrationAgainstOfficialCatalog({
          registrationId: null,
          leaderName: reg.leaderName || "",
          localidad,
          puesto: votingPlace,
          mesa,
          puestoId,
          legacyVotingPlace,
          isPendingNormalization: requiereRevisionPuesto
        }, officialCatalog);

        validRegistrations.push({
          ...baseRow,
          officialValidationStatus: officialValidation.mismatchType,
          officialValidationReason: officialValidation.mismatchReason,
          officialValidationReviewed: false,
          officialCatalogVersion: officialValidation.catalogVersion || officialCatalog.version || "",
          officialLocalidadNombre: officialValidation.officialLocalidadNombre || "",
          officialPuestoNombre: officialValidation.officialPuestoNombre || "",
          officialPuestoCodigo: officialValidation.officialPuestoCodigo || "",
          officialMesaNumero: officialValidation.officialMesaNumero ?? null,
          officialMesaValid: officialValidation.officialMesaValid === true,
          officialPuestoValid: officialValidation.officialPuestoValid === true,
          movedToErrorBucket: officialValidation.isOfficiallyValid !== true,
          errorBucketReason: officialValidation.isOfficiallyValid ? "" : officialValidation.mismatchReason,
          officialSuggestedPuesto: officialValidation?.suggestedCorrection?.puesto || "",
          officialSuggestedLocalidad: officialValidation?.suggestedCorrection?.localidad || ""
        });
      }

      // ========== STEP 5: Bulk insert ==========
      let insertedCount = 0;
      if (validRegistrations.length > 0) {
        await repository.bulkCreate(validRegistrations);
        insertedCount = validRegistrations.length;

        // Update leader counts if leaderId is present
        const leaderCounts = {};
        for (const reg of validRegistrations) {
          if (reg.leaderId) {
            leaderCounts[reg.leaderId] = (leaderCounts[reg.leaderId] || 0) + 1;
          }
        }

        for (const [leaderId, count] of Object.entries(leaderCounts)) {
          const { default: mongoose } = await import('mongoose');
          const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderId);
          await Leader.updateOne(
            { $or: [{ leaderId: leaderId }, ...(isValidObjectId ? [{ _id: leaderId }] : [])] },
            { $inc: { registrations: count } }
          );
        }
      }

      // ========== STEP 6: Log audit ==========
      await AuditService.logAction({
        action: "BULK_CREATE_REGISTRATIONS",
        userId,
        resourceType: "Registration",
        organizationId,
        description: `${insertedCount} registros creados, ${autocorrections.length} autocorregidos, ${requiresReviewCount} requieren revisión`
      });

      logger.info(`Bulk import completed - Imported: ${insertedCount}, Autocorrected: ${autocorrections.length}, Review: ${requiresReviewCount}, Errors: ${errors.length}`);
      await metricsCacheService.invalidateMetricsForRegistrationScope({
        organizationId,
        eventId: null,
        leaderId: null
      });

      return {
        success: true,
        created: insertedCount,
        requiresReview: requiresReviewCount,
        failed: errors.length,
        autocorrected: autocorrections.length,
        errors: errors,
        autocorrections: autocorrections,
        message: `Importación completada: ${insertedCount} registros importados${autocorrections.length > 0 ? `, ${autocorrections.length} autocorregidos` : ''}${requiresReviewCount > 0 ? `, ${requiresReviewCount} requieren revisión` : ''}${errors.length > 0 ? `, ${errors.length} errores` : ''}.`
      };
    } catch (error) {
      logger.error("Error bulk create", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error en bulk create");
    }
  }

  async getOfficialCorrectionCatalog(localidad = "", organizationId = null) {
    const selectors = await officialE14CatalogService.getCatalogSelectors();
    const puestos = localidad
      ? await officialE14CatalogService.getPuestosByLocalidad(localidad)
      : [];

    return {
      catalogVersion: selectors.catalogVersion,
      localidades: selectors.localidades,
      puestos
    };
  }

  async previewOfficialCorrection(registrationId, payload, organizationId) {
    const registration = await repository.findById(registrationId);
    if (registration.organizationId !== organizationId) {
      throw AppError.forbidden("No autorizado");
    }

    const selectedLocalidad = canonicalizeBogotaLocality(payload.localidad) || payload.localidad || "";
    const selectedPuesto = String(payload.puesto || "").trim();
    const selectedMesa = payload.mesa === "" || payload.mesa === undefined || payload.mesa === null
      ? null
      : Number.parseInt(String(payload.mesa), 10);

    const catalog = await officialE14CatalogService.loadCatalog();
    const selectorMesas = selectedLocalidad && selectedPuesto
      ? await officialE14CatalogService.getMesasByPuesto(selectedLocalidad, selectedPuesto, { catalog })
      : [];

    let hierarchy = null;
    let hierarchyError = "";
    try {
      hierarchy = await resolveHierarchyForManualCorrection(
        {
          localidad: selectedLocalidad,
          puesto: selectedPuesto,
          mesa: selectedMesa
        },
        organizationId,
        registration
      );
    } catch (error) {
      hierarchyError = error.message;
    }

    const validation = officialE14CatalogService.validateRegistrationAgainstOfficialCatalog({
      registrationId,
      leaderName: registration.leaderName || "",
      localidad: selectedLocalidad,
      puesto: selectedPuesto,
      mesa: selectedMesa,
      puestoId: hierarchy?.puestoId || registration.puestoId || null,
      legacyVotingPlace: registration.legacyVotingPlace || registration.votingPlace || "",
      isPendingNormalization: false
    }, catalog);

    return {
      registrationId,
      current: {
        localidad: registration.localidad || "",
        puesto: registration.votingPlace || "",
        mesa: registration.mesa ?? null,
        officialValidationStatus: registration.officialValidationStatus || "",
        officialValidationReason: registration.officialValidationReason || ""
      },
      proposal: {
        localidad: selectedLocalidad,
        puesto: selectedPuesto,
        mesa: selectedMesa,
        hierarchyResolved: Boolean(hierarchy),
        hierarchyError,
        availableMesas: selectorMesas,
        resolvedHierarchy: hierarchy
      },
      validation: {
        status: validation.mismatchType,
        reason: validation.mismatchReason,
        isOfficialValid: validation.isOfficiallyValid === true,
        officialPuestoNombre: validation.officialPuestoNombre || "",
        officialLocalidadNombre: validation.officialLocalidadNombre || "",
        officialPuestoCodigo: validation.officialPuestoCodigo || "",
        mesaExistsInOfficialPuesto: validation.officialMesaValid === true,
        puestoExistsInOfficialCatalog: validation.officialPuestoValid === true,
        suggestion: validation.suggestedCorrection || null
      }
    };
  }

  async applyOfficialCorrection(registrationId, payload, organizationId, correctedBy = "admin") {
    const registration = await repository.findById(registrationId);
    if (registration.organizationId !== organizationId) {
      throw AppError.forbidden("No autorizado");
    }

    const preview = await this.previewOfficialCorrection(registrationId, payload, organizationId);
    const selectedLocalidad = preview.proposal.localidad;
    const selectedPuesto = preview.proposal.puesto;
    const selectedMesa = preview.proposal.mesa;
    if (!preview.proposal.hierarchyResolved) {
      throw AppError.badRequest(preview.proposal.hierarchyError || "La combinación seleccionada no pudo resolverse en la jerarquía interna");
    }
    const hierarchy = preview.proposal.resolvedHierarchy
      || await resolveHierarchyForManualCorrection(
        {
          localidad: selectedLocalidad,
          puesto: selectedPuesto,
          mesa: selectedMesa
        },
        organizationId,
        registration
      );
    const canonicalLocalidad = hierarchy?.localidad || selectedLocalidad;
    const canonicalPuesto = hierarchy?.puesto || selectedPuesto;
    const canonicalMesa = hierarchy?.mesa ?? selectedMesa;

    const previousSnapshot = {
      localidad: registration.localidad || "",
      localidadId: registration.localidadId || null,
      puesto: registration.votingPlace || "",
      puestoId: registration.puestoId || null,
      mesa: registration.mesa ?? null,
      mesaId: registration.mesaId || null,
      officialValidationStatus: registration.officialValidationStatus || "",
      officialValidationReason: registration.officialValidationReason || ""
    };

    const updateData = {
      localidad: canonicalLocalidad,
      localidadId: hierarchy?.localidadId || registration.localidadId || null,
      puestoId: hierarchy?.puestoId || registration.puestoId || null,
      mesa: canonicalMesa,
      mesaId: hierarchy?.mesaId || null,
      votingPlace: canonicalPuesto,
      votingTable: canonicalMesa !== null && canonicalMesa !== undefined ? String(canonicalMesa) : "",
      legacyVotingPlace: registration.legacyVotingPlace || registration.votingPlace || "",
      puestoMatchStatus: hierarchy?.puestoId ? "matched" : registration.puestoMatchStatus || "pending_review",
      puestoMatchType: hierarchy?.puestoId ? "manual_admin_correction" : registration.puestoMatchType || "",
      puestoMatchConfidence: hierarchy?.puestoId ? 1 : registration.puestoMatchConfidence ?? null,
      puestoMatchReviewRequired: preview.validation.isOfficialValid !== true,
      puestoMatchRawName: registration.puestoMatchRawName || registration.legacyVotingPlace || registration.votingPlace || "",
      puestoMatchSuggestedPuestoId: hierarchy?.puestoId || null,
      puestoMatchSuggestedLocalidadId: hierarchy?.localidadId || null,
      puestoMatchResolvedAt: new Date(),
      officialValidationReviewed: true,
      updatedAt: new Date()
    };

    Object.assign(updateData, await buildOfficialValidationFields({
      registrationId,
      leaderName: registration.leaderName || "",
      localidad: canonicalLocalidad,
      puesto: canonicalPuesto,
      mesa: canonicalMesa,
      puestoId: hierarchy?.puestoId || registration.puestoId || null,
      legacyVotingPlace: registration.legacyVotingPlace || registration.votingPlace || "",
      isPendingNormalization: false
    }, organizationId));
    updateData.officialValidationReviewed = true;

    const nextSnapshot = {
      localidad: updateData.localidad || "",
      localidadId: updateData.localidadId || null,
      puesto: updateData.votingPlace || "",
      puestoId: updateData.puestoId || null,
      mesa: updateData.mesa ?? null,
      mesaId: updateData.mesaId || null,
      officialValidationStatus: updateData.officialValidationStatus || "",
      officialValidationReason: updateData.officialValidationReason || ""
    };

    const correctionEntry = {
      previous: previousSnapshot,
      next: nextSnapshot,
      correctionNote: String(payload.correctionNote || "").trim(),
      correctedBy,
      correctedAt: new Date(),
      source: "manual_admin_correction"
    };

    const updated = await Registration.findOneAndUpdate(
      {
        _id: registrationId,
        organizationId
      },
      {
        $set: updateData,
        $push: { correctionHistory: correctionEntry }
      },
      { new: true, runValidators: true }
    ).lean();

    votingHierarchyService.clearCaches();
    await metricsCacheService.invalidateMetricsForRegistrationScope({
      organizationId,
      eventId: registration.eventId,
      leaderId: registration.leaderId
    });

    await AuditService.logAction({
      action: "MANUAL_OFFICIAL_CORRECTION",
      userId: correctedBy,
      resourceType: "Registration",
      resourceId: registrationId,
      organizationId,
      description: `Correccion manual aplicada a registro ${registrationId}`
    });

    return {
      registrationId,
      updated,
      preview: {
        status: updateData.officialValidationStatus,
        reason: updateData.officialValidationReason,
        movedToOfficial: updateData.officialValidationStatus === "official_valid"
      }
    };
  }

  async getCorrectionHistory(registrationId, organizationId) {
    const registration = await repository.findById(registrationId);
    if (registration.organizationId !== organizationId) {
      throw AppError.forbidden("No autorizado");
    }

    return (registration.correctionHistory || [])
      .map(serializeCorrectionHistoryItem)
      .sort((a, b) => new Date(b.correctedAt || 0).getTime() - new Date(a.correctedAt || 0).getTime());
  }

  /**
   * Helper: Buscar líder por ID o token
   * @private
   */
  async _findLeader(leaderId, leaderToken) {
    let leader = null;

    if (leaderId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(leaderId);
      if (isObjectId) {
        leader = await Leader.findOne({ $or: [{ leaderId }, { _id: leaderId }] }).lean();
      } else {
        leader = await Leader.findOne({ leaderId }).lean();
      }
    }

    if (!leader && leaderToken) {
      leader = await Leader.findOne({
        $or: [{ token: leaderToken }, { leaderId: leaderToken }]
      }).lean();
    }

    return leader;
  }
}

export default RegistrationService;
