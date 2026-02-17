import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { AuditService } from "../services/audit.service.js";
import { ValidationService } from "../services/validation.service.js";
import logger from "../config/logger.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";

export async function createRegistration(req, res) {
  try {
    const user = req.user;
    const { leaderId, leaderName, eventId, firstName, lastName, cedula, email, phone, localidad, registeredToVote, votingPlace, votingTable, date } = req.body;

    // Validate
    const validation = ValidationService.validateRegistration({ leaderId, eventId, firstName, lastName, cedula, registeredToVote, votingPlace, votingTable });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Validate leader is active
    const leader = await Leader.findOne({ leaderId });
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }
    if (!leader.active) {
      return res.status(403).json({ error: "El líder está inactivo" });
    }

    // Get event to inherit organizationId
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    // Check duplicate by cedula + eventId
    const duplicate = await ValidationService.checkDuplicate(cedula, eventId);
    if (duplicate) {
      return res.status(400).json({ error: `Persona con cédula ${cedula} ya registrada en este evento` });
    }

    const registration = new Registration({
      leaderId,
      leaderName,
      eventId,
      firstName,
      lastName,
      cedula,
      email,
      phone,
      localidad,
      registeredToVote,
      votingPlace,
      votingTable,
      date: date || new Date().toISOString(),
      notifications: {
        emailSent: false,
        smsSent: false,
        whatsappSent: false
      },
      confirmed: false,
      organizationId: event.organizationId || null // Inherit from event
    });

    await registration.save();

    // Increment leader registration count
    await Leader.updateOne({ leaderId }, { $inc: { registrations: 1 } });

    await AuditService.log("CREATE", "Registration", registration._id.toString(), user, { cedula, leaderId }, `Registro de ${firstName} ${lastName} creado`);

    res.status(201).json(registration);
  } catch (error) {
    logger.error("Create registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al crear registro" });
  }
}

export async function getRegistrations(req, res) {
  try {
    const { eventId, leaderId, confirmed, cedula, page = 1, limit = 50 } = req.query;
    const filter = buildOrgFilter(req); // Multi-tenant filtering

    if (eventId) filter.eventId = eventId;
    if (leaderId) filter.leaderId = leaderId;
    if (confirmed !== undefined) filter.confirmed = confirmed === "true";
    if (cedula) filter.cedula = cedula;

    // Force maximum limit of 100
    let parsedLimit = parseInt(limit) || 50;
    parsedLimit = Math.min(parsedLimit, 100);

    const skip = (page - 1) * parsedLimit;
    const registrations = await Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit);

    const total = await Registration.countDocuments(filter);

    res.json({
      data: registrations,
      total,
      page: parseInt(page),
      limit: parsedLimit,
      pages: Math.ceil(total / parsedLimit)
    });
  } catch (error) {
    logger.error("Get registrations error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener registros" });
  }
}

export async function getRegistration(req, res) {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    res.json(registration);
  } catch (error) {
    logger.error("Get registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener registro" });
  }
}

export async function updateRegistration(req, res) {
  try {
    const user = req.user;
    const { firstName, lastName, email, phone, localidad, registeredToVote, votingPlace, votingTable } = req.body;

    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Check voting data if needed
    if (registeredToVote !== undefined) {
      const votingValidation = ValidationService.validateVotingData(registeredToVote, votingPlace, votingTable);
      if (!votingValidation.valid) {
        return res.status(400).json({ error: votingValidation.error });
      }
    }

    const changes = {};
    if (firstName !== undefined && firstName !== registration.firstName) {
      changes.firstName = { old: registration.firstName, new: firstName };
      registration.firstName = firstName;
    }
    if (lastName !== undefined && lastName !== registration.lastName) {
      changes.lastName = { old: registration.lastName, new: lastName };
      registration.lastName = lastName;
    }
    if (email !== undefined && email !== registration.email) {
      changes.email = { old: registration.email, new: email };
      registration.email = email;
    }
    if (phone !== undefined && phone !== registration.phone) {
      changes.phone = { old: registration.phone, new: phone };
      registration.phone = phone;
    }
    if (localidad !== undefined && localidad !== registration.localidad) {
      changes.localidad = { old: registration.localidad, new: localidad };
      registration.localidad = localidad;
    }
    if (registeredToVote !== undefined && registeredToVote !== registration.registeredToVote) {
      changes.registeredToVote = { old: registration.registeredToVote, new: registeredToVote };
      registration.registeredToVote = registeredToVote;
    }
    if (votingPlace !== undefined && votingPlace !== registration.votingPlace) {
      changes.votingPlace = { old: registration.votingPlace, new: votingPlace };
      registration.votingPlace = votingPlace;
    }
    if (votingTable !== undefined && votingTable !== registration.votingTable) {
      changes.votingTable = { old: registration.votingTable, new: votingTable };
      registration.votingTable = votingTable;
    }

    registration.updatedAt = new Date();
    await registration.save();

    await AuditService.log("UPDATE", "Registration", registration._id.toString(), user, changes, `Registro ${registration.cedula} actualizado`);

    res.json(registration);
  } catch (error) {
    logger.error("Update registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al actualizar registro" });
  }
}

export async function deleteRegistration(req, res) {
  try {
    const user = req.user;
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const leaderId = registration.leaderId;
    await Registration.deleteOne({ _id: req.params.id });

    // Decrement leader registration count
    await Leader.updateOne({ leaderId }, { $inc: { registrations: -1 } });

    await AuditService.log("DELETE", "Registration", req.params.id, user, { cedula: registration.cedula }, `Registro eliminado`);

    res.json({ message: "Registro eliminado" });
  } catch (error) {
    logger.error("Delete registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al eliminar registro" });
  }
}

export async function confirmRegistration(req, res) {
  try {
    const user = req.user;
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    if (registration.confirmed) {
      return res.status(400).json({ error: "Registro ya está confirmado" });
    }

    registration.confirmed = true;
    registration.confirmedBy = user?.username || "system";
    registration.confirmedAt = new Date();

    await registration.save();

    await AuditService.log("CONFIRM", "Registration", registration._id.toString(), user, { cedula: registration.cedula }, `Registro confirmado`);

    res.json(registration);
  } catch (error) {
    logger.error("Confirm registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al confirmar registro" });
  }
}

export async function unconfirmRegistration(req, res) {
  try {
    const user = req.user;
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    if (!registration.confirmed) {
      return res.status(400).json({ error: "Registro no está confirmado" });
    }

    registration.confirmed = false;
    registration.confirmedBy = null;
    registration.confirmedAt = null;

    await registration.save();

    await AuditService.log("UNCONFIRM", "Registration", registration._id.toString(), user, { cedula: registration.cedula }, `Confirmación de registro revertida`);

    res.json(registration);
  } catch (error) {
    logger.error("Unconfirm registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al revertir confirmación" });
  }
}

export async function getRegistrationsByLeader(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;
    const { eventId, confirmed, page = 1, limit = 50 } = req.query;

    // Control de acceso: leaders solo pueden ver sus propios registros
    if (user.role === "leader" && user.leaderId !== leaderId) {
      return res.status(403).json({ error: "No tienes permiso para ver estos registros" });
    }

    const filter = { leaderId };
    if (eventId) filter.eventId = eventId;
    if (confirmed !== undefined) filter.confirmed = confirmed === "true";

    const skip = (page - 1) * limit;
    const registrations = await Registration.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Registration.countDocuments(filter);
    const confirmedCount = await Registration.countDocuments({ ...filter, confirmed: true });

    res.json({
      data: registrations,
      total,
      confirmedCount,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error("Get registrations by leader error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener registros del líder" });
  }
}
