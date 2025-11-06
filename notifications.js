import dotenv from 'dotenv';
dotenv.config();

import { Resend } from 'resend';
import twilio from 'twilio';

// Inicializar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

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
  
  // 🔹 Enviar confirmación por Email con Resend
  static async sendEmailConfirmation(userData) {
    try {
      const { email, firstName, lastName, phone } = userData;
      
      console.log('\n📧 === ENVÍO CON RESEND ===');
      console.log('📧 Destinatario:', email);
      console.log('👤 Nombre:', `${firstName} ${lastName}`);
      
      if (!process.env.RESEND_API_KEY) {
        console.log('❌ Faltan RESEND_API_KEY');
        return { success: false, error: 'Resend no configurado' };
      }

      const result = await resend.emails.send({
        from: 'Sistema de Registro <onboarding@resend.dev>',
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
                <div style="background: #4361ee; color: white; padding: 12px 30px; border-radius: 5px; display: inline-block;">
                  Registro Confirmado
                </div>
              </div>
            </div>
            
            <div style="text-align: center; color: #666; font-size: 14px; margin-top: 20px;">
              <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            </div>
          </div>
        `
      });

      console.log('✅ === EMAIL ENVIADO CON RESEND ===');
      console.log('✅ Destinatario:', email);
      console.log('✅ Email ID:', result.data?.id);
      
      return { 
        success: true, 
        id: result.data?.id,
        provider: 'resend'
      };
      
    } catch (error) {
      console.error('❌ === ERROR CON RESEND ===');
      console.error('❌ Error:', error.message);
      
      return { 
        success: false, 
        error: error.message,
        provider: 'resend'
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

  // 🔹 Verificar configuración de Resend
  static async checkEmailService() {
    try {
      console.log('🔍 Verificando Resend...');
      console.log('🔑 RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Configurado' : '❌ Faltante');
      
      if (!process.env.RESEND_API_KEY) {
        return { 
          success: false, 
          error: 'Falta RESEND_API_KEY' 
        };
      }
      
      // Resend no tiene método verify, pero podemos probar con una operación simple
      return { 
        success: true, 
        message: 'Resend configurado correctamente',
        provider: 'resend'
      };
      
    } catch (error) {
      console.error('❌ Error con Resend:', error.message);
      return { 
        success: false, 
        error: error.message,
        provider: 'resend'
      };
    }
  }
}