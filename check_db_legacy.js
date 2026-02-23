import "dotenv/config";
import mongoose from "mongoose";
import { Registration } from "./src/models/Registration.js";
import { Leader } from "./src/models/Leader.js";
import { Organization } from "./src/models/Organization.js";

async function checkDB() {
  try {
    const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";
    console.log("🔍 Conectando a MongoDB:", MONGO_URL);
    
    await mongoose.connect(MONGO_URL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    
    console.log("✅ Conectado a MongoDB");
    
    // Check organizations
    const orgs = await Organization.countDocuments();
    console.log(`📊 Organizaciones: ${orgs}`);
    
    const defaultOrg = await Organization.findOne({ slug: "default" });
    console.log(`📊 Org Default ID: ${defaultOrg?._id || "NO EXISTE"}`);
    
    // Check leaders
    const leaders = await Leader.countDocuments();
    console.log(`👥 Líderes totales: ${leaders}`);
    
    const leadersWithOrg = await Leader.countDocuments({ organizationId: { $exists: true, $ne: null } });
    console.log(`👥 Líderes con organizationId: ${leadersWithOrg}`);
    
    const leadersWithoutOrg = await Leader.countDocuments({ $or: [{ organizationId: { $exists: false } }, { organizationId: null }] });
    console.log(`⚠️  Líderes SIN organizationId: ${leadersWithoutOrg}`);
    
    // Check registrations
    const regs = await Registration.countDocuments();
    console.log(`📋 Registros totales: ${regs}`);
    
    const regsWithOrg = await Registration.countDocuments({ organizationId: { $exists: true, $ne: null } });
    console.log(`📋 Registros con organizationId: ${regsWithOrg}`);
    
    const regsWithoutOrg = await Registration.countDocuments({ $or: [{ organizationId: { $exists: false } }, { organizationId: null }] });
    console.log(`⚠️  Registros SIN organizationId: ${regsWithoutOrg}`);
    
    if (regs > 0 && regsWithoutOrg > 0) {
      console.log("\n🚨 PROBLEMA ENCONTRADO: Hay registros sin organizationId");
      console.log("   Esto puede causar que la API no retorne datos");
    }
    
    if (regs > 0 && leaders > 0) {
      console.log("\n✅ Hay datos en la BD");
      console.log("   El problema es probablemente organizationId faltante");
    }
    
    if (regs === 0) {
      console.log("\n⚠️  NO HAY REGISTROS EN LA BD");
    }
    
    if (leaders === 0) {
      console.log("\n⚠️  NO HAY LÍDERES EN LA BD");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkDB();
