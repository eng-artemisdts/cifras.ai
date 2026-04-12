"use client";

import { useState, type ReactNode } from "react";

import { APP_LOGIN_PATH, sanitizeAuthReturnTo } from "@/lib/auth0-routes";
import { cn } from "@/lib/utils";

type PlanKey = "starter" | "pro";

type SubscribePlanButtonProps = {
  plan: PlanKey;
  className?: string;
  children: ReactNode;
};

/**
 * Inicia Checkout Stripe (assinatura). Se não houver sessão, envia para login com returnTo.
 */
export function SubscribePlanButton({ plan, className, children }: SubscribePlanButtonProps) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    setPending(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) {
        const returnTo = sanitizeAuthReturnTo(`/conta/assinatura?plan=${plan}`);
        const loginUrl =
          returnTo != null
            ? `${APP_LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}`
            : APP_LOGIN_PATH;
        window.location.assign(loginUrl);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("checkout", res.status, err);
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.assign(data.url);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void onClick()}
      className={cn(className, pending && "pointer-events-none opacity-70")}
    >
      {children}
    </button>
  );
}
