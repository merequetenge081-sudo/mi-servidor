import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  date: String,
  location: String,
  active: { type: Boolean, default: true },
  registrationCount: { type: Number, default: 0 },
  confirmedCount: { type: Number, default: 0 },
  
  // Multi-tenant support
  organizationId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Organization',
    sparse: true
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización
eventSchema.index({ active: 1, createdAt: -1 });
eventSchema.index({ organizationId: 1 }); // Nuevo índice para filtrado por org
eventSchema.index({ organizationId: 1, active: 1 }); // Compound índice
eventSchema.index({ createdAt: -1 });

export const Event = mongoose.model("Event", eventSchema);
