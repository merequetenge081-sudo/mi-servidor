import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Configuración de Email
const emailTransporter = nodemailer.createTransport({
  service: 'gmail', // o tu proveedor: outlook, yahoo, etc.
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Configuración de SMS (Twilio) - Opcional
const smsClient = process.env.TWILIO_ACCOUNT_SID ?
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

export class NotificationService {
  
  // 🔹 Enviar confirmación por Email
  static async sendEmailConfirmation(userData) {
    try {
      const { email, firstName, lastName, phone } = userData;
      
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: '✅ Confirmación de Registro Exitosa',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4361ee; text-align: center;">¡Registro Completado!</h2>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: #333;">Hola ${firstName} ${lastName},</h3>
              <p>Tu registro ha sido confirmado exitosamente. Aquí están los detalles:</p>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p><strong>Nombre:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Teléfono:</strong> ${phone}</p>
                <p><strong>Fecha de registro:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
              </div>
              
              <p><strong>📅 Fecha del evento:</strong> Sábado 9 de Noviembre</p>
              <p><strong>⏰ Hora:</strong> 5:00 PM</p>
              <p><strong>📍 Lugar:</strong> Auditorio Central</p>
              
              <div style="text-align: center; margin: 25px 0;">
                <a href="#" style="background: #4361ee; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Ver Detalles del Evento
                </a>
              </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 14px;">
              <p>Si tienes alguna pregunta, contáctanos a: ${process.env.EMAIL_USER}</p>
            </div>
          </div>
        `
      };

      const result = await emailTransporter.sendMail(mailOptions);
      console.log('✅ Email enviado a:', email);
      return { success: true, messageId: result.messageId };
      
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return { success: false, error: error.message };
    }
  }

  // 🔹 Enviar SMS de confirmación (Opcional)
  static async sendSMSConfirmation(userData) {
    if (!smsClient) {
      console.log('📱 SMS desactivado (Twilio no configurado)');
      return { success: false, error: 'SMS no configurado' };
    }

    try {
      const { phone, firstName } = userData;
      
      // Limpiar número (remover espacios, guiones, etc.)
      const cleanPhone = String(phone).replace(/[^0-9+]/g, '');
      
      const message = await smsClient.messages.create({
        body: `✅ Hola ${firstName}! Tu registro fue exitoso. Evento: Sábado 9 a las 5:00 PM - Auditorio Central.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleanPhone
      });

      console.log('✅ SMS enviado a:', cleanPhone);
      return { success: true, sid: message.sid };
      
    } catch (error) {
      console.error('❌ Error enviando SMS:', error);
      return { success: false, error: error.message };
    }
  }

  // 🔹 Enviar ambas notificaciones
  static async sendAllNotifications(userData) {
    const results = {
      email: await this.sendEmailConfirmation(userData),
      sms: await this.sendSMSConfirmation(userData)
    };
    
    return results;
  }
}
