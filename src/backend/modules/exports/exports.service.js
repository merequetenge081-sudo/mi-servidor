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
import { existsSync } from 'fs';
import { join } from 'path';

const logger = createLogger('ExportsService');
const BRAND = {
  appName: 'Dashboard Electoral SaaS',
  reportTagline: 'Reporte Ejecutivo de Inteligencia Operativa',
  colors: {
    pageBg: '#f8fafc',
    headerBg: '#0b1220',
    headerAccent: '#0ea5e9',
    cardBg: '#ffffff',
    cardBorder: '#dbe5ef',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    success: '#22c55e',
    info: '#3b82f6',
    warning: '#f59e0b',
    violet: '#8b5cf6'
  }
};

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

    logger.info('Generando reporte PDF SaaS profesional', { eventId, status, leaderId, targetDate, region });

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
    const completionPercentNum = Math.max(0, Number(summary.completionPercentage || 0));
    const completionPercent = completionPercentNum.toFixed(1);
    const trendPct = Number(trendData?.analysis?.trendPercentage || 0);
    const trendDirection = trendData?.analysis?.trend || 'stable';
    const avgPerLeader = totalLeaders > 0 ? (totalRegistrations / totalLeaders).toFixed(1) : '0.0';

    const topPuestos = (regionData.topPuestos || []).slice(0, 8);
    const topLocalidades = (regionData.topLocalidades || []).slice(0, 8);
    const topRanking = rankingGeneral.slice(0, 10);
    const trendSeries = (trendData?.timeSeries || []).slice(-15);

    const totalErrors = topErrores.reduce((acc, x) => acc + (x.errores || 0), 0);
    const totalAutoVerified = topVerificaciones.reduce((acc, x) => acc + (x.verificaciones || 0), 0);

    const topLeaderName = simulationData?.topLeader || (topRanking[0]?.leaderName || 'N/D');
    const topLeaderVotes = simulationData?.topLeaderVotes || (topRanking[0]?.totalRegistros || 0);

    return new Promise(async (resolve, reject) => {
      try {
        const PAGE = { w: 842, h: 595, m: 28, headerH: 84, footerH: 24 };
        const contentTop = PAGE.m + PAGE.headerH;

        const doc = new PDFDocument({ margin: 0, size: [PAGE.w, PAGE.h] });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const nowStr = new Date().toLocaleDateString('es-CO');
        const logoPath = join(process.cwd(), 'public', 'assets', 'icons', 'icon-192.png');
        const hasLogo = existsSync(logoPath);

        const drawHeader = (title, subtitle) => {
          doc.rect(0, 0, PAGE.w, PAGE.headerH).fill(BRAND.colors.headerBg);
          doc.rect(0, PAGE.headerH - 4, PAGE.w, 4).fill(BRAND.colors.headerAccent);

          if (hasLogo) {
            doc.image(logoPath, PAGE.w - 86, 16, { width: 42, height: 42 });
          } else {
            doc.roundedRect(PAGE.w - 86, 16, 42, 42, 6).fill('#1e293b');
          }

          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(19).text(title, PAGE.m, 18);
          doc.fillColor('#93c5fd').font('Helvetica').fontSize(9.5).text(BRAND.reportTagline, PAGE.m, 40, { width: 420 });
          doc.fillColor('#cbd5e1').font('Helvetica').fontSize(10).text(subtitle, PAGE.m, 56, { width: PAGE.w - (PAGE.m * 2) - 70 });
        };

        const drawFooter = (pageNum, totalPages = 4) => {
          doc.fillColor(BRAND.colors.textMuted).font('Helvetica').fontSize(8.5)
            .text(`${BRAND.appName} | Evento: ${eventName}`, PAGE.m, PAGE.h - 18, { width: 560 });
          doc.text(`Pagina ${pageNum} de ${totalPages}`, PAGE.w - 110, PAGE.h - 18, { width: 82, align: 'right' });
        };

        const drawCard = (x, y, w, h) => {
          doc.roundedRect(x, y, w, h, 8).fillAndStroke(BRAND.colors.cardBg, BRAND.colors.cardBorder);
        };

        const drawKpiCard = (x, y, title, value, note, accent) => {
          drawCard(x, y, 185, 96);
          doc.roundedRect(x, y, 6, 96, 3).fill(accent);
          doc.fillColor(BRAND.colors.textMuted).font('Helvetica-Bold').fontSize(9).text(title, x + 14, y + 12, { width: 165 });
          doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(24).text(String(value), x + 14, y + 30, { width: 160 });
          doc.fillColor('#94a3b8').font('Helvetica').fontSize(8.5).text(note, x + 14, y + 70, { width: 165 });
        };

        // Page 1 - Executive
        doc.rect(0, 0, PAGE.w, PAGE.h).fill(BRAND.colors.pageBg);
        drawHeader(
          'Reporte Ejecutivo de Analitica',
          `Evento: ${eventName} | Fecha de corte: ${nowStr} | EventId: ${activeEventId || 'Activo'} | Region: ${regionKey.toUpperCase()} | Estado: ${status} | Lider: ${leaderId || 'Todos'}`
        );

        drawKpiCard(PAGE.m, contentTop + 14, 'Registros del evento', totalRegistrations.toLocaleString('es-CO'), 'Registros filtrados segun evento y filtros activos', BRAND.colors.success);
        drawKpiCard(PAGE.m + 198, contentTop + 14, 'Lideres activos', totalLeaders.toLocaleString('es-CO'), 'Lideres con actividad registrada en el evento', BRAND.colors.info);
        drawKpiCard(PAGE.m + 396, contentTop + 14, 'Avance estimado', `${completionPercent}%`, 'Completitud de captura sobre meta estimada', BRAND.colors.warning);
        drawKpiCard(PAGE.m + 594, contentTop + 14, 'Promedio por lider', avgPerLeader, 'Registros promedio por lider activo', BRAND.colors.violet);

        drawCard(PAGE.m, contentTop + 124, 390, 305);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Resumen operacional (datos especificos)', PAGE.m + 14, contentTop + 138);
        doc.fillColor(BRAND.colors.textSecondary).font('Helvetica').fontSize(9.8).text(
          `1) Total de registros del evento: ${totalRegistrations.toLocaleString('es-CO')}.
` +
          `2) Lider principal por volumen: ${topLeaderName} con ${Number(topLeaderVotes).toLocaleString('es-CO')} registros.
` +
          `3) Tendencia ultimos 30 dias: ${trendDirection} (${trendPct.toFixed(2)}%).
` +
          `4) Proyeccion al objetivo configurado: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')}.
` +
          `5) Top puesto actual: ${simulationData?.topPuesto || 'N/D'} (${(simulationData?.topPuestoVotes || 0).toLocaleString('es-CO')}).
` +
          `6) Top localidad actual: ${simulationData?.topLocalidad || 'N/D'} (${(simulationData?.topLocalidadVotes || 0).toLocaleString('es-CO')}).`,
          PAGE.m + 14,
          contentTop + 160,
          { width: 360, lineGap: 6 }
        );

        drawCard(PAGE.m + 404, contentTop + 124, 410, 305);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Distribucion de avance', PAGE.m + 418, contentTop + 138);
        const kpiDonutCfg = {
          type: 'doughnut',
          data: {
            labels: ['Avance', 'Pendiente'],
            datasets: [{ data: [completionPercentNum, Math.max(0, 100 - completionPercentNum)], backgroundColor: [BRAND.colors.success, '#e2e8f0'] }]
          },
          options: {
            layout: { padding: 8 },
            plugins: {
              legend: { position: 'bottom', labels: { fontSize: 10 } },
              title: { display: true, text: 'Avance sobre meta estimada', fontSize: 12 }
            }
          }
        };
        const kpiDonut = await getQuickChartImage(kpiDonutCfg, 360, 250);
        if (kpiDonut) doc.image(kpiDonut, PAGE.m + 430, contentTop + 162, { width: 360, height: 240 });
        drawFooter(1);

        // Page 2 - Territorial analytics
        doc.addPage({ margin: 0, size: [PAGE.w, PAGE.h], layout: 'landscape' });
        doc.rect(0, 0, PAGE.w, PAGE.h).fill(BRAND.colors.pageBg);
        drawHeader('Analitica territorial', `Region analizada: ${regionKey.toUpperCase()} | Evento: ${eventName}`);

        drawCard(PAGE.m, contentTop + 12, 390, 255);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Top puestos por volumen', PAGE.m + 14, contentTop + 26);
        const puestosCfg = {
          type: 'bar',
          data: {
            labels: topPuestos.map((p) => String(p._id || 'N/D').slice(0, 20)),
            datasets: [{ label: 'Registros', data: topPuestos.map((p) => p.totalVotos || 0), backgroundColor: BRAND.colors.info }]
          },
          options: {
            layout: { padding: 10 },
            plugins: { legend: { display: false }, title: { display: true, text: 'Top 8 puestos', fontSize: 11 } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { fontSize: 9 } } }
          }
        };
        const puestosImg = await getQuickChartImage(puestosCfg, 360, 205);
        if (puestosImg) doc.image(puestosImg, PAGE.m + 14, contentTop + 48, { width: 360, height: 200 });

        drawCard(PAGE.m + 404, contentTop + 12, 410, 255);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Distribucion por localidad', PAGE.m + 418, contentTop + 26);
        const locCfg = {
          type: 'pie',
          data: {
            labels: topLocalidades.map((l) => String(l._id || 'N/D').slice(0, 18)),
            datasets: [{ data: topLocalidades.map((l) => l.totalVotos || 0), backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'] }]
          },
          options: {
            layout: { padding: 8 },
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, fontSize: 9 } }, title: { display: true, text: 'Top 8 localidades', fontSize: 11 } }
          }
        };
        const locImg = await getQuickChartImage(locCfg, 380, 205);
        if (locImg) doc.image(locImg, PAGE.m + 418, contentTop + 48, { width: 380, height: 200 });

        drawCard(PAGE.m, contentTop + 279, 814, 162);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Detalle top territorios', PAGE.m + 14, contentTop + 293);

        const drawTopList = (title, rows, x, y) => {
          doc.fillColor(BRAND.colors.textSecondary).font('Helvetica-Bold').fontSize(9.5).text(title, x, y);
          rows.slice(0, 5).forEach((row, idx) => {
            doc.fillColor('#475569').font('Helvetica').fontSize(9).text(
              `${idx + 1}. ${String(row._id || 'N/D').slice(0, 38)} | ${Number(row.totalVotos || 0).toLocaleString('es-CO')}`,
              x,
              y + 16 + (idx * 16),
              { width: 360 }
            );
          });
        };

        drawTopList('Top 5 puestos', topPuestos, PAGE.m + 14, contentTop + 312);
        drawTopList('Top 5 localidades', topLocalidades, PAGE.m + 418, contentTop + 312);
        drawFooter(2);

        // Page 3 - Leaders
        doc.addPage({ margin: 0, size: [PAGE.w, PAGE.h], layout: 'landscape' });
        doc.rect(0, 0, PAGE.w, PAGE.h).fill(BRAND.colors.pageBg);
        drawHeader('Rendimiento de lideres', `Evento: ${eventName} | Lideres evaluados: ${totalLeaders.toLocaleString('es-CO')}`);

        drawCard(PAGE.m, contentTop + 12, 390, 270);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Ranking por score', PAGE.m + 14, contentTop + 26);
        const rankingCfg = {
          type: 'bar',
          data: {
            labels: topRanking.slice(0, 8).map((l) => String(l.leaderName || 'N/D').slice(0, 14)),
            datasets: [{ label: 'Score', data: topRanking.slice(0, 8).map((l) => l.performanceScore || 0), backgroundColor: '#0ea5e9' }]
          },
          options: {
            layout: { padding: 10 },
            plugins: { legend: { display: false }, title: { display: true, text: 'Top 8 lideres por score', fontSize: 11 } },
            scales: { y: { beginAtZero: true }, x: { ticks: { fontSize: 9 } } }
          }
        };
        const rankingImg = await getQuickChartImage(rankingCfg, 360, 220);
        if (rankingImg) doc.image(rankingImg, PAGE.m + 14, contentTop + 50, { width: 360, height: 214 });

        drawCard(PAGE.m + 404, contentTop + 12, 410, 270);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Calidad operativa', PAGE.m + 418, contentTop + 26);
        const qualityCfg = {
          type: 'bar',
          data: {
            labels: ['Errores (Top 10)', 'Verificaciones auto (Top 10)'],
            datasets: [{ data: [totalErrors, totalAutoVerified], backgroundColor: ['#ef4444', BRAND.colors.success] }]
          },
          options: {
            layout: { padding: 8 },
            plugins: { legend: { display: false }, title: { display: true, text: 'Comparativo calidad', fontSize: 11 } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
          }
        };
        const qualityImg = await getQuickChartImage(qualityCfg, 380, 220);
        if (qualityImg) doc.image(qualityImg, PAGE.m + 418, contentTop + 50, { width: 380, height: 214 });

        drawCard(PAGE.m, contentTop + 294, 814, 147);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Top 10 lideres (score y volumen)', PAGE.m + 14, contentTop + 308);
        topRanking.slice(0, 10).forEach((leader, idx) => {
          const col = idx < 5 ? PAGE.m + 14 : PAGE.m + 414;
          const row = idx < 5 ? idx : idx - 5;
          doc.fillColor(BRAND.colors.textSecondary).font('Helvetica').fontSize(9).text(
            `${idx + 1}. ${String(leader.leaderName || 'N/D').slice(0, 22)} | Score ${leader.performanceScore || 0} | Registros ${leader.totalRegistros || 0}`,
            col,
            contentTop + 328 + (row * 19),
            { width: 380 }
          );
        });
        drawFooter(3);

        // Page 4 - Trend and projection
        doc.addPage({ margin: 0, size: [PAGE.w, PAGE.h], layout: 'landscape' });
        doc.rect(0, 0, PAGE.w, PAGE.h).fill(BRAND.colors.pageBg);
        drawHeader('Tendencias y proyeccion', `Rango analizado: ${startDateStr} a ${endDateStr}`);

        drawCard(PAGE.m, contentTop + 12, 540, 275);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Serie temporal de registros', PAGE.m + 14, contentTop + 26);
        const trendCfg = {
          type: 'line',
          data: {
            labels: trendSeries.map((x) => String(x.date || '').slice(5)),
            datasets: [{ label: 'Registros por dia', data: trendSeries.map((x) => x.count || 0), borderColor: BRAND.colors.info, backgroundColor: 'rgba(59,130,246,0.15)', fill: true, tension: 0.25 }]
          },
          options: {
            layout: { padding: 8 },
            plugins: { legend: { position: 'top' }, title: { display: true, text: 'Ultimos 15 puntos de tendencia', fontSize: 11 } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { fontSize: 8 } } }
          }
        };
        const trendImg = await getQuickChartImage(trendCfg, 510, 220);
        if (trendImg) doc.image(trendImg, PAGE.m + 14, contentTop + 50, { width: 510, height: 214 });

        drawCard(PAGE.m + 554, contentTop + 12, 260, 275);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Proyeccion', PAGE.m + 568, contentTop + 26);
        doc.fillColor(BRAND.colors.textSecondary).font('Helvetica').fontSize(9.4).text(
          `Actual: ${(simulationData?.currentTotal || 0).toLocaleString('es-CO')}\n` +
          `Ritmo diario: ${(simulationData?.dailyGrowthRate || 0).toFixed(1)}\n` +
          `Dias restantes: ${simulationData?.daysRemaining || 0}\n` +
          `Proy. 30 dias: ${(simulationData?.projection30Days || 0).toLocaleString('es-CO')}\n` +
          `Proy. 60 dias: ${(simulationData?.projection60Days || 0).toLocaleString('es-CO')}\n` +
          `Total objetivo: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')}\n\n` +
          `Top puesto: ${simulationData?.topPuesto || 'N/D'}\n` +
          `Top localidad: ${simulationData?.topLocalidad || 'N/D'}\n` +
          `Top lider: ${topLeaderName}`,
          PAGE.m + 568,
          contentTop + 48,
          { width: 232, lineGap: 4 }
        );

        drawCard(PAGE.m, contentTop + 299, 814, 142);
        doc.fillColor(BRAND.colors.textPrimary).font('Helvetica-Bold').fontSize(11).text('Conclusiones y acciones recomendadas', PAGE.m + 14, contentTop + 313);

        const recommendation1 = trendPct >= 0
          ? `Escalar captacion en los 3 principales puestos (${topPuestos.slice(0, 3).map((x) => String(x._id || 'N/D').slice(0, 14)).join(', ')}) para mantener tendencia ${trendDirection}.`
          : `Activar plan de recuperacion en puestos de bajo rendimiento para revertir tendencia ${trendDirection}.`;

        const recommendation2 = totalErrors > totalAutoVerified
          ? 'Priorizar auditoria de calidad por lider: el volumen de errores supera las verificaciones automaticas del top operativo.'
          : 'Mantener flujo de verificacion automatica: el sistema corrige mas de lo que reporta como error en el top operativo.';

        const recommendation3 = `Objetivo proyectado: ${(simulationData?.projectedTotal || 0).toLocaleString('es-CO')} registros. Seguimiento semanal recomendado con corte fijo.`;

        doc.fillColor(BRAND.colors.textSecondary).font('Helvetica').fontSize(9.8).text(`1) ${recommendation1}`, PAGE.m + 14, contentTop + 336, { width: 786, lineGap: 5 });
        doc.text(`2) ${recommendation2}`, PAGE.m + 14, contentTop + 365, { width: 786, lineGap: 5 });
        doc.text(`3) ${recommendation3}`, PAGE.m + 14, contentTop + 394, { width: 786, lineGap: 5 });

        drawFooter(4);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  } catch (error) {
    logger.error('Error generando reporte PDF SaaS', error);
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


