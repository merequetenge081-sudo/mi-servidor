import express from "express";
import * as statsController from "../controllers/stats.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, statsController.getStats);
router.get("/daily", authMiddleware, statsController.getDailyStats);

export default router;

