import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ExcelJS from "exceljs";
import fetch from 'node-fetch';
import dotenv from "dotenv";
import { NotificationService } from './notifications.js';

dotenv.config();
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
  date: String,
  notifications: {
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    whatsappSent: { type: Boolean, default: false }
  }
});

// Campos para control de asistencia/confirmación en el evento
RegistrationSchema.add({
  confirmed: { type: Boolean, default: false },
  confirmedBy: { type: String, default: '' },
  confirmedAt: { type: Date, default: null }
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

// 🔹 NUEVO: Endpoint para enviar notificaciones manualmente
app.post("/api/send-notification/:registrationId", async (req, res) => {
  try {
    console.log('🔔 Solicitud de notificación recibida para ID:', req.params.registrationId);
    
    const registration = await Registration.findById(req.params.registrationId);
    if (!registration) {
      console.log('❌ Registro no encontrado');
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const userData = {
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      phone: registration.phone
    };

    console.log('👤 Datos del usuario:', userData);

    const results = await NotificationService.sendAllNotifications(userData);

    // Actualizar estado de notificaciones
    registration.notifications.emailSent = results.email.success;
    registration.notifications.smsSent = results.sms.success;
    await registration.save();

    console.log('✅ Notificaciones procesadas:', results);

    res.json({
      success: true,
      message: "Notificaciones enviadas",
      results
    });

  } catch (error) {
    console.error("❌ Error enviando notificaciones:", error);
    res.status(500).json({ error: "Error enviando notificaciones" });
  }
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

// 🔹 Nuevo registro (VERSIÓN MEJORADA)
app.post("/api/registrations", async (req, res) => {
  try {
    const reg = req.body;
    reg.date = new Date().toISOString();

    // Buscar líder
    let leader;
    if (reg.leaderId) {
      leader = await Leader.findById(reg.leaderId);
    } else if (reg.leaderToken) {
      leader = await Leader.findOne({ token: reg.leaderToken });
      if (leader) reg.leaderId = leader._id;
    }

    if (leader) {
      reg.leaderName = leader.name;
      leader.registrations = (leader.registrations || 0) + 1;
      await leader.save();
    } else {
      return res.status(400).json({ error: "Líder no encontrado" });
    }

    const newReg = await Registration.create(reg);

    // 🔹 ENVIAR NOTIFICACIONES AUTOMÁTICAS (Email + SMS)
    try {
      const userData = {
        firstName: newReg.firstName,
        lastName: newReg.lastName,
        email: newReg.email,
        phone: newReg.phone
      };

      const notificationResults = await NotificationService.sendAllNotifications(userData);

      // Actualizar estado
      newReg.notifications.emailSent = notificationResults.email.success;
      newReg.notifications.smsSent = notificationResults.sms.success;
      await newReg.save();

      console.log('✅ Notificaciones enviadas:', notificationResults);

    } catch (notifyError) {
      console.error('❌ Error en notificaciones automáticas:', notifyError);
      // No falla el registro principal por error en notificaciones
    }

    res.json(newReg);

  } catch (err) {
    console.error("❌ Error al crear registro:", err);
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

// 🔹 Endpoint dedicado para confirmar asistencia (evita enviar todo el objeto)
app.post('/api/registrations/:id/confirm', async (req, res) => {
  try {
    const { confirmedBy } = req.body;
    const updated = await Registration.findByIdAndUpdate(req.params.id, {
      confirmed: true,
      confirmedBy: confirmedBy || 'Admin',
      confirmedAt: new Date()
    }, { new: true });

    if (!updated) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(updated);
  } catch (err) {
    console.error('Error confirmando registro:', err);
    res.status(500).json({ error: 'Error confirmando registro' });
  }
});

// 🔹 Endpoint para desconfirmar asistencia
app.post('/api/registrations/:id/unconfirm', async (req, res) => {
  try {
    const updated = await Registration.findByIdAndUpdate(req.params.id, {
      confirmed: false,
      confirmedBy: '',
      confirmedAt: null
    }, { new: true });

    if (!updated) return res.status(404).json({ error: 'Registro no encontrado' });
    res.json(updated);
  } catch (err) {
    console.error('Error desconfirmando registro:', err);
    res.status(500).json({ error: 'Error desconfirmando registro' });
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

    const formatFecha = (fecha) => {
      if (!fecha) return "";
      const date = new Date(fecha);
      return new Intl.DateTimeFormat('es-CO', { 
        day: '2-digit',
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    };

    if (type === "leaders") {
      headers = [
        "ID",
        "Nombre Completo",
        "Correo Electrónico",
        "Teléfono",
        "Área/Grupo",
        "Estado",
        "Total Registros",
        "Último Registro",
        "Token"
      ];
      
      rows = (data.leaders || []).map(l => {
        const registrosLider = (data.registrations || [])
          .filter(r => String(r.leaderId) === String(l._id));
        const ultimoRegistro = registrosLider.length > 0 ? 
          Math.max(...registrosLider.map(r => new Date(r.date))) : null;
        
        return [
          l._id || "",
          l.name || "",
          l.email || "",
          l.phone || "",
          l.area || 'No especificada',
          l.active ? 'Activo ✅' : 'Inactivo ❌',
          registrosLider.length || 0,
          ultimoRegistro ? formatFecha(ultimoRegistro) : 'Sin registros',
          l.token || ""
        ];
      });
    } else if (type === "registrations") {
      headers = [
        "ID",
        "Fecha y Hora",
        "Nombre Completo",
        "Correo Electrónico",
        "Teléfono",
        "Líder Asignado",
        "Área del Líder",
        "Notificaciones"
      ];
      
      rows = (data.registrations || []).map(r => {
        const lider = (data.leaders || []).find(l => String(l._id) === String(r.leaderId));
        const nombreCompleto = ((r.firstName || "") + " " + (r.lastName || "")).trim() || r.name || "";
        const notificaciones = [];
        if (r.notifications) {
          if (r.notifications.emailSent) notificaciones.push('Email ✅');
          if (r.notifications.smsSent) notificaciones.push('SMS ✅');
          if (r.notifications.whatsappSent) notificaciones.push('WhatsApp ✅');
        }
        
        return [
          r._id || "",
          formatFecha(r.date),
          nombreCompleto,
          r.email || 'No proporcionado',
          r.phone || 'No proporcionado',
          lider?.name || r.leaderName || "Sin líder",
          lider?.area || 'No especificada',
          notificaciones.length ? notificaciones.join(', ') : 'Pendientes'
        ];
      });
    } else {
      return res.status(400).send("Tipo no válido");
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sistema de Registro';
    workbook.created = new Date();
    
    const sheet = workbook.addWorksheet(type === "leaders" ? "Líderes" : "Registros", {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
      properties: { tabColor: { argb: 'FF4361EE' } }
    });

    // Título del reporte
    const titleRow = sheet.addRow([`Reporte de ${type === "leaders" ? "Líderes" : "Registros"}`]);
    titleRow.font = { size: 16, bold: true };
    titleRow.alignment = { horizontal: 'center' };
    sheet.mergeCells(1, 1, 1, headers.length);
    
    // Espacio después del título
    sheet.addRow([]);

    // Encabezados
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FF4361EE' } 
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF4361EE' } },
        left: { style: 'thin', color: { argb: 'FF4361EE' } },
        bottom: { style: 'medium', color: { argb: 'FF4361EE' } },
        right: { style: 'thin', color: { argb: 'FF4361EE' } }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });

    // Filas de datos
    rows.forEach((row, index) => {
      const dataRow = sheet.addRow(row);
      dataRow.height = 25; // Altura consistente
      
      dataRow.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } },
          right: { style: 'thin', color: { argb: 'FFD3D3D3' } }
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
        
        // Color alternado para filas
        if (index % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        }
      });
    });

    // Auto-ajustar columnas con márgenes
    sheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, cell => {
        const length = cell.value ? cell.value.toString().length : 10;
        maxLength = Math.max(maxLength, length);
      });
      column.width = Math.min(Math.max(maxLength + 4, 12), 50); // Mínimo 12, máximo 50
    });

    // Congelar panel de encabezado
    sheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: 3, activeCell: 'A4' }
    ];

    res.setHeader("Content-Disposition", `attachment; filename=${type}_export.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Error al exportar Excel:", err);
    res.status(500).send("Error al generar el archivo Excel");
  }
});

// 🔹 Endpoint para que el frontend o cualquier servicio solicite el envío
//     de un WhatsApp a través del bot (puede apuntar a Render o local).
//     Cambia BOT_URL en .env o directamente aquí si usas otra URL.
const BOT_URL = process.env.BOT_URL || "https://wa-bot.onrender.com/send";

app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { numero, mensaje } = req.body;
    if (!numero || !mensaje) return res.status(400).json({ error: 'Faltan parametros numero o mensaje' });

    const response = await fetch(BOT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numero, mensaje })
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ Error al enviar mensaje a WhatsApp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
// 🔹 Ruta para probar el servicio de email
app.get('/api/test-email', async (req, res) => {
  try {
    const result = await NotificationService.checkEmailService();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// 🔹 Ruta para probar envío REAL de email
app.get('/api/test-send-email', async (req, res) => {
  try {
    const testData = {
      firstName: "Usuario",
      lastName: "Prueba", 
      email: "jonnathanpena1@gmail.com",
      phone: "1234567890"
    };
    
    console.log('🧪 Probando envío REAL de email...');
    const result = await NotificationService.sendEmailConfirmation(testData);
    
    res.json(result);
    
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));