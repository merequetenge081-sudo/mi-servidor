import "dotenv/config";
import { connectDB } from "../../src/config/db.js";
import votingHierarchyService from "../../src/services/votingHierarchy.service.js";

async function main() {
  await connectDB();
  const result = await votingHierarchyService.backfillAll({});
  console.log("[backfill-voting-hierarchy]", JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("[backfill-voting-hierarchy] failed", error);
  process.exit(1);
});
