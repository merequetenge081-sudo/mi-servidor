/**
 * Unit Tests: Auth Controller
 * Pruebas para los endpoints de autenticación
 */

import { adminLogin, leaderLogin, changePassword } from '../../../src/backend/modules/auth/auth.controller.js';
import { AppError } from '../../../src/backend/core/AppError.js';
import authService from '../../../src/backend/modules/auth/auth.service.js';

jest.mock('../../../src/backend/modules/auth/auth.service.js');
jest.mock('../../../src/backend/core/Logger.js', () => ({
  createLogger: () => ({
    info: jest.fn(),
    success: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

describe('Auth Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      user: {},
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('adminLogin', () => {
    it('debería retornar error si falta username', async () => {
      req.body = { password: 'test123' };

      await adminLogin(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('debería retornar error si falta password', async () => {
      req.body = { username: 'admin' };

      await adminLogin(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('debería llamar a authService.adminLogin con credenciales válidas', async () => {
      req.body = { username: 'admin', password: 'admin123' };
      authService.adminLogin.mockResolvedValue({ token: 'token123' });

      await adminLogin(req, res, next);

      expect(authService.adminLogin).toHaveBeenCalledWith('admin', 'admin123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login exitoso',
        data: { token: 'token123' },
      });
    });

    it('debería manejar errores del servicio', async () => {
      req.body = { username: 'admin', password: 'wrong' };
      const error = AppError.unauthorized('Credenciales inválidas');
      authService.adminLogin.mockRejectedValue(error);

      await adminLogin(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('leaderLogin', () => {
    it('debería retornar error si falta email', async () => {
      req.body = { password: 'test123' };

      await leaderLogin(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('debería retornar error si falta password', async () => {
      req.body = { email: 'leader@test.com' };

      await leaderLogin(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('debería llamar a authService.leaderLogin con credenciales válidas', async () => {
      req.body = { email: 'leader@test.com', password: 'leader123' };
      authService.leaderLogin.mockResolvedValue({ token: 'token456' });

      await leaderLogin(req, res, next);

      expect(authService.leaderLogin).toHaveBeenCalledWith('leader@test.com', 'leader123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Login exitoso',
        data: { token: 'token456' },
      });
    });

    it('debería retornar token en respuesta exitosa', async () => {
      req.body = { email: 'leader@test.com', password: 'leader123' };
      const mockResponse = {
        token: 'eyJhbGciOiJIUzI1NiIs...',
        user: { id: '123', email: 'leader@test.com', role: 'leader' },
      };
      authService.leaderLogin.mockResolvedValue(mockResponse);

      await leaderLogin(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.token).toBe(mockResponse.token);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      req.user = { userId: 'user123', role: 'admin' };
    });

    it('debería retornar error si falta oldPassword', async () => {
      req.body = { newPassword: 'newpass123' };

      await changePassword(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('debería retornar error si falta newPassword', async () => {
      req.body = { oldPassword: 'oldpass123' };

      await changePassword(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('debería llamar a authService.changePassword con parámetros correctos', async () => {
      req.body = { oldPassword: 'old123', newPassword: 'new123' };
      authService.changePassword.mockResolvedValue({ success: true });

      await changePassword(req, res, next);

      expect(authService.changePassword).toHaveBeenCalledWith(
        'user123',
        'admin',
        'old123',
        'new123'
      );
    });

    it('debería retornar mensaje de éxito', async () => {
      req.body = { oldPassword: 'old123', newPassword: 'new123' };
      authService.changePassword.mockResolvedValue({ success: true });

      await changePassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Contraseña actualizada correctamente',
        data: { success: true },
      });
    });

    it('debería usar el userId del usuario autenticado', async () => {
      req.user = { userId: 'leader456', role: 'leader' };
      req.body = { oldPassword: 'old', newPassword: 'new' };
      authService.changePassword.mockResolvedValue({ success: true });

      await changePassword(req, res, next);

      expect(authService.changePassword).toHaveBeenCalledWith(
        'leader456',
        'leader',
        'old',
        'new'
      );
    });

    it('debería manejar errores de validación de contraseña', async () => {
      req.body = { oldPassword: 'old', newPassword: 'new' };
      const error = AppError.badRequest('Contraseña actual incorrecta');
      authService.changePassword.mockRejectedValue(error);

      await changePassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Casos de error general', () => {
    it('debería pasar errores inesperados a next middleware', async () => {
      req.body = { username: 'admin', password: 'test' };
      const unexpectedError = new Error('Database connection failed');
      authService.adminLogin.mockRejectedValue(unexpectedError);

      await adminLogin(req, res, next);

      expect(next).toHaveBeenCalledWith(unexpectedError);
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
