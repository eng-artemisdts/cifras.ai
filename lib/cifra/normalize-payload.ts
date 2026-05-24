import {
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
  const capoRaw = Number.isFinite(payload.capo_at) ? Math.round(Number(payload.capo_at)) : 0;
  return {
    // Preserve original chord spans (some tracks intentionally sustain across section boundaries).
    chords: rawChords.map((c) => ({ ...c })),
    lyrics: expandMergedLyricSegments(rawLyrics),
    sections: sectionsSorted,
    meta: payload.meta && typeof payload.meta === "object" ? payload.meta : {},
    chordTimeOffsetSec: Number.isFinite(payload.chordTimeOffsetSec) ? Number(payload.chordTimeOffsetSec) : 0,
    ...(typeof payload.userId === "string" && payload.userId.trim()
      ? { userId: payload.userId.trim() }
      : {}),
    original_tune: typeof payload.original_tune === "string" ? payload.original_tune : "",
    capo_at: Math.min(24, Math.max(0, capoRaw)),
    is_private: payload.is_private === true,
  };
}
