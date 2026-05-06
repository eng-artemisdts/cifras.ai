"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Music2, Unplug, XCircle } from "lucide-react";

import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

export type SpotifyAccountSectionProps = {
  returnPath: string;
  managementConfigured: boolean;
  /** Query `spotify` após redirect OAuth (`connected`, `connect_failed`, …). */
  spotifyQuery?: string | null;
  initialStatus: {
    connected: boolean;
    product: string | null;
    accountId: string | null;
    premium: boolean;
  };
};

type SpotifyStatus = SpotifyAccountSectionProps["initialStatus"];

async function fetchStatus(): Promise<SpotifyStatus> {
  const res = await fetch("/api/spotify/status", { credentials: "include" });
  if (!res.ok) {
    throw new Error("spotify_status_failed");
  }
  return (await res.json()) as SpotifyStatus;
}

function productLabel(product: string | null, premium: boolean): string {
  if (premium) return "Spotify Premium";
  if (product === "free") return "Spotify Free";
  if (product) return product;
  return "—";
}

export function SpotifyAccountSection({
  returnPath,
  managementConfigured,
  spotifyQuery: spotifyQueryProp,
  initialStatus,
}: SpotifyAccountSectionProps) {
  const [status, setStatus] = useState<SpotifyStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spotifyQuery = spotifyQueryProp?.trim() ?? "";

  const banner = useMemo(() => {
    if (spotifyQuery === "connected") {
      return { kind: "success" as const, text: "Spotify ligado com sucesso." };
    }
    if (spotifyQuery === "connect_failed") {
      return {
        kind: "error" as const,
        text: "Não foi possível concluir a ligação ao Spotify. Tente outra vez.",
      };
    }
    if (spotifyQuery === "invalid_state") {
      return {
        kind: "error" as const,
        text: "Pedido de ligação expirou ou é inválido. Inicie o fluxo de novo.",
      };
    }
    if (spotifyQuery === "missing_code") {
      return {
        kind: "error" as const,
        text: "Resposta do Spotify incompleta. Inicie a ligação outra vez.",
      };
    }
    return null;
  }, [spotifyQuery]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchStatus();
      setStatus(next);
    } catch {
      setError("Não foi possível atualizar o estado do Spotify.");
    } finally {
      setLoading(false);
    }
  }, []);

  const connectHref = `/api/spotify/connect?returnTo=${encodeURIComponent(returnPath)}`;

  async function onDisconnect() {
    if (!status.connected) return;
    if (!window.confirm("Desligar o Spotify desta conta cifra.ai? O playback integrado deixará de usar a sua conta.")) {
      return;
    }
    setDisconnecting(true);
    setError(null);
    try {
      trackAnalyticsEvent(GA_EVENTS.SPOTIFY_DISCONNECT_CLICK);
      const res = await fetch("/api/spotify/disconnect", { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "disconnect_failed");
      }
      setStatus({
        connected: false,
        product: null,
        accountId: null,
        premium: false,
      });
    } catch {
      setError("Não foi possível desligar o Spotify. Tente outra vez.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section
      className={cn(
        "rounded-2xl border border-cifra-border bg-cifra-surface-2/40 p-6 sm:p-8",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-100 motion-safe:duration-700 motion-safe:fill-mode-both",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-cifra-border bg-cifra-surface text-[#1DB954]">
            <Music2 className="size-6" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="font-serif text-xl text-white sm:text-2xl">Spotify</h2>
            <p className="mt-1 max-w-lg text-sm text-cifra-muted">
              Ligue a sua conta Spotify para ouvir faixas com o player integrado e controlar o playback
              (requer Spotify Premium para esta funcionalidade).
            </p>
          </div>
        </div>
      </div>

      {!managementConfigured ? (
        <p className="mt-6 rounded-xl border border-cifra-gold/35 bg-cifra-gold/10 px-4 py-3 text-sm text-cifra-text">
          A Management API do Auth0 não está configurada neste ambiente. A ligação ao Spotify depende de
          gravação em <code className="rounded bg-cifra-bg/60 px-1 font-mono text-xs">app_metadata</code>{" "}
          — configure as credenciais M2M como na área de assinatura.
        </p>
      ) : null}

      {banner ? (
        <div
          className={cn(
            "mt-6 flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
            banner.kind === "success"
              ? "border border-cifra-teal/35 bg-cifra-teal/10 text-cifra-text"
              : "border border-red-400/25 bg-red-500/10 text-cifra-text",
          )}
        >
          {banner.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cifra-teal" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-4 shrink-0 text-red-300" aria-hidden />
          )}
          <span>{banner.text}</span>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-cifra-text">
          {error}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 border-t border-cifra-border/80 pt-8 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-cifra-muted">Estado</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-cifra-text">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-cifra-muted" aria-hidden />
            ) : status.connected ? (
              <>
                <span className="inline-block size-2 rounded-full bg-cifra-teal shadow-[0_0_8px_rgba(15,210,193,0.5)]" />
                Ligado
              </>
            ) : (
              <>
                <span className="inline-block size-2 rounded-full bg-cifra-muted/80" />
                Não ligado
              </>
            )}
          </p>
          {status.connected ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-cifra-muted">
                Tipo de conta
              </p>
              <p className="mt-2 text-sm text-cifra-text">{productLabel(status.product, status.premium)}</p>
              {status.accountId ? (
                <>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-cifra-muted">
                    ID Spotify
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-cifra-muted">{status.accountId}</p>
                </>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="flex flex-col justify-end gap-3 sm:items-end">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading || !managementConfigured}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cifra-border bg-cifra-surface px-5 py-2.5 text-sm font-semibold text-cifra-text transition hover:border-cifra-teal/35 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Atualizar
            </button>
            {status.connected ? (
              <button
                type="button"
                onClick={() => void onDisconnect()}
                disabled={disconnecting || !managementConfigured}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-400/45 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disconnecting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Unplug className="size-4" aria-hidden />}
                Desligar Spotify
              </button>
            ) : (
              <Link
                href={connectHref}
                onClick={() => trackAnalyticsEvent(GA_EVENTS.SPOTIFY_CONNECT_CLICK, { surface: "conta_perfil" })}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-center text-sm font-semibold transition",
                  "bg-[#1DB954] text-black shadow-lg shadow-black/20 hover:brightness-110",
                  !managementConfigured && "pointer-events-none opacity-50",
                )}
                aria-disabled={!managementConfigured}
              >
                Ligar Spotify
              </Link>
            )}
            {status.connected ? (
              <Link
                href={connectHref}
                onClick={() => trackAnalyticsEvent(GA_EVENTS.SPOTIFY_CONNECT_CLICK, { surface: "conta_perfil_trocar" })}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl border border-cifra-teal/45 bg-cifra-teal/10 px-5 py-2.5 text-sm font-semibold text-cifra-teal transition hover:border-cifra-teal hover:bg-cifra-teal/18",
                  !managementConfigured && "pointer-events-none opacity-50",
                )}
                aria-disabled={!managementConfigured}
              >
                Trocar de conta
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
