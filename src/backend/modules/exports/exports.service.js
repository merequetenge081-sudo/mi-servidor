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
export async function generateReportPDF(eventId = null) {
  try {
    logger.info('Preparando PPT-like PDF report avanzado, multi-slide y exclusivo evento', { eventId });

    // Ensure we resolve eventId if not provided but we have active Event
    let activeEventId = eventId;
    let eventName = "Evento Global";
    if (!activeEventId) {
        const activeEvent = await Event.findOne({ status: 'active' }).lean();
        if (activeEvent) {
            activeEventId = activeEvent._id.toString();
            eventName = activeEvent.name || "Evento Activo";
        }
    } else {
        const ev = await Event.findById(activeEventId).lean();
        if (ev) eventName = ev.name || "Evento";
    }

    // 1. Gather comprehensive data STRICTLY for this eventId
    const dashboard = await analyticsService.getDashboardSummary(activeEventId);
    const leaderPerf = await advancedService.getLeaderPerformance(activeEventId);
    const geoData = await getEventGeoAnalytics(activeEventId);

    const summary = dashboard?.summary || {};
    const totalLeaders = summary.uniqueLeaders || 0;
    const totalRegistrations = summary.totalRegistrations || 0;
    const activeEventsCount = summary.activeEvents || 1;
    const completionPercent = typeof dashboard?.summary?.completionPercentage === 'number' 
        ? dashboard.summary.completionPercentage.toFixed(1) 
        : dashboard?.summary?.completionPercentage || '0.00';

    return new Promise(async (resolve, reject) => {
      try {
        // Formato presentación (landscape)
        const doc = new PDFDocument({ margin: 0, size: [842, 595] }); // A4 Landscape
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        const nowStr = new Date().toLocaleDateString('es-CO');

        // ==============================================
        // PAGE 1: RESUMEN EJECUTIVO KPI
        // ==============================================
        const drawHeader = (title) => {
            doc.rect(0, 0, 842, 90).fill('#1e3a8a');
            doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text(title, 40, 25, { align: 'left' });
            doc.fontSize(12).font('Helvetica').text(`Evento Analizado: ${eventName} | Fecha de Corte: ${nowStr}`, 40, 58, { align: 'left' });
            doc.rect(0, 90, 842, 8).fill('#ea580c');
        };

        const drawFooter = (pageNum) => {
            doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('Confidencial - Sistema de Gestión Algorítmico', 40, 560);
            doc.text(`Página ${pageNum} | ID Sesión: ${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 700, 560);
        };

        // Render Page 1
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('INFORME EJECUTIVO DE RENDIMIENTO');

        const kpiY = 150;
        const boxWidth = 230;
        const boxHeight = 110;
        
        const drawKPIBox = (x, y, title, value, subtitle, color) => {
            doc.lineWidth(1);
            doc.rect(x, y, boxWidth, boxHeight).fillOpacity(1).fillAndStroke('#ffffff', '#e2e8f0');
            doc.rect(x, y, 8, boxHeight).fill(color);
            doc.fillColor('#64748b').fontSize(12).font('Helvetica-Bold').text(title, x + 25, y + 20);
            doc.fillColor(color).fontSize(38).font('Helvetica-Bold').text(value, x + 25, y + 40);
            doc.fillColor('#94a3b8').fontSize(11).font('Helvetica').text(subtitle, x + 25, y + 85);
        };

        drawKPIBox(40, kpiY, 'REGISTROS TOTALES', totalRegistrations.toString(), 'Cargados al evento activo', '#16a34a');
        drawKPIBox(300, kpiY, 'LÍDERES ACTIVOS', totalLeaders.toString(), 'Con gestiones de votantes', '#2563eb');
        drawKPIBox(560, kpiY, 'PORCENTAJE AVANCE ESTIMADO', `${completionPercent}%`, 'Contra proyección global', '#ea580c');

        doc.fillColor('#334155').fontSize(14).font('Helvetica-Bold').text('SÍNTESIS DE GESTIÓN (EVENTO ACTUAL)', 40, 310);
        doc.fillColor('#475569').fontSize(11).font('Helvetica').text(
            `El presente reporte filtra de forma estricta los datos correspondientes únicamente al evento: "${eventName}".\n\n` +
            `• Se han cruzado las bases de datos de todos los líderes registrados contra el volumen absoluto de planillas.\n` +
            `• Actualmente intervienen ${totalLeaders} líderes consolidando ${totalRegistrations} formularios efectivos.\n` + 
            `• Los siguientes módulos exponen la distribución jerárquica de líderes y territorial (zonas estratégicas).`,
            40, 340, { width: 400, lineGap: 4 }
        );

        // A small general chart on page 1
        const radarConfig = {
            type: 'outlabeledPie',
            data: {
              labels: ['Avance', 'Restante Estimado'],
              datasets: [{ backgroundColor: ['#16a34a', '#e2e8f0'], data: [parseFloat(completionPercent), 100 - parseFloat(completionPercent)] }]
            },
            options: { plugins: { legend: false } }
        };
        const chartPieBuf = await getQuickChartImage(radarConfig, 300, 200);
        if (chartPieBuf) doc.image(chartPieBuf, 500, 300, { width: 250 });
        
        drawFooter(1);

        // ==============================================
        // PAGE 2: ANÁLISIS DE LÍDERES (TOP PERFORMERS)
        // ==============================================
        doc.addPage({ margin: 0, size: [842, 595], layout: 'landscape' });
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('ANÁLISIS DE LÍDERES MULTINIVEL');

        let leadLabels = [];
        let leadData = [];
        let validData = [];
        if (leaderPerf && leaderPerf.length > 0) {
          const top5 = leaderPerf.slice(0, 5);
          leadLabels = top5.map(l => {
             const n = (l.leaderData && l.leaderData.name) ? l.leaderData.name : (l.leaderName || 'No ID');
             return n.split(' ').slice(0, 2).join(' '); 
          });
          leadData = top5.map(l => l.totalRegistrations || 0);
          validData = top5.map(l => Math.max(0, (l.totalRegistrations || 0) - (l.penaltyScore || 0)));
        }

        // Gráfico Top 5 Líderes
        if (leadLabels.length > 0) {
            const barChartConfig = {
                type: 'bar',
                data: {
                  labels: leadLabels,
                  datasets: [
                    { label: 'Registros Brutos', data: leadData, backgroundColor: '#93c5fd' },
                    { label: 'Registros Válidos', data: validData, backgroundColor: '#2563eb' }
                  ]
                },
                options: {
                  title: { display: true, text: 'TOP 5 RENDIMIENTO HISTÓRICO', fontSize: 16 },
                  plugins: { datalabels: { display: true, color: '#000', anchor: 'end', align: 'top' } }
                }
            };
            const chartBuffer = await getQuickChartImage(barChartConfig, 400, 280);
            if (chartBuffer) {
                doc.image(chartBuffer, 40, 150, { width: 360 });
            }
        } else {
            doc.fillColor('#e48257').fontSize(12).text('[Datos insuficientes para el Top 5]', 40, 150);
        }

        // Tabla Top Líderes al lado derecho (MÁS GRANDE: Top 10)
        doc.rect(420, 150, 380, 350).fill('#ffffff');
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('CUADRO DE HONOR ESTRATÉGICO (TOP 10)', 440, 170);
        doc.moveTo(440, 190).lineTo(780, 190).strokeColor('#e2e8f0').stroke();
        
        let rowY = 205;
        doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold');
        doc.text('POS', 440, rowY);
        doc.text('NOMBRE DEL LÍDER', 480, rowY);
        doc.text('BRUTO', 660, rowY);
        doc.text('EFECTIVO', 720, rowY);
        rowY += 15;

        if (leaderPerf && leaderPerf.length > 0) {
            const topTable = leaderPerf.slice(0, 10);
            topTable.forEach((leader, index) => {
                const isEven = index % 2 === 0;
                if (isEven) {
                    doc.rect(440, rowY - 5, 340, 20).fill('#f1f5f9');
                }
                const name = ((leader.leaderData && leader.leaderData.name) ? leader.leaderData.name : (leader.leaderName || 'N/A')).substring(0, 30);
                const reg = leader.totalRegistrations || 0;
                const eff = leader.efectividadNeta ? leader.efectividadNeta.toFixed(1) : '0';

                doc.fillColor(index < 3 ? '#2563eb' : '#1e293b').fontSize(10).font('Helvetica');
                doc.text(`${index + 1}°`, 440, rowY);
                doc.font(index < 3 ? 'Helvetica-Bold' : 'Helvetica').text(name, 480, rowY);
                doc.text(`${reg}`, 660, rowY);
                doc.text(`${eff}%`, 720, rowY);
                rowY += 21;
            });
        }
        drawFooter(2);

        // ==============================================
        // PAGE 3: ANÁLISIS GEOGRÁFICO Y MAPEO
        // ==============================================
        doc.addPage({ margin: 0, size: [842, 595], layout: 'landscape' });
        doc.rect(0, 0, 842, 595).fill('#f8fafc');
        drawHeader('VISTA GEOESPACIAL Y PUESTOS (MAPEO COLOMBIA/BOGOTÁ)');

        doc.fillColor('#334155').fontSize(12).font('Helvetica').text('Simulación de Cobertura Territorial por Zonas de Alta Concentración.', 40, 120);

        // Departamentos
        let dLbs = geoData.topDepts.map(d => d._id);
        let dVals = geoData.topDepts.map(d => d.count);
        if(dLbs.length > 0) {
            const chartDept = {
                type: 'horizontalBar',
                data: {
                    labels: dLbs,
                    datasets: [{ label: 'Votantes Reg.', data: dVals, backgroundColor: '#0ea5e9' }]
                },
                options: { title: { display: true, text: 'TOP MACRO-REGIONES (COLOMBIA / DEPARTAMENTALES)', fontSize: 13 } }
            };
            const bufDept = await getQuickChartImage(chartDept, 360, 260);
            if(bufDept) doc.image(bufDept, 40, 160, { width: 360 });
        } else {
            doc.fillColor('#e48257').fontSize(12).text('[Datos Dep. no disponibles]', 40, 160);
        }

        // Localidades / Capital
        let lLbs = geoData.topLocs.map(d => d._id);
        let lVals = geoData.topLocs.map(d => d.count);
        if(lLbs.length > 0) {
            const chartLoc = {
                type: 'polarArea',
                data: {
                    labels: lLbs,
                    datasets: [{ data: lVals, backgroundColor: ['#ef4444','#f97316','#f59e0b','#84cc16','#22c55e','#3b82f6'] }]
                },
                options: { title: { display: true, text: 'TOP MICRO-REGIONES (LOCALIDADES BOGOTÁ/CAPITAL)', fontSize: 13 } }
            };
            const bufLoc = await getQuickChartImage(chartLoc, 360, 280);
            if(bufLoc) doc.image(bufLoc, 440, 150, { width: 360 });
        } else {
            doc.fillColor('#e48257').fontSize(12).text('[Datos Loc. no disponibles]', 440, 160);
        }

        doc.rect(40, 440, 762, 80).fill('#e0f2fe');
        doc.fillColor('#0369a1').fontSize(11).font('Helvetica-Bold').text('NOTA ANALÍTICA DEL MAPEO OMNICANAL:', 60, 455);
        doc.fillColor('#0c4a6e').fontSize(10).font('Helvetica').text(
            `El sistema ha extraído los datos geográficos de los puntos de votación (Puestos) estrictamente asociados al evento [${eventName}]. `+
            `Los gráficos representan las concentraciones demográficas de captura en las regiones operativas de mayor tráfico (Mapeo Simulado en PDF). `+
            `Las densidades se ajustan de manera determinística según los registros validados en Mongoose (Evitando redundancias o inconsistencias).`, 
            60, 470, { width: 720, lineGap: 3 }
        );

        drawFooter(3);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

  } catch (error) {
    logger.error('Error generando Reporte PPT PDF Backend', error);
    throw AppError.serverError('Error al generar PDF PPT en el servidor');
  }
}

export default {
  exportRegistrationsCSV,
  exportRegistrationsExcel,
  exportLeadersExcel,
  generatePuestoQR,
  generateReportPDF
};
