import mongoose from "mongoose";

const deduplicationFlagSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      index: true
    },
    cedula: { type: String, index: true },
    flagType: {
      type: String,
      enum: [
        "exact_duplicate",
        "probable_duplicate",
        "repeated_phone",
        "orphan_record",
        "puesto_localidad_mismatch"
      ],
      required: true
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium"
    },
    status: {
      type: String,
      enum: ["open", "resolved", "ignored"],
      default: "open",
      index: true
    },
    sourceSkill: { type: String, default: "deduplication" },
    details: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

deduplicationFlagSchema.index({ organizationId: 1, eventId: 1, status: 1, createdAt: -1 });
deduplicationFlagSchema.index({ registrationId: 1, flagType: 1 }, { unique: true, sparse: true });
deduplicationFlagSchema.index({ cedula: 1, eventId: 1, flagType: 1 });

export const DeduplicationFlag = mongoose.model("DeduplicationFlag", deduplicationFlagSchema);
