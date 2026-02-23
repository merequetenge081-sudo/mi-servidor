/**
 * Unit Tests: passwordValidator
 * Pruebas para validacion de contrasenas
 */

let validatePassword;
let getPasswordRequirements;

beforeAll(async () => {
  ({ validatePassword, getPasswordRequirements } = await import('../../../src/utils/passwordValidator.js'));
});

describe('passwordValidator', () => {
  it('deberia aceptar una contrasena valida', () => {
    const result = validatePassword('SecurePass123');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('deberia rechazar una contrasena corta', () => {
    const result = validatePassword('Short1');
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/M.nimo/);
  });

  it('deberia requerir mayuscula, minuscula y numero', () => {
    const result = validatePassword('alllowercase');
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/may.scula/i);
    expect(result.errors.join(' ')).toMatch(/n.mero/i);
  });

  it('deberia exponer requisitos de contrasena', () => {
    const requirements = getPasswordRequirements();
    expect(requirements.length).toBeGreaterThan(0);
    expect(requirements.join(' ')).toMatch(/M.nimo/);
  });
});
