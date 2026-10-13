import { describe, expect, it } from "vitest";

import { placeChords } from "@/lib/cifra/chord-placement";

import { chord, line } from "./helpers";

/** Resumo legível: `palavra: [C]sí-la-ba` / `palavra: …[G]` (depois da palavra). */
function describePlacement(result: ReturnType<typeof placeChords>, labels: string[]) {
  return result.words
    .filter((w) => w.placements.length)
    .map((w) => {
      const parts = w.placements.map((p) =>
        p.kind === "after" ? `${w.text}…[${labels[p.chordIdx]}]` : `[${labels[p.chordIdx]}]${w.syllables[p.syllableIndex]!.text}`,
      );
      return `${w.text}: ${parts.join(" ")}`;
    });
}

describe("placeChords", () => {
  it("troca durante a nota final sustentada fica depois da palavra", () => {
    // "amor" = a (16,5–18,0) + mor (18,0–19,5); G entra a meio do "mor" sustentado.
    const chords = [chord("C", 16, 18.8), chord("G", 18.8, 20), chord("Am", 20, 22)];
    const r = placeChords(
      [line([["meu", 16.0, 16.4], ["amor", 16.5, 19.5], ["voltou", 20.0, 20.6]])],
      chords,
    );
    expect(describePlacement(r, ["C", "G", "Am"])).toEqual(["meu: [C]meu", "amor: amor…[G]", "voltou: [Am]vol"]);
  });

  it("troca no início de uma sílaba fica sobre ela (a[G]mor)", () => {
    const r = placeChords(
      [line([["meu", 16.0, 16.4], ["amor", 16.5, 19.5]])],
      [chord("C", 16, 18), chord("G", 18, 20)],
    );
    expect(describePlacement(r, ["C", "G"])).toEqual(["meu: [C]meu", "amor: [G]mor"]);
  });

  it("troca no meio da palavra fica sobre a sílaba em que acontece", () => {
    // "coração" 10–11.5 s: co(10–10.5) ra(10.5–11) ção(11–11.5); F entra em 11.0
    const r = placeChords([line([["coração", 10, 11.5]])], [chord("C", 10, 11), chord("F", 11, 13)]);
    expect(describePlacement(r, ["C", "F"])).toEqual(["coração: [C]co [F]ção"]);
  });

  it("antecipação: acorde um pouco antes da palavra fica na 1.ª sílaba dela", () => {
    const r = placeChords(
      [line([["eu", 8.0, 8.4], ["cantei", 8.5, 9.5]]), line([["voltei", 12.0, 13.0]])],
      [chord("C", 7.9, 11.9), chord("G", 11.9, 14)],
    );
    expect(describePlacement(r, ["C", "G"])).toEqual(["eu: [C]eu", "voltei: [G]vol"]);
  });

  it("acorde de passagem entre linhas não é descartado", () => {
    const r = placeChords(
      [line([["eu", 8.0, 8.4], ["cantei", 8.5, 9.8]]), line([["e", 11.0, 11.3], ["voltei", 11.4, 12.5]])],
      [chord("C", 8, 10), chord("D", 10, 10.5), chord("G", 10.5, 13)],
    );
    const labels = ["C", "D", "G"];
    const placed = r.words.flatMap((w) => w.placements.map((p) => labels[p.chordIdx]));
    expect(placed.sort()).toEqual(["C", "D", "G"]);
    expect(describePlacement(r, labels)).toContain("cantei: cantei…[D]");
  });

  it("acorde no intervalo instrumental entre frases não cai no meio da frase", () => {
    const r = placeChords(
      [line([["eu", 8, 8.4], ["vi", 8.4, 8.8], ["o", 8.8, 9.0], ["sol", 9.0, 9.4], ["nascer", 9.4, 10.0]]), line([["e", 12, 12.3], ["o", 12.3, 12.5], ["dia", 12.5, 13]])],
      [chord("C", 8, 10), chord("G", 10, 12), chord("Am", 12, 14)],
    );
    const desc = describePlacement(r, ["C", "G", "Am"]);
    // 2 s sem voz entre as frases → faixa instrumental; nunca sobre "o" no meio da frase.
    expect(r.instrumentalChordIdxs).toEqual([1]);
    expect(desc.find((d) => d.startsWith("o:"))).toBeUndefined();
  });

  it("acordes antes da voz e em pausas longas vão para as faixas instrumentais", () => {
    const r = placeChords(
      [line([["voz", 10, 11]]), line([["outra", 20, 21]])],
      [chord("A", 0, 5), chord("E", 5, 10), chord("D", 13, 18), chord("A", 18, 20)],
    );
    expect(r.instrumentalChordIdxs).toEqual([0, 1, 2, 3]);
  });

  it("ignora eventos sem acorde (N)", () => {
    const r = placeChords([line([["voz", 1, 2]])], [chord("N", 1, 1.5), chord("C", 1.5, 3)]);
    const all = r.words.flatMap((w) => w.placements.map((p) => p.chordIdx));
    expect(all).toEqual([1]);
  });
});
