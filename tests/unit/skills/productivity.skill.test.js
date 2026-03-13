import { jest } from "@jest/globals";

const aggregateMock = jest.fn();
const updateOneMock = jest.fn();

jest.unstable_mockModule("../../../src/models/Registration.js", () => ({
  Registration: { aggregate: aggregateMock }
}));

jest.unstable_mockModule("../../../src/models/LeaderMetric.js", () => ({
  LeaderMetric: { updateOne: updateOneMock }
}));

const { recalculateLeaderProductivity } = await import("../../../src/backend/skills/productivity/productivity.skill.js");

describe("productivity.skill", () => {
  beforeEach(() => {
    aggregateMock.mockReset();
    updateOneMock.mockReset();
  });

  test("recalculates and upserts leader metrics", async () => {
    aggregateMock.mockResolvedValue([
      {
        _id: "L1",
        totalUploaded: 10,
        totalValid: 8,
        totalDuplicates: 1,
        totalConfirmed: 5
      }
    ]);
    updateOneMock.mockResolvedValue({ acknowledged: true });

    const result = await recalculateLeaderProductivity({
      organizationId: "org1",
      eventId: "evt1",
      date: "2026-03-08"
    });

    expect(result.skill).toBe("productivity");
    expect(result.leaders).toBe(1);
    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(updateOneMock.mock.calls[0][1].$set.effectivenessRate).toBe(50);
  });
});
