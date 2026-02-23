/**
 * Leader Repository
 * Capa de acceso a datos para líderes
 * Responsable de operaciones CRUD en base de datos
 */

import { Leader } from '../../../models/Leader.js';
import { Registration } from '../../../models/Registration.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('LeaderRepository');

export class LeaderRepository {
  /**
   * Crear un nuevo líder
   */
  async create(leaderData) {
    try {
      const leader = new Leader(leaderData);
      await leader.save();
      logger.success('Líder creado', { leaderId: leader._id, name: leader.name });
      return leader;
    } catch (error) {
      if (error.code === 11000) {
        // Duplicated key error
        const field = Object.keys(error.keyPattern)[0];
        throw AppError.conflict(`El ${field} ya existe`, { field });
      }
      logger.error('Error creando líder', error);
      throw AppError.serverError('Error al crear líder');
    }
  }

  /**
   * Buscar líder por ID
   */
  async findById(id) {
    try {
      const leader = await Leader.findById(id).select('-passwordHash -tempPasswordPlaintext');
      return leader;
    } catch (error) {
      logger.error('Error buscando líder por ID', error);
      throw AppError.serverError('Error al buscar líder');
    }
  }

  /**
   * Buscar líder por leaderId
   */
  async findByLeaderId(leaderId) {
    try {
      const leader = await Leader.findOne({ leaderId }).select('-passwordHash -tempPasswordPlaintext');
      return leader;
    } catch (error) {
      logger.error('Error buscando por leaderId', error);
      throw AppError.serverError('Error al buscar líder');
    }
  }

  /**
   * Buscar líder por token (para formulario público)
   */
  async findByToken(token) {
    try {
      const leader = await Leader.findOne({ token }).select('leaderId name eventId active');
      return leader;
    } catch (error) {
      logger.error('Error buscando por token', error);
      throw AppError.serverError('Error al buscar líder');
    }
  }

  /**
   * Buscar varios líderes con filtros
   */
  async findMany(filter = {}, options = {}) {
    try {
      const { page = 1, limit = 20, sort = { name: 1 } } = options;
      
      const skip = (page - 1) * limit;
      
      const leaders = await Leader.find(filter)
        .select('-passwordHash -tempPasswordPlaintext')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
      
      const total = await Leader.countDocuments(filter);
      
      return {
        data: leaders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error buscando líderes', error);
      throw AppError.serverError('Error al buscar líderes');
    }
  }

  /**
   * Actualizar líder
   */
  async update(id, updateData) {
    try {
      // No permitir actualizar campos sensibles directamente
      const { passwordHash, tempPasswordPlaintext, ...safeData } = updateData;
      
      const leader = await Leader.findByIdAndUpdate(
        id,
        { ...safeData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).select('-passwordHash -tempPasswordPlaintext');
      
      if (!leader) {
        throw AppError.notFound('Líder');
      }
      
      logger.success('Líder actualizado', { leaderId: id });
      return leader;
    } catch (error) {
      if (error.statusCode) throw error;
      logger.error('Error actualizando líder', error);
      throw AppError.serverError('Error al actualizar líder');
    }
  }

  /**
   * Eliminar líder (con cascade)
   */
  async delete(id) {
    try {
      const leader = await Leader.findById(id);
      
      if (!leader) {
        throw AppError.notFound('Líder');
      }

      // Contar registros antes de eliminar
      const registrationCount = await Registration.countDocuments({ leaderId: leader.leaderId });

      // Eliminar registros del líder
      await Registration.deleteMany({ leaderId: leader.leaderId });

      // Eliminar líder
      await Leader.deleteOne({ _id: id });

      logger.success('Líder eliminado con cascade', { 
        leaderId: id, 
        registrationsDeleted: registrationCount 
      });

      return { leaderId: id, registrationsDeleted: registrationCount };
    } catch (error) {
      if (error.statusCode) throw error;
      logger.error('Error eliminando líder', error);
      throw AppError.serverError('Error al eliminar líder');
    }
  }

  /**
   * Verificar si un líder existe
   */
  async exists(filter) {
    try {
      const count = await Leader.countDocuments(filter);
      return count > 0;
    } catch (error) {
      logger.error('Error verificando existencia', error);
      throw AppError.serverError('Error al verificar líder');
    }
  }

  /**
   * Obtener líderes destacados por registraciones
   */
  async getTopLeaders(limit = 10, filter = {}) {
    try {
      const leaders = await Leader.find({ ...filter, active: true })
        .sort({ registrations: -1 })
        .limit(limit)
        .select('-passwordHash -tempPasswordPlaintext')
        .lean();
      
      return leaders;
    } catch (error) {
      logger.error('Error obteniendo líderes destacados', error);
      throw AppError.serverError('Error al obtener líderes');
    }
  }

  /**
   * Actualizar campos sensibles (contraseña)
   */
  async updatePassword(id, passwordHash, isTemporary = false) {
    try {
      const leader = await Leader.findByIdAndUpdate(
        id,
        {
          passwordHash,
          isTemporaryPassword: isTemporary,
          updatedAt: new Date()
        },
        { new: true }
      ).select('-passwordHash -tempPasswordPlaintext');

      if (!leader) {
        throw AppError.notFound('Líder');
      }

      logger.success('Contraseña actualizada', { leaderId: id });
      return leader;
    } catch (error) {
      if (error.statusCode) throw error;
      logger.error('Error actualizando contraseña', error);
      throw AppError.serverError('Error al actualizar contraseña');
    }
  }
}

export default new LeaderRepository();
