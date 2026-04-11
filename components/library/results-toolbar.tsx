import { cn } from "@/lib/utils";

export type ResultsToolbarProps = {
  title?: string;
  countLabel?: string;
  sortLabel?: string;
  className?: string;
};

export function ResultsToolbar({
  title = "Resultados",
  countLabel = "128 itens",
  sortLabel = "Ordenar",
  className,
}: ResultsToolbarProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-between gap-3 px-6 py-2 md:px-8",
        className
      )}
    >
      <span className="text-xs font-semibold tracking-wide text-cifra-text">{title}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-cifra-muted">{countLabel}</span>
        <button
          type="button"
          className="rounded-md border border-white/[0.07] bg-cifra-surface px-2.5 py-1 font-mono text-[10px] text-cifra-teal transition-colors hover:border-cifra-teal/40"
        >
          {sortLabel}
        </button>
      </div>
    </div>
  );
}
