/**
 * Auth Controller
 * Endpoints HTTP para autenticación
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import authService from './auth.service.js';

const logger = createLogger('AuthController');

/**
 * POST /api/v2/auth/admin-login
 * Login de administrador
 */
export async function adminLogin(req, res, next) {
  try {
    const { username, password } = req.body;

    logger.info('Intento de login admin', { username });

    if (!username || !password) {
      throw AppError.badRequest('Username y password requeridos');
    }

    const result = await authService.adminLogin(username, password);
    
    logger.success('Login admin exitoso', { username });
    res.json({
      success: true,
      message: 'Login exitoso',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/leader-login
 * Login de líder
 */
export async function leaderLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    logger.info('Intento de login líder', { email });

    if (!email || !password) {
      throw AppError.badRequest('Email y password requeridos');
    }

    const result = await authService.leaderLogin(email, password);
    
    logger.success('Login líder exitoso', { email });
    res.json({
      success: true,
      message: 'Login exitoso',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/change-password
 * Cambiar contraseña (requiere autenticación)
 */
export async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.userId;
    const role = req.user.role;

    logger.info('Cambio de contraseña', { userId, role });

    if (!oldPassword || !newPassword) {
      throw AppError.badRequest('Contraseña antigua y nueva requeridas');
    }

    const result = await authService.changePassword(userId, role, oldPassword, newPassword);
    
    logger.success('Contraseña actualizada', { userId });
    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/request-password-reset
 * Solicitar reset de contraseña (público)
 */
export async function requestPasswordReset(req, res, next) {
  try {
    const { email, role } = req.body;

    logger.info('Solicitud de reset de contraseña', { email, role });

    if (!email) {
      throw AppError.badRequest('Email requerido');
    }

    const result = await authService.requestPasswordReset(email, role || 'leader');
    
    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/reset-password
 * Reset de contraseña con token (público)
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, newPassword, role } = req.body;

    logger.info('Reset de contraseña con token');

    if (!token || !newPassword) {
      throw AppError.badRequest('Token y contraseña nueva requeridos');
    }

    const result = await authService.resetPasswordWithToken(token, newPassword, role || 'leader');
    
    logger.success('Contraseña reseteada');
    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/verify-token
 * Verificar que el token es válido (requiere autenticación)
 */
export async function verifyToken(req, res, next) {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    logger.debug('Verificación de token', { userId, role });

    res.json({
      success: true,
      message: 'Token válido',
      data: {
        userId,
        role,
        tokenValid: true
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/verify-leader-token
 * Verificar token público del líder (para acceso desde URLs sin contraseña)
 * @public - SIN autenticación requerida
 * @param {string} token - Token público del líder
 */
export async function verifyLeaderToken(req, res, next) {
  try {
    const { token } = req.body;

    logger.info('Verificación de token público de líder');

    if (!token) {
      throw AppError.badRequest('Token requerido');
    }

    const result = await authService.verifyLeaderToken(token);
    
    logger.success('Líder verificado exitosamente por token', { leaderId: result.leaderId });
    res.json({
      success: true,
      message: 'Token válido',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/logout
 * Logout (simplemente retorna confirmación)
 */
export async function logout(req, res, next) {
  try {
    logger.info('Logout', { userId: req.user?.userId });

    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/auth/impersonate
 * Login as leader using admin credentials
 */
export async function impersonateLeader(req, res, next) {
  try {
    const { adminPassword, leaderId } = req.body;
    const adminUser = req.user;

    logger.info('Intento de impersonate', { admin: adminUser?.username, leaderId });

    if (!adminPassword || !leaderId) {
        throw AppError.badRequest('Contraseña de administrador e ID del líder requeridos');
    }

    const result = await authService.impersonateLeader(adminUser, adminPassword, leaderId);

    logger.success('Impersonate exitoso', { admin: adminUser.username, leaderId });
    res.json({
        success: true,
        message: 'Sesión de líder iniciada correctamente',
        data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  adminLogin,
  leaderLogin,
  changePassword,
  requestPasswordReset,
  resetPassword,
  verifyToken,
  verifyLeaderToken,
  logout,
  impersonateLeader
};
