/**
 * Registration Controller
 * Capa de HTTP - endpoints de registrations
 * Responsabilidades:
 * - Validar input básica de request
 * - Extraer contexto (user, org, etc)
 * - Delegar a service
 * - Formatear respuestas HTTP
 */

import { RegistrationService } from "./registration.service.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("RegistrationController");
const service = new RegistrationService();

export class RegistrationController {
  /**
   * POST /registrations
   * Crear nuevo registro
   */
  async createRegistration(req, res, next) {
    try {
      logger.info("POST createRegistration", { leaderId: req.body.leaderId });

      const { leaderId, leaderToken, eventId, firstName, lastName, cedula, 
              email, phone, localidad, departamento, puestoId, mesa, 
              votingPlace, votingTable, registeredToVote, hasConsentToRegister } = req.body;

      // Validación básica
      if (!firstName || !lastName || !cedula) {
        throw AppError.badRequest("firstName, lastName y cedula son requeridos");
      }

      if (!eventId && !leaderToken && !leaderId) {
        throw AppError.badRequest("eventId, leaderToken o leaderId requerido");
      }

      const registrationData = {
        leaderId,
        leaderToken,
        eventId,
        firstName,
        lastName,
        cedula,
        email,
        phone,
        localidad,
        departamento,
        puestoId,
        mesa,
        votingPlace,
        votingTable,
        registeredToVote: registeredToVote === true,
        hasConsentToRegister,
        userId: req.user?._id,
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      const registration = await service.createRegistration(registrationData, req.orgId);

      res.status(201).json({
        success: true,
        message: "Registro creado exitosamente",
        data: registration
      });
    } catch (error) {
      logger.error("Error createRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /registrations
   * Obtener registrations con filtros
   */
  async getRegistrations(req, res, next) {
    try {
      logger.info("GET getRegistrations", { orgId: req.orgId });

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);

      // Filtros
      const filter = {};
      if (req.query.leaderId) filter.leaderId = req.query.leaderId;
      if (req.query.eventId) filter.eventId = req.query.eventId;
      if (req.query.confirmed !== undefined) filter.confirmed = req.query.confirmed === 'true';
      if (req.query.cedula) filter.cedula = req.query.cedula;

      const result = await service.getRegistrations(filter, { page, pageSize }, req.orgId);

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page,
          pageSize,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      logger.error("Error getRegistrations", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /registrations/:id
   * Obtener un registro
   */
  async getRegistration(req, res, next) {
    try {
      logger.info("GET getRegistration", { registrationId: req.params.id });

      const registration = await service.getRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        data: registration
      });
    } catch (error) {
      logger.error("Error getRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * PUT /registrations/:id
   * Actualizar registro
   */
  async updateRegistration(req, res, next) {
    try {
      logger.info("PUT updateRegistration", { registrationId: req.params.id });

      const updateData = req.body;

      const registration = await service.updateRegistration(req.params.id, updateData, req.orgId);

      res.json({
        success: true,
        message: "Registro actualizado",
        data: registration
      });
    } catch (error) {
      logger.error("Error updateRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * DELETE /registrations/:id
   * Eliminar registro
   */
  async deleteRegistration(req, res, next) {
    try {
      logger.info("DELETE deleteRegistration", { registrationId: req.params.id });

      await service.deleteRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        message: "Registro eliminado"
      });
    } catch (error) {
      logger.error("Error deleteRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/:id/confirm
   * Confirmar asistencia
   */
  async confirmRegistration(req, res, next) {
    try {
      logger.info("POST confirmRegistration", { registrationId: req.params.id });

      const registration = await service.confirmRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        message: "Asistencia confirmada",
        data: registration
      });
    } catch (error) {
      logger.error("Error confirmRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/:id/unconfirm
   * Desconfirmar asistencia
   */
  async unconfirmRegistration(req, res, next) {
    try {
      logger.info("POST unconfirmRegistration", { registrationId: req.params.id });

      const registration = await service.unconfirmRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        message: "Asistencia desconfirmada",
        data: registration
      });
    } catch (error) {
      logger.error("Error unconfirmRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /registrations/leader/:leaderId
   * Obtener registrations de un líder
   */
  async getRegistrationsByLeader(req, res, next) {
    try {
      logger.info("GET getRegistrationsByLeader", { leaderId: req.params.leaderId });

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);

      const result = await service.getRegistrationsByLeader(
        req.params.leaderId,
        { page, pageSize },
        req.orgId
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page,
          pageSize,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      logger.error("Error getRegistrationsByLeader", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/bulk/create
   * Crear múltiples registrations
   */
  async bulkCreateRegistrations(req, res, next) {
    try {
      logger.info("POST bulkCreateRegistrations", { count: req.body.registrations?.length });

      const { registrations } = req.body;

      if (!Array.isArray(registrations)) {
        throw AppError.badRequest("registrations debe ser un array");
      }

      const result = await service.bulkCreateRegistrations(
        registrations,
        req.orgId,
        req.user?._id
      );

      res.status(201).json({
        success: result.success,
        imported: result.created,
        requiresReview: result.requiresReview,
        failed: result.failed,
        autocorrected: result.autocorrected,
        errors: result.errors,
        autocorrections: result.autocorrections,
        message: result.message,
        data: {
          created: result.created,
          errors: result.errors,
          autocorrections: result.autocorrections
        }
      });
    } catch (error) {
      logger.error("Error bulkCreateRegistrations", { error: error.message });
      next(error);
    }
  }
}

export default RegistrationController;
