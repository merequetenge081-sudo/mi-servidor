import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Configuración básica
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 10000;

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔹 RUTAS BÁSICAS PRIMERO (para testear)
app.get("/", (req, res) => {
  res.json({ 
    status: "✅ Servidor funcionando", 
    message: "API lista para usar",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    database: "Sin verificar",
    timestamp: new Date().toISOString()
  });
});

// 🔹 CONEXIÓN A MONGODB (con mejor manejo de errores)
const connectDB = async () => {
  try {
    if (!process.env.MONGO_URL) {
      console.log("⚠️  MONGO_URL no configurada, pero el servidor funcionará sin DB");
      return;
    }
    
    await mongoose.connect(process.env.MONGO_URL);
    console.log("✅ Conectado a MongoDB");
  } catch (error) {
    console.log("⚠️  No se pudo conectar a MongoDB, pero el servidor continuará:", error.message);
  }
};

connectDB();

// 🔹 RUTAS DE API (con protección contra errores)
app.get("/api/test", (req, res) => {
  try {
    res.json({ message: "✅ API funcionando", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: "Error en API test" });
  }
});

// 🔹 MANEJADOR DE ERRORES GLOBAL
app.use((error, req, res, next) => {
  console.error("💥 Error capturado:", error);
  res.status(500).json({ 
    error: "Error interno del servidor",
    message: error.message 
  });
});

// 🔹 RUTA NO ENCONTRADA
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// 🔹 INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
  console.log(`🌐 URL: http://0.0.0.0:${PORT}`);
  console.log(`📊 Estado: ✅ LIVE`);
});

// 🔹 Manejar cierre graceful
process.on('SIGTERM', () => {
  console.log('🔄 Apagando servidor...');
  process.exit(0);
});