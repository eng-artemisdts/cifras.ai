import {
  fetchAuth0UserBillingSnapshot,
  isAuth0ManagementConfigured,
} from "@/lib/billing/auth0-management";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { PLAN_PERMISSIONS } from "@/lib/billing/plan-permissions";
import { billingPlanFromSessionUser, permissionsFromSessionUser } from "@/lib/entitlements";

/**
 * Plano efetivo para UI e gates: `app_metadata` (Management API) quando disponível,
 * senão claims da sessão.
 */
export async function resolveBillingPlanForSessionUser(sessionUser: unknown): Promise<BillingPlan> {
  const { plan } = await resolveBillingEntitlementsForSessionUser(sessionUser);
  return plan;
}

/**
 * Plano + permissões alinhados ao `app_metadata` quando a Management API está disponível.
 * Evita JWT desactualizado bloquear features após sync Stripe.
 */
export async function resolveBillingEntitlementsForSessionUser(sessionUser: unknown): Promise<{
  plan: BillingPlan;
  permissions: string[];
}> {
  const u = sessionUser as { sub?: string } | null | undefined;
  if (!u?.sub) {
    return { plan: "free", permissions: [...PLAN_PERMISSIONS.free] };
  }

  const snapshot = isAuth0ManagementConfigured()
    ? await fetchAuth0UserBillingSnapshot(u.sub)
    : null;
  if (snapshot?.plan !== undefined && snapshot.plan !== null) {
    return {
      plan: snapshot.plan,
      permissions: [...PLAN_PERMISSIONS[snapshot.plan]],
    };
  }

  const plan = billingPlanFromSessionUser(sessionUser);
  return { plan, permissions: permissionsFromSessionUser(sessionUser) };
}
