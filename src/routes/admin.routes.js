import express from "express";
import * as adminController from "../controllers/admin.controller.js";
import { importarPuestosSimpleHandler } from "../controllers/puestos.admin.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.post("/import-puestos", authMiddleware, roleMiddleware("admin"), adminController.importarPuestosAPIHandler);
router.post("/import-puestos-simple", authMiddleware, roleMiddleware("admin"), importarPuestosSimpleHandler);
router.post("/import-geojson-puestos", authMiddleware, roleMiddleware("admin"), adminController.importarPuestosDesdeGeoJSON);
router.post("/sync-mesas-bogota", authMiddleware, roleMiddleware("admin"), adminController.syncMesasBogotaHandler);
router.get("/validacion-datos-reales", authMiddleware, roleMiddleware("admin"), adminController.getRealDataValidationHandler);
router.post("/validacion-datos-reales/run", authMiddleware, roleMiddleware("admin"), adminController.runRealDataValidationHandler);
router.get("/e14-confirmation", authMiddleware, roleMiddleware("admin"), adminController.getE14ConfirmationHandler);
router.post("/e14-confirmation/manual-save", authMiddleware, roleMiddleware("admin"), adminController.saveE14ConfirmationManualHandler);
router.get("/e14-confirmation/by-mesa", authMiddleware, roleMiddleware("admin"), adminController.getE14ConfirmationByMesaHandler);
router.post("/e14-confirmation/by-mesa/manual-save", authMiddleware, roleMiddleware("admin"), adminController.saveE14ConfirmationByMesaManualHandler);

export default router;
