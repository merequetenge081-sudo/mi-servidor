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
async function getQuickChartImage(chartConfig) {
  try {
    const url = `https://quickchart.io/chart?width=600&height=350&bkg=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
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
 * Genera reporte PDF (Estilo PPT Ejecutivo)
 */
export async function generateReportPDF(eventId = null) {
  try {
    logger.info('Preparando PPT-like PDF report avanzado', { eventId });

    // 1. Gather comprehensive data
    const dashboard = await analyticsService.getDashboardSummary(eventId);
    const leaderPerf = await advancedService.getLeaderPerformance(eventId);
    let regStats = null;
    
    try {
      regStats = await analyticsService.getRegistrationAnalytics(eventId);
    } catch(e) {
      logger.warn('Could not fetch registration analytics for PDF', e);
    }

    const summary = dashboard?.summary || {};
    const totalLeaders = summary.uniqueLeaders || 0;
    const totalRegistrations = summary.totalRegistrations || 0;
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

        doc.font('Helvetica');

        // ==== PORTADA DEL INFORME ====
        // Fondo principal
        doc.rect(0, 0, 842, 595).fill('#f4f6f9');
        
        // Cabecera top 
        doc.rect(0, 0, 842, 90).fill('#1e3a8a');
        doc.fillColor('#ffffff').fontSize(28).font('Helvetica-Bold')
           .text('INFORME EJECUTIVO DE RENDIMIENTO', 40, 30, { align: 'left' });
        doc.fontSize(12).font('Helvetica')
           .text(`Fecha de Corte: ${new Date().toLocaleDateString('es-CO')}`, 40, 65, { align: 'left' });

        // Banda naranja de acento
        doc.rect(0, 90, 842, 8).fill('#ea580c');

        // ==== SECCIÓN 1: KPIs PRINCIPALES ====
        const kpiY = 130;
        const boxWidth = 230;
        const boxHeight = 110;
        
        // Función para dibujar tarjeta KPI
        const drawKPIBox = (x, y, title, value, subtitle, color) => {
            doc.rect(x, y, boxWidth, boxHeight).fill('#ffffff');
            doc.rect(x, y, 8, boxHeight).fill(color);
            doc.fillColor('#64748b').fontSize(14).font('Helvetica-Bold').text(title, x + 25, y + 20);
            doc.fillColor(color).fontSize(38).font('Helvetica-Bold').text(value, x + 25, y + 40);
            doc.fillColor('#94a3b8').fontSize(11).font('Helvetica').text(subtitle, x + 25, y + 85);
        };

        drawKPIBox(40, kpiY, 'REGISTROS TOTALES', totalRegistrations.toString(), 'Ingresados exitosamente', '#22c55e'); // Green
        drawKPIBox(300, kpiY, 'LÍDERES ACTIVOS', totalLeaders.toString(), 'Con registros en sistema', '#3b82f6'); // Blue
        drawKPIBox(560, kpiY, 'PORCENTAJE AVANCE', `${completionPercent}%`, 'Contra meta estimada', '#f59e0b'); // Orange

        // ==== OBTENER DATOS PARA GRÁFICOS ====
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
          validData = top5.map(l => (l.totalRegistrations || 0) - (l.penaltyScore || 0));
        }

        // Gráfico Top 5 Líderes
        if (leadLabels.length > 0) {
            const barChartConfig = {
                type: 'bar',
                data: {
                  labels: leadLabels,
                  datasets: [
                    { label: 'Brutos', data: leadData, backgroundColor: '#93c5fd' },
                    { label: 'Válidos', data: validData, backgroundColor: '#2563eb' }
                  ]
                },
                options: {
                  title: { display: true, text: 'TOP 5 RENDIMIENTO POR LÍDER', fontSize: 16 },
                  plugins: { datalabels: { display: true, color: '#000' } }
                }
            };
            const chartBuffer = await getQuickChartImage(barChartConfig);
            if (chartBuffer) {
                doc.image(chartBuffer, 40, 260, { width: 350, height: 210 });
            } else {
                doc.fillColor('#e48257').fontSize(12).text('[Gráfico no disponible]', 40, 260);
            }
        }

        // Tabla Top Líderes al lado derecho
        doc.rect(420, 260, 370, 280).fill('#ffffff');
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('CUADRO DE HONOR (TOP 8)', 440, 280);
        doc.moveTo(440, 300).lineTo(770, 300).strokeColor('#e2e8f0').stroke();
        
        let rowY = 315;
        doc.fillColor('#64748b').fontSize(10).font('Helvetica-Bold');
        doc.text('POS', 440, rowY);
        doc.text('NOMBRE DEL LÍDER', 480, rowY);
        doc.text('TOTAL', 680, rowY);
        doc.text('EFECT.', 730, rowY);
        rowY += 15;

        if (leaderPerf && leaderPerf.length > 0) {
            const topTable = leaderPerf.slice(0, 8);
            topTable.forEach((leader, index) => {
                const isEven = index % 2 === 0;
                if (isEven) {
                    doc.rect(440, rowY - 5, 340, 20).fill('#f8fafc');
                }
                const name = ((leader.leaderData && leader.leaderData.name) ? leader.leaderData.name : (leader.leaderName || 'N/A')).substring(0, 30);
                const reg = leader.totalRegistrations || 0;
                const eff = leader.efectividadNeta ? leader.efectividadNeta.toFixed(1) : '0';

                doc.fillColor('#1e293b').fontSize(10).font('Helvetica');
                doc.text(`${index + 1}`, 440, rowY);
                doc.font(index < 3 ? 'Helvetica-Bold' : 'Helvetica').text(name, 480, rowY);
                doc.text(`${reg}`, 680, rowY);
                doc.text(`${eff}%`, 730, rowY);
                rowY += 20;
            });
        }

        // Pie de página
        doc.fillColor('#94a3b8').fontSize(9).text('Confidencial - Sistema de Gestión', 40, 560);
        doc.text(`Página 1/1 - ID Sesión: ${Math.random().toString(36).substr(2, 6).toUpperCase()}`, 700, 560);

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
