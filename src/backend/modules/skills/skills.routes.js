import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { organizationMiddleware } from "../../middlewares/organization.middleware.js";
import { roleMiddleware } from "../../middlewares/role.middleware.js";
import * as controller from "./skills.controller.js";

const router = express.Router();

router.use(authMiddleware);
router.use(organizationMiddleware);
router.use(roleMiddleware("admin"));

router.get("/catalog", controller.getCatalog);
router.get("/health", controller.getHealth);
router.get("/inconsistencies", controller.getInconsistencies);
router.get("/jobs", controller.listJobs);
router.get("/jobs/:jobId", controller.getJob);
router.post("/run", controller.runSkill);

export default router;
