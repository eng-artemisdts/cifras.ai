import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  ensureStripeBillingMetadata,
  resolveAuth0SubForStripeBilling,
  syncAuth0FromStripeSubscription,
} from "@/lib/billing/stripe-auth0-reconcile";
import { patchAuth0UserAppMetadata } from "@/lib/billing/auth0-management";
import { getStripe, isStripeBillingConfigured } from "@/lib/billing/stripe-server";

export const runtime = "nodejs";

async function handleSubscriptionSynced(stripe: Stripe, sub: Stripe.Subscription) {
  const auth0Sub = await resolveAuth0SubForStripeBilling(stripe, { subscription: sub });
  if (!auth0Sub) {
    console.warn(
      "[stripe webhook] utilizador Auth0 não encontrado; ignorando sync da subscrição",
      sub.id,
    );
    return;
  }
  await syncAuth0FromStripeSubscription(stripe, sub, auth0Sub);
}

async function handleSubscriptionDeleted(stripe: Stripe, sub: Stripe.Subscription) {
  const auth0Sub = await resolveAuth0SubForStripeBilling(stripe, { subscription: sub });
  if (!auth0Sub) {
    console.warn(
      "[stripe webhook] utilizador Auth0 não encontrado; ignorando cancelamento da subscrição",
      sub.id,
    );
    return;
  }
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
        const auth0Sub = await resolveAuth0SubForStripeBilling(stripe, { session });
        const subId = session.subscription;
        if (!auth0Sub || typeof subId !== "string") {
          console.warn("[stripe webhook] checkout sem utilizador Auth0 ou subscription id", session.id);
          break;
        }
        const sub = await stripe.subscriptions.retrieve(subId, { expand: ["items.data.price"] });
        await syncAuth0FromStripeSubscription(stripe, sub, auth0Sub);
        const customerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (customerId) {
          await ensureStripeBillingMetadata(stripe, {
            auth0Sub,
            customerId,
            subscriptionId: sub.id,
          });
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const raw = event.data.object as Stripe.Subscription;
        const sub = await stripe.subscriptions.retrieve(raw.id, {
          expand: ["items.data.price"],
        });
        await handleSubscriptionSynced(stripe, sub);
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
