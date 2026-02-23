/**
 * Admin Routes
 * Rutas para funciones de administrador
 */

import { Router } from 'express';
import {
  importPuestos,
  getPuestosList,
  getPuestosStatistics
} from './admin.controller.js';

const router = Router();

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

export default router;
