import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { patchAuth0UserAppMetadata } from "@/lib/billing/auth0-management";
import { billingStateFromStripeSubscription } from "@/lib/billing/subscription-sync";
import { getStripe, isStripeBillingConfigured } from "@/lib/billing/stripe-server";

export const runtime = "nodejs";

async function resolveAuth0SubFromSubscription(
  stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<string | undefined> {
  const fromMeta = sub.metadata?.auth0_sub?.trim();
  if (fromMeta) return fromMeta;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return undefined;
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer && customer.deleted) return undefined;
  const c = customer.metadata?.auth0_sub?.trim();
  return c || undefined;
}

async function handleSubscriptionSynced(stripe: Stripe, sub: Stripe.Subscription) {
  const auth0Sub = await resolveAuth0SubFromSubscription(stripe, sub);
  if (!auth0Sub) return;
  const state = billingStateFromStripeSubscription(sub);
  await patchAuth0UserAppMetadata(auth0Sub, {
    plan: state.plan,
    stripe_customer_id: state.stripe_customer_id,
    stripe_subscription_id: state.stripe_subscription_id,
    subscription_status: state.subscription_status,
  });
}

async function handleSubscriptionDeleted(stripe: Stripe, sub: Stripe.Subscription) {
  const auth0Sub = await resolveAuth0SubFromSubscription(stripe, sub);
  if (!auth0Sub) return;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  await patchAuth0UserAppMetadata(auth0Sub, {
    plan: "free",
    subscription_status: sub.status ?? "canceled",
    stripe_subscription_id: null,
    stripe_customer_id: customerId ?? null,
  });
}

export async function POST(req: Request) {
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "webhook_secret_missing" }, { status: 500 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const auth0Sub =
          session.metadata?.auth0_sub?.trim() || session.client_reference_id?.trim();
        const subId = session.subscription;
        if (!auth0Sub || typeof subId !== "string") break;
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
        const state = billingStateFromStripeSubscription(sub);
        await patchAuth0UserAppMetadata(auth0Sub, state);
        if (typeof session.customer === "string") {
          await stripe.customers.update(session.customer, {
            metadata: { auth0_sub: auth0Sub },
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionSynced(stripe, event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(stripe, event.data.object as Stripe.Subscription);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe webhook]", e);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
