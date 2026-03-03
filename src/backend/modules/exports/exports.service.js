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
    const url = `https://quickchart.io/chart?width=500&height=300&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
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
 * Genera reporte PDF (structure para futuro)
 */
export async function generateReportPDF(eventId = null) {
  try {
    logger.info('Preparando PDF report avanzado', { eventId });

    // 1. Gather comprehensive data
    const dashboard = await analyticsService.getDashboardSummary(eventId);
    const leaderPerf = await advancedService.getLeaderPerformance(eventId);
    let registrationAnalytics = null;
    
    try {
      registrationAnalytics = await analyticsService.getRegistrationAnalytics(eventId);
    } catch(e) {
      logger.warn('Could not fetch registration analytics for PDF', e);
    }

    const summary = dashboard?.summary || {};
    const totalLeaders = summary.uniqueLeaders || 0;
    const totalRegistrations = summary.totalRegistrations || 0;
    const completionPercent = dashboard?.summary?.completionPercentage || '0.00';

    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        doc.font('Helvetica');

        // Document Header
        doc.fontSize(24).fillColor('#1e3a8a').text('Informe Analítico Ejecutivo', { align: 'center', underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(10).fillColor('#64748b').text(`Generado el: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown(2);

        // --- SECTION 1: GLOBAL SUMMARY ---
        doc.fontSize(16).fillColor('#0f172a').text('1. Resumen General Constitucional');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#3b82f6').stroke();
        doc.moveDown(1);
        
        doc.fontSize(14).fillColor('#334155');
        doc.text(`• Total Líderes Activos: `, { continued: true }).fillColor('#2563eb').text(totalLeaders.toString());
        doc.fillColor('#334155').text(`• Total Registros Captados: `, { continued: true }).fillColor('#16a34a').text(totalRegistrations.toString());
        doc.fillColor('#334155').text(`• Porcentaje de Avance (Est.): `, { continued: true }).fillColor('#ea580c').text(`${completionPercent}%`);
        doc.moveDown(2);

        // --- FETCH CHARTS ---
        let leadLabels = [];
        let leadData = [];
        if (leaderPerf && leaderPerf.length > 0) {
          const top5 = leaderPerf.slice(0, 5);
          leadLabels = top5.map(l => {
             const n = (l.leaderData && l.leaderData.name) ? l.leaderData.name : (l.leaderName || 'No ID');
             return n.split(' ')[0]; // Just first name to fit chart
          });
          leadData = top5.map(l => l.totalRegistrations || 0);
        }

        // Generate Bar Chart if we have data
        if (leadLabels.length > 0) {
          doc.fontSize(16).fillColor('#0f172a').text('2. Gráfico de Rendimiento (Top 5 Líderes)');
          doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#3b82f6').stroke();
          doc.moveDown(1);

          const barChartConfig = {
            type: 'bar',
            data: {
              labels: leadLabels,
              datasets: [{
                label: 'Registros',
                data: leadData,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
              }]
            },
            options: {
              plugins: { datalabels: { display: true, color: '#fff', font: { weight: 'bold' } } }
            }
          };

          const chartBuffer = await getQuickChartImage(barChartConfig);
          if (chartBuffer) {
            doc.image(chartBuffer, { width: 450, align: 'center' });
            doc.moveDown();
          } else {
            doc.fontSize(12).fillColor('#e48257').text('[Gráfico no disponible temporalmente]');
            doc.moveDown();
          }
        }

        // --- SECTION 3: TOP LEADER PERFORMANCE TABLE ---
        doc.addPage();
        doc.fontSize(16).fillColor('#0f172a').text('3. Cuadro de Honor y Efectividad');
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#3b82f6').stroke();
        doc.moveDown(1);
        
        if (leaderPerf && leaderPerf.length > 0) {
          const topLeaders = leaderPerf.slice(0, 15); // Show top 15
          
          topLeaders.forEach((leader, index) => {
            const leaderName = (leader.leaderData && leader.leaderData.name) ? leader.leaderData.name : (leader.leaderName || 'No Identificado');
            const totalReg = leader.totalRegistrations || 0;
            const netEffectiveness = leader.efectividadNeta ? leader.efectividadNeta.toFixed(2) : '0.00';
            const penalty = leader.penaltyScore || 0;
            const validos = totalReg - penalty;
            
            doc.fontSize(12).fillColor('#1e293b').text(`${index + 1}. ${leaderName}`, { continued: false });
            doc.fontSize(10).fillColor('#475569')
               .text(`   Registros Exitosos: ${totalReg} | Válidos: ${validos > 0 ? validos : 0} | Efectividad: ${netEffectiveness}%`);
            doc.moveDown(0.5);
          });
        } else {
          doc.fontSize(11).text('Datos de desempeño aún inaccesibles para el periodo seleccionado.', { font: 'Helvetica-Oblique' });
        }
        
        doc.moveDown(3);
        doc.fontSize(10).fillColor('#94a3b8').text('--- Fin del Reporte Analítico ---', { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });

  } catch (error) {
    logger.error('Error generando Reporte PDF Backend', error);
    throw AppError.serverError('Error al generar PDF en el servidor');
  }
}

export default {
  exportRegistrationsCSV,
  exportRegistrationsExcel,
  exportLeadersExcel,
  generatePuestoQR,
  generateReportPDF
};
