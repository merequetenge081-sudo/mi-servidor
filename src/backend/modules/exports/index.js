/**
 * Exports Module
 * Punto de entrada
 */

import * as exportsController from './exports.controller.js';
import * as exportsService from './exports.service.js';
import * as exportsRepository from './exports.repository.js';
import exportsRoutes from './exports.routes.js';

export {
  exportsController,
  exportsService,
  exportsRepository,
  exportsRoutes
};

export default exportsRoutes;
