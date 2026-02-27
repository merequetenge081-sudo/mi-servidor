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
import { ValidationService } from '../../../services/validation.service.js';
import { AuditService } from '../../../services/audit.service.js';
import { ConsentLogService } from '../../../services/consentLog.service.js';
import { matchPuesto, matchLocalidad } from '../../../utils/fuzzyMatch.js';
import { Puestos } from '../../../models/index.js';
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("RegistrationService");
const repository = new RegistrationRepository();

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

      // 3. Validar datos
      const validation = ValidationService.validateRegistration({
        leaderId: leader.leaderId || leader._id?.toString(),
        eventId,
        firstName,
        lastName,
        cedula,
        registeredToVote,
        puestoId,
        mesa
      });

      if (!validation.valid) {
        throw AppError.badRequest(validation.error);
      }

      // 4. Verificar duplicado
      const duplicate = await repository.findByCedulaAndEvent(cedula, eventId);
      if (duplicate) {
        throw AppError.conflict(`Persona con cédula ${cedula} ya registrada`);
      }

      // 5. Validar puesto si está registrado para votar
      let resolvedMesa = null;
      let resolvedPuestoId = null;
      let resolvedLocalidad = localidad;

      if (registeredToVote) {
        const puesto = await repository.getPuestoById(puestoId);
        if (puesto.activo === false) {
          throw AppError.badRequest("Puesto no activo");
        }
        resolvedPuestoId = puestoId;
        resolvedMesa = Number(mesa);
        resolvedLocalidad = puesto.localidad || localidad;
      }

      // 6. Crear registro
      const registrationData = {
        leaderId: leader.leaderId || leader._id?.toString(),
        leaderName: leader.name,
        eventId,
        organizationId,
        firstName,
        lastName,
        cedula,
        email,
        phone,
        localidad: resolvedLocalidad,
        departamento,
        puestoId: resolvedPuestoId,
        mesa: resolvedMesa,
        votingPlace: votingPlace || resolvedLocalidad,
        votingTable: votingTable || resolvedMesa,
        registeredToVote,
        confirmed: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const registration = await repository.create(registrationData);

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

      const updated = await repository.update(registrationId, cleanUpdateData);

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

      await repository.delete(registrationId);

      // Decrementar contador del líder
      const leaderId = registration.leaderId;
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
      logger.info("Bulk create registrations con fuzzy matching", { count: registrationsData.length });

      if (!Array.isArray(registrationsData) || registrationsData.length === 0) {
        throw AppError.badRequest("Datos inválidos");
      }

      if (registrationsData.length > 1000) {
        throw AppError.badRequest("Máximo 1000 registros por operación");
      }

      const SIMILARITY_THRESHOLD = 0.80;
      
      // ========== STEP 1: Load ALL puestos for fuzzy matching ==========
      const allPuestos = await Puestos.find({
        organizationId,
        activo: true
      }).lean();

      logger.info(`Loaded ${allPuestos.length} active puestos for fuzzy matching`);

      // ========== STEP 2: Check duplicates ==========
      const cedulas = registrationsData.map(r => r.cedula).filter(Boolean);
      const { Registration } = await import('../../../models/index.js');
      
      const existingRegs = await Registration.find({
        cedula: { $in: cedulas },
        organizationId
      }).select('cedula').lean();

      const existingCedulasSet = new Set(existingRegs.map(r => r.cedula));

      // ========== STEP 3: Process each row with fuzzy matching ==========
      const errors = [];
      const validRegistrations = [];
      const autocorrections = [];
      let requiresReviewCount = 0;

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

        // ========== STEP 4: Fuzzy matching y autocorrección ==========
        let puestoId = null;
        let localidad = reg.localidad ? reg.localidad.toString().trim() : null;
        let votingPlace = reg.votingPlace ? reg.votingPlace.toString().trim() : null;
        let requiereRevisionPuesto = false;
        const rowCorrections = [];

        // 4.1: Autocorregir localidad si es de Bogotá
        if (localidad) {
          const localidadMatch = matchLocalidad(localidad, SIMILARITY_THRESHOLD);
          if (localidadMatch) {
            if (localidadMatch.corrected) {
              rowCorrections.push({
                field: 'localidad',
                original: localidad,
                corrected: localidadMatch.match,
                similarity: (localidadMatch.similarity * 100).toFixed(1) + '%'
              });
            }
            localidad = localidadMatch.match;
          }
        }

        // 4.2: Fuzzy matching de puesto de votación
        if (votingPlace && allPuestos.length > 0) {
          const puestoMatch = matchPuesto(votingPlace, allPuestos, SIMILARITY_THRESHOLD);
          
          if (puestoMatch) {
            puestoId = puestoMatch.puesto._id;
            localidad = puestoMatch.puesto.localidad || localidad;
            requiereRevisionPuesto = false;

            if (puestoMatch.corrected) {
              rowCorrections.push({
                field: 'votingPlace',
                original: votingPlace,
                corrected: puestoMatch.puesto.nombre,
                similarity: (puestoMatch.similarity * 100).toFixed(1) + '%'
              });
              votingPlace = puestoMatch.puesto.nombre;
            }
          } else {
            // No match - requiere revisión
            requiereRevisionPuesto = true;
            requiresReviewCount++;
          }
        } else if (votingPlace && allPuestos.length === 0) {
          requiereRevisionPuesto = true;
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
        validRegistrations.push({
          organizationId,
          leaderId: reg.leaderId || null,
          leaderName: reg.leaderName || null,
          eventId: reg.eventId || null,
          firstName: reg.firstName.toString().trim(),
          lastName: reg.lastName.toString().trim(),
          cedula: cedulaStr,
          email: reg.email.toString().trim(),
          phone: reg.phone.toString().trim(),
          votingPlace: votingPlace,
          puestoId: puestoId,
          mesa: mesa,
          localidad: localidad,
          departamento: reg.departamento ? reg.departamento.toString().trim() : null,
          capital: reg.capital ? reg.capital.toString().trim() : null,
          requiereRevisionPuesto: requiereRevisionPuesto,
          revisionPuestoResuelta: !requiereRevisionPuesto,
          registeredToVote: true,
          confirmed: false,
          createdAt: new Date(),
          updatedAt: new Date()
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
