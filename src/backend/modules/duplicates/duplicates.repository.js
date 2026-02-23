/**
 * Duplicates Repository
 * Detección y gestión de registros duplicados
 */

import { Registration } from '../../../models/Registration.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('DuplicatesRepository');

/**
 * Encuentra registraciones duplicadas por cédula
 */
export async function findDuplicatesByCedula(eventId = null) {
  try {
    const query = eventId ? { eventId } : {};

    const duplicates = await Registration.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$cedula',
          count: { $sum: 1 },
          records: { $push: '$$ROOT' }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]);

    logger.debug('Duplicados encontrados', { count: duplicates.length });
    return duplicates;
  } catch (error) {
    logger.error('Error buscando duplicados', error);
    throw AppError.serverError('Error al buscar duplicados');
  }
}

/**
 * Obtiene detalles completos de registraciones duplicadas
 */
export async function getDuplicateDetails(cedula, eventId = null) {
  try {
    const query = { cedula, ...(eventId && { eventId }) };
    
    const registrations = await Registration.find(query)
      .populate('leaderId', 'name email cedula')
      .populate('puestoId', 'numero localidad mesa')
      .lean();

    logger.debug('Detalles de duplicados obtenidos', { cedula, count: registrations.length });
    return registrations;
  } catch (error) {
    logger.error('Error obteniendo detalles de duplicados', error);
    throw AppError.serverError('Error al obtener detalles');
  }
}

/**
 * Cuenta registraciones duplicadas por criterio
 */
export async function countDuplicates(eventId = null) {
  try {
    const query = eventId ? { eventId } : {};

    logger.debug('Counting duplicates with query', { query });

    const duplicates = await Registration.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$cedula',
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]);

    logger.debug('Conteo de duplicados', { count: duplicates.length });
    return duplicates.length;
  } catch (error) {
    logger.error('Error contando duplicados', { error: error.message, stack: error.stack });
    throw AppError.serverError('Error al contar duplicados');
  }
}

export default {
  findDuplicatesByCedula,
  getDuplicateDetails,
  countDuplicates
};
