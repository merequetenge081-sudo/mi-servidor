/**
 * Leader Service
 * Capa de lógica de negocio para líderes
 * Orquesta operaciones entre repository, utilidades externas, etc.
 */

import leaderRepository from './leader.repository.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { encrypt, decrypt } from '../../../utils/crypto.js';
import { emailService } from '../../../services/emailService.js';
import config from '../../config/config.js';
import { isTempPasswordExpired } from '../../../utils/tempPassword.js';

const logger = createLogger('LeaderService');

export class LeaderService {
  /**
   * Crear nuevo líder con todas sus validaciones
   */
  async createLeader(leaderInput, organizationId) {
    logger.info('Creando líder', { name: leaderInput.name });

    // 1. Generar leaderId único
    const leaderId = this._generateLeaderId();

    // 2. Generar token único
    const token = await this._generateUniqueToken();

    // 3. Generar username
    const username = await this._generateUsername(leaderInput.customUsername);

    // 4. Generar contraseña temporal
    const tempPassword = this._generateTemporaryPassword();
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    // 5. Preparar datos del líder
    const leaderData = {
      leaderId,
      name: leaderInput.name,
      email: leaderInput.email || null,
      phone: leaderInput.phone || null,
      area: leaderInput.area || null,
      eventId: leaderInput.eventId || null,
      username,
      passwordHash,
      token,
      isTemporaryPassword: true,
      tempPasswordPlaintext: encrypt(tempPassword),
      tempPasswordCreatedAt: new Date(),
      passwordCanBeChanged: true,
      organizationId,
      active: true,
      registrations: 0
    };

    // 6. Guardar en BD
    const leader = await leaderRepository.create(leaderData);

    // 7. Enviar email de bienvenida (no esperar respuesta)
    if (leader.email) {
      this._sendWelcomeEmailAsync(leader, tempPassword);
    }

    logger.success('Líder creado exitosamente', { leaderId: leader._id });

    // 8. Retornar credenciales (solo para mostrar al admin una vez)
    return {
      ...leader.toObject(),
      _tempPassword: tempPassword,
      _username: username
    };
  }

  /**
   * Obtener un líder por ID
   */
  async getLeaderById(id) {
    const leader = await leaderRepository.findById(id);
    
    if (!leader) {
      throw AppError.notFound('Líder');
    }

    return leader;
  }

  /**
   * Obtener credenciales de un líder
   */
  async getLeaderCredentials(id) {
    const leader = await Leader.findById(id)
      .select('username tempPasswordPlaintext tempPasswordCreatedAt isTemporaryPassword');
    
    if (!leader) {
      throw AppError.notFound('Líder');
    }

    if (!leader.username) {
      return {
        hasCredentials: false,
        username: null,
        tempPassword: null
      };
    }

    // Si cambió contraseña, no mostrar la temporal
    if (!leader.isTemporaryPassword) {
      return {
        hasCredentials: true,
        username: leader.username,
        tempPassword: null,
        passwordFixed: true,
        message: 'Si el líder no puede cambiar su contraseña por favor genera una nueva'
      };
    }

    // Desencriptar contraseña temporal (si no expiro)
    let tempPassword = null;
    const isExpired = isTempPasswordExpired(leader);

    if (isExpired) {
      await Leader.updateOne(
        { _id: leader._id },
        { $unset: { tempPasswordPlaintext: "", tempPasswordCreatedAt: "" } }
      );
    } else if (leader.tempPasswordPlaintext) {
      try {
        tempPassword = decrypt(leader.tempPasswordPlaintext);
      } catch (e) {
        logger.warn('Error desencriptando contraseña', e);
        tempPassword = 'No disponible';
      }
    }

    return {
      hasCredentials: true,
      username: leader.username,
      tempPassword: tempPassword || 'No disponible',
      passwordFixed: false
    };
  }

  /**
   * Obtener múltiples líderes con filtros
   */
  async getLeaders(filter = {}, options = {}) {
    const result = await leaderRepository.findMany(filter, options);
    return result;
  }

  /**
   * Obtener líderes destacados
   */
  async getTopLeaders(limit = 10, filter = {}) {
    return leaderRepository.getTopLeaders(limit, filter);
  }

  /**
   * Actualizar líder
   */
  async updateLeader(id, updateData) {
    // Validar que no intenten actualizar campos sensibles
    const forbiddenFields = ['passwordHash', 'token', 'organizationId'];
    const hasForbidenField = forbiddenFields.some(field => field in updateData);

    if (hasForbidenField) {
      throw AppError.badRequest('No se pueden actualizar ciertos campos');
    }

    const leader = await leaderRepository.update(id, updateData);
    logger.success('Líder actualizado', { leaderId: id });

    return leader;
  }

  /**
   * Eliminar líder (con cascade)
   */
  async deleteLeader(id) {
    const result = await leaderRepository.delete(id);
    logger.success('Líder eliminado', { leaderId: id });
    return result;
  }

  /**
   * Obtener líder por token (público)
   */
  async getLeaderByToken(token) {
    if (!token) {
      throw AppError.badRequest('Token requerido');
    }

    const leader = await leaderRepository.findByToken(token);

    if (!leader) {
      throw AppError.notFound('Token inválido o líder no encontrado');
    }

    if (!leader.active) {
      throw AppError.forbidden('Líder inactivo');
    }

    return leader;
  }

  /**
   * Enviar email de acceso (QR, credenciales, etc.)
   */
  async sendAccessEmail(id, baseUrl, emailOptions = {}) {
    const leader = await leaderRepository.findById(id);

    if (!leader) {
      throw AppError.notFound('Líder');
    }

    if (!leader.email) {
      throw AppError.badRequest('El líder no tiene email configurado');
    }

    try {
      const emailResults = {};

      if (emailOptions.sendQR) {
        emailResults.qr = await emailService.sendQRCodeEmail(leader, baseUrl);
      }

      if (emailOptions.sendCredentials) {
        emailResults.credentials = await emailService.sendCredentialsEmail(leader, baseUrl);
      }

      if (emailOptions.sendWelcome) {
        emailResults.welcome = await emailService.sendWelcomeEmail(leader, baseUrl);
      }

      logger.success('Email de acceso enviado', { leaderId: id });
      return emailResults;
    } catch (error) {
      logger.error('Error enviando email', error);
      throw AppError.serverError('Error al enviar email');
    }
  }

  /**
   * Generar nueva contraseña temporal
   */
  async generateTemporaryPassword(id, baseUrl) {
    const leader = await leaderRepository.findById(id);

    if (!leader) {
      throw AppError.notFound('Líder');
    }

    const tempPassword = this._generateTemporaryPassword();
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    await leaderRepository.updatePassword(id, passwordHash, true);

    // Actualizar contraseña encriptada
    leader.tempPasswordPlaintext = encrypt(tempPassword);
    leader.tempPasswordCreatedAt = new Date();
    await leader.save();

    // Enviar por email
    if (leader.email) {
      try {
        await emailService.sendTemporaryPasswordEmail(leader, tempPassword, baseUrl);
      } catch (error) {
        logger.warn('Error enviando email de contraseña', error);
      }
    }

    logger.success('Contraseña temporal generada', { leaderId: id });

    return { tempPassword };
  }

  /**
   * ========== MÉTODOS PRIVADOS ==========
   */

  _generateLeaderId() {
    return `LID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
  }

  async _generateUniqueToken() {
    let token = crypto.randomBytes(16).toString('hex');
    
    // Verificar que no exista
    while (await leaderRepository.exists({ token })) {
      token = crypto.randomBytes(16).toString('hex');
    }

    return token;
  }

  async _generateUsername(customUsername) {
    const normalize = (str) =>
      str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (customUsername && customUsername.trim()) {
      const username = normalize(customUsername.trim());
      
      if (await leaderRepository.exists({ username })) {
        throw AppError.conflict(`El usuario "${username}" ya existe`);
      }

      return username;
    }

    // Auto-generar desde nombre
    // Implementación simplificada en service, la lógica está en service
    let baseUsername = `user${Date.now().toString(36).substr(2, 4)}`;
    let username = baseUsername;
    let counter = 1;

    while (await leaderRepository.exists({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  _generateTemporaryPassword() {
    return Math.random().toString(36).slice(-8) + 'Aa1!';
  }

  _sendWelcomeEmailAsync(leader, tempPassword) {
    // Enviar email en background (no esperar)
    Promise.resolve().then(async () => {
      try {
        await emailService.sendWelcomeEmail(leader, config.BASE_URL);
      } catch (error) {
        logger.warn('Error en email asincrónico', error);
      }
    }).catch(err => logger.error('Error no capturado', err));
  }
}

export default new LeaderService();
