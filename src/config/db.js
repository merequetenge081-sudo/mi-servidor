import mongoose from "mongoose";
import dns from "dns";
import logger from "./logger.js";
import {
  currentEnv,
  isProduction,
  isStaging,
  isDevelopment,
} from "../backend/config/environment.js";

// Fix: Node.js 18+ defaults to IPv6, causing Atlas SRV lookup failures
dns.setDefaultResultOrder("ipv4first");

const MONGO_TIMEOUT = parseInt(process.env.MONGO_TIMEOUT || "30000", 10);

function resolveDbName() {
  if (isProduction) return "seguimiento-datos-prod";
  if (isStaging) return "seguimiento-datos-staging";
  if (isDevelopment) return "seguimiento-datos-dev";
  return "seguimiento-datos-dev";
}

function validateMongoTarget(dbName) {
  const nameLower = dbName.toLowerCase();

  if (isProduction && (nameLower.includes("dev") || nameLower.includes("staging"))) {
    logger.error("[BOOT] Invalid Mongo target for production");
    process.exit(1);
  }

  if (isStaging && nameLower.includes("prod")) {
    logger.error("[BOOT] Invalid Mongo target for staging");
    process.exit(1);
  }
}

export const mongoDbName = resolveDbName();
const MONGO_URL = `mongodb://localhost:27017/${mongoDbName}`;

/**
 * Connect to MongoDB with fail-fast strategy
 * Process exits immediately if connection fails (no soft-fail)
 */
export async function connectDB() {
  try {
    logger.info(`[BOOT] Environment: ${currentEnv}`);
    logger.info(`[BOOT] Mongo DB: ${mongoDbName}`);
    validateMongoTarget(mongoDbName);

    logger.info("Iniciando conexión a MongoDB...");
    
    await Promise.race([
      mongoose.connect(MONGO_URL, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("MongoDB connection timeout")), MONGO_TIMEOUT)
      )
    ]);
    
    logger.info("✓ Conectado exitosamente a MongoDB");
    return true;
  } catch (error) {
    logger.error("✗ Error CRÍTICO conectando a MongoDB", {
      error: error.message,
      url: MONGO_URL ? "[REDACTED]" : "undefined",
      timeout: MONGO_TIMEOUT,
      stack: error.stack
    });
    logger.error("Proceso terminando - Base de datos es crítica para operación");
    process.exit(1); // FAIL-FAST: Exit process immediately
  }
}

export function disconnectDB() {
  return mongoose.disconnect();
}



