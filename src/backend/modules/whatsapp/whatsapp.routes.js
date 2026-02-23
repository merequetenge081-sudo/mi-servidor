/**
 * WhatsApp Routes
 * Rutas para envío de mensajes WhatsApp
 */

import { Router } from 'express';
import {
  sendWhatsAppMessages,
  sendQRCode,
  broadcastToLeader,
  broadcastToEvent
} from './whatsapp.controller.js';

const router = Router();

/**
 * POST /api/v2/whatsapp/send-messages
 * Enviar mensajes a registraciones específicas
 */
router.post('/send-messages', sendWhatsAppMessages);

/**
 * POST /api/v2/whatsapp/send-qr/:leaderId
 * Enviar QR a un líder
 */
router.post('/send-qr/:leaderId', sendQRCode);

/**
 * POST /api/v2/whatsapp/broadcast/leader/:leaderId
 * Broadcast a líder
 */
router.post('/broadcast/leader/:leaderId', broadcastToLeader);

/**
 * POST /api/v2/whatsapp/broadcast/event/:eventId
 * Broadcast a evento
 */
router.post('/broadcast/event/:eventId', broadcastToEvent);

export default router;
