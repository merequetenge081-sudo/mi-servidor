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
 * Genera reporte PDF (structure para futuro)
 */
export async function generateReportPDF(eventId = null) {
  try {
    logger.info('Preparando PDF report avanzado', { eventId });

    // Call real existing methods
    const dashboard = await analyticsService.getDashboardSummary(eventId);
    const leaderPerf = await advancedService.getLeaderPerformance(eventId);

    const summary = dashboard?.summary || {};
    const totalLeaders = summary.uniqueLeaders || 0;
    const totalRegistrations = summary.totalRegistrations || 0;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });

        doc.font('Helvetica');

        // Document Header
        doc.fontSize(22).fillColor('#2c3e50').text('Informe Analítico Avanzado', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(10).fillColor('#7f8c8d').text(`Generado: ${new Date().toLocaleString()}`, { align: 'right' });
        doc.moveDown(1.5);

        // --- SECTION 1: GLOBAL SUMMARY ---
        doc.fontSize(16).fillColor('#e74c3c').text('1. Resumen General Constitucional');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#e74c3c').stroke();
        doc.moveDown(0.5);
        
        doc.fontSize(12).fillColor('#34495e');
        doc.text(`Total Líderes Activos: ${totalLeaders}`);
        doc.text(`Total Registros Captados: ${totalRegistrations}`);
        doc.moveDown(2);

        // --- SECTION 2: TOP LEADER PERFORMANCE ---
        doc.fontSize(16).fillColor('#27ae60').text('2. Cuadro de Honor y Rendimiento de Líderes');
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#27ae60').stroke();
        doc.moveDown(0.5);
        
        if (leaderPerf && leaderPerf.length > 0) {
          const topLeaders = leaderPerf.slice(0, 10);
          
          topLeaders.forEach((leader, index) => {
            const leaderName = (leader.leaderData && leader.leaderData.name) ? leader.leaderData.name : (leader.leaderName || 'No Identificado');
            const totalReg = leader.totalRegistrations || 0;
            const netEffectiveness = leader.efectividadNeta ? leader.efectividadNeta.toFixed(2) : '0.00';
            const penalty = leader.penaltyScore || 0;
            
            doc.fontSize(12).fillColor('#34495e').text(`${index + 1}. ${leaderName}`, { continued: false });
            doc.fontSize(10).fillColor('#7f8c8d')
               .text(`   Registros Exitosos: ${totalReg} | Efectividad Ponderada: ${netEffectiveness}%`);
            doc.text(`   Inconsistencias y Errores (Penalizaciones): ${penalty}`);
            doc.moveDown(0.5);
          });
        } else {
          doc.fontSize(11).text('Datos de desempeño aún inaccesibles para el periodo seleccionado.', { font: 'Helvetica-Oblique' });
        }
        
        doc.moveDown(3);
        doc.fontSize(10).fillColor('#bdc3c7').text('--- Fin del Reporte ---', { align: 'center' });

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
