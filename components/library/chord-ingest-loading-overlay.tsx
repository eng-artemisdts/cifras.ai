"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const STEP_MESSAGES = [
  "A enviar o áudio de forma segura…",
  "A mapear a harmonia ao longo da faixa…",
  "A detetar acordes e estrutura da música…",
  "A preparar a cifra no nosso estúdio…",
] as const;

function EqualizerBars({ className }: { className?: string }) {
  const heightsPx = [14, 22, 30, 26, 18, 24, 16];
  return (
    <div className={cn("flex h-[34px] items-end justify-center gap-[3px]", className)} aria-hidden>
      {heightsPx.map((h, i) => (
        <span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-gradient-to-t from-cifra-teal/35 to-cifra-teal"
          style={{
            height: h,
            animation: `cifra-eq-bar ${0.52 + (i % 4) * 0.1}s ease-in-out infinite`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}

export type ChordIngestLoadingOverlayProps = {
  songTitle: string;
  artistName: string;
  className?: string;
};

/**
 * Estado de espera rico durante `postTrackIngestWithMeta` — harmonia, acordes e secções.
 */
export function ChordIngestLoadingOverlay({
  songTitle,
  artistName,
  className,
}: ChordIngestLoadingOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % STEP_MESSAGES.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const step = STEP_MESSAGES[stepIndex] ?? STEP_MESSAGES[0];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
      className={cn(
        "absolute inset-0 z-20 flex flex-col items-center justify-center overflow-hidden rounded-2xl",
        "bg-[#080810]/93 px-6 py-8 text-center shadow-[inset_0_0_80px_rgba(15,210,193,0.07)] backdrop-blur-[4px]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-60"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, rgba(15,210,193,0.14) 18%, transparent 35%, transparent 55%, rgba(240,180,41,0.1) 72%, transparent 88%)",
          animation: "cifra-orbit 14s linear infinite",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/[0.06]" aria-hidden />

      <div className="relative flex max-w-[280px] flex-col items-center gap-5">
        <div className="relative flex size-[72px] items-center justify-center">
          <span
            className="absolute inset-0 rounded-full border border-cifra-teal/25"
            style={{ animation: "cifra-orbit 8s linear infinite" }}
            aria-hidden
          />
          <span
            className="absolute inset-1 rounded-full border border-cifra-gold/15"
            style={{ animation: "cifra-orbit 12s linear infinite reverse" }}
            aria-hidden
          />
          <div className="relative flex size-12 items-center justify-center rounded-full bg-[#12121f] ring-1 ring-white/[0.08]">
            <Sparkles className="size-5 text-cifra-teal" strokeWidth={1.65} aria-hidden />
          </div>
        </div>

        <EqualizerBars />

        <div className="space-y-1.5">
          <p className="font-serif text-[17px] font-normal leading-snug tracking-tight text-cifra-text">
            A montar a cifra
          </p>
          <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-cifra-text/90">
            {songTitle}
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-cifra-teal">{artistName}</p>
        </div>

        <p
          key={stepIndex}
          className="min-h-[2.5rem] max-w-[260px] text-[11px] leading-snug text-cifra-muted motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
        >
          {step}
        </p>

        <p className="font-mono text-[9px] text-cifra-muted/70">Isto pode levar um minuto — não feche esta janela</p>
      </div>

      <span className="sr-only">
        A processar a cifra para {songTitle} por {artistName}. {step}
      </span>
    </div>
  );
}
