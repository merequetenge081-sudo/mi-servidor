import "dotenv/config";
import http from "http";
import app from "./app.js";
import { config } from "./config/env.js";
import { connectDB, mongoDbName } from "./config/db.js";
import { initMemoryAuth } from "./utils/authFallback.js";
import logger from "./config/logger.js";
import { currentEnv } from "./backend/config/environment.js";

// Validación de PORT antes de inicializar
if (process.env.NODE_ENV === "production" && !process.env.PORT) {
  console.error("CRITICO: PORT no definido en produccion. Render debe inyectar la variable PORT.");
  process.exit(1);
}

const PORT = config.port;

// Logs de diagnóstico
console.log("=== Diagnostico de inicio ===");
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`process.env.PORT: ${process.env.PORT || "(no definido, usando fallback)"}`);
console.log(`PUERTO FINAL: ${PORT}`);
console.log(`CWD: ${process.cwd()}`);
console.log("Variables validadas correctamente\n");

async function start() {
  // Validar secrets en producción
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      logger.error("CRÍTICO: JWT_SECRET no está configurado en producción");
      process.exit(1);
    }
    if (process.env.JWT_SECRET.length < 32) {
      logger.error("CRÍTICO: JWT_SECRET es demasiado corto (mínimo 32 caracteres)");
      process.exit(1);
    }
    if (!process.env.ENCRYPTION_KEY) {
      logger.error("CRÍTICO: ENCRYPTION_KEY no está configurado en producción");
      process.exit(1);
    }
    if (process.env.ENCRYPTION_KEY.length < 16) {
      logger.error("CRÍTICO: ENCRYPTION_KEY es demasiado corto (mínimo 16 caracteres)");
      process.exit(1);
    }
  } else {
    if (!process.env.JWT_SECRET) {
      logger.warn("⚠️ Usando JWT_SECRET por defecto (solo para desarrollo)");
    }
    if (!process.env.ENCRYPTION_KEY) {
      logger.warn("⚠️ Usando ENCRYPTION_KEY por defecto (solo para desarrollo)");
    }
  }

  // Inicializar autenticación en memoria (fallback para desarrollo)
  await initMemoryAuth();

  // Conectar a MongoDB (pero continuar si falla)
  await connectDB();

  // Crear servidor HTTP explícito
  const server = http.createServer(app);

  server.listen(PORT, "0.0.0.0", () => {
    const banner = [
      "============================================",
      "SERVER STARTED SUCCESSFULLY",
      `Environment: ${currentEnv}`,
      `Mongo DB: ${mongoDbName}`,
      `Port: ${PORT}`,
      `Listening on: 0.0.0.0:${PORT}`,
      "============================================"
    ].join("\n");
    
    logger.info(banner);
    logger.info(`Server escuchando en 0.0.0.0:${PORT} (${currentEnv})`);
    
    if (process.env.NODE_ENV === "production") {
      logger.info("Sistema detectado como PRODUCCION - listo para Render");
    }
  });
}

start();

process.on("unhandledRejection", (reason, promise) => {
  logger.error("✗ Unhandled Rejection at:", { reason, promise });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("✗ Uncaught Exception:", { message: error.message, stack: error.stack });
  process.exit(1);
});
