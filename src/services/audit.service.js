import logger from "../config/logger.js";
import { AuditLog } from "../models/AuditLog.js";

export class AuditService {
  static async log(action, resourceType, resourceId, user, details = {}, description = "") {
    try {
      const auditData = {
        action,
        resourceType,
        resourceId,
        userId: user?.userId || user?.id,
        userRole: user?.role,
        userName: user?.username || user?.name,
        changes: details,
        timestamp: new Date(),
        description
      };

      await AuditLog.create(auditData);
    } catch (error) {
      logger.error("Audit log failed (non-blocking):", { error: error.message, stack: error.stack });
    }
  }

  static async getLogs(filter = {}, limit = 100, skip = 0) {
    return await AuditLog.find(filter).sort({ timestamp: -1 }).limit(limit).skip(skip);
  }

  static async getStats(resourceType = null) {
    const match = resourceType ? { resourceType } : {};
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
}
