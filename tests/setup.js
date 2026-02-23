/**
 * Jest Setup File
 * Configuración global para todos los tests
 */

// Configuración de entorno para tests
process.env.NODE_ENV = 'test';
process.env.FORCE_EMAIL_MOCK = 'true';
process.env.JWT_SECRET = 'test_secret_key_min_32_characters_long';
process.env.ENCRYPTION_KEY = 'test_encryption_key_min_16_chars';
process.env.LOG_LEVEL = 'error'; // Reducir ruido en tests

// Custom matchers
if (typeof expect !== 'undefined' && typeof expect.extend === 'function') {
  expect.extend({
    toBeValidObjectId(received) {
      const valid = /^[0-9a-fA-F]{24}$/.test(received);
      return {
        pass: valid,
        message: () => valid
          ? `expect ${received} not to be a valid MongoDB ObjectId`
          : `expect ${received} to be a valid MongoDB ObjectId`
      };
    },

    toBeValidEmail(received) {
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(received);
      return {
        pass: valid,
        message: () => valid
          ? `expect ${received} not to be a valid email`
          : `expect ${received} to be a valid email`
      };
    },

    toBeWithinRange(received, floor, ceiling) {
      const pass = received >= floor && received <= ceiling;
      if (pass) {
        return {
          message: () => `expect ${received} not to be within range ${floor} - ${ceiling}`,
          pass: true,
        };
      } else {
        return {
          message: () => `expect ${received} to be within range ${floor} - ${ceiling}`,
          pass: false,
        };
      }
    },
  });
}
