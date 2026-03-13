/**
 * Leader Controller
 * HTTP layer for leader endpoints
 */

import leaderService from './leader.service.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import config from '../../config/config.js';
import { parseLimit, parsePagination } from '../../../utils/pagination.js';
import { Registration } from '../../../models/Registration.js';

const logger = createLogger('LeaderController');

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return undefined;
}

function parseSort(query = {}) {
  const allowedSortFields = new Set(['name', 'createdAt', 'updatedAt', 'registrations', 'active']);
  const field = allowedSortFields.has(query.sort) ? query.sort : 'name';
  const order = String(query.order || 'asc').toLowerCase() === 'desc' ? -1 : 1;
  return { [field]: order };
}

async function attachLeaderMetrics(items, organizationId, eventId) {
  if (!Array.isArray(items) || items.length === 0) return items || [];
  const leaderIds = items.map((leader) => leader.leaderId).filter(Boolean);
  if (leaderIds.length === 0) return items;

  const metrics = await Registration.aggregate([
    { $match: { organizationId, ...(eventId ? { eventId } : {}), leaderId: { $in: leaderIds } } },
    {
      $group: {
        _id: '$leaderId',
        total: { $sum: 1 },
        confirmed: { $sum: { $cond: [{ $eq: ['$confirmed', true] }, 1, 0] } },
        duplicates: { $sum: { $cond: [{ $eq: ['$workflowStatus', 'duplicate'] }, 1, 0] } },
        invalid: { $sum: { $cond: [{ $eq: ['$workflowStatus', 'invalid'] }, 1, 0] } }
      }
    }
  ]);
  const byLeaderId = new Map(metrics.map((metric) => [String(metric._id), metric]));
  return items.map((leader) => {
    const metric = byLeaderId.get(String(leader.leaderId));
    return {
      ...leader,
      metrics: metric
        ? {
          total: Number(metric.total || 0),
          confirmed: Number(metric.confirmed || 0),
          duplicates: Number(metric.duplicates || 0),
          invalid: Number(metric.invalid || 0)
        }
        : null
    };
  });
}

/**
 * POST /api/leaders - Crear lider
 */
export async function createLeader(req, res, next) {
  try {
    const { name, email, phone, area, eventId, customUsername } = req.body;
    const organizationId = req.user.organizationId;

    logger.info('Crear lider request', { name, email });

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
 * GET /api/leaders - Listar lideres
 */
export async function getLeaders(req, res, next) {
  try {
    const { eventId, search } = req.query;
    const organizationId = req.user.organizationId;

    const { page, limit } = parsePagination(req.query, {
      defaultLimit: config.DEFAULT_PAGE_SIZE,
      maxLimit: config.MAX_PAGE_SIZE
    });

    const active = parseBoolean(req.query.active);
    const includeMetrics = parseBoolean(req.query.includeMetrics) === true;
    const sort = parseSort(req.query);

    logger.info('Listar lideres', { page, limit, includeMetrics });

    const filter = { organizationId };
    if (eventId) filter.eventId = eventId;
    if (active !== undefined) filter.active = active;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await leaderService.getLeaders(filter, { page, limit, sort });
    let items = result.data || [];

    if (includeMetrics && items.length > 0) {
      items = await attachLeaderMetrics(items, organizationId, eventId);
    }

    const payload = {
      items,
      total: result.pagination?.total || 0,
      page: result.pagination?.page || page,
      limit: result.pagination?.limit || limit,
      totalPages: result.pagination?.pages || 0,
      source: {
        endpoint: '/api/v2/leaders',
        trace: 'leaders.v2',
        filter: {
          eventId: eventId || null,
          active: active === undefined ? null : active,
          search: search || null
        }
      }
    };

    logger.info('[V2 TRACE] leaders.table <- /api/v2/leaders', {
      organizationId,
      page: payload.page,
      limit: payload.limit
    });

    res.json({
      success: true,
      ...payload,
      data: payload.items,
      pagination: {
        total: payload.total,
        page: payload.page,
        limit: payload.limit,
        pages: payload.totalPages
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/leaders/export
 * Exportar líderes con filtros v2
 */
export async function exportLeaders(req, res, next) {
  try {
    const input = { ...(req.query || {}), ...(req.body || {}) };
    const organizationId = req.user.organizationId;
    const eventId = input.eventId || req.query?.eventId;
    const search = input.search;
    const active = parseBoolean(input.active);
    const includeMetrics = parseBoolean(input.includeMetrics) !== false;
    const sort = parseSort(input);

    const limitInput = Number.parseInt(input.limit, 10);
    const limit = Number.isFinite(limitInput) && limitInput > 0
      ? Math.min(limitInput, 5000)
      : 2000;

    const filter = { organizationId };
    if (eventId) filter.eventId = eventId;
    if (active !== undefined) filter.active = active;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await leaderService.getLeaders(filter, { page: 1, limit, sort });
    let items = result.data || [];
    if (includeMetrics) {
      items = await attachLeaderMetrics(items, organizationId, eventId);
    }

    logger.info('[V2 TRACE] leaders.export <- /api/v2/leaders/export', {
      organizationId,
      count: items.length,
      limit
    });

    res.json({
      success: true,
      items,
      total: result.pagination?.total || items.length,
      limit,
      source: {
        endpoint: '/api/v2/leaders/export',
        trace: 'leaders.export.v2',
        filter: {
          eventId: eventId || null,
          active: active === undefined ? null : active,
          search: search || null
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders/:id - Obtener lider por ID
 */
export async function getLeader(req, res, next) {
  try {
    const { id } = req.params;
    logger.info('Obtener lider', { id });

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
 * GET /api/leaders/token/:token - Obtener lider por token (publico)
 */
export async function getLeaderByToken(req, res, next) {
  try {
    const { token } = req.params;
    logger.info('Obtener lider por token');

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
 * PUT /api/leaders/:id - Actualizar lider
 */
export async function updateLeader(req, res, next) {
  try {
    const { id } = req.params;
    const updateData = req.body;

    logger.info('Actualizar lider', { id });

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
 * DELETE /api/leaders/:id - Eliminar lider
 */
export async function deleteLeader(req, res, next) {
  try {
    const { id } = req.params;

    logger.info('Eliminar lider', { id });

    const result = await leaderService.deleteLeader(id);

    res.json({
      success: true,
      message: 'Lider eliminado correctamente',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/leaders/top - Lideres destacados
 */
export async function getTopLeaders(req, res, next) {
  try {
    const limit = parseLimit(req.query.limit, {
      defaultLimit: 10,
      maxLimit: config.MAX_PAGE_SIZE
    });
    const organizationId = req.user.organizationId;

    logger.info('Obtener lideres destacados', { limit });

    const leaders = await leaderService.getTopLeaders(parseInt(limit, 10), { organizationId });

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
 * POST /api/leaders/:id/generate-password - Generar contrasena temporal
 */
export async function generateTemporaryPassword(req, res, next) {
  try {
    const { id } = req.params;
    const baseUrl = req.baseUrl || process.env.BASE_URL;

    logger.info('Generar contrasena temporal', { id });

    const result = await leaderService.generateTemporaryPassword(id, baseUrl);

    res.json({
      success: true,
      message: 'Contrasena temporal generada',
      data: result
    });
  } catch (error) {
    next(error);
  }
}
