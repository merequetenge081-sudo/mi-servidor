/**
 * Auth Repository
 * Acceso a datos para autenticación
 */

import { Admin } from '../../../models/Admin.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import bcryptjs from 'bcryptjs';

const logger = createLogger('AuthRepository');

/**
 * Buscar admin por username
 */
export async function findAdminByUsername(username) {
  try {
    const admin = await Admin.findOne({ username });
    if (admin) {
      logger.debug('Admin encontrado', { username });
    }
    return admin;
  } catch (error) {
    logger.error('Error buscando admin', error);
    throw AppError.serverError('Error al buscar admin');
  }
}

/**
 * Buscar líder por email
 */
export async function findLeaderByEmail(email) {
  try {
    const leader = await Leader.findOne({ email });
    if (leader) {
      logger.debug('Líder encontrado', { email });
    }
    return leader;
  } catch (error) {
    logger.error('Error buscando líder', error);
    throw AppError.serverError('Error al buscar líder');
  }
}

/**
 * Buscar líder por cedula
 */
export async function findLeaderByCedula(cedula) {
  try {
    const leader = await Leader.findOne({ cedula });
    if (leader) {
      logger.debug('Líder encontrado por cédula', { cedula });
    }
    return leader;
  } catch (error) {
    logger.error('Error buscando líder por cédula', error);
    throw AppError.serverError('Error al buscar líder');
  }
}

/**
 * Buscar admin por ID
 */
export async function findAdminById(id) {
  try {
    const admin = await Admin.findById(id);
    return admin;
  } catch (error) {
    logger.error('Error buscando admin por ID', error);
    throw AppError.serverError('Error al buscar admin');
  }
}

/**
 * Buscar líder por ID
 */
export async function findLeaderById(id) {
  try {
    const leader = await Leader.findById(id);
    return leader;
  } catch (error) {
    logger.error('Error buscando líder por ID', error);
    throw AppError.serverError('Error al buscar líder');
  }
}

/**
 * Actualizar contraseña de admin
 */
export async function updateAdminPassword(adminId, newPassword) {
  try {
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { passwordHash: hashedPassword, lastPasswordChange: new Date() },
      { new: true }
    );
    logger.success('Contraseña de admin actualizada', { adminId });
    return admin;
  } catch (error) {
    logger.error('Error actualizando contraseña admin', error);
    throw AppError.serverError('Error al actualizar contraseña');
  }
}

/**
 * Actualizar contraseña de líder
 */
export async function updateLeaderPassword(leaderId, newPassword) {
  try {
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    const leader = await Leader.findByIdAndUpdate(
      leaderId,
      { passwordHash: hashedPassword, lastPasswordChange: new Date() },
      { new: true }
    );
    logger.success('Contraseña de líder actualizada', { leaderId });
    return leader;
  } catch (error) {
    logger.error('Error actualizando contraseña líder', error);
    throw AppError.serverError('Error al actualizar contraseña');
  }
}

/**
 * Validar contraseña con hash
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  try {
    return await bcryptjs.compare(plainPassword, hashedPassword);
  } catch (error) {
    logger.error('Error verificando contraseña', error);
    throw AppError.serverError('Error al verificar contraseña');
  }
}

/**
 * Generar hash de contraseña
 */
export async function hashPassword(password) {
  try {
    return await bcryptjs.hash(password, 10);
  } catch (error) {
    logger.error('Error generando hash', error);
    throw AppError.serverError('Error al procesar contraseña');
  }
}

export default {
  findAdminByUsername,
  findLeaderByEmail,
  findLeaderByCedula,
  findAdminById,
  findLeaderById,
  updateAdminPassword,
  updateLeaderPassword,
  verifyPassword,
  hashPassword
};
