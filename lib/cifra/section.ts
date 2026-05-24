import type { MusicAiSection } from "./musicai-types";

export function sectionAtTimestamp(
  sectionsSorted: MusicAiSection[],
  ts: number | null | undefined,
): MusicAiSection | null {
  if (ts == null || !Number.isFinite(ts) || !sectionsSorted.length) return null;

  for (let i = 0; i < sectionsSorted.length; i++) {
    const s = sectionsSorted[i];
    if (ts >= s.start && ts < s.end) return s;
  }

  if (ts < sectionsSorted[0].start) return sectionsSorted[0];

  let last = sectionsSorted[0];
  for (let i = 0; i < sectionsSorted.length; i++) {
    if (sectionsSorted[i].start <= ts) last = sectionsSorted[i];
  }
  return last;
}

function isBridgeLabel(label: string | null | undefined): boolean {
  return String(label ?? "")
    .toLowerCase()
    .includes("bridge");
}

function bridgeRunBounds(
  sectionsSorted: MusicAiSection[],
  hit: MusicAiSection,
): { start: number; end: number } | null {
  if (!hit || !isBridgeLabel(hit.label)) return null;
  const i0 = sectionsSorted.findIndex(
    (s) => s.start === hit.start && s.end === hit.end && s.label === hit.label,
  );
  if (i0 < 0) return { start: hit.start, end: hit.end };
  let start = sectionsSorted[i0].start;
  let end = sectionsSorted[i0].end;
  for (let j = i0 - 1; j >= 0; j--) {
    const s = sectionsSorted[j];
    if (!isBridgeLabel(s.label)) break;
    start = Math.min(start, s.start);
  }
  for (let j = i0 + 1; j < sectionsSorted.length; j++) {
    const s = sectionsSorted[j];
    if (!isBridgeLabel(s.label)) break;
    end = Math.max(end, s.end);
  }
  return { start, end };
}

export function musicAiSectionEnvelopeForTime(
  t: number,
  sectionsSorted: MusicAiSection[],
): MusicAiSection | null {
  if (!sectionsSorted.length || !Number.isFinite(t)) return null;
  const hit = sectionAtTimestamp(sectionsSorted, t);
  if (!hit) return null;
  if (isBridgeLabel(hit.label)) {
    const run = bridgeRunBounds(sectionsSorted, hit);
    return run ? { ...hit, start: run.start, end: run.end } : hit;
  }
  return { ...hit };
}

export function vocalSectionHeaderForLyricTime(
  t: number,
  sectionsSorted: MusicAiSection[],
): MusicAiSection | null {
  return musicAiSectionEnvelopeForTime(t, sectionsSorted);
}

export function isInstrumentalSectionLabel(label: string | null | undefined): boolean {
  const s = String(label ?? "")
    .toLowerCase()
    .trim();
  if (!s) return false;
  if (s.includes("intro")) return true;
  if (s.includes("instrumental")) return true;
  if (isBridgeLabel(label)) return true;
  if (/\bsolo\b/.test(s) && !s.includes("verse") && !s.includes("bridge")) return true;
  return false;
}
