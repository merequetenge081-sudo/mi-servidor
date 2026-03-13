import express from "express";
import * as organizationController from "../controllers/organization.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { organizationRoleMiddleware } from "../middleware/organization.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, organizationRoleMiddleware("admin"), organizationController.createOrganization);
router.get("/", authMiddleware, organizationRoleMiddleware("admin"), organizationController.getOrganizations);
router.get("/:orgId", authMiddleware, organizationRoleMiddleware("admin", "org_admin"), organizationController.getOrganizationDetails);
router.put("/:orgId", authMiddleware, organizationRoleMiddleware("admin"), organizationController.updateOrganization);
router.delete("/:orgId", authMiddleware, organizationRoleMiddleware("admin"), organizationController.deleteOrganization);
router.get("/:orgId/stats", authMiddleware, organizationRoleMiddleware("admin", "org_admin"), organizationController.getOrganizationStats);

export default router;

