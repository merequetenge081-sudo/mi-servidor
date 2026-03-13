import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import xss from "xss-clean";
import hpp from "hpp";

export function applySecurityMiddleware(app) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com",
            "https://cdn.tailwindcss.com"
          ],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com",
            "https://cdn.tailwindcss.com",
            "https://fonts.googleapis.com"
          ],
          imgSrc: ["'self'", "data:"],
          connectSrc: [
            "'self'",
            "https://cdn.jsdelivr.net",
            "https://cdnjs.cloudflare.com",
            "https://cdn.tailwindcss.com"
          ],
          fontSrc: [
            "'self'",
            "https://cdnjs.cloudflare.com",
            "https://cdn.jsdelivr.net",
            "https://fonts.googleapis.com",
            "data:"
          ]
        }
      },
      hsts: process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
          }
        : false,
      crossOriginEmbedderPolicy: false
    })
  );

  if (process.env.NODE_ENV === "production") {
    app.use((req, res, next) => {
      if (req.headers["x-forwarded-proto"] !== "https" && req.protocol !== "https") {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      return next();
    });
  }

  app.use(compression());
  app.use(xss());
  app.use(hpp());

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: { error: "Demasiadas solicitudes desde esta IP, intente más tarde." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => !req.path.startsWith("/api")
  });

  app.use(limiter);
}

