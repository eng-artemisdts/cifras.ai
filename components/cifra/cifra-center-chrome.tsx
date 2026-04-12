import Image from "next/image";
import Link from "next/link";

import { LibraryPageFooter } from "@/components/library/library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "@/components/library/library-top-nav";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

export type CifraCenterChromeProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  title: string;
  subtitle: string;
  durationLabel?: string;
  children: React.ReactNode;
  className?: string;
};

/**
 * Coluna central: doca superior, área principal (cifra) — alinhado a `sNLcK` / `NPISl`.
 */
export function CifraCenterChrome({
  navItems,
  user,
  title,
  subtitle,
  durationLabel,
  children,
  className,
}: CifraCenterChromeProps) {
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)}>
      <LibraryTopNav items={navItems} user={user} />

      <header className="flex w-full shrink-0 items-center justify-between border-b border-cifra-border px-4 py-3 sm:px-6 md:px-7 lg:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span
            className="shrink-0 rounded-full border border-[#F0B42944] px-3 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-cifra-gold"
            style={{ backgroundColor: "#F0B42918" }}
          >
            Free
          </span>
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative size-[26px] shrink-0 overflow-hidden rounded-md ring-1 ring-white/8">
              <Image src="/logo.svg" alt="" width={26} height={26} className="object-contain" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="text-cifra-teal">Biblioteca</span>
              <span className="text-cifra-text-muted">·</span>
              <span className="truncate text-cifra-text-muted">Faixa sincronizada</span>
            </div>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
          <Link
            href="/auth/login"
            className="rounded-full border border-cifra-border px-3.5 py-2 text-xs text-cifra-text transition-colors hover:border-cifra-teal/35"
          >
            Entrar
          </Link>
          <Link
            href="/biblioteca/importar"
            className="rounded-full bg-cifra-teal px-4 py-2 text-xs font-semibold text-cifra-bg transition-opacity hover:opacity-95"
          >
            Começar
          </Link>
        </div>
      </header>

      <div className="shrink-0 border-b border-cifra-border px-4 py-1.5 sm:px-6 md:px-7 lg:px-8">
        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#5c5c78]">Publicidade</p>
        <div className="mt-1 flex h-12 items-center rounded-lg border border-white/6 bg-[#12121f] px-4">
          <p className="text-[11px] text-[#6a6a88]">Banner discreto · mesma largura do conteúdo</p>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-4 sm:py-3 md:px-5 md:py-4 lg:px-6">
        <div className="flex min-h-[min(100%,calc(100dvh-13rem))] w-full min-w-0 flex-1 flex-col rounded-2xl border border-cifra-border bg-cifra-surface p-3 sm:min-h-[min(100%,calc(100dvh-13.5rem))] sm:p-4 md:p-5 lg:min-h-[min(100%,calc(100dvh-12rem))] lg:px-6 lg:py-6">
          <div className="shrink-0 border-b border-white/6 pb-3 sm:pb-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cifra-text-muted">
                  Pré-visualização
                </p>
                <h1 className="text-lg font-semibold tracking-tight text-cifra-text sm:text-xl md:text-2xl lg:text-[26px]">
                  {title}
                </h1>
                <p className="text-[11px] text-cifra-text-muted sm:text-xs md:text-sm">
                  {subtitle}
                  {durationLabel ? (
                    <span className="ml-1 font-mono text-[10px] text-cifra-muted"> · {durationLabel}</span>
                  ) : null}
                </p>
              </div>
              <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-cifra-teal sm:max-w-[14rem] sm:text-right sm:leading-snug md:text-[10px]">
                Prévia completa · letra e harmonia
              </p>
            </div>
          </div>

          <div className="mt-3 flex min-h-0 min-w-0 flex-1 flex-col border-t border-white/6 pt-3 sm:mt-4 sm:pt-4">
            <div className="min-h-0 min-w-0 flex-1">{children}</div>
          </div>
        </div>

        <footer className="mt-4 flex w-full min-w-0 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-cifra-border pt-3 text-[11px] text-cifra-text-muted sm:mt-5 sm:pt-4">
          <span>Privacidade · Termos · Suporte</span>
          <span className="font-mono text-[10px] text-[#5c5c78]">Plano Free · laboratório</span>
        </footer>

        <div className="mt-3 w-full min-w-0 shrink-0 pb-4 sm:mt-4 sm:pb-6">
          <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#5c5c78]">Publicidade</p>
          <div className="mt-1 flex h-11 items-center rounded-md border border-white/6 bg-[#0e0e16] px-3.5">
            <p className="text-[10px] text-[#6a6a88]">Faixa fina antes dos links legais · formato in-feed</p>
          </div>
        </div>
      </div>

      <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
    </div>
  );
}
