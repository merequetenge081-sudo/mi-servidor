import mongoose from "mongoose";

const deletionRequestSchema = new mongoose.Schema({
  leaderId: { 
    type: String, 
    required: true,
    index: true
  },
  leaderName: String,
  
  organizationId: {
    type: String,
    required: true,
    index: true
  },
  
  eventId: String,
  
  // Estado de la solicitud
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  
  // Cantidad de registros a eliminar
  registrationCount: {
    type: Number,
    default: 0
  },
  
  // Razón o notas del líder
  reason: String,
  
  // Información de aprobación/rechazo
  reviewedBy: String, // admin username
  reviewedAt: Date,
  reviewNotes: String,
  
  // Auditoría
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices compuestos
deletionRequestSchema.index({ organizationId: 1, status: 1 });
deletionRequestSchema.index({ leaderId: 1, createdAt: -1 });

export const DeletionRequest = mongoose.model("DeletionRequest", deletionRequestSchema);
