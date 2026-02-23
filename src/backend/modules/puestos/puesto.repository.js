/**
 * Puesto (Polling Place) Repository
 * Capa de acceso a datos para puestos de votación
 */

import mongoose from "mongoose";
import { Puestos } from "../../../models/index.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("PuestoRepository");

export class PuestoRepository {
  /**
   * Crear nuevo puesto
   */
  async create(puestoData) {
    try {
      const puesto = new Puestos(puestoData);
      await puesto.save();
      logger.success("Puesto creado", { puestoId: puesto._id });
      return puesto.toObject();
    } catch (error) {
      if (error.code === 11000) {
        throw AppError.conflict("Ya existe un puesto con ese código");
      }
      if (error.name === "ValidationError") {
        const message = Object.values(error.errors)
          .map(e => e.message)
          .join(", ");
        throw AppError.unprocessableEntity(message);
      }
      throw AppError.serverError(`Error al crear puesto: ${error.message}`);
    }
  }

  /**
   * Buscar puesto por ID
   */
  async findById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID de puesto inválido");
      }

      const puesto = await Puestos.findById(id).lean();
      if (!puesto) {
        throw AppError.notFound("Puesto no encontrado");
      }

      return puesto;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al buscar puesto: ${error.message}`);
    }
  }

  /**
   * Buscar puestos por localidad
   */
  async findByLocalidad(localidad, active = true) {
    try {
      if (!localidad || !localidad.trim()) {
        throw AppError.badRequest("Localidad es requerida");
      }

      const filter = { localidad: localidad.trim() };
      if (active) {
        filter.activo = true;
      }

      const puestos = await Puestos.find(filter)
        .sort({ nombre: 1 })
        .lean();

      return puestos;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al buscar puestos: ${error.message}`);
    }
  }

  /**
   * Obtener todas las localidades únicas
   */
  async getLocalidades(active = true) {
    try {
      const filter = active ? { activo: true } : {};
      const localidades = await Puestos.distinct("localidad", filter);
      return localidades.sort();
    } catch (error) {
      throw AppError.serverError(`Error al obtener localidades: ${error.message}`);
    }
  }

  /**
   * Buscar puestos con filtros
   */
  async findMany(filter = {}, options = {}) {
    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 50;
      const skip = (page - 1) * pageSize;

      let query = Puestos.find(filter);

      if (options.sort) {
        query = query.sort(options.sort);
      }

      const total = await Puestos.countDocuments(filter);
      const data = await query.skip(skip).limit(pageSize).lean();

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      throw AppError.serverError(`Error al buscar puestos: ${error.message}`);
    }
  }

  /**
   * Actualizar puesto
   */
  async update(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID de puesto inválido");
      }

      const puesto = await Puestos.findByIdAndUpdate(
        id,
        { $set: updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );

      if (!puesto) {
        throw AppError.notFound("Puesto no encontrado");
      }

      logger.success("Puesto actualizado", { puestoId: id });
      return puesto.toObject();
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error.name === "ValidationError") {
        const message = Object.values(error.errors)
          .map(e => e.message)
          .join(", ");
        throw AppError.unprocessableEntity(message);
      }
      throw AppError.serverError(`Error al actualizar puesto: ${error.message}`);
    }
  }

  /**
   * Eliminar puesto
   */
  async delete(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw AppError.badRequest("ID de puesto inválido");
      }

      const result = await Puestos.findByIdAndDelete(id);
      if (!result) {
        throw AppError.notFound("Puesto no encontrado");
      }

      logger.success("Puesto eliminado", { puestoId: id });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al eliminar puesto: ${error.message}`);
    }
  }

  /**
   * Crear múltiples puestos en bulk
   */
  async bulkCreate(puestosData) {
    try {
      if (!Array.isArray(puestosData) || puestosData.length === 0) {
        throw AppError.badRequest("Array de puestos requerido");
      }

      const result = await Puestos.insertMany(puestosData, { ordered: false });
      logger.success("Puestos en bulk creados", { count: result.length });
      return result.map(doc => doc.toObject());
    } catch (error) {
      if (error.code === 11000) {
        throw AppError.conflict("Algunos puestos ya existen (duplicados)");
      }
      if (error.name === "ValidationError") {
        throw AppError.unprocessableEntity("Error de validación en datos");
      }
      throw AppError.serverError(`Error en bulk create: ${error.message}`);
    }
  }

  /**
   * Eliminación masiva de puestos
   */
  async deleteMany(filter = {}) {
    try {
      const result = await Puestos.deleteMany(filter);
      logger.success("Puestos eliminados", { deletedCount: result.deletedCount });
      return result.deletedCount;
    } catch (error) {
      throw AppError.serverError(`Error eliminando puestos: ${error.message}`);
    }
  }

  /**
   * Buscar por código de puesto
   */
  async findByCodigoPuesto(codigoPuesto) {
    try {
      if (!codigoPuesto) {
        throw AppError.badRequest("Código de puesto requerido");
      }

      const puesto = await Puestos.findOne({ codigoPuesto }).lean();
      return puesto || null;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw AppError.serverError(`Error al buscar por código: ${error.message}`);
    }
  }

  /**
   * Contar mesas por localidad
   */
  async countMesasByLocalidad(localidad) {
    try {
      const puestos = await Puestos.find({
        localidad,
        activo: true
      }).lean();

      let totalMesas = 0;
      puestos.forEach(p => {
        if (Array.isArray(p.mesas)) {
          totalMesas += p.mesas.length;
        }
      });

      return {
        localidad,
        puestosCount: puestos.length,
        mesasCount: totalMesas
      };
    } catch (error) {
      throw AppError.serverError(`Error contando mesas: ${error.message}`);
    }
  }
}

export default PuestoRepository;
