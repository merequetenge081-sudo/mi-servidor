import express from "express";
import maintenanceRoutes from "./maintenance.routes.js";
import publicRoutes from "./public.routes.js";
import authRoutes from "./auth.routes.js";
import organizationsRoutes from "./organizations.routes.js";
import puestosRoutes from "./puestos.routes.js";
import adminRoutes from "./admin.routes.js";
import leadersRoutes from "./leaders.routes.js";
import registrationsRoutes from "./registrations.routes.js";
import registrationsAdminRoutes from "./registrations-admin.routes.js";
import eventsRoutes from "./events.routes.js";
import statsRoutes from "./stats.routes.js";
import exportRoutes from "./export.routes.js";
import duplicatesRoutes from "./duplicates.routes.js";
import auditRoutes from "./audit.routes.js";
import whatsappRoutes from "./whatsapp.routes.js";

const router = express.Router();
const startTime = Date.now();

router.get("/health", (req, res) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  res.json({
    status: "ok",
    uptime,
    timestamp: new Date().toISOString()
  });
});

router.use("/", maintenanceRoutes);
router.use("/", publicRoutes);
router.use("/auth", authRoutes);
router.use("/organizations", organizationsRoutes);
router.use("/", puestosRoutes);
router.use("/admin", adminRoutes);
router.use("/leaders", leadersRoutes);
router.use("/registrations", registrationsRoutes);
router.use("/", registrationsAdminRoutes);
router.use("/events", eventsRoutes);
router.use("/stats", statsRoutes);
router.use("/export", exportRoutes);
router.use("/duplicates", duplicatesRoutes);
router.use("/", auditRoutes);
router.use("/", whatsappRoutes);

router.get("/", (req, res) => {
  res.json({ message: "API Home" });
});

export default router;

