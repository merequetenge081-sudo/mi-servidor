import { connectDB, disconnectDB } from "../../src/config/db.js";
import { Registration } from "../../src/models/index.js";
import officialE14CatalogService from "../../src/services/officialE14Catalog.service.js";
import votingHierarchyService from "../../src/services/votingHierarchy.service.js";

async function run() {
  await connectDB();
  const previousStatuses = await Registration.find(
    {},
    { officialValidationStatus: 1 }
  ).lean();
  const previousStatusById = new Map(
    previousStatuses.map((row) => [String(row._id), row.officialValidationStatus || "pending_official_validation"])
  );
  const scope = await votingHierarchyService.buildResolvedScope({}, {
    includeConfirmations: false,
    persistHierarchy: false
  });

  const validation = await officialE14CatalogService.validateBulkRegistrations(scope.registrations, {
    organizationId: null,
    persist: true
  });

  const reclassified = {
    invalidPuestoToInvalidMesa: 0,
    invalidPuestoToOfficialValid: 0,
    invalidPuestoToMismatchedLocalidad: 0
  };
  validation.results.forEach((row) => {
    const before = previousStatusById.get(String(row.registrationId));
    const after = row.officialValidation?.mismatchType || "pending_official_validation";
    if (before === "invalid_puesto" && after === "invalid_mesa") reclassified.invalidPuestoToInvalidMesa += 1;
    if (before === "invalid_puesto" && after === "official_valid") reclassified.invalidPuestoToOfficialValid += 1;
    if (before === "invalid_puesto" && after === "mismatched_localidad") reclassified.invalidPuestoToMismatchedLocalidad += 1;
  });

  console.log(JSON.stringify({
    success: true,
    catalogVersion: validation.catalog.version,
    total: validation.results.length,
    officialValid: validation.officialRows.length,
    invalidOrIncomplete: validation.errorRows.length,
    counters: validation.counters,
    reclassified
  }, null, 2));
  votingHierarchyService.clearCaches();
  await disconnectDB();
}

run().catch(async (error) => {
  console.error("[BACKFILL OFFICIAL VALIDATION] Fatal:", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
