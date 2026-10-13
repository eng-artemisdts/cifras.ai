import { describe, expect, it } from "vitest";

import { gridChord, line, renderCifra, sheetRows } from "./helpers";

/** 2 s por compasso (120 BPM, 4/4). */
const bar = (label: string, n: number) => gridChord(label, (n - 1) * 2, n * 2, [n, 1], [n + 1, 1]);

describe("faixas instrumentais em compassos", () => {
  it("escreve a intro em compassos e indica a repetição", () => {
    const prog = ["G", "D", "Em", "C", "G", "D", "Em", "C"];
    const { container } = renderCifra(
      {
        chords: [...prog.map((l, i) => bar(l, i + 1)), bar("G", 9)],
        sections: [
          { start: 0, end: 16, label: "intro" },
          { start: 16, end: 20, label: "verse" },
        ],
        lyrics: [line([["e", 16.1, 16.5], ["agora", 16.6, 17.5]])],
      },
      20,
    );
    expect(sheetRows(container)[0]).toBe("♪ | [G] | [D] | [Em] | [C] | (2x)");
  });

  it("acordes no mesmo compasso ficam juntos entre as barras", () => {
    const chords = [
      gridChord("G", 0, 1, [1, 1], [1, 3]),
      gridChord("D", 1, 2, [1, 3], [2, 1]),
      gridChord("Em", 2, 4, [2, 1], [3, 1]),
    ];
    const { container } = renderCifra({ chords, sections: [], lyrics: [] }, 4);
    expect(sheetRows(container)).toEqual(["♪ | [G] [D] | [Em] |"]);
  });

  it("os acordes das passagens repetidas apontam para a célula desenhada", () => {
    const prog = ["A", "E", "A", "E"];
    const { container } = renderCifra({ chords: prog.map((l, i) => bar(l, i + 1)), sections: [], lyrics: [] }, 8);
    const cellA = container.querySelector<HTMLElement>('[data-chord-idx="0"]')!;
    expect(cellA.dataset.chordAliases).toBe("2");
  });
});
