import { Router } from "express";
import {
  getPuestosHandler,
  getPuestoDetalleHandler,
  getLocalidadesHandler,
  importarPuestosHandler
} from "../controllers/puestos.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminOnly.middleware.js";

const router = Router();

// Rutas públicas (protegidas por token)
router.get("/localidades", verifyToken, getLocalidadesHandler);
router.get("/:id", verifyToken, getPuestoDetalleHandler);
router.get("/", verifyToken, getPuestosHandler);

// Rutas admin
router.post("/import", verifyToken, adminOnly, importarPuestosHandler);

export default router;
