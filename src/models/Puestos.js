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
  localidadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Localidad",
    default: null,
    index: true
  },
  normalizedNombre: {
    type: String,
    default: "",
    index: true
  },
  ciudad: {
    type: String,
    default: 'Bogotá'
  },
  departamento: {
    type: String,
    default: 'Bogotá D.C.'
  },
  direccion: String,
  mesas: [Number], // Array de números de mesa, ej: [1, 2, 3, 4, ...]
  aliases: [String], // Alias conocidos del lugar (sitio, nombres populares)
  
  // Multi-tenant
  organizationId: {
    type: String,
    required: false, // Puede ser null para datos públicos
    index: true
  },
  
  // Metadata
  activo: { type: Boolean, default: true },
  fuente: { type: String, default: "IDECA" }, // De dónde se importó

  // Estado de integridad
  integrityStatus: {
    type: String,
    enum: ["valid", "needs_review", "invalid"],
    default: "valid",
    index: true
  },
  
  // Auditoría
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Índices para optimización (sin duplicados)
// Nota: codigoPuesto ya tiene índice único por 'unique: true'
puestoSchema.index({ localidad: 1, activo: 1 });
puestoSchema.index({ nombre: 1 });
puestoSchema.index({ organizationId: 1, normalizedNombre: 1 });

export const Puestos = mongoose.model("Puestos", puestoSchema);
