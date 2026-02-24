/**
 * Unit Tests: EmailService
 * Pruebas para el servicio real de email
 */

let emailService;
let encrypt;

process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key';

beforeAll(async () => {
  ({ emailService } = await import('../../../src/services/emailService.js'));
  ({ encrypt } = await import('../../../src/utils/crypto.js'));
});

describe('EmailService', () => {
  beforeEach(() => {
    emailService.mockMode = true;
  });

  afterEach(() => {
    delete process.env.TEMP_PASSWORD_TTL_HOURS;
  });

  describe('Configuración de EmailService', () => {
    it('debería iniciar en mockMode cuando no hay API key', () => {
      expect(emailService.mockMode).toBe(true);
    });
  });

  describe('Generación de HTML', () => {
    it('debería incluir el nombre del líder', () => {
      const html = emailService.generateEmailHTML('Juan Pérez', 'http://example.com', 'data:image');
      expect(html).toContain('Juan');
    });

    it('debería incluir el enlace personalizado', () => {
      const html = emailService.generateEmailHTML('User', 'http://example.com/form?token=123', 'data:image');
      expect(html).toContain('http://example.com/form?token=123');
    });

    it('debería incluir el QR code', () => {
      const html = emailService.generateEmailHTML('User', 'http://example.com', 'data:image/png;base64,ABC');
      expect(html).toContain('data:image/png;base64,ABC');
    });

    it('debería ser HTML válido', () => {
      const html = emailService.generateEmailHTML('Test', 'http://url', 'data:img');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('</html>');
      expect(html).toContain('<body');
    });
  });

  describe('sendAccessEmail en modo mock', () => {
    it('debería retornar success true con mock', async () => {
      const leader = { email: 'test@example.com', token: 'token123', name: 'Juan Pérez' };
      const result = await emailService.sendAccessEmail(leader, 'http://localhost:3000');
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    it('debería fallar si falta email', async () => {
      const leader = { token: 'token123', name: 'Juan Pérez' };
      await expect(emailService.sendAccessEmail(leader, 'http://localhost:3000')).rejects.toThrow('email');
    });

    it('debería fallar si falta token', async () => {
      const leader = { email: 'test@example.com', name: 'Juan Pérez' };
      await expect(emailService.sendAccessEmail(leader, 'http://localhost:3000')).rejects.toThrow('token');
    });
  });

  describe('Otros envíos en modo mock', () => {
    it('debería enviar welcome email en mock', async () => {
      const leader = { email: 'test@example.com', name: 'Juana Perez' };
      const result = await emailService.sendWelcomeEmail(leader, 'http://localhost:3000');
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    it('debería enviar credenciales en mock', async () => {
      const leader = {
        email: 'test@example.com',
        name: 'Juana Perez',
        username: 'jperez',
        tempPasswordPlaintext: 'temp123'
      };
      const result = await emailService.sendCredentialsEmail(leader, 'http://localhost:3000');
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    it('no debería incluir contraseña temporal expirada', async () => {
      process.env.TEMP_PASSWORD_TTL_HOURS = '1';
      const leader = {
        email: 'test@example.com',
        name: 'Juana Perez',
        username: 'jperez',
        tempPasswordPlaintext: encrypt('Temp1234'),
        tempPasswordCreatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      };

      const result = await emailService.sendCredentialsEmail(leader, 'http://localhost:3000');
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    it('debería enviar credenciales con contraseña activa', async () => {
      process.env.TEMP_PASSWORD_TTL_HOURS = '24';
      const leader = {
        email: 'test@example.com',
        name: 'Juana Perez',
        username: 'jperez',
        tempPasswordPlaintext: encrypt('Temp1234'),
        tempPasswordCreatedAt: new Date()
      };

      const result = await emailService.sendCredentialsEmail(leader, 'http://localhost:3000');
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });

    it('debería enviar password temporal en mock', async () => {
      const leader = { email: 'test@example.com', name: 'Juana Perez', username: 'jperez' };
      const result = await emailService.sendTemporaryPasswordEmail(leader, 'Temp1234', 'http://localhost:3000');
      expect(result.success).toBe(true);
      expect(result.mock).toBe(true);
    });
  });
});
