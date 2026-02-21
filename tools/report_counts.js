import "dotenv/config";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { Leader } from "../src/models/Leader.js";
import { Registration } from "../src/models/Registration.js";
import { Event } from "../src/models/Event.js";
import { Organization } from "../src/models/Organization.js";

async function printCounts() {
  const connected = await connectDB();
  if (!connected) {
    console.error("No se pudo conectar a MongoDB");
    return;
  }

  const orgs = await Organization.find({}, { name: 1, slug: 1 }).lean();
  const orgMap = new Map(orgs.map((o) => [o._id.toString(), `${o.name} (${o.slug})`]));

  const leadersByOrg = await Leader.aggregate([
    { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const registrationsByOrg = await Registration.aggregate([
    { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  const leadersByOrgEvent = await Leader.aggregate([
    { $group: { _id: { org: "$organizationId", event: "$eventId" }, count: { $sum: 1 } } },
    { $sort: { "_id.org": 1, "_id.event": 1 } }
  ]);

  const registrationsByOrgEvent = await Registration.aggregate([
    { $group: { _id: { org: "$organizationId", event: "$eventId" }, count: { $sum: 1 } } },
    { $sort: { "_id.org": 1, "_id.event": 1 } }
  ]);

  const eventsByOrg = await Event.aggregate([
    { $group: { _id: "$organizationId", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);

  console.log("\n=== ORGANIZACIONES ===");
  orgs.forEach((o) => {
    console.log(`- ${o._id.toString()} :: ${o.name} (${o.slug})`);
  });

  console.log("\n=== LIDERES POR ORGANIZACION ===");
  leadersByOrg.forEach((row) => {
    const label = orgMap.get(row._id) || row._id || "(sin org)";
    console.log(`- ${label}: ${row.count}`);
  });

  console.log("\n=== REGISTROS POR ORGANIZACION ===");
  registrationsByOrg.forEach((row) => {
    const label = orgMap.get(row._id) || row._id || "(sin org)";
    console.log(`- ${label}: ${row.count}`);
  });

  console.log("\n=== EVENTOS POR ORGANIZACION ===");
  eventsByOrg.forEach((row) => {
    const label = orgMap.get(row._id) || row._id || "(sin org)";
    console.log(`- ${label}: ${row.count}`);
  });

  console.log("\n=== LIDERES POR ORG Y EVENTO ===");
  leadersByOrgEvent.forEach((row) => {
    const orgLabel = orgMap.get(row._id.org) || row._id.org || "(sin org)";
    const eventLabel = row._id.event || "(sin evento)";
    console.log(`- ${orgLabel} | ${eventLabel}: ${row.count}`);
  });

  console.log("\n=== REGISTROS POR ORG Y EVENTO ===");
  registrationsByOrgEvent.forEach((row) => {
    const orgLabel = orgMap.get(row._id.org) || row._id.org || "(sin org)";
    const eventLabel = row._id.event || "(sin evento)";
    console.log(`- ${orgLabel} | ${eventLabel}: ${row.count}`);
  });
}

printCounts()
  .catch((error) => {
    console.error("Error en reporte:", error);
  })
  .finally(async () => {
    await disconnectDB();
  });
