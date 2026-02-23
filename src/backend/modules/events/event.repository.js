/**
 * Event Repository
 * Capa de acceso a datos para eventos
 */

import mongoose from "mongoose";
import { Event, Registration } from "../../../models/index.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("EventRepository");

export class EventRepository {
  /**
   * Crear nuevo evento
   */
  async create(eventData) {
    try {
      const event = new Event(eventData);
      await event.save();
      logger.success("Evento creado", { eventId: event._id });
      return event.toObject();
    } catch (error) {
      if (error.code === 11000) {
        throw AppError.conflict("Ya existe un evento con ese nombre");
      }
      if (error.name === "ValidationError") {
        const message = Object.values(error.errors)
          .map(e => e.message)
          .join(", ");
        throw AppError.unprocessableEntity(message);
      }
      throw AppError.serverError(`Error al crear evento: ${error.message}`);
    }
  }

  /**
   * Buscar evento por ID
   */
  async findById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID de evento inválido");
      }

      const event = await Event.findById(id).lean();
      if (!event) {
        throw AppError.notFound("Evento no encontrado");
      }

      return event;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al buscar evento: ${error.message}`);
    }
  }

  /**
   * Buscar eventos con filtros
   */
  async findMany(filter = {}, options = {}) {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      let query = Event.find(filter);

      if (options.sort) {
        query = query.sort(options.sort);
      }

      const total = await Event.countDocuments(filter);
      const data = await query.skip(skip).limit(pageSize).lean();

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      throw AppError.serverError(`Error al buscar eventos: ${error.message}`);
    }
  }

  /**
   * Actualizar evento
   */
  async update(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID de evento inválido");
      }

      const event = await Event.findByIdAndUpdate(
        id,
        { $set: updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!event) {
        throw AppError.notFound("Evento no encontrado");
      }

      logger.success("Evento actualizado", { eventId: id });
      return event.toObject();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === "ValidationError") {
        const message = Object.values(error.errors)
          .map(e => e.message)
          .join(", ");
        throw AppError.unprocessableEntity(message);
      }
      throw AppError.serverError(`Error al actualizar evento: ${error.message}`);
    }
  }

  /**
   * Eliminar evento
   */
  async delete(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID de evento inválido");
      }

      const result = await Event.findByIdAndDelete(id);
      if (!result) {
        throw AppError.notFound("Evento no encontrado");
      }

      logger.success("Evento eliminado", { eventId: id });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al eliminar evento: ${error.message}`);
    }
  }

  /**
   * Obtener evento activo
   */
  async findActive(organizationId) {
    try {
      const event = await Event.findOne({
        active: true,
        organizationId
      })
        .sort({ createdAt: -1 })
        .lean();

      return event || null;
    } catch (error) {
      throw AppError.serverError(`Error al buscar evento activo: ${error.message}`);
    }
  }

  /**
   * Obtener conteos de registrations e invitados confirmados
   */
  async getEventStats(eventId, organizationId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw AppError.badRequest("ID de evento inválido");
      }

      const registrationCount = await Registration.countDocuments({
        eventId,
        organizationId
      });

      const confirmedCount = await Registration.countDocuments({
        eventId,
        confirmed: true,
        organizationId
      });

      const votingCount = await Registration.countDocuments({
        eventId,
        registeredToVote: true,
        organizationId
      });

      const votedCount = await Registration.countDocuments({
        eventId,
        registeredToVote: true,
        confirmed: true,
        organizationId
      });

      return {
        registrationCount,
        confirmedCount,
        votingCount,
        votedCount,
        attendanceRate: registrationCount > 0 
          ? Math.round((confirmedCount / registrationCount) * 100) 
          : 0
      };
    } catch (error) {
      throw AppError.serverError(`Error al obtener stats: ${error.message}`);
    }
  }

  /**
   * Obtener eventos como listado completo
   */
  async findByOrganization(organizationId, options = {}) {
    try {
      const sort = options.sort || { date: -1 };
      const events = await Event.find({
        organizationId
      })
        .sort(sort)
        .lean();

      return events;
    } catch (error) {
      throw AppError.serverError(`Error al buscar eventos: ${error.message}`);
    }
  }

  /**
   * Desactivar todos los eventos excepto uno
   */
  async deactivateOthers(activeEventId, organizationId) {
    try {
      await Event.updateMany(
        {
          _id: { $ne: activeEventId },
          organizationId,
          active: true
        },
        { $set: { active: false, updatedAt: new Date() } }
      );

      logger.success("Otros eventos desactivados", { activeEventId });
    } catch (error) {
      throw AppError.serverError(`Error desactivando otros eventos: ${error.message}`);
    }
  }
}

export default EventRepository;
