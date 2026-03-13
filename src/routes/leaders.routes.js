import express from "express";
import * as leaderController from "../controllers/leaders.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, roleMiddleware("admin"), leaderController.createLeader);
router.get("/", authMiddleware, leaderController.getLeaders);
router.get("/top", authMiddleware, leaderController.getTopLeaders);
router.get("/:leaderId/qr", authMiddleware, leaderController.generateLeaderQR);
router.get("/:id/credentials", authMiddleware, roleMiddleware("admin"), leaderController.getLeaderCredentials);
router.get("/:id", authMiddleware, leaderController.getLeader);
router.put("/:id", authMiddleware, roleMiddleware("admin"), leaderController.updateLeader);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), leaderController.deleteLeader);
router.post("/:id/send-access", authMiddleware, roleMiddleware("admin"), leaderController.sendAccessEmail);

export default router;

