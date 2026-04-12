import { CircleCheck } from "lucide-react";

import { cn } from "@/lib/utils";

export type CifraRightSidebarProps = {
  className?: string;
  trackTitle?: string;
};

/**
 * Painel direito 300px — frame `2Zui4` / `sideR` (Pencil).
 */
export function CifraRightSidebar({ className, trackTitle }: CifraRightSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden w-[300px] shrink-0 flex-col gap-4 border-l border-cifra-border bg-cifra-surface p-5 lg:flex",
        className,
      )}
      aria-label="Painel da faixa"
    >
      <p className="font-mono text-[9px] font-normal uppercase tracking-[0.16em] text-cifra-text-muted">
        Painel da faixa
      </p>

      <div className="flex gap-2.5">
        <CircleCheck className="size-[22px] shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold text-cifra-text">Sincronizado</p>
          <p className="text-[11px] leading-snug text-cifra-text-muted">
            {trackTitle
              ? `Pré-visualização de «${trackTitle}» carregada da base Schubert.`
              : "Revisão salva na sua biblioteca."}
          </p>
        </div>
      </div>

      <div className="h-px w-full bg-cifra-border" aria-hidden />

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#5c5c78]">Publicidade</p>
        <div className="flex min-h-[200px] flex-col justify-center rounded-lg border border-white/[0.06] bg-[#12121f] px-3 py-4">
          <p className="text-center text-[11px] leading-relaxed text-[#6a6a88]">
            Espaço reservado 300×250 — plano Free (laboratório)
          </p>
        </div>
      </div>
    </aside>
  );
}
