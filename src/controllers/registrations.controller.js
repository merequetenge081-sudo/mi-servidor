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
import { matchPuesto, matchLocalidad, autocorrectRegistration } from "../utils/fuzzyMatch.js";

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
    const { eventId, leaderId, confirmed, cedula, requiereRevisionPuesto, page = 1, limit = 50 } = req.query;
    const filter = buildOrgFilter(req); // Multi-tenant filtering

    console.log('[RegistrationsController] getRegistrations:', {
      organizationId: req.organizationId,
      filter,
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

    // Force maximum limit of 100
    let parsedLimit = parseInt(limit) || 50;
    parsedLimit = Math.min(parsedLimit, 2000);

    const skip = (page - 1) * parsedLimit;
    const registrations = await Registration.find(filter)
      .populate("puestoId", "nombre codigoPuesto localidad")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await Registration.countDocuments(filter);
    const confirmedCount = await Registration.countDocuments({ ...filter, confirmed: true });

    console.log('[RegistrationsController] Resultados:', {
      totalEncontrados: total,
      registracionesRetornadas: registrations.length,
      confirmedCount
    });

    res.json({
      data: registrations.map(normalizeRegistration),
      total,
      confirmedCount,
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
    const allPuestos = await Puestos.find({
      organizationId: leader.organizationId,
      activo: true
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
      if (!reg.email || !reg.email.trim()) missing.push("Email");
      if (!reg.phone || !reg.phone.toString().trim()) missing.push("Celular");

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
        { leaderId: leader.leaderId }, 
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
