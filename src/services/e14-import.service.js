import mongoose from "mongoose";
import { E14ConfirmationByMesa, E14ImportBatch, Registration } from "../models/index.js";
import votingHierarchyService from "./votingHierarchy.service.js";
import { calculateE14Confirmation } from "./e14-confirmation.service.js";
import { canonicalizeBogotaLocality } from "../shared/territoryNormalization.js";
import { getBogotaZoneCode } from "../shared/bogota-zones.js";
import { normalizeMesaNumber, normalizeText, repairTextEncoding } from "../shared/textNormalization.js";

function safeText(value) {
  return String(value || "").trim();
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).replace(/[^\d-]/g, "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeImportedValue(value) {
  return safeText(repairTextEncoding(value));
}

function summarizeStatuses(rows = []) {
  return rows.reduce((acc, row) => {
    const key = row.status || "dato_incompleto";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function buildRowStatus(resolvedRow) {
  if (resolvedRow.status === "duplicada") return "duplicada";
  if (resolvedRow.status === "no_encontrada") return "no_encontrada";
  if (resolvedRow.status === "dato_incompleto") return "dato_incompleto";
  if (resolvedRow.status === "inconsistente") return "inconsistente";
  return resolvedRow.difference === 0 ? "confirmada" : "diferencia";
}

class E14ImportService {
  suggestColumnMap(headers = []) {
    const normalizedHeaders = headers.map((header) => ({
      raw: header,
      normalized: normalizeText(header)
    }));
    const findByTerms = (...terms) => normalizedHeaders.find((header) => terms.some((term) => header.normalized.includes(term)))?.raw || "";

    return {
      localidad: findByTerms("localidad", "municipio", "zona"),
      puesto: findByTerms("puesto", "puesto de votacion", "sitio"),
      mesa: findByTerms("mesa", "numero mesa"),
      votosE14: findByTerms("votos e14", "votos", "e14"),
      observacion: findByTerms("observacion", "observaciones", "nota", "comentario")
    };
  }

  normalizeRows(rows = [], columnMap = {}) {
    return rows.map((row, index) => {
      const localidad = normalizeImportedValue(row[columnMap.localidad]);
      const puesto = normalizeImportedValue(row[columnMap.puesto]);
      const mesaRaw = normalizeImportedValue(row[columnMap.mesa]);
      const votosRaw = normalizeImportedValue(row[columnMap.votosE14]);
      const observacion = normalizeImportedValue(row[columnMap.observacion]);

      return {
        rowNumber: index + 1,
        rawLocalidad: localidad,
        rawPuesto: puesto,
        rawMesa: mesaRaw,
        rawVotosE14: votosRaw,
        rawObservacion: observacion,
        mesa: normalizeMesaNumber(mesaRaw),
        votosE14: toInt(votosRaw),
        originalRow: row
      };
    });
  }

  async resolveRows(rows = [], payload = {}, options = {}) {
    const organizationId = options.organizationId || null;
    if (!organizationId) throw new Error("organizationId requerido");
    const eventId = payload.eventId ? String(payload.eventId) : null;

    const scopeDocuments = await votingHierarchyService.loadScopeDocuments({}, { organizationId });
    const master = await votingHierarchyService.syncMasterTables(scopeDocuments, { persist: false });
    const duplicateCount = rows.reduce((acc, row) => {
      const duplicateKey = [
        normalizeText(row.rawLocalidad),
        normalizeText(row.rawPuesto),
        row.mesa ?? "sin-mesa"
      ].join("::");
      acc.set(duplicateKey, (acc.get(duplicateKey) || 0) + 1);
      return acc;
    }, new Map());

    const resolvedRows = await Promise.all(rows.map(async (row) => {
      const duplicateKey = [
        normalizeText(row.rawLocalidad),
        normalizeText(row.rawPuesto),
        row.mesa ?? "sin-mesa"
      ].join("::");

      const messages = [];
      let status = "dato_incompleto";
      let resolved = null;

      if ((duplicateCount.get(duplicateKey) || 0) > 1) {
        status = "duplicada";
        messages.push("Fila duplicada dentro del mismo archivo");
      }

      if (!row.rawLocalidad || !row.rawPuesto || row.mesa === null || row.votosE14 === null) {
        status = "dato_incompleto";
        if (!row.rawLocalidad) messages.push("Localidad faltante");
        if (!row.rawPuesto) messages.push("Puesto faltante");
        if (row.mesa === null) messages.push("Mesa invalida o faltante");
        if (row.votosE14 === null) messages.push("Votos E14 invalidos o faltantes");
      } else if (status !== "duplicada") {
        try {
          resolved = await votingHierarchyService.resolveHierarchyReference(
            {
              localidad: canonicalizeBogotaLocality(row.rawLocalidad) || row.rawLocalidad,
              puesto: row.rawPuesto,
              mesa: row.mesa
            },
            {
              organizationId,
              scopeDocuments,
              master
            }
          );
          status = "resuelta";
        } catch (error) {
          status = "no_encontrada";
          messages.push(safeText(error.message) || "No se pudo reconciliar localidad/puesto/mesa");
        }
      }

      return {
        ...row,
        messages,
        status,
        resolved
      };
    }));

    const resolvedCombos = resolvedRows
      .filter((row) => row.resolved?.localidadId && row.resolved?.puestoId && Number.isFinite(row.resolved?.mesa))
      .map((row) => ({
        localidadId: row.resolved.localidadId,
        puestoId: row.resolved.puestoId,
        mesa: row.resolved.mesa
      }));

    const uniqueComboMap = new Map();
    resolvedCombos.forEach((combo) => {
      uniqueComboMap.set(`${combo.localidadId}::${combo.puestoId}::${combo.mesa}`, combo);
    });

    let voteMap = new Map();
    if (uniqueComboMap.size > 0) {
      const comboMatch = [...uniqueComboMap.values()].map((combo) => ({
        localidadId: new mongoose.Types.ObjectId(combo.localidadId),
        puestoId: new mongoose.Types.ObjectId(combo.puestoId),
        mesa: combo.mesa
      }));

      const votes = await Registration.aggregate([
        {
          $match: {
            organizationId,
            ...(eventId ? { eventId } : {}),
            officialValidationStatus: "official_valid",
            $or: comboMatch
          }
        },
        {
          $group: {
            _id: {
              localidadId: "$localidadId",
              puestoId: "$puestoId",
              mesa: "$mesa"
            },
            internalVotes: { $sum: 1 }
          }
        }
      ]);

      voteMap = new Map(
        votes.map((row) => [
          `${String(row._id.localidadId)}::${String(row._id.puestoId)}::${row._id.mesa}`,
          row.internalVotes || 0
        ])
      );
    }

    return resolvedRows.map((row) => {
      const mesaKey = row.resolved
        ? `${row.resolved.localidadId}::${row.resolved.puestoId}::${row.resolved.mesa}`
        : "";
      const internalVotes = mesaKey ? (voteMap.get(mesaKey) || 0) : 0;
      const difference = row.votosE14 === null ? null : row.votosE14 - internalVotes;

      let finalStatus = row.status;
      if (row.status === "resuelta") {
        finalStatus = buildRowStatus({
          difference,
          status: "resuelta"
        });
      }

      return {
        rowNumber: row.rowNumber,
        rawLocalidad: row.rawLocalidad,
        rawPuesto: row.rawPuesto,
        rawMesa: row.rawMesa,
        rawVotosE14: row.rawVotosE14,
        rawObservacion: row.rawObservacion,
        matchedLocalidad: row.resolved?.localidad || "",
        matchedPuesto: row.resolved?.puesto || "",
        matchedMesa: row.resolved?.mesa ?? null,
        localidadId: row.resolved?.localidadId || null,
        puestoId: row.resolved?.puestoId || null,
        mesaId: row.resolved?.mesaId || null,
        internalVotes,
        e14Votes: row.votosE14,
        difference,
        mesaKey,
        status: finalStatus,
        messages: row.messages,
        originalRow: row.originalRow
      };
    });
  }

  async previewImport(payload = {}, options = {}) {
    const columnMap = payload.columnMap || {};
    const requiredFields = ["localidad", "puesto", "mesa", "votosE14"];
    const missingColumns = requiredFields.filter((field) => !safeText(columnMap[field]));
    if (missingColumns.length > 0) {
      const labels = {
        localidad: "Localidad",
        puesto: "Puesto",
        mesa: "Mesa",
        votosE14: "Votos E14"
      };
      throw new Error(`Faltan columnas necesarias: ${missingColumns.map((field) => labels[field] || field).join(", ")}`);
    }

    const fileName = safeText(payload.fileName) || "importacion-manual.xlsx";
    const rows = this.normalizeRows(payload.rows || [], columnMap);
    if (!rows.length) {
      return {
        fileName,
        columnMap,
        totalRows: 0,
        summaryByStatus: {},
        rows: [],
        counts: {
          matched: 0,
          duplicates: 0,
          incomplete: 0,
          notFound: 0,
          inconsistent: 0
        }
      };
    }
    const previewRows = await this.resolveRows(rows, payload, options);
    const summaryByStatus = summarizeStatuses(previewRows);

    return {
      fileName,
      columnMap,
      totalRows: previewRows.length,
      summaryByStatus,
      rows: previewRows,
      counts: {
        matched: (summaryByStatus.confirmada || 0) + (summaryByStatus.diferencia || 0),
        duplicates: summaryByStatus.duplicada || 0,
        incomplete: summaryByStatus.dato_incompleto || 0,
        notFound: summaryByStatus.no_encontrada || 0,
        inconsistent: summaryByStatus.inconsistente || 0
      }
    };
  }

  async applyImportReconciliation(payload = {}, options = {}) {
    const organizationId = options.organizationId || null;
    if (!organizationId) throw new Error("organizationId requerido");

    const preview = await this.previewImport(payload, options);
    const applicableRows = preview.rows.filter((row) =>
      ["confirmada", "diferencia"].includes(row.status)
      && row.localidadId
      && row.puestoId
      && Number.isFinite(row.matchedMesa)
      && row.e14Votes !== null
    );

    const now = new Date();
    const validatedBy = options.validatedBy || "admin";
    const writes = applicableRows.map((row) => {
      const calc = calculateE14Confirmation({
        votosReportadosTotales: row.internalVotes,
        votosE14Candidate105: row.e14Votes,
        hasMissingLocation: false
      });

      return {
        updateOne: {
          filter: {
            organizationId,
            eventId: payload.eventId || null,
            localidadId: new mongoose.Types.ObjectId(row.localidadId),
            puestoId: new mongoose.Types.ObjectId(row.puestoId),
            mesa: row.matchedMesa
          },
          update: {
            $set: {
              organizationId,
              eventId: payload.eventId || null,
              localidadId: new mongoose.Types.ObjectId(row.localidadId),
              puestoId: new mongoose.Types.ObjectId(row.puestoId),
              mesaId: row.mesaId ? new mongoose.Types.ObjectId(row.mesaId) : null,
              localidad: row.matchedLocalidad,
              puesto: row.matchedPuesto,
              mesa: row.matchedMesa,
              zoneCode: getBogotaZoneCode(row.matchedLocalidad) || null,
              normalizedLocalidad: normalizeText(row.matchedLocalidad),
              normalizedPuesto: normalizeText(row.matchedPuesto),
              votosReportadosTotales: row.internalVotes,
              votosE14Candidate105: row.e14Votes,
              votosE14SuggestedCandidate105: row.e14Votes,
              e14ListVotes: null,
              confirmacionPorcentaje: calc.porcentaje,
              diferencia: calc.diferencia,
              estado: calc.estado,
              notes: [safeText(payload.notes), safeText(row.rawObservacion)].filter(Boolean).join(" | "),
              reviewRequired: false,
              reviewReason: "",
              sourceEstadoRevision: "excel_import",
              sourceArchivo: preview.fileName,
              validatedAt: now,
              validatedBy,
              source: "excel_import",
              importBatchId: null,
              importFileName: preview.fileName,
              importRowNumber: row.rowNumber,
              importOriginalRow: row.originalRow || null,
              importObservation: row.rawObservacion || ""
            }
          },
          upsert: true
        }
      };
    });

    if (writes.length > 0) {
      await E14ConfirmationByMesa.bulkWrite(writes, { ordered: false });
    }

    const batch = await E14ImportBatch.create({
      organizationId,
      eventId: payload.eventId || null,
      fileName: preview.fileName,
      importedBy: validatedBy,
      columnMap: preview.columnMap,
      totalRows: preview.totalRows,
      matchedRows: preview.counts.matched,
      updatedRows: applicableRows.length,
      confirmedRows: preview.summaryByStatus.confirmada || 0,
      differenceRows: preview.summaryByStatus.diferencia || 0,
      notFoundRows: preview.summaryByStatus.no_encontrada || 0,
      incompleteRows: preview.summaryByStatus.dato_incompleto || 0,
      inconsistentRows: preview.summaryByStatus.inconsistente || 0,
      duplicateRows: preview.summaryByStatus.duplicada || 0,
      summaryByStatus: preview.summaryByStatus,
      rows: preview.rows.map((row) => ({
        ...row,
        applied: ["confirmada", "diferencia"].includes(row.status)
      }))
    });

    if (writes.length > 0) {
      await E14ConfirmationByMesa.updateMany(
        {
          organizationId,
          eventId: payload.eventId || null,
          importFileName: preview.fileName,
          validatedAt: now
        },
        {
          $set: {
            importBatchId: batch._id
          }
        }
      );
    }

    votingHierarchyService.clearCaches();

    return {
      batchId: String(batch._id),
      fileName: preview.fileName,
      updatedRows: applicableRows.length,
      totalRows: preview.totalRows,
      summaryByStatus: preview.summaryByStatus,
      rows: preview.rows
    };
  }

  async getImportHistory(rawFilters = {}, options = {}) {
    const organizationId = options.organizationId || null;
    const page = Math.max(toInt(rawFilters.page) || 1, 1);
    const limit = Math.min(Math.max(toInt(rawFilters.limit) || 10, 1), 50);
    const skip = (page - 1) * limit;
    const query = {
      organizationId,
      ...(rawFilters.eventId ? { eventId: String(rawFilters.eventId) } : {})
    };

    if (rawFilters.search) {
      query.fileName = new RegExp(escapeRegex(rawFilters.search), "i");
    }

    const [total, docs] = await Promise.all([
      E14ImportBatch.countDocuments(query),
      E14ImportBatch.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    return {
      rows: docs.map((doc) => ({
        id: String(doc._id),
        fileName: doc.fileName,
        importedBy: doc.importedBy || "-",
        createdAt: doc.createdAt || null,
        totalRows: doc.totalRows || 0,
        updatedRows: doc.updatedRows || 0,
        matchedRows: doc.matchedRows || 0,
        summaryByStatus: doc.summaryByStatus || {}
      })),
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1)
    };
  }
}

const e14ImportService = new E14ImportService();

export default e14ImportService;
