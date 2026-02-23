/**
 * Duplicates Service
 * Lógica de detección y reporte de duplicados
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import duplicatesRepository from './duplicates.repository.js';

const logger = createLogger('DuplicatesService');

/**
 * Obtiene reporte de duplicados
 */
export async function getDuplicatesReport(eventId = null) {
  try {
    logger.info('Generando reporte de duplicados', { eventId });

    const duplicates = await duplicatesRepository.findDuplicatesByCedula(eventId);

    // Enriquecer con detalles
    const report = [];
    for (const dup of duplicates) {
      const details = await duplicatesRepository.getDuplicateDetails(dup._id, eventId);
      report.push({
        cedula: dup._id,
        count: dup.count,
        flagged: dup.count > 2 ? 'high-priority' : 'normal',
        registrations: details.map(d => ({
          id: d._id,
          nombre: d.nombre,
          apellido: d.apellido,
          líder: d.leaderId?.name,
          puesto: d.puestoId?.numero,
          fecha: d.createdAt
        }))
      });
    }

    logger.success('Reporte generado', { duplicatesCount: report.length });
    return {
      totalDuplicates: report.length,
      highPriority: report.filter(r => r.flagged === 'high-priority').length,
      records: report
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error generando reporte', error);
    throw AppError.serverError('Error al generar reporte de duplicados');
  }
}

/**
 * Obtiene estadísticas de duplicados
 */
export async function getDuplicateStats(eventId = null) {
  try {
    logger.info('Obteniendo stats de duplicados', { eventId });

    const duplicatesCount = await duplicatesRepository.countDuplicates(eventId);
    const allDuplicates = await duplicatesRepository.findDuplicatesByCedula(eventId);

    const totalRecords = allDuplicates.reduce((sum, d) => sum + d.count, 0);
    const duplicateRecords = totalRecords - allDuplicates.length;

    return {
      totalDuplicateGroups: duplicatesCount,
      totalDuplicateRecords: duplicateRecords,
      affectedPeople: allDuplicates.length,
      duplicatePercentage: allDuplicates.length > 0 
        ? ((duplicateRecords / totalRecords) * 100).toFixed(2)
        : 0
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error obteniendo stats', error);
    throw AppError.serverError('Error al obtener estadísticas');
  }
}

/**
 * Obtiene detalles de un duplicado específico
 */
export async function getDuplicateDetails(cedula, eventId = null) {
  try {
    if (!cedula) {
      throw AppError.badRequest('Cédula requerida');
    }

    logger.info('Obteniendo detalles de duplicado', { cedula });

    const details = await duplicatesRepository.getDuplicateDetails(cedula, eventId);

    if (details.length === 0) {
      throw AppError.notFound('No se encontraron registros para esta cédula');
    }

    return {
      cedula,
      count: details.length,
      records: details.map(d => ({
        id: d._id,
        nombre: `${d.nombre} ${d.apellido}`,
        líder: d.leaderId?.name || 'Sin asignar',
        email: d.leaderId?.email || '',
        puesto: d.puestoId?.numero,
        localidad: d.puestoId?.localidad,
        fecha: d.createdAt
      }))
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error obteniendo detalles de duplicado', error);
    throw AppError.serverError('Error al obtener detalles');
  }
}

export default {
  getDuplicatesReport,
  getDuplicateStats,
  getDuplicateDetails
};
