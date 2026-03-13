import logger from "../config/logger.js";
import StatsService from "../services/stats.service.js";
import cacheService from "../services/cache.service.js";
import { sendError } from "../utils/httpError.js";

export async function getStats(req, res) {
  try {
    const { eventId } = req.query;
    const organizationId = req.user.organizationId;

    const cacheKey = cacheService.buildKey("stats", eventId || "all", organizationId);
    const stats = await cacheService.getOrFetch(
      cacheKey,
      () => StatsService.getStats(organizationId, eventId),
      300
    );

    return res.json(stats);
  } catch (error) {
    logger.error("Get stats error:", { error: error.message });
    return sendError(res, 500, "Error al obtener estadísticas", "GET_STATS_ERROR", error.message);
  }
}

export async function getDailyStats(req, res) {
  try {
    const { eventId, days = 30 } = req.query;
    const organizationId = req.user.organizationId;

    const stats = await StatsService.getDailyStats(organizationId, eventId, parseInt(days, 10));
    return res.json(stats);
  } catch (error) {
    logger.error("Get daily stats error:", { error: error.message });
    return sendError(res, 500, "Error al obtener estadísticas diarias", "GET_DAILY_STATS_ERROR", error.message);
  }
}

export async function getLeaderStats(req, res) {
  try {
    const { leaderId } = req.params;
    const organizationId = req.user.organizationId;

    const stats = await StatsService.getLeaderStats(organizationId, leaderId);
    if (!stats) {
      return sendError(res, 404, "Líder no encontrado");
    }

    return res.json(stats);
  } catch (error) {
    logger.error("Get leader stats error:", { error: error.message });
    return sendError(res, 500, "Error al obtener estadísticas del líder", "GET_LEADER_STATS_ERROR", error.message);
  }
}

export async function getEventStats(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const stats = await StatsService.getEventStats(organizationId);
    return res.json(stats);
  } catch (error) {
    logger.error("Get event stats error:", { error: error.message });
    return sendError(res, 500, "Error al obtener estadísticas de eventos", "GET_EVENT_STATS_ERROR", error.message);
  }
}

export async function getGeographicStats(req, res) {
  try {
    const { eventId } = req.query;
    const organizationId = req.user.organizationId;
    const stats = await StatsService.getGeographicStats(organizationId, eventId);
    return res.json(stats);
  } catch (error) {
    logger.error("Get geographic stats error:", { error: error.message });
    return sendError(res, 500, "Error al obtener estadísticas geográficas", "GET_GEOGRAPHIC_STATS_ERROR", error.message);
  }
}
