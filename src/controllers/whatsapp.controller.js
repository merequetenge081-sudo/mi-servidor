import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import whatsappService from "../backend/modules/whatsapp/whatsapp.service.js";

export async function sendWhatsApp(req, res) {
  try {
    const user = req.user;
    const { registrationIds, message = "", templateType = "custom" } = req.body;

    if (!registrationIds || !Array.isArray(registrationIds)) {
      return sendError(res, 400, "registrationIds debe ser un array");
    }

    const result = await whatsappService.sendWhatsAppMessages(registrationIds, message, templateType, user);

    return res.json({
      sent: result.sent,
      failed: result.failed,
      failedIds: result.failedIds.length > 0 ? result.failedIds : undefined,
      message: `${result.sent} mensajes enviados correctamente`
    });
  } catch (error) {
    logger.error("Send WhatsApp error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, "Error al enviar mensajes WhatsApp", "SEND_WHATSAPP_ERROR", error.message);
  }
}

export async function sendQRCode(req, res) {
  try {
    const user = req.user;
    const leaderId = req.params.leaderId || req.params.id;
    if (!leaderId) return sendError(res, 400, "leaderId es requerido");

    const result = await whatsappService.sendQRCodeToLeader(leaderId, user);

    return res.json({
      success: true,
      message: `Código QR enviado a ${result.email || result.phone || "destino configurado"}`,
      leaderId: result.leaderId_old,
      email: result.email || null
    });
  } catch (error) {
    logger.error("Send QR error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, "Error al enviar código QR", "SEND_QR_ERROR", error.message);
  }
}
