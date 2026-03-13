import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URL || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("[EXPLAIN] Missing MONGO_URL or MONGODB_URI");
  process.exit(1);
}

const EXPLAINS = [
  {
    id: "registrations_list_event_created",
    collection: "registrations",
    kind: "find",
    query: { organizationId: "__ORG__", eventId: "__EVENT__" },
    sort: { createdAt: -1 },
    limit: 20
  },
  {
    id: "registrations_list_event_workflow_created",
    collection: "registrations",
    kind: "find",
    query: { organizationId: "__ORG__", eventId: "__EVENT__", workflowStatus: "pending_call" },
    sort: { createdAt: -1 },
    limit: 20
  },
  {
    id: "leaders_list_event_active_name",
    collection: "leaders",
    kind: "find",
    query: { organizationId: "__ORG__", eventId: "__EVENT__", active: true },
    sort: { name: 1 },
    limit: 20
  },
  {
    id: "skills_jobs_recent_completed",
    collection: "skilljobs",
    kind: "find",
    query: { organizationId: "__ORG__", status: "completed" },
    sort: { finishedAt: -1 },
    limit: 20
  },
  {
    id: "inconsistencies_open_by_type",
    collection: "deduplicationflags",
    kind: "find",
    query: {
      organizationId: "__ORG__",
      eventId: "__EVENT__",
      status: "open",
      flagType: "puesto_localidad_mismatch"
    },
    sort: { createdAt: -1 },
    limit: 20
  },
  {
    id: "materialized_campaign_latest",
    collection: "campaignmetrics",
    kind: "find",
    query: { eventId: "__EVENT__" },
    sort: { date: -1, createdAt: -1 },
    limit: 1
  }
];

function summarizePlan(plan = {}) {
  const cursor = plan.queryPlanner?.winningPlan || {};
  const exec = plan.executionStats || {};
  return {
    stage: cursor.stage || cursor.inputStage?.stage || "unknown",
    indexName:
      cursor.indexName ||
      cursor.inputStage?.indexName ||
      cursor.inputStage?.inputStage?.indexName ||
      null,
    totalDocsExamined: exec.totalDocsExamined ?? null,
    totalKeysExamined: exec.totalKeysExamined ?? null,
    executionTimeMillis: exec.executionTimeMillis ?? null
  };
}

async function run() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  const db = mongoose.connection.db;
  let org = process.env.EXPLAIN_ORG_ID;
  let event = process.env.EXPLAIN_EVENT_ID;
  if (!org || !event) {
    const sample = await db.collection("registrations").findOne(
      { organizationId: { $exists: true }, eventId: { $exists: true } },
      { projection: { organizationId: 1, eventId: 1 } }
    );
    org = org || sample?.organizationId;
    event = event || sample?.eventId;
  }
  if (!org || !event) {
    console.error("[EXPLAIN] Could not resolve org/event. Set EXPLAIN_ORG_ID and EXPLAIN_EVENT_ID.");
    process.exit(1);
  }
  const output = [];

  for (const shape of EXPLAINS) {
    const query = JSON.parse(JSON.stringify(shape.query).replaceAll("__ORG__", org).replaceAll("__EVENT__", event));
    const collection = db.collection(shape.collection);
    try {
      const explain = await collection
        .find(query)
        .sort(shape.sort || {})
        .limit(shape.limit || 20)
        .explain("executionStats");
      output.push({
        id: shape.id,
        collection: shape.collection,
        query,
        sort: shape.sort || {},
        summary: summarizePlan(explain)
      });
    } catch (error) {
      output.push({
        id: shape.id,
        collection: shape.collection,
        query,
        sort: shape.sort || {},
        error: error.message
      });
    }
  }

  console.log(JSON.stringify(output, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("[EXPLAIN] Fatal:", error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
