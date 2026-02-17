import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  // Información de la acción
  action: { type: String, required: true, enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'CONFIRM', 'UNCONFIRM', 'LOGIN', 'EXPORT'] },
  resourceType: { type: String, required: true },
  resourceId: String,
  
  // Información del usuario
  userId: String,
  userRole: String,
  userName: String,
  
  // Información de la organización
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization',
    sparse: true
  },
  
  // Detalles del cambio
  changes: mongoose.Schema.Types.Mixed, // {field: {old: value, new: value}}
  description: String,
  
  // Información de la solicitud
  ipAddress: String,
  userAgent: String,
  method: String, // GET, POST, PUT, DELETE
  endpoint: String,
  statusCode: Number,
  
  // Metadatos
  timestamp: { type: Date, default: Date.now },
  duration: Number, // tiempo de ejecución en ms
});

// Índices para auditoría y búsqueda
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ organizationId: 1 });
auditLogSchema.index({ resourceType: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ organizationId: 1, timestamp: -1 }); // Compound para reportes
auditLogSchema.index({ resourceType: 1, resourceId: 1 }); // Para buscar cambios en un recurso
auditLogSchema.index({ organizationId: 1, action: 1, timestamp: -1 }); // Para reportes por acción

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
