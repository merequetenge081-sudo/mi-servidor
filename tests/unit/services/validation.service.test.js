/**
 * Unit Tests: ValidationService
 * Pruebas para la lógica de validación de registros
 */

let ValidationService;

beforeAll(async () => {
  ({ ValidationService } = await import('../../../src/services/validation.service.js'));
});

describe('ValidationService', () => {
  describe('Validación de Votación', () => {
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

  describe('Validación de Registro', () => {
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

    it('debería ser inválido si falta leaderId', () => {
      const invalidData = { ...validRegistration };
      delete invalidData.leaderId;
      const result = ValidationService.validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('leaderId');
    });

    it('debería ser inválido si falta eventId', () => {
      const invalidData = { ...validRegistration };
      delete invalidData.eventId;
      const result = ValidationService.validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('eventId');
    });

    it('debería ser inválido si falta firstName', () => {
      const invalidData = { ...validRegistration };
      delete invalidData.firstName;
      const result = ValidationService.validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('firstName');
    });

    it('debería ser inválido si falta lastName', () => {
      const invalidData = { ...validRegistration };
      delete invalidData.lastName;
      const result = ValidationService.validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lastName');
    });

    it('debería ser inválido si falta cedula', () => {
      const invalidData = { ...validRegistration };
      delete invalidData.cedula;
      const result = ValidationService.validateRegistration(invalidData);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('cedula');
    });

    it('debería validar datos de votación cuando registeredToVote es true', () => {
      const data = {
        ...validRegistration,
        registeredToVote: true,
        puestoId: 'puesto123',
        mesa: 'mesa1',
      };
      const result = ValidationService.validateRegistration(data);
      expect(result.valid).toBe(true);
    });

    it('debería fallar si falta mesa cuando registeredToVote es true', () => {
      const data = {
        ...validRegistration,
        registeredToVote: true,
        puestoId: 'puesto123',
      };
      const result = ValidationService.validateRegistration(data);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('mesa');
    });
  });
});
