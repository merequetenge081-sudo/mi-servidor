/**
 * WhatsApp Repository
 * Consultas para envío de mensajes WhatsApp
 */

import { Registration } from '../../../models/Registration.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('WhatsAppRepository');

/**
 * Obtiene registraciones por IDs para envío
 */
export async function getRegistrationsForSending(registrationIds) {
  try {
    logger.debug('Fetching registrations for WhatsApp sending', { count: registrationIds.length });

    const registrations = await Registration.find({ _id: { $in: registrationIds } }).lean();

    return registrations;
  } catch (error) {
    logger.error('Error fetching registrations', { error: error.message });
    throw AppError.internal('Error fetching registrations');
  }
}

/**
 * Obtiene líder por ID
 */
export async function getLeaderById(leaderId) {
  try {
    logger.debug('Fetching leader', { leaderId });

    const leader = await Leader.findById(leaderId).lean();

    if (!leader) {
      throw AppError.notFound(`Leader ${leaderId} not found`);
    }

    return leader;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error fetching leader', { error: error.message });
    throw AppError.serverError('Error fetching leader');
  }
}

/**
 * Actualiza estado de notificación WhatsApp en registración
 */
export async function updateWhatsAppNotificationStatus(registrationId, sent = true) {
  try {
    const update = { 'notifications.whatsappSent': sent, 'notifications.whatsappSentAt': new Date() };

    const registration = await Registration.findByIdAndUpdate(registrationId, update, { new: true });

    if (!registration) {
      throw AppError.notFound(`Registration ${registrationId} not found`);
    }

    return registration.toObject();
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error updating WhatsApp status', { error: error.message });
    throw AppError.serverError('Error updating WhatsApp status');
  }
}

/**
 * Obtiene registraciones por líder para broadcast
 */
export async function getRegistrationsByLeader(leaderId, eventId = null) {
  try {
    const filter = { leaderId: { $in: [leaderId, { $toString: leaderId }] } };
    if (eventId) filter.eventId = eventId;

    const registrations = await Registration.find(filter).lean();
    return registrations;
  } catch (error) {
    logger.error('Error fetching registrations by leader', { error: error.message });
    throw AppError.internal('Error fetching registrations');
  }
}

/**
 * Obtiene registraciones por evento para broadcast
 */
export async function getRegistrationsByEvent(eventId) {
  try {
    const registrations = await Registration.find({ eventId }).lean();
    return registrations;
  } catch (error) {
    logger.error('Error fetching registrations by event', { error: error.message });
    throw AppError.internal('Error fetching registrations');
  }
}

export default {
  getRegistrationsForSending,
  getLeaderById,
  updateWhatsAppNotificationStatus,
  getRegistrationsByLeader,
  getRegistrationsByEvent
};
