const allowedEnvs = new Set(["development", "staging", "production"]);

export const currentEnv = process.env.NODE_ENV || "development";

if (!allowedEnvs.has(currentEnv)) {
  console.error("Invalid NODE_ENV");
  process.exit(1);
}

export const isProduction = currentEnv === "production";
export const isStaging = currentEnv === "staging";
export const isDevelopment = currentEnv === "development";
