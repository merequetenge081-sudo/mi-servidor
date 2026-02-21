import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import xss from "xss-clean";
import hpp from "hpp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import logger from "./config/logger.js";
import apiRoutes from "./routes/index.js";
import { organizationMiddleware } from "./middleware/organization.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

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
          "https://cdn.tailwindcss.com"
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
          "data:"
        ],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
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

// ==================== RUTAS API ====================
app.use("/api", apiRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ==================== ERROR HANDLING ====================
// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  const status = err.status || 500;
  const message = process.env.NODE_ENV === "production"
    ? "Internal server error"
    : err.message;

  res.status(status).json({ error: message });
});

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

