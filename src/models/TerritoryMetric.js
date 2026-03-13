import mongoose from "mongoose";

const territoryMetricSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    territory: { type: String, required: true, index: true },
    totalRecords: { type: Number, default: 0 },
    validRecords: { type: Number, default: 0 },
    confirmedRecords: { type: Number, default: 0 }
  },
  { timestamps: true }
);

territoryMetricSchema.index({ organizationId: 1, eventId: 1, date: 1, territory: 1 }, { unique: true });

export const TerritoryMetric = mongoose.model("TerritoryMetric", territoryMetricSchema);
