"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { MusicAiDemoPayload } from "@/lib/cifra/musicai-types";
import { cn } from "@/lib/utils";

export type CifraEditMetaSidebarProps = {
  payload: MusicAiDemoPayload;
  /** Rótulo curto da variante de letra (ex.: letra IA). */
  lyricsVariantLabel: string;
  /** Aplicar linha colada à secção ativa (palavras separadas por espaços). */
  onBulkApplyLine: (line: string) => void;
  className?: string;
};

export function CifraEditMetaSidebar({
  payload,
  lyricsVariantLabel,
  onBulkApplyLine,
  className,
}: CifraEditMetaSidebarProps) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const capo = payload.capo_at;
  const tune = typeof payload.original_tune === "string" && payload.original_tune.trim() ? payload.original_tune.trim() : "—";
  const dur = payload.meta?.duration_seconds;
  const durLabel =
    dur != null && Number.isFinite(dur) && dur > 0
      ? `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, "0")}`
      : "—";

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col gap-3 rounded-xl border border-cifra-border bg-cifra-surface p-3.5 lg:w-[252px]",
        className,
      )}
    >
      <p className="font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-cifra-teal">Faixa</p>
      <div className="space-y-1.5 text-[11px]">
        <p className="font-semibold text-cifra-text">Tom: —</p>
        <p className="text-cifra-muted">
          <span className="text-cifra-muted/80">Afinação:</span> {tune}
        </p>
        <p className="text-cifra-muted">
          <span className="text-cifra-muted/80">Capo:</span>{" "}
          {capo != null && Number.isFinite(capo) && capo > 0 ? String(capo) : "—"}
        </p>
        <p className="text-cifra-muted">
          <span className="text-cifra-muted/80">Duração (meta):</span> {durLabel}
        </p>
        <p className="font-mono text-[9px] text-cifra-muted">{lyricsVariantLabel}</p>
      </div>

      <div className="border-t border-white/6 pt-3">
        <button
          type="button"
          onClick={() => setBulkOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-cifra-border px-2.5 py-2 text-left text-[11px] font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35"
        >
          <span>Várias palavras</span>
          {bulkOpen ? <ChevronDown className="size-4 shrink-0 text-cifra-muted" /> : <ChevronRight className="size-4 shrink-0 text-cifra-muted" />}
        </button>
        {bulkOpen ? (
          <div className="mt-2 space-y-2">
            <p className="text-[9px] leading-snug text-cifra-muted">
              Cole uma linha ou palavras separadas por espaços. Substituem os textos da secção ativa (mantendo tempos).
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={4}
              className="w-full resize-y rounded-lg border border-cifra-border bg-[#0c0c16] px-2 py-1.5 font-sans text-[11px] text-cifra-text outline-none focus:border-cifra-teal/40"
              placeholder="uma linha de palavras…"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onBulkApplyLine(bulkText);
                  setBulkText("");
                }}
                className="rounded-lg bg-cifra-teal px-3 py-1.5 text-[10px] font-semibold text-cifra-bg hover:opacity-95"
              >
                Aplicar à secção
              </button>
              <button
                type="button"
                onClick={() => setBulkText("")}
                className="rounded-lg border border-cifra-border px-3 py-1.5 text-[10px] font-semibold text-cifra-muted hover:border-cifra-teal/30"
              >
                Limpar
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
