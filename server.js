import app from "./src/app.js";
import { config } from "./src/config/env.js";
import { connectDB } from "./src/config/db.js";
import { initMemoryAuth } from "./src/utils/authFallback.js";
import logger from "./src/config/logger.js";

const PORT = config.port;

async function start() {
  // Validar JWT_SECRET en producción
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      logger.error("CRÍTICO: JWT_SECRET no está configurado en producción");
      process.exit(1);
    }
    if (process.env.JWT_SECRET.length < 32) {
      logger.error("CRÍTICO: JWT_SECRET es demasiado corto (mínimo 32 caracteres)");
      process.exit(1);
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

