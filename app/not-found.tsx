import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Home, Music2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Página não encontrada",
  description: "O endereço não existe ou foi movido.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-cifra-bg text-cifra-text">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(15,210,193,0.12),transparent)]"
      />
      <header className="relative z-10 border-b border-cifra-border bg-cifra-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center transition-opacity duration-200 hover:opacity-90 motion-reduce:transition-none"
          >
            <Image
              src="/logo.svg"
              alt="cifra.ai"
              width={228}
              height={60}
              className="h-6 w-auto shrink-0 object-contain"
              style={{ width: "auto" }}
              priority
              unoptimized
            />
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-12 text-center">
        <div className="mb-8 flex size-16 items-center justify-center rounded-2xl border border-cifra-border bg-cifra-surface/80 text-cifra-teal shadow-lg shadow-cifra-teal/5">
          <Music2 className="size-8" aria-hidden />
        </div>
        <p className="font-mono text-sm font-medium uppercase tracking-[0.2em] text-cifra-muted">
          Erro 404
        </p>
        <h1 className="mt-3 max-w-lg font-serif text-4xl font-normal tracking-tight text-cifra-text sm:text-5xl">
          Esta página não existe
        </h1>
        <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-cifra-muted">
          O link pode estar incorreto ou o conteúdo foi removido. Confira o endereço ou volte ao
          início.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-cifra-teal px-5 py-2.5 text-sm font-semibold text-cifra-bg shadow-sm shadow-cifra-teal/20 transition-all duration-200 ease-out hover:bg-cifra-teal-hover hover:shadow-md hover:shadow-cifra-teal/25 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Home className="size-4" aria-hidden />
            Ir para o início
          </Link>
          <Link
            href="/explorar"
            className="rounded-lg border border-cifra-border px-5 py-2.5 text-sm font-medium text-cifra-text transition-all duration-200 ease-out hover:border-cifra-teal/40 hover:text-cifra-teal active:scale-[0.98] motion-reduce:active:scale-100"
          >
            Explorar cifras
          </Link>
        </div>
      </main>
    </div>
  );
}
