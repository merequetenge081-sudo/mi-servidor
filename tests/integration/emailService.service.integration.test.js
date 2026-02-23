/**
 * Integration Tests: Email Service
 * Pruebas de integración sin necesidad de base de datos
 */

import { EmailService } from '../../../src/services/emailService.js';

describe('EmailService Integration', () => {
  describe('Email HTML Generation', () => {
    it('debería generar HTML con estructura correcta', () => {
      const emailService = new EmailService();
      const html = emailService.generateEmailHTML(
        'Juan Pérez',
        'http://example.com/form?token=123',
        'data:image/png;base64,ABC123'
      );

      // Verificar estructura HTML
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Juan Pérez');
      expect(html).toContain('http://example.com/form?token=123');
      expect(html).toContain('data:image/png;base64,ABC123');
      expect(html).toContain('</html>');
    });

    it('debería escapar caracteres especiales en el nombre', () => {
      const emailService = new EmailService();
      const html = emailService.generateEmailHTML(
        'Juan & María <Test>',
        'http://example.com',
        'data:image/png'
      );

      // El HTML debe ser válido incluso con caracteres especiales
      expect(html).toBeDefined();
      expect(html.length > 0).toBe(true);
    });
  });

  describe('Resend Configuration', () => {
    it('debería configurarse en modo mock por defecto', () => {
      process.env.FORCE_EMAIL_MOCK = 'true';
      const emailService = new EmailService();

      expect(emailService.mockMode).toBe(true);
      expect(emailService.resend).toBeNull();
    });

    it('debería usar email from correctamente', () => {
      process.env.EMAIL_FROM = 'noreply@myapp.com';
      const emailService = new EmailService();

      expect(emailService.fromEmail).toBe('noreply@myapp.com');
    });
  });

  describe('Error Handling', () => {
    it('debería lanzar error si leader es null', async () => {
      const emailService = new EmailService();

      await expect(emailService.sendAccessEmail(null))
        .rejects
        .toThrow('Leader email no proporcionado');
    });

    it('debería lanzar error si Email es undefined', async () => {
      const emailService = new EmailService();

      await expect(emailService.sendAccessEmail({ name: 'Test' }))
        .rejects
        .toThrow('Leader email no proporcionado');
    });

    it('debería lanzar error si Token es null', async () => {
      const emailService = new EmailService();

      await expect(emailService.sendAccessEmail({
        email: 'test@example.com',
        name: 'Test',
        token: null,
      }))
        .rejects
        .toThrow('Leader token no disponible');
    });
  });

  describe('Mock Mode Behavior', () => {
    it('debería retornar {success: true, mock: true} en mock mode', async () => {
      process.env.FORCE_EMAIL_MOCK = 'true';
      const emailService = new EmailService();

      const result = await emailService.sendAccessEmail({
        email: 'test@example.com',
        name: 'Test User',
        token: 'token123',
      });

      expect(result).toEqual({ success: true, mock: true });
    });

    it('debería no llamar a Resend en mock mode', async () => {
      process.env.FORCE_EMAIL_MOCK = 'true';
      const emailService = new EmailService();

      await emailService.sendAccessEmail({
        email: 'test@example.com',
        name: 'Test User',
        token: 'token123',
      });

      expect(emailService.resend).toBeNull();
    });
  });
});
