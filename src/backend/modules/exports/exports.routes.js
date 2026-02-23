/**
 * Exports Routes
 * Rutas para exportación de datos
 */

import express from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import * as exportsController from './exports.controller.js';

const router = express.Router();

/**
 * POST /api/v2/exports/registrations/csv
 * Exporta registraciones como CSV (protegido)
 * Query: eventId?
 */
router.post('/registrations/csv', authMiddleware, exportsController.exportRegistrationsCSV);

/**
 * POST /api/v2/exports/registrations/excel
 * Exporta registraciones como Excel (protegido)
 * Query: eventId?
 */
router.post('/registrations/excel', authMiddleware, exportsController.exportRegistrationsExcel);

/**
 * POST /api/v2/exports/leaders/excel
 * Exporta líderes como Excel (protegido)
 */
router.post('/leaders/excel', authMiddleware, exportsController.exportLeadersExcel);

/**
 * GET /api/v2/exports/qr/:puestoId
 * Genera QR code para un puesto (público)
 * Returns: PNG image
 */
router.get('/qr/:puestoId', exportsController.getPuestoQR);

/**
 * GET /api/v2/exports/qr/:puestoId/base64
 * Genera QR code en base64 (público)
 * Returns: JSON con base64 string
 */
router.get('/qr/:puestoId/base64', exportsController.getPuestoQRBase64);

/**
 * POST /api/v2/exports/pdf/report
 * Genera reporte en PDF (protegido - futuro)
 * Query: eventId?
 */
router.post('/pdf/report', authMiddleware, exportsController.generateReport);

export default router;
