import express from "express";
import leaderRoutes from "../backend/modules/leaders/leader.routes.js";
import registrationRoutes from "../backend/modules/registrations/registration.routes.js";
import eventRoutes from "../backend/modules/events/event.routes.js";
import puestoRoutes from "../backend/modules/puestos/puesto.routes.js";
import authRoutes from "../backend/modules/auth/auth.routes.js";
import analyticsRoutes from "../backend/modules/analytics/analytics.routes.js";
import exportsRoutes from "../backend/modules/exports/exports.routes.js";
import duplicatesRoutes from "../backend/modules/duplicates/duplicates.routes.js";
import auditRoutes from "../backend/modules/audit/audit.routes.js";
import organizationRoutes from "../backend/modules/organization/organization.routes.js";
import whatsappRoutes from "../backend/modules/whatsapp/whatsapp.routes.js";
import adminRoutes from "../backend/modules/admin/admin.routes.js";
import skillsRoutes from "../backend/modules/skills/skills.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/leaders", leaderRoutes);
router.use("/registrations", registrationRoutes);
router.use("/events", eventRoutes);
router.use("/puestos", puestoRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/exports", exportsRoutes);
router.use("/duplicates", duplicatesRoutes);
router.use("/audit", auditRoutes);
router.use("/organizations", organizationRoutes);
router.use("/whatsapp", whatsappRoutes);
router.use("/admin", adminRoutes);
router.use("/skills", skillsRoutes);

export default router;
