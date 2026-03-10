import "dotenv/config";
import { readFile } from "fs/promises";
import { resolve, extname } from "path";
import { parse as parseCsv } from "csv-parse/sync";

import { connectDB, disconnectDB } from "../src/config/db.js";
import { E14ConfirmationByMesa } from "../src/models/E14ConfirmationByMesa.js";
import { saveManualByMesa } from "../src/services/e14-confirmation.service.js";
import { getBogotaZoneCode } from "../src/shared/bogota-zones.js";
import { normalizeBogotaLocalidad, normalizeBogotaPuesto, normalizeBogotaPuestoKey, normalizeBogotaText } from "../src/shared/bogota-territory.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    if (args[key] === undefined) {
      args[key] = next;
    } else if (Array.isArray(args[key])) {
      args[key].push(next);
    } else {
      args[key] = [args[key], next];
    }
    index += 1;
  }
  return args;
}

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFloat(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toBool(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "si";
}

function ensureList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeImportedItem(raw = {}) {
  if ("votosE14Candidate105" in raw || "sourceEstadoRevision" in raw || "sourceDocumento" in raw) {
    return {
      localidad: raw.localidad,
      puesto: raw.puesto,
      mesa: raw.mesa,
      zoneCode: raw.zoneCode || null,
      votosE14Candidate105: raw.votosE14Candidate105,
      e14ListVotes: raw.e14ListVotes,
      notes: raw.notes || "",
      reviewRequired: Boolean(raw.reviewRequired),
      reviewReason: raw.reviewReason || "",
      taskId: raw.taskId || "",
      reviewPriorityRank: raw.reviewPriorityRank ?? null,
      sourceEstadoRevision: raw.sourceEstadoRevision || "",
      sourceConfidence: raw.sourceConfidence ?? null,
      sourceScoreDigito: raw.sourceScoreDigito ?? null,
      sourceScoreSegundo: raw.sourceScoreSegundo ?? null,
      sourceMetodoDigito: raw.sourceMetodoDigito || "",
      sourceDebugDir: raw.sourceDebugDir || "",
      sourceDocumento: raw.sourceDocumento || "",
      sourceArchivo: raw.sourceArchivo || "",
      sourceLocalFileUri: raw.sourceLocalFileUri || "",
      sourceCaptureAvailable: Boolean(raw.sourceCaptureAvailable),
      sourceOverlayPath: raw.sourceOverlayPath || "",
      sourceCellPath: raw.sourceCellPath || "",
      sourceMaskPath: raw.sourceMaskPath || "",
      sourcePartyBlockPath: raw.sourcePartyBlockPath || "",
    };
  }

  const localidad = raw.localidad_nombre || raw.localidad || "";
  const estado = String(raw.estado_revision || "").trim();
  const votosSugeridos = toInt(raw.votos_sugeridos);
  const reviewRequired = estado !== "ok" || votosSugeridos === null;

  return {
    localidad,
    puesto: raw.puesto || "",
    mesa: raw.mesa,
    zoneCode: raw.localidad_codigo ? String(raw.localidad_codigo).padStart(3, "0") : null,
    votosE14Candidate105: reviewRequired ? null : votosSugeridos,
    e14ListVotes: null,
    notes: raw.observaciones || raw.razon_revision_manual || "",
    reviewRequired,
    reviewReason: raw.razon_revision_manual || estado || "",
    taskId: raw.task_id || "",
    reviewPriorityRank: toInt(raw.priority_rank),
    sourceEstadoRevision: estado,
    sourceConfidence: toFloat(raw.confianza_ocr_num ?? raw.confianza_ocr),
    sourceScoreDigito: toFloat(raw.score_digito_num ?? raw.score_digito),
    sourceScoreSegundo: toFloat(raw.score_segundo_num ?? raw.score_segundo),
    sourceMetodoDigito: raw.metodo_digito || "",
    sourceDebugDir: raw.debug_dir || "",
    sourceDocumento: raw.url_documento || "",
    sourceArchivo: raw.nombre_archivo || "",
    sourceLocalFileUri: raw.local_file_uri || "",
    sourceCaptureAvailable: toBool(raw.capture_available),
    sourceOverlayPath: raw.overlay_path || "",
    sourceCellPath: raw.cell_path || "",
    sourceMaskPath: raw.mask_path || "",
    sourcePartyBlockPath: raw.party_block_path || "",
  };
}

async function loadItemsFromInput(inputPath) {
  const raw = await readFile(inputPath, "utf-8");
  const extension = extname(inputPath).toLowerCase();
  if (extension === ".json") {
    const payload = JSON.parse(raw);
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.map((item) => normalizeImportedItem(item));
  }
  if (extension === ".csv") {
    const records = parseCsv(raw, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
    });
    return records.map((record) => normalizeImportedItem(record));
  }
  throw new Error(`Formato de entrada no soportado: ${inputPath}`);
}

function buildUsage() {
  return [
    "Uso:",
    "node scripts/bulk-import-e14-confirmations.js --input <bridge.json|review.csv> [--input <otro.csv>] --organization-id <orgId> [--event-id <eventId>] [--validated-by <user>] [--dry-run]",
  ].join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args["organization-id"]) {
    console.error(buildUsage());
    process.exit(1);
  }

  const inputPaths = ensureList(args.input).map((item) => resolve(item));
  const organizationId = String(args["organization-id"]).trim();
  const eventId = args["event-id"] ? String(args["event-id"]).trim() : null;
  const validatedBy = args["validated-by"] ? String(args["validated-by"]).trim() : "bulk_import_e14";
  const dryRun = Boolean(args["dry-run"]);
  const includeReviewRequired = Boolean(args["include-review-required"]);

  const loadedGroups = await Promise.all(inputPaths.map((inputPath) => loadItemsFromInput(inputPath)));
  const items = loadedGroups.flat();
  if (items.length === 0) {
    console.log("[E14 IMPORT] No hay items para importar");
    return;
  }

  if (!dryRun) {
    const connected = await connectDB();
    if (!connected) {
      throw new Error("No se pudo conectar a la base de datos");
    }
  }

  const stats = {
    total: items.length,
    imported: 0,
    skippedReviewRequired: 0,
    skippedInvalid: 0,
    failed: 0,
  };
  const failures = [];

  try {
    for (const item of items) {
      const mesa = toInt(item.mesa);
      const votosE14Candidate105 = toInt(item.votosE14Candidate105);
      const hasBaseLocation = item.localidad && item.puesto && mesa !== null;
      if (!hasBaseLocation) {
        stats.skippedInvalid += 1;
        failures.push({ reason: "invalid_payload", item });
        continue;
      }
      if (item.reviewRequired || votosE14Candidate105 === null || votosE14Candidate105 < 0) {
        if (!includeReviewRequired) {
          stats.skippedReviewRequired += 1;
          continue;
        }
        const localidad = normalizeBogotaLocalidad(item.localidad);
        const puesto = normalizeBogotaPuesto(item.puesto);
        const zoneCode = item.zoneCode || getBogotaZoneCode(localidad) || null;
        const pendingPayload = {
          organizationId,
          eventId,
          localidad,
          puesto,
          mesa,
          zoneCode,
          normalizedLocalidad: normalizeBogotaText(localidad),
          normalizedPuesto: normalizeBogotaPuestoKey(puesto),
          votosReportadosTotales: 0,
          votosE14Candidate105: null,
          votosE14SuggestedCandidate105: votosE14Candidate105,
          e14ListVotes: toInt(item.e14ListVotes),
          confirmacionPorcentaje: null,
          diferencia: null,
          estado: "pendiente_e14",
          notes: item.notes || "",
          reviewRequired: true,
          reviewReason: item.reviewReason || item.sourceEstadoRevision || "review_required_from_scraper",
          taskId: item.taskId || "",
          reviewPriorityRank: toInt(item.reviewPriorityRank),
          sourceEstadoRevision: item.sourceEstadoRevision || "",
          sourceConfidence: item.sourceConfidence ?? null,
          sourceScoreDigito: item.sourceScoreDigito ?? null,
          sourceScoreSegundo: item.sourceScoreSegundo ?? null,
          sourceMetodoDigito: item.sourceMetodoDigito || "",
          sourceDebugDir: item.sourceDebugDir || "",
          sourceDocumento: item.sourceDocumento || "",
          sourceArchivo: item.sourceArchivo || "",
          sourceLocalFileUri: item.sourceLocalFileUri || "",
          sourceCaptureAvailable: Boolean(item.sourceCaptureAvailable),
          sourceOverlayPath: item.sourceOverlayPath || "",
          sourceCellPath: item.sourceCellPath || "",
          sourceMaskPath: item.sourceMaskPath || "",
          sourcePartyBlockPath: item.sourcePartyBlockPath || "",
          validatedAt: null,
          validatedBy,
          source: "system",
        };
        if (dryRun) {
          stats.imported += 1;
          continue;
        }
        try {
          await E14ConfirmationByMesa.updateOne(
            {
              organizationId,
              eventId,
              normalizedLocalidad: pendingPayload.normalizedLocalidad,
              normalizedPuesto: pendingPayload.normalizedPuesto,
              mesa,
            },
            { $set: pendingPayload },
            { upsert: true }
          );
          stats.imported += 1;
        } catch (error) {
          stats.failed += 1;
          failures.push({ reason: "save_review_required_failed", item: pendingPayload, error: error.message });
        }
        continue;
      }

      const savePayload = {
        eventId,
        localidad: item.localidad,
        puesto: item.puesto,
        mesa,
        zoneCode: item.zoneCode || null,
        votosE14Candidate105,
        e14ListVotes: toInt(item.e14ListVotes),
        notes: item.notes || "",
        validatedBy,
        taskId: item.taskId || "",
        reviewPriorityRank: toInt(item.reviewPriorityRank),
        sourceEstadoRevision: item.sourceEstadoRevision || "",
        sourceConfidence: item.sourceConfidence ?? null,
        sourceScoreDigito: item.sourceScoreDigito ?? null,
        sourceScoreSegundo: item.sourceScoreSegundo ?? null,
        sourceMetodoDigito: item.sourceMetodoDigito || "",
        sourceDebugDir: item.sourceDebugDir || "",
        sourceDocumento: item.sourceDocumento || "",
        sourceArchivo: item.sourceArchivo || "",
        sourceLocalFileUri: item.sourceLocalFileUri || "",
        sourceCaptureAvailable: Boolean(item.sourceCaptureAvailable),
        sourceOverlayPath: item.sourceOverlayPath || "",
        sourceCellPath: item.sourceCellPath || "",
        sourceMaskPath: item.sourceMaskPath || "",
        sourcePartyBlockPath: item.sourcePartyBlockPath || "",
      };

      if (dryRun) {
        stats.imported += 1;
        continue;
      }

      try {
        await saveManualByMesa(savePayload, { organizationId, validatedBy });
        stats.imported += 1;
      } catch (error) {
        stats.failed += 1;
        failures.push({
          reason: "save_failed",
          item: savePayload,
          error: error.message,
        });
      }
    }
  } finally {
    if (!dryRun) {
      await disconnectDB();
    }
  }

  console.log(JSON.stringify({ stats, failures: failures.slice(0, 25) }, null, 2));
}

main().catch((error) => {
  console.error("[E14 IMPORT] Error fatal:", error);
  process.exit(1);
});
