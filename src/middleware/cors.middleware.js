function getAllowedOrigins() {
  if (process.env.NODE_ENV !== "production") {
    return "*";
  }
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  }
  return process.env.BASE_URL || process.env.FRONTEND_URL || "*";
}

export function corsMiddleware(req, res, next) {
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;

  if (allowedOrigins === "*") {
    res.header("Access-Control-Allow-Origin", "*");
  } else if (Array.isArray(allowedOrigins)) {
    if (allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  } else {
    res.header("Access-Control-Allow-Origin", allowedOrigins);
  }

  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  return next();
}

