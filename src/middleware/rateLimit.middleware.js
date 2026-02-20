/**
 * Rate limiting middleware using in-memory store
 * Tracks requests per IP address over a sliding window
 */

const requestCounts = {};
const WINDOW_SIZE = 15 * 60 * 1000;
const MAX_REQUESTS = 200;

const loginAttempts = {};
const LOGIN_WINDOW = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_TIME = 30 * 60 * 1000;

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
  const loginKey = getLoginKey(req);
  const now = Date.now();

  if (!loginAttempts[loginKey]) {
    loginAttempts[loginKey] = { attempts: [], lockedUntil: null };
  }

  const userLogin = loginAttempts[loginKey];

  if (userLogin.lockedUntil && now < userLogin.lockedUntil) {
    const remainingTime = Math.ceil((userLogin.lockedUntil - now) / 1000 / 60);
    return res.status(429).json({
      error: `Cuenta bloqueada por demasiados intentos. Intenta en ${remainingTime} minutos.`,
      retryAfter: Math.ceil((userLogin.lockedUntil - now) / 1000),
      locked: true
    });
  }

  userLogin.attempts = userLogin.attempts.filter(
    timestamp => now - timestamp < LOGIN_WINDOW
  );

  const attemptsRemaining = MAX_LOGIN_ATTEMPTS - userLogin.attempts.length;

  req.loginRateLimit = {
    recordFailedAttempt: () => {
      userLogin.attempts.push(now);
      if (userLogin.attempts.length >= MAX_LOGIN_ATTEMPTS) {
        userLogin.lockedUntil = now + LOCKOUT_TIME;
      }
    },
    resetAttempts: () => {
      loginAttempts[loginKey] = { attempts: [], lockedUntil: null };
    },
    getAttemptsRemaining: () => {
      return MAX_LOGIN_ATTEMPTS - userLogin.attempts.length;
    }
  };

  res.setHeader('X-Login-Attempts-Remaining', attemptsRemaining);

  next();
}

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
  for (const key in loginAttempts) {
    const data = loginAttempts[key];
    data.attempts = data.attempts.filter(t => now - t < LOGIN_WINDOW);
    if (data.attempts.length === 0 && (!data.lockedUntil || now >= data.lockedUntil)) {
      delete loginAttempts[key];
    }
  }
}, 60 * 60 * 1000);
