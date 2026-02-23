import "dotenv/config";
import jwt from "jsonwebtoken";
import { config } from "./src/config/env.js";

async function testAdminLogin() {
  const BASE_URL = "http://localhost:3000";
  
  try {
    console.log("🔐 Intentando login como admin...");
    
    const loginRes = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: "admin",
        password: "admin123"
      })
    });
    
    console.log("Login response status:", loginRes.status);
    const loginData = await loginRes.json();
    
    if (!loginRes.ok) {
      console.error("❌ Login failed:", loginData);
      return;
    }
    
    console.log("✅ Login successful");
    const token = loginData.token;
    console.log("Token:", token.substring(0, 50) + "...");
    
    // Decode token manually (without verification for inspection)
    const parts = token.split('.');
    const decodedHeader = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    console.log("\n📋 TOKEN DECODIFICADO:");
    console.log(JSON.stringify(decodedPayload, null, 2));
    
    // Check organizationId
    if (decodedPayload.organizationId) {
      console.log(`\n✅ organizationId EN TOKEN: ${decodedPayload.organizationId}`);
    } else {
      console.log("\n❌ SIN organizationId EN TOKEN");
    }
    
    // Try to get registrations with this token
    console.log("\n📊 Intentando obtener registrations con el token...");
    const regsRes = await fetch(`${BASE_URL}/api/registrations?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Registrations response status:", regsRes.status);
    const regsData = await regsRes.json();
    
    if (regsData.data) {
      console.log(`\n✅ Registros retornados: ${regsData.data.length}`);
      console.log(`📊 Total en BD: ${regsData.total}`);
      if (regsData.data.length > 0) {
        console.log(`First registration organizationId: ${regsData.data[0].organizationId}`);
      }
    } else {
      console.log("\n❌ Error:", regsData.error);
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testAdminLogin();
