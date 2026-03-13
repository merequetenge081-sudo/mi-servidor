/**
 * Admin Controller
 * Endpoints HTTP para funciones de administrador
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import adminService from './admin.service.js';
import registraduriaSyncService from '../../../services/registraduria-sync.service.js';
import e14ConfirmationService from '../../../services/e14-confirmation.service.js';
import e14ImportService from '../../../services/e14-import.service.js';

const logger = createLogger('AdminController');

/**
 * POST /api/v2/admin/import-puestos
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

/**
 * POST /api/v2/admin/sync-mesas-bogota
 */
export async function syncMesasBogota(req, res, next) {
  try {
    logger.info('Sync mesas Bogota requested', {
      userId: req.user?._id || null,
      organizationId: req.organizationId || null
    });

    const result = await registraduriaSyncService.syncBogotaMesas();

    res.status(200).json({
      success: true,
      message: 'Sincronizacion de mesas de Bogota completada',
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/validacion-datos-reales
 */
export async function getRealDataValidation(req, res, next) {
  try {
    const result = await e14ConfirmationService.getE14ConfirmationData(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });

    res.status(200).json({
      success: true,
      message: 'Confirmacion E14 por mesa',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/admin/validacion-datos-reales/run
 */
export async function runRealDataValidation(req, res, next) {
  try {
    const result = await e14ConfirmationService.recalculateE14Confirmation(req.body || {}, {
      organizationId: req.organizationId || req.orgId || null
    });

    res.status(200).json({
      success: true,
      message: 'Recalculo de confirmacion E14 completado',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/e14-confirmation
 */
export async function getE14Confirmation(req, res, next) {
  try {
    const result = await e14ConfirmationService.getE14ConfirmationByMesaData(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });
    res.status(200).json({
      success: true,
      message: 'Listado de confirmacion E14 por mesa',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/admin/e14-confirmation/manual-save
 */
export async function saveE14ConfirmationManual(req, res, next) {
  try {
    const result = await e14ConfirmationService.saveManualE14Confirmation(req.body || {}, {
      organizationId: req.organizationId || req.orgId || null,
      validatedBy: req.user?.username || req.user?.email || req.user?._id || 'admin'
    });
    res.status(200).json({
      success: true,
      message: 'Confirmacion E14 guardada manualmente',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/e14-confirmation/by-mesa
 */
export async function getE14ConfirmationByMesa(req, res, next) {
  try {
    const result = await e14ConfirmationService.getE14ConfirmationByMesaData(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });
    res.status(200).json({
      success: true,
      message: 'Listado agrupado por mesa',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/e14-confirmation/summary
 */
export async function getE14ConfirmationSummary(req, res, next) {
  try {
    const result = await e14ConfirmationService.getE14ConfirmationSummaryData(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });
    res.status(200).json({
      success: true,
      message: 'Resumen de confirmacion E14 por mesa',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function getE14ConfirmationProgressTree(req, res, next) {
  try {
    const result = await e14ConfirmationService.getE14ProgressTreeData(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });
    res.status(200).json({
      success: true,
      message: 'Arbol de conciliacion E14 por mesa',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/admin/e14-confirmation/invalid-rows
 */
export async function getE14ConfirmationInvalidRows(req, res, next) {
  try {
    const result = await e14ConfirmationService.getE14InvalidRowsData(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });
    res.status(200).json({
      success: true,
      message: 'Registros excluidos de confirmacion E14',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/admin/e14-confirmation/by-mesa/manual-save
 */
export async function saveE14ConfirmationByMesaManual(req, res, next) {
  try {
    const result = await e14ConfirmationService.saveManualByMesa(req.body || {}, {
      organizationId: req.organizationId || req.orgId || null,
      validatedBy: req.user?.username || req.user?.email || req.user?._id || 'admin'
    });
    res.status(200).json({
      success: true,
      message: 'Confirmacion E14 por mesa guardada manualmente',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function previewE14Import(req, res, next) {
  try {
    const result = await e14ImportService.previewImport(req.body || {}, {
      organizationId: req.organizationId || req.orgId || null,
      validatedBy: req.user?.username || req.user?.email || req.user?._id || "admin"
    });
    res.status(200).json({
      success: true,
      message: 'Vista previa de importacion E14 generada',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function applyE14Import(req, res, next) {
  try {
    const result = await e14ImportService.applyImportReconciliation(req.body || {}, {
      organizationId: req.organizationId || req.orgId || null,
      validatedBy: req.user?.username || req.user?.email || req.user?._id || "admin"
    });
    res.status(200).json({
      success: true,
      message: 'Importacion E14 aplicada correctamente',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function getE14ImportHistory(req, res, next) {
  try {
    const result = await e14ImportService.getImportHistory(req.query || {}, {
      organizationId: req.organizationId || req.orgId || null
    });
    res.status(200).json({
      success: true,
      message: 'Historial de importaciones E14',
      data: result,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  importPuestos,
  getPuestosList,
  getPuestosStatistics,
  syncMesasBogota,
  getRealDataValidation,
  runRealDataValidation,
  getE14Confirmation,
  saveE14ConfirmationManual,
  getE14ConfirmationSummary,
  getE14ConfirmationProgressTree,
  getE14ConfirmationByMesa,
  getE14ConfirmationInvalidRows,
  saveE14ConfirmationByMesaManual,
  previewE14Import,
  applyE14Import,
  getE14ImportHistory
};
