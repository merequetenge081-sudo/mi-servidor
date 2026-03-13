import { jest } from "@jest/globals";

const indexesMock = jest.fn();
const aggregateMock = jest.fn();
const statsMock = jest.fn();

const collectionMock = {
  indexes: indexesMock,
  aggregate: aggregateMock,
  stats: statsMock
};

const listCollectionsToArrayMock = jest.fn();
const dbMock = {
  listCollections: () => ({ toArray: listCollectionsToArrayMock }),
  collection: jest.fn(() => collectionMock),
  command: jest.fn()
};

jest.unstable_mockModule("mongoose", () => ({
  default: {
    connection: {
      db: dbMock
    }
  }
}));

const { runDatabaseOptimizationSkill } = await import("../../../src/backend/skills/databaseOptimization.skill.js");

describe("databaseOptimization.skill", () => {
  beforeEach(() => {
    indexesMock.mockReset();
    aggregateMock.mockReset();
    statsMock.mockReset();
    listCollectionsToArrayMock.mockReset();
    dbMock.collection.mockClear();
    dbMock.command.mockReset();
  });

  test("returns summary and detects missing indexes", async () => {
    listCollectionsToArrayMock.mockResolvedValue([{ name: "registrations" }]);
    statsMock.mockResolvedValue({ count: 10, size: 5000, avgObjSize: 500 });
    indexesMock.mockResolvedValue([{ key: { _id: 1 } }, { key: { eventId: 1 } }]);

    aggregateMock.mockImplementation((pipeline) => {
      if (pipeline.some((s) => s.$project && s.$project.size)) {
        return { toArray: async () => [{ _id: "a1", size: 2000 }] };
      }
      if (pipeline.some((s) => s.$project && s.$project.fields)) {
        return { toArray: async () => [{ _id: "debugField", count: 1 }] };
      }
      if (pipeline.some((s) => s.$group && s.$group._id && s.$group._id.phone)) {
        return {
          toArray: async () => [{ _id: { phone: "300", eventId: "E1" }, count: 2 }]
        };
      }
      return { toArray: async () => [] };
    });

    const result = await runDatabaseOptimizationSkill();
    expect(result).toHaveProperty("collectionsAnalyzed");
    expect(result.collectionsAnalyzed).toBe(1);
    expect(result.duplicateGroups).toBe(1);
    expect(result.indexesMissing).toBeGreaterThan(0);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  test("continues if collections are missing", async () => {
    listCollectionsToArrayMock.mockResolvedValue([]);
    const result = await runDatabaseOptimizationSkill();
    expect(result.collectionsAnalyzed).toBe(0);
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
