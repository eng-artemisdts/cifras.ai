"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Lightbulb, Link2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

type StreamingPlatformId = "youtube" | "spotify" | "tiktok" | "instagram";

/**
 * Marcas em `public/streaming-brands/`: raster exportado do Pencil (MCP `export_nodes`)
 * a partir dos frames `o6y9g` (YouTube), `tg228` (Spotify), `JVx18` (TikTok), `X8j9T` (Instagram).
 */
const platformLogo = {
  youtube: "/streaming-brands/youtube.png",
  spotify: "/streaming-brands/spotify.png",
  tiktok: "/streaming-brands/tiktok.png",
  instagram: "/streaming-brands/instagram.png",
} as const;

const proBadge = (
  <span
    className="inline-flex shrink-0 items-center rounded-full border border-cifra-gold/80 bg-cifra-gold/10 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-cifra-gold"
    aria-label="Exclusivo plano Pro"
  >
    PRO
  </span>
);

function PlatformMark({ src, className }: { src: string; className?: string }) {
  return (
    <span
      className={cn(
        "relative size-12 shrink-0 overflow-hidden rounded-xl bg-cifra-bg ring-1 ring-white/8",
        className
      )}
    >
      <Image
        src={src}
        alt=""
        width={48}
        height={48}
        className="size-full object-cover"
        draggable={false}
        unoptimized
      />
    </span>
  );
}

type RowBase = {
  id: StreamingPlatformId;
  href: string;
  title: string;
  description: string;
  logoSrc: string;
  locked?: boolean;
};

function PlatformRow({ row }: { row: RowBase }) {
  const locked = row.locked === true;

  return (
    <Link
      href={row.href}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        locked
          ? "border-cifra-gold/40 opacity-95 hover:border-cifra-gold/55"
          : "border-white/[0.07] hover:border-cifra-teal/35 hover:bg-cifra-teal/4"
      )}
    >
      <PlatformMark src={row.logoSrc} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[15px] font-semibold leading-tight tracking-tight text-cifra-text">{row.title}</p>
        <p className="text-[11px] leading-[1.45] text-cifra-muted">{row.description}</p>
      </div>
      {locked ? (
        <div className="flex shrink-0 items-center gap-2">
          {proBadge}
          <Lock className="size-4 text-cifra-gold" strokeWidth={1.75} aria-hidden />
        </div>
      ) : (
        <ChevronRight className="size-4 shrink-0 text-cifra-muted opacity-90" strokeWidth={1.75} aria-hidden />
      )}
    </Link>
  );
}

export function StreamingImportRightPanel({ className }: { className?: string }) {
  const rows: RowBase[] = [
    {
      id: "youtube",
      href: "/biblioteca/importar/youtube",
      title: "YouTube",
      description: "Vídeos, Shorts e playlists — link na etapa seguinte",
      logoSrc: platformLogo.youtube,
    },
    {
      id: "spotify",
      href: "/biblioteca/importar/spotify",
      title: "Spotify",
      description: "Música, podcast ou playlist pública",
      logoSrc: platformLogo.spotify,
    },
    {
      id: "tiktok",
      href: "/biblioteca/importar/tiktok",
      title: "TikTok",
      description: "Exclusivo Pro — faça upgrade para importar do TikTok.",
      logoSrc: platformLogo.tiktok,
      locked: true,
    },
    {
      id: "instagram",
      href: "/biblioteca/importar/instagram",
      title: "Instagram Reels",
      description: "Exclusivo Pro — faça upgrade para importar Reels do Instagram.",
      logoSrc: platformLogo.instagram,
      locked: true,
    },
  ];

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3 md:gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 shrink-0 text-cifra-teal" strokeWidth={1.75} aria-hidden />
          <h2 className="text-xs font-semibold leading-none text-cifra-text">Escolha a plataforma</h2>
        </div>
        <p className="text-right font-mono text-[10px] leading-tight text-cifra-teal">
          Reels e TikTok · exclusivo Pro
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 md:gap-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-cifra-border bg-cifra-surface">
          <div className="h-1 w-full shrink-0 bg-cifra-teal" aria-hidden />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-5 py-3">
            <span className="font-mono text-[10px] tracking-[0.2em] text-cifra-muted">ORIGEM</span>
            <span className="max-w-[min(100%,220px)] text-right font-mono text-[9px] leading-snug text-cifra-muted">
              Pro: Reels e TikTok bloqueados no Free
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 px-5 pb-3 pt-3">
            {rows.map((row) => (
              <PlatformRow key={row.id} row={row} />
            ))}
          </div>
          <div className="flex shrink-0 justify-center border-t border-white/6 px-5 py-1.5">
            <Link
              href="/biblioteca/importar/arquivo"
              className="text-[11px] font-medium text-cifra-teal transition-colors hover:text-cifra-teal-hover"
            >
              Pular · enviar arquivo do computador
            </Link>
          </div>
        </div>

        <div className="grid gap-px overflow-hidden rounded-xl border border-cifra-border bg-cifra-border sm:grid-cols-3">
          <div className="bg-cifra-surface-2 px-4 py-3 sm:border-r sm:border-white/6">
            <p className="text-[10px] font-semibold leading-tight text-cifra-text">Links públicos</p>
            <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">
              Vídeos e playlists precisam estar acessíveis sem login especial.
            </p>
          </div>
          <div className="bg-cifra-surface-2 px-4 py-3 sm:border-r sm:border-white/6">
            <p className="text-[10px] font-semibold leading-tight text-cifra-text">Detecção Pro mais precisa</p>
            <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">
              Assinantes Pro usam pipelines de IA com modelos e ajustes extras — acordes mais estáveis em
              arranjos densos e menos retrabalho manual antes de exportar a cifra.
            </p>
          </div>
          <div className="bg-cifra-surface-2 px-4 py-3">
            <p className="text-[10px] font-semibold leading-tight text-cifra-gold">Privacidade</p>
            <p className="mt-1.5 text-[10px] leading-[1.4] text-cifra-muted">
              Só processamos o áudio necessário para gerar a cifra.
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 pt-0.5">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-cifra-gold" strokeWidth={1.75} aria-hidden />
          <p className="text-[10px] leading-[1.45] text-cifra-muted">
            Conteúdo com muita voz comprimida ou marca d&apos;água pode reduzir a precisão da IA.
          </p>
        </div>
      </div>
    </div>
  );
}
