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
import { animate } from "framer-motion";
import {
  clearChordElement,
  drawChordIntoElement,
  resolveChordDiagram,
} from "@/lib/cifra/chord-diagram/svguitar-from-db";
import { transposeChordLabel } from "@/lib/cifra/chord-transpose";

const LS_AUTO_SCROLL_LEAD = "cifra-ai:autoScrollLeadSec";
const LS_AUTO_SCROLL_DURATION_MS = "cifra-ai:autoScrollDurationMs";
const LS_SCROLL_MODE = "cifra-ai:scrollMode";
const LS_AUTO_SCROLL_ENABLED = "cifra-ai:autoScrollEnabled";
const LS_SHOW_FLOATING_CHORD = "cifra-ai:showFloatingChord";
const LS_SHOW_CURRENT_CHORD_DIAGRAM = "cifra-ai:showCurrentChordDiagram";
const LS_FLOATING_CHORD_POS = "cifra-ai:floatingChordPos";
const DEFAULT_AUTO_SCROLL_LEAD_SEC = 0.4;
const DEFAULT_AUTO_SCROLL_DURATION_MS = 450;
/** Rolagem inteligente: centrar a linha activa (`.cifra-line`) no meio do painel de scroll. */
const SMART_SCROLL_VIEWPORT_ANCHOR = 0.5;
const SMART_SCROLL_ELEMENT_ALIGN = 0.5;
/** Ignora ruído sub-pixel; mesmo alvo precisa disto para voltar a animar após drift. */
const SMART_SCROLL_DEAD_ZONE_PX = 4;
const SMART_SCROLL_RECENTER_SAME_LINE_PX = 14;
const USER_SCROLL_INTERACTION_MS = 700;

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
  currentChordDiagramEl?: HTMLElement | null;
  autoScrollBtn: HTMLButtonElement | null;
  autoScrollLeadEl: HTMLInputElement | null;
  autoScrollLeadValEl: HTMLElement | null;
  autoScrollDurEl: HTMLInputElement | null;
  autoScrollDurValEl: HTMLElement | null;
  showFloatingChordEl?: HTMLInputElement | null;
  showCurrentChordDiagramEl?: HTMLInputElement | null;
  scrollModeAutomaticEl?: HTMLInputElement | null;
  scrollModeSmartEl?: HTMLInputElement | null;
};

export type StartCifraRuntimeOptions = {
  payloadInput: Record<string, unknown>;
  chordDiagramScopeKey?: string;
  transposeSemitones?: number;
  /**
   * Quando definido, o transpõe em tempo real (tom ± capo) lê-se deste ref,
   * evitando remontar o player só para actualizar acordes na folha.
   */
  transposeSemitonesLive?: { current: number };
  /**
   * O runtime atribui aqui um callback para reconstruir a cifra quando o transpõe mudar,
   * sem chamar `playback.destroy()` (crítico para o iframe embed do Spotify).
   */
  runtimeTransposeRefreshRef?: { current: (() => void) | null };
  /** Handler populado pelo runtime e acionado via eventos React no componente. */
  userScrollIntentHandlerRef?: { current: ((source?: "user" | "scroll") => void) | null };
  els: CifraRuntimeEls;
};

export function startCifraRuntimeV2(opts: StartCifraRuntimeOptions): () => void {
  const chordDiagramScopeKey = typeof opts.chordDiagramScopeKey === "string" ? opts.chordDiagramScopeKey : "";
  const staticTransposeSemitones = Number.isFinite(opts.transposeSemitones) ? Number(opts.transposeSemitones) : 0;
  const transposeLive = opts.transposeSemitonesLive;
  function getTransposeSemitones() {
    if (transposeLive && Number.isFinite(transposeLive.current)) return Number(transposeLive.current);
    return staticTransposeSemitones;
  }
  const userScrollIntentHandlerRef = opts.userScrollIntentHandlerRef;
  const {
    cifraContainer,
    scrollRoot,
    playback,
    playBtn,
    seek,
    timeLabel,
    currentSectionEl,
    currentChordEl,
    currentChordDiagramEl,
    autoScrollBtn,
    autoScrollLeadEl,
    autoScrollLeadValEl,
    autoScrollDurEl,
    autoScrollDurValEl,
    showFloatingChordEl,
    showCurrentChordDiagramEl,
    scrollModeAutomaticEl,
    scrollModeSmartEl,
  } = opts.els;

  const payload = coalescePayload(opts.payloadInput);
  const sectionsSorted = mergeConsecutiveDuplicateSectionLabels(sortSections(payload.sections));
  const chordTimeline = createChordTimeline(payload.chords, { offsetSec: payload.chordTimeOffsetSec });
  const { timedLines: rawTimedLines } = buildLyricModel(payload.lyrics);
  const meta = payload.meta;

  function chordForDisplayFromEvent(c) {
    return transposeChordLabel(formatChordLabel(c), getTransposeSemitones());
  }

  let cachedScrollContainer = null;
  /**
   * Contentor rolável principal: **sempre** o `scrollRoot` passado pela UI quando ligado ao DOM.
   * Não exigir `overflow-y` computado nem `scrollHeight > clientHeight` — isso falhava em alguns browsers /
   * primeiro paint e fazia cair no `document`, quebrando a rolagem inteligente ou empurrando a página inteira.
   */
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
    if (scrollRoot instanceof HTMLElement && scrollRoot.isConnected) {
      cachedScrollContainer = scrollRoot;
      return scrollRoot;
    }
    if (cachedScrollContainer instanceof HTMLElement && cachedScrollContainer.isConnected && canScrollNow(cachedScrollContainer)) {
      return cachedScrollContainer;
    }
    let node = scrollRoot?.parentElement ?? null;
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
  let smoothScrollAnimation: { stop: () => void } | null = null;
  let timeScrollAnimation: { stop: () => void } | null = null;
  let timeScrollTargetY = -1;
  let timeScrollUserOffsetPx = 0;
  let userInteractingUntilMs = 0;
  let programmaticScrollUntilMs = 0;
  let showFloatingChord = true;
  let floatingChordRoot: HTMLDivElement | null = null;
  let floatingChordLabel: HTMLSpanElement | null = null;
  let floatingChordDiagramEl: HTMLDivElement | null = null;
  let floatingChordDestroy: (() => void) | null = null;
  let lastRenderedChordLabel = "";
  let showCurrentChordDiagram = true;

  function normalizeChordLabelForDiagram(raw: string): string {
    return raw.replaceAll("♭", "b").replaceAll("♯", "#").trim();
  }

  function resolveCurrentChordDiagram(label: string) {
    const variants = Array.from(
      new Set([label, normalizeChordLabelForDiagram(label), label.replaceAll(/\s+/g, "")].filter(Boolean)),
    );
    for (const candidate of variants) {
      const resolved = resolveChordDiagram(candidate);
      if (resolved) return resolved;
    }
    return null;
  }
  function renderChordDiagramForLabel(label: string) {
    const targets: HTMLElement[] = [];
    if (currentChordDiagramEl) targets.push(currentChordDiagramEl);
    if (floatingChordDiagramEl) targets.push(floatingChordDiagramEl);
    if (!targets.length) return;
    if (!showCurrentChordDiagram || !label) {
      for (const target of targets) clearChordElement(target);
      return;
    }
    const resolved = resolveCurrentChordDiagram(label);
    for (const target of targets) {
      if (resolved) drawChordIntoElement(target, resolved);
      else clearChordElement(target);
    }
  }

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
    smoothScrollAnimation?.stop();
    smoothScrollAnimation = null;
  }
  function cancelTimeBasedScrollAnimation() {
    timeScrollAnimation?.stop();
    timeScrollAnimation = null;
    timeScrollTargetY = -1;
  }
  function pauseAutoScrollByUser() {
    if (!autoScrollEnabled) return;
    userInteractingUntilMs = performance.now() + USER_SCROLL_INTERACTION_MS;
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
  }
  function baseTimeBasedTargetY(root: HTMLElement, t: number): number {
    const dur = getDurationWithFallback();
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const tEff = dur > 0 ? clamp(t + lead, 0, dur) : 0;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    if (maxScroll <= 0 || dur <= 0) return 0;
    return clamp((tEff / dur) * maxScroll, 0, maxScroll);
  }
  /** Posição `scrollTop` que coloca o ponto (viewportAnchor × viewport, elementAlignRatio × altura do el) alinhado ao painel. */
  function computeScrollTopToAlignElement(el, viewportAnchor, elementAlignRatio = 0.5) {
    const pane = pickScrollContainer();
    if (!pane || !(el instanceof HTMLElement) || !el.isConnected) return null;
    const rect = el.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    const align = Number.isFinite(elementAlignRatio) ? clamp(elementAlignRatio, 0, 1) : 0.5;
    const anchor = Number.isFinite(viewportAnchor) ? clamp(viewportAnchor, 0, 1) : 0.5;
    const elTopInContent = rect.top - paneRect.top + pane.scrollTop;
    const elFocusY = elTopInContent + rect.height * align;
    let targetY = elFocusY - pane.clientHeight * anchor;
    const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
    targetY = clamp(targetY, 0, maxScroll);
    return { pane, targetY, delta: targetY - pane.scrollTop };
  }

  /** Framer Motion: anima só `scrollTop` do painel (sem `scrollTo` na window). */
  function animatePaneScrollTop(pane, targetTop, durationMs) {
    cancelSmoothScrolling();
    const startY = pane.scrollTop;
    const delta = targetTop - startY;
    if (Math.abs(delta) < 2) return;
    const dur = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS;
    if (dur <= 0) {
      markProgrammaticScroll();
      pane.scrollTop = targetTop;
      return;
    }
    smoothScrollAnimation = animate(startY, targetTop, {
      duration: dur / 1000,
      ease: "easeInOut",
      onUpdate: (latest) => {
        markProgrammaticScroll();
        pane.scrollTop = Number(latest);
      },
      onComplete: () => {
        smoothScrollAnimation = null;
      },
    });
  }

  function requestTimeBasedScrollTo(nextY) {
    timeScrollTargetY = Number(nextY);
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
    cancelTimeBasedScrollAnimation();
    timeScrollTargetY = Number(nextY);
    timeScrollAnimation = animate(curr, target, {
      duration: 0.22,
      ease: "linear",
      onUpdate: (latest) => {
        markProgrammaticScroll();
        root.scrollTop = Number(latest);
        lastTimeBasedScrollTop = root.scrollTop;
      },
      onComplete: () => {
        timeScrollAnimation = null;
        if (Math.abs(timeScrollTargetY - target) > 0.5) {
          requestTimeBasedScrollTo(timeScrollTargetY);
        }
      },
    });
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
    // Regra de UX: após reload, iniciar sempre com auto scroll desligado.
    autoScrollEnabled = false;
    lsSet(LS_AUTO_SCROLL_ENABLED, "0");
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
  function persistCurrentChordDiagramPref() {
    lsSet(LS_SHOW_CURRENT_CHORD_DIAGRAM, showCurrentChordDiagram ? "1" : "0");
  }
  function syncCurrentChordDiagramVisibility() {
    if (currentChordDiagramEl) {
      currentChordDiagramEl.style.display = showCurrentChordDiagram ? "flex" : "none";
      if (!showCurrentChordDiagram) clearChordElement(currentChordDiagramEl);
    }
    if (floatingChordDiagramEl) {
      floatingChordDiagramEl.style.display = showCurrentChordDiagram ? "flex" : "none";
      if (!showCurrentChordDiagram) clearChordElement(floatingChordDiagramEl);
    }
  }
  function initCurrentChordDiagramToggle() {
    const raw = lsGet(LS_SHOW_CURRENT_CHORD_DIAGRAM);
    showCurrentChordDiagram = raw == null ? true : raw !== "0";
    if (showCurrentChordDiagramEl) showCurrentChordDiagramEl.checked = showCurrentChordDiagram;
    syncCurrentChordDiagramVisibility();
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
    if (autoScrollBtn) {
      autoScrollBtn.dataset.on = autoScrollEnabled ? "true" : "false";
      autoScrollBtn.setAttribute("aria-checked", autoScrollEnabled ? "true" : "false");
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("cifra:auto-scroll-state", {
          detail: { enabled: autoScrollEnabled, smartScroll: isSmartScrollMode() },
        }),
      );
    }
  }
  function applyTimeBasedScroll(t) {
    const root = pickScrollContainer();
    if (!root) return;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    if (maxScroll <= 0) return;
    const baseY = baseTimeBasedTargetY(root, t);
    const y = clamp(baseY + timeScrollUserOffsetPx, 0, maxScroll);
    if (Math.abs(y - lastTimeBasedScrollTop) < 0.2 && timeScrollAnimation) return;
    requestTimeBasedScrollTo(y);
  }
  function applySmartScroll(container, t) {
    if (lastAutoScrollTarget && !lastAutoScrollTarget.isConnected) lastAutoScrollTarget = null;

    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const durationMs = autoScrollDurEl ? Number(autoScrollDurEl.value) : DEFAULT_AUTO_SCROLL_DURATION_MS;

    const targetEl = resolveCifraScrollTarget(
      container,
      t,
      lead,
      payload.chords || [],
      payload.chordTimeOffsetSec ?? 0,
    );
    if (!(targetEl instanceof HTMLElement) || !targetEl.isConnected) return;

    const computed = computeScrollTopToAlignElement(targetEl, SMART_SCROLL_VIEWPORT_ANCHOR, SMART_SCROLL_ELEMENT_ALIGN);
    if (!computed) return;

    const { pane, targetY, delta } = computed;
    const absD = Math.abs(delta);
    const sameTarget = targetEl === lastAutoScrollTarget;

    if (sameTarget && absD < SMART_SCROLL_RECENTER_SAME_LINE_PX) return;
    if (!sameTarget && absD < SMART_SCROLL_DEAD_ZONE_PX) {
      lastAutoScrollTarget = targetEl;
      return;
    }

    lastAutoScrollTarget = targetEl;
    animatePaneScrollTop(pane, targetY, Number.isFinite(durationMs) ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS);
  }
  function applyAutoScroll(container, t) {
    if (!autoScrollEnabled) return;
    if (performance.now() < userInteractingUntilMs) return;
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
      "fixed left-4 top-20 z-30 inline-flex min-w-[148px] touch-none select-none flex-col items-center justify-center rounded-2xl border border-cifra-teal/45 bg-gradient-to-b from-[#0f1b2a]/95 via-[#0b1422]/95 to-[#08101b]/95 px-3.5 py-2.5 pr-8 text-center shadow-[0_12px_34px_rgba(0,0,0,0.5)] backdrop-blur-md";
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

    const diagram = document.createElement("div");
    diagram.className =
      "mt-2 flex h-[90px] w-[90px] items-center justify-center rounded-xl border border-cifra-teal/30 bg-[#0a131f]/90 p-1 shadow-inner shadow-black/35";
    root.appendChild(diagram);

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
    floatingChordDiagramEl = diagram;
    restoreFloatingChordPos();
    syncFloatingChordVisibility();
    syncCurrentChordDiagramVisibility();
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
      floatingChordDiagramEl = null;
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
    if (chordLabel !== lastRenderedChordLabel) {
      renderChordDiagramForLabel(chordLabel || "");
      lastRenderedChordLabel = chordLabel || "";
    } else if (!showCurrentChordDiagram) {
      renderChordDiagramForLabel("");
    }
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

  function refreshChordRenderingForTranspose() {
    rebuildLayoutFromMode();
    remountCifraView();
    playBtn.disabled = !renderPlan.length;
    seek.disabled = !renderPlan.length;
    if (renderPlan.length) ensureCifraMounted();
    lastRenderedChordLabel = "";
    tick();
  }
  if (opts.runtimeTransposeRefreshRef) {
    opts.runtimeTransposeRefreshRef.current = refreshChordRenderingForTranspose;
  }

  initAutoScrollControls();
  initScrollModeRadios();
  initFloatingChordToggle();
  initCurrentChordDiagramToggle();
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
      const root = pickScrollContainer();
      if (root) {
        const t = nowAudioTime();
        const baseY = baseTimeBasedTargetY(root, t);
        timeScrollUserOffsetPx = root.scrollTop - baseY;
      }
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
    syncAutoScrollButtonUi();
  };
  const onFloatingChordToggle = () => {
    showFloatingChord = Boolean(showFloatingChordEl?.checked);
    persistFloatingChordPref();
    syncFloatingChordVisibility();
  };
  const onCurrentChordDiagramToggle = () => {
    showCurrentChordDiagram = Boolean(showCurrentChordDiagramEl?.checked);
    persistCurrentChordDiagramPref();
    syncCurrentChordDiagramVisibility();
    lastRenderedChordLabel = "";
    tick();
  };
  const onUserScrollIntent = (source: "user" | "scroll" = "scroll") => {
    // Scroll disparado por código (animação) não deve cancelar auto-scroll.
    if (source === "scroll" && performance.now() < programmaticScrollUntilMs) return;
    pauseAutoScrollByUser();
    const root = pickScrollContainer();
    if (!root) return;
    if (isSmartScrollMode()) return;
    const t = nowAudioTime();
    const baseY = baseTimeBasedTargetY(root, t);
    timeScrollUserOffsetPx = root.scrollTop - baseY;
  };

  const tickInterval = window.setInterval(() => tick(), 120);
  if (userScrollIntentHandlerRef) userScrollIntentHandlerRef.current = onUserScrollIntent;
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
  showCurrentChordDiagramEl?.addEventListener("change", onCurrentChordDiagramToggle);

  return () => {
    disposed = true;
    if (opts.runtimeTransposeRefreshRef) opts.runtimeTransposeRefreshRef.current = null;
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
    showCurrentChordDiagramEl?.removeEventListener("change", onCurrentChordDiagramToggle);
    floatingChordDestroy?.();
    if (userScrollIntentHandlerRef) userScrollIntentHandlerRef.current = null;
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    cancelVirtualPlayback();
    playback.destroy();
    remountCifraView();
  };
}
