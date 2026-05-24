import type Stripe from "stripe";

import type { BillingPlan } from "@/lib/billing/plan-types";
import { stripePriceIdForPlan } from "@/lib/billing/stripe-server";

function priceIdToPlan(priceId: string | undefined): BillingPlan {
  if (!priceId) return "free";
  const starter = stripePriceIdForPlan("starter");
  const pro = stripePriceIdForPlan("pro");
  if (pro && priceId === pro) return "pro";
  if (starter && priceId === starter) return "starter";
  return "free";
}

/** Mapeia subscrição Stripe para plano e estado persistido no Auth0. */
export function billingStateFromStripeSubscription(
  sub: Stripe.Subscription,
): {
  plan: BillingPlan;
  subscription_status: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
} {
  const status = sub.status;
  const priceId = sub.items.data[0]?.price?.id;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) {
    throw new Error("Subscription sem customer id.");
  }
  if (status === "active" || status === "trialing") {
    return {
      plan: priceIdToPlan(priceId),
      subscription_status: status,
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    };
  }
  return {
    plan: "free",
    subscription_status: status,
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
  };
}
