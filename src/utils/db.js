import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcryptjs from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USERS_FILE = path.join(__dirname, "../../users.json");

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("Error cargando usuarios:", err.message);
  }
  return { admins: [], leaders: [] };
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export function addAdmin(username, passwordHash) {
  const users = loadUsers();
  const existing = users.admins.find(a => a.username === username);
  
  if (existing) {
    existing.passwordHash = passwordHash;
  } else {
    users.admins.push({
      id: Date.now().toString(),
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    });
  }
  
  saveUsers(users);
  return true;
}

export function findAdminByUsername(username) {
  const users = loadUsers();
  return users.admins.find(a => a.username === username);
}

export function findLeaderByUsername(username) {
  const users = loadUsers();
  return users.leaders.find(l => l.username === username || l.email === username);
}

export function addLeader(leader) {
  const users = loadUsers();
  users.leaders.push({
    id: Date.now().toString(),
    ...leader,
    createdAt: new Date().toISOString()
  });
  saveUsers(users);
  return true;
}

export { loadUsers, saveUsers };
