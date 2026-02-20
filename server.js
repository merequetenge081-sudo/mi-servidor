import "dotenv/config";
import app from "./src/app.js";
import { config } from "./src/config/env.js";
import { connectDB } from "./src/config/db.js";
import { initMemoryAuth } from "./src/utils/authFallback.js";
import logger from "./src/config/logger.js";

const PORT = config.port;

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

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`✓ Servidor corriendo en puerto ${PORT} (${process.env.NODE_ENV || "development"})`);
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

