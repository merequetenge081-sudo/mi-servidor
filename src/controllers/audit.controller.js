import { AuditService } from "../services/audit.service.js";

export async function getAuditLogs(req, res) {
  try {
    const { resourceType, action, page = 1, limit = 50 } = req.query;
    const filter = {};

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
    console.error("Get audit logs error:", error.message);
    res.status(500).json({ error: "Error al obtener logs de auditoría" });
  }
}

export async function getAuditStats(req, res) {
  try {
    const { resourceType } = req.query;
    const stats = await AuditService.getStats(resourceType);
    res.json(stats);
  } catch (error) {
    console.error("Get audit stats error:", error.message);
    res.status(500).json({ error: "Error al obtener estadísticas de auditoría" });
  }
}
