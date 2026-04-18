import type {
  MusicAiChordEvent,
  MusicAiLyricSegment,
  MusicAiLyricWord,
  MusicAiSection,
} from "./musicai-types";

export type LyricWordSlot = {
  id: string;
  segmentIndex: number;
  wordIndex: number;
  text: string;
  start: number;
  end: number;
};

function distributeTimes(
  count: number,
  segStart: number,
  segEnd: number,
): { start: number; end: number }[] {
  if (count <= 0) return [];
  const a = Math.min(segStart, segEnd);
  const b = Math.max(segStart, segEnd);
  const span = Math.max(0.05, b - a);
  const step = span / count;
  return Array.from({ length: count }, (_, i) => ({
    start: a + i * step,
    end: a + (i + 1) * step,
  }));
}

/** Expande letra em slots com tempos (para alinhar acordes por sílaba/palavra). */
export function buildWordSlots(lyrics: MusicAiLyricSegment[]): LyricWordSlot[] {
  const out: LyricWordSlot[] = [];
  lyrics.forEach((seg, segmentIndex) => {
    const segStart = typeof seg.start === "number" && Number.isFinite(seg.start) ? seg.start : 0;
    const segEnd =
      typeof seg.end === "number" && Number.isFinite(seg.end) ? seg.end : segStart + Math.max(0.5, 2);

    const words = seg.words;
    if (words?.length) {
      const times = distributeTimes(words.length, segStart, segEnd);
      words.forEach((w, wordIndex) => {
        const t = times[wordIndex] ?? { start: segStart, end: segEnd };
        const ws =
          typeof w.start === "number" && Number.isFinite(w.start) ? w.start : t.start;
        const we = typeof w.end === "number" && Number.isFinite(w.end) ? w.end : t.end;
        out.push({
          id: `${segmentIndex}-${wordIndex}`,
          segmentIndex,
          wordIndex,
          text: (w.word ?? "").trim() || "·",
          start: ws,
          end: Math.max(ws + 0.02, we),
        });
      });
      return;
    }

    const raw = (seg.text ?? "").trim();
    if (raw) {
      const parts = raw.split(/\s+/).filter(Boolean);
      const times = distributeTimes(parts.length, segStart, segEnd);
      parts.forEach((text, wordIndex) => {
        const t = times[wordIndex] ?? { start: segStart, end: segEnd };
        out.push({
          id: `${segmentIndex}-${wordIndex}`,
          segmentIndex,
          wordIndex,
          text,
          start: t.start,
          end: t.end,
        });
      });
    }
  });
  return out;
}

/** Reconstrói `lyrics` a partir dos slots; inclui segmentos extra só com slots e preserva segmentos vazios do base. */
export function rebuildLyricsFromSlots(
  baseLyrics: MusicAiLyricSegment[],
  slots: LyricWordSlot[],
): MusicAiLyricSegment[] {
  const bySeg = new Map<number, LyricWordSlot[]>();
  for (const s of slots) {
    const arr = bySeg.get(s.segmentIndex) ?? [];
    arr.push(s);
    bySeg.set(s.segmentIndex, arr);
  }
  const maxFromSlots = bySeg.size ? Math.max(...bySeg.keys()) : -1;
  const maxFromBase = baseLyrics.length > 0 ? baseLyrics.length - 1 : -1;
  const maxSeg = Math.max(maxFromBase, maxFromSlots);
  if (maxSeg < 0) return [];

  const out: MusicAiLyricSegment[] = [];
  for (let segmentIndex = 0; segmentIndex <= maxSeg; segmentIndex++) {
    const baseSeg = baseLyrics[segmentIndex];
    const group = (bySeg.get(segmentIndex) ?? []).sort((a, b) => a.wordIndex - b.wordIndex);
    if (!group.length) {
      if (baseSeg) out.push({ ...baseSeg });
      else out.push({ start: 0, end: 0.5, text: "", words: [] });
      continue;
    }
    const words: MusicAiLyricWord[] = group.map((g) => ({
      word: g.text,
      start: g.start,
      end: g.end,
    }));
    const start = Math.min(...group.map((g) => g.start));
    const end = Math.max(...group.map((g) => g.end));
    out.push({
      ...(baseSeg ?? {}),
      start,
      end,
      text: words.map((w) => w.word).join(" "),
      words,
    });
  }
  return out;
}

function newWordSlotId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `w-${crypto.randomUUID()}`;
  }
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Garante que existe entrada em `lyrics` até `minSegments` segmentos (índice 0..minSegments-1). */
export function ensureLyricsSegmentCount(
  lyrics: MusicAiLyricSegment[],
  minSegments: number,
): MusicAiLyricSegment[] {
  if (lyrics.length >= minSegments) return lyrics;
  const next = [...lyrics];
  while (next.length < minSegments) {
    next.push({ start: 0, end: 0.5, text: "", words: [] });
  }
  return next;
}

export function addWordSlot(
  slots: LyricWordSlot[],
  segmentIndex: number,
  text: string,
  start: number,
  end: number,
): LyricWordSlot[] {
  const same = slots.filter((s) => s.segmentIndex === segmentIndex);
  const wordIndex = same.length ? Math.max(...same.map((s) => s.wordIndex)) + 1 : 0;
  const s = Math.max(0, start);
  const e = Math.max(s + 0.02, end);
  const slot: LyricWordSlot = {
    id: newWordSlotId(),
    segmentIndex,
    wordIndex,
    text: text.trim() || "·",
    start: s,
    end: e,
  };
  return [...slots, slot];
}

/** Último instante coberto por palavras, acordes ou secções (para comparar com duração da faixa). */
export function maxTimelineEndSec(
  slots: LyricWordSlot[],
  chords: MusicAiChordEvent[],
  sections: MusicAiSection[],
): number {
  let m = 0;
  for (const w of slots) {
    if (Number.isFinite(w.end)) m = Math.max(m, w.end);
  }
  for (const c of chords) {
    if (Number.isFinite(c.end)) m = Math.max(m, c.end);
  }
  for (const sec of sections) {
    if (Number.isFinite(sec.end)) m = Math.max(m, sec.end);
  }
  return m;
}

/** Segmento de letra a usar para novas palavras num grupo (modo secção). */
export function pickSegmentIndexForEditorGroup(groupSlots: LyricWordSlot[]): number {
  if (!groupSlots.length) return 0;
  const first = [...groupSlots].sort((a, b) => a.start - b.start)[0]!;
  return first.segmentIndex;
}

/** Intervalo sugerido para uma nova palavra no fim do grupo (respeita limites da secção). */
export function defaultTimesForNewWordInGroup(group: {
  start: number;
  end: number;
  slots: LyricWordSlot[];
}): { start: number; end: number } {
  const g0 = Math.min(group.start, group.end);
  const g1 = Math.max(group.start, group.end);
  const span = Math.max(0.05, g1 - g0);
  if (!group.slots.length) {
    const e = Math.min(g0 + Math.max(0.15, span * 0.12), g1);
    return { start: g0, end: Math.max(g0 + 0.02, e) };
  }
  const last = [...group.slots].sort((a, b) => a.end - b.end)[group.slots.length - 1]!;
  const gapStart = last.end;
  const proposedEnd = Math.min(gapStart + 0.35, g1);
  if (proposedEnd <= gapStart + 0.001) {
    const mid = (g0 + g1) / 2;
    return { start: mid - 0.1, end: mid + 0.1 };
  }
  return { start: gapStart, end: proposedEnd };
}

export type EditorSectionGroup = {
  key: string;
  title: string;
  start: number;
  end: number;
  slots: LyricWordSlot[];
  /** Índice em `sections` já filtradas e ordenadas por `start` (só quando há secções). */
  sectionIdx?: number;
};

/**
 * Dentro de uma secção do editor, cada `segmentIndex` corresponde a um segmento de letra na API
 * (tipicamente uma frase / linha). Devolve linhas ordenadas no tempo para renderizar uma linha por frase.
 */
export function clusterSlotsByLyricSegment(slots: LyricWordSlot[]): LyricWordSlot[][] {
  const bySeg = new Map<number, LyricWordSlot[]>();
  for (const s of slots) {
    const arr = bySeg.get(s.segmentIndex) ?? [];
    arr.push(s);
    bySeg.set(s.segmentIndex, arr);
  }
  return Array.from(bySeg.values())
    .map((arr) => [...arr].sort((x, y) => x.wordIndex - y.wordIndex))
    .sort((a, b) => {
      const ta = a.length ? Math.min(...a.map((s) => s.start)) : 0;
      const tb = b.length ? Math.min(...b.map((s) => s.start)) : 0;
      return ta - tb;
    });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Agrupa palavras por `sections` (intervalo temporal + rótulo).
 * Usa o ponto médio de cada slot para escolher a secção; slots fora de todos os intervalos
 * vão para a secção mais próxima no tempo.
 * Sem secções válidas, recai no agrupamento por índice de segmento de letra.
 */
export function groupSlotsForEditorDisplay(
  slots: LyricWordSlot[],
  sections: MusicAiSection[] | undefined | null,
): EditorSectionGroup[] {
  const normalized = (sections ?? [])
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s, i) => ({
      start: s.start,
      end: Math.max(s.start + 0.01, s.end),
      label: (s.label ?? "").trim() || `Secção ${i + 1}`,
      i,
    }))
    .sort((a, b) => a.start - b.start);

  if (!normalized.length) {
    const m = new Map<number, LyricWordSlot[]>();
    for (const s of slots) {
      const arr = m.get(s.segmentIndex) ?? [];
      arr.push(s);
      m.set(s.segmentIndex, arr);
    }
    return Array.from(m.entries())
      .sort(([a], [b]) => a - b)
      .map(([segIdx, sl]) => ({
        key: `seg-${segIdx}`,
        title: `Segmento ${segIdx + 1}`,
        start: Math.min(...sl.map((x) => x.start)),
        end: Math.max(...sl.map((x) => x.end)),
        slots: sl.sort((a, b) => a.wordIndex - b.wordIndex),
      }));
  }

  const buckets: EditorSectionGroup[] = normalized.map((sec, sectionIdx) => ({
    /** Apenas índice estável — não incluir `start`/`end` ou o estado de UI (colapsar) reinicia ao editar tempos. */
    key: `sec-${sec.i}`,
    title: sec.label,
    start: sec.start,
    end: sec.end,
    slots: [],
    sectionIdx,
  }));

  const sectionIndexForSlot = (slot: LyricWordSlot): number => {
    const mid = (slot.start + slot.end) / 2;
    for (let i = 0; i < normalized.length; i++) {
      const sec = normalized[i]!;
      if (mid >= sec.start && mid <= sec.end) return i;
    }
    let bestOv = -1;
    let bestI = 0;
    for (let i = 0; i < normalized.length; i++) {
      const sec = normalized[i]!;
      const overlap = Math.min(slot.end, sec.end) - Math.max(slot.start, sec.start);
      if (overlap > bestOv) {
        bestOv = overlap;
        bestI = i;
      }
    }
    if (bestOv > 0) return bestI;
    let best = 0;
    let bestD = Infinity;
    normalized.forEach((sec, i) => {
      const c = clamp(mid, sec.start, sec.end);
      const d = Math.abs(mid - c);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  for (const slot of slots) {
    const idx = sectionIndexForSlot(slot);
    buckets[idx]!.slots.push(slot);
  }

  for (const b of buckets) {
    b.slots.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
      return a.wordIndex - b.wordIndex;
    });
  }

  return buckets;
}

export { formatChordLabel, formatChordLabel as chordDisplayLabel } from "./chord-timeline";

/** Cria um evento de acorde com os campos de símbolo preenchidos de forma consistente (Schubert / leitor). */
export function createChordEvent(symbol: string, start: number, end: number): MusicAiChordEvent {
  const sym = symbol.trim() || "N.C.";
  const s = Math.max(0, start);
  const e = Math.max(s + 0.05, end);
  return {
    start: s,
    end: e,
    chord_majmin: sym,
    chord_simple_pop: sym,
    chord_basic_pop: sym,
    chord_complex_pop: sym,
    chord_simple_jazz: sym,
    chord_basic_jazz: sym,
    chord_simple_nashville: sym,
    chord_basic_nashville: sym,
    chord_complex_nashville: sym,
  };
}

/**
 * Índice do slot cuja janela temporal contém `t` (preferência: primeiro que couber).
 * Se nenhum slot contiver `t`, devolve o índice do slot cujo centro está mais perto (útil para UI de alvo genérico).
 * Para ancorar acordes a palavras use `anchorSlotIdForChord` — não use este fallback.
 */
export function slotIndexForTime(slots: LyricWordSlot[], t: number): number {
  if (!slots.length) return -1;
  const hit = slots.findIndex((s) => t >= s.start && t < s.end);
  if (hit >= 0) return hit;
  let best = 0;
  let bestD = Infinity;
  slots.forEach((s, i) => {
    const mid = (s.start + s.end) / 2;
    const d = Math.abs(t - mid);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** `true` se o instante `t` cai no intervalo half-open de alguma palavra `[start, end)`. */
export function timeAnchorsToSomeWordSlot(slots: LyricWordSlot[], t: number): boolean {
  return slots.some((s) => t >= s.start && t < s.end);
}

/** Ordem canónica da letra: segmento → índice da palavra → tempo. */
export function sortSlotsLyricOrder(slots: LyricWordSlot[]): LyricWordSlot[] {
  return [...slots].sort((a, b) => {
    if (a.segmentIndex !== b.segmentIndex) return a.segmentIndex - b.segmentIndex;
    if (a.wordIndex !== b.wordIndex) return a.wordIndex - b.wordIndex;
    return a.start - b.start;
  });
}

function chordOverlapsSlot(c: MusicAiChordEvent, s: LyricWordSlot): boolean {
  return c.end > s.start && c.start < s.end;
}

/**
 * Para cada acorde, id da palavra onde a cifra deve “assentar” na grelha.
 * Regra: se o instante `chord.start` cai no intervalo half-open de uma ou mais palavras,
 * escolhe a palavra cujo `start` está mais próximo de `chord.start` (empate → ordem da letra).
 * Assim, ao largar um acorde com início alinhado a `slot.start`, ele fica na palavra certa
 * mesmo com intervalos de palavras sobrepostos no tempo.
 * Caso `chord.start` não caia em nenhuma palavra, mantém-se o fallback: primeira palavra
 * (ordem da letra) cujo intervalo intersecta o do acorde (intro / sustentações longas).
 */
export function chordAnchorSlotIds(slots: LyricWordSlot[], chords: MusicAiChordEvent[]): (string | null)[] {
  return chords.map((c) => anchorSlotIdForChord(slots, c));
}

export function anchorSlotIdForChord(slots: LyricWordSlot[], chord: MusicAiChordEvent): string | null {
  const ordered = sortSlotsLyricOrder(slots);
  const t = chord.start;

  const containing = ordered.filter((s) => t >= s.start && t < s.end);
  if (containing.length) {
    let best = containing[0]!;
    let bestD = Math.abs(best.start - t);
    let bestOrd = ordered.indexOf(best);
    for (let i = 1; i < containing.length; i++) {
      const s = containing[i]!;
      const d = Math.abs(s.start - t);
      const ord = ordered.indexOf(s);
      if (d < bestD - 1e-12 || (Math.abs(d - bestD) <= 1e-12 && ord < bestOrd)) {
        best = s;
        bestD = d;
        bestOrd = ord;
      }
    }
    return best.id;
  }

  for (const s of ordered) {
    if (chordOverlapsSlot(chord, s)) return s.id;
  }
  return null;
}

/**
 * Acordes cujo `start` está em [rangeStart, rangeEnd) e **não** intersectam nenhuma palavra
 * (só tempo instrumental / intro sem letra).
 */
export function chordIndicesInSectionWithoutWordAnchor(
  slots: LyricWordSlot[],
  chords: MusicAiChordEvent[],
  rangeStart: number,
  rangeEnd: number,
): number[] {
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  return chords
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.start >= lo && c.start < hi && anchorSlotIdForChord(slots, c) === null)
    .map((x) => x.i)
    .sort((a, b) => chords[a]!.start - chords[b]!.start);
}

/**
 * Reposiciona um acorde sobre o slot.
 * Regra: move o `start` para o início da palavra e preserva a duração original do acorde
 * (só limita para evitar colisão com o acorde seguinte).
 */
export function moveChordToSlot(
  chords: MusicAiChordEvent[],
  chordIndex: number,
  targetSlot: LyricWordSlot,
  sortedChordIndices: number[],
): MusicAiChordEvent[] {
  const next = chords.map((c) => ({ ...c }));
  const c = next[chordIndex];
  if (!c) return next;
  const ordered = [...sortedChordIndices].sort((a, b) => next[a].start - next[b].start);
  const pos = ordered.indexOf(chordIndex);
  const nextChordStart =
    pos >= 0 && pos < ordered.length - 1 ? next[ordered[pos + 1]!].start : Infinity;
  const newStart = targetSlot.start;
  const prevDur = Math.max(0.05, c.end - c.start);
  const noOverlapEnd = Number.isFinite(nextChordStart)
    ? Math.max(newStart + 0.05, nextChordStart - 0.02)
    : Infinity;
  const newEnd = Math.min(newStart + prevDur, noOverlapEnd);
  c.start = newStart;
  c.end = Math.max(newStart + 0.05, newEnd);
  return next;
}

/**
 * Posiciona o acorde num intervalo temporal (ex.: intro/instrumental sem palavras).
 * Regra: move o `start` para o início do intervalo e preserva duração original
 * (limitando para caber no intervalo e não colidir com o acorde seguinte).
 */
export function moveChordToTimeRange(
  chords: MusicAiChordEvent[],
  chordIndex: number,
  rangeStart: number,
  rangeEnd: number,
  sortedChordIndices: number[],
): MusicAiChordEvent[] {
  const next = chords.map((c) => ({ ...c }));
  const c = next[chordIndex];
  if (!c) return next;
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  const ordered = [...sortedChordIndices].sort((a, b) => next[a].start - next[b].start);
  const pos = ordered.indexOf(chordIndex);
  const nextChordStart =
    pos >= 0 && pos < ordered.length - 1 ? next[ordered[pos + 1]!].start : Infinity;
  const newStart = lo;
  const prevDur = Math.max(0.05, c.end - c.start);
  const intervalEnd = Math.max(newStart + 0.05, hi);
  const noOverlapEnd = Number.isFinite(nextChordStart)
    ? Math.max(newStart + 0.05, nextChordStart - 0.02)
    : Infinity;
  const newEnd = Math.min(newStart + prevDur, intervalEnd, noOverlapEnd);
  c.start = newStart;
  c.end = Math.max(newStart + 0.05, newEnd);
  return next;
}

/**
 * Índices de acordes cuja **âncora** é esta palavra (via `anchorSlotIdForChord` /
 * `chordAnchorSlotIds`): em geral o instante `chord.start`; se várias palavras contêm esse instante,
 * usa-se a mais coerente com `slot.start`; sem palavra a cobrir `chord.start`, mantém-se o fallback
 * por interseção temporal (intro / sustentações).
 */
export function chordIndicesAttachedToSlot(
  slots: LyricWordSlot[],
  chords: MusicAiChordEvent[],
  slot: LyricWordSlot,
  anchorIds?: (string | null)[],
): number[] {
  if (!slots.some((x) => x.id === slot.id)) return [];
  const anchors = anchorIds ?? chordAnchorSlotIds(slots, chords);
  return chords
    .map((c, i) => ({ c, i }))
    .filter(({ i }) => anchors[i] === slot.id)
    .map((x) => x.i);
}

/**
 * Barra “palavra” = intervalo [w.start, w.end]; preenchimento = interseção com [chord.start, chord.end]
 * (dados como em `track-example.json`: `words[].start|end`, `chords[].start|end`).
 * Na UI: `leftFrac` / `widthFrac` em % da largura da barra; ao arrastar o fim do preenchimento,
 * atualizar `chord.end` (e se necessário `chord.start`) com clamp a [w.start, w.end].
 */
export function chordOverlapLayoutOnWord(
  w: { start: number; end: number },
  chord: { start: number; end: number },
): { leftFrac: number; widthFrac: number } {
  const span = Math.max(1e-6, w.end - w.start);
  const overlapStart = Math.max(w.start, chord.start);
  const overlapEnd = Math.min(w.end, chord.end);
  const widthFrac = Math.max(0, overlapEnd - overlapStart) / span;
  const leftFrac = Math.max(0, Math.min(1, (overlapStart - w.start) / span));
  return { leftFrac, widthFrac };
}

/**
 * Sugere início/fim para um novo acorde numa palavra, evitando sobreposição com acordes já ancorados nessa palavra.
 */
export function defaultChordTimesOnWordSlot(
  slots: LyricWordSlot[],
  chords: MusicAiChordEvent[],
  slot: LyricWordSlot,
): { start: number; end: number } {
  const lo = slot.start;
  const hi = slot.end;
  const span = Math.max(0.02, hi - lo);
  const defaultDur = Math.min(0.42, Math.max(0.08, span * 0.42));
  const attachedIdxs = chordIndicesAttachedToSlot(slots, chords, slot);
  const attachedSorted = attachedIdxs
    .map((i) => chords[i]!)
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  let cand = lo;
  for (let iter = 0; iter < attachedSorted.length + 6; iter++) {
    const candEnd = Math.min(hi, cand + defaultDur);
    if (candEnd - cand < 0.055) {
      cand = Math.max(lo, hi - 0.055);
      break;
    }
    const collision = attachedSorted.some(
      (c) => cand < c.end - 0.001 && candEnd > c.start + 0.001,
    );
    if (!collision) {
      return { start: cand, end: Math.max(cand + 0.05, candEnd) };
    }
    const blocking = attachedSorted.find((c) => cand < c.end - 0.001 && candEnd > c.start + 0.001);
    if (blocking) {
      cand = Math.min(hi - 0.055, blocking.end + 0.02);
    } else {
      cand = Math.min(hi - 0.055, cand + 0.03);
    }
    if (cand >= hi - 0.054) {
      cand = Math.max(lo, hi - 0.055);
      break;
    }
  }
  return { start: cand, end: Math.max(cand + 0.05, Math.min(hi, cand + defaultDur)) };
}

/** Sugere tempos para um novo acorde num intervalo (intro / instrumental sem palavras). */
export function defaultChordTimesOnTimeRange(
  chords: MusicAiChordEvent[],
  rangeStart: number,
  rangeEnd: number,
): { start: number; end: number } {
  const lo = Math.min(rangeStart, rangeEnd);
  const hi = Math.max(rangeStart, rangeEnd);
  const span = Math.max(0.05, hi - lo);
  const defaultDur = Math.min(0.55, Math.max(0.12, span * 0.22));
  const inRange = chords
    .filter((c) => Number.isFinite(c.start) && c.start >= lo && c.start < hi)
    .sort((a, b) => a.start - b.start);

  let cand = lo;
  for (let iter = 0; iter < inRange.length + 8; iter++) {
    const candEnd = Math.min(hi, cand + defaultDur);
    if (candEnd - cand < 0.055) {
      cand = Math.max(lo, hi - 0.055);
      break;
    }
    const collision = inRange.some((c) => cand < c.end - 0.001 && candEnd > c.start + 0.001);
    if (!collision) {
      return { start: cand, end: Math.max(cand + 0.05, candEnd) };
    }
    const blocking = inRange.find((c) => cand < c.end - 0.001 && candEnd > c.start + 0.001);
    if (blocking) {
      cand = Math.min(hi - 0.055, blocking.end + 0.02);
    } else {
      cand = Math.min(hi - 0.055, cand + 0.04);
    }
    if (cand >= hi - 0.054) {
      cand = Math.max(lo, hi - 0.055);
      break;
    }
  }
  return { start: cand, end: Math.max(cand + 0.05, Math.min(hi, cand + defaultDur)) };
}

export function sortedChordIndices(chords: MusicAiChordEvent[]): number[] {
  return chords
    .map((_, i) => i)
    .sort((a, b) => (chords[a]?.start ?? 0) - (chords[b]?.start ?? 0));
}

/**
 * Move a palavra para o intervalo temporal da palavra-alvo (ex.: outra secção) e reancora
 * os acordes que estavam nessa palavra.
 */
export function applyWordSlotMoveToTarget(
  slots: LyricWordSlot[],
  chords: MusicAiChordEvent[],
  sourceSlotId: string,
  targetSlot: LyricWordSlot,
): { slots: LyricWordSlot[]; chords: MusicAiChordEvent[] } {
  const src = slots.find((s) => s.id === sourceSlotId);
  if (!src || src.id === targetSlot.id) return { slots, chords };

  const chordIdxs = chordIndicesAttachedToSlot(slots, chords, src);
  const dur = Math.max(0.05, src.end - src.start);
  const span = Math.max(0.02, targetSlot.end - targetSlot.start);
  const tm = (targetSlot.start + targetSlot.end) / 2;
  let newStart = tm - dur / 2;
  let newEnd = tm + dur / 2;

  if (dur > span - 0.001) {
    newStart = targetSlot.start;
    newEnd = targetSlot.end;
  } else {
    if (newStart < targetSlot.start) {
      newStart = targetSlot.start;
      newEnd = newStart + dur;
    }
    if (newEnd > targetSlot.end) {
      newEnd = targetSlot.end;
      newStart = newEnd - dur;
    }
  }
  newStart = Math.max(0, newStart);
  if (newEnd <= newStart) newEnd = newStart + 0.05;

  const nextSlots = slots.map((s) =>
    s.id === sourceSlotId ? { ...s, start: newStart, end: newEnd } : s,
  );
  const updatedSrc = nextSlots.find((s) => s.id === sourceSlotId);
  if (!updatedSrc) return { slots: nextSlots, chords };

  let nextChords = chords.map((c) => ({ ...c }));
  for (const ci of chordIdxs) {
    const order = sortedChordIndices(nextChords);
    nextChords = moveChordToSlot(nextChords, ci, updatedSrc, order);
  }
  return { slots: nextSlots, chords: nextChords };
}
