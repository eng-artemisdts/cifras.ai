/**
 * Grafia dos acordes conforme o tom, como numa cifra: num tom com bemóis (ex.: Lá♭ maior,
 * Fá menor) escreve-se `Ab`, `Db`, `Bb/D`; num tom com sustenidos, `G#`, `C#`. A Music.ai
 * devolve sempre sustenidos.
 */

const NOTE_PC: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};
const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Tons maiores escritos com bemóis: Fá, Si♭, Mi♭, Lá♭, Ré♭. */
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1]);
/** Tons menores escritos com bemóis: Ré, Sol, Dó, Fá, Si♭, Mi♭ menor. */
const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]);

export type ParsedKey = { pc: number; minor: boolean };

/** Lê textos de tonalidade como «G# major», «Ab», «F minor», «Fm», «C#m», «Bb maj». */
export function parseKey(raw: string | null | undefined): ParsedKey | null {
  const s = String(raw ?? "").trim();
  const m = /^([A-Ga-g])([#b♯♭]?)\s*(.*)$/.exec(s);
  if (!m) return null;
  const note = m[1]!.toUpperCase() + (m[2] === "♯" ? "#" : m[2] === "♭" ? "b" : m[2] ?? "");
  const pc = NOTE_PC[note];
  if (pc == null) return null;
  const rest = (m[3] ?? "").trim().toLowerCase();
  // «E standard», «Drop D», «afinação…» descrevem a afinação, não a tonalidade.
  if (/standard|drop|afina|tuning|meio tom|half/.test(rest)) return null;
  const minor = /^(m(?!aj)|min|minor|menor)/.test(rest);
  return { pc, minor };
}

export function keyUsesFlats(key: ParsedKey): boolean {
  return key.minor ? FLAT_MINOR.has(key.pc) : FLAT_MAJOR.has(key.pc);
}

function respellNote(note: string, flats: boolean): string {
  const pc = NOTE_PC[note];
  if (pc == null) return note;
  const isAccidental = note.length > 1;
  if (!isAccidental) return note;
  return flats ? FLATS[pc]! : SHARPS[pc]!;
}

/**
 * Reescreve a fundamental e o baixo do acorde segundo o tom. `semitones` desloca o tom
 * (transposição feita pelo utilizador) antes de decidir entre sustenidos e bemóis.
 */
export function spellChordForKey(label: string, keyRaw: string | null | undefined, semitones = 0): string {
  const raw = String(label ?? "").trim();
  const key = parseKey(keyRaw);
  if (!raw || !key) return raw;
  const shifted: ParsedKey = { pc: (((key.pc + Math.trunc(semitones)) % 12) + 12) % 12, minor: key.minor };
  const flats = keyUsesFlats(shifted);
  const m = /^([A-G](?:#|b)?)([^/]*)?(?:\/([A-G](?:#|b)?))?$/.exec(raw);
  if (!m) return raw;
  const root = respellNote(m[1]!, flats);
  const bass = m[3] ? respellNote(m[3], flats) : "";
  return `${root}${m[2] ?? ""}${bass ? `/${bass}` : ""}`;
}
