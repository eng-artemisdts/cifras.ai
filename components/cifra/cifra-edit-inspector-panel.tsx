"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { CifraChordOverlapBar } from "@/components/cifra/cifra-chord-overlap-bar";
import { patchChordSymbolAndTimes } from "@/components/cifra/cifra-chord-edit-popover";
import type { MusicAiChordEvent } from "@/lib/cifra/musicai-types";
import { chordDisplayLabel } from "@/lib/cifra/transcription-editor-model";
import type { LyricWordSlot } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

const DICT_CHORDS = ["Am", "G", "C", "Dm7", "Fmaj7", "Em", "D", "A7", "Bm", "E"];

export type CifraEditInspectorPanelProps = {
  activeSlot: LyricWordSlot | null;
  activeChord: MusicAiChordEvent | null;
  activeChordIndex: number | null;
  onChordApply: (index: number, next: MusicAiChordEvent) => void;
  onChordRemove: (index: number) => void;
  /** Só altera o fim do acorde (ex.: arrasto na barra). */
  onChordEndChange: (index: number, nextEnd: number) => void;
  onPickDictionaryChord: (symbol: string) => void;
  className?: string;
};

export function CifraEditInspectorPanel({
  activeSlot,
  activeChord,
  activeChordIndex,
  onChordApply,
  onChordRemove,
  onChordEndChange,
  onPickDictionaryChord,
  className,
}: CifraEditInspectorPanelProps) {
  const [dictOpen, setDictOpen] = useState(false);
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

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col gap-3 rounded-xl border border-cifra-border bg-cifra-surface p-3.5 lg:w-[296px]",
        className,
      )}
    >
      <p className="font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-cifra-teal">Detalhe</p>

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

      {activeChord != null && activeChordIndex != null ? (
        <>
          <div className="rounded-lg border border-cifra-border bg-cifra-surface-2/50 p-3">
            <p className="text-[9px] font-medium text-cifra-muted">
              {activeSlot ? "Acorde nesta palavra" : "Acorde (intro / instrumental)"}
            </p>
            <p className="mt-1 font-mono text-[12px] text-cifra-text">
              {chordDisplayLabel(activeChord)} · {(Math.max(0.05, activeChord.end - activeChord.start)).toFixed(2)} s
            </p>
          </div>

          {activeSlot ? (
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] text-cifra-muted">Início (s)</label>
                <input
                  value={startStr}
                  onChange={(e) => setStartStr(e.target.value)}
                  inputMode="decimal"
                  className="mt-0.5 w-full rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 font-mono text-[10px] text-cifra-text"
                />
              </div>
              <div>
                <label className="text-[9px] text-cifra-muted">Fim (s)</label>
                <input
                  value={endStr}
                  onChange={(e) => setEndStr(e.target.value)}
                  inputMode="decimal"
                  className="mt-0.5 w-full rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1 font-mono text-[10px] text-cifra-text"
                />
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
          Sem acorde nesta palavra. Use «Acorde na palavra ativa» ou o dicionário.
        </p>
      ) : (
        <p className="text-[10px] text-cifra-muted">
          Toque numa palavra ou num acorde de intro/instrumental para editar.
        </p>
      )}

      <div className="border-t border-white/6 pt-3">
        <button
          type="button"
          onClick={() => setDictOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-cifra-border px-2.5 py-2 text-left text-[11px] font-semibold text-cifra-gold transition-colors hover:border-cifra-gold/40"
        >
          <span>Dicionário de acordes</span>
          {dictOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        </button>
        {dictOpen ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DICT_CHORDS.map((c) => (
              <button
                key={c}
                type="button"
                disabled={!activeSlot}
                onClick={() => onPickDictionaryChord(c)}
                className="rounded-md border border-cifra-border bg-cifra-surface-2 px-2.5 py-1 font-mono text-[11px] text-cifra-teal hover:border-cifra-teal/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
