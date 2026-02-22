import { Resend } from 'resend';
import QRCode from 'qrcode';
import logger from '../config/logger.js';
import { decrypt } from '../utils/crypto.js';

class EmailService {
  constructor() {
    this.resend = null;
    this.mockMode = true;
    this.fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    this.init();
  }

  init() {
    const apiKey = process.env.RESEND_API_KEY;
    const forceMock = process.env.FORCE_EMAIL_MOCK === 'true';

    logger.info(`📧 EmailService Init - RESEND_API_KEY: ${apiKey ? 'Configurado' : 'NO configurado'}`);

    if (!apiKey || forceMock) {
      logger.warn('⚠️  Usando modo mock para emails (RESEND_API_KEY no configurada o forzado).');
      this.mockMode = true;
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.mockMode = false;
      logger.info(`✅ Resend API configurada correctamente`);
    } catch (error) {
      logger.error('❌ Error configurando Resend:', error.message);
      this.mockMode = true;
    }
  }

  async sendAccessEmail(leader, baseUrl = process.env.BASE_URL) {
    try {
      logger.info(`📧 sendAccessEmail() para: ${leader?.email}`);
      
      if (!leader || !leader.email) {
        throw new Error('Leader email no proporcionado');
      }

      if (!leader.token) {
        throw new Error('Leader token no disponible');
      }

      const registrationLink = `${baseUrl}/form.html?token=${leader.token}`;
      const qrDataUri = await QRCode.toDataURL(registrationLink, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
      });

      const htmlContent = this.generateEmailHTML(leader.name, registrationLink, qrDataUri);

      if (this.mockMode) {
        logger.info(`📧 [MOCK] Email a ${leader.email} - Tu enlace personalizado`);
        return { success: true, mock: true };
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: leader.email,
        subject: '🔗 Tu enlace personalizado de registro',
        html: htmlContent,
      });

      if (error) {
        logger.error(`❌ Error Resend: ${error.message}`);
        return { success: false, error: error.message };
      }

      logger.info(`✅ Email enviado a ${leader.email} (ID: ${data.id})`);
      return { success: true, messageId: data.id };
    } catch (error) {
      logger.error('❌ Error en sendAccessEmail:', error.message);
      throw new Error(`No se pudo enviar el email: ${error.message}`);
    }
  }

  generateEmailHTML(leaderName, registrationLink, qrDataUri) {
    const firstName = leaderName.split(' ')[0];
    
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tu enlace personalizado de registro</title>
    </head>
    <body style="font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; color: white;">
                <h1 style="margin: 0 0 10px 0; font-size: 28px;">🎯 ¡Bienvenido!</h1>
                <p style="margin: 0; font-size: 14px; opacity: 0.9;">Tu panel de registro está listo</p>
            </div>
            <div style="padding: 40px 30px;">
                <p style="font-size: 18px; color: #1a1a2e; margin-bottom: 24px;">Hola <span style="color: #667eea; font-weight: 600;">${firstName}</span>,</p>
                <p style="font-size: 15px; color: #6c757d; margin-bottom: 32px; line-height: 1.7;">Ya estás listo para comenzar a registrar personas en tu red. Usa el siguiente enlace o escanea el código QR.</p>
                <div style="text-align: center; margin-bottom: 40px;">
                    <a href="${registrationLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 600; font-size: 16px;">→ Ir al Formulario</a>
                </div>
                <div style="text-align: center; padding: 30px; background: #f8f9fa; border-radius: 12px; margin-bottom: 24px;">
                    <p style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px;">📱 Código QR</p>
                    <img src="${qrDataUri}" alt="Código QR" style="max-width: 200px; height: auto; border-radius: 8px;">
                </div>
            </div>
            <div style="background: #f8f9fa; padding: 24px 30px; text-align: center; font-size: 12px; color: #6c757d;">
                <p style="margin: 0;">© 2026 Red Social y Política</p>
            </div>
        </div>
    </body>
    </html>`;
  }

  async sendWelcomeEmail(leader, baseUrl) {
    if (!leader?.email) throw new Error('Email no proporcionado');
    
    const firstName = leader.name?.split(' ')[0] || 'Líder';
    const loginUrl = `${baseUrl}/`;
    
    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">👋 ¡Bienvenido!</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #666; margin: 0 0 30px 0;">Bienvenido al sistema de Red Social y Política. Ya puedes acceder a tu panel de gestión.</p>
          <div style="text-align: center;">
            <a href="${loginUrl}" style="background: #667eea; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Ingresar al Panel</a>
          </div>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          © 2026 Red Social y Política
        </div>
      </div>
    </body></html>`;

    return this._sendEmail(leader.email, '👋 ¡Bienvenido al Sistema!', html);
  }

  async sendCredentialsEmail(leader) {
    logger.info(`🔑 sendCredentialsEmail para: ${leader?.email}`);
    
    if (!leader?.email) throw new Error('Email no proporcionado');
    
    const firstName = leader.name?.split(' ')[0] || 'Líder';
    const username = leader.username || 'No configurado';
    
    let tempPassword = 'No disponible';
    if (leader.tempPasswordPlaintext) {
      try {
        tempPassword = decrypt(leader.tempPasswordPlaintext);
        logger.info(`🔑 Contraseña desencriptada correctamente`);
      } catch (e) {
        logger.warn(`🔑 Error desencriptando: ${e.message}`);
        tempPassword = leader.tempPasswordPlaintext;
      }
    } else {
      logger.warn(`🔑 El líder no tiene tempPasswordPlaintext`);
    }
    
    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">🔑 Tus Credenciales</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #666; margin: 0 0 20px 0;">Aquí están tus credenciales de acceso:</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
            <p style="margin: 10px 0;"><strong>Usuario:</strong> <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${username}</code></p>
            <p style="margin: 10px 0;"><strong>Contraseña temporal:</strong> <code style="background: #fff3cd; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>
          </div>
          <p style="color: #dc3545; font-size: 14px; margin: 0;">⚠️ Cambia tu contraseña después de iniciar sesión.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          © 2026 Red Social y Política
        </div>
      </div>
    </body></html>`;

    return this._sendEmail(leader.email, '🔑 Tus Credenciales de Acceso', html);
  }

  async sendQRCodeEmail(leader, baseUrl) {
    if (!leader?.email) throw new Error('Email no proporcionado');
    if (!leader?.token) throw new Error('Token no disponible');
    
    const firstName = leader.name?.split(' ')[0] || 'Líder';
    const registrationLink = `${baseUrl}/form.html?token=${leader.token}`;
    
    logger.info(`📱 Generando QR para ${leader.email}: ${registrationLink}`);
    
    const qrBuffer = await QRCode.toBuffer(registrationLink, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 250
    });
    
    logger.info(`📱 QR generado: ${qrBuffer.length} bytes`);
    
    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">📱 Tu Enlace de Registro</h1>
        </div>
        <div style="padding: 30px; text-align: center;">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #666; margin: 0 0 30px 0;">Tienes 3 formas de acceder al formulario de registro:</p>
          
          <p style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 0 0 15px 0;">1. Botón directo</p>
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${registrationLink}" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">→ Ir al Formulario</a>
          </div>
          
          <p style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 0 0 15px 0;">2. Copia el enlace</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 30px;">
            <p style="word-break: break-all; color: #667eea; font-size: 12px; margin: 0; font-family: monospace;">${registrationLink}</p>
          </div>
          
          <p style="font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 0 0 15px 0;">3. Escanea el código QR adjunto</p>
          <p style="font-size: 13px; color: #999; margin: 0;">El código QR está adjunto a este correo como imagen.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          © 2026 Red Social y Política
        </div>
      </div>
    </body></html>`;

    return this._sendEmailWithAttachment(leader.email, '📱 Tu Enlace de Registro', html, [
      { filename: 'qrcode.png', content: qrBuffer, cid: 'qrcode' }
    ]);
  }

  async sendWarningEmail(leader) {
    if (!leader?.email) throw new Error('Email no proporcionado');
    
    const firstName = leader.name?.split(' ')[0] || 'Líder';
    
    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
        <div style="background: #f59e0b; padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">⚠️ Recordatorio</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #666; margin: 0;">Te recordamos que es importante mantener tus registros actualizados.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          © 2026 Red Social y Política
        </div>
      </div>
    </body></html>`;

    return this._sendEmail(leader.email, '⚠️ Recordatorio Importante', html);
  }

  async sendTemporaryPasswordEmail(leader, tempPassword) {
    if (!leader?.email) throw new Error('Email no proporcionado');
    
    const firstName = leader.name?.split(' ')[0] || 'Líder';
    const username = leader.username || leader.email;
    
    const html = `
    <!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0;">🔐 Nueva Contraseña</h1>
        </div>
        <div style="padding: 30px;">
          <p style="font-size: 16px; color: #333; margin: 0 0 20px 0;">Hola <strong>${firstName}</strong>,</p>
          <p style="color: #666; margin: 0 0 20px 0;">Se ha generado una nueva contraseña temporal para tu cuenta.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 0 0 20px 0;">
            <p style="margin: 10px 0;"><strong>Usuario:</strong> <code style="background: #e9ecef; padding: 4px 8px; border-radius: 4px;">${username}</code></p>
            <p style="margin: 10px 0;"><strong>Contraseña temporal:</strong> <code style="background: #fff3cd; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${tempPassword}</code></p>
          </div>
          <p style="color: #dc3545; font-size: 14px; margin: 0;">⚠️ Esta contraseña es temporal. Te recomendamos cambiarla después de iniciar sesión.</p>
        </div>
        <div style="background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #999;">
          © 2026 Red Social y Política
        </div>
      </div>
    </body></html>`;

    return this._sendEmail(leader.email, '🔐 Tu Nueva Contraseña Temporal', html);
  }

  async _sendEmail(to, subject, html) {
    if (this.mockMode) {
      logger.info(`📧 [MOCK] Email a ${to} - ${subject}`);
      return { success: true, mock: true };
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error(`❌ Error Resend enviando a ${to}: ${error.message}`);
        return { success: false, error: error.message };
      }

      logger.info(`✅ Email enviado a ${to} - ${subject} (ID: ${data.id})`);
      return { success: true, messageId: data.id };
    } catch (error) {
      logger.error(`❌ Excepción enviando email a ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async _sendEmailWithAttachment(to, subject, html, attachments) {
    if (this.mockMode) {
      logger.info(`📧 [MOCK] Email con attachment a ${to} - ${subject}`);
      return { success: true, mock: true };
    }

    try {
      const resendAttachments = attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        content_type: 'image/png',
        disposition: 'inline',
        cid: att.cid
      }));

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        attachments: resendAttachments,
      });

      if (error) {
        logger.error(`❌ Error Resend enviando a ${to}: ${error.message}`);
        return { success: false, error: error.message };
      }

      logger.info(`✅ Email con attachment enviado a ${to} - ${subject} (ID: ${data.id})`);
      return { success: true, messageId: data.id };
    } catch (error) {
      logger.error(`❌ Excepción enviando email a ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

export const emailService = new EmailService();
