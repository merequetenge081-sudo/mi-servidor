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
 * GET /api/v2/analytics/metrics
 * Obtiene métricas del dashboard con filtros opcionales
 */
export async function getDashboardMetrics(req, res, next) {
  try {
    const { eventId, region = 'all', leaderId = null, includeDetails } = req.query;
    const normalizedIncludeDetails = includeDetails === undefined
      ? true
      : !['0', 'false', 'no'].includes(String(includeDetails).trim().toLowerCase());

    logger.info('Dashboard metrics request', { eventId, region, leaderId, includeDetails: normalizedIncludeDetails });

    const metrics = await analyticsService.getDashboardMetrics({
      eventId,
      region,
      leaderId,
      includeDetails: normalizedIncludeDetails
    });

    res.json({
      success: true,
      message: 'Dashboard Metrics',
      data: metrics
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
 * GET /api/v2/analytics/materialized
 * Obtiene tablas materializadas (Daily/Campaign/Leader/Territory)
 */
export async function getMaterialized(req, res, next) {
  try {
    const { eventId } = req.query;
    logger.info('Materialized metrics request', { eventId });

    const data = await analyticsService.getMaterializedMetrics(eventId);
    res.json({
      success: true,
      message: 'Materialized Metrics',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdvancedSummary(req, res, next) {
  try {
    const { eventId = null, status = 'all', leaderId = null, region = 'all', includeCharts = 'true' } = req.query;
    logger.info('Advanced summary request', { eventId, status, leaderId, region, includeCharts });

    const data = await advancedService.getAdvancedSummaryAnalytics(
      eventId,
      status,
      leaderId,
      region,
      includeCharts !== 'false' && includeCharts !== '0'
    );

    res.json({
      success: true,
      message: 'Advanced Summary Analytics',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdvancedCharts(req, res, next) {
  try {
    const { eventId = null, status = 'all', leaderId = null, region = 'all' } = req.query;
    logger.info('Advanced charts request', { eventId, status, leaderId, region });

    const data = await advancedService.getAdvancedChartsAnalytics(
      eventId,
      status,
      leaderId,
      region
    );

    res.json({
      success: true,
      message: 'Advanced Charts Analytics',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getHierarchyLocalidades(req, res, next) {
  try {
    const data = await advancedService.getHierarchyLocalidades(req.query, {
      organizationId: req.orgId || req.user?.organizationId || null
    });
    res.json({ success: true, message: 'Hierarchy Localidades', data });
  } catch (error) {
    next(error);
  }
}

export async function getHierarchyPuestos(req, res, next) {
  try {
    const data = await advancedService.getHierarchyPuestosByLocalidad(req.params.localidadId, req.query, {
      organizationId: req.orgId || req.user?.organizationId || null
    });
    res.json({ success: true, message: 'Hierarchy Puestos', data });
  } catch (error) {
    next(error);
  }
}

export async function getHierarchyMesas(req, res, next) {
  try {
    const data = await advancedService.getHierarchyMesasByPuesto(req.params.puestoId, req.query, {
      organizationId: req.orgId || req.user?.organizationId || null
    });
    res.json({ success: true, message: 'Hierarchy Mesas', data });
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
    const { eventId, status, leaderId, region, includeHierarchy } = req.query;
    logger.info('Advanced analytics request', { eventId, status, leaderId, region, includeHierarchy });

    const data = await advancedService.getAdvancedAnalytics(
      eventId,
      status,
      leaderId,
      region,
      includeHierarchy !== 'false'
    );

    res.json({
      success: true,
      message: 'Advanced Analytics',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvalidRows(req, res, next) {
  try {
    const {
      eventId,
      leaderId,
      regionScope,
      localidad,
      reason,
      reviewStatus,
      search,
      page,
      limit,
      countOnly
    } = req.query;

    const data = await advancedService.getInvalidDataAnalytics(
      {
        eventId,
        leaderId,
        regionScope,
        localidad,
        reason,
        reviewStatus,
        search,
        page,
        limit,
        countOnly
      },
      { organizationId: req.orgId || null }
    );

    res.json({
      success: true,
      message: 'Invalid Data Analytics',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getInvalidRowDetail(req, res, next) {
  try {
    const data = await advancedService.getInvalidDataDetail(req.params.id, {
      organizationId: req.orgId || null
    });

    res.json({
      success: true,
      message: 'Invalid Data Detail',
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
      const { eventId, targetDate } = req.query;
      logger.info('Simulation data request', { eventId, targetDate });

      const data = await advancedService.getSimulationData(eventId, targetDate);

    res.json({
      success: true,
      message: 'Simulation Data',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function getSimulationBase(req, res, next) {
  try {
    const data = await advancedService.getSimulationBaseData(req.query, {
      organizationId: req.orgId || req.user?.organizationId || null
    });

    res.json({
      success: true,
      message: 'Simulation Base',
      data
    });
  } catch (error) {
    next(error);
  }
}

export async function runSimulation(req, res, next) {
  try {
    const payload = {
      ...(req.body || {}),
      eventId: req.body?.eventId || req.query?.eventId || null,
      region: req.body?.region || req.query?.region || 'all'
    };
    const data = await advancedService.runCampaignSimulation(payload, {
      organizationId: req.orgId || req.user?.organizationId || null
    });

    res.json({
      success: true,
      message: 'Simulation Result',
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
    res.json({ success: true, data: result });
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
  getDashboardMetrics,
  getRegistrationStats,
  getLeaderStats,
  getEventStats,
  getEventDetail,
  getPuestoStats,
  getTrends,
  comparePeriods,
  getSummary,
  getMaterialized,
  getAdvanced,
  getAdvancedCharts,
  getSimulation,
  getSimulationBase,
  runSimulation,
  runGlobalVerification,
  getLeaderPerformance
};
