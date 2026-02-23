/**
 * Logger centralizado para toda la aplicación
 * Reemplaza console.log, console.error, etc.
 */
import logger from '../../config/logger.js';

export class Logger {
  constructor(module = 'App') {
    this.module = module;
  }

  /**
   * Log de información general
   */
  info(message, data = null) {
    const prefix = `[${this.module}]`;
    if (data) {
      logger.info(`${prefix} ${message}`, data);
    } else {
      logger.info(`${prefix} ${message}`);
    }
  }

  /**
   * Log de éxito
   */
  success(message, data = null) {
    const prefix = `[${this.module}] ✅`;
    if (data) {
      logger.info(`${prefix} ${message}`, data);
    } else {
      logger.info(`${prefix} ${message}`);
    }
  }

  /**
   * Log de advertencia
   */
  warn(message, data = null) {
    const prefix = `[${this.module}] ⚠️`;
    if (data) {
      logger.warn(`${prefix} ${message}`, data);
    } else {
      logger.warn(`${prefix} ${message}`);
    }
  }

  /**
   * Log de error
   */
  error(message, error = null, data = null) {
    const prefix = `[${this.module}] ❌`;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (data) {
      logger.error(`${prefix} ${message}: ${errorMessage}`, { ...data, stack: error?.stack });
    } else {
      logger.error(`${prefix} ${message}: ${errorMessage}`, { stack: error?.stack });
    }
  }

  /**
   * Log de debug
   */
  debug(message, data = null) {
    const prefix = `[${this.module}] 🔍`;
    if (data) {
      logger.debug(`${prefix} ${message}`, data);
    } else {
      logger.debug(`${prefix} ${message}`);
    }
  }

  /**
   * Log con contexto de request
   */
  request(method, path, statusCode, duration) {
    logger.info(`[HTTP] ${method} ${path} → ${statusCode} (${duration}ms)`);
  }
}

/**
 * Factory para crear logger con módulo específico
 */
export function createLogger(moduleName) {
  return new Logger(moduleName);
}
