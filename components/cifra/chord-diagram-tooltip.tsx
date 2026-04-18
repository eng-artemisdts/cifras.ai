"use client";

import {
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactElement,
} from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  clearChordElement,
  drawChordIntoElement,
  resolveChordDiagram,
  type ResolvedSvguitarChord,
} from "@/lib/cifra/chord-diagram/svguitar-from-db";
import { cn } from "@/lib/utils";

/** Cursor + realce no hover / com tooltip aberto (Radix define `data-state` no trigger). */
const CHORD_DIAGRAM_TRIGGER_CN =
  "cursor-pointer outline-none transition-[background-color,box-shadow] duration-150 hover:bg-cifra-teal/18 hover:shadow-[inset_0_0_0_1px_rgba(15,210,193,0.35)] data-[state=delayed-open]:bg-cifra-teal/22 data-[state=instant-open]:bg-cifra-teal/22 data-[state=delayed-open]:shadow-[inset_0_0_0_1px_rgba(15,210,193,0.45)] data-[state=instant-open]:shadow-[inset_0_0_0_1px_rgba(15,210,193,0.45)] active:cursor-grabbing";

type ChordDiagramTooltipProps = {
  /** Rótulo do acorde (mesmo texto mostrado ao utilizador). */
  label: string;
  /** Elemento clicável/interactivo que dispara o hover (ex.: span do acorde). */
  children: ReactElement;
};

function SvguitarHoverHost({
  resolved,
  regionId,
  visibleLabelId,
}: {
  resolved: ResolvedSvguitarChord;
  regionId: string;
  visibleLabelId: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    drawChordIntoElement(el, resolved);
    return () => clearChordElement(el);
  }, [resolved]);

  return (
    <div
      role="group"
      aria-labelledby={visibleLabelId}
      className="flex flex-col items-center gap-1 text-center"
    >
      <p
        id={visibleLabelId}
        className="w-full text-center font-mono text-[15px] font-semibold leading-tight tracking-tight text-cifra-teal"
      >
        {resolved.displayLabel}
      </p>
      <div
        role="img"
        aria-hidden
        ref={ref}
        className="flex min-h-[128px] min-w-[112px] shrink-0 items-center justify-center [&_svg]:block"
      />
      <span id={regionId} className="sr-only">
        Diagrama do acorde {resolved.displayLabel} para guitarra em afinação standard.
      </span>
    </div>
  );
}

/**
 * Hover: diagrama SVG (svguitar + base chords-db), com cores da UI cifra.
 */
export function ChordDiagramTooltip({ label, children }: ChordDiagramTooltipProps) {
  const resolved = useMemo(() => resolveChordDiagram(label), [label]);
  const regionId = useId();
  const visibleLabelId = useId();

  if (!resolved) {
    return children;
  }

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string }>, {
        className: cn(
          (children as ReactElement<{ className?: string }>).props.className,
          CHORD_DIAGRAM_TRIGGER_CN,
        ),
      })
    : children;

  return (
    <Tooltip delayDuration={280}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        sideOffset={14}
        className={cn(
          "max-w-none border border-cifra-border bg-[#12121f] px-4 py-3 shadow-lg",
          "rounded-[10px]",
        )}
      >
        <SvguitarHoverHost resolved={resolved} regionId={regionId} visibleLabelId={visibleLabelId} />
      </TooltipContent>
    </Tooltip>
  );
}
