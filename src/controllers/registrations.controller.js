import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { Organization } from "../models/Organization.js";
import { Puestos } from "../models/index.js";
import { AuditService } from "../services/audit.service.js";
import { ValidationService } from "../services/validation.service.js";
import { ConsentLogService } from "../services/consentLog.service.js";
import logger from "../config/logger.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";

export async function createRegistration(req, res) {
  try {
    const user = req.user;
    const { leaderId, leaderToken, leaderName, eventId, firstName, lastName, cedula, email, phone, localidad, registeredToVote, puestoId, mesa, date, hasConsentToRegister } = req.body;

    // Verificar consentimiento del líder (Ley 1581 de 2012)
    if (!hasConsentToRegister) {
      return res.status(400).json({ 
        error: "Debes declarar que tienes autorización del titular para registrar esta información.",
        code: "CONSENT_REQUIRED"
      });
    }

    let leader = null;
    if (leaderId) {
      leader = await Leader.findOne({ leaderId });
    }

    if (!leader && leaderToken) {
      leader = await Leader.findOne({ $or: [{ token: leaderToken }, { leaderId: leaderToken }] });
    }

    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    if (!leader.active) {
      return res.status(403).json({ error: "El líder está inactivo" });
    }

    const resolvedLeaderId = leader.leaderId || leader._id?.toString();
    if (!resolvedLeaderId) {
      return res.status(400).json({ error: "leaderId es requerido" });
    }

    let orgId = leader.organizationId;
    if (!orgId) {
      let defaultOrg = await Organization.findOne({ slug: "default" });
      if (!defaultOrg) {
        defaultOrg = new Organization({
          name: "Default Organization",
          slug: "default",
          description: "Organización por defecto",
          status: "active",
          plan: "pro"
        });
        await defaultOrg.save();
      }
      orgId = defaultOrg._id.toString();
      await Leader.updateOne({ _id: leader._id }, { $set: { organizationId: orgId } });
    }

    let resolvedEventId = eventId || leader.eventId;
    if (!resolvedEventId) {
      const fallbackEvent = await Event.findOne({ organizationId: orgId, active: true }).select("_id");
      resolvedEventId = fallbackEvent?._id?.toString();
    }

    const validation = ValidationService.validateRegistration({ leaderId: resolvedLeaderId, eventId: resolvedEventId, firstName, lastName, cedula, registeredToVote, puestoId, mesa });
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const event = await Event.findById(resolvedEventId);
    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    if (!event.organizationId && orgId) {
      await Event.updateOne({ _id: event._id }, { $set: { organizationId: orgId } });
    }

    const duplicate = await ValidationService.checkDuplicate(cedula, resolvedEventId);
    if (duplicate) {
      return res.status(400).json({ error: `Persona con cédula ${cedula} ya registrada en este evento` });
    }

    const organizationId = leader.organizationId || event.organizationId || orgId;
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId es requerido" });
    }

    const normalizedMesa = mesa !== undefined && mesa !== null ? Number(mesa) : null;
    let resolvedPuestoId = puestoId || null;
    let resolvedMesa = normalizedMesa;
    let resolvedLocalidad = localidad;

    if (registeredToVote) {
      if (!resolvedPuestoId || !mongoose.Types.ObjectId.isValid(resolvedPuestoId)) {
        return res.status(400).json({ error: "puestoId inválido o requerido" });
      }
      if (resolvedMesa === null || Number.isNaN(resolvedMesa)) {
        return res.status(400).json({ error: "mesa inválida o requerida" });
      }

      const puesto = await Puestos.findById(resolvedPuestoId).lean();
      if (!puesto || puesto.activo === false) {
        return res.status(400).json({ error: "puestoId no existe o no está activo" });
      }
      if (!Array.isArray(puesto.mesas) || !puesto.mesas.includes(resolvedMesa)) {
        return res.status(400).json({ error: "mesa no pertenece al puesto seleccionado" });
      }

      resolvedLocalidad = puesto.localidad || resolvedLocalidad;
    } else {
      resolvedPuestoId = null;
      resolvedMesa = null;
    }

    const registration = new Registration({
      leaderId: resolvedLeaderId,
      leaderName: leaderName || leader.name,
      eventId: resolvedEventId,
      firstName,
      lastName,
      cedula,
      email,
      phone,
      localidad: resolvedLocalidad,
      registeredToVote,
      puestoId: resolvedPuestoId,
      mesa: resolvedMesa,
      date: date || new Date().toISOString(),
      notifications: {
        emailSent: false,
        smsSent: false,
        whatsappSent: false
      },
      confirmed: false,
      organizationId: organizationId,
      hasConsentToRegister: true
    });

    await registration.save();

    await Leader.updateOne({ _id: leader._id }, { $inc: { registrations: 1 } });

    await AuditService.log("CREATE", "Registration", registration._id.toString(), user, { cedula, leaderId: resolvedLeaderId }, `Registro de ${firstName} ${lastName} creado`);

    await ConsentLogService.logCitizenRegistered(req, leader._id, registration._id, {
      cedula,
      firstName,
      lastName,
      eventId: resolvedEventId
    });

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
    parsedLimit = Math.min(parsedLimit, 2000);

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
    const orgId = req.user.organizationId; // Multi-tenant filter
    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId });
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
    const orgId = req.user.organizationId; // Multi-tenant filter
    const { firstName, lastName, email, phone, localidad, registeredToVote, puestoId, mesa } = req.body;


    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId });
    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Ownership Check: Leaders can only update their own registrations
    console.log(`[DEBUG] Update Check - User Role: ${user.role}, User LeaderId: ${user.leaderId}, Reg LeaderId: ${registration.leaderId}`);

    if (user.role !== 'admin' && registration.leaderId !== user.leaderId) {
      return res.status(403).json({ error: `No tienes permiso. Tu ID: ${user.leaderId}, Dueño: ${registration.leaderId}` });
    }

    // Check voting data if needed
    const nextRegisteredToVote = registeredToVote !== undefined ? registeredToVote : registration.registeredToVote;
    const nextPuestoId = puestoId !== undefined ? puestoId : registration.puestoId;
    const nextMesaRaw = mesa !== undefined ? mesa : registration.mesa;
    const nextMesa = nextMesaRaw !== undefined && nextMesaRaw !== null ? Number(nextMesaRaw) : null;

    if (nextRegisteredToVote) {
      const votingValidation = ValidationService.validateVotingData(nextRegisteredToVote, nextPuestoId, nextMesa);
      if (!votingValidation.valid) {
        return res.status(400).json({ error: votingValidation.error });
      }

      if (!mongoose.Types.ObjectId.isValid(nextPuestoId)) {
        return res.status(400).json({ error: "puestoId inválido" });
      }

      const puesto = await Puestos.findById(nextPuestoId).lean();
      if (!puesto || puesto.activo === false) {
        return res.status(400).json({ error: "puestoId no existe o no está activo" });
      }
      if (!Array.isArray(puesto.mesas) || !puesto.mesas.includes(nextMesa)) {
        return res.status(400).json({ error: "mesa no pertenece al puesto seleccionado" });
      }

      registration.puestoId = nextPuestoId;
      registration.mesa = nextMesa;
      registration.localidad = puesto.localidad || registration.localidad;
    } else if (registeredToVote === false) {
      registration.puestoId = null;
      registration.mesa = null;
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
    if (!nextRegisteredToVote && localidad !== undefined && localidad !== registration.localidad) {
      changes.localidad = { old: registration.localidad, new: localidad };
      registration.localidad = localidad;
    }
    if (registeredToVote !== undefined && registeredToVote !== registration.registeredToVote) {
      changes.registeredToVote = { old: registration.registeredToVote, new: registeredToVote };
      registration.registeredToVote = registeredToVote;
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
    const orgId = req.user.organizationId; // Multi-tenant filter
    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId });

    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Ownership Check: Leaders can only delete their own registrations
    if (user.role !== 'admin' && registration.leaderId !== user.leaderId) {
      return res.status(403).json({ error: "No tienes permiso para eliminar este registro" });
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

export async function bulkCreateRegistrations(req, res) {
  try {
    const user = req.user;
    const { leaderId, registrations } = req.body;

    // Validate leader
    const leader = await Leader.findOne({ leaderId });
    if (!leader) return res.status(404).json({ error: "Líder no encontrado" });
    if (!leader.active) return res.status(403).json({ error: "El líder está inactivo" });

    // Use leader's eventId
    const eventId = leader.eventId;
    if (!eventId) {
      return res.status(400).json({ error: "El líder no está asociado a ningún evento. Contacte al administrador." });
    }

    const errors = [];
    const validRegistrations = [];

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const rowNum = i + 1;
      const missing = [];

      // Strict validation as requested
      if (!reg.firstName) missing.push("Nombre");
      if (!reg.lastName) missing.push("Apellido");
      if (!reg.cedula) missing.push("Cédula");
      if (!reg.email) missing.push("Email");
      if (!reg.phone) missing.push("Celular");
      if (!reg.puestoId) missing.push("Puesto");
      const mesaValue = reg.mesa !== undefined && reg.mesa !== null ? Number(reg.mesa) : null;
      if (mesaValue === null || Number.isNaN(mesaValue)) missing.push("Mesa");

      if (missing.length > 0) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName || ''} ${reg.lastName || ''}`.trim() || 'Desconocido',
          error: `Faltan campos: ${missing.join(', ')}`
        });
        continue;
      }

      // Check duplicates (basic check against existing DB)
      const existing = await Registration.findOne({ cedula: reg.cedula });
      if (existing) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          error: `Ya existe un registro con cédula ${reg.cedula}`
        });
        continue;
      }
      if (!mongoose.Types.ObjectId.isValid(reg.puestoId)) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          error: "puestoId inválido"
        });
        continue;
      }

      const puesto = await Puestos.findById(reg.puestoId).lean();
      if (!puesto || puesto.activo === false) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          error: "puestoId no existe o no está activo"
        });
        continue;
      }
      if (!Array.isArray(puesto.mesas) || !puesto.mesas.includes(mesaValue)) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          error: "mesa no pertenece al puesto seleccionado"
        });
        continue;
      }

      validRegistrations.push({
        leaderId: leader.leaderId,
        leaderName: leader.name,
        eventId: eventId, // Assign leader's event
        firstName: reg.firstName,
        lastName: reg.lastName,
        cedula: reg.cedula,
        email: reg.email,
        phone: reg.phone,
        puestoId: reg.puestoId,
        mesa: mesaValue,
        localidad: puesto.localidad || reg.localidad || '',
        registeredToVote: true,
        date: new Date().toISOString(),
        confirmed: false,
        organizationId: leader.organizationId
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: "Se encontraron errores en el archivo. Por favor corríjalos antes de importar.",
        details: errors
      });
    }

    if (validRegistrations.length === 0) {
      return res.status(400).json({ error: "No hay registros válidos para importar." });
    }

    await Registration.insertMany(validRegistrations);

    // Increment leader count
    await Leader.updateOne({ leaderId: leader.leaderId }, { $inc: { registrations: validRegistrations.length } });

    res.json({
      success: true,
      count: validRegistrations.length,
      message: `Se importaron ${validRegistrations.length} registros exitosamente.`
    });

  } catch (error) {
    logger.error("Bulk import error:", error);
    res.status(500).json({ error: "Error interno al procesar importación: " + error.message });
  }
}
