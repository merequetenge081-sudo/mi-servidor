import mongoose from "mongoose";

const callAttemptSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    registrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Registration",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["pending_call", "called", "confirmed", "rejected", "no_answer", "wrong_number", "retry"],
      required: true
    },
    channel: {
      type: String,
      enum: ["call", "whatsapp", "sms", "manual"],
      default: "call"
    },
    notes: { type: String, default: "" },
    attemptedAt: { type: Date, default: Date.now, index: true },
    createdBy: { type: String, default: "system" }
  },
  { timestamps: true }
);

callAttemptSchema.index({ organizationId: 1, eventId: 1, attemptedAt: -1 });
callAttemptSchema.index({ registrationId: 1, attemptedAt: -1 });

export const CallAttempt = mongoose.model("CallAttempt", callAttemptSchema);
