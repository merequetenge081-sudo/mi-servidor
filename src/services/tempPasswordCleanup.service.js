import logger from "../config/logger.js";
import { Leader } from "../models/Leader.js";
import { getTempPasswordTtlMs } from "../utils/tempPassword.js";

export async function clearExpiredTempPasswords() {
  const ttlMs = getTempPasswordTtlMs();
  const cutoff = new Date(Date.now() - ttlMs);

  const result = await Leader.updateMany(
    {
      isTemporaryPassword: true,
      tempPasswordCreatedAt: { $lte: cutoff }
    },
    { $unset: { tempPasswordPlaintext: "", tempPasswordCreatedAt: "" } }
  );

  if (result?.modifiedCount) {
    logger.info("Temp password cleanup", {
      modifiedCount: result.modifiedCount,
      cutoff: cutoff.toISOString()
    });
  }

  return result;
}

export function startTempPasswordCleanup() {
  const intervalMinutes = parseInt(process.env.TEMP_PASSWORD_CLEANUP_INTERVAL_MINUTES, 10) || 60;

  if (intervalMinutes <= 0) {
    logger.info("Temp password cleanup disabled");
    return null;
  }

  const intervalMs = intervalMinutes * 60 * 1000;

  clearExpiredTempPasswords().catch((error) => {
    logger.warn("Temp password cleanup failed", { error: error.message });
  });

  const intervalId = setInterval(async () => {
    try {
      await clearExpiredTempPasswords();
    } catch (error) {
      logger.warn("Temp password cleanup failed", { error: error.message });
    }
  }, intervalMs);

  logger.info("Temp password cleanup scheduled", { intervalMinutes });
  return intervalId;
}
