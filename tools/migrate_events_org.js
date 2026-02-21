import "dotenv/config";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { Organization } from "../src/models/Organization.js";
import { Event } from "../src/models/Event.js";
import { Registration } from "../src/models/Registration.js";
import { Leader } from "../src/models/Leader.js";

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

async function migrate() {
  const connected = await connectDB();
  if (!connected) {
    console.error("MongoDB no disponible. Abortando migracion.");
    process.exit(1);
  }

  const defaultOrg = await ensureDefaultOrg();
  const defaultOrgId = defaultOrg._id.toString();

  const missingOrgFilter = {
    $or: [
      { organizationId: { $exists: false } },
      { organizationId: null },
      { organizationId: "" }
    ]
  };

  const eventsToFix = await Event.find(missingOrgFilter).select("_id name");
  const eventIds = eventsToFix.map(event => event._id.toString());

  const hasEventsToFix = eventIds.length > 0;

  const eventResult = hasEventsToFix
    ? await Event.updateMany(missingOrgFilter, {
        $set: { organizationId: defaultOrgId }
      })
    : { modifiedCount: 0 };

  const leaderResult = await Leader.updateMany(missingOrgFilter, {
    $set: { organizationId: defaultOrgId }
  });

  const registrationFilter = hasEventsToFix
    ? { eventId: { $in: eventIds }, ...missingOrgFilter }
    : missingOrgFilter;

  const registrationResult = await Registration.updateMany(registrationFilter, {
    $set: { organizationId: defaultOrgId }
  });

  console.log(`Eventos actualizados: ${eventResult.modifiedCount}`);
  console.log(`Lideres actualizados: ${leaderResult.modifiedCount}`);
  console.log(`Registros actualizados: ${registrationResult.modifiedCount}`);

  await disconnectDB();
}

migrate().catch(error => {
  console.error("Error en migracion:", error);
  process.exit(1);
});
