export const REGISTRATION_WORKFLOW_STATUSES = [
  "new",
  "validated",
  "flagged",
  "duplicate",
  "invalid",
  "pending_call",
  "called",
  "confirmed",
  "rejected",
  "archived"
];

export const DEDUPLICATION_FLAG_TYPES = [
  "exact_duplicate",
  "probable_duplicate",
  "repeated_phone",
  "orphan_record",
  "puesto_localidad_mismatch"
];

export function normalizeText(value) {
  return (value || "").toString().trim();
}

export function normalizeTextUpper(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function normalizePhone(value) {
  const digits = (value || "").toString().replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `57${digits}`;
  return digits;
}
