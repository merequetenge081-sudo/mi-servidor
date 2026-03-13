import mongoose from "mongoose";
import dns from "dns";
import logger from "./logger.js";

// Fix: Node.js 18+ defaults to IPv6, causing Atlas SRV lookup failures
dns.setDefaultResultOrder("ipv4first");

const MONGO_TIMEOUT = parseInt(process.env.MONGO_TIMEOUT || "30000", 10);
const MONGO_LOCAL_URL = process.env.MONGO_LOCAL_URL || "mongodb://127.0.0.1:27017/seguimiento-datos";
const ALLOW_DB_FALLBACK = process.env.ALLOW_DB_FALLBACK !== "false";
const ALLOW_DB_OPTIONAL = process.env.ALLOW_DB_OPTIONAL === "true";

// BD principal: MongoDB Atlas
const MONGO_ATLAS_URL = "mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos";

export const mongoDbName = "seguimiento-datos";

/**
 * Try Atlas first, then optional local fallback.
 * Returns true when DB is connected, false only when optional no-DB mode is enabled.
 */
export async function connectDB() {
  try {
    logger.info("[BOOT] Conectando a MongoDB Atlas: seguimiento-datos");

    await mongoose.connect(MONGO_ATLAS_URL, {
      serverSelectionTimeoutMS: MONGO_TIMEOUT
    });

    logger.info("[BOOT] Conectado exitosamente a MongoDB Atlas");
    return true;
  } catch (error) {
    logger.error("[BOOT] Error conectando a MongoDB Atlas", {
      error: error.message,
      stack: error.stack
    });

    if (ALLOW_DB_FALLBACK) {
      try {
        logger.warn(`[BOOT] Intentando fallback a Mongo local: ${MONGO_LOCAL_URL}`);
        await mongoose.connect(MONGO_LOCAL_URL, {
          serverSelectionTimeoutMS: Math.min(MONGO_TIMEOUT, 8000)
        });
        logger.info("[BOOT] Conectado exitosamente a Mongo local (fallback)");
        return true;
      } catch (localError) {
        logger.error("[BOOT] Error conectando a Mongo local (fallback)", {
          error: localError.message
        });
      }
    }

    if (ALLOW_DB_OPTIONAL && process.env.NODE_ENV !== "production") {
      logger.warn("[BOOT] Continuando sin DB por ALLOW_DB_OPTIONAL=true (solo desarrollo)");
      return false;
    }

    logger.error("[BOOT] Proceso terminando: no se pudo conectar a ninguna base de datos");
    process.exit(1);
  }
}

export function disconnectDB() {
  return mongoose.disconnect();
}
