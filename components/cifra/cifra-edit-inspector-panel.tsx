"use client";

import { ArrowRight, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { CifraChordOverlapBar } from "@/components/cifra/cifra-chord-overlap-bar";
import { patchChordSymbolAndTimes } from "@/components/cifra/cifra-chord-edit-popover";
import type { MusicAiChordEvent } from "@/lib/cifra/musicai-types";
import { chordDisplayLabel } from "@/lib/cifra/transcription-editor-model";
import type { LyricWordSlot } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

export type CifraEditInspectorPanelProps = {
  activeSlot: LyricWordSlot | null;
  activeChord: MusicAiChordEvent | null;
  activeChordIndex: number | null;
  onChordApply: (index: number, next: MusicAiChordEvent) => void;
  onChordRemove: (index: number) => void;
  /** Só altera o fim do acorde (ex.: arrasto na barra). */
  onChordEndChange: (index: number, nextEnd: number) => void;
  className?: string;
  /** Sem moldura de sidebar: para popup / painel flutuante. */
  embedded?: boolean;
  /** Esconde o rótulo «Detalhe» (ex.: cabeçalho já existe no diálogo). */
  hideEmbeddedHeader?: boolean;
  /** Diálogo de acorde: só formulário (sem cartão-resumo nem barra de duração na palavra). */
  chordDialogFormOnly?: boolean;
};

export function CifraEditInspectorPanel({
  activeSlot,
  activeChord,
  activeChordIndex,
  onChordApply,
  onChordRemove,
  onChordEndChange,
  className,
  embedded = false,
  hideEmbeddedHeader = false,
  chordDialogFormOnly = false,
}: CifraEditInspectorPanelProps) {
  const [sym, setSym] = useState("");
  const [startStr, setStartStr] = useState("");
  const [endStr, setEndStr] = useState("");

  useEffect(() => {
    if (!activeChord) {
      setSym("");
      setStartStr("");
      setEndStr("");
      return;
    }
    setSym(chordDisplayLabel(activeChord));
    setStartStr(String(Number((activeChord.start ?? 0).toFixed(3))));
    setEndStr(String(Number((activeChord.end ?? 0).toFixed(3))));
  }, [activeChord]);

  const applyTimesAndSymbol = () => {
    if (activeChordIndex == null || !activeChord) return;
    const start = parseFloat(startStr.replace(",", "."));
    const end = parseFloat(endStr.replace(",", "."));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
    onChordApply(activeChordIndex, patchChordSymbolAndTimes(activeChord, start, end, sym.trim() || "N.C."));
  };

  const chordDurationPreview = useMemo(() => {
    const start = parseFloat(startStr.replace(",", "."));
    const end = parseFloat(endStr.replace(",", "."));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return `${(end - start).toFixed(2)} s`;
  }, [startStr, endStr]);

  const Shell = embedded ? "div" : "aside";

  return (
    <Shell
      className={cn(
        embedded
          ? "flex w-full flex-col gap-3"
          : "flex w-full shrink-0 flex-col gap-3 rounded-xl border border-cifra-border bg-cifra-surface p-3.5 lg:w-[296px]",
        className,
      )}
    >
      {!chordDialogFormOnly &&
        (!embedded || !hideEmbeddedHeader ? (
          <p className="font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-cifra-teal">Detalhe</p>
        ) : (
          <p className="font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-cifra-muted">Acorde</p>
        ))}

      {!embedded ? (
        <div>
          <p className="text-[11px] font-semibold text-cifra-text">Palavra ativa</p>
          <p
            className={cn(
              "mt-1 font-serif text-[20px] italic leading-tight",
              activeSlot ? "text-cifra-gold" : "text-cifra-muted",
            )}
          >
            {activeSlot?.text ?? "—"}
          </p>
        </div>
      ) : null}

      {activeChord != null && activeChordIndex != null ? (
        <>
          {!chordDialogFormOnly ? (
            <div className="rounded-lg border border-cifra-border bg-cifra-surface-2/50 p-3">
              <p className="text-[9px] font-medium text-cifra-muted">
                {activeSlot ? "Acorde nesta palavra" : "Acorde (intro / instrumental)"}
              </p>
              <p className="mt-1 font-mono text-[12px] text-cifra-text">
                {chordDisplayLabel(activeChord)} · {(Math.max(0.05, activeChord.end - activeChord.start)).toFixed(2)} s
              </p>
            </div>
          ) : null}

          {!chordDialogFormOnly && activeSlot ? (
            <CifraChordOverlapBar
              slot={activeSlot}
              chord={activeChord}
              onChordEndChange={(nextEnd) => onChordEndChange(activeChordIndex, nextEnd)}
            />
          ) : null}

          <div className="space-y-2">
            <label className="text-[9px] text-cifra-muted">Símbolo</label>
            <input
              value={sym}
              onChange={(e) => setSym(e.target.value)}
              className="w-full rounded-lg border border-cifra-border bg-[#0c0c16] px-2 py-1.5 text-center font-mono text-[13px] text-cifra-teal outline-none focus:border-cifra-teal/40"
            />
            <div className="rounded-xl border border-cifra-teal/20 bg-linear-to-b from-[#12121f]/95 to-[#080810] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cifra-muted">
                  Intervalo (s)
                </span>
                {chordDurationPreview ? (
                  <span className="rounded-md border border-cifra-teal/25 bg-cifra-teal/10 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-cifra-teal">
                    Δ {chordDurationPreview}
                  </span>
                ) : null}
              </div>
              <div className="flex items-end gap-2 sm:gap-3">
                <label className="group flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-cifra-teal/95">
                    <span className="inline-flex size-6 items-center justify-center rounded-lg bg-cifra-teal/15 ring-1 ring-cifra-teal/25">
                      <Play className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    </span>
                    Início
                  </span>
                  <input
                    value={startStr}
                    onChange={(e) => setStartStr(e.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.000"
                    className="w-full rounded-lg border border-white/9 bg-[#0c0c16] px-2.5 py-2 text-center font-mono text-[13px] font-medium tabular-nums tracking-tight text-cifra-text shadow-inner outline-none transition-[border-color,box-shadow] placeholder:text-cifra-muted/50 focus:border-cifra-teal/45 focus:ring-2 focus:ring-cifra-teal/25"
                  />
                </label>
                <div
                  className="flex shrink-0 flex-col justify-end pb-2 text-cifra-muted/70"
                  aria-hidden
                >
                  <ArrowRight className="size-4 sm:size-[18px]" strokeWidth={2} />
                </div>
                <label className="group flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-cifra-teal/95">
                    <span className="inline-flex size-6 items-center justify-center rounded-lg bg-cifra-teal/15 ring-1 ring-cifra-teal/25">
                      <Square className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    </span>
                    Fim
                  </span>
                  <input
                    value={endStr}
                    onChange={(e) => setEndStr(e.target.value)}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.000"
                    className="w-full rounded-lg border border-white/9 bg-[#0c0c16] px-2.5 py-2 text-center font-mono text-[13px] font-medium tabular-nums tracking-tight text-cifra-text shadow-inner outline-none transition-[border-color,box-shadow] placeholder:text-cifra-muted/50 focus:border-cifra-teal/45 focus:ring-2 focus:ring-cifra-teal/25"
                  />
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={applyTimesAndSymbol}
              className="w-full rounded-lg border border-cifra-teal/40 bg-cifra-teal/15 py-1.5 text-[10px] font-semibold text-cifra-teal hover:bg-cifra-teal/25"
            >
              Aplicar símbolo e tempos
            </button>
            <button
              type="button"
              onClick={() => onChordRemove(activeChordIndex)}
              className="w-full text-center text-[11px] text-red-300/90 hover:text-red-200"
            >
              Remover acorde
            </button>
          </div>
        </>
      ) : activeSlot ? (
        <p className="text-[10px] text-cifra-muted">
          Sem acorde nesta palavra. Use «Acorde na palavra ativa» na barra de ferramentas acima.
        </p>
      ) : (
        <p className="text-[10px] text-cifra-muted">
          Toque numa palavra ou num acorde de intro/instrumental para editar.
        </p>
      )}
    </Shell>
  );
}
