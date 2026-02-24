/**
 * Leader Controller
 * Capa de presentación - Maneja requests/responses HTTP
 * Delega lógica de negocio a LeaderService
 */

import leaderService from './leader.service.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import config from '../../config/config.js';
import { parseLimit, parsePagination } from '../../../utils/pagination.js';

const logger = createLogger('LeaderController');

/**
 * POST /api/leaders - Crear líder
 */
export async function createLeader(req, res, next) {
  try {
    const { name, email, phone, area, eventId, customUsername } = req.body;
    const organizationId = req.user.organizationId;

    logger.info('Crear líder request', { name, email });

    // Validación básica
    if (!name) {
      throw AppError.badRequest('El nombre es obligatorio');
    }

    const leader = await leaderService.createLeader(
      { name, email, phone, area, eventId, customUsername },
      organizationId
    );

    res.status(201).json({
      success: true,
      data: leader
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders - Listar líderes
 */
export async function getLeaders(req, res, next) {
  try {
    const { eventId, active, search } = req.query;
    const organizationId = req.user.organizationId;

    const { page, limit } = parsePagination(req.query, {
      defaultLimit: config.DEFAULT_PAGE_SIZE,
      maxLimit: config.MAX_PAGE_SIZE
    });

    logger.info('Listar líderes', { page, limit });

    // Construir filtro
    const filter = { organizationId };
    
    if (eventId) filter.eventId = eventId;
    if (active !== undefined) filter.active = active === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await leaderService.getLeaders(filter, { page, limit });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders/:id - Obtener líder por ID
 */
export async function getLeader(req, res, next) {
  try {
    const { id } = req.params;
    
    logger.info('Obtener líder', { id });

    const leader = await leaderService.getLeaderById(id);

    res.json({
      success: true,
      data: leader
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders/:id/credentials - Obtener credenciales
 */
export async function getLeaderCredentials(req, res, next) {
  try {
    const { id } = req.params;

    logger.info('Obtener credenciales', { id });

    const credentials = await leaderService.getLeaderCredentials(id);

    res.json({
      success: true,
      data: credentials
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders/token/:token - Obtener líder por token (público)
 */
export async function getLeaderByToken(req, res, next) {
  try {
    const { token } = req.params;

    logger.info('Obtener líder por token');

    const leader = await leaderService.getLeaderByToken(token);

    res.json({
      success: true,
      data: leader
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/leaders/:id - Actualizar líder
 */
export async function updateLeader(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info('Actualizar líder', { id });

    const leader = await leaderService.updateLeader(id, updateData);

    res.json({
      success: true,
      data: leader
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/leaders/:id - Eliminar líder
 */
export async function deleteLeader(req, res, next) {
  try {
    const { id } = req.params;

    logger.info('Eliminar líder', { id });

    const result = await leaderService.deleteLeader(id);

    res.json({
      success: true,
      message: 'Líder eliminado correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders/top - Líderes destacados
 */
export async function getTopLeaders(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, {
      defaultLimit: 10,
      maxLimit: config.MAX_PAGE_SIZE
    });
    const organizationId = req.user.organizationId;

    logger.info('Obtener líderes destacados', { limit });

    const leaders = await leaderService.getTopLeaders(parseInt(limit), { organizationId });

    res.json({
      success: true,
      data: leaders
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leaders/:id/send-access - Enviar email de acceso
 */
export async function sendAccessEmail(req, res, next) {
  try {
    const { id } = req.params;
    const { sendQR, sendCredentials, sendWelcome } = req.body;
    const baseUrl = req.baseUrl || process.env.BASE_URL;

    logger.info('Enviar email de acceso', { id });

    const result = await leaderService.sendAccessEmail(id, baseUrl, {
      sendQR,
      sendCredentials,
      sendWelcome
    });

    res.json({
      success: true,
      message: 'Email enviado correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/leaders/:id/generate-password - Generar contraseña temporal
 */
export async function generateTemporaryPassword(req, res, next) {
  try {
    const { id } = req.params;
    const baseUrl = req.baseUrl || process.env.BASE_URL;

    logger.info('Generar contraseña temporal', { id });

    const result = await leaderService.generateTemporaryPassword(id, baseUrl);

    res.json({
      success: true,
      message: 'Contraseña temporal generada',
      data: result
    });
  } catch (error) {
    next(error);
  }
}
