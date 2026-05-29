import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { Auth0UserMenu } from "@/components/auth/auth0-user-menu";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

export type LibraryTopNavUser = {
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

export type LibraryTopNavProps = {
  items: LibraryNavItem[];
  /** Quando definido, mostra o avatar em vez de Entrar/Começar. */
  user?: LibraryTopNavUser | null;
  /** Plano de billing (Auth0 + Stripe); tarjas Starter / Pro no header. */
  billingPlan?: BillingPlan | null;
  className?: string;
};

/**
 * Barra superior da área logada (logo + links + CTAs secundários).
 */
export function LibraryTopNav({ items, user, billingPlan, className }: LibraryTopNavProps) {
  const resolvedPlan = billingPlan ?? "free";
  const planLabel = resolvedPlan === "pro" ? "PRO" : resolvedPlan === "starter" ? "STARTER" : "FREE";
  const planClassName =
    resolvedPlan === "pro"
      ? "border-cifra-gold/55 bg-cifra-gold/12 text-cifra-gold"
      : resolvedPlan === "starter"
        ? "border-cifra-teal/45 bg-cifra-teal/12 text-cifra-teal"
        : "border-[#F0B42944] text-cifra-gold";
  const planStyle = resolvedPlan === "free" ? { backgroundColor: "#F0B42918" } : undefined;

  const navLinkClass = (current?: boolean) =>
    cn(
      "block rounded-lg px-3 py-2 text-[13px] transition-colors",
      current
        ? "bg-cifra-teal/10 font-semibold text-cifra-teal"
        : "font-normal text-cifra-muted hover:bg-white/[0.04] hover:text-cifra-text",
    );

  const desktopNavLinkClass = (current?: boolean) =>
    cn(
      "shrink-0 transition-colors",
      current
        ? "font-semibold text-cifra-teal"
        : "font-normal text-cifra-muted hover:text-cifra-text",
    );

  return (
    <header
      className={cn(
        "flex w-full items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-6 md:gap-6 md:px-8",
        className,
      )}
    >
      <div className="flex min-w-0 items-center">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="relative block h-[30px] w-[78px] overflow-hidden">
            <Image
              src="/logo.svg"
              alt="cifra.ai"
              width={828}
              height={320}
              className="h-full w-full object-contain object-left"
              unoptimized
            />
          </span>
          <span className="inline-flex h-5 self-center items-center rounded-md border border-cifra-teal/45 bg-cifra-teal/12 px-2 font-mono text-[9px] font-bold leading-none tracking-widest text-cifra-teal">
            BETA
          </span>
        </Link>
      </div>

      <nav className="hidden min-w-0 items-center justify-center gap-5 px-3 text-[13px] md:flex">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={desktopNavLinkClass(item.current)}>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex shrink-0 items-center justify-end gap-2 md:gap-3">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-md border px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em]",
            planClassName,
          )}
          style={planStyle}
          title={`Plano ${planLabel} ativo`}
        >
          {planLabel}
        </span>
        {user ? <Auth0UserMenu user={user} /> : (
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/login"
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-cifra-text transition-colors hover:bg-white/5"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-lg bg-cifra-teal px-4 py-2 text-[13px] font-semibold text-cifra-bg transition-colors hover:bg-cifra-teal-hover"
            >
              Começar
            </Link>
          </div>
        )}

        <details className="group relative md:hidden">
          <summary
            className="list-none [&::-webkit-details-marker]:hidden"
            aria-label="Abrir menu de navegação"
          >
            <span className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-white/[0.08] text-cifra-text transition-colors hover:border-cifra-teal/35 hover:bg-white/[0.04]">
              <Menu className="size-5 group-open:hidden" aria-hidden />
              <X className="hidden size-5 group-open:block" aria-hidden />
            </span>
          </summary>
          <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-white/[0.08] bg-cifra-surface-2 p-3 shadow-xl shadow-black/40">
            <nav className="flex flex-col gap-0.5">
              {items.map((item) => (
                <Link key={item.href} href={item.href} className={navLinkClass(item.current)}>
                  {item.label}
                </Link>
              ))}
            </nav>
            {!user ? (
              <>
                <hr className="my-2 border-white/[0.06]" />
                <Link href="/login" className={navLinkClass()}>
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="mt-1 block rounded-lg bg-cifra-teal px-3 py-2 text-center text-[13px] font-semibold text-cifra-bg transition-colors hover:bg-cifra-teal-hover"
                >
                  Começar
                </Link>
              </>
            ) : null}
          </div>
        </details>
      </div>
    </header>
  );
}
