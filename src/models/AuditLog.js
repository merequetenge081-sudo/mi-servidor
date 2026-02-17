import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: String,
  userId: String,
  userRole: String,
  userName: String,
  changes: mongoose.Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now },
  ipAddress: String,
  description: String
});

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
