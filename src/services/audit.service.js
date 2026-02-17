import logger from "../config/logger.js";
import { AuditLog } from "../models/AuditLog.js";

export class AuditService {
  /**
   * Log an action with full context
   * @param {string} action - Action type (CREATE, READ, UPDATE, DELETE, etc)
   * @param {string} resourceType - Type of resource (Leader, Registration, Event, etc)
   * @param {string} resourceId - ID of the resource
   * @param {object} user - User object from request
   * @param {object} details - Changes or additional details
   * @param {string} description - Human readable description
   * @param {object} req - Express request object for additional context
   */
  static async log(action, resourceType, resourceId, user, details = {}, description = "", req = null) {
    try {
      const auditData = {
        action,
        resourceType,
        resourceId,
        userId: user?.userId || user?.id,
        userRole: user?.role,
        userName: user?.username || user?.name,
        organizationId: user?.organizationId, // Multi-tenant support
        changes: details,
        timestamp: new Date(),
        description,
        
        // Request context if available
        ipAddress: req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0],
        userAgent: req?.headers?.['user-agent'],
        method: req?.method,
        endpoint: req?.path,
        statusCode: req?.res?.statusCode,
      };

      await AuditLog.create(auditData);
    } catch (error) {
      logger.error("Audit log failed (non-blocking):", { error: error.message, stack: error.stack });
      // Non-blocking - don't fail the operation
    }
  }

  /**
   * Get audit logs with organization filtering
   */
  static async getLogs(filter = {}, limit = 100, skip = 0) {
    // Enforce organization filter if organizationId provided in filter
    const query = limit > 0 ? { limit, skip } : {};
    return await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit || 100)
      .skip(skip || 0);
  }

  /**
   * Get audit count by action type with organization filter
   */
  static async getStats(organizationId = null, resourceType = null) {
    const match = {};
    if (organizationId) match.organizationId = organizationId;
    if (resourceType) match.resourceType = resourceType;

    return await AuditLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Get audit logs for a specific user
   */
  static async getUserLogs(userId, organizationId = null, limit = 50) {
    const match = { userId };
    if (organizationId) match.organizationId = organizationId;

    return await AuditLog.find(match)
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  /**
   * Get audit logs for a specific resource
   */
  static async getResourceLogs(resourceType, resourceId, organizationId = null) {
    const match = { resourceType, resourceId };
    if (organizationId) match.organizationId = organizationId;

    return await AuditLog.find(match).sort({ timestamp: -1 });
  }

  /**
   * Get audit report by action and time period
   */
  static async getActionReport(organizationId, action, startDate, endDate) {
    return await AuditLog.aggregate([
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
          _id: "$resourceType",
          count: { $sum: 1 },
          users: { $addToSet: "$userName" }
        }
      },
      { $sort: { count: -1 } }
    ]);
  }

  /**
   * Clean old audit logs (retention policy)
   * @param {number} daysToKeep - Number of days to keep logs
   */
  static async cleanOldLogs(daysToKeep = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    logger.info(`Cleaned ${result.deletedCount} old audit logs`);
    return result;
  }
}

export default AuditService;
