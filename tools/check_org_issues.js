import "dotenv/config";
import mongoose from "mongoose";
import { Registration } from "./src/models/Registration.js";
import { Leader } from "./src/models/Leader.js";
import { Organization } from "./src/models/Organization.js";

async function checkOrgIssues() {
  try {
    const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";
    console.log("🔍 Conectando a MongoDB...");
    
    await mongoose.connect(MONGO_URL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    
    console.log("✅ Conectado\n");
    
    // Get all organizations
    const orgs = await Organization.find().select("_id name slug");
    console.log("📚 ORGANIZACIONES EN LA BD:");
    orgs.forEach(org => console.log(`  - ${org._id}: ${org.name} (${org.slug})`));
    
    // Check registrations by organization
    console.log("\n📋 REGISTROS POR ORGANIZACIÓN:");
    for (const org of orgs) {
      const count = await Registration.countDocuments({ organizationId: org._id });
      console.log(`  - ${org.name}: ${count} registros`);
    }
    
    // Check if there are registrations without organizationId
    const noOrgCount = await Registration.countDocuments({ $or: [
      { organizationId: { $exists: false } },
      { organizationId: null }
    ]});
    if (noOrgCount > 0) {
      console.log(`  - SIN organizationId: ${noOrgCount} registros`);
    }
    
    // Check leaders by organization
    console.log("\n👥 LÍDERES POR ORGANIZACIÓN:");
    for (const org of orgs) {
      const count = await Leader.countDocuments({ organizationId: org._id });
      console.log(`  - ${org.name}: ${count} líderes`);
    }
    
    // Get organizationId from first registration
    const firstReg = await Registration.findOne().select("organizationId");
    console.log(`\n🔑 PROBLEMA: Primera organizacionId encontrada en registro:`, firstReg?.organizationId);
    
    // Get organizationId from first leader
    const firstLeader = await Leader.findOne().select("organizationId");
    console.log(`🔑 PROBLEMA: Primera organizacionId encontrada en líder:`, firstLeader?.organizationId);
    
    // Check if all registrations have the SAME organizationId
    const uniqueOrgIds = await Registration.distinct("organizationId");
    console.log(`\n📊 ORGANIZATIONIDS ÚNICOS EN REGISTOS: ${uniqueOrgIds.length}`);
    uniqueOrgIds.forEach(id => console.log(`  - ${id}`));
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkOrgIssues();
