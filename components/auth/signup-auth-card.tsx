import Link from "next/link";
import { Apple, Music2 } from "lucide-react";

import { Auth0CredentialsForm } from "@/components/auth/auth0-credentials-form";
import { auth0LoginHref, getAuth0ConnectionEnv } from "@/lib/auth0-routes";
import { cn } from "@/lib/utils";

export type SignupAuthCardProps = {
  className?: string;
};

const inputClass =
  "w-full rounded-[10px] border border-white/[0.07] bg-cifra-surface-2 px-3 py-2.5 text-[15px] text-cifra-text placeholder:text-[#6a6a88] outline-none ring-cifra-teal/30 focus:border-cifra-teal focus:ring-2";

const labelClass =
  "font-mono text-[10px] font-normal uppercase tracking-wide text-cifra-muted";

/**
 * Cadastro via Auth0 (SSO ou Universal Login com screen_hint=signup).
 */
export function SignupAuthCard({ className }: SignupAuthCardProps) {
  const conn = getAuth0ConnectionEnv();

  return (
    <div
      className={cn(
        "w-full max-w-[460px] rounded-2xl border border-white/[0.07] bg-cifra-surface px-7 py-7 md:px-9 md:py-8",
        className
      )}
    >
      <div className="space-y-3.5">
        <div>
          <h1 className="font-serif text-[22px] font-normal leading-tight text-cifra-text">
            Criar conta
          </h1>
          <p className="mt-1 text-xs leading-snug text-cifra-muted">
            OAuth ou formulário completo.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-0.5">
          <a
            href={auth0LoginHref({ connection: conn.google, screenHint: "signup" })}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/9 bg-white py-2.5 pl-3 pr-3 text-sm font-semibold text-[#1a1a2e] transition-opacity hover:opacity-95"
          >
            <span className="flex size-[22px] items-center justify-center rounded-[11px] bg-[#4285F4] font-[system-ui] text-[11px] font-bold text-white">
              G
            </span>
            Continuar com Google
          </a>
          <a
            href={auth0LoginHref({ connection: conn.apple, screenHint: "signup" })}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.07] bg-cifra-surface-2 py-2.5 pl-3 pr-3 text-sm font-semibold text-cifra-text transition-colors hover:border-white/15"
          >
            <Apple className="size-5 text-white" strokeWidth={1.5} />
            Continuar com Apple
          </a>
          <a
            href={auth0LoginHref({ connection: conn.spotify, screenHint: "signup" })}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#1DB954]/27 bg-cifra-surface-2 py-2.5 pl-3 pr-3 text-sm font-semibold text-cifra-text transition-colors hover:border-[#1DB954]/50"
          >
            <Music2 className="size-5 text-[#1DB954]" strokeWidth={1.75} />
            Continuar com Spotify
          </a>
        </div>

        <div className="flex items-center gap-2.5 pt-0.5">
          <span className="h-px min-w-0 flex-1 bg-white/[0.07]" />
          <span className="shrink-0 font-mono text-[10px] tracking-wide text-cifra-muted">
            ou preencha o formulário
          </span>
          <span className="h-px min-w-0 flex-1 bg-white/[0.07]" />
        </div>

        <Auth0CredentialsForm mode="signup" className="flex flex-col gap-3.5">
          <div className="space-y-1.5">
            <label htmlFor="signup-name" className={labelClass}>
              Nome completo
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Seu nome"
              className={inputClass}
            />
            <p className="text-[10px] leading-snug text-cifra-muted">
              O nome definitivo pode ser pedido na página de cadastro da Auth0.
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="signup-email" className={labelClass}>
              E-mail
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="voce@empresa.com"
              className={inputClass}
            />
            <p className="text-[10px] leading-snug text-cifra-muted">
              Palavra-passe e confirmação são definidas na Auth0.
            </p>
          </div>

          <label className="flex cursor-pointer gap-2 pt-0.5">
            <input
              name="terms"
              type="checkbox"
              required
              className="mt-0.5 size-4 shrink-0 rounded border border-cifra-teal bg-cifra-surface-2 text-cifra-teal accent-cifra-teal"
            />
            <span className="text-[11px] leading-snug text-cifra-muted">
              Aceito os{" "}
              <Link href="/termos" className="text-cifra-teal underline-offset-2 hover:underline">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="text-cifra-teal underline-offset-2 hover:underline">
                Política de Privacidade
              </Link>{" "}
              da Artemis (cifra.ai).
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-linear-to-br from-cifra-teal to-cifra-gold py-3.5 text-[15px] font-bold text-cifra-bg transition-opacity hover:opacity-95"
          >
            Criar conta
          </button>
        </Auth0CredentialsForm>

        <p className="flex flex-wrap items-center justify-center gap-1.5 pt-1 text-center text-xs text-cifra-muted">
          Já tem conta?
          <Link href="/login" className="font-semibold text-cifra-teal hover:text-cifra-teal-hover">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
