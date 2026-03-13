import { Registration } from '../../../models/Registration.js';
import { Puestos } from '../../../models/Puestos.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import { applyCleanAnalyticsFilter } from '../../../shared/analyticsFilter.js';
import {
  canonicalizeBogotaLocality,
  isBogotaTerritory,
  normalizeTerritoryText
} from '../../../shared/territoryNormalization.js';
import votingHierarchyService from '../../../services/votingHierarchy.service.js';
import campaignSimulationService from '../../../services/campaign-simulation.service.js';

const logger = createLogger('AdvancedAnalyticsService');

function canonicalTerritoryLabel(rawLocation, fallbackDepartment) {
  const canonicalBogota = canonicalizeBogotaLocality(rawLocation);
  if (canonicalBogota) return canonicalBogota;

  const normalizedRaw = normalizeTerritoryText(rawLocation);
  if (normalizedRaw) return rawLocation.toString().trim();

  const normalizedDepartment = normalizeTerritoryText(fallbackDepartment);
  if (normalizedDepartment) return fallbackDepartment.toString().trim();

  return 'Sin Localidad';
}

export async function validateAndFixLocation(registrationId, providedReg = null, providedPuesto = null) {
  try {
    const reg = providedReg || await Registration.findById(registrationId);
    if (!reg) throw new Error('Registro no encontrado');
    
    if (!reg.puestoId) {
      return {
        success: false,
        score: 0,
        autoCorrected: false,
        needsReview: false,
        message: 'No tiene puesto asignado'
      };
    }

    const puesto = providedPuesto || await Puestos.findById(reg.puestoId);
    if (!puesto) throw new Error('Puesto no encontrado');

    let score = 40; // Coincidencia de puestoId
    
    const normalize = (str) => str ? str.toString().trim().toLowerCase() : '';
    
    const regCiudad = normalize(reg.capital);
    const regDepto = normalize(reg.departamento);
    const regLoc = normalize(reg.localidad);
    
    const puestoCiudad = normalize(puesto.ciudad || 'bogotÃ¡');
    const puestoDepto = normalize(puesto.departamento || 'bogotÃ¡ d.c.');
    const puestoLoc = normalize(puesto.localidad);

    const isPuestoBogota = isBogotaTerritory({
      localidad: reg.localidad,
      departamento: reg.departamento,
      capital: reg.capital,
      puestoLocalidad: puesto.localidad,
      puestoCiudad: puesto.ciudad,
      puestoDepartamento: puesto.departamento
    });
    
    // Coincidencia de ciudad -> 20%
    if (regCiudad === puestoCiudad || (isPuestoBogota && regCiudad.includes('bogot'))) score += 20;
    
    // Coincidencia de departamento -> 20%
    if (regDepto === puestoDepto || (isPuestoBogota && (regDepto.includes('bogot') || regDepto.includes('cundinamarca')))) score += 20;
    
    // Coincidencia de localidad -> 20%
    if (regLoc === puestoLoc) score += 20;

    let autoCorrected = false;
    let needsReview = false;
    let message = '';

    reg.verificadoAuto = false;
    reg.necesitaRevision = false;
    reg.inconsistenciaGrave = false;

    if (score >= 80) {
      if (isPuestoBogota) {
        reg.capital = 'BogotÃ¡';
        reg.departamento = 'BogotÃ¡ D.C.';
      } else {
        reg.capital = puesto.ciudad || reg.capital;
        reg.departamento = puesto.departamento || reg.departamento;
      }
      reg.localidad = puesto.localidad;
      reg.verificadoAuto = true;
      autoCorrected = true;
      message = 'Datos corregidos automÃ¡ticamente';
    } else if (score >= 60) {
      reg.localidad = puesto.localidad;
      reg.necesitaRevision = true;
      needsReview = true;
      message = 'Datos parcialmente corregidos. Requiere revisiÃ³n manual.';
    } else {
      reg.inconsistenciaGrave = true;
      message = 'Inconsistencia detectada. RevisiÃ³n obligatoria.';
    }

    await reg.save();

    return {
      success: true,
      score,
      autoCorrected,
      needsReview,
      message
    };

  } catch (error) {
    logger.error(`Error en validateAndFixLocation para ${registrationId}:`, error);
    return {
      success: false,
      score: 0,
      autoCorrected: false,
      needsReview: false,
      message: error.message
    };
  }
}

export async function runGlobalVerification(eventId = null) {
  try {
    logger.info(`Iniciando verificaciÃ³n global de matching... Evento: ${eventId || 'Todos'}`);
    
    const baseQuery = eventId ? { eventId } : {};
    
    // 1. Intentar asignar puestoId a los que no tienen
    const unassignedQuery = { 
      ...baseQuery, 
      puestoId: null, 
      votingPlace: { $nin: [null, ''] }
    };
    // Fetch limited registrations to prevent crashing on millions row DBs
    const unassignedRegistrations = await Registration.find(unassignedQuery).limit(5000);
    let matchedCount = 0;
    
    // Procesar en lotes
    const unassignedBatchSize = 50;
    for (let i = 0; i < unassignedRegistrations.length; i += unassignedBatchSize) {
      const batch = unassignedRegistrations.slice(i, i + unassignedBatchSize);
      await Promise.all(batch.map(async (reg) => {
        const votingStr = (reg.votingPlace || '').toString().trim();
        if(!votingStr) return; // safeguard

        const safeString = votingStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(safeString, 'i');
        
        const puesto = await Puestos.findOne({
          $or: [
            { nombre: searchRegex },
            { aliases: searchRegex }
          ]
        });

        if (puesto) {
          reg.puestoId = puesto._id;
          if (!reg.mesa && reg.votingTable) {
            const mesaMatch = String(reg.votingTable).match(/\d+/);
            if (mesaMatch) reg.mesa = parseInt(mesaMatch[0], 10);
          }
          await reg.save();
          matchedCount++;
        }
      }));
    }
    
    // 2. Ejecutar validaciÃ³n inteligente para todos los que tienen puestoId
    const assignedQuery = { ...baseQuery, puestoId: { $ne: null } };
    const assignedRegistrations = await Registration.find(assignedQuery).populate('puestoId').limit(5000);
    let autoCorrectedCount = 0;
    let needsReviewCount = 0;
    let severeInconsistencyCount = 0;

    // Procesar en lotes para evitar timeouts
    const batchSize = 50;
    for (let i = 0; i < assignedRegistrations.length; i += batchSize) {
      const batch = assignedRegistrations.slice(i, i + batchSize);
      await Promise.all(batch.map(async (reg) => {
        const puesto = reg.puestoId;
        if (!puesto) return;
        
        const result = await validateAndFixLocation(reg._id, reg, puesto);
        if (result.success) {
          if (result.autoCorrected) autoCorrectedCount++;
          else if (result.needsReview) needsReviewCount++;
          else severeInconsistencyCount++;
        }
      }));
    }
    
    logger.info(`VerificaciÃ³n global completada. ${matchedCount} puestos asignados. ${autoCorrectedCount} autocorregidos, ${needsReviewCount} para revisiÃ³n, ${severeInconsistencyCount} inconsistencias graves.`);
    
    return { 
      success: true, 
      data: { 
        processed: unassignedRegistrations.length + assignedRegistrations.length, 
        assigned: matchedCount,
        autoCorrected: autoCorrectedCount,
        needsReview: needsReviewCount,
        severeInconsistency: severeInconsistencyCount,
        errors: 0 
      } 
    };
  } catch (error) {
    logger.error('Error en verificaciÃ³n global:', error);
    throw AppError.serverError('Error al ejecutar verificaciÃ³n global: ' + (error.message || 'Desconocido'));
  }
}

export async function getAdvancedAnalytics(eventId = null, status = 'all', leaderId = null, region = 'all', includeHierarchy = true) {
  try {
    const response = await votingHierarchyService.getAnalyticsTree({
      eventId,
      status,
      leaderId,
      region,
      includeHierarchy,
      includeInvalidData: false
    });

    logger.info('[ADV TRACE] advanced analytics computed', {
      eventId: eventId || null,
      status: status || 'all',
      leaderId: leaderId || null,
      totalRaw: response.summary.totalRaw,
      totalClean: response.summary.totalClean,
      allLocalityBreakdownTotal: response.all?.localityBreakdownTotal || 0,
      excluded: response.all?.excluded || {}
    });

    return response;
  } catch (error) {
    logger.error('Error en advanced analytics', error);
    throw AppError.serverError('Error al obtener analÃ­ticas avanzadas');
  }
}

export async function getAdvancedSummaryAnalytics(eventId = null, status = 'all', leaderId = null, region = 'all', includeCharts = true) {
  try {
    return await votingHierarchyService.getOfficialAnalyticsSummary({
      eventId,
      status,
      leaderId,
      region
    }, {
      includeCharts
    });
  } catch (error) {
    logger.error('Error en advanced summary analytics', error);
    throw AppError.serverError('Error al obtener resumen oficial de analíticas avanzadas');
  }
}

export async function getAdvancedChartsAnalytics(eventId = null, status = 'all', leaderId = null, region = 'all') {
  try {
    return await votingHierarchyService.getOfficialAnalyticsCharts({
      eventId,
      status,
      leaderId,
      region
    });
  } catch (error) {
    logger.error('Error en advanced charts analytics', error);
    throw AppError.serverError('Error al obtener charts oficiales de analiticas avanzadas');
  }
}

export async function getHierarchyLocalidades(filters = {}, options = {}) {
  try {
    return await votingHierarchyService.getOfficialLocalidadesSummary(filters, options);
  } catch (error) {
    logger.error('Error en hierarchy localidades', error);
    throw AppError.serverError('Error al obtener resumen de localidades');
  }
}

export async function getHierarchyPuestosByLocalidad(localidadId, filters = {}, options = {}) {
  try {
    return await votingHierarchyService.getOfficialPuestosByLocalidad(localidadId, filters, options);
  } catch (error) {
    logger.error('Error en hierarchy puestos', error);
    throw AppError.serverError('Error al obtener puestos por localidad');
  }
}

export async function getHierarchyMesasByPuesto(puestoId, filters = {}, options = {}) {
  try {
    return await votingHierarchyService.getOfficialMesasByPuesto(puestoId, filters, options);
  } catch (error) {
    logger.error('Error en hierarchy mesas', error);
    throw AppError.serverError('Error al obtener mesas por puesto');
  }
}

export async function getInvalidDataAnalytics(filters = {}, options = {}) {
  try {
    return await votingHierarchyService.getInvalidDataPage(filters, options);
  } catch (error) {
    logger.error('Error en invalid analytics', error);
    throw AppError.serverError('Error al obtener datos erróneos o incompletos');
  }
}

export async function getInvalidDataDetail(registrationId, options = {}) {
  try {
    return await votingHierarchyService.getInvalidDataDetail(registrationId, options);
  } catch (error) {
    logger.error('Error en invalid analytics detail', error);
    throw AppError.serverError('Error al obtener detalle de dato erróneo o incompleto');
  }
}

export async function getSimulationData(eventId = null, targetDateStr = null) {
    try {
      const scenario = await campaignSimulationService.runScenario({
        eventId,
        targetDate: targetDateStr || '2026-03-05',
        scenarioType: 'moderado',
        includeInvalidRecovery: true
      });
      return {
        ...scenario,
        currentTotal: Number(scenario?.summary?.currentTotal || 0),
        projectedTotal: Number(scenario?.summary?.simulatedTotal || 0),
        topLocalidad: scenario?.highlights?.topLocalidad?.name || 'Sin Localidad',
        topLocalidadVotes: Number(scenario?.highlights?.topLocalidad?.simulatedVotes || 0),
        topPuesto: 'Escenario oficial',
        topPuestoVotes: 0,
        topMesa: 'N/A',
        topLeader: scenario?.highlights?.topLeader?.name || 'Sin lider',
        topLeaderVotes: Number(scenario?.highlights?.topLeader?.simulatedVotes || 0),
        dailyGrowthRate: Number(scenario?.assumptions?.growthOfficialPercent || 0),
        daysRemaining: Number(scenario?.assumptions?.daysToTarget || 0),
        projection30Days: Number(scenario?.summary?.simulatedTotal || 0),
        projection60Days: Number(scenario?.summary?.simulatedTotal || 0)
      };
  } catch (error) {
    logger.error('Error en simulation data', error);
    throw AppError.serverError('Error al obtener datos de simulaciÃ³n');
  }
}

export async function getSimulationBaseData(filters = {}, options = {}) {
  try {
    return await campaignSimulationService.buildBaseScenario(filters, options);
  } catch (error) {
    logger.error('Error en simulation base', error);
    throw AppError.serverError('Error al obtener base de simulacion');
  }
}

export async function runCampaignSimulation(payload = {}, options = {}) {
  try {
    return await campaignSimulationService.runScenario(payload, options);
  } catch (error) {
    logger.error('Error en simulation run', error);
    throw AppError.serverError('Error al ejecutar simulacion');
  }
}

export async function getLeaderPerformance(eventId = null) {
  try {
    const matchQuery = eventId ? { eventId } : {};
    matchQuery.dataIntegrityStatus = { $ne: 'invalid' };

    // 1. AgrupaciÃ³n general por lÃ­der para calcular mÃ©tricas
    const leaderStats = await Registration.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$leaderId',
          leaderName: { $first: '$leaderName' },
          totalRegistros: { $sum: 1 },
          errores: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$requiereRevisionPuesto', true] },
                    { $eq: ['$necesitaRevision', true] },
                    { $eq: ['$inconsistenciaGrave', true] }
                  ]
                },
                1,
                0
              ]
            }
          },
          inconsistenciasGraves: {
            $sum: { $cond: [{ $eq: ['$inconsistenciaGrave', true] }, 1, 0] }
          },
          importaciones: {
            $sum: { $cond: [{ $eq: ['$importado', true] }, 1, 0] }
          },
          verificaciones: {
            $sum: { $cond: [{ $eq: ['$verificadoAuto', true] }, 1, 0] }
          },
          revisionPuesto: {
            $sum: { $cond: [{ $eq: ['$requiereRevisionPuesto', true] }, 1, 0] }
          },
          sinTelefono: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $eq: ['$phone', null] },
                    { $eq: ['$phone', ''] },
                    { $not: ['$phone'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          performanceScore: {
            $add: [
              { $multiply: ['$totalRegistros', 1] },
              { $multiply: ['$errores', -2] },
              { $multiply: ['$inconsistenciasGraves', -3] },
              { $multiply: ['$verificaciones', 2] }
            ]
          }
        }
      }
    ]);

    // Ordenar y extraer top 10 para cada categorÃ­a
    const topErrores = [...leaderStats].sort((a, b) => b.errores - a.errores).slice(0, 10);
    const topImportaciones = [...leaderStats].sort((a, b) => b.importaciones - a.importaciones).slice(0, 10);
    const topVerificaciones = [...leaderStats].sort((a, b) => b.verificaciones - a.verificaciones).slice(0, 10);
    const peorDesempeno = [...leaderStats].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, 10);
    const rankingGeneral = [...leaderStats].sort((a, b) => b.performanceScore - a.performanceScore);

    // 2. AgrupaciÃ³n por localidad y lÃ­der
    const locLeaderStats = await Registration.aggregate([
      { $match: { ...matchQuery, localidad: { $ne: null, $ne: '' } } },
      {
        $group: {
          _id: { localidad: '$localidad', leaderId: '$leaderId' },
          leaderName: { $first: '$leaderName' },
          totalRegistros: { $sum: 1 }
        }
      },
      { $sort: { '_id.localidad': 1, totalRegistros: -1 } },
      {
        $group: {
          _id: '$_id.localidad',
          topLeader: { $first: '$leaderName' },
          totalRegistros: { $first: '$totalRegistros' }
        }
      },
      {
        $project: {
          _id: 0,
          localidad: '$_id',
          topLeader: 1,
          totalRegistros: 1
        }
      },
      { $sort: { totalRegistros: -1 } }
    ]);

    return {
      topErrores,
      topImportaciones,
      topVerificaciones,
      peorDesempeno,
      rankingGeneral,
      topPorLocalidad: locLeaderStats
    };
  } catch (error) {
    logger.error('Error en getLeaderPerformance', error);
    throw AppError.serverError('Error al obtener rendimiento de lÃ­deres');
  }
}

export default {
  getAdvancedSummaryAnalytics,
  getAdvancedChartsAnalytics,
  getHierarchyLocalidades,
  getHierarchyPuestosByLocalidad,
  getHierarchyMesasByPuesto,
  getAdvancedAnalytics,
  getInvalidDataAnalytics,
  getInvalidDataDetail,
  getSimulationData,
  getSimulationBaseData,
  runCampaignSimulation,
  runGlobalVerification,
  validateAndFixLocation,
  getLeaderPerformance
};

