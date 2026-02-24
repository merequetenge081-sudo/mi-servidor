export const config = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",
  apiUrl: process.env.API_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? null : "dev-secret-key-for-testing-only-change-in-production")
};

// Validación en producción
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured in production");
}

