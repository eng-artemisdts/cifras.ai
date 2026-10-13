import { describe, expect, it } from "vitest";

import { syllabifyPt } from "@/lib/cifra/syllabify-pt";

describe("syllabifyPt", () => {
  it.each([
    ["casa", "ca-sa"],
    ["amor", "a-mor"],
    ["coração", "co-ra-ção"],
    ["nascer", "nas-cer"],
    ["carro", "car-ro"],
    ["palha", "pa-lha"],
    ["livro", "li-vro"],
    ["chuva", "chu-va"],
    ["dia", "di-a"],
    ["poesia", "po-e-si-a"],
    ["saudade", "sau-da-de"],
    ["quando", "quan-do"],
    ["guerra", "guer-ra"],
    ["clareou", "cla-re-ou"],
    ["perspicaz", "pers-pi-caz"],
    ["mãe", "mãe"],
    ["violão", "vi-o-lão"],
    ["sol", "sol"],
    ["Domingo,", "Do-min-go,"],
    ["saída", "sa-í-da"],
    ["pai", "pai"],
  ])("%s → %s", (word, expected) => {
    expect(syllabifyPt(word).join("-")).toBe(expected);
  });

  it("a concatenação das sílabas é a palavra original", () => {
    for (const w of ["Everywhere", "someone's", "getting", "over", "ninguém", "x", "!!"]) {
      expect(syllabifyPt(w).join("")).toBe(w);
    }
  });
});
