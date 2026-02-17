import mongoose from "mongoose";

const leaderSchema = new mongoose.Schema({
  leaderId: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  email: String,
  phone: String,
  area: String,
  passwordHash: String,
  token: { type: String, unique: true, required: true },
  active: { type: Boolean, default: true },
  eventId: String,
  registrations: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización
leaderSchema.index({ token: 1 }, { unique: true });
leaderSchema.index({ eventId: 1 });
leaderSchema.index({ active: 1, registrations: -1 });
leaderSchema.index({ email: 1 });
leaderSchema.index({ createdAt: -1 });

export const Leader = mongoose.model("Leader", leaderSchema);

