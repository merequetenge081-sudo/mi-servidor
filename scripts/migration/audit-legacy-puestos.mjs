import "dotenv/config";
import { connectDB, disconnectDB } from "../../src/config/db.js";
import puestoMatchingService from "../../src/services/puestoMatching.service.js";

async function main() {
  await connectDB();
  const audit = await puestoMatchingService.auditLegacyPuestos({}, {});
  const suspicious = audit.suspicious.slice(0, 150);
  console.log(JSON.stringify({
    total: audit.total,
    suspiciousCount: audit.suspicious.length,
    suspicious
  }, null, 2));
  await disconnectDB();
}

main().catch(async (error) => {
  console.error("[audit-legacy-puestos] failed", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
