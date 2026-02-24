import jwt from "jsonwebtoken";
import config from "../backend/config/config.js";

export function extractBearerToken(authHeader) {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length < 2) {
    return null;
  }

  return parts[1];
}

export function decodeJwtToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export function buildUserFromToken(decoded) {
  const resolvedId = decoded.userId || decoded._id || decoded.id || null;

  return {
    _id: resolvedId,
    userId: resolvedId,
    email: decoded.email,
    role: decoded.role,
    username: decoded.username,
    organizationId: decoded.organizationId || null,
    leaderId: decoded.leaderId
  };
}
