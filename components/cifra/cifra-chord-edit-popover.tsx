"use client";

import { Popover } from "@base-ui/react/popover";
import { GripVertical, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { MusicAiChordEvent } from "@/lib/cifra/musicai-types";
import { chordDisplayLabel } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

export function patchChordSymbolAndTimes(
  chord: MusicAiChordEvent,
  start: number,
  end: number,
  sym: string,
): MusicAiChordEvent {
  const s = Math.max(0, start);
  const e = Math.max(s + 0.05, end);
  return {
    ...chord,
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

export type CifraChordEditPopoverProps = {
  chord: MusicAiChordEvent;
  chordIndex: number;
  triggerClassName?: string;
  onApply: (index: number, next: MusicAiChordEvent) => void;
  onRemove: (index: number) => void;
  /** Início do arrasto (reposicionar início do acorde sobre uma palavra). */
  onChordDragStart?: (index: number) => void;
  onChordDragEnd?: () => void;
};

/**
 * Edição rápida de acorde (símbolo, início/fim, remover) — Base UI Popover, estilo Auris / Pencil.
 */
export function CifraChordEditPopover({
  chord,
  chordIndex,
  triggerClassName,
  onApply,
  onRemove,
  onChordDragStart,
  onChordDragEnd,
}: CifraChordEditPopoverProps) {
  const symId = useId();
  const startId = useId();
  const endId = useId();
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSymbol(chordDisplayLabel(chord));
    const s0 = Number(chord.start ?? 0);
    const e0 = Number(chord.end ?? s0 + 0.1);
    setStartStr(String(Number(s0.toFixed(3))));
    setEndStr(String(Number(e0.toFixed(3))));
    setError(null);
  }, [open, chord]);

  const apply = () => {
    const start = parseFloat(startStr.replace(",", "."));
    const end = parseFloat(endStr.replace(",", "."));
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError("Use números válidos para os tempos.");
      return;
    }
    if (end <= start) {
      setError("O fim deve ser maior que o início.");
      return;
    }
    const sym = symbol.trim() || "N.C.";
    onApply(chordIndex, patchChordSymbolAndTimes(chord, start, end, sym));
    setOpen(false);
  };

  const remove = () => {
    onRemove(chordIndex);
    setOpen(false);
  };

  const display = chordDisplayLabel(chord);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          "inline-flex min-h-[26px] items-stretch overflow-hidden rounded-[7px] border border-white/20 bg-transparent shadow-none",
          open && "border-cifra-teal/45 ring-1 ring-cifra-teal/15",
        )}
      >
        <span
          draggable
          role="button"
          tabIndex={0}
          aria-label="Arrastar para outra palavra — alinha o início do acorde ao tempo dessa palavra"
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-cifra-chord-index", String(chordIndex));
            e.dataTransfer.effectAllowed = "move";
            onChordDragStart?.(chordIndex);
          }}
          onDragEnd={() => onChordDragEnd?.()}
          className="flex cursor-grab touch-none select-none items-center border-r border-white/15 px-1 text-[#7a7a98] hover:bg-white/[0.04] active:cursor-grabbing"
        >
          <GripVertical className="size-3 shrink-0" strokeWidth={1.75} aria-hidden />
        </span>
        <Popover.Trigger
          type="button"
          className={cn(
            "inline-flex items-center justify-center rounded-none border-0 bg-transparent px-2 py-1.5 font-mono text-[11px] font-normal text-cifra-teal transition-colors hover:bg-cifra-teal/8 data-[popup-open]:bg-cifra-teal/10",
            triggerClassName,
          )}
        >
          {display}
        </Popover.Trigger>
      </div>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="center" sideOffset={8} className="z-[250] outline-none">
          <Popover.Popup className="w-[min(calc(100vw-2rem),280px)] rounded-xl border border-cifra-border bg-[#12121f] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] outline-none">
            <Popover.Title className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-cifra-muted">
              Editar acorde
            </Popover.Title>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <label htmlFor={symId} className="block text-[10px] font-medium text-cifra-muted">
                  Símbolo
                </label>
                <input
                  id={symId}
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full rounded-lg border border-cifra-border bg-[#0c0c16] px-2.5 py-2 font-mono text-[12px] text-cifra-text outline-none ring-cifra-teal/25 focus:border-cifra-teal/40 focus:ring-1"
                  autoComplete="off"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label htmlFor={startId} className="block text-[10px] font-medium text-cifra-muted">
                    Início (s)
                  </label>
                  <input
                    id={startId}
                    type="text"
                    inputMode="decimal"
                    value={startStr}
                    onChange={(e) => setStartStr(e.target.value)}
                    className="w-full rounded-lg border border-cifra-border bg-[#0c0c16] px-2.5 py-2 font-mono text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40 focus:ring-1 focus:ring-cifra-teal/25"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor={endId} className="block text-[10px] font-medium text-cifra-muted">
                    Fim (s)
                  </label>
                  <input
                    id={endId}
                    type="text"
                    inputMode="decimal"
                    value={endStr}
                    onChange={(e) => setEndStr(e.target.value)}
                    className="w-full rounded-lg border border-cifra-border bg-[#0c0c16] px-2.5 py-2 font-mono text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40 focus:ring-1 focus:ring-cifra-teal/25"
                  />
                </div>
              </div>
              {error ? (
                <p className="text-[11px] text-red-300/90" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                <Popover.Close
                  type="button"
                  className="rounded-lg border border-cifra-border px-3 py-2 text-[11px] font-semibold text-cifra-muted transition-colors hover:border-cifra-teal/30 hover:text-cifra-text"
                >
                  Cancelar
                </Popover.Close>
                <button
                  type="button"
                  onClick={remove}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200/90 transition-colors hover:bg-red-500/15"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} aria-hidden />
                  Remover
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="ml-auto rounded-lg bg-cifra-teal px-3.5 py-2 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
