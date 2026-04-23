import Image from "next/image";
import Link from "next/link";

import { Auth0UserMenu } from "@/components/auth/auth0-user-menu";
import type { LibraryTopNavUser } from "@/components/library/library-top-nav";
import type { BillingPlan } from "@/lib/billing/plan-types";
import { cn } from "@/lib/utils";

export type CifraCenterChromeProps = {
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  title: string;
  subtitle: string;
  durationLabel?: string;
  /** Secção opcional sob o subtítulo (ex.: selector de variação). */
  headerAccessory?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

/**
 * Coluna central: um único header (logo + Biblioteca · faixa | FREE + auth) e área da cifra.
 */
export function CifraCenterChrome({
  user,
  billingPlan,
  title,
  subtitle,
  durationLabel,
  headerAccessory,
  children,
  className,
}: CifraCenterChromeProps) {
  const planLabel = billingPlan === "pro" ? "PRO" : billingPlan === "starter" ? "STARTER" : "FREE";
  const planClassName =
    billingPlan === "pro"
      ? "border-cifra-gold/55 bg-cifra-gold/12 text-cifra-gold"
      : billingPlan === "starter"
        ? "border-cifra-teal/45 bg-cifra-teal/12 text-cifra-teal"
        : "border-[#F0B42944] text-cifra-gold";
  const planStyle = billingPlan === "free" || !billingPlan ? { backgroundColor: "#F0B42918" } : undefined;

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <header className="flex w-full shrink-0 items-start justify-between gap-3 border-b border-white/7 px-4 py-3 sm:items-center sm:gap-4 sm:px-6 sm:py-3.5 md:px-8">
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              className="relative block size-[26px] shrink-0 overflow-hidden rounded-md ring-1 ring-white/8"
              aria-label="cifra.ai — início"
            >
              <Image src="/logo.svg" alt="" width={26} height={26} className="object-contain" />
            </Link>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold sm:text-[13px]">
              <Link href="/biblioteca" className="shrink-0 text-cifra-teal hover:text-cifra-teal-hover">
                Biblioteca
              </Link>
              <span className="shrink-0 text-cifra-muted">·</span>
              <span className="min-w-0 truncate text-cifra-text">{title}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-cifra-muted sm:text-xs">
              {subtitle}
              {durationLabel ? (
                <span className="ml-1 font-mono text-[10px] text-cifra-muted"> · {durationLabel}</span>
              ) : null}
            </p>
            {headerAccessory ? (
              <div className="mt-2.5 min-w-0 max-w-full">{headerAccessory}</div>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5 sm:gap-2.5 sm:pt-0">
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] sm:px-3 sm:py-1 sm:text-[9px]",
              planClassName,
            )}
            style={planStyle}
          >
            {planLabel}
          </span>
          {user ? (
            <Auth0UserMenu user={user} />
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-cifra-border px-3 py-1.5 text-xs text-cifra-text transition-colors hover:border-cifra-teal/35 sm:px-3.5 sm:py-2 sm:text-[13px]"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="rounded-full bg-cifra-teal px-3.5 py-1.5 text-xs font-semibold text-cifra-bg transition-opacity hover:opacity-95 sm:px-4 sm:py-2 sm:text-[13px]"
              >
                Começar
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 lg:px-6">
        <div className="flex min-h-[min(100%,calc(100dvh-6.5rem))] w-full min-w-0 flex-1 flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-3 sm:min-h-[min(100%,calc(100dvh-7rem))] sm:p-4 md:p-5 lg:min-h-[min(100%,calc(100dvh-6.75rem))] lg:px-6 lg:py-6">
          <h1 className="sr-only">{title}</h1>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </div>
  );
}
