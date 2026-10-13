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
