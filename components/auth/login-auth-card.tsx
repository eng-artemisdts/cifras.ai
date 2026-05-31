import Link from "next/link";

import { AuthOauthProviderLinks } from "@/components/auth/auth-oauth-provider-links";
import { Auth0CredentialsForm } from "@/components/auth/auth0-credentials-form";
import { auth0LoginHref, getAuth0ConnectionEnv } from "@/lib/auth0-routes";
import { cn } from "@/lib/utils";

export type LoginAuthCardProps = {
  className?: string;
  /** Repassado a `/auth/login` após o utilizador escolher o método na nossa UI. */
  returnTo?: string;
};

/**
 * Login via Auth0: SSO por connection e e-mail/senha na Universal Login.
 */
export function LoginAuthCard({ className, returnTo }: LoginAuthCardProps) {
  const conn = getAuth0ConnectionEnv();
  const rt = returnTo ? { returnTo } : {};

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
            Google, Apple ou e-mail.
          </p>
        </div>

        <AuthOauthProviderLinks
          flow="login"
          hrefGoogle={auth0LoginHref({ connection: conn.google, ...rt })}
          hrefApple={auth0LoginHref({ connection: conn.apple, ...rt })}
        />

        <div className="flex items-center gap-3 pt-1">
          <span className="h-px min-w-0 flex-1 bg-white/[0.07]" />
          <span className="shrink-0 font-mono text-[11px] tracking-wide text-cifra-muted">
            ou com e-mail
          </span>
          <span className="h-px min-w-0 flex-1 bg-white/[0.07]" />
        </div>

        <Auth0CredentialsForm mode="login" className="flex flex-col gap-4" returnTo={returnTo}>
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
              A palavra-passe é pedida na página de login segura.
            </p>
          </div>
          <div className="flex justify-end">
            <a
              href={auth0LoginHref({ ...rt })}
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
