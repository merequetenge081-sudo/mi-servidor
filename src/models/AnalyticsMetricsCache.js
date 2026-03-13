import mongoose from "mongoose";

const analyticsMetricsCacheSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    namespace: {
      type: String,
      required: true,
      default: "analytics_metrics"
    },
    organizationKey: {
      type: String,
      default: "__all__",
      index: true
    },
    eventKey: {
      type: String,
      default: "__all__",
      index: true
    },
    leaderKey: {
      type: String,
      default: "__all__",
      index: true
    },
    regionKey: {
      type: String,
      default: "all",
      index: true
    },
    includeDetailsKey: {
      type: String,
      default: "compact",
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

analyticsMetricsCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
analyticsMetricsCacheSchema.index({
  namespace: 1,
  organizationKey: 1,
  eventKey: 1,
  leaderKey: 1,
  includeDetailsKey: 1
});

export const AnalyticsMetricsCache = mongoose.model(
  "AnalyticsMetricsCache",
  analyticsMetricsCacheSchema,
  "analytics_metrics_cache"
);
