// @ts-nocheck
/**
 * Runtime da cifra alinhado a `startMusicAiApp.ts` da POC: mount DOM, playback, destaque e auto-rolagem.
 * Sem capotraste nem sugestão automática de capo.
 */
import {
  applyCifraPlaybackHighlight,
  mountCifraView,
  resolveCifraScrollTarget,
} from "./cifra-view";
import { createChordTimeline, formatChordLabel, isNoChordEvent } from "./chord-timeline";
import { buildLyricModel } from "./lyric-timeline";
import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "./payload-read";

/** Payload já normalizado no servidor (`normalizeDemoPayload`); não voltar a expandir letras. */
function coalescePayload(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  return {
    chords: Array.isArray(p.chords) ? p.chords : [],
    lyrics: Array.isArray(p.lyrics) ? p.lyrics : [],
    sections: Array.isArray(p.sections) ? p.sections : [],
    meta: p.meta && typeof p.meta === "object" ? p.meta : {},
    chordTimeOffsetSec: Number.isFinite(p.chordTimeOffsetSec) ? p.chordTimeOffsetSec : 0,
    /** Cliente: âncoras = modelo do editor (ver `buildPreviewChordAnchors`). */
    slotIdsInLyricOrder: Array.isArray(p.slotIdsInLyricOrder) ? p.slotIdsInLyricOrder : null,
    chordAnchorsBySlotId:
      p.chordAnchorsBySlotId && typeof p.chordAnchorsBySlotId === "object" ? p.chordAnchorsBySlotId : null,
  };
}
import { sectionAtTimestamp } from "./section-timeline";
import {
  buildCifraRenderPlan,
  computeChordOnlyInstrumentalBlocks,
  renumberGlobalWordIndices,
} from "./section-layout";
import { DEFAULT_AUDIO_URL, SEEK_SLIDER_STEPS } from "./config";
import { formatClock, getEffectiveDuration } from "./time-format";

const LS_AUTO_SCROLL_LEAD = "cifra-ai:autoScrollLeadSec";
const LS_AUTO_SCROLL_DURATION_MS = "cifra-ai:autoScrollDurationMs";
const LS_SCROLL_MODE = "cifra-ai:scrollMode";
const DEFAULT_AUTO_SCROLL_LEAD_SEC = 0.4;
const DEFAULT_AUTO_SCROLL_DURATION_MS = 450;
/**
 * Rolagem «inteligente»: ancoragem vertical do alvo no viewport.
 * 0.38 = ligeiramente acima do meio (mesmo valor que a POC); mantém contexto visível abaixo
 * da linha actual sem colar ao topo.
 */
const SMART_SCROLL_VIEWPORT_ANCHOR = 0.38;
/** Tempo mínimo (ms) sem auto-scroll após gesto manual do utilizador. */
const USER_SCROLL_PAUSE_MS = 1400;

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

export type CifraRuntimeEls = {
  cifraContainer: HTMLElement;
  /** Contentor com `overflow: auto` onde a auto-rolagem actua (não é `window`). */
  scrollRoot: HTMLElement;
  audio: HTMLAudioElement;
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
  /** `value="automatic"` — rolagem linear com o tempo da faixa. */
  scrollModeAutomaticEl?: HTMLInputElement | null;
  /** `value="smart"` — centrar na célula do acorde em destaque (POC + `pickActiveChordTrackCell`). */
  scrollModeSmartEl?: HTMLInputElement | null;
};

export type StartCifraRuntimeOptions = {
  payloadInput: Record<string, unknown>;
  els: CifraRuntimeEls;
};

/**
 * @returns função para remover listeners e limpar a vista.
 */
export function startCifraRuntime(opts: StartCifraRuntimeOptions): () => void {
  const {
    cifraContainer,
    scrollRoot,
    audio,
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
    scrollModeAutomaticEl,
    scrollModeSmartEl,
  } = opts.els;

  const payload = coalescePayload(opts.payloadInput);
  const sectionsSorted = mergeConsecutiveDuplicateSectionLabels(sortSections(payload.sections));
  const chordTimeline = createChordTimeline(payload.chords, { offsetSec: payload.chordTimeOffsetSec });
  const { timedLines: rawTimedLines } = buildLyricModel(payload.lyrics);
  const meta = payload.meta;

  /**
   * Contentor que realmente rola verticalmente.
   *
   * Prioridade: o `scrollRoot` designado quando **puder rolar agora** (tem `overflow-y`
   * e `scrollHeight > clientHeight`). Caso contrário (layouts em que o `flex-1` do `scrollRoot`
   * não limita altura — ex.: mobile), sobe a árvore até encontrar um ancestral rolável; fallback
   * para `document.scrollingElement`. O último resultado é cacheado para estabilidade entre frames
   * (evita saltar entre contentores durante uma animação).
   *
   * Devolve `null` quando nada rola neste instante — chamadores devem nessa altura saltar
   * sem scroll (não aplicar `scrollTop` em elementos que não movem).
   *
   * @type {HTMLElement | null}
   */
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
    if (
      cachedScrollContainer instanceof HTMLElement &&
      cachedScrollContainer.isConnected &&
      canScrollNow(cachedScrollContainer)
    ) {
      return cachedScrollContainer;
    }
    /** @type {HTMLElement | null} */
    let node = scrollRoot.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
      if (canScrollNow(node)) {
        cachedScrollContainer = node;
        return node;
      }
      node = node.parentElement;
    }
    const se = document.scrollingElement instanceof HTMLElement ? document.scrollingElement : null;
    if (se && se.scrollHeight - se.clientHeight > 1) {
      cachedScrollContainer = se;
      return se;
    }
    return null;
  }

  let virtualT = 0;
  let audioReady = false;
  /** `true` após `loadedmetadata` com duração válida; `false` se o áudio falhar ou não for utilizável. */
  let audioUsable = false;
  let virtualPlaying = false;
  let virtualRafId = 0;
  let lastVirtualPerfMs = 0;
  let renderPlan = [];
  const showSectionBars = true;
  let cifra = null;
  let autoScrollEnabled = false;
  let lastAutoScrollTarget = null;
  let lastSmartSectionStart = null;
  /** Último `scrollTop` aplicado na rolagem automática (tempo → posição), para evitar trabalho redundante. */
  let lastTimeBasedScrollTop = -1;
  let scrollAnimGen = 0;
  /** RAF da rolagem automática (suavização contínua sem saltos/flicker). */
  let timeScrollRafId = 0;
  let timeScrollTargetY = -1;
  /** `true` quando o relógio virtual está a correr por causa da rolagem (sem áudio). */
  let autoScrollVirtualClock = false;
  /** Até quando o auto-scroll deve ficar suspenso por intervenção manual. */
  let userScrollPauseUntilMs = 0;
  /** Janela curta para ignorar eventos de scroll gerados pelo próprio runtime. */
  let programmaticScrollUntilMs = 0;

  function chordForDisplayFromEvent(c) {
    return formatChordLabel(c);
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

  function markProgrammaticScroll() {
    programmaticScrollUntilMs = performance.now() + 120;
  }

  function pauseAutoScrollByUser(ms = USER_SCROLL_PAUSE_MS) {
    if (!autoScrollEnabled) return;
    userScrollPauseUntilMs = Math.max(userScrollPauseUntilMs, performance.now() + ms);
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
  }

  function cancelVirtualPlayback() {
    virtualPlaying = false;
    lastVirtualPerfMs = 0;
    autoScrollVirtualClock = false;
    if (virtualRafId) {
      cancelAnimationFrame(virtualRafId);
      virtualRafId = 0;
    }
  }

  function updateTransportUi() {
    const playing = (audioUsable && !audio.paused) || virtualPlaying;
    playBtn.textContent = playing ? "Pausa" : "Reproduzir";
  }

  function virtualStep(perfMs) {
    if (!virtualPlaying) return;
    if (!lastVirtualPerfMs) lastVirtualPerfMs = perfMs;
    const dt = (perfMs - lastVirtualPerfMs) / 1000;
    lastVirtualPerfMs = perfMs;
    const dur = getEffectiveDuration(audio, audioReady, chordTimeline.lastChordEndAudioTime);
    virtualT = Math.min(dur, Math.max(0, virtualT + dt));
    tick();
    if (virtualT >= dur - 0.001) {
      cancelVirtualPlayback();
      updateTransportUi();
      return;
    }
    virtualRafId = requestAnimationFrame(virtualStep);
  }

  function ensureSilentScrollClock() {
    if (!autoScrollEnabled) return;
    const canRunSilently = !audioUsable || audio.paused;
    if (!canRunSilently || virtualPlaying) return;
    if (audioUsable && Number.isFinite(audio.currentTime)) {
      virtualT = Math.max(0, Number(audio.currentTime));
    }
    autoScrollVirtualClock = true;
    virtualPlaying = true;
    lastVirtualPerfMs = 0;
    virtualRafId = requestAnimationFrame(virtualStep);
    updateTransportUi();
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
    const durRaw = Number(durationMs);
    const dur = Number.isFinite(durRaw) && durRaw >= 0 ? durRaw : DEFAULT_AUTO_SCROLL_DURATION_MS;
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
      /** Damping fixo dá sensação suave e sem tremor entre timeupdate/raf. */
      const alpha = 0.18;
      markProgrammaticScroll();
      root.scrollTop = curr + delta * alpha;
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

  function durationHintForChordGaps() {
    const fb = Math.max(
      chordTimeline.lastChordEndAudioTime,
      typeof meta?.duration_seconds === "number" ? meta.duration_seconds : 0,
      lyricMaxEndSec(rawTimedLines),
    );
    return getEffectiveDuration(audio, audioReady, fb);
  }

  function rebuildLayoutFromMode() {
    const vocalTimedLines = renumberGlobalWordIndices(rawTimedLines);
    const chordOnlyBlocks = computeChordOnlyInstrumentalBlocks({
      timedLines: rawTimedLines,
      chords: payload.chords || [],
      sectionsSorted,
      chordTimeOffsetSec: payload.chordTimeOffsetSec ?? 0,
      durationHintSec: durationHintForChordGaps(),
      formatChord: chordForDisplayFromEvent,
    });
    renderPlan = buildCifraRenderPlan(chordOnlyBlocks, vocalTimedLines);
  }

  function remountCifraView() {
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
    lastSmartSectionStart = null;
    lastTimeBasedScrollTop = -1;
    if (cifra && typeof cifra.clear === "function") {
      cifra.clear();
    } else {
      cifraContainer.innerHTML = "";
    }
    cifra = null;
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

  /**
   * Rolagem automática (tempo): posição vertical proporcional ao instante da faixa (teleprompter),
   * com antecipação opcional (`lead`) sobre o eixo do tempo.
   */
  function applyTimeBasedScroll(t) {
    const root = pickScrollContainer();
    if (!root) return;
    const dur = getEffectiveDuration(audio, audioReady, chordTimeline.lastChordEndAudioTime);
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const tEff = dur > 0 ? clamp(t + lead, 0, dur) : 0;
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    if (maxScroll <= 0) return;
    const targetTop = dur > 0 ? (tEff / dur) * maxScroll : 0;
    const y = clamp(targetTop, 0, maxScroll);
    if (Math.abs(y - lastTimeBasedScrollTop) < 0.2 && timeScrollRafId) return;
    requestTimeBasedScrollTo(y);
  }

  /**
   * Rolagem inteligente (paridade com a POC `startMusicAiApp.ts`):
   * - alvo = `.cifra-line` da célula de acorde em destaque (com antecipação opcional);
   * - só dispara scroll quando o alvo muda (sem recálculos de drift que podiam descentralizar);
   * - `smoothScrollToElement` usa sempre o `scrollRoot` designado via `pickScrollContainer`.
   */
  function applySmartScroll(container, t) {
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const durationMs = autoScrollDurEl ? Number(autoScrollDurEl.value) : DEFAULT_AUTO_SCROLL_DURATION_MS;
    const el = resolveCifraScrollTarget(
      container,
      t,
      lead,
      payload.chords || [],
      payload.chordTimeOffsetSec ?? 0,
    );
    if (!(el instanceof HTMLElement)) return;
    if (el === lastAutoScrollTarget) return;

    lastAutoScrollTarget = el;
    lastSmartSectionStart = null;
    smoothScrollToElement(
      el,
      Number.isFinite(durationMs) ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS,
      SMART_SCROLL_VIEWPORT_ANCHOR,
    );
  }

  function applyAutoScroll(container, t) {
    if (!autoScrollEnabled) return;
    if (performance.now() < userScrollPauseUntilMs) return;
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
      showSectionBars,
      showAllChordPositions: true,
      slotIdsInLyricOrder: payload.slotIdsInLyricOrder,
      chordAnchorsBySlotId: payload.chordAnchorsBySlotId,
    });
    return cifra;
  }

  function nowAudioTime() {
    if (virtualPlaying) return virtualT;
    if (audioUsable && audio.src) return audio.currentTime;
    return virtualT;
  }

  function tick() {
    const t = nowAudioTime();
    const dur = getEffectiveDuration(audio, audioReady, chordTimeline.lastChordEndAudioTime);
    seek.value = dur ? String(Math.min(SEEK_SLIDER_STEPS, Math.round((t / dur) * SEEK_SLIDER_STEPS))) : "0";
    timeLabel.textContent = `${formatClock(t)} / ${formatClock(dur)}`;
    const chNow = chordTimeline.atAudioTime(t);
    currentChordEl.textContent = chordForDisplayFromEvent(chNow);
    currentChordEl.title = isNoChordEvent(chNow)
      ? "Sem acorde — a análise marca aqui o fim da progressão harmónica (N)."
      : "";
    currentChordEl.classList.toggle("text-cifra-muted", isNoChordEvent(chNow));
    currentChordEl.classList.toggle("text-cifra-teal", !isNoChordEvent(chNow));
    const sec = sectionAtTimestamp(sectionsSorted, t);
    if (sec) {
      currentSectionEl.textContent = sec.label;
      currentSectionEl.title = `${formatClock(sec.start)} — ${formatClock(sec.end)}`;
    } else {
      currentSectionEl.textContent = "—";
      currentSectionEl.title = "";
    }
    if (renderPlan.length) {
      ensureCifraMounted();
      applyCifraPlaybackHighlight(
        cifraContainer,
        t,
        payload.chords || [],
        payload.chordTimeOffsetSec ?? 0,
      );
      applyAutoScroll(cifraContainer, t);
    }
  }

  const onTimeUpdate = () => tick();
  const onSeekInput = () => {
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
    const dur = getEffectiveDuration(audio, audioReady, chordTimeline.lastChordEndAudioTime);
    const t = (Number(seek.value) / SEEK_SLIDER_STEPS) * dur;
    if (audioUsable && audio.src) audio.currentTime = t;
    else virtualT = t;
    tick();
  };
  const onPlay = () => {
    cancelVirtualPlayback();
    updateTransportUi();
  };
  const onPause = () => {
    updateTransportUi();
    ensureSilentScrollClock();
  };
  const onEnded = () => {
    updateTransportUi();
    tick();
  };
  const onPlayClick = () => {
    if (audioUsable) {
      cancelVirtualPlayback();
      if (audio.paused) void audio.play().catch(() => { });
      else audio.pause();
    } else {
      virtualPlaying = !virtualPlaying;
      autoScrollVirtualClock = false;
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
    const wasAutoScrollVirtualClock = autoScrollVirtualClock;
    const tSync = virtualT;
    audioUsable = true;
    audioReady = true;
    cancelVirtualPlayback();
    try {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        audio.currentTime = Math.min(Math.max(0, tSync), d);
      }
    } catch {
      // ignore
    }
    rebuildLayoutFromMode();
    remountCifraView();
    ensureCifraMounted();
    tick();
    playBtn.disabled = false;
    updateTransportUi();
    if (wasVirtualPlaying && !wasAutoScrollVirtualClock) void audio.play().catch(() => { });
  };
  const onAudioError = () => {
    audioUsable = false;
    audioReady = false;
    cancelVirtualPlayback();
    playBtn.disabled = false;
    tick();
    updateTransportUi();
  };

  initAutoScrollControls();
  initScrollModeRadios();
  rebuildLayoutFromMode();
  playBtn.disabled = !renderPlan.length;
  seek.disabled = !renderPlan.length;
  if (renderPlan.length) {
    ensureCifraMounted();
    tick();
    updateTransportUi();
  }

  const audioUrlFromMeta = typeof meta?.audioUrl === "string" ? meta.audioUrl : "";
  audio.src = audioUrlFromMeta || DEFAULT_AUDIO_URL;
  audio.load();

  audio.addEventListener("loadedmetadata", onLoadedMetadata);
  audio.addEventListener("error", onAudioError);
  audio.addEventListener("timeupdate", onTimeUpdate);
  audio.addEventListener("play", onPlay);
  audio.addEventListener("pause", onPause);
  audio.addEventListener("ended", onEnded);
  playBtn.addEventListener("click", onPlayClick);
  seek.addEventListener("input", onSeekInput);

  /** @type {(() => void) | null} */
  let onAutoBtn = null;
  if (autoScrollBtn) {
    onAutoBtn = () => {
      autoScrollEnabled = !autoScrollEnabled;
      if (!autoScrollEnabled) {
        cancelSmoothScrolling();
        cancelTimeBasedScrollAnimation();
        if (virtualPlaying && (!audioUsable || audio.paused)) {
          cancelVirtualPlayback();
          updateTransportUi();
        }
      } else {
        userScrollPauseUntilMs = 0;
        lastSmartSectionStart = null;
        ensureSilentScrollClock();
      }
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
    cancelTimeBasedScrollAnimation();
    lastAutoScrollTarget = null;
    lastSmartSectionStart = null;
    lastTimeBasedScrollTop = -1;
    tick();
  };

  const onUserScrollIntent = () => {
    if (performance.now() < programmaticScrollUntilMs) return;
    pauseAutoScrollByUser();
  };
  const onUserWheel = () => onUserScrollIntent();
  const onUserTouchMove = () => onUserScrollIntent();
  const onUserKeyScroll = (e) => {
    const k = e.key;
    if (
      k === "ArrowDown" ||
      k === "ArrowUp" ||
      k === "PageDown" ||
      k === "PageUp" ||
      k === "Home" ||
      k === "End" ||
      k === " " ||
      k === "Spacebar"
    ) {
      onUserScrollIntent();
    }
  };
  const onScrollCapture = () => onUserScrollIntent();

  document.addEventListener("wheel", onUserWheel, { passive: true });
  document.addEventListener("touchmove", onUserTouchMove, { passive: true });
  document.addEventListener("keydown", onUserKeyScroll, { passive: true });
  document.addEventListener("scroll", onScrollCapture, true);
  if (scrollModeAutomaticEl) scrollModeAutomaticEl.addEventListener("change", onScrollModeChange);
  if (scrollModeSmartEl) scrollModeSmartEl.addEventListener("change", onScrollModeChange);

  return () => {
    document.removeEventListener("wheel", onUserWheel);
    document.removeEventListener("touchmove", onUserTouchMove);
    document.removeEventListener("keydown", onUserKeyScroll);
    document.removeEventListener("scroll", onScrollCapture, true);
    cancelSmoothScrolling();
    cancelTimeBasedScrollAnimation();
    cancelVirtualPlayback();
    audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    audio.removeEventListener("error", onAudioError);
    audio.removeEventListener("timeupdate", onTimeUpdate);
    audio.removeEventListener("play", onPlay);
    audio.removeEventListener("pause", onPause);
    audio.removeEventListener("ended", onEnded);
    playBtn.removeEventListener("click", onPlayClick);
    seek.removeEventListener("input", onSeekInput);
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
    remountCifraView();
  };
}
