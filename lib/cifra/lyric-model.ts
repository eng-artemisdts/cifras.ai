import type { MusicAiLyricSegment, TimedWord } from "./musicai-types";

export function buildLyricModel(lyrics: MusicAiLyricSegment[]): {
  timedLines: TimedWord[][];
  allFlat: TimedWord[];
} {
  let gid = 0;
  const timedLines: TimedWord[][] = [];

  for (let si = 0; si < lyrics.length; si++) {
    const seg = lyrics[si];
    const wlist = seg.words || [];
    if (!wlist.length) continue;

    const segStart = Number(seg.start);
    const segEnd = Number(seg.end);
    const line: TimedWord[] = [];

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
        g: gid++,
      });
    }
    timedLines.push(line);
  }

  const allFlat = timedLines.flat();
  return { timedLines, allFlat };
}
