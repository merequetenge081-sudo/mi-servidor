import { Registration } from "../models/Registration.js";

export class ValidationService {
  static async checkDuplicate(cedula, eventId, excludeId = null) {
    const query = { cedula, eventId };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return await Registration.findOne(query);
  }

  static validateVotingData(registeredToVote, votingPlace, votingTable) {
    if (registeredToVote && !votingPlace) {
      return { valid: false, error: "votingPlace es requerido cuando registeredToVote es true" };
    }
    if (registeredToVote && !votingTable) {
      return { valid: false, error: "votingTable es requerido cuando registeredToVote es true" };
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
        data.votingPlace,
        data.votingTable
      );
      if (!votingValidation.valid) {
        return votingValidation;
      }
    }

    return { valid: true };
  }
}
