import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import apiRoutes from "./routes/index.js";
import v2Routes from "./routes/v2.routes.js";
import { organizationMiddleware } from "./middleware/organization.middleware.js";
import { applySecurityMiddleware } from "./middleware/security.middleware.js";
import { corsMiddleware } from "./middleware/cors.middleware.js";
import { requestIdMiddleware, requestLoggingMiddleware } from "./middleware/request.middleware.js";

import { errorMiddleware, notFoundMiddleware } from "./backend/middlewares/error.middleware.js";
import webRoutes from "./routes/web.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentEnv = process.env.NODE_ENV || "development";

const app = express();

// ==================== SEGURIDAD ====================
applySecurityMiddleware(app);

// ==================== MIDDLEWARE ====================
app.use(requestIdMiddleware);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(join(__dirname, "../public")));

app.use(requestLoggingMiddleware);

// ==================== CORS ====================
app.use(corsMiddleware);

// ==================== RUTAS HTML (ANTES QUE MIDDLEWARE) ====================
// Estas rutas NO necesitan authentication ni organization validation
app.use("/", webRoutes);

// ==================== ORGANIZATION MIDDLEWARE ====================
// Multi-tenant context (extracts and validates org from JWT)
// Apply AFTER HTML routes so they don't try to access req.user
app.use(organizationMiddleware);

app.use("/api/v2", v2Routes);

// ==================== RUTAS API ====================
const legacyApiDisabled = process.env.DISABLE_LEGACY_API === "true";
if (legacyApiDisabled) {
  app.use("/api", (req, res) => {
    res.status(410).json({
      error: "Legacy API deshabilitada",
      message: "Usa los endpoints en /api/v2"
    });
  });
} else {
  app.use("/api", apiRoutes);
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    environment: currentEnv,
    dbName: mongoose.connection.name,
    dbStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: process.uptime(),
  });
});

// ==================== ERROR HANDLING ====================
// 404 handler (platform default)
app.use(notFoundMiddleware);

// Global error handler (handles both enterprise and legacy errors)
app.use(errorMiddleware);

export default app;

