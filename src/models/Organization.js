import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  email: String,
  phone: String,
  website: String,
  logo: String,
  addressCity: String,
  addressDepartment: String,
  
  // Configuración
  maxLeaders: { type: Number, default: 100 },
  maxEvents: { type: Number, default: 50 },
  maxRegistrationsPerEvent: { type: Number, default: 10000 },
  
  // Suscripción / Plan
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  status: { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active' },
  
  // Admin de la organización
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  
  // Estadísticas
  leadersCount: { type: Number, default: 0 },
  eventsCount: { type: Number, default: 0 },
  registrationsCount: { type: Number, default: 0 },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para búsqueda y filtrado
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ status: 1 });
organizationSchema.index({ plan: 1 });
organizationSchema.index({ adminId: 1 });
organizationSchema.index({ createdAt: -1 });

export const Organization = mongoose.model("Organization", organizationSchema);
