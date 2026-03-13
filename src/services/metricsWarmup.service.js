import logger from "../config/logger.js";
import metricsService from "./metrics.service.js";
import metricsCacheService, { buildMetricsCacheKey } from "./metricsCache.service.js";

const DEFAULT_SCOPES = ["all", "bogota"];

function shouldLogDev() {
  return process.env.NODE_ENV !== "production";
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parseScopes() {
  const raw = String(process.env.METRICS_WARMUP_SCOPES || DEFAULT_SCOPES.join(","));
  const values = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return values.length > 0 ? [...new Set(values)] : [...DEFAULT_SCOPES];
}

function buildScopeFilters(region) {
  return {
    region,
    includeDetails: false
  };
}

class MetricsWarmupService {
  constructor() {
    this.started = false;
    this.inFlight = null;
    this.intervalHandle = null;
  }

  isEnabled() {
    return parseBoolean(process.env.METRICS_WARMUP_ENABLED, true);
  }

  isScheduleEnabled() {
    return parseBoolean(process.env.METRICS_WARMUP_SCHEDULE_ENABLED, false);
  }

  getIntervalMs() {
    const parsed = Number.parseInt(process.env.METRICS_WARMUP_INTERVAL_MS || "300000", 10);
    return Number.isFinite(parsed) && parsed >= 30000 ? parsed : 300000;
  }

  async warmCommonCompactMetrics() {
    if (this.inFlight) {
      if (shouldLogDev()) logger.debug("[MetricsWarmup] join in-flight warmup");
      return this.inFlight;
    }

    const scopes = parseScopes();
    const startedAt = Date.now();

    this.inFlight = (async () => {
      if (shouldLogDev()) {
        logger.info("[MetricsWarmup] started", { scopes });
      }

      const results = [];
      for (const region of scopes) {
        const filters = buildScopeFilters(region);
        const key = buildMetricsCacheKey(filters);
        const scopeStartedAt = Date.now();

        try {
          const cached = await metricsCacheService.getCachedMetrics(filters);
          if (cached) {
            results.push({
              key,
              region,
              source: "cache",
              durationMs: Date.now() - scopeStartedAt,
              success: true
            });
            continue;
          }

          await metricsService.getDashboardMetrics(filters);
          results.push({
            key,
            region,
            source: "recomputed",
            durationMs: Date.now() - scopeStartedAt,
            success: true
          });
        } catch (error) {
          logger.warn("[MetricsWarmup] scope failed", {
            key,
            region,
            error: error.message
          });
          results.push({
            key,
            region,
            source: "failed",
            durationMs: Date.now() - scopeStartedAt,
            success: false,
            error: error.message
          });
        }
      }

      if (shouldLogDev()) {
        logger.info("[MetricsWarmup] finished", {
          durationMs: Date.now() - startedAt,
          results
        });
      }

      return results;
    })();

    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  start() {
    if (this.started || !this.isEnabled()) return;
    this.started = true;

    setImmediate(() => {
      this.warmCommonCompactMetrics().catch((error) => {
        logger.warn("[MetricsWarmup] startup warmup failed", {
          error: error.message
        });
      });
    });

    if (!this.isScheduleEnabled()) return;

    const intervalMs = this.getIntervalMs();
    this.intervalHandle = setInterval(() => {
      this.warmCommonCompactMetrics().catch((error) => {
        logger.warn("[MetricsWarmup] scheduled warmup failed", {
          error: error.message
        });
      });
    }, intervalMs);

    if (typeof this.intervalHandle.unref === "function") {
      this.intervalHandle.unref();
    }

    if (shouldLogDev()) {
      logger.info("[MetricsWarmup] scheduler enabled", { intervalMs });
    }
  }

  stop() {
    this.started = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

const metricsWarmupService = new MetricsWarmupService();

export default metricsWarmupService;
