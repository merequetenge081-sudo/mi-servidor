import crypto from "crypto";
import logger from "../config/logger.js";
import { currentEnv } from "../backend/config/environment.js";

export function requestIdMiddleware(req, res, next) {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  return next();
}

export function requestLoggingMiddleware(req, res, next) {
  logger.info("http_request", {
    requestId: req.requestId,
    env: currentEnv,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    logger.info("http_response", {
      requestId: req.requestId,
      env: currentEnv,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      userId: req.user?._id || req.user?.userId || null,
      userRole: req.user?.role || null
    });
  });

  return next();
}

