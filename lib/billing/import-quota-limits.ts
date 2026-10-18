import type { BillingPlan } from "@/lib/billing/plan-types";

/** Limites e janelas das cotas: ver `PLAN_CATALOG` em `@/lib/billing/plan-catalog`. */
export function importQuotaPlanLabel(plan: BillingPlan): string {
  if (plan === "pro") return "Pro";
  if (plan === "starter") return "Starter";
  return "Gratuito";
}
