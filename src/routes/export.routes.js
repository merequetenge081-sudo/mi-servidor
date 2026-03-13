import express from "express";
import * as exportController from "../controllers/export.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/:type", authMiddleware, roleMiddleware("admin"), exportController.exportData);

export default router;

