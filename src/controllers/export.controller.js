import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { Puestos } from "../models/index.js";
import { AuditService } from "../services/audit.service.js";
import ExcelJS from "exceljs";
import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import exportsService from "../backend/modules/exports/exports.service.js";

const yesNo = (value) => (value ? "Sí" : "No");

const registrationColumns = [
  { header: "Cédula", key: "cedula", width: 15 },
  { header: "Nombre", key: "firstName", width: 20 },
  { header: "Apellido", key: "lastName", width: 20 },
  { header: "Teléfono", key: "phone", width: 15 },
  { header: "Localidad", key: "localidad", width: 20 },
  { header: "Registrado a Votar", key: "registeredToVote", width: 20 },
  { header: "Puesto de Votación", key: "puestoNombre", width: 30 },
  { header: "Mesa", key: "mesa", width: 10 },
  { header: "Confirmado", key: "confirmed", width: 15 },
  { header: "Fecha de Registro", key: "date", width: 15 }
];

const leaderColumns = [
  { header: "ID Líder", key: "leaderId", width: 15 },
  { header: "Nombre", key: "name", width: 25 },
  { header: "Teléfono", key: "phone", width: 15 },
  { header: "Área", key: "area", width: 20 },
  { header: "Registros", key: "registrations", width: 12 },
  { header: "Activo", key: "active", width: 10 }
];

const eventColumns = [
  { header: "Nombre", key: "name", width: 25 },
  { header: "Descripción", key: "description", width: 30 },
  { header: "Fecha", key: "date", width: 15 },
  { header: "Ubicación", key: "location", width: 25 },
  { header: "Activo", key: "active", width: 10 }
];

export async function exportData(req, res) {
  try {
    const user = req.user;
    const type = req.params.type || req.query.type;
    const { eventId } = req.query;
    const page = Number.parseInt(req.query.page, 10);
    const pageSizeRaw = Number.parseInt(req.query.pageSize || req.query.limit, 10);
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(pageSizeRaw, 50000)
      : 5000;

    if (!["registrations", "leaders", "events", "all"].includes(type)) {
      return sendError(res, 400, "Tipo de export inválido");
    }

    // Delegate to modular service for simple single-sheet exports.
    if (type === "leaders") {
      const leadersBuffer = await exportsService.exportLeadersExcel();
      await AuditService.log("EXPORT", "LEADERS", "", user, { type }, "Datos de leaders exportados");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="export-${type}-${new Date().toISOString().split("T")[0]}.xlsx"`);
      return res.send(leadersBuffer);
    }

    if (type === "registrations") {
      const pageSizeRaw = Number.parseInt(req.query.pageSize || req.query.limit, 10);
      const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(pageSizeRaw, 50000) : 5000;
      const page = Number.parseInt(req.query.page, 10);
      const pagedResult = await exportsService.exportRegistrationsExcelPaged(eventId || null, { page, pageSize });

      res.setHeader("X-Export-Total", pagedResult.meta.total);
      res.setHeader("X-Export-Page-Size", pagedResult.meta.pageSize);
      res.setHeader("X-Export-Total-Pages", pagedResult.meta.totalPages);
      if (pagedResult.meta.requestedPage) {
        res.setHeader("X-Export-Page", pagedResult.meta.requestedPage);
      }

      await AuditService.log("EXPORT", "REGISTRATIONS", "", user, { type, eventId: eventId || null }, "Datos de registrations exportados");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="export-${type}-${new Date().toISOString().split("T")[0]}.xlsx"`);
      return res.send(pagedResult.buffer);
    }

    const workbook = new ExcelJS.Workbook();

    if (type === "registrations" || type === "all") {
      const filter = eventId ? { eventId } : {};
      const total = await Registration.countDocuments(filter);
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const requestedPage = Number.isFinite(page) && page > 0 ? Math.min(page, totalPages) : null;
      const pages = requestedPage ? [requestedPage] : Array.from({ length: totalPages }, (_, i) => i + 1);

      res.setHeader("X-Export-Total", total);
      res.setHeader("X-Export-Page-Size", pageSize);
      res.setHeader("X-Export-Total-Pages", totalPages);
      if (requestedPage) {
        res.setHeader("X-Export-Page", requestedPage);
      }

      for (const currentPage of pages) {
        const worksheetName = requestedPage ? "Registros" : `Registros_${currentPage}`;
        const worksheet = workbook.addWorksheet(worksheetName);
        const registrations = await Registration.find(filter)
          .skip((currentPage - 1) * pageSize)
          .limit(pageSize)
          .lean();

        const puestoIds = [...new Set(
          registrations
            .map(reg => reg.puestoId)
            .filter(Boolean)
            .map(id => id.toString())
        )];

        const puestos = puestoIds.length > 0
          ? await Puestos.find({ _id: { $in: puestoIds } }).lean()
          : [];
        const puestoById = new Map(puestos.map(puesto => [puesto._id.toString(), puesto]));

        worksheet.columns = registrationColumns;

        registrations.forEach(reg => {
          const puesto = reg.puestoId ? puestoById.get(reg.puestoId.toString()) : null;
          worksheet.addRow({
            cedula: reg.cedula,
            firstName: reg.firstName,
            lastName: reg.lastName,
            phone: reg.phone,
            localidad: reg.localidad,
            registeredToVote: yesNo(reg.registeredToVote),
            puestoNombre: puesto?.nombre || "-",
            mesa: reg.mesa ?? "-",
            confirmed: reg.confirmed ? "Confirmado" : "Pendiente",
            date: reg.date
          });
        });
      }
    }

    if (type === "leaders" || type === "all") {
      const worksheet = workbook.addWorksheet("Líderes");
      const leaders = await Leader.find();

      worksheet.columns = leaderColumns;

      leaders.forEach(leader => {
        worksheet.addRow({
          leaderId: leader.leaderId,
          name: leader.name,
          phone: leader.phone,
          area: leader.area,
          registrations: leader.registrations,
          active: yesNo(leader.active)
        });
      });
    }

    if (type === "events" || type === "all") {
      const worksheet = workbook.addWorksheet("Eventos");
      const events = await Event.find();

      worksheet.columns = eventColumns;

      events.forEach(event => {
        worksheet.addRow({
          name: event.name,
          description: event.description,
          date: event.date,
          location: event.location,
          active: yesNo(event.active)
        });
      });
    }

    await AuditService.log("EXPORT", type.toUpperCase(), "", user, { type }, `Datos de ${type} exportados`);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="export-${type}-${new Date().toISOString().split("T")[0]}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error("Export error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al exportar datos", "EXPORT_DATA_ERROR", error.message);
  }
}



