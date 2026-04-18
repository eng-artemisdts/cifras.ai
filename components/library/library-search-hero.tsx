import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { LibraryExploreSearch } from "./library-explore-search";

export type LibrarySearchHeroProps = {
  title?: string;
  description?: string;
  placeholder?: string;
  className?: string;
};

/**
 * Bloco hero com busca (sugestões no popover; lista completa em /explorar/busca via Buscar ou Enter).
 */
export function LibrarySearchHero({
  title = "O que você quer ouvir?",
  description = "Busque músicas, artistas, álbuns e playlists em um só lugar.",
  placeholder = "Buscar faixas, artistas, álbuns…",
  className,
}: LibrarySearchHeroProps) {
  return (
    <section
      className={cn(
        "flex w-full max-w-[720px] flex-col items-center gap-3 px-6 pb-6 pt-10 md:px-8",
        className
      )}
    >
      <Link
        href="/"
        className="flex justify-center transition-opacity hover:opacity-90"
        aria-label="cifra.ai — início"
      >
        <Image
          src="/logo.svg"
          alt="cifra.ai"
          width={228}
          height={60}
          className="h-8 w-auto object-contain sm:h-9"
          style={{ width: "auto" }}
          priority
          unoptimized
        />
      </Link>
      <h1 className="text-center font-serif text-3xl font-normal text-cifra-text md:text-[34px]">
        {title}
      </h1>
      <p className="max-w-[560px] text-center text-sm leading-relaxed text-cifra-muted">
        {description}
      </p>
      <LibraryExploreSearch placeholder={placeholder} />
    </section>
  );
}
