import express from "express";
import * as duplicatesController from "../controllers/duplicates.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, roleMiddleware("admin"), duplicatesController.getDuplicates);

export default router;

