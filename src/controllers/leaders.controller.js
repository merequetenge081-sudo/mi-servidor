import { Leader } from "../models/Leader.js";
import { Registration } from "../models/Registration.js";
import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { Organization } from "../models/Organization.js";
import { buildOrgFilter } from "../middleware/organization.middleware.js";
import { emailService } from "../services/emailService.js";

// Generar token único de 32 caracteres hexadecimales
function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

export async function createLeader(req, res) {
  try {
    const { name, email, phone, area, eventId, token: providedToken, customUsername } = req.body;
    let { leaderId } = req.body; // Allow modification
    const user = req.user;

    // Auto-generate leaderId if not provided
    if (!leaderId) {
      leaderId = `LID-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }

    if (!name) {
      return res.status(400).json({ error: "El nombre es requerido" });
    }

    const existing = await Leader.findOne({ leaderId });
    if (existing) {
      return res.status(400).json({ error: "leaderId ya existe" });
    }

    // Generar token automáticamente (no permitir token manual)
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
        return res.status(400).json({ error: `El usuario "${username}" ya existe. Elige otro.` });
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
    const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    // 3. Mock Email Service
    const loginLink = `${process.env.BASE_URL || 'http://localhost:5000'}/`;
    console.log("\n==================================================");
    console.log(" ?? MOCK EMAIL SERVICE - WELCOME LEADER ??");
    console.log(`To: ${email || 'No Email Provided'}`);
    console.log(`Subject: Bienvenido a Red Política - Tus Credenciales`);
    console.log("--------------------------------------------------");
    console.log(`Hola ${name},`);
    console.log(`Se ha creado tu cuenta de líder.`);
    console.log(`Usuario: ${username}`);
    console.log(`Contraseña Temporal: ${tempPassword}`);
    console.log(`Ingresa aquí: ${loginLink}`);
    console.log(`(Se te pedirá cambiar la contraseña al ingresar)`);
    console.log("==================================================\n");
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
          description: "Organización por defecto",
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

      token,
      registrations: 0,
      organizationId: orgId // Multi-tenant: asignar org automáticamente o default
    });

    await leader.save();

    await AuditService.log("CREATE", "Leader", leader._id.toString(), user, { leaderId, name, username }, `Líder ${name} creado`);

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
      return res.status(500).json({ error: "Error al generar token único, intenta nuevamente" });
    }
    if (error.code === 11000 && error.keyPattern?.username) {
      return res.status(500).json({ error: "Error al generar usuario único, intenta nuevamente" });
    }

    res.status(500).json({ error: "Error al crear líder" });
  }
}

export async function getLeaders(req, res) {
  try {
    const { eventId, active } = req.query;
    const filter = buildOrgFilter(req); // Multi-tenant filtering

    if (eventId) filter.eventId = eventId;
    if (active !== undefined) filter.active = active === "true";

    const leaders = await Leader.find(filter).sort({ name: 1 });
    res.json(leaders);
  } catch (error) {
    logger.error("Get leaders error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener líderes" });
  }
}

export async function getLeader(req, res) {
  try {
    const id = req.params.id;
    let leader = null;

    // Try by MongoDB _id first (if valid ObjectId format)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
    if (isObjectId) {
      leader = await Leader.findById(id);
    }

    // Fallback: try by leaderId field
    if (!leader) {
      leader = await Leader.findOne({ leaderId: id });
    }

    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }
    res.json(leader);
  } catch (error) {
    logger.error("Get leader error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener líder" });
  }
}

export async function updateLeader(req, res) {
  try {
    const { name, email, phone, area, active } = req.body;
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter

    // DEBUG LOGS
    console.log(`[UPDATE DEBUG] Search ID: ${req.params.id}, Requesting Org: ${orgId}`);

    // Find by ID first to allow adopting legacy records (missing organizationId)
    const leader = await Leader.findOne({ _id: req.params.id });

    if (!leader) {
      console.log(`[UPDATE DEBUG] Leader NOT FOUND in DB`);
      return res.status(404).json({ error: "Líder no encontrado (DB miss)" });
    }

    console.log(`[UPDATE DEBUG] Found Leader: ${leader.name}, Org: ${leader.organizationId}`);

    // Security check: If leader has orgId and it doesn't match, block access
    // UNLESS user is superadmin (who has no orgId or has access to all)
    // FIX: Also treat 'admin' with no orgId as superadmin (legacy admin support)
    const isSuperAdmin = req.user.role === 'superadmin' ||
      req.user.role === 'super_admin' ||
      (req.user.role === 'admin' && !orgId);

    if (!isSuperAdmin && leader.organizationId && leader.organizationId !== orgId) {
      console.log(`[UPDATE DEBUG] Org Mismatch! Leader Org: ${leader.organizationId} !== Req Org: ${orgId}`);
      return res.status(404).json({ error: "Líder no encontrado (Org mismatch)" });
    }

    const changes = {};
    if (name !== undefined) {
      changes.name = { old: leader.name, new: name };
      leader.name = name;
    }
    if (email !== undefined) {
      changes.email = { old: leader.email, new: email };
      leader.email = email;
    }
    if (phone !== undefined) {
      changes.phone = { old: leader.phone, new: phone };
      leader.phone = phone;
    }
    if (area !== undefined) {
      changes.area = { old: leader.area, new: area };
      leader.area = area;
    }
    if (active !== undefined) {
      changes.active = { old: leader.active, new: active };
      leader.active = active;
    }

    // Backfill required fields for legacy data to pass validation
    if (!leader.leaderId) leader.leaderId = leader._id.toString();
    if (!leader.token) leader.token = generateToken();

    // Fix: Ensure organizationId is set for legacy leaders
    if (!leader.organizationId) {
      if (orgId) {
        leader.organizationId = orgId;
      } else {
        // Fallback to default organization
        let defaultOrg = await Organization.findOne({ slug: "default" });
        if (!defaultOrg) {
          // Create default org if not exists (auto-fix)
          defaultOrg = new Organization({
            name: "Default Organization",
            slug: "default",
            description: "Organización por defecto para datos migrables",
            status: "active",
            plan: "pro"
          });
          await defaultOrg.save();
          logger.info("Created default organization for legacy leader fix");
        }
        leader.organizationId = defaultOrg._id.toString();
        // Also update changes object for audit log
        changes.organizationId = { old: null, new: leader.organizationId };
        console.log(`[UPDATE FIX] Assigned leader to Default Org: ${leader.organizationId}`);
      }
    }

    leader.updatedAt = new Date();
    await leader.save();

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), user, changes, `Líder ${leader.name} actualizado`);

    res.json(leader);
  } catch (error) {
    logger.error("Update leader error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al actualizar líder: " + error.message });
  }
}

export async function deleteLeader(req, res) {
  try {
    const user = req.user;
    const orgId = req.user.organizationId; // Multi-tenant filter
    // Fix: Allow superadmin/legacy admin to delete
    let leader;
    const isSuperAdmin = req.user.role === 'superadmin' ||
      req.user.role === 'super_admin' ||
      (req.user.role === 'admin' && !orgId);

    if (isSuperAdmin) {
      leader = await Leader.findById(req.params.id);
    } else {
      leader = await Leader.findOne({ _id: req.params.id, organizationId: orgId });
    }

    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    const registrationCount = await Registration.countDocuments({ leaderId: leader.leaderId });

    await Leader.deleteOne({ _id: req.params.id });
    await AuditService.log("DELETE", "Leader", leader._id.toString(), user, { registrations: registrationCount }, `Líder ${leader.name} eliminado`);

    res.json({ message: "Líder eliminado", registrationsDeleted: registrationCount });
  } catch (error) {
    logger.error("Delete leader error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al eliminar líder" });
  }
}

export async function getTopLeaders(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const filter = buildOrgFilter(req); // Multi-tenant filtering
    const leaders = await Leader.find({ ...filter, active: true }).sort({ registrations: -1 }).limit(limit);
    res.json(leaders);
  } catch (error) {
    logger.error("Get top leaders error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener líderes destacados" });
  }
}

export async function generateLeaderQR(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;

    // Control de acceso: admin puede ver todo, leader solo su propio QR
    if (user.role === "leader" && user.leaderId !== leaderId) {
      return res.status(403).json({ error: "No tienes permiso para generar este QR" });
    }

    const leader = await Leader.findOne({ leaderId });
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    // Generar URL del formulario con token (más seguro y consistente)
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
    res.status(500).json({ error: "Error al generar código QR" });
  }
}

// Endpoint público para obtener información del líder por token
export async function getLeaderByToken(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Token requerido" });
    }

    // Permitir búsqueda por token (UUID) o leaderId (legacy L001)
    const leader = await Leader.findOne({
      $or: [{ token: token }, { leaderId: token }]
    }).select('leaderId name eventId active');

    if (!leader) {
      return res.status(404).json({ error: "Token inválido o líder no encontrado" });
    }

    if (!leader.active) {
      return res.status(403).json({ error: "Líder inactivo" });
    }

    // Look up event name if leader has an eventId
    let eventName = null;
    if (leader.eventId) {
      try {
        const { Event } = await import("../models/Event.js");
        const event = await Event.findById(leader.eventId).select('name');
        if (event) eventName = event.name;
      } catch (e) {
        // Event lookup is optional, don't fail
      }
    }

    // Retornar datos necesarios para el formulario público
    res.json({
      leaderId: leader.leaderId,
      name: leader.name,
      eventId: leader.eventId,
      eventName: eventName
    });
  } catch (error) {
    logger.error("Get leader by token error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al obtener información del líder" });
  }
}

/**
 * Envía email con enlace personalizado y QR al líder
 * POST /api/leaders/:id/send-access
 * Body: { sendWelcomeEmail, sendCredentialsEmail, sendQRCodeEmail, sendWarningEmail }
 */
export async function sendAccessEmail(req, res) {
  let leaderId = null;
  try {
    const { id } = req.params;
    leaderId = id;
    
    // Flags opcionales para controlar qué correos enviar
    const { 
      sendWelcomeEmail = false,
      sendCredentialsEmail = false, 
      sendQRCodeEmail = false,
      sendWarningEmail = false 
    } = req.body || {};

    const orgFilter = buildOrgFilter(req.user);

    // Validar que el líder existe y pertenece a la organización
    const leader = await Leader.findOne({ _id: id, ...orgFilter });
    if (!leader) {
      logger.warn(`❌ Líder no encontrado: ${id}`);
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    if (!leader.email) {
      logger.warn(`❌ Email no configurado para líder: ${leader.name}`);
      return res.status(400).json({ error: "El líder no tiene email configurado" });
    }

    // Si no se seleccionó ningún email, usar QR por defecto (comportamiento legacy)
    const shouldSendWelcome = sendWelcomeEmail === true;
    const shouldSendCredentials = sendCredentialsEmail === true;
    const shouldSendQR = sendQRCodeEmail === true || (!sendWelcomeEmail && !sendCredentialsEmail && !sendWarningEmail);
    const shouldSendWarning = sendWarningEmail === true;

    // Determinar base URL
    const baseUrl = process.env.BASE_URL || 
                   (process.env.FRONTEND_URL) ||
                   `${req.protocol}://${req.get('host')}`;

    logger.info(`📧 Enviando correos a ${leader.email} para ${leader.name}...`);
    logger.info(`📧 Flags: Welcome=${shouldSendWelcome}, Credentials=${shouldSendCredentials}, QR=${shouldSendQR}, Warning=${shouldSendWarning}`);

    const emailResults = {
      welcome: null,
      credentials: null,
      qr: null,
      warning: null
    };

    // Enviar correos según flags
    if (shouldSendWelcome) {
      try {
        emailResults.welcome = await emailService.sendWelcomeEmail(leader, baseUrl);
        logger.info(`✅ Email de bienvenida: ${emailResults.welcome.success}`);
      } catch (err) {
        logger.error(`❌ Error enviando email de bienvenida: ${err.message}`);
        emailResults.welcome = { success: false, error: err.message };
      }
    }

    if (shouldSendCredentials) {
      try {
        emailResults.credentials = await emailService.sendCredentialsEmail(leader);
        logger.info(`✅ Email de credenciales: ${emailResults.credentials.success}`);
      } catch (err) {
        logger.error(`❌ Error enviando email de credenciales: ${err.message}`);
        emailResults.credentials = { success: false, error: err.message };
      }
    }

    if (shouldSendQR) {
      try {
        emailResults.qr = await emailService.sendQRCodeEmail(leader, baseUrl);
        logger.info(`✅ Email de QR: ${emailResults.qr.success}`);
      } catch (err) {
        logger.error(`❌ Error enviando email de QR: ${err.message}`);
        emailResults.qr = { success: false, error: err.message };
      }
    }

    if (shouldSendWarning) {
      try {
        emailResults.warning = await emailService.sendWarningEmail(leader);
        logger.info(`✅ Email de alerta: ${emailResults.warning.success}`);
      } catch (err) {
        logger.error(`❌ Error enviando email de alerta: ${err.message}`);
        emailResults.warning = { success: false, error: err.message };
      }
    }

    // Registrar en auditoría
    if (req.user && req.user._id) {
      try {
        AuditService.log({
          action: 'SEND_ACCESS_EMAIL',
          actor: req.user._id,
          target: 'Leader',
          targetId: id,
          details: {
            leaderEmail: leader.email,
            leaderName: leader.name,
            emailResults,
          },
          organizationId: orgFilter._id || req.user.organizationId,
        });
      } catch (auditError) {
        logger.warn('❌ Audit log error:', auditError.message);
      }
    }

    // Revisar si al menos un email fue exitoso
    const anySuccess = Object.values(emailResults).some(r => r && r.success);

    if (anySuccess) {
      logger.info(`✅ Al menos un email fue enviado a ${leader.email}`);
      res.json({
        success: true,
        message: `Correos enviados a ${leader.email}`,
        emailResults,
      });
    } else {
      logger.warn(`❌ Ningún email enviado a ${leader.email}`);
      res.json({
        success: false,
        message: `Error: No fue posible enviar correos a ${leader.email}`,
        emailResults,
      });
    }
  } catch (error) {
    logger.error("❌ EXCEPTION en sendAccessEmail:", { 
      error: error.message,
      stack: error.stack,
      leaderId 
    });
    res.status(500).json({ 
      error: error.message || "Error al enviar el email",
      success: false
    });
  }
}
