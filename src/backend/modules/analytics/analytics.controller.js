/**
 * Analytics Controller
 * Endpoints HTTP para estadísticas y análisis
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import analyticsService from './analytics.service.js';

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
 * Obtiene análisis avanzado con agregaciones enterprise
 * Query params: eventId, leaderId, puestoId, localidad, startDate, endDate
 */
export async function getAdvanced(req, res, next) {
  try {
    const { eventId, leaderId, puestoId, localidad, startDate, endDate } = req.query;
    
    logger.info('Advanced analytics request', { eventId, leaderId, puestoId });

    // Validar y construir filtros
    const filters = {};
    if (eventId) {
      if (!eventId.match(/^[0-9a-f]{24}$/i)) {
        return next(AppError.badRequest('eventId inválido'));
      }
      filters.eventId = eventId;
    }
    if (leaderId) filters.leaderId = leaderId;
    if (puestoId) filters.puestoId = puestoId;
    if (localidad) filters.localidad = localidad;
    if (startDate) {
      try {
        filters.startDate = new Date(startDate);
        if (isNaN(filters.startDate.getTime())) throw new Error();
      } catch {
        return next(AppError.badRequest('startDate debe ser fecha válida ISO'));
      }
    }
    if (endDate) {
      try {
        filters.endDate = new Date(endDate);
        if (isNaN(filters.endDate.getTime())) throw new Error();
      } catch {
        return next(AppError.badRequest('endDate debe ser fecha válida ISO'));
      }
    }

    const dashboard = await analyticsService.getAdvancedDashboard(filters);

    res.json({
      success: true,
      message: 'Advanced Analytics Dashboard',
      data: dashboard
    });
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
  getAdvanced
};
