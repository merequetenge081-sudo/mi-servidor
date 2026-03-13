import mongoose from "mongoose";

const mesaOficialBogotaSchema = new mongoose.Schema(
  {
    corporacion: { type: String, default: "CAMARA", trim: true, index: true },
    departamentoCodigo: { type: String, default: "16", trim: true, index: true },
    municipio: { type: String, default: "BOGOTA. D.C.", trim: true },
    localidad: { type: String, required: true, trim: true },
    zonaNombre: { type: String, default: null, trim: true },
    zonaCodigo: { type: String, default: null, trim: true },
    puesto: { type: String, required: true, trim: true },
    mesa: { type: Number, required: true },
    codigoPuesto: { type: String, default: null, trim: true },
    sourceUrl: { type: String, default: null, trim: true },
    officialSourceVersion: { type: String, default: null, trim: true },
    syncedAt: { type: Date, default: Date.now },
    normalizedLocalidad: { type: String, required: true, index: true },
    normalizedPuesto: { type: String, required: true, index: true }
  },
  {
    collection: "mesas_oficiales_bogota",
    timestamps: { createdAt: "created_at", updatedAt: false }
  }
);

// Index solicitado: puesto + mesa (versión normalizada para matching robusto)
mesaOficialBogotaSchema.index({ normalizedPuesto: 1, mesa: 1 });
mesaOficialBogotaSchema.index({ corporacion: 1, normalizedLocalidad: 1, normalizedPuesto: 1, mesa: 1 });
// Evita duplicados por combinación localidad/puesto/mesa
mesaOficialBogotaSchema.index(
  { corporacion: 1, normalizedLocalidad: 1, normalizedPuesto: 1, mesa: 1 },
  { unique: true }
);

export const MesaOficialBogota = mongoose.model("MesaOficialBogota", mesaOficialBogotaSchema);
