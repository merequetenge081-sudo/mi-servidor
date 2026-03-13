import bcryptjs from "bcryptjs";
import { encrypt } from "../utils/crypto.js";

export function handleInvalidCredentials(req, res) {
  if (req.loginRateLimit) req.loginRateLimit.recordFailedAttempt();
  const attemptsRemaining = req.loginRateLimit ? req.loginRateLimit.getAttemptsRemaining() : 5;
  return res.status(401).json({
    error: "Credenciales inválidas",
    attemptsRemaining
  });
}

export function resetLoginAttempts(req) {
  if (req.loginRateLimit) req.loginRateLimit.resetAttempts();
}

export function resolveBaseUrl(req) {
  return process.env.BASE_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
}

export async function hashPassword(plainTextPassword) {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(plainTextPassword, salt);
}

export function buildTemporaryPasswordState(tempPassword, passwordHash, options = {}) {
  const {
    passwordResetRequested = false,
    passwordCanBeChanged = true
  } = options;

  return {
    passwordHash,
    isTemporaryPassword: true,
    passwordResetRequested,
    passwordCanBeChanged,
    tempPasswordPlaintext: encrypt(tempPassword),
    tempPasswordCreatedAt: new Date()
  };
}

