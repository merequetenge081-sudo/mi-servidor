import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import auditService from "../backend/modules/audit/audit.service.js";

function handleAuditError(res, error, fallbackCode) {
  logger.error("Audit controller error:", { error: error.message, stack: error.stack, code: fallbackCode });
  const status = error?.statusCode || 500;
  return sendError(res, status, error?.message || "Error de auditoría", fallbackCode, error?.details ?? error?.message);
}

export async function getAuditLogs(req, res) {
  try {
    const { resourceType, action, page = 1, limit = 50 } = req.query;
    const organizationId = req.user?.organizationId || null;

    const result = await auditService.getAuditLogs(organizationId, resourceType, action, page, limit);

    return res.json({
      data: result.data,
      total: result.pagination.total,
      page: result.pagination.page,
      limit: result.pagination.limit,
      pages: result.pagination.pages
    });
  } catch (error) {
    return handleAuditError(res, error, "GET_AUDIT_LOGS_ERROR");
  }
}

export async function getAuditStats(req, res) {
  try {
    const { resourceType } = req.query;
    const organizationId = req.user?.organizationId || null;
    const result = await auditService.getAuditStats(organizationId, resourceType);

    return res.json(result.stats);
  } catch (error) {
    return handleAuditError(res, error, "GET_AUDIT_STATS_ERROR");
  }
}
