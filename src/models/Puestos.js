import mongoose from "mongoose";

const puestoSchema = new mongoose.Schema({
  codigoPuesto: {
    type: String,
    required: true,
    unique: true
  },
  nombre: {
    type: String,
    required: true
  },
  localidad: {
    type: String,
    required: true
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

// Índices para optimización (sin duplicados)
// Nota: codigoPuesto ya tiene índice único por 'unique: true'
puestoSchema.index({ localidad: 1, activo: 1 });
puestoSchema.index({ nombre: 1 });

export const Puestos = mongoose.model("Puestos", puestoSchema);
