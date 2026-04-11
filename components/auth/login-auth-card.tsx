import Link from "next/link";
import { Apple, Music2 } from "lucide-react";

import { Auth0CredentialsForm } from "@/components/auth/auth0-credentials-form";
import { auth0LoginHref, getAuth0ConnectionEnv } from "@/lib/auth0-routes";
import { cn } from "@/lib/utils";

export type LoginAuthCardProps = {
  className?: string;
};

/**
 * Login via Auth0: SSO por connection e e-mail/senha na Universal Login.
 */
export function LoginAuthCard({ className }: LoginAuthCardProps) {
  const conn = getAuth0ConnectionEnv();

  return (
    <div
      className={cn(
        "w-full max-w-[460px] rounded-2xl border border-white/[0.07] bg-cifra-surface px-8 py-9 md:px-10",
        className
      )}
    >
      <div className="space-y-4">
        <div>
          <h1 className="font-serif text-[22px] font-normal leading-tight text-cifra-text">
            Entrar na sua conta
          </h1>
          <p className="mt-1 text-xs leading-snug text-cifra-muted">
            Google, Apple, Spotify ou e-mail.
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pt-1">
          <a
            href={auth0LoginHref({ connection: conn.google })}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/9 bg-white py-3 pl-3.5 pr-3.5 text-sm font-semibold text-[#1a1a2e] transition-opacity hover:opacity-95"
          >
            <span className="flex size-[22px] items-center justify-center rounded-[11px] bg-[#4285F4] font-[system-ui] text-[11px] font-bold text-white">
              G
            </span>
            Continuar com Google
          </a>
          <a
            href={auth0LoginHref({ connection: conn.apple })}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.07] bg-cifra-surface-2 py-3 pl-3.5 pr-3.5 text-sm font-semibold text-cifra-text transition-colors hover:border-white/15"
          >
            <Apple className="size-5 text-white" strokeWidth={1.5} />
            Continuar com Apple
          </a>
          <a
            href={auth0LoginHref({ connection: conn.spotify })}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#1DB954]/27 bg-cifra-surface-2 py-3 pl-3.5 pr-3.5 text-sm font-semibold text-cifra-text transition-colors hover:border-[#1DB954]/50"
          >
            <Music2 className="size-5 text-[#1DB954]" strokeWidth={1.75} />
            Continuar com Spotify
          </a>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <span className="h-px min-w-0 flex-1 bg-white/[0.07]" />
          <span className="shrink-0 font-mono text-[11px] tracking-wide text-cifra-muted">
            ou com e-mail
          </span>
          <span className="h-px min-w-0 flex-1 bg-white/[0.07]" />
        </div>

        <Auth0CredentialsForm mode="login" className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="font-mono text-[11px] tracking-wide text-cifra-muted">
              E-mail
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              className="w-full rounded-[10px] border border-white/[0.07] bg-cifra-surface-2 px-3.5 py-3 text-[15px] text-cifra-text placeholder:text-[#6a6a88] outline-none ring-cifra-teal/30 focus:border-cifra-teal focus:ring-2"
            />
            <p className="text-[11px] leading-snug text-cifra-muted">
              A palavra-passe é pedida na página segura da Auth0.
            </p>
          </div>
          <div className="flex justify-end">
            <a
              href={auth0LoginHref()}
              className="text-xs text-cifra-teal transition-colors hover:text-cifra-teal-hover"
            >
              Esqueci a senha
            </a>
          </div>
          <button
            type="submit"
            className="w-full rounded-[14px] bg-linear-to-br from-cifra-teal to-cifra-gold py-[15px] text-base font-bold text-cifra-bg transition-opacity hover:opacity-95"
          >
            Entrar
          </button>
        </Auth0CredentialsForm>

        <p className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-center text-[13px] text-cifra-muted">
          Não tem conta?
          <Link href="/cadastro" className="font-semibold text-cifra-teal hover:text-cifra-teal-hover">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
