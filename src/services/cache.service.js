/**
 * Cache Service - Preparation for future Redis integration
 * Current implementation uses in-memory cache
 * Ready to swap with Redis when needed
 */

import logger from "../config/logger.js";

class CacheService {
  constructor() {
    // In-memory cache store (will be replaced with Redis)
    this.store = new Map();
    // Cache expiration times (in seconds)
    this.ttl = {
      stats: 300, // 5 minutes
      events: 600, // 10 minutes
      leaders: 600,
      registrations: 300,
      audit: 3600, // 1 hour
      default: 300
    };
    // TTL timers for cleanup
    this.timers = new Map();
  }

  /**
   * Generate cache key following pattern: namespace:id:orgId
   */
  buildKey(namespace, id = '', organizationId = null) {
    if (organizationId) {
      return `${namespace}:${id}:${organizationId}`;
    }
    return `${namespace}:${id}`;
  }

  /**
   * Get value from cache
   */
  get(key) {
    const cached = this.store.get(key);
    if (cached) {
      logger.debug(`Cache HIT: ${key}`);
      return cached;
    }
    logger.debug(`Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set value in cache with TTL
   */
  set(key, value, ttlSeconds = null) {
    const ttl = ttlSeconds || this.ttl.default;
    
    // Clear previous timer if exists
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set value
    this.store.set(key, value);
    logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);

    // Set expiration timer
    const timer = setTimeout(() => {
      this.delete(key);
      this.timers.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
  }

  /**
   * Delete value from cache
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    const deleted = this.store.delete(key);
    if (deleted) logger.debug(`Cache DELETE: ${key}`);
    return deleted;
  }

  /**
   * Clear cache by pattern (useful for invalidation)
   */
  clearPattern(pattern) {
    let count = 0;
    for (const [key] of this.store) {
      if (key.includes(pattern)) {
        this.delete(key);
        count++;
      }
    }
    logger.debug(`Cache CLEAR PATTERN: ${pattern} (${count} items)`);
    return count;
  }

  /**
   * Clear organization cache
   */
  clearOrganization(organizationId) {
    return this.clearPattern(`:${organizationId}`);
  }

  /**
   * Clear all cache
   */
  clearAll() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    const size = this.store.size;
    this.store.clear();
    logger.debug(`Cache CLEAR ALL (${size} items)`);
    return size;
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Wrapper for async cache with get/set pattern
   */
  async getOrFetch(key, fetchFn, ttlSeconds = null) {
    // Try to get from cache
    const cached = this.get(key);
    if (cached) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFn();
    
    // Store in cache
    this.set(key, value, ttlSeconds);
    
    return value;
  }
}

// Export singleton instance
export const cacheService = new CacheService();

/**
 * Cache middleware for route handlers
 * Automatically caches GET requests
 */
export function cacheMiddleware(ttlSeconds = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.baseUrl}${req.path}`;
    const cached = cacheService.get(cacheKey);

    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    // Wrap res.json to cache response
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      cacheService.set(cacheKey, data, ttlSeconds);
      res.set('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

export default cacheService;
