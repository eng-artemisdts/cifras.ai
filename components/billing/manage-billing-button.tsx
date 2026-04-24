"use client";

import { useState } from "react";

import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

type ManageBillingButtonProps = {
  className?: string;
};

export function ManageBillingButton({ className }: ManageBillingButtonProps) {
  const [pending, setPending] = useState(false);

  async function onClick() {
    trackAnalyticsEvent(GA_EVENTS.BILLING_MANAGE_CLICK);
    setPending(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.assign(data.url);
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
      {pending ? "A abrir…" : "Gerir faturação (Stripe)"}
    </button>
  );
}
