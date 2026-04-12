import {
  fetchAuth0UserBillingSnapshot,
  isAuth0ManagementConfigured,
} from "@/lib/billing/auth0-management";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { billingPlanFromSessionUser } from "@/lib/entitlements";

/**
 * Plano efetivo para UI e gates: `app_metadata` (Management API) quando disponível,
 * senão claims da sessão.
 */
export async function resolveBillingPlanForSessionUser(sessionUser: unknown): Promise<BillingPlan> {
  const u = sessionUser as { sub?: string } | null | undefined;
  if (!u?.sub) return "free";
  const snapshot = isAuth0ManagementConfigured() ? await fetchAuth0UserBillingSnapshot(u.sub) : null;
  if (snapshot?.plan !== undefined && snapshot.plan !== null) {
    return snapshot.plan;
  }
  return billingPlanFromSessionUser(sessionUser);
}
