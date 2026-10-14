import { describe, expect, it } from "vitest";

import {
  moveChordToSlot,
  moveChordToTime,
  type LyricWordSlot,
} from "@/lib/cifra/transcription-editor-model";

import { chord } from "./helpers";

/** Tempos reais de "THE LONELIEST" (Måneskin), secção Verse 3.26–18.06. */
const sections = [
  { start: 3.26, end: 18.06, label: "verse" },
  { start: 18.06, end: 32.76, label: "verse" },
];
const before = [
  chord("N", 0.54, 3.26),
  chord("D", 4.3, 7.98),
  chord("F#m/C#", 7.98, 10.64),
  chord("Bm", 10.64, 14.34),
  chord("A", 14.34, 18.06),
];
const slot = (text: string, start: number, end: number, wordIndex: number): LyricWordSlot => ({
  id: `w-${wordIndex}`,
  segmentIndex: 0,
  wordIndex,
  text,
  start,
  end,
});

const starts = (cs: { start: number }[]) => cs.map((c) => c.start);

describe("editor: arrastar acorde não desloca os outros", () => {
  it("D para a primeira palavra: estende até o F#m/C#, que continua em «of»", () => {
    const after = moveChordToSlot(before, 1, slot("You'll", 3.62, 3.99, 0), [], sections);
    expect(after[1]).toMatchObject({ start: 3.62, end: 7.98 });
    expect(starts(after)).toEqual([0.54, 3.62, 7.98, 10.64, 14.34]);
  });

  it("D para o início da secção (célula instrumental): F#m/C# não vai para «a»", () => {
    const after = moveChordToTime(before, 1, 3.26, sections);
    expect(after[1]).toMatchObject({ start: 3.26, end: 7.98 });
    expect(after[2]!.start).toBe(7.98);
  });

  it("D para a frente: encurta e o seguinte não é empurrado", () => {
    const after = moveChordToSlot(before, 1, slot("saddest", 4.84, 6.02, 3), [], sections);
    expect(after[1]).toMatchObject({ start: 4.84, end: 7.98 });
    expect(after[2]!.start).toBe(7.98);
  });

  it("D para depois do F#m/C#: só os fins dos vizinhos mudam", () => {
    const after = moveChordToTime(before, 1, 9, sections);
    expect(after[1]).toMatchObject({ start: 9, end: 10.64 });
    expect(after[2]).toMatchObject({ start: 7.98, end: 9 });
    expect(after[3]!.start).toBe(10.64);
  });
});
