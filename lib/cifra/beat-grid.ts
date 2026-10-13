/**
 * Grade de tempos derivada dos acordes da Music.ai (`start_bar/start_beat/end_bar/end_beat`).
 * Usada para exprimir tolerâncias em tempos musicais e para desenhar compassos nas faixas
 * instrumentais.
 */

import type { MusicAiChordEvent } from "./musicai-types";

export const DEFAULT_BEATS_PER_BAR = 4;

function absBeat(bar: number, beat: number, beatsPerBar: number): number {
  return (bar - 1) * beatsPerBar + (beat - 1);
}

function hasGrid(c: MusicAiChordEvent): boolean {
  return [c.start_bar, c.start_beat, c.end_bar, c.end_beat].every(
    (n) => typeof n === "number" && Number.isFinite(n) && n >= 1,
  );
}

/** Duração mediana de um tempo (s) a partir dos acordes com compasso/tempo; `undefined` sem grade. */
export function estimateBeatSec(
  chords: MusicAiChordEvent[] | undefined,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): number | undefined {
  const samples: number[] = [];
  for (const c of chords ?? []) {
    if (!hasGrid(c)) continue;
    const beats =
      absBeat(Number(c.end_bar), Number(c.end_beat), beatsPerBar) -
      absBeat(Number(c.start_bar), Number(c.start_beat), beatsPerBar);
    const secs = Number(c.end) - Number(c.start);
    if (beats > 0 && secs > 0) samples.push(secs / beats);
  }
  if (!samples.length) return undefined;
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  const med = samples.length % 2 ? samples[mid]! : (samples[mid - 1]! + samples[mid]!) / 2;
  // 30–300 BPM
  return med >= 0.2 && med <= 2 ? med : undefined;
}

/** Número do compasso (1-based) em que o acorde começa, se houver grade. */
export function chordStartBar(c: MusicAiChordEvent): number | null {
  return hasGrid(c) ? Number(c.start_bar) : null;
}

export type BeatMap = {
  /** Tempo absoluto (fracionário, 0-based) num instante (s). */
  beatAt: (t: number) => number;
  /** Instante (s) de um tempo absoluto. */
  timeAt: (beat: number) => number;
};

/**
 * Mapa tempo ↔ batida por interpolação entre os inícios/fins dos acordes com grade
 * (extrapola nas pontas). `null` sem pelo menos dois pontos de grade.
 */
export function buildBeatMap(
  chords: MusicAiChordEvent[] | undefined,
  beatsPerBar = DEFAULT_BEATS_PER_BAR,
): BeatMap | null {
  const raw: { t: number; b: number }[] = [];
  for (const c of chords ?? []) {
    if (!hasGrid(c)) continue;
    const s = Number(c.start);
    const e = Number(c.end);
    const bs = absBeat(Number(c.start_bar), Number(c.start_beat), beatsPerBar);
    const be = absBeat(Number(c.end_bar), Number(c.end_beat), beatsPerBar);
    if (!(e > s) || !(be > bs)) continue;
    raw.push({ t: s, b: bs }, { t: e, b: be });
  }
  raw.sort((a, b) => a.t - b.t);
  const pts: { t: number; b: number }[] = [];
  for (const p of raw) {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last.t - p.t) < 1e-6) last.b = (last.b + p.b) / 2;
    else if (!last || p.b > last.b) pts.push({ ...p });
  }
  if (pts.length < 2) return null;

  const interp = (x: number, xs: number[], ys: number[]) => {
    const n = xs.length;
    let i = 0;
    if (x <= xs[0]!) i = 0;
    else if (x >= xs[n - 1]!) i = n - 2;
    else while (i < n - 2 && x > xs[i + 1]!) i++;
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const y0 = ys[i]!;
    const y1 = ys[i + 1]!;
    return Math.abs(x1 - x0) < 1e-9 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  };
  const ts = pts.map((p) => p.t);
  const bs = pts.map((p) => p.b);
  return {
    beatAt: (t) => interp(t, ts, bs),
    timeAt: (b) => interp(b, bs, ts),
  };
}

/** Encaixa um instante no tempo mais próximo da grade; sem grade, devolve o instante. */
export function snapTimeToBeat(t: number, map: BeatMap | null): number {
  if (!map || !Number.isFinite(t)) return t;
  return Math.max(0, map.timeAt(Math.round(map.beatAt(t))));
}
