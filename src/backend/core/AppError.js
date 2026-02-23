/**
 * Clase centralizada para manejo de errores en la aplicación
 * Permite pasar errores personalizados con código de estado, mensaje y detalles
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Captura stack trace (solo en desarrollo)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Métodos estáticos para crear errores comunes
   */
  static badRequest(message, details = null) {
    return new AppError(message, 400, details);
  }

  static unauthorized(message = 'No autorizado', details = null) {
    return new AppError(message, 401, details);
  }

  static forbidden(message = 'Acceso denegado', details = null) {
    return new AppError(message, 403, details);
  }

  static notFound(resource = 'Recurso', details = null) {
    return new AppError(`${resource} no encontrado`, 404, details);
  }

  static conflict(message, details = null) {
    return new AppError(message, 409, details);
  }

  static unprocessable(message, details = null) {
    return new AppError(message, 422, details);
  }

  static serverError(message = 'Error interno del servidor', details = null) {
    return new AppError(message, 500, details);
  }

  /**
   * Determina si el error es un error operacional (controlado)
   * vs error de programación (no controlado)
   */
  isOperational() {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Retorna objeto serializable para respuestas HTTP
   */
  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        statusCode: this.statusCode,
        ...(this.details && { details: this.details }),
        ...(process.env.NODE_ENV === 'development' && { 
          stack: this.stack,
          timestamp: this.timestamp 
        })
      }
    };
  }
}
