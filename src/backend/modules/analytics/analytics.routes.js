/**
 * Analytics Routes
 * Rutas para estadísticas y análisis
 */

import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as analyticsController from './analytics.controller.js';

const router = express.Router();

/**
 * GET /api/v2/analytics/dashboard
 * Dashboard completo (público)
 */
router.get('/dashboard', analyticsController.getDashboard);

/**
 * GET /api/v2/analytics/summary
 * Resumen ejecutivo (público)
 */
router.get('/summary', analyticsController.getSummary);

/**
 * GET /api/v2/analytics/advanced
 * ⭐ NUEVO: Dashboard avanzado con agregaciones enterprise BI
 * Query: eventId?, leaderId?, puestoId?, localidad?, startDate?, endDate?
 */
router.get('/advanced', analyticsController.getAdvanced);

/**
 * GET /api/v2/analytics/registrations
 * Estadísticas de registraciones (público)
 * Query: eventId?, period?
 */
router.get('/registrations', analyticsController.getRegistrationStats);

/**
 * GET /api/v2/analytics/leaders
 * Estadísticas de líderes (público)
 * Query: eventId?
 */
router.get('/leaders', analyticsController.getLeaderStats);

/**
 * GET /api/v2/analytics/events
 * Estadísticas de eventos (público)
 * Query: eventId?
 */
router.get('/events', analyticsController.getEventStats);

/**
 * GET /api/v2/analytics/events/:eventId/detail
 * Detalles específicos de un evento (público)
 */
router.get('/events/:eventId/detail', analyticsController.getEventDetail);

/**
 * GET /api/v2/analytics/puestos
 * Estadísticas de puestos (público)
 */
router.get('/puestos', analyticsController.getPuestoStats);

/**
 * GET /api/v2/analytics/trends
 * Análisis de tendencias (público)
 * Query: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), eventId?
 */
router.get('/trends', analyticsController.getTrends);

/**
 * POST /api/v2/analytics/compare
 * Compara dos períodos (protegido)
 * Body: { period1Start, period1End, period2Start, period2End, eventId? }
 */
router.post('/compare', authMiddleware, analyticsController.comparePeriods);

export default router;
