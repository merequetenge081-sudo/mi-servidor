/**
 * Event Service
 * Capa de lógica de negocio para eventos
 */

import { EventRepository } from "./event.repository.js";
import { AuditService } from '../../../services/audit.service.js';
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("EventService");
const repository = new EventRepository();

export class EventService {
  /**
   * Crear nuevo evento
   */
  async createEvent(input, organizationId, userId) {
    try {
      logger.info("Crear evento", { name: input.name });

      const { name, description, date, location } = input;

      if (!name || !name.trim()) {
        throw AppError.badRequest("Nombre del evento es requerido");
      }

      // Si este será activo, desactivar otros
      if (input.active === true) {
        await repository.deactivateOthers(null, organizationId);
      }

      const eventData = {
        name: name.trim(),
        description,
        date,
        location,
        active: input.active === true,
        organizationId,
        registrationCount: 0,
        confirmedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const event = await repository.create(eventData);

      // Auditoría
      await AuditService.logAction({
        action: "CREATE_EVENT",
        userId,
        resourceType: "Event",
        resourceId: event._id,
        organizationId,
        description: `Evento creado: ${name}`
      });

      logger.success("Evento creado", { eventId: event._id });
      return event;
    } catch (error) {
      logger.error("Error crear evento", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error creando evento");
    }
  }

  /**
   * Obtener eventos
   */
  async getEvents(organizationId, options = {}) {
    try {
      logger.info("Obtener eventos", { organizationId });

      const filter = { organizationId };
      if (options.active !== undefined) {
        filter.active = options.active === true;
      }

      const sort = options.sort || { date: -1 };
      const result = await repository.findMany(filter, { ...options, sort });

      return result;
    } catch (error) {
      logger.error("Error obtener eventos", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo eventos");
    }
  }

  /**
   * Obtener un evento con stats
   */
  async getEvent(eventId, organizationId) {
    try {
      logger.info("Obtener evento", { eventId });

      const event = await repository.findById(eventId);

      // Verificar pertenencia
      if (event.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      // Obtener estadísticas
      const stats = await repository.getEventStats(eventId, organizationId);

      return {
        ...event,
        ...stats
      };
    } catch (error) {
      logger.error("Error obtener evento", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo evento");
    }
  }

  /**
   * Actualizar evento
   */
  async updateEvent(eventId, updateData, organizationId, userId) {
    try {
      logger.info("Actualizar evento", { eventId });

      // Verificar que existe
      const event = await repository.findById(eventId);
      if (event.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      // Si se activa, desactivar otros
      if (updateData.active === true && !event.active) {
        await repository.deactivateOthers(eventId, organizationId);
      }

      const cleanUpdateData = {
        ...updateData,
        updatedAt: new Date()
      };

      // No permitir cambiar organizationId
      delete cleanUpdateData.organizationId;

      const updated = await repository.update(eventId, cleanUpdateData);

      // Auditoría
      await AuditService.logAction({
        action: "UPDATE_EVENT",
        userId,
        resourceType: "Event",
        resourceId: eventId,
        organizationId,
        description: `Evento actualizado: ${updated.name}`
      });

      logger.success("Evento actualizado", { eventId });
      return updated;
    } catch (error) {
      logger.error("Error actualizar evento", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error actualizando evento");
    }
  }

  /**
   * Eliminar evento
   */
  async deleteEvent(eventId, organizationId, userId) {
    try {
      logger.info("Eliminar evento", { eventId });

      // Verificar que existe
      const event = await repository.findById(eventId);
      if (event.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      // Auditoría (antes de eliminar)
      await AuditService.logAction({
        action: "DELETE_EVENT",
        userId,
        resourceType: "Event",
        resourceId: eventId,
        organizationId,
        description: `Evento eliminado: ${event.name}`
      });

      await repository.delete(eventId);

      logger.success("Evento eliminado", { eventId });
    } catch (error) {
      logger.error("Error eliminar evento", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error eliminando evento");
    }
  }

  /**
   * Obtener evento activo actual
   */
  async getActiveEvent(organizationId) {
    try {
      logger.info("Obtener evento activo", { organizationId });

      const event = await repository.findActive(organizationId);

      if (!event) {
        throw AppError.notFound("No hay evento activo");
      }

      // Obtener estadísticas
      const stats = await repository.getEventStats(event._id, organizationId);

      return {
        ...event,
        ...stats
      };
    } catch (error) {
      logger.error("Error obtener evento activo", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo evento activo");
    }
  }

  /**
   * Activar un evento (desactivar otros)
   */
  async activateEvent(eventId, organizationId, userId) {
    try {
      logger.info("Activar evento", { eventId });

      // Verificar que existe
      const event = await repository.findById(eventId);
      if (event.organizationId !== organizationId) {
        throw AppError.forbidden("No autorizado");
      }

      if (event.active) {
        throw AppError.badRequest("Evento ya está activo");
      }

      // Desactivar otros
      await repository.deactivateOthers(eventId, organizationId);

      // Actualizar este
      const updated = await repository.update(eventId, {
        active: true,
        updatedAt: new Date()
      });

      // Auditoría
      await AuditService.logAction({
        action: "ACTIVATE_EVENT",
        userId,
        resourceType: "Event",
        resourceId: eventId,
        organizationId,
        description: `Evento activado: ${updated.name}`
      });

      logger.success("Evento activado", { eventId });
      return updated;
    } catch (error) {
      logger.error("Error activar evento", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error activando evento");
    }
  }
}

export default EventService;
