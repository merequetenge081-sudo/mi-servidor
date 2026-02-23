/**
 * Puesto Routes
 * Definición de rutas para módulo puestos
 */

import express from "express";
import { PuestoController } from "./puesto.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { roleMiddleware } from "../../middlewares/role.middleware.js";

const router = express.Router();
const controller = new PuestoController();

// ==================== RUTAS PÚBLICAS ====================
// Obtener todas las localidades
router.get("/localidades", controller.getLocalidades.bind(controller));

// Obtener puestos por localidad
router.get("/localidad/:localidad", controller.getPuestosByLocalidad.bind(controller));

// Obtener detalle de un puesto
router.get("/:id", controller.getPuestoDetalle.bind(controller));

// ==================== RUTAS PROTEGIDAS ====================
// Listar puestos (paginado)
router.get("/", controller.getPuestos.bind(controller));

// Obtener stats de mesas
router.get("/stats/localidad/:localidad", controller.getMesasStats.bind(controller));

// ==================== RUTAS ADMIN ====================
// Aplicar auth + role admin
router.use(authMiddleware);
router.use(roleMiddleware("admin"));

// Crear puesto individual
router.post("/", controller.createPuesto.bind(controller));

// Actualizar puesto
router.put("/:id", controller.updatePuesto.bind(controller));

// Eliminar puesto
router.delete("/:id", controller.deletePuesto.bind(controller));

// Importar puestos en bulk
router.post("/import", controller.importarPuestos.bind(controller));

export default router;
