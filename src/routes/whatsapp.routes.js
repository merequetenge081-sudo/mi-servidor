import express from "express";
import * as whatsappController from "../controllers/whatsapp.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/send-whatsapp", authMiddleware, roleMiddleware("admin"), whatsappController.sendWhatsApp);
router.post("/leaders/:id/send-qr", authMiddleware, roleMiddleware("admin"), whatsappController.sendQRCode);

export default router;

