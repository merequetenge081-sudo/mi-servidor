/**
 * Analytics Repository
 * Acceso a datos para estadísticas y agregaciones
 */

import { Registration } from '../../../models/Registration.js';
import { Leader } from '../../../models/Leader.js';
import { Event } from '../../../models/Event.js';
import metricsService from '../../../services/metrics.service.js';
import { applyCleanAnalyticsFilter } from '../../../shared/analyticsFilter.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('AnalyticsRepository');

/**
 * Obtiene estadísticas de registraciones
 */
export async function getRegistrationStats(eventId = null, filters = {}) {
  try {
    const stats = await metricsService.getRegistrationStats({ eventId });

    logger.debug('Estadísticas de registraciones', { eventId, stats });
    return {
      total: stats.total,
      byLeader: stats.byLeader,
      byPuesto: stats.byPuesto,
      confirmed: stats.confirmed,
      registeredToVote: stats.registeredToVote
    };
  } catch (error) {
    logger.error('Error obteniendo stats registraciones', error);
    throw AppError.serverError('Error al obtener estadísticas de registraciones');
  }
}

/**
 * Obtiene estadísticas de líderes
 */
export async function getLeaderStats(eventId = null) {
  try {
    const leadersCount = await Leader.countDocuments({ 
      active: true,
      ...(eventId && { assignedEventId: eventId })
    });

    const registrationsPerLeader = await Registration.aggregate([
      { $match: applyCleanAnalyticsFilter({ ...(eventId && { eventId }) }) },
      {
        $group: {
          _id: '$leaderId',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    logger.debug('Estadísticas de líderes', { eventId, leadersCount });

    return {
      total: leadersCount,
      topLeaders: registrationsPerLeader.map(l => ({
        leaderId: l._id,
        registraciones: l.count
      }))
    };
  } catch (error) {
    logger.error('Error obteniendo stats líderes', error);
    throw AppError.serverError('Error al obtener estadísticas de líderes');
  }
}

/**
 * Obtiene estadísticas de eventos
 */
export async function getEventStats(eventId = null) {
  try {
    const query = eventId ? { _id: eventId } : { status: 'active' };
    
    const events = await Event.find(query).lean();

    const eventStats = [];
    for (const event of events) {
      const registrations = await Registration.countDocuments(
        applyCleanAnalyticsFilter({ eventId: event._id })
      );
      eventStats.push({
        eventId: event._id,
        eventName: event.name,
        registrations,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate
      });
    }

    logger.debug('Estadísticas de eventos', { count: eventStats.length });
    return eventStats;
  } catch (error) {
    logger.error('Error obteniendo stats eventos', error);
    throw AppError.serverError('Error al obtener estadísticas de eventos');
  }
}

/**
 * Obtiene estadísticas de puestos
 */
export async function getPuestoStats() {
  try {
    const stats = await metricsService.getPuestoStats();

    logger.debug('Estadísticas de puestos', { totalPuestos: stats.totalPuestos });

    return stats;
  } catch (error) {
    logger.error('Error obteniendo stats puestos', error);
    throw AppError.serverError('Error al obtener estadísticas de puestos');
  }
}

/**
 * Obtiene estadísticas por rango de fechas
 */
export async function getTimeSeriesStats(startDate, endDate, eventId = null) {
  try {
    const timeSeries = await metricsService.getTimeSeriesStats(startDate, endDate, { eventId });

    logger.debug('Series temporal', { startDate, endDate, count: timeSeries.length });
    return timeSeries;
  } catch (error) {
    logger.error('Error obteniendo series temporal', error);
    throw AppError.serverError('Error al obtener series de tiempo');
  }
}

/**
 * Obtiene resumen ejecutivo completo
 */
export async function getExecutiveSummary(eventId = null) {
  try {
    return await metricsService.getDashboardSummary(eventId);
  } catch (error) {
    logger.error('Error obteniendo resumen ejecutivo', error);
    throw AppError.serverError('Error al obtener resumen');
  }
}

/**
 * Obtiene estadísticas de eventos con TOP puestos
 */
export async function getEventDetailedStats(eventId) {
  try {
    const event = await Event.findById(eventId).lean();
    if (!event) {
      throw AppError.notFound('Evento no encontrado');
    }

    const registrations = await Registration.countDocuments(
      applyCleanAnalyticsFilter({ eventId })
    );
    
    const topPuestos = await Registration.aggregate([
      { $match: applyCleanAnalyticsFilter({ eventId }) },
      { $group: { _id: '$puestoId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topLeaders = await Registration.aggregate([
      { $match: applyCleanAnalyticsFilter({ eventId }) },
      { $group: { _id: '$leaderId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    return {
      event: {
        name: event.name,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate
      },
      registrations,
      topPuestos: topPuestos.map(p => ({ puestoId: p._id, registrations: p.count })),
      topLeaders: topLeaders.map(l => ({ leaderId: l._id, registrations: l.count })),
      timestamp: new Date()
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error obteniendo stats detalladas evento', error);
    throw AppError.serverError('Error al obtener estadísticas de evento');
  }
}

export default {
  getRegistrationStats,
  getLeaderStats,
  getEventStats,
  getPuestoStats,
  getTimeSeriesStats,
  getExecutiveSummary,
  getEventDetailedStats
};
