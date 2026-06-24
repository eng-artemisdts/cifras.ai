import type { BillingPlan } from "@/lib/billing/plan-types";

/** Limites semanais de importação — espelham `schubert-api` (`WEEKLY_IMPORT_LIMITS`). */
export const WEEKLY_IMPORT_LIMITS: Record<BillingPlan, number> = {
  free: 3,
  starter: 5,
  pro: 10,
};

export const IMPORT_QUOTA_WINDOW_DAYS = 7;

export function importQuotaPlanLabel(plan: BillingPlan): string {
  if (plan === "pro") return "Pro";
  if (plan === "starter") return "Starter";
  return "Gratuito";
}
