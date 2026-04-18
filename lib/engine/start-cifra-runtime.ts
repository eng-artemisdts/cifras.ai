// @ts-nocheck
/**
 * Runtime da cifra alinhado a `startMusicAiApp.ts` da POC: mount DOM, playback, destaque e auto-rolagem.
 * Sem capotraste nem sugestão automática de capo.
 */
import {
  applyCifraPlaybackHighlight,
  mountCifraView,
  resolveCifraSmartScrollTarget,
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
/** Rolagem «inteligente»: centrar o acorde activo no eixo vertical (POC usava ~0,38 com linha inteira; com célula usamos ~0,5). */
const SMART_SCROLL_VIEWPORT_ANCHOR = 0.5;

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
  /** Último `scrollTop` aplicado na rolagem automática (tempo → posição), para evitar trabalho redundante. */
  let lastTimeBasedScrollTop = -1;
  let scrollAnimGen = 0;

  function chordForDisplayFromEvent(c) {
    return formatChordLabel(c);
  }

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

  function smoothScrollToElement(el, durationMs, viewportAnchor) {
    scrollAnimGen += 1;
    const myGen = scrollAnimGen;
    const rect = el.getBoundingClientRect();
    const rootRect = scrollRoot.getBoundingClientRect();
    const elCenterY = rect.top - rootRect.top + scrollRoot.scrollTop + rect.height / 2;
    let targetY = elCenterY - scrollRoot.clientHeight * viewportAnchor;
    const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    targetY = clamp(targetY, 0, maxScroll);
    const startY = scrollRoot.scrollTop;
    const delta = targetY - startY;
    if (Math.abs(delta) < 2) return;
    const durRaw = Number(durationMs);
    const dur = Number.isFinite(durRaw) && durRaw >= 0 ? durRaw : DEFAULT_AUTO_SCROLL_DURATION_MS;
    if (dur <= 0) {
      scrollRoot.scrollTo({ top: targetY, behavior: "auto" });
      return;
    }
    const t0 = performance.now();
    function frame(now) {
      if (myGen !== scrollAnimGen) return;
      const u = Math.min(1, (now - t0) / dur);
      scrollRoot.scrollTop = startY + delta * easeInOutQuad(u);
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
    lastAutoScrollTarget = null;
    lastTimeBasedScrollTop = -1;
    cifra = null;
    cifraContainer.innerHTML = "";
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
    const dur = getEffectiveDuration(audio, audioReady, chordTimeline.lastChordEndAudioTime);
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const tEff = dur > 0 ? clamp(t + lead, 0, dur) : 0;
    const maxScroll = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    const targetTop = dur > 0 ? (tEff / dur) * maxScroll : 0;
    const y = clamp(targetTop, 0, maxScroll);
    if (Math.abs(y - lastTimeBasedScrollTop) < 0.75) return;
    lastTimeBasedScrollTop = y;
    scrollRoot.scrollTop = y;
  }

  /**
   * Rolagem inteligente: alinha o viewport ao nó do acorde activo (célula de track), como na POC,
   * com animação suave e duração configurável.
   */
  function applySmartScroll(container, t) {
    const leadSec = autoScrollLeadEl ? Number(autoScrollLeadEl.value) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const lead = Number.isFinite(leadSec) ? Math.max(0, leadSec) : DEFAULT_AUTO_SCROLL_LEAD_SEC;
    const durationMs = autoScrollDurEl ? Number(autoScrollDurEl.value) : DEFAULT_AUTO_SCROLL_DURATION_MS;
    const el = resolveCifraSmartScrollTarget(
      container,
      t,
      lead,
      payload.chords || [],
      payload.chordTimeOffsetSec ?? 0,
    );
    if (el && el !== lastAutoScrollTarget) {
      lastAutoScrollTarget = el;
      smoothScrollToElement(
        el,
        Number.isFinite(durationMs) ? durationMs : DEFAULT_AUTO_SCROLL_DURATION_MS,
        SMART_SCROLL_VIEWPORT_ANCHOR,
      );
    }
  }

  function applyAutoScroll(container, t) {
    if (!autoScrollEnabled) return;
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
    });
    return cifra;
  }

  function nowAudioTime() {
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
    if (wasVirtualPlaying) void audio.play().catch(() => { });
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
