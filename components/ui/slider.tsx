"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Slider({
  className,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }) {
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
      {Array.from({ length: props.value?.length ?? props.defaultValue?.length ?? 1 }).map((_, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <SliderPrimitive.Thumb
              data-slot="slider-thumb"
              aria-label={thumbLabels?.[i] ?? `Breakpoint ${i + 1}`}
              className="block size-3.5 shrink-0 rounded-full border border-cifra-teal/75 bg-[#0c0c16] shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-cifra-teal/20 focus-visible:ring-4 focus-visible:ring-cifra-teal/35 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            />
          </TooltipTrigger>
          <TooltipContent side="top">{thumbLabels?.[i] ?? `Breakpoint ${i + 1}`}</TooltipContent>
        </Tooltip>
      ))}
    </SliderPrimitive.Root>
  );
}
