const DEFAULT_SCORING_RULES = {
  reliableLeaderBonus: 20,
  validatedBonus: 15,
  probableDuplicatePenalty: -20,
  exactDuplicatePenalty: -40,
  strategicTerritoryBonus: 10,
  recentContactPenalty: -10,
  needsReviewPenalty: -8
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function resolvePriority(score) {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function calculateRegistrationScore(input = {}, rules = DEFAULT_SCORING_RULES) {
  let score = 50;
  const reasons = [];

  if (input.leaderReliability === "high") {
    score += rules.reliableLeaderBonus;
    reasons.push("leader_reliable");
  }

  if (input.dataIntegrityStatus === "valid" || input.workflowStatus === "validated") {
    score += rules.validatedBonus;
    reasons.push("validated_record");
  }

  const flags = Array.isArray(input.deduplicationFlags) ? input.deduplicationFlags : [];
  if (flags.includes("probable_duplicate")) {
    score += rules.probableDuplicatePenalty;
    reasons.push("probable_duplicate");
  }
  if (flags.includes("exact_duplicate")) {
    score += rules.exactDuplicatePenalty;
    reasons.push("exact_duplicate");
  }

  if (input.isStrategicTerritory) {
    score += rules.strategicTerritoryBonus;
    reasons.push("strategic_territory");
  }

  if (input.recentContact === true) {
    score += rules.recentContactPenalty;
    reasons.push("recent_contact");
  }

  if (input.dataIntegrityStatus === "needs_review" || input.workflowStatus === "flagged") {
    score += rules.needsReviewPenalty;
    reasons.push("needs_review");
  }

  const normalized = clamp(score, 0, 100);
  return {
    skill: "scoring",
    score: normalized,
    priority: resolvePriority(normalized),
    reasons
  };
}

export default {
  calculateRegistrationScore,
  resolvePriority
};
