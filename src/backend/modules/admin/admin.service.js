/**
 * Admin Service
 * Lógica de negocio para funciones de administrador
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import adminRepository from './admin.repository.js';

const logger = createLogger('AdminService');

/**
 * Importa puestos desde un array
 * Limpia los puestos existentes e inserta los nuevos
 */
export async function importPuestos(puestosData) {
  try {
    if (!Array.isArray(puestosData)) {
      throw AppError.badRequest('puestosData must be an array');
    }

    if (puestosData.length === 0) {
      throw AppError.badRequest('No puestos to import');
    }

    logger.info('Starting puestos import', { count: puestosData.length });

    // Validar datos
    const invalidPuestos = puestosData.filter(p => 
      !p.codigoPuesto || !p.nombre || !p.localidad || !Array.isArray(p.mesas)
    );

    if (invalidPuestos.length > 0) {
      logger.warn('Invalid puestos found', { invalidCount: invalidPuestos.length });
    }

    const validPuestos = puestosData.filter(p => 
      p.codigoPuesto && p.nombre && p.localidad && Array.isArray(p.mesas)
    );

    if (validPuestos.length === 0) {
      throw AppError.badRequest('No valid puestos to import');
    }

    logger.info('Valid puestos validated', { validCount: validPuestos.length, totalSent: puestosData.length });

    // Limpiar colección anterior
    await adminRepository.clearPuestos();

    // Insertar nuevos puestos
    const imported = await adminRepository.insertPuestos(validPuestos);

    // Calcular estadísticas
    const stats = await adminRepository.getPuestosStats();

    const totalMesas = stats.reduce((sum, s) => sum + s.mesasCount, 0);

    const estadisticas = stats
      .sort((a, b) => a._id.localeCompare(b._id))
      .map(s => ({
        localidad: s._id,
        puestos: s.puestosCount,
        mesas: s.mesasCount
      }));

    logger.info('Puestos import completed successfully', { 
      imported: imported.length,
      totalMesas,
      localities: stats.length
    });

    return {
      success: true,
      imported: imported.length,
      message: `✅ Successfully imported ${imported.length} polling places`,
      data: {
        totalPuestos: imported.length,
        totalMesas,
        estadisticas,
        importedAt: new Date()
      }
    };
  } catch (error) {
    logger.error('Error importing puestos', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error importing puestos');
  }
}

/**
 * Obtiene lista de puestos importados
 */
export async function getPuestosList(page = 1, limit = 50) {
  try {
    logger.info('Fetching puestos list', { page, limit });

    const skip = (page - 1) * limit;
    const [puestos, total] = await Promise.all([
      adminRepository.getAllPuestos({}).skip(skip).limit(limit).lean() || [],
      adminRepository.countPuestos({})
    ]);

    // Nota: lean() no funciona en agregaciones, ajustar si es necesario
    const puestosData = await adminRepository.getAllPuestos({});
    const puestosPage = puestosData.slice(skip, skip + limit);

    const pages = Math.ceil(total / limit);

    return {
      data: puestosPage,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages }
    };
  } catch (error) {
    logger.error('Error fetching puestos list', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching puestos');
  }
}

/**
 * Obtiene estadísticas de puestos
 */
export async function getPuestosStatistics() {
  try {
    logger.info('Fetching puestos statistics');

    const [stats, total] = await Promise.all([
      adminRepository.getPuestosStats(),
      adminRepository.countPuestos({})
    ]);

    const totalMesas = stats.reduce((sum, s) => sum + s.mesasCount, 0);

    return {
      totalPuestos: total,
      totalMesas,
      localities: stats.length,
      estadisticas: stats.sort((a, b) => a._id.localeCompare(b._id)).map(s => ({
        localidad: s._id,
        puestos: s.puestosCount,
        mesas: s.mesasCount
      })),
      averageMesasPerPuesto: total > 0 ? (totalMesas / total).toFixed(2) : 0
    };
  } catch (error) {
    logger.error('Error getting puestos statistics', { error: error.message });
    throw error instanceof AppError ? error : AppError.serverError('Error fetching statistics');
  }
}

export default {
  importPuestos,
  getPuestosList,
  getPuestosStatistics
};
