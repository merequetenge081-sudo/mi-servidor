import express from "express";
import * as auditController from "../controllers/audit.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/audit-logs", authMiddleware, roleMiddleware("admin"), auditController.getAuditLogs);
router.get("/audit-stats", authMiddleware, roleMiddleware("admin"), auditController.getAuditStats);

export default router;

