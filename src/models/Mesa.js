import mongoose from "mongoose";

const mesaSchema = new mongoose.Schema(
  {
    numero: {
      type: Number,
      required: true,
      index: true
    },
    puestoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Puestos",
      required: true,
      index: true
    },
    organizationId: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    collection: "mesas",
    timestamps: true
  }
);

mesaSchema.index({ organizationId: 1, puestoId: 1, numero: 1 }, { unique: true });

export const Mesa = mongoose.model("Mesa", mesaSchema);
