import mongoose from "mongoose";

const verificationResultSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      index: true
    },
    state: {
      type: String,
      enum: ["pending_call", "called", "confirmed", "rejected", "no_answer", "wrong_number", "retry"],
      required: true
    },
    confidence: { type: Number, default: 0 },
    source: { type: String, enum: ["skill", "agent", "manual"], default: "skill" },
    reason: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

verificationResultSchema.index({ organizationId: 1, eventId: 1, state: 1, createdAt: -1 });
verificationResultSchema.index({ registrationId: 1, createdAt: -1 });

export const VerificationResult = mongoose.model("VerificationResult", verificationResultSchema);
