/**
 * Organization Controller
 * Endpoints HTTP para organizaciones
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import organizationService from './organization.service.js';
import { AuditService } from '../../../services/audit.service.js';

const logger = createLogger('OrganizationController');

/**
 * POST /api/v2/organizations
 * Crea una nueva organización
 */
export async function createOrganization(req, res, next) {
  try {
    const { name, email, phone, plan = 'free', adminId } = req.body;
    const user = req.user;

    logger.info('Create organization requested', { name, plan });

    const org = await organizationService.createOrganization({
      name,
      email,
      phone,
      plan,
      adminId
    });

    // Audit log
    await AuditService.log(
      'CREATE',
      'Organization',
      org._id.toString(),
      user,
      { name, plan },
      `Organization ${name} created`,
      req
    );

    res.status(201).json({
      success: true,
      message: 'Organization created',
      data: org
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/organizations
 * Obtiene todas las organizaciones
 */
export async function getOrganizations(req, res, next) {
  try {
    const { page = 1, limit = 50 } = req.query;

    logger.info('Get organizations requested', { page, limit });

    const result = await organizationService.getOrganizations({}, page, limit);

    res.json({
      success: true,
      message: 'Organizations',
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/organizations/:orgId
 * Obtiene detalles de una organización
 */
export async function getOrganizationDetails(req, res, next) {
  try {
    const { orgId } = req.params;

    logger.info('Get organization details requested', { orgId });

    const org = await organizationService.getOrganizationDetails(orgId);

    res.json({
      success: true,
      message: 'Organization Details',
      data: org
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v2/organizations/:orgId
 * Actualiza una organización
 */
export async function updateOrganization(req, res, next) {
  try {
    const { orgId } = req.params;
    const { name, email, phone, plan, status } = req.body;
    const user = req.user;

    logger.info('Update organization requested', { orgId });

    const result = await organizationService.updateOrganization(orgId, {
      name,
      email,
      phone,
      plan,
      status
    });

    // Audit log
    await AuditService.log(
      'UPDATE',
      'Organization',
      orgId,
      user,
      result.changes,
      `Organization ${result.org.name} updated`,
      req
    );

    res.json({
      success: true,
      message: 'Organization updated',
      data: result.org,
      changes: result.changes
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v2/organizations/:orgId
 * Elimina una organización
 */
export async function deleteOrganization(req, res, next) {
  try {
    const { orgId } = req.params;
    const user = req.user;

    logger.info('Delete organization requested', { orgId });

    const org = await organizationService.deleteOrganization(orgId);

    // Audit log
    await AuditService.log(
      'DELETE',
      'Organization',
      orgId,
      user,
      { name: org.name, plan: org.plan },
      `Organization ${org.name} deleted`,
      req
    );

    res.json({
      success: true,
      message: 'Organization deleted'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/organizations/:orgId/stats
 * Obtiene estadísticas de una organización
 */
export async function getOrganizationStats(req, res, next) {
  try {
    const { orgId } = req.params;

    logger.info('Get organization stats requested', { orgId });

    const stats = await organizationService.getOrganizationStats(orgId);

    res.json({
      success: true,
      message: 'Organization Statistics',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/organizations/:orgId/limits/:resourceType
 * Verifica límites de una organización
 */
export async function verifyLimits(req, res, next) {
  try {
    const { orgId, resourceType } = req.params;

    logger.info('Verify limits requested', { orgId, resourceType });

    const limits = await organizationService.verifyLimits(orgId, resourceType);

    res.json({
      success: true,
      message: 'Resource Limits',
      data: limits
    });
  } catch (error) {
    next(error);
  }
}

export default {
  createOrganization,
  getOrganizations,
  getOrganizationDetails,
  updateOrganization,
  deleteOrganization,
  getOrganizationStats,
  verifyLimits
};
