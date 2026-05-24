const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

const NOTE_TO_INDEX: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

function normalizeSteps(steps: number): number {
  if (!Number.isFinite(steps)) return 0;
  return Math.trunc(steps);
}

export function transposeNoteToken(note: string, steps: number): string {
  const idx = NOTE_TO_INDEX[note];
  if (idx == null) return note;
  const n = normalizeSteps(steps);
  if (!n) return note;
  const next = ((idx + n) % 12 + 12) % 12;
  const preferFlat = note.includes("b") && !note.includes("#");
  return preferFlat ? FLAT_NOTES[next] : SHARP_NOTES[next];
}

export function transposeChordLabel(label: string, steps: number): string {
  const raw = String(label ?? "").trim();
  const n = normalizeSteps(steps);
  if (!raw || !n || raw === "—" || raw === "-") return raw;
  const m = /^([A-G](?:#|b)?)([^/]*)?(?:\/([A-G](?:#|b)?))?$/.exec(raw);
  if (!m) return raw;
  const root = transposeNoteToken(m[1]!, n);
  const quality = m[2] ?? "";
  const bass = m[3] ? transposeNoteToken(m[3], n) : "";
  return `${root}${quality}${bass ? `/${bass}` : ""}`;
}

/**
 * Transpõe textos como "D major", mantendo o sufixo livre.
 * Se o texto não começar por nota, devolve o original.
 */
export function transposeTuneLabel(label: string, steps: number): string {
  const raw = String(label ?? "").trim();
  const n = normalizeSteps(steps);
  if (!raw || !n) return raw;
  const m = /^([A-G](?:#|b)?)(.*)$/.exec(raw);
  if (!m) return raw;
  return `${transposeNoteToken(m[1]!, n)}${m[2] ?? ""}`;
}
