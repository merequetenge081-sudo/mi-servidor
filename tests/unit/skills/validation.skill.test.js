import { jest } from "@jest/globals";

const findByIdMock = jest.fn();

jest.unstable_mockModule("../../../src/models/Puestos.js", () => ({
  Puestos: { findById: findByIdMock }
}));

const { runValidationSkill } = await import("../../../src/backend/skills/validation/validation.skill.js");

describe("validation.skill", () => {
  beforeEach(() => {
    findByIdMock.mockReset();
  });

  test("rejects missing required fields", async () => {
    const result = await runValidationSkill({
      registration: { firstName: "Ana" },
      organizationId: "org1",
      strict: true
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("leaderId"))).toBe(true);
    expect(result.dataIntegrityStatus).toBe("invalid");
    expect(result.workflowStatus).toBe("invalid");
  });

  test("warns when localidad mismatches puesto", async () => {
    findByIdMock.mockReturnValue({
      lean: async () => ({ _id: "p1", organizationId: "org1", localidad: "Suba" })
    });

    const result = await runValidationSkill({
      registration: {
        leaderId: "L1",
        eventId: "E1",
        firstName: "Ana",
        lastName: "Perez",
        cedula: "123",
        registeredToVote: true,
        puestoId: "p1",
        mesa: 4,
        localidad: "Kennedy",
        phone: "300-555-1212"
      },
      organizationId: "org1",
      strict: true
    });

    expect(result.valid).toBe(true);
    expect(result.needsReview).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.dataIntegrityStatus).toBe("needs_review");
    expect(result.normalized.phone).toBe("573005551212");
  });
});
