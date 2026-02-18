import mongoose from "mongoose";
import dns from "dns";
import logger from "./logger.js";

// Fix: Node.js 18+ defaults to IPv6, causing Atlas SRV lookup failures
dns.setDefaultResultOrder("ipv4first");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

export async function connectDB() {
  try {
    await Promise.race([
      mongoose.connect(MONGO_URL, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 10000))
    ]);
    logger.info("✓ Conectado a MongoDB");
    return true;
  } catch (error) {
    logger.error("✗ Error conectando a MongoDB:", { error: error.message, stack: error.stack });
    logger.warn("⚠️ Continuando sin base de datos (algunos endpoints pueden no funcionar)");
    return false;
  }
}

export function disconnectDB() {
  return mongoose.disconnect();
}

