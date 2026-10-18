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

/**
 * Todos os Prices de um plano, lidos de `STRIPE_PRICE_STARTER` / `STRIPE_PRICE_PRO`.
 * Aceita uma lista separada por vírgulas: o primeiro é o preço atual (usado no checkout);
 * os seguintes são preços antigos que ainda têm assinantes e continuam a dar o plano.
 */
export function stripePriceIdsForPlan(plan: "starter" | "pro"): string[] {
  const envKey = plan === "starter" ? "STRIPE_PRICE_STARTER" : "STRIPE_PRICE_PRO";
  return (process.env[envKey] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/** Price usado em novos checkouts (o primeiro da lista). */
export function stripePriceIdForPlan(plan: "starter" | "pro"): string | undefined {
  return stripePriceIdsForPlan(plan)[0];
}
