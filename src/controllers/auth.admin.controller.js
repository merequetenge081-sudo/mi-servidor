import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";
import { Organization } from "../models/Organization.js";
import { AuditService } from "../services/audit.service.js";
import { emailService } from "../services/emailService.js";
import {
  buildTemporaryPasswordState,
  handleInvalidCredentials,
  hashPassword,
  resolveBaseUrl
} from "../services/authLegacy.service.js";
import { sendError } from "../utils/httpError.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";
import { findAdminWithFallback } from "../utils/authFallback.js";
import { generateTemporaryPassword } from "../utils/tempPasswordGenerator.js";

export async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return sendError(res, 400, "Username y password requeridos");
    }
    const { data: admin, source } = await findAdminWithFallback(Admin, username);

    if (!admin) {
      return handleInvalidCredentials(req, res);
    }

    const isValid = await bcryptjs.compare(password, admin.passwordHash);
    if (!isValid) {
      return handleInvalidCredentials(req, res);
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
        organizationId,
        source
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
    return res.json({ token, source });
  } catch (error) {
    logger.error("Admin login error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al iniciar sesión");
  }
}

export async function adminResetPassword(req, res) {
  try {
    const { leaderId, newUsername, newPassword: customPassword } = req.body;
    const adminUser = req.user;

    if (adminUser.role !== "admin") {
      return sendError(res, 403, "No autorizado");
    }

    const leader = await Leader.findById(leaderId || req.params.id);
    if (!leader) return sendError(res, 404, "Líder no encontrado");

    if (newUsername && newUsername.trim()) {
      const cleanUsername = newUsername.trim().toLowerCase();
      const existing = await Leader.findOne({ username: cleanUsername, _id: { $ne: leader._id } });
      if (existing) {
        return sendError(res, 400, `El usuario "${cleanUsername}" ya existe`);
      }
      leader.username = cleanUsername;
    }

    const tempPassword = customPassword && customPassword.trim() ? customPassword.trim() : generateTemporaryPassword();
    const passwordHash = await bcryptjs.hash(tempPassword, 10);

    Object.assign(leader, buildTemporaryPasswordState(tempPassword, passwordHash, { passwordResetRequested: false }));
    await leader.save();

    let emailSent = false;
    if (leader.email) {
      try {
        const baseUrl = resolveBaseUrl(req);
        const emailResult = await emailService.sendTemporaryPasswordEmail(leader, tempPassword, baseUrl);
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

    return res.json({
      success: true,
      message: "Contraseña restablecida",
      emailSent,
      _tempPassword: tempPassword,
      _username: leader.username || ""
    });
  } catch (error) {
    logger.error("Admin reset password error:", { error: error.message });
    return sendError(res, 500, "Error al restablecer contraseña");
  }
}

export async function adminGenerateNewPassword(req, res) {
  try {
    const { leaderId } = req.body;
    const adminUser = req.user;

    if (adminUser.role !== "admin") {
      return sendError(res, 403, "No autorizado");
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return sendError(res, 404, "Líder no encontrado");

    if (!leader.passwordResetRequested) {
      return sendError(res, 400, "El líder no ha solicitado un reset de contraseña");
    }

    const tempPassword = generateTemporaryPassword();
    const newHash = await hashPassword(tempPassword);

    await Leader.updateOne({ _id: leader._id }, {
      $set: buildTemporaryPasswordState(tempPassword, newHash, { passwordResetRequested: false })
    });

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), adminUser, {}, `Admin generó nueva contraseña temporal para ${leader.name}`);

    logger.info(`Nueva contraseña temporal generada para ${leader.name}`);

    return res.json({
      message: "Nueva contraseña generada",
      tempPassword,
      username: leader.username || leader.name
    });
  } catch (error) {
    logger.error("Admin generate new password error:", { error: error.message });
    return sendError(res, 500, "Error al generar nueva contraseña");
  }
}

export async function logout(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return sendError(res, 401, "No autenticado");
    }

    try {
      await AuditService.log("LOGOUT", user.role === "admin" ? "Admin" : "Leader", user.userId, user, {}, "Logout exitoso");
    } catch (auditError) {
      logger.warn("Audit log error (esperado sin MongoDB):", { error: auditError.message });
    }

    return res.json({ success: true, message: "Logout exitoso" });
  } catch (error) {
    logger.error("Logout error:", { error: error.message });
    return sendError(res, 500, "Error al cerrar sesion");
  }
}
