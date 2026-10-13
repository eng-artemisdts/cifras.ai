import { describe, expect, it } from "vitest";

import { parseKey, spellChordForKey } from "@/lib/cifra/chord-spelling";

describe("parseKey", () => {
  it.each([
    ["G# major", { pc: 8, minor: false }],
    ["Ab", { pc: 8, minor: false }],
    ["F minor", { pc: 5, minor: true }],
    ["Fm", { pc: 5, minor: true }],
    ["C#m", { pc: 1, minor: true }],
    ["Bb maj", { pc: 10, minor: false }],
  ])("%s", (raw, expected) => {
    expect(parseKey(raw)).toEqual(expected);
  });

  it("texto que não é tonalidade", () => {
    expect(parseKey("E standard")).toBeNull();
    expect(parseKey("Eb standard")).toBeNull();
    expect(parseKey("")).toBeNull();
  });
});

describe("spellChordForKey", () => {
  it("tom de Lá♭ maior escreve bemóis (Music.ai devolve G#)", () => {
    expect(spellChordForKey("G#", "G# major")).toBe("Ab");
    expect(spellChordForKey("C#", "G# major")).toBe("Db");
    expect(spellChordForKey("D#7", "G# major")).toBe("Eb7");
    expect(spellChordForKey("Fm", "G# major")).toBe("Fm");
    expect(spellChordForKey("C/G", "G# major")).toBe("C/G");
  });

  it("tom de Fá menor escreve bemóis, inclusive no baixo", () => {
    expect(spellChordForKey("A#m/C#", "F minor")).toBe("Bbm/Db");
  });

  it("tom de Mi maior mantém sustenidos", () => {
    expect(spellChordForKey("C#m", "E major")).toBe("C#m");
    expect(spellChordForKey("G#m", "E")).toBe("G#m");
  });

  it("segue a transposição do utilizador (Lá maior +1 = Si♭ maior)", () => {
    expect(spellChordForKey("D#", "A major", 1)).toBe("Eb");
  });

  it("sem tom conhecido, mantém o rótulo", () => {
    expect(spellChordForKey("G#", "")).toBe("G#");
    expect(spellChordForKey("N.C.", "C major")).toBe("N.C.");
  });
});
