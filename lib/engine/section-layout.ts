// @ts-nocheck
/**
 * Classifica secções só-instrumentais e constrói o plano da cifra:
 * blocos sem letra (intro, bridge, solo, etc.) separados das linhas vocais.
 * «Outro» não entra aqui — costuma ter voz; uma grelha só-acordes antes da letra duplicava acordes (ex. A D G… N).
 *
 * @module section-layout
 */

import { sectionAtTimestamp } from './section-timeline';
import {
  chordSegmentsInAudioWindow,
  formatChordLabel,
} from './chord-timeline';

const TIME_EPS = 1e-3;

/** Alinhar limites de bloco só-acordes com fim/início de linha vocal (sanduíche entre linhas). */
const BETWEEN_LINE_BLOCK_ALIGN_SEC = 0.3;

/**
 * @param {string|undefined|null} label
 * @returns {boolean}
 */
function isBridgeLabel(label) {
  return String(label ?? '')
    .toLowerCase()
    .includes('bridge');
}

/**
 * @param {string|undefined|null} label
 * @returns {boolean}
 */
export function isInstrumentalSectionLabel(label) {
  const s = String(label ?? '')
    .toLowerCase()
    .trim();
  if (!s) return false;
  if (s.includes('intro')) return true;
  if (s.includes('instrumental')) return true;
  if (isBridgeLabel(label)) return true;
  if (/\bsolo\b/.test(s) && !s.includes('verse') && !s.includes('bridge')) return true;
  return false;
}

/**
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {{ start: number, end: number, displayLabel: string }[]}
 */
export function mergeInstrumentalIntervals(sectionsSorted) {
  const raw = sectionsSorted
    .filter((s) => isInstrumentalSectionLabel(s.label))
    .map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      label: String(s.label || '').trim() || '—'
    }))
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end) && r.end > r.start)
    .sort((a, b) => a.start - b.start);

  /** @type {{ start: number, end: number, labels: string[] }[]} */
  const merged = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + TIME_EPS) {
      last.end = Math.max(last.end, r.end);
      last.labels.push(r.label);
    } else {
      merged.push({ start: r.start, end: r.end, labels: [r.label] });
    }
  }

  return merged.map((m) => {
    const uniq = [...new Set(m.labels)];
    return {
      start: m.start,
      end: m.end,
      displayLabel: uniq.length === 1 ? uniq[0] : uniq.join(' · ')
    };
  });
}

/**
 * Rótulo Music.AI para um intervalo só-acordes: secção ativa no ponto médio do gap.
 *
 * @param {number} start
 * @param {number} end
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {string}
 */
export function sectionDisplayLabelForGap(start, end, sectionsSorted) {
  if (!sectionsSorted.length) return '—';
  const mid = (Number(start) + Number(end)) / 2;
  const s = sectionAtTimestamp(sectionsSorted, mid);
  const t = s && s.label != null ? String(s.label).trim() : '';
  return t || '—';
}

/**
 * Funde blocos consecutivos com o mesmo `displayLabel` e tempos contíguos.
 * Evita dois cabeçalhos «Intro» quando o split na fronteira da secção (ex. start 0,25 s) cria um
 * micro-intervalo [0, 0,25] sem acordes e o seguinte [0,25, …] com acordes.
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} blocks
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {{ start: number, end: number, displayLabel: string }[]}
 */
function mergeContiguousInstrumentalBlocksSameLabel(blocks, sectionsSorted) {
  if (!blocks.length) return blocks;
  const SLACK = TIME_EPS * 10;
  /** @type {{ start: number, end: number, displayLabel: string }[]} */
  const out = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    const bs = Number(b.start);
    const be = Number(b.end);
    if (!Number.isFinite(bs) || !Number.isFinite(be)) continue;
    if (
      last &&
      last.displayLabel === b.displayLabel &&
      Math.abs(bs - Number(last.end)) <= SLACK
    ) {
      last.end = Math.max(Number(last.end), be);
      if (sectionsSorted.length) {
        last.displayLabel = sectionDisplayLabelForGap(last.start, last.end, sectionsSorted);
      }
    } else {
      out.push({ start: bs, end: be, displayLabel: b.displayLabel });
    }
  }
  return out;
}

/**
 * Parte cada bloco só-acordes nas fronteiras de `sections.json`, para cabeçalhos alinhados ao verso
 * (ex.: gap 0→72 s com letra tardia vira Intro + Verse + … em vez de um único rótulo pelo meio).
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} blocks
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {{ start: number, end: number, displayLabel: string }[]}
 */
export function splitInstrumentalBlocksAtSectionBoundaries(blocks, sectionsSorted) {
  if (!Array.isArray(blocks) || !blocks.length || !sectionsSorted.length) return blocks;
  /** @type {{ start: number, end: number, displayLabel: string }[]} */
  const out = [];
  for (const b of blocks) {
    const a = Number(b.start);
    const end = Number(b.end);
    if (!Number.isFinite(a) || !Number.isFinite(end) || end <= a + TIME_EPS) {
      out.push(b);
      continue;
    }
    /** @type {number[]} */
    const cuts = [a, end];
    for (const s of sectionsSorted) {
      const s0 = Number(s.start);
      const s1 = Number(s.end);
      if (!Number.isFinite(s0) || !Number.isFinite(s1) || s1 <= s0) continue;
      if (s0 > a + TIME_EPS && s0 < end - TIME_EPS) cuts.push(s0);
      if (s1 > a + TIME_EPS && s1 < end - TIME_EPS) cuts.push(s1);
    }
    cuts.sort((x, y) => x - y);
    /** @type {number[]} */
    const uniq = [];
    for (const t of cuts) {
      if (!uniq.length || Math.abs(t - uniq[uniq.length - 1]) > TIME_EPS) uniq.push(t);
    }
    if (uniq.length < 2) {
      out.push({
        start: a,
        end,
        displayLabel: sectionDisplayLabelForGap(a, end, sectionsSorted)
      });
      continue;
    }
    for (let i = 0; i < uniq.length - 1; i++) {
      const u = uniq[i];
      const v = uniq[i + 1];
      if (v <= u + TIME_EPS) continue;
      out.push({
        start: u,
        end: v,
        displayLabel: sectionDisplayLabelForGap(u, v, sectionsSorted)
      });
    }
  }
  return mergeContiguousInstrumentalBlocksSameLabel(out, sectionsSorted);
}

/**
 * Duração máxima de um bloco só-acordes com rótulo de **parte vocal** (Verse, Chorus, …) que ainda
 * conservamos. Blocos mais curtos são quase sempre caudas do `splitInstrumentalBlocksAtSectionBoundaries`
 * entre `Verse.start` e a 1.ª sílaba — duplicam o G# sustentado na linha seguinte.
 */
export const MICRO_INSTRUMENTAL_VOCAL_SECTION_DROP_SEC = 0.35;

/**
 * Remove blocos só-acordes muito curtos cujo `displayLabel` não é parte só-instrumental
 * (`isInstrumentalSectionLabel`). Intro / instrumental / bridge / solo mantêm-se.
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} blocks
 * @returns {{ start: number, end: number, displayLabel: string }[]}
 */
export function dropMicroInstrumentalBlocksInVocalSections(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return blocks;
  /** @type {{ start: number, end: number, displayLabel: string }[]} */
  const out = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const d = Number(b.end) - Number(b.start);
    if (!Number.isFinite(d) || d <= 0) continue;
    if (d < MICRO_INSTRUMENTAL_VOCAL_SECTION_DROP_SEC - TIME_EPS && !isInstrumentalSectionLabel(b.displayLabel)) {
      continue;
    }
    out.push(b);
  }
  return out;
}

const CHORD_GAP_TIME_EPS = 1e-3;

/**
 * @param {number} g0
 * @param {number} g1
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} chordOffsetSec
 */
function gapOverlapsAnyChord(g0, g1, chords, chordOffsetSec) {
  const off = Number.isFinite(chordOffsetSec) ? chordOffsetSec : 0;
  for (let i = 0; i < chords.length; i++) {
    const c = chords[i];
    const c0 = Number(c.start) + off;
    const c1 = Number(c.end) + off;
    if (!Number.isFinite(c0) || !Number.isFinite(c1) || c1 <= c0) continue;
    if (c1 <= g0 + CHORD_GAP_TIME_EPS || c0 >= g1 - CHORD_GAP_TIME_EPS) continue;
    return true;
  }
  return false;
}

/**
 * O intervalo [g0,g1) cruza alguma secção com rótulo «Intro» no JSON (Music.AI).
 */
function gapIntersectsIntroSection(g0, g1, sectionsSorted) {
  if (!sectionsSorted || !sectionsSorted.length) return false;
  for (let i = 0; i < sectionsSorted.length; i++) {
    const s = sectionsSorted[i];
    const raw = String(s.label ?? '')
      .toLowerCase()
      .trim();
    if (!raw.includes('intro')) continue;
    const s0 = Number(s.start);
    const s1 = Number(s.end);
    if (!Number.isFinite(s0) || !Number.isFinite(s1) || s1 <= s0) continue;
    if (g1 > s0 + CHORD_GAP_TIME_EPS && g0 < s1 - CHORD_GAP_TIME_EPS) return true;
  }
  return false;
}

/** Gap inicial 0 → 1.ª palavra (não pausas entre linhas). */
function isLeadingLyricGapFromZero(g0) {
  return g0 <= 0.05;
}

/** Maior `end` entre secções «Intro» (útil quando a 1.ª palavra do Whisper está em 0 s e não há gap ≥ minGap). */
function maxDeclaredIntroEndSec(sectionsSorted) {
  let m = 0;
  if (!sectionsSorted || !sectionsSorted.length) return null;
  for (let i = 0; i < sectionsSorted.length; i++) {
    const s = sectionsSorted[i];
    if (!String(s.label ?? '').toLowerCase().includes('intro')) continue;
    const e = Number(s.end);
    if (Number.isFinite(e)) m = Math.max(m, e);
  }
  return m > TIME_EPS ? m : null;
}

/**
 * Blocos só-acordes onde **não há letra** no tempo (gaps entre segmentos vocais já filtrados).
 * Intro/outro usam `minGapSec`; entre linhas usa `minGapBetweenLinesSec` (maior, para cortes Whisper).
 * Com `labelGapsFromSections`, o rótulo vem da secção Music.AI no meio do gap (toggle «Partes»).
 * O gap antes da 1.ª palavra inclui-se também quando cruza uma «Intro» em `sectionsSorted` mas
 * `chords.json` não tem eventos nesse intervalo (senão a intro deixava de aparecer na cifra).
 * Se a 1.ª sílaba está em ~0 s, não existe gap ≥ minGap: usa-se o `end` da Intro declarada.
 *
 * @param {import('./musicai-types.ts').TimedWord[][]} timedLines
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} durationSec
 * @param {number} [chordOffsetSec=0]
 * @param {{
 *   minGapSec?: number,
 *   includeBetweenLineGaps?: boolean,
 *   minGapBetweenLinesSec?: number,
 *   sectionsSorted?: import('./musicai-types.ts').MusicAiSection[],
 *   labelGapsFromSections?: boolean
 * }} [opts]
 * @returns {{ start: number, end: number, displayLabel: string }[]}
 */
export function buildInstrumentalBlocksFromChordLyricGaps(
  timedLines,
  chords,
  durationSec,
  chordOffsetSec = 0,
  opts = {}
) {
  const minGap = opts.minGapSec ?? 0.35;
  const includeBetweenLineGaps = opts.includeBetweenLineGaps === true;
  const minGapBetween =
    typeof opts.minGapBetweenLinesSec === 'number' && Number.isFinite(opts.minGapBetweenLinesSec)
      ? opts.minGapBetweenLinesSec
      : 1.75;
  const labelGapsFromSections = opts.labelGapsFromSections === true;
  /** @type {import('./musicai-types.ts').MusicAiSection[] | undefined} */
  const secForLabels = opts.sectionsSorted;

  function labelForGap(g0, g1) {
    if (labelGapsFromSections && secForLabels && secForLabels.length) {
      return sectionDisplayLabelForGap(g0, g1, secForLabels);
    }
    return '—';
  }

  const list = timedLines
    .filter((line) => line.length)
    .map((line) => {
      const t0 = line[0].start;
      const t1 = line[line.length - 1].end;
      return { t0, t1 };
    })
    .filter((x) => Number.isFinite(x.t0) && Number.isFinite(x.t1) && x.t1 > x.t0)
    .sort((a, b) => a.t0 - b.t0);

  if (!list.length) return [];

  let lyricEndMax = list[0].t1;
  for (let i = 0; i < list.length; i++) {
    lyricEndMax = Math.max(lyricEndMax, list[i].t1);
  }

  const dRaw = Number(durationSec);
  const d =
    Number.isFinite(dRaw) && dRaw > list[0].t0 + CHORD_GAP_TIME_EPS
      ? dRaw
      : Math.max(lyricEndMax, dRaw || lyricEndMax);

  /** @type {{ start: number, end: number, displayLabel: string }[]} */
  const blocks = [];

  const firstStart = list[0].t0;
  const introEndDecl = maxDeclaredIntroEndSec(secForLabels);
  /** 1.ª palavra muito cedo: sem intervalo «sem letra» ≥ minGap antes dela. */
  const weakLeading = firstStart < minGap - CHORD_GAP_TIME_EPS;

  if (!weakLeading && firstStart >= minGap - CHORD_GAP_TIME_EPS) {
    const g0 = 0;
    const g1 = firstStart;
    const hasChords = gapOverlapsAnyChord(g0, g1, chords, chordOffsetSec);
    const introInJson =
      isLeadingLyricGapFromZero(g0) && gapIntersectsIntroSection(g0, g1, secForLabels);
    if (hasChords || introInJson) {
      blocks.push({ start: g0, end: g1, displayLabel: labelForGap(g0, g1) });
    }
  }

  if (
    weakLeading &&
    introEndDecl != null &&
    introEndDecl >= minGap - CHORD_GAP_TIME_EPS &&
    firstStart < introEndDecl - CHORD_GAP_TIME_EPS
  ) {
    const g0 = 0;
    const g1 = introEndDecl;
    const hasChords = gapOverlapsAnyChord(g0, g1, chords, chordOffsetSec);
    const introInJson = gapIntersectsIntroSection(g0, g1, secForLabels);
    if (hasChords || introInJson) {
      const dup =
        blocks.length > 0 &&
        Math.abs(blocks[blocks.length - 1].start - g0) < TIME_EPS &&
        Math.abs(blocks[blocks.length - 1].end - g1) < TIME_EPS;
      if (!dup) {
        blocks.push({ start: g0, end: g1, displayLabel: labelForGap(g0, g1) });
      }
    }
  }

  if (includeBetweenLineGaps) {
    for (let i = 0; i < list.length - 1; i++) {
      const g0 = list[i].t1;
      const g1 = list[i + 1].t0;
      if (
        g1 - g0 >= minGapBetween - CHORD_GAP_TIME_EPS &&
        gapOverlapsAnyChord(g0, g1, chords, chordOffsetSec)
      ) {
        blocks.push({ start: g0, end: g1, displayLabel: labelForGap(g0, g1) });
      }
    }
  }

  const lastEnd = list[list.length - 1].t1;
  if (d - lastEnd >= minGap - CHORD_GAP_TIME_EPS && gapOverlapsAnyChord(lastEnd, d, chords, chordOffsetSec)) {
    blocks.push({ start: lastEnd, end: d, displayLabel: labelForGap(lastEnd, d) });
  }

  return blocks;
}

/**
 * @param {string|null|undefined} l
 * @returns {boolean}
 */
function isMeaningfulChordDisplayLabel(l) {
  if (l == null || l === '') return false;
  if (l === '—') return false;
  return true;
}

/**
 * @param {import('./musicai-types.ts').TimedWord} w
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} chordOffsetSec
 * @param {(c: import('./musicai-types.ts').MusicAiChordEvent|null|undefined) => string} formatChord
 * @returns {string|null}
 */
function chordLabelJustBeforeWordEnd(w, chords, chordOffsetSec, formatChord) {
  let t;
  if (w.end != null && Number.isFinite(w.end)) t = w.end - 0.002;
  else if (w.start != null && Number.isFinite(w.start)) t = w.start + 0.002;
  else return null;
  const segs = chordSegmentsInAudioWindow(chords, t, t + 0.08, chordOffsetSec, { formatChord });
  return segs.length ? segs[0].label : null;
}

/**
 * @param {import('./musicai-types.ts').TimedWord} w
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} chordOffsetSec
 * @param {(c: import('./musicai-types.ts').MusicAiChordEvent|null|undefined) => string} formatChord
 * @returns {string|null}
 */
function chordLabelJustAfterWordStart(w, chords, chordOffsetSec, formatChord) {
  if (w.start == null || !Number.isFinite(w.start)) return null;
  const t = w.start + 0.002;
  const segs = chordSegmentsInAudioWindow(chords, t, t + 0.08, chordOffsetSec, { formatChord });
  return segs.length ? segs[0].label : null;
}

/**
 * Remove blocos só-acordes **entre duas linhas vocais** quando o intervalo não muda o acorde:
 * o mesmo símbolo já se lê no fim da linha anterior e no início da seguinte — evita uma linha extra
 * só com G (ex.: hiato ~2 s entre «starts» e «Hide» com G 83.97–88.33 em chords.json).
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} blocks
 * @param {import('./musicai-types.ts').TimedWord[][]} timedLines
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} [chordOffsetSec=0]
 * @param {{ formatChord?: (c: import('./musicai-types.ts').MusicAiChordEvent|null|undefined) => string }} [opts]
 * @returns {{ start: number, end: number, displayLabel: string }[]}
 */
export function collapseRedundantBetweenLineGapBlocks(
  blocks,
  timedLines,
  chords,
  chordOffsetSec = 0,
  opts = {}
) {
  const fmt =
    typeof opts.formatChord === 'function' ? opts.formatChord : formatChordLabel;
  if (!blocks.length || !timedLines.length || !chords.length) return blocks;

  const list = timedLines
    .filter((line) => line.length)
    .map((line) => {
      const t0 = line[0].start;
      const t1 = line[line.length - 1].end;
      return { t0, t1, line };
    })
    .filter((x) => Number.isFinite(x.t0) && Number.isFinite(x.t1) && x.t1 > x.t0)
    .sort((a, b) => a.t0 - b.t0);

  if (list.length < 2) return blocks;

  /** @type {{ start: number, end: number, displayLabel: string }[]} */
  const kept = [];

  for (const b of blocks) {
    let sandwichIdx = -1;
    for (let i = 0; i < list.length - 1; i++) {
      if (
        Math.abs(b.start - list[i].t1) <= BETWEEN_LINE_BLOCK_ALIGN_SEC &&
        Math.abs(b.end - list[i + 1].t0) <= BETWEEN_LINE_BLOCK_ALIGN_SEC
      ) {
        sandwichIdx = i;
        break;
      }
    }

    if (sandwichIdx < 0) {
      kept.push(b);
      continue;
    }

    const prevLine = list[sandwichIdx].line;
    const nextLine = list[sandwichIdx + 1].line;
    const lastW = prevLine[prevLine.length - 1];
    const firstW = nextLine[0];

    const gapSegs = chordSegmentsInAudioWindow(
      chords,
      b.start,
      b.end,
      chordOffsetSec,
      { formatChord: fmt }
    );
    const uniq = [...new Set(gapSegs.map((s) => s.label))];
    if (uniq.length !== 1 || !isMeaningfulChordDisplayLabel(uniq[0])) {
      kept.push(b);
      continue;
    }
    const gapLab = uniq[0];
    const beforeLab = chordLabelJustBeforeWordEnd(lastW, chords, chordOffsetSec, fmt);
    const afterLab = chordLabelJustAfterWordStart(firstW, chords, chordOffsetSec, fmt);

    if (
      isMeaningfulChordDisplayLabel(beforeLab) &&
      isMeaningfulChordDisplayLabel(afterLab) &&
      beforeLab === afterLab &&
      beforeLab === gapLab
    ) {
      continue;
    }
    kept.push(b);
  }

  return kept;
}

/**
 * Funde intervalos sobrepostos ou quase contíguos (só-acordes) e re-rotula pelo meio em `sections.json`.
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} blocks
 * @param {import('./musicai-types.ts').MusicAiSection[] | undefined} sectionsSorted
 */
function mergeOverlappingGapBlocks(
  blocks,
  sectionsSorted
) {
  if (blocks.length <= 1) {
    if (sectionsSorted && sectionsSorted.length && blocks.length === 1) {
      const m = blocks[0];
      m.displayLabel = sectionDisplayLabelForGap(m.start, m.end, sectionsSorted);
    }
    return blocks;
  }
  const sorted = blocks.slice().sort((a, b) => a.start - b.start);
  /** @type {{ start: number, end: number, displayLabel: string }[]} */
  const merged = [];
  for (const b of sorted) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end + 0.08) {
      last.end = Math.max(last.end, b.end);
    } else {
      merged.push({ start: b.start, end: b.end, displayLabel: b.displayLabel });
    }
  }
  if (sectionsSorted && sectionsSorted.length) {
    for (let i = 0; i < merged.length; i++) {
      const m = merged[i];
      m.displayLabel = sectionDisplayLabelForGap(m.start, m.end, sectionsSorted);
    }
  }
  return merged;
}

/**
 * Garante blocos só-acordes para cada secção **Instrumental** em `sections.json` quando o Whisper
 * não deixa intervalo ≥ `minGapBetweenLinesSec` entre linhas (o gap 101.45–110.15 desaparecia).
 * Acrescenta intervalos não cobertos por blocos existentes, depois funde sobreposições.
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} blocks
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @param {import('./musicai-types.ts').MusicAiChordEvent[]} chords
 * @param {number} [chordOffsetSec=0]
 */
export function supplementInstrumentalBlocksFromSections(
  blocks,
  sectionsSorted,
  chords,
  chordOffsetSec = 0
) {
  const out = blocks.slice();
  if (!sectionsSorted.length || !chords.length) {
    return mergeOverlappingGapBlocks(out, sectionsSorted);
  }

  const COVER_SLACK = 0.25;

  for (const sec of sectionsSorted) {
    const raw = String(sec.label ?? '')
      .toLowerCase()
      .trim();
    if (!raw.includes('instrumental')) continue;

    const s0 = Number(sec.start);
    const s1 = Number(sec.end);
    if (!Number.isFinite(s0) || !Number.isFinite(s1) || s1 <= s0) continue;
    if (!gapOverlapsAnyChord(s0, s1, chords, chordOffsetSec)) continue;

    const fullyCovered = out.some(
      (b) =>
        Number.isFinite(b.start) &&
        Number.isFinite(b.end) &&
        b.start <= s0 + COVER_SLACK &&
        b.end >= s1 - COVER_SLACK
    );
    if (fullyCovered) continue;

    out.push({
      start: s0,
      end: s1,
      displayLabel: String(sec.label ?? '').trim() || 'Instrumental'
    });
  }

  return mergeOverlappingGapBlocks(out, sectionsSorted);
}

/**
 * Meio-tempo da palavra para classificar contra intervalos instrumentais.
 * @param {import('./musicai-types.ts').TimedWord} w
 */
function wordMidpoint(w) {
  if (w.start != null && w.end != null && Number.isFinite(w.start) && Number.isFinite(w.end)) {
    return (w.start + w.end) / 2;
  }
  return null;
}

/**
 * Meio-tempo dentro de [start, end) (fim exclusivo).
 * O 1.º bloco instrumental de abertura (intro no rótulo ou começo ≤1s) não remove letra:
 * a voz pode entrar antes do fim da “Intro” no Music.AI e a frase deve ficar inteira no verso.
 * Bridge também mantém letra. Outro não está nos intervalos fundidos (não é «instrumental» no layout).
 *
 * @param {number} m
 * @param {{ start: number, end: number, displayLabel?: string }[]} intervals
 */
function midpointInsideInstrumental(m, intervals) {
  if (m == null || !Number.isFinite(m)) return false;
  return intervals.some((iv, idx) => {
    const lab = String(iv.displayLabel ?? '')
      .toLowerCase()
      .trim();
    const openingIntro =
      idx === 0 && (lab.includes('intro') || iv.start <= 1 + TIME_EPS);
    if (openingIntro) return false;
    if (lab.includes('bridge')) return false;
    return m >= iv.start - TIME_EPS && m < iv.end;
  });
}

/**
 * Remove palavras cujo meio cai em secção instrumental; renumerar `g` global.
 *
 * @param {import('./musicai-types.ts').TimedWord[][]} timedLines
 * @param {{ start: number, end: number, displayLabel: string }[]} instrumentalIntervals
 * @returns {import('./musicai-types.ts').TimedWord[][]}
 */
export function filterTimedLinesToVocalOnly(timedLines, instrumentalIntervals) {
  let g = 0;
  /** @type {import('./musicai-types.ts').TimedWord[][]} */
  const out = [];

  for (const line of timedLines) {
    /** @type {import('./musicai-types.ts').TimedWord[]} */
    const kept = [];
    for (const w of line) {
      const m = wordMidpoint(w);
      if (m != null && midpointInsideInstrumental(m, instrumentalIntervals)) continue;
      kept.push({ ...w, g: g++ });
    }
    if (kept.length) out.push(kept);
  }
  return out;
}

/**
 * Meio-tempo entre 1.ª e última palavra da linha (para classificar o segmento inteiro).
 * @param {import('./musicai-types.ts').TimedWord[]} line
 */
function lineSpanMidpoint(line) {
  if (!line.length) return null;
  const a = line[0].start;
  const b = line[line.length - 1].end;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (a + b) / 2;
}

/**
 * Fração de palavras com duração &lt; maxDur (ruído típico do Whisper dentro de instrumental).
 * @param {import('./musicai-types.ts').TimedWord[]} line
 */
function fractionOfNearZeroWordDurations(line, maxDur = 0.04) {
  let n = 0;
  let bad = 0;
  for (const w of line) {
    if (w.start == null || w.end == null) continue;
    if (!Number.isFinite(w.start) || !Number.isFinite(w.end)) continue;
    n++;
    if (Math.abs(w.end - w.start) < maxDur) bad++;
  }
  return n === 0 ? 0 : bad / n;
}

/**
 * Remove **linhas inteiras** que são alucinações do Whisper dentro de instrumental/solo:
 * o meio da linha cai na zona (não-bridge) e o timing é degenerado ou o segmento é microscópico.
 * Isto apanha o caso em que uma palavra longa «segura» o segmento no tempo mas o resto é lixo a ~181 s.
 *
 * @param {import('./musicai-types.ts').TimedWord[][]} timedLines
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {import('./musicai-types.ts').TimedWord[][]}
 */
export function filterGhostLyricLinesInInstrumentalZones(timedLines, sectionsSorted) {
  const ivs = mergeInstrumentalIntervals(sectionsSorted);
  if (!ivs.length) return timedLines;

  return timedLines.filter((line) => {
    if (!line.length) return false;
    const mid = lineSpanMidpoint(line);
    if (mid == null) return true;
    if (!midpointInsideInstrumental(mid, ivs)) return true;

    const t0 = line[0].start;
    const t1 = line[line.length - 1].end;
    const wall = Number.isFinite(t0) && Number.isFinite(t1) ? t1 - t0 : 0;
    const fr = fractionOfNearZeroWordDurations(line);

    if (fr >= 0.38) return false;
    if (wall < 1.2 && line.length >= 5) return false;
    return true;
  });
}

/**
 * Renumera `g` após remover linhas/palavras (highlight e ordem global).
 * @param {import('./musicai-types.ts').TimedWord[][]} timedLines
 * @returns {import('./musicai-types.ts').TimedWord[][]}
 */
export function renumberGlobalWordIndices(timedLines) {
  let g = 0;
  return timedLines.map((line) => line.map((w) => ({ ...w, g: g++ })));
}

/**
 * @typedef {object} CifraRenderInstrumental
 * @property {'instrumental'} kind
 * @property {{ start: number, end: number, displayLabel: string }} iv
 *
 * @typedef {object} CifraRenderLyric
 * @property {'lyric'} kind
 * @property {import('./musicai-types.ts').TimedWord[]} line
 *
 * @typedef {CifraRenderInstrumental|CifraRenderLyric} CifraRenderEvent
 */

/**
 * Ordena blocos instrumentais e linhas vocais no eixo do tempo.
 *
 * @param {{ start: number, end: number, displayLabel: string }[]} instrumentalBlocks
 * @param {import('./musicai-types.ts').TimedWord[][]} vocalTimedLines
 * @returns {CifraRenderEvent[]}
 */
export function buildCifraRenderPlan(instrumentalBlocks, vocalTimedLines) {
  /** @type {CifraRenderEvent[]} */
  const events = [];

  for (const iv of instrumentalBlocks) {
    events.push({ kind: 'instrumental', iv });
  }
  for (const line of vocalTimedLines) {
    if (!line.length) continue;
    const t = line[0].start;
    const sortT = t != null && Number.isFinite(t) ? t : 0;
    events.push({ kind: 'lyric', line, sortT });
  }

  events.sort((a, b) => {
    const ta = a.kind === 'instrumental' ? a.iv.start : a.sortT;
    const tb = b.kind === 'instrumental' ? b.iv.start : b.sortT;
    if (Math.abs(ta - tb) > TIME_EPS) return ta - tb;
    if (a.kind === b.kind) return 0;
    return a.kind === 'instrumental' ? -1 : 1;
  });

  return events;
}

/**
 * `allFlat` para highlight, só palavras visíveis.
 * @param {import('./musicai-types.ts').TimedWord[][]} vocalTimedLines
 */
export function flattenVocalLines(vocalTimedLines) {
  return vocalTimedLines.flat();
}

/**
 * Unifica o intervalo [start,end] de secções consecutivas "Bridge" no JSON (mesmo truque
 * visual da intro: um bloco de acordes + cabeçalho único).
 *
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @param {import('./musicai-types.ts').MusicAiSection} hit
 */
function bridgeRunBounds(sectionsSorted, hit) {
  if (!hit || !isBridgeLabel(hit.label)) return null;
  const i0 = sectionsSorted.findIndex(
    (s) => s.start === hit.start && s.end === hit.end && s.label === hit.label
  );
  if (i0 < 0) return { start: hit.start, end: hit.end };
  let start = sectionsSorted[i0].start;
  let end = sectionsSorted[i0].end;
  for (let j = i0 - 1; j >= 0; j--) {
    const s = sectionsSorted[j];
    if (!isBridgeLabel(s.label)) break;
    start = Math.min(start, s.start);
  }
  for (let j = i0 + 1; j < sectionsSorted.length; j++) {
    const s = sectionsSorted[j];
    if (!isBridgeLabel(s.label)) break;
    end = Math.max(end, s.end);
  }
  return { start, end };
}

/**
 * Intervalo e rótulo Music.AI para um instante `t`, usando `sectionsSorted` já ordenado e
 * fundido em `mergeConsecutiveDuplicateSectionLabels` (payload.js) quando o demo arranca
 * (Intro+Intro → um só bloco).
 * Bridge: funde fatias consecutivas «Bridge» no JSON original (antes do merge global) — o merge
 * por rótulo já costuma unir; mantemos `bridgeRunBounds` para variantes de etiqueta.
 *
 * @param {number} t
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {import('./musicai-types.ts').MusicAiSection|null}
 */
export function musicAiSectionEnvelopeForTime(t, sectionsSorted) {
  if (!sectionsSorted.length || !Number.isFinite(t)) return null;
  const hit = sectionAtTimestamp(sectionsSorted, t);
  if (!hit) return null;
  if (isBridgeLabel(hit.label)) {
    const run = bridgeRunBounds(sectionsSorted, hit);
    return run ? { ...hit, start: run.start, end: run.end } : hit;
  }
  return { ...hit };
}

/**
 * Secção no cabeçalho da letra: coincide com a parte Music.AI em `t` (inclui Intro / Instrumental),
 * com intervalos do JSON já fundidos por rótulo consecutivo. Antes, Intro era tratada como «só
 * instrumental» e o cabeçalho saltava para o Verse seguinte, com tempos curtos e letra sem parte.
 *
 * @param {number} t
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @returns {import('./musicai-types.ts').MusicAiSection|null}
 */
export function vocalSectionHeaderForLyricTime(t, sectionsSorted) {
  return musicAiSectionEnvelopeForTime(t, sectionsSorted);
}
