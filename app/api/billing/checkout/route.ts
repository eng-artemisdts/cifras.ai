import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { getSiteUrl } from "@/components/seo/google-site-seo";
import { getStripe, isStripeBillingConfigured, stripePriceIdForPlan } from "@/lib/billing/stripe-server";

export const runtime = "nodejs";

type Body = { plan?: string };

export async function POST(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const session = await getAuth0Session();
  const sub = session?.user?.sub;
  if (!sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const plan = body.plan === "starter" || body.plan === "pro" ? body.plan : null;
  if (!plan) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  const priceId = stripePriceIdForPlan(plan);
  if (!priceId) {
    return NextResponse.json(
      { error: "price_not_configured", detail: plan === "starter" ? "STRIPE_PRICE_STARTER" : "STRIPE_PRICE_PRO" },
      { status: 500 },
    );
  }

  const origin = getSiteUrl();
  const stripe = getStripe();

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: sub,
    customer_email: session.user.email ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/conta/assinatura?checkout=success`,
    cancel_url: `${origin}/conta/assinatura?checkout=cancel`,
    metadata: { auth0_sub: sub },
    subscription_data:
      plan === "pro"
        ? {
            trial_period_days: 14,
            metadata: { auth0_sub: sub },
          }
        : { metadata: { auth0_sub: sub } },
  });

  if (!checkout.url) {
    return NextResponse.json({ error: "checkout_url_missing" }, { status: 500 });
  }

  return NextResponse.json({ url: checkout.url });
}
