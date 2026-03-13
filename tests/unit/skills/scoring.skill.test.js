import { calculateRegistrationScore, resolvePriority } from "../../../src/backend/skills/scoring/scoring.skill.js";

describe("scoring.skill", () => {
  test("calculates high priority for strong validated record", () => {
    const result = calculateRegistrationScore({
      leaderReliability: "high",
      dataIntegrityStatus: "valid",
      workflowStatus: "validated",
      isStrategicTerritory: true,
      recentContact: false,
      deduplicationFlags: []
    });

    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.priority).toBe("high");
  });

  test("applies duplicate penalties", () => {
    const result = calculateRegistrationScore({
      dataIntegrityStatus: "needs_review",
      workflowStatus: "flagged",
      deduplicationFlags: ["probable_duplicate", "exact_duplicate"]
    });

    expect(result.score).toBeLessThan(40);
    expect(result.priority).toBe("low");
  });

  test("resolves priority thresholds", () => {
    expect(resolvePriority(80)).toBe("high");
    expect(resolvePriority(50)).toBe("medium");
    expect(resolvePriority(10)).toBe("low");
  });
});
