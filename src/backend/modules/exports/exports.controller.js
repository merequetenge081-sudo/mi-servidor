/**
 * Exports Controller
 * Endpoints HTTP para exportación de datos
 */

import { createLogger } from '../../core/Logger.js';
import { AppError } from '../../core/AppError.js';
import exportsService from './exports.service.js';

const logger = createLogger('ExportsController');

/**
 * POST /api/v2/exports/registrations/csv
 * Exporta registraciones como CSV
 */
export async function exportRegistrationsCSV(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Solicitando export CSV', { eventId });

    const csv = await exportsService.exportRegistrationsCSV(eventId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="registrations-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);

    logger.success('CSV enviado');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/exports/registrations/excel
 * Exporta registraciones como Excel
 */
export async function exportRegistrationsExcel(req, res, next) {
  try {
    const { eventId } = req.query;

    logger.info('Solicitando export Excel', { eventId });

    const buffer = await exportsService.exportRegistrationsExcel(eventId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="registrations-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

    logger.success('Excel enviado');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/exports/leaders/excel
 * Exporta líderes como Excel
 */
export async function exportLeadersExcel(req, res, next) {
  try {
    logger.info('Solicitando export líderes Excel');

    const buffer = await exportsService.exportLeadersExcel();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="leaders-${new Date().toISOString().split('T')[0]}.xlsx"`);
    res.send(buffer);

    logger.success('Excel líderes enviado');
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v2/exports/qr/:puestoId
 * Genera QR code para un puesto
 */
export async function getPuestoQR(req, res, next) {
  try {
    const { puestoId } = req.params;

    if (!puestoId) {
      throw AppError.badRequest('Puesto ID requerido');
    }

    logger.info('Generando QR', { puestoId });

    const qrCode = await exportsService.generatePuestoQR(puestoId);

    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from(qrCode.split(',')[1], 'base64'));

    logger.success('QR enviado');
  } catch (error) {
    // Si el error es isOperational, manejar appropriately
    if (error.isOperational) {
      next(error);
    } else {
      // Si es un error de imagen, intentar devolver como base64
      try {
        res.json({
          success: true,
          message: 'QR Code',
          data: error.message // en caso de que sea el QR mismo
        });
      } catch (e) {
        next(error);
      }
    }
  }
}

/**
 * GET /api/v2/exports/qr/:puestoId/base64
 * Genera QR code en base64
 */
export async function getPuestoQRBase64(req, res, next) {
  try {
    const { puestoId } = req.params;

    if (!puestoId) {
      throw AppError.badRequest('Puesto ID requerido');
    }

    logger.info('Generando QR base64', { puestoId });

    const qrCode = await exportsService.generatePuestoQR(puestoId);

    res.json({
      success: true,
      message: 'QR Code',
      data: {
        puestoId,
        qr: qrCode,
        timestamp: new Date()
      }
    });

    logger.success('QR base64 enviado');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v2/exports/pdf/report
 * Genera reporte en PDF (futuro)
 */
export async function generateReport(req, res, next) {
  try {
    const eventId = req.query.eventId || req.body?.eventId || null;
    const status = req.query.status || req.body?.status || 'all';
    const leaderId = req.query.leaderId || req.body?.leaderId || null;
    const targetDate = req.query.targetDate || req.body?.targetDate || null;
    const region = req.query.region || req.body?.region || 'nacional';

    logger.info('Solicitando PDF report', { eventId, status, leaderId, targetDate, region });

    const pdf = await exportsService.generateReportPDF({
      eventId,
      status,
      leaderId,
      targetDate,
      region
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
}

export default {
  exportRegistrationsCSV,
  exportRegistrationsExcel,
  exportLeadersExcel,
  getPuestoQR,
  getPuestoQRBase64,
  generateReport
};
