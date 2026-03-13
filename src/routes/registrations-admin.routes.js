import express from "express";
import * as registrationController from "../controllers/registrations.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/deletion-requests", authMiddleware, roleMiddleware("admin"), registrationController.getAllDeletionRequests);
router.post("/deletion-requests/:requestId/review", authMiddleware, roleMiddleware("admin"), registrationController.reviewDeletionRequest);
router.get("/archived-registrations/search/:cedula", authMiddleware, registrationController.searchArchivedByCedula);
router.get("/archived-registrations/stats", authMiddleware, roleMiddleware("admin"), registrationController.getArchivedStats);

export default router;

