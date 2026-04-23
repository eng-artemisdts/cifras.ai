"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BillingPlan } from "@/lib/billing/plan-types";
import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { buildPreviewChordAnchors } from "@/lib/cifra/preview-chord-anchors";
import {
  createInternalAudioAdapter,
  createSpotifyAdapter,
  createYoutubeAdapter,
  extractYoutubeVideoId,
  type PlaybackProvider,
} from "@/lib/engine/playback-adapters";
import { startCifraRuntimeV2 } from "@/lib/engine/start-cifra-runtime-v2";
import { cn } from "@/lib/utils";

const rightSidebarLayoutClassName =
  "mt-0 w-full border-t border-white/6 bg-cifra-surface lg:mt-0 lg:w-[300px] lg:shrink-0 lg:border-l lg:border-t-0";

function CifraRightSidebarLoadPlaceholder() {
  return (
    <aside
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col gap-4 px-4 py-4 sm:px-5 lg:h-full lg:w-[300px] lg:shrink-0 lg:px-5 lg:py-5",
        rightSidebarLayoutClassName,
      )}
      aria-label="Painel da faixa"
      aria-busy="true"
    >
      <div className="h-3 w-40 max-w-full animate-pulse rounded bg-white/10" />
      <div className="flex gap-2.5">
        <div className="size-[22px] shrink-0 animate-pulse rounded-full bg-white/10" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-10 w-full animate-pulse rounded bg-white/5" />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-white/6 bg-[#0c0c14] px-3 py-3">
        <div className="h-17 animate-pulse rounded-md bg-white/6" />
        <div className="h-10 animate-pulse rounded-md bg-white/6" />
      </div>
    </aside>
  );
}

const CifraRightSidebarClient = dynamic(
  () => import("./cifra-right-sidebar").then((m) => m.CifraRightSidebar),
  { ssr: false, loading: () => <CifraRightSidebarLoadPlaceholder /> },
);

export type CifraPocMountProps = {
  /** Chave estável (ex.: `trackId`) para remontar o runtime quando a faixa mudar. */
  trackKey: string;
  /** Chave pública para "Salvar na minha biblioteca". */
  libraryTrackKey?: string;
  payload: MusicAiDemoPayload;
  /** Título da faixa para copy no painel direito (frame `2Zui4`). */
  trackTitle?: string;
  /** Ex.: selector de versão da cifra (Radix/shadcn) no painel lateral. */
  variationSidebarAccessory?: ReactNode;
  billingPlan?: BillingPlan | null;
  className?: string;
};

/**
 * Monta a cifra com o mesmo motor DOM da POC (`mountCifraView`), destaque em reprodução e auto-rolagem.
 * Painel direito completo (Pencil `sideR`) com controlos de rolagem automática.
 */
export function CifraPocMount({
  trackKey,
  libraryTrackKey,
  payload,
  trackTitle,
  variationSidebarAccessory,
  billingPlan,
  className,
}: CifraPocMountProps) {
  const isProUser = billingPlan === "pro";
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [trackDraft, setTrackDraft] = useState(() => ({
    trackKey,
    originalTune: payload.original_tune ?? "",
    capoAt: Number.isFinite(payload.capo_at) ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at)))) : 0,
  }));
  const [rightSidebarMountGen, setRightSidebarMountGen] = useState(0);
  const [providerNotice, setProviderNotice] = useState<string>("");
  const [spotifyStatus, setSpotifyStatus] = useState<{
    loading: boolean;
    connected: boolean;
    premium: boolean;
  }>({
    loading: false,
    connected: false,
    premium: false,
  });
  const bumpRightSidebarMount = useCallback(() => {
    setRightSidebarMountGen((n) => n + 1);
  }, []);

  const payloadForRuntime = useMemo(() => {
    const previewAnchors = buildPreviewChordAnchors(
      payload.lyrics,
      payload.chords,
      payload.sections,
    );
    return {
      ...payload,
      slotIdsInLyricOrder: previewAnchors.slotIdsInLyricOrder,
      chordAnchorsBySlotId: previewAnchors.chordAnchorsBySlotId,
    };
  }, [payload]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const cifraRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const timeLabelRef = useRef<HTMLParagraphElement>(null);
  const sectionRef = useRef<HTMLParagraphElement>(null);
  const chordRef = useRef<HTMLParagraphElement>(null);
  const autoScrollBtnRef = useRef<HTMLButtonElement>(null);
  const autoScrollLeadRef = useRef<HTMLInputElement>(null);
  const autoScrollLeadValRef = useRef<HTMLSpanElement>(null);
  const autoScrollDurRef = useRef<HTMLInputElement>(null);
  const autoScrollDurValRef = useRef<HTMLSpanElement>(null);
  const scrollModeAutomaticRef = useRef<HTMLInputElement>(null);
  const scrollModeSmartRef = useRef<HTMLInputElement>(null);
  const youtubeHostRef = useRef<HTMLDivElement>(null);
  const spotifyHostRef = useRef<HTMLDivElement>(null);

  const spotifyTrackId = useMemo(() => payload.meta?.spotifyTrackId?.trim() ?? "", [payload.meta?.spotifyTrackId]);
  const youtubeVideoId = useMemo(() => {
    const raw = payload.meta?.youtubeVideoId?.trim() ?? payload.meta?.youtubeUrl?.trim() ?? "";
    return extractYoutubeVideoId(raw);
  }, [payload.meta?.youtubeVideoId, payload.meta?.youtubeUrl]);

  const availableProviders = useMemo<PlaybackProvider[]>(() => {
    const providers: PlaybackProvider[] = ["internal"];
    if (youtubeVideoId) providers.push("youtube");
    if (spotifyTrackId) providers.push("spotify");
    return providers;
  }, [spotifyTrackId, youtubeVideoId]);

  const defaultProvider = useMemo<PlaybackProvider>(() => {
    if (availableProviders.includes("spotify")) return "spotify";
    if (availableProviders.includes("youtube")) return "youtube";
    return "internal";
  }, [availableProviders]);
  const [providerChoice, setProviderChoice] = useState<{ trackKey: string; provider: PlaybackProvider } | null>(
    null,
  );
  const selectedProvider =
    providerChoice && providerChoice.trackKey === trackKey && availableProviders.includes(providerChoice.provider)
      ? providerChoice.provider
      : defaultProvider;
  const returnToForSpotifyConnect = useMemo(() => {
    const qs = searchParams?.toString() ?? "";
    return `${pathname || "/explorar"}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!spotifyTrackId) return;
    let cancelled = false;
    setSpotifyStatus((prev) => ({ ...prev, loading: true }));
    fetch("/api/spotify/status", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("spotify_status_failed");
        return (await res.json()) as { connected?: boolean; premium?: boolean };
      })
      .then((json) => {
        if (cancelled) return;
        setSpotifyStatus({
          loading: false,
          connected: json.connected === true,
          premium: json.premium === true,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSpotifyStatus({ loading: false, connected: false, premium: false });
      });
    return () => {
      cancelled = true;
    };
  }, [spotifyTrackId, trackKey]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const cifraContainer = cifraRef.current;
    const audioEl = audioRef.current;
    const playBtn = playBtnRef.current;
    const seek = seekRef.current;
    const timeLabel = timeLabelRef.current;
    const currentSectionEl = sectionRef.current;
    const currentChordEl = chordRef.current;
    if (
      !scrollRoot ||
      !cifraContainer ||
      !audioEl ||
      !playBtn ||
      !seek ||
      !timeLabel ||
      !currentSectionEl ||
      !currentChordEl
    ) {
      return;
    }

    let destroy: (() => void) | null = null;
    let cancelled = false;

    async function mountRuntime() {
      try {
        if (
          selectedProvider === "spotify" &&
          spotifyTrackId &&
          !spotifyStatus.loading &&
          (!spotifyStatus.connected || !spotifyStatus.premium)
        ) {
          throw new Error("spotify_account_not_ready");
        }
        const adapter =
          selectedProvider === "spotify" && spotifyHostRef.current && spotifyTrackId
            ? createSpotifyAdapter({ hostEl: spotifyHostRef.current, trackId: spotifyTrackId })
            : selectedProvider === "youtube" && youtubeHostRef.current && youtubeVideoId
              ? createYoutubeAdapter({ hostEl: youtubeHostRef.current, videoId: youtubeVideoId })
              : createInternalAudioAdapter({ audioEl, audioUrl: payload.meta?.audioUrl });

        if (cancelled) return;
        setProviderNotice("");
        destroy = startCifraRuntimeV2({
          payloadInput: payloadForRuntime as unknown as Record<string, unknown>,
          els: {
            scrollRoot,
            cifraContainer,
            playback: adapter,
            playBtn,
            seek,
            timeLabel,
            currentSectionEl,
            currentChordEl,
            autoScrollBtn: autoScrollBtnRef.current,
            autoScrollLeadEl: autoScrollLeadRef.current,
            autoScrollLeadValEl: autoScrollLeadValRef.current,
            autoScrollDurEl: autoScrollDurRef.current,
            autoScrollDurValEl: autoScrollDurValRef.current,
            scrollModeAutomaticEl: scrollModeAutomaticRef.current,
            scrollModeSmartEl: scrollModeSmartRef.current,
          },
        });
      } catch {
        if (cancelled) return;
        setProviderNotice(
          selectedProvider === "spotify" && (!spotifyStatus.connected || !spotifyStatus.premium)
            ? "Conecte uma conta Spotify Premium para reprodução completa."
            : "Não foi possível carregar este player. Voltámos para o player interno.",
        );
        const fallbackAdapter = createInternalAudioAdapter({ audioEl, audioUrl: payload.meta?.audioUrl });
        destroy = startCifraRuntimeV2({
          payloadInput: payloadForRuntime as unknown as Record<string, unknown>,
          els: {
            scrollRoot,
            cifraContainer,
            playback: fallbackAdapter,
            playBtn,
            seek,
            timeLabel,
            currentSectionEl,
            currentChordEl,
            autoScrollBtn: autoScrollBtnRef.current,
            autoScrollLeadEl: autoScrollLeadRef.current,
            autoScrollLeadValEl: autoScrollLeadValRef.current,
            autoScrollDurEl: autoScrollDurRef.current,
            autoScrollDurValEl: autoScrollDurValRef.current,
            scrollModeAutomaticEl: scrollModeAutomaticRef.current,
            scrollModeSmartEl: scrollModeSmartRef.current,
          },
        });
      }
    }

    void mountRuntime();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [
    trackKey,
    payloadForRuntime,
    rightSidebarMountGen,
    selectedProvider,
    spotifyTrackId,
    spotifyStatus.loading,
    spotifyStatus.connected,
    spotifyStatus.premium,
    youtubeVideoId,
    payload.meta?.audioUrl,
  ]);

  const effectiveOriginalTune =
    trackDraft.trackKey === trackKey ? trackDraft.originalTune : payload.original_tune ?? "";
  const effectiveCapoAt =
    trackDraft.trackKey === trackKey
      ? trackDraft.capoAt
      : Number.isFinite(payload.capo_at)
        ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at))))
        : 0;

  const titleFromPayload =
    typeof payload.meta?.name === "string" && payload.meta.name.trim()
      ? payload.meta.name.trim()
      : trackTitle;

  return (
    <div className={cn("flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2.5 sm:gap-3", className)}>
      <div
        id="cifra-transport"
        tabIndex={-1}
        className="cifra-transport-panel flex shrink-0 flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-[#0c0c16] px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5"
      >
        <audio ref={audioRef} className="hidden" preload="metadata" />
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {(["spotify", "youtube", "internal"] as PlaybackProvider[]).map((provider) => {
            const enabled = availableProviders.includes(provider);
            const active = selectedProvider === provider;
            const label = provider === "internal" ? "Interno" : provider === "youtube" ? "YouTube" : "Spotify";
            return (
              <button
                key={provider}
                type="button"
                disabled={!enabled}
                onClick={() => setProviderChoice({ trackKey, provider })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition",
                  active ? "bg-cifra-teal text-cifra-bg" : "text-cifra-muted hover:text-cifra-text",
                  !enabled && "cursor-not-allowed opacity-35",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          ref={playBtnRef}
          type="button"
          className="shrink-0 rounded-full bg-cifra-teal px-4 py-2 text-xs font-semibold text-cifra-bg shadow-[0_0_0_1px_rgba(15,210,193,0.25)] transition-[opacity,transform] hover:bg-cifra-teal-hover disabled:pointer-events-none disabled:opacity-35"
        >
          Reproduzir
        </button>
        <input
          ref={seekRef}
          type="range"
          min={0}
          max={1000}
          defaultValue={0}
          className="cifra-range h-3 min-w-[140px] flex-1"
        />
        <p
          ref={timeLabelRef}
          className="shrink-0 font-mono text-[11px] tabular-nums tracking-tight text-[#a8a8c0]"
        >
          0:00 / 0:00
        </p>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-2.5 sm:ml-auto">
          <p
            ref={sectionRef}
            className="max-w-[min(100%,200px)] truncate text-right text-[11px] font-medium text-cifra-text"
          >
            —
          </p>
          <p ref={chordRef} className="font-mono text-sm font-semibold tabular-nums text-cifra-teal">
            —
          </p>
        </div>
      </div>
      {providerNotice ? (
        <p className="rounded-lg border border-cifra-teal/25 bg-cifra-teal/10 px-3 py-2 text-[11px] text-cifra-teal">
          {providerNotice}
        </p>
      ) : null}
      {selectedProvider === "spotify" && spotifyTrackId && (!spotifyStatus.connected || !spotifyStatus.premium) ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0d0d18] px-3 py-2">
          <p className="text-[11px] text-cifra-muted">
            {!spotifyStatus.connected
              ? "Conecte sua conta Spotify para tocar a faixa completa."
              : "A conta Spotify conectada precisa ser Premium para reprodução completa."}
          </p>
          <Link
            href={`/api/spotify/connect?returnTo=${encodeURIComponent(returnToForSpotifyConnect)}`}
            className="rounded-full bg-cifra-teal px-3 py-1.5 text-[11px] font-semibold text-cifra-bg"
          >
            {spotifyStatus.loading ? "Verificando..." : "Conectar Spotify"}
          </Link>
        </div>
      ) : null}
      <div className="rounded-lg border border-white/6 bg-[#0d0d18] p-2">
        <div
          ref={spotifyHostRef}
          className={cn("min-h-[152px] w-full", selectedProvider === "spotify" ? "block" : "hidden")}
        />
        <div
          ref={youtubeHostRef}
          className={cn("aspect-video w-full", selectedProvider === "youtube" ? "block" : "hidden")}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/6 bg-[#12121f] lg:flex-row lg:items-stretch">
        <div
          ref={scrollRootRef}
          className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6"
        >
          <div id="cifra" ref={cifraRef} className="min-h-[min(12rem,30dvh)] w-full min-w-0" />
        </div>

        <CifraRightSidebarClient
          libraryTrackKey={libraryTrackKey}
          trackTitle={titleFromPayload}
          variationSlot={variationSidebarAccessory}
          originalTune={effectiveOriginalTune}
          onOriginalTuneChange={(value) =>
            setTrackDraft((prev) => ({
              trackKey,
              capoAt:
                prev.trackKey === trackKey
                  ? prev.capoAt
                  : Number.isFinite(payload.capo_at)
                    ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at))))
                    : 0,
              originalTune: value,
            }))
          }
          capoAt={effectiveCapoAt}
          onCapoAtChange={(n) =>
            setTrackDraft((prev) => ({
              trackKey,
              originalTune: prev.trackKey === trackKey ? prev.originalTune : payload.original_tune ?? "",
              capoAt: Math.min(24, Math.max(0, Math.round(n))),
            }))
          }
          isPrivate={payload.is_private === true}
          isProUser={isProUser}
          scrollModeAutomaticRef={scrollModeAutomaticRef}
          scrollModeSmartRef={scrollModeSmartRef}
          autoScrollBtnRef={autoScrollBtnRef}
          autoScrollLeadRef={autoScrollLeadRef}
          autoScrollLeadValRef={autoScrollLeadValRef}
          autoScrollDurRef={autoScrollDurRef}
          autoScrollDurValRef={autoScrollDurValRef}
          onMount={bumpRightSidebarMount}
          className={rightSidebarLayoutClassName}
        />
      </div>
    </div>
  );
}
