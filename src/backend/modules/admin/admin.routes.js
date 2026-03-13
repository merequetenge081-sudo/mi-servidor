/**
 * Admin Routes
 * Rutas para funciones de administrador
 */

import { Router } from 'express';
import {
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
} from './admin.controller.js';
import { authMiddleware, organizationMiddleware, roleMiddleware } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(organizationMiddleware);
router.use(roleMiddleware('admin'));

/**
 * POST /api/v2/admin/import-puestos
 * Importar puestos de votación
 */
router.post('/import-puestos', importPuestos);

/**
 * GET /api/v2/admin/puestos
 * Listar puestos
 */
router.get('/puestos', getPuestosList);

/**
 * GET /api/v2/admin/puestos/stats
 * Estadísticas de puestos
 */
router.get('/puestos/stats', getPuestosStatistics);

/**
 * POST /api/v2/admin/sync-mesas-bogota
 * SincronizaciÃ³n oficial de mesas de BogotÃ¡
 */
router.post('/sync-mesas-bogota', syncMesasBogota);

/**
 * GET /api/v2/admin/validacion-datos-reales
 * KPIs + tabla paginada de validaciÃ³n real
 */
router.get('/validacion-datos-reales', getRealDataValidation);

/**
 * POST /api/v2/admin/validacion-datos-reales/run
 * Ejecuta validaciÃ³n masiva y persiste flags
 */
router.post('/validacion-datos-reales/run', runRealDataValidation);

/**
 * GET /api/v2/admin/e14-confirmation
 * Listado principal de confirmacion E14 por mesa
 */
router.get('/e14-confirmation', getE14Confirmation);

/**
 * POST /api/v2/admin/e14-confirmation/manual-save
 * Guarda captura manual E14 por registro
 */
router.post('/e14-confirmation/manual-save', saveE14ConfirmationManual);

/**
 * GET /api/v2/admin/e14-confirmation/by-mesa
 */
router.get('/e14-confirmation/by-mesa', getE14ConfirmationByMesa);

/**
 * GET /api/v2/admin/e14-confirmation/summary
 */
router.get('/e14-confirmation/summary', getE14ConfirmationSummary);

/**
 * GET /api/v2/admin/e14-confirmation/progress-tree
 */
router.get('/e14-confirmation/progress-tree', getE14ConfirmationProgressTree);

/**
 * GET /api/v2/admin/e14-confirmation/invalid-rows
 */
router.get('/e14-confirmation/invalid-rows', getE14ConfirmationInvalidRows);

/**
 * POST /api/v2/admin/e14-confirmation/by-mesa/manual-save
 */
router.post('/e14-confirmation/by-mesa/manual-save', saveE14ConfirmationByMesaManual);

/**
 * POST /api/v2/admin/e14-confirmation/import/preview
 */
router.post('/e14-confirmation/import/preview', previewE14Import);

/**
 * POST /api/v2/admin/e14-confirmation/import/apply
 */
router.post('/e14-confirmation/import/apply', applyE14Import);

/**
 * GET /api/v2/admin/e14-confirmation/import/history
 */
router.get('/e14-confirmation/import/history', getE14ImportHistory);

export default router;
