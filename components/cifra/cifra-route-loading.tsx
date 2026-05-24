"use client";

import Lottie from "lottie-react";

import loadingAnimation from "@/public/animations/loading.json";

import { cn } from "@/lib/utils";

/** Mesma animação `loading.json`, para uso inline (ex.: popover de busca). */
export function LottieLoadingMark({ className }: { className?: string }) {
  return (
    <div className={cn("size-full min-h-0", className)} aria-hidden>
      <Lottie animationData={loadingAnimation} loop className="size-full" />
    </div>
  );
}

export function CifraRouteLoading() {
  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center gap-6 bg-cifra-bg/95 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="size-[min(280px,70vw)]">
        <LottieLoadingMark className="size-full" />
      </div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-cifra-muted">
        Carregando cifra…
      </p>
    </div>
  );
}
