import mongoose from "mongoose";

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

export async function connectDB() {
  try {
    await Promise.race([
      mongoose.connect(MONGO_URL, {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 5000
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Connection timeout")), 5000))
    ]);
    console.log("✓ Conectado a MongoDB");
    return true;
  } catch (error) {
    console.error("✗ Error conectando a MongoDB:", error.message);
    console.warn("⚠️ Continuando sin base de datos (algunos endpoints pueden no funcionar)");
    return false;
  }
}

export function disconnectDB() {
  return mongoose.disconnect();
}

