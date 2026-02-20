#!/usr/bin/env node
/**
 * Script de migración: data.json -> MongoDB
 * Uso: node migrate-data-to-db.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";

// Esquemas
const LeaderSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  name: String,
  email: String,
  phone: String,
  area: String,
  active: { type: Boolean, default: true },
  token: String,
  eventId: { type: String, default: "" },
  registrations: { type: Number, default: 0 },
  passwordHash: { type: String, default: "" }
});

const RegistrationSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  leaderId: String,
  leaderName: String,
  eventId: { type: String, default: "" },
  firstName: String,
  lastName: String,
  cedula: String,
  email: String,
  phone: String,
  localidad: { type: String, default: "" },
  registeredToVote: { type: Boolean, default: false },
  votingPlace: { type: String, default: "" },
  votingTable: { type: String, default: "" },
  date: String,
  confirmed: { type: Boolean, default: false },
  confirmedBy: { type: String, default: "" },
  confirmedAt: { type: Date, default: null },
  notifications: {
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    whatsappSent: { type: Boolean, default: false }
  }
});

const Leader = mongoose.model("Leader", LeaderSchema);
const Registration = mongoose.model("Registration", RegistrationSchema);

async function migrate() {
  try {
    console.log("🔄 Iniciando migración...");
    
    // Conectar a MongoDB
    await mongoose.connect(MONGO_URL);
    console.log("✓ Conectado a MongoDB");

    // Leer data.json
    const dataPath = path.join(__dirname, "data.json");
    if (!fs.existsSync(dataPath)) {
      console.error("❌ No se encontró data.json");
      process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(rawData);

    // Migrar líderes
    console.log("\n📋 Migrando líderes...");
    let leaderCount = 0;
    for (const leader of data.leaders || []) {
      const leaderId = new mongoose.Types.ObjectId();
      
      const newLeader = new Leader({
        _id: leaderId,
        name: leader.name,
        email: leader.email,
        phone: leader.phone,
        area: leader.area,
        active: leader.isActive ?? true,
        token: leader.token || `leader-${leaderId}`,
        registrations: leader.registrations || 0
      });

      await newLeader.save();
      leaderCount++;
      console.log(`  ✓ Líder creado: ${leader.name} (ID: ${leaderId})`);
    }
    console.log(`\n✅ ${leaderCount} líderes migrados exitosamente`);

    // Migrar registros
    console.log("\n📝 Migrando registros...");
    let registrationCount = 0;
    
    // Obtener mapeo de IDs antiguos a nuevos
    const leaders = await Leader.find();
    const leaderIdMap = {};
    for (const leader of leaders) {
      const oldId = data.leaders.find(l => l.email === leader.email)?.id;
      if (oldId) {
        leaderIdMap[oldId] = leader._id.toString();
      }
    }

    for (const reg of data.registrations || []) {
      const registrationId = new mongoose.Types.ObjectId();
      const newLeaderId = leaderIdMap[reg.leaderId] || reg.leaderId;

      const newReg = new Registration({
        _id: registrationId,
        leaderId: newLeaderId,
        leaderName: reg.leaderName,
        firstName: reg.firstName,
        lastName: reg.lastName,
        cedula: reg.cedula,
        email: reg.email,
        phone: reg.phone,
        date: reg.date,
        notifications: {
          whatsappSent: reg.whatsappSent || false
        }
      });

      await newReg.save();
      registrationCount++;
      console.log(`  ✓ Registro creado: ${reg.firstName} ${reg.lastName}`);
    }
    console.log(`\n✅ ${registrationCount} registros migrados exitosamente`);

    // Resumen
    console.log("\n" + "=".repeat(50));
    console.log("✅ MIGRACIÓN COMPLETADA EXITOSAMENTE");
    console.log("=".repeat(50));
    console.log(`Líderes: ${leaderCount}`);
    console.log(`Registros: ${registrationCount}`);
    console.log("=".repeat(50));

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en migración:", error);
    process.exit(1);
  }
}

migrate();
