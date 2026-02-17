/**
 * Organization middleware - Extracts organizationId from JWT token
 * and ensures user belongs to the organization
 */

import { Organization } from "../models/Organization.js";
import logger from "../config/logger.js";

export async function organizationMiddleware(req, res, next) {
  try {
    // Solo validar si el usuario está autenticado (req.user existe)
    if (!req.user) {
      return next(); // Skip si no hay usuario, dejar pasar
    }

    // Extract from JWT token (already decoded by authMiddleware)
    const organizationId = req.user?.organizationId;
    
    // If organizationId is present, verify organization is active
    if (organizationId) {
      const org = await Organization.findById(organizationId);
      
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      if (org.status !== 'active') {
        return res.status(403).json({ error: "Organization is not active" });
      }
      
      // Attach to request for use in controllers
      req.organization = org;
      req.organizationId = organizationId;
    }
    
    next();
  } catch (error) {
    logger.error("Organization middleware error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Organization validation failed" });
  }
}

/**
 * Build organization filter for queries
 * Returns empty object if no organizationId (backward compatibility)
 */
export function buildOrgFilter(req) {
  if (req.organizationId) {
    return { organizationId: req.organizationId };
  }
  return {}; // No filter if no organization
}

/**
 * Ensure request has organization scope
 */
export function requireOrganization(req, res, next) {
  if (!req.organizationId) {
    return res.status(403).json({ 
      error: "Organization context required for this operation" 
    });
  }
  next();
}

/**
 * Advanced role middleware with organization scope
 * Supports dynamic roles: super_admin, org_admin, leader, viewer
 */
export function organizationRoleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role || req.user?.userRole;
    
    // super_admin can do anything
    if (userRole === 'super_admin') {
      return next();
    }
    
    // org_admin can manage their organization
    if (userRole === 'org_admin' && req.organizationId) {
      return next();
    }
    
    // Check against allowed roles
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    
    return res.status(403).json({ 
      error: "Insufficient permissions for this action" 
    });
  };
}
