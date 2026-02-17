import express from "express";
import { adminLogin, leaderLogin, leaderLoginById } from "../controllers/auth.js";
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
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware.js";
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
router.post("/auth/admin-login", adminLogin);
router.post("/auth/leader-login", leaderLogin);
router.post("/auth/leader-login-id", leaderLoginById);

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

// ==================== REGISTRACIONES ====================
router.post("/registrations", rateLimitMiddleware, registrationController.createRegistration);
router.get("/registrations", authMiddleware, registrationController.getRegistrations);
router.get("/registrations/leader/:leaderId", authMiddleware, registrationController.getRegistrationsByLeader);
router.get("/registrations/:id", authMiddleware, registrationController.getRegistration);
router.put("/registrations/:id", authMiddleware, registrationController.updateRegistration);
router.delete("/registrations/:id", authMiddleware, roleMiddleware("admin"), registrationController.deleteRegistration);
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

// ==================== API HOME ====================
router.get("/", (req, res) => {
  res.json({ message: "API Home" });
});

export default router;
