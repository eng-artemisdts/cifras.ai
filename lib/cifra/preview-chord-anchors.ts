import { collapseTrailingNoChordEvents } from "@/lib/cifra/chord-timeline";
import type { MusicAiChordEvent, MusicAiLyricSegment } from "@/lib/cifra/musicai-types";
import {
  buildWordSlots,
  chordAnchorSlotIds,
  sortSlotsLyricOrder,
} from "@/lib/cifra/transcription-editor-model";

export type PreviewChordAnchors = {
  /** Mesma ordem que `renumberGlobalWordIndices`: índice global da palavra ↔ `TimedWord.g`. */
  slotIdsInLyricOrder: string[];
  /** Para cada id de slot (`LyricWordSlot`), índices dos acordes ancorados nessa palavra (como na edição). */
  chordAnchorsBySlotId: Record<string, number[]>;
};

/**
 * Calcula âncoras com o mesmo modelo que o editor (`chordAnchorSlotIds`), para a pré-visualização
 * não divergir da grelha (sem heurísticas duplicadas em `cifra-view`).
 */
export function buildPreviewChordAnchors(
  lyrics: MusicAiLyricSegment[] | undefined,
  chords: MusicAiChordEvent[] | undefined,
): PreviewChordAnchors {
  const lyricList = Array.isArray(lyrics) ? lyrics : [];
  /** Mesmo recorte que `mountCifraView` / timeline — índices de acorde alinhados. */
  const chordList = collapseTrailingNoChordEvents(Array.isArray(chords) ? chords : []);
  const slots = sortSlotsLyricOrder(buildWordSlots(lyricList));
  const slotIdsInLyricOrder = slots.map((s) => s.id);
  const anchorPerChord = chordAnchorSlotIds(slots, chordList);

  const chordAnchorsBySlotId: Record<string, number[]> = {};
  for (let ci = 0; ci < chordList.length; ci++) {
    const sid = anchorPerChord[ci];
    if (sid == null) continue;
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
