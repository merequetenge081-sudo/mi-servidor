import { Leader } from "../models/Leader.js";
import { Registration } from "../models/Registration.js";
import { AuditService } from "../services/audit.service.js";
import bcryptjs from "bcryptjs";
import crypto from "crypto";

// Generar token único de 32 caracteres hexadecimales
function generateToken() {
  return crypto.randomBytes(16).toString("hex");
}

export async function createLeader(req, res) {
  try {
    const { leaderId, name, email, phone, area, eventId, password, token: providedToken } = req.body;
    const user = req.user;

    if (!leaderId || !name) {
      return res.status(400).json({ error: "leaderId y name son requeridos" });
    }

    const existing = await Leader.findOne({ leaderId });
    if (existing) {
      return res.status(400).json({ error: "leaderId ya existe" });
    }

    // Generar token automáticamente (no permitir token manual)
    let token = generateToken();
    let tokenExists = await Leader.findOne({ token });
    
    // Si el token existe (muy improbable), generar uno nuevo
    while (tokenExists) {
      token = generateToken();
      tokenExists = await Leader.findOne({ token });
    }

    const passwordHash = password ? await bcryptjs.hash(password, 10) : null;

    const leader = new Leader({
      leaderId,
      name,
      email,
      phone,
      area,
      eventId,
      passwordHash,
      token,
      registrations: 0
    });

    await leader.save();

    await AuditService.log("CREATE", "Leader", leader._id.toString(), user, { leaderId, name }, `Líder ${name} creado`);

    res.status(201).json(leader);
  } catch (error) {
    console.error("Create leader error:", error.message);
    
    // Manejar error de token duplicado (por si acaso)
    if (error.code === 11000 && error.keyPattern?.token) {
      return res.status(500).json({ error: "Error al generar token único, intenta nuevamente" });
    }
    
    res.status(500).json({ error: "Error al crear líder" });
  }
}

export async function getLeaders(req, res) {
  try {
    const { eventId, active } = req.query;
    const filter = {};

    if (eventId) filter.eventId = eventId;
    if (active !== undefined) filter.active = active === "true";

    const leaders = await Leader.find(filter).sort({ name: 1 });
    res.json(leaders);
  } catch (error) {
    console.error("Get leaders error:", error.message);
    res.status(500).json({ error: "Error al obtener líderes" });
  }
}

export async function getLeader(req, res) {
  try {
    const leader = await Leader.findById(req.params.id);
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }
    res.json(leader);
  } catch (error) {
    console.error("Get leader error:", error.message);
    res.status(500).json({ error: "Error al obtener líder" });
  }
}

export async function updateLeader(req, res) {
  try {
    const { name, email, phone, area, active } = req.body;
    const user = req.user;

    const leader = await Leader.findById(req.params.id);
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    const changes = {};
    if (name !== undefined) {
      changes.name = { old: leader.name, new: name };
      leader.name = name;
    }
    if (email !== undefined) {
      changes.email = { old: leader.email, new: email };
      leader.email = email;
    }
    if (phone !== undefined) {
      changes.phone = { old: leader.phone, new: phone };
      leader.phone = phone;
    }
    if (area !== undefined) {
      changes.area = { old: leader.area, new: area };
      leader.area = area;
    }
    if (active !== undefined) {
      changes.active = { old: leader.active, new: active };
      leader.active = active;
    }

    leader.updatedAt = new Date();
    await leader.save();

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), user, changes, `Líder ${leader.name} actualizado`);

    res.json(leader);
  } catch (error) {
    console.error("Update leader error:", error.message);
    res.status(500).json({ error: "Error al actualizar líder" });
  }
}

export async function deleteLeader(req, res) {
  try {
    const user = req.user;
    const leader = await Leader.findById(req.params.id);

    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    const registrationCount = await Registration.countDocuments({ leaderId: leader.leaderId });

    await Leader.deleteOne({ _id: req.params.id });
    await AuditService.log("DELETE", "Leader", leader._id.toString(), user, { registrations: registrationCount }, `Líder ${leader.name} eliminado`);

    res.json({ message: "Líder eliminado", registrationsDeleted: registrationCount });
  } catch (error) {
    console.error("Delete leader error:", error.message);
    res.status(500).json({ error: "Error al eliminar líder" });
  }
}

export async function getTopLeaders(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaders = await Leader.find({ active: true }).sort({ registrations: -1 }).limit(limit);
    res.json(leaders);
  } catch (error) {
    console.error("Get top leaders error:", error.message);
    res.status(500).json({ error: "Error al obtener líderes destacados" });
  }
}

export async function generateLeaderQR(req, res) {
  try {
    const user = req.user;
    const { leaderId } = req.params;

    // Control de acceso: admin puede ver todo, leader solo su propio QR
    if (user.role === "leader" && user.leaderId !== leaderId) {
      return res.status(403).json({ error: "No tienes permiso para generar este QR" });
    }

    const leader = await Leader.findOne({ leaderId });
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    // Generar URL del formulario con leaderId
    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const formUrl = `${baseUrl}/form.html?leaderId=${leaderId}`;

    // Generar QR como base64 usando qrcode
    const QRCode = (await import("qrcode")).default;
    const qrDataUrl = await QRCode.toDataURL(formUrl, {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      width: 300
    });

    res.json({
      leaderId,
      leaderName: leader.name,
      formUrl,
      qrCode: qrDataUrl
    });
  } catch (error) {
    console.error("Generate QR error:", error.message);
    res.status(500).json({ error: "Error al generar código QR" });
  }
}

// Endpoint público para obtener información del líder por token
export async function getLeaderByToken(req, res) {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: "Token requerido" });
    }

    const leader = await Leader.findOne({ token }).select('leaderId name eventId active');

    if (!leader) {
      return res.status(404).json({ error: "Token inválido o líder no encontrado" });
    }

    if (!leader.active) {
      return res.status(403).json({ error: "Líder inactivo" });
    }

    // Retornar solo datos necesarios para el formulario público
    res.json({
      leaderId: leader.leaderId,
      name: leader.name,
      eventId: leader.eventId
    });
  } catch (error) {
    console.error("Get leader by token error:", error.message);
    res.status(500).json({ error: "Error al obtener información del líder" });
  }
}
