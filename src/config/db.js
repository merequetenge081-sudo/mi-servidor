import mongoose from "mongoose";
import dns from "dns";
import logger from "./logger.js";

// Fix: Node.js 18+ defaults to IPv6, causing Atlas SRV lookup failures
dns.setDefaultResultOrder("ipv4first");

const MONGO_TIMEOUT = parseInt(process.env.MONGO_TIMEOUT || "30000", 10);

// BD única: MongoDB Atlas
const MONGO_ATLAS_URL = 'mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos';

export const mongoDbName = "seguimiento-datos";

/**
 * Connect to MongoDB Atlas (única BD)
 * Process exits immediately if connection fails (no soft-fail)
 */
export async function connectDB() {
  try {
    logger.info(`[BOOT] Conectando a MongoDB Atlas: seguimiento-datos`);

    await mongoose.connect(MONGO_ATLAS_URL, {
      serverSelectionTimeoutMS: MONGO_TIMEOUT
    });
    
    logger.info("✓ Conectado exitosamente a MongoDB Atlas");
    return true;
  } catch (error) {
    logger.error("✗ Error CRÍTICO conectando a MongoDB Atlas", {
      error: error.message,
      stack: error.stack
    });
    logger.error("Proceso terminando - Base de datos es crítica para operación");
    process.exit(1); // FAIL-FAST: Exit process immediately
  }
}

export function disconnectDB() {
  return mongoose.disconnect();
}



