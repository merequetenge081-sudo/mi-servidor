/**
 * Duplicates Service
 * Lógica de detección y reporte de duplicados
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import duplicatesRepository from './duplicates.repository.js';
import { Registration } from '../../../models/Registration.js';
import {
  runDeduplicationSkill,
  persistDeduplicationFlags
} from '../../skills/index.js';

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

/**
 * Ejecuta un barrido de deduplicación sobre registros existentes.
 * No rompe endpoints actuales; complementa el reporte legacy.
 */
export async function runDeduplicationScan({ organizationId = null, eventId = null, limit = 300 } = {}) {
  try {
    logger.info('Ejecutando deduplication scan', { organizationId, eventId, limit });

    const query = {
      ...(organizationId ? { organizationId } : {}),
      ...(eventId ? { eventId } : {})
    };

    const registrations = await Registration.find(query)
      .select('_id organizationId eventId cedula firstName lastName phone leaderId localidad puestoId dataIntegrityStatus workflowStatus')
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(limit, 2000)))
      .lean();

    let scanned = 0;
    let flagged = 0;
    let critical = 0;
    const byType = {};

    for (const reg of registrations) {
      scanned += 1;
      const dedup = await runDeduplicationSkill({
        registration: reg,
        organizationId: reg.organizationId || organizationId,
        excludeRegistrationId: reg._id
      });

      if (!dedup.hasFlags) continue;

      flagged += 1;
      if (dedup.hasCritical) critical += 1;
      dedup.flags.forEach((f) => {
        byType[f.flagType] = (byType[f.flagType] || 0) + 1;
      });

      await persistDeduplicationFlags({
        registrationId: reg._id,
        organizationId: reg.organizationId || organizationId,
        eventId: reg.eventId,
        cedula: reg.cedula,
        flags: dedup.flags
      });

      await Registration.updateOne(
        { _id: reg._id },
        {
          $set: {
            deduplicationFlags: dedup.flags.map((f) => f.flagType),
            dataIntegrityStatus:
              dedup.dataIntegrityStatus === 'invalid' ? 'invalid' : 'needs_review',
            workflowStatus: dedup.workflowStatus
          }
        }
      );
    }

    return {
      scanned,
      flagged,
      critical,
      byType
    };
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error en deduplication scan', error);
    throw AppError.serverError('Error al ejecutar deduplication scan');
  }
}

export default {
  getDuplicatesReport,
  getDuplicateStats,
  getDuplicateDetails,
  runDeduplicationScan
};
