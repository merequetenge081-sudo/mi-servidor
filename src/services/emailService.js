import { Resend } from 'resend';
import QRCode from 'qrcode';
import crypto from 'crypto';
import logger from '../config/logger.js';
import { config } from '../config/env.js';

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

    getBaseUrl(baseUrl) {
        return baseUrl || process.env.BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
    }

    decryptTempPassword(value) {
        if (!value || typeof value !== 'string') return value;
        if (!value.includes(':')) return value;

        try {
            const algorithm = 'aes-256-cbc';
            const key = crypto.scryptSync(config.jwtSecret || 'fallback-key', 'salt', 32);
            const parts = value.split(':');
            if (parts.length !== 2) return value;
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const decipher = crypto.createDecipheriv(algorithm, key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        } catch (error) {
            logger.warn('No se pudo desencriptar tempPasswordPlaintext:', error.message);
            return value;
        }
    }

    wrapEmail({
      title,
      subtitle,
      bodyHtml,
      ctaLabel,
      ctaUrl,
      accent = '#1e3a8a',
      footerNote = 'Este es un mensaje automatico. No respondas a este correo.'
    }) {
      const safeTitle = title || 'Actualizacion del sistema';
      const safeSubtitle = subtitle || 'Red Social y Politica';
      const buttonHtml = ctaLabel && ctaUrl ? `
        <table cellpadding="0" cellspacing="0" style="margin-top: 26px;">
          <tr>
            <td style="background: ${accent}; border-radius: 8px; padding: 0;">
              <a href="${ctaUrl}" style="display: inline-block; padding: 14px 34px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.2px;">${ctaLabel}</a>
            </td>
          </tr>
        </table>
      ` : '';

      return `<!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
  </head>
  <body style="margin: 0; padding: 0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fb;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fb;">
      <tr>
        <td align="center" style="padding: 36px 18px;">
          <table width="100%" maxwidth="640" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);">
            <tr>
              <td style="padding: 18px 36px; border-bottom: 1px solid #e2e8f0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; font-weight: 700;">Red Social y Politica</td>
                    <td align="right" style="font-size: 12px; color: #94a3b8;">Actualizacion segura</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding: 34px 36px 10px;">
                <h1 style="margin: 0 0 8px 0; font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;">${safeTitle}</h1>
                <p style="margin: 0; font-size: 14px; color: #64748b; line-height: 1.7;">${safeSubtitle}</p>
              </td>
            </tr>
            <tr>
              <td style="padding: 18px 36px 36px; color: #334155; font-size: 14px; line-height: 1.8;">
                ${bodyHtml}
                ${buttonHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color: #f8fafc; padding: 22px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
                <p style="margin: 0 0 6px 0;">${footerNote}</p>
                <p style="margin: 0; font-size: 11px; color: #94a3b8;">© 2026 Red Social y Politica</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
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

            const resolvedBaseUrl = this.getBaseUrl(baseUrl);
            const registrationLink = `${resolvedBaseUrl}/form.html?token=${leader.token}`;
      
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
      if (!leader.token) throw new Error('Leader token no disponible');

      const subject = 'Bienvenido a Red Social y Politica';
      const resolvedBaseUrl = this.getBaseUrl(baseUrl);
      const registrationLink = `${resolvedBaseUrl}/form.html?token=${leader.token}`;
      const firstName = (leader?.name || 'lider').split(' ')[0];
      const year = new Date().getFullYear();

      const qrDataUri = await QRCode.toDataURL(registrationLink, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 260
      });

      const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Red Social y Politica</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;box-shadow:0 12px 30px rgba(15,23,42,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#4F46E5;background-image:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);padding:36px 28px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:16px;">
                    <div style="width:56px;height:56px;border-radius:16px;background:rgba(255,255,255,0.18);display:inline-flex;align-items:center;justify-content:center;font-size:22px;color:#ffffff;">R</div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <span style="display:inline-block;background:rgba(255,255,255,0.2);color:#ffffff;font-size:12px;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">Nuevo panel activado</span>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <h1 style="margin:0;font-size:26px;line-height:1.2;color:#ffffff;font-weight:700;">¡Bienvenido a Red Social y Politica!</h1>
                    <p style="margin:10px 0 0 0;font-size:14px;color:#EDE9FE;">Tu panel de registro esta listo</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 28px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:14px;">
                <tr>
                  <td style="font-size:15px;line-height:1.7;color:#374151;">
                    <p style="margin:0 0 16px 0;font-size:17px;font-weight:600;color:#111827;">Hola ${firstName},</p>
                    <p style="margin:0 0 16px 0;">Desde tu panel podras administrar tu red, consultar estadisticas y compartir tu enlace de registro.</p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:10px 0 8px 0;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        <td style="background:#4F46E5;border-radius:10px;">
                          <a href="${registrationLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;">Ir al Formulario</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Section -->
          <tr>
            <td style="padding:0 28px 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;border-radius:14px;border:1px solid #E5E7EB;">
                <tr>
                  <td style="padding:20px 22px;text-align:center;">
                    <p style="margin:0 0 14px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6B7280;font-weight:600;">Codigo QR de registro</p>
                    <img src="${qrDataUri}" alt="Codigo QR" width="180" style="display:block;border-radius:10px;margin:0 auto 16px auto;max-width:100%;height:auto;" />
                    <div style="font-size:12px;color:#6B7280;margin-bottom:6px;">Enlace directo</div>
                    <div style="font-size:12px;color:#4F46E5;word-break:break-word;font-family:'Courier New',monospace;">${registrationLink}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tips -->
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E5E7EB;">
                <tr>
                  <td style="padding-top:18px;font-size:14px;color:#374151;">
                    <p style="margin:0 0 10px 0;font-weight:600;color:#111827;">Consejos rapidos</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="display:inline-block;width:18px;height:18px;border-radius:999px;background:#E0E7FF;color:#3730A3;font-size:12px;line-height:18px;text-align:center;margin-right:8px;">✓</span>
                          Comparte el enlace con tu equipo
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="display:inline-block;width:18px;height:18px;border-radius:999px;background:#E0E7FF;color:#3730A3;font-size:12px;line-height:18px;text-align:center;margin-right:8px;">✓</span>
                          Imprime el QR para distribucion rapida
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="display:inline-block;width:18px;height:18px;border-radius:999px;background:#E0E7FF;color:#3730A3;font-size:12px;line-height:18px;text-align:center;margin-right:8px;">✓</span>
                          Monitorea avances desde el panel
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 28px 28px;border-top:1px solid #E5E7EB;background-color:#F9FAFB;font-size:12px;color:#6B7280;text-align:center;">
              <p style="margin:0 0 6px 0;">Red Social y Politica · Plataforma de gestion</p>
              <p style="margin:0 0 6px 0;">Soporte: <a href="mailto:soporte@servidor.com" style="color:#4F46E5;text-decoration:none;">soporte@servidor.com</a></p>
              <p style="margin:0;">© ${year} Red Social y Politica</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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

      const rawPassword = plainPassword || leader.tempPasswordPlaintext;
      const password = this.decryptTempPassword(rawPassword);
      if (!password) throw new Error('Password temporal no proporcionado');

      const subject = 'Tus credenciales de acceso';
      const loginUrl = `${this.getBaseUrl()}/`;

      const bodyHtml = `
        <p style="margin: 0 0 18px 0; font-size: 15px; color: #64748b; line-height: 1.7;">
          Tus credenciales son temporales para tu primer ingreso. Guarda esta informacion en un lugar seguro.
        </p>
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px;">Usuario</p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px 16px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #1d4ed8; margin-bottom: 16px;">
          ${leader.username || email}
        </div>
        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.6px;">Contrasena temporal</p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px 16px; font-family: 'Courier New', monospace; font-size: 15px; font-weight: 700; color: #1d4ed8; margin-bottom: 16px;">
          ${password}
        </div>
        <div style="background: #fff7ed; border-left: 4px solid #fb923c; padding: 12px 14px; border-radius: 8px; font-size: 13px; color: #7c2d12;">
          Por seguridad, inicia sesion y cambia la contrasena inmediatamente.
        </div>
      `;

      const htmlContent = this.wrapEmail({
        title: 'Credenciales de acceso',
        subtitle: 'Usa estos datos para entrar al sistema',
        bodyHtml,
        ctaLabel: 'Iniciar sesion',
        ctaUrl: loginUrl
      });

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

            const resolvedBaseUrl = this.getBaseUrl(baseUrl);
            const registrationLink = `${resolvedBaseUrl}/form.html?token=${leader.token}`;
      const qrDataUri = await QRCode.toDataURL(registrationLink, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
      });

            const htmlContent = this.generateEmailHTML(leader.name, registrationLink, qrDataUri);
            const subject = 'Tu codigo QR de registro';

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

      const subject = 'Recordatorio importante';
      const dashboardUrl = `${this.getBaseUrl()}/leader-dashboard.html`;
      const name = leader?.name || 'lider';

      const bodyHtml = `
        <p style="margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #0f172a;">Hola ${name},</p>
        <p style="margin: 0 0 16px 0; font-size: 14px; color: #64748b; line-height: 1.7;">
          Te recomendamos revisar tu panel y mantener tu informacion actualizada para no perder registros.
        </p>
        <p style="margin: 0 0 0 0; font-size: 14px; color: #64748b; line-height: 1.7;">
          Si necesitas ayuda, contacta al administrador.
        </p>
      `;

      const htmlContent = this.wrapEmail({
        title: 'Recordatorio',
        subtitle: 'Accion recomendada',
        bodyHtml,
        ctaLabel: 'Ir al panel',
        ctaUrl: dashboardUrl,
        accent: '#f59e0b'
      });

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

      const subject = 'Restablecimiento de contrasena';
      const loginUrl = `${this.getBaseUrl()}/`;

      const bodyHtml = `
        <p style="margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #0f172a;">Hola ${displayName},</p>
        <p style="margin: 0 0 18px 0; font-size: 14px; color: #64748b; line-height: 1.7;">
          Se genero una contrasena temporal para tu cuenta.
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px 16px; font-family: 'Courier New', monospace; font-size: 16px; font-weight: 700; color: #1d4ed8; margin-bottom: 16px; text-align: center;">
          ${tempPassword}
        </div>
        <div style="background: #fff7ed; border-left: 4px solid #fb923c; padding: 12px 14px; border-radius: 8px; font-size: 13px; color: #7c2d12;">
          Inicia sesion y cambia la contrasena inmediatamente.
        </div>
      `;

      const htmlContent = this.wrapEmail({
        title: 'Restablecimiento de contrasena',
        subtitle: 'Nueva clave temporal',
        bodyHtml,
        ctaLabel: 'Iniciar sesion',
        ctaUrl: loginUrl
      });

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
    const firstName = (leaderName || 'lider').split(' ')[0];

    const bodyHtml = `
      <p style="margin: 0 0 18px 0; font-size: 16px; font-weight: 600; color: #0f172a;">Hola ${firstName},</p>
      <p style="margin: 0 0 18px 0; font-size: 14px; color: #64748b; line-height: 1.7;">
        Escanea el codigo QR o usa el enlace para abrir el formulario de registro.
      </p>
      <div style="background: #f8fafc; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 16px;">
        <img src="${qrDataUri}" alt="Codigo QR de registro" style="display: block; max-width: 180px; height: auto; border-radius: 8px; margin: 0 auto;">
        <div style="margin-top: 14px; font-size: 12px; color: #64748b;">Enlace:</div>
        <div style="font-family: 'Courier New', monospace; font-size: 12px; color: #1d4ed8; word-break: break-word;">${registrationLink}</div>
      </div>
      <ul style="margin: 0; padding-left: 18px; color: #64748b; font-size: 13px; line-height: 1.6;">
        <li>Comparte el enlace con tu equipo</li>
        <li>Imprime el codigo QR para distribuir</li>
        <li>Monitorea los registros en tu panel</li>
      </ul>
    `;

    return this.wrapEmail({
      title: 'Tu enlace de registro',
      subtitle: 'Acceso rapido al formulario',
      bodyHtml,
      ctaLabel: 'Abrir formulario',
      ctaUrl: registrationLink
    });
  }
}

// Exportar instancia singleton
export const emailService = new EmailService();
