import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";
import { Organization } from "../models/Organization.js";
import { AuditService } from "../services/audit.service.js";
import { emailService } from "../services/emailService.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";
import { findAdminWithFallback, findLeaderWithFallback, getTestCredentials } from "../utils/authFallback.js";
import { validatePassword, getPasswordRequirements } from "../utils/passwordValidator.js";

export async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username y password requeridos" });
    }

    const { data: admin, source } = await findAdminWithFallback(Admin, username);

    if (!admin) {
      if (req.loginRateLimit) req.loginRateLimit.recordFailedAttempt();
      const remaining = req.loginRateLimit ? req.loginRateLimit.getAttemptsRemaining() : 5;
      return res.status(401).json({ 
        error: "Credenciales inválidas", 
        attemptsRemaining: remaining 
      });
    }

    const isValid = await bcryptjs.compare(password, admin.passwordHash);
    if (!isValid) {
      if (req.loginRateLimit) req.loginRateLimit.recordFailedAttempt();
      const remaining = req.loginRateLimit ? req.loginRateLimit.getAttemptsRemaining() : 5;
      return res.status(401).json({ 
        error: "Credenciales inválidas", 
        attemptsRemaining: remaining 
      });
    }

    let organizationId = admin.organizationId || null;
    if (!organizationId) {
      let defaultOrg = await Organization.findOne({ slug: "default" });
      if (!defaultOrg) {
        defaultOrg = new Organization({
          name: "Default Organization",
          slug: "default",
          description: "Organizacion por defecto para admins",
          status: "active",
          plan: "pro"
        });
        await defaultOrg.save();
      }
      organizationId = defaultOrg._id.toString();
    }

    const token = jwt.sign(
      {
        userId: admin._id,
        role: "admin",
        username: admin.username,
        organizationId, // Multi-tenant context
        source // Indica si proviene de MongoDB o memoria
      },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

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
    const { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return res.status(400).json({ error: "Usuario/Email y password requeridos" });
    }

    const query = email ? { email } : { username };

    let leader = await Leader.findOne(query);
    let source = 'mongodb';

    if (!leader) {
      if (email) {
        const result = await findLeaderWithFallback(Leader, email);
        leader = result.data;
        source = result.source;
      }
    }

    if (!leader || !leader.passwordHash) {
      if (req.loginRateLimit) req.loginRateLimit.recordFailedAttempt();
      const remaining = req.loginRateLimit ? req.loginRateLimit.getAttemptsRemaining() : 5;
      return res.status(401).json({ 
        error: "Credenciales inválidas", 
        attemptsRemaining: remaining 
      });
    }

    const isValid = await bcryptjs.compare(password, leader.passwordHash);
    if (!isValid) {
      if (req.loginRateLimit) req.loginRateLimit.recordFailedAttempt();
      const remaining = req.loginRateLimit ? req.loginRateLimit.getAttemptsRemaining() : 5;
      return res.status(401).json({ 
        error: "Credenciales inválidas", 
        attemptsRemaining: remaining 
      });
    }

    if (!leader.active) {
      return res.status(403).json({ error: "Cuenta inactiva. Contacte al administrador." });
    }

    if (req.loginRateLimit) req.loginRateLimit.resetAttempts();

    const token = jwt.sign(
      {
        userId: leader._id,
        leaderId: leader.leaderId,
        role: "leader",
        name: leader.name,
        organizationId: leader.organizationId,
        source
      },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

    logger.info(`✅ Leader login exitoso [${source}]`, { user: email || username, source });

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

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: `La contraseña no cumple los requisitos: ${validation.errors.join(', ')}`,
        requirements: getPasswordRequirements()
      });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return res.status(404).json({ error: "Usuario no encontrado" });

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
    if (adminUser.role !== 'admin') {
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
    const tempPassword = customPassword && customPassword.trim() ? customPassword.trim() : generateTemporaryPassword();
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    leader.passwordHash = passwordHash;
    leader.isTemporaryPassword = true;
    leader.passwordResetRequested = false; // Clear the request flag
    leader.tempPasswordPlaintext = encrypt(tempPassword);
    await leader.save();

    // Send email with temporary password
    let emailSent = false;
    if (leader.email) {
      try {
        const emailResult = await emailService.sendTemporaryPasswordEmail(leader, tempPassword);
        emailSent = emailResult.success;
        
        if (emailSent) {
          logger.info(`📧 Email de contraseña temporal enviado a ${leader.email}`);
        } else {
          logger.warn(`⚠️ Error enviando email: ${emailResult.error}`);
        }
      } catch (emailError) {
        logger.error(`❌ Error en envío de email: ${emailError.message}`);
      }
    }

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), adminUser, {}, `Admin restableció contraseña de ${leader.name}`);

    res.json({ 
      success: true,
      message: "Contraseña restablecida", 
      emailSent,
      _tempPassword: tempPassword, 
      _username: leader.username || '' 
    });
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

    if (!leader.email) {
      return res.status(400).json({ error: "El líder no tiene email configurado. Contacta al administrador." });
    }

    // Generar contraseña temporal automáticamente
    const tempPassword = generateTemporaryPassword();
    const salt = await bcryptjs.genSalt(10);
    const passwordHash = await bcryptjs.hash(tempPassword, salt);

    // Actualizar el líder con la nueva contraseña temporal
    await Leader.updateOne({ _id: leader._id }, {
      $set: {
        passwordHash,
        isTemporaryPassword: true,
        passwordResetRequested: true,
        passwordCanBeChanged: true,
        tempPasswordPlaintext: encrypt(tempPassword)
      }
    });

    // Enviar email con la contraseña temporal
    try {
      const emailResult = await emailService.sendTemporaryPasswordEmail(leader, tempPassword);
      
      if (emailResult.success) {
        logger.info(`📧 Email de restablecimiento enviado a ${leader.email}`);
        
        await AuditService.log("PASSWORD_RESET_AUTO", "Leader", leader._id.toString(), 
          { role: 'system', username: 'auto-reset' }, 
          {}, 
          `Contraseña temporal generada automáticamente por solicitud del líder`
        );
        
        res.json({ 
          success: true,
          message: `Se ha enviado una contraseña temporal a tu correo ${leader.email}. Revisa tu bandeja de entrada.`,
          emailSent: true
        });
      } else {
        logger.warn(`⚠️ Error enviando email: ${emailResult.error}`);
        res.json({
          success: true,
          message: `Contraseña temporal generada, pero hubo un problema enviando el email. Contacta al administrador.`,
          emailSent: false,
          tempPassword: tempPassword // Solo en caso de fallo del correo
        });
      }
    } catch (emailError) {
      logger.error(`❌ Error en envío de email: ${emailError.message}`);
      res.json({
        success: true,
        message: `Contraseña temporal generada. Por favor contacta al administrador para obtenerla.`,
        emailSent: false
      });
    }
  } catch (error) {
    logger.error("Request password reset error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al solicitar reset de contraseña" });
  }
}

// Admin genera nueva contraseña temporal para líder que la solicitó
export async function adminGenerateNewPassword(req, res) {
  try {
    const { leaderId } = req.body;
    const adminUser = req.user;

    if (adminUser.role !== 'admin') {
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

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({ 
        error: `La contraseña no cumple los requisitos: ${validation.errors.join(', ')}`,
        requirements: getPasswordRequirements()
      });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return res.status(404).json({ error: "Usuario no encontrado" });

    if (!leader.passwordCanBeChanged && !leader.isTemporaryPassword) {
      return res.status(403).json({ 
        error: "No puedes cambiar tu contraseña. Solicita un reset al administrador." 
      });
    }

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

// ==================== HELPER FUNCTIONS ====================

/**
 * Genera una contraseña temporal segura
 */
function generateTemporaryPassword() {
  const length = 12;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // Asegurar que tenga al menos una mayúscula, minúscula, número y símbolo
  if (!/[A-Z]/.test(password)) password = 'A' + password.substring(1);
  if (!/[a-z]/.test(password)) password = password.substring(0, length-1) + 'a';
  if (!/[0-9]/.test(password)) password = password.substring(0, length-2) + '9' + password.substring(length-1);
  if (!/[!@#$%]/.test(password)) password = password.substring(0, length-3) + '!' + password.substring(length-2);
  
  return password;
}

/**
 * Encripta un texto usando AES-256
 */
function encrypt(text) {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(config.jwtSecret || 'fallback-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Error encriptando:', error.message);
    return text; // Fallback: retornar texto plano si falla encriptación
  }
}

/**
 * Desencripta un texto encriptado con AES-256
 */
function decrypt(encryptedText) {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(config.jwtSecret || 'fallback-key', 'salt', 32);
    
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Error desencriptando:', error.message);
    return encryptedText;
  }
}

export async function logout(req, res) {
  try {
    await AuditService.log("LOGOUT", "User", req.user?.userId || 'unknown', req.user, {}, `Usuario cerró sesión`);
    logger.info(`✅ Logout exitoso`, { userId: req.user?.userId });
    res.json({ message: "Sesión cerrada exitosamente" });
  } catch (error) {
    logger.error("Logout error:", { error: error.message });
    res.json({ message: "Sesión cerrada exitosamente" });
  }
}

export async function acceptLegalTerms(req, res) {
  try {
    const leaderId = req.user?.userId;
    
    if (!leaderId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               'unknown';

    const leader = await Leader.findById(leaderId);
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    leader.hasAcceptedLegalTerms = true;
    leader.legalTermsAcceptedAt = new Date();
    leader.legalTermsAcceptedIp = ip;
    await leader.save();

    const { ConsentLogService } = await import("../services/consentLog.service.js");
    await ConsentLogService.logTermsAccepted(req, leaderId);

    logger.info(`✅ Términos legales aceptados por líder ${leaderId} desde IP ${ip}`);

    res.json({ 
      success: true, 
      message: "Términos aceptados correctamente",
      acceptedAt: leader.legalTermsAcceptedAt
    });
  } catch (error) {
    logger.error("Accept legal terms error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al aceptar términos" });
  }
}

export async function checkLegalTermsStatus(req, res) {
  try {
    const leaderId = req.user?.userId;
    
    if (!leaderId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const leader = await Leader.findById(leaderId).select('hasAcceptedLegalTerms legalTermsAcceptedAt');
    
    res.json({
      hasAccepted: leader?.hasAcceptedLegalTerms || false,
      acceptedAt: leader?.legalTermsAcceptedAt || null
    });
  } catch (error) {
    logger.error("Check legal terms status error:", { error: error.message });
    res.status(500).json({ error: "Error al verificar estado de términos" });
  }
}

export async function logout(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    try {
      await AuditService.log("LOGOUT", user.role === "admin" ? "Admin" : "Leader", user.userId, user, {}, "Logout exitoso");
    } catch (auditError) {
      logger.warn("Audit log error (esperado sin MongoDB):", { error: auditError.message });
    }

    res.json({ success: true, message: "Logout exitoso" });
  } catch (error) {
    logger.error("Logout error:", { error: error.message });
    res.status(500).json({ error: "Error al cerrar sesion" });
  }
}

export async function acceptLegalTerms(req, res) {
  try {
    const leaderId = req.user?.userId;
    
    if (!leaderId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               'unknown';

    const leader = await Leader.findById(leaderId);
    if (!leader) {
      return res.status(404).json({ error: "Líder no encontrado" });
    }

    leader.hasAcceptedLegalTerms = true;
    leader.legalTermsAcceptedAt = new Date();
    leader.legalTermsAcceptedIp = ip;
    await leader.save();

    const { ConsentLogService } = await import("../services/consentLog.service.js");
    await ConsentLogService.logTermsAccepted(req, leaderId);

    logger.info(`✅ Términos legales aceptados por líder ${leaderId} desde IP ${ip}`);

    res.json({ 
      success: true, 
      message: "Términos aceptados correctamente",
      acceptedAt: leader.legalTermsAcceptedAt
    });
  } catch (error) {
    logger.error("Accept legal terms error:", { error: error.message, stack: error.stack });
    res.status(500).json({ error: "Error al aceptar términos" });
  }
}

export async function checkLegalTermsStatus(req, res) {
  try {
    const leaderId = req.user?.userId;
    
    if (!leaderId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const leader = await Leader.findById(leaderId).select('hasAcceptedLegalTerms legalTermsAcceptedAt');
    
    res.json({
      hasAccepted: leader?.hasAcceptedLegalTerms || false,
      acceptedAt: leader?.legalTermsAcceptedAt || null
    });
  } catch (error) {
    logger.error("Check legal terms status error:", { error: error.message });
    res.status(500).json({ error: "Error al verificar estado de términos" });
  }
}
