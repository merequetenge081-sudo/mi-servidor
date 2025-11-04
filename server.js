import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data.json");

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // sirve app.html directamente

// Leer datos
function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    return { leaders: [], registrations: [] };
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

// Guardar datos
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Obtener líderes
app.get("/api/leaders", (req, res) => {
  const data = readData();
  res.json(data.leaders);
});

// Agregar o editar líder
app.post("/api/leaders", (req, res) => {
  const data = readData();
  const leader = req.body;

  if (leader.id) {
    // Editar
    const index = data.leaders.findIndex(l => l.id === leader.id);
    if (index !== -1) data.leaders[index] = leader;
  } else {
    // Crear nuevo
    leader.id = Date.now();
    leader.token = "leader" + leader.id;
    leader.registrations = 0;
    data.leaders.push(leader);
  }

  writeData(data);
  res.json(leader);
});

// Eliminar líder
app.delete("/api/leaders/:id", (req, res) => {
  const data = readData();
  const id = parseInt(req.params.id);
  data.leaders = data.leaders.filter(l => l.id !== id);
  writeData(data);
  res.json({ success: true });
});

// Obtener registros
app.get("/api/registrations", (req, res) => {
  const data = readData();
  res.json(data.registrations);
});

// Nuevo registro
app.post("/api/registrations", (req, res) => {
  const data = readData();
  const reg = req.body;
  reg.id = Date.now();
  reg.date = new Date().toISOString().split("T")[0];
  data.registrations.push(reg);

  // sumar al líder
  const leader = data.leaders.find(l => l.id === reg.leaderId);
  if (leader) leader.registrations++;

  writeData(data);
  res.json(reg);
});
// Ruta principal para abrir la aplicación
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "app.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
