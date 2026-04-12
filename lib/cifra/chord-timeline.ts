import type { MusicAiChordEvent } from "./musicai-types";

export function isNoChordEvent(c: MusicAiChordEvent | null | undefined): boolean {
  if (!c || typeof c !== "object") return false;
  const fields = [
    c.chord_simple_pop,
    c.chord_basic_pop,
    c.chord_majmin,
    c.chord_simple_jazz,
    c.chord_basic_jazz,
    c.chord_complex_pop,
    c.chord_complex_nashville,
    c.chord_simple_nashville,
    c.chord_basic_nashville,
  ];
  for (const v of fields) {
    if (v == null) continue;
    const u = String(v).trim().toUpperCase();
    if (u === "N" || u === "NC" || u.startsWith("N:")) return true;
  }
  return false;
}

export function formatChordLabel(c: MusicAiChordEvent | null | undefined): string {
  if (!c) return "—";
  if (isNoChordEvent(c)) return "-";
  let s = c.chord_simple_pop || c.chord_basic_pop || "";
  if (c.bass) s += `/${c.bass}`;
  return s || "—";
}

export function collapseTrailingNoChordEvents(chords: MusicAiChordEvent[]): MusicAiChordEvent[] {
  const out = Array.isArray(chords) ? chords.map((c) => ({ ...c })) : [];
  if (!out.length) return out;

  let iLastPlayed = -1;
  for (let i = out.length - 1; i >= 0; i--) {
    if (!isNoChordEvent(out[i])) {
      iLastPlayed = i;
      break;
    }
  }

  if (iLastPlayed >= 0 && iLastPlayed < out.length - 1) {
    const tailEnd = Number(out[out.length - 1].end);
    const lastPlayedEnd = Number(out[iLastPlayed].end);
    if (Number.isFinite(tailEnd) && Number.isFinite(lastPlayedEnd) && tailEnd > lastPlayedEnd) {
      out[iLastPlayed].end = tailEnd;
    }
    out.length = iLastPlayed + 1;
  }
  return out;
}

export function createChordTimeline(chords: MusicAiChordEvent[], options: { offsetSec?: number } = {}) {
  const offsetSec = Number.isFinite(options.offsetSec) ? Number(options.offsetSec) : 0;
  const normalizedChords = collapseTrailingNoChordEvents(chords);

  function toChordTime(tAudio: number) {
    return tAudio - offsetSec;
  }

  function atChordTime(tChord: number): MusicAiChordEvent | null {
    for (let i = 0; i < normalizedChords.length; i++) {
      const c = normalizedChords[i];
      if (tChord >= c.start && tChord < c.end) return c;
    }
    if (normalizedChords.length && tChord < normalizedChords[0].start) return null;
    return normalizedChords.length ? normalizedChords[normalizedChords.length - 1] : null;
  }

  function atAudioTime(tAudio: number) {
    return atChordTime(toChordTime(tAudio));
  }

  const gridStartChordTime = normalizedChords.length ? normalizedChords[0].start : 0;
  const gridStartAudioTime = normalizedChords.length ? gridStartChordTime + offsetSec : 0;

  return {
    gridStartAudioTime,
    atAudioTime,
    labelAtAudioTime(tAudio: number) {
      return formatChordLabel(atAudioTime(tAudio));
    },
  };
}

export type ChordSeg = { a0: number; a1: number; label: string; chordIdx: number };

export function chordSegmentsInAudioWindow(
  chords: MusicAiChordEvent[],
  tWin0: number,
  tWin1: number,
  offsetSec = 0,
  options: { formatChord?: (c: MusicAiChordEvent) => string } = {},
): ChordSeg[] {
  const fmt = typeof options.formatChord === "function" ? options.formatChord : formatChordLabel;
  const off = Number.isFinite(offsetSec) ? offsetSec : 0;
  const normalizedChords = collapseTrailingNoChordEvents(chords);
  const out: ChordSeg[] = [];
  for (let i = 0; i < normalizedChords.length; i++) {
    const c = normalizedChords[i];
    const cA0 = c.start + off;
    const cA1 = c.end + off;
    if (cA1 <= tWin0 || cA0 >= tWin1) continue;
    const a0 = Math.max(tWin0, cA0);
    const a1 = Math.min(tWin1, cA1);
    if (a1 > a0 + 1e-6) {
      out.push({ a0, a1, label: fmt(c), chordIdx: i });
    }
  }
  out.sort((x, y) => x.a0 - y.a0);
  return out;
}

export function collapseSequentialEqualChordSegments(
  segs: { label: string; a0: number; a1: number; chordIdx?: number }[],
): { label: string; a0: number; a1: number; chordIdx?: number }[] {
  const out: { label: string; a0: number; a1: number; chordIdx?: number }[] = [];
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    const last = out[out.length - 1];
    if (last && last.label === s.label) {
      last.a1 = Math.max(last.a1, s.a1);
      continue;
    }
    out.push({ label: s.label, a0: s.a0, a1: s.a1, chordIdx: s.chordIdx });
  }
  return out;
}

export function dropChordSegmentsOriginatingBeforeSection(
  segs: ChordSeg[],
  chords: MusicAiChordEvent[],
  chordTimeOffsetSec: number,
  sectionStartAudio: number,
  apply: boolean,
): ChordSeg[] {
  if (!apply || !Array.isArray(segs) || !segs.length || !Number.isFinite(sectionStartAudio)) return segs;
  const off = Number.isFinite(chordTimeOffsetSec) ? chordTimeOffsetSec : 0;
  const normalized = collapseTrailingNoChordEvents(chords);
  const sec0 = Number(sectionStartAudio);
  const filtered = segs.filter((seg) => {
    if (!Number.isFinite(seg.chordIdx)) return true;
    const c = normalized[seg.chordIdx as number];
    if (!c) return false;
    const onset = Number(c.start) + off;
    return !Number.isFinite(onset) || onset >= sec0 - 1e-3;
  });
  return collapseSequentialEqualChordSegments(filtered) as ChordSeg[];
}

export function chordEventOnsetAudioSec(
  chords: MusicAiChordEvent[],
  chordIdx: number,
  chordTimeOffsetSec: number,
): number {
  const normalized = collapseTrailingNoChordEvents(Array.isArray(chords) ? chords : []);
  const c = normalized[chordIdx];
  if (!c) return NaN;
  const chordStart = Number(c.start);
  const off = Number.isFinite(chordTimeOffsetSec) ? chordTimeOffsetSec : 0;
  return Number.isFinite(chordStart) ? chordStart + off : NaN;
}
