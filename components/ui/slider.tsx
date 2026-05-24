"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Slider({
  className,
  thumbLabels,
  thumbHighlight,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  thumbLabels?: string[];
  /** Destaque visual no polegar (ex.: início/fim da secção aberta no editor). */
  thumbHighlight?: (thumbIndex: number) => boolean;
}) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full border border-cifra-border bg-[#0c0c16] data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-cifra-teal/70 data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: props.value?.length ?? props.defaultValue?.length ?? 1 }).map((_, i) => {
        const active = thumbHighlight?.(i) === true;
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <SliderPrimitive.Thumb
                data-slot="slider-thumb"
                data-active-section={active ? "true" : undefined}
                aria-label={thumbLabels?.[i] ?? `Breakpoint ${i + 1}`}
                className={cn(
                  "relative z-0 block size-3.5 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow,transform] focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                  active
                    ? "z-1 scale-110 border border-cifra-teal bg-cifra-teal shadow-[0_0_12px_rgba(15,210,193,0.45)] hover:brightness-110 hover:ring-0 focus-visible:ring-2 focus-visible:ring-cifra-teal focus-visible:ring-offset-2 focus-visible:ring-offset-cifra-bg"
                    : "border-cifra-teal/75 bg-[#0c0c16] hover:ring-4 hover:ring-cifra-teal/20 focus-visible:ring-4 focus-visible:ring-cifra-teal/35",
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="top">{thumbLabels?.[i] ?? `Breakpoint ${i + 1}`}</TooltipContent>
          </Tooltip>
        );
      })}
    </SliderPrimitive.Root>
  );
}
