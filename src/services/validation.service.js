import { Registration } from "../models/Registration.js";

export class ValidationService {
  static async checkDuplicate(cedula, eventId, excludeId = null) {
    const query = { cedula, eventId };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await Registration.findOne(query);
  }

  static validateVotingData(registeredToVote, puestoId, mesa) {
    if (registeredToVote && !puestoId) {
      return { valid: false, error: "puestoId es requerido cuando registeredToVote es true" };
    }
    if (registeredToVote && (mesa === undefined || mesa === null)) {
      return { valid: false, error: "mesa es requerida cuando registeredToVote es true" };
    }
    return { valid: true };
  }

  static validateRegistration(data) {
    const required = ["leaderId", "eventId", "firstName", "lastName", "cedula"];
    for (const field of required) {
      if (!data[field]) {
        return { valid: false, error: `${field} es requerido` };
      }
    }

    if (data.registeredToVote) {
      const votingValidation = this.validateVotingData(
        data.registeredToVote,
        data.puestoId,
        data.mesa
      );
      if (!votingValidation.valid) {
        return votingValidation;
      }
    }

    return { valid: true };
  }
}
