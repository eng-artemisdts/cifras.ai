// @ts-nocheck
import { expandMergedLyricSegments } from "@/lib/cifra/lyric-expand-clamp";

/**
 * Leitura e normalização do payload (igual à POC `payload.js`).
 */
export function readPayload(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const rawLyrics = Array.isArray(p.lyrics) ? p.lyrics : [];
  return {
    chords: Array.isArray(p.chords) ? p.chords : [],
    lyrics: expandMergedLyricSegments(rawLyrics),
    sections: Array.isArray(p.sections) ? p.sections : [],
    meta: p.meta && typeof p.meta === "object" ? p.meta : {},
    chordTimeOffsetSec: Number.isFinite(p.chordTimeOffsetSec) ? p.chordTimeOffsetSec : 0,
  };
}

export function sortSections(sections) {
  return sections.slice().sort((a, b) => a.start - b.start);
}

function normSectionLabel(l) {
  return String(l ?? "")
    .trim()
    .toLowerCase();
}

export function mergeConsecutiveDuplicateSectionLabels(sectionsSorted) {
  if (!sectionsSorted.length) return sectionsSorted;
  const out = [];
  for (const s of sectionsSorted) {
    const st = Number(s.start);
    const en = Number(s.end);
    if (!Number.isFinite(st) || !Number.isFinite(en) || en <= st) continue;
    const label = String(s.label ?? "").trim() || "—";
    const last = out[out.length - 1];
    if (last && normSectionLabel(last.label) === normSectionLabel(label)) {
      last.end = Math.max(Number(last.end), en);
    } else {
      out.push({ start: st, end: en, label });
    }
  }
  return out;
}
