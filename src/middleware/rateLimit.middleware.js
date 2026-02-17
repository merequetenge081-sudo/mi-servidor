/**
 * Rate limiting middleware using in-memory store
 * Tracks requests per IP address over a sliding window
 */

const requestCounts = {};
const WINDOW_SIZE = 10 * 60 * 1000; // 10 minutes in milliseconds
const MAX_REQUESTS = 20; // Maximum 20 requests per window

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

export function rateLimitMiddleware(req, res, next) {
  const clientIp = getClientIp(req);
  const now = Date.now();

  // Initialize or get client's request history
  if (!requestCounts[clientIp]) {
    requestCounts[clientIp] = [];
  }

  // Remove old requests outside the window
  requestCounts[clientIp] = requestCounts[clientIp].filter(
    timestamp => now - timestamp < WINDOW_SIZE
  );

  // Check if limit exceeded
  if (requestCounts[clientIp].length >= MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes. Intenta más tarde.',
      retryAfter: Math.ceil(
        (requestCounts[clientIp][0] + WINDOW_SIZE - now) / 1000
      )
    });
  }

  // Add current request timestamp
  requestCounts[clientIp].push(now);

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - requestCounts[clientIp].length);
  res.setHeader('X-RateLimit-Reset', new Date(now + WINDOW_SIZE).toISOString());

  next();
}

/**
 * Cleanup old entries periodically (every hour)
 * to prevent memory leak from abandoned IPs
 */
setInterval(() => {
  const now = Date.now();
  for (const ip in requestCounts) {
    requestCounts[ip] = requestCounts[ip].filter(
      timestamp => now - timestamp < WINDOW_SIZE
    );
    if (requestCounts[ip].length === 0) {
      delete requestCounts[ip];
    }
  }
}, 60 * 60 * 1000); // 1 hour
