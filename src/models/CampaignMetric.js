import mongoose from "mongoose";

const campaignMetricSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, required: true, index: true }, // campaign/event
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    totalRecords: { type: Number, default: 0 },
    validRecords: { type: Number, default: 0 },
    duplicates: { type: Number, default: 0 },
    confirmed: { type: Number, default: 0 },
    pendingCall: { type: Number, default: 0 }
  },
  { timestamps: true }
);

campaignMetricSchema.index({ organizationId: 1, eventId: 1, date: 1 }, { unique: true });

export const CampaignMetric = mongoose.model("CampaignMetric", campaignMetricSchema);
