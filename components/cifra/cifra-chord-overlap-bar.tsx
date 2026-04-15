"use client";

import { useCallback, useRef } from "react";

import type { MusicAiChordEvent } from "@/lib/cifra/musicai-types";
import { chordOverlapLayoutOnWord } from "@/lib/cifra/transcription-editor-model";
import type { LyricWordSlot } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

export type CifraChordOverlapBarProps = {
  slot: LyricWordSlot;
  chord: MusicAiChordEvent;
  /** Atualiza o fim do acorde ao arrastar o extremo direito (clamp à palavra). */
  onChordEndChange: (nextEnd: number) => void;
  className?: string;
};

/**
 * Barra temporal da palavra com preenchimento = interseção acorde ∩ palavra.
 * Arrastar o grip à direita ajusta `chord.end` (mín. chord.start + 0,05 s, máx. slot.end).
 */
export function CifraChordOverlapBar({ slot, chord, onChordEndChange, className }: CifraChordOverlapBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const { leftFrac, widthFrac } = chordOverlapLayoutOnWord(slot, chord);

  const setEndFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const t = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      const frac = Math.min(1, Math.max(0, t));
      const nextEnd = slot.start + frac * (slot.end - slot.start);
      const lo = Math.max(chord.start + 0.05, slot.start);
      const hi = slot.end;
      onChordEndChange(Math.min(hi, Math.max(lo, nextEnd)));
    },
    [chord.start, onChordEndChange, slot.end, slot.start],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!dragging.current) return;
      setEndFromClientX(e.clientX);
    },
    [setEndFromClientX],
  );

  const endDrag = useCallback(() => {
    dragging.current = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
  }, [onPointerMove]);

  const onPointerDownHandle = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    },
    [endDrag, onPointerMove],
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-semibold text-cifra-text">Duração do acorde na palavra</p>
      <p className="text-[9px] leading-snug text-cifra-muted">
        Barra = palavra ({slot.start.toFixed(3)} s → {slot.end.toFixed(3)} s). Cor = acorde. Arraste o ponto para
        ajustar o fim.
      </p>
      <div
        ref={trackRef}
        className="relative h-7 w-full rounded-md bg-white/10"
        role="slider"
        aria-valuemin={slot.start}
        aria-valuemax={slot.end}
        aria-valuenow={chord.end}
        aria-label="Fim do acorde na palavra"
      >
        <div
          className="pointer-events-none absolute top-1 bottom-1 rounded bg-cifra-gold/85"
          style={{
            left: `${leftFrac * 100}%`,
            width: `${Math.max(4, widthFrac * 100)}%`,
          }}
        />
        <button
          type="button"
          className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border border-white/30 bg-cifra-gold shadow-sm hover:bg-cifra-gold/90"
          style={{
            left: `calc(${Math.min(1, leftFrac + widthFrac) * 100}% - 7px)`,
          }}
          aria-label="Arrastar para alterar o fim do acorde"
          onPointerDown={onPointerDownHandle}
        />
      </div>
    </div>
  );
}
