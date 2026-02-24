import mongoose from "mongoose";

/**
 * Modelo para registros archivados
 * Almacena copias de registros eliminados para reutilización en futuros eventos
 */
const archivedRegistrationSchema = new mongoose.Schema({
  // Datos originales del registro
  originalId: { 
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  
  leaderId: String,
  leaderName: String,
  eventId: String,
  
  // Datos personales
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  cedula: { 
    type: String, 
    required: true,
    index: true  // Índice para búsqueda rápida
  },
  email: String,
  phone: String,
  
  // Ubicación
  localidad: String,
  departamento: String,
  capital: String,
  
  // Datos de votación
  votingPlace: String,
  votingTable: String,
  puestoId: mongoose.Schema.Types.ObjectId,
  mesa: Number,
  registeredToVote: Boolean,
  
  // Historial
  confirmed: Boolean,
  date: String,
  
  // Multi-tenant
  organizationId: {
    type: String,
    required: true,
    index: true
  },
  
  // Metadata de archivo
  archivedAt: { type: Date, default: Date.now },
  archivedBy: String,  // admin username
  archivedReason: String,
  deletionRequestId: mongoose.Schema.Types.ObjectId,
  
  // Fechas originales
  originalCreatedAt: Date,
  originalUpdatedAt: Date
});

// Índices compuestos para búsqueda eficiente
archivedRegistrationSchema.index({ cedula: 1, organizationId: 1 });
archivedRegistrationSchema.index({ organizationId: 1, archivedAt: -1 });
archivedRegistrationSchema.index({ email: 1, organizationId: 1 });

export const ArchivedRegistration = mongoose.model("ArchivedRegistration", archivedRegistrationSchema);
