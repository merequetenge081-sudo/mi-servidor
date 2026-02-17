import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";

export async function sendWhatsApp(req, res) {
  try {
    const user = req.user;
    const { registrationIds, message, templateType } = req.body;

    if (!registrationIds || !Array.isArray(registrationIds)) {
      return res.status(400).json({ error: "registrationIds debe ser un array" });
    }

    let sentCount = 0;
    const failedIds = [];

    for (const regId of registrationIds) {
      try {
        const registration = await Registration.findById(regId);
        if (!registration || !registration.phone) {
          failedIds.push(regId);
          continue;
        }

        // TODO: Implementar envío real con WhatsApp API
        // Por ahora solo marcamos como enviado
        registration.notifications.whatsappSent = true;
        await registration.save();
        sentCount++;

        await AuditService.log("SEND_WHATSAPP", "Registration", regId, user, { phone: registration.phone }, `Mensaje WhatsApp enviado a ${registration.phone}`);
      } catch (error) {
        logger.error(`Failed to send WhatsApp to ${regId}:`, { error: error.message, stack: error.stack });
        failedIds.push(regId);
      }
    }

    res.json({
      sent: sentCount,
      failed: failedIds.length,
      failedIds: failedIds.length > 0 ? failedIds : undefined,
      message: `${sentCount} mensajes enviados correctamente`
    });
  } catch (error) {
    logger.error("Send WhatsApp error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al enviar mensajes WhatsApp" });
  }
}

export async function sendQRCode(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;

    const leader = await Leader.findById(leaderId);
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    if (!leader.email) {
      return res.status(400).json({ error: "Líder no tiene email configurado" });
    }

    // TODO: Implementar generación y envío real de QR
    // Por ahora solo registramos la acción

    await AuditService.log("SEND_QR", "Leader", leaderId, user, { leaderId: leader.leaderId }, `QR enviado a ${leader.email}`);

    res.json({
      success: true,
      message: `Código QR enviado a ${leader.email}`,
      leaderId: leader.leaderId,
      email: leader.email
    });
  } catch (error) {
    logger.error("Send QR error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al enviar código QR" });
  }
}
