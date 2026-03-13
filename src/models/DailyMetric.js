import mongoose from "mongoose";

const dailyMetricSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    eventId: { type: String, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    totalRecords: { type: Number, default: 0 },
    validRecords: { type: Number, default: 0 },
    duplicateRecords: { type: Number, default: 0 },
    confirmedRecords: { type: Number, default: 0 },
    flaggedRecords: { type: Number, default: 0 }
  },
  { timestamps: true }
);

dailyMetricSchema.index({ organizationId: 1, eventId: 1, date: 1 }, { unique: true });

export const DailyMetric = mongoose.model("DailyMetric", dailyMetricSchema);
