import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { bibliotecaCifraHref } from "@/lib/library/biblioteca-cifra-href";

export const metadata: Metadata = {
  title: "Cifra · Biblioteca · cifra.ai",
  description: "Pré-visualização sincronizada de letra e acordes.",
};

export default async function BibliotecaCifraPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ trackId?: string }>;
}>) {
  const sp = await searchParams;
  const trackId = typeof sp.trackId === "string" && sp.trackId.trim() ? sp.trackId.trim() : null;

  if (trackId) {
    redirect(bibliotecaCifraHref(trackId, "a"));
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cifra-bg px-6 text-center text-cifra-text">
      <p className="max-w-md text-sm text-cifra-muted">
        Indique uma faixa na URL, por exemplo{" "}
        <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">
          /biblioteca/cifra/a?trackId=all_i_need
        </code>{" "}
        (letra IA) ou{" "}
        <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">
          /biblioteca/cifra/m?trackId=all_i_need
        </code>{" "}
        (letra match).
      </p>
      <Link
        href="/biblioteca/importar/arquivo"
        className="text-sm font-semibold text-cifra-teal hover:text-cifra-teal-hover"
      >
        Voltar à importação por ficheiro
      </Link>
    </div>
  );
}
