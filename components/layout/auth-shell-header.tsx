import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";

import { defaultAuthShellNav } from "@/lib/auth-layout/default-copy";
import type { AuthShellNavItem } from "@/lib/auth-layout/types";
import { cn } from "@/lib/utils";

export type AuthShellHeaderProps = {
  items?: AuthShellNavItem[];
  helpHref?: string;
  helpLabel?: string;
  className?: string;
};

export function AuthShellHeader({
  items = defaultAuthShellNav,
  helpHref = "/ajuda",
  helpLabel = "Ajuda",
  className,
}: AuthShellHeaderProps) {
  return (
    <header className={cn("w-full", className)}>
      <div className="flex w-full min-w-0 items-center justify-between gap-4 px-6 py-5 md:px-10">
        <nav className="flex min-w-0 flex-wrap items-center gap-x-[14px] gap-y-2 text-xs sm:gap-x-[18px] md:text-sm">
          <Link
            href="/"
            className="mr-1 flex shrink-0 items-center opacity-90 hover:opacity-100 sm:mr-0"
          >
            <span className="relative block size-[26px] overflow-hidden rounded-md">
              <Image
                src="/logo.svg"
                alt="cifra.ai"
                width={828}
                height={220}
                className="h-full w-full object-contain object-left"
                unoptimized
              />
            </span>
          </Link>
          {items.map((item, i) => (
            <Fragment key={item.href}>
              {i > 0 && (
                <span className="hidden text-[#444466] sm:inline" aria-hidden>
                  ·
                </span>
              )}
              <Link
                href={item.href}
                className={cn(
                  "shrink-0 transition-colors",
                  item.current
                    ? "font-semibold text-cifra-teal"
                    : "font-normal text-cifra-muted hover:text-cifra-text"
                )}
              >
                {item.label}
              </Link>
            </Fragment>
          ))}
        </nav>
        <Link
          href={helpHref}
          className="shrink-0 text-xs text-cifra-muted transition-colors hover:text-cifra-text md:text-sm"
        >
          {helpLabel}
        </Link>
      </div>
    </header>
  );
}
