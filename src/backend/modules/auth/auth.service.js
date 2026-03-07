/**
 * Auth Service
 * Lógica de negocio para autenticación
 */

import jwt from 'jsonwebtoken';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import authRepository from './auth.repository.js';
import { emailService } from '../../../services/emailService.js';
import config from '../../config/config.js';
import { decodeJwtToken } from '../../../utils/jwt.js';
import crypto from 'crypto';
import * as authFallback from '../../../utils/authFallback.js';
import { isTempPasswordExpired } from '../../../utils/tempPassword.js';

const { findAdminLocal, findLeaderLocal, verifyPasswordLocal } = authFallback;

const logger = createLogger('AuthService');

/**
 * Login de admin - con fallback a memoria
 */
export async function adminLogin(username, password) {
  try {
    if (!username || !password) {
      throw AppError.badRequest('Username y password requeridos');
    }

    let admin;
    let isValid;

    // Intentar fallback en memoria primero
    try {
      admin = await findAdminLocal(username);
      if (admin) {
        isValid = await verifyPasswordLocal(password, admin.passwordHash);
        if (isValid) {
          logger.info('Login admin desde memoria', { username });
        }
      }
    } catch (fallbackError) {
      logger.debug('Fallback en memoria no disponible, intentando MongoDB');
    }

    // Si no está en memoria, intentar MongoDB
    if (!admin || !isValid) {
      try {
        admin = await authRepository.findAdminByUsername(username);
        if (admin) {
          isValid = await authRepository.verifyPassword(password, admin.passwordHash);
        }
      } catch (mongoError) {
        logger.warn('MongoDB no disponible para login', { username });
      }
    }

    if (!admin) {
      logger.warn('Intento de login con user inexistente', { username });
      throw AppError.unauthorized('Credenciales inválidas');
    }

    if (!isValid) {
      logger.warn('Intento de login con contraseña incorrecta', { username });
      throw AppError.unauthorized('Credenciales inválidas');
    }

    logger.success('Admin login exitoso', { username });
    
    // Generar JWT
    const token = jwt.sign(
      {
        userId: admin._id,
        role: 'admin',
        username: admin.username,
        email: admin.email,
        organizationId: admin.organizationId
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return { token, admin: { ...admin.toObject?.(), passwordHash: undefined } };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Admin login error', error);
    throw AppError.serverError('Error en login de admin');
  }
}

/**
 * Login de líder - con fallback a memoria
 */
export async function leaderLogin(email, password) {
  try {
    if (!email || !password) {
      throw AppError.badRequest('Email y password requeridos');
    }

    let leader;
    let isValid;

    // Intentar fallback en memoria primero
    try {
      leader = await findLeaderLocal(email);
      if (leader) {
        isValid = await verifyPasswordLocal(password, leader.passwordHash);
        if (isValid) {
          logger.info('Login líder desde memoria', { email });
        }
      }
    } catch (fallbackError) {
      logger.debug('Fallback en memoria no disponible, intentando MongoDB');
    }

    // Si no está en memoria, intentar MongoDB
    if (!leader || !isValid) {
      try {
        leader = await authRepository.findLeaderByEmail(email);
        if (leader) {
          isValid = await authRepository.verifyPassword(password, leader.passwordHash);
        }
      } catch (mongoError) {
        logger.warn('MongoDB no disponible para login', { email });
      }
    }

    if (!leader) {
      logger.warn('Intento de login con email inexistente', { email });
      throw AppError.unauthorized('Credenciales inválidas');
    }

    if (!isValid) {
      logger.warn('Intento de login con contraseña incorrecta', { email });
      throw AppError.unauthorized('Credenciales inválidas');
    }

      if (isTempPasswordExpired(leader)) {
        await authRepository.clearLeaderTempPassword(leader._id);
        throw AppError.unauthorized('Contraseña temporal expirada. Solicita un reset.');
      }

    logger.success('Líder login exitoso', { email });

    // Generar JWT
    const token = jwt.sign(
      {
        userId: leader._id,
          leaderId: leader._id,
          role: 'leader',
        email: leader.email,
        name: leader.name,
        organizationId: leader.organizationId
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return { token, leader: { ...leader.toObject?.(), passwordHash: undefined } };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Líder login error', error);
    throw AppError.serverError('Error en login de líder');
  }
}

/**
 * Verificar token público del líder (para acceso sin contraseña desde URLs)
 * Genera un JWT temporal pero válido para iniciar sesión
 */
export async function verifyLeaderToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      throw AppError.badRequest('Token requerido y debe ser string');
    }

    // Buscar el líder por su token público
    const leader = await authRepository.findLeaderByToken(token);

    if (!leader) {
      logger.warn('Intento de acceso con token inválido');
      throw AppError.unauthorized('Token inválido o expirado');
    }

    logger.success('Líder verificado por token público', { leaderId: leader._id });

    // Generar JWT temporal (24 horas)
    const jwtToken = jwt.sign(
      {
        userId: leader._id,
          leaderId: leader._id,
          role: 'leader',
        email: leader.email,
        name: leader.name,
        organizationId: leader.organizationId,
        source: 'token_verification'
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    return { 
      token: jwtToken, 
      leaderId: leader._id,
      leader: { 
        _id: leader._id,
        leaderId: leader.leaderId,
        name: leader.name,
        email: leader.email,
        organizationId: leader.organizationId
      } 
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Líder token verification error', error);
    throw AppError.serverError('Error verificando token');
  }
}

/**
 * Cambiar contraseña
 */
export async function changePassword(userId, role, oldPassword, newPassword) {
  try {
    if (!oldPassword || !newPassword) {
      throw AppError.badRequest('Contraseña antigua y nueva requeridas');
    }

    if (newPassword.length < 8) {
      throw AppError.badRequest('La contraseña debe tener mínimo 8 caracteres');
    }

    let user, repository_method;
    
    if (role === 'admin') {
      user = await authRepository.findAdminById(userId);
      repository_method = authRepository.updateAdminPassword;
    } else {
      user = await authRepository.findLeaderById(userId);
      repository_method = authRepository.updateLeaderPassword;
    }

    if (!user) {
      throw AppError.notFound(`${role} no encontrado`);
    }

    // Verificar contraseña antigua
    const isValid = await authRepository.verifyPassword(oldPassword, user.passwordHash);
    if (!isValid) {
      throw AppError.unauthorized('Contraseña antigua incorrecta');
    }

    // Actualizar
    await repository_method(userId, newPassword);
    logger.success('Contraseña actualizada', { userId, role });

    return { message: 'Contraseña actualizada correctamente' };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Change password error', error);
    throw AppError.serverError('Error al cambiar contraseña');
  }
}

/**
 * Reset de contraseña (por email)
 */
export async function requestPasswordReset(email, role = 'leader') {
  try {
    if (!email) {
      throw AppError.badRequest('Email requerido');
    }

    let user;
    if (role === 'admin') {
      user = await authRepository.findAdminByUsername(email);
    } else {
      user = await authRepository.findLeaderByEmail(email);
    }

    if (!user) {
      // No revelar si existe o no por seguridad
      logger.warn('Password reset solicitado para user inexistente', { email, role });
      return { message: 'Si el usuario existe, recibirá un email de recuperación' };
    }

    // Generar token único
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Guardar token con expiración (1 hora)
    if (role === 'admin') {
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 3600000);
      await user.save();
    } else {
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 3600000);
      await user.save();
    }

    // Enviar email
    const resetUrl = `${config.baseUrl}/reset-password?token=${resetToken}`;
    
    try {
      await emailService.sendPasswordResetEmail(email, resetUrl, user.name || user.username);
      logger.success('Email de reset enviado', { email });
    } catch (emailError) {
      logger.warn('Error enviando email de reset', { error: emailError.message });
    }

    return { message: 'Si el usuario existe, recibirá un email de recuperación' };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Password reset request error', error);
    throw AppError.serverError('Error al solicitar reset de contraseña');
  }
}

/**
 * Reset de contraseña con token
 */
export async function resetPasswordWithToken(token, newPassword, role = 'leader') {
  try {
    if (!token || !newPassword) {
      throw AppError.badRequest('Token y nueva contraseña requeridos');
    }

    if (newPassword.length < 8) {
      throw AppError.badRequest('La contraseña debe tener mínimo 8 caracteres');
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    let user;
    if (role === 'admin') {
      user = await authRepository.Admin?.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    } else {
      user = await authRepository.Leader?.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    }

    if (!user) {
      throw AppError.badRequest('Token inválido o expirado');
    }

    // Actualizar contraseña
    const hashedPassword = await authRepository.hashPassword(newPassword);
    user.passwordHash = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.success('Contraseña reseteada', { role });
    return { message: 'Contraseña actualizada correctamente' };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Password reset error', error);
    throw AppError.serverError('Error al resetear contraseña');
  }
}

/**
 * Verificar token JWT
 */
export function verifyToken(token) {
  try {
    const decoded = decodeJwtToken(token);
    logger.debug('Token verificado', { userId: decoded.userId });
    return decoded;
  } catch (error) {
    logger.warn('Token inválido', { error: error.message });
    throw AppError.unauthorized('Token inválido o expirado');
  }
}

/**
 * Generar contraseña temporal
 */
export function generateTemporaryPassword() {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Impersonar líder (Acceder como líder desde admin)
 */
export async function impersonateLeader(adminUser, adminPassword, leaderId) {
  try {
    if (!adminUser || adminUser.role !== 'admin') {
      throw AppError.unauthorized('Solo los administradores pueden usar esta función');
    }

    const { Admin } = await import('../../../models/Admin.js');
    const adminRec = await Admin.findById(adminUser.userId);
    
    if (!adminRec) {
        throw AppError.unauthorized('Administrador no encontrado');
    }

    // Verify admin password
    const isPasswordValid = await authRepository.verifyPassword(adminPassword, adminRec.passwordHash);
    if (!isPasswordValid) {
        throw AppError.unauthorized('Contraseña de administrador incorrecta');
    }

    const leader = await authRepository.findLeaderById(leaderId);
    if (!leader) {
        throw AppError.notFound('Líder no encontrado');
    }

    // Check organization boundaries
    if (adminRec.organizationId && String(adminRec.organizationId) !== String(leader.organizationId)) {
        throw AppError.forbidden('No puedes acceder a un líder de otra organización');
    }

    // Generate token for leader
    const token = jwt.sign(
      {
        userId: leader._id,
        leaderId: leader._id,
        role: 'leader',
        email: leader.email,
        name: leader.name,
        organizationId: leader.organizationId
      },
      config.jwtSecret,
      { expiresIn: '2h' } // Short lived token for impersonation
    );

    return {
      token,
      leaderId: leader._id,
      leader: {
        id: leader._id,
        name: leader.name,
        email: leader.email,
        phone: leader.phone
      }
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Impersonate error', error);
    throw AppError.serverError('Error al intentar acceder como líder');
  }
}

export default {
  adminLogin,
  leaderLogin,
  verifyLeaderToken,
  changePassword,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyToken,
  generateTemporaryPassword,
  impersonateLeader
};
