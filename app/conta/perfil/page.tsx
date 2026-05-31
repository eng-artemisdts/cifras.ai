import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Shield, Sparkles, UserRound } from "lucide-react";

import { SpotifyAccountSection } from "@/components/conta/spotify-account-section";
import { getAuth0SessionCached } from "@/lib/auth0";
import { appLoginHref } from "@/lib/auth0-routes";
import { isAuth0Configured } from "@/lib/auth0-env";
import { isAuth0ManagementConfigured } from "@/lib/billing/auth0-management";
import { spotifyStatusForUser } from "@/lib/spotify-auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Definições da conta e ligação ao Spotify no cifra.ai.",
};

type PerfilPageProps = {
  searchParams?: Promise<{ spotify?: string | string[] }>;
};

export default async function PerfilPage({ searchParams }: PerfilPageProps) {
  if (!isAuth0Configured()) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-cifra-bg px-6 py-20">
        <div className="max-w-md rounded-2xl border border-cifra-border bg-cifra-surface px-8 py-10 text-center">
          <Shield className="mx-auto size-10 text-cifra-muted" strokeWidth={1.25} aria-hidden />
          <p className="mt-4 text-sm text-cifra-muted">
            O serviço de contas não está disponível neste ambiente.
          </p>
        </div>
      </div>
    );
  }

  const session = await getAuth0SessionCached();
  if (!session?.user) {
    // Evita salto direto para `/auth/login` quando há leitura transitória de sessão no SSR.
    // Primeiro vai para a página de login da app, que depois inicia o fluxo Auth0 de forma explícita.
    redirect(appLoginHref("/conta/perfil"));
  }

  const sub = session.user.sub?.trim();
  const initialSpotifyStatus =
    sub != null && sub.length > 0
      ? await spotifyStatusForUser(sub)
      : {
        connected: false,
        product: null,
        accountId: null,
        premium: false,
      };

  const sp = searchParams ? await searchParams : {};
  const spotifyRaw =
    typeof sp.spotify === "string" ? sp.spotify : Array.isArray(sp.spotify) ? sp.spotify[0] : undefined;
  const spotifyQuery = spotifyRaw?.trim() ?? null;

  const managementConfigured = isAuth0ManagementConfigured();

  return (
    <div className="relative min-h-dvh overflow-hidden bg-cifra-bg text-cifra-text">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-cifra-teal/6 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-[360px] w-[360px] rounded-full bg-cifra-gold/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-px w-[min(100%,720px)] -translate-x-1/2 bg-linear-to-r from-transparent via-cifra-border to-transparent opacity-80"
        aria-hidden
      />

      <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-10 sm:px-8 sm:pt-14">
        <Link
          href="/biblioteca"
          className="group inline-flex items-center gap-2 text-sm font-medium text-cifra-muted transition-colors hover:text-cifra-teal"
        >
          <ArrowLeft
            className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
            strokeWidth={2}
            aria-hidden
          />
          Voltar à biblioteca
        </Link>

        <header className="mt-10 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both">
          <span className="inline-flex items-center gap-2 rounded-full border border-cifra-border bg-cifra-surface-2 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cifra-muted">
            <Sparkles className="size-3.5 text-cifra-teal" strokeWidth={2} aria-hidden />
            Conta
          </span>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-4xl tracking-tight text-white sm:text-5xl">Perfil</h1>
          </div>
        </header>

        <div className="mt-10">
          <section
            className={cn(
              "mb-8 rounded-2xl border border-cifra-border bg-cifra-surface-2/30 p-6 sm:p-8",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:fill-mode-both",
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cifra-border bg-cifra-surface text-cifra-teal">
                <UserRound className="size-6" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="font-serif text-xl text-white sm:text-2xl">Conta cifra.ai</h2>
                <p className="mt-1 text-sm text-cifra-muted">
                  Nome e e-mail vêm da sua conta de login. Para alterar palavra-passe ou e-mail,
                  use{" "}
                  <Link href="/auth/profile" className="text-cifra-teal underline-offset-2 hover:underline">
                    definições da conta
                  </Link>
                  .
                </p>
                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-cifra-muted">Nome</dt>
                    <dd className="mt-1 text-cifra-text">{session.user.name?.trim() || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-cifra-muted">E-mail</dt>
                    <dd className="mt-1 break-all text-cifra-text">{session.user.email?.trim() || "—"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <SpotifyAccountSection
            returnPath="/conta/perfil"
            managementConfigured={managementConfigured}
            spotifyQuery={spotifyQuery}
            initialStatus={initialSpotifyStatus}
          />
        </div>
      </div>
    </div>
  );
}
