import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'super_admin', // Default to super_admin for BC
      organizationId: decoded.organizationId || null // Multi-tenant org context
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
}
