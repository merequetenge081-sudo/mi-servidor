import logger from "../config/logger.js";

const NotificationService = {
  async sendEmail(to, subject, body) {
    try {
      logger.info(`[EMAIL] → to: ${to} | subject: ${subject} | body: ${body.substring(0, 50)}...`);
      return { success: true };
    } catch (error) {
      console.error(`[EMAIL ERROR] → ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  async sendWhatsApp(to, message) {
    try {
      logger.info(`[WHATSAPP] → to: ${to} | message: ${message.substring(0, 50)}...`);
      return { success: true };
    } catch (error) {
      console.error(`[WHATSAPP ERROR] → ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  async sendSMS(to, message) {
    try {
      logger.info(`[SMS] → to: ${to} | message: ${message.substring(0, 50)}...`);
      return { success: true };
    } catch (error) {
      console.error(`[SMS ERROR] → ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  async sendRegistrationNotification(registration) {
    try {
      const { firstName, lastName, email, phone } = registration;

      const results = {
        email: false,
        whatsapp: false,
        sms: false,
      };

      if (email) {
        const emailResult = await this.sendEmail(
          email,
          "Confirmación de Registro",
          `Hola ${firstName} ${lastName}, tu registro ha sido recibido.`
        );
        results.email = emailResult.success;
      }

      if (phone) {
        const whatsappResult = await this.sendWhatsApp(
          phone,
          `Hola ${firstName}, tu registro ha sido confirmado.`
        );
        results.whatsapp = whatsappResult.success;

        const smsResult = await this.sendSMS(
          phone,
          `Hola ${firstName}, gracias por registrarte.`
        );
        results.sms = smsResult.success;
      }

      return results;
    } catch (error) {
      console.error(`[NOTIFICATION ERROR] → ${error.message}`);
      return {
        email: false,
        whatsapp: false,
        sms: false,
        error: error.message,
      };
    }
  },
};

export async function sendNotifications(data = {}) {
  const { email, phone, firstName, type = "registration" } = data;

  try {
    const results = {
      email: false,
      whatsapp: false,
      sms: false,
    };

    if (email) {
      const emailResult = await NotificationService.sendEmail(
        email,
        `Confirmación de ${type === "registration" ? "Registro" : "Notificación"}`,
        `Hola ${firstName}, tu ${type === "registration" ? "registro ha sido recibido" : "notificación ha sido enviada"}.`
      );
      results.email = emailResult.success;
    }

    if (phone) {
      const whatsappResult = await NotificationService.sendWhatsApp(
        phone,
        `Hola ${firstName}, tu ${type === "registration" ? "registro ha sido confirmado" : "notificación ha sido enviada"}.`
      );
      results.whatsapp = whatsappResult.success;

      const smsResult = await NotificationService.sendSMS(
        phone,
        `Hola ${firstName}, gracias por ${type === "registration" ? "registrarte" : "tu participación"}.`
      );
      results.sms = smsResult.success;
    }

    return results;
  } catch (error) {
    console.error(`[NOTIFICATION ERROR] → ${error.message}`);
    return {
      email: false,
      whatsapp: false,
      sms: false,
      error: error.message,
    };
  }
}

export default sendNotifications;
