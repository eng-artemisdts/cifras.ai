import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type LibrarySearchHeroProps = {
  title?: string;
  description?: string;
  placeholder?: string;
  className?: string;
};

/**
 * Bloco hero com busca (apenas UI).
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
      <form
        className="mt-2 flex w-full max-w-[720px] flex-col gap-2.5 sm:flex-row sm:items-stretch"
        action="#"
        method="get"
      >
        <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-white/[0.07] bg-cifra-surface-2 px-4 py-2.5">
          <Search className="size-[18px] shrink-0 text-cifra-muted" strokeWidth={1.75} />
          <input
            type="search"
            name="q"
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-cifra-text placeholder:text-[#6b6b8a] outline-none"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="h-12 shrink-0 rounded-[10px] bg-cifra-teal px-5 text-[13px] font-semibold text-cifra-bg transition-opacity hover:opacity-95 sm:h-auto sm:px-6"
        >
          Buscar
        </button>
      </form>
    </section>
  );
}
