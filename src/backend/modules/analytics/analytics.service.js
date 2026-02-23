/**
 * Analytics Service
 * Lógica de negocio para estadísticas y análisis
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import analyticsRepository from './analytics.repository.js';

const logger = createLogger('AnalyticsService');

/**
 * Obtiene resumen completo de estadísticas
 */
export async function getDashboardSummary(eventId = null) {
  try {
    logger.info('Obteniendo dashboard summary', { eventId });
    
    const summary = await analyticsRepository.getExecutiveSummary(eventId);
    
    return {
      ...summary,
      summary: {
        ...summary.summary,
        completionPercentage: calculateCompletion(summary),
        lastUpdated: new Date()
      }
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en dashboard summary', error);
    throw AppError.serverError('Error al obtener dashboard');
  }
}

/**
 * Obtiene estadísticas de registraciones
 */
export async function getRegistrationAnalytics(eventId = null, period = 'all') {
  try {
    logger.info('Obteniendo registrations analytics');

    const stats = await analyticsRepository.getRegistrationStats(eventId);

    // Enriquecer con porcentajes
    const enriched = {
      ...stats,
      percentageByLeader: stats.total > 0 ? (stats.byLeader / stats.total * 100).toFixed(2) : 0,
      percentageByPuesto: stats.total > 0 ? (stats.byPuesto / stats.total * 100).toFixed(2) : 0
    };

    logger.debug('Registrations analytics completas');
    return enriched;
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en registrations analytics', error);
    throw AppError.serverError('Error al obtener analytics de registraciones');
  }
}

/**
 * Obtiene analytics de líderes
 */
export async function getLeaderAnalytics(eventId = null) {
  try {
    logger.info('Obteniendo leader analytics');

    const stats = await analyticsRepository.getLeaderStats(eventId);

    // Calcular promedio de registraciones por líder
    const avgRegistrations = stats.topLeaders.length > 0
      ? (stats.topLeaders.reduce((sum, l) => sum + l.registraciones, 0) / stats.total).toFixed(2)
      : 0;

    return {
      ...stats,
      averageRegistrationsPerLeader: avgRegistrations,
      topLeadersCount: stats.topLeaders.length
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en leader analytics', error);
    throw AppError.serverError('Error al obtener analytics de líderes');
  }
}

/**
 * Obtiene analytics de eventos
 */
export async function getEventAnalytics(eventId = null) {
  try {
    logger.info('Obteniendo event analytics');

    const stats = await analyticsRepository.getEventStats(eventId);

    // Calcular totales y promedios
    const totalRegistrations = stats.reduce((sum, e) => sum + e.registrations, 0);
    const avgRegistrationsPerEvent = stats.length > 0 ? (totalRegistrations / stats.length).toFixed(2) : 0;

    return {
      eventCount: stats.length,
      events: stats,
      totalRegistrations,
      averageRegistrationsPerEvent: avgRegistrationsPerEvent,
      eventStatus: {
        active: stats.filter(e => e.status === 'active').length,
        inactive: stats.filter(e => e.status === 'inactive').length,
        archived: stats.filter(e => e.status === 'archived').length
      }
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en event analytics', error);
    throw AppError.serverError('Error al obtener analytics de eventos');
  }
}

/**
 * Obtiene analytics de puestos
 */
export async function getPuestoAnalytics() {
  try {
    logger.info('Obteniendo puesto analytics');

    const stats = await analyticsRepository.getPuestoStats();

    // Calcular actividad
    const activityRate = ((stats.puestosWithActivity / stats.totalPuestos) * 100).toFixed(2);

    return {
      ...stats,
      activityRate,
      localidadesCount: stats.byLocalidad.length,
      topLocalidades: stats.byLocalidad.slice(0, 5)
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en puesto analytics', error);
    throw AppError.serverError('Error al obtener analytics de puestos');
  }
}

/**
 * Obtiene análisis de tendencias en tiempo
 */
export async function getTrendAnalysis(startDate, endDate, eventId = null) {
  try {
    logger.info('Obteniendo trend analysis', { startDate, endDate });

    const timeSeries = await analyticsRepository.getTimeSeriesStats(startDate, endDate, eventId);

    // Calcular tendencia (comparar primera mitad vs segunda mitad)
    const midpoint = Math.floor(timeSeries.length / 2);
    const firstHalf = timeSeries.slice(0, midpoint);
    const secondHalf = timeSeries.slice(midpoint);

    const firstHalfAvg = firstHalf.length > 0
      ? (firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length).toFixed(2)
      : 0;

    const secondHalfAvg = secondHalf.length > 0
      ? (secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length).toFixed(2)
      : 0;

    const trend = firstHalfAvg > 0
      ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg * 100).toFixed(2)
      : 0;

    return {
      dates: {
        startDate,
        endDate,
        totalDays: timeSeries.length
      },
      timeSeries,
      analysis: {
        firstHalfAverage: firstHalfAvg,
        secondHalfAverage: secondHalfAvg,
        trendPercentage: trend,
        trend: parseFloat(trend) > 0 ? 'upward' : parseFloat(trend) < 0 ? 'downward' : 'stable',
        totalCount: timeSeries.reduce((sum, d) => sum + d.count, 0)
      }
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en trend analysis', error);
    throw AppError.serverError('Error al obtener análisis de tendencias');
  }
}

/**
 * Obtiene comparación entre períodos
 */
export async function getPeriodComparison(period1Start, period1End, period2Start, period2End, eventId = null) {
  try {
    logger.info('Obteniendo period comparison');

    const [period1, period2] = await Promise.all([
      analyticsRepository.getTimeSeriesStats(period1Start, period1End, eventId),
      analyticsRepository.getTimeSeriesStats(period2Start, period2End, eventId)
    ]);

    const period1Total = period1.reduce((sum, d) => sum + d.count, 0);
    const period2Total = period2.reduce((sum, d) => sum + d.count, 0);

    const difference = period2Total - period1Total;
    const percentageChange = period1Total > 0 ? ((difference / period1Total) * 100).toFixed(2) : 0;

    return {
      period1: {
        dateRange: { start: period1Start, end: period1End },
        total: period1Total,
        average: (period1Total / period1.length).toFixed(2)
      },
      period2: {
        dateRange: { start: period2Start, end: period2End },
        total: period2Total,
        average: (period2Total / period2.length).toFixed(2)
      },
      comparison: {
        difference,
        percentageChange,
        improvement: parseFloat(percentageChange) > 0 ? 'yes' : 'no'
      }
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en period comparison', error);
    throw AppError.serverError('Error al comparar períodos');
  }
}

/**
 * Calcula porcentaje de completitud
 */
function calculateCompletion(summary) {
  if (summary.summary.totalRegistrations === 0) return 0;
  
  // Completitud basada en registraciones vs líderes disponibles
  const potentialRegistrations = summary.summary.uniqueLeaders * 100; // Estimado
  const completion = Math.min(
    (summary.summary.totalRegistrations / potentialRegistrations * 100),
    100
  );
  
  return completion.toFixed(2);
}

/**
 * Obtiene estadísticas detalladas de un evento
 */
export async function getEventDetail(eventId) {
  try {
    logger.info('Obteniendo event detail', { eventId });

    const stats = await analyticsRepository.getEventDetailedStats(eventId);
    
    return stats;
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error obteniendo event detail', error);
    throw AppError.serverError('Error al obtener detalles de evento');
  }
}

/**
 * Obtiene análisis avanzado con cálculos de porcentaje
 * Enterprise BI Level - Optimizado para frontend moderno
 */
export async function getAdvancedDashboard(filters = {}) {
  try {
    logger.info('Obteniendo advanced dashboard', { filters });

    const rawData = await analyticsRepository.getAdvancedAnalytics(filters);
    
    // Calcular porcentajes para leaders
    const totalVotes = rawData.totalVotes.total || 1;
    const leadersWithPercentage = rawData.topLeaders.map(leader => ({
      ...leader,
      percentage: ((leader.votes / totalVotes) * 100).toFixed(2),
      rank: rawData.topLeaders.indexOf(leader) + 1
    }));

    // Calcular porcentajes para localidades
    const localidadesWithPercentage = rawData.topLocalidades.map(loc => ({
      ...loc,
      percentage: ((loc.votes / totalVotes) * 100).toFixed(2),
      rank: rawData.topLocalidades.indexOf(loc) + 1
    }));

    // Calcular porcentajes para puestos
    const puestosWithPercentage = rawData.topPuestos.map(puesto => ({
      ...puesto,
      percentage: ((puesto.votes / totalVotes) * 100).toFixed(2),
      rank: rawData.topPuestos.indexOf(puesto) + 1
    }));

    // Calcular porcentajes para distribución
    const distributionWithPercentage = rawData.distribution.map(dist => ({
      ...dist,
      percentage: ((dist.votes / totalVotes) * 100).toFixed(2)
    }));

    const enrichedData = {
      totalVotes: rawData.totalVotes,
      leaders: {
        top: leadersWithPercentage,
        total: leadersWithPercentage.length
      },
      localidades: {
        top: localidadesWithPercentage,
        total: localidadesWithPercentage.length
      },
      puestos: {
        top: puestosWithPercentage,
        total: puestosWithPercentage.length
      },
      distribution: distributionWithPercentage,
      timeline: rawData.timeline,
      metadata: {
        generatedAt: new Date(),
        filters: filters,
        dataPoints: totalVotes,
        confirmationRate: rawData.totalVotes.confirmationRate
      }
    };

    logger.debug('Advanced dashboard enriched', { 
      totalVotes,
      leaders: leadersWithPercentage.length,
      localidades: localidadesWithPercentage.length
    });

    return enrichedData;
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en advanced dashboard', error);
    throw AppError.serverError('Error al obtener dashboard avanzado');
  }
}

export default {
  getDashboardSummary,
  getRegistrationAnalytics,
  getLeaderAnalytics,
  getEventAnalytics,
  getPuestoAnalytics,
  getTrendAnalysis,
  getPeriodComparison,
  getEventDetail,
  getAdvancedDashboard
};
