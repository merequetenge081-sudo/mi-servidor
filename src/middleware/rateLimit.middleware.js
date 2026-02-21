/**
 * Rate limiting middleware using in-memory store
 * Tracks requests per IP address over a sliding window
 */

const requestCounts = {};
const loginRequestCounts = {};
const WINDOW_SIZE = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_REQUESTS = 200; // Maximum 200 requests per window
const LOGIN_WINDOW_SIZE = 10 * 60 * 1000; // 10 minutes in milliseconds
const LOGIN_MAX_REQUESTS = 10; // Maximum 10 login attempts per window

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

function getLoginKey(req) {
  const ip = getClientIp(req);
  const username = req.body?.username || req.body?.email || '';
  return `${ip}:${username.toLowerCase()}`;
}

export function rateLimitMiddleware(req, res, next) {
  const clientIp = getClientIp(req);
  const now = Date.now();

  if (!requestCounts[clientIp]) {
    requestCounts[clientIp] = [];
  }

  requestCounts[clientIp] = requestCounts[clientIp].filter(
    timestamp => now - timestamp < WINDOW_SIZE
  );

  if (requestCounts[clientIp].length >= MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Demasiadas solicitudes. Intenta más tarde.',
      retryAfter: Math.ceil(
        (requestCounts[clientIp][0] + WINDOW_SIZE - now) / 1000
      )
    });
  }

  requestCounts[clientIp].push(now);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - requestCounts[clientIp].length);
  res.setHeader('X-RateLimit-Reset', new Date(now + WINDOW_SIZE).toISOString());

  next();
}

export function loginRateLimitMiddleware(req, res, next) {
  const clientIp = getClientIp(req);
  const now = Date.now();

  if (!loginRequestCounts[clientIp]) {
    loginRequestCounts[clientIp] = [];
  }

  loginRequestCounts[clientIp] = loginRequestCounts[clientIp].filter(
    timestamp => now - timestamp < LOGIN_WINDOW_SIZE
  );

  if (loginRequestCounts[clientIp].length >= LOGIN_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Demasiados intentos de login. Intenta mas tarde.",
      retryAfter: Math.ceil(
        (loginRequestCounts[clientIp][0] + LOGIN_WINDOW_SIZE - now) / 1000
      )
    });
  }

  loginRequestCounts[clientIp].push(now);

  res.setHeader("X-RateLimit-Limit", LOGIN_MAX_REQUESTS);
  res.setHeader("X-RateLimit-Remaining", LOGIN_MAX_REQUESTS - loginRequestCounts[clientIp].length);
  res.setHeader("X-RateLimit-Reset", new Date(now + LOGIN_WINDOW_SIZE).toISOString());

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
  for (const ip in loginRequestCounts) {
    loginRequestCounts[ip] = loginRequestCounts[ip].filter(
      timestamp => now - timestamp < LOGIN_WINDOW_SIZE
    );
    if (loginRequestCounts[ip].length === 0) {
      delete loginRequestCounts[ip];
    }
  }
}, 60 * 60 * 1000); // 1 hour
