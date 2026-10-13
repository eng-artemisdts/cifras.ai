/**
 * Posicionamento de acordes sobre a letra, como numa cifra:
 *
 * - o acorde fica sobre a **sílaba** em que a harmonia muda (alinhado à esquerda dela);
 * - um acorde que entra logo antes de uma palavra (antecipação) fica na 1.ª sílaba dela;
 * - uma troca durante a nota final sustentada fica **depois** da palavra;
 * - um acorde numa pausa fica **entre** as palavras (depois da anterior);
 * - nenhum acorde é descartado: os que caem em trechos sem voz são devolvidos como
 *   «instrumentais», para as faixas de acordes.
 *
 * As tolerâncias são frações do tempo musical (beat) quando há grade; sem grade, usa-se 0,25 s.
 * Módulo puro, partilhado pelo leitor e pelo editor para que mostrem o mesmo.
 */

import { collapseTrailingNoChordEvents, isNoChordEvent } from "./chord-timeline";
import type { MusicAiChordEvent, MusicAiLyricSegment } from "./musicai-types";
import { syllabifyPt } from "./syllabify-pt";

export type PlacementKind = "onset" | "after";

export type ChordPlacement = {
  /** Índice em `collapseTrailingNoChordEvents(chords)`. */
  chordIdx: number;
  /** Sílaba sobre a qual o acorde fica (`onset`); em `after`, a última sílaba. */
  syllableIndex: number;
  /** `onset`: sobre a sílaba; `after`: depois da palavra (sustentação ou pausa). */
  kind: PlacementKind;
};

export type TimedSyllable = { text: string; start: number; end: number };

/** Palavra de entrada: `key` identifica-a; `lineKey` agrupa palavras da mesma linha. */
export type PlacementWordInput = {
  key: string | number;
  lineKey: string | number;
  text: string;
  start: number;
  end: number;
};

export type PlacedWord<K = string | number> = {
  key: K;
  lineKey: string | number;
  text: string;
  start: number;
  end: number;
  syllables: TimedSyllable[];
  placements: ChordPlacement[];
};

export type ChordPlacementOptions = {
  /** Duração de um tempo (s), se houver grade. */
  beatSec?: number;
  chordTimeOffsetSec?: number;
  /**
   * `true` se o instante pertence a um trecho mostrado como faixa instrumental (sem voz).
   * Por omissão: antes da 1.ª palavra, depois da última, ou numa pausa entre linhas ≥ 1,75 s.
   */
  isInstrumentalTime?: (t: number) => boolean;
};

export type ChordPlacementResult<K = string | number> = {
  words: PlacedWord<K>[];
  instrumentalChordIdxs: number[];
};

const DEFAULT_TOL_SEC = 0.25;
const DEFAULT_MIN_GAP_SEC = 1.75;
const DEFAULT_EDGE_SEC = 0.35;

/** Sílabas de uma palavra com tempos distribuídos igualmente dentro de [start, end). */
export function syllablesWithTimes(text: string, start: number, end: number): TimedSyllable[] {
  const parts = syllabifyPt(text);
  const pieces = parts.length ? parts : [text];
  const dur = Math.max(0, end - start);
  return pieces.map((p, i) => ({
    text: p,
    start: start + (i / pieces.length) * dur,
    end: start + ((i + 1) / pieces.length) * dur,
  }));
}

function defaultInstrumentalTime(words: PlacementWordInput[]): (t: number) => boolean {
  const bounds = new Map<string | number, { start: number; end: number }>();
  for (const w of words) {
    const b = bounds.get(w.lineKey);
    if (!b) bounds.set(w.lineKey, { start: w.start, end: w.end });
    else {
      b.start = Math.min(b.start, w.start);
      b.end = Math.max(b.end, w.end);
    }
  }
  const lines = [...bounds.values()].sort((a, b) => a.start - b.start);
  const first = lines[0]?.start ?? Infinity;
  const last = lines.length ? Math.max(...lines.map((l) => l.end)) : -Infinity;
  return (t) => {
    if (t < first - DEFAULT_EDGE_SEC || t >= last + DEFAULT_EDGE_SEC) return true;
    for (let i = 0; i < lines.length - 1; i++) {
      const g0 = lines[i]!.end;
      const g1 = lines[i + 1]!.start;
      if (g1 - g0 >= DEFAULT_MIN_GAP_SEC && t >= g0 && t < g1) return true;
    }
    return false;
  };
}

/** Núcleo: posiciona cada acorde numa palavra/sílaba ou marca-o como instrumental. */
export function placeChordsOnWords<K extends string | number>(
  inputWords: (PlacementWordInput & { key: K })[],
  chords: MusicAiChordEvent[] | undefined,
  options: ChordPlacementOptions = {},
): ChordPlacementResult<K> {
  const off = Number.isFinite(options.chordTimeOffsetSec) ? Number(options.chordTimeOffsetSec) : 0;
  const tol = options.beatSec && options.beatSec > 0 ? options.beatSec / 2 : DEFAULT_TOL_SEC;
  const isInstrumental = options.isInstrumentalTime ?? defaultInstrumentalTime(inputWords);

  const words: PlacedWord<K>[] = inputWords.map((w) => ({
    ...w,
    syllables: syllablesWithTimes(w.text, w.start, w.end),
    placements: [],
  }));
  const byTime = [...words].sort((a, b) => a.start - b.start);
  const list = collapseTrailingNoChordEvents(Array.isArray(chords) ? chords : []);
  const instrumental: number[] = [];

  for (let ci = 0; ci < list.length; ci++) {
    const c = list[ci]!;
    if (isNoChordEvent(c)) continue;
    const t = Number(c.start) + off;
    if (!Number.isFinite(t)) continue;
    if (!byTime.length) {
      instrumental.push(ci);
      continue;
    }

    let containing: PlacedWord<K> | null = null;
    let next: PlacedWord<K> | null = null;
    let prev: PlacedWord<K> | null = null;
    for (const w of byTime) {
      if (w.start <= t + 1e-9 && t < w.end && (!containing || w.start >= containing.start)) containing = w;
      if (w.start > t + 1e-9 && (!next || w.start < next.start)) next = w;
      if (w.end <= t + 1e-9 && (!prev || w.end > prev.end)) prev = w;
    }

    // 1) Antecipação: o acorde entra logo antes de uma palavra → 1.ª sílaba dela.
    if (next && next.start - t <= tol && (!containing || next.start - t <= t - containing.syllables.at(-1)!.start)) {
      next.placements.push({ chordIdx: ci, syllableIndex: 0, kind: "onset" });
      continue;
    }

    // 2) Troca dentro de uma palavra → sílaba que já começou (ou começa a seguir, dentro da tolerância).
    if (containing) {
      const syl = containing.syllables;
      let k = 0;
      for (let i = 0; i < syl.length; i++) if (syl[i]!.start <= t + tol) k = i;
      const last = syl[syl.length - 1]!;
      const lastDur = Math.max(1e-3, last.end - last.start);
      const sustained = k === syl.length - 1 && t - last.start > Math.max(tol, lastDur / 2);
      containing.placements.push({ chordIdx: ci, syllableIndex: k, kind: sustained ? "after" : "onset" });
      continue;
    }

    // 3) Trecho sem voz (intro, interlúdio, final) → faixa instrumental.
    if (isInstrumental(t)) {
      instrumental.push(ci);
      continue;
    }

    // 4) Pausa curta → depois da palavra anterior, ou na seguinte se estiver mais perto e noutra linha.
    if (prev && (!next || prev.lineKey === next.lineKey || t - prev.end <= next.start - t)) {
      prev.placements.push({ chordIdx: ci, syllableIndex: prev.syllables.length - 1, kind: "after" });
      continue;
    }
    if (next) {
      next.placements.push({ chordIdx: ci, syllableIndex: 0, kind: "onset" });
      continue;
    }
    instrumental.push(ci);
  }

  for (const w of words) {
    w.placements.sort((a, b) => Number(list[a.chordIdx]!.start) - Number(list[b.chordIdx]!.start));
  }
  return { words, instrumentalChordIdxs: instrumental };
}

/** Atalho sobre o payload: palavras com id `${segmentIndex}-${wordIndex}` (como `buildWordSlots`). */
export function placeChords(
  lyrics: MusicAiLyricSegment[] | undefined,
  chords: MusicAiChordEvent[] | undefined,
  options: ChordPlacementOptions = {},
): ChordPlacementResult<string> {
  const words: (PlacementWordInput & { key: string })[] = [];
  (Array.isArray(lyrics) ? lyrics : []).forEach((seg, segmentIndex) => {
    const ws = seg.words ?? [];
    const segStart = Number.isFinite(seg.start) ? Number(seg.start) : 0;
    const segEnd = Number.isFinite(seg.end) ? Number(seg.end) : segStart + 2;
    const step = ws.length ? Math.max(0.05, segEnd - segStart) / ws.length : 0;
    ws.forEach((w, wordIndex) => {
      const s = Number.isFinite(w.start) ? Number(w.start) : segStart + wordIndex * step;
      const e = Number.isFinite(w.end) ? Number(w.end) : segStart + (wordIndex + 1) * step;
      words.push({
        key: `${segmentIndex}-${wordIndex}`,
        lineKey: segmentIndex,
        text: String(w.word ?? "").trim() || "·",
        start: s,
        end: Math.max(s + 0.02, e),
      });
    });
  });
  return placeChordsOnWords(words, chords, options);
}
