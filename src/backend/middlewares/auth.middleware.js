/**
 * Middleware de autenticación y roles
 */

import { AppError } from '../core/AppError.js';
import { createLogger } from '../core/Logger.js';

const logger = createLogger('AuthMiddleware');

/**
 * Verificar autenticación (token JWT válido)
 */
export async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw AppError.unauthorized('Token no proporcionado');
    }

    // Nota: La verificación real del JWT debe estar en tu middleware existente
    // Este es un placeholder que asume que req.user ya está poblado
    if (!req.user) {
      throw AppError.unauthorized('Usuario no autenticado');
    }

    logger.debug('Usuario autenticado', { userId: req.user._id });
    next();
  } catch (error) {
    next(error);
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

    next();
  } catch (error) {
    next(error);
  }
}
