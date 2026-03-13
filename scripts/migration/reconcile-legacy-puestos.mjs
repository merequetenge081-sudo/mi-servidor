import "dotenv/config";
import { connectDB, disconnectDB } from "../../src/config/db.js";
import { Registration } from "../../src/models/index.js";
import puestoMatchingService from "../../src/services/puestoMatching.service.js";
import votingHierarchyService from "../../src/services/votingHierarchy.service.js";

function toObjectId(value) {
  if (!value) return null;
  return value;
}

async function main() {
  await connectDB();

  const registrations = await Registration.find(
    {
      votingPlace: { $nin: [null, ""] },
      $or: [
        { puestoId: null },
        { puestoId: { $exists: false } },
        { puestoMatchReviewRequired: true },
        {
          $expr: {
            $ne: [
              { $ifNull: ["$puestoMatchRawName", ""] },
              { $ifNull: ["$votingPlace", ""] }
            ]
          }
        }
      ]
    },
    {
      organizationId: 1,
      eventId: 1,
      localidad: 1,
      localidadId: 1,
      votingPlace: 1,
      legacyVotingPlace: 1,
      puestoMatchRawName: 1,
      votingTable: 1,
      mesa: 1
    }
  ).lean();

  const rowsByOrg = new Map();
  registrations.forEach((row) => {
    const orgId = String(row.organizationId || "");
    if (!rowsByOrg.has(orgId)) rowsByOrg.set(orgId, []);
    rowsByOrg.get(orgId).push(row);
  });

  let applied = 0;
  let pending = 0;
  let crossLocalidad = 0;
  const writes = [];

  for (const [organizationId, rows] of rowsByOrg.entries()) {
    const resolved = await puestoMatchingService.resolveBulkLegacyPuestos(
      rows.map((row) => ({
        registrationId: String(row._id),
        rawPuesto: row.votingPlace,
        rawLocalidad: row.localidad,
        rawLocalidadId: row.localidadId || null
      })),
      { organizationId }
    );

    rows.forEach((row) => {
      const result = resolved.byRegistrationId.get(String(row._id));
      if (!result) return;

      if (result.autoAssignable && result.suggestedPuestoId) {
        applied += 1;
        writes.push({
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: {
                puestoId: toObjectId(result.suggestedPuestoId),
                localidadId: toObjectId(result.suggestedLocalidadId),
                localidad: result.suggestedLocalidadNombre || row.localidad || "",
                legacyVotingPlace: row.legacyVotingPlace || row.votingPlace || "",
                votingPlace: result.suggestedPuestoNombre || row.votingPlace || "",
                puestoMatchStatus: "matched",
                puestoMatchType: result.matchType || "",
                puestoMatchConfidence: result.confidence ?? null,
                puestoMatchReviewRequired: false,
                puestoMatchRawName: row.votingPlace || "",
                puestoMatchSuggestedPuestoId: toObjectId(result.suggestedPuestoId),
                puestoMatchSuggestedLocalidadId: toObjectId(result.suggestedLocalidadId),
                puestoMatchResolvedAt: new Date()
              }
            }
          }
        });
      } else {
        if (result.status === "cross_localidad") crossLocalidad += 1;
        else pending += 1;
        writes.push({
          updateOne: {
            filter: { _id: row._id },
            update: {
              $set: {
                legacyVotingPlace: row.legacyVotingPlace || row.votingPlace || "",
                puestoMatchStatus: result.status === "cross_localidad" ? "cross_localidad" : "pending_review",
                puestoMatchType: result.matchType || "",
                puestoMatchConfidence: result.confidence ?? null,
                puestoMatchReviewRequired: true,
                puestoMatchRawName: row.votingPlace || "",
                puestoMatchSuggestedPuestoId: toObjectId(result.suggestedPuestoId),
                puestoMatchSuggestedLocalidadId: toObjectId(result.suggestedLocalidadId),
                puestoMatchResolvedAt: new Date()
              }
            }
          }
        });
      }
    });
  }

  if (writes.length > 0) {
    await Registration.bulkWrite(writes, { ordered: false });
  }

  await votingHierarchyService.backfillAll({});

  console.log(JSON.stringify({
    totalRows: registrations.length,
    applied,
    pending,
    crossLocalidad
  }, null, 2));

  await disconnectDB();
}

main().catch(async (error) => {
  console.error("[reconcile-legacy-puestos] failed", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
