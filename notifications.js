import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import twilio from 'twilio';

// Configuración de Email con opciones mejoradas
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  debug: true,
  logger: true,
  // Configuraciones adicionales para mejor confiabilidad
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5
});

// Verificar configuración de email al iniciar
console.log('📧 Configuración de Email:');
console.log('   EMAIL_USER:', process.env.EMAIL_USER ? '✅ Configurado' : '❌ Faltante');
console.log('   EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ Configurado' : '❌ Faltante');

// Configuración de SMS (Twilio) - Opcional
let smsClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    smsClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('📱 Cliente Twilio inicializado');
  } else {
    console.log('📱 SMS desactivado (credenciales no configuradas)');
  }
} catch (error) {
  console.log('⚠️ Error inicializando Twilio:', error.message);
}

export class NotificationService {
  
  // 🔹 Enviar confirmación por Email
  static async sendEmailConfirmation(userData) {
    try {
      const { email, firstName, lastName, phone } = userData;
      
      console.log('\n📧 === INICIANDO ENVÍO DE EMAIL ===');
      console.log('📧 Destinatario:', email);
      console.log('👤 Nombre:', `${firstName} ${lastName}`);
      
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('❌ Faltan variables de entorno para email');
        return { success: false, error: 'Email no configurado' };
      }

      // Verificar que el transporter esté listo
      console.log('🔄 Verificando conexión con servidor de email...');
      await emailTransporter.verify();
      console.log('✅ Conexión con servidor de email verificada');

      const mailOptions = {
        from: {
          name: 'Sistema de Registro',
          address: process.env.EMAIL_USER
        },
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
                <div style="background: #4361ee; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  Registro Confirmado
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
              <p>Este es un mensaje automático, por favor no responda a este correo.</p>
              <p>Si tienes alguna pregunta, contáctanos a: ${process.env.EMAIL_USER}</p>
            </div>
          </div>
        `,
        // Texto plano como fallback
        text: `Hola ${firstName} ${lastName}, tu registro ha sido confirmado exitosamente. Detalles: Nombre: ${firstName} ${lastName}, Email: ${email}, Teléfono: ${phone}, Fecha: ${new Date().toLocaleDateString('es-CO')}. Evento: Sábado 9 de Noviembre, 5:00 PM, Auditorio Central.`
      };

      console.log('🔄 Enviando email...');
      const result = await emailTransporter.sendMail(mailOptions);
      
      console.log('✅ === EMAIL ENVIADO EXITOSAMENTE ===');
      console.log('✅ Destinatario:', email);
      console.log('✅ Message ID:', result.messageId);
      console.log('✅ Response:', result.response);
      
      return { 
        success: true, 
        messageId: result.messageId,
        response: result.response 
      };
      
    } catch (error) {
      console.error('❌ === ERROR ENVIANDO EMAIL ===');
      console.error('❌ Error:', error.message);
      console.error('❌ Código:', error.code);
      console.error('❌ Comando:', error.command);
      
      // Mensajes de error más específicos
      let errorMessage = error.message;
      if (error.code === 'EAUTH') {
        errorMessage = 'Error de autenticación. Verifica usuario y contraseña.';
      } else if (error.code === 'EENVELOPE') {
        errorMessage = 'Error con el destinatario. Verifica el email.';
      } else if (error.code === 'ECONNECTION') {
        errorMessage = 'Error de conexión con el servidor de email.';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        details: {
          code: error.code,
          command: error.command
        }
      };
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
      
      console.log('📱 Enviando SMS a:', cleanPhone);
      
      const message = await smsClient.messages.create({
        body: `✅ Hola ${firstName}! Tu registro fue exitoso. Evento: Sábado 9 a las 5:00 PM - Auditorio Central.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleanPhone
      });

      console.log('✅ SMS enviado a:', cleanPhone);
      console.log('✅ SID:', message.sid);
      
      return { 
        success: true, 
        sid: message.sid,
        status: message.status
      };
      
    } catch (error) {
      console.error('❌ Error enviando SMS:', error);
      return { 
        success: false, 
        error: error.message,
        code: error.code
      };
    }
  }

  // 🔹 Enviar ambas notificaciones
  static async sendAllNotifications(userData) {
    console.log('\n🚀 === INICIANDO ENVÍO DE NOTIFICACIONES ===');
    console.log('👤 Usuario:', userData.email);
    
    const results = {
      email: await this.sendEmailConfirmation(userData),
      sms: await this.sendSMSConfirmation(userData)
    };
    
    console.log('📊 === RESULTADOS DE NOTIFICACIONES ===');
    console.log('📧 Email:', results.email.success ? '✅ Éxito' : '❌ Falló');
    console.log('📱 SMS:', results.sms.success ? '✅ Éxito' : '❌ Falló');
    
    return results;
  }

  // 🔹 Verificar configuración del servicio
  static async checkEmailService() {
    try {
      console.log('🔍 Verificando servicio de email...');
      await emailTransporter.verify();
      console.log('✅ Servicio de email funcionando correctamente');
      return { success: true, message: 'Servicio de email operativo' };
    } catch (error) {
      console.error('❌ Error en servicio de email:', error.message);
      return { success: false, error: error.message };
    }
  }
}