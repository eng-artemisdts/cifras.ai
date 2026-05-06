"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BillingPlan } from "@/lib/billing/plan-types";
import { GA_EVENTS } from "@/lib/analytics/events";
import { trackAnalyticsEvent } from "@/lib/analytics/track";
import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { buildPreviewChordAnchors } from "@/lib/cifra/preview-chord-anchors";
import {
  createInternalAudioAdapter,
  createSpotifyAdapter,
  createYoutubeMediaElementAdapter,
  extractYoutubeVideoId,
  type PlaybackProvider,
} from "@/lib/engine/playback-adapters";
import { startCifraRuntimeV2 } from "@/lib/engine/start-cifra-runtime-v2";
import { cn } from "@/lib/utils";
import { transposeTuneLabel } from "@/lib/cifra/chord-transpose";

const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

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
  const AUTO_SCROLL_BAR_POS_LS_KEY = "cifra-ai:auto-scroll-bar-pos";
  function clampAutoScrollBarPos(left: number, top: number) {
    if (typeof window === "undefined") return { left, top };
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - margin);
    const maxTop = Math.max(margin, window.innerHeight - margin);
    return {
      left: Math.min(maxLeft, Math.max(margin, left)),
      top: Math.min(maxTop, Math.max(margin, top)),
    };
  }

  function durationToSpeed(durationMs: number): number {
    const clamped = Math.max(200, Math.min(1200, Math.round(durationMs)));
    return Math.max(0, Math.min(100, Math.round(((1200 - clamped) / 1000) * 100)));
  }
  function speedToDuration(speed: number): number {
    const s = Math.max(0, Math.min(100, Math.round(speed)));
    return Math.max(200, Math.min(1200, Math.round(1200 - (s / 100) * 1000)));
  }

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
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [autoScrollChrome, setAutoScrollChrome] = useState<{ enabled: boolean; smartScroll: boolean }>({
    enabled: false,
    smartScroll: false,
  });
  const isAutoScrollEnabled = autoScrollChrome.enabled;
  const showAutoScrollFloatingBar = autoScrollChrome.enabled && !autoScrollChrome.smartScroll;
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(75);
  const [autoScrollBarPos, setAutoScrollBarPos] = useState<{ left: number; top: number } | null>(null);
  const [spotifyStatus, setSpotifyStatus] = useState<{
    loading: boolean;
    connected: boolean;
    premium: boolean;
  }>({
    loading: Boolean(payload.meta?.spotifyTrackId?.trim()),
    connected: false,
    premium: false,
  });
  const [spotifyOembed, setSpotifyOembed] = useState<{ thumbnail_url?: string; title?: string } | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const bumpRightSidebarMount = useCallback(() => {
    setRightSidebarMountGen((n) => n + 1);
  }, []);
  const toggleMobileSidebar = useCallback((nextOpen: boolean) => {
    const playBtnEl = playBtnRef.current;
    const wasPlaying = playBtnEl?.textContent?.toLowerCase().includes("pausa") ?? false;
    setIsMobileSidebarOpen(nextOpen);
    if (!wasPlaying) return;
    window.setTimeout(() => {
      const currentPlayBtn = playBtnRef.current;
      const isStillPlaying = currentPlayBtn?.textContent?.toLowerCase().includes("pausa") ?? false;
      if (!isStillPlaying) currentPlayBtn?.click();
    }, 0);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`cifra-ai:transpose-semitones:${trackKey}`);
      const n = raw == null ? 0 : Number(raw);
      setTransposeSemitones(Number.isFinite(n) ? Math.max(-11, Math.min(11, Math.trunc(n))) : 0);
    } catch {
      setTransposeSemitones(0);
    }
  }, [trackKey]);

  useEffect(() => {
    try {
      localStorage.setItem(`cifra-ai:transpose-semitones:${trackKey}`, String(transposeSemitones));
    } catch {
      // ignore
    }
  }, [trackKey, transposeSemitones]);

  const effectiveOriginalTune =
    trackDraft.trackKey === trackKey ? trackDraft.originalTune : payload.original_tune ?? "";
  const originalCapoAt = Number.isFinite(payload.capo_at)
    ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at))))
    : 0;
  const effectiveCapoAt =
    trackDraft.trackKey === trackKey ? trackDraft.capoAt : originalCapoAt;
  const capoDeltaSemitones = effectiveCapoAt - originalCapoAt;
  /** Regra do capotraste: mudar o capo recalcula shapes mantendo o mesmo tom da música. */
  const runtimeTransposeSemitones = transposeSemitones - capoDeltaSemitones;

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

  const cifraViewTrackedForKey = useRef<string | null>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const cifraRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const playBtnRef = useRef<HTMLButtonElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const timeLabelRef = useRef<HTMLParagraphElement>(null);
  const sectionRef = useRef<HTMLParagraphElement>(null);
  const chordRef = useRef<HTMLParagraphElement>(null);
  const chordDiagramRef = useRef<HTMLDivElement>(null);
  const autoScrollBtnRef = useRef<HTMLButtonElement>(null);
  const autoScrollLeadRef = useRef<HTMLInputElement>(null);
  const autoScrollLeadValRef = useRef<HTMLSpanElement>(null);
  const autoScrollDurRef = useRef<HTMLInputElement>(null);
  const autoScrollDurValRef = useRef<HTMLSpanElement>(null);
  const showFloatingChordRef = useRef<HTMLInputElement>(null);
  const showCurrentChordDiagramRef = useRef<HTMLInputElement>(null);
  const userScrollIntentHandlerRef = useRef<((source?: "user" | "scroll") => void) | null>(null);
  const autoScrollBarDragRef = useRef<{
    dragging: boolean;
    offsetX: number;
    offsetY: number;
  }>({ dragging: false, offsetX: 0, offsetY: 0 });
  const scrollModeAutomaticRef = useRef<HTMLInputElement>(null);
  const scrollModeSmartRef = useRef<HTMLInputElement>(null);
  const spotifyEmbedIframeRef = useRef<HTMLIFrameElement>(null);
  const youtubeMediaRef = useRef<HTMLVideoElement | null>(null);
  const runtimeTransposeLiveRef = useRef(runtimeTransposeSemitones);
  runtimeTransposeLiveRef.current = runtimeTransposeSemitones;
  const runtimeTransposeRefreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    function onAutoScrollState(ev: Event) {
      const custom = ev as CustomEvent<{ enabled?: boolean; smartScroll?: boolean }>;
      setAutoScrollChrome({
        enabled: custom.detail?.enabled === true,
        smartScroll: custom.detail?.smartScroll === true,
      });
    }
    window.addEventListener("cifra:auto-scroll-state", onAutoScrollState as EventListener);
    return () => {
      window.removeEventListener("cifra:auto-scroll-state", onAutoScrollState as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isAutoScrollEnabled) return;
    const durationEl = autoScrollDurRef.current;
    if (!durationEl) return;
    setAutoScrollSpeed(durationToSpeed(Number(durationEl.value)));
  }, [isAutoScrollEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(AUTO_SCROLL_BAR_POS_LS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { left?: number; top?: number };
        if (typeof parsed.left === "number" && typeof parsed.top === "number") {
          setAutoScrollBarPos(clampAutoScrollBarPos(parsed.left, parsed.top));
          return;
        }
      } catch {
        // ignore
      }
    }
    // Posição inicial: centro horizontal e um pouco mais abaixo.
    setAutoScrollBarPos({ left: window.innerWidth / 2, top: window.innerHeight * 0.86 });
  }, []);

  useEffect(() => {
    if (!autoScrollBarPos || typeof window === "undefined") return;
    window.localStorage.setItem(AUTO_SCROLL_BAR_POS_LS_KEY, JSON.stringify(autoScrollBarPos));
  }, [autoScrollBarPos]);

  useEffect(() => {
    function onPointerMove(ev: PointerEvent) {
      const drag = autoScrollBarDragRef.current;
      if (!drag.dragging) return;
      const next = clampAutoScrollBarPos(ev.clientX - drag.offsetX, ev.clientY - drag.offsetY);
      setAutoScrollBarPos(next);
    }
    function onPointerUp() {
      autoScrollBarDragRef.current.dragging = false;
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

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
  const hydratedProvider: PlaybackProvider = isClientMounted ? selectedProvider : "internal";

  const selectPlaybackProvider = useCallback(
    (provider: PlaybackProvider) => {
      trackAnalyticsEvent(GA_EVENTS.PLAYBACK_PROVIDER_SELECT, { provider });
      setProviderChoice({ trackKey, provider });
    },
    [trackKey],
  );

  useEffect(() => {
    if (cifraViewTrackedForKey.current === trackKey) return;
    cifraViewTrackedForKey.current = trackKey;
    trackAnalyticsEvent(GA_EVENTS.CIFRA_VIEW, {
      sheet_mode: pathname?.includes("/edit") ? "edit" : "view",
    });
  }, [pathname, trackKey]);
  const spotifyReadyForPlayback =
    Boolean(spotifyTrackId) && !spotifyStatus.loading && spotifyStatus.connected && spotifyStatus.premium;
  /** Com Spotify Premium ativo, não mostramos o modo interno na UI (evita barra duplicada). */
  const hideInternalInTransportUi = selectedProvider === "spotify" && spotifyReadyForPlayback;
  const transportProviderTabs = useMemo(() => {
    if (!hideInternalInTransportUi) return availableProviders;
    return availableProviders.filter((p) => p !== "internal");
  }, [availableProviders, hideInternalInTransportUi]);
  const hideTransportChrome = hideInternalInTransportUi;
  const returnToForSpotifyConnect = useMemo(() => {
    const qs = searchParams?.toString() ?? "";
    return `${pathname || "/explorar"}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

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

  const spotifyDurationHintSec = useMemo(() => {
    const d = payload.meta?.duration_seconds;
    return typeof d === "number" && Number.isFinite(d) && d > 0 ? d : undefined;
  }, [payload.meta?.duration_seconds]);

  useEffect(() => {
    if (!isClientMounted || !spotifyTrackId) return;
    let cancelled = false;
    setSpotifyOembed(null);
    const trackUrl = `https://open.spotify.com/track/${encodeURIComponent(spotifyTrackId)}`;
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`;
    void fetch(oembedUrl)
      .then((res) => (res.ok ? (res.json() as Promise<{ thumbnail_url?: string; title?: string }>) : null))
      .then((json) => {
        if (cancelled || !json) return;
        setSpotifyOembed({
          thumbnail_url: typeof json.thumbnail_url === "string" ? json.thumbnail_url : undefined,
          title: typeof json.title === "string" ? json.title : undefined,
        });
      })
      .catch(() => {
        if (!cancelled) setSpotifyOembed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isClientMounted, spotifyTrackId]);

  /** Tom/capo: actualiza só o DOM da cifra; não destrói o iframe do Spotify (`iframeController.destroy`). */
  useEffect(() => {
    runtimeTransposeRefreshRef.current?.();
  }, [runtimeTransposeSemitones]);

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
    const readyScrollRoot: HTMLDivElement = scrollRoot;
    const readyCifraContainer: HTMLDivElement = cifraContainer;
    const readyAudioEl: HTMLAudioElement = audioEl;
    const readyPlayBtn: HTMLButtonElement = playBtn;
    const readySeek: HTMLInputElement = seek;
    const readyTimeLabel: HTMLParagraphElement = timeLabel;
    const readySectionEl: HTMLParagraphElement = currentSectionEl;
    const readyChordEl: HTMLParagraphElement = currentChordEl;

    let destroy: (() => void) | null = null;
    let cancelled = false;

    async function mountRuntime() {
      try {
        if (selectedProvider === "spotify" && spotifyTrackId) {
          /**
           * Evita cair no player interno antes de concluir `/api/spotify/status`.
           * Sem este guard, o primeiro render monta fallback e pode manter UX inconsistente.
           */
          if (spotifyStatus.loading) return;
          if (!spotifyStatus.connected || !spotifyStatus.premium) {
            throw new Error("spotify_account_not_ready");
          }
        }
        const adapter =
          selectedProvider === "spotify" && spotifyTrackId
            ? createSpotifyAdapter({
              trackId: spotifyTrackId,
              ...(spotifyDurationHintSec != null ? { durationHintSec: spotifyDurationHintSec } : {}),
              getIframeElement: () => spotifyEmbedIframeRef.current,
            })
            : selectedProvider === "youtube" && youtubeVideoId
              ? createYoutubeMediaElementAdapter({ getMediaElement: () => youtubeMediaRef.current })
              : createInternalAudioAdapter({ audioEl: readyAudioEl, audioUrl: payload.meta?.audioUrl });

        if (cancelled) return;
        setProviderNotice("");
        destroy = startCifraRuntimeV2({
          payloadInput: payloadForRuntime as unknown as Record<string, unknown>,
          chordDiagramScopeKey: trackKey,
          transposeSemitones: runtimeTransposeSemitones,
          transposeSemitonesLive: runtimeTransposeLiveRef,
          runtimeTransposeRefreshRef,
          userScrollIntentHandlerRef,
          els: {
            scrollRoot: readyScrollRoot,
            cifraContainer: readyCifraContainer,
            playback: adapter,
            playBtn: readyPlayBtn,
            seek: readySeek,
            timeLabel: readyTimeLabel,
            currentSectionEl: readySectionEl,
            currentChordEl: readyChordEl,
            currentChordDiagramEl: chordDiagramRef.current,
            autoScrollBtn: autoScrollBtnRef.current,
            autoScrollLeadEl: autoScrollLeadRef.current,
            autoScrollLeadValEl: autoScrollLeadValRef.current,
            autoScrollDurEl: autoScrollDurRef.current,
            autoScrollDurValEl: autoScrollDurValRef.current,
            showFloatingChordEl: showFloatingChordRef.current,
            showCurrentChordDiagramEl: showCurrentChordDiagramRef.current,
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
        const fallbackAdapter = createInternalAudioAdapter({ audioEl: readyAudioEl, audioUrl: payload.meta?.audioUrl });
        destroy = startCifraRuntimeV2({
          payloadInput: payloadForRuntime as unknown as Record<string, unknown>,
          chordDiagramScopeKey: trackKey,
          transposeSemitones: runtimeTransposeSemitones,
          transposeSemitonesLive: runtimeTransposeLiveRef,
          runtimeTransposeRefreshRef,
          userScrollIntentHandlerRef,
          els: {
            scrollRoot: readyScrollRoot,
            cifraContainer: readyCifraContainer,
            playback: fallbackAdapter,
            playBtn: readyPlayBtn,
            seek: readySeek,
            timeLabel: readyTimeLabel,
            currentSectionEl: readySectionEl,
            currentChordEl: readyChordEl,
            currentChordDiagramEl: chordDiagramRef.current,
            autoScrollBtn: autoScrollBtnRef.current,
            autoScrollLeadEl: autoScrollLeadRef.current,
            autoScrollLeadValEl: autoScrollLeadValRef.current,
            autoScrollDurEl: autoScrollDurRef.current,
            autoScrollDurValEl: autoScrollDurValRef.current,
            showFloatingChordEl: showFloatingChordRef.current,
            showCurrentChordDiagramEl: showCurrentChordDiagramRef.current,
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
    spotifyDurationHintSec,
  ]);

  const titleFromPayload =
    typeof payload.meta?.name === "string" && payload.meta.name.trim()
      ? payload.meta.name.trim()
      : trackTitle;
  const effectiveDisplayTune = transposeTuneLabel(effectiveOriginalTune, transposeSemitones) || effectiveOriginalTune;


  return (
    <div className={cn("flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2.5 sm:gap-3", className)}>
      <audio ref={audioRef} className="hidden" preload="metadata" />
      {hideTransportChrome ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2 px-0 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cifra-muted">
              Fonte
            </span>
            <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
              {transportProviderTabs.map((provider) => {
                const enabled = availableProviders.includes(provider);
                const active = selectedProvider === provider;
                const label =
                  provider === "internal" ? "Interno" : provider === "youtube" ? "YouTube" : "Spotify";
                return (
                  <button
                    key={provider}
                    type="button"
                    disabled={!enabled}
                    onClick={() => selectPlaybackProvider(provider)}
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
          </div>
          <div className="sr-only" aria-hidden>
            <div id="cifra-transport" tabIndex={-1}>
              <button ref={playBtnRef} type="button">
                Reproduzir
              </button>
              <input ref={seekRef} type="range" min={0} max={1000} defaultValue={0} />
              <p ref={timeLabelRef}>0:00 / 0:00</p>
              <p ref={sectionRef}>—</p>
              <p ref={chordRef}>—</p>
            </div>
          </div>
        </>
      ) : (
        <div
          id="cifra-transport"
          tabIndex={-1}
          className="cifra-transport-panel flex shrink-0 flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-[#0c0c16] px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5"
        >
          <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
            {transportProviderTabs.map((provider) => {
              const enabled = availableProviders.includes(provider);
              const active = selectedProvider === provider;
              const label = provider === "internal" ? "Interno" : provider === "youtube" ? "YouTube" : "Spotify";
              return (
                <button
                  key={provider}
                  type="button"
                  disabled={!enabled}
                  onClick={() => selectPlaybackProvider(provider)}
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
            <div
              ref={chordDiagramRef}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/20 p-0.5 sm:h-[56px] sm:w-[56px]"
              aria-hidden
            />
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
      )}
      {providerNotice ? (
        <p className="rounded-lg border border-cifra-teal/25 bg-cifra-teal/10 px-3 py-2 text-[11px] text-cifra-teal">
          {providerNotice}
        </p>
      ) : null}
      <div className="space-y-2 rounded-lg border border-white/6 bg-[#0d0d18] p-2">
        {isClientMounted && spotifyTrackId && selectedProvider === "spotify" ? (
          <div className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
            {spotifyStatus.loading ? (
              <div className="flex h-[152px] items-center gap-3 px-4">
                <div className="size-[100px] shrink-0 animate-pulse rounded-md bg-white/10" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-[70%] max-w-[220px] animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-[45%] animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ) : !spotifyStatus.connected || !spotifyStatus.premium ? (
              <div className="flex min-h-[152px] flex-col justify-centser gap-2.5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-cifra-text">
                    {!spotifyStatus.connected ? "Ligue o Spotify novamente" : "Spotify Premium necessário"}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-cifra-muted">
                    {!spotifyStatus.connected
                      ? "A sessão com o Spotify não está ativa ou expirou. Volte a autenticar-se para ouvir a faixa completa e manter a cifra sincronizada com o áudio."
                      : "A conta Spotify ligada não tem plano Premium. Use uma conta Premium ou escolha outra fonte de áudio."}
                  </p>
                </div>
                <Link
                  href={`/api/spotify/connect?returnTo=${encodeURIComponent(returnToForSpotifyConnect)}`}
                  className="shrink-0 self-start rounded-full bg-cifra-teal px-3.5 py-2 text-[11px] font-semibold text-cifra-bg shadow-[0_0_0_1px_rgba(15,210,193,0.25)] transition-opacity hover:opacity-95 sm:self-center"
                  onClick={() => trackAnalyticsEvent(GA_EVENTS.SPOTIFY_CONNECT_CLICK)}
                >
                  {!spotifyStatus.connected ? "Entrar no Spotify" : "Trocar de conta"}
                </Link>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg bg-black/20 p-2">
                <iframe
                  ref={spotifyEmbedIframeRef}
                  title={spotifyOembed?.title ?? titleFromPayload ?? "Spotify player"}
                  src={`https://open.spotify.com/embed/track/${encodeURIComponent(spotifyTrackId)}?utm_source=generator&theme=0`}
                  width="100%"
                  height="152"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="block w-full rounded-md border-0"
                />
              </div>
            )}
          </div>
        ) : null}
        {isClientMounted && youtubeVideoId ? (
          <div
            className={cn(
              "h-[200px] w-full overflow-hidden rounded-lg border border-white/10 bg-black/20",
              hydratedProvider === "youtube" ? "block" : "hidden",
            )}
          >
            <ReactPlayer
              ref={youtubeMediaRef}
              src={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}`}
              controls
              width="100%"
              height="100%"
              style={{ maxHeight: "200px" }}
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/6 bg-[#12121f] lg:flex-row lg:items-stretch">
        <div
          ref={scrollRootRef}
          onScroll={() => userScrollIntentHandlerRef.current?.("scroll")}
          onWheel={() => userScrollIntentHandlerRef.current?.("user")}
          onTouchMove={() => userScrollIntentHandlerRef.current?.("user")}
          onKeyDown={(e) => {
            if (
              ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"].includes(e.key)
            ) {
              userScrollIntentHandlerRef.current?.("user");
            }
          }}
          className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6"
        >
          <div id="cifra" ref={cifraRef} className="min-h-[min(12rem,30dvh)] w-full min-w-0" />
        </div>

        {isMobileSidebarOpen ? (
          <button
            type="button"
            onClick={() => toggleMobileSidebar(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] lg:hidden"
            aria-label="Fechar painel da faixa"
          />
        ) : null}

        <div
          id="cifra-track-side-panel"
          className={cn(
            "fixed inset-y-0 right-0 z-50 w-[min(86vw,340px)] transition-transform duration-300 ease-out lg:static lg:inset-auto lg:z-auto lg:w-auto lg:translate-x-0",
            isMobileSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          )}
        >
          <CifraRightSidebarClient
            libraryTrackKey={libraryTrackKey}
            trackTitle={titleFromPayload}
            variationSlot={variationSidebarAccessory}
            originalTune={effectiveOriginalTune}
            displayedTune={effectiveDisplayTune}
            transposeSemitones={transposeSemitones}
            onTransposeChange={setTransposeSemitones}
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
            showFloatingChordRef={showFloatingChordRef}
            showCurrentChordDiagramRef={showCurrentChordDiagramRef}
            onMount={bumpRightSidebarMount}
            className={cn(
              rightSidebarLayoutClassName,
              "max-lg:h-full max-lg:w-full max-lg:overflow-y-auto max-lg:border-l max-lg:border-t-0 max-lg:shadow-[-10px_0_30px_rgba(0,0,0,0.45)]",
            )}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggleMobileSidebar(!isMobileSidebarOpen)}
        className={cn(
          "fixed bottom-4 right-4 z-50 rounded-full border border-cifra-teal/35 bg-[#0e1020] px-4 py-2 text-xs font-semibold text-cifra-teal shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition hover:bg-cifra-teal/12 lg:hidden",
          isMobileSidebarOpen && "bg-cifra-teal text-cifra-bg",
        )}
        aria-expanded={isMobileSidebarOpen}
        aria-controls="cifra-track-side-panel"
      >
        {isMobileSidebarOpen ? "Fechar painel" : "Painel da faixa"}
      </button>
      {showAutoScrollFloatingBar ? (
        <div
          onPointerDown={(ev) => {
            const target = ev.target as HTMLElement;
            if (target.closest("input,button")) return;
            const pos = autoScrollBarPos ?? { left: window.innerWidth / 2, top: window.innerHeight * 0.86 };
            autoScrollBarDragRef.current = {
              dragging: true,
              offsetX: ev.clientX - pos.left,
              offsetY: ev.clientY - pos.top,
            };
          }}
          style={{
            left: `${autoScrollBarPos?.left ?? 0}px`,
            top: `${autoScrollBarPos?.top ?? 0}px`,
            transform: "translate(-50%, -50%)",
          }}
          className="fixed z-50 flex w-[min(92vw,420px)] cursor-grab items-center gap-3 rounded-2xl border border-cifra-teal/35 bg-[#0e1020]/95 px-3.5 py-2.5 shadow-[0_10px_34px_rgba(0,0,0,0.5)] backdrop-blur active:cursor-grabbing"
        >
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-cifra-teal">
            Auto Scroll
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={autoScrollSpeed}
            onChange={(e) => {
              const nextSpeed = Number(e.target.value);
              setAutoScrollSpeed(nextSpeed);
              const durationEl = autoScrollDurRef.current;
              if (!durationEl) return;
              durationEl.value = String(speedToDuration(nextSpeed));
              durationEl.dispatchEvent(new Event("input", { bubbles: true }));
              durationEl.dispatchEvent(new Event("change", { bubbles: true }));
            }}
            className="cifra-range cifra-range--sm h-3 min-w-0 flex-1"
            aria-label="Velocidade da rolagem automática"
          />
          <button
            type="button"
            onClick={() => autoScrollBtnRef.current?.click()}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-cifra-muted transition hover:bg-white/10 hover:text-cifra-text"
            aria-label="Fechar auto scroll"
            title="Fechar auto scroll"
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
