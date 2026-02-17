import logger from "../config/logger.js";
import StatsService from "../services/stats.service.js";
import cacheService from "../services/cache.service.js";

export async function getStats(req, res) {
  try {
    const { eventId } = req.query;
    const organizationId = req.user?.organizationId || null;
    
    // Use cache for stats
    const cacheKey = cacheService.buildKey('stats', eventId || 'all', organizationId);
    const stats = await cacheService.getOrFetch(
      cacheKey,
      () => StatsService.getStats(organizationId, eventId),
      300 // 5 min TTL
    );
    
    res.json(stats);
  } catch (error) {
    logger.error('Get stats error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
}

export async function getDailyStats(req, res) {
  try {
    const { eventId, days = 30 } = req.query;
    const organizationId = req.user?.organizationId || null;
    
    const stats = await StatsService.getDailyStats(organizationId, eventId, parseInt(days));
    res.json(stats);
  } catch (error) {
    logger.error('Get daily stats error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estadísticas diarias' });
  }
}

export async function getLeaderStats(req, res) {
  try {
    const { leaderId } = req.params;
    const organizationId = req.user?.organizationId || null;
    
    const stats = await StatsService.getLeaderStats(organizationId, leaderId);
    if (!stats) {
      return res.status(404).json({ error: 'Líder no encontrado' });
    }
    
    res.json(stats);
  } catch (error) {
    logger.error('Get leader stats error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estadísticas del líder' });
  }
}

export async function getEventStats(req, res) {
  try {
    const organizationId = req.user?.organizationId || null;
    const stats = await StatsService.getEventStats(organizationId);
    res.json(stats);
  } catch (error) {
    logger.error('Get event stats error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estadísticas de eventos' });
  }
}

export async function getGeographicStats(req, res) {
  try {
    const { eventId } = req.query;
    const organizationId = req.user?.organizationId || null;
    const stats = await StatsService.getGeographicStats(organizationId, eventId);
    res.json(stats);
  } catch (error) {
    logger.error('Get geographic stats error:', { error: error.message });
    res.status(500).json({ error: 'Error al obtener estadísticas geográficas' });
  }
}
