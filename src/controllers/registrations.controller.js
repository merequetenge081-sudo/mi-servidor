import mongoose from "mongoose";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { Event } from "../models/Event.js";
import { Organization } from "../models/Organization.js";
import { Puestos, DeletionRequest, ArchivedRegistration } from "../models/index.js";
import { AuditService } from "../services/audit.service.js";
import { ValidationService } from "../services/validation.service.js";
import { ConsentLogService } from "../services/consentLog.service.js";
import logger from "../config/logger.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";
import { matchPuesto, matchLocalidad, autocorrectRegistration, normalizeString } from "../utils/fuzzyMatch.js";
import { aliasPuestos } from "../utils/aliasPuestos.js";
import { parsePagination } from "../utils/pagination.js";
import bcrypt from "bcryptjs";

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
    // Asegurar que los campos de revisión estén presentes
    requiereRevisionPuesto: registration.requiereRevisionPuesto || false,
    revisionPuestoResuelta: registration.revisionPuestoResuelta || false
  };
};

const stripLeadingCode = (value) => {
  if (!value) return '';
  const raw = value.toString();
  const withHyphen = raw.replace(/^\s*\d+\s*[-–]\s*/g, '').trim();
  if (withHyphen !== raw.trim()) return withHyphen;

  // Strip leading numeric prefix only when followed by text (avoid PVOCODIGO-only inputs)
  return raw.replace(/^\s*\d+\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, '').trim();
};

const resolvePuestoInput = (value) => {
  const raw = stripLeadingCode(value);
  if (!raw) return raw;
  const normalized = normalizeString(raw);
  const aliasKey = Object.keys(aliasPuestos).find(
    (alias) => normalizeString(alias) === normalized
  );
  return aliasKey ? aliasPuestos[aliasKey] : raw;
};

export async function createRegistration(req, res) {
  try {
    const user = req.user;
    const { leaderId, leaderToken, leaderName, eventId, firstName, lastName, cedula, email, phone, localidad, departamento, capital, registeredToVote, puestoId, mesa, votingPlace, votingTable, date, hasConsentToRegister } = req.body;

    // Verificar consentimiento del líder (Ley 1581 de 2012)
    if (!hasConsentToRegister) {
      return res.status(400).json({ 
        error: "Debes declarar que tienes autorización del titular para registrar esta información.",
        code: "CONSENT_REQUIRED"
      });
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
    res.status(500).json({ error: "Error al crear registro" });
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
    res.status(500).json({ error: "Error al obtener registros" });
  }
}

export async function getRegistration(req, res) {
  try {
    const orgId = req.user.organizationId; // Multi-tenant filter
    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId })
      .populate("puestoId", "nombre codigoPuesto localidad")
      .lean();
    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    res.json(normalizeRegistration(registration));
  } catch (error) {
    logger.error("Get registration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener registro" });
  }
}

export async function updateRegistration(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter
    const { firstName, lastName, email, phone, localidad, departamento, capital, registeredToVote, puestoId, mesa, votingPlace, votingTable } = req.body;


    const registration = await Registration.findOne({ _id: req.params.id, organizationId: orgId });
    if (!registration) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    // Ownership Check: Leaders can only update their own registrations
    logger.debug('[RegistrationsController] Update ownership check', {
      role: user.role,
      userLeaderId: user.leaderId,
      registrationLeaderId: registration.leaderId
    });

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

    // Si el registro requería revisión de puesto y se actualizaron campos relacionados,
    // marcar como resuelta la revisión
    if (registration.requiereRevisionPuesto && !registration.revisionPuestoResuelta) {
      const camposRelevantesActualizados = 
        votingPlace !== undefined || 
        localidad !== undefined || 
        puestoId !== undefined ||
        votingTable !== undefined;

      if (camposRelevantesActualizados) {
        registration.revisionPuestoResuelta = true;
        changes.revisionPuestoResuelta = { old: false, new: true };
        logger.info(`[UpdateRegistration] Marcando revisión de puesto como resuelta para registro ${registration._id}`);
      }
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
    res.status(500).json({ error: "Error al obtener registros del líder" });
  }
}

export async function bulkCreateRegistrations(req, res) {
  try {
    const user = req.user;
    const { leaderId, registrations } = req.body;

    // Validate input
    if (!Array.isArray(registrations) || registrations.length === 0) {
      return res.status(400).json({ error: "No se proporcionaron registros para importar." });
    }

    // Validate leader
    const leader = await Leader.findOne({ leaderId }).lean();
    if (!leader) return res.status(404).json({ error: "Líder no encontrado" });
    if (!leader.active) return res.status(403).json({ error: "El líder está inactivo" });

    // Use leader's eventId
    const eventId = leader.eventId;
    if (!eventId) {
      return res.status(400).json({ error: "El líder no está asociado a ningún evento. Contacte al administrador." });
    }

    // ========== STEP 1: Batch lookup ALL puestos for fuzzy matching ==========
    // Load ALL active puestos for the organization (for fuzzy matching)
    const orgFilters = [
      { organizationId: null },
      { organizationId: { $exists: false } }
    ];

    if (leader.organizationId) {
      orgFilters.unshift({ organizationId: leader.organizationId });
    }

    const allPuestos = await Puestos.find({
      activo: true,
      $or: orgFilters
    }).lean();

    logger.info(`[BulkImport] Loaded ${allPuestos.length} active puestos for fuzzy matching`);

    // ========== STEP 2: Batch check duplicates ==========
    // Extract all cedulas to check for duplicates in one query
    const cedulas = registrations.map(r => r.cedula).filter(Boolean);
    const existingRegistrations = await Registration.find({
      cedula: { $in: cedulas },
      eventId: eventId
    }).select('cedula').lean();

    const existingCedulasSet = new Set(existingRegistrations.map(r => r.cedula));

    // ========== STEP 3: Process each row with fuzzy matching ==========
    const errors = [];
    const validRegistrations = [];
    const autocorrections = []; // Track autocorrections
    let requiresReviewCount = 0;
    const SIMILARITY_THRESHOLD = 0.80; // 80% similarity for autocorrection

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      const rowNum = i + 2; // Excel row (assuming row 1 is headers)
      const missing = [];

      // Validate required fields
      if (!reg.firstName || !reg.firstName.trim()) missing.push("Nombre");
      if (!reg.lastName || !reg.lastName.trim()) missing.push("Apellido");
      if (!reg.cedula || !reg.cedula.toString().trim()) missing.push("Cédula");
      // Email y Celular son opcionales
      // if (!reg.phone || !reg.phone.toString().trim()) missing.push("Celular");

      if (missing.length > 0) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName || ''} ${reg.lastName || ''}`.trim() || 'Desconocido',
          error: `Faltan campos requeridos: ${missing.join(', ')}`
        });
        continue;
      }

      // Convert votingTable to mesa (number)
      let mesa = null;
      if (reg.votingTable !== undefined && reg.votingTable !== null) {
        mesa = Number(reg.votingTable);
        if (Number.isNaN(mesa)) {
          errors.push({
            row: rowNum,
            name: `${reg.firstName} ${reg.lastName}`,
            error: `Mesa inválida: "${reg.votingTable}" no es un número válido`
          });
          continue;
        }
      }

      // Check for duplicates
      const cedulaStr = reg.cedula.toString().trim();
      if (existingCedulasSet.has(cedulaStr)) {
        errors.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          error: `Ya existe un registro con cédula ${cedulaStr} en este evento`
        });
        continue;
      }

      // ========== STEP 4: Fuzzy matching y autocorrección ==========
      let puestoId = null;
      let localidad = reg.localidad || null;
      let votingPlace = reg.votingPlace ? reg.votingPlace.trim() : null;
      let requiereRevisionPuesto = false;
      let revisionPuestoResuelta = false;
      const rowCorrections = [];

      // 4.1: Autocorregir localidad si es de Bogotá
      if (localidad) {
        const localidadMatch = matchLocalidad(localidad, SIMILARITY_THRESHOLD);
        if (localidadMatch) {
          if (localidadMatch.corrected) {
            rowCorrections.push({
              field: 'localidad',
              original: localidad,
              corrected: localidadMatch.match,
              similarity: (localidadMatch.similarity * 100).toFixed(1) + '%'
            });
          }
          localidad = localidadMatch.match; // Usar el valor corregido
        }
      }

      // 4.2: Fuzzy matching de puesto de votación
      if (votingPlace && allPuestos.length > 0) {
        const puestoMatch = matchPuesto(votingPlace, allPuestos, SIMILARITY_THRESHOLD);
        
        if (puestoMatch) {
          // Match encontrado con alta similitud
          puestoId = puestoMatch.puesto._id;
          localidad = puestoMatch.puesto.localidad || localidad;
          requiereRevisionPuesto = false;
          revisionPuestoResuelta = true;

          if (puestoMatch.corrected) {
            // El puesto fue autocorregido
            rowCorrections.push({
              field: 'votingPlace',
              original: votingPlace,
              corrected: puestoMatch.puesto.nombre,
              similarity: (puestoMatch.similarity * 100).toFixed(1) + '%'
            });
            votingPlace = puestoMatch.puesto.nombre; // Usar el valor corregido
          }
        } else {
          // No se encontró match con suficiente similitud - requiere revisión manual
          requiereRevisionPuesto = true;
          revisionPuestoResuelta = false;
          requiresReviewCount++;
        }
      } else if (votingPlace) {
        // votingPlace proporcionado pero no hay puestos disponibles
        requiereRevisionPuesto = true;
        revisionPuestoResuelta = false;
        requiresReviewCount++;
      }

      // Registrar autocorrecciones si existieron
      if (rowCorrections.length > 0) {
        autocorrections.push({
          row: rowNum,
          name: `${reg.firstName} ${reg.lastName}`,
          corrections: rowCorrections
        });
      }

      // Add to valid registrations
      validRegistrations.push({
        leaderId: leader.leaderId,
        leaderName: leader.name,
        eventId: eventId,
        organizationId: leader.organizationId,
        firstName: reg.firstName.trim(),
        lastName: reg.lastName.trim(),
        cedula: cedulaStr,
        email: reg.email.trim(),
        phone: reg.phone.toString().trim(),
        votingPlace: votingPlace,
        puestoId: puestoId,
        mesa: mesa,
        localidad: localidad,
        departamento: reg.departamento || null,
        capital: reg.capital || null,
        requiereRevisionPuesto: requiereRevisionPuesto,
        revisionPuestoResuelta: revisionPuestoResuelta,
        registeredToVote: true,
        confirmed: false,
        date: new Date()
      });
    }

    // ========== STEP 5: Insert valid registrations ==========
    let insertedCount = 0;
    if (validRegistrations.length > 0) {
      const insertResult = await Registration.insertMany(validRegistrations, { ordered: false });
      insertedCount = insertResult.length;

      // Increment leader count
      await Leader.updateOne(
        { _id: leader._id }, 
        { $inc: { registrations: insertedCount } }
      );
    }

    // ========== STEP 6: Return structured response with autocorrections ==========
    const response = {
      success: true,
      imported: insertedCount,
      requiresReview: requiresReviewCount,
      failed: errors.length,
      autocorrected: autocorrections.length,
      errors: errors,
      autocorrections: autocorrections,
      message: `Importación completada: ${insertedCount} registros importados${autocorrections.length > 0 ? `, ${autocorrections.length} autocorregidos` : ''}${requiresReviewCount > 0 ? `, ${requiresReviewCount} requieren revisión de puesto` : ''}${errors.length > 0 ? `, ${errors.length} errores` : ''}.`
    };

    // Log import summary
    logger.info(`Bulk import completed - Leader: ${leaderId}, Imported: ${insertedCount}, Autocorrected: ${autocorrections.length}, Review: ${requiresReviewCount}, Errors: ${errors.length}`);

    res.json(response);

  } catch (error) {
    logger.error("Bulk import error:", error);
    res.status(500).json({ 
      success: false,
      error: "Error interno al procesar importación",
      details: error.message 
    });
  }
}

export async function verifyLeaderRegistrations(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;
    const similarityThreshold = Number(req.body?.threshold);
    const threshold = Number.isFinite(similarityThreshold)
      ? Math.max(0, Math.min(similarityThreshold, 1))
      : 0.85;

    if (!user || user.role !== "leader") {
      return res.status(403).json({ error: "Solo líderes pueden ejecutar esta verificación" });
    }

    // Buscar líder - validar que leaderId no sea un ObjectId inválido
    let leader = null;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderId);
    if (isValidObjectId) {
      leader = await Leader.findOne({
        $or: [{ leaderId }, { _id: new mongoose.Types.ObjectId(leaderId) }]
      }).lean();
    } else {
      leader = await Leader.findOne({ leaderId }).lean();
    }

    if (!leader) return res.status(404).json({ error: "Líder no encontrado" });

    const userLeaderId = user.leaderId || user.userId || user._id;
    const leaderIdMatch =
      (leader.leaderId && leader.leaderId === userLeaderId) ||
      (leader._id && leader._id.toString() === userLeaderId);

    if (!leaderIdMatch) {
      return res.status(403).json({ error: "No autorizado para verificar estos registros" });
    }

    if (user.organizationId && leader.organizationId && user.organizationId !== leader.organizationId) {
      return res.status(403).json({ error: "Organización inválida" });
    }

    const orgFilters = [
      { organizationId: null },
      { organizationId: { $exists: false } }
    ];

    if (leader.organizationId) {
      orgFilters.unshift({ organizationId: leader.organizationId });
    }

    const allPuestos = await Puestos.find({
      activo: true,
      $or: orgFilters
    }).lean();

    const registrations = await Registration.find({
      leaderId: leader.leaderId,
      eventId: leader.eventId,
      organizationId: leader.organizationId
    }).lean();

    const summary = {
      total: registrations.length,
      updated: 0,
      corrected: 0,
      requiresReview: 0,
      unchanged: 0
    };

    const corrections = [];
    const bulkOps = [];

    for (const reg of registrations) {
      const updates = {};
      const rowCorrections = [];
      let hasCorrections = false;
      let requiresReview = false;

      // Separar nombre y apellido si están juntos en firstName y lastName está vacío
      if (reg.firstName && (!reg.lastName || reg.lastName.trim() === '')) {
        const parts = reg.firstName.trim().split(/\s+/);
        if (parts.length >= 2) {
          const mid = Math.ceil(parts.length / 2);
          const newFirstName = parts.slice(0, mid).join(' ');
          const newLastName = parts.slice(mid).join(' ');
          
          updates.firstName = newFirstName;
          updates.lastName = newLastName;
          
          rowCorrections.push({
            field: "name",
            original: reg.firstName,
            corrected: `${newFirstName} (Nombre) | ${newLastName} (Apellido)`,
            similarity: "100.0%"
          });
          hasCorrections = true;
        }
      }

      if (reg.localidad) {
        const localidadMatch = matchLocalidad(reg.localidad, threshold);
        if (localidadMatch && localidadMatch.corrected) {
          updates.localidad = localidadMatch.match;
          rowCorrections.push({
            field: "localidad",
            original: reg.localidad,
            corrected: localidadMatch.match,
            similarity: (localidadMatch.similarity * 100).toFixed(1) + "%"
          });
          hasCorrections = true;
        }
      }

      const votingPlaceInput = resolvePuestoInput(reg.votingPlace);
      if (votingPlaceInput) {
        const puestoMatch = matchPuesto(votingPlaceInput, allPuestos, threshold);
        if (puestoMatch) {
          const matchedName = puestoMatch.puesto.nombre;
          updates.votingPlace = matchedName;
          updates.puestoId = puestoMatch.puesto._id;
          if (puestoMatch.puesto.localidad) {
            updates.localidad = puestoMatch.puesto.localidad;
          }
          updates.requiereRevisionPuesto = false;
          updates.revisionPuestoResuelta = true;

          if (normalizeString(reg.votingPlace || "") !== normalizeString(matchedName)) {
            rowCorrections.push({
              field: "votingPlace",
              original: reg.votingPlace,
              corrected: matchedName,
              similarity: (puestoMatch.similarity * 100).toFixed(1) + "%"
            });
            hasCorrections = true;
          }
        } else {
          updates.requiereRevisionPuesto = true;
          updates.revisionPuestoResuelta = false;
          requiresReview = true;
        }
      }

      const keys = Object.keys(updates);
      if (keys.length === 0) {
        summary.unchanged++;
        continue;
      }

      let changed = false;
      for (const key of keys) {
        const currentValue = reg[key] ?? null;
        const nextValue = updates[key] ?? null;
        if (String(currentValue) !== String(nextValue)) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        summary.unchanged++;
        continue;
      }

      updates.updatedAt = new Date();
      
      // Agregar operación a bulk
      bulkOps.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(reg._id.toString()) },
          update: { $set: updates }
        }
      });

      summary.updated++;
      if (hasCorrections) summary.corrected++;
      if (requiresReview) summary.requiresReview++;

      if (rowCorrections.length > 0) {
        corrections.push({
          id: reg._id,
          cedula: reg.cedula,
          corrections: rowCorrections
        });
      }
    }

    // Ejecutar bulk operations si hay algo que actualizar
    if (bulkOps.length > 0) {
      try {
        await Registration.bulkWrite(bulkOps);
      } catch (bulkError) {
        logger.error("Bulk write error:", bulkError);
        throw bulkError;
      }
    }

    res.json({
      success: true,
      threshold,
      ...summary,
      corrections: corrections.slice(0, 50)
    });
  } catch (error) {
    logger.error("Error verifying leader registrations:", {
      message: error.message,
      stack: error.stack,
      leaderId: req.params.leaderId,
      threshold: req.body?.threshold
    });
    res.status(500).json({
      success: false,
      error: "Error interno al verificar registros",
      details: error.message,
      code: error.code
    });
  }
}

// ========== DELETION REQUESTS ==========

/**
 * Request bulk deletion of all registrations for a leader
 * Requires leader password verification
 */
export async function requestBulkDeletion(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { password, reason } = req.body;

    // Solo líderes pueden solicitar eliminación de sus propios registros
    if (user.role !== 'leader') {
      return res.status(403).json({ error: "Solo líderes pueden solicitar eliminación" });
    }

    // Verificar que se proporcionó contraseña
    if (!password) {
      return res.status(400).json({ error: "Contraseña requerida" });
    }

    // Obtener líder y verificar contraseña
    const leader = await Leader.findOne({ 
      leaderId: user.leaderId,
      organizationId: orgId
    });

    if (!leader || !leader.passwordHash) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const passwordMatch = await bcrypt.compare(password, leader.passwordHash);
    if (!passwordMatch) {
      logger.warn(`Failed deletion request - Invalid password for leader: ${user.leaderId}`);
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    // Contar registros del líder
    const registrationCount = await Registration.countDocuments({
      leaderId: user.leaderId,
      organizationId: orgId
    });

    if (registrationCount === 0) {
      return res.status(400).json({ error: "No tienes registros para eliminar" });
    }

    // Verificar si ya existe una solicitud pendiente
    const existingRequest = await DeletionRequest.findOne({
      leaderId: user.leaderId,
      organizationId: orgId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ 
        error: "Ya tienes una solicitud de eliminación pendiente",
        requestId: existingRequest._id
      });
    }

// Crear solicitud de eliminación como YA APROBADA (eliminación inmediata)
    const deletionRequest = new DeletionRequest({
      leaderId: user.leaderId,
      leaderName: leader.name,
      organizationId: orgId,
      eventId: leader.eventId,
      status: 'approved',
      registrationCount,
      reason: reason || 'Sin razón especificada',
      reviewedBy: 'Auto-aprobado (Líder)',
      reviewedAt: new Date(),
      reviewNotes: 'Eliminación directa por el líder'
    });

    await deletionRequest.save();

    // Eliminar los registros inmediatamente
    const deleteResult = await Registration.deleteMany({
      leaderId: user.leaderId,
      organizationId: orgId
    });

    // Actualizar el contador del líder a 0
    const leaderIdForUpdate = user.leaderId;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderIdForUpdate);
    await Leader.updateOne(
      { $or: [{ leaderId: leaderIdForUpdate }, ...(isValidObjectId ? [{ _id: leaderIdForUpdate }] : [])] },
      { $set: { registrations: 0 } }
    );

    logger.info(`Bulk deletion directly executed by Leader: ${user.leaderId}, Count: ${registrationCount}`);
    
    await AuditService.log(
      "DELETE_BULK",
      "Registration",
      deletionRequest._id.toString(),
      user,
      { registrationCount, reason },
      `Eliminación masiva ejecutada directamente por líder (${registrationCount} registros)`
    );

    res.json({
      success: true,
      message: `¡Éxito! Se han eliminado ${registrationCount} registro(s) permanentemente.`,
      requestId: deletionRequest._id,
      registrationCount,
      status: 'approved'
    });

  } catch (error) {
    logger.error("Request bulk deletion error:", error);
    res.status(500).json({ error: "Error al crear solicitud de eliminación" });
  }
}

/**
 * Get deletion request status for current leader
 */
export async function getDeletionRequestStatus(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const request = await DeletionRequest.findOne({
      leaderId: user.leaderId,
      organizationId: orgId,
      status: 'pending'
    }).sort({ createdAt: -1 });

    res.json({
      hasPendingRequest: !!request,
      request: request || null
    });

  } catch (error) {
    logger.error("Get deletion request status error:", error);
    res.status(500).json({ error: "Error al obtener estado de solicitud" });
  }
}

/**
 * Get all deletion requests (Admin only)
 */
export async function getAllDeletionRequests(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const { status } = req.query;
    const filter = { organizationId: orgId };

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const requests = await DeletionRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      requests
    });

  } catch (error) {
    logger.error("Get all deletion requests error:", error);
    res.status(500).json({ error: "Error al obtener solicitudes" });
  }
}

/**
 * Approve or reject deletion request (Admin only)
 * Actions: 'reject', 'approve', 'approve-and-archive'
 */
export async function reviewDeletionRequest(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { requestId } = req.params;
    const { action, notes } = req.body;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    if (!['approve', 'approve-and-archive', 'reject'].includes(action)) {
      return res.status(400).json({ error: "Acción inválida. Use 'approve', 'approve-and-archive' o 'reject'" });
    }

    const deletionRequest = await DeletionRequest.findOne({
      _id: requestId,
      organizationId: orgId
    });

    if (!deletionRequest) {
      return res.status(404).json({ error: "Solicitud no encontrada" });
    }

    if (deletionRequest.status !== 'pending') {
      return res.status(400).json({ error: "Esta solicitud ya fue procesada" });
    }

    // Actualizar estado de la solicitud
    deletionRequest.status = (action === 'approve' || action === 'approve-and-archive') ? 'approved' : 'rejected';
    deletionRequest.reviewedBy = user.username || user.email;
    deletionRequest.reviewedAt = new Date();
    deletionRequest.reviewNotes = notes || '';
    await deletionRequest.save();

    // Si se aprueba (con o sin archivo), eliminar registros
    if (action === 'approve' || action === 'approve-and-archive') {
      let archivedCount = 0;

      // Si se solicitó archivar, copiar a ArchivedRegistration primero
      if (action === 'approve-and-archive') {
        const registrationsToArchive = await Registration.find({
          leaderId: deletionRequest.leaderId,
          organizationId: orgId
        }).lean();

        if (registrationsToArchive.length > 0) {
          const archivedDocs = registrationsToArchive.map(reg => ({
            originalId: reg._id,
            leaderId: reg.leaderId,
            leaderName: reg.leaderName,
            eventId: reg.eventId,
            firstName: reg.firstName,
            lastName: reg.lastName,
            cedula: reg.cedula,
            email: reg.email,
            phone: reg.phone,
            localidad: reg.localidad,
            departamento: reg.departamento,
            capital: reg.capital,
            votingPlace: reg.votingPlace,
            votingTable: reg.votingTable,
            puestoId: reg.puestoId,
            mesa: reg.mesa,
            registeredToVote: reg.registeredToVote,
            confirmed: reg.confirmed,
            date: reg.date,
            organizationId: reg.organizationId,
            archivedAt: new Date(),
            archivedBy: user.username || user.email,
            archivedReason: notes || 'Eliminación masiva aprobada con archivo',
            deletionRequestId: deletionRequest._id,
            originalCreatedAt: reg.createdAt,
            originalUpdatedAt: reg.updatedAt
          }));

          const archiveResult = await ArchivedRegistration.insertMany(archivedDocs);
          archivedCount = archiveResult.length;

          logger.info(`Registrations archived before deletion - Leader: ${deletionRequest.leaderId}, Archived: ${archivedCount}`);
        }
      }

      // Ahora eliminar los registros originales
      const deleteResult = await Registration.deleteMany({
        leaderId: deletionRequest.leaderId,
        organizationId: orgId
      });

      // Actualizar contador del líder
      const leaderIdForUpdate = deletionRequest.leaderId;
      const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderIdForUpdate);
      await Leader.updateOne(
        { $or: [{ leaderId: leaderIdForUpdate }, ...(isValidObjectId ? [{ _id: leaderIdForUpdate }] : [])] },
        { $set: { registrations: 0 } }
      );

      logger.info(`Bulk deletion approved and executed - Leader: ${deletionRequest.leaderId}, Deleted: ${deleteResult.deletedCount}, Archived: ${archivedCount}`);

      await AuditService.log(
        action === 'approve-and-archive' ? "DELETE_BULK_WITH_ARCHIVE" : "DELETE_BULK",
        "Registration",
        deletionRequest.leaderId,
        user,
        { deletedCount: deleteResult.deletedCount, archivedCount, requestId },
        `Eliminación masiva aprobada: ${deleteResult.deletedCount} registros eliminados${archivedCount > 0 ? `, ${archivedCount} archivados` : ''}`
      );

      res.json({
        success: true,
        message: `Solicitud aprobada. Se eliminaron ${deleteResult.deletedCount} registros${archivedCount > 0 ? ` y se archivaron ${archivedCount} para uso futuro` : ''}.`,
        deletedCount: deleteResult.deletedCount,
        archivedCount
      });
    } else {
      logger.info(`Bulk deletion rejected - Leader: ${deletionRequest.leaderId}, RequestId: ${requestId}`);

      await AuditService.log(
        "REJECT",
        "DeletionRequest",
        requestId,
        user,
        { notes },
        `Solicitud de eliminación masiva rechazada`
      );

      res.json({
        success: true,
        message: "Solicitud rechazada",
        reason: notes
      });
    }

  } catch (error) {
    logger.error("Review deletion request error:", error);
    res.status(500).json({ error: "Error al procesar solicitud" });
  }
}

// ========== ARCHIVED REGISTRATIONS ==========

/**
 * Search archived registration by cedula (for autofill in future events)
 */
export async function searchArchivedByCedula(req, res) {
  try {
    const { cedula } = req.params;
    const orgId = req.user?.organizationId;

    if (!cedula) {
      return res.status(400).json({ error: "Cédula requerida" });
    }

    const archived = await ArchivedRegistration.findOne({
      cedula,
      organizationId: orgId
    })
      .sort({ archivedAt: -1 })  // Más reciente primero
      .lean();

    if (!archived) {
      return res.json({ found: false, data: null });
    }

    // Retornar solo los datos útiles para autofill
    res.json({
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
    res.status(500).json({ error: "Error al buscar registro archivado" });
  }
}

/**
 * Get archived registrations count (Admin only)
 */
export async function getArchivedStats(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    const totalArchived = await ArchivedRegistration.countDocuments({ organizationId: orgId });
    const uniqueCedulas = await ArchivedRegistration.distinct('cedula', { organizationId: orgId });

    res.json({
      success: true,
      totalArchived,
      uniquePersons: uniqueCedulas.length
    });

  } catch (error) {
    logger.error("Get archived stats error:", error);
    res.status(500).json({ error: "Error al obtener estadísticas de archivos" });
  }
}
export async function fixNames(req, res) {
  try {
    const orgId = req.user.organizationId;
    const { eventId } = req.body;

    let query = { organizationId: orgId };
    if (eventId) query.eventId = eventId;

    const registrations = await Registration.find(query);
    let updatedCount = 0;

    for (let reg of registrations) {
      let changed = false;
      const deduct = (s) => {
        let p = (s||'').trim().split(' ').filter(Boolean);
        if (p.length === 2 && p[0].toLowerCase() === p[1].toLowerCase()) return p[0];
        return (s||'').trim();
      };
      const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

      let f = deduct(reg.firstName); let l = deduct(reg.lastName);
      f = titleCase(f); l = titleCase(l);
      
      if (reg.firstName !== f || reg.lastName !== l) {
        reg.firstName = f; reg.lastName = l;
        await reg.save();
        updatedCount++;
      }
    }
    
    res.status(200).json({ success: true, message: updatedCount + ' nombres corregidos.' });
  } catch (error) {
    console.error('Error in fixNames:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
}
