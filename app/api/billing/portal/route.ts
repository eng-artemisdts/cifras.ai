import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { getSiteUrl } from "@/components/seo/google-site-seo";
import { fetchAuth0UserBillingSnapshot } from "@/lib/billing/auth0-management";
import { getStripe, isStripeBillingConfigured } from "@/lib/billing/stripe-server";
import { stripeCustomerIdFromSessionUser } from "@/lib/entitlements";

export const runtime = "nodejs";

export async function POST() {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const session = await getAuth0Session();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let customerId = stripeCustomerIdFromSessionUser(session.user);
  if (!customerId && session.user.sub) {
    const snap = await fetchAuth0UserBillingSnapshot(session.user.sub);
    customerId = snap?.stripe_customer_id;
  }
  if (!customerId) {
    return NextResponse.json({ error: "no_stripe_customer" }, { status: 400 });
  }

  const origin = getSiteUrl();
  const portal = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/conta/assinatura`,
  });

  return NextResponse.json({ url: portal.url });
}
