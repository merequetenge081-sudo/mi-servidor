import "dotenv/config";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { Admin } from "./src/models/Admin.js";
import { Organization } from "./src/models/Organization.js";

async function createAdminUser() {
  try {
    const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/mi-servidor";
    console.log("🔍 Conectando a MongoDB...");
    
    await mongoose.connect(MONGO_URL, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000
    });
    
    console.log("✅ Conectado\n");
    
 // Get or create default organization
    let defaultOrg = await Organization.findOne({ slug: "default" });
    if (!defaultOrg) {
      console.log("❌ Default organization not found, creating...");
      defaultOrg = await Organization.create({
        name: "Default Organization",
        slug: "default",
        description: "Organización por defecto",
        status: "active",
        plan: "pro"
      });
    }
    
    const organizationId = defaultOrg._id.toString();
    console.log(`📚 Using organization: ${organizationId}`);
    
    // Check if admin exists
    let admin = await Admin.findOne({ username: "admin" });
    if (admin) {
      console.log("⚠️  Admin 'admin' already exists, updating...");
      admin.passwordHash = await bcryptjs.hash("admin123", 10);
      admin.organizationId = organizationId;
      await admin.save();
    } else {
      console.log("➕ Creating new admin 'admin'...");
      const passwordHash = await bcryptjs.hash("admin123", 10);
      admin = await Admin.create({
        username: "admin",
        passwordHash,
        email: "admin@example.com",
        organizationId: organizationId,
        role: "admin"
      });
    }
    
    console.log(`✅ Admin created/updated: ${admin.username}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   organizationId: ${admin.organizationId}`);
    console.log("\n✨ Puedes usar: admin / admin123");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdminUser();
