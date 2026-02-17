import express from "express";
import { adminLogin, leaderLogin, leaderLoginById } from "../controllers/auth.js";
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

// ==================== ENDPOINTS PÚBLICOS ====================
// Endpoint público para obtener información del líder por token (formulario de registro)
router.get("/registro/:token", leaderController.getLeaderByToken);

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
