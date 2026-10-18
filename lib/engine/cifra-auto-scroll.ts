// @ts-nocheck
import { resolveCifraScrollTarget } from "./cifra-view";

const USER_SCROLL_PAUSE_MS = 700;
const SMART_SCROLL_VIEWPORT_ANCHOR = 0.5;
const SMART_SCROLL_ELEMENT_ALIGN = 0.5;
const DEFAULT_DURATION_MS = 450;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function easeInOutQuad(u: number) {
  return u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
}

export type CifraAutoScrollControllerOptions = {
  scrollRoot: HTMLElement;
  getDuration: () => number;
  getNowTime: () => number;
  getLeadSec: () => number;
  getScrollDurationMs: () => number;
  getChords: () => unknown[];
  getChordTimeOffsetSec: () => number;
  isSmartMode: () => boolean;
};

export type CifraAutoScrollController = {
  setEnabled: (enabled: boolean) => void;
  tick: (cifraContainer: HTMLElement, t: number) => void;
  onUserIntent: (source?: "user" | "scroll") => void;
  cancelAll: () => void;
  resetTargets: () => void;
};

/**
 * Motor de rolagem automática (tempo proporcional) e inteligente (alinha à linha em destaque).
 * Usa sempre o `scrollRoot` designado e anima no `tick` do runtime (sem `requestAnimationFrame`),
 * para funcionar mesmo quando o painel do browser está em segundo plano.
 */
export function createCifraAutoScrollController(
  opts: CifraAutoScrollControllerOptions,
): CifraAutoScrollController {
  const { scrollRoot, getDuration, getNowTime, getLeadSec, getScrollDurationMs, getChords, getChordTimeOffsetSec, isSmartMode } =
    opts;

  let enabled = false;
  let userPauseUntilMs = 0;
  let programmaticUntilMs = 0;
  let lastAutoScrollTarget: HTMLElement | null = null;
  let lastTimeBasedScrollTop = -1;
  let smoothAnim: { startY: number; targetY: number; startMs: number; durationMs: number } | null = null;
  /** Desvio manual do utilizador em relação à posição «teleprompter» (só modo automático). */
  let timeScrollUserOffsetPx = 0;

  function getPane(): HTMLElement | null {
    return scrollRoot.isConnected ? scrollRoot : null;
  }

  function markProgrammatic(ms = 120) {
    programmaticUntilMs = Math.max(programmaticUntilMs, performance.now() + ms);
  }

  function isAnimating() {
    return smoothAnim != null;
  }

  function cancelSmooth() {
    smoothAnim = null;
  }

  function cancelAll() {
    cancelSmooth();
  }

  function resetTargets() {
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
  }

  function pauseByUser() {
    if (!enabled) return;
    userPauseUntilMs = performance.now() + USER_SCROLL_PAUSE_MS;
    cancelAll();
    resetTargets();
  }

  function scrollTopToAlign(
    pane: HTMLElement,
    el: HTMLElement,
    viewportAnchor: number,
    elementAlign: number,
  ): number {
    const paneRect = pane.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const elTopInContent = elRect.top - paneRect.top + pane.scrollTop;
    const align = clamp(elementAlign, 0, 1);
    const anchor = clamp(viewportAnchor, 0, 1);
    const elFocusY = elTopInContent + elRect.height * align;
    const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
    return clamp(elFocusY - pane.clientHeight * anchor, 0, maxScroll);
  }

  function startSmoothScrollTo(targetY: number, durationMs: number) {
    const pane = getPane();
    if (!pane) return;

    const startY = pane.scrollTop;
    const delta = targetY - startY;
    if (Math.abs(delta) < 2) return;

    const dur = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : DEFAULT_DURATION_MS;
    if (dur <= 0) {
      markProgrammatic(80);
      pane.scrollTop = targetY;
      return;
    }

    smoothAnim = { startY, targetY, startMs: performance.now(), durationMs: dur };
    markProgrammatic(dur + 80);
  }

  function advanceSmoothAnim() {
    if (!smoothAnim) return;
    const pane = getPane();
    if (!pane) {
      smoothAnim = null;
      return;
    }

    const { startY, targetY, startMs, durationMs } = smoothAnim;
    const u = Math.min(1, (performance.now() - startMs) / durationMs);
    markProgrammatic(80);
    pane.scrollTop = startY + (targetY - startY) * easeInOutQuad(u);
    if (u >= 1) smoothAnim = null;
  }

  function baseTimeScrollTop(pane: HTMLElement, t: number): number {
    const dur = getDuration();
    const lead = getLeadSec();
    const tEff = dur > 0 ? clamp(t + lead, 0, dur) : 0;
    const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
    if (maxScroll <= 0 || dur <= 0) return 0;
    return clamp((tEff / dur) * maxScroll, 0, maxScroll);
  }

  function syncUserOffsetFromPane() {
    const pane = getPane();
    if (!pane || isSmartMode()) return;
    timeScrollUserOffsetPx = pane.scrollTop - baseTimeScrollTop(pane, getNowTime());
  }

  function applyTimeBased(t: number) {
    const pane = getPane();
    if (!pane) return;

    const maxScroll = Math.max(0, pane.scrollHeight - pane.clientHeight);
    if (maxScroll <= 0) return;

    const y = clamp(baseTimeScrollTop(pane, t) + timeScrollUserOffsetPx, 0, maxScroll);
    const curr = pane.scrollTop;
    const delta = y - curr;

    if (Math.abs(delta) <= 0.5) {
      if (pane.scrollTop !== y) {
        markProgrammatic(80);
        pane.scrollTop = y;
      }
      lastTimeBasedScrollTop = y;
      return;
    }

    markProgrammatic(32);
    pane.scrollTop = curr + delta * 0.18;
    lastTimeBasedScrollTop = pane.scrollTop;
  }

  function applySmart(container: HTMLElement, t: number) {
    if (lastAutoScrollTarget && !lastAutoScrollTarget.isConnected) {
      lastAutoScrollTarget = null;
    }

    const el = resolveCifraScrollTarget(
      container,
      t,
      getLeadSec(),
      getChords(),
      getChordTimeOffsetSec(),
    );
    if (!(el instanceof HTMLElement) || !el.isConnected) return;
    if (el === lastAutoScrollTarget) return;

    lastAutoScrollTarget = el;
    const pane = getPane();
    if (!pane) return;
    const targetY = scrollTopToAlign(pane, el, SMART_SCROLL_VIEWPORT_ANCHOR, SMART_SCROLL_ELEMENT_ALIGN);
    startSmoothScrollTo(targetY, getScrollDurationMs());
  }

  return {
    setEnabled(nextEnabled: boolean) {
      enabled = nextEnabled;
      if (!nextEnabled) {
        cancelAll();
        return;
      }
      userPauseUntilMs = 0;
      syncUserOffsetFromPane();
      resetTargets();
    },

    tick(cifraContainer: HTMLElement, t: number) {
      advanceSmoothAnim();
      if (!enabled) return;
      if (performance.now() < userPauseUntilMs) return;
      if (isSmartMode()) applySmart(cifraContainer, t);
      else applyTimeBased(t);
    },

    onUserIntent(source: "user" | "scroll" = "scroll") {
      if (source === "scroll" && performance.now() < programmaticUntilMs) return;
      if (source === "scroll" && isAnimating()) return;
      pauseByUser();
      syncUserOffsetFromPane();
    },

    cancelAll,
    resetTargets,
  };
}
