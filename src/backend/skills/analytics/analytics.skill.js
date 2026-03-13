import { Registration } from "../../../models/Registration.js";
import { DailyMetric } from "../../../models/DailyMetric.js";
import { TerritoryMetric } from "../../../models/TerritoryMetric.js";
import { CampaignMetric } from "../../../models/CampaignMetric.js";
import { applyCleanAnalyticsFilter } from "../../../shared/analyticsFilter.js";

function toDay(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

export async function recalculateCleanAnalytics({
  organizationId,
  eventId = null,
  date = toDay()
}) {
  const base = {
    organizationId,
    ...(eventId ? { eventId } : {})
  };

  const totalRaw = await Registration.countDocuments(base);
  const cleanMatch = applyCleanAnalyticsFilter({ ...base });
  const validRecords = await Registration.countDocuments(cleanMatch);
  const duplicateRecords = await Registration.countDocuments({
    ...base,
    workflowStatus: "duplicate"
  });
  const confirmedRecords = await Registration.countDocuments({
    ...cleanMatch,
    workflowStatus: "confirmed"
  });
  const flaggedRecords = await Registration.countDocuments({
    ...base,
    workflowStatus: "flagged"
  });

  await DailyMetric.updateOne(
    { organizationId, eventId: eventId || null, date },
    {
      $set: {
        totalRecords: totalRaw,
        validRecords,
        duplicateRecords,
        confirmedRecords,
        flaggedRecords
      }
    },
    { upsert: true }
  );

  await CampaignMetric.updateOne(
    { organizationId, eventId: eventId || "global", date },
    {
      $set: {
        totalRecords: totalRaw,
        validRecords,
        duplicates: duplicateRecords,
        confirmed: confirmedRecords,
        pendingCall: await Registration.countDocuments({
          ...base,
          workflowStatus: "pending_call"
        })
      }
    },
    { upsert: true }
  );

  const territoryAgg = await Registration.aggregate([
    { $match: cleanMatch },
    {
      $group: {
        _id: { $ifNull: ["$localidad", "SIN_LOCALIDAD"] },
        totalRecords: { $sum: 1 },
        confirmedRecords: {
          $sum: {
            $cond: [{ $eq: ["$workflowStatus", "confirmed"] }, 1, 0]
          }
        }
      }
    }
  ]);

  for (const row of territoryAgg) {
    await TerritoryMetric.updateOne(
      {
        organizationId,
        eventId: eventId || null,
        date,
        territory: row._id
      },
      {
        $set: {
          totalRecords: row.totalRecords,
          validRecords: row.totalRecords,
          confirmedRecords: row.confirmedRecords
        }
      },
      { upsert: true }
    );
  }

  return {
    skill: "analytics",
    date,
    totalRaw,
    validRecords,
    duplicateRecords,
    confirmedRecords,
    flaggedRecords,
    territories: territoryAgg.length
  };
}

export default {
  recalculateCleanAnalytics
};
