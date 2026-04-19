"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { buildPreviewChordAnchors } from "@/lib/cifra/preview-chord-anchors";
import { startCifraRuntime } from "@/lib/engine/start-cifra-runtime";
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
  payload: MusicAiDemoPayload;
  /** Título da faixa para copy no painel direito (frame `2Zui4`). */
  trackTitle?: string;
  className?: string;
};

/**
 * Monta a cifra com o mesmo motor DOM da POC (`mountCifraView`), destaque em reprodução e auto-rolagem.
 * Painel direito completo (Pencil `sideR`) com controlos de rolagem automática.
 */
export function CifraPocMount({ trackKey, payload, trackTitle, className }: CifraPocMountProps) {
  const [originalTune, setOriginalTune] = useState(() => payload.original_tune ?? "");
  const [capoAt, setCapoAt] = useState(() =>
    Number.isFinite(payload.capo_at) ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at)))) : 0,
  );
  const [rightSidebarMountGen, setRightSidebarMountGen] = useState(0);
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

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    const cifraContainer = cifraRef.current;
    const audio = audioRef.current;
    const playBtn = playBtnRef.current;
    const seek = seekRef.current;
    const timeLabel = timeLabelRef.current;
    const currentSectionEl = sectionRef.current;
    const currentChordEl = chordRef.current;
    if (
      !scrollRoot ||
      !cifraContainer ||
      !audio ||
      !playBtn ||
      !seek ||
      !timeLabel ||
      !currentSectionEl ||
      !currentChordEl
    ) {
      return;
    }

    const destroy = startCifraRuntime({
      payloadInput: payloadForRuntime as unknown as Record<string, unknown>,
      els: {
        scrollRoot,
        cifraContainer,
        audio,
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

    return destroy;
  }, [trackKey, payloadForRuntime, rightSidebarMountGen]);

  useEffect(() => {
    setOriginalTune(payload.original_tune ?? "");
    setCapoAt(
      Number.isFinite(payload.capo_at) ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at)))) : 0,
    );
  }, [trackKey, payload.original_tune, payload.capo_at]);

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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/6 bg-[#12121f] lg:flex-row lg:items-stretch">
        <div
          ref={scrollRootRef}
          className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6"
        >
          <div id="cifra" ref={cifraRef} className="min-h-[min(12rem,30dvh)] w-full min-w-0" />
        </div>

        <CifraRightSidebarClient
          trackTitle={titleFromPayload}
          originalTune={originalTune}
          onOriginalTuneChange={setOriginalTune}
          capoAt={capoAt}
          onCapoAtChange={(n) => setCapoAt(Math.min(24, Math.max(0, Math.round(n))))}
          isPrivate={payload.is_private === true}
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
