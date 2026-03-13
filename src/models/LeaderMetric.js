import mongoose from "mongoose";

const leaderMetricSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    leaderId: { type: String, required: true, index: true },
    totalUploaded: { type: Number, default: 0 },
    totalValid: { type: Number, default: 0 },
    totalDuplicates: { type: Number, default: 0 },
    totalConfirmed: { type: Number, default: 0 },
    effectivenessRate: { type: Number, default: 0 }
  },
  { timestamps: true }
);

leaderMetricSchema.index({ organizationId: 1, eventId: 1, date: 1, leaderId: 1 }, { unique: true });

export const LeaderMetric = mongoose.model("LeaderMetric", leaderMetricSchema);
