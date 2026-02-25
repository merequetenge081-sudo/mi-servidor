/**
 * Auth Routes
 * Rutas para autenticación
 */

import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as authController from './auth.controller.js';

const router = express.Router();

/**
 * POST /api/v2/auth/admin-login
 * @public
 * @param {string} username - Admin username
 * @param {string} password - Admin password
 */
router.post('/admin-login', authController.adminLogin);

/**
 * POST /api/v2/auth/leader-login
 * @public
 * @param {string} email - Leader email
 * @param {string} password - Leader password
 */
router.post('/leader-login', authController.leaderLogin);

/**
 * POST /api/v2/auth/change-password
 * @protected
 * @param {string} oldPassword - Contraseña anterior
 * @param {string} newPassword - Nueva contraseña
 */
router.post('/change-password', authMiddleware, authController.changePassword);

/**
 * POST /api/v2/auth/request-password-reset
 * @public
 * @param {string} email - Email para reset
 * @param {string} role - Rol (admin | leader)
 */
router.post('/request-password-reset', authController.requestPasswordReset);

/**
 * POST /api/v2/auth/reset-password
 * @public
 * @param {string} token - Token de reset
 * @param {string} newPassword - Nueva contraseña
 * @param {string} role - Rol (admin | leader)
 */
router.post('/reset-password', authController.resetPassword);

/**
 * POST /api/v2/auth/verify-token
 * @protected
 * Verifica que el token JWT es válido y retorna información del usuario
 */
router.post('/verify-token', authMiddleware, authController.verifyToken);

/**
 * POST /api/v2/auth/verify-leader-token
 * @public (SIN autenticación requerida)
 * Verifica un token público de líder y genera un JWT temporal para acceso desde URLs
 * @param {string} token - Token público del líder (UUID)
 */
router.post('/verify-leader-token', authController.verifyLeaderToken);

/**
 * POST /api/v2/auth/logout
 * @protected
 * Logout del usuario (simplemente confirma)
 */
router.post('/logout', authMiddleware, authController.logout);

export default router;
