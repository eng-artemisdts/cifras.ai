"use client";

import { forwardRef, useMemo } from "react";

import type { MusicAiChordEvent, MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { mergeConsecutiveDuplicateSectionLabels, sortSections } from "@/lib/cifra/lyric-expand-clamp";
import {
  buildWordSlots,
  chordAnchorSlotIds,
  chordDisplayLabel,
  chordIndicesAttachedToSlot,
  chordIndicesInSectionWithoutWordAnchor,
  clusterSlotsByLyricSegment,
  groupSlotsForEditorDisplay,
  sortSlotsLyricOrder,
  type LyricWordSlot,
} from "@/lib/cifra/transcription-editor-model";
import { collapseTrailingNoChordEvents } from "@/lib/engine/chord-timeline";
import { cn } from "@/lib/utils";

function formatSectionTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Índice na lista normalizada (`collapseTrailingNoChordEvents`) para `data-chord-idx` / highlight. */
function normalizedChordIndexFromRaw(chords: MusicAiChordEvent[], rawIndex: number): number {
  const c = chords[rawIndex];
  if (!c) return -1;
  const norm = collapseTrailingNoChordEvents(chords);
  const cs = Number(c.start);
  const ce = Number(c.end);
  for (let j = 0; j < norm.length; j++) {
    const n = norm[j]!;
    const ns = Number(n.start);
    const ne = Number(n.end);
    if (Math.abs(ns - cs) < 1e-3 && Math.abs(ne - ce) < 1e-3) return j;
  }
  for (let j = 0; j < norm.length; j++) {
    const n = norm[j]!;
    if (Math.abs(Number(n.start) - cs) < 1e-3) return j;
  }
  return -1;
}

function clipChordToWindow(
  chord: MusicAiChordEvent,
  win0: number,
  win1: number,
  chordOffsetSec: number,
): { a0: number; a1: number } | null {
  const off = Number.isFinite(chordOffsetSec) ? chordOffsetSec : 0;
  const cA0 = Number(chord.start) + off;
  const cA1 = Number(chord.end) + off;
  if (!Number.isFinite(cA0) || !Number.isFinite(cA1) || cA1 <= cA0 + 1e-6) return null;
  const a0 = Math.max(win0, cA0);
  const a1 = Math.min(win1, cA1);
  if (a1 <= a0 + 1e-6) return null;
  return { a0, a1 };
}

/** Slot longo com muitos acordes: tratar os primeiros ~2s como «vocal» na palavra e o resto na célula fantasma (à direita). */
const LONG_SLOT_SPAN_SEC = 3;
const MIN_CHORDS_FOR_LONG_SLOT_SPLIT = 4;
const VOCAL_HEAD_FROM_START_SEC = 2;
const MIN_CHORDS_FOR_OVERLAP_SPLIT = 2;

function nextSlotStartSec(slot: LyricWordSlot, allSlots: LyricWordSlot[]): number | null {
  const ordered = sortSlotsLyricOrder(allSlots);
  const i = ordered.findIndex((s) => s.id === slot.id);
  if (i < 0 || i >= ordered.length - 1) return null;
  return ordered[i + 1]!.start;
}

/**
 * Instantâneo a partir do qual os acordes deste slot são mostrados na célula fantasma (horizontal, depois da palavra).
 * — Slot longo + muitos acordes: corte após ~{@link VOCAL_HEAD_FROM_START_SEC}s do início da palavra.
 * — Intervalo da palavra invade a seguinte: corte no início da palavra seguinte.
 */
function previewChordGhostCutoffSec(
  slot: LyricWordSlot,
  allSlots: LyricWordSlot[],
  chordCount: number,
): number | null {
  if (chordCount < MIN_CHORDS_FOR_OVERLAP_SPLIT) return null;

  const span = slot.end - slot.start;
  const nextStart = nextSlotStartSec(slot, allSlots);
  const overlap = nextStart != null && nextStart < slot.end - 0.02;

  let cap = slot.end;
  let narrowed = false;

  if (span > LONG_SLOT_SPAN_SEC && chordCount >= MIN_CHORDS_FOR_LONG_SLOT_SPLIT) {
    cap = Math.min(cap, slot.start + VOCAL_HEAD_FROM_START_SEC);
    narrowed = true;
  }
  if (overlap && chordCount >= MIN_CHORDS_FOR_OVERLAP_SPLIT) {
    cap = Math.min(cap, nextStart - 1e-3);
    narrowed = true;
  }

  if (!narrowed) return null;
  if (cap <= slot.start + 0.02) return null;
  if (cap >= slot.end - 1e-3 && !overlap) return null;

  return cap;
}

function splitChordIdxsAtCutoff(
  chordIdxs: number[],
  chords: MusicAiChordEvent[],
  cutoff: number,
): { onWord: number[]; onGhost: number[] } {
  const sorted = [...chordIdxs].sort((a, b) => chords[a]!.start - chords[b]!.start);
  const onWord = sorted.filter((i) => chords[i]!.start < cutoff);
  const onGhost = sorted.filter((i) => chords[i]!.start >= cutoff);
  return { onWord, onGhost };
}

export type CifraPreviewSheetProps = {
  payload: MusicAiDemoPayload;
  className?: string;
};

/**
 * Cifra só leitura: mesma base de dados que o editor (`buildWordSlots` + `groupSlotsForEditorDisplay` +
 * `chordIndicesAttachedToSlot`). Marcação DOM compatível com `applyCifraPlaybackHighlight` / scroll inteligente
 * (`.cifra-section`, `.cifra-line`, `.cifra-chord--track`, `data-playback-a0|a1`, `data-chord-idx`).
 */
export const CifraPreviewSheet = forwardRef<HTMLDivElement, CifraPreviewSheetProps>(function CifraPreviewSheet(
  { payload, className },
  ref,
) {
  const chords = payload.chords ?? [];
  const chordOffsetSec = Number.isFinite(payload.chordTimeOffsetSec) ? Number(payload.chordTimeOffsetSec) : 0;

  const { slots, sectionGroups, chordAnchors } = useMemo(() => {
    const sectionsRaw = payload.sections ?? [];
    const sectionsSorted = mergeConsecutiveDuplicateSectionLabels(sortSections([...sectionsRaw]));
    const slots = buildWordSlots(payload.lyrics ?? []);
    const sectionGroups = groupSlotsForEditorDisplay(slots, sectionsSorted);
    const chordAnchors = chordAnchorSlotIds(slots, chords);
    return { slots, sectionGroups, chordAnchors };
  }, [payload.lyrics, payload.sections, chords]);

  let wordOrdinal = 0;

  const renderChordStrip = (cis: number[], keyPrefix: string, slot: LyricWordSlot, horizontal: boolean) => {
    if (!cis.length) return null;
    const sorted = [...cis].sort((a, b) => chords[a]!.start - chords[b]!.start);
    return (
      <div
        className={cn(
          "flex min-h-[22px] flex-1 items-end",
          horizontal
            ? "w-max max-w-[min(100%,36rem)] flex-row flex-nowrap gap-x-2 overflow-x-auto pr-0.5"
            : "w-full flex-row flex-wrap content-end justify-center gap-x-1.5 gap-y-0.5",
        )}
      >
        {sorted.map((ci) => {
          const chord = chords[ci]!;
          const label = chordDisplayLabel(chord);
          const win = clipChordToWindow(chord, slot.start, slot.end, chordOffsetSec);
          const nIdx = normalizedChordIndexFromRaw(chords, ci);
          const trackProps =
            win && nIdx >= 0
              ? {
                  "data-playback-a0": String(win.a0),
                  "data-playback-a1": String(win.a1),
                  "data-chord-idx": String(nIdx),
                }
              : {};
          return (
            <span
              key={`${keyPrefix}-${ci}`}
              className={cn(
                "inline-flex shrink-0 flex-col items-start gap-1",
                win && nIdx >= 0 && "cifra-chord--track",
              )}
              {...trackProps}
            >
              <span className="cifra-chord__symbol inline-flex min-h-[1.125rem] items-end font-mono text-xs font-semibold text-auris-teal sm:text-sm">
                {label}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={ref} id="cifra" className={cn("min-h-[min(12rem,30dvh)] w-full min-w-0", className)}>
      {sectionGroups.map((group) => (
        <div
          key={group.key}
          className="cifra-section mb-6 flex gap-3.5 items-stretch"
          data-section-start={String(group.start)}
          data-section-end={String(group.end)}
        >
          <div
            className="cifra-section-rail w-1 shrink-0 self-stretch min-h-[2.5rem] rounded-sm bg-auris-teal/22 transition-[background-color,box-shadow] duration-200 ease-out"
            aria-hidden
          />
          <div className="cifra-section-inner flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-auris-teal">
                {group.title}
              </div>
              <div className="mt-0.5 font-mono text-[10px] text-auris-muted tabular-nums">
                {formatSectionTime(group.start)} — {formatSectionTime(group.end)}
              </div>
            </div>

            {group.slots.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-cifra-muted/90">Sem palavras (intro, instrumental…)</p>
                {(() => {
                  const instIdxs = chordIndicesInSectionWithoutWordAnchor(slots, chords, group.start, group.end);
                  if (!instIdxs.length) return null;
                  return (
                    <div className="cifra-line mt-2 flex w-full flex-wrap items-end gap-x-3 gap-y-4">
                      {instIdxs.map((ci) => {
                        const chord = chords[ci]!;
                        const label = chordDisplayLabel(chord);
                        const win = clipChordToWindow(chord, group.start, group.end, chordOffsetSec);
                        const nIdx = normalizedChordIndexFromRaw(chords, ci);
                        const trackProps =
                          win && nIdx >= 0
                            ? {
                                "data-playback-a0": String(win.a0),
                                "data-playback-a1": String(win.a1),
                                "data-chord-idx": String(nIdx),
                              }
                            : {};
                        return (
                          <span
                            key={`${group.key}-inst-${ci}`}
                            className={cn(
                              "inline-flex min-h-[3.5rem] flex-col items-start justify-end gap-1 rounded-lg px-2 py-2",
                              win && nIdx >= 0 && "cifra-chord--track",
                            )}
                            {...trackProps}
                          >
                            <span className="cifra-chord__symbol inline-flex min-h-[1.125rem] items-end font-mono text-xs font-semibold text-auris-teal sm:text-sm">
                              {label}
                            </span>
                            <span className="min-h-[1.25rem] text-[14px] font-medium text-auris-ink">&nbsp;</span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {clusterSlotsByLyricSegment(group.slots).map((phraseSlots, phraseIdx) => (
                  <div
                    key={`${group.key}-phrase-${phraseSlots[0]?.segmentIndex ?? phraseIdx}`}
                    className="cifra-line flex w-full flex-wrap items-end gap-x-3 gap-y-4 pb-1"
                  >
                    {phraseSlots.map((slot) => {
                      const chordIdxs = chordIndicesAttachedToSlot(slots, chords, slot, chordAnchors);
                      const cutoff = previewChordGhostCutoffSec(slot, slots, chordIdxs.length);
                      const { onWord, onGhost } =
                        cutoff != null
                          ? splitChordIdxsAtCutoff(chordIdxs, chords, cutoff)
                          : { onWord: chordIdxs, onGhost: [] as number[] };
                      const hasGhost = onGhost.length > 0;
                      const g = wordOrdinal++;
                      return (
                        <span
                          key={slot.id}
                          className={cn(
                            "inline-flex items-end gap-x-2",
                            hasGhost ? "max-w-none shrink-0" : "max-w-[11rem] min-w-10",
                          )}
                        >
                          <span
                            data-g={String(g)}
                            className="inline-flex max-w-[11rem] min-w-10 flex-col items-stretch justify-end gap-1 px-0.5 py-0.5"
                          >
                            {renderChordStrip(onWord, slot.id, slot, false)}
                            <span className="pointer-events-none block w-full min-w-0 select-none px-1 py-0.5 text-center text-[14px] font-medium leading-tight tracking-tight text-cifra-text">
                              {slot.text}
                            </span>
                          </span>
                          {hasGhost ? (
                            <span
                              aria-hidden
                              className="cifra-preview-ghost-slot inline-flex max-w-[min(100%,36rem)] shrink-0 flex-col justify-end gap-1 px-0.5 py-0.5"
                            >
                              {renderChordStrip(onGhost, `${slot.id}-ghost`, slot, true)}
                              <span className="pointer-events-none invisible block min-h-[1.5em] w-full min-w-[1.25rem] select-none text-center text-[14px] font-medium leading-tight">
                                &nbsp;
                              </span>
                            </span>
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

CifraPreviewSheet.displayName = "CifraPreviewSheet";
