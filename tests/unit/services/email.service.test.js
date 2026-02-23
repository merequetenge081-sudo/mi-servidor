/**
 * Unit Tests: EmailService
 * Pruebas para el servicio de email
 */

import { EmailService } from '../../../src/services/emailService.js';
import { Resend } from 'resend';
import QRCode from 'qrcode';
import logger from '../../../src/config/logger.js';

jest.mock('resend');
jest.mock('qrcode');
jest.mock('../../../src/config/logger.js');

describe('EmailService', () => {
  let emailService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FORCE_EMAIL_MOCK = 'true';
    process.env.EMAIL_FROM = 'test@example.com';
    process.env.BASE_URL = 'http://localhost:3000';
    
    emailService = new EmailService();
  });

  afterEach(() => {
    delete process.env.FORCE_EMAIL_MOCK;
  });

  describe('init', () => {
    it('debería usar mock mode cuando FORCE_EMAIL_MOCK es true', () => {
      process.env.FORCE_EMAIL_MOCK = 'true';
      const service = new EmailService();

      expect(service.mockMode).toBe(true);
    });

    it('debería usar mock mode cuando RESEND_API_KEY no está configurada', () => {
      process.env.FORCE_EMAIL_MOCK = 'false';
      delete process.env.RESEND_API_KEY;
      
      const service = new EmailService();

      expect(service.mockMode).toBe(true);
    });

    it('debería guardar el email from correctamente', () => {
      process.env.EMAIL_FROM = 'custom@domain.com';
      const service = new EmailService();

      expect(service.fromEmail).toBe('custom@domain.com');
    });

    it('debería usar email default si EMAIL_FROM no está configurado', () => {
      delete process.env.EMAIL_FROM;
      const service = new EmailService();

      expect(service.fromEmail).toBe('redsp@fulars.com');
    });
  });

  describe('sendAccessEmail', () => {
    const mockLeader = {
      email: 'leader@example.com',
      name: 'Juan Pérez',
      token: 'token123',
    };

    it('debería rechazar si leader no tiene email', async () => {
      const leaderWithoutEmail = { ...mockLeader, email: null };

      await expect(emailService.sendAccessEmail(leaderWithoutEmail))
        .rejects
        .toThrow('Leader email no proporcionado');
    });

    it('debería rechazar si leader no tiene token', async () => {
      const leaderWithoutToken = { ...mockLeader, token: null };

      await expect(emailService.sendAccessEmail(leaderWithoutToken))
        .rejects
        .toThrow('Leader token no disponible');
    });

    it('debería retornar success en mock mode', async () => {
      emailService.mockMode = true;

      const result = await emailService.sendAccessEmail(mockLeader);

      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    it('debería generar QR code con la URL correcta', async () => {
      emailService.mockMode = true;
      const expectedUrl = `http://localhost:3000/form.html?token=token123`;
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,ABC123');

      await emailService.sendAccessEmail(mockLeader);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          errorCorrectionLevel: 'H',
          type: 'image/png',
          width: 300,
        })
      );
    });

    it('debería usar BASE_URL por defecto si no se proporciona', async () => {
      emailService.mockMode = true;

      await emailService.sendAccessEmail(mockLeader);

      expect(logger.info).toHaveBeenCalled();
    });

    it('debería registrar un error si QR generation falla', async () => {
      emailService.mockMode = false;
      QRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'));

      await expect(emailService.sendAccessEmail(mockLeader))
        .rejects
        .toThrow('No se pudo enviar el email');
    });
  });

  describe('generateEmailHTML', () => {
    it('debería generar HTML válido', () => {
      const html = emailService.generateEmailHTML('Juan', 'http://example.com', 'data:image/png;base64,ABC');

      expect(html).toContain('Juan');
      expect(html).toContain('http://example.com');
      expect(html).toContain('data:image/png;base64,ABC');
      expect(html).toMatch(/<html/);
      expect(html).toMatch(/<\/html>/);
    });

    it('debería incluir el nombre del líder en el HTML', () => {
      const html = emailService.generateEmailHTML('María López', 'http://example.com', 'data:image/png');

      expect(html).toContain('María López');
    });
  });

  describe('Integración con Resend', () => {
    it('debería enviar email a través de Resend cuando está configurado', async () => {
      process.env.FORCE_EMAIL_MOCK = 'false';
      process.env.RESEND_API_KEY = 'real_key_123';
      
      const mockResendInstance = {
        emails: {
          send: jest.fn().mockResolvedValue({ data: { id: 'msg_123' }, error: null }),
        },
      };
      Resend.mockImplementation(() => mockResendInstance);
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,ABC');

      const service = new EmailService();
      const result = await service.sendAccessEmail({
        email: 'test@example.com',
        name: 'Test User',
        token: 'token_abc',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_123');
    });

    it('debería manejar errores de Resend', async () => {
      process.env.FORCE_EMAIL_MOCK = 'false';
      process.env.RESEND_API_KEY = 'real_key_123';
      
      const mockResendInstance = {
        emails: {
          send: jest.fn().mockResolvedValue({ 
            data: null, 
            error: { message: 'Invalid email' } 
          }),
        },
      };
      Resend.mockImplementation(() => mockResendInstance);
      QRCode.toDataURL.mockResolvedValue('data:image/png;base64,ABC');

      const service = new EmailService();
      const result = await service.sendAccessEmail({
        email: 'test@example.com',
        name: 'Test User',
        token: 'token_abc',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });
  });
});
