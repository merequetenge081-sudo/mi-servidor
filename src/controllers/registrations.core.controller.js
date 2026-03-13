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
import { parsePagination } from "../utils/pagination.js";
import { sendError } from "../utils/httpError.js";

const normalizeRegistration = (registration) => {
  if (!registration) return registration;
  const puesto = registration.puestoId && typeof registration.puestoId === "object"
    ? registration.puestoId
    : null;
  const puestoNombre = puesto?.nombre || null;
  const votingPlaceValue = registration.votingPlace || puestoNombre || "";
  const votingTableValue = registration.votingTable !== undefined && registration.votingTable !== null && registration.votingTable !== ""
    ? registration.votingTable
    : (registration.mesa ?? "");

  return {
    ...registration,
    puestoNombre,
    votingPlace: votingPlaceValue,
    votingTable: votingTableValue,
    // Asegurar que los campos de revisiÃ³n estÃ©n presentes
    requiereRevisionPuesto: registration.requiereRevisionPuesto || false,
    revisionPuestoResuelta: registration.revisionPuestoResuelta || false
  };
};

export async function createRegistration(req, res) {
  try {
    const user = req.user;
    const { leaderId, leaderToken, leaderName, eventId, firstName, lastName, cedula, email, phone, localidad, departamento, capital, registeredToVote, puestoId, mesa, votingPlace, votingTable, date, hasConsentToRegister } = req.body;

    // Verificar consentimiento del lÃ­der (Ley 1581 de 2012)
    if (!hasConsentToRegister) {
      return sendError(res, 400, "Debes declarar que tienes autorización del titular para registrar esta información.", "CONSENT_REQUIRED");
    }

    let leader = null;
    if (leaderId) {
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(leaderId);
      if (isObjectId) {
        leader = await Leader.findOne({ $or: [{ leaderId }, { _id: leaderId }] });
      } else {
        leader = await Leader.findOne({ leaderId });
      }
    }

    if (!leader && leaderToken) {
      leader = await Leader.findOne({ $or: [{ token: leaderToken }, { leaderId: leaderToken }] });
    }

    if (!leader) {
      return sendError(res, 404, "Líder no encontrado");
    }

    if (!leader.active) {
      return sendError(res, 403, "El líder está inactivo");
    }

    const resolvedLeaderId = leader.leaderId || leader._id?.toString();
    if (!resolvedLeaderId) {
      return sendError(res, 400, "leaderId es requerido");
    }

    let orgId = leader.organizationId;
    if (!orgId) {
      let defaultOrg = await Organization.findOne({ slug: "default" });
      if (!defaultOrg) {
        defaultOrg = new Organization({
          name: "Default Organization",
          slug: "default",
          description: "OrganizaciÃ³n por defecto",
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
      return sendError(res, 400, validation.error);
    }

    const event = await Event.findById(resolvedEventId);
    if (!event) {
      return sendError(res, 404, "Evento no encontrado");
    }

    if (!event.organizationId && orgId) {
      await Event.updateOne({ _id: event._id }, { $set: { organizationId: orgId } });
    }

    const duplicate = await ValidationService.checkDuplicate(cedula, resolvedEventId);
    if (duplicate) {
      return sendError(res, 400, `Persona con cédula ${cedula} ya registrada en este evento`);
    }

    const organizationId = leader.organizationId || event.organizationId || orgId;
    if (!organizationId) {
      return sendError(res, 400, "organizationId es requerido");
    }

    const normalizedMesa = mesa !== undefined && mesa !== null ? Number(mesa) : null;
    let resolvedPuestoId = puestoId || null;
    let resolvedMesa = normalizedMesa;
    let resolvedLocalidad = localidad;

    if (registeredToVote) {
      if (!resolvedPuestoId || !mongoose.Types.ObjectId.isValid(resolvedPuestoId)) {
        return sendError(res, 400, "puestoId inválido o requerido");
      }
      if (resolvedMesa === null || Number.isNaN(resolvedMesa)) {
        return sendError(res, 400, "mesa inválida o requerida");
      }

      const puesto = await Puestos.findById(resolvedPuestoId).lean();
      if (!puesto || puesto.activo === false) {
        return sendError(res, 400, "puestoId no existe o no está activo");
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
      departamento: departamento || null,
      capital: capital || null,
      registeredToVote,
      puestoId: resolvedPuestoId,
      mesa: resolvedMesa,
      votingPlace: votingPlace || null,
      votingTable: votingTable || null,
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
    return sendError(res, 500, "Error al crear registro");
  }
}

export async function getRegistrations(req, res) {
  try {
    const { eventId, leaderId, confirmed, cedula, requiereRevisionPuesto } = req.query;
    const filter = buildOrgFilter(req); // Multi-tenant filtering

    const maxLimit = parseInt(process.env.REGISTRATIONS_MAX_LIMIT, 10) || 10000;
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit });

    logger.debug('[RegistrationsController] getRegistrations', {
      organizationId: req.organizationId,
      eventId,
      page,
      limit
    });

    if (eventId) filter.eventId = eventId;
    if (leaderId) filter.leaderId = leaderId;
    if (confirmed !== undefined) filter.confirmed = confirmed === "true";
    if (cedula) filter.cedula = cedula;
    if (requiereRevisionPuesto !== undefined) {
      filter.requiereRevisionPuesto = requiereRevisionPuesto === "true";
      filter.revisionPuestoResuelta = false;
    }

    const registrations = await Registration.find(filter)
      .populate("puestoId", "nombre codigoPuesto localidad")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Registration.countDocuments(filter);
    const confirmedCount = await Registration.countDocuments({ ...filter, confirmed: true });

    logger.debug('[RegistrationsController] Resultados', {
      totalEncontrados: total,
      registracionesRetornadas: registrations.length,
      confirmedCount
    });

    res.json({
      data: registrations.map(normalizeRegistration),
      total,
      confirmedCount,
      page,
      limit,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error("Get registrations error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al obtener registros");
  }
}

export async function getRegistration(req, res) {
  try {
    const orgId = req.user.organizationId; // Multi-tenant filter
    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId })
      .populate("puestoId", "nombre codigoPuesto localidad")
      .lean();
    if (!registration) {
      return sendError(res, 404, "Registro no encontrado");
    }
    res.json(normalizeRegistration(registration));
  } catch (error) {
    logger.error("Get registration error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al obtener registro");
  }
}

export async function updateRegistration(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter
    const { firstName, lastName, email, phone, localidad, departamento, capital, registeredToVote, puestoId, mesa, votingPlace, votingTable } = req.body;


    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId });
    if (!registration) {
      return sendError(res, 404, "Registro no encontrado");
    }

    // Ownership Check: Leaders can only update their own registrations
    logger.debug('[RegistrationsController] Update ownership check', {
      role: user.role,
      userLeaderId: user.leaderId,
      registrationLeaderId: registration.leaderId
    });

    if (user.role !== 'admin' && registration.leaderId !== user.leaderId) {
      return sendError(res, 403, `No tienes permiso. Tu ID: ${user.leaderId}, Dueño: ${registration.leaderId}`);
    }

    // Check voting data if needed
    const nextRegisteredToVote = registeredToVote !== undefined ? registeredToVote : registration.registeredToVote;
    const nextPuestoId = puestoId !== undefined ? puestoId : registration.puestoId;
    const nextMesaRaw = mesa !== undefined ? mesa : registration.mesa;
    const nextMesa = nextMesaRaw !== undefined && nextMesaRaw !== null ? Number(nextMesaRaw) : null;

    if (nextRegisteredToVote) {
      const votingValidation = ValidationService.validateVotingData(nextRegisteredToVote, nextPuestoId, nextMesa);
      if (!votingValidation.valid) {
        return sendError(res, 400, votingValidation.error);
      }

      if (!mongoose.Types.ObjectId.isValid(nextPuestoId)) {
        return sendError(res, 400, "puestoId inválido");
      }

      const puesto = await Puestos.findById(nextPuestoId).lean();
      if (!puesto || puesto.activo === false) {
        return sendError(res, 400, "puestoId no existe o no está activo");
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
    if (localidad !== undefined && localidad !== registration.localidad) {
      changes.localidad = { old: registration.localidad, new: localidad };
      registration.localidad = localidad;
    }
    if (departamento !== undefined && departamento !== registration.departamento) {
      changes.departamento = { old: registration.departamento, new: departamento };
      registration.departamento = departamento;
    }
    if (capital !== undefined && capital !== registration.capital) {
      changes.capital = { old: registration.capital, new: capital };
      registration.capital = capital;
    }
    if (votingPlace !== undefined && votingPlace !== registration.votingPlace) {
      changes.votingPlace = { old: registration.votingPlace, new: votingPlace };
      registration.votingPlace = votingPlace;
    }
    if (votingTable !== undefined && votingTable !== registration.votingTable) {
      changes.votingTable = { old: registration.votingTable, new: votingTable };
      registration.votingTable = votingTable;
    }
    if (!nextRegisteredToVote && localidad !== undefined && localidad !== registration.localidad) {
      changes.localidad = { old: registration.localidad, new: localidad };
      registration.localidad = localidad;
    }
    if (registeredToVote !== undefined && registeredToVote !== registration.registeredToVote) {
      changes.registeredToVote = { old: registration.registeredToVote, new: registeredToVote };
      registration.registeredToVote = registeredToVote;
    }

    // Si el registro requerÃ­a revisiÃ³n de puesto y se actualizaron campos relacionados,
    // marcar como resuelta la revisiÃ³n
    if (registration.requiereRevisionPuesto && !registration.revisionPuestoResuelta) {
      const camposRelevantesActualizados = 
        votingPlace !== undefined || 
        localidad !== undefined || 
        puestoId !== undefined ||
        votingTable !== undefined;

      if (camposRelevantesActualizados) {
        registration.revisionPuestoResuelta = true;
        changes.revisionPuestoResuelta = { old: false, new: true };
        logger.info(`[UpdateRegistration] Marcando revisiÃ³n de puesto como resuelta para registro ${registration._id}`);
      }
    }

    registration.updatedAt = new Date();
    await registration.save();

    await AuditService.log("UPDATE", "Registration", registration._id.toString(), user, changes, `Registro ${registration.cedula} actualizado`);

    res.json(registration);
  } catch (error) {
    logger.error("Update registration error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al actualizar registro");
  }
}

export async function deleteRegistration(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter
    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId });

    if (!registration) {
      return sendError(res, 404, "Registro no encontrado");
    }

    // Ownership Check: Leaders can only delete their own registrations
    if (user.role !== 'admin' && registration.leaderId !== user.leaderId) {
      return sendError(res, 403, "No tienes permiso para eliminar este registro");
    }

    const leaderId = registration.leaderId;
    await Registration.deleteOne({ _id: req.params.id });

    // Decrement leader registration count
    if (leaderId) {
      const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderId);
      await Leader.updateOne(
        { $or: [{ leaderId: leaderId }, ...(isValidObjectId ? [{ _id: leaderId }] : [])] },
        { $inc: { registrations: -1 } }
      );
    }

    await AuditService.log("DELETE", "Registration", req.params.id, user, { cedula: registration.cedula }, `Registro eliminado`);

    res.json({ message: "Registro eliminado" });
  } catch (error) {
    logger.error("Delete registration error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al eliminar registro");
  }
}

export async function confirmRegistration(req, res) {
  try {
    const user = req.user;
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return sendError(res, 404, "Registro no encontrado");
    }

    if (registration.confirmed) {
      return sendError(res, 400, "Registro ya está confirmado");
    }

    registration.confirmed = true;
    registration.confirmedBy = user?.username || "system";
    registration.confirmedAt = new Date();

    await registration.save();

    await AuditService.log("CONFIRM", "Registration", registration._id.toString(), user, { cedula: registration.cedula }, `Registro confirmado`);

    res.json(registration);
  } catch (error) {
    logger.error("Confirm registration error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al confirmar registro");
  }
}

export async function unconfirmRegistration(req, res) {
  try {
    const user = req.user;
    const registration = await Registration.findById(req.params.id);

    if (!registration) {
      return sendError(res, 404, "Registro no encontrado");
    }

    if (!registration.confirmed) {
      return sendError(res, 400, "Registro no está confirmado");
    }

    registration.confirmed = false;
    registration.confirmedBy = null;
    registration.confirmedAt = null;

    await registration.save();

    await AuditService.log("UNCONFIRM", "Registration", registration._id.toString(), user, { cedula: registration.cedula }, `ConfirmaciÃ³n de registro revertida`);

    res.json(registration);
  } catch (error) {
    logger.error("Unconfirm registration error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al revertir confirmación");
  }
}

export async function getRegistrationsByLeader(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;
    const { eventId, confirmed, page = 1, limit = 50 } = req.query;

    // Control de acceso: leaders solo pueden ver sus propios registros
    if (user.role === "leader" && user.leaderId !== leaderId) {
      return sendError(res, 403, "No tienes permiso para ver estos registros");
    }

    const filter = { leaderId };
    if (eventId) filter.eventId = eventId;
    if (confirmed !== undefined) filter.confirmed = confirmed === "true";

    const skip = (page - 1) * limit;
    const registrations = await Registration.find(filter)
      .populate("puestoId", "nombre codigoPuesto localidad")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Registration.countDocuments(filter);
    const confirmedCount = await Registration.countDocuments({ ...filter, confirmed: true });

    res.json({
      data: registrations.map(normalizeRegistration),
      total,
      confirmedCount,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error("Get registrations by leader error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al obtener registros del líder");
  }
}
