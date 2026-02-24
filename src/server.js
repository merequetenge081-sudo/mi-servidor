import "dotenv/config";
import http from "http";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initMemoryAuth } from "./utils/authFallback.js";
import logger from "./config/logger.js";
import { startTempPasswordCleanup } from "./services/tempPasswordCleanup.service.js";

async function startServer() {
  try {
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

    // Conectar a MongoDB antes del listen
    await connectDB();

    startTempPasswordCleanup();

    const PORT = process.env.PORT || 3000;
    const server = http.createServer(app);

    server.listen(PORT, "0.0.0.0", () => {
      console.log("===================================");
      console.log("🚀 SERVER STARTED");
      console.log("ENV:", process.env.NODE_ENV);
      console.log("PORT:", PORT);
      console.log("CWD:", process.cwd());
      console.log("===================================");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

process.on("unhandledRejection", (reason, promise) => {
  logger.error("✗ Unhandled Rejection at:", { reason, promise });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("✗ Uncaught Exception:", { message: error.message, stack: error.stack });
  process.exit(1);
});
