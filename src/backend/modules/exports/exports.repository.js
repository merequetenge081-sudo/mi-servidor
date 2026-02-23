/**
 * Exports Repository
 * Acceso a datos para exportación
 */

import { Registration } from '../../../models/Registration.js';
import { Event } from '../../../models/Event.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('ExportsRepository');

/**
 * Obtiene registraciones para exportar
 */
export async function getRegistrationsForExport(eventId = null, filters = {}) {
  try {
    const query = eventId ? { eventId } : {};

    const registrations = await Registration.find(query)
      .populate('leaderId', 'name email cedula')
      .populate('puestoId', 'numero localidad mesa')
      .lean();

    logger.debug('Registraciones obtenidas para exportar', { count: registrations.length });
    return registrations;
  } catch (error) {
    logger.error('Error obteniendo registraciones para exportar', error);
    throw AppError.serverError('Error al obtener registraciones');
  }
}

/**
 * Obtiene líderes para exportar
 */
export async function getLeadersForExport() {
  try {
    const leaders = await Leader.find({ status: { $ne: 'inactive' } })
      .select('name email cedula specialty assignedEventId createdAt')
      .lean();

    logger.debug('Líderes obtenidos para exportar', { count: leaders.length });
    return leaders;
  } catch (error) {
    logger.error('Error obteniendo líderes para exportar', error);
    throw AppError.serverError('Error al obtener líderes');
  }
}

/**
 * Obtiene eventos para exportar
 */
export async function getEventsForExport() {
  try {
    const events = await Event.find()
      .select('name status startDate endDate description')
      .lean();

    logger.debug('Eventos obtenidos para exportar', { count: events.length });
    return events;
  } catch (error) {
    logger.error('Error obteniendo eventos para exportar', error);
    throw AppError.serverError('Error al obtener eventos');
  }
}

/**
 * Obtiene datos para generar QR
 */
export async function getPuestosForQR() {
  try {
    const puestos = await Registration.aggregate([
      {
        $group: {
          _id: '$puestoId',
          count: { $sum: 1 },
          voters: { $push: '$cedula' }
        }
      }
    ]);

    logger.debug('Puestos QR obtenidos', { count: puestos.length });
    return puestos;
  } catch (error) {
    logger.error('Error obteniendo puestos para QR', error);
    throw AppError.serverError('Error al obtener puestos');
  }
}

/**
 * Obtiene registraciones por evento e intervalo de fechas
 */
export async function getRegistrationsByDateRange(startDate, endDate, eventId = null) {
  try {
    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      ...(eventId && { eventId })
    };

    const registrations = await Registration.find(query)
      .populate('leaderId', 'name email')
      .populate('puestoId', 'numero localidad')
      .lean();

    logger.debug('Registraciones por rango obtenidas', { count: registrations.length });
    return registrations;
  } catch (error) {
    logger.error('Error obteniendo registraciones por rango', error);
    throw AppError.serverError('Error al obtener registraciones');
  }
}

export default {
  getRegistrationsForExport,
  getLeadersForExport,
  getEventsForExport,
  getPuestosForQR,
  getRegistrationsByDateRange
};
