import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import duplicatesRepository from "../backend/modules/duplicates/duplicates.repository.js";

export async function getDuplicates(req, res) {
  try {
    const { eventId } = req.query;
    const duplicates = await duplicatesRepository.findDuplicatesByCedula(eventId || null);

    const result = [];
    for (const dup of duplicates) {
      const duplicateEventId = eventId || dup.records?.[0]?.eventId || null;
      const registrations = await duplicatesRepository.getDuplicateDetails(dup._id, duplicateEventId);
      result.push({
        cedula: dup._id,
        count: dup.count,
        registrations
      });
    }

    res.json(result);
  } catch (error) {
    logger.error("Get duplicates error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al obtener duplicados", "GET_DUPLICATES_ERROR", error.message);
  }
}
