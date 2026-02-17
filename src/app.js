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
          "https://cdn.tailwindcss.com"
        ],
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
  })
);

// Compression - Comprimir respuestas
app.use(compression());

// XSS Protection
app.use(xss());

// HPP - Prevenir HTTP Parameter Pollution
app.use(hpp());

// Rate Limiting - 200 requests por 15 minutos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: "Demasiadas solicitudes desde esta IP, intente más tarde.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // No limitar health check
    return req.path === "/health";
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
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// ==================== RUTAS HTML (ANTES QUE MIDDLEWARE) ====================
// Estas rutas NO necesitan authentication ni organization validation
// Ruta raíz - Login
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "../public/login.html"));
});

// Ruta dashboard de admin
app.get("/app", (req, res) => {
  res.sendFile(join(__dirname, "../public/app.html"));
});

// Ruta panel del líder
app.get("/leader", (req, res) => {
  res.sendFile(join(__dirname, "../public/leader.html"));
});

// Ruta formulario público de registro
app.get("/form", (req, res) => {
  res.sendFile(join(__dirname, "../public/form.html"));
});

// Ruta formulario público con token del líder
app.get("/registration/:token", (req, res) => {
  res.sendFile(join(__dirname, "../public/form.html"));
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

