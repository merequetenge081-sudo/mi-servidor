import { Resend } from 'resend';
import QRCode from 'qrcode';
import logger from '../config/logger.js';

class EmailService {
  constructor() {
    this.resend = null;
    this.initResend();
  }

  initResend() {
    // Log de variables de entorno para debugging
    logger.info(`📧 EmailService Init - NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`📧 RESEND_API_KEY configurado: ${process.env.RESEND_API_KEY ? 'Si' : 'No'}`);

    // Permitir intento de envío real si se define RESEND_API_KEY
    const hasResendKey = process.env.RESEND_API_KEY;
    const forceMock = process.env.FORCE_EMAIL_MOCK === 'true';

    if (!hasResendKey || forceMock) {
      logger.warn('⚠️  Usando modo mock para emails (RESEND_API_KEY no configurado o forzado).');
      this.mockMode = true;
      return;
    }

    try {
      logger.info(`📧 Inicializando Resend API`);
      this.resend = new Resend(process.env.RESEND_API_KEY);
      this.mockMode = false;
      logger.info(`✅ Resend API configurado correctamente`);
    } catch (error) {
      logger.error('❌ Error configurando EmailService:', error.message);
      logger.error('Stack:', error.stack);
      this.mockMode = true;
    }
  }

  /**
   * Envía email con el enlace personalizado y QR al líder
   * @param {Object} leader - Objeto líder con _id, name, email, token
   * @param {string} baseUrl - URL base (ej: https://midominio.com)
   * @returns {Promise<Object>} { success: true, messageId?: string }
   */
  async sendAccessEmail(leader, baseUrl = process.env.BASE_URL) {
    try {
      logger.info(`📧 sendAccessEmail() llamada para: ${leader?.email || 'SIN EMAIL'}`);
      logger.info(`📧 Mock mode: ${this.mockMode}`);
      
      if (!leader || !leader.email) {
        throw new Error('Leader email no proporcionado');
      }

      if (!leader.token) {
        throw new Error('Leader token no disponible');
      }

      if (!baseUrl) {
        throw new Error('BASE_URL no configurado en variables de entorno');
      }

      const registrationLink = `${baseUrl}/form.html?token=${leader.token}`;
      
      logger.info(`📧 Generando QR para enlace: ${registrationLink}`);

      // Generar QR como data URI (para incrustar en el email)
      const qrDataUri = await QRCode.toDataURL(registrationLink, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
      });

      const htmlContent = this.generateEmailHTML(leader.name, registrationLink, qrDataUri);

      // Si está en mock mode, no enviar con Resend
      if (this.mockMode) {
        logger.info(`
╔════════════════════════════════════════════════════╗
║           📧 MOCK EMAIL - MODO DESARROLLO          ║
╚════════════════════════════════════════════════════╝
To: ${leader.email}
Subject: 🔗 Tu enlace personalizado de registro
────────────────────────────────────────────────────
${leader.name}, tu enlace de registro es:
${registrationLink}
        `);
        return { success: true, mock: true };
      }

      // Enviar correo con Resend
      logger.info(`📧 Enviando correo a ${leader.email} con Resend...`);
      
      try {
        const data = await this.resend.emails.send({
          from: 'Red Social Política <redsp@fulars.com>',
          to: leader.email,
          subject: '🔗 Tu enlace personalizado de registro',
          html: htmlContent
        });

        logger.info(`✅ Email enviado exitosamente a ${leader.email} (Message ID: ${data.id})`);
        return { success: true, messageId: data.id, mock: false };
      } catch (resendError) {
        logger.error('❌ Error al enviar con Resend:', resendError.message);
        logger.error('Detalle:', resendError);
        console.error('Error Resend:', resendError);
        
        // Fallback a mock mode
        logger.warn(`📧 Fallback a MOCK: ${resendError?.message}`);
        return { success: false, mock: true, fallback: true, error: resendError?.message };
      }
    } catch (error) {
      logger.error('❌ Error procesando email:', {
        message: error.message,
        stack: error.stack,
        leaderEmail: leader?.email,
      });
      throw new Error(`No se pudo enviar el email: ${error.message}`);
    }
  }

  /**
   * Envía email de bienvenida al líder
   */
  async sendWelcomeEmail(leader, baseUrl = process.env.BASE_URL) {
    try {
      const email = leader?.email;
      if (!email) throw new Error('Leader email no proporcionado');

      const subject = '🎉 Bienvenido al Sistema';
      const loginUrl = `${baseUrl || 'http://localhost:5000'}/login.html`;
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido</title>
        <style>
          body { font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; background: #f5f7fb; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
          .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
          .subtitle { color: #6c757d; margin-bottom: 12px; }
          .body { color: #4a4a68; line-height: 1.6; }
          .cta { margin-top: 18px; display: inline-block; background: #667eea; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600; }
          .footer { margin-top: 18px; font-size: 12px; color: #6c757d; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Hola ${leader?.name || 'lider'},</div>
          <div class="subtitle">Red Social Política</div>
          <div class="body">
            <p>Te damos la bienvenida al sistema de gestión de registros. Aquí podrás administrar tu red, consultar estadísticas y compartir tu enlace de registro.</p>
            <p>Cuando inicies sesión, podrás actualizar tus datos y revisar el estado de los registros.</p>
          </div>
          <a href="${loginUrl}" class="cta">Ir al login</a>
          <div class="footer">Si no solicitaste esta cuenta, contacta al administrador.</div>
        </div>
      </body>
      </html>
      `;

      return await this.sendEmailWithResend(email, subject, htmlContent, 'WELCOME_EMAIL');
    } catch (error) {
      logger.error('❌ Error enviando welcome email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía email con credenciales de acceso temporal
   */
  async sendCredentialsEmail(leader, plainPassword = null) {
    try {
      const email = leader?.email;
      if (!email) throw new Error('Leader email no proporcionado');
      
      // Si no se proporciona password, usar tempPasswordPlaintext del líder
      const password = plainPassword || leader.tempPasswordPlaintext;
      if (!password) throw new Error('Password temporal no proporcionado');

      const subject = '🔑 Tus credenciales de acceso';
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const loginUrl = `${baseUrl}/leader.html`;
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Credenciales de acceso</title>
        <style>
          body { font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; background: #f5f7fb; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
          .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
          .badge { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; }
          .credential { font-family: 'Courier New', monospace; font-size: 16px; background: #f8f9fa; border-radius: 8px; padding: 10px 12px; display: inline-block; margin: 6px 0 14px; }
          .warning { background: #fff3cd; color: #7a5a00; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
          .cta { margin-top: 18px; display: inline-block; background: #667eea; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">Acceso</div>
          <div class="title">Credenciales de acceso</div>
          <p>Estas credenciales son temporales para tu primer ingreso.</p>
          <p><strong>Usuario:</strong></p>
          <div class="credential">${leader.username || email}</div>
          <p><strong>Contraseña temporal:</strong></p>
          <div class="credential">${password}</div>
          <div class="warning">Recomendamos cambiar la contraseña después de iniciar sesión.</div>
          <a href="${loginUrl}" class="cta">Iniciar sesión</a>
        </div>
      </body>
      </html>
      `;

      return await this.sendEmailWithResend(email, subject, htmlContent, 'CREDENTIALS_EMAIL');
    } catch (error) {
      logger.error('❌ Error enviando credenciales:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía email solo con código QR
   */
  async sendQRCodeEmail(leader, baseUrl = process.env.BASE_URL) {
    try {
      if (!leader || !leader.email) throw new Error('Leader email no proporcionado');
      if (!leader.token) throw new Error('Leader token no disponible');
      if (!baseUrl) throw new Error('BASE_URL no configurado');

      const registrationLink = `${baseUrl}/form.html?token=${leader.token}`;
      const qrDataUri = await QRCode.toDataURL(registrationLink, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
      });

      const htmlContent = this.generateEmailHTML(leader.name, registrationLink, qrDataUri);
      const subject = '📲 Tu código QR de registro';

      return await this.sendEmailWithResend(leader.email, subject, htmlContent, 'QR_EMAIL');
    } catch (error) {
      logger.error('❌ Error enviando QR email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía email de aviso/recordatorio al líder
   */
  async sendWarningEmail(leader) {
    try {
      const email = leader?.email;
      if (!email) throw new Error('Leader email no proporcionado');

      const subject = '⚠️ Aviso Importante';
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const dashboardUrl = `${baseUrl}/leader-dashboard.html`;
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Aviso Importante</title>
        <style>
          body { font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; background: #f5f7fb; padding: 20px; }
          .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); border-top: 4px solid #ff9800; }
          .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
          .badge { display: inline-block; background: #fff3cd; color: #7a5a00; padding: 8px 16px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          .body { color: #4a4a68; line-height: 1.6; margin-bottom: 20px; }
          .cta { margin-top: 18px; display: inline-block; background: #ff9800; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 10px; font-weight: 600; }
          .footer { margin-top: 18px; font-size: 12px; color: #6c757d; border-top: 1px solid #e9ecef; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">⚠️ Recordatorio</div>
          <div class="title">Hola ${leader?.name || 'líder'},</div>
          <div class="body">
            <p>Te recordamos que es importante mantener actualizada tu información y revisar regularmente tu panel de registros.</p>
            <p>Si tienes alguna duda o necesitas asistencia, no dudes en contactar al administrador del sistema.</p>
          </div>
          <a href="${dashboardUrl}" class="cta">Ir al Panel</a>
          <div class="footer">Este es un mensaje automático del sistema de gestión.</div>
        </div>
      </body>
      </html>
      `;

      return await this.sendEmailWithResend(email, subject, htmlContent, 'WARNING_EMAIL');
    } catch (error) {
      logger.error('❌ Error enviando warning email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envía email con contraseña temporal para restablecimiento
   */
  async sendTemporaryPasswordEmail(user, tempPassword) {
    try {
      const email = user?.email;
      const displayName = user?.name || user?.username || 'Usuario';

      if (!email) {
        throw new Error('Email no proporcionado');
      }

      const subject = '🔐 Restablecimiento de contraseña';
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecimiento de contraseña</title>
        <style>
          body { font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; background: #f5f7fb; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08); }
          .title { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 16px; }
          .badge { display: inline-block; background: #e3f2fd; color: #1976d2; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
          .password { font-family: 'Courier New', monospace; font-size: 18px; font-weight: 700; letter-spacing: 1px; background: #f8f9fa; border-radius: 8px; padding: 12px 16px; display: inline-block; margin: 12px 0 20px; }
          .warning { background: #fff3cd; color: #7a5a00; padding: 12px 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Seguridad</div>
          <div class="title">Hola ${displayName},</div>
          <p>Se ha generado una contraseña temporal para tu cuenta.</p>
          <div class="password">${tempPassword}</div>
          <div class="warning">
            Por seguridad, inicia sesión con esta contraseña y cámbiala inmediatamente.
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #6c757d;">Si no solicitaste este cambio, contacta al administrador.</p>
        </div>
      </body>
      </html>
      `;

      return await this.sendEmailWithResend(email, subject, htmlContent, 'TEMP_PASSWORD');
    } catch (error) {
      logger.error('❌ Error enviando temporary password email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Método helper para enviar emails con Resend o mock
   */
  async sendEmailWithResend(to, subject, html, mockLabel) {
    if (this.mockMode) {
      logger.info(`
╔════════════════════════════════════════════════════╗
║           📧 MOCK EMAIL - ${mockLabel.padEnd(19)}║
╚════════════════════════════════════════════════════╝
To: ${to}
Subject: ${subject}
────────────────────────────────────────────────────
      `);
      return { success: true, mock: true };
    }

    try {
      const data = await this.resend.emails.send({
        from: 'Red Social Política <redsp@fulars.com>',
        to,
        subject,
        html
      });

      logger.info(`✅ Email enviado exitosamente a ${to} (Message ID: ${data?.id})`);
      return { success: true, messageId: data?.id };
    } catch (error) {
      logger.error('❌ Error al enviar con Resend:', error?.message || error);
      console.error('Resend error:', error);
      return { success: false, error: error?.message || String(error) };
    }
  }

  /**
   * Genera HTML profesional para el email
   */
  generateEmailHTML(leaderName, registrationLink, qrDataUri) {
    const firstName = leaderName.split(' ')[0];
    
    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tu enlace personalizado de registro</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .email-container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                max-width: 600px;
                width: 100%;
                overflow: hidden;
            }
            .email-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 40px 30px;
                text-align: center;
                color: white;
            }
            .email-header h1 {
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 10px;
                letter-spacing: -0.5px;
            }
            .email-header p {
                font-size: 14px;
                opacity: 0.9;
                font-weight: 500;
            }
            .email-body {
                padding: 40px 30px;
            }
            .greeting {
                font-size: 18px;
                font-weight: 600;
                color: #1a1a2e;
                margin-bottom: 24px;
                line-height: 1.6;
            }
            .greeting span {
                color: #667eea;
                font-weight: 700;
            }
            .description {
                font-size: 15px;
                color: #6c757d;
                margin-bottom: 32px;
                line-height: 1.7;
            }
            .cta-section {
                text-align: center;
                margin-bottom: 40px;
            }
            .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                text-decoration: none;
                padding: 16px 36px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
            }
            .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
            }
            .divider {
                height: 1px;
                background: #e9ecef;
                margin: 32px 0;
            }
            .qr-section {
                text-align: center;
                padding: 30px;
                background: #f8f9fa;
                border-radius: 12px;
                margin-bottom: 24px;
            }
            .qr-label {
                font-size: 14px;
                font-weight: 600;
                color: #1a1a2e;
                margin-bottom: 16px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .qr-image {
                max-width: 200px;
                height: auto;
                border-radius: 8px;
            }
            .link-section {
                background: #f5f7fb;
                padding: 16px;
                border-radius: 8px;
                margin-top: 16px;
            }
            .link-label {
                font-size: 12px;
                color: #6c757d;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }
            .link-text {
                font-size: 13px;
                color: #667eea;
                word-break: break-all;
                font-family: 'Courier New', monospace;
            }
            .footer {
                background: #f8f9fa;
                padding: 24px 30px;
                border-top: 1px solid #e9ecef;
                font-size: 12px;
                color: #6c757d;
                text-align: center;
                line-height: 1.8;
            }
            .footer a {
                color: #667eea;
                text-decoration: none;
                font-weight: 600;
            }
            .support-badge {
                display: inline-block;
                background: #e3f2fd;
                color: #1976d2;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                margin-top: 12px;
            }
            @media (max-width: 600px) {
                .email-body {
                    padding: 24px 20px;
                }
                .email-header {
                    padding: 30px 20px;
                }
                .email-header h1 {
                    font-size: 24px;
                }
                .footer {
                    padding: 20px 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <!-- Header -->
            <div class="email-header">
                <h1>🎯 ¡Bienvenido!</h1>
                <p>Tu panel de registro está listo</p>
            </div>

            <!-- Body -->
            <div class="email-body">
                <div class="greeting">
                    Hola <span>${firstName}</span>,
                </div>

                <div class="description">
                    Ya estás listo para comenzar a registrar personas en tu red. Usa el siguiente enlace o escanea el código QR para acceder al formulario de registro personalizado.
                </div>

                <!-- CTA Button -->
                <div class="cta-section">
                    <a href="${registrationLink}" class="cta-button">
                        → Ir al Formulario
                    </a>
                </div>

                <!-- Divider -->
                <div class="divider"></div>

                <!-- QR Code Section -->
                <div class="qr-section">
                    <div class="qr-label">📱 Código QR</div>
                    <img src="${qrDataUri}" alt="Código QR de registro" class="qr-image">
                    <div class="link-section">
                        <div class="link-label">O copia este enlace:</div>
                        <div class="link-text">${registrationLink}</div>
                    </div>
                </div>

                <div class="description" style="margin-top: 32px; margin-bottom: 0;">
                    <strong>💡 Consejos:</strong>
                    <ul style="margin: 12px 0 0 20px; line-height: 1.8;">
                        <li>Comparte el enlace con tu equipo directamente</li>
                        <li>Imprime el código QR para distribuirlo</li>
                        <li>Monitorea los registros en tu panel</li>
                    </ul>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>Si tienes dudas o necesitas soporte, <a href="mailto:soporte@servidor.com">contacta al equipo</a>.</p>
                <div class="support-badge">
                    ✓ Email enviado de forma segura
                </div>
                <p style="margin-top: 16px; opacity: 0.7;">
                    © 2026 Sistema de Registros. Todos los derechos reservados.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }
}

// Exportar instancia singleton
export const emailService = new EmailService();
