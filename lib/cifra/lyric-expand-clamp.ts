import type { MusicAiChordEvent, MusicAiLyricSegment, MusicAiSection } from "./musicai-types";

type LyricWordExt = {
  word?: string;
  start?: number;
  end?: number;
  syllables?: { syllable?: string; start?: number; end?: number }[];
};

const REF_MAX_WORD_SEC = 3.5;
const MERGED_LINE_RATIO = 2.0;
const MERGED_WORD_MAX_SEC = 8.0;

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function getWordsText(seg: MusicAiLyricSegment): string {
  const words = seg.words ?? [];
  return words
    .map((w) => String(w.word ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function segmentKey(seg: MusicAiLyricSegment): string {
  const fromText = normalizeText(String(seg.text ?? ""));
  const fromWords = normalizeText(getWordsText(seg));
  const text = fromText || fromWords;
  if (!text) return "";
  return `${text}#${seg.words?.length ?? 0}`;
}

function segmentDuration(seg: MusicAiLyricSegment): number {
  const a = Number(seg.start);
  const b = Number(seg.end);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : 0;
}

function maxWordDuration(seg: MusicAiLyricSegment): number {
  const words = seg.words ?? [];
  let max = 0;
  for (const w of words) {
    const a = Number(w.start);
    const b = Number(w.end);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) max = Math.max(max, b - a);
  }
  return max;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function mapTime(t: number, srcStart: number, srcEnd: number, dstStart: number, dstEnd: number): number {
  if (!Number.isFinite(t) || srcEnd <= srcStart) return t;
  return dstStart + ((t - srcStart) / (srcEnd - srcStart)) * (dstEnd - dstStart);
}

function cloneSegmentSlice(seg: MusicAiLyricSegment, start: number, end: number): MusicAiLyricSegment {
  const srcStart = Number(seg.start);
  const srcEnd = Number(seg.end);
  const words = (seg.words ?? []) as LyricWordExt[];

  const mappedWords = words.map((w) => {
    const baseWord = String(w.word ?? "");
    return {
      word: baseWord,
      start: Number.isFinite(Number(w.start)) ? mapTime(Number(w.start), srcStart, srcEnd, start, end) : w.start,
      end: Number.isFinite(Number(w.end)) ? mapTime(Number(w.end), srcStart, srcEnd, start, end) : w.end,
      syllables: Array.isArray(w.syllables)
        ? w.syllables.map((s) => ({
            ...s,
            start: Number.isFinite(Number(s.start))
              ? mapTime(Number(s.start), srcStart, srcEnd, start, end)
              : s.start,
            end: Number.isFinite(Number(s.end)) ? mapTime(Number(s.end), srcStart, srcEnd, start, end) : s.end,
          }))
        : w.syllables,
    };
  });

  return {
    ...seg,
    start,
    end,
    words: mappedWords,
  };
}

/** Corrige linhas «fundidas» em alguns lyrics Match (POC). */
export function expandMergedLyricSegments(lyrics: MusicAiLyricSegment[]): MusicAiLyricSegment[] {
  if (!Array.isArray(lyrics) || lyrics.length < 2) return lyrics;

  const groups = new Map<string, MusicAiLyricSegment[]>();
  for (const seg of lyrics) {
    const key = segmentKey(seg);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(seg);
    groups.set(key, list);
  }

  const out: MusicAiLyricSegment[] = [];
  for (const seg of lyrics) {
    const key = segmentKey(seg);
    const group = key ? groups.get(key) : null;
    if (!group || group.length < 2) {
      out.push(seg);
      continue;
    }

    const span = segmentDuration(seg);
    const maxWord = maxWordDuration(seg);

    const refs = group.filter((g) => g !== seg && maxWordDuration(g) <= REF_MAX_WORD_SEC);
    const refMedian = median(refs.map(segmentDuration).filter((d) => d > 0));

    const looksMerged =
      refMedian > 0 &&
      span >= refMedian * MERGED_LINE_RATIO &&
      maxWord >= MERGED_WORD_MAX_SEC &&
      Number.isFinite(Number(seg.start)) &&
      Number.isFinite(Number(seg.end));

    if (!looksMerged) {
      out.push(seg);
      continue;
    }

    const start = Number(seg.start);
    const end = Number(seg.end);
    const mid = start + (end - start) / 2;
    out.push(cloneSegmentSlice(seg, start, mid));
    out.push(cloneSegmentSlice(seg, mid, end));
  }

  return out;
}

const EPS = 1e-4;

function sectionForChordOnset(sectionsSorted: MusicAiSection[], t: number): MusicAiSection | null {
  if (!sectionsSorted.length || !Number.isFinite(t)) return null;
  for (const s of sectionsSorted) {
    const a = Number(s.start);
    const b = Number(s.end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) continue;
    if (t >= a && t < b) {
      return { start: a, end: b, label: String(s.label ?? "") };
    }
  }
  if (t < Number(sectionsSorted[0].start)) return null;
  let best: MusicAiSection | null = null;
  for (const s of sectionsSorted) {
    const a = Number(s.start);
    if (Number.isFinite(a) && a <= t) {
      best = { start: a, end: Number(s.end), label: String(s.label ?? "") };
    }
  }
  return best;
}

export function clampChordEndsToSectionBoundaries(
  chords: MusicAiChordEvent[],
  sectionsSorted: MusicAiSection[],
): MusicAiChordEvent[] {
  if (!Array.isArray(chords) || !chords.length || !sectionsSorted.length) return chords;
  return chords.map((c) => {
    const st = Number(c.start);
    const en = Number(c.end);
    if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st + EPS) return { ...c };
    const sec = sectionForChordOnset(sectionsSorted, st);
    if (!sec) return { ...c };
    const cap = Number(sec.end);
    if (!Number.isFinite(cap) || en <= cap + EPS) return { ...c };
    const next: MusicAiChordEvent = { ...c, end: cap };
    if (Math.abs(en - cap) > 1e-3) {
      delete next.start_bar;
      delete next.start_beat;
      delete next.end_bar;
      delete next.end_beat;
    }
    return next;
  });
}

export function sortSections(sections: MusicAiSection[]): MusicAiSection[] {
  return sections.slice().sort((a, b) => a.start - b.start);
}

function normalizeSectionLabel(label: string | null | undefined): string {
  return String(label ?? "")
    .trim()
    .toLowerCase();
}

export function mergeConsecutiveDuplicateSectionLabels(
  sectionsSorted: MusicAiSection[],
): MusicAiSection[] {
  if (!sectionsSorted.length) return sectionsSorted;
  const out: MusicAiSection[] = [];
  for (const section of sectionsSorted) {
    const start = Number(section.start);
    const end = Number(section.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const label = String(section.label ?? "").trim() || "—";
    const last = out[out.length - 1];
    if (last && normalizeSectionLabel(last.label) === normalizeSectionLabel(label)) {
      last.end = Math.max(Number(last.end), end);
    } else {
      out.push({ start, end, label });
    }
  }
  return out;
}
