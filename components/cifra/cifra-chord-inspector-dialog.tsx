"use client";

import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { CifraEditInspectorPanel } from "@/components/cifra/cifra-edit-inspector-panel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MusicAiChordEvent } from "@/lib/cifra/musicai-types";
import {
  clearChordElement,
  drawChordIntoElement,
  getChordDiagramVariationCount,
  resolveChordDiagramVariation,
} from "@/lib/cifra/chord-diagram/svguitar-from-db";
import { chordDisplayLabel } from "@/lib/cifra/transcription-editor-model";
import type { LyricWordSlot } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

function ChordDiagramHero({ label }: { label: string }) {
  const [variationIndex, setVariationIndex] = useState(0);
  const variationCount = useMemo(() => getChordDiagramVariationCount(label), [label]);
  const resolved = useMemo(
    () => resolveChordDiagramVariation(label, variationIndex),
    [label, variationIndex],
  );
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVariationIndex(0);
  }, [label]);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el || !resolved) return;
    drawChordIntoElement(el, resolved);
    return () => clearChordElement(el);
  }, [resolved]);

  if (!resolved) {
    return (
      <p className="max-w-xs text-center font-mono text-[10px] leading-snug text-cifra-muted">
        Diagrama não disponível para «{label}».
      </p>
    );
  }

  const canPrev = variationCount > 1 && variationIndex > 0;
  const canNext = variationCount > 1 && variationIndex < variationCount - 1;

  return (
    <div className="flex w-full max-w-[min(100%,20rem)] flex-col items-center gap-2">
      <div className="flex w-full items-center justify-center gap-2">
        {variationCount > 1 ? (
          <button
            type="button"
            disabled={!canPrev}
            aria-label="Variação anterior do diagrama"
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/12 text-cifra-teal transition-[background-color,opacity]",
              canPrev ? "hover:bg-white/8" : "cursor-not-allowed opacity-35",
            )}
            onClick={() => canPrev && setVariationIndex((i) => i - 1)}
          >
            <ChevronLeft className="size-5" aria-hidden strokeWidth={1.75} />
          </button>
        ) : null}

        <div
          ref={hostRef}
          role="img"
          aria-label={
            variationCount > 1
              ? `Diagrama do acorde ${resolved.displayLabel}, variação ${variationIndex + 1} de ${variationCount}`
              : `Diagrama do acorde ${resolved.displayLabel}`
          }
          className={cn(
            "flex min-h-[132px] min-w-[116px] shrink-0 flex-1 items-center justify-center [&_svg]:block",
          )}
        />

        {variationCount > 1 ? (
          <button
            type="button"
            disabled={!canNext}
            aria-label="Variação seguinte do diagrama"
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-white/12 text-cifra-teal transition-[background-color,opacity]",
              canNext ? "hover:bg-white/8" : "cursor-not-allowed opacity-35",
            )}
            onClick={() => canNext && setVariationIndex((i) => i + 1)}
          >
            <ChevronRight className="size-5" aria-hidden strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      {variationCount > 1 ? (
        <p className="font-mono text-[10px] tabular-nums tracking-tight text-cifra-muted">
          Variação {variationIndex + 1} / {variationCount}
        </p>
      ) : null}
    </div>
  );
}

export type CifraChordInspectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Devolve o foco ao acorde (ou célula) ao fechar. */
  anchorRef: RefObject<HTMLElement | null>;
  activeSlot: LyricWordSlot | null;
  activeChord: MusicAiChordEvent | null;
  activeChordIndex: number | null;
  onChordApply: (index: number, next: MusicAiChordEvent) => void;
  onChordRemove: (index: number) => void;
  onChordEndChange: (index: number, nextEnd: number) => void;
};

/**
 * Modal de edição de acorde: título, diagrama, rótulo; formulário de símbolo e tempos.
 */
export function CifraChordInspectorDialog({
  open,
  onOpenChange,
  anchorRef,
  activeSlot,
  activeChord,
  activeChordIndex,
  onChordApply,
  onChordRemove,
  onChordEndChange,
}: CifraChordInspectorDialogProps) {
  if (activeChordIndex == null || !activeChord) return null;

  const chordLabel = chordDisplayLabel(activeChord);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        finalFocus={anchorRef}
        className="w-[min(100vw-1.5rem,28rem)] gap-0 p-0"
      >
        <DialogHeader className="shrink-0 border-b border-white/8 pr-14 pt-12 pb-3 text-left">
          <DialogTitle>Editar acorde</DialogTitle>
        </DialogHeader>

        <div className="flex shrink-0 flex-col items-center border-b border-white/8 px-5 py-5">
          <ChordDiagramHero label={chordLabel} />
          <p className="mt-3 w-full text-center font-mono text-[15px] font-semibold tabular-nums tracking-tight text-cifra-teal">
            {chordLabel}
          </p>
          {activeSlot ? (
            <p className="mt-2 w-full text-center text-[11px] leading-snug text-cifra-muted">
              Palavra: <span className="font-serif italic text-cifra-gold">{activeSlot.text}</span>
            </p>
          ) : (
            <p className="mt-2 w-full text-center text-[11px] text-cifra-muted">Zona só instrumento / intro</p>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4">
            <CifraEditInspectorPanel
              embedded
              chordDialogFormOnly
              activeSlot={activeSlot}
              activeChord={activeChord}
              activeChordIndex={activeChordIndex}
              onChordApply={onChordApply}
              onChordRemove={onChordRemove}
              onChordEndChange={onChordEndChange}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
