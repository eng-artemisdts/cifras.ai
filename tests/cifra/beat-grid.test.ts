import { describe, expect, it } from "vitest";

import { buildBeatMap, estimateBeatSec, snapTimeToBeat } from "@/lib/cifra/beat-grid";

import { gridChord } from "./helpers";

// 120 BPM (tempo 0,5 s), 1.º compasso começa em 0,25 s.
const chords = [
  gridChord("C", 0.25, 2.25, [1, 1], [2, 1]),
  gridChord("G", 2.25, 4.25, [2, 1], [3, 1]),
  gridChord("Am", 4.25, 6.25, [3, 1], [4, 1]),
];

describe("grade de tempos", () => {
  it("estima a duração do tempo", () => {
    expect(estimateBeatSec(chords)).toBeCloseTo(0.5);
  });

  it("converte tempo ↔ batida", () => {
    const map = buildBeatMap(chords)!;
    expect(map.beatAt(2.25)).toBeCloseTo(4);
    expect(map.timeAt(6)).toBeCloseTo(3.25);
  });

  it("encaixa no tempo mais próximo", () => {
    const map = buildBeatMap(chords);
    expect(snapTimeToBeat(3.1, map)).toBeCloseTo(3.25);
    expect(snapTimeToBeat(2.4, map)).toBeCloseTo(2.25);
  });

  it("sem grade, não mexe no instante", () => {
    expect(snapTimeToBeat(3.1, buildBeatMap([]))).toBe(3.1);
  });
});
