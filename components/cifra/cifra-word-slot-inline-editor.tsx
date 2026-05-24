"use client";

import { useEffect, useState } from "react";

import type { LyricWordSlot } from "@/lib/cifra/transcription-editor-model";
import { cn } from "@/lib/utils";

export type CifraWordSlotInlineEditorProps = {
  slot: LyricWordSlot;
  onApply: (text: string, start: number, end: number) => void;
  onCancel: () => void;
  /** `panel` = largura total (ex.: diálogo). */
  variant?: "compact" | "panel";
  /** Se falso, não foca o primeiro campo (ex.: diálogo que gere o foco). */
  autoFocus?: boolean;
};

export function CifraWordSlotInlineEditor({
  slot,
  onApply,
  onCancel,
  variant = "compact",
  autoFocus = true,
}: CifraWordSlotInlineEditorProps) {
  const [text, setText] = useState(slot.text);
  const [sStr, setSStr] = useState(() => String(Number(slot.start.toFixed(3))));
  const [eStr, setEStr] = useState(() => String(Number(slot.end.toFixed(3))));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setText(slot.text);
    setSStr(String(Number(slot.start.toFixed(3))));
    setEStr(String(Number(slot.end.toFixed(3))));
    setErr(null);
  }, [slot.id, slot.text, slot.start, slot.end]);

  const apply = () => {
    const t = text.trim() || "·";
    const s = parseFloat(sStr.replace(",", "."));
    const e = parseFloat(eStr.replace(",", "."));
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      setErr("Use números válidos; o fim deve ser maior que o início.");
      return;
    }
    setErr(null);
    onApply(t, s, Math.max(s + 0.02, e));
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2 rounded-md border border-cifra-teal/40 bg-[#080810] p-1.5",
        variant === "compact" && "min-w-[8.5rem] max-w-56",
        variant === "panel" && "max-w-none rounded-xl p-3",
      )}
    >
      <input
        autoFocus={autoFocus}
        value={text}
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            apply();
          }
          if (ev.key === "Escape") onCancel();
        }}
        className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1.5 py-1.5 text-center text-[12px] text-cifra-text outline-none focus:border-cifra-teal/40"
        aria-label="Texto da palavra"
      />
      <div className="grid grid-cols-2 gap-x-1.5 gap-y-0.5">
        <label className="col-span-2 text-[9px] font-medium text-cifra-muted">Tempos (s)</label>
        <input
          value={sStr}
          onChange={(ev) => setSStr(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              apply();
            }
            if (ev.key === "Escape") onCancel();
          }}
          inputMode="decimal"
          placeholder="Início"
          className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1 py-1 font-mono text-[11px] text-cifra-text outline-none focus:border-cifra-teal/40"
          aria-label="Início da palavra em segundos"
        />
        <input
          value={eStr}
          onChange={(ev) => setEStr(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              apply();
            }
            if (ev.key === "Escape") onCancel();
          }}
          inputMode="decimal"
          placeholder="Fim"
          className="w-full rounded border border-cifra-border bg-[#0c0c16] px-1 py-1 font-mono text-[11px] text-cifra-text outline-none focus:border-cifra-teal/40"
          aria-label="Fim da palavra em segundos"
        />
      </div>
      {err ? (
        <p className="text-[10px] leading-tight text-red-300/90" role="alert">
          {err}
        </p>
      ) : null}
      <div className={cn("flex justify-end pt-0.5", variant === "panel" ? "gap-2" : "gap-1.5")}>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-cifra-border px-2 py-0.5 text-[10px] font-semibold text-cifra-muted transition-colors hover:border-cifra-teal/30 hover:text-cifra-text"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={apply}
          className={cn(
            "rounded bg-cifra-teal font-semibold text-cifra-bg transition-opacity hover:opacity-95",
            variant === "panel" ? "px-3 py-1 text-[10px]" : "px-2.5 py-0.5 text-[10px]",
          )}
        >
          {variant === "panel" ? "Aplicar letra e tempos" : "Aplicar"}
        </button>
      </div>
    </div>
  );
}
