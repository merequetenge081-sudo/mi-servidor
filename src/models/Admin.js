import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  email: String,
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization',
    sparse: true // Permite null para admins globales
  },
  role: { type: String, enum: ['admin', 'org_admin'], default: 'admin' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización
adminSchema.index({ username: 1 }, { unique: true });
adminSchema.index({ role: 1 });

export const Admin = mongoose.model("Admin", adminSchema);

