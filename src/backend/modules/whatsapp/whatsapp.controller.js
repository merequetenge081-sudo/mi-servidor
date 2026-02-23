/**
 * WhatsApp Controller
 * Endpoints HTTP para envío de mensajes WhatsApp
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import whatsappService from './whatsapp.service.js';

const logger = createLogger('WhatsAppController');

/**
 * POST /api/v2/whatsapp/send-messages
 * Envía mensajes WhatsApp a múltiples registraciones
 */
export async function sendWhatsAppMessages(req, res, next) {
  try {
    const { registrationIds, message, templateType = 'custom' } = req.body;
    const user = req.user;

    logger.info('Send WhatsApp messages requested', { count: registrationIds?.length });

    const results = await whatsappService.sendWhatsAppMessages(registrationIds, message, templateType, user);

    res.json({
      success: true,
      message: `${results.sent} messages sent successfully`,
      data: results
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/whatsapp/send-qr/:leaderId
 * Envía código QR a un líder
 */
export async function sendQRCode(req, res, next) {
  try {
    const { leaderId } = req.params;
    const user = req.user;

    logger.info('Send QR code requested', { leaderId });

    const result = await whatsappService.sendQRCodeToLeader(leaderId, user);

    res.json({
      success: true,
      message: 'QR code sent successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/whatsapp/broadcast/leader/:leaderId
 * Envía mensaje broadcast a todas las registraciones de un líder
 */
export async function broadcastToLeader(req, res, next) {
  try {
    const { leaderId } = req.params;
    const { message, eventId } = req.body;
    const user = req.user;

    logger.info('Broadcast to leader requested', { leaderId, eventId });

    const result = await whatsappService.broadcastToLeaderRegistrations(leaderId, message, eventId, user);

    res.json({
      success: true,
      message: 'Broadcast completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/whatsapp/broadcast/event/:eventId
 * Envía mensaje broadcast a todas las registraciones de un evento
 */
export async function broadcastToEvent(req, res, next) {
  try {
    const { eventId } = req.params;
    const { message } = req.body;
    const user = req.user;

    logger.info('Broadcast to event requested', { eventId });

    const result = await whatsappService.broadcastToEventRegistrations(eventId, message, user);

    res.json({
      success: true,
      message: 'Broadcast completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

export default {
  sendWhatsAppMessages,
  sendQRCode,
  broadcastToLeader,
  broadcastToEvent
};
