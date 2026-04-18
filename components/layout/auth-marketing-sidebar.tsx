"use client";

import Image from "next/image";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect } from "react";

import { defaultAuthSidebarFeatures } from "@/lib/auth-layout/default-copy";
import { useMarketingSidebarUiStore } from "@/lib/auth-layout/marketing-sidebar-ui-store";
import type { AuthSidebarFeature } from "@/lib/auth-layout/types";
import { cn } from "@/lib/utils";

export type AuthMarketingSidebarProps = {
  /** Rótulo superior (ex.: contexto da tela) */
  contextLabel?: string;
  /** Se falso, o rótulo não é forçado em maiúsculas (ex.: `cifra · lab`). */
  contextUppercase?: boolean;
  titleLine1?: string;
  titleLine2?: string;
  /** Terceira linha do título (ex.: «do streaming»), tipografia muted. */
  titleLine3?: string;
  /** Parágrafo opcional entre o título e a lista (ex.: cadastro). */
  introText?: string;
  features?: AuthSidebarFeature[];
  brandName?: string;
  footerNote?: string;
  className?: string;
};

export function AuthMarketingSidebar({
  contextLabel = "AUTH · ACESSO",
  contextUppercase = true,
  titleLine1 = "Entrar",
  titleLine2 = "na sua conta",
  titleLine3,
  introText,
  features = defaultAuthSidebarFeatures,
  brandName = "cifra.ai",
  footerNote = "© 2026 Artemis Digital Tech",
  className,
}: AuthMarketingSidebarProps) {
  const collapsed = useMarketingSidebarUiStore((s) => s.collapsed);
  const toggle = useMarketingSidebarUiStore((s) => s.toggleCollapsed);

  useEffect(() => {
    void useMarketingSidebarUiStore.persist.rehydrate();
  }, []);

  return (
    <aside
      data-collapsed={collapsed || undefined}
      className={cn(
        "relative flex shrink-0 flex-col justify-between border-r border-white/[0.07] bg-linear-to-br from-[#1c1f3e] to-cifra-bg transition-[width,min-width,max-width] duration-300 ease-out",
        className,
        collapsed
          ? "w-18 min-w-18 max-w-18 shrink-0 lg:w-18 lg:min-w-18 lg:max-w-18"
          : "w-full max-w-[400px] lg:w-[400px] lg:max-w-[400px] lg:shrink-0"
      )}
    >
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-7 overflow-hidden p-10 pt-12",
          collapsed && "items-center px-2 pt-10"
        )}
      >
        <div
          className={cn(
            "flex w-full items-center justify-between gap-3",
            collapsed && "flex-col justify-start gap-6"
          )}
        >
          <p
            className={cn(
              "font-mono text-[10px] font-normal tracking-[0.28em] text-cifra-teal",
              contextUppercase && "uppercase tracking-[0.2em]",
              collapsed && "sr-only"
            )}
          >
            {contextLabel}
          </p>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expandir painel" : "Recolher painel"}
            className="flex shrink-0 items-center justify-center rounded-lg border border-white/9 px-2.5 py-1.5 text-cifra-muted transition-colors hover:border-white/20 hover:text-cifra-text"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px]" strokeWidth={1.5} />
            ) : (
              <PanelLeftClose className="size-[18px]" strokeWidth={1.5} />
            )}
          </button>
        </div>

        <div className={cn("flex flex-col gap-0.5", collapsed && "sr-only")}>
          <h2 className="font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-none tracking-tight text-cifra-text">
            {titleLine1}
          </h2>
          <p className="font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-none tracking-tight text-transparent bg-linear-to-br from-white from-15% to-cifra-teal bg-clip-text">
            {titleLine2}
          </p>
          {titleLine3 ? (
            <p className="font-serif text-[clamp(2rem,4vw,3rem)] font-normal leading-none tracking-tight text-cifra-muted">
              {titleLine3}
            </p>
          ) : null}
        </div>

        {introText ? (
          <p
            className={cn(
              "max-w-[300px] text-[13px] leading-relaxed text-cifra-muted",
              collapsed && "sr-only"
            )}
          >
            {introText}
          </p>
        ) : null}

        <ul className={cn("flex flex-col gap-3.5", collapsed && "sr-only")}>
          {features.map((f) => (
            <li key={f.title} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 h-9 w-[3px] shrink-0 rounded-[2px]",
                  f.accent === "teal" ? "bg-cifra-teal" : "bg-white/9"
                )}
                aria-hidden
              />
              <div className="min-w-0 space-y-0.5">
                <p className="text-[13px] font-semibold text-cifra-text">{f.title}</p>
                <p className="text-[11px] leading-snug text-cifra-muted">{f.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div
        className={cn(
          "flex flex-col gap-2.5 border-t border-white/6 p-10 pt-0",
          collapsed && "items-center border-0 px-2 pb-8 pt-4"
        )}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-md",
            collapsed ? "size-8" : "h-7 w-18"
          )}
        >
          <Image
            src="/logo.svg"
            alt={collapsed ? brandName : ""}
            width={828}
            height={220}
            className="h-full w-full object-contain object-left"
            unoptimized
          />
        </div>
        {!collapsed && (
          <>
            <p className="font-serif text-[15px] text-cifra-teal">{brandName}</p>
            <p className="font-mono text-[9px] text-[#6a6a88]">{footerNote}</p>
          </>
        )}
      </div>
    </aside>
  );
}
