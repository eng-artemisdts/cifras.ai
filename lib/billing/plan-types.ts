export type BillingPlan = "free" | "starter" | "pro";

export const BILLING_PLANS = ["free", "starter", "pro"] as const;

export function isPaidPlan(plan: BillingPlan): boolean {
  return plan === "starter" || plan === "pro";
}
