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
const EventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, default: null },
  description: { type: String, default: '' },
  token: { type: String, default: () => `event-${Date.now()}` },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: () => new Date() }
});
const Event = mongoose.model('Event', EventSchema);

const LeaderSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  area: String,
  active: Boolean,
  token: String,
  eventId: { type: String, default: '' },
  registrations: { type: Number, default: 0 }
});
const RegistrationSchema = new mongoose.Schema({
  leaderId: String,
  leaderName: String,
  eventId: String,
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

// 🔹 ENDPOINT PARA MIGRAR DATOS DE data.json A MONGODB (DESARROLLO)
app.post("/api/migrate", async (req, res) => {
  try {
    const dataPath = path.join(__dirname, "data.json");
    const fileContent = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(fileContent);

    let migratedLeaders = 0;
    let migratedRegistrations = 0;

    // Migrar líderes
    if (data.leaders && Array.isArray(data.leaders)) {
      for (const leader of data.leaders) {
        const existingLeader = await Leader.findOne({ email: leader.email, phone: leader.phone });
        if (!existingLeader) {
          const newLeader = new Leader({
            name: leader.name,
            email: leader.email,
            phone: leader.phone,
            area: leader.area || "",
            active: leader.isActive !== false,
            token: leader.token || `leader-${leader.id}`,
            registrations: leader.registrations || 0
          });
          await newLeader.save();
          migratedLeaders++;
          console.log(`✅ Líder migrado: ${leader.name}`);
        }
      }
    }

    // Migrar registros
    if (data.registrations && Array.isArray(data.registrations)) {
      for (const reg of data.registrations) {
        const existingReg = await Registration.findOne({ 
          email: reg.email, 
          cedula: reg.cedula 
        });
        if (!existingReg) {
          // Buscar el líder por id antiguo
          const leader = data.leaders?.find(l => l.id === reg.leaderId);
          let leaderId = null;
          
          if (leader) {
            const dbLeader = await Leader.findOne({ 
              email: leader.email, 
              phone: leader.phone 
            });
            leaderId = dbLeader ? dbLeader._id : null;
          }

          const newReg = new Registration({
            leaderId: leaderId,
            leaderName: reg.leaderName || "",
            firstName: reg.firstName || "",
            lastName: reg.lastName || "",
            cedula: reg.cedula || "",
            email: reg.email || "",
            phone: reg.phone || "",
            date: reg.date || new Date().toISOString(),
            confirmed: false,
            confirmedBy: "",
            confirmedAt: null,
            notifications: {
              emailSent: false,
              smsSent: false,
              whatsappSent: reg.whatsappSent || false
            }
          });
          await newReg.save();
          migratedRegistrations++;
          console.log(`✅ Registro migrado: ${reg.firstName} ${reg.lastName}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Migración completada`,
      migratedLeaders,
      migratedRegistrations
    });

  } catch (error) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 🔹 Obtener líderes
// Opcional: filtrar líderes por eventId (/?eventId=...)
app.get("/api/leaders", async (req, res) => {
  const { eventId } = req.query;
  const filter = {};
  if (eventId) filter.eventId = eventId;
  const leaders = await Leader.find(filter);
  res.json(leaders);
});

// 🔹 Crear líder
app.post("/api/leaders", async (req, res) => {
  try {
    const leader = req.body;
    leader.token = leader.token || "leader" + Date.now();
    leader.active = leader.active !== false; // Asegurar que active sea booleano
    leader.registrations = 0; // Inicializar en 0
    
    const newLeader = await Leader.create(leader);
    console.log('✅ Líder creado:', newLeader);
    res.json(newLeader);
  } catch (err) {
    console.error('❌ Error creando líder:', err);
    res.status(500).json({ error: 'Error creando líder' });
  }
});

// 🔹 Events CRUD
app.get('/api/events', async (req, res) => {
  const events = await Event.find();
  res.json(events);
});

app.post('/api/events', async (req, res) => {
  try {
    const ev = req.body;
    ev.token = ev.token || `event-${Date.now()}`;
    const created = await Event.create(ev);
    res.json(created);
  } catch (err) {
    console.error('Error creando evento:', err);
    res.status(500).json({ error: 'Error creando evento' });
  }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    console.error('Error actualizando evento:', err);
    res.status(500).json({ error: 'Error actualizando evento' });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error eliminando evento:', err);
    res.status(500).json({ error: 'Error eliminando evento' });
  }
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

// 🔹 Obtener registros (opcionalmente filtrar por eventId)
app.get("/api/registrations", async (req, res) => {
  const { eventId } = req.query;
  const filter = {};
  if (eventId) filter.eventId = eventId;
  const regs = await Registration.find(filter);
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

    // Asignar eventId si viene en body o si el líder pertenece a un evento
    if (!reg.eventId && leader && leader.eventId) {
      reg.eventId = leader.eventId;
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
  const { eventId } = req.query;
  try {
    // 🔹 SIEMPRE obtener datos de la base de datos MongoDB
    let leadersFromDb = await Leader.find();
    let regsFromDb = await Registration.find();

    // Si se especifica eventId, filtrar resultados
    if (eventId) {
      leadersFromDb = leadersFromDb.filter(l => String(l.eventId) === String(eventId));
      regsFromDb = regsFromDb.filter(r => String(r.eventId) === String(eventId));
    }
    
    const data = {
      leaders: leadersFromDb,
      registrations: regsFromDb
    };

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
        "Email",
        "Teléfono",
        "Área",
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
          String(l._id) || "",
          l.name || "",
          l.email || "",
          l.phone || "",
          l.area || 'No especificada',
          l.active ? 'Activo' : 'Inactivo',
          registrosLider.length || 0,
          ultimoRegistro ? formatFecha(ultimoRegistro) : 'Sin registros',
          l.token || ""
        ];
      });
  } else if (type === "registrations") {
      headers = [
        "Fecha",
        "Nombre",
        "Apellido",
        "Cédula",
        "Email",
        "Teléfono",
        "Líder",
        "Confirmado",
        "Confirmado Por",
        "Confirmado En",
        "Email Enviado",
        "SMS Enviado"
      ];
      
      rows = (data.registrations || []).map(r => {
        const lider = (data.leaders || []).find(l => String(l._id) === String(r.leaderId));
        
        return [
          formatFecha(r.date),
          r.firstName || "",
          r.lastName || "",
          r.cedula || "",
          r.email || "",
          r.phone || "",
          lider?.name || r.leaderName || "Sin líder",
          r.confirmed ? 'Sí' : 'No',
          r.confirmedBy || "",
          r.confirmedAt ? formatFecha(r.confirmedAt) : "",
          r.notifications?.emailSent ? 'Sí' : 'No',
          r.notifications?.smsSent ? 'Sí' : 'No'
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

    res.setHeader("Content-Disposition", `attachment; filename=${type}_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Error al exportar Excel:", err);
    res.status(500).send("Error al generar el archivo Excel");
  }
});

// 🔹 Estadísticas generales por evento
app.get('/api/stats', async (req, res) => {
  try {
    const { eventId } = req.query;
    const match = {};
    if (eventId) match.eventId = String(eventId);

    const leadersCount = await Leader.countDocuments(eventId ? { eventId: String(eventId) } : {});
    const activeLeadersCount = await Leader.countDocuments(Object.assign({}, match, { active: true }));

    const regs = await Registration.find(match);
    const totalRegistrations = regs.length;
    const confirmedCount = regs.filter(r => r.confirmed).length;

    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const weekStart = new Date(); weekStart.setHours(0,0,0,0); weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(); monthStart.setHours(0,0,0,0); monthStart.setMonth(monthStart.getMonth() - 1);

    const todayRegistrations = regs.filter(r => new Date(r.date) >= todayStart).length;
    const weekRegistrations = regs.filter(r => new Date(r.date) >= weekStart).length;
    const monthRegistrations = regs.filter(r => new Date(r.date) >= monthStart).length;

    // top leader
    const topAgg = await Registration.aggregate([
      { $match: match },
      { $group: { _id: '$leaderId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'leaders', localField: '_id', foreignField: '_id', as: 'leader' } },
      { $unwind: { path: '$leader', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, leaderId: '$_id', count: 1, leaderName: '$leader.name' } }
    ]);

    res.json({
      totalLeaders: leadersCount,
      activeLeaders: activeLeadersCount,
      totalRegistrations,
      confirmedCount,
      confirmationRate: totalRegistrations > 0 ? (confirmedCount / totalRegistrations) * 100 : 0,
      todayRegistrations,
      weekRegistrations,
      monthRegistrations,
      topLeader: topAgg[0] || null
    });
  } catch (err) {
    console.error('Error /api/stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Series diarias (registros por día)
app.get('/api/stats/daily', async (req, res) => {
  try {
    const { eventId } = req.query;
    const match = {};
    if (eventId) match.eventId = String(eventId);

    const pipeline = [
      { $match: match },
      { $addFields: { dateObj: { $toDate: '$date' } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateObj' } },
          total: { $sum: 1 },
          confirmed: { $sum: { $cond: ['$confirmed', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const data = await Registration.aggregate(pipeline);
    res.json(data);
  } catch (err) {
    console.error('Error /api/stats/daily:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Top líderes (por registros)
app.get('/api/leaders/top', async (req, res) => {
  try {
    const { eventId, limit = 10 } = req.query;
    const match = {};
    if (eventId) match.eventId = String(eventId);

    const agg = await Registration.aggregate([
      { $match: match },
      { $group: { _id: '$leaderId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit, 10) },
      { $lookup: { from: 'leaders', localField: '_id', foreignField: '_id', as: 'leader' } },
      { $unwind: { path: '$leader', preserveNullAndEmptyArrays: true } },
      { $project: { leaderId: '$_id', count: 1, name: '$leader.name', email: '$leader.email', phone: '$leader.phone', area: '$leader.area' } }
    ]);

    res.json(agg);
  } catch (err) {
    console.error('Error /api/leaders/top:', err);
    res.status(500).json({ error: err.message });
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

// 🔹 Enviar QR de registro a un líder
app.post('/api/leaders/:id/send-qr', async (req, res) => {
  try {
    const leader = await Leader.findById(req.params.id);
    if (!leader) return res.status(404).json({ error: 'Líder no encontrado' });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const registrationUrl = `${baseUrl}/registro/${leader.token}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(registrationUrl)}`;

    // Preparar mensaje para WhatsApp
    const whatsappMessage = `¡Hola ${leader.name}! Aquí está tu código QR para registrar asistentes:\n\n${qrUrl}\n\nO puedes compartir este enlace directamente:\n${registrationUrl}`;

    // Enviar por WhatsApp si hay número
    let whatsappResult = { success: false };
    if (leader.phone) {
      try {
        const whatsappResponse = await fetch(BOT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            numero: leader.phone, 
            mensaje: whatsappMessage 
          })
        });
        whatsappResult = await whatsappResponse.json();
      } catch (whatsappError) {
        console.error('Error enviando WhatsApp:', whatsappError);
      }
    }

    // Enviar por email
    let emailResult = { success: false };
    if (leader.email) {
      try {
        emailResult = await resend.emails.send({
          from: 'Sistema de Registro <onboarding@resend.dev>',
          to: leader.email,
          subject: '🎫 Tu código QR para registros',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4361ee; text-align: center;">Tu Código QR para Registros</h2>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="color: #333;">Hola ${leader.name},</h3>
                <p>Aquí está tu código QR para registrar asistentes:</p>
                
                <div style="text-align: center; margin: 20px 0;">
                  <img src="${qrUrl}" alt="Código QR" style="max-width: 300px; width: 100%;">
                </div>
                
                <p>También puedes compartir este enlace directamente:</p>
                <p style="background: #fff; padding: 10px; border-radius: 5px;">
                  <a href="${registrationUrl}">${registrationUrl}</a>
                </p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error('Error enviando email:', emailError);
      }
    }

    res.json({
      success: true,
      whatsappSent: whatsappResult.success,
      emailSent: emailResult?.id ? true : false,
      registrationUrl,
      qrUrl
    });

  } catch (error) {
    console.error('❌ Error enviando QR al líder:', error);
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