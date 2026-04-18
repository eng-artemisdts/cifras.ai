// @ts-nocheck
/**
 * Renderização da cifra: blocos instrumentais (sem letra) + linhas vocais com acordes.
 * Colapsa acordes iguais consecutivos dentro da linha. Se o **mesmo** evento de acorde (`chordIdx`)
 * continua na linha seguinte, não repete o símbolo na 1.ª palavra e estende `playbackA1` na última
 * célula da linha anterior; dois eventos distintos no JSON com o mesmo rótulo mantêm-se ambos visíveis.
 *
 * @module cifra-view
 */

import { formatClock } from './time-format';
import {
  isInstrumentalSectionLabel,
  musicAiSectionEnvelopeForTime,
  vocalSectionHeaderForLyricTime
} from './section-layout';
import {
  chordEventIndexAtAudioTime,
  chordSegmentsInAudioWindow,
  collapseTrailingNoChordEvents,
  dropChordSegmentsOriginatingBeforeSection,
  formatChordLabel
} from './chord-timeline';
import { chordsHaveBeatGridMetadata, downbeatChordStartingInsideWordWindow } from './chord-bar-grid';
import { attachChordDiagramHoverDom } from '../cifra/chord-diagram/attach-chord-diagram-hover-dom';

/**
 * Se o cabeçalho da linha é uma secção vocal (Verse, Chorus, …) com `start` = S, só **anacruse**
 * curta antes de S usa o 1.º acorde depois de S. Caso contrário usa-se o meio-tempo da palavra.
 * Sem limiar de proximidade, letra cedo (ex. 13 s) com S no JSON à frente (ex. 44 s) fazia snap
 * em **todas** as palavras → um só acorde na linha; o «acorde no tempo» continuava certo.
 */
const CHORD_SNAP_AFTER_SECTION_START_SEC = 0.06;
/** Palavra ainda «antes do compasso» se o seu fim não passa do downbeat (tolerância ao alinhamento). */
const CHORD_SNAP_PICKUP_END_EPS_SEC = 0.12;
/** Só anacruse se o fim da palavra está a no máximo isto **antes** de S (evita confundir desvio Whisper/Music.AI com pickup). */
const CHORD_SNAP_MAX_LEAD_BEFORE_SECTION_SEC = 4;
/** Alinhar `sections.json` (Intro.end vs Verso.start) com pequenos desvios de tempo. */
const SECTION_BOUNDARY_DEDUPE_EPS_SEC = 0.15;
/**
 * Só deduplicar o 1.º acorde da linha vocal após instrumental se a 1.ª sílaba não começa logo a seguir
 * ao fim do bloco só-acordes (senão esconde o G# sustentado na entrada do verso).
 */
const SECTION_BOUNDARY_PENDING_DEDUPE_MIN_LYRIC_GAP_SEC = 0.35;

/**
 * Último rótulo de acorde visível nas células da grelha instrumental desde `fromIdx` (para dedupe na fronteira de secção).
 *
 * @param {StripChordCell[]} stripCells
 * @param {number} fromIdx
 * @param {(t: number) => string} getChordLabelAtAudioTime
 * @returns {string|null}
 */
function lastChordLabelInStripCellsSince(stripCells, fromIdx, getChordLabelAtAudioTime) {
  for (let i = stripCells.length - 1; i >= fromIdx; i--) {
    const c = stripCells[i];
    if (!c) continue;
    const a0 = Number(c.a0);
    const a1 = Number(c.a1);
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || a1 <= a0 + 1e-6) continue;
    const t = a0 + Math.min(0.02, (a1 - a0) * 0.25);
    const lab = getChordLabelAtAudioTime(t);
    if (lab != null && String(lab).trim() !== '' && lab !== '\u00A0') return lab;
  }
  return null;
}

/** Compara envelopes Music.AI (secção fundida) para fundir UI instrumental + letra. */
function envelopesMatch(
  /** @type {import('./musicai-types.ts').MusicAiSection|null|undefined} */ a,
  /** @type {import('./musicai-types.ts').MusicAiSection|null|undefined} */ b
) {
  if (!a || !b) return false;
  const la = String(a.label ?? '')
    .trim()
    .toLowerCase();
  const lb = String(b.label ?? '')
    .trim()
    .toLowerCase();
  return (
    la === lb &&
    Math.abs(Number(a.start) - Number(b.start)) < 1e-3 &&
    Math.abs(Number(a.end) - Number(b.end)) < 1e-3
  );
}

/**
 * @typedef {object} CifraSpan
 * @property {HTMLElement} wrap
 * @property {number} g
 */

/**
 * @typedef {object} StripChordCell
 * @property {HTMLElement} wrap
 * @property {number} a0
 * @property {number} a1
 */

/**
 * Grelha só de acordes (sem letra), mesmo visual das células da letra.
 *
 * @param {{ start: number, end: number, displayLabel: string }} iv
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} chordOffsetSec
 * @param {StripChordCell[]} stripCellsOut
 * @param {(c: import('./musicai-types.ts').MusicAiChordEvent) => string} formatChordEvent
 * @param {(el: HTMLElement, label: string) => void} [wireChordDiagram]
 */
function createInstrumentalChordStrip(
  iv,
  chords,
  chordOffsetSec,
  stripCellsOut,
  formatChordEvent,
  embeddedInSection,
  wireChordDiagram
) {
  const outer = document.createElement('div');
  outer.className = embeddedInSection ? 'mb-0' : 'mb-6';

  const segs = chordSegmentsInAudioWindow(chords, iv.start, iv.end, chordOffsetSec, {
    formatChord: formatChordEvent
  });
  const row = document.createElement('div');
  row.className = 'cifra-line flex flex-wrap items-end gap-x-3 gap-y-4';
  row.setAttribute('data-instrumental-strip', `${iv.start}-${iv.end}`);

  let prevLabel = /** @type {string|null} */ (null);
  for (const s of segs) {
    const showLabel = prevLabel === null || s.label !== prevLabel;
    prevLabel = s.label;

    const wrap = document.createElement('span');
    wrap.className =
      'inline-flex flex-col items-start gap-1 rounded-md px-1 py-0.5 transition-colors';

    const ch = document.createElement('span');
    ch.className =
      'cifra-chord__symbol inline-flex min-h-[1.125rem] items-end font-mono text-xs font-semibold text-auris-teal sm:text-sm';
    ch.textContent = showLabel ? s.label : '\u00A0';

    const tx = document.createElement('span');
    tx.className = 'min-h-[1.25rem] text-auris-ink';
    tx.textContent = '\u00A0';

    wrap.appendChild(ch);
    wrap.appendChild(tx);
    row.appendChild(wrap);
    stripCellsOut.push({ wrap, a0: s.a0, a1: s.a1 });
    if (showLabel) {
      wrap.dataset.playbackA0 = String(s.a0);
      wrap.dataset.playbackA1 = String(s.a1);
      wrap.dataset.chordIdx = String(s.chordIdx);
      wrap.classList.add('cifra-chord--track');
      if (typeof wireChordDiagram === 'function') wireChordDiagram(ch, s.label);
    }
  }

  outer.appendChild(row);
  return outer;
}

/**
 * @param {string} chordText
 * @param {string} lyricText
 * @param {number} g
 * @param {CifraSpan[]} spansOut
 * @param {{ a0: number, a1: number } | null | undefined} playbackWin — só se o acorde estiver visível (não `\u00A0`)
 * @param {number} [chordIdx] — índice na lista normalizada (`chord-timeline`); alinha highlight com «ACORDE NO TEMPO»
 * @param {(el: HTMLElement, label: string) => void} [wireChordDiagram] — pré-visualização svguitar ao hover
 * @returns {HTMLElement}
 */
function createLyricChordCell(chordText, lyricText, g, spansOut, playbackWin, chordIdx, wireChordDiagram) {
  const wrap = document.createElement('span');
  wrap.className =
    'inline-flex min-w-0 flex-col items-stretch justify-end gap-1 rounded-md px-1 py-0.5 transition-colors';
  wrap.dataset.g = String(g);

  const ch = document.createElement('span');
  ch.className =
    'cifra-chord__symbol inline-flex min-h-[1.125rem] w-full items-end justify-center font-mono text-xs font-semibold text-auris-teal sm:text-sm';
  ch.textContent = chordText;

  const tx = document.createElement('span');
  tx.className = 'text-auris-ink block w-full min-w-0 text-center text-[14px] font-medium leading-tight tracking-tight';
  tx.textContent = lyricText;

  wrap.appendChild(ch);
  wrap.appendChild(tx);
  spansOut.push({ wrap, g });

  const chordVisible = chordText !== '\u00A0' && String(chordText).trim() !== '';
  if (
    chordVisible &&
    playbackWin &&
    Number.isFinite(playbackWin.a0) &&
    Number.isFinite(playbackWin.a1) &&
    playbackWin.a1 > playbackWin.a0 + 1e-6
  ) {
    wrap.dataset.playbackA0 = String(playbackWin.a0);
    wrap.dataset.playbackA1 = String(playbackWin.a1);
    if (Number.isFinite(chordIdx)) {
      wrap.dataset.chordIdx = String(chordIdx);
    }
    wrap.classList.add('cifra-chord--track');
  }

  if (chordVisible && typeof wireChordDiagram === 'function') {
    wireChordDiagram(ch, chordText);
  }

  return wrap;
}

/**
 * Colapsa acordes iguais consecutivos (já em ordem temporal), preservando apenas
 * a primeira ocorrência de cada sequência contínua.
 *
 * @param {{ label: string, a0: number, a1: number, chordIdx?: number }[]} segs
 * @returns {{ label: string, a0: number, a1: number, chordIdx?: number }[]}
 */
function collapseSequentialEqualChordSegments(segs) {
  /** @type {{ label: string, a0: number, a1: number, chordIdx?: number }[]} */
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const last = out[out.length - 1];
    if (last && last.label === s.label) {
      last.a1 = Math.max(last.a1, s.a1);
      continue;
    }
    out.push({
      label: s.label,
      a0: s.a0,
      a1: s.a1,
      chordIdx: s.chordIdx
    });
  }
  return out;
}

/**
 * @param {object} params
 * @param {HTMLElement} params.container
 * @param {import('./section-layout.ts').CifraRenderEvent[]} params.renderPlan
 * @param {import('./musicai-types.ts').MusicAiSection[]} params.sectionsSorted
 * @param {number} params.chordGridStartAudioTime
 * @param {(midAudioSec: number) => string} params.getChordLabelAtAudioTime
 * @param {(c: import('./musicai-types.ts').MusicAiChordEvent) => string} [params.formatChordEvent] — rótulo por evento (ex. transposição com capo nas grelhas instrumentais)
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} [params.chords]
 * @param {number} [params.chordTimeOffsetSec]
 * @param {boolean} [params.showSectionBars=true] — só barras/cabeçalhos de parte; o snap de acorde por secção usa `sectionsSorted` sempre que houver dados
 * @param {boolean} [params.showAllChordPositions=false] — não colapsa acordes repetidos em linhas vocais
 * @param {boolean} [params.useChordBarAnchors] — se omitido, ativa com `start_bar/start_beat/end_bar/end_beat` completos; âncoras só por beat absoluto (`chord-bar-grid`)
 * @param {number} [params.beatsPerBar=4] — para conversão bar:beat → beat absoluto
 * @returns {{ spans: CifraSpan[], stripCells: StripChordCell[], clear: () => void, rebuild: () => void }}
 */
export function mountCifraView(params) {
  const {
    container,
    renderPlan,
    sectionsSorted,
    chordGridStartAudioTime,
    getChordLabelAtAudioTime,
    formatChordEvent = formatChordLabel,
    chords = [],
    chordTimeOffsetSec = 0,
    showSectionBars = true,
    showAllChordPositions = false,
    useChordBarAnchors: useChordBarAnchorsParam,
    beatsPerBar: beatsPerBarParam = 4,
    slotIdsInLyricOrder = null,
    chordAnchorsBySlotId = null,
  } = params;

  const beatsPerBar = Number.isFinite(beatsPerBarParam) && beatsPerBarParam >= 1 ? beatsPerBarParam : 4;

  const useChordBarAnchors =
    useChordBarAnchorsParam !== undefined ? useChordBarAnchorsParam : chordsHaveBeatGridMetadata(chords);

  /** @type {CifraSpan[]} */
  const spans = [];
  /** @type {StripChordCell[]} */
  const stripCells = [];

  /** @type {(() => void)[]} */
  const diagramHoverDisposers = [];

  /** Pré-visualização: diagrama svguitar ao hover no símbolo (mesma base que o editor). */
  function wireChordDiagramIfResolvable(chEl, labelRaw) {
    const lab = String(labelRaw ?? '')
      .trim()
      .replace(/\u00a0/g, '');
    if (!lab) return;
    const dispose = attachChordDiagramHoverDom(chEl, lab);
    diagramHoverDisposers.push(dispose);
  }

  function clear() {
    for (let i = 0; i < diagramHoverDisposers.length; i++) {
      try {
        diagramHoverDisposers[i]();
      } catch {
        // ignore
      }
    }
    diagramHoverDisposers.length = 0;
    container.innerHTML = '';
    spans.length = 0;
    stripCells.length = 0;
  }

  function build() {
    clear();
    const normalizedChords = collapseTrailingNoChordEvents(Array.isArray(chords) ? chords : []);
    /**
     * Janela temporal efetiva da palavra (mesma heurística usada no render da linha).
     * @param {any[]} words
     * @param {number} idx
     * @returns {{ start: number, end: number } | null}
     */
    const wordAudioWindow = (words, idx) => {
      const tw = words[idx];
      if (!tw || tw.start == null || !Number.isFinite(tw.start)) return null;
      const nextStart =
        idx + 1 < words.length && words[idx + 1].start != null && Number.isFinite(words[idx + 1].start)
          ? words[idx + 1].start
          : null;
      let upper =
        nextStart != null && Number.isFinite(nextStart) && nextStart > tw.start + 1e-4
          ? nextStart
          : tw.end != null && Number.isFinite(tw.end) && tw.end > tw.start + 1e-4
            ? tw.end
            : tw.start + 0.5;
      if (
        tw.end != null &&
        Number.isFinite(tw.end) &&
        tw.end > tw.start + 1e-4 &&
        upper > tw.end + 1e-6
      ) {
        upper = tw.end;
      }
      if (!Number.isFinite(upper) || upper <= tw.start + 1e-4) return null;
      return { start: Number(tw.start), end: Number(upper) };
    };
    /**
     * Índices de acorde por `TimedWord.g` (= índice na ordem da letra).
     * Preferência: mapa vindo do TypeScript (`buildPreviewChordAnchors`), **idêntico** ao editor.
     * Fallback: heurística local (payloads sem campo extra).
     * @type {Map<number, number[]>}
     */
    const anchoredChordIdxByG = new Map();
    const off = Number.isFinite(chordTimeOffsetSec) ? chordTimeOffsetSec : 0;

    const useEditorAnchors =
      Array.isArray(slotIdsInLyricOrder) &&
      slotIdsInLyricOrder.length > 0 &&
      chordAnchorsBySlotId &&
      typeof chordAnchorsBySlotId === 'object';

    if (useEditorAnchors) {
      for (let g = 0; g < slotIdsInLyricOrder.length; g++) {
        const sid = slotIdsInLyricOrder[g];
        const raw = chordAnchorsBySlotId[sid];
        if (!Array.isArray(raw) || raw.length === 0) continue;
        const sorted = [...raw].sort(
          (a, b) => Number(normalizedChords[a]?.start) - Number(normalizedChords[b]?.start),
        );
        anchoredChordIdxByG.set(g, sorted);
      }
    } else {
      /**
       * @type {{ w: any, start: number, end: number }[]}
       */
      const lyricWordAnchorIntervals = [];
      for (let i = 0; i < renderPlan.length; i++) {
        const ev = renderPlan[i];
        if (!ev || ev.kind !== 'lyric' || !Array.isArray(ev.line)) continue;
        for (let wi = 0; wi < ev.line.length; wi++) {
          const w = ev.line[wi];
          if (!w || w.start == null || !Number.isFinite(Number(w.start))) continue;
          const ws = Number(w.start);
          let we =
            w.end != null && Number.isFinite(Number(w.end)) && Number(w.end) > ws + 1e-6
              ? Number(w.end)
              : ws + Math.max(0.02, 1e-3);
          if (!(we > ws + 1e-6)) continue;
          lyricWordAnchorIntervals.push({ w, start: ws, end: we });
        }
      }
      lyricWordAnchorIntervals.sort((a, b) => a.w.g - b.w.g);

      for (let ci = 0; ci < normalizedChords.length; ci++) {
        const c = normalizedChords[ci];
        if (!c) continue;
        const cA0 = Number(c.start) + off;
        const cA1 = Number(c.end) + off;
        if (!Number.isFinite(cA0) || !Number.isFinite(cA1) || cA1 <= cA0 + 1e-6) continue;

        /** @type {{ ww: { w: any, start: number, end: number }, wi: number }[]} */
        const containing = [];
        for (let wi = 0; wi < lyricWordAnchorIntervals.length; wi++) {
          const ww = lyricWordAnchorIntervals[wi];
          if (cA0 >= ww.start && cA0 < ww.end) {
            containing.push({ ww, wi });
          }
        }

        /** @type {{ w: any, start: number, end: number } | null} */
        let target = null;
        if (containing.length) {
          let best = containing[0];
          let bestD = Math.abs(best.ww.start - cA0);
          let bestG = best.ww.w.g;
          for (let j = 1; j < containing.length; j++) {
            const cur = containing[j];
            const d = Math.abs(cur.ww.start - cA0);
            const gW = cur.ww.w.g;
            if (d < bestD - 1e-12 || (Math.abs(d - bestD) <= 1e-12 && gW < bestG)) {
              best = cur;
              bestD = d;
              bestG = gW;
            }
          }
          target = best.ww;
        } else {
          for (let wi = 0; wi < lyricWordAnchorIntervals.length; wi++) {
            const ww = lyricWordAnchorIntervals[wi];
            if (cA1 > ww.start && cA0 < ww.end) {
              target = ww;
              break;
            }
          }
        }

        if (target && Number.isFinite(target.w.g)) {
          const gKey = target.w.g;
          const arr = anchoredChordIdxByG.get(gKey) ?? [];
          arr.push(ci);
          anchoredChordIdxByG.set(gKey, arr);
        }
      }
      anchoredChordIdxByG.forEach((arr) => {
        arr.sort((a, b) => Number(normalizedChords[a]?.start) - Number(normalizedChords[b]?.start));
      });
    }
    /** @type {number|null} */
    let vocalShellKey = null;
    /** @type {HTMLElement|null} */
    let vocalShellInner = null;
    /** Último acorde vocal visível para dedupe no começo da linha seguinte. */
    let carryLyricChordLabel = /** @type {string|null} */ (null);
    /**
     * Após bloco instrumental, se a letra seguinte é noutra secção: não repetir na 1.ª linha vocal o último
     * acorde que já apareceu no fim da secção anterior (ex.: G na fronteira Intro → Verse).
     *
     * @type {{ label: string, boundarySecStart: number } | null}
     */
    let pendingSectionBoundaryChordDedupe = null;
    /**
     * Última célula vocal com símbolo de acorde visível na linha anterior (para não repetir o mesmo
     * `chordIdx` na 1.ª palavra da linha seguinte — um só objeto JSON atravessa a quebra de linha).
     * @type {{ wrap: HTMLElement, chordIdx: number } | null}
     */
    let prevLyricRowLastVisibleChord = null;

    for (let evIdx = 0; evIdx < renderPlan.length; evIdx++) {
      const ev = renderPlan[evIdx];
      if (ev.kind === 'instrumental') {
        carryLyricChordLabel = null;
        prevLyricRowLastVisibleChord = null;
        const instrumentalStripStartIdx = stripCells.length;
        const iv0 = ev.iv;
        const env0 =
          sectionsSorted.length > 0
            ? musicAiSectionEnvelopeForTime((iv0.start + iv0.end) / 2, sectionsSorted)
            : null;
        /** @type {{ start: number, end: number, displayLabel: string }[]} */
        const instGroup = [iv0];
        let nextIdx = evIdx + 1;
        while (nextIdx < renderPlan.length && renderPlan[nextIdx].kind === 'instrumental') {
          const ivn = renderPlan[nextIdx].iv;
          const envN =
            sectionsSorted.length > 0
              ? musicAiSectionEnvelopeForTime((ivn.start + ivn.end) / 2, sectionsSorted)
              : null;
          if (!envelopesMatch(env0, envN)) break;
          instGroup.push(ivn);
          nextIdx++;
        }

        let mergeLyricEnv = null;
        if (nextIdx < renderPlan.length && renderPlan[nextIdx].kind === 'lyric') {
          const ln = renderPlan[nextIdx].line;
          const fs = ln[0]?.start;
          if (sectionsSorted.length > 0 && fs != null && Number.isFinite(fs)) {
            mergeLyricEnv = musicAiSectionEnvelopeForTime(fs, sectionsSorted);
          }
        }
        const mergeIntoLyrics =
          env0 != null && mergeLyricEnv != null && envelopesMatch(env0, mergeLyricEnv);

        const lab0 = String(iv0.displayLabel ?? '').trim() || '—';
        const wantInstrumentalHeader =
          showSectionBars &&
          (sectionsSorted.length > 0 || lab0 === '—' || isInstrumentalSectionLabel(iv0.displayLabel));
        let secLike0 = { start: iv0.start, end: iv0.end, label: lab0 };
        if (sectionsSorted.length) {
          const e0 = musicAiSectionEnvelopeForTime((iv0.start + iv0.end) / 2, sectionsSorted);
          if (e0) {
            secLike0 = {
              start: e0.start,
              end: e0.end,
              label: String(e0.label ?? '').trim() || lab0
            };
          }
        }
        const wrapInstrumental = sectionsSorted.length > 0 || wantInstrumentalHeader;

        if (mergeIntoLyrics && wrapInstrumental) {
          const shell = createSectionShell(secLike0, wantInstrumentalHeader, formatClock);
          for (let g = 0; g < instGroup.length; g++) {
            shell.inner.appendChild(
              createInstrumentalChordStrip(
                instGroup[g],
                chords,
                chordTimeOffsetSec,
                stripCells,
                formatChordEvent,
                true,
                wireChordDiagramIfResolvable
              )
            );
          }
          container.appendChild(shell.wrap);
          vocalShellKey = secLike0.start;
          vocalShellInner = shell.inner;
          evIdx = nextIdx - 1;
          continue;
        }

        vocalShellKey = null;
        vocalShellInner = null;

        for (let g = 0; g < instGroup.length; g++) {
          const iv = instGroup[g];
          const lab = String(iv.displayLabel ?? '').trim() || '—';
          const wantHeader =
            showSectionBars &&
            (sectionsSorted.length > 0 || lab === '—' || isInstrumentalSectionLabel(iv.displayLabel));
          let secLike = { start: iv.start, end: iv.end, label: lab };
          if (sectionsSorted.length) {
            const env = musicAiSectionEnvelopeForTime((iv.start + iv.end) / 2, sectionsSorted);
            if (env) {
              secLike = {
                start: env.start,
                end: env.end,
                label: String(env.label ?? '').trim() || lab
              };
            }
          }
          const wrapInst = sectionsSorted.length > 0 || wantHeader;

          if (wrapInst) {
            const shell = createSectionShell(secLike, wantHeader, formatClock);
            shell.inner.appendChild(
              createInstrumentalChordStrip(
                iv,
                chords,
                chordTimeOffsetSec,
                stripCells,
                formatChordEvent,
                true,
                wireChordDiagramIfResolvable
              )
            );
            container.appendChild(shell.wrap);
          } else {
            container.appendChild(
              createInstrumentalChordStrip(
                iv,
                chords,
                chordTimeOffsetSec,
                stripCells,
                formatChordEvent,
                false,
                wireChordDiagramIfResolvable
              )
            );
          }
        }

        if (nextIdx < renderPlan.length && renderPlan[nextIdx].kind === 'lyric' && env0 && sectionsSorted.length) {
          const ln0 = renderPlan[nextIdx].line;
          const fs = ln0[0]?.start;
          let lyricEnv = null;
          if (fs != null && Number.isFinite(fs)) {
            lyricEnv = musicAiSectionEnvelopeForTime(fs, sectionsSorted);
          }
          const lastIv = instGroup[instGroup.length - 1];
          const ivEnd = lastIv != null ? Number(lastIv.end) : NaN;
          const handoffGap =
            fs != null && Number.isFinite(fs) && Number.isFinite(ivEnd) ? fs - ivEnd : Infinity;
          if (
            lyricEnv &&
            !envelopesMatch(env0, lyricEnv) &&
            handoffGap >= SECTION_BOUNDARY_PENDING_DEDUPE_MIN_LYRIC_GAP_SEC - 1e-3
          ) {
            const lastLab = lastChordLabelInStripCellsSince(
              stripCells,
              instrumentalStripStartIdx,
              getChordLabelAtAudioTime
            );
            if (lastLab != null && String(lastLab).trim() !== '') {
              pendingSectionBoundaryChordDedupe = {
                label: lastLab,
                /** Coincide com `sec.start` da 1.ª linha vocal (ex.: Verso); `env0.end` falha com hiato Intro/Verso. */
                boundarySecStart: Number(lyricEnv.start)
              };
            }
          }
        }

        evIdx = nextIdx - 1;
        continue;
      }

      const lineWords = ev.line;
      if (!lineWords.length) continue;

      const fw = lineWords[0];
      /** Cabeçalhos de parte só com `showSectionBars`; snap de acorde usa secções sempre que existirem no payload. */
      const sec =
        sectionsSorted.length && fw.start != null && Number.isFinite(fw.start)
          ? vocalSectionHeaderForLyricTime(fw.start, sectionsSorted)
          : null;

      if (sec && sec.start !== vocalShellKey) {
        carryLyricChordLabel = null;
        prevLyricRowLastVisibleChord = null;
      }

      const crossRowCarryFromPrev = prevLyricRowLastVisibleChord;

      const row = document.createElement('div');
      row.className = 'cifra-line flex flex-wrap items-end gap-x-3 gap-y-4';

      let rowPrevChordLabel = carryLyricChordLabel;
      let exactPrevRenderedLabel = /** @type {string|null} */ (null);
      if (
        pendingSectionBoundaryChordDedupe &&
        sec &&
        Number.isFinite(sec.start) &&
        Math.abs(sec.start - pendingSectionBoundaryChordDedupe.boundarySecStart) <= SECTION_BOUNDARY_DEDUPE_EPS_SEC &&
        fw.start != null &&
        Number.isFinite(fw.start) &&
        fw.start >= sec.start - SECTION_BOUNDARY_DEDUPE_EPS_SEC
      ) {
        exactPrevRenderedLabel = pendingSectionBoundaryChordDedupe.label;
      }
      lineWords.forEach((tw, idx) => {
        /** Início da sílaba: alinha com o «acorde no tempo» na entrada da palavra; o meio-tempo atrasa a troca (D→A) para dentro da sílaba seguinte. */
        let chordLookupT = chordGridStartAudioTime;
        if (tw.start != null && Number.isFinite(tw.start)) {
          chordLookupT = tw.start;
        } else if (tw.end != null && Number.isFinite(tw.end)) {
          chordLookupT = tw.end;
        }

        const leadBeforeSec =
          sec && Number.isFinite(sec.start) && tw.end != null && Number.isFinite(tw.end)
            ? sec.start - tw.end
            : Infinity;
        const isPickupSyllable =
          Boolean(
            sec &&
            !isInstrumentalSectionLabel(sec.label) &&
            Number.isFinite(sec.start) &&
            tw.start != null &&
            Number.isFinite(tw.start) &&
            tw.start < sec.start &&
            tw.end != null &&
            Number.isFinite(tw.end) &&
            tw.end <= sec.start + CHORD_SNAP_PICKUP_END_EPS_SEC &&
            leadBeforeSec >= -CHORD_SNAP_PICKUP_END_EPS_SEC &&
            leadBeforeSec <= CHORD_SNAP_MAX_LEAD_BEFORE_SECTION_SEC
          );
        if (isPickupSyllable) {
          chordLookupT = sec.start + CHORD_SNAP_AFTER_SECTION_START_SEC;
        }

        /**
         * A edição ancora acordes por sobreposição com a palavra (não pelo onset na secção).
         * Para manter preview = edição, não removemos segmentos só porque começaram antes da secção:
         * acordes sustentados (ex.: G# da intro até "Everywhere") devem continuar visíveis.
         */
        const applySectionOnsetFilter = false;
        const sectionStartForChords = sec && Number.isFinite(sec.start) ? Number(sec.start) : NaN;

        let label = getChordLabelAtAudioTime(chordLookupT);
        /** @type {{ label: string, a0: number, a1: number }[]} */
        let segs = [];
        const nextStart =
          idx + 1 < lineWords.length &&
            lineWords[idx + 1].start != null &&
            Number.isFinite(lineWords[idx + 1].start)
            ? lineWords[idx + 1].start
            : null;

        /** @type {number|null} */
        let wordT1 = null;
        if (tw.start != null && Number.isFinite(tw.start)) {
          let upper =
            nextStart != null && Number.isFinite(nextStart) && nextStart > tw.start + 1e-4
              ? nextStart
              : tw.end != null && Number.isFinite(tw.end) && tw.end > tw.start + 1e-4
                ? tw.end
                : tw.start + 0.5;
          /**
           * Se há hiato antes da palavra seguinte, não estender a janela [start, upper) por esse hiato:
           * senão `chordSegmentsInAudioWindow` inclui acordes do instrumental ou do verso seguinte nesta célula.
           * Palavras sobrepostas (nextStart antes do fim da palavra) mantêm upper = nextStart.
           */
          if (
            tw.end != null &&
            Number.isFinite(tw.end) &&
            tw.end > tw.start + 1e-4 &&
            upper > tw.end + 1e-6
          ) {
            upper = tw.end;
          }
          wordT1 = upper;
        }

        /**
         * Modo editor-anchors: mostrar **apenas** os acordes ancorados pela edição.
         * Palavra sem âncora = sem acorde (espelha a grelha do editor).
         */
        const anchoredIdxs = anchoredChordIdxByG.get(tw.g) ?? [];
        if (useEditorAnchors) {
          if (anchoredIdxs.length && tw.start != null && Number.isFinite(tw.start) && wordT1 != null) {
            const anchoredSegs = [];
            for (let ai = 0; ai < anchoredIdxs.length; ai++) {
              const chordIdx = anchoredIdxs[ai];
              const c = normalizedChords[chordIdx];
              if (!c) continue;
              const cA0 = Number(c.start) + off;
              const cA1 = Number(c.end) + off;
              const a0 = Math.max(Number(tw.start), cA0);
              const a1 = Math.min(Number(wordT1), cA1);
              if (Number.isFinite(a0) && Number.isFinite(a1) && a1 > a0 + 1e-6) {
                anchoredSegs.push({ a0, a1, label: formatChordEvent(c), chordIdx });
              } else {
                /** Fallback: acorde ancorado mas fora da janela útil; usar tempos originais do evento. */
                anchoredSegs.push({
                  a0: Math.max(Number(tw.start), cA0),
                  a1: Math.max(Number(tw.start) + 1e-4, cA0 + Math.max(1e-4, cA1 - cA0)),
                  label: formatChordEvent(c),
                  chordIdx,
                });
              }
            }
            if (anchoredSegs.length) {
              anchoredSegs.sort((a, b) => a.a0 - b.a0);
              segs = collapseSequentialEqualChordSegments(anchoredSegs);
              label = segs[0].label;
            }
          } else {
            segs = [];
            label = '\u00A0';
          }
        } else {
          if (wordT1 != null && wordT1 > tw.start + 1e-4) {
            const segsRaw = chordSegmentsInAudioWindow(chords, tw.start, wordT1, chordTimeOffsetSec, {
              formatChord: formatChordEvent
            });
            segs = collapseSequentialEqualChordSegments(segsRaw);
            segs = dropChordSegmentsOriginatingBeforeSection(
              segs,
              chords,
              chordTimeOffsetSec,
              sectionStartForChords,
              applySectionOnsetFilter
            );
          }

          if (anchoredIdxs.length && tw.start != null && Number.isFinite(tw.start) && wordT1 != null) {
            const anchoredSegs = [];
            for (let ai = 0; ai < anchoredIdxs.length; ai++) {
              const chordIdx = anchoredIdxs[ai];
              const c = normalizedChords[chordIdx];
              if (!c) continue;
              const cA0 = Number(c.start) + off;
              const cA1 = Number(c.end) + off;
              const a0 = Math.max(Number(tw.start), cA0);
              const a1 = Math.min(Number(wordT1), cA1);
              if (Number.isFinite(a0) && Number.isFinite(a1) && a1 > a0 + 1e-6) {
                anchoredSegs.push({ a0, a1, label: formatChordEvent(c), chordIdx });
              }
            }
            if (anchoredSegs.length) {
              anchoredSegs.sort((a, b) => a.a0 - b.a0);
              segs = collapseSequentialEqualChordSegments(anchoredSegs);
              label = segs[0].label;
            }
          }

          if (
            segs.length === 0 &&
            useChordBarAnchors &&
            tw.start != null &&
            Number.isFinite(tw.start) &&
            wordT1 != null &&
            wordT1 > tw.start + 1e-4
          ) {
            const db = downbeatChordStartingInsideWordWindow(
              tw.start,
              wordT1,
              chords,
              chordTimeOffsetSec,
              beatsPerBar
            );
            if (db) {
              const rawDb = chordSegmentsInAudioWindow(chords, db.onsetAudio, wordT1, chordTimeOffsetSec, {
                formatChord: formatChordEvent
              });
              let segsDb = collapseSequentialEqualChordSegments(rawDb);
              segsDb = dropChordSegmentsOriginatingBeforeSection(
                segsDb,
                chords,
                chordTimeOffsetSec,
                sectionStartForChords,
                applySectionOnsetFilter
              );
              if (segsDb.length) {
                segs = segsDb;
              }
            }
          }

          if (segs.length) {
            label = segs[0].label;
          }
          if (segs.length === 0 && Number.isFinite(chordLookupT)) {
            const rawFb = chordSegmentsInAudioWindow(chords, chordLookupT, chordLookupT + 4, chordTimeOffsetSec, {
              formatChord: formatChordEvent
            });
            let segsFb = collapseSequentialEqualChordSegments(rawFb);
            segsFb = dropChordSegmentsOriginatingBeforeSection(
              segsFb,
              chords,
              chordTimeOffsetSec,
              sectionStartForChords,
              applySectionOnsetFilter
            );
            if (segsFb.length) {
              /** Só o 1.º acorde da janela de fallback; não propagar troca para o futuro na mesma célula. */
              segs = [segsFb[0]];
              label = segs[0].label;
            }
          }

          if (!segs.length && applySectionOnsetFilter) {
            label = formatChordEvent(null);
          }
        }

        if (showAllChordPositions && exactPrevRenderedLabel != null && label === exactPrevRenderedLabel) {
          label = '\u00A0';
        }

        /** @type {{ label: string, a0: number, a1: number }[]} */
        let extraSegs = segs.length > 1 ? segs.slice(1) : [];
        if (extraSegs.length) {
          const deduped = [];
          let prev =
            showAllChordPositions && exactPrevRenderedLabel != null && label === '\u00A0'
              ? exactPrevRenderedLabel
              : label;
          for (let ii = 0; ii < extraSegs.length; ii++) {
            const seg = extraSegs[ii];
            if (seg.label === prev) continue;
            deduped.push(seg);
            prev = seg.label;
          }
          extraSegs = deduped;
        }



        let showChordLabel = true;
        if (!showAllChordPositions) {
          showChordLabel = rowPrevChordLabel === null || label !== rowPrevChordLabel;
        }

        const crossLineSameEventDup =
          idx === 0 &&
          crossRowCarryFromPrev != null &&
          segs.length > 0 &&
          Number.isFinite(segs[0].chordIdx) &&
          segs[0].chordIdx === crossRowCarryFromPrev.chordIdx;
        if (crossLineSameEventDup) {
          showChordLabel = false;
        }

        const chordDisplay = showChordLabel ? label : '\u00A0';
        const mainPlaybackWin =
          chordDisplay !== '\u00A0' && String(chordDisplay).trim() !== '' && segs.length
            ? { a0: segs[0].a0, a1: segs[0].a1 }
            : null;

        const mainChordIdx =
          segs.length && Number.isFinite(segs[0].chordIdx) ? segs[0].chordIdx : undefined;
        const wrap = createLyricChordCell(
          chordDisplay,
          tw.text,
          tw.g,
          spans,
          mainPlaybackWin,
          mainChordIdx,
          wireChordDiagramIfResolvable
        );
        row.appendChild(wrap);

        if (crossLineSameEventDup && crossRowCarryFromPrev != null && segs.length > 0) {
          const c = normalizedChords[segs[0].chordIdx];
          const cEnd = c != null ? Number(c.end) + off : NaN;
          const pw = crossRowCarryFromPrev.wrap;
          if (Number.isFinite(cEnd) && pw && pw.dataset && pw.dataset.playbackA1 != null) {
            const prevA1 = Number(pw.dataset.playbackA1);
            if (Number.isFinite(prevA1)) {
              pw.dataset.playbackA1 = String(Math.max(prevA1, cEnd));
            } else {
              pw.dataset.playbackA1 = String(cEnd);
            }
          }
        }

        if (
          chordDisplay !== '\u00A0' &&
          String(chordDisplay).trim() !== '' &&
          mainChordIdx != null &&
          Number.isFinite(mainChordIdx)
        ) {
          prevLyricRowLastVisibleChord = { wrap, chordIdx: mainChordIdx };
        }

        if (
          showAllChordPositions &&
          chordDisplay !== '\u00A0' &&
          String(chordDisplay).trim() !== '' &&
          label !== '\u00A0'
        ) {
          exactPrevRenderedLabel = label;
        }

        /** Acorde no instante desta palavra (comparação entre palavras; iguais ao modo «exato»). */
        rowPrevChordLabel = label;

        if (extraSegs.length) {
          for (let ii = 0; ii < extraSegs.length; ii++) {
            const seg = extraSegs[ii];
            if (showAllChordPositions && exactPrevRenderedLabel != null && seg.label === exactPrevRenderedLabel) {
              continue;
            }
            const ghost = createLyricChordCell(
              seg.label,
              '\u00A0',
              tw.g,
              spans,
              {
                a0: seg.a0,
                a1: seg.a1
              },
              Number.isFinite(seg.chordIdx) ? seg.chordIdx : undefined,
              wireChordDiagramIfResolvable
            );
            row.appendChild(ghost);
            if (showAllChordPositions) {
              exactPrevRenderedLabel = seg.label;
            }
            if (seg.label !== '\u00A0' && String(seg.label).trim() !== '' && Number.isFinite(seg.chordIdx)) {
              prevLyricRowLastVisibleChord = { wrap: ghost, chordIdx: seg.chordIdx };
            }
          }
        }
      });

      carryLyricChordLabel = rowPrevChordLabel;

      if (
        pendingSectionBoundaryChordDedupe &&
        sec &&
        Number.isFinite(sec.start) &&
        Math.abs(sec.start - pendingSectionBoundaryChordDedupe.boundarySecStart) <= SECTION_BOUNDARY_DEDUPE_EPS_SEC &&
        fw.start != null &&
        Number.isFinite(fw.start) &&
        fw.start >= sec.start - SECTION_BOUNDARY_DEDUPE_EPS_SEC
      ) {
        pendingSectionBoundaryChordDedupe = null;
      }

      if (sectionsSorted.length && sec && sec.start != null && Number.isFinite(sec.start)) {
        if (sec.start !== vocalShellKey) {
          const shell = createSectionShell(sec, showSectionBars, formatClock);
          container.appendChild(shell.wrap);
          vocalShellInner = shell.inner;
          vocalShellKey = sec.start;
        }
        vocalShellInner.appendChild(row);
      } else {
        vocalShellKey = null;
        vocalShellInner = null;
        container.appendChild(row);
      }
    }
  }

  build();
  return { spans, stripCells, clear, rebuild: build };
}

/**
 * Bloco de secção alinhado ao design (barra vertical 4px + coluna de conteúdo, gap 14px).
 *
 * @param {{ start: number, end: number, label: string }} sec
 * @param {boolean} showHeader
 * @param {(n: number) => string} fmt
 * @returns {{ wrap: HTMLElement, inner: HTMLElement }}
 */
function createSectionShell(sec, showHeader, fmt) {
  const wrap = document.createElement('div');
  wrap.className = 'cifra-section flex gap-3.5 items-stretch mb-6';
  wrap.setAttribute('data-section-start', String(sec.start));
  wrap.setAttribute('data-section-end', String(sec.end));

  const rail = document.createElement('div');
  rail.className =
    'cifra-section-rail w-1 shrink-0 self-stretch min-h-[2.5rem] rounded-sm bg-auris-teal/22 transition-[background-color,box-shadow] duration-200 ease-out';
  rail.setAttribute('aria-hidden', 'true');

  const inner = document.createElement('div');
  inner.className = 'cifra-section-inner flex min-w-0 flex-1 flex-col gap-3';

  if (showHeader) {
    const t1 = document.createElement('div');
    t1.className = 'font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-auris-teal';
    t1.textContent = sec.label || '—';

    const t2 = document.createElement('div');
    t2.className = 'mt-0.5 font-mono text-[10px] text-auris-muted tabular-nums';
    t2.textContent = `${fmt(sec.start)} — ${fmt(sec.end)}`;

    inner.appendChild(t1);
    inner.appendChild(t2);
  }

  wrap.appendChild(rail);
  wrap.appendChild(inner);
  return { wrap, inner };
}

const SECTION_TIME_EPS = 1e-3;
const CHORD_CELL_TIME_EPS = 1e-3;

/** Destaque só no nó `.cifra-chord__symbol` (não na linha da letra). */
const CHORD_PLAYBACK_ON = ['rounded-sm', 'ring-1', 'ring-auris-teal/60', 'bg-auris-teal/15', 'px-0.5'];

/** Classes na barra lateral (rail) — só ela muda no playback; sem fundo na caixa da letra. */
const RAIL_IDLE = ['bg-auris-teal/22'];
const RAIL_ACTIVE = ['bg-auris-teal', 'shadow-[0_0_14px_rgba(0,201,177,0.5)]'];

/**
 * Remove o destaque de acorde ativo (apenas no símbolo).
 *
 * @param {HTMLElement} container
 */
function clearChordPlaybackHighlight(container) {
  container.querySelectorAll('.cifra-chord--track .cifra-chord__symbol').forEach((node) => {
    const sym = /** @type {HTMLElement} */ (node);
    sym.classList.remove('cifra-chord--active');
    for (let i = 0; i < CHORD_PLAYBACK_ON.length; i++) {
      sym.classList.remove(CHORD_PLAYBACK_ON[i]);
    }
  });
}

/**
 * Célula `.cifra-chord--track` cuja janela [playbackA0, playbackA1) contém `tAudio`
 * (mesma regra que o destaque de reprodução).
 *
 * Várias células podem conter o mesmo `t` por sobreposição de janelas;
 * desempate: **maior `playbackA0`** (último onset entre as candidatas), depois janela mais estreita.
 * Antes prevalecia só a mais estreita, o que podia destacar uma célula «atrás» na linha (ex. apartment).
 *
 * @param {HTMLElement} container
 * @param {number} tAudio
 * @returns {HTMLElement | null}
 */
export function pickActiveChordTrackWrap(container, tAudio) {
  const eps = CHORD_CELL_TIME_EPS;
  /** @type {HTMLElement[]} */
  const hits = [];
  container.querySelectorAll('.cifra-chord--track').forEach((node) => {
    const el = /** @type {HTMLElement} */ (node);
    const a0 = Number(el.dataset.playbackA0);
    const a1 = Number(el.dataset.playbackA1);
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || a1 <= a0) return;
    if (tAudio >= a0 - eps && tAudio < a1) {
      hits.push(el);
    }
  });
  if (!hits.length) return null;
  hits.sort((x, y) => {
    const ax = Number(x.dataset.playbackA0);
    const ay = Number(y.dataset.playbackA0);
    if (Math.abs(ay - ax) > 1e-6) {
      return ay - ax;
    }
    const wx = Number(x.dataset.playbackA1) - ax;
    const wy = Number(y.dataset.playbackA1) - ay;
    return wx - wy;
  });
  return hits[0];
}

/**
 * @param {HTMLElement} container
 * @param {number} tAudio
 * @param {number} idx — índice na lista normalizada (`chordEventIndexAtAudioTime`)
 * @returns {HTMLElement | null}
 */
function pickCellForChordIndex(container, tAudio, idx) {
  const eps = CHORD_CELL_TIME_EPS;
  /** @type {HTMLElement[]} */
  const cells = [...container.querySelectorAll(`.cifra-chord--track[data-chord-idx="${idx}"]`)];
  if (!cells.length) return null;
  let bestInWin = null;
  let bestA0 = -Infinity;
  for (let i = 0; i < cells.length; i++) {
    const el = cells[i];
    const a0 = Number(el.dataset.playbackA0);
    const a1 = Number(el.dataset.playbackA1);
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || a1 <= a0) continue;
    if (tAudio >= a0 - eps && tAudio < a1) {
      if (a0 >= bestA0) {
        bestA0 = a0;
        bestInWin = el;
      }
    }
  }
  if (bestInWin) return bestInWin;
  bestA0 = -Infinity;
  let bestPast = null;
  for (let i = 0; i < cells.length; i++) {
    const el = cells[i];
    const a0 = Number(el.dataset.playbackA0);
    if (!Number.isFinite(a0)) continue;
    if (a0 <= tAudio + eps && a0 >= bestA0) {
      bestA0 = a0;
      bestPast = el;
    }
  }
  return bestPast;
}

/**
 * Célula a realçar: alinhada ao índice da timeline (como «ACORDE NO TEMPO») quando o DOM tem `data-chord-idx`.
 *
 * @param {HTMLElement} container
 * @param {number} tAudio
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]|null|undefined} [chords]
 * @param {number} [chordTimeOffsetSec]
 * @returns {HTMLElement | null}
 */
export function pickActiveChordTrackCell(container, tAudio, chords, chordTimeOffsetSec) {
  const useTimeline =
    Array.isArray(chords) &&
    chords.length > 0 &&
    container.querySelector('.cifra-chord--track[data-chord-idx]') != null;
  if (!useTimeline) {
    return pickActiveChordTrackWrap(container, tAudio);
  }
  const off = Number.isFinite(chordTimeOffsetSec) ? chordTimeOffsetSec : 0;
  const idx = chordEventIndexAtAudioTime(chords, tAudio, off);
  if (idx < 0) return null;
  const cell = pickCellForChordIndex(container, tAudio, idx);
  if (cell) return cell;
  return pickActiveChordTrackWrap(container, tAudio);
}

/**
 * Realça o **texto do acorde** em sync com a timeline quando `chords` + `data-chord-idx` estão disponíveis.
 *
 * @param {HTMLElement} container
 * @param {number} tAudio
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]|null|undefined} [chords]
 * @param {number} [chordTimeOffsetSec]
 */
export function highlightActiveChordCell(container, tAudio, chords, chordTimeOffsetSec) {
  clearChordPlaybackHighlight(container);
  const win = pickActiveChordTrackCell(container, tAudio, chords, chordTimeOffsetSec);
  if (!win) return;
  const sym = win.querySelector('.cifra-chord__symbol');
  if (!sym) return;
  const symEl = /** @type {HTMLElement} */ (sym);
  symEl.classList.add('cifra-chord--active');
  for (let i = 0; i < CHORD_PLAYBACK_ON.length; i++) {
    symEl.classList.add(CHORD_PLAYBACK_ON[i]);
  }
}

/**
 * Realça só a barra vertical da secção cuja janela [start,end) contém `tAudio` (layout tipo design Auris).
 *
 * @param {HTMLElement} container — habitualmente `#cifra`
 * @param {number} tAudio
 */
export function highlightActiveSectionBar(container, tAudio) {
  const sections = container.querySelectorAll('.cifra-section');
  sections.forEach((wrap) => {
    const s0 = Number(wrap.getAttribute('data-section-start'));
    const s1 = Number(wrap.getAttribute('data-section-end'));
    if (!Number.isFinite(s0) || !Number.isFinite(s1)) return;
    const on = tAudio >= s0 - SECTION_TIME_EPS && tAudio < s1 + SECTION_TIME_EPS;
    const rail = wrap.querySelector('.cifra-section-rail');
    if (!rail) return;
    for (let i = 0; i < RAIL_IDLE.length; i++) {
      rail.classList.toggle(RAIL_IDLE[i], !on);
    }
    for (let i = 0; i < RAIL_ACTIVE.length; i++) {
      rail.classList.toggle(RAIL_ACTIVE[i], on);
    }
  });
}

/**
 * Destaque de reprodução: barra lateral da secção ativa.
 *
 * @param {HTMLElement} container
 * @param {number} tAudio
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]|null|undefined} [chords]
 * @param {number} [chordTimeOffsetSec]
 */
export function applyCifraPlaybackHighlight(container, tAudio, chords, chordTimeOffsetSec) {
  highlightActiveSectionBar(container, tAudio);
  highlightActiveChordCell(container, tAudio, chords, chordTimeOffsetSec);
}

/**
 * Alvo do scroll automático: linha `.cifra-line` do acorde ativo (com antecipação opcional),
 * ou o bloco `.cifra-section` se não houver célula rastreada nesse instante.
 *
 * @param {HTMLElement} container
 * @param {number} tAudio
 * @param {number} [leadSec=0] — segundos no futuro: simula onde o destaque estará (scroll mais cedo).
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]|null|undefined} [chords]
 * @param {number} [chordTimeOffsetSec]
 * @returns {HTMLElement | null}
 */
export function resolveCifraScrollTarget(container, tAudio, leadSec = 0, chords, chordTimeOffsetSec) {
  const lead = typeof leadSec === 'number' && Number.isFinite(leadSec) ? Math.max(0, leadSec) : 0;
  const t = tAudio + lead;

  const track = pickActiveChordTrackCell(container, t, chords, chordTimeOffsetSec);
  if (track) {
    const line = track.closest('.cifra-line');
    if (line instanceof HTMLElement) return line;
  }

  const sections = container.querySelectorAll('.cifra-section');
  for (const wrap of sections) {
    const s0 = Number(wrap.getAttribute('data-section-start'));
    const s1 = Number(wrap.getAttribute('data-section-end'));
    if (!Number.isFinite(s0) || !Number.isFinite(s1)) continue;
    if (t >= s0 - SECTION_TIME_EPS && t < s1 + SECTION_TIME_EPS) {
      return /** @type {HTMLElement} */ (wrap);
    }
  }
  return null;
}

/**
 * Alvo da rolagem «inteligente»: centra na célula `.cifra-chord--track` do acorde activo (o mesmo nó do highlight);
 * se não houver célula, recai para {@link resolveCifraScrollTarget} (linha / secção).
 */
export function resolveCifraSmartScrollTarget(container, tAudio, leadSec = 0, chords, chordTimeOffsetSec) {
  const lead = typeof leadSec === 'number' && Number.isFinite(leadSec) ? Math.max(0, leadSec) : 0;
  const t = tAudio + lead;
  const cell = pickActiveChordTrackCell(container, t, chords, chordTimeOffsetSec);
  if (cell instanceof HTMLElement) return cell;
  return resolveCifraScrollTarget(container, tAudio, leadSec, chords, chordTimeOffsetSec);
}
