import mongoose from "mongoose";

const localidadSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true
    },
    normalizedNombre: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    organizationId: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    collection: "localidades",
    timestamps: true
  }
);

localidadSchema.index({ organizationId: 1, normalizedNombre: 1 }, { unique: true });

export const Localidad = mongoose.model("Localidad", localidadSchema);
