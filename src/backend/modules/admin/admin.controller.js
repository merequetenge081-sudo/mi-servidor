/**
 * Admin Controller
 * Endpoints HTTP para funciones de administrador
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import adminService from './admin.service.js';

const logger = createLogger('AdminController');

/**
 * POST /api/v2/admin/import-puestos
 * Importa puestos de votación
 */
export async function importPuestos(req, res, next) {
  try {
    const { puestos } = req.body;

    if (!puestos) {
      throw AppError.badRequest('puestos array is required in request body');
    }

    logger.info('Import puestos requested', { count: Array.isArray(puestos) ? puestos.length : 0 });

    const result = await adminService.importPuestos(puestos);

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/puestos
 * Obtiene lista de puestos importados
 */
export async function getPuestosList(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;

    logger.info('Get puestos list requested', { page, limit });

    const result = await adminService.getPuestosList(page, limit);

    res.json({
      success: true,
      message: 'Puestos List',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/puestos/stats
 * Obtiene estadísticas de puestos
 */
export async function getPuestosStatistics(req, res, next) {
  try {
    logger.info('Get puestos statistics requested');

    const result = await adminService.getPuestosStatistics();

    res.json({
      success: true,
      message: 'Puestos Statistics',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  importPuestos,
  getPuestosList,
  getPuestosStatistics
};
