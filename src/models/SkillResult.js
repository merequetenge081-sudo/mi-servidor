import mongoose from "mongoose";

const skillResultSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SkillJob",
      index: true
    },
    skillName: { type: String, required: true, index: true },
    organizationId: { type: String, index: true },
    entityType: {
      type: String,
      enum: ["registration", "leader", "campaign", "event", "batch"],
      default: "registration"
    },
    entityId: { type: String, index: true },
    status: {
      type: String,
      enum: ["ok", "warning", "error"],
      default: "ok"
    },
    score: { type: Number, default: null },
    reasons: { type: [String], default: [] },
    flags: { type: [String], default: [] },
    output: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

skillResultSchema.index({ skillName: 1, entityType: 1, entityId: 1, createdAt: -1 });
skillResultSchema.index({ organizationId: 1, skillName: 1, createdAt: -1 });

export const SkillResult = mongoose.model("SkillResult", skillResultSchema);
