import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { Leader } from "../models/Leader.js";
import { AuditService } from "../services/audit.service.js";
import { emailService } from "../services/emailService.js";
import {
  buildTemporaryPasswordState,
  handleInvalidCredentials,
  hashPassword,
  resetLoginAttempts,
  resolveBaseUrl
} from "../services/authLegacy.service.js";
import { config } from "../config/env.js";
import logger from "../config/logger.js";
import { findLeaderWithFallback } from "../utils/authFallback.js";
import { validatePassword, getPasswordRequirements } from "../utils/passwordValidator.js";
import { isTempPasswordExpired } from "../utils/tempPassword.js";
import { generateTemporaryPassword } from "../utils/tempPasswordGenerator.js";
import { sendError } from "../utils/httpError.js";

export async function leaderLogin(req, res) {
  try {
    const { email, username, password } = req.body;

    if ((!email && !username) || !password) {
      return sendError(res, 400, "Usuario/Email y password requeridos");
    }

    const query = email ? { email } : { username };

    let leader = await Leader.findOne(query);
    let source = "mongodb";

    if (!leader && email) {
      const result = await findLeaderWithFallback(Leader, email);
      leader = result.data;
      source = result.source;
    }

    if (!leader || !leader.passwordHash) {
      return handleInvalidCredentials(req, res);
    }

    const isValid = await bcryptjs.compare(password, leader.passwordHash);
    if (!isValid) {
      return handleInvalidCredentials(req, res);
    }

    if (leader.isTemporaryPassword && isTempPasswordExpired(leader)) {
      await Leader.updateOne(
        { _id: leader._id },
        { $unset: { tempPasswordPlaintext: "", tempPasswordCreatedAt: "" } }
      );
      return sendError(res, 403, "Contraseña temporal expirada. Solicita un reset.");
    }

    if (!leader.active) {
      return sendError(res, 403, "Cuenta inactiva. Contacte al administrador.");
    }

    resetLoginAttempts(req);

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

    return res.json({
      token,
      source,
      leaderId: leader.leaderId || leader._id.toString(),
      requirePasswordChange: leader.isTemporaryPassword || false,
      username: leader.username || leader.name
    });
  } catch (error) {
    logger.error("Leader login error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al iniciar sesión");
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const leaderId = req.user.userId;

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({
        error: `La contraseña no cumple los requisitos: ${validation.errors.join(", ")}`,
        requirements: getPasswordRequirements()
      });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return sendError(res, 404, "Usuario no encontrado");

    if (currentPassword) {
      const isValid = await bcryptjs.compare(currentPassword, leader.passwordHash);
      if (!isValid) return sendError(res, 401, "Contraseña actual incorrecta");
    } else if (!leader.isTemporaryPassword) {
      return sendError(res, 400, "Se requiere la contraseña actual");
    }

    const newHash = await hashPassword(newPassword);
    await Leader.updateOne({ _id: leader._id }, {
      $set: {
        passwordHash: newHash,
        isTemporaryPassword: false
      },
      $unset: {
        tempPasswordPlaintext: "",
        tempPasswordCreatedAt: ""
      }
    });

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), req.user, {}, "Cambio de contraseña exitoso");

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    logger.error("Change password error:", { error: error.message });
    return sendError(res, 500, "Error al cambiar contraseña");
  }
}

export async function leaderLoginById(req, res) {
  try {
    const { leaderId } = req.body;

    if (!leaderId) {
      return sendError(res, 400, "LeaderId requerido");
    }

    logger.debug("Leader login attempt", { leaderId });

    let query = { leaderId };
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
      const leaders = [
        { _id: "leader-001", leaderId: "L001", name: "Líder Prueba", cedula: "1000000001" },
        { _id: "leader-002", leaderId: "L002", name: "Segundo Líder", cedula: "1000000002" }
      ];
      leader = leaders.find((l) => l.leaderId === leaderId || l._id === leaderId);
      if (leader) source = "memory";
    }

    if (!leader) {
      return sendError(res, 401, "Líder no encontrado");
    }

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

    try {
      await AuditService.log("LOGIN", "Leader", leader._id.toString(), { leaderId: leader.leaderId, role: "leader", source }, {}, `Líder ${leader.name} inició sesión`);
    } catch (auditError) {
      logger.warn("Audit log error (esperado sin MongoDB):", { error: auditError.message });
    }

    logger.info(`✅ Leader login exitoso [${source}]`, { leaderId, source });
    return res.json({ token, source });
  } catch (error) {
    logger.error("Leader login error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al iniciar sesión");
  }
}

export async function requestPasswordReset(req, res) {
  try {
    const { leaderId, username, email } = req.body;

    if (!leaderId && !username && !email) {
      return sendError(res, 400, "Se requiere leaderId, username o email");
    }

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
      return sendError(res, 404, "Líder no encontrado");
    }

    if (!leader.email) {
      return sendError(res, 400, "El líder no tiene email configurado. Contacta al administrador.");
    }

    const tempPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(tempPassword);

    await Leader.updateOne(
      { _id: leader._id },
      {
        $set: buildTemporaryPasswordState(tempPassword, passwordHash, { passwordResetRequested: true })
      }
    );

    try {
      const baseUrl = resolveBaseUrl(req);
      const emailResult = await emailService.sendTemporaryPasswordEmail(leader, tempPassword, baseUrl);

      if (emailResult.success) {
        logger.info(`📧 Email de restablecimiento enviado a ${leader.email}`);

        await AuditService.log(
          "PASSWORD_RESET_AUTO",
          "Leader",
          leader._id.toString(),
          { role: "system", username: "auto-reset" },
          {},
          "Contraseña temporal generada automáticamente por solicitud del líder"
        );

        return res.json({
          success: true,
          message: `Se ha enviado una contraseña temporal a tu correo ${leader.email}. Revisa tu bandeja de entrada.`,
          emailSent: true
        });
      }

      logger.warn(`⚠️ Error enviando email: ${emailResult.error}`);
      return res.json({
        success: true,
        message: "Contraseña temporal generada, pero hubo un problema enviando el email. Contacta al administrador.",
        emailSent: false,
        tempPassword
      });
    } catch (emailError) {
      logger.error(`❌ Error en envío de email: ${emailError.message}`);
      return res.json({
        success: true,
        message: "Contraseña temporal generada. Por favor contacta al administrador para obtenerla.",
        emailSent: false
      });
    }
  } catch (error) {
    logger.error("Request password reset error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al solicitar reset de contraseña");
  }
}

export async function leaderChangePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const leaderId = req.user.userId;

    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      return res.status(400).json({
        error: `La contraseña no cumple los requisitos: ${validation.errors.join(", ")}`,
        requirements: getPasswordRequirements()
      });
    }

    const leader = await Leader.findById(leaderId);
    if (!leader) return sendError(res, 404, "Usuario no encontrado");

    if (!leader.passwordCanBeChanged && !leader.isTemporaryPassword) {
      return res.status(403).json({
        error: "No puedes cambiar tu contraseña. Solicita un reset al administrador."
      });
    }

    if (currentPassword) {
      const isValid = await bcryptjs.compare(currentPassword, leader.passwordHash);
      if (!isValid) return sendError(res, 401, "Contraseña actual incorrecta");
    } else if (!leader.isTemporaryPassword) {
      return sendError(res, 400, "Se requiere la contraseña actual");
    }

    const newHash = await hashPassword(newPassword);

    await Leader.updateOne(
      { _id: leader._id },
      {
        $set: {
          passwordHash: newHash,
          isTemporaryPassword: false,
          passwordCanBeChanged: false,
          passwordResetRequested: false
        },
        $unset: {
          tempPasswordPlaintext: "",
          tempPasswordCreatedAt: ""
        }
      }
    );

    await AuditService.log("UPDATE", "Leader", leader._id.toString(), req.user, {}, `Líder ${leader.name} cambió su contraseña`);

    return res.json({ message: "Contraseña actualizada correctamente. No podrás cambiarla nuevamente sin solicitar un reset." });
  } catch (error) {
    logger.error("Leader change password error:", { error: error.message });
    return sendError(res, 500, "Error al cambiar contraseña");
  }
}

export async function acceptLegalTerms(req, res) {
  try {
    const leaderId = req.user?.userId;

    if (!leaderId) {
      return sendError(res, 401, "No autenticado");
    }

    const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim()
      || req.headers["x-real-ip"]
      || req.connection?.remoteAddress
      || "unknown";

    const leader = await Leader.findById(leaderId);
    if (!leader) {
      return sendError(res, 404, "Líder no encontrado");
    }

    leader.hasAcceptedLegalTerms = true;
    leader.legalTermsAcceptedAt = new Date();
    leader.legalTermsAcceptedIp = ip;
    await leader.save();

    const { ConsentLogService } = await import("../services/consentLog.service.js");
    await ConsentLogService.logTermsAccepted(req, leaderId);

    logger.info(`✅ Términos legales aceptados por líder ${leaderId} desde IP ${ip}`);

    return res.json({
      success: true,
      message: "Términos aceptados correctamente",
      acceptedAt: leader.legalTermsAcceptedAt
    });
  } catch (error) {
    logger.error("Accept legal terms error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error al aceptar términos");
  }
}

export async function checkLegalTermsStatus(req, res) {
  try {
    const leaderId = req.user?.userId;

    if (!leaderId) {
      return sendError(res, 401, "No autenticado");
    }

    const leader = await Leader.findById(leaderId).select("hasAcceptedLegalTerms legalTermsAcceptedAt");

    return res.json({
      hasAccepted: leader?.hasAcceptedLegalTerms || false,
      acceptedAt: leader?.legalTermsAcceptedAt || null
    });
  } catch (error) {
    logger.error("Check legal terms status error:", { error: error.message });
    return sendError(res, 500, "Error al verificar estado de términos");
  }
}
