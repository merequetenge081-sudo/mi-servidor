import mongoose from "mongoose";

const puestoMatchReviewSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    rawPuesto: { type: String, required: true, trim: true },
    normalizedRawPuesto: { type: String, required: true, trim: true, index: true },
    rawLocalidad: { type: String, default: "", trim: true },
    rawLocalidadNormalized: { type: String, default: "", trim: true, index: true },
    rawLocalidadId: { type: mongoose.Schema.Types.ObjectId, ref: "Localidad", default: null, index: true },
    suggestedPuestoId: { type: mongoose.Schema.Types.ObjectId, ref: "Puestos", default: null, index: true },
    suggestedLocalidadId: { type: mongoose.Schema.Types.ObjectId, ref: "Localidad", default: null, index: true },
    suggestedPuestoNombre: { type: String, default: "", trim: true },
    suggestedLocalidadNombre: { type: String, default: "", trim: true },
    confidence: { type: Number, default: null },
    matchType: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "accepted_auto", "accepted_manual", "rejected", "unmatched", "cross_localidad"],
      default: "pending",
      index: true
    },
    autoAssignable: { type: Boolean, default: false },
    requiresManualReview: { type: Boolean, default: false, index: true },
    sampleCount: { type: Number, default: 0 },
    notes: { type: String, default: "" }
  },
  {
    collection: "puesto_match_reviews",
    timestamps: true
  }
);

puestoMatchReviewSchema.index(
  { organizationId: 1, normalizedRawPuesto: 1, rawLocalidadNormalized: 1 },
  { unique: true, name: "uniq_puesto_match_review_scope" }
);

export const PuestoMatchReview = mongoose.model("PuestoMatchReview", puestoMatchReviewSchema);
