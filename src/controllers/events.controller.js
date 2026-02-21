import { Event } from "../models/Event.js";
import { Registration } from "../models/Registration.js";
import { Organization } from "../models/Organization.js";
import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";

export async function createEvent(req, res) {
  try {
    const user = req.user;
    const { name, description, date, location } = req.body;

    if (!name) {
      return res.status(400).json({ error: "name es requerido" });
    }

    let organizationId = req.user?.organizationId || req.organizationId;
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

    if (!organizationId) {
      organizationId = "default";
    }

    const resolvedOrganizationId = organizationId || "default";

    const event = new Event({
      name,
      description,
      date,
      location,
      active: true,
      registrationCount: 0,
      confirmedCount: 0,
      organizationId: resolvedOrganizationId
    });

    await event.save();

    await AuditService.log("CREATE", "Event", event._id.toString(), user, { name }, `Evento ${name} creado`);

    res.status(201).json(event);
  } catch (error) {
    logger.error("Create event error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al crear evento" });
  }
}

export async function getEvents(req, res) {
  try {
    const { active } = req.query;
    const filter = buildOrgFilter(req); // Multi-tenant filtering

    if (active !== undefined) filter.active = active === "true";

    const events = await Event.find(filter).sort({ date: -1 });
    res.json(events);
  } catch (error) {
    logger.error("Get events error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener eventos" });
  }
}

export async function getEvent(req, res) {
  try {
    const orgId = req.user.organizationId; // Multi-tenant filter
    const event = await Event.findOne({ _id: req.params.id, organizationId: orgId });
    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const registrationCount = await Registration.countDocuments({ eventId: event._id.toString(), organizationId: orgId });
    const confirmedCount = await Registration.countDocuments({ eventId: event._id.toString(), confirmed: true, organizationId: orgId });

    res.json({
      ...event.toObject(),
      registrationCount,
      confirmedCount
    });
  } catch (error) {
    logger.error("Get event error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener evento" });
  }
}

export async function updateEvent(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter
    const { name, description, date, location, active } = req.body;

    const event = await Event.findOne({ _id: req.params.id, organizationId: orgId });
    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const changes = {};
    if (name !== undefined) {
      changes.name = { old: event.name, new: name };
      event.name = name;
    }
    if (description !== undefined) {
      changes.description = { old: event.description, new: description };
      event.description = description;
    }
    if (date !== undefined) {
      changes.date = { old: event.date, new: date };
      event.date = date;
    }
    if (location !== undefined) {
      changes.location = { old: event.location, new: location };
      event.location = location;
    }
    if (active !== undefined) {
      changes.active = { old: event.active, new: active };
      event.active = active;
    }

    event.updatedAt = new Date();
    await event.save();

    await AuditService.log("UPDATE", "Event", event._id.toString(), user, changes, `Evento ${event.name} actualizado`);

    res.json(event);
  } catch (error) {
    logger.error("Update event error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al actualizar evento" });
  }
}

export async function deleteEvent(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter
    const event = await Event.findOne({ _id: req.params.id, organizationId: orgId });

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    const registrationCount = await Registration.countDocuments({ eventId: event._id.toString(), organizationId: orgId });

    await Event.deleteOne({ _id: req.params.id });

    await AuditService.log("DELETE", "Event", event._id.toString(), user, { registrations: registrationCount }, `Evento ${event.name} eliminado`);

    res.json({ message: "Evento eliminado", registrationsCount: registrationCount });
  } catch (error) {
    logger.error("Delete event error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al eliminar evento" });
  }
}

export async function getActiveEvent(req, res) {
  try {
    const orgId = req.user.organizationId; // Multi-tenant filter
    const event = await Event.findOne({ active: true, organizationId: orgId }).sort({ createdAt: -1 });
    
    if (!event) {
      return res.status(404).json({ error: "No hay evento activo" });
    }

    const registrationCount = await Registration.countDocuments({ eventId: event._id.toString(), organizationId: orgId });
    const confirmedCount = await Registration.countDocuments({ eventId: event._id.toString(), confirmed: true, organizationId: orgId });

    res.json({
      ...event.toObject(),
      registrationCount,
      confirmedCount
    });
  } catch (error) {
    logger.error("Get active event error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener evento activo" });
  }
}
