import mongoose from "mongoose";

const COLLECTIONS_TO_ANALYZE = [
  "registrations",
  "call_attempts",
  "verification_results",
  "leaders",
  "events",
  "campaigns",
  "metrics"
];

const RECOMMENDED_INDEXES = {
  registrations: ["eventId", "workflowStatus", "phone", "leaderId"],
  call_attempts: ["registrationId", "attemptedAt"],
  metrics: ["eventId", "leaderId"]
};

function bytesToMB(bytes) {
  if (!bytes || Number.isNaN(bytes)) return 0;
  return Number((bytes / (1024 * 1024)).toFixed(3));
}

async function getCollectionStats(collection) {
  if (typeof collection.stats === "function") {
    return collection.stats();
  }
  const db = collection.s?.db || mongoose.connection.db;
  return db.command({ collStats: collection.collectionName });
}

function detectMissingIndexes(indexes, recommendedFields) {
  if (!Array.isArray(recommendedFields) || recommendedFields.length === 0) return [];
  const existing = Array.isArray(indexes) ? indexes : [];
  return recommendedFields.filter((field) => {
    return !existing.some((idx) => idx?.key && Object.prototype.hasOwnProperty.call(idx.key, field));
  });
}

async function analyzeLargeDocuments(collection) {
  try {
    const pipeline = [
      { $project: { _id: 1, size: { $bsonSize: "$$ROOT" } } },
      { $sort: { size: -1 } },
      { $limit: 10 }
    ];
    const rows = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
    const over1MB = rows.filter((r) => (r.size || 0) >= 1024 * 1024);
    return {
      top: rows.map((r) => ({ _id: r._id, sizeBytes: r.size, sizeMB: bytesToMB(r.size) })),
      countOver1MB: over1MB.length
    };
  } catch (error) {
    return {
      top: [],
      countOver1MB: 0,
      warning: `No se pudo calcular $bsonSize: ${error.message}`
    };
  }
}

async function analyzeRareFields(collection, totalDocuments) {
  if (!totalDocuments) return { suspiciousFields: [], fieldStats: [] };
  const pipeline = [
    { $project: { fields: { $objectToArray: "$$ROOT" } } },
    { $unwind: "$fields" },
    { $group: { _id: "$fields.k", count: { $sum: 1 } } },
    { $sort: { count: 1 } }
  ];
  const rows = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
  const suspicious = rows
    .filter((f) => f._id !== "_id")
    .filter((f) => {
      const ratio = f.count / totalDocuments;
      return ratio <= 0.03 && f.count <= 20;
    })
    .map((f) => ({ field: f._id, count: f.count, ratio: Number((f.count / totalDocuments).toFixed(4)) }));

  return {
    suspiciousFields: suspicious.map((f) => f.field),
    fieldStats: suspicious
  };
}

async function analyzeRegistrationDuplicates(collection) {
  const pipeline = [
    {
      $match: {
        phone: { $exists: true, $nin: [null, ""] },
        eventId: { $exists: true, $nin: [null, ""] }
      }
    },
    {
      $group: {
        _id: { phone: "$phone", eventId: "$eventId" },
        count: { $sum: 1 }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 100 }
  ];
  const groups = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();
  return {
    groups: groups.map((g) => ({ phone: g._id.phone, eventId: g._id.eventId, count: g.count })),
    totalGroups: groups.length
  };
}

export async function runDatabaseOptimizationSkill() {
  const db = mongoose.connection?.db;
  if (!db) {
    throw new Error("MongoDB no está conectado para ejecutar databaseOptimization");
  }

  const warnings = [];
  const recommendations = [];
  const byCollection = {};
  const suspiciousFields = new Set();

  let collectionsAnalyzed = 0;
  let duplicateGroups = 0;
  let largeDocuments = 0;
  let indexesMissing = 0;

  let existingCollectionNames = [];
  try {
    existingCollectionNames = await db.listCollections({}, { nameOnly: true }).toArray();
    existingCollectionNames = existingCollectionNames.map((c) => c.name);
  } catch (error) {
    warnings.push(`No se pudo listar colecciones: ${error.message}`);
  }

  for (const collectionName of COLLECTIONS_TO_ANALYZE) {
    const exists = existingCollectionNames.includes(collectionName);
    if (!exists) {
      warnings.push(`Colección no encontrada: ${collectionName}`);
      continue;
    }

    try {
      const collection = db.collection(collectionName);
      const stats = await getCollectionStats(collection);
      const count = Number(stats.count || 0);
      const avgSize = Number(stats.avgObjSize || 0);
      const size = Number(stats.size || 0);

      const indexList = await collection.indexes();
      const missing = detectMissingIndexes(indexList, RECOMMENDED_INDEXES[collectionName] || []);
      indexesMissing += missing.length;
      missing.forEach((f) => recommendations.push(`Create index ${collectionName}.${f}`));

      const large = await analyzeLargeDocuments(collection);
      largeDocuments += Number(large.countOver1MB || 0);
      if (large.countOver1MB > 0) {
        recommendations.push(`Investigate large documents in ${collectionName}`);
      }
      if (large.warning) warnings.push(`[${collectionName}] ${large.warning}`);

      const rare = await analyzeRareFields(collection, count);
      rare.suspiciousFields.forEach((f) => suspiciousFields.add(f));
      rare.suspiciousFields.forEach((f) => recommendations.push(`Review or remove unused field ${collectionName}.${f}`));

      let duplicates = { totalGroups: 0, groups: [] };
      if (collectionName === "registrations") {
        duplicates = await analyzeRegistrationDuplicates(collection);
        duplicateGroups += duplicates.totalGroups;
      }

      byCollection[collectionName] = {
        documents: count,
        sizeBytes: size,
        sizeMB: bytesToMB(size),
        avgDocumentSizeBytes: avgSize,
        avgDocumentSizeKB: Number((avgSize / 1024).toFixed(3)),
        indexes: indexList.map((idx) => idx.key),
        missingIndexes: missing,
        largeDocumentsTop: large.top,
        suspiciousFields: rare.suspiciousFields,
        duplicates
      };

      collectionsAnalyzed += 1;
    } catch (error) {
      warnings.push(`[${collectionName}] error analizando colección: ${error.message}`);
    }
  }

  if (duplicateGroups > 0) {
    recommendations.push("Run deduplication skill after reviewing duplicate groups");
  }

  return {
    collectionsAnalyzed,
    duplicateGroups,
    largeDocuments,
    indexesMissing,
    suspiciousFields: Array.from(suspiciousFields),
    recommendations: Array.from(new Set(recommendations)),
    warnings,
    byCollection
  };
}

export default {
  runDatabaseOptimizationSkill
};
