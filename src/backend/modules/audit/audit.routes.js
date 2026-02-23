/**
 * Audit Routes
 * Rutas para auditoría y análisis de logs
 */

import { Router } from 'express';
import {
  getAuditLogs,
  getAuditStats,
  getUserAuditLogs,
  getResourceAuditLogs,
  getAuditReport
} from './audit.controller.js';

const router = Router();

/**
 * GET /api/v2/audit/logs
 * Logs de auditoría con paginación y filtros
 */
router.get('/logs', getAuditLogs);

/**
 * GET /api/v2/audit/stats
 * Estadísticas de auditoría
 */
router.get('/stats', getAuditStats);

/**
 * GET /api/v2/audit/users/:userId
 * Logs de un usuario
 */
router.get('/users/:userId', getUserAuditLogs);

/**
 * GET /api/v2/audit/resources/:resourceType/:resourceId
 * Logs de un recurso
 */
router.get('/resources/:resourceType/:resourceId', getResourceAuditLogs);

/**
 * GET /api/v2/audit/report
 * Reporte de auditoría
 */
router.get('/report', getAuditReport);

export default router;
