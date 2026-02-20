const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Mínimo ${PASSWORD_MIN_LENGTH} caracteres`);
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos una mayúscula');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Al menos una minúscula');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Al menos un número');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getPasswordRequirements() {
  return [
    `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
    'Al menos una mayúscula',
    'Al menos una minúscula',
    'Al menos un número'
  ];
}
