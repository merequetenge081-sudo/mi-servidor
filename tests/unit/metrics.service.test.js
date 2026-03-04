import { jest } from "@jest/globals";

const aggregateMock = jest.fn();
const leaderCountMock = jest.fn();
const leaderFindMock = jest.fn();

jest.unstable_mockModule("../../src/models/Registration.js", () => ({
  Registration: { aggregate: aggregateMock }
}));

jest.unstable_mockModule("../../src/models/Leader.js", () => ({
  Leader: {
    countDocuments: leaderCountMock,
    find: leaderFindMock
  }
}));

jest.unstable_mockModule("../../src/models/Event.js", () => ({
  Event: { countDocuments: jest.fn() }
}));

jest.unstable_mockModule("../../src/models/Puestos.js", () => ({
  Puestos: { countDocuments: jest.fn(), aggregate: jest.fn() }
}));

const metricsService = await import("../../src/services/metrics.service.js");

describe("metrics.service", () => {
  beforeEach(() => {
    aggregateMock.mockReset();
    leaderCountMock.mockReset();
    leaderFindMock.mockReset();
  });

  test("getRegistrationStats filters invalid data", async () => {
    aggregateMock.mockResolvedValue([{}]);

    await metricsService.getRegistrationStats({ organizationId: "org1" });

    const pipeline = aggregateMock.mock.calls[0][0];
    expect(pipeline[0].$match.dataIntegrityStatus).toEqual({ $ne: "invalid" });
  });

  test("getDashboardMetrics applies integrity filter in match", async () => {
    aggregateMock
      .mockResolvedValueOnce([]) // leader aggregation
      .mockResolvedValueOnce([]); // locality aggregation
    leaderCountMock.mockResolvedValue(0);
    leaderFindMock.mockReturnValue({
      lean: () => Promise.resolve([])
    });

    await metricsService.getDashboardMetrics({ organizationId: "org1" });

    const firstPipeline = aggregateMock.mock.calls[0][0];
    expect(firstPipeline[0].$match.dataIntegrityStatus).toEqual({ $ne: "invalid" });
  });
});
