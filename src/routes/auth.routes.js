import express from "express";
import {
  adminLogin,
  leaderLogin,
  leaderLoginById,
  changePassword,
  adminResetPassword,
  requestPasswordReset,
  adminGenerateNewPassword,
  leaderChangePassword,
  logout,
  acceptLegalTerms,
  checkLegalTermsStatus
} from "../controllers/auth.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { roleMiddleware } from "../middleware/role.middleware.js";
import { loginRateLimitMiddleware } from "../middleware/rateLimit.middleware.js";

const router = express.Router();

router.post("/admin-login", loginRateLimitMiddleware, adminLogin);
router.post("/leader-login", loginRateLimitMiddleware, leaderLogin);
router.post("/leader-login-id", loginRateLimitMiddleware, leaderLoginById);
router.post("/logout", authMiddleware, logout);
router.post("/change-password", authMiddleware, changePassword);
router.post("/admin-reset-password", authMiddleware, roleMiddleware("admin"), adminResetPassword);
router.post("/request-password-reset", requestPasswordReset);
router.post("/admin-generate-password", authMiddleware, roleMiddleware("admin"), adminGenerateNewPassword);
router.post("/leader-change-password", authMiddleware, leaderChangePassword);
router.post("/accept-legal-terms", authMiddleware, acceptLegalTerms);
router.get("/legal-terms-status", authMiddleware, checkLegalTermsStatus);

export default router;

