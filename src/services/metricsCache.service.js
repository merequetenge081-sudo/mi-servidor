import logger from "../config/logger.js";
import cacheService from "./cache.service.js";
import { AnalyticsMetricsCache } from "../models/AnalyticsMetricsCache.js";

const METRICS_NAMESPACE = "analytics_metrics";
const MEMORY_TTL_SECONDS = 60;
const PERSISTED_TTL_SECONDS = 5 * 60;
const ALL_KEY = "__all__";
const pendingComputations = new Map();

function normalizeScopeValue(value, fallback = ALL_KEY) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).trim() || fallback;
}

function normalizeRegion(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  if (!normalized) return "all";
  return normalized;
}

function shouldLogDev() {
  return process.env.NODE_ENV !== "production";
}

export function buildMetricsCacheScope(filters = {}) {
  return {
    namespace: METRICS_NAMESPACE,
    organizationKey: normalizeScopeValue(filters.organizationId),
    eventKey: normalizeScopeValue(filters.eventId),
    leaderKey: normalizeScopeValue(filters.leaderId),
    regionKey: normalizeRegion(filters.region),
    includeDetailsKey: filters.includeDetails === false ? "compact" : "detailed"
  };
}

export function buildMetricsCacheKey(filters = {}) {
  const scope = buildMetricsCacheScope(filters);
  return [
    scope.namespace,
    scope.organizationKey,
    scope.eventKey,
    scope.leaderKey,
    scope.regionKey,
    scope.includeDetailsKey
  ].join(":");
}

function buildMemoryKey(scope) {
  return [
    scope.namespace,
    scope.organizationKey,
    scope.eventKey,
    scope.leaderKey,
    scope.regionKey,
    scope.includeDetailsKey
  ].join(":");
}

class MetricsCacheService {
  async getCachedMetrics(filters = {}) {
    const scope = buildMetricsCacheScope(filters);
    const key = buildMemoryKey(scope);

    const memoryHit = cacheService.get(key);
    if (memoryHit) {
      if (shouldLogDev()) logger.debug(`[MetricsCache] HIT memory ${key}`);
      return memoryHit;
    }

    const persisted = await AnalyticsMetricsCache.findOne({
      key,
      expiresAt: { $gt: new Date() }
    })
      .select({ payload: 1, _id: 0 })
      .lean();

    if (persisted?.payload) {
      cacheService.set(key, persisted.payload, MEMORY_TTL_SECONDS);
      if (shouldLogDev()) logger.debug(`[MetricsCache] HIT persisted ${key}`);
      return persisted.payload;
    }

    if (shouldLogDev()) logger.debug(`[MetricsCache] MISS ${key}`);
    return null;
  }

  async setCachedMetrics(filters = {}, payload) {
    const scope = buildMetricsCacheScope(filters);
    const key = buildMemoryKey(scope);
    const expiresAt = new Date(Date.now() + PERSISTED_TTL_SECONDS * 1000);

    cacheService.set(key, payload, MEMORY_TTL_SECONDS);

    await AnalyticsMetricsCache.findOneAndUpdate(
      { key },
      {
        $set: {
          key,
          namespace: scope.namespace,
          organizationKey: scope.organizationKey,
          eventKey: scope.eventKey,
          leaderKey: scope.leaderKey,
          regionKey: scope.regionKey,
          includeDetailsKey: scope.includeDetailsKey,
          payload,
          expiresAt,
          updatedAt: new Date()
        }
      },
      {
        upsert: true,
        new: false,
        setDefaultsOnInsert: true
      }
    );

    if (shouldLogDev()) logger.debug(`[MetricsCache] SET ${key}`);
    return payload;
  }

  async getOrComputeCompactMetrics(filters = {}, computeFn) {
    const normalizedFilters = { ...filters, includeDetails: false };
    const key = buildMetricsCacheKey(normalizedFilters);
    const cached = await this.getCachedMetrics(normalizedFilters);
    if (cached) return cached;

    if (pendingComputations.has(key)) {
      if (shouldLogDev()) logger.debug(`[MetricsCache] WAIT ${key}`);
      return pendingComputations.get(key);
    }

    const startedAt = Date.now();
    const pending = (async () => {
      try {
        const computed = await computeFn();
        await this.setCachedMetrics(normalizedFilters, computed);
        if (shouldLogDev()) {
          logger.debug(
            `[MetricsCache] COMPUTE ${key} ${Date.now() - startedAt}ms`
          );
        }
        return computed;
      } finally {
        pendingComputations.delete(key);
      }
    })();

    pendingComputations.set(key, pending);
    return pending;
  }

  async invalidateMetrics(filters = {}) {
    const scope = buildMetricsCacheScope({ ...filters, includeDetails: false });
    const deletedMemory = cacheService.clearPattern(
      `${METRICS_NAMESPACE}:${scope.organizationKey}:${scope.eventKey}:${scope.leaderKey}`
    );
    const deletedPersisted = await AnalyticsMetricsCache.deleteMany({
      namespace: METRICS_NAMESPACE,
      organizationKey: scope.organizationKey,
      eventKey: scope.eventKey,
      leaderKey: scope.leaderKey,
      includeDetailsKey: "compact"
    });
    if (shouldLogDev()) {
      logger.debug(
        `[MetricsCache] INVALIDATE exact org=${scope.organizationKey} event=${scope.eventKey} leader=${scope.leaderKey} removed=${deletedMemory}/${deletedPersisted.deletedCount || 0}`
      );
    }
    return {
      deletedMemory,
      deletedPersisted: deletedPersisted.deletedCount || 0
    };
  }

  async invalidateMetricsForRegistrationScope(scope = {}) {
    const organizationKey = normalizeScopeValue(scope.organizationId);
    const eventKey = normalizeScopeValue(scope.eventId);
    const leaderKey = normalizeScopeValue(scope.leaderId);

    const leaderCandidates = [ALL_KEY];
    if (leaderKey !== ALL_KEY) leaderCandidates.push(leaderKey);
    const eventCandidates = [ALL_KEY];
    if (eventKey !== ALL_KEY) eventCandidates.push(eventKey);
    const orgCandidates = [ALL_KEY];
    if (organizationKey !== ALL_KEY) orgCandidates.push(organizationKey);

    let deletedMemory = 0;
    for (const orgKey of orgCandidates) {
      deletedMemory += cacheService.clearPattern(`${METRICS_NAMESPACE}:${orgKey}:`);
    }

    const deletedPersisted = await AnalyticsMetricsCache.deleteMany({
      namespace: METRICS_NAMESPACE,
      includeDetailsKey: "compact",
      organizationKey: { $in: orgCandidates },
      eventKey: { $in: eventCandidates },
      leaderKey: { $in: leaderCandidates }
    });

    if (shouldLogDev()) {
      logger.debug(
        `[MetricsCache] INVALIDATE scope org=${organizationKey} event=${eventKey} leader=${leaderKey} persisted=${deletedPersisted.deletedCount || 0}`
      );
    }

    return {
      deletedMemory,
      deletedPersisted: deletedPersisted.deletedCount || 0
    };
  }

  async invalidateMetricsForLeaderScope(scope = {}) {
    const organizationKey = normalizeScopeValue(scope.organizationId);
    const eventKey = normalizeScopeValue(scope.eventId);
    const orgCandidates = [ALL_KEY];
    if (organizationKey !== ALL_KEY) orgCandidates.push(organizationKey);
    const eventCandidates = [ALL_KEY];
    if (eventKey !== ALL_KEY) eventCandidates.push(eventKey);

    let deletedMemory = 0;
    for (const orgKey of orgCandidates) {
      deletedMemory += cacheService.clearPattern(`${METRICS_NAMESPACE}:${orgKey}:`);
    }

    const deletedPersisted = await AnalyticsMetricsCache.deleteMany({
      namespace: METRICS_NAMESPACE,
      includeDetailsKey: "compact",
      organizationKey: { $in: orgCandidates },
      eventKey: { $in: eventCandidates }
    });

    if (shouldLogDev()) {
      logger.debug(
        `[MetricsCache] INVALIDATE leader-scope org=${organizationKey} event=${eventKey} persisted=${deletedPersisted.deletedCount || 0}`
      );
    }

    return {
      deletedMemory,
      deletedPersisted: deletedPersisted.deletedCount || 0
    };
  }
}

const metricsCacheService = new MetricsCacheService();

export default metricsCacheService;
