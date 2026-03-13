import { Leader } from "../models/Leader.js";
import { Registration } from "../models/Registration.js";
import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";
import bcryptjs from "bcryptjs";
import { Organization } from "../models/Organization.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";
import { emailService } from "../services/emailService.js";
import { encrypt } from "../utils/crypto.js";
import { parseLimit } from "../utils/pagination.js";
import { generateTemporaryPassword } from "../utils/tempPasswordGenerator.js";
import { generateLeaderId, generateLeaderToken } from "../utils/leaderIdentity.js";
import { sendError } from "../utils/httpError.js";
import leaderService from "../backend/modules/leaders/leader.service.js";
import leaderRepository from "../backend/modules/leaders/leader.repository.js";

// Generar token Ãºnico de 32 caracteres hexadecimales
function generateToken() {
  return generateLeaderToken();
}

export async function createLeader(req, res) {
  try {
    const { name, email, phone, area, eventId, customUsername } = req.body;
    let { leaderId } = req.body; // Allow modification
    const user = req.user;

    logger.debug('[LeadersController] createLeader request', {
      name,
      hasEmail: Boolean(email),
      hasPhone: Boolean(phone),
      hasCustomUsername: Boolean(customUsername),
      user: user?.username,
      role: user?.role
    });

    // Auto-generate leaderId if not provided
    if (!leaderId) {
      leaderId = generateLeaderId();
    }

    if (!name) {
      return sendError(res, 400, "El nombre es requerido");
    }

    const existing = await Leader.findOne({ leaderId });
    if (existing) {
      return sendError(res, 400, "leaderId ya existe");
    }

    // Generar token automÃ¡ticamente (no permitir token manual)
    let token = generateToken();
    let tokenExists = await Leader.findOne({ token });

    // Si el token existe (muy improbable), generar uno nuevo
    while (tokenExists) {
      token = generateToken();
      tokenExists = await Leader.findOne({ token });
    }

    // --- SECURITY UPGRADE START ---
    // 1. Username: Use custom if provided, otherwise auto-generate
    const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let username;

    if (customUsername && customUsername.trim()) {
      // Admin provided a custom username
      username = normalize(customUsername.trim());
      const existingUser = await Leader.findOne({ username });
      if (existingUser) {
        return sendError(res, 400, `El usuario "${username}" ya existe. Elige otro.`);
      }
    } else {
      // Auto-generate: first letter of first name + last name
      const cleanName = name.trim().split(/\s+/);
      const firstName = cleanName[0] || "user";
      const lastName = cleanName.length > 1 ? cleanName[1] : "leader";

      let baseUsername = normalize(firstName.charAt(0) + lastName);
      if (!baseUsername) baseUsername = "user";
      username = baseUsername;

      // Ensure uniqueness with sequential suffix
      let counter = 1;
      while (await Leader.findOne({ username })) {
        counter++;
        username = `${baseUsername}${counter}`;
      }
    }

    // 2. Generate Temporary Password
    const tempPassword = generateTemporaryPassword();
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    // 3. Mock Email Service
    const loginLink = `${process.env.BASE_URL || 'http://localhost:5000'}/`;
    logger.info('Mock email generado para lÃ­der (sin credenciales en logs)', {
      to: email || 'No Email Provided',
      username,
      loginLink
    });
    // --- SECURITY UPGRADE END ---

    // Fix: Ensure organizationId is set
    let orgId = req.user.organizationId;
    if (!orgId) {
      // Fallback to default organization
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
    }

    const leader = new Leader({
      leaderId,
      name,
      email,
      phone,
      area,
      eventId,

      // New Security Fields
      username,
      passwordHash,
      isTemporaryPassword: true,
      tempPasswordPlaintext: encrypt(tempPassword),
      tempPasswordCreatedAt: new Date(),

      token,
      registrations: 0,
      organizationId: orgId // Multi-tenant: asignar org automÃ¡ticamente o default
    });

    await leader.save();

    await AuditService.log("CREATE", "Leader", leader._id.toString(), user, { leaderId, name, username }, `LÃ­der ${name} creado`);

    // Return the generated credentials in the response for immediate display (Requested in Plan)
    res.status(201).json({
      ...leader.toObject(),
      _tempPassword: tempPassword, // Only returned once upon creation
      _username: username
    });
  } catch (error) {
    logger.error("Create leader error:", { error: error.message, stack: error.stack });

    // Manejar error de token duplicado (por si acaso)
    if (error.code === 11000 && error.keyPattern?.token) {
      return sendError(res, 500, "Error al generar token Ãºnico, intenta nuevamente");
    }
    if (error.code === 11000 && error.keyPattern?.username) {
      return sendError(res, 500, "Error al generar usuario Ãºnico, intenta nuevamente");
    }

    return sendError(res, 500, "Error al crear lÃ­der");
  }
}

export async function getLeaders(req, res) {
  try {
    const { eventId, active } = req.query;
    const filter = buildOrgFilter(req);

    logger.debug('[LeadersController] getLeaders', {
      organizationId: req.organizationId,
      eventId,
      active
    });

    if (eventId) filter.eventId = eventId;
    if (active !== undefined) filter.active = active === "true";

    const result = await leaderService.getLeaders(filter, { page: 1, limit: 1000, sort: { name: 1 } });
    const leaders = result.data || [];

    const registrationFilter = { ...buildOrgFilter(req) };
    if (eventId) registrationFilter.eventId = eventId;

    const registrations = await Registration.find(registrationFilter)
      .select("_id leaderId")
      .lean();

    const normalizeLeaderKey = (value) =>
      String(value ?? "")
        .trim()
        .toLowerCase();

    // Index por clave exacta y por clave normalizada para cubrir variaciones legacy.
    const exactRegistrationIdsByKey = new Map();
    const normalizedRegistrationIdsByKey = new Map();
    for (const reg of registrations) {
      const regId = reg?._id?.toString?.();
      const rawLeaderKey = String(reg?.leaderId ?? "").trim();
      if (!regId || !rawLeaderKey) continue;

      if (!exactRegistrationIdsByKey.has(rawLeaderKey)) {
        exactRegistrationIdsByKey.set(rawLeaderKey, new Set());
      }
      exactRegistrationIdsByKey.get(rawLeaderKey).add(regId);

      const normalized = normalizeLeaderKey(rawLeaderKey);
      if (normalized) {
        if (!normalizedRegistrationIdsByKey.has(normalized)) {
          normalizedRegistrationIdsByKey.set(normalized, new Set());
        }
        normalizedRegistrationIdsByKey.get(normalized).add(regId);
      }
    }

    const leadersWithCounts = leaders.map(leader => {
      const idKey = leader._id?.toString();
      const leaderIdKey = leader.leaderId ? String(leader.leaderId) : null;
      const normalizedLeaderKeys = [...new Set(
        [leaderIdKey, idKey]
          .filter(Boolean)
          .map((key) => String(key).trim())
          .filter(Boolean)
      )];

      // 1) Conteos individuales por cada clave (exacto)
      const countBy_id = idKey
        ? Number(exactRegistrationIdsByKey.get(String(idKey).trim())?.size || 0)
        : 0;
      const countBy_leaderId = leaderIdKey
        ? Number(exactRegistrationIdsByKey.get(String(leaderIdKey).trim())?.size || 0)
        : 0;

      // 2) Conteo por clave normalizada (cubre string/ObjectId y espacios/case legacy)
      const dedupedRegistrationIds = new Set();
      for (const key of normalizedLeaderKeys) {
        const exact = exactRegistrationIdsByKey.get(key);
        if (exact) {
          for (const regId of exact) dedupedRegistrationIds.add(regId);
        }

        const normalizedKey = normalizeLeaderKey(key);
        const normalized = normalizedRegistrationIdsByKey.get(normalizedKey);
        if (normalized) {
          for (const regId of normalized) dedupedRegistrationIds.add(regId);
        }
      }

      const countBy_stringNormalized = dedupedRegistrationIds.size;
      const count = countBy_stringNormalized;
      const storedRegistrations = Number(leader.registrations || 0);
      const matchedRegistrationIdsSample = [...dedupedRegistrationIds].slice(0, 5);

      if (
        count === 0 ||
        storedRegistrations !== count ||
        countBy_id !== countBy_leaderId
      ) {
        logger.info("[LEADER COUNT TRACE] %j", {
          leaderName: leader.name,
          leader_id: idKey || null,
          leaderId: leaderIdKey || null,
          normalizedLeaderKeys,
          registrationsField: storedRegistrations,
          countBy_id,
          countBy_leaderId,
          countBy_stringNormalized,
          finalDedupedCount: count,
          matchedRegistrationIdsSample,
          eventId: eventId || null
        });
      }

      logger.info(
        "[LEADER COUNT TRACE] leaderId=%s registrationsField=%d registrationsFromCollection=%d keys=%j eventId=%s",
        leaderIdKey || idKey || "unknown",
        storedRegistrations,
        count,
        normalizedLeaderKeys,
        eventId || null
      );

      return {
        ...leader,
        registrations: count
      };
    });

    logger.debug('[LeadersController] leaders encontrados', { count: leadersWithCounts.length });

    res.json(leadersWithCounts);
  } catch (error) {
    logger.error("Get leaders error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al obtener lÃ­deres");
  }
}

export async function getLeaderCredentials(req, res) {
  try {
    const { id } = req.params;
    const credentials = await leaderService.getLeaderCredentials(id);
    const leader = await Leader.findById(id).select("name");

    return res.json({
      ...credentials,
      message:
        credentials.passwordFixed
          ? (credentials.message || "Si el líder no puede cambiar su contraseña por favor genera una nueva")
          : credentials.message,
      name: leader?.name
    });
  } catch (error) {
    logger.error("Get leader credentials error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, "Error al obtener credenciales");
  }
}
export async function getLeader(req, res) {
  try {
    const id = req.params.id;
    let leader = null;

    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (isObjectId) {
      leader = await leaderService.getLeaderById(id);
    }

    if (!leader) {
      leader = await leaderRepository.findByLeaderId(id);
    }

    if (!leader) {
      return sendError(res, 404, "Líder no encontrado");
    }

    return res.json(leader);
  } catch (error) {
    logger.error("Get leader error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, "Error al obtener líder");
  }
}
export async function getTopLeaders(req, res) {
  try {
    const limit = parseLimit(req.query.limit, { defaultLimit: 10, maxLimit: 100 });
    const filter = buildOrgFilter(req); // Multi-tenant filtering
    const leaders = await leaderService.getTopLeaders(limit, filter);
    res.json(leaders);
  } catch (error) {
    logger.error("Get top leaders error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al obtener lÃ­deres destacados");
  }
}

export async function generateLeaderQR(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;

    // Control de acceso: admin puede ver todo, leader solo su propio QR
    if (user.role === "leader" && user.leaderId !== leaderId) {
      return sendError(res, 403, "No tienes permiso para generar este QR");
    }

    const leader = await Leader.findOne({ leaderId });
    if (!leader) {
      return sendError(res, 404, "LÃ­der no encontrado");
    }

    // Generar URL del formulario con token (mÃ¡s seguro y consistente)
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const formUrl = `${baseUrl}/form.html?token=${leader.token}`;

    // Generar QR como base64 usando qrcode
    const QRCode = (await import("qrcode")).default;
    const qrDataUrl = await QRCode.toDataURL(formUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      width: 300
    });

    res.json({
      leaderId,
      leaderName: leader.name,
      formUrl,
      qrCode: qrDataUrl
    });
  } catch (error) {
    logger.error("Generate QR error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al generar cÃ³digo QR");
  }
}

// Endpoint pÃºblico para obtener informaciÃ³n del lÃ­der por token
export async function getLeaderByToken(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return sendError(res, 400, "Token requerido");
    }

    let leader = null;
    try {
      leader = await leaderService.getLeaderByToken(token);
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
    }

    if (!leader) {
      leader = await Leader.findOne({ leaderId: token }).select("leaderId name eventId active");
      if (!leader || !leader.active) {
        return sendError(res, 404, "Token inválido o líder no encontrado");
      }
    }

    let eventName = null;
    if (leader.eventId) {
      try {
        const { Event } = await import("../models/Event.js");
        const event = await Event.findById(leader.eventId).select("name");
        if (event) eventName = event.name;
      } catch (e) {
        // Event lookup is optional
      }
    }

    return res.json({
      leaderId: leader.leaderId,
      name: leader.name,
      eventId: leader.eventId,
      eventName
    });
  } catch (error) {
    logger.error("Get leader by token error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, "Error al obtener información del líder");
  }
}
/**
 * EnvÃ­a email con enlace personalizado y QR al lÃ­der
 * POST /api/leaders/:id/send-access
 * Body: { sendWelcomeEmail, sendCredentialsEmail, sendQRCodeEmail, sendWarningEmail }
 */
export async function sendAccessEmail(req, res) {
  let leaderId = null;
  try {
    const { id } = req.params;
    leaderId = id;
    
    // Flags opcionales para controlar quÃ© correos enviar
    const { 
      sendWelcomeEmail = false,
      sendCredentialsEmail = false, 
      sendQRCodeEmail = false,
      sendWarningEmail = false 
    } = req.body || {};

    const orgFilter = buildOrgFilter(req.user);

    // Validar que el lÃ­der existe y pertenece a la organizaciÃ³n
    const leader = await Leader.findOne({ _id: id, ...orgFilter });
    if (!leader) {
      logger.warn(`âŒ LÃ­der no encontrado: ${id}`);
      return sendError(res, 404, "LÃ­der no encontrado");
    }

    if (!leader.email) {
      logger.warn(`âŒ Email no configurado para lÃ­der: ${leader.name}`);
      return sendError(res, 400, "El lÃ­der no tiene email configurado");
    }

    // Si no se seleccionÃ³ ningÃºn email, usar QR por defecto (comportamiento legacy)
    const shouldSendWelcome = sendWelcomeEmail === true;
    const shouldSendCredentials = sendCredentialsEmail === true;
    const shouldSendQR = sendQRCodeEmail === true || (!sendWelcomeEmail && !sendCredentialsEmail && !sendWarningEmail);
    const shouldSendWarning = sendWarningEmail === true;

    // Determinar base URL
    const baseUrl = process.env.BASE_URL || 
                   (process.env.FRONTEND_URL) ||
                   `${req.protocol}://${req.get('host')}`;

    logger.info(`ðŸ“§ Base URL: ${baseUrl}`);
    logger.info(`ðŸ“§ Enviando correos a ${leader.email} para ${leader.name}...`);
    logger.info(`ðŸ“§ Flags: Welcome=${shouldSendWelcome}, Credentials=${shouldSendCredentials}, QR=${shouldSendQR}, Warning=${shouldSendWarning}`);

    const emailResults = {
      welcome: null,
      credentials: null,
      qr: null,
      warning: null
    };

    // Enviar correos segÃºn flags
    if (shouldSendWelcome) {
      try {
        emailResults.welcome = await emailService.sendWelcomeEmail(leader, baseUrl);
        logger.info(`âœ… Email de bienvenida: ${emailResults.welcome.success}`);
      } catch (err) {
        logger.error(`âŒ Error enviando email de bienvenida: ${err.message}`);
        emailResults.welcome = { success: false, error: err.message };
      }
    }

    if (shouldSendCredentials) {
      try {
        logger.info('ðŸ“§ Enviando credenciales al lÃ­der', { leaderId: leader._id.toString() });
        emailResults.credentials = await emailService.sendCredentialsEmail(leader, baseUrl);
        logger.info(`âœ… Email de credenciales: ${emailResults.credentials.success}`);
      } catch (err) {
        logger.error(`âŒ Error enviando email de credenciales: ${err.message}`);
        emailResults.credentials = { success: false, error: err.message };
      }
    }

    if (shouldSendQR) {
      try {
        logger.info(`ðŸ“± Enviando QR - Token: ${leader.token?.substring(0, 8)}..., Email: ${leader.email}`);
        emailResults.qr = await emailService.sendQRCodeEmail(leader, baseUrl);
        logger.info(`âœ… Email de QR: ${emailResults.qr.success}`);
      } catch (err) {
        logger.error(`âŒ Error enviando email de QR: ${err.message}`);
        emailResults.qr = { success: false, error: err.message };
      }
    }

    if (shouldSendWarning) {
      try {
        emailResults.warning = await emailService.sendWarningEmail(leader);
        logger.info(`âœ… Email de alerta: ${emailResults.warning.success}`);
      } catch (err) {
        logger.error(`âŒ Error enviando email de alerta: ${err.message}`);
        emailResults.warning = { success: false, error: err.message };
      }
    }

    // Registrar en auditorÃ­a
    if (req.user && req.user._id) {
      try {
        const auditUser = {
          ...req.user,
          organizationId: orgFilter._id || req.user.organizationId
        };

        await AuditService.log(
          "SEND_ACCESS_EMAIL",
          "Leader",
          id,
          auditUser,
          {
            leaderEmail: leader.email,
            leaderName: leader.name,
            emailResults
          },
          `EnvÃ­o de acceso a ${leader.email}`,
          req
        );
      } catch (auditError) {
        logger.warn("âŒ Audit log error:", auditError.message);
      }
    }

    // Revisar si al menos un email fue exitoso
    const anySuccess = Object.values(emailResults).some(r => r && r.success);

    if (anySuccess) {
      logger.info(`âœ… Al menos un email fue enviado a ${leader.email}`);
      res.json({
        success: true,
        message: `Correos enviados a ${leader.email}`,
        emailResults,
      });
    } else {
      logger.warn(`âŒ NingÃºn email enviado a ${leader.email}`);
      res.json({
        success: false,
        message: `Error: No fue posible enviar correos a ${leader.email}`,
        emailResults,
      });
    }
  } catch (error) {
    logger.error("âŒ EXCEPTION en sendAccessEmail:", { 
      error: error.message,
      stack: error.stack,
      leaderId 
    });
    return sendError(res, 500, error.message || "Error al enviar el email");
  }
}




export async function updateLeader(req, res) {
  try {
    const { name, email, phone, area, active } = req.body;
    const user = req.user;
    const orgId = req.user.organizationId;

    logger.debug('[LeaderUpdate] Search ID', { leaderId: req.params.id, orgId });

    const leader = await Leader.findOne({ _id: req.params.id });
    if (!leader) {
      logger.debug('[LeaderUpdate] Leader not found in DB', { leaderId: req.params.id, orgId });
      return sendError(res, 404, "Líder no encontrado (DB miss)");
    }

    const isSuperAdmin = req.user.role === 'admin';
    if (!isSuperAdmin && leader.organizationId && leader.organizationId !== orgId) {
      logger.debug('[LeaderUpdate] Org mismatch', { leaderOrg: leader.organizationId, reqOrg: orgId });
      return sendError(res, 404, "Líder no encontrado (Org mismatch)");
    }

    const changes = {};
    if (name !== undefined) changes.name = { old: leader.name, new: name };
    if (email !== undefined) changes.email = { old: leader.email, new: email };
    if (phone !== undefined) changes.phone = { old: leader.phone, new: phone };
    if (area !== undefined) changes.area = { old: leader.area, new: area };
    if (active !== undefined) changes.active = { old: leader.active, new: active };

    const updatedLeader = await leaderService.updateLeader(req.params.id, { name, email, phone, area, active });

    await AuditService.log("UPDATE", "Leader", req.params.id, user, changes, `Líder ${updatedLeader.name} actualizado`);

    return res.json(updatedLeader);
  } catch (error) {
    logger.error("Update leader error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, `Error al actualizar líder: ${error.message}`);
  }
}

export async function deleteLeader(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId;
    const isAdmin = req.user.role === 'admin';

    let leader;
    if (isAdmin) {
      leader = await Leader.findById(req.params.id);
    } else {
      leader = await Leader.findOne({ _id: req.params.id, organizationId: orgId });
    }

    if (!leader) {
      return sendError(res, 404, "Líder no encontrado");
    }

    const result = await leaderService.deleteLeader(req.params.id);

    await AuditService.log(
      "DELETE",
      "Leader",
      leader._id.toString(),
      user,
      { registrations: result.registrationsDeleted },
      `Líder ${leader.name} eliminado (${result.registrationsDeleted} registros eliminados)`
    );

    return res.json({ message: "Líder eliminado", registrationsDeleted: result.registrationsDeleted });
  } catch (error) {
    logger.error("Delete leader error:", { error: error.message, stack: error.stack });
    return sendError(res, error?.statusCode || 500, "Error al eliminar líder");
  }
}

