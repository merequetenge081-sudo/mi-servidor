/**
 * Unit Tests: ValidationService
 * Pruebas para la lógica de validación de registros
 */

import { ValidationService } from '../../../src/services/validation.service.js';
import { Registration } from '../../../src/models/Registration.js';

jest.mock('../../../src/models/Registration.js');

describe('ValidationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDuplicate', () => {
    it('debería encontrar un registro duplicado', async () => {
      const mockRegistration = { _id: '123', cedula: '1234567890', eventId: 'evt123' };
      Registration.findOne.mockResolvedValue(mockRegistration);

      const result = await ValidationService.checkDuplicate('1234567890', 'evt123');

      expect(result).toEqual(mockRegistration);
      expect(Registration.findOne).toHaveBeenCalledWith({
        cedula: '1234567890',
        eventId: 'evt123',
      });
    });

    it('debería retornar null si no existe duplicado', async () => {
      Registration.findOne.mockResolvedValue(null);

      const result = await ValidationService.checkDuplicate('1234567890', 'evt123');

      expect(result).toBeNull();
    });

    it('debería excluir un registro específico cuando se proporciona excludeId', async () => {
      const mockRegistration = null;
      Registration.findOne.mockResolvedValue(mockRegistration);

      await ValidationService.checkDuplicate('1234567890', 'evt123', 'regId456');

      expect(Registration.findOne).toHaveBeenCalledWith({
        cedula: '1234567890',
        eventId: 'evt123',
        _id: { $ne: 'regId456' },
      });
    });
  });

  describe('validateVotingData', () => {
    it('debería ser válido si registeredToVote es false', () => {
      const result = ValidationService.validateVotingData(false, null, null);

      expect(result.valid).toBe(true);
    });

    it('debería ser inválido si registeredToVote es true pero falta puestoId', () => {
      const result = ValidationService.validateVotingData(true, null, 'mesa1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('puestoId');
    });

    it('debería ser inválido si registeredToVote es true pero falta mesa', () => {
      const result = ValidationService.validateVotingData(true, 'puesto123', null);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('mesa');
    });

    it('debería ser válido si registeredToVote es true y tiene puestoId y mesa', () => {
      const result = ValidationService.validateVotingData(true, 'puesto123', 'mesa1');

      expect(result.valid).toBe(true);
    });
  });

  describe('validateRegistration', () => {
    const validRegistration = {
      leaderId: 'lider123',
      eventId: 'evt123',
      firstName: 'Juan',
      lastName: 'Pérez',
      cedula: '1234567890',
    };

    it('debería ser válido con datos completos requeridos', () => {
      const result = ValidationService.validateRegistration(validRegistration);

      expect(result.valid).toBe(true);
    });

    it('debería ser inválido si falta un campo requerido', () => {
      const invalidData = { ...validRegistration };
      delete invalidData.cedula;

      const result = ValidationService.validateRegistration(invalidData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('cedula');
    });

    it('debería validar datos de votación cuando registeredToVote es true', () => {
      const dataWithVoting = {
        ...validRegistration,
        registeredToVote: true,
        puestoId: 'puesto123',
        mesa: 'mesa1',
      };

      const result = ValidationService.validateRegistration(dataWithVoting);

      expect(result.valid).toBe(true);
    });

    it('debería ser inválido si registeredToVote es true pero falta puestoId', () => {
      const invalidVotingData = {
        ...validRegistration,
        registeredToVote: true,
        mesa: 'mesa1',
      };

      const result = ValidationService.validateRegistration(invalidVotingData);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('puestoId');
    });

    it('debería validar todos los campos requeridos', () => {
      const requiredFields = ['leaderId', 'eventId', 'firstName', 'lastName', 'cedula'];

      for (const field of requiredFields) {
        const invalidData = { ...validRegistration };
        delete invalidData[field];

        const result = ValidationService.validateRegistration(invalidData);

        expect(result.valid).toBe(false);
        expect(result.error).toContain(field);
      }
    });
  });
});
