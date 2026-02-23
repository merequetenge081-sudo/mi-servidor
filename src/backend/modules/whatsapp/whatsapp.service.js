/**
 * WhatsApp Service
 * Lógica de negocio para envío de mensajes WhatsApp
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import whatsappRepository from './whatsapp.repository.js';
import { AuditService } from '../../../services/audit.service.js';

const logger = createLogger('WhatsAppService');

/**
 * Envía mensajes WhatsApp a múltiples registraciones
 * IMPORTANTE: Esta es una implementación stub. El envío real requiere integración con API de WhatsApp
 */
export async function sendWhatsAppMessages(registrationIds, message, templateType = 'custom', user = null) {
  try {
    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
      throw AppError.badRequest('registrationIds must be a non-empty array');
    }

    logger.info('Sending WhatsApp messages', { count: registrationIds.length, templateType });

    // Obtener registraciones
    const registrations = await whatsappRepository.getRegistrationsForSending(registrationIds);

    if (registrations.length === 0) {
      throw AppError.notFound('No registrations found for provided IDs');
    }

    const results = {
      sent: 0,
      failed: 0,
      failedIds: [],
      details: []
    };

    // Procesar cada registración
    for (const registration of registrations) {
      try {
        // Validar que tenga teléfono
        if (!registration.phone) {
          results.failed++;
          results.failedIds.push(registration._id.toString());
          logger.warn('Registration without phone', { regId: registration._id });
          continue;
        }

        // TODO: Implementar integración con WhatsApp API (Twilio, official WhatsApp API, etc)
        // Por ahora solo marcamos como enviado y registramos en auditoría

        // Actualizar estado en base de datos
        await whatsappRepository.updateWhatsAppNotificationStatus(registration._id.toString(), true);

        // Registrar en auditoría
        await AuditService.log(
          'SEND_WHATSAPP',
          'Registration',
          registration._id.toString(),
          user,
          { phone: registration.phone, templateType, messagePreview: message.substring(0, 50) },
          `WhatsApp message sent to ${registration.phone}`,
          null
        );

        results.sent++;
        results.details.push({
          registrationId: registration._id.toString(),
          phone: registration.phone,
          status: 'sent',
          timestamp: new Date()
        });

        logger.debug('WhatsApp message marked as sent', { regId: registration._id, phone: registration.phone });
      } catch (error) {
        logger.error('Error sending WhatsApp to registration', { regId: registration._id, error: error.message });
        results.failed++;
        results.failedIds.push(registration._id.toString());
      }
    }

    logger.info('WhatsApp batch sending completed', { sent: results.sent, failed: results.failed });

    return results;
  } catch (error) {
    logger.error('Error sending WhatsApp messages', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error sending WhatsApp messages');
  }
}

/**
 * Envía código QR a un líder por WhatsApp
 * IMPORTANTE: Esta es una implementación stub. Requiere generación e integración real con WhatsApp
 */
export async function sendQRCodeToLeader(leaderId, user = null) {
  try {
    if (!leaderId) {
      throw AppError.badRequest('leaderId is required');
    }

    logger.info('Sending QR code to leader', { leaderId });

    // Obtener líder
    const leader = await whatsappRepository.getLeaderById(leaderId);

    if (!leader.email && !leader.phone) {
      throw AppError.badRequest('Leader must have email or phone configured');
    }

    // TODO: Implementar generación real de código QR y envío por WhatsApp/Email
    // Por ahora solo registramos la acción

    // Registrar en auditoría
    await AuditService.log(
      'SEND_QR_CODE',
      'Leader',
      leaderId,
      user,
      { leaderId: leader.leaderId, email: leader.email, phone: leader.phone },
      `QR code sent to leader ${leader.username}`,
      null
    );

    logger.info('QR code marked as sent', { leaderId, email: leader.email });

    return {
      leaderId: leader._id.toString(),
      leaderId_old: leader.leaderId,
      email: leader.email,
      phone: leader.phone,
      qrCodeUrl: null,  // TODO: Implementar generación y hosting de QR
      status: 'pending',  // pending, sent, redirected_to_email
      sentAt: new Date()
    };
  } catch (error) {
    logger.error('Error sending QR to leader', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error sending QR code');
  }
}

/**
 * Envía mensaje broadcast a todas las registraciones de un líder
 */
export async function broadcastToLeaderRegistrations(leaderId, message, eventId = null, user = null) {
  try {
    if (!leaderId || !message) {
      throw AppError.badRequest('leaderId and message are required');
    }

    logger.info('Broadcasting to leader registrations', { leaderId, eventId });

    // Obtener registraciones del líder
    const registrations = await whatsappRepository.getRegistrationsByLeader(leaderId, eventId);

    if (registrations.length === 0) {
      throw AppError.notFound('No registrations found for this leader');
    }

    // Enviar mensajes
    const registrationIds = registrations.map(r => r._id.toString());
    const results = await sendWhatsAppMessages(registrationIds, message, 'leader_broadcast', user);

    logger.info('Leader broadcast completed', { leaderId, sent: results.sent, failed: results.failed });

    return {
      leaderId,
      totalRegistrations: registrations.length,
      sent: results.sent,
      failed: results.failed,
      failedIds: results.failedIds
    };
  } catch (error) {
    logger.error('Error broadcasting to leader registrations', { error: error.message });
    throw error instanceof AppError ? error : AppError.internal('Error broadcasting');
  }
}

/**
 * Envía mensaje broadcast a todas las registraciones de un evento
 */
export async function broadcastToEventRegistrations(eventId, message, user = null) {
  try {
    if (!eventId || !message) {
      throw AppError.badRequest('eventId and message are required');
    }

    logger.info('Broadcasting to event registrations', { eventId });

    // Obtener registraciones del evento
    const registrations = await whatsappRepository.getRegistrationsByEvent(eventId);

    if (registrations.length === 0) {
      throw AppError.notFound('No registrations found for this event');
    }

    // Enviar mensajes
    const registrationIds = registrations.map(r => r._id.toString());
    const results = await sendWhatsAppMessages(registrationIds, message, 'event_broadcast', user);

    logger.info('Event broadcast completed', { eventId, sent: results.sent, failed: results.failed });

    return {
      eventId,
      totalRegistrations: registrations.length,
      sent: results.sent,
      failed: results.failed,
      failedIds: results.failedIds
    };
  } catch (error) {
    logger.error('Error broadcasting to event registrations', { error: error.message });
    throw error instanceof AppError ? error : AppError.internal('Error broadcasting');
  }
}

export default {
  sendWhatsAppMessages,
  sendQRCodeToLeader,
  broadcastToLeaderRegistrations,
  broadcastToEventRegistrations
};
