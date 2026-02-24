import { buildUserFromToken, decodeJwtToken, extractBearerToken } from "../utils/jwt.js";

export function authMiddleware(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = decodeJwtToken(token);
    req.user = buildUserFromToken(decoded);
    req.organizationId = req.user.organizationId || null;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export const verifyToken = authMiddleware;
