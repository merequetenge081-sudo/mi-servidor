import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { Puestos } from "../models/index.js";
import { AuditService } from "../services/audit.service.js";
import ExcelJS from "exceljs";
import logger from "../config/logger.js";

export async function exportData(req, res) {
  try {
    const user = req.user;
    const { type, eventId } = req.query;

    if (!["registrations", "leaders", "events"].includes(type)) {
      return res.status(400).json({ error: "Tipo de export inválido" });
    }

    const workbook = new ExcelJS.Workbook();

    if (type === "registrations" || type === "all") {
      const worksheet = workbook.addWorksheet("Registros");
      const filter = eventId ? { eventId } : {};
      const registrations = await Registration.find(filter).lean();
      const puestoIds = [...new Set(registrations.map(reg => reg.puestoId).filter(Boolean).map(id => id.toString()))];
      const puestos = puestoIds.length > 0
        ? await Puestos.find({ _id: { $in: puestoIds } }).lean()
        : [];
      const puestoById = new Map(puestos.map(puesto => [puesto._id.toString(), puesto]));

      worksheet.columns = [
        { header: "Cédula", key: "cedula", width: 15 },
        { header: "Nombre", key: "firstName", width: 20 },
        { header: "Apellido", key: "lastName", width: 20 },
        { header: "Email", key: "email", width: 30 },
        { header: "Teléfono", key: "phone", width: 15 },
        { header: "Localidad", key: "localidad", width: 20 },
        { header: "Registrado a Votar", key: "registeredToVote", width: 20 },
        { header: "Puesto de Votación", key: "puestoNombre", width: 30 },
        { header: "Mesa", key: "mesa", width: 10 },
        { header: "Confirmado", key: "confirmed", width: 15 },
        { header: "Fecha de Registro", key: "date", width: 15 }
      ];

      registrations.forEach(reg => {
        const puesto = reg.puestoId ? puestoById.get(reg.puestoId.toString()) : null;
        worksheet.addRow({
          cedula: reg.cedula,
          firstName: reg.firstName,
          lastName: reg.lastName,
          email: reg.email,
          phone: reg.phone,
          localidad: reg.localidad,
          registeredToVote: reg.registeredToVote ? "Sí" : "No",
          puestoNombre: puesto?.nombre || "-",
          mesa: reg.mesa ?? "-",
          confirmed: reg.confirmed ? "Confirmado" : "Pendiente",
          date: reg.date
        });
      });
    }

    if (type === "leaders" || type === "all") {
      const worksheet = workbook.addWorksheet("Líderes");
      const leaders = await Leader.find();

      worksheet.columns = [
        { header: "ID Líder", key: "leaderId", width: 15 },
        { header: "Nombre", key: "name", width: 25 },
        { header: "Email", key: "email", width: 30 },
        { header: "Teléfono", key: "phone", width: 15 },
        { header: "Área", key: "area", width: 20 },
        { header: "Registros", key: "registrations", width: 12 },
        { header: "Activo", key: "active", width: 10 }
      ];

      leaders.forEach(leader => {
        worksheet.addRow({
          leaderId: leader.leaderId,
          name: leader.name,
          email: leader.email,
          phone: leader.phone,
          area: leader.area,
          registrations: leader.registrations,
          active: leader.active ? "Sí" : "No"
        });
      });
    }

    if (type === "events" || type === "all") {
      const worksheet = workbook.addWorksheet("Eventos");
      const events = await Event.find();

      worksheet.columns = [
        { header: "Nombre", key: "name", width: 25 },
        { header: "Descripción", key: "description", width: 30 },
        { header: "Fecha", key: "date", width: 15 },
        { header: "Ubicación", key: "location", width: 25 },
        { header: "Activo", key: "active", width: 10 }
      ];

      events.forEach(event => {
        worksheet.addRow({
          name: event.name,
          description: event.description,
          date: event.date,
          location: event.location,
          active: event.active ? "Sí" : "No"
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
    res.status(500).json({ error: "Error al exportar datos" });
  }
}
