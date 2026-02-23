/**
 * Puesto (Polling Place) Service
 * Capa de lógica de negocio para puestos de votación
 */

import { PuestoRepository } from "./puesto.repository.js";
import { AuditService } from '../../../services/audit.service.js';
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("PuestoService");
const repository = new PuestoRepository();

export class PuestoService {
  /**
   * Obtener puestos por localidad
   */
  async getPuestosByLocalidad(localidad) {
    try {
      logger.info("Obtener puestos por localidad", { localidad });

      if (!localidad || !localidad.trim()) {
        throw AppError.badRequest("Localidad es requerida");
      }

      const puestos = await repository.findByLocalidad(localidad, true);

      logger.success("Puestos obtenidos", { count: puestos.length, localidad });
      return puestos;
    } catch (error) {
      logger.error("Error obtener puestos", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo puestos");
    }
  }

  /**
   * Obtener detalle de un puesto
   */
  async getPuestoDetalle(puestoId) {
    try {
      logger.info("Obtener detalle puesto", { puestoId });

      const puesto = await repository.findById(puestoId);

      return {
        _id: puesto._id,
        codigoPuesto: puesto.codigoPuesto,
        nombre: puesto.nombre,
        localidad: puesto.localidad,
        direccion: puesto.direccion,
        mesas: puesto.mesas || []
      };
    } catch (error) {
      logger.error("Error obtener detalle", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo detalle");
    }
  }

  /**
   * Obtener todas las localidades
   */
  async getLocalidades() {
    try {
      logger.info("Obtener localidades");

      const localidades = await repository.getLocalidades(true);

      logger.success("Localidades obtenidas", { count: localidades.length });
      return localidades;
    } catch (error) {
      logger.error("Error obtener localidades", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo localidades");
    }
  }

  /**
   * Importar puestos en bulk
   */
  async importarPuestos(puestosData, userId) {
    try {
      logger.info("Importar puestos", { count: puestosData?.length });

      if (!Array.isArray(puestosData) || puestosData.length === 0) {
        throw AppError.badRequest("Array de puestos requerido");
      }

      // Validar estructura de cada puesto
      const puestosValidos = puestosData
        .map((p, idx) => {
          // Validaciones básicas
          if (!p.codigoPuesto || !p.nombre || !p.localidad || !Array.isArray(p.mesas)) {
            logger.warn(`Puesto inválido en índice ${idx}`, { puesto: p });
            return null;
          }

          return {
            codigoPuesto: String(p.codigoPuesto).trim(),
            nombre: String(p.nombre).trim(),
            localidad: String(p.localidad).trim(),
            direccion: p.direccion || "",
            mesas: p.mesas,
            activo: p.activo !== false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
        })
        .filter(p => p !== null);

      if (puestosValidos.length === 0) {
        throw AppError.badRequest("Ninguno de los puestos tiene datos válidos");
      }

      // Borrar existentes (opción de limpiar antes de importar)
      await repository.deleteMany({});
      logger.info("Puestos existentes eliminados");

      // Crear los nuevos
      const resultado = await repository.bulkCreate(puestosValidos);

      // Auditoría
      await AuditService.logAction({
        action: "BULK_CREATE_PUESTOS",
        userId,
        resourceType: "Puesto",
        description: `${resultado.length} puestos importados`
      });

      logger.success("Puestos importados", { count: resultado.length });
      return {
        created: resultado.length,
        data: resultado
      };
    } catch (error) {
      logger.error("Error importar puestos", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error importando puestos");
    }
  }

  /**
   * Crear un puesto individual
   */
  async createPuesto(input, userId) {
    try {
      logger.info("Crear puesto", { nombre: input.nombre });

      const { codigoPuesto, nombre, localidad, direccion, mesas } = input;

      if (!codigoPuesto || !nombre || !localidad) {
        throw AppError.badRequest("codigoPuesto, nombre y localidad son requeridos");
      }

      // Verificar que no exista
      const existing = await repository.findByCodigoPuesto(codigoPuesto);
      if (existing) {
        throw AppError.conflict("Ya existe un puesto con ese código");
      }

      const puestoData = {
        codigoPuesto: codigoPuesto.trim(),
        nombre: nombre.trim(),
        localidad: localidad.trim(),
        direccion: direccion || "",
        mesas: Array.isArray(mesas) ? mesas : [],
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const puesto = await repository.create(puestoData);

      await AuditService.logAction({
        action: "CREATE_PUESTO",
        userId,
        resourceType: "Puesto",
        resourceId: puesto._id,
        description: `Puesto creado: ${nombre}`
      });

      logger.success("Puesto creado", { puestoId: puesto._id });
      return puesto;
    } catch (error) {
      logger.error("Error crear puesto", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error creando puesto");
    }
  }

  /**
   * Actualizar puesto
   */
  async updatePuesto(puestoId, updateData, userId) {
    try {
      logger.info("Actualizar puesto", { puestoId });

      // Verificar que existe
      const puesto = await repository.findById(puestoId);

      const cleanUpdateData = {
        ...updateData,
        updatedAt: new Date()
      };

      // No permitir cambiar codigoPuesto
      delete cleanUpdateData.codigoPuesto;

      const updated = await repository.update(puestoId, cleanUpdateData);

      await AuditService.logAction({
        action: "UPDATE_PUESTO",
        userId,
        resourceType: "Puesto",
        resourceId: puestoId,
        description: `Puesto actualizado: ${updated.nombre}`
      });

      logger.success("Puesto actualizado", { puestoId });
      return updated;
    } catch (error) {
      logger.error("Error actualizar puesto", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error actualizando puesto");
    }
  }

  /**
   * Eliminar puesto
   */
  async deletePuesto(puestoId, userId) {
    try {
      logger.info("Eliminar puesto", { puestoId });

      const puesto = await repository.findById(puestoId);

      await repository.delete(puestoId);

      await AuditService.logAction({
        action: "DELETE_PUESTO",
        userId,
        resourceType: "Puesto",
        resourceId: puestoId,
        description: `Puesto eliminado: ${puesto.nombre}`
      });

      logger.success("Puesto eliminado", { puestoId });
    } catch (error) {
      logger.error("Error eliminar puesto", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error eliminando puesto");
    }
  }

  /**
   * Obtener puestos con paginación
   */
  async getPuestos(options = {}) {
    try {
      logger.info("Obtener puestos paginado");

      const filter = { activo: true };
      const result = await repository.findMany(filter, options);

      return result;
    } catch (error) {
      logger.error("Error obtener puestos", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo puestos");
    }
  }

  /**
   * Obtener estadísticas de mesas por localidad
   */
  async getMesasStats(localidad) {
    try {
      logger.info("Obtener stats de mesas", { localidad });

      const stats = await repository.countMesasByLocalidad(localidad);

      return stats;
    } catch (error) {
      logger.error("Error obtener stats", { error: error.message });
      if (error instanceof AppError) throw error;
      throw AppError.serverError("Error obteniendo estadísticas");
    }
  }
}

export default PuestoService;
