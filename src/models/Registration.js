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
  departamento: String,
  capital: String,
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
  
  // Consent field (Ley 1581 de 2012)
  hasConsentToRegister: { type: Boolean, default: false },
  
  organizationId: { 
    type: String,
    required: true,
    index: true
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware pre-save: sanitizar strings
registrationSchema.pre('save', function(next) {
  // Trim all string fields
  if (this.firstName) this.firstName = this.firstName.trim();
  if (this.lastName) this.lastName = this.lastName.trim();
  if (this.cedula) this.cedula = this.cedula.trim();
  if (this.email) this.email = this.email.trim();
  if (this.phone) this.phone = this.phone.trim();
  if (this.localidad) this.localidad = this.localidad.trim();
  if (this.leaderName) this.leaderName = this.leaderName.trim();
  if (this.votingPlace) this.votingPlace = this.votingPlace.trim();
  if (this.votingTable) this.votingTable = this.votingTable.trim();
  next();
});

// Índices para optimización
registrationSchema.index({ cedula: 1, eventId: 1 }, { unique: true });
registrationSchema.index({ leaderId: 1 });
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ cedula: 1 });
registrationSchema.index({ email: 1 });
registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ confirmed: 1, eventId: 1 });
registrationSchema.index({ organizationId: 1, eventId: 1 });
registrationSchema.index({ organizationId: 1, leaderId: 1 });

export const Registration = mongoose.model("Registration", registrationSchema);

