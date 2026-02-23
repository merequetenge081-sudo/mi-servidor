/**
 * Audit Controller
 * Endpoints HTTP para auditoría
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import auditService from './audit.service.js';

const logger = createLogger('AuditController');

/**
 * GET /api/v2/audit/logs
 * Obtiene logs de auditoría con paginación y filtros
 */
export async function getAuditLogs(req, res, next) {
  try {
    const { resourceType, action, page = 1, limit = 50 } = req.query;
    const organizationId = req.user?.organizationId;

    logger.info('Get audit logs requested', { resourceType, action, page, limit });

    const result = await auditService.getAuditLogs(organizationId, resourceType, action, page, limit);

    res.json({
      success: true,
      message: 'Audit Logs',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/audit/stats
 * Obtiene estadísticas de auditoría
 */
export async function getAuditStats(req, res, next) {
  try {
    const { resourceType } = req.query;
    const organizationId = req.user?.organizationId;

    logger.info('Get audit stats requested', { resourceType });

    const result = await auditService.getAuditStats(organizationId, resourceType);

    res.json({
      success: true,
      message: 'Audit Statistics',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/audit/users/:userId
 * Obtiene logs de un usuario específico
 */
export async function getUserAuditLogs(req, res, next) {
  try {
    const { userId } = req.params;
    const { limit = 50 } = req.query;
    const organizationId = req.user?.organizationId;

    logger.info('Get user audit logs requested', { userId, limit });

    const result = await auditService.getUserAuditLogs(userId, organizationId, limit);

    res.json({
      success: true,
      message: 'User Audit Logs',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/audit/resources/:resourceType/:resourceId
 * Obtiene logs de un recurso específico
 */
export async function getResourceAuditLogs(req, res, next) {
  try {
    const { resourceType, resourceId } = req.params;
    const organizationId = req.user?.organizationId;

    logger.info('Get resource audit logs requested', { resourceType, resourceId });

    const result = await auditService.getResourceAuditLogs(resourceType, resourceId, organizationId);

    res.json({
      success: true,
      message: 'Resource Audit Logs',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/audit/report
 * Obtiene reporte de auditoría
 */
export async function getAuditReport(req, res, next) {
  try {
    const { action, startDate, endDate } = req.query;
    const organizationId = req.user?.organizationId;

    if (!action || !startDate || !endDate) {
      throw AppError.badRequest('action, startDate, and endDate are required');
    }

    logger.info('Get audit report requested', { action, startDate, endDate });

    const result = await auditService.getAuditReport(organizationId, action, startDate, endDate);

    res.json({
      success: true,
      message: 'Audit Report',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getAuditLogs,
  getAuditStats,
  getUserAuditLogs,
  getResourceAuditLogs,
  getAuditReport
};
