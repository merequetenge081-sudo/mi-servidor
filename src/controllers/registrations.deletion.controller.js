import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Registration } from "../models/Registration.js";
import { Leader } from "../models/Leader.js";
import { DeletionRequest, ArchivedRegistration } from "../models/index.js";
import { AuditService } from "../services/audit.service.js";
import logger from "../config/logger.js";
import { sendError } from "../utils/httpError.js";

export async function requestBulkDeletion(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { password, reason } = req.body;

    if (user.role !== "leader") {
      return sendError(res, 403, "Solo líderes pueden solicitar eliminación");
    }

    if (!password) {
      return sendError(res, 400, "Contraseña requerida");
    }

    const leader = await Leader.findOne({
      leaderId: user.leaderId,
      organizationId: orgId
    });

    if (!leader || !leader.passwordHash) {
      return sendError(res, 401, "Credenciales inválidas");
    }

    const passwordMatch = await bcrypt.compare(password, leader.passwordHash);
    if (!passwordMatch) {
      logger.warn(`Failed deletion request - Invalid password for leader: ${user.leaderId}`);
      return sendError(res, 401, "Contraseña incorrecta");
    }

    const registrationCount = await Registration.countDocuments({
      leaderId: user.leaderId,
      organizationId: orgId
    });

    if (registrationCount === 0) {
      return sendError(res, 400, "No tienes registros para eliminar");
    }

    const existingRequest = await DeletionRequest.findOne({
      leaderId: user.leaderId,
      organizationId: orgId,
      status: "pending"
    });

    if (existingRequest) {
      return sendError(res, 400, "Ya tienes una solicitud de eliminación pendiente", "PENDING_DELETION_REQUEST", {
        requestId: existingRequest._id
      });
    }

    const deletionRequest = new DeletionRequest({
      leaderId: user.leaderId,
      leaderName: leader.name,
      organizationId: orgId,
      eventId: leader.eventId,
      status: "approved",
      registrationCount,
      reason: reason || "Sin razón especificada",
      reviewedBy: "Auto-aprobado (Líder)",
      reviewedAt: new Date(),
      reviewNotes: "Eliminación directa por el líder"
    });

    await deletionRequest.save();

    await Registration.deleteMany({
      leaderId: user.leaderId,
      organizationId: orgId
    });

    const leaderIdForUpdate = user.leaderId;
    const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderIdForUpdate);
    await Leader.updateOne(
      { $or: [{ leaderId: leaderIdForUpdate }, ...(isValidObjectId ? [{ _id: leaderIdForUpdate }] : [])] },
      { $set: { registrations: 0 } }
    );

    logger.info(`Bulk deletion directly executed by Leader: ${user.leaderId}, Count: ${registrationCount}`);

    await AuditService.log(
      "DELETE_BULK",
      "Registration",
      deletionRequest._id.toString(),
      user,
      { registrationCount, reason },
      `Eliminación masiva ejecutada directamente por líder (${registrationCount} registros)`
    );

    return res.json({
      success: true,
      message: `¡Éxito! Se han eliminado ${registrationCount} registro(s) permanentemente.`,
      requestId: deletionRequest._id,
      registrationCount,
      status: "approved"
    });
  } catch (error) {
    logger.error("Request bulk deletion error:", error);
    return sendError(res, 500, "Error al crear solicitud de eliminación", "REQUEST_BULK_DELETION_ERROR", error.message);
  }
}

export async function getDeletionRequestStatus(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    const request = await DeletionRequest.findOne({
      leaderId: user.leaderId,
      organizationId: orgId,
      status: "pending"
    }).sort({ createdAt: -1 });

    return res.json({
      hasPendingRequest: !!request,
      request: request || null
    });
  } catch (error) {
    logger.error("Get deletion request status error:", error);
    return sendError(res, 500, "Error al obtener estado de solicitud", "GET_DELETION_REQUEST_STATUS_ERROR", error.message);
  }
}

export async function getAllDeletionRequests(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;

    if (user.role !== "admin") {
      return sendError(res, 403, "Acceso denegado");
    }

    const { status } = req.query;
    const filter = { organizationId: orgId };
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const requests = await DeletionRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      requests
    });
  } catch (error) {
    logger.error("Get all deletion requests error:", error);
    return sendError(res, 500, "Error al obtener solicitudes", "GET_ALL_DELETION_REQUESTS_ERROR", error.message);
  }
}

export async function reviewDeletionRequest(req, res) {
  try {
    const user = req.user;
    const orgId = user.organizationId;
    const { requestId } = req.params;
    const { action, notes } = req.body;

    if (user.role !== "admin") {
      return sendError(res, 403, "Acceso denegado");
    }

    if (!["approve", "approve-and-archive", "reject"].includes(action)) {
      return sendError(res, 400, "Acción inválida. Use 'approve', 'approve-and-archive' o 'reject'");
    }

    const deletionRequest = await DeletionRequest.findOne({
      _id: requestId,
      organizationId: orgId
    });

    if (!deletionRequest) {
      return sendError(res, 404, "Solicitud no encontrada");
    }

    if (deletionRequest.status !== "pending") {
      return sendError(res, 400, "Esta solicitud ya fue procesada");
    }

    deletionRequest.status = action === "approve" || action === "approve-and-archive" ? "approved" : "rejected";
    deletionRequest.reviewedBy = user.username || user.email;
    deletionRequest.reviewedAt = new Date();
    deletionRequest.reviewNotes = notes || "";
    await deletionRequest.save();

    if (action === "approve" || action === "approve-and-archive") {
      let archivedCount = 0;

      if (action === "approve-and-archive") {
        const registrationsToArchive = await Registration.find({
          leaderId: deletionRequest.leaderId,
          organizationId: orgId
        }).lean();

        if (registrationsToArchive.length > 0) {
          const archivedDocs = registrationsToArchive.map((reg) => ({
            originalId: reg._id,
            leaderId: reg.leaderId,
            leaderName: reg.leaderName,
            eventId: reg.eventId,
            firstName: reg.firstName,
            lastName: reg.lastName,
            cedula: reg.cedula,
            email: reg.email,
            phone: reg.phone,
            localidad: reg.localidad,
            departamento: reg.departamento,
            capital: reg.capital,
            votingPlace: reg.votingPlace,
            votingTable: reg.votingTable,
            puestoId: reg.puestoId,
            mesa: reg.mesa,
            registeredToVote: reg.registeredToVote,
            confirmed: reg.confirmed,
            date: reg.date,
            organizationId: reg.organizationId,
            archivedAt: new Date(),
            archivedBy: user.username || user.email,
            archivedReason: notes || "Eliminación masiva aprobada con archivo",
            deletionRequestId: deletionRequest._id,
            originalCreatedAt: reg.createdAt,
            originalUpdatedAt: reg.updatedAt
          }));

          const archiveResult = await ArchivedRegistration.insertMany(archivedDocs);
          archivedCount = archiveResult.length;

          logger.info(`Registrations archived before deletion - Leader: ${deletionRequest.leaderId}, Archived: ${archivedCount}`);
        }
      }

      const deleteResult = await Registration.deleteMany({
        leaderId: deletionRequest.leaderId,
        organizationId: orgId
      });

      const leaderIdForUpdate = deletionRequest.leaderId;
      const isValidObjectId = mongoose.Types.ObjectId.isValid(leaderIdForUpdate);
      await Leader.updateOne(
        { $or: [{ leaderId: leaderIdForUpdate }, ...(isValidObjectId ? [{ _id: leaderIdForUpdate }] : [])] },
        { $set: { registrations: 0 } }
      );

      logger.info(`Bulk deletion approved and executed - Leader: ${deletionRequest.leaderId}, Deleted: ${deleteResult.deletedCount}, Archived: ${archivedCount}`);

      await AuditService.log(
        action === "approve-and-archive" ? "DELETE_BULK_WITH_ARCHIVE" : "DELETE_BULK",
        "Registration",
        deletionRequest.leaderId,
        user,
        { deletedCount: deleteResult.deletedCount, archivedCount, requestId },
        `Eliminación masiva aprobada: ${deleteResult.deletedCount} registros eliminados${archivedCount > 0 ? `, ${archivedCount} archivados` : ""}`
      );

      return res.json({
        success: true,
        message: `Solicitud aprobada. Se eliminaron ${deleteResult.deletedCount} registros${archivedCount > 0 ? ` y se archivaron ${archivedCount} para uso futuro` : ""}.`,
        deletedCount: deleteResult.deletedCount,
        archivedCount
      });
    }

    logger.info(`Bulk deletion rejected - Leader: ${deletionRequest.leaderId}, RequestId: ${requestId}`);

    await AuditService.log(
      "REJECT",
      "DeletionRequest",
      requestId,
      user,
      { notes },
      "Solicitud de eliminación masiva rechazada"
    );

    return res.json({
      success: true,
      message: "Solicitud rechazada",
      reason: notes
    });
  } catch (error) {
    logger.error("Review deletion request error:", error);
    return sendError(res, 500, "Error al procesar solicitud", "REVIEW_DELETION_REQUEST_ERROR", error.message);
  }
}
