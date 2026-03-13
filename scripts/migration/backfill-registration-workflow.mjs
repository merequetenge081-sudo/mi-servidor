import "dotenv/config";
import mongoose from "mongoose";
import { Registration } from "../../src/models/Registration.js";

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  "mongodb+srv://merequetenge081_db_user:NLJGYG4yki661qLx@seguimiento-datos.r7d8o2g.mongodb.net/seguimiento-datos?retryWrites=true&w=majority&appName=seguimiento-datos";

async function run() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });

  const cursor = Registration.find({}, {
    _id: 1,
    dataIntegrityStatus: 1,
    workflowStatus: 1,
    validationErrors: 1,
    deduplicationFlags: 1
  }).cursor();

  let updated = 0;
  for await (const reg of cursor) {
    const patch = {};

    if (!reg.dataIntegrityStatus) patch.dataIntegrityStatus = "valid";
    if (!reg.workflowStatus) {
      patch.workflowStatus = reg.dataIntegrityStatus === "invalid" ? "invalid" : "new";
    }
    if (!Array.isArray(reg.validationErrors)) patch.validationErrors = [];
    if (!Array.isArray(reg.deduplicationFlags)) patch.deduplicationFlags = [];

    if (Object.keys(patch).length > 0) {
      await Registration.updateOne({ _id: reg._id }, { $set: patch });
      updated += 1;
    }
  }

  console.log(`Backfill completado. Registros actualizados: ${updated}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Error en backfill:", error.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
