import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";

export async function getAuditLogs(req, res) {
  try {
    const { resourceType, action, page = 1, limit = 50 } = req.query;
    const filter = buildOrgFilter(req); // Multi-tenant filtering

    if (resourceType) filter.resourceType = resourceType;
    if (action) filter.action = action;

    const skip = (page - 1) * limit;

    const logs = await AuditService.getLogs(filter, parseInt(limit), skip);
    const total = await AuditService.getLogs(filter, 0, 0);

    res.json({
      data: logs,
      total: total.length,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total.length / limit)
    });
  } catch (error) {
    logger.error("Get audit logs error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener logs de auditoría" });
  }
}

export async function getAuditStats(req, res) {
  try {
    const { resourceType } = req.query;
    const organizationId = req.user?.organizationId || null;
    const stats = await AuditService.getStats(organizationId, resourceType);
    res.json(stats);
  } catch (error) {
    logger.error("Get audit stats error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener estadísticas de auditoría" });
  }
}
