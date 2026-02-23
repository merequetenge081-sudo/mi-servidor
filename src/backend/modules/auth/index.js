/**
 * Auth Module
 * Punto de entrada
 */

import * as authController from './auth.controller.js';
import * as authService from './auth.service.js';
import * as authRepository from './auth.repository.js';
import authRoutes from './auth.routes.js';

export {
  authController,
  authService,
  authRepository,
  authRoutes
};

export default authRoutes;
