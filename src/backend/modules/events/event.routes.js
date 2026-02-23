/**
 * Event Routes
 * Definición de rutas para módulo events
 */

import express from "express";
import { EventController } from "./event.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { roleMiddleware } from "../../middlewares/role.middleware.js";
import { organizationMiddleware } from "../../middlewares/organization.middleware.js";

const router = express.Router();
const controller = new EventController();

// ==================== RUTAS PÚBLICAS ====================
// Obtener evento activo (público)
router.get("/active/current", controller.getActiveEvent.bind(controller));

// ==================== RUTAS PROTEGIDAS ====================
// Aplicar middlewares de autenticación y organización
router.use(authMiddleware);
router.use(organizationMiddleware);

// Listar eventos
router.get("/", controller.getEvents.bind(controller));

// Obtener un evento específico
router.get("/:id", controller.getEvent.bind(controller));

// ==================== RUTAS ADMIN ====================
// Aplicar role admin
router.use(roleMiddleware("admin"));

// Crear evento
router.post("/", controller.createEvent.bind(controller));

// Actualizar evento
router.put("/:id", controller.updateEvent.bind(controller));

// Eliminar evento
router.delete("/:id", controller.deleteEvent.bind(controller));

// Activar evento
router.post("/:id/activate", controller.activateEvent.bind(controller));

export default router;
