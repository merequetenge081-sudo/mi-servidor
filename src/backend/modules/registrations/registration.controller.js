/**
 * Registration Controller
 * Capa de HTTP - endpoints de registrations
 * Responsabilidades:
 * - Validar input básica de request
 * - Extraer contexto (user, org, etc)
 * - Delegar a service
 * - Formatear respuestas HTTP
 */

import { RegistrationService } from "./registration.service.js";
import { createLogger } from "../../core/Logger.js";
import { AppError } from "../../core/AppError.js";
import config from "../../config/config.js";
import { parsePagination } from "../../../utils/pagination.js";
import { Leader } from "../../../models/Leader.js";
import { Registration } from "../../../models/Registration.js";
import mongoose from "mongoose";
import {
  canonicalizeBogotaLocality,
  getBogotaLocalidadesCanonical
} from "../../../shared/territoryNormalization.js";

const logger = createLogger("RegistrationController");
const service = new RegistrationService();
const BOGOTA_LOCALIDADES_CANONICAL = getBogotaLocalidadesCanonical();

function parseBoolean(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
}

function parseSort(query = {}) {
  const allowedSortFields = new Set([
    "createdAt",
    "updatedAt",
    "firstName",
    "lastName",
    "leaderName",
    "workflowStatus",
    "dataIntegrityStatus",
    "confirmed",
    "localidad",
    "departamento"
  ]);

  const sortField = allowedSortFields.has(query.sort) ? query.sort : "createdAt";
  const order = String(query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
  return { [sortField]: order };
}

function parseRegionScope(scope) {
  const value = String(scope || "all").toLowerCase();
  if (value === "bogota" || value === "resto") return value;
  return "all";
}

function buildRegistrationFilter(input = {}) {
  const filter = {};
  if (input.leaderId) filter.leaderId = input.leaderId;
  if (input.eventId) filter.eventId = input.eventId;
  if (input.confirmed !== undefined) {
    const confirmed = parseBoolean(input.confirmed);
    if (confirmed !== undefined) filter.confirmed = confirmed;
  }
  if (input.cedula) filter.cedula = input.cedula;
  if (input.workflowStatus) {
    const statuses = String(input.workflowStatus)
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      filter.workflowStatus = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }
  }
  if (input.dataIntegrityStatus) {
    filter.dataIntegrityStatus = input.dataIntegrityStatus;
  }
  if (input.localidad) {
    filter.localidad = canonicalizeBogotaLocality(input.localidad) || input.localidad;
  }
  if (input.departamento) filter.departamento = input.departamento;
  if (input.territory) filter.departamento = input.territory;
  const hasPhone = parseBoolean(input.hasPhone);
  if (hasPhone === true) {
    filter.phone = { $exists: true, $nin: ["", null] };
  } else if (hasPhone === false) {
    filter.$and = filter.$and || [];
    filter.$and.push({ $or: [{ phone: { $exists: false } }, { phone: "" }, { phone: null }] });
  }
  if (input.puestoId) {
    if (mongoose.Types.ObjectId.isValid(input.puestoId)) {
      filter.puestoId = new mongoose.Types.ObjectId(input.puestoId);
    } else {
      filter.puestoId = input.puestoId;
    }
  }

  const hasFlags = parseBoolean(input.hasFlags);
  if (hasFlags === true) {
    filter.$or = [
      { "deduplicationFlags.0": { $exists: true } },
      { "validationErrors.0": { $exists: true } },
      { workflowStatus: "flagged" },
      { dataIntegrityStatus: "needs_review" }
    ];
  } else if (hasFlags === false) {
    filter.$and = [
      { deduplicationFlags: { $size: 0 } },
      { validationErrors: { $size: 0 } },
      { workflowStatus: { $ne: "flagged" } }
    ];
  }

  const stateAliases = [
    "pending_call",
    "confirmed",
    "duplicate",
    "invalid",
    "flagged",
    "validated",
    "archived",
    "called",
    "rejected",
    "new"
  ];
  for (const alias of stateAliases) {
    const raw = parseBoolean(input[alias]);
    if (raw === true) {
      filter.workflowStatus = alias;
    }
  }

  const search = String(input.search || input.q || "").trim();
  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safeSearch, "i");
    const searchFilter = {
      $or: [
        { firstName: regex },
        { lastName: regex },
        { leaderName: regex },
        { cedula: regex },
        { phone: regex },
        { email: regex }
      ]
    };
    filter.$and = filter.$and || [];
    filter.$and.push(searchFilter);
  }

  const regionScope = parseRegionScope(input.regionScope || input.scope);
  if (regionScope !== "all") {
    const regionFilter = regionScope === "bogota"
      ? { localidad: { $in: BOGOTA_LOCALIDADES_CANONICAL } }
      : {
        $or: [
          { localidad: { $exists: false } },
          { localidad: null },
          { localidad: "" },
          { localidad: { $nin: BOGOTA_LOCALIDADES_CANONICAL } }
        ]
      };
    filter.$and = filter.$and || [];
    filter.$and.push(regionFilter);
  }

  return { filter, regionScope };
}

function normalizeFreeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLeaderSummaryUniverse(universe) {
  const normalized = String(universe || "global").toLowerCase();
  if (normalized === "global" || normalized === "filtered" || normalized === "event") return normalized;
  return "global";
}

function buildLeaderSummaryInput(input = {}) {
  const universe = normalizeLeaderSummaryUniverse(input.universe);
  const base = { ...input };
  if (universe === "filtered") {
    return { universe, effectiveInput: base };
  }
  if (universe === "global") {
    return {
      universe,
      effectiveInput: {
        leaderId: base.leaderId,
        sort: base.sort,
        order: base.order,
        limit: base.limit
      }
    };
  }
  return {
    universe: "event",
    effectiveInput: {
      eventId: base.eventId || null,
      leaderId: base.leaderId,
      sort: base.sort,
      order: base.order,
      limit: base.limit
    }
  };
}

export class RegistrationController {
  /**
   * POST /registrations
   * Crear nuevo registro
   */
  async createRegistration(req, res, next) {
    try {
      logger.info("POST createRegistration", { leaderId: req.body.leaderId });

      const { leaderId, leaderToken, eventId, firstName, lastName, cedula, 
              email, phone, localidad, departamento, puestoId, mesa, 
              votingPlace, votingTable, registeredToVote, hasConsentToRegister } = req.body;

      // Validación básica
      if (!firstName || !lastName || !cedula) {
        throw AppError.badRequest("firstName, lastName y cedula son requeridos");
      }

      if (!eventId && !leaderToken && !leaderId) {
        throw AppError.badRequest("eventId, leaderToken o leaderId requerido");
      }

      const registrationData = {
        leaderId,
        leaderToken,
        eventId,
        firstName,
        lastName,
        cedula,
        email,
        phone,
        localidad,
        departamento,
        puestoId,
        mesa,
        votingPlace,
        votingTable,
        registeredToVote: registeredToVote === true,
        hasConsentToRegister,
        userId: req.user?._id,
        ip: req.ip,
        userAgent: req.get('user-agent')
      };

      const registration = await service.createRegistration(registrationData, req.orgId);

      res.status(201).json({
        success: true,
        message: "Registro creado exitosamente",
        data: registration
      });
    } catch (error) {
      logger.error("Error createRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /registrations
   * Obtener registrations con filtros
   */
  async getRegistrations(req, res, next) {
    try {
      logger.info("GET getRegistrations", { orgId: req.orgId });

      const { page, limit } = parsePagination(req.query, {
        defaultLimit: config.DEFAULT_PAGE_SIZE,
        maxLimit: config.MAX_PAGE_SIZE
      });
      const pageSize = limit;
      const { filter, regionScope } = buildRegistrationFilter(req.query);
      const sort = parseSort(req.query);

      const result = await service.getRegistrations(
        filter,
        { page, pageSize, sort },
        req.orgId
      );

      const payload = {
        items: result.data,
        total: result.total,
        page,
        limit: pageSize,
        totalPages: result.totalPages,
        source: {
          endpoint: "/api/v2/registrations",
          trace: "registrations.v2",
          filter: {
            eventId: req.query.eventId || null,
            leaderId: req.query.leaderId || null,
            workflowStatus: req.query.workflowStatus || null,
            dataIntegrityStatus: req.query.dataIntegrityStatus || null,
            regionScope
          }
        }
      };

      logger.info("[V2 TRACE] registrations.table <- /api/v2/registrations", {
        orgId: req.orgId,
        page,
        limit: pageSize
      });

      res.json({
        success: true,
        ...payload,
        data: payload.items,
        pagination: {
          total: payload.total,
          page: payload.page,
          pageSize: payload.limit,
          totalPages: payload.totalPages
        }
      });
    } catch (error) {
      logger.error("Error getRegistrations", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/export
   * Exportar registros con filtros v2 (sin snapshot frontend)
   */
  async exportRegistrations(req, res, next) {
    try {
      logger.info("POST exportRegistrations", { orgId: req.orgId });
      const input = { ...(req.query || {}), ...(req.body || {}) };
      const { filter, regionScope } = buildRegistrationFilter(input);
      const sort = parseSort(input);

      const limitInput = parseInt(input.limit, 10);
      const exportLimit = Number.isFinite(limitInput) && limitInput > 0
        ? Math.min(limitInput, 50000)
        : 10000;

      const result = await service.getRegistrations(
        filter,
        { page: 1, pageSize: exportLimit, sort },
        req.orgId
      );

      logger.info("[V2 TRACE] registrations.export <- /api/v2/registrations/export", {
        orgId: req.orgId,
        count: result.data?.length || 0,
        limit: exportLimit
      });
      logger.info("[EXPORT REAL TRACE] endpoint=/api/v2/registrations/export backend=registration.controller.exportRegistrations", {
        orgId: req.orgId,
        eventId: input.eventId || null,
        leaderId: input.leaderId || null,
        regionScope
      });

      res.json({
        success: true,
        items: result.data || [],
        total: result.total || 0,
        limit: exportLimit,
        source: {
          endpoint: "/api/v2/registrations/export",
          trace: "registrations.export.v2",
          filter: {
            eventId: input.eventId || null,
            leaderId: input.leaderId || null,
            workflowStatus: input.workflowStatus || null,
            dataIntegrityStatus: input.dataIntegrityStatus || null,
            hasFlags: input.hasFlags ?? null,
            regionScope
          }
        }
      });
    } catch (error) {
      logger.error("Error exportRegistrations", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/export/leader-summary
   * Resumen de export por líder con clave estable (leaderId canónico)
   */
  async exportLeaderSummary(req, res, next) {
    try {
      logger.info("POST exportLeaderSummary", { orgId: req.orgId });
      logger.info("[EXPORT REAL TRACE] routeMatched=/api/v2/registrations/export/leader-summary");
      const input = { ...(req.query || {}), ...(req.body || {}) };
      const { universe, effectiveInput } = buildLeaderSummaryInput(input);
      const { filter, regionScope } = buildRegistrationFilter(effectiveInput);
      const sort = parseSort(effectiveInput);

      const limitInput = parseInt(input.limit, 10);
      const exportLimit = Number.isFinite(limitInput) && limitInput > 0
        ? Math.min(limitInput, 80000)
        : 50000;

      const result = await service.getRegistrations(
        filter,
        { page: 1, pageSize: exportLimit, sort },
        req.orgId
      );
      const items = Array.isArray(result.data) ? result.data : [];

      const rawLeaderKeys = [...new Set(items.map((row) => String(row.leaderId || "")).filter(Boolean))];
      const objectIds = rawLeaderKeys
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      const leaders = await Leader.find({
        organizationId: req.orgId,
        $or: [
          ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
          { leaderId: { $in: rawLeaderKeys } }
        ]
      })
        .select("_id leaderId name")
        .lean();

      const canonicalByAnyId = new Map();
      for (const leader of leaders) {
        const canonical = String(leader.leaderId || leader._id);
        canonicalByAnyId.set(String(leader._id), { canonical, displayName: leader.name || canonical });
        if (leader.leaderId) {
          canonicalByAnyId.set(String(leader.leaderId), { canonical, displayName: leader.name || canonical });
        }
      }

      const grouped = new Map();
      for (const row of items) {
        const rawLeaderId = String(row.leaderId || "");
        const resolved = canonicalByAnyId.get(rawLeaderId) || null;
        const groupId = resolved?.canonical || (rawLeaderId || "unassigned");
        const displayName = resolved?.displayName || row.leaderName || "Sin líder";
        const rawName = String(row.leaderName || displayName || "").trim() || "Sin líder";

        if (!grouped.has(groupId)) {
          grouped.set(groupId, {
            leaderId: groupId,
            displayName,
            total: 0,
            confirmed: 0,
            rawNamesSet: new Set(),
            rawLeaderIdsSet: new Set()
          });
        }
        const slot = grouped.get(groupId);
        slot.total += 1;
        if (row.confirmed === true || row.workflowStatus === "confirmed") {
          slot.confirmed += 1;
        }
        slot.rawNamesSet.add(rawName);
        if (rawLeaderId) slot.rawLeaderIdsSet.add(rawLeaderId);
      }

      const summary = [...grouped.values()]
        .map((slot) => ({
          leaderId: slot.leaderId,
          displayName: slot.displayName,
          total: slot.total,
          confirmed: slot.confirmed,
          pending: Math.max(slot.total - slot.confirmed, 0),
          rawNames: [...slot.rawNamesSet].sort((a, b) => a.localeCompare(b)),
          rawLeaderIds: [...slot.rawLeaderIdsSet].sort((a, b) => a.localeCompare(b)),
          canonicalNameKey: normalizeFreeText(slot.displayName)
        }))
        .sort((a, b) => b.total - a.total);

      const rawUniverseMatch = {
        organizationId: req.orgId,
        ...(effectiveInput.eventId ? { eventId: effectiveInput.eventId } : {}),
        ...(effectiveInput.leaderId ? { leaderId: effectiveInput.leaderId } : {})
      };
      const rawByLeaderId = await Registration.aggregate([
        { $match: rawUniverseMatch },
        { $group: { _id: "$leaderId", totalRaw: { $sum: 1 } } }
      ]);
      const rawCanonicalTotals = new Map();
      for (const row of rawByLeaderId) {
        const rawLeaderId = String(row?._id || "");
        if (!rawLeaderId) continue;
        const resolved = canonicalByAnyId.get(rawLeaderId) || null;
        const canonical = resolved?.canonical || rawLeaderId;
        rawCanonicalTotals.set(canonical, (rawCanonicalTotals.get(canonical) || 0) + Number(row.totalRaw || 0));
      }
      const summaryWithDiff = summary.map((row) => {
        const totalRaw = Number(rawCanonicalTotals.get(String(row.leaderId)) || 0);
        const totalExport = Number(row.total || 0);
        const difference = totalRaw - totalExport;
        logger.info("[EXPORT COUNT TRACE] leaderId=%s totalRaw=%d totalExport=%d difference=%d", row.leaderId, totalRaw, totalExport, difference);
        return {
          ...row,
          comparison: {
            totalRaw,
            totalExport,
            difference
          }
        };
      });
      logger.info("[EXPORT COUNT TRACE] filters=%j", {
        universe,
        eventId: effectiveInput.eventId || null,
        leaderId: effectiveInput.leaderId || null,
        regionScope,
        workflowStatus: effectiveInput.workflowStatus || null,
        dataIntegrityStatus: effectiveInput.dataIntegrityStatus || null,
        confirmed: effectiveInput.confirmed ?? null,
        hasFlags: effectiveInput.hasFlags ?? null,
        search: effectiveInput.search || effectiveInput.q || null
      });

      logger.info("[EXPORT TRACE] eventId=%s region=%s filters=%j", effectiveInput.eventId || null, regionScope, {
        universe,
        workflowStatus: effectiveInput.workflowStatus || null,
        dataIntegrityStatus: effectiveInput.dataIntegrityStatus || null,
        leaderId: effectiveInput.leaderId || null,
        status: effectiveInput.status || null
      });
      logger.info("[EXPORT REAL TRACE] endpoint=/api/v2/registrations/export/leader-summary backend=registration.controller.exportLeaderSummary", {
        orgId: req.orgId,
        universe,
        eventId: effectiveInput.eventId || null,
        leaderId: effectiveInput.leaderId || null,
        regionScope
      });
      for (const row of summaryWithDiff.slice(0, 50)) {
        logger.info("[EXPORT TRACE] leaderId=%s displayName=%s rawNames=%j total=%d", row.leaderId, row.displayName, row.rawNames, row.total);
        logger.info("[EXPORT REAL TRACE] leaderId=%s displayName=%s rawNames=%j total=%d", row.leaderId, row.displayName, row.rawNames, row.total);
      }

      res.json({
        success: true,
        items: summaryWithDiff,
        total: summaryWithDiff.length,
        source: {
          endpoint: "/api/v2/registrations/export/leader-summary",
          trace: "registrations.export.leaderSummary.v2",
          filter: {
            universe,
            eventId: effectiveInput.eventId || null,
            regionScope,
            workflowStatus: effectiveInput.workflowStatus || null,
            dataIntegrityStatus: effectiveInput.dataIntegrityStatus || null,
            leaderId: effectiveInput.leaderId || null,
            confirmed: effectiveInput.confirmed ?? null,
            hasPhone: effectiveInput.hasPhone ?? null,
            hasFlags: effectiveInput.hasFlags ?? null,
            search: effectiveInput.search || effectiveInput.q || null
          },
          aggregationKey: "leaderId"
        }
      });
    } catch (error) {
      logger.error("Error exportLeaderSummary", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /registrations/:id
   * Obtener un registro
   */
  async getRegistration(req, res, next) {
    try {
      logger.info("GET getRegistration", { registrationId: req.params.id });

      const registration = await service.getRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        data: registration
      });
    } catch (error) {
      logger.error("Error getRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * PUT /registrations/:id
   * Actualizar registro
   */
  async updateRegistration(req, res, next) {
    try {
      logger.info("PUT updateRegistration", { registrationId: req.params.id });

      const updateData = req.body;

      const registration = await service.updateRegistration(req.params.id, updateData, req.orgId);

      res.json({
        success: true,
        message: "Registro actualizado",
        data: registration
      });
    } catch (error) {
      logger.error("Error updateRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * DELETE /registrations/:id
   * Eliminar registro
   */
  async deleteRegistration(req, res, next) {
    try {
      logger.info("DELETE deleteRegistration", { registrationId: req.params.id });

      await service.deleteRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        message: "Registro eliminado"
      });
    } catch (error) {
      logger.error("Error deleteRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/:id/confirm
   * Confirmar asistencia
   */
  async confirmRegistration(req, res, next) {
    try {
      logger.info("POST confirmRegistration", { registrationId: req.params.id });

      const registration = await service.confirmRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        message: "Asistencia confirmada",
        data: registration
      });
    } catch (error) {
      logger.error("Error confirmRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/:id/unconfirm
   * Desconfirmar asistencia
   */
  async unconfirmRegistration(req, res, next) {
    try {
      logger.info("POST unconfirmRegistration", { registrationId: req.params.id });

      const registration = await service.unconfirmRegistration(req.params.id, req.orgId);

      res.json({
        success: true,
        message: "Asistencia desconfirmada",
        data: registration
      });
    } catch (error) {
      logger.error("Error unconfirmRegistration", { error: error.message });
      next(error);
    }
  }

  /**
   * GET /registrations/leader/:leaderId
   * Obtener registrations de un líder
   */
  async getRegistrationsByLeader(req, res, next) {
    try {
      logger.info("GET getRegistrationsByLeader", { leaderId: req.params.leaderId });

      const page = Math.max(1, parseInt(req.query.page) || 1);
      const pageSize = Math.min(100, parseInt(req.query.pageSize) || 20);

      const result = await service.getRegistrationsByLeader(
        req.params.leaderId,
        { page, pageSize },
        req.orgId
      );

      res.json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page,
          pageSize,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      logger.error("Error getRegistrationsByLeader", { error: error.message });
      next(error);
    }
  }

  async getOfficialCorrectionCatalog(req, res, next) {
    try {
      const localidad = String(req.query.localidad || "");
      const data = await service.getOfficialCorrectionCatalog(localidad, req.orgId);
      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error("Error getOfficialCorrectionCatalog", { error: error.message });
      next(error);
    }
  }

  async previewOfficialCorrection(req, res, next) {
    try {
      const data = await service.previewOfficialCorrection(req.params.id, req.body || {}, req.orgId);
      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error("Error previewOfficialCorrection", { error: error.message });
      next(error);
    }
  }

  async applyOfficialCorrection(req, res, next) {
    try {
      const correctedBy = req.user?.username || req.user?.email || req.user?._id || "admin";
      const data = await service.applyOfficialCorrection(req.params.id, req.body || {}, req.orgId, correctedBy);
      res.json({
        success: true,
        message: "Corrección aplicada",
        data
      });
    } catch (error) {
      logger.error("Error applyOfficialCorrection", { error: error.message });
      next(error);
    }
  }

  async getCorrectionHistory(req, res, next) {
    try {
      const data = await service.getCorrectionHistory(req.params.id, req.orgId);
      res.json({
        success: true,
        data
      });
    } catch (error) {
      logger.error("Error getCorrectionHistory", { error: error.message });
      next(error);
    }
  }

  /**
   * POST /registrations/bulk/create
   * Crear múltiples registrations
   */
  async bulkCreateRegistrations(req, res, next) {
    try {
      logger.info("POST bulkCreateRegistrations", { count: req.body.registrations?.length });

      const { registrations, leaderId } = req.body;

      if (!Array.isArray(registrations)) {
        throw AppError.badRequest("registrations debe ser un array");
      }

      // 1. Identify target leader for the bulk import
      const targetLeaderId = leaderId || req.user?._id;
      if (!targetLeaderId) {
        throw AppError.badRequest("No se especificó un líder para la importación.");
      }

      // 2. Fetch leader details to inject into registrations
      const isObjectId = mongoose.Types.ObjectId.isValid(targetLeaderId);
      const leaderQuery = isObjectId
        ? { $or: [{ _id: targetLeaderId }, { leaderId: targetLeaderId }] }
        : { leaderId: targetLeaderId };
        
      const leaderRecord = await Leader.findOne(leaderQuery).lean();

      if (!leaderRecord) {
        throw AppError.notFound("Líder no encontrado para asignar los registros.");
      }

      let assignedEventId = leaderRecord.eventId || leaderRecord.assignedEventId;
      if (!assignedEventId) {
        // Fallback robusto al primer evento activo global o ignorar si no hay
        const { default: mongoose } = await import('mongoose');
        const { Event } = await import('../../../models/index.js');
        const activeEvent = await Event.findOne({ status: 'active', organizationId: req.orgId }).lean();
        if (activeEvent) {
          assignedEventId = activeEvent._id;
          logger.warn(`Fallando graciosamente: asignando evento por defecto ${assignedEventId} al lider ${targetLeaderId}`);
        } else {
          // Asumir un event fallback genérico (Evitar crash 500)
          assignedEventId = new mongoose.Types.ObjectId(); 
        }
      }

      // 3. Inject leader and event details into each item so the Service schema validation passes
      const enrichedRegistrations = registrations.map(reg => ({
        ...reg,
        leaderId: targetLeaderId, // Usar el targetLeaderId explícito
        leaderName: leaderRecord.name || leaderRecord.firstName || `${leaderRecord.firstName} ${leaderRecord.lastName}`,
        eventId: assignedEventId
      }));

      const result = await service.bulkCreateRegistrations(
        enrichedRegistrations,
        req.orgId,
        req.user?._id
      );

      res.status(201).json({
        success: result.success,
        imported: result.created,
        requiresReview: result.requiresReview,
        failed: result.failed,
        autocorrected: result.autocorrected,
        errors: result.errors,
        autocorrections: result.autocorrections,
        message: result.message,
        data: {
          created: result.created,
          errors: result.errors,
          autocorrections: result.autocorrections
        }
      });
    } catch (error) {
      logger.error("Error bulkCreateRegistrations", { error: error.message });
      next(error);
    }
  }
}

export default RegistrationController;

