import { AuditConsentLog } from "../models/AuditConsentLog.js";
import { Leader } from "../models/Leader.js";
import logger from "../config/logger.js";

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

export const ConsentLogService = {
  async logTermsAccepted(req, leaderId) {
    try {
      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      const leader = await Leader.findById(leaderId).select('organizationId');
      const orgId = leader?.organizationId || null;

      await AuditConsentLog.create({
        leaderId,
        action: 'terms_accepted',
        ipAddress: ip,
        userAgent,
        organizationId: orgId,
        details: { acceptedFrom: 'leader_dashboard' }
      });

      logger.info(`Consent log: terms_accepted by leader ${leaderId} from IP ${ip}`);
      return true;
    } catch (error) {
      logger.error('Failed to log terms acceptance:', { error: error.message });
      return false;
    }
  },

  async logCitizenRegistered(req, leaderId, citizenId, additionalDetails = {}) {
    try {
      const ip = getClientIp(req);
      const userAgent = req.headers['user-agent'] || 'unknown';
      
      const leader = await Leader.findById(leaderId).select('organizationId');
      const orgId = leader?.organizationId || null;

      await AuditConsentLog.create({
        leaderId,
        action: 'citizen_registered',
        citizenReferenceId: citizenId,
        ipAddress: ip,
        userAgent,
        organizationId: orgId,
        details: {
          registeredFrom: 'form',
          ...additionalDetails
        }
      });

      logger.info(`Consent log: citizen_registered by leader ${leaderId}, citizen ${citizenId}`);
      return true;
    } catch (error) {
      logger.error('Failed to log citizen registration:', { error: error.message });
      return false;
    }
  },

  async getConsentLogsByLeader(leaderId, limit = 100) {
    try {
      const logs = await AuditConsentLog.find({ leaderId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      return logs;
    } catch (error) {
      logger.error('Failed to get consent logs:', { error: error.message });
      return [];
    }
  },

  async hasLeaderAcceptedTerms(leaderId) {
    try {
      const leader = await Leader.findById(leaderId).select('hasAcceptedLegalTerms');
      return leader?.hasAcceptedLegalTerms || false;
    } catch (error) {
      logger.error('Failed to check terms acceptance:', { error: error.message });
      return false;
    }
  }
};
