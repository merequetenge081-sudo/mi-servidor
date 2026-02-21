import "dotenv/config";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { Organization } from "../src/models/Organization.js";
import { Event } from "../src/models/Event.js";
import { Leader } from "../src/models/Leader.js";
import { Registration } from "../src/models/Registration.js";

async function ensureDefaultOrg() {
  let defaultOrg = await Organization.findOne({ slug: "default" });
  if (!defaultOrg) {
    defaultOrg = new Organization({
      name: "Default Organization",
      slug: "default",
      description: "Organizacion por defecto para migraciones",
      status: "active",
      plan: "pro"
    });
    await defaultOrg.save();
  }
  return defaultOrg;
}

async function migrateOrg(sourceOrgId) {
  if (!sourceOrgId) {
    console.error("Debes pasar el organizationId origen como argumento.");
    process.exit(1);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error("MongoDB no disponible. Abortando migracion.");
    process.exit(1);
  }

  const defaultOrg = await ensureDefaultOrg();
  const defaultOrgId = defaultOrg._id.toString();

  const eventResult = await Event.updateMany(
    { organizationId: sourceOrgId },
    { $set: { organizationId: defaultOrgId } }
  );

  const leaderResult = await Leader.updateMany(
    { organizationId: sourceOrgId },
    { $set: { organizationId: defaultOrgId } }
  );

  const registrationResult = await Registration.updateMany(
    { organizationId: sourceOrgId },
    { $set: { organizationId: defaultOrgId } }
  );

  console.log(`Eventos movidos: ${eventResult.modifiedCount}`);
  console.log(`Lideres movidos: ${leaderResult.modifiedCount}`);
  console.log(`Registros movidos: ${registrationResult.modifiedCount}`);

  await disconnectDB();
}

migrateOrg(process.argv[2]).catch((error) => {
  console.error("Error en migracion:", error);
  process.exit(1);
});
