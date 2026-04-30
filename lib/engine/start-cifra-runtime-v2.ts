// @ts-nocheck
import {
  applyCifraPlaybackHighlight,
  mountCifraView,
  resolveCifraScrollTarget,
} from "./cifra-view";
import { createChordTimeline, formatChordLabel, isNoChordEvent } from "./chord-timeline";
import { buildLyricModel } from "./lyric-timeline";
import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "./payload-read";
import { sectionAtTimestamp } from "./section-timeline";
import {
  buildCifraRenderPlan,
  computeChordOnlyInstrumentalBlocks,
  renumberGlobalWordIndices,
} from "./section-layout";
import { SEEK_SLIDER_STEPS } from "./config";
import { formatClock } from "./time-format";
import type { PlaybackAdapter } from "./playback-adapters";
import { transposeChordLabel } from "@/lib/cifra/chord-transpose";

const LS_AUTO_SCROLL_LEAD = "cifra-ai:autoScrollLeadSec";
const LS_AUTO_SCROLL_DURATION_MS = "cifra-ai:autoScrollDurationMs";
const LS_SCROLL_MODE = "cifra-ai:scrollMode";
const LS_AUTO_SCROLL_ENABLED = "cifra-ai:autoScrollEnabled";
const LS_SHOW_FLOATING_CHORD = "cifra-ai:showFloatingChord";
const LS_FLOATING_CHORD_POS = "cifra-ai:floatingChordPos";
const DEFAULT_AUTO_SCROLL_LEAD_SEC = 0.4;
const DEFAULT_AUTO_SCROLL_DURATION_MS = 450;
const SMART_SCROLL_VIEWPORT_ANCHOR = 0.38;
const USER_SCROLL_PAUSE_MS = 1400;

function coalescePayload(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    chords: Array.isArray(p.chords) ? p.chords : [],
    lyrics: Array.isArray(p.lyrics) ? p.lyrics : [],
    sections: Array.isArray(p.sections) ? p.sections : [],
    meta: p.meta && typeof p.meta === "object" ? p.meta : {},
    chordTimeOffsetSec: Number.isFinite(p.chordTimeOffsetSec) ? p.chordTimeOffsetSec : 0,
    slotIdsInLyricOrder: Array.isArray(p.slotIdsInLyricOrder) ? p.slotIdsInLyricOrder : null,
    chordAnchorsBySlotId:
      p.chordAnchorsBySlotId && typeof p.chordAnchorsBySlotId === "object" ? p.chordAnchorsBySlotId : null,
  };
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function lsGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {
    // ignore
  }
}
function lyricMaxEndSec(timedLines) {
  let m = 0;
  for (const line of timedLines) {
    for (const word of line) {
      if (word.end != null && Number.isFinite(word.end)) m = Math.max(m, word.end);
    }
  }
  return m;
}

type CifraRuntimeEls = {
  cifraContainer: HTMLElement;
  scrollRoot: HTMLElement;
  playback: PlaybackAdapter;
  playBtn: HTMLButtonElement;
  seek: HTMLInputElement;
  timeLabel: HTMLElement;
  currentSectionEl: HTMLElement;
  currentChordEl: HTMLElement;
  autoScrollBtn: HTMLButtonElement | null;
  autoScrollLeadEl: HTMLInputElement | null;
  autoScrollLeadValEl: HTMLElement | null;
  autoScrollDurEl: HTMLInputElement | null;
  autoScrollDurValEl: HTMLElement | null;
  showFloatingChordEl?: HTMLInputElement | null;
  scrollModeAutomaticEl?: HTMLInputElement | null;
  scrollModeSmartEl?: HTMLInputElement | null;
};

export type StartCifraRuntimeOptions = {
  payloadInput: Record<string, unknown>;
  chordDiagramScopeKey?: string;
  transposeSemitones?: number;
  els: CifraRuntimeEls;
};

export function startCifraRuntimeV2(opts: StartCifraRuntimeOptions): () => void {
  const chordDiagramScopeKey = typeof opts.chordDiagramScopeKey === "string" ? opts.chordDiagramScopeKey : "";
  const transposeSemitones = Number.isFinite(opts.transposeSemitones) ? Number(opts.transposeSemitones) : 0;
  const {
    cifraContainer,
    scrollRoot,
    playback,
    playBtn,
    seek,
    timeLabel,
    currentSectionEl,
    currentChordEl,
    autoScrollBtn,
    autoScrollLeadEl,
    autoScrollLeadValEl,
    autoScrollDurEl,
    autoScrollDurValEl,
    showFloatingChordEl,
    scrollModeAutomaticEl,
    scrollModeSmartEl,
  } = opts.els;

  const payload = coalescePayload(opts.payloadInput);
  const sectionsSorted = mergeConsecutiveDuplicateSectionLabels(sortSections(payload.sections));
  const chordTimeline = createChordTimeline(payload.chords, { offsetSec: payload.chordTimeOffsetSec });
  const { timedLines: rawTimedLines } = buildLyricModel(payload.lyrics);
  const meta = payload.meta;

  function chordForDisplayFromEvent(c) {
    return transposeChordLabel(formatChordLabel(c), transposeSemitones);
  }

  let cachedScrollContainer = null;
  function pickScrollContainer() {
    function hasOverflowScrollStyle(el) {
      if (!(el instanceof HTMLElement)) return false;
      const cs = getComputedStyle(el);
      const oy = cs.overflowY;
      return oy === "auto" || oy === "scroll" || oy === "overlay";
    }
    function canScrollNow(el) {
      return hasOverflowScrollStyle(el) && el.scrollHeight - el.clientHeight > 1;
    }
    if (canScrollNow(scrollRoot)) {
      cachedScrollContainer = scrollRoot;
      return scrollRoot;
    }
    if (cachedScrollContainer instanceof HTMLElement && cachedScrollContainer.isConnected && canScrollNow(cachedScrollContainer)) {
      return cachedScrollContainer;
    }
    let node = scrollRoot.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (canScrollNow(node)) {
        cachedScrollContainer = node;
        return node;
      }
      node = node.parentElement;
    }
    const se = document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
    if (se && se.scrollHeight - se.clientHeight > 1) return se;
    return null;
  }

  let virtualT = 0;
  let virtualPlaying = false;
  let virtualRafId = 0;
  let lastVirtualPerfMs = 0;
  let renderPlan = [];
  let cifra = null;
  let autoScrollEnabled = false;
  let playbackReady = false;
  let lastAutoScrollTarget = null;
  let lastTimeBasedScrollTop = -1;
  let scrollAnimGen = 0;
  let timeScrollRafId = 0;
  let timeScrollTargetY = -1;
  let userScrollPauseUntilMs = 0;
  let programmaticScrollUntilMs = 0;
  let showFloatingChord = true;
  let floatingChordRoot: HTMLDivElement | null = null;
  let floatingChordLabel: HTMLSpanElement | null = null;
  let floatingChordDestroy: (() => void) | null = null;

  function getDurationWithFallback() {
    const fromProvider = playback.getDuration();
    if (Number.isFinite(fromProvider) && fromProvider > 0) return fromProvider;
    const fromMeta = typeof meta?.duration_seconds === "number" ? meta.duration_seconds : 0;
    const fromLyrics = lyricMaxEndSec(rawTimedLines);
    const fallback = Math.max(chordTimeline.lastChordEndAudioTime, fromMeta, fromLyrics);
    return fallback > 0 ? fallback : 1;
  }
  function nowAudioTime() {
    if (virtualPlaying) return virtualT;
    const t = playback.getCurrentTime();
    return Number.isFinite(t) ? t : 0;
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
    const playing = playback.isPlaying() || virtualPlaying;
    playBtn.textContent = playing ? "Pausa" : "Reproduzir";
  }
  function virtualStep(perfMs) {
    if (!virtualPlaying) return;
    if (!lastVirtualPerfMs) lastVirtualPerfMs = perfMs;
    const dt = (perfMs - lastVirtualPerfMs) / 1000;
    lastVirtualPerfMs = perfMs;
    const dur = getDurationWithFallback();
    virtualT = Math.min(dur, Math.max(0, virtualT + dt));
    tick();
    if (virtualT >= dur - 0.001) {
      cancelVirtualPlayback();
      updateTransportUi();
      return;
    }
    virtualRafId = requestAnimationFrame(virtualStep);
  }
  function markProgrammaticScroll() {
    programmaticScrollUntilMs = performance.now() + 120;
  }
  function cancelSmoothScrolling() {
    scrollAnimGen += 1;
  }
  function cancelTimeBasedScrollAnimation() {
    if (timeScrollRafId) {
      cancelAnimationFrame(timeScrollRafId);
      timeScrollRafId = 0;
    }
    timeScrollTargetY = -1;
  }
  function pauseAutoScrollByUser(ms = USER_SCROLL_PAUSE_MS) {
    if (!autoScrollEnabled) return;
    userScrollPauseUntilMs = Math.max(userScrollPauseUntilMs, performance.now() + ms);
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
  }
  function smoothScrollToElement(el, durationMs, viewportAnchor) {
    scrollAnimGen += 1;
    const myGen = scrollAnimGen;
    const root = pickScrollContainer();
    if (!root) return;
    const rect = el.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const elCenterY = rect.top - rootRect.top + root.scrollTop + rect.height / 2;
    let targetY = elCenterY - root.clientHeight * viewportAnchor;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    targetY = clamp(targetY, 0, maxScroll);
    const startY = root.scrollTop;
    const delta = targetY - startY;
    if (Math.abs(delta) < 2) return;
    const dur = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS;
    if (dur <= 0) {
      markProgrammaticScroll();
      root.scrollTo({ top: targetY, behavior: "auto" });
      return;
    }
    const t0 = performance.now();
    function frame(now) {
      if (myGen !== scrollAnimGen) return;
      const u = Math.min(1, (now - t0) / dur);
      markProgrammaticScroll();
      root.scrollTop = startY + delta * easeInOutQuad(u);
      if (u < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function requestTimeBasedScrollTo(nextY) {
    timeScrollTargetY = Number(nextY);
    if (timeScrollRafId) return;
    const step = () => {
      timeScrollRafId = 0;
      const root = pickScrollContainer();
      if (!root) return;
      const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
      if (maxScroll <= 0) return;
      const target = clamp(timeScrollTargetY, 0, maxScroll);
      const curr = root.scrollTop;
      const delta = target - curr;
      if (Math.abs(delta) <= 0.5) {
        markProgrammaticScroll();
        root.scrollTop = target;
        lastTimeBasedScrollTop = target;
        return;
      }
      markProgrammaticScroll();
      root.scrollTop = curr + delta * 0.18;
      lastTimeBasedScrollTop = root.scrollTop;
      timeScrollRafId = requestAnimationFrame(step);
    };
    timeScrollRafId = requestAnimationFrame(step);
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
  function initAutoScrollEnabledPref() {
    autoScrollEnabled = lsGet(LS_AUTO_SCROLL_ENABLED) === "1";
  }
  function persistAutoScrollEnabledPref() {
    lsSet(LS_AUTO_SCROLL_ENABLED, autoScrollEnabled ? "1" : "0");
  }
  function persistScrollMode() {
    if (scrollModeSmartEl?.checked) lsSet(LS_SCROLL_MODE, "smart");
    else lsSet(LS_SCROLL_MODE, "automatic");
  }
  function syncFloatingChordVisibility() {
    if (!floatingChordRoot) return;
    floatingChordRoot.style.display = showFloatingChord ? "flex" : "none";
  }
  function persistFloatingChordPref() {
    lsSet(LS_SHOW_FLOATING_CHORD, showFloatingChord ? "1" : "0");
  }
  function initFloatingChordToggle() {
    const raw = lsGet(LS_SHOW_FLOATING_CHORD);
    showFloatingChord = raw == null ? true : raw !== "0";
    if (showFloatingChordEl) showFloatingChordEl.checked = showFloatingChord;
  }
  function canUseSmartScrollMode() {
    return Boolean(scrollModeSmartEl && !scrollModeSmartEl.disabled);
  }
  function initScrollModeRadios() {
    const smart = canUseSmartScrollMode() && lsGet(LS_SCROLL_MODE) === "smart";
    if (scrollModeSmartEl) scrollModeSmartEl.checked = smart;
    if (scrollModeAutomaticEl) scrollModeAutomaticEl.checked = !smart;
    if (!smart) lsSet(LS_SCROLL_MODE, "automatic");
  }
  function isSmartScrollMode() {
    return canUseSmartScrollMode() && Boolean(scrollModeSmartEl?.checked);
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
      }
      autoScrollDurEl.value = String(Math.round(v / 50) * 50);
    }
    syncAutoScrollControlLabels();
  }
  function rebuildLayoutFromMode() {
    const vocalTimedLines = renumberGlobalWordIndices(rawTimedLines);
    const chordOnlyBlocks = computeChordOnlyInstrumentalBlocks({
      timedLines: rawTimedLines,
      chords: payload.chords || [],
      sectionsSorted,
      chordTimeOffsetSec: payload.chordTimeOffsetSec ?? 0,
      durationHintSec: getDurationWithFallback(),
      formatChord: (c) => chordForDisplayFromEvent(c),
    });
    renderPlan = buildCifraRenderPlan(chordOnlyBlocks, vocalTimedLines);
  }
  function remountCifraView() {
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
    if (cifra && typeof cifra.clear === "function") cifra.clear();
    else cifraContainer.innerHTML = "";
    cifra = null;
  }
  function syncAutoScrollButtonUi() {
    if (!autoScrollBtn) return;
    autoScrollBtn.dataset.on = autoScrollEnabled ? "true" : "false";
    autoScrollBtn.setAttribute("aria-checked", autoScrollEnabled ? "true" : "false");
  }
  function applyTimeBasedScroll(t) {
    const root = pickScrollContainer();
    if (!root) return;
    const dur = getDurationWithFallback();
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const tEff = dur > 0 ? clamp(t + lead, 0, dur) : 0;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    if (maxScroll <= 0) return;
    const y = clamp((tEff / dur) * maxScroll, 0, maxScroll);
    if (Math.abs(y - lastTimeBasedScrollTop) < 0.2 && timeScrollRafId) return;
    requestTimeBasedScrollTo(y);
  }
  function applySmartScroll(container, t) {
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const durationMs = autoScrollDurEl ? Number(autoScrollDurEl.value) : DEFAULT_AUTO_SCROLL_DURATION_MS;
    const el = resolveCifraScrollTarget(container, t, lead, payload.chords || [], payload.chordTimeOffsetSec ?? 0);
    if (!(el instanceof HTMLElement) || el === lastAutoScrollTarget) return;
    lastAutoScrollTarget = el;
    smoothScrollToElement(el, Number.isFinite(durationMs) ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS, SMART_SCROLL_VIEWPORT_ANCHOR);
  }
  function applyAutoScroll(container, t) {
    if (!autoScrollEnabled || performance.now() < userScrollPauseUntilMs) return;
    if (isSmartScrollMode()) applySmartScroll(container, t);
    else applyTimeBasedScroll(t);
  }
  function ensureCifraMounted() {
    if (cifra) return cifra;
    cifra = mountCifraView({
      container: cifraContainer,
      renderPlan,
      sectionsSorted,
      chordGridStartAudioTime: chordTimeline.gridStartAudioTime,
      getChordLabelAtAudioTime: (mid) => chordForDisplayFromEvent(chordTimeline.atAudioTime(mid)),
      formatChordEvent: (c) => chordForDisplayFromEvent(c),
      chords: payload.chords || [],
      chordTimeOffsetSec: payload.chordTimeOffsetSec ?? 0,
      showSectionBars: true,
      showAllChordPositions: true,
      slotIdsInLyricOrder: payload.slotIdsInLyricOrder,
      chordAnchorsBySlotId: payload.chordAnchorsBySlotId,
      chordDiagramScopeKey,
    });
    return cifra;
  }
  function ensureFloatingChordBadge() {
    if (floatingChordRoot) return;
    const root = document.createElement("div");
    root.className =
      "fixed left-4 top-20 z-30 inline-flex min-w-[120px] touch-none select-none flex-col items-center justify-center rounded-xl border border-cifra-teal/45 bg-[#0b1520]/95 px-3 py-2 pr-8 text-center shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur";
    root.style.cursor = "grab";
    root.style.userSelect = "none";
    root.style.position = "fixed";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-label", "Acorde no tempo");

    const title = document.createElement("span");
    title.className = "mb-0.5 w-full text-center font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-cifra-muted";
    title.textContent = "Acorde no tempo";
    root.appendChild(title);

    const label = document.createElement("span");
    label.className = "w-full text-center font-mono text-base font-semibold tabular-nums text-cifra-teal";
    label.textContent = "—";
    root.appendChild(label);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className =
      "absolute right-1.5 top-1.5 inline-flex size-5 items-center justify-center rounded-md text-[11px] font-semibold leading-none text-cifra-muted transition hover:bg-white/10 hover:text-cifra-text";
    closeBtn.setAttribute("aria-label", "Fechar acorde no tempo");
    closeBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7a1 1 0 0 0-1.41 1.42L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.88a1 1 0 0 0 0-1.41Z"/></svg>';
    root.appendChild(closeBtn);
    document.body.appendChild(root);

    let dragging = false;
    const persistFloatingChordPos = () => {
      const rect = root.getBoundingClientRect();
      lsSet(LS_FLOATING_CHORD_POS, JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
    };
    const restoreFloatingChordPos = () => {
      const raw = lsGet(LS_FLOATING_CHORD_POS);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown };
        const left = typeof parsed.left === "number" ? parsed.left : 16;
        const top = typeof parsed.top === "number" ? parsed.top : 80;
        const next = clampToViewport(left, top);
        root.style.left = `${Math.round(next.left)}px`;
        root.style.top = `${Math.round(next.top)}px`;
      } catch {
        // ignore invalid persisted position
      }
    };
    let offsetX = 0;
    let offsetY = 0;
    let pointerId: number | null = null;
    const getReservedRight = () => {
      if (window.matchMedia("(min-width: 1024px)").matches) return 320;
      return 340;
    };
    const clampToViewport = (left: number, top: number) => {
      const reservedRight = getReservedRight();
      const maxLeft = Math.max(8, window.innerWidth - reservedRight - root.offsetWidth - 8);
      const maxTop = Math.max(8, window.innerHeight - root.offsetHeight - 8);
      return {
        left: clamp(left, 8, maxLeft),
        top: clamp(top, 8, maxTop),
      };
    };
    const onPointerDown = (ev: PointerEvent) => {
      if (ev.target instanceof Element && ev.target.closest("button")) return;
      dragging = true;
      pointerId = ev.pointerId;
      const rect = root.getBoundingClientRect();
      offsetX = ev.clientX - rect.left;
      offsetY = ev.clientY - rect.top;
      root.style.cursor = "grabbing";
      root.setPointerCapture(ev.pointerId);
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!dragging || pointerId !== ev.pointerId) return;
      const next = clampToViewport(ev.clientX - offsetX, ev.clientY - offsetY);
      root.style.left = `${Math.round(next.left)}px`;
      root.style.top = `${Math.round(next.top)}px`;
    };
    const onPointerUp = (ev: PointerEvent) => {
      if (pointerId !== ev.pointerId) return;
      dragging = false;
      pointerId = null;
      root.style.cursor = "grab";
      root.releasePointerCapture(ev.pointerId);
      persistFloatingChordPos();
    };
    const onResize = () => {
      const rect = root.getBoundingClientRect();
      const next = clampToViewport(rect.left, rect.top);
      root.style.left = `${Math.round(next.left)}px`;
      root.style.top = `${Math.round(next.top)}px`;
      persistFloatingChordPos();
    };
    const onClose = () => {
      showFloatingChord = false;
      if (showFloatingChordEl) showFloatingChordEl.checked = false;
      persistFloatingChordPref();
      syncFloatingChordVisibility();
    };
    const onClosePointerDown = (ev: PointerEvent) => {
      ev.stopPropagation();
    };
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerUp);
    closeBtn.addEventListener("pointerdown", onClosePointerDown);
    closeBtn.addEventListener("click", onClose);
    window.addEventListener("resize", onResize);

    floatingChordRoot = root;
    floatingChordLabel = label;
    restoreFloatingChordPos();
    syncFloatingChordVisibility();
    floatingChordDestroy = () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
      closeBtn.removeEventListener("pointerdown", onClosePointerDown);
      closeBtn.removeEventListener("click", onClose);
      window.removeEventListener("resize", onResize);
      root.remove();
      floatingChordRoot = null;
      floatingChordLabel = null;
      floatingChordDestroy = null;
    };
  }
  function tick() {
    const t = nowAudioTime();
    const dur = getDurationWithFallback();
    seek.value = dur ? String(Math.min(SEEK_SLIDER_STEPS, Math.round((t / dur) * SEEK_SLIDER_STEPS))) : "0";
    timeLabel.textContent = `${formatClock(t)} / ${formatClock(dur)}`;
    const chNow = chordTimeline.atAudioTime(t);
    const chordLabel = chordForDisplayFromEvent(chNow);
    currentChordEl.textContent = chordLabel;
    if (floatingChordLabel) floatingChordLabel.textContent = chordLabel || "—";
    currentChordEl.title = isNoChordEvent(chNow) ? "Sem acorde — fim da progressão harmónica." : "";
    currentChordEl.classList.toggle("text-cifra-muted", isNoChordEvent(chNow));
    currentChordEl.classList.toggle("text-cifra-teal", !isNoChordEvent(chNow));
    const sec = sectionAtTimestamp(sectionsSorted, t);
    currentSectionEl.textContent = sec ? sec.label : "—";
    currentSectionEl.title = sec ? `${formatClock(sec.start)} — ${formatClock(sec.end)}` : "";
    if (renderPlan.length) {
      ensureCifraMounted();
      applyCifraPlaybackHighlight(cifraContainer, t, payload.chords || [], payload.chordTimeOffsetSec ?? 0);
      applyAutoScroll(cifraContainer, t);
    }
    updateTransportUi();
  }

  initAutoScrollControls();
  initScrollModeRadios();
  initFloatingChordToggle();
  initAutoScrollEnabledPref();
  rebuildLayoutFromMode();
  playBtn.disabled = !renderPlan.length;
  seek.disabled = !renderPlan.length;
  if (renderPlan.length) ensureCifraMounted();
  tick();

  let disposed = false;
  playback
    .ready()
    .then(() => {
      if (disposed) return;
      playbackReady = true;
      tick();
    })
    .catch(() => {
      playbackReady = false;
      tick();
    });

  const onSeekInput = () => {
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
    const dur = getDurationWithFallback();
    const t = (Number(seek.value) / SEEK_SLIDER_STEPS) * dur;
    if (playbackReady) void playback.seek(t);
    virtualT = t;
    tick();
  };
  const onPlayClick = () => {
    if (playbackReady) {
      if (playback.isPlaying()) void playback.pause();
      else void playback.play();
      cancelVirtualPlayback();
      tick();
      return;
    }
    virtualPlaying = !virtualPlaying;
    if (virtualPlaying) {
      lastVirtualPerfMs = 0;
      virtualRafId = requestAnimationFrame(virtualStep);
    } else {
      cancelVirtualPlayback();
    }
    tick();
  };
  const onAutoBtn = () => {
    autoScrollEnabled = !autoScrollEnabled;
    persistAutoScrollEnabledPref();
    if (!autoScrollEnabled) {
      cancelSmoothScrolling();
      cancelTimeBasedScrollAnimation();
    } else {
      userScrollPauseUntilMs = 0;
    }
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
    syncAutoScrollButtonUi();
    tick();
  };
  const onScrollModeChange = () => {
    persistScrollMode();
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
    tick();
  };
  const onFloatingChordToggle = () => {
    showFloatingChord = Boolean(showFloatingChordEl?.checked);
    persistFloatingChordPref();
    syncFloatingChordVisibility();
  };
  const onUserScrollIntent = () => {
    if (performance.now() < programmaticScrollUntilMs) return;
    pauseAutoScrollByUser();
  };
  const onUserKeyScroll = (e) => {
    const k = e.key;
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"].includes(k)) onUserScrollIntent();
  };

  const tickInterval = window.setInterval(() => tick(), 120);
  ensureFloatingChordBadge();
  syncAutoScrollButtonUi();
  playBtn.addEventListener("click", onPlayClick);
  seek.addEventListener("input", onSeekInput);
  autoScrollBtn?.addEventListener("click", onAutoBtn);
  autoScrollLeadEl?.addEventListener("input", syncAutoScrollControlLabels);
  autoScrollLeadEl?.addEventListener("change", persistAutoScrollControls);
  autoScrollDurEl?.addEventListener("input", syncAutoScrollControlLabels);
  autoScrollDurEl?.addEventListener("change", persistAutoScrollControls);
  scrollModeAutomaticEl?.addEventListener("change", onScrollModeChange);
  scrollModeSmartEl?.addEventListener("change", onScrollModeChange);
  showFloatingChordEl?.addEventListener("change", onFloatingChordToggle);
  document.addEventListener("wheel", onUserScrollIntent, { passive: true });
  document.addEventListener("touchmove", onUserScrollIntent, { passive: true });
  document.addEventListener("keydown", onUserKeyScroll, { passive: true });
  document.addEventListener("scroll", onUserScrollIntent, true);

  return () => {
    disposed = true;
    window.clearInterval(tickInterval);
    playBtn.removeEventListener("click", onPlayClick);
    seek.removeEventListener("input", onSeekInput);
    autoScrollBtn?.removeEventListener("click", onAutoBtn);
    autoScrollLeadEl?.removeEventListener("input", syncAutoScrollControlLabels);
    autoScrollLeadEl?.removeEventListener("change", persistAutoScrollControls);
    autoScrollDurEl?.removeEventListener("input", syncAutoScrollControlLabels);
    autoScrollDurEl?.removeEventListener("change", persistAutoScrollControls);
    scrollModeAutomaticEl?.removeEventListener("change", onScrollModeChange);
    scrollModeSmartEl?.removeEventListener("change", onScrollModeChange);
    showFloatingChordEl?.removeEventListener("change", onFloatingChordToggle);
    floatingChordDestroy?.();
    document.removeEventListener("wheel", onUserScrollIntent);
    document.removeEventListener("touchmove", onUserScrollIntent);
    document.removeEventListener("keydown", onUserKeyScroll);
    document.removeEventListener("scroll", onUserScrollIntent, true);
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    cancelVirtualPlayback();
    playback.destroy();
    remountCifraView();
  };
}
