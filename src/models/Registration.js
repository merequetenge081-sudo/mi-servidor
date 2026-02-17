import mongoose from "mongoose";

const registrationSchema = new mongoose.Schema({
  leaderId: { type: String, required: true },
  leaderName: String,
  eventId: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  cedula: { type: String, required: true },
  email: String,
  phone: String,
  localidad: String,
  registeredToVote: { type: Boolean, default: false },
  votingPlace: String,
  votingTable: String,
  date: String,
  notifications: {
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    whatsappSent: { type: Boolean, default: false }
  },
  confirmed: { type: Boolean, default: false },
  confirmedBy: String,
  confirmedAt: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización
registrationSchema.index({ cedula: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ leaderId: 1 });
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ cedula: 1 });
registrationSchema.index({ email: 1 });
registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ confirmed: 1, eventId: 1 });

export const Registration = mongoose.model("Registration", registrationSchema);

