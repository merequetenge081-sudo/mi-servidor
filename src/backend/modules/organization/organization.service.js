/**
 * Organization Service
 * Lógica de negocio para organizaciones
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import organizationRepository from './organization.repository.js';

const logger = createLogger('OrganizationService');

// Plan configuration
const PLAN_CONFIG = {
  free: {
    maxLeaders: 10,
    maxEvents: 5,
    maxRegistrationsPerEvent: 500
  },
  pro: {
    maxLeaders: 100,
    maxEvents: 50,
    maxRegistrationsPerEvent: 5000
  },
  enterprise: {
    maxLeaders: 10000,
    maxEvents: 10000,
    maxRegistrationsPerEvent: 100000
  }
};

/**
 * Genera slug a partir de nombre
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Crea una nueva organización
 */
export async function createOrganization(orgData) {
  try {
    const { name, email, phone, plan = 'free', adminId } = orgData;

    // Validar datos requeridos
    if (!name || !email || !adminId) {
      throw AppError.badRequest('name, email, and adminId are required');
    }

    // Validar plan
    if (!PLAN_CONFIG[plan]) {
      throw AppError.badRequest(`Invalid plan: ${plan}. Must be one of: free, pro, enterprise`);
    }

    // Generar slug
    const slug = generateSlug(name);

    // Verificar que slug no exista
    const existing = await organizationRepository.getOrganizationBySlug(slug);
    if (existing) {
      throw AppError.conflict('An organization with that name already exists');
    }

    // Obtener límites según plan
    const limits = PLAN_CONFIG[plan];

    // Crear organización
    const newOrg = await organizationRepository.createOrganization({
      name,
      slug,
      email,
      phone,
      adminId,
      plan,
      status: 'active',
      maxLeaders: limits.maxLeaders,
      maxEvents: limits.maxEvents,
      maxRegistrationsPerEvent: limits.maxRegistrationsPerEvent,
      leadersCount: 0,
      eventsCount: 0,
      registrationsCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    logger.info('Organization created successfully', { orgId: newOrg._id, name, plan });
    return newOrg;
  } catch (error) {
    logger.error('Error creating organization', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error creating organization');
  }
}

/**
 * Obtiene todas las organizaciones
 */
export async function getOrganizations(filter = {}, page = 1, limit = 50) {
  try {
    const skip = (page - 1) * limit;
    const [orgs, total] = await Promise.all([
      organizationRepository.getOrganizations(filter, limit, skip),
      organizationRepository.countOrganizations(filter)
    ]);

    const pages = Math.ceil(total / limit);

    return {
      data: orgs,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages }
    };
  } catch (error) {
    logger.error('Error fetching organizations', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching organizations');
  }
}

/**
 * Obtiene detalles de una organización
 */
export async function getOrganizationDetails(orgId) {
  try {
    const org = await organizationRepository.getOrganizationById(orgId);
    return org;
  } catch (error) {
    logger.error('Error fetching organization details', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching organization');
  }
}

/**
 * Actualiza una organización
 */
export async function updateOrganization(orgId, updateData) {
  try {
    // Obtener org actual para tracking de cambios
    const current = await organizationRepository.getOrganizationById(orgId);

    // Preparar datos actualizados
    const toUpdate = { updatedAt: new Date() };
    const changes = {};

    // Validar y aplicar cambios
    if (updateData.name !== undefined && updateData.name !== current.name) {
      toUpdate.name = updateData.name;
      changes.name = { old: current.name, new: updateData.name };

      // Si cambia nombre, actualizar slug
      const newSlug = generateSlug(updateData.name);
      const existingSlug = await organizationRepository.getOrganizationBySlug(newSlug);
      if (existingSlug && existingSlug._id.toString() !== orgId) {
        throw AppError.conflict('An organization with that name already exists');
      }
      toUpdate.slug = newSlug;
    }

    if (updateData.email !== undefined && updateData.email !== current.email) {
      toUpdate.email = updateData.email;
      changes.email = { old: current.email, new: updateData.email };
    }

    if (updateData.phone !== undefined && updateData.phone !== current.phone) {
      toUpdate.phone = updateData.phone;
      changes.phone = { old: current.phone, new: updateData.phone };
    }

    if (updateData.plan !== undefined && updateData.plan !== current.plan) {
      if (!PLAN_CONFIG[updateData.plan]) {
        throw AppError.badRequest(`Invalid plan: ${updateData.plan}`);
      }
      const limits = PLAN_CONFIG[updateData.plan];
      toUpdate.plan = updateData.plan;
      toUpdate.maxLeaders = limits.maxLeaders;
      toUpdate.maxEvents = limits.maxEvents;
      toUpdate.maxRegistrationsPerEvent = limits.maxRegistrationsPerEvent;
      changes.plan = { old: current.plan, new: updateData.plan };
      changes.limits = limits;
    }

    if (updateData.status !== undefined && updateData.status !== current.status) {
      toUpdate.status = updateData.status;
      changes.status = { old: current.status, new: updateData.status };
    }

    // Actualizar
    const updated = await organizationRepository.updateOrganization(orgId, toUpdate);

    logger.info('Organization updated', { orgId, changes });
    return { org: updated, changes };
  } catch (error) {
    logger.error('Error updating organization', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error updating organization');
  }
}

/**
 * Elimina una organización
 */
export async function deleteOrganization(orgId) {
  try {
    const org = await organizationRepository.deleteOrganization(orgId);
    logger.info('Organization deleted', { orgId, name: org.name });
    return org;
  } catch (error) {
    logger.error('Error deleting organization', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error deleting organization');
  }
}

/**
 * Obtiene estadísticas de una organización
 */
export async function getOrganizationStats(orgId) {
  try {
    const org = await organizationRepository.getOrganizationById(orgId);

    return {
      orgId: org._id,
      name: org.name,
      plan: org.plan,
      status: org.status,
      stats: {
        leadersCount: org.leadersCount,
        eventsCount: org.eventsCount,
        registrationsCount: org.registrationsCount
      },
      limits: {
        maxLeaders: org.maxLeaders,
        maxEvents: org.maxEvents,
        maxRegistrationsPerEvent: org.maxRegistrationsPerEvent
      },
      usage: {
        leaders: {
          current: org.leadersCount,
          max: org.maxLeaders,
          percentage: Math.round((org.leadersCount / org.maxLeaders) * 100)
        },
        events: {
          current: org.eventsCount,
          max: org.maxEvents,
          percentage: Math.round((org.eventsCount / org.maxEvents) * 100)
        },
        registrations: {
          current: org.registrationsCount,
          max: org.maxRegistrationsPerEvent,
          percentage: Math.round((org.registrationsCount / org.maxRegistrationsPerEvent) * 100)
        }
      }
    };
  } catch (error) {
    logger.error('Error getting organization stats', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching organization stats');
  }
}

/**
 * Verifica límites de una organización
 */
export async function verifyLimits(orgId, resourceType) {
  try {
    const limits = await organizationRepository.checkLimits(orgId, resourceType);
    return limits;
  } catch (error) {
    logger.error('Error verifying limits', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error verifying limits');
  }
}

/**
 * Incrementa contador de recursos
 */
export async function incrementResourceCount(orgId, resourceType) {
  try {
    const fieldMap = {
      leaders: 'leadersCount',
      events: 'eventsCount',
      registrations: 'registrationsCount'
    };

    const field = fieldMap[resourceType];
    if (!field) {
      throw AppError.badRequest(`Invalid resource type: ${resourceType}`);
    }

    // Verificar límites antes de incrementar
    const limits = await organizationRepository.checkLimits(orgId, resourceType);
    if (limits.exceeded) {
      throw AppError.conflict(`${resourceType} limit reached for this organization`);
    }

    const org = await organizationRepository.incrementCounter(orgId, field, 1);
    return org;
  } catch (error) {
    logger.error('Error incrementing resource count', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error incrementing resource count');
  }
}

export default {
  createOrganization,
  getOrganizations,
  getOrganizationDetails,
  updateOrganization,
  deleteOrganization,
  getOrganizationStats,
  verifyLimits,
  incrementResourceCount
};
