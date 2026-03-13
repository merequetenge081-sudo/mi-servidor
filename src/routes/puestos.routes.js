import express from "express";
import * as puestosController from "../controllers/puestos.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.get("/public/localidades", rateLimitMiddleware, puestosController.getLocalidadesHandler);
router.get("/public/puestos", rateLimitMiddleware, puestosController.getPuestosHandler);
router.get("/public/puestos/:id", rateLimitMiddleware, puestosController.getPuestoDetalleHandler);

router.get("/localidades", authMiddleware, puestosController.getLocalidadesHandler);
router.get("/puestos", authMiddleware, puestosController.getPuestosHandler);
router.get("/puestos/:id", authMiddleware, puestosController.getPuestoDetalleHandler);
router.post("/puestos/import", authMiddleware, roleMiddleware("admin"), puestosController.importarPuestosHandler);

export default router;

