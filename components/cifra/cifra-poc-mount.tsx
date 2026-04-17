"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "@/lib/cifra/lyric-expand-clamp";
import { applyCifraPlaybackHighlight, resolveCifraSmartScrollTarget } from "@/lib/engine/cifra-view";
import { createChordTimeline, formatChordLabel, isNoChordEvent } from "@/lib/engine/chord-timeline";
import { DEFAULT_AUDIO_URL, SEEK_SLIDER_STEPS } from "@/lib/engine/config";
import { buildLyricModel } from "@/lib/engine/lyric-timeline";
import { sectionAtTimestamp } from "@/lib/engine/section-timeline";
import { formatClock, getEffectiveDuration } from "@/lib/engine/time-format";
import { cn } from "@/lib/utils";

import { CifraPreviewSheet } from "./cifra-preview-sheet";
import { CifraRightSidebar } from "./cifra-right-sidebar";

const LS_AUTO_SCROLL_LEAD = "cifra-ai:autoScrollLeadSec";
const LS_AUTO_SCROLL_DURATION_MS = "cifra-ai:autoScrollDurationMs";
const LS_SCROLL_MODE = "cifra-ai:scrollMode";
const DEFAULT_AUTO_SCROLL_LEAD_SEC = 0.4;
const DEFAULT_AUTO_SCROLL_DURATION_MS = 450;
const SMART_SCROLL_VIEWPORT_ANCHOR = 0.5;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}

function lyricMaxEndSec(lyrics: MusicAiDemoPayload["lyrics"]): number {
  const { timedLines } = buildLyricModel(lyrics ?? []);
  let m = 0;
  for (const line of timedLines) {
    for (const word of line) {
      if (word.end != null && Number.isFinite(word.end)) m = Math.max(m, word.end);
    }
  }
  return m;
}

export type CifraPocMountProps = {
  /** Chave estável (ex.: `trackId`) para remontar o transporte quando a faixa mudar. */
  trackKey: string;
  payload: MusicAiDemoPayload;
  /** Título da faixa para copy no painel direito (frame `2Zui4`). */
  trackTitle?: string;
  className?: string;
};

/**
 * Pré-visualização da cifra com a mesma lógica de slots que o editor (`CifraPreviewSheet`),
 * mais transporte (áudio / tempo virtual), destaque em reprodução e auto-rolagem.
 */
export function CifraPocMount({ trackKey, payload, trackTitle, className }: CifraPocMountProps) {
  const [originalTune, setOriginalTune] = useState(() => payload.original_tune ?? "");
  const [capoAt, setCapoAt] = useState(() =>
    Number.isFinite(payload.capo_at) ? Math.min(24, Math.max(0, Math.round(Number(payload.capo_at)))) : 0,
  );

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

  const chords = payload.chords ?? [];
  const chordOffsetSec = Number.isFinite(payload.chordTimeOffsetSec) ? Number(payload.chordTimeOffsetSec) : 0;
  const meta = payload.meta ?? {};

  const sectionsSorted = useMemo(
    () => mergeConsecutiveDuplicateSectionLabels(sortSections([...(payload.sections ?? [])])),
    [payload.sections],
  );

  const chordTimeline = useMemo(() => createChordTimeline(chords, { offsetSec: chordOffsetSec }), [chords, chordOffsetSec]);

  const hasTimingContent =
    chords.length > 0 || lyricMaxEndSec(payload.lyrics) > 0 || (typeof meta.duration_seconds === "number" && meta.duration_seconds > 0);

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

    const scrollRootEl = scrollRoot;
    const cifraShellEl = cifraContainer;
    const audioEl = audio;
    const playBtnEl = playBtn;
    const seekEl = seek;
    const timeLabelEl = timeLabel;
    const sectionEl = currentSectionEl;
    const chordEl = currentChordEl;

    const autoScrollBtn = autoScrollBtnRef.current;
    const autoScrollLeadEl = autoScrollLeadRef.current;
    const autoScrollLeadValEl = autoScrollLeadValRef.current;
    const autoScrollDurEl = autoScrollDurRef.current;
    const autoScrollDurValEl = autoScrollDurValRef.current;
    const scrollModeAutomaticEl = scrollModeAutomaticRef.current;
    const scrollModeSmartEl = scrollModeSmartRef.current;

    let virtualT = 0;
    let audioReady = false;
    let audioUsable = false;
    let virtualPlaying = false;
    let virtualRafId = 0;
    let lastVirtualPerfMs = 0;
    let autoScrollEnabled = false;
    let lastAutoScrollTarget: Element | null = null;
    let lastTimeBasedScrollTop = -1;
    let scrollAnimGen = 0;

    function cancelSmoothScrolling() {
      scrollAnimGen += 1;
    }

    function cancelVirtualPlayback() {
      virtualPlaying = false;
      lastVirtualPerfMs = 0;
      if (virtualRafId) {
        cancelAnimationFrame(virtualRafId);
        virtualRafId = 0;
      }
    }

    function updateTransportUi() {
      const playing = (audioUsable && !audioEl.paused) || virtualPlaying;
      playBtnEl.textContent = playing ? "Pausa" : "Reproduzir";
    }

    function virtualStep(perfMs: number) {
      if (!virtualPlaying) return;
      if (!lastVirtualPerfMs) lastVirtualPerfMs = perfMs;
      const dt = (perfMs - lastVirtualPerfMs) / 1000;
      lastVirtualPerfMs = perfMs;
      const dur = getEffectiveDuration(audioEl, audioReady, chordTimeline.lastChordEndAudioTime);
      virtualT = Math.min(dur, Math.max(0, virtualT + dt));
      tick();
      if (virtualT >= dur - 0.001) {
        cancelVirtualPlayback();
        updateTransportUi();
        return;
      }
      virtualRafId = requestAnimationFrame(virtualStep);
    }

    function smoothScrollToElement(el: Element, durationMs: number, viewportAnchor: number) {
      scrollAnimGen += 1;
      const myGen = scrollAnimGen;
      const rect = el.getBoundingClientRect();
      const rootRect = scrollRootEl.getBoundingClientRect();
      const elCenterY = rect.top - rootRect.top + scrollRootEl.scrollTop + rect.height / 2;
      let targetY = elCenterY - scrollRootEl.clientHeight * viewportAnchor;
      const maxScroll = Math.max(0, scrollRootEl.scrollHeight - scrollRootEl.clientHeight);
      targetY = clamp(targetY, 0, maxScroll);
      const startY = scrollRootEl.scrollTop;
      const delta = targetY - startY;
      if (Math.abs(delta) < 2) return;
      const durRaw = Number(durationMs);
      const dur = Number.isFinite(durRaw) && durRaw >= 0 ? durRaw : DEFAULT_AUTO_SCROLL_DURATION_MS;
      if (dur <= 0) {
        scrollRootEl.scrollTo({ top: targetY, behavior: "auto" });
        return;
      }
      const t0 = performance.now();
      function frame(now: number) {
        if (myGen !== scrollAnimGen) return;
        const u = Math.min(1, (now - t0) / dur);
        scrollRootEl.scrollTop = startY + delta * easeInOutQuad(u);
        if (u < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    function syncAutoScrollControlLabels() {
      if (autoScrollLeadEl && autoScrollLeadValEl) {
        const x = Number(autoScrollLeadEl.value);
        autoScrollLeadValEl.textContent = `${(Number.isFinite(x) ? x : DEFAULT_AUTO_SCROLL_LEAD_SEC).toFixed(2).replace(".", ",")} s`;
      }
      if (autoScrollDurEl && autoScrollDurValEl) {
        const ms = Math.round(Number(autoScrollDurEl.value));
        autoScrollDurValEl.textContent = `${Number.isFinite(ms) ? ms : DEFAULT_AUTO_SCROLL_DURATION_MS} ms`;
      }
    }

    function persistAutoScrollControls() {
      if (autoScrollLeadEl) lsSet(LS_AUTO_SCROLL_LEAD, autoScrollLeadEl.value);
      if (autoScrollDurEl) lsSet(LS_AUTO_SCROLL_DURATION_MS, autoScrollDurEl.value);
    }

    function persistScrollMode() {
      if (!scrollModeAutomaticEl && !scrollModeSmartEl) return;
      if (scrollModeSmartEl?.checked) lsSet(LS_SCROLL_MODE, "smart");
      else lsSet(LS_SCROLL_MODE, "automatic");
    }

    function initScrollModeRadios() {
      if (!scrollModeAutomaticEl && !scrollModeSmartEl) return;
      const raw = lsGet(LS_SCROLL_MODE);
      const smart = raw === "smart";
      if (scrollModeSmartEl) scrollModeSmartEl.checked = smart;
      if (scrollModeAutomaticEl) scrollModeAutomaticEl.checked = !smart;
    }

    function isSmartScrollMode() {
      return Boolean(scrollModeSmartEl?.checked);
    }

    function initAutoScrollControls() {
      if (autoScrollLeadEl) {
        const raw = lsGet(LS_AUTO_SCROLL_LEAD);
        let v = DEFAULT_AUTO_SCROLL_LEAD_SEC;
        if (raw != null) {
          const n = parseFloat(raw);
          if (Number.isFinite(n)) v = clamp(n, 0, 2);
        }
        autoScrollLeadEl.value = String(Math.round(v * 20) / 20);
      }
      if (autoScrollDurEl) {
        const raw = lsGet(LS_AUTO_SCROLL_DURATION_MS);
        let v = DEFAULT_AUTO_SCROLL_DURATION_MS;
        if (raw != null) {
          const n = parseInt(raw, 10);
          if (Number.isFinite(n)) v = clamp(n, 200, 1200);
          v = Math.round(v / 50) * 50;
        }
        autoScrollDurEl.value = String(v);
      }
      syncAutoScrollControlLabels();
    }

    function syncAutoScrollButtonUi() {
      if (!autoScrollBtn) return;
      autoScrollBtn.dataset.on = autoScrollEnabled ? "true" : "false";
      const on = autoScrollEnabled ? "true" : "false";
      autoScrollBtn.setAttribute("aria-checked", on);
      autoScrollBtn.setAttribute(
        "aria-label",
        autoScrollEnabled ? "Desativar rolagem da cifra" : "Ativar rolagem da cifra",
      );
    }

    function applyTimeBasedScroll(t: number) {
      const dur = getEffectiveDuration(audioEl, audioReady, chordTimeline.lastChordEndAudioTime);
      const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
      const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
      const tEff = dur > 0 ? clamp(t + lead, 0, dur) : 0;
      const maxScroll = Math.max(0, scrollRootEl.scrollHeight - scrollRootEl.clientHeight);
      const targetTop = dur > 0 ? (tEff / dur) * maxScroll : 0;
      const y = clamp(targetTop, 0, maxScroll);
      if (Math.abs(y - lastTimeBasedScrollTop) < 0.75) return;
      lastTimeBasedScrollTop = y;
      scrollRootEl.scrollTop = y;
    }

    function applySmartScroll(container: HTMLElement, t: number) {
      const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
      const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
      const durationMs = autoScrollDurEl ? Number(autoScrollDurEl.value) : DEFAULT_AUTO_SCROLL_DURATION_MS;
      const el = resolveCifraSmartScrollTarget(container, t, lead, chords, chordOffsetSec);
      if (el && el !== lastAutoScrollTarget) {
        lastAutoScrollTarget = el;
        smoothScrollToElement(
          el,
          Number.isFinite(durationMs) ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS,
          SMART_SCROLL_VIEWPORT_ANCHOR,
        );
      }
    }

    function applyAutoScroll(container: HTMLElement, t: number) {
      if (!autoScrollEnabled) return;
      if (isSmartScrollMode()) applySmartScroll(container, t);
      else applyTimeBasedScroll(t);
    }

    function nowAudioTime() {
      if (audioUsable && audioEl.src) return audioEl.currentTime;
      return virtualT;
    }

    function tick() {
      const t = nowAudioTime();
      const dur = getEffectiveDuration(audioEl, audioReady, chordTimeline.lastChordEndAudioTime);
      seekEl.value = dur ? String(Math.min(SEEK_SLIDER_STEPS, Math.round((t / dur) * SEEK_SLIDER_STEPS))) : "0";
      timeLabelEl.textContent = `${formatClock(t)} / ${formatClock(dur)}`;
      const chNow = chordTimeline.atAudioTime(t);
      chordEl.textContent = formatChordLabel(chNow);
      chordEl.title = isNoChordEvent(chNow)
        ? "Sem acorde — a análise marca aqui o fim da progressão harmónica (N)."
        : "";
      chordEl.classList.toggle("text-cifra-muted", isNoChordEvent(chNow));
      chordEl.classList.toggle("text-cifra-teal", !isNoChordEvent(chNow));
      const sec = sectionAtTimestamp(sectionsSorted, t);
      if (sec) {
        sectionEl.textContent = sec.label;
        sectionEl.title = `${formatClock(sec.start)} — ${formatClock(sec.end)}`;
      } else {
        sectionEl.textContent = "—";
        sectionEl.title = "";
      }
      applyCifraPlaybackHighlight(cifraShellEl, t, chords, chordOffsetSec);
      applyAutoScroll(cifraShellEl, t);
    }

    const onTimeUpdate = () => tick();
    const onSeekInput = () => {
      cancelSmoothScrolling();
      lastAutoScrollTarget = null;
      lastTimeBasedScrollTop = -1;
      const dur = getEffectiveDuration(audioEl, audioReady, chordTimeline.lastChordEndAudioTime);
      const t = (Number(seekEl.value) / SEEK_SLIDER_STEPS) * dur;
      if (audioUsable && audioEl.src) audioEl.currentTime = t;
      else virtualT = t;
      tick();
    };
    const onPlay = () => {
      cancelVirtualPlayback();
      updateTransportUi();
    };
    const onPause = () => {
      updateTransportUi();
    };
    const onEnded = () => {
      updateTransportUi();
      tick();
    };
    const onPlayClick = () => {
      if (audioUsable) {
        cancelVirtualPlayback();
        if (audioEl.paused) void audioEl.play().catch(() => {});
        else audioEl.pause();
      } else {
        virtualPlaying = !virtualPlaying;
        if (virtualPlaying) {
          lastVirtualPerfMs = 0;
          virtualRafId = requestAnimationFrame(virtualStep);
        } else {
          cancelVirtualPlayback();
        }
        updateTransportUi();
        tick();
      }
    };
    const onLoadedMetadata = () => {
      const wasVirtualPlaying = virtualPlaying;
      const tSync = virtualT;
      audioUsable = true;
      audioReady = true;
      cancelVirtualPlayback();
      try {
        const d = audioEl.duration;
        if (Number.isFinite(d) && d > 0) {
          audioEl.currentTime = Math.min(Math.max(0, tSync), d);
        }
      } catch {
        // ignore
      }
      cancelSmoothScrolling();
      lastAutoScrollTarget = null;
      lastTimeBasedScrollTop = -1;
      tick();
      playBtnEl.disabled = false;
      updateTransportUi();
      if (wasVirtualPlaying) void audioEl.play().catch(() => {});
    };
    const onAudioError = () => {
      audioUsable = false;
      audioReady = false;
      cancelVirtualPlayback();
      playBtnEl.disabled = false;
      tick();
      updateTransportUi();
    };

    initAutoScrollControls();
    initScrollModeRadios();
    playBtnEl.disabled = !hasTimingContent;
    seekEl.disabled = !hasTimingContent;
    tick();
    updateTransportUi();

    const audioUrlFromMeta = typeof meta.audioUrl === "string" ? meta.audioUrl : "";
    audioEl.src = audioUrlFromMeta || DEFAULT_AUDIO_URL;
    audioEl.load();

    audioEl.addEventListener("loadedmetadata", onLoadedMetadata);
    audioEl.addEventListener("error", onAudioError);
    audioEl.addEventListener("timeupdate", onTimeUpdate);
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("pause", onPause);
    audioEl.addEventListener("ended", onEnded);
    playBtnEl.addEventListener("click", onPlayClick);
    seekEl.addEventListener("input", onSeekInput);

    let onAutoBtn: (() => void) | null = null;
    if (autoScrollBtn) {
      onAutoBtn = () => {
        autoScrollEnabled = !autoScrollEnabled;
        if (!autoScrollEnabled) cancelSmoothScrolling();
        lastAutoScrollTarget = null;
        lastTimeBasedScrollTop = -1;
        syncAutoScrollButtonUi();
        tick();
      };
      autoScrollBtn.addEventListener("click", onAutoBtn);
      syncAutoScrollButtonUi();
    }
    if (autoScrollLeadEl) {
      autoScrollLeadEl.addEventListener("input", syncAutoScrollControlLabels);
      autoScrollLeadEl.addEventListener("change", persistAutoScrollControls);
    }
    if (autoScrollDurEl) {
      autoScrollDurEl.addEventListener("input", syncAutoScrollControlLabels);
      autoScrollDurEl.addEventListener("change", persistAutoScrollControls);
    }

    const onScrollModeChange = () => {
      persistScrollMode();
      cancelSmoothScrolling();
      lastAutoScrollTarget = null;
      lastTimeBasedScrollTop = -1;
      tick();
    };
    if (scrollModeAutomaticEl) scrollModeAutomaticEl.addEventListener("change", onScrollModeChange);
    if (scrollModeSmartEl) scrollModeSmartEl.addEventListener("change", onScrollModeChange);

    return () => {
      cancelSmoothScrolling();
      cancelVirtualPlayback();
      audioEl.removeEventListener("loadedmetadata", onLoadedMetadata);
      audioEl.removeEventListener("error", onAudioError);
      audioEl.removeEventListener("timeupdate", onTimeUpdate);
      audioEl.removeEventListener("play", onPlay);
      audioEl.removeEventListener("pause", onPause);
      audioEl.removeEventListener("ended", onEnded);
      playBtnEl.removeEventListener("click", onPlayClick);
      seekEl.removeEventListener("input", onSeekInput);
      if (autoScrollBtn && onAutoBtn) autoScrollBtn.removeEventListener("click", onAutoBtn);
      if (autoScrollLeadEl) {
        autoScrollLeadEl.removeEventListener("input", syncAutoScrollControlLabels);
        autoScrollLeadEl.removeEventListener("change", persistAutoScrollControls);
      }
      if (autoScrollDurEl) {
        autoScrollDurEl.removeEventListener("input", syncAutoScrollControlLabels);
        autoScrollDurEl.removeEventListener("change", persistAutoScrollControls);
      }
      if (scrollModeAutomaticEl) scrollModeAutomaticEl.removeEventListener("change", onScrollModeChange);
      if (scrollModeSmartEl) scrollModeSmartEl.removeEventListener("change", onScrollModeChange);
    };
  }, [trackKey, payload, chords, chordOffsetSec, chordTimeline, sectionsSorted, hasTimingContent, meta.audioUrl]);

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
          className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 sm:px-3 sm:py-3 md:px-4 md:py-4 lg:px-5 lg:py-5"
        >
          <CifraPreviewSheet ref={cifraRef} payload={payload} />
        </div>

        <CifraRightSidebar
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
          className="mt-0 w-full border-t border-white/6 bg-cifra-surface lg:mt-0 lg:w-[300px] lg:shrink-0 lg:border-l lg:border-t-0"
        />
      </div>
    </div>
  );
}
