/**
 * Duplicates Controller
 * Endpoints HTTP para detección de duplicados
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import duplicatesService from './duplicates.service.js';

const logger = createLogger('DuplicatesController');

/**
 * GET /api/v2/duplicates/report
 * Obtiene reporte de registraciones duplicadas
 */
export async function getDuplicatesReport(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Reporte de duplicados solicitado', { eventId });

    const report = await duplicatesService.getDuplicatesReport(eventId);

    res.json({
      success: true,
      message: 'Duplicates Report',
      data: report
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/duplicates/stats
 * Obtiene estadísticas de duplicados
 */
export async function getDuplicateStats(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Stats de duplicados solicitadas', { eventId });

    const stats = await duplicatesService.getDuplicateStats(eventId);

    res.json({
      success: true,
      message: 'Duplicates Statistics',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/duplicates/:cedula
 * Obtiene detalles de registraciones duplicadas para una cédula
 */
export async function getDuplicateDetails(req, res, next) {
  try {
    const { cedula } = req.params;
    const { eventId } = req.query;

    if (!cedula) {
      throw AppError.badRequest('Cédula requerida');
    }

    logger.info('Detalles de duplicado solicitados', { cedula });

    const details = await duplicatesService.getDuplicateDetails(cedula, eventId);

    res.json({
      success: true,
      message: 'Duplicate Details',
      data: details
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/duplicates/scan
 * Ejecuta barrido de deduplicación sobre datos existentes
 */
export async function runDeduplicationScan(req, res, next) {
  try {
    const {
      eventId = null,
      organizationId = req.user?.organizationId || null,
      limit = 300
    } = req.body || {};

    const result = await duplicatesService.runDeduplicationScan({
      eventId,
      organizationId,
      limit: Number(limit) || 300
    });

    res.json({
      success: true,
      message: "Deduplication scan completed",
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getDuplicatesReport,
  getDuplicateStats,
  getDuplicateDetails,
  runDeduplicationScan
};
