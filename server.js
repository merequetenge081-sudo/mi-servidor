import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
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

// Exportar registros a Excel
app.get("/api/export/registrations", async (req, res) => {
  try {
    const regs = await Registration.find().populate("leaderId");

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Registros");

    // 🎨 Encabezados con estilo
    worksheet.columns = [
      { header: "Fecha", key: "date", width: 15 },
      { header: "Nombre de Persona", key: "name", width: 25 },
      { header: "Nombre del Líder", key: "leaderName", width: 25 },
      { header: "Token del Líder", key: "token", width: 25 }
    ];

    // 🔹 Estilo de los encabezados
    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "4472C4" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    });

    // 📋 Agregar filas
    regs.forEach(reg => {
      worksheet.addRow({
        date: new Date(reg.date).toLocaleDateString("es-ES"),
        name: reg.name,
        leaderName: reg.leaderId?.name || "Sin líder",
        token: reg.leaderId?.token || "-"
      });
    });

    // 🟩 Bordes y formato de celdas
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell(cell => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" }
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      if (rowNumber % 2 === 0 && rowNumber > 1) {
        row.eachCell(cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "DDEBF7" } };
        });
      }
    });

    // 📁 Enviar el archivo
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=registros_formateados.xlsx");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Error al exportar Excel:", err);
    res.status(500).send("Error al generar el archivo Excel");
  }
});

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
