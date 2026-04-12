"use client";

import { Lightbulb, Link2, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { StreamingLinkImportPanelConfig } from "@/lib/library/streaming-link-import-config";
import { cn } from "@/lib/utils";

export type ImportStreamingLinkPanelProps = {
  /** Dados do provider (frames lCtH3, 0dhNf, O39X7, o1Z4x no Pencil). */
  config: StreamingLinkImportPanelConfig;
  className?: string;
};

/**
 * Painel único de importação por URL — recebe `config` por provider (YouTube, Spotify, TikTok, Instagram).
 */
export function ImportStreamingLinkPanel({ config, className }: ImportStreamingLinkPanelProps) {
  const [url, setUrl] = useState("");

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 md:gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
          <h2 className="text-xs font-semibold leading-none text-cifra-text">{config.rowTopTitle}</h2>
        </div>
        <p className="text-right font-mono text-[10px] leading-tight text-cifra-teal">{config.rowTopMonoHint}</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:gap-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-cifra-border bg-cifra-surface">
          <div className="h-1 w-full shrink-0 bg-cifra-teal" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-5 py-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-cifra-muted">{config.cardTag}</span>
            <span className="max-w-[min(100%,260px)] text-right font-mono text-[9px] leading-snug text-cifra-muted">
              {config.cardTagRight}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-5 pb-4 pt-4">
            {config.requiresPro ? (
              <div className="flex items-start gap-2 rounded-xl border border-cifra-gold/40 bg-cifra-gold/10 px-3.5 py-2.5 text-[11px] leading-snug text-cifra-gold">
                <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
                <span>
                  Exclusivo <span className="font-mono font-semibold">Pro</span> — faça upgrade para importar desta
                  origem. Pode explorar os passos e colar o link à vontade; o envio à IA ficará disponível no plano
                  pago.
                </span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              {config.instructions.map((line, i) => (
                <p key={i} className="text-xs leading-normal text-cifra-text">
                  {line}
                </p>
              ))}
            </div>

            <div className="rounded-lg bg-[#12121f] px-3.5 py-3">
              <p className="font-mono text-[9px] tracking-wide text-cifra-muted">Exemplos de URL</p>
              <pre className="mt-1.5 whitespace-pre-wrap break-all font-mono text-[10px] leading-[1.55] text-cifra-teal">
                {config.exampleUrls}
              </pre>
            </div>

            <div>
              <label className="sr-only" htmlFor="streaming-import-url">
                URL
              </label>
              <input
                id="streaming-import-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder={config.urlPlaceholder}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={false}
                className="w-full rounded-lg border border-cifra-border bg-cifra-surface-2 px-3 py-2.5 text-[13px] text-cifra-text placeholder:text-cifra-muted outline-none ring-cifra-teal/30 focus:border-cifra-teal focus:ring-2"
              />
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href="/biblioteca/importar"
                className="text-[11px] font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover"
              >
                ← Voltar para escolher outra origem
              </Link>
              <button
                type="button"
                disabled={config.requiresPro || !url.trim()}
                className="rounded-lg bg-cifra-teal px-4 py-2 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-cifra-border bg-cifra-border sm:grid-cols-3">
          {config.metaColumns.map((col) => (
            <div
              key={col.title}
              className="bg-cifra-surface-2 px-4 py-3 sm:border-r sm:border-white/6 last:sm:border-r-0"
            >
              <p
                className={cn(
                  "text-[10px] font-semibold leading-tight",
                  col.titleVariant === "gold" ? "text-cifra-gold" : "text-cifra-text"
                )}
              >
                {col.title}
              </p>
              <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">{col.body}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 pt-0.5">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-cifra-gold" strokeWidth={1.75} aria-hidden />
          <p className="text-[10px] leading-[1.45] text-cifra-muted">{config.hint}</p>
        </div>
      </div>
    </div>
  );
}
