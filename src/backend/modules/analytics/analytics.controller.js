/**
 * Analytics Controller
 * Endpoints HTTP para estadísticas y análisis
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import analyticsService from './analytics.service.js';
import advancedService from './advanced.service.js';

const logger = createLogger('AnalyticsController');

/**
 * GET /api/v2/analytics/dashboard
 * Obtiene dashboard completo con resumen ejecutivo
 */
export async function getDashboard(req, res, next) {
  try {
    const { eventId } = req.query;
    
    logger.info('Dashboard request', { eventId });

    const dashboard = await analyticsService.getDashboardSummary(eventId);

    res.json({
      success: true,
      message: 'Dashboard Summary',
      data: dashboard
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/registrations
 * Obtiene estadísticas de registraciones
 */
export async function getRegistrationStats(req, res, next) {
  try {
    const { eventId, period = 'all' } = req.query;

    logger.info('Registration stats request', { eventId, period });

    const stats = await analyticsService.getRegistrationAnalytics(eventId, period);

    res.json({
      success: true,
      message: 'Registration Analytics',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/leaders
 * Obtiene estadísticas de líderes
 */
export async function getLeaderStats(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Leader stats request', { eventId });

    const stats = await analyticsService.getLeaderAnalytics(eventId);

    res.json({
      success: true,
      message: 'Leader Analytics',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/events
 * Obtiene estadísticas de eventos
 */
export async function getEventStats(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Event stats request', { eventId });

    const stats = await analyticsService.getEventAnalytics(eventId);

    res.json({
      success: true,
      message: 'Event Analytics',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/events/:eventId/detail
 * Obtiene estadísticas detalladas de un evento específico
 */
export async function getEventDetail(req, res, next) {
  try {
    const { eventId } = req.params;

    logger.info('Event detail request', { eventId });

    if (!eventId) {
      throw AppError.badRequest('Event ID requerido');
    }

    const detail = await analyticsService.getEventDetail(eventId);

    res.json({
      success: true,
      message: 'Event Detail',
      data: detail
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/puestos
 * Obtiene estadísticas de puestos
 */
export async function getPuestoStats(req, res, next) {
  try {
    logger.info('Puesto stats request');

    const stats = await analyticsService.getPuestoAnalytics();

    res.json({
      success: true,
      message: 'Puesto Analytics',
      data: stats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/trends
 * Obtiene análisis de tendencias en un rango de fechas
 */
export async function getTrends(req, res, next) {
  try {
    const { startDate, endDate, eventId } = req.query;

    logger.info('Trends request', { startDate, endDate });

    if (!startDate || !endDate) {
      throw AppError.badRequest('startDate y endDate requeridos (YYYY-MM-DD)');
    }

    const trends = await analyticsService.getTrendAnalysis(startDate, endDate, eventId);

    res.json({
      success: true,
      message: 'Trend Analysis',
      data: trends
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/analytics/compare
 * Compara dos períodos de tiempo
 */
export async function comparePeriods(req, res, next) {
  try {
    const { period1Start, period1End, period2Start, period2End, eventId } = req.body;

    logger.info('Period comparison request');

    if (!period1Start || !period1End || !period2Start || !period2End) {
      throw AppError.badRequest('Todos los períodos son requeridos');
    }

    const comparison = await analyticsService.getPeriodComparison(
      period1Start,
      period1End,
      period2Start,
      period2End,
      eventId
    );

    res.json({
      success: true,
      message: 'Period Comparison',
      data: comparison
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/summary
 * Obtiene resumen rápido
 */
export async function getSummary(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Summary request', { eventId });

    const dashboard = await analyticsService.getDashboardSummary(eventId);

    res.json({
      success: true,
      message: 'Summary',
      data: {
        summary: dashboard.summary,
        timestamp: dashboard.timestamp
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/advanced
 * Obtiene analíticas avanzadas para el panel de análisis
 */
export async function getAdvanced(req, res, next) {
  try {
    const { eventId, status } = req.query;
    logger.info('Advanced analytics request', { eventId, status });

    const data = await advancedService.getAdvancedAnalytics(eventId, status);

    res.json({
      success: true,
      message: 'Advanced Analytics',
      data
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/simulation
 * Obtiene datos de simulación de campaña
 */
export async function getSimulation(req, res, next) {
  try {
    const { eventId } = req.query;
    logger.info('Simulation data request', { eventId });

    const data = await advancedService.getSimulationData(eventId);

    res.json({
      success: true,
      message: 'Simulation Data',
      data
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/analytics/verify-global
 * Ejecuta verificación global de matching
 */
export async function runGlobalVerification(req, res, next) {
  try {
    const { eventId } = req.query;
    logger.info(`Global verification request for event: ${eventId || 'all'}`);
    const result = await advancedService.runGlobalVerification(eventId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/analytics/leader-performance
 * Obtiene el rendimiento avanzado de líderes
 */
export async function getLeaderPerformance(req, res, next) {
  try {
    const { eventId } = req.query;
    logger.info(`Leader performance request for event: ${eventId || 'all'}`);
    const data = await advancedService.getLeaderPerformance(eventId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export default {
  getDashboard,
  getRegistrationStats,
  getLeaderStats,
  getEventStats,
  getEventDetail,
  getPuestoStats,
  getTrends,
  comparePeriods,
  getSummary,
  getAdvanced,
  getSimulation,
  runGlobalVerification,
  getLeaderPerformance
};
