/**
 * Audit Service
 * Lógica de negocio para auditoría
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import auditRepository from './audit.repository.js';

const logger = createLogger('AuditService');

/**
 * Obtiene logs formateados con paginación
 */
export async function getAuditLogs(organizationId = null, resourceType = null, action = null, page = 1, limit = 50) {
  try {
    logger.info('Fetching audit logs', { organizationId, resourceType, action, page, limit });

    const filter = {};
    if (organizationId) filter.organizationId = organizationId;
    if (resourceType) filter.resourceType = resourceType;
    if (action) filter.action = action;

    const skip = (page - 1) * limit;

    // Get logs and total count in parallel
    const [logs, total] = await Promise.all([
      auditRepository.getLogs(filter, limit, skip),
      auditRepository.countLogs(filter)
    ]);

    const pages = Math.ceil(total / limit);

    return {
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages
      }
    };
  } catch (error) {
    logger.error('Error getting audit logs', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching audit logs');
  }
}

/**
 * Obtiene estadísticas de auditoría formateadas
 */
export async function getAuditStats(organizationId = null, resourceType = null) {
  try {
    logger.info('Getting audit stats', { organizationId, resourceType });

    const stats = await auditRepository.getAuditStats(organizationId, resourceType);

    return {
      stats: stats,
      summary: {
        totalActions: stats.reduce((sum, s) => sum + s.count, 0),
        actionTypes: stats.length,
        topAction: stats[0]?.['_id'] || null,
        topActionCount: stats[0]?.count || 0
      }
    };
  } catch (error) {
    logger.error('Error getting audit stats', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching audit stats');
  }
}

/**
 * Obtiene logs de un usuario
 */
export async function getUserAuditLogs(userId, organizationId = null, limit = 50) {
  try {
    if (!userId) {
      throw AppError.badRequest('User ID required');
    }

    logger.info('Getting user audit logs', { userId, organizationId });

    const logs = await auditRepository.getUserLogs(userId, organizationId, limit);

    return {
      userId,
      logs,
      count: logs.length
    };
  } catch (error) {
    logger.error('Error getting user audit logs', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching user audit logs');
  }
}

/**
 * Obtiene logs de un recurso
 */
export async function getResourceAuditLogs(resourceType, resourceId, organizationId = null) {
  try {
    if (!resourceType || !resourceId) {
      throw AppError.badRequest('Resource type and ID required');
    }

    logger.info('Getting resource audit logs', { resourceType, resourceId, organizationId });

    const logs = await auditRepository.getResourceLogs(resourceType, resourceId, organizationId);

    return {
      resourceType,
      resourceId,
      logs,
      count: logs.length
    };
  } catch (error) {
    logger.error('Error getting resource audit logs', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching resource audit logs');
  }
}

/**
 * Obtiene reporte formateado de auditoría
 */
export async function getAuditReport(organizationId, action, startDate, endDate) {
  try {
    if (!organizationId || !action) {
      throw AppError.badRequest('Organization ID and action required');
    }

    logger.info('Getting audit report', { organizationId, action, startDate, endDate });

    const report = await auditRepository.getActionReport(organizationId, action, startDate, endDate);

    return {
      filters: {
        organizationId,
        action,
        startDate,
        endDate
      },
      report,
      summary: {
        totalEntries: report.reduce((sum, r) => sum + r.count, 0),
        resourceTypes: report.length,
        affectedUsers: [...new Set(report.flatMap(r => r.users))].length
      }
    };
  } catch (error) {
    logger.error('Error getting audit report', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching audit report');
  }
}

export default {
  getAuditLogs,
  getAuditStats,
  getUserAuditLogs,
  getResourceAuditLogs,
  getAuditReport
};
