import express from "express";
import * as registrationController from "../controllers/registrations.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
import { rateLimitMiddleware } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/", rateLimitMiddleware, registrationController.createRegistration);
router.post("/bulk", authMiddleware, registrationController.bulkCreateRegistrations);
router.get("/", authMiddleware, registrationController.getRegistrations);
router.get("/leader/:leaderId", authMiddleware, registrationController.getRegistrationsByLeader);
router.post("/leader/:leaderId/verify", authMiddleware, registrationController.verifyLeaderRegistrations);
router.get("/:id", authMiddleware, registrationController.getRegistration);
router.put("/:id", authMiddleware, registrationController.updateRegistration);
router.delete("/:id", authMiddleware, registrationController.deleteRegistration);
router.post("/:id/confirm", authMiddleware, registrationController.confirmRegistration);
router.post("/:id/unconfirm", authMiddleware, roleMiddleware("admin"), registrationController.unconfirmRegistration);
router.post("/fix-names", authMiddleware, roleMiddleware("admin"), registrationController.fixNames);
router.post("/deletion-request", authMiddleware, registrationController.requestBulkDeletion);
router.get("/deletion-request/status", authMiddleware, registrationController.getDeletionRequestStatus);

export default router;

