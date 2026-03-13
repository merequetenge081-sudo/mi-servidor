export function applyCleanAnalyticsFilter(match = {}, options = {}) {
  const {
    includeInvalid = false,
    includeNeedsReview = false,
    includeArchived = false
  } = options;

  if (includeInvalid) return match;

  match.dataIntegrityStatus = includeNeedsReview
    ? { $in: ["valid", "needs_review"] }
    : "valid";

  if (!includeArchived) {
    match.workflowStatus = {
      $nin: ["archived", "invalid", "rejected"]
    };
  }

  return match;
}
