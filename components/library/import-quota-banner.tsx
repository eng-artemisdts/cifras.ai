"use client";

import Link from "next/link";
import { Gauge, Sparkles } from "lucide-react";

import { useImportQuotaOptional } from "@/components/providers/import-quota-context";
import { importQuotaPlanLabel } from "@/lib/billing/import-quota-limits";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { formatImportQuotaResetLabel } from "@/lib/import-quota-client";
import { cn } from "@/lib/utils";

export type ImportQuotaBannerProps = {
  billingPlan?: BillingPlan | null;
  className?: string;
  /** Versão compacta para painéis com pouco espaço. */
  compact?: boolean;
};

function QuotaMeter({
  used,
  limit,
  lifetime,
}: {
  used: number;
  limit: number;
  lifetime: boolean;
}) {
  const periodLabel = lifetime ? "no total" : "nos últimos 30 dias";
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const exhausted = used >= limit;
  return (
    <div className="space-y-1.5">
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${used} de ${limit} importações usadas ${periodLabel}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            exhausted ? "bg-cifra-gold" : pct >= 80 ? "bg-amber-400/90" : "bg-cifra-teal",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cifra-muted">
        {used}/{limit} {periodLabel}
      </p>
    </div>
  );
}

/**
 * Indicador da cota de importações (vitalícia no Grátis, 30 dias nos pagos) — lê estado do `ImportQuotaProvider`.
 */
export function ImportQuotaBanner({
  billingPlan = "free",
  className,
  compact = false,
}: ImportQuotaBannerProps) {
  const ctx = useImportQuotaOptional();
  const quota = ctx?.quota;
  const loading = ctx?.loading ?? false;

  if (loading && !quota) {
    return (
      <div
        className={cn(
          "animate-pulse rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3",
          className,
        )}
        aria-hidden
      >
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="mt-2 h-1.5 rounded-full bg-white/10" />
      </div>
    );
  }

  if (!quota) return null;

  const plan = quota.plan ?? billingPlan ?? "free";
  const exhausted = quota.remaining <= 0;
  const lifetime = quota.window === "lifetime";
  const resetLabel = formatImportQuotaResetLabel(quota.nextSlotAt);
  const showUpgrade = plan !== "pro";

  if (compact && !exhausted) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2",
          className,
        )}
      >
        <Gauge className="size-3.5 shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
        <span className="text-[11px] text-cifra-muted">
          <span className="font-medium text-cifra-text">{quota.remaining}</span> importações restantes
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        exhausted
          ? "border-cifra-gold/45 bg-cifra-gold/[0.06]"
          : "border-cifra-teal/25 bg-cifra-teal/[0.05]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1",
            exhausted
              ? "bg-cifra-gold/10 ring-cifra-gold/30 text-cifra-gold"
              : "bg-cifra-teal/10 ring-cifra-teal/30 text-cifra-teal",
          )}
        >
          {exhausted ? (
            <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
          ) : (
            <Gauge className="size-4" strokeWidth={1.75} aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="space-y-0.5">
            <p className="text-[13px] font-semibold leading-snug text-cifra-text">
              {exhausted
                ? lifetime
                  ? "Músicas grátis esgotadas"
                  : "Limite do plano atingido"
                : `${quota.remaining} importação${quota.remaining === 1 ? "" : "ões"} disponível${quota.remaining === 1 ? "" : "eis"}`}
            </p>
            <p className="text-[11px] leading-relaxed text-cifra-muted">
              Plano {importQuotaPlanLabel(plan)} ·{" "}
              {lifetime ? `${quota.limit} músicas no total` : `janela de ${quota.windowDays ?? 30} dias`}
              {exhausted && resetLabel ? ` · próximo slot ${resetLabel}` : ""}
            </p>
          </div>
          <QuotaMeter used={quota.used} limit={quota.limit} lifetime={lifetime} />
          {exhausted && showUpgrade ? (
            <Link
              href="/conta/assinatura"
              className="inline-flex text-[11px] font-medium text-cifra-gold underline-offset-2 hover:underline"
            >
              {lifetime ? "Assinar para importar mais músicas" : "Ver planos para mais importações"}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
