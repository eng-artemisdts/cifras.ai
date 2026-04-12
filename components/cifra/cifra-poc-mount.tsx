"use client";

import { useEffect, useRef } from "react";

import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { startCifraRuntime } from "@/lib/engine/start-cifra-runtime";
import { cn } from "@/lib/utils";

export type CifraPocMountProps = {
  /** Chave estável (ex.: `trackId`) para remontar o runtime quando a faixa mudar. */
  trackKey: string;
  payload: MusicAiDemoPayload;
  className?: string;
};

/**
 * Monta a cifra com o mesmo motor DOM da POC (`mountCifraView`), destaque em reprodução e auto-rolagem.
 */
export function CifraPocMount({ trackKey, payload, className }: CifraPocMountProps) {
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
      payloadInput: payload as unknown as Record<string, unknown>,
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
      },
    });

    return destroy;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só remontar quando a faixa (`trackKey`) muda; o payload do RSC pode ter nova referência por render.
  }, [trackKey]);

  return (
    <div className={cn("flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2.5 sm:gap-3", className)}>
      <div className="cifra-transport-panel flex shrink-0 flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-[#0c0c16] px-4 py-3 sm:gap-4 sm:px-5 sm:py-3.5">
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

      <div className="cifra-transport-panel flex shrink-0 flex-wrap items-end gap-4 rounded-2xl border border-white/8 bg-[#0c0c16] px-4 py-3 sm:gap-5 sm:px-5 sm:py-3.5">
        <button
          ref={autoScrollBtnRef}
          type="button"
          className="shrink-0 rounded-full border border-white/20 bg-transparent px-3.5 py-1.5 text-xs font-semibold text-cifra-text shadow-none transition-colors hover:border-white/30 data-[on=true]:border-cifra-teal/50 data-[on=true]:text-cifra-teal"
        >
          Auto-scroll
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-5 sm:gap-8">
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Antecipação
            <span className="flex items-center gap-2">
              <input
                ref={autoScrollLeadRef}
                type="range"
                min={0}
                max={2}
                step={0.05}
                defaultValue={0.4}
                className="cifra-range cifra-range--sm h-3 min-w-0 flex-1"
              />
              <span ref={autoScrollLeadValRef} className="w-13 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-cifra-teal">
                0,40 s
              </span>
            </span>
          </label>
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Duração scroll
            <span className="flex items-center gap-2">
              <input
                ref={autoScrollDurRef}
                type="range"
                min={200}
                max={1200}
                step={50}
                defaultValue={450}
                className="cifra-range cifra-range--sm h-3 min-w-0 flex-1"
              />
              <span ref={autoScrollDurValRef} className="w-13 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-cifra-teal">
                450 ms
              </span>
            </span>
          </label>
        </div>
      </div>

      <div
        ref={scrollRootRef}
        className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-white/6 bg-[#12121f] px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5 lg:px-8 lg:py-6"
      >
        <div id="cifra" ref={cifraRef} className="min-h-[min(12rem,30dvh)] w-full min-w-0" />
      </div>
    </div>
  );
}
