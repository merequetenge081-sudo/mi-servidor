import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import logger from '../config/logger.js';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    // Log de variables de entorno para debugging
    logger.info(`📧 EmailService Init - NODE_ENV: ${process.env.NODE_ENV}`);
    logger.info(`📧 EMAIL_USER configurado: ${process.env.EMAIL_USER ? 'Si' : 'No'}`);
    logger.info(`📧 EMAIL_PASS configurado: ${process.env.EMAIL_PASS ? 'Si' : 'No'}`);
    logger.info(`📧 SMTP_HOST: ${process.env.SMTP_HOST || 'smtp.hostinger.com'}`);
    logger.info(`📧 SMTP_PORT: ${process.env.SMTP_PORT || '465'}`);

    // Permitir intento de envío real si se definen EMAIL_USER y EMAIL_PASS
    const hasEmailCredentials = process.env.EMAIL_USER && process.env.EMAIL_PASS;
    const forceMock = process.env.FORCE_EMAIL_MOCK === 'true';

    if (!hasEmailCredentials || forceMock) {
      logger.warn('⚠️  Usando modo mock para emails (credenciales no configuradas o forzado).');
      this.mockMode = true;
      return;
    }

    try {
      const smtpHost = process.env.SMTP_HOST || 'smtp.hostinger.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
      const smtpSecure = smtpPort === 465;

      logger.info(`📧 Intentando conectar SMTP: ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 20000,    // 20 segundos
        socketTimeout: 20000,        // 20 segundos
        greetingTimeout: 10000,      // 10 segundos para greeting
        pool: {
          maxConnections: 5,
          maxMessages: 100,
          rateDelta: 1000,            // Esperar 1 segundo entre grupos de mensajes
          rateLimit: 5                // Máximo 5 mensajes por segundo
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2'
        }
      });

      this.mockMode = false;
      logger.info(`✅ SMTP configurado correctamente: ${smtpHost}:${smtpPort} (secure: ${smtpSecure})`);
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

      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@servidor.com',
        to: leader.email,
        subject: '🔗 Tu enlace personalizado de registro',
        html: htmlContent,
      };

      logger.info(`📧 mailOptions TO: ${mailOptions.to}, FROM: ${mailOptions.from}`);

      // Si está en mock mode, no enviar
      if (this.mockMode) {
        logger.info(`
╔════════════════════════════════════════════════════╗
║           📧 MOCK EMAIL - MODO DESARROLLO          ║
╚════════════════════════════════════════════════════╝
To: ${leader.email}
Subject: ${mailOptions.subject}
────────────────────────────────────────────────────
${leader.name}, tu enlace de registro es:
${registrationLink}
        `);
        return { success: true, mock: true };
      }

      // Enviar correo real con reintentos
      logger.info(`📧 Enviando correo a ${leader.email}...`);
      
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          logger.info(`📧 Intento ${attempt}/2 de envío a ${leader.email}...`);
          
          // Usar Promise.race para un timeout de 15 segundos en la solicitud
          const sendPromise = this.transporter.sendMail(mailOptions);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email send timeout')), 15000)
          );
          
          const info = await Promise.race([sendPromise, timeoutPromise]);
          logger.info(`✅ Email enviado exitosamente a ${leader.email} (Message ID: ${info.messageId})`);
          return { success: true, messageId: info.messageId, mock: false };
        } catch (smtpError) {
          lastError = smtpError;
          logger.error(`❌ Error SMTP en intento ${attempt}:`, smtpError.message);
          
          // Si es timeout y no es el último intento, esperar y reintentar
          if ((smtpError.code === 'ETIMEDOUT' || smtpError.message.includes('timeout')) && attempt < 2) {
            logger.warn(`⏳ Timeout, esperando 2s antes de reintentar...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          // Si no es timeout, no reintentar
          if (smtpError.code !== 'ETIMEDOUT' && !smtpError.message.includes('timeout')) {
            break;
          }
        }
      }

      // Fallback después de fallos
      logger.warn(`📧 Fallback a MOCK: ${lastError?.message}`);
      return { success: false, mock: true, fallback: true, error: lastError?.message };
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
