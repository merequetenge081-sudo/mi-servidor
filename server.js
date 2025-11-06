import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";

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
  try {
    const reg = req.body;
    reg.date = new Date().toISOString();

    const leader = await Leader.findById(reg.leaderId);
    if (leader) {
      reg.leaderName = leader.name;
      leader.registrations++;
      await leader.save();
    }

    const newReg = await Registration.create(reg);
    res.json(newReg);
  } catch (err) {
    console.error("Error al crear registro:", err);
    res.status(500).json({ error: "Error al crear registro" });
  }
});

// 🔹 Editar registro
app.put("/api/registrations/:id", async (req, res) => {
  try {
    const updated = await Registration.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Registro no encontrado" });
    res.json(updated);
  } catch (err) {
    console.error("Error al editar registro:", err);
    res.status(500).json({ error: "Error al editar registro" });
  }
});

// 🔹 Eliminar registro
app.delete("/api/registrations/:id", async (req, res) => {
  try {
    const deleted = await Registration.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Registro no encontrado" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error al eliminar registro:", err);
    res.status(500).json({ error: "Error al eliminar registro" });
  }
});

// Ruta pública de registro por token
app.get("/registro/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "form.html"));
});

// Exportar a Excel (genérico: /api/export/leaders o /api/export/registrations)
app.get("/api/export/:type", async (req, res) => {
  const { type } = req.params;
  try {
    const dataFile = path.join(process.cwd(), "data.json");
    let data = { leaders: [], registrations: [] };
    if (fs.existsSync(dataFile)) {
      data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    } else {
      // if no data.json, fallback to DB
      const leadersFromDb = await Leader.find();
      const regsFromDb = await Registration.find();
      data.leaders = leadersFromDb;
      data.registrations = regsFromDb;
    }

    let rows = [];
    let headers = [];

    if (type === "leaders") {
      headers = ["Nombre", "Email", "Teléfono", "Área/Zona", "Activo", "Registros"];
      rows = (data.leaders || []).map(l => [
        l.name || "",
        l.email || "",
        l.phone || "",
        l.area || "",
        l.active ? "Sí" : "No",
        l.registrations || 0
      ]);
    } else if (type === "registrations") {
      headers = ["Fecha", "Nombre", "Email", "Teléfono", "Líder"];
      rows = (data.registrations || []).map(r => [
        r.date ? new Date(r.date).toLocaleDateString("es-CO") : "",
        ((r.firstName || "") + " " + (r.lastName || "")).trim() || r.name || "",
        r.email || "",
        r.phone || "",
        ((data.leaders || []).find(l => String(l._id) === String(r.leaderId))?.name) || r.leaderName || "Sin líder"
      ]);
    } else {
      return res.status(400).send("Tipo no válido");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(type === "leaders" ? "Líderes" : "Registros");

    // Encabezado
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4361EE" } };
      cell.border = {
        top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" }
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Filas
    rows.forEach(row => {
      const r = sheet.addRow(row);
      r.eachCell(cell => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      });
    });

    // Auto width
    sheet.columns.forEach(column => {
      let max = 10;
      column.eachCell({ includeEmpty: true }, cell => {
        max = Math.max(max, (cell.value ? cell.value.toString().length : 0) + 2);
      });
      column.width = max;
    });

    res.setHeader("Content-Disposition", `attachment; filename=${type}_export.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Error al exportar Excel:", err);
    res.status(500).send("Error al generar el archivo Excel");
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
