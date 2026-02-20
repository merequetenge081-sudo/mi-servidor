/**
 * Script para acceder al Control Center Secreto
 * Uso: node test-control-center.js [email] [password] [devKey] [serverUrl]
 */

const fs = require("fs");
const path = require("path");

// Parámetros por defecto
const args = process.argv.slice(2);
const email = args[0] || "admin@example.com";
const password = args[1] || "admin123456";
const devKey = args[2] || process.env.DEV_SECRET_KEY || "your_super_secret_control_center_key_change_in_production_2024";
const serverUrl = args[3] || "http://localhost:3000";

console.log("\n=====================================");
console.log("Control Center Secreto - Test Script");
console.log("=====================================\n");

// ==================== PASO 1: LOGIN ====================
async function testLogin() {
  console.log(`[1/4] Intentando login como: ${email}`);

  try {
    const response = await fetch(`${serverUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    if (!data.token) {
      throw new Error("No token recibido en la respuesta");
    }

    console.log("✓ Login exitoso");
    console.log(`  Token: ${data.token.substring(0, 50)}...`);
    console.log(`  Role: ${data.role || "N/A"}`);
    console.log("");

    return data.token;
  } catch (error) {
    console.error(`✗ Error en login: ${error.message}`);
    process.exit(1);
  }
}

// ==================== PASO 2: ACCEDER AL CONTROL CENTER ====================
async function testControlCenter(token) {
  console.log(`[2/4] Accediendo a /internal/control-center`);

  try {
    const response = await fetch(`${serverUrl}/internal/control-center`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-dev-key": devKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    console.log("✓ Acceso exitoso al Control Center");
    console.log(`  Status: ${data.status}`);
    console.log(`  Usuario: ${data.accessedBy.email}`);
    console.log(`  IP acceso: ${data.accessIP}`);
    console.log("");

    console.log("  Sistema:");
    console.log(`    - Node Version: ${data.system.nodeVersion}`);
    console.log(`    - Entorno: ${data.system.environment}`);
    console.log(`    - Uptime: ${data.system.uptime}s`);
    console.log(`    - Memory Heap: ${data.system.memoryUsage.heapUsed} / ${data.system.memoryUsage.heapTotal}`);
    console.log("");

    console.log("  Features:");
    console.log(`    - JWT: ${data.system.features.jwt}`);
    console.log(`    - Dev Mode: ${data.system.features.devMode}`);
    console.log(`    - Email Service: ${data.system.features.emailService}`);
    console.log("");
  } catch (error) {
    console.error(`✗ Error accediendo al Control Center: ${error.message}`);
    process.exit(1);
  }
}

// ==================== PASO 3: OBTENER LOGS ====================
async function testLogs(token) {
  console.log(`[3/4] Obteniendo logs recientes: /internal/control-center/logs`);

  try {
    const response = await fetch(`${serverUrl}/internal/control-center/logs?limit=50`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-dev-key": devKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    console.log("✓ Logs obtenidos exitosamente");
    console.log(`  Mensaje: ${data.message}`);
    console.log(`  Límite: ${data.limit}`);
    console.log("");
  } catch (error) {
    console.error(`✗ Error obteniendo logs: ${error.message}`);
  }
}

// ==================== PASO 4: OBTENER STATS ====================
async function testStats(token) {
  console.log(`[4/4] Obteniendo estadísticas: /internal/control-center/stats`);

  try {
    const response = await fetch(`${serverUrl}/internal/control-center/stats`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "x-dev-key": devKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    console.log("✓ Estadísticas obtenidas exitosamente");
    console.log("");

    console.log("  Server:");
    console.log(`    - Uptime: ${data.server.uptime}`);
    console.log(`    - PID: ${data.server.pid}`);
    console.log(`    - Node Version: ${data.server.nodeVersion}`);
    console.log("");

    console.log("  Memoria:");
    console.log(`    - Heap Used: ${data.memory.heapUsed} MB`);
    console.log(`    - Heap Total: ${data.memory.heapTotal} MB`);
    console.log(`    - External: ${data.memory.external} MB`);
    console.log(`    - RSS: ${data.memory.rss} MB`);
    console.log("");
  } catch (error) {
    console.error(`✗ Error obteniendo estadísticas: ${error.message}`);
  }
}

// ==================== EJECUTAR ====================
async function main() {
  const token = await testLogin();
  await testControlCenter(token);
  await testLogs(token);
  await testStats(token);

  console.log("=====================================");
  console.log("✓ Test completado exitosamente");
  console.log("=====================================\n");
}

main().catch(error => {
  console.error(`✗ Error fatal: ${error.message}`);
  process.exit(1);
});
