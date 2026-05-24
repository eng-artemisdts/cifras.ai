// @ts-nocheck
/**
 * Resolve secção musical ativa por timestamp (sections.json).
 *
 * @module section-timeline
 */

/**
 * @param {import('./musicai-types.ts').MusicAiSection[]} sectionsSorted
 * @param {number|null|undefined} ts
 * @returns {import('./musicai-types.ts').MusicAiSection|null}
 */
export function sectionAtTimestamp(sectionsSorted, ts) {
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
