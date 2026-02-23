/**
 * Admin Repository
 * Operaciones de administrador y gestión de datos
 */

import { Puestos } from '../../../models/index.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('AdminRepository');

/**
 * Obtiene todos los puestos
 */
export async function getAllPuestos(filter = {}) {
  try {
    logger.debug('Fetching all puestos', { filter });
    const puestos = await Puestos.find(filter).lean();
    return puestos;
  } catch (error) {
    logger.error('Error fetching puestos', { error: error.message });
    throw AppError.serverError('Error fetching puestos');
  }
}

/**
 * Obtiene conteo de puestos
 */
export async function countPuestos(filter = {}) {
  try {
    const count = await Puestos.countDocuments(filter);
    return count;
  } catch (error) {
    logger.error('Error counting puestos', { error: error.message });
    throw AppError.serverError('Error counting puestos');
  }
}

/**
 * Limpia los puestos existentes
 */
export async function clearPuestos() {
  try {
    logger.info('Clearing existing puestos');
    const result = await Puestos.deleteMany({});
    logger.info('Puestos cleared', { deletedCount: result.deletedCount });
    return result;
  } catch (error) {
    logger.error('Error clearing puestos', { error: error.message });
    throw AppError.serverError('Error clearing puestos');
  }
}

/**
 * Inserta múltiples puestos
 */
export async function insertPuestos(puestosData) {
  try {
    if (!Array.isArray(puestosData) || puestosData.length === 0) {
      throw AppError.badRequest('puestosData must be a non-empty array');
    }

    logger.info('Inserting puestos', { count: puestosData.length });

    // Validar cada puesto
    const validPuestos = puestosData.filter(p => 
      p.codigoPuesto && p.nombre && p.localidad && Array.isArray(p.mesas)
    );

    if (validPuestos.length === 0) {
      throw AppError.badRequest('No valid puestos to import');
    }

    const result = await Puestos.insertMany(validPuestos);
    logger.info('Puestos inserted', { insertedCount: result.length });

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error inserting puestos', { error: error.message });
    throw AppError.internal('Error inserting puestos');
  }
}

/**
 * Obtiene estadísticas de puestos por localidad
 */
export async function getPuestosStats() {
  try {
    logger.debug('Fetching puestos stats');

    const stats = await Puestos.aggregate([
      {
        $group: {
          _id: '$localidad',
          puestosCount: { $sum: 1 },
          mesasCount: { $sum: { $size: '$mesas' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return stats;
  } catch (error) {
    logger.error('Error fetching puestos stats', { error: error.message });
    throw AppError.internal('Error fetching puestos stats');
  }
}

export default {
  getAllPuestos,
  countPuestos,
  clearPuestos,
  insertPuestos,
  getPuestosStats
};
