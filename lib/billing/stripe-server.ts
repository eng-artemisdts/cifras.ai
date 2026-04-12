import Stripe from "stripe";

let stripe: Stripe | undefined;

export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY não definido.");
  }
  if (!stripe) {
    stripe = new Stripe(key, {
      typescript: true,
    });
  }
  return stripe;
}

export function stripePriceIdForPlan(plan: "starter" | "pro"): string | undefined {
  const envKey = plan === "starter" ? "STRIPE_PRICE_STARTER" : "STRIPE_PRICE_PRO";
  return process.env[envKey]?.trim();
}
