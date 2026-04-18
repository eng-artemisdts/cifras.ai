import type { Metadata } from "next";

import { CifraEditView } from "@/components/cifra/cifra-edit-view";

export const metadata: Metadata = {
  title: "Editar cifra · cifra.ai",
  description: "Edite a letra e reposicione acordes antes de gravar.",
};

type PageProps = Readonly<{
  searchParams: Promise<{ trackId?: string }>;
}>;

export default async function CifraEditPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const trackId = typeof sp.trackId === "string" && sp.trackId.trim() ? sp.trackId.trim() : null;
  if (!trackId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cifra-bg px-6 text-center text-cifra-text">
        <p className="max-w-md text-sm text-cifra-muted">
          Indique a faixa na URL, por exemplo{" "}
          <code className="rounded bg-cifra-surface px-1 py-0.5 text-cifra-teal">
            ?trackId=all_i_need
          </code>
          .
        </p>
      </div>
    );
  }

  return <CifraEditView trackId={trackId} />;
}
