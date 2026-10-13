"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type SyncPlanButtonProps = {
  className?: string;
  children?: ReactNode;
};

export function SyncPlanButton({ className, children }: SyncPlanButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; detail?: string; plan?: string };
      if (!res.ok) {
        setError(data.detail ?? data.error ?? "sync_failed");
        return;
      }
      router.refresh();
    } catch {
      setError("sync_failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => void onClick()}
        className={cn(className, pending && "pointer-events-none opacity-70")}
      >
        {pending ? "A sincronizar…" : (children ?? "Sincronizar com Stripe")}
      </button>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          Não foi possível sincronizar. Tente de novo ou contacte o suporte.
        </p>
      ) : null}
    </div>
  );
}
