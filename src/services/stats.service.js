/**
 * Stats Service with aggregation pipeline
 * Provides advanced analytics with organization support
 */

import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import logger from "../config/logger.js";

export class StatsService {
  /**
   * Get comprehensive stats with multi-tenant support
   */
  static async getStats(organizationId = null, eventId = null) {
    try {
      const match = {};
      if (organizationId) match.organizationId = organizationId;
      if (eventId) match.eventId = eventId;

      // Use aggregation for better performance
      const statsResult = await Registration.aggregate([
        { $match: match },
        {
          $facet: {
            totalRegistrations: [{ $count: "count" }],
            totalConfirmed: [
              { $match: { confirmed: true } },
              { $count: "count" }
            ],
            registeredToVote: [
              { $match: { registeredToVote: true } },
              { $count: "count" }
            ],
            byLeader: [
              {
                $group: {
                  _id: "$leaderId",
                  count: { $sum: 1 },
                  confirmed: { $sum: { $cond: ["$confirmed", 1, 0] } }
                }
              },
              { $sort: { count: -1 } }
            ]
          }
        }
      ]);

      const stats = statsResult[0];
      const totalRegistrations = stats.totalRegistrations[0]?.count || 0;
      const totalConfirmed = stats.totalConfirmed[0]?.count || 0;
      const registeredToVote = stats.registeredToVote[0]?.count || 0;

      return {
        totalRegistrations,
        totalConfirmed,
        confirmationRate: totalRegistrations > 0 
          ? ((totalConfirmed / totalRegistrations) * 100).toFixed(2) 
          : 0,
        registeredToVote,
        notRegisteredToVote: totalRegistrations - registeredToVote,
        totalLeaders: await Leader.countDocuments({ 
          ...(organizationId && { organizationId }),
          active: true 
        }),
        totalEvents: await Event.countDocuments({ 
          ...(organizationId && { organizationId }),
          active: true 
        }),
        byLeader: stats.byLeader
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
      const match = {};
      if (organizationId) match.organizationId = organizationId;
      if (eventId) match.eventId = eventId;

      // Calculate date from X days ago
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyStats = await Registration.aggregate([
        {
          $match: {
            ...match,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            totalRegistrations: { $sum: 1 },
            confirmedCount: { $sum: { $cond: ["$confirmed", 1, 0] } },
            registeredToVote: { $sum: { $cond: ["$registeredToVote", 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return dailyStats;
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
      const match = { active: true };
      if (organizationId) match.organizationId = organizationId;
      if (leaderId) match.leaderId = leaderId;

      const leaderStats = await Registration.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$leaderId",
            totalRegistrations: { $sum: 1 },
            confirmedCount: { $sum: { $cond: ["$confirmed", 1, 0] } },
            registeredToVote: { $sum: { $cond: ["$registeredToVote", 1, 0] } },
            lastRegistration: { $max: "$createdAt" },
            firstRegistration: { $min: "$createdAt" }
          }
        },
        {
          $addFields: {
            confirmationRate: {
              $cond: [
                { $gt: ["$totalRegistrations", 0] },
                { $multiply: [{ $divide: ["$confirmedCount", "$totalRegistrations"] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { totalRegistrations: -1 } }
      ]);

      return leaderStats;
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
      const match = {};
      if (organizationId) match.organizationId = organizationId;

      const eventStats = await Registration.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$eventId",
            totalRegistrations: { $sum: 1 },
            confirmedCount: { $sum: { $cond: ["$confirmed", 1, 0] } },
            registeredToVote: { $sum: { $cond: ["$registeredToVote", 1, 0] } },
            uniqueLeaders: { $addToSet: "$leaderId" },
            uniqueCedulas: { $addToSet: "$cedula" }
          }
        },
        {
          $addFields: {
            confirmationRate: {
              $cond: [
                { $gt: ["$totalRegistrations", 0] },
                { $multiply: [{ $divide: ["$confirmedCount", "$totalRegistrations"] }, 100] },
                0
              ]
            },
            uniqueLeaders: { $size: "$uniqueLeaders" },
            uniquePersons: { $size: "$uniqueCedulas" }
          }
        },
        { $sort: { totalRegistrations: -1 } }
      ]);

      return eventStats;
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
      const match = {};
      if (organizationId) match.organizationId = organizationId;
      if (eventId) match.eventId = eventId;

      const geoStats = await Registration.aggregate([
        { $match: match },
        {
          $group: {
            _id: "$localidad",
            count: { $sum: 1 },
            confirmed: { $sum: { $cond: ["$confirmed", 1, 0] } }
          }
        },
        {
          $addFields: {
            confirmationRate: {
              $cond: [
                { $gt: ["$count", 0] },
                { $multiply: [{ $divide: ["$confirmed", "$count"] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      return geoStats;
    } catch (error) {
      logger.error("Get geographic stats error:", { error: error.message, stack: error.stack });
      throw error;
    }
  }
}

export default StatsService;
