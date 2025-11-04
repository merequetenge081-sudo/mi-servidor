import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const mongoURL = process.env.MONGO_URL;
mongoose.connect(mongoURL)
  .then(() => console.log("✅ Conectado a MongoDB Atlas"))
  .catch(err => console.error("❌ Error al conectar a MongoDB:", err));

// 🔹 Esquemas y modelos
const LeaderSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  area: String,
  active: Boolean,
  token: String,
  registrations: { type: Number, default: 0 }
});
const RegistrationSchema = new mongoose.Schema({
  leaderId: String,
  leaderName: String,
  firstName: String,
  lastName: String,
  cedula: String,
  email: String,
  phone: String,
  date: String
});
const Leader = mongoose.model("Leader", LeaderSchema);
const Registration = mongoose.model("Registration", RegistrationSchema);

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// 🔹 Ruta principal
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "app.html")));

// 🔹 Obtener líderes
app.get("/api/leaders", async (req, res) => {
  const leaders = await Leader.find();
  res.json(leaders);
});

// 🔹 Crear líder
app.post("/api/leaders", async (req, res) => {
  const leader = req.body;
  leader.token = leader.token || "leader" + Date.now();
  const newLeader = await Leader.create(leader);
  res.json(newLeader);
});

// 🔹 Editar líder
app.put("/api/leaders/:id", async (req, res) => {
  const updated = await Leader.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(updated);
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

  // Agregar nombre del líder si existe
  const leader = await Leader.findById(reg.leaderId);
  if (leader) {
    reg.leaderName = leader.name;
    leader.registrations++;
    await leader.save();
  }

  const newReg = await Registration.create(reg);
  res.json(newReg);
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
