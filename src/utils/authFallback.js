/**
 * Autenticación con fallback en memoria
 * Cuando MongoDB no está disponible, usa datos de prueba
 */

import bcryptjs from "bcryptjs";
import logger from "../config/logger.js";

// Hashes pre-computados:
// admin123 hash (bcrypt round 10)
const HASH_ADMIN123 = "$2a$10$IQv3/qKk5jP.2K5K3F5K5OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";
// leader123 hash (bcrypt round 10)  
const HASH_LEADER123 = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg4LG3XC9R5qCmzLaVMmPl5gKy";

// Alternativa: crear hashes en tiempo de init
let memoryAdmins = [];
let memoryLeaders = [];

/**
 * Inicializa los datos en memoria con hashes válidos
 */
export async function initMemoryAuth() {
  try {
    // Hash de "admin123"
    const adminHash = await bcryptjs.hash("admin123", 10);
    // Hash de "leader123"
    const leaderHash = await bcryptjs.hash("leader123", 10);

    memoryAdmins = [
      {
        _id: "admin-001",
        username: "admin",
        passwordHash: adminHash,
        email: "admin@example.com",
        role: "admin"
      }
    ];

    memoryLeaders = [
      {
        _id: "leader-001",
        email: "lider@example.com",
        passwordHash: leaderHash,
        name: "Líder Prueba",
        cedula: "1000000001"
      },
      {
        _id: "leader-002",
        email: "lider2@example.com",
        passwordHash: leaderHash,
        name: "Segundo Líder",
        cedula: "1000000002"
      }
    ];

    logger.info("✅ Autenticación en memoria inicializada");
  } catch (err) {
    logger.error("Error inicializando autenticación en memoria:", { error: err.message });
  }
}

/**
 * Encuentra admin localmente (sin MongoDB)
 */
export async function findAdminLocal(username) {
  return memoryAdmins.find(a => a.username === username);
}

/**
 * Encuentra líder localmente (sin MongoDB)
 */
export async function findLeaderLocal(email) {
  return memoryLeaders.find(l => l.email === email);
}

/**
 * Busca admin con fallback a memoria
 */
export async function findAdminWithFallback(Admin, username) {
  try {
    // Intenta MongoDB primero
    const admin = await Admin.findOne({ username });
    if (admin) {
      return { data: admin, source: "mongodb" };
    }
  } catch (err) {
    logger.warn("MongoDB no disponible para auth, usando fallback en memoria", {
      error: err.message
    });
  }

  // Fallback a memoria
  const admin = await findAdminLocal(username);
  if (admin) {
    return { data: admin, source: "memory" };
  }

  return { data: null, source: "none" };
}

/**
 * Busca líder con fallback a memoria
 */
export async function findLeaderWithFallback(Leader, email) {
  try {
    // Intenta MongoDB primero
    const leader = await Leader.findOne({ email });
    if (leader) {
      return { data: leader, source: "mongodb" };
    }
  } catch (err) {
    logger.warn("MongoDB no disponible para auth, usando fallback en memoria", {
      error: err.message
    });
  }

  // Fallback a memoria
  const leader = await findLeaderLocal(email);
  if (leader) {
    return { data: leader, source: "memory" };
  }

  return { data: null, source: "none" };
}

/**
 * Obtiene lista de credenciales de prueba disponibles
 */
export function getTestCredentials() {
  return {
    admins: [
      {
        username: "admin",
        password: "admin123",
        role: "admin",
        email: "admin@example.com",
        source: "memory"
      }
    ],
    leaders: [
      {
        email: "lider@example.com",
        password: "leader123",
        name: "Líder Prueba",
        cedula: "1000000001",
        source: "memory"
      },
      {
        email: "lider2@example.com",
        password: "leader123",
        name: "Segundo Líder",
        cedula: "1000000002",
        source: "memory"
      }
    ]
  };
}
