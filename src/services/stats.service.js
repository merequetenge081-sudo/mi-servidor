/**
 * Stats Service with aggregation pipeline
 * Provides advanced analytics with organization support
 */

import metricsService from "./metrics.service.js";
import logger from "../config/logger.js";

export class StatsService {
  /**
   * Get comprehensive stats with multi-tenant support
   */
  static async getStats(organizationId = null, eventId = null) {
    try {
      const summary = await metricsService.getStatsSummary({
        organizationId,
        eventId
      });

      const byLeader = await metricsService.getLeaderStats({
        organizationId,
        eventId
      });

      return {
        ...summary,
        byLeader
      };
    } catch (error) {
      logger.error("Get stats error:", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get daily stats with aggregation
   */
  static async getDailyStats(organizationId = null, eventId = null, days = 30) {
    try {
      return await metricsService.getDailyStats(
        { organizationId, eventId },
        parseInt(days, 10)
      );
    } catch (error) {
      logger.error("Get daily stats error:", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get leader performance stats
   */
  static async getLeaderStats(organizationId = null, leaderId = null) {
    try {
      return await metricsService.getLeaderStats({
        organizationId,
        leaderId
      });
    } catch (error) {
      logger.error("Get leader stats error:", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get event comparison stats
   */
  static async getEventStats(organizationId = null) {
    try {
      return await metricsService.getEventStats({ organizationId });
    } catch (error) {
      logger.error("Get event stats error:", { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Get geographic stats (by location/area)
   */
  static async getGeographicStats(organizationId = null, eventId = null) {
    try {
      return await metricsService.getGeographicStats({
        organizationId,
        eventId
      });
    } catch (error) {
      logger.error("Get geographic stats error:", { error: error.message, stack: error.stack });
      throw error;
    }
  }
}

export default StatsService;
