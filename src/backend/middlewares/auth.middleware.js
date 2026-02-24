/**
 * Middleware de autenticación y roles
 */

import { AppError } from '../core/AppError.js';
import { createLogger } from '../core/Logger.js';
import { buildUserFromToken, decodeJwtToken, extractBearerToken } from '../../utils/jwt.js';

const logger = createLogger('AuthMiddleware');

/**
 * Verificar autenticación (token JWT válido)
 */
export async function authMiddleware(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw AppError.unauthorized('Token no proporcionado');
    }

    const decoded = decodeJwtToken(token);
    req.user = buildUserFromToken(decoded);
    req.organizationId = req.user.organizationId || null;
    req.orgId = req.user.organizationId || null;

    logger.debug('Usuario autenticado', { userId: req.user._id });
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }

    logger.warn('Token inválido', { error: error.message });
    return next(AppError.unauthorized('Token inválido o expirado'));
  }
}

/**
 * Verificar rol específico
 */
export function roleMiddleware(requiredRole) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Usuario no autenticado');
      }

      if (req.user.role !== requiredRole) {
        logger.warn(`Acceso denegado - rol requerido: ${requiredRole}`, {
          userId: req.user._id,
          userRole: req.user.role
        });
        throw AppError.forbidden(`Se requiere rol: ${requiredRole}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Verificar múltiples roles
 */
export function rolesMiddleware(allowedRoles) {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Usuario no autenticado');
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw AppError.forbidden(
          `Se requiere uno de estos roles: ${allowedRoles.join(', ')}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Verificar pertenencia a organización
 */
export function organizationMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.organizationId) {
      throw AppError.unauthorized('Organización no configurada');
    }

    // Agregar filtro de organización al request
    req.orgFilter = { organizationId: req.user.organizationId };
    req.organizationId = req.user.organizationId;
    req.orgId = req.user.organizationId;

    next();
  } catch (error) {
    next(error);
  }
}
