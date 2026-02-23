/**
 * Organization Routes
 * Rutas para gestión de organizaciones
 */

import { Router } from 'express';
import {
  createOrganization,
  getOrganizations,
  getOrganizationDetails,
  updateOrganization,
  deleteOrganization,
  getOrganizationStats,
  verifyLimits
} from './organization.controller.js';

const router = Router();

/**
 * POST /api/v2/organizations
 * Crear organización
 */
router.post('/', createOrganization);

/**
 * GET /api/v2/organizations
 * Listar organizaciones
 */
router.get('/', getOrganizations);

/**
 * GET /api/v2/organizations/:orgId
 * Obtener detalles de organización
 */
router.get('/:orgId', getOrganizationDetails);

/**
 * PUT /api/v2/organizations/:orgId
 * Actualizar organización
 */
router.put('/:orgId', updateOrganization);

/**
 * DELETE /api/v2/organizations/:orgId
 * Eliminar organización
 */
router.delete('/:orgId', deleteOrganization);

/**
 * GET /api/v2/organizations/:orgId/stats
 * Estadísticas de organización
 */
router.get('/:orgId/stats', getOrganizationStats);

/**
 * GET /api/v2/organizations/:orgId/limits/:resourceType
 * Verificar límites
 */
router.get('/:orgId/limits/:resourceType', verifyLimits);

export default router;
