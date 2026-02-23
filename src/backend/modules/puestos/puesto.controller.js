/**
 * Puesto (Polling Place) Controller
 * Capa de HTTP - endpoints de puestos
 */

import { PuestoService } from "./puesto.service.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";

const logger = createLogger("PuestoController");
const service = new PuestoService();

export class PuestoController {
  /**
   * GET /puestos
   * Obtener puestos (paginado)
   */
  async getPuestos(req, res, next) {
    try {
      logger.info("GET getPuestos");

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(200, parseInt(req.query.pageSize) || 50);

      const result = await service.getPuestos({ page, pageSize });

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
      logger.error("Error getPuestos", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /puestos/localidad/:localidad
   * Obtener puestos por localidad (PÚBLICO)
   */
  async getPuestosByLocalidad(req, res, next) {
    try {
      const { localidad } = req.params;
      logger.info("GET getPuestosByLocalidad", { localidad });

      if (!localidad) {
        throw AppError.badRequest("Localidad es requerida");
      }

      const puestos = await service.getPuestosByLocalidad(localidad);

      res.json({
        success: true,
        data: puestos,
        count: puestos.length
      });
    } catch (error) {
      logger.error("Error getPuestosByLocalidad", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /puestos/:id
   * Obtener detalle de un puesto (PÚBLICO)
   */
  async getPuestoDetalle(req, res, next) {
    try {
      const { id } = req.params;
      logger.info("GET getPuestoDetalle", { puestoId: id });

      if (!id) {
        throw AppError.badRequest("ID de puesto requerido");
      }

      const puesto = await service.getPuestoDetalle(id);

      res.json({
        success: true,
        data: puesto
      });
    } catch (error) {
      logger.error("Error getPuestoDetalle", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /localidades
   * Obtener todas las localidades (PÚBLICO)
   */
  async getLocalidades(req, res, next) {
    try {
      logger.info("GET getLocalidades");

      const localidades = await service.getLocalidades();

      res.json({
        success: true,
        data: localidades,
        count: localidades.length
      });
    } catch (error) {
      logger.error("Error getLocalidades", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /puestos/import
   * Importar múltiples puestos (ADMIN)
   */
  async importarPuestos(req, res, next) {
    try {
      logger.info("POST importarPuestos", { count: req.body.puestos?.length });

      const { puestos } = req.body;

      if (!Array.isArray(puestos)) {
        throw AppError.badRequest("puestos debe ser un array");
      }

      const result = await service.importarPuestos(puestos, req.user?._id);

      res.status(201).json({
        success: true,
        message: `${result.created} puestos importados`,
        data: result.data
      });
    } catch (error) {
      logger.error("Error importarPuestos", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /puestos
   * Crear un puesto (ADMIN)
   */
  async createPuesto(req, res, next) {
    try {
      logger.info("POST createPuesto", { nombre: req.body.nombre });

      const { codigoPuesto, nombre, localidad, direccion, mesas } = req.body;

      const puesto = await service.createPuesto(
        { codigoPuesto, nombre, localidad, direccion, mesas },
        req.user?._id
      );

      res.status(201).json({
        success: true,
        message: "Puesto creado",
        data: puesto
      });
    } catch (error) {
      logger.error("Error createPuesto", { error: error.message });
      next(error);
    }
  }

  /**
   * PUT /puestos/:id
   * Actualizar puesto (ADMIN)
   */
  async updatePuesto(req, res, next) {
    try {
      logger.info("PUT updatePuesto", { puestoId: req.params.id });

      const puesto = await service.updatePuesto(
        req.params.id,
        req.body,
        req.user?._id
      );

      res.json({
        success: true,
        message: "Puesto actualizado",
        data: puesto
      });
    } catch (error) {
      logger.error("Error updatePuesto", { error: error.message });
      next(error);
    }
  }

  /**
   * DELETE /puestos/:id
   * Eliminar puesto (ADMIN)
   */
  async deletePuesto(req, res, next) {
    try {
      logger.info("DELETE deletePuesto", { puestoId: req.params.id });

      await service.deletePuesto(req.params.id, req.user?._id);

      res.json({
        success: true,
        message: "Puesto eliminado"
      });
    } catch (error) {
      logger.error("Error deletePuesto", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /puestos/stats/localidad/:localidad
   * Obtener estadísticas de mesas por localidad
   */
  async getMesasStats(req, res, next) {
    try {
      const { localidad } = req.params;
      logger.info("GET getMesasStats", { localidad });

      if (!localidad) {
        throw AppError.badRequest("Localidad requerida");
      }

      const stats = await service.getMesasStats(localidad);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error("Error getMesasStats", { error: error.message });
      next(error);
    }
  }
}

export default PuestoController;
