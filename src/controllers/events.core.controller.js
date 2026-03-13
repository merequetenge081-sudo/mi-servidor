import { Organization } from "../models/Organization.js";
import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";
import { EventService } from "../backend/modules/events/event.service.js";

const eventService = new EventService();

async function resolveOrganizationId(req) {
  let organizationId = req.user?.organizationId || req.organizationId || null;

  if (!organizationId) {
    let defaultOrg = await Organization.findOne({ slug: "default" });
    if (!defaultOrg) {
      defaultOrg = new Organization({
        name: "Default Organization",
        slug: "default",
        description: "Organizacion por defecto para eventos",
        status: "active",
        plan: "pro"
      });
      await defaultOrg.save();
    }
    organizationId = defaultOrg._id.toString();
  }

  return organizationId || "default";
}

function handleEventError(res, error, fallbackMessage, fallbackCode) {
  logger.error(fallbackMessage, { error: error.message, stack: error.stack });
  const status = error?.statusCode || 500;
  return sendError(res, status, error?.message || fallbackMessage, fallbackCode, error?.details ?? error?.message);
}

export async function createEvent(req, res) {
  try {
    const user = req.user;
    const { name, description, date, location } = req.body;

    if (!name) {
      return sendError(res, 400, "name es requerido");
    }

    const organizationId = await resolveOrganizationId(req);
    const event = await eventService.createEvent(
      {
        name,
        description,
        date,
        location,
        active: true
      },
      organizationId,
      user?._id || user?.userId || null
    );

    return res.status(201).json(event);
  } catch (error) {
    return handleEventError(res, error, "Error al crear evento", "CREATE_EVENT_ERROR");
  }
}

export async function getEvents(req, res) {
  try {
    const { active } = req.query;
    const organizationId = await resolveOrganizationId(req);

    const result = await eventService.getEvents(organizationId, {
      page: 1,
      pageSize: 1000,
      active: active !== undefined ? active === "true" : undefined
    });

    return res.json(result.data);
  } catch (error) {
    return handleEventError(res, error, "Error al obtener eventos", "GET_EVENTS_ERROR");
  }
}

export async function getEvent(req, res) {
  try {
    const organizationId = await resolveOrganizationId(req);
    const event = await eventService.getEvent(req.params.id, organizationId);
    return res.json(event);
  } catch (error) {
    return handleEventError(res, error, "Error al obtener evento", "GET_EVENT_ERROR");
  }
}

export async function updateEvent(req, res) {
  try {
    const user = req.user;
    const organizationId = await resolveOrganizationId(req);
    const { name, description, date, location, active } = req.body;

    const event = await eventService.updateEvent(
      req.params.id,
      { name, description, date, location, active },
      organizationId,
      user?._id || user?.userId || null
    );

    return res.json(event);
  } catch (error) {
    return handleEventError(res, error, "Error al actualizar evento", "UPDATE_EVENT_ERROR");
  }
}

export async function deleteEvent(req, res) {
  try {
    const user = req.user;
    const organizationId = await resolveOrganizationId(req);

    const currentEvent = await eventService.getEvent(req.params.id, organizationId);
    const registrationsCount = currentEvent.registrationCount || 0;

    await eventService.deleteEvent(req.params.id, organizationId, user?._id || user?.userId || null);

    return res.json({ message: "Evento eliminado", registrationsCount });
  } catch (error) {
    return handleEventError(res, error, "Error al eliminar evento", "DELETE_EVENT_ERROR");
  }
}

export async function getActiveEvent(req, res) {
  try {
    const organizationId = await resolveOrganizationId(req);
    const event = await eventService.getActiveEvent(organizationId);
    return res.json(event);
  } catch (error) {
    return handleEventError(res, error, "Error al obtener evento activo", "GET_ACTIVE_EVENT_ERROR");
  }
}
