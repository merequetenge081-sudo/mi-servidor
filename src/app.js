import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import xss from "xss-clean";
import hpp from "hpp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import mongoose from "mongoose";
import logger from "./config/logger.js";
import apiRoutes from "./routes/index.js";
import { organizationMiddleware } from "./middleware/organization.middleware.js";
import { initMemoryAuth } from "./utils/authFallback.js";
import { currentEnv } from "./backend/config/environment.js";

// ==================== ENTERPRISE MODULES ====================
import leaderRoutes from "./backend/modules/leaders/leader.routes.js";
import registrationRoutes from "./backend/modules/registrations/registration.routes.js";
import eventRoutes from "./backend/modules/events/event.routes.js";
import puestoRoutes from "./backend/modules/puestos/puesto.routes.js";
import authRoutes from "./backend/modules/auth/auth.routes.js";
import analyticsRoutes from "./backend/modules/analytics/analytics.routes.js";
import exportsRoutes from "./backend/modules/exports/exports.routes.js";
import duplicatesRoutes from "./backend/modules/duplicates/duplicates.routes.js";
import auditRoutes from "./backend/modules/audit/audit.routes.js";
import organizationRoutes from "./backend/modules/organization/organization.routes.js";
import whatsappRoutes from "./backend/modules/whatsapp/whatsapp.routes.js";
import adminRoutes from "./backend/modules/admin/admin.routes.js";
import { errorMiddleware, notFoundMiddleware } from "./backend/middlewares/error.middleware.js";
import { authMiddleware } from "./backend/middlewares/auth.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// ==================== INICIALIZAR AUTENTICACIÓN EN MEMORIA ====================
// Debe ejecutarse antes de que se procese cualquier request de login
await initMemoryAuth();

// ==================== SEGURIDAD ====================
// Helmet - Asegurar headers HTTP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://cdn.tailwindcss.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://cdn.tailwindcss.com",
          "https://fonts.googleapis.com"
        ],
        imgSrc: ["'self'", "data:"],
        connectSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "https://cdn.tailwindcss.com"
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com",
          "data:"
        ],
      },
    },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    crossOriginEmbedderPolicy: false,
  })
);

// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && req.protocol !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Compression - Comprimir respuestas
app.use(compression());

// XSS Protection
app.use(xss());

// HPP - Prevenir HTTP Parameter Pollution
app.use(hpp());

// Rate Limiting - Only for API routes (static files & pages are exempt)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300,
  message: { error: "Demasiadas solicitudes desde esta IP, intente más tarde." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only rate-limit API calls, not static files/pages
    return !req.path.startsWith("/api");
  }
});
app.use(limiter);

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(express.static(join(__dirname, "../public")));

// Request logging
app.use((req, res, next) => {
  logger.info(
    `[${currentEnv.toUpperCase()}] ${req.method} ${req.originalUrl}`,
    { ip: req.ip }
  );

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// ==================== CORS ====================
const getAllowedOrigins = () => {
  if (process.env.NODE_ENV !== 'production') {
    return '*';
  }
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  }
  return process.env.BASE_URL || process.env.FRONTEND_URL || '*';
};

app.use((req, res, next) => {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;

  if (allowedOrigins === '*') {
    res.header("Access-Control-Allow-Origin", "*");
  } else if (Array.isArray(allowedOrigins)) {
    if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  } else {
    res.header("Access-Control-Allow-Origin", allowedOrigins);
  }

  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ==================== RUTAS HTML (ANTES QUE MIDDLEWARE) ====================
// Estas rutas NO necesitan authentication ni organization validation
// Ruta raíz - Login Profesional
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

// Ruta login antiguo (por compatibilidad)
app.get("/login", (req, res) => {
  res.sendFile(join(__dirname, "../public/index.html"));
});

// Dashboard Admin
app.get("/dashboard.html", (req, res) => {
  res.sendFile(join(__dirname, "../public/dashboard.html"));
});

// Formulario público de registro
app.get("/form", (req, res) => {
  res.sendFile(join(__dirname, "../public/form.html"));
});

// Formulario con token del líder
app.get("/registration/:token", (req, res) => {
  res.sendFile(join(__dirname, "../public/form.html"));
});

// Ruta app antiguo (por compatibilidad)
app.get("/app", (req, res) => {
  res.redirect("/dashboard.html");
});

// Ruta leader antiguo (por compatibilidad)
app.get("/leader", (req, res) => {
  res.sendFile(join(__dirname, "../public/leader.html"));
});

// ==================== ORGANIZATION MIDDLEWARE ====================
// Multi-tenant context (extracts and validates org from JWT)
// Apply AFTER HTML routes so they don't try to access req.user
app.use(organizationMiddleware);

// ==================== ENTERPRISE ROUTES (NEW ARCHITECTURE) ====================
// New modular routes with Controller → Service → Repository pattern
// Using /api/v2 namespace during gradual migration
// TODO: Migrate existing /api routes to /api/v2 gradually

// Auth enterprise module (new architecture)
// Public endpoints: admin-login, leader-login, request-password-reset, reset-password
// Protected endpoints: change-password, verify-token, logout
app.use("/api/v2/auth", authRoutes);

// Leaders enterprise module (new architecture)
app.use("/api/v2/leaders", leaderRoutes);

// Registrations enterprise module (new architecture)
// Note: Also accepts public calls via leaderToken
app.use("/api/v2/registrations", registrationRoutes);

// Events enterprise module (new architecture)
app.use("/api/v2/events", eventRoutes);

// Puestos (Polling Places) enterprise module (new architecture)
app.use("/api/v2/puestos", puestoRoutes);

// Analytics enterprise module (new architecture)
// Stats, dashboard, trends, and reporting endpoints
app.use("/api/v2/analytics", analyticsRoutes);

// Exports enterprise module (new architecture)
// CSV/Excel exports, QR generation, PDF reports
app.use("/api/v2/exports", exportsRoutes);

// Duplicates enterprise module (new architecture)
// Duplicate detection and analysis endpoints
app.use("/api/v2/duplicates", duplicatesRoutes);

// Audit enterprise module (new architecture)
// Audit logs, statistics, and reporting endpoints
app.use("/api/v2/audit", auditRoutes);

// Organization enterprise module (new architecture)
// Organization CRUD and resource limits management
app.use("/api/v2/organizations", organizationRoutes);

// WhatsApp enterprise module (new architecture)
// WhatsApp messaging and QR code distribution (stub implementation, requires real API integration)
app.use("/api/v2/whatsapp", whatsappRoutes);

// Admin enterprise module (new architecture)
// Admin functions: puestos import, statistics, monitoring
app.use("/api/v2/admin", adminRoutes);

// ==================== RUTAS API ====================
app.use("/api", apiRoutes);

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

// ==================== UNHANDLED EXCEPTIONS ====================
process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}`, { reason });
  // En producción, podría notificar a un servicio de monitoreo
});

process.on("uncaughtException", (error) => {
  logger.error(`Uncaught Exception: ${error.message}`, { stack: error.stack });
  // Cerrar el servidor gracefully
  process.exit(1);
});

export default app;

