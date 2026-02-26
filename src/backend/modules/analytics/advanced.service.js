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

export async function runGlobalVerification() {
  try {
    logger.info('Iniciando verificación global de matching...');
    const registrations = await Registration.find({ puestoId: null, votingPlace: { $ne: null, $ne: '' } });
    
    let matchedCount = 0;
    for (const reg of registrations) {
      const searchRegex = new RegExp(reg.votingPlace.trim(), 'i');
      const puesto = await Puestos.findOne({
        $or: [
          { nombre: searchRegex },
          { aliases: searchRegex }
        ]
      });

      if (puesto) {
        reg.puestoId = puesto._id;
        if (!reg.mesa && reg.votingTable) {
          const mesaMatch = reg.votingTable.match(/\d+/);
          if (mesaMatch) reg.mesa = parseInt(mesaMatch[0], 10);
        }
        await reg.save();
        matchedCount++;
      }
    }
    
    logger.info(`Verificación global completada. ${matchedCount} registros actualizados.`);
    return { success: true, matchedCount, totalChecked: registrations.length };
  } catch (error) {
    logger.error('Error en verificación global', error);
    throw AppError.serverError('Error al ejecutar verificación global');
  }
}

export async function getAdvancedAnalytics(eventId = null) {
  try {
    const matchQuery = eventId ? { eventId } : {};

    const registrations = await Registration.aggregate([
      { $match: { ...matchQuery, puestoId: { $ne: null } } },
      {
        $lookup: {
          from: 'puestos',
          localField: 'puestoId',
          foreignField: '_id',
          as: 'puesto'
        }
      },
      { $unwind: '$puesto' }
    ]);

    const data = {
      bogota: { topPuestos: {}, topMesas: {}, leadersByLocalidad: {}, topLocalidades: {} },
      nacional: { topPuestos: {}, topMesas: {}, leadersByLocalidad: {}, topLocalidades: {} }
    };

    registrations.forEach(reg => {
      const region = isBogota(reg.departamento, reg.puesto.localidad) ? 'bogota' : 'nacional';
      const loc = reg.puesto.localidad || 'Desconocida';
      const puestoName = reg.puesto.nombre;
      const mesa = reg.mesa || 'Sin Mesa';
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
        .map(([nombre, info]) => ({ nombre, count: info.count, localidad: info.localidad }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const topLocalidadesArr = Object.entries(regionData.topLocalidades)
        .map(([nombre, count]) => ({ _id: nombre, count }))
        .sort((a, b) => b.count - a.count);

      const leadersArr = Object.entries(regionData.leadersByLocalidad).map(([loc, leaders]) => {
        const sortedLeaders = Object.entries(leaders)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        return {
          localidad: loc,
          topLeader: sortedLeaders[0]?.name,
          maxVotes: sortedLeaders[0]?.count,
          allLeaders: sortedLeaders
        };
      }).sort((a, b) => b.maxVotes - a.maxVotes);

      return {
        topPuestos: topPuestosArr,
        topMesas: regionData.topMesas,
        leadersByLocalidad: leadersArr,
        topLocalidades: topLocalidadesArr
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

export default {
  getAdvancedAnalytics,
  getSimulationData,
  runGlobalVerification
};
