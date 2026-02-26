import { Registration } from '../../../models/Registration.js';
import { Puestos } from '../../../models/Puestos.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('AdvancedAnalyticsService');

const BOGOTA_LOCALIDADES = [
  'Usaquén', 'Chapinero', 'Santa Fe', 'San Cristóbal', 'Usme', 'Tunjuelito', 
  'Bosa', 'Kennedy', 'Fontibón', 'Engativá', 'Suba', 'Barrios Unidos', 
  'Teusaquillo', 'Los Mártires', 'Antonio Nariño', 'Puente Aranda', 
  'La Candelaria', 'Rafael Uribe Uribe', 'Ciudad Bolívar', 'Sumapaz'
];

// Helper para determinar si es Bogotá
const isBogota = (departamento, localidad) => {
  if (departamento && (departamento.toUpperCase().includes('BOGOT') || departamento.toUpperCase() === 'CUNDINAMARCA')) {
    if (BOGOTA_LOCALIDADES.some(l => localidad && localidad.toUpperCase() === l.toUpperCase())) return true;
  }
  if (BOGOTA_LOCALIDADES.some(l => localidad && localidad.toUpperCase() === l.toUpperCase())) return true;
  return false;
};

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
    
    const puestoCiudad = normalize(puesto.ciudad || 'bogotá');
    const puestoDepto = normalize(puesto.departamento || 'bogotá d.c.');
    const puestoLoc = normalize(puesto.localidad);

    const isPuestoBogota = puestoCiudad.includes('bogot') || BOGOTA_LOCALIDADES.some(l => l.toLowerCase() === puestoLoc);
    
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
        reg.capital = 'Bogotá';
        reg.departamento = 'Bogotá D.C.';
      } else {
        reg.capital = puesto.ciudad || reg.capital;
        reg.departamento = puesto.departamento || reg.departamento;
      }
      reg.localidad = puesto.localidad;
      reg.verificadoAuto = true;
      autoCorrected = true;
      message = 'Datos corregidos automáticamente';
    } else if (score >= 60) {
      reg.localidad = puesto.localidad;
      reg.necesitaRevision = true;
      needsReview = true;
      message = 'Datos parcialmente corregidos. Requiere revisión manual.';
    } else {
      reg.inconsistenciaGrave = true;
      message = 'Inconsistencia detectada. Revisión obligatoria.';
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
    logger.info(`Iniciando verificación global de matching... Evento: ${eventId || 'Todos'}`);
    
    const baseQuery = eventId ? { eventId } : {};
    
    // 1. Intentar asignar puestoId a los que no tienen
    const unassignedQuery = { ...baseQuery, puestoId: null, votingPlace: { $ne: null, $ne: '' } };
    const unassignedRegistrations = await Registration.find(unassignedQuery);
    let matchedCount = 0;
    
    // Procesar en lotes
    const unassignedBatchSize = 50;
    for (let i = 0; i < unassignedRegistrations.length; i += unassignedBatchSize) {
      const batch = unassignedRegistrations.slice(i, i + unassignedBatchSize);
      await Promise.all(batch.map(async (reg) => {
        const safeString = reg.votingPlace.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    
    // 2. Ejecutar validación inteligente para todos los que tienen puestoId
    const assignedQuery = { ...baseQuery, puestoId: { $ne: null } };
    const assignedRegistrations = await Registration.find(assignedQuery).populate('puestoId');
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
    
    logger.info(`Verificación global completada. ${matchedCount} puestos asignados. ${autoCorrectedCount} autocorregidos, ${needsReviewCount} para revisión, ${severeInconsistencyCount} inconsistencias graves.`);
    
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
    logger.error('Error en verificación global', error);
    throw AppError.serverError('Error al ejecutar verificación global');
  }
}

export async function getAdvancedAnalytics(eventId = null, status = 'all') {
  try {
    const matchQuery = eventId ? { eventId } : {};
    
    if (status === 'confirmed') {
      matchQuery.puestoId = { $ne: null };
    } else if (status === 'unconfirmed') {
      matchQuery.puestoId = null;
    }

    const registrations = await Registration.aggregate([
      { $match: { ...matchQuery } },
      {
        $lookup: {
          from: 'puestos',
          localField: 'puestoId',
          foreignField: '_id',
          as: 'puesto'
        }
      },
      {
        $addFields: {
          puesto: { $arrayElemAt: ['$puesto', 0] }
        }
      }
    ]);

    const data = {
      bogota: { topPuestos: {}, topMesas: {}, leadersByLocalidad: {}, topLocalidades: {} },
      nacional: { topPuestos: {}, topMesas: {}, leadersByLocalidad: {}, topLocalidades: {} }
    };

    registrations.forEach(reg => {
      const isBogotaRegion = isBogota(reg.departamento, reg.puesto?.localidad || reg.localidad);
      const region = isBogotaRegion ? 'bogota' : 'nacional';
      const loc = reg.puesto?.localidad || reg.localidad || 'Desconocida';
      const puestoName = reg.puesto?.nombre || 'Sin Puesto Asignado';
      const mesa = reg.mesa || reg.votingTable || 'Sin Mesa';
      const leader = reg.leaderName || 'Desconocido';

      if (!data[region].topPuestos[puestoName]) data[region].topPuestos[puestoName] = { count: 0, localidad: loc };
      data[region].topPuestos[puestoName].count++;

      if (!data[region].topMesas[loc]) data[region].topMesas[loc] = {};
      if (!data[region].topMesas[loc][puestoName]) data[region].topMesas[loc][puestoName] = {};
      if (!data[region].topMesas[loc][puestoName][mesa]) data[region].topMesas[loc][puestoName][mesa] = 0;
      data[region].topMesas[loc][puestoName][mesa]++;

      if (!data[region].leadersByLocalidad[loc]) data[region].leadersByLocalidad[loc] = {};
      if (!data[region].leadersByLocalidad[loc][leader]) data[region].leadersByLocalidad[loc][leader] = 0;
      data[region].leadersByLocalidad[loc][leader]++;

      if (!data[region].topLocalidades[loc]) data[region].topLocalidades[loc] = 0;
      data[region].topLocalidades[loc]++;
    });

    const formatRegionData = (regionData) => {
      const topPuestosArr = Object.entries(regionData.topPuestos)
        .filter(([nombre]) => nombre !== 'Sin Puesto Asignado')
        .map(([nombre, info]) => ({ _id: nombre, totalVotos: info.count, localidad: info.localidad }))
        .sort((a, b) => b.totalVotos - a.totalVotos)
        .slice(0, 15);

      const topLocalidadesArr = Object.entries(regionData.topLocalidades)
        .map(([nombre, count]) => ({ _id: nombre, totalVotos: count }))
        .sort((a, b) => b.totalVotos - a.totalVotos);

      const leadersArr = Object.entries(regionData.leadersByLocalidad).map(([loc, leaders]) => {
        return Object.entries(leaders).map(([name, count]) => ({ liderNombre: name, totalVotos: count }));
      }).flat();
      
      // Sumar votos del mismo líder en diferentes localidades
      const leaderTotals = {};
      for (const leader of leadersArr) {
        const name = leader.liderNombre.trim().toUpperCase(); // Normalizar nombre
        if (!leaderTotals[name]) {
          leaderTotals[name] = { liderNombre: leader.liderNombre, totalVotos: 0 };
        }
        leaderTotals[name].totalVotos += leader.totalVotos;
      }
      
      const uniqueLeaders = Object.values(leaderTotals).sort((a, b) => b.totalVotos - a.totalVotos);

      const jerarquia = Object.entries(regionData.topMesas).map(([localidad, puestos]) => {
        const puestosArr = Object.entries(puestos).map(([puesto, mesas]) => {
          const mesasArr = Object.entries(mesas).map(([mesa, count]) => ({
            mesa,
            totalVotos: count
          })).sort((a, b) => b.totalVotos - a.totalVotos);
          
          const totalPuesto = mesasArr.reduce((sum, m) => sum + m.totalVotos, 0);
          
          return {
            puesto,
            totalVotos: totalPuesto,
            mesas: mesasArr
          };
        }).sort((a, b) => b.totalVotos - a.totalVotos);
        
        const totalLocalidad = puestosArr.reduce((sum, p) => sum + p.totalVotos, 0);
        
        return {
          localidad,
          totalVotos: totalLocalidad,
          puestos: puestosArr
        };
      }).sort((a, b) => b.totalVotos - a.totalVotos);

      const totalVotos = topLocalidadesArr.reduce((sum, loc) => sum + loc.totalVotos, 0);

      return {
        totalVotos,
        topPuestos: topPuestosArr,
        topLocalidades: topLocalidadesArr,
        topLideres: uniqueLeaders,
        jerarquia
      };
    };

    return {
      bogota: formatRegionData(data.bogota),
      nacional: formatRegionData(data.nacional),
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Error en advanced analytics', error);
    throw AppError.serverError('Error al obtener analíticas avanzadas');
  }
}

export async function getSimulationData(eventId = null) {
  try {
    const matchQuery = eventId ? { eventId } : {};
    
    const totalRegistrations = await Registration.countDocuments(matchQuery);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRegistrations = await Registration.countDocuments({
      ...matchQuery,
      createdAt: { $gte: thirtyDaysAgo }
    });
    const dailyGrowthRate = recentRegistrations / 30;

    const topLocAgg = await Registration.aggregate([
      { $match: { ...matchQuery, localidad: { $ne: null, $ne: '' } } },
      { $group: { _id: '$localidad', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const topMesaAgg = await Registration.aggregate([
      { $match: { ...matchQuery, puestoId: { $ne: null }, mesa: { $ne: null } } },
      { $group: { _id: { puestoId: '$puestoId', mesa: '$mesa' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'puestos', localField: '_id.puestoId', foreignField: '_id', as: 'puesto' } },
      { $unwind: '$puesto' }
    ]);

    const top5Locs = await Registration.aggregate([
      { $match: { ...matchQuery, localidad: { $ne: null, $ne: '' } } },
      { $group: { _id: '$localidad', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    const top5LocNames = top5Locs.map(l => l._id);

    const topLeaderAgg = await Registration.aggregate([
      { $match: { ...matchQuery, localidad: { $in: top5LocNames }, leaderName: { $ne: null } } },
      { $group: { _id: '$leaderName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    return {
      currentTotal: totalRegistrations,
      dailyGrowthRate: Math.round(dailyGrowthRate),
      projection30Days: Math.round(totalRegistrations + (dailyGrowthRate * 30)),
      projection60Days: Math.round(totalRegistrations + (dailyGrowthRate * 60)),
      projectedTotal: Math.round(totalRegistrations + (dailyGrowthRate * 60)),
      topLocalidad: topLocAgg[0]?._id || 'Desconocida',
      topPuesto: topMesaAgg[0]?.puesto?.nombre || 'Desconocido',
      topMesa: topMesaAgg[0]?._id?.mesa || 'N/A',
      topLeader: topLeaderAgg[0]?._id || 'Desconocido',
      topLeaderVotes: topLeaderAgg[0]?.count || 0
    };
  } catch (error) {
    logger.error('Error en simulation data', error);
    throw AppError.serverError('Error al obtener datos de simulación');
  }
}

export async function getLeaderPerformance(eventId = null) {
  try {
    const matchQuery = eventId ? { eventId } : {};

    // 1. Agrupación general por líder para calcular métricas
    const leaderStats = await Registration.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$leaderId',
          leaderName: { $first: '$leaderName' },
          totalRegistros: { $sum: 1 },
          errores: {
            $sum: {
              $cond: [{ $or: ['$necesitaRevision', '$inconsistenciaGrave'] }, 1, 0]
            }
          },
          inconsistenciasGraves: {
            $sum: { $cond: ['$inconsistenciaGrave', 1, 0] }
          },
          importaciones: {
            $sum: { $cond: ['$importado', 1, 0] }
          },
          verificaciones: {
            $sum: { $cond: ['$verificadoAuto', 1, 0] }
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

    // Ordenar y extraer top 10 para cada categoría
    const topErrores = [...leaderStats].sort((a, b) => b.errores - a.errores).slice(0, 10);
    const topImportaciones = [...leaderStats].sort((a, b) => b.importaciones - a.importaciones).slice(0, 10);
    const topVerificaciones = [...leaderStats].sort((a, b) => b.verificaciones - a.verificaciones).slice(0, 10);
    const peorDesempeno = [...leaderStats].sort((a, b) => a.performanceScore - b.performanceScore).slice(0, 10);
    const rankingGeneral = [...leaderStats].sort((a, b) => b.performanceScore - a.performanceScore);

    // 2. Agrupación por localidad y líder
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
    throw AppError.serverError('Error al obtener rendimiento de líderes');
  }
}

export default {
  getAdvancedAnalytics,
  getSimulationData,
  runGlobalVerification,
  validateAndFixLocation,
  getLeaderPerformance
};
