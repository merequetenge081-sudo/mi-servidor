/**
 * Registration Routes
 * Definición de rutas para módulo registrations
 */

import express from "express";
import { RegistrationController } from "./registration.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { roleMiddleware, rolesMiddleware } from "../../middlewares/role.middleware.js";
import { organizationMiddleware } from "../../middlewares/organization.middleware.js";

const router = express.Router();
const controller = new RegistrationController();

// ==================== RUTAS PÚBLICAS ====================
// Crear registration (público con token del líder)
router.post("/", controller.createRegistration.bind(controller));

// ==================== RUTAS PROTEGIDAS ====================
// Aplicar middlewares de autenticación y organización
router.use(authMiddleware);
router.use(organizationMiddleware);

// Obtener todas las registrations
router.get("/", controller.getRegistrations.bind(controller));

// Obtener registrations de un líder específico
router.get("/leader/:leaderId", controller.getRegistrationsByLeader.bind(controller));

// Obtener un registro específico
router.get("/:id", controller.getRegistration.bind(controller));

// ==================== RUTAS ADMIN ====================
// Aplicar role admin
router.use(rolesMiddleware(["admin", "leader"]));

// Actualizar registro
router.put("/:id", controller.updateRegistration.bind(controller));

// Eliminar registro
router.delete("/:id", controller.deleteRegistration.bind(controller));

// Confirmar asistencia
router.post("/:id/confirm", controller.confirmRegistration.bind(controller));

// Desconfirmar asistencia
router.post("/:id/unconfirm", controller.unconfirmRegistration.bind(controller));

// Bulk create
router.post("/bulk/create", controller.bulkCreateRegistrations.bind(controller));

export default router;
