"use client";

import { LibraryExploreSearch } from "./library-explore-search";

export function LibraryMainSearchHero() {
  return (
    <section className="flex w-full max-w-[1200px] flex-col items-center gap-3 px-6 pb-6 pt-10 md:px-8">
      <h1 className="text-center font-serif text-3xl font-normal text-cifra-text md:text-[34px]">
        Minha biblioteca
      </h1>
      <p className="max-w-[560px] text-center text-sm leading-relaxed text-cifra-muted">
        Cifras que você salvou, edições manuais e versões da IA — tudo organizado aqui.
      </p>
      <LibraryExploreSearch
        placeholder="Buscar faixas, artistas, álbuns…"
        resultsBasePath="/biblioteca/busca"
        className="mt-0"
      />
    </section>
  );
}
