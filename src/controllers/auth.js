import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";
import { AuditService } from "../services/audit.service.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";

export async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username y password requeridos" });
    }

    let admin;
    try {
      admin = await Admin.findOne({ username });
    } catch (mongoError) {
      logger.error("MongoDB error:", { error: mongoError.message, stack: mongoError.stack });
      return res.status(503).json({ error: "Base de datos no disponible" });
    }
    
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
        organizationId: admin.organizationId || null // Multi-tenant context
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    try {
      await AuditService.log("LOGIN", "Admin", admin._id.toString(), { username, role: "admin" }, {}, `Admin ${username} inició sesión`);
    } catch (auditError) {
      logger.warn("Audit log error:", { error: auditError.message });
    }

    res.json({ token });
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

    let leader;
    try {
      leader = await Leader.findOne({ email });
    } catch (mongoError) {
      logger.error("MongoDB error:", { error: mongoError.message, stack: mongoError.stack });
      return res.status(503).json({ error: "Base de datos no disponible" });
    }

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
        organizationId: leader.organizationId // Multi-tenant context
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    res.json({ token });
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

    let leader;
    try {
      leader = await Leader.findOne({ leaderId });
    } catch (mongoError) {
      logger.error("MongoDB error:", { error: mongoError.message, stack: mongoError.stack });
      return res.status(503).json({ error: "Base de datos no disponible" });
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
        organizationId: leader.organizationId // Multi-tenant context
      },
      config.jwtSecret,
      { expiresIn: "12h" }
    );

    try {
      await AuditService.log("LOGIN", "Leader", leader._id.toString(), { leaderId: leader.leaderId, role: "leader" }, {}, `Líder ${leader.name} inició sesión`);
    } catch (auditError) {
      logger.warn("Audit log error:", { error: auditError.message });
    }

    res.json({ token });
  } catch (error) {
    logger.error("Leader login error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

