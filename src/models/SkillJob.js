import mongoose from "mongoose";

const skillJobSchema = new mongoose.Schema(
  {
    skillName: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    createdBy: { type: String, default: "system" },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true
    },
    scope: {
      type: String,
      enum: ["registration", "event", "campaign", "leader", "batch", "global"],
      default: "registration"
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    resultSummary: { type: mongoose.Schema.Types.Mixed, default: null },
    startedAt: Date,
    finishedAt: Date,
    error: String
  },
  { timestamps: true }
);

skillJobSchema.index({ skillName: 1, status: 1, createdAt: -1 });
skillJobSchema.index({ organizationId: 1, createdAt: -1 });

export const SkillJob = mongoose.model("SkillJob", skillJobSchema);
