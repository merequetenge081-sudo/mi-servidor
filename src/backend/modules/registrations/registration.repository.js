/**
 * Registration Repository
 * Capa de acceso a datos para registrations
 * Responsabilidades:
 * - Queries a MongoDB
 * - Manejo de errores Mongoose
 * - Transformación de documentos
 */

import mongoose from "mongoose";
import { Registration, Event, Puestos } from "../../../models/index.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("RegistrationRepository");

export class RegistrationRepository {
  /**
   * Crear nueva registration
   * @param {Object} registrationData
   * @returns {Object} Registration creada
   */
  async create(registrationData) {
    try {
      const registration = new Registration(registrationData);
      await registration.save();
      logger.success("Registro creado", { registrationId: registration._id });
      return registration.toObject();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw AppError.conflict(`Ya existe un registro con ese ${field}`);
      }
      if (error.name === "ValidationError") {
        const message = Object.values(error.errors)
          .map(e => e.message)
          .join(", ");
        throw AppError.unprocessableEntity(message);
      }
      throw AppError.serverError(`Error al crear registro: ${error.message}`);
    }
  }

  /**
   * Buscar registration por ID
   * @param {string} id
   * @param {Object} options
   * @returns {Object|null}
   */
  async findById(id, options = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID inválido");
      }

      const query = Registration.findById(id);

      if (options.populate) {
        options.populate.forEach(field => {
          query.populate(field);
        });
      }

      const registration = await query.lean();
      if (!registration) {
        throw AppError.notFound("Registro no encontrado");
      }

      return registration;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al buscar registro: ${error.message}`);
    }
  }

  /**
   * Buscar registrations con filtros y paginación
   * @param {Object} filter
   * @param {Object} options
   * @returns {Object} { data, total, page, pageSize }
   */
  async findMany(filter = {}, options = {}) {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      let query = Registration.find(filter);

      if (options.populate) {
        options.populate.forEach(field => {
          query = query.populate(field);
        });
      }

      if (options.sort) {
        query = query.sort(options.sort);
      }

      const total = await Registration.countDocuments(filter);
      const data = await query.skip(skip).limit(pageSize).lean();

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      throw AppError.serverError(`Error al buscar registrations: ${error.message}`);
    }
  }

  /**
   * Actualizar registration
   * @param {string} id
   * @param {Object} updateData
   * @returns {Object}
   */
  async update(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID inválido");
      }

      const registration = await Registration.findByIdAndUpdate(
        id,
        { $set: updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!registration) {
        throw AppError.notFound("Registro no encontrado");
      }

      logger.success("Registro actualizado", { registrationId: id });
      return registration.toObject();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === "ValidationError") {
        const message = Object.values(error.errors)
          .map(e => e.message)
          .join(", ");
        throw AppError.unprocessableEntity(message);
      }
      throw AppError.serverError(`Error al actualizar registro: ${error.message}`);
    }
  }

  /**
   * Eliminar registration
   * @param {string} id
   * @returns {void}
   */
  async delete(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID inválido");
      }

      const result = await Registration.findByIdAndDelete(id);
      if (!result) {
        throw AppError.notFound("Registro no encontrado");
      }

      logger.success("Registro eliminado", { registrationId: id });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al eliminar registro: ${error.message}`);
    }
  }

  /**
   * Verificar si existe registration por cédula y evento
   * @param {string} cedula
   * @param {string} eventId
   * @returns {Object|null}
   */
  async findByCedulaAndEvent(cedula, eventId) {
    try {
      const registration = await Registration.findOne({
        cedula,
        eventId
      }).lean();
      return registration || null;
    } catch (error) {
      throw AppError.serverError(`Error verificando duplicado: ${error.message}`);
    }
  }

  /**
   * Obtener registrations por leaderId
   * @param {string} leaderId
   * @param {Object} options
   * @returns {Array}
   */
  async findByLeaderId(leaderId, options = {}) {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const total = await Registration.countDocuments({ leaderId });

      const data = await Registration.find({ leaderId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      throw AppError.serverError(`Error al buscar registrations del líder: ${error.message}`);
    }
  }

  /**
   * Obtener registrations por eventId
   * @param {string} eventId
   * @param {Object} options
   * @returns {Array}
   */
  async findByEventId(eventId, options = {}) {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 20;
      const skip = (page - 1) * pageSize;

      const total = await Registration.countDocuments({ eventId });

      const data = await Registration.find({ eventId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean();

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      throw AppError.serverError(`Error al buscar registrations del evento: ${error.message}`);
    }
  }

  /**
   * Actualizar estado de confirmación
   * @param {string} id
   * @param {boolean} confirmed
   * @returns {Object}
   */
  async updateConfirmationStatus(id, confirmed) {
    try {
      const registration = await Registration.findByIdAndUpdate(
        id,
        { $set: { confirmed, updatedAt: new Date() } },
        { new: true }
      );

      if (!registration) {
        throw AppError.notFound("Registro no encontrado");
      }

      logger.success("Estado de confirmación actualizado", { registrationId: id, confirmed });
      return registration.toObject();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error actualizar confirmación: ${error.message}`);
    }
  }

  /**
   * Crear múltiples registrations en bulk
   * @param {Array} registrationsData
   * @returns {Array}
   */
  async bulkCreate(registrationsData) {
    try {
      const result = await Registration.insertMany(registrationsData, { ordered: false });
      logger.success("Registrations en bulk creados", { count: result.length });
      return result.map(doc => doc.toObject());
    } catch (error) {
      if (error.code === 11000) {
        throw AppError.conflict("Algunos registros ya existen (duplicados)");
      }
      if (error.name === "ValidationError") {
        throw AppError.unprocessableEntity("Error de validación en datos");
      }
      throw AppError.serverError(`Error en bulk create: ${error.message}`);
    }
  }

  /**
   * Obtener evento por ID
   * @param {string} eventId
   * @returns {Object}
   */
  async getEventById(eventId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        throw AppError.badRequest("ID de evento inválido");
      }

      const event = await Event.findById(eventId).lean();
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
   * Obtener puesto por ID
   * @param {string} puestoId
   * @returns {Object}
   */
  async getPuestoById(puestoId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(puestoId)) {
        throw AppError.badRequest("ID de puesto inválido");
      }

      const puesto = await Puestos.findById(puestoId).lean();
      if (!puesto) {
        throw AppError.notFound("Puesto no encontrado");
      }

      return puesto;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al buscar puesto: ${error.message}`);
    }
  }
}

export default RegistrationRepository;
