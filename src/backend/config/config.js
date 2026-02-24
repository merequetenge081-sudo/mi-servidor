/**
 * Configuración centralizada de la aplicación
 * Valida variables de entorno requeridas
 */

const config = {
  // Servidor
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  
  // Base URLs
  BASE_URL: process.env.BASE_URL || (process.env.FRONTEND_URL) || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // Base de datos
  MONGO_URL: process.env.MONGO_URL,
  
  // Autenticación
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-for-testing-only-change-in-production',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-for-testing-only-change-in-production', // Alias para compatibilidad
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Email
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@example.com',
  FORCE_EMAIL_MOCK: process.env.FORCE_EMAIL_MOCK === 'true',
  
  // Encriptación
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'dev-encryption-key-only-for-testing',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Session
  SESSION_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutos
  
  // Paginación
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Credenciales temporales
  TEMP_PASSWORD_TTL_HOURS: parseInt(process.env.TEMP_PASSWORD_TTL_HOURS || '24', 10),
  TEMP_PASSWORD_CLEANUP_INTERVAL_MINUTES: parseInt(process.env.TEMP_PASSWORD_CLEANUP_INTERVAL_MINUTES || '60', 10),
};

/**
 * Valida que las variables requeridas estén configuradas
 */
export function validateConfig() {
  const required = ['MONGO_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
  
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas no configuradas: ${missing.join(', ')}`);
  }
  
  return true;
}

export default config;
