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

function chordOverlapsSlot(chord: MusicAiChordEvent, slot: LyricWordSlot): boolean {
  return Number(chord.end) > Number(slot.start) && Number(chord.start) < Number(slot.end);
}

/**
 * Acorde que começa numa secção e termina na seguinte: ancora na última palavra sobreposta
 * da secção de início (prioriza exibir na secção anterior).
 */
function preferStartSectionAnchorSlot(
  chord: MusicAiChordEvent,
  naturalSlotId: string,
  slots: LyricWordSlot[],
  slotById: Map<string, LyricWordSlot>,
  sections: NormalizedSection[],
): string | null {
  const chordSecIdx = sectionIndexAtTime(Number(chord.start), sections);
  if (chordSecIdx < 0) return naturalSlotId;

  const natural = slotById.get(naturalSlotId);
  if (!natural) return null;

  const naturalSecIdx = sectionIndexAtTime(
    (Number(natural.start) + Number(natural.end)) / 2,
    sections,
  );
  if (naturalSecIdx === chordSecIdx) return naturalSlotId;

  const startSec = sections[chordSecIdx];
  if (!startSec) return null;
  const chordEnd = Number(chord.end);
  const spansIntoNext =
    Number.isFinite(chordEnd) &&
    chordEnd > startSec.end - 1e-3 &&
    naturalSecIdx === chordSecIdx + 1;
  if (!spansIntoNext) return null;

  const ordered = sortSlotsLyricOrder(slots);
  let best: LyricWordSlot | null = null;
  for (const s of ordered) {
    const mid = (Number(s.start) + Number(s.end)) / 2;
    if (mid < startSec.start || mid >= startSec.end) continue;
    if (!chordOverlapsSlot(chord, s)) continue;
    best = s;
  }
  return best?.id ?? null;
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
 * Quando `sections` são fornecidas, acordes que transpassam uma fronteira de secção aparecem só
 * na secção onde o `start` cai (secção anterior), nunca na seguinte.
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
    const naturalSid = anchorPerChord[ci];
    if (naturalSid == null) continue;
    let sid = naturalSid;
    if (hasSections) {
      const chord = chordList[ci];
      if (chord) {
        const resolved = preferStartSectionAnchorSlot(
          chord,
          naturalSid,
          slots,
          slotById,
          normalizedSections,
        );
        if (resolved == null) continue;
        sid = resolved;
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
