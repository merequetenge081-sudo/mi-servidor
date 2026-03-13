import mongoose from "mongoose";
import { connectDB, disconnectDB } from "../../src/config/db.js";

const MONGO_URI = process.env.MONGO_URL || process.env.MONGODB_URI;
const SHOULD_APPLY = process.argv.includes("--apply");

const INDEX_PLAN = [
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_created_desc" },
    reason: "Main list/export v2 with event filters + recent-first sort"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, leaderId: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_leader_created_desc" },
    reason: "v2 registrations filtered by leader + createdAt sort"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, workflowStatus: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_workflow_created_desc" },
    reason: "v2 registrations/status filters + createdAt sort"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, dataIntegrityStatus: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_integrity_created_desc" },
    reason: "v2 registrations/integrity filters + createdAt sort"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, confirmed: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_confirmed_created_desc" },
    reason: "v2 registrations confirmed/pending filters + createdAt sort"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, updatedAt: -1 },
    options: { name: "idx_reg_org_event_updated_desc" },
    reason: "skills batch selection sorted by updatedAt"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, phone: 1 },
    options: {
      name: "idx_reg_org_event_phone_partial",
      partialFilterExpression: { phone: { $exists: true, $type: "string" } }
    },
    reason: "deduplication/repeated-phone lookups by event"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, localidadId: 1, puestoId: 1, mesa: 1 },
    options: { name: "idx_reg_org_event_localidad_puesto_mesa_num" },
    reason: "Canonical hierarchy aggregation for analytics and E14 by mesa"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, localidad: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_localidad_created_desc" },
    reason: "Strict Bogota/resto filtering and locality-first registration tables"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, puestoMatchReviewRequired: 1, puestoMatchStatus: 1, updatedAt: -1 },
    options: { name: "idx_reg_match_review_status_updated_desc" },
    reason: "Legacy puesto review queues and reconciliation reruns"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, officialValidationStatus: 1, createdAt: -1 },
    options: { name: "idx_reg_org_event_official_status_created_desc" },
    reason: "Official-valid vs erroneous/incomplete lists for analytics and E14"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, movedToErrorBucket: 1, officialValidationReason: 1, createdAt: -1 },
    options: { name: "idx_reg_org_error_bucket_reason_created_desc" },
    reason: "Erroneous/incomplete review buckets by reason"
  },
  {
    collection: "registrations",
    key: { organizationId: 1, eventId: 1, officialPuestoCodigo: 1, officialMesaNumero: 1 },
    options: { name: "idx_reg_org_event_official_puesto_mesa" },
    reason: "Official catalog traceability and mesa-level troubleshooting"
  },
  {
    collection: "mesas_oficiales_bogota",
    key: { normalizedLocalidad: 1, normalizedPuesto: 1, mesa: 1 },
    options: { name: "idx_official_bogota_scope_puesto_mesa" },
    reason: "Official catalog lookup by locality, puesto and mesa"
  },
  {
    collection: "puestos",
    key: { organizationId: 1, localidadId: 1, normalizedNombre: 1 },
    options: { name: "idx_puestos_org_localidad_nombre" },
    reason: "Canonical puesto lookup by locality and normalized name"
  },
  {
    collection: "mesas",
    key: { organizationId: 1, puestoId: 1, numero: 1 },
    options: { name: "idx_mesas_org_puesto_numero" },
    reason: "Canonical mesa lookup by puesto and table number"
  },
  {
    collection: "e14_confirmation_by_mesa",
    key: { organizationId: 1, eventId: 1, localidadId: 1, puestoId: 1, mesa: 1 },
    options: { name: "idx_e14_org_event_localidad_puesto_mesa" },
    reason: "E14 comparison and manual save by canonical hierarchy"
  },
  {
    collection: "puesto_match_reviews",
    key: { organizationId: 1, normalizedRawPuesto: 1, rawLocalidadNormalized: 1 },
    options: { name: "idx_puesto_match_review_scope" },
    reason: "Legacy free-text puesto review lookup and cache reuse"
  },
  {
    collection: "leaders",
    key: { organizationId: 1, eventId: 1, name: 1 },
    options: { name: "idx_leader_org_event_name" },
    reason: "v2 leaders list sorted by name with org/event scope"
  },
  {
    collection: "leaders",
    key: { organizationId: 1, eventId: 1, active: 1, name: 1 },
    options: { name: "idx_leader_org_event_active_name" },
    reason: "v2 leaders list with active filter + name sort"
  },
  {
    collection: "skilljobs",
    key: { organizationId: 1, status: 1, finishedAt: -1, skillName: 1 },
    options: { name: "idx_skilljob_org_status_finished_skill" },
    reason: "skills health/jobs: recent completed jobs by status and skill"
  },
  {
    collection: "skillresults",
    key: { jobId: 1, createdAt: -1 },
    options: { name: "idx_skillresult_job_created_desc" },
    reason: "job detail view sorted by newest results"
  },
  {
    collection: "deduplicationflags",
    key: { organizationId: 1, eventId: 1, status: 1, flagType: 1, createdAt: -1 },
    options: { name: "idx_dedup_org_event_status_type_created" },
    reason: "inconsistencies view/count by status+type"
  },
  {
    collection: "campaignmetrics",
    key: { eventId: 1, date: -1, createdAt: -1 },
    options: { name: "idx_campaignmetric_event_date_created" },
    reason: "materialized analytics reads latest by event"
  },
  {
    collection: "dailymetrics",
    key: { eventId: 1, date: -1, createdAt: -1 },
    options: { name: "idx_dailymetric_event_date_created" },
    reason: "materialized analytics reads latest by event"
  },
  {
    collection: "leadermetrics",
    key: { eventId: 1, date: -1, totalUploaded: -1 },
    options: { name: "idx_leadermetric_event_date_uploaded" },
    reason: "materialized analytics top leaders by latest date"
  },
  {
    collection: "territorymetrics",
    key: { eventId: 1, date: -1, totalRecords: -1 },
    options: { name: "idx_territorymetric_event_date_total" },
    reason: "materialized analytics top territories by latest date"
  }
];

function comparableOptions(options = {}) {
  const out = {};
  ["unique", "sparse", "partialFilterExpression", "collation"].forEach((key) => {
    if (options[key] !== undefined) out[key] = options[key];
  });
  return out;
}

function sameKey(a = {}, b = {}) {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);
  if (aEntries.length !== bEntries.length) return false;
  return aEntries.every(([k, v], idx) => {
    const [kb, vb] = bEntries[idx] || [];
    return k === kb && v === vb;
  });
}

function sameOptions(a = {}, b = {}) {
  return JSON.stringify(comparableOptions(a)) === JSON.stringify(comparableOptions(b));
}

async function run() {
  if (MONGO_URI) {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 30000 });
  } else {
    await connectDB();
  }
  const db = mongoose.connection.db;
  const existingCollections = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);

  const summary = {
    applyMode: SHOULD_APPLY,
    planned: INDEX_PLAN.length,
    skippedCollectionMissing: 0,
    alreadyPresent: 0,
    created: 0,
    failed: 0,
    details: []
  };

  for (const spec of INDEX_PLAN) {
    const detail = {
      collection: spec.collection,
      key: spec.key,
      options: spec.options,
      reason: spec.reason,
      action: "pending"
    };

    if (!existingCollections.includes(spec.collection)) {
      detail.action = "skip_collection_missing";
      summary.skippedCollectionMissing += 1;
      summary.details.push(detail);
      continue;
    }

    const collection = db.collection(spec.collection);
    const indexes = await collection.indexes();
    const alreadyExists = indexes.some((idx) => sameKey(idx.key, spec.key) && sameOptions(idx, spec.options));
    if (alreadyExists) {
      detail.action = "already_present";
      summary.alreadyPresent += 1;
      summary.details.push(detail);
      continue;
    }

    if (!SHOULD_APPLY) {
      detail.action = "plan_create";
      summary.details.push(detail);
      continue;
    }

    try {
      const createdName = await collection.createIndex(spec.key, spec.options);
      detail.action = "created";
      detail.createdName = createdName;
      summary.created += 1;
    } catch (error) {
      detail.action = "failed";
      detail.error = error.message;
      summary.failed += 1;
    }
    summary.details.push(detail);
  }

  console.log(JSON.stringify(summary, null, 2));
  await disconnectDB();
}

run().catch(async (error) => {
  console.error("[INDEX AUDIT] Fatal:", error);
  try {
    await disconnectDB();
  } catch {
    // ignore
  }
  process.exit(1);
});
