import dotenv from "dotenv";
import nodemailer from "nodemailer";
import twilio from "twilio";

dotenv.config();

// Configuración del correo SMTP de Hostinger
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 587,
  secure: false, // TLS (más compatible con Render/Railway)
  auth: {
    user: process.env.EMAIL_USER, // guardianes@fulars.com
    pass: process.env.EMAIL_PASS, // tu contraseña
  },
  tls: {
    rejectUnauthorized: false, // evita error de certificado en Render/Railway
  },
});

// Configuración de Twilio (opcional)
let smsClient = null;
try {
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID !== "tu_account_sid" &&
    process.env.TWILIO_AUTH_TOKEN !== "tu_auth_token"
  ) {
    smsClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log("📱 Cliente Twilio inicializado");
  } else {
    console.log("📱 SMS desactivado (credenciales Twilio no configuradas)");
  }
} catch (error) {
  console.log("⚠️ Error inicializando Twilio:", error.message);
}

export class NotificationService {
  // 🔹 Enviar confirmación por correo con Nodemailer
  static async sendEmailConfirmation(userData) {
    const { email, firstName, lastName, phone } = userData;

    console.log("\n📧 === ENVÍO DE CORREO ===");
    console.log("📧 Destinatario:", email);

    try {
      const info = await transporter.sendMail({
        from: `"Fundación FULARS" <guardianes@fulars.com>`,
        to: email,
        subject: "✅ Confirmación de Registro Exitosa - Fundación FULARS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #004aad; text-align: center;">¡Registro Completado!</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: #333;">Hola ${firstName} ${lastName || ""},</h3>
              <p>Tu registro ha sido confirmado exitosamente. Aquí están los detalles:</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Nombre:</strong> ${firstName} ${lastName || ""}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Teléfono:</strong> ${phone}</p>
                <p><strong>Fecha de registro:</strong> ${new Date().toLocaleDateString("es-CO")}</p>
              </div>
              
              <p><strong>📅 Fecha del evento:</strong> Sábado 9 de Noviembre</p>
              <p><strong>⏰ Hora:</strong> 5:00 PM</p>
              <p><strong>📍 Lugar:</strong> Auditorio Central</p>
              
              <div style="text-align: center; margin: 25px 0;">
                <div style="background: #004aad; color: white; padding: 12px 30px; border-radius: 5px; display: inline-block;">
                  Registro Confirmado
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
              <p>Este es un mensaje automático, por favor no respondas a este correo.</p>
            </div>
          </div>
        `,
      });

      console.log("✅ Correo enviado:", info.messageId);
      return { success: true, id: info.messageId, provider: "hostinger" };
    } catch (error) {
      console.error("❌ Error al enviar correo:", error.message);
      return { success: false, error: error.message, provider: "hostinger" };
    }
  }

  // 🔹 Enviar SMS de confirmación (opcional)
  static async sendSMSConfirmation(userData) {
    if (!smsClient) {
      console.log("📱 SMS desactivado (Twilio no configurado)");
      return { success: false, error: "SMS no configurado" };
    }

    try {
      const { phone, firstName } = userData;
      const cleanPhone = String(phone).replace(/[^0-9+]/g, "");

      const message = await smsClient.messages.create({
        body: `✅ Hola ${firstName}! Tu registro fue exitoso. Evento: Sábado 9 a las 5:00 PM - Auditorio Central.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleanPhone,
      });

      console.log("✅ SMS enviado:", message.sid);
      return { success: true, sid: message.sid, status: message.status };
    } catch (error) {
      console.error("❌ Error enviando SMS:", error.message);
      return { success: false, error: error.message };
    }
  }

  // 🔹 Enviar ambas notificaciones
  static async sendAllNotifications(userData) {
    console.log("\n🚀 === INICIANDO ENVÍO DE NOTIFICACIONES ===");
    const emailResult = await this.sendEmailConfirmation(userData);
    const smsResult = await this.sendSMSConfirmation(userData);

    console.log(" Email:", emailResult.success ? "✅ Enviado" : "❌ Falló");
    console.log("📱 SMS:", smsResult.success ? "✅ Enviado" : "❌ Falló");

    return { email: emailResult, sms: smsResult };
  }
}