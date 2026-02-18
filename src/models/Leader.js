import mongoose from "mongoose";

const leaderSchema = new mongoose.Schema({
  leaderId: { type: String, required: true },
  name: { type: String, required: true },
  email: String,
  phone: String,
  area: String,

  // Security fields
  username: { type: String, unique: true, sparse: true }, // Auto-generated
  passwordHash: String,
  isTemporaryPassword: { type: Boolean, default: false },

  token: { type: String, required: true },
  active: { type: Boolean, default: true },
  eventId: String,
  registrations: { type: Number, default: 0 },

  // Multi-tenant support (REQUIRED for isolation)
  organizationId: {
    type: String,
    required: true,
    index: true
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización
leaderSchema.index({ leaderId: 1 }, { unique: true });
leaderSchema.index({ token: 1 }, { unique: true });
leaderSchema.index({ eventId: 1 });
leaderSchema.index({ active: 1, registrations: -1 });
leaderSchema.index({ email: 1 });
leaderSchema.index({ createdAt: -1 });
leaderSchema.index({ organizationId: 1, active: 1 });

export const Leader = mongoose.model("Leader", leaderSchema);

