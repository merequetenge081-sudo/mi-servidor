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
      { expiresIn: "1h" }
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
    const { email, username, password } = req.body; // Accept email OR username

    if ((!email && !username) || !password) {
      return res.status(400).json({ error: "Usuario/Email y password requeridos" });
    }

    // Determine query (Email or Username)
    const query = email ? { email } : { username };

    // Intenta obtener líder de MongoDB con fallback a memoria
    // NOTE: Fallback logic might need adjustment if it doesn't support username, 
    // but for now we prioritize MongoDB which has the new fields.
    // Assuming findLeaderWithFallback handles basic query or we query DB directly first.

    // For security upgrade, let's query DB directly first as memory fallback might be legacy
    let leader = await Leader.findOne(query);
    let source = 'mongodb';

    if (!leader) {
      // Fallback to legacy function if by email, but likely won't have passwordHash if legacy
      if (email) {
        const result = await findLeaderWithFallback(Leader, email);
        leader = result.data;
        source = result.source;
      }
    }

    if (!leader || !leader.passwordHash) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isValid = await bcryptjs.compare(password, leader.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    if (!leader.active) {
      return res.status(403).json({ error: "Cuenta inactiva. Contacte al administrador." });
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
      { expiresIn: "1h" }
    );

    logger.info(`✅ Leader login exitoso [${source}]`, { user: email || username, source });

    // Return flag if password change is required
    res.json({
      token,
      source,
      leaderId: leader.leaderId || leader._id.toString(),
      requirePasswordChange: leader.isTemporaryPassword || false,
      username: leader.username || leader.name
    });
  } catch (error) {
    logger.error("Leader login error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

// --- NEW SECURITY ENDPOINTS ---

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const leaderId = req.user.userId;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verify current (unless it's a force reset flow where we might want to relax this, 
    // but typically we still ask for current to ensure session validity is manual? 
    // Actually, if they are logged in with a valid token (which they strictly are to hit this endpoint), 
    // enforcing current password is good practice but if they forgot it... 
    // logic: If they are logged in, they know the current (temp) password.

    if (currentPassword) {
      const isValid = await bcryptjs.compare(currentPassword, leader.passwordHash);
      if (!isValid) return res.status(401).json({ error: "Contraseña actual incorrecta" });
    } else if (!leader.isTemporaryPassword) {
      // If not temporary, we MUST require current password
      return res.status(400).json({ error: "Se requiere la contraseña actual" });
    }

    const salt = await bcryptjs.genSalt(10);
    const newHash = await bcryptjs.hash(newPassword, salt);
    // Use updateOne to avoid validation issues on legacy documents
    await Leader.updateOne({ _id: leader._id }, {
      $set: {
        passwordHash: newHash,
        isTemporaryPassword: false
      }
    });

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), req.user, {}, `Cambio de contraseña exitoso`);

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    logger.error("Change password error:", { error: error.message });
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
}

export async function adminResetPassword(req, res) {
  try {
    const { leaderId, newUsername, newPassword: customPassword } = req.body;
    const adminUser = req.user;

    // Only Admins (Middleware should already handle this, but double check role if mixed file)
    if (adminUser.role !== 'admin' && adminUser.role !== 'superadmin') {
      return res.status(403).json({ error: "No autorizado" });
    }

    const leader = await Leader.findById(leaderId || req.params.id);
    if (!leader) return res.status(404).json({ error: "Líder no encontrado" });

    // Update username if admin provided one
    if (newUsername && newUsername.trim()) {
      const cleanUsername = newUsername.trim().toLowerCase();
      // Check uniqueness (excluding this leader)
      const existing = await Leader.findOne({ username: cleanUsername, _id: { $ne: leader._id } });
      if (existing) {
        return res.status(400).json({ error: `El usuario "${cleanUsername}" ya existe` });
      }
      leader.username = cleanUsername;
    }

    // Use custom password or generate one
    const tempPassword = customPassword && customPassword.trim() ? customPassword.trim() : (Math.random().toString(36).slice(-8) + "Aa1!");
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    leader.passwordHash = passwordHash;
    leader.isTemporaryPassword = true;
    await leader.save();

    // Log & "Send Email"
    console.log("\n==================================================");
    console.log(" 📧 MOCK EMAIL SERVICE - PASSWORD RESET BY ADMIN 📧");
    console.log(`To: ${leader.email || 'No Email Provided'}`);
    console.log(`Subject: Restablecimiento de Contraseña`);
    console.log("--------------------------------------------------");
    console.log(`Hola ${leader.name},`);
    console.log(`Un administrador ha restablecido tu contraseña.`);
    console.log(`Usuario: ${leader.username || 'N/A'}`);
    console.log(`Nueva Contraseña Temporal: ${tempPassword}`);
    console.log(`Por favor inicia sesión y cámbiala de inmediato.`);
    console.log("==================================================\n");

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), adminUser, {}, `Admin restableció contraseña de ${leader.name}`);

    res.json({ message: "Contraseña restablecida", _tempPassword: tempPassword, _username: leader.username || '' });


  } catch (error) {
    logger.error("Admin reset password error:", { error: error.message });
    res.status(500).json({ error: "Error al restablecer contraseña" });
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
      { expiresIn: "1h" }
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

// Líder solicita reset de contraseña
export async function requestPasswordReset(req, res) {
  try {
    const { leaderId, username, email } = req.body;

    if (!leaderId && !username && !email) {
      return res.status(400).json({ error: "Se requiere leaderId, username o email" });
    }

    // Buscar líder por leaderId, _id, username o email
    const query = { $or: [] };
    if (leaderId) {
      query.$or.push({ leaderId }, { _id: leaderId });
    }
    if (username) {
      query.$or.push({ username });
    }
    if (email) {
      query.$or.push({ email });
    }

    const leader = await Leader.findOne(query);

    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    // Verificar si ya hay una solicitud pendiente
    if (leader.passwordResetRequested) {
      return res.status(200).json({ 
        alreadyRequested: true,
        message: "Ya se solicitó el cambio de contraseña. Por favor espere a que el administrador genere una nueva contraseña temporal.", 
        leaderId: leader.leaderId,
        name: leader.name
      });
    }

    // Marcar como solicitando reset
    await Leader.updateOne({ _id: leader._id }, {
      $set: {
        passwordResetRequested: true,
        passwordCanBeChanged: true
      }
    });

    logger.info(`Password reset solicitado para líder ${leader.name}`);

    res.json({ 
      alreadyRequested: false,
      message: "Solicitud enviada. El administrador generará una nueva contraseña temporal.", 
      leaderId: leader.leaderId,
      name: leader.name
    });
  } catch (error) {
    logger.error("Request password reset error:", { error: error.message });
    res.status(500).json({ error: "Error al solicitar reset de contraseña" });
  }
}

// Admin genera nueva contraseña temporal para líder que la solicitó
export async function adminGenerateNewPassword(req, res) {
  try {
    const { leaderId } = req.body;
    const adminUser = req.user;

    if (adminUser.role !== 'admin' && adminUser.role !== 'superadmin') {
      return res.status(403).json({ error: "No autorizado" });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return res.status(404).json({ error: "Líder no encontrado" });

    if (!leader.passwordResetRequested) {
      return res.status(400).json({ error: "El líder no ha solicitado un reset de contraseña" });
    }

    // Generar nueva contraseña temporal
    const tempPassword = Math.random().toString(36).slice(-8) + "Aa1!";
    const salt = await bcryptjs.genSalt(10);
    const newHash = await bcryptjs.hash(tempPassword, salt);

    await Leader.updateOne({ _id: leader._id }, {
      $set: {
        passwordHash: newHash,
        isTemporaryPassword: true,
        passwordResetRequested: false,
        passwordCanBeChanged: true,
        tempPasswordPlaintext: tempPassword // Guardar contraseña temporal para referencia del admin
      }
    });

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), adminUser, {}, `Admin generó nueva contraseña temporal para ${leader.name}`);

    logger.info(`Nueva contraseña temporal generada para ${leader.name}: ${tempPassword}`);

    res.json({ 
      message: "Nueva contraseña generada", 
      tempPassword,
      username: leader.username || leader.name
    });
  } catch (error) {
    logger.error("Admin generate new password error:", { error: error.message });
    res.status(500).json({ error: "Error al generar nueva contraseña" });
  }
}

// Líder cambia su contraseña (solo si passwordCanBeChanged es true)
export async function leaderChangePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const leaderId = req.user.userId;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return res.status(404).json({ error: "Usuario no encontrado" });

    // Verificar si puede cambiar contraseña
    if (!leader.passwordCanBeChanged && !leader.isTemporaryPassword) {
      return res.status(403).json({ 
        error: "No puedes cambiar tu contraseña. Solicita un reset al administrador." 
      });
    }

    // Verificar contraseña actual
    if (currentPassword) {
      const isValid = await bcryptjs.compare(currentPassword, leader.passwordHash);
      if (!isValid) return res.status(401).json({ error: "Contraseña actual incorrecta" });
    } else if (!leader.isTemporaryPassword) {
      return res.status(400).json({ error: "Se requiere la contraseña actual" });
    }

    const salt = await bcryptjs.genSalt(10);
    const newHash = await bcryptjs.hash(newPassword, salt);

    await Leader.updateOne({ _id: leader._id }, {
      $set: {
        passwordHash: newHash,
        isTemporaryPassword: false,
        passwordCanBeChanged: false, // Bloquear cambios futuros
        passwordResetRequested: false
      },
      $unset: {
        tempPasswordPlaintext: "" // Borrar contraseña temporal ya que el líder configuró una nueva
      }
    });

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), req.user, {}, `Líder ${leader.name} cambió su contraseña`);

    res.json({ message: "Contraseña actualizada correctamente. No podrás cambiarla nuevamente sin solicitar un reset." });
  } catch (error) {
    logger.error("Leader change password error:", { error: error.message });
    res.status(500).json({ error: "Error al cambiar contraseña" });
  }
}
