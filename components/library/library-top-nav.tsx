import Image from "next/image";
import Link from "next/link";

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
  const showStarter = billingPlan === "starter";
  const showPro = billingPlan === "pro";

  return (
    <header
      className={cn(
        "flex w-full items-center justify-between gap-6 border-b border-white/[0.07] px-6 py-4 md:px-8",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="relative block size-[30px] overflow-hidden rounded-md">
            <Image
              src="/logo.svg"
              alt="cifra.ai"
              width={828}
              height={220}
              className="h-full w-full object-contain object-left"
              unoptimized
            />
          </span>
        </Link>
        <nav
          className="flex min-w-0 items-center gap-4 overflow-x-auto text-[13px] max-md:[-ms-overflow-style:none] max-md:[scrollbar-width:none] md:gap-5 max-md:[&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 transition-colors",
                item.current
                  ? "font-semibold text-cifra-teal"
                  : "font-normal text-cifra-muted hover:text-cifra-text"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2.5 md:gap-3">
        {showStarter ? (
          <span
            className="inline-flex shrink-0 items-center rounded-md border border-cifra-teal/45 bg-cifra-teal/12 px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em] text-cifra-teal"
            title="Plano Starter ativo"
          >
            STARTER
          </span>
        ) : null}
        {showPro ? (
          <span
            className="inline-flex shrink-0 items-center rounded-md border border-cifra-gold/55 bg-cifra-gold/12 px-2 py-1 font-mono text-[9px] font-bold tracking-[0.12em] text-cifra-gold"
            title="Plano Pro ativo"
          >
            PRO
          </span>
        ) : null}
        {user ? <Auth0UserMenu user={user} /> : (
          <>
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
          </>
        )}
      </div>
    </header>
  );
}
