import { Registration } from '../../../models/Registration.js';
import { Puestos } from '../../../models/Puestos.js';
import { Leader } from '../../../models/Leader.js';
import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';

const logger = createLogger('AdvancedAnalyticsService');

export async function getAdvancedAnalytics(eventId = null) {
  try {
    const matchQuery = eventId ? { eventId } : {};

    // 1. Puesto de votación más concurrido
    const topPuestos = await Registration.aggregate([
      { $match: { ...matchQuery, puestoId: { $ne: null } } },
      { $group: { _id: '$puestoId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'puestos',
          localField: '_id',
          foreignField: '_id',
          as: 'puesto'
        }
      },
      { $unwind: '$puesto' },
      {
        $project: {
          _id: 1,
          count: 1,
          nombre: '$puesto.nombre',
          localidad: '$puesto.localidad'
        }
      }
    ]);

    // 2. Mesa con más votos (dependiendo del puesto)
    const topMesas = await Registration.aggregate([
      { $match: { ...matchQuery, puestoId: { $ne: null }, mesa: { $ne: null } } },
      {
        $group: {
          _id: { puestoId: '$puestoId', mesa: '$mesa' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'puestos',
          localField: '_id.puestoId',
          foreignField: '_id',
          as: 'puesto'
        }
      },
      { $unwind: '$puesto' },
      {
        $project: {
          puestoId: '$_id.puestoId',
          mesa: '$_id.mesa',
          count: 1,
          puestoNombre: '$puesto.nombre',
          localidad: '$puesto.localidad'
        }
      }
    ]);

    // 3. Líder que puso más votos en cada localidad
    const leadersByLocalidad = await Registration.aggregate([
      { $match: { ...matchQuery, localidad: { $ne: null }, localidad: { $ne: '' } } },
      {
        $group: {
          _id: { localidad: '$localidad', leaderId: '$leaderId', leaderName: '$leaderName' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.localidad': 1, count: -1 } },
      {
        $group: {
          _id: '$_id.localidad',
          topLeader: { $first: '$_id.leaderName' },
          topLeaderId: { $first: '$_id.leaderId' },
          maxVotes: { $first: '$count' },
          totalVotesInLocalidad: { $sum: '$count' }
        }
      },
      { $sort: { totalVotesInLocalidad: -1 } }
    ]);

    // 4. Localidad con más votos
    const topLocalidades = await Registration.aggregate([
      { $match: { ...matchQuery, localidad: { $ne: null }, localidad: { $ne: '' } } },
      { $group: { _id: '$localidad', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // 5. Simulación de la campaña
    // Basado en el crecimiento de los últimos 30 días, proyectar los próximos 30 días
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentRegistrations = await Registration.countDocuments({
      ...matchQuery,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const totalRegistrations = await Registration.countDocuments(matchQuery);
    
    // Tasa de crecimiento diario promedio en los últimos 30 días
    const dailyGrowthRate = recentRegistrations / 30;
    
    // Proyección a 30, 60 y 90 días
    const simulation = {
      currentTotal: totalRegistrations,
      dailyGrowthRate: parseFloat(dailyGrowthRate.toFixed(2)),
      projected30Days: Math.round(totalRegistrations + (dailyGrowthRate * 30)),
      projected60Days: Math.round(totalRegistrations + (dailyGrowthRate * 60)),
      projected90Days: Math.round(totalRegistrations + (dailyGrowthRate * 90)),
      confidence: recentRegistrations > 50 ? 'Alta' : (recentRegistrations > 10 ? 'Media' : 'Baja')
    };

    return {
      topPuestos,
      topMesas,
      leadersByLocalidad,
      topLocalidades,
      simulation,
      timestamp: new Date()
    };
  } catch (error) {
    logger.error('Error en advanced analytics', error);
    throw AppError.serverError('Error al obtener analíticas avanzadas');
  }
}

export default {
  getAdvancedAnalytics
};
