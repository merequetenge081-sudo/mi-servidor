import express from "express";
import * as eventController from "../controllers/events.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/", authMiddleware, roleMiddleware("admin"), eventController.createEvent);
router.get("/", authMiddleware, eventController.getEvents);
router.get("/active", authMiddleware, eventController.getActiveEvent);
router.get("/:id", authMiddleware, eventController.getEvent);
router.put("/:id", authMiddleware, roleMiddleware("admin"), eventController.updateEvent);
router.delete("/:id", authMiddleware, roleMiddleware("admin"), eventController.deleteEvent);

export default router;

