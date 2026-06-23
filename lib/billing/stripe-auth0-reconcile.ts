import type Stripe from "stripe";

import {
  fetchAuth0UserBillingSnapshot,
  patchAuth0UserAppMetadata,
} from "@/lib/billing/auth0-management";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { billingStateFromStripeSubscription } from "@/lib/billing/subscription-sync";
import { getStripe } from "@/lib/billing/stripe-server";

export type BillingReconcileResult = {
  ok: true;
  plan: BillingPlan;
  stripe_customer_id?: string;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  reason?: string;
};

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Localiza customer Stripe ligado ao utilizador Auth0 (metadata, id conhecido ou email). */
export async function findStripeCustomerForAuth0User(
  stripe: Stripe,
  params: {
    auth0Sub: string;
    email?: string | null;
    knownCustomerId?: string | null;
  },
): Promise<Stripe.Customer | null> {
  const { auth0Sub, email, knownCustomerId } = params;

  if (knownCustomerId?.trim()) {
    try {
      const c = await stripe.customers.retrieve(knownCustomerId.trim());
      if (!("deleted" in c && c.deleted)) return c as Stripe.Customer;
    } catch {
      /* tentar fallbacks */
    }
  }

  try {
    const search = await stripe.customers.search({
      query: `metadata['auth0_sub']:'${escapeStripeSearchValue(auth0Sub)}'`,
      limit: 1,
    });
    if (search.data[0]) return search.data[0];
  } catch (e) {
    console.warn("[billing] pesquisa Stripe por auth0_sub falhou:", e);
  }

  const normalizedEmail = email?.trim();
  if (normalizedEmail) {
    try {
      const search = await stripe.customers.search({
        query: `email:'${escapeStripeSearchValue(normalizedEmail)}'`,
        limit: 10,
      });
      for (const c of search.data) {
        if (c.metadata?.auth0_sub?.trim() === auth0Sub) return c;
      }
      for (const c of search.data) {
        const subs = await stripe.subscriptions.list({
          customer: c.id,
          status: "active",
          limit: 1,
        });
        if (subs.data.length > 0) return c;
      }
      if (search.data[0]) return search.data[0];
    } catch (e) {
      console.warn("[billing] pesquisa Stripe por email falhou:", e);
    }
  }

  return null;
}

/** Subscrição «principal» (active > trialing > past_due > resto). */
export async function getPrimaryStripeSubscription(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 20,
  });

  const byPriority = ["active", "trialing", "past_due"] as const;
  for (const status of byPriority) {
    const match = subs.data.find((s) => s.status === status);
    if (match) {
      return stripe.subscriptions.retrieve(match.id, { expand: ["items.data.price"] });
    }
  }

  const first = subs.data[0];
  if (!first) return null;
  return stripe.subscriptions.retrieve(first.id, { expand: ["items.data.price"] });
}

/** Garante `auth0_sub` no customer e na subscrição (para webhooks futuros). */
export async function ensureStripeBillingMetadata(
  stripe: Stripe,
  params: {
    auth0Sub: string;
    customerId: string;
    subscriptionId?: string | null;
  },
): Promise<void> {
  const { auth0Sub, customerId, subscriptionId } = params;
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) return;
  if (customer.metadata?.auth0_sub?.trim() !== auth0Sub) {
    await stripe.customers.update(customerId, {
      metadata: { ...customer.metadata, auth0_sub: auth0Sub },
    });
  }
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    if (sub.metadata?.auth0_sub?.trim() !== auth0Sub) {
      await stripe.subscriptions.update(subscriptionId, {
        metadata: { ...sub.metadata, auth0_sub: auth0Sub },
      });
    }
  }
}

/**
 * Lê estado actual na Stripe e persiste plano em Auth0 `app_metadata`.
 * Usado pelo webhook (com sub conhecida) e por sync manual (utilizador autenticado).
 */
export async function reconcileAuth0BillingFromStripe(
  auth0Sub: string,
  options?: { email?: string | null; knownCustomerId?: string | null },
): Promise<BillingReconcileResult> {
  const stripe = getStripe();
  const snapshot = await fetchAuth0UserBillingSnapshot(auth0Sub);
  const customer = await findStripeCustomerForAuth0User(stripe, {
    auth0Sub,
    email: options?.email,
    knownCustomerId: options?.knownCustomerId ?? snapshot?.stripe_customer_id,
  });

  if (!customer) {
    await patchAuth0UserAppMetadata(auth0Sub, {
      plan: "free",
      subscription_status: null,
      stripe_subscription_id: null,
    });
    return { ok: true, plan: "free", reason: "no_stripe_customer" };
  }

  await ensureStripeBillingMetadata(stripe, {
    auth0Sub,
    customerId: customer.id,
  });

  const sub = await getPrimaryStripeSubscription(stripe, customer.id);
  if (!sub) {
    await patchAuth0UserAppMetadata(auth0Sub, {
      plan: "free",
      stripe_customer_id: customer.id,
      stripe_subscription_id: null,
      subscription_status: null,
    });
    return {
      ok: true,
      plan: "free",
      stripe_customer_id: customer.id,
      stripe_subscription_id: null,
      subscription_status: null,
      reason: "no_subscription",
    };
  }

  await ensureStripeBillingMetadata(stripe, {
    auth0Sub,
    customerId: customer.id,
    subscriptionId: sub.id,
  });

  const state = billingStateFromStripeSubscription(sub);
  await patchAuth0UserAppMetadata(auth0Sub, state);
  return {
    ok: true,
    plan: state.plan,
    stripe_customer_id: state.stripe_customer_id,
    stripe_subscription_id: state.stripe_subscription_id,
    subscription_status: state.subscription_status,
  };
}

/** Sincroniza Auth0 a partir de uma subscrição Stripe (webhook). */
export async function syncAuth0FromStripeSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
  auth0Sub: string,
): Promise<BillingReconcileResult> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (customerId) {
    await ensureStripeBillingMetadata(stripe, {
      auth0Sub,
      customerId,
      subscriptionId: sub.id,
    });
  }
  const state = billingStateFromStripeSubscription(sub);
  await patchAuth0UserAppMetadata(auth0Sub, state);
  return {
    ok: true,
    plan: state.plan,
    stripe_customer_id: state.stripe_customer_id,
    stripe_subscription_id: state.stripe_subscription_id,
    subscription_status: state.subscription_status,
  };
}
