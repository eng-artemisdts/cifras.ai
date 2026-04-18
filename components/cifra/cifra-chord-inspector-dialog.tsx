"use client";

import type { RefObject } from "react";
import { useLayoutEffect, useMemo, useRef } from "react";

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
  resolveChordDiagram,
} from "@/lib/cifra/chord-diagram/svguitar-from-db";
import { chordDisplayLabel } from "@/lib/cifra/transcription-editor-model";
import type { LyricWordSlot } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

function ChordDiagramHero({ label }: { label: string }) {
  const resolved = useMemo(() => resolveChordDiagram(label), [label]);
  const hostRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`Diagrama do acorde ${resolved.displayLabel}`}
      className={cn(
        "flex min-h-[132px] min-w-[116px] shrink-0 items-center justify-center [&_svg]:block",
      )}
    />
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
