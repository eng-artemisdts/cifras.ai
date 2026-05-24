"use client";

import { useRouter } from "next/navigation";
import { startTransition, useCallback } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix Select não aceita `value=""`; usamos este token para a cifra base. */
export const CIFRA_VARIATION_BASE_VALUE = "__cifra_base__";

export type CifraVariationOption = {
  value: string;
  label: string;
};

export type CifraVariationSelectProps = {
  artistSlug: string;
  songSlug: string;
  options: CifraVariationOption[];
  /** `""` = cifra base */
  currentValue: string;
  className?: string;
};

/**
 * Troca de variação (shadcn Select / Radix): navegação client + refresh dos Server Components.
 */
export function CifraVariationSelect({
  artistSlug,
  songSlug,
  options,
  currentValue,
  className,
}: CifraVariationSelectProps) {
  const router = useRouter();
  const basePath = `/cifras/${encodeURIComponent(artistSlug)}/${encodeURIComponent(songSlug)}`;

  const selectValue = currentValue.trim() ? currentValue.trim() : CIFRA_VARIATION_BASE_VALUE;

  const onValueChange = useCallback(
    (v: string) => {
      const trackId = v === CIFRA_VARIATION_BASE_VALUE ? "" : v;
      const url = trackId ? `${basePath}?v=${encodeURIComponent(trackId)}` : basePath;
      // Adiar para depois do fecho do Select (Portal Radix); navegação imediata com Next.js
      // pode desmontar a árvore enquanto o Radix ainda faz removeChild no overlay → NotFoundError.
      window.setTimeout(() => {
        startTransition(() => {
          router.push(url);
          router.refresh();
        });
      }, 0);
    },
    [router, basePath],
  );

  if (options.length < 2) return null;

  return (
    <div className={cn("flex min-w-0 max-w-full flex-col gap-1.5", className)}>
      <span className="font-mono text-[9px] font-normal uppercase tracking-[0.14em] text-cifra-muted">
        Versão da cifra
      </span>
      <Select value={selectValue} onValueChange={onValueChange}>
        <SelectTrigger aria-label="Versão da cifra">
          <SelectValue placeholder="Escolher versão" />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={4}>
          {options.map((o) => {
            const itemValue = o.value.trim() ? o.value.trim() : CIFRA_VARIATION_BASE_VALUE;
            return (
              <SelectItem key={itemValue} value={itemValue}>
                {o.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <p className="font-mono text-[9px] leading-snug text-cifra-muted/85">
        Versões públicas aparecem para todos; privadas só para quem as criou.
      </p>
    </div>
  );
}
