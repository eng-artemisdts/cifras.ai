import { collapseTrailingNoChordEvents } from "@/lib/cifra/chord-timeline";
import type {
  MusicAiChordEvent,
  MusicAiLyricSegment,
  MusicAiSection,
} from "@/lib/cifra/musicai-types";
import {
  buildWordSlots,
  chordAnchorSlotIds,
  sortSlotsLyricOrder,
  type LyricWordSlot,
} from "@/lib/cifra/transcription-editor-model";

export type PreviewChordAnchors = {
  /** Mesma ordem que `renumberGlobalWordIndices`: índice global da palavra ↔ `TimedWord.g`. */
  slotIdsInLyricOrder: string[];
  /** Para cada id de slot (`LyricWordSlot`), índices dos acordes ancorados nessa palavra (como na edição). */
  chordAnchorsBySlotId: Record<string, number[]>;
};

/** Secção normalizada (filtrada e ordenada) para lookup `O(n)` por tempo. */
type NormalizedSection = { start: number; end: number };

function normalizeSectionsForLookup(
  sections: MusicAiSection[] | undefined | null,
): NormalizedSection[] {
  return (sections ?? [])
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => ({ start: Number(s.start), end: Math.max(Number(s.start) + 0.01, Number(s.end)) }))
    .sort((a, b) => a.start - b.start);
}

/** Retorna o índice de secção que contém `t` (ou a mais próxima por sobreposição/distância). */
function sectionIndexAtTime(t: number, sections: NormalizedSection[]): number {
  if (!sections.length) return -1;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    if (t >= s.start && t < s.end) return i;
  }
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    const mid = (s.start + s.end) / 2;
    const d = Math.abs(mid - t);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

/**
 * Calcula âncoras com o mesmo modelo que o editor (`chordAnchorSlotIds`), para a pré-visualização
 * não divergir da grelha (sem heurísticas duplicadas em `cifra-view`).
 *
 * Quando `sections` são fornecidas, acordes cujo `start` cai numa secção diferente da palavra
 * âncora são **descartados** (regra do editor: o acorde aparece só na secção onde começa, sem
 * transpassar para a seguinte).
 */
export function buildPreviewChordAnchors(
  lyrics: MusicAiLyricSegment[] | undefined,
  chords: MusicAiChordEvent[] | undefined,
  sections?: MusicAiSection[] | null,
): PreviewChordAnchors {
  const lyricList = Array.isArray(lyrics) ? lyrics : [];
  /** Mesmo recorte que `mountCifraView` / timeline — índices de acorde alinhados. */
  const chordList = collapseTrailingNoChordEvents(Array.isArray(chords) ? chords : []);
  const slots = sortSlotsLyricOrder(buildWordSlots(lyricList));
  const slotIdsInLyricOrder = slots.map((s) => s.id);
  const anchorPerChord = chordAnchorSlotIds(slots, chordList);

  const normalizedSections = normalizeSectionsForLookup(sections);
  const hasSections = normalizedSections.length > 0;
  const slotById: Map<string, LyricWordSlot> = new Map(slots.map((s) => [s.id, s]));

  const chordAnchorsBySlotId: Record<string, number[]> = {};
  for (let ci = 0; ci < chordList.length; ci++) {
    const sid = anchorPerChord[ci];
    if (sid == null) continue;
    if (hasSections) {
      const chord = chordList[ci];
      const slot = slotById.get(sid);
      if (chord && slot) {
        const chordSecIdx = sectionIndexAtTime(Number(chord.start), normalizedSections);
        const slotSecIdx = sectionIndexAtTime(
          (Number(slot.start) + Number(slot.end)) / 2,
          normalizedSections,
        );
        /** Regra: o acorde só aparece na palavra se ambos estão na mesma secção. */
        if (chordSecIdx !== slotSecIdx) continue;
      }
    }
    if (!chordAnchorsBySlotId[sid]) chordAnchorsBySlotId[sid] = [];
    chordAnchorsBySlotId[sid].push(ci);
  }
  for (const sid of Object.keys(chordAnchorsBySlotId)) {
    chordAnchorsBySlotId[sid]!.sort(
      (a, b) => Number(chordList[a]?.start) - Number(chordList[b]?.start),
    );
  }

  return { slotIdsInLyricOrder, chordAnchorsBySlotId };
}
