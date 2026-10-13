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
  sectionDisplayLabelKey,
  vocalSectionHeaderForLyricTime
} from './section-layout';
import {
  chordEventIndexAtAudioTime,
  chordSegmentsInAudioWindow,
  collapseTrailingNoChordEvents,
  formatChordLabel
} from './chord-timeline';
import { placeChordsOnWords } from '../cifra/chord-placement';
import { estimateBeatSec } from '../cifra/beat-grid';
import { sectionDisplayName } from '../cifra/section-labels';
import { attachChordDiagramHoverDom } from '../cifra/chord-diagram/attach-chord-diagram-hover-dom';

/**
 * Último acorde visível da grelha instrumental desde `fromIdx`.
 *
 * @param {StripChordCell[]} stripCells
 * @param {number} fromIdx
 * @param {(t: number) => string} getChordLabelAtAudioTime
 * @returns {{ label: string, chordIdx: number|null } | null}
 */
function lastVisibleChordInStripCellsSince(stripCells, fromIdx, getChordLabelAtAudioTime) {
  for (let i = stripCells.length - 1; i >= fromIdx; i--) {
    const c = stripCells[i];
    if (!c) continue;
    const a0 = Number(c.a0);
    const a1 = Number(c.a1);
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || a1 <= a0 + 1e-6) continue;
    const t = a0 + Math.min(0.02, (a1 - a0) * 0.25);
    const lab = getChordLabelAtAudioTime(t);
    if (lab == null || String(lab).trim() === '' || lab === '\u00A0') continue;
    const rawIdx = c.wrap?.dataset?.chordIdx;
    const parsedIdx = rawIdx != null ? Number(rawIdx) : NaN;
    return {
      label: String(lab),
      chordIdx: Number.isFinite(parsedIdx) ? parsedIdx : null
    };
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
  wireChordDiagram,
  allowedChordIdxs
) {
  const outer = document.createElement('div');
  outer.className = embeddedInSection ? 'mb-0' : 'mb-6';

  const off = Number.isFinite(chordOffsetSec) ? Number(chordOffsetSec) : 0;
  /**
   * Acordes que começam antes do bloco são descartados (mesma regra do editor: o acorde aparece
   * só na secção onde o `start` cai, sem transpassar para a seguinte).
   */
  const segs = chordSegmentsInAudioWindow(chords, iv.start, iv.end, chordOffsetSec, {
    formatChord: formatChordEvent
  }).filter((s) => {
    const c = chords[s.chordIdx];
    if (!c) return false;
    const cA0 = Number(c.start) + off;
    if (allowedChordIdxs && !allowedChordIdxs.has(s.chordIdx)) return false;
    return Number.isFinite(cA0) && cA0 >= Number(iv.start) - 1e-3;
  });
  if (!segs.length) return null;
  const row = document.createElement('div');
  row.className = 'cifra-line flex flex-wrap items-end gap-x-3 gap-y-4';
  row.setAttribute('data-instrumental-strip', `${iv.start}-${iv.end}`);

  /** Acordes visíveis (sem reescrever o mesmo acorde seguido) e o compasso em que começam. */
  const normalized = collapseTrailingNoChordEvents(chords);
  /** @type {(typeof segs[number] & { bar: number|null })[]} */
  const visible = [];
  let prevLabel = /** @type {string|null} */ (null);
  for (const seg of segs) {
    if (prevLabel !== null && seg.label === prevLabel) continue;
    prevLabel = seg.label;
    const c = normalized[seg.chordIdx];
    const bar = c && Number.isFinite(Number(c.start_bar)) && Number(c.start_bar) >= 1 ? Number(c.start_bar) : null;
    visible.push({ ...seg, bar });
  }

  /** Compassos: acordes que começam no mesmo compasso ficam juntos (`| G | D | Em C |`). */
  const useBars = visible.length > 1 && visible.every((v) => v.bar != null);
  /** @type {{ bar: number|null, items: typeof visible }[]} */
  const bars = [];
  for (const v of visible) {
    const last = bars[bars.length - 1];
    if (useBars && last && last.bar === v.bar) last.items.push(v);
    else bars.push({ bar: v.bar, items: [v] });
  }

  /** Sequência que se repete inteira (ex.: intro G D Em C G D Em C) → escreve uma vez com «(2x)». */
  let period = bars.length;
  let times = 1;
  if (useBars && bars.length >= 2) {
    const keys = bars.map((b) => b.items.map((i) => i.label).join(' '));
    for (let pLen = 1; pLen <= keys.length / 2; pLen++) {
      if (keys.length % pLen) continue;
      let same = true;
      for (let i = pLen; i < keys.length && same; i++) same = keys[i] === keys[i - pLen];
      if (same) {
        period = pLen;
        times = keys.length / pLen;
        break;
      }
    }
  }

  const makeSymbolCell = (text, muted) => {
    const wrap = document.createElement('span');
    wrap.className = 'inline-flex flex-col items-start gap-1 rounded-md px-1 py-0.5 transition-colors';
    const ch = document.createElement('span');
    ch.className = muted
      ? 'cifra-bar inline-flex min-h-[1.125rem] items-end font-mono text-xs text-auris-muted sm:text-sm'
      : 'cifra-chord__symbol inline-flex min-h-[1.125rem] items-end font-mono text-xs font-semibold text-auris-teal sm:text-sm';
    ch.textContent = text;
    const tx = document.createElement('span');
    tx.className = 'min-h-[1.25rem] text-auris-ink';
    tx.textContent = ' ';
    wrap.appendChild(ch);
    wrap.appendChild(tx);
    return { wrap, ch };
  };

  for (let bi = 0; bi < period; bi++) {
    if (useBars) row.appendChild(makeSymbolCell('|', true).wrap);
    bars[bi].items.forEach((v, ii) => {
      const { wrap, ch } = makeSymbolCell(v.label, false);
      wrap.dataset.playbackA0 = String(v.a0);
      wrap.dataset.playbackA1 = String(v.a1);
      wrap.dataset.chordIdx = String(v.chordIdx);
      // Passagens repetidas apontam para esta célula (destaque durante o «2x»).
      const aliases = [];
      for (let rep = 1; rep < times; rep++) {
        const other = bars[bi + rep * period]?.items[ii];
        if (other) aliases.push(other.chordIdx);
      }
      if (aliases.length) wrap.dataset.chordAliases = aliases.join(' ');
      wrap.classList.add('cifra-chord--track');
      row.appendChild(wrap);
      stripCellsOut.push({ wrap, a0: v.a0, a1: v.a1 });
      if (typeof wireChordDiagram === 'function') wireChordDiagram(ch, v.label);
    });
  }
  if (useBars) row.appendChild(makeSymbolCell('|', true).wrap);
  if (times > 1) row.appendChild(makeSymbolCell(`(${times}x)`, true).wrap);

  outer.appendChild(row);
  return outer;
}

/**
 * Depois do layout, como numa cifra impressa: o acorde passa por cima do espaço entre as
 * palavras e só se abre espaço quando é preciso — dois acordes que se sobreporiam, ou um acorde
 * que sairia pela margem direita da linha.
 *
 * @param {HTMLElement} container
 */
export function spaceOverlappingChords(container) {
  for (const row of container.querySelectorAll('.cifra-line:not([data-instrumental-strip])')) {
    for (const el of row.querySelectorAll('[data-chord-space]')) {
      el.style.marginLeft = '';
      el.style.paddingLeft = '';
      el.style.backgroundImage = '';
      el.removeAttribute('data-chord-space');
    }
    for (const piece of row.querySelectorAll('[data-chord-reserve]')) {
      piece.style.minWidth = '';
      piece.removeAttribute('data-chord-reserve');
    }
    // Reservar largura muda a quebra de linha, e a quebra muda as colisões: poucas passadas bastam.
    for (let pass = 0; pass < 3; pass++) {
      separateCollidingChords(row);
      if (!reserveChordAtRowEnd(row)) break;
    }
  }
}

/** Fim visível do acorde (sem o recuo à direita do símbolo). */
function chordInkRight(sym) {
  const r = sym.getBoundingClientRect();
  return r.right - (parseFloat(getComputedStyle(sym).paddingRight) || 0);
}

/** @param {HTMLElement} row */
function separateCollidingChords(row) {
  const GAP_PX = 6;
  let prevRight = -Infinity;
  let prevTop = NaN;
  for (const sym of row.querySelectorAll('.cifra-chord__symbol')) {
    if (!sym.textContent || !sym.textContent.replace(/ /g, '').trim()) continue;
    const r = sym.getBoundingClientRect();
    if (!r.width) continue;
    if (Math.abs(r.top - prevTop) > 4) prevRight = -Infinity; // nova linha visual (quebra)
    const overlap = prevRight + GAP_PX - r.left;
    if (overlap > 0) {
      const host = sym.closest('.cifra-syllable, .cifra-chord--track:not(.cifra-syllable *)') || sym;
      const midWord =
        host.classList.contains('cifra-syllable') &&
        !!host.previousElementSibling &&
        host.previousElementSibling.classList.contains('cifra-syllable');
      if (midWord) {
        // Dentro da palavra o espaço leva um hífen, como na cifra impressa ("se-me-ar").
        const pad = (parseFloat(host.style.paddingLeft || '0') || 0) + overlap;
        const dash = Math.min(8, Math.max(3, pad - 6));
        host.style.paddingLeft = `${pad}px`;
        host.style.backgroundImage = 'linear-gradient(currentColor, currentColor)';
        host.style.backgroundRepeat = 'no-repeat';
        host.style.backgroundSize = `${dash}px 1px`;
        host.style.backgroundPosition = `${(pad - dash) / 2}px calc(100% - 0.5em)`;
      } else {
        const cur = parseFloat(host.style.marginLeft || '0') || 0;
        host.style.marginLeft = `${cur + overlap}px`;
      }
      host.setAttribute('data-chord-space', '1');
    }
    prevRight = chordInkRight(sym);
    prevTop = sym.getBoundingClientRect().top;
  }
}

/**
 * Acorde no fim de uma palavra que sairia pela margem direita: a sílaba passa a ocupar a
 * largura dele, e a palavra desce de linha se não couber.
 *
 * @param {HTMLElement} row
 * @returns {boolean} se alguma reserva mudou (o layout precisa ser revisto)
 */
function reserveChordAtRowEnd(row) {
  const rowStyle = getComputedStyle(row);
  const limit = row.getBoundingClientRect().right - (parseFloat(rowStyle.paddingRight) || 0);
  let changed = false;
  for (const piece of row.querySelectorAll('.cifra-syllable:last-child')) {
    const syms = piece.querySelectorAll('.cifra-chord__symbol');
    if (!syms.length) continue;
    const over = chordInkRight(syms[syms.length - 1]) - limit;
    if (over <= 0.5) continue;
    const w = piece.getBoundingClientRect().width;
    piece.style.minWidth = `${Math.ceil(w + over)}px`;
    piece.setAttribute('data-chord-reserve', '1');
    changed = true;
  }
  return changed;
}

/**
 * Sílaba de uma palavra cantada, com o(s) acorde(s) que começam nela alinhados à esquerda.
 * O acorde não alarga a peça; o espaçamento é feito depois do layout (`spaceOverlappingChords`).
 *
 * @param {string} text
 * @param {{ label: string, chordIdx: number, c: import('./musicai-types.ts').MusicAiChordEvent }[]} shown
 * @param {number} off
 * @param {(el: HTMLElement, label: string) => void} [wireChordDiagram]
 * @returns {HTMLElement}
 */
function createSyllablePiece(text, shown, off, wireChordDiagram) {
  const piece = document.createElement('span');
  piece.className = 'cifra-syllable inline-flex flex-col items-start gap-1';
  const chordRow = document.createElement('span');
  // Largura zero: o acorde fica por cima do texto sem partir a palavra; colisões entre acordes
  // são resolvidas depois do layout (`spaceOverlappingChords`).
  chordRow.className = 'inline-flex min-h-[1.125rem] w-0 items-end gap-1.5 overflow-visible whitespace-nowrap';
  if (!shown.length) {
    const sym = document.createElement('span');
    sym.className = 'cifra-chord__symbol inline-flex items-end font-mono text-xs sm:text-sm';
    sym.textContent = ' ';
    chordRow.appendChild(sym);
  }
  for (const v of shown) {
    // Cada acorde é um alvo próprio de destaque (tempo e índice do evento).
    const track = document.createElement('span');
    track.className = 'cifra-chord--track inline-flex rounded-md transition-colors';
    track.dataset.playbackA0 = String(Number(v.c.start) + off);
    track.dataset.playbackA1 = String(Number(v.c.end) + off);
    track.dataset.chordIdx = String(v.chordIdx);
    const sym = document.createElement('span');
    sym.className =
      'cifra-chord__symbol inline-flex items-end whitespace-pre pr-1 font-mono text-xs font-semibold text-auris-teal sm:text-sm';
    sym.textContent = v.label;
    track.appendChild(sym);
    chordRow.appendChild(track);
    if (typeof wireChordDiagram === 'function') wireChordDiagram(sym, v.label);
  }
  const tx = document.createElement('span');
  tx.className = 'text-auris-ink whitespace-pre text-[14px] font-medium leading-tight tracking-tight';
  tx.textContent = text;
  piece.appendChild(chordRow);
  piece.appendChild(tx);
  return piece;
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
 * @param {number} [params.beatSec] — duração de um tempo (s); por omissão estimada da grade dos acordes
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
    beatSec: beatSecParam,
    chordDiagramHoverOptionsRef = null,
  } = params;


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
    const getOptions =
      chordDiagramHoverOptionsRef && typeof chordDiagramHoverOptionsRef === 'object'
        ? () => chordDiagramHoverOptionsRef.current ?? undefined
        : undefined;
    const dispose = attachChordDiagramHoverDom(chEl, lab, getOptions);
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
    const off = Number.isFinite(chordTimeOffsetSec) ? chordTimeOffsetSec : 0;

    /** Sem letra (faixa instrumental): uma única faixa com a música inteira. */
    let plan = renderPlan;
    const hasLyrics = plan.some((e) => e.kind === 'lyric' && e.line.length);
    if (!hasLyrics && normalizedChords.length) {
      const first = Number(normalizedChords[0].start) + off;
      const last = Number(normalizedChords[normalizedChords.length - 1].end) + off;
      plan = [{ kind: 'instrumental', iv: { start: Math.max(0, first - 1e-3), end: last, displayLabel: '—' } }];
    }

    /**
     * Posicionamento único (o mesmo do editor): cada acorde vai para uma sílaba, para depois de
     * uma palavra, ou para a faixa instrumental do trecho sem voz em que começa.
     */
    const instrumentalIvs = plan.filter((e) => e.kind === 'instrumental').map((e) => e.iv);
    /** @type {{ key: number, lineKey: number, text: string, start: number, end: number }[]} */
    const placementWords = [];
    plan.forEach((ev, li) => {
      if (ev.kind !== 'lyric') return;
      for (const w of ev.line) {
        if (w.start == null || !Number.isFinite(w.start)) continue;
        const end = w.end != null && Number.isFinite(w.end) && w.end > w.start ? w.end : w.start + 0.2;
        placementWords.push({ key: w.g, lineKey: li, text: String(w.text ?? ''), start: Number(w.start), end: Number(end) });
      }
    });
    const placement = placeChordsOnWords(placementWords, normalizedChords, {
      chordTimeOffsetSec: off,
      beatSec: Number.isFinite(beatSecParam) ? beatSecParam : estimateBeatSec(normalizedChords),
      isInstrumentalTime: (t) => instrumentalIvs.some((iv) => t >= iv.start - 1e-3 && t < iv.end),
    });
    const placedByG = new Map(placement.words.map((w) => [w.key, w]));
    const instrumentalSet = new Set(placement.instrumentalChordIdxs);

    /**
     * Bloco da **ocorrência** de secção atual. Cada ocorrência (ex.: 1.º Refrão, 2.º Refrão)
     * tem o seu próprio bloco, na ordem em que a música é tocada.
     *
     * @type {{ wrap: HTMLElement, inner: HTMLElement, sec: import('./musicai-types.ts').MusicAiSection } | null}
     */
    let currentShell = null;
    const appendToOccurrence = (sec, showHeader, node) => {
      if (!currentShell || !envelopesMatch(currentShell.sec, sec)) {
        const shell = createSectionShell(sec, showHeader, formatClock);
        container.appendChild(shell.wrap);
        currentShell = { wrap: shell.wrap, inner: shell.inner, sec: { ...sec } };
      }
      currentShell.inner.appendChild(node);
    };

    /** Último símbolo mostrado: um acorde repetido em seguida não se reescreve (vale até o próximo). */
    let lastShownLabel = /** @type {string|null} */ (null);
    /** Secção do último símbolo: numa secção nova o acorde pode ser reafirmado. */
    let lastShownSectionKey = /** @type {string|null} */ (null);

    for (let evIdx = 0; evIdx < plan.length; evIdx++) {
      const ev = plan[evIdx];

      if (ev.kind === 'instrumental') {
        const iv0 = ev.iv;
        const env0 =
          sectionsSorted.length > 0 ? musicAiSectionEnvelopeForTime((iv0.start + iv0.end) / 2, sectionsSorted) : null;
        const group = [iv0];
        let nextIdx = evIdx + 1;
        while (nextIdx < plan.length && plan[nextIdx].kind === 'instrumental') {
          const ivn = plan[nextIdx].iv;
          const envN =
            sectionsSorted.length > 0 ? musicAiSectionEnvelopeForTime((ivn.start + ivn.end) / 2, sectionsSorted) : null;
          if (!envelopesMatch(env0, envN)) break;
          group.push(ivn);
          nextIdx++;
        }
        for (const iv of group) {
          const lab = String(iv.displayLabel ?? '').trim() || '—';
          const env =
            sectionsSorted.length > 0 ? musicAiSectionEnvelopeForTime((iv.start + iv.end) / 2, sectionsSorted) : null;
          const secLike = env
            ? { start: env.start, end: env.end, label: String(env.label ?? '').trim() || lab }
            : { start: iv.start, end: iv.end, label: lab };
          const wantHeader =
            showSectionBars && (sectionsSorted.length > 0 || lab === '—' || isInstrumentalSectionLabel(iv.displayLabel));
          const wrapInst = sectionsSorted.length > 0 || wantHeader;
          const stripStart = stripCells.length;
          const strip = createInstrumentalChordStrip(
            iv,
            chords,
            chordTimeOffsetSec,
            stripCells,
            formatChordEvent,
            wrapInst,
            wireChordDiagramIfResolvable,
            instrumentalSet
          );
          if (!strip) continue;
          if (wrapInst) {
            appendToOccurrence(secLike, wantHeader, strip);
          } else {
            currentShell = null;
            container.appendChild(strip);
          }
          const lastCell = lastVisibleChordInStripCellsSince(stripCells, stripStart, getChordLabelAtAudioTime);
          if (lastCell) lastShownLabel = lastCell.label;
          lastShownSectionKey = sectionDisplayLabelKey(secLike.label);
        }
        evIdx = nextIdx - 1;
        continue;
      }

      const lineWords = ev.line;
      if (!lineWords.length) continue;
      const fw = lineWords[0];
      const sec =
        sectionsSorted.length && fw.start != null && Number.isFinite(fw.start)
          ? vocalSectionHeaderForLyricTime(fw.start, sectionsSorted)
          : null;
      const secLabelKey = sec ? sectionDisplayLabelKey(sec.label) : null;
      if (secLabelKey !== lastShownSectionKey) lastShownLabel = null;

      const row = document.createElement('div');
      row.className = 'cifra-line flex flex-wrap items-end gap-x-3 gap-y-4';

      /** Rótulo visível de um acorde posicionado (ou `null` se repete o anterior). */
      const nextVisible = (chordIdx) => {
        const c = normalizedChords[chordIdx];
        if (!c) return null;
        const label = String(formatChordEvent(c) ?? '').trim();
        if (!label || label === '—' || label === lastShownLabel) return null;
        lastShownLabel = label;
        return { label, chordIdx, c };
      };

      for (const tw of lineWords) {
        const pw = placedByG.get(tw.g);
        const syllables = pw ? pw.syllables : [{ text: String(tw.text ?? '') }];
        /** @type {Map<number, number[]>} */
        const onsetBySyl = new Map();
        /** @type {number[]} */
        const afters = [];
        for (const p of pw ? pw.placements : []) {
          if (p.kind === 'after') afters.push(p.chordIdx);
          else onsetBySyl.set(p.syllableIndex, [...(onsetBySyl.get(p.syllableIndex) ?? []), p.chordIdx]);
        }

        const wordWrap = document.createElement('span');
        wordWrap.className = 'cifra-word inline-flex min-w-0 items-end rounded-md px-1 py-0.5 transition-colors';
        wordWrap.dataset.g = String(tw.g);
        spans.push({ wrap: wordWrap, g: tw.g });
        syllables.forEach((syl, si) => {
          const shown = (onsetBySyl.get(si) ?? []).map(nextVisible).filter(Boolean);
          wordWrap.appendChild(createSyllablePiece(syl.text, shown, off, wireChordDiagramIfResolvable));
        });
        const afterCells = [];
        for (const ci of afters) {
          const v = nextVisible(ci);
          if (!v) continue;
          afterCells.push(
            createLyricChordCell(
              v.label,
              ' ',
              tw.g,
              spans,
              { a0: Number(v.c.start) + off, a1: Number(v.c.end) + off },
              ci,
              wireChordDiagramIfResolvable
            )
          );
        }
        if (afterCells.length) {
          // O acorde que soa depois da palavra desce de linha junto com ela, nunca sozinho.
          const group = document.createElement('span');
          group.className = 'cifra-word-group inline-flex items-end gap-x-3';
          group.append(wordWrap, ...afterCells);
          row.appendChild(group);
        } else {
          row.appendChild(wordWrap);
        }
      }
      lastShownSectionKey = secLabelKey;

      if (sectionsSorted.length && sec && secLabelKey) {
        appendToOccurrence(sec, showSectionBars, row);
      } else {
        currentShell = null;
        container.appendChild(row);
      }
    }
  }

  const relayout = () => {
    try {
      spaceOverlappingChords(container);
    } catch {
      // layout indisponível (ex.: SSR/testes)
    }
  };
  let relayoutRaf = 0;
  const onResize = () => {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(relayoutRaf);
    relayoutRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(relayout) : 0;
  };
  const buildAndLayout = () => {
    build();
    relayout();
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts.ready.then(relayout).catch(() => {});
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
  const teardown = () => {
    if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(relayoutRaf);
    clear();
  };

  buildAndLayout();
  return { spans, stripCells, clear: teardown, rebuild: buildAndLayout };
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
    t1.textContent = sectionDisplayName(sec.label);

    const t2 = document.createElement('div');
    t2.className = 'mt-0.5 font-mono text-[10px] text-auris-muted tabular-nums';
    t2.setAttribute('data-section-time', 'true');
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
  const cells = [
    ...container.querySelectorAll(
      `.cifra-chord--track[data-chord-idx="${idx}"], .cifra-chord--track[data-chord-aliases~="${idx}"]`
    ),
  ];
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
 * Alvo da rolagem «inteligente»: igual a {@link resolveCifraScrollTarget} — linha `.cifra-line` do acorde
 * em reprodução (com `leadSec`), ou secção se não houver célula; mantido como alias para chamadas antigas.
 */
export function resolveCifraSmartScrollTarget(container, tAudio, leadSec = 0, chords, chordTimeOffsetSec) {
  return resolveCifraScrollTarget(container, tAudio, leadSec, chords, chordTimeOffsetSec);
}
