import express from "express";
import { getTestCredentials } from "../utils/authFallback.js";
import * as maintenanceController from "../controllers/maintenance.controller.js";
import * as registrationController from "../controllers/registrations.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/test-credentials", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "Not available in production" });
  }

  const creds = getTestCredentials();
  return res.json({
    message: "Credenciales de prueba (solo disponible en desarrollo)",
    ...creds
  });
});

router.post("/migrate", maintenanceController.migrateDataHandler);
router.post("/migrate-usernames", authMiddleware, roleMiddleware("admin"), maintenanceController.migrateUsernamesHandler);

if (process.env.NODE_ENV !== "production") {
  router.post("/registrations/bulk/test", registrationController.bulkCreateRegistrations);
}

export default router;
