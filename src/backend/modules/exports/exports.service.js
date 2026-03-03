/**
 * Exports Service
 * Lógica de negocio para exportación de datos
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import exportsRepository from './exports.repository.js';
import ExcelJS from 'exceljs';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import analyticsService from '../analytics/analytics.service.js';
import advancedService from '../analytics/advanced.service.js';
import { Registration } from '../../../models/Registration.js';
import { Event } from '../../../models/Event.js';

const logger = createLogger('ExportsService');

/**
 * Exporta registraciones a CSV
 */
export async function exportRegistrationsCSV(eventId = null) {
  try {
    logger.info('Generando export registraciones CSV', { eventId });

    const registrations = await exportsRepository.getRegistrationsForExport(eventId);

    // Convertir a CSV
    let csv = 'Cédula,Nombre,Apellido,Puesto,Localidad,Líder,Email,Fecha\n';
    
    for (const reg of registrations) {
      const row = [
        reg.cedula,
        reg.nombre,
        reg.apellido,
        reg.puestoId?.numero || '',
        reg.puestoId?.localidad || '',
        reg.leaderId?.name || '',
        reg.leaderId?.email || '',
        new Date(reg.createdAt).toLocaleDateString()
      ];
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    }

    logger.success('CSV generado', { rows: registrations.length });
    return csv;
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error generando CSV', error);
    throw AppError.serverError('Error al generar CSV');
  }
}

/**
 * Exporta registraciones a Excel
 */
export async function exportRegistrationsExcel(eventId = null) {
  try {
    logger.info('Generando export registraciones Excel', { eventId });

    const registrations = await exportsRepository.getRegistrationsForExport(eventId);

    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registraciones');

    // Headers
    worksheet.columns = [
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Puesto', key: 'puesto', width: 10 },
      { header: 'Localidad', key: 'localidad', width: 20 },
      { header: 'Líder', key: 'lider', width: 20 },
      { header: 'Email Líder', key: 'email', width: 25 },
      { header: 'Fecha Registro', key: 'fecha', width: 15 }
    ];

    // Agregar datos
    for (const reg of registrations) {
      worksheet.addRow({
        cedula: reg.cedula,
        nombre: reg.nombre,
        apellido: reg.apellido,
        puesto: reg.puestoId?.numero || '',
        localidad: reg.puestoId?.localidad || '',
        lider: reg.leaderId?.name || '',
        email: reg.leaderId?.email || '',
        fecha: new Date(reg.createdAt).toLocaleDateString()
      });
    }

    // Estilos
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

    const buffer = await workbook.xlsx.writeBuffer();
    logger.success('Excel generado', { rows: registrations.length });
    return buffer;
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error generando Excel', error);
    throw AppError.serverError('Error al generar Excel');
  }
}

/**
 * Exporta líderes a Excel
 */
export async function exportLeadersExcel() {
  try {
    logger.info('Generando export líderes Excel');

    const leaders = await exportsRepository.getLeadersForExport();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Líderes');

    worksheet.columns = [
      { header: 'Nombre', key: 'name', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Cédula', key: 'cedula', width: 15 },
      { header: 'Especialidad', key: 'specialty', width: 20 },
      { header: 'Evento Asignado', key: 'eventId', width: 25 },
      { header: 'Fecha Creación', key: 'createdAt', width: 15 }
    ];

    for (const leader of leaders) {
      worksheet.addRow({
        name: leader.name,
        email: leader.email,
        cedula: leader.cedula,
        specialty: leader.specialty || '',
        eventId: leader.assignedEventId || 'No asignado',
        createdAt: new Date(leader.createdAt).toLocaleDateString()
      });
    }

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

    const buffer = await workbook.xlsx.writeBuffer();
    logger.success('Excel líderes generado', { rows: leaders.length });
    return buffer;
  } catch (error) {
    if (error.isOperational) throw error;
    logger.error('Error generando Excel líderes', error);
    throw AppError.serverError('Error al generar Excel');
  }
}

/**
 * Genera código QR para un puesto
 */
export async function generatePuestoQR(puestoId) {
  try {
    logger.info('Generando QR para puesto', { puestoId });

    // Datos del QR: URL del puesto
    const qrData = {
      puesto_id: puestoId,
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/puesto/${puestoId}`,
      timestamp: new Date().toISOString()
    };

    const qrString = JSON.stringify(qrData);
    const qrCode = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1
    });

    logger.success('QR generado', { puestoId });
    return qrCode;
  } catch (error) {
    logger.error('Error generando QR', error);
    throw AppError.serverError('Error al generar QR');
  }
}

/**
 * Helper to fetch chart image from QuickChart
 */
async function getQuickChartImage(chartConfig, width = 600, height = 350) {
  try {
    const url = `https://quickchart.io/chart?width=${width}&height=${height}&bkg=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    logger.warn('Error fetching QuickChart image:', error.message);
    return null;
  }
}

/**
 * Helper to get explicit geo data from Registrations directly
 */
async function getEventGeoAnalytics(eventId) {
    if (!eventId) return { topDepts: [], topLocs: [] };
    try {
        const topDepts = await Registration.aggregate([
            { $match: { eventId: eventId, departamento: { $type: "string", $ne: "" } } },
            { $group: { _id: '$departamento', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);

        const topLocs = await Registration.aggregate([
            { $match: { eventId: eventId, localidad: { $type: "string", $ne: "" } } },
            { $group: { _id: '$localidad', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 6 }
        ]);

        return { topDepts, topLocs };
    } catch(e) {
        logger.warn('Failed to aggregate geodata for PDF', e);
        return { topDepts: [], topLocs: [] };
    }
}

/**
 * Genera reporte PDF (Estilo PPT Ejecutivo - Multi Pagina)
 */
export async function generateReportPDF(options = {}) {
  try {
    const {
      eventId = null,
      status = 'all',
      leaderId = null,
      targetDate = null,
      region = 'nacional'
    } = options || {};

    logger.info('Generando reporte PDF profesional', { eventId, status, leaderId, targetDate, region });

    let activeEventId = eventId;
    let eventName = 'Evento Global';
    if (!activeEventId) {
      const activeEvent = await Event.findOne({ status: 'active' }).lean();
      if (activeEvent) {
        activeEventId = activeEvent._id.toString();
        eventName = activeEvent.name || 'Evento Activo';
      }
    } else {
      const ev = await Event.findById(activeEventId).lean();
      if (ev) eventName = ev.name || 'Evento';
    }

    const regionKey = String(region || 'nacional').toLowerCase() === 'bogota' ? 'bogota' : 'nacional';
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const [dashboard, leaderPerf, advancedData, simulationData, trendData] = await Promise.all([
      analyticsService.getDashboardSummary(activeEventId),
      advancedService.getLeaderPerformance(activeEventId),
      advancedService.getAdvancedAnalytics(activeEventId, status, leaderId),
      advancedService.getSimulationData(activeEventId, targetDate),
      analyticsService.getTrendAnalysis(startDateStr, endDateStr, activeEventId)
    ]);

    const summary = dashboard?.summary || {};
    const regionData = advancedData?.[regionKey] || { topPuestos: [], topLocalidades: [], topLideres: [], totalVotos: 0 };
    const rankingGeneral = leaderPerf?.rankingGeneral || [];
    const topErrores = leaderPerf?.topErrores || [];
    const topVerificaciones = leaderPerf?.topVerificaciones || [];
    const totalLeaders = summary.uniqueLeaders || 0;
    const totalRegistrations = summary.totalRegistrations || 0;
    const completionPercent = Number(summary.completionPercentage || 0).toFixed(1);
    const trendPct = Number(trendData?.analysis?.trendPercentage || 0);
    const trendDirection = trendData?.analysis?.trend || 'stable';

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: [842, 595] });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const nowStr = new Date().toLocaleDateString('es-CO');
        const renderFilterValue = (value, fallback = 'Todos') => (value === null || value === undefined || value === '' ? fallback : String(value));

        const drawHeader = (title) => {
          doc.rect(0, 0, 842, 90).fill('#0f172a');
          doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(title, 40, 25, { align: 'left' });
          doc.fontSize(11).font('Helvetica').text(`Evento: ${eventName} | Corte: ${nowStr}`, 40, 58, { align: 'left' });
          doc.rect(0, 90, 842, 8).fill('#f97316');
        };

        const drawFooter = (pageNum) => {
          doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text(`Informe analitico | Evento: ${eventName}`, 40, 560, { width: 520 });
          doc.text(`Pagina ${pageNum} de 4`, 740, 560);
        };

        const drawKPIBox = (x, y, title, value, subtitle, color) => {
          doc.lineWidth(1);
          doc.rect(x, y, 230, 110).fillOpacity(1).fillAndStroke('#ffffff', '#e2e8f0');
          doc.rect(x, y, 8, 110).fill(color);
          doc.fillColor('#64748b').fontSize(12).font('Helvetica-Bold').text(title, x + 25, y + 20);
          doc.fillColor(color).fontSize(34).font('Helvetica-Bold').text(value, x + 25, y + 40);
          doc.fillColor('#94a3b8').fontSize(10).font('Helvetica').text(subtitle, x + 25, y + 85);
        };

        // Page 1
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('INFORME EJECUTIVO PROFESIONAL');
        drawKPIBox(40, 150, 'REGISTROS', totalRegistrations.toLocaleString('es-CO'), 'Evento seleccionado', '#16a34a');
        drawKPIBox(300, 150, 'LIDERES ACTIVOS', totalLeaders.toLocaleString('es-CO'), 'Con actividad', '#2563eb');
        drawKPIBox(560, 150, 'AVANCE', `${completionPercent}%`, 'Indice de completitud', '#ea580c');

        doc.fillColor('#334155').fontSize(13).font('Helvetica-Bold').text('FILTROS APLICADOS', 40, 310);
        doc.fillColor('#475569').fontSize(11).font('Helvetica').text(
          `EventId: ${renderFilterValue(activeEventId, 'Activo')}\nRegion: ${regionKey.toUpperCase()}\nEstado: ${renderFilterValue(status, 'all')}\nLider: ${renderFilterValue(leaderId, 'Todos')}`,
          40, 336, { width: 420, lineGap: 4 }
        );
        doc.fillColor('#334155').fontSize(13).font('Helvetica-Bold').text('RESUMEN CUANTITATIVO', 40, 426);
        doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(
          `- Registros del evento: ${totalRegistrations.toLocaleString('es-CO')}\n` +
          `- Lideres con actividad: ${totalLeaders.toLocaleString('es-CO')}\n` +
          `- Tendencia 30 dias: ${trendDirection} (${trendPct.toFixed(2)}%)\n` +
          `- Proyeccion al objetivo: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')}\n` +
          `- Lider con mayor aporte: ${simulationData?.topLeader || 'N/D'} (${simulationData?.topLeaderVotes || 0})`,
          50, 448, { width: 400, lineGap: 5 }
        );

        const kpiDonutCfg = {
          type: 'doughnut',
          data: {
            labels: ['Avance', 'Pendiente'],
            datasets: [{ data: [Math.max(0, Number(completionPercent)), Math.max(0, 100 - Number(completionPercent))], backgroundColor: ['#16a34a', '#e2e8f0'] }]
          },
          options: { plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Nivel de Avance' } } }
        };
        const kpiDonut = await getQuickChartImage(kpiDonutCfg, 300, 220);
        if (kpiDonut) doc.image(kpiDonut, 500, 320, { width: 280 });
        drawFooter(1);

        // Page 2
        doc.addPage({ margin: 0, size: [842, 595], layout: 'landscape' });
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('ANALISIS AVANZADO TERRITORIAL');

        const topPuestos = (regionData.topPuestos || []).slice(0, 8);
        const topLocalidades = (regionData.topLocalidades || []).slice(0, 8);
        const puestosCfg = {
          type: 'bar',
          data: { labels: topPuestos.map((p) => String(p._id || 'N/A').slice(0, 18)), datasets: [{ label: 'Votos', data: topPuestos.map((p) => p.totalVotos || 0), backgroundColor: '#3b82f6' }] },
          options: { plugins: { title: { display: true, text: 'Top Puestos (region seleccionada)' }, legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        };
        const puestosImg = await getQuickChartImage(puestosCfg, 390, 260);
        if (puestosImg) doc.image(puestosImg, 35, 140, { width: 370 });

        const locCfg = {
          type: 'pie',
          data: {
            labels: topLocalidades.map((l) => String(l._id || 'N/A').slice(0, 16)),
            datasets: [{ data: topLocalidades.map((l) => l.totalVotos || 0), backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'] }]
          },
          options: { plugins: { title: { display: true, text: 'Distribucion por Localidad' } } }
        };
        const locImg = await getQuickChartImage(locCfg, 390, 260);
        if (locImg) doc.image(locImg, 435, 140, { width: 370 });

        doc.fillColor('#334155').fontSize(11).font('Helvetica').text(`Total votos region ${regionKey.toUpperCase()}: ${(regionData.totalVotos || 0).toLocaleString('es-CO')}`, 40, 430);
        doc.fillColor('#334155').fontSize(10).font('Helvetica').text(
          `Top puesto: ${(topPuestos[0]?._id || 'N/D')} (${(topPuestos[0]?.totalVotos || 0).toLocaleString('es-CO')}) | ` +
          `Top localidad: ${(topLocalidades[0]?._id || 'N/D')} (${(topLocalidades[0]?.totalVotos || 0).toLocaleString('es-CO')})`,
          40, 448, { width: 760, lineGap: 4 }
        );
        drawFooter(2);

        // Page 3
        doc.addPage({ margin: 0, size: [842, 595], layout: 'landscape' });
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('RENDIMIENTO DE LIDERES');

        const topRanking = rankingGeneral.slice(0, 10);
        const rankingCfg = {
          type: 'bar',
          data: { labels: topRanking.map((l) => String(l.leaderName || 'N/A').slice(0, 16)), datasets: [{ label: 'Score', data: topRanking.map((l) => l.performanceScore || 0), backgroundColor: '#0ea5e9' }] },
          options: { plugins: { title: { display: true, text: 'Ranking General (Score)' }, legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        };
        const rankingImg = await getQuickChartImage(rankingCfg, 390, 260);
        if (rankingImg) doc.image(rankingImg, 35, 140, { width: 370 });

        const qualityCfg = {
          type: 'bar',
          data: { labels: ['Errores', 'Verificaciones'], datasets: [{ data: [topErrores.reduce((a, x) => a + (x.errores || 0), 0), topVerificaciones.reduce((a, x) => a + (x.verificaciones || 0), 0)], backgroundColor: ['#ef4444', '#22c55e'] }] },
          options: { plugins: { title: { display: true, text: 'Calidad de Datos (Top 10)' }, legend: { display: false } } }
        };
        const qualityImg = await getQuickChartImage(qualityCfg, 390, 260);
        if (qualityImg) doc.image(qualityImg, 435, 140, { width: 370 });

        doc.rect(40, 430, 762, 95).fill('#ffffff');
        doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('TOP 5 LIDERES DEL EVENTO', 55, 446);
        topRanking.slice(0, 5).forEach((leader, idx) => {
          doc.fillColor('#334155').fontSize(10).font('Helvetica').text(
            `${idx + 1}. ${leader.leaderName || 'Sin nombre'} | Score ${leader.performanceScore || 0} | Registros ${leader.totalRegistros || 0}`,
            55, 466 + (idx * 14)
          );
        });
        drawFooter(3);

        // Page 4
        doc.addPage({ margin: 0, size: [842, 595], layout: 'landscape' });
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('TENDENCIAS Y PROYECCION');

        const trendSeries = (trendData?.timeSeries || []).slice(-15);
        const trendCfg = {
          type: 'line',
          data: {
            labels: trendSeries.map((x) => String(x.date || '').slice(5)),
            datasets: [{ label: 'Registros por dia', data: trendSeries.map((x) => x.count || 0), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.2)', fill: true }]
          },
          options: { plugins: { title: { display: true, text: 'Evolucion diaria (ultimos 15 puntos)' } }, scales: { y: { beginAtZero: true } } }
        };
        const trendImg = await getQuickChartImage(trendCfg, 520, 260);
        if (trendImg) doc.image(trendImg, 35, 145, { width: 500 });

        doc.rect(565, 145, 240, 260).fill('#ffffff');
        doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Proyeccion', 580, 165);
        doc.fillColor('#334155').fontSize(10).font('Helvetica').text(
          `Actual: ${(simulationData?.currentTotal || 0).toLocaleString('es-CO')}\n` +
          `Ritmo diario: ${(simulationData?.dailyGrowthRate || 0).toFixed(1)}\n` +
          `Dias restantes: ${simulationData?.daysRemaining || 0}\n` +
          `Proy. 30 dias: ${(simulationData?.projection30Days || 0).toLocaleString('es-CO')}\n` +
          `Proy. 60 dias: ${(simulationData?.projection60Days || 0).toLocaleString('es-CO')}\n` +
          `Total objetivo: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')}\n\n` +
          `Top puesto: ${simulationData?.topPuesto || 'N/D'} (${simulationData?.topPuestoVotes || 0})\n` +
          `Top localidad: ${simulationData?.topLocalidad || 'N/D'} (${simulationData?.topLocalidadVotes || 0})\n` +
          `Top lider: ${simulationData?.topLeader || 'N/D'} (${simulationData?.topLeaderVotes || 0})`,
          580, 188, { width: 210, lineGap: 4 }
        );

        doc.rect(40, 430, 762, 95).fill('#ecfeff');
        doc.fillColor('#475569').fontSize(11).font('Helvetica-Bold').text('CONCLUSION OPERATIVA', 50, 446);
        doc.fillColor('#475569').fontSize(10).font('Helvetica').text(
          `Con ${totalRegistrations.toLocaleString('es-CO')} registros y tendencia ${trendDirection} (${trendPct.toFixed(2)}%), ` +
          `la proyeccion estimada es ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')} al corte objetivo. ` +
          `La mayor concentracion actual esta en ${simulationData?.topPuesto || 'N/D'} y ${simulationData?.topLocalidad || 'N/D'}.`,
          50, 466, { width: 740, lineGap: 4 }
        );
        drawFooter(4);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    logger.error('Error generando reporte PDF profesional', error);
    throw AppError.serverError('Error al generar PDF profesional en el servidor');
  }
}

export default {
  exportRegistrationsCSV,
  exportRegistrationsExcel,
  exportLeadersExcel,
  generatePuestoQR,
  generateReportPDF
};

