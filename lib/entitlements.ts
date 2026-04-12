import { CIFRA_CLAIMS_NS } from "@/lib/billing/claims-namespace";
import { PLAN_PERMISSIONS } from "@/lib/billing/plan-permissions";
import type { BillingPlan } from "@/lib/billing/plan-types";

type SessionUser = Record<string, unknown>;

function asUserRecord(user: unknown): SessionUser | null {
  if (!user || typeof user !== "object") return null;
  return user as SessionUser;
}

/**
 * Plano efetivo a partir do perfil de sessão (claims injetados pela Auth0 Action).
 */
export function billingPlanFromSessionUser(user: unknown): BillingPlan {
  const u = asUserRecord(user);
  if (!u) return "free";
  const p = u[`${CIFRA_CLAIMS_NS}plan`];
  if (p === "starter" || p === "pro") return p;
  return "free";
}

/**
 * Lista de permissões (preferência pelo claim; senão deriva do plano).
 */
export function permissionsFromSessionUser(user: unknown): string[] {
  const u = asUserRecord(user);
  if (!u) return [...PLAN_PERMISSIONS.free];
  const raw = u[`${CIFRA_CLAIMS_NS}permissions`];
  if (Array.isArray(raw) && raw.every((x) => typeof x === "string")) {
    return [...raw];
  }
  return [...PLAN_PERMISSIONS[billingPlanFromSessionUser(user)]];
}

export function sessionUserHasPermission(user: unknown, permission: string): boolean {
  return permissionsFromSessionUser(user).includes(permission);
}

export function stripeCustomerIdFromSessionUser(user: unknown): string | undefined {
  const u = asUserRecord(user);
  if (!u) return undefined;
  const id = u[`${CIFRA_CLAIMS_NS}stripe_customer_id`];
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** TikTok / Instagram: plano Pro resolvido (Stripe/Auth0) ou permissão `api:access` no JWT. */
export function hasProStreamingImports(user: unknown, resolvedPlan: BillingPlan): boolean {
  return resolvedPlan === "pro" || sessionUserHasPermission(user, "api:access");
}
