import { connectDB, disconnectDB } from "../../src/config/db.js";
import { MesaOficialBogota } from "../../src/models/index.js";
import officialE14CatalogService from "../../src/services/officialE14Catalog.service.js";

async function run() {
  await connectDB();
  const result = await officialE14CatalogService.syncOfficialCatalog("bogota");
  const puestosPorZonaRaw = await MesaOficialBogota.aggregate([
    { $match: { corporacion: "CAMARA" } },
    { $group: { _id: "$localidad", puestos: { $addToSet: "$normalizedPuesto" }, mesas: { $sum: 1 } } },
    { $project: { _id: 0, zona: "$_id", puestos: { $size: "$puestos" }, mesas: 1 } },
    { $sort: { zona: 1 } }
  ]);
  console.log(JSON.stringify({
    success: true,
    scope: "bogota",
    result,
    puestosPorZona: puestosPorZonaRaw
  }, null, 2));
  await disconnectDB();
}

run().catch(async (error) => {
  console.error("[SYNC OFFICIAL E14 CATALOG] Fatal:", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
