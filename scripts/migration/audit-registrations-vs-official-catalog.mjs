import { connectDB, disconnectDB } from "../../src/config/db.js";
import officialE14CatalogService from "../../src/services/officialE14Catalog.service.js";
import votingHierarchyService from "../../src/services/votingHierarchy.service.js";

async function run() {
  await connectDB();
  const scope = await votingHierarchyService.buildResolvedScope({}, {
    includeConfirmations: false,
    persistHierarchy: false
  });

  const validation = await officialE14CatalogService.validateBulkRegistrations(scope.registrations, {
    organizationId: null,
    persist: false
  });

  console.log(JSON.stringify({
    success: true,
    catalogVersion: validation.catalog.version,
    total: validation.results.length,
    officialValid: validation.officialRows.length,
    invalidOrIncomplete: validation.errorRows.length,
    counters: validation.counters,
    sampleErrors: validation.errorRows.slice(0, 50)
  }, null, 2));
  await disconnectDB();
}

run().catch(async (error) => {
  console.error("[AUDIT OFFICIAL VALIDATION] Fatal:", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
