import { jest } from "@jest/globals";

const findOneMock = jest.fn();
const findMock = jest.fn();
const updateOneMock = jest.fn();
const bulkWriteMock = jest.fn();
const leaderFindOneMock = jest.fn();
const puestoFindByIdMock = jest.fn();

jest.unstable_mockModule("../../../src/models/Registration.js", () => ({
  Registration: {
    findOne: findOneMock,
    find: findMock,
    updateOne: updateOneMock
  }
}));

jest.unstable_mockModule("../../../src/models/Leader.js", () => ({
  Leader: {
    findOne: leaderFindOneMock
  }
}));

jest.unstable_mockModule("../../../src/models/Puestos.js", () => ({
  Puestos: {
    findById: puestoFindByIdMock
  }
}));

jest.unstable_mockModule("../../../src/models/DeduplicationFlag.js", () => ({
  DeduplicationFlag: {
    bulkWrite: bulkWriteMock
  }
}));

const {
  runDeduplicationSkill,
  persistDeduplicationFlags
} = await import("../../../src/backend/skills/deduplication/deduplication.skill.js");

describe("deduplication.skill", () => {
  beforeEach(() => {
    findOneMock.mockReset();
    findMock.mockReset();
    updateOneMock.mockReset();
    bulkWriteMock.mockReset();
    leaderFindOneMock.mockReset();
    puestoFindByIdMock.mockReset();
  });

  test("detects exact duplicate and orphan leader", async () => {
    findOneMock.mockReturnValue({
      select: () => ({
        lean: async () => ({ _id: "reg-old", leaderId: "L1", createdAt: new Date() })
      })
    });
    findMock.mockImplementation(() => ({
      select: () => ({
        lean: async () => [],
        limit: () => ({ lean: async () => [] })
      })
    }));
    leaderFindOneMock.mockReturnValue({
      select: () => ({
        lean: async () => null
      })
    });
    puestoFindByIdMock.mockResolvedValue(null);

    const result = await runDeduplicationSkill({
      registration: {
        eventId: "E1",
        cedula: "123",
        leaderId: "L-missing",
        firstName: "Ana",
        lastName: "Perez",
        phone: "3001234567"
      },
      organizationId: "org1"
    });

    expect(result.hasFlags).toBe(true);
    expect(result.flags.some((f) => f.flagType === "exact_duplicate")).toBe(true);
    expect(result.flags.some((f) => f.flagType === "orphan_record")).toBe(true);
    expect(result.workflowStatus).toBe("duplicate");
  });

  test("persists flags in bulk", async () => {
    bulkWriteMock.mockResolvedValue({ ok: 1 });

    await persistDeduplicationFlags({
      registrationId: "507f1f77bcf86cd799439011",
      organizationId: "org1",
      eventId: "E1",
      cedula: "123",
      flags: [
        { flagType: "repeated_phone", severity: "medium", details: { phone: "573001112233" } }
      ]
    });

    expect(bulkWriteMock).toHaveBeenCalledTimes(1);
  });
});
