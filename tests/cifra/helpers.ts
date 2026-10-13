import { vi } from "vitest";

vi.mock("@/lib/cifra/chord-diagram/attach-chord-diagram-hover-dom", () => ({
  attachChordDiagramHoverDom: () => () => {},
}));

import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "@/lib/cifra/lyric-expand-clamp";
import type { MusicAiChordEvent, MusicAiLyricSegment, MusicAiSection } from "@/lib/cifra/musicai-types";
import { createChordTimeline, formatChordLabel } from "@/lib/engine/chord-timeline";
import { mountCifraView } from "@/lib/engine/cifra-view";
import { buildLyricModel } from "@/lib/engine/lyric-timeline";
import {
  buildCifraRenderPlan,
  computeChordOnlyInstrumentalBlocks,
  renumberGlobalWordIndices,
} from "@/lib/engine/section-layout";

export const chord = (label: string, start: number, end: number): MusicAiChordEvent => ({
  start,
  end,
  chord_majmin: label,
  chord_simple_pop: label,
  chord_basic_pop: label,
});

/** Acorde com compasso/tempo (grade da Music.ai), 4/4. */
export const gridChord = (
  label: string,
  start: number,
  end: number,
  [bar, beat]: [number, number],
  [endBar, endBeat]: [number, number],
): MusicAiChordEvent => ({ ...chord(label, start, end), start_bar: bar, start_beat: beat, end_bar: endBar, end_beat: endBeat });

/** Segmento com tempos explícitos por palavra: `[[palavra, início, fim], ...]`. */
export const line = (words: [string, number, number][]): MusicAiLyricSegment => ({
  start: words[0]![1],
  end: words[words.length - 1]![2],
  text: words.map((w) => w[0]).join(" "),
  words: words.map(([word, start, end]) => ({ word, start, end })),
});

/** Linha com palavras igualmente espaçadas entre `t0` e `t0 + dur`. */
export const evenLine = (text: string, t0: number, dur: number): MusicAiLyricSegment => {
  const ws = text.split(" ");
  const step = dur / ws.length;
  return line(ws.map((w, i) => [w, t0 + i * step, t0 + (i + 1) * step - 0.05]));
};

export type Payload = {
  chords: MusicAiChordEvent[];
  lyrics: MusicAiLyricSegment[];
  sections: MusicAiSection[];
};

/** Mesmo pipeline do leitor (`cifra-poc-mount` + `start-cifra-runtime-v2`). */
export function renderCifra(payload: Payload, durationSec: number) {
  const sectionsSorted = mergeConsecutiveDuplicateSectionLabels(sortSections(payload.sections));
  const timeline = createChordTimeline(payload.chords, { offsetSec: 0 });
  const { timedLines } = buildLyricModel(payload.lyrics);
  const vocal = renumberGlobalWordIndices(timedLines);
  const blocks = computeChordOnlyInstrumentalBlocks({
    timedLines,
    chords: payload.chords,
    sectionsSorted,
    chordTimeOffsetSec: 0,
    durationHintSec: durationSec,
    formatChord: (c: MusicAiChordEvent) => formatChordLabel(c),
  });
  const plan = buildCifraRenderPlan(blocks, vocal);
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  mountCifraView({
    container,
    renderPlan: plan,
    sectionsSorted,
    chordGridStartAudioTime: timeline.gridStartAudioTime,
    getChordLabelAtAudioTime: (t: number) => formatChordLabel(timeline.atAudioTime(t)),
    formatChordEvent: (c: MusicAiChordEvent) => formatChordLabel(c),
    chords: payload.chords,
    chordTimeOffsetSec: 0,
    showSectionBars: true,
  });
  return { container, timeline };
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/ /g, "").trim();

/** Linhas da cifra como texto: `[C]palavra`, faixas instrumentais prefixadas com `♪`. */
export function sheetRows(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".cifra-line")].map((row) => {
    // Palavra + acorde "depois dela" vêm agrupados (não se separam na quebra de linha).
    const items = [...row.children].flatMap((c) =>
      c.classList.contains("cifra-word-group") ? [...c.children] : [c],
    );
    const cells = items.map((c) => {
      if (c.classList.contains("cifra-word")) {
        // Palavra em sílabas: o acorde aparece antes da sílaba em que começa (ex.: "a[G]mor").
        return [...c.children]
          .map((piece) => {
            const syms = [...piece.querySelectorAll(".cifra-chord__symbol")].map((e) => clean(e.textContent)).filter(Boolean);
            return (syms.length ? `[${syms.join(" ")}]` : "") + (piece.children[1]?.textContent ?? "");
          })
          .join("");
      }
      const bar = c.querySelector(".cifra-bar");
      if (bar) return clean(bar.textContent);
      const sym = clean(c.children[0]?.textContent);
      const txt = clean(c.children[1]?.textContent);
      return sym ? `[${sym}]${txt}` : txt;
    });
    return (row.hasAttribute("data-instrumental-strip") ? "♪ " : "") + cells.filter(Boolean).join(" ");
  });
}

/** Cabeçalhos das seções na ordem do DOM (`rótulo início-fim`). */
export function sectionHeaders(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".cifra-section")].map((s) => {
    const inner = s.querySelector(".cifra-section-inner");
    return `${clean(inner?.children[0]?.textContent)} ${clean(s.querySelector("[data-section-time]")?.textContent)}`;
  });
}

/** Rótulos de acorde visíveis, na ordem do DOM. */
export function visibleChords(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>(".cifra-chord__symbol")]
    .map((el) => clean(el.textContent))
    .filter(Boolean);
}
