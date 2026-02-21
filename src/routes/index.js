import express from "express";
import { adminLogin, leaderLogin, leaderLoginById, changePassword, adminResetPassword, requestPasswordReset, adminGenerateNewPassword, leaderChangePassword, logout, acceptLegalTerms, checkLegalTermsStatus } from "../controllers/auth.js";
import { getTestCredentials } from "../utils/authFallback.js";
import * as leaderController from "../controllers/leaders.controller.js";
import * as registrationController from "../controllers/registrations.controller.js";
import * as eventController from "../controllers/events.controller.js";
import * as statsController from "../controllers/stats.controller.js";
import * as exportController from "../controllers/export.controller.js";
import * as duplicatesController from "../controllers/duplicates.controller.js";
import * as auditController from "../controllers/audit.controller.js";
import * as whatsappController from "../controllers/whatsapp.controller.js";
import * as organizationController from "../controllers/organization.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
import { organizationRoleMiddleware } from "../middleware/organization.middleware.js";
import { rateLimitMiddleware, loginRateLimitMiddleware } from "../middleware/rateLimit.middleware.js";
import logger from "../config/logger.js";

const router = express.Router();
const startTime = Date.now();

// ==================== HEALTH CHECK ====================
router.get("/health", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: "ok",
    uptime,
    timestamp: new Date().toISOString()
  });
});

// ==================== TEST CREDENTIALS (DESARROLLO) ====================
// Endpoint público para obtener credenciales de prueba (solo en desarrollo)
router.get("/test-credentials", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  const creds = getTestCredentials();
  res.json({
    message: "Credenciales de prueba (solo disponible en desarrollo)",
    ...creds
  });
});

// ==================== ENDPOINTS PÚBLICOS ====================
// Endpoint público para obtener información del líder por token (formulario de registro)
router.get("/registro/:token", leaderController.getLeaderByToken);

// Endpoint de migración (solo en desarrollo)
router.post("/migrate", async (req, res) => {
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Endpoint not available in production" });
  }

  try {
    const fs = await import("fs");
    const path = await import("path");
    const { fileURLToPath } = await import("url");
    const { Leader, Registration, Organization } = await import("../models/index.js");

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(path.dirname(path.dirname(__filename)));

    // Leer data.json
    const dataPath = path.join(__dirname, "data.json");
    if (!fs.existsSync(dataPath)) {
      return res.status(404).json({ error: "data.json no encontrado" });
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(rawData);

    // Limpiar datos existentes (opcional)
    const cleanExisting = req.body.clean === true;
    if (cleanExisting) {
      await Leader.deleteMany({});
      await Registration.deleteMany({});
      logger.info("Datos limpios antes de migración");
    }

    // Crear o obtener organización default
    let defaultOrg = await Organization.findOne({ slug: "default" });
    if (!defaultOrg) {
      defaultOrg = new Organization({
        name: "Default Organization",
        slug: "default",
        description: "Organización por defecto para datos migrables",
        status: "active",
        plan: "pro"
      });
      await defaultOrg.save();
      logger.info("Organización default creada");
    }

    const orgId = defaultOrg._id.toString();

    // Migrar líderes
    let leaderCount = 0;
    const leaderIdMap = {};

    for (const leader of data.leaders || []) {
      // Evitar duplicados por email
      const existing = await Leader.findOne({ email: leader.email, organizationId: orgId });
      if (existing) {
        leaderIdMap[leader.id] = existing._id.toString();
        continue;
      }

      const newLeader = new Leader({
        leaderId: `leader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: leader.name,
        email: leader.email,
        phone: leader.phone,
        area: leader.area,
        active: leader.isActive ?? true,
        token: leader.token || `leader-${Date.now()}-${Math.random()}`,
        registrations: leader.registrations || 0,
        organizationId: orgId
      });

      const saved = await newLeader.save();
      leaderIdMap[leader.id] = saved._id.toString();
      leaderCount++;
      logger.info(`Líder creado: ${leader.name}`);
    }

    // Migrar registros
    let registrationCount = 0;
    for (const reg of data.registrations || []) {
      // Evitar duplicados por email y cedula
      const existing = await Registration.findOne({
        email: reg.email,
        cedula: reg.cedula,
        organizationId: orgId
      });
      if (existing) continue;

      const newReg = new Registration({
        leaderId: leaderIdMap[reg.leaderId] || reg.leaderId,
        leaderName: reg.leaderName,
        eventId: "", // Sin evento asignado por ahora
        firstName: reg.firstName,
        lastName: reg.lastName,
        cedula: reg.cedula,
        email: reg.email,
        phone: reg.phone,
        date: reg.date || new Date().toISOString().split('T')[0],
        notifications: {
          whatsappSent: reg.whatsappSent || false
        },
        organizationId: orgId
      });

      await newReg.save();
      registrationCount++;
      logger.info(`Registro creado: ${reg.firstName} ${reg.lastName}`);
    }

    logger.info(`Migración completada: ${leaderCount} líderes, ${registrationCount} registros`);

    res.json({
      success: true,
      message: "Migración completada exitosamente",
      stats: {
        leadersCreated: leaderCount,
        registrationsCreated: registrationCount,
        organizationId: orgId
      }
    });
  } catch (error) {
    logger.error("Error en migración:", error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== AUTENTICACIÓN ====================
router.post("/auth/admin-login", loginRateLimitMiddleware, adminLogin);
router.post("/auth/leader-login", loginRateLimitMiddleware, leaderLogin);
router.post("/auth/leader-login-id", loginRateLimitMiddleware, leaderLoginById);
router.post("/auth/logout", authMiddleware, logout);
router.post("/auth/change-password", authMiddleware, changePassword);
router.post("/auth/admin-reset-password", authMiddleware, roleMiddleware("admin"), adminResetPassword);
router.post("/auth/request-password-reset", requestPasswordReset);
router.post("/auth/admin-generate-password", authMiddleware, roleMiddleware("admin"), adminGenerateNewPassword);
router.post("/auth/leader-change-password", authMiddleware, leaderChangePassword);

// ==================== TÉRMINOS LEGALES (Ley 1581) ====================
router.post("/auth/accept-legal-terms", authMiddleware, acceptLegalTerms);
router.get("/auth/legal-terms-status", authMiddleware, checkLegalTermsStatus);

// ==================== ORGANIZACIONES (MULTI-TENANT) ====================
router.post("/organizations", authMiddleware, organizationRoleMiddleware("super_admin"), organizationController.createOrganization);
router.get("/organizations", authMiddleware, organizationRoleMiddleware("super_admin"), organizationController.getOrganizations);
router.get("/organizations/:orgId", authMiddleware, organizationRoleMiddleware("super_admin", "org_admin"), organizationController.getOrganizationDetails);
router.put("/organizations/:orgId", authMiddleware, organizationRoleMiddleware("super_admin"), organizationController.updateOrganization);
router.delete("/organizations/:orgId", authMiddleware, organizationRoleMiddleware("super_admin"), organizationController.deleteOrganization);
router.get("/organizations/:orgId/stats", authMiddleware, organizationRoleMiddleware("super_admin", "org_admin"), organizationController.getOrganizationStats);

// ==================== LÍDERES ====================
router.post("/leaders", authMiddleware, roleMiddleware("admin"), leaderController.createLeader);
router.get("/leaders", authMiddleware, leaderController.getLeaders);
router.get("/leaders/top", authMiddleware, leaderController.getTopLeaders);
router.get("/leaders/:leaderId/qr", authMiddleware, leaderController.generateLeaderQR);
router.get("/leaders/:id", authMiddleware, leaderController.getLeader);
router.put("/leaders/:id", authMiddleware, roleMiddleware("admin"), leaderController.updateLeader);
router.delete("/leaders/:id", authMiddleware, roleMiddleware("admin"), leaderController.deleteLeader);
router.post("/leaders/:id/send-access", authMiddleware, roleMiddleware("admin"), leaderController.sendAccessEmail);

// ==================== REGISTRACIONES ====================
router.post("/registrations", rateLimitMiddleware, registrationController.createRegistration);
router.post("/registrations/bulk", authMiddleware, registrationController.bulkCreateRegistrations);
router.get("/registrations", authMiddleware, registrationController.getRegistrations);
router.get("/registrations/leader/:leaderId", authMiddleware, registrationController.getRegistrationsByLeader);
router.get("/registrations/:id", authMiddleware, registrationController.getRegistration);
router.put("/registrations/:id", authMiddleware, registrationController.updateRegistration);
router.delete("/registrations/:id", authMiddleware, registrationController.deleteRegistration);
router.post("/registrations/:id/confirm", authMiddleware, registrationController.confirmRegistration);
router.post("/registrations/:id/unconfirm", authMiddleware, roleMiddleware("admin"), registrationController.unconfirmRegistration);

// ==================== EVENTOS ====================
router.post("/events", authMiddleware, roleMiddleware("admin"), eventController.createEvent);
router.get("/events", authMiddleware, eventController.getEvents);
router.get("/events/active", authMiddleware, eventController.getActiveEvent);
router.get("/events/:id", authMiddleware, eventController.getEvent);
router.put("/events/:id", authMiddleware, roleMiddleware("admin"), eventController.updateEvent);
router.delete("/events/:id", authMiddleware, roleMiddleware("admin"), eventController.deleteEvent);

// ==================== ESTADÍSTICAS ====================
router.get("/stats", authMiddleware, statsController.getStats);
router.get("/stats/daily", authMiddleware, statsController.getDailyStats);

// ==================== EXPORTACIÓN ====================
router.get("/export/:type", authMiddleware, roleMiddleware("admin"), exportController.exportData);

// ==================== DUPLICADOS ====================
router.get("/duplicates", authMiddleware, roleMiddleware("admin"), duplicatesController.getDuplicates);

// ==================== AUDITORÍA ====================
router.get("/audit-logs", authMiddleware, roleMiddleware("admin"), auditController.getAuditLogs);
router.get("/audit-stats", authMiddleware, roleMiddleware("admin"), auditController.getAuditStats);

// ==================== WHATSAPP Y QR ====================
router.post("/send-whatsapp", authMiddleware, roleMiddleware("admin"), whatsappController.sendWhatsApp);
router.post("/leaders/:id/send-qr", authMiddleware, roleMiddleware("admin"), whatsappController.sendQRCode);

// ==================== MIGRACIÓN DE USUARIOS ====================
router.post("/migrate-usernames", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { Leader } = await import("../models/Leader.js");
    const bcryptjs = (await import("bcryptjs")).default;

    // Find leaders without fixed passwords or without username
    const leaders = await Leader.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: "" },
        { isTemporaryPassword: true },
        { passwordCanBeChanged: true }
      ]
    });

    if (leaders.length === 0) {
      return res.json({ message: "Todos los líderes ya tienen usuario asignado.", migrated: 0, results: [] });
    }

    const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const results = [];

    for (const leader of leaders) {
      let username = leader.username;
      if (!username) {
        const cleanName = (leader.name || "usuario desconocido").trim().split(/\s+/);
        const firstName = cleanName[0] || "user";
        const lastName = cleanName.length > 1 ? cleanName[1] : "leader";

        let baseUsername = normalize(firstName.charAt(0) + lastName);
        if (!baseUsername) baseUsername = "user";
        username = baseUsername;

        // Ensure uniqueness (check DB + already assigned in this batch)
        const usedInBatch = results.map(r => r.username);
        let counter = 1;
        while ((await Leader.findOne({ username })) || usedInBatch.includes(username)) {
          counter++;
          username = `${baseUsername}${counter}`;
        }
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
      const passwordHash = await bcryptjs.hash(tempPassword, 10);

      // Update directly in DB using updateOne to avoid full validation on legacy docs
      await Leader.updateOne({ _id: leader._id }, {
        $set: {
          username: username,
          passwordHash: passwordHash,
          isTemporaryPassword: true,
          passwordCanBeChanged: true,
          passwordResetRequested: false,
          tempPasswordPlaintext: tempPassword
        }
      });

      results.push({
        _id: leader._id,
        name: leader.name,
        email: leader.email || null,
        username: username,
        tempPassword: tempPassword
      });

      logger.info(`[MIGRATION] ${leader.name} → ${username}`);
    }

    // Print all to console for easy copy
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║     MIGRACIÓN DE USUARIOS - CREDENCIALES        ║");
    console.log("╠══════════════════════════════════════════════════╣");
    results.forEach(r => {
      console.log(`║ ${r.name.padEnd(25)} │ ${r.username.padEnd(12)} │ ${r.tempPassword}`);
    });
    console.log("╚══════════════════════════════════════════════════╝\n");

    res.json({
      message: `${results.length} líderes migrados exitosamente`,
      migrated: results.length,
      results
    });

  } catch (error) {
    logger.error("Migration error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error en migración: " + error.message });
  }
});

// ==================== API HOME ====================
router.get("/", (req, res) => {
  res.json({ message: "API Home" });
});

export default router;
