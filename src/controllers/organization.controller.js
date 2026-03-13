import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import organizationService from "../backend/modules/organization/organization.service.js";

function handleOrganizationError(res, error, fallbackMessage, fallbackCode) {
  logger.error(fallbackMessage, { error: error.message, stack: error.stack });
  const status = error?.statusCode || 500;
  const code = error?.name === "AppError" ? fallbackCode : `${fallbackCode}_UNEXPECTED`;
  return sendError(res, status, error?.message || fallbackMessage, code, error?.details ?? error?.message);
}

export async function createOrganization(req, res) {
  try {
    const { name, email, phone, plan = "free", adminId } = req.body;
    const user = req.user;

    const org = await organizationService.createOrganization({
      name,
      email,
      phone,
      plan,
      adminId
    });

    await AuditService.log(
      "CREATE",
      "Organization",
      org._id.toString(),
      user,
      { name, plan },
      `Organización ${name} creada`,
      req
    );

    logger.info("Organization created", { orgId: org._id, name });
    return res.status(201).json(org);
  } catch (error) {
    return handleOrganizationError(res, error, "Create organization error", "CREATE_ORGANIZATION_ERROR");
  }
}

export async function getOrganizations(req, res) {
  try {
    const { page = 1, limit = 1000 } = req.query;
    const result = await organizationService.getOrganizations({}, page, limit);
    return res.json(result.data);
  } catch (error) {
    return handleOrganizationError(res, error, "Get organizations error", "GET_ORGANIZATIONS_ERROR");
  }
}

export async function getOrganizationDetails(req, res) {
  try {
    const { orgId } = req.params;
    const org = await organizationService.getOrganizationDetails(orgId);
    return res.json(org);
  } catch (error) {
    return handleOrganizationError(res, error, "Get organization error", "GET_ORGANIZATION_DETAILS_ERROR");
  }
}

export async function updateOrganization(req, res) {
  try {
    const { orgId } = req.params;
    const { name, email, phone, plan, status } = req.body;
    const user = req.user;

    const result = await organizationService.updateOrganization(orgId, {
      name,
      email,
      phone,
      plan,
      status
    });

    await AuditService.log(
      "UPDATE",
      "Organization",
      result.org._id.toString(),
      user,
      result.changes,
      `Organización ${result.org.name} actualizada`,
      req
    );

    logger.info("Organization updated", { orgId: result.org._id });
    return res.json(result.org);
  } catch (error) {
    return handleOrganizationError(res, error, "Update organization error", "UPDATE_ORGANIZATION_ERROR");
  }
}

export async function deleteOrganization(req, res) {
  try {
    const { orgId } = req.params;
    const user = req.user;

    const org = await organizationService.deleteOrganization(orgId);

    await AuditService.log(
      "DELETE",
      "Organization",
      orgId,
      user,
      { name: org.name, plan: org.plan },
      `Organización ${org.name} eliminada`,
      req
    );

    logger.info("Organization deleted", { orgId });
    return res.json({ message: "Organización eliminada" });
  } catch (error) {
    return handleOrganizationError(res, error, "Delete organization error", "DELETE_ORGANIZATION_ERROR");
  }
}

export async function getOrganizationStats(req, res) {
  try {
    const { orgId } = req.params;
    const stats = await organizationService.getOrganizationStats(orgId);

    return res.json({
      orgId: stats.orgId,
      name: stats.name,
      plan: stats.plan,
      status: stats.status,
      stats: stats.stats,
      limits: stats.limits,
      usage: {
        leaders: `${stats.usage.leaders.current}/${stats.usage.leaders.max}`,
        events: `${stats.usage.events.current}/${stats.usage.events.max}`
      }
    });
  } catch (error) {
    return handleOrganizationError(res, error, "Get organization stats error", "GET_ORGANIZATION_STATS_ERROR");
  }
}
