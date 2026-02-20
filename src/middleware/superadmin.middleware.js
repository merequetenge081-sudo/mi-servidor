import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import logger from "../config/logger.js";

/**
 * Middleware de control de acceso ultra-restrictivo para /internal/control-center
 * Requiere:
 * 1. Token JWT válido con role === 'superadmin'
 * 2. Header x-dev-key coincidiendo con DEV_SECRET_KEY
 * 3. IP dentro de whitelist DEV_ALLOWED_IPS
 * 
 * Si ALGUNA validación falla, retorna 404 (no 403) y loggea como intento de intrusión
 */
export function superadminSecretMiddleware(req, res, next) {
  try {
    // 1. Validar JWT y role === 'superadmin'
    const token = req.headers.authorization?.split(" ")[1];
    
    if (!token) {
      logIntrusion(req, "Missing JWT token");
      return res.status(404).json({ error: "Not found" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      logIntrusion(req, "Invalid JWT token");
      return res.status(404).json({ error: "Not found" });
    }

    // Validar que el rol sea exactamente 'superadmin'
    if (!decoded.role || (decoded.role !== "superadmin" && decoded.role !== "super_admin")) {
      logIntrusion(req, `Unauthorized role: ${decoded.role}`, decoded.userId);
      return res.status(404).json({ error: "Not found" });
    }

    // 2. Validar header x-dev-key
    const devKey = req.headers["x-dev-key"];
    const expectedKey = process.env.DEV_SECRET_KEY;

    if (!expectedKey) {
      logger.warn("DEV_SECRET_KEY not configured - control center is unreachable");
      return res.status(404).json({ error: "Not found" });
    }

    if (!devKey || devKey !== expectedKey) {
      logIntrusion(req, "Invalid or missing x-dev-key header", decoded.userId);
      return res.status(404).json({ error: "Not found" });
    }

    // 3. Validar IP en whitelist
    const clientIP = req.ip || req.connection.remoteAddress || "UNKNOWN";
    const allowedIPs = process.env.DEV_ALLOWED_IPS
      ? process.env.DEV_ALLOWED_IPS.split(",").map(ip => ip.trim())
      : ["127.0.0.1", "::1"]; // Default: localhost only

    const isIPAllowed = allowedIPs.includes(clientIP) || allowedIPs.includes("*");

    if (!isIPAllowed) {
      logIntrusion(req, `IP not in whitelist: ${clientIP}`, decoded.userId);
      return res.status(404).json({ error: "Not found" });
    }

    // Todas las validaciones pasaron
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      organizationId: decoded.organizationId || null,
    };
    req.clientIP = clientIP;

    logger.info(`✓ Superadmin control center accessed`, {
      userId: decoded.userId,
      email: decoded.email,
      ip: clientIP,
    });

    next();
  } catch (error) {
    logger.error("Unexpected error in superadminSecretMiddleware", { error: error.message });
    return res.status(404).json({ error: "Not found" });
  }
}

/**
 * Loggea un intento de acceso no autorizado a la ruta secreta
 */
function logIntrusion(req, reason, userId = "UNKNOWN") {
  const clientIP = req.ip || req.connection.remoteAddress || "UNKNOWN";
  const userAgent = req.headers["user-agent"] || "UNKNOWN";

  logger.warn("🚨 POSIBLE INTENTO DE INTRUSIÓN EN CONTROL CENTER", {
    timestamp: new Date().toISOString(),
    reason,
    userId,
    clientIP,
    userAgent,
    method: req.method,
    path: req.path,
    headers: {
      "x-dev-key": req.headers["x-dev-key"] ? "***" : "MISSING",
      authorization: req.headers.authorization ? "***" : "MISSING",
      "user-agent": userAgent,
    },
  });
}
