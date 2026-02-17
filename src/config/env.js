export const config = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || "development",
  apiUrl: process.env.API_URL || "http://localhost:5000",
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "dev_secret_key_change_in_production")
};

// Validación en producción
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured in production");
}

