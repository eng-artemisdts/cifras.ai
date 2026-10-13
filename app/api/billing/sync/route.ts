import { NextResponse } from "next/server";

import { getAuth0Session } from "@/lib/auth0";
import { isAuth0Configured } from "@/lib/auth0-env";
import { isLocalBillingDevToolsEnabled } from "@/lib/billing/local-dev-tools";
import { isAuth0ManagementConfigured } from "@/lib/billing/auth0-management";
import { reconcileAuth0BillingFromStripe } from "@/lib/billing/stripe-auth0-reconcile";
import { isStripeBillingConfigured } from "@/lib/billing/stripe-server";

export const runtime = "nodejs";

/** Sincroniza plano Auth0 ← Stripe para o utilizador autenticado (só dev local). */
export async function POST() {
  if (!isLocalBillingDevToolsEnabled()) {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: "auth0_not_configured" }, { status: 503 });
  }
  if (!isStripeBillingConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  if (!isAuth0ManagementConfigured()) {
    return NextResponse.json({ error: "auth0_management_not_configured" }, { status: 503 });
  }

  const session = await getAuth0Session();
  const auth0Sub = session?.user?.sub;
  if (!auth0Sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const email = typeof session.user.email === "string" ? session.user.email : undefined;

  try {
    const result = await reconcileAuth0BillingFromStripe(auth0Sub, { email });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[billing sync]", e);
    const message = e instanceof Error ? e.message : "sync_failed";
    return NextResponse.json({ error: "sync_failed", detail: message }, { status: 500 });
  }
}
