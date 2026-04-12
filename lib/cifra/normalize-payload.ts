import {
  clampChordEndsToSectionBoundaries,
  expandMergedLyricSegments,
  mergeConsecutiveDuplicateSectionLabels,
  sortSections,
} from "./lyric-expand-clamp";
import type { MusicAiDemoPayload, MusicAiSection } from "./musicai-types";

export function normalizeDemoPayload(raw: MusicAiDemoPayload | null | undefined): MusicAiDemoPayload {
  const payload = raw && typeof raw === "object" ? raw : {};
  const rawLyrics = Array.isArray(payload.lyrics) ? payload.lyrics : [];
  const rawSections = Array.isArray(payload.sections) ? payload.sections : [];
  const sectionsSorted = mergeConsecutiveDuplicateSectionLabels(
    sortSections(rawSections as MusicAiSection[]),
  );
  const rawChords = Array.isArray(payload.chords) ? payload.chords : [];
  return {
    chords: clampChordEndsToSectionBoundaries(rawChords, sectionsSorted),
    lyrics: expandMergedLyricSegments(rawLyrics),
    sections: sectionsSorted,
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
    chordTimeOffsetSec: Number.isFinite(payload.chordTimeOffsetSec) ? Number(payload.chordTimeOffsetSec) : 0,
  };
}
