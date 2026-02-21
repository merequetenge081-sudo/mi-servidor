import mongoose from "mongoose";

const puestoSchema = new mongoose.Schema({
  codigoPuesto: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  nombre: {
    type: String,
    required: true,
    index: true
  },
  localidad: {
    type: String,
    required: true,
    index: true
  },
  direccion: String,
  mesas: [Number], // Array de números de mesa, ej: [1, 2, 3, 4, ...]
  
  // Metadata
  activo: { type: Boolean, default: true },
  fuente: { type: String, default: "IDECA" }, // De dónde se importó
  
  // Auditoría
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización
puestoSchema.index({ localidad: 1, activo: 1 });
puestoSchema.index({ codigoPuesto: 1 });
puestoSchema.index({ nombre: 1 });

export const Puestos = mongoose.model("Puestos", puestoSchema);
