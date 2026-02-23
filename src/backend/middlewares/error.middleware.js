/**
 * Global Error Handler Middleware
 * Captura todos los errores y retorna respuestas consistentes
 */

import { createLogger } from '../core/Logger.js';
import { AppError } from '../core/AppError.js';

const logger = createLogger('ErrorHandler');

/**
 * Middleware de manejo de errores
 * Debe ser el último middleware en la cadena
 */
export function errorMiddleware(err, req, res, next) {
  // Por defecto es error interno
  let error = err;

  // Si no es AppError, convertir a AppError
  if (!(err instanceof AppError)) {
    logger.error('Error no capturado', err);

    // Errores específicos de Mongoose
    if (err.name === 'CastError') {
      error = new AppError('ID inválido', 400);
    } else if (err.name === 'ValidationError') {
      error = new AppError('Error de validación', 422, {
        fields: Object.keys(err.errors)
      });
    } else if (err.name === 'MongoServerError' && err.code === 11000) {
      error = new AppError('Duplicado: El recurso ya existe', 409);
    } else {
      error = new AppError('Error interno del servidor', 500);
    }
  }

  // Log del error
  const logLevel = error.statusCode >= 500 ? 'error' : 'warn';
  logger[logLevel](`${req.method} ${req.path} - ${error.statusCode}`, error);

  // Respuesta HTTP
  res.status(error.statusCode).json(error.toJSON());
}

/**
 * Wrapper para convertir async/await errors en next()
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Middleware de ruta no encontrada
 */
export function notFoundMiddleware(req, res) {
  const error = AppError.notFound('Endpoint');
  res.status(404).json(error.toJSON());
}
