/**
 * Exports Service
 * Lógica de negocio para exportación de datos
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import exportsRepository from './exports.repository.js';
import ExcelJS from 'exceljs';
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
        const sessionId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const renderFilterValue = (value, fallback = 'Todos') => (value === null || value === undefined || value === '' ? fallback : String(value));

        const drawHeader = (title) => {
          doc.rect(0, 0, 842, 90).fill('#0f172a');
          doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text(title, 40, 25, { align: 'left' });
          doc.fontSize(11).font('Helvetica').text(`Evento: ${eventName} | Corte: ${nowStr}`, 40, 58, { align: 'left' });
          doc.rect(0, 90, 842, 8).fill('#f97316');
        };

        const drawFooter = (pageNum) => {
          doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('Confidencial - Informe Analitico de Campana', 40, 560);
          doc.text(`Pagina ${pageNum} | Sesion ${sessionId}`, 700, 560);
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
          `EventId: ${renderFilterValue(activeEventId, 'Activo')}
Region: ${regionKey.toUpperCase()}
Estado: ${renderFilterValue(status, 'all')}
Lider: ${renderFilterValue(leaderId, 'Todos')}`,
          40, 336, { width: 420, lineGap: 4 }
        );
        doc.fillColor('#334155').fontSize(13).font('Helvetica-Bold').text('SINTESIS', 40, 426);
        doc.fillColor('#1e293b').fontSize(10).font('Helvetica').text(
          `- Tendencia 30 dias: ${trendDirection} (${trendPct.toFixed(2)}%)
` +
          `- Proyeccion objetivo: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')}
` +
          `- Top lider: ${simulationData?.topLeader || 'N/D'} (${simulationData?.topLeaderVotes || 0})`,
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

        doc.fillColor('#334155').fontSize(11).font('Helvetica').text(
          `Total votos (${regionKey}): ${(regionData.totalVotos || 0).toLocaleString('es-CO')}. Datos exclusivos del evento y filtros vigentes.`,
          40, 430, { width: 760, lineGap: 4 }
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
        doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text('Top 5 lideres', 55, 446);
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
          `Actual: ${(simulationData?.currentTotal || 0).toLocaleString('es-CO')}
` +
          `Ritmo diario: ${(simulationData?.dailyGrowthRate || 0).toFixed(1)}
` +
          `Dias restantes: ${simulationData?.daysRemaining || 0}
` +
          `Proy. 30 dias: ${(simulationData?.projection30Days || 0).toLocaleString('es-CO')}
` +
          `Proy. 60 dias: ${(simulationData?.projection60Days || 0).toLocaleString('es-CO')}
` +
          `Total objetivo: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')}

` +
          `Top puesto: ${simulationData?.topPuesto || 'N/D'} (${simulationData?.topPuestoVotes || 0})
` +
          `Top localidad: ${simulationData?.topLocalidad || 'N/D'} (${simulationData?.topLocalidadVotes || 0})
` +
          `Top lider: ${simulationData?.topLeader || 'N/D'} (${simulationData?.topLeaderVotes || 0})`,
          580, 188, { width: 210, lineGap: 4 }
        );

        doc.rect(40, 430, 762, 95).fill('#ecfeff');
        doc.fillColor('#475569').fontSize(11).font('Helvetica').text(
          'Informe consolidado desde modulos analytics + advanced. Solo incluye datos del evento seleccionado y filtros activos del panel.',
          50, 462, { width: 740, lineGap: 4 }
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
    logger.error('Error generando reporte PDF profesional', error);
