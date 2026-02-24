/**
 * Event Controller
 * Capa de HTTP - endpoints de eventos
 */

import { EventService } from "./event.service.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";
import config from "../../config/config.js";
import { parsePagination } from "../../../utils/pagination.js";

const logger = createLogger("EventController");
const service = new EventService();

export class EventController {
  /**
   * POST /events
   * Crear nuevo evento
   */
  async createEvent(req, res, next) {
    try {
      logger.info("POST createEvent", { name: req.body.name });

      const { name, description, date, location, active } = req.body;

      if (!name) {
        throw AppError.badRequest("Nombre es requerido");
      }

      const eventData = {
        name,
        description,
        date,
        location,
        active: active === true
      };

      const event = await service.createEvent(eventData, req.orgId, req.user?._id);

      res.status(201).json({
        success: true,
        message: "Evento creado exitosamente",
        data: event
      });
    } catch (error) {
      logger.error("Error createEvent", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /events
   * Listar eventos
   */
  async getEvents(req, res, next) {
    try {
      logger.info("GET getEvents", { orgId: req.orgId });

      const { page, limit } = parsePagination(req.query, {
        defaultLimit: config.DEFAULT_PAGE_SIZE,
        maxLimit: config.MAX_PAGE_SIZE
      });
      const pageSize = limit;
      const active = req.query.active;

      const result = await service.getEvents(req.orgId, {
        page,
        pageSize,
        active: active ? active === 'true' : undefined
      });

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
      logger.error("Error getEvents", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /events/:id
   * Obtener un evento con estadísticas
   */
  async getEvent(req, res, next) {
    try {
      logger.info("GET getEvent", { eventId: req.params.id });

      const event = await service.getEvent(req.params.id, req.orgId);

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error("Error getEvent", { error: error.message });
      next(error);
    }
  }

  /**
   * PUT /events/:id
   * Actualizar evento
   */
  async updateEvent(req, res, next) {
    try {
      logger.info("PUT updateEvent", { eventId: req.params.id });

      const updateData = req.body;

      const event = await service.updateEvent(req.params.id, updateData, req.orgId, req.user?._id);

      res.json({
        success: true,
        message: "Evento actualizado",
        data: event
      });
    } catch (error) {
      logger.error("Error updateEvent", { error: error.message });
      next(error);
    }
  }

  /**
   * DELETE /events/:id
   * Eliminar evento
   */
  async deleteEvent(req, res, next) {
    try {
      logger.info("DELETE deleteEvent", { eventId: req.params.id });

      await service.deleteEvent(req.params.id, req.orgId, req.user?._id);

      res.json({
        success: true,
        message: "Evento eliminado"
      });
    } catch (error) {
      logger.error("Error deleteEvent", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /events/active/current
   * Obtener evento activo actual
   */
  async getActiveEvent(req, res, next) {
    try {
      logger.info("GET getActiveEvent", { orgId: req.orgId });

      const event = await service.getActiveEvent(req.orgId);

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      logger.error("Error getActiveEvent", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /events/:id/activate
   * Activar evento (desactivar otros)
   */
  async activateEvent(req, res, next) {
    try {
      logger.info("POST activateEvent", { eventId: req.params.id });

      const event = await service.activateEvent(req.params.id, req.orgId, req.user?._id);

      res.json({
        success: true,
        message: "Evento activado",
        data: event
      });
    } catch (error) {
      logger.error("Error activateEvent", { error: error.message });
      next(error);
    }
  }
}

export default EventController;
