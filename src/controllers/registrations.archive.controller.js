import { Registration, ArchivedRegistration } from "../models/index.js";
import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";

export async function searchArchivedByCedula(req, res) {
  try {
    const { cedula } = req.params;
    const orgId = req.user?.organizationId;

    if (!cedula) {
      return sendError(res, 400, "Cédula requerida");
    }

    const archived = await ArchivedRegistration.findOne({
      cedula,
      organizationId: orgId
    })
      .sort({ archivedAt: -1 })
      .lean();

    if (!archived) {
      return res.json({ found: false, data: null });
    }

    return res.json({
      found: true,
      data: {
        firstName: archived.firstName,
        lastName: archived.lastName,
        email: archived.email,
        phone: archived.phone,
        localidad: archived.localidad,
        departamento: archived.departamento,
        capital: archived.capital,
        votingPlace: archived.votingPlace,
        votingTable: archived.votingTable,
        registeredToVote: archived.registeredToVote
      }
    });
  } catch (error) {
    logger.error("Search archived registration error:", error);
    return sendError(res, 500, "Error al buscar registro archivado", "SEARCH_ARCHIVED_BY_CEDULA_ERROR", error.message);
  }
}

export async function getArchivedStats(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    if (user.role !== "admin") {
      return sendError(res, 403, "Acceso denegado");
    }

    const totalArchived = await ArchivedRegistration.countDocuments({ organizationId: orgId });
    const uniqueCedulas = await ArchivedRegistration.distinct("cedula", { organizationId: orgId });

    return res.json({
      success: true,
      totalArchived,
      uniquePersons: uniqueCedulas.length
    });
  } catch (error) {
    logger.error("Get archived stats error:", error);
    return sendError(res, 500, "Error al obtener estadísticas de archivos", "GET_ARCHIVED_STATS_ERROR", error.message);
  }
}

export async function fixNames(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { eventId } = req.body;

    const query = { organizationId: orgId };
    if (eventId) query.eventId = eventId;

    const registrations = await Registration.find(query);
    let updatedCount = 0;

    for (const reg of registrations) {
      const dedupeName = (s) => {
        const str = String(s || "").trim();
        const parts = str.split(" ").filter(Boolean);
        if (parts.length === 2 && parts[0].toLowerCase() === parts[1].toLowerCase()) return parts[0];
        return str;
      };
      const titleCase = (s) => String(s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

      const firstName = titleCase(dedupeName(reg.firstName));
      const lastName = titleCase(dedupeName(reg.lastName));

      if (reg.firstName !== firstName || reg.lastName !== lastName) {
        await Registration.updateOne({ _id: reg._id }, { $set: { firstName, lastName } });
        updatedCount++;
      }
    }

    return res.json({ success: true, message: `${updatedCount} nombres corregidos.`, updated: updatedCount });
  } catch (error) {
    logger.error("Fix names error:", error);
    return sendError(res, 500, "Error al corregir nombres", "FIX_NAMES_ERROR", error.message);
  }
}
