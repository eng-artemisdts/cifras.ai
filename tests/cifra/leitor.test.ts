import { describe, expect, it } from "vitest";

import { formatChordLabel, isNoChordEvent } from "@/lib/cifra/chord-timeline";
import type { MusicAiChordEvent } from "@/lib/cifra/musicai-types";

import real from "./fixtures/music-ai-real.json";
import { chord, line, renderCifra, sheetRows } from "./helpers";

describe("leitor: acorde sobre a sílaba", () => {
  it("troca no início de uma sílaba aparece sobre ela", () => {
    const { container } = renderCifra(
      {
        chords: [chord("C", 16, 18), chord("G", 18, 20)],
        sections: [{ start: 15, end: 21, label: "verse" }],
        lyrics: [line([["meu", 16.0, 16.4], ["amor", 16.5, 19.5]])],
      },
      21,
    );
    expect(sheetRows(container)).toEqual(["[C]meu a[G]mor"]);
  });

  it("troca durante a nota final sustentada aparece depois da palavra", () => {
    const { container } = renderCifra(
      {
        chords: [chord("C", 16, 18.8), chord("G", 18.8, 20), chord("Am", 20, 22)],
        sections: [{ start: 15, end: 23, label: "verse" }],
        lyrics: [line([["meu", 16.0, 16.4], ["amor", 16.5, 19.5], ["voltou", 20.0, 20.6]])],
      },
      23,
    );
    expect(sheetRows(container)).toEqual(["[C]meu amor [G] [Am]voltou"]);
  });

  it("acorde de passagem entre linhas não some", () => {
    const { container } = renderCifra(
      {
        chords: [chord("C", 8, 10), chord("D", 10, 10.5), chord("G", 10.5, 13)],
        sections: [{ start: 7, end: 14, label: "verse" }],
        lyrics: [line([["eu", 8.0, 8.4], ["cantei", 8.5, 9.8]]), line([["e", 11.0, 11.3], ["voltei", 11.4, 12.5]])],
      },
      14,
    );
    expect(sheetRows(container)).toEqual(["[C]eu can-tei [D]".replace("-", ""), "[G]e voltei"]);
  });

  it("acordes do intervalo instrumental vão para a faixa, não para o meio da frase", () => {
    const { container } = renderCifra(
      {
        chords: [chord("C", 8, 10), chord("G", 10, 12), chord("Am", 12, 14)],
        sections: [{ start: 7, end: 15, label: "verse" }],
        lyrics: [
          line([["eu", 8, 8.4], ["vi", 8.4, 8.8], ["o", 8.8, 9.0], ["sol", 9.0, 9.4], ["nascer", 9.4, 10.0]]),
          line([["e", 12, 12.3], ["o", 12.3, 12.5], ["dia", 12.5, 13]]),
        ],
      },
      15,
    );
    expect(sheetRows(container)).toEqual(["[C]eu vi o sol nascer", "♪ [G]", "[Am]e o dia"]);
  });

  it("música sem letra mostra todos os acordes numa faixa", () => {
    const { container } = renderCifra(
      { chords: [chord("A", 0, 2), chord("E", 2, 4), chord("D", 4, 6)], sections: [], lyrics: [] },
      6,
    );
    expect(sheetRows(container)).toEqual(["♪ [A] [E] [D]"]);
  });
});

describe("leitor: exemplo real da Music.ai", () => {
  const chords = real.chords as MusicAiChordEvent[];
  const { container } = renderCifra({ chords, lyrics: real.lyrics, sections: real.sections }, 260);

  it("todo acorde real aparece (exceto repetições seguidas do mesmo acorde)", () => {
    const shown = new Set(
      [...container.querySelectorAll<HTMLElement>("[data-chord-idx]")].map((el) => Number(el.dataset.chordIdx)),
    );
    const missing: number[] = [];
    let prevLabel = "";
    chords.forEach((c, i) => {
      if (isNoChordEvent(c)) return;
      const label = formatChordLabel(c);
      if (!shown.has(i) && label !== prevLabel) missing.push(i);
      prevLabel = label;
    });
    expect(missing).toEqual([]);
  });

  it("as linhas cantadas estão na ordem da música", () => {
    const gs = [...container.querySelectorAll<HTMLElement>(".cifra-line:not([data-instrumental-strip])")]
      .map((r) => Number(r.querySelector<HTMLElement>("[data-g]")?.dataset.g))
      .filter(Number.isFinite);
    expect(gs).toEqual([...gs].sort((a, b) => a - b));
  });

  it("nenhuma linha fica fora de um bloco de seção", () => {
    const loose = [...container.querySelectorAll(".cifra-line")].filter((r) => !r.closest(".cifra-section"));
    expect(loose).toHaveLength(0);
  });
});
