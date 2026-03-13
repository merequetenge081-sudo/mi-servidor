import { Puestos } from "../../../models/Puestos.js";
import { normalizePhone, normalizeText, normalizeTextUpper } from "../core/skill.contracts.js";

function isValidPhone(phone) {
  if (!phone) return true;
  return /^\d{10,15}$/.test(phone);
}

function hasValue(value) {
  return value !== undefined && value !== null && normalizeText(value) !== "";
}

export async function runValidationSkill({ registration, organizationId, strict = false }) {
  const errors = [];
  const warnings = [];
  const normalized = {
    ...registration,
    firstName: normalizeText(registration.firstName),
    lastName: normalizeText(registration.lastName),
    cedula: normalizeText(registration.cedula),
    localidad: normalizeText(registration.localidad),
    departamento: normalizeText(registration.departamento),
    capital: normalizeText(registration.capital),
    votingPlace: normalizeText(registration.votingPlace),
    phone: normalizePhone(registration.phone)
  };

  const requiredFields = ["leaderId", "eventId", "firstName", "lastName", "cedula"];
  requiredFields.forEach((field) => {
    if (!hasValue(normalized[field])) {
      errors.push(`Campo requerido: ${field}`);
    }
  });

  if (!isValidPhone(normalized.phone)) {
    errors.push("Formato de telefono invalido (10-15 digitos)");
  }

  if (normalized.registeredToVote && !hasValue(normalized.puestoId)) {
    errors.push("puestoId es requerido cuando registeredToVote=true");
  }

  if (normalized.registeredToVote && (normalized.mesa === undefined || normalized.mesa === null || Number.isNaN(Number(normalized.mesa)))) {
    errors.push("mesa es requerida y debe ser numerica cuando registeredToVote=true");
  }

  if (hasValue(normalized.puestoId)) {
    const puesto = await Puestos.findById(normalized.puestoId).lean();
    if (!puesto) {
      errors.push("puestoId no existe");
    } else {
      if (organizationId && puesto.organizationId && puesto.organizationId !== organizationId) {
        errors.push("puestoId no pertenece a la organizacion actual");
      }

      if (hasValue(normalized.localidad)) {
        const regLoc = normalizeTextUpper(normalized.localidad);
        const puestoLoc = normalizeTextUpper(puesto.localidad);
        if (regLoc && puestoLoc && regLoc !== puestoLoc) {
          warnings.push(`Localidad no coincide con el puesto (${normalized.localidad} vs ${puesto.localidad})`);
        }
      } else {
        normalized.localidad = normalizeText(puesto.localidad);
      }
    }
  }

  if (strict && !hasValue(normalized.localidad)) {
    warnings.push("Registro sin localidad");
  }

  const invalid = errors.length > 0;
  const needsReview = !invalid && warnings.length > 0;

  return {
    skill: "validation",
    valid: !invalid,
    invalid,
    needsReview,
    dataIntegrityStatus: invalid ? "invalid" : needsReview ? "needs_review" : "valid",
    workflowStatus: invalid ? "invalid" : needsReview ? "flagged" : "validated",
    errors,
    warnings,
    normalized
  };
}
