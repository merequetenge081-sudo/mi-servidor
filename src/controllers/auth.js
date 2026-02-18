import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";
import { AuditService } from "../services/audit.service.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";
import { findAdminWithFallback, findLeaderWithFallback, getTestCredentials } from "../utils/authFallback.js";

export async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username y password requeridos" });
    }

    // Intenta obtener admin de MongoDB con fallback a memoria
    const { data: admin, source } = await findAdminWithFallback(Admin, username);

    if (!admin) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isValid = await bcryptjs.compare(password, admin.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        userId: admin._id,
        role: "admin",
        username: admin.username,
        organizationId: admin.organizationId || null, // Multi-tenant context
        source // Indica si proviene de MongoDB o memoria
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    // Log de auditoría (solo si MongoDB está disponible)
    try {
      await AuditService.log("LOGIN", "Admin", admin._id.toString(), { username, role: "admin", source }, {}, `Admin ${username} inició sesión`);
    } catch (auditError) {
      logger.warn("Audit log error (esperado sin MongoDB):", { error: auditError.message });
    }

    logger.info(`✅ Admin login exitoso [${source}]`, { username, source });
    res.json({ token, source });
  } catch (error) {
    logger.error("Admin login error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

export async function leaderLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email y password requeridos" });
    }

    // Intenta obtener líder de MongoDB con fallback a memoria
    const { data: leader, source } = await findLeaderWithFallback(Leader, email);

    if (!leader || !leader.passwordHash) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isValid = await bcryptjs.compare(password, leader.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      {
        userId: leader._id,
        leaderId: leader.leaderId,
        role: "leader",
        name: leader.name,
        organizationId: leader.organizationId, // Multi-tenant context
        source // Indica si proviene de MongoDB o memoria
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    logger.info(`✅ Leader login exitoso [${source}]`, { email, source });
    res.json({ token, source });
  } catch (error) {
    logger.error("Leader login error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

export async function leaderLoginById(req, res) {
  try {
    const { leaderId } = req.body;

    if (!leaderId) {
      return res.status(400).json({ error: "LeaderId requerido" });
    }

    console.log("👉 Login attempt with:", leaderId); // DEBUG LOG

    let query = { leaderId };

    // Si es un ObjectId válido, permitir búsqueda por _id también
    if (leaderId.match(/^[0-9a-fA-F]{24}$/)) {
      query = { $or: [{ leaderId }, { _id: leaderId }] };
    }

    let leader;
    let source = "unknown";
    try {
      leader = await Leader.findOne(query);
      if (leader) source = "mongodb";
    } catch (mongoError) {
      logger.warn("MongoDB no disponible, usando fallback en memoria", {
        error: mongoError.message
      });
      // Fallback a memoria - buscar en leaders de prueba
      const leaders = [
        { _id: "leader-001", leaderId: "L001", name: "Líder Prueba", cedula: "1000000001" },
        { _id: "leader-002", leaderId: "L002", name: "Segundo Líder", cedula: "1000000002" }
      ];
      leader = leaders.find(l => l.leaderId === leaderId || l._id === leaderId);
      if (leader) source = "memory";
    }

    if (!leader) {
      return res.status(401).json({ error: "Líder no encontrado" });
    }

    // Passwordless login: solo verificamos que el líder existe
    const token = jwt.sign(
      {
        userId: leader._id,
        leaderId: leader.leaderId,
        role: "leader",
        name: leader.name,
        organizationId: leader.organizationId, // Multi-tenant context
        source
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    try {
      await AuditService.log("LOGIN", "Leader", leader._id.toString(), { leaderId: leader.leaderId, role: "leader", source }, {}, `Líder ${leader.name} inició sesión`);
    } catch (auditError) {
      logger.warn("Audit log error (esperado sin MongoDB):", { error: auditError.message });
    }

    logger.info(`✅ Leader login exitoso [${source}]`, { leaderId, source });
    res.json({ token, source });
  } catch (error) {
    logger.error("Leader login error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

