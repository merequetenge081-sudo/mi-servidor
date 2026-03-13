export const ORGANIZATION_PLAN_LIMITS = Object.freeze({
  free: Object.freeze({ maxLeaders: 10, maxEvents: 5, maxRegistrationsPerEvent: 500 }),
  pro: Object.freeze({ maxLeaders: 100, maxEvents: 50, maxRegistrationsPerEvent: 5000 }),
  enterprise: Object.freeze({ maxLeaders: 10000, maxEvents: 10000, maxRegistrationsPerEvent: 100000 })
});

export function isValidOrganizationPlan(plan) {
  return Object.prototype.hasOwnProperty.call(ORGANIZATION_PLAN_LIMITS, plan);
}

export function getOrganizationPlanLimits(plan) {
  return ORGANIZATION_PLAN_LIMITS[plan] || ORGANIZATION_PLAN_LIMITS.enterprise;
}

export function getOrganizationPlanNames() {
  return Object.keys(ORGANIZATION_PLAN_LIMITS);
}

export function generateOrganizationSlug(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}
