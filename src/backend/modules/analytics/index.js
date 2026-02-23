/**
 * Analytics Module
 * Punto de entrada
 */

import * as analyticsController from './analytics.controller.js';
import * as analyticsService from './analytics.service.js';
import * as analyticsRepository from './analytics.repository.js';
import analyticsRoutes from './analytics.routes.js';

export {
  analyticsController,
  analyticsService,
  analyticsRepository,
  analyticsRoutes
};

export default analyticsRoutes;
