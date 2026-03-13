/**
 * Duplicates Routes
 * Rutas para detección y análisis de duplicados
 */

import { Router } from 'express';
import {
  getDuplicatesReport,
  getDuplicateStats,
  getDuplicateDetails,
  runDeduplicationScan
} from './duplicates.controller.js';

const router = Router();

/**
 * GET /api/v2/duplicates/report
 * Reporte de registraciones duplicadas
 */
router.get('/report', getDuplicatesReport);

/**
 * GET /api/v2/duplicates/stats
 * Estadísticas de duplicados
 */
router.get('/stats', getDuplicateStats);

/**
 * POST /api/v2/duplicates/scan
 * Ejecuta scan de deduplicación en lote
 */
router.post('/scan', runDeduplicationScan);

/**
 * GET /api/v2/duplicates/:cedula
 * Detalles de duplicados por cédula
 */
router.get('/:cedula', getDuplicateDetails);

export default router;
