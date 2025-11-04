import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

// ----------------------------------------------------
// CONFIGURACIÓN INICIAL
// ----------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ----------------------------------------------------
// CONEXIÓN A MONGODB ATLAS
// ----------------------------------------------------
const mongoURL = process.env.MONGO_URL; // se toma de Render (variable de entorno)

mongoose.connect(mongoURL)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => console.error("❌ Error al conectar a MongoDB:", err));

// ----------------------------------------------------
// ESQUEMAS Y MODELOS DE DATOS
// ----------------------------------------------------
const LeaderSchema = new mongoose.Schema({
  name: String,
  token: String,
  registrations: { type: Number, default: 0 }
});

const RegistrationSchema = new mongoose.Schema({
  leaderId: String,
  name: String,
  date: String
});

const Leader = mongoose.model("Leader", LeaderSchema);
const Registration = mongoose.model("Registration", RegistrationSchema);

// ----------------------------------------------------
// MIDDLEWARES
// ----------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // sirve app.html directamente

// ----------------------------------------------------
// RUTAS
// ----------------------------------------------------

// 🔹 Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "app.html"));
});

// 🔹 Obtener líderes
app.get("/api/leaders", async (req, res) => {
  const leaders = await Leader.find();
  res.json(leaders);
});

// 🔹 Agregar o editar líder
app.post("/api/leaders", async (req, res) => {
  const leader = req.body;

  if (leader._id) {
    const updated = await Leader.findByIdAndUpdate(leader._id, leader, { new: true });
    return res.json(updated);
  } else {
    leader.token = "leader" + Date.now();
    const newLeader = await Leader.create(leader);
    return res.json(newLeader);
  }
});

// 🔹 Eliminar líder
app.delete("/api/leaders/:id", async (req, res) => {
  await Leader.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// 🔹 Obtener registros
app.get("/api/registrations", async (req, res) => {
  const regs = await Registration.find();
  res.json(regs);
});

// 🔹 Nuevo registro
app.post("/api/registrations", async (req, res) => {
  const reg = req.body;
  reg.date = new Date().toISOString().split("T")[0];
  const newReg = await Registration.create(reg);

  // Sumar al líder
  await Leader.findByIdAndUpdate(reg.leaderId, { $inc: { registrations: 1 } });

  res.json(newReg);
});

// 🔹 Login simple
const USERS = [
  { username: "admin", password: "12345", role: "admin" },
  { username: "lider1", password: "lider123", role: "leader" }
];

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (user) {
    res.json({ success: true, user: { username: user.username, role: user.role } });
  } else {
    res.status(401).json({ success: false, message: "Credenciales inválidas" });
  }
});

// ----------------------------------------------------
// INICIO DEL SERVIDOR
// ----------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});

