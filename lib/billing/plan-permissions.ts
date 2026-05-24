import type { BillingPlan } from "@/lib/billing/plan-types";

/**
 * Matriz de permissões por plano (espelhar na Auth0 Action Post-Login
 * que injeta o mesmo conjunto em `https://cifra.ai/permissions`).
 */
export const PLAN_PERMISSIONS: Record<BillingPlan, readonly string[]> = {
  free: ["library:basic"],
  starter: ["library:basic", "library:import", "reports:scheduled"],
  pro: [
    "library:basic",
    "library:import",
    "reports:scheduled",
    "api:access",
    "billing:sso",
    "support:priority",
  ],
} as const;
