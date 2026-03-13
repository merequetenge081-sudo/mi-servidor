import mongoose from "mongoose";

const e14ImportBatchRowSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, required: true },
    rawLocalidad: { type: String, default: "" },
    rawPuesto: { type: String, default: "" },
    rawMesa: { type: String, default: "" },
    rawVotosE14: { type: String, default: "" },
    rawObservacion: { type: String, default: "" },
    matchedLocalidad: { type: String, default: "" },
    matchedPuesto: { type: String, default: "" },
    matchedMesa: { type: Number, default: null },
    internalVotes: { type: Number, default: 0 },
    e14Votes: { type: Number, default: null },
    difference: { type: Number, default: null },
    status: {
      type: String,
      enum: ["confirmada", "diferencia", "no_encontrada", "dato_incompleto", "inconsistente", "duplicada"],
      default: "dato_incompleto"
    },
    messages: { type: [String], default: [] },
    applied: { type: Boolean, default: false },
    mesaKey: { type: String, default: "" },
    originalRow: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { _id: false }
);

const e14ImportBatchSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, default: null, index: true },
    fileName: { type: String, required: true, trim: true },
    importedBy: { type: String, default: "" },
    importSource: { type: String, enum: ["excel_manual"], default: "excel_manual" },
    columnMap: {
      localidad: { type: String, default: "" },
      puesto: { type: String, default: "" },
      mesa: { type: String, default: "" },
      votosE14: { type: String, default: "" },
      observacion: { type: String, default: "" }
    },
    totalRows: { type: Number, default: 0 },
    matchedRows: { type: Number, default: 0 },
    updatedRows: { type: Number, default: 0 },
    confirmedRows: { type: Number, default: 0 },
    differenceRows: { type: Number, default: 0 },
    notFoundRows: { type: Number, default: 0 },
    incompleteRows: { type: Number, default: 0 },
    inconsistentRows: { type: Number, default: 0 },
    duplicateRows: { type: Number, default: 0 },
    summaryByStatus: { type: mongoose.Schema.Types.Mixed, default: {} },
    rows: { type: [e14ImportBatchRowSchema], default: [] }
  },
  {
    collection: "e14_import_batches",
    timestamps: true
  }
);

e14ImportBatchSchema.index({ organizationId: 1, eventId: 1, createdAt: -1 });

export const E14ImportBatch = mongoose.model("E14ImportBatch", e14ImportBatchSchema);
