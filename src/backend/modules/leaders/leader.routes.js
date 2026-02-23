/**
 * Leader Routes
 * Define todas las rutas del módulo de líderes
 */

import express from 'express';
import * as leaderController from './leader.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { roleMiddleware } from '../../middlewares/role.middleware.js';

const router = express.Router();

/**
 * Rutas públicas (solo requieren token válido)
 */
router.get('/token/:token', leaderController.getLeaderByToken);

/**
 * Rutas autenticadas (requieren autenticación)
 */
router.use(authMiddleware);

// Listar líderes
router.get('/', leaderController.getLeaders);

// Obtener líder destacados
router.get('/top', leaderController.getTopLeaders);

// Obtener un líder por ID
router.get('/:id', leaderController.getLeader);

// Obtener credenciales
router.get('/:id/credentials', leaderController.getLeaderCredentials);

/**
 * Rutas solo para admins
 */
router.use(roleMiddleware('admin'));

// Crear nuevo líder
router.post('/', leaderController.createLeader);

// Actualizar líder
router.put('/:id', leaderController.updateLeader);

// Eliminar líder
router.delete('/:id', leaderController.deleteLeader);

// Enviar email de acceso
router.post('/:id/send-access', leaderController.sendAccessEmail);

// Generar contraseña temporal
router.post('/:id/generate-password', leaderController.generateTemporaryPassword);

export default router;
