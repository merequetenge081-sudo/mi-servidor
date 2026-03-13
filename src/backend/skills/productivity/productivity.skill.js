import { Registration } from "../../../models/Registration.js";
import { LeaderMetric } from "../../../models/LeaderMetric.js";

function toDay(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function recalculateLeaderProductivity({
  organizationId,
  eventId = null,
  date = toDay()
}) {
  const query = {
    organizationId,
    ...(eventId ? { eventId } : {})
  };

  const grouped = await Registration.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$leaderId",
        totalUploaded: { $sum: 1 },
        totalValid: {
          $sum: {
            $cond: [{ $eq: ["$dataIntegrityStatus", "valid"] }, 1, 0]
          }
        },
        totalDuplicates: {
          $sum: {
            $cond: [{ $eq: ["$workflowStatus", "duplicate"] }, 1, 0]
          }
        },
        totalConfirmed: {
          $sum: {
            $cond: [{ $eq: ["$workflowStatus", "confirmed"] }, 1, 0]
          }
        }
      }
    }
  ]);

  let upserted = 0;
  for (const row of grouped) {
    const effectivenessRate =
      row.totalUploaded > 0 ? Number(((row.totalConfirmed / row.totalUploaded) * 100).toFixed(2)) : 0;

    await LeaderMetric.updateOne(
      {
        organizationId,
        eventId: eventId || null,
        date,
        leaderId: row._id || "unassigned"
      },
      {
        $set: {
          totalUploaded: row.totalUploaded,
          totalValid: row.totalValid,
          totalDuplicates: row.totalDuplicates,
          totalConfirmed: row.totalConfirmed,
          effectivenessRate
        }
      },
      { upsert: true }
    );
    upserted += 1;
  }

  return {
    skill: "productivity",
    date,
    leaders: grouped.length,
    upserted
  };
}

export default {
  recalculateLeaderProductivity
};
