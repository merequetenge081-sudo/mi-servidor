import { Admin } from "../models/Admin.js";
import { Leader } from "../models/Leader.js";
import { Registration } from "../models/Registration.js";
import { Event } from "../models/Event.js";
import { AuditLog } from "../models/AuditLog.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../../data");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let mongoConnected = false;

export function setMongoConnected(connected) {
  mongoConnected = connected;
}

// ==================== ADMIN ====================
export async function findAdminByUsername(username) {
  if (mongoConnected) {
    try {
      return await Admin.findOne({ username });
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "admins.json");
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      return data.find(a => a.username === username);
    }
  } catch {}
  return null;
}

export async function saveAdmin(adminData) {
  if (mongoConnected) {
    try {
      return await Admin.create(adminData);
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "admins.json");
  const admins = [];
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      admins.push(...data);
    }
  } catch {}
  
  admins.push({ ...adminData, _id: Date.now().toString() });
  fs.writeFileSync(dataFile, JSON.stringify(admins, null, 2));
  return admins[admins.length - 1];
}

// ==================== LEADER ====================
export async function findLeaderById(id) {
  if (mongoConnected) {
    try {
      return await Leader.findById(id);
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "leaders.json");
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      return data.find(l => l._id === id);
    }
  } catch {}
  return null;
}

export async function findLeaderByLeaderId(leaderId) {
  if (mongoConnected) {
    try {
      return await Leader.findOne({ leaderId });
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "leaders.json");
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      return data.find(l => l.leaderId === leaderId);
    }
  } catch {}
  return null;
}

export async function findLeaders(filter) {
  if (mongoConnected) {
    try {
      return await Leader.find(filter);
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "leaders.json");
  try {
    if (fs.existsSync(dataFile)) {
      let data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      for (const [key, value] of Object.entries(filter)) {
        data = data.filter(l => l[key] === value);
      }
      return data;
    }
  } catch {}
  return [];
}

export async function saveLeader(leaderData) {
  if (mongoConnected) {
    try {
      return await Leader.create(leaderData);
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "leaders.json");
  const leaders = [];
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      leaders.push(...data);
    }
  } catch {}
  
  leaders.push({ ...leaderData, _id: Date.now().toString() });
  fs.writeFileSync(dataFile, JSON.stringify(leaders, null, 2));
  return leaders[leaders.length - 1];
}

// ==================== REGISTRATION ====================
export async function findRegistrations(filter) {
  if (mongoConnected) {
    try {
      return await Registration.find(filter);
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "registrations.json");
  try {
    if (fs.existsSync(dataFile)) {
      let data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      for (const [key, value] of Object.entries(filter)) {
        data = data.filter(r => r[key] === value);
      }
      return data;
    }
  } catch {}
  return [];
}

export async function saveRegistration(regData) {
  if (mongoConnected) {
    try {
      return await Registration.create(regData);
    } catch {
      mongoConnected = false;
    }
  }
  
  const dataFile = path.join(DATA_DIR, "registrations.json");
  const registrations = [];
  try {
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, "utf-8"));
      registrations.push(...data);
    }
  } catch {}
  
  registrations.push({ ...regData, _id: Date.now().toString() });
  fs.writeFileSync(dataFile, JSON.stringify(registrations, null, 2));
  return registrations[registrations.length - 1];
}
