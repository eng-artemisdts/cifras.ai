"use client";

import { Loader2, Music2, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { AuthMarketingSidebar } from "@/components/layout/auth-marketing-sidebar";
import { LibraryPageFooter } from "@/components/library/library-page-footer";
import { LibraryTopNav, type LibraryTopNavUser } from "@/components/library/library-top-nav";
import {
  useIngestJobs,
  type TrackedIngestJob,
} from "@/components/providers/ingest-jobs-context";
import type { BillingPlan } from "@/lib/billing/plan-types";
import type { LibraryNavItem } from "@/lib/library/types";
import { cn } from "@/lib/utils";

function sourceLabel(source: TrackedIngestJob["source"]): string {
  if (source === "spotify") return "Spotify";
  if (source === "arquivo") return "Ficheiro";
  return "URL";
}

function IngestJobThumb({ coverUrl }: { coverUrl: string | null | undefined }) {
  const src = typeof coverUrl === "string" && coverUrl.trim() && /^https?:\/\//i.test(coverUrl.trim())
    ? coverUrl.trim()
    : null;
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-[#16162a] ring-1 ring-white/10">
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes="56px"
          unoptimized
        />
      ) : (
        <Music2 className="absolute inset-0 m-auto size-6 text-cifra-muted/90" strokeWidth={1.5} aria-hidden />
      )}
    </div>
  );
}

function statusBadge(job: TrackedIngestJob) {
  if (job.status === "completed") {
    return (
      <span className="rounded-full border border-cifra-teal/40 bg-cifra-teal/15 px-2 py-0.5 font-mono text-[10px] text-cifra-teal">
        Concluído
      </span>
    );
  }
  if (job.status === "failed" || job.status === "cancelled") {
    return (
      <span className="rounded-full border border-red-400/35 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] text-red-300">
        Falhou
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-200">
      Em progresso
    </span>
  );
}

export type BibliotecaIngestoesViewProps = {
  navItems: LibraryNavItem[];
  user?: LibraryTopNavUser | null;
  billingPlan?: BillingPlan | null;
  className?: string;
};

export function BibliotecaIngestoesView({
  navItems,
  user,
  billingPlan,
  className,
}: BibliotecaIngestoesViewProps) {
  const { jobs, dismissJob, clearCompletedFromList } = useIngestJobs();
  const hasCompleted = jobs.some((j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled");
  const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");

  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-cifra-bg text-cifra-text lg:flex-row lg:items-stretch",
        className,
      )}
    >
      <AuthMarketingSidebar
        contextLabel="cifra.ai"
        contextUppercase={false}
        titleLine1="Cifras"
        titleLine2="em progresso"
        titleLine3="Acompanhe a preparação sem bloquear o resto do site."
        introText="Os pedidos continuam a ser processados enquanto navega. Quando uma cifra ficar pronta, pode abrir o editor a partir do aviso ou desta lista."
        features={[
          { title: "Actualização automática", description: "O estado refresca-se sozinho." },
          { title: "Aviso quando pronto", description: "Abrir edição assim que terminar." },
        ]}
        className="hidden min-h-0 shrink-0 lg:flex lg:min-h-dvh"
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-dvh lg:border-l lg:border-white/7">
        <LibraryTopNav items={navItems} user={user} billingPlan={billingPlan ?? undefined} />

        <main className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-4 md:px-8 md:py-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-cifra-text">Cifras em progresso</h1>
              <p className="mt-1 max-w-xl text-[12px] leading-snug text-cifra-muted">
                Pedidos de criação de cifra a partir de áudio ou Spotify. Esta página actualiza-se
                automaticamente.
              </p>
            </div>
            {hasCompleted ? (
              <button
                type="button"
                onClick={clearCompletedFromList}
                className="shrink-0 rounded-lg border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-cifra-muted transition hover:bg-white/10 hover:text-cifra-text"
              >
                Limpar concluídos
              </button>
            ) : null}
          </div>

          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/12 bg-cifra-surface/40 px-6 py-16 text-center">
              <Music2 className="size-10 text-cifra-muted/80" strokeWidth={1.25} aria-hidden />
              <p className="max-w-sm text-[13px] text-cifra-muted">
                Nenhum pedido em curso. Importe música pelo Spotify ou por ficheiro — o progresso
                aparecerá aqui.
              </p>
              <Link
                href="/biblioteca/importar"
                className="rounded-full bg-cifra-teal px-4 py-2 text-[12px] font-semibold text-cifra-bg transition hover:bg-cifra-teal/90"
              >
                Ir para importar
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {jobs.map((job) => (
                <li
                  key={job.jobId}
                  className="rounded-2xl border border-white/8 bg-cifra-surface p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <IngestJobThumb coverUrl={job.coverUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-cifra-muted">
                            {sourceLabel(job.source)}
                          </span>
                          {statusBadge(job)}
                        </div>
                        <h2 className="mt-1 truncate text-sm font-semibold text-cifra-text">{job.title}</h2>
                        <p className="truncate text-[11px] text-cifra-muted">{job.artist}</p>
                        {(job.status === "queued" || job.status === "running") && (
                          <div className="mt-3 space-y-2">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-cifra-teal transition-[width] duration-500"
                                style={{
                                  width: `${Math.min(100, Math.max(0, job.progressPercent))}%`,
                                }}
                              />
                            </div>
                            <p className="text-[11px] text-cifra-muted">{job.stageLabel}</p>
                            <p className="font-mono text-[10px] tabular-nums text-cifra-teal/90">
                              {Math.round(Math.min(100, Math.max(0, job.progressPercent)))}%
                            </p>
                          </div>
                        )}
                        {job.error ? (
                          <p className="mt-2 text-[11px] leading-snug text-red-300">{job.error}</p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => dismissJob(job.jobId)}
                      className="shrink-0 rounded-lg border border-white/10 p-2 text-cifra-muted transition hover:bg-white/6 hover:text-cifra-text"
                      aria-label="Remover da lista"
                      title="Remover da lista"
                    >
                      <Trash2 className="size-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {hasActive ? (
            <p className="flex items-center gap-2 text-[11px] text-cifra-muted">
              <Loader2 className="size-3.5 animate-spin shrink-0" aria-hidden />
              A sincronizar estado com o servidor…
            </p>
          ) : null}
        </main>

        <LibraryPageFooter className="mt-0 shrink-0 border-t border-white/7" />
      </div>
    </div>
  );
}
