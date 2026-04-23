"use client";

import {
  ChevronRight,
  CircleCheck,
  FileDown,
  Library,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

export type CifraRightSidebarProps = {
  className?: string;
  /** Chamado após o painel (e refs) estarem no DOM — necessário quando o pai usa `dynamic(..., { ssr: false })`. */
  onMount?: () => void;
  trackTitle?: string;
  /** Conteúdo opcional sob o estado «Sincronizado» (ex.: selector de versão da cifra). */
  variationSlot?: ReactNode;
  /** Afinação original (texto livre), editável. */
  originalTune: string;
  onOriginalTuneChange: (value: string) => void;
  /** Traste do capo (0–24). */
  capoAt: number;
  onCapoAtChange: (value: number) => void;
  /** Cifra marcada como privada (Pro). */
  isPrivate?: boolean;
  scrollModeAutomaticRef: RefObject<HTMLInputElement | null>;
  scrollModeSmartRef: RefObject<HTMLInputElement | null>;
  autoScrollBtnRef: RefObject<HTMLButtonElement | null>;
  autoScrollLeadRef: RefObject<HTMLInputElement | null>;
  autoScrollLeadValRef: RefObject<HTMLSpanElement | null>;
  autoScrollDurRef: RefObject<HTMLInputElement | null>;
  autoScrollDurValRef: RefObject<HTMLSpanElement | null>;
  libraryTrackKey?: string;
};

export function CifraRightSidebar({
  className,
  trackTitle,
  variationSlot,
  originalTune,
  onOriginalTuneChange,
  capoAt,
  onCapoAtChange,
  isPrivate,
  scrollModeAutomaticRef,
  scrollModeSmartRef,
  autoScrollBtnRef,
  autoScrollLeadRef,
  autoScrollLeadValRef,
  autoScrollDurRef,
  autoScrollDurValRef,
  libraryTrackKey,
  onMount,
}: CifraRightSidebarProps) {
  const router = useRouter();
  useLayoutEffect(() => {
    onMount?.();
  }, [onMount]);

  async function saveAndOpenLibrary() {
    const key = libraryTrackKey?.trim();
    if (key) {
      await fetch("/api/cifra/library-save", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackKey: key }),
      }).catch(() => undefined);
    }
    router.push("/biblioteca");
  }

  return (
    <aside
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col gap-4 px-4 py-4 sm:px-5 lg:h-full lg:w-[300px] lg:shrink-0 lg:px-5 lg:py-5",
        className,
      )}
      aria-label="Painel da faixa"
    >
      <p className="font-mono text-[9px] font-normal uppercase tracking-[0.16em] text-cifra-muted">
        Painel da faixa
      </p>

      <div className="flex gap-2.5">
        <CircleCheck className="size-[22px] shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-semibold text-cifra-text">Sincronizado</p>
          <p className="text-[11px] leading-snug text-cifra-muted">
            {trackTitle
              ? `Pré-visualização de «${trackTitle}» carregada da base Schubert.`
              : "Revisão salva na sua biblioteca."}
          </p>
          {isPrivate ? (
            <p className="pt-1">
              <span className="inline-flex rounded-md border border-cifra-teal/35 bg-cifra-teal/10 px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-cifra-teal">
                Privada
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {variationSlot ? (
        <div className="min-w-0 rounded-lg border border-white/6 bg-[#0c0c14] px-3 py-3">{variationSlot}</div>
      ) : null}

      <div className="space-y-3 rounded-lg border border-white/6 bg-[#0c0c14] px-3 py-3">
        <label className="flex flex-col gap-1" htmlFor="cifra-original-tune">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Tom original
          </span>
          <input
            id="cifra-original-tune"
            type="text"
            value={originalTune}
            onChange={(e) => onOriginalTuneChange(e.target.value)}
            placeholder="ex.: E standard, DADGAD…"
            autoComplete="off"
            className="w-full rounded-md border border-cifra-border bg-cifra-bg px-2.5 py-2 text-[12px] text-cifra-text outline-none transition-colors placeholder:text-cifra-muted/70 focus-visible:border-cifra-teal/45 focus-visible:ring-1 focus-visible:ring-cifra-teal/30"
          />
        </label>
        <label className="flex flex-col gap-1" htmlFor="cifra-capo-at">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Capo (traste)
          </span>
          <span className="flex items-center gap-2">
            <input
              id="cifra-capo-at"
              type="range"
              min={0}
              max={24}
              step={1}
              value={capoAt}
              onChange={(e) => onCapoAtChange(Number(e.target.value))}
              className="cifra-range cifra-range--sm h-3 min-w-0 flex-1"
            />
            <span className="w-8 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-cifra-teal">
              {capoAt}
            </span>
          </span>
        </label>
      </div>

      <div className="h-px w-full bg-cifra-border" aria-hidden />

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-[#5c5c78]">Patrocinado</p>
        <div className="flex min-h-[200px] flex-col justify-center gap-2 rounded-[10px] border border-white/6 bg-[#12121f] px-3.5 py-4">
          <p className="text-center text-xs font-semibold text-[#8888a8]">Médio retângulo</p>
          <p className="text-center text-[10px] leading-[1.45] text-[#6a6a88]">
            Oferta ou marca alinhada ao contexto musical — sem interromper a leitura principal.
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-cifra-text">Leitura</h2>

        <fieldset className="mt-3 space-y-2.5 border-0 p-0">
          <legend className="text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Modo de rolagem
          </legend>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-white/4">
            <input
              ref={scrollModeAutomaticRef}
              type="radio"
              name="cifra-scroll-mode"
              value="automatic"
              defaultChecked
              className="mt-0.5 size-3.5 shrink-0 accent-cifra-teal"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-cifra-text">Rolagem automática</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-cifra-muted">
                A posição vertical segue o tempo da reprodução (com antecipação opcional).
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-white/4">
            <input
              ref={scrollModeSmartRef}
              type="radio"
              name="cifra-scroll-mode"
              value="smart"
              className="mt-0.5 size-3.5 shrink-0 accent-cifra-teal"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-cifra-text">Rolagem inteligente</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-cifra-muted">
                Centra a vista na célula do acorde em destaque (como na POC com{" "}
                <code className="font-mono text-[9px] text-cifra-teal/90">pickActiveChordTrackCell</code>
                ).
              </span>
            </span>
          </label>
        </fieldset>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-cifra-border pt-3">
          <span className="text-[11px] text-cifra-muted">Ativar rolagem</span>
          <button
            ref={autoScrollBtnRef}
            type="button"
            role="switch"
            aria-checked="false"
            className="group relative h-[22px] w-10 shrink-0 rounded-full bg-white/15 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cifra-teal/50 data-[on=true]:bg-cifra-teal"
            aria-label="Ativar ou desativar rolagem da cifra"
          >
            <span
              className="pointer-events-none absolute left-[3px] top-[3px] size-4 rounded-full bg-[#080810] shadow-sm transition-transform duration-200 ease-out group-data-[on=true]:translate-x-[18px]"
              aria-hidden
            />
          </button>
        </div>

        <div className="mt-4 space-y-4 border-t border-cifra-border pt-4">
          <label className="flex w-full flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Antecipação
            <span className="flex items-center gap-2">
              <input
                ref={autoScrollLeadRef}
                type="range"
                min={0}
                max={2}
                step={0.05}
                defaultValue={0.4}
                className="cifra-range cifra-range--sm h-3 min-w-0 flex-1"
              />
              <span
                ref={autoScrollLeadValRef}
                className="w-13 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-cifra-teal"
              >
                0,40 s
              </span>
            </span>
          </label>
          <label className="flex w-full flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-[#7a7a98]">
            Duração scroll
            <span className="flex items-center gap-2">
              <input
                ref={autoScrollDurRef}
                type="range"
                min={200}
                max={1200}
                step={50}
                defaultValue={450}
                className="cifra-range cifra-range--sm h-3 min-w-0 flex-1"
              />
              <span
                ref={autoScrollDurValRef}
                className="w-13 shrink-0 text-right font-mono text-xs font-medium tabular-nums text-cifra-teal"
              >
                450 ms
              </span>
            </span>
          </label>
          <p className="text-[9px] leading-relaxed text-cifra-muted">
            A duração do movimento aplica-se à <strong className="font-medium text-cifra-text">rolagem inteligente</strong>.
            Na automática, o deslocamento é directamente ligado ao tempo.
          </p>
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-between py-2 text-left text-[11px] text-cifra-muted transition-colors hover:text-cifra-text"
          onClick={() => {
            const el = document.getElementById("cifra-transport");
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            el?.focus({ preventScroll: true });
          }}
        >
          Transporte (modal)
          <ChevronRight className="size-4 shrink-0 opacity-80" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div className="h-px w-full bg-cifra-border" aria-hidden />

      <div>
        <h2 className="text-xs font-semibold text-cifra-text">Ações</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => void saveAndOpenLibrary()}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-cifra-teal px-4 py-3 text-xs font-semibold text-cifra-bg transition-opacity hover:opacity-95"
          >
            <Library className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            Salvar na sua biblioteca
          </button>
          <Link
            href="/biblioteca/importar/arquivo"
            className="flex items-center justify-center gap-2 rounded-[10px] border border-cifra-border px-4 py-3 text-xs font-semibold text-cifra-text transition-colors hover:border-cifra-teal/35 hover:bg-white/3"
          >
            <Sparkles className="size-4 shrink-0 text-cifra-teal" strokeWidth={2} aria-hidden />
            Nova detecção
          </Link>
          <button
            type="button"
            disabled
            title="Em breve"
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-[10px] px-3.5 py-2.5 text-xs font-normal text-cifra-muted opacity-60"
          >
            <FileDown className="size-4 shrink-0" strokeWidth={1.75} aria-hidden />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="mt-auto rounded-[10px] border border-cifra-teal/20 bg-cifra-teal/5 px-3 py-3 pt-1">
        <p className="text-[11px] font-semibold text-cifra-teal">Menos anúncios no Pro</p>
        <p className="mt-1.5 text-[10px] leading-snug text-cifra-muted">
          Upgrade remove estes espaços e libera exportações prioritárias.
        </p>
        <Link
          href="/cadastro"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-cifra-teal px-3 py-2 text-[11px] font-semibold text-cifra-bg transition-opacity hover:opacity-95"
        >
          Ver planos
        </Link>
      </div>
    </aside>
  );
}
