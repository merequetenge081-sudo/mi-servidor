/**
 * Audit Repository
 * Consultas y operaciones sobre el modelo AuditLog
 */

import { AuditLog } from '../../../models/AuditLog.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('AuditRepository');

/**
 * Obtiene logs de auditoría con filtros
 */
export async function getLogs(filter = {}, limit = 100, skip = 0) {
  try {
    logger.debug('Fetching audit logs', { filter, limit, skip });

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit || 100)
      .skip(skip || 0)
      .lean();

    return logs;
  } catch (error) {
    logger.error('Error fetching audit logs', { error: error.message });
    throw AppError.serverError('Error fetching audit logs');
  }
}

/**
 * Cuenta logs de auditoría por tipo de acción
 */
export async function getAuditStats(organizationId = null, resourceType = null) {
  try {
    logger.debug('Getting audit stats', { organizationId, resourceType });

    const match = {};
    if (organizationId) match.organizationId = organizationId;
    if (resourceType) match.resourceType = resourceType;

    const stats = await AuditLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return stats;
  } catch (error) {
    logger.error('Error getting audit stats', { error: error.message });
    throw AppError.serverError('Error getting audit stats');
  }
}

/**
 * Obtiene logs de un usuario específico
 */
export async function getUserLogs(userId, organizationId = null, limit = 50) {
  try {
    logger.debug('Fetching user audit logs', { userId, organizationId });

    const match = { userId };
    if (organizationId) match.organizationId = organizationId;

    const logs = await AuditLog.find(match)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    return logs;
  } catch (error) {
    logger.error('Error fetching user audit logs', { error: error.message });
    throw AppError.serverError('Error fetching user audit logs');
  }
}

/**
 * Obtiene logs de un recurso específico
 */
export async function getResourceLogs(resourceType, resourceId, organizationId = null) {
  try {
    logger.debug('Fetching resource audit logs', { resourceType, resourceId });

    const match = { resourceType, resourceId };
    if (organizationId) match.organizationId = organizationId;

    const logs = await AuditLog.find(match)
      .sort({ timestamp: -1 })
      .lean();

    return logs;
  } catch (error) {
    logger.error('Error fetching resource audit logs', { error: error.message });
    throw AppError.serverError('Error fetching resource audit logs');
  }
}

/**
 * Obtiene reporte de acciones en período de tiempo
 */
export async function getActionReport(organizationId, action, startDate, endDate) {
  try {
    logger.debug('Getting action report', { organizationId, action, startDate, endDate });

    const report = await AuditLog.aggregate([
      {
        $match: {
          organizationId,
          action,
          timestamp: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: '$resourceType',
          count: { $sum: 1 },
          users: { $addToSet: '$userName' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return report;
  } catch (error) {
    logger.error('Error getting action report', { error: error.message });
    throw AppError.serverError('Error getting action report');
  }
}

/**
 * Cuenta total de logs con filtro
 */
export async function countLogs(filter = {}) {
  try {
    const count = await AuditLog.countDocuments(filter);
    return count;
  } catch (error) {
    logger.error('Error counting audit logs', { error: error.message });
    throw AppError.internal('Error counting audit logs');
  }
}

export default {
  getLogs,
  getAuditStats,
  getUserLogs,
  getResourceLogs,
  getActionReport,
  countLogs
};
