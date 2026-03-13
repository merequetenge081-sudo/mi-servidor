import crypto from "crypto";

export function generateLeaderId() {
  return `LID-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

export function generateLeaderToken() {
  return crypto.randomBytes(16).toString("hex");
}

