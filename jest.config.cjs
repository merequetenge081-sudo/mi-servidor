/**
 * Jest Configuration
 * Configuración para testing unitario, integración y E2E
 */

module.exports = {
  // Entorno de ejecución
  testEnvironment: 'node',

  // Extensiones de archivo
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],

  // Setup antes de tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Cobertura
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/*.spec.js',
    '!src/**/index.js',
    '!src/server.js',
    '!src/app.js',
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
  ],

  coverageThreshold: {
    global: {
      branches: 30,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },

  // Timeout para tests
  testTimeout: 10000,

  // Verbosidad
  verbose: true,

  // Cobertura
  coverageReporters: ['text', 'text-summary', 'html', 'lcov'],

  // Detectar leaks
  detectLeaks: false,

  // Force exit
  forceExit: false,

  // Bail - parar al primer test fallido
  bail: false,

  // Clear mocks entre tests
  clearMocks: true,

  // Restore mocks entre tests
  restoreMocks: true,

  // Transform
  transform: {},
  transformIgnorePatterns: ['node_modules/'],
};
