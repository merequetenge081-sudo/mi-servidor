/**
 * Organization Repository
 * Operaciones sobre el modelo Organization
 */

import { Organization } from '../../../models/Organization.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('OrganizationRepository');

/**
 * Crea una nueva organización
 */
export async function createOrganization(orgData) {
  try {
    logger.debug('Creating organization', { name: orgData.name });

    const org = new Organization(orgData);
    await org.save();

    logger.info('Organization created', { orgId: org._id.toString() });
    return org.toObject();
  } catch (error) {
    logger.error('Error creating organization', { error: error.message });
    throw AppError.internal('Error creating organization');
  }
}

/**
 * Obtiene todas las organizaciones
 */
export async function getOrganizations(filter = {}, limit = 0, skip = 0) {
  try {
    logger.debug('Fetching organizations', { filter, limit, skip });

    let query = Organization.find(filter);
    
    if (limit > 0) {
      query = query.limit(limit).skip(skip);
    }

    const orgs = await query.sort({ createdAt: -1 }).lean();
    return orgs;
  } catch (error) {
    logger.error('Error fetching organizations', { error: error.message });
    throw AppError.internal('Error fetching organizations');
  }
}

/**
 * Obtiene una organización por ID
 */
export async function getOrganizationById(orgId) {
  try {
    logger.debug('Fetching organization', { orgId });

    const org = await Organization.findById(orgId).lean();

    if (!org) {
      throw AppError.notFound(`Organization ${orgId} not found`);
    }

    return org;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching organization', { error: error.message });
    throw AppError.internal('Error fetching organization');
  }
}

/**
 * Obtiene una organización por slug
 */
export async function getOrganizationBySlug(slug) {
  try {
    const org = await Organization.findOne({ slug }).lean();
    return org || null;
  } catch (error) {
    logger.error('Error fetching organization by slug', { error: error.message });
    throw AppError.internal('Error fetching organization');
  }
}

/**
 * Actualiza una organización
 */
export async function updateOrganization(orgId, updateData) {
  try {
    logger.debug('Updating organization', { orgId, updateData });

    const org = await Organization.findByIdAndUpdate(orgId, updateData, {
      new: true,
      runValidators: true
    });

    if (!org) {
      throw AppError.notFound(`Organization ${orgId} not found`);
    }

    logger.info('Organization updated', { orgId });
    return org.toObject();
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error updating organization', { error: error.message });
    throw AppError.internal('Error updating organization');
  }
}

/**
 * Elimina una organización
 */
export async function deleteOrganization(orgId) {
  try {
    logger.debug('Deleting organization', { orgId });

    const org = await Organization.findByIdAndDelete(orgId);

    if (!org) {
      throw AppError.notFound(`Organization ${orgId} not found`);
    }

    logger.info('Organization deleted', { orgId });
    return org.toObject();
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error deleting organization', { error: error.message });
    throw AppError.internal('Error deleting organization');
  }
}

/**
 * Cuenta organizaciones
 */
export async function countOrganizations(filter = {}) {
  try {
    const count = await Organization.countDocuments(filter);
    return count;
  } catch (error) {
    logger.error('Error counting organizations', { error: error.message });
    throw AppError.internal('Error counting organizations');
  }
}

/**
 * Incrementa counters de una organización
 */
export async function incrementCounter(orgId, field, amount = 1) {
  try {
    const org = await Organization.findByIdAndUpdate(
      orgId,
      { $inc: { [field]: amount } },
      { new: true }
    );

    if (!org) {
      throw AppError.notFound(`Organization ${orgId} not found`);
    }

    return org.toObject();
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error incrementing counter', { error: error.message });
    throw AppError.internal('Error incrementing counter');
  }
}

/**
 * Verifica si organización tiene límites disponibles
 */
export async function checkLimits(orgId, resourceType) {
  try {
    const org = await Organization.findById(orgId).lean();

    if (!org) {
      throw AppError.notFound(`Organization ${orgId} not found`);
    }

    const limits = {
      leaders: { current: org.leadersCount, max: org.maxLeaders },
      events: { current: org.eventsCount, max: org.maxEvents },
      registrations: { current: org.registrationsCount, max: org.maxRegistrationsPerEvent }
    };

    const resource = limits[resourceType];
    if (!resource) {
      throw AppError.badRequest(`Invalid resource type: ${resourceType}`);
    }

    return {
      resourceType,
      current: resource.current,
      max: resource.max,
      available: resource.max - resource.current,
      exceeded: resource.current >= resource.max
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error checking limits', { error: error.message });
    throw AppError.internal('Error checking limits');
  }
}

export default {
  createOrganization,
  getOrganizations,
  getOrganizationById,
  getOrganizationBySlug,
  updateOrganization,
  deleteOrganization,
  countOrganizations,
  incrementCounter,
  checkLimits
};
