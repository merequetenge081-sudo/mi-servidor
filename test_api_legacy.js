import "dotenv/config";
import { config } from "./src/config/env.js";

async function testAPI() {
  const BASE_URL = "http://localhost:3000";
  
  try {
    console.log("🔐 Intentando login como admin...");
    
    // Get test credentials
    const credsRes = await fetch(`${BASE_URL}/api/test-credentials`);
    const creds = await credsRes.json();
    console.log("📋 Credenciales:", JSON.stringify(creds, null, 2).substring(0, 200));
    
    const adminCreds = creds.admins?.[0] || creds.admin;
    console.log("🔑 Admin found:", adminCreds?.username);
    
    // Login
    const loginRes = await fetch(`${BASE_URL}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: adminCreds?.username || "admin",
        password: adminCreds?.password || "admin123"
      })
    });
    
    const loginData = await loginRes.json();
    console.log("Login response status:", loginRes.status);
    console.log("Login response:", loginData);
    
    if (!loginRes.ok) {
      console.error("❌ Login falló");
      return;
    }
    
    const token = loginData.token;
    console.log("✅ Login exitoso, token:", token.substring(0, 20) + "...");
    
    // Get registrations
    console.log("\n📋 Obteniendo registros...");
    const regsRes = await fetch(`${BASE_URL}/api/registrations?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Registrations response status:", regsRes.status);
    const regsData = await regsRes.json();
    console.log("Registrations response:", JSON.stringify(regsData, null, 2).substring(0, 500));
    
    if (regsData.data) {
      console.log(`\n✅ Registros retornados: ${regsData.data.length}`);
      console.log(`📊 Total en BD: ${regsData.total}`);
    } else {
      console.log("\n❌ No hay datos en la respuesta");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testAPI();
