import mongoose from "mongoose";
import { connectDB } from "../../src/config/db.js";
import {
  prewarmDashboardMetricsCommonScopes
} from "../../src/services/metrics.service.js";

async function main() {
  const connected = await connectDB();
  if (!connected) {
    console.log(JSON.stringify({ success: false, reason: "db_not_connected" }, null, 2));
    process.exit(1);
  }

  const results = await prewarmDashboardMetricsCommonScopes();
  console.log(JSON.stringify({ success: true, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.connection.close();
    } catch {}
  });
