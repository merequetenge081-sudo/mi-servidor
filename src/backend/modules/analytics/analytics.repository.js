/**
 * Analytics Repository
 * Acceso a datos para estadísticas y agregaciones
 */

import { Registration } from '../../../models/Registration.js';
import { Leader } from '../../../models/Leader.js';
import { Event } from '../../../models/Event.js';
import { Puestos } from '../../../models/Puestos.js';
import { Admin } from '../../../models/Admin.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('AnalyticsRepository');

/**
 * Obtiene estadísticas de registraciones
 */
export async function getRegistrationStats(eventId = null, filters = {}) {
  try {
    const query = eventId ? { eventId } : {};
    
    const stats = await Registration.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          byLeader: { $push: '$leaderId' },
          byPuesto: { $push: '$puestoId' },
          createdDates: { $push: '$createdAt' }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          byLeader: { $size: { $setUnion: ['$byLeader'] } },
          byPuesto: { $size: { $setUnion: ['$byPuesto'] } }
        }
      }
    ]);

    logger.debug('Estadísticas de registraciones', { eventId, stats });
    return stats[0] || { total: 0, byLeader: 0, byPuesto: 0 };
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
      status: { $ne: 'inactive' },
      ...(eventId && { assignedEventId: eventId })
    });

    const registrationsPerLeader = await Registration.aggregate([
      ...(eventId && [{ $match: { eventId } }]),
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
      const registrations = await Registration.countDocuments({ eventId: event._id });
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
    const totalPuestos = await Puestos.countDocuments();
    
    const puestosWithRegistrations = await Registration.aggregate([
      {
        $group: {
          _id: '$puestoId',
          registrations: { $sum: 1 }
        }
      },
      { $match: { registrations: { $gt: 0 } } }
    ]);

    const localidades = await Puestos.aggregate([
      {
        $group: {
          _id: '$localidad',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    logger.debug('Estadísticas de puestos', { totalPuestos });

    return {
      totalPuestos,
      puestosWithActivity: puestosWithRegistrations.length,
      byLocalidad: localidades.map(l => ({
        localidad: l._id,
        puestos: l.count
      }))
    };
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
    const query = {
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      ...(eventId && { eventId })
    };

    const timeSeries = await Registration.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

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
    const [registrations, leaders, events, puestos] = await Promise.all([
      getRegistrationStats(eventId),
      getLeaderStats(eventId),
      getEventStats(eventId),
      getPuestoStats()
    ]);

    return {
      summary: {
        totalRegistrations: registrations.total,
        uniqueLeaders: leaders.total,
        activeEvents: events.length,
        totalPuestos: puestos.totalPuestos
      },
      registrations,
      leaders,
      events,
      puestos,
      timestamp: new Date()
    };
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

    const registrations = await Registration.countDocuments({ eventId });
    
    const topPuestos = await Registration.aggregate([
      { $match: { eventId } },
      { $group: { _id: '$puestoId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topLeaders = await Registration.aggregate([
      { $match: { eventId } },
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

/**
 * Obtiene análisis avanzado con agregaciones MongoDB optimizadas
 * Para Enterprise BI - 6 pipelines independientes para máxima escalabilidad
 */
export async function getAdvancedAnalytics(filters = {}) {
  try {
    const matchStage = {};
    
    // Construir filtro si se proporciona
    if (filters.eventId) matchStage.eventId = filters.eventId;
    if (filters.leaderId) matchStage.leaderId = filters.leaderId;
    if (filters.puestoId) matchStage.puestoId = filters.puestoId;
    if (filters.localidad) matchStage.localidad = filters.localidad;
    
    // Rango de fechas si se proporciona
    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
    }

    // Pipeline 1: Total de votos
    const totalVotesResult = await Registration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$confirmed', true] }, 1, 0] }
          },
          active: {
            $sum: { $cond: [{ $gt: ['$createdAt', new Date(Date.now() - 30*24*60*60*1000)] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          total: 1,
          confirmed: 1,
          active: 1,
          confirmationRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$confirmed', '$total'] }, 100] },
              0
            ]
          }
        }
      }
    ]);

    // Pipeline 2: Top 10 Líderes con count
    const topLeadersResult = await Registration.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'leaders',
          localField: 'leaderId',
          foreignField: '_id',
          as: 'leaderData'
        }
      },
      { $unwind: { path: '$leaderData', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$leaderId',
          count: { $sum: 1 },
          leaderName: { $first: { $ifNull: ['$leaderData.name', '$leaderName'] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          leaderId: '$_id',
          leaderName: 1,
          votes: '$count'
        }
      }
    ]);

    // Pipeline 3: Top 10 Localidades con count
    const topLocalidadesResult = await Registration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$localidad',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          localidad: '$_id',
          votes: '$count'
        }
      }
    ]);

    // Pipeline 4: Top 10 Puestos con count
    const topPuestosResult = await Registration.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'puestos',
          localField: 'puestoId',
          foreignField: '_id',
          as: 'puestoData'
        }
      },
      { $unwind: { path: '$puestoData', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$puestoId',
          count: { $sum: 1 },
          puestoName: { $first: { $ifNull: ['$puestoData.name', '$puestoId'] } }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          puestoId: '$_id',
          puestoName: 1,
          votes: '$count'
        }
      }
    ]);

    // Pipeline 5: Timeline diaria (últimos 30 días)
    const timelineResult = await Registration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
              timezone: 'America/Bogota'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 },
      {
        $project: {
          _id: 0,
          date: '$_id',
          votes: '$count'
        }
      }
    ]);

    // Pipeline 6: Distribución por estado (Bogotá vs Resto)
    const distributionResult = await Registration.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $cond: [
              { $in: ['$localidad', ['Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos', 'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda', 'La Candelaria', 'Rafael Uribe Umaña', 'Ciudad Bolívar', 'Sumapaz']] },
              'Bogotá',
              'Otros'
            ]
          },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          region: '$_id',
          votes: '$count'
        }
      }
    ]);

    logger.debug('Advanced analytics computed', { 
      total: totalVotesResult[0]?.total,
      topLeaders: topLeadersResult.length,
      topLocalidades: topLocalidadesResult.length
    });

    return {
      totalVotes: totalVotesResult[0] || { total: 0, confirmed: 0, active: 0, confirmationRate: 0 },
      topLeaders: topLeadersResult,
      topLocalidades: topLocalidadesResult,
      topPuestos: topPuestosResult,
      timeline: timelineResult.reverse(), // Ordenar ascendente para gráfico
      distribution: distributionResult,
      timestamp: new Date()
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en advanced analytics', error);
    throw AppError.serverError('Error al obtener análisis avanzado');
  }
}

export default {
  getRegistrationStats,
  getLeaderStats,
  getEventStats,
  getPuestoStats,
  getTimeSeriesStats,
  getExecutiveSummary,
  getEventDetailedStats,
  getAdvancedAnalytics
};
