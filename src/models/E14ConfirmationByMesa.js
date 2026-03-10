import mongoose from "mongoose";

const e14ConfirmationByMesaSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, default: null, index: true },
    localidad: { type: String, required: true, trim: true },
    puesto: { type: String, required: true, trim: true },
    mesa: { type: Number, required: true, index: true },
    zoneCode: { type: String, default: null, trim: true, index: true },
    normalizedLocalidad: { type: String, required: true, index: true },
    normalizedPuesto: { type: String, required: true, index: true },
    votosReportadosTotales: { type: Number, default: 0 },
    votosE14Candidate105: { type: Number, default: null },
    votosE14SuggestedCandidate105: { type: Number, default: null },
    e14ListVotes: { type: Number, default: null },
    confirmacionPorcentaje: { type: Number, default: null },
    diferencia: { type: Number, default: null },
    estado: {
      type: String,
      enum: [
        "confirmado",
        "confirmacion_alta",
        "confirmacion_parcial",
        "confirmacion_baja",
        "sin_confirmacion",
        "pendiente_e14",
        "sin_votos_reportados",
        "datos_incompletos"
      ],
      default: "pendiente_e14",
      index: true
    },
    notes: { type: String, default: "" },
    reviewRequired: { type: Boolean, default: false, index: true },
    reviewReason: { type: String, default: "" },
    taskId: { type: String, default: "" },
    reviewPriorityRank: { type: Number, default: null, index: true },
    sourceEstadoRevision: { type: String, default: "" },
    sourceConfidence: { type: Number, default: null },
    sourceScoreDigito: { type: Number, default: null },
    sourceScoreSegundo: { type: Number, default: null },
    sourceMetodoDigito: { type: String, default: "" },
    sourceDebugDir: { type: String, default: "" },
    sourceDocumento: { type: String, default: "" },
    sourceArchivo: { type: String, default: "" },
    sourceLocalFileUri: { type: String, default: "" },
    sourceCaptureAvailable: { type: Boolean, default: false },
    sourceOverlayPath: { type: String, default: "" },
    sourceCellPath: { type: String, default: "" },
    sourceMaskPath: { type: String, default: "" },
    sourcePartyBlockPath: { type: String, default: "" },
    validatedAt: { type: Date, default: null },
    validatedBy: { type: String, default: null },
    source: { type: String, enum: ["manual", "system"], default: "manual" }
  },
  {
    collection: "e14_confirmation_by_mesa",
    timestamps: true
  }
);

e14ConfirmationByMesaSchema.index(
  { organizationId: 1, eventId: 1, normalizedLocalidad: 1, normalizedPuesto: 1, mesa: 1 },
  { unique: true }
);

export const E14ConfirmationByMesa = mongoose.model("E14ConfirmationByMesa", e14ConfirmationByMesaSchema);
