import { describe, expect, it } from "vitest";

import { createChordTimeline } from "@/lib/engine/chord-timeline";
import { insertChordAtTime } from "@/lib/cifra/transcription-editor-model";
import { normalizeDemoPayload } from "@/lib/cifra/normalize-payload";

import { chord, evenLine, line, renderCifra, sectionHeaders, sheetRows } from "./helpers";

describe("ordem das seções repetidas (R1)", () => {
  const prog = ["C", "G", "Am", "F"];
  const chords = Array.from({ length: 40 }, (_, i) => chord(prog[i % 4]!, i * 2, i * 2 + 2));
  const payload = {
    chords,
    sections: [
      { start: 0, end: 8, label: "intro" },
      { start: 8, end: 24, label: "verse" },
      { start: 24, end: 40, label: "chorus" },
      { start: 40, end: 56, label: "verse" },
      { start: 56, end: 72, label: "chorus" },
      { start: 72, end: 80, label: "outro" },
    ],
    lyrics: [
      evenLine("VERSO1A um dois tres", 8.2, 3),
      evenLine("VERSO1B um dois tres", 12.2, 3),
      evenLine("REFRAO1A um dois tres", 24.2, 3),
      evenLine("REFRAO1B um dois tres", 28.2, 3),
      evenLine("VERSO2A um dois tres", 40.2, 3),
      evenLine("VERSO2B um dois tres", 44.2, 3),
      evenLine("REFRAO2A um dois tres", 56.2, 3),
      evenLine("REFRAO2B um dois tres", 60.2, 3),
    ],
  };

  it("mantém as linhas na ordem em que a música é tocada", () => {
    const { container } = renderCifra(payload, 80);
    const order = sheetRows(container)
      .filter((r) => !r.startsWith("♪"))
      .map((r) => r.match(/(VERSO|REFRAO)\d[AB]/)![0]);
    expect(order).toEqual(["VERSO1A", "VERSO1B", "REFRAO1A", "REFRAO1B", "VERSO2A", "VERSO2B", "REFRAO2A", "REFRAO2B"]);
  });

  it("cada ocorrência tem o seu bloco, com o próprio intervalo de tempo", () => {
    const { container } = renderCifra(payload, 80);
    expect(sectionHeaders(container)).toEqual([
      "Intro 0:00 — 0:08",
      "Verso 0:08 — 0:24",
      "Refrão 0:24 — 0:40",
      "Verso 0:40 — 0:56",
      "Refrão 0:56 — 1:12",
      "Final 1:12 — 1:20",
    ]);
  });

  it("nenhuma linha fica solta fora de um bloco de seção", () => {
    const { container } = renderCifra(payload, 80);
    const loose = [...container.querySelectorAll(".cifra-line")].filter((r) => !r.closest(".cifra-section"));
    expect(loose).toHaveLength(0);
  });
});

describe("blocos de seção vazios (R4)", () => {
  it("não cria bloco quando o intervalo não tem acorde a mostrar", () => {
    const { container } = renderCifra(
      {
        chords: [chord("C", 16, 18), chord("G", 18, 20), chord("Am", 20, 22)],
        sections: [{ start: 15, end: 23, label: "verse" }],
        lyrics: [line([["meu", 16.0, 16.4], ["amor", 16.5, 19.5], ["voltou", 20.0, 20.6]])],
      },
      23,
    );
    const sections = [...container.querySelectorAll(".cifra-section")];
    for (const s of sections) {
      const hasContent = [...s.querySelectorAll(".cifra-line")].some((r) => r.textContent!.replace(/ /g, "").trim());
      expect(hasContent).toBe(true);
    }
  });
});

describe("acorde no tempo (R5)", () => {
  it("num intervalo entre acordes mostra o acorde anterior, não o último da música", () => {
    const tl = createChordTimeline([chord("C", 0, 2), chord("G", 3, 5), chord("Am", 5, 7), chord("F", 7, 9)]);
    expect(tl.labelAtAudioTime(2.5)).toBe("C");
    expect(tl.labelAtAudioTime(4)).toBe("G");
  });

  it("acorde inserido por cima de outro passa a soar a partir do seu início", () => {
    const tl = createChordTimeline([chord("C", 0, 4), chord("G", 4, 8), chord("D", 2, 2.42)]);
    expect(tl.labelAtAudioTime(1)).toBe("C");
    expect(tl.labelAtAudioTime(2.2)).toBe("D");
    expect(tl.labelAtAudioTime(4.5)).toBe("G");
  });

  it("antes do primeiro acorde não há acorde", () => {
    const tl = createChordTimeline([chord("C", 1, 2)]);
    expect(tl.atAudioTime(0.5)).toBeNull();
  });
});

describe("inserir acorde no editor (E2)", () => {
  it("divide o acorde existente e o novo vale até onde ele ia", () => {
    const { chords, index } = insertChordAtTime([chord("C", 0, 4), chord("G", 4, 8)], "D", 2, 2.42);
    expect(chords.map((c) => [c.chord_simple_pop, c.start, c.end])).toEqual([
      ["C", 0, 2],
      ["D", 2, 4],
      ["G", 4, 8],
    ]);
    expect(index).toBe(1);
  });

  it("num intervalo sem acorde, vai até o próximo acorde", () => {
    const { chords } = insertChordAtTime([chord("C", 0, 2), chord("G", 6, 8)], "D", 3, 3.4);
    expect(chords.find((c) => c.chord_simple_pop === "D")).toMatchObject({ start: 3, end: 6 });
  });

  it("no mesmo instante de outro acorde, substitui-o", () => {
    const { chords } = insertChordAtTime([chord("C", 0, 4)], "Am", 0, 1);
    expect(chords.map((c) => c.chord_simple_pop)).toEqual(["Am"]);
  });
});

describe("payload normalizado", () => {
  it("ordena os acordes por início", () => {
    const p = normalizeDemoPayload({ chords: [chord("G", 4, 8), chord("C", 0, 4)], lyrics: [], sections: [] });
    expect(p.chords!.map((c) => c.chord_simple_pop)).toEqual(["C", "G"]);
  });
});
