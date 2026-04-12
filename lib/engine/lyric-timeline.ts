// @ts-nocheck
/**
 * Modelo de letra: linhas com palavras e timestamps; índice ativo por tempo do áudio.
 *
 * @module lyric-timeline
 */

/**
 * @param {import('./musicai-types.ts').MusicAiLyricSegment[]} lyrics
 * @returns {{ timedLines: import('./musicai-types.ts').TimedWord[][], allFlat: import('./musicai-types.ts').TimedWord[] }}
 */
export function buildLyricModel(lyrics) {
  let gid = 0;
  /** @type {import('./musicai-types.ts').TimedWord[][]} */
  const timedLines = [];

  for (let si = 0; si < lyrics.length; si++) {
    const seg = lyrics[si];
    const wlist = seg.words || [];
    if (!wlist.length) continue;

    const segStart = Number(seg.start);
    const segEnd = Number(seg.end);
    /** @type {import('./musicai-types.ts').TimedWord[]} */
    const line = [];

    for (let wi = 0; wi < wlist.length; wi++) {
      const w = wlist[wi];
      let st = Number(w.start);
      let en = Number(w.end);
      let ok = Number.isFinite(st) && Number.isFinite(en);

      if (!ok && Number.isFinite(segStart) && Number.isFinite(segEnd) && wlist.length > 0) {
        const slice = (segEnd - segStart) / wlist.length;
        st = segStart + wi * slice;
        en = segStart + (wi + 1) * slice;
        ok = true;
      }

      line.push({
        text: w.word,
        start: ok ? st : null,
        end: ok ? en : null,
        g: 1
      });
    }
    timedLines.push(line);
  }

  const allFlat = timedLines.flat();
  return { timedLines, allFlat };
}

/**
 * Índice global da palavra destacada.
 * Antes da 1.ª palavra com tempo (ex.: intro instrumental) → -1 (sem destaque).
 * Depois: [start,end), gaps por ponto médio, após última palavra → último índice.
 *
 * @param {import('./musicai-types.ts').TimedWord[]} allFlat
 * @param {number} tAudio
 * @returns {number}
 */
export function wordGlobalIndexAtTime(allFlat, tAudio) {
  if (!allFlat.length) return -1;

  const first = allFlat[0];
  if (first.start != null && tAudio < first.start) return -1;

  for (let i = 0; i < allFlat.length; i++) {
    const w = allFlat[i];
    if (w.start != null && w.end != null && tAudio >= w.start && tAudio < w.end) return i;
  }

  for (let i = 0; i < allFlat.length - 1; i++) {
    const a = allFlat[i];
    const b = allFlat[i + 1];
    if (a.end != null && b.start != null && tAudio >= a.end && tAudio < b.start) {
      return tAudio < (a.end + b.start) / 2 ? i : i + 1;
    }
  }

  const lastW = allFlat[allFlat.length - 1];
  if (lastW.end != null && tAudio >= lastW.end) return allFlat.length - 1;
  return -1;
}
