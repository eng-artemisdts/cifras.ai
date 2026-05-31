"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";

import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";

function landingCta(ctaId: string) {
  trackAnalyticsEvent(GA_EVENTS.LANDING_CTA_CLICK, { cta_id: ctaId });
}

export type LandingNavLink = { href: string; label: string };

type GuestNavProps = {
  navLinks: LandingNavLink[];
};

/** Header marketing: Entrar, demo e cadastro (métricas de funil). */
export function LandingGuestNav({ navLinks }: GuestNavProps) {
  return (
    <>
      <div className="hidden items-center justify-self-end gap-2 sm:flex sm:gap-3">
        <Link
          href="/login"
          className="rounded-lg border border-cifra-border px-4 py-2 text-sm font-medium text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/40 hover:text-cifra-teal active:scale-[0.98] motion-reduce:active:scale-100"
          onClick={() => landingCta("header_login")}
        >
          Entrar
        </Link>
        <Link
          href="/explorar"
          className="rounded-lg border border-cifra-border px-4 py-2 text-sm font-medium text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/40 hover:text-cifra-teal active:scale-[0.98] motion-reduce:active:scale-100"
          onClick={() => landingCta("header_explore")}
        >
          Explorar
        </Link>
        <Link
          href="/cadastro"
          className="rounded-lg bg-cifra-teal px-4 py-2 text-sm font-semibold text-cifra-bg shadow-sm shadow-cifra-teal/20 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-md hover:shadow-cifra-teal/25 active:scale-[0.98] motion-reduce:hover:shadow-sm motion-reduce:active:scale-100"
          onClick={() => landingCta("header_signup")}
        >
          Começar agora
        </Link>
      </div>

      <details className="group relative justify-self-end sm:hidden">
        <summary className="list-none [&::-webkit-details-marker]:hidden">
          <span className="flex size-10 cursor-pointer items-center justify-center rounded-lg border border-cifra-border text-cifra-text transition-colors duration-200 hover:border-cifra-teal/35 hover:bg-cifra-surface">
            <Menu className="size-5 group-open:hidden" />
            <X className="hidden size-5 group-open:block" />
          </span>
        </summary>
        <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-cifra-border bg-cifra-surface-2 p-3 shadow-xl">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block rounded-lg px-3 py-2 text-sm text-cifra-muted transition-colors duration-150 hover:bg-cifra-surface hover:text-cifra-text"
            >
              {l.label}
            </a>
          ))}
          <hr className="my-2 border-cifra-border" />
          <Link
            href="/login"
            className="block rounded-lg px-3 py-2 text-sm text-cifra-text transition-colors duration-150 hover:bg-cifra-surface"
            onClick={() => landingCta("header_login_mobile")}
          >
            Entrar
          </Link>
          <Link
            href="/explorar"
            className="block rounded-lg px-3 py-2 text-sm text-cifra-text transition-colors duration-150 hover:bg-cifra-surface"
            onClick={() => landingCta("header_explore_mobile")}
          >
            Explorar
          </Link>
          <Link
            href="/cadastro"
            className="mt-1 block rounded-lg bg-cifra-teal px-3 py-2 text-center text-sm font-semibold text-cifra-bg transition-all duration-200 hover:bg-cifra-teal-hover active:scale-[0.98]"
            onClick={() => landingCta("header_signup_mobile")}
          >
            Começar agora
          </Link>
        </div>
      </details>
    </>
  );
}

/** Formulário hero + links (mantém copy no servidor na `LandingPage`). */
export function LandingHeroActions() {
  return (
    <>
      <form
        className="mx-auto mt-10 flex max-w-xl flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-5 motion-safe:delay-300 motion-safe:duration-700 motion-safe:fill-mode-both motion-safe:ease-out sm:flex-row sm:items-stretch"
        action="#"
        onSubmit={(e) => {
          e.preventDefault();
          trackAnalyticsEvent(GA_EVENTS.LANDING_EARLY_ACCESS_SUBMIT);
        }}
      >
        <label htmlFor="email-hero" className="sr-only">
          E-mail
        </label>
        <input
          id="email-hero"
          name="email"
          type="email"
          required
          placeholder="seu@email.com"
          className="h-12 flex-1 rounded-lg border border-cifra-border bg-cifra-surface px-4 text-sm text-cifra-text placeholder:text-cifra-muted outline-none ring-cifra-teal/40 transition-[border-color,box-shadow] duration-200 focus:border-cifra-teal focus:ring-2"
        />
        <button
          type="submit"
          className="h-12 shrink-0 rounded-lg bg-cifra-teal px-6 text-sm font-semibold text-cifra-bg shadow-md shadow-cifra-teal/20 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-lg hover:shadow-cifra-teal/30 active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Entrar na comunidade
        </button>
      </form>
      <a
        href="mailto:ola@cifra.ai"
        className="mt-4 inline-block text-sm font-medium text-cifra-teal underline-offset-4 transition-colors duration-200 hover:text-cifra-teal-hover hover:underline"
        onClick={() => landingCta("hero_contact_mail")}
      >
        Tem dúvidas? Escreva-nos
      </a>
      <p className="mt-6 text-sm text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:delay-500 motion-safe:duration-500 motion-safe:fill-mode-both">
        Prefere acesso direto?{" "}
        <Link
          href="/cadastro"
          className="font-medium text-cifra-teal underline-offset-4 transition-colors duration-200 hover:text-cifra-teal-hover hover:underline"
          onClick={() => landingCta("hero_signup_inline")}
        >
          Criar conta
        </Link>
        <span className="text-cifra-muted"> · </span>
        <Link
          href="/login"
          className="font-medium text-cifra-teal underline-offset-4 transition-colors duration-200 hover:text-cifra-teal-hover hover:underline"
          onClick={() => landingCta("hero_login_inline")}
        >
          Entrar
        </Link>
      </p>
    </>
  );
}

/** Plano Free → cadastro (landing planos). */
export function LandingPlanFreeSignupLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href="/cadastro" className={className} onClick={() => landingCta("plan_card_free_signup")}>
      {children}
    </Link>
  );
}
