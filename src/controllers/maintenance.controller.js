import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import bcryptjs from "bcryptjs";
import { Leader } from "../models/Leader.js";
import { Registration } from "../models/Registration.js";
import { Organization } from "../models/Organization.js";
import logger from "../config/logger.js";
import { encrypt } from "../utils/crypto.js";
import { generateTemporaryPassword } from "../utils/tempPasswordGenerator.js";
import { sendError } from "../utils/httpError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const normalizeUsernameToken = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export async function migrateDataHandler(req, res) {
  if (process.env.NODE_ENV === "production") {
    return sendError(res, 403, "Endpoint not available in production");
  }

  try {
    const dataPath = path.join(__dirname, "../../data.json");
    if (!fs.existsSync(dataPath)) {
      return sendError(res, 404, "data.json no encontrado");
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(rawData);

    const cleanExisting = req.body.clean === true;
    if (cleanExisting) {
      await Leader.deleteMany({});
      await Registration.deleteMany({});
      logger.info("Datos limpios antes de migración");
    }

    let defaultOrg = await Organization.findOne({ slug: "default" });
    if (!defaultOrg) {
      defaultOrg = new Organization({
        name: "Default Organization",
        slug: "default",
        description: "Organización por defecto para datos migrables",
        status: "active",
        plan: "pro"
      });
      await defaultOrg.save();
      logger.info("Organización default creada");
    }

    const orgId = defaultOrg._id.toString();
    let leaderCount = 0;
    let registrationCount = 0;
    const leaderIdMap = {};

    for (const leader of data.leaders || []) {
      const existing = await Leader.findOne({ email: leader.email, organizationId: orgId });
      if (existing) {
        leaderIdMap[leader.id] = existing._id.toString();
        continue;
      }

      const newLeader = new Leader({
        leaderId: `leader-${crypto.randomUUID()}`,
        name: leader.name,
        email: leader.email,
        phone: leader.phone,
        area: leader.area,
        active: leader.isActive ?? true,
        token: leader.token || crypto.randomUUID(),
        registrations: leader.registrations || 0,
        organizationId: orgId
      });

      const saved = await newLeader.save();
      leaderIdMap[leader.id] = saved._id.toString();
      leaderCount++;
      logger.info(`Líder creado: ${leader.name}`);
    }

    for (const reg of data.registrations || []) {
      const existing = await Registration.findOne({
        email: reg.email,
        cedula: reg.cedula,
        organizationId: orgId
      });
      if (existing) continue;

      const newReg = new Registration({
        leaderId: leaderIdMap[reg.leaderId] || reg.leaderId,
        leaderName: reg.leaderName,
        eventId: "",
        firstName: reg.firstName,
        lastName: reg.lastName,
        cedula: reg.cedula,
        email: reg.email,
        phone: reg.phone,
        date: reg.date || new Date().toISOString().split("T")[0],
        notifications: {
          whatsappSent: reg.whatsappSent || false
        },
        organizationId: orgId
      });

      await newReg.save();
      registrationCount++;
      logger.info(`Registro creado: ${reg.firstName} ${reg.lastName}`);
    }

    logger.info(`Migración completada: ${leaderCount} líderes, ${registrationCount} registros`);

    return res.json({
      success: true,
      message: "Migración completada exitosamente",
      stats: {
        leadersCreated: leaderCount,
        registrationsCreated: registrationCount,
        organizationId: orgId
      }
    });
  } catch (error) {
    logger.error("Error en migración:", error);
    return sendError(res, 500, "Error en migración", "MIGRATE_DATA_ERROR", error.message);
  }
}

export async function migrateUsernamesHandler(req, res) {
  try {
    const leaders = await Leader.find({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: "" },
        { isTemporaryPassword: true },
        { passwordCanBeChanged: true }
      ]
    });

    if (leaders.length === 0) {
      return res.json({ message: "Todos los líderes ya tienen usuario asignado.", migrated: 0, results: [] });
    }

    const results = [];
    const usedInBatch = new Set(leaders.map((leader) => leader.username).filter(Boolean));

    for (const leader of leaders) {
      let username = leader.username;
      if (!username) {
        const cleanName = (leader.name || "usuario desconocido").trim().split(/\s+/);
        const firstName = cleanName[0] || "user";
        const lastName = cleanName.length > 1 ? cleanName[1] : "leader";

        let baseUsername = normalizeUsernameToken(firstName.charAt(0) + lastName);
        if (!baseUsername) baseUsername = "user";
        username = baseUsername;

        let counter = 1;
        while ((await Leader.findOne({ username })) || usedInBatch.has(username)) {
          counter++;
          username = `${baseUsername}${counter}`;
        }
      }
      usedInBatch.add(username);

      const tempPassword = generateTemporaryPassword();
      const passwordHash = await bcryptjs.hash(tempPassword, 10);

      await Leader.updateOne(
        { _id: leader._id },
        {
          $set: {
            username,
            passwordHash,
            isTemporaryPassword: true,
            passwordCanBeChanged: true,
            passwordResetRequested: false,
            tempPasswordPlaintext: encrypt(tempPassword),
            tempPasswordCreatedAt: new Date()
          }
        }
      );

      results.push({
        _id: leader._id,
        name: leader.name,
        email: leader.email || null,
        username,
        tempPassword
      });

      logger.info(`[MIGRATION] ${leader.name} -> ${username}`);
    }

    logger.info(`[MIGRATION] Migrados ${results.length} líderes (credenciales entregadas vía API)`);

    return res.json({
      message: `${results.length} líderes migrados exitosamente`,
      migrated: results.length,
      results
    });
  } catch (error) {
    logger.error("Migration error:", { error: error.message, stack: error.stack });
    return sendError(res, 500, "Error en migración", "MIGRATE_USERNAMES_ERROR", error.message);
  }
}
