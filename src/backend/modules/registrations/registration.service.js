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
      logger.info("Bulk create registrations", { count: registrationsData.length });

      if (!Array.isArray(registrationsData) || registrationsData.length === 0) {
        throw AppError.badRequest("Datos inválidos");
      }

      if (registrationsData.length > 1000) {
        throw AppError.badRequest("Máximo 1000 registros por operación");
      }

      // Enriquecer datos
      const enrichedData = registrationsData.map(reg => ({
        ...reg,
        organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
        confirmed: false
      }));

      const results = await repository.bulkCreate(enrichedData);

      // Log en audit
      await AuditService.logAction({
        action: "BULK_CREATE_REGISTRATIONS",
        userId,
        resourceType: "Registration",
        organizationId,
        description: `${results.length} registros creados en bulk`
      });

      logger.success("Bulk registrations creados", { count: results.length });
      return {
        created: results.length,
        data: results
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
      leader = await Leader.findOne({ leaderId }).lean();
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
